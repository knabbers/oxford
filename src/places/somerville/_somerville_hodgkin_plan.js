// Somerville College, STANDALONE model, part 'hodgkin' (survey B10): THE PLAN of the south-east corner behind the
// Woodstock Road shops: the DOROTHY HODGKIN QUAD (DHQ) and the MARGARET THATCHER CENTRE (MTC) round their raised court,
// RADCLIFFE HOUSE (the Principal's house) with its glazed link, the LISA MINOPRIO GARDEN east of Maitland, the covered
// way from the Hall - Maitland loggia passage down Maitland's back, and the unnamed block w303766520 against the
// Oratory. Pure data: every figure a named constant with its source and K / G mark; the build functions are in
// _somerville_hodgkin_build.js. Brief: docs/handoff/somerville/briefs/hodgkin.txt.
//
// FRAME: LOCAL (u east, v south, y above the datum 62.50 m) unless a block says otherwise. Two blocks are turned and
// are authored in their own frames (S.ownFrame): the DHQ's east range (E_FRAME, 18 deg: it follows the Woodstock Road
// shops' backs) and Radcliffe House (R_FRAME, 5.7 deg).
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (tools/somerville_lidar.py lbox / lgbox / fbox / fsec, and scratch pictures of the surface at 0.25 m in
//     colour bands of 1 m): every roof edge, ridge and flat below, levels above the datum.
//   * THE COURT IS A RAISED DECK. The DSM reads a FLAT +4.4 over the whole court (u 85 - 97, v 48 - 62) and on a strip
//     east of a slot at its north-east corner, while the ground round the complex is +0.5 .. +1.1 (the DTM under the
//     court is only interpolated). The photograph (11 "MTC courtyard ... J Cairns 2021") shows a paved court with a
//     glazed lean-to rooflight in it and two-storey ranges whose eaves are about 5.2 above the paving: with eaves at
//     +9.6 (LIDAR) the paving is at +4.4. The college's 2016 site plan (planning 16/03062 "01 Somerville college
//     site.pdf", Oxford Architects 1:500) colours the court as "Function / Common rooms": the MTC's rooms are UNDER it.
//     So the survey's "+1.0 for the Quad" is the ground beside it, not the court (K: LIDAR + photo + plan).
//   * The 2016 site plan, warped onto LOCAL by hand (a similarity, good to about 2 m here): the non-college (hatched)
//     area takes in the block w303766520 and everything between the kitchens and the Oratory; a walled strip runs down
//     Maitland's back from the loggia passage to the garden; the garden has trees along its north side and winding
//     beds; a broad flight of steps rises to the MTC's west side; cycle parking "13c" in the slot at the court's
//     north-east corner.
//   * Satellite close look (14 "satellite close Hall Maitland Oratory Thatcher Centre Hodgkin"), turned onto LOCAL (good
//     to about 3 m; the roofs lean): grey slate roofs round the court, a glass roof over the link between Radcliffe
//     House and the MTC, Radcliffe House's orange-red tiles and a flat grey roof west of it, the unnamed block's grey
//     slate and orange tile hipped roofs, an oval lawn in the garden's north part.
//   * The one photograph (folder 11): buff reconstituted-stone blockwork, dark-framed windows set in dark slate-hung
//     panel bands, shallow slate roofs with deep eaves on exposed rafters, black downpipes, globe wall lamps; a single-
//     storey entrance pavilion with a slate hipped roof on buff piers, glazed screens and a timber door; square buff
//     flags; a raised square planter on two steps.
import { ownFrame } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ levels
export const DECK = 4.35;            // the court's paving. K: LIDAR DSM +4.4 flat (the paving's top); photo (eaves 5.2 over it)
export const EAVES = 9.6;            // the DHQ / MTC ranges' eaves. K: LIDAR +9.5 .. +9.7 at the court's edges
export const ORATORY_YARD = 1.05;    // the Oratory's yard north of the complex and the slot's foot. K: LIDAR +1.0 .. +1.2
export const FOOT = 0.55;            // walls go this far below the lowest ground at their foot. K: house style

// ------------------------------------------------------------------------------------------------ the DHQ east range (along the shops' backs)
// own frame: s from (106.0, 40.0) SSW to (99.5, 60.0), t to its right (WEST, towards the court). K: the LIDAR ridge line
export const E_FRAME = [106.0, 40.0, 99.5, 60.0];
export const EF = ownFrame(...E_FRAME);
export const E = {
  tW: 3.3, tE: -2.8,                  // the court (west) wall and the back wall on the shops. K: fsec (west eaves t +3.5 .. +3.9 less a 0.6 eave; back: flat +9.5 of the shops from t -2.5)
  ridgeT: -0.8, ridge: 12.0,          // an ASYMMETRIC roof: a long slope to the court, a short steep one behind. K: fsec ridge 11.7 - 12.0 at t -1 .. -0.5
  eaveBack: 10.0,                     // the back slope's foot. G (LIDAR +9.8 .. 10.5 at t -1.5 .. -2)
  ov: 0.6,                            // the deep eaves. K: photo; G: figure
  n: { s0: -1.5, s1: 2.5, tW: 0.8, top: 10.3 },   // a narrower north end: flat-roofed. K: fbox (+10 .. 11.7 east of t 1, +4 .. 4.7 west of it at s -2 .. 2); G: flat roof
  e1: [2.5, 10.0], e2: [11.2, 31.0],  // two blocks either side of a slot down to the court. K: fbox (+4.0 .. 4.4 at s 10 - 11 from t -1 to +4)
  slotBack: -1.2,                     // the slot's back wall. K: fbox (+5.6 .. 7.5 at t -1)
  sCourtEnd: 22.4,                    // where the south range meets the court face (v 61.3). K
  bays1: [1.9, 5.6], bays2: [1.8, 5.2, 8.6],      // window bays on the court face, from each block's north end. K: photo (pairs of windows a bay, about 3.4 m apart); G: places
  pitch: 3.4,                         // the bays on the faces no picture shows. G
};

// ------------------------------------------------------------------------------------------------ the MTC's west ranges and south range (square to LOCAL)
export const W = { u0: 78.6, u1: 84.6, v0: 47.7, v1: 61.3, ridgeU: 81.6, rise: 1.5, roofTo: 58.0 };   // K: LIDAR (ridge 11.1 at u 80.5 - 81.5, v 47 - 55; eaves 9.6 .. 10); roofTo G
export const W2 = { u0: 75.7, u1: W.u0, v0: 55.6, v1: 61.3, rise: 1.6, roofTo: 65.45 };   // the wider south part. K: LIDAR (+9.6 from u 75.7 for v 56 - 61; ridge 11.2 at u 80)
export const SR = { u0: 75.7, u1: 95.0, v0: 61.3, v1: 69.6, rise: 1.5 };   // the south range. K: LIDAR (north eaves v 61, south 69 - 70, ridge 11.1 at v 65 - 66); its east end runs into the east range
export const RECESS = { u0: 92.3, u1: 95.0, v1: 63.2 };                 // a deck-level recess in the south range at the court's south-east corner. K: LIDAR (+4.0 .. 4.4 notch); G: a porch with a door
export const BAYS_W = [50.6, 53.8, 57.2, 60.2];      // court windows of the west ranges (LOCAL v). G (photo rhythm)
export const BAYS_S = [86.6, 89.9];                   // court windows of the south range (LOCAL u). G
// the pavilion on the court's north side: single storey on the deck, slate hipped roof on buff piers. K: photo; LIDAR (+7.7 .. 9.1, north eaves about +5 over the Oratory yard)
export const PAV = { u0: 84.6, u1: 94.6, v0: 43.3, vFront: 48.0, vPost: 49.1, eaves: 6.9, ridge: 9.0, ov: 0.35, posts: [88.0, 91.2, 94.2] };
export const PAV_DOOR = { u: 89.6, w: 1.1, h: 2.3 };  // the timber door between glazed screens. K: photo; G: place
// the slot at the court's north-east corner: open to the sky, down at the Oratory yard's level. K: LIDAR (+1.0 .. 1.6 at u 95 - 96.5, v 42 - 48); 2016 plan (cycle parking 13c there)
export const SLOT = { u0: 94.6, u1: 96.9, v0: 42.6, v1: 48.6 };
export const STAIR = { risers: 19, going: 0.275 };   // the open stair in it from the yard up to the deck. G: no picture; the only open way to the deck the sources allow
// the deck's own outline (LOCAL), built from the faces round it and the LIDAR's flat +4.4. K
export const DECK_RING = [[84.6, 48.0], [94.6, 48.0], [94.6, 48.6], [96.9, 48.6], [96.9, 42.6], [98.3, 42.6], [98.3, 38.6], [105.6, 38.6], [104.47, 42.13], [102.09, 41.36], [99.77, 48.49], [104.05, 49.88], [103.68, 51.02], [99.4, 49.63], [95.94, 61.3], [95.0, 61.3], [95.0, 63.2], [92.3, 63.2], [92.3, 61.3], [84.6, 61.3]];
export const ROOFLIGHT = { u0: W.u1, u1: 87.2, v0: 51.0, v1: 57.0, yHi: 5.25, yLo: 4.6 };   // the glazed lean-to in the court. K: photo (left foreground), 2016 plan (lines at the court's west side); G: size
export const PLANTER = { u: 93.0, v: 59.2, base: 2.4, step: 0.16, box: 0.95, h: 0.75 };      // K: photo (square planter on two steps, right foreground); G: place and sizes

// ------------------------------------------------------------------------------------------------ Radcliffe House (the Principal's house)
export const R_FRAME = [72.0, 42.65, 84.6, 43.9];     // its north wall. K: LIDAR north edge v 42.6 at u 73, 43.8 at u 85 (5.7 deg)
export const RF = ownFrame(...R_FRAME);
export const R2 = { s0: 0, s1: 12.66, t0: 0, t1: 4.05, eaves: 6.6, ridge: 7.95 };   // two storeys, orange clay tiles. K: LIDAR (+6.5 .. 8.0); satellite (orange-red tiles); college map ("red brick"); G: depth to the glazed link
export const R1 = { u0: 68.8, u1: 71.8, v0: 42.75, v1: 46.6, roof: 4.0 };   // the single-storey west end, flat roof. K: LIDAR +4.0 flat; satellite (grey flat roof); planning 99/00691 (a single-storey entrance extension, 1999)
export const LINKG = { u0: 74.0, u1: W.u0, v0: 47.6, v1: W2.v0, yLo: 4.3, yHi: 4.9 };   // the glass-roofed link / conservatory. K: LIDAR +4.4 .. 4.9; satellite (glass roof); 99/00691 ("conservatory")
export const FLOOR_R = 1.0;          // Radcliffe House's ground floor. G (ground +0.8 .. 1.0)

// ------------------------------------------------------------------------------------------------ the MTC's entrance from the garden
export const STEPS = { u0: 73.2, u1: 74.6, uLand: 75.7, v0: 55.8, v1: 61.0, top: 1.5 };   // a broad flight rising east to the MTC's glazed entrance. K: LIDAR (DSM +1.1 .. 1.6 at u 75), 2016 plan (a flight here); G: risers, the doors
export const APRON = [[71.3, 55.8], [73.2, 55.8], [73.2, 63.8], [71.3, 63.8]];

// ------------------------------------------------------------------------------------------------ the unnamed block w303766520 (NOT the college's: the Oratory's; the CITY draws it
// since the merge; U1 / U2 are kept as the LIDAR's reading of it: the covered way meets U1's west face)
// K: 2016 site plan (hatched "Non-College Areas"); LIDAR. Its walls: buff / yellow brick like the Oratory's (G); roofs from the satellite (K)
export const U1 = { ring: [[55.4, 28.6], [58.8, 28.6], [58.8, 39.3], [51.0, 39.3], [51.0, 38.4]], eaves: 11.6, apex: [55.6, 34.3], rise: 3.0 };   // the taller grey-slate block. K: LIDAR (+13 .. 14.7, west edge diagonal (55, 28.5) - (51, 38.5)); G: pyramid roof
export const U2 = { u0: 58.8, u1: 72.8, v0: 28.8, v1: 39.8, eaves: 9.0, ridge: 12.9 };   // the orange-tiled hipped block. K: LIDAR (eaves +8.5 .. 9.8 at v 30 / 39, ridge 12.2 - 13.1 at v 34 - 36)

// ------------------------------------------------------------------------------------------------ the covered way from the loggia passage
// The LIDAR has a flat +3.0 .. 3.3 east of the passage's mouth (u 53 - 57, v 21 - 28) and down Maitland's back (u 47 - 52,
// v 28 - 46) in no mapped outline; the 2016 plan draws a walled strip there. K: LIDAR, plan; G: its build (a lean-to over
// the yard by the passage, a flat roof down Maitland's back on the walls and on posts across Maitland's yard)
export const CW = { leanHi: 3.75, leanFall: 0.06, flat: 3.2, slab: 0.22, post: 0.16 };
export const BOUND_NE = [[57.05, 21.95], [59.17, 21.95], [55.86, 28.36]];   // the rubble boundary wall to the Oratory's ground (site line). K: map site ring; LIDAR (ground +1.6 beyond); G: rubble, its height
export const CW_SOUTH = [[51.0, 39.3], [50.6, 46.0]];                     // the covered way's own east wall south of the block. K: LIDAR (+3 to u 50.5, open ground east of 51); G
export const CW_END_V = 46.0;                                             // the covered way's open south end into the garden. K: LIDAR

// ------------------------------------------------------------------------------------------------ the Lisa Minoprio Garden (w687435721)
export const WALL_N = [[50.6, 46.0], [68.8, 42.75]];   // its north wall against the Oratory's ground. K: map garden edge; 2016 plan (hatch line); G: brick, 2.2 m
export const WALL_S = [[50.6, 67.95], [72.4, 68.8], [75.7, 69.05]];   // its south wall to the Little Clarendon Street backs (site ring less 0.3). K: map; G: brick, 2.2 m
export const WALL_H = 2.2;
export const LAWN_N = { u: 64.5, v: 51.0, ru: 5.8, rv: 2.8 };      // the oval lawn. K: satellite, LIDAR (open ground u 58 - 70, v 47 - 53); G: shape
export const LAWN_S = { u0: 52.6, u1: 66.0, v0: 57.3, v1: 61.6 };   // the lower lawn. K: LIDAR (open, the garden's lowest part -0.2); G
export const PATHS = {
  north: [[50.6, 46.65], [71.6, 46.65], [71.6, 47.1], [74.0, 47.25], [74.0, 48.05], [50.6, 48.05]],   // along the trees to Radcliffe House and the link. G (plan: a walk along the north)
  north0: [[46.4, 46.0], [50.6, 46.0], [50.6, 48.05], [46.4, 48.05]],                                    // from the covered way's mouth. G
  west: [[47.2, 48.05], [48.8, 48.05], [48.8, 60.4], [47.2, 60.4]],                                     // down Maitland's side. G
  east: [[72.0, 48.05], [74.0, 48.05], [74.0, 55.8], [72.0, 55.8]],                                     // along the glazed link to the steps. G
  south: [[47.8, 60.0], [49.4, 63.6], [70.4, 65.4], [72.3, 63.6]],                                      // map path w97853765 (its line), 1.8 wide. K: map; G: width
};
export const BEDS = {
  north: [[50.9, 45.95], [68.8, 42.75], [68.8, 46.65], [50.9, 46.65]],
  west: [[48.8, 48.05], [52.0, 48.05], [52.0, 59.6], [48.8, 59.6]],
  mid: [[52.0, 48.05], [72.0, 48.05], [72.0, 55.8], [71.3, 55.8], [71.3, 56.8], [52.0, 56.8]],
  southMid: [[52.0, 56.8], [66.5, 56.8], [66.5, 62.0], [52.0, 62.0]],
  southEast: [[66.5, 56.8], [71.3, 56.8], [71.3, 62.0], [66.5, 62.0]],
  south: [[52.0, 62.0], [71.3, 62.0], [71.3, 62.8], [52.0, 62.8]],
  wall: [[49.8, 64.75], [70.0, 66.5], [70.0, 68.4], [49.8, 67.6]],
};
// trees [u, v, height, crown radius]: LIDAR canopy peaks (DSM - DTM) in the garden. K: LIDAR; species G (the 2019 / 2022 tree
// surveys list crab apple, fig, medlar, cotoneaster, sorbus by Radcliffe House: DIMENSIONS.md)
export const TREES = [[50.0, 49.8, 6.2, 3.0], [55.0, 51.0, 6.2, 3.2], [49.8, 54.2, 6.0, 2.4], [53.6, 54.0, 6.0, 2.8], [70.6, 54.4, 5.4, 2.4], [60.3, 55.6, 3.8, 2.2], [70.0, 57.2, 5.7, 2.9], [65.6, 57.8, 4.0, 2.6], [58.5, 45.3, 3.8, 1.6]];
export const SHRUBS = [[57.0, 53.6], [62.0, 54.4], [67.6, 53.8], [53.2, 60.8], [68.6, 60.0], [56.0, 66.2], [63.0, 66.9], [60.5, 45.5], [65.0, 44.6]];   // G: the "dense planting" (satellite)

export const CHECKED = [
  ['the court is a paved DECK at +4.35 over the MTC\'s rooms, not ground at +1.0', 'K', 'LIDAR DSM flat +4.4; photo J Cairns 2021 (eaves 5.2 over the paving); 2016 site plan 16/03062 (court coloured "function rooms")'],
  ['DHQ east range along the shops\' backs, 18 deg off LOCAL v, court wall t +3.3, back wall t -2.8', 'K', 'LIDAR fsec (ridge line (106, 40) - (99.5, 60)); map w228186801'],
  ['east range roof asymmetric: ridge +12.0 near the back, long slate slope to the court from eaves +9.6', 'K', 'LIDAR fsec; photo (slate, deep eaves)'],
  ['east range back slope and back eaves +10.0', 'G', 'LIDAR blurred by the shops\' flat roofs at +9.5'],
  ['a slot through the east range down to the court at s 10 - 11', 'K', 'LIDAR (+4.0 .. 4.4); G: its back wall and glazing'],
  ['east range north end narrower and flat-roofed +10.3', 'G', 'LIDAR +10 .. 11.7 on its east half only'],
  ['MTC west ranges u 78.6 / 75.7 - 84.6, ridges +11.1 / +11.2, gable over Radcliffe House', 'K', 'LIDAR'],
  ['MTC south range v 61.3 - 69.6, ridge +11.1, hipped west end', 'K', 'LIDAR; hip G'],
  ['walls of buff reconstituted-stone blockwork, dark-framed windows in dark panel bands, slate roofs with deep eaves', 'K', 'photo J Cairns 2021'],
  ['window bays on the court faces about 3.4 m apart, two storeys over the deck', 'K', 'photo (east range); places G'],
  ['windows on the faces no picture shows (back, south, west under the deck)', 'G', 'the photo\'s pattern repeated'],
  ['entrance pavilion on the court\'s north side: single storey, slate hipped roof, buff piers, glazed screens, timber door', 'K', 'photo; LIDAR (+7.7 .. 9.1); sizes and pier places G'],
  ['pavilion north face down to the Oratory yard +1.05, blank', 'G', 'LIDAR (yard +1.0 .. 1.2); no picture'],
  ['glazed lean-to rooflight on the court\'s west side', 'K', 'photo (left foreground); 2016 plan; size G'],
  ['raised square planter on two steps', 'K', 'photo; place and size G'],
  ['slot at the court\'s north-east corner open to the sky at the yard\'s level, cycle parking', 'K', 'LIDAR (+1.0 .. 1.6); 2016 plan (13c)'],
  ['open stair in the slot from its foot up to the deck, railings on the deck\'s edges, a shut gate at its foot', 'G', 'no picture; the deck\'s real way up is probably inside the MTC'],
  ['the deck reached on foot only by that stair: NOT walkable from the garden (the MTC\'s doors are shut)', 'G', 'sources show no outside stair from the garden to the deck'],
  ['Radcliffe House: two storeys, red brick, orange clay-tile roof, eaves +6.6, ridge +7.95, 5.7 deg', 'K', 'LIDAR; satellite; college map 2021 ("red brick"); sash windows and depth G'],
  ['Radcliffe House\'s single-storey west end, flat roof +4.0, its door on the garden', 'K', 'LIDAR; satellite; planning 99/00691 (new entrance 1999); the door G'],
  ['glass-roofed link (the "conservatory") between Radcliffe House and the MTC, roof +4.3 .. 4.9', 'K', 'LIDAR; satellite (glass); 99/00691; framing G'],
  ['broad flight of steps rising east to the MTC\'s glazed entrance (+1.5)', 'K', 'LIDAR (DSM +1.1 .. 1.6 at u 75); 2016 plan (a flight here); risers, doors G'],
  ['unnamed block w303766520 is the Oratory\'s, not the college\'s: since the merge the city draws it from the map (not built here)', 'K', '2016 site plan 16/03062 ("Non-College Areas" hatch)'],
  ['covered way: a lean-to (+3.75 falling east) over the yard by the passage\'s east mouth and a flat roof +3.2 down Maitland\'s back to v 46', 'K', 'LIDAR +3.0 .. 3.3 in no mapped outline; 2016 plan (walled strip); roof build G'],
  ['covered way on posts across the mouth of Maitland\'s yard, flagged floor on the surveyed ground', 'G', 'no picture'],
  ['rubble boundary wall to the Oratory\'s higher ground along the site line by the passage', 'G', 'map site ring; LIDAR (ground +1.6 beyond)'],
  ['garden walls: north (diagonal, to the Oratory\'s ground) and south (Little Clarendon Street backs), brick 2.2 m', 'G', 'map garden and site edges'],
  ['garden: oval lawn in the north part, lower lawn, beds, trees at the LIDAR canopy peaks, paths', 'K', 'LIDAR; satellite; 2016 plan (trees along the north, winding beds); layout G'],
  ['map path w97853765 along the garden\'s south side to the MTC', 'K', 'map; width G'],
];
