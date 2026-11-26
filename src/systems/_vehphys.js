// Vehicle body physics shared by vehicles.js / traffic.js (underscore: not auto-loaded). Pure, DOM-free, no allocation
// in the hot paths.
//
//  PHYS[type]   per-type tuning: mass, yaw inertia, tyre grip (lateral acceleration a tyre pair can give, m/s^2, dry
//               tarmac), steering lock / response, launch and brakes, suspension (pitch / roll / heave spring frequency and
//               damping), and the standable top of the body (bonnet / roof heights for jumping on).
//  capsule      every vehicle is a capsule on the ground plane: centre (x, z), heading h, half = L/2 - W/2, radius W/2.
//  contact()    closest points of two capsules -> normal (B to A), depth, contact point.
//  impulse()    rigid-body impulse with restitution + Coulomb friction between two planar bodies (linear + yaw), one side
//               optionally "ghost" (its velocity counts, but nothing is applied to it: another peer owns it).
//  Surface      grip factor of the ground under a wheel (tarmac 1, paths 0.8, grass 0.55, sand 0.45), from a coarse raster
//               of the map's areas plus the drawn surface height (road / path / pavement levels: world/ground.js Y).
//
// Headings follow the project convention: forward = (sin h, cos h). A body turning at w = dh/dt moves a point at world
// offset r = (rx, rz) from its centre with velocity w * (rz, -rx); the matching "cross product" of an offset with a
// direction n is k(r, n) = n.x * rz - n.z * rx (an impulse j along n changes the yaw rate by j * k / I).

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------- tuning
// grip: lateral acceleration (m/s^2) before the front tyres let go (understeer) / the rear (oversteer); arcade-generous
// (a road car is ~8-9; 11-12 keeps keyboard driving round town fun while still running wide when far too fast).
// yawK: how fast the yaw rate follows the steering (1/s: high = darty, low = ponderous). lock: max front-wheel angle at a
// standstill (rad; the black cab's is famously tight). steerK: speed sensitivity of the lock. steerRate: how quickly the
// wheel is wound on (1/s). acc: full-throttle acceleration (m/s^2) — same as before the physics pass; top speeds too.
// brake: peak braking (m/s^2), lock-up above lockV with steering authority `lockSteer`. hand: rear grip with the handbrake.
// pitch / roll: body angle per m/s^2 of longitudinal / lateral acceleration; f*, z*: spring frequency (Hz) and damping
// ratio of pitch, roll and heave. bonnet / roof: [z from, z to (local, + = forward), height] of the standable top.
export const PHYS = {
  bike_roadster: { m: 95, grip: 8 }, bike_road: { m: 85, grip: 8.5 }, bike_mtb: { m: 92, grip: 7.5 },
  car_hatch: { m: 1150, grip: 12.5, gripR: 13.5, yawK: 11, lock: 0.62, steerK: 0.11, steerRate: 7.5, acc: 6.0, top: 22, brake: 11, lockV: 7, lockSteer: 0.55, hand: 2.6,
    pitch: 0.0045, roll: 0.0068, fP: 1.7, zP: 0.45, fR: 1.6, zR: 0.42, fH: 2.0, zH: 0.38, bonnet: [0.95, 1.95, 0.86], roof: [-1.55, 0.6, 1.47] },
  car_saloon: { m: 1450, grip: 12, gripR: 13, yawK: 9, lock: 0.6, steerK: 0.11, steerRate: 6, acc: 6.0, top: 22, brake: 10.5, lockV: 7, lockSteer: 0.5, hand: 2.4,
    pitch: 0.0045, roll: 0.0062, fP: 1.5, zP: 0.45, fR: 1.4, zR: 0.4, fH: 1.8, zH: 0.36, bonnet: [1.1, 2.3, 0.9], roof: [-1.2, 0.55, 1.44] },
  taxi: { m: 1900, grip: 11, gripR: 12, yawK: 9.5, lock: 0.78, steerK: 0.12, steerRate: 7, acc: 6.0, top: 22, brake: 10, lockV: 7, lockSteer: 0.5, hand: 2.4,
    pitch: 0.005, roll: 0.0075, fP: 1.4, zP: 0.4, fR: 1.3, zR: 0.38, fH: 1.6, zH: 0.34, bonnet: [1.15, 2.27, 1.0], roof: [-1.6, 0.95, 1.78] },
  van: { m: 2300, grip: 9.5, gripR: 10, yawK: 6, lock: 0.6, steerK: 0.11, steerRate: 5, acc: 4.2, top: 19, brake: 9, lockV: 7, lockSteer: 0.5, hand: 2.2,
    pitch: 0.0075, roll: 0.012, fP: 1.05, zP: 0.26, fR: 0.95, zR: 0.24, fH: 1.25, zH: 0.25, bonnet: [1.75, 2.65, 1.12], roof: [-2.65, 1.6, 2.1] },
  bus: { m: 12000, grip: 6.5, gripR: 7, yawK: 3.2, lock: 0.55, steerK: 0.11, steerRate: 3.2, acc: 2.6, top: 15, brake: 6.5, lockV: 6, lockSteer: 0.55, hand: 2.0,
    pitch: 0.006, roll: 0.009, fP: 0.9, zP: 0.35, fR: 0.85, zR: 0.33, fH: 1.0, zH: 0.32, bonnet: null, roof: [-5.3, 5.3, 4.35] },
  punt: { m: 400 },
};
/** Fill in yaw inertia (uniform slab) and capsule dims from the mesh table TYPES (called once by vehicles.js). */
export function setDims(TYPES) {
  for (const k of Object.keys(PHYS)) {
    const T = TYPES[k], P = PHYS[k]; if (!T) continue;
    P.I = P.m * (T.L * T.L + T.W * T.W) / 12;
    P.half = Math.max(0, T.L / 2 - T.W / 2); P.r = T.W / 2;
  }
}
// people, for knocks: a walker's mass (vehicle momentum lost knocking somebody over)
export const PED_MASS = 75;

// ---------------------------------------------------------------- capsule contact
const _c = { nx: 0, nz: 0, depth: 0, cx: 0, cz: 0, d: 0 };
/**
 * Closest points between capsule A (ax, az, ah, ahalf, ar) and capsule B; returns null when apart, else a shared object
 * {nx, nz (unit, from B to A), depth, cx, cz (contact point, between the surfaces)}.
 */
export function contact(ax, az, ah, ahalf, ar, bx, bz, bh, bhalf, br) {
  const R = ar + br;
  const afx = Math.sin(ah), afz = Math.cos(ah), bfx = Math.sin(bh), bfz = Math.cos(bh);
  // segments P1 + s*d1 (s in [-ahalf, ahalf]), P2 + t*d2
  const rx = ax - bx, rz = az - bz;
  const b = afx * bfx + afz * bfz, c = afx * rx + afz * rz, f = bfx * rx + bfz * rz;
  let s, t;
  const den = 1 - b * b;
  if (den > 1e-6) s = clamp((b * f - c) / den, -ahalf, ahalf); else s = 0;
  t = clamp(b * s + f, -bhalf, bhalf);
  s = clamp(b * t - c, -ahalf, ahalf);
  const px = ax + afx * s, pz = az + afz * s, qx = bx + bfx * t, qz = bz + bfz * t;
  let dx = px - qx, dz = pz - qz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= R * R) return null;
  let d = Math.sqrt(d2);
  if (d < 1e-5) { dx = rx || 1e-3; dz = rz; d = Math.hypot(dx, dz) || 1; if (d < 1e-5) { dx = 1; dz = 0; d = 1; } }
  _c.nx = dx / d; _c.nz = dz / d; _c.depth = R - d; _c.d = d;
  // contact point: midway through the overlap, on the line between the two closest points
  _c.cx = qx + _c.nx * (br - _c.depth * 0.5); _c.cz = qz + _c.nz * (br - _c.depth * 0.5);
  return _c;
}

// ---------------------------------------------------------------- impulse
// A body: {x, z, vx, vz, w (yaw rate), m, I}; w is dh/dt. Result in _imp (j normal, jt friction, vn closing speed).
const _imp = { j: 0, jt: 0, vn: 0, dvA: 0, dvB: 0 };
/**
 * Two-body impulse at contact (cx, cz) with normal n (from B to A). e = restitution, mu = friction. B.ghost: B's velocity
 * and mass count, but only A is changed (another peer owns B and does the mirror image). B.fixed: infinite mass (a wall,
 * a parked car brushed too gently to be worth waking). maxDv caps the velocity change of either body (no launches).
 * Never adds energy: the normal impulse only removes closing speed (e <= 1), friction only removes sliding speed.
 */
export function impulse(A, B, cx, cz, nx, nz, e, mu, maxDv = 25) {
  const rAx = cx - A.x, rAz = cz - A.z, rBx = cx - B.x, rBz = cz - B.z;
  const fixed = !!B.fixed;
  const iMA = 1 / A.m, iIA = A.I > 0 ? 1 / A.I : 0, iMB = fixed ? 0 : 1 / B.m, iIB = fixed || !(B.I > 0) ? 0 : 1 / B.I;
  const bw = fixed ? 0 : B.w || 0, bvx = fixed ? 0 : B.vx || 0, bvz = fixed ? 0 : B.vz || 0;
  // velocities of the contact point on each body
  const vax = A.vx + A.w * rAz, vaz = A.vz - A.w * rAx;
  const vbx = bvx + bw * rBz, vbz = bvz - bw * rBx;
  const rvx = vax - vbx, rvz = vaz - vbz, vn = rvx * nx + rvz * nz;
  _imp.vn = vn; _imp.j = 0; _imp.jt = 0; _imp.dvA = 0; _imp.dvB = 0;
  if (vn >= 0) return _imp;
  const kA = nx * rAz - nz * rAx, kB = nx * rBz - nz * rBx;
  let j = -(1 + e) * vn / (iMA + kA * kA * iIA + iMB + kB * kB * iIB);
  // clamp: neither body changes speed by more than maxDv
  if (j * iMA > maxDv) j = maxDv / iMA;
  if (!fixed && j * iMB > maxDv) j = maxDv / iMB;
  // friction along the tangent of the sliding velocity
  const tvx = rvx - vn * nx, tvz = rvz - vn * nz, tl = Math.hypot(tvx, tvz);
  let jt = 0, tx = 0, tz = 0;
  if (tl > 1e-4) {
    tx = tvx / tl; tz = tvz / tl;
    const kAt = tx * rAz - tz * rAx, kBt = tx * rBz - tz * rBx;
    jt = -tl / (iMA + kAt * kAt * iIA + iMB + kBt * kBt * iIB);
    const lim = mu * j; if (jt < -lim) jt = -lim;
  }
  const Jx = j * nx + jt * tx, Jz = j * nz + jt * tz;
  A.vx += Jx * iMA; A.vz += Jz * iMA; A.w += (Jx * rAz - Jz * rAx) * iIA;
  if (!fixed && !B.ghost) { B.vx -= Jx * iMB; B.vz -= Jz * iMB; B.w = (B.w || 0) - (Jx * rBz - Jz * rBx) * iIB; }
  _imp.j = j; _imp.jt = jt; _imp.dvA = Math.hypot(Jx, Jz) * iMA; _imp.dvB = fixed ? 0 : Math.hypot(Jx, Jz) * iMB;
  return _imp;
}

/** Kinetic energy of a planar body (translation + yaw). */
export function energy(b) { return 0.5 * b.m * (b.vx * b.vx + b.vz * b.vz) + 0.5 * (b.I || 0) * (b.w || 0) * (b.w || 0); }

// ---------------------------------------------------------------- surface grip
// grip factor per area kind (world/ground.js AREA); 0 = not an area (use the default for bare ground)
const AREA_GRIP = { park: 0.55, meadow: 0.5, wood: 0.5, scrub: 0.5, grass: 0.55, garden: 0.55, pitch: 0.58, flowerbed: 0.5, sand: 0.45,
  parking: 1, paved: 1, bridge: 1, pier: 0.9 };
const GRAVEL = /gravel|fine_gravel|pebblestone|dirt|ground|unpaved|compacted|earth|mud|grass/;
/**
 * Coarse (4 m) raster of how grippy the ground is, from map.areas (scanline fill, highest-priority kind wins the cell:
 * paved over grass, so a car park inside a park is tarmac). grip(x, z, h) refines it with the drawn surface height h at
 * the wheel (world.groundHeight): a road (0.04) or a raised pavement (>= 0.1) is tarmac whatever the area says; a path
 * (0.045) is gravel-ish. Outside the raster (Port Meadow's box west of the map): grass.
 */
export class Surface {
  constructor(map, cell = 4) {
    const b = map.bounds; this.cell = cell;
    this.x0 = Math.floor(b.minX / cell) * cell; this.z0 = Math.floor(b.minZ / cell) * cell;
    this.nx = Math.ceil((b.maxX - this.x0) / cell) + 1; this.nz = Math.ceil((b.maxZ - this.z0) / cell) + 1;
    this.g = new Uint8Array(this.nx * this.nz);           // 0 = nothing; else round(grip * 100)
    this.pri = new Uint8Array(this.nx * this.nz);
    for (const a of map.areas || []) {
      let gr = AREA_GRIP[a.kind]; if (!gr) continue;
      if ((a.kind === 'parking' || a.kind === 'paved') && a.surface && GRAVEL.test(a.surface)) gr = 0.75;
      if (a.kind === 'pitch' && a.surface && a.surface !== 'grass') gr = 0.95;
      const pri = gr >= 0.9 ? 3 : gr >= 0.7 ? 2 : 1;
      this._fill(a.poly, a.holes, Math.round(gr * 100), pri);
    }
    this.pathGrip = 0.8; this.bareGrip = 0.85; this.offGrip = 0.55;
  }
  _fill(poly, holes, val, pri) {
    const c = this.cell, n = poly.length; if (n < 3) return;
    let zmin = Infinity, zmax = -Infinity;
    for (const p of poly) { if (p[1] < zmin) zmin = p[1]; if (p[1] > zmax) zmax = p[1]; }
    const r0 = Math.max(0, Math.ceil((zmin - this.z0) / c - 0.5)), r1 = Math.min(this.nz - 1, Math.floor((zmax - this.z0) / c - 0.5));
    const xs = [];
    for (let r = r0; r <= r1; r++) {
      const zc = this.z0 + (r + 0.5) * c; xs.length = 0;
      const ring = (P) => { for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > zc) !== (b[1] > zc)) xs.push(a[0] + (zc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } };
      ring(poly); if (holes) for (const h of holes) ring(h);
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - this.x0) / c - 0.5)), c1 = Math.min(this.nx - 1, Math.floor((xs[k + 1] - this.x0) / c - 0.5));
        for (let q = c0, o = r * this.nx; q <= c1; q++) if (this.pri[o + q] < pri) { this.pri[o + q] = pri; this.g[o + q] = val; }
      }
    }
  }
  /** grip factor 0.4..1 at (x, z), given the drawn surface height there */
  grip(x, z, h) {
    if (h >= 0.1 || Math.abs(h - 0.04) < 0.0025) return 1;          // pavement / road
    if (Math.abs(h - 0.045) < 0.0025) return this.pathGrip;           // a path
    const gx = Math.floor((x - this.x0) / this.cell), gz = Math.floor((z - this.z0) / this.cell);
    if (gx < 0 || gz < 0 || gx >= this.nx || gz >= this.nz) return this.offGrip;
    const v = this.g[gz * this.nx + gx];
    return v ? v / 100 : this.bareGrip;
  }
  /** a name for the HUD / tests */
  kind(g) { return g >= 0.95 ? 'tarmac' : g >= 0.7 ? 'gravel' : g >= 0.5 ? 'grass' : 'sand'; }
}

// ---------------------------------------------------------------- spring-damper (suspension pitch / roll / heave)
/** One semi-implicit step of x'' = w^2 (target - x) - 2 z w x'. s = {x, v}. Stable for any dt <= 0.05 at these freqs. */
export function spring(s, target, f, z, dt) {
  const w = 6.2832 * f;
  s.v += (w * w * (target - s.x) - 2 * z * w * s.v) * dt;
  s.x += s.v * dt;
  return s.x;
}

/** Standable top height of a vehicle body at local forward offset u (m), or -1 where there is nothing to stand on. */
export function topAt(type, u) {
  const P = PHYS[type]; if (!P) return -1;
  if (P.roof && u >= P.roof[0] && u <= P.roof[1]) return P.roof[2];
  if (P.bonnet && u >= P.bonnet[0] && u <= P.bonnet[1]) return P.bonnet[2];
  // the windscreen between them: a slope you can scramble up
  if (P.roof && P.bonnet && u > P.roof[1] && u < P.bonnet[0]) return P.roof[2] + (P.bonnet[2] - P.roof[2]) * (u - P.roof[1]) / (P.bonnet[0] - P.roof[1]);
  return -1;
}
