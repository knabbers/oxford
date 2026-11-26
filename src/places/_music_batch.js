// Tiny geometry batcher shared by the Faculty of Music and University Parks modules: collect transformed geometries per
// material, then merge into one mesh per material (one draw call each). UVs stay whatever the source geometry had
// (use metric boxes so repeat-wrapped textures keep their real-world scale).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

/** BoxGeometry with UVs in metres. */
export function mbox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return g;
}

export class MBatch {
  constructor() { this.parts = new Map(); }
  /** add geometry (consumed) with position/rotation(euler xyz or heading number)/scale */
  add(key, geo, x = 0, y = 0, z = 0, rot = 0, sx = 1, sy = 1, sz = 1) {
    if (typeof rot === 'number') _e.set(0, rot, 0); else _e.set(rot[0] || 0, rot[1] || 0, rot[2] || 0, rot[3] || 'XYZ');
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
    return this.addM(key, geo, _m);
  }
  addM(key, geo, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(matrix);
    let a = this.parts.get(key); if (!a) this.parts.set(key, (a = []));
    a.push(g);
    return this;
  }
  /** axis box from its bottom-centre (x, y0, z) */
  box(key, x, y0, z, w, h, d, rot = 0) { return this.add(key, mbox(w, h, d), x, y0 + h / 2, z, rot); }
  /** box spanning x0..x1, y0..y1, z0..z1 */
  span(key, x0, x1, y0, y1, z0, z1) { return this.add(key, mbox(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); }
  /** vertical plane facing heading h (0 = +z), bottom-centre at (x,y0,z), uv 0..1 across the plane (for signs/textures) */
  plane(key, x, y0, z, w, h, heading = 0, uvMetric = false) {
    const g = new THREE.PlaneGeometry(w, h);
    if (uvMetric) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h); }
    return this.add(key, g, x, y0 + h / 2, z, heading);
  }
  /** merge into meshes; mats: key -> Material. Returns a Group (static). */
  build(mats, { shadows = false, name = 'batch' } = {}) {
    const grp = new THREE.Group(); grp.name = name;
    for (const [k, list] of this.parts) {
      const mat = mats[k]; if (!mat) { console.warn('[batch] no material', k); continue; }
      const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
      for (const g of list) if (g !== geo) g.dispose();
      const mesh = new THREE.Mesh(geo, mat); mesh.name = name + ':' + k; mesh.castShadow = shadows; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      grp.add(mesh);
    }
    grp.matrixAutoUpdate = false; grp.updateMatrix();
    this.parts.clear();
    return grp;
  }
}

/** canvas texture helper */
export function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
