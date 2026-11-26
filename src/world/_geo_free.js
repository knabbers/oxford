// Memory pass (2026-11-22): GEOMETRY ARRAYS NOBODY READS ARE DROPPED ONCE THEY ARE ON THE GRAPHICS CARD.
//
// Why: three.js keeps every BufferAttribute's typed array for the life of the geometry, in case it is uploaded again.
// On the top tier the whole city held 417 MB of them in the page, the same bytes again being in the card's buffers.
//
// `freeAfterUpload(geometry, owner)` — for a geometry that is built once, never changed, never ray-cast, never copied
// from and never disposed-and-shown-again: each attribute's array (and the index's) is let go in three's own
// `onUpload` callback, the moment its buffer exists. Before that its bounding sphere and box are worked out (three
// would otherwise do it from the arrays at some later first use). Nothing else about the geometry changes: counts,
// groups and draw range are properties of their own.
// It REFUSES (returns false and leaves the geometry alone): dynamic or stream usage, interleaved buffers, morph
// targets, skinned or instanced meshes' geometry given as such, and anything marked `geometry.userData.keepArrays`.
// The callers (main.js `freeWorldGeometry`) add what only they can know: the tiles whose street fronts are copied
// into depth pools at run time, rooms (taken off the card and sent up again from these arrays), a module's own list.
//
// A WRONG FREE IS A CRASH LATER, so a freed attribute is guarded:
//   - reading `.array` gives an EMPTY array and is REPORTED with the owner's name, the attribute and the reader's place in the
//     code: console.error '[geofree] READ …' once per reader, `GEOFREE.reads`; tests assert it is empty. (Readers that
//     only ask "is there an array?" before measuring it are listed in QUIET.)
//   - setting `.needsUpdate` is reported the same way and ignored (the card keeps what it has) instead of three
//     throwing in the middle of a frame;
//   - `geometry.dispose()` is reported: the geometry could not be shown again.
// `?geofree=0` (GTO_GEOFREE=0): nothing is freed — as before, for A/B.
import * as THREE from 'three';

const qp = (n) => { try { return new URLSearchParams(globalThis.location ? globalThis.location.search : '').get(n); } catch (e) { return null; } };
const env = (n) => { try { return globalThis.process && globalThis.process.env ? globalThis.process.env[n] : undefined; } catch (e) { return undefined; } };
export const GEOFREE = { off: qp('geofree') === '0' || env('GTO_GEOFREE') === '0', on: false, geometries: 0, attributes: 0, freed: 0, freedMB: 0, refused: {}, byOwner: {}, reads: [], seen: new Set() };
// readers that only measure what is still to go up (world/airwarm.js bytesOf / the split upload, world/index.js's stream list)
const QUIET = /^airwarm\.js|^_geo_free\.js|mem_probe|^index\.js/;

function report(kind, owner, name) {
  const st = (new Error().stack || '').split('\n').slice(3, 9).map((l) => { const m = l.match(/\/([\w.-]+\.js)[^/]*?:(\d+):\d+\)?$/); return m ? m[1] + ':' + m[2] : ''; }).filter(Boolean);
  if (kind === 'READ' && st.length && QUIET.test(st[0])) return;
  const key = kind + ' ' + owner + ' ' + (st[0] || '?');
  if (GEOFREE.seen.has(key)) return; GEOFREE.seen.add(key);
  const msg = `[geofree] ${kind}: "${owner}" ${name} was let go after upload and is ${kind === 'READ' ? 'being read' : kind === 'UPDATE' ? 'marked for upload again' : 'being disposed'} at ${st.slice(0, 4).join(' < ') || '?'}`;
  GEOFREE.reads.push(msg); console.error(msg);
}
function drop(at, owner, name) {
  const a = at.array; if (!a) return;
  const bytes = a.byteLength;
  // (an EMPTY array of the same kind, not null: code that only measures what is still to upload — world/index.js's
  //  stream list, world/airwarm.js — reads byteLength 0, which is the truth; anything else is reported below)
  const none = new a.constructor(0);
  Object.defineProperty(at, 'array', { configurable: true, get() { report('READ', owner, name); return none; }, set(v) { Object.defineProperty(at, 'array', { configurable: true, writable: true, value: v }); } });
  Object.defineProperty(at, 'needsUpdate', { configurable: true, set(v) { if (v === true) report('UPDATE', owner, name); } });
  at.__freedBytes = bytes;
  GEOFREE.freed++; GEOFREE.freedMB += bytes / 1048576;
  const o = GEOFREE.byOwner[owner] || (GEOFREE.byOwner[owner] = { n: 0, mb: 0 }); o.n++; o.mb += bytes / 1048576;
}
const refuse = (why) => { GEOFREE.refused[why] = (GEOFREE.refused[why] || 0) + 1; return false; };

// THE TERRAIN'S DRAPING PASS (world/_terrain_drape.js) reads a static world-scene mesh's arrays once, when it first
// reaches the mesh - possibly after the mesh's first frame. While the surveyed ground is drawn it sets GEOFREE.hold,
// and an array that has reached the card is then HELD here instead of let go, until its geometry has been looked at
// (`geometry.userData.terrainSeen`) or two whole rounds of the scene have passed since (GEOFREE.round: it is not a
// mesh the pass ever reads). `geoFreeRelease` is called by that pass at the end of each round. -> arrays let go
const WAIT = [];
export function geoFreeRelease(round = GEOFREE.round || 0) {
  let n = 0;
  for (let i = WAIT.length - 1; i >= 0; i--) { const e = WAIT[i]; if (e.g.userData.terrainSeen || round >= e.round + 2) { drop(e.at, e.own, e.k); WAIT.splice(i, 1); n++; } }
  GEOFREE.held = WAIT.length;
  return n;
}

/** true once a real WebGL renderer exists (core/game.js): in node, and under ?geofree=0, nothing is ever freed */
export function installGeoFree(R) { GEOFREE.on = !GEOFREE.off && !!(R && R.getContext && R.properties); return GEOFREE.on; }

/** let `g`'s arrays go as each reaches the card. -> true if it was taken on */
export function freeAfterUpload(g, owner = '') {
  if (!GEOFREE.on || !g || !g.isBufferGeometry) return false;
  if (g.userData.geoFree) return true;
  if (g.userData.keepArrays) return refuse('keepArrays');
  if (g.isInstancedBufferGeometry) return refuse('instanced geometry');
  if (g.morphAttributes && Object.keys(g.morphAttributes).length) return refuse('morph targets');
  const parts = []; for (const k in g.attributes) parts.push([k, g.attributes[k]]); if (g.index) parts.push(['index', g.index]);
  for (const [, at] of parts) {
    if (!at || at.isInterleavedBufferAttribute || at.isGLBufferAttribute || at.isInstancedBufferAttribute) return refuse('interleaved / instanced attribute');
    if (at.usage !== THREE.StaticDrawUsage) return refuse('dynamic usage');
    if (!at.array) return refuse('no array');
    if (at.updateRanges && at.updateRanges.length) return refuse('update ranges');
  }
  if (!g.attributes.position) return refuse('no position');
  try { if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingBox) g.computeBoundingBox(); } catch (e) { return refuse('bounds'); }
  g.userData.geoFree = owner || g.name || 'geometry';
  const own = g.userData.geoFree;
  for (const [k, at] of parts) {
    if (at.__geoFree) continue; at.__geoFree = own;      // (an attribute shared by two geometries is taken once)
    const prev = at.onUploadCallback;
    at.onUpload(function () { try { if (prev) prev.call(this); } catch (e) { /* */ } if (GEOFREE.hold && !g.userData.terrainSeen && GEOFREE.hold(g)) WAIT.push({ at: this, own, k, g, round: GEOFREE.round || 0 }); else drop(this, own, k); });
    GEOFREE.attributes++;
  }
  g.addEventListener('dispose', () => { if (g.userData.terrainReplaced) return; if (parts.some(([, at]) => at.__freedBytes)) report('DISPOSE', own, 'geometry'); });      // (terrainReplaced: the draping pass has put a new geometry in its place and nothing shows this one)
  GEOFREE.geometries++;
  return true;
}
/**
 * The same for a geometry that is still WRITTEN for a while after it is built (a place module's merged mesh: the
 * z-fight pass moves a few vertices in the first seconds of play, core/_deoverlap.js) or of which only some attributes
 * are static (a kit batch whose index is rewritten as detail levels come and go):
 *   `watchUploads(g)` — at build, before it is first drawn: every upload of every attribute is noted;
 *   `freeSettled(g, owner)` — later: each attribute that is on the card as it stands, has static usage and has gone up
 *   at most `maxUploads` times is let go; the others are kept. -> bytes let go.
 */
export function watchUploads(g) {
  if (!GEOFREE.on || !g || !g.isBufferGeometry || g.userData.keepArrays || g.userData.gfWatched) return false;
  g.userData.gfWatched = true;
  const parts = Object.values(g.attributes); if (g.index) parts.push(g.index);
  for (const at of parts) {
    if (!at || at.isInterleavedBufferAttribute || at.isGLBufferAttribute || at.__gfW) continue; at.__gfW = true; at.__gfN = 0; at.__gfV = -1;
    const prev = at.onUploadCallback;
    at.onUploadCallback = function () { at.__gfN++; at.__gfV = at.version; try { if (prev) prev.call(this); } catch (e) { /* */ } };
  }
  return true;
}
export function freeSettled(g, owner = '', maxUploads = 1) {
  if (!GEOFREE.on || !g || !g.isBufferGeometry || !g.userData.gfWatched || g.userData.keepArrays) return 0;
  if (g.isInstancedBufferGeometry || (g.morphAttributes && Object.keys(g.morphAttributes).length) || !g.attributes.position) return 0;
  const own = owner || g.name || 'geometry'; let bytes = 0;
  const parts = []; for (const k in g.attributes) parts.push([k, g.attributes[k]]); if (g.index) parts.push(['index', g.index]);
  // the bounds first, while the positions are still here
  try { if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingBox) g.computeBoundingBox(); } catch (e) { return 0; }
  for (const [k, at] of parts) {
    if (!at || !at.__gfW || !at.array || at.__freedBytes) continue;
    if (at.usage !== THREE.StaticDrawUsage || at.__gfV !== at.version || at.__gfN < 1 || at.__gfN > maxUploads || (at.updateRanges && at.updateRanges.length)) { GEOFREE.kept = (GEOFREE.kept || 0) + 1; continue; }
    bytes += at.array.byteLength; drop(at, own, k);
  }
  if (bytes && !g.userData.geoFree) { g.userData.geoFree = own; GEOFREE.geometries++; g.addEventListener('dispose', () => { if (!g.userData.terrainReplaced) report('DISPOSE', own, 'geometry'); }); }
  return bytes;
}
const SETTLE = [];
/**
 * A kit's merged level-of-detail mesh (places/_b4_kit.js, _b5_kit.js, _rad_lod.js `Lod.finish`): its vertex arrays are
 * written once and its index is rewritten as levels change (dynamic usage: kept). Called where the geometry is made;
 * `settleSweep` lets the static arrays go once the z-fight pass has finished and they have stood on the card.
 */
export function settleLater(g, owner = '') { if (watchUploads(g)) SETTLE.push({ g, owner, at: -1 }); return g; }
/** main.js calls it every few seconds. deoverlapDone: core/_deoverlap.js has finished moving vertices. -> bytes let go */
export function settleSweep(deoverlapDone, nowS) {
  if (!GEOFREE.on || !deoverlapDone) return 0; let bytes = 0;
  for (let i = SETTLE.length - 1; i >= 0; i--) {
    const e = SETTLE[i], g = e.g; let up = true, sig = 0;
    for (const k in g.attributes) { const at = g.attributes[k]; if (!at.__gfW || at.usage !== THREE.StaticDrawUsage) continue; sig += at.version + at.__gfN * 1e6; if (at.__gfN < 1 || at.__gfV !== at.version) up = false; }
    if (!up) { e.at = -1; continue; }                                       // (not all on the card yet, or a write is waiting to go up)
    if (e.at < 0 || sig !== e.sig) { e.at = nowS; e.sig = sig; continue; }      // (stood there since now: first seen whole, or written and sent up again since the last look)
    if (nowS - e.at < 20) continue;
    bytes += freeSettled(g, e.owner, 2); SETTLE.splice(i, 1);
  }
  return bytes;
}
/**
 * The city's own merged tiles (world/util.js TileBatcher: plain meshes named 'world:<layer>' directly under the scene,
 * their far levels '…Far' and the shadow proxies): built once at load, drawn from then on. NOT
 *   - the near facade tiles whose street fronts are copied into depth pools at run time (`geometry.userData.dyn`:
 *     util.js pooledGeometry reads their arrays whenever a front comes within reach) — 150 tiles, 92 MB, kept;
 *   - the ground layers ('ground', 'groundNear', and on the surveyed ground 'markings' too): the terrain's rings
 *     rewrite their vertex pools and indices as the camera moves (world/_terrain_lod.js), for good. Their geometries
 *     are marked `userData.keepArrays = 'terrain'` (world/util.js), which freeAfterUpload refuses; so 'markings' may
 *     stay in the list below - it is let go only on the old ground (?terrain=old / 0), where nothing rewrites it.
 *     'ground' and 'groundNear' are NOT in the list: on the default ground they could never be let go, and the
 *     other two modes are for comparison only;
 *   - anything else that happens to be called 'world:…' (the sky, instanced trees and street furniture, effects).
 */
const TILE_LAYERS = /^world:(aoStrip|crenel|facade|fence|hedge|markings|parapet|roof|water|waterEdge)(Far)?$|^world:shadowProxy$/;
export function freeWorldTiles(scene) {
  if (!GEOFREE.on || !scene) return 0; let n = 0;
  for (const o of scene.children) {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || typeof o.name !== 'string' || !TILE_LAYERS.test(o.name) || !o.geometry) continue;
    if (o.geometry.userData.dyn) { refuse('depth-pool tile (kept)'); continue; }
    if (freeAfterUpload(o.geometry, o.name)) n++;
  }
  return n;
}
/** every plain static mesh under `root` that `ok(mesh)` accepts (default: all) -> how many geometries were taken on */
export function freeTree(root, owner, ok = null) {
  if (!GEOFREE.on || !root) return 0; let n = 0;
  root.traverse((o) => { if (!o.isMesh && !o.isLineSegments && !o.isLine && !o.isPoints) return; if (o.isSkinnedMesh || o.isBatchedMesh || (ok && !ok(o))) return; if (freeAfterUpload(o.geometry, typeof owner === 'function' ? owner(o) : owner)) n++; });
  return n;
}
export const geoFreeStats = () => ({ on: GEOFREE.on, geometries: GEOFREE.geometries, attributes: GEOFREE.attributes, freed: GEOFREE.freed, freedMB: Math.round(GEOFREE.freedMB), refused: { ...GEOFREE.refused }, byOwner: Object.fromEntries(Object.entries(GEOFREE.byOwner).sort((a, b) => b[1].mb - a[1].mb).slice(0, 30).map(([k, v]) => [k, Math.round(v.mb * 10) / 10])), reads: GEOFREE.reads.slice() });
