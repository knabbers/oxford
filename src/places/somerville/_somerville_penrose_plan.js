// Somerville College, STANDALONE model, part 'penrose' (survey B07): THE PLAN of Penrose (1925-27, Harold Rogers):
// a three-storey neo-Georgian range of red-brown brick with a deep white eaves cornice and hipped clay-tile roofs: a
// long east - west range with a cross wing at its Walton Street (west) end and a pavilion wing at its east end that
// runs on south along the Fellows' Garden, a centre bay with the stone doorcase on the north (Penrose lawn) front and a
// stair block behind it on the south. Pure data: every figure a named constant with its source; the build functions are
// in _somerville_penrose_build.js. Brief: docs/handoff/somerville/briefs/penrose.txt.
//
// PENROSE'S OWN FRAME (S.ownFrame): x along the north faces, EAST, from the outer north-west corner of the west wing; y
// across, SOUTH (to the right walking east); the frame is turned ANG from the LOCAL u axis (the east end swings south).
// Plan figures are the survey drawing's own (x, y), so they read straight off it.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * The SURVEYED PLANS: Architects Design Partnership, "Existing ground and first floor plans, Penrose", 1:100 @ A1,
//     13.02.02 (planning 02/01414/FUL, reference/somerville/20 planning drawings/02_01414_FUL .../05 ...pdf), rendered at
//     150 dpi (59.06 px a metre at 1:100) and read by pixel runs on a metre grid laid over it: every wall line, window
//     mark and door below. Its scale is checked against the LIDAR: the walls' whole length 38.18 m against the roof's
//     40.2 m less the cornice (2 x 0.5) and the LIDAR's blur (about 1 m): agree. The college's own NMLA site plan (2019,
//     folder 13) shows the same outline (the recess of the range behind the wings 0.415 of the wing's depth; 2002: 0.40).
//   * "Existing south-east and south-west elevations, Penrose" (same set, 02/01414/04): the south faces' window columns
//     and the ridges (before the attic was converted: no dormers).
//   * NMLA's north elevation of Penrose with Wolfson in section (2013; reference/somerville/07 .../drawing Penrose north
//     face elevation ...jpg), 47.8 px a metre (checked on Wolfson's tier pitch 2.82 m and its east slab line, which it
//     puts at u -72.3 against Wolfson's -72.2): window columns, sills and heads, the centre bay's hip, the doorcase, the
//     quoins, the four stacks, the pavilion's hip (ridge 11.13, pitch 36 deg).
//   * Figured levels (reference/somerville/20 .../DIMENSIONS.md): first-floor sill 65.53, second-floor sill 68.44, eaves
//     70.54 - 70.70, main ridge 74.27 (NMLA) / 74.24 (Sylva), the wings' ridge 73.57 - 73.61 (Sylva, Clear View), floor at
//     the garden doors 61.90 / 61.91 (Sylva).
//   * LIDAR 2022 (tools/somerville_lidar.py fsec / line / lbox): the place. The range's eaves at v 38.3 / 46.3 (u -69.5)
//     and 38.7 / 46.35 (u -55.5), its ridge at v 42.6 - 42.8; the pavilion's north eaves v 34.2 (u -47.3), the east wing's
//     south eaves v 57.2; the west eaves u -82.6, the east u -42.4; stacks at (-77.5, 42.5), (-70.5, 42.5), (-63.5, 42.5),
//     (-51.5, 43.5), (-47.5, 37.7), (-47.5, 53); ground round it 61.3 - 61.8 (-1.2 .. -0.7).
//   * Photographs (folder 07, 13, 15) for counts and details: Street View inside the college 2015 (the pavilion end and
//     the north range), A Gast 2019 (north face, doorcase close), the college c2021 (north face with the doorcase; the
//     Fellows' Garden face with the loggia), Street View Mar 2026 and S Daniels 2016 (the west end over the street wall),
//     NMLA 2019 (the path between the CHB and Penrose: the south faces); satellite (folder 14) for the dormers.
import { Y } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ frame
export const ANG = (2.0 * Math.PI) / 180;      // K: map w97853758 1.8 - 2.4 deg; LIDAR eaves north 1.6, south 1.9 (+-1 m)
export const U0 = -81.60;                      // LOCAL u of the plan's (0, 0). K: LIDAR west eaves -82.6 .. east -42.4 less cornice and blur, centred
export const V0 = 33.72;                       // LOCAL v of the plan's (0, 0). K: LIDAR range eaves and ridge fitted through the plan (+-0.4);
                                               //   NMLA 2013 site plan: Penrose 4.3 m south of Wolfson's slab end (v 33.8)
// ------------------------------------------------------------------------------------------------ the outline (plan)
// The outer face of the walls, clockwise on the plan (x east, y south: the inside is on the right of each edge), each
// vertex with the name of the face that starts at it. K: ADP 2002 plan (wall lines to +-0.05 m), except where noted.
export const WW = { x0: 0, x1: 7.94, y1: 11.56 };     // the west (Walton Street) cross wing. K
export const RANGE = { y0: 4.65, y1: 11.56 };          // the range: north face, south face. K
export const CB = { x0: 15.68, x1: 22.50, y0: 3.25 };  // the north centre bay (advanced 1.40). K (NMLA elevation 6.9 wide)
export const SP = { x0: 15.55, x1: 22.45, y1: 15.10 }; // the stair block behind it on the south. K
export const EW = { x0: 30.26, x1: 38.18, y1: 21.74 }; // the east pavilion and its wing south along the Fellows' Garden. K
export const EREC = { x: 37.60, y0: 5.10, y1: 15.20 }; // the east face's middle section, set back 0.58 (the loggia's). K: plan; garden photo (quoins either side)
export const OUTLINE = [
  [[0, 0], 'wwN'], [[WW.x1, 0], 'wwE'], [[WW.x1, RANGE.y0], 'rangeNW'], [[CB.x0, RANGE.y0], 'cbW'], [[CB.x0, CB.y0], 'cbN'],
  [[CB.x1, CB.y0], 'cbE'], [[CB.x1, RANGE.y0], 'rangeNE'], [[EW.x0, RANGE.y0], 'ewWN'], [[EW.x0, 0], 'ewN'], [[EW.x1, 0], 'ewEN'],
  [[EW.x1, EREC.y0], 'recN'], [[EREC.x, EREC.y0], 'recE'], [[EREC.x, EREC.y1], 'recS'], [[EW.x1, EREC.y1], 'ewES'],
  [[EW.x1, EW.y1], 'ewS'], [[EW.x0, EW.y1], 'ewWS'], [[EW.x0, RANGE.y1], 'rangeSE'], [[SP.x1, RANGE.y1], 'spE'],
  [[SP.x1, SP.y1], 'spS'], [[SP.x0, SP.y1], 'spW'], [[SP.x0, RANGE.y1], 'rangeSW'], [[0, WW.y1], 'wwW'],
];

// ------------------------------------------------------------------------------------------------ levels
export const FFL = Y(61.90);                   // ground floor -0.60. K: Sylva topo, floor levels at the garden doors 61.90 / 61.91
export const FOOT = -1.75;                     // every wall's foot: 0.55 below the lowest ground at it (-1.2, Walton Street side). K: LIDAR DTM
export const PLINTH = -0.30;                   // top of the dark brick plinth. G: Street View 2015 (a darker base about 0.6 m over the lawn)
export const SILL = { g: 0.25, f: Y(65.53), s: Y(68.44) };   // window sills. K: figured 65.53 / 68.44 (Walton St elevation); ground: NMLA elevation
export const HEAD = { g: 2.10, f: 4.90, s: 7.50 };           // window heads. K: NMLA north elevation (pixel columns, 47.8 px/m)
export const BAND = { y0: 2.56, y1: 2.70, proj: 0.03 };      // a brick plat band at first-floor level. G: Gast 2019 / college c2021 photos (a dark line under the first-floor sills)
export const FRIEZE = { y0: 7.62, y1: 7.92 };                // the cream eaves band under the cornice. K: photographs (college c2021: "stone eaves band"); G: depth
export const EAVES = 8.10;                     // the cornice's top = the roof's eaves line. K: figured 70.54 (west / south) - 70.66 (north): 8.04 - 8.16
export const CORNICE = { proj: 0.50, fascia: 0.20, gutter: 0.11 };   // the white timber cornice. K: LIDAR eaves 0.5 outside the plan's walls; photographs; G: fascia, gutter
export const RIDGE = Y(74.27);                 // the range's ridge +11.77 (and the stair block's, the centre bay's hips). K: NMLA 74.27, Sylva 74.24; LIDAR 74.0 - 74.25
export const WING_RIDGE = Y(73.65);            // the two wings' ridges +11.15. K: Clear View 73.61, Sylva 73.57, NMLA elevation (pavilion hip apex 73.63); LIDAR 73.6 - 74.0
export const HIP_RUN = 4.50;                   // the range's ridge ends over the wings' ridge lines (x 4.0 and 34.2). K: NMLA elevation (main ridge from x 4.0 to the drawing's edge at 34.1)
export const TILE_OV = 0.04;                   // the tiles' lap over the fascia. G

// ------------------------------------------------------------------------------------------------ windows
// Metal multi-pane casements (Crittall type) in plain openings with gauged red-brick flat arches over the ground and first
// floors; the second floor's heads tight under the eaves band. W standard (two casements, four panes across), N narrow (two
// panes). K: NMLA elevation (W 1.0 - 1.05, N 0.53 - 0.55), photographs.
export const WIN = { W: 1.00, N: 0.55, reveal: 0.12, arch: 0.30 };
// Per face: openings along the face's own axis (x for north / south faces, y for east / west), floors 'g' 'f' 's'.
// K: ADP plans (ground and first floor marks), NMLA north elevation, the 2002 SE / SW elevations, the garden photo; where a
// face is seen in no source its windows are G and the face is named in CHECKED.
const all = 'gfs';
export const OPENINGS = {
  wwN: [],                                                                                    // blank: faces Wolfson's south end (both plans: no marks)
  wwE: [{ at: 2.55, w: WIN.W, fl: all }],
  rangeNW: [{ at: 9.95, w: WIN.W, fl: all }, { at: 13.25, w: WIN.W, fl: all }],
  cbW: [], cbE: [],
  cbN: [{ at: 17.05, w: WIN.N, fl: 'g' }, { at: 21.13, w: WIN.N, fl: 'g' }, { at: 17.72, w: WIN.N, fl: 'fs' }, { at: 19.09, w: 1.05, fl: 'fs' }, { at: 20.46, w: WIN.N, fl: 'fs' }],
  rangeNE: [{ at: 24.45, w: WIN.W, fl: all }, { at: 28.30, w: WIN.W, fl: all }],
  ewWN: [{ at: 2.45, w: WIN.W, fl: all }],
  ewN: [{ at: 32.72, w: WIN.W, fl: all }, { at: 35.72, w: WIN.W, fl: all }],
  ewEN: [{ at: 2.55, w: WIN.W, fl: all }],
  recN: [], recS: [],
  recE: [{ at: 6.00, w: WIN.N, fl: all }, { at: 8.10, w: 0.95, fl: 'fs' }, { at: 10.30, w: 0.95, fl: 'fs' }, { at: 12.50, w: WIN.N, fl: 'fs' }, { at: 14.40, w: WIN.N, fl: all }],
  ewES: [{ at: 18.47, w: WIN.W, fl: all }],
  ewS: [{ at: 32.62, w: WIN.W, fl: all }, { at: 35.82, w: WIN.W, fl: all }],
  ewWS: [{ at: 13.30, w: WIN.W, fl: 'fs' }, { at: 15.20, w: WIN.N, fl: all }, { at: 18.90, w: WIN.W, fl: 'fs' }],
  rangeSE: [{ at: 23.20, w: WIN.N, fl: all }, { at: 24.70, w: WIN.N, fl: all }, { at: 26.40, w: WIN.N, fl: all }, { at: 28.00, w: WIN.N, fl: 'fs' }],
  spE: [{ at: 13.30, w: WIN.N, fl: all }],
  spS: [16.2, 17.4, 18.6, 19.8, 21.0].map((x) => ({ at: x, w: 0.50, fl: x === 18.6 ? 'fs' : all })),
  spW: [{ at: 13.30, w: WIN.N, fl: all }],
  rangeSW: [2.07, 6.21, 9.69, 13.98].map((x) => ({ at: x, w: WIN.W, fl: all })),
  wwW: [{ at: 2.45, w: WIN.W, fl: all }, { at: 5.78, w: WIN.W, fl: 'fs' }, { at: 9.11, w: WIN.W, fl: all }],
};
// doors (ground floor, from the floor): the north doorcase, the west door to the walk inside the street wall, the yard
// door on the south, the lobby door on the east wing's west face
export const DOORS = {
  cbN: [{ at: 19.09, w: 1.30, h: 2.55, doorcase: true }],     // K: plan (porch 17.34 - 20.88), photographs; G: the leaf's height
  wwW: [{ at: 5.78, w: 1.00, h: 2.20 }],                      // K: plan (door and steps at y 4.9 - 6.6); G: size
  rangeSE: [{ at: 29.50, w: 0.95, h: 2.20 }],                 // K: 2002 SE elevation (a tall opening at the corner); G: size
  ewWS: [{ at: 16.40, w: 0.95, h: 2.20 }],                    // G: plan (the lobby at y 15 - 16.5)
};
// the doorcase: stone architrave on consoles, a pediment, the panelled double door with an overlight. K: photographs (Gast
// 2019 close, college c2021), NMLA elevation (2.5 m wide over all, apex +3.1); G: mouldings
export const DOORCASE = { w: 2.40, pil: 0.30, proj: 0.16, lintel: 2.45, cornice: 2.62, apex: 3.15, console: 0.55, over: [2.02, 2.40] };
// its steps: three brick steps between low cheeks down to the path. K: plan (porch 17.34 .. 20.88, y 1.63 .. 3.25), Gast 2019
// (steps, black handrail); G: rise
export const PORCH = { x0: 17.34, x1: 20.88, y0: 1.63, cheek: 0.62, landing: 0.55, n: 3 };
// the west door's step platform. K: plan (x -0.93 .. 0, y 4.2 .. 7.3); G: height
export const WSTEP = { x0: -0.95, y0: 4.35, y1: 7.20 };

// ------------------------------------------------------------------------------------------------ the loggia
// three round arches of rubbed brick on brick piers in the east face's middle section, a room behind open to the garden.
// K: college c2021 garden photo (3 arches, rubbed-brick arches, piers, wisteria, a bench inside); plan (the room x 35.3 -
// 37.6); G: the arches' figures scaled off the photograph on the floor heights
export const LOGGIA = { y0: 6.70, y1: 13.20, open: 1.80, pier: 0.55, spring: 1.55, back: 35.30, pierD: 0.45, ceil: 2.60 };

// ------------------------------------------------------------------------------------------------ quoins
// rusticated brick quoin strips at every outer corner: alternate bands of four courses stand proud. K: photographs (every
// salient corner, both faces), NMLA elevation (bands 0.25 high, 0.5 apart, 0.55 wide); G: projection
export const QUOIN = { long: 0.62, short: 0.46, h: 0.27, pitch: 0.50, proj: 0.06 };

// ------------------------------------------------------------------------------------------------ the roof
// hipped clay-tile roofs drawn as the envelope of five hipped boxes over the eaves lines (the plan's walls + 0.5)
export const ROOFS = [
  // the range: ridge east - west at +11.77 from x 4.0 to 34.2, hipped over the wings. K
  { x0: -0.5, x1: EW.x1 + 0.5, y0: RANGE.y0 - 0.5, y1: RANGE.y1 + 0.5, ridge: RIDGE, axis: 'x', ends: ['hip', 'hip'], hipRun: HIP_RUN },
  // the west wing: ridge north - south at +11.15. K (Daniels 2016: a hipped west slope with a dormer and two stacks)
  { x0: -0.5, x1: WW.x1 + 0.5, y0: -0.5, y1: WW.y1 + 0.5, ridge: WING_RIDGE, axis: 'z', ends: ['hip', 'hip'] },
  // the east pavilion and wing: ridge north - south at +11.15. K (Street View: the pavilion's hip, its central stack)
  { x0: EW.x0 - 0.5, x1: EW.x1 + 0.5, y0: -0.5, y1: EW.y1 + 0.5, ridge: WING_RIDGE, axis: 'z', ends: ['hip', 'hip'] },
  // the centre bay's own hip, up to the main ridge. K: NMLA elevation, Gast 2019
  { x0: CB.x0 - 0.5, x1: CB.x1 + 0.5, y0: CB.y0 - 0.5, y1: (RANGE.y0 + RANGE.y1) / 2, ridge: RIDGE, axis: 'z', ends: ['hip', 'open'] },
  // the stair block's hip on the south, up to the main ridge. K: 2002 SE elevation (hip apex at the ridge), satellite
  { x0: SP.x0 - 0.5, x1: SP.x1 + 0.5, y0: (RANGE.y0 + RANGE.y1) / 2, y1: SP.y1 + 0.5, ridge: RIDGE, axis: 'z', ends: ['open', 'hip'] },
];
// stacks: brick, a corbelled cap, pots. K: positions LIDAR + NMLA elevation + Street View / Daniels (two on the west wing);
// G: plan size 1.10 x 0.75, the tops (LIDAR 75.1 - 75.9, NMLA about +13.4)
export const STACKS = [
  { x: 3.97, y: 3.20, top: 13.30, along: 'y' }, { x: 3.97, y: 8.10, top: 13.35, along: 'y' },
  { x: 11.40, y: 8.10, top: 13.35, along: 'x' }, { x: 18.70, y: 8.10, top: 13.40, along: 'x' }, { x: 30.50, y: 8.10, top: 13.35, along: 'x' },
  { x: 34.22, y: 2.90, top: 13.20, along: 'y' }, { x: 34.22, y: 18.30, top: 13.30, along: 'y' },
];
export const STACK = { a: 1.10, b: 0.75, pots: 3 };
// dormers (the 2002 attic conversion and later): small hipped dormers, one casement. K: satellite (count: three on the
// range's south slope west of the stair block, two east of it, one on the west wing's west slope, one on the east wing's
// west slope), Street View 2026 / Daniels 2016 (the west one: three lights); G: positions along the slopes, sizes
export const DORMERS = [
  { face: 'S', at: 6.21, w: 1.20 }, { face: 'S', at: 9.69, w: 1.20 }, { face: 'S', at: 13.0, w: 1.20 },
  { face: 'S', at: 24.70, w: 1.20 }, { face: 'S', at: 28.0, w: 1.20 },
  { face: 'W', at: 5.78, w: 1.70, lights: 3 }, { face: 'EW', at: 16.0, w: 1.20 },
];
export const DORMER = { h: 1.05, sillAbove: 0.25, back: 1.6, rise: 0.45 };
// rooflights on the north slope. K: photographs (college c2021: four flat rooflights); G: positions
export const ROOFLIGHTS = [10.4, 12.8, 25.2, 27.6];
// the small single-storey hipped bay at the east wing's south-west corner. K: NMLA 2019 path photo, 2002 SW elevation; G: size
export const SWBAY = { x0: 28.70, x1: EW.x0, y0: 18.10, y1: 20.90, eaves: 2.05, rise: 0.95 };

// ------------------------------------------------------------------------------------------------ the ground at its walls
// K: photographs (Gast 2019: the asphalt path to the door, shrubs against the range; college c2021: beds and planters; garden
// photo: a flagged strip along the east face); G: widths
export const GROUNDS = {
  bedN: 1.50,                                  // the planting bed against the range's north faces
  pathN: [0.35, 2.00],                         // the asphalt walk along the north front (plan y), from the passage to the pavilion
  passV: 31.80,                                // Wolfson's south link's face (its builder's): the walk runs on to it
  walkW: 1.40,                                 // a paved walk along the west end, the bed beyond it to the street wall
  streetU: -88.40,                             // the street wall's inner face hereabouts (Wolfson's WALL_LINE + 0.55)
  wallLine: [[-88.02, 32.55], [-89.84, 51.11]], wallTh: 0.45,   // touch-up 1: Wolfson's street wall on its registered line (SITE_RING):
                                               // the walk and bed along the west end run to its inner face (streetU no longer used)
  bedS: 1.00,                                  // a bed along the range's south face west of the stair block (NMLA 2019 site plan)
  flagsE: 1.50,                                // flagged strip along the east faces (garden photo)
};

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['outline: west cross wing 7.94 x 11.56, range 6.91 deep set back 4.65, centre bay 6.82 x 1.40, stair block 6.90 x 3.54, east wing 7.92 x 21.74', 'K', 'ADP existing ground and first floor plans 1:100 (02/01414/05, 2002) read by pixel runs; NMLA 2019 site plan'],
  ['place: plan origin (u -81.60, v 33.72), turned 2.0 deg', 'K', 'LIDAR 2022 eaves and ridge fitted through the plan (+-0.4 m); NMLA 2013 site plan (4.3 m south of Wolfson)'],
  ['the west wing\'s north face is 1.9 m south of Wolfson\'s first link (v 31.8): the way between is open at the ground (walk drawn here) and BRIDGED above +1.45 by Wolfson\'s brick link, which runs on to this wing\'s north face (touch-up 1)', 'K', 'plan + LIDAR range fit and LIDAR +8.1 - 9.0 over the strip; NMLA 2013 ground plan (paved way 4.3 m wide south of Wolfson); Street View Mar 2026 (Wolfson west face, Penrose west end); the link is part wolfson\'s'],
  ['floor -0.60 (61.90); walls\' foot -1.75', 'K', 'Sylva topo (floor levels at the garden doors); LIDAR DTM'],
  ['window sills +0.25 / +3.03 / +5.94, heads +2.10 / +4.90 / +7.50', 'K', 'figured sills 65.53 / 68.44 (02/01414 Walton St elevation); NMLA north elevation'],
  ['eaves +8.10, deep white cornice 0.5 proud over a cream eaves band', 'K', 'figured eaves 70.54 - 70.70; LIDAR eaves; photographs'],
  ['cornice fascia, gutter, band depth', 'G', 'judged from photographs'],
  ['ridges: range +11.77, wings +11.15, the range hipped over the wings at x 4.0 and 34.2', 'K', 'NMLA 74.27; Clear View 73.61 / Sylva 73.57 (wings); NMLA elevation (pavilion hip, main ridge line)'],
  ['roof covering: orange-red clay plain tiles', 'K', 'satellite; brief'],
  ['window columns on the north faces, the west end, the range\'s south face, the stair block', 'K', 'ADP plans, NMLA north elevation, 2002 SE elevation, Daniels 2016 / Street View 2026 (west end: three a floor)'],
  ['window columns on the east wing\'s east face', 'K', 'college c2021 garden photo (five columns in the middle section, one each end)'],
  ['window columns on the east wing\'s south and west faces south of the range', 'G', 'ADP first-floor plan marks, 2002 SW elevation; not seen in any look'],
  ['window widths 1.0 / 0.55, metal multi-pane casements painted cream', 'K', 'NMLA elevation; photographs'],
  ['gauged red-brick flat arches over the ground and first floor windows', 'K', 'photographs (Fellows\' Garden c2021, Gast 2019)'],
  ['first-floor plat band', 'G', 'photographs (a dark line, not certain)'],
  ['dark brick plinth to -0.30', 'G', 'Street View 2015'],
  ['rusticated quoin strips at every salient corner', 'K', 'photographs; NMLA elevation; G: projection 0.06'],
  ['north doorcase: stone architrave, consoles, pediment, panelled double door with overlight, three steps between cheeks', 'K', 'Gast 2019 close, college c2021, NMLA elevation, plan (porch)'],
  ['doorcase mouldings, steps\' rise, the handrails', 'G', 'judged from the photographs'],
  ['west door with a step platform', 'K', 'ADP plan; G: its size and the lamp over it (Daniels 2016 shows a wall light near it)'],
  ['loggia: three round arches in the east face\'s set-back middle section, the room behind 2.3 m deep', 'K', 'college c2021 garden photo; ADP plan'],
  ['loggia arch sizes (1.80 open, piers 0.55, spring +1.55)', 'G', 'scaled off the photograph'],
  ['stacks: seven, positions', 'K', 'LIDAR stack cells, NMLA elevation (four on the north), Street View / Daniels (two on the west wing)'],
  ['stacks: plan size, cap, pots, tops', 'G', 'photographs (corniced brick stacks with several pots); LIDAR 75.1 - 75.9'],
  ['dormers: five on the range\'s south slope, one on each wing', 'K', 'satellite (count); Street View 2026 (the west one, three lights)'],
  ['dormers: positions and sizes', 'G', 'satellite (leaning imagery)'],
  ['rooflights: four on the north slope', 'K', 'college c2021 photograph; G: positions'],
  ['small single-storey hipped bay at the east wing\'s south-west corner', 'G', 'NMLA 2019 path photo, 2002 SW elevation; size guessed'],
  ['ground: bed and asphalt walk along the north front, the walk on to the passage by Wolfson', 'K', 'Gast 2019, college c2021, Street View 2015; G: widths'],
  ['ground: walk along the west end, bed to the street wall; bed on the south; flagged strip on the east', 'G', 'NMLA 2019 site plan, garden photo; widths guessed'],
];
