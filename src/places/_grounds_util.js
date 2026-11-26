// Small helpers for worcester_grounds: a vertex-coloured geometry accumulator (everything static of one material is
// merged into ONE mesh), polygon maths, and a local frame helper.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const _c = new THREE.Color(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const CYL = {};
const cyl = (seg) => CYL[seg] || (CYL[seg] = new THREE.CylinderGeometry(1, 1, 1, seg, 1, false).toNonIndexed());

/** Accumulates triangles with per-vertex colour (and metric UVs from world xz or a planar projection). */
export class Acc {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; }
  get tris() { return this.pos.length / 9; }
  /** Append a (non-indexed) geometry transformed by matrix with a flat colour (hex or THREE.Color). */
  geom(g, matrix, color) {
    const P = g.attributes.position, N = g.attributes.normal;
    _c.set(color); _nm.getNormalMatrix(matrix);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(matrix);
      this.pos.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize();
      this.nor.push(_n.x, _n.y, _n.z);
      this.col.push(_c.r, _c.g, _c.b);
      // planar metric UVs: pick the projection by dominant normal
      const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
      if (ay >= ax && ay >= az) this.uv.push(_v.x, _v.z); else if (ax >= az) this.uv.push(_v.z, _v.y); else this.uv.push(_v.x, _v.y);
    }
    return this;
  }
  /** Box with its BOTTOM centre at (x,y,z), size w (local x) × h × d (local z), rotated by heading rotY. */
  box(x, y, z, w, h, d, rotY, color, rotX = 0, rotZ = 0) {
    _e.set(rotX, rotY, rotZ, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(w, h, d));
    _m.multiply(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
    return this.geom(BOX, _m, color);
  }
  /** Box centred at (x,y,z). */
  cbox(x, y, z, w, h, d, rotY, color) { return this.box(x, y - h / 2, z, w, h, d, rotY, color); }
  /** Cylinder standing on (x,y,z), radius r, height h. */
  cyl(x, y, z, r, h, color, seg = 8, rTop = r) {
    _m.compose(_p.set(x, y + h / 2, z), _q.identity(), _s.set(r, h, r));
    if (rTop !== r) { const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1, false).toNonIndexed(); _m.compose(_p.set(x, y + h / 2, z), _q.identity(), _s.set(1, 1, 1)); return this.geom(g, _m, color); }
    return this.geom(cyl(seg), _m, color);
  }
  /** A square-section beam between two 3D points. */
  beam(ax, ay, az, bx, by, bz, t, color, t2 = t) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); if (L < 1e-5) return this;
    _v.set(dx / L, dy / L, dz / L); _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v);
    _m.compose(_p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), _q, _s.set(t, L, t2));
    return this.geom(BOX, _m, color);
  }
  /** Flat polygon (open ring of [x,z]) at height y, facing up. */
  flat(poly, y, color) {
    const pts = poly.map(([x, z]) => new THREE.Vector2(x, z));
    const tri = THREE.ShapeUtils.triangulateShape(pts, []);
    _c.set(color);
    for (const t of tri) {
      // ensure CCW seen from above (normal +y): in x/z with z south, use cross product sign
      let [a, b, c] = t; const A = poly[a], B = poly[b], C = poly[c];
      if ((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0) [b, c] = [c, b];
      for (const k of [a, b, c]) { const [x, z] = poly[k]; this.pos.push(x, y, z); this.nor.push(0, 1, 0); this.col.push(_c.r, _c.g, _c.b); this.uv.push(x, z); }
    }
    return this;
  }
  /** Flat quad from 4 corners [x,z] at height y. */
  quad(a, b, c, d, y, color) { return this.flat([a, b, c, d], y, color); }
  /** Flat strip of width w along a polyline at height y. */
  strip(pts, w, y, color, closed = false) {
    const n = pts.length, P = closed ? [...pts, pts[0]] : pts;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1e-5) continue;
      const nx = (-(bz - az) / L) * w / 2, nz = ((bx - ax) / L) * w / 2, ex = ((bx - ax) / L) * w / 2, ez = ((bz - az) / L) * w / 2;
      this.quad([ax + nx - ex, az + nz - ez], [bx + nx + ex, bz + nz + ez], [bx - nx + ex, bz - nz + ez], [ax - nx - ex, az - nz - ez], y, color);
    }
    return this;
  }
  toGeometry(uvScale = 1) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvScale === 1 ? this.uv : this.uv.map((u) => u / uvScale), 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  mesh(material, uvScale = 1) { return new THREE.Mesh(this.toGeometry(uvScale), material); }
}

// ------------------------------------------------------------------------------------------------ polygon maths
export function pip(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function dSeg(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}
/** Distance from a point to a ring's edges; out = optional [x,z] receiving the closest point. */
export function dRing(x, z, ring, out) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0], az = ring[j][1], bx = ring[i][0], bz = ring[i][1];
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    const px = ax + t * dx, pz = az + t * dz, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; if (out) { out[0] = px; out[1] = pz; } }
  }
  return best;
}
/** Points every `step` metres along a ring (or polyline). */
export function alongRing(ring, step, closed = true) {
  const out = [], n = ring.length, m = closed ? n : n - 1;
  let carry = 0;
  for (let i = 0; i < m; i++) {
    const a = ring[i], b = ring[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = carry;
    while (t < L) { const k = t / L; out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1])]); t += step; }
    carry = t - L;
  }
  return out;
}

/** Local frame: origin o, unit axis u (x,z); local (s,t) -> world with t along the left normal n = (u.z?..). */
export function frame(ox, oz, ux, uz) {
  const L = Math.hypot(ux, uz); ux /= L; uz /= L;
  const nx = uz, nz = -ux;   // n = u rotated -90° seen from above (with z south): for u = east, n = north
  return {
    ox, oz, ux, uz, nx, nz,
    p(s, t) { return [ox + ux * s + nx * t, oz + uz * s + nz * t]; },
    heading: Math.atan2(ux, uz),      // heading of +u
    headingN: Math.atan2(nx, nz),     // heading of +n
  };
}
