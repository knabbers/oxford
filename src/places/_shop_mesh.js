// Supermarkets: a tiny geometry accumulator (boxes, cylinders, quads with a Y rotation, vertex colours and UV rects),
// so each store becomes a handful of merged meshes.
import * as THREE from 'three';

const tmpC = new THREE.Color();
export class Mesher {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.idx = []; this.vc = 0; }
  get empty() { return this.vc === 0; }
  _v(x, y, z, nx, ny, nz, u, v, col) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(col[0], col[1], col[2]); return this.vc++; }
  static col(c) { if (Array.isArray(c)) return c; tmpC.set(c ?? 0xffffff); return [tmpC.r, tmpC.g, tmpC.b]; }
  /**
   * Quad from corner (x,y,z) spanning vectors a (u direction) and b (v direction); normal = a × b normalised.
   * uv: [u0,v0,u1,v1] rect.  Optionally metric: uvm = scale -> u in metres along a, v along b.
   */
  quad(x, y, z, ax, ay, az, bx, by, bz, { color = 0xffffff, uv = [0, 0, 1, 1], uvm = 0, uo = 0, vo = 0, both = false } = {}) {
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const col = Mesher.col(color);
    let U0 = uv[0], V0 = uv[1], U1 = uv[2], V1 = uv[3];
    if (uvm) { U0 = uo; V0 = vo; U1 = uo + Math.hypot(ax, ay, az) / uvm; V1 = vo + Math.hypot(bx, by, bz) / uvm; }
    const i = this._v(x, y, z, nx, ny, nz, U0, V0, col);
    this._v(x + ax, y + ay, z + az, nx, ny, nz, U1, V0, col);
    this._v(x + ax + bx, y + ay + by, z + az + bz, nx, ny, nz, U1, V1, col);
    this._v(x + bx, y + by, z + bz, nx, ny, nz, U0, V1, col);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    if (both) this.idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
    return this;
  }
  /**
   * Box centred at (cx, y0..y0+h, cz), size w (local x) × d (local z), rotated by heading rot (local +z -> (sin rot, cos rot)).
   * opts: color (all faces) | colors {front, back, side, top, bottom}; uv rect for all faces, or uvFront for +z face only.
   * skip: set of face names not to emit ('bottom' by default).
   */
  box(cx, y0, cz, w, h, d, rot = 0, opts = {}) {
    const s = Math.sin(rot), c = Math.cos(rot), hw = w / 2, hd = d / 2;
    const R = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    const cols = opts.colors || {}, base = opts.color ?? 0xcccccc, uvAll = opts.uv || [0, 0, 1, 1], uvF = opts.uvFront || uvAll, uvT = opts.uvTop || uvAll;
    const skip = opts.skip || BOTTOM;
    const face = (name, lx, ly, lz, ax, ay, az, bx, by, bz, uv) => {
      if (skip.has(name)) return;
      const [x, z] = R(lx, lz);
      this.quad(x, y0 + ly, z, ax * c + az * s, ay, -ax * s + az * c, bx * c + bz * s, by, -bx * s + bz * c, { color: cols[name] ?? cols.side ?? base, uv });
    };
    face('front', -hw, 0, hd, w, 0, 0, 0, h, 0, uvF);
    face('back', hw, 0, -hd, -w, 0, 0, 0, h, 0, uvAll);
    face('side', hw, 0, hd, 0, 0, -d, 0, h, 0, uvAll);        // +x
    face('side2', -hw, 0, -hd, 0, 0, d, 0, h, 0, uvAll);      // -x
    face('top', -hw, h, hd, w, 0, 0, 0, 0, -d, uvT);
    face('bottom', -hw, 0, -hd, w, 0, 0, 0, 0, d, uvAll);
    return this;
  }
  /** Vertical cylinder (n sides) with caps; uv rect wrapped around the side. */
  cyl(cx, y0, cz, r, h, n = 6, opts = {}) {
    const col = Mesher.col(opts.color ?? 0xcccccc), uv = opts.uv || [0, 0, 1, 1], capCol = Mesher.col(opts.capColor ?? opts.color ?? 0xcccccc), r2 = opts.rTop ?? r;
    const base = this.vc;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 + (opts.rot || 0), sx = Math.sin(a), cz2 = Math.cos(a), u = uv[0] + (uv[2] - uv[0]) * (i / n);
      this._v(cx + sx * r, y0, cz + cz2 * r, sx, 0, cz2, u, uv[1], col);
      this._v(cx + sx * r2, y0 + h, cz + cz2 * r2, sx, 0, cz2, u, uv[3], col);
    }
    for (let i = 0; i < n; i++) { const a = base + i * 2; this.idx.push(a, a + 2, a + 3, a, a + 3, a + 1); }
    if (opts.cap !== false) {
      const ctr = this._v(cx, y0 + h, cz, 0, 1, 0, uv[0], uv[3], capCol);
      for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2 + (opts.rot || 0); this._v(cx + Math.sin(a) * r2, y0 + h, cz + Math.cos(a) * r2, 0, 1, 0, uv[0], uv[3], capCol); }
      for (let i = 0; i < n; i++) this.idx.push(ctr, ctr + 1 + i, ctr + 2 + i);
    }
    return this;
  }
  geometry() {
    if (this._geo) return this._geo;      // (made once: the plain arrays it was made from are let go below)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    // the typed arrays are the geometry now: the plain JS arrays they were copied from (some 35 MB over the four shops)
    // are emptied. vc (the vertex count) and the triangle count are kept: callers read them afterwards.
    this._tris = this.idx.length / 3; this._geo = g;
    this.p = []; this.n = []; this.u = []; this.c = []; this.idx = [];
    return g;
  }
  mesh(mat) { const m = new THREE.Mesh(this.geometry(), mat); m.matrixAutoUpdate = false; m.updateMatrix(); return m; }
  get tris() { return this._tris ?? this.idx.length / 3; }
}
const BOTTOM = new Set(['bottom']);
