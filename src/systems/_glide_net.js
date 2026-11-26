// Gliding multiplayer protocol — pure (no three.js, no DOM): encode / decode and the ownership rule.
//
// The pilot's client is authoritative for its glider. Three relay events (game.net.send):
//   'gl'  flight state, 10 Hz, only while the sender is flying (or still simulating a glider it bailed out of):
//         [k, gen, mode, x·100, y·100, z·100, yaw·1000, pitch·1000, roll·1000, airspeed·10, airbrake 0..9, flags, t]
//         ≈ 75–85 bytes of JSON → ~0.8 KB/s per flying player (+ the relay envelope). Nothing when nobody flies.
//         The pose is the one the pilot's client DREW (between two physics steps), to the centimetre, and t is the
//         shared-clock moment it was true (ms to one decimal, modulo T_MOD): the receiver lays the samples out on the sender's own
//         timeline, so uneven delivery does not show as uneven motion. (A message without t is timed by its arrival.)
//   'gr'  the glider's record (who has it, where it is parked / landed out / wrecked), on every change and re-sent to
//         players who join: {k, gen, by, pilot, mode, x, y, z, h, p, r, at}. Late joiners therefore see a glider
//         landed out in Port Meadow where it is, not at the launch point.
//   'ge'  one-off events: {k, e: 'boom'|'splash'|'release'|'bail'|'land', x, y, z, s?}
// Ownership: a record carries a generation. Getting in = writing gen + 1 with pilot = you. Two players reaching for
// the same glider at once write the same gen: the lower player id wins (both clients apply the same rule, so they
// agree without a server), the other is told the glider was taken and stays on the grass.

export const MODE = { HOME: 0, GROUND: 1, FLYING: 2, WRECK: 3, ADRIFT: 4, DITCHED: 5, LAUNCH: 6 };
export const FLAG = { CABLE: 1, BUFFET: 2, WHEEL: 4, CHUTE_OUT: 8, PAX: 16 };

export function newRecord(k, home) {
  return { k, gen: 0, by: 0, pilot: 0, pax: 0, mode: MODE.HOME, x: home.x, y: 0, z: home.z, h: home.h, p: 0, r: 0, at: 0 };
}
/** does incoming record `b` replace local record `a`? (higher generation; same generation: the lower writer id) */
export function wins(b, a) {
  if (!b || typeof b.gen !== 'number') return false;
  if (b.gen !== a.gen) return b.gen > a.gen;
  if (b.by === a.by) return (b.at || 0) >= (a.at || 0);
  return (b.by || 0) < (a.by || 0) || !a.by;
}
export function cleanRecord(o, k) {
  const n = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
  return { k, gen: n(o.gen) | 0, by: n(o.by) | 0, pilot: n(o.pilot) | 0, pax: n(o.pax) | 0, mode: n(o.mode) | 0, x: n(o.x), y: n(o.y), z: n(o.z), h: n(o.h), p: n(o.p), r: n(o.r), at: n(o.at) };
}
export const recMsg = (r) => ({ k: r.k, gen: r.gen, by: r.by, pilot: r.pilot, pax: r.pax, mode: r.mode, x: +r.x.toFixed(2), y: +r.y.toFixed(2), z: +r.z.toFixed(2), h: +r.h.toFixed(3), p: +r.p.toFixed(3), r: +r.r.toFixed(3), at: r.at });

export const T_MOD = 1e7;        // the stamp wraps every 10,000 s (the receiver starts a fresh track across the wrap)
export const DELAY = 0.25;       // s behind its own clock a remote glider is drawn: two messages and a late one, so it is nearly always between samples
/** flight state -> compact array (tMs: the shared-clock moment the pose was true, or omitted) */
export function encodeFly(k, gen, mode, s, flags, tMs) {
  const a = [k, gen, mode, Math.round(s.x * 100), Math.round(s.y * 100), Math.round(s.z * 100), Math.round(s.h * 1000), Math.round(s.pitch * 1000), Math.round(s.roll * 1000), Math.round((s.V || 0) * 10), Math.max(0, Math.min(9, Math.round((s.ab || 0) * 9))), flags | 0];
  if (Number.isFinite(tMs)) a.push(Math.round((((tMs % T_MOD) + T_MOD) % T_MOD) * 10) / 10);     // to 0.1 ms: at 150 km/h a millisecond is 4 cm
  return a;
}
/** compact array -> {k, gen, mode, x, y, z, h, pitch, roll, V, ab, flags, t (ms modulo T_MOD, or -1)} or null if malformed */
export function decodeFly(a, out = {}) {
  if (!Array.isArray(a) || a.length < 12) return null;
  for (let i = 0; i < 12; i++) if (!Number.isFinite(a[i])) return null;
  out.k = a[0] | 0; out.gen = a[1] | 0; out.mode = a[2] | 0;
  out.x = a[3] / 100; out.y = a[4] / 100; out.z = a[5] / 100; out.h = a[6] / 1000; out.pitch = a[7] / 1000; out.roll = a[8] / 1000;
  out.V = a[9] / 10; out.ab = a[10] / 9; out.flags = a[11] | 0;
  out.t = a.length > 12 && Number.isFinite(a[12]) ? a[12] : -1;
  return out;
}

// ---- a remote glider between its samples: a cubic through them (position and attitude), DELAY behind its clock.
// The slope at a sample is the central difference of its neighbours (Catmull-Rom) — or, if the next sample has not
// arrived by the time the curve gets there, the slope of the parabola through the last three. Whichever it is, it is fixed the
// first time it is used (lk) and never revised, so the curve already being drawn does not change shape when a late
// message turns up: position and velocity are continuous everywhere. (Straight lines between samples turned a
// circling glider into a polygon, with a kick ten times a second.)
const SN = 8, CH = 7;
export class Track {
  constructor() { this.t = new Float64Array(SN); this.v = new Float64Array(SN * 9); this.m = new Float64Array(SN * CH); this.lk = new Uint8Array(SN); this.n = 0; this.i = 0; this.last = -1e9; }
  push(t, s, q) {
    if (this.n && (t - this.last > 1.5 || t < this.last - 1.5)) this.n = 0;      // a long gap: start again (no gliding through walls of time)
    if (this.n && t <= this.last + 0.005) return;                                // out of order / a duplicate: the newer one stands
    const j = this.i, o = j * 9, v = this.v;
    this.t[j] = t; this.lk[j] = 0;
    v[o] = s.x; v[o + 1] = s.y; v[o + 2] = s.z; v[o + 3] = q[0]; v[o + 4] = q[1]; v[o + 5] = q[2]; v[o + 6] = q[3]; v[o + 7] = s.V || 0; v[o + 8] = s.ab || 0;
    if (this.n) {
      // the attitude the short way round from the one before (so its four numbers can be interpolated like any others)
      const p = ((j + SN - 1) % SN) * 9;
      if (v[o + 3] * v[p + 3] + v[o + 4] * v[p + 4] + v[o + 5] * v[p + 5] + v[o + 6] * v[p + 6] < 0) for (let c = 3; c < 7; c++) v[o + c] = -v[o + c];
    }
    this.i = (j + 1) % SN; if (this.n < SN) this.n++; this.last = t;
  }
  /** fix the slope at sample k (see above) */
  _slope(k) {
    if (this.lk[k]) return;
    this.lk[k] = 1;
    const newest = (this.i + SN - 1) % SN, oldest = (this.i + SN - this.n) % SN, v = this.v, m = this.m, T = this.t;
    const a = k === oldest ? k : (k + SN - 1) % SN, b = k === newest ? k : (k + 1) % SN, dt = T[b] - T[a];
    for (let c = 0; c < CH; c++) m[k * CH + c] = dt > 1e-4 ? (v[b * 9 + c] - v[a * 9 + c]) / dt : 0;
    if (k === newest && this.n > 2) {
      // nothing after it yet: the slope AT it, from the parabola through the last three (the plain difference back is
      // the slope half a message ago — in a turn that is a kink when the curve carries on from here)
      const p = (a + SN - 1) % SN, h1 = T[k] - T[a], h0 = T[a] - T[p];
      if (h1 > 1e-4 && h0 > 1e-4) for (let c = 0; c < CH; c++) { const d1 = (v[k * 9 + c] - v[a * 9 + c]) / h1, d0 = (v[a * 9 + c] - v[p * 9 + c]) / h0; m[k * CH + c] = d1 + (d1 - d0) * h1 / (h1 + h0); }
    }
  }
  /** state at time t into out {x,y,z,q:[4],V,ab}; carries on up to 0.25 s past the newest along its slope */
  sample(t, out) {
    if (!this.n) return false;
    const v = this.v, m = this.m, T = this.t;
    const newest = (this.i + SN - 1) % SN;
    let a = -1, b = newest;
    for (let c = 0, k = newest; c < this.n; c++, k = (k + SN - 1) % SN) { if (T[k] <= t) { a = k; break; } b = k; }
    const q = out.q || (out.q = [1, 0, 0, 0]);
    if (a < 0 || a === newest) {
      // before the oldest: hold it; past the newest: straight on along its slope
      const k = a < 0 ? b : newest, o = k * 9, mo = k * CH, e = a < 0 ? 0 : Math.min(0.25, t - T[k]);
      if (e > 0) this._slope(k);
      out.x = v[o] + m[mo] * e; out.y = v[o + 1] + m[mo + 1] * e; out.z = v[o + 2] + m[mo + 2] * e;
      for (let c = 0; c < 4; c++) q[c] = v[o + 3 + c] + m[mo + 3 + c] * e;
      out.V = v[o + 7]; out.ab = v[o + 8];
    } else {
      const k1 = (a + 1) % SN, o = a * 9, p = k1 * 9, mo = a * CH, mp = k1 * CH, h = T[k1] - T[a], u = h > 1e-6 ? (t - T[a]) / h : 1;
      this._slope(a); this._slope(k1);
      const u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = (u3 - 2 * u2 + u) * h, h01 = -2 * u3 + 3 * u2, h11 = (u3 - u2) * h;
      out.x = h00 * v[o] + h10 * m[mo] + h01 * v[p] + h11 * m[mp];
      out.y = h00 * v[o + 1] + h10 * m[mo + 1] + h01 * v[p + 1] + h11 * m[mp + 1];
      out.z = h00 * v[o + 2] + h10 * m[mo + 2] + h01 * v[p + 2] + h11 * m[mp + 2];
      for (let c = 0; c < 4; c++) q[c] = h00 * v[o + 3 + c] + h10 * m[mo + 3 + c] + h01 * v[p + 3 + c] + h11 * m[mp + 3 + c];
      out.V = v[o + 7] + (v[p + 7] - v[o + 7]) * u; out.ab = v[p + 8];
    }
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
    return true;
  }
}
