// Somerville College, STANDALONE model, part 'chapel' (survey B08): THE PLAN of the Chapel (1932 - 35, Courtenay Theobald),
// the Fellows' Garden and its walls west of it, the forecourt and the wide steps at the Chapel's west end and the made
// kitchen-garden terrace south of it. Pure data: every figure a named constant with its source; the build functions are
// in _somerville_chapel_build.js. Brief: docs/handoff/somerville/briefs/chapel.txt.
//
// FRAME: the Chapel and the garden stand square to the LOCAL frame (u east, v south; LIDAR: the long walls within half a
// degree), so everything here is LOCAL (u, v) and y above the datum 62.50 m.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 at half-metre steps (tools/somerville_lidar.py, the DSM / DTM sampled by a scratch script): the parapet
//     reads +10.7 .. +10.9 all round; the main body's north edge v 53.3 (u -1.5 .. 16), its south edge v 63.3; the two END
//     BLOCKS are NARROWER (v 54.7 .. 61.4 west, 54.8 .. 62.0 east) and stand out from the main body's ends: the west one
//     u -5.2 .. -1.5, the east one u 16.5 .. 20.8; the main ridge reads +13.3 .. +13.4 at v 58 - 58.5, the end blocks'
//     roofs only +11.3 .. +12.0 at their middles; a landing at +8.2 .. +8.7 at the north-east corner and stepped iron
//     at +4.5 .. +6.9 down the east face (the escape); the terrace south of the Chapel +1.5 .. +1.8 over u -2 .. 10,
//     v 63.5 .. 79; a walkway +2.8 .. +2.9 west of u -5 and south of v 80 (part 'vaughan'); the forecourt -0.1 .. +0.1;
//     the steps between them 0.3 / 1.0 / 1.3 / 1.5 at u -5 .. -2; in the Fellows' Garden a wall line +2.3 .. +2.6 at
//     v 39 - 40 from Penrose's east face (u -43.6) to u -13; a clipped hedge +2.4, two metres thick, at u -13.5 .. -11.5
//     from v 40 to Vaughan (v 67), broken at v 51 - 53; the garden's ground -0.2 (east) .. -0.9 (west), a slight hollow
//     -0.9 .. -1.0 over v 57 - 63.
//   * The 2019 Clear View topographic survey (20/00564, DIMENSIONS.md; the CSV already in the LIDAR's frame): the Chapel's
//     parapet 73.45 - 73.46, main ridge 76.35 - 76.36 at u 3.3 and 9.8, "ridge ends" 75.51 - 75.52 at u -1.8 and 15.2 (the
//     end blocks' ridges where they run into the main roof); the path along the north side 62.29 - 62.48.
//   * Photographs (reference/somerville/09, 15, 07, 10; SOURCES.txt there): Gast 2019 north side straight on (THREE
//     round-headed windows in eared aedicules with pediments, balustrade panels over them, the end blocks blank, a caged
//     ladder over the EAST end, the yew hedge); Gast 2019 from the north-west (the low door in the east block's north
//     face); Street View 2015 from the north-east (the cage at the east end); Schwarz 2014 and Brigade Piron 2014 from the
//     north-west (they show the WEST end: Maitland is on their left, Vaughan's frame on their right; the latter's caption
//     says "east end"): the west end block with a narrow window in a round-headed niche inside a pedimented aedicule, a
//     door in a stone surround under it, a balustrade panel over it, the stone-slate roofs in two heights, a lamp post;
//     the interior photograph (the east recess with the stained-glass window, so the door end is the west); the garden
//     (sundial bed, brick wall with a door on the Penrose side, the loggia), Street View 2015 at Penrose's east end
//     (the garden's north wall is RUBBLE with a brick coping on its north face); the satellite close look (the round
//     bed, the north border and gravel walk, the hedge broken by the walk, the forecourt, the steps, three raised beds,
//     the glasshouse, the frames). Positions off the satellite: its pixels carried onto LOCAL by the hedge line and the
//     north wall (both LIDAR), 10 px a metre, +-1.5 m (the imagery leans).
import { Y } from './_somerville_shared.js';

// ------------------------------------------------------------------------------------------------ the Chapel's plan
export const MAIN = { u0: -1.30, u1: 16.90, v0: 53.30, v1: 63.30 };   // the main body (nave). K: LIDAR edges (north v 53.3, south 63.3, ends -1.5 / 16.5 .. 17 less the parapet's blur); map 54.0 .. 64.0, -0.7 .. 17.3
export const WEST = { u0: -5.10, u1: MAIN.u0, v0: 54.80, v1: 61.80 }; // the west end block (entrance). K: LIDAR u -5.2 .. -1.5, v 54.7 .. 61.4; map -4.8, 55.5 .. 63.1
export const EAST = { u0: MAIN.u1, u1: 20.70, v0: 54.80, v1: 61.80 }; // the east end block (the recess inside). K: LIDAR to u 20.8, v 54.8 .. 62.0; site boundary u 20.71
export const FOOT = -1.00;                    // every wall's foot: 0.5 below the lowest ground at the Chapel (-0.4 .. -0.6 east of it). K: LIDAR DTM
export const FFL = 0.15;                      // the floor, one step above the forecourt (-0.05) and the north path (+0.05). G
export const PLINTH = { top: 0.55, proj: 0.06 };                     // a plain plinth. K: Gast 2019 ("a plain plinth"); G: height
export const PARAPET_TOP = Y(73.45);          // +10.95. K: Clear View 73.45 / 73.46 at four points; LIDAR +10.7 .. +10.9
export const PARAPET_T = 0.35;                // the parapet's thickness. G
export const CORNICE = { y0: 9.72, y1: 10.00, proj: 0.20 };          // the cornice under the parapet. K: Gast 2019 (a moulded band 1.0 below the top); G: depth
export const FRIEZE = { y: 9.02, h: 0.10, proj: 0.04 };              // a plain band at the head of the frieze. G: photographs (a line just above the pediments)
export const GUTTER_Y = 10.48;                // the lead gutters / flats behind the parapet. G
export const EAVES = 10.50;                   // the roofs' feet behind the parapet. G (the slopes rise from just behind the parapet's top in every photograph)
export const RIDGE = Y(76.355);               // +13.86 the main ridge. K: Clear View 76.35 / 76.36; LIDAR +13.4 (smoothed)
export const END_RIDGE = Y(75.515);           // +13.02 the end blocks' ridges. K: Clear View 75.51 / 75.52 (at u -1.8 and 15.2)
// the roofs: graded stone slates, hipped; the end blocks' ridges run into the main roof's hips (photographs: Schwarz 2014)
export const ROOF_MAIN = { u0: MAIN.u0 + PARAPET_T, u1: MAIN.u1 - PARAPET_T, v0: MAIN.v0 + PARAPET_T, v1: MAIN.v1 - PARAPET_T };
export const ROOF_END = { v0: WEST.v0 + PARAPET_T, v1: WEST.v1 - PARAPET_T, westIn: 2.60, eastIn: 13.00 };   // the end roofs run in to where their ridge meets the main hips (u 2.54 / 13.06)

// ------------------------------------------------------------------------------------------------ the faces' openings
// side windows: tall round-headed leaded windows, three a side, in eared stone aedicules with small pediments on
// consoles, a sill on two blocks. K: Gast 2019 (count, form; scaled at 42.7 px a metre on the parapet's height);
// interior photograph (three a side, high); G: the south side's (seen in no picture: the same three, brief)
export const WIN_U = [2.00, 7.80, 13.60];     // K: Gast 2019 straight on (centred on the main body, 5.8 apart +-0.3)
export const WIN = { w: 1.70, sill: 3.30, spring: 7.00 };            // K: scaled (glass 1.7 wide, sill +3.3, head +7.85)
export const AED = {
  band: 0.22, bandProj: 0.08,                  // the architrave round the arch. G: proportions from the photographs
  side: 0.26, sideGap: 0.12, sideProj: 0.10,   // the outer strips (with the ears at the top). G
  head: 0.42,                                  // the frieze between the arch's crown and the pediment. G
  pedRise: 0.62, pedOver: 0.16, pedProj: 0.30, // the pediment. K: Gast 2019 (pediment top +9.2); G: depth
  sillH: 0.15, sillProj: 0.16, block: 0.26,    // the sill and the blocks under it. K: photographs ("a sill on blocks")
  console: 0.42,                               // the consoles' height under the pediment. G
};
export const BALUSTER_PANEL = { w: 1.60, y0: 10.14, y1: 10.76, n: 7, d: 0.14 };   // balustrade panels in the parapet. K: Gast 2019, Schwarz 2014 (7 balusters); G: size
// the end faces: one tall NARROW round-headed window in a round-headed niche inside the same aedicule; on the west
// face a door in a stone surround under it and the inscription (in Greek: "A House of Prayer for all People") on the
// apron between them. K: Brigade Piron 2014 / Schwarz 2014 (scaled at 56 - 58 px a metre); G: the east face's (the escape
// hides it in the one look)
export const NICHE = { w: 1.90, sill: 3.95, spring: 6.95, d: 0.30, base: 3.10 };   // K: scaled (niche +3.95 .. +7.9 over an apron; the aedicule's sill line +3.1)
export const SLIT = { w: 0.52, sill: 4.60, spring: 6.95, d: 0.22 };  // K: scaled (glass +4.6 .. +7.2)
export const INSCRIPTION = { w: 1.90, y0: 2.74, y1: 2.92 };          // G: a faint line of letters at +2.9 under the aedicule (Brigade Piron 2014)
export const WEST_DOOR = { w: 1.40, h: 2.20, surround: 0.20, cornice: [2.55, 2.70] };   // K: Brigade Piron 2014 (door 1.4 wide, a cornice over it, the lettering above that); G: height
export const NORTH_DOOR = { u: 18.80, w: 1.10, h: 2.25 };            // the low door in the east block's north face. K: Gast 2019 (north-west); Clear View "gully by the north door" at u 15.7; G: size
export const STEP = { d: 0.45, over: 0.30 };  // a stone step at each door. G
// lead downpipes with heads, at the north and south re-entrant corners and the west block's north-west corner. K: Gast 2019, Schwarz 2014
export const PIPES = [[MAIN.u0 - 0.14, WEST.v0 - 0.14], [MAIN.u1 + 0.14, EAST.v0 - 0.14], [MAIN.u0 - 0.14, WEST.v1 + 0.14], [MAIN.u1 + 0.14, EAST.v1 + 0.14], [WEST.u0 - 0.12, WEST.v0 + 0.12]];
// the iron escape on the east face: a landing at the north-east corner, a caged ladder from it over the parapet, two
// flights down the face. K: LIDAR (landing +8.2 .. +8.7, iron at +4.5 .. +6.9 east of the face), Gast 2019 / Street
// View 2015 (the cage from about +8.4 to +12.4 at the east end); G: the flights' layout (no picture shows them)
export const ESCAPE = { landY: 8.40, cageTop: 12.40, out: 1.20, landV: [54.40, 56.60], midY: 4.20, midV: [61.20, 62.40], w: 0.85 };
export const HEDGE_N = { u0: -1.00, u1: 16.60, v0: 52.10, v1: MAIN.v0, h: 1.40 };   // the yew hedge along the north foot. K: LIDAR +1.1 .. +1.5 at v 51.8 .. 53.2; Clear View "hedge 1.5 m high"; photographs
export const LAMP = [-6.60, 56.40];           // the lamp post by the west door. K: Brigade Piron 2014 / Schwarz 2014; G: place

// ------------------------------------------------------------------------------------------------ the Fellows' Garden
export const PENROSE_E = -43.60;              // Penrose's east face at the north wall (its plan: x 38.18, y 4.55). K
export const PENROSE_SE = [-44.20, 56.80];    // Penrose's east wing's south-east corner. K: its plan
export const PENROSE_FLAGS = -42.10;          // the edge of Penrose's flagged strip (its part draws it). K
export const NWALL = { v: 39.60, u0: PENROSE_E, u1: -13.70, t: 0.38, h: 2.35 };   // the north wall: rubble outside, brick on the garden face, brick coping. K: LIDAR v 39 - 40, +2.3 .. +2.5; Street View 2015, college c2021; G: thickness
export const NDOOR = { u0: -42.40, u1: -41.50, h: 2.00 };            // the plank door in it by Penrose. K: college c2021 (a door at the wall's west end); G: size
export const EWALL = { u: -13.90, v0: NWALL.v, v1: 67.00, t: 0.40, h: 2.00, gap: [51.40, 53.00] };   // the rubble wall down the east side. K: Gast 2019 (garden), PHOTO_NOTES; G: line (just inside the hedge), the opening at the walk
export const EHEDGE = { u0: -13.70, u1: -11.60, v0: NWALL.v + 0.2, v1: 67.00, h: 2.40, gap: EWALL.gap };   // the clipped hedge outside it. K: LIDAR, satellite
export const SHED = { u0: -32.60, u1: -28.60, v0: 37.00, v1: NWALL.v - NWALL.t / 2, hBack: 2.25, hFront: 1.95 };   // the lean-to shed on the wall's north face. K: satellite (grey roof, u -32 .. -28); G: size, heights
export const SUNDIAL = { u: -26.30, v: 46.90, r: 2.00, plinth: 0.62, shaft: 0.32, h: 1.15 };   // the round bed with the stone sundial. K: satellite (r 2.0 +-0.3), college c2021 (square pedestal); G: pedestal sizes
// beds, walks and lawns (LOCAL v unless named). K: satellite close look (north border, gravel walk, lawn, the walk
// along the south of the lawn through the hedge, a shrub border, a shaded lower lawn to Vaughan); G: widths +-0.5
export const GARDEN = {
  northBed: [NWALL.v + NWALL.t / 2, 41.20], northWalk: [41.20, 42.00],
  westWalk: [PENROSE_FLAGS, -40.60],
  lawn: { u0: -40.60, u1: EWALL.u - EWALL.t / 2, v0: 42.00, v1: 51.20 },
  southWalk: [51.20, 52.60], southBed: [52.60, 56.50],
  lowLawn: { u0: -44.00, v0: 56.50, v1: 65.80 }, vaughanBed: [65.80, 67.00],
};
export const FORECOURT = [[-11.60, 52.20], [WEST.u0, 52.20], [WEST.u0, WEST.v1], [-5.80, WEST.v1], [-5.80, 67.60], [-11.60, 67.60]];   // the paved court at the west end. K: satellite (paving from the hedge to the Chapel and the steps)

// ------------------------------------------------------------------------------------------------ the terrace south of the Chapel
export const TY = 1.62;                       // the terrace (64.12). K: LIDAR +1.5 .. +1.8 (survey 2: 64.1 - 64.2)
export const WALK_Y = Y(65.37);               // +2.87 the walkway beyond it (part 'vaughan' DECK_LOW). K: 11/03166 FFL 65.370 (figured); LIDAR +2.8 .. +2.9
                                              // (touch-up 1: was 2.90, 3 cm off part vaughan's deck)
export const TERRACE = [[-2.20, WEST.v1], [MAIN.u0, WEST.v1], [MAIN.u0, MAIN.v1], [EAST.u0, MAIN.v1], [EAST.u0, EAST.v1], [17.60, EAST.v1], [17.60, 79.60], [-4.50, 79.60], [-4.50, 67.60], [-2.20, 67.60]];   // K: LIDAR; site boundary u 17.6 (map)
// the wide steps from the forecourt up to it along the west block's south side, rising east. K: LIDAR (0.3 / 1.0 / 1.3 / 1.5
// at u -5 .. -2), satellite; G: nine risers of 0.17 on 0.40 goings
export const WSTEPS = { u0: -5.80, u1: -2.20, v0: WEST.v1, v1: 67.60, n: 9 };
export const CHEEK = { v0: 67.60, v1: 68.00 };                       // the steps' south cheek (the walkway's corner beyond). G
// the retaining walls where the terrace meets the walkway: west (u -4.9 .. -4.5) and south (v 79.6 .. 80.0), up to the
// walkway with an iron railing on top; a flight up to the walkway in the south-west corner. K: LIDAR (the levels); G:
// the walls' lines, the railing, the flight (the c2022 photograph shows a brick path running south on the terrace's
// west side to a stair under the bridge between Vaughan and Fry). WHERE I STOPPED: u -4.9 on the west, v 80.0 on the south.
export const RWALL_W = { u0: -4.90, u1: -4.50, v0: CHEEK.v0, v1: 80.00 };
export const RWALL_S = { u0: -4.90, u1: 17.60, v0: 79.60, v1: 80.00 };
export const SSTEPS = { u0: -2.40, u1: 0.00, vTop: 79.60, n: 6, going: 0.50 };
export const RAIL_H = 1.00;
export const BWALL = { u0: 17.60, u1: 18.00, v0: EAST.v1, v1: 80.00, h: 2.00 };   // the boundary wall to the Woodstock Road / Little Clarendon Street backs. K: map's site line; c2022 photo (rubble with a bench); G: height
// three raised vegetable beds with red edging, the glasshouse at the east, a row of frames to the south. K: satellite; G: sizes
export const BEDS = [[65.40, 66.70], [67.70, 69.00], [70.00, 71.30]].map(([v0, v1]) => ({ u0: 0.00, u1: 10.40, v0, v1, h: 0.42 }));
export const GLASSHOUSE = { u0: 11.40, u1: 14.80, v0: 64.60, v1: 73.60, base: 0.50, eaves: 1.90, rise: 0.75 };   // K: satellite, LIDAR (+4.1 .. +4.2 over the terrace = 2.5 above it); G: size
export const FRAMES = { u0: 1.00, u1: 8.00, v0: 73.80, v1: 75.00, hBack: 0.45, hFront: 0.30 };   // G: satellite (a grid of glazed lids)

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['Chapel plan: main body u -1.3 .. 16.9, v 53.3 .. 63.3; end blocks 3.8 long, 7.0 wide, set in 1.5 m from both long faces', 'K', 'LIDAR 2022 at 0.5 m (parapet edges); map outline w97853784 (same shape, +-1 m)'],
  ['parapet top +10.95 all round', 'K', 'Clear View 2019 topo 73.45 / 73.46 (DIMENSIONS.md); LIDAR +10.7 .. +10.9'],
  ['roofs: hipped, graded stone slates, main ridge +13.86 from u 3.6 to 11.9, end blocks hipped at their outer ends with ridges +13.02 running into the main hips', 'K', 'Clear View 76.35 / 75.51; photographs Schwarz 2014, Brigade Piron 2014, Gast 2019'],
  ['roofs\' feet +10.50 behind the parapet, lead gutters', 'G', 'photographs (slopes rise from just behind the parapet)'],
  ['north and south sides: three tall round-headed leaded windows in eared aedicules with pediments on consoles, sills on blocks; ends of the walls blank', 'K', 'Gast 2019 straight on, snow 2017, college c2021; interior (three a side)'],
  ['window sizes: glass 1.70 wide, sill +3.30, head +7.85; pediment top +9.2', 'K', 'scaled off Gast 2019 straight on (42.7 px a metre)'],
  ['the south side the same as the north', 'G', 'seen in no picture (brief); interior photograph has three a side'],
  ['aedicule mouldings, ears, consoles, sill blocks', 'G', 'judged from the photographs'],
  ['balustrade panels in the parapet, one over each window and each end window, seven balusters', 'K', 'Gast 2019, Schwarz 2014, Brigade Piron 2014; G: sizes'],
  ['cornice +9.72 .. +10.00 and frieze band +9.0', 'G', 'photographs (two lines under the parapet)'],
  ['plinth to +0.55', 'G', 'Gast 2019 ("a plain plinth", mostly behind the hedge)'],
  ['end faces: a narrow round-headed window (0.52 wide, +4.6 .. +7.2) in a round-headed niche (+3.95 .. +7.9) over an apron in the same aedicule', 'K', 'Brigade Piron 2014, Schwarz 2014 (the west end); scaled at 56 - 58 px a metre'],
  ['the east end\'s window the same as the west\'s', 'G', 'the one look from the north-east shows only the top; interior: one window in the east recess'],
  ['the photographs captioned "east end" (Brigade Piron 2014) show the WEST end: Maitland on the left, Vaughan on the right', 'K', 'reading of the photographs against the plan'],
  ['west door 1.40 wide in a stone surround with a cornice, a stone step', 'K', 'Brigade Piron 2014; G: height 2.20, the step'],
  ['inscription band (Greek) as a plain panel with an incised line under the west niche', 'G', 'Brigade Piron 2014 (faint letters at +3.0); VCH (the inscription)'],
  ['low door in the east block\'s north face', 'K', 'Gast 2019 from the north-west; Clear View "north door" gully; G: size 1.10 x 2.25'],
  ['floor +0.15', 'G', 'one step over the forecourt (-0.05) and the north path (+0.05, Clear View 62.29 - 62.48)'],
  ['iron escape on the east face: landing +8.4 at the north-east corner, caged ladder to +12.4', 'K', 'LIDAR (+8.2 .. +8.7 landing), Gast 2019, Street View 2015 (cage)'],
  ['escape: two iron flights down the east face with a half landing +4.2', 'G', 'LIDAR (+4.5 .. +6.9 steps of iron); no picture of them'],
  ['lead downpipes at the re-entrant corners and the west block\'s north-west corner', 'K', 'Gast 2019, Schwarz 2014; G: the south ones'],
  ['yew hedge along the north foot, 1.4 high', 'K', 'LIDAR +1.1 .. +1.5; Clear View "hedge 1.5 m high"; photographs'],
  ['lamp post by the west door', 'K', 'Brigade Piron 2014, Schwarz 2014; G: place'],
  ['Fellows\' Garden north wall on v 39.6 from Penrose\'s east face (about 4.5 m south of its north-east corner) to the hedge, 2.35 high', 'K', 'LIDAR (+2.3 .. +2.5 line at v 39 - 40), Street View 2015 (the wall comes out from behind the pavilion), college c2021'],
  ['north wall: rubble on its north face, red brick on the garden face, red brick coping', 'K', 'Street View 2015 (rubble, brick coping), college c2021 (brick inside), satellite (orange coping)'],
  ['plank door in the north wall by Penrose', 'K', 'college c2021 sundial photograph; G: size, shut'],
  ['lean-to shed on the north wall\'s north face', 'K', 'satellite (grey roof); G: size, timber, heights'],
  ['rubble wall down the garden\'s east side just inside a clipped hedge 2.4 high and 2.1 thick, both broken at the walk (v 51.4 .. 53.0)', 'K', 'LIDAR (hedge), satellite (hedge and gap), Gast 2019 garden photograph (rubble wall); G: the wall\'s exact line, its height 2.0'],
  ['garden layout: north border and gravel walk, lawn u -40.6 .. -14.1, v 42 .. 51.2, walk along its south side through the hedge, shrub border, lower lawn to Vaughan, bed at Vaughan\'s foot', 'K', 'satellite close look (positions +-1.5 m)'],
  ['round bed r 2.0 at (-26.3, 46.9) with a stone sundial on a square pedestal', 'K', 'satellite; college c2021; G: pedestal sizes'],
  ['the garden\'s south-west side: the Catherine Hughes Building\'s east end (part hughes); the 2016 survey\'s steps and gate there went with the building', 'G', 'Sylva 2016 survey (before the building), LIDAR (a building at u -44 now)'],
  ['forecourt paved from the hedge to the Chapel\'s west end', 'K', 'satellite; G: edges'],
  ['wide steps from the forecourt up to the terrace along the west block\'s south side, u -5.8 .. -2.2, v 61.8 .. 67.6, nine risers', 'K', 'LIDAR (0.3 / 1.0 / 1.3 / 1.5), satellite; G: riser count and goings'],
  ['terrace +1.62 from the Chapel\'s south wall to v 79.6, u -4.5 .. 17.6', 'K', 'LIDAR +1.5 .. +1.8; survey section 2 (64.1 - 64.2)'],
  ['the walkway level +2.87 (65.37), the same as part vaughan\'s deck', 'K', '11/03166 FFL 65.370 figured (touch-up 1)'],
  ['retaining walls up to the walkway (+2.87) on the terrace\'s west and south with iron railings, a flight of six steps up in the south-west corner', 'G', 'LIDAR levels; c2022 photograph (brick path south to a stair); stopped at u -4.9 and v 80.0 (part vaughan)'],
  ['boundary wall on u 17.6, rubble, 2.0 above the terrace', 'G', 'map site line; c2022 photograph (rubble wall, bench)'],
  ['three raised vegetable beds with red brick edging, glasshouse at the east end, a row of frames', 'K', 'satellite close look; LIDAR (glasshouse about 2.5 high); G: sizes'],
];
