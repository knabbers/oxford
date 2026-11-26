// Exeter College, STANDALONE model, part 'hallint': THE PLAN of the Hall's INTERIOR (1618; the screen 1618 with
// Blomfield's 1904 gallery band; the screens passage vaulted by Nash 1818). Pure data: every dimension a named constant
// with its source; the build functions are in _exeter_hallint_build.js. Coordinates: the Hall's own SHEARED frame of
// _exeter_hall_build.js (hall u = LOCAL u; hall z = LOCAL v less 0.066 (u - 9.25): the long walls are lines of constant z),
// y above the datum 64.40 m.
//
// SOURCES (looked at by hand 2026-11-23; nothing copied):
//   * 22/01860/LBC (Jessop & Cook 2022, existing plans and internal elevations, 1:100 @ A1, its scale bar 59.06 px/m at
//     150 dpi): the plan (screens passage 2.45 deep, the screen 20.15 m from the east wall, the dais 4.0 m deep, both
//     fireplaces opposite each other at the middle buttress, the bay window, three rows of tables and the high table
//     across the dais, a stair in the passage's south-west corner, doors in the passage's west wall), the four
//     internal elevations (wall plate 8.1, corbels 6.2, arch braces to 10.75, apex 13.7; window splays; portraits;
//     panelling; three tiers of purlins with arched wind-braces; a plastered ceiling between the rafters).
//   * 05/00314/LBC (the gallery access, via the lead's harvest, DIMENSIONS.md second pass), heights above the floor:
//     screen 2.95, gallery floor 3.15, gallery front 4.3, crestings 5.4 - 5.6, doors 1.2 wide with tops at 2.65; the
//     gallery 2.4 deep; corbels 6.35, wall plate 8.25, arch braces to 10.85, ridge 13.6; the hall 8.30 wide.
//   * photographs (reference/exeter/03 .../interior/): RCHM 1939 plates 111 and 114, N Smith 2010 (looking east),
//     simononly 2012 (the north windows from inside: rectangular quarries, a roundel or shield in each light, deep
//     splays with sloping sills, coursed stone, dark arch braces on carved corbels), S Yeates 2006, E Webster 2011.
import { HALL, WIN, PORCH, ORIEL, BAYS_N, BAYS_S } from './_exeter_hall_plan.js';

export const F = HALL.floor;                 // 1.55: the Hall's floor. K (hall plan)
// ------------------------------------------------------------------------------------------------ the room in plan (hall frame)
export const ROOM = {
  zN: HALL.vN + HALL.wall,     // 22.2: the north wall's inner face. K: survey face + 1.1
  zS: HALL.vS - HALL.wall,     // 30.56: the south wall's inner face (8.36 wide: 05/00314 8.30, 22/01860 8.25 - 8.45). K
  uW: HALL.uW + HALL.wallE,    // -3.8: the west gable's inner face (the screens passage's west wall). G (wall 0.75)
  uE: HALL.uE - HALL.wallE,    // 19.05: the east (dais) wall. G (wall 0.75)
  screenE: -1.1,               // the screen's east face: 20.15 m from the east wall. K: 22/01860/LBC (figured scale)
  screenT: 0.3,                // its thickness (the west face -1.4: the passage 2.4 = the gallery's depth, 05/00314). K / G
  dais: { u: 14.9, h: 0.2 },   // the dais's step (4.15 deep; 22/01860: about 4.0). K; its height G
};
export const MID = (ROOM.zN + ROOM.zS) / 2;
// ------------------------------------------------------------------------------------------------ heights (above the floor F)
export const HT = {
  plate: 8.25,                 // wall plate. K: 05/00314 (22/01860: 8.1)
  corbel: 6.35,                // the corbels' tops (the wall posts stand on them). K: 05/00314
  arch: 10.85,                 // the arch braces' apex under the collar. K: 05/00314
  collar: 11.0,                // the collar's middle. G (just over the arch's apex)
  ridge: 13.6,                 // the boarding's apex inside. K: 05/00314 (22/01860: 13.7)
  purlins: [9.6, 11.05, 12.4], // three tiers of purlins. K: 22/01860 internal elevations (three bands of wind-braces); G figures
  wainscot: 1.9,               // the oak panelling's top on the long walls. K: 22/01860 (a line at 1.73) / photographs (about 2 - 2.5); G 1.9
  wainscotE: 2.25,             // on the dais wall. G (N Smith 2010)
};
export const PITCH = (HT.ridge - HT.plate) / ((ROOM.zS - ROOM.zN) / 2);      // 1.28 (52 deg). K (from the above)
/** the trusses (hall u): one against each gable and five between the bays: seven over six bays. K: 22/01860 (posts at
 *  the buttresses), RCHM; the u of each on the survey's buttresses (3.7, 7.5, 11.25), the oriel's corner (14.9) and
 *  between the porch window and the first bay (0.0). G +-0.2 */
export const TRUSSES = [ROOM.uW + 0.15, 0.0, 3.7, 7.5, 11.25, 14.9, ROOM.uE - 0.15];
// ------------------------------------------------------------------------------------------------ windows inside (rear arches)
// the splays join the glass (the outside's outline, at the end of its 0.32 m reveal) to a wider, taller rear arch in the
// room's face; sills slope down into the room. K: 22/01860 (north splays 3.3 wide, their bottoms 2.37 above the floor;
// south 2.4), simononly 2012 (deep sloping sills); G figures
export const REAR = {
  w: 3.0, rise: 1.25, spring: WIN.spring + 0.1,
  sillN: F + 1.95,             // north: a short slope from the glass (3.8) down to the wainscot. K form; G
  sillS: F + 2.4,              // south: a long slope from the glass (5.4). K: 22/01860 south elevation 2.4
  sillPassage: F + 3.45,       // the window over the passage: on the gallery. G
  porch: { w: 3.2, sill: PORCH.upper.sill - 0.4, spring: PORCH.upper.spring + 0.05, rise: 0.9 },   // over the gallery. G
};
export const NORTH_BAYS = BAYS_N, SOUTH_BAYS = BAYS_S;
// the oriel (dais bay): its recess in the north wall and its inside. K: 22/01860 (the bay opening about 3.4 m, a
// servery cupboard in it), the outside's oriel (hall plan); G: the recess's head
export const BAY = { u0: ORIEL.u0 + 0.3, u1: ORIEL.u1 - 0.25, head: F + 7.4, wall: 0.3 };
// ------------------------------------------------------------------------------------------------ the screen (west end)
// five bays: panel | door | panel | door | panel between four carved columns on pedestals (and pilasters at the walls);
// two round-arched doors with radiating fanlights; a frieze and cornice; Blomfield's band of small panels to the gallery
// floor; the gallery front (fielded panels between pedestal blocks); three pierced strapwork crestings (the middle one
// with a blank shield: the arms not drawn) and two obelisks between them. K: RCHM plate 114, S Yeates 2006, 05/00314
// (heights), 22/01860 west internal elevation (columns 0.75 and 2.33 m either side of the middle)
export const SCREEN = {
  top: 2.95, band: 3.15, front: 4.3, crest: 5.4, crestMid: 5.6, obelisk: 5.3,   // above F. K: 05/00314
  doorW: 1.2, doorTop: 2.65, doorZ: 1.54,     // the doors: 1.2 wide (K 05/00314), round heads (fanlights), middles 1.54 from the hall's middle (K 22/01860)
  cols: [0.75, 2.33],          // columns' middles from the hall's middle, both ways. K: 22/01860 west elevation (+-0.05)
  colR: 0.11, pedestal: [0.36, 0.62],    // G: proportions of plate 114
  frieze: [2.6, 2.95],         // the carved frieze and cornice under the band. K form (plate 114); G
};
export const GALLERY = { floor: SCREEN.band, depth: ROOM.screenE - ROOM.screenT - ROOM.uW };   // 2.4. K: 05/00314
/** the screens passage's plaster vault (Nash 1818): a segmental barrel across it, springing and crown above F. K: that
 *  it is vaulted (05/00314, 22/01860 "vaulted ceiling"); G: the form */
export const VAULT = { spring: 2.55, crown: 3.0 };
/** doors in the passage's west wall to the servery and the kitchen side (shut). K: 22/01860 plan (two openings); G: sizes */
export const WEST_DOORS = [{ z: 25.85, w: 1.0, h: 2.25 }, { z: 28.0, w: 1.0, h: 2.25 }];
/** the stair up to the gallery in the passage's south-west corner, boxed in oak with a shut door. K: 22/01860 plan
 *  (a stair there); G: boxed, its form */
export const STAIR = { u0: ROOM.uW, u1: ROOM.uW + 1.5, z0: ROOM.zS - 1.75, h: GALLERY.floor };
/** a door from the gallery to staircase 3 in the west gable. K: 22/01860 ("door into gallery"), 05/00314; G: size */
export const GALLERY_DOOR = { z: 23.4, w: 0.9, h: 2.0 };
// ------------------------------------------------------------------------------------------------ fireplaces
// both at the middle buttress, opposite each other. K: 22/01860 plan and both long elevations (the RCHM 1939 plate shows
// one by the screen: the present day stands). North: an oak surround (22/01860 "fireplace with oak surround"); south:
// a carved stone chimneypiece with an overmantel and two obelisks (RCHM 111, 22/01860 south elevation). G: sizes
export const FIRE = { u: 7.5, w: 2.7, open: [1.3, 1.15], surround: 1.75, breast: 0.35, overmantel: { w: 1.3, top: 3.3 } };
// ------------------------------------------------------------------------------------------------ furniture
// three long rows down the hall, broken at the fireplaces on the outer rows (a short table between); the high table
// across the dais. K: 22/01860 plan (rows and breaks), N Smith 2010 (chairs with aubergine upholstered backs, brass
// lamps with cream shades along the tables); RCHM 1939 shows benches (the present day stands). Capacity 154 (college).
export const ROWS = [
  { z: ROOM.zN + 1.4, pieces: [[0.2, 5.65], [6.5, 8.25], [8.75, 14.15]] },      // north row (centre z). K 22/01860; G +-0.2
  { z: MID, pieces: [[2.75, 14.15]] },                                           // the middle row
  { z: ROOM.zS - 1.4, pieces: [[0.2, 5.65], [6.5, 8.25], [8.75, 14.15]] },      // south row
];
export const TABLE = { w: 0.85, h: 0.76, top: 0.05, seg: 2.8 };      // G
export const HIGH = { u: 16.75, z0: ROOM.zN + 0.45, z1: ROOM.zS - 1.25, w: 0.9 };   // K: 22/01860 (across the dais); G sizes
export const CHAIR = { pitch: 0.62, seat: 0.46, w: 0.44, back: 0.95, off: 0.55 };   // G
export const LAMP = { pitch: 2.4, h: 0.55, shadeR: [0.09, 0.15], shadeH: 0.16 };   // G (N Smith 2010: on every table, about 2.4 m apart)
// ------------------------------------------------------------------------------------------------ the porch inside
export const PORCH_IN = { u0: PORCH.inner.u0, u1: PORCH.inner.u1, zF: PORCH.vF + 0.5, vault: [3.4, 4.0] };   // rib vault, above F. K: rib-vaulted (photo notes); G form

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['a real room behind the walls: the Hall, the screens passage, the porch and the gallery, walked in through two real oak leaves', 'K', 'owner\'s standing wish; _exeter_interior_kit.js (no fade, no teleport)'],
  ['floor 1.55 above the datum, level through porch, passage and hall', 'K', '22/01860/LBC elevations and plan (no step inside); 05/00314'],
  ['inside 8.36 wide (walls 1.1 inside the surveyed faces), 20.15 from the screen to the east wall, the passage 2.4', 'K', '05/00314 (8.30), 22/01860 (8.25 - 8.45, 20.15, 2.45)'],
  ['gable walls 0.75 thick (west inner face -3.8, east 19.05)', 'G', 'RCHM 23.0 m inside against the survey\'s 24.35 outside'],
  ['wall plate 8.25, corbels 6.35, arch-brace apex 10.85, ridge inside 13.6 (pitch 52 deg)', 'K', '05/00314 via DIMENSIONS.md second pass; 22/01860 within 0.15'],
  ['seven arch-braced collar trusses (one at each gable), wall posts on carved stone corbels, curved braces to a pointed arch, struts to the principals', 'K', 'RCHM 111, simononly 2012, 22/01860 internal elevations'],
  ['truss positions on the buttresses', 'G', 'survey buttresses; 22/01860 posts'],
  ['three tiers of purlins with arched wind-braces in every panel, close rafters, a plastered ceiling between them', 'K', '22/01860 ("plastered ceiling between rafters"); RCHM 111'],
  ['purlin heights, rafter spacing 0.5', 'G', 'by eye on 22/01860'],
  ['windows: the outside\'s openings with real glass; deep splays to wider four-centred rear arches; sloping sills', 'K', 'simononly 2012; 22/01860 splays (3.3 wide; bottoms 2.37 north, 2.4 south)'],
  ['rear-arch sizes (3.0 wide, springing 8.1, rise 1.25), north sill slope', 'G', '22/01860 by eye'],
  ['heraldic glass: small plain-coloured roundels (no arms) in clear leaded quarries you see the quad through', 'K', 'simononly 2012 (clear rectangular quarries, shields and roundels); rule: no arms'],
  ['one roundel 0.19 across in the middle light of each tier (fewer and smaller than the photograph\'s one a light)', 'G', 'the lead\'s review 2026-11-23 (the glass read as frosted panes)'],
  ['coursed stone walls above oak panelling', 'K', 'simononly 2012, N Smith 2010'],
  ['panelling 1.9 high on the long walls, 2.25 on the dais wall', 'G', '22/01860 (1.73 line), photographs (2 - 2.5)'],
  ['the dais wall plastered above its panelling', 'K', '22/01860 ("plastered wall"); N Smith 2010'],
  ['portraits: plain dark frames with a muted smudge, no likeness; a big one in the middle of the dais wall, rows on the piers and over the gallery', 'K', '22/01860 elevations (places); N Smith 2010; rule: no likeness'],
  ['screen: five bays between four columns on pedestals, two round-arched doors 1.2 wide with fanlights (tops 2.65), frieze and cornice to 2.95, band to the gallery floor 3.15, gallery front to 4.3, three strapwork crestings to 5.4 - 5.6 and two obelisks', 'K', 'RCHM 114, S Yeates 2006, 05/00314, 22/01860 west elevation'],
  ['screen doors: real oak leaves (two pairs) opening into the hall', 'K', '22/01860 plan (leaves swinging east); leaves 0.6 x 2.05 G'],
  ['strapwork drawn as pierced rings and scrolls of flat bars; the middle cresting\'s shield blank', 'G', 'simplified from RCHM 114; rule: no arms'],
  ['gallery 2.4 deep over the passage, floor at 3.15; a door to staircase 3 in the west gable', 'K', '05/00314, 22/01860 ("door into gallery")'],
  ['screens passage: a plaster barrel vault (Nash 1818), flagged floor, two shut doors in its west wall to the servery / kitchen, a boxed stair in its south-west corner', 'K', '05/00314 (vaulted), 22/01860 plan (doors, stair)'],
  ['the vault\'s form, the doors\' sizes, the stair boxed in oak', 'G', 'not drawn in detail'],
  ['porch inside: rib-vaulted, the door\'s fixed head and two leaves, the arch into the passage', 'K', 'photo notes (rib-vaulted porch); 22/01860 north elevation (the arch, apex 3.05)'],
  ['porch vault form and heights', 'G', 'not seen'],
  ['two fireplaces opposite at the middle buttress (u 7.5): north with an oak surround, south a carved stone chimneypiece with an overmantel and obelisks', 'K', '22/01860 plan and elevations; RCHM 111 (the stone one)'],
  ['RCHM 1939 shows the south fireplace by the screen; the 2022 drawings put it opposite the north one', 'K', 'present day stands (22/01860)'],
  ['fireplace sizes', 'G', '22/01860 by eye'],
  ['floor: square white flags with small black diamonds at the corners (0.6 m)', 'K', 'N Smith 2010, RCHM 111; flag size G'],
  ['dais one step up (0.2) from u 14.9 to the east wall; the oriel bay in its north side', 'K', '22/01860 (raised floor about 4.0 deep, bay window); step height G'],
  ['three rows of long tables (the outer rows broken at the fireplaces with a short table between), the high table across the dais', 'K', '22/01860 plan; N Smith 2010'],
  ['chairs with aubergine upholstered backs, about 140 seats (college: 154)', 'K', 'N Smith 2010; count G'],
  ['brass table lamps with cream shades about 2.4 m apart, lit (they glow; after dark their light falls on the tables and floor through the city\'s light map)', 'K', 'N Smith 2010, RCHM 111; spacing G'],
  ['undercroft (the bar) not built: the Hall\'s floor is solid; its stair from the quad ends at a shut door under the north wall (part hall)', 'G', 'brief; 08/00644/LBC'],
  ['oak, tables and chairs tinted for the room\'s own light by day (warm mid-brown panelling, chestnut tables, aubergine chairs)', 'K', 'N Smith 2010 (looking east); tints by eye G (2026-11-23: they read near-black by day)'],
];
