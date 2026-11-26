// Dynamic props: a small rigid-body solver (pure: no THREE, no DOM; node-testable by tools/smoke_props.mjs).
//
// Bodies are boxes, cylinders / cone frustums (axis = local y) or spheres, with their centre of mass at the local
// origin (the shape may be offset from it: a lamp column's heavy foot, a wheelie bin's wheels). They stand on a
// height field (env.ground(x, z)), bounce off the 2D static collider (env.wall(P, r, low) pushes the circle P out,
// as core/collision.js resolve does) and off each other (spheres along each body's long axis: "probes").
//
// Contact model: sequential impulses (Catto) on point contacts with per-contact friction cones and restitution,
// no velocity bias (no energy is injected: penetration is removed by projecting the body up / out afterwards).
//   box       the 8 corners
//   cylinder  per cap, the lowest point of the rim (exact for rolling on its side); 4 rim points while near upright
//   sphere    the lowest point
//   + optional extra points (a lamp's lantern arm) and wheels (anisotropic friction: they roll along their plane)
// Gravity, buoyancy in water (env.water(x, z) -> surface y or null; the bed is 1.6 m under it), rolling resistance
// while touching the ground, and sleeping: a body that has stayed slow for 0.5 s with a contact sleeps and costs
// nothing until something wakes it. Fixed step (1/60 s) with an accumulator, at most 3 steps a frame.
//
// API: new PhysWorld(env) · .add(body) · .remove(body) · .step(dt) · .awakeCount() · energy(body)
//      new Body(spec) · body.wake() · body.sleep() · body.applyImpulse(J, worldPoint) · body.setPose(x, y, z, yaw)
//      env = { ground(x,z), water(x,z)|null, wall(P,r,low)->bool, impact(body, speed, kind, x, y, z, other) }

export const G = 9.81;
export const STEP = 1 / 60;

export function quatToMat(q, R) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  R[0] = 1 - (yy + zz); R[1] = xy - wz; R[2] = xz + wy;
  R[3] = xy + wz; R[4] = 1 - (xx + zz); R[5] = yz - wx;
  R[6] = xz - wy; R[7] = yz + wx; R[8] = 1 - (xx + yy);
  return R;
}

export class Body {
  /**
   * spec: { shape: 'box'|'cyl'|'sphere', mass, c:[x,y,z] + h:[hx,hy,hz] (box: centre offset + half extents),
   *         y0, y1, r0, r1 (cylinder along local y, relative to the centre of mass), r (sphere), hollow (sphere),
   *         e restitution, mu friction, roll rolling resistance (1/s), float (buoyancy at full immersion / weight),
   *         pts [[x,y,z]…] extra contact points, wheels {pts, axle:[x,y,z], mu}, Ik inertia scale, probes [[x,y,z,r]…] }
   */
  constructor(o) {
    this.id = o.id ?? 0;
    this.shape = o.shape || 'box';
    this.m = o.mass; this.im = 1 / o.mass;
    this.c = o.c || [0, 0, 0]; this.h = o.h || [0.2, 0.2, 0.2];
    this.y0 = o.y0 ?? -0.5; this.y1 = o.y1 ?? 0.5; this.r0 = o.r0 ?? 0.2; this.r1 = o.r1 ?? this.r0; this.r = o.r ?? 0.2;
    this.e = o.e ?? 0.3; this.mu = o.mu ?? 0.5; this.roll = o.roll ?? 0.8; this.float = o.float ?? 0;
    this.pts = o.pts || null; this.wheels = o.wheels || null;
    const m = this.m, k = o.Ik || 1;
    let I;
    if (this.shape === 'box') {
      const [hx, hy, hz] = this.h, [cx, cy, cz] = this.c, W = 2 * hx, H = 2 * hy, D = 2 * hz;
      I = [m / 12 * (H * H + D * D) + m * (cy * cy + cz * cz), m / 12 * (W * W + D * D) + m * (cx * cx + cz * cz), m / 12 * (W * W + H * H) + m * (cx * cx + cy * cy)];
    } else if (this.shape === 'cyl') {
      const r = (this.r0 + this.r1) / 2, L = this.y1 - this.y0, cy = (this.y0 + this.y1) / 2;
      const ix = m * (3 * r * r + L * L) / 12 + m * cy * cy;
      I = [ix, 0.5 * m * r * r, ix];
    } else { const s = (o.hollow ? 2 / 3 : 0.4) * m * this.r * this.r; I = [s, s, s]; }
    this.I = I.map((x) => Math.max(1e-5, x * k)); this.iI = this.I.map((x) => 1 / x);
    this.probes = o.probes || makeProbes(this);
    let br = 0; for (const p of this.probes) br = Math.max(br, Math.hypot(p[0], p[1], p[2]) + p[3]);
    if (this.pts) for (const p of this.pts) br = Math.max(br, Math.hypot(p[0], p[1], p[2]));
    this.br = br;
    this.p = [0, 0, 0]; this.q = [0, 0, 0, 1]; this.v = [0, 0, 0]; this.w = [0, 0, 0]; this.R = new Float64Array(9); quatToMat(this.q, this.R);
    this.awake = true; this.still = 0; this.age = 0; this.air = 0; this.ground = false; this.wet = false; this.slide = 0; this.lastHit = -1; this.dead = false;
    this.world = null; this.user = null;
  }
  setPose(x, y, z, yaw = 0) {
    this.p[0] = x; this.p[1] = y; this.p[2] = z;
    this.q[0] = 0; this.q[1] = Math.sin(yaw / 2); this.q[2] = 0; this.q[3] = Math.cos(yaw / 2);
    quatToMat(this.q, this.R); return this;
  }
  wake() { if (!this.awake) { this.awake = true; this.still = 0; if (this.world) this.world.onWake(this); } }
  sleep() { this.awake = false; this.v[0] = this.v[1] = this.v[2] = 0; this.w[0] = this.w[1] = this.w[2] = 0; this.still = 0; }
  /** world vector of local (x, y, z) */
  rot(x, y, z, out) { const R = this.R; out[0] = R[0] * x + R[1] * y + R[2] * z; out[1] = R[3] * x + R[4] * y + R[5] * z; out[2] = R[6] * x + R[7] * y + R[8] * z; return out; }
  /** inverse world inertia times u */
  iIw(ux, uy, uz, out) {
    const R = this.R, iI = this.iI;
    const a = (R[0] * ux + R[3] * uy + R[6] * uz) * iI[0], b = (R[1] * ux + R[4] * uy + R[7] * uz) * iI[1], c = (R[2] * ux + R[5] * uy + R[8] * uz) * iI[2];
    out[0] = R[0] * a + R[1] * b + R[2] * c; out[1] = R[3] * a + R[4] * b + R[5] * c; out[2] = R[6] * a + R[7] * b + R[8] * c; return out;
  }
  /** apply impulse J (world) at world point (px, py, pz) */
  applyImpulse(jx, jy, jz, px, py, pz) {
    const rx = px - this.p[0], ry = py - this.p[1], rz = pz - this.p[2], t = _t;
    this.v[0] += jx * this.im; this.v[1] += jy * this.im; this.v[2] += jz * this.im;
    this.iIw(ry * jz - rz * jy, rz * jx - rx * jz, rx * jy - ry * jx, t);
    this.w[0] += t[0]; this.w[1] += t[1]; this.w[2] += t[2];
    this.wake();
  }
  /** 1 / effective mass along unit d at world offset r from the centre of mass */
  kAlong(rx, ry, rz, dx, dy, dz) {
    const ux = ry * dz - rz * dy, uy = rz * dx - rx * dz, uz = rx * dy - ry * dx, t = _t;
    this.iIw(ux, uy, uz, t);
    return this.im + ux * t[0] + uy * t[1] + uz * t[2];
  }
  /** local up axis in the world (cosine of the tilt = its y) */
  get upY() { return this.R[4]; }
}
const _t = [0, 0, 0], _u = [0, 0, 0];

function makeProbes(b) {
  const out = [];
  if (b.shape === 'sphere') return [[0, 0, 0, b.r]];
  if (b.shape === 'cyl') {
    const r = Math.max(b.r0, b.r1, 0.04), L = b.y1 - b.y0;
    const n = L <= 2 * r ? 1 : Math.min(8, Math.ceil(L / (1.6 * r)) + 1);
    for (let i = 0; i < n; i++) { const y = n === 1 ? (b.y0 + b.y1) / 2 : b.y0 + r * 0.6 + (L - 1.2 * r) * i / (n - 1); out.push([0, y, 0, r]); }
    return out;
  }
  const h = b.h, k = h[0] >= h[1] && h[0] >= h[2] ? 0 : h[1] >= h[2] ? 1 : 2, a = (k + 1) % 3, c = (k + 2) % 3;
  const r = Math.max(h[a], h[c], 0.04), L = 2 * h[k];
  const n = L <= 2 * r ? 1 : Math.min(8, Math.ceil(L / (1.6 * r)) + 1);
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : -h[k] + r * 0.6 + (L - 1.2 * r) * i / (n - 1), p = [b.c[0], b.c[1], b.c[2], r * 0.92];
    p[k] += s; out.push(p);
  }
  return out;
}

/** kinetic + potential energy (J) */
export function energy(b) {
  const v = b.v, w = b.w, R = b.R;
  const a = R[0] * w[0] + R[3] * w[1] + R[6] * w[2], c = R[1] * w[0] + R[4] * w[1] + R[7] * w[2], d = R[2] * w[0] + R[5] * w[1] + R[8] * w[2];
  return 0.5 * b.m * (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) + 0.5 * (b.I[0] * a * a + b.I[1] * c * c + b.I[2] * d * d) + b.m * G * b.p[1];
}

// ---------------------------------------------------------------- contacts
const MAXC = 900;
function mkC() { return { b: null, o: null, px: 0, py: 0, pz: 0, nx: 0, ny: 0, nz: 0, pen: 0, kn: 0, t1: [0, 0, 0], t2: [0, 0, 0], kt1: 0, kt2: 0, mu1: 0, mu2: 0, jn: 0, jt1: 0, jt2: 0, tgt: 0, kind: 0, e: 0 }; }

export class PhysWorld {
  constructor(env = {}) {
    this.env = env; this.bodies = []; this.acc = 0; this.iters = 6; this.t = 0; this.steps = 0;
    this.cs = []; for (let i = 0; i < MAXC; i++) this.cs.push(mkC());
    this.nc = 0; this._awake = 0; this.P = { x: 0, z: 0 }; this.pts = new Float64Array(64 * 4);
    this.wakeHook = null;
    const P = this.pts;
    this._put = (x, y, z, wh) => { const n = this._n; if (n >= 64) return; const o = n * 4; P[o] = x; P[o + 1] = y; P[o + 2] = z; P[o + 3] = wh; this._n = n + 1; };
  }
  add(b) { b.world = this; this.bodies.push(b); return b; }
  remove(b) { const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1); b.world = null; }
  onWake(b) { if (this.wakeHook) this.wakeHook(b); }
  awakeCount() { let n = 0; for (const b of this.bodies) if (b.awake && !b.kin) n++; return n; }

  step(dt) {
    let any = false; for (const b of this.bodies) if (b.awake && !b.kin) { any = true; break; }
    if (!any) { this.acc = 0; return 0; }
    this.acc = Math.min(this.acc + dt, 3 * STEP);
    let n = 0;
    while (this.acc >= STEP) { this.acc -= STEP; this.substep(STEP); n++; }
    return n;
  }

  _ground(x, z) {
    const E = this.env, wy = E.water ? E.water(x, z) : null;
    if (wy !== null && wy !== undefined) return wy - 1.6;
    return E.ground ? E.ground(x, z) : 0;
  }

  /** world contact points of b into this.pts (x, y, z, wheel 0/1) -> count */
  _points(b) {
    const R = b.R, p = b.p, put = this._put; this._n = 0;
    if (b.shape === 'box') {
      const h = b.h, c = b.c;
      for (let i = 0; i < 8; i++) {
        const lx = c[0] + (i & 1 ? h[0] : -h[0]), ly = c[1] + (i & 2 ? h[1] : -h[1]), lz = c[2] + (i & 4 ? h[2] : -h[2]);
        put(p[0] + R[0] * lx + R[1] * ly + R[2] * lz, p[1] + R[3] * lx + R[4] * ly + R[5] * lz, p[2] + R[6] * lx + R[7] * ly + R[8] * lz, 0);
      }
    } else if (b.shape === 'cyl') {
      const ax = R[1], ay = R[4], az = R[7];
      for (let k = 0; k < 2; k++) {
        const y = k ? b.y1 : b.y0, r = k ? b.r1 : b.r0, cx = p[0] + ax * y, cy = p[1] + ay * y, cz = p[2] + az * y;
        if (Math.abs(ay) < 0.985) {
          let ux = -ax * ay, uy = 1 - ay * ay, uz = -az * ay; const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
          put(cx - ux * r, cy - uy * r, cz - uz * r, 0);
        } else {
          put(cx + R[0] * r, cy + R[3] * r, cz + R[6] * r, 0); put(cx - R[0] * r, cy - R[3] * r, cz - R[6] * r, 0);
          put(cx + R[2] * r, cy + R[5] * r, cz + R[8] * r, 0); put(cx - R[2] * r, cy - R[5] * r, cz - R[8] * r, 0);
        }
      }
    } else put(p[0], p[1] - b.r, p[2], 0);
    if (b.pts) for (const q of b.pts) put(p[0] + R[0] * q[0] + R[1] * q[1] + R[2] * q[2], p[1] + R[3] * q[0] + R[4] * q[1] + R[5] * q[2], p[2] + R[6] * q[0] + R[7] * q[1] + R[8] * q[2], 0);
    if (b.wheels) for (const q of b.wheels.pts) put(p[0] + R[0] * q[0] + R[1] * q[1] + R[2] * q[2], p[1] + R[3] * q[0] + R[4] * q[1] + R[5] * q[2], p[2] + R[6] * q[0] + R[7] * q[1] + R[8] * q[2], 1);
    return this._n;
  }

  _contact(b, o, px, py, pz, nx, ny, nz, pen, kind, mu, e) {
    if (this.nc >= MAXC) return null;
    const c = this.cs[this.nc++];
    c.b = b; c.o = o; c.px = px; c.py = py; c.pz = pz; c.nx = nx; c.ny = ny; c.nz = nz; c.pen = pen; c.kind = kind; c.mu1 = c.mu2 = mu; c.e = e;
    c.jn = c.jt1 = c.jt2 = 0;
    // tangents
    let t1x, t1y, t1z;
    if (Math.abs(ny) > 0.7) { t1x = 1; t1y = 0; t1z = 0; } else { t1x = 0; t1y = 1; t1z = 0; }
    const d = t1x * nx + t1y * ny + t1z * nz; t1x -= nx * d; t1y -= ny * d; t1z -= nz * d;
    const l = Math.hypot(t1x, t1y, t1z) || 1; c.t1[0] = t1x / l; c.t1[1] = t1y / l; c.t1[2] = t1z / l;
    c.t2[0] = ny * c.t1[2] - nz * c.t1[1]; c.t2[1] = nz * c.t1[0] - nx * c.t1[2]; c.t2[2] = nx * c.t1[1] - ny * c.t1[0];
    return c;
  }

  _prep(c) {
    const b = c.b, o = c.o, rx = c.px - b.p[0], ry = c.py - b.p[1], rz = c.pz - b.p[2];
    c.kn = b.kAlong(rx, ry, rz, c.nx, c.ny, c.nz); c.kt1 = b.kAlong(rx, ry, rz, c.t1[0], c.t1[1], c.t1[2]); c.kt2 = b.kAlong(rx, ry, rz, c.t2[0], c.t2[1], c.t2[2]);
    if (o) {
      const sx = c.px - o.p[0], sy = c.py - o.p[1], sz = c.pz - o.p[2];
      c.kn += o.kAlong(sx, sy, sz, c.nx, c.ny, c.nz); c.kt1 += o.kAlong(sx, sy, sz, c.t1[0], c.t1[1], c.t1[2]); c.kt2 += o.kAlong(sx, sy, sz, c.t2[0], c.t2[1], c.t2[2]);
    }
    const vn = this._rel(c, c.nx, c.ny, c.nz);
    // touching: bounce (restitution above 0.9 m/s); still a gap: allowed to close it exactly this step, no more
    c.tgt = c.pen < 0 ? c.pen / this._h : vn < -0.9 ? -c.e * vn : 0;
    if (c.pen < 0 && vn > c.tgt) return;
    if (vn < -1.0 && c.pen > -0.03 && this.env.impact) {
      const sp = -vn;
      if (sp > (b._imp || 0)) { b._imp = sp; b._ik = c.kind; b._ix = c.px; b._iy = c.py; b._iz = c.pz; b._io = o; }
    }
  }
  /** relative velocity of b against o (or the static world) at the contact, along d */
  _rel(c, dx, dy, dz) {
    const b = c.b, v = b.v, w = b.w, rx = c.px - b.p[0], ry = c.py - b.p[1], rz = c.pz - b.p[2];
    let vx = v[0] + w[1] * rz - w[2] * ry, vy = v[1] + w[2] * rx - w[0] * rz, vz = v[2] + w[0] * ry - w[1] * rx;
    const o = c.o;
    if (o) {
      const sx = c.px - o.p[0], sy = c.py - o.p[1], sz = c.pz - o.p[2], u = o.v, q = o.w;
      vx -= u[0] + q[1] * sz - q[2] * sy; vy -= u[1] + q[2] * sx - q[0] * sz; vz -= u[2] + q[0] * sy - q[1] * sx;
    }
    return vx * dx + vy * dy + vz * dz;
  }
  _apply(c, j, dx, dy, dz) {
    const jx = dx * j, jy = dy * j, jz = dz * j, b = c.b, t = _u;
    b.v[0] += jx * b.im; b.v[1] += jy * b.im; b.v[2] += jz * b.im;
    let rx = c.px - b.p[0], ry = c.py - b.p[1], rz = c.pz - b.p[2];
    b.iIw(ry * jz - rz * jy, rz * jx - rx * jz, rx * jy - ry * jx, t); b.w[0] += t[0]; b.w[1] += t[1]; b.w[2] += t[2];
    const o = c.o;
    if (o) {
      o.v[0] -= jx * o.im; o.v[1] -= jy * o.im; o.v[2] -= jz * o.im;
      rx = c.px - o.p[0]; ry = c.py - o.p[1]; rz = c.pz - o.p[2];
      o.iIw(ry * jz - rz * jy, rz * jx - rx * jz, rx * jy - ry * jx, t); o.w[0] -= t[0]; o.w[1] -= t[1]; o.w[2] -= t[2];
    }
  }

  substep(h) {
    const E = this.env, B = this.bodies;
    this._h = h;
    this.t += h; this.steps++;
    this.nc = 0;
    // ---- forces
    for (const b of B) {
      if (!b.awake || b.kin) continue;
      b._imp = 0; b.slide = 0; b.ground = false;
      b.v[1] -= G * h;
      const wy = E.water ? E.water(b.p[0], b.p[2]) : null;
      if (wy !== null && wy !== undefined) {
        const hh = Math.max(0.08, b.br * 0.55), f = Math.min(1, Math.max(0, (wy - (b.p[1] - hh)) / (2 * hh)));
        if (f > 0 && !b.wet && b.v[1] < -0.5 && E.splash) E.splash(b, -b.v[1], b.p[0], wy, b.p[2]);
        b.wet = f > 0;
        if (f > 0) {
          b.v[1] += G * b.float * f * h;
          const dr = Math.exp(-1.8 * f * h), da = Math.exp(-2.5 * f * h);
          b.v[0] *= dr; b.v[1] *= dr; b.v[2] *= dr; b.w[0] *= da; b.w[1] *= da; b.w[2] *= da;
          if (b.drift) { b.v[0] += (b.drift[0] - b.v[0]) * 0.6 * f * h; b.v[2] += (b.drift[1] - b.v[2]) * 0.6 * f * h; }
        }
      } else b.wet = false;
    }
    // ---- gather contacts: ground, walls
    const P = this.P;
    for (const b of B) {
      if (!b.awake || b.kin) continue;
      const n = this._points(b), pts = this.pts, w = b.w;
      for (let i = 0; i < n; i++) {
        const x = pts[i * 4], y = pts[i * 4 + 1], z = pts[i * 4 + 2];
        // speculative: a point falling fast enough to reach the ground this step is a contact already
        const vy = b.v[1] + w[2] * (x - b.p[0]) - w[0] * (z - b.p[2]);
        const gy = this._ground(x, z), pen = gy - y;
        if (pen < -(0.015 + Math.max(0, -vy) * h)) continue;
        const c = this._contact(b, null, x, y, z, 0, 1, 0, pen, 0, b.mu, b.e); if (!c) break;
        if (pts[i * 4 + 3] && b.wheels) {
          // wheel: grip across (along the axle), free to roll in its plane
          const R = b.R, a = b.wheels.axle; let ax = R[0] * a[0] + R[1] * a[1] + R[2] * a[2], az = R[6] * a[0] + R[7] * a[1] + R[8] * a[2];
          const l = Math.hypot(ax, az);
          if (l > 0.3) { ax /= l; az /= l; c.t1[0] = ax; c.t1[1] = 0; c.t1[2] = az; c.t2[0] = -az; c.t2[1] = 0; c.t2[2] = ax; c.mu1 = b.mu; c.mu2 = b.wheels.mu; }
        }
        b.ground = true;
      }
      if (E.wall) for (const pr of b.probes) {
        const R = b.R, wx = b.p[0] + R[0] * pr[0] + R[1] * pr[1] + R[2] * pr[2], wy = b.p[1] + R[3] * pr[0] + R[4] * pr[1] + R[5] * pr[2], wz = b.p[2] + R[6] * pr[0] + R[7] * pr[1] + R[8] * pr[2];
        if (wy - pr[3] > 6) continue;
        P.x = wx; P.z = wz;
        if (!E.wall(P, pr[3], wy - pr[3] > 0.9)) continue;
        const dx = P.x - wx, dz = P.z - wz, d = Math.hypot(dx, dz); if (d < 1e-6) continue;
        const nx = dx / d, nz = dz / d;
        this._contact(b, null, wx - nx * pr[3], wy, wz - nz * pr[3], nx, 0, nz, d, 1, 0.3, Math.min(0.45, b.e + 0.1));
      }
    }
    // ---- body vs body (bounding spheres, then probes: their world positions computed once a step)
    for (const b of B) {
      if (b.kin) continue;
      if (!b.wp || b.wp.length !== b.probes.length * 3) b.wp = new Float64Array(b.probes.length * 3);
      if (!b.awake && b._wpDone) continue;
      const R = b.R, wp = b.wp; let k = 0;
      for (const pr of b.probes) { wp[k++] = b.p[0] + R[0] * pr[0] + R[1] * pr[1] + R[2] * pr[2]; wp[k++] = b.p[1] + R[3] * pr[0] + R[4] * pr[1] + R[5] * pr[2]; wp[k++] = b.p[2] + R[6] * pr[0] + R[7] * pr[1] + R[8] * pr[2]; }
      b._wpDone = !b.awake;
    }
    for (let i = 0; i < B.length; i++) {
      const a = B[i];
      if (a.kin) continue;
      for (let j = i + 1; j < B.length; j++) {
        const o = B[j];
        if (o.kin || (!a.awake && !o.awake)) continue;
        const dx = a.p[0] - o.p[0], dy = a.p[1] - o.p[1], dz = a.p[2] - o.p[2], rr = a.br + o.br;
        if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
        let best = false, bd = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
        const AP = a.probes, OP = o.probes, aw = a.wp, ow = o.wp;
        for (let u = 0; u < AP.length; u++) {
          const pa = AP[u], ax = aw[u * 3], ay = aw[u * 3 + 1], az = aw[u * 3 + 2];
          for (let q = 0; q < OP.length; q++) {
            const po = OP[q], ox = ow[q * 3], oy = ow[q * 3 + 1], oz = ow[q * 3 + 2];
            const ex = ax - ox, ey = ay - oy, ez = az - oz, rr2 = pa[3] + po[3], d2 = ex * ex + ey * ey + ez * ez;
            if (d2 >= rr2 * rr2) continue;
            const d = Math.sqrt(d2), pen = rr2 - d;
            if (pen > bd && d > 1e-6) { bd = pen; best = true; b0 = ox + ex / d * po[3]; b1 = oy + ey / d * po[3]; b2 = oz + ez / d * po[3]; b3 = ex / d; b4 = ey / d; b5 = ez / d; }
          }
        }
        if (!best) continue;
        if (!a.awake) a.wake(); if (!o.awake) o.wake();
        this._contact(a, o, b0, b1, b2, b3, b4, b5, bd, 2, 0.35, Math.min(a.e, o.e));
      }
    }
    // ---- solve
    const cs = this.cs, nc = this.nc;
    for (let i = 0; i < nc; i++) this._prep(cs[i]);
    for (let it = 0; it < this.iters; it++) {
      for (let i = 0; i < nc; i++) {
        const c = cs[i];
        const vn = this._rel(c, c.nx, c.ny, c.nz);
        let j = (c.tgt - vn) / c.kn; const jn = Math.max(0, c.jn + j); j = jn - c.jn; c.jn = jn;
        if (j) this._apply(c, j, c.nx, c.ny, c.nz);
        const t1 = c.t1, t2 = c.t2;
        const v1 = this._rel(c, t1[0], t1[1], t1[2]); let f = -v1 / c.kt1, lim = c.mu1 * c.jn, nf = Math.max(-lim, Math.min(lim, c.jt1 + f)); f = nf - c.jt1; c.jt1 = nf;
        if (f) this._apply(c, f, t1[0], t1[1], t1[2]);
        const v2 = this._rel(c, t2[0], t2[1], t2[2]); f = -v2 / c.kt2; lim = c.mu2 * c.jn; nf = Math.max(-lim, Math.min(lim, c.jt2 + f)); f = nf - c.jt2; c.jt2 = nf;
        if (f) this._apply(c, f, t2[0], t2[1], t2[2]);
      }
    }
    // sliding speed at ground contacts (scrape sound)
    for (let i = 0; i < nc; i++) { const c = cs[i]; if (c.kind !== 0) continue; const s = Math.hypot(this._rel(c, c.t1[0], c.t1[1], c.t1[2]), this._rel(c, c.t2[0], c.t2[1], c.t2[2])); if (s > c.b.slide) c.b.slide = s; }
    // ---- integrate, project out of the ground / walls / each other, sleep
    for (let i = 0; i < nc; i++) {
      const c = cs[i]; if (c.kind !== 2 || c.pen <= 0.005) continue;
      const a = c.b, o = c.o, s = a.im + o.im, k = (c.pen - 0.005) * 0.6;
      a.p[0] += c.nx * k * a.im / s; a.p[1] += c.ny * k * a.im / s; a.p[2] += c.nz * k * a.im / s;
      o.p[0] -= c.nx * k * o.im / s; o.p[1] -= c.ny * k * o.im / s; o.p[2] -= c.nz * k * o.im / s;
    }
    for (const b of B) {
      if (!b.awake || b.kin) continue;
      const v = b.v, w = b.w, q = b.q;
      if (b.ground) {
        // rolling resistance: on the spin about a cylinder's own axis (rolling on its side) or all of a ball's / box's
        // spin — never on a post pivoting over its foot — exponential plus a constant part so a slow roll stops
        const dw = b.roll * 1.2 * h, k = Math.exp(-b.roll * h);
        if (b.shape === 'cyl') {
          const ax = b.R[1], ay = b.R[4], az = b.R[7], wa = w[0] * ax + w[1] * ay + w[2] * az;
          let na = wa * k; na = na > 0 ? Math.max(0, na - dw) : Math.min(0, na + dw);
          const d = na - wa; w[0] += ax * d; w[1] += ay * d; w[2] += az * d;
          const k2 = Math.exp(-0.25 * h), wv = w[1]; w[1] = wv * k2;          // and a little on the yaw spin
        } else {
          const kk = b.shape === 'box' ? Math.exp(-b.roll * 0.4 * h) : k; w[0] *= kk; w[1] *= kk; w[2] *= kk;
          const wm = Math.hypot(w[0], w[1], w[2]), dd = b.shape === 'box' ? dw * 0.3 : dw;
          if (wm > 0) { const s = Math.max(0, wm - dd) / wm; w[0] *= s; w[1] *= s; w[2] *= s; }
        }
        const kl = Math.exp(-0.15 * h); v[0] *= kl; v[2] *= kl;
      }
      const wl = Math.hypot(w[0], w[1], w[2]); if (wl > 25) { const s = 25 / wl; w[0] *= s; w[1] *= s; w[2] *= s; }
      b.p[0] += v[0] * h; b.p[1] += v[1] * h; b.p[2] += v[2] * h;
      const hx = 0.5 * h * w[0], hy = 0.5 * h * w[1], hz = 0.5 * h * w[2], qx = q[0], qy = q[1], qz = q[2], qw = q[3];
      q[0] += hx * qw + hy * qz - hz * qy; q[1] += hy * qw + hz * qx - hx * qz; q[2] += hz * qw + hx * qy - hy * qx; q[3] += -hx * qx - hy * qy - hz * qz;
      const ql = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= ql; q[1] /= ql; q[2] /= ql; q[3] /= ql;
      quatToMat(q, b.R);
      // projection: lift out of the ground (no velocity added)
      const n = this._points(b), pts = this.pts; let lift = 0;
      for (let k = 0; k < n; k++) { const pen = this._ground(pts[k * 4], pts[k * 4 + 2]) - pts[k * 4 + 1]; if (pen > lift) lift = pen; }
      if (lift > 0.002) b.p[1] += (lift - 0.002) * 0.9;
      b.age += h;
      if (b.p[1] < -30) b.dead = true;
      if (b._imp && E.impact && b.age - b.lastHit > 0.07) { b.lastHit = b.age; E.impact(b, b._imp, b._ik, b._ix, b._iy, b._iz, b._io); }
      const sp2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2], wp2 = w[0] * w[0] + w[1] * w[1] + w[2] * w[2];
      if ((b.ground || b.wet) && sp2 < (b.wet ? 0.05 : 0.012) && wp2 < 0.05) { b.still += h; if (b.still > (b.wet ? 3 : 0.5)) b.sleep(); }
      else b.still = 0;
      b.air = b.ground ? 0 : b.air + h;
      if (b.air > 12) b.dead = true;
    }
    for (let i = 0; i < nc; i++) { const c = cs[i]; if (c.kind === 1 && c.pen > 0) { c.b.p[0] += c.nx * c.pen * 0.8; c.b.p[2] += c.nz * c.pen * 0.8; } }
  }
}
