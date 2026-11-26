// Somerville College, STANDALONE model, part 'house' (survey B02): THE PLAN of House (Walton House, about 1826, raised and
// extended 1881 and 1895), the Hostel (the 1950 brick range and the older stone-and-brick range east of it), the triple
// brick ARCHWAY to the Quad (Morley Horder, 1935 / 1938) and the Traffic Quad. Pure data: every dimension a named
// constant with its source and K / G mark; the build functions are in _somerville_house_build.js. Brief:
// docs/handoff/somerville/briefs/house.txt.
//
// THE PART'S OWN FRAME. Everything is authored in (s, y, t): S.ownFrame(...FRAME) runs s "EAST" along the north face of
// House's main block and on along the Hostel (6.0 deg clockwise of the LOCAL u axis: the map's House north face 6.1, the
// Hostel 6.2, the topographic survey's south face of the main block 6.4), t "SOUTH" across it, y above the datum
// (62.50 m). Its origin is the main block's north-west corner.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * The 2019 topographic survey (planning 20/00564/FUL, Clear View, AOD; its CSV in the LIDAR's frame): the PARAPET
//     line of the main block's south face from (40.1, -16.2) to (49.5, -15.2) at 73.17 - 73.21 (+10.7), and the line of
//     the 1881 wing's west face from (49.7, -14.8) to (49.5, -8.5) (both read off the 300 dpi render with the survey's
//     own fit, +-0.5 m). The main block's south-west corner is the frame's (0, 16.3).
//   * The surveyed WEST ELEVATION of the main block (planning 16/00283/FUL, ADP 2016, "existing elevations and sections",
//     1:50; scaled with the survey's parapet +10.72 over the drive +0.85 = 29.7 px a metre on the render, +-0.1 m): the
//     front 16.05 m long, every opening, the stack, the dormers, the porch, the single-storey brick bay.
//   * LIDAR 2022 in the frame (fbox): the main block's slate mansard top +15.0 (edges +12.6 .. 12.9), the 1881 wing's
//     ridge +13.9 .. 14.0 at t 19 - 20 and its stacks (+16.8, +16.2), the east part's N - S ridge +14.1 at s 16 - 17, the
//     north-east block's E - W ridge +13.7 .. 13.9 at t 3.5 - 4.5 with a stack +16.6, the one-storey link +3.2 .. 4.6,
//     the Hostel's flat roof +9.6, its east range +9.0 .. 10.5 (a peak +12.1), the archway block +7.9 .. 8.3, the
//     balcony over the Traffic Quad door +3.6 .. 5.3. The LIDAR's roof edges stand 0.5 - 1.5 m outside the survey's
//     walls all round (the 1 m cells and the lean), so faces are taken from the survey / map and the LIDAR's edges less
//     about 0.7 m.
//   * Photographs: "02 House (Walton House) west front ..." (Piron 2014), "02 Walton House south-west front ..." (Street
//     View Jun 2015), "02 Traffic Quad looking south-west ... clock cupola ..." (Gast 2019), "02 Traffic Quad looking east
//     ..." (Halling 2025), "02 plain brick range over an open ground floor ..." (c2022), "02 north boundary on Loverose
//     Way ..." (Street View Aug 2024), "03 archway ... painted arms panel, from the east" and "03 archway under the
//     Hall-House link ..." (Halling 2025), "03 Hall west front close at its north end ..." (Street View 2015); the
//     satellite looks (folder 14: clay tiles on the wings and the Hostel's east range, slate mansard, pale flat roof).
import { ownFrame } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ frame
export const FRAME = [41.80, -32.41, 71.64, -29.27];   // LOCAL (u, v) -> (u, v), 6.0 deg. K (see above)
export const F = ownFrame(...FRAME);

// ------------------------------------------------------------------------------------------------ levels
export const DRIVE = 0.85;          // the drive at the porch. K: survey 2 (63.35), DTM 0.8 - 0.9
export const FOOT_M = 0.55;         // every wall goes this far below the lowest surveyed ground at its foot. K: house rule
export const DY = 0.08;             // paving and tarmac laid this much over the surveyed ground. K: house rule

// ------------------------------------------------------------------------------------------------ THE MAIN BLOCK (about 1826; roof raised 1895)
export const MAIN = {
  s0: 0.0, s1: 13.0, t0: 0.25, t1: 16.3,   // K: survey (SW corner, south face), west elevation 16.05 m long; east face LIDAR
                                    // mansard edge s 13.5 less 0.5; north face G (LIDAR edge t -1 .. -0.5, the map 0.7)
  ffl: 0.95,                        // ground floor. K: west elevation (the porch's door sill at the drive +0.85, one step)
  parapet: 10.72,                   // K: survey 73.21 / 73.17
  cornice: { top: 9.94, h: 0.3, proj: 0.28 },   // K: west elevation (the band under the parapet); profile G
  band: { top: 4.9, h: 0.2 },       // the stone string between the floors. K: west elevation, Piron 2014
  winG: { w: 1.25, sill: 1.52, head: 4.55 },    // the ground-floor sash on the front (very tall). K: west elevation
  winF: { w: 1.0, sill: 6.24, head: 8.66, arch: 0.14 },   // first-floor sashes in eared stone architraves. K: west elevation
  front: { first: [1.13, 3.42, 8.36], tri: 12.61, triW: [0.55, 1.1, 0.55], ground: [8.48] },   // (t) K: west elevation
  strip: { t0: 5.27, t1: 6.98, proj: 0.12, bricks: [5.3, 6.0, 6.9, 7.6, 8.5, 9.2] },   // the projecting strip with red-brick
                                    // bands under the front stack. K: elevation (strip), Piron 2014 (red bands); band heights G
  mansard: { inset0: 0.3, kerb: 12.85, inset1: 1.25, top: 15.0 },   // slate mansard: steep slope to a kerb, hipped above.
                                    // K: LIDAR (edges 12.6 - 12.9, middle 15.0 - 15.2), elevation (kerb 12.8); inset G
  dormersW: [[1.43, 5.37, 5], [8.5, 13.45, 6]],   // the two long white dormers on the front [t0, t1, lights]. K: west elevation
  dormersN: [[4.0, 8.0, 5]],        // the north slope's five-light dormer [s0, s1, lights]. K: PHOTO_NOTES (ROQ lane look); place G
  dormersS: [[2.0, 6.0, 4]],        // G: seen in no look
  dormer: { sill: 10.85, head: 12.4 },   // K: west elevation
  north: [2.5, 6.5, 10.5],          // (s) window columns on the north face. G: against ROQ East, seen in no look
  east: [2.0, 5.2],                 // (t) first-floor windows on the east face over the one-storey link. G
  south: { first: [2.2, 6.4], triW: 2.4 },   // (s) the south face: a sash and a three-light window over the lean-to. K: Street View
                                    // 2015 (three-light window); places G
  lean: { s0: 3.5, s1: 9.9, t1: 18.5, top: 4.0, wins: [4.9, 6.6, 8.3] },   // single-storey projection on the south face, lead roof.
                                    // K: Street View 2015 ("Hall west front close ..."); sizes G
  quoinsSW: true,                   // rusticated stone quoins at the south-west corner. K: west elevation, Piron 2014
  stacks: [[-0.12, 0.98, 5.81, 6.88, 15.2], [3.0, 4.1, 0.25, 1.2, 15.4], [2.8, 3.9, 15.35, 16.3, 15.4], [11.6, 12.7, 15.35, 16.3, 15.4]],   // [s0, s1, t0, t1, top]
                                    // K: elevation (the front stack, 1.07 wide, cap +15.2); LIDAR peaks for the rest; sizes G
};
// THE BRICK BAY on the front's north end ("the bulge"): drawn as the 2016 survey and the 2014 / 2015 photographs show it.
// Planning 16/00283/FUL (2016) sought its demolition and a new single-storey bay window / entrance in its place: whether
// and how that was built is not in the sources (QUESTION for a look on site).
export const BAY = {
  s0: -4.7, t0: 0.25, t1: 5.81, top: 4.8,   // K: elevations 2, 1, 3 and sections AA / BB (16/00283): 5.56 along the front, 4.5 - 4.7 deep, parapet 3.95 over the ground
  door: [1.0, 2.27],                // a door with a round-arched fanlight at its north end (t). K: elevation 2
  wins: [[2.44, 3.47], [3.68, 4.72], [4.97, 5.6]],   // mullion-and-transom windows on its west face (t). K: elevation 2
  winsN: [-3.6, -1.6],              // (s) two windows on its north face. K: elevation 1 (places G)
  sill: 1.52, head: 3.75, transom: 2.95,   // K: elevation 2 (+-0.1)
};
export const PORCH = { t0: 10.69, t1: 14.49, proj: 0.8, ent: 4.25, cornice: 4.65, apex: 5.63, door: [11.53, 13.72], doorTop: 4.05 };   // the stone
                                    // pedimented porch with glazed doors. K: elevation 2 (front, heights), Piron 2014; projection G

// ------------------------------------------------------------------------------------------------ THE EAST PART (Traffic Quad side, clock cupola)
export const EAST = {
  s0: 13.0, s1: 22.0, t0: 7.5, t1: 15.6,   // K: LIDAR (ridge N - S at s 16 - 17, east edge s 22 .. 23 with the balcony bump)
  ffl: 1.15, eaves: 11.8, ridge: 14.1, ridgeS: 17.5,   // K: LIDAR eaves 11.4 - 12.0 (edge cells), ridge 14.1; Gast 2019 (bay eaves +12.6 scaled); G: ffl
  bands: [4.75, 8.5],              // red-brick bands at the floors. K: Gast 2019 (on the wing beside it); G here
  side: [8.6, 14.8],                // (t) window columns either side of the entrance bay. G (Gast shows the north one)
  bay: { t0: 9.7, t1: 13.9, proj: 0.3 },   // the entrance bay. K: Gast 2019 (scaled 34 px/m), LIDAR balcony bump t 10 - 13
  door: { w: 1.3, spring: 3.3, sill: 1.15 },   // round-arched stone doorway with cream doors. K: Gast; sizes G
  balcony: { y: 4.9, rail: 5.85, proj: 0.85, w: 3.0 },   // balustraded stone balcony on brackets. K: Gast; LIDAR +3.6 .. 5.3; sizes G
  door1: { w: 1.1, sill: 4.95, spring: 7.4 },   // round-headed window door onto the balcony. K: Gast; G sizes
  win2: { w: 1.2, sill: 9.0, head: 10.6 },       // K: Gast; G sizes
  gable: { apex: 13.7 },            // the cross gable over the bay. K: Gast (gable with a finial behind the cupola); G apex
  cupola: { s: 19.9, t: 11.8, base: 1.3, y0: 13.4, y1: 14.4, post: 15.4, cap: 15.65, top: 16.2 },   // the small white timber
                                    // clock cupola. K: Gast 2019, PHOTO_NOTES ("a small timber cupola with a clock face"); sizes G
  win: { g: [1.9, 3.7], f: [5.2, 7.4], s: [8.9, 10.5], w: 1.1 },   // G: storey heights from the eaves and Gast
};

// ------------------------------------------------------------------------------------------------ THE NORTH-EAST BLOCK (1895, Walter Lane) and the one-storey link
export const NE = {
  s0: 18.0, s1: 29.3, t0: 0.75, t1: 7.5,   // K: LIDAR (ridge t 3.5 - 4.5, south edge t 7.5, east end s 29.5 .. 30); north face the map (t 0.75)
  ffl: 1.15, eaves: 11.0, ridge: 13.9,     // K: LIDAR eaves 11.0 - 11.2, ridge 13.7 - 13.9
  wins: [23.4, 25.6, 27.8],         // (s) south face window columns. K: Gast (three seen); places G
  dormers: [24.5, 27.2],            // gabled dormers on the south slope. K: Gast; places G
  stack: [22.0, 23.3, 3.3, 4.6, 16.4],   // K: LIDAR peak 16.6
};
export const LINK = { s0: 13.0, s1: 18.0, t0: 0.25, t1: 7.5, top: 4.4 };   // the one-storey link between the main block and the NE
                                    // block. K: LIDAR +3.2 .. 4.6; faces G (seen in no look)

// ------------------------------------------------------------------------------------------------ THE 1881 WING (T. G. Jackson), south-east towards the Hall
export const WING = {
  s0: 9.9, s1: 28.0, t0: 15.6, t1: 23.0,   // K: survey west face s 9.7 - 10.2; LIDAR (south edge t 23, east edge s 28.5, ridge t 19.3)
  ffl: 1.0, eaves: 11.2, ridge: 14.0,      // K: LIDAR 13.9 - 14.0; Gast (eaves band at the gable shoulders) G +-0.3
  bands: [4.3, 7.4, 9.7],           // brick bands on the stone gables. K: Gast 2019 (scaled by its horizon: 51 px/m at the gable)
  eastWins: { g: [19.4, 1.2, 1.7, 3.75], g2: [17.4, 0.5, 1.9, 3.75], f: [17.4, 0.6, 5.3, 6.7], s: [17.4, 0.6, 8.05, 9.4], gable: [19.3, 0.35, 11.7, 12.4] },   // [t, w, sill, head].
                                    // K: Gast 2019; G +-0.3
  westBay: { t: 19.3, w: 2.0, proj: 0.9, top: 8.1 },   // the two-storey canted bay under the west gable. K: LOOKS_BY_HAND; sizes G
  south: [11.6, 13.4, 20.4, 23.0, 25.6],   // (s) window columns on the south face (brick with stone dressings, round-headed
                                    // ground windows, a dentil band at the first floor). K: "03 archway ... from the east"; places G
  north: [24.0, 26.4],              // (s) north face windows towards the Traffic Quad recess. G
  stacks: [[14.0, 15.2, 20.6, 21.7, 16.8], [22.0, 23.2, 20.4, 21.5, 16.4]],   // K: LIDAR peaks 16.8, 16.2; Gast (tall brick stack south of the apex)
};

// ------------------------------------------------------------------------------------------------ THE ARCHWAY (Morley Horder, 1935 / 1938)
// The block bridging the drive between the 1881 wing and the kitchens (LIDAR +7.9 .. 8.3 at s 15 - 19, t 23.5 - 28.5).
// Its south part (t 26.0 .. 28.85) was built by part 'hall' (its KIT.link) before the archway was found to pass under it:
// this part builds the north part, the whole east SCREEN and the passage; see the report for the junction.
export const ARCH = {
  s0: 14.8, s1: 18.3, sScreen: 19.2, t0: 23.0, t1: 26.0, tK: 28.85,   // K: LIDAR; the hall part's box (s 14.8 - 18.3 from t 26.0);
                                    // the kitchens' north face (the hall part's KIT ring) t 28.85
  top: 8.1, roof: 7.5,              // K: LIDAR; the hall part's link top 8.1
  // the screen across t 23.0 .. 28.85 (5.85 m), proportions from the photograph square on (Halling 2025: 990 px): K for the
  // pattern (wide middle arch, two narrow side arches with cream doors in recesses, three rubbed-brick rings, a brick key,
  // a painted arms panel in a stone frame), G for the figures (+-0.15)
  jamb: 0.4, side: 0.7, pier: 0.6, mid: 2.45,
  spring: 1.65, sideSpring: 1.8, ring: 0.6, recess: 0.85,
  key: { y0: 2.85, y1: 3.55, w0: 0.38, w1: 0.6 },
  panel: { y0: 3.75, y1: 5.35, w: 1.3 },
  coping: 0.12,
};

// ------------------------------------------------------------------------------------------------ THE HOSTEL
export const HOSTEL = {   // the plain brick range (Geddes Hyslop, 1950): three storeys, flat roof behind a parapet, a corbelled
                          // band over an open ground floor. K: photographs c2022, Gast 2019, Halling 2025; LIDAR flat +9.6
  s0: 29.3, s1: 46.0, t0: 0.8, t1: 7.6,    // K: LIDAR (flat roof s 28 - 45, south edge t 7.5), map north face t 0.8 - 0.85
  ffl: 1.1, parapet: 10.0, roof: 9.6,
  band: { top: 4.0, h: 0.38 },      // the corbelled (dentilled) brick band at the first floor. K: photograph c2022
  bays: [31.0, 34.3, 37.6, 40.9, 44.2],   // K: photographs (regular 12-pane sashes); pitch G
  winF: [4.6, 6.5], winS: [7.4, 9.1], winW: 1.15,   // G: storeys 3 m
  open: { s0: 29.6, s1: 42.6, back: 5.6, ceil: 3.62 },   // the open ground floor on brick piers, back wall 2 m in. K: photograph
                                    // c2022, Gast 2019 (open at its west end); extent G
  door: 44.2,                       // the white door in the solid east bay. K: photograph c2022, Halling 2025
};
export const OLD = {      // the stone-and-brick range east of it (the older Hostel, 1898, Walter Lane: I): three storeys,
                          // rubble with brick quoins and bands, a cross gable with an arched window, a blank brick north wall
  s0: 46.0, s1: 59.4, t0: 0.8, t1: 7.6,    // K: LIDAR (s_h 27 - 41), map; east end on Darbishire's north range gable (s 59.4)
  ffl: 1.1, eaves: 9.1, ridge: 10.6, north: 9.6,   // K: LIDAR edges 9.0 - 9.2, ridge 10.4 - 10.5; north parapet G (Street View 2024)
  dar: 52.1,                        // Darbishire's west range covers the south face east of here. K: _somerville_darbishire_plan.js
  darN: [2.96, 7.71],               // Darbishire's north range gable covers the east end between these t. K: same
  gable: { s0: 48.6, s1: 52.0, apex: 11.6 },   // K: photographs c2022, Halling 2025; sizes G
  wins: [47.9, 49.2, 50.3, 51.4],   // (s) K: photograph c2022; sizes G
  stacks: [[46.0, 47.2, 6.95, 7.85, 12.4], [52.0, 53.0, 0.8, 1.6, 12.1]],   // K: photograph (a tall stack at the junction), LIDAR peak 12.1
};

// ------------------------------------------------------------------------------------------------ THE TRAFFIC QUAD and the drive
// LOCAL rings. The tarmac court from House to Darbishire, from the Hostel to the kitchens and the Oratory's wall, with the
// lane out to Darbishire's south passage. K: LIDAR open ground; map w97853754; the neighbours' plan files (Darbishire's
// west face and wing, the kitchens' faces).
export const TQ = [[58.49, -7.53], [67.24, -6.61], [68.02, -13.97], [62.05, -14.6], [62.9, -22.65], [70.14, -21.79], [92.82, -19.41],
  [90.71, 0.74], [87.13, 0.36], [86.44, 6.93], [90.02, 7.3], [89.66, 10.68], [89.4, 13.17], [86.11, 13.54], [82.98, 12.88], [70.42, 9.4],
  [70.71, 7.86], [71.49, -0.4], [57.88, -1.71]];
// No bay lines: the 2025 photograph (Halling) shows plain tarmac with cars along the north and east sides. K
// the drive (house frame): in front of the west front, between House and the Hall, through the arch. K: Piron 2014, Street
// View 2015 (tarmac); its west edge where the Quad's own path begins (grounds part) G
export const DRIVE_W = [[-6.0, 0.0], [-4.75, 0.0], [-4.75, 5.86], [-0.05, 5.86], [-0.05, 16.35], [3.45, 16.35], [3.45, 18.55], [9.85, 18.55],
  [9.85, 23.05], [14.8, 23.05], [14.8, 28.85], [2.84, 28.97], [-5.0, 28.6]];

// ------------------------------------------------------------------------------------------------ lanterns (wall lanterns on brackets)
// [face, coordinate, along, y]: K where a photograph shows one, G its exact place
export const LAMPS = [['W', 0.0, 0.55, 6.7], ['W', 0.0, 15.75, 5.3], ['W', 9.9, 22.55, 4.6], ['E', 28.0, 22.55, 4.9], ['E', 22.0, 14.3, 4.7], ['S', 7.6, 31.6, 4.6]];

export const CHECKED = [
  ['own frame along House\'s north face and the Hostel, 6.0 deg clockwise of LOCAL u', 'K', 'map w97853788 / w97853764 (6.1 / 6.2 deg); topo survey 20/00564 south face (6.4 deg)'],
  ['main block s 0 - 13.0, t 0.25 - 16.3: SW corner and south face from the topographic survey', 'K', '20/00564 Clear View 2019 (parapet line 73.17 - 73.21), CSV positions in the LIDAR frame'],
  ['main block front 16.05 m: every opening, the strip and stack, the dormers, the porch', 'K', '16/00283/FUL ADP 2016 existing west elevation 1:50 (scaled, +-0.1)'],
  ['main block north face t 0.25 and east face s 13.0', 'G', 'LIDAR edges less the lean; map 0.7 m further in'],
  ['parapet +10.72, cornice +9.94, string +4.9', 'K', 'survey 73.21; west elevation'],
  ['ground floor +0.95, one step over the drive', 'K', 'west elevation (door sill on the drive)'],
  ['walls of coursed rubble limestone, ashlar dressings, red-brick bands on the front strip', 'K', 'Piron 2014; Street View 2015; survey 9.4 (not stucco)'],
  ['slate mansard: steep slope to a kerb +12.85, hipped above to +15.0', 'K', 'LIDAR (edges 12.6 - 12.9, middle 15.0 - 15.2); elevation (kerb); inset G'],
  ['two long white dormers on the front (5 and 6 lights)', 'K', 'west elevation; Piron 2014 shows them'],
  ['a five-light dormer on the north slope', 'K', 'PHOTO_NOTES (ROQ lane looks); place G'],
  ['a long dormer on the south slope', 'G', 'seen in no look'],
  ['main block stacks: the front stack on the strip (cap +15.2), north and two south stacks', 'K', 'elevation; LIDAR peaks; sizes G'],
  ['first-floor sashes in eared stone architraves; a three-light window; the tall ground-floor sash', 'K', 'west elevation; Piron 2014'],
  ['stone pedimented porch with glazed doors, apex +5.63', 'K', 'west elevation; Piron 2014; projection 0.8 G'],
  ['single-storey brick bay at the front\'s north end, 5.56 x 4.7, parapet +4.8, door and mullioned windows', 'K', '16/00283 existing elevations and sections; Piron 2014; Street View 2015'],
  ['the brick bay as it stood in 2014 - 16 (16/00283 sought to replace it with a new bay window / entrance)', 'G', 'present form not in the sources: QUESTION'],
  ['south face: lean-to with lead roof, a three-light window over it', 'K', 'Street View 2015 (Hall west front close); sizes and places G'],
  ['main block north and east faces: windows', 'G', 'seen in no look'],
  ['east part s 13 - 22, t 7.5 - 15.6, eaves +11.2, N - S ridge +14.0, clay tiles', 'K', 'LIDAR; satellite (red tiles on the wings)'],
  ['Traffic Quad entrance bay: round-arched door, balustraded balcony on brackets, round-headed window, cross gable', 'K', 'Gast 2019; LIDAR balcony bump; sizes G'],
  ['small white timber clock cupola over the entrance bay', 'K', 'Gast 2019, PHOTO_NOTES; size and the dials G'],
  ['north-east block s 18 - 29.3, t 0.75 - 7.5, eaves +11.0, ridge +13.9 E - W, gabled dormers, gable to the east', 'K', 'LIDAR; Gast 2019 (stone with brick, dormers, the east gable over the Hostel)'],
  ['north-east block window columns and dormer places', 'G', 'Gast 2019 shows three columns obliquely'],
  ['one-storey link +4.4 between the main block and the north-east block', 'K', 'LIDAR +3.2 .. 4.6; faces G'],
  ['1881 wing s 9.9 - 28.0, t 15.6 - 23.0, eaves +11.2, ridge +14.0, gables both ends with kneelers and finials', 'K', 'survey (west face); LIDAR; Gast 2019; Street View 2015'],
  ['wing\'s east gable: stone with red-brick quoins and bands, windows as photographed', 'K', 'Gast 2019 (scaled 47 px/m, +-0.3)'],
  ['wing\'s south face brick with stone window dressings, round-headed ground windows, dentil band', 'K', '"03 archway ... from the east" (Halling 2025); places G'],
  ['two-storey canted bay under the wing\'s west gable', 'K', 'LOOKS_BY_HAND (Street View 2015); sizes G'],
  ['wing stacks (+16.8, +16.4)', 'K', 'LIDAR; Gast 2019'],
  ['archway block s 14.8 - 18.3, screen to s 19.2, across t 23.0 - 28.85, top +8.1', 'K', 'LIDAR +7.9 .. 8.3; hall part\'s link box; kitchens\' face'],
  ['triple brick screen: middle arch 2.45 wide springing +1.65, side arches 0.7 with cream doors in recesses, three rings, brick key', 'K', 'Halling 2025 square on (pattern); figures G +-0.15'],
  ['painted arms panel in a stone frame over the arch (a blank shield in the model)', 'K', 'Halling 2025; house rule (no arms)'],
  ['plastered barrel-vaulted passage, open and walkable, tarmac with flag margins', 'K', 'Halling 2025 (through the arch)'],
  ['the archway\'s west face (to the Quad): brick, a plain round arch, one sash', 'G', 'seen only from inside the passage'],
  ['Hostel brick range s 29.3 - 46, three storeys, parapet +10.0, flat roof +9.6, corbelled band', 'K', 'LIDAR; photographs c2022, Gast 2019, Halling 2025'],
  ['Hostel window bays (5) and heights', 'G', 'photographs (regular sashes); pitch guessed'],
  ['Hostel open ground floor on piers (s 29.6 - 42.6), white door in the east bay', 'K', 'photograph c2022; Gast 2019; extent G'],
  ['Hostel north face: plain brick against ROQ East', 'G', 'seen in no look'],
  ['older Hostel range s 46 - 59.4: rubble with brick quoins, three storeys, eaves +9.1, clay tiles, cross gable with an arched window', 'K', 'photograph c2022; Halling 2025; LIDAR; satellite (red tiles)'],
  ['older range\'s north wall: blank red brick on the boundary, parapet +9.6, a stack', 'K', 'Street View Aug 2024 (Loverose Way); height G'],
  ['the older range\'s south face east of s 52.1 is behind Darbishire\'s west range (not drawn)', 'K', '_somerville_darbishire_plan.js WEST'],
  ['Traffic Quad: tarmac from House to Darbishire, the Hostel to the kitchens and the Oratory wall, the lane to Darbishire\'s south passage', 'K', 'LIDAR open ground; map w97853754; neighbours\' plans'],
  ['no painted bay lines (cars park along the north and east sides on plain tarmac)', 'K', 'Halling 2025; satellite'],
  ['the drive in front of House, between House and the Hall and through the arch: tarmac', 'K', 'Piron 2014, Street View 2015, Halling 2025; west edge G'],
  ['wall lanterns: west front north end, south-west corner, wing west gable, wing east end, entrance bay, Hostel', 'K', 'Piron 2014, Street View 2015, Gast 2019, Halling 2025; places G'],
];
