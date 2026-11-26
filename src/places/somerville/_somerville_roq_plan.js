// Somerville College, STANDALONE model, part 'roq' (survey B11): THE PLAN of ROQ West and ROQ East (Niall McLaughlin
// Architects, 2010 - 11), the college gate between them onto Loverose Way, and the short stretch of the north boundary west
// of ROQ West. Pure data: every dimension a named constant with its source and K / G mark; the build functions are in
// _somerville_roq_build.js. Research: docs/research/somerville_survey.md sections 1 - 5, 9, 11; reference/somerville/
// LOOKS_BY_HAND.md ("The north side"); PHOTO_NOTES.md (ROQ); brief docs/handoff/somerville/briefs/roq.txt.
//
// THE TWO OWN FRAMES. Each block is authored in (s, y, t): S.ownFrame(...FRAME_W | FRAME_E) runs s EAST along the block's
// MAIN NORTH WALL (the brick face the oak bays stand on), t SOUTH across it (into the building), y above the datum
// (62.50 m). s = 0 is the block's west end (the west stair tower's end face), t = 0 the north wall; the bays and the
// towers stand forward of it at negative t.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * THE ARCHITECTS' PLANNING DRAWINGS (09/00317/FUL, NMLA 0713-PL-070 rev U "Block 1 & 2 North Elevation" and -076
//     "South Elevation", -050 "Sections", 1:100 @ A1 printed 1:200 @ A3; read off the register's PDFs at 150 dpi, where
//     1 m = 29.37 px, a scale the drawings' own storey heights confirm): FIGURED AOD levels (floor levels, roof slab,
//     parapet, top of stair tower, external ground), so every height below is K. Block 1 = ROQ EAST (three storeys),
//     Block 2 = ROQ WEST (four). The elevations give the ORDER of the north faces (towers, white precast joints, brick
//     bay groups, the recessed precast stair / kitchen bays) and their widths, SCALED (+-0.15 m), then stretched by
//     1.0 - 1.5 % to the LIDAR's lengths. Room count 11 + 11 + 11 + 11 (West) + 8 + 8 + 8 (East) = 68 = the college's
//     "68 en-suite rooms": the bay counts are K.
//   * THE 2026 SECTION (26/01374/FUL, NMLA PL391, DIMENSIONS.md): the gate 12.3 m between the towers, 2.1 m high; the
//     towers' glazed lanterns; the canopies and benches at both entrances (still standing: to be removed in 2026).
//   * LIDAR 2022 (tools/somerville_lidar.py fbox / fsec / line, 0.25 m steps across): ROQ WEST roof +12.2 .. 12.4, its north
//     parapet edge at t -6.3 of the map's south edge (bays to -7.3), its south edge on the map's line (= the Library
//     part's T_ROQ, 0.85 m north of the Library's north wall), towers +16.0 .. 16.1 at s 1.0 - 4.5 and 64.8 - 68.5 of the
//     map edge, the block's ends at 0.85 and 68.6: 67.75 m. ROQ EAST roof +9.5 .. 9.7, parapet +9.8 .. 10.3, north wall
//     t -0.3 of the map's north edge (bays to -1.2), towers +13.4 at s 0.8 - 4.2 and 43.2 - 46.3, the block's ends 0.7 and
//     47.3: 46.6 m; its south side against Walton House (the House part's north face, FE t 6.8) and the Hostel (FE t 7.45).
//   * PHOTOGRAPHS (folder 12; 04 "Library east end ..."): bay boxes, splayed cheeks with narrow lights, windows to
//     alternate sides in neighbouring boxes, the fin screens on the towers' END faces (West tower west face: Street View
//     photo sphere 2018; the gate faces: NMLA c2011, Hawgood 2013, the Library-east photo), the brick shafts standing
//     a little above the parapets, the white precast joints, the battered pale concrete plinth, the white rendered south
//     face above the Library's east block with one window, the canopy and bench at the ROQ West entrance, the steel
//     vertical-bar gate.
import { ownFrame } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ frames (LOCAL u, v)
// ROQ West: the map's south edge (-37.49, -23.6) -> (30.12, -30.65) (-5.95 deg, LIDAR edges parallel to it) moved to the
// north wall (t -6.3 of it) and cut to the block's ends (s 0.85 .. 68.6 of it). K
export const FRAME_W = [-37.298, -29.954, 30.087, -36.981];
export const FW = ownFrame(...FRAME_W);
// ROQ East: the map's north edge (41.91, -38.96) -> (88.01, -33.85) (+6.33 deg) moved to the north wall (t -0.3) and cut
// to the ends (s 0.7 .. 47.3). K
export const FRAME_E = [42.639, -39.181, 88.955, -34.047];
export const FE = ownFrame(...FRAME_E);

// ------------------------------------------------------------------------------------------------ the blocks
// Levels: FIGURED on the NMLA elevations / sections (AOD - 62.50). K.
export const WEST = {
  L: 67.75,                      // K: LIDAR ends (drawing 67.1 at its scale)
  D: 6.30,                       // the north wall to the south (corridor) wall. K: LIDAR parapet edges (t -6.3 .. 0); NMLA section 5.6 + the bays (scaled)
  floors: [1.073, 3.873, 6.673, 9.473],   // 00 FFL 63.573, 01 66.373, 02 69.173, 03 71.973. K figured
  roof: 12.148,                  // roof slab 74.648. K figured; LIDAR +12.2 .. 12.4
  parapet: 13.043,               // parapet 75.543. K figured; LIDAR +12.9 .. 13.0
  towerTop: 16.173,              // T/O stair tower 78.673. K figured; LIDAR +16.0 .. 16.1
  // the north face from the WEST end (s): K order and counts (elevation), widths scaled (+-0.15) and stretched to L
  segs: [
    { k: 'tower', s0: 0, s1: 3.5 },
    { k: 'strip', s0: 3.5, s1: 4.81 },
    { k: 'bays', s0: 4.81, s1: 17.35, n: 3 },
    { k: 'recess', s0: 17.35, s1: 20.79 },
    { k: 'bays', s0: 20.79, s1: 41.74, n: 5 },
    { k: 'recess', s0: 41.74, s1: 44.66 },
    { k: 'bays', s0: 44.66, s1: 62.87, n: 3, c: 53.73 },   // three bays in a longer brick stretch (plain brick both sides)
    { k: 'strip', s0: 62.87, s1: 64.25 },
    { k: 'tower', s0: 64.25, s1: 67.75 },
  ],
  pitch: 4.18,                   // bay centres. K: elevation (5 bays in 20.95 m)
  gateEnd: 'east',               // the tower on the gate
  southWin: [{ s: 61.7, y0: 10.07, y1: 11.37, w: 1.3 }],   // the one window in the white rendered face over the Library's east block. K: photo "Library east end ..." (c2011); G: size and place
};
export const EAST = {
  L: 46.60,                      // K: LIDAR ends (drawing 46.0)
  // the corridor wall, kept 0.3 m clear of the House part's north faces (the map draws them on one line): Walton House's
  // main block (its t 0.25 = FE t 7.07 .. 6.97 over s 0 .. 18) and, east of s 18, its north-east block and the Hostel's
  // blank north wall (its t 0.75 = FE t 7.47 .. 7.31 at the east end). K: map, LIDAR roof to t 5.5 .. 6.5, the House
  // part's frame and faces (lead, 2026-11-23); G: the 0.3 m joint
  D: 6.65, D2: 7.00, sStep: 18.0,
  floors: [1.143, 3.973, 6.773], // 00 FFL 63.643, 01 66.473, 02 69.273. K figured
  roof: 9.448,                   // 71.948. K figured; LIDAR +9.5 .. 9.7
  parapet: 10.338,               // 72.838. K figured; LIDAR +9.8 .. 10.3
  towerTop: 13.468,              // 75.968. K figured; LIDAR +13.4
  segs: [
    { k: 'tower', s0: 0, s1: 3.5 },
    { k: 'strip', s0: 3.5, s1: 4.83 },
    { k: 'bays', s0: 4.83, s1: 22.06, n: 4 },
    { k: 'recess', s0: 22.06, s1: 24.99 },
    { k: 'bays', s0: 24.99, s1: 42.05, n: 4 },
    { k: 'strip', s0: 42.05, s1: 43.1 },
    { k: 'tower', s0: 43.1, s1: 46.6 },
  ],
  pitch: 4.31,                   // K: elevation (4 bays in 17.2 m)
  gateEnd: 'west',
  // the corridor wall seen in the House's lightwell (NMLA south elevation: "two smaller windows" a floor). K: elevation; G: places
  southWin: [{ s: 15.9, y0: 4.9, y1: 6.0, w: 0.9 }, { s: 17.6, y0: 4.9, y1: 6.0, w: 0.9 }, { s: 15.9, y0: 7.7, y1: 8.8, w: 0.9 }, { s: 17.6, y0: 7.7, y1: 8.8, w: 0.9 }],
};

// ------------------------------------------------------------------------------------------------ the parts of a face
export const WALL_T = 0.30;      // parapet / wall thickness at the top. G
export const RECESS = 0.35;      // the precast stair / kitchen bays and the white joints set back. K: photos (recessed); G: depth
export const PLINTH = { below: 0.15, batter: 0.35, maxOut: 0.9, sink: 0.5 };   // the pale concrete plinth: top 0.15 below the ground floor, battered out 0.35 per metre of height (to 0.9), 0.5 into the ground. K: elevation (hatched plinth growing west), section ("smooth concrete plinth", battered), photo 2018 (battered at the west tower); G: the batter
export const BAY = {             // the oak window boxes ("hardwood study window units")
  w: 3.45,                       // width at the wall. K: elevation scaled 3.4 (+-0.15)
  front: 2.95,                   // width of the front: both cheeks splayed. K: elevation (diagonals at the boxes' corners), photos; G: figure
  proj: 0.90,                    // K: LIDAR (bays to 0.9 - 1.0 beyond the parapet edge), section scaled 1.0
  below: 0.10, h: 2.60,          // from floor - 0.10 to floor + 2.50. K: section ("2500" window unit), photos (thin dark joint between tiers)
  win: { w: 1.55, sill: 1.15, head: 2.35, inset: 0.18 },   // the large window to one side over a boarded apron. K: elevation, photos; G: figures (+-0.1)
  light: { w: 0.32, y0: 0.45, y1: 2.25 },                  // the narrow light in one cheek. K: photos; G: size
};
export const SLOT = { w: 0.55, y0: 0.25, y1: 2.45 };       // one tall slot window a floor in each recessed bay. K: elevation; G: size
export const TOWER = {
  proj: 0.90,                    // the shaft's north face stands forward of the wall, level with the bay fronts. K: photos (Hawgood 2013, NMLA c2011); G: figure
  above: 0.45,                   // the brick shaft stands above the block's parapet. K: photos; G: figure (the 2009 elevation draws it level)
  lantern: { d: 4.2, inset: 0.12 },   // the glazed lantern with oak fins over the north 4.2 m of the shaft. K: NMLA section (scaled 4.2), LIDAR (+16 / +13.4 over t -0.9 .. 3.3)
  screen: { y0: 3.3, d: 4.2, pitch: 0.5, fin: [0.12, 0.34], rail: 0.08 },   // the oak fin screen on the END face from 3.3 above the ground floor to the top. K: photos (fins over glazing from about the second storey, horizontal rails at the floors); G: figures
  door: { t0: 1.3, t1: 0.25, h: 2.35 },  // the entrance door on the gate face, measured in from the south wall (t D - 1.3 .. D - 0.25). K: 26/01374 plan ("ROQ West / East entrance"); G: size
  canopy: { y: 2.75, w: 2.6, d: 1.3, h: 0.22 },       // the precast canopy over it. K: 26/01374 ("pre-cast concrete canopies"), photo c2011; G: size
  bench: { len: 1.8, d: 0.45, h: 0.45 },               // the precast bench beside it. K: 26/01374; G: size
  southWin: { w: 1.0, h: 1.0, floors: [2, 3] },        // two windows on the shaft's south face (ROQ West's towers, over the Library / Holtby). K: NMLA south elevation (grid 34 - 37); G: the west tower
};
export const ROOF = {
  pv: { t0: 0.8, t1: 2.8, rise: 0.55, gap: 0.6 },       // PV arrays along the north half, tilted to the south, tops at the parapet. K: satellite, elevation ("top of panels to align with top of parapet"); G: rows
  light: { t0: 1.4, t1: 0.7, h: 0.32 },                // a rooflight strip along the south side (t from the corridor wall). K: satellite (ROQ West); G: ROQ East
};

// ------------------------------------------------------------------------------------------------ the gate and the square
export const GATE = {
  h: 2.10,                        // K: 26/01374 scaled; photos (a man's height and a half)
  bar: 0.045, pitch: 0.13,        // painted steel vertical flat bars. K: photos; G: figures
  leaves: [3.8, 1.7],             // the fire-engine leaf (west) and the wicket (east), each hinged at its tower's north corner and drawn
                                  // OPEN INWARDS against the tower's gate face (touch-up 1: the lead; the earlier reading of the 2026
                                  // plan's swings drew them open outward into Loverose Way). G: widths (the fire-engine leaf ends before
                                  // the tower's bench)
  off: 0.12,                      // the open leaf's line off the tower face. G
};
// The neighbours' faces the square is bounded by (LOCAL), from their parts' plans: the Library's lower east block's east
// face (library part: EBLK s1 79.9, t -6.0 .. -0.5), Walton House's west face (house part: FRAME origin = its north-west
// corner, t south along the face), the Library's brick raised bed's north-east corner (library part: PLANTER). K (theirs)
export const LIB_EAST = [[28.83, -29.68], [29.41, -24.21]];
export const HOUSE_NW = [41.80, -32.41], HOUSE_DIR = [0.99449, 0.10465];
export const PLANTER_NE = [31.3, -23.95];
export const HOUSE_BAY = { s0: -4.7, t0: 0.25, t1: 5.81 };   // Walton House's single-storey brick bay standing out west of its front into the
                                  // square, in the house part's frame (house plan BAY: s -4.7 .. 0, t 0.25 .. 5.81). K (theirs). Touch-up 1:
                                  // the square's paving is trimmed round it
export const SQUARE_S = -26.0;   // v where the paved square between the towers meets the drive down to the Quad. K: 26/01374 plan (about 11 m inside the gate); G: line
export const LATTICE = { pitch: 1.6, w: 0.05 };      // the diagonal lattice of the paving. K: brief / look; G: figures
export const DRIVE_S = -20.6;     // the tarmac from the square down to the Quad's path. K: photo "Library east end ..." (tarmac); G: line

// ------------------------------------------------------------------------------------------------ west of ROQ West
// The college's side of the boundary between ROQ West's west tower and Holtby / Park: a raised shrub bed behind a concrete
// kerb along the boundary, the old rubble boundary wall at the foot of Holtby's buff north face, a paved passage beside
// the tower closed by a timber gate. K: Street View photo sphere 2018 (bed, kerb, rubble wall, timber fence); LIDAR (shrubs
// +0.4 .. +2.0 over u -47 .. -41, v -28 .. -25; ground -0.7 .. -1.6); G: lines and heights.
export const BED = {
  kerb: [[-47.2, -29.84], [-39.5, -29.64]],          // along SITE_RING's north line. K: map
  back: [[-47.75, -22.95], [-39.5, -23.82]],         // the rubble wall, 0.75 m north of Holtby's north face (library part: t -6.0). G
  rise: 0.30, kerbH: 0.15, wallH: 1.6, wallT: 0.345, // K: 2024 masonry survey (345 mm) for the wall's thickness; G: heights
};
export const PASSAGE_GATE = { h: 1.8 };              // close-boarded timber gate between the bed and the tower. K: photo 2018; G: height

export const CHECKED = [
  ['ROQ West: four storeys, floors +1.07 / 3.87 / 6.67 / 9.47, roof slab +12.15, parapet +13.04, tower +16.17', 'K', 'NMLA 0713-PL-070 rev U north elevation, figured AOD levels; LIDAR roof 12.2, parapet 13.0, towers 16.1'],
  ['ROQ East: three storeys, floors +1.14 / 3.97 / 6.77, roof slab +9.45, parapet +10.34, tower +13.47', 'K', 'NMLA 0713-PL-070 figured levels; LIDAR 9.5 / 9.8 .. 10.3 / 13.4'],
  ['ROQ West direction -5.95 deg, ends s 0 / 67.75, north wall 6.3 m north of the map\'s south edge, south wall on that edge', 'K', 'LIDAR 2022 profiles across and along (0.25 m steps); map w296174578; the Library part\'s T_ROQ'],
  ['ROQ East direction +6.33 deg, ends s 0 / 46.6, north wall 0.3 m north of the map\'s north edge', 'K', 'LIDAR 2022 profiles; map w296174577'],
  ['ROQ East\'s corridor wall at t 6.65 (west of s 18) and 7.0, 0.3 m clear of Walton House\'s main block and of its north-east block / the Hostel', 'K', 'map; LIDAR; the House part\'s faces (its t 0.25 and 0.75); the 0.3 m joint G'],
  ['north face order: tower, white precast joint, brick bay groups 3 / 5 / 3 (West) and 4 / 4 (East), recessed precast stair / kitchen bays with slot windows', 'K', 'NMLA north elevation; photos folder 12; 68 rooms in all (college)'],
  ['segment widths (bays 3.45 at 4.18 / 4.31 centres, recesses 2.9 - 3.4, joints 1.0 - 1.4)', 'K', 'NMLA elevation scaled at 29.37 px/m (+-0.15 m), stretched 1 - 1.5 % to the LIDAR lengths'],
  ['oak bay boxes: one a room a floor, 0.9 deep, both cheeks splayed, a large window to one side over a boarded apron, a boarded panel beside it', 'K', 'photos (Street View 2024 square on and detail; some.ox.ac.uk; Hawgood 2013); figures G'],
  ['windows to alternate sides in neighbouring boxes', 'K', 'NMLA elevation of block 2; Street View 2024 square on (ROQ East)'],
  ['narrow light in one cheek of each box', 'K', 'photos; which cheek G'],
  ['brick shafts of the stair towers forward of the wall, level with the bay fronts', 'G', 'photos (Hawgood 2013, NMLA c2011) by eye'],
  ['stair towers\' brick shafts 0.45 above the parapet, glazed lanterns with oak fins on their north 4.2 m', 'K', 'photos; NMLA section (lantern 3.18 tall, 4.2 deep scaled); LIDAR; the 0.45 G'],
  ['oak fin screens on the towers\' END faces (west face of the west towers, gate faces of the gate towers), from the second storey up into the lantern', 'K', 'Street View photo sphere 2018 (ROQ West west tower); NMLA c2011; Hawgood 2013; photo "Library east end ..."'],
  ['ROQ East\'s east tower: fin screen on its east face', 'G', 'seen in no look (Loverose Way look east shows its north face only)'],
  ['battered pale concrete plinth, top 0.15 below the ground floor, growing west to 2.6 m at ROQ West\'s west end', 'K', 'NMLA elevation (hatched plinth), section; photo 2018; batter G'],
  ['ROQ West\'s ground: +0.68 at the gate falling to -1.19 at the west end (drawing), LIDAR -1.46', 'K', 'NMLA elevation spot levels 63.18 .. 61.31; the surveyed ground is drawn'],
  ['flat roofs, pale membrane, PV arrays along the north half with tops at the parapet, a rooflight strip along the south side', 'K', 'satellite (by hand 2026-11-23); NMLA elevation notes; ROQ East\'s rooflight and the PV rows G'],
  ['south (corridor) faces white render ("to match precast"), plain', 'K', 'NMLA south elevation; photo "Library east end ..." (white panels)'],
  ['the window in the white face over the Library\'s east block', 'K', 'photo c2011; place and size G'],
  ['two windows a floor on ROQ East\'s corridor wall in the House lightwell', 'K', 'NMLA south elevation; places G'],
  ['two windows on the south faces of ROQ West\'s towers', 'K', 'NMLA south elevation (east tower); the west tower G'],
  ['entrances on the gate faces of the two gate towers with precast canopies and a bench', 'K', '26/01374 ground plan and heritage statement; photo c2011; sizes G'],
  ['the gate: painted steel vertical bars 2.1 m high across the 12.9 m between the towers\' north corners', 'K', '26/01374 (12.3 m between tower faces, 2.1 m); photos; LIDAR places the tower corners 12.9 apart'],
  ['the gate\'s leaves (3.8 m and 1.7 m) hinged at the towers\' corners, drawn open INWARDS against the towers\' gate faces; a fixed run between', 'G', 'the lead (touch-up 1); widths by eye'],
  ['the paved square\'s edge goes round Walton House\'s single-storey brick bay (house part BAY)', 'K', 'house plan (16/00283 survey) (touch-up 1)'],
  ['the paved square inside the gate, diagonal lattice paving, to v -26; tarmac on to the Quad path', 'K', 'brief (look); 26/01374 plan; photo c2011 (tarmac); the lattice figures and the lines G'],
  ['west of ROQ West: kerb, raised shrub bed, rubble wall at Holtby\'s foot, paved passage with a timber gate', 'K', 'Street View photo sphere 2018; LIDAR shrubs; map ring; lines and heights G'],
  ['north boundary east of ROQ East: none of the college\'s own (the Hostel is the boundary)', 'K', 'SITE_RING; LIDAR (the 2 - 3 m structure at u 88 - 91 is outside the ring)'],
];
