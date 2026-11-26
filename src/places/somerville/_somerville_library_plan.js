// Somerville College, STANDALONE model, part 'library' (survey B04): THE PLAN of the Library (Basil Champneys, 1903) and
// Holtby (Geddes Hyslop, 1951 - 56), the one long range on the north side of the main Quad. Pure data: every dimension a
// named constant with its source and K / G mark; the build functions are in _somerville_library_build.js.
// Research: docs/research/somerville_survey.md sections 1 - 5, 11; reference/somerville/LOOKS_BY_HAND.md ("Library and
// Holtby"); brief docs/handoff/somerville/briefs/library.txt.
//
// THE RANGE'S OWN FRAME. Everything is authored in (s, y, t): S.ownFrame(...FRAME) runs s EAST along the Library's south
// (Quad) wall line, t SOUTH across it (towards the Quad), y above the datum (62.50 m) as everywhere. t = 0 is the face
// of the Library's two plain WINGS; the pavilions and the frontispiece stand forward of it, the north wall is at t -6.0.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * The DIRECTION: the map's outline (w97853782) has every south and north edge at -6.0 deg to the LOCAL u axis (east
//     end further north); the LIDAR's eaves lines are parallel to it to within the 1 m grid. K.
//   * The PLACE across the range: the map's outline is 2.4 m too far NORTH. The LIDAR 2022 (sections across the range
//     with tools/somerville_lidar.py fsec / v, and a 0.25 m picture of the surface in this frame) puts the eaves of the
//     south slope at t +0.1 .. +0.9 (the edge falls to the ground at t +0.9 .. +1.2 all along: wings with their cornice,
//     pavilions and frontispiece one metre forward), the ridge at t -2.9 (11.75 median, 12.0 p90) and the north eaves at
//     t -5.7 .. -6.0, ROQ West's flat roof (+12.2) starting at t -6.5 .. -7. The map's own outline has the same widths
//     (wings 6.0 deep, pavilions / frontispiece 1.0 - 1.1 forward) but its south front at t -2.45: it was traced off
//     imagery that leans north-west (the roofs' edges). The map's footway along the front (w97853789) is wrong by the
//     same 2.4 m (it runs at t +1.5 .. +2, under the steps). Shift +2.4 adopted: K (LIDAR outranks the map).
//   * The PLACE along the range (s): the map's breaks, which the photographs confirm bay by bay: west pavilion s 29.8 -
//     38.8, west wing to 46.44, frontispiece to 59.26, east wing to 66.9, east pavilion to 76.2, the lower east block to
//     80.5 (LIDAR: the main roof ends at s 76.5 - 77, a lower flat top +7.0 .. +7.3 runs on to s 80.5). K.
//   * Holtby: the LIDAR's ridge and eaves run on unbroken west of the Library (ridge 11.78, eaves 9.5 - 9.6) to s 2.5;
//     Park's east wing stands against Holtby's south side from s 0 to 10.5 (LIDAR: roofs continuous to t +6 there; the
//     open court in front of Holtby starts at s 10.5). Holtby's south front is therefore seen only from s 10.5 to the
//     Library's west pavilion (s 29.6): six bays (Street View 2015, folder 04).
//   * Levels: bare ground (LIDAR DTM) in front at t +3: -1.0 at s 10 - 20 (Holtby), -0.3 at s 30, 0.0 at s 40, +0.2 at the
//     frontispiece (s 46 - 59), +0.4 at s 70, +0.6 at s 78; under the steps the DTM rises to +0.6 .. +0.8 (the steps).
//     The Library's floor: four steps of 0.15 above the path at the frontispiece's east end (+0.30, look "four stone
//     steps up", brief) = +0.90 (63.40 m): K for the count, G for the figure. Eaves cornice +9.6: LIDAR edge 9.5 - 10.0,
//     and the c2021 photograph scaled by its own floor and steps (36 px a metre at the frontispiece): cornice top 8.73
//     above the floor. Every other height on the faces is read off that photograph at that scale (K for what is seen,
//     G for the figure: the camera is low and to the west, so +-0.2 m).
import { ownFrame } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ frame
export const FRAME = [-50, -15.36, 32, -23.98];      // LOCAL (u, v) -> (u, v): s along the Library's wing face, -6.0 deg. K (see above)
export const F = ownFrame(...FRAME);

// ------------------------------------------------------------------------------------------------ plan (s along, t across)
export const T_WING = 0.0;          // the wings' south face. K: LIDAR eaves edge (map + 2.4)
export const T_FWD = 1.0;           // the pavilions' and the frontispiece's south face. K: map projections 1.0 - 1.14; LIDAR edge +0.9 .. +1.2
export const T_NORTH = -6.0;        // the north wall. K: LIDAR north eaves -5.7 .. -6.0; map depth 6.0
export const T_ROQ = -6.9;          // ROQ West's south face (another part): the gap's ground runs to here. K: LIDAR its roof from -6.5 .. -7 (the brief's 1 - 3 m gap is 0.6 - 1.0 m in the LIDAR)
export const S_LIB0 = 29.6;         // the Library's west end = Holtby's east end. K: map 29.4 - 29.8; LIDAR stack at s 30.3
export const PAV_W = [29.6, 38.8];  // west pavilion. K: map; photo c2021 (stone corner pilasters, two bays)
export const WING_W = [38.8, 46.44];
export const FRONT = [46.44, 59.26];// the stone frontispiece, three bays. K: map 12.82; photo c2021
export const WING_E = [59.26, 66.9];
export const PAV_E = [66.9, 76.2];
export const S_LIB1 = 76.2;         // the main block's east end. K: map 76.19; LIDAR main roof ends 76.5 - 77
export const EBLK = { s0: 76.2, s1: 79.9, t0: -6.0, t1: -0.5, top: 7.0, cant: 0.9, cantW: 2.2, ped: 8.15 };   // the lower east block with its canted bay under a pediment facing the ROQ gate passage. K: map (east face s 80.5, front t -0.5 after the shift), LIDAR flat +7.0 .. +7.3, Street View look (folder 02: two storeys, canted bay, pediment); G: the canted bay's size and the pediment's height

// ------------------------------------------------------------------------------------------------ Library levels (y above the datum)
export const FFL = 0.90;            // the Library's (and the loggia's) floor. K: four steps (look) above the path +0.30 (the surveyed ground before the steps); G: the step 0.15
export const H = (h) => FFL + h;    // a height above the floor -> y
export const PLINTH = H(0.15);      // ashlar plinth band top. G
export const STRING = { top: H(3.80), h: 0.36, proj: 0.12 };   // the first-floor band over the loggia (and round the whole front). K: photo c2021 (band at 3.8 above the floor)
export const CAP = H(7.80);         // the giant columns' and pilasters' capitals; a stone architrave band at this level along the wings. K: photo c2021
export const FRIEZE = H(8.40);      // frieze top / cornice foot. G (photo: entablature 7.8 - 8.75)
export const EAVES = H(8.75);       // = 9.65, the eaves cornice's top and the slates' foot. K: photo 8.73 above the floor; LIDAR edge 9.5 - 10.0
export const CORNICE_PROJ = 0.45;   // G
export const RIDGE = 12.05;         // K: LIDAR ridge median 11.75, p90 12.0 - 12.05 (a 1 m grid lowers a ridge)
export const ROOF_OV = 0.12;        // the slates' foot runs onto the cornice. G
export const ATTIC = { top: 10.45, coping: 0.12, t: 0.36 };    // the brick attic over the pavilions and the frontispiece's side bays. K: photo c2021 / Street View (a brick blocking course with a stone coping over the cornice); G: height
export const PED = { w: 0.72, top: 10.85, ball: 0.31, neck: 0.12 };   // pedestals with ball finials over the columns and pilasters. K: photos (balls over every column / pilaster); G: sizes
export const CHIMNEYS = [            // brick stacks with stone caps on the ridge line (s, t), 1.7 x 0.9, top. K: LIDAR peaks (>= 13.0 at s 30.3, 38.6, 67.3, 76.0, t -2.5); photos (tall plain brick stacks); G: tops (the 1 m grid smears a stack)
  { s: 30.3, t: -2.5 }, { s: 38.6, t: -2.5 }, { s: 67.3, t: -2.5 }, { s: 75.6, t: -2.5 },
];
export const CHIMNEY = { w: 1.7, d: 0.9, top: 13.6 };

// ------------------------------------------------------------------------------------------------ the frontispiece (ground: the loggia)
export const LOGGIA = {
  pierW: 1.10,                       // rusticated ashlar piers. K: photo (pier : arch : column = 85 : 100 : 35 px)
  colR: 0.21,                        // Tuscan columns between the arch pairs. K: photo; G: radius
  spring: H(2.55), course: 0.33,     // the arches' springing; the rustication's course. K: photo scaled; G course
  glassBack: 0.6,                    // the arches' glazing set back behind the arcade's face (brief). K: look (arches glazed, dark frames)
  doors: [2, 3],                     // the two arches of the centre bay hold glazed doors (0-based, west to east). K: photo c2021
};
export const STEPS = { n: 5, rise: 0.15, going: 0.36, s0: FRONT[0] - 0.3, s1: FRONT[1] + 0.3 };   // K: photo c2021 (4 - 5 broad steps across the whole frontispiece and a little beyond); G: going
export const HANDRAIL = { s: 53.66, h: 0.9 };                   // a steel handrail down the steps before the centre bay's east arch. K: look + photo c2021
export const GIANT = { r: 0.30, base: 0.22 };                    // the giant engaged Ionic columns on the piers. K: look; G: sizes
export const ORIEL = { w: 2.6, front: 1.9, proj: 0.65, corbel: H(4.05), sill: H(5.05), head: H(7.55), top: H(7.85), lights: 3, transom: H(6.75) };   // the canted stone oriel on a carved corbel in the centre bay. K: look, photo; G: figures (photo scaled)
export const PEDIMENT = { rise: 2.35, w: 0.34 };                 // the segmental pediment over the centre bay with a cartouche (a blank shield here; the "19 03" date not drawn). K: photo c2021; G: rise

// ------------------------------------------------------------------------------------------------ windows (Library)
export const WIN1 = { w: 1.30, sill: H(5.05), head: H(7.95), transom: H(7.0), lights: 2, arch: 0.17, apron: 0.75 };   // first floor: two-light stone cross windows in eared architraves with an apron. K: photo c2021 (glass 1.25 - 1.3 wide, sill 5.0, head 8.0 - 8.2); G: transom
export const WIN0 = { w: 1.25, sill: H(0.95), head: H(2.95), transom: H(2.25), lights: 2, arch: 0.15 };              // ground floor windows of wings and pavilions. K: photos (two-light, transomed); G: heights (planting hides the sills)
export const BAYS_PAV_W = [31.9, 36.5];   // K: photos (two windows a floor in each pavilion)
export const BAYS_WING_W = [40.7, 44.5];  // K: photo (one window seen, the magnolia hides the second); G: the second
export const BAYS_WING_E = [61.2, 65.0];  // K: photo c2021 (two)
export const BAYS_PAV_E = [69.2, 73.9];   // K: photo c2021 (two)
export const PILASTERS_W = [29.95, 34.2, 38.45];   // stone pilasters, rusticated below the band (corners and middle). K: photos (east pavilion three, the west pavilion's east corner seen); G: the west pavilion's middle one
export const PILASTERS_E = [67.25, 71.55, 75.85];
export const PILASTER = { w: 0.70, proj: 0.16 };
export const BAYS_NORTH = [32, 36.5, 41, 45.5, 50, 54.5, 59, 63.5, 68, 72.5];   // north face, first floor (and small windows below). G: no look shows it

// ------------------------------------------------------------------------------------------------ Holtby (1951 - 56)
export const HOL = {
  s0: 2.5,                           // its west wall against Park. K: map (u -48.3), LIDAR roof from s 1 - 2.5; brief "about u -47"
  sOpen: 9.05,                       // west of this Park's east wing stands against its south side: the loggia (slab, balcony, upper wall)
                                     // runs right up to the wing's east face (part 'park' S_EW1 = s 8.99 - 9.05 here), its west pier standing
                                     // against the wing. K: touch-up 1: 04 .../Holtby south face ... and 06 .../Park east wing front ...
                                     // (Street View 2015: no bare wall between the wing and the loggia); part park's plan. (Was 10.5: a
                                     // 1.5 m strip of bare wall showed.)
  s1: S_LIB0,
  ffl: -0.70,                        // loggia / ground floor. G: one step up from the paving at the west end (look), level with it at the east (LIDAR ground -1.0 .. -0.45)
  face: 0.4,                         // the brick upper wall. G: between the map (+1.4 after the shift) and the Library's wing face; the pavilion's return is seen beside it (look)
  slab: { t1: 1.45, bot: 2.55, top: 2.85 },   // the first floor / balcony slab and its fascia. K: look (balcony over the loggia); G: figures
  back: -2.2,                        // the loggia's glazed back wall. G (the look shows a deep soffit)
  pier: { w: 0.5, t: 1.15 },         // five square stone piers on the slab's line. K: look
  bays: 6,                           // window bays from sOpen to s1. K: look (six windows a floor)
  win1: { w: 1.15, sill: 2.85, head: 5.05 },  // first floor: tall sashes to the balcony. K: look; G: heights
  win2: { w: 1.15, sill: 6.55, head: 8.15 },  // second floor sashes. K: look; G: heights
  stair: { w: 1.35, sill: 3.95, head: 7.55 }, // the east bay's one tall window. K: look; G: heights
  top: 9.55,                         // parapet top. K: LIDAR edge 9.5 - 9.64 (the section at s 12 - 28)
  roofFoot: 9.15, ridge: 11.78, ridgeT: -2.8,  // a clay-tile pitched roof behind the parapets with a glazed ridge. K: LIDAR 11.78; satellite (orange tile, glazed ridge); quad photo c2021 (red roof over Holtby)
  rail: 1.0,                         // the balcony's light iron railing. K: look; G: height
  north: [5.0, 8.0, 12.0, 15.5, 19.0, 22.5, 26.0],   // north-face window bays. G: a buff-brick face with white sashes is seen from Loverose Way (look "ROQ West from the north-west"); figures guessed
  chimney: { s: 5.8, t: -0.8, top: 14.2 },   // K: LIDAR peak 14.22 at s 5.5 - 6, t -0.5
};

// ------------------------------------------------------------------------------------------------ the ground at its walls
export const BED_T = 2.6;           // the planted strip between the Library's front and the path. K: photo c2021 (lavender, magnolias against the wall); G: width
export const APRON_T = 3.6;         // the flagged apron in front of Holtby's loggia. K: look (concrete flags); G: depth
export const PLANTER = { s0: 76.2, s1: 81.6, t: 2.6, h: 0.45, w: 0.23 };   // the brick-walled raised bed at the Library's east end. K: look (folder 02); G: line

export const CHECKED = [
  ['range direction -6.0 deg from the LOCAL u axis (east end north)', 'K', 'map w97853782 every edge -6.0; LIDAR eaves lines parallel'],
  ['the whole range 2.4 m SOUTH of the map\'s outline (wing face t 0, north wall t -6.0)', 'K', 'LIDAR 2022 sections (eaves t +0.1 .. +0.9, ridge -2.9, north eaves -5.7 .. -6.0); the map traced leaning imagery'],
  ['Library bay breaks: pavilions 29.6 - 38.8 / 66.9 - 76.2, wings, frontispiece 46.44 - 59.26, all forward parts 1.0 m', 'K', 'map breaks (widths); photos c2021 and Street View 2015'],
  ['Library floor +0.90 (63.40 m)', 'K', 'four steps (look) over the path at +0.30 (LIDAR); step rise 0.15 G'],
  ['eaves cornice +9.6, capitals 7.8 and first-floor band 3.8 above the floor', 'K', 'photo c2021 scaled (36 px/m by floor and steps); LIDAR eaves 9.5 - 10.0'],
  ['ridge +12.05, stone-slate pitched roof, gabled ends', 'K', 'LIDAR ridge 11.75 - 12.05; photo c2021 (graded stone slates); gable ends G (no look at the ends\' roofs)'],
  ['chimney stacks at s 30.3, 38.6, 67.3, 75.6 on the ridge', 'K', 'LIDAR peaks >= 13.0; photos; top 13.6 G'],
  ['frontispiece: three bays, four rusticated piers 1.1 wide, six round arches on three Tuscan columns', 'K', 'photo c2021; look'],
  ['loggia arches glazed with dark frames 0.6 behind the arcade; glazed doors in the centre bay', 'K', 'look; photo c2021; brief'],
  ['giant engaged Ionic columns on the piers, entablature breaking forward over them, pedestals with ball finials', 'K', 'look; photo c2021 (sizes G)'],
  ['canted stone oriel on a carved corbel in the centre bay, three lights and transom', 'K', 'look; photo c2021 (figures G)'],
  ['segmental pediment over the centre bay with a cartouche', 'K', 'photo c2021: drawn as a blank shield; the "19 03" date not drawn'],
  ['two-light cross windows in eared stone architraves with aprons, first floor of frontispiece side bays and wings', 'K', 'photo c2021 (figures scaled)'],
  ['ground-floor windows of wings and pavilions, two-light transomed', 'K', 'photos; sill and head G (planting hides them)'],
  ['west wing second window', 'G', 'the magnolia hides it in every picture'],
  ['pavilions: three stone pilasters each (rusticated below the band), brick attic with stone coping, balls on pedestals', 'K', 'photo c2021 (east), Street View Holtby look (west pavilion top); west middle pilaster G'],
  ['frontispiece attic (brick) over the side bays', 'K', 'photo c2021; height G'],
  ['steps: five of 0.15 across the frontispiece and 0.3 beyond, steel handrail at the centre bay\'s east arch', 'K', 'photo c2021; look; going 0.36 G'],
  ['north face: plain brick, regular windows', 'G', 'seen in no look'],
  ['gap to ROQ West 0.6 - 0.9 m (gravel)', 'K', 'LIDAR (the brief\'s 1 - 3 m is not there); surface G'],
  ['east block s 76.2 - 79.9, flat top +7.0, two storeys, canted bay facing east with a pediment', 'K', 'map, LIDAR +7.0 .. +7.3, look folder 02'],
  ['east block canted bay size, pediment height, windows', 'G', 'look folder 02 by eye'],
  ['Holtby from s 2.5 (u -48, its west wall against Park) to the Library at s 29.6', 'K', 'map, LIDAR, brief'],
  ['Holtby\'s south front seen only east of s 9.05, Park\'s east wing\'s east face (the wing against it to the west); the loggia starts at the wing, its west pier against it', 'K', 'LIDAR; looks 04 Holtby south face and 06 Park east wing front (Street View 2015); part park S_EW1 (touch-up 1)'],
  ['Holtby: three storeys, six bays, small-paned sashes, parapet +9.55', 'K', 'look; LIDAR edge 9.5 - 9.64'],
  ['Holtby loggia: five square stone piers, glazed back wall with round-arched openings, globe lamps', 'K', 'look (Street View 2015)'],
  ['Holtby loggia depth 3.65, balcony 1.05 deep, floor -0.70', 'G', 'look by eye; LIDAR ground'],
  ['Holtby balcony railing, light iron lattice', 'K', 'look; height and pattern G'],
  ['Holtby pitched clay-tile roof with a glazed ridge behind the parapets, ridge 11.78', 'K', 'LIDAR; satellite; quad photo c2021'],
  ['Holtby north face buff brick with white sashes', 'G', 'look "ROQ West from the north-west" (a buff building with white sashes south of its west end: the survey asks whose)'],
  ['Holtby\'s stack at s 5.8 near its front, top 14.2', 'K', 'LIDAR peak 14.22'],
  ['Holtby\'s east-bay tall stair window', 'K', 'look; figures G'],
  ['beds 2.6 deep before the wings and pavilions, flagged apron before Holtby, brick raised bed at the east end', 'K', 'photo c2021; looks; widths G'],
];
