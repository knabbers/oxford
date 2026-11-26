// Small geometry kit shared by places/randolph.js and places/pizza_artisan.js.
// Geo: collects flat-shaded triangles per material key (with optional vertex colours) under a transform stack, then
// builds ONE mesh per key, so a whole building costs one draw call per material.
import * as THREE from 'three';
import { repaintable } from '../world/_tex_keep.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3();

export class Geo {
  constructor() { this.parts = new Map(); this.m = new THREE.Matrix4(); this.nm = new THREE.Matrix3(); this.stack = []; this.col = [1, 1, 1]; }
  push(mat) { this.stack.push(this.m.clone()); this.m.multiply(mat); return this; }
  /** push a translation + rotation about Y */
  at(x, y, z, ry = 0) { return this.push(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z)); }
  pop() { this.m = this.stack.pop(); return this; }
  color(hex) { const c = new THREE.Color(hex); this.col = [c.r, c.g, c.b]; return this; }
  _p(key) { let p = this.parts.get(key); if (!p) this.parts.set(key, (p = { pos: [], nor: [], uv: [], col: [] })); return p; }
  /** one triangle in the current frame (points [x,y,z], uvs [u,v]) */
  tri(key, p0, p1, p2, t0 = [0, 0], t1 = [0, 0], t2 = [0, 0]) {
    const P = this._p(key), m = this.m;
    _a.set(p0[0], p0[1], p0[2]).applyMatrix4(m); _b.set(p1[0], p1[1], p1[2]).applyMatrix4(m); _c.set(p2[0], p2[1], p2[2]).applyMatrix4(m);
    _n.subVectors(_b, _a).cross(_t.subVectors(_c, _a)).normalize();
    P.pos.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
    P.nor.push(_n.x, _n.y, _n.z, _n.x, _n.y, _n.z, _n.x, _n.y, _n.z);
    P.uv.push(t0[0], t0[1], t1[0], t1[1], t2[0], t2[1]);
    const c = this.col; P.col.push(c[0], c[1], c[2], c[0], c[1], c[2], c[0], c[1], c[2]);
  }
  /** planar convex polygon; `hint` = rough outward normal (winding fixed to match). UV metric (u along first edge) unless given. */
  poly(key, pts, hint = null, uvs = null, uvScale = 1) {
    const a = pts[0];
    let nx = 0, ny = 0, nz = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const ux = p[0] - a[0], uy = p[1] - a[1], uz = p[2] - a[2], vx = q[0] - a[0], vy = q[1] - a[1], vz = q[2] - a[2];
      nx += uy * vz - uz * vy; ny += uz * vx - ux * vz; nz += ux * vy - uy * vx;
    }
    let P = pts, U = uvs;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { P = pts.slice().reverse(); U = uvs && uvs.slice().reverse(); nx = -nx; ny = -ny; nz = -nz; }
    if (!U) {
      const p0 = P[0], p1 = P[1];
      let tx = p1[0] - p0[0], ty = p1[1] - p0[1], tz = p1[2] - p0[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const nl = Math.hypot(nx, ny, nz) || 1; const Nx = nx / nl, Ny = ny / nl, Nz = nz / nl;
      const sx = Ny * tz - Nz * ty, sy = Nz * tx - Nx * tz, sz = Nx * ty - Ny * tx;
      U = P.map((p) => { const dx = p[0] - p0[0], dy = p[1] - p0[1], dz = p[2] - p0[2]; return [(dx * tx + dy * ty + dz * tz) / uvScale, (dx * sx + dy * sy + dz * sz) / uvScale]; });
    }
    for (let i = 1; i < P.length - 1; i++) this.tri(key, P[0], P[i], P[i + 1], U[0], U[i], U[i + 1]);
  }
  /** quad with explicit uv rect [u0,v0,u1,v1]: a=bottom-left, b=bottom-right, c=top-right, d=top-left (seen from the front) */
  quadUV(key, a, b, c, d, r) {
    this.tri(key, a, b, c, [r[0], r[1]], [r[2], r[1]], [r[2], r[3]]);
    this.tri(key, a, c, d, [r[0], r[1]], [r[2], r[3]], [r[0], r[3]]);
  }
  /** axis-aligned box from (x0,y0,z0) to (x1,y1,z1) in the current frame */
  box(key, x0, y0, z0, x1, y1, z1, o = {}) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
    const s = o.uvScale || 1;
    this.poly(key, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], null, s);
    this.poly(key, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], null, s);
    this.poly(key, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], null, s);
    this.poly(key, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], null, s);
    if (o.top !== false) this.poly(key, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], null, s);
    if (o.bottom) this.poly(key, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], null, s);
  }
  /** centred box (cx,cy,cz) size (w,h,d) rotated ry about Y */
  boxC(key, cx, cy, cz, w, h, d, ry = 0, o = {}) { this.at(cx, cy, cz, ry); this.box(key, -w / 2, -h / 2, -d / 2, w / 2, h / 2, d / 2, o); this.pop(); }
  /** square-section beam between two 3D points */
  beam(key, a, b, w, h = w) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    if (L < 1e-5) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dx / L, dy / L, dz / L));
    this.push(new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, 1, 1)));
    this.box(key, -w / 2, -h / 2, -L / 2, w / 2, h / 2, L / 2, { bottom: true }); this.pop();
  }
  /** vertical cylinder / cone frustum */
  cyl(key, cx, y0, cz, r, h, seg = 10, r1 = r, caps = true) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a, rr, y) => [cx + Math.sin(a) * rr, y, cz + Math.cos(a) * rr];
      const am = (a0 + a1) / 2;
      this.poly(key, [p(a0, r, y0), p(a1, r, y0), p(a1, r1, y0 + h), p(a0, r1, y0 + h)], [Math.sin(am), 0, Math.cos(am)],
        [[a0 * r, y0], [a1 * r, y0], [a1 * r, y0 + h], [a0 * r, y0 + h]]);
      if (caps && r1 > 0) this.tri(key, [cx, y0 + h, cz], p(a0, r1, y0 + h), p(a1, r1, y0 + h));
      if (caps === 'both') this.tri(key, [cx, y0, cz], p(a1, r, y0), p(a0, r, y0));
    }
  }
  /** cylinder lying along local X (wheels): centre, radius, width */
  wheel(key, cx, cy, cz, r, w, seg = 12) {
    this.push(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(cx + w / 2, cy, cz)); this.cyl(key, 0, 0, 0, r, w, seg, r, 'both'); this.pop();
  }
  /** frustum roof: base rect (x0,z0,x1,z1) at y0 to top rect inset by (ix, iz) at y1; flat top cap if any area left */
  hipRoof(key, x0, z0, x1, z1, y0, y1, ix, iz) {
    const a = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
    const tx0 = x0 + ix, tx1 = x1 - ix, tz0 = z0 + iz, tz1 = z1 - iz;
    const b = [[tx0, y1, tz0], [tx1, y1, tz0], [tx1, y1, tz1], [tx0, y1, tz1]];
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, mx = (a[i][0] + a[j][0]) / 2 - cx, mz = (a[i][2] + a[j][2]) / 2 - cz;
      const same = Math.hypot(b[i][0] - b[j][0], b[i][2] - b[j][2]) < 1e-4;
      this.poly(key, same ? [a[i], a[j], b[i]] : [a[i], a[j], b[j], b[i]], [mx, 1, mz]);
    }
    if (tx1 - tx0 > 1e-3 && tz1 - tz0 > 1e-3) this.poly(key, b, [0, 1, 0]);
  }
  /** gabled prism along local Z: width w (x), from z0..z1, eaves y0, ridge y1 (+ end gables) */
  gable(key, cx, z0, z1, w, y0, y1, walls = null) {
    const h = w / 2;
    this.poly(key, [[cx - h, y0, z0], [cx - h, y0, z1], [cx, y1, z1], [cx, y1, z0]], [-1, 1, 0]);
    this.poly(key, [[cx + h, y0, z1], [cx + h, y0, z0], [cx, y1, z0], [cx, y1, z1]], [1, 1, 0]);
    const wk = walls || key;
    this.poly(wk, [[cx - h, y0, z1], [cx + h, y0, z1], [cx, y1, z1]], [0, 0, 1]);
    this.poly(wk, [[cx + h, y0, z0], [cx - h, y0, z0], [cx, y1, z0]], [0, 0, -1]);
  }
  tris() { let n = 0; for (const p of this.parts.values()) n += p.pos.length / 9; return n; }
  /** -> {key: mesh}. mats: key -> Material (missing keys are skipped). opts: {cast:Set|bool, parent} */
  build(mats, parent, opts = {}) {
    const out = {};
    for (const [key, P] of this.parts) {
      if (!P.pos.length) continue;
      const mat = mats[key]; if (!mat) { console.warn('[randolph kit] no material', key); continue; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(P.uv, 2));
      if (mat.vertexColors) g.setAttribute('color', new THREE.Float32BufferAttribute(P.col, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = (opts.name || 'geo') + ':' + key;
      mesh.castShadow = opts.cast === undefined ? true : opts.cast instanceof Set ? opts.cast.has(key) : !!opts.cast;
      mesh.receiveShadow = opts.receive !== false;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      if (parent) parent.add(mesh);
      out[key] = mesh;
    }
    this.parts.clear();
    return out;
  }
}

/** canvas helper: returns {canvas, g} */
export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { canvas: c, g: c.getContext('2d') };
}
/** c: a canvas — or a function that returns a freshly painted one: then the texture's canvas is let go once it is on the
 *  card and the function is called again if the card ever needs the picture again (memory pass: world/_tex_keep.js) */
export function canvasTexture(c, { repeat = false, srgb = true } = {}) {
  const paint = typeof c === 'function' ? c : null; if (paint) c = paint();
  const t = new THREE.CanvasTexture(c);
  if (paint) repaintable(t, paint, 'kit:' + (paint.name || c.width + 'x' + c.height));
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
/** deterministic rng */
export function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** shared vertex-colour material (paint, iron, wheels, small coloured things) */
let _paint = null;
export function paintMaterial() {
  if (!_paint) _paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
  return _paint;
}
