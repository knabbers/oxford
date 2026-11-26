// Worcester College, the south buildings (2026-11-22; package C of docs/research/worcester_survey.md): everything
// between the Cottages' garden and Hythe Bridge Street, hand-built in the college's atlas in place of the generic
// blocks the city builder made of them.
//
//   Asa Briggs Building   (W. G. Newton, 1939; map w28043595) the long neo-Georgian range on Worcester Street: two
//                         storeys and an attic of honey rubble with ashlar dressings, 4 windows - archway - 4 to the
//                         Nuffield Lawn with a recessed balcony over the arch, hipped stone slates round a lead crown,
//                         eight dormers a side, four tall stacks.                         (_worcester_south_asa.js)
//   the kitchen yard      north of it (not in the map): the gabled range along the street wall, the kitchen under its
//                         metal top, the flat-roofed link.
//   Gate 1, Wolfson Gate  the ashlar pier ending the Worcester Street wall, tall dark gates shut behind a crossover.
//   Casson Building       (1960-61; w28043610; Staircases 17-18) the slab: three red-brown brick storeys with grey
//                         box windows, a white storey set back, a zinc mansard with box dormers, the way through.
//   Wolfson Building      (c. 1970; w28043633; Staircases 19-20) the faceted crescent: brown brick fins, aggregate
//                         panels, a lead mansard with splayed dormers, two stair towers to the street. (_worcester_south_cw.js)
//   the oval lawn         between them, with its kerb, ring of flags and hydrangeas.
//   Linbury Building      (Maguire & Murray, 1990; w28043676; Staircases 21-23) buff rendered ranges stepping along
//                         Hythe Bridge Street under deep-eaved metal roofs on posts, the wing of square units, the
//                         Linbury Room pavilion with its veranda, two-tier roof and lantern. (_worcester_south_linbury.js)
//   Hythe Bridge Street   the 2.3 m rubble wall round the corner from the Wolfson Building to the canal.
//
// SOURCES (looked at, never copied or used as textures; local `reference/worcester/`): the 2022 Environment Agency
// height survey for where things stand and how tall they are; the college's 2023 map and fire plan; the folders
// `07 asa briggs building` .. `10 linbury building`, `34 nuffield lawn…`, `38 walls gates…`; the satellite pictures
// S5, S6, S14 and the 2026 street pictures. What is KNOWN (K) and what is a GUESS (G) is in ATTR below, attribute by
// attribute. Heights are above the ground beside each building; the ground itself is the terrain's.
// `?wsouth=0` (node: GTO_WSOUTH=0) turns the whole pass off for before / after pictures.
import * as THREE from 'three';
import { Batch, makePack } from './_worcester_kit.js';
import { WST_WALL, WST_WALL_S } from './_worcester_street.js';
import { SOUTH_ON as ON, mk, ring, offsetRing } from './_worcester_south_kit.js';
import { ASA, ASA_F, KITCHEN, GATE1, GATE1_F, buildAsaBriggs, buildKitchen, buildGate1 } from './_worcester_south_asa.js';
import { CASSON, CASSON_PARTS, WOLF_IN, WOLF, WOLF_RING, WOLF_TOWERS, OVAL, buildCasson, buildWolfson, buildOval } from './_worcester_south_cw.js';
import { RANGE, WING_F, ROOM, VER, UNITS, buildLinburyRange, buildLinburyWing } from './_worcester_south_linbury.js';

const ASA_ID = 'w28043595', WOLF_ID = 'w28043633', CASSON_ID = 'w28043610', LINBURY_ID = 'w28043676';
/** one row a building, the form of worcester_streets.js: [id, K | G, what] (K: its main fronts are from named pictures) */
export const CHECKED = [
  [ASA_ID, 'K', 'Asa Briggs Building: lawn front, roof and street side from photographs, position and heights from the 2022 height survey; ends and what is inside the arch a guess'],
  [CASSON_ID, 'K', 'Casson Building: both long sides, top storey and mansard from photographs, rectangle and height from the height survey; ends and door bays a guess'],
  [WOLF_ID, 'K', 'Wolfson Building: inner side and mansard from photographs, towers from the satellite and street pictures; street side a guess'],
  [LINBURY_ID, 'K', 'Linbury Building: materials, loggias, pavilion and roofs from photographs and the satellite picture; window places and the wing\'s walls a guess'],
];
/** attribute by attribute: [K | G, the picture, plan or measurement it rests on] */
export const ATTR = {
  [ASA_ID]: {
    position: ['K', '2022 height survey: axis (-240.75, 73.5) to (-249.9, 103.0), 30.9 x 10.6 m (the map outline lies 2 m west)'],
    storeys: ['K', '07/west front… (college website c2023), 07/…OpenBenches 2865: two storeys and an attic'],
    heights: ['K', 'height survey: eaves 7.0 m, top 11.2 m above the lawn; stacks to 13.1 m'],
    walls: ['K', 'same photographs: honey coursed rubble, flush ashlar surrounds, plinth'],
    lawnFront: ['K', '4 sashes - archway - 4 on each floor, recessed balcony over the arch with a carved stone, four of the five downpipes'],
    windowSizes: ['G', 'scaled off the photographs against the 7.0 m eaves (1.2 x 1.95 m, 3.05 m apart)'],
    roof: ['K', 'S5 satellite + height survey: hipped stone slates round a flat lead crown 2.6 m wide'],
    dormers: ['K', 'eight a side between the windows (c2023 photograph; street pictures 2026 show the street slope)'],
    stacks: ['K', 'four: two at each end, the inner ones on the lawn slope (S5; height survey peaks; street pictures)'],
    streetSide: ['K', '07/east side… (Camboxer 2026), street pictures 2026: small windows under the eaves, tall sashes at the south end; ground floor a guess (hidden by the wall)'],
    ends: ['G', 'two windows to a floor'],
    insideArch: ['G', 'a porch with one door'],
  },
  kitchen: {
    position: ['K', 'height survey + S5: three masses; drawn 0.8 m west of the survey so the street range clears the wall as the game has it'],
    heights: ['K', 'height survey: range eaves 3.3 / ridge 4.9, kitchen top 5.1, link 3.0 m above the yard'],
    roofs: ['K', 'S5: brown stone slates on the range and the kitchen\'s skirts, a ribbed metal top, a grey flat on the link'],
    walls: ['G', 'rubble; doors and windows'],
  },
  gate1: {
    position: ['K', 'height survey: the gap in the wall at z 109.5-112 (the survey\'s (-246, 107) was an inference); street picture 2026'],
    pier: ['K', '07/east side… (Camboxer 2026): a flat-capped ashlar pier about 3.3 m; its length a guess'],
    gates: ['K', 'street picture 2026: tall solid dark double gates, shut, set back between rubble posts; sizes a guess'],
  },
  [CASSON_ID]: {
    position: ['K', 'height survey: x -281.5..-271.3, z 109.8..139.8 (30.0 x 10.2 m)'],
    heights: ['K', 'height survey: flat top 13.2 m; storey heights scaled off the photographs'],
    walls: ['K', '09/long side… (college website 2024), 09/east face… (modernmooch 2026): red-brown brick, white storey set back, grey fascia, zinc mansard, box dormers'],
    windows: ['K', 'grey projecting box windows, wide two-light ones and narrow ones; on the east side deeper, on corbelled brick aprons. Which bay has which: G'],
    wayThrough: ['K', 'fire plan + the map\'s passage w251686316: a third of the way from the SOUTH end'],
    doors: ['G', 'Staircase 17 at the north-east, 18 on the west side: which bay'],
    ends: ['G', 'a stair window to a floor; the south end\'s top storey glazed round the corner is K'],
    roofTop: ['K', 'S6 / S14: flat grey with rooflight strips, an aerial rod'],
  },
  [WOLF_ID]: {
    position: ['K', 'inner face from the map and the height survey; 6.0 m deep by the height survey (the map draws 3.7 m)'],
    heights: ['K', 'height survey: mansard top 8.5 m; towers 8.7 m'],
    innerSide: ['K', '08/inner concave side… (college website 2023), 08/…round the circular lawn (modernmooch 2026): brown brick, a fin at each change of angle, recessed aggregate strips, grey two-light windows, flat-headed doorways with globe lights'],
    mansard: ['K', 'blue-grey lead, one splayed dormer to a bay'],
    doors: ['K', 'where the map\'s two footways off the ring reach the building (w251686314, w251686315); the fire plan puts 19 at the north, 20 at the south-west'],
    towers: ['K', 'S6, street pictures 2026: two flat-topped brick stair towers with dark slits on the street side; their low lead roofs from S6'],
    streetSide: ['G', 'plain brick with narrow lights: hidden by trees and the wall in every picture'],
  },
  oval: {
    shape: ['K', 'S6: an oval about 7 x 12 m, long axis north-south (the survey called it round)'],
    surfaces: ['K', '34/circular lawn and paving…: mown lawn, stone kerb, riven flags, hydrangeas against both buildings, a small tree and shrubs in the lawn'],
  },
  [LINBURY_ID]: {
    position: ['K', 'the map\'s outline (north faces agree with the height survey); south faces held to the map because its Hythe Bridge Street lies 2 m north of the survey\'s'],
    heights: ['K', 'height survey: 12.4 m at the tower by the Casson Building stepping down 10.6 / 8.3 / 8.0 / 5.8 / 5.2 m westwards; wing roofs 4.0 m'],
    walls: ['K', '10/…hythe bridge street elevation…, 10/…inner court…, street picture 2026: buff render, raised bands, small square dark windows in raised surrounds'],
    loggias: ['K', 'same: open roof-top storeys behind solid parapets under low metal roofs with deep eaves on slim posts; which blocks have one from the height survey and the street pictures'],
    windows: ['G', 'where each window is'],
    wing: ['K', 'the map\'s staircase outline + S14: a grid of 5.2 m units at 41 degrees, each under its own low hipped metal roof; its walls and windows G'],
    linburyRoom: ['K', '10/linbury room pavilion… x3, venue page: 10.1 m square, glazed timber screens with a small-square grid, veranda on white posts with stone flags, two-tier metal roof, lantern, finial'],
    linburyRoomPlace: ['G', 'at the outline\'s north corner (under tree canopy in the satellite picture and the height survey)'],
    westEnd: ['G', 'the Morley Fletcher Room / laundry end: a low rendered block'],
  },
  hytheBridgeWall: {
    wall: ['K', '10/…hythe bridge street elevation…, street picture 2026: coursed rubble about 2.3 m, flat stone coping, a boarded door'],
    line: ['G', '1.4 m inside the map\'s pavement line; where the door is'],
  },
};

// ---- the Hythe Bridge Street wall: from the Wolfson Building's east tower round the corner and west to the canal,
// 1.4 m inside the mapped pavement's middle
export const HB_WALL = [[-245.5, 126.6], [-243.6, 131.6], [-245.6, 139.2], [-248.7, 142.7], [-251.9, 144.7], [-257.2, 145.5], [-284.0, 148.6], [-323.5, 155.9]];
/** Hythe Bridge Street's carriageway along the wall (preMap) */
export const HB_STREET = { id: 'w14815079', w: 6.6 };
const HB_DOOR = mk([-323.5, 155.9], [-284.0, 148.6]);      // a east along the long stretch, b out to the street
const HB_DOOR_A = 20.6;

const asaRing = [ASA.NW, ASA.NE, ASA.SE, ASA.SW];
const wingRing = (() => { const W = (a, b) => WING_F.pt(a, b); return [W(-VER, -VER), W(21, -VER), W(21, 5.9), W(15.9, 5.9), W(15.9, 11.7), W(10.7, 11.7), W(10.7, 16.9), W(5.9, 16.9), W(5.9, 22.4), W(5.3, 22.4), W(5.3, 27.6), W(-VER, 27.6)]; })();
/** for the terrain: the ground under each of these is to be one plane (world x, z rings) */
export const FOOTPRINTS = {
  asaBriggs: asaRing, kitchen: [[-243.1, 51.5], [-228.4, 51.5], [-228.4, 70.0], [-236.3, 74.9], [-243.1, 72.8]],
  casson: [[CASSON.x0, CASSON.z0], [CASSON.x1, CASSON.z0], [CASSON.x1, CASSON.z1], [CASSON.x0, CASSON.z1]],
  wolfson: WOLF_RING, wolfsonTowers: WOLF_TOWERS, linburyRange: RANGE.map((k) => [[k.r[0], k.r[2]], [k.r[1], k.r[2]], [k.r[1], k.r[3]], [k.r[0], k.r[3]]]), linburyWing: wingRing,
};
/** for the terrain: the INNER (college) face of the two boundary walls, where the precinct's edge is to be drawn */
const inner = (pts, d = 0.21) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [+(p[0] - ((b[1] - a[1]) / l) * d).toFixed(2), +(p[1] + ((b[0] - a[0]) / l) * d).toFixed(2)]; });
export const WALL_INNER = { worcesterStreet: [inner(WST_WALL), inner(WST_WALL_S)], hytheBridgeStreet: [inner(HB_WALL)], gate1: [GATE1.S, GATE1.N] };

// ---- ground: ordinary map areas, so the city's ground draws them at the right level and no grass grows through
const AREAS = (() => {
  const A = [], F = ASA_F, c = F.L / 2, G = GATE1_F, O = OVAL, W = (a, b) => WING_F.pt(a, b);
  const add = (kind, poly, o = {}) => A.push({ id: 'worc:south:' + A.length, kind, poly, ...o });
  // Asa Briggs: lawn up to the wall where the map's outline stood, the iris border, flags before the arch
  add('garden', [[-248.1, 71.8], F.pt(0, 0), F.pt(F.L, 0), [-257.1, 102.0]]);
  add('flowerbed', [F.pt(0.3, 0.02), F.pt(c - 2.0, 0.02), F.pt(c - 2.0, 1.0), F.pt(0.3, 1.0)]);
  add('flowerbed', [F.pt(c + 2.0, 0.02), F.pt(F.L - 0.3, 0.02), F.pt(F.L - 0.3, 1.0), F.pt(c + 2.0, 1.0)]);
  add('paved', [F.pt(c - 2.0, 0.02), F.pt(c + 2.0, 0.02), F.pt(c + 2.0, 2.3), F.pt(c - 2.0, 2.3)], { surface: 'paving_stones' });
  // the tarmac inside Gate 1, the crossover outside the gates
  add('paved', [[-241.85, 108.9], [-244.6, 105.8], [-255.3, 102.5], [-257.0, 104.5], [-256.6, 109.6], [-248.6, 110.5], [-242.5, 112.1]], { surface: 'asphalt' });
  add('paved', [G.pt(0, 0.25), G.pt(GATE1.open, 0.25), G.pt(GATE1.open, -GATE1.back), G.pt(0, -GATE1.back)], { surface: 'paving_stones' });
  // the kitchen yard
  add('paved', [[-234.5, 47.7], [-222.5, 47.9], [-225.6, 62.4], [-229.6, 75.0], [-235.6, 75.2], [-243.3, 72.8], [-243.3, 55.8], [-239.3, 55.8], [-239.3, 62.4], [-234.6, 62.4]], { surface: 'paving_stones' });
  // the court between the two buildings: flags from wall to wall, the oval lawn in it (a mown one: no rough grass),
  // and beds of planting everywhere but the ring, the ways to the two Wolfson doors and the way through the Casson
  // Building. Each bed stops exactly at the ring: a bed drawn over the flags would hide them
  add('paved', [[-271.3, 108.4], [-256.2, 109.5], ...WOLF_IN, [-271.3, 139.6]], { surface: 'paving_stones', keep: true });      // (keep: its trees are not cleared; the ring is, below)
  add('paved', [[CASSON.x0 - 0.9, CASSON.pass[0]], [CASSON.x1 + 0.1, CASSON.pass[0]], [CASSON.x1 + 0.1, CASSON.pass[1]], [CASSON.x0 - 0.9, CASSON.pass[1]]], { surface: 'paving_stones' });
  add('pitch', ring(O.c[0], O.c[1], O.rx, O.rz, 28));
  const Rx = O.rx + 0.16 + O.path + 0.05, Rz = O.rz + 0.16 + O.path + 0.05, D = Math.PI / 180;
  const arc = (t0, t1, n = 8) => Array.from({ length: n + 1 }, (_, k) => { const t = (t0 + ((t1 - t0) * k) / n) * D; return [O.c[0] + Math.cos(t) * Rx, O.c[1] + Math.sin(t) * Rz]; });
  const Wf = (k) => mk(WOLF_IN[k], WOLF_IN[k + 1]), wx = CASSON.x1 + 0.03;
  add('flowerbed', [[wx, 112.8], ...arc(232.6, 146.4), [-268.45, 124.35], [wx, 129.45]]);                                                              // against the Casson Building
  add('flowerbed', [Wf(0).pt(1.6, 0.03), Wf(1).pt(0, 0.03), Wf(2).pt(0, 0.03), Wf(2).pt(1.9, 0.03), ...arc(24.9, -52.6)]);                         // Wolfson, north of the door to Staircase 19
  add('flowerbed', [Wf(3).pt(0.15, 0.03), Wf(4).pt(0, 0.03), Wf(5).pt(0, 0.03), Wf(5).pt(2.1, 0.03), [-260.33, 134.95], [-261.96, 127.56], ...arc(78.9, 52.6, 5)]);      // ... between the two doors
  add('flowerbed', [...arc(124.3, 96.2, 5), [-263.74, 127.7], [-262.05, 136.05], Wf(6).pt(0, 0.03), Wf(7).pt(0, 0.03), Wf(7).pt(Wf(7).L, 0.03), [wx, 139.3], [wx, 133.05], [-269.25, 133.05]]);      // ... and the south-west corner
  // the Linbury court (tarmac)
  add('paved', [[-281.6, 129.4], [-295.0, 131.0], [-322.0, 139.5], [-318.6, 145.3], [-313.4, 145.5], [-309.6, 142.3], [-299.6, 142.3], [-299.6, 139.3], [-284.6, 138.7], [-284.6, 136.4], [-281.6, 136.4]], { surface: 'asphalt' });
  return A;
})();
// mapped footways the paving above replaces (they stay in the walk graph), and the ones led round what now stands
const WAYS = ['w1163633016', 'w1163633017', 'w1163633018', 'w251686314', 'w251686315', 'w251686316', 'w251686317'];
const REROUTE = [
  ['w1163633018', (p) => [p[0], [-270.6, 131.2], [-267.6, 126.4], p[p.length - 1]]],                 // the way through the Casson Building -> the ring
  ['w251686317', (p) => [p[0], [-296.1, 138.1], p[p.length - 1]]],                                      // into the Linbury court, between the wing's first tooth and the range
  ['w130668910', (p) => [p[0], [-283.2, 108.5], [-270.5, 108.2], p[p.length - 1]]],                     // round the Casson Building's north end (2 m further north than the map's)
];
// trees: [x, z, height, kind] (ordinary map trees). K: the small tree in the oval lawn, the pine inside the gate, the
// belt along the street corner (street and satellite pictures); G: exactly where each stands
// the Linbury Room's veranda: two flagged walks along its garden sides. Mapped as private footways (not in the
// pedestrians' graph) so that the city's ground draws the flags and keeps the lawn's rough grass off them to the edge
const VERANDA = (() => { const W = (a, b) => WING_F.pt(a, b); return [[W(-VER / 2, -VER), W(-VER / 2, ROOM)], [W(-VER, -VER / 2), W(ROOM, -VER / 2)]]; })();
const TREES = [[-263.5, 118.3, 5.5, 'broad'], [-243.9, 116.6, 8.5, 'conifer'], [-247.6, 131.6, 9, 'broad'], [-250.6, 137.4, 10, 'broad'], [-253.2, 142.4, 9, 'broad'], [-266.5, 145.5, 10, 'broad'], [-276.4, 144.6, 11, 'broad'], [-292.0, 149.2, 6.5, 'broad']];

export default {
  id: 'worcester_south',
  preMap(game) {
    if (!ON) return;
    try {
      const ov = game.overrides, map = game.map;
      for (const id of [ASA_ID, WOLF_ID, CASSON_ID, LINBURY_ID, ...WAYS]) ov.skip.add(id);
      if (map && map.barriers) map.barriers.push({ id: 'worc:wall-hythe-bridge-st', kind: 'wall', h: 2.3, rubble: true, pts: HB_WALL.map((p) => p.slice()) });
      // Hythe Bridge Street along that wall (road w14815079, the bridge's east end to the Worcester Street lights): the
      // map gives every primary road a 10 m carriageway, and here its kerb then ran 0 - 0.6 m from the wall's face (the
      // signal pole at the lights stood IN the wall and the crossing led into it: tools/audit_placement.mjs thick /
      // crossingWall, since the wall was built). K: LIDAR 2022, 1 m surface - the street is 9.3 - 9.5 m from this wall to
      // the parapet / railing on its south side (x -262 .. -310; 11 m at the bridge). G: the split - a carriageway of 6.6 m
      // (two 3.3 m lanes: the buses) and about 1.4 m of pavement each side; in the game, whose wall stands 0.3 - 1.1 m
      // north of the LIDAR's, that leaves 1.55 - 2.3 m of pavement before the wall. The centre line is the map's.
      { const hb = map && map.roads && map.roads.find((r) => r.id === HB_STREET.id); if (hb && hb.w === 10) { hb.w0 = hb.w; hb.w = HB_STREET.w; hb.laneFit = true; } }
      if (map && map.areas) for (const a of AREAS) map.areas.push({ ...a, poly: a.poly.map((p) => p.slice()) });
      if (map && map.trees) for (const t of TREES) map.trees.push(t.slice());
      if (map && map.roads) VERANDA.forEach((pts, i) => map.roads.push({ id: 'worc:south:veranda' + i, kind: 'footway', w: VER, surface: 'paving_stones', access: 'private', pts: pts.map((q) => q.slice()) }));
      for (const [id, fn] of REROUTE) { const r = map && map.roads && map.roads.find((x) => x.id === id); if (r && r.pts) r.pts = fn(r.pts.map((q) => q.slice())); }
    } catch (e) { console.error('[worcester_south] preMap', e); }
  },
  install(game) {
    if (!ON) return null;
    const world = game.world, col = game.worldCollider;
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    // colours the college's atlas did not have: tinted copies of its cells
    const K = pack.cells, cell = (key, from, tint) => { if (K && K.get(from) && !K.get(key)) K.set(key, { ...K.get(from), tint: Array.isArray(tint) ? tint : lin(tint) }); };
    cell('wsHoney', 'rubble', [1.2, 1.09, 0.84]); cell('wsDark', 'frame', 0x2b2824);
    cell('wsBrickC', 'redBrick', [0.66, 1.36, 1.85]); cell('wsBrickW', 'redBrick', [0.54, 1.08, 1.2]);
    cell('wsAgg', 'plaster', 0xa59c93); cell('wsConc', 'plaster', 0xb3aea2); cell('wsWinGrey', 'grey', 0xa9afb2);
    cell('wsZinc', 'lead', 0x8d9599); cell('wsZincD', 'lead', 0x6d7478); cell('wsRoof', 'lead', 0xa6a8a4); cell('wsLead', 'lead', 0x8a96a5); cell('wsLeadD', 'lead', 0x6f7b8a);
    cell('wsRender', 'plaster', 0xd9c9a3); cell('wsBrown', 'frame', 0x3d2b23); cell('wsMetal', 'lead', 0x9babb7); cell('wsMetalD', 'lead', 0x596165);
    cell('wsPost', 'white', 0xd2c6ae); cell('wsSoffit', 'wood', 0xb39672); cell('wsTimber', 'timber', 0x6a4832);
    cell('wsGate', 'boards', 0x1d1e20); cell('wsLeafH', 'leafB', 0x4f8a45); cell('wsIvy', 'leafC', 0x3f6a36); cell('wsHyd', 'white', 0xe9ece2);
    const M = { _pack: pack };
    const B = new Batch();
    const grp = new THREE.Group(); grp.name = 'worcester-south';
    world.addStatic(grp);
    const parts = [['Asa Briggs Building', buildAsaBriggs], ['kitchen yard', buildKitchen], ['Gate 1', buildGate1], ['Casson Building', buildCasson], ['Wolfson Building', buildWolfson], ['oval lawn', buildOval], ['Linbury range', buildLinburyRange], ['Linbury wing', buildLinburyWing]];
    const built = {};
    for (const [what, fn] of parts) { const n0 = B.tris(), depth = B.stack.length; try { fn(game, B); } catch (e) { console.error('[worcester_south] ' + what, e); while (B.stack.length > depth) B.pop(); } built[what] = Math.round(B.tris() - n0); }
    // the boarded door in the Hythe Bridge Street wall (K: there is one; G: where)
    try {
      B.push(HB_DOOR.mat());
      B.boxXZ('stoneDress', HB_DOOR_A - 0.75, HB_DOOR_A + 0.75, 0, 2.25, 0.21, 0.27, { bottom: false }); B.unit('doorGrey', [[HB_DOOR_A - 0.55, 0.03], [HB_DOOR_A + 0.55, 0.03], [HB_DOOR_A + 0.55, 2.05], [HB_DOOR_A - 0.55, 2.05]], 0.283);
      B.pop();
    } catch (e) { console.error('[worcester_south] wall door', e); }
    // generated trees and street furniture that would stand in what is now built or paved go
    if (world.clearArea) {
      const clear = (poly, d = 1.0) => { try { world.clearArea(offsetRing(poly, d)); } catch (e) { /* */ } };
      for (const P of [asaRing, FOOTPRINTS.kitchen, FOOTPRINTS.casson, WOLF_RING, ...WOLF_TOWERS, ...FOOTPRINTS.linburyRange, wingRing]) clear(P);
      for (const a of AREAS) if (a.kind === 'paved' && !a.keep) clear(a.poly, 0.2);
      // the ring of flags, in two halves so that the tree in the lawn stays
      const O = OVAL, n = 14, half = (s) => { const o = [], i = []; for (let k = 0; k <= n; k++) { const t = -Math.PI / 2 + (Math.PI * k) / n; o.push([O.c[0] + s * Math.cos(t) * (O.rx + O.path + 0.3), O.c[1] + Math.sin(t) * (O.rz + O.path + 0.3)]); i.push([O.c[0] + s * Math.cos(t) * (O.rx - 0.6), O.c[1] + Math.sin(t) * (O.rz - 0.6)]); } return [...o, ...i.reverse()]; };
      for (const s of [1, -1]) { try { world.clearArea(half(s)); } catch (e) { /* */ } }
    }
    const SPLIT = [100, 132];      // three chunks north to south and west of the Casson Building, so culling still drops what is out of view
    const meshes = B.build(M, grp, { pack, noCast: new Set(['signs']), chunk: (x, z) => (x < -283 && z > 112 ? 3 : z < SPLIT[0] ? 0 : z < SPLIT[1] ? 1 : 2) });
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
    game.worcesterSouth = { on: true, tris, meshes: meshes.length, built, checked: CHECKED, attr: ATTR, footprints: FOOTPRINTS, wallInner: WALL_INNER, casson: CASSON, cassonParts: CASSON_PARTS, gate1: GATE1, kitchen: KITCHEN, units: UNITS, range: RANGE };
    console.log(`[gto] worcester_south: ${meshes.length} meshes, ${Math.round(tris)} triangles`, JSON.stringify(built));
    return null;
  },
};
