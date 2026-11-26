// Worcester College: THE TERRACE (the New North Range, Staircases 2 - 6) and the SENIOR COMMON ROOM range east of it —
// THE PLAN (pure data, no three.js). Read by the exterior (places/_worcester_terrace.js, called from worcester.js), by
// Staircase 5 and "your room" (_worcint_lodge_plan.js STAIR) and by the tests. College LOCAL frame (u east, v south;
// the world turned 0.0761 rad about (-250, 10)); heights are metres above the terrace walk's level = the college's
// datum (61.05 m above sea level; the walk's gravel is WORC.terraceY above it).
//
// HOW IT WAS MEASURED (2026-11-22; docs/research/worcester_survey.md B02, B03; nothing copied, nothing a texture):
//   * the 1939 RCHM plan at 9.89 px to the metre (the scale the main block was built to): u = -51.7 + (x - 181.7) / 9.89
//     from the Lodgings' east face, v = -16.7 - (206.7 - y) / 9.89 from the Chapel's north face. Window and door
//     openings of both fronts, the stair compartments, the spine wall and its fireplaces, the old range's skew;
//   * reference/worcester/02 …/terrace south front straight on (Commons, Godot13 2014), 1920 px wide: the walk at the
//     wall's foot is y = 864 px and the scale 52.03 px to the metre — fixed by the plan's flank bay (27.26 px = 2.756 m:
//     the photograph's 143.4 px), which also makes the range 54.1 m long. (The outline table WORC_TERRACE took 28.9 px/m
//     at 1080 wide = 51.4: its heights are 1.2 % high.)
//   * the 2022 height survey on this frame (it lies 0.5 m east of the map): eaves averaged over 104 stations at
//     v -18.3 and -29.68; the roof's section (a MANSARD: 12.15 m at the eaves, 14.05 m one metre in, 14.8 m on the
//     ridge); six stacks on the spine wall; both ends of the roof upright; the old range's roofs;
//   * the college's photograph of Provost's Yard through the Besse archway (the north face above the veranda) and the
//     yard builder's camera solution of it (_worcester_yard_plan.js): Staircase 6's yard door, the blind bay, the tall
//     stair window, the basement lights;
//   * 01 …/west front straight on (Godot13 2014): the screen wall and its arch between the Terrace and the main block,
//     the flat roof over the slip behind it, a gablet of the old range; the two photographs of the old range's gable on
//     Walton Street (Tilman2007 2025).
// WHAT THE OUTLINE TABLE AND THE MAP HAVE WRONG: the bays are NOT equal (flanks 2.756 m, the centre three 2.808 m
// apart, 3.18 m between bays 7 - 8 and 10 - 11, end piers 1.72 m); the centre block is 9.11 m wide; the range is
// 10.2 m deep (table: 9.5; map: 11.4); the old range east of it is two storeys under a steep stone-slate roof whose
// ridge is 8.8 m up (the map's two "staircases" were drawn 13.6 - 17.5 m tall) and it is skewed 3 degrees to the rest.
import { WORC, WORC_BLOCK as WB, WORC_TERRACE as WT } from './_worcester_shared.js';

const r4 = (x) => +x.toFixed(4);
const T = WORC.terraceY;

// ------------------------------------------------------------------------------------------------ the Terrace
const UC = -24.7, FB = 2.756, CB = 2.808, EDGE = 5.988, CHALF = 4.555;
const bays = [];
for (let i = 0; i < 19; i++) bays.push(r4(i <= 7 ? UC - EDGE - (7 - i) * FB : i <= 10 ? UC + (i - 9) * CB : UC + EDGE + (i - 11) * FB));

export const TERR = {
  u0: WT.u0, u1: WT.u1, vS: WT.vS, vN: WT.vN, depth: r4(WT.vS - WT.vN),
  uc: UC, bays, flankBay: FB, centreBay: CB,
  centre: [r4(UC - CHALF), r4(UC + CHALF)], breakOut: 0.25,      // the three bays under the pediment stand forward, on both fronts
  // doorways (bays, 0-based from the west): Staircases 6, 5, 4, 3. K: the 1939 plan (all four); the 2014 photograph (7, 13)
  doors: { 2: '6', 7: '5', 13: '4', 18: '3' }, through: 2,
  // wall lanterns: on every third pier (K: the four in the 2014 photograph; the end two a guess from the rhythm)
  lanterns: [{ u: r4(UC - 21.15), k: 'G' }, { u: -37.91, k: 'K' }, { u: -28.82, k: 'K' }, { u: -20.5, k: 'K' }, { u: -11.68, k: 'K' }, { u: r4(UC + 21.15), k: 'G' }], lanternY: 2.8,
  y: {
    floor: 0.5,                                         // the ground floor = the doorways' thresholds: a slab and two steps above the walk
    arch: { w: 1.72, foot: 0.4, spring: 3.0, d: 0.14, ring: 0.37 },      // the rusticated arcade: round recesses (crown 3.86) under voussoir rings
    gw: { w: 1.0, sill: 1.43, spring: 3.0 },            // the round-headed sashes in them (crown 3.5); the doorways are the same arch
    impost: [2.68, 3.09],
    band: [4.8, 5.07],                                  // the plat band over the ground storey
    f1: { w: 1.05, y0: 5.1, y1: 7.15 },                 // first floor (the sills sit on the band)
    f2: { w: 1.05, y0: 8.6, y1: 10.55 },                // second floor
    centreUp: 0.1,                                      // the centre block's upper windows stand this much higher than the flanks'
    hood: [7.6, 7.85],                                  // cornices on consoles over the centre's first-floor windows
    apron: [7.9, 8.52],                                 // the block under each second-floor sill (flanks)
    panel: { w: 1.88, y1: 10.84, d: 0.07 },             // flanks: each bay's two upper windows stand in one sunk panel
    bed: 11.37, mod: [11.47, 11.75], cornice: 11.75, corniceTop: 12.17, co: 0.7, bo: 0.15,      // modillion cornice (LIDAR eaves 12.1)
    blocking: 12.45, apex: 14.15,
    // the roof (LIDAR): steep stone-slated slopes with flat-topped dormers, a low-pitched metal top
    roof: { foot: 0.3, knee: 1.3, kneeY: 14.0, ridge: 14.8 },
    dormer: { w: 1.2, y0: 12.6, y1: 13.4, lid: 13.65, lidW: 1.6 },
    stack: { top: 16.0, w: 2.9, d: 0.8, pots: 8 },
  },
  stacks: [-47.5, -40.7, -34.2, -17.2, -10.0, -3.2],    // on the spine wall (K: LIDAR; five of them in the photographs)
  spineV: r4(WT.vS - 0.93 - 4.89 - 0.38),              // the spine wall's centre line (1939 plan: front wall 0.93, rooms 4.89, the wall 0.76)
  // how far behind the front's face the exterior paints what a walk-in room opens through (Staircase 5 reads these)
  rec: { door: 0.42, f1: 0.2 },
  // the north face (to Provost's Yard and the Fellows' Garden): plainer; rougher stone; sashes in plain frames on
  // bracketed sills; under it the basement shows as a storey
  north: {
    gw: { w: 1.1, y0: 1.45, y1: 3.75 }, tall: { bay: 1, y0: 1.9, y1: 4.5 }, blind: [2],      // (ground storey: K the yard photograph; bay 1 the stair window, bay 2 a blind panel)
    co: 0.35, plinth: 0.35,
    yard: { y: -2.8, foot: -2.85, u1: -25.8 },          // Provost's Yard: 58.25 m above sea level (the yard's level field runs to the wall)
    garden: { y: -1.7, foot: -1.9 },                    // the Fellows' Garden side, east of the Coach House (LIDAR 59.3 - 59.6 at the wall's foot)
    lights: { u0: -38.5, u1: -36.0, y0: -0.75, y1: -0.25, n: 3 },      // the white-framed basement lights under the veranda (K: the yard builder's solution)
  },
};
/** centre of bay i on the front (local u); west / east edge of the centre block */
export const bayU = (i) => TERR.bays[i];

// ------------------------------------------------------------------------------------------------ Staircase 6: the way through
// "Access route north" (the college's map): in at the quad front's bay 2, down inside the range, out by the yard door
// 2.8 m below. K: the two doorways (1939 plan / 2014 photographs; the yard photograph), that the way jogs east between
// them (mapped way w164759807), that there is a stair and a lift inside (the college's access guide). G: the stair
// itself — a hall inside the quad doorway in the 1939 plan's compartment, an opening in its east wall, a landing, and
// one straight flight of 18 risers going down north to a lobby inside the yard door. The lift is not built.
const S6U = TERR.bays[2];
export const S6 = (() => {
  const y0 = TERR.y.floor, y1 = TERR.north.yard.y, vIn = r4(WT.vS - 0.5);
  const hall = { u0: r4(S6U - 1.1), u1: r4(S6U + 1.02), v0: -22.6, v1: vIn };        // (1939: the compartment is 2.19 m wide, u -45.64 .. -43.45)
  const run = { u0: -43.0, u1: -41.2 };                                              // the stair's width = the yard door's (K)
  const top = { ...run, v0: -22.6, v1: -20.6 };                                      // landing at the head of the flight, at the hall's level
  const flight = { ...run, v0: -27.9, v1: -22.6, n: 18 };                            // down to the north
  const foot = { ...run, v0: r4(WT.vN + 0.6), v1: -27.9 };                           // lobby inside the yard door
  return {
    door: { u: S6U, w: TERR.y.gw.w }, yardDoor: { u0: -43.0, u1: -41.2, h: 2.25 }, y0, y1, vIn,
    hall, top, flight, foot, link: { v0: -22.4, v1: -20.9 },      // the opening between the hall and the landing (in the wall at hall.u1 .. run.u0)
    ceil: 3.6, ceilLow: 0.2,                                      // ceilings: over the hall and landing; over the flight's foot and the lobby (under the ground floor)
    rise: r4((y0 - y1) / 18),
  };
})();
/** the walking height inside Staircase 6 at local (u, v), or null outside it (plain core heights) */
export function s6Ground(u, v) {
  const H = S6.hall, F = S6.flight;
  if (v > WT.vN - 0.02 && v <= F.v1 && u > F.u0 - 0.05 && u < F.u1 + 0.05) return v <= F.v0 ? S6.y1 : r4(S6.y1 + (S6.y0 - S6.y1) * (v - F.v0) / (F.v1 - F.v0));
  if (v > F.v1 && v < S6.top.v1 + 0.05 && u >= H.u1 - 0.05 && u < F.u1 + 0.05) return S6.y0;
  if (u > H.u0 - 0.05 && u < H.u1 + 0.05 && v > H.v0 - 0.05 && v <= WT.vS - TERR.rec.door) return S6.y0;
  return null;
}

// ------------------------------------------------------------------------------------------------ the doorways' steps
/** the walking height at a staircase doorway of the quad front (the slab and two steps, the threshold), or null */
export function doorGround(u, v) {
  if (v > WT.vS + 0.75 || v <= WT.vS - 1.7) return null;
  for (const i of [2, 7, 13, 18]) {
    if (Math.abs(u - TERR.bays[i]) > 0.62) continue;
    if (v > WT.vS) return r4(T + (TERR.y.floor - T) * Math.min(1, (WT.vS + 0.75 - v) / 0.7));      // the steps in front of the wall
    if (v > WT.vS - TERR.rec.door - 0.02 || i === 7 || i === 2) return Math.abs(u - TERR.bays[i]) < TERR.y.gw.w / 2 + 0.1 ? TERR.y.floor : null;      // in the doorway (7: on into the walk-in staircase; 2: its hall)
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ the screen and the slip
// Between the Terrace's south-east corner and the main block's north-west corner the quad is closed by a wall with a
// round arch (K: the 2014 photograph of the west front, its left edge: creeper-clad, as high as the arcade's storey,
// an arch like the arcade's). Behind it the slip between the old range and the Chapel is roofed over at first-floor
// level (K: the same photograph; LIDAR 65.6 - 66.9 m from u 3 to u 14). The 1939 plan draws a doorway to the old range
// on its north side (Staircase 2) and a flight of 14 steps along the Chapel's wall from u 8.5 to u 12.2: which way they
// go and what they reach is NOT known, so the slip is built level to a shut door at u 8.3 and no further.
export const SLIP = {
  u0: WB.uW, u1: 8.3, v0: WT.vS, v1: WB.vN, arch: { v: r4((WT.vS + WB.vN) / 2), w: 2.06, spring: 2.85 }, top: 5.5,
  roof: { u1: 14.2, y: 5.45 },
};

// ------------------------------------------------------------------------------------------------ the Senior Common Room range
// The surviving 15th-century north range (survey B02). K: where it stands and its skew (1939 plan; LIDAR's north eaves
// run from v -26.3 at u 5 to -24.6 at u 26; the map's two outlines), the ridge 8.8 m and the south eaves about 5 m
// (LIDAR), the taller west end against the Terrace (LIDAR 11.6 - 12 m from u 2.3 to 4.6, 9 - 10.5 m to u 7.6), a
// red-brick stack there (LIDAR 12.5 m at (6, -23.3); the survey), the east gable on Walton Street's pavement with its
// ashlar stack of three pots and a dormer on the south slope beside it (two photographs), three gabled dormers on the
// north slope (the list description). G: every window and door, the west end's walls and roofs in detail.
export const SCR = {
  j: { u0: WT.u1, u1: 4.6, v0: -25.9, v1: -19.2, h: 11.6, roof: 11.95 },              // the junction block (Staircase 2)
  w: { u0: 4.6, u1: 7.6, eaves: 6.2, ridge: 10.4, stack: { u: 6.0, v: -23.3, top: 12.5 } },
  // the main range: its four corners (NW, NE, SE, SW); eaves and ridge above the datum
  u0: 4.6, uM: 7.6, u1: 27.5, nw: -25.9, ne: -24.6, sw: -19.2, se: -17.7, eaves: 4.95, ridge: 8.8, ov: 0.25,
  garden: { y: -1.1, foot: -1.6 },                                                    // the Fellows' Garden at its north wall (LIDAR 59.7 - 60.3)
  gableStack: { top: 11.4, w: 0.95, d: 0.85 },
  dormersN: [11.5, 16.5, 21.5], dormerS: 25.0,
};
/** the old range's north / south wall line and its ridge at local u */
export const scrN = (u) => SCR.nw + (SCR.ne - SCR.nw) * (u - SCR.u0) / (SCR.u1 - SCR.u0);
export const scrS = (u) => SCR.sw + (SCR.se - SCR.sw) * (u - SCR.u0) / (SCR.u1 - SCR.u0);

// ------------------------------------------------------------------------------------------------ ways, marks
/** the ways a player or a friend walks here (local points): no collider may cross them (tools/smoke_worcester.mjs) */
export const TERR_WAYS = (() => {
  const vW = r4(WT.vS + 2.4), F = S6.flight, mid = (F.u0 + F.u1) / 2, lk = (S6.link.v0 + S6.link.v1) / 2;
  const door = (i) => [[TERR.bays[i], vW], [TERR.bays[i], r4(WT.vS + 0.9)], [TERR.bays[i], r4(WT.vS + 0.12)]];      // (up the steps to the doorway: 4 and 3 are shut, 5 is the walk-in staircase's own door)
  return {
    walk: [[TERR.u0 + 1.5, vW], [UC, vW], [TERR.u1 - 0.6, vW], [WB.uW - 0.9, WB.vN + 3]],
    door6: door(2), door5: door(7), door4: door(13), door3: door(18),
    through6: [[S6U, vW], [S6U, r4(WT.vS - 1.6)], [S6U, lk], [mid, lk], [mid, F.v1 - 0.3], [mid, F.v0 - 0.4], [mid, r4(WT.vN - 0.9)]],
    slip: [[TERR.u1 - 0.9, vW], [WB.uW - 0.9, SLIP.arch.v], [WB.uW + 1.5, SLIP.arch.v], [SLIP.u1 - 0.8, SLIP.arch.v]],
  };
})();
/** marks for the friends' walking graph (places/friends.js is the core builder's): local (u, v) */
export const TERR_MARKS = (() => {
  const vW = r4(WT.vS + 2.4), F = S6.flight, mid = (F.u0 + F.u1) / 2, lk = (S6.link.v0 + S6.link.v1) / 2;
  return {
    walkWest: [TERR.u0 + 1.5, vW], walkMid: [UC, vW], walkEast: [TERR.u1 - 0.6, vW],
    stair6Quad: [S6U, r4(WT.vS + 0.9)], stair6Hall: [S6U, lk], stair6Head: [mid, lk], stair6Foot: [mid, r4(F.v0 - 0.4)], stair6Yard: [mid, r4(WT.vN - 1.0)],
    stair5Door: [TERR.bays[7], r4(WT.vS + 0.9)], stair4Door: [TERR.bays[13], r4(WT.vS + 0.9)], stair3Door: [TERR.bays[18], r4(WT.vS + 0.9)],
    slipArch: [WB.uW - 0.9, SLIP.arch.v], slipIn: [WB.uW + 1.5, SLIP.arch.v],
  };
})();

// ------------------------------------------------------------------------------------------------ known and guessed
/** [element, K | G, the picture, plan or measurement it rests on] */
export const TERR_CHECKED = [
  ['Terrace: 54.0 x 10.2 m, south face v -19.1, north face v -29.3', 'K', '1939 plan (10.2 - 10.45 m deep); LIDAR eaves at v -18.3 and -29.68 averaged over 104 stations'],
  ['Terrace: 19 bays, not equal — flanks 2.756 m, the centre three 2.808 m, 3.18 m either side of the centre, end piers 1.72 m; centre block 9.11 m wide, forward 0.25 m on both fronts', 'K', '1939 plan (openings of both fronts); 02/terrace south front straight on (Godot13 2014) at 52.03 px/m. The break\'s 0.25 m: G (the plan draws about 0.2)'],
  ['Terrace doorways at bays 2, 7, 13, 18 (Staircases 6, 5, 4, 3), thresholds a slab and two steps (0.45 m) above the walk', 'K', '1939 plan (all four stair compartments); the 2014 photograph (7 and 13, the steps at 7). 2 and 18 are in no photograph'],
  ['Terrace south front heights: arcade recesses 1.72 m wide crowned at 3.86 with voussoir rings and imposts; round-headed sashes sill 1.43, crown 3.5; band 4.8 - 5.07; first floor 5.1 - 7.15; second 8.6 - 10.55 over apron blocks; flank bays in sunk panels to 10.84; centre: architraves, cornices on consoles, windows 0.1 m higher; modillion cornice 11.37 - 12.17; blocking course to 12.45; pediment apex 14.15', 'K', 'the 2014 photograph, ground at y 864 px; LIDAR eaves 12.1 m'],
  ['Terrace roof: a mansard — steep stone-slated slopes (57 degrees) to 14.0 m one metre in, a low metal top to 14.8 m; upright at both ends; flat-topped white dormers, one a bay on the flanks of both slopes', 'K', 'LIDAR sections at ten stations; the 2014 photograph; S2 satellite (the north row). The top\'s metal: green copper by the survey\'s aerial (a tint of the lead cell here); the north dormers\' form: G'],
  ['Terrace stacks: six ashlar stacks on the spine wall with a row of eight pots each, at u -47.5, -40.7, -34.2, -17.2, -10.0, -3.2', 'K', 'LIDAR (bumps on the ridge); the 2014 and 2011 photographs (five of them). Their size: G'],
  ['Terrace lanterns: iron lanterns on brackets at 3 m on every third pier — four seen (u -37.9, -28.8, -20.5, -11.7), the end two guessed from the rhythm', 'K / G', 'the 2014 photograph; survey G01 ("one beside every Terrace doorway")'],
  ['Terrace creeper over the arcade storey; planting against the wall between the doorways', 'K', 'the 2014 photograph (creeper on the east half, bare wisteria on the west: drawn as the shader\'s creeper on the whole storey)'],
  ['Terrace north face: basement in coursed rubble as a full storey to the yard, the blue-grey yard door of Staircase 6 at u -43.0 .. -41.2, white-framed basement lights at u -38.5 .. -36; above: weathered ashlar, a band, sashes in plain frames on bracketed sills, bay 1 a tall stair window, bay 2 a blind panel; band; plainer cornice; a pediment', 'K', '04/provosts yard seen through besse building archway and the yard builder\'s camera solution of it; survey B03. East of bay 5 and above the first floor: G (the same pattern carried on)'],
  ['Staircase 6: the way through goes DOWN inside — hall, an opening east, a landing, one flight of 18 risers north, a lobby, the yard door 3.3 m below the hall', 'G', 'K: both doorways, the jog (mapped way w164759807), "stairs inside; a lift" (the access guide). The lift is not built'],
  ['Staircases 4 and 3: shut painted doors in their doorways', 'G', 'the photograph shows them standing open onto a stair; their interiors are not built'],
  ['Staircase 5 and "your room": door in bay 7, floor 0.45 m above the walk, first floor 4.45 m, your room behind bay 6\'s first-floor window', 'G', 'K: the bay, the levels of the front. The stair inside is the first pass\'s guess: the 1939 plan draws a compartment 2.4 x 4.9 m with the stair at its north end'],
  ['the screen wall and arch between the Terrace and the main block, the roofed slip behind it', 'K', '01/west front straight on (Godot13 2014), left edge; LIDAR (a roof at 65.6 - 66.9 m from u 3 to u 14). What is under the roof: G (flags, a shut door at u 8.3: the 1939 plan\'s flight beyond it is not built)'],
  ['Senior Common Room range: two storeys under a steep stone-slate roof, ridge 8.8 m, eaves 5 m; skewed (north wall v -25.9 to -24.6, south wall -19.2 to -17.7); a taller west end; a red-brick stack; three dormers north, one south by the gable', 'K', '1939 plan; LIDAR; survey B02 (list description)'],
  ['SCR range: windowless east gable on the Walton Street pavement at u 27.5, coursed rubble, a tall ashlar stack with three pots on its apex', 'K', '01/SCR gable on Walton St… a and b (Tilman2007 2025). The gable\'s plane to 0.3 m (plan 27.33, LIDAR 27.5 - 28.0)'],
  ['SCR range: windows, doors, the west end\'s form', 'G', 'no picture of either long side was found'],
];
