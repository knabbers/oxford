// Exeter College, STANDALONE model, part 'margary' (survey B09 + G02): THE PLAN of the THOMAS WOOD BUILDING (Brett &
// Pollen, 1964; staircases 12, 13, 14) and of MARGARY QUAD's ground. Pure data: every dimension a named constant with its
// source; the build functions are in _exeter_margary_build.js. LOCAL frame (u east, v south, y above the datum 64.40 m:
// _exeter_shared.js). Brief: docs/handoff/exeter/briefs/margary.txt.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * PLANNING 25/01093/FUL (Jessop & Cook 2025, reference/exeter/20 planning drawings/25_01093_FUL Thomas Wood Building/):
//     02 existing ground floor plan (1:100, scale bar: 43.6 px a metre at 110 dpi, 118 at 300 dpi) and 06 existing
//     elevations (all four faces, 86.3 px a metre at 220 dpi off the 5 m scale bar). Every window, band, parapet and
//     roof level below was scaled off 06 from the drawn ground line of its own face (+-0.05 m), every plan length off 02.
//     Frontages: Turl Street 29.2 (10.25 corner block + 12.48 Staircase 14 wing + 6.51 tower; plan 29.1), Broad Street
//     20.2 on the elevation and 19.6 on the plan: 20.0 taken. Depths: Turl wing 6.2 - 6.3, Broad wing 10.0 - 10.2, tower
//     10.1 (plan).
//   * LIDAR 2022 (tools/exeter_lidar.py lbox / u / v profiles at 0.25 - 0.5 m): the street faces read at u -23.9 (corner
//     block, tower) and about -23.2 (the middle wing: set back); the Broad Street face at v -62.1 (u -20) .. -61.8 (u -6),
//     the Broad wing's quad face at v -52.3 (u -12) .. -51.6 (u -6): the Broad wing is turned about 1.6 deg from the frame
//     (Broad Street's own line), the Turl faces are square to it. Roofs: corner block flat 75.9 (y 11.5); Broad wing pitched,
//     ridge 79.5 (15.1) 5.3 m in from the quad face, falling north to 75.9 at 8.2 m and south to a flat 78.45 (14.05); a
//     terrace 76.4 (12.0) behind the quad parapet; Turl wing flat 74.6 (10.2); the tower flat 81.3 (16.9) with its parapet
//     82.0 - 82.1 and a plant room 83.5 (19.1) over u -21.5 .. -16.5, v -38.3 .. -34.8; the tower's north face v -39.7 ..
//     -40, its south face against the west range's north end (v -33.3: the west range's plan). Taking the corner at
//     (-24.0, -62.3), the Turl frontage of 29.1 ends at v -33.2: the drawings and the LIDAR agree with the west range.
//     (The map's outlines w301630470 / 471 / 472 lie about 1 m east and 1.3 m north of the LIDAR's faces.)
//   * Photographs (reference/exeter/10 ...): wuppertaler 2019 (the corner from the north-west: six bays on Broad Street,
//     the fascia on both faces, the figure on the roof edge, the set-back wing and the tower beyond), I Cunliffe 2011
//     (the Turl face from the north: the slot windows W-04, deep plain reveals, the tower standing forward of the wing, a
//     bracket street lamp on the wing); 04 chapel/ "fleche close" (The wub 2025: the tower's top and the figure).
//   * Margary Quad's ground: the 1:500 topographic survey (DIMENSIONS.md: 63.75 - 64.00, 63.99 - 64.00 west / south-west),
//     LIDAR bare ground (64.0 at u -16, 63.9 at u 0, 63.75 - 63.8 at u 10 .. 20), the map (paved area w301630462, parking
//     w1418427625, driveway w1418427622 / 624, footways w1418427626 / 627, "Alma Mater" n13034659646, cycle parking
//     n13034659647), the satellite view by hand 2026-11-23 (a grey paved car park), planning 16/00769/LBC (the lamps).
//
// THE SOUTH-WEST CORNER OF THE QUAD (02 ground plan, read at 300 dpi; I + G): the tower's ground floor runs 10.1 m back
// from Turl Street; along its quad face a WALLED STAIR goes DOWN northwards in two flights (8 + 6 risers, arrows up to the
// south) behind a parapet wall: the topographic survey's "63.54(?) up to 64.06" read as 61.54 -> 64.06 (14 risers of 0.18 =
// 2.5 m): a basement stair, not a ramp to the Front Quad. South of it, between the tower and the Chapel's first north
// buttress, an open landing at 64.04 - 64.06, and the plan's hatch carries the Thomas Wood Building's ground floor over
// the 1.4 m strip between the west range's north end (v -33.3) and the Chapel's north wall (v -31.9) east of the Chapel's
// west gable (u -16.6): that strip is where the covered way from the Front Quad's north-west doorway comes out (survey
// section 12): its NORTH END is built here as a 1.15 m doorway in the strip's quad face onto the landing (G).

export const DATUM = 64.40;
export const Y = (mOD) => +(mOD - DATUM).toFixed(3);

// ------------------------------------------------------------------------------------------------ the plan (LOCAL u, v)
export const CORNER = [-24.0, -62.3];        // Turl x Broad corner. K: LIDAR faces (u -23.9, v -62.1 .. -62.3 at u -20)
export const BROAD_LEN = 20.0;               // Broad Street frontage. K: elevations 20.2, plan 19.6 (mean, +-0.3)
export const BROAD_ANG = 0.0275;             // the Broad wing's turn from the frame (rad): LIDAR faces 0.5 m over 20 m. K
export const BROAD_DEPTH = 10.0;             // street face to quad face. K: plan 10.0, LIDAR 9.6 - 10.1
/** the Broad wing's frame: x along Broad Street eastwards from the corner, z into the quad (south) */
export const BE = [Math.cos(BROAD_ANG), Math.sin(BROAD_ANG)];      // along the street (east)
export const BN = [-Math.sin(BROAD_ANG), Math.cos(BROAD_ANG)];     // into the quad (south)
export const bw = (x, z) => [CORNER[0] + BE[0] * x + BN[0] * z, CORNER[1] + BE[1] * x + BN[1] * z];
export const EAST_END = bw(BROAD_LEN, 0);    // = (-4.01, -61.75): the party wall with Scott's Broad Street range (part 'broad')

export const TURL = {
  uCorner: -24.0,          // corner block's Turl face. K: LIDAR -23.9 (u profiles v -56, -60); plan: 0.16 m forward of the wing
  uWing: -23.7,            // Staircase 14 wing's Turl face. K: plan (set back 0.2 - 0.4 and slanting), LIDAR -23.2 .. -23.5; figure G +-0.3
  uTower: -24.0,           // tower's Turl face. K: LIDAR -23.9; flush with the west range (u -24.3) on the plan
  uWingQ: -17.15,          // the wing's quad face. K: topographic survey fitted -17.12 (second pass; was -17.4: plan depth 6.2 - 6.3 from -23.7), LIDAR -17.0 .. -16.5 (one cell east-lean)
  uTowerQ: -13.5,          // the tower's quad face. K: plan 10.1 deep (-13.9), LIDAR edge -12.6 less the lean: +-0.4
  vCornerS: -52.05,        // south end of the corner block = the Broad wing's quad face there. K: elevation 10.25 from the corner
  vTowerN: -39.75,         // tower's north face. K: elevations 6.51 / 6.55 m tower, LIDAR -39.7 .. -40.0
  vTowerS: -33.3,          // tower's south face = the west range's north end. K: _exeter_west_plan.js RANGE.vN, LIDAR
  vChapel: -31.9,          // the Chapel's north wall face. K: _exeter_chapel_plan.js WALL_N
  uLinkW: -16.6,           // the link strip between the tower and the Chapel: from the Chapel's west gable (K chapel plan)
};

// ------------------------------------------------------------------------------------------------ levels (y above the datum)
export const GROUND = {
  broadW: -0.50, broadE: -0.65,          // Broad Street pavement at the corner / at the east end. K: LIDAR 63.90 / 63.75; elevation 1 ground falls 0.15 m to the east
  turlN: -0.50, turlS: -0.40,            // Turl Street pavement at the corner / at the tower. K: LIDAR 63.90 / 64.0; west plan STREET_GROUND
  foot: -1.1,                            // every wall is carried down to here (below every ground it stands in)
};
/** Margary Quad's paving (second pass): ONE smooth surface, a quadratic least-squares fit through the topographic
 *  survey's 19 spot levels in the quad (rms 0.037 m, worst 0.10 at its east edge): 63.98 - 64.05 along the west side, a
 *  shallow dish 63.75 - 63.82 in the north-east (to the gate passage's 63.77) and 63.85 - 63.90 in the middle, rising
 *  again to 63.99 along the east side and 64.0 by the Chapel. K: topographic survey 210239-P-10 (2021, planning 21/00354
 *  p20) registered on the LOCAL frame (see THE SECOND PASS below); LIDAR bare ground 63.8 - 64.0 agrees. Clamped to the
 *  quad's own box so a neighbour that reads it (part 'broad') never meets a wild extrapolation. */
export const quadY = (u, v) => {
  const du = Math.max(-18.5, Math.min(25, u)) - 2, dv = Math.max(-54.5, Math.min(-30.5, v)) + 43;
  return -0.57967 - 0.00421 * du + 0.00735 * dv + 0.00032 * du * du + 0.00044 * dv * dv + 0.00038 * du * dv;
};
export const LANDING_Y = Y(64.05);       // the landing at the south-west corner. K: topographic survey 64.04 - 64.06
export const BASEMENT_Y = Y(61.54);      // foot of the basement stair. G: the survey's "63.54(?)" read as 61.54 (14 risers)

// THE BROAD WING and the CORNER BLOCK (one body: x 0 .. 20 along Broad Street, z 0 .. 10 into the quad). Heights K
// (elevations 1 and 3, from the Broad pavement 63.75 and the quad 63.90; the two agree to 0.1 m).
export const BW = {
  parapet: 12.3,           // coping top. K: 12.9 above Broad St (63.75 + 12.99 = 76.7), 12.8 above the quad
  coping: 0.32,            // coping band height. K (drawn 0.06 above the face line; the photographs show a plain band) / G
  roof: 11.5,              // the flats behind the parapets. K: LIDAR 75.9
  shop: { top: 2.06, fascia: [2.06, 2.68], band: [2.68, 3.08] },   // shop opening, fascia, a stone band with recessed panels. K: elevation 1 (2.71 / 3.33 / 3.73 above the pavement)
  // the roof (section through the wing, z measured from the QUAD face northwards, i.e. d = 10 - z):
  terrace: 1.6,            // the roof storey's south wall stands 1.6 m back from the quad face. K: elevation 4 section (1.4), LIDAR 1.7
  storeyTop: 13.7,         // the roof storey's lead flat. K: elevation 3 (14.16 above the quad), LIDAR 78.45 (14.05)
  slopeFoot: 3.9,          // the south slope begins (d). K: elevation 4 section
  ridgeD: 5.4, ridge: 15.2, // K: elevation 1 ridge 15.87 above Broad St (79.6), LIDAR 79.5 at d 5.3
  northFoot: 8.3,          // the north slope reaches the flat (11.5). K: LIDAR 75.9 at d 8.2; elevation 4 section
  roofX0: 6.6,             // the pitched roof's west end (x from the corner; the corner block is flat). K: LIDAR (flat 75.9 west of u -17.5); elevation 3 (slate from the wing's quad face)
  hipRun: 2.4,             // the west end hipped. K: DIMENSIONS ("hipped"), elevation 2 profile; run G
  dormers: [{ x: 10.06, w: 2.08, base: 13.0, apex: 14.85 }, { x: 15.5, w: 2.08, base: 13.0, apex: 14.85 }],   // two triangular dormers W-10 on the north slope (x from the corner). K: elevation 1
  stairHead: { x0: 11.8, x1: 14.8, top: 13.2, roofTo: 13.7 },   // the stair head of Staircase 12 rising through the quad parapet with W-09 (3.2 m wide). K: elevation 3; top G
  statue: { x: 1.1, z: 0.35, h: 1.95 },   // the standing iron figure on the roof edge over Broad Street. K: photographs, elevation 1 (1.1 m from the corner); h G (brief: about 1.9)
};
// windows: rows (y of sill and head per floor; three floors 2.59 m apart). K: elevations 1 and 3
export const FLOOR = 2.59;
export const WIN_B = {
  W01: { w: 1.38, sill: 4.07, head: 5.93, panel: 4.35 },   // two lights over a sill panel, a transom at 4.35 (the drawn sill panel)
  W02: { w: 1.02, sill: 4.59, head: 5.93 },                 // single square-ish light
  W05: { w: 0.83, sill: 5.11, head: 5.51 },                 // small horizontal vent light
  W08: [[2.43, 4.54], [4.95, 7.15], [7.55, 9.72], [10.16, 12.15]],   // the stair strips' tall lights (elevation 3)
};
// Broad Street face, x from the corner (elevation 1 scaled to 20.0). K
export const BROAD_BAYS = [{ x: 1.62, k: 'W05' }, { x: 4.57, k: 'W01' }, { x: 7.35, k: 'W02' }, { x: 10.06, k: 'W01' }, { x: 12.72, k: 'W05' }, { x: 15.51, k: 'W01' }, { x: 18.23, k: 'W02' }];
// shopfront piers on Broad Street (x from the corner; pier width 0.45): K elevation 1. The corner bay (x 0 .. 3.5) is a
// recessed entrance bay; the east end a solid pier 0.6. G: the corner bay's form (no close photograph).
export const BROAD_PIERS = [6.05, 8.8, 11.5, 14.2, 16.9];
export const BROAD_SHOP = { x0: 0.25, x1: 19.4, pierW: 0.42, door: [0.6, 2.4] };
// the Broad wing's quad face: x of each bay measured from the Turl wing's quad face (elevation 3 x 0.949 to fit). K
export const BQ = {
  x0: null,                 // (set by the build: where the quad face meets the wing: u = TURL.uWingQ)
  bays: [{ d: 1.18, k: 'W02' }, { d: 3.80, k: 'W01' }, { d: 9.03, k: 'W01' }, { d: 11.64, k: 'W02' }],
  stair: { d0: 5.79, d1: 7.12 },             // Staircase 12's glazed strip W-08 with door D-01 at its foot. K
  vents: [1.17, 11.64], ventY: [3.1, 3.3], ventW: 0.76,
  band: [1.64, 1.99],                        // panel band over the plain ground floor. K: elevation 3 (2.14 - 2.49 above the quad)
};

// THE TURL WING (Staircase 14, v -52.05 .. -39.75) and the CORNER BLOCK's Turl face. K: elevation 2 / 4
export const TW = {
  parapet: 10.95, coping: 0.3, roof: 10.2,   // K: 11.4 above Turl St (64.0), LIDAR 74.6 flat
  band: [9.95, 10.65],                        // a plain deeper band under the coping on the quad face (elevation 4). K
  shopTop: 2.15,                              // shopfront head (2.6 above the pavement). K
  heads: [4.71, 7.30, 9.89],                  // window heads (Turl 5.16 / 7.75 / 10.36 above the pavement 63.95). K
  W02: { w: 1.04, h: 1.36 }, W04: { w: 1.97, h: 0.39 }, W01: { w: 1.38, h: 1.84 }, W03: { w: 0.75, h: 0.2, tops: [3.33, 5.94, 8.54] },
  // Turl face: d south from the corner block (v -52.05). K elevation 2 (x 0.982 to fit 12.25 m)
  street: [{ d: 1.02, k: 'W04' }, { d: 4.59, k: 'W02' }, { d: 7.73, k: 'W02' }, { d: 11.28, k: 'W04' }],
  // its shopfront: [d0, d1, kind] (elevation 2). K
  shop: [[0.05, 1.45, 'win'], [1.52, 2.78, 'door'], [3.1, 5.95, 'win'], [6.27, 7.73, 'win'], [7.76, 9.06, 'door'], [9.39, 12.15, 'win']],
  // quad face: d north from the tower (v -39.75). K elevation 4 (x 0.982)
  quad: [{ d: 2.41, k: 'W03' }, { d: 4.55, k: 'W01' }, { d: 7.71, k: 'W01' }, { d: 9.86, k: 'W03' }],
  stairs: [{ d0: 0.0, d1: 1.37, n: 14 }, { d0: 10.87, d1: 12.25, n: 13 }],   // the glazed strips W-08 + doors D-03 (14) / D-02 (13). K
  W08: [[2.44, 4.54], [5.02, 7.15], [7.62, 9.75]],
  quadBand: [1.68, 2.04],                      // panel band over the plain ground floor. K elevation 4
};
// the corner block's Turl face (d south from the corner). K elevation 2
export const CORNER_TURL = { bays: [{ d: 3.76, k: 'W02' }, { d: 6.91, k: 'W01' }], shopDoor: [5.85, 8.8], sign: [1.35, 2.2] };

// the quad faces' ground floor (second pass): openings where the first pass left plain ashlar. s along the face as built
// (wing: north from the tower's north face; Broad wing: east from the wing). The survey's door swings mark only the stair
// doors 12 - 14 (and the basement door at the stair's foot): these are G (the gym, the laundry, an accessible bedroom open
// off the quad: the access guide's words; which openings: G)
export const TW_GROUND = {
  wing: [{ s: 3.3, w: 1.38 }, { s: 6.15, w: 1.05, door: true }, { s: 8.9, w: 1.38 }],
  broad: [{ s: 2.6, w: 1.38 }, { s: 9.6, w: 1.38 }],
};

// THE TOWER (Staircase 14's south end, six storeys). K: elevations 2 and 4; LIDAR
export const TOWER = {
  parapet: 17.8, coping: 0.35, roof: 16.9,   // K: 18.24 / 18.3 above the street (63.95) = 82.2, LIDAR 82.0 - 82.1 at the edges, 81.3 inside
  plant: { u0: -21.5, u1: -16.5, v0: -38.3, v1: -34.8, top: 19.05 },   // K: LIDAR 83.5; elevations 19.45 - 19.5, 3.5 m wide (5 m across in LIDAR)
  heads: [3.25, 5.84, 8.43, 11.02, 13.61, 16.2],   // six window storeys. K: elevations 2 / 4 (3.70 + 2.59 n above 63.95)
  W01: { w: 1.2, h: 1.84 }, W02: { w: 1.03, h: 1.32 },
  street: [{ d: 1.84, k: 'W02' }, { d: 4.32, k: 'W01' }],   // d south from the tower's north face. K elevation 2
  quad: [{ d: 1.55, k: 'W02' }, { d: 4.45, k: 'W01' }],     // d south from the tower's north face. K elevation 4 (from the north end)
  plinth: 0.55,           // a plain base band 1 m high on the street (elevation 2: the tower's ground storey has no shopfront). K
};

// THE SOUTH-WEST CORNER: the landing, the basement stair, the way to the Front Quad. I / G (see the header)
export const SW = {
  landing: { u0: -13.5, u1: -10.65, v0: -34.3, v1: -33.1 },         // before the lobby, to the Chapel's first buttress (-10.65 its west side). K: survey ("64.06" here, the lobby's face at -33.1)
  lobby: { u0: -13.5, u1: -10.65, v0: -33.1, v1: -31.15, t: 0.17, top: 3.3, parapet: 0.35, door: [-11.95, -10.95], doorH: 2.2 },   // a single-storey block in front of the Chapel's west bay that the covered way comes out through. K: survey outline (u -14.4 .. -10.6, v -33.1 .. -31.25), LIDAR 67.3 - 68.2 over v -34 .. -33 (roof +3.3); G: its form, the door's place
  well: { u0: -13.5, u1: -12.2, vTop: -34.3, vBot: -39.6 },          // K: plan (1.4 m wide, 300 dpi read), +-0.2
  wallT: 0.35, wallTop: 0.55,                                         // the parapet wall on the quad side: 0.35 thick, top 0.95 above the quad. K form (plan: a coped wall), G height
  flight1: { n: 8, going: 0.27 }, landing2: 1.54, flight2: { n: 6, going: 0.25 },   // K counts (plan), goings scaled
  door: { v0: -39.45, v1: -38.6, h: 2.1 },                           // the basement door at the foot (in the tower's quad face). G
  passage: { v0: -33.0, v1: -31.95, h: 2.55, uIn: -15.3, yIn: -0.25 },   // the covered way's north end: its doorway in the link strip's quad face, its floor rising westwards to the west range's quad wall (u -15.3). G
  // (fix-up pass: v0 -33.15 -> -33.0 and the lobby's walls 0.28 -> 0.17 (a modern single-storey lobby, form G): the way's
  //  centre line then has 0.45 m to the lobby's north wall and 0.5 to the Chapel's corner; was 0.27 (walk tool))
};

// ------------------------------------------------------------------------------------------------ MARGARY QUAD's ground
// THE SECOND PASS (2026-11-23). New evidence: (1) the 1:500 topographic survey (Tim Moya Associates 210239-P-10, 2021,
// 21/00354/FUL p20; the 400 dpi render, 31.5 px a metre) registered on Margary Quad's own walls with the Front Quad pass's
// transform (LOCAL = survey axes turned 17.07 deg + (1.287, 0.822); its lawn-kerb origin re-found here at px (1675.36,
// 2479.72), the kerb's sides fitted at 16.8 - 17.3 deg) and checked by line fits to its dark pixels: the Thomas Wood
// wing's quad face -17.12 (model was -17.4: moved), its Broad wing's quad face 0.2 north of the model, the tower's north
// face +0.03, the basement well's west wall +0.1, the Chapel's north wall -31.14 .. -31.0 (+0.01 .. +0.18), its north
// buttress fronts -32.9 (+-0.1), Scott's wide bay -0.0, Scott's west bays +-0.25, the gate passage's west wall -0.05,
// staircase 9's face -0.3 .. -0.45 (u 24.4 .. 24.5 against 24.05), the Rector's Lodgings' west face 0.38 - 0.50 WEST of
// the model (part 'rector': reported); (2) the 2016 paving plan of the whole quad (16/01398/LBC 3235-BGS-A-02-100, 1:200,
// read at 150 dpi, 29.4 px a metre on its bar, registered on the TW faces: the Chapel's buttress rhythm falls within 0.2)
// with its photograph (weathered York flags, grey / pink granite setts, a gully, railings, cycles, cars); (3) the satellite
// view by hand 2026-11-23 second pass (registered on the Front Quad lawn's corner: the statue, the cycles, the bins).
// HOW THE SURFACE IS READ: the paving plan (K, the pattern) and the topographic survey (K, 2021 outlines) agree once the
// survey's labels are read as the plan's: York-stone FLAGS everywhere along the faces, round and between the panels and in
// the driveway; granite SETTS in five panels in a row (the survey outlines the three eastern ones, shortened at their north
// ends by the 2016 flag row, and writes PAVING beside them), in the parking bays against the Chapel and in the big bay in
// the east half (the survey's COBBLE STONES labels stand in those). Tint: pale buff flags and pale grey setts (the
// satellite: the quad reads pale buff-grey, close to the stonework).
/** the ground's level everywhere in the ring: the quad's fitted surface, and along the way round the apse a straight
 *  slope from the quad (v -31) to the Front Quad's paving at v -19.3 (K: the 2021 survey 63.85 .. 63.99 .. 64.10 .. 64.19
 *  .. 64.23 along it (22/01763 notes), no steps drawn; "level access from the Front Quad": the access guide) */
export const FQ_EDGE_Y = (u) => -0.025 - 0.0071 * u + 0.006 * -19.3 + 0.045;   // the Front Quad's paving at its north edge (exeter_grounds.js quadY + 0.045)
export const groundY = (u, v) => (v <= -31 ? quadY(u, v) : quadY(u, -31) + ((v + 31) / 11.7) * (FQ_EDGE_Y(u) - quadY(u, -31)));
// the RECTOR'S LODGINGS' frame (copied from _exeter_rector_plan.js A, O, toL, to keep the parts apart): e east, s south
const RA = (5.4 * Math.PI) / 180, RO = [22.04, -23.26];
export const rL = (e, s) => [+(RO[0] + e * Math.cos(RA) - s * Math.sin(RA)).toFixed(3), +(RO[1] + e * Math.sin(RA) + s * Math.cos(RA)).toFixed(3)];
/** the raised flagged forecourt along the Lodgings' west front at 64.39 (the "Vista": Palmer's Tower's gate passage opens
 *  on it at 64.41: part 'east'), from the bed to the tower's north face (s -1.21; the Lodgings' face at e -0.44: part 'rector'), two steps up along
 *  its whole west edge, the main door at its north end (survey: a walled box u 19.0 .. 22.4, v -33.0 .. -24.9 with "64.39"
 *  and a double line on its west side; K outline and level, G the two steps' form). House frame: e from the face, s south. */
export const TERRACE = { e0: -3.95, e1: -0.44, s0: -9.95, s1: -1.21, y: Y(64.39), tread: 0.25, rise: 0.2 };
/** the walled bed in front of the Lodgings' north part (survey: a double-walled box u 19.6 .. 22.8, v -39.0 .. -33.1;
 *  K outline; a raised bed planted with shrubs G, or a light well: not settled) */
export const BED = { e0: -3.55, e1: -0.44, s0: -15.8, s1: -9.95, wallT: 0.25, top: 0.5, soil: 0.4 };
// the quad's ground ring (LOCAL), clockwise from the Thomas Wood corner: the TW faces, under the Broad Street range (to v
// -54.2: its recessed bays), the gate passage's mouth, staircase 9's landing (part 'broad' draws it and its stair: left
// out), staircase 9's face, the bed and the forecourt (built here, left out), Palmer's Tower (part 'east': a gate tower
// turned 5.3 deg, NW corner (17.39, -24.91), its west face to (16.81, -18.66)), the way round the apse to the Front Quad (v -19.3), the apse and the Chapel's north side (the Chapel's own aprons
// fill from v -31.9 to its walls), the lobby and the landing at the south-west corner, the basement stair.
export const QUAD_RING = () => [
  [-4.27, -54.2], [24.3, -54.2], [24.3, -51.4], [22.15, -51.4], [22.15, -47.2], [22.75, -47.2], [22.75, -42.3], [24.05, -42.3], [24.05, -38.95],
  rL(BED.e0, BED.s0), rL(BED.e0, BED.s1), rL(TERRACE.e0, TERRACE.s0), rL(TERRACE.e0, TERRACE.s1),
  [17.39, -24.91], [16.86, -19.3], [11.5, -19.3], [11.5, -21.69], [12.95, -23.69], [12.95, -27.21], [11.5, -29.21], [9.3, -31.9],
  [-10.65, -31.9], [-10.65, -34.3], [-12.2, -34.3], [-12.2, -39.75], [TURL.uWingQ, -39.75], [TURL.uWingQ, -52.12], [-4.27, -51.75],
];
export const LIGHT_WELL = { u0: 5.0, u1: 11.6, v0: -52.3, v1: -51.0 };   // the basement area before Scott's wide bay and on in front of staircase 10's recess (part 'broad' WELL): left open. K: survey (railing u 5.0 .. 12.2 at v -51.1, back wall -52.25), 16/01398 elevation (the flight's head about u 11.6: fix-up pass)
// FLAGS and SETTS (K: 16/01398 paving plan, registered; +-0.3)
export const SETT_PANELS = [      // convex pieces: panel 1, the strip joining 1 and 2 at their south ends, panel 2 round the statue's flagged square, 3, 4, 5
  [[-13.05, -50.55], [-10.0, -50.45], [-10.0, -41.7], [-13.0, -41.7]],
  [[-10.0, -44.3], [-9.25, -44.3], [-9.25, -41.68], [-10.0, -41.7]],
  [[-9.25, -50.45], [-5.7, -50.35], [-5.71, -47.55], [-9.25, -47.55]], [[-9.25, -44.32], [-5.73, -44.32], [-5.75, -41.65], [-9.25, -41.68]],
  [[-9.25, -47.55], [-8.85, -47.55], [-8.85, -44.32], [-9.25, -44.32]], [[-6.0, -47.55], [-5.71, -47.55], [-5.73, -44.32], [-6.0, -44.32]],
  [[-4.7, -49.0], [-1.42, -49.0], [-1.38, -41.76], [-4.69, -41.79]],                          // panel 3 (north end shortened by the 2016 flag row: survey -49.0)
  [[-0.4, -49.0], [2.92, -49.0], [3.0, -41.72], [-0.4, -41.72]],                              // panel 4
  [[3.92, -49.0], [7.27, -49.0], [7.34, -41.65], [3.95, -41.65]],                             // panel 5
];
/** the ground tints (multipliers on the city's 'paving' and 'setts' cells). Fix-up pass: the setts were a dark brown-grey
 *  beside the flags (2.05 on the setts cell, whose painted granite is about a third as bright as the flags'); the vertical
 *  satellite view (13 aerial ..., "margary quad ... vertical 12.4 px per m ... second pass") and the 16/01398 photographs show
 *  the whole quad pale, the setts only a little greyer than the flags: raised to land the panels' mean within about 10 % of
 *  the flags' (a touch greyer), the joints still dark. G (judged on the pictures). Parts 'broad' (the gate passage's floor)
 *  and 'west' (the Turl Street apron) use the same setts tint. */
export const FLAGS_TINT = [1.22, 1.15, 1.02];
export const SETTS_TINT = [2.95, 3.0, 3.0];
export const STATUE_SQUARE = [[-8.85, -47.55], [-6.0, -47.55], [-6.0, -44.32], [-8.85, -44.32]];   // flagged, round the plinth. K plan (3 x 3 with a 1.6 circle)
/** parking bays against the Chapel (setts), each with a kerb stop at its north end (the survey's three 2.9 x 0.58 bars) */
export const BAYS = [
  { u0: -9.3, u1: -5.95, v0: -39.73, stop: [-9.0, -6.1] },
  { u0: -4.56, u1: -1.73, v0: -39.89, stop: [-4.7, -1.55] },
  { u0: -0.23, u1: 2.56, v0: -39.75, stop: [-0.25, 2.5], bins: true },       // the BINS enclosure since (survey 2021)
  { u0: 4.0, u1: 6.99, v0: -39.9, v1: -35.36 },                               // short: the Chapel steps
];
export const BIG_BAY = [[8.74, -49.71], [13.77, -49.67], [14.07, -35.09], [8.74, -35.1]];   // the large parking bay in the east half (setts). K plan; the survey's COBBLE STONES
export const STOP = { v0: -39.8, v1: -39.25, h: 0.22 };   // kerb stops: low stone sleepers. K survey outline; G height and that they are stops (the satellite: pale bars)
// THE BINS ENCLOSURE in bay 3 (survey "BINS": a wall u -0.35 on the west, a single line u 2.7 on the east from v -37.1, open
// at the north-east; LIDAR 65.2 - 65.6 there): timber-boarded screens 1.7 m (G), bins inside (the satellite: green).
export const BINS = { u0: -0.35, u1: 2.7, v0: -39.2, v1: -31.15, eastFrom: -37.1, h: 1.7, t: 0.12 };
// THE STEPS TO THE CHAPEL'S NORTH DOOR (survey: a landing at "65.0x" u 2.75 .. 4.2 against a projection of the Chapel's
// north side (its face v -33.45 from u 2.75 to 7.8; LIDAR 68 - 70 over it) and treads at 0.25 m from u 4.2 to 6.2, climbing
// WEST; the 2016 paving plan draws the same flight with a low wall round it; the 2007 site plan the 4.7 x 2.0 projection).
// UP, not down: the survey's spot level 65.0x stands on the landing, 1.15 m above the quad (63.86 beside it).
export const CHAPEL_STEPS = { u0: 2.75, uL: 4.2, u1: 6.2, v0: -34.75, v1: -33.45, n: 8, yTop: Y(65.05), wall: 0.2, wallH: 0.85 };
export const CHAPEL_DOOR = { u: 3.5, w: 1.0, h: 2.2 };   // the door the steps serve, in the projection's north face (v -33.45): G place and size (part 'chapel' to build)
// furniture
export const ALMA_MATER = { u: -7.42, v: -46.1, base: 0.8, baseH: 0.45, ped: [0.55, 0.85], h: 1.75 };   // K place: the paving plan's circle in the flagged square, the satellite's statue (-7.8, -45.8), the survey's SCULPTURE label; marble (OSM 2025, J. de Alberdi 1968). Form G (a plain abstracted figure)
export const GULLIES = [[-1.57, -50.24], [2.82, -50.26], [9.1, -49.3], [14.9, -51.6], [17.0, -48.3], [16.25, -39.1], [16.0, -36.5], [14.6, -41.4], [13.2, -40.5]];   // K first two (plan: "slab cut round the gully"); the rest the survey's dots, read as gullies G
export const PLANTERS = [{ u: 13.2, v: -48.0, w: 0.9, rot: 0.6 }, { u: 15.5, v: -49.4, w: 0.7 }, { u: 19.9, v: -50.4, w: 0.7, round: true }, { u: -15.9, v: -49.6, w: 0.9 }];   // K the survey's squares / circle (and the satellite's green by the TW corner); planters G
export const PASSAGE_BOLLARD = { x: 25.2, z: 1.1 };   // the survey's box in the gate passage near its street end (range frame, part 'broad'): a removable bollard G
// cycles: the satellite's dark patch along the TW wing (u -15.3 .. -9.8, v -51.6 .. -44.7); the paving plan's photograph
// (cycles against the walls). Stands K; rows, count and the bicycles G.
// (fix-up pass) the rows kept off the doors' approaches: the west row starts 0.8 m south of staircase 13's door (v -50.62 ..
// -52.0); the Broad wing's row moved east of staircase 12's door (u -11.36 .. -10.03): before, the stands stood across the
// way to 13 (the walk tool's 0.53 m headroom at (-15.1, -51.2) was a bicycle) and in front of 12.
export const CYCLES = { rows: [{ u: -16.35, v0: -49.8, v1: -44.6, n: 6, axis: 'u' }, { v: -51.25, u0: -9.3, u1: -6.3, n: 4, axis: 'v' }], bikes: 7 };
export const TREE = null;      // (first pass: "one small tree by staircase 14", G: none seen in the 2016 plan or the satellite: replaced by a planter by the TW corner)
// lamps (16/00769/LBC: C1 x 4 on the TW by staircases 12, 13, 14; W1 on the Chapel's north wall). K: which walls; G: places, heights
export const LAMPS = [
  { u: -17.15, v: -40.3, y: 2.55, face: 'E' },     // C1 by Staircase 14
  { u: -17.15, v: -46.0, y: 2.55, face: 'E' },     // C1 on the west side, middle
  { u: -17.15, v: -51.4, y: 2.55, face: 'E' },     // C1 by Staircase 13
  { d: 5.45, y: 2.55, face: 'S' },                // C1 by Staircase 12 (d along the Broad wing's quad face from the wing)
  { u: -3.4, v: -31.15, y: 3.0, face: 'N' },      // W1 on the Chapel's north wall (moved onto the rebuilt wall, mid-bay)
];
export const STREET_LAMP = { v: -41.5, y: 5.4, arm: 1.0 };   // the city's bracket lamp on the wing's Turl face. K: Cunliffe 2011 (south end of the wing); G place

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['corner (-24.0, -62.3); Turl frontage 29.25 = corner block 10.25 + wing 12.3 + tower 6.45 (to v -33.3, the west range)', 'K', '25/01093 elevation 2 (29.24) and plan (29.1); LIDAR faces; west plan vN -33.3'],
  ['Broad Street frontage 20.0, turned 1.6 deg with Broad Street; east (party) wall at u -4.0, v -61.75 .. -51.75', 'K', 'elevation 1 (20.2), plan (19.6), LIDAR faces and the Scott stack at u -3'],
  ['Broad wing 10.0 deep; Turl wing 6.3 deep (quad face u -17.4); tower 10.5 deep (quad face u -13.5)', 'K', 'plan 10.0 / 6.2 / 10.1; LIDAR edges; tower face +-0.4'],
  ['the wing\'s Turl face set back 0.3 from the corner block and the tower', 'K', 'plan; LIDAR; Cunliffe 2011 (the tower stands forward); figure G'],
  ['parapets: Broad wing and corner block 12.3, Turl wing 10.95, tower 17.8; flats 11.5 / 10.2 / 16.9', 'K', 'elevations 1 - 4 (12.9 / 11.4 / 18.3 above the street); LIDAR 75.9 / 74.6 / 81.3'],
  ['plant room on the tower to 19.05 over u -21.5 .. -16.5, v -38.3 .. -34.8', 'K', 'LIDAR 83.5; elevations ("not surveyed", 19.5)'],
  ['Broad wing roof: terrace behind the quad parapet, a roof storey (lead flat 13.7) with doors and windows to the quad, slate slopes to a ridge 15.2 at 5.4 m from the quad face, north slope to the flat at 8.3 m; hipped west end at x 6.6', 'K', 'elevations 1, 3, 4 (section); LIDAR profile u -12; hip run G'],
  ['two triangular dormers W-10 on the north slope', 'K', 'elevation 1'],
  ['Staircase 12 stair head rising through the quad parapet with a W-09 light, top 13.2', 'K', 'elevation 3; top and roof G'],
  ['corner block flat roof (no pitched roof): the four clustered stacks drawn behind it on elevation 2 are Scott\'s (part broad)', 'K', 'LIDAR flat 75.9 over u -22 .. -18; wuppertaler 2019'],
  ['Broad Street windows: W-02 | W-01 | W-05 | W-01 | W-02 | W-01 | W-05 from the east, three floors 2.59 apart', 'K', 'elevation 1 (positions +-0.05 m), DIMENSIONS.md; wuppertaler 2019'],
  ['window sizes: W-01 1.38 x 1.86 two lights over a sill panel; W-02 1.02 x 1.34; W-05 0.83 x 0.40; W-04 1.97 x 0.39; W-03 0.75 x 0.2; W-08 stair strips', 'K', 'elevations 1 - 4'],
  ['deep plain reveals 0.32 m, dark metal frames, no sills or dressings', 'K', 'wuppertaler 2019, Cunliffe 2011 (reveals); depth G'],
  ['Turl wing: slot windows W-04 at both ends, two W-02 between, three floors offset from the corner block (heads 4.71 / 7.30 / 9.89)', 'K', 'elevation 2; Cunliffe 2011'],
  ['tower: six storeys of W-02 and W-01 columns on both faces, heads 3.25 + 2.59 n; a plain base on Turl Street', 'K', 'elevations 2 and 4'],
  ['tower: the panel lines round the W-02 column on elevation 2 not modelled (flat face)', 'G', 'depth not given'],
  ['shopfront on Broad Street: dark frames, five piers, a recessed corner entrance bay; fascia 2.06 - 2.68, a panelled stone band to 3.08', 'K', 'elevation 1; wuppertaler 2019; the corner bay\'s form G'],
  ['shopfront on the corner block\'s Turl face with the fascia; the wing\'s lower shopfront (doors and windows) without a fascia', 'K', 'elevation 2; Cunliffe 2011; wuppertaler 2019'],
  ['fascia lettering BLACKWELL\'S ART & POSTER SHOP in plain gold capitals on dark: painted as geometry (a 5 x 7 block font), on Broad Street and on the corner block\'s Turl face', 'K', 'wuppertaler 2019 (the words); letter form and size G'],
  ['quad faces: ground floor plain ashlar under a panelled band (shop back rooms), three floors of W-01 / W-02 / W-03', 'K', 'elevations 3 and 4 ("ground floor out of scope": no openings drawn); the plain ground floor G'],
  ['Staircase doors: 12 at the foot of the glazed strip on the Broad wing\'s quad face, 13 and 14 at the ends of the Turl wing\'s quad face, each under a strip of tall lights', 'K', 'plan (D-01, D-02, D-03), elevations 3 and 4'],
  ['the standing iron figure on the roof edge 1.1 m from the corner over Broad Street, 1.95 m, plain (no likeness)', 'K', 'wuppertaler 2019; elevation 1; height G'],
  ['galvanised balustrades on the parapets and the terrace', 'K', 'elevations ("approximate position")'],
  ['pale ashlar cladding a little lighter than the Bath stone', 'K', 'photographs; the tint G'],
  ['the link strip between the tower and the Chapel (u -16.6 .. -13.5, v -33.3 .. -31.9) built full height with the tower', 'K', 'plan hatch; LIDAR 80 - 82 over it; G its upper form'],
  ['the covered way\'s north end: a 1.05 x 2.55 doorway in the tower strip\'s quad face, opening into the lobby; floor rising to -0.25 at the west range\'s quad wall (u -15.3)', 'G', 'survey section 12 (the Front Quad doorway); plan hatch; no picture of this end'],
  ['a single-storey lobby u -13.5 .. -10.65, v -33.1 .. -31.15 before the Chapel\'s west bay, roof +3.3, the covered way out through it', 'K', 'topographic survey outline (u -14.4 .. -10.6, v -33.1 .. -31.25); LIDAR 67.3 - 68.2 at v -34 .. -33'],
  ['the lobby\'s form: plain ashlar walls 0.17 thick (fix-up pass: was 0.28; room for the way through), a coped parapet, an open door 1.0 m wide at u -11.95 .. -10.95 in its north face with a small lantern', 'G', 'no picture'],
  ['basement stair along the tower\'s quad face: 8 + 6 risers down to 61.54 behind a coped parapet wall', 'K', 'plan (two flights, arrows up to the south, the wall); topographic survey (63.54 / 64.06, its outline u -13.4 .. -11.9); 16/01398 paving plan (a walled slot); 61.54 read for "63.54(?)": G'],
  ['basement door at the stair\'s foot in the tower\'s quad face', 'K', 'topographic survey: a door swing there (second pass); size G'],
  ['landing at 64.05 between the stair, the lobby and the Chapel\'s first buttress', 'K', 'topographic survey 64.04 - 64.06; plan'],
  ['the topographic survey registered on Margary Quad: TW wing face -17.12 (moved from -17.4), Broad wing face 0.2 N, tower N face 0.03, Chapel N wall 0.0 - 0.18, its buttress fronts -32.9, Scott\'s bays 0.0 - 0.25, staircase 9 0.3 - 0.45 W, the Lodgings\' west face 0.38 - 0.50 W of the model', 'K', 'line fits to the survey\'s dark pixels with the Front Quad pass\'s transform (exeter_grounds.js)'],
  ['Margary Quad\'s paving: a smooth quadratic surface through the survey\'s 19 spot levels (63.74 - 64.00; rms 0.037)', 'K', 'topographic survey 2021; LIDAR bare ground'],
  ['York-stone flags over the quad, along the faces and between the panels; granite setts in five panels (3.3 x 8.5), the parking bays by the Chapel and the big bay in the east half', 'K', '16/01398/LBC paving plan 1:200 (registered, +-0.3) and its photograph; topographic survey (PAVING / COBBLE STONES, the three eastern panels outlined, shortened at the north by the 2016 flag row)'],
  ['the tints: pale buff flags, setts only a little greyer (raised in the fix-up pass from a dark brown-grey)', 'G', 'satellite by hand 2026-11-23 second pass (the whole quad pale buff-grey); 16/01398 photographs'],
  ['parking bays between the Chapel\'s north buttresses with stone kerb stops (2.9 x 0.58) at their north ends; a big bay 5.3 x 14.6 in the east half', 'K', '16/01398 (bays with a bar at the north end); topographic survey (the three bars); satellite (cars)'],
  ['that the bars are low stone kerb stops 0.22 high', 'G', 'satellite: pale bars; not seen close'],
  ['no cars (the game has no cheap parked-car prop)', 'G', 'satellite: about seven cars'],
  ['the bins enclosure in the third bay: u -0.35 .. 2.7, v -39.2 .. -31.15, open at the north-east', 'K', 'topographic survey "BINS"; satellite (green bins); LIDAR 65.2 - 65.6'],
  ['its form: weathered timber-boarded screens 1.7 m (mid brown-grey) on timber posts; two 1100-litre and four 240-litre bins, green and grey', 'G', 'no picture (the satellite: green bins)'],
  ['steps UP to a door in the Chapel\'s north side: landing 65.05 at u 2.75 .. 4.2, eight risers climbing west from u 6.2, a low coped cheek wall on the north', 'K', 'topographic survey (landing level 65.0x, treads at 0.25); 16/01398 (5 treads drawn, a low wall round); 2007 site plan (4.7 x 2.0 projection); LIDAR 65.1 - 66.0'],
  ['the Chapel\'s north door itself and the projection it is in (u 2.75 .. 7.8 to v -33.45): NOT built here (part chapel)', 'G', 'door place G: u 3.5, 1.0 wide, sill 65.05'],
  ['the way round the apse: a slope from the quad (63.99) to the Front Quad\'s paving (64.2), no steps', 'K', 'topographic survey and the Nex plan levels 63.76 .. 64.19; the access guide ("level access from the Front Quad"); the first pass\'s three steps removed'],
  ['the raised flagged forecourt at 64.39 along the Lodgings\' west front (u 19 .. 22.4, v -33.2 .. -24.9) with two steps along its west edge', 'K', 'topographic survey (outline, "64.39", a double line on the west); the steps\' form G'],
  ['the walled bed north of it (u 19.6 .. 22.8, v -39 .. -33.1), planted', 'K', 'topographic survey (a double-walled box); that it is a bed and not a light well, and the planting: G'],
  ['"Alma Mater" (J. de Alberdi 1968, MARBLE) at (-7.42, -46.1) on a round base 1.6 m in a flagged square 3 x 3', 'K', '16/01398 paving plan (square and circle); satellite (the statue and its shadow); survey SCULPTURE; OSM (marble); the map node (-3.7, -43.1) is 4.4 m off'],
  ['the statue\'s form: a plain pale abstracted standing figure on a pedestal', 'G', 'no picture'],
  ['Sheffield cycle stands along the TW wing and the Broad wing\'s west end, with bicycles', 'K', 'satellite (a dark patch of cycles there); 16/01398 photograph (cycles against the walls); rows, count G'],
  ['gullies: two at the north ends of panels 3 and 4', 'K', '16/01398 ("slab cut round the gully")'],
  ['the survey\'s other dots read as gullies; its squares and a circle as planters', 'G', 'survey outlines only'],
  ['TW quad faces\' ground floor: a glazed door and two windows on the wing, two windows on the Broad wing (the gym, the laundry, an accessible bedroom)', 'G', 'access guide words; no drawing of the ground floor openings'],
  ['lamps: four modern wall lanterns (C1) on the TW by staircases 12, 13, 14; a W1 lantern on the Chapel\'s north wall', 'K', '16/00769/LBC plan p.22; places and heights G'],
  ['a bracket street lamp on the wing\'s Turl face', 'K', 'I Cunliffe 2011; place G'],
];
