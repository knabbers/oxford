// Small geometry batcher for the Mathematical Institute module (owned by places/maths.js).
// Collects triangles per material key (positions, normals, uvs), then emits one merged Mesh per key.
import * as THREE from 'three';

export class Batch {
  constructor() { this.parts = new Map(); }
  _p(k) { let p = this.parts.get(k); if (!p) this.parts.set(k, (p = { pos: [], nor: [], uv: [] })); return p; }
  /** triangle with a flat normal (counter-clockwise seen from the front) */
  tri(k, a, b, c, ta = [0, 0], tb = [0, 0], tc = [0, 0]) {
    const P = this._p(k);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    P.pos.push(...a, ...b, ...c); P.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); P.uv.push(...ta, ...tb, ...tc);
  }
  /** quad a,b,c,d (ccw from front) */
  quad(k, a, b, c, d, ta = [0, 0], tb = [1, 0], tc = [1, 1], td = [0, 1]) { this.tri(k, a, b, c, ta, tb, tc); this.tri(k, a, c, d, ta, tc, td); }
  /** both faces */
  quad2(k, a, b, c, d, ta, tb, tc, td) { this.quad(k, a, b, c, d, ta, tb, tc, td); this.quad(k, d, c, b, a, td, tc, tb, ta); }
  /** vertical wall from (ax,az) to (bx,bz), y0..y1, facing the side to the right of a->b when seen from above with
   *  x east / z south... i.e. normal = (dz, -dx)/L. UVs: u along (metres / su), v up (metres / sv). */
  wall(k, ax, az, bx, bz, y0, y1, su = 1, sv = 1, u0 = 0, v0 = 0) {
    const L = Math.hypot(bx - ax, bz - az);
    this.quad(k, [ax, y0, az], [ax, y1, az], [bx, y1, bz], [bx, y0, bz], [u0, v0 + y0 / sv], [u0, v0 + y1 / sv], [u0 + L / su, v0 + y1 / sv], [u0 + L / su, v0 + y0 / sv]);
  }
  /** oriented box: centre (cx, cy, cz), size w (local x) × h × d (local z), rotated by heading ry. */
  box(k, cx, cy, cz, w, h, d, ry = 0, o = {}) {
    const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2, hh = h / 2, hd = d / 2, us = o.uv || 1;
    const T = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const p = [T(-hw, -hh, -hd), T(hw, -hh, -hd), T(hw, -hh, hd), T(-hw, -hh, hd), T(-hw, hh, -hd), T(hw, hh, -hd), T(hw, hh, hd), T(-hw, hh, hd)];
    const f = (i0, i1, i2, i3, uw, vh) => this.quad(k, p[i0], p[i1], p[i2], p[i3], [0, 0], [uw / us, 0], [uw / us, vh / us], [0, vh / us]);
    f(3, 2, 6, 7, w, h); f(1, 0, 4, 5, w, h); f(2, 1, 5, 6, d, h); f(0, 3, 7, 4, d, h);
    if (o.top !== false) f(7, 6, 5, 4, w, d);
    if (o.bottom) f(0, 1, 2, 3, w, d);
  }
  /** axis-aligned box from corners */
  aabb(k, x0, y0, z0, x1, y1, z1, o) { this.box(k, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 0, o); }
  /** a straight bar of square section t between two 3D points */
  bar(k, a, b, t) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    if (L < 1e-6) return;
    const d = new THREE.Vector3(dx / L, dy / L, dz / L), up = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(d, up).normalize().multiplyScalar(t / 2), v = new THREE.Vector3().crossVectors(u, d).normalize().multiplyScalar(t / 2);
    const P = (p, su, sv) => [p[0] + u.x * su + v.x * sv, p[1] + u.y * su + v.y * sv, p[2] + u.z * su + v.z * sv];
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 4; i++) { const [s1, t1] = corners[i], [s2, t2] = corners[(i + 1) % 4]; this.quad(k, P(a, s1, t1), P(a, s2, t2), P(b, s2, t2), P(b, s1, t1)); }
  }
  /** flat polygon [[x,z],...] at height y facing up (or down). UVs = (x, z) / uvs. */
  flat(k, poly, y, down = false, uvs = 1, holes = []) {
    const contour = poly.map(([x, z]) => new THREE.Vector2(x, z)), hs = holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
    const tris = THREE.ShapeUtils.triangulateShape(contour, hs), all = [...contour, ...hs.flat()];
    for (const [i, j, l] of tris) {
      const A = all[i], B = all[j], C = all[l];
      // orient by the actual winding: up-facing needs (B-A)x(C-A) to have +y
      const cr = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
      const up = cr < 0;   // x east, z south: ccw seen from above means negative in (x,z)
      let p = [A, B, C]; if (up === down) p = [A, C, B];
      this.tri(k, [p[0].x, y, p[0].y], [p[1].x, y, p[1].y], [p[2].x, y, p[2].y], [p[0].x / uvs, p[0].y / uvs], [p[1].x / uvs, p[1].y / uvs], [p[2].x / uvs, p[2].y / uvs]);
    }
  }
  /** emit meshes: mats = {key: Material}. Returns array of meshes (added to parent if given). */
  build(mats, parent, opts = {}) {
    const out = [];
    for (const [k, p] of this.parts) {
      if (!p.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[k] || mats.default);
      m.name = 'maths:' + k;
      if (opts.shadows) { m.castShadow = !(opts.noCast || []).includes(k); m.receiveShadow = true; }
      out.push(m); if (parent) parent.add(m);
    }
    return out;
  }
  tris() { let n = 0; for (const p of this.parts.values()) n += p.pos.length / 9; return n; }
}

/** Point along segment. */
export const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Signed area in (x,z) (positive = clockwise seen from above with z south). */
export function signedArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
