// Somerville College, STANDALONE model, part 'hughes' (survey B12): THE PLAN of the Catherine Hughes Building (2017-19,
// Niall McLaughlin Architects with Oxford Architects), Bedford House (1875, the former Bedford House school), Barbara
// Craig House (2016, 28 Little Clarendon Street), the Penrose service gate on Walton Street, the court between Penrose
// and the CHB, Bedford House's forecourt and the yard south of the CHB. Pure data: every figure a named constant with
// its source; the build functions are in _somerville_hughes_build.js. Brief: docs/handoff/somerville/briefs/hughes.txt.
//
// THE CHB'S OWN FRAME (S.ownFrame from ORIGIN along ANG): s runs EAST along the north face of the west block from its
// north-west corner at the street (s 0), t runs SOUTH (to the right walking east): t 0 is that north face. It is the
// frame of the architects' ground floor plan, so plan figures read straight off it; it is parallel to Penrose's frame
// (both 2.0 deg: the plan draws them square to each other). Penrose's plan (x_p, y_p) maps to s = x_p + 7.54,
// t = y_p - 16.58 (fitted below).
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * The architects' GROUND FLOOR PLAN (NMLA 1508-PL-200, 1:100 @ A1, 23.11.2016, planning 16/03062/FUL, reference/
//     somerville/20 planning drawings/16_03062_FUL .../12 ground floor plan.pdf) rendered at 150 dpi (59.06 px a metre)
//     and read by pixel runs: every outer wall line, window and door below, Bedford House's walls, the gate, the
//     courtyard's trees. Its scale is checked on Penrose drawn on the same sheet: 38.3 m against Penrose's own surveyed
//     38.18 m (_somerville_penrose_plan.js); Penrose's stair block 7.11 m wide here, 6.90 there; the step from Penrose's
//     range to its stair block 3.55 here, 3.54 there.
//   * PLACE: the plan is laid on Penrose as part 'penrose' placed it (its stair block's south face and west face, its
//     east wing's east face), then moved 0.35 m north and 0.30 m west towards the LIDAR (the LIDAR's roof edges of the
//     west block and the high block read 0.6 - 0.7 m north of Penrose-plus-plan; Penrose itself is fitted +-0.4): so a
//     compromise inside both tolerances that keeps the pinch points between the two buildings open.
//   * HEIGHTS: LIDAR 2022 (tools/somerville_lidar.py fbox in this frame): the west block's roof +10.6 .. +11.0, the five
//     storey block +13.4 .. +13.9, the four storey east end +10.7 .. +11.0; the yard -0.6, the court -0.85, Walton Street
//     -1.45 .. -1.5. The architects' elevations (16/03062 05 west, 08 north, 1:100 @ A1; 60 dpi renders) agree: west block
//     12.2 m over the pavement, the middle 15.0 m; storeys at 2.75 m.
//   * AS BUILT: where the 2016 drawings and the 2022 LIDAR differ, the LIDAR wins (the scheme was varied in 2018,
//     18/00183/VAR): the five storey block runs east to s 42.6 (the 2016 north elevation stops it at 40), and its south
//     face to s 38.0 before stepping back (the 2016 plan steps at 35.7).
//   * Photographs (folder 13, SOURCES.txt there): NMLA 2019 (the street end straight on; from the south with Bedford
//     House; the court path; the courtyard), the college c2019 (the street front from the north) and c2022 (Bedford
//     House's gable), Jaggery 2013 (Bedford House before), Street View Mar 2026 (from the Co-op); satellite (folder 14).
import { Y } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ frame
export const ANG = (2.0 * Math.PI) / 180;      // K: map w131312897 2.0 deg; the plan draws the CHB square to Penrose (2.0)
export const ORIGIN = [-89.73, 50.04];         // LOCAL (u, v) of the plan's (0, 0), the north-west corner at the street. K: see PLACE

// ------------------------------------------------------------------------------------------------ the CHB, in plan
// Outer faces of the walls (the brick face; the corbelled reveals are cut into it). K: NMLA ground floor plan, except
// the as-built east end (LIDAR).
export const WB = { s1: 22.0, t1: 9.0, swS: -1.19 };   // the WEST BLOCK: north face t 0 from s 0 to 22.0, south face t 9.0;
                                                       //   its street face slants with Walton Street from (0, 0) to (-1.19, 9.0). K
export const HB = { s0: 13.72, s1: 42.6, t0: 6.55, t1: 17.47, notchS: 38.0, notchT: 14.34 };
                                                       // the FIVE STOREY block: s 13.72 .. 42.6, t 6.55 .. 17.47, its south-east
                                                       //   corner cut back to t 14.34 east of s 38.0. K: plan (west, north, south
                                                       //   faces); LIDAR (the east end 42.6, the step at 38.0: as built)
export const EB = { s0: 42.6, s1: 45.04, t0: 6.55, t1: 14.34 };   // the FOUR STOREY east end to the Fellows' Garden. K: plan (east face 45.04, south 14.34); LIDAR (+10.9)

// ------------------------------------------------------------------------------------------------ levels
export const FFL = Y(61.75);                   // -0.75 the ground floor. K: LIDAR court and yard 61.6 - 61.9 (level access in the photos); G: the figure
export const FOOT = -2.10;                     // every wall's foot: 0.6 below the lowest ground at the building (Walton Street -1.5). K: LIDAR DTM
export const FL = [FFL, 2.35, 5.15, 7.95, 10.75];       // floor levels, ground .. fourth. K: LIDAR roofs (10.8 / 13.6) and the NMLA elevations
                                                        //   (storeys 2.75 - 2.8 m, the ground floor taller); G: the exact figures
export const STOREY = 2.80;                    // upper storeys floor to floor. K: elevations (65 px at 23.6 px/m)
export const ROOF_W = 10.80;                   // the west block's and the east end's parapet top. K: LIDAR 10.6 - 11.0; elevation 12.2 m over the street
export const ROOF_H = 13.60;                   // the five storey block's parapet top. K: LIDAR 13.4 - 13.9; elevation 15.0 m over the street
export const MEMBRANE = 0.20;                  // the roof finish lies this far under the parapet's top. G
export const PLINTH = 0.45;                    // a reconstituted-stone plinth course over the ground at the walls. K: photographs (pink stone base); G: height

// THE STREET FRONT'S SHOULDERS: the top storey of the two outer piers of the Walton Street end is cut back, the central
// glazed bay rising past them. K: NMLA 2019 straight-on photograph (shoulder face top 0.775, set-back top 0.885 of the
// central volume's height; widths 0.266 / 0.468 / 0.266 of the front); G: the set-back depth
export const SHOULDER = { w: 2.35, faceTop: 8.00, upTop: 10.00, back: 0.90, roofBack: 2.45 };
export const SLANT = -1.19 / 9.0;              // the street face's run in s per metre of t. K: plan

// ------------------------------------------------------------------------------------------------ the window bays
// "Deep-set bronze-framed windows in pairs between brick piers": each is a full-height SLOT in the brick, its jambs and
// head corbelled in three steps, the bronze-framed glass set deep, a bronze spandrel and a sloping bronze hood at each
// floor, a vertical bronze fin between the two lights. K: photographs (all four NMLA, college c2019); plan (the stepped
// jambs, the lights); G: the steps' size, the frame's bars
export const BAY = {
  step: 0.11, steps: 3,                        // corbel steps (each this wide and deep). K: plan (three teeth a jamb); G: figure
  glassD: 0.45,                                // the glass plane behind the face. K: plan (window frames 0.4 - 0.5 behind the face)
  light2: 2.60, light1: 1.20, street: 3.00,    // glazed width of a two-light / one-light bay, and of the street bay. K: plan (2.6 - 3.1); photograph (street 3.3)
  spandrel: 0.55,                              // bronze panel from the window head to the floor above. K: photographs (one third of the storey); G: figure
  hood: 0.10, hoodLip: 0.03,                   // the hood's drop from the glass to the face, its front lip. G: photographs (thin sloping shelves; touch-up 2: were 0.18 / 0.05, read heavy)
  fin: 0.04,                                   // the vertical fin between the lights. K: photographs; G: size (touch-up 2: was 0.07)
  frame: 0.045, bar: 0.035,                    // the frame round each light, the low transom bar. G: photographs (thin bronze frames; touch-up 2: were 0.055 / 0.05)
  sill: 0.10,                                  // glass foot over the floor. G
  corbelHead: 0.55,                            // the corbelled head over the top window. K: photographs (three or four courses stepping out)
};
// The bays face by face: c = centre along the face (s on north / south faces, t on east / west faces), n = lights,
// floors = [first, last] storey index (0 = ground), door: the ground floor light(s) is a door. K: plan (ground floor
// windows), NMLA north elevation (column positions), photographs; G where a face is seen in no source (marked).
export const BAYS = {
  north: [                                     // the west block's north face to the court (t 0). K: plan, north elevation, path photograph
    { c: 4.25, n: 2, floors: [0, 3] },
    { c: 10.70, n: 2, floors: [0, 3], door: 'left' },        // the main entrance (the plan's red triangle at s 9.6). K
    { c: 17.20, n: 2, floors: [0, 3] },
  ],
  northTop: [{ c: 19.35, n: 1, floors: [4, 4] }],           // the five storey block's top floor over the west block. K: north elevation
  north2: [                                    // the five storey block's north face to the courtyard (t 6.55). K: plan, north elevation
    { c: 25.05, n: 2, floors: [0, 4] },
    { c: 28.65, n: 1, floors: [0, 4] },
    { c: 32.25, n: 2, floors: [0, 4] },
    { c: 36.50, n: 1, floors: [0, 4], door: 'all' },         // the courtyard door (red triangle). K
  ],
  street: [{ c: 4.54, n: 2, floors: [0, 3], street: true }], // the Walton Street end, centred (t along the slanting face). K: photographs
  southW: [                                    // the west block's south face to Bedford House's forecourt (t 9.0). K: plan; NMLA 2019 from the south
    { c: 3.00, n: 2, floors: [0, 3] },
    { c: 9.40, n: 2, floors: [2, 3] },                       // over Bedford House's roof. G: c2022 photograph (a bay behind the gable)
  ],
  westH: [{ c: 12.60, n: 2, floors: [2, 4] }],              // the five storey block's west face over Bedford House. K: proposed west elevation
  south: [                                     // the five storey block's south face to the yard (t 17.47). K: plan
    { c: 17.95, n: 2, floors: [0, 4] },
    { c: 25.10, n: 2, floors: [0, 4] },
    { c: 31.80, n: 2, floors: [0, 4] },
  ],
  southE: [                                    // the cut-back south face of the east end (t 14.34). G: plan (2016: a door here); as built not seen
    { c: 39.30, n: 1, floors: [0, 4], door: 'all' },
    { c: 43.30, n: 1, floors: [1, 3] },
  ],
  east: [                                      // the east end to the Fellows' Garden (s 45.04), t measured from t 6.55. G: plan (two rooms' windows); not seen
    { c: 2.75, n: 1, floors: [0, 3] },
    { c: 5.75, n: 1, floors: [0, 3] },
  ],
  eastTop: [{ c: 3.90, n: 1, floors: [4, 4] }],             // the five storey block's east face over the east end. G
  eastW: [{ c: 2.05, n: 1, floors: [0, 3] }, { c: 4.20, n: 1, floors: [0, 3] }],   // the west block's east face to the courtyard, t from t 0. K: plan (two rooms' windows)
};
export const DOOR_H = 2.45;                    // door leaf height. G
export const BANDS = { h: 0.09, proj: 0.015 }; // "precast string bands at each floor". K: brief, photographs (light courses at each floor); G: size

// ------------------------------------------------------------------------------------------------ the roofs
// flat, behind a plain parapet with a thin metal coping; PV on the five storey block; rooflights over the two stairs; a
// guard rail set back on the west block. K: satellite (PV, stepped plan), north elevation ("rooflight to staircase" over
// s 19.9 and s 38.1), photograph (guard rail); G: the PV rows' layout and size
export const PV = [{ s0: 26.0, s1: 41.5, t0: 8.2, t1: 12.8, rows: 4 }];
export const ROOFLIGHTS = [{ s: 19.9, t: 8.8, w: 2.2, d: 2.6 }, { s: 38.3, t: 8.6, w: 2.0, d: 2.6 }];

// ------------------------------------------------------------------------------------------------ Bedford House
// A single tall storey of yellow (gault) brick with red-brick bands, its GABLE to Walton Street: a stone-coped gable with
// a quatrefoil oculus in a red-brick ring, four tall round-arched windows under red-brick arches, a round-arched door at
// the south end with an inscribed tablet over it, a slate roof; the CHB stands against its north side and its back.
// K: plan (walls), Sylva topo (eaves 65.40, ridge 68.85, floor 61.64), photographs (Jaggery 2013 square on, 45.5 px a
// metre on its 6.85 m front; college c2022); G: the bands' and copings' sizes
export const BED = { s0: 5.08, s1: 13.72, t0: 9.18, t1: 16.03 };   // K: plan (existing walls drawn grey)
export const BED_FL = Y(61.64);                // -0.86. K: Sylva "FL 61.64 Bedford House door"
export const BED_EAVES = Y(65.40);             // +2.90. K: Sylva
export const BED_RIDGE = Y(68.85);             // +6.35. K: Sylva
// openings on the gable, x from its north end (photograph 2013): K positions and counts; G heights (scaled, +-0.1)
export const BED_WIN = { at: [1.16, 2.04, 3.12, 4.00], w: 0.62, sill: 0.69, spring: 2.75 };
export const BED_DOOR = { at: 5.85, w: 0.97, spring: 0.76 };
export const BED_OCULUS = { y: 4.30, r: 0.40, ring: 0.20 };
export const BED_TABLET = { x0: 5.42, x1: 6.22, y0: 1.55, y1: 2.05 };
export const BED_PLINTH = 1.15;                // red brick base to this far over the floor. K: Jaggery 2013 (a red base 1.2 m over the forecourt); G: figure
export const BED_BAND = { y: 2.75, h: 0.16 };  // the red band at the arches' springing. K: photographs

// the forecourt: a low buff brick wall with a brick coping and black railings on the street line, a gate at its south
// end, paving, a planter with a small tree, a bench. K: NMLA 2019 (wall, railings, bench), plan (the planter, s -0.17 ..
// 2.45, t 10.6 .. 14.2), NMLA site plan (a tree); G: sizes
export const FORE = { wallH: 0.55, railH: 1.55, gate: [14.60, 15.70], planter: { s0: 0.10, s1: 2.45, t0: 10.6, t1: 14.2, h: 0.45 }, t1: 16.03 };

// ------------------------------------------------------------------------------------------------ the service gate
// Two iron leaves of vertical bars between Wolfson's pier (part 'wolfson', on its WALL_LINE at v 45.4 - 46.0) and the
// CHB's north-west corner, standing open (swung in). K: plan ("New Gateway", leaves swinging in), NMLA 2019 and Street
// View (black bars, about 2.4 m); G: the bar spacing, the posts
export const GATE = { pierV: 46.0, h: 2.40, bar: 0.12 };
export const WALL_LINE_END = [[-88.02, 32.55], [-89.84, 51.11]];   // Wolfson's street wall line (its plan's WALL_LINE): the pier stands on it.
                                    // Touch-up 1: moved 1.1 m east on to SITE_RING and the LIDAR's wall cells (was the map's line,
                                    // not registered); the gate's two hinges now on one line square to the CHB (same s), the south
                                    // one on the CHB's north face opposite the pier's middle

// ------------------------------------------------------------------------------------------------ the court
// Penrose in this frame (its plan + this frame's fit): the range's south face t -5.02 (s 7.54 .. 23.09), its south bed to
// t -4.02 (part 'penrose'), the stair block s 23.09 .. 29.99 to t -1.48, the east wing's west face s 37.8 to t 5.16 and
// its small bay s 36.24 .. 37.8, t 1.52 .. 4.32. K: _somerville_penrose_plan.js through the fit
export const PEN = { rangeT: -5.02, bedT: -4.02, s0: 7.54, spS0: 23.09, spS1: 29.99, spT: -1.48, ewS: 37.80, ewT: 5.16, bayS: 36.24, bayT0: 1.52, bayT1: 4.32 };
export const COURT_E = 46.0;                   // the court's paving stops here (the Fellows' Garden beyond: part 'chapel'). G
// the courtyard: buff block paving with a resin-bound gravel field, two young trees in iron grilles, long slatted timber
// benches, a lamp column. K: plan (trees at s 24.97 and 32.17, t 1.68), NMLA 2019 courtyard and path photographs
// (paving, benches, grille, lamp); G: the gravel field's edge, the benches' places
export const RESIN = { s0: 22.6, s1: 35.6, t0: 0.4, t1: 5.6 };
export const CTREES = [[24.97, 1.68, 6.5, 2.2], [32.17, 1.68, 6.0, 2.0]];      // s, t, height, crown radius. K: plan; LIDAR crowns +5 - 6; G: sizes
export const BENCHES = [{ s: 28.6, t: 3.6, len: 3.4, rot: 0 }, { s: 12.0, t: -3.55, len: 2.4, rot: 0 }, { s: 23.4, t: 3.2, len: 2.2, rot: 90 }];
export const LAMP = { s: 30.4, t: 4.6, h: 1.4 };
export const PATH_TREE = [20.0, -4.6, 8.0, 3.0];   // a tree at the bed's edge by the path. K: LIDAR crown +8.4 at (s 20, t -5); NMLA path photograph (foliage); G: species

// ------------------------------------------------------------------------------------------------ the yard (LOCAL)
// between the CHB and Barbara Craig House: paving, two trees, cycle hoops along the CHB, two parking bays; a brick wall
// on its west side (the Co-op's yard and the alley beyond), the walls of the shops' back yards on the south. K: plan
// ("New Yard": trees, cycle stands, parking), satellite (paved yard), LIDAR (-0.6, small trees +3.5 at u -62 .. -57);
// G: walls' heights, the gate
export const YARD_E = -43.75;                  // Vaughan's west face (part 'vaughan'). K: map w97853781
export const YTREES = [[-64.7, 74.3, 6.0, 2.2], [-59.2, 74.6, 6.5, 2.4]];      // K: plan (two trees); LIDAR; G: sizes
export const YWALL = { h: 2.10, west: [[-76.62, 68.10], [-76.45, 79.80]], gate: [78.20, 79.50] };
export const STORE = { u0: -50.6, u1: -44.2, v0: 74.3, v1: 80.0, roof: 3.10 };  // a single-storey brick store against the shops. K: LIDAR +2.5 .. +3.5 there; plan (existing structure); G: use, form
export const CYCLES = { s0: 22.8, s1: 32.0, t: 18.6, n: 9 };                   // K: plan (cycle stands along the south face); G: count

// ------------------------------------------------------------------------------------------------ Barbara Craig House
// Three storeys of brown-red brick over shops: on Little Clarendon Street an ARCADE of five brick piers / four bays with
// segmental brick arches and a deep brick spandrel band, the shop fronts set back about 2.5 m, the flats' timber door
// in the east bay; above, the piers run up to a plain parapet, and in each bay a wide three-light metal window flanked
// by narrow single lights over brick aprons, on two floors; a flat roof with a plant / stair box over its east part.
// K: Street View Mar 2026 square on (the lead's look, folder 13; about 86 px a metre at the arcade), map w131312905
// (outline), LIDAR (roof +11.4, box +13.5); G: the other faces, the exact heights
export const BCH = {
  ring: [[-61.91, 79.64], [-76.14, 79.95], [-77.79, 87.88], [-76.74, 96.20], [-61.88, 96.76]],   // K: map w131312905 (LIDAR edges agree to 0.5 m)
  roof: 11.40, membrane: 11.15,               // K: LIDAR 73.9
  box: { u0: -68.8, u1: -62.4, v0: 86.0, v1: 92.0, top: 13.50 },   // K: LIDAR 75.9 - 76.0
  ground: -0.55,                              // K: LIDAR pavement 61.95
  pier: 0.60, pierProj: 0.15,                 // K: Street View (five piers); G: sizes
  spring: 3.00, rise: 0.50, band: 4.35,       // arcade arch springing, rise, spandrel band top. K: Street View scaled; G: +-0.2
  deep: 2.50,                                 // the arcade's depth to the shop fronts. K: the lead's look
  floors: [4.35, 7.75],                       // the two upper floors. G: from the window rows
  win: { wide: 1.50, narrow: 0.45, pier: 0.24, pierProj: 0.06, sill: 0.30, h: 1.65 },   // per bay: K (three lights + two narrow, each narrow light parted from the wide window by a full-height brick pier: the look); G: sizes (touch-up 2: wide was 2.00 and left 3 cm of brick)
  door: 3,                                    // the flats' door in the east bay (bay index 0 .. 3 from the west). K
  pitch: 2.80, winW: 1.30, winH: 1.55,        // the windows on the faces not seen. G
};

// ------------------------------------------------------------------------------------------------ lamps
// K: photographs (a wall light by the path door, Bedford House's globe lamp, the courtyard's lamp column); G: the others
export const WALL_LAMPS = [{ face: 'north', s: 9.0, y: 2.90 }, { face: 'north2', s: 35.3, y: 2.90 }, { face: 'southE', s: 38.6, y: 2.90 }];

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['CHB plan: west block 22.0 x 9.0 with the slanting street face, five storey block s 13.72 .. 42.6 x t 6.55 .. 17.47, east end to s 45.04', 'K', 'NMLA ground floor plan 1508-PL-200 (16/03062/12) read at 59.06 px/m; scale checked on Penrose drawn on the same sheet'],
  ['CHB as built: five storey block to s 42.6, south-east step at s 38.0', 'K', 'LIDAR 2022 (the 2016 drawings stop the high part at 40 and step at 35.7; varied 2018, 18/00183/VAR)'],
  ['CHB place: the plan on Penrose\'s placement moved 0.35 m north, 0.30 m west (origin u -89.73, v 50.04, 2.0 deg)', 'K', 'LIDAR roof edges 0.6 - 0.7 m north of plan-on-Penrose; Penrose fit +-0.4; compromise'],
  ['CHB heights: west block and east end +10.8, middle +13.6 (five storeys)', 'K', 'LIDAR 73.1 - 73.5 / 76.0 - 76.3; NMLA elevations 12.2 / 15.0 m over Walton Street; NMLA long section'],
  ['CHB floor -0.75 and storey levels +2.35 / +5.15 / +7.95 / +10.75', 'G', 'LIDAR roofs and ground; elevations (storeys 2.75 - 2.8); not figured'],
  ['window bays: full-height slots with three-step corbelled brick jambs and heads, bronze frames set 0.45 deep, bronze spandrels, sloping hoods and a central fin', 'K', 'NMLA 2019 photographs (street, path, courtyard), college c2019; plan (stepped jambs)'],
  ['window bays: step size 0.11, spandrel 0.55, hood drop, fin and bar sizes', 'G', 'judged from the photographs'],
  ['window bays: positions and lights on the north faces, the street end, the south face', 'K', 'NMLA plan (ground floor windows) and north elevation; photographs'],
  ['window bays on the east end, the cut-back south face, over Bedford House on the west block\'s south face', 'G', 'plan (2016) only; not seen in any photograph'],
  ['street end: central glazed bay rising to the parapet, shoulders\' top storey cut back', 'K', 'NMLA 2019 straight on; NMLA 2019 from the south; LIDAR (corners lower)'],
  ['shoulders: set-back 0.9, top +10.0', 'G', 'proportions from the photograph'],
  ['doors: main entrance on the north face (s 9.6), courtyard door (s 36.5), south door (s 39.3)', 'K', 'NMLA plan (entrance triangles); G: the south door\'s place as built and all leaves'],
  ['precast string bands at each floor; reconstituted stone plinth', 'K', 'brief; photographs; G: sizes'],
  ['brick: new red stock (brickNew); bronze-coloured metal (a new tint "bronze" of lead, touch-up 2: lighter gold-bronze, thinner hoods, fins, frames)', 'K', 'photographs (NMLA 2019 from Walton Street south, straight on, courtyard); G: the tint and the thicknesses'],
  ['roofs flat behind plain parapets; PV on the five storey block; two staircase rooflights', 'K', 'satellite; north elevation labels'],
  ['PV rows, rooflight sizes', 'G', 'satellite (layout indicative)'],
  ['Bedford House: walls s 5.08 .. 13.72, t 9.18 .. 16.03 (gable 6.85 wide to the street, 4.6 m behind the pavement)', 'K', 'NMLA plan; LIDAR roof (u -86.5 .. -78); Jaggery 2013 (set back)'],
  ['Bedford House: floor 61.64, eaves 65.40, ridge 68.85', 'K', 'Sylva topo 2016 (16/03062 AIA p.14)'],
  ['Bedford House: yellow brick, red bands and base, red-brick arches, stone-coped gable, quatrefoil oculus, four round-arched windows, arched door, tablet, slate roof', 'K', 'Jaggery 2013, college c2022, NMLA 2019 photographs'],
  ['Bedford House: opening heights, band and coping sizes', 'G', 'scaled off the 2013 photograph (+-0.1)'],
  ['Bedford House forecourt: low buff brick wall, railings, gate at its south end, planter, bench', 'K', 'NMLA 2019; plan; G: sizes, the gate\'s place'],
  ['service gate: two iron leaves between Wolfson\'s pier and the CHB, open', 'K', 'NMLA plan ("New Gateway"); NMLA 2019, Street View 2026; G: bars, posts, height 2.4'],
  ['service gate square: Wolfson\'s pier on the registered street line (SITE_RING, LIDAR wall cells v 44 - 46), both hinges at one s', 'K', 'LIDAR line profiles across the wall; SITE_RING (touch-up 1; the hinge on the CHB\'s north face 0.55 in: G)'],
  ['court: buff block paving (ground key chbPaving, a buff tint of \'paving\', touch-up 2) from the gate to the Fellows\' Garden, a resin-bound field in the courtyard, two young trees in grilles, slatted timber benches, a lamp column', 'K', 'NMLA plan; NMLA 2019 courtyard and path photographs'],
  ['court: the gravel field\'s edge, the benches\' and the lamp\'s places, the trees\' sizes', 'G', 'photographs; LIDAR crowns'],
  ['a tree by the path at the edge of Penrose\'s south bed', 'G', 'LIDAR crown +8.4; NMLA path photograph'],
  ['yard: paving, two trees, cycle stands along the CHB', 'K', 'NMLA plan ("New Yard"); satellite; LIDAR'],
  ['yard: west wall 2.1 m with a gate to the alley; the single-storey store against the shops (+3.1)', 'G', 'LIDAR +2.5 .. +3.5 (the store); not seen'],
  ['Barbara Craig House: outline, flat roof +11.4, plant box +13.5', 'K', 'map w131312905; LIDAR'],
  ['Barbara Craig House street face: brown-red brick, five-pier arcade with segmental arches over shops set back 2.5 m, the flats\' door in the east bay, two floors of three-light windows with narrow side lights between full-height piers, plain parapet', 'K', 'Street View Mar 2026 square on (the lead\'s look, LOOKS_BY_HAND.md "Added later")'],
  ['Barbara Craig House: brick colour brown-red (tint bchBrick, touch-up 2: was orange-red); the narrow side lights parted from the wide windows by full-height brick piers 0.24 wide standing 0.06 proud', 'K', 'Street View Mar 2026 square on; G: the tint figures, the piers\' width and projection'],
  ['Barbara Craig House: heights of the arches, bands and windows', 'G', 'scaled off the Street View look (+-0.2)'],
  ['Barbara Craig House: the north, west and east faces and their windows', 'G', 'not seen'],
];
