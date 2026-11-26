// Worcester College Hall and Chapel as walk-in rooms: the plan of BOTH wings of the Main Quad's east range, read from
// the main block's own table (places/_worcester_shared.js WORC_BLOCK: the 1939 RCHM plan scaled to the college's venue
// plan of the Hall). Pure data + arithmetic (no three.js): the builders (_worcint_hall.js, _worcint_chapel.js), the
// registration (worcester_interiors.js), Miguel's scene (_friends_hal.js) and the node test (tools/smoke_walkin_hall.mjs)
// all read it.
//
// 2026-11-22 TRUE SIZE. Both rooms are 17.9 x 9.0 m (the college's venue plan of the Hall; the tour sheet: "the Hall
// has exactly the same dimensions as the Chapel"). They were 23.0 x 10.4 m, fitted to the map's outline of the range,
// which is the cornice line and more. Their floors stand `roomRise` above the loggia's (the college: reached "via ramp
// or stairs"; the ramps are the exterior's, along the loggia's back wall): FLOOR = WORC.terraceY + roomRise above the
// college's datum. The rise is a GUESS.
//
// College LOCAL frame (worcester.js): u east, v south, rotated PHI about world C0; heights above the datum (the street).
// ROOM frame (both rooms): x = 0 the west wall (door) .. L the east wall (altar / high table), z = -W/2 north .. +W/2
// south, floor y = 0. x = u - U0, z = v - VC: the rooms are not turned.
//   Doors: in the loggia's back wall (1.0 m thick), round-headed, 1.5 m wide, springing 2.2 m above the room's floor;
//     each 0.625 m nearer the gate than its room's centre line (1939 plan; the college: "made wider than planned on
//     their outer sides, so their west doors are not centrally placed").
//   Windows: three tall ones 1.7 m wide at 3.65 / 7.6 / 11.6 m from the room's east wall (venue plan), 3.45 .. 7.05 m
//     above the floor: the Hall's on its north (forecourt) side only (its south wall is the fireplace side: both plans);
//     the Chapel's on BOTH sides (1939 plan; the photographs show glass on both): the south ones on the forecourt, the
//     north ones on the 1.3 m slip against the Senior Common Room range. A Venetian window in each street end, centred
//     on the room: a round-headed centre light 1.3 m wide (sill 3.45, springing 6.55, crown 7.2), a flat-headed light
//     each side from 0.95 to 2.0 m off the centre, to 6.1 m. All three lights are glazed in both wings (photograph of
//     the street front, 2025).
//   Heights: 7.9 m to the cornice and 8.9 m to the flat of the ceiling (GUESS from the photograph of the Hall's east
//     end: the Venetian window's arch ends just under the cornice); the wings' small square attic windows (9.9 m above
//     the datum) light a storey ABOVE these ceilings, so everything here stays under 9.7 m above the datum.
import { WORC, WORC_BLOCK as WB } from './_worcester_shared.js';

export const PHI = 0.0761, C0 = [-250, 10];
const COS = Math.cos(PHI), SIN = Math.sin(PHI);
export const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];
export const W2L = (x, z) => { const dx = x - C0[0], dz = z - C0[1]; return [dx * COS - dz * SIN, dx * SIN + dz * COS]; };
export const headingL = (du, dv) => Math.atan2(du * COS + dv * SIN, -du * SIN + dv * COS);
const r4 = (x) => +x.toFixed(4);
export const T = WORC.terraceY;
/** the rooms' floor above the college's datum: the loggia's paving + the rise of the ramps */
export const FLOOR = r4(T + WB.roomRise);

/** what the outside has at the rooms' openings: sizes from WORC_BLOCK (heights above the DATUM, except the door's,
 *  which are above the room's floor); the recess depths are the exterior's (places/_worcester_block.js BLOCK_OPENINGS:
 *  kept in step by tools/smoke_walkin_hall.mjs) */
export const OUTSIDE = {
  cornice: WB.y.cornice, attic: 9.7,                          // the cornice's base; the storey over the rooms begins about here
  door: { w: WB.door.w, spring: WB.door.spring, h: r4(WB.door.spring + WB.door.w / 2), recess: 0.25 },
  side: { fromEast: WB.side.fromEast.slice(), w: WB.side.w, y0: WB.side.y0, y1: WB.side.y1, recess: 0.32 },
  east: { cw: WB.venetian.cw, y0: WB.venetian.sill, spring: WB.venetian.spring, sideIn: WB.venetian.sideIn, sideOut: WB.venetian.sideOut, sideTop: WB.venetian.sideTop, recess: 0.3 },
};
/** how far in from the wall's OUTER face each opening is punched (7 cm in front of what the outside paints at the back
 *  of its recess). Outward of that plane the stone reveal and sill are the exterior's own, so the rooms draw NOTHING
 *  there: a room's reveal carried out to the outer face lay in the same planes as the exterior's and flickered
 *  (tools/audit_zfight.mjs --cross). */
export const PUNCH = { door: r4(OUTSIDE.door.recess - 0.07), side: r4(OUTSIDE.side.recess - 0.07), east: r4(OUTSIDE.east.recess - 0.07) };

function wing(o) {
  const O = OUTSIDE, P = { L: WB.room.L, W: WB.room.W, U0: WB.uR, ...o }, hz = P.W / 2, sh = P.shell;
  P.hz = hz;
  P.toLocalUV = (x, z) => [P.U0 + x, P.VC + z];
  P.toWorld = (x, z) => L2W(P.U0 + x, P.VC + z);
  P.toRoom = (wx, wz) => { const [u, v] = W2L(wx, wz); return [u - P.U0, v - P.VC]; };
  // wall thicknesses: the room's wall face out to the wing's outer face
  P.wall = { w: r4(P.U0 - sh.u0), e: r4(sh.u1 - (P.U0 + P.L)), n: r4((P.VC - hz) - sh.v0), s: r4(sh.v1 - (P.VC + hz)) };
  // the door (west wall): centre z; the leaves hang just behind where the outside paints its door at the back of its
  // recess (their outer faces 3 cm behind that plane: 2 cm in front of it they lay within millimetres of the paint)
  P.door = { z: r4(P.doorV - P.VC), w: O.door.w, h: O.door.h, spring: O.door.spring, leafX: -r4(P.wall.w - O.door.recess - 0.06) };
  // where the registration stands the room's door for core (worcester_interiors.js DOORS): on the landing before it
  P.doorUV = [r4(sh.u0 - 0.6), P.doorV];
  // the tall side windows: room x of each (west to east), on the walls `sides` ('n' / 's'; the first is the forecourt's)
  P.win = { x: O.side.fromEast.map((s) => r4(P.L - s)).sort((a, b) => a - b), w: O.side.w, y0: r4(O.side.y0 - FLOOR), y1: r4(O.side.y1 - FLOOR), depth: { n: P.wall.n, s: P.wall.s } };
  // the street-end window, centred on the room
  P.east = { z: 0, cw: O.east.cw, y0: r4(O.east.y0 - FLOOR), spring: r4(O.east.spring - FLOOR), crown: r4(O.east.spring + O.east.cw / 2 - FLOOR),
    sideIn: O.east.sideIn, sideOut: O.east.sideOut, sideTop: r4(O.east.sideTop - FLOOR), depth: P.wall.e };
  return P;
}

// Chapel: the north wing. 7.9 m to the cornice, 8.9 to the flat of the ceiling, the saucer dome 0.4 more.
//   From the 1939 plan (K): the antechapel screen 2.4 m in from the west wall: two columns 2.25 m off the centre line on
//   pedestals, a square pier outboard of each (3.2 m), a short wall from each pier to the side wall; a closed
//   compartment in the antechapel's north part (north of z = -2.05); four wall piers a side, between and outside the
//   three windows; the sanctuary's three steps beginning 3.1 m from the east wall; the east end's inner corners rounded
//   (0.75 m); a pair of columns each side of the east window, 1.9 .. 3.5 m off the centre line.
export const CHAPEL_PLAN = wing({ key: 'chapel', shell: { u0: WB.uB, u1: WB.uE, v0: WB.vN, v1: WB.vCs }, VC: WB.chapel.vc, doorV: WB.doorV.chapel, sides: ['s', 'n'], HW: 7.9, HC: 8.9, top: 9.3,
  screen: { x: 2.4, col: 2.25, pier: 3.2 }, ante: { z: -2.05 }, sanct: 3.1, cornerR: 0.75, eastCols: [2.45, 3.25] });
// Hall: the south wing. 7.9 m to the cornice, 8.9 to the ceiling.
//   From the college's venue plan (K): the screen's TWO columns 2.33 m in from the west wall and 2.2 m from each side
//   wall; the fireplace in the south wall 6.85 .. 8.6 m from the east wall (opposite the middle window); the folding
//   door to the servery in the south wall 16.0 .. 17.2 m from the east wall (behind the screen).
export const HALL_PLAN = wing({ key: 'hall', shell: { u0: WB.uB, u1: WB.uE, v0: WB.vHn, v1: WB.vS }, VC: WB.hall.vc, doorV: WB.doorV.hall, sides: ['n'], HW: 7.9, HC: 8.9, top: 8.9,
  screen: { x: 2.33, col: r4(WB.room.W / 2 - 2.2) }, fire: { x: r4(WB.room.L - 7.725), w: 1.75 }, servery: { x0: r4(WB.room.L - 17.2), x1: r4(WB.room.L - 16.0) } });
/** where the Hall's furniture and people stand (room frame): the builder (_worcint_hall.js) and Miguel's scene
 *  (_friends_hal.js) both read these. Three rows of long tables, the middle one on the centre line (the photograph of
 *  the east end, 2010: about 2.3 m apart); the hot counter across the servery door, behind the screen (the game's). */
export const HALL_MARKS = (() => {
  const P = HALL_PLAN, hz = P.hz, sx = r4((P.servery.x0 + P.servery.x1) / 2), rows = [-2.4, 0, 2.4];
  return {
    rows, tx0: 3.9, tx1: 14.2, seat0: 0.5, seat: 0.7,
    aisle: r4((rows[1] + rows[2]) / 2),                                      // the aisle between the middle and the south rows
    counter: { x0: 0.4, x1: 2.1, z0: r4(hz - 1.15), z1: r4(hz - 0.45) },    // the hot counter
    servery: [sx, r4(hz - 1.75)],                                            // where you queue, north of the counter
    cook: [sx, r4(hz - 0.15)],                                               // the cook, in the servery doorway behind it
    doorIn: [0.55, P.door.z],                                                // just inside the west door
  };
})();

/** the `seamless` block of a wing's room (core/interiors.js): one doorway on the loggia, the windows that are drawn
 *  outside as real openings, the room's box. Headings: 0 = +z (south), PI/2 = +x (east), PI = -z (north). */
export function wingSeamless(P) {
  const hz = P.hz, L = P.L, E = P.east, Wn = P.win;
  // from anywhere in the room and its doorway (one big room: every window can be seen from every part of it)
  const from = { x0: -P.wall.w - 0.2, x1: L + 0.2, z0: -hz - 0.2, z1: hz + 0.2, y0: -0.5, y1: P.top + 0.5 };
  const [wx, wz] = P.toWorld(0, P.door.z);
  // (`proud` < 0: the shell is cut for real at every one of these — an arched hole, a stone reveal — and the punched
  //  rectangle stands INSIDE that hole, 5 cm in front of what the outside paints at the back of its recess: the wall
  //  itself hides the rectangle's corners, so an arched opening is arched, and the reveal is the outside's own stone)
  const portals = [{ at: [0, P.door.z], out: -Math.PI / 2, w: P.door.w, h: P.door.h, y: 0, depth: P.wall.w, proud: -PUNCH.door, head: 'round', world: [wx, wz, headingL(-1, 0)] }];
  const openings = [];
  P.sides.forEach((side, k) => {
    const sz = side === 's' ? hz : -hz, sOut = side === 's' ? 0 : Math.PI;
    Wn.x.forEach((x, i) => openings.push({ id: P.key + (k ? ':north' : ':side') + i, at: [x, sz], out: sOut, w: Wn.w, y0: Wn.y0, y1: Wn.y1, depth: Wn.depth[side], proud: -PUNCH.side, from }));
  });
  // the round-headed street-end light: ONE opening, sill to crown (the outside's arched hole shapes it); a flat-headed light each side
  openings.push({ id: P.key + ':east', at: [L, E.z], out: Math.PI / 2, w: E.cw, y0: E.y0, y1: E.crown, depth: E.depth, proud: -PUNCH.east, head: 'round', from });
  for (const sg of [-1, 1]) openings.push({ id: P.key + ':eastSide' + (sg < 0 ? 'N' : 'S'), at: [L, E.z + sg * (E.sideIn + E.sideOut) / 2], out: Math.PI / 2, w: E.sideOut - E.sideIn, y0: E.y0, y1: E.sideTop, depth: E.depth, proud: -PUNCH.east, from });
  // (baseY: the world height of the room's floor — the top of the loggia's ramps; it does not hang on what the ground
  //  function says at the doorway)
  return { portals, openings, center: [L / 2, 0], lift: 0, baseY: FLOOR, bounds: [{ x0: 0, x1: L, z0: -hz, z1: hz, y0: -0.2, y1: P.top }] };
}

/** how far inside the wing the room's walls are, its ceiling under the cornice, and its highest point (the Chapel's
 *  saucer dome) under the storey above: { w, e, n, s, eaves, attic } metres (all must be > 0) */
export function wingFit(P) { return { ...P.wall, eaves: r4(OUTSIDE.cornice - (FLOOR + P.HC)), attic: r4(OUTSIDE.attic - (FLOOR + P.top)) }; }
