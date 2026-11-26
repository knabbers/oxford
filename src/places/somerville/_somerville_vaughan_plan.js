// Somerville College, STANDALONE model, part 'vaughan' (survey B09): THE PLAN of VAUGHAN and MARGERY FRY & ELIZABETH
// NUFFIELD HOUSE ("Fry") (1958-66, Arup Associates, Philip Dowson), the PODIUM they stand on over the Little Clarendon
// Street shops with its street ARCADE, the walkway decks round Vaughan's east end and along Fry's north side, THE
// TERRACE bar pavilion against Vaughan's south face (adp 2011, planning 11/03166) and the passage from Little Clarendon
// Street under the decks into the college. Pure data: every figure a named constant with its source; the build
// functions are in _somerville_vaughan_build.js. Brief: docs/handoff/somerville/briefs/vaughan.txt.
//
// FRAME: everything here is square to the LOCAL frame (u east, v south; the map's long walls turn -0.1 deg (Vaughan) and
// -1.1 deg (Fry); the LIDAR cannot tell 0.4 m over Fry's 22 m), so the part works in LOCAL coordinates throughout.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (tools/somerville_lidar.py fbox -48 62 20 62 0 38, line): VAUGHAN's flat roof +13.7 .. +13.8 over
//     u -43 .. -12, v 67.5 .. 80.5 (edges +-0.7), its rooflight to +16.3 over u -33 .. -22, v 72.5 .. 76.5; the walkway
//     east of it +2.83 .. +2.88 over u -12 .. -5, v 68 .. 84 and along v 79 .. 84 to u 12; the deck over the shops
//     +3.54 (66.04) over u -40 .. -6, v 85.5 .. 96; the pavilion's roof +6.5 .. +6.7 over u -33.5 .. -16.5, v 80.5 .. 85;
//     FRY's flat roof +14.4 over u -5 .. 18, v 85 .. 96.5 with its rim +15.1 .. +15.3 at the edges, the rooflight and
//     plant +15.5 .. +16.6 over u 3 .. 10, v 89 .. 92, something tall at u 18 (the spiral stair); the street at v 98:
//     -0.15 (u -40), +0.07 (-30), +0.22 (-20), +0.44 (-8), +0.59 (0), +0.74 (15).
//   * Planning drawings (reference/somerville/20 planning drawings/DIMENSIONS.md and the drawings themselves, read by
//     eye and by pixel against their scale bars): 11/03166 (adp 2011, "drawn from record information"): the terrace's
//     finished level FFL 65.370, slab 65.220, the pavilion's cill 65.890, transom 67.590, roof edge 69.170, roof 9.5 deg
//     falling to Vaughan, outer glazing 4.2 m from Vaughan's frame line (section AA scaled 61.8 px/m), Vaughan's first-
//     floor slab edge (the deep fascia) 67.47 .. 68.28 (scaled), structural grid B-C 5350, C-D 5400, D-E 5275 (the
//     pavilion B .. E), F 0.7 m from Vaughan's east end (scaled), 12 glazed panels; NMLA / Sylva: Vaughan's parapet 77.12 /
//     77.14. 24/00480 (Cellnex 2019 / 2023, 1:100): Fry's parapet wall 1.1 m high, roof 13.8 and the rim's top 14.9 m
//     above "G.L." (taken as the street at Fry, +0.6: GUESS, it puts the roof on the LIDAR's +14.4), eight frame bays to
//     the street, four segmental arches under them, the spiral stair at the east end, the chimney (its tiers and the
//     arcade's heights there are schematic and are NOT used).
//   * Photographs (folder 10, LOOKS_BY_HAND "Little Clarendon Street", folder 09, aerial 2016, satellite): counts and
//     forms: Vaughan 11 bays a long face, three window tiers and an open rim over a recessed first floor (south: the
//     terrace storey; north: over a lower ground floor); Fry's west end three bays wide-narrow-wide, three tiers and a rim
//     of five openings over a recessed glazed floor a few steps above the terrace (the sculpture); Fry's street face over
//     a band of brown brick, a clerestory strip and the arcade; the east end a blank concrete wall with the spiral stair;
//     the podium's brown brick parapet with railing panels over the arcade's shallow segmental beams.
import { Y } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ levels
export const DECK_LOW = Y(65.37);             // +2.87 the walkway / Vaughan's first floor / the terrace strip. K: 11/03166 FFL 65.370 (figured); LIDAR +2.83 .. +2.88
export const DECK_UP = 3.50;                  // the deck over the shops (66.00). K: LIDAR 66.04 (+3.54); survey section 2 (66.0); adp cill 65.89 just under it
export const DECK_SLAB = 0.40;                // deck build-up (paving, slab) above its soffit. G

// ------------------------------------------------------------------------------------------------ the concrete frames (both blocks)
export const FRAME = {
  D: 1.00,          // the frame's face stands 1.0 m proud of the recessed windows. K: brief / LOOKS_BY_HAND ("about 1 m proud"), photos; G: figure
  PW: 0.38,         // a post's width. K: Fry west end straight on (J Cairns 2021: 25 px of a 66 px/m face); G +-0.05
  EPW: 0.50,        // the corner posts. G
  BEAM_UP: 0.30,    // the floor beam stands this far above a floor (the openings start here). G: photos (beam bands 0.45 m)
  BEAM_DN: 0.15,    // and this far below the next floor. G
  R: 0.28,          // the openings' rounded inner corners. K: photos (rounded corners); G: radius
  RAIL: 0.95,       // the precast balustrade rail across each opening, above the floor. K: photos (a rail in every bay); G: height
  RD: 0.30,         // the rim's thickness (its openings go through). G
  RIM_BOT: 0.20,    // rim openings from the roof + this. G
  RIM_TOPBAR: 0.28, // the rim's top rail. G: photos
  RIM_POST: 0.30,   // the short post splitting a wide bay's rim opening in two. K: Fry west end (five rim openings over three bays)
  WIDE: 3.50,       // a bay wider than this has two rim openings and its window at its outer side. G
  WIN: 0.55,        // a normal bay's window takes this share of the bay, the rest a buff panel. K: photos (window + panel in every bay); G: share
  WIN_WIDE: 1.70,   // a wide end bay's window. K: Fry west end; G: width
};

// ------------------------------------------------------------------------------------------------ Vaughan
export const V = { u0: -43.70, u1: -12.50, v0: 67.30, v1: 80.40 };   // the frame's outer faces. K: LIDAR roof u -44 .. -11.5, v 67.5 .. 80.5 (edges +-0.7); map w97853781 u -43.6 .. -13.4, v 67.2 .. 80.2; adp elevation (pavilion E 5.0 m from the east end) and the LIDAR pavilion end at -17.5 put the east face at -12.5
export const V_BAYS = 11;                     // bays a long face. K: Wikipedia (11 frame bays), Wellington Square photograph 2011, adp elevation
export const END_NARROW = 2.20;               // the narrow middle bay of an end (wide-narrow-wide). K: Fry west end; G: that Vaughan's ends are framed the same (unseen)
export const V_LG = -0.75;                    // lower ground floor. G: the ground at the north foot -0.2 .. -0.4 (LIDAR v 66), garden -0.62
export const V_F1 = DECK_LOW;                 // first floor = the terrace. K: 11/03166 FFL
export const V_FASCIA = [4.97, 5.78];         // the deep first-floor slab edge under the frame. K: 11/03166 section AA scaled (67.47 .. 68.28)
export const V_FLOORS = [5.78, 8.41, 11.04];  // the three framed floors. K: fascia top; three equal tiers to the roof (2.63); photos (three tiers)
export const V_ROOF = 13.67;                  // K: LIDAR roof +13.7 .. +13.8
export const V_RIM = Y(77.12);                // +14.62 the rim's top (the parapet). K: NMLA 77.12, Sylva 77.14 (figured)
export const V_WALL_IN = 1.20;                // the recessed first floor (and the north lower ground's balcony) behind the frame face. K: 11/03166 section AA (wall 1.4 behind grid 02); G
export const V_LG_IN = 0.15;                  // the lower ground wall on the north and west, under the balcony. G
export const V_ROOFLIGHT = { u0: -33.0, u1: -22.0, v0: 72.5, v1: 76.5, eaves: 14.05, ridge: 15.55, box: { u0: -29.6, u1: -25.4, v0: 73.6, v1: 75.4, top: 16.30 } };   // K: LIDAR (+16.3 at its middle), aerial 2016 (a pitched glazed roof with a raised box); G: the form's sizes

// ------------------------------------------------------------------------------------------------ the Terrace bar pavilion (adp 2011)
export const PAV = {
  u0: -33.50, u1: -17.50,                     // grid B .. E: 5350 + 5400 + 5275 = 16.03. K: 11/03166 (figured); LIDAR roof u -33.5 .. -16.5
  vIn: V.v1 - V_WALL_IN,                      // it runs back under the fascia to Vaughan's recessed wall. K: section AA
  vGrid: V.v1,                                // grid 02 = Vaughan's frame line, where the roof meets the fascia. K: section AA
  v1: V.v1 + 4.20,                            // the outer glazing. K: section AA 4.2 m (scaled); LIDAR roof to v 85
  floor: DECK_LOW,                            // K: FFL 65.370
  sill: Y(65.89), transom: Y(67.59), edge: Y(69.17),   // K: figured
  pitch: (9.5 * Math.PI) / 180,               // K: figured 9.5 deg, falling to Vaughan
  panels: 12,                                 // K: 11/03166 elevation (four to a grid bay)
  endPanels: 3,                               // G
};

// ------------------------------------------------------------------------------------------------ Fry
export const F = { u0: -5.30, u1: 16.90, v0: 84.80, v1: 97.20 };    // the frame's outer faces. K: LIDAR roof u -5.5 .. 18 (the stair beyond 16.9), v 84.6 .. 96.8; map w97853752 u -6.7 .. 17.5, v 85.8 .. 97.7; 24/00480 face 22.2 m (693 px at 31.2 px/m)
export const F_BAYS = 8;                      // bays to the street and (G) to the north. K: 24/00480 south-east elevation; Wikipedia (8 bays)
export const F_F1 = 3.90;                     // Fry's first floor, a few steps above the deck. K: photographs (steps up to the sculpture's corner); G: level
export const F_FASCIA = [6.15, 6.39];         // the frame's underside over the clerestory strip (touch-up 1: was 5.60, with the band raised).
                                              // K: 24/00480 "podium 5.0 m" = the first framed floor +6.4 when its G.L. is +1.4 (the same G.L. puts
                                              // its roof 13.0 / parapet 13.8 on the LIDAR's +14.4 / +15.2); Fry street face close (2022): a
                                              // clerestory strip about 0.3 m between the band and the frame; G: +-0.15
export const F_FLOORS = [6.39, 9.06, 11.73];  // K: three tiers (photos) under the LIDAR roof; G: equal tiers
export const F_ROOF = 14.40;                  // K: LIDAR +14.4; 24/00480 roof 13.8 above G.L.
export const F_RIM = 15.50;                   // K: 24/00480 rim 14.9 above G.L. (1.1 m parapet wall); LIDAR rim +15.1 .. +15.3 (thin: under-read)
export const F_WALL_IN = 1.00;                // the recessed first floor behind the frame (west and north). G
export const F_STREET = { brickTop: 5.85, brickFace: 96.90, clereFace: 96.60 };   // the brown blind brick band and the clerestory strip over the arcade.
                                              // TOUCH-UP 1: the band rises 2.5 m over the arcade beam (was 1.8): brick courses counted in "Fry street
                                              // face close" (2022: 33 - 35 courses of 75 mm and a soldier course) and "the gated passage" (2026: Fry's band
                                              // 35 courses against the podium parapet's 20 beside it on the same beam; LIDAR parapet +4.72); the look's
                                              // "about 3 m". K: those counts (+-0.2); G: set-backs
export const F_EAST_BRICK = 16.60;            // the brick storey under the blank east end. K: Eyre 2011 (brick wall storey under the concrete end wall); G: set-back
export const F_STAIR = { u: 18.10, v: 90.20, r: 1.10, top: 15.20, step: 0.19 };   // the black steel spiral escape stair. K: Eyre 2011, 24/00480, LIDAR (u 18 tall); G: place along the end, radius
export const F_FLUE = { u: 12.40, v: 91.60, r: 0.45, top: 18.90 };                // the tall concrete flue. K: photos (behind the south-east), 24/00480 ("chimney" east of middle); G: place, height
export const F_ROOFLIGHT = { u0: 3.00, u1: 10.00, v0: 88.60, v1: 92.40, top: 15.90 };   // K: LIDAR +15.5 .. +16.6, satellite (glazed rooflight); G: form
export const F_PLANT = [[-1.5, 90.0, 1.2, 0.8, 1.6], [13.5, 87.0, 0.7, 0.7, 1.4], [13.5, 95.0, 0.7, 0.7, 1.4], [1.0, 95.5, 0.7, 0.7, 1.4]];   // [u, v, w, d, h] the telecom shrouds and cabinets. K: 24/00480 (antennas at 16.0 above G.L.); G: places
export const F_PLATFORM = { u0: F.u0, u1: F.u0 + F_WALL_IN, v0: 85.10, v1: 96.75 };     // the raised paving under the west overhang. G
export const F_STEPS = { u0: -6.20, v0: 85.40, v1: 96.40, n: 3 };                        // three steps up to it from the deck. K: photograph (steps, handrail, sculpture); G: run
export const SCULPTURE = { u: -4.85, v: 86.10 };                                         // a stone sculpture on a brick plinth. K: photographs (c2022, J Cairns 2021); G: place
export const F_DOOR = { u0: 0.40, u1: 2.00, h: 2.35 };                                   // no. 14: a pair of timber doors in the white-painted ground floor. K: Street View 2022; G: place

// ------------------------------------------------------------------------------------------------ the podium, the arcade, the shops
export const POD = { u0: -38.50, u1: F.u0, v0: PAV.v1, front: 97.20, t: 0.35 };   // K: LIDAR deck u -40 .. -6, v 85.5 .. 96; map w355810535 u -38.4 .. -6.6, front v 97.3; G: the deck's west wall line
export const ARC = {
  posts: Array.from({ length: 11 }, (_, i) => +(16.70 - 5.50 * i).toFixed(2)),   // post centres from Fry's east end: 4 arches under Fry (24/00480), one module on to the podium's west end. K: 24/00480 (two frame bays an arch), Wellington Square photo (an arch about two Vaughan bays); G: module 5.5 (brief by eye 4.6)
  pw: 0.40,                                   // square precast posts. K: photos; G: size
  spring: 2.75, crown: 3.05, top: 3.35,       // the beam's springing, the crown of its soffit, its top. K: shallow segmental beams (photos); G: levels (the street rises 0.9 m along it)
  walk: 94.40,                                // the shop fronts, 2.8 m behind the posts' faces. K: LOOKS_BY_HAND ("a covered walk about 3 m deep"); G
  soffitPod: DECK_UP - DECK_SLAB - 0.05,      // +3.05 under the podium. G
  soffitFry: F_F1 - DECK_SLAB,                // +3.50 under Fry. G
};
export const PARAPET = { top: 4.65, rail: 0.30, openW: 2.20 };   // brown brick parapet over the beams; railing panels in openings; a light handrail over it. K: LIDAR +4.72 at v 96 (the edge), brief ("about 1.1 m above the deck"), photos (openings with black railings, the rail on posts); G: opening width
// the merge: the city's Little Clarendon Street pavement (0.13 over the surveyed ground) begins about v 98.4 (measured in
// the game, 2026-11-24); the walk's paving runs out to PAVE_EDGE under its inner edge. K: the game's city; G: the overlap
export const PAVE_UP = 0.13, PAVE_EDGE = 98.75, PAVE_DRAW = 98.3;      // (walked to PAVE_EDGE; drawn to PAVE_DRAW, the foot of the city's kerb ramp, never under its pavement)
export const SHOP = { riser: 0.45, fascia: 2.70 };              // plain glazed shop fronts. K: photos; G: heights
export const TUNNEL = { u0: -9.55, u1: -6.55, v0: 67.60, v1: ARC.walk, wall: 0.30, ceilLow: DECK_LOW - 0.35, ceilUp: ARC.soffitPod };   // the way under the decks into the college. K: the college's map ("entrance under the Terrace, between Vaughan and Fry"), Wikipedia ("a tunnel under them into the college"), LIDAR (ground -0.2 .. +0.4 along u -8 under the decks); G: the line and width of its NORTH part (under the walkway: seen in no look)
// ITS SOUTH PART, from the street to the podium's edge, CONFIRMED by a look (touch-up 1): 10 .../the gated passage into the college ... (Street
// View Mar 2026; LOOKS_BY_HAND): the FULL arcade bay immediately west of Fry (posts u -10.8 / -5.3) is the mouth, between the shops' white
// end wall (west, a notice board on it) and Fry's white-painted ground floor (east); brick-sett paving out to the posts; a pair of black
// iron bar gates a few metres in (drawn standing open, swung in against the side walls). K: the look (place, kind); G: the figures
export const MOUTH = { u0: -10.10, u1: -5.90, gateV: 92.20, gateH: 2.55, bar: 0.12, board: { v: 93.55, w: 0.85, y0: 1.0, y1: 2.1 } };
export const STAIR_UP = { segs: [[POD.u0, PAV.u0], [PAV.u1, F.u0]], vTop: PAV.v1, n: 3 };   // four risers from the terrace strip up to the deck. K: LIDAR (+2.87 / +3.54 meet at v 85), photograph (a step line across the paving); G: risers, run
export const LOW = {                          // the walkway deck at +2.87: round Vaughan's east end and along Fry's north side to the site's edge; the terrace strip along Vaughan's south
  rings: [
    [[POD.u0, V.v1 - V_WALL_IN], [PAV.u0, V.v1 - V_WALL_IN], [PAV.u0, PAV.v1], [POD.u0, PAV.v1]],      // the strip west of the pavilion
    [[PAV.u1, V.v1 - V_WALL_IN], [V.u1 - V_WALL_IN, V.v1 - V_WALL_IN], [V.u1 - V_WALL_IN, V.v0 + V_WALL_IN], [-12.65, V.v0 + V_WALL_IN], [-12.65, 67.60], [-4.90, 67.60], [-4.90, 80.00], [17.60, 80.00], [17.60, F.v0], [F.u1, F.v0], [F.u1, F.v0 + F_WALL_IN], [F.u0 + F_WALL_IN, F.v0 + F_WALL_IN], [F.u0 + F_WALL_IN, F.v0], [F.u0, F.v0], [F.u0, PAV.v1], [PAV.u1, PAV.v1]],
  ],
  // K: LIDAR (+2.87 over u -12 .. -5, v 68 .. 84 and v 79 .. 84 to u 12 .. 13); part 'chapel' builds the retaining walls on u -4.9 and v 80.0 (its plan RWALL_W / RWALL_S, "WHERE I STOPPED") and the flight from its terrace (+1.62) up to here
  northWall: { u0: -12.65, u1: -5.80, v: 67.60, t: 0.30 },   // its face to the Chapel's forecourt, with the passage's mouth; part chapel's steps' cheek takes it on from u -5.8. G
  planter: { u0: -5.30, u1: -3.10, v0: 74.00, v1: 79.00, top: 3.70 },   // the raised planter on the walkway's east edge. K: LIDAR +3.5 .. +3.9 (u -5 .. -3, v 74 .. 79), left to this part by the lead; G: form
  eastEnd: 17.60,                             // the site's line (map). K
};
export const CHAPEL_TERRACE = 1.62;           // part chapel's kitchen-garden terrace (its TY). K
export const RAIL_H = 1.05;                  // iron railings on the decks' open edges. G
export const LAMPS_DECK = [[-30.0, 90.5], [-20.0, 90.5], [-12.0, 82.5], [4.0, 82.5]];   // lamp standards on the decks. G (the photographs show festoon lights)
export const TABLES = [[-34.5, 89.0], [-28.0, 92.5], [-22.5, 88.5], [-16.0, 92.0], [-36.0, 82.0]];   // picnic tables. K: photographs (tables, parasols); G: places
export const PLANTERS = [[-36.5, 95.8], [-24.5, 95.8], [-13.5, 95.8], [-20.0, 85.6], [-11.5, 85.6]];    // planters (palms, phormium). K: photographs; G: places

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['Vaughan: place and size, frame faces u -43.7 .. -12.5, v 67.3 .. 80.4', 'K', 'LIDAR roof extent; map w97853781; 11/03166 elevation (pavilion E 5.0 m from the east end)'],
  ['Vaughan: 11 frame bays a long face', 'K', 'Wikipedia; Wellington Square photograph (Eyre 2011); 11/03166 elevation'],
  ['Vaughan: first floor / terrace +2.87 (65.37)', 'K', '11/03166 FFL 65.370 (figured); LIDAR +2.83 .. +2.88'],
  ['Vaughan: deep first-floor fascia +4.97 .. +5.78', 'K', '11/03166 section AA, scaled (+-0.1)'],
  ['Vaughan: three framed tiers to the roof +13.67, rim to +14.62', 'K', 'photographs (three tiers and the open rim, both faces); LIDAR roof; NMLA / Sylva parapet 77.12 / 77.14'],
  ['Vaughan: tier heights equal (2.63)', 'G', 'between the figured fascia and the LIDAR roof'],
  ['the frame: posts 0.38, 1.0 m proud, rounded openings, a precast rail in every bay, window + buff panel behind', 'K', 'photographs (Cairns 2021 straight on, Gast 2019, Street View); G: post, beam and radius sizes, the window share'],
  ['Vaughan: the ends framed wide-narrow-wide like Fry\'s west end', 'G', 'no photograph of either end'],
  ['Vaughan: recessed first floor 1.2 m behind the frame; on the north and west a lower ground floor with a railed balcony over it', 'K', 'Gast 2019 (recessed glazed floor with a railing under the frame, from the Chapel lawn); 11/03166 section AA; G: the lower ground\'s face and windows (behind the garden wall in every view)'],
  ['Vaughan: lower ground floor -0.75', 'G', 'LIDAR ground at the north foot -0.2 .. -0.4'],
  ['Vaughan: columns under the fascia on the deck sides', 'K', 'Cairns 2021 (a column at the terrace level), c2022 corner photograph; G: spacing'],
  ['Vaughan: the pitched glazed rooflight with a raised box', 'K', 'LIDAR (+16.3), aerial 2016, satellite; G: sizes'],
  ['the Terrace pavilion: grid B .. E 16.03 m, 4.2 m deep, cill 65.89, transom 67.59, edge 69.17, roof 9.5 deg to Vaughan, 12 panels', 'K', '11/03166 elevation and sections AA / BB (figured; depth scaled)'],
  ['the pavilion\'s end glazing, door places, frame sizes', 'G', 'photographs (dark grey framing, glazed doors)'],
  ['Fry: place and size, frame faces u -5.3 .. 16.9, v 84.8 .. 97.2', 'K', 'LIDAR roof; map w97853752; 24/00480 (face 22.2 m)'],
  ['Fry: 8 bays to the street, 3 tiers and a rim, west end wide-narrow-wide with five rim openings', 'K', '24/00480 south-east elevation; Cairns 2021 (west end straight on); Street View 2026'],
  ['Fry: north face framed in 8 bays', 'G', 'not seen in any look'],
  ['Fry: roof +14.4, rim +15.5', 'K', 'LIDAR; 24/00480 (13.8 / 14.9 above G.L., G.L. taken as +0.6)'],
  ['Fry: first floor +3.9 a few steps above the deck, recessed glazing on the west', 'K', 'photographs (steps and sculpture at the corner; recessed glazed floor); G: level'],
  ['Fry: street face: blind brown brick band +3.35 .. +5.85 (2.5 m over the arcade beam), clerestory strip to +6.15, the frame from there', 'K', 'brick courses counted in Fry street face close (2022) and the gated passage look (2026); 24/00480 podium 5.0 m (G.L. +1.4) (touch-up 1; +-0.2)'],
  ['Fry: blank concrete east end over a brick storey; black spiral escape stair; tall flue', 'K', 'Eyre 2011; 24/00480; LIDAR (u 18); G: stair place along the end, flue place and height'],
  ['Fry: rooflight and roof plant', 'K', 'LIDAR, satellite, 24/00480; G: forms'],
  ['Fry: no. 14 doors, cycle racks, the gate at the arcade\'s east end', 'K', 'Street View 2022 / 2026; G: places'],
  ['the deck over the shops +3.50, the terrace strip and walkway +2.87, four risers between at v 84.6', 'K', 'LIDAR 66.04 / 65.37; 11/03166; G: the steps\' run'],
  ['the walkway round Vaughan\'s east end and along Fry\'s north side to u 17.6, stopping at u -4.9 / v 80.0 against part chapel\'s walls', 'K', 'LIDAR; _somerville_chapel_plan.js (RWALL_W, RWALL_S, its flight up)'],
  ['the arcade: one run from u -38.5 to 16.9, square posts, shallow segmental beams, 11 posts at 5.5 m', 'K', 'Street View 2022 / 2026, Wellington Square 2011, 24/00480 (4 arches under Fry); G: module and heights'],
  ['the podium parapet: brown brick, railing panels in openings, a handrail over it', 'K', 'Street View 2026, Eyre 2011, LIDAR +4.72; G: opening places'],
  ['the podium\'s and Fry\'s brick colour: dark brown (tint vBrick, touch-up 2: was red)', 'K', 'Fry street face close (2022), looking east along the podium arcade (2026), the gated passage (2026); G: the tint figures'],
  ['shop fronts 2.8 m back under the podium, plain glazed, no names', 'K', 'Street View 2026; G: the fronts\' divisions; names left off'],
  ['the passage from Little Clarendon Street: its mouth the full arcade bay immediately west of Fry (u -10.1 .. -5.9), white side walls, brick-sett paving out to the posts, a pair of black iron bar gates a few metres in (open), a notice board on the west wall', 'K', '10 .../the gated passage into the college ... (Street View Mar 2026; LOOKS_BY_HAND) (touch-up 1; figures G)'],
  ['the passage\'s north part under the walkway to the Chapel forecourt, u -9.55 .. -6.55', 'G', 'the college\'s map, Wikipedia ("a tunnel under them"); LIDAR ground; seen in no look'],
  ['the terrace: dark blue-brown brick pavers (touch-up 1: were too red), tables, planters, lamps', 'K', 'Cairns 2021 photographs; G: places, tint'],
];
