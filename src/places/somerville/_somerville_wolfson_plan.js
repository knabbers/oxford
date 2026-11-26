// Somerville College, STANDALONE model, part 'wolfson' (survey B06): THE PLAN of the Wolfson Building (1966-7, Arup
// Associates, Philip Dowson; listed II, LE 1393210), the Flora Anderson Hall pavilion standing forward of its ground
// floor (Niall McLaughlin Architects, 2011-13), the stair links to Park and Penrose, and the Walton Street boundary wall
// along them (v 4 .. 46). Pure data: every figure a named constant with its source; the build functions are in
// _somerville_wolfson_build.js. Brief: docs/handoff/somerville/briefs/wolfson.txt.
//
// WOLFSON'S OWN FRAME (S.ownFrame): s runs SOUTH along the east column line from the frame's north end (s 0 at the outer
// face of the northernmost column), t runs WEST (to the right walking south): t 0 is the east slab line, t TW the west
// slab line; y above the datum 62.50 as everywhere. The frame is turned 0.6 deg from the LOCAL v axis (going south u
// grows by 1 cm a metre).
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (tools/somerville_lidar.py lbox / line / fbox): the flat roof reads 72.94 - 72.98 (+10.46) over u -81.8 ..
//     -71.6, v 9.5 .. 29.3 (with the bays' tops at the edges); the raised rooflight box +12.27 - 12.30 over u -78 .. -75.5,
//     v 16.3 .. 23.2 with sloping flanks (+11.4 - 11.6); the north link +8.6 at v 4.5 - 6 rising to +9.9 at v 9; the south
//     link +10.0 at v 29.5 falling to +9.4 at v 31; the Flora Anderson Hall roof 64.40 - 64.44 (+1.92) over u -71 .. -64,
//     v 9 .. 29, a lower rim (+1.6 - 1.7) to u -62, the roof's edge between u -62 and -61.5; the Walton Street wall's top
//     63.9 - 64.0 (+1.45) at u -89, the pavement 60.9 (-1.6); the ground at Wolfson's west foot 61.5 (-1.0); the DTM
//     returns under the Hall's pergola 60.6 - 60.9 (-1.6 .. -1.9): the sunken strip along its glazed front.
//   * THE MAP IS 2.2 M NORTH OF THE LIDAR HERE: the map's toothed outline w97853773 puts the slab at v 6.4 .. 26.7, the
//     LIDAR roof at v 9.5 .. 29.3 (same length, 20.0 - 20.3 m); the rooflight's centre, the Hall's roof and Park's south
//     gable all read 2.0 - 2.5 m south of the map. LIDAR wins (it is the measured roof; the map was traced on leaning
//     imagery). Width: map 9.8 m wall to wall, 0.75 - 0.85 m bays; LIDAR roof 9.6 - 10.0 plus the bays.
//   * NMLA's east elevation-section through the Hall (2013, reference/somerville/08 .../drawing Wolfson east
//     elevation-section through FAH (NMLA 2013).jpg) read by pixel runs and scaled between two LIDAR levels (roof +10.46,
//     the Hall's roof +1.90: 49.6 px a metre): bay pitch 4.19, a box's columns 3.02 apart (centres), columns 0.20 - 0.24,
//     box 2.52 wide, tier pitch 2.82, box tops +10.26 / +7.44 / +4.62, splayed soffits 0.32 deep, posts 0.55 above the
//     roof, the Hall's floor -1.97, its door 2.85 tall; the rooflight 7.86 m long at its foot, 6.85 at its top, 1.81 high.
//   * Photographs (folder 08): both faces square on (Street View 2015 / 2026 by hand), NMLA 2013 (east face straight on,
//     from the south-east), J Cairns 2021, NMLA 2019 (Walton Street); Penrose west end look (folder 07): counts (5 bays,
//     3 tiers, posts over the roof, glass returns, lead-topped boxes, the Hall's fascia, clerestory, louvres, door).
import { Y } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ frame
export const ANG = (0.6 * Math.PI) / 180;      // K: map's long walls 0.55 - 0.97 deg, end walls 0.5 deg
export const UE = -72.20;                      // LOCAL u of the east slab line at s 0. K: LIDAR roof edge -71.6 .. -72.0 less the bays; map width 9.8 centred on the LIDAR roof
export const VN = 9.45;                        // LOCAL v of the frame's north end. K: LIDAR roof from v 9.5 (u -77, -81), drawing frame 20.0 m
export const TW = 9.60;                        // east to west slab line. K: map 9.8, LIDAR roof 9.6 - 10.0 without the bays
// the frame: five bays, each a box between two columns; spar-faced panels between the pairs
export const PITCH = 4.19;                     // K: NMLA elevation (208 px at 49.6 px/m); map's box centres 4.1
export const MOD = 3.02;                       // a box's two columns, centre to centre. K: NMLA elevation 150 px
export const COLW = 0.24;                      // column / post width. K: elevation 0.20, photographs 0.25 - 0.3
export const COLD = 0.45;                      // columns stand this far out from the slab line. G: photographs (2019 oblique)
export const BAYS = [0, 1, 2, 3, 4].map((k) => COLW / 2 + MOD / 2 + k * PITCH);   // box centres (s). K
export const LEN = BAYS[4] + MOD / 2 + COLW / 2;                                    // 20.02: K (LIDAR roof 19.8, map 20.3)
// the boxes ("projecting bay windows to each room, precast, with lead weathering and a precast seat within": LE)
export const BOX = {
  half: 1.27,                                  // half its width. K: NMLA elevation 2.52 m
  proj: 0.85,                                  // out from the slab line. K: map's toothed outline 0.75 - 0.9
  tops: [4.62, 7.44, 10.26],                   // the three tiers' tops. K: NMLA elevation scaled on LIDAR
  head: 0.16,                                  // precast head. K: photograph (NMLA 2013) 10 px a 140 px glass
  glass: 2.0,                                  // one big pane. K: photographs (glass 2.0 - 2.1 m)
  sill: 0.16,                                  // precast sill under the glass. K: photographs
  soffit: 0.30, soffitIn: 0.25, soffitBack: 0.62,   // the splayed seat underside. K: elevation (splay 0.32 deep), G: plan depth
};
export const BEAM_Y = (T) => T - 2.72;         // the floor beam's centre under each tier. K: elevation band 0.2 deep
export const ROOF = 10.46;                     // K: LIDAR 72.94 - 72.98
export const ROOF_MEMBRANE = 10.40;            // G: the membrane just under the edge beam's top
export const POST = 11.00;                     // the posts' tops. K: elevation 0.55 above the roof
export const FIRST = 1.62;                     // underside of the first-floor structure. K: elevation (Hall roof soffit +1.6)
export const LANTERN = { s: 10.35, t: 4.70, hs0: 3.95, ht0: 1.60, hs1: 3.42, ht1: 0.70, top: 12.27 };   // K: LIDAR + elevation (see above); G: the flanks glazed (satellite: a pale glazed strip)
// the ground floor ("clad in brick": LE): recessed behind the frame
export const GF_RECESS = 0.90;                 // G: plan (hall walls inside the column line), photographs (shadowed)
export const GF_WIN = { half: 1.0, sill: -0.35, head: 1.25 };   // G: plan shows openings between piers on the west
export const WEST_GROUND = Y(61.50);           // K: LIDAR DTM at u -84 (-1.0)
export const FOOT = -2.40;                     // every wall's foot (the Hall's sunk floor -1.95; the street -1.6)

// ------------------------------------------------------------------------------------------------ the stair links
// "placed between two earlier brick buildings, through which access is gained to the upper floors" (LE); brick blocks
// with sloping tops (NMLA elevation, photographs) and recessed glazed stair slots against Wolfson's ends (NMLA 2013 from
// the south-east; LIDAR shows the slots as gaps beside the links at v 8 - 9 and 29 - 30).
export const NLINK = { s0: 4.0 - VN, s1: -1.45, t0: 0.8, t1: 9.0, ya: 8.6, yb: 9.9 };       // K: LIDAR +8.6 .. +9.9, v 4.0 (brief: Park's gable) .. 8.0; G: t extent
export const NSLOT = { s0: -1.45, s1: 0, t0: 1.5, t1: 8.0, top: 10.0 };                       // K: LIDAR gap v 8 - 9.4; G: depth of the recess
export const SSLOT = { s0: LEN, s1: LEN + 0.60, t0: 1.5, t1: 8.0, top: 10.0, bot: 1.45 };      // K: LIDAR v 29.5 - 30.1
export const SLINK = { s0: LEN + 0.60, s1: LEN + 2.30, t0: -0.2, t1: 9.8, ya: 10.1, yb: 9.34, bot: 1.45 };   // K: LIDAR +10.0 .. +9.4 v 29.5 - 31.5; NMLA 2013 (passage under it)
// TOUCH-UP 1: the link does not stop at v 31.8: it CARRIES ON SOUTH TO PENROSE'S WEST WING over the same open way, its sloping
// top falling on to +8.35 at Penrose's wall, the width of Penrose's wing (its east face steps back to t 1.2). K: LIDAR fbox
// over the strip v 31.5 - 33.5: +8.1 - 9.0 across t 1 .. 9, open (ground -0.8) at t 0 and less; Street View Mar 2026 by hand
// (08 .../Wolfson west face square on ... and 07 .../Penrose west end over the Walton Street wall ...): the brick block with
// the sloping top runs into Penrose's west end and the concrete lintel of the way under it runs on to Penrose's corner; NMLA
// 2013 ground plan (08 .../drawing FAH and Wolfson ground-floor plan ...): the paved way open at the ground the whole
// 4.3 m from Wolfson's south wall to Penrose.
export const SLINK2 = { s0: LEN + 2.30, s1: 24.55, t0: 1.2, t1: 9.8, ya: 9.34, yb: 8.35, bot: 1.45 };   // s1: Penrose's north face (v 33.72 - 34.0, overlapping its wall)
export const PASSAGE = { s0: LEN, s1: LEN + 2.30 };   // the walk-through from the Walton Street gate to the court. K: NMLA plan (path between Wolfson and Penrose), NMLA 2013 photo
                                                  // (its ground from here south to Penrose's wing is part penrose's walk: P.GROUNDS.passV)

// ------------------------------------------------------------------------------------------------ the Flora Anderson Hall
export const FAH = {
  floor: -1.85,                                // K: elevation-section floor -1.97, DTM under the pergola -1.6 .. -1.9 (the floor = the sunk strip's level)
  roof: 1.92,                                  // sedum top. K: LIDAR 64.40 - 64.44
  deck: 1.75,                                  // the paved rim / timber edge top. K: LIDAR rim +1.6 - 1.7
  deckBot: 1.40,                               // the roof edge's underside. G: photographs (roof edge 0.35 deep)
  s0: -0.45, s1: 19.40,                        // the glazed box. K: LIDAR roof v 8.7 .. 29.6 less the overhangs; G: ends
  r0: -0.75, r1: 20.15,                        // the roof. K: LIDAR v 8.7 .. 29.6
  glassT: -9.0,                                // the glazed front (u -63.2). G: LIDAR rim and photographs (pergola 1.0 - 1.4 m deep)
  roofT: -10.0,                                // the roof's own edge. K: LIDAR edge u -62 .. -61.5
  beamT: -10.45,                               // the projecting beam ends. K: LIDAR
  sedumT: -7.9,                                // the sedum bed's east edge: a 2 m paved strip outside it (satellite). K
  upstand: 0.25,                               // concrete upstand under the glass. G: NMLA 2013 photograph
  glassTop: 0.35,                              // top of the glass and the door. G: photographs (proportions) on the levels above
  fasciaTop: 1.00,                             // the deep lower timber fascia. G: photographs
  door: { s: 13.40, half: 0.80, pier: 0.45, proj: 0.35 },   // K: NMLA plan 0.28 and Street View 0.32 of the front from its south end; G: sizes
  mullions: [0.0, 2.85, 5.7, 8.5, 11.35, 15.45, 17.4],     // G: NMLA 2013 straight-on photograph (posts 2.8 - 3.7 m apart)
  beams: 2.40,                                 // pergola beam spacing. G: photographs
  louvres: [2, 3, 5, 6, 7],                    // which beam bays carry a louvre unit. G: photographs (five or six striped units)
  finPitch: 0.25,                              // the louvres: thin timber fins slanting at 45 deg in elevation (touch-up 1). K: Street View 2015
                                               // (diagonal stripes); G: pitch (about ten to a 2.7 m unit)
  doorFrame: { stile: 0.13, top: 0.14, bottom: 0.22 },   // the doors: pale timber frames round full-height glass (touch-up 1). K: Street View
                                               // 2015, A Gast 2019; G: the members' sizes
  southSolid: { t0: -9.0, t1: -3.0, top: -0.05 },   // the south end's concrete wall. K: J Cairns 2021 photograph; G: sizes
};

// ------------------------------------------------------------------------------------------------ the forecourt
export const COURT = {
  strip: { s0: 11.9, s1: 20.4, t0: -9.0, t1: -10.5 },      // paved sunk strip at the glass and the ramp up to the south court. K: DTM, J Cairns 2021 (ramp, handrails)
  bedFront: { s0: -0.45, s1: 11.9 },                        // planting against the glass north of the door. K: NMLA 2013 photograph
  bed: { t0: -10.5, t1: -13.0 },                            // the planting bed along the front. K: photographs; G: width
  steps: { s0: 12.5, s1: 14.3, t0: -10.5, t1: -12.0 },     // steps up from the door's strip (satellite shows steps here). G
  path: { t1: -17.5 },                                       // the paved way on to the Quad's cross path. K: Street View 2015; G: length
  rail: { s0: 15.0, s1: 20.4, t: -10.45 },                   // the ramp's black handrail. K: J Cairns 2021
  westWalk: { t0: 9.70, t1: 10.85 },                         // a narrow walk along Wolfson's west foot. K: NMLA plan; G: width
};
export const TREES_WEST = [[-85.6, 15.1, 7.0], [-85.4, 20.0, 7.5], [-85.3, 25.5, 6.5]];   // birches inside the wall. K: Street View 2026 (three, behind the wall); G: heights

// ------------------------------------------------------------------------------------------------ the Walton Street wall
// The street face follows the site's boundary (SITE_RING). TOUCH-UP 1: the line was the map's own, not carried into the
// LIDAR's frame (0.6 - 1.1 m west of SITE_RING and of the wall); re-measured by LIDAR profiles across the wall at v 4, 8 ..
// 46 (0.5 m steps: the first raised cell east of the pavement at u -90.3, -89.8, -89.1, -88.8, -88.3, -88.4, -88.7, -89.0,
// -88.3, -89.1, -88.7: within +-0.5 of SITE_RING everywhere), so the wall now stands on SITE_RING's own vertices.
export const WALL_LINE = [[-94.12, -24.68], [-88.62, 16.14], [-88.02, 32.55], [-89.84, 51.11]];   // K: SITE_RING; LIDAR (+-0.5)
export const WALL = {
  th: 0.45,                                    // G: rubble street wall (part park's wall north of v 4: the same)
  key: 'rubble', coping: 'bathDress',          // coursed rubble with a stone coping all the way, as part park's wall north of it
                                               // (touch-up 1: was drawn as ashlar). K: Street View Mar 2026 (Wolfson west face, Penrose west end)
  top: 1.45,                                   // K: LIDAR 63.9 - 64.0 (about 3.0 m over the pavement)
  topSouth: 0.95,                              // south of the gate. G: Penrose west end look (lower than the north part)
  topAshlar: 1.35,                             // the raised stretch before the service gate: paler squared rubble (not ashlar). K: look; G: figure
  blocked: { v0: 14.05, v1: 18.85, pier: 0.65, pierTop: 1.75 },   // the blocked gateway. K: Street View 2026 (centre 16.45, opening 3.5 m, ashlar infill)
  gate: { v0: 28.8, v1: 31.9, pier: 0.6, pierTop: 1.80 },         // the gate to the passage. K: LIDAR gap v 29 - 31, Penrose look (railing gate), NMLA plan
  ashlar: { v0: 41.0, v1: 45.4 },              // K: Penrose west end look; G: positions
  servicePier: { v0: 45.4, v1: 46.0, top: 1.70 },                 // the service gate's north pier. K: look; brief (v 46)
  v0: 4.0, v1: 46.0,
};

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['Wolfson: place and length (slab v 9.45 .. 29.47, east line u -72.2, 0.6 deg)', 'K', 'LIDAR 2022 roof extent (the map is 2.2 m north of it here); NMLA east elevation (frame 20.0 m)'],
  ['Wolfson: width 9.6 m between slab lines', 'K', 'map w97853773 9.8 m; LIDAR roof 9.6 - 10.0'],
  ['Wolfson: flat roof +10.46, posts to +11.0', 'K', 'LIDAR 72.94 - 72.98; NMLA elevation (posts 0.55 above)'],
  ['Wolfson: five bays a face, pitch 4.19, box columns 3.02 apart, 0.24 columns', 'K', 'NMLA east elevation-section (2013) scaled on LIDAR; Street View both faces; map toothed outline'],
  ['Wolfson: three tiers of boxes, tops +4.62 / +7.44 / +10.26', 'K', 'NMLA elevation; photographs (NMLA 2013 straight on, Street View 2015 / 2026)'],
  ['boxes: 2.52 wide, 0.85 proud, one big dark-framed pane, glass returns, lead tops, splayed precast soffit', 'K', 'NMLA elevation; NMLA 2013 / 2019 photographs; LE 1393210 (lead weathering, precast)'],
  ['boxes: frame bar sizes, the soffit depth 0.62 back', 'G', 'judged from the photographs'],
  ['columns stand 0.45 out from the slab line', 'G', 'NMLA 2019 oblique photograph'],
  ['spar-aggregate panels between the column pairs; floor beams across at each tier', 'K', 'LE 1393210; NMLA elevation (joints at floor levels)'],
  ['rooflight box +12.27, 7.9 x 3.2 m at its foot, sloping flanks', 'K', 'LIDAR 74.77 - 74.80 and flanks; NMLA elevation and section (trapezoid)'],
  ['rooflight flanks glazed', 'G', 'satellite (a pale glazed strip); not seen close'],
  ['ground floor: brick, recessed 0.9 m behind the frame, windows on the west between piers', 'G', 'LE (clad in brick); NMLA plan (piers); hidden behind the street wall in every look'],
  ['north link: brick, sloping top +8.6 .. +9.9, v 4.0 .. 8.0', 'K', 'LIDAR; Street View 2026 west face (brick, sloping top); NMLA elevation'],
  ['north and south stair slots: recessed, glazed, +10.0', 'G', 'LIDAR gaps beside the links; NMLA 2013 from the south-east (glazed recess at the south end)'],
  ['south link: brick over an open passage (soffit +1.45), top +10.1 .. +9.1, to v 31.8', 'K', 'LIDAR; NMLA 2013 from the south-east (passage, concrete lintel); NMLA plan (path between Wolfson and Penrose)'],
  ['links: the north link stops at Park\'s gable (v 4.0)', 'G', 'brief; LIDAR'],
  ['south link carried on over the open way to Penrose\'s west wing (v 31.8 .. 34), sloping top to +8.35, t 1.2 .. 9.8; the way under it paved and open 4.3 m wide', 'K', 'LIDAR +8.1 - 9.0 over the strip; Street View Mar 2026 (Wolfson west face, Penrose west end: the brick block and the lintel run to Penrose); NMLA 2013 ground plan (touch-up 1)'],
  ['Flora Anderson Hall: roof +1.92 sedum, paved rim +1.75, edge to u -62', 'K', 'LIDAR; satellite (sedum, paved strip on the east)'],
  ['Flora Anderson Hall: floor -1.85 (sunk)', 'K', 'NMLA elevation-section (floor 1 m below the ground); DTM under the pergola -1.6 .. -1.9'],
  ['Flora Anderson Hall: glass line u -63.2, roof v 8.7 .. 29.6', 'K', 'LIDAR roof; NMLA plan (extension 10.3 m deep)'],
  ['Flora Anderson Hall: upstand, glass, fascia, clerestory, roof-edge heights', 'G', 'proportions from NMLA 2013 straight-on photograph fitted to the LIDAR levels'],
  ['Flora Anderson Hall: central pair of timber doors in a concrete surround at s 13.4 (v 22.9)', 'K', 'NMLA plan (0.28 of the front from its south end), Street View 2015 (0.32), NMLA 2013 photographs'],
  ['Flora Anderson Hall doors: pale honey timber frames round full-height glass, black pull handles', 'K', '08 .../Wolfson east face square on ... (Street View 2015); ... front with doors (A Gast 2019) (touch-up 1; members G)'],
  ['Flora Anderson Hall louvres: thin fins slanting 45 deg in elevation, 0.25 apart', 'K', 'Street View 2015 (diagonal stripes; pitch G) (touch-up 1)'],
  ['Flora Anderson Hall: mullion positions, beam spacing 2.4, which bays carry louvres', 'G', 'NMLA 2013 photographs'],
  ['Flora Anderson Hall: concrete south end with a clerestory strip', 'K', 'J Cairns 2021 photograph'],
  ['Flora Anderson Hall: north end glazed over a concrete upstand', 'G', 'not seen square on'],
  ['forecourt: sunk paved strip at the glass, ramp up to the south with a handrail', 'K', 'DTM -1.6 .. -1.9 along the glass; J Cairns 2021 (ramp, handrails)'],
  ['forecourt: steps east from the door, paved way to the cross path, planting beds', 'G', 'satellite (steps), Street View 2015 (path, beds); figures guessed'],
  ['west walk and bed between Wolfson and the wall; three birches', 'G', 'NMLA plan (bed and walk), Street View 2026 (three young birches); positions and heights judged'],
  ['Walton Street wall: line on SITE_RING (moved 0.6 - 1.1 m east from the unregistered map line), top +1.45 north of the gate', 'K', 'SITE_RING; LIDAR profiles across the wall v 4 - 46 (+-0.5); LIDAR 63.9 - 64.0'],
  ['Walton Street wall: COURSED RUBBLE all the way (park\'s key and stone coping); ashlar only at the piers and the blocked gateway (v 14.05 .. 18.85)', 'K', 'Street View Mar 2026 west face square on and Penrose west end (touch-up 1)'],
  ['the raised stretch before the service gate: paler squared rubble', 'K', 'Street View Mar 2026 Penrose west end (tint G)'],
  ['Walton Street wall: gate to the passage at v 28.8 .. 31.9 (railing leaves, shown open)', 'K', 'LIDAR gap; Penrose west end look (railing gate); NMLA plan'],
  ['Walton Street wall: south stretch +0.95, ashlar stretch +1.35, service gate pier +1.7 at v 46', 'G', 'Penrose west end look (no level read)'],
  ['wall thickness 0.55', 'G', 'typical'],
];
