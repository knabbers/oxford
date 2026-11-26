// world.terrainDrape (world/terrain.js): hand-built ground on real terrain.
//
// The warp lifts every VERTEX by the surveyed ground under it. A place's own lawn, paving or path is a few large flat
// polygons: lifted at its corners only, it runs straight where the real surface between them bends, and the map's
// ground under it (which is cut to the surface) shows through in patches, or the lawn hangs in the air. Call this once
// on what you have built, before or after adding it to the scene:
//
//     world.terrainDrape(meshOrGroupOrGeometry, { grid: 5, lift: 0, up: 0.7, below, matrix })
//
// It cuts every triangle that faces up (world normal y > `up`) along the lines of a square lattice `grid` metres apart,
// so the polygon follows the ground between its corners. grid 5 (the default) is the lattice the map's own base ground
// is cut to near the camera, on the same lines: a flat 5 m piece runs under a centimetre off the surveyed surface (nine
// in ten within 4 cm; more across the lip of a bank or a step). grid 2 also cuts along the field's diagonals and lies
// on the surface EXACTLY (six times the triangles); 8 and 16 are coarser. `lift` raises those triangles' vertices by
// that many metres. `below`: only triangles wholly under this height (world y). A triangle the ground under which is
// already one plane (a level precinct, a small piece) is left as it is. Walls and anything not facing up are left alone
// (they stand on their own corners). All attributes are carried (uv, colour, custom ones); material groups are kept.
// Not for instanced or skinned meshes, nor for anything that moves. On the flat (`?terrain=0`) it does nothing.
// Returns { meshes, added } (triangles added).
//
// YOU NEED NOT CALL IT for ordinary static ground: the world does it for every place by itself (drapeWorld below, run
// from world.update in idle steps: each static mesh a place adds to the world scene, its upward faces under 0.6 m).
// Call it yourself for ground built higher than that (a raised terrace), for a finer or coarser lattice, or when it
// must be done before the first frame. A geometry that has been draped is marked (userData.terrainDraped) and is not
// done twice.
import * as THREE from 'three';
import { TERRAIN, terrainSubdivide, gridOfTol } from './terrain.js';
import { GEOFREE, freeAfterUpload, geoFreeRelease } from './_geo_free.js';

const _m = new THREE.Matrix4(), _v = new THREE.Vector3();

function drapeGeometry(g, matrix, opt) {
  const grid = opt.grid ?? (opt.tol !== undefined ? gridOfTol(opt.tol) : 5), lift = opt.lift || 0, up = opt.up ?? 0.7, below = opt.below ?? 1e9, F = TERRAIN.field;
  const pa = g.attributes.position; if (!pa || pa.isInterleavedBufferAttribute) return null;
  // (the arrays must still be on the CPU side: a mesh whose arrays were let go after upload cannot be draped; counted)
  if (!pa.array || pa.array.length < pa.count * pa.itemSize || (g.index && (!g.index.array || !g.index.array.length))) { TERRAIN.drapeNoArrays = (TERRAIN.drapeNoArrays || 0) + 1; return null; }
  const n0 = pa.count, idx0 = g.index ? Array.from(g.index.array) : Array.from({ length: n0 }, (_, i) => i);
  if (idx0.length < 3) return null;
  // the triangles in the world, for the cutter
  const P = new Array(n0 * 3);
  for (let i = 0; i < n0; i++) { _v.fromBufferAttribute(pa, i).applyMatrix4(matrix); P[i * 3] = _v.x; P[i * 3 + 1] = _v.y; P[i * 3 + 2] = _v.z; }
  const flat = new Uint8Array(idx0.length / 3); let any = false;
  for (let t = 0; t < idx0.length; t += 3) {
    const a = idx0[t] * 3, b = idx0[t + 1] * 3, c = idx0[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (!(l > 1e-9 && Math.abs(ny) / l > up) || Math.max(P[a + 1], P[b + 1], P[c + 1]) > below) continue;
    // (and only where the ground under it is not already one plane to a few millimetres: a level precinct, a small piece)
    const h1 = F.sample(F.R, P[a], P[a + 2]), h2 = F.sample(F.R, P[b], P[b + 2]), h3 = F.sample(F.R, P[c], P[c + 2]);
    if (F.edgeDev(F.R, P[a], P[a + 2], P[b] - P[a], P[b + 2] - P[a + 2], h1, h2) < 0.004 && F.edgeDev(F.R, P[b], P[b + 2], P[c] - P[b], P[c + 2] - P[b + 2], h2, h3) < 0.004 && F.edgeDev(F.R, P[c], P[c + 2], P[a] - P[c], P[a + 2] - P[c + 2], h3, h1) < 0.004 && F.faceDev(F.R, P[a], P[a + 2], P[b], P[b + 2], P[c], P[c + 2], h1, h2, h3) < 0.004) continue;
    flat[t / 3] = 1; any = true;
  }
  if (!any) return null;
  const buf = { pos: P, nor: new Array(n0 * 3).fill(0), uv: new Array(n0 * 2).fill(0), idx: idx0.slice(), n: n0, cell: null, tint: null, col: null, edge: null, top: null, det: null, lay: null, anc: null };
  const src = [], made = [];
  terrainSubdivide(buf, 1, false, { tolOf: (i, t) => (flat[t / 3] ? 1 : 0), gridOf: () => grid, zeroOf: grid % 5 === 0 ? () => true : null, src, made });
  const added = Math.round((buf.idx.length - idx0.length) / 3);
  if (!added && !lift) return null;
  // every attribute, carried to the new vertices with the same weights
  const out = new THREE.BufferGeometry(), n1 = buf.n;
  for (const name in g.attributes) {
    const A = g.attributes[name], k = A.itemSize, arr = new A.array.constructor(n1 * k); arr.set(A.array.subarray(0, n0 * k));
    for (let j = 0, v = n0; j < made.length; j += 5, v++) {
      const a = made[j], b = made[j + 1], c = made[j + 2], w1 = made[j + 3], w2 = made[j + 4];
      if (c < 0) for (let q = 0; q < k; q++) arr[v * k + q] = arr[a * k + q] + (arr[b * k + q] - arr[a * k + q]) * w1;
      else for (let q = 0; q < k; q++) arr[v * k + q] = arr[a * k + q] * w1 + arr[b * k + q] * w2 + arr[c * k + q] * (1 - w1 - w2);
    }
    const B = new THREE.BufferAttribute(arr, k, A.normalized); out.setAttribute(name, B);
  }
  if (lift) {
    // (along the world's up, in the geometry's own frame)
    const inv = _m.copy(matrix).invert(), e = inv.elements, ux = e[4], uy = e[5], uz = e[6], seen = new Uint8Array(n1), p = out.attributes.position.array;
    for (let k = 0; k < buf.idx.length; k += 3) if (flat[src[k / 3]]) for (let q = 0; q < 3; q++) { const i = buf.idx[k + q]; if (!seen[i]) { seen[i] = 1; p[i * 3] += ux * lift; p[i * 3 + 1] += uy * lift; p[i * 3 + 2] += uz * lift; } }
  }
  out.setIndex(n1 > 65535 ? new THREE.BufferAttribute(Uint32Array.from(buf.idx), 1) : new THREE.BufferAttribute(Uint16Array.from(buf.idx), 1));
  // material groups: the same triangles, wherever they now are
  if (g.groups.length) {
    const first = new Int32Array(idx0.length / 3 + 1).fill(-1);
    for (let k = 0; k < src.length; k++) if (first[src[k]] < 0) first[src[k]] = k;
    first[idx0.length / 3] = src.length;
    for (let t = idx0.length / 3 - 1; t >= 0; t--) if (first[t] < 0) first[t] = first[t + 1];
    for (const G of g.groups) { const t0 = Math.floor(G.start / 3), t1 = Math.min(idx0.length / 3, Math.ceil((G.start + G.count) / 3)); out.addGroup(first[t0] * 3, (first[t1] - first[t0]) * 3, G.materialIndex); }
  }
  out.userData = { ...g.userData, terrainDraped: true, terrainCut: true, terrainSeen: true };      // (terrainCut: draped HERE. A builder's own `terrainDraped` alone means "this geometry carries its heights: leave it")
  // (memory pass, world/_geo_free.js: the new geometry takes the old one's place there too - its arrays go once uploaded)
  { const own = out.userData.geoFree; delete out.userData.geoFree; delete out.userData.gfWatched; if (own) freeAfterUpload(out, own); }
  if (g.boundingSphere) out.computeBoundingSphere(); if (g.boundingBox) out.computeBoundingBox();
  return { geometry: out, added };
}

/** See the head of this file. */
export function terrainDrape(target, opt = {}) {
  const res = { meshes: 0, added: 0 };
  if (!target || TERRAIN.mode !== 'real') return res;
  if (target.isBufferGeometry) {
    const r = drapeGeometry(target, opt.matrix || _m.identity().clone(), opt);
    if (r) { res.meshes = 1; res.added = r.added; res.geometry = r.geometry; } else res.geometry = target;
    return res;
  }
  target.updateWorldMatrix(true, true);
  target.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || !o.geometry || o.geometry.userData.terrainDraped) return;
    const r = drapeGeometry(o.geometry, o.matrixWorld, opt);
    if (!r) return;
    o.geometry = r.geometry; res.meshes++; res.added += r.added;
  });
  return res;
}

// WHAT A PLACE BUILDS ON A BUILDING THAT STANDS LEVEL, STANDS WITH IT (2026-11-23). The city's own buildings stand
// level on sloping ground (terrain.js terrainAnchors: each at one level, the difference baked into its vertices over
// a ramp in the bottom metre). What a place module builds over the same outline - the hand-built college that replaces
// the generated block, a shop front, a banner, a pub's lamp - was lifted vertex by vertex by the ground under it: a
// hand-built range leant with the street while its generated neighbours stood plumb, and what was fixed to a level
// wall slid along it. So when this pass first reaches a static mesh of a place, every vertex of it that is inside or
// within `STAND_R` of a level-standing outline takes that building's offset (`standOf(x, z, y)`: the building's
// level less the ground at the point, by the same ramp), once, in the arrays. Instances are moved whole, by their
// origins. A building that follows the ground (under 0.3 m of fall, or long and gentle) gives 0: nothing moves there.
// Left alone: what a builder has marked (`terrainStood`: it has asked the world itself; `terrainLevelled`;
// `terrainDraped` of its own: it carries its heights), what moves, and the places in STAND_NOT (Worcester's builders
// set their own levels against their own precincts). world.terrain.stood = { meshes, vertices, by: { owner: n } }.
const STAND_NOT = /^worcester/i;
const _sv = new THREE.Vector3(), _si = new THREE.Matrix4(), _sm = new THREE.Matrix4();
function standMesh(o, standOf, owner) {
  let g = o.geometry; const U = g.userData;
  if (o.isInstancedMesh) {
    // (not one whose matrices are written again as the game runs - a pooled set, particles: its owner would undo this)
    if (o.userData.terrainStood || o.userData.terrainLevelled || !o.instanceMatrix || o.instanceMatrix.usage !== THREE.StaticDrawUsage) return 0;
    o.userData.terrainStood = true;
    _si.copy(o.matrixWorld).invert(); const e = _si.elements; let n = 0;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, _sm); _sv.setFromMatrixPosition(_sm).applyMatrix4(o.matrixWorld);
      const d = standOf(_sv.x, _sv.z, _sv.y); if (!d) continue;
      _sm.elements[12] += e[4] * d; _sm.elements[13] += e[5] * d; _sm.elements[14] += e[6] * d; o.setMatrixAt(i, _sm); n++;
    }
    if (n) { o.instanceMatrix.needsUpdate = true; if (o.computeBoundingSphere && o.boundingSphere) o.computeBoundingSphere(); }
    return n;
  }
  if (U.terrainStood || U.terrainLevelled || (U.terrainDraped && !U.terrainCut)) return 0;
  let P = g.attributes.position;
  if (!P || P.isInterleavedBufferAttribute || !P.array || P.array.length < P.count * 3) return 0;
  const M = o.matrixWorld; let n = 0, e = null;
  for (let i = 0; i < P.count; i++) {
    _sv.fromBufferAttribute(P, i).applyMatrix4(M);
    const d = standOf(_sv.x, _sv.z, _sv.y); if (!d) continue;
    if (!e) {
      // (a geometry drawn in several places - one bench, many meshes - is not this mesh's alone to move: its own copy)
      const me = M.elements, own = me[0] === 1 && me[5] === 1 && me[10] === 1 && me[12] === 0 && me[13] === 0 && me[14] === 0 && me[1] === 0 && me[2] === 0 && me[4] === 0 && me[6] === 0 && me[8] === 0 && me[9] === 0;
      if (!own && !U.terrainCut) { const c = g.clone(); c.userData = { ...U, terrainSeen: true }; { const ow = c.userData.geoFree; delete c.userData.geoFree; delete c.userData.gfWatched; if (ow) freeAfterUpload(c, ow); } replaced.add(g); o.geometry = g = c; P = g.attributes.position; }
      _si.copy(M).invert(); e = _si.elements;
    }
    P.setXYZ(i, P.getX(i) + e[4] * d, P.getY(i) + e[5] * d, P.getZ(i) + e[6] * d); n++;
  }
  g.userData.terrainStood = true;
  if (n) { P.needsUpdate = true; g.computeBoundingSphere(); if (g.boundingBox) g.computeBoundingBox(); const T = TERRAIN.stood || (TERRAIN.stood = { meshes: 0, vertices: 0, by: {} }); T.meshes++; T.vertices += n; T.by[owner] = (T.by[owner] || 0) + n; }
  return n;
}

const MOVING = /^world:|^world$|vehic|traffic|police|pedestr|friend|crowd|props|^core$|player|net|sky|cloud|rain|bird|water|parked|punt|glid/i;
const seen = new WeakSet(), replaced = new Set();
let cursor = 0, rest = 0, quiet = 0;
// MEMORY PASS (world/_geo_free.js lets a static geometry's arrays go the moment they are on the card). Draping reads a
// mesh's arrays ONCE, when this pass first reaches it, which may be after its first frame. So while the ground is the
// surveyed one, the memory pass HOLDS what it would let go (GEOFREE.hold) until the geometry has been looked at here
// (`geometry.userData.terrainSeen`), or until two whole rounds of the scene have gone by since it was uploaded (it is
// then not a static mesh of the world scene: a room, something that moves). Nothing depends on which came first.
if (TERRAIN.mode === 'real') GEOFREE.hold = () => true;
// a round = every top-level child of the scene looked at once; old geometries nothing shows any more are disposed then
function roundDone(scene) {
  GEOFREE.round = (GEOFREE.round || 0) + 1;
  if (replaced.size) {
    const used = new Set(); scene.traverse((o) => { if (o.geometry) used.add(o.geometry); });
    for (const g of replaced) if (!used.has(g)) { g.userData.terrainReplaced = true; g.dispose(); TERRAIN.drapeDisposed = (TERRAIN.drapeDisposed || 0) + 1; }
    replaced.clear();
  }
  geoFreeRelease(GEOFREE.round);
  TERRAIN.geoFree = { on: GEOFREE.on, held: GEOFREE.held || 0, freed: GEOFREE.freed, freedMB: Math.round(GEOFREE.freedMB), reads: GEOFREE.reads.length, round: GEOFREE.round };      // (for a look from outside: world.terrain.geoFree)
}
/**
 * Drape what the places have built: every static, non-instanced mesh under the scene's top-level objects (not the
 * city's own tiles, nor anything that moves), its upward faces below 0.6 m. A few milliseconds a call, going round the
 * scene's children; meshes are remembered, so what a place adds later (its near model) is found on a later round.
 * Returns the triangles added this call.
 */
export function drapeWorld(scene, budgetMs = 2, standOf = null) {
  if (TERRAIN.mode !== 'real' || !scene) return 0;
  // (while it finds new meshes it works every frame; once a whole round finds none, one look every half second)
  if (rest > 0) { rest--; return 0; }
  const kids = scene.children, t0 = performance.now(); let added = 0, fresh = 0, n = 0;
  for (; n < kids.length && performance.now() - t0 < budgetMs; n++) {
    const top = kids[cursor++ % kids.length];
    if (cursor % kids.length === 0) roundDone(scene);
    if (!top || MOVING.test(top.name || '') || top.matrixAutoUpdate) continue;
    const owner = (top.userData && top.userData.owner) || top.name || '?', stands = !!standOf && !STAND_NOT.test(owner) && !STAND_NOT.test(top.name || '');
    top.traverse((o) => {
      if (!o.isMesh || seen.has(o)) return;
      seen.add(o); fresh++; o.userData.terrainSeen = true;      // (looked at once, now: nothing in the terrain code reads this mesh's CPU arrays after this call)
      const g = o.geometry; if (!g) return;
      const skip = o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || o.matrixAutoUpdate || g.userData.terrainDraped || !g.attributes.position || g.attributes.position.count > 200000;
      // (a kit's level-of-detail mesh, places/_b4_kit.js and its kin: its INDEX is rewritten as levels come and go, in the
      //  numbering it was built with - a draped copy would be undone at the next change. Its ground follows the survey
      //  at its own vertices only, until the kit drapes its chunks itself before merging them: counted)
      const dynIndex = !skip && g.index && g.index.usage !== THREE.StaticDrawUsage;
      if (dynIndex) TERRAIN.drapeDynIndex = (TERRAIN.drapeDynIndex || 0) + 1;
      let fixed = !skip && !dynIndex; if (fixed) for (let q = o.parent; q && q !== scene; q = q.parent) if (q.matrixAutoUpdate) { fixed = false; break; }
      const r = fixed ? drapeGeometry(g, o.matrixWorld, { below: 0.6 }) : null;
      g.userData.terrainSeen = true;
      if (r) { o.geometry = r.geometry; replaced.add(g); added += r.added; TERRAIN.draped = (TERRAIN.draped || 0) + r.added; }
      // (and what stands on a level building stands with it - above. A kit's mesh with a rewritten index too: only positions move)
      if (stands && !o.isSkinnedMesh && !o.isBatchedMesh && !o.matrixAutoUpdate) {
        let still = true; for (let q = o.parent; q && q !== scene; q = q.parent) if (q.matrixAutoUpdate) { still = false; break; }
        if (still) { try { standMesh(o, standOf, owner); } catch (err) { if (!TERRAIN.standErr) { TERRAIN.standErr = String(err && err.message); console.error('[world] terrain stand', o.name, err); } } }
      }
    });
  }
  quiet = fresh ? 0 : quiet + n;
  if (quiet >= kids.length) { rest = 30; quiet = 0; TERRAIN.drapeIdle = true; } else if (fresh) TERRAIN.drapeIdle = false;      // (idle: every static mesh now in the scene has been looked at)
  return added;
}
