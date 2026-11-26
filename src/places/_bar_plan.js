// Worcester College Cellar Bar — the plan (pure data, no three.js), SECOND PASS 2026-11-22: laid out from the college's
// own fire plan of the bar (reference/worcester/00 college maps/Cellar-Bar-GEEP-plan-p2.png, read at 90 px to the metre
// and anchored on the main block's true plan, places/_worcester_shared.js WORC_BLOCK). The plan is drawn SOUTH UP
// (Pump Quad at the top, the loggia on the right): its exit arrow runs west to "Arcway 12", its westmost room is the
// "Hall Wine Cellar", 4.9 m wide like the loggia above it, and "the pool room is one stone step up on the left inside"
// (the college's access guide) only in that reading. The bar is UNDER THE HALL, as it always was in the game; what was
// wrong was its shape, its door (5 m too far west) and its stair (it ran 9 m along the Hall's wall).
//
// The way in (K = fire plan / LIDAR / satellite / the owner; G = guess) is places/_bar_out.js: the outer flight in the
// court's north-east corner, the area at its foot, the lobby in the annex, then RIGHT (north) through DOUBLE DOORS in
// the Hall's south wall (1.34 m thick), three steps down inside the leaves (K: the plan draws the two treads, one in
// the wall and one in the first half metre of the lobby) to the INNER LOBBY: the POOL ROOM on the left (west), one
// stone step UP; the MAIN ROOM on the right (east), level with the lobby (the plan marks "Up" at the pool room and the
// store only). The owner, 2026-11-15: "to get into the bar you turn right down the stairs ... the bar is then left of
// you after you're in the bar, along the back wall. the darts is in the corner left of the bar, the wall with the
// windows ... is on the right of you as you walk in, and as you walk in, you're immediately on the right, next to that
// wall".
//
//   N (forecourt side; the Hall wing's north face is v 8.05)
//   +==ledge==[light]=+--+           +-----breast-----+        [light]         +
//   | DARTS alcove       respond     |  (back bar: G) |                        |   MAIN ROOM 10.0 x 8.97 m: two aisles
//   | board on the W wall        bar counter (G: where along the back wall)    |   of groin-vaulted bays on a middle
//   | (G within the alcove)                                                    E   line of piers. K: the free pier, the
//   +-passage-+==nib==[pier]              [pier]                        respond|   nib and its pier, the responds on
//   |    ^    |                                                                |   the walls; G: the vault itself
//   +--[door]-+ main door                                              pavement
//   | INNER LOBBY ]                [ splayed window to the court ]       lights
//   +-[double doors]----------------/---------\--------------------------------+   S wall 1.34 m, outer face v 19.1
//   POOL ROOM is west of the lobby (not drawn here): 4.17 x 4.51 m, its door at the south end of its east wall
//
// ROOM coordinates: metres, x east / z south in the college's LOCAL frame (worcester.js: u east, v south, rotated PHI
// about C0), shifted: u = x + FRAME.du, v = z + FRAME.dv (the origin is the main room's middle). Room y = 0 is the
// main room's floor (and the lobby's); world y = room y + BASE_Y.
import { WORC, WORC_BLOCK } from './_worcester_shared.js';
import { CELLAR_SE as SE, planUV as at, LEVEL as OUT_LEVEL, OUT } from './_bar_out.js';
export { OUT, outY, OUT_TREADS, OUT_PATH } from './_bar_out.js';
export const PHI = 0.0761, C0 = [-250, 10];            // (worcester.js: the college's local frame)
const COS = Math.cos(PHI), SIN = Math.sin(PHI), r4 = (x) => +x.toFixed(4);
const BLK = WORC_BLOCK, VS = BLK.vS;

// ---------------------------------------------------------------------------------------------- the rooms, in LOCAL (u, v)
// `at(a, b)`: fire-plan metres (a west of the cellar's south-east inner corner, b north of it) -> local (u, v). The
// corner is at (26.7, 17.76): 1.3 m inside the Hall wing's street face, 1.34 m inside its south face (_bar_out.js).
// Every (a, b) here was measured on the plan turned square (4.6 degrees) at 90 px to the metre: K to about 5 cm.
const rc = (a0, a1, b0, b1) => ({ u0: at(a1, 0)[0], u1: at(a0, 0)[0], v0: at(0, b1)[1], v1: at(0, b0)[1] });      // a0 < a1 (east .. west), b0 < b1 (south .. north)
export const UV = {
  main: rc(0, 10.0, 0, 8.97),                         // 16.7 .. 26.7, 8.79 .. 17.76
  midB: 4.43,                                         // the piers' line, north of the south wall (fire-plan b)
  alcove: rc(10.0, 11.52, 4.53, 8.97),                // the darts alcove: the strip west of the main room north of the nib, open to it on its east side
  ledge: { b: 8.64, h: 1.0 },                         // its north wall's lower part stands 0.33 m into the room: "a deep stone ledge" (K: the plan's lines, the photograph; G: its height)
  passage: rc(10.3, 11.52, 2.64, 4.53),               // from the inner lobby's north door up to the alcove (the escape route on the plan)
  nib: rc(9.03, 10.0, 4.27, 4.53),                    // a wall out from the west wall on the piers' line ...
  nibPier: rc(8.53, 9.03, 4.14, 4.67),                // ... to a pier at its end
  pier: rc(4.09, 4.61, 4.19, 4.72),                   // the free-standing pier in the middle of the room
  breast: rc(3.58, 6.21, 8.62, 8.97),                 // the north wall stands 0.35 m into the room here (the Hall's fireplace is above: G) — the back bar is against it (G)
  responds: [rc(8.53, 9.03, 8.70, 8.97), rc(0, 0.17, 4.2, 4.75), rc(4.0, 4.5, 0, 0.13), rc(8.45, 8.95, 0, 0.13)],      // on the north, east and south walls, opposite the piers
  lobby: rc(10.22, 13.02, 0, 2.42),                   // 13.68 .. 16.48, 15.34 .. 17.76
  pool: rc(13.24, 17.41, -0.1, 4.41),                 // 9.29 .. 13.46, 13.35 .. 17.86
  // doors: the range along the wall each is in (fire-plan metres)
  mainDoor: { b0: 0.68, b1: 1.66 },                   // lobby -> main room, in the 0.22 m wall between them
  poolDoor: { b0: 0.67, b1: 1.64 },                   // lobby -> pool room, one stone step up
  passDoor: { a0: 10.36, a1: 11.44 },                 // lobby -> passage (the lobby's north wall, east part)
  storeDoor: { a0: 11.88, a1: 12.78 },                // lobby -> the Bar Store's corridor (north wall, west part; one step up; staff only: shut)
  poolStores: [{ a0: 14.45, a1: 15.35 }, { a0: 15.7, a1: 16.6 }],      // the two Bar Store doors in the pool room's north wall (shut)
  // the DOUBLE DOORS from the annex, through the Hall's south wall; the three risers down inside the leaves (fire-plan b
  // of each: the first a leaf's width inside the leaves, the second on the wall's inner face, the third in the lobby)
  door: { u0: OUT.door.u0, u1: OUT.door.u1, vOut: VS, vIn: SE.v, risers: [r4(SE.v - (VS - OUT.door.recess - 0.66)), 0, 0.48], treadA: [10.22, 11.58] },
  // light: the splayed window through the south wall to the court's corner (K: 1.7 m wide outside, 2.37 m inside), two
  // pavement lights in the street end (K), two lights high in the north wall (K: where; they give on the forecourt's
  // paving, which is above the vault: G shafts)
  window: { aOut: [5.6, 7.3], aIn: [5.29, 7.66] },
  eastLights: [[0.85, 1.79], [2.38, 2.99]],           // fire-plan b of each, in the east wall
  northLights: [[1.9, 2.63], [9.33, 9.99]],           // fire-plan a of each, in the north wall
};

// ---------------------------------------------------------------------------------------------- levels (world y)
// court -1.25 (59.8 mOD) -> the area and the annex lobby, nine risers down -> the inner lobby and the main room, three
// more: 2.04 m below the court (twelve risers of 0.17 m: G; the college says "two short flights"), which puts a 3 m
// vault's crown 0.6 m under the Hall's floor. The pool room is one stone step (0.18 m) up from the lobby.
export const LEVEL = { ...OUT_LEVEL, pool: r4(OUT_LEVEL.floor + 0.18) };
export const BASE_Y = LEVEL.floor;                     // world y of room y = 0

// ---------------------------------------------------------------------------------------------- frames
export const FRAME = { du: r4((UV.main.u0 + UV.main.u1) / 2), dv: r4((UV.main.v0 + UV.main.v1) / 2) };
export const toUV = (x, z) => [x + FRAME.du, z + FRAME.dv];
export const fromUV = (u, v) => [r4(u - FRAME.du), r4(v - FRAME.dv)];
export const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];
export const W2L = (x, z) => { const dx = x - C0[0], dz = z - C0[1]; return [dx * COS - dz * SIN, dx * SIN + dz * COS]; };
export const toWorld = (x, z) => L2W(x + FRAME.du, z + FRAME.dv);
export const toLocal = (wx, wz) => { const [u, v] = W2L(wx, wz); return [u - FRAME.du, v - FRAME.dv]; };
export const FACING = PHI;                             // world heading of room +z (south in the local frame)

// the shell the rooms stand in: the main block's south half (outer wall faces) and the Hall's floor above
export const SHELL = [[BLK.uW, VS], [BLK.uW, BLK.gate.v1], [BLK.uC, BLK.gate.v1], [BLK.uC, BLK.vHn], [BLK.uE, BLK.vHn], [BLK.uE, VS]];
export const HALL = { u0: BLK.uW, u1: BLK.uE, v0: BLK.vHn, v1: VS, floor: WORC.terraceY + BLK.roomRise };

// ---------------------------------------------------------------------------------------------- the layout, ROOM coordinates
const X = (a) => r4(SE.u - a - FRAME.du), Z = (b) => r4(SE.v - b - FRAME.dv);      // fire-plan (a, b) -> room (x, z)
const box = (r) => { const a = fromUV(r.u0, r.v0), b = fromUV(r.u1, r.v1); return { X0: a[0], X1: b[0], Z0: a[1], Z1: b[1] }; };
export const LIGHT_SET = 0.29;                         // the window's pane: this far in from the wall's outer face (_worcester_block.js: d 0.3, the painted unit 0.02 in front of its back)
const wy = (y) => r4(y - BASE_Y);                      // world height -> room height
const D = UV.door, DX = fromUV((D.u0 + D.u1) / 2, 0)[0], zOf = (v) => r4(v - FRAME.dv);
const M = box(UV.main), AL = box(UV.alcove), PS = box(UV.passage), LB = box(UV.lobby), PL = box(UV.pool);
const POOL_FLOOR = wy(LEVEL.pool), YARD = wy(LEVEL.yard), RISE = OUT_LEVEL.rise;
// the bar counter and the darts (G where; the owner: the counter along the back wall, the darts in the corner left of
// it): the back bar on the breast, the counter in front of it; the board on the alcove's west wall, 1.3 m from its
// north wall (the photographs: the board on the right-hand part of a boarded wall, a stone ledge on its right)
const BOARD_Z = r4(AL.Z0 + 1.63), BOARD_WALL = AL.X0;
export const LAY = {
  X0: M.X0, X1: M.X1, Z0: M.Z0, Z1: M.Z1, ZM: Z(UV.midB), ys: 1.6, crown: 3.0,
  // two aisles of bays, west to east: [x0, x1, kind?]. South aisle: a plain barrel between the south wall and the nib
  // wall, then two groin bays; north aisle: the alcove's bay (out to its west wall), then two groin bays.
  baysS: [[M.X0, X(8.78), 'barrel'], [X(8.78), X(4.35)], [X(4.35), M.X1]],
  baysN: [[AL.X0, X(8.78)], [X(8.78), X(4.35)], [X(4.35), M.X1]],
  alcove: { ...AL, ledgeZ: Z(UV.ledge.b), ledgeH: UV.ledge.h },
  passage: { ...PS, h: 2.25 },
  nib: box(UV.nib), piers: [box(UV.nibPier), box(UV.pier)], breast: box(UV.breast), responds: UV.responds.map(box),
  lobby: { ...LB, floor: 0, spring: 2.68, rise: 0.26,                                  // (its ceiling: a flat segmental barrel across it, above the doors' head: G)
    pass: { x0: X(UV.passDoor.a1), x1: X(UV.passDoor.a0), h: 2.0 }, store: { x0: X(UV.storeDoor.a1), x1: X(UV.storeDoor.a0), h: 2.0, step: 0.17 } },
  // the double doors: a passage through the 1.34 m of wall. faceZ: the wall's outer face; atZ: the portal's anchor;
  // quadZ: where the opening is punched in the world (3 cm in front of the leaves the outside paints, _worcester_pump.js);
  // leafZ: the real leaves; wallZ: the wall's inner face (the lobby's south wall); y: the threshold (the yard's level).
  // steps: [z of the riser, room y of the floor north of it] going in; treadX: the treads' two ends
  door: { x: DX, w: r4(D.u1 - D.u0), h: OUT.door.h, y: YARD, wallZ: LB.Z1, faceZ: zOf(D.vOut),
    atZ: zOf(D.vOut - 0.12), quadZ: zOf(D.vOut - OUT.door.recess + 0.05), leafZ: zOf(D.vOut - OUT.door.recess - 0.06),
    steps: D.risers.map((b, i) => [Z(b), r4(YARD - RISE * (i + 1))]), treadX: [X(D.treadA[1]), X(D.treadA[0])] },
  entry: { z0: Z(UV.mainDoor.b1), z1: Z(UV.mainDoor.b0), h: 2.0 },                     // the doorway from the lobby into the main room (its west wall)
  pool: { ...PL, floor: POOL_FLOOR, nib: 0.13, ys: 1.45, crown: 2.35, door: { z: r4((Z(UV.poolDoor.b0) + Z(UV.poolDoor.b1)) / 2), w: r4(UV.poolDoor.b1 - UV.poolDoor.b0 - 0.1), h: 2.0 },
    stores: UV.poolStores.map((q) => ({ x0: X(q.a1), x1: X(q.a0) })),
    // (the owner's photograph, taken from the room's north end looking south: the chest freezer and the storage heater
    //  against the west wall, the coat rail and the boxed-in panel on the south wall, the door at the left)
    freezer: { x: r4(PL.X0 + 0.33), z: Z(1.65), w: 0.62, l: 0.86 }, heater: { x: r4(PL.X0 + 0.11), z: Z(0.72), w: 0.2, l: 0.75 } },
  // the pool table: the middle of the cloth; its long axis north-south (rot: its +x, baulk to top, towards the room's
  // +z: baulk at the north end, G), a little west of the room's middle as in the photograph (people stand two deep on
  // its east side; the freezer is on its +y side, where _bar_pool.js seats whoever watches a practice frame)
  table: { x: X(15.5), z: Z(2.2), rot: Math.PI / 2 },
  bar: { x0: X(7.15), x1: X(2.75), front: Z(6.62), depth: 0.6, top: 1.08, backX: r4((X(3.58) + X(6.21)) / 2), backW: 2.6, backZ: Z(8.62) },
  // darts: the board on the alcove's west wall; the thrower faces west; board "right" (+x mm) is world -z
  board: { x: r4(BOARD_WALL + 0.07), wall: BOARD_WALL, y: 1.73, z: BOARD_Z, n: [1, 0, 0], right: [0, 0, -1] },
  oche: r4(BOARD_WALL + 0.07 + 2.37),
  jukebox: { x: X(8.78), z: r4(Z(4.67) - 0.27) },      // against the nib's pier, facing north: "at the left edge of the alcove" (the photograph)
  spawn: [r4(LB.X1 - 0.9), r4(LB.Z0 + 1.0)], spawnHeading: Math.PI / 2,
  exit: [DX, r4(LB.Z1 - 0.9)],                         // (only on the old door-prompt path, ?seamless=0)
  dj: { x: r4(M.X1 - 1.3), z: Z(6.35) },               // (bops) in front of the screen
  screen: { z: Z(6.7), w: 2.0 },                        // on the east wall, in the middle of the north aisle (G)
  // the splayed window to Pump Quad (a real opening): out: its outside end (the pane the exterior paints), in: its
  // mouth on the room's wall, lower and wider (a cellar light: the sill falls steeply into the room; G its section)
  window: { id: 's1', side: 1, x: r4((X(UV.window.aOut[0]) + X(UV.window.aOut[1])) / 2), w: r4(UV.window.aOut[1] - UV.window.aOut[0]), y0: wy(OUT.window.y0), y1: wy(OUT.window.y1),
    depth: r4(VS - SE.v), xIn: r4((X(UV.window.aIn[0]) + X(UV.window.aIn[1])) / 2), wIn: r4(UV.window.aIn[1] - UV.window.aIn[0]), y0In: 1.75, y1In: 2.62 },
  // blind lights (lit panes at the back of a recess until the exterior draws their gratings): [wall, centre along it, width]
  lights: [...UV.eastLights.map(([b0, b1]) => ({ wall: 'e', c: r4((Z(b0) + Z(b1)) / 2), w: r4(b1 - b0) })), ...UV.northLights.map(([a0, a1]) => ({ wall: 'n', c: r4((X(a0) + X(a1)) / 2), w: r4(a1 - a0) }))],
};
LAY.windows = [LAY.window];

// the rooms' plan rectangles (inner wall faces), for the fit test and `seamless.bounds`
export const ROOMS = [
  { id: 'main', x0: M.X0, x1: M.X1, z0: M.Z0, z1: M.Z1, y0: 0, y1: LAY.crown },
  { id: 'alcove', x0: AL.X0, x1: AL.X1, z0: AL.Z0, z1: AL.Z1, y0: 0, y1: LAY.crown },
  { id: 'passage', x0: PS.X0, x1: PS.X1, z0: PS.Z0, z1: PS.Z1, y0: 0, y1: LAY.passage.h },
  { id: 'lobby', x0: LB.X0, x1: LB.X1, z0: LB.Z0, z1: LB.Z1, y0: 0, y1: r4(LAY.lobby.spring + LAY.lobby.rise) },
  { id: 'pool', x0: PL.X0, x1: PL.X1, z0: PL.Z0, z1: PL.Z1, y0: POOL_FLOOR, y1: r4(POOL_FLOOR + LAY.pool.crown) },
];
// where people count as inside the bar: the rooms (each box out to the middle of the walls between them, so that nobody
// in a doorway is in no room) and the doors' passage as far as the punched doorway.
// (it is the LOBBY's box that the doorway's far picture is taken in and projected on — core/_roomview.js picks the first
//  box that holds the point 0.45 m inside the threshold — so the lobby's box is first and runs out through the passage,
//  the full width of the lobby: the strip either side of the passage is solid wall, where nobody and no camera can be)
const bx = (r, o = {}) => ({ x0: r.x0 - (o.w ?? 0), x1: r.x1 + (o.e ?? 0), z0: r.z0 - (o.n ?? 0), z1: r.z1 + (o.s ?? 0), y0: r.y0 - 0.3, y1: r.y1 });
const RM = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
export const BOUNDS = [
  { ...bx(RM.lobby, { w: 0.11, e: 0.11, n: 0.11 }), z1: r4(LAY.door.quadZ - 0.1) },
  bx(RM.main, { w: 0.11 }), bx(RM.alcove), bx(RM.passage, { n: 0, s: 0.11 }), bx(RM.pool, { e: 0.11 }),
];
// where each opening's far picture (core/_roomview.js: the impostor's cube) is taken from, room coordinates [x, y, z]:
// the window's from under the crown of its bay, a metre in from the wall at its own height; the doors' from the lobby
export const CAPTURE = { south: [LAY.window.xIn, 2.1, r4(M.Z1 - 1.1)], door: [DX, 1.7, r4(LB.Z1 - 1.0)] };

/** the registration's `seamless` block (core/interiors.js) */
export function seamless() {
  const Dr = LAY.door, w = toWorld(Dr.x, Dr.atZ), Wn = LAY.window, main = { x0: M.X0, x1: M.X1, z0: M.Z0, z1: M.Z1 };
  return {
    // (depth 0 + a negative `proud`: the opening is punched INSIDE the anchor, just in front of the leaves, so that a
    //  walker still in the world's frame in the reveal is never behind it; core hands a body to the room 5 cm inside
    //  the punched plane and back to the world 5 cm outside it)
    portals: [{ at: [Dr.x, Dr.atZ], out: 0, w: Dr.w, h: Dr.h, y: Dr.y, depth: 0, proud: r4(Dr.quadZ - Dr.atZ), world: [w[0], w[1], FACING], capture: CAPTURE.door }],
    // (the window is punched at the exterior's own recessed pane — LIGHT_SET in from the wall's face, where
    //  _worcester_block.js paints it — not on the face: the stone reveal outside it is the exterior's)
    openings: [{ id: Wn.id, at: [Wn.x, M.Z1], out: 0, w: Wn.w, y0: Wn.y0, y1: Wn.y1, depth: r4(Wn.depth - LIGHT_SET), proud: 0.02, from: main, capture: CAPTURE.south }],
    center: [0, 0], lift: 0, baseY: BASE_Y, bounds: BOUNDS,
    // (core/interiors.js: seen from inside, the world's ground is not drawn under the bar — its rooms and the doors'
    //  passage out to the wall's outer face; the bar is below the paving, and an eye above paving level would look out
    //  of the doors through the ground)
    groundCut: [{ x0: r4(PL.X0 - 0.3), x1: r4(M.X1 + 0.3), z0: r4(M.Z0 - 0.3), z1: r4(Dr.faceZ + 0.03) }],
  };
}

// For actors that walk here themselves (places/friends.js): the way down outside is _bar_out.js OUT_PATH (local
// [u, v, world y], to just outside the leaves); inside, ROOM coordinates [x, z, room y]:
export const INSIDE_DOOR = [DX, r4(LB.Z1 - 1.0), 0];                                  // on the lobby's floor, past the steps
export const INSIDE_PATH = [[DX, r4(LAY.door.leafZ - 0.45), YARD], [DX, r4(LB.Z1 - 1.0), 0], [r4(LB.X1 - 0.5), r4((LAY.entry.z0 + LAY.entry.z1) / 2), 0], [r4(M.X0 + 1.2), r4((LAY.entry.z0 + LAY.entry.z1) / 2), 0]];      // the landing inside the leaves, the lobby, the main door, the main room
