// Worcester College, Provost's Yard and the Provost's Lodgings: THE PLAN (pure data, no three.js: read by the builders
// places/worcester_yard.js + _worcester_yard_*.js, by the Memorial Room's plan in _worcint_lodge_plan.js and by
// tools/smoke_worc_yard.mjs). College LOCAL frame (u east, v south; the world turned 0.0761 rad about (-250, 10)).
//
// HOW IT WAS MEASURED (2026-11-22; docs/research/worcester_survey.md B04, B05, G14; nothing copied, nothing used as a
// texture):
//   * the 2022 height survey, sampled on this frame (it lies 0.5 m east of the map; its cells are 1 m, and the
//     sampling has a saw-tooth of +-0.5 m): roof edges and heights of the three ranges, the veranda and the Lodgings;
//   * the college's photograph taken inside the Besse archway looking south (reference/worcester/04 …/provosts yard
//     seen through besse building archway), solved as a camera: the Terrace's north windows are 54 m / 19 apart, which
//     gives focal length 1717 px, the camera 26.0 m north of the Terrace, 1.86 m up, at local (-39.2, -54.6), turned
//     17.3 degrees west of south. From it: the passage's two walls and its soffit (the lintel solved at both ends:
//     3.03 and 3.08 m), the west range's east wall (6.1 m west of the camera: the survey's -45.2), where its low part
//     begins and ends (v -42.1 and -36.5: the survey's -41.5 and -36.8), its two tall sashes, the porch's piers, the
//     veranda's columns, the planters, the yard door of Staircase 6;
//   * the 1939 RCHM plan at 9.89 px to the metre (the scale the main block was built to): the Lodgings 12.6 x 20.06 m,
//     its garden stair 6.5 x 3.7 m with fanned steps, its east wall the Terrace's west end;
//   * the two photographs of the Lodgings' west front (03 …/): the front solved from its four vertical edges (a
//     symmetric front of 20.05 m: flanks 6.0 m, centre 8.05 m) and every level scaled from the garden to the top of the
//     cornice (15.1 m: the survey's 73.05 m above sea level over a garden at 57.95).
// WHAT THE MAP HAS WRONG: the three ranges (one outline, w93711480) stand about 1.7 m EAST and 0.85 m SOUTH of where
// it draws them; the passage is 3.5 m wide (the brief and the owner guessed "5 m or so").
import { WORC_TERRACE as WT } from './_worcester_shared.js';

const PHI = 0.0761, COS = Math.cos(PHI), SIN = Math.sin(PHI), C0 = [-250, 10];
export const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];
export const W2L = (x, z) => { const dx = x - C0[0], dz = z - C0[1]; return [dx * COS - dz * SIN, dx * SIN + dz * COS]; };
export const YARD_FRAME = { phi: PHI, cos: COS, sin: SIN, c0: C0 };
const r4 = (x) => +x.toFixed(4);

// `?wyard=0` (node: GTO_WYARD=0): the yard and the Lodgings as the city generator drew them, for before / after
// pictures of the OUTSIDE only (the Memorial Room is fitted to the hand-built range either way)
export const YARD_ON = !((typeof location !== 'undefined' && location && /[?&]wyard=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_WYARD === '0'));
export const YARD_IDS = { ranges: 'w93711480', lodgings: 'w169617900', passage: 'w164759806', yardPath: 'w164759801', orchardPath: 'w169617910' };

// ------------------------------------------------------------------------------------------------ levels
// The yard, the Lodgings and the garden lie OUTSIDE the college's level core (WORC_LEVELS.flat). Everything here is
// built standing on y = 0 = "the drawn ground at the site", every height relative to it. Until the drawn terrain is in,
// the flat world there stands at the terrace walk's level; in truth (2022 height survey, metres above sea level):
export const YARD_LEVELS = {
  walkOD: 60.95, yardOD: 58.25, gardenOD: 57.95,
  yardBelowWalk: 2.7,           // the yard lies this far below the terrace walk: the Terrace's north side shows its basement as a storey, and the way from the quad comes DOWN inside Staircase 6
  gardenBelowWalk: 3.0,         // the Provost's Garden at the Lodgings' foot
  lodgingsMainFloor: 3.3,       // above the garden: the head of the garden stair = the black door's sill = the walk + 0.3 (two steps)
  // what is wrong on screen until the terrain draws the yard and the garden where they are (to be finished then)
  temporary: [
    'Provost\'s Yard is drawn level with the terrace walk (real: 2.7 m below it); the Terrace\'s basement storey and the stairs inside Staircase 6 are not there yet',
    'the Lodgings stand on the garden\'s drawn ground, which is the walk\'s level for now: the cornice is 2.9 m above the Terrace\'s and the black door with its two steps is 3.0 m above the drawn walk (LODG.base moves the whole house)',
  ],
};

const vT = WT.vN;      // the Terrace's north face (its plan is the core builder's: read, never copied)
// ------------------------------------------------------------------------------------------------ the three ranges
export const YARD = {
  vT, uLodg: WT.u0,
  // NORTH: the Besse Building (1955): two low storeys under a hipped stone-slate roof
  north: { u0: -45.9, u1: -25.8, v0: -59.45, v1: -50.35, eaves: 5.6, ridge: 9.65, ov: 0.3, floor1: 3.35 },
  // THE ARCHWAY: a flat-headed passage through the whole depth of the north range, the floor above carried over
  pass: { u0: -41.65, u1: -38.15, uc: -39.9, h: 3.05, kerb: 0.22, lamp: [-39.9, -51.15] },      // (lamp: on the soffit's centre line 0.8 m inside the yard mouth: the photograph, where its 0.38 m dome also checks the scale)
  // WEST, north part: the old kitchen, the War Memorial Room since 1949 ("M"): the taller block
  westTall: { u0: -51.75, u1: -45.15, v0: -51.1, v1: -41.7, eaves: 6.1, ridge: 8.35, ov: 0.3 },
  // … and the low lean-to against its north end, outside the yard (the survey: 3.0 m falling to 2.2 m)
  leanTo: { u0: -51.3, u1: -46.6, v0: -53.4, v1: -51.1, y0: 2.2, y1: 3.0 },
  // WEST, south part: the low range with the two tall sashes ("R", the Rose Garden Room)
  westLow: { u0: -51.75, u1: -45.15, v0: -41.7, v1: -36.6, eaves: 2.95, ridge: 6.0, ov: 0.3, sash: { v: [-40.8, -38.2], w: 0.85, y0: 0.75, y1: 2.55 } },
  // its entrance block at the south end: two stone piers in the wall's line carrying a small white pediment, a recess behind them
  porch: { u0: WT.u0, u1: -45.15, v0: -36.6, v1: -33.4, h: 3.0, pier: [-36.6, -34.8], pierW: 0.25, pierH: 2.0, deep: 1.1, apex: 2.88 },
  // EAST: the Coach House (former stables): one low storey, hipped at both ends; then a flat-roofed part down to the Terrace
  east: { u0: -32.7, u1: -25.9, v0: -50.35, v1: -36.5, eaves: 3.5, ridge: 6.0, ov: 0.3 },
  eastFlat: { u0: -32.7, u1: -25.9, v0: -36.5, v1: vT, h: 3.75 },
  // THE VERANDA: a lead-covered flat roof on slender wooden columns along the Terrace's foot (the bottom of Staircase 6)
  // and up the east side. The outer edge is the survey's; the back is the Terrace's face, wherever its builder puts it.
  veranda: {
    u0: WT.u0, u1: -32.7, vEdge: -31.55, colV: -31.25, cols: [-50.4, -48.0, -45.6, -43.2, -40.1, -37.7, -35.65],      // (the last is the corner column)
    ret: { uEdge: -35.95, colU: -35.65, v0: -38.7, cols: [-33.2, -35.2, -37.2, -38.45] },
    colH: 2.5, beam: 2.75, edge: 2.82, back: 3.05,
  },
  // the yard door of Staircase 6 in the Terrace's north face (a blue-grey glazed pair): the Terrace builder's to cut
  stair6Door: { u0: -43.0, u1: -41.2 },
  planters: [[-39.0, -41.0, 0.9, 0.72], [-40.1, -40.65, 1.0, 1.0], [-40.2, -41.8, 0.9, 0.72], [-41.1, -40.9, 0.9, 0.78]],      // u, v, side, height (timber boxes in the middle of the yard)
  pine: [-35.0, -48.8],         // the Wollemi pine in its square planter, in the corner by the arch (clear of the mapped outline of the old ranges: the placement audit reads a tree inside a rebuilt building's outline as a stray)
  pots: [-37.6, -30.2],         // the staging of terracotta pots under the veranda's corner
};

// ------------------------------------------------------------------------------------------------ the Memorial Room in the tall block
// The room is the tall block's ground floor (the college's photograph of it: a pier and a deep beam a third of the way
// along, a sash near the far end of the window wall, glazed double doors in the end wall's corner). Its yard door and
// its windows are the walk-in room's real openings: the exterior paints them exactly here.
const MT = YARD.westTall;
export const MEM_SHELL = {
  wall: 0.45, rec: 0.12,                                         // wall thickness; how far the painted sashes stand back from the wall face
  door: { v: -47.9, w: 1.5, h: 2.3 },                            // in the EAST wall, to the yard
  west: [{ v: -48.65, w: 1.05, y0: 0.95, y1: 2.85 }],            // sashes in the west wall (the one the photograph shows)
  east: [{ v: -44.2, w: 1.05, y0: 0.95, y1: 2.85 }],             // … and in the east wall, to the yard
  ceiling: 3.4,
};

// ------------------------------------------------------------------------------------------------ the Provost's Lodgings
// Henry Keene, 1773-76. Heights are above the garden at its foot (LODG.base = where that is in the drawn world).
export const LODG = {
  base: 0,
  u0: r4(WT.u0 - 12.6), u1: WT.u0, v0: -36.1, v1: -16.05,       // 12.6 x 20.05 m: its east wall is the Terrace's west end
  centre: { w: 8.05, out: 0.3 },                                 // the pedimented centre of the west front, standing forward
  y: {
    plinth: 3.1, main: 3.3,                                      // the rock-faced basement, its plat band = the main floor
    band: [7.8, 8.05],                                           // over the main storey
    frieze: 14.2, cornice: 14.5, top: 15.1,                      // the cornice (0.55 m out) and its top
    apex: 17.0, roof: 16.6,                                      // the pediment's apex; the lead flat of the hipped roof
    stack: 18.3,
  },
  win: {
    w: 1.15,
    base: [1.0, 2.0],                                            // basement lights
    main: [3.45, 6.1], mainHood: 6.45,
    first: [8.2, 10.3], firstHood: 10.75,
    second: [11.85, 13.5],
  },
  flankBay: 3.0,                                                 // the flank windows' distance from each end
  // the centre: a rusticated main storey (door between two narrow lights), above it a tripartite window between
  // pilasters under an entablature, a great relieving arch over that holding a lunette
  mid: { door: { w: 1.0, y1: 5.95 }, side: { d: 1.52, w: 0.65, y0: 3.4, y1: 5.9 }, pier: [2.1, 4.025], tri: { y0: 8.1, y1: 10.1, cw: 1.1 }, ent: [11.1, 11.8], arch: { r: 1.85, ring: 0.25 } },
  south: { bays: [1.6, 4.75, 7.85, 11.0], hoods: ['cornice', 'pediment', 'cornice', 'pediment'] },
  // the black front door on the east return, at the west end of the terrace walk: sill = the main floor, two steps below it
  door: { v: -17.6, w: 1.05, h: 2.15 },
  // the garden stair (a horseshoe: two fanned flights up to a landing before the garden door, a door to the basement under it)
  stair: { half: 3.25, out: 3.7, well: 1.2, landing: 1.5, risers: 19, straight: 8 },
};
LODG.stair.rise = LODG.y.main / LODG.stair.risers;

// ------------------------------------------------------------------------------------------------ ways, marks, checks
/** the ways a player or a friend walks here (local points): nothing may cross them (tools/smoke_worc_yard.mjs) */
export const YARD_WAYS = (() => {
  const P = YARD.pass, V = YARD.veranda, d = MEM_SHELL.door, S6 = (YARD.stair6Door.u0 + YARD.stair6Door.u1) / 2;
  const UNDER = r4(V.vEdge + 1.25);      // under the veranda, 1.25 m in from its edge: clear of the Terrace's north face wherever it stands (-29.3 as first built, WORC_TERRACE.vN as it is)
  return {
    passage: [[P.uc, YARD.north.v0 - 2.0], [P.uc, YARD.north.v0], [P.uc, (YARD.north.v0 + YARD.north.v1) / 2], [P.uc, YARD.north.v1], [P.uc, YARD.north.v1 + 2.0]],
    yard: [[P.uc, YARD.north.v1 + 2.0], [-36.9, -44.5], [-38.9, -36.0], [S6, V.vEdge - 0.6], [S6, UNDER]],      // (round the planters, then in under the veranda)
    // from the Terrace's foot at its bay 2 (where the core builder's doorway is to come) out under the veranda
    bay2: [[r4(WT.u0 + WT.bay * 2.5), UNDER], [r4(WT.u0 + WT.bay * 2.5), V.vEdge - 0.9], [-42.6, -36.0]],
    // (2026-11-23: the Terrace is rebuilt; the first pass's level passage at its old bay 1 is gone.) The way from the quad
    // is STAIRCASE 6 (places/_worcester_terrace_plan.js TERR_MARKS): in at its doorway on the terrace walk, a hall two
    // steps up, east to the head of the flight, down inside the range, out by the yard door under the veranda
    stair6: [[-44.468, -18.2], [-44.468, -21.65], [-42.1, -21.65], [-42.1, -28.3], [S6, UNDER], [S6, r4(V.vEdge - 0.6)], [-38.9, -36.0]],
    // the friends' way to the Memorial Room's doors (places/friends.js PY_C -> MEM_O, to be moved onto these)
    friends: [[S6, UNDER], [S6, r4(V.vEdge - 0.6)], [r4(MT.u1 + 0.75), d.v]],
    memorial: [[P.uc, YARD.north.v1 + 2.0], [-43.2, d.v], [MT.u1 + 0.5, d.v]],
  };
})();
/** marks for the friends' walking graph (places/friends.js is the core builder's): local (u, v) */
export const YARD_MARKS = {
  stair6Yard: [-42.1, r4(YARD.veranda.vEdge + 1.25)],             // the yard side of Staircase 6's door (under the veranda)
  stair6YardBay2: [r4(WT.u0 + WT.bay * 2.5), r4(YARD.veranda.vEdge + 1.25)],       // … if the doorway is cut at bay 2 instead
  yardMid: [-38.9, -36.0],
  memorialDoor: [r4(MT.u1 + 0.75), MEM_SHELL.door.v],              // in front of the Memorial Room's doors (MEM_O)
  passageSouth: [YARD.pass.uc, r4(YARD.north.v1 + 1.2)],
  passageNorth: [YARD.pass.uc, r4(YARD.north.v0 - 1.2)],
  orchard: [-40.8, -66.3],                                         // the mapped path's node on the Orchard side (the service road)
  lodgingsDoor: [r4(WT.u0 + 1.2), LODG.door.v],                    // before the black door, on the terrace walk
};

/** footprints (local rings) for the colliders, the terrain and the tests */
export const YARD_RINGS = (() => {
  const box = (o, v0 = o.v0, v1 = o.v1) => [[o.u0, v0], [o.u1, v0], [o.u1, v1], [o.u0, v1]];
  const N = YARD.north, P = YARD.pass, W = YARD.porch, w1 = W.pier[0] + W.pierW, w2 = W.pier[1] - W.pierW;
  return {
    northW: [[N.u0, N.v0], [P.u0, N.v0], [P.u0, N.v1], [N.u0, N.v1]],
    northE: [[P.u1, N.v0], [N.u1, N.v0], [N.u1, N.v1], [P.u1, N.v1]],
    westTall: box(YARD.westTall), westLow: box(YARD.westLow), leanTo: box(YARD.leanTo),
    // (the recess between the piers is open)
    porch: [[W.u0, W.v0], [W.u1, W.v0], [W.u1, w1], [W.u1 - W.deep, w1], [W.u1 - W.deep, w2], [W.u1, w2], [W.u1, W.v1], [W.u0, W.v1]],
    east: box(YARD.east, YARD.east.v0, vT),
    lodgings: [[LODG.u0, LODG.v0], [LODG.u1, LODG.v0], [LODG.u1, LODG.v1], [LODG.u0, LODG.v1]],
  };
})();
/** the ground this module lays (local rings): tarmac yard, setts through the arch, flags under the veranda */
export const YARD_GROUND = (() => {
  const N = YARD.north, P = YARD.pass, V = YARD.veranda, E = YARD.east, W = YARD.westTall, Q = YARD.porch;
  return {
    // (no two of these overlap: the tarmac is notched round the setts' apron)
    asphalt: [[W.u1, N.v1], [P.u0, N.v1], [P.u0, N.v1 + 0.4], [P.u1, N.v1 + 0.4], [P.u1, N.v1], [E.u0, N.v1], [E.u0, V.ret.v0], [V.ret.uEdge, V.ret.v0], [V.ret.uEdge, V.vEdge], [Q.u0, V.vEdge], [Q.u0, Q.v1], [Q.u1, Q.v1]],
    flags: [[Q.u0, V.vEdge], [V.ret.uEdge, V.vEdge], [V.ret.uEdge, V.ret.v0], [E.u0, V.ret.v0], [E.u0, vT], [Q.u0, vT]],
    setts: [[P.u0, N.v0 - 2.15], [P.u1, N.v0 - 2.15], [P.u1, N.v1 + 0.4], [P.u0, N.v1 + 0.4]],
  };
})();

// ------------------------------------------------------------------------------------------------ known and guessed
/** one row a building: [map id, K | G, what] */
export const CHECKED = [
  [YARD_IDS.ranges, 'K', 'Provost\'s Yard: where the three ranges stand, their roofs and heights from the 2022 height survey; the archway, the low west range, the porch, the veranda and the yard from the college\'s photograph; the Besse Building\'s and the Coach House\'s elevations a guess'],
  [YARD_IDS.lodgings, 'K', 'Provost\'s Lodgings: plan from the 1939 RCHM plan and the height survey; west front, south side and the black door from three photographs; north side and the east side of the north part a guess'],
];
/** attribute by attribute: [K | G, the picture, plan or measurement it rests on] */
export const ATTR = {
  yard: {
    position: ['K', 'height survey (0.5 m east of the map) and the archway photograph solved as a camera: the ranges are 1.7 m east and 0.85 m south of the mapped outline'],
    level: ['K', 'height survey: 58.25 m, 2.7 m below the terrace walk. Drawn at the walk\'s level until the terrain is in (YARD_LEVELS.temporary)'],
    surface: ['K', '04/provosts yard seen through besse building archway: tarmac; setts with stone kerbs in the archway'],
    planters: ['K', 'same photograph: four timber planters in the middle (places solved from it); a staging of terracotta pots under the veranda\'s corner'],
    wollemiPine: ['K', 'tour sheet: "in a square planter in the corner by the arch"; S2 satellite: a small tree in the north-east corner. Its exact place and its height (3.4 m): G'],
  },
  besseArchway: {
    place: ['K', 'the photograph solved as a camera (the Terrace\'s 19 bays give the scale): walls at u -41.65 and -38.15; the mapped covered footway w164759806 runs at u -41.0, inside it'],
    width: ['K', '3.5 m (the lintel\'s two ends in the photograph); the brief and the owner guessed "5 m or so"'],
    height: ['K', '3.05 m to a flat plastered soffit (the lintel solved at both ends: 3.03 and 3.08 m)'],
    walls: ['K', 'ashlar side walls, a stone kerb at the foot of each, a round bulkhead light in the soffit'],
    crests: ['K', 'bump-supper crests are chalked on both walls: NOT drawn (the college\'s sign sheet has no cell for them)'],
    floorAbove: ['K', 'the owner: "a whole floor above it which should stay"; the photograph'],
  },
  besseBuilding: {
    outline: ['K', 'height survey: walls 20.1 x 9.1 m, eaves 5.6 m, ridge 9.65 m, hipped at both ends (S2 satellite)'],
    roof: ['K', 'S2 satellite: stone slates'],
    elevations: ['G', 'no picture shows either long side: two low storeys of sashes, one over the arch'],
  },
  westRange: {
    twoParts: ['K', 'height survey: a tall block (eaves 6.1, ridge 8.35 m, hipped to the north) and a low one south of it (ridge 6.0 m, hipped to the south); the photograph shows the low one and the tall one\'s wall rising beside its downpipe'],
    lowRange: ['K', 'the photograph: coursed stone, stone slates, an iron gutter and downpipe, two tall narrow sashes (0.85 x 1.8 m, sills 0.75 m), eaves 2.9 m'],
    lowRangeSashes: ['G', 'drawn with the atlas\'s twelve-pane sash; the real ones are two panes wide and six high'],
    porch: ['K', 'the photograph: two stone piers in the wall\'s line 1.8 m apart, a white pediment over them, a six-pane window behind. G: the recess, where the door is, the block\'s roof'],
    whichRoom: ['G', 'the college map letters M on the taller north part and R south of it; the tour sheet: "the kitchen became the War Memorial Room"'],
    tallBlockWalls: ['G', 'its yard and garden sides are in no picture (only the Memorial Room\'s one west window, from inside)'],
    leanTo: ['K', 'height survey: a low lean-to against the tall block\'s north end (3.0 m falling to 2.2 m). G: its walls (plain, a boarded door)'],
  },
  coachHouse: {
    outline: ['K', 'height survey: 6.8 m wide, eaves 3.5, ridge 6.0 m (5.95 over the yard; the brief\'s 3.8 - 5.0 m is its slopes), hipped at both ends; a flat-roofed part (3.75 m) between it and the Terrace; S2 satellite: three rooflights on the yard slope'],
    elevations: ['G', 'former stables: boarded doors and small sashes'],
  },
  veranda: {
    place: ['K', 'height survey: a roof 2.7 m above the yard along the Terrace\'s foot from the Lodgings to the Coach House, 3 m deep, and up the east side to v -38.7; the tour sheet ("the screen of wooden columns … the bottom of Staircase 6")'],
    columns: ['K', 'the photograph solved: slender grey-blue columns 2.5 m tall on stone blocks, at u -45.6, -43.2, -40.1, -37.7 and the corner, a wider bay before the door; the return\'s at v -33.2 and -35.2. G: the two west of the porch, the return\'s last two'],
    height: ['K', '2.75 - 3.05 m (survey 2.7; the photograph 3.0). The brief\'s 5.1 m is the Coach House\'s roof'],
    floor: ['G', 'stone flags flush with the tarmac (the photograph shows a low kerb)'],
    lamp: ['G', 'a bulkhead light on the beam by Staircase 6\'s door: none is seen in the photograph, the way is used at night'],
  },
  [YARD_IDS.lodgings]: {
    plan: ['K', '1939 RCHM plan at 9.89 px/m: 12.6 x 20.06 m, its east wall the Terrace\'s west end, 3.0 m proud of the Terrace on the south; height survey: 19.9 m between the cornices\' walls'],
    heights: ['K', 'height survey: cornice top 73.05 m and the roof\'s flat 74.5 m above sea level over a garden at 57.95: 15.1 and 16.6 m'],
    westFront: ['K', '03/…west front from provosts garden (geograph 4062637), 03/…oblique (Remi Mathis 2011): basement and three storeys, 1-3-1, the centre forward under a pediment; rusticated main storey; tripartite window between pilasters; relieving arch and lunette; hoods on consoles'],
    mainFloor: ['K', '3.3 m above the garden = the terrace walk + 0.3 (the same photograph scaled; the survey\'s levels): the survey note\'s "about 1.6 m, 9-10 steps" is wrong'],
    gardenStair: ['K', '1939 plan: 6.5 x 3.7 m, two fanned flights; the photograph: iron railings, a door to the basement under the landing. G: 19 risers, how many are winders'],
    carving: ['K', 'swag, roundels, consoles and the cornice\'s modillions: NOT modelled (plain blocks)'],
    southSide: ['K', 'four bays; first-floor hoods cornice, pediment, cornice seen (the fourth a guess)'],
    blackDoor: ['K', '03/…black front door with fanlight: six panels, a radial fanlight in a round arch, two stone steps, on the east return at the terrace walk\'s west end'],
    wisteria: ['K', 'same photograph: wisteria over the whole return and round the door. Drawn with the atlas\'s creeper (as the Terrace\'s front); its reach is the shader\'s, not the photograph\'s'],
    roof: ['K', 'height survey + aerial views: a low hipped slate roof round a lead flat, a central stack. G: the stack\'s size, six pots'],
    northSide: ['G', 'three bays (the 1939 plan draws three windows)'],
    eastSideNorth: ['G', 'two bays (the 1939 plan draws a stair there)'],
  },
};
