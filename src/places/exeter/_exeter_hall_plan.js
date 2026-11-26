// Exeter College, STANDALONE model, part 'hall' (B02): THE PLAN of the Hall (1618) with its porch (1820) and oriel, and
// the south-west / south range (staircase 3, buttery, kitchen; the Turl Street return and the Brasenose Lane corner).
// Pure data: every dimension a named constant with its source; the build functions are in _exeter_hall_build.js.
// LOCAL frame (u east, v south, y above the datum 64.40 m: _exeter_shared.js). Research: docs/research/exeter_survey.md
// B02, sections 1, 2, 3, 9 (contradiction 2), 11 (the look by hand 2026-11-23); reference/exeter/PHOTO_NOTES.md.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (tools/exeter_lidar.py lbox / lgbox / u and v profiles at 0.5 m; a 16 px/m colour plan of the box
//     u -26..22, v 15..34 drawn from the same data): the Hall's ridge runs from u -4.5 (the west gable's stack, 16.7) to
//     u 20.0 (15.7 - 15.9 at u 19.5 - 20, then the east range's 13.0), so the Hall is LONGER than the brief's -3.5 .. 22:
//     west gable at about -5.2, east gable at about 19.8 (25 m outside = RCHM's 23.0 m inside + two gable walls). North
//     parapet at v 20.3 - 21 (10.4 - 11.3), south parapet on the lane line (10.4 - 11.2); ridge 15.3 - 15.9 on v 25.3 - 26.3;
//     the roof falls 1.2 - 1.3 m a metre (about 50 deg). The porch stands forward to v 19.3 at u -4.3 .. -0.3 (6.3 - 6.6,
//     a pinnacle 8.9 at its north-west corner), steps in front to v 17.3 (0.3 - 0.9). The oriel stands forward to v 19.4 at
//     u 15.5 - 17.5. A stack on the south wall at u 6 - 7 (13.4; Tilman 2025 shows it about half-way up the roof). The
//     south range's quad face at v 21.8 - 22 (map 21.3 - 21.8), its E-W roof 13.0 - 13.8 on v 26 - 27, a gable 14.1 at
//     its lane face by the Hall (u -7); the west range's ridge (13.5 - 13.7 at u -20) runs on south into the corner block
//     to meet the south range's E-W ridge, with a clustered stack 16.8 at (-19.5, 22); a low single-storey block (4.3) in
//     the quad's south-west corner at
//     u -16 .. -12, v 19 .. 21.8 (the servery lobby); a gable 13.6 on the Turl Street face at v 25 - 26; something tall
//     (13.6, a stack: G) on the lane face at u -15.
//   * ground (lgbox): the quad's path along the Hall 0.1 - 0.2, 0.3 at u -10, 0.45 - 0.6 in the south-west corner;
//     Brasenose Lane 0.25 at Turl Street rising to 0.65 - 0.7 behind the Hall, 0.5 at u 18; Turl Street 0.1 - 0.3.
//   * photographs (LOOKED AT, cropped and scaled by hand): 02 Simon Q 2012 (the north face, scale 72 px/m at the porch
//     between the path and the merlon tops), 02 P Huxley 2011 (the south range's quad face, the lobby, the porch's side,
//     the corner stack), 03 R Sones 2012 x 2 (porch, clock, door), 03 G Rhodes 2012 (the lane from Turl Street), 01 N
//     Chadwick 2017 (the Brasenose Lane corner: the Turl Street return with its oriel, the lane face), 12 the lead's look
//     by hand 2026-11-23 (the Hall's lane windows), 13 Tilman 2025 / Abbott 2015 (the roofs from St Mary's tower), the
//     college's bird's-eye map (J Bays 2009). Counts K; figures scaled between LIDAR's ground and parapet: G unless noted.
//   * CONTRADICTION 2 (3 or 4 lights): counted on Simon Q 2012 (each north window 3 lights in 2 tiers + tracery), on the
//     lead's look (3 lights) and on the inside (E Webster 2011: "3 lights wide, 2 tiers"): THREE. The porch bay's upper
//     window has 5 narrow lights (Simon Q; Sones close); the oriel 4 on the front, 1 in each return, 3 tiers.

// THE SURVEY PASS (2026-11-23, after the lead's registration of the 1:500 topographic survey, planning 21/00354/FUL p20,
// Tim Moya Associates, 31.5 px/m, LOCAL = survey axes turned 17.07 deg + (1.287, 0.822), rms 0.21 m on 18 walls; its
// scripts in $TMPDIR/fq, rerun here, lines fitted to the dark pixels by eigen-fit; LIDAR 0.25 m profiles beside them):
//   * the Hall is NOT square to the quad: its north face fits v = 20.778 + 0.0676 (u - 4.5) over u 4.5 .. 14 (n 1368
//     px, 3.87 deg), its lane face v = 31.747 + 0.0644 (u - 10.5) over u 10.5 .. 19.5 (n 1374, 3.68 deg): parallel,
//     10.54 m apart (perpendicular). LIDAR's building edges (0.25 m profiles, the mid of last > 9.5 m and first < 1 m)
//     agree within its cell (+0.2 outward on average): the lane face is about 1 - 1.3 m SOUTH of the map's lane line
//     (SITE_RING 30.0 .. 30.8), which the old shell followed.
//   * so the Hall is drawn in its own SHEARED frame (SHEAR below): hall coordinates (u, z) -> LOCAL (u, z + k (u - u0)).
//     Its long faces are lines of constant z (skewed 3.78 deg on the quad), its gables lines of constant u (square to
//     the quad: the survey's west end at u -4.4 .. -4.7, the lane step at 19.83; 22/01860/LBC's plan draws the east wall
//     skewed against the long walls by just this much). A shear of 0.066 changes lengths along u by 0.2 %: ignored.
//   * the porch: its front v 19.00 at u -3.8 .. -0.2 (fit n 790); the door's threshold u -2.8 .. -1.1 (centre -1.95,
//     1.7 wide: 22/01860/LBC draws 1.7); the steps wrap it on three sides (six nested U lines, the outer at v 17.13 and
//     u -4.92 .. 1.17), no side walls. The undercroft's stair head: a walled slot u 0.7 .. 2.9 to v 19.25 (LIDAR 0.87
//     high: low walls), the stair down the undercroft's way in (08/00644/LBC: 1.9 m wide, descending south).
//   * buttresses on the north face at u 3.7, 7.5, 11.25 (the survey's drawn returns, +-0.2); the oriel: a west return
//     from u 14.7 (on the face) to 15.2, the front v 20.65 - 20.72 to the east range (u about 19.0 - 19.8).
//   * the south range's quad face v 22.20 - 22.25 (fit n 3158), the servery lobby u -16.33 .. -13.04, front v 18.9;
//     the west range's faces moved by the same registration (quad -16.15, Turl Street -23.7: _exeter_west_plan.js).
export const DATUM = 64.40;
export const FOOT = 0.4;          // walls go this far below the ground at their feet. K: common brief

// ------------------------------------------------------------------------------------------------ the lane line
/** Brasenose Lane's wall line (map SITE_RING, survey section 1): v at u, straight pieces. K */
/** (the south range's lane face only, LOCAL: the Hall's own lane face is its sheared frame's z = HALL.vS.) K: the corner by
 *  the west range's street face (-23.7 at v 20, -23.9 at the lane: LIDAR v 21 / 29 rows) and the Hall's south-west
 *  corner; G between (LIDAR's edges at u -16 .. -8 read 0.2 - 0.7 further south: a stack and dormers in the cells) */
export const LANE = [[-23.9, 30.15], [-4.55, 30.75]];
/** the Hall's SHEARED frame: hall (u, z) -> LOCAL (u, z + k (u - u0)). K: the survey's two long faces (3.87 / 3.68 deg) */
export const SHEAR = { k: 0.066, u0: 9.25 };

// ------------------------------------------------------------------------------------------------ THE HALL in plan
export const HALL = {
  uW: -4.55,         // west gable's outer face (square to the quad). K: survey, the step between the Hall's and the south range's
                     // quad faces at u -4.4 .. -4.7 (two strokes); LIDAR stack at -4.5. (was -5.2)
  uE: 19.8,          // east gable's outer face. K: survey lane step at 19.83; LIDAR ridge to 19.5 - 20.0
  uEN: 19.0,         // the north face (the oriel's east return) ends here against the east range. G: survey 19.0 - 19.8
  vN: 21.10,         // north face, hall z (= LOCAL v at u 9.25; 20.19 at the west gable, 21.75 at u 19). K: survey fit
  vS: 31.66,         // lane face, hall z (LOCAL 30.75 at the west gable, 32.3 at the east). K: survey fit u 10.5 .. 19.5 (extended west)
  wall: 1.1,         // the long walls: (10.54 outside - 8.30 - 8.45 inside) / 2. K: survey + 22/01860 and 05/00314/LBC (8.30)
  wallE: 0.75,       // the gables: 24.35 outside - 23.0 inside (RCHM, screens passage included) = 2 x 0.68. G 0.75
  inside: [23.0, 8.4],   // K: RCHM 75 1/2 x 27 1/2 ft
  floor: 1.55,      // the Hall's floor (and the screens passage, the porch's landing) above the datum. K: planning 22/01860/LBC
                    // internal elevations (1:100, scale bar): the north windows' transom 4.3 and apex 7.28 above the floor, the wall
                    // plate 8.1 against the outside's transom 5.85, apex 8.85 and gutter 9.6 = 1.55 - 1.57; G +-0.1
};
// ------------------------------------------------------------------------------------------------ heights (y above the datum)
export const HY = {
  quad: 0.16,        // the quad's path at the north face. K: LIDAR lgbox 0.1 - 0.2; survey 64.54 (+0.14)
  lane: 0.66,        // Brasenose Lane at the south face. K: lgbox 0.6 - 0.7 (survey 65.06 = 0.66)
  plinthN: 1.5,      // north face plinth top (a chamfered set-off). G: Simon Q 2012 (crop y 795)
  string: 9.3,       // the parapet string, just over the window heads: the parapet is a tall band (1.45 m to the embrasures).
                     // G figure: Simon Q 2012 (string 0.45 - 0.6 over the apex, 1.6 under the embrasures); LIDAR embrasures 10.4 - 10.7
  embr: 10.75,       // top of the parapet wall (embrasure sills). K: LIDAR 10.4 - 11.2
  merlon: 0.6,       // merlons stand this high over the embrasures (tops 11.35). K: LIDAR 11.2 - 11.3; G figure
  merlonW: 0.8, gapW: 0.55,       // G: Simon Q, about 1.35 m a merlon and gap
  parapetT: 0.36,
  gutter: 9.6,       // the slates' foot behind the parapets. K: LIDAR's slope (10.73 at v 22, 11.85 at v 23, 13.2 at v 24 at u 10) carried to v 21; G +-0.2
  ridge: 15.9,       // K: LIDAR 15.3 - 16.0 along the ridge, survey 15.6; the top of the range taken (a 1 m cell astride a sharp ridge reads low)
  laneString: 2.35,  // the projecting string / plinth course over the rubble base, 1.5 - 2 m above the lane. K: the lead's look 2026-11-23 (figure G 1.7 m)
};
// windows: four-centred heads, 3 lights, 2 tiers (a transom) and vertical tracery, a hood over. K: Simon Q, the look,
// Webster; figures G (Simon Q at 72 px/m: sill 3.7, transom 5.8, springing 7.4, apex 8.7; the lane side: sills "well
// above head height" over 7 - 8 courses of ashlar above the string)
export const WIN = {
  w: 2.3, lights: 3, mullion: 0.14,
  sill: 3.8, transom: 5.85, spring: 8.0, apex: 8.85,     // (a flat four-centred head: rise 0.85 on a 2.3 m span)
  sillS: 5.4,                     // the lane side: set higher. K: 05/00314/LBC (the west bays' sills 3.85 above the floor =
                                  // 5.4, heads 7.25 = 8.8); 22/01860/LBC (3.6); 13/01302/LBC lane elevation (4.9 above the lane = 5.56)
  transomS: 7.3,                  // the lane side's transom (the head tracery stands on it). K: 22/01860/LBC (5.8 above the floor)
  reveal: 0.32,
  glassZ: 0.17,                   // the glazing's plane, this far in from the outer face (real glass: _exeter_interior_kit.js). G
  hood: 0.14,
};
// bays on the north face (u of each window's middle) between the porch (u -5.4 .. -1.0) and the oriel (14.3 .. 18.2):
// four equal bays of 3.75 m. K: four window bays (Simon Q, Sones, Huxley); G: each u (+-0.4; LIDAR buttress hints at
// 6.5 and 10)
export const BAYS_N = [1.8, 5.6, 9.38, 13.0];        // (midway between the buttresses and the porch / oriel. G +-0.3)
export const BUTTRESS_N = [3.7, 7.5, 11.25];        // K: survey (+-0.2); the old fourth (13.95) is the oriel's west corner
/** stepped buttresses: [[stage top, projection], ...] from the ground. K: form (Simon Q: set-offs at about 4.6 and a
 *  weathered top at 8.3, Farmington stone); G figures */
export const BUTTRESS = { w: 0.72, stages: [[4.6, 0.85], [8.3, 0.6]] };
/** undercroft: a low two-light opening in each window bay; a door in bay 1 with a square label; a lantern beside it.
 *  K: Simon Q (two small round-headed openings at the foot of bay 3; the door; the lantern); G: sizes, every bay */
export const UNDERCROFT = { y: [0.42, 1.0], lightW: 0.36, lamp: { u: 0.35, y: 2.55 } };
/** the undercroft's way in from the quad: a walled stair head beside the porch (u, hall z of its front; low walls 0.9)
 *  and the STAIR DOWN (2026-11-23, second pass: the grounds part cut the quad's paving open over the slot). K: survey (the
 *  slot u 0.7 .. 2.9 = the flight's 1.9 m and two 0.15 walls), LIDAR 0.87 (the walls' tops), 08/00644/LBC (DIMENSIONS.md
 *  "The Undercroft Bar": a straight stair about 1.9 m wide in a walled slot in the north wall at the undercroft's WEST end,
 *  descending SOUTH from the quad, about 2.5 - 3 m on plan, landing in a small lobby, then a short timber flight into the
 *  bar). G: the walls' thickness (0.15), the gate standing open, the stone flight starting a landing's depth inside the
 *  gate (zStair) and running 9 risers of 0.222 on 0.21 goings under the Hall's north wall to a lobby 2.0 below the quad
 *  that ends at the Hall's inner face (the 2D floors and colliders of the hall above allow nothing further south), the
 *  head of the opening through the wall (head, under the Hall's floor 1.55), the lobby's shut door; the undercroft's own
 *  floor is NOT figured (08/00644 sections refused): taken 2.6 below the quad (y -2.44) beyond the door, reached by the
 *  timber flight that is not built */
export const UC_STAIR = { u0: 0.7, u1: 2.9, zF: 19.79, wallH: 0.9, wallT: 0.15, gateW: 1.9,
  zStair: 20.12, risers: 9, rise: 0.222, going: 0.21, zDoor: 22.15, head: 1.1, door: { w: 1.0, h: 2.05 }, floorBar: -2.44 };
/** blank shields under the north windows (carved arms in life: drawn plain). K: Simon Q (under bays 2 and 4), Sones */
export const SHIELD_Y = 2.75;
// the lane face: six windows. K: survey B02 (six), the look (three-light, transom, set high); G: u of each (on the north
// bays, the west one behind the porch bay)
export const BAYS_S = [-2.55, 1.8, 5.6, 9.4, 13.0, 16.7];      // (the west one lights the gallery over the screens passage: 22/01860/LBC
// south internal elevation, the others opposite the north ones as it draws them. K order / G each +-0.3)
/** FLOREAT EXON: grotesques at the Hall's lane parapet string (11 letters as plain blocks). K count (fact sheet); G positions */
export const GROTESQUES_S = 11;
/** a low vent opening in the rubble base (planning 13/01302/LBC: a 2013 stone-mullioned ventilation opening). K: exists; G: place, size */
export const VENT = { u: 13.9, w: 1.2, y: [1.05, 1.75] };
/** the chimney breast's foot in the rubble base under the lane stack ("a buttress-like projection"). K: the look; G: that it is this */
export const BREAST = { u: 7.3, w: 1.6, top: 2.35, proj: 0.35 };     // (under the stack: the hall's two fireplaces stand opposite at the middle buttress, 22/01860/LBC)

// ------------------------------------------------------------------------------------------------ chimneys
export const STACK_W = { u: -4.2, v: 26.38, wu: 0.75, wv: 1.4, top: 17.1 };   // (v here: hall z, on the ridge)   // on the west gable. K: LIDAR 16.7 at (-4.5, 25.5), Huxley; G top (+0.4 for a 1 m cell)
export const STACK_S = { u: 7.3, base: [1.4, 1.0], baseTop: 11.7, shaft: [0.85, 0.65], top: 13.7 };   // on the south wall, rising from the parapet with weathered shoulders. K: LIDAR (6 - 7, 30 - 31) 13.4; Tilman 2025 (form, about half-way up the roof); G sizes

// ------------------------------------------------------------------------------------------------ THE PORCH (1820)
// K: form (Sones close, Simon Q, Huxley): projecting, corner buttresses with pinnacles, a pointed (two-centred) door with
// continuous mouldings and a traceried oak door; over it a string with foliage bosses and two painted shields; the clock
// (a plain blue dial, gold numerals) between pairs of narrow traceried lights; a band of small traceried panels; then,
// in the Hall's wall plane, the bay's 5-light window. LIDAR: front v 19.3, top 6.3 - 6.6 (its lead flat), the west
// pinnacle 8.9. G: every figure (Simon Q at 72 px/m)
export const PORCH = {
  u0: -3.85, u1: -0.15, vF: 19.74,          // (vF: hall z; LOCAL 19.0 at the door). K: survey (front fit v 19.00 at u -3.8 .. -0.2)
  doorU: -2.0,                    // the door's middle. K: survey (threshold -2.8 .. -1.1), 22/01860/LBC (1.7 wide)
  top: 7.15,                      // the front's coping. K: LIDAR 6.6 + parapet; Simon Q +7.0 - 7.2
  roof: 6.75,                     // its lead flat behind
  door: { w: 1.6, spring: 3.75, rise: 1.0 },      // apex 4.75: Simon Q 4.6 - 4.7; Sones proportion 1 : 2.1
  landing: 1.55,                  // the door's threshold = the Hall's floor (the screens passage is level with it: 22/01860/LBC
                                  // plan and north internal elevation, no step inside). K; 7 risers of 0.2 from the quad
  leaves: { w: 0.8, h: 2.2, z: 0.44 },   // the two oak leaves (to the springing; the traceried head over them is fixed), hung
                                  // this far in from the porch's front, opening inward. G (the plan shows a pair swinging in: K)
  inner: { u0: -3.4, u1: -0.6 },  // the porch's inside. G (walls about 0.45 - 0.5; RCHM / notes: rib-vaulted)
  arch: { u0: -3.4, u1: -1.45, spring: 2.4, rise: 0.65 },   // the arch through the Hall's north wall into the screens passage, above
                                  // the floor (apex 3.05: 22/01860/LBC north internal elevation, K; its width to the screen G)
  steps: { n: 7, goingF: 0.31, goingW: 0.18, goingE: 0.14 },   // 7 risers (6 treads wrapping the porch on three sides, then the
                                  // threshold): the outer tread's front at LOCAL v 17.13, sides u -4.92 / 0.7 (the stair head). K: survey; G goings
  bossString: 5.35, shieldY: 5.7, shieldS: 1.15,
  clock: { y: 6.3, r: 0.43 },     // K: Sones (dial over the door); G size
  lancets: { y: [5.85, 6.8], w: 0.2, s: [0.75, 1.05] },     // two pairs of narrow traceried lights beside the dial. K count
  band: [6.85, 7.15],             // the traceried panel band. K
  buttress: { w: 0.62, stages: [[3.2, 0.55], [6.2, 0.38]], pinnacle: 8.9 },   // K: LIDAR 8.9 (north-west); G sizes
  upper: { w: 2.7, lights: 5, sill: 7.4, spring: 8.55, apex: 9.2 },     // the bay's window over the porch, its head at the parapet string. K: 5 lights (Simon Q); G
};

// ------------------------------------------------------------------------------------------------ THE ORIEL (dais bay)
// three-sided, carried up from the ground to the parapet; 4 lights on the front and 1 in each return, three tiers
// (double-transomed); its own battlements continuing the Hall's. K: Simon Q, Huxley, survey; LIDAR front v 19.4 at
// u 15.5 - 17.5. G: sizes
export const ORIEL = { u0: 14.7, f0: 15.2, f1: 18.55, u1: 19.0, z: 20.18, y: [3.0, 8.65], transoms: [4.9, 6.78] };   // (z: the front, hall z = LOCAL 20.68 at u 17)
/** the Hall's NORTH-EAST CORNER (2026-11-23, second pass: from the quad near (15.5, 16.5) there was a see-through slot here
 *  between the oriel's east return and the east range, u 19.0 .. 19.8, v 20.7 .. 21.8): the oriel's front carried on east
 *  to the east range's quad face (LOCAL: it meets it at (uRange, vRange)) and the corner filled back to the gable (uE)
 *  and the north face. LOCAL coordinates. K: survey (the front v 20.65 - 20.72 runs to the east range at u 19.0 - 19.8);
 *  the east range's quad face 18.539 + 0.0218 (v - 1.25) = 18.96 at v 20.7 (_exeter_east_plan.js R). G: no east return */
export const NE_CORNER = { uRange: 18.96, vRange: 20.66 };

// ------------------------------------------------------------------------------------------------ THE SOUTH-WEST / SOUTH RANGE
// The quad face (1701-3 style, as the west range's quad side south of the gate): round-headed lights under labels, three
// storeys, flat-topped dormers. The street and lane faces (Underwood 1833-4): Bath ashlar, cusped (pointed) lights under
// square labels, a plinth, strings at each floor, cornice with grotesques, parapet. Heights continue the west range
// (_exeter_west_plan.js QD / ST / ROOF) so the corner meets it without a step. K: Huxley 2011, Chadwick 2017, Rhodes 2012.
export const SR = {
  uSt: -23.7, uStS: -23.9,        // the Turl Street face at v 20 (as the west range, moved) and at the lane corner. K: west plan; LIDAR
  uQd: -16.15,                    // the west range's quad face, continued to the corner. K: survey (west plan)
  vQ: 22.2,                       // the south range's quad face. K: survey fit 22.20 - 22.25
  vW: 20.0,                       // where the west range stops. K: brief
  gutter: 11.9, parapet: 12.4, cornice: 11.4, corniceSt: 11.6,   // K: as the west range (LIDAR 11.6 - 12.1)
  ridgeU: 13.5, ridgeUv: 26.2,    // the south range's E-W ridge, Turl Street to the Hall. K: LIDAR 13.0 - 13.8 on v 26 - 27 (a row of 13.6 - 13.8 at v 26)
  ridgeV: 13.7, ridgeVu: -19.95,   // the west range's N-S ridge carried on to meet it. K: LIDAR 13.5 - 13.7 at u -20, v 21 - 25 (the 13.4 - 14.1 at v 27 - 29 are the lane dormers: I)
  parapetT: 0.35,
};
/** the quad's ground at the foot of the south range's quad face, by u. K: lgbox (0.3 at -10, 0.45 - 0.6 in the corner) */
export const QUAD_S_GROUND = [[-16, 0.5], [-13, 0.45], [-10, 0.3], [-6, 0.22], [-4, 0.18]];
/** Turl Street's pavement at the foot of the corner block, by v. K: lgbox / west plan (0.10 at v 20) */
export const STREET_S_GROUND = [[20, 0.1], [25, 0.2], [29.5, 0.22]];
/** Brasenose Lane at the foot of the lane faces, by u. K: lgbox v 32 */
export const LANE_GROUND = [[-25, 0.22], [-20, 0.32], [-16, 0.45], [-12, 0.58], [-8, 0.66], [0, 0.68], [10, 0.62], [18, 0.5], [21, 0.45]];

// storeys: the west plan's QD (quad) and ST (street) figures, repeated here so this plan reads alone. G there.
export const QDS = { plinth: 0.55, g: [1.7, 3.3], s1: 4.3, f: [5.1, 6.8], s2: 8.0, t: [8.9, 10.5], lightW: 0.54, mullion: 0.15, reveal: 0.22,
  door: { w: 1.15, spring: 2.05, rise: 0.4 } };
export const STS = { plinth: 0.9, g: [1.5, 3.5], s1: 4.4, f: [4.9, 7.3], s2: 8.1, t: [8.6, 10.6], lightW: 0.52, mullion: 0.16, singleW: 0.62, headRise: 0.42, reveal: 0.24 };

// the quad face, from the porch to the corner (Huxley 2011, 45 px/m): first and second floors single | 3 | 2 | 3 | 2;
// the ground floor single | 3 | 2 | door of staircase 3 | (the lobby). K: counts and order; G: each u (+-0.4)
export const QUAD_BAYS = [
  { u: -5.64, k: 1 }, { u: -7.59, k: 3 }, { u: -10.0, k: 2 }, { u: -12.36, k: 3, door: true }, { u: -14.94, k: 2, lobby: true },   // (rescaled onto the surveyed face -16.15 .. -4.55)
];
export const STAIR3 = { u: -12.36, n: 3 };          // the staircase 3 door (number plate). K: the college's map (3 at the corner); G: which door
export const QUAD_PIPE = -15.85;                   // the lead downpipe at the corner. K: Huxley
/** the dormers on the quad slope: flat-topped, slate cheeks, white sashes. K: five (Huxley); G: each u */
export const DORMER = { sill: 12.4, w: 1.3, h: 0.85, lights: 3 };   // sills over the parapet (Huxley); G sizes (the ridge is low)
export const DORMERS_Q = [-6.5, -9.6, -11.2, -13.4, -15.2];
/** the lane slope: a row of seven flat dormers seen from St Mary's tower (Tilman 2025), the whole length to Turl Street.
 *  K: count; G: each u */
export const DORMERS_L = [-22.3, -20.1, -17.9, -15.7, -12.7, -10.9, -9.2];

// the servery LOBBY in the quad's south-west corner: single storey, flat-roofed with a coped parapet; on its quad face
// a 2-light window, a blank carved panel and the door near the corner. K: Huxley 2011 (form), LIDAR 4.3 (top); G: plan
// (u -15.3 .. -12.0, v 19.0 .. 21.8: LIDAR reads u -16 .. -12) and the ramp and steps (planning 04/02167/FUL not in the
// reference: drawn as two steps to a landing and a gentle ramp along the front)
export const LOBBY = {
  u0: -16.33, u1: -13.04, v0: 18.9, top: 4.3, floor: 0.75,     // K: survey (was -15.3 .. -12.0, 19.0)
  door: { u: -15.48, w: 1.0, h: 2.2 }, win: { u: -13.79, y: [1.5, 3.0], n: 2 }, panel: { u: -14.64, y: 2.6 },
  ramp: { u0: -11.3, u1: -14.75, w: 0.95 },   // runs west along the front up to the landing. G
};

// the Turl Street return, v 20 .. the lane corner (Chadwick 2017; the college's map): two single bays, a first-floor
// canted ORIEL under a coped gable (the gable LIDAR 13.6 at v 25 - 26), a single bay at the corner. K: form and order;
// G: each v. NB the west range's plan says "no oriel south of the gate": this one, at the very corner, is in Chadwick's
// picture and on the college's map.
export const STREET_BAYS = [{ v: 20.83, k: 1 }, { v: 22.71, k: 1 }, { v: 25.74, k: 'oriel' }, { v: 28.67, k: 1 }];   // (rescaled to the lane at 30.15)
export const ORIEL_T = { v: 25.74, front: 2.0, proj: 0.7, corbel: [3.75, 4.75], panel: [4.75, 5.2], lights: [5.2, 7.45], parapet: [7.45, 8.1] };
export const GABLE_T = { v: 25.74, w: 4.3, apex: 14.2, win: [12.45, 13.55] };     // K: LIDAR 13.6 at v 25 - 26 (cell average); G apex
// the lane face of the south range, from the corner to the Hall (Chadwick 2017: singles and a 2-light on the ground floor
// by the corner; Rhodes 2012: about six bays before a gable by the Hall). K: kinds near the corner, the gable; G: the rest
export const LANE_BAYS = [{ u: -22.4, k: 1 }, { u: -19.7, k: 2 }, { u: -17.0, k: 1 }, { u: -14.2, k: 2 }, { u: -11.5, k: 1 }, { u: -9.05, k: 1 }, { u: -6.5, k: 2, gable: true }];
export const LANE_PIPES = [-15.6, -7.8];
export const GABLE_L = { u: -6.5, w: 3.6, apex: 14.2, win: [12.45, 13.5] };     // K: LIDAR 14.1 at (-7, 29.5), Rhodes; G size
/** a stack on the lane face (LIDAR 13.6 at (-15, 30)): G form */
export const STACK_L = { u: -14.3, wu: 1.2, wv: 0.8, top: 13.9 };
/** the clustered stack at the corner (LIDAR 16.8 at (-19.5, 22); Huxley: six round flues). K: place, height; G: flues */
export const STACK_C = { u: -19.8, v: 22.4, nu: 3, nv: 2, top: 16.8, base: 14.5, flueR: 0.22, pitch: 0.55 };
export const GROTESQUE_PITCH = 1.7;     // on the street and lane cornices (Rhodes: grotesques on the lane cornice). K: present; G spacing
/** lanterns: on brackets on the Hall's lane wall (Rhodes 2012: two), and by the undercroft door. K: present; G: places */
export const LAMPS_S = [{ u: -1.7, y: 4.4 }, { u: 11.2, y: 4.2 }];

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['Hall skewed 3.78 deg on the quad (sheared frame): north face v 20.78 + 0.066 (u - 4.5), lane face 10.54 m south of it and parallel', 'K', 'topographic survey 21/00354/FUL p20 fitted (n 1368 / 1374 px, 3.87 / 3.68 deg); LIDAR 0.25 m edges agree within a cell'],
  ['the Hall\'s lane face 1 - 1.3 m south of the map\'s lane line (SITE_RING)', 'K', 'survey + LIDAR (building edge 31.6 - 32.6 at u 8 - 19)'],
  ['the lane face west of u 10.5 (beyond the survey sheet) on the same line', 'G', 'extended; LIDAR reads 0.3 - 0.4 further south at u -4 .. 0 (within a cell)'],
  ['gables square to the quad: west u -4.55, east u 19.8', 'K', 'survey (the quad-side step -4.4 .. -4.7; the lane step 19.83); LIDAR ridge ends'],
  ['long walls 1.1 thick, gables 0.75', 'G', '10.54 outside less 8.30 - 8.45 inside (05/00314, 22/01860); 24.35 less RCHM 23.0'],
  ['Hall embrasures 10.75, merlons to 11.35, gutter 9.6, ridge 15.9, roof about 52 deg', 'K', 'LIDAR lbox / v profiles (10.4 - 11.3; 15.3 - 15.9; the slope 1.1 - 1.35 a metre)'],
  ['Hall parapet string at 9.3 (a tall parapet band over the window heads)', 'G', 'Simon Q 2012 proportion'],
  ['merlon and gap widths (0.8 / 0.55), parapet thickness', 'G', 'Simon Q 2012 by eye'],
  ['north face: porch bay, four window bays, three-sided oriel at the east (dais) end; stepped buttresses between', 'K', '02 Simon Q 2012, 02 Huxley 2011, 03 Sones 2012'],
  ['north windows: THREE lights, two tiers (transom), vertical tracery in a four-centred head, a hood (contradiction 2 settled)', 'K', '02 Simon Q 2012 counted; interior E Webster 2011; the look 2026-11-23'],
  ['window sizes (2.3 wide, sill 3.8, transom 5.85, springing 8.0, apex 8.85)', 'K', 'Simon Q at 72 px/m; 22/01860/LBC north internal elevation (2.45 wide, sill 2.37, transom 4.3, apex 7.28 above the 1.55 floor) agrees to 0.15'],
  ['every Hall window is a real opening glazed with CLEAR leaded quarries (the quad seen through from inside, a little of the room from outside by day; small heraldic roundels, plain colours)', 'K', 'simononly 2012 (quarries, roundels); glass mesh of the part\'s own (_exeter_interior_kit.js); the tint and lead widths G'],
  ['buttresses at u 3.7, 7.5, 11.25', 'K', 'survey (+-0.2)'],
  ['north window bays midway between buttresses, porch and oriel', 'G', '22/01860/LBC spacing 3.7'],
  ['buttress set-offs 4.6 and 8.3, projections 0.85 / 0.6', 'G', 'Simon Q by eye'],
  ['undercroft: low two-light openings at the foot of the bays, a wall lantern', 'K', 'Simon Q 2012'],
  ['undercroft way in: a walled stair head u 0.7 .. 2.9 beside the porch, low walls 0.9 high; a straight stone flight 1.9 m wide descending south under the Hall\'s north wall to a lobby with a shut door', 'K', 'survey (the slot), LIDAR 0.87, 08/00644/LBC (a straight stair about 1.9 m wide in the north wall at the west end, descending south, then a lobby)'],
  ['the flight: 9 risers of 0.222 on 0.21 goings from a landing inside the open gate, the lobby 2.0 below the quad, the opening\'s head 1.1, the walls 0.15 thick, the gate open', 'G', '08/00644 sections not obtained; the lobby stops at the Hall\'s inner face (the hall\'s floors above it)'],
  ['the undercroft\'s floor 2.6 below the quad (y -2.44), beyond the lobby\'s door (the bar and its timber flight not built)', 'G', 'DIMENSIONS.md: about 2.5 - 3 m (not figured)'],
  ['undercroft openings in every bay, their sizes', 'G', 'seen in one bay only'],
  ['blank shields under the north windows', 'K', 'Simon Q, Sones (carved arms in life: drawn blank by rule)'],
  ['south (lane) face: six three-light transomed windows, set high, ashlar over a string at about 2.35, darker rubble base below', 'K', 'the look by hand 2026-11-23 (12 ... by hand 2026-11-23.jpg); survey B02 (six); Rhodes 2012'],
  ['lane windows have transoms (RCHM says not)', 'K', 'the look by hand 2026-11-23 overrides RCHM'],
  ['lane window sills at 5.2, transom 7.3', 'K', '22/01860/LBC south internal elevation (3.6 and 5.8 above the floor); 13/01302/LBC lane elevation (sills 4.9 above the lane)'],
  ['lane window positions on the north bays; the west one at -2.75 over the screens passage', 'G', '22/01860/LBC south internal elevation puts the west one at about -2.5 (K that it is over the passage)'],
  ['lane string 1.7 m above the lane', 'G', 'the look: 1.5 - 2 m'],
  ['a ventilation opening in the rubble base', 'K', 'planning 13/01302/LBC (survey B02); place and size G'],
  ['a projecting foot in the base under the lane stack', 'G', 'the look saw "a buttress-like projection"; that it is the chimney breast is a guess'],
  ['FLOREAT EXON: 11 grotesques at the lane parapet string, plain blocks', 'K', 'fact sheet (survey B02); positions G'],
  ['a stack on the west gable, top 17.1', 'K', 'LIDAR 16.7 at (-4.5, 25.5); Huxley 2011; top G'],
  ['a stepped stack on the lane wall at u 6.7, top 13.7', 'K', 'LIDAR 13.4 at (6 - 7, 30 - 31); 13 Tilman 2025 (form); sizes G'],
  ['no louvre on the ridge', 'K', 'PHOTO_NOTES (13 tower views)'],
  ['porch: u -3.85 .. -0.15, front LOCAL v 19.0, door middle -2.0; its front to 7.15, lead flat 6.75, pinnacles to 8.9', 'K', 'survey (front fit, threshold -2.8 .. -1.1); LIDAR heights'],
  ['porch: pointed door with continuous mouldings (two real oak leaves that open as you walk at them, the traceried head fixed), string with bosses, two blank shields, clock dial blue with gold numerals between pairs of traceried lights, a traceried band, corner buttresses with pinnacles', 'K', '03 Sones 2012 close; Simon Q'],
  ['porch figures (door 1.6 wide, apex 4.75; clock at 6.3, r 0.43)', 'G', 'Simon Q at 72 px/m; Sones proportions'],
  ['the porch bay window over the porch: five narrow lights in a four-centred head', 'K', 'Simon Q 2012, Sones close (RCHM says 3-light: the pictures stand)'],
  ['porch steps: 7 risers to the Hall\'s floor (1.55), six treads wrapping the porch on three sides (outer front v 17.13), no side walls', 'K', 'survey (six nested U lines); 22/01860/LBC (hall floor, no step inside)'],
  ['Hall floor 1.55 above the datum', 'K', '22/01860/LBC internal elevations against the outside\'s window heights and gutter (1.55 - 1.57); +-0.1'],
  ['porch leaves 0.8 x 2.2 opening inward, the head over them fixed', 'G', '22/01860/LBC plan (a pair swinging in: K); Sones 2012 (the traceried head)'],
  ['step rise / going and widths', 'G', 'by eye'],
  ['oriel: west return u 14.7 -> 15.2, front 15.2 .. 18.55 at LOCAL v 20.68, east return to 19.0; 4 + 1 + 1 lights in three tiers, battlemented', 'K', 'survey (return and front fit n 552); Simon Q, Huxley; 22/01860/LBC (4.06 m bay)'],
  ['the oriel\'s front carried on to the east range\'s quad face (v 20.66) and the Hall\'s north-east corner closed to the gable (u 19.9): no east return seen, no light in it', 'G', 'survey (the front v 20.65 - 20.72 runs to the east range, u 19.0 - 19.8); photographs say one light in each return: the east one is taken as hidden in the junction (2026-11-23: there was a see-through slot here)'],
  ['oriel sizes and tier heights', 'G', 'Simon Q by eye'],
  ['south range quad face at v 22.2 from the west range to the Hall', 'K', 'survey fit 22.20 - 22.25 (n 3158)'],
  ['the west range\'s quad face continued at u -16.15 from v 20 to the corner; Turl Street face -23.7 .. -23.9', 'K', 'survey (west plan); LIDAR v 21 / 29 rows'],
  ['the south range\'s lane face a straight line (-23.9, 30.15) .. (-4.55, 30.75)', 'G', 'LIDAR edges 30.2 - 31.4 (a stack and dormers in the cells)'],
  ['quad bays, dormers, lane bays, street bays rescaled onto the moved faces', 'G', 'positions kept in proportion'],
  ['south range heights as the west range (cornice 11.4 quad / 11.6 street, parapet 12.4, gutter 11.9)', 'K', 'LIDAR 11.6 - 12.1; the west plan'],
  ['south range E-W ridge 13.5 on v 25.7 from Turl Street (a low gable behind the oriel gable) to the Hall; the west range\'s ridge carried south to meet it', 'K', 'LIDAR 13.0 - 13.8 on v 26, 13.6 at the Turl face v 25 - 26; 13.5 - 13.7 at u -20; 13 Tilman 2025 (one roof to the street)'],
  ['quad face bays single | 3 | 2 | 3 | 2 on the upper floors; single | 3 | 2 | door | lobby below', 'K', '02 Huxley 2011 counted'],
  ['quad bay positions', 'G', 'Huxley at 45 px/m'],
  ['staircase 3\'s door the one at u -12 (plate "3")', 'G', 'college map puts 3 at the corner'],
  ['storey heights of the quad face (as the west range QD)', 'G', 'west plan (Godot13); Huxley shows the strings level with the west range'],
  ['five flat-topped dormers on the quad slope', 'K', 'Huxley 2011; positions G'],
  ['seven flat dormers on the lane slope', 'K', '13 Tilman 2025 from St Mary\'s (count); positions G'],
  ['servery lobby: u -16.33 .. -13.04, front v 18.9; single storey, flat with a coped parapet, 2-light window, blank panel, door', 'K', 'survey; Huxley 2011; LIDAR 4.3'],
  ['lobby plan, its ramp and steps', 'G', 'planning 04/02167/FUL not in the reference'],
  ['Turl Street return: two singles, a first-floor canted oriel under a coped gable, a single at the corner; strings round the corner', 'K', '01 Chadwick 2017 (corner), college map (oriel under a gable), LIDAR gable 13.6 at v 25 - 26'],
  ['Turl Street return positions, oriel and gable sizes (as the west range\'s gabled oriel)', 'G', 'Chadwick by eye; west plan ORIEL_N'],
  ['lane face of the south range: Underwood\'s ashlar, cusped single and 2-light windows under square labels, plinth, strings, cornice with grotesques, parapet', 'K', '01 Chadwick 2017; 03 Rhodes 2012; 12 Longbottom 2013'],
  ['lane face bay count (6 + the gable bay), kinds away from the corner, pipes', 'G', 'Rhodes 2012 by eye'],
  ['a gable on the lane face by the Hall with a window', 'K', 'Rhodes 2012; LIDAR 14.1 at (-7, 29.5); size G'],
  ['a stack on the lane face at u -15', 'G', 'LIDAR 13.6 at (-15, 30): form unseen'],
  ['clustered stack of six round flues at the corner, top 16.8', 'K', 'LIDAR 16.8 at (-19.5, 22); Huxley 2011; flue count G'],
  ['two bracket lanterns on the Hall\'s lane wall, one by the undercroft door', 'K', 'Rhodes 2012; Simon Q; positions G'],
  ['ground: quad 0.16 at the Hall, 0.3 - 0.5 in the corner; lane 0.22 at Turl St rising to 0.68; Turl St 0.1 - 0.22', 'K', 'LIDAR lgbox'],
  ['materials: Bath ashlar (street, lane), Headington / Clipsham on the quad, Farmington buttresses, rubble base on the lane, Welsh slate', 'K', 'survey section 5; the look'],
];
