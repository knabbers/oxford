// Worcester College on Worcester Place and Richmond Road (2026-11-22; batch 3 of the north side, packages D / E of
// docs/research/worcester_survey.md): the college's buildings on the two legs of Worcester Place, hand-built in the
// college's atlas in place of the generic houses the city builder made of them, and the college's houses in both streets.
//
//   Gloucester House   (c. 1978-79; map w69991353) three blocks of flats in echelon between the Gate 3 drive and the
//                      Earl Building: dark red-brown brick, brown casements, a timber corner window to each flat,
//                      shallow tiled roofs between raised party walls, three stair towers under catslides to the
//                      street behind a 1.9 m wall.                                        (_wplace_gloucester.js)
//   Franks Building    (17A; 1999; w154788906) red brick with buff bands at the inside corner of the two legs:
//                      gabled blocks, wall-gablets, the dark timber oriel over the gated carriage way, planters. (_wplace_franks.js)
//   10 Worcester Place (w304762197) the old red-brick house straight on the pavement, its new back with the white
//                      door up four steps; the yard behind it at Nash Quad's east end with the cobbled circle;
//                      the railed gap between it and Staircase 24; the MCR's yard walls by Gate 3. (_wplace_no10.js)
//   the houses         17 and 22 Worcester Place, 16 / 17 / 19 Richmond Road: the city builder's houses with the
//                      heights, brick and roofs the pictures and the height survey give them (HOUSES below).
//
// SOURCES (looked at, never copied or used as textures; local `reference/worcester/` folders 12, 13, 15, 17, 40 and
// `reference/streetview/`): the 2022 Environment Agency height survey for where things stand and how tall they are;
// ADP's planning drawings of 2005-06; the college's photographs; three street pictures of 2024; three satellite
// pictures. What is KNOWN (K) and what is a GUESS (G) is in ATTR below, attribute by attribute. Heights are above the
// ground beside each building (the one table: _wplace_kit.js LV); the ground itself is the terrain's.
// `?wplace=0` (node: GTO_WPLACE=0) turns the whole pass off for before / after pictures.
import * as THREE from 'three';
import { Batch, makePack } from './_worcester_kit.js';
import { offsetRing } from './_worcester_south_kit.js';
import { WPLACE_ON as ON, W, UV, SF, LV } from './_wplace_kit.js';
import { GH, ghRing, buildGloucester } from './_wplace_gloucester.js';
import { FR, frRings, buildFranks } from './_wplace_franks.js';
import { N10, CIRCLE, GAP, YARD, n10Ring, stepsY, buildNo10, buildCircle, buildGap, buildYard } from './_wplace_no10.js';
import { HOUSES3, buildPair, buildNo23, buildGabled, houseRings } from './_wplace_houses.js';

const GH_ID = 'w69991353', FR_ID = 'w154788906', N10_ID = 'w304762197';
// ---- the college's houses, left to the city builder: [id, style, K | G, what]
const BUFF = [1.4, 2.15, 2.0];      // (the builder's red brick turned to the yellow stock brick of these streets: cf. worcester_streets.js)
const PLAIN = { wall: 'brick', tint: BUFF, ivy: false, storeys: 3, shape: 'gabled', roof: 'slate', up: 'brickSash', ground: 'brickSash', door: 'brickDoor', parapet: false, crenel: false };
const GABLED = { wall: 'brick', tint: BUFF, ivy: false, storeys: 3, shape: 'gabled', roof: 'slate', up: 'brickPair', ground: 'brickSash', door: 'brickDoor', villa: true };
// (third pass: 17 | 18 and 21 | 22 Worcester Place and 16 and 17 Richmond Road are hand-built: HAND below, _wplace_houses.js)
export const HOUSES = [
  ['w301621497', { ...PLAIN, eaves: 8.7, dormers: false }, 'G', '19 Richmond Road: three storeys, ridge along the street, eaves 8.7 m by the height survey; not in a picture'],
];
/** the hand-built houses: [map id, K | G, what] (their outlines are skipped) */
export const HAND = [
  ['w154788907', 'K', '17 Worcester Place: hand-built from the street views of 2024 ("franks south and house 17", "no 17 and neighbours"): buff brick with red bands, three storeys over a basement, canted bay, brick gabled dormer, door up stone steps, red front wall; mass from the map and the height survey; back and sides a guess'],
  ['w154788909', 'K', '18 Worcester Place: the other half of the pair, as No. 17'],
  ['w131316316', 'K', '21 Worcester Place: hand-built from the street view "nos 22 and 23" and the college photograph: as 17 | 18 with black railings to the steps; the pair is drawn symmetrical about its stack (the map gives No. 22 two metres more)'],
  ['w131316315', 'K', '22 Worcester Place: the other half of the pair, as No. 21'],
  ['w131313826', 'K', '16 Richmond Road: hand-built from the street view "richmond road - nos 16 17 19" and the college photograph: buff brick with red bands, a gable to the street, a white canted bay, a paired sash under a red arch, the door in a set-back bay at the side, a hedge behind a low wall; which house is which inferred; back a guess'],
  ['w301621495', 'K', '17 Richmond Road: as No. 16, mirrored'],
];
// measured roof heights (ridge less eaves, the height survey) for the plain-roofed ones: put on the map's own records
const ROOF_H = { w301621497: 3.3 };
// ---- 23 Worcester Place is the west end house of a terrace the map draws as ONE outline (w1302281219). So that it can
// be a house of its own (red brick, two storeys over a basement, eaves 6.3 m and ridge 8.4 m by the height survey),
// preMap cuts its 4.6 m off the outline: the rest of the terrace keeps its id, its style and everything else.
export const NO23 = { id: 'worc:wplace:no23', terrace: 'w1302281219', w: 4.6, eaves: 6.3, roofH: 2.1,
  front: [-303.7, -150.4], mid: [-304.0, -152.5], back: [-304.6, -158.6], rear: [-297.7, -159.3], east: [-269.9, -154.1],
  style: { wall: 'brick', tint: [1.0, 0.78, 0.7], ivy: false, storeys: 2, eaves: 6.3, shape: 'gabled', roof: 'slate', up: 'brickGeorgian', ground: 'brickGeorgian', door: 'brickDoor', dormers: false, parapet: false, crenel: false } };
function splitNo23(map) {
  const b = map && map.buildings && map.buildings.find((x) => x.id === NO23.terrace);
  if (!b || map.buildings.some((x) => x.id === NO23.id)) return false;
  const P = b.poly, n = P.length, at = (q) => P.findIndex((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.3);
  const iF = at(NO23.front), iM = at(NO23.mid), iB = at(NO23.back), iR = at(NO23.rear), iE = at(NO23.east);
  if (iE !== 0 || iF !== n - 1 || iM !== n - 2 || iB !== n - 3 || iR !== n - 4) return false;      // (the outline is not as it was read: leave it alone)
  const along = (a, c, d) => { const l = Math.hypot(c[0] - a[0], c[1] - a[1]); return [+(a[0] + ((c[0] - a[0]) * d) / l).toFixed(2), +(a[1] + ((c[1] - a[1]) * d) / l).toFixed(2)]; };
  const f = along(P[iF], P[iE], NO23.w), r = along(P[iB], P[iR], NO23.w), cen = (R) => [+(R.reduce((t, q) => t + q[0], 0) / R.length).toFixed(1), +(R.reduce((t, q) => t + q[1], 0) / R.length).toFixed(1)];
  const house = [P[iF].slice(), f.slice(), r.slice(), P[iB].slice(), P[iM].slice()];
  b.poly = [...P.slice(0, iB), r.slice(), f.slice()];
  NO23.ring = house; void cen;      // (third pass: the house itself is hand-built on this ground, _wplace_houses.js buildNo23; no map record is added)
  return true;
}
/** one row a building, the form of worcester_streets.js: [id, K | G, what] */
export const CHECKED = [
  [GH_ID, 'K', 'Gloucester House: west face and south end from photographs, street side from ADP\'s outline elevation and street pictures, roofs from the satellite picture and the height survey; north end and the towers\' doors a guess'],
  [FR_ID, 'K', 'Franks Building: north-leg front from the college photograph and a street picture, south front and roofs from the satellite pictures, heights from the height survey; court side a guess'],
  [N10_ID, 'K', '10 Worcester Place: street front from the 2006 survey drawing, west gable and back from photographs, heights from the drawing and the height survey'],
  ...HOUSES.map((h) => [h[0], h[2], h[3]]), ...HAND,
  [NO23.id, 'K', '23 Worcester Place: hand-built on ground cut out of the terrace\'s single mapped outline: red brick, two storeys, sashes under white flat arches, a white door case and door up three steps, a basement grille (college photograph 2023, street view 2024 "nos 22 and 23"); eaves 6.3 / ridge 8.4 m by the height survey; back a guess'],
];
/** attribute by attribute: [K | G, the picture, plan or measurement it rests on] */
export const ATTR = {
  [GH_ID]: {
    position: ['K', 'the map\'s outline; the 2022 height survey agrees to 0.5 m (three blocks 8.3 / 7.8 / 7.8 m long, each 0.9 m further west)'],
    storeys: ['K', '15/gloucester house - west side… (college website), planning 77/00573/A_H "3 storey": three'],
    heights: ['K', 'height survey: eaves 8.0 m, ridge 9.5 m, slopes of 0.40; ADP 2005 outline elevation: 7.96 / 9.57 m'],
    roof: ['K', '40/satellite - Gloucester House roofs…: a shallow double pitch to each block, ridge north-south, pale ridge line; the height survey. It is NOT flat (the survey\'s "flat-ish")'],
    partyWalls: ['K', '15/…west side…: a brick upstand at each step of the echelon; satellite: a pale band at the south end (the coping)'],
    westFace: ['K', '15/…west side…: dark red-brown multi brick, brown two-light and one-light casements, a projecting timber corner window at each block\'s south-west corner on every floor, dark fascia and gutter, black downpipes'],
    windowPlaces: ['G', 'which bay is one-light and which two-light on the middle and north blocks; sizes scaled off the photograph'],
    southEnd: ['K', '13/gate 3 gatehouse - inner (west) face…: blank but for the corner windows, a pale coping'],
    streetSide: ['K', 'ADP 2005 east (Worcester Place) elevation: a window and a slit, a blank tower, a window to each block and floor; 12/street 2024 x2: brown brick behind a red-brown wall'],
    towers: ['K', 'the map\'s three projections + the height survey (6.7 - 7.9 m falling east: a catslide) + ADP\'s eaves line at 6.4 m; drawn 2.9 m deep (height survey) where the map has 4 m'],
    towerDoors: ['G', 'a door on each tower\'s south side'],
    northEnd: ['G', 'a blank gable like the south end'],
    streetWall: ['K', '12/street 2024 - Worcester Place looking south-west…, the owner\'s gate capture, street view 2024 "gloucester house street wall and gate": red-brown brick about 1.9 m with a dark flat coping, from the gatehouse to the Earl Building\'s gate; a grey boarded gate in it with a name plate (no lettering drawn) and a small dark plate, a green cabinet on the pavement'],
    wallGatePlace: ['G', 'where along the wall the boarded gate and the cabinet stand (v 11.5-12.6 and 7.9-9.4, by the bearing of the capture)'],
    brick: ['K', 'the same street view shows the blocks brown rather than red under cloud; the college photograph red-brown in sun: drawn between the two'],
    earlGate: ['K', '12/street 2024 - 16 Worcester Place…: two buff brick piers and a grey sheeted gate; ADP 2005 "new gated entrance with brickwork piers"'],
    tree: ['K', 'the big tree behind the wall (satellite, height survey 9 - 11 m, gate capture); its kind a guess'],
  },
  [FR_ID]: {
    position: ['K', 'the map\'s outline, checked against the height survey block by block (see LV.fr)'],
    whichFront: ['K', 'the college photograph is the NORTH-LEG (west) front seen from the north: 12/street 2024 - Worcester Place looking south-west… shows the same oriel, blocks and planter on the east side of the north leg with the MCR beyond'],
    heights: ['K', 'height survey: corner block eaves 8.7 / ridge 11.9 m; block D 8.6 / 10.8; the link and wing B 5.4 / 8.1; block A 8.6 / 10.9'],
    walls: ['K', '17/franks building… (college website 2023): orange-red brick, buff bands at each sill level and near the foot, buff segmental heads to the gable windows, white casements'],
    link: ['K', 'same: a dark-stained timber oriel of six lights over a boarded apron, above a louvred door, a brick pier with two plates and tall black railing gates'],
    blocks: ['K', 'same + the height survey: gable E to the street with small windows, D with a gablet over its north bay and a triangular glazed dormer, two-storey gabled wing B, tall gabled A'],
    southFront: ['K', 'street view 2024 "franks south and house 17": gabled bays each with an attic casement under a buff head, a second-floor casement under a stone lintel, two-storey canted bays in buff stone with slate roofs (one alone, two under one roof), a low stone lean-to bay at the west end, black downpipes, a clipped hedge behind a low red wall. FOUR gables: three in the street view, the western one hidden there by the caption box and taken from the satellite picture'],
    southSizes: ['G', 'bay and gable sizes scaled off the street view (bays 2.5 m wide, 0.6 m deep; gables 2.5 m wide, 2.0 m high)'],
    westGableWindows: ['K', 'street view 2024 "franks building west front": a two-light casement near the corner and a slit towards the north on each floor; the low brick planter wall rounds the corner'],
    roofs: ['K', 'satellite pictures S4 + the above; height survey: ridges east-west on E and A, north-south on D and the low range; rooflights on north slopes (17/worcester place north leg… 2016)'],
    eavesCourse: ['K', 'street view 2024 "franks south and house 17" and the college photograph: a corbelled (dog-tooth) brick course under the eaves between the gables and on block D'],
    planters: ['K', 'college photograph: low red-brick walls with a buff band before D and before B / A; lines G'],
    courtSide: ['G', 'plain brick with sashes; the carriage way open to the court behind the gates'],
    blockAeast: ['G', 'the map draws A wider to the east (to u 16.6) with a notch: built to 14.4 with a plain gable'],
    plate: ['K', 'a dark plate and a yellow notice on the pier (no lettering drawn: unreadable in the photograph)'],
  },
  [N10_ID]: {
    position: ['K', 'the map\'s outline, begun 1.5 m east of Staircase 24 (height survey and ADP: a gap; the map draws none), so 9.1 m wide where the drawing has 10.1 m'],
    heights: ['K', '12/PLAN existing 2006 - no 10… (eaves 5.4, ridge 7.8, stacks 9.1 - 9.4 m) and the height survey (6.0 / 8.1): built 5.7 / 8.1 / 9.2'],
    front: ['K', 'the 2006 survey drawing + 12/10 worcester place - west gable and street front… (2014) + street view 2024 "no 10 front today" (No. 10 is the OLD red-brick house at its left edge; the buff three-storey block with bays and railings is Staircase 24): red-brown brick with dark headers, three bays, central door with a light over it, six-over-six sashes in white reveals, a string course, end stacks'],
    westGable: ['K', 'the 2014 photograph: two windows near the back, a terracotta vent in the gable'],
    back: ['K', '12/10 worcester place - south (rear) side… (college website): new orange-red brick, white casements, the white six-panel door up four brick steps between cheek walls with steel handrails, raised brick beds with lavender, one rooflight, a bulkhead light and a plate'],
    eastGable: ['G', 'blank (against the Cohen Quad wall)'],
    frontDoor: ['G', 'its colour'],
  },
  houses: {
    pairsFront: ['K', 'street views 2024 "no 17 and neighbours", "franks south and house 17", "nos 22 and 23": buff stock brick with thin red bands, a basement, a raised ground floor and a first floor, a two-storey canted brick bay with a slate roof and two sashes over it to each house beside the party wall, the door at the outer end in a stone case up a flight of stone steps, one stack on the party wall, a red-brick wall along the footway; black railings to the steps of 21 | 22'],
    pairsDormers: ['K', 'the same views: ONE brick gabled dormer to each house, over its bay (two to each pair; the brief\'s "two to each house" is not what the pictures show)'],
    pairsMass: ['K', 'map outlines and the height survey: 17 | 18 10.6 x 7.6 m, eaves 9.0 / ridge 11.7; 21 | 22 12.1 x 7.9 m, eaves 8.8 / ridge 11.6. 21 | 22 is drawn symmetrical about its stack as the street view shows it; the map gives No. 22 two metres more than No. 21'],
    pairsSizes: ['G', 'every size on the fronts, scaled off the street views (to about 0.2 m); six treads are drawn where there are eight or nine risers'],
    pairsBack: ['G', 'backs and sides: plain brick, sashes at the back'],
    no23: ['K', 'college photograph 2023 + street view 2024: red brick, one sash to each floor under a white flat arch, a white door case (door blue in 2023, white in 2024: drawn white) up three steps, a basement grille; the low set-back link between No. 22 and No. 23 is not built'],
    richmondFront: ['K', 'street view 2024 "richmond road - nos 16 17 19" + college photograph 2023: buff brick with red bands, a gable to the street with dark bargeboards, a white canted bay with a slate roof at the raised ground floor, a paired sash in a white surround under a red arch, a sash in the gable, the door in a set-back bay on the side towards the gap between the two houses, a hedge behind a low red wall'],
    richmondMass: ['K', 'map outlines (main front 4.4 / 4.2 m with a set-back bay of 1.7 / 1.0 m; 8.7 m deep) and the height survey (gable apex 13.2 / 12.8 m); eaves 9.2 m scaled off the pictures'],
    richmondBack: ['G', 'backs, the set-back bays\' roofs, where the stacks stand'],
  },
  plates: {
    franksPier: ['G', 'left blank: two lines of white lettering on a dark plate, not readable in the college photograph or the street views'],
    gloucesterHouse: ['G', 'left blank: a pale plate of two words beside the gate, not readable in the street view'],
  },
  circle: {
    place: ['K', '40/satellite - Staircase 24… and Nash Quad east end: a ring about 5 m south of the back wall, towards its east end; 12/…rear side from the cobbled circle'],
    make: ['K', 'the college photograph: rounded cobbles inside a ring of setts, a young tree and low shrubs in the middle, flags round it, two slatted timber benches with grey metal ends'],
    size: ['G', '3.4 m across, scaled off the photograph against the benches (ADP\'s 2006 plan drew a much larger ramped circle that was not built so)'],
    ramp: ['G', 'the cobbles rise 0.1 m to the bed'],
  },
  gap: {
    piers: ['K', 'street view 2024 "no 10 front today": one buff pier with a stone cap, a brown boarded gate set back between it and No. 10, black railings on a dark brick plinth running west before Staircase 24; ADP 2006: a gate in a 1.2 m gap'],
    extent: ['G', 'one railed bay is drawn, ended by a second pier that is not in the picture; the railings carry on before Staircase 24 (another builder\'s front)'],
  },
  mcrYard: {
    exists: ['K', '13/PLAN site location plan 1-500… (ADP 2006): "Courtyard" west of the MCR, south of the gatehouse; 13/gate 3 gatehouse - inner (west) face…: a high buff brick wall carrying on south of the pedestrian door in the plane of the gatehouse\'s inner face'],
    size: ['G', '3.7 x 7.3 m where the plan has about 6.5 x 11 m: the game\'s gatehouse is 3.6 m deep (real about 7) and the way from the gate court to Nash Quad runs through the rest of the space'],
    walls: ['G', 'heights (3.4 m west and north, 2.2 m south), the boarded door in the south wall'],
  },
};
/** only right in today's flat world: to be looked at again when the drawn terrain carries the real levels */
export const TEMPORARY = [
  '10 Worcester Place stands on one level: the pavement before it is 58.33 m and the yard behind it 57.99 m above sea level (0.34 m lower); the four steps (0.70 m) to the back door are right for the yard side',
  'Gloucester House stands on one level: the court on its west is 58.05 m, the street on its east 57.85 m',
  'the street wall north of the gatehouse carries on the piece in places/worcester.js at the same top (1.9 m): if the terrain tilts the street they should be re-based together',
];

// ---- ground: ordinary map areas (the city's ground draws them); trees: [u, v, height, kind] as ordinary map trees
const uv = (pts) => pts.map(([u, v]) => { const p = W(u, v); return [+p[0].toFixed(2), +p[1].toFixed(2)]; });
const AREAS = [
  ['paved', uv([[-10.6, 1.4], [-6.62, 1.4], [-6.62, 27.9], [-8.6, 27.9], [-12.4, 25.6]]), 'paving_stones'],                                      // the strip between Gloucester House and its street wall
  ['paved', uv([[FR.D.uW, FR.low.v0], [FR.low.uE, FR.low.v0], [FR.low.uE, FR.low.link], [FR.D.uW, FR.low.link]]), 'asphalt'],      // the carriage way through the Franks Building
  ['paved', uv([[37.2, N10.vR], [N10.u0, N10.vR], [N10.u0, GAP.v], [37.2, GAP.v]]), 'paving_stones'],                            // the gap beside No. 10
  ['paved', uv([[YARD.u0, -9.9], [YARD.u1, -9.9], [-6.57, YARD.v1], [YARD.u0, YARD.v1]]), 'paving_stones'],                      // the MCR's yard north of the court's own paving
];
for (const [k, r] of Object.entries(houseRings(UV))) AREAS.push([/^rr/.test(k) ? 'garden' : 'paved', r.map((p) => [+p[0].toFixed(2), +p[1].toFixed(2)]), /^rr/.test(k) ? undefined : 'paving_stones']);      // the houses' own ground: front areas paved, Richmond Road's hedged fronts
const TREES = [GH.tree];      // (the sapling in the cobbled circle is drawn with it)
/** for the terrain: the ground under each of these is to be one plane (world x, z rings) */
export const FOOTPRINTS = { houses: houseRings(UV), gloucesterHouse: uv(ghRing()), franks: frRings().map(uv), no10: uv(n10Ring()), circle: uv(Array.from({ length: 16 }, (_, k) => [CIRCLE.c[0] + Math.cos((k / 16) * Math.PI * 2) * CIRCLE.r, CIRCLE.c[1] + Math.sin((k / 16) * Math.PI * 2) * CIRCLE.r])), mcrYard: uv([[YARD.u0, YARD.v0], [YARD.u1, YARD.v0], [YARD.u1, YARD.v1], [YARD.u0, YARD.v1]]) };

export default {
  id: 'worcester_wplace',
  site: { x: -345, z: -150, r: 60 },      // (for the crop switch, core/_crop.js: Gloucester House to 10 Worcester Place, the houses whose map records it sets)
  preMap(game) {
    if (!ON) return;
    try {
      const ov = game.overrides, map = game.map;
      for (const id of [GH_ID, FR_ID, N10_ID, ...HAND.map((q) => q[0])]) ov.skip.add(id);
      for (const [id, st] of HOUSES) ov.style.set(id, st);
      if (map && map.buildings) for (const b of map.buildings) if (ROOF_H[b.id] && !b.roofH) b.roofH = ROOF_H[b.id];
      splitNo23(map);
      if (map && map.areas) AREAS.forEach(([kind, poly, surface], i) => map.areas.push({ id: 'worc:wplace:' + i, kind, surface, poly: poly.map((p) => p.slice()) }));
      if (map && map.trees) for (const [u, v, h, kind] of TREES) { const p = W(u, v); map.trees.push([+p[0].toFixed(2), +p[1].toFixed(2), h, kind]); }
    } catch (e) { console.error('[worcester_wplace] preMap', e); }
  },
  install(game) {
    if (!ON) return null;
    try { return install(game); } catch (e) { console.error('[worcester_wplace] install', e); return null; }
  },
};
function install(game) {
  {
    const world = game.world;
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    // colours the college's atlas did not have: tinted copies of its cells
    const K = pack.cells, cell = (key, from, tint) => { if (K && K.get(from) && !K.get(key)) K.set(key, { ...K.get(from), tint: Array.isArray(tint) ? tint : lin(tint) }); };
    cell('wpGH', 'redBrick', [0.56, 0.5, 0.5]); cell('wpGHw', 'redBrick', [0.86, 0.78, 0.78]); cell('wpFr', 'redBrick', [1.12, 0.92, 0.7]); cell('wpBand', 'buff', [0.85, 0.63, 0.4]);
    cell('wpN10o', 'redBrick', [0.68, 0.6, 0.66]); cell('wpN10n', 'redBrick', [1.08, 0.9, 0.72]); cell('wpCheek', 'buff', [0.6, 0.52, 0.42]); cell('wpStone', 'stoneDress', [1.0, 0.88, 0.68]); cell('wpHB', 'buff', [0.9, 0.86, 0.78]); cell('wpBandR', 'redBrick', [0.95, 0.78, 0.72]); cell('wpR23', 'redBrick', [0.86, 0.78, 0.76]); cell('wpPlinth', 'redBrick', [0.34, 0.31, 0.34]); cell('wpCab', 'frame', 0x3d4a3a);
    cell('wpBrown', 'frame', 0x3d2b23); cell('wpDark', 'frame', 0x25272a); cell('wpStain', 'boards', 0x4a372b); cell('wpPlaque', 'frame', 0x1c2a4a);
    cell('wpTile', 'slate', [0.97, 0.96, 0.95]); cell('wpCope', 'plaster', 0xc9a58c); cell('wpCopeD', 'lead', 0x3a3c40);
    cell('wpLav', 'leafA', 0x6a8a62); cell('wpTeak', 'teak', [0.82, 0.47, 0.22]); cell('wpDoorW', 'doorGrey', 0xf0eee6);
    // rounded cobbles for the circle: the city ground's own cell, on the paths' layer like the setts
    { const G = pack.groundCells, s = G && G.get('setts'), ci = world.tex && world.tex.cells && world.tex.cells.ground && world.tex.cells.ground.cobbles;
      if (s && !G.get('wpCobble')) G.set('wpCobble', ci === undefined ? { ...s } : { ...s, cell: ci }); }
    const M = { _pack: pack };
    const B = new Batch();
    const grp = new THREE.Group(); grp.name = 'worcester-wplace';
    world.addStatic(grp);
    B.push(SF());
    const parts = [['Gloucester House', buildGloucester], ['Franks Building', buildFranks], ['10 Worcester Place', buildNo10], ['cobbled circle', buildCircle], ['railed gap', buildGap], ['MCR yard', buildYard],
      ['17 and 18 Worcester Place', (g, b) => buildPair(g, b, HOUSES3.wp1718)], ['21 and 22 Worcester Place', (g, b) => buildPair(g, b, HOUSES3.wp2122)], ['23 Worcester Place', (g, b) => buildNo23(g, b, HOUSES3.wp23)],
      ['16 Richmond Road', (g, b) => buildGabled(g, b, HOUSES3.rr16, UV)], ['17 Richmond Road', (g, b) => buildGabled(g, b, HOUSES3.rr17, UV)]];
    const built = {};
    for (const [what, fn] of parts) { const n0 = B.tris(), depth = B.stack.length; try { fn(game, B); } catch (e) { console.error('[worcester_wplace] ' + what, e); while (B.stack.length > depth) B.pop(); } built[what] = Math.round(B.tris() - n0); }
    B.pop();
    // the steps to No. 10's back door are walked up
    if (world.groundHeight) {
      const prev = world.groundHeight.bind(world), c = W(N10.u0 + N10.door, N10.vR - 1);
      world.groundHeight = (x, z) => { if (Math.abs(x - c[0]) < 3 && Math.abs(z - c[1]) < 3) { const q = UV(x, z), h = stepsY(q[0], q[1]); if (h !== null) return h; } return prev(x, z); };
    }
    // generated trees and street furniture that would stand in what is now built go (not the tree of TREES)
    if (world.clearArea) {
      const clear = (ring, d) => { try { world.clearArea(offsetRing(ring, d), { lamps: false }); } catch (e) { /* */ } };
      clear(FOOTPRINTS.gloucesterHouse, 0.6); for (const r of FOOTPRINTS.franks) clear(r, 1.2); clear(FOOTPRINTS.no10, 0.8); clear(FOOTPRINTS.mcrYard, 0.3);
      // (and the narrow footway before the Franks Building's planter walls: a generated bin stood 0.85 m from them, 0.2 m from the kerb)
      clear([W(3.3, 7.2), W(6.0, 7.2), W(6.0, 37.5), W(3.3, 37.5)], 0);
      for (const r of Object.values(houseRings(UV))) clear(r, 0.3);
      { const c = GH.cabinet, w = GH.wall; clear([W(w.u1, c.v0 - 1.2), W(w.u1 + 2.6, c.v0 - 1.2), W(w.u1 + 2.6, c.v1 + 1.2), W(w.u1, c.v1 + 1.2)], 0); }      // (one cabinet stands there: the drawn one, not a generated one beside it)
    }
    const meshes = B.build(M, grp, { pack, noCast: new Set(['signs']), chunk: (x, z) => { const q = UV(x, z); return q[1] > 45 ? 3 : q[0] < 2 ? 0 : q[1] < -2 ? 2 : q[0] > 30 ? 4 : 1; } });      // (Richmond Road and the house row east of the Franks Building are chunks of their own)
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
    game.worcesterWplace = { on: true, tris, meshes: meshes.length, built, checked: CHECKED, attr: ATTR, houses: HOUSES, hand: HAND, houses3: HOUSES3, no23: NO23, footprints: FOOTPRINTS, temporary: TEMPORARY, levels: LV, stepsY: (x, z) => { const q = UV(x, z); return stepsY(q[0], q[1]); },
      plan: { gh: GH, franks: FR, no10: N10, circle: CIRCLE, gap: GAP, yard: YARD }, toWorld: W, toStreet: UV };
    console.log(`[gto] worcester_wplace: ${meshes.length} meshes, ${Math.round(tris)} triangles`, JSON.stringify(built));
    return null;
  }
}
