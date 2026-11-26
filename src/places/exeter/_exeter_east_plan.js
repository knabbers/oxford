// Exeter College, STANDALONE model, part 'east' (B04 + B05): THE PLAN of the east range of the Front Quad (Peryam's
// Building 1618 to the south, the Armagh Building 1708 to the north; staircases 4, 5, 6) and of Palmer's Tower (1432).
// Pure data: every dimension a named constant with its source; the build functions are in _exeter_east_build.js.
// LOCAL frame (u east, v south, y above the datum 64.40 m: _exeter_shared.js). Research: docs/research/exeter_survey.md
// B04, B05, sections 2, 3, 11; reference/exeter/PHOTO_NOTES.md.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * PLANNING 04/00588/LBC (Montgomery Architects 2004, reference/exeter/20 planning drawings/04_00588_LBC staircases 4 5
//     6 dormers/): "01 background information": Peryam Building 1618 to the SOUTH = staircase 4, Armagh Building 1708 to the
//     NORTH = staircases 5 and 6; basement + four storeys, the fourth (third floor) an attic; Peryam's two three-sided bays on
//     the EAST face carried up three storeys. "03 floor plans a" (roof plan 1:100): the roof is a MANSARD: a stone parapet
//     and a wide lead gutter on each face, a steep slated lower slope carrying the dormers, a lead-covered flat top about
//     2.1 m wide; 13 gabled dormers on the quad slope, 15 gabled + 2 flat-topped on the garden slope; two clustered stacks
//     standing in the lead flat (6 and 8 round flues); the parapet steps out over Peryam's two bays; three stacks on the
//     quad-side wall line where the range meets the Hall. Its scale was tied to the LIDAR by the two stacks (v -2.74 and
//     11.6): 0.0221 m a pixel of the 110 dpi render; the range then runs v -16.5 .. 31.3, as the LIDAR. "04 elevations a"
//     (1:50): dormer 1.2 m wide, 1.45 m to its eaves + a 0.45 m gable; the parapet's coping 0.77 m above the dormer sills;
//     the mansard's top 1.43 m above the coping, its gutter 1.13 m below.
//     (The 25/01435/LBC "Palmer's Tower" drawings are of a room in the Rector's Lodgings' north part (its block plan): not
//     the tower: not used.)
//   * LIDAR 2022 (tools/exeter_lidar.py lbox / u / v profiles at 0.5 m; docs/handoff/exeter/tools/xsec.py): quad face at u
//     18.4 (ground to u 18.0 - 18.5, the parapet's cells from 18.5 - 19.0); garden face at about 27.0 (cells to 27.0 read
//     the parapet; one cell's lean east: taken 26.8 with the roof plan's 8.4 m depth); the lead flat 12.6 - 12.7 at u 22 -
//     24; the quad edge reads 10.6 - 10.8 (coping + gutter in one cell); the garden edge 10.8 - 11.0 on Armagh but 10.3 -
//     10.4 on Peryam (v 19 - 31): THAT is why the garden side reads lower: Peryam's garden parapet is 0.65 m lower than
//     Armagh's (its storeys are lower: the 1618 building), the flat and ridge run on level; the stacks' spikes 16.4 at (21.5,
//     -2.5) and (22, 11.5); the north end of the range's roof at v -16.3 .. -16.6; then a slot open to the sky (ground at u
//     18.5 - 20, v -17.5 .. -18.0) and Palmer's Tower: a lead flat at 11.4 - 11.9 over u 17.5 .. 23, v -18.5 .. -24.5,
//     its battlements 12.2 - 12.4 and a turret at the north-east corner reading 14.2 - 14.5 (u 21 .. 23, v -22.5 .. -24); its
//     buttresses 5 - 9 m on the west side (u 15.5 .. 17); east of the tower Chapel Row's roofs at 8.4 - 10.5 reaching south to
//     v -17 over the way round (u 24 .. 27.5: a covered way); the ground: quad path -0.08 .. -0.19 (beds -0.36), the way
//     round -0.08, the garden -0.05 .. -0.1, the lane at the south end +0.57 (u 17) .. +0.25 (u 27).
//   * The map's outlines (w301630465 - 67, w301630479) lie about 1 m west of the LIDAR's walls (quad face 17.5 v 18.4,
//     garden face 25.8 v 27.0) and put the tower at u 17.6 .. 23.4, v -25.3 .. -19.7. The BRIEF'S tower position (12 .. 17.5,
//     -31.3 .. -25.6) is open ground in the LIDAR (64.0 - 64.4: the path round the Chapel's apse): map + LIDAR stand.
//   * Photographs: 05 "quad face straight on" (FrDr 2024: square on, 0.0166 m a pixel at the face, every level of the
//     quad face below read off it with the coping at 11.0); 02 "from high in west range looking east" (exeter.ox.ac.uk
//     2016: the whole face, column count, doors, dormers, stacks, the tower, the archway); 02 "looking south-east" (Simon Q
//     2012: the south end at the Hall); 06 "Palmer's Tower ... from quad" (N Smith 2010); 05 "garden face from Fellows
//     Garden" (R Sones 2012) and "garden face detail" (exeter.ox.ac.uk c2016: 0.0133 m a pixel, Peryam's garden levels);
//     09 "from the mound looking west" (J Freeman 2005); 13 the college's bird's-eye map (J Bays 2009: staircase numbers 4
//     over the south door, 5 over the middle door, 6 over the north door).

//
// REGISTRATION, EAST SIDE (2026-11-23, second pass): THE 1:500 TOPOGRAPHIC SURVEY (Tim Moya Associates drg 210239-P-10, Feb
// 2021, p20 of the Library's tree report, planning 21/00354/FUL; the 400 dpi render, 31.5 px a metre) registered to the
// LOCAL frame on 18 walls (rms 0.21 m: exeter_grounds.js header): LOCAL = survey axes turned 17.07 deg + (1.287, 0.822).
// Lines fitted here to the dark pixels of each wall stroke (scratch scripts, outside the repo); "res" below is survey -
// model after the move. What it changed:
//   * THE RANGE IS NOT SQUARE TO THE FRONT QUAD: both faces run 1.25 deg off the frame, east as they go south. Quad face
//     (fit over v -16.5 .. 19, 5472 px): u = 18.539 + 0.0218 (v - 1.25), i.e. 18.14 at the north end, 18.90 at v 18
//     (profiles every 2 - 4 m agree to 0.03). Garden face u 26.50 (v -11), 26.78 (v -2), 26.95 (v 9), 27.31 (v 31): 8.15 -
//     8.25 m deep against "8.3" in the planning notes and 8.4 on the roof plan: taken 8.25 (res -0.15 .. +0.07). The
//     range is therefore built in its OWN frame (RANGE below): range coordinates (u', v') are the old LOCAL figures turned
//     -1.25 deg about the quad face at v 0 (18.51, 0); at the quad face v' = LOCAL v to 0.01 m. LIDAR's 18.4 / 26.8 were
//     a straight average of the slant (it reads 1 m cells).
//   * THE ENDS ARE NOT SQUARE EITHER: the north end runs from (18.14, -17.17) at the quad to (26.40, -16.64) at the
//     garden (3.7 deg: it was -16.6 straight across: LIDAR's roof edge); the south end on Brasenose Lane from (19.2,
//     31.44) to (27.43, 32.02) (4 deg; was 31.3 straight: LIDAR).
//   * THE OPENINGS (the survey draws no door gaps except the passage's, but steps, FFL labels and the bed's breaks):
//     staircase 5's passage: the quad face's line breaks at v 4.0 .. 5.15, the garden face's at 4.3 .. 5.3, the corridor
//     between them is drawn v 4.57 .. 5.53 with the stair rising beside it (FFL 64.47 / 64.48). The DORMERS (roof plan,
//     scaled to the LIDAR stacks) seen on FrDr 2024 square on give 0.0169 m a pixel at the dormer fronts: door 5 at x
//     1027 = v 5.0, door 6 at x 88 = -10.85, the window columns at a pitch of 3.89 m (the old 3.6 pitch was a
//     mis-scaling of the same photograph: the old door 5 at 3.15 fell between two dormers that frame it). The planted
//     bed in front of the quad face breaks at v -11.8 .. -9.8 (door 6: confirms -10.85, not the -11.7 first suggested)
//     and stops at 18.85 (door 4: its FFL label at 19.0 .. 20.0). Peryam's bays (garden): base 14.2 .. 17.8 and 23.7 ..
//     27.3, fronts 2.6 m, 0.8 m out; the garden door's steps 19.6 .. 21.5.
//   * A PLANTED BED 1.15 m deep along the quad face (survey line 1.15 - 1.2 m out, parallel to the face) from about
//     v -16.6 to 18.85, broken for door 6, the two benches (grounds part's, v -6.6 / 8.4) and the passage.
//   * PALMER'S TOWER is a GATE TOWER (26/02068/LBC "Existing ground and first floor plans", Jessop & Cook 2026, 1:100 with
//     a scale bar: the vaulted gate passage 3.3 m clear runs north-south through it, an "external walkway"; the survey
//     draws the same: the passage's walls at u 18.07 and 21.36 (v -22), 64.41 inside, 64.29 in the slot south of it)
//     and it is turned 5.3 deg off the frame like the Rector's Lodgings (west face 5.23, north 5.25, passage 5.3, south
//     5.6 deg). Its west face u 17.12 at v -22, north face v -24.76 at u 19.1: NW corner (17.39, -24.91); 5.07 x 6.28 m
//     over walls (26/02068: 5.1 x 6.3; west wall 0.95 (plan 1.0), passage 3.27 (3.3), east wall 0.85 (plan)); the east
//     face (hidden in Chapel Row) from (22.44, -24.45) to (21.86, -18.19). Buttresses: SW 0.7 out over its last 0.9 m,
//     NW 0.72 out over its first 0.75 m (survey). The old box u 17.0 .. 23.2 took Chapel Row's west end for the tower.
//     The slot south of it (between the tower / Chapel Row's south face and the range's north end) is 1.35 - 1.5 m wide,
//     closed at u 25.9 by a line across it (a gate: G), its quad mouth spanned by the coped wall with the four-centred
//     archway (N Smith 2010: recessed behind the tower's SW buttress, beside the range).

import { Y } from './_exeter_shared.js';

export const DATUM = 64.40;

// ------------------------------------------------------------------------------------------------ the range's own frame
/** the range is authored in RANGE coordinates (u', v'); RANGE.toL turns them into LOCAL: a turn of TH about PIVOT */
export const RANGE = { pivot: [18.51, 0], th: (-1.25 * Math.PI) / 180 };   // K: survey fit (quad face slope 0.0218)
RANGE.toL = (u, v) => { const [pu, pv] = RANGE.pivot, c = Math.cos(RANGE.th), s = Math.sin(RANGE.th); return [pu + (u - pu) * c - v * s, pv + (u - pu) * s + v * c]; };
RANGE.toR = (u, v) => { const [pu, pv] = RANGE.pivot, c = Math.cos(RANGE.th), s = Math.sin(RANGE.th); return [pu + (u - pu) * c + v * s, pv - (u - pu) * s + v * c]; };

// ------------------------------------------------------------------------------------------------ the range in plan (RANGE coordinates)
export const R = {
  uQ: 18.51,         // quad (west) face. K: survey fit u 18.539 + 0.0218 (v - 1.25) (LIDAR's 18.4 was the slant's mean)
  uG: 26.76,         // garden (east) face: 8.25 m deep. K: survey 8.15 - 8.25; planning notes 8.3; roof plan 8.4
  vN: -17.17,        // north end at the quad face (the line runs to vNg at the garden face). K: survey (LIDAR -16.6)
  vNg: -16.46,       // north end at the garden face. K: survey (26.40, -16.64) LOCAL
  vS: 31.45,         // south end on Brasenose Lane at the quad face. K: survey (19.2, 31.44) LOCAL (LIDAR 31.3)
  vSg: 32.20,        // south end at the garden face. K: survey (27.43, 32.02) LOCAL
  vHall: 20.7,       // the quad face ends here, at the front of the Hall's oriel (part hall: v 20.65 - 20.72, its return
                     // at u 19.0 against this face; the survey's line west from the face at 20.6 - 20.8). K
  uHall: 19.22,      // SOUTH of vHall the range's west wall IS the Hall's east gable (part hall: outer face u 19.8 LOCAL, inner
                     // 19.05; the survey's lane step at 19.83): in range coordinates 19.35 (v 20.7) .. 19.10 (v 32): 19.22
                     // (+-0.13). Nothing of the range is drawn west of it there (the Hall's dais end and its roof). K
  vP: 12.7,          // Armagh (north) / Peryam (south) joint. G (high 2016 photo; the garden bays are Peryam's from 14.2)
  wall: 0.7,         // outer wall thickness (where the passages show it). G
};
/** the north / south end's v' at u' (the ends are not square to the faces) */
export const vNorth = (u) => R.vN + ((u - R.uQ) / (R.uG - R.uQ)) * (R.vNg - R.vN);
export const vSouth = (u) => R.vS + ((u - R.uQ) / (R.uG - R.uQ)) * (R.vSg - R.vS);

// ------------------------------------------------------------------------------------------------ levels
/** the quad's east path at the foot of the quad face, by v. K: LIDAR lgbox u 17.6 */
export const QUAD_GROUND = [[-17, -0.12], [-8, -0.1], [0, -0.08], [8, -0.12], [12, -0.15], [16, 0.0], [20, 0.1]];
/** the Fellows' Garden / yard at the foot of the garden face, by v. K: LIDAR u 29 */
export const GARDEN_GROUND = [[-20, -0.16], [-14, -0.06], [0, -0.06], [10, -0.05], [20, -0.1], [31.5, 0.05]];
/** Brasenose Lane at the south end, by u. K: LIDAR v 32.5 */
export const LANE_GROUND = [[17, 0.57], [20, 0.47], [24, 0.4], [27, 0.25], [29, 0.1]];
export const FOOT = 0.4;     // wall feet below the lower ground. K: brief

// ------------------------------------------------------------------------------------------------ heights
export const ROOF = {
  coping: 11.0,      // top of the quad parapet's coping (and Armagh's garden parapet). K: elevation 1:50 (mansard top
                     // 1.43 above it) fitted to the LIDAR flat 12.45 - 12.7 and the edge cells 10.6 - 11.0
  copingP: 10.35,    // Peryam's garden parapet. K: LIDAR 10.33 - 10.41 (v 19 - 31, u 26.2 - 27.2)
  parapetT: 0.4,     // K: roof plan
  gutter: 9.9,       // lead gutter behind the quad / Armagh parapets (1.13 below the coping). K: elevation 1:50
  gutterP: 9.3,      // behind Peryam's lower garden parapet. G
  gutterW: 0.7,      // gutter width behind the parapet (the plan's parapet + gutter band is 1.17 m). K
  knee: 12.3,        // top of the steep slated slopes = the lead flat's edges. K: 22/01763 section FF background (1:50,
                     // scaled +-0.1: "mansard top" 12.1 - 12.3 above 64.34 = +12.04 .. 12.24); elevation 04/00588 (coping +
                     // 1.43 = 12.43); LIDAR 12.45 - 12.7 (lead rolls, 1 m cells): 12.3 between (was 12.43)
  ridge: 12.5,       // the lead flat's middle (lead rolls). K: LIDAR 12.65 - 12.7 against 22/01763's 12.04 - 12.24 (was 12.65)
  kneeQ: 21.3, kneeG: 23.4,     // the lead flat's edges (u). K: roof plan (flat 2.1 m wide, a little to the quad side)
};

// QUAD FACE storeys (FrDr 2024 straight on, coping 11.0 at y 320 px, path -0.12 at 990 px, 0.0166 m a pixel). K: counts;
// the levels K from the photograph within +-0.1.
export const QF = {
  g: [1.21, 2.7], f: [4.69, 6.27], t: [7.81, 9.26],     // lights' sills and heads (round heads), ground / first / second
  labelRise: 0.4,                                        // the labels stand 0.4 above the heads and step down into a
                                                         // string course at head level that runs the length of the face
  lightW: 0.42, mullion: 0.14, reveal: 0.2,             // 3-light 1.54 m, 2-light 0.98 m over the glass (95 / 60 px)
  door: { w: 1.05, spring: 1.95, rise: 0.42 },          // four-centred doorways (head 2.37 on the photo: 840 px)
  panel: [6.75, 7.65],                                   // carved panels (blank shields) between the first-floor label and
                                                         // the second-floor sill at columns 1 and 9 (high 2016 photo)
};
// GARDEN FACE, Peryam (exeter.ox.ac.uk c2016 detail: parapet 10.35 at 95 px, garden -0.07 at 880 px). K: levels +-0.15
export const GP = {
  g: [0.73, 2.33], f: [3.66, 5.46], t: [6.72, 8.45], cornice: 8.93,
  lightW: 0.4, mullion: 0.13, reveal: 0.2,
  door: { w: 1.1, h: 2.3, fan: 0.4 },                    // the blue garden door: panelled, a fanlight, a square hood
};
// GARDEN FACE, Armagh (hidden from the garden by the Library's west end except v 5 .. 12.7): as the quad face. G

// ------------------------------------------------------------------------------------------------ columns
// QUAD FACE, north to south: 3- and 2-light columns ALTERNATING, ten in all; doors under three of the 2-light columns.
// K: high 2016 photo (all ten), FrDr 2024 (columns 2 - 8 square on, scaled by the roof plan's dormers: pitch 3.89 m),
// Simon Q 2012 (9, 10 and the Hall); staircase numbers: the college's map (4 at the south door, 5 the middle, 6 the north)
// and planning 04/00588 (4 in Peryam, 5 and 6 in Armagh). Registration 2026-11-23: door 5 = the passage (survey 4.0 ..
// 5.3: 4.8), door 6 -10.85 (FrDr by the dormers; the survey's bed breaks at -11.8 .. -9.8), door 4 19.45 (survey FFL
// label 19.0 .. 20.0); columns 1, 3 - 5, 7, 8 at the 3.89 pitch from them (FrDr: K +-0.2); column 9 between 8 and door 4
// (G +-0.4).
export const QUAD_COLS = [
  { v: -14.7, n: 3, panel: true },
  { v: -10.85, n: 2, door: 6 },
  { v: -6.95, n: 3 },
  { v: -3.05, n: 2 },
  { v: 0.85, n: 3 },
  { v: 4.8, n: 2, door: 5, passage: true, lamp: true },
  { v: 8.65, n: 3 },
  { v: 12.5, n: 2 },
  { v: 16.1, n: 3, panel: true },
  { v: 19.45, n: 2, door: 4, lamp: true },
];
export const QUAD_PIPES = [-9.2, -1.1, 6.25, 17.75];     // lead downpipes with hoppers: FrDr x 187, 668, 1100 by the dormer
                                                         // scale (K); the fourth (high 2016) between column 9 and door 4 (G)
export const GRILLES = [-6.95, -3.05, 0.85, 8.65, 12.5]; // basement lights in the foot of the wall (high 2016: two seen). G
// THE PLANTED BED along the quad face (the creeper's bed): its outer edge 1.15 m out from the face, parallel to it. K:
// survey (edge line 1.15 - 1.2 m out, v -16 .. -11.8 and -9.8 .. 18.85; FrDr 2024: agapanthus, lavender, small shrubs
// along the whole foot); runs between the breaks (door 6, the benches at -6.6 / 8.4 that the grounds part stands in it,
// the passage). Kerb G.
export const BED = { w: 1.15, kerb: { w: 0.12, h: 0.1 }, runs: [[-16.6, -11.8], [-9.8, -7.25], [-5.95, 4.0], [5.6, 7.75], [9.05, 18.85]],
  plants: { every: 1.7, r: [0.3, 0.5], h: [0.35, 0.8], kinds: ['flower', 'lavender', 'hosta', 'box', 'flower'], seed: 41, lod: 0.6 } };

// GARDEN FACE, south to north. Peryam (v 12.7 .. 31.3): K order and counts (R Sones 2012, the detail photo: a 2-light
// column, the south bay, the door column, the north bay, then 2-light columns); positions K roughly (R Sones scaled, LIDAR
// projections at v 13 - 19 and 24 - 28: +-0.7). Armagh: 2-light columns at the quad's pitch, G (unseen behind the Library).
// Registration 2026-11-23 (range v' = LOCAL v + 0.18 at the garden face): the bays' centres 16.2 and 25.7, the blue
// door 20.9 (survey steps), the passage 4.8 (survey 4.3 .. 5.3 LOCAL); Armagh's columns follow the quad's (G).
export const GARDEN_COLS = [
  { v: 29.1, k: 'two' },
  { v: 25.7, k: 'bay' },
  { v: 20.9, k: 'two', door: 'blue' },
  { v: 16.2, k: 'bay' },
  { v: 11.2, k: 'two' },
  { v: 8.0, k: 'two' },
  { v: 4.8, k: 'two', door: 'passage' },
  { v: 0.85, k: 'two' }, { v: -3.05, k: 'two' }, { v: -6.95, k: 'two' }, { v: -10.85, k: 'two' }, { v: -14.5, k: 'two' },
];
export const BAY = { front: 2.6, base: 3.6, proj: 0.8, nFront: 4 };   // three-sided, 4 lights in front and one in each
                     // side (detail photo). K: survey (fronts 14.6 .. 17.3 and 24.0 .. 26.8, bases 14.2 .. 17.8 and 23.7 ..
                     // 27.3, 0.75 - 0.8 m out; was 2.0 / 3.0 / 0.9 from the photo and LIDAR)

// ------------------------------------------------------------------------------------------------ the roof's things
// dormers (v). K: roof plan 1:100 scaled to the stacks (+-0.15 m); every one gabled except the two flat ones (garden).
export const DORMERS_Q = [-14.0, -12.0, -10.0, -8.0, -5.5, 0.2, 2.4, 4.6, 6.7, 9.0, 14.2, 17.3, 19.8];
export const DORMERS_G = [-14.0, -12.0, -10.0, -8.0, -5.4, -2.7, 0.2, 2.4, 4.6, 6.7, 12.0, 14.6, 17.0, 20.2, 22.5];
export const DORMERS_G_FLAT = [{ v: 9.4, w: 1.75 }, { v: 25.3, w: 3.0 }];   // K: roof plan + elevation ("flat lead roof to dormer")
export const DORMER = { w: 1.2, sill: 10.5, h: 1.45, rise: 0.45, frontQ: 19.6, frontG: 25.2 };   // K: width, height, gable
                     // (elevation 1:50); fronts at the slope's foot (roof plan). The elevation puts the sills 0.77 below the coping
                     // (10.23), but then no window would show from the lawn and FrDr 2024 shows the casements standing on the
                     // coping line and the gables reaching the flat (high 2016): sill 10.5, apex 12.4 (G, between the two)
// clustered stacks in the lead flat: rows of round flues (u of each row, v of each flue). K: roof plan (6 and 8 flues),
// LIDAR tops 16.4; FrDr (4 shafts across, moulded band, cornice cap). G: band level
export const STACKS = [
  { rows: [{ u: 21.65, v: [-3.55, -3.0, -2.45, -1.9] }, { u: 22.3, v: [-2.45, -1.9] }], top: 16.4 },
  { rows: [{ u: 21.65, v: [10.8, 11.35, 11.9, 12.45] }, { u: 22.3, v: [10.8, 11.35, 11.9, 12.45] }], top: 16.4 },
];
export const STACK = { r: 0.22, band: 13.9, cap: 0.4 };
// three stacks on the quad-side wall line behind the Hall's east end (roof plan: one octagonal flue, then two pairs).
// K: plan + LIDAR 14.6 - 15.9 at u 16 - 19, v 24 - 27; G: heights. (The Hall's builder may draw the same: see the report.)
export const HALL_STACKS = [{ v: 19.9, n: 1, top: 15.2 }, { v: 23.0, n: 2, top: 15.9 }, { v: 25.7, n: 2, top: 15.9 }];
// (their wall line south of vHall is the Hall's east gable: centred 0.35 east of uHall there, on the quad face north of it)
// the room in the roof over Peryam's quad side behind the Hall: a flat lead roof from the parapet to the flat (roof plan,
// elevation "Living/Study 4.3/6"). K
export const ROOM_P = { v0: 21.4, v1: 26.3, top: 12.3 };
export const FINIALS = [-11.0, 4.5];      // stone finials on the flat (FrDr: two show above the roof). K count; G place
export const SOUTH_STACK = { u: 22.35, top: 13.3 };      // a low stack at the south gable (elevation 4). K; G size

// ------------------------------------------------------------------------------------------------ the passage (staircase 5)
// "Entrance to the Fellows' Garden is by staircase 5" (fact sheet); staircase 5's door is the middle quad door (college map);
// the FrDr photograph looks through that open door to daylight at the far end. Its garden end lands beside the Library's
// west end (u 27 .. 29.5, open ground v 0 .. 6 in the LIDAR), whence the garden. K: the door; G: the passage's form.
// (Alden 1878's "small doorway at the S.E. angle" and the blue door in Peryam's garden face (v 20.8) are staircase 4's.)
// Registration 2026-11-23: the survey draws it at v 4.0 .. 5.15 (quad door), 4.57 .. 5.53 (corridor, the stair beside it
// to the north), 4.3 .. 5.3 (garden door), floor FFL 64.47 - 64.48 (a step of 0.18 up from the quad's 64.29): centre 4.8
// (res -0.2 .. +0.25), 1.2 m wide (the corridor's lines 0.96 apart centre to centre: G), floor K. The garden apron stops
// at the wall with the gate (part library, LOCAL v 4.05) to its north.
export const PASSAGE = { v: 4.8, w: 1.2, ceil: 2.9, floor: Y(64.47), apron: { u1: 28.2, v0: 4.3, v1: 6.4 } };

// ------------------------------------------------------------------------------------------------ Palmer's Tower
// A GATE TOWER (1432) with a vaulted passage north-south through it (26/02068/LBC ground plan, 1:100 with its bar; the
// survey), turned 5.3 deg off the frame like the Rector's Lodgings. Authored in the TOWER's own frame (a east along its
// south face's line, c south along its west face, y above the datum) from its outer NW corner: TOWER.toL(a, c) -> LOCAL.
// K: survey (registration 2026-11-23, see the header); LIDAR heights (lead flat 11.4 - 11.9, battlements 12.2 - 12.4,
// the NE turret 14.2 - 14.5); photographs (high 2016, N Smith 2010). G: each window / string figure.
export const TOWER = {
  O: [17.39, -24.91], th: (5.3 * Math.PI) / 180,   // K: survey west face u 17.12 (v -22), north face v -24.76 (u 19.1)
  A: 5.07, C: 6.28,              // over walls. K: survey; 26/02068 5.1 x 6.3
  flat: 11.5,                    // K: LIDAR
  string: 11.0,                  // the string under the parapet. G (high 2016 photo)
  parapet: 11.85, merlonTop: 12.4, merlon: { merlon: 0.75, gap: 0.5, h: 0.55 },   // K: LIDAR edges 12.2 - 12.4; battlements: photos
  strings: [3.8, 7.2],           // three stages (RCHM; 26/02068 "three storeys"). G levels
  turret: { a0: 2.85, a1: 5.07, c0: 0, c1: 2.2, top: 13.95, merlonTop: 14.5 },   // K: LIDAR 14.2 - 14.5 (NE corner); the high
                                 // 2016 photo (a battlemented turret at the far corner with a door onto the roof)
  // THE GATE PASSAGE: walls' inner faces at a 0.95 / 4.22 (3.27 clear: plan 3.3), floor 64.41 (survey, inside), the arches
  // at both ends narrowed by chamfered jambs 0.4 m (survey: the scalloped jambs at each mouth, 0.45 deep), a ribbed vault
  // (plan: a star pattern). K: plan, the jambs, the floor; G: the arch and vault heights (no section or photograph)
  pass: { a0: 0.95, a1: 4.22, floor: Y(64.41), jamb: 0.4, jambD: 0.45, spring: 2.6, crown: 4.1,
    arch: { spring: 2.35, rise: 0.95 },          // four-centred, 2.47 wide: apex 3.3 (G)
    door: { c: 3.4, w: 0.85, h: 2.0 } },         // D01, the newel stair's door in the east wall. K: plan; G its place
  // west face (quad): a two-light window in stage 2, a single in stage 3 (high 2016 photo; N Smith 2010); the memorial
  // tablet and a lantern at the foot (fact sheet: "at the foot of the tower, on the inward facing wall")
  west: { c: 3.0, w2: [4.5, 6.0], w1: [8.1, 9.5], tablet: [1.1, 2.5, 0.95], lamp: 2.9 },
  south: { a: 2.585, w1: [[4.6, 5.9], [8.2, 9.4]], dial: { a: 2.585, y: [6.5, 7.6], w: 0.9 } },   // K: sundial on the south
                                 // wall (fact sheet); G: its place (over the gate arch), windows G
  north: { a: 2.585, w1: [[4.6, 5.9], [8.2, 9.4]] },      // G: no photograph
  // ashlar buttresses on the west face: the SW one over the face's last 0.9 m, 0.7 out at its foot (survey), tall (high
  // 2016); the NW one over the first 0.75 m, 0.72 out (survey), low (photo). K plan; G stages
  buttSW: { c0: 5.38, c1: 6.28, stages: [[3.8, 0.7], [7.2, 0.55], [10.5, 0.4]] },
  buttNW: { c0: 0, c1: 0.75, stages: [[2.2, 0.72], [3.6, 0.45]] },
};
TOWER.toL = (a, c) => { const co = Math.cos(TOWER.th), si = Math.sin(TOWER.th); return [TOWER.O[0] + a * co - c * si, TOWER.O[1] + a * si + c * co]; };
// THE SLOT AND THE WAY ROUND (LOCAL). Between the tower's south face (carried on east by Chapel Row's south face: one
// straight survey line, (16.81, -18.66) .. (25.9, -17.82)) and the range's north end ((18.14, -17.17) .. (26.40, -16.64))
// a slot 1.35 - 1.5 m wide, ground 64.29 (survey), into which the gate passage opens; at the quad end the coped wall with
// a four-centred archway (N Smith 2010, high 2016: recessed behind the tower's SW buttress, the range beside it) stands in
// line with the passage's west jamb (u 17.75 .. 18.15: G); at u 25.9 a line across it (survey: a gate, G an open
// doorway) whence the yard east of the range. LIDAR: open to the sky at u 18.5 - 20; Chapel Row's roofs at 8.6 - 9.4
// reach over it at u 24 - 27.5 (a covered way: G its form).
export const WAY = {
  north: [[16.81, -18.661], [25.9, -17.817]],              // K: survey
  floor: Y(64.29),                                         // K: survey "64.29" twice in the slot
  screen: { u0: 17.75, u1: 18.15, top: 9.5, vS: -17.08 },  // the archway's wall, coped. G (top: N Smith 2010 by eye)
  arch: { w: 1.0, spring: 2.25, rise: 0.5 },                // apex 2.75 (N Smith: over the ground-floor heads). G
  cover: { u0: 21.9, u1: 25.9, ceil: 3.0, top: 8.8 },       // the covered way under Chapel Row's south end. G
  gate: { u: 25.9, t: 0.3, w: 1.0, h: 2.2 },                // K: survey line across; G: a doorway, open
  apron: { u1: 28.2, v1: -12.0 },                           // paving where the path turns south behind the range. G
};
/** the slot's north side (tower / Chapel Row south face) at u, LOCAL */
WAY.vT = (u) => { const [[a, b], [c, d]] = WAY.north; return b + ((u - a) / (c - a)) * (d - b); };
export const LAMPS = [
  { at: 'quad', v: 4.8, y: 3.45 },       // over staircase 5's door (FrDr). K
  { at: 'quad', v: 19.45, y: 3.45 },     // over staircase 4's door (high 2016). K
  { at: 'tower', y: 2.9 },               // on the tower's foot (high 2016). K
];
// CREEPER (Virginia creeper) over the quad face's lower two storeys, clear of the windows, its top ragged between these
// levels (FrDr 2024, high 2016; 01 gate passage picture P Halling 2025 across the quad). K: extent; G: the outline.
// Touch-up 2026-11-23: no longer flat strips but a mass of small overlapping leaves on a 0.3 m grid: `perCell` leaves in
// an edge cell / a cell inside it, `stray` the chance of a leaf just beyond the edge, `fade` metres of thinning at the
// ends, `leaf` the leaves' radius, `proud` how far they stand off the stone; the colours darker and greyer than the
// pack's lawn-green leaf cells (read off FrDr 2024: shadowed mid green with paler sunlit leaves). G figures.
export const CREEPER = {
  v0: -16.4, v1: 20.1, top: [5.2, 6.9], seed: 7,     // ends: 0.8 m in from the (registered) north end; to the Hall
  cell: 0.3, perCell: [2, 3], stray: 0.35, fade: 1.2, leaf: [0.09, 0.16], proud: [0.025, 0.13],
  leafShape: [0.66, 0.8],     // (fix-up pass) leaf-shaped cards: half-length = 0.66 x the old card's radius (leaves 10 - 18 cm long), width / length 0.8 (a creeper leaf is broad). G
  margin: [0.07, 0.12, 0.32], overhang: 0.06,   // clear of each window / door: sides, below, above (its label); leaves may lean this far into it
  tints: { creeperBack: 0x33482a, creeperA: 0x47653a, creeperB: 0x557540, creeperC: 0x3c5732, creeperD: 0x67864a },
};

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['the range turned 1.25 deg off the frame (east going south): quad face u 18.14 (v -17.17) .. 18.90 (v 18), was straight 18.4', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m; own fit over v -16.5 .. 19 (5472 px), res < 0.05'],
  ['garden face 8.25 m behind the quad face (was 26.8 straight: 8.4)', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m; own res -0.15 .. +0.07 (survey 8.15 - 8.25; planning notes 8.3; roof plan 8.4)'],
  ['north end not square: (18.14, -17.17) .. (26.40, -16.64) LOCAL (was -16.6 straight)', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m; own res < 0.05 (LIDAR roof edge -16.3 .. -16.6)'],
  ['south end on Brasenose Lane not square: (19.2, 31.44) .. (27.43, 32.02) LOCAL (was 31.3)', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m; own res < 0.1 (LIDAR 31.3)'],
  ['map outlines w301630465-67 lie ~1 m west of the LIDAR walls; the brief\'s 28.2 is Peryam\'s bays', 'K', 'LIDAR; map.json'],
  ['Peryam (1618, staircase 4) south of v 12.7, Armagh (1708, staircases 5, 6) north', 'K', 'planning 04/00588 background information; joint position G (high 2016 photo)'],
  ['mansard roof: stone parapets, wide lead gutters, steep slated slopes with dormers, lead flat 2.1 m wide', 'K', 'planning 04/00588 roof plan and elevations; LIDAR flat 12.65'],
  ['coping 11.0 (quad, Armagh garden), Peryam garden 10.35; gutter 9.9; flat 12.3 - 12.5 (was 12.43 - 12.65)', 'K', 'elevation 1:50 offsets fitted to LIDAR; 22/01763 section FF (parapet +10.84 .. 10.99, figured eave 75.29 = +10.89, mansard top +12.04 .. 12.24); LIDAR Peryam garden edge 10.33 - 10.41'],
  ['Peryam\'s garden parapet kept at 10.35: 22/01763\'s figured eave 75.83 (+11.43) "at the south end" disagrees', 'G', 'LIDAR 10.33 - 10.41 over v 19 - 31 (which roof the 75.83 label belongs to is inferred from its place on the PDF)'],
  ['south of the Hall\'s oriel (v 20.7) the range\'s west wall is the Hall\'s east gable (u 19.8 LOCAL): no quad face, parapet or roof edge drawn west of it; the lane end starts at the gable, 0.85 m north of the Hall\'s lane face (the survey\'s step at 19.83)', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m; part hall (survey pass); residual < 0.15'],
  ['why the garden side reads lower: Peryam\'s garden parapet is 0.65 m lower than Armagh\'s and the quad\'s', 'K', 'LIDAR xsec v 19 - 31 against v -15 - -6'],
  ['13 gabled dormers on the quad slope; 15 gabled + 2 flat-topped on the garden slope; positions', 'K', 'roof plan 1:100 (+-0.15 m)'],
  ['dormers 1.2 wide, 1.45 to the eaves, 0.45 gable; white fronts, slate cheeks', 'K', 'elevation 1:50; FrDr 2024 (finish)'],
  ['dormer sill 10.5 (the elevation says 10.23: raised so the casements show over the coping as in FrDr 2024)', 'G', 'elevation 1:50 against FrDr 2024 / high 2016'],
  ['two clustered stacks in the flat at v -2.74 (6 flues) and 11.6 (8 flues), tops 16.4', 'K', 'roof plan; LIDAR spikes; FrDr'],
  ['stack band level and cap', 'G', 'FrDr proportion'],
  ['three stacks on the wall line behind the Hall (1, 2, 2 flues)', 'K', 'roof plan; LIDAR 14.6 - 15.9; heights G'],
  ['the room in the roof over Peryam\'s quad side (flat lead, v 21.4 - 26.3)', 'K', 'roof plan; elevation "Living/Study 4.3/6"'],
  ['quad face: ten columns of round-arched lights under labels, 3 and 2 lights alternating from the north', 'K', '02 high 2016; 05 FrDr 2024; 02 Simon Q 2012'],
  ['quad columns at a 3.89 m pitch from door 6 (-10.85) to column 8 (12.5) (was 3.6: the photograph mis-scaled)', 'K', 'FrDr 2024 scaled by the roof plan\'s dormers (0.0169 m a pixel), +-0.2'],
  ['column 9 (16.1) between column 8 and door 4', 'G', 'high 2016 order; place by eye'],
  ['quad storey levels: sills / heads 1.21/2.7, 4.69/6.27, 7.81/9.26; labels 0.4 above the heads stepping into head-level strings', 'K', 'FrDr 2024 straight on (0.0166 m a pixel)'],
  ['doors: staircase 6 v -10.85 (was -11.0), 5 = the passage v 4.8 (was 3.15), 4 v 19.45 (was 18.5); four-centred heads, lanterns over 5 and 4', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m: passage gap 4.0 .. 5.3, the bed\'s break -11.8 .. -9.8, FFL label 19.0 .. 20.0; FrDr by the dormers (door 6 -10.85, door 5 5.0); own res +-0.25; sizes G'],
  ['blank carved panels at columns 1 and 9 between the first and second floors', 'K', 'high 2016 (arms as blank shields: no arms drawn)'],
  ['downpipes at v -9.2, -1.1, 6.25 (FrDr by the dormers) and 17.75', 'K', 'FrDr, high 2016; the fourth\'s place G'],
  ['basement lights in the foot of the wall', 'G', 'high 2016 shows two; the rest by rhythm'],
  ['Virginia creeper over the ground and first floors, ragged top, clear of the windows', 'K', 'FrDr 2024, high 2016; outline G'],
  ['creeper drawn as some 4000 small overlapping leaf-shaped cards (two triangles, folded; fix-up pass: were single triangles) 3 - 15 cm proud on a dark under-layer where thick, thinning at the edges; darker, greyer greens', 'G', 'the look of FrDr 2024 and P Halling 2025 (through the gate passage); leaf size, density and colours by eye'],
  ['ridge finials (two) on the flat', 'G', 'FrDr shows two above the roof; place G'],
  ['garden face Peryam: 2-light column, south bay (25.7), door column (20.9), north bay (16.2), 2-light columns', 'K', '05 R Sones 2012, detail c2016 (order); topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m: bays and the door\'s steps, own res < 0.2'],
  ['Peryam bays: three-sided, 4 lights + 1 each side, through three storeys to the parapet; front 2.6, base 3.6, 0.8 out (was 2.0 / 3.0 / 0.9)', 'K', 'detail c2016 (lights); topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m (plan)'],
  ['Peryam garden levels (sills/heads 0.73/2.33, 3.66/5.46, 6.72/8.45, cornice 8.93)', 'K', 'detail c2016 (+-0.15)'],
  ['blue panelled garden door with a fanlight under a square hood (v 20.8)', 'K', 'detail c2016; R Sones'],
  ['Armagh garden face (v -16.6 .. 12.7): 2-light columns at the quad pitch and the quad\'s levels', 'G', 'hidden by the Library; two columns seen (R Sones)'],
  ['south end on Brasenose Lane: a coped gable on the mansard\'s outline, 2-light windows, a low stack', 'G', 'N Chadwick 2014 (far, oblique); elevation 4 (the stack)'],
  ['THE PASSAGE of staircase 5 at v 4.8 (was 3.15): quad door to garden door, 1.2 m wide, flagged at FFL 64.47 (a step up from the quad), ceiled at 2.9', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m: door gaps 4.0 .. 5.15 / 4.3 .. 5.3, corridor 4.57 .. 5.53, FFL 64.47 / 64.48; own res -0.2 .. +0.25; width and ceiling G'],
  ['passage doors shown open', 'G', 'so the way through is clear'],
  ['Palmer\'s Tower turned 5.3 deg (as the Rector\'s Lodgings), NW corner (17.39, -24.91), 5.07 x 6.28 m: west face u 17.12 at v -22, east face (in Chapel Row) 22.44 .. 21.86 (was a box 17.0 .. 23.2 x -24.6 .. -18.6)', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m (own res < 0.06 on the west, north and south faces and both passage walls); 26/02068/LBC ground plan 1:100 (5.1 x 6.3)'],
  ['A GATE TOWER: the vaulted passage north-south through it, 3.27 m between its walls (plan 3.3), floor 64.41, chamfered jambs narrowing each mouth, a rib vault', 'K', '26/02068/LBC ground plan (vault drawn, "external walkway" in its heritage statement); topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m (walls, jambs, 64.41)'],
  ['the gate arches four-centred, 2.47 wide, apex 3.3; the vault\'s springing 2.6 and crown 4.1; D01 (the newel stair\'s door) in the east wall', 'G', 'no section or photograph of the passage; D01 from the plan, its place G'],
  ['the tower\'s NE corner (22.44, -24.45) kept 0.7 m east of the Lodgings\' west face (u 21.7): the tower\'s east wall (0.85) is ENGAGED in the Lodgings\' south end, the Lodgings\' west face running on the line of the passage\'s east inner face; no part moved (fix-up pass)', 'K', '26/02068/LBC ground plan 1:100 re-read at 200 dpi (78.7 px/m): the Lodgings\' west wall comes down flush with the passage\'s east jamb, the tower\'s east wall and stair behind it; topographic survey re-fitted (the passage\'s east face u 21.4 - 21.5 continuing north as the Lodgings\' face 21.75 - 21.9; the tower\'s outer east face not drawn: internal)'],
  ['tower: rubble with ashlar quoins, lead flat 11.5, battlements to 12.4, NE turret battlemented to 14.5 with a door to the roof', 'K', 'LIDAR; high 2016; N Smith 2010'],
  ['tower stage strings 3.8 / 7.2, cornice 11.0', 'G', 'photo proportion; RCHM three stages'],
  ['tower west face: 2-light in stage 2, single in stage 3; ashlar buttresses (tall SW 0.7 out over the last 0.9 m, low NW 0.72 out over the first 0.75 m)', 'K', 'high 2016; N Smith 2010; topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m (buttress plans); stage sizes G'],
  ['WWII memorial as a plain blank tablet at the foot of the west face; lantern over it', 'K', 'fact sheet; high 2016 (no names, no arms)'],
  ['sundial on the south wall over the gate arch; south / north face windows', 'G', 'fact sheet (sundial); no photograph of its form or of the north face'],
  ['the slot between the tower / Chapel Row (south face one line (16.81, -18.66) .. (25.9, -17.82)) and the range\'s north end: 1.35 - 1.5 m wide, ground 64.29; the passage opens into it', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m (own res < 0.05)'],
  ['the coped wall with a four-centred archway (1.0 wide, apex 2.75, top 9.5) across the slot\'s quad mouth, in line with the passage\'s west jamb (u 17.75 .. 18.15)', 'G', 'N Smith 2010, high 2016 (the arch, recessed behind the buttress, beside the range); the survey draws no jambs there: place and sizes G'],
  ['the covered way under Chapel Row over the slot (u 21.9 .. 25.9, ceiling 3.0, block to 8.8); the gate across the slot at u 25.9 (drawn as an open doorway)', 'G', 'LIDAR roofs 8.6 - 9.4 over u 24 - 27.5; topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m (the line across at 25.9); forms G'],
  ['tower east face: party wall with Chapel Row (part rector) below its roofs', 'K', 'LIDAR 8.4 - 10.5 east of it; the survey (Chapel Row\'s south face continues the tower\'s)'],
  ['the planted bed along the quad face: 1.15 m deep, v -16.6 .. 18.85, broken for door 6, the two benches and the passage; low stone kerb; low plants', 'K', 'topographic survey 210239-P-10 registered on 18 walls, rms 0.21 m (edge line 1.15 - 1.2 m out, own res < 0.05); FrDr 2024 (plants); kerb and plants G'],
];
