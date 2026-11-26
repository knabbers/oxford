// Purple Turtle — tiny geometry builder: non-indexed triangles with metric UVs (and optional vertex colours), winding fixed
// from the wanted normal so single-sided materials always face the right way. One builder per material -> one draw call.
import * as THREE from 'three';

export class GB {
  constructor(colors = false) { this.p = []; this.n = []; this.uv = []; this.c = colors ? [] : null; this.col = [1, 1, 1]; this.T = null; }
  color(hex) { this.col = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; return this; }
  /** subsequent primitives are rotated by ry about y and moved to (x,y,z) */
  at(x = 0, y = 0, z = 0, ry = 0) { this.T = { x, y, z, c: Math.cos(ry), s: Math.sin(ry) }; return this; }
  reset() { this.T = null; return this; }
  _pt(q) { const T = this.T; if (!T) return q; return [T.x + q[0] * T.c + q[2] * T.s, T.y + q[1], T.z - q[0] * T.s + q[2] * T.c]; }
  _nv(q) { const T = this.T; if (!T) return q; return [q[0] * T.c + q[2] * T.s, q[1], -q[0] * T.s + q[2] * T.c]; }
  _push(a, na, ua) { this.p.push(a[0], a[1], a[2]); this.n.push(na[0], na[1], na[2]); this.uv.push(ua[0], ua[1]); if (this.c) this.c.push(this.col[0], this.col[1], this.col[2]); }
  /** triangle; n = wanted face normal (or [na,nb,nc] per-vertex normals with n3=true) */
  tri(a, b, c, n, ua = [0, 0], ub = [1, 0], uc = [0, 1], n3 = null) {
    a = this._pt(a); b = this._pt(b); c = this._pt(c);
    let na, nb, nc;
    if (n3) { na = this._nv(n3[0]); nb = this._nv(n3[1]); nc = this._nv(n3[2]); n = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]]; }
    else { n = this._nv(n); na = nb = nc = n; }
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { this._push(a, na, ua); this._push(c, nc, uc); this._push(b, nb, ub); }
    else { this._push(a, na, ua); this._push(b, nb, ub); this._push(c, nc, uc); }
    return this;
  }
  /** quad a-b-c-d (in order around), uvs [[u,v] x4] */
  quad(a, b, c, d, n, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]], n4 = null) {
    this.tri(a, b, c, n, uvs[0], uvs[1], uvs[2], n4 && [n4[0], n4[1], n4[2]]);
    this.tri(a, c, d, n, uvs[0], uvs[2], uvs[3], n4 && [n4[0], n4[2], n4[3]]);
    return this;
  }
  /** vertical wall quad from (x0,z0) to (x1,z1), y0..y1, facing n; metric uv (u along, v up) or atlas rect */
  wall(x0, z0, x1, z1, y0, y1, n, rect = null) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const uv = rect ? [[rect[0], rect[3]], [rect[2], rect[3]], [rect[2], rect[1]], [rect[0], rect[1]]] : [[0, y0], [L, y0], [L, y1], [0, y1]];
    return this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], n, uv);
  }
  /** horizontal rectangle at y facing up (dir=1) or down (-1) */
  flat(x0, z0, x1, z1, y, dir = 1, rect = null) {
    const uv = rect ? [[rect[0], rect[3]], [rect[2], rect[3]], [rect[2], rect[1]], [rect[0], rect[1]]] : [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    return this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, dir, 0], uv);
  }
  /** box centred at (cx, y0..y0+h, cz), w along x, d along z (in the current transform). skip: {top,bottom,n,s,e,w} */
  box(cx, y0, cz, w, h, d, skip = {}) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
    if (!skip.top) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], [[0, 0], [w, 0], [w, d], [0, d]]);
    if (!skip.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [[0, 0], [w, 0], [w, d], [0, d]]);
    if (!skip.s) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[0, y0], [w, y0], [w, y1], [0, y1]]);
    if (!skip.n) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], [[w, y0], [0, y0], [0, y1], [w, y1]]);
    if (!skip.e) this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], [[0, y0], [d, y0], [d, y1], [0, y1]]);
    if (!skip.w) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[d, y0], [0, y0], [0, y1], [d, y1]]);
    return this;
  }
  /** vertical cylinder (or cone with r2) centred at (cx,cz), y0..y0+h */
  cyl(cx, y0, cz, r, h, seg = 8, r2 = r, caps = true) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const n0 = [s0, 0, c0], n1 = [s1, 0, c1];
      this.quad([cx + s0 * r, y0, cz + c0 * r], [cx + s1 * r, y0, cz + c1 * r], [cx + s1 * r2, y0 + h, cz + c1 * r2], [cx + s0 * r2, y0 + h, cz + c0 * r2], [(s0 + s1) / 2, 0, (c0 + c1) / 2],
        [[(i / seg) * 6.283 * r, 0], [((i + 1) / seg) * 6.283 * r, 0], [((i + 1) / seg) * 6.283 * r, h], [(i / seg) * 6.283 * r, h]], [n0, n1, n1, n0]);
      if (caps) {
        if (r2 > 0) this.tri([cx, y0 + h, cz], [cx + s0 * r2, y0 + h, cz + c0 * r2], [cx + s1 * r2, y0 + h, cz + c1 * r2], [0, 1, 0], [0, 0], [s0 * r2, c0 * r2], [s1 * r2, c1 * r2]);
        this.tri([cx, y0, cz], [cx + s0 * r, y0, cz + c0 * r], [cx + s1 * r, y0, cz + c1 * r], [0, -1, 0], [0, 0], [s0 * r, c0 * r], [s1 * r, c1 * r]);
      }
    }
    return this;
  }
  /** a thin tube between two points (ropes, rails), square section */
  rod(a, b, r = 0.02) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
    const t = [dx / L, dy / L, dz / L];
    let u = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let s = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]]; const sl = Math.hypot(...s); s = s.map((v) => v / sl);
    u = [s[1] * t[2] - s[2] * t[1], s[2] * t[0] - s[0] * t[2], s[0] * t[1] - s[1] * t[0]];
    const off = (k) => { const ang = (k / 4) * Math.PI * 2 + Math.PI / 4, c = Math.cos(ang) * r, sn = Math.sin(ang) * r; return [s[0] * c + u[0] * sn, s[1] * c + u[1] * sn, s[2] * c + u[2] * sn]; };
    for (let k = 0; k < 4; k++) {
      const o0 = off(k), o1 = off(k + 1), n = [(o0[0] + o1[0]) / 2, (o0[1] + o1[1]) / 2, (o0[2] + o1[2]) / 2];
      this.quad([a[0] + o0[0], a[1] + o0[1], a[2] + o0[2]], [b[0] + o0[0], b[1] + o0[1], b[2] + o0[2]], [b[0] + o1[0], b[1] + o1[1], b[2] + o1[2]], [a[0] + o1[0], a[1] + o1[1], a[2] + o1[2]], n,
        [[0, 0], [L, 0], [L, r * 2], [0, r * 2]]);
    }
    return this;
  }
  get count() { return this.p.length / 3; }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat, parent) {
    if (!this.count) return null;
    const m = new THREE.Mesh(this.geo(), mat); m.matrixAutoUpdate = false; m.updateMatrix();
    if (parent) parent.add(m);
    return m;
  }
}
