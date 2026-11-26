// Exeter College, Oxford (the Turl Street site): the STANDALONE model's place module. It has the game's module form
// ({ id, site, preMap(game), install(game) }) so that it can be moved into places/ later, but it is NOT installed in
// the game: this directory is not listed by the server (server/index.js listModules reads the top level of places/
// only) and the one page that loads it is the dev viewer public/exeter/index.html (_exeter_viewer.js).
//
//   preMap   takes the map's own Exeter out (the generated blocks, lawns, paths and the garden wall: MAP_IDS) and
//            stops the city's base ground being drawn inside the college's boundary (ov.groundHoles).
//   install  builds every part listed in _exeter_parts.js into ONE Batch in the college's LOCAL frame, makes the
//            meshes with the college atlas pack, and stands the whole model RIGID at the datum (64.40 m above sea
//            level) on the surveyed ground: world.terrainLevelObject. Floors, colliders and lamps are what the parts
//            registered. `game.exeter` holds the result (parts, triangles, K / G tables, heightAt, the group).
// Research: docs/research/exeter_survey.md. Frame, datum, levels, map ids: _exeter_shared.js. Kit: _exeter_kit.js.
import * as THREE from 'three';
import * as S from './_exeter_shared.js';
import * as K from './_exeter_kit.js';
import { PART_FILES } from './_exeter_parts.js';
import { treeModel } from '../../world/vegetation.js';
import { collegeLod } from '../_college_lod.js';
import { roomAt, ceilingAt } from './_exeter_rooms.js';
import { cityJoins } from './_exeter_joins.js';

const { L2W, W2L, SITE_RING, MAP_IDS, DATUM, inRing } = S;
const ringW = (ring) => ring.map(([u, v]) => { const p = L2W(u, v); return [+p[0].toFixed(3), +p[1].toFixed(3)]; });
const QS = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(''); } })();

const SITE = { x: 303.6, z: 116.5, r: 95 };
const CHUNK = 44;      // m: the atlas is built in cells of the LOCAL frame this size (frustum culling; detail by distance)
let PARTS = null;
/** load the part modules (once); a part that fails to load is reported and left out */
export async function loadParts(only) {
  if (PARTS) return PARTS;
  const out = [];
  for (const f of PART_FILES) {
    try { const m = await import('./' + f); if (m && m.default && typeof m.default.build === 'function') out.push({ file: f, ...m.default, CHECKED: m.default.CHECKED || m.CHECKED || [] }); }
    catch (e) { console.error('[exeter] part ' + f + ' failed to load', e); }
  }
  return (PARTS = only && only.length ? out.filter((p) => only.includes(p.id)) : out.filter((p) => !p.demo));      // (a `demo` part is built only when asked for by name)
}

export default {
  id: 'exeter',
  site: SITE,
  parts: () => PARTS,
  /** (the viewer awaits this before preMap; in the game a top-level await in a wrapper module would do the same) */
  prepare: (only) => loadParts(only),
  preMap(game) {
    const ov = game.overrides, map = game.map;
    for (const k of ['buildings', 'areas', 'paths', 'barriers']) for (const id of MAP_IDS[k]) { ov.skip.add(id); if (k === 'buildings' || k === 'barriers') ov.skipCollision.add(id); }
    // the city's base ground is not drawn inside the boundary: convex pieces of the ring, each lapping 5 cm over its
    // neighbours (holes that only share an edge leave a hairline of ground along it)
    const tris = THREE.ShapeUtils.triangulateShape(SITE_RING.map(([u, v]) => new THREE.Vector2(u, v)), []);
    const holes = ov.groundHoles || (ov.groundHoles = []);
    for (const t of tris) {
      const p = t.map((i) => SITE_RING[i]), c = [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3];
      holes.push(ringW(p.map((q) => { const l = Math.hypot(q[0] - c[0], q[1] - c[1]) || 1; return [q[0] + ((q[0] - c[0]) / l) * 0.05, q[1] + ((q[1] - c[1]) / l) * 0.05]; })));
    }
    // nothing wild grows, and no generated tree or lamp stands, on the rebuilt ground
    if (map && map.areas && !map.areas.some((a) => a.id === 'exeter:site')) { map.areas.unshift({ id: 'exeter:site', kind: 'paved', poly: ringW(SITE_RING) }); ov.skip.add('exeter:site'); }
    if (map && map.trees) for (let i = map.trees.length - 1; i >= 0; i--) { const t = map.trees[i], l = W2L(t[0], t[1]); if (inRing(l[0], l[1], SITE_RING)) map.trees.splice(i, 1); }
    // the city's side of the joins (Turl Street's section, Jesus's front, the Convocation House, Brasenose Lane): _exeter_joins.js
    if (map && !map._exeterJoins) { map._exeterJoins = true; try { game.exeterJoins = cityJoins(game); } catch (e) { console.error('[exeter] city joins', e); } }
  },
  async install(game) {
    const world = game.world, parts = await loadParts();
    const pack = K.exePack(world);
    const grp = new THREE.Group(); grp.name = 'exeter';
    world.addStatic(grp);
    const B = new K.Batch();
    B.push(S.localMatrix());
    // (the two walk-in rooms' insides, parts 'hallint' and 'chapelint', go into a Batch of their own: they are drawn only
    //  from near by - places/_college_lod.js)
    const BI = new K.Batch(); BI.push(S.localMatrix());
    const roomPart = (p) => /int$/.test(p.id);
    const floors = [], segs = [], lamps = [], placeholders = [], built = {}, claimed = new Set();
    for (const p of parts) for (const id of p.replaces || []) claimed.add(id);
    const opts = Object.fromEntries(QS.entries());
    // TREES: a part plants a tree with K.tree(B, u, v, y0, h, r, seed). Where the city's own tree material exists the
    // call is recorded and the tree is drawn as the CITY'S tree (world/vegetation.js treeModel in cityMats.treeNear:
    // leaf cards, wind sway, the same trees as the streets outside) at that place, height and crown radius, levelled
    // with the rest of the model; without it (the node dry run) the kit's plain geometry stands in.
    const trees = [], cityTree = !!(world.cityMats && world.cityMats.treeNear) && opts.kittrees !== '1';
    // (the Batch's current frame is the college's LOCAL frame or a part's own pushed frame: the foot is carried through it)
    const _p = new THREE.Vector3(), inv = S.localMatrix().invert();
    K.hooks.tree = cityTree ? (b, x, z, y0, h, r, seed = 1) => { _p.set(x, y0, z).applyMatrix4(b.m).applyMatrix4(inv); trees.push({ u: _p.x, v: _p.z, y0: _p.y, h, r, seed }); } : null;
    const KK = K;
    let curPart = '';      // (the part being built: each floor remembers whose it is, for the tools)
    const ctx = {
      game, world, B, pack, K: KK, S, opts, claimed, placeholders,
      group: grp,      // (a part may add an Object3D of its own here: it is levelled with the model; e.g. real glazing)
      floor(ring, y) { floors.push({ ring, y, part: curPart, box: ring.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]) }); },
      seg(u1, v1, u2, v2) { segs.push([u1, v1, u2, v2]); },
      solid(ring) { for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; segs.push([a[0], a[1], b[0], b[1]]); } },
      lamp(u, y, v) { lamps.push([u, y, v]); },
    };
    for (const p of parts) {
      curPart = p.id;
      const Bp = (ctx.B = roomPart(p) ? BI : B), n0 = Bp.tris(), depth = Bp.stack.length;
      try { p.result = p.build(ctx) || null; } catch (e) { console.error('[exeter] part ' + p.id, e); p.error = String(e && e.message || e); while (Bp.stack.length > depth) Bp.pop(); }
      built[p.id] = Math.round(Bp.tris() - n0);
    }
    B.pop(); BI.pop(); ctx.B = B; K.hooks.tree = null;
    /** the walking surface at a LOCAL point, metres above the datum (the last floor registered over it wins);
     *  strict (what people walk on in the game): the grounds' base sheets, which are drawn as rectangles reaching up to
     *  1 m past the boundary under the walls, count only inside the site ring - outside it the street is the city's */
    const floorAt = (u, v, strict) => { let out; for (let i = floors.length - 1; i >= 0; i--) { const f = floors[i], b = f.box; if (u < b[0] || u > b[2] || v < b[1] || v > b[3] || !inRing(u, v, f.ring)) continue; if (strict && f.part === 'grounds' && (out ?? (out = !inRing(u, v, SITE_RING)))) continue; return typeof f.y === 'function' ? f.y(u, v) : f.y; } return null; };
    const meshes = B.build({}, grp, { pack, chunk: (x, z) => { const l = W2L(x, z); return Math.floor((l[0] + 30) / CHUNK) * 16 + Math.floor((l[1] + 70) / CHUNK); }, base: (x, z) => { const l = W2L(x, z), y = floorAt(l[0], l[1]); return y == null ? 0 : y; } });
    const rooms = BI.build({}, grp, { pack, chunk: (x, z) => (W2L(x, z)[1] > 0 ? 1 : 0), base: (x, z) => { const l = W2L(x, z), y = floorAt(l[0], l[1]); return y == null ? 0 : y; } });
    for (const m of rooms) meshes.push(m);
    if (trees.length) {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
      const by = { broad: [], plane: [] }; for (const t of trees) (t.h >= 17 ? by.plane : by.broad).push(t);
      for (const sp of ['broad', 'plane']) {
        const Lt = by[sp]; if (!Lt.length) continue;
        const geo = treeModel(sp); geo.computeBoundingBox();
        const w0 = Math.max(geo.boundingBox.max.x - geo.boundingBox.min.x, geo.boundingBox.max.z - geo.boundingBox.min.z) || 1, h0 = geo.boundingBox.max.y || 1;
        const im = new THREE.InstancedMesh(geo, world.cityMats.treeNear, Lt.length);
        Lt.forEach((t, i) => {
          const p = L2W(t.u, t.v), w = Math.max((2 * t.r) / w0, (t.h / h0) * 0.45);
          q.setFromAxisAngle(up, (t.seed * 2.399) % 6.283);
          m4.compose(v3.set(p[0], t.y0, p[1]), q, sc.set(w, t.h / h0, w)); im.setMatrixAt(i, m4);
          im.setColorAt(i, col.set([0x5e7e34, 0x587a38, 0x66843a, 0x52742f][Math.floor(t.seed) % 4]));
        });
        im.castShadow = true; im.receiveShadow = false; im.computeBoundingSphere(); im.matrixAutoUpdate = false; im.updateMatrix(); im.name = 'exeter:trees-' + sp;
        grp.add(im); meshes.push(im);
        for (const t of Lt) { const a = L2W(t.u - 0.25, t.v - 0.25), b = L2W(t.u + 0.25, t.v + 0.25); segs.push([t.u - 0.25, t.v - 0.25, t.u + 0.25, t.v + 0.25]); void a; void b; }
      }
    }
    // DETAIL BY DISTANCE (places/_college_lod.js): each chunk's triangles sorted by area, a draw range per chunk by its
    // distance from the camera, and one mesh of the largest triangles for the whole college seen from afar
    const lod = collegeLod(grp, meshes.filter((m) => !rooms.includes(m)), { centre: [SITE.x, SITE.z], radius: SITE.r, toLocal: W2L, name: 'exeter', rooms });
    // THE DRAWN GROUND: every vertex is lifted by the surveyed height under it (world/terrain.js). The model is made
    // to stand rigid at its datum by one exact bake (each vertex takes: datum - the field under it).
    const real = typeof world.terrainLevelObject === 'function' && typeof world.terrainHeight === 'function';
    const level = DATUM - 58;
    const moved = real ? world.terrainLevelObject(grp, level, 0) : 0;
    /** what a thing at flat-world (x, z) must add to its y to stand at the model's level there */
    const lift = (x, z) => { if (!moved) return 0; const h = world.terrainHeight(x, z); return Number.isFinite(h) ? level - h : 0; };
    // people stand on the model's floors
    const col = game.worldCollider;
    if (col && col.addSegment) for (const s of segs) { const a = L2W(s[0], s[1]), b = L2W(s[2], s[3]); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'building' }); }
    if (typeof world.groundHeight === 'function') {
      const gh = world.groundHeight.bind(world);
      world.groundHeight = (x, z) => { const l = W2L(x, z); if (l[0] > -26 && l[0] < 99 && l[1] > -65 && l[1] < 42) { const y = floorAt(l[0], l[1], true); if (y != null) return y + lift(x, z); } return gh(x, z); };
    }
    // the follow camera stays under the roofs of the two walk-in rooms (they stand in the world scene: core/game.js roofOver)
    { const prev = game.roofOver;
      game.roofOver = (x, z, pl) => {
        const q = pl && pl.pos ? W2L(pl.pos.x, pl.pos.z) : null, room = q && q[0] > -20 && q[0] < 25 && q[1] > -35 && q[1] < 35 ? roomAt(q[0], q[1]) : null;
        if (!room) return prev ? prev(x, z, pl) : null;
        const l = W2L(x, z), c = ceilingAt(room, l[0], l[1]);
        return c == null ? null : c - 0.3 + lift(x, z);
      }; }
    for (const [u, y, v] of lamps) { const p = L2W(u, v); try { if (world.addLampGlow) world.addLampGlow(p[0], y + lift(p[0], p[1]), p[1]); } catch (e) { /* */ } }
    const tris = meshes.reduce((n, m) => n + (m.isInstancedMesh ? 0 : m.geometry.attributes.position.count / 3), 0);
    const checked = []; for (const p of parts) for (const row of p.CHECKED || []) checked.push([p.id, ...row]);
    game.exeter = { group: grp, meshes, lod, tris, built, parts, placeholders, lamps, segs: segs.length, floors: floors.length, floorList: floors, floorAt, lift, moved, checked, level, shared: S };
    console.log(`[gto] exeter: ${meshes.length} meshes, ${Math.round(tris)} triangles, ${moved} vertices levelled`, JSON.stringify(built), placeholders.length ? 'PLACEHOLDERS: ' + placeholders.length : '');
    // a part whose build returned { update(dt, game) } is driven every frame (real doors, glass that follows the light):
    // the install hands back one system that calls them (the viewer and the game add a place's returned system alike)
    const live = parts.filter((p) => p.result && typeof p.result.update === 'function');
    return { id: 'exeter', update(dt) { lod.update(game.camera, game.quality, world.aerial); for (const p of live) { try { p.result.update(dt, game); } catch (e) { if (!p._uerr) { p._uerr = 1; console.error('[exeter] part ' + p.id + ' update', e); } } } } };
  },
};
