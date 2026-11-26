// Worcester College, the RANGES of Pump Quad (Staircases 13 - 16; survey B07, package B4), hand-built in the
// college's atlas in place of the city generator's sunk sash-window boxes: the three-storey south range and the east
// end of the Old Kitchen behind the Cottages, the east range on Worcester Street, the canted angle with its
// 15th-century doorway under a stone-slated hood, and the two wings running south to the kitchen yard. The court
// itself is places/_worcester_pump.js (worcester.js); the pigeonhole room behind the court front is
// places/_worcint_pidge.js, its door and window real openings in this front (RANGE_OPENINGS).
// Plan, sources, K / G: _worcester_pumpranges_plan.js. Geometry: _worcester_pumpranges_build.js.
// `?wpumpr=0` (node: GTO_WPUMPR=0): the generator's ranges as before, for before / after pictures.
//
// DEFECTS (what could not be made accurate here, and why):
//  - the OLD KITCHEN west of u -1.3 is worcester.js's "Staircase 13 west wing", two storeys high (eaves 6.2 m): it
//    really is this range's height (eaves 7.25 m, ridge 9.75 m, clay tiles) as far as u -11.9, where its great chimney
//    of 1423 stands on the west gable; another helper was rebuilding its garden passage when this was written. The
//    range is closed at u -1.3 with a plain gable meanwhile.
//  - the court face follows the map's line (the pigeonhole room's door is on it); LIDAR and the 1939 plan have it up
//    to half a metre further south at its east end (CHECKED).
//  - the south-east block's yard face is built in one line with the range's (it really stands about 0.6 m proud).
//  - the kitchen-yard and garden sides stand on their TRUE levels (59.6 and 59.15 mOD); where the drawn ground is
//    still higher there (no level precinct for the yard yet) their ground floors are in it.
import * as THREE from 'three';
import { Batch, makePack, frame, signAtlas } from './_worcester_kit.js';
import { WORC_LEVELS } from './_worcester_shared.js';
import { PUMPR_ON as ON, PUMPR_IDS, RG, RING, WAYS, LEVEL, CHECKED, STAIR_DOORS, RANGE_OPENINGS, FRAME as FR, L2W, W2L, front, back, eastU } from './_worcester_pumpranges_plan.js';
import { buildRanges } from './_worcester_pumpranges_build.js';

export { CHECKED };
/** the true ground beside the ranges at local (u, v), above the datum: the court, the street's pavement, the kitchen yard, the garden */
export function rangesGround(u, v) {
  if (v < RG.vN + 0.3 || u > eastU(Math.max(RG.vN, v)) - 0.6) return LEVEL.street;
  if (v > back(u) - 0.6) return u >= RG.w2.u1 - 0.6 ? LEVEL.yard : LEVEL.garden;
  if (u < RG.uW + 0.5) return LEVEL.garden;
  return LEVEL.court;
}

export default {
  id: 'worcester_pumpranges',
  site: { x: -236, z: 44, r: 34 },      // (for the crop switch, core/_crop.js)
  preMap(game) {
    if (!ON) return;
    try { for (const id of PUMPR_IDS) game.overrides.skip.add(id); } catch (e) { console.error('[worcester_pumpranges] preMap', e); }
  },
  install(game) {
    if (!ON) return null;
    const world = game.world, col = game.worldCollider;
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    // stone the college's atlas did not have: tinted copies of its rubble cell. The top storey of 1824 is in paler,
    // more regular stone than the 15th-century rubble under it (the corner photograph); the Worcester Street face is
    // soot-dark (the 2014 photograph)
    const K = pack.cells, cell = (key, from, tint, o = {}) => { if (K && K.get(from) && !K.get(key)) K.set(key, { ...K.get(from), tint, ...o }); };
    cell('prUpper', 'rubble', [1.12, 1.08, 0.99], { seed: 0.6 }); cell('prUpperN', 'rubble', [1.22, 1.18, 1.1], { seed: 0.6 });
    cell('prStreet', 'rubble', [0.6, 0.59, 0.56], { seed: 2.6 }); cell('prStreetUp', 'rubble', [0.8, 0.78, 0.73], { seed: 2.0 });
    cell('prRidge', 'terracotta', [0.42, 0.2, 0.15]);
    // the roofs: red-brown clay tiles, weathered dull (the satellite view, the owner's photograph of the Cottages' east
    // building beside them): a browner, darker copy of the kit's `clayTile`, which reads bright orange in the sun
    cell('prTile', 'clayTile', [1.02, 0.6, 0.47]);
    const atlas = signAtlas();
    const signs = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.6, emissive: 0xfff0d8, emissiveMap: atlas.texture, emissiveIntensity: 0, transparent: true, alphaTest: 0.04, depthWrite: false, side: THREE.DoubleSide });
    try { if (world.registerNight) world.registerNight(signs, 0.3); } catch (e) { /* */ }
    const M = { _pack: pack, signs }, B = new Batch();
    const grp = new THREE.Group(); grp.name = 'worcester-pumpranges';
    world.addStatic(grp);
    /** iron wall lantern on a bracket at local (u, v), the wall's outward normal (nu, nv): returns where its light is */
    const lantern = (Bt, u, y, v, nu, nv, out = 0.42) => {
      const cu = u + nu * out, cv = v + nv * out;
      Bt.beam('iron', [u, y + 0.5, v], [cu, y + 0.5, cv], 0.035); Bt.beam('iron', [u, y + 0.15, v], [cu - nu * 0.1, y + 0.48, cv - nv * 0.1], 0.025);
      Bt.box('iron', cu, y + 0.44, cv, 0.26, 0.04, 0.26); Bt.box('lampGlass', cu, y + 0.26, cv, 0.2, 0.34, 0.2, 0, { top: false }); Bt.box('iron', cu, y + 0.07, cv, 0.22, 0.04, 0.22);
      return [cu, y + 0.26, cv];
    };
    let lamps = [], n0 = 0;
    B.push(frame(FR.c0[0], 0, FR.c0[1], FR.cos, -FR.sin));      // the college's local frame: x = u, z = v
    try { lamps = buildRanges(B, { atlas, lantern }).lamps; } catch (e) { console.error('[worcester_pumpranges] build', e); while (B.stack.length > 1) B.pop(); }
    B.pop(); n0 = B.tris();
    // THE DRAWN GROUND (world/terrain.js lifts every vertex by the surveyed height under it): the ranges stand RIGID at
    // the core's datum, each vertex built higher by what the field under it falls short of 61.05 mOD — nothing inside
    // the core's level polygon, the whole fall across its rim on the garden and kitchen-yard sides. Geometry so
    // corrected is marked draped: the world's draping pass must not cut it along its lattice and hang it on the field.
    const D0 = WORC_LEVELS.datumOD - 58, TH = typeof world.terrainHeight === 'function' ? (x, z) => { const h = world.terrainHeight(x, z); return Number.isFinite(h) ? h : D0; } : null;
    const corr = (x, z) => (TH ? D0 - TH(x, z) : 0);
    const meshes = B.build(M, grp, { pack, noCast: new Set(['signs']), base: (x, z) => { const q = W2L(x, z); return rangesGround(q[0], q[1]) + corr(x, z); } });
    let moved = 0;
    for (const m of meshes) {
      const p = m.geometry.attributes.position;
      if (TH) for (let i = 0; i < p.count; i++) { const d = corr(p.getX(i), p.getZ(i)); if (Math.abs(d) > 1e-4) { p.setY(i, p.getY(i) + d); moved++; } }
      p.needsUpdate = true; m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox(); m.geometry.userData.terrainDraped = true;
    }
    // colliders: one closed ring round everything built (the pigeonhole room's doorway is a passage through it:
    // core/interiors.js), the return at the Cottages' gable, the chimney breast in the kitchen yard
    const seg = (a, b, tag = 'building') => { const p = L2W(a[0], a[1]), q = L2W(b[0], b[1]); col.addSegment(p[0], p[1], q[0], q[1], { tag }); };
    for (let i = 0; i < RING.length; i++) seg(RING[i], RING[(i + 1) % RING.length]);
    seg([2.75, 29.3], [2.75, front(2.75)]); seg([16.0, back(16.0)], [16.0, back(16.0) + 0.7]); seg([16.0, back(16.0) + 0.7], [17.3, back(17.3) + 0.7]); seg([17.3, back(17.3) + 0.7], [17.3, back(17.3)]);
    if (world.clearArea) { try { world.clearArea(RING.map((p) => L2W(p[0], p[1]))); } catch (e) { /* */ } }
    // every lantern modelled here gives its own light (the owner: "real lanterns where they really are")
    const glows = [];
    for (const [u, y, v] of lamps) { const p = L2W(u, v), yy = y + corr(p[0], p[1]); glows.push([p[0], yy, p[1]]); try { if (world.addLampGlow) world.addLampGlow(p[0], yy, p[1]); } catch (e) { /* */ } }
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
    game.worcesterPumpRanges = { on: true, group: grp, meshes: meshes.length, tris, built: n0, moved, plan: RG, ring: RING, ways: WAYS, doors: STAIR_DOORS, openings: RANGE_OPENINGS, lamps: glows, checked: CHECKED, corr, ground: rangesGround, front, back, eastU };
    console.log(`[gto] worcester_pumpranges: ${meshes.length} meshes, ${Math.round(tris)} triangles`);
    return null;
  },
};
