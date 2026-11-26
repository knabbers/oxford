// Worcester College gardens, the rest (places/worcester_gardens.js; second pass 2026-11-22, work packages I and K of
// docs/research/worcester_survey.md): the car park's and the Orchard's clipped hedges, the Fellows' Garden's borders,
// the Provost's Garden's box hedges and meadow, the benches (map benches: they can be sat on), the lamp standards a
// picture shows, the stone gateway at the Hanging Garden's foot. Plan first (pure), then what is drawn into the
// college's Batch and the grounds' plants (_wgard_plants.js).
import { PK, LEAFS, hash as ph } from './_wgard_plants.js';
import { frame, tudorPts } from './_worcester_kit.js';
import { L2W, HG, border } from './_wgard_build.js';

// ------------------------------------------------------------------------------------------------ hedges by the car park
// K (the 2022 height survey): a straight mass 4 - 5 m high and 3 m thick along the car park's south edge from about
// (-262, -56) to (-237, -53): the "giant yew hedge" (`33…/car park - the giant yew hedge being cut` 2016; it is the dark
// flat-topped hedge across the back of `…golden privet wave hedge…` 2012, in front of the Terrace). K (`…laurel cushion
// hedge, lamp post, nash building beyond` 2016): a clipped drum of laurel about 5.5 m across and 1.75 m high with a
// young many-stemmed tree growing out of it and a black cast-iron lamp standard at its end, a clipped yew block beside
// it; the height survey has such a thing with a 5 m tree at (-268.2, -62.2), at the corner the map's yew hedge turns
// (I: that is it). K (the 2012 picture): the golden privet "wave", 2.6 m high, billowing, on the west side of the
// gravel way from the nursery yard to the car park's north-east corner (the height survey has 2 - 4 m there); the
// "caterpillar" privet in front of the greenhouse (`…caterpillar privet hedge in front of the greenhouse` 2016; height
// survey 1.5 - 3 m along the greenhouse's south side).
export const YEW = { a: [-262.4, -56.3], b: [-237.6, -53.2], w: 2.4, h: 4.5 };
export const CUSHION = { c: [-268.2, -62.2], r: 2.7, h: 1.75, lamp: [-271.5, -62.7] };
export const WAVE = { pts: [[-247.9, -98.6], [-247.5, -94.0], [-247.0, -89.5], [-246.7, -86.6]], w: 1.7, h: 2.6 };
export const CATERPILLAR = { a: [-263.4, -87.5], b: [-250.4, -88.7], w: 1.1, h: 1.35 };

// ------------------------------------------------------------------------------------------------ Fellows' Garden (G04)
// K (Register of Parks and Gardens; `32 fellows garden/`): lawn, a curved perimeter path of hoggin (the map's),
// informal planting against the walls, a shrub border between path and wall, a large strawberry tree against a wall,
// a wildflower patch, Adirondack chairs and a picnic table. G: where the tree, the patch and the chairs are.
export const FELLOWS = {
  north: [[-262.6, -44.9], [-253.6, -46.9], [-244.0, -46.3], [-229.2, -42.9]],      // the foot of the wall to Provost's Drive, inside (the wall: map barrier w999276231)
  east: [[-227.9, -41.0], [-226.3, -19.5]],                                           // the Walton Street wall's foot, inside
  tree: [-229.8, -30.5, 6.5], patch: { c: [-262.5, -28.5], rx: 4.2, rz: 2.6 }, chairs: [[-251.5, -31.5, 0.4], [-249.6, -30.9, -0.5]], table: [-246.5, -35.2],
};

// ------------------------------------------------------------------------------------------------ Provost's Garden (G03)
// K (Register; gardeners' blog): low clipped box hedges at the Lodgings' foot; a long-grass bulb meadow of 2015 by the
// shepherd's hut. G: the hedges' plan (a low edging either side of the garden stair, college frame u, v) and the
// meadow's outline (round the hut, _wgard_build.js HUT).
export const BOX = [[[-67.4, -34.6], [-67.4, -28.6]], [[-67.4, -22.4], [-67.4, -16.4]], [[-67.4, -34.6], [-65.9, -34.6]], [[-67.4, -16.4], [-65.9, -16.4]], [[-67.4, -28.6], [-65.9, -28.6]], [[-67.4, -22.4], [-65.9, -22.4]]];
export const MEADOW = { c: [-368.5, 14.5], rx: 10.5, rz: 6.5 };

// ------------------------------------------------------------------------------------------------ benches, lamps
// K (`34…/worcester college memorials map…png`, the college's own, an axonometric: places to about 8 m; the Orchard's
// in `33…/memorial bench against the rubble wall`, `…facing the orchard meadow`; the Nuffield Lawn's in `34…/nuffield
// lawn - bench and specimen trees…`, `…under the great plane with a bench`; the pavilion's in `20…/pavilion - front in
// 2013… benches on the grass`): slatted teak benches standing on the grass. They are MAP benches (the city's own, which
// can be sat on); each faces the nearest path. The numbers are the memorials map's. Not here: 10 (the Shah Centre's
// front) and 11 (the Sainsbury Building's lakeside), which stand in other modules' precincts.
export const BENCHES = [
  [-257.6, 51.6, '1 Daniel Levy'], [-301.0, 98.0, '2 Margaret & Claude Soares'], [-396.5, 43.2, '3 Dr Derek Goldfoot'], [-409.5, 47.6, '4 Ben Showell'],
  [-453.5, 25.5, '5 John Douglas Pinto'], [-486.0, -19.5, '6 John Doyle'], [-509.5, -41.5, '7 Luke Westell'], [-514.0, -31.0, '8 James Smith'], [-455.5, -47.5, '9 JT Cross & JD Bradshaw'],
  [-337.5, -64.5, '12 Lucy Butler Vaizey'], [-346.5, -78.0, '13 William George Ward'], [-331.0, -95.6, '14 Tsz Yeung Fok'], [-343.0, -92.2, '15 Sam Wilkinson'], [-355.0, -75.0, '16 Jackie Gulliford'], [-379.5, 11.5, '17 Simone Atousa Norowzian'],
  [-333.5, 74.5, 'under the great plane'], [-360.0, 88.0, 'Nuffield Lawn'], [-490.0, -46.5, 'before the pavilion'], [-505.5, -49.5, 'before the pavilion'],
];
/** lamp standards (K: the black cast-iron lantern standard at the laurel cushion; `39…/nelson street path - path beside hedge with lamp post and boundary wall` 2014: that there are lamp posts along that path - G where) */
export const LAMPS = [[CUSHION.lamp[0], CUSHION.lamp[1], 'K'], [-470.0, -176.5, 'G'], [-520.0, -176.0, 'G'], [-570.0, -177.5, 'G']];

// ------------------------------------------------------------------------------------------------ the Hanging Garden's gateway
// K (Register of Parks and Gardens: the lawn's "west end reached from the south lawn below by a set of stone steps";
// a stone gateway beside them leads to the Provost's Garden; list entry 1046607 "Walls in the college gardens …
// Stone, with a four-centred archway"; the college's 2023 map draws a small arched stone doorway with a shaped head at
// the raised walk's west end, facing the Nuffield Lawn's path, a spur of path to it). G: its exact place and size:
// a length of rubble wall carrying on the Hanging Garden's south wall westwards from the foot of the steps, the
// archway 1.2 x 2.1 m in an ashlar frame under a low gable; through it a gravel spur turns to the foot of the steps.
export const HGATE = { x0: -329.6, x1: -325.6, z: HG.zS + 0.06, t: 0.36, h: 2.9, c: -327.6, open: 1.2, spring: 1.7, apex: 2.1 };
export const HGWALK = [[-327.6, 43.72], [-327.6, 41.4], [-327.35, 40.0], [-325.55, 39.98]];      // the spur from the path through the archway to the foot of the steps (the way on to the Provost's Garden lies under the evergreens: not built, its line is not known)

export const CHECKED_MORE = [
  ['car park: the giant yew hedge, 4.5 m, along its south edge', 'K', 'height survey (a mass 4 - 5 m high from (-262, -56) to (-237, -53)); 33/car park - the giant yew hedge being cut (2016), …golden privet wave hedge… (2012: across the back)'],
  ['car park: the laurel cushion with a young tree in it, a black lamp standard at its end', 'K', '33/car park - laurel cushion hedge, lamp post, nash building beyond (2016); where: the height survey\'s 5 m thing at (-268.2, -62.2) where the yew hedge turns (I)'],
  ['car park: the golden privet wave; the caterpillar privet before the greenhouse', 'K', '33/car park - golden privet wave hedge… (2012), …caterpillar privet hedge in front of the greenhouse (2016); height survey; their exact lines: G'],
  ['Fellows\' Garden: shrub borders against the walls, a strawberry tree, a wildflower patch, Adirondack chairs and a picnic table', 'K', 'Register of Parks and Gardens; 32/fellows garden - … (nine pictures); where the tree, the patch and the chairs are: G'],
  ['Fellows\' Garden: the Walton Street wall 4.2 - 4.5 m high on this side', 'K', 'height survey; NOT BUILT: the garden is not sunk until the terrain is drawn'],
  ['Provost\'s Garden: low clipped box hedges at the Lodgings\' foot', 'K', 'Register of Parks and Gardens; their plan: G'],
  ['Provost\'s Garden: long-grass meadow round the shepherd\'s hut', 'K', '31/provosts garden far end - long-grass bulb meadow and shepherds hut (2016), …meadow - tulips, hut, hedge behind (2016); its outline: G'],
  ['benches: slatted teak, on the grass, where the college\'s memorials map puts fifteen of its seventeen', 'K', '34/worcester college memorials map - trees, plaques and benches (2023): places to about 8 m; four more from photographs (the great plane, the lawn, two before the pavilion)'],
  ['lamp standards on the Nelson Street path', 'G', 'K that there are lamp posts along it (39/nelson street path - … 2014); where each stands is not known'],
  ['Hanging Garden: the stone gateway beside the steps into the Provost\'s Garden', 'G', 'K that there is one, four-centred (Register; list entry 1046607; the college\'s 2023 map draws it at the raised walk\'s west end); its place to a few metres and its size: G; the way on from it to the Provost\'s Garden is NOT built (its line under the evergreens is not known)'],
  ['Hanging Garden: the door from the westmost cottage, its trellis porch; the two urns at the tunnel\'s garden mouth', 'K', 'NOT BUILT here: they stand on the core builder\'s ground (31/secret garden above the rose garden… 2015; 05/cottages west end, hanging garden wall… 2011)'],
  ['the ditch round the field (the lake\'s overflow); the canal-side earth path', 'K', 'NOT BUILT: 39/ditch … (three pictures), 36/PLAN cricket nets site plan with OS base ("Drain"): a channel cut 0.6 m into ground the flat world cannot dig without a hole for every stretch; it is the terrain\'s to carry'],
  ['bike sheds, smoking shelters', 'G', 'NOT BUILT: map symbols only (inside Gate 1 and by Staircases 22 - 23), no picture'],
  ['Gates 5 and 6 across Walton Street', 'G', 'NOT BUILT in this pass: they stand in houses the street module draws (Gate 5: the carriage arch of 171 Walton Street, grey boarded gates, a "5" plate, one photograph; Gate 6: no picture)'],
];

// ================================================================================================= what is drawn
/** everything of this file into B (the college's Batch) and PL (the grounds' plants) -> { part: triangles } */
export function buildMore(B, PL) {
  const built = {};
  const part = (name, fn) => { const n0 = B.tris() + PL.tris(), depth = B.stack.length; try { fn(); } catch (e) { console.error('[worcester_gardens] ' + name, e); while (B.stack.length > depth) B.pop(); } built[name] = Math.round(B.tris() + PL.tris() - n0); };
  part('car park hedges', () => {
    PL.hedge([YEW.a, YEW.b], YEW.w, YEW.h, LEAFS.yew, { wave: 0.015, step: 1.6, seed: 5 });
    const C = CUSHION; PL.solid([[0, 0.9], [0.3, 1], [0.78, 0.98], [0.95, 0.8], [1, 0.5]], C.c[0], 0, C.c[1], C.r, C.h, LEAFS.laurelL, { n: 14, lump: 0.05, sz: 0.86 });
    PL.hedge(WAVE.pts, WAVE.w, (s) => WAVE.h * (0.86 + 0.14 * Math.sin(s * 1.9)), LEAFS.gold, { wave: 0.1, step: 0.8, seed: 9 });
    PL.hedge([CATERPILLAR.a, CATERPILLAR.b], CATERPILLAR.w, (s) => CATERPILLAR.h * (0.8 + 0.2 * Math.abs(Math.sin(s * 1.5))), LEAFS.privet, { wave: 0.06, step: 0.7, seed: 13 });
  });
  part('Fellows\' Garden', () => {
    const F = FELLOWS;
    for (let i = 0; i < F.north.length - 1; i++) { const a = F.north[i], b = F.north[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); border(PL, a, b, [(b[1] - a[1]) / l, -(b[0] - a[0]) / l], 2.0, { seed: 40 + i, backScale: 0.85, banana: false }); }
    { const a = F.east[0], b = F.east[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); border(PL, a, b, [(b[1] - a[1]) / l * -1, (b[0] - a[0]) / l], 2.0, { seed: 47, backScale: 0.9, banana: false }); }
    for (let k = 0; k < 46; k++) { const a = ph(k, 1) * 6.283, r = Math.sqrt(ph(k, 2)), x = F.patch.c[0] + Math.cos(a) * r * F.patch.rx, z = F.patch.c[1] + Math.sin(a) * r * F.patch.rz; PL.put(k % 5 === 0 ? 'daisy' : 'meadow', x, 0.03, z, 0.8 + ph(k, 3) * 0.4); }
    // two Adirondack chairs and a picnic table on the lawn
    for (const [x, z, h] of F.chairs) { B.push(frame(x, 0, z, Math.cos(h), Math.sin(h))); B.poly('wood', [[-0.3, 0.32, -0.28], [0.3, 0.32, -0.28], [0.3, 0.2, 0.28], [-0.3, 0.2, 0.28]], [0, 1, 0]); B.poly('wood', [[-0.3, 0.2, 0.26], [0.3, 0.2, 0.26], [0.34, 0.98, 0.56], [-0.34, 0.98, 0.56]], [0, 0.4, -1]); B.poly('wood', [[-0.34, 0.98, 0.56], [0.34, 0.98, 0.56], [0.3, 0.2, 0.26], [-0.3, 0.2, 0.26]], [0, -0.4, 1]); for (const e of [-0.36, 0.36]) { B.boxXZ('wood', e - 0.05, e + 0.05, 0.5, 0.53, -0.3, 0.42, { bottom: true }); B.boxXZ('wood', e - 0.03, e + 0.03, 0, 0.5, -0.3, -0.24, {}); B.boxXZ('wood', e - 0.03, e + 0.03, 0, 0.3, 0.3, 0.36, {}); } B.pop(); }
    { const [x, z] = F.table; B.boxXZ('wood', x - 0.9, x + 0.9, 0.7, 0.75, z - 0.38, z + 0.38, { bottom: true }); for (const e of [-0.62, 0.62]) { B.boxXZ('wood', x - 0.9, x + 0.9, 0.42, 0.46, z + e - 0.13, z + e + 0.13, { bottom: true }); } for (const s of [-0.7, 0.7]) { B.beam('wood', [x + s, 0, z - 0.7], [x + s, 0.72, z - 0.2], 0.06, 0.06); B.beam('wood', [x + s, 0, z + 0.7], [x + s, 0.72, z + 0.2], 0.06, 0.06); B.beam('wood', [x + s, 0.42, z - 0.72], [x + s, 0.42, z + 0.72], 0.05, 0.05); } }
  });
  part('Provost\'s Garden', () => {
    for (const [a, b] of BOX) PL.hedge([L2W(a[0], a[1]), L2W(b[0], b[1])], 0.55, 0.6, LEAFS.box, { wave: 0.02, step: 1.0, seed: a[1] });
    const M = MEADOW; for (let k = 0; k < 190; k++) { const a = ph(k, 11) * 6.283, r = Math.sqrt(ph(k, 12)), x = M.c[0] + Math.cos(a) * r * M.rx, z = M.c[1] + Math.sin(a) * r * M.rz; PL.put(k % 9 === 0 ? 'daisy' : k % 4 === 0 ? 'tawny' : 'meadow', x, 0.03, z, 0.85 + ph(k, 13) * 0.4); }
  });
  part('Hanging Garden gateway', () => {
    const G = HGATE, zf = G.t / 2;
    B.push(frame(G.x0, 0, G.z, 1, 0));      // x east along the wall, z south (its face to the Nuffield Lawn)
    const len = G.x1 - G.x0, c = G.c - G.x0, arch = tudorPts(c, G.open, 0, G.spring, G.apex - G.spring, 8), rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const out = [[0, 0], [len, 0], [len, G.h], [c + 1.0, G.h], [c, G.h + 0.5], [c - 1.0, G.h], [0, G.h]];      // the wall with a low gable over the archway
    B.face('rubble', out, [rect(c - 0.85, 0, c + 0.85, 2.45)], zf); B.face('wgOldStone', rect(c - 0.85, 0, c + 0.85, 2.45), [arch], zf + 0.03); B.reveal('wgOldStone', arch, zf + 0.03, -zf, true);
    B.push(frame(len, 0, 0, -1, 0)); B.face('rubble', out.map((p) => [len - p[0], p[1]]).reverse(), [arch.map((p) => [len - p[0], p[1]]).reverse()], zf); B.pop();
    for (const [x, nx] of [[0, -1], [len, 1]]) B.poly('rubble', [[x, 0, -zf], [x, 0, zf], [x, G.h, zf], [x, G.h, -zf]], [nx, 0, 0]);
    B.poly('wgOldStone', [[0, G.h, -zf - 0.04], [c - 1.0, G.h, -zf - 0.04], [c - 1.0, G.h, zf + 0.04], [0, G.h, zf + 0.04]], [0, 1, 0]); B.poly('wgOldStone', [[c + 1.0, G.h, -zf - 0.04], [len, G.h, -zf - 0.04], [len, G.h, zf + 0.04], [c + 1.0, G.h, zf + 0.04]], [0, 1, 0]);
    for (const e of [-1, 1]) B.poly('wgOldStone', [[c + e * 1.0, G.h, -zf - 0.04], [c, G.h + 0.5, -zf - 0.04], [c, G.h + 0.5, zf + 0.04], [c + e * 1.0, G.h, zf + 0.04]], [e, 1, 0]);
    B.boxXZ('wgOldStone', c - 1.0, c + 1.0, 2.5, 2.6, zf + 0.03, zf + 0.09, { bottom: true });      // a label over the arch
    B.pop();
    // the earth walk through it
    for (let i = 0; i < HGWALK.length - 1; i++) { const a = HGWALK[i], b = HGWALK[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (-(b[1] - a[1]) / l) * 0.6, nz = ((b[0] - a[0]) / l) * 0.6; B.poly('gravel', [[a[0] - nx, 0.047, a[1] - nz], [b[0] - nx, 0.047, b[1] - nz], [b[0] + nx, 0.047, b[1] + nz], [a[0] + nx, 0.047, a[1] + nz]], [0, 1, 0], [[a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz]]); }
    PL.panel(PK.ivy, [G.x0, G.z + zf + 0.05], [G.x0 + 1.5, G.z + zf + 0.05], 1.3, G.h + 0.35, { tint: [0.9, 0.95, 0.85] }); PL.panel(PK.climber, [G.x1 - 1.4, G.z + zf + 0.05], [G.x1, G.z + zf + 0.05], 1.6, G.h + 0.4, { flip: 1 });
  });
  return built;
}

/** what is solid: the hedges, the chairs and table, the gateway's wall either side of its archway */
export function moreColliders(col) {
  const hedge = (a, b, w, h) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (-(b[1] - a[1]) / l) * w / 2, nz = ((b[0] - a[0]) / l) * w / 2, sg = col.addPolygon([[a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz]], { tag: 'hedge' }); if (sg) for (const s of sg) s.h = h; };
  hedge(YEW.a, YEW.b, YEW.w, YEW.h); hedge(CATERPILLAR.a, CATERPILLAR.b, CATERPILLAR.w, CATERPILLAR.h);
  for (let i = 0; i < WAVE.pts.length - 1; i++) hedge(WAVE.pts[i], WAVE.pts[i + 1], WAVE.w, WAVE.h);
  col.addCircle(CUSHION.c[0], CUSHION.c[1], CUSHION.r - 0.15, { tag: 'hedge' });
  for (const [a, b] of BOX) hedge(L2W(a[0], a[1]), L2W(b[0], b[1]), 0.5, 0.6);
  for (const [x, z] of FELLOWS.chairs) col.addCircle(x, z, 0.4, { tag: 'furniture', low: true });
  col.addBox(FELLOWS.table[0], FELLOWS.table[1], 1.8, 1.5, 0, { tag: 'furniture', low: true });
  const G = HGATE; for (const [x0, x1] of [[G.x0, G.c - G.open / 2], [G.c + G.open / 2, G.x1]]) { const sg = col.addPolygon([[x0, G.z - G.t / 2], [x1, G.z - G.t / 2], [x1, G.z + G.t / 2], [x0, G.z + G.t / 2]], { tag: 'wall' }); if (sg) for (const s of sg) s.h = G.h; }
}

/** map benches, lamp standards, the two trees the pictures show (called from the gardens' preMap): ok(x, z) -> may it stand there; skip = game.overrides.skip */
export function morePreMap(map, ok, skip) {
  const out = { benches: 0, lamps: 0, dropped: [] };
  // nothing wild grows on the spur through the gateway (systems/_flora_plan.js leaves a skipped area alone)
  if (skip && !map.areas.some((a) => a.id === 'worc:site-hg-gateway')) { map.areas.unshift({ id: 'worc:site-hg-gateway', kind: 'paved', poly: [[HGATE.x0 - 0.2, HGATE.z - 0.9], [-325.2, HGATE.z - 0.9], [-325.2, HGATE.z + 0.35], [HGATE.c + 0.8, HGATE.z + 0.35], [HGATE.c + 0.8, 43.8], [HGATE.c - 0.8, 43.8], [HGATE.c - 0.8, HGATE.z + 0.35], [HGATE.x0 - 0.2, HGATE.z + 0.35]] }); skip.add('worc:site-hg-gateway'); }
  if (!map.pois) map.pois = [];
  BENCHES.forEach(([x0, z0, name], i) => {
    // (the memorials map places a bench to about 8 m: it stands at the nearest clear spot within 3.6 m of the place read off it)
    let at = null; for (let r = 0; r <= 3.6 && !at; r += 0.6) for (let k = 0; k < (r ? 12 : 1) && !at; k++) { const a = (k / 12) * Math.PI * 2, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r; if (ok(x, z)) at = [+x.toFixed(2), +z.toFixed(2)]; }
    if (at) { map.pois.push({ id: 'worc:bench-' + i, kind: 'bench', p: at, name }); out.benches++; } else out.dropped.push(name);
  });
  LAMPS.forEach(([x, z], i) => { map.pois.push({ id: 'worc:lamp-' + i, kind: 'street_lamp', p: [x, z] }); out.lamps++; });
  map.trees.push([CUSHION.c[0], CUSHION.c[1], 5.2, 'broad'], [FELLOWS.tree[0], FELLOWS.tree[1], FELLOWS.tree[2], 'broad']);
  return out;
}
