// Somerville College, STANDALONE model, part 'park' (survey B05): THE PLAN of Park (formerly West; H. W. Moore, 1885 - 87
// and 1893 - 95; listed II as "West Building"), the Walton Street gate with West (Park) Lodge and the boundary wall south
// to Wolfson, and St Paul's Nursery (119a Walton Street, the former St Paul's school house, 1848). Pure data: every figure
// a named constant with its source and K / G mark; the build functions are in _somerville_park_build.js.
// Research: docs/research/somerville_survey.md 1 - 5, 11; reference/somerville/LOOKS_BY_HAND.md, PHOTO_NOTES.md;
// reference/somerville/20 planning drawings/DIMENSIONS.md; brief docs/handoff/somerville/briefs/park.txt.
//
// PARK'S OWN FRAME. Everything is authored in (s, y, t): S.ownFrame(...FRAME) runs s EAST along the main range's south
// (Park Lawn) wall line, t SOUTH across it (towards Park Lawn), y above the datum (62.50 m) as everywhere. The frame is
// turned -7.6 deg from the LOCAL u axis (its east end further north). Walton Street's boundary is s -9.2 (parallel to the
// frame), the west wing's street face s 0.1, the east wing's Quad face s 42.26, the main south face t 0.5, Holtby's south
// face t -14.5.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * The 2018 ground-floor plan (ADP, 18/02014/LBC drawing A-1050 rev C, 1:100 @ A1; its own 10 m scale bar = 59.1 px a
//     metre at 150 dpi) laid on a 12 - 20 px/m picture of the LIDAR 2022 surface in this frame (by hand, no rotation
//     needed): walls, courts and the carriage arch fall on the roofs' edges to 0.5 m. Plan -> frame: s = (X - 750) / 59.06
//     + 0.1, t = (Y - 1410) / 59.06 + 0.5 (X, Y px of the 150 dpi rendering). Every wall line below comes from that fit.
//   * Levels: the 2019 Clear View topographic survey (DIMENSIONS.md): Park Lawn side eaves 70.69 - 70.89 (+8.2 .. +8.4),
//     the Park / Holtby ridges 74.78 - 74.87 (+12.3), Park Lawn 61.39 - 61.59, the brick-sett strip before the east wing
//     61.54 - 61.59. LIDAR (tools/somerville_lidar.py fsec / fbox): the south pile's ridge median 11.95 (a 1 m grid lowers a
//     ridge), its valley with the north pile at t -6.75, the north pile's ridge 10.85 at t -9.25, a flat top +10.3 .. 10.7
//     over the north block, the workshop +6 .. +7, the west wing's N - S ridge at s 3.3 with a hip at its north end.
//   * The south front: NMLA's near-orthographic elevation (2013, reference/somerville/06 .../drawing Park south face
//     elevation with Wolfson section (NMLA 2013).jpg), read by pixel and scaled by 49.9 px a metre (the gable-to-porch
//     spacing against the 2018 plan; the figures in it agree: 1.7 m people, Wolfson's 2.82 m tiers), levels tied to the
//     survey's eaves +8.3 at its eaves line: ground -0.92 at the porch, ridge +12.35, the gables' apexes +11.41, oculi
//     +9.54, window sills and heads as below, chimneys at s 3.4, 10.4, 19.0, 22.6, 31.1 (the LIDAR's peaks agree).
//   * The 2002 existing elevations (Architects Design Partnership, 02/01418/FUL drg 13 rev A, 1:100): the carriage arch
//     3.75 m wide under a gable with a two-storey oriel and an oval oculus, the three-storey north block beside it, round-
//     headed ground windows; the courtyard faces with segmental-headed sashes.
//   * Photographs (folder 06, 08, 04): counts and details of each face (see CHECKED).
import { ownFrame } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ frame
export const FRAME = [-81, 4.0, -40, -1.47];   // LOCAL (u, v) -> (u, v): s east along the south wall line, -7.6 deg. K: plan fitted on the LIDAR; map south face -7.45, brief -7.9
export const F = ownFrame(...FRAME);
/** t of the line LOCAL v = 4.0 (Wolfson's north stair link's face, part 'wolfson' NLINK) at s */
export const V4 = 4.0;                          // K: the lead (Wolfson's link v 4.0 - 8.0 at u -82 .. -72; LIDAR)
export const tV4 = (s) => { const q = F.L(s, 0), q1 = F.L(s, 1); return (V4 - q[1]) / (q1[1] - q[1]); };

// ------------------------------------------------------------------------------------------------ levels (y above the datum)
export const FFL = -0.50;          // Park's ground floor, one level throughout. K: plan steps (0.17 + 0.05 + 0.23 from the porch) over the Park Lawn path -0.95 (survey 61.42 - 61.64); G: +-0.1
export const EAVES = 8.30;         // the tiles' foot on every long front. K: survey 70.69 - 70.89; NMLA eaves line
export const RIDGE = 12.35;        // the main ridges (south pile, west and east wings). K: NMLA 12.35; survey 74.78 - 74.87; LIDAR 11.95 median
export const NRIDGE = 10.90;       // the north pile's ridge (t -9.1). K: LIDAR 10.85 (fsec at s 10 - 30)
export const FLAT = 10.35;         // the north block's flat lead roof. K: LIDAR 10.3 - 10.7 over t -11 .. -17.5
export const PARAPET = 10.55;      // its low brick parapet's coping. G
export const SHOWER_TOP = 9.60;    // the shower block in the court's south-west corner: flat roof. K: LIDAR 9.5 - 10.4; G: flat
export const WORKSHOP_TOP = 6.70;  // the single-storey workshop range north of the court (the gymnasium of 1890?). K: LIDAR 6 - 7.3; G: flat with a parapet
export const ROOF_OV = 0.30;       // tiles' overhang at the eaves and verges. G: photographs (a short sprocketed eaves)
export const PLINTH_TOP = FFL + 0.35;   // a blue-brick / stone plinth band. G
export const BAND1 = 3.60;         // the stone sill band under the first-floor windows. K: NMLA line at 3.6
export const BAND2 = 6.66;         // under the second-floor windows. K: NMLA 6.66
export const BAND_H = 0.14;

// ------------------------------------------------------------------------------------------------ plan (s along, t across)
export const S_W = 0.10;           // the west wing's street face. K: plan (Bedrooms 6 - 8 west wall), LIDAR edge 0 .. 0.4
export const S_WE = 6.50;          // the west wing's back (court) face. K: plan
export const S_RW = 3.30;          // the west wing's N - S ridge. K: LIDAR 3 - 3.5; centred
export const T_BOX = -18.40;       // the west wing's north end (the "box"). K: plan; LIDAR hip down to t -18.5
export const PASS = [-14.22, -10.47];   // the carriage arch through the west wing (3.75 wide). K: plan (dashed, 3.9), 2002 elevation (arch 3.75)
export const ARCH = { spring: 0.80, crown: 2.675 };   // K: 2002 elevation (crown 4.07 m over the yard -1.42); G: springing (semicircle)
export const T_S = 0.50;           // the main range's south face. K: plan 0.33 - 0.67; LIDAR eaves edge +0.6 .. +1
export const T_N1 = -6.30;         // the south pile's north wall (corridor) and the valley over it. K: plan; LIDAR valley -6.75
export const T_N2 = -11.80;        // the north pile's north side / the flat block's south side. K: LIDAR (ridge -9.25 symmetric)
export const T_NB = -17.90;        // the north block's north wall. K: plan (kitchen north wall), LIDAR edge -18
export const S_NB0 = 17.70;        // the north block's and the north pile's west (court) wall. K: plan (stair hall)
export const S_EW0 = 35.10;        // the east wing's west wall (and Teaching Space 3's). K: plan 34.8 - 35.3, LIDAR ridge 39 centred
export const S_EW1 = 42.26;        // the east wing's Quad (east) face. K: plan 41.75 + 0.5 (LIDAR edge 43)
export const S_ER = 38.68;         // the east wing's N - S ridge (centred). K: LIDAR 39
export const T_EWN = -14.50;       // the east wing's north end against Holtby's south face. K: plan (Teaching Space 1), part 'library' (Holtby t +0.4 = here)
export const SE = { s0: 35.10, s1: S_EW1, t1: 1.85 };     // the east wing's south end: projects 1.35 beyond the south face under a shaped gable. K: plan (Teaching Space 3), map (bay), photo 2019 (south-east)
export const BOW = { s: 38.70, w: 4.10, proj: 0.85, top: 2.90 };   // the stone bow window on it. K: plan (segmental bow 0.85 out), map; G: height
export const SHOWER = { s0: 5.90, s1: 11.60, t0: -10.40, t1: T_N1 };   // K: plan (shower rooms + stair)
export const WORKSHOP = { s0: 10.40, s1: 26.00, t0: -21.20, t1: -16.90 };   // K: plan ("Workshop"), LIDAR +6 .. +7 at t -21 .. -17
export const COURT_N = -21.20;     // the court's north boundary wall west of the workshop. K: plan (thin wall with a door)

// ------------------------------------------------------------------------------------------------ the SOUTH (Park Lawn) front
export const GABLE_W = 4.20;       // K: NMLA 210 px
export const GABLE_APEX = 11.41;   // K: NMLA
export const SOUTH_GABLES = [12.54, 20.76, 29.08];   // gable centres (s); the porch under the middle one. K: NMLA (49.9 px/m) on the plan's Main Entrance s 20.76; plan window 12.55
export const SOUTH_BAYS = [8.40, 16.90, 25.00, 33.10];   // the plain bays' window axes. K: plan windows 8.4 / 17.0, NMLA 16.9 / 25.0, plan Office 33.1
export const OCULUS = { y: 9.54, r: 0.24 };          // K: NMLA
export const WIN0 = { w: 1.70, sill: 0.18, spring: 2.30, rise: 0.29, lights: 2 };   // ground: two-light, segmental heads under gauged brick. K: NMLA (top 2.59, sill 0.18, 1.7 wide); photo 2019
export const WIN1 = { w: 2.30, sill: 3.79, head: 5.49, lights: 3 };                 // first floor: three-light stone mullioned. K: NMLA, photo 2019
export const WIN2 = { w: 2.30, sill: 6.90, head: 8.10, lights: 3 };                 // second floor. K: NMLA (head at the eaves line)
export const GWIN = { w: 2.20, sill: 6.80, spring: 8.18, rise: 0.28, lights: 3 };   // the gables' second-floor windows under a segmental brick arch. K: NMLA, photo 2019
export const ORIEL = { back: 2.60, front: 1.40, proj: 0.60, corbel: 2.79, base: 3.45, top: 5.75, roofTop: 6.35, lights: 2 };   // canted stone oriels on carved corbels. K: NMLA (gables 1, 2), photo 2019 (gables 2, 3); G: plan depth
export const PORCH = { s: 20.76, w: 3.40, proj: 0.40, top: 2.33, door: 1.50, spring: 1.10, step: 0.17, lights: 0.45 };   // stone doorcase, round-arched door with side lights. K: NMLA, photo 2019, plan (step 170 mm); G: projection
export const WEST_OF_GABLE1 = 8.40;   // the bay behind Wolfson's link (second floor seen over it). G: plan window

// ------------------------------------------------------------------------------------------------ the EAST (Quad) front of the east wing
export const EAST_GABLES = [-12.45, -8.35, -4.25];   // gable centres (t). K: photos c2021 / 2015 (three gables nearly touching, the north one against Holtby, the long ground window under the middle and north ones); G: spacing
export const EG_W = 4.00;          // K: photo c2021 by eye; G: figure
export const EG_APEX = 11.40;      // G: as the south gables (photo: same kneelers, finials, coping)
export const EBAY = { back: 2.40, front: 1.50, proj: 0.55, base: 3.50, top: 5.65, roofTop: 6.35, lights: 2 };   // first-floor canted bays under little hipped tile roofs. K: photos; G: sizes
export const EWIN0 = [[-13.20, -11.20], [-10.80, -8.80], [-5.30, -3.20]];   // ground: stone-mullioned transomed windows (t ranges). K: plan (glazing t -13.2 .. -8.8), photo c2021; G: the south one
export const EWIN0_Y = { sill: 0.10, head: 2.60, transom: 1.90, lights: 3 };
export const SHAPED = { step: 10.70, stepW: 1.70, apex: 12.70, oculus: 10.30 };   // the shaped south gable of the east wing. K: photo 2019 (stepped shoulders with finials, oculus); G: figures
export const EAST_STACK = { t0: -0.10, t1: 1.10, out: 0.55, top: 15.00 };       // the very tall stack at the south end of the Quad face. K: photos 2015 / 2019, LIDAR peak (s 41, t 0); G: top

// ------------------------------------------------------------------------------------------------ the WEST (Walton Street) front of the west wing
export const WG_A = { t: -12.35, w: 4.60, apex: 11.80 };   // the arch gable: two-storey canted oriel, oval oculus. K: 2002 elevation (gable 4.6, apex 13.3 over the yard), photos (Walton Street)
export const WG_B = { t: -5.60, w: 4.20, apex: 11.40 };    // the second gable with two stacked oriels. K: photo (Wolfson west face look); G: place (the chimney south of it at t -3)
export const WG_C = { t: -16.45, w: 2.60, apex: 10.40 };   // a small gable over the north block (the "box"). K: Walton Street oblique look; G: size
export const WORIEL = { back: 2.40, front: 1.30, proj: 0.55, corbel: 2.85, base: 3.15, mid: 5.90, top: 8.15, roofTop: 8.55, lights: 2 };   // K: 2002 elevation (oriel +3.1 .. +8.3), photos; G: plan
export const WEST_WIN = { box: [-17.40, -15.40], mid: -8.85, south: -1.80 };   // window axes (t). K: 2002 elevation (box two a floor), photos; G: south
export const ROUND0 = { t: [-9.55, -8.70, -7.85], w: 0.70, sill: 0.10, spring: 1.95 };   // the round-headed ground windows beside the arch. K: 2002 elevation (three); G: size, place

// ------------------------------------------------------------------------------------------------ chimneys (s, t, size, top)
export const CHIMNEYS = [
  { s: 3.40, t: -3.00, w: 0.90, d: 1.60, top: 14.00 },     // west wing, south of gable B. K: NMLA x 560, LIDAR 14.0 at (3, -3)
  { s: 4.00, t: -11.50, w: 0.90, d: 1.60, top: 13.80 },    // west wing, behind gable A. K: LIDAR 13.3 - 13.7, photos
  { s: 10.44, t: -3.10, w: 0.85, d: 1.50, top: 14.00 },    // K: NMLA x 910; LIDAR 14 at (10, -4)
  { s: 19.00, t: -3.10, w: 0.85, d: 1.50, top: 14.00 },    // K: NMLA x 1337; LIDAR (18.5, -3.5)
  { s: 22.60, t: -3.10, w: 0.85, d: 1.50, top: 14.00 },    // K: NMLA x 1517; LIDAR (22.5, -3.5)
  { s: 31.10, t: -3.10, w: 0.85, d: 1.50, top: 14.00 },    // K: NMLA x 1940; LIDAR (31, -3.5)
  { s: 38.80, t: -6.50, w: 1.50, d: 0.85, top: 14.20 },    // east wing ridge stack. K: LIDAR 13.8 - 14 at (39, -6 .. -7), photo c2021
];

// ------------------------------------------------------------------------------------------------ the Walton Street gate, West Lodge, wall, store
export const STREET_S = -9.20;     // Walton Street's back-of-pavement line (the boundary). K: SITE_RING (map w242287393) in this frame: s -9.16 .. -9.21 along its whole length
export const WALL = { t0: -11.50, top: 1.15, th: 0.45, coping: 0.12 };   // coursed rubble wall south to Wolfson's at v 4. K: LIDAR top +1.1 .. +1.2 (2.6 - 2.8 m over the pavement -1.6), look
export const PIERS = [-15.25, -11.85];   // the two ashlar gate piers' centres (t). K: look (Walton Street front), LIDAR (open yard t -15 .. -12.5 before the arch); G: exact
export const PIER = { w: 0.70, top: 1.95, cap: 0.20 };   // G: look by eye (piers stand above the wall)
export const LODGE = { s0: STREET_S, s1: -1.80, t0: -21.60, t1: -15.60, eaves: 1.30, ridge: 4.30, sash: -19.10, band: -0.55 };   // single-storey brick, hipped clay-tile roof, one sash and a stone band to the street. K: look; LIDAR (+1.2 .. +4.4 over s -9 .. -1.5, t -22 .. -15.5); G: plan
export const STORE = { s0: -9.00, s1: -5.00, t0: -11.30, t1: -1.30, top: 1.00, ridge: 1.65 };   // a low brick store behind the wall under a low grey pitched roof (its north end seen through the gate). K: LIDAR +1.0 .. +1.4 over s -9 .. -5; satellite (grey pitched roof along the street); look (a brick wall inside the gate); G: what it is, heights

// ------------------------------------------------------------------------------------------------ St Paul's Nursery (119a Walton Street)
export const SP = {
  rubbleTint: [1.12, 1.09, 1.0],                           // the walls: pale grey-buff COURSED RUBBLE (ashlar dressings, bay and porch). K: touch-up 1,
                                                           // 08 .../St Pauls Nursery ... (S Craven 2021), 06 .../Walton Street front looking south-east ... (Mar 2026); G: tint
  s0: -8.40, s1: -3.60, t0: -32.60, t1: -21.60,            // the street range (ridge along the street). K: LIDAR eaves / ridge, photos (2021, c2022)
  eaves: 3.90, ridge: 7.90,                                // K: LIDAR ridge 7.6 - 7.9 at s -6; eaves by the photo (5.5 m over the pavement)
  cross: { t0: -32.60, t1: -28.60, apex: 9.40 },           // the north cross wing's steep gable to the street. K: LIDAR 9.4, photos
  arm: { s1: 9.50, t0: -32.20, t1: -28.20, eaves: 3.60, ridge: 7.00, dormers: [-1.5, 1.8, 5.1, 8.0] },   // the rear arm along the north boundary with gabled dormers on its south slope. K: LIDAR (+7 at t -30, to s 9.5), satellite (four or five dormers); G: their places
  porch: { t0: -24.30, t1: -21.90, proj: 0.90, eaves: 1.90, apex: 3.70 },   // gabled porch, pointed door. K: photos; G: sizes
  bay: { t: -30.60, back: 2.60, front: 1.60, proj: 0.70, top: 1.40 },    // canted castellated bay under the gable. K: photos; G: sizes
  floor: -1.45,                                            // G (one step over the pavement -1.65)
  stacks: [{ s: -7.20, t: -30.60, y0: 8.70 }, { s: -6.00, t: -26.60, y0: 7.30 }],   // the two octagonal stone chimneys (on the cross wing's ridge, on the long ridge). K: photos; G: place
  brickStack: { s: -6.00, t: -21.60, top: 11.00 },         // the tall red-brick stack with stone bands at the south gable. K: photos; G: top
  rail: { s: -9.05, t0: -32.60, t1: -24.40, h: 1.05 },     // the front railings. K: photos
};

export const CHECKED = [
  ['Park\'s frame -7.6 deg from the LOCAL u axis; Walton Street\'s boundary parallel to it at s -9.2', 'K', 'ADP plan 18/02014 fitted on LIDAR 2022; SITE_RING'],
  ['footprint: west wing s 0.1 - 6.5, main range s 6.5 - 35.3 (south face t 0.5), north block to t -17.9 east of s 17.7, east wing s 35.3 - 42.26 to Holtby at t -14.5', 'K', 'ADP ground-floor plan 2018 (1:100, own scale bar) laid on the LIDAR; west face +-0.4, east face 0.5 short of the LIDAR edge (kept the plan +0.5)'],
  ['the court (open) between the west wing and the north block, the shower block in its south-west corner, the workshop range north of it', 'K', 'plan; LIDAR open at s 7 - 18, t -16 .. -7'],
  ['the carriage arch through the west wing from the Walton Street yard into the court, 3.75 wide', 'K', 'plan (dashed passage 3.9), 2002 elevation; walkable'],
  ['ground floor one level -0.50', 'K', 'plan steps 170 / 30 - 50 / 230 mm over the path at -0.95; G +-0.1'],
  ['eaves +8.3, main ridges +12.35, north pile ridge +10.9, north block flat +10.35, workshop +6.7', 'K', 'survey 2019 (70.69 - 70.89, 74.8); NMLA elevation; LIDAR'],
  ['double-pile main range: south pile t 0.5 .. -6.3, north pile -6.3 .. -11.8 east of the court', 'K', 'LIDAR sections (valley t -6.75, ridges -3.1 and -9.25)'],
  ['west wing: N - S ridge, hipped north end over the "box", south gable end on Wolfson\'s link line v 4.0', 'K', 'LIDAR; Wolfson part; look "Wolfson west face" (plain stone-coped south gable)'],
  ['south front: three straight stone-coped gables (4.2 wide, apex +11.41) with oculi at s 12.54 / 20.76 / 29.08', 'K', 'NMLA elevation 2013; photos 2019'],
  ['south front windows: three-light mullioned at both upper floors, segmental-arched gable windows, two-light segmental-headed ground windows', 'K', 'NMLA; photos 2019; sizes scaled'],
  ['canted stone oriels on carved corbels under the three south gables', 'K', 'NMLA (gables 1, 2), photo 2019 south-east (gable 3); plan depth G'],
  ['the porch: stone doorcase, round-arched door, side lights, one step of 0.17', 'K', 'NMLA, photo 2019, plan; projection G'],
  ['south front west of s 8.9 hidden by Wolfson\'s north link (windows there)', 'G', 'plan bedroom window; nothing seen'],
  ['east (Quad) front: three stone-coped gables with finials, first-floor canted bays under hipped tile roofs, three-light second-floor windows under gauged-brick arches', 'K', 'photos c2021, 2015'],
  ['east front gable spacing and sizes', 'G', 'photo c2021 by eye'],
  ['east front ground floor: transomed stone windows (t -13.2 .. -8.8) and one more under the south gable', 'K', 'plan glazing, photo c2021; the south one G'],
  ['east front in one plane (the plan sets Teaching Space 3 1.1 m back; the photos and the LIDAR show one plane)', 'G', 'contradiction: plan vs photos / LIDAR'],
  ['the east wing\'s shaped south gable with stepped shoulders, finials and an oculus, the stone bow below', 'K', 'photo 2019 south-east; plan bow; figures G'],
  ['the tall stack at the south end of the Quad front', 'K', 'photos 2015, 2019; LIDAR peak; top 15.0 G'],
  ['ridge stacks at s 3.4, 4.0, 10.4, 19.0, 22.6, 31.1 and the east wing\'s; brick with orange pots', 'K', 'NMLA, LIDAR peaks, photos; tops G (+-0.5)'],
  ['west (Walton Street) front: the arch gable (oval oculus, two-storey canted oriel), a second gable with stacked oriels, a small gable over the north block, three-light windows', 'K', '2002 elevation; looks "Walton Street front", "Wolfson west face"'],
  ['west front gable B place, the south bay\'s windows, the ground windows behind the wall', 'G', 'photos by eye (panorama, distorted); the wall hides the ground floor'],
  ['court faces, north faces, the workshop: plain brick with segmental-headed sashes', 'G', '2002 elevations (court) only roughly placed; nothing seen from outside'],
  ['shower block flat-roofed +9.6, workshop flat +6.7', 'G', 'LIDAR heights; forms not seen'],
  ['north block\'s flat lead roof with a glazed light over the map\'s inner court', 'G', 'LIDAR shows no open court (map r1404465 hole)'],
  ['the west wing\'s south end on the line v 4.0 (not the map\'s v 2)', 'K', 'the lead; LIDAR; part wolfson NLINK'],
  ['the Walton Street gate: two ashlar piers, black iron gates (drawn open)', 'K', 'look (Walton Street front); places G'],
  ['West (Park) Lodge: single storey red brick, stone band, one sash to the street, hipped clay-tile roof', 'K', 'look; LIDAR +1.2 .. +4.4; plan G'],
  ['a low brick store behind the wall south of the gate under a grey pitched roof', 'G', 'LIDAR +1.0 .. +1.4 over s -9 .. -5; satellite (grey roof); a brick wall seen inside the gate; use and heights guessed'],
  ['Walton Street boundary wall from the gate to v 4: coursed rubble, top +1.15', 'K', 'LIDAR; look; thickness G'],
  ['St Paul\'s: pale stone two storeys, steep slate roof along the street, a steep north cross gable with a castellated canted bay, gabled porch with a pointed door, octagonal stone chimneys, a tall brick stack', 'K', 'photos 2021, c2022; LIDAR (eaves, ridge 7.9, cross gable 9.4)'],
  ['St Paul\'s set square to the street (the map turns it 6 deg more)', 'K', 'LIDAR ridge lines parallel to the street'],
  ['St Paul\'s rear arm along the north boundary, ridge +7.0 to s 9.5, gabled dormers on its south slope', 'K', 'LIDAR; satellite; walls, windows and dormer places G'],
  ['St Paul\'s sizes of porch, bay, windows; chimney tops', 'G', 'photos by eye'],
  ['brick setts strip before the east wing; paving in the yard, the arch and the court', 'K', 'survey "Brick Setts" 61.54 - 61.59; yard and court surfaces G'],
  ['the setts strip stops at Holtby\'s flagged apron (park t -11.2): the loggia runs to the east wing\'s face', 'K', '04 Holtby south face, 06 Park east wing front (Street View 2015) (touch-up 1)'],
  ['St Paul\'s walls grey-buff coursed rubble with ashlar dressings; the canted bay and the porch ashlar', 'K', 'S Craven 2021; Street View Mar 2026 (touch-up 1; tint G)'],
];
