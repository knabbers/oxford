// 5, 6 & 7 Beaumont Street: Worcester College's third-year houses between the Randolph and the Playhouse
// (OSM r13335393, "5-7 Beaumont Street", dormitory, operator Worcester College). Pure data + frame maths: no three.js,
// no DOM, so tools/smoke_beaumont.mjs imports it directly. Research and what every number came from:
// docs/research/worcester.md "Beaumont Street accommodation".
//
// Local frame ("front frame"): x = s, metres WEST along the street front from its east end (the Randolph's side);
// y up; z = out of the front wall towards the street (north-north-west). t = -z = metres back into the building.
// All heights below are above the ground at the foot of the front wall (world y = h + PAVE).
export const ID = 'r13335393';
/** `?beaumont=0` (node: GTO_BEAUMONT=0): the houses as the generic city builder drew them, no interior. */
export const BEAUMONT = !((typeof location !== 'undefined' && location && /[?&]beaumont=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_BEAUMONT === '0'));

export const E0 = [-21.2, 2.44];                         // east end of the front at the pavement (world x, z)
const FL = Math.hypot(26.8, 4.16);
export const DIR = [-26.8 / FL, 4.16 / FL];              // unit vector along the front, east -> west
export const OUT = [-DIR[1], DIR[0]];                    // unit outward normal (towards the street)
export const FRONT = 27.12;                              // length of the front (m): 9.9 + 9.8 + 7.42
export const DEPTH = 8.4;                                // front range, front wall face to courtyard wall face
export const PAVE = 0;                                   // world y of the ground at the foot of the front wall (the base paving; the kerbed pavement, 0.13, starts 2.5 m out)
export const HEADING_OUT = Math.atan2(OUT[0], OUT[1]);   // heading (radians) of someone walking out of the front door
/** front frame (s, t) -> world [x, z] */
export const L2W = (s, t) => [E0[0] + DIR[0] * s - OUT[0] * t, E0[1] + DIR[1] * s - OUT[1] * t];
/** world -> front frame [s, t] */
export const W2L = (x, z) => { const dx = x - E0[0], dz = z - E0[1]; return [dx * DIR[0] + dz * DIR[1], -(dx * OUT[0] + dz * OUT[1])]; };

// ---------------------------------------------------------------------------------------------- the three fronts
// win kinds: 's88' sash 8-over-8 (4 panes wide), 's66' 6-over-6, 's33' 3-over-3, 'french' (pair of glazed doors under
// a transom light, iron balconette). Each [centre s, width, sill, head]. door: [centre s, width, springing, fan].
export const HOUSES = [
  { no: 5, s0: 0, s1: 9.9, wall: 'stucco', top: 11.6, storeys: 4,
    door: { s: 4.8, w: 0.96, spring: 2.13, fan: 'plain' },
    wins: [
      ['s88', 1.6, 1.12, 0.94, 2.68], ['s88', 8.0, 1.12, 0.94, 2.68],
      ['s66', 1.6, 1.1, 3.5, 5.7], ['s66', 4.8, 1.1, 3.5, 5.7], ['s66', 8.0, 1.1, 3.5, 5.7],
      ['s66', 1.6, 1.05, 6.9, 8.1], ['s66', 4.8, 1.05, 6.9, 8.1], ['s66', 8.0, 1.05, 6.9, 8.1],
      ['s33', 1.6, 1.05, 9.56, 10.5], ['s33', 4.8, 1.05, 9.56, 10.5], ['s33', 8.0, 1.05, 9.56, 10.5],
    ] },
  { no: 6, s0: 9.9, s1: 19.7, wall: 'ashlar', top: 9.25, storeys: 3,
    door: { s: 11.0, w: 0.96, spring: 2.13, fan: 'plain' },
    wins: [
      ['s88', 13.7, 1.12, 0.94, 2.68], ['s88', 18.2, 1.12, 0.94, 2.68],
      ['s66', 11.1, 1.05, 3.9, 5.75], ['s66', 13.7, 1.05, 3.9, 5.75], ['french', 18.1, 1.2, 3.5, 5.8],
      ['s88', 11.1, 1.05, 6.9, 8.1], ['s88', 13.7, 1.05, 6.9, 8.1], ['s88', 18.1, 1.05, 6.9, 8.1],
    ] },
  { no: 7, s0: 19.7, s1: FRONT, wall: 'ashlar', top: 9.25, storeys: 3, enter: true,
    door: { s: 21.3, w: 0.96, spring: 2.13, fan: 'radial' },
    wins: [
      ['s88', 24.5, 1.12, 0.94, 2.68],
      ['french', 21.3, 1.2, 3.5, 5.8], ['french', 24.5, 1.2, 3.5, 5.8],
      ['s88', 21.3, 1.05, 6.9, 8.1], ['s88', 24.5, 1.05, 6.9, 8.1],
    ] },
];
export const LEVELS = { step: 0.17, band: [3.2, 3.35], sillBand: [6.8, 6.9], cornice: [8.6, 8.95], blocking: 9.25, plinth: 0.45,
  porch: { colR: 0.16, colTop: 2.83, entTop: 3.2, half: 0.92, proj: 0.42 } };
export const CHIMNEYS = [[10.45, 2.4, 12.6], [15.8, 3.0, 12.0], [24.6, 3.0, 11.8]];      // [s, t, top] red brick stacks
/** counts per house for the research table and the test: {no, windows, doors, balconies, storeys} */
export const COUNTS = HOUSES.map((h) => ({ no: h.no, windows: h.wins.length, doors: 1, balconies: h.wins.filter((w) => w[0] === 'french').length, storeys: h.storeys }));

// ---------------------------------------------------------------------------------------------- the plot behind
// What the user (who lived here) described, set out on the mapped plot: through the street door of No. 7 and straight
// through the house, out of its back door into a COURTYARD open to the sky (part of the world), and on along the path:
// the orange-rendered, timber-clad two-storey block of the college's courtyard photograph stands on your left, its
// door in the long side on the path. Everything here is in the front frame [s, t]. Which masses are which, what came
// from the photographs and what is a guess: docs/research/worcester.md "Beaumont Street: the courtyard house".
/** outline of the whole plot for the collider (front frame), anticlockwise from the front's east end: the mapped one */
export const OUTLINE = [[0, 0], [-0.03, 0.47], [-0.62, 10.38], [-0.78, 13.24], [0.89, 13.58], [0.4, 16.9], [5.38, 19.67], [28.28, 23.1], [FRONT, 0]];
/** the orange block (outer faces) */
export const BLOCK = { s0: 13.0, s1: 20.6, t0: 12.4, t1: 20.6 };
/** the open ground: the courtyard behind Nos 6 and 7, the pocket by the Playhouse wall, the path down the block's side */
export const COURT = [[13.0, DEPTH], [27.5, DEPTH], [27.56, 9.6], [22.8, 9.6], [22.8, 20.6], [20.6, 20.6], [20.6, 12.4], [13.0, 12.4]];
/** the other buildings round it, as plain masses: {id, poly, h}. east: the older rear wings (the white-painted brick
 *  wall of the photograph is its face on the courtyard); west and south: the 2009 cream blocks */
export const MASSES = [
  { id: 'east', h: 6.2, poly: [[13.0, DEPTH], [13.0, 20.81], [5.38, 19.67], [0.4, 16.9], [0.89, 13.58], [-0.78, 13.24], [-0.62, 10.38], [-0.5, DEPTH]] },
  { id: 'west', h: 9.2, poly: [[22.8, 9.6], [27.6, 9.6], [28.15, 20.6], [22.8, 20.6]] },
  { id: 'south', h: 11.2, poly: [[20.6, 20.6], [28.15, 20.6], [28.28, 23.1], [20.6, 21.95]] },
];
/** the walls of all that in the world's collider (front frame segments): what stops you in the courtyard */
export const COURT_WALLS = [
  [[-0.5, DEPTH], [27.54, DEPTH]],                                   // the back of the front range (the back door is a portal's passage)
  [[13.0, DEPTH], [13.0, 12.4]], [[13.0, 12.4], [20.6, 12.4]], [[20.6, 12.4], [20.6, 20.6]],      // white wall; the block's north and west faces
  [[20.6, 20.6], [22.8, 20.6]], [[22.8, 20.6], [22.8, 9.6]], [[22.8, 9.6], [27.6, 9.6]],
  [[23.2, 9.6], [23.2, 20.6]], [[23.8, 9.6], [23.8, 20.6]],        // (inside the cream block: nowhere in it reads as free ground to a tool looking for a place to stand)
];
/** things standing in the courtyard: the brick planter with the hydrangea (photograph), bikes against the white wall */
export const PLANTER = { s: 16.9, t: 10.5, r: 1.25, h: 0.62 };
export const BIKES = { at: [[13.95, 9.15], [13.95, 9.75], [13.95, 10.35], [13.95, 11.25]], box: [13.0, 14.85, 8.85, 11.6] };      // a row, front wheels to the wall
export const REAR_H = 9.0;

// ---------------------------------------------------------------------------------------------- No. 7: the way through
// The passage from the street door to the back door: s 20.6..22.0, the depth of the front range. Wall faces: front wall
// inner face t = WT; the courtyard wall's inner face T1 (that wall is 0.2 m thick).
const WT = 0.35;
export const IN = {
  WT, S0: 20.6, S1: 22.0, T1: 8.2,
  G: 0.17, GC: 3.0,                               // floor / ceiling above the pavement
};
/** Hinged doors, authored with what the shared door mechanism needs. hinge / latch: [s, t] of the leaf's two ends when
 *  shut; into: the way the leaf swings, a direction [ds, dt] in the front frame; open: radians; level: 0 ground, 1
 *  first floor; w, h: leaf size; knob: handle height; mass: kg; closer: self-closing after hold seconds;
 *  room: which registered room it belongs to ('pass' | 'block'); portal: the index of that room's portal it closes. */
export const DOORS = [
  { id: 'front', room: 'pass', portal: 0, label: 'the front door', level: 0, hinge: [21.78, 0.2], latch: [20.82, 0.2], into: [0, 1], open: 1.48, w: 0.96, h: 1.96, knob: 1.0, mass: 45, closer: true, hold: 2.6, kind: 'panelled, black, brass knob; round fanlight over (fixed)' },
  { id: 'back', room: 'pass', portal: 1, label: 'the back door', level: 0, hinge: [20.85, 8.3], latch: [21.75, 8.3], into: [0, -1], open: 1.5, w: 0.9, h: 2.0, knob: 1.0, mass: 24, closer: true, hold: 2.4, vision: true, kind: 'grey fire door with a vision panel and a closer' },
];

// ---------------------------------------------------------------------------------------------- the courtyard house
// Two storeys, 7.6 x 8.2 m. Ground: the door in the west side (on the path) opens into a hall running east; a student
// room on the left (north, on the courtyard), the kitchen on the right (south), and straight ahead the small winding
// stair that turns through 180 degrees. First floor: you come up facing back west along the landing; on your right is
// Matt's room (over the ground-floor room: the corner window of the photograph), on your left the doors of two more.
export const BK = {
  WALL: 0.2,
  S0: BLOCK.s0 + 0.2, S1: BLOCK.s1 - 0.2, N: BLOCK.t0 + 0.2, S: BLOCK.t1 - 0.2,      // inner faces of the outer walls (13.2, 20.4, 12.6, 20.4)
  G: 0.06, GC: 2.5, F1: 2.8, F1C: 5.2, EAVES: 5.5,
  HN: 15.55, HS: 17.55,                           // the hall's two partitions (centre lines; 0.1 m thick)
  RE: 15.0,                                       // east wall face of the two north rooms (a riser cupboard beyond)
  AB: 16.8,                                       // the partition between rooms 2 and 3 (centre line)
  // the stair's well at the east end of the hall strip: two straight flights either side of a spine wall, joined by
  // five winders round its end (centre cs, mid)
  well: { s0: 13.2, s1: 15.8, mid: 16.55, cs: 14.15, r: 0.95, treads: 15, straight: 5, winders: 5 },
  pod: { s0: 15.0, s1: 16.8, t0: 13.7, t1: 15.5 },                 // the square en-suite boxed into the corner of each north room
  podA: { s0: 13.2, s1: 14.6, t0: 17.6, t1: 19.0 }, podB: { s0: 19.0, s1: 20.4, t0: 17.6, t1: 19.0 },      // rooms 2 and 3 (doors shut)
  DOOR: { t: 16.55, w: 0.94 },                    // the entrance: centre along the west wall, width
};
const HH = (BK.HS - BK.HN - 0.1) / 2;             // half the hall's clear width (0.95)
DOORS.push(
  { id: 'block', room: 'block', portal: 0, label: 'the courtyard house\'s door', level: 0, hinge: [20.5, 17.02], latch: [20.5, 16.08], into: [-1, 0], open: 1.5, w: 0.94, h: 2.04, knob: 1.0, mass: 26, closer: true, hold: 2.4, vision: true, kind: 'blue-grey door with a vision panel and a closer' },
  { id: 'room1', room: 'block', label: 'the door of room 1', level: 0, hinge: [18.6, BK.HN], latch: [17.75, BK.HN], into: [0, -1], open: 1.5, w: 0.85, h: 2.0, knob: 1.0, mass: 22, closer: true, hold: 2.0, kind: 'white fire door with a closer' },
  { id: 'kitchen', room: 'block', label: 'the kitchen door', level: 0, hinge: [18.8, BK.HS], latch: [17.9, BK.HS], into: [0, 1], open: 1.5, w: 0.9, h: 2.0, knob: 1.0, mass: 22, closer: true, hold: 2.0, kind: 'white fire door with a closer' },
  { id: 'matt', room: 'block', label: 'the door of Matt\'s room', level: 1, hinge: [18.6, BK.HN], latch: [17.75, BK.HN], into: [0, -1], open: 1.5, w: 0.85, h: 2.0, knob: 1.0, mass: 22, closer: true, hold: 2.0, kind: 'white fire door with a closer' },
  { id: 'room2', room: 'block', label: 'the door of room 2', level: 1, hinge: [16.7, BK.HS], latch: [15.9, BK.HS], into: [0, 1], open: 1.5, w: 0.8, h: 2.0, knob: 1.0, mass: 22, closer: true, hold: 2.0, kind: 'white fire door with a closer' },
  { id: 'room3', room: 'block', label: 'the door of room 3', level: 1, hinge: [17.2, BK.HS], latch: [18.0, BK.HS], into: [0, 1], open: 1.5, w: 0.8, h: 2.0, knob: 1.0, mass: 22, closer: true, hold: 2.0, kind: 'white fire door with a closer' },
  // Matt's en-suite: no closer, left ajar, opens into the bathroom along its south wall
  { id: 'ensuite', room: 'block', label: 'the bathroom door', level: 1, hinge: [16.8, 15.31], latch: [16.8, 14.55], into: [-1, 0], open: 1.5, w: 0.76, h: 1.98, knob: 1.0, mass: 14, closer: false, rest: 0.6, kind: 'plain white door, left ajar' },
);

// ---- the stair: a path coordinate u in 0..1 from the foot (hall, south flight, heading east) round the winders to the
// head (north flight, heading west). 16 risers; the ground follows the treads' middles.
const WL = BK.well, RUN = WL.s1 - WL.cs, ARC = Math.PI * 0.5, PATH = 2 * RUN + ARC;
/** is the front-frame point in the stair's well? */
export const inWell = (s, t) => s > WL.s0 - 0.3 && s < WL.s1 && t > BK.HN && t < BK.HS;
/** path coordinate (0 foot .. 1 head) of a point in the well */
export function stairU(s, t) {
  if (s >= WL.cs) return (t > WL.mid ? WL.s1 - s : RUN + ARC + (s - WL.cs)) / PATH;
  const phi = Math.atan2(WL.cs - s, t - WL.mid);                   // 0 on the south radial, PI / 2 due east, PI on the north radial
  return (RUN + (Math.max(0, phi) / Math.PI) * ARC) / PATH;
}
const RISE = (BK.F1 - BK.G) / (WL.treads + 1);
/** height above the pavement of the stair at a point in the well */
export const stairH = (s, t) => BK.G + RISE * (0.5 + WL.treads * Math.min(1, Math.max(0, stairU(s, t))));
/** tread i (0..treads-1): its top, and the range of u it takes */
export const tread = (i) => ({ y: BK.G + RISE * (i + 1), u0: i / WL.treads, u1: (i + 1) / WL.treads });
export const STAIR = { RISE, RUN, ARC, PATH };

/** rectangles [s0, s1, t0, t1] you can stand in, per room and level (the test walks them) */
export const FLOORS = {
  pass: [[IN.S0, IN.S1, WT, IN.T1]],
  0: [[WL.s1, BK.S1, BK.HN + 0.05, BK.HS - 0.05], [BK.RE, BK.S1, BK.N, BK.HN - 0.05], [BK.S0, BK.S1, BK.HS + 0.05, BK.S]],
  1: [[WL.s1, BK.S1, BK.HN + 0.05, BK.HS - 0.05], [BK.RE, BK.S1, BK.N, BK.HN - 0.05], [BK.S0, BK.AB - 0.05, BK.HS + 0.05, BK.S], [BK.AB + 0.05, BK.S1, BK.HS + 0.05, BK.S]],
};

/** The real openings of the courtyard house: wall 'N' | 'W' | 'S' of the block, c = centre along that wall (s for N and
 *  S, t for W), w, sill y0 and head y1 above the pavement, storey, the room it lights */
const F = BK.F1;
export const OPENINGS = [
  { id: 'room 1, corner window north', wall: 'N', c: 19.5, w: 1.6, y0: 0.24, y1: 2.3, level: 0, room: 'r1', kind: 'corner' },
  { id: 'room 1, corner window west', wall: 'W', c: 13.45, w: 1.5, y0: 0.24, y1: 2.3, level: 0, room: 'r1', kind: 'corner' },
  { id: 'kitchen window', wall: 'W', c: 19.0, w: 1.4, y0: 1.02, y1: 2.2, level: 0, room: 'kitchen' },
  { id: 'Matt\'s room, corner window north', wall: 'N', c: 19.4, w: 1.8, y0: F + 0.85, y1: F + 2.25, level: 1, room: 'matt', kind: 'bay' },
  { id: 'Matt\'s room, corner window west', wall: 'W', c: 13.45, w: 1.5, y0: F + 0.85, y1: F + 2.25, level: 1, room: 'matt', kind: 'bay' },
  { id: 'Matt\'s room, small window', wall: 'N', c: 15.9, w: 0.6, y0: F + 1.4, y1: F + 2.0, level: 1, room: 'matt' },
  { id: 'landing window', wall: 'W', c: 16.55, w: 0.9, y0: F + 0.95, y1: F + 2.1, level: 1, room: 'bhall' },
  { id: 'room 3 window', wall: 'W', c: 19.7, w: 1.0, y0: F + 0.9, y1: F + 2.1, level: 1, room: 'r3' },
  { id: 'room 2 window', wall: 'S', c: 15.0, w: 1.2, y0: F + 0.9, y1: F + 2.1, level: 1, room: 'r2' },
];
/** an opening's two ends in the front frame, on the block's OUTER face, and its outward direction [ds, dt] */
export function openingEnds(o) {
  if (o.wall === 'N') return { a: [o.c - o.w / 2, BLOCK.t0], b: [o.c + o.w / 2, BLOCK.t0], out: [0, -1] };
  if (o.wall === 'S') return { a: [o.c + o.w / 2, BLOCK.t1], b: [o.c - o.w / 2, BLOCK.t1], out: [0, 1] };
  return { a: [BLOCK.s1, o.c - o.w / 2], b: [BLOCK.s1, o.c + o.w / 2], out: [1, 0] };
}
/** where the lights are on after dark (shared clock) -> { zone: bool }. The bathroom's light is always on: Go is in there. */
export function lit(hour, night) {
  const on = night > 0.45, eve = (a, b) => on && (hour >= a || hour < (b > 24 ? b - 24 : 0)) && (b > 24 || hour < b);
  return { pass: on, bhall: on, kitchen: eve(16.5, 23.5), r1: eve(18, 24.5), matt: eve(17, 25.5), bath: true, r2: eve(19, 23), r3: eve(18.5, 26) };
}
export const ZONES = ['pass', 'bhall', 'kitchen', 'r1', 'matt', 'bath', 'r2', 'r3'];

// ---------------------------------------------------------------------------------------------- comings and goings
// Two anonymous students on the shared clock (no network messages): every CYCLE seconds one comes along the pavement
// from the Playhouse end, opens the door and goes in; a little later another comes out and walks off towards St Giles'.
export const CYCLE = 150;
const DOOR_S = 21.3;
const PATHS = [
  // arriving from the west: along the pavement 2.2 m out, to the step, through the door, down the passage, gone
  { t0: 8, pts: [[44, -2.6], [22.6, -2.4], [DOOR_S, -0.75], [DOOR_S, 0.9], [21.25, 3.4], [21.25, 6.4]], seed: 0 },
  // leaving: down the passage, a pause clear of the door's swing while it is pulled open, down the step, east along the pavement
  { t0: 78, pts: [[21.25, 6.4], [21.2, 1.85], [DOOR_S, 0.9], [DOOR_S, -0.75], [19.2, -2.5], [-4, -2.9]], seed: 1 },
];
const SPEED = 1.3;
/** -> for student i at shared time (s): null (not about) or {s, t, ds, dt, moving, inside, k} */
export function studentAt(i, now) {
  const P = PATHS[i], k = Math.floor(now / CYCLE), u = now - k * CYCLE - P.t0;
  if (u < 0) return null;
  let d = u * SPEED;
  for (let j = 0; j < P.pts.length - 1; j++) {
    const a = P.pts[j], b = P.pts[j + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // a pause at the door (the hand goes to the knob, the leaf swings)
    const wait = j === 2 && i === 0 ? 0.9 * SPEED : j === 1 && i === 1 ? 1.5 * SPEED : 0;
    if (d < wait) return { s: a[0], t: a[1], ds: b[0] - a[0], dt: b[1] - a[1], moving: false, inside: a[1] > 0.2, k };
    d -= wait;
    if (d < L) { const f = d / L; return { s: a[0] + (b[0] - a[0]) * f, t: a[1] + (b[1] - a[1]) * f, ds: b[0] - a[0], dt: b[1] - a[1], moving: true, inside: a[1] + (b[1] - a[1]) * f > 0.2, k }; }
    d -= L;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------- the walk-in rooms
// Two rooms are registered with core/interiors.js (places/worcester_beaumont.js): No. 7's passage (two doorways to the
// world: the street door and the back door) and the courtyard house (one doorway, two storeys). The courtyard between
// them is the world. ROOM FRAME (both) = the front frame with x = s, y = height above the ground at the foot of the
// front wall, z = -t (so +z is out of the front wall towards the street, and heading 0 points out of the front door).
// The exterior group in the world scene has exactly this frame, so a room point (x, y, z) is the world point
// L2W(x, -z) at world height y + PAVE.
export const ROOM_ID = 'worcester_beaumont7';
export const BLOCK_ID = 'worcester_beaumont_court';
/** the shell the passage was fitted to: No. 7's part of the front range (front frame) */
export const SHELL7 = { s0: 19.7, s1: FRONT, t0: 0, t1: DEPTH, eaves: 8.6, wall: WT };
/** feet above this (room y) = on the first floor of the courtyard house (changes on the stair only) */
export const LEVEL_Y = (BK.G + BK.F1) / 2;
/** is the room point (x, z) on the stair? */
export const onStair = (x, z) => inWell(x, -z);
/** floor height (room y) at the room point (x, z) of the courtyard house for somebody on storey `level` (0 | 1) */
export const groundAt = (x, z, level) => (inWell(x, -z) ? stairH(x, -z) : level ? BK.F1 : BK.G);

/** Walls and furniture for the colliders, front frame: segs [[s, t], [s, t]], boxes [s0, s1, t0, t1]. The outer walls
 *  run across the doorways: a doorway is opened by its portal's passage while its door is open (core/interiors.js). */
export const SOLID_PASS = {
  segs: [[[IN.S0, WT], [IN.S0, IN.T1]], [[IN.S1, WT], [IN.S1, IN.T1]], [[IN.S0, WT], [IN.S1, WT]], [[IN.S0, IN.T1], [IN.S1, IN.T1]]],
  boxes: [[IN.S0, IN.S0 + 0.2, 4.2, 5.4]],            // the post shelf / radiator on the east wall
};
const hn = BK.HN, hs = BK.HS, pd = BK.pod;
export const SOLID = {
  both: {
    segs: [[[BK.S0, BK.N], [BK.S1, BK.N]], [[BK.S1, BK.N], [BK.S1, BK.S]], [[BK.S1, BK.S], [BK.S0, BK.S]], [[BK.S0, BK.S], [BK.S0, BK.N]],
      [[WL.cs, WL.mid], [WL.s1, WL.mid]],                                    // the spine wall between the two flights
      [[BK.RE, BK.N], [BK.RE, hn]],                                          // east wall of the north rooms
      [[BK.S0, hn], [17.75, hn]], [[18.6, hn], [BK.S1, hn]]],                // hall / landing north partition (room 1's door; Matt's door over it)
    boxes: [] },
  0: {
    segs: [[[BK.S0, hs], [17.9, hs]], [[18.8, hs], [BK.S1, hs]],             // south partition, the kitchen door
      [[WL.s1, hn], [WL.s1, WL.mid]]],                                       // under the upper flight: shut off
    boxes: [[pd.s0, pd.s1, pd.t0, pd.t1],                                    // room 1's en-suite (shut)
      [BK.RE, 16.95, BK.N, 13.6], [18.5, 19.9, BK.N, 13.22], [19.82, BK.S1, 14.45, 15.45], [19.0, 19.6, 15.2, 15.5],      // room 1: bed, desk, wardrobe, bookcase
      [BK.S0, 19.0, 19.8, BK.S], [BK.S0, 13.86, 17.6, 18.3], [15.3, 16.9, 18.3, 19.15]] },                                     // kitchen: the worktop run, fridge, table
  1: {
    segs: [[[BK.S0, hs], [15.9, hs]], [[16.7, hs], [17.2, hs]], [[18.0, hs], [BK.S1, hs]],      // south partition, doors of rooms 2 and 3
      [[BK.AB, hs], [BK.AB, BK.S]],                                          // between rooms 2 and 3
      [[WL.s1, WL.mid], [WL.s1, hs]],                                        // balustrade at the head of the well
      [[pd.s0, pd.t0], [pd.s1, pd.t0]], [[pd.s1, pd.t0], [pd.s1, 14.55]], [[pd.s1, 15.31], [pd.s1, pd.t1]]],      // Matt's en-suite: north wall, west wall either side of its door
    boxes: [[BK.RE, 16.95, BK.N, 13.58], [18.5, 19.9, BK.N, 13.22], [17.2, 18.2, BK.N, 13.2], [18.73, 20.09, 15.12, 15.5],      // Matt's room: bed, desk, wardrobe, the keyboard on its stand
      [BK.RE, 15.9, 14.5, pd.t1], [BK.RE, 15.9, pd.t0, 14.5], [16.2, 16.75, pd.t0, 14.08],      // the bathroom: the toilet (and Go), the shower, the basin
      [BK.podA.s0, BK.podA.s1, BK.podA.t0, BK.podA.t1], [BK.S0, 15.2, 19.46, BK.S], [16.17, 16.75, 18.6, 19.8], [14.65, 15.45, 17.6, 18.15],      // room 2: en-suite, bed, desk, wardrobe
      [BK.podB.s0, BK.podB.s1, BK.podB.t0, BK.podB.t1], [18.4, 20.36, 19.46, BK.S], [16.85, 17.47, 18.6, 19.8], [17.55, 18.35, 19.82, BK.S]] },       // room 3: en-suite, bed, desk, wardrobe
};
/** the doorways: centre and width, and the guides either side that keep somebody in a doorway's passage from sliding
 *  sideways into the thickness of the wall (lateral offset from the centre) */
export const DOORWAY = { s: 21.3, w: 0.96, guide: 0.7 };
export const BACKWAY = { s: 21.3, w: 0.9, guide: 0.68 };
/** things to do, front frame [s, t, level] */
export const SPOTS = {
  notice: [21.75, 3.2, 'pass'],
  tea: [16.4, 19.45, 0], kitchenNotice: [19.9, 18.6, 0],
  bed: [16.0, 13.95, 1], desk: [19.2, 13.6, 1], keyboard: [19.41, 14.3, 1], bathLight: [17.1, 14.25, 1],
};
/** Matt's keyboard: its middle along the hall wall (s), how far the playing edge's piano origin stands from that wall, how
 *  far out the stool is (front frame; first floor). The player sits at [s, wall - seatT] facing the wall. */
export const KB = { s: 19.41, back: 0.36, seatT: 0.98 };
/** Go: where he sits (the toilet's seat, front frame), which way he faces [ds, dt], the seat's height above the floor */
export const GO = { s: 15.47, t: 14.92, face: [1, 0], seat: 0.43, near: [17.2, 14.5], aware: 3.6, again: 22 };      // near: he speaks when you are east of s, south of t (at his door, or in)
/** his lines, exactly as the user gave them (tools/voices/extract.mjs reads this table: speaker 'go') */
export const GO_LINES = { main: 'Every time I drink alcool, I become diarrhea.', horest: 'Horest.' };

const box = (x0, x1, t0, t1, y0, y1) => ({ x0, x1, z0: -t1, z1: -t0, y0, y1 });
/** The passage's registration (`seamless`, core/interiors.js), room frame. The shell (the hand-built front in the world
 *  scene) has REAL modelled openings at both doorways, so nothing is punched (`punch: false`). The street doorway's
 *  portal is 2.6 m high so that it takes in the fanlight. */
const passFrom = box(IN.S0 - 0.1, IN.S1 + 0.1, -0.8, IN.T1 + 0.8, IN.G - 0.4, IN.GC + 0.2);
export const SEAMLESS = {
  portals: [
    { at: [DOORWAY.s, -WT], out: 0, w: DOORWAY.w, h: 2.6, y: IN.G, depth: WT, punch: false, world: [...L2W(DOORWAY.s, WT), HEADING_OUT], from: passFrom },
    { at: [BACKWAY.s, -IN.T1], out: Math.PI, w: BACKWAY.w, h: 2.06, y: IN.G, depth: DEPTH - IN.T1, punch: false, from: passFrom },
  ],
  openings: [],
  bounds: [box(IN.S0, IN.S1, WT, IN.T1, IN.G, IN.GC)],
  center: [(IN.S0 + IN.S1) / 2, -DEPTH / 2], lift: 0,
  baseY: PAVE,                                             // world height of room y = 0 (the floor is a step ABOVE the ground at the door, not on it)
};
/** The courtyard house's registration. Portal 0: its door in the west wall (out = +s). Openings: the real windows. */
const storey = (lv) => box(BK.S0 - 0.1, BK.S1 + 0.1, BK.N - 0.1, BK.S + 0.1, (lv ? BK.F1 : BK.G) - 0.4, (lv ? BK.F1C : BK.GC) + 0.25);
export const SEAMLESS_BLOCK = {
  portals: [{ at: [BK.S1, -BK.DOOR.t], out: Math.PI / 2, w: BK.DOOR.w, h: 2.1, y: BK.G, depth: BK.WALL, punch: false, world: [...L2W(BK.S1, BK.DOOR.t), HEADING_OUT + Math.PI / 2], from: storey(0) }],
  openings: OPENINGS.map((o) => {
    const e = openingEnds(o), inner = [(e.a[0] + e.b[0]) / 2 - e.out[0] * BK.WALL, (e.a[1] + e.b[1]) / 2 - e.out[1] * BK.WALL];
    return { at: [inner[0], -inner[1]], out: Math.atan2(e.out[0], -e.out[1]), w: o.w, y0: o.y0, y1: o.y1, depth: BK.WALL, punch: false, id: o.id, from: storey(o.level) };
  }),
  // the inside of the house, one box per storey (room frame; floor to ceiling)
  bounds: [box(BK.S0, BK.S1, BK.N, BK.S, BK.G, BK.GC), box(BK.S0, BK.S1, BK.N, BK.S, BK.F1, BK.F1C)],
  center: [(BK.S0 + BK.S1) / 2, -(BK.N + BK.S) / 2], lift: 0,
  baseY: PAVE,
};
void HH;
