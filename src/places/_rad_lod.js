// One draw for the whole area's exteriors, with level of detail by chunk (owned by places/radcliffe_square.js).
// Every site registers GROUPS (a centre + radius for the distance test, three distances) and each group's CHUNKS per
// level (0 near, 1 mid, 2 far): the static geometry of every chunk at every level is concatenated into ONE non-indexed
// vertex buffer, and a dynamic index buffer lists the chunks drawn this frame (consecutive integers per chunk). Per frame
// each group picks a level from the camera's distance to its sphere (8 % hysteresis, scaled by q.dist, floor 0.75); a
// chunk at that level is drawn if its sphere (+ margin) is in the frustum and, for chunks with a facing normal (the
// Camera's sectors), if it faces the camera or the camera is well above it. The index is rewritten (and only the used
// part uploaded) when the drawn set changes; with nothing drawn the mesh is hidden.
import * as THREE from 'three';
import { settleLater } from '../world/_geo_free.js';

const ATTRS = [['position', 3], ['normal', 3], ['uv', 2], ['aCell', 4], ['aTint', 3], ['aTop', 1]];
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere(), _v = new THREE.Vector3();

/** the atlas part of a Batch as a plain BufferGeometry (or null): built through the pack into a throw-away group */
export function geoOf(B, pack) {
  const tmp = new THREE.Group();
  B.build({}, tmp, { pack, noShadow: true });
  const geos = tmp.children.filter((m) => m.isMesh && m.material === pack.atlas).map((m) => m.geometry);
  for (const m of tmp.children) if (m.material !== pack.atlas) m.geometry.dispose();
  if (!geos.length) return null;
  if (geos.length === 1) return geos[0];
  return concat(geos);
}

function concat(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const [name, sz] of ATTRS) {
    const arr = new Float32Array(n * sz); let o = 0;
    for (const g of geos) { const a = g.attributes[name], c = g.attributes.position.count; if (a) arr.set(a.array, o * sz); else if (name === 'aTop') arr.fill(1e4, o, o + c); o += c; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  return out;
}

/** split a non-indexed geometry by triangle centroid into cellM cells -> Map("i_j" -> geometry) */
export function splitByCell(geo, cellM = 48) {
  const P = geo.attributes.position.array, nT = P.length / 9, cellOf = new Array(nT), counts = new Map();
  for (let t = 0; t < nT; t++) {
    const o = t * 9, k = Math.floor((P[o] + P[o + 3] + P[o + 6]) / 3 / cellM) + '_' + Math.floor((P[o + 2] + P[o + 5] + P[o + 8]) / 3 / cellM);
    cellOf[t] = k; counts.set(k, (counts.get(k) || 0) + 1);
  }
  const out = new Map();
  for (const [k, n] of counts) {
    const g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(geo.attributes)) {
      const sz = a.itemSize, src = a.array, dst = new Float32Array(n * 3 * sz); let w = 0;
      for (let t = 0; t < nT; t++) if (cellOf[t] === k) { dst.set(src.subarray(t * 3 * sz, (t + 1) * 3 * sz), w); w += 3 * sz; }
      g.setAttribute(name, new THREE.BufferAttribute(dst, sz));
    }
    out.set(k, g);
  }
  return out;
}

export class Lod {
  constructor() { this.groups = []; this.chunks = []; this.mesh = null; this.sig = ''; this.stats = { drawn: 0, tris: 0, levels: {} }; }
  /** c: [x, y, z]; r: radius; d: [near, mid, far] edge distances in metres (level 0 within d[0], 1 within d[1], 2 within d[2]) */
  group(name, c, r, d, o = {}) {
    const g = { name, c, r, d, level: -1, chunks: [], o };
    g.add = (level, geo, co = {}) => {
      if (!geo || !geo.attributes.position.count) return null;
      geo.computeBoundingSphere();
      const ch = { g, level, geo, s: geo.boundingSphere.clone(), n: co.n || null, top: co.top ?? null, need: co.need || null, start: 0, count: geo.attributes.position.count, name: co.name || name };
      g.chunks.push(ch); this.chunks.push(ch); return ch;
    };
    this.groups.push(g);
    return g;
  }
  /** one group per cellM cell for a large site given its three levels' geometries (cut on the same grid); co = chunk opts */
  cells(name, levels, d, co = {}, cellM = 48) {
    const parts = levels.map((g) => (g ? splitByCell(g, cellM) : new Map()));
    for (const [k, g0] of parts[0]) {
      g0.computeBoundingSphere(); const s = g0.boundingSphere;
      const grp = this.group(name + ':' + k, [s.center.x, s.center.y, s.center.z], s.radius, d);
      grp.add(0, g0, { ...co, name: name + ':' + k });
      for (let lv = 1; lv < levels.length; lv++) { const g = parts[lv].get(k); if (g) grp.add(lv, g, { ...co, name: name + ':' + k }); }
    }
  }
  /** -> the one mesh (material = the area atlas); call once after every group is filled */
  finish(material) {
    let n = 0; for (const c of this.chunks) { c.start = n; n += c.count; }
    const geo = new THREE.BufferGeometry();
    for (const [name, sz] of ATTRS) {
      const arr = new Float32Array(n * sz);
      for (const c of this.chunks) { const a = c.geo.attributes[name]; if (a) arr.set(a.array, c.start * sz); else if (name === 'aTop') arr.fill(1e4, c.start, c.start + c.count); }
      geo.setAttribute(name, new THREE.BufferAttribute(arr, sz));
    }
    for (const c of this.chunks) { c.geo.dispose(); c.geo = null; }
    const idx = new THREE.BufferAttribute(new Uint32Array(Math.max(3, n)), 1); idx.setUsage(THREE.DynamicDrawUsage);
    geo.setIndex(idx); geo.setDrawRange(0, 0);
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    settleLater(geo, 'rad:atlas');      // (memory pass: the vertex arrays go once they have stood on the card; the index is rewritten and stays — world/_geo_free.js)
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'rad:atlas'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.visible = false;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    this.mesh = mesh; this.total = n / 3;
    return mesh;
  }
  /** position-only geometry of each group's level `prefer` (or the nearest level it has) for the shadow proxy */
  proxyGeo(prefer = 1) {
    const pos = this.mesh.geometry.attributes.position.array, parts = [];
    let n = 0;
    for (const g of this.groups) {
      if (g.o.noShadow) continue;
      let lv = prefer; while (lv >= 0 && !g.chunks.some((c) => c.level === lv)) lv--;
      if (lv < 0) lv = 0;
      for (const c of g.chunks) if (c.level === lv) { parts.push(c); n += c.count; }
    }
    const out = new Float32Array(n * 3); let o = 0;
    for (const c of parts) { out.set(pos.subarray(c.start * 3, (c.start + c.count) * 3), o * 3); o += c.count; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    return geo;
  }
  /** pick levels and chunks for this camera; k scales the distances; farK scales the far distance (aerial) */
  update(camera, k = 1, farK = 1) {
    if (!this.mesh) return;
    camera.updateMatrixWorld();
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    const drawn = [];
    for (const g of this.groups) {
      const dist = Math.max(0, Math.hypot(cx - g.c[0], cy - g.c[1], cz - g.c[2]) - g.r);
      const D = [g.d[0] * k, g.d[1] * k, g.d[2] * k * farK];
      let L = 3; for (let i = 0; i < 3; i++) if (dist < D[i]) { L = i; break; }
      // hysteresis: stay on the current level while within 8 % of its boundary
      if (g.level >= 0 && g.level !== L) {
        const cur = g.level;
        if (L > cur && cur < 3 && dist < D[cur] * 1.08) L = cur;
        // (coming back in: the edge is the furthest of the nearer levels' distances — a site with no far level (far 0.01)
        // used to be held at "beyond" for good once it had been out of range: the theatre's chairs, the canal end, the square)
        else if (L < cur && cur > 0 && dist > Math.max(D[0], cur > 1 ? D[1] : 0, cur > 2 ? D[2] : 0) * 0.92) L = cur;
      }
      g.level = L;
      if (L > 2) continue;
      for (const c of g.chunks) {
        if (c.level !== L) continue;
        if (c.need && !c.need(camera)) continue;
        _sp.copy(c.s); _sp.radius += 6;
        if (!_fr.intersectsSphere(_sp)) continue;
        if (c.n) {
          // a sector is seen when its normal is within the visible arc (acos(R / d)) plus its own half-width and a margin
          const dx = cx - g.c[0], dz = cz - g.c[2], h = Math.hypot(dx, dz) || 1, R = g.o.facingR || g.r;
          const lim = Math.cos(Math.min(Math.PI, Math.acos(Math.min(1, R / h)) + (g.o.facingPad || 0.35)));
          const facing = (c.n[0] * dx + c.n[1] * dz) / h > lim;
          const above = c.top !== null && (cy - c.top) > 0.7 * Math.max(0, h - g.r * 0.6);
          if (!facing && !above) continue;
        }
        drawn.push(c);
      }
    }
    let sig = ''; for (const c of drawn) sig += c.start + ',';
    if (sig === this.sig) return;
    this.sig = sig;
    const geo = this.mesh.geometry, idx = geo.index, A = idx.array;
    let o = 0, lv = { 0: 0, 1: 0, 2: 0 };
    for (const c of drawn) { const e = c.start + c.count; for (let i = c.start; i < e; i++) A[o++] = i; lv[c.level] += c.count / 3; }
    idx.clearUpdateRanges(); idx.addUpdateRange(0, Math.max(3, o)); idx.needsUpdate = true;
    geo.setDrawRange(0, o);
    this.mesh.visible = o > 0;
    this.stats = { drawn: drawn.length, tris: o / 3, levels: lv };
    if (this.debug) this.stats.list = drawn.map((c) => c.name + '@' + c.level + ':' + c.count / 3);
  }
}
