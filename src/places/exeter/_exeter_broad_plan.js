// Exeter College, STANDALONE model, part 'broad' (survey B08): THE PLAN of the BROAD STREET RANGE and the BROAD STREET
// TOWER: Scott's west part (1854-5; staircases 10 and 11), Scott's gate tower (1856-8) with the gate passage (the
// "Undercroft"), Underwood's east part (1833-4) with the east-end gable bay, and the staircase 9 block ("College Offices",
// the Crowther Hunt Building: Underwood's block + the 1983 extension) down the east side of Margary Quad to the Rector's
// Lodgings, with the internal courtyard over the Saskatchewan Lecture Theatre. Pure data: every dimension a named constant
// with its source; the build functions are in _exeter_broad_build.js. LOCAL frame (u east, v south, y above the datum
// 64.40 m: _exeter_shared.js). Brief: docs/handoff/exeter/briefs/broad.txt.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (tools/exeter_lidar.py lbox / v profiles / a 0.1 m edge search of the surface over the bare ground;
//     docs/handoff/exeter/tools/xsec.py over u -3..16 and u 25..35):
//       - the street face: v -62.0 (u -4) .. -61.4 (u 16): the line of the Thomas Wood Building's 1.6 deg wing continued
//         (part 'margary' fixed its end at (-4.01, -61.75)); the tower 0.3 m forward of it; Underwood's face v -60.5 (u 25)
//         .. -60.2 (u 43): 0.4 m behind Scott's line and running with it (the survey's 5.4 deg for the east end is the
//         map's; the LIDAR's faces stand); the east oriel to v -61.1 at u 38.6 .. 42.4 (the site ring agrees).
//       - Scott's part: eaves 11.3 - 11.8 front and back, ridge 15.0 at v -56.9 (4.5 m in), the quad face v -52.0 .. -52.3
//         (bays); stacks 17.9 at u -2 and 17.2 at u 8; gable peaks 15.2 - 15.6.
//       - the tower: u 17.6 .. 24.3, v -61.4 .. -51.5 (the whole depth of the range), lead flat 80.5 (16.1), battlements
//         82.0 (17.6) at its edges; something to 82.0 on its east side at v -58 .. -56 (the turret, G).
//       - Underwood's part: eaves 12.4 (13.1 above the pavement), ridge 15.2 at v -56.7; behind it a second pile (the 1983
//         extension) v -53 .. -45.5, 78 - 79 (eaves 13.0, ridge 14.6); a strip u 24 .. 31 down to the Lodgings at v -38.4,
//         12 - 14; stacks 17.4 - 17.7 at (27.5, -46); the courtyard at 64.4 (y 0.0) over u 31 .. 41, v -45 .. -40.
//       - ground: Broad Street pavement 63.83 (u -2) .. 63.60 (u 21 .. 33) .. 63.72 (u 41); Margary Quad 63.78 - 63.8.
//   * PLANNING (reference/exeter/20 planning drawings/DIMENSIONS.md and the drawings): 08/00203 (1:50): the range of
//     staircases 10-11 21.1 m from the TW party wall to the gate passage's west wall, 8.9 m deep, bays 0.5 m forward on
//     the quad side, Broad Street wall 0.75 thick, gate passage 3.8 m clear, the gates 3.2; a basement area on the quad
//     side 6.5 x 1.5 with a straight flight down. 04/00586 (1:100): area about 9.5 x 1.2 between the two doors, door
//     thresholds 0.2 - 0.37 above the paving, ramps; ground floor pointed two-light windows and pointed doors. The 1:500
//     topographic survey: gate passage 63.70 (street end) / 63.77 (quad end). 18/00694: the Crowther Hunt Building 20 x 19
//     m, its courtyard face 5 storeys of 2.70 m, eaves 12.8 - 13.1, hipped ridge 14.5 above the courtyard; the courtyard
//     10.3 x 6.1 m with a 2018 single-storey glazed extension 3.5 x 6.1 at its east end. 16/00769: wall lanterns W1 x 2
//     on the 10-11 range, W1 at staircase 9; C2 up / down lights in the "Undercroft"; the W1 lantern 245 x 310, bracket 590.
//   * PHOTOGRAPHS (reference/exeter/11 ...): BethNaught 2015 (the whole front from the north-east: the east gable bay with
//     its 2-storey canted oriel, FOUR gabled dormers on Underwood's roof over four window columns, the tower, Scott's four
//     tall gables and two clustered stacks); Nahbios 2010 (the tower square on: four stages, the gate, the oriel, the
//     2-light window with a trefoil, the niche and statue between two lancets, battlements; the bays either side);
//     wuppertaler 2019 x 3 (from the Turl Street corner; the tower and Underwood's part from the east; the Scott front at
//     night: square-headed cusped 2-light windows, a stair bay of pointed traceried windows, buttress strips); Ozeye 2009
//     (from the west); Templeman 2014 (the east bay close: the oriel's tiers, parapet, gable window, the plinth with
//     grilles; scaled at 41 px a metre off the oriel); Ozeye 2007 (the roofs from the Sheldonian: the east bay's gable is a
//     cross-wing, the tower's turret). "broad street gate and range ... (by hand 2026-11-23)": the gate's leaves, the
//     winged keystone, the plaque, and the range WEST of the gate (the Thomas Wood Building closes the view: the survey's
//     section 11 says "east of the gate": it is the Scott part) with its stair bay of pointed windows, battlemented bays
//     and gables with paired lancets.
//   * THE QUAD SIDE: planning 08/00203 "08 internal and external views" p.2 (Montgomery 2008: three photographs of the
//     south elevation to Margary Quadrangle, staircases 10 and 11, and one looking east to the staircase 9 block): three
//     projecting gabled bays (one wide) with recessed bays between under battlemented parapets with small lead-hipped
//     dormers; paired pointed lancets on every floor, larger pointed two-light windows on the ground floor; pointed doors
//     to 10 and 11; the railed basement area in front of the wide bay; wall lanterns on the wide bay.
//
// THE RANGE'S OWN FRAME. Everything on Broad Street is authored in (x, y, z): x east along the street front from the party
// wall with the Thomas Wood Building, z into the quad (south), y above the datum. LOCAL (u, v) = P0 + x E + z N.

export const DATUM = 64.40;
export const Y = (mOD) => +(mOD - DATUM).toFixed(3);

// ------------------------------------------------------------------------------------------------ frame
export const P0 = [-4.01, -61.75];          // the Thomas Wood Building's east party wall on Broad Street. K: _exeter_margary_plan.js EAST_END
export const ANG = 0.0275;                  // the street front's turn from the Front Quad's frame (rad), = the TW wing's. K: LIDAR faces v -62.0 (u -4) .. -61.4 (u 16)
export const E = [Math.cos(ANG), Math.sin(ANG)], N = [-Math.sin(ANG), Math.cos(ANG)];
export const toL = (x, z) => [P0[0] + E[0] * x + N[0] * z, P0[1] + E[1] * x + N[1] * z];

// ------------------------------------------------------------------------------------------------ levels
/** Broad Street's pavement along the front (x). K: LIDAR bare ground 63.83 / 63.80 / 63.72 / 63.70 / 63.63 / 63.72 */
export const STREET = [[0, -0.57], [9, -0.62], [17, -0.68], [25, -0.70], [34, -0.77], [42, -0.70], [47.3, -0.67]];
export const FOOT = -1.1;                   // every wall carried down to here
export const FOOT_ST = -3.2;                // the street faces: deeper (the city's ground is not drawn inside the site ring)
export const PASSAGE_Y = [Y(63.70), Y(63.77)];   // the gate passage's floor, street end / quad end. K: topographic survey
export const COURT_Y = 0.0;                 // the internal courtyard. K: LIDAR 64.4 - 64.5; _exeter_rector_plan.js COURT_Y
export const WELL_Y = Y(61.45);             // the basement area's floor before staircases 10 - 11. K: 16/01398 south elevation 1:100 (fix-up pass, read at 300 dpi, 118.2 px/m): the flight drops 2.2 m in 14 risers and the doors' foot is 2.35 m under the quad paving (63.78 here); LIDAR's DTM (61.8 - 63.0) cannot see into a 1.3 m slot
// (Margary Quad's paving: _exeter_margary_plan.js quadY, imported by the build)

// ------------------------------------------------------------------------------------------------ SCOTT'S PART (x 0 .. 21.6)
export const SC = {
  x1: 21.6,                 // the tower's west face. K: 08/00203 21.1 to the passage's west wall less ... ; LIDAR u 17.6
  depth: 8.9,               // street face to the quad face of the recessed bays. K: 08/00203 1:50 (04/00586 9.4; LIDAR 9.4 - 9.6 with the bays)
  bayProj: 0.35,            // the quad side's gabled bays stand forward. K: 08/00203 "about 0.5"; LIDAR; the light well's width (04/00586 1.2) fixes 0.35
  eaves: 11.7, ridgeZ: 4.45,  // K: LIDAR (street side 11.3 - 11.8)
  ridge: 15.4,              // (third pass: was 15.0) K: 16/01398 1:100 elevation, the long ridge line 16.0 above the quad paving
                            // (-0.6); LIDAR v profiles 2026-11-23 at u 0 / 3.4 / 12 / 16: 15.1 / 15.9 / 16.1 / 15.3 at v -57
  cornice: 0.3,             // the eaves string's height. G
  plinth: 0.15,             // the plinth's top on the street (0.75 above the pavement). K: night photo; figure G
  // three storeys: window sills / heads and the strings. K: Nahbios 2010 scaled between the strings (69 px a metre), G +-0.2
  g: [0.5, 2.5], f: [3.9, 6.1], s: [7.85, 10.1], strings: [3.5, 7.4],
  lightW: 0.55, mull: 0.16, headRise: 0.18, reveal: 0.28,
  gableWin: { sill: 12.15, spring: 13.35, rise: 0.42, lw: 0.42, mull: 0.16 },   // paired lancets in each gable. K street view (by hand); sizes G
  battle: { h: 0.55, merlon: 0.75, gap: 0.55, mh: 0.45 },   // the battlemented parapets of the recessed / stair bays. K street view, quad photographs
};
// THE STREET FRONT, west to east: [x0, x1, kind, columns]. K: BethNaught 2015 (four gables), Turl corner 2019, the hand look
// (stair bays of pointed windows), Nahbios (a gable next to the tower); widths G +-0.5 (scaled by eye on LIDAR's length)
export const SC_STREET = [
  { x0: 0.0, x1: 3.0, kind: 'flat', cols: [1.5] },
  { x0: 3.0, x1: 7.2, kind: 'gable', cols: [5.1] },
  { x0: 7.2, x1: 8.8, kind: 'stair', cols: [8.0] },           // staircase 11's stair (its door is on the quad at u 3.2)
  { x0: 8.8, x1: 12.5, kind: 'gable', cols: [10.65] },
  { x0: 12.5, x1: 16.2, kind: 'gable', cols: [14.35] },
  { x0: 16.2, x1: 17.8, kind: 'stair', cols: [17.0] },        // staircase 10's stair
  { x0: 17.8, x1: 21.6, kind: 'gable', cols: [19.7] },
];
export const SC_STAIR = { g: [0.6, 2.55], f: [4.2, 6.75], s: [8.0, 10.45], lw: 0.42, mull: 0.16, rise: 0.4, roundel: 0.2 };   // K hand look, night photo; G sizes
export const SC_PIPES = [3.0, 8.8, 16.2];          // lead downpipes with hopper heads. K: street view (three); places G
export const SC_STACKS = [                          // clustered round flues on a square base. K: LIDAR 17.9 / 17.2; Turl corner 2019 (four flues)
  { x: 1.9, z: 4.45, top: 18.35, n: 4 },            // (third pass) K: 16/01398 elevation 18.95 above the paving at the west end; LIDAR 18.4 at (-2.5, -58)
  { x: 12.5, z: 4.45, top: 17.2, n: 4 },
];
// THE QUAD (SOUTH) FACE OF SCOTT'S PART, third pass (2026-11-23, the faces round Margary Quad). EVIDENCE, read by hand:
//   * 16/01398/LBC "01 south elevation" (BGS 2016, 1:100, its 5 m bar = 296 px at 150 dpi, 59.2 px a metre, exact): the
//     quad face from the party wall to staircase 10's bay. Every height below was read off the drawing as dark-pixel runs
//     (scripts outside the repo) ABOVE ITS DRAWN GROUND LINE (the paving at the doors, 63.8): plinth 0.54, first-floor sill
//     string 4.26, second-floor sill string 7.50, eaves cornice band 10.74 - 10.91, battlement coping (crenels) 11.6, merlon
//     tops 12.06 (merlons 0.55 wide, gaps 0.57), gable kneelers 12.06, gable apexes 15.6 (finials 15.85), the long ridge line
//     16.0, the stack at the west end 18.95. On the datum (paving -0.6) these agree with LIDAR's readings (battlement tops
//     11.4 - 11.6 at the recessed bays, ridge 15.1 - 16.1, stack 18.4): LIDAR's "eaves 11.7" was the battlements' top. (The
//     figures 3.8 / 7.0 / 10.3 / 15.5 in DIMENSIONS.md were taken from a line 0.55 m higher, the ramp's: superseded.)
//     Bays (sheet metres, anchored on the wide gabled bay = the survey's u 4.85 .. 10.4): a gabled bay 5.62 wide (two window
//     columns 1.18 either side of its middle, two lancets in the gable 1.11 apart), staircase 11's narrow bay 2.57 (the door
//     at its WEST end with a hood mould, a vent and two downpipes east of it, single lancets above the door), the wide gabled
//     bay 5.59 (two columns), staircase 10's bay 4.87 (the door 2.4 m in with a two-light column over it, a single light near
//     its east end on the ground floor only), then the east gabled bay (cut by the sheet's edge). Windows: ground floor two
//     cusped lights under a containing pointed arch (outer 1.41 incl. the moulding, sill 1.2, apex 3.3); first and second
//     floors PAIRS of cusped lancets (1.21 over both, sills 4.54 / 7.75, apexes 6.2 / 9.45); gable lancets 0.59, sill 11.06,
//     apex 12.84, a transom. Dormers: gabled, a single cusped light, body 1.0 wide, eaves 13.1, gable apex 14.6 - 14.8,
//     iron finials to 15.3, standing behind the battlements of the recessed bays (NOT lead-hipped: the first pass's guess).
//   * The photographs: 08/00203 "08 internal and external views" p.2 (Montgomery 2008, three views) and 16/01398 "05 design
//     and access statement" pp.8 and 13 (BGS 2016: "entrance to Staircase 11", "existing ramp"): the recessed bays are set
//     back their WHOLE HEIGHT (the gabled bay's return is seen to the parapet), the door of 11 is a plain pointed doorway in
//     the recessed face with a moulded hood and label stops, a panelled oak door with six long glazed panels (NOT an arched
//     entrance passage: the first pass's 1.3 m passages are gone); a flagged ramp with a low coped kerb rising east along the
//     west gabled bay to a landing before the recess, two steps down east of the landing beside a stone pier, the railing of
//     the basement area (scrolled top rail) beyond; the gabled bays' ground windows under a relieving arch of voussoirs; one
//     W1 lantern on the wide bay, east of its second window, at about the first-floor string.
//   * The 1:500 topographic survey (zoomed by hand at 31.5 px a metre): staircase 11's recess 2.6 m wide, its back 1.25 m
//     behind the bays' fronts, the door opening in its back wall at the WEST end (centre 0.6 m from the west return);
//     staircase 10's recess 4.9 - 5.0 m wide, 1.3 m deep, its door swing 2.5 m from its west end, "RAMP" written INSIDE the
//     recess (the ramp rises westwards along the recess from its east end), the east gabled bay about 2.8 m to the tower.
// Recess depth: z 8.0 for both (1.25 behind the gabled bays' fronts at zB 9.25; survey, +-0.15).
export const QF = {
  base: -0.6,                         // the quad paving at the face, the drawing's ground line. K: topographic survey 63.75 - 63.85
  plinth: 0.54, strings: [4.26, 7.50], cornice: [10.74, 10.91],   // above the paving. K 16/01398
  crenel: 11.6, merlonTop: 12.06, merlon: 0.55, gap: 0.57,         // K 16/01398
  kneel: 12.06, apex: 15.6, finial: 15.85, kneelIn: 0.64,          // the gables. K 16/01398 (rake feet 0.64 in from the bay's edges)
  g: { sill: 1.2, spring: 2.6, apex: 3.3, w: 1.25, lw: 0.42, mull: 0.16 },   // ground: two cusped lights under a containing arch. K
  f: { sill: 4.54, apex: 6.2 }, s: { sill: 7.75, apex: 9.45 },     // pairs of lancets. K
  lw: 0.5, mull: 0.21, rise: 0.45,                                  // K (1.21 over a pair); rise G
  gl: { sill: 11.06, apex: 12.84, w: 0.5, gap: 1.11, rise: 0.3 },   // gable lancets. K (gap: centres)
  door: { w: 0.95, spring: 1.95, rise: 0.6, hood: 3.73 },           // above the threshold (hood above the paving). K drawing (apex 2.82 over a 0.32 sill), photo
  dormer: { w: 1.0, sill: 11.45, eaves: 13.08, apex: 14.7, finial: 15.25, lw: 0.42, lightApex: 12.9, front: 0.6 },   // K drawing; front's set-back G
  single: { w: 0.5, g: [1.23, 3.0] },                               // single lancets. K
};
export const SC_QUAD = [
  { x0: 0.0, x1: 0.67, kind: 'flat', z: 8.9, cols: [] },                                                   // a plain strip at the party wall: G (the sheet starts at the gabled bay)
  { x0: 0.67, x1: 6.29, kind: 'gable', cols: [2.30, 4.66] },
  { x0: 6.29, x1: 8.86, kind: 'flat', z: 8.0, singles: [6.75], door: 6.95, no: 11, dormer: 7.02, vent: 7.8 },
  { x0: 8.86, x1: 14.43, kind: 'gable', cols: [10.39, 12.77], well: true },
  { x0: 14.43, x1: 19.0, kind: 'flat', z: 8.0, cols: [16.8], door: 16.85, no: 10, dormer: 16.5, groundSingle: 18.6 },
  { x0: 19.0, x1: 21.6, kind: 'gable', cols: [20.3], gl: 0.8 },                                             // the east gabled bay: survey 2.8, sheet 2.3 (G +-0.3); lancets 0.8 apart G
];
// THE RAMPS (second pass, re-fitted in the third). 11: along the west gabled bay's face from x0 (low, west) to the recess's
// mouth x1, outer edge zOut, then a level landing over the recess (K: survey, the 2016 photographs). 10: INSIDE its recess
// (survey "RAMP" written there), from its east end x0 (low) to x1, the landing on to the door, a railing along the outer edge
// of both (photograph 08/00203 p.2: railings before staircase 10's bay). Widths G.
export const RAMPS = [{ bay: 11, x0: 3.0, x1: 6.29, zOut: 10.35, rail: true }, { bay: 10, x0: 19.0, x1: 17.75, zOut: 10.3, rail: true }];
export const QDOOR = { w: QF.door.w };       // (kept for older readers)
// the basement area (fix-up pass: extended east). 16/01398 south elevation (existing, 1:100 at 300 dpi; measured from the wide
// gabled bay's west edge, the bay drawn 5.69 for 5.57): the area's west wall 0.6, the doors 0.85 - 2.35 (a pair 1.5 m wide,
// facing south in the area's back wall), the flight's foot 2.6, its head 6.75 - 6.9, the railing on to 7.2 - 7.35 (14 risers
// of about 0.157 on 0.30 goings: a flight 4.2 m long); the topographic survey's railing u 5.0 .. 12.2 at v -51.1. So the area
// runs u 5.0 .. 11.6 (its head in front of staircase 10's recess; ramp 10's landing carries the railing on east), the flight
// 14 x 0.30 down westwards to its foot at u 7.4, the doors at the west end. No windows in its back wall (none drawn).
export const WELL = { u0: 5.0, u1: 11.6, vS: -51.0, steps: 14, going: 0.3, railH: 1.0, doors: [9.25, 10.75], doorH: 2.0 };   // K: 16/01398 elevation, survey (u0, the railing's line); u1 +-0.15
export const LAMPS_Q = [{ x: 13.9, y: 3.5 }, { x: 18.2, y: 3.5, z: 8.0 }];   // W1 x 2 (16/00769). The first K: 16/01398 elevation and Montgomery 2008 (east of the wide bay's second window, just under the string); the second's place G (none seen)

// ------------------------------------------------------------------------------------------------ THE TOWER (x 21.6 .. 28.3)
export const TW = {
  x0: 21.6, x1: 28.3, zF: -0.3, zB: 9.6,       // K: LIDAR u 17.6 .. 24.3, v -61.4 .. -51.5; Nahbios width 6.4 - 6.7
  roof: 16.1, cornice: 16.25, parapet: 16.95, top: 17.6,   // K: LIDAR 80.5 / 82.0; parapet / merlon split G (Nahbios)
  battle: { merlon: 0.95, gap: 0.65, h: 0.65 },             // K Nahbios (five across the front)
  angle: { w: 0.45, proj: 0.15, top: 12.6 },                // plain clasping angle strips. K Nahbios; G sizes
  strings: [3.95, 9.55, 12.6],                               // K Nahbios
  // the passage (the "Undercroft"): K 08/00203 3.8 clear; G the vault
  pass: { xc: 24.95, w: 3.8, spring: 2.0, apex: 4.4, frontWall: 0.9, backWall: 0.8,
    // second pass: three bays of transverse stone arches on wall shafts under a flat ceiling with downlights (survey: dots on
    // both walls about 2.7 m apart; a photo sphere: two downlights just under the arch's apex inside). G form and heights
    bays: 3, shaft: 0.32, shaftProj: 0.18, ceiling: 4.05, archSpring: 2.55, archRise: 1.0, archW: 0.4 },
  gate: { w: 3.2, spring: 1.7, rise: 2.1 },                 // the pointed street arch; K Nahbios (width = the gates 3.2: 08/00203); G heights
  qgate: { w: 3.4, spring: 1.85, rise: 2.0 },               // the quad arch. K photograph (pointed); G sizes
  oriel: { front: 1.7, proj: 0.85, corbel: [3.95, 4.95], panel: [4.95, 5.6], lights: [5.65, 8.3], parapet: [8.3, 9.3] },   // K Nahbios; G +-0.2
  win2: { w: 1.55, sill: 9.75, spring: 11.0, rise: 1.25 },  // the 2-light traceried window with a trefoil. K Nahbios
  lancets: { xs: [23.1, 26.8], w: 0.5, sill: 12.8, spring: 14.15, rise: 0.45 },   // K Nahbios
  niche: { w: 0.8, y0: 12.85, y1: 14.95, statue: 1.55 },     // canopied niche with a plain figure. K Nahbios (no likeness)
  turret: { x0: 27.0, x1: 28.45, z0: 3.8, z1: 5.8, top: 17.85, spire: 20.2 },   // the pinnacle turret. K: Ozeye 2007, BethNaught; G place and size
  plaques: { w: 0.75, y0: 0.55, y1: 2.05 },                 // plain stone plaques either side of the gate. K Nahbios, hand look
  undercroftLamps: [2.6, 6.8],                               // C2 up / down lights (z). K 16/00769; G places
};

// ------------------------------------------------------------------------------------------------ UNDERWOOD'S PART (x 28.3 .. 47.3)
export const UW = {
  x0: 28.3, x1: 47.3, zF: 0.4, zB: 7.8,      // K: LIDAR face 0.4 behind Scott's line; the end at the Old Ashmolean (u 43.3: site ring)
  eaves: 12.2, parapet: 12.75, ridge: 15.2, ridgeZ: 4.1,   // K: LIDAR 12.4 / 15.2 at v -56.7
  plinth: 1.0,                                // with basement grilles. K Templeman; G figure
  g: [1.7, 3.8], f: [5.6, 7.5], s: [8.9, 10.6], strings: [4.5, 8.3], cornice: [11.9, 12.2],   // K Templeman 2014 scaled (41 px a metre)
  lightW: 0.56, mull: 0.15, headRise: 0.14,
  cols: [30.4, 33.6, 36.8, 39.9],             // four window columns, four dormers. K BethNaught 2015, Ozeye 2009 (not "about 6"); G places
  dormer: { w: 1.75, h: 1.55, rise: 0.95, sill: 12.3, depth: 1.6 },   // gabled stone dormers, 2 lights. K Nahbios (about the width of the windows below and a half); G sizes
  pipes: [28.65, 32.0],                       // K BethNaught; G places
  stack: { x0: 29.0, x1: 30.4, z0: 3.6, z1: 4.6, top: 17.4, n: 4 },   // the clustered stack beside the tower. K BethNaught, LIDAR 17.4 - 17.7; G plan
};
export const EB = {                            // the east-end gable bay (a cross-wing to the street)
  x0: 41.6, x1: 47.3, apex: 15.1,             // K: Templeman (gable / oriel 0.72), LIDAR; apex G +-0.3
  oriel: { xc: 44.45, front: 1.9, proj: 0.9, base: 1.0, low: [1.7, 3.8], panel: [3.95, 5.3], high: [5.3, 8.2], cornice: [8.2, 8.45], parapet: [8.45, 9.5] },   // K Templeman (2 lights a tier in front, 1 a side, a transom under the heads); site ring (projection)
  win2: [10.05, 11.5],                        // 2-light over the oriel. K Templeman
  gableWin: [12.45, 13.6],                    // square-headed 2-light in the gable. K Templeman, Ozeye 2007
};

// ------------------------------------------------------------------------------------------------ STAIRCASE 9 BLOCK (LOCAL)
// THIRD PASS (2026-11-23): the block's QUAD (west) FACE. EVIDENCE: Montgomery 2008 (08/00203 views p.2, "looking east"): the
// face seen square-on over the range's end: pairs of pointed lancets over sill strings, a battlemented parapet on a string,
// gabled dormers with white fronts of two pointed lights and slate gables in the slope behind, a tall stack of two round
// flues on a square base; the college's bird's-eye map (J Bays 2009, a drawing): three storeys of paired lancets under the
// battlements, four gabled dormers. LIDAR (lbox u 22 .. 32, v -52 .. -37, 2026-11-23): behind the west face the roof reads
// 73 - 76 (9 - 11.7: the battlements' top about 11.6, the gutter lower), rising about 45 deg to a ridge 78.0 - 78.4 (13.6
// - 14.0) at u 28 - 29, the east side falling again to about 76.5 at u 31; the 1983 pile's roof (77 - 78) only EAST of u 31.
// The first pass's 13.0 / 14.4 (the courtyard face's figures of 18/00694, which belong to the 1983 pile at the courtyard's
// level) gave this face five storeys and a parapet 2 m too high. Now: eaves cornice 10.9, battlements to 11.6, ridge 13.95,
// three storeys (sills 0.9 / 4.35 / 7.75), the strip's roof carried north to Underwood's back wall (v -53.2) behind the
// tower, the 1983 pile's west end moved to u 30.95 with a gable. G: the storey heights and window sizes (scaled by eye
// from the photograph between the strings), the dormers' sizes; that the face is Underwood's 1833 Gothic (matching
// Scott's work in the photograph), not the 1983 extension, I (its windows are the old pattern).
export const BACK = { ring: [[30.95, -53.4], [42.6, -53.4], [42.05, -45.5], [30.95, -45.5]], eaves: 13.0, ridge: 14.6 };   // the 1983 pile. K LIDAR (east of u 31), 18/00694
export const STRIP = { uW: 24.05, uE: 30.95, vN: -51.37, vS: -38.3, roofN: -53.2, eaves: 10.9, ridge: 13.95, parapet: 11.6 };   // down the quad's east side to the Lodgings. K LIDAR (third pass); rector plan (30.95)
export const S9 = {
  westRows: [[0.9, 2.85], [4.35, 6.05], [7.75, 9.45]], westStrings: [4.2, 7.6],   // three storeys of paired lancets. K count (photograph, map); G figures
  westLight: { lw: 0.42, mull: 0.16, rise: 0.38 },                                // G (photograph by eye)
  dormers: [-49.85, -46.6, -43.4, -40.2],                                          // K: four (map), three seen over the columns (photograph); places = the columns G
  dormer: { w: 1.15, sill: 11.3, eaves: 12.4, apex: 13.1, front: 0.5 },             // G (their lights seen over the battlements)
  rows: [[0.7, 2.25], [3.4, 4.95], [6.1, 7.65], [8.8, 10.35], [11.45, 12.75]],   // the 1983 pile's courtyard face: five storeys of 2.70 m. K 18/00694; window sizes G
  westCols: [-49.85, -46.6, -43.4, -40.2], door: -49.85,                         // K: staircase 9's door in the north part, facing west (DIMENSIONS); places G
  courtCols: [33.0, 36.0],                                                        // G
  stripEastCols: [-43.8, -41.5],                                                  // G
  stack: { u: 27.5, v: -46.2, top: 17.6, n: 2 },                                  // K LIDAR 81.7 - 82.1; two round flues (Montgomery 2008)
  lamp: { v: -48.8, y: 2.45 },                                                    // W1 at staircase 9. K 16/00769; G height
};
// STAIRCASE 9's LANDING AND THE BASEMENT STEPS (second pass; K: topographic survey: a landing at 64.16 along the block's face
// v -51.5 .. -47.2 behind a low wall at u 22.75 .. 23.0, then a flight of about 17 treads down southwards to v -42.3 with a
// wall stub west from its foot; the photograph 10 "Saskatchewan and Quarrell Rooms sign over basement-stair handrail" (P
// Huxley 2011): a black flat-bar handrail on the ashlar face turning down, the oak sign with an arrow down, a white-painted
// window beside it: these are the "basement steps adjacent 9" to the Saskatchewan and Quarrell Rooms). G: the steps up to
// the landing (two treads along its west side), the foot's door, the depth (14 x 0.19 to 61.5).
export const LANDING9 = { u0: 22.75, v0: -51.55, v1: -47.2, y: Y(64.16), wallT: 0.25, wallH: 0.9, upSteps: 3, upGoing: 0.3,      // upSteps = risers from the quad (two treads along the west side)
  flight: { n: 14, going: 0.28, rise: 0.19 }, foot: -42.3, sign: { v: -47.6, y: 1.55, w: 0.7, h: 0.36 } };
export const COURT = {
  ring: [[30.95, -45.5], [42.05, -45.5], [41.45, -39.1], [39.14, -39.42], [31.17, -40.18], [31.0, -40.2]],   // K: rector plan faces, site ring, LIDAR
  glass: { u0: 38.4, u1: 41.95, v0: -45.5, v1: -39.3, h: 3.3 },               // the 2018 glazed extension. K 18/00694 (3.5 x 6.1); G height
  steps: { u0: 31.2, u1: 32.4, v0: -45.3, v1: -42.0, n: 12, rise: 0.18 },     // "basement steps adjacent 9" to the Saskatchewan / Quarrell Rooms. K DIMENSIONS (named); G place
};

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['white-painted sashes / casements behind the stone mullions (leaded only in the stair bays)', 'K', 'BethNaught, Nahbios, Templeman, Montgomery 2008; night 2019 (leaded stair lights)'],
  ['a strip of pavement from the site ring to the street faces (the city draws none inside the ring)', 'K', 'SITE_RING lies 0.1 - 0.8 m north of the LIDAR faces; level from STREET'],
  ['the pavement strip is a walking floor at its drawn level (the city\'s smoothed ground stands 0.15 - 0.2 m above it: the step is now at the site ring, and 0.2 m at the gate where the tower stands forward of the ring)', 'K', 'tools/exeter_walk.mjs 2026-11-23; STREET levels (LIDAR)'],
  ['street front on the TW wing\'s 1.6 deg line from (-4.01, -61.75); Scott\'s face v -61.75 .. -61.16 (x 0 .. 21.6)', 'K', 'part margary EAST_END; LIDAR faces -62.0 .. -61.4'],
  ['Underwood\'s face 0.4 m behind Scott\'s line, the same angle (not the survey\'s 5.4 deg); east end u 43.3', 'K', 'LIDAR -60.5 .. -60.2; site ring (42.43, -59.85)'],
  ['Scott\'s part 8.9 deep to the recessed quad faces, gabled bays 0.35 forward', 'K', '08/00203 1:50 (8.9, bays "about 0.5"); LIDAR 9.4 - 9.6; 0.35 fitted to the 1.2 m area of 04/00586 and margary\'s hole'],
  ['Scott street side: eaves 11.7; three storeys with strings 3.5 / 7.4, sills 0.5 / 3.9 / 7.85', 'K', 'LIDAR; Nahbios scaled between strings (+-0.2)'],
  ['Scott ridge 15.4 (was 15.0), 4.45 m in from the street; the quad slope falls to a gutter at 10.45 behind the quad battlements', 'K', '16/01398 elevation (ridge 16.0 above the paving); LIDAR v profiles 15.1 - 16.1'],
  ['Scott street front: four tall coped gables (one, two, one) with paired lancets, two narrow stair bays, a flat end bay, battlemented parapets between', 'K', 'BethNaught 2015, Turl corner 2019, street view by hand; bay widths G'],
  ['Scott windows: two-light, cusped (small pointed heads) in square frames under labels; stair bays with pointed lancet pairs and a roundel, a single lancet below', 'K', 'Nahbios, night 2019, hand look; sizes G'],
  ['Scott stacks: clustered four round flues at u -2 (17.9) and u 8.5 (17.2)', 'K', 'LIDAR; Turl corner 2019; base plan G'],
  ['quad face of 10 - 11 (third pass): a 0.67 m strip at the party wall, the west gabled bay 5.62, staircase 11\'s recessed bay 2.57, the wide gabled bay 5.57, staircase 10\'s recessed bay 4.57, the east gabled bay 2.6 to the tower', 'K', '16/01398 south elevation 1:100 (bays scaled, anchored on the survey\'s wide bay); topographic survey zoomed (recess widths 2.6 / 4.9 - 5.0)'],
  ['the strip at the party wall (plain, battlemented) and the east gabled bay\'s width (survey 2.8, drawing 2.3: 2.6 taken)', 'G', 'the drawing begins at the west gabled bay; the sheet\'s edge cuts the east bay'],
  ['the recessed bays set back 1.25 m their WHOLE HEIGHT (faces at z 8.0), with plain returns, the strings and cornice carried round', 'K', 'topographic survey (depth 1.25 - 1.3 against the bays\' fronts); Montgomery 2008 looking west (the gabled bay\'s return to the parapet); BGS 2016 photographs'],
  ['quad heights above the paving (-0.6): plinth 0.54, sill strings 4.26 / 7.50, cornice 10.74 - 10.91, battlements: crenels 11.6, merlons 12.06 (0.55 wide, 0.57 gaps); gables: kneelers 12.06, apex 15.6, finial 15.85', 'K', '16/01398 elevation read as pixel runs (59.2 px a metre off its 5 m bar); LIDAR battlement tops 11.4 - 11.6 agree'],
  ['quad windows: ground floor two lights under a containing pointed arch (plate tracery, a solid tympanum; sill 1.2, apex 3.3) under a relieving arch of voussoirs on the gabled bays; first and second floors pairs of lancets 1.21 over both (sills 4.54 / 7.75, apexes 6.2 / 9.45); single lancets in staircase 11\'s bay; two lancets with a transom in each gable (sill 11.06, apex 12.84)', 'K', '16/01398 elevation; BGS 2016 photographs (the relieving arch, the containing arch); Montgomery 2008'],
  ['the lights\' cusping left out (plain pointed heads), the window columns of staircase 10\'s and the east bay', 'G', 'the drawing shows cusped heads and a solid tympanum; staircase 10\'s ground floor partly drawn'],
  ['gabled dormers (single cusped light, body 1.0, eaves 13.1, apex 14.7, iron finial 15.25) over the recessed bays, behind the battlements, lead roofs', 'K', '16/01398 elevation (was: lead-hipped, first pass); roof covering and the set-back G'],
  ['the doors of 11 (x 6.95: the WEST end of its recess) and 10 (x 16.85) are plain pointed doorways IN the recessed faces (0.95 wide, apex 2.55 over the threshold) with hood moulds and label stops, panelled glazed oak doors; thresholds 0.35 above the paving (the first pass\'s arched entrance passages removed)', 'K', '16/01398 elevation; BGS 2016 "entrance to Staircase 11"; Montgomery 2008; survey (door openings in the recesses\' back walls)'],
  ['ramp to 11 along the west gabled bay rising east to a landing over the recess; ramp to 10 INSIDE its recess rising west from its east end to a landing on to the door; railings on their outer edges and along 10\'s landing', 'K', 'topographic survey ("RAMP" twice, the second inside the recess); BGS 2016 photographs; Montgomery 2008 (railings before staircase 10)'],
  ['the ramps\' widths, their outer edges at z 10.3 (forward of the recesses), the landings\' edges (no steps modelled east of 11\'s landing: the photograph shows two)', 'G', 'survey kerb line v -51.1; widths by eye'],
  ['the wide gabled bay u 4.85 .. 10.4 (its face the survey\'s, -0.03)', 'K', 'topographic survey fitted'],
  ['basement area u 5.0 .. 11.6 (before the wide bay and on in front of staircase 10\'s recess), 1.3 wide, floor 61.45, a straight flight of 14 risers x 0.30 down westwards from its head at u 11.6 to a pair of doors 1.5 wide at its west end, railings round it, no windows in its back wall', 'K', '16/01398 south elevation 1:100 (fix-up pass: head 6.75 - 6.9 m and doors 0.85 - 2.35 m from the bay\'s west edge, 14 risers, 2.2 - 2.35 m deep); topographic survey (railing u 5.0 .. 12.2, back wall); 04/00586'],
  ['W1 lanterns: one on the wide bay east of its second window under the first-floor string (x 13.9, 3.5 up); one at staircase 9', 'K', '16/01398 elevation; Montgomery 2008; 16/00769'],
  ['the second W1 of 16/00769 on the 10 - 11 range placed on staircase 10\'s recess', 'G', 'none seen in the photographs'],
  ['ramp 10\'s landing cut back to x 15.6 in front (the area\'s head) and kept behind the area (an L, railed along the area\'s back)', 'G', 'follows the area; the landing\'s plan shape not drawn'],
  ['tower u 17.6 .. 24.3 through the whole depth (v -61.4 .. -51.5), lead flat 16.1, battlements to 17.6, five merlons a face', 'K', 'LIDAR; Nahbios'],
  ['tower stages: pointed gate; 3-light canted oriel (2 front + 1 each side) on a stepped corbel with a winged keystone, quatrefoil base and parapet; 2-light window with a trefoil; niche with a plain figure between two lancets', 'K', 'Nahbios 2010, wuppertaler 2019, hand look 2026-11-23; heights G +-0.3'],
  ['gate: 3.2 wide pointed arch, passage 3.8 clear, floor 63.70 -> 63.77, setts', 'K', '08/00203; topographic survey; hand look (setts)'],
  ['the passage: three bays of transverse stone arches on wall shafts (2.7 m apart) under a flat ceiling at +4.05 with two downlights a bay', 'K', 'topographic survey (dots on both walls at regular spacing); a photo sphere (downlights under the arch\'s apex), lead\'s hand look 2026-11-23'],
  ['the arches\' and ceiling\'s form and heights; a removable bollard near the street end', 'G', 'the survey\'s small square in the passage; 2007 site plan: dashed lines only'],
  ['the studded gate leaves shown OPEN against the passage walls (a way through)', 'G', 'photographs show them shut; brief: a real way through'],
  ['the quad arch of the passage: pointed, 3.4 wide', 'K', 'Montgomery photograph (edge); size G'],
  ['tower quad face windows (2-light first and second floor, a lancet at the top) and the side lancets', 'G', 'one lancet seen at the top of the quad face; the rest guessed'],
  ['tower pinnacle turret on the east side, 1.45 x 2.0, to 17.85 with a lead spirelet to 20.2', 'K', 'Ozeye 2007 ("pinnacle turret"), BethNaught (spire at the tower\'s east), LIDAR 82.0 there; place, size and spire height G'],
  ['C2 up / down lights in the passage', 'K', '16/00769; places G'],
  ['Underwood\'s part: eaves 12.2 with a plain parapet to 12.75, ridge 15.2 4.1 m in; four window columns and FOUR gabled stone dormers', 'K', 'LIDAR; BethNaught 2015, Ozeye 2009 (the notes\' "about 6" counted again: four); places G'],
  ['Underwood storeys: sills 1.7 / 5.6 / 8.9 over a 1.0 plinth with basement grilles, strings 4.5 / 8.3, cornice 11.9 - 12.2', 'K', 'Templeman 2014 scaled (41 px a metre); G +-0.3'],
  ['east-end gable bay u 37.6 .. 43.3 as a cross-wing, coped gable to 15.1 with a square-headed 2-light', 'K', 'Templeman, Ozeye 2007, LIDAR'],
  ['east oriel: two storeys from the plinth, 2 lights front / 1 each side with transoms, quatrefoil panel between the tiers, openwork parapet, projecting 0.9', 'K', 'Templeman 2014; site ring (to v -61.13); G heights'],
  ['the "smaller oriel" of the notes is the east oriel seen obliquely (Ozeye 2009); Scott\'s "first-floor oriel" is the tower\'s (Turl corner 2019)', 'K', 'photographs compared; none other built'],
  ['clustered stack on Underwood\'s ridge beside the tower', 'K', 'BethNaught; LIDAR 17.4 - 17.7; plan G'],
  ['staircase 9 block: the 1983 pile behind (u 30.95 .. 42.6, v -53.4 .. -45.5, eaves 13.0, ridge 14.6, a gable at its west end) and the strip down the quad\'s east side (u 24.05 .. 30.95, its roof carried north behind the tower to v -53.2) to the Lodgings at v -38.3', 'K', 'LIDAR lbox 2026-11-23 (the pile\'s roof only east of u 31); 18/00694; rector plan'],
  ['the strip\'s quad face (third pass): eaves cornice 10.9, battlements to 11.6, ridge 13.95; three storeys of paired pointed lancets over sill strings; four gabled dormers with white fronts of two pointed lights and slate gables; a stack of two round flues', 'K', 'Montgomery 2008 looking east (08/00203 views p.2); bird\'s-eye map (J Bays 2009); LIDAR (roof 73 - 76 behind the face, ridge 78.0 - 78.4)'],
  ['the strip\'s storey heights, window and dormer sizes; the courtyard faces\' five storeys of 2.70 (kept for the 1983 pile; four on the strip\'s east face)', 'G', 'scaled by eye from the photograph; 18/00694'],
  ['staircase 9\'s door in the north part of the west face, pointed, with a W1 lantern', 'K', 'DIMENSIONS (door facing west, north part); 16/00769; place G'],
  ['internal courtyard at 64.40 between the block, the Lodgings\' north faces and the boundary; the 2018 glazed extension at its east end (3.5 x 6.1, 3.3 high)', 'K', '18/00694; LIDAR; rector plan; height G'],
  ['staircase 9\'s door on a landing at 64.16 along the block\'s quad face (v -51.4 .. -47.2) behind a low wall; the basement steps adjacent 9 down southwards from it to v -42.3, a black flat-bar handrail on the face turning down at the head, the oak sign with gilt letters', 'K', 'topographic survey 2021 (landing 64.16, the flight, the wall); 10 Saskatchewan and Quarrell Rooms sign (P Huxley 2011)'],
  ['the landing\'s two steps along its west side, the flight\'s 14 risers to 61.5, the door at its foot; the courtyard\'s first-pass basement steps removed', 'G', 'survey (the double line); depth guessed'],
  ['Bath stone ashlar, the street fronts and the quad', 'K', 'LE 1369640; photographs'],
];
