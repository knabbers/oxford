// Somerville College, STANDALONE model, part 'hall' (survey B03): THE PLAN of the Hall (Edmund Fisher, 1911 - 13), its
// kitchens, the loggia link and Maitland, the east side of the main Quad. Pure data: every dimension a named constant with
// its source and K / G mark; the build functions are in _somerville_hall_build.js. Research: docs/research/
// somerville_survey.md sections 1 - 5, 9, 11; reference/somerville/LOOKS_BY_HAND.md ("Hall, Maitland, Walton House");
// PHOTO_NOTES.md; brief docs/handoff/somerville/briefs/hall.txt.
//
// THE PART'S OWN FRAME. Everything is authored in (s, y, t): S.ownFrame(...FRAME) runs s SOUTH along the Hall's and
// Maitland's west (Quad) fronts, t across to the WEST (towards the lawn: t > 0 is the Quad, the buildings are at t < 0),
// y above the datum (62.50 m). The frame's line is the map's Hall west front as first issued (before the lead's
// registration of the map to the LIDAR): it is only a measuring line, every figure below was read off the LIDAR in it.
//
// HOW IT WAS MEASURED (2026-11-23; tools/somerville_lidar.py fbox / fsec / line in this frame, and a 0.25 m picture of
// the surface in it; nothing copied, nothing used as a texture)
//   * DIRECTION: the map's Hall and Maitland edges run 5.3 - 6.0 deg clockwise of the LOCAL v axis; the LIDAR's eaves and
//     parapet lines are parallel to the frame to within the 1 m grid over 60 m. K.
//   * THE HALL: eaves edge on the west at t -1.5 .. -2.0 (10.3 - 10.7), ridge 15.0 - 15.35 at t -8.2 from s 8.5 to 19,
//     east eaves t -14.0 (10.3), hipped ends (the roof falls from s 8.5 to the north eaves at s 1.6 and from s 19 to the
//     south at s 25.5). Pediment: a hump on the west slope peaking 12.8 at s 13 - 14 = the front's middle. Stacks: LIDAR
//     peaks 15.4 at (s 2.2, t -5.2) and (s 2.8, t -13.0), 15.0 at (s 24.6, t -9.8). K.
//   * THE KITCHENS east of it: flat roofs +7.0 .. +7.5 over s 1.7 - 25, t -14 .. -31.5, a tower +12.0 at s 2 - 7, t -15.3 ..
//     -19.3, a raised rooflight +8.0 .. +8.8 at s 2 - 8, t -20 .. -26; a lower +8 range north of s 1.7 towards Walton
//     House (s -1.5 .. 1.7, t -13.5 .. -17). The surveyors' drawings of the kitchen (planning 19/02710/LBC: existing
//     elevations and section, a local datum 50.000 = the ground floor) give the parapets 57.42 / 57.38 / 57.06 (+7.1 ..
//     7.4 over the floor), the tower 61.74 (+11.74), the first floor 53.82 (+3.82): K.
//   * THE LINK: ground (0.4) in a recess s 26 - 31.3, t -0.5 .. -3; a flat +3.6 .. 4.1 (the loggia's balcony) t -3 .. -5;
//     the link's own roof +9.9 .. 10.5 from t -5.5 to t -15 over s 24 - 31.3. K.
//   * MAITLAND: parapet +10.5 .. +10.8; the west fronts of the end blocks at t +1.0 .. +1.2 (sections at s 30 - 36 and
//     52 - 59), the centre's at t +0.2 .. +0.4 (a tree stands before it); its north end s 31.3 (to 0.5), south end 59.9
//     .. 60.2; the end blocks' widths 8.85 / 10.95 / 9.0 from the 2025 photograph square on (33 px a metre) agree with the
//     map's breaks to 0.3 m. A yard (ground) at s 35.7 - 44.8, t -7.3 .. -10.7; the south wing to t -10.5 and, at the
//     back, to s 62.3; a raised grey block +11.85 at s 50.8 - 59.5, t -4.8 .. -10 (the satellite's "grey flat-roofed block
//     at the south-east"). Stacks: LIDAR peaks 12.0 - 13.3 at the six places in MAIT_STACKS. K.
//   * LEVELS: bare ground at the west fronts: +0.6 .. +0.7 at the Hall, +0.4 at the loggia, +0.4 falling to +0.07 along
//     Maitland; +0.7 .. +0.8 north of the Hall, +0.4 .. +1.7 east of the kitchens. K (LIDAR DTM).
//   * HEIGHTS ON THE FACES: the Hall from the 2025 photograph from the north-west (38.6 px a metre at its second bay,
//     scaled by ground .. cornice = LIDAR) and the interior elevation drawings (planning 22/00198/LBC: the hall's windows
//     4.3 m tall from 0.3 above its floor); Maitland from the 2025 photograph square on (33 px a metre, parapet = LIDAR).
//     K for what is seen, G for the figure (+-0.15 m).
import { ownFrame } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ frame
export const FRAME = [40.28, -5.02, 38.17, 17.6];   // LOCAL (u, v) -> (u, v): the measuring line (see above). K
export const F = ownFrame(...FRAME);

// ------------------------------------------------------------------------------------------------ THE HALL
export const HALL = {
  s0: 1.6, s1: 25.4,                 // north and south walls. K: LIDAR eaves edges 1.2 / 25.8 less the cornice; hips symmetrical about the pediment (13.5)
  tW: -1.5, tE: -14.0,               // west (Quad) and east walls. K: LIDAR eaves -1.5 .. -2.0 (west), -14.0 .. -14.5 (east); map (registered) -1.1 / -13.5
  ffl: 0.75,                         // ground floor. G: one low step over the path (+0.6 .. 0.65, LIDAR), level with the kitchens' floor (ground +0.7 there)
  hallFloor: 4.57,                   // the dining hall's floor. K: kitchen section (first floor 3.82 over the ground floor: "circulation between kitchen and main dining room")
  plinth: 1.05,                      // brick plinth with a chamfered offset. K: close look (Street View 2015); G: height
  win0: { w: 1.3, sill: 1.45, head: 3.45 },      // ground floor sashes, 8 over 8. K: close look, photo 2025 (38.6 px/m): sill 0.8, head 2.9 over the ground; G: width
  arch: { h: 0.5, key: 0.62 },                   // gauged-brick flat arch over them, with a raised brick key. K: close look; G: sizes
  apron: { y0: 4.15, y1: 4.62 },                 // brick aprons under the hall's windows. K: close look; G: sizes
  band: { top: 4.85, h: 0.2 },                   // the stone sill band. K: close look (continuous band under the hall windows); G
  win1: { w: 1.62, sill: 5.0, head: 9.25 },      // the hall's VERY TALL sashes (two sashes of 12 panes painted as two stacked units). K: photo 2025 sill 4.4 / head 8.7 over the ground; drawing 22/00198 (4.3 m tall from 0.3 over the hall floor); G: width
  keyH: 0.55,                                    // stone keystones over the hall windows. K: photos 2006, 2025
  cornice: { top: 10.45, h: 0.55, proj: 0.45, frieze: 9.7, mod: 0.55 },   // the stone modillion cornice. K: LIDAR eaves 10.3 - 10.7; photo (modillions); G: profile
  ridge: 15.3,                       // K: LIDAR 15.0 - 15.35
  roofOv: 0.3,                       // the slates' foot over the cornice. G
  bays: 7, margin: 0.64,             // seven bays, the end bays' margin to the corner 0.64 of the pitch. K: photos 2006, 2017, 2025 (seven tall windows; six ground windows and the door); close look (margin)
  door: { bay: 3, w: 1.3, h: 2.75 },             // the doorway in the middle bay under a stone doorcase. K: photos 2006, 2025; G: size
  centre: { bays: [2, 4], adv: 0.2, apex: 12.85, oculus: 0.52 },   // bays 3 - 5 break forward under a brick pediment with stone cornices and a stone-framed oculus. K: photos (pediment over the middle three bays, oculus centred on the door); LIDAR hump 12.8; G: advance, oculus size
  stacks: [{ s: 2.1, t: -5.2, w: 1.0, d: 1.9, top: 15.6 }, { s: 2.8, t: -13.0, w: 1.1, d: 1.4, top: 15.6 }, { s: 24.6, t: -9.8, w: 1.1, d: 1.6, top: 15.2 }],   // K: LIDAR peaks; photos (the tall plain stack on the north wall); G: sizes and tops
  finial: { s: 13.5, h: 1.1 },       // a small spike finial on the ridge. K: photo 2017 (snow); G: place and size
  oculiE: [5.4, 10.7, 16.3, 21.6],   // round windows high on the east wall over the kitchens' roof. K: photo note (an oculus high on the east wall inside), drawing 22/00198 east elevation (four round windows); G: places
  oculiEY: 9.0,
  north: { door: -9.0, win: -12.0, plaques: [-4.0, -6.6] },   // the north end: a doorway, a window, two stone plaques. K: photo 2025 (from the north-west); G: places
  lampNW: { t: -2.3, y: 4.05 },      // the wall lantern on its bracket at the north-west corner (on the north face). K: close look, photo 2025
  lampSW: { t: -2.4, y: 4.05 },      // a wall lantern on the south return by the loggia. K: Street View 2015 ("Maitland and the loggia link closer"); G: place
  pipes: [5.3, 8.6, 18.4, 21.7],     // iron downpipes on the west front. K: close look and photo 2025 (two seen, one each side of the middle); G: the rest
};

// ------------------------------------------------------------------------------------------------ THE KITCHENS (east of the Hall)
export const KIT = {
  ring: [[1.7, -14.0], [1.7, -31.5], [10.0, -31.5], [10.0, -28.0], [12.6, -28.0], [13.3, -24.3], [25.3, -19.2], [25.3, -14.0]],   // K: map w97853780 (registered) with the east face at the LIDAR's -31.5
  ffl: 0.7,                          // K: drawing 19/02710 (ground 49.97 / floor 50.00) set on the LIDAR's ground +0.7
  roof: 7.45, parapet: 8.1,          // K: LIDAR roof 7.0 - 7.5; drawing (parapets +7.4 over the floor)
  tower: { s0: 2.0, s1: 7.2, t0: -15.3, t1: -19.3, top: 12.25 },   // K: LIDAR 12.0 - 12.1; drawing 61.74 (+11.74 over the floor); G: plan to 0.5 m
  light: { s0: 2.4, s1: 7.6, t0: -20.4, t1: -25.6, top: 8.7 },     // a raised rooflight. K: LIDAR +8.0 .. 8.8; drawing note "roof plant and roof lights"; G: form
  link: { s0: -0.05, t0: -13.5, t1: -17.0, top: 8.1 },             // the lower range north towards Walton House, built to s -0.05 and stopped there: its north face is the south wall of part 'house''s archway passage (changed by the lead from -1.2 after 'house' was built: the box stood in the passage). K: LIDAR +8.0 .. 8.3 at s -2 .. 1.7; brief (stop at v -6)
  plant: [[4.0, -27.5, 1.4, 1.0, 1.1], [7.5, -29.6, 2.0, 1.1, 1.0], [16.5, -17.5, 1.8, 1.2, 0.9], [20.5, -16.5, 1.3, 1.3, 1.2]],   // roof plant [s, t, w, d, h]. K: satellite (plant on the kitchen roofs), LIDAR bumps +8 .. 9; G: each box
  ducts: [[11.0, -21.5, 0.35, 2.4], [14.5, -15.8, 0.3, 2.0]],     // extract flues [s, t, r, h]. G
  wins: { north: [-19.5, -24.0, -28.5], east: [4.5, 8.0] },      // K: drawing (north elevation: one two-leaf window at the ground floor; east: first floor windows); G: places
};

// ------------------------------------------------------------------------------------------------ THE LINK (loggia between Hall and Maitland)
export const LINK = {
  s0: 25.4, s1: 31.2,                // between the Hall's south wall and Maitland's north end. K: LIDAR recess s 26 - 31.3
  tW: -5.3, tE: -15.0,               // its upper wall (recessed) and its east face. K: LIDAR roof from -5.5 to -15
  colT: -3.2,                        // the loggia's columns and the balcony's front. K: LIDAR balcony flat t -3 .. -5
  ffl: 0.45,                         // the loggia's floor (the doors' thresholds; reset in the build to the flags at the columns). K: LIDAR ground 0.38 - 0.45 (survey: path at the loggia +0.38)
  dy: 0.09,                          // the flags through the loggia and the way: laid on the surveyed ground this much over it (over the grounds part's sheet and paths). K: house style
  cols: 2, colR: 0.19, colTop: 3.1,  // two white Tuscan columns, three bays. K: looks (Street View 2015), photo 2025; G: radius
  ent: { y0: 3.1, y1: 3.55 },        // white entablature. G (look)
  bal: { y0: 3.55, rail: 4.45, n: 22 },   // the white balustrade over it. K: looks; LIDAR 3.6 - 4.1; G: height, baluster count
  pass: { s0: 27.0, s1: 29.6, h: 3.05 },  // the way through east (the middle bay). K: brief (an open way to the east; path to the Hodgkin Quad); G: width, height
  win1: { w: 1.1, sill: 3.75, head: 6.0 },   // first floor: glazed doors to the balcony. K: looks (three a floor behind the balustrade); G: heights
  win2: { w: 1.1, sill: 6.95, head: 8.7 },   // second floor. K: looks
  bays: [26.6, 28.3, 30.0],
  roof: 9.9, top: 10.35,             // K: LIDAR roof 9.9; parapet G
};

// ------------------------------------------------------------------------------------------------ MAITLAND
export const MAIT = {
  sN: 31.2, sC0: 40.05, sC1: 51.0, sS: 60.2, sS2: 62.3,   // north block | centre | south block; the south wing runs on to 62.3 behind (t < -4.5). K: LIDAR, map, photo 2025
  tEnd: 1.1, tCen: 0.2,              // west faces of the end blocks and of the centre. K: LIDAR sections
  tYard: -7.0, tBack: -10.5, sYard0: 36.1, sYard1: 44.7,   // the yard and the back of the wings. K: LIDAR (yard ground t -7.3 .. -10.7, s 35.7 - 44.8), map
  tSouthStep: -4.5,                  // where the south end steps out to sS2. K: LIDAR (G: line)
  ffl: 0.5,                          // G: between the ground at its north end (+0.4) and south (+0.07)
  plinth: 0.85,
  win0: { sill: 1.1, head: 3.05 }, win1: { sill: 4.0, head: 6.05 }, win2: { sill: 7.0, head: 8.75 }, winW: 1.15,   // sashes 6 over 6 in rubbed-brick flat arches. K: photo 2025 square on (33 px/m)
  band: { top: 3.75, h: 0.18 },      // stone band between ground and first floor. K: photo; G: size
  ped: { w: 1.7, rise: 0.55, gap: 0.05 },   // triangular brick pediments over the first-floor windows of the end blocks. K: photos 2025, 2019; G: size
  cornice: { top: 9.7, h: 0.45, proj: 0.4 },   // K: photo (cornice 9.1 - 9.5 over the ground); G: profile
  parapet: { top: 10.65, coping: 0.1, t: 0.35 },   // panelled brick parapet with a stone coping. K: LIDAR 10.5 - 10.8, photo (sunk panels)
  roof: 10.0,                        // flat roofs behind. K: LIDAR inside the parapets 9.8 - 10.4
  grey: { s0: 50.8, s1: 59.5, t0: -4.8, t1: -10.0, top: 11.85 },   // the grey flat-roofed block. K: LIDAR +11.8 - 11.9; satellite; G: cladding
  bays: { N: [32.65, 34.55, 36.45, 38.35], C: [41.0, 42.75, 44.5, 46.25, 48.0, 49.75], S: [52.45, 54.3, 56.15, 58.0] },   // K: photo 2025 square on (4 + 6 + 4 windows across; 1.9 / 1.75 / 1.85 pitches)
  stacks: [ // [s, t, w along s, d, top]. K: LIDAR peaks 12.0 - 13.3 and photo 2025 (six stacks, the centre-right one double); G: sizes and tops
    [33.0, -7.5, 1.0, 0.8, 12.7], [36.0, -1.9, 1.4, 0.9, 13.3], [44.0, -3.0, 1.2, 0.9, 13.2], [49.2, -3.0, 2.6, 1.0, 13.3], [52.5, -7.0, 1.3, 0.9, 12.9], [57.0, -1.9, 1.4, 0.9, 13.3]],
  pipes: [33.6, 37.5, 41.9, 49.0, 53.7, 57.4],   // iron downpipes on the west front. K: photo 2025 (six)
  north: [-2.1],                     // window columns in the north return (into the loggia recess). G
  south: [-1.9, -3.9],               // window columns in the south end (front part). G: seen in no look
  back: 1.9,                         // pitch of the windows on the faces no look shows. G
};

// ------------------------------------------------------------------------------------------------ the ground at the walls
export const BEDS = { hall: [-1.5, 0.0], mait: 1.9 };   // flower beds before the Hall (1.5 deep) and Maitland (to t 1.9, the path's edge). K: photos 2006, 2025, Street View 2015; G: depths

export const CHECKED = [
  ['frame along the west fronts, 5.3 - 6.0 deg clockwise of LOCAL v', 'K', 'map w1040787560 / w97853751 edges; LIDAR eaves and parapet lines'],
  ['Hall walls s 1.6 - 25.4, t -1.5 / -14.0 (23.8 x 12.5)', 'K', 'LIDAR eaves edges and the hips symmetric about the pediment (fbox/fsec 2026-11-23)'],
  ['Hall hipped stone-slate roof, cornice top +10.45, ridge +15.3 from s 8 to 19', 'K', 'LIDAR 10.3 - 10.7 / 15.0 - 15.35; photos 2006 / 2025 (graded stone slate)'],
  ['Hall seven bays on the Quad, end margins 0.64 of the pitch', 'K', 'photos 2006, 2017, 2025; close look Street View 2015'],
  ['Hall ground floor 8/8 sashes under gauged flat arches with keys, sill 1.45 head 3.45', 'K', 'close look; photo 2025 scaled 38.6 px/m (+-0.15); width 1.3 G'],
  ['Hall first floor very tall sashes 5.0 - 9.25 with brick aprons, stone keystones, a stone sill band', 'K', 'photo 2025; drawing 22/00198/LBC internal elevations; width 1.62 G'],
  ['the hall floor 3.82 over the ground floor (+4.57)', 'K', 'drawing 19/02710/LBC existing section (first floor = circulation to the main dining room)'],
  ['Hall ground floor +0.75', 'G', 'one low step over the path (LIDAR +0.6 .. 0.65)'],
  ['middle three bays break forward 0.2 under a pediment with an oculus, apex +12.85, lead roof behind it', 'K', 'photos 2006 / 2025; LIDAR hump 12.8; advance 0.2 and oculus 1.04 G'],
  ['stone doorcase in the middle bay', 'K', 'photos 2006 / 2025; its design G (an entablature hood on consoles)'],
  ['stone modillion cornice and rubbed-brick quoins on the Hall', 'K', 'photos 2025 (corners in red rubbed brick, not stone as the brief has it); profile and quoin sizes G'],
  ['the Hall\'s slates in a darker tint (key stoneSlateHall added)', 'K', 'photos 2006 / 2025, satellite (dark grey-brown graded stone slate)'],
  ['Hall stacks at (2.2, -5.2), (2.8, -13.0), (24.6, -9.8)', 'K', 'LIDAR peaks 15.4 / 15.4 / 15.0; tops +15.6 / +15.2 G'],
  ['spike finial on the Hall ridge', 'K', 'photo 2017 (snow); place and size G'],
  ['four oculi high on the Hall east wall over the kitchen roofs', 'G', 'drawing 22/00198 east internal elevation shows four round windows; outside not seen in any look'],
  ['Hall north end: doorway, window, two stone plaques, the wall lantern at the north-west corner', 'K', 'photo 2025 from the north-west; close look; places G'],
  ['kitchens: flat roofs +7.45 behind brick parapets +8.1, a tower +12.25, a raised rooflight, roof plant', 'K', 'LIDAR; drawings 19/02710/LBC elevations (parapets, tower 61.74); plant boxes and flues G'],
  ['kitchens east face t -31.5 and plan', 'K', 'LIDAR; map w97853780 (registered)'],
  ['kitchen faces: brick, few windows', 'G', 'drawing 19/02710 elevations by eye; no photograph'],
  ['the range north of the kitchens towards Walton House, +8.1, built to s -1.2 (LOCAL v -6) and stopped', 'K', 'LIDAR +8.0 .. 8.3; brief; its faces G'],
  ['link between Hall and Maitland s 25.4 - 31.2, recessed to t -5.3, roof +9.9, three storeys', 'K', 'LIDAR; looks Street View 2015; photos 2025'],
  ['three-bay loggia on two white Tuscan columns with a white balustrade over it, front at t -3.2', 'K', 'looks; LIDAR balcony flat +3.6 .. 4.1 at t -3 .. -5; column and baluster sizes G'],
  ['three windows a floor in the link (glazed doors to the balcony on the first floor)', 'K', 'looks; heights G'],
  ['open way east through the link (2.6 wide, 3.05 high) to its east face at t -15', 'K', 'brief; map path (the way to the Hodgkin Quad); width, height and the east mouth G'],
  ['loggia and passage floor: flags on the surveyed ground (+0.38 .. 0.5)', 'K', 'LIDAR ground; flags G'],
  ['Maitland west front: end blocks s 31.2 - 40.05 and 51.0 - 60.2 at t +1.1, centre at t +0.2', 'K', 'LIDAR sections; photo 2025 square on (8.85 / 10.95 / 9.0 m)'],
  ['Maitland 4 + 6 + 4 bays, three storeys, 6/6 sashes in rubbed flat arches', 'K', 'photo 2025 square on (the notes\' 5 + 6 + 5 recounted: 14 across); Street View 2015'],
  ['Maitland window heights (1.1 - 3.05, 4.0 - 6.05, 7.0 - 8.75)', 'K', 'photo 2025 scaled 33 px/m (+-0.15)'],
  ['triangular pediments over the end blocks\' first-floor windows', 'K', 'photos 2025, 2019; sizes G'],
  ['Maitland cornice +9.7, panelled brick parapet +10.65, flat roofs +10.0', 'K', 'LIDAR; photo 2025; profile G'],
  ['Maitland rusticated rubbed-brick quoins (not stone: the brief says stone) and a stone band', 'K', 'photo 2025 square on and 2019 (the quoins read as red rubbed brick); sizes G'],
  ['six Maitland stacks (one double) at the LIDAR peaks', 'K', 'LIDAR 12.0 - 13.3; photo 2025; sizes and tops G'],
  ['Maitland yard s 36.1 - 44.7 at t -7 .. -10.5; wings back to t -10.5; south wing on to s 62.3 behind', 'K', 'LIDAR; map'],
  ['grey flat-roofed block on the south wing, +11.85', 'K', 'LIDAR; satellite; cladding G'],
  ['Maitland ground floor +0.5', 'G', 'ground +0.4 (north) .. +0.07 (south)'],
  ['Maitland east, yard and south faces: the same style plainer, sashes at 1.9', 'G', 'seen in no look (the 2019 photo shows only the south-west corner)'],
  ['iron downpipes', 'K', 'photos (six on Maitland); the Hall\'s two of four K'],
  ['flower beds along the Hall and Maitland', 'K', 'photos 2006, 2025; depths G'],
  ['the low +3 roofs east of the link and of Maitland (s 25 - 50, t -10 .. -19) are in no mapped outline: not built here', 'G', 'LIDAR; for the lead to place (see report)'],
];
