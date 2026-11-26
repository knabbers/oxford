// Exeter College, STANDALONE model, part 'rector' (survey B05 Chapel Row, B06, G03): THE PLAN of the Rector's Lodgings
// (G. G. Scott 1857; the garden back remodelled 1947-9 "to match the Old Ashmolean"), of Chapel Row (the surviving piece
// of the 1432 range east of Palmer's Tower) and of the Rector's Garden with its walls. Pure data: every dimension a named
// constant with its source; the build functions are in _exeter_rector_build.js. LOCAL frame (u east, v south, y above the
// datum 64.40 m: _exeter_shared.js). Research: docs/research/exeter_survey.md B05, B06, G03, sections 2, 3, 11 - 13.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (tools/exeter_lidar.py: 1 m and 0.5 m boxes over u 15 .. 60, v -50 .. -1, surface and bare ground; a
//     scratch picture of the surface 70.5 .. 83 m on the LOCAL frame with the map's outlines). What it shows:
//       - the WEST BLOCK (Scott's quad range): a north-south ridge 16.3 - 17.1 at u 26.5 - 27.5 from v -23.5 to -37, eaves
//         10.4 - 11.4 on both sides (west at u 22.3 (v -26) .. 24.0 (v -39.5), east at u 30.6 - 31.0): a steep (53 deg)
//         slated roof over a block 8.6 m deep; a row of stacks 17.9 - 18.6 at v -37.5 .. -38 (u 25 .. 29.5) on its north end,
//         beyond which the roofs fall to 10 - 14 (staircase 9 / the Crowther Hunt Building, part 'broad'); a low thing 2.2 -
//         4.3 m high standing 1 m out from the west face at v -31 .. -32.5 (the porch of the main entrance: K that it is
//         there, form G).
//       - the EAST WING: an east-west ridge 15.5 - 16.1 at v -31.6 (u 29 .. 42), eaves 9.7 - 10.4 along v -27 (the south
//         face, u 31 .. 42) and about 9.7 to the north; a coped gable on its east end at u 42.6 (14.9 at the face);
//         a north-south ridge 15.1 - 15.8 at u 34.5 - 35 running north from it to a gable at v -39.8 (planning 18/00694: the
//         north gable's apex 16.1 above the courtyard, which LIDAR puts at +0.0); a flat-roofed piece 9 - 10 m high at
//         u 37 .. 43, v -36.5 .. -39.5; a stack 16.2 at u 37.5 - 39.5, v -34.5 .. -35.
//       - CHAPEL ROW: a range 4.3 - 5.4 m deep east of Palmer's Tower: ridge 10.3 - 10.9 at v -20.5 .. -21 (u 23 .. 31),
//         eaves 8.4 - 8.8 on the north (v -22.5 .. -23) and 7.7 - 8.2 at v -17.5 on the south east of u 28 (west of u 27.3
//         part 'east' has built the covered way and its block to 8.8, v -18.6 .. -16.6); the east end at u 32.5 - 33 reads
//         7.1 - 8.4: a hip. ITS PLACE: EAST of the tower (u 23.2 .. 32.6), not north of it: north of the tower stands the
//         Lodgings' west block (14 - 17).
//       - the GARDEN: lawn -0.6 (63.8) everywhere from v -5 to -33 east of u 31.5; a strip 2.5 m wide along the east range
//         at -0.0 .. -0.2 (u 26.8 .. 29.5) and along Chapel Row's south side to u 31 (a raised walk); the ground at the
//         library's north side 0.0 (a planter); a tree 5.5 above the lawn at u 31 .. 36, v -10 .. -5 and a small one 3 m by
//         the annexe (u 45 .. 47, v -16 .. -12); the north boundary: a low roof 2.0 - 3.1 (u 44 .. 57, v -34 .. -38) in
//         front of the Old Ashmolean's back (13.4 - 14.6 from v -38.6); the Schools wall at u 56 - 57.5 reading 2.3 - 3.2
//         (urns 4.5); the Sheldonian yard beyond it at +0.1 .. +0.2.
//   * PLANNING: 25/01435/LBC (Jessop & Cook 2025): heritage statement "four storeys and a basement level, with the main
//     entrance facing the Margary Quad and further access to upper storeys from the Palmer's Tower"; ashlar, slated
//     pitched roofs with gable ends; long section C-C (1:50, scale bar) through "Palmer's Tower Room 4" (2nd floor of the
//     Lodge): floor to ceiling 3.2 m, 6-over-6 sashes, an attic over. 18/00694/FUL (BGS 2018): the Lodgings' north gable to
//     the courtyard apex 16.1, chimney 16.8, a two-storey canted bay with a balcony. 21/00354/FUL topographic survey: the
//     Rector's Garden 63.77 - 63.87, Margary Quad 63.75 - 64.00 (63.75 along its east side). (26/02068/LBC is the tower's
//     own refurbishment: part 'east'.)
//   * PHOTOGRAPHS: 07 "east gable from Sheldonian yard" (Tilman2007 2025: square-on enough to scale: gable base 330 px for
//     9.2 m, apex 16.3 at y 450): the coped ashlar gable with a round-arched recess (2.8 m wide, springing 8.9, crown 10.25)
//     holding a 6-over-6 sash, strings at 5.5 and 8.4, a sash below; left of it the west block's east slope with a white
//     Gothic dormer of two pointed lights, Chapel Row's east end below; right the slate roof of the north wing and a tall
//     ashlar stack of two round shafts. 07 "gable over Sheldonian yard wall" (Ozeye 2009). 07 "classical elevation"
//     (Basher Eyre 2015): two storeys of 6-over-6 sashes in five bays (three, a channelled strip, two), channelled quoin
//     strips, a sill band, a moulded cornice, three round-headed dormers, a door with a pedimented hood on brackets in the
//     second bay, the Gothic return to the right, a tall stack. WHICH FACE: the south face of the east wing (v -27, u 31 ..
//     42), facing the Rector's Garden: (1) the LIDAR puts a 9.7 eaves line along it and its ridge high behind (two storeys +
//     attic), every other face of the house is either Scott's steep Gothic (the west front, the gables) or hidden; (2) its
//     return on the right is the east gable (Gothic, sashes), on the left lower roofs (Chapel Row), as the photograph
//     shows; (3) the conference guide: the Drawing Room (ground floor) opens on "a private walled garden outside the room";
//     (4) the VCH: the BACK was remodelled; the front faces Margary Quad (25/01435). 14 "Sheldonian yard west wall"
//     (Camboxer 2026) and "Sheldonian yard south side" (S Daniels 2009): the Schools wall's yard side. 02 conference guide
//     p7: the garden (lawn, an iron table and chairs, climbers smothering the north wall, the Old Ashmolean's balustraded
//     back and the Sheldonian's cupola beyond). 13 the college's bird's-eye map (J Bays 2009): the quad front of the
//     Lodgings: three storeys of two-light pointed windows, a steep roof with gabled stone dormers, a door up steps, a tall
//     stack at the north end.
//
// THE LODGINGS' OWN FRAME. The house is turned 5.4 deg from the Front Quad's frame (survey section 1; LIDAR eaves lines
// 5 - 7 deg; map 4.7 - 4.8). Everything of the house is authored in (e, y, s): e runs east along the south front, s runs
// SOUTH (so the house lies at s < 0), y above the datum. The build pushes ONE matrix: rotation -A about y at O.
//   LOCAL (u, v) = O + e (cos A, sin A) + s (-sin A, cos A).

export const DATUM = 64.40;

// ------------------------------------------------------------------------------------------------ frame
export const A = (5.4 * Math.PI) / 180;       // K: survey section 1 (LIDAR); map 4.8
export const O = [22.04, -23.26];             // LOCAL of e 0, s 0: the west face's line at the west block's south face.
                                               // K: LIDAR west eaves u 22.3 at v -26 (with the 5.4 deg line it passes
                                               // 23.5 at v -38.5: LIDAR 23.5 - 24.0); south face v -23.0 .. -23.3 (LIDAR)
export const toL = (e, s) => [O[0] + e * Math.cos(A) - s * Math.sin(A), O[1] + e * Math.sin(A) + s * Math.cos(A)];

// ------------------------------------------------------------------------------------------------ levels
export const QUAD_Y = -0.62;     // Margary Quad along the west front. K: topo 63.75 - 63.80 on its east side; LIDAR -0.6
export const LAWN_Y = -0.60;     // the Rector's Garden. K: topo 63.77 - 63.87; LIDAR -0.6
export const PATH_Y = -0.57;     // flagged paths on the lawn (3 cm proud). G
export const WALK_Y = -0.06;     // the raised walk along the east range and Chapel Row. K: LIDAR -0.0 .. -0.2 (the topo's
                                 // 63.79 - 63.83 "paving along the east range" disagrees: LIDAR's 2.5 m wide strip stands; G)
export const COURT_Y = 0.0;      // the courtyard north of the house (part 'broad' / not built here). K: LIDAR
export const YARD_Y = 0.2;       // the Sheldonian yard east of the Schools wall. K: LIDAR bare ground 0.1 - 0.2
export const FFL = 0.30;         // ground floors (both fronts; the basement below). G: steps seen on the bird's-eye map
export const FOOT = -1.05;       // wall feet (the grounds' earth sheet lies at -0.85)

// ------------------------------------------------------------------------------------------------ the house: blocks (e, s)
// WEST BLOCK (Scott 1857, the quad range): K LIDAR (ridge, eaves both sides, ends); depth 8.6 K (eaves 22.3 .. 30.7)
export const WB = { e0: -0.44, e1: 8.6, s0: -15.3, s1: 0, eaves: 11.0, ridge: 16.7, ov: 0.25 };
// north end s -15.3 = LOCAL (23.48, -38.49) .. (32.04, -37.68): the party wall with part 'broad' (the stacks on it). K
// EAST WING (the 1947-9 classical south front; Scott's east gable): K LIDAR; south face s -5.0 = v -27.4 (e 8.6) .. -26.4 (e 19.6)
export const EW = { e0: 8.6, roofE0: 4.8, e1: 19.6, s0: -14.2, s1: -5.0, eaves: 9.7, ridge: 16.0, ov: 0.25 };
// the north wing to the courtyard (north gable apex 16.1 over the courtyard: 18/00694). K LIDAR ridge u 34.5 - 35 (e 11.5)
export const NS = { e0: 7.5, e1: 15.5, s0: -17.7, s1: -9.6, eaves: 9.7, ridge: 15.8, gableTop: 16.1 };
// the flat-roofed piece in the north-east angle. K LIDAR 9 - 10 (u 37 .. 43, v -36.5 .. -39.5); G form
export const NE = { e0: 15.5, e1: 19.6, s0: -17.4, s1: -14.2, top: 9.6, parapet: 10.1 };
export const COPING = { up: 0.3, w: 0.42, kneel: 0.5 };   // coped gables: the coping 0.3 proud of the slates. K photo; G size

// THE WEST (QUAD) FRONT, e = WB.e0, measured as sw = s + 15.3 from its north end; sw 13.9 .. 15.3 is behind Palmer's Tower.
// THIRD PASS (2026-11-23, the faces round Margary Quad). EVIDENCE: planning 04/02086 "02 existing first floor plan"
// (Montgomery 2004, 1:50; read at 100 dpi = 78.7 px a metre, nominal: no bar; +-0.1): the west front runs 13.8 m from
// Palmer's Tower's north face to where it steps back 1.2 m east to staircase 9's block; FOUR first-floor windows, each TWO
// LIGHTS with a central mullion in deep splayed reveals, outer openings 1.46 - 1.59 m, their centres 1.65 / 5.36 / 8.93 /
// 11.65 m north of the tower's face (sw 12.5 / 8.79 / 5.22 / 2.5 with the tower's face at sw 14.15); the MAIN STAIR
// against the front behind the two southern windows (treads 10 - 33; ceiling 3.77), the Teaching Room behind the two
// northern (ceiling 3.60), their partition meeting the front at sw 7.0, over the main door (survey: sw 7.5). No external
// buttresses (the "piers" are the reveals' splays inside). LIDAR (lbox u 20 .. 29, v -39 .. -23): the eaves 75.0 - 75.1
// (10.6) along the front; three humps on the west slope 1 - 2 m in, 78.3 - 79.9 at v -35, -31, -27.5 (sw 3.5, 7.5, 11.0):
// dormers. No elevation of this front exists (25/01435, 26/02068: Palmer's Tower and Room 4 only). Kinds: Scott's Library
// and Chapel next door (plate tracery: two pointed lights and a roundel under a containing arch, a hood; a sill string a
// floor), the bird's-eye map (J Bays 2009: three storeys of two-light pointed windows, hood arches on the lower two, a
// string a floor, gabled dormers), the white Gothic dormer photographed on the east slope (Tilman 2025, P Halling 2025).
// Storeys (G, from the plan's ceilings): ground floor 0.15 (the door's threshold), first floor 4.15 (ground ceiling about
// 3.6 + floor; the stair's 24 risers of about 0.165), second floor 8.3 (3.77 + floor), its ceiling 3.2 (25/01435 Room 4)
// rising into the roof behind the eaves.
export const WEST = {
  cols: [2.5, 5.22, 8.79, 12.5],     // first and second floors. K: 04/02086 (window centres)
  groundCols: [2.5, 5.22, 12.5],     // ground floor: the door at 7.5 takes the place of the fourth. G
  stairCols: [8.79, 12.5],           // the stair's windows: taller, with a transom. K that the stair is behind them; form G
  door: 7.5,                         // the main door (topographic survey: a recessed doorway at v -32.0 .. -30.0, centre v -31.0). K
  winW: 1.45,                        // the windows' outer width. K: 04/02086 (1.46 - 1.59 at the face, less the hood)
  g: { sill: 1.2, spring: 2.8, rise: 0.6 },                 // ground floor plate tracery. G (kind K: map, Library)
  f: { sill: 4.95, spring: 6.85, rise: 0.65 },              // first floor (Teaching Room). G
  st: { sill: 4.78, spring: 7.15, rise: 0.75, transom: 6.0 },   // the stair windows (on the sill string). G
  t: { sill: 8.95, spring: 9.95, rise: 0.45 },              // second floor: two pointed lights under a hood. G
  strings: [4.7, 8.75], plinth: 0.45, cornice: [10.55, 11.0],   // a sill string a floor. G (kind: map, Library)
  dormers: [3.5, 7.5, 11.0],                                // K: LIDAR humps (v -35, -31, -27.5)
  dormer: { w: 1.25, h: 1.35, rise: 0.85, front: 0.45 },
};
// THE MAIN DOOR (second pass). The 2021 topographic survey draws NO porch: the face runs straight with the doorway RECESSED
// into it (a splayed notch 2.0 m wide, 0.4 deep) at v -32.0 .. -30.0, opening on a raised flagged forecourt at 64.39 (part
// 'margary' builds the forecourt, its two steps and the bed north of it: its floors win over this part's). The photograph
// (10 "Rectors Lodgings front door and name board", P Huxley 2011): a pair of oak leaves of vertical reeded boarding with a
// ring handle, square-headed, in a deep moulded ashlar reveal with a roll on the jamb; an oak name board with gilt letters
// on the ashlar to the right. LIDAR's low thing 2.2 - 4.3 m high standing about 1 m out at v -31 .. -32.5: read as a stone
// hood over the door (G form).
// SECOND PASS: the west (quad) front stands at e -0.44, not 0: the 2021 survey fitted 0.38 - 0.50 west of the first pass's face
// along its whole length (u 22.01 at v -27.5), while the east gable and the classical south front agree within 0.1 - 0.35:
// the west block is 9.04 deep (WB.e0 -0.44), not moved rigidly. K: topographic survey (line fits, sd 0.05).
export const DOOR = { w: 1.5, h: 2.75, reveal: 0.45, roll: 0.07, case: 0.22, ffl: 0.14,   // ffl: one step of 0.15 above the forecourt (64.39). K: survey (width, recess), photo (form); G: height, the step
  reeds: 7, board: { dx: 1.55, y: 1.45, w: 0.62, h: 0.42 },                              // the name board's centre from the door's centre (south) and above the sill. K photo (proportion), G figures
  hood: { w: 2.4, proj: 0.65, eaves: 3.25, apex: 3.95 } };                               // G (LIDAR 2.2 - 4.3)
export const PORCH = { w: DOOR.hood.w, proj: DOOR.reveal, steps: 1, going: 0.3 };   // (kept for tools/exeter_walk.mjs: the route to the door)
// stacks on the west block's north end (LIDAR 17.9 - 18.6 at e 3 .. 7.8). K tops; G plan
export const WB_STACKS = [{ e0: 2.6, e1: 4.0, top: 18.2, pots: 2 }, { e0: 5.9, e1: 7.6, top: 18.5, pots: 3 }];
// the west block's east face s 0 .. -5 (to the garden, above Chapel Row's roof north of s -0.3) and the white Gothic dormer
// over it (Tilman 2025). K: the dormer; G: the windows of the face
export const WB_EAST = { col: -2.5, dormer: { s: -2.5, w: 1.15, h: 1.25, rise: 0.75 } };
export const WB_SOUTH_WIN = { sill: 12.2, spring: 13.6, rise: 0.6, w: 1.2 };   // two lights in the south gable. G

// THE CLASSICAL SOUTH FRONT (s = -5.0, x = e - 8.6, 11.0 long). K: Basher Eyre 2015 (counts, order, kinds); levels G
// scaled from it with the cornice on the LIDAR's 9.7.
export const CLASSIC = {
  len: 11.0,
  bays: [1.4, 3.3, 5.2, 7.75, 9.55],
  door: 1,                                  // index of the bay with the door (second from the west). K
  win: { w: 1.1, g: [0.75, 3.05], f: [4.55, 7.15], arch: 0.12 },   // 6-over-6 sashes; plain architraves
  strips: [[0, 0.7], [6.1, 6.8], [10.3, 11.0]],                    // channelled quoin strips. K (three); G widths
  plinth: 0.35, band: 4.3, cornice: { y0: 9.05, y1: 9.7, proj: 0.38 },
  doorW: 1.15, doorH: 2.45, hood: { w: 1.9, y: 2.95, rise: 0.45, d: 0.5 },
  dormers: [3.3, 5.5, 7.75],                // round-headed, white. K: three
  dormer: { w: 1.25, sill: 10.45, spring: 11.4, setback: 0.6 },
  steps: { n: 4, going: 0.32, w: 1.9 },
};
// THE EAST GABLE (e = 19.6, x = -(s + 5.0) running north, 9.2 long; then the flat piece's face to x 12.4). K: Tilman 2025
export const EGABLE = {
  len: 9.2, flatLen: 12.4,
  recess: { w: 2.8, sill: 5.55, spring: 8.9, d: 0.3 },
  sash: { w: 1.1, sill: 5.75, head: 8.7 },
  low: { w: 1.1, sill: 0.75, head: 3.05 },
  strings: [5.5, 8.4],
  flatWin: [{ x: 10.8, y: [0.75, 3.05] }, { x: 10.8, y: [4.55, 7.15] }],   // G (conference guide p7: sashes on the east side)
};
// the tall stack of two round shafts north of the gable (LIDAR 16.2 at u 38.5, v -34.75 = e 15.3, s -13.0). K
export const STACK2 = { e0: 14.6, e1: 16.0, s0: -13.4, s1: -12.6, base: 13.7, top: 16.3, r: 0.27 };
// THE NORTH GABLE to the courtyard (s -17.7, x = 15.5 - e), with the two-storey canted bay and balcony (18/00694). K: that
// it is there; G: sizes
export const NGABLE = { bay: { x: 4.0, front: 2.2, base: 3.2, proj: 0.95, top: 6.3, rail: 0.95 } };

// ------------------------------------------------------------------------------------------------ Chapel Row (LOCAL)
// K: LIDAR (see above); B05: Headington rubble, ashlar dressings, three storeys, Tudor windows renewed. G: openings.
export const CR = {
  u0: 22.15,         // the tower's east face (part 'east', second pass: Palmer's Tower turned 5.3 deg, its east face (22.44, -24.45) .. (21.86, -18.19)). K
  u1: 32.6,          // east face. K LIDAR 32.5 - 33 roof edge; map +1 m 31.5: G between
  vN: -23.0,         // north face (into the west block west of u 30.7). K
  vS: -17.6,         // (first pass; superseded by vSat: the south face is one straight survey line)
  vSat: (u) => -17.81 + 0.0866 * (u - 26),   // second pass: the south face, one line with the tower's south face and part east's covered way's north wall (-18.17 at u 21.86, -17.62 at 28.2). K: survey (east plan)
  vSW: -18.6,        // west of u 28.2 the wall stands behind part east's covered way block (its north wall). K
  notch: [25.9, 28.2],   // second pass: part east's covered way's north wall runs on the same line u 21.9 .. 25.9 (its wall is this part's south face there: not drawn twice); its yard apron u 25.9 .. 28.2. K (east plan)
  ridgeV: -20.8, ridge: 10.9, slope: 0.955, hipU: 31.0, ov: 0.25,   // K: LIDAR ridge, eaves 8.8 N / 7.85 S, hip
  win: { g: [0.85, 2.25], f: [3.3, 4.6], t: [5.8, 6.95], light: 0.45 },
  southCol: 30.4, eastCols: [-19.0, -20.6], eastDoor: -21.9,
};

// ------------------------------------------------------------------------------------------------ the garden (LOCAL)
// walk along the east range and Chapel Row at WALK_Y (part east's aprons left alone: u 26.8 .. 28.2, v -16.6 .. -12 and
// u 27.3 .. 28.2, v -18.6 .. -16.6); the planter along the library's north path (topo "raised path/planter") ; lawn paths
export const WALK_A = [[26.84, 3.77], [31.05, 3.77], [31.42, -2.68], [29.4, -2.7], [29.4, -15.4], [28.2, -15.4], [28.2, -12.0], [26.8, -12.0]];   // second pass: south edge on the wall's north face 3.77, the Library moved (-0.154, -0.598) (lead)
export const WALK_B = [[28.2, -17.62], [31.6, -17.33], [31.6, -15.4], [28.2, -15.4]];   // (its north edge on Chapel Row's south face line)
export const PLANTER = [[29.4, -2.7], [31.42, -2.68], [45.12, -1.97], [46.25, -3.3], [46.9, -4.2], [29.4, -4.2]];   // second pass: refitted to the Library's north path (its north face moved 0.6 north: _exeter_library_plan.js ORIGIN, NORTH_PATH_W 1.5)
export const WALK_STEPS = { u0: 31.6, v0: -17.4, v1: -15.6, n: 3, going: 0.33 };     // down east to the lawn path. G
export const SIDE_STEPS = { v0: -10.2, v1: -8.8, n: 3, going: 0.33 };                // walk -> lawn, west arm. G
// the lawn: the whole L (west arm north of the library, the junction south of the house, the north-east arm). K: map
// w556632296 with LIDAR's faces
export const LAWN = [[29.4, -4.2], [46.9, -4.2], [47.4, -19.9], [54.3, -20.25], [55.75, -20.35], [55.8, -22.4], [56.6, -33.9], [42.8, -34.3], [42.0, -26.4], [31.07, -27.43], [30.7, -23.0], [32.6, -23.0], [32.6, -17.24], [31.6, -17.33], [31.6, -15.4], [29.4, -15.4]];
export const PATH_W = 1.5;
// the paths (map w932806555: from Chapel Row round the house's south-east corner and up the east side into the north-east
// arm, then down its middle). K route; G widths, flags
export const PATH_CR = [[32.6, -15.6], [34.1, -15.6], [34.1, -26.2], [32.6, -26.7]];    // along Chapel Row's east face
export const PATH_NE = [[42.0, -33.0], [52.2, -33.0], [52.2, -24.4], [50.8, -24.4], [50.8, -31.6], [42.6, -31.6]];
// beds (flowerbed) and climbers. K: conference guide p7 (beds and climbers on the north wall, shrubs), Ozeye 2009; G extents
export const BEDS = [
  [[43.0, -34.3], [56.5, -33.9], [56.4, -32.9], [43.0, -33.3]],         // along the north wall
  [[55.0, -22.5], [55.75, -22.4], [56.5, -32.9], [55.75, -32.9]],      // along the Schools wall
  [[46.5, -5.0], [47.05, -5.0], [47.55, -19.6], [47.0, -19.6]],         // along the annexe's west face
];
// PLANTING (drawn by _exeter_plants.js). Rows of shrubs along the beds: line, spacing, crown radius and height ranges,
// kinds in turn, lod; the hedges by the classical steps; the climbers on the north wall and the Schools wall (garden
// face). K what is seen: climbers smothering the north wall and shrubs in the beds (conference guide p7, as PHOTO_NOTES
// describes it; the satellite view of 2026-11-23 ("margary quad, chapel, rectors lodgings and garden ... second pass"):
// a heavy dark-green climber mass the whole length of the north wall and along the Schools wall, small shrubs before the
// classical front); dark low shrubs at the foot of the classical steps (07 Basher Eyre 2015). G: every height, kind and
// place; the planter's planting (not seen: low clipped balls and lavender guessed); the annexe bed's.
export const PLANT = {
  planter: { line: [[30.0, -3.5], [46.0, -3.5]], y: WALK_Y + 0.02, every: 1.25, r: [0.3, 0.45], h: [0.45, 0.8], kinds: ['box', 'lavender', 'box', 'flower'], lod: 0.85, seed: 11, blooms: ['bloomMauve', 'bloomWhite'] },
  north: { line: [[43.6, -33.75], [56.0, -33.35]], y: LAWN_Y + 0.03, every: 1.5, r: [0.45, 0.8], h: [0.8, 1.7], kinds: ['laurel', 'flower', 'laurel', 'gold', 'fern'], lod: 0.8, seed: 21, blooms: ['bloomPink', 'bloomWhite'] },
  schools: { line: [[55.7, -23.6], [56.2, -32.4]], y: LAWN_Y + 0.03, every: 1.6, r: [0.4, 0.7], h: [0.7, 1.5], kinds: ['laurel', 'hosta', 'flower', 'box'], lod: 0.8, seed: 31, blooms: ['bloomWhite'] },
  annexe: { line: [[46.8, -5.6], [47.3, -19.0]], y: LAWN_Y + 0.03, every: 2.2, r: [0.3, 0.45], h: [0.4, 0.8], kinds: ['fern', 'hosta', 'box'], lod: 0.8, seed: 37 },
  hedge: { off: 0.45, w: 0.55, h: 0.75, kind: 'box', lod: 1 },
  northClimber: { from: 0.25,   // top: under NWALL.top 2.65
    top: [1.9, 2.59], set: 'ivy', lod: 0.9, gaps: 0.02, perCell: [3, 4], leaf: [0.07, 0.13] },
  schoolsClimber: { from: 0.8, to: 11.3, top: [2.4, 3.3], set: 'creeper', lod: 0.8, gaps: 0.06, perCell: [2, 4], leaf: [0.08, 0.14] },
};
// the Schools wall (list entry 1348696), the yard's west wall: its garden face from (55.85, -22.3) to (56.75, -34.5),
// run on to the Old Ashmolean at v -39.0. K: SITE_RING + LIDAR u 56 - 57.5; photographs 14 (Camboxer 2026) for the yard
// side: shell niches, the pedimented doorcase (round-headed blind niche over a panelled door), a grille, a pointed
// doorway at the north end, urns on pedestals along the coping. G: positions along it (x from the south end).
export const SCHOOLS = {
  a: [55.85, -22.3], b: [57.1, -39.0], t: 0.75,
  top: 4.0,                                  // coping top (3.8 above the yard). K "about 4 m" (LE; photo); G figure
  coping: 0.18,
  niches: [1.6, 8.7], niche: { w: 1.05, y0: 1.2, spring: 2.6 },
  door: { x: 5.2, w: 1.1, h: 2.3, case: 3.7, proj: 0.28, ent: [3.55, 4.15], apex: 5.6, niche: [2.65, 3.4] },
  grille: { x: 10.6, w: 0.7, y: [0.35, 1.0] },
  gothic: { x: 16.0, w: 1.15, spring: 2.1, rise: 0.75 },
  urns: [0.4, 3.45, 5.2, 6.95, 9.3, 11.3, 13.3, 15.1, 16.6],
};
// the north wall to the Old Ashmolean's yard, and the neighbour's low roof behind it (not the college's: plain). K LIDAR
// (the roof 2.0 - 3.1); G: the wall's height and the roof's form
export const NWALL = { a: [42.85, -34.55], b: [56.85, -34.15], t: 0.45, top: 2.65, roof: 2.45, back: -38.7 };
// garden furniture, trees, lights
export const TABLE = { u: 50.0, v: -28.2 };                 // iron table and chairs (conference guide p7). K; G place
export const BENCH = { u: 27.35, v: -7.0 };                 // on the walk, facing the lawn. G
export const URN = { u: 40.5, v: -30.0 };                   // a white planter on the lawn (p7). G
export const TREES = [{ u: 33.4, v: -7.6, h: 6.0, r: 2.6, seed: 3 }, { u: 45.6, v: -13.9, h: 3.8, r: 1.4, seed: 5 }];   // K LIDAR
export const LAMPS = { porch: { sw: 6.15, y: 2.9 }, classic: { x: 4.45, y: 2.75 }, schools: { y: 3.0 } };   // G (none seen)

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['house turned 5.4 deg from the Front Quad frame; frame origin LOCAL (22.04, -23.26)', 'K', 'survey s.1; LIDAR eaves lines; map w301630464 (4.8 deg)'],
  ['the west (quad) front at e -0.44 (u 22.01 at v -27.5): the west block 9.04 deep', 'K', 'topographic survey 2021 fitted (second pass): west face 0.38 - 0.50 west of the first pass, east gable and south front within 0.35'],
  ['Chapel Row: west end on Palmer\'s Tower\'s east face (turned 5.3 deg), south face one straight line v = -17.81 + 0.0866 (u - 26), drawn east of u 25.9 (part east\'s covered way wall on the same line west of it)', 'K', 'survey; _exeter_east_plan.js (second pass)'],
  ['west block: 8.6 m deep (west face u 22.3 .. 23.5), v -23.3 .. -38.5, eaves 11.0, ridge 16.7, steep slated roof', 'K', 'LIDAR 2022 (eaves 10.4 - 11.4, ridge 16.3 - 17.1)'],
  ['north end of the west block (party wall with part broad) at LOCAL (23.48, -38.49) - (32.04, -37.68), stacks on it to 18.2 / 18.5', 'K', 'LIDAR stacks 17.9 - 18.6 at v -37.5 .. -38; roofs north of it 10 - 14'],
  ['stack plan sizes and pots', 'G', 'LIDAR spikes only'],
  ['east wing e 8.6 .. 19.6 (east gable at u 42.0 .. 42.8), south face v -27.4 .. -26.4, eaves 9.7, ridge 16.0', 'K', 'LIDAR'],
  ['north wing to the courtyard: ridge 15.8 at u 35, north gable at v -39.8 with apex coping 16.1', 'K', 'LIDAR; planning 18/00694 elevation 1 (apex 16.1 above the courtyard)'],
  ['flat-roofed piece in the north-east angle, 9.6 with a parapet', 'K', 'LIDAR 9 - 10; form G'],
  ['basement + four storeys; main entrance facing Margary Quad', 'K', 'planning 25/01435 heritage statement'],
  ['ground floor 0.3 above the datum; storey levels on both fronts', 'G', 'bird\'s-eye map (steps up); 25/01435 section (3.2 m ceilings) by proportion'],
  ['west (quad) front (third pass): FOUR window columns at sw 2.5 / 5.22 / 8.79 / 12.5, two-light windows about 1.45 wide; the main stair against the front behind the two southern, the Teaching Room behind the two northern', 'K', 'planning 04/02086 first-floor plan (1:50; window centres scaled +-0.1); topographic survey (door at sw 7.5)'],
  ['west front windows as Scott\'s plate tracery (two pointed lights and a roundel under a containing arch with a hood) on the ground and first floors, two pointed lights under a hood on the second, a sill string a floor', 'G', 'kind from the bird\'s-eye map (J Bays 2009) and Scott\'s Library / Chapel next door; no elevation or photograph of this front'],
  ['the stair windows taller (sill 4.78, apex 7.9) with a transom', 'G', '04/02086 (the stair against the front; stair hall ceiling 3.77)'],
  ['storey levels: ground 0.15, first floor 4.15, second 8.3; window sills 1.2 / 4.95 / 8.95', 'G', '04/02086 ceilings 3.47 - 3.77; 25/01435 Room 4 ceiling 3.2; the door\'s threshold'],
  ['no ground-floor window at sw 8.79 (the door at 7.5 beside it)', 'G', 'ground floor plan not obtained (refused by the register)'],
  ['main entrance facing Margary Quad at v -31.0: a square-headed doorway recessed 0.45 in a moulded ashlar reveal with a roll, a pair of oak leaves of vertical reeded boarding with a ring handle, an oak name board with gilt lettering to its right; no porch', 'K', 'topographic survey 2021 (recessed doorway, no porch; second pass); 10 Rectors Lodgings front door (P Huxley 2011); 25/01435 (entrance to Margary Quad)'],
  ['the door\'s height 2.75, the sill one step (0.15) above the forecourt, the name board\'s size and place', 'G', 'photo proportion'],
  ['a stone gabled hood over the door on corbels (was a gabled porch)', 'G', 'LIDAR low feature 2.2 - 4.3 at v -31 .. -32.5'],
  ['three dormers in the west slope at sw 3.5 / 7.5 / 11.0', 'K', 'LIDAR humps 78.3 - 79.9 at v -35, -31, -27.5; bird\'s-eye map (three)'],
  ['the west dormers drawn as the white Gothic dormer photographed on the east slope (two pointed lights, white gablet)', 'G', 'Tilman 2025 / P Halling 2025 (east slope); the west ones not photographed'],
  ['east wing south face = the CLASSICAL elevation (1947-9): 5 bays of 6-over-6 sashes, channelled quoin strips (three), sill band, cornice at the eaves', 'K', '07 Basher Eyre 2015; LIDAR eaves 9.7; VCH (back remodelled); face decided by the eaves line, the return and the garden: see the plan header'],
  ['classical door in the second bay with a pedimented hood on brackets, four steps down to the path', 'K', '07 Basher Eyre 2015 (door, hood); steps G'],
  ['three round-headed white dormers on the classical front', 'K', '07 Basher Eyre 2015; sizes G'],
  ['classical storey levels (sills 0.75 / 4.55, heads 3.05 / 7.15, cornice 9.05 - 9.7)', 'G', 'scaled by eye from Basher Eyre 2015 on the LIDAR eaves'],
  ['east gable: coped ashlar gable, round-arched recess 2.8 wide (springing 8.9) holding a 6-over-6 sash, strings 5.5 / 8.4, a sash below', 'K', '07 Tilman2007 2025 scaled (gable 9.2 m = 330 px)'],
  ['white Gothic dormer of two pointed lights in the west block\'s east slope over Chapel Row', 'K', '07 Tilman2007 2025, Ozeye 2009'],
  ['tall ashlar stack of two round shafts north of the east gable, 16.3', 'K', 'Tilman 2025; LIDAR 16.2 at (38.5, -34.75)'],
  ['north gable to the courtyard with a two-storey canted bay and a balcony', 'K', 'planning 18/00694 elevation 1; sizes G'],
  ['west block south gable over Chapel Row (two-light window in it)', 'G', 'LIDAR ridge reaches v -23.5; window guessed'],
  ['windows of the west block\'s east face and of the flat piece', 'G', 'conference guide p7 shows sashes on the east side'],
  ['"Palmer\'s Tower Room 4" balcony on the south side of a second-floor room', 'G', 'NOT BUILT: 25/01435 places it, but which face could not be tied to the plan'],
  ['Chapel Row east of Palmer\'s Tower: u 23.2 .. 32.6, v -23.0 .. -17.6, ridge 10.9 at v -20.8, eaves 8.8 N / 7.85 S, hipped east end', 'K', 'LIDAR 0.5 m box; B05'],
  ['Chapel Row west of u 28.2 stands behind part east\'s covered-way block (north wall v -18.6, top 8.8): roof meets its flat', 'K', '_exeter_east_plan.js WAY.cover; LIDAR 8.7 - 9.1'],
  ['the open bay u 27.3 .. 28.2 before the covered way\'s east mouth', 'G', 'LIDAR mixed 4 - 8 there; kept open so part east\'s way out stays 2 m wide'],
  ['Chapel Row: rubble, ashlar quoins, three storeys of Tudor two-light windows under labels, a garden door on the east face', 'K', 'B05 (RCHM: Tudor windows renewed); openings G'],
  ['Rector\'s Garden lawn 63.80 (-0.60) over the whole L', 'K', 'topo 63.77 - 63.87; LIDAR; map w556632296'],
  ['raised walk at -0.06 along the east range and Chapel Row, kerbed, steps down to the lawn', 'K', 'LIDAR -0.0 .. -0.2 strip 2.5 m wide; the topo\'s 63.8 for "paving along the east range" disagrees: G'],
  ['raised planter between the library\'s north path and the lawn', 'K', 'topo "raised path/planter" 64.31 - 64.69; LIDAR 0.0; extent G'],
  ['paths from Chapel Row round the house into the north-east arm and down its middle', 'K', 'map w932806555 route; widths and flags G'],
  ['beds along the north wall, the Schools wall and the annexe; climbers on the north wall', 'K', 'conference guide p7; extents G'],
  ['climbers (ivy-dark) over the whole north wall to just under its coping; a creeper on the Schools wall\'s garden face either side of its door', 'K', 'conference guide p7 ("climbers smothering the north wall"); satellite 2026-11-23 second pass (a dark mass along the north and east sides); heights and the Schools wall\'s G'],
  ['shrubs in the beds: laurel-like evergreens, flowering mounds, a golden one, ferns, 0.7 - 1.7 m', 'G', 'satellite 2026-11-23 (shrub tops in the beds); kinds and sizes guessed'],
  ['low clipped box hedges 0.75 m either side of the classical steps', 'K', '07 Basher Eyre 2015 (dark low shrubs at the foot of the front); clipped form and size G'],
  ['planter by the library\'s north path: clipped balls, lavender, a flowering mound', 'G', 'topo "raised path/planter"; planting not seen'],
  ['white planter on the lawn planted with a flowering mound', 'G', 'conference guide p7 (a white planter); its planting guessed'],
  ['a tree (6 m) in the west arm and a small one by the annexe', 'K', 'LIDAR crowns; species G'],
  ['iron table and chairs on the lawn, a white planter, a bench on the walk', 'K', 'conference guide p7 (table, chairs, planter); bench and places G'],
  ['Schools wall: garden face on the boundary (55.85, -22.3) - (56.75, -34.5), on to the Old Ashmolean at v -39.0; 0.75 thick; coping 4.0', 'K', 'SITE_RING; LIDAR; LE 1348696 ("about 4 m"); thickness G'],
  ['Schools wall yard side: shell niches, pedimented doorcase with a blind niche over a panelled door, a grille, a pointed doorway at the north end, urns on pedestals', 'K', '14 Camboxer 2026, S Daniels 2009, 07 Ozeye 2009, Tilman 2025; positions G'],
  ['Schools wall garden side plain with the door through it', 'G', 'no photograph of the garden side'],
  ['north wall to the Old Ashmolean\'s yard (3.25 above the lawn), and the neighbour\'s low flat roof behind it at 2.45', 'K', 'LIDAR 2.0 - 3.1; map w1418421919; heights G'],
  ['wall lanterns at the porch, the classical door and the garden door in the Schools wall', 'G', 'none seen in the photographs'],
];
