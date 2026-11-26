// Geometry + texture kit for the Worcester College modules (owned by places/worcester.js).
// Batch: collects raw triangles per material key under a current transform, then merges into one mesh per key.
import * as THREE from 'three';
import { repaintableAll, remakeCached } from '../world/_tex_keep.js';
// (memory pass: the signs sheet is painted again by signAtlas itself, its cache set aside for the call, if the card ever
//  needs it again — so its canvas goes once it is on the card. Wrapped here, at the top, where nobody else edits.)
signAtlas = ((make) => function () { const had = !!cache.atlas, r = make(); if (!had && r && r.texture) repaintableAll(r.texture, () => remakeCached(cache, 'atlas', make)().texture, 'worcester signs'); return r; })(signAtlas);

const _v = new THREE.Vector3(), _n = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class Batch {
  constructor() { this.parts = new Map(); this.m = new THREE.Matrix4(); this.stack = []; }
  push(mat) { this.stack.push(this.m.clone()); this.m.multiply(mat); return this; }
  pop() { this.m = this.stack.pop(); return this; }
  _p(key) { let p = this.parts.get(key); if (!p) this.parts.set(key, (p = { pos: [], nor: [], uv: [] })); return p; }
  /** triangle in current frame: points [x,y,z], uvs [u,v] */
  tri(key, p0, p1, p2, t0, t1, t2) {
    const P = this._p(key), m = this.m;
    _a.set(p0[0], p0[1], p0[2]).applyMatrix4(m); _b.set(p1[0], p1[1], p1[2]).applyMatrix4(m); _c.set(p2[0], p2[1], p2[2]).applyMatrix4(m);
    _n.subVectors(_b, _a).cross(_v.subVectors(_c, _a)).normalize();
    for (const q of [_a, _b, _c]) { P.pos.push(q.x, q.y, q.z); P.nor.push(_n.x, _n.y, _n.z); }
    P.uv.push(t0[0], t0[1], t1[0], t1[1], t2[0], t2[1]);
  }
  /** planar convex polygon (3D pts in current frame). hint: rough outward normal [x,y,z] (orientation fixed to match).
   *  UV: u along first edge, v perpendicular (metres), unless uvs given. */
  poly(key, pts, hint, uvs, uvScale = 1) {
    const a = pts[0], b = pts[1];
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
      // s = n x t  (so (t, s) is right-handed seen from outside)
      const sx = Ny * tz - Nz * ty, sy = Nz * tx - Nx * tz, sz = Nx * ty - Ny * tx;
      U = P.map((p) => { const dx = p[0] - p0[0], dy = p[1] - p0[1], dz = p[2] - p0[2]; return [(dx * tx + dy * ty + dz * tz) / uvScale, (dx * sx + dy * sy + dz * sz) / uvScale]; });
    }
    for (let i = 1; i < P.length - 1; i++) this.tri(key, P[0], P[i], P[i + 1], U[0], U[i], U[i + 1]);
  }
  /** axis box centred (cx,cy,cz) size (w,h,d) rotated ry about Y. opts.bottom, opts.top=false to skip */
  box(key, cx, cy, cz, w, h, d, ry = 0, opts = {}) {
    const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2, hh = h / 2, hd = d / 2;
    const T = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const v = [T(-hw, -hh, -hd), T(hw, -hh, -hd), T(hw, -hh, hd), T(-hw, -hh, hd), T(-hw, hh, -hd), T(hw, hh, -hd), T(hw, hh, hd), T(-hw, hh, hd)];
    const ax = [c, 0, -s], az = [s, 0, c];
    const sh = opts.shift ? opts.shift : null;
    const f = (i, n) => this.poly(key, i.map((k) => v[k]), n, null, opts.uvScale || 1);
    f([3, 2, 6, 7], az); f([1, 0, 4, 5], [-az[0], 0, -az[2]]);
    f([2, 1, 5, 6], ax); f([0, 3, 7, 4], [-ax[0], 0, -ax[2]]);
    if (opts.top !== false) f([7, 6, 5, 4], [0, 1, 0]);
    if (opts.bottom) f([0, 1, 2, 3], [0, -1, 0]);
    return sh;
  }
  /** box between two y levels from x0..x1, z0..z1 (axis aligned) */
  boxXZ(key, x0, x1, y0, y1, z0, z1, opts) { this.box(key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 0, opts); }
  /** a beam from point a to b (3D) of square section t (or [w,h]) */
  beam(key, a, b, w, h = w) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dx / L, dy / L, dz / L));
    m.compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, 1, 1));
    this.push(m); this.box(key, 0, 0, 0, w, h, L, 0, { bottom: true }); this.pop();
  }
  /** cylinder along Y */
  cyl(key, cx, y0, cz, r, h, seg = 10, top = true, r1 = r) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a, rr, y) => [cx + Math.sin(a) * rr, y, cz + Math.cos(a) * rr];
      const u0 = (i / seg) * Math.PI * 2 * r, u1 = ((i + 1) / seg) * Math.PI * 2 * r;
      const n = [Math.sin((a0 + a1) / 2), 0, Math.cos((a0 + a1) / 2)];
      this.poly(key, [p(a0, r1, y0), p(a1, r1, y0), p(a1, r, y0 + h), p(a0, r, y0 + h)], n, [[u0, 0], [u1, 0], [u1, h], [u0, h]]);
      if (top) this.tri(key, [cx, y0 + h, cz], p(a0, r, y0 + h), p(a1, r, y0 + h), [cx, cz], [0, 0], [0.2, 0]);
    }
  }
  /** flat polygon (any, may be concave, with holes) at height y in current frame, facing up (or down). pts [[x,z]] */
  flat(key, pts, y, holes = [], down = false) {
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
    const g = new THREE.ShapeGeometry(shape);
    const pos = g.attributes.position, idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const P = [0, 1, 2].map((k) => [pos.getX(idx[i + k]), y, pos.getY(idx[i + k])]);
      const T = P.map((p) => [p[0], p[2]]);
      // ensure up-facing
      const nx = (P[1][1] - P[0][1]) * (P[2][2] - P[0][2]) - (P[1][2] - P[0][2]) * (P[2][1] - P[0][1]);
      const ny = (P[1][2] - P[0][2]) * (P[2][0] - P[0][0]) - (P[1][0] - P[0][0]) * (P[2][2] - P[0][2]);
      void nx;
      if ((ny > 0) !== !down) this.tri(key, P[0], P[2], P[1], T[0], T[2], T[1]); else this.tri(key, P[0], P[1], P[2], T[0], T[1], T[2]);
    }
    g.dispose();
  }
  /** wall face in the XY plane (facing +Z) at z = zOff: outline [[x,y]] with holes, UV = metres */
  face(key, outline, holes = [], zOff = 0, flip = false) {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ShapeGeometry(shape, 6);
    const pos = g.attributes.position, idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const P = [0, 1, 2].map((k) => [pos.getX(idx[i + k]), pos.getY(idx[i + k]), zOff]);
      const T = P.map((p) => [p[0], p[1]]);
      const nz = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]);
      if ((nz > 0) === !flip) this.tri(key, P[0], P[1], P[2], T[0], T[1], T[2]); else this.tri(key, P[0], P[2], P[1], T[0], T[2], T[1]);
    }
    g.dispose();
  }
  /** reveals of an opening outline [[x,y]] (closed) from z=z0 back to z=z1 (z1<z0), faces pointing into the opening */
  reveal(key, pts, z0, z1, skipBottom = false) {
    // centroid for inward direction
    let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= pts.length; cy /= pts.length;
    let u = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-5) continue;
      if (skipBottom && Math.abs(a[1] - b[1]) < 1e-4 && a[1] <= cy) { u += L; continue; }
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      this.poly(key, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], [cx - mx, cy - my, 0], [[u, 0], [u + L, 0], [u + L, z0 - z1], [u, z0 - z1]]);
      u += L;
    }
  }
  /** quad in XY plane facing +z, with explicit uv rect [u0,v0,u1,v1] (for sign atlas) */
  sign(key, x0, y0, x1, y1, z, uv) {
    this.tri(key, [x0, y0, z], [x1, y0, z], [x1, y1, z], [uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]]);
    this.tri(key, [x0, y0, z], [x1, y1, z], [x0, y1, z], [uv[0], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]);
  }
  /**
   * One atlas "unit" (a whole painted window / door cell) on a planar outline [[x,y]] in the XY plane at z: the outline's
   * bounding box maps to one cell. bay = [i, j]: integer UV offset, i.e. which lit-window hash the shader uses for it.
   */
  unit(key, pts, z = 0, bay = [0, 0], flip = false) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const E = 0.004, uv = (p) => [bay[0] + E + ((p[0] - x0) / (x1 - x0)) * (1 - 2 * E), bay[1] + E + ((p[1] - y0) / (y1 - y0)) * (1 - 2 * E)];
    if (pts.length === 4) { this.poly(key, pts.map((p) => [p[0], p[1], z]), [0, 0, flip ? -1 : 1], pts.map(uv)); return; }
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ShapeGeometry(shape), pos = g.attributes.position, idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const P = [0, 1, 2].map((k) => [pos.getX(idx[i + k]), pos.getY(idx[i + k]), z]), T = P.map(uv);
      const nz = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]);
      if ((nz > 0) === !flip) this.tri(key, P[0], P[1], P[2], T[0], T[1], T[2]); else this.tri(key, P[0], P[2], P[1], T[0], T[2], T[1]);
    }
    g.dispose();
  }
  /** round-headed unit facing +z: the part below the springing maps to v 0..0.75 of the cell, the semicircle to 0.75..1 */
  archUnit(key, xc, w, y0, ys, z = 0, bay = [0, 0], seg = 8) {
    const r = w / 2, x0 = xc - r, x1 = xc + r, E = 0.004, u0 = bay[0] + E, v0 = bay[1] + E, S = 1 - 2 * E;
    this.tri(key, [x0, y0, z], [x1, y0, z], [x1, ys, z], [u0, v0], [u0 + S, v0], [u0 + S, v0 + 0.75 * S]);
    this.tri(key, [x0, y0, z], [x1, ys, z], [x0, ys, z], [u0, v0], [u0 + S, v0 + 0.75 * S], [u0, v0 + 0.75 * S]);
    const p = (a) => [xc + Math.cos(a) * r, ys + Math.sin(a) * r, z], t = (a) => [u0 + (0.5 + 0.5 * Math.cos(a)) * S, v0 + (0.75 + 0.25 * Math.sin(a)) * S];
    for (let i = 0; i < seg; i++) { const a0 = (i / seg) * Math.PI, a1 = ((i + 1) / seg) * Math.PI; this.tri(key, [xc, ys, z], p(a0), p(a1), [u0 + 0.5 * S, v0 + 0.75 * S], t(a0), t(a1)); }
  }
  /** quad with explicit corner points [x,y,z] (a, b along the bottom, c, d back along the top) and a UV rect */
  card(key, a, b, c, d, uv) {
    this.tri(key, a, b, c, [uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]]);
    this.tri(key, a, c, d, [uv[0], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]);
  }
  tris() { let n = 0; for (const p of this.parts.values()) n += p.pos.length / 9; return n; }
  /** -> array of meshes (added to parent). mats: key -> Material. opts: {shadow:{key:bool}, renderOrder} */
  build(mats, parent, opts = {}) {
    const out = [];
    const pack = opts.pack;
    if (pack) {
      // graphics pass 2: keys listed in the pack go into a few shared-material meshes instead of one mesh per key
      const groups = [
        { name: 'atlas', mat: pack.atlas, cells: pack.cells, cast: !opts.noShadow },
        { name: 'ground', mat: pack.ground, cells: pack.groundCells, cast: false },
        { name: 'glow', mat: pack.glow, cells: pack.glowCells, cast: !opts.noShadow },
      ];
      for (const G of groups) {
        if (!G.mat || !G.cells) continue;
        let n = 0;
        for (const [key, P] of this.parts) if (G.cells.has(key)) n += P.pos.length / 3;
        if (!n) continue;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
        const cell = G.name === 'glow' ? null : new Float32Array(n * 4), tint = G.name === 'glow' ? null : new Float32Array(n * 3);
        const col = G.name === 'glow' ? new Float32Array(n * 3) : null;
        const top = G.name === 'atlas' ? new Float32Array(n).fill(1e4) : null, lay = G.name === 'ground' ? new Float32Array(n) : null;
        let o = 0;
        for (const [key, P] of this.parts) {
          const c = G.cells.get(key); if (!c) continue;
          const k = P.pos.length / 3;
          pos.set(P.pos, o * 3); nor.set(P.nor, o * 3);
          for (let i = 0; i < k; i++) {
            const u = P.uv[i * 2], v = P.uv[i * 2 + 1];
            uv[(o + i) * 2] = u * c.rx + c.ox; uv[(o + i) * 2 + 1] = v * c.ry + c.oy;
            if (cell) { cell[(o + i) * 4] = c.cell; cell[(o + i) * 4 + 1] = c.alt ?? c.cell; cell[(o + i) * 4 + 2] = c.p || 0; cell[(o + i) * 4 + 3] = c.seed || 0; }
            if (tint) { tint[(o + i) * 3] = c.tint[0]; tint[(o + i) * 3 + 1] = c.tint[1]; tint[(o + i) * 3 + 2] = c.tint[2]; }
            if (col) { col[(o + i) * 3] = c.tint[0]; col[(o + i) * 3 + 1] = c.tint[1]; col[(o + i) * 3 + 2] = c.tint[2]; }
            if (lay) lay[o + i] = c.layer || 0;
          }
          o += k;
          this.parts.delete(key);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        if (cell) g.setAttribute('aCell', new THREE.BufferAttribute(cell, 4));
        if (tint) g.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
        if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        if (top) g.setAttribute('aTop', new THREE.BufferAttribute(top, 1));
        // aBase: the height of the ground each wall stands on (opts.base(x, z) in the batch's own frame -> y, or null
        // for the city's y = 0), sampled 0.3 m in front of the face. The atlas shader anchors its contact darkening,
        // plinth soot, lichen and creeper there instead of at world y = 0 (world/materials.js `base`): without it every
        // wall of a sunk court stands wholly in the darkest band. Geometry without the attribute reads 0, as before.
        if (G.name === 'atlas' && opts.base) {
          const base = new Float32Array(n);
          for (let i = 0; i < n; i++) { const nx = nor[i * 3], ny = nor[i * 3 + 1], nz = nor[i * 3 + 2]; if (Math.abs(ny) > 0.3) continue; const y = opts.base(pos[i * 3] + nx * 0.3, pos[i * 3 + 2] + nz * 0.3); if (Number.isFinite(y)) base[i] = y; }
          g.setAttribute('aBase', new THREE.BufferAttribute(base, 1));
        }
        if (lay) g.setAttribute('aLayer', new THREE.BufferAttribute(lay, 1));
        // the big atlas mesh is split into a few spatial chunks (opts.chunk(x, z) -> index) so frustum culling (and the
        // shadow pass's frustum) still drops the parts of the college that are out of view
        const parts = G.name === 'atlas' && opts.chunk ? splitTris(g, opts.chunk) : [g];
        for (const gg of parts) {
          gg.computeBoundingSphere(); gg.computeBoundingBox();
          const mesh = new THREE.Mesh(gg, G.mat);
          mesh.name = 'worcester:' + G.name;
          mesh.castShadow = G.cast; mesh.receiveShadow = true;
          if (opts.renderOrder !== undefined) mesh.renderOrder = opts.renderOrder;
          mesh.matrixAutoUpdate = false; mesh.updateMatrix();
          parent.add(mesh); out.push(mesh);
        }
      }
    }
    for (const [key, P] of this.parts) {
      if (!P.pos.length) continue;
      const mat = mats[key]; if (!mat) { console.warn('[worcester] no material', key); continue; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(P.uv, 2));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = 'worcester:' + key;
      const noShadow = opts.noCast && opts.noCast.has(key);
      mesh.castShadow = !noShadow && !opts.noShadow; mesh.receiveShadow = true;
      if (opts.renderOrder !== undefined) mesh.renderOrder = opts.renderOrder;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh); out.push(mesh);
    }
    this.parts.clear();
    return out;
  }
}

/** Split a non-indexed geometry by triangle centroid: fn(x, z) -> chunk index. Returns the non-empty pieces. */
function splitTris(g, fn) {
  const P = g.attributes.position.array, nT = P.length / 9, idx = new Int32Array(nT), counts = new Map();
  for (let t = 0; t < nT; t++) {
    const o = t * 9, k = fn((P[o] + P[o + 3] + P[o + 6]) / 3, (P[o + 2] + P[o + 5] + P[o + 8]) / 3) | 0;
    idx[t] = k; counts.set(k, (counts.get(k) || 0) + 1);
  }
  if (counts.size < 2) return [g];
  const out = [];
  for (const [k, n] of counts) {
    const ng = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(g.attributes)) {
      const sz = a.itemSize, src = a.array, dst = new Float32Array(n * 3 * sz);
      let w = 0;
      for (let t = 0; t < nT; t++) if (idx[t] === k) { dst.set(src.subarray(t * 3 * sz, (t + 1) * 3 * sz), w); w += 3 * sz; }
      ng.setAttribute(name, new THREE.BufferAttribute(dst, sz));
    }
    out.push(ng);
  }
  g.dispose();
  return out;
}

/** Matrix for a wall frame: origin (x,y,z), wall runs along (ax,az) (s axis), outward normal = (-az, 0, ax). */
export function frame(x, y, z, ax, az) {
  const L = Math.hypot(ax, az); ax /= L; az /= L;
  return new THREE.Matrix4().makeBasis(new THREE.Vector3(ax, 0, az), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-az, 0, ax)).setPosition(x, y, z);
}

// ------------------------------------------------------------------------------------------------ outlines
/** rectangle outline CCW */
export const rectPts = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** round-headed opening: width w centred at x, bottom y0, springing at ys (semicircle on top), CCW */
export function archPts(x, w, y0, ys, seg = 10) {
  const r = w / 2, p = [[x - r, y0], [x + r, y0], [x + r, ys]];
  for (let i = 1; i < seg; i++) { const a = (i / seg) * Math.PI; p.push([x + Math.cos(a) * r, ys + Math.sin(a) * r]); }
  p.push([x - r, ys]);
  return p;
}
/** four-centred (Tudor) arch opening: width w, bottom y0, springing ys, rise h above springing, CCW */
export function tudorPts(x, w, y0, ys, h, seg = 8) {
  const r = w / 2, p = [[x - r, y0], [x + r, y0], [x + r, ys]];
  for (let i = 1; i < seg; i++) {
    const t = i / seg; // 0 at right springing -> 1 at left springing
    const xx = x + r * Math.cos(t * Math.PI);
    const k = 1 - Math.abs(2 * t - 1);                    // 0 at sides, 1 at apex
    const yy = ys + h * (1 - Math.pow(1 - k, 2.2)) ;     // quick rise, flat-ish pointed top
    p.push([xx, yy]);
  }
  p.push([x - r, ys]);
  return p;
}
/** segmental arch top */
export function segPts(x, w, y0, ys, rise, seg = 8) {
  const r = w / 2, p = [[x - r, y0], [x + r, y0], [x + r, ys]];
  for (let i = 1; i < seg; i++) { const t = i / seg; const xx = x + r - w * t; p.push([xx, ys + rise * Math.sin(t * Math.PI)]); }
  p.push([x - r, ys]);
  return p;
}

// ------------------------------------------------------------------------------------------------ textures
// Graphics pass 6: the college's own atlas, painted here (was: packed from the old per-material textures). 4 x 4 cells
// of 512 px in ONE 2048² canvas + a 1024² aux mask (R = glass, G = tint / weather mask). Same palette as the city's
// ashlar (world/textures.js STONE) so the college sits in the street instead of looking greyer than it. Stone pass
// (2026-11): a touch warmer than the city's new neutral buff (Worcester's fronts are honey Headington / Bath stone)
// but far less saturated than the old yellow; the atlas shader adds the soot and weathering.
const cache = {};
const STONE = [210, 195, 162];
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function newCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
/** tileable luminance grain + low-frequency blotches (wraps at the canvas edge) */
function grain(g, S, amp, r, blotch = 0, bs = 32) {
  let img; try { img = g.getImageData(0, 0, S, S); } catch (e) { return; }
  const d = img.data; if (!d || !d.length) return;
  const gw = Math.max(1, Math.round(S / bs)), grid = new Float32Array(gw * gw);
  for (let i = 0; i < grid.length; i++) grid[i] = r() * 2 - 1;
  for (let j = 0; j < S; j++) {
    const fy = (j / S) * gw, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty), iy1 = (iy + 1) % gw;
    for (let i = 0; i < S; i++) {
      let n = (r() * 2 - 1) * amp;
      if (blotch) {
        const fx = (i / S) * gw, ix = fx | 0, tx = fx - ix, sx = tx * tx * (3 - 2 * tx), ix1 = (ix + 1) % gw;
        const a = grid[iy * gw + ix], b = grid[iy * gw + ix1], c = grid[iy1 * gw + ix], e = grid[iy1 * gw + ix1];
        n += ((a + (b - a) * sx) * (1 - sy) + (c + (e - c) * sx) * sy) * blotch;
      }
      const k = (j * S + i) * 4;
      d[k] += n; d[k + 1] += n; d[k + 2] += n * 0.9;
    }
  }
  g.putImageData(img, 0, 0);
}
/** block boundaries along a course that wrap at S: [[x0, x1], ...] (the last block runs over the edge) */
function courseBlocks(S, r, minW, maxW) {
  const bs = []; let x = r() * minW;
  while (x < S - minW * 0.6) { bs.push(x); x += minW + r() * (maxW - minW); }
  return bs.map((x0, i) => [x0, i + 1 < bs.length ? bs[i + 1] : bs[0] + S]);
}
/** course heights that add up to S */
function courseHeights(S, r, minH, maxH) {
  const hs = []; let y = 0;
  while (S - y > maxH + minH) { const h = minH + r() * (maxH - minH); hs.push(h); y += h; }
  hs.push((S - y) / 2, (S - y) / 2);
  return hs;
}
// smooth honey ashlar with fine joints (main block, Terrace): 3.2 m repeat, 11 courses of ~29 cm
function paintAshlar(g, S) {
  const r = rnd(7), base = STONE, n = 11, ch = S / n;
  g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
  for (let c = 0; c < n; c++) {
    const y = c * ch;
    for (const [x0, x1] of courseBlocks(S, r, ch * 1.9, ch * 3.6)) {
      const q = r(), k = q < 0.04 ? 1.045 : q < 0.08 ? 0.945 : 0.975 + r() * 0.05, w = (r() - 0.5) * 0.04;
      for (const o of [0, -S]) {
        g.fillStyle = rgb(base[0] * k * (1 + w), base[1] * k, base[2] * k * (1 - w * 1.6)); g.fillRect(x0 + o, y, x1 - x0, ch);
        g.fillStyle = 'rgba(70,54,30,0.22)'; g.fillRect(x1 + o - 0.6, y, 1.2, ch);
        g.fillStyle = 'rgba(255,250,236,0.10)'; g.fillRect(x0 + o + 0.6, y, 1, ch);
      }
      if (r() < 0.2) { g.fillStyle = 'rgba(96,74,40,0.06)'; g.beginPath(); g.ellipse(x0 + (x1 - x0) * r(), y + ch * (0.2 + 0.6 * r()), 5 + r() * 12, 3 + r() * 5, 0, 0, 7); g.fill(); }
    }
    g.fillStyle = 'rgba(70,54,30,0.28)'; g.fillRect(0, y - 0.7, S, 1.4); if (c === 0) g.fillRect(0, S - 0.7, S, 0.7);
    g.fillStyle = 'rgba(255,250,236,0.12)'; g.fillRect(0, y + 0.7, S, 1);
  }
  grain(g, S, 5, r, 6, 64);
}
// the Cottages: old squared rubble brought to courses, patched and weathered, grey-buff. 4 m repeat
function paintRubble(g, S) {
  const r = rnd(11);
  g.fillStyle = '#9a9282'; g.fillRect(0, 0, S, S);
  let y = 0;
  for (const ch of courseHeights(S, r, 16, 40)) {
    for (const [x0, x1] of courseBlocks(S, r, 26, 84)) {
      const t = 150 + r() * 46, wv = r() * 20, pale = r() < 0.07 ? 22 : 0, dark = r() < 0.08 ? -26 : 0;
      for (const o of [0, -S]) {
        g.fillStyle = rgb(t + 16 + wv * 0.8 + pale + dark, t + 8 + wv * 0.6 + pale + dark, t - 12 + pale * 0.6 + dark);   // grey-buff (stone pass: was orange-brown)
        g.beginPath(); const j = () => (r() - 0.5) * 3.2;
        const a = [x0 + o + 1.6 + j(), y + 1.6 + j(), x1 + o - 1.6 + j(), y + 1.6 + j(), x1 + o - 1.6 + j(), y + ch - 1.6 + j(), x0 + o + 1.6 + j(), y + ch - 1.6 + j()];
        g.moveTo(a[0], a[1]); g.lineTo(a[2], a[3]); g.lineTo(a[4], a[5]); g.lineTo(a[6], a[7]); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,248,230,0.10)'; g.fillRect(x0 + o + 2, y + 2, x1 - x0 - 4, 1.2);
        g.fillStyle = 'rgba(40,30,18,0.16)'; g.fillRect(x0 + o + 2, y + ch - 3, x1 - x0 - 4, 1.4);
      }
      if (r() < 0.22) { g.fillStyle = `rgba(88,92,64,${0.10 + r() * 0.16})`; g.beginPath(); g.ellipse(x0 + r() * (x1 - x0), y + r() * ch, 3 + r() * 9, 2 + r() * 5, 0, 0, 7); g.fill(); }
    }
    y += ch;
  }
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(60,55,45,${r() * 0.06})`; g.fillRect(r() * S, 0, 3 + r() * 12, S); }
  grain(g, S, 7, r, 8, 64);
}
function paintBrick(g, S, seed, mortar, col, rows = 32) {
  const r = rnd(seed), bh = S / rows, n = Math.round(S / (bh * 3.15)), bw = S / n;
  g.fillStyle = mortar; g.fillRect(0, 0, S, S);
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * bw / 2;
    for (let i = -1; i <= n; i++) {
      const c = col(r); g.fillStyle = rgb(c[0], c[1], c[2]);
      g.fillRect(i * bw + off + 1.1, j * bh + 1.1, bw - 2.2, bh - 2.2);
      g.fillStyle = 'rgba(30,15,10,0.10)'; g.fillRect(i * bw + off + 1.1, j * bh + bh - 2.4, bw - 2.2, 1.2);
    }
  }
  grain(g, S, 6, r, 5, 64);
}
// York stone flags, 3 m repeat: six courses of ~0.5 m, random lengths
function paintFlags(g, S) {
  const r = rnd(23), n = 6, ch = S / n, base = [186, 178, 160];
  g.fillStyle = '#6f695c'; g.fillRect(0, 0, S, S);
  for (let c = 0; c < n; c++) for (const [x0, x1] of courseBlocks(S, r, ch * 0.9, ch * 1.9)) {
    const k = 0.9 + r() * 0.18, w = (r() - 0.5) * 0.06;
    for (const o of [0, -S]) {
      g.fillStyle = rgb(base[0] * k * (1 + w), base[1] * k, base[2] * k * (1 - w)); g.fillRect(x0 + o + 1, c * ch + 1, x1 - x0 - 2, ch - 2);
      g.fillStyle = 'rgba(255,255,245,0.10)'; g.fillRect(x0 + o + 1, c * ch + 1, x1 - x0 - 2, 1.5);
    }
    if (r() < 0.3) { g.fillStyle = 'rgba(70,74,60,0.08)'; g.beginPath(); g.ellipse(x0 + r() * (x1 - x0), c * ch + r() * ch, 8 + r() * 20, 5 + r() * 10, r() * 3, 0, 7); g.fill(); }
  }
  grain(g, S, 6, r, 7, 64);
}
// Welsh slate, 2.4 m repeat: 16 courses, half-bonded
function paintSlate(g, S) {
  const r = rnd(31), rows = 16, rh = S / rows, n = 10, sw = S / n;
  g.fillStyle = '#3f434c'; g.fillRect(0, 0, S, S);
  for (let j = 0; j < rows; j++) for (let i = -1; i <= n; i++) {
    const t = r() * 26, pur = r() < 0.15 ? 8 : 0;
    g.fillStyle = rgb(82 + t + pur, 88 + t, 100 + t + pur * 0.5); g.fillRect(i * sw + (j % 2) * sw / 2 + 0.7, j * rh, sw - 1.4, rh - 1.2);
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(i * sw + (j % 2) * sw / 2 + 0.7, j * rh, sw - 1.4, 1.5);
    g.fillStyle = 'rgba(10,10,14,0.35)'; g.fillRect(i * sw + (j % 2) * sw / 2 + 0.7, j * rh + rh - 3, sw - 1.4, 1.8);
  }
  grain(g, S, 5, r, 5, 64);
}
// Stonesfield-type stone slates (Cottages roof), 2.6 m repeat: thick, uneven, lichened
function paintStoneSlate(g, S) {
  const r = rnd(33);
  g.fillStyle = '#5b5446'; g.fillRect(0, 0, S, S);
  let y = 0;
  for (const ch of courseHeights(S, r, 20, 34)) {
    for (const [x0, x1] of courseBlocks(S, r, 22, 52)) {
      const t = r() * 44, wm = r() * 10;
      for (const o of [0, -S]) {
        g.fillStyle = rgb(128 + t + wm, 118 + t + wm * 0.5, 96 + t * 0.8); g.fillRect(x0 + o + 1, y + 0.5, x1 - x0 - 2, ch - 1);
        g.fillStyle = 'rgba(255,250,230,0.08)'; g.fillRect(x0 + o + 1, y + 0.5, x1 - x0 - 2, 2);
      }
      if (r() < 0.3) { g.fillStyle = `rgba(150,150,84,${r() * 0.3})`; g.fillRect(x0 + r() * (x1 - x0), y + r() * ch, 6, 4); }
    }
    g.fillStyle = 'rgba(24,20,14,0.5)'; g.fillRect(0, y + ch - 2.6, S, 2.6);
    y += ch;
  }
  grain(g, S, 7, r, 8, 64);
}
// vertical boards, 1 m repeat, light neutral so the vertex tint colours them (grey gates, oak doors, teak tables)
function paintBoards(g, S) {
  const r = rnd(5), n = 8, bw = S / n;
  for (let i = 0; i < n; i++) {
    const t = r() * 22;
    g.fillStyle = rgb(206 + t, 204 + t, 200 + t); g.fillRect(i * bw, 0, bw, S);
    for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(90,70,50,${0.04 + r() * 0.06})`; g.fillRect(i * bw + 3 + r() * (bw - 6), 0, 1 + r() * 1.5, S); }
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(i * bw + 2, 0, 2.5, S);
    g.fillStyle = 'rgba(30,24,18,0.62)'; g.fillRect(i * bw - 1, 0, 2.4, S);
  }
  g.fillStyle = 'rgba(30,24,18,0.62)'; g.fillRect(S - 1.2, 0, 1.2, S);
  grain(g, S, 4, r, 4, 64);
}
function glassFill(g, a, x, y, w, h) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#8797a5'); gr.addColorStop(0.4, '#5a6a79'); gr.addColorStop(1, '#38434e');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(x + w * 0.05, y); g.lineTo(x + w * 0.4, y); g.lineTo(x + w * 0.1, y + h); g.lineTo(x - w * 0.25, y + h); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x + w * 0.62, y); g.lineTo(x + w * 0.74, y); g.lineTo(x + w * 0.44, y + h); g.lineTo(x + w * 0.32, y + h); g.closePath(); g.fill();
  g.restore();
  a.fillStyle = 'rgb(255,0,0)'; a.fillRect(x, y, w, h);
}
/** what shows behind the glass: 0 curtains drawn back, 1 a half-lowered blind, 2 the dim room with a lamp, 3 shutters folded */
function dressing(g, x, y, w, h, v) {
  if (v === 0) {
    for (const [cx, cw] of [[x, w * 0.19], [x + w * 0.81, w * 0.19]]) { g.fillStyle = 'rgba(206,176,150,0.66)'; g.fillRect(cx, y, cw, h); for (let i = 1; i < 5; i++) { g.fillStyle = 'rgba(110,80,60,0.26)'; g.fillRect(cx + (cw * i) / 5, y, 1.6, h); } }
    g.fillStyle = 'rgba(20,24,30,0.22)'; g.fillRect(x + w * 0.19, y + h * 0.3, w * 0.62, h * 0.7);
  } else if (v === 1) {
    g.fillStyle = 'rgba(232,224,204,0.7)'; g.fillRect(x, y, w, h * 0.3); g.fillStyle = 'rgba(90,80,60,0.45)'; g.fillRect(x, y + h * 0.3, w, 2.5);
    g.fillStyle = 'rgba(20,24,30,0.2)'; g.fillRect(x, y + h * 0.32, w, h * 0.68);
  } else if (v === 2) {
    const gr = g.createLinearGradient(0, y + h * 0.3, 0, y + h); gr.addColorStop(0, 'rgba(22,24,28,0)'); gr.addColorStop(1, 'rgba(22,24,28,0.36)'); g.fillStyle = gr; g.fillRect(x, y + h * 0.3, w, h * 0.7);
    g.fillStyle = 'rgba(224,196,150,0.3)'; g.fillRect(x + w * 0.56, y + h * 0.58, w * 0.2, h * 0.16);
    g.fillStyle = 'rgba(120,96,70,0.3)'; g.fillRect(x + w * 0.1, y + h * 0.72, w * 0.5, h * 0.28);
  } else {
    for (const cx of [x, x + w * 0.88]) { g.fillStyle = 'rgba(232,228,214,0.6)'; g.fillRect(cx, y, w * 0.12, h); g.fillStyle = 'rgba(60,56,48,0.3)'; g.fillRect(cx + w * 0.055, y, 1.5, h); }
    g.fillStyle = 'rgba(20,24,30,0.18)'; g.fillRect(x + w * 0.12, y, w * 0.76, h);
  }
}
const WHITE = '#ece8dc';
/** painted sash window filling the whole cell: box frame, two sashes of cols x rows panes, thin glazing bars */
function paintSash(g, a, S, cols, rows, dress) {
  const F = S * 0.045, f = S * 0.032, bw = S * 0.015;
  g.fillStyle = WHITE; g.fillRect(0, 0, S, S); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(0, 0, S, S);
  const x = F, y = F, w = S - 2 * F, h = S - 2 * F - S * 0.012;
  glassFill(g, a, x, y, w, h); dressing(g, x, y, w, h, dress);
  const bar = (bx, by, bW, bH) => { g.fillStyle = WHITE; g.fillRect(bx, by, bW, bH); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(bx, by, bW, bH); g.fillStyle = 'rgba(0,0,0,0.16)'; if (bW > bH) g.fillRect(bx, by + bH - 1.2, bW, 1.2); else g.fillRect(bx + bW - 1.2, by, 1.2, bH); };
  for (let s = 0; s < 2; s++) {
    const sy = y + (s * h) / 2, sh = h / 2;
    bar(x, sy, f, sh); bar(x + w - f, sy, f, sh); bar(x, sy, w, s ? f * 1.25 : f); bar(x, sy + sh - (s ? f * 1.5 : f), w, s ? f * 1.5 : f);
    for (let i = 1; i < cols; i++) bar(x + f + ((w - 2 * f) * i) / cols - bw / 2, sy + f, bw, sh - 2 * f);
    for (let j = 1; j < rows; j++) bar(x + f, sy + f + ((sh - 2.2 * f) * j) / rows - bw / 2, w - 2 * f, bw);
  }
  // sill board, shadow of the stone head and jamb across the frame and glass
  g.fillStyle = '#d9d4c6'; g.fillRect(0, S - F - S * 0.012, S, F + S * 0.012); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, S - F - S * 0.012, S, 2);
  let gr = g.createLinearGradient(0, 0, 0, S * 0.13); gr.addColorStop(0, 'rgba(0,0,0,0.46)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S * 0.13);
  gr = g.createLinearGradient(0, 0, S * 0.14, 0); gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S * 0.14, S);
}
/** round-headed sash: the head is the top quarter of the cell (Batch.archUnit maps the semicircle there) */
function paintArchSash(g, a, S) {
  const F = S * 0.05, f = S * 0.032, bw = S * 0.016, ys = S * 0.25, cx = S / 2;
  g.fillStyle = WHITE; g.fillRect(0, 0, S, S); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(0, 0, S, S);
  const head = (c, inset) => { c.beginPath(); c.moveTo(inset, S - F); c.lineTo(inset, ys); c.ellipse(cx, ys, cx - inset, ys - inset * 0.5, 0, Math.PI, 0); c.lineTo(S - inset, S - F); c.closePath(); };
  g.save(); a.save(); head(g, F); g.clip(); head(a, F); a.clip();
  glassFill(g, a, 0, 0, S, S); dressing(g, F, ys, S - 2 * F, S - ys - F, 3);
  g.restore(); a.restore();
  const bar = (bx, by, bW, bH) => { g.fillStyle = WHITE; g.fillRect(bx, by, bW, bH); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(bx, by, bW, bH); };
  const mid = ys + (S - F - ys) * 0.42;
  bar(F, mid - f * 0.7, S - 2 * F, f * 1.4); bar(F, S - F - f * 1.4, S - 2 * F, f * 1.4); bar(F, ys, f, S - F - ys); bar(S - F - f, ys, f, S - F - ys);
  for (let i = 1; i < 3; i++) bar(F + ((S - 2 * F) * i) / 3 - bw / 2, ys * 0.55, bw, S - F - ys * 0.55);
  for (const yy of [ys + (mid - ys) * 0.5, mid + (S - F - mid) * 0.5]) bar(F, yy - bw / 2, S - 2 * F, bw);
  bar(F, ys - bw / 2, S - 2 * F, bw);
  // fan bars in the head + the curved top rail
  for (const c of [g, a]) {
    c.strokeStyle = c === g ? WHITE : 'rgb(0,0,0)'; c.lineWidth = bw;
    c.beginPath(); c.ellipse(cx, ys, (cx - F) * 0.45, (ys - F * 0.5) * 0.45, 0, Math.PI, 0); c.stroke();
    for (const ang of [-0.62, 0.62]) { c.beginPath(); c.moveTo(cx + Math.sin(ang) * (cx - F) * 0.45, ys - Math.cos(ang) * (ys - F * 0.5) * 0.45); c.lineTo(cx + Math.sin(ang) * (cx - F), ys - Math.cos(ang) * (ys - F * 0.5)); c.stroke(); }
    c.lineWidth = f * 1.6; c.beginPath(); c.ellipse(cx, ys, cx - F - f * 0.4, ys - F * 0.5 - f * 0.4, 0, Math.PI, 0); c.stroke();
  }
  const gr = g.createLinearGradient(0, 0, 0, S * 0.3); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S * 0.3);
}
/** leaded diamond quarries, edge to edge (stone mullions are geometry in front of it) */
function paintLeaded(g, a, S) {
  glassFill(g, a, 0, 0, S, S);
  g.fillStyle = 'rgba(20,24,30,0.2)'; g.fillRect(0, S * 0.3, S, S * 0.7);
  const r = rnd(41), d = S / 9;
  for (let i = -10; i < 20; i++) for (let j = -1; j < 10; j++) if (r() < 0.14) { g.fillStyle = `rgba(${150 + r() * 80},${170 + r() * 60},${150 + r() * 60},0.10)`; g.beginPath(); const cx = (i + (j % 2) * 0.5) * d, cy = j * d * 1.5; g.moveTo(cx, cy - d * 0.75); g.lineTo(cx + d / 2, cy); g.lineTo(cx, cy + d * 0.75); g.lineTo(cx - d / 2, cy); g.fill(); }
  for (const c of [g, a]) {
    c.strokeStyle = c === g ? 'rgba(26,26,28,0.85)' : 'rgb(90,0,0)'; c.lineWidth = S * 0.011; c.beginPath();
    for (let k = -12; k < 24; k++) { c.moveTo(k * d, 0); c.lineTo(k * d + S / 1.5, S); c.moveTo(k * d, 0); c.lineTo(k * d - S / 1.5, S); }
    c.stroke();
  }
  g.fillStyle = '#2a2a2c'; a.fillStyle = 'rgb(0,0,0)';
  for (const c of [g, a]) { c.fillRect(0, 0, S, S * 0.02); c.fillRect(0, S * 0.98, S, S * 0.02); }
  const gr = g.createLinearGradient(0, 0, 0, S * 0.2); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S * 0.2);
}
/** six-panel door, light neutral paint (the vertex tint gives oak / black / dark green); aux G = 1 */
function paintDoorLeaf(g, a, x, y, w, h, leaves = 1) {
  g.fillStyle = '#cfcfcf'; g.fillRect(x, y, w, h); a.fillStyle = 'rgb(0,255,0)'; a.fillRect(x, y, w, h);
  const lw = w / leaves;
  for (let l = 0; l < leaves; l++) {
    const lx = x + l * lw;
    for (const [py, ph] of [[0.05, 0.2], [0.29, 0.3], [0.63, 0.31]]) for (const [px, pw] of [[0.11, 0.34], [0.55, 0.34]]) {
      const X = lx + lw * px, Yy = y + h * py, Wd = lw * pw, Hh = h * ph;
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(X, Yy, Wd, Hh);
      g.fillStyle = '#c4c4c4'; g.fillRect(X + 4, Yy + 5, Wd - 8, Hh - 9);
      g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(X + 4, Yy + Hh - 5, Wd - 8, 2.5); g.fillRect(X + Wd - 5, Yy + 5, 2, Hh - 9);
    }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(lx - 1, y, 2, h);
    g.fillStyle = '#d8b64e'; a.fillStyle = 'rgb(0,0,0)';
    for (const c of [g, a]) { c.beginPath(); c.arc(lx + lw * (leaves > 1 && l === 0 ? 0.9 : leaves > 1 ? 0.1 : 0.9), y + h * 0.56, w * 0.022, 0, 7); c.fill(); }
  }
  const gr = g.createLinearGradient(0, y + h * 0.8, 0, y + h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)'); g.fillStyle = gr; g.fillRect(x, y + h * 0.8, w, h * 0.2);
}
function paintDoor(g, a, S) {
  paintDoorLeaf(g, a, 0, 0, S, S, 1);
  const gr = g.createLinearGradient(0, 0, 0, S * 0.12); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S * 0.12);
}
/** round-headed doorway: white fanlight in the top quarter (Batch.archUnit), panelled door below */
function paintArchDoor(g, a, S) {
  const ys = S * 0.25, cx = S / 2, F = S * 0.04;
  g.fillStyle = WHITE; g.fillRect(0, 0, S, S); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(0, 0, S, S);
  g.save(); a.save();
  for (const c of [g, a]) { c.beginPath(); c.ellipse(cx, ys - F * 0.6, cx - F, ys - F * 1.2, 0, Math.PI, 0); c.closePath(); c.clip(); }
  glassFill(g, a, 0, 0, S, ys); g.fillStyle = 'rgba(20,24,30,0.3)'; g.fillRect(0, 0, S, ys);
  g.restore(); a.restore();
  for (const c of [g, a]) {
    c.strokeStyle = c === g ? WHITE : 'rgb(0,0,0)'; c.lineWidth = S * 0.016;
    for (const ang of [-1.05, -0.52, 0, 0.52, 1.05]) { c.beginPath(); c.moveTo(cx, ys - F * 0.6); c.lineTo(cx + Math.sin(ang) * (cx - F), ys - F * 0.6 - Math.cos(ang) * (ys - F * 1.2)); c.stroke(); }
    c.beginPath(); c.ellipse(cx, ys - F * 0.6, (cx - F) * 0.3, (ys - F * 1.2) * 0.3, 0, Math.PI, 0); c.fillStyle = c === g ? WHITE : 'rgb(0,0,0)'; c.fill();
  }
  paintDoorLeaf(g, a, F, ys + F * 0.3, S - 2 * F, S - ys - F * 0.3, 1);
  const gr = g.createLinearGradient(0, 0, 0, S * 0.3); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S * 0.3);
}

export const ATLAS_N = 4, ATLAS_PAD = 0.016;
// (cells 4 - 7 must never be a surface that lies FLAT at or below the street's level: world/_fx_grass.js draws every
//  building mesh into its top-down mask of what grows where and reads the cell number as a ground kind — 4 park grass,
//  5 lawn, 6 meadow, 7 woodland floor — wherever the surface is below 0.2 m. The stone flags were cell 5: every flagged
//  step and floor of the sunk quad, the fan of steps and the Cellar Bar's stair grew lawn blades at street level, in the
//  air above it. Flags and the leaded lights changed places, 2026-11-22; slates are only ever roofs.)
const CELLS = ['ashlar', 'rubble', 'buff', 'redBrick', 'archDoor', 'leaded', 'slate', 'stoneSlate', 'plain', 'sashA', 'sashB', 'archSash', 'flags', 'door', 'boards', 'sashAttic'];
const CELL = Object.fromEntries(CELLS.map((n, i) => [n, i]));
function paintAtlas() {
  if (cache.wAtlas) return cache.wAtlas;
  const N = ATLAS_N, CS = 512, AS = 256;
  const c = newCanvas(N * CS), g = c.getContext('2d'), ac = newCanvas(N * AS), a = ac.getContext('2d');
  a.fillStyle = 'rgb(0,255,0)'; a.fillRect(0, 0, N * AS, N * AS);
  const pad = ATLAS_PAD * CS, span = CS - 2 * pad;
  const tile = (name, paint) => {         // tileable: the content area holds one period, the padding wraps round
    const i = CELL[name], x = (i % N) * CS, y = Math.floor(i / N) * CS, t = newCanvas(CS), tg = t.getContext('2d');
    paint(tg, CS);
    g.save(); g.beginPath(); g.rect(x, y, CS, CS); g.clip();
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) g.drawImage(t, x + pad + dx * span, y + pad + dy * span, span, span);
    g.restore();
  };
  const unit = (name, paint) => {         // one window / door per cell (slightly cropped by the padding)
    const i = CELL[name], x = (i % N) * CS, y = Math.floor(i / N) * CS;
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, CS, CS); g.clip();
    a.save(); a.translate((i % N) * AS, Math.floor(i / N) * AS); a.beginPath(); a.rect(0, 0, AS, AS); a.clip(); a.scale(AS / CS, AS / CS);
    paint(g, a, CS);
    g.restore(); a.restore();
  };
  tile('ashlar', paintAshlar); tile('rubble', paintRubble);
  tile('buff', (t, S) => paintBrick(t, S, 11, '#b3a88e', (r) => { const k = r(), d = r() < 0.08 ? 36 : 0; return [200 + k * 30 - d, 184 + k * 26 - d, 132 + k * 26 - d * 0.6]; }));
  tile('redBrick', (t, S) => paintBrick(t, S, 21, '#a39482', (r) => { const k = r(), d = r() < 0.12; return [(d ? 122 : 162) + k * 40, (d ? 62 : 82) + k * 24, (d ? 50 : 60) + k * 18]; }, 34));
  tile('flags', paintFlags); tile('slate', paintSlate); tile('stoneSlate', paintStoneSlate); tile('boards', paintBoards);
  tile('plain', (t, S) => { t.fillStyle = '#ffffff'; t.fillRect(0, 0, S, S); });
  unit('sashA', (gg, aa, S) => paintSash(gg, aa, S, 3, 2, 2)); unit('sashB', (gg, aa, S) => paintSash(gg, aa, S, 3, 2, 0));
  unit('sashAttic', (gg, aa, S) => paintSash(gg, aa, S, 3, 1, 1));
  unit('archSash', paintArchSash); unit('leaded', paintLeaded); unit('door', paintDoor); unit('archDoor', paintArchDoor);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  const aux = new THREE.CanvasTexture(ac);
  aux.colorSpace = THREE.NoColorSpace; aux.wrapS = aux.wrapT = THREE.RepeatWrapping; aux.minFilter = THREE.LinearMipmapLinearFilter; aux.magFilter = THREE.LinearFilter;
  // (memory pass: painted again by this same function, the cache set aside for the call, if the card ever needs either
  // picture again — so their canvases go once they are on the card: world/_tex_keep.js)
  return (cache.wAtlas = repaintableAll({ tex, aux }, remakeCached(cache, 'wAtlas', paintAtlas), 'worcester atlas'));
}

// ------------------------------------------------------------------------------------------------ sign atlas
/**
 * One canvas with every painted sign/notice/shield used by the Worcester modules. Returns {texture, uv(name)} where uv
 * gives [u0,v0,u1,v1] for Batch.sign. Cells are laid out on a 8 x 8 grid of 128 px (some span several cells).
 */
export function signAtlas() {
  if (cache.atlas) return cache.atlas;
  const S = 128, N = 8, W = S * N;
  const c = document.createElement('canvas'); c.width = W; c.height = W;
  const g = c.getContext('2d');
  g.fillStyle = '#777'; g.fillRect(0, 0, W, W);
  const cells = {};
  const put = (name, col, row, w, h, draw) => {
    g.save(); g.translate(col * S, row * S); g.beginPath(); g.rect(0, 0, w * S, h * S); g.clip(); draw(g, w * S, h * S); g.restore();
    const pad = 1;
    cells[name] = [(col * S + pad) / W, 1 - ((row + h) * S - pad) / W, ((col + w) * S - pad) / W, 1 - (row * S + pad) / W];
  };
  const text = (g, t, x, y, size, color, font = 'Georgia, serif', align = 'center', weight = 'bold') => {
    g.fillStyle = color; g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x, y);
  };
  // painted staircase numbers (dark paint on stone, transparent bg simulated with stone colour)
  const nums = ['1', '2', '3', '4', '5', '6', '13', '14', '15', '16'];
  nums.forEach((n, i) => put('num' + n, i % 8, Math.floor(i / 8), 1, 1, (g, w, h) => {
    g.fillStyle = '#cdb68c'; g.fillRect(0, 0, w, h);
    text(g, n, w / 2, h / 2 + 4, n.length > 1 ? 78 : 96, '#1b1a18', 'Georgia, "Times New Roman", serif');
  }));
  // Cellar Bar sign (black board, gold letters) 2x1
  put('cellarBar', 2, 1, 2, 1, (g, w, h) => {
    g.fillStyle = '#121212'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9a54a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    text(g, 'CELLAR BAR', w / 2, h / 2 + 3, 34, '#e3c35e');
  });
  // "Pigeonholes" plate over the pidge room door in Pump Quad (cream board, black serif, thin rule) 2x1
  put('pidgeSign', 5, 4, 2, 1, (g, w, h) => {
    g.fillStyle = '#efe6cc'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1b1a18'; g.lineWidth = 4; g.strokeRect(10, 12, w - 20, h - 24);
    text(g, 'PIGEONHOLES', w / 2, h / 2 - 8, 30, '#1b1a18', 'Georgia, "Times New Roman", serif');
    text(g, 'Junior Members’ post', w / 2, h / 2 + 24, 16, '#3a3630', 'Georgia, serif', 'center', 'italic');
  });
  // KEEP CLEAR notice 1x1 (black plate, white text)
  put('keepClear', 4, 1, 1, 1, (g, w, h) => {
    g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ddd'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    text(g, 'KEEP CLEAR', w / 2, 34, 19, '#f0f0f0', 'Arial, sans-serif');
    text(g, 'GATES IN', w / 2, 64, 19, '#f0f0f0', 'Arial, sans-serif');
    text(g, 'CONSTANT USE', w / 2, 92, 17, '#f0f0f0', 'Arial, sans-serif');
  });
  put('plate3', 5, 1, 1, 1, (g, w, h) => { g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, w, h); text(g, '3', w / 2, h / 2 + 4, 90, '#f2f2f2', 'Arial, sans-serif'); });
  put('worcNotice', 6, 1, 1, 1, (g, w, h) => {
    g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, w, h);
    text(g, 'Worcester', w / 2, 34, 22, '#f0f0f0', 'Georgia, serif', 'center', 'normal');
    text(g, 'College', w / 2, 60, 22, '#f0f0f0', 'Georgia, serif', 'center', 'normal');
    text(g, 'Private', w / 2, 92, 16, '#d0d0d0', 'Arial, sans-serif', 'center', 'normal');
  });
  put('worcNotice2', 7, 1, 1, 1, (g, w, h) => {
    g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, w, h);
    text(g, 'Worcester College', w / 2, 30, 15, '#f0f0f0', 'Georgia, serif', 'center', 'normal');
    text(g, 'Members only', w / 2, 58, 15, '#f0f0f0', 'Arial, sans-serif', 'center', 'normal');
    text(g, 'Please use card', w / 2, 84, 14, '#d0d0d0', 'Arial, sans-serif', 'center', 'normal');
    text(g, 'reader', w / 2, 102, 14, '#d0d0d0', 'Arial, sans-serif', 'center', 'normal');
  });
  // notice board (green baize with papers) 2x1
  put('noticeBoard', 0, 2, 2, 1, (g, w, h) => {
    g.fillStyle = '#3b2a1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f5a3a'; g.fillRect(8, 8, w - 16, h - 16);
    const r = rnd(9); const cols = ['#f4f1e8', '#f6e7a8', '#e8f0f8', '#f8d6dc', '#ffffff', '#ddeedd'];
    for (let i = 0; i < 14; i++) {
      const pw = 24 + r() * 30, ph = 30 + r() * 34, x = 12 + r() * (w - pw - 24), y = 12 + r() * (h - ph - 24);
      g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, y, pw, ph);
      g.fillStyle = 'rgba(30,30,30,0.6)'; for (let l = 0; l < 5; l++) g.fillRect(x + 3, y + 6 + l * 6, pw * (0.4 + r() * 0.5), 1.5);
      g.fillStyle = '#c22'; g.fillRect(x + pw / 2 - 1.5, y + 1, 3, 3);
    }
  });
  // war memorial tablets (stone, engraved)
  const memorial = (title) => (g, w, h) => {
    g.fillStyle = '#e2d5bb'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a8977a'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
    text(g, title, w / 2, 22, 13, '#5b4c37', 'Georgia, serif');
    g.fillStyle = 'rgba(80,65,45,0.55)';
    const r = rnd(title.length * 7);
    for (let col = 0; col < 2; col++) for (let l = 0; l < 14; l++) g.fillRect(14 + col * (w / 2 - 6), 36 + l * ((h - 46) / 14), (w / 2 - 30) * (0.5 + r() * 0.5), 2);
  };
  put('ww1', 2, 2, 1, 2, memorial('1914 – 1918'));
  put('ww2', 3, 2, 1, 2, memorial('1939 – 1945'));
  // painted shields over the Cottages doorways (stylised abbey arms)
  const shields = [
    ['#1c3f8a', '#e8c547', 'cross'], ['#2f6b2f', '#f0f0f0', 'cross'], ['#111111', '#f0f0f0', 'chevron'],
    ['#a01818', '#e8c547', 'keys'], ['#e8c547', '#a01818', 'bend'], ['#1c3f8a', '#f0f0f0', 'mitres'],
  ];
  shields.forEach(([fld, ch, kind], i) => put('shield' + i, 4 + (i % 4), 2 + Math.floor(i / 4), 1, 1, (g, w, h) => {
    g.fillStyle = '#b8a688'; g.fillRect(0, 0, w, h);
    g.beginPath(); g.moveTo(18, 14); g.lineTo(w - 18, 14); g.lineTo(w - 18, 62); g.quadraticCurveTo(w - 22, 100, w / 2, h - 10); g.quadraticCurveTo(22, 100, 18, 62); g.closePath();
    g.fillStyle = fld; g.fill(); g.lineWidth = 4; g.strokeStyle = '#3a3226'; g.stroke();
    g.save(); g.clip(); g.fillStyle = ch;
    if (kind === 'cross') { g.fillRect(w / 2 - 9, 10, 18, h); g.fillRect(10, 46, w - 20, 18); }
    if (kind === 'chevron') { g.beginPath(); g.moveTo(14, 96); g.lineTo(w / 2, 40); g.lineTo(w - 14, 96); g.lineTo(w - 14, 116); g.lineTo(w / 2, 60); g.lineTo(14, 116); g.fill(); }
    if (kind === 'bend') { g.beginPath(); g.moveTo(10, 10); g.lineTo(34, 10); g.lineTo(w - 10, 100); g.lineTo(w - 10, 124); g.fill(); }
    if (kind === 'keys') { g.fillRect(w / 2 - 34, 30, 10, 70); g.fillRect(w / 2 + 24, 30, 10, 70); g.beginPath(); g.arc(w / 2 - 29, 30, 12, 0, 7); g.arc(w / 2 + 29, 30, 12, 0, 7); g.fill(); }
    if (kind === 'mitres') { for (const [x, y] of [[w / 2 - 22, 40], [w / 2 + 22, 40], [w / 2, 82]]) { g.beginPath(); g.moveTo(x - 12, y + 16); g.lineTo(x - 10, y - 6); g.lineTo(x, y - 16); g.lineTo(x + 10, y - 6); g.lineTo(x + 12, y + 16); g.fill(); } }
    g.restore();
  }));
  // Porters' Lodge board
  put('lodge', 0, 3, 2, 1, (g, w, h) => {
    g.fillStyle = '#16233d'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8c27a'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
    text(g, "PORTERS' LODGE", w / 2, h / 2 + 2, 24, '#ecd89a');      // (24: at 30 the first and last letters ran off the board)
  });
  // "Gate 2" in white on the black gate (Provost's Lane on Walton Street)
  put('gate2', 5, 7, 2, 1, (g, w, h) => { g.fillStyle = '#16191b'; g.fillRect(0, 0, w, h); text(g, 'Gate 2', w / 2, h / 2 + 2, 46, '#f1efe8', 'Arial, Helvetica, sans-serif'); });
  // keep off the grass sign
  put('grass', 2, 4, 2, 1, (g, w, h) => {
    g.fillStyle = '#f1ede2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1b2a4a'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    text(g, 'Please do not walk', w / 2, 48, 26, '#1b2a4a', 'Georgia, serif', 'center', 'normal');
    text(g, 'on the grass', w / 2, 84, 26, '#1b2a4a', 'Georgia, serif', 'center', 'normal');
  });
  // intercom/card reader face
  put('reader', 4, 4, 1, 1, (g, w, h) => {
    g.fillStyle = '#8e9396'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; g.fillRect(30, 18, w - 60, 40);
    g.fillStyle = '#3a3'; g.beginPath(); g.arc(w / 2, 80, 7, 0, 7); g.fill(); for (let i = 0; i < 4; i++) { g.fillStyle = '#555'; g.fillRect(36 + i * 16, 100, 10, 10); }
  });
  // ---- graphics pass 6: wrought ironwork as alpha decals (was: one box per bar). Transparent background.
  const IRON = '#15161a';
  const clear = (g, w, h) => g.clearRect(0, 0, w, h);
  // railing panel, six spear-headed bars with a top and a bottom rail: tiles sideways (0.78 m per panel)
  put('rail', 0, 5, 2, 3, (g, w, h) => {
    clear(g, w, h);
    const n = 6, sp = w / n;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * sp;
      g.fillStyle = IRON; g.fillRect(x - 3.6, 24, 7.2, h - 24);
      g.beginPath(); g.moveTo(x, 1); g.lineTo(x + 7.5, 20); g.lineTo(x, 30); g.lineTo(x - 7.5, 20); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x - 3.6, 30, 2, h - 30);
    }
    g.fillStyle = IRON; g.fillRect(0, 46, w, 10); g.fillRect(0, h - 34, w, 10);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 46, w, 2); g.fillRect(0, h - 34, w, 2);
  });
  // gate leaf (1.6 x 2.4 m): stiles, bars, lock rail, dog bars, a scrolled top band
  put('gateLeaf', 2, 5, 2, 3, (g, w, h) => {
    clear(g, w, h);
    g.fillStyle = IRON; g.strokeStyle = IRON;
    g.fillRect(2, 0, 10, h); g.fillRect(w - 12, 0, 10, h); g.fillRect(0, 4, w, 9); g.fillRect(0, 62, w, 8); g.fillRect(0, h * 0.55, w, 9); g.fillRect(0, h - 16, w, 10);
    const n = 9; for (let i = 1; i < n; i++) { const x = (w * i) / n; g.fillRect(x - 3, 62, 6, h - 70); }
    for (let i = 0; i < n; i++) { const x = (w * (i + 0.5)) / n; g.fillRect(x - 2.2, h * 0.72, 4.4, h * 0.28 - 12); g.beginPath(); g.moveTo(x, h * 0.72 - 9); g.lineTo(x + 5, h * 0.72 + 3); g.lineTo(x - 5, h * 0.72 + 3); g.fill(); }
    g.lineWidth = 5; for (let i = 0; i < 4; i++) { const x = w * (0.125 + i * 0.25); g.beginPath(); g.arc(x - 13, 38, 11, -0.4, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(x + 13, 38, 11, Math.PI * 1.5, Math.PI + 0.4, false); g.stroke(); }
    g.fillStyle = '#c9a54a'; for (let i = 1; i < 4; i++) { g.beginPath(); g.arc((w * i) / 4, h * 0.55 + 4, 5, 0, 7); g.fill(); }
  });
  // overthrow (3.9 x 1.95 m): the scrolled arch over the Beaumont Street gates with a lamp-less generic gilt cartouche
  put('overthrow', 4, 5, 4, 2, (g, w, h) => {
    clear(g, w, h);
    g.strokeStyle = IRON; g.fillStyle = IRON; g.lineCap = 'round';
    g.fillRect(0, h - 12, w, 10);
    g.lineWidth = 9; g.beginPath(); g.moveTo(8, h - 10); g.bezierCurveTo(w * 0.2, h * 0.2, w * 0.8, h * 0.2, w - 8, h - 10); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(w * 0.12, h - 12); g.bezierCurveTo(w * 0.28, h * 0.52, w * 0.72, h * 0.52, w * 0.88, h - 12); g.stroke();
    const scroll = (x, y, r, dir) => { g.beginPath(); for (let t = 0; t <= 26; t++) { const a = (t / 26) * Math.PI * 3.2, rr = r * (1 - t / 34); const px = x + Math.cos(a) * rr * dir, py = y - Math.sin(a) * rr; if (t) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); };
    g.lineWidth = 5;
    for (const d of [-1, 1]) { const cx = w / 2 + d * w * 0.3; scroll(cx, h * 0.72, 26, d); scroll(w / 2 + d * w * 0.17, h * 0.6, 22, -d); scroll(w / 2 + d * w * 0.42, h * 0.84, 15, d); scroll(w / 2 + d * w * 0.07, h * 0.16, 16, d); }
    for (let i = 0; i < 9; i++) { const x = w * (0.1 + i * 0.1); g.fillRect(x - 2.5, h * 0.55 + Math.abs(i - 4) * 9, 5, h * 0.45 - Math.abs(i - 4) * 9 - 8); }
    g.fillStyle = IRON; g.beginPath(); g.ellipse(w / 2, h * 0.36, 30, 38, 0, 0, 7); g.fill();
    g.fillStyle = '#c9a54a'; g.beginPath(); g.ellipse(w / 2, h * 0.36, 23, 31, 0, 0, 7); g.fill();
    g.fillStyle = '#7a1c2c'; g.beginPath(); g.ellipse(w / 2, h * 0.36, 16, 23, 0, 0, 7); g.fill();
    g.fillStyle = '#c9a54a'; g.beginPath(); g.moveTo(w / 2, 4); g.lineTo(w / 2 + 9, h * 0.2); g.lineTo(w / 2 - 9, h * 0.2); g.fill();
    for (const d of [-1, 1]) { g.beginPath(); g.arc(w / 2 + d * 46, h * 0.36, 5, 0, 7); g.fill(); }
  });
  // iron light-well grating seen from above (Cellar Bar windows)
  put('grille', 7, 3, 1, 1, (g, w, h) => { clear(g, w, h); g.fillStyle = IRON; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7); for (let i = 0; i < 9; i++) g.fillRect(4 + i * ((w - 14) / 8), 0, 6, h); });
  // clock dial (pediment over the Library; a recollection, not sourced: see the report)
  put('clock', 6, 3, 1, 1, (g, w, h) => {
    clear(g, w, h);
    g.fillStyle = '#c9a54a'; g.beginPath(); g.arc(w / 2, h / 2, 62, 0, 7); g.fill();
    g.fillStyle = '#141a2c'; g.beginPath(); g.arc(w / 2, h / 2, 56, 0, 7); g.fill();
    g.fillStyle = '#e3c35e';
    for (let k = 0; k < 12; k++) { g.save(); g.translate(w / 2, h / 2); g.rotate((k / 12) * Math.PI * 2); g.fillRect(-2.5, -52, 5, k % 3 ? 10 : 15); g.restore(); }
    g.strokeStyle = '#e3c35e'; g.lineCap = 'round'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 24, h / 2 - 16); g.stroke();
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 14, h / 2 - 40); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 4, 0, 7); g.fill();
  });
  // a pane of glass: a pale wash, mostly see-through (Pump Quad's glazed lean-to)
  put('glass', 4, 7, 1, 1, (g, w, h) => { clear(g, w, h); g.fillStyle = 'rgba(206, 224, 220, 0.3)'; g.fillRect(0, 0, w, h); });
  // the street front's clock (2025 photograph: a pale blue-grey dial, gilt figures and hands, in the attic's small pediment)
  put('clockPale', 7, 4, 1, 1, (g, w, h) => {
    clear(g, w, h);
    g.fillStyle = '#b89a4a'; g.beginPath(); g.arc(w / 2, h / 2, 62, 0, 7); g.fill();
    g.fillStyle = '#9fb0c2'; g.beginPath(); g.arc(w / 2, h / 2, 57, 0, 7); g.fill();
    g.strokeStyle = '#d9bd62'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.stroke();
    g.fillStyle = '#e0c468';
    for (let k = 0; k < 12; k++) { g.save(); g.translate(w / 2, h / 2); g.rotate((k / 12) * Math.PI * 2); g.fillRect(-2.5, -54, 5, k % 3 ? 11 : 14); g.restore(); }
    g.strokeStyle = '#e6cc70'; g.lineCap = 'round'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 24, h / 2 - 16); g.stroke();
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 14, h / 2 - 40); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 4, 0, 7); g.fill();
  });
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  cache.atlas = { texture, uv: (n) => cells[n] };
  return cache.atlas;
}

// ------------------------------------------------------------------------------------------------ material pack
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
/**
 * Graphics pass 6: ONE atlas material for everything solid in the college: walls, roofs, joinery, metalwork AND the
 * windows and doors, which are painted cells (sashes with glazing bars, leaded lights, panelled doors with fanlights)
 * instead of boxes for every glazing bar. The city's atlas shader lights the glass at night (per-window hash on
 * floor(uv)), mirrors the sky at glancing angles and darkens it square-on, weathers the stone cells (0-3) . The city ground material takes paving / lawns / gravel. No separate glass mesh.
 * Returns the `pack` option for Batch.build: cells = Map(key -> {cell, alt, p, rx, ry, ox, oy, tint, seed}).
 */
export function makePack(world, spec = {}) {
  if (cache.pack) return cache.pack;
  const { tex, aux } = paintAtlas();
  const K = new Map();
  /** key -> cell `name`; m = metres per repeat (0 = a constant point of the cell: ox, oy); tint = hex or linear [r,g,b] */
  const add = (key, name, m, tint = 0xffffff, o = {}) => K.set(key, { cell: CELL[name], rx: m ? 1 / m : 0, ry: m ? 1 / m : 0, ox: 0, oy: 0, tint: Array.isArray(tint) ? tint : lin(tint), seed: 0, ...o });
  // masonry (weathered cells)
  add('stone', 'ashlar', 3.2);
  // creeper (stone pass, photographs worc_quad_north / worc_quad_main): the atlas shader's ivy grows on a wall whose
  // seed is >= 4000, up to 3.5 + 7 * fract(seed * 0.137) m, red where fract(seed * 0.317) >= 0.86. The Terrace's quad
  // front: dense, over the arcaded ground floor (6.6 m, green); the main front's loggia storey (5.7 m, green)
  add('stoneIvyT', 'ashlar', 3.2, 0xffffff, { seed: 4003.25 });
  add('stoneIvyM', 'ashlar', 3.2, 0xffffff, { seed: 4002.25 });
  add('stoneLit', 'ashlar', 3.2, [1.42, 1.36, 1.26]);              // under cover (loggia, passages): bounce light
  add('stoneDress', 'ashlar', 3.2, [1.1, 1.09, 1.06], { seed: 0 }); // dressings: cornices, strings, architraves
  add('greyStone', 'ashlar', 3.2, 0xb4b2a6);
  // weathered ashlar (the street front, 2025 photograph): the recessed centre is browner and streaked all over; the
  // channelled base of the wings is dark grey-brown under the clean cream ashlar above (the seed sets how weathered)
  add('stoneOld', 'ashlar', 3.2, [0.9, 0.84, 0.74], { seed: 1.456 }); add('stoneBase', 'ashlar', 3.2, [0.8, 0.77, 0.71], { seed: 2.3 });
  add('pitStone', 'ashlar', 3.2, 0xb9aa94);
  add('rubble', 'rubble', 4, 0xffffff, { seed: 1.5 });
  add('rubbleN', 'rubble', 4, [1.14, 1.11, 1.04], { seed: 1.5 });   // the Cottages' north front never sees the sun: lawn / gravel bounce
  add('rubbleLit', 'rubble', 4, [1.35, 1.3, 1.22], { seed: 0 });
  add('rubbleDk', 'rubble', 4, [0.68, 0.68, 0.66], { seed: 2.5 });   // the weathered street walls (Walton Street gateway)
  add('buff', 'buff', 2.4, 0xffffff, { seed: 0.5 });
  add('redBrick', 'redBrick', 2.4, 0xffffff, { seed: 0.75 });
  // flat surfaces
  add('pavingSolid', 'flags', 3);
  add('pitFloor', 'flags', 3, 0xb0aca4); add('pavingLit', 'flags', 3, [1.5, 1.34, 1.08]);   // under cover: no blue sky fill, warm bounce
  add('slate', 'slate', 2.4); add('stoneSlate', 'stoneSlate', 2.6);
  add('clayTile', 'stoneSlate', 2.6, [1.5, 0.78, 0.6]);      // red-brown clay tiles (the Cottages' east building, Pump Quad's south range): the slates' courses, tinted
  add('plaster', 'plain', 1, 0xe2d6be); add('plasterLit', 'plain', 1, [0.92, 0.86, 0.74]);
  add('lead', 'plain', 1, 0x7d8388);
  add('glassRoof', 'plain', 1, 0x9db3b0);      // Pump Quad's glazed lean-to seen from above and below (worcester.js)
  add('white', 'plain', 1, 0xeeeae0); add('door', 'plain', 1, 0x1d2420); add('frame', 'plain', 1, 0x1b1c1e);
  add('iron', 'plain', 1, 0x1c1d20); add('grey', 'plain', 1, 0x8e9396); add('dark', 'plain', 1, 0x0c0c0d);
  add('teal', 'plain', 1, 0x4aa8a4); add('alu', 'plain', 1, 0xb9bdc0); add('timber', 'boards', 1, 0x7a5a40);   // Earl Building bays (_worcint_earl.js)
  add('lampGlass', 'plain', 1, 0xe9dfc4); add('gold', 'plain', 1, 0xc9a54a); add('terracotta', 'plain', 1, 0xc8794e); add('soil', 'plain', 1, 0x4a3a2a);
  add('leafA', 'plain', 1, 0x5c8c3e); add('leafB', 'plain', 1, 0x74a04c); add('leafC', 'plain', 1, 0x4c7c48); add('box', 'plain', 1, 0x5a8444);
  for (const [k, hex] of Object.entries({ flP: 0x8a5ac8, flR: 0xd86aa0, flY: 0xf2d24a, flW: 0xf4f0f0, flB: 0x5a7ad8, flO: 0xe0703a, flM: 0xc04a8a })) add(k, 'plain', 1, hex);
  add('boards', 'boards', 1, 0xa9aeb3); add('wood', 'boards', 1, 0xa98a62); add('oak', 'boards', 1, 0x5a4230); add('teak', 'boards', 1, 0x8a6a48);
  // glazing + doors: whole-cell units (Batch.unit / archUnit give each its own integer UV bay = its own night-lit hash)
  add('sash', 'sashA', 1, 0xffffff, { alt: CELL.sashB, p: 0.45 });
  add('sashAttic', 'sashAttic', 1); add('archSash', 'archSash', 1); add('leaded', 'leaded', 1);
  add('doorOak', 'door', 1, 0x6a4a30); add('doorDark', 'door', 1, 0x1e2622); add('doorGrey', 'door', 1, 0x9aa0a6);
  add('archDoor', 'archDoor', 1, 0x1e2622); add('archDoorOak', 'archDoor', 1, 0x6a4a30);
  add('glassDark', 'sashA', 0, 0xffffff, { ox: 0.5, oy: 0.83 });   // a bare pane (dormers, fanlights, oriels)
  add('glassLit', 'sashA', 0, 0xffffff, { ox: 0.5, oy: 0.83 }); add('orielGlass', 'sashA', 0, 0xffffff, { ox: 0.5, oy: 0.83 });
  const atlas = world.atlasMaterial({ map: tex, aux, n: ATLAS_N, ny: ATLAS_N, ao: true, base: true, weather: true, weatherCells: 4, windows: true, ivy: true, roughness: 0.9, name: 'worcester-atlas', surf: world.surf && world.surf.kit(CELLS) });

  // ground: the city ground atlas (cells + metric scales from world.tex), layered depth bias like the city
  const LAYER = { area0: 1, area1: 2, area2: 3, path: 7, marking: 9, markings: 9 };
  const groundCells = new Map();
  const kindOf = { paving: 'paving', gravel: 'gravel', lawn: 'lawn', grass: 'grass', flowerbed: 'flowerbed', setts: 'setts', asphalt: 'asphalt', cobbles: 'cobbles', apron: 'paving', yard: 'gravel' };
  for (const [key, layer] of Object.entries(spec.ground || {})) {
    const kind = kindOf[key] || key, ci = world.tex.cells.ground[kind]; if (ci === undefined) continue;
    const s = (world.tex.ground(kind).userData || {}).scale || 3;
    groundCells.set(key, { cell: ci, rx: 1 / s, ry: 1 / s, ox: 0, oy: 0, tint: [1, 1, 1], layer: LAYER[layer] ?? 0, seed: 0 });
  }
  cache.pack = { atlas, cells: K, ground: world.cityMats.ground, groundCells, glow: null, glowCells: null, nCells: CELLS.length, shade: eaveTops };
  return cache.pack;
}

/** JS copy of the atlas shader's per-window hash: is the unit at integer UV bay (i, j) lit when a fraction f of windows is? */
export function bayLit(i, j, seed = 0) {
  const fr = (x) => x - Math.floor(x), ws = Math.floor(seed * 8 + 0.5) * 0.125;
  const px = i * 1.731 + ws * 0.013, py = j * 0.917 + 3.7;
  let x = fr(px * 0.1031), y = fr(py * 0.1031), z = fr(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d; y += d; z += d;
  return fr((x + y) * z);
}

/**
 * Ground contact shading (graphics pass 2): from every vertical triangle edge lying on the ground (y < maxY), a strip on
 * the ground going out along the face normal, dark at the wall fading to white (for the multiply-blended city aoStrip
 * material). Overlapping strips darken inside corners, loggia floors and plinths. Same frame as the source geometry.
 */
export function contactStrips(geo, opts = {}) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, W = opts.width || 1.3, maxY = opts.maxY ?? 0.25;
  const pos = [], col = [], dark = opts.dark ?? 0.5;
  const push = (x, y, z, c) => { pos.push(x, y, z); col.push(c, c, c * 1.02); };
  for (let t = 0; t < P.length; t += 9) {
    const ny = N[t / 3 * 3 + 1];
    if (Math.abs(ny) > 0.2) continue;
    const nx = N[t / 3 * 3], nz = N[t / 3 * 3 + 2], nl = Math.hypot(nx, nz); if (nl < 0.5) continue;
    // (a RISER is not a wall: a face under `minFace` high - a stair's riser, a kerb - casts no strip. Each riser of a
    //  flight used to lay a 1.3 m strip out over the treads below it, level, while they went on down: looking down
    //  Staircase 6 from its hall the eye went through five of them at a time, 0.5 x 0.5 x ... = black; from the foot
    //  nothing showed, the strips face up)
    if (Math.max(P[t + 1], P[t + 4], P[t + 7]) - Math.min(P[t + 1], P[t + 4], P[t + 7]) < (opts.minFace ?? 0.22)) continue;
    for (let e = 0; e < 3; e++) {
      const a = t + e * 3, b = t + ((e + 1) % 3) * 3;
      if (Math.abs(P[a + 1] - P[b + 1]) > 0.05) continue;
      // (opts.ground(x, z): the ground's own height, where it is not y = 0 — a sunk quad, a raised walk: an edge is a
      //  wall's FOOT only within maxY above the ground just outside it, and not far below it; without it a window sill
      //  that happened to lie under y = maxY got a strip of shade hanging from it)
      if (opts.ground) { const g = opts.ground((P[a] + P[b]) / 2 + (nx / nl) * 0.3, (P[a + 2] + P[b + 2]) / 2 + (nz / nl) * 0.3) ?? 0; if (P[a + 1] > g + maxY || P[b + 1] > g + maxY || P[a + 1] < g - 0.2) continue; }
      else if (P[a + 1] > maxY || P[b + 1] > maxY) continue;
      const L = Math.hypot(P[b] - P[a], P[b + 2] - P[a + 2]); if (L < 0.25) continue;
      const ox = (nx / nl) * W, oz = (nz / nl) * W, y = Math.max(P[a + 1], P[b + 1]) + 0.03;
      // quad a, b, b+o, a+o (wound to face up)
      const q = [[P[a], y, P[a + 2], dark], [P[b], y, P[b + 2], dark], [P[b] + ox, y, P[b + 2] + oz, 1], [P[a] + ox, y, P[a + 2] + oz, 1]];
      const cross = (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]);
      const order = cross < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const k of order) push(...q[k]);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.computeBoundingSphere();
  return g;
}

/**
 * aTop for the atlas shader's under-eave darkening: a 1 m height map of the tallest geometry over each cell; each wall
 * vertex (vertical normal) takes the height just inside its face, if that is a real eave/parapet (> 4 m, < 3.5 m above
 * the vertex at the wall top). Everything else keeps 1e4 (no darkening).
 */
function eaveTops(g) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, T = g.attributes.aTop; if (!T) return;
  const H = new Map(), key = (i, j) => i * 100003 + j;
  for (let t = 0; t < P.length; t += 9) {
    const x0 = Math.min(P[t], P[t + 3], P[t + 6]), x1 = Math.max(P[t], P[t + 3], P[t + 6]), z0 = Math.min(P[t + 2], P[t + 5], P[t + 8]), z1 = Math.max(P[t + 2], P[t + 5], P[t + 8]);
    if ((x1 - x0) * (z1 - z0) > 4000) continue;
    const y = Math.max(P[t + 1], P[t + 4], P[t + 7]);
    for (let i = Math.floor(x0); i <= Math.floor(x1); i++) for (let j = Math.floor(z0); j <= Math.floor(z1); j++) { const k = key(i, j), h = H.get(k); if (h === undefined || y > h) H.set(k, y); }
  }
  const top = T.array;
  for (let v = 0; v < P.length / 3; v++) {
    const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
    if (Math.abs(ny) > 0.3) continue;
    const x = P[v * 3] - nx * 0.6, z = P[v * 3 + 2] - nz * 0.6, h = H.get(key(Math.floor(x), Math.floor(z)));
    if (h !== undefined && h > 4) top[v] = h;
  }
  // a vertex far below its eave would only get darkened at the top of a long face: the shader handles the distance
  T.needsUpdate = true;
}
