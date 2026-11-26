// Somerville College, STANDALONE model, part 'grounds' (survey G00): THE PLAN of the open ground: the base sheet under
// everything, the Quad (College Quad / Main Quad), the Chapel lawn (Chapel Quad), Park lawn, Penrose lawn, the paths,
// the herbaceous borders, the retaining wall on the Quad's west side, the trees, lamp posts, benches, sculptures and the
// boundary walls no building part builds. Pure data: every figure a named constant with its source and K / G mark; the
// build functions are in _somerville_grounds_build.js. Brief: docs/handoff/somerville/briefs/grounds.txt.
//
// FRAME: LOCAL (u east, v south, y above the datum 62.50 m). The Library front path is authored in the Library's own
// frame (part 'library', _somerville_library_plan.js FRAME: s east along its wing face, t south, -6.0 deg).
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * The 2019 Clear View topographic survey (planning 20/00564, "01 topo survey 300dpi.png" and the CSV of its 341 spot
//     levels already in the LIDAR's frame): the CSV's pixel and LOCAL columns give the sheet's own affine fit (rms 0.04 m
//     against the CSV); the sheet was resampled onto the LOCAL frame at 8 - 25 px a metre and every line read off it:
//     lawn edges, path edges ("Asphalt"), the "Retaining Stone Wall", the brick-sett strip, the beds ("Flowerbed"), the
//     post-and-wire enclosures (temporary, not built), the tree trunks with their canopy circles, two lamp posts ("LP").
//     Positions +-1 m (the sheet was placed on the map by six corners; DIMENSIONS.md).
//   * LIDAR 2022 (tools/somerville_lidar.py; DSM - DTM pictured on the LOCAL frame): canopies and their heights, the
//     step at the retaining wall (61.5 below / 62.15 - 62.2 above), the boundary walls' heights.
//   * The other parts' ground (each part's build run in node with a recording ctx: every drape ring, floor, collider and
//     tree): this part's paths stop exactly at their beds, steps, aprons and walks, and the base sheet is cut under them.
//   * Satellite looks (folder 14), Street View inside the college (June 2015), the photographs in folders 05, 09, 15.
import { Y } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ ground keys
export const LIB_FRAME = [-50, -15.36, 32, -23.98];   // the Library's own frame (part 'library', _somerville_library_plan.js FRAME). K
export const DY = { lawn: 0, path: 0, bed: 0 };   // lifts over the surveyed ground. All 0: the base sheet is CUT where a lawn, path or bed lies, so every patch is drawn once and they meet edge to edge on the same surface (a lift on one side of a shared edge opens a sliver one can see under at a low angle; first shots showed it)
export const BASE_LAYER = 0;          // the base sheet's ground layer: under every other ground key (lawn 3, paths 7, beds 9). G (lead's note)

// ------------------------------------------------------------------------------------------------ the Quad
// The plateau: the Quad's west third is a made level at 62.15 - 62.20 retained by a stone wall (Clear View "Retaining
// Stone Wall"; lawn west third 62.16 - 62.20, by the woodchips bed 62.13 - 62.15); the LIDAR's 2 m grid smears the step.
export const PLATEAU = { y: Y(62.17), fadeV0: 0.5, fadeV: 0.12, fadeU0: -24, fadeU: 0.04 };   // K: Clear View levels; G: the fade south of the wall's end and east of u -24
export const LIB_T = { lawn: 5.0, holtby: 3.6, beds: 2.6, sHoltby: 29.6 };   // Library frame t: the front path t 2.6 .. 5.0 (2.6 = the Library's beds' front, BED_T), t 3.6 .. 5.0 before Holtby (its apron ends at t 3.6). K: library plan + its builder's request (t 2.9 - 4.9); Clear View lawn edge t 3.4 - 4.7
export const SETTS_E = [[-38.43, -16.11], [-36.21, 0.5]];   // the east edge of part 'park''s brick-sett strip. K: park part
export const WALL_LINE = [[-35.0, 0.6], [-35.5, -11.86]];   // the retaining wall's face, south end to the corner with the Library path. K: Clear View wall line u -35.0 .. -35.5; LIDAR step u -35 .. -33
export const DRIVE_W = [[33.83, -4.49], [35.83, -33.04]];   // the west edge of part 'house''s drive (the Quad's north-east). K: house part
export const QUAD_E = [[33.83, -4.49], [34.0, 19.6]];       // the lawn's east edge by the Hall. K: Clear View (u 34 .. 35)
// the cross path along the lawn's south edge (Asphalt), from Wolfson's walk to the Hall: north and south edges
export const CROSS_N = [[-54.55, 21.77], [-40, 21.2], [-37.4, 20.91], [-35.0, 20.65], [-30, 20.1], [-5, 19.7], [34.0, 19.6]];   // K: Clear View (v 20.0 at u -42, 19.6 at u -5; Park lawn 21.3); wolfson's paving corner
export const CROSS_S = [[-54.55, 23.6], [-40, 23.1], [-30, 22.4], [-5, 22.0], [33.0, 22.0]];                                       // K: Clear View (22.6 at u -46, 22.0 at u -15; Chapel lawn north edge 21.5 - 22.1)
export const WEST_PATH = [[-38.79, 0.84], [-36.21, 0.5], [-35.0, 0.6], [-35.0, 20.65], [-37.4, 20.91]];   // the path between the Quad and Park lawn. K: Clear View (two edges u -37.8 / -35.9 at v 5, -37.0 / -35.3 at v 20)
// the east walk: past the Hall's front beds, the loggia flags and down Maitland's west beds (part 'hall''s rings)
export const EAST_WALK = [[33.83, -4.49], [40.12, -3.525], [40.12, -3.33], [39.11, 7.53], [40.58, 7.66], [40.42, 9.46], [38.94, 9.32], [37.93, 20.17], [37.92, 20.29], [37.38, 26.03], [36.26, 26.04], [35.48, 25.97], [34.67, 34.68], [33.65, 45.58], [32.81, 54.64], [30.31, 54.4], [31.15, 45.4], [32.17, 34.5], [32.98, 25.8], [33.0, 22.0], [34.0, 19.6]];   // K: hall part (beds, flags), house drive; G: one width to the beds (the looks: tarmac to the Hall's beds)
export const SE_PATH = [[30.31, 54.4], [32.81, 54.64], [47.4, 56.0], [47.4, 58.3], [30.1, 56.7]];   // along Maitland's south end towards the Hodgkin Quad. K: Clear View "Hedge 1.2m High" path to the M.T.C.; G: line and width
export const SE_HEDGE = { line: [[33.2, 57.5], [47.2, 58.8]], h: 1.2, w: 0.7 };   // K: Clear View "Hedge 1.2m High"; G: line
// the Chapel lawn's west side: the north - south path between two herbaceous borders, to the Chapel forecourt (part 'chapel')
export const NS_PATH = { u0: -11.6, u1: -9.4, v1: 52.2 };   // K: Clear View (two edges and the hedges either side), photographs (Halling 2025); chapel's forecourt u -11.6 .. -5.1 from v 52.2
export const BORDER_W = { u0: -16.0, u1: -11.6, v1: 39.6 };   // the west border down to the Fellows' Garden wall (part 'chapel', v 39.6). K: Clear View "Flowerbed"; G: its west edge
export const BORDER_E = [[-9.4, null], [-4.5, null], [-4.5, 40.0], [-4.0, 41.0], [-4.0, 52.2], [-9.4, 52.2]];   // (null = on the cross path's south edge). K: Clear View bed edge (u -4.6), the shrub mass at v 41 - 53
export const CHAPEL_N_PATH = [[-4.0, 49.6], [30.76, 49.6], [30.52, 52.1], [-1.0, 52.1], [-1.0, 54.8], [-5.1, 54.8], [-5.1, 52.2], [-4.0, 52.2]];   // the path along the Chapel's north side (the yew hedge v 52.1 .. 53.3 is part 'chapel''s). K: Clear View (path 62.29 - 62.48 at v 46.5 - 51.5); G: width
export const SE_GARDEN = [[20.7, 52.1], [30.52, 52.1], [30.31, 54.4], [30.1, 56.7], [47.4, 58.3], [47.4, 63.35], [20.71, 62.53]];   // a lawn south of Maitland and east of the Chapel. G (no look; LIDAR open ground with two trees)
// Park lawn: the walk along Park's south face (its colliders) and down Wolfson's beds; the lawn inside
export const PARK_WALK = [[-38.87, 0.25], [-45.96, 1.19], [-46.14, -0.15], [-59.1, 1.58], [-59.1, 21.8], [-57.2, 21.8], [-57.2, 3.9], [-38.67, 2.6], [-38.79, 0.84]];   // K: Clear View path edges (v 3, u -58.5), park's south face, wolfson's bed edge u -59.1
// Penrose lawn: from the cross path to Penrose (its faces and its north walk) and the Fellows' Garden wall
export const PENROSE_LAWN = [[-54.55, 23.6], [-40, 23.1], [-30, 22.4], [-16.0, 22.176], [-16.0, 39.6], [-42.1, 39.6], [-41.94, 35.1], [-43.44, 35.05], [-51.36, 34.78], [-51.4, 34.4], [-59.0, 34.4], [-59.0, 23.62]];   // K: penrose, wolfson, chapel parts' lines; Clear View
// beds and the shrub border in the lawns
export const WOODCHIP_BED = { arm: [[-34.75, -11.0], [-31.75, -11.0], [-31.75, -0.75], [-34.75, -0.75]], topT: [5.4, 6.8], topS: [14.6, 25.0] };   // the L-shaped shrub bed inside the wall. K: Clear View (dotted planting)
export const PENROSE_SHRUBS = [[-53.6, 34.2, 2.4, 0.7], [-44.5, 33.9, 3.6, 0.8], [-35.5, 34.0, 2.8, 0.8], [-27.5, 34.4, 3.0, 0.8], [-20.5, 34.6, 2.0, 0.7]];   // [u, v, half-length, half-width]: the shrub ovals along the lawn's south side. K: Clear View
export const CHAPEL_BEDS = [[25.4, 38.0, 4.5, 3.0], [27.0, 45.5, 3.0, 2.0]];      // [u, v, half-length, half-width] flower beds in the lawn's east part. K: Clear View ("flower beds" 62.45 - 62.73, dashed outline u 19 .. 31, v 35 .. 52); G: shapes

// ------------------------------------------------------------------------------------------------ trees
// [u, v, height, crown radius, kind]: kind 'city' = the city's tree model (K.tree), 'cedar' = drawn here (blue-grey tiers)
export const TREES = [
  [16.8, -7.8, 15.7, 7.8, 'cedar'],      // 984 / 33 Atlas cedar. K: Clear View trunk (16.3, -7.8), LIDAR crown peak 15.7 at (18.5, -7.5), crown 7.8
  [34.6, -13.5, 12.0, 4.0, 'city'],      // NE corner (987 common lime?). K: Clear View trunk and canopy; G: height (the crown merges with the drive's)
  [-20.1, 18.2, 16.0, 6.0, 'city'],      // the big tree at the lawn's south-west (979 tulip tree, braced). K: Clear View trunk, LIDAR 16.0
  [-2.3, 17.8, 10.4, 4.0, 'city'],       // 980 sweetgum. K: Clear View trunk, LIDAR 10.4
  [18.0, 18.4, 13.5, 5.6, 'city'],       // 982 / 983 maple. K: Clear View trunk, LIDAR 13.5
  [30.0, 17.6, 7.0, 2.5, 'city'],        // small tree by the east walk. K: Clear View trunk and canopy; G: height
  [8.1, 17.6, 3.5, 1.0, 'city'],         // young tree in the post-and-wire bed. K: Clear View; G: height
  [-28.5, 5.2, 4.0, 1.2, 'city'],        // young tree with its support ("Tree Support", "Woodchips"). K: Clear View; G: height
  [-28.0, -7.5, 4.0, 1.0, 'city'],       // young tree. K: Clear View; G: height
  [-33.0, 14.8, 4.5, 1.6, 'city'],       // small tree / shrub. K: Clear View dotted canopy; G: height
  // Park lawn (974 Sargent cherry, 975 medlar, 976 black mulberry, 977 Erman's birch, 978 sweetgum: which is which G)
  [-54.3, 9.7, 9.0, 4.8, 'city'], [-40.4, 5.9, 9.0, 5.0, 'city'], [-40.2, 15.6, 10.0, 6.5, 'city'], [-55.0, 17.8, 7.0, 3.5, 'city'], [-44.5, 17.5, 8.6, 5.0, 'city'],   // K: Clear View trunks and canopies; LIDAR 8 - 9 m (DIMENSIONS.md)
  // Penrose lawn (970 / 972 dove trees, 971 Japanese red cedar)
  [-42.6, 36.6, 10.0, 2.6, 'city'], [-30.6, 36.8, 11.0, 2.8, 'city'],     // K: Clear View trunks; G: heights (LIDAR crowns there 10 - 12 m, merged with the wall)
  // Chapel lawn (G1 Chinese mountain ash x3, 964 magnolia, 969 Judas tree, 965 Abies)
  [28.3, 26.7, 6.0, 1.8, 'city'], [25.7, 29.0, 6.0, 1.8, 'city'], [29.3, 30.7, 6.0, 1.8, 'city'],      // K: Clear View; G: heights
  [15.7, 45.1, 5.5, 1.5, 'city'], [21.3, 48.3, 5.0, 1.5, 'city'], [-3.2, 45.9, 7.0, 2.5, 'city'],     // K: Clear View; G: heights
  // south-east garden
  [30.5, 60.2, 11.0, 2.0, 'city'], [38.4, 56.8, 10.5, 1.8, 'city'],     // K: LIDAR blobs (std 2.7 / 1.6); G: kinds
  // the Library's two magnolias (985 / 986 Magnolia grandiflora, braced against the wall): Library frame s 42 and 63.5, t 1.8
  ['lib', 42.0, 9.5, 3.2, 'city'], ['lib', 63.5, 9.5, 3.2, 'city'],     // K: the Library builder's positions, photo c2021; G: size (LIDAR merges them with the loggia)
  // by St Paul's and the Walton Street gate (part 'park' plants none)
  [-88.7, -15.0, 9.5, 3.0, 'city'], [-76.5, -13.8, 12.0, 2.5, 'city'], [-67.1, 2.1, 11.9, 2.8, 'city'], [-47.8, -20.5, 11.6, 1.8, 'city'],   // K: LIDAR canopy blobs (std 1.1 - 2.8); G: kinds
];

// ------------------------------------------------------------------------------------------------ lamps, benches, sculptures
export const LAMP_H = 3.5;   // black cast-iron posts with a tapering lantern. K: photographs (Halling 2025: about twice a person); G: figure
export const LAMPS = [
  [-35.6, 22.9, 'K'], [-19.9, 22.7, 'K'],                     // Clear View "LP"
  [-4.2, 22.4, 'G'], [12.0, 22.4, 'G'], [28.0, 22.4, 'G'],      // along the cross path's south side (photograph Halling 2025: on that side)
  [-9.15, 31.0, 'G'], [-9.15, 44.0, 'G'],                       // the north - south path's east side (photograph Halling 2025)
  [34.4, 3.0, 'G'], [34.4, 14.5, 'G'], [30.0, 33.0, 'G'], [29.6, 46.0, 'G'],   // the east walk (looks: lamp posts along it)
  [-37.9, 11.0, 'G'], [-57.0, 12.5, 'G'],                       // Park lawn (Brigade Piron 2009: posts by Park lawn)
  [6.0, 49.4, 'G'], [21.0, 49.4, 'G'], [40.0, 57.9, 'G'],
  ['lib', 40.0, 'G'], ['lib', 62.0, 'G'], ['lib', 82.0, 'G'],    // the Library path, lawn side (Library frame s; t 5.25)
];
// benches [u, v, facing (deg, 0 = facing +v / south), length]
export const BENCHES = [
  ['lib', 35.0, 1.8], ['lib', 50.0, 1.8], ['lib', 56.0, 1.8], ['lib', 72.0, 1.8],   // on the lawn's edge along the Library path, facing the lawn. K: photo c2021, satellite (benches by the path); G: places
  [2.0, 48.6, 180, 1.8], [10.0, 48.6, 180, 1.8], [24.0, 48.6, 180, 1.8],              // the Chapel lawn's south side facing the lawn. K: Street View 2015 (benches on the Chapel lawn); G: places
  [-3.7, 30.0, 270, 1.8], [-3.7, 36.0, 270, 1.8],                                     // by the north - south path. K: photograph Halling 2025; G: places
  [-50.0, 21.0, 180, 1.8], [-46.0, 4.6, 0, 1.8],                                      // Park lawn. K: Gast 2019 (benches); G: places
  [33.4, -12.0, 90, 1.8],                                                             // by the east walk (satellite). G
];
export const SCULPTURES = {
  steel: { u: 24.0, v: 9.0 },          // the steel piece on the lawn's south-east part. K: look (Hall / loggia / Maitland view); G: place and form
  triad: { u: 22.5, v: 33.5 },         // "Triad" on the Chapel lawn. K: Clear View symbol at (22.5, 33.5) (the map's point (25, 31)); G: form
  ellipse: { u: 2.0, v: -11.5 },       // the elliptical piece near the Library. G: place and form (the map's point is wrong)
};

// ------------------------------------------------------------------------------------------------ boundary walls no part builds
// [name, LOCAL line, height over the ground, key, coping key, thickness] (feet 0.5 m into the ground; railings: see build)
export const WALLS = [
  ['Oratory side, south of Darbishire\'s south court', [[111.1, 17.8], [102.35, 16.61], [95.7, 15.4]], 2.8, 'rubble', 'bathDress', 0.4],   // K: LIDAR +2.5 .. +2.9 on the line; G: material
  ['Oratory side, south of the Traffic Quad', [[87.8, 13.9], [86.11, 13.54], [82.98, 12.88], [70.42, 9.4]], 2.5, 'brick', 'bathDress', 0.35], // K: LIDAR +1.1 .. +2.8 (buildings behind); G: material, height
  ['Little Clarendon Street backs, south of the Chapel lawn garden', [[20.71, 62.53], [47.9, 63.36]], 2.2, 'brick', 'bathDress', 0.35],       // K: LIDAR (shop backs 2 - 12 m, open 0.6 - 1.5 at u 41 - 46); G: wall, height
  ['the shops\' yards behind the Catherine Hughes yard', [[-50.86, 80.07], [-52.3, 80.11], [-52.44, 75.42], [-56.52, 75.35], [-56.46, 79.98], [-57.99, 79.97], [-58.06, 75.56], [-62.06, 75.54], [-61.91, 79.64]], 2.4, 'brick', 'bathDress', 0.3],   // K: LIDAR +2.4 .. +3.7 on the line; G: material
];
export const NORTH_RAIL = { line: [[-74.2, -29.5], [-70.49, -30.43], [-48.6, -29.9]], wallH: 0.6, railH: 1.8 };   // the north boundary behind Park: LIDAR finds nothing over 0.2 m on the line, so a low wall and railings. G
export const RETAIN = { th: 0.4, foot: 0.5, minH: 0.04 };   // the retaining wall: thickness, feet, the least height drawn. K: Clear View (a wall, double line); G: thickness

export const CHECKED = [
  ['the base sheet: the whole site inside SITE_RING on the surveyed ground (LIDAR 2022 DTM, 2 m grid), gravel on the lowest ground layer, cut exactly (polygon clipping) wherever this part lays a lawn, path or bed and wherever another part draws its own ground', 'K', 'LIDAR 2022; the other parts\' rings (recorded from their builds, inset 0.1 m)'],
  ['the Quad: ONE lawn about 71 by 36 - 40 m, north edge on the Library path (Library frame t 5.0), east edge u 33.8 - 34.0, south edge v 19.6 - 20.1, west on the retaining wall and the path to Park lawn', 'K', 'Clear View 2019 topo resampled; satellite; the Library, house and park parts\' lines'],
  ['the Quad\'s west third a made level at 62.17 retained by a stone wall 0.3 - 0.65 high along u -35 .. -35.5 and along the Library path past Holtby', 'K', 'Clear View "Retaining Stone Wall", levels 62.13 - 62.20 above, 61.5 - 61.6 below; LIDAR step'],
  ['the retaining wall\'s thickness 0.4 and stone coping; the fade of the made level south of v 0.5 and east of u -24', 'G', 'judged'],
  ['brick setts between part park\'s strip and the retaining wall', 'K', 'Clear View "Brick Setts" (the strip runs to the wall)'],
  ['paths: asphalt; Library front t 2.6 .. 5.0 (3.6 .. 5.0 before Holtby); cross path v 19.6 .. 23.6 from Wolfson\'s walk to the Hall; path to Park lawn; east walk to the Hall\'s beds and Maitland\'s beds; north - south path u -11.6 .. -9.4 to the Chapel forecourt; path along the Chapel\'s north side', 'K', 'Clear View ("Asphalt", edges); photographs Halling 2025; looks'],
  ['the east walk one surface from the lawn to the Hall\'s beds (5 m) and the path south of Maitland to the Hodgkin Quad', 'G', 'looks; Clear View hedge note'],
  ['the herbaceous borders either side of the north - south path, the shrub bed inside the retaining wall, the shrub ovals on Penrose lawn, flower beds on the Chapel lawn: low clumps and flower cells', 'K', 'Clear View "Flowerbed" and dotted planting; LOOKS_BY_HAND herbaceous border; photographs'],
  ['the planting itself (clump sizes, colours, density)', 'G', 'judged from the photographs'],
  ['Park lawn with its walk along Park and down Wolfson\'s beds; Penrose lawn from the cross path to Penrose and the Fellows\' Garden wall', 'K', 'Clear View; park, wolfson, penrose, chapel parts\' lines'],
  ['the garden south of Maitland and east of the Chapel: lawn, two trees, a 1.2 m hedge', 'G', 'LIDAR open ground and canopies; Clear View hedge note'],
  ['trees: 31 trunks from the Clear View topo and LIDAR canopies, heights from LIDAR where it sees them', 'K', 'Clear View 2019; LIDAR 2022; DIMENSIONS.md "Trees"'],
  ['tree heights where LIDAR merges crowns, species per trunk (the survey numbers name the species but not which trunk)', 'G', 'DIMENSIONS.md "Trees"'],
  ['the blue Atlas cedar drawn as tiered blue-grey plates (the city tree model takes no tint)', 'K', 'photograph c2021, Brigade Piron 2009 (tiered blue-grey crown); LIDAR 15.7 m, crown 7.8'],
  ['lamp posts: two from the topo ("LP"), the rest along the paths where the looks show posts', 'K', 'Clear View "LP"; photographs'],
  ['lamp post places other than the two in the topo; height 3.5', 'G', 'photographs (posts along every path)'],
  ['benches: along the Library path, on the Chapel lawn, by the north - south path, on Park lawn', 'G', 'photographs and satellite show benches there; places judged'],
  ['sculptures: the steel piece on the lawn\'s south-east, "Triad" on the Chapel lawn, the elliptical piece by the Library, as plain abstract forms', 'G', 'looks; Clear View symbol for Triad\'s place'],
  ['boundary walls where no part builds one: rubble and brick 2.2 - 2.8 m on the Oratory side and the Little Clarendon Street backs, the shops\' yards, a low wall and railings behind Park on Loverose Way', 'G', 'LIDAR heights on the lines; looks for Loverose Way'],
  ['no lawn, path or bed drawn inside the courts the building parts own; no tree in the Traffic Quad', 'K', 'the parts\' rings (recorded)'],
];

// THE OTHER PARTS' OWN GROUND (OTHERS_GROUND, OTHERS_KEEP) is in the GENERATED file _somerville_grounds_others.js
// (tools/somerville_ground_rings.mjs re-records it from the parts' builds).
export { OTHERS_GROUND, OTHERS_KEEP } from './_somerville_grounds_others.js';
