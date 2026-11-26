// Somerville College, STANDALONE model, part 'darbishire' (survey B01): THE PLAN of Darbishire Quad (Morley Horder,
// 1932-34) with the Woodstock Road front: the west, north and east (lodge) ranges round the court, the tall north-east
// block on Woodstock Road, the low Porters' Lodge range with its round-arched gateway, the south (gateway) block with the
// square-headed vehicle way, the court's south wall and the lane behind it, the Loverose Way boundary wall from the
// corner to the Hostel, the raised flagged forecourt on Woodstock Road. Pure data: every figure a named constant with
// its source; the build functions are in _somerville_darbishire_build.js. Brief: docs/handoff/somerville/briefs/darbishire.txt.
//
// THE COURT'S OWN FRAME. Everything is authored in (s, y, t): s runs "east" along the north range's court face, t
// "south" across it (S.ownFrame on the map's two inner corners of r4047418: (99.33, -17.05) -> (120.23, -14.84), turned
// +6.0 deg from the LOCAL u axis). The map's Darbishire outlines are EXACTLY orthogonal in this frame (every vertex of
// r4047418 / r4047418_1 / w227470836 falls on s or t = const to 0.1 m), so the whole quad is drawn square in it.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (reference/somerville/00 maps and lidar/somerville_dsm.npy / _dtm.npy) resampled bilinearly in the frame
//     (scratch tables at 1 m): roof edges, ridges, chimney peaks, the court's walks and lawns.
//   * The MAP against the LIDAR: the west and north ranges agree to about 1 m (the LIDAR's roof edges stand 1 - 2 m into
//     the court from the map's faces: eaves overhang and the one-cell lean), so the faces are taken between the two.
//     The EAST side does not agree: the LIDAR puts the lodge range's ridge at s 27.0 and its eaves edges at s 24.3 /
//     30.3, i.e. 3.5 m east of the map's lodge (w227470836, s 21 - 26.3); the court is then 23.5 m wide, not 21, and the
//     forecourt between the street faces and the site's boundary (SITE_RING) is 2 - 3 m, as the street photographs show.
//     The LIDAR wins there.
//   * Ground: DTM in the court 1.40 - 1.50 above the datum (the dips to -0.7 under the east range and the gateway block
//     are the DTM's interpolation under roofs, not ground); the DSM shows RAISED WALKS at +1.9 - 2.0 round three sides of
//     the north lawn (t 3 - 5, s 2.5 - 4.5, s 19 - 23.5) and in front of the lodge's south half, with the lawns and the
//     cross path at +1.4 - 1.5: the court is a sunk lawn with terraced walks (photographs 01: a stone-edged raised border,
//     steps up to the lodge).
//   * Photographs (folder 01): the three street looks (Street View Mar 2026; J Cairns 2019), the court looks (Street View
//     Jun 2015; J Cairns 2021), the Loverose Way look (Aug 2024): bays, windows, dormers, stacks, shields, the arches.
// The lane south of the court (map w97853790) runs from the vehicle gateway through the south block, along the court's
// south wall and through the south end of the west range to the Traffic Quad side (LIDAR: open ground t 29 - 31 from
// s -9 to s 16, roofs over it at both ends).

export const FRAME = [99.33, -17.05, 120.23, -14.84];   // K: map r4047418 (the court's NW and NE inner corners)

// ------------------------------------------------------------------------------------------------ levels (y above the datum)
export const COURT = 1.45;          // the lawns and the cross path. K: DTM 1.40 - 1.50, DSM 1.4 - 1.5 on the lawns
export const RAISED = 1.95;         // the raised walks round the north lawn and before the lodge. K: DSM 1.9 - 2.0
export const STREET = 1.45;         // Woodstock Road pavement at the front. K: DTM 1.3 - 1.5 at s 31 - 34
export const STRIP = 1.65;          // (before the merge: the forecourt strip at one level with a 0.2 kerb, G; now see PAVE_UP)
// THE MERGE (2026-11-24): the forecourt strip is flush with the city's Woodstock Road pavement at the boundary (the
// city draws its pavement PAVE_UP over the surveyed ground, world/ground.js Y.pavement 0.13; its carriageway / service
// crossover ROAD_UP, Y.road 0.04): the strip lies at the pavement's level just outside the boundary, so it follows
// the street's fall (+1.45 .. +1.6), and the steps up to the lodge passage are as many 0.17 risers as that needs (3).
// The vehicle way's setts fall from the passage (LANE) to the crossover's level at the boundary. G (was the kerb).
export const PAVE_UP = 0.13, ROAD_UP = 0.04;
export const FFL = 1.62;            // ground floors of the ranges (thresholds). G
export const LODGE_FL = 1.95;       // the lodge passage: steps up from the street and from the court. I: "three steps up
                                    // inside" (survey 2) + the raised walk's level
export const LANE = 1.38;           // the lane and the gateway passage. K: DTM 1.3 - 1.45 on the lane
export const FOOT = -0.15;          // every wall goes down to here at least (0.5 m below the lowest ground at a foot)

// ------------------------------------------------------------------------------------------------ the ranges (s, t)
export const PITCH = 0.9;           // roof pitch, rise / run (42 deg): K: it gives every LIDAR ridge from the eaves
export const WEST = { s0: -6.7, s1: 1.1, t0: -1.55, t1: 31.1, eaves: 7.9 };   // K: LIDAR roof s -7.3 .. 1.5, ridge s -2.9, 11.3; map -7.65 .. 0;
                                    // north end on the Hostel's south face (map t -2.97), south end LIDAR t 31.5 (map 29.5)
export const WING = { s0: -10.3, s1: -6.7, t0: 19.3, t1: 25.5 };   // K: LIDAR roof t 18.8 - 26.0 less the eaves (touch-up 1: was 18.6 - 25.2;
                                    // Halling 2025 and toblu 2017 put its north face about 1.9 m south of the archway's
                                    // south jamb), s -11.3 (map -10.8)
export const NORTH = { s0: 0.6, s1: 23.4, t0: -6.3, t1: 1.4, eaves: 8.0 };   // K: map faces -7.6 / 0, LIDAR edges -6.9 / 2.2
export const PROJ = { s0: 5.8, s1: 18.3, t0: -8.0 };   // the deeper middle of the north range on Loverose Way. K: map s 4.4 - 17.2,
                                    // LIDAR s 7.5 - 19, its face on the boundary (t -9.4); ridge 12.5 (LIDAR 12.3 - 12.6)
export const NE = { s0: 23.4, s1: 30.9, t0: -6.3, t1: 6.8, eaves: 8.25 };   // the tall block on the street. K: LIDAR edges s 31.5 - 32,
                                    // t -7 .. 6.5, ridge N-S at s 28 11.2 - 11.4; set forward of the lodge (photographs)
export const LODGE = { s0: 24.0, s1: 29.6, t0: 6.8, t1: 25.6, eaves: 5.35, pitch: 1.0 };   // K: LIDAR ridge s 27.0 at 8.0 - 8.2,
                                    // eaves edges 24.3 / 30.3; eaves just over the arch (photographs 01)
export const PAV = { s0: 22.6, s1: 26.8, spans: [[12.2, 14.9], [18.3, 21.0]], eaves: 7.0, ridge: 8.1 };   // the two-storey pavilions
                                    // either side of the lodge's court arch. K: LIDAR bumps to s 23 at t 11.5 - 14.5, 18.5 - 21.5;
                                    // photographs (hipped, window / panel / window); sizes G
export const GATE = { s0: 16.8, s1: 29.2, t0: 25.6, t1: 33.3, eaves: 8.3 };   // the south block over the vehicle way. K: LIDAR
                                    // s 17 - 29, t 25 - 32.5, ridge E-W 11.7 - 11.9 at t 29.5, hipped to the street
export const PASS = [28.6, 31.4];   // the lane's way through the gateway block and the west range (t). K: LIDAR lane t 29 - 31
export const PASS_H = 4.4;          // the vehicle way's flat lintel. G: Street View "about 3 m high" (the college: 2.5 m limit)
export const AXIS = 16.6;           // the lodge passage and the west range's arch (one cross axis). K: map w97853746 / w97853787 /
                                    // w97853791 at t 15.2 - 15.3; LIDAR (the DTM sees ground through the lodge at t 14 - 18)
export const CORNICE = { h: 0.32, proj: 0.32 };   // the eaves cornice. G (photographs: a moulded stone cornice and gutter)

// ------------------------------------------------------------------------------------------------ openings
export const WIN = {                 // 6 over 6 sashes in plain stone architraves. K: photographs (count); sizes G scaled off the
  w: 1.0, arch: 0.13,                // storey heights
  g: [2.6, 4.25], f: [5.2, 6.85],    // ground / first floor sill and head
};
export const BAY = { t0: 1.6, t1: 4.6, proj: 0.9, top: 8.45 };   // the two-storey square bay at the north end of the west range's
                                    // court face (tripartite windows). K: photographs 01 (2015, Cairns 2021); sizes G
export const W_BAYS = [6.2, 8.6, 11.0, 13.4, 19.8, 22.2, 24.6, 26.8];   // west range window bays (t). K count (photographs)
export const W_DORMERS = [3.1, 6.2, 8.6, 11.0, 13.4, 19.8, 22.2, 24.6, 26.8];   // K: "about 9 dormers" (Cairns 2021)
export const W_SHIELDS = [15.0, 18.2, 9.8, 23.4];   // blank shields at the first floor (t). K: either side over the arch; others G
export const W_ARCH = { w: 2.6, spring: 3.65 };   // the round arch through the west range. K: photographs; size G
// the west range's WEST (back) face to the Traffic Quad: RED BRICK, not stone (touch-up 1). K: reference/somerville/02 .../
// "Traffic Quad looking east to the brick back of Darbishire west range ... (P Halling 2025).jpg" (the face north of the wing
// nearly square on: count, order and positions scaled off it with its perspective taken out, +-0.5 m) and "Traffic Quad path
// looking east to the Darbishire west-range arch, in snow (toblu 2017).jpg" (on the arch's axis: the arch, the dormer over it,
// the stacks either side, the wing's lantern)
export const WBACK = {
  first: [-0.75, 2.5, 5.35, 8.35, 12.2, 16.6],   // first-floor 6 over 6 sashes (t), the last over the archway. K (Halling)
  ground: [-0.75, 2.5, 8.35, 12.2],              // ground-floor sashes (t). K (Halling)
  small: [13.85],                                 // a small window between the last sash and the archway. K (Halling, toblu)
  south: [26.8],                                  // south of the wing (seen in no look). G
  f: [5.35, 7.2], g: [2.55, 4.3], w: 1.0,         // sill / head: K scaled off the eaves (7.9) and the yard (1.3) in Halling; +-0.15
  head: 0.24,                                     // brick heads: flat gauged over the first floor, segmental over the ground. K (Halling); depth G
  arch: { w: 2.6, spring: 3.25, rise: 1.1, ring: 0.36 },   // the archway: a low round-headed brick arch, its crown about 1.1 m
                                                  // under the first-floor sill over it (Halling, toblu); width the court side's; ring G
  porch: { t0: 3.3, t1: 6.9, proj: 1.6, top: 5.1, door: 4.3 },   // the single-storey brick porch with a stone doorcase, door left
                                                  // of its middle. K (Halling: position, height under the first-floor sills); depth G
  dormers: [2.9, 16.6, 27.3],                     // small gabled dormers with pale fronts. K the first two (Halling, toblu); the third G
  pipes: [0.75, 10.2],                            // pale downpipes. K (Halling)
  gwall: { t: 13.4, s1: -10.7, h: 1.6, pier: 1.95 },   // a brick garden wall square off the face north of the archway path, a
                                                  // stone-capped pier at its end. K: LIDAR +2.8 - 3.2 along t 13, s -8 .. -11; Halling, toblu
  beds: [[-1.3, 3.2], [6.95, 13.4], [17.95, 19.3]],     // planting along the face's foot (t). K (Halling); depth 0.9 G
};
export const N_BAYS =[3.0, 5.4, 7.8, 10.1, 14.4, 16.7, 19.1, 21.5];   // north range court face (s). K count roughly (Cairns 2021); G
export const N_GABLE = { s: 12.25, w: 3.2, apex: 10.7 };   // the pedimented centre gable with a round-arched window. K: Cairns 2021
export const N_DORMERS = [4.2, 7.9, 16.6, 20.3];          // G: Cairns shows two left and one right of the gable
export const N_SHIELDS = [6.6, 17.9];                     // G
export const NN_DORMERS = [3.0, 9.2, 15.2, 21.0];         // hipped dormers on the north slope. K: Loverose Way look (one seen); G
export const NE_BAYS = [-4.75, -2.3, 0.15, 2.6, 5.05];     // NE block street bays (t); the middle one with the shield and the
                                    // pedimented gable. K: Street View Mar 2026 (three seen), Cairns 2019; the north two G
export const NE_GABLE = { w: 2.6, apex: 10.9 };           // K: photographs (pedimented, one small window); size G
export const L_COURT = { win: 9.6, win3: 23.3, dormers: [9.6, 16.6, 23.3] };   // lodge court face (t). K: Street View 2015
export const L_STREET = { sash: 20.9, two: 12.5, plaque: 10.9, dormers: [12.5, 20.9] };   // K: Cairns 2019 (positions scaled)
export const L_ARCH = { court: { w: 3.0, spring: 3.62 }, street: { w: 2.45, spring: 3.85 } };   // K: photographs; sizes scaled off
                                    // the Cairns photograph (opening 2.4 wide, apex 3.4 above the step)
export const SOUTH_WALL = { t: 27.3, th: 0.4, s0: 1.1, s1: 16.8, top: 3.45, gate: [1.5, 2.7] };   // K: LIDAR 1.7 - 3.4 along
                                    // t 26 - 27; photograph 2015 (a stone wall closing the court); gate G
export const SHED = { s0: 3.0, s1: 16.0, t0: 27.7, t1: 28.5, back: 3.55, front: 3.25 };   // a lean-to against the wall's lane
                                    // side. G: LIDAR 2.0 - 4.3 over t 27 - 28

// ------------------------------------------------------------------------------------------------ the court's ground (s, t)
export const COURT_BOX = { s0: 1.1, s1: 24.0, t0: 1.4, t1: 27.3 };
export const BORDER = 1.0;          // the planted border along the north and west ranges. G (photographs)
export const WALK_N = [2.4, 5.4];   // the raised walk along the north side (t). K: DSM +1.9 at t 3 - 5
export const WALK_W = [2.1, 4.6];   // the raised walk along the west side of the north lawn (s). K: DSM s 2.5 - 4.5
export const TERR = { s0: 19.3 };   // the raised terraces before the lodge (s 19.3 to the faces). K: DSM s 19 - 23.5
export const CROSS = [14.9, 18.3];  // the cross path from the west arch to the lodge (t). K: map lawns end 12.96 / start 16.16
export const LAWN_N = { s0: 4.6, s1: 19.3, t0: 5.4, t1: 14.9 };   // the sunk north lawn. K: map r12528130_1 2.7 - 17.7 x 3.4 - 13.0
export const LAWN_S = { s0: 3.5, s1: 18.4, t0: 18.3, t1: 26.7 };  // the south lawn. K: map r12528130 2.1 - 17.4 x 16.2 - 25.7
export const STEP = { rise: 0.167, going: 0.35 };   // three risers between the court and the walks / the lodge. G

// the chimney stacks (centre s, t; size; top). K: LIDAR peaks (12.7 - 13.5) in the frame; sizes G (photographs: tall ashlar
// stacks with clustered pots)
export const STACKS = [
  { s: -3.2, t: 4.7, top: 13.2 }, { s: -2.8, t: 11.8, top: 13.3 }, { s: -2.8, t: 21.5, top: 13.3 }, { s: -3.0, t: 28.0, top: 12.8 },
  { s: 0.0, t: -1.8, top: 13.5 }, { s: 6.5, t: -1.6, top: 13.5 }, { s: 13.5, t: -3.6, top: 13.5 }, { s: 17.7, t: -1.6, top: 13.4 },
  { s: 24.5, t: -2.0, top: 13.1 }, { s: 27.5, t: 6.3, top: 13.3, big: true }, { s: 26.5, t: 26.0, top: 13.4, big: true },
];

// the street (s, t): the site's boundary (SITE_RING) in the frame
export const BOUND = [[35.81, -7.98], [33.43, 16.78], [31.37, 29.45], [30.88, 33.66]];   // K: _somerville_shared.js SITE_RING
export const LOVEROSE = { t: -7.75, th: 0.45, h: 3.5, s0: 18.3, s1: 35.3, w0: 0.6, w1: 5.8, ramp: 2.6, pier: 4.6 };   // the
                                    // boundary wall on Loverose Way. K: Street View Aug 2024 (rubble, about 3.5 m, ramped up in a
                                    // quadrant at its east end); pier and ramp sizes G

export const CHECKED = [
  ['the court frame: the map\'s inner corners of r4047418, turned +6.0 deg; the map\'s outlines are square in it', 'K', 'map.json r4047418 / r4047418_1 / w227470836'],
  ['west range s -7.2 .. 0.5, north range t -7.3 .. 0.8 (between the map\'s faces and the LIDAR\'s roof edges)', 'K', 'map + LIDAR 2022 fsec (+-0.7 m)'],
  ['north range middle deeper to the boundary (s 5.5 .. 18, t -9.2), ridge 12.5', 'K', 'LIDAR (ridge 12.3 - 12.6; north edge t -8.3 at s 8 - 19); map 4.4 .. 17.2'],
  ['lodge range s 24.0 .. 29.6, ridge s 27 at +8.15: 3.5 m east of the map\'s lodge outline', 'K', 'LIDAR (ridge s 27.0, eaves edges 24.3 / 30.3); map w227470836 rejected'],
  ['NE block s 23.4 .. 31.0, t -7.3 .. 6.6, hipped, set forward of the lodge', 'K', 'LIDAR; Street View Mar 2026; Cairns 2019'],
  ['gateway block s 16.8 .. 29.2, t 24.8 .. 32.4, hipped, ridge 11.7', 'K', 'LIDAR; Street View Mar 2026 (two storeys, hipped)'],
  ['eaves 7.9 - 8.3, roof pitch 42 deg: every LIDAR ridge from its eaves', 'K', 'LIDAR fsec ridges 11.3 / 11.65 / 12.5 / 11.4 / 11.7'],
  ['the lodge range one storey and attic, eaves +5.35 just over the arch', 'K', 'Cairns 2019 (scaled: eaves 3.7 m over the step); LIDAR ridge 8.0 - 8.2'],
  ['the lane through the gateway block, along the court\'s south wall and through the west range\'s south end', 'K', 'map w97853755 / w97853790 / w97853742; LIDAR open ground t 29 - 31, roofs at both ends'],
  ['the cross axis t 15.3: west arch, cross path, lodge passage', 'K', 'map ways w97853746 / w97853787 / w97853791; DTM ground through the lodge at t 14 - 18'],
  ['court levels: lawns and cross path +1.45, raised walks and terraces +1.95', 'K', 'DTM 1.40 - 1.50; DSM 1.9 - 2.0 on the walks'],
  ['the walks\' layout (north, west and east of the north lawn; before the lodge\'s south half)', 'G', 'DSM pattern + photographs 01; widths guessed'],
  ['lodge passage floor +1.95, three steps up from the court in the arch, three (0.17) from the forecourt (the merge: the forecourt flush with the pavement)', 'G', 'survey 2 ("three steps up inside", I)'],
  ['forecourt strip, flagged, hoop cycle stands: flush with the city pavement at the boundary since the merge (+1.45 .. +1.6; no kerb)', 'K', 'Street View Mar 2026, Cairns 2019 (the level G: the city\'s pavement)'],
  ['coursed rubble limestone walls, ashlar dressings, graded stone-slate roofs', 'K', 'survey 5; photographs 01 (tint G)'],
  ['west range court face: square two-storey bay at its north end, 9 window bays, the arch with a shield either side above it', 'K', 'Street View Jun 2015, Cairns 2021'],
  ['west range: 9 small gabled (pedimented) dormers on the court slope', 'K', 'Cairns 2021 ("about 9")'],
  ['north range court face: 8 bays and the pedimented centre gable with a round-arched window and a panel under', 'K', 'Cairns 2021 (bay count partly G)'],
  ['north range court dormers 4', 'G', 'Cairns 2021 shows three of them'],
  ['blank shields between first-floor windows (other than over the arch)', 'G', 'photographs show some; positions guessed'],
  ['window sizes: 1.0 x 1.65 sashes, ground sills +2.6, first +5.2', 'G', 'storey heights from LIDAR eaves; proportions by eye from photographs'],
  ['lodge court face: arch between two two-storey hipped pavilions, dormer over the arch, one each side', 'K', 'Street View Jun 2015 (sizes G)'],
  ['lodge arch glazed in its head; the doors themselves left open (walkable)', 'G', 'Street View 2015 shows glazed doors: drawn open by the house rule'],
  ['lodge street face: arch with two-leaf oak doors open, sash south, narrow two-light window and slate plaque north, two hipped dormers', 'K', 'Cairns 2019; Street View Mar 2026'],
  ['flagpole on the forecourt north of the arch, a plain dark flag', 'K', 'Street View Mar 2026 (absent in 2019)'],
  ['NE block street face: 5 bays, shield panel in the middle bay, pedimented gable with a small window, deep bracketed eaves cornice', 'K', 'Street View Mar 2026; Cairns 2019 (north two bays G)'],
  ['gateway block: square-headed vehicle way with a flat lintel, a sash over it, a stack, bracketed cornice, setts in the mouth', 'K', 'Street View Mar 2026'],
  ['gateway block court face: doorcase with an oculus over it', 'K', 'Street View Jun 2015 (looking south); sizes G'],
  ['tall ashlar stacks at the LIDAR peaks', 'K', 'LIDAR 12.7 - 13.5; Cairns 2021 (6 seen); sizes G'],
  ['court south wall 2 m with a lean-to on its lane side, a gate at its west end', 'G', 'LIDAR 1.7 - 4.3; photograph 2015 (wall); lean-to and gate guessed'],
  ['west range WEST face (to the Traffic Quad) RED BRICK: two storeys and an attic, 6 over 6 sashes under brick heads, no stone surrounds, a pale eaves cornice', 'K', '02 .../Traffic Quad looking east ... (P Halling 2025).jpg; ... in snow (toblu 2017).jpg'],
  ['west face north of the wing: 6 first-floor and 4 ground-floor sashes, a small window by the archway (positions +-0.5 m)', 'K', 'Halling 2025, perspective taken out'],
  ['west face window sizes: first floor 5.35 - 7.2, ground 2.55 - 4.3, 1.0 wide', 'K', 'Halling 2025 scaled off the eaves and the yard (+-0.15)'],
  ['the single-storey brick porch t 3.3 - 6.9 with a stone doorcase and fanlight, flat roof under the first-floor sills', 'K', 'Halling 2025 (projection 1.6 G)'],
  ['the archway on the cross axis is the one in the photographs (beside the wing): kept; its west face a low round-headed brick arch, crown +4.35', 'K', 'Halling 2025, toblu 2017 (ring depth G)'],
  ['west slope: two small gabled dormers with pale fronts (t 2.9 and over the arch); a third south of the wing', 'K', 'Halling 2025, toblu 2017 (the third G)'],
  ['three ashlar stacks on the ridge at t 4.7, 11.8, 21.5 (unchanged: they are the LIDAR\'s and the photographs\')', 'K', 'LIDAR; Halling 2025; toblu 2017'],
  ['one lantern, on the wing\'s north face beside the archway (none north of it)', 'K', 'Halling 2025, toblu 2017'],
  ['brick garden wall square off the face at t 13.4, 4 m long, 1.6 m, with a stone-capped pier', 'K', 'LIDAR +1.5 m along t 13; Halling 2025, toblu 2017 (length G)'],
  ['planting along the face\'s foot', 'K', 'Halling 2025 (extent G)'],
  ['the west wing red brick too, t 19.3 - 25.5; its west and south windows', 'K', 'Halling 2025 (brick, its north face plain); LIDAR (windows G)'],
  ['the west range\'s south end (to the lane)', 'G', 'seen in no look: stone kept'],
  ['west range\'s south end passage for the lane (segmental arch 2.8 wide)', 'G', 'LIDAR roof over the lane; form guessed'],
  ['north faces on Loverose Way: small first-floor windows, hipped dormers', 'K', 'Street View Aug 2024 (count G)'],
  ['Loverose Way boundary wall 3.5 m, rubble, quadrant ramp up to a pier at the Woodstock Road end', 'K', 'Street View Aug 2024 (ramp and pier sizes G)'],
  ['lanterns on brackets either side of both arches (court side)', 'K', 'Cairns 2021; Street View 2015 (form G)'],
  ['lawns striped grass; lavender along the walks\' edges; one small tree south of the cross path; two benches', 'K', 'Street View 2015; Cairns 2021 (positions G)'],
  ['wisteria over the north-west corner', 'K', 'Street View 2015; Cairns 2021 (extent G)'],
];
