// Insects (2026-11 flora pass): who is on the wing and how each one moves. Pure and DOM-free (tools/smoke_flora.mjs);
// drawn by systems/insects.js. Local to each player and purely visual: nothing is sent, nothing collides, nothing stings.
//   butterflies   large white, brimstone, orange-tip, peacock, red admiral, common blue: an erratic, bobbing flight
//                 from flower to flower, settling with the wings closing (peacock and admiral bask with them open);
//                 they lift off when the player comes within a stride
//   bees          bumblebees and honeybees: short hops between neighbouring flowers, a second or two on each, then off
//   hoverflies    hang by a flower, dart a hand's width, hang again
//   dragonflies   and damselflies over still or slow water: straight darts, sudden hovers; damselflies perch on reeds
//   midges        a faint dancing cloud above the water's edge at dusk
// When: by day, dry, not foggy, not blowing hard, and warm enough for the species (bumblebees fly from about 8 °C,
// honeybees and hoverflies from 10, most butterflies from 11-12, dragonflies from 13: field-guide thresholds, rounded);
// midges at dusk from 6 °C. Nothing at night (the street lamps' moths belong to systems/streetscape.js).
import { KINDS } from './_flora_plan.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// group: 0 butterfly, 1 bee, 2 hoverfly, 3 dragonfly / damselfly, 4 midge cloud
// size = half wing span drawn (m; about 1.6x life size so they read at the camera's distance), v = cruising speed m/s
export const SPECIES = [
  { n: 'large white', g: 0, cell: 0, size: 0.05, v: 1.7, t0: 11, t1: 14, share: 0.26 },
  { n: 'brimstone', g: 0, cell: 1, size: 0.052, v: 1.9, t0: 10, t1: 13, share: 0.14 },
  { n: 'orange-tip', g: 0, cell: 2, size: 0.042, v: 1.6, t0: 12, t1: 15, share: 0.14 },
  { n: 'peacock', g: 0, cell: 3, size: 0.056, v: 2.0, t0: 11, t1: 14, share: 0.16, bask: 1 },
  { n: 'red admiral', g: 0, cell: 4, size: 0.058, v: 2.1, t0: 10, t1: 13, share: 0.16, bask: 1 },
  { n: 'common blue', g: 0, cell: 5, size: 0.034, v: 1.4, t0: 13, t1: 16, share: 0.14 },
  { n: 'bumblebee', g: 1, cell: 6, size: 0.036, v: 1.7, t0: 7.5, t1: 10.5, share: 0.5 },
  { n: 'honeybee', g: 1, cell: 7, size: 0.026, v: 2.1, t0: 10, t1: 13, share: 0.5 },
  { n: 'hoverfly', g: 2, cell: 8, size: 0.022, v: 2.6, t0: 9.5, t1: 12.5, share: 1 },
  { n: 'dragonfly', g: 3, cell: 9, size: 0.075, v: 5.2, t0: 13, t1: 16, share: 0.5 },
  { n: 'damselfly', g: 3, cell: 10, size: 0.046, v: 2.2, t0: 12, t1: 15, share: 0.5 },
  { n: 'midges', g: 4, cell: 11, size: 0.42, v: 0.3, t0: 5.5, t1: 8, share: 1 },
];
/** most insects drawn at once, per quality tier */
export const INSECT_TIERS = { low: 10, medium: 20, high: 34, ultra: 44 };
export const MAX_INSECTS = 48;
const GROUP_SHARE = [0.4, 0.45, 0.15];      // of the flower insects: butterflies, bees, hoverflies
const WATER_Y = 0.04;      // the water line (world.Y.water)
const FAVOURITE = new Set(['buddleia', 'valerian', 'lavender', 'thistle', 'allium', 'oxeye', 'cowparsley']);

/**
 * How active each species is (0..1) in this weather. env = { daylight 0..1, hour, rain 0..1, tempC, wind m/s, fog 0..1 }.
 * out: Float32Array(SPECIES.length) -> out. All zero at night and in rain.
 */
export function activity(env, out) {
  const day = ss(0.3, 0.62, env.daylight), dry = 1 - ss(0.02, 0.1, env.rain || 0), clear = 1 - ss(0.3, 0.7, env.fog || 0), wind = env.wind || 0, T = Number.isFinite(env.tempC) ? env.tempC : 10;
  const fair = day * dry * clear;
  for (let i = 0; i < SPECIES.length; i++) {
    const s = SPECIES[i];
    if (s.g === 4) { out[i] = ss(0.04, 0.16, env.daylight) * (1 - ss(0.38, 0.6, env.daylight)) * (env.hour > 12 ? 1 : 0) * dry * clear * (1 - ss(4, 7, wind)) * ss(s.t0, s.t1, T); continue; }
    const calm = 1 - ss(s.g === 0 ? 7 : 9, s.g === 0 ? 11 : 14, wind);
    out[i] = fair * calm * ss(s.t0, s.t1, T);
  }
  return out;
}
/** anything at all on the wing? */
export const anyActive = (act) => { for (let i = 0; i < act.length; i++) if (act[i] > 0.02) return true; return false; };

/**
 * The swarm: struct-of-arrays state for up to MAX_INSECTS, stepped with no allocation.
 * flowers = { n, a: Float32Array [x, yTop, z, kind] } (game.flora.flowers: what is planted near the camera).
 * Fields per insect i: sp (-1 free), x y z, h (heading), fade 0..1, amp / base / freq (wing flap: angle = base + amp sin), mode
 * (0 flying, 1 settled / feeding, 2 hovering, 3 leaving).
 */
export function createSwarm(seed = 12345) {
  const N = MAX_INSECTS;
  const S = {
    N, sp: new Int8Array(N).fill(-1), mode: new Uint8Array(N), x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), h: new Float32Array(N),
    tx: new Float32Array(N), ty: new Float32Array(N), tz: new Float32Array(N), t: new Float32Array(N), fade: new Float32Array(N), ph: new Float32Array(N),
    amp: new Float32Array(N), base: new Float32Array(N), freq: new Float32Array(N), jx: new Float32Array(N), jy: new Float32Array(N), jz: new Float32Array(N), jt: new Float32Array(N),
    visits: new Int16Array(N), ax: new Float32Array(N), ay: new Float32Array(N), az: new Float32Array(N), age: new Float32Array(N),
    count: 0, act: new Float32Array(SPECIES.length), byGroup: new Int16Array(5), want: new Int16Array(5), nectar: 0, wet: 0,
  };
  let rs = seed >>> 0;
  const rnd = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
  const kindOf = (F, i) => KINDS[F.a[i * 4 + 3] | 0];

  /** a flower index for group g (water plants for dragonflies and midges), or -1. near (x, z) within r when r > 0 */
  function pick(F, g, x, z, r, tries) {
    let best = -1, bd = 1e9;
    for (let k = 0; k < tries; k++) {
      const i = (rnd() * F.n) | 0, K = kindOf(F, i);
      if (!K || (g >= 3 ? !K.water : !K.nectar)) continue;
      const dx = F.a[i * 4] - x, dz = F.a[i * 4 + 2] - z, d = dx * dx + dz * dz;
      if (r > 0) { if (d < 0.02 || d > r * r) continue; if (d < bd) { bd = d; best = i; } }
      else { if (g === 0 && FAVOURITE.has(K.name)) return i; if (best < 0 || rnd() < 0.5) best = i; }
    }
    return best;
  }
  function aim(i, F, f, lift) { S.tx[i] = F.a[f * 4]; S.ty[i] = F.a[f * 4 + 1] + lift; S.tz[i] = F.a[f * 4 + 2]; }
  function spawn(F, spi, cx, cz) {
    const s = SPECIES[spi];
    let i = 0; while (i < S.N && S.sp[i] >= 0) i++;
    if (i >= S.N) return -1;
    let f = -1;
    for (let k = 0; k < 6 && f < 0; k++) { const c = pick(F, s.g, 0, 0, 0, 4); if (c < 0) continue; const dx = F.a[c * 4] - cx, dz = F.a[c * 4 + 2] - cz, d = dx * dx + dz * dz; if (d > 16 && d < 34 * 34) f = c; }
    if (f < 0) return -1;
    S.sp[i] = spi; S.fade[i] = 0; S.ph[i] = rnd() * 6.28; S.visits[i] = 0; S.age[i] = 0; S.h[i] = rnd() * 6.28; S.jt[i] = 0; S.jx[i] = S.jy[i] = S.jz[i] = 0;
    S.x[i] = F.a[f * 4]; S.y[i] = s.g >= 3 ? WATER_Y + 0.4 + rnd() * 0.6 : F.a[f * 4 + 1] + 0.02; S.z[i] = F.a[f * 4 + 2];
    S.ax[i] = S.x[i]; S.ay[i] = s.g >= 3 ? WATER_Y : F.a[f * 4 + 1]; S.az[i] = S.z[i];
    S.tx[i] = S.x[i]; S.ty[i] = S.y[i]; S.tz[i] = S.z[i];
    S.mode[i] = s.g === 0 || s.g === 1 ? 1 : 2; S.t[i] = 0.5 + rnd() * 2.5;
    S.count++;
    return i;
  }
  const free = (i) => { if (S.sp[i] >= 0) { S.sp[i] = -1; S.fade[i] = 0; S.count--; } };

  /**
   * One step. cam / player: {x, z} (the player's feet scare a settled butterfly). cap = the tier's most.
   * Spawns at most one insect a call, so a meadow fills over a few seconds instead of popping.
   */
  S.step = function step(dt, F, env, cap, cx, cz, px, pz) {
    activity(env, S.act);
    // what the planting near the camera can feed
    let nectar = 0, wet = 0;
    for (let i = 0; i < F.n; i++) { const K = kindOf(F, i); if (!K) continue; if (K.nectar) nectar++; if (K.water) wet++; }
    S.nectar = nectar; S.wet = wet;
    const B = S.byGroup; B.fill(0);
    for (let i = 0; i < S.N; i++) if (S.sp[i] >= 0) B[SPECIES[S.sp[i]].g]++;
    // ---- how many of each group there should be
    const rich = Math.min(1, nectar / 150), land = Math.max(0, cap - (wet ? Math.min(4, Math.ceil(cap * 0.14)) : 0));
    let want0 = 0, want1 = 0, want2 = 0, want3 = 0, want4 = 0, a0 = 0, a1 = 0, a2 = 0, a3 = 0;
    for (let i = 0; i < SPECIES.length; i++) { const s = SPECIES[i], a = S.act[i] * s.share; if (s.g === 0) a0 += a; else if (s.g === 1) a1 += a; else if (s.g === 2) a2 += a; else if (s.g === 3) a3 += a; else want4 = S.act[i] > 0.15 && wet >= 3 ? Math.min(5, Math.ceil(cap * 0.2)) : 0; }
    want0 = Math.round(land * GROUP_SHARE[0] * rich * a0); want1 = Math.round(land * GROUP_SHARE[1] * rich * a1); want2 = Math.round(land * GROUP_SHARE[2] * rich * a2);
    want3 = wet >= 3 ? Math.round(Math.min(4, Math.ceil(cap * 0.14)) * a3) : 0;
    if (nectar > 8 && a1 > 0.3 && want1 === 0) want1 = 1;
    const want = S.want; want[0] = want0; want[1] = want1; want[2] = want2; want[3] = want3; want[4] = want4;
    // ---- at most one arrival a step, into a group below its number (drawn by how far below: a group that cannot be
    // placed just now never holds the others up)
    if (F.n > 0) {
      let g = -1, lack = 0; for (let k = 0; k < 5; k++) if (want[k] > B[k]) lack += want[k] - B[k];
      if (lack > 0) { let r = rnd() * lack; for (let k = 0; k < 5; k++) if (want[k] > B[k]) { r -= want[k] - B[k]; if (r <= 0) { g = k; break; } } }
      if (g >= 0 && S.count < Math.min(cap, S.N) && rnd() < dt * 2.5) {
        let tot = 0; for (let i = 0; i < SPECIES.length; i++) if (SPECIES[i].g === g) tot += S.act[i] * SPECIES[i].share;
        let r = rnd() * tot, spi = -1; for (let i = 0; i < SPECIES.length; i++) if (SPECIES[i].g === g) { r -= S.act[i] * SPECIES[i].share; if (r <= 0) { spi = i; break; } }
        if (spi >= 0) spawn(F, spi, cx, cz);
      }
    }
    // ---- everyone
    for (let i = 0; i < S.N; i++) {
      const spi = S.sp[i]; if (spi < 0) continue;
      const s = SPECIES[spi], g = s.g; S.age[i] += dt;
      const dcx = S.x[i] - cx, dcz = S.z[i] - cz, dc2 = dcx * dcx + dcz * dcz;
      if (dc2 > 46 * 46) { free(i); continue; }
      // too many for the weather now (or its species has stopped flying): leave
      if (S.mode[i] !== 3 && (S.act[spi] < 0.02 || B[g] > want[g] + 1) && rnd() < dt * 0.8) { S.mode[i] = 3; B[g]--; S.t[i] = 3; const a = rnd() * 6.28; S.tx[i] = S.x[i] + Math.cos(a) * 30; S.tz[i] = S.z[i] + Math.sin(a) * 30; S.ty[i] = S.y[i] + 4; }
      const leaving = S.mode[i] === 3;
      S.fade[i] = leaving ? Math.max(0, S.fade[i] - dt * 0.6) : Math.min(1, S.fade[i] + dt * 1.2);
      if (leaving && S.fade[i] <= 0) { free(i); continue; }
      const t = S.age[i];
      if (g === 4) {
        // midges: each card dances about its own spot above the water's edge
        S.x[i] = S.ax[i] + Math.sin(t * 0.9 + S.ph[i]) * 0.5 + Math.sin(t * 2.3 + S.ph[i] * 2) * 0.15;
        S.y[i] = S.ay[i] + 1.5 + Math.sin(t * 1.3 + S.ph[i] * 3) * 0.35; S.z[i] = S.az[i] + Math.cos(t * 0.7 + S.ph[i]) * 0.5;
        S.h[i] += dt * 0.6; S.amp[i] = 0; S.base[i] = 0; S.freq[i] = 0;
        continue;
      }
      if (S.mode[i] === 1) {
        // settled on a flower: butterflies close their wings (or bask), bees work it
        S.t[i] -= dt;
        if (g === 0) { const open = s.bask ? 0.35 + 0.3 * Math.sin(t * 0.8 + S.ph[i]) : 1.35; S.base[i] += (open - S.base[i]) * Math.min(1, dt * 4); S.amp[i] += ((s.bask ? 0.12 : 0.06) - S.amp[i]) * Math.min(1, dt * 4); S.freq[i] = 2.2; }
        else { S.base[i] = 0.5; S.amp[i] = 0.5; S.freq[i] = 150; S.h[i] += Math.sin(t * 5 + S.ph[i]) * dt * 1.5; S.y[i] = S.ty[i] + 0.004 * Math.sin(t * 9); }
        const pdx = S.x[i] - px, pdz = S.z[i] - pz, scared = g === 0 && pdx * pdx + pdz * pdz < 1.7;
        if (S.t[i] <= 0 || scared) {
          S.visits[i]++;
          const hop = g === 1 ? 2.6 : 9, f = F.n ? pick(F, g, S.x[i], S.z[i], S.visits[i] > (g === 1 ? 9 : 5) ? 22 : hop, g === 1 ? 7 : 4) : -1;
          if (f < 0) { S.t[i] = 0.6 + rnd(); if (scared || !F.n) { S.mode[i] = 0; const a = rnd() * 6.28; S.tx[i] = S.x[i] + Math.cos(a) * 5; S.tz[i] = S.z[i] + Math.sin(a) * 5; S.ty[i] = S.y[i] + 0.8; } }
          else { aim(i, F, f, 0.02); S.mode[i] = 0; if (S.visits[i] > (g === 1 ? 9 : 5)) S.visits[i] = 0; }
        }
        continue;
      }
      if (S.mode[i] === 2) {
        // hovering: hoverflies by a flower, dragonflies over the water
        S.t[i] -= dt; S.base[i] = 0.1; S.amp[i] = g === 3 ? 0.35 : 0.5; S.freq[i] = g === 3 ? 55 : 170;
        S.x[i] += Math.sin(t * 3.1 + S.ph[i]) * dt * 0.03; S.y[i] += Math.sin(t * 2.3 + S.ph[i]) * dt * 0.02;
        if (S.t[i] <= 0) {
          if (g === 3) {
            // a new beat over the water it works: a point near one of the water plants
            const f = F.n ? pick(F, 3, S.ax[i], S.az[i], 14, 5) : -1;
            if (f >= 0) { aim(i, F, f, 0); S.ty[i] = WATER_Y + 0.25 + rnd() * 0.9; S.tx[i] += (rnd() - 0.5) * 3; S.tz[i] += (rnd() - 0.5) * 3; if (spi === 10 && rnd() < 0.4 && F.a[f * 4 + 1] > 0.3) { aim(i, F, f, 0.01); S.visits[i] = -1; } }
            else { S.tx[i] = S.ax[i] + (rnd() - 0.5) * 8; S.tz[i] = S.az[i] + (rnd() - 0.5) * 8; S.ty[i] = S.ay[i] + 0.4 + rnd() * 0.8; }
          } else {
            const f = F.n && rnd() < 0.5 ? pick(F, 2, S.x[i], S.z[i], 6, 4) : -1;
            if (f >= 0) { aim(i, F, f, 0.1 + rnd() * 0.15); S.tx[i] += (rnd() - 0.5) * 0.3; S.tz[i] += (rnd() - 0.5) * 0.3; }
            else { S.tx[i] = S.x[i] + (rnd() - 0.5) * 0.7; S.tz[i] = S.z[i] + (rnd() - 0.5) * 0.7; S.ty[i] = S.y[i] + (rnd() - 0.5) * 0.2; }
          }
          S.mode[i] = 0;
        }
        continue;
      }
      // ---- flying to (tx, ty, tz)
      let dx = S.tx[i] - S.x[i], dy = S.ty[i] - S.y[i], dz = S.tz[i] - S.z[i]; const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const v = leaving ? s.v * 1.8 : s.v, stepLen = v * dt;
      if (!leaving && d <= Math.max(0.06, stepLen)) {
        S.x[i] = S.tx[i]; S.y[i] = S.ty[i]; S.z[i] = S.tz[i];
        if (g === 0) { S.mode[i] = 1; S.t[i] = 2 + rnd() * 5; }
        else if (g === 1) { S.mode[i] = 1; S.t[i] = 0.8 + rnd() * 2.2; }
        else if (g === 3 && S.visits[i] < 0) { S.visits[i] = 0; S.mode[i] = 2; S.t[i] = 2 + rnd() * 4; S.amp[i] = 0; }
        else { S.mode[i] = 2; S.t[i] = g === 3 ? 0.4 + rnd() * 1.6 : 0.8 + rnd() * 2.4; }
        continue;
      }
      dx /= d; dy /= d; dz /= d;
      // the jink: a new sideways shove every fraction of a second (large for butterflies, slight for bees, none for dragonflies)
      S.jt[i] -= dt;
      if (S.jt[i] <= 0) { const k = g === 0 ? 1.5 : g === 1 ? 0.45 : g === 2 ? 0.2 : 0; S.jt[i] = g === 0 ? 0.18 + rnd() * 0.35 : 0.25 + rnd() * 0.4; S.jx[i] = (rnd() - 0.5) * 2 * k; S.jy[i] = (rnd() - 0.35) * 1.4 * k; S.jz[i] = (rnd() - 0.5) * 2 * k; }
      const near = Math.min(1, d / 0.8), bob = g === 0 ? Math.sin(t * 11 + S.ph[i]) * 0.5 : 0;
      const vx = dx * v + S.jx[i] * near, vy = dy * v + (S.jy[i] + bob) * near + (g === 0 && d > 1.5 ? 0.25 : 0), vz = dz * v + S.jz[i] * near;
      S.x[i] += vx * dt; S.y[i] += vy * dt; S.z[i] += vz * dt;
      const floor = (leaving ? S.ay[i] : Math.min(S.ty[i], S.ay[i])) - 0.02; if (S.y[i] < floor) S.y[i] = floor;
      let dh = Math.atan2(vx, vz) - S.h[i]; while (dh > Math.PI) dh -= 6.2832; while (dh < -Math.PI) dh += 6.2832;
      S.h[i] += dh * Math.min(1, dt * (g === 3 ? 14 : 7));
      if (g === 0) { S.base[i] += (0.15 - S.base[i]) * Math.min(1, dt * 8); S.amp[i] += (1.05 - S.amp[i]) * Math.min(1, dt * 8); S.freq[i] = 13 + (0.058 - s.size) * 260; }
      else if (g === 3) { S.base[i] = 0.05; S.amp[i] = 0.3; S.freq[i] = 60; }
      else { S.base[i] = 0.3; S.amp[i] = 0.6; S.freq[i] = 160; }
      if (leaving) { S.t[i] -= dt; }
      // remember where it last had flowers (dragonflies keep their water)
      if (g !== 3 && !leaving) { S.ax[i] = S.tx[i]; S.az[i] = S.tz[i]; S.ay[i] = Math.min(S.ty[i], S.y[i]); }
    }
    return S.count;
  };
  S.clear = () => { S.sp.fill(-1); S.fade.fill(0); S.count = 0; };
  return S;
}
