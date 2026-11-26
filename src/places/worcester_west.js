// Worcester College, the far north-west corner by the Oxford Canal (2026-11-22; batch 4 of the north side = package G
// of docs/research/worcester_survey.md): hand-built in the college's atlas in place of the generic blocks the city
// builder made of them.
//
//   Canal Building        (1994; map w93711465) the cranked range of student rooms on the old Corporation Wharf: buff
//                         stock brick banded in red, two red cross wings, gablets with triangular glazing on the
//                         eaves, a timber oriel, the porch under a buff arch, slate roofs.          (_wwest_canal.js)
//   42 Nelson Street      (1973-74; w301621500) the graduate flats: two three-storey blocks of dark red-brown brick
//                         under low pyramid roofs and the link between them, recessed balconies with concrete edges
//                         to the street.
//   Gate 4                across the end of Nelson Street: the tall grey boarded gates with their "4" between banded
//                         red-brick piers, the 2014 pedestrian door in its brick surround, the black sliding gate to
//                         the flats' car park, the red wall along the street with the yard's doors. All shut: it is
//                         not a way in.
//   round the car park    the rubble wall with its half-round coping, the bicycle shelter behind it, the sub-station,
//                         boarded fences, the field gate to the college grounds.                     (_wwest_site.js)
//
// SOURCES (looked at, never copied or used as textures; local `reference/worcester/`): `19 canal building and nelson
// street flats` (the college's 2023 photograph of the Canal Building's south side; planning file 14/00285/FUL: the
// elevation, the layout plan and three photographs of Gate 4 and the flats), `36 playing fields…` (the Ordnance Survey
// base of the 2019 nets plan; the 2014 site plan of the tennis courts), the 2022 Environment Agency height survey;
// and, from the second pass, four Street View pictures of May 2026 (`reference/streetview/nelson street - …`, `st
// barnabas street - …`) and the 2026 satellite picture (`40 satellite (google maps)/canal building and 42 nelson street…`).
// What is KNOWN (K) and what is a GUESS (G) is in ATTR below, attribute by attribute. Heights are above the ground
// beside each thing (the one table: _wwest_plan.js LV); the ground itself is the terrain's.
// `?wwest=0` (node: GTO_WWEST=0) turns the whole pass off for before / after pictures.
import * as THREE from 'three';
import { Batch, makePack } from './_worcester_kit.js';
import { offsetRing } from './_worcester_south_kit.js';
import { WEST_ON as ON, CANAL_ID, FLATS_ID, LV, CB, CP, FL, G4, NW, SG, WL, CPK, BOUNDARY, NODES, ROUTES, FOOTPRINTS, areas, canalRing, wallEnd } from './_wwest_plan.js';
import { buildCanal } from './_wwest_canal.js';
import { buildFlats, buildGate4, buildBikes, buildYard, bikeSpots } from './_wwest_site.js';

const OLD_WALL_ID = 'worc:west:old-boundary-wall', WALL_ID = 'w1317537478', HEDGE_ID = 'w251686321', GC_WALL_ID = 'w814561051', WAY_ID = 'w251686320';
/** one row a building, the form of worcester_streets.js: [id, K | G, what] (K: its main front is from a named picture) */
export const CHECKED = [
  [CANAL_ID, 'K', 'Canal Building: outline from the Ordnance Survey plan; the south (college) side from the college\'s 2023 photograph, the planning photographs and the May 2026 street pictures; the red east gable and the north-east bay\'s gable from the 2026 street pictures; roof, ridge and gablet count from the height survey and the 2026 satellite picture; the rest of the north side and the west end a guess'],
  [FLATS_ID, 'K', '42 Nelson Street: the two blocks and the link from the Ordnance Survey plan and the map; their pyramid roofs from the 2026 satellite picture and the height survey; the street face of the north block from the 2013-14 planning photograph, the link\'s street face, the brick and the brown frames from the May 2026 street picture (under scaffold then: built without it); the other faces a guess'],
  ['gate4', 'K', 'Gate 4: the gates, piers and door from the 2013 elevation and layout plan, the planning photograph and the May 2026 street pictures (grey paint, the "4" plate, the door\'s flat-topped surround, the black sliding gate, the red wall with its banded pier, swept rise and yard doors, three bicycles against it); the gates stand where the map has its gate n12194122166'],
];
/** attribute by attribute: [K | G, the picture, plan or measurement it rests on] */
export const ATTR = {
  [CANAL_ID]: {
    position: ['K', 'the map\'s outline (its four end corners); by roof shape it lies about 1.5 m west and 1.0 m north of the height survey'],
    outline: ['K', '36/PLAN cricket nets site plan with OS base… (OS MasterMap 2019): two wings of 29.4 m at 65.8 degrees and 20.4 m at 55.5 degrees, 11.65 and 12.05 m deep; the map\'s outline has the bays 1 m shallow'],
    crossWings: ['K', 'the same plan: a wing 5.0 m wide standing 1.84 m out to the south and 2.75 m to the north of the west range; the porch bay 4.75 m wide, 1.74 m out; a north bay 4.5 x 3.25 m; a 4.1 x 1.7 m projection on the west end'],
    storeys: ['K', '19/canal building - south (college) side close… (college website 2023): two storeys and attic rooms; three storeys in the tall wing\'s gable'],
    eaves: ['K', 'the same photograph, by brick courses: 5.4 m (the survey\'s 6.6 m was the height survey\'s edge cells; its sections fit a 33 degree roof from 5.4 m at the walls)'],
    ridge: ['K', 'height survey: 9.1 - 9.2 m on both wings; the cross wings\' ridges 9.0 - 9.1 m'],
    walls: ['K', 'the 2023 photograph: yellow-buff stock brick on a red plinth, red flat arches, a red band and corbel course under the eaves; the cross wings red with buff bands'],
    windows: ['K', 'the same: white casements of one, two and three lights with a transom; which bay has which between the wing and the porch; three first-floor casements east of the porch (2026 street pictures)'],
    windowsWestOfWing: ['G', 'the stretch west of the tall wing is hidden in the photograph: three bays like the rest'],
    oriel: ['K', 'the same: a white timber oriel of three lights on two shaped brackets at the first floor, its gable boarded white under dark bargeboards'],
    gablets: ['K', 'the 2023 photograph, the 2026 street pictures (white fronts) and the 2026 satellite picture (40 satellite/canal building and 42 nelson street…): on the south slope two east of the porch, one between porch and bend, two and the oriel\'s own west of the bend, one seen west of the tall wing (a second there under tree shadow: G); on the north slope one, one, two and one'],
    tallWing: ['K', 'the 2023 photograph: red brick, a buff band at the ground-floor heads, narrow lights, a balconette before the attic door, a rooflight on its east slope, the flagpole on the gable'],
    porch: ['K', 'the same: on the bay\'s front a narrow open slot with a sill, a pier, and the buff segmental arch springing from it; buff bands at the springing and near the foot; dark doors in the wall behind, a round light on the ceiling, a wide white box window over the arch. The arch\'s east end is beyond the photograph\'s edge: its span (2.55 m) G'],
    porchGable: ['K', '2026 street pictures (the bay seen from the east over the street wall): a red gable as high as the main ridge with a small white window in it; a narrow first-floor light in the bay\'s east side. 9.0 m by the height survey'],
    eastOfPorch: ['K', '2026 street pictures and planning photograph p1: buff upper storey with its red band, three first-floor casements, two white-fronted gablets between them, rooflights at the east end; the ground floor is hidden by the street wall (G)'],
    roof: ['K', 'the photographs and the 2026 satellite picture: dark slate, cranked, one ridge along each wing, gabled at both ends, gabled cross roofs over the four bays, rooflights mostly near the east end'],
    treeNorth: ['K', 'height survey and the 2026 pictures: one big tree north of the west range\'s north bay, crown to 15 m; and a dense evergreen about 5 m high against the north-east bay\'s west side (the height survey\'s 4.5 m flat-topped thing). Their kinds a guess'],
    northBay: ['K', 'streetview/st barnabas street - canal building north side glimpse… (May 2026): the east range\'s north bay is a red gable with buff quoins and a buff band, a white French window with a white Juliet railing at the first floor, an oval window in a ring of buff brick below; 5.4 / 7.5 m by the height survey'],
    northSide: ['G', 'the rest of it (hidden by the evergreen and the trees in every picture): plain bays of two-light casements, a back door; the west range\'s north bay as a gabled red wing (9.0 m by the height survey)'],
    eastGable: ['K', '2026 street pictures: red brick (seen edge-on at the end of the buff range); planning photograph p2: a white box window at the first floor with a window over it. Its ground floor, behind the street wall: G'],
    westEnd: ['G', 'a buff gable with two windows to a floor; its projection as a red gabled bay (height survey 6.5 - 8.5 m). The towpath view shows only tree tops'],
    ground: ['K', 'the 2023 photograph and the 2026 satellite picture: block paving (drawn with the city\'s setts), a bed of tall pale grasses at the wall\'s foot; OS 2019: made ground all round, a planted strip east of the porch'],
  },
  [FLATS_ID]: {
    position: ['K', 'the map\'s outline for the north block and the link; the height survey agrees to 1 m'],
    plan: ['K', 'OS MasterMap 2019 and the 2014 tennis courts site plan: two blocks at 22 degrees joined by a link set back 2.3 m from the street face; the south block 6.6 x 8.7 m (the map draws it 7.8 x 9.8)'],
    height: ['K', 'height survey: eaves about 8.1 m, the two roofs rising to 9.2 and 9.3 m at their middles (it was read as a flat top at 8.2 - 9.1 m): three storeys'],
    streetFace: ['K', '19/gate 4 and 42 nelson street - site photographs… p3 (2013-14): a pier with a grey downpipe, recessed balconies with concrete edges and brick fronts, the blank block with dark boarded store doors on a step, a globe light; streetview/nelson street - 42 nelson street north block under scaffold… (May 2026): dark red-brown brick, a lean-to canopy over the store at the foot'],
    number: ['K', 'the same photograph: a small dark plate with "42" left of the store doors'],
    link: ['K', 'the May 2026 street picture: on the set-back wall a strip of lights at each floor\'s head with a tall light at its west end, brown frames (the top floor\'s is behind the scaffold boards: as the two below); the 2013-14 photograph: its downpipe. The entrance on the car park side: G'],
    otherFaces: ['G', 'bays of brown-framed windows under concrete lintels'],
    roof: ['K', '40 satellite/canal building and 42 nelson street satellite… (2026): each block under a pyramid roof of dark slate with a pale cap at the point; the link\'s roof lower and flat (its form: G)'],
  },
  gate4: {
    position: ['K', 'the map\'s gate n12194122166 and wall w1317537478 (16.8 degrees west of north); the OS plan has the same line 6.2 m long across the street\'s end'],
    whichMapGate: ['K', 'the layout plan: the boarded pair closes the carriageway, the door stands at the end of the south pavement; so n12194122166 is the pair, n12194122167 the door. The map\'s other gate n2578689351 is not at a gate: the footway it stands on is the way through the rubble wall'],
    gates: ['K', '19/gate 4 - elevation… (1:50), photograph p2 and the May 2026 street pictures: a pair 3.57 m wide of vertical boards painted grey, 2.52 m at the hinges sweeping down to 2.30 m at the meeting stiles, a dark bar, and a dark plate with a white "4" at the top corner of the SOUTH leaf (the left one from the street)'],
    piers: ['K', 'the same: red brick 0.6 m square on a wider plinth, buff bands, stone caps, 2.83 m to the top; one each side of the pair (the 2013 drawing\'s rebuilt end pier south of the door is not there in 2026: the door\'s surround is flat-topped)'],
    door: ['K', 'the elevation and the May 2026 street pictures: a grey door 2.425 m high with a dark notice, in its own red-brick surround 2.52 m high with a brick coping, south of the pair\'s south pier'],
    slidingGate: ['K', 'the elevation and plan (a gate 3,999 mm wide sliding behind 3,930 mm of fixed fence, 2.0 m high, from the door\'s surround down beside the flats) and the May 2026 street pictures: black upright bars between rails, flat-topped'],
    northWall: ['K', 'the May 2026 street pictures: from the pair\'s north pier a red wall about 2.25 m high with a buff band and a brick coping (bicycles lean on it), a banded stone-capped pier some 6 m on, a swept rise to about 3.3 m and in the tall stretch a second pair of grey boarded doors (to the yard east of the Canal Building) with black strap hinges; then a rubble stub. Hand-built on the mapped wall\'s line; its short return in the line of the gates is the map\'s (its street is 1.5 m wider than the real one)'],
    shut: ['K', 'the 1993 permission ("maintenance access from Nelson St") and the 2013 elevation ("new security door", "new sliding security gate"): not a public way in'],
  },
  yard: {
    rubbleWall: ['K', 'photograph p1 and the shelter\'s section: coursed rubble 1.85 m high under a half-round coping, from the end pier west along the old boundary (OS: 21.7 degrees south of west)'],
    brickEnd: ['K', 'the 2013 layout plan: the wall\'s end taken down and rebuilt in brick for 2.1 m (drawn on the wall\'s own line: the plan sets it 0.8 m north)'],
    wallGap: ['K', 'the layout plan: "existing pedestrian access to The Canal Building", a gap 1.05 m wide 3.7 m from the pier'],
    shelter: ['K', 'the section (a roof 1.5 m deep at 2.15 m on posts before the wall), OS 2019 (a strip 19.7 m long on the wall\'s north side), height survey (2.3 m from 5 m west of the pier), the 2026 satellite picture (its roof from about 3.5 m west of the gates for 8.5 m, then under trees); it is not seen from the street. Bicycle hoops under it: G'],
    substation: ['K', 'OS 2019 "ESS": 3.8 x 3.5 m against the wall\'s south side; its brick walls and green kiosk: G'],
    carPark: ['K', 'photographs p2, p3: tarmac, entered over 42\'s concrete forecourt; its west and south fences on the lines of the 2014 site plan: upright timber pales about 1.8 m (p3; 39/leaf pit path at the top of the field… 2014, which looks east along the old wall to the west fence with the flats beyond)'],
    oldWall: ['K', '39/leaf pit path at the top of the field - stone boundary wall (gardeners blog 2014): the old boundary west of the sub-station is a coursed-rubble wall about 1.7 m with a rough flat top; on the OS line. The black railings seen beyond it in that picture are not built (what they stand on: G)'],
    fieldGate: ['K', 'the 2014 tennis courts site plan: a pair of gates 2.5 m wide in the south boundary 2.7 m west of the flats\' corner, the track beyond crossing the ditch by a culvert; THE OWNER, 2026-11-22: "you can get through" (so it stands open)'],
    fieldGateLook: ['G', 'what the gates are: timber five-bar leaves'],
    planting: ['G', 'shrubs in the car park\'s south-west corner (the height survey has things 2 - 5 m there; the 2013 plan a "flower bed")'],
    bins: ['K', 'wheelie bins by the north pier and before the flats in all three planning photographs'],
    bicycles: ['K', 'streetview/nelson street - gate 4 and canal building east end, heading 260 (may 2026).jpg and streetview/nelson street - gate 4, red wall, garage doors, canal building east gable, heading 290 (may 2026).jpg: three against the low stretch of the red wall. By the gate a black one with a basket on its bars and a dark red one with a yellow pannier, side by side along the wall, both facing east; some two metres on a pale blue one standing nose-in. Props with low colliders, not ridden'],
  },
};
/** only right in today's flat world: to be looked at again when the drawn terrain carries the real levels */
export const TEMPORARY = [
  'everything stands on the drawn ground as it is (y 0): the height survey has 57.6 m at the end of Nelson Street and on the forecourt, 57.4 m in the car park, 57.7 - 57.8 m at the building\'s west end; no step is built',
  'the field gate opens on flat ground: the real track goes down to a culvert over the ditch 3 - 4 m beyond it (56.4 - 56.8 m in the 2014 site plan); the ditch is the grounds\' and is not dug',
  'the Canal Building is 50 m long on ground the survey has falling 0.2 m east to west: one eaves line, as built',
];
export { FOOTPRINTS, LV };

const TREE = [-650.3, -231.3, 15, 'broad'];
const near = (p, q, d) => !!p && Math.hypot(p[0] - q[0], p[1] - q[1]) < d;

export default {
  id: 'worcester_west',
  site: { x: -638, z: -220, r: 46 },      // (for the crop switch, core/_crop.js)
  preMap(game) {
    if (!ON || game.worcesterWest) return;
    try {
      const ov = game.overrides, map = game.map; if (!map) return;
      const done = { areas: 0, barriers: [], nodes: [], routes: [] };
      ov.skip.add(CANAL_ID); ov.skip.add(FLATS_ID);
      if (map.areas) for (const a of areas()) { map.areas.push({ ...a, poly: a.poly.map((p) => p.slice()) }); done.areas++; }
      if (map.barriers) {
        // the mapped wall round the Canal Building's east yard: its street side (the line of the gates and the red wall
        // along the street) is built here; what is left of it is the yard's east side against No. 43's garden (a rubble stub)
        const w = map.barriers.find((b) => b.id === WALL_ID), i = w && w.pts ? w.pts.findIndex((p) => near(p, NW.end, 0.6)) : -1;
        if (i > 0 && i < w.pts.length - 1) { w.pts = w.pts.slice(0, i + 1).map((p) => p.slice()); w.h = LV.gate.eastWall; w.rubble = true; done.barriers.push(WALL_ID); }      // (a height of its own: the city builder lowers garden walls of the default height beside a street)
        // the old boundary: the rubble wall and the shelter stand on its first 19 m (built here); from there to the
        // corner of the leaf-pit yard it is a plainer rubble wall (the gardeners' 2014 picture) on the line the Ordnance
        // Survey has; the map's hedge (or fence: places/worcester_bounds.js) begins where that ends
        let led = false;
        for (const id of [HEDGE_ID + ':canal', HEDGE_ID]) {
          const h = map.barriers.find((b) => b.id === id);
          if (h && h.pts && h.pts.length > 3 && near(h.pts[0], [-619.7, -217.2], 1) && near(h.pts[1], [-632.2, -211.8], 1)) { h.pts = [BOUNDARY[BOUNDARY.length - 1].slice(), ...h.pts.slice(2)]; done.barriers.push(id); led = true; }
        }
        if (led && !map.barriers.some((b) => b.id === OLD_WALL_ID)) { map.barriers.push({ id: OLD_WALL_ID, kind: 'wall', h: LV.wall.old, rubble: true, pts: [wallEnd(), ...BOUNDARY.map((p) => p.slice())] }); done.barriers.push(OLD_WALL_ID); }
        // the wall on Great Clarendon Street starts at the north bay's corner (OS), 2.6 m west of where the map ends it
        const g = map.barriers.find((b) => b.id === GC_WALL_ID);
        if (g && g.pts && near(g.pts[g.pts.length - 1], [-634.6, -238.2], 0.8)) { g.pts = [...g.pts.slice(0, -1).map((p) => p.slice()), [+(CP.S[0] + 0.25).toFixed(2), +(CP.S[1] - 0.12).toFixed(2)]]; done.barriers.push(GC_WALL_ID); }
      }
      // the three map nodes: the pair of gates is shut (no opening is cut and no way through is left at it), the
      // door's node stands at the door, the inner "gate" at the gap in the rubble wall, which is simply open
      for (const g of map.gates || []) {
        if (g.id === NODES.gate4 && g.kind === 'gate') { g.kind = 'gate_shut'; done.nodes.push(g.id); }
        else if (g.id === NODES.door) { const p = G4.F.pt((G4.door[0] + G4.door[1]) / 2, 0); g.p = [+p[0].toFixed(2), +p[1].toFixed(2)]; ov.skip.add(g.id); done.nodes.push(g.id); }      // (a locked door in a wall, not a house door on a pavement: skipped as an entrance)
        else if (g.id === NODES.inner && g.kind === 'gate') { const p = WL.F.pt((WL.gap[0] + WL.gap[1]) / 2, 0); g.p = [+p[0].toFixed(2), +p[1].toFixed(2)]; g.kind = 'gap'; done.nodes.push(g.id); }
      }
      // the two private footways, led the way people walk; the one inside lies on this module's own paving
      for (const [id, fn] of Object.entries(ROUTES)) { const r = map.roads && map.roads.find((x) => x.id === id); if (r && r.pts && r.pts.length > 1) { r.pts = fn(r.pts.map((q) => q.slice())); done.routes.push(id); } }
      ov.skip.add(WAY_ID);
      // the big tree north of the west range (height survey: a crown 12 m across, 15 m high, over the drive)
      if (map.trees && !map.trees.some((t) => near(t, TREE, 3))) { map.trees.push(TREE.slice()); done.trees = 1; }
      game.worcesterWest = { on: true, pre: done };
    } catch (e) { console.error('[worcester_west] preMap', e); }
  },
  install(game) {
    const WW = game.worcesterWest; if (!ON || !WW || !WW.on) return null;
    try { return install(game, WW); } catch (e) { console.error('[worcester_west] install', e); return null; }
  },
};

function install(game, WW) {
  const world = game.world;
  const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
  const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  // colours the college's atlas did not have: tinted copies of its cells
  const K = pack.cells, cell = (key, from, tint) => { if (K && K.get(from) && !K.get(key)) K.set(key, { ...K.get(from), tint: Array.isArray(tint) ? tint : lin(tint) }); };
  cell('wwBuff', 'buff', [1.0, 0.9, 0.66]); cell('wwRed', 'redBrick', [0.98, 0.8, 0.68]); cell('wwSlate', 'slate', [0.66, 0.68, 0.7]); cell('wwDark', 'frame', 0x25272a);
  cell('wwFlat', 'redBrick', [0.6, 0.5, 0.47]); cell('wwFlatD', 'redBrick', [0.4, 0.33, 0.31]); cell('wwBrown', 'frame', 0x3d2b23); cell('wwMaroon', 'frame', 0x5a2634); cell('wwBikeB', 'lead', 0x7f9cc0); cell('wwConc', 'plaster', 0xb3aea2); cell('wwDeck', 'lead', 0x8a8c8a); cell('wwStain', 'boards', [0.2, 0.13, 0.09]);
  cell('wwGate', 'boards', [0.62, 0.63, 0.67]); cell('wwGalv', 'lead', 0x9aa2a6); cell('wwSheet', 'lead', 0x767a78); cell('wwEss', 'frame', 0x35543f); cell('wwFence', 'boards', 0x8b8e74); cell('wwGrass', 'plaster', 0xcbbd96);
  const M = { _pack: pack };
  const B = new Batch();
  const grp = new THREE.Group(); grp.name = 'worcester-west';
  world.addStatic(grp);
  const parts = [['Canal Building', buildCanal], ['42 Nelson Street', buildFlats], ['Gate 4', buildGate4], ['bicycles', buildBikes], ['car park and shelter', buildYard]];
  const built = {};
  for (const [what, fn] of parts) { const n0 = B.tris(), depth = B.stack.length; try { fn(game, B); } catch (e) { console.error('[worcester_west] ' + what, e); while (B.stack.length > depth) B.pop(); } built[what] = Math.round(B.tris() - n0); }
  // generated trees and street furniture that would stand in what is now built or paved go
  if (world.clearArea) {
    const clear = (ring, d, o) => { try { world.clearArea(d ? offsetRing(ring, d) : ring, o); } catch (e) { /* */ } };
    clear(canalRing(), 0.8); clear(FL.nbRing, 0.5); clear(FL.sbRing, 0.5); clear(FL.link, 0.3);
    clear([G4.F.pt(-0.5, -1.2), G4.F.pt(9, -1.2), G4.F.pt(9, 1.6), G4.F.pt(-0.5, 1.6)], 0); clear([NW.A.pt(-0.5, -0.9), NW.B.pt(NW.lenB + 0.3, -0.9), NW.B.pt(NW.lenB + 0.3, 1.2), NW.A.pt(-0.5, 1.2)], 0, { lamps: false });
    clear([WL.F.pt(0, -0.6), WL.F.pt(WL.end + 0.3, -0.6), WL.F.pt(WL.end + 0.3, 2.2), WL.F.pt(0, 2.2)], 0);
    for (const a of areas()) if (a.kind === 'paved' || a.bed) clear(a.poly, 0, a.bed ? { trees: false } : { lamps: false });      // (no measured tree stands on the paving: tools/smoke_worc_west.mjs)
  }
  const meshes = B.build(M, grp, { pack, noCast: new Set(['signs']), chunk: (x, z) => (x < -646 ? 0 : x < -622.4 && z < -212.5 ? 1 : 2) });
  const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
  Object.assign(WW, { tris, meshes: meshes.length, built, checked: CHECKED, attr: ATTR, temporary: TEMPORARY, footprints: FOOTPRINTS, levels: LV, group: grp, plan: { canal: CB, corners: CP, flats: FL, gate: G4, northWall: NW, bikes: bikeSpots(), sliding: SG, wall: WL, carPark: CPK } });
  console.log(`[gto] worcester_west: ${meshes.length} meshes, ${Math.round(tris)} triangles`, JSON.stringify(built));
  const pp = game.player.pos; let vis = true;
  return { id: 'worcester_west', update() { const e = game.eye || pp, dx = e.x + 640, dz = e.z + 218, show = game.player.place === 'world' && dx * dx + dz * dz < 520 * 520; if (show !== vis) { vis = show; grp.visible = show; } } };
}
