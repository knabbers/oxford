// Swimming rules (DOM-free, three-free; underscore = not auto-loaded). Used by systems/swim.js and tools/smoke_swim.mjs.
//   SW               tuning constants
//   BedField         the river bed near the swimmer: a grid of depths from the collider's water test (banks shelve)
//   stepSwim()       one frame of swimming: strokes, banks, diving, buoyancy, breath
//   findEntry/Exit() where a jump from a bank / bridge would land, where a swimmer can climb out — from the water and
//                    collision data only (no hand-placed spots), so they follow whatever the map / place modules do
//   schoolsIn()/fishAt()  deterministic fish: a function of the 20 m map cell and the shared clock

export const SW = {
  surfY: 0.035,            // world.Y.water: the drawn surface
  headUnder: -0.32,        // body-centre height below which the head is under
  speed: 1.5, crawl: 2.7, under: 1.7, underFast: 2.3,      // m/s (walking is 2.6, running 6.2)
  breath: 22, recover: 5,  // seconds of air / seconds to get it all back
  minDive: 1.0,            // no diving in water shallower than this
  cell: 20,                // fish cell (m)
};

// ---------------------------------------------------------------- hashing / noise (same on every client)
export function hash2(ix, iz, k = 0) {
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul((k | 0) + 1, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, z, k = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, k), b = hash2(ix + 1, iz, k), c = hash2(ix, iz + 1, k), d = hash2(ix + 1, iz + 1, k);
  return (a + (b - a) * ux) * (1 - uz) + (c + (d - c) * ux) * uz;
}
/** deepest the channel gets around (x, z): 1.5–2.8 m (Oxford's rivers are shallow) */
export const channelDepth = (x, z) => 1.5 + 1.3 * vnoise(x / 45, z / 45, 7);

// ---------------------------------------------------------------- river bed
export class BedField {
  /** isWater(x, z) -> bool. n × n vertices `cell` metres apart, re-centred as the swimmer moves. */
  constructor(isWater, n = 41, cell = 1.5) {
    this.isWater = isWater; this.n = n; this.cell = cell; this.half = ((n - 1) * cell) / 2;
    this.cx = NaN; this.cz = NaN; this.version = 0; this._row = -1;
    this.d = new Float32Array(n * n);      // distance to the nearest dry vertex (m), 0 = dry
    this.y = new Float32Array(n * n);      // bed height (negative = under water; dry vertices sit just above the surface)
  }
  /** true when (x, z) is close enough to the edge of the grid that it should be re-centred */
  stale(x, z) { return !(Math.abs(x - this.cx) < this.half - 16 && Math.abs(z - this.cz) < this.half - 16); }
  /** start re-centring on (x, z); the water tests (the slow part) are then done a few rows a frame by work() */
  begin(x, z) {
    const c = this.cell, G = 6;
    this._nx = Math.round(x / (c * G)) * c * G; this._nz = Math.round(z / (c * G)) * c * G; this._row = 0;
    if (!this._d2) { this._d2 = new Float32Array(this.n * this.n); this._y2 = new Float32Array(this.n * this.n); }
  }
  get pending() { return this._row >= 0; }
  /** do up to `rows` rows of the pending re-centre; true when the new grid is in place */
  work(rows = 3) {
    if (!(this._row >= 0)) return true;
    const n = this.n, c = this.cell, d = this._d2, y = this._y2, x0 = this._nx - this.half, z0 = this._nz - this.half, BIG = 1e3;
    const end = Math.min(n, this._row + rows);
    for (let j = this._row; j < end; j++) for (let i = 0; i < n; i++) d[j * n + i] = this.isWater(x0 + i * c, z0 + j * c) ? BIG : 0;
    this._row = end;
    if (end < n) return false;
    // two-pass chamfer distance (in cells) to the nearest dry vertex; beyond the grid counts as far away
    const A = 1, B = 1.4142;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i; let v = d[k]; if (!v) continue;
      if (i > 0 && d[k - 1] + A < v) v = d[k - 1] + A;
      if (j > 0) { if (d[k - n] + A < v) v = d[k - n] + A; if (i > 0 && d[k - n - 1] + B < v) v = d[k - n - 1] + B; if (i < n - 1 && d[k - n + 1] + B < v) v = d[k - n + 1] + B; }
      d[k] = v;
    }
    for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i; let v = d[k]; if (!v) continue;
      if (i < n - 1 && d[k + 1] + A < v) v = d[k + 1] + A;
      if (j < n - 1) { if (d[k + n] + A < v) v = d[k + n] + A; if (i < n - 1 && d[k + n + 1] + B < v) v = d[k + n + 1] + B; if (i > 0 && d[k + n - 1] + B < v) v = d[k + n - 1] + B; }
      d[k] = v;
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, wx = x0 + i * c, wz = z0 + j * c, m = Math.min(d[k], 40) * c;
      d[k] = m;
      if (!m) { y[k] = 0.4; continue; }
      const t = Math.min(1, m / 4.5), s = t * t * (3 - 2 * t);
      y[k] = SW.surfY - (0.3 + (channelDepth(wx, wz) - 0.3) * s + 0.16 * (vnoise(wx / 2.3, wz / 2.3, 3) - 0.5) * s);
    }
    this._d2 = this.d; this._y2 = this.y; this.d = d; this.y = y;
    this.cx = this._nx; this.cz = this._nz; this._row = -1; this.version++;
    return true;
  }
  /** re-centre now (about 15 ms on the widest reach of the Thames: only when there is no grid to swim on meanwhile) */
  recentre(x, z) { this.begin(x, z); this.work(this.n); }
  /**
   * Keep the grid under (x, z): a few rows a frame once (x, z) nears its edge. Off the grid altogether it is rebuilt at
   * once — or, with lazy, a few rows a frame as well (depthAt() is 0 there meanwhile: fine for fish, not for a swimmer).
   */
  follow(x, z, rows = 3, lazy = false) {
    if (!(Math.abs(x - this.cx) < this.half - 3 && Math.abs(z - this.cz) < this.half - 3)) {
      if (!(this._row >= 0 && Math.abs(x - this._nx) < this.half - 3 && Math.abs(z - this._nz) < this.half - 3)) this.begin(x, z);
      this.work(lazy ? rows : this.n); return;      // (not lazy: finish what is pending now)
    }
    if (this._row >= 0) this.work(rows); else if (this.stale(x, z)) this.begin(x, z);
  }
  /** bed height at (x, z) (bilinear); 0.4 off the grid / on land */
  bedY(x, z) {
    const n = this.n, c = this.cell, gx = (x - this.cx + this.half) / c, gz = (z - this.cz + this.half) / c;
    if (!(gx >= 0 && gz >= 0 && gx < n - 1 && gz < n - 1)) return 0.4;
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, k = j * n + i, y = this.y;
    return (y[k] * (1 - fx) + y[k + 1] * fx) * (1 - fz) + (y[k + n] * (1 - fx) + y[k + n + 1] * fx) * fz;
  }
  /** water depth (m, >= 0) */
  depthAt(x, z) { return Math.max(0, SW.surfY - this.bedY(x, z)); }
}

// ---------------------------------------------------------------- one frame of swimming
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * S: {x, z, y, h, speed, vy, breath (0..1), forced, plunge}  — y is the body-centre height (surfY at the surface)
 * I: {mx, my, run, dive, rise, yaw}   E: {isWater(x,z), depthAt(x,z), blocked?(x0,z0,x1,z1)}
 * Returns a bit mask: 1 went under, 2 surfaced, 4 out of breath (forced up), 8 touched a bank.
 */
export function stepSwim(S, I, dt, E) {
  let ev = 0;
  const wasUnder = S.y < SW.headUnder, moving = I.mx !== 0 || I.my !== 0;
  const vmax = moving ? (wasUnder ? (I.run ? SW.underFast : SW.under) : I.run ? SW.crawl : SW.speed) : 0;
  S.speed += (vmax - S.speed) * Math.min(1, dt * (vmax > S.speed ? 2.4 : 1.5));
  if (moving) S.h = wrap(S.h + wrap(I.yaw + Math.atan2(-I.mx, I.my) - S.h) * Math.min(1, dt * 5));
  if (S.speed > 0.02) {
    const fx = Math.sin(S.h), fz = Math.cos(S.h), st = S.speed * dt, R = 0.38;
    const free = (x, z) => E.isWater(x + fx * R, z + fz * R) && E.isWater(x, z) && !(E.blocked && E.blocked(S.x, S.z, x + fx * R, z + fz * R));
    let nx = S.x + fx * st, nz = S.z + fz * st;
    if (!free(nx, nz)) {
      ev |= 8;
      if (free(nx, S.z)) nz = S.z; else if (free(S.x, nz)) nx = S.x; else { nx = S.x; nz = S.z; S.speed *= Math.max(0, 1 - dt * 8); }
    }
    S.x = nx; S.z = nz;
  }
  const depth = E.depthAt(S.x, S.z), floorY = Math.min(SW.surfY, SW.surfY - depth + 0.38);
  const canDive = depth > SW.minDive && !S.forced;
  let tv;
  if (I.dive && canDive) { tv = -1.6; S.plunge = false; }
  else if (I.rise || S.forced || S.plunge) tv = S.forced ? 2.4 : 1.7;
  else tv = S.y > -0.6 ? 1.1 : 0.1;          // near the top you bob up; deeper you hang there (a touch buoyant)
  S.vy += (tv - S.vy) * Math.min(1, dt * 4);
  S.y += S.vy * dt;
  if (S.y >= SW.surfY) { S.y = SW.surfY; if (S.vy > 0) S.vy = 0; S.plunge = false; }
  if (S.y < floorY) { S.y = floorY; if (S.vy < 0) S.vy = 0; }
  const under = S.y < SW.headUnder;
  if (under) {
    S.breath -= dt / SW.breath;
    if (S.breath <= 0) { S.breath = 0; if (!S.forced) { S.forced = true; ev |= 4; } }
  } else {
    S.breath = Math.min(1, S.breath + dt / SW.recover);
    if (S.forced && S.breath > 0.3) S.forced = false;
  }
  if (under && !wasUnder) ev |= 1; else if (!under && wasUnder) ev |= 2;
  return ev;
}

// ---------------------------------------------------------------- getting in / out
const ENTRY_D = [0.7, 1.1, 1.5, 1.9, 2.4, 3.0, 3.6];
/**
 * Where a jump from (x, z) facing h lands: {x, z, d, bridge} or null. col: the Collider (isWet / isWater / raycast).
 * A bank needs the water within 1.9 m; from a bridge deck (standing over water) the jump clears the parapet, up to 3.6 m.
 */
export function findEntry(col, x, z, h, out = {}) {
  const fx = Math.sin(h), fz = Math.cos(h), bridge = col.isWater(x, z);
  for (let i = 0; i < ENTRY_D.length; i++) {
    const d = ENTRY_D[i];
    if (!bridge && d > 1.9) break;
    const px = x + fx * d, pz = z + fz * d;
    if (!col.isWet(px, pz)) continue;
    let tx = px + fx * 1.0, tz = pz + fz * 1.0;
    if (!col.isWet(tx, tz)) { tx = px + fx * 0.35; tz = pz + fz * 0.35; if (!col.isWet(tx, tz)) { tx = px; tz = pz; } }
    const t = col.raycast(x, z, tx, tz);                    // a tall wall in the way (low walls / railings are vaulted)
    if (t !== null && !col.isWater(x + (tx - x) * t, z + (tz - z) * t)) return null;
    out.x = tx; out.z = tz; out.d = Math.hypot(tx - x, tz - z); out.bridge = bridge;
    return out;
  }
  return null;
}
const EXIT_A = [0, 0.4, -0.4, 0.8, -0.8, 1.25, -1.25, 1.8, -1.8, 2.5, -2.5, Math.PI], EXIT_D = [0.7, 1.0, 1.4, 1.8, 2.2];
/** A dry, free spot a swimmer at (x, z) facing h can climb out to: {x, z} or null. ok(x, z) = free of walls / buildings. */
export function findExit(col, ok, x, z, h, out = {}) {
  for (let a = 0; a < EXIT_A.length; a++) {
    const fx = Math.sin(h + EXIT_A[a]), fz = Math.cos(h + EXIT_A[a]);
    for (let i = 0; i < EXIT_D.length; i++) {
      const px = x + fx * EXIT_D[i], pz = z + fz * EXIT_D[i];
      if (col.isWater(px, pz)) continue;
      if (col.raycast(x, z, px, pz) !== null) break;
      if (!ok(px, pz) || col.isWater(px + fx * 0.3, pz + fz * 0.3)) continue;      // a tree, a bench, a kink in the bank: a little further on
      out.x = px; out.z = pz; return out;
    }
  }
  return null;
}

// ---------------------------------------------------------------- fish
// kind: [name, min n, max n, min length, max length, tint r g b, striped, wary (m it keeps from a swimmer)]
export const FISH = [
  ['roach', 8, 14, 0.15, 0.22, 0.78, 0.82, 0.86, 0, 2.0],
  ['perch', 5, 8, 0.2, 0.3, 0.6, 0.66, 0.36, 1, 2.2],
  ['chub', 3, 5, 0.34, 0.46, 0.66, 0.62, 0.46, 0, 2.6],
  ['pike', 1, 1, 0.8, 1.02, 0.42, 0.52, 0.3, 1, 5.5],
];
/**
 * The schools that live in fish cell (cx, cz): pushes {kind, n, len, x, z, ax, az, w1, w2, p1, p2, df, seed} onto out.
 * Same for every player (hashed from the cell). A school's home and its whole wander lie in water, or it is not there.
 */
export function schoolsIn(cx, cz, isWater, out) {
  const C = SW.cell, n = hash2(cx, cz, 11) < 0.9 ? (hash2(cx, cz, 12) < 0.5 ? 3 : 2) : 1;
  for (let s = 0; s < n + 1; s++) {
    const pike = s === n;
    if (pike && hash2(cx, cz, 13) > 0.12) break;
    const k = 20 + s * 16, r = (j) => hash2(cx, cz, k + j);
    let x = 0, z = 0, okHome = false;
    for (let t = 0; t < 4 && !okHome; t++) { x = (cx + 0.15 + 0.7 * hash2(cx, cz, k + 9 + t * 2)) * C; z = (cz + 0.15 + 0.7 * hash2(cx, cz, k + 10 + t * 2)) * C; okHome = isWater(x, z); }
    if (!okHome) continue;
    const kind = pike ? 3 : r(0) < 0.5 ? 0 : r(0) < 0.8 ? 1 : 2, F = FISH[kind];
    let ax = 3 + 5 * r(1), az = 3 + 5 * r(2), fits = false;
    for (let t = 0; t < 4 && !fits; t++) {
      fits = true;
      for (let q = 0; q < 8 && fits; q++) { const a = (q / 8) * Math.PI * 2; fits = isWater(x + ax * 1.15 * Math.cos(a), z + az * 1.15 * Math.sin(a)) && isWater(x + ax * 0.6 * Math.cos(a + 0.4), z + az * 0.6 * Math.sin(a + 0.4)); }
      if (!fits) { ax *= 0.5; az *= 0.5; }
    }
    if (!fits) continue;
    out.push({ kind, n: F[1] + Math.floor(r(3) * (F[2] - F[1] + 1)), len: F[3] + r(4) * (F[4] - F[3]), x, z, ax, az,
      w1: (0.05 + 0.06 * r(5)) * (pike ? 0.5 : 1), w2: (0.04 + 0.07 * r(6)) * (pike ? 0.5 : 1), p1: r(7) * 6.283, p2: r(8) * 6.283,
      df: pike ? 0.72 : 0.35 + 0.4 * r(14), seed: Math.floor(r(15) * 1e6) });
  }
  return out;
}
/** Fish i of school s at shared time t (seconds): writes o.x, o.z, o.dy (height offset, m), o.h (heading), o.len. */
export function fishAt(s, i, t, o) {
  const a = hash2(s.seed, i, 1), b = hash2(s.seed, i, 2), c = hash2(s.seed, i, 3);
  const spread = s.kind === 3 ? 0 : 0.35 + 0.16 * s.n * (0.3 + 0.7 * b);
  const w = (0.22 + 0.3 * a) * (c < 0.5 ? 1 : -1), th = a * 6.283 + w * t;
  const e1 = s.w1 * t + s.p1, e2 = s.w2 * t + s.p2;
  o.x = s.x + s.ax * Math.sin(e1) + spread * Math.cos(th);
  o.z = s.z + s.az * Math.sin(e2) + spread * 0.7 * Math.sin(th);
  // velocity (analytic) -> heading
  const vx = s.ax * s.w1 * Math.cos(e1) - spread * w * Math.sin(th), vz = s.az * s.w2 * Math.cos(e2) + spread * 0.7 * w * Math.cos(th);
  o.h = Math.atan2(vx, vz); o.v = Math.hypot(vx, vz);
  o.dy = (c - 0.5) * 0.5 + 0.08 * Math.sin(t * 0.7 + a * 9);
  o.len = s.len * (0.85 + 0.3 * b);
  return o;
}
