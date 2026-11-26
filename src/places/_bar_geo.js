// Small vertex-coloured geometry accumulator for the Cellar Bar's pool table, cues, dartboard fittings and darts.
// Everything it makes is drawn with the room's two vertex-colour materials (R.mats.col / gloss) or one textured
// material of the same kind, so the games add draws but no shader programs. Positions in metres, y up.
import * as THREE from 'three';

const _c = new THREE.Color();
export class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this._col = [1, 1, 1]; }
  /** current colour: hex (sRGB) scaled by k */
  col(hex, k = 1) { _c.setHex(hex); this._col = [_c.r * k, _c.g * k, _c.b * k]; return this; }
  _v(a, nx, ny, nz, uv) { this.p.push(a[0], a[1], a[2]); this.n.push(nx, ny, nz); this.c.push(this._col[0], this._col[1], this._col[2]); this.u.push(uv ? uv[0] : 0, uv ? uv[1] : 0); }
  tri(a, b, c, ua, ub, uc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this._v(a, nx, ny, nz, ua); this._v(b, nx, ny, nz, ub); this._v(c, nx, ny, nz, uc);
  }
  /** a, b, c, d counter-clockwise seen from the side it faces */
  quad(a, b, c, d, uv) { this.tri(a, b, c, uv && uv[0], uv && uv[1], uv && uv[2]); this.tri(a, c, d, uv && uv[0], uv && uv[2], uv && uv[3]); }
  /** box centred (cx, cz) standing on y0, w along x, d along z, turned ry about y; faces: which of 'tbnsew' to make */
  box(cx, y0, cz, w, h, d, ry = 0, faces = 'tbnsew') {
    const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2, hd = d / 2, y1 = y0 + h;
    const P = (x, y, z) => [cx + x * c + z * s, y, cz - x * s + z * c];
    const v = [P(-hw, y0, -hd), P(hw, y0, -hd), P(hw, y0, hd), P(-hw, y0, hd), P(-hw, y1, -hd), P(hw, y1, -hd), P(hw, y1, hd), P(-hw, y1, hd)];
    if (faces.includes('s')) this.quad(v[3], v[2], v[6], v[7]);
    if (faces.includes('n')) this.quad(v[1], v[0], v[4], v[5]);
    if (faces.includes('e')) this.quad(v[2], v[1], v[5], v[6]);
    if (faces.includes('w')) this.quad(v[0], v[3], v[7], v[4]);
    if (faces.includes('t')) this.quad(v[7], v[6], v[5], v[4]);
    if (faces.includes('b')) this.quad(v[0], v[1], v[2], v[3]);
    return this;
  }
  /** upright cylinder / cone frustum from y0 (radius r0) to y0 + h (radius r1), smooth-shaded sides */
  cyl(cx, y0, cz, r0, r1, h, seg = 12, o = {}) {
    const a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2, sl = (r0 - r1) / (h || 1);
    for (let i = 0; i < seg; i++) {
      const p = a0 + ((a1 - a0) * i) / seg, q = a0 + ((a1 - a0) * (i + 1)) / seg;
      const cp = Math.cos(p), sp = Math.sin(p), cq = Math.cos(q), sq = Math.sin(q);
      const A = [cx + cp * r0, y0, cz + sp * r0], B = [cx + cq * r0, y0, cz + sq * r0], C = [cx + cq * r1, y0 + h, cz + sq * r1], D = [cx + cp * r1, y0 + h, cz + sp * r1];
      const sgn = o.inside ? -1 : 1, nl = Math.hypot(1, sl);
      const push = (v, cc, ss) => this._v(v, sgn * cc / nl, sgn * sl / nl, sgn * ss / nl);
      if (o.inside) { push(A, cp, sp); push(B, cq, sq); push(C, cq, sq); push(A, cp, sp); push(C, cq, sq); push(D, cp, sp); }
      else { push(A, cp, sp); push(C, cq, sq); push(B, cq, sq); push(A, cp, sp); push(D, cp, sp); push(C, cq, sq); }
      if (o.top !== false && r1 > 0) this.tri([cx, y0 + h, cz], C, D);
      if (o.bottom) this.tri([cx, y0, cz], A, B);
    }
    return this;
  }
  /** flat disc facing up at height y (a0..a1 for a sector) */
  disc(cx, y, cz, r, seg = 16, a0 = 0, a1 = Math.PI * 2, rIn = 0) {
    for (let i = 0; i < seg; i++) {
      const p = a0 + ((a1 - a0) * i) / seg, q = a0 + ((a1 - a0) * (i + 1)) / seg;
      const A = [cx + Math.cos(p) * r, y, cz + Math.sin(p) * r], B = [cx + Math.cos(q) * r, y, cz + Math.sin(q) * r];
      if (rIn > 0) { const C = [cx + Math.cos(q) * rIn, y, cz + Math.sin(q) * rIn], D = [cx + Math.cos(p) * rIn, y, cz + Math.sin(p) * rIn]; this.quad(B, A, D, C); }
      else this.tri([cx, y, cz], B, A);
    }
    return this;
  }
  /** a rod of round section from a to b (radius ra at a, rb at b) */
  rod(a, b, ra, rb = ra, seg = 8, caps = true) {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); d.normalize();
    const u = new THREE.Vector3(0, 1, 0); if (Math.abs(d.y) > 0.95) u.set(1, 0, 0);
    const x = new THREE.Vector3().crossVectors(u, d).normalize(), y = new THREE.Vector3().crossVectors(d, x);
    const ring = (o, r, i) => { const t = (i / seg) * Math.PI * 2, cx = Math.cos(t), sy = Math.sin(t); return { p: [o[0] + (x.x * cx + y.x * sy) * r, o[1] + (x.y * cx + y.y * sy) * r, o[2] + (x.z * cx + y.z * sy) * r], n: [x.x * cx + y.x * sy, x.y * cx + y.y * sy, x.z * cx + y.z * sy] }; };
    void L;
    for (let i = 0; i < seg; i++) {
      const A = ring(a, ra, i), B = ring(a, ra, i + 1), C = ring(b, rb, i + 1), D = ring(b, rb, i);
      for (const q of [A, B, C, A, C, D]) this._v(q.p, q.n[0], q.n[1], q.n[2]);
      if (caps) { this.tri(a, B.p, A.p); this.tri(b, D.p, C.p); }
    }
    return this;
  }
  get tris() { return this.p.length / 9; }
  build(uv = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    return g;
  }
}
/** a static mesh (matrix frozen) */
export function staticMesh(geo, mat, name) { const m = new THREE.Mesh(geo, mat); m.name = name; m.matrixAutoUpdate = false; m.updateMatrix(); return m; }
