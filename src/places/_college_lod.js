// Level of detail by distance for a college model built as ONE Batch of the college atlas pack (places/exeter/,
// places/somerville/): the model is 200 - 270 thousand triangles, nine in ten of them small (mouldings, tracery, glazing
// bars, chairs: under 0.1 m2 each) and together under a tenth of its surface. So:
//   - the atlas is built in CHUNKS (the college's own `chunk` function: cells of its LOCAL frame), and each chunk's
//     triangles are SORTED BY AREA, largest first: a level of detail is then a draw range of the same buffers (nothing is
//     copied, nothing re-uploaded): all of it within NEAR metres of the camera, the triangles of 0.05 m2 and more to MID,
//     those of 0.2 m2 and more beyond;
//   - beyond FAR metres from the whole site the chunks are not drawn at all: ONE mesh of the triangles of 0.35 m2 and
//     more (5 - 17 % of the model; walls, roofs, towers: the silhouette) stands in for the college, casting no shadow.
//   - a walk-in ROOM's inside (a Batch of its own: opts.rooms) is seen only from within or close through its windows:
//     all of it within ROOM.near of the camera, its larger triangles to ROOM.mid, nothing beyond; it never casts.
// Distances are from the camera to the box, in the college's own frame, round a chunk's SMALL triangles (the whole
// chunk's sphere is twice the size: one long wall or roof slope reaches far outside its cell) and are multiplied by the graphics tier's factor (as
// core/cull.js does for small meshes), with 8 % hysteresis. A chunk at its far level casts no shadow.
// The model's own ground is not drawn from beyond FAR either, except from the air (`aerial`) or from a height (a tower).
// `lod.update(camera, quality, aerial)` once a frame; `lod.stats`.
// Call it AFTER the Batch is built and BEFORE world.terrainLevelObject (the far mesh is levelled with the rest).
import * as THREE from 'three';

const AREA = [0.05, 0.2, 0.35];                      // m2: the middle level, the far level of a chunk, the stand-in
const DIST = { near: 45, mid: 140, far: 220 };       // m, at factor 1
const ROOM = { near: 25, mid: 70 };
const TIER = { low: 0.8, medium: 1, high: 1.4, ultra: 1.8 };

/** sort a non-indexed geometry's triangles by area, largest first; returns the vertex counts at each AREA threshold */
function sortByArea(g, toLocal) {
  const P = g.attributes.position.array, nT = P.length / 9, area = new Float32Array(nT), order = new Uint32Array(nT);
  for (let t = 0, o = 0; t < nT; t++, o += 9) {
    const ax = P[o + 3] - P[o], ay = P[o + 4] - P[o + 1], az = P[o + 5] - P[o + 2], bx = P[o + 6] - P[o], by = P[o + 7] - P[o + 1], bz = P[o + 8] - P[o + 2];
    area[t] = 0.5 * Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx); order[t] = t;
  }
  order.sort((a, b) => area[b] - area[a]);
  for (const a of Object.values(g.attributes)) {
    const sz = a.itemSize * 3, src = a.array, dst = new src.constructor(src.length);
    for (let t = 0; t < nT; t++) { const s = order[t] * sz; dst.set(src.subarray(s, s + sz), t * sz); }
    src.set(dst); a.needsUpdate = true;
  }
  const counts = AREA.map((lim) => { let lo = 0, hi = nT; while (lo < hi) { const m = (lo + hi) >> 1; if (area[order[m]] >= lim) lo = m + 1; else hi = m; } return lo * 3; });
  // the box round the small triangles (those the far level drops), in the college's own frame: where the chunk's detail is
  const nBig = counts[1] / 3, Q = g.attributes.position.array, box = [Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let t = nBig < nT ? nBig : 0; t < nT; t++) for (let k = 0; k < 3; k++) {
    const o = t * 9 + k * 3, l = toLocal(Q[o], Q[o + 2]);
    if (l[0] < box[0]) box[0] = l[0]; if (l[1] < box[1]) box[1] = l[1]; if (l[0] > box[2]) box[2] = l[0]; if (l[1] > box[3]) box[3] = l[1]; if (Q[o + 1] > box[4]) box[4] = Q[o + 1];
  }
  return { all: nT * 3, counts, box };
}

/**
 * meshes: what Batch.build returned (the atlas chunks among them are found by `isChunk`); group: the model's group.
 * centre [x, z], radius: the site's sphere; toLocal(x, z) -> [u, v]: the college's own frame (the chunks are its cells).
 * Returns { update(camera, quality), stats, far }.
 */
export function collegeLod(group, meshes, { centre, radius, toLocal = (x, z) => [x, z], name = 'college', rooms = [], isChunk = (m) => m.name === 'worcester:atlas' } = {}) {
  const items = [], inside = [];
  const item = (m) => { const g = m.geometry, s = sortByArea(g, toLocal); return { m, g, box: s.box, n: [s.all, s.counts[0], s.counts[1]], nFar: s.counts[2], lv: -1 }; };
  /** from a point (its LOCAL u, v and its height) to a chunk's box */
  const dist = (it, u, v, y) => Math.hypot(Math.max(it.box[0] - u, 0, u - it.box[2]), Math.max(it.box[1] - v, 0, v - it.box[3]), Math.max(0, y - it.box[4]));
  for (const m of meshes) if (m.isMesh && !m.isInstancedMesh && isChunk(m) && !m.geometry.index) items.push(item(m));
  // a room's inside: its atlas takes draw ranges, everything else it holds (glass, flames, door leaves) shows with it
  for (const m of rooms) { if (m.isMesh && !m.isInstancedMesh && isChunk(m) && !m.geometry.index) { m.castShadow = false; inside.push(item(m)); } }
  // the stand-in: the largest triangles of every chunk in one geometry
  let far = null;
  const nF = items.reduce((n, it) => n + it.nFar, 0);
  if (nF) {
    const g = new THREE.BufferGeometry();
    for (const [key, a0] of Object.entries(items[0].g.attributes)) {
      const sz = a0.itemSize, arr = new a0.array.constructor(nF * sz); let o = 0;
      for (const it of items) { const a = it.g.attributes[key]; if (a) arr.set(a.array.subarray(0, it.nFar * sz), o); o += it.nFar * sz; }
      g.setAttribute(key, new THREE.BufferAttribute(arr, sz));
    }
    g.computeBoundingSphere(); g.computeBoundingBox();
    far = new THREE.Mesh(g, items[0].m.material);
    far.name = name + ':far'; far.castShadow = false; far.receiveShadow = true; far.matrixAutoUpdate = false; far.updateMatrix(); far.visible = false;
    group.add(far);
  }
  // the model's own ground (lawns, paving: behind the walls from any street) is not drawn from afar unless from the air
  const grounds = meshes.filter((m) => m.isMesh && m.name === 'worcester:ground');
  const stats = { rooms: inside.length, roomTris: 0, chunks: items.length, tris: items.reduce((n, it) => n + it.n[0], 0) / 3, farTris: nF / 3, level: '', drawn: 0 };
  let wasFar = null;
  function update(camera, quality, aerial) {
    if (!camera || !items.length) return;
    const k = (quality && TIER[quality.level]) || 1, p = camera.position;
    const dSite = Math.hypot(p.x - centre[0], p.z - centre[1]) - radius;
    const isFar = far ? (wasFar ? dSite > DIST.far * k * 0.92 : dSite > DIST.far * k) : false;
    if (isFar !== wasFar) { wasFar = isFar; if (far) far.visible = isFar; for (const it of items) it.m.visible = !isFar; if (isFar) for (const it of inside) { it.m.visible = false; it.lv = 3; } }
    { const show = !isFar || !!aerial || p.y > 25; for (const g of grounds) if (g.visible !== show) g.visible = show; }
    if (isFar) { stats.level = 'far'; stats.drawn = stats.farTris; stats.roomTris = 0; return; }
    const [cu, cv] = toLocal(p.x, p.z);
    let rt = 0;
    for (const it of inside) {
      const d = dist(it, cu, cv, p.y);
      let lv = d < ROOM.near * k ? 0 : d < ROOM.mid * k ? 1 : 3;
      if (it.lv >= 0 && lv > it.lv && d < (it.lv === 0 ? ROOM.near : ROOM.mid) * k * 1.08) lv = it.lv;
      if (lv !== it.lv) { it.lv = lv; it.m.visible = lv < 3; if (lv < 3) it.g.setDrawRange(0, it.n[lv]); }
      if (lv < 3) rt += it.n[lv];
    }
    stats.roomTris = rt / 3;
    let drawn = 0;
    for (const it of items) {
      const d = dist(it, cu, cv, p.y);
      let lv = d < DIST.near * k ? 0 : d < DIST.mid * k ? 1 : 2;
      // (hysteresis: a chunk goes coarser only 8 % beyond the distance at which it went finer)
      if (it.lv >= 0 && lv > it.lv) { const lim = (it.lv === 0 ? DIST.near : DIST.mid) * k * 1.08; if (d < lim) lv = it.lv; }
      if (lv !== it.lv) { it.lv = lv; it.g.setDrawRange(0, it.n[lv]); it.m.castShadow = lv < 2; }
      drawn += it.n[lv];
    }
    stats.level = 'near'; stats.drawn = drawn / 3;
  }
  return { update, stats, far, items, inside };
}
