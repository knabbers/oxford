// Exeter College, STANDALONE model, part 'library' (survey B07): THE PLAN of the Library (George Gilbert Scott, 1856-7),
// its stair turret, the annexe running north along the Bodleian's Convocation House and the 2021-3 link block, as they
// stand after the 2021-3 refurbishment. Pure data: every dimension a named constant with its source; the build functions
// are in _exeter_library_build.js. Research: docs/research/exeter_survey.md B07, sections 1, 2, 11, 12;
// reference/exeter/20 planning drawings/DIMENSIONS.md (Library).
//
// THE LIBRARY'S OWN FRAME. Everything below is authored in (a, y, c): a runs EAST along the library's long axis from the
// outer face of the WEST gable, c runs SOUTH from the outer face of the NORTH wall (so the south face is at c = W), y is
// above the datum (64.40 m) as everywhere in the model. The build pushes ONE matrix: K.frame(ORIGIN[0], 0, ORIGIN[1],
// cos TH, sin TH): a -> (cos TH, sin TH) in LOCAL (u, v), c -> (-sin TH, cos TH).
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * PLANNING 21/00354/FUL, the Donald Insall Associates measured survey 2021 (EXCO.01/1000 ground plan, /1200 south,
//     /1201 north, /1202 west elevations, 1:100 @ A3), rendered at 220 dpi (86.8 - 87.2 px a metre by their own 5 m bars)
//     and read by pixel runs: main library 19.35 x 7.98 over walls, side walls 0.74; buttresses 0.83 wide projecting 0.72
//     at a 0.44 (clasping corners), 5.17, 9.66, 14.13, 18.89 (pitch 4.49); arcade colonnettes at 1.27 + k 1.124; every
//     opening's centre, width, sill, springing and apex; the stair turret's chamfered plan; the annexe 20.7 x 5.0 (west wall
//     0.6, east 0.4) from a 16.62 to 21.6; the Convocation House's face 3.94 m east of the library's east gable (south
//     elevation). Heights from ground-floor FFL 64.34 (figured) by the elevations' own level lines (first floor 4.22).
//   * The ANGLE and the PLACE on the LOCAL frame: LIDAR 2022 (scratch fits on reference/exeter/00 maps and lidar/
//     exeter_dsm.npy): the RIDGE line (the centroid of the highest returns, u 32 .. 49.5) runs v = 1.86 + 0.0492 u, i.e. 2.8
//     deg off the Front Quad's frame, east end further south; the 2021 topographic survey (AIA p.20, 400 dpi) draws the
//     library's south face at 14.0 deg to the OS grid against the frame's 16.9 (3 deg) and the survey's section 1 says 3.6:
//     TH = 3.0 deg. The eaves-edge fits alone are flat (0 deg +- 1): the creeper and the dormers blur them. The WEST gable:
//     the along-axis profile of the ridge band crosses half height at u 31.45, the topo puts the west face 4.45 m east of
//     the east range's garden face (u 26.8): u 31.3 at the ridge line; the EAST gable then falls at u 50.6 (LIDAR ridge
//     band falls off at 50.0 - 51.2) and the Convocation House's face at 54.5 (LIDAR 54.0 - 54.5 at v 4.5).
//   * Ridge: drawing 12.94 - 13.28 above FFL, LIDAR 77.2 - 77.35 m: 12.9 above the datum. The south elevation's "Ridge
//     Level" line (13.8 above FFL, which DIMENSIONS.md took for the ridge) is the top of the gable copings.
//   * The present state (2021-3 works, DAS part 2 pp.31-38, Nex): the link's new ashlar front with a square doorway with a
//     rounded reveal at its WEST end, a small stone bench and paving before it; clerestory glazing along the annexe's ridge.
//   * REGISTRATION 2026-11-23 (second pass): the 1:500 TOPOGRAPHIC SURVEY (drg 210239-P-10, the 400 dpi render) registered
//     to the LOCAL frame on 18 walls (rms 0.21 m; exeter_grounds.js header), lines fitted here to each wall stroke between
//     the buttresses: north face (three bays) and south face (four bays) both 0.59 m north of the model (+-0.02), the
//     west gable 0.20 west, the east gable 0.17 west; the angle 3.06 - 3.1 deg (3.0 kept); the length 19.29 against the
//     measured 19.35 (kept: the 1:100 survey). Moved RIGIDLY by (-0.154, -0.598): NW corner (31.51, -0.585) -> (31.34,
//     -1.18) (the brief's (31.07, -1.18) is the clasping buttresses' outer face). After the move: north / south faces
//     res 0.00 +- 0.03, west -0.06, east -0.04, the annexe's west face 0.00 (survey 48.51), its north end -0.03 (-20.89),
//     the Convocation House's face beyond the link -0.05 (54.23), the annexe 0.66 m off it (survey 54.16 - 53.50). LIDAR's
//     ridge line (v 1.86 + 0.0492 u) sat on the old place: it now runs 0.6 m south of the built ridge (1 m cells, the
//     dormers and the creeper blur the eaves): the planning drawing wins in plan.
//     The WALL WITH A GATE between the east range and the library is NOT at v 2.3: the survey draws it at v 4.07 - 4.12
//     (u 26.88 .. 31.06) with a pair of gate leaves meeting at u 28.4 .. 29.6; it closes the Rector's Garden side off just
//     north of staircase 5's garden door (4.3 .. 5.3).
import { Y } from './_exeter_shared.js';

export const DATUM = 64.40;

// ------------------------------------------------------------------------------------------------ frame
export const TH = (3.0 * Math.PI) / 180;      // K: LIDAR ridge 2.8 deg, topo 3.0, survey 3.6 (see above)
export const ORIGIN = [31.34, -1.18];         // LOCAL (u, v) of the outer NW corner (west face x north face). K: topographic
                                              // survey registered (was 31.51, -0.585: LIDAR's ridge and an unregistered topo)
export const L = 19.35;                       // west face to east face. K: survey 1000 (figured by scale; S elevation 19.37)
export const W = 7.98;                        // north face to south face. K: survey 1000 / 1202
export const WALL = 0.74;                     // side walls. K: survey 1000 (west gable 0.90)
/** library (a, c) -> LOCAL [u, v] */
export const toL = (a, c) => [ORIGIN[0] + a * Math.cos(TH) - c * Math.sin(TH), ORIGIN[1] + a * Math.sin(TH) + c * Math.cos(TH)];

// ------------------------------------------------------------------------------------------------ levels (y above the datum)
export const FFL = Y(64.34);                  // ground floor. K: survey, figured 64.34
export const H = (h) => FFL + h;              // a height above FFL (as the elevations are drawn) -> y
export const FIRST = H(4.22);                 // first floor / the string. K: figured 68.55 (4.21 - 4.22)
export const GARDEN = Y(64.29);               // the gravel by the south front. K: topo 64.26 - 64.32
export const NORTH_PATH = Y(64.43);           // the raised path along the north face. K: topo PSL 64.43 - 64.44
export const RECTOR = Y(63.80);               // Rector's Garden lawn. K: topo 63.77 - 63.87
export const ANNEXE_FLOOR = Y(63.58);         // K: Nex "Level LG" -0.76 below G
export const FOOT = -1.0;                     // every wall goes down to here (the grounds' earth sheet lies at -0.85 / -0.40)

// ------------------------------------------------------------------------------------------------ main library heights
export const PLINTH = H(0.32);                // base course top. G: drawn as a plain base line
export const STRING1 = { top: H(4.30), h: 0.22, proj: 0.16 };   // the first-floor string. K: elevations 4.15 - 4.3
export const ARC = {                          // the upper blind arcade (south 15 arches, north 11)
  pitch: 1.124, s0: 1.27,                     // K: colonnettes measured (S elevation 97.6 px at 86.8 px/m)
  ledge: H(4.43), cap: H(6.51), spring: H(6.62), boss: H(6.95), apex: H(7.60),   // K: S elevation scaled
  r: 0.075, proj: 0.16, recess: 0.16,         // the arches' fields set back (photographs 08: deep shadows). G depth                       // colonnette radius, standing proud of the wall. G (drawn 0.15 wide)
  nS: 15, nN: 11,                             // K: S elevation 15 arches on 16 shafts; N elevation 11 (west of the turret)
  lancet: { w: 0.52, sill: H(5.0), spring: H(6.6), apex: H(7.03) },   // WF2 - 4, WF8 - 11. K: elevations
  lancetArches: [1, 5, 9, 13],                // 0-based: the 2nd, 6th, 10th, 14th arch (under the dormers). K
};
export const CORNICE = { string: H(8.06), band: H(8.40), top: H(8.70), proj: 0.28 };   // K: S / W elevations
export const EAVES = H(8.70);                 // the slates' foot. K: elevations; LIDAR edges 9.3 N / 10.3 S read the dormers
export const RIDGE = 12.90;                   // K: LIDAR 77.2 - 77.35, drawing 12.94 - 13.28 above FFL
export const ROOF_OV = 0.22;                  // eaves overhang. G
export const GABLE = { kneel: H(8.85), apex: H(13.70), coping: 0.32, copW: 0.55, pier: 0.78, pierTop: H(12.37), pierCap: 0.55 };   // K: W elevation (kneelers 8.85, pier stumps 12.37, apex 13.7)

// buttresses (ground storey only; they stop under the first-floor string). K: survey 1000 + S / N elevations
export const BUT = { w: 0.83, proj: 0.72, stages: [[H(1.6), 0.72], [H(3.2), 0.55], [H(4.2), 0.36]] };   // stages: G (drawn weatherings)
export const BUT_S = [0.44, 5.17, 9.66, 14.13, 18.89];
export const BUT_N = [0.44, 5.17, 9.66];      // (14.13 is in the turret, 18.89 inside the annexe)
export const BUT_W = [0.42, W - 0.42];        // the clasping corner buttresses on the west face, projecting 0.54. K: plan
export const BUT_W_PROJ = 0.54;

// openings (centres s along the face from its own west end, or from the north end on the west face). K: survey
export const BAYS = [2.96, 7.45, 11.95, 16.44]; // lancets, dormers and ground windows line up. K
export const WG = { w: 1.52, sill: H(1.04), spring: H(2.95), apex: H(3.80), transom: H(2.19), d: 0.32 };   // WG2-4, WG11-13 two-light. K
export const DG1 = { s: 3.11, w: 1.27, spring: H(2.20), apex: H(3.57), hoodW: 2.2, hoodApex: H(3.74), d: 0.45 };   // K: S elevation
export const WG1 = { s: W / 2, w: 2.17, sill: H(0.97), spring: H(2.75), apex: H(3.73), lights: 3, transom: H(2.10), d: 0.35 };   // K: W elevation (3 heads drawn)
export const WF1 = { s: W / 2, w: 1.94, sill: H(4.84), spring: H(7.9), apex: H(9.86), transom: H(6.80), d: 0.4 };    // K: W elevation
export const WS1 = { y: H(11.68), r: 0.46 };   // the gable oculus (west; WS5 east the same). K: W elevation; east G
export const WF7 = WF1;                        // the east gable's first-floor window: K that it exists (DIMENSIONS); G its size (= WF1)
export const PIPES_S = [1.07, 5.74, 10.23, 14.72, 18.30];   // RW1 - 5. K: S elevation
export const PIPES_N = [1.10, 5.74];           // RW7, RW8 (G: positions by eye from the N elevation)

// dormers: stone gables rising off the cornice, each with a circular window of four foiled circles. K: elevations + photos
export const DORMER = { w: 3.40, shoulder: H(9.60), apex: H(12.40), win: { w: 1.98, sill: H(8.75), spring: H(9.60), apex: H(10.80), cy: H(9.62), r: 0.92 } };
export const DORMERS_S = BAYS;                 // 4. K
export const DORMERS_N = BAYS.slice(0, 3);     // 3. K (the turret stands in the fourth bay)

// ------------------------------------------------------------------------------------------------ stair turret (ST1)
// plan (a, c) from survey 1000: a chamfered square in the NE re-entrant angle. K
export const TURRET = {
  ring: [[14.05, 0], [13.70, -0.34], [13.70, -1.83], [14.66, -2.81], [16.26, -2.81], [16.62, -2.45], [16.62, 0]],
  c: [15.16, -1.40], top: H(8.30), cornice: 0.18,   // shaft cornice. K: W / N elevations 8.2 - 8.36
  spireR: 1.45, spireBase: H(8.55), tip: H(13.0),   // K: apex 12.97 - 13.1; G: octagonal (drawn as a broach-like pyramid)
  lucarne: { w: 0.7, h: 0.9 },                       // WS10 - 12 gablets at the spire's foot. K presence; G size
  WF5: { y0: H(5.76), y1: H(7.6), w: 0.36 },         // north face lancet. K: N elevation
  WG5: { y0: H(1.9), y1: H(2.6), w: 0.25 },          // K: N elevation
};

// ------------------------------------------------------------------------------------------------ annexe (B1, B2)
export const ANX = {
  a0: 16.62, a1: 21.6, c1: -20.7,              // west face, east face, north face. K: survey 1000 + E elevation (20.7)
  cornice: H(4.26), parapet: H(5.55),          // K: 22/01763 section BB (1:20, scaled +-0.05: the west parapet's coping 5.55
                                               // above GF; the 1:100 W elevation's 5.18 was its line below the coping)
  roofFoot: H(4.5), ridge: H(4.9),             // K: 22/01763 section BB: a LOW-PITCHED roof, eaves 4.5, ridge 4.9 above GF
  rooflights: { w: 1.5, l: 1.9, top: H(5.85) },   // FOUR rectangular rooflights in a row along the middle (22/01763 roof plan,
                                               // about 1.5 x 1.9 m, K), centred on the four window bays (G), rising about 0.3
                                               // above the parapet line (DIMENSIONS, the 1957 lanterns: K +-0.2)
  but: [-6.92, -11.39, -15.88], butW: 0.75, butProj: 0.78, butTop: H(5.55),   // K: plan + W elevation (to the parapet's coping: 22/01763 BB)
  win: [-4.69, -9.13, -13.63, -18.1], winW: 2.14, sill: H(0.80), spring: H(2.65), apex: H(3.57),   // WG6 - 9 three-light. K
  gable: H(5.88),                              // north gable apex. K: N elevation
  pin: { top: H(5.25), spire: 0.75, w: 0.8 },  // pinnacled corner buttresses at the north end. K presence; G sizes
  north: { w: 2.72, sill: H(-0.5), spring: H(2.6), apex: H(3.87), door: { w: 1.0, h: 2.15 } },   // WG10 + DG6. K: N elevation
};

// ------------------------------------------------------------------------------------------------ link block (2021-3)
export const LINK = {
  a0: L, a1: L + 3.94,                         // to the Convocation House's face. K: S elevation 3.94
  front: W - 0.30,                             // the new front, set back. G (DAS render)
  top: H(4.30), stepA: L + 2.45, stepTop: H(3.90),   // the stepped ashlar front. G (render: top at the first-floor string)
  roof: H(3.75), northTop: H(5.30),            // K: DIMENSIONS (lower roof 3.45, wall by the annexe 5.3); G flat
  door: { a: L + 0.85, w: 1.30, h: 2.75, d: 0.45 },   // K: at the west end (DAS); G sizes from the render
  bench: { a: L + 3.1, len: 1.3, h: 0.45, d: 0.45 },  // G: render
};

// ------------------------------------------------------------------------------------------------ surroundings built here
// climbers on the south front east of DG1 (photographs 08 2010 / c2017 dense to the first-floor string; DAS 2021 render
// shows wisteria trimmed round the windows). G: extent, height, kept off the windows
// Drawn as leaf cards (_exeter_plants.js climber, set 'wisteria'): leaf radius, how far the mass stands proud (deep: the
// photographs show a mass half a metre thick in places), leaves per cell at its edge / inside, bare cells inside, lod, and
// the windows' margins (negative: the mass hangs over the windows' edges, as in 08 c2017, the middle of each light clear). G figures.
export const CREEPER = { s0: DG1.s + 1.35, s1: L - 0.05, top: [3.0, 4.25], leaf: [0.07, 0.13], proud: [0.04, 0.4], perCell: [3, 5], gaps: 0.03, lod: 1, margin: [-0.22, -0.2, 0.05], overhang: 0.12 };
export const PAVE_S = { c1: W + 1.2 };         // stone paving before DG1 and the link door. G width
export const NORTH_PATH_W = 1.5;               // the raised path / planter edge along the north face. K: topo (PSL 64.43 - 64.69); G width
// the wall between the east range and the library's west end (topo line with a gate mark). K that it exists; G height, gate
// Registration 2026-11-23: from the east range's garden face (part east, LOCAL (26.85, 3.92)) to the library's west face at
// c 5.14 (v 3.92), 0.3 thick, the gate 1.2 m wide from 1.5 m along (survey leaves u 28.4 .. 29.6). The survey's line is at
// 4.07 - 4.12: the wall's centre is kept 0.17 north of it so its south face (4.07) clears staircase 5's garden door (its
// north jamb at 4.09 LOCAL). K: survey (res -0.17); G: height, thickness, the gate's form
export const GARDEN_WALL = { from: [26.85, 3.92], toC: 5.14, h: Y(66.6), t: 0.3, gate: { at: 0.355, w: 1.2, h: 2.05 } };

export const CHECKED = [
  ['main library 19.35 x 7.98 m over walls, side walls 0.74', 'K', 'survey EXCO.01/1000 (scaled, own 5 m bar); DIMENSIONS.md'],
  ['skew 3.0 deg to the Front Quad frame, east end south', 'K', 'LIDAR ridge fit 2.8; topo AIA p.20 3.0; survey s.1 3.6 (eaves fits read 0 +- 1: blurred)'],
  ['moved rigidly (-0.15, -0.60): NW corner (31.34, -1.18) (was 31.51, -0.585); with it the annexe, link, turret, doors, paving, the north path', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m; own fits: N / S faces 0.59 north (+-0.02), W -0.20, E -0.17 before; after: res 0.00 +- 0.03 (N, S), -0.06 (W), -0.04 (E), annexe W 0.00, annexe N -0.03, Convocation House face -0.05'],
  ['the ridge now 0.6 m north of LIDAR\'s ridge-band line (v 1.86 + 0.0492 u)', 'K', 'the survey outranks LIDAR in plan (LIDAR 1 m; eaves blurred by dormers and creeper)'],
  ['ground floor FFL 64.34, first floor 68.55', 'K', 'survey figured; Nex sections'],
  ['ridge +12.9 (77.3 m)', 'K', 'LIDAR 77.2 - 77.35; S elevation ridge lines 12.94 - 13.28 above FFL'],
  ['eaves cornice 8.7 above FFL, strings 8.06 / 4.22 - 4.3', 'K', 'S / W elevations scaled'],
  ['gables: kneelers 8.85, coping apex 13.7, corner piers 0.78 to 12.37', 'K', 'W elevation EXCO.01/1202'],
  ['buttresses 0.83 x 0.72 at a 0.44 / 5.17 / 9.66 / 14.13 / 18.89, ground storey only', 'K', 'survey 1000; S / N elevations'],
  ['buttress weatherings (three stages)', 'G', 'drawn bands; levels by eye'],
  ['south arcade 15 trefoiled pointed arches on 16 colonnettes, pitch 1.124; north 11', 'K', 'S / N elevations (survey B07 said 14: the drawing stands)'],
  ['lancets in the 2nd, 6th, 10th, 14th arches (WF8-11; WF2-4 north)', 'K', 'S / N elevations; photograph 08 N Smith 2010'],
  ['4 south / 3 north stone dormer gables, apex 12.4, circular windows of four foiled circles', 'K', 'elevations; photographs 08'],
  ['dormer gable width 3.4, shoulders 9.6', 'K', 'S elevation scaled'],
  ['purple-grey Welsh slate', 'K', 'survey section 5; photographs 08 (tint G)'],
  ['DG1 pointed doorway with shafted jambs and hood at the west end of the south front', 'K', 'S elevation; photographs 08'],
  ['two-light windows WG11-13 (S), WG2-4 (N): 1.52 wide, sill 1.04, apex 3.8, transom', 'K', 'S / N elevations'],
  ['west gable: 3-light WG1, tall 2-light WF1, oculus WS1', 'K', 'W elevation'],
  ['east gable WF7 / WS5 sizes', 'G', 'DIMENSIONS names them; sizes taken = west'],
  ['stair turret plan (chamfered), shaft to 8.3, spire tip 13.0, lancets WF5 / WG5, gablets', 'K', 'survey 1000; W / N elevations'],
  ['turret spire octagonal stone', 'G', 'drawn as a pyramid; octagon by DIMENSIONS ("conical/octagonal")'],
  ['annexe 20.7 x 5.0 from a 16.62, parapet 5.18 above FFL, four 3-light windows, buttresses at 4.48 pitch', 'K', 'survey 1000; W elevation'],
  ['annexe floor 63.58 (-0.82), Rector\'s Garden 63.8', 'K', 'Nex level LG; topo'],
  ['annexe north gable 5.88 with WG10 over DG6, pinnacled corner buttresses', 'K', 'N elevation'],
  ['annexe roof: low-pitched slate behind the west parapet, eaves 4.5 / ridge 4.9 above GF, the parapet\'s coping 5.55; four rectangular rooflights 1.5 x 1.9 in a row along it (was a glazed clerestory, G)', 'K', '22/01763/FUL section BB (1:20) and roof plan; DIMENSIONS.md second pass'],
  ['the rooflights centred on the window bays, 0.3 over the parapet', 'G', 'roof plan row (positions scaled +-0.2 not taken); DIMENSIONS (1957 lanterns)'],
  ['link block a 19.35 .. 23.29, new stepped ashlar front with the door at its west end, stone bench', 'K', 'S elevation 3.94; DAS p.31 render and key plan'],
  ['link front set back 0.3, heights 4.3 / 3.9, door 1.3 x 2.75', 'G', 'DAS render by eye'],
  ['lift (2021-3)', 'G', 'inside the link: no outside form drawn'],
  ['raised path 64.43 along the north face, 1.5 m', 'K', 'topo PSL 64.43 - 64.69 (width G)'],
  ['wall with a gate between the east range and the library west end on v 3.92 (was 2.3), the gate at u 28.35 .. 29.55', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m: the line at v 4.07 - 4.12 with two gate leaves; own res -0.17 (kept clear of staircase 5\'s garden door)'],
  ['the wall\'s height (66.6) and the gate\'s form', 'G', 'no photograph'],
  ['downpipes RW1-5 (S), RW7-8 (N) from the first-floor string', 'K', 'elevations (N positions G)'],
  ['blind arcade fields recessed 0.16', 'G', 'photographs 08 (deep shadow); depth guessed'],
  ['climbers over the south ground floor east of the door, windows kept clear', 'G', 'photographs 08 2010 / c2017; DAS 2021 render (wisteria)'],
  ['the wisteria drawn as a deep ragged mass of small leaves (to 0.4 m proud) between and over the buttresses, a ragged top under the first-floor string', 'K', '08 exeter.ox.ac.uk c2017 (the mass to the string, over the buttresses, the windows half clear); leaf size and depth G'],
  ['lantern hung in the head of DG1', 'K', 'photograph 08 exeter.ox.ac.uk c2017 (form G)'],
  ['gable corner piers with pyramidal caps', 'G', 'W elevation stumps to 12.37; cap from photograph 08 c2017 by eye'],
  ['lantern over the link door', 'K', 'DAS p.31 ("a bronzed metal light fitting sits above the door"); form G'],
];
