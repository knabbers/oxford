// Plans of three Worcester walk-in rooms (pure data, no three.js): the Porters' Lodge, the Memorial Room and Terrace
// Staircase 5 with "your room". Each is fitted to the shell it stands in; the shells are given here in the room's own
// coordinates so tools/smoke_walkin_lodge.mjs can check the fit against worcester.js / the map outline.
// College LOCAL frame (worcester.js): u east, v south, rotated PHI about world (-250, 10). All three rooms are laid
// out parallel to it: room (x, z) = (u, v) + an offset, so every room frame is the world turned by PHI.
import { WORC, WORC_BLOCK as WB } from './_worcester_shared.js';
import { YARD, MEM_SHELL } from './_worcester_yard_plan.js';
import { TERR } from './_worcester_terrace_plan.js';

const PHI = 0.0761, COS = Math.cos(PHI), SIN = Math.sin(PHI), C0 = [-250, 10];
export const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];
export const W2L = (x, z) => { const dx = x - C0[0], dz = z - C0[1]; return [dx * COS - dz * SIN, dx * SIN + dz * COS]; };
const T = WORC.terraceY;
const S0 = 0, E = Math.PI / 2, N = Math.PI, W = -Math.PI / 2;      // headings: south (+z), east (+x), north, west

// ================================================================================================ PORTERS' LODGE
// 2026-11-22, second pass: REFITTED TO THE TRUE PLAN (places/_worcester_shared.js WORC_BLOCK.lodge; the exterior:
// places/_worcester_block.js). The room north of the gate hall, between the loggia's back wall and the street front's
// recessed centre, 4.5 m north-south (the 1939 RCHM plan); it was 5.6 x 4.1 m with a window onto the passage and two
// square sashes to the street, fitted to a five-bay front that never existed.
//   K  its DOOR is in the gate hall's north wall, directly opposite the Library stair's (the owner; the plan): a
//      round-headed doorway whose tympanum is a dark panel lettered PORTERS' LODGE, a pair of dark panelled leaves
//      FOLDED BACK inside it, glazed noticeboards on the wall either side (the college's photograph, reference/
//      worcester/01 …/porters lodge door …). The doorway, its tympanum and the boards are the exterior's; the leaves
//      are this room's, and they stand open.
//   K  NO window onto the gate hall (the photograph: noticeboards). ONE window, to the forecourt: the street front's
//      north ground-floor window, round-headed (WORC_BLOCK.east.bays[0], east.gw).
//   K  inside (the photograph, through the doorway): a counter curving away from the left of the door, pale green in
//      front with a wooden plinth and top, a square wooden post at its end, a glazed screen standing on its left part;
//      beyond the post the top carries on to the right over a wooden cabinet; pigeonholes on the wall behind; a pale
//      floor, light walls.
//   K  the room's north-west corner is cut off diagonally (the 1939 plan).
//   G  the ceiling's height; what is out of the photograph's sight (east of the cabinet; behind the counter).
// Room frame: x = u - doorU (0 = the door's centre), z = v - lodge.v1 (0 = the room's south wall face: a 0.45 m wall to
// the gate hall; north is -z).
const LB = WB.lodge, LO = { u0: LB.doorU, v0: LB.v1, lift: +(T + 0.01).toFixed(4) };      // lift: the floor a centimetre above the gate hall's paving (drawn at T)
const lr = (x) => +x.toFixed(4);
/** what the exterior paints at the Lodge's openings (places/_worcester_block.js BLOCK_OPENINGS, which imports three and
 *  so cannot be read here: tools/smoke_walkin_lodge.mjs compares the two) */
//  (gw.glass: the painted glazing stands 2 cm in FRONT of its recess's back — worcester.js glaze(): z = -d + 0.02)
const LEXT = { door: { w: 1.25, spring: 2.1, recess: 0.2 }, gw: { recess: 0.25, glass: 0.02 } };
export const LODGE = {
  X0: lr(LB.u0 - LO.u0), X1: lr(LB.u1 - LO.u0), Z0: lr(LB.v0 - LO.v0), Z1: 0, H: 4.0, WALL: lr(WB.gate.v0 - LB.v1),      // (H: GUESS — over the window's crown at 3.65, under the first floor)
  ext: LEXT,
  doorUV: [LO.u0, WB.gate.v0],      // the doorway on the gate hall's wall face, college (u, v)
  nwCut: 0.75,                      // the room's north-west corner is cut off on the 1939 plan (a flue?): the cut's two legs (their length a GUESS)
  // the doorway: the exterior's arch springs at T + 2.1 and its tympanum is solid: the way through is up to the springing
  door: { x: 0, w: LEXT.door.w, h: lr(T + LEXT.door.spring - LO.lift), leafIn: LEXT.door.recess },
  // the ONE window (the street front's north ground-floor window, exactly): in the room's east wall
  eastWall: lr(WB.uC - LB.u1),
  win: { z: lr(WB.east.bays[0] - LO.v0), w: WB.east.gw.w, y0: lr(WB.east.gw.sill - LO.lift), ys: lr(WB.east.gw.spring - LO.lift), y1: lr(WB.east.gw.spring + WB.east.gw.w / 2 - LO.lift) },
  // the masonry the room stands in, in room coordinates (clockwise from the north-west corner): the loggia's back
  // wall's west face, the Chapel's south wall face, the street front's face, the gate hall's north wall face
  SHELL: [[WB.uB - LO.u0, WB.chapel.v1 - LO.v0], [WB.uC - LO.u0, WB.chapel.v1 - LO.v0], [WB.uC - LO.u0, WB.gate.v0 - LO.v0], [WB.uB - LO.u0, WB.gate.v0 - LO.v0]].map((q) => q.map(lr)),
  ceilingMax: lr(WB.east.band - 0.6 - LO.lift),      // under the first floor (the band over the ground storey, less a floor's depth)
  toWorld: (x, z) => L2W(x + LO.u0, z + LO.v0),
};
// `depth`: from the room's wall face out to just in front of what the exterior paints there (the door leaf is set back
// 0.2 m from the gate hall's face, the window's glazing 0.25 m from the street face): the punched opening stands inside
// the exterior's own stone recess, so the wall itself shapes it — the window is round-headed, its reveal the front's.
LODGE.seamless = {
  portals: [{ at: [0, 0], out: S0, w: LODGE.door.w, h: LODGE.door.h, y: 0, depth: lr(LODGE.WALL - LEXT.door.recess + 0.02), world: [...L2W(LO.u0, LO.v0), PHI] }],
  openings: [{ id: 'lodgeEast', at: [LODGE.X1, LODGE.win.z], out: E, w: LODGE.win.w, y0: LODGE.win.y0, y1: LODGE.win.y1, head: 'round', depth: lr(LODGE.eastWall - LEXT.gw.recess + LEXT.gw.glass + 0.02 - 0.03) }],      // (the punched plane — depth + 0.03 — is 2 cm in front of the painted glazing)
  bounds: [{ x0: LODGE.X0, x1: LODGE.X1, z0: LODGE.Z0, z1: LODGE.Z1, y0: -0.3, y1: LODGE.H + 0.1 }],
  center: [0, lr(LODGE.Z0 / 2)], lift: LO.lift, baseY: LO.lift,
};

// ================================================================================================ MEMORIAL ROOM
// 2026-11-22, REFITTED TO THE RANGE AS IT IS (places/worcester_yard.js, plan in _worcester_yard_plan.js: YARD.westTall,
// MEM_SHELL). The room is the ground floor of the TALL block at the north end of Provost's Yard's west range (the old
// kitchen, "M" on the college's map): 5.7 x 8.5 m inside 0.45 m walls. It was 6 x 12 m, fitted to the west range the
// city generator drew: a three-storey box 6.8 x 15.5 m that stood 1.6 m west of the real one and 6 m too tall.
//   K  the college's photograph of the room (reference/worcester/04 …/memorial room interior): a deep beam across it
//      on a pier a third of the way along; ONE sash in the window wall, near the far end, between a big still life and
//      a small portrait; half-glazed double doors in the far end wall's corner; parquet, dado, boardroom tables.
//      Read as taken from the south end looking north (the window wall is then the west one, onto the gardens).
//   G  which wall the yard door is in (the east one: the college's map draws a door on the yard face under its "M");
//      a second sash, to the yard; the room's exact length (the block's, less its walls).
// Room frame: x = u - ME.u0 (-X west .. X east), z = v - ME.v0 (-Z north .. Z south): the block's middle; the yard door
// in the east wall at z = door.z.
const MT = YARD.westTall, MS = MEM_SHELL;
const ME = { u0: lr((MT.u0 + MT.u1) / 2), v0: lr((MT.v0 + MT.v1) / 2), lift: 0.06 };
const mwin = (w) => ({ z: lr(w.v - ME.v0), w: w.w, y0: lr(w.y0 - ME.lift), y1: lr(w.y1 - ME.lift) });
export const MEMORIAL = {
  X: lr((MT.u1 - MT.u0) / 2 - MS.wall), Z: lr((MT.v1 - MT.v0) / 2 - MS.wall), H: MS.ceiling, WALL: MS.wall, DADO: 0.75,      // (dado under the sills at 0.89)
  door: { z: lr(MS.door.v - ME.v0), w: MS.door.w, h: MS.door.h },
  wins: MS.west.map(mwin),          // in the west wall (the photograph's)
  winsE: MS.east.map(mwin),         // in the east wall, to the yard
  beamZ: 1.45,                      // the deep beam and its pier (the photograph: a third of the way from the near end)
  // the block the room stands in, in room coordinates (clockwise from the north-west corner), and in the college's
  SHELL: [[MT.u0, MT.v0], [MT.u1, MT.v0], [MT.u1, MT.v1], [MT.u0, MT.v1]].map(([u, v]) => [lr(u - ME.u0), lr(v - ME.v0)]),
  shellUV: { uW: MT.u0, uE: MT.u1, vN: MT.v0, vS: MT.v1, eaves: MT.eaves }, ceilingMax: lr(MT.eaves - 2.3 - ME.lift),      // (under the first floor: its windows' sills are at 4.2 m)
  // what the exterior paints at the room's openings: the door-case on the yard face (worcester_interiors.js
  // buildExtraDoors: its leaf stands `leaf` out from the wall face u), the sashes `rec` back from the wall faces
  ext: { u: MT.u1, v: MS.door.v, leaf: 0.04, rec: MS.rec },
  toWorld: (x, z) => L2W(x + ME.u0, z + ME.v0),
};
// (door: out to 1 cm in front of the painted leaf of the door-case. Windows: the punched plane — depth + 0.03 — stands
//  2 cm in front of the sash the range paints in its stone reveal, so the reveal is the range's own.)
MEMORIAL.winDepth = lr(MEMORIAL.WALL - MEMORIAL.ext.rec + 0.02 - 0.03);
MEMORIAL.seamless = {
  portals: [{ at: [MEMORIAL.X, MEMORIAL.door.z], out: E, w: MEMORIAL.door.w, h: MEMORIAL.door.h, y: 0, depth: lr(MEMORIAL.ext.u + MEMORIAL.ext.leaf + 0.01 - 0.03 - (MEMORIAL.X + ME.u0)), world: [...L2W(MEMORIAL.X + ME.u0, MEMORIAL.ext.v), E + PHI] }],
  openings: [
    ...MEMORIAL.wins.map((w, i) => ({ id: 'memWin' + i, at: [-MEMORIAL.X, w.z], out: W, w: w.w, y0: w.y0, y1: w.y1, depth: MEMORIAL.winDepth })),
    ...MEMORIAL.winsE.map((w, i) => ({ id: 'memWinE' + i, at: [MEMORIAL.X, w.z], out: E, w: w.w, y0: w.y0, y1: w.y1, depth: MEMORIAL.winDepth })),
  ],
  bounds: [{ x0: -MEMORIAL.X, x1: MEMORIAL.X, z0: -MEMORIAL.Z, z1: MEMORIAL.Z, y0: -0.3, y1: MEMORIAL.H + 0.1 }],
  center: [0, 0], lift: ME.lift,
};

// ================================================================================================ STAIRCASE 5 + YOUR ROOM
// 2026-11-22, second pass: REFITTED TO THE TERRACE AS IT IS (places/_worcester_terrace_plan.js TERR; the exterior:
// _worcester_terrace.js). Front face v = TERR.vS (-19.1), the range 10.2 m deep, 19 unequal bays; Staircase 5's doorway
// is BAY 7 (the bay next to the pedimented centre: the 1939 plan, the 2014 photograph, where its number is on a disc
// over the arch): a round-headed doorway 1.0 m wide, its threshold a slab and two steps above the walk (0.5 m above the
// datum), springing at 3.0 m, crown 3.5 m. First-floor windows 1.05 m wide, 5.1 .. 7.15 m, their sills on the plat
// band; second-floor windows from 8.6 m. (It was fitted to the first pass's Terrace: bay 6 of 17, a door 1.25 m wide
// with its threshold 0.12 m above the walk, windows 0.4 m higher.)
// The stair inside is still the first pass's GUESS: a dog-leg stair behind the door — ground hall 3 x 3 m, a flight
// north on the east side to a half-landing, a flight back south on the west side to the first-floor landing over the
// hall (its own sash over the door), and "your room" west of the landing behind the first-floor window of bay 6.
// (The 1939 plan draws this staircase's compartment 2.4 m wide and 4.9 m deep, the stair at its north end: a re-plan
// to that is owed.) GUESS too: the first floor's level (4.45 m: 0.65 m under the sills).
// Room frame: x = u - uDoor, z = v - (TERR.vS - WALL) (0 = the inside face of the 0.5 m front wall; north is -z);
// y = 0 at the door's threshold (TERR.y.floor above the datum).
const TB = TERR.flankBay, UD = TERR.bays[7];
const ST = { u0: UD, v0: lr(TERR.vS - 0.5), y0: TERR.y.floor };
const FLOOR1 = 4.45;      // GUESS: the first floor's level
export const STAIR = {
  WALL: 0.5, TB,
  FH: FLOOR1 - ST.y0, HALF: (FLOOR1 - ST.y0) / 2, RH: 3.1, CHG: 3.5,      // first floor, half-landing, upper ceiling height, hall ceiling
  hall: { x0: -1.5, x1: 1.5, z0: -3, z1: 0 },      // (x1 1.5: 0.07 m into the centre block's wall line on the 1939 plan — the guess's width, kept)
  flights: { z0: -5.8, z1: -3, n: 10, A: { x0: 0.1, x1: 1.5 }, B: { x0: -1.5, x1: -0.1 } },      // A: up to the north (east side), B: back south (west side)
  half: { x0: -1.5, x1: 1.5, z0: -7.2, z1: -5.8 },
  room: { x0: -4.9, x1: -1.6, z0: -4.8, z1: 0 },      // (behind bay 6's window only: bay 5's begins 0.08 m west of it)
  roomDoor: { x: -1.5, z0: -2.9, z1: -2.0, h: 2.1 },      // in the landing's west wall, at the head of the upper flight (clear of the window corner)
  door: { x: 0, w: TERR.y.gw.w, spring: lr(TERR.y.gw.spring - ST.y0), h: lr(TERR.y.gw.spring + TERR.y.gw.w / 2 - ST.y0) },      // the front door: leaves to the springing, fanlight above
  // first-floor windows (bay 7 over the door: the landing's; bay 6: the room's), in room coordinates
  wins: [{ id: 'landing', x: 0 }, { id: 'room', x: lr(TERR.bays[6] - UD) }].map((w) => ({ ...w, w: TERR.y.f1.w, y0: lr(TERR.y.f1.y0 - ST.y0), y1: lr(TERR.y.f1.y1 - ST.y0) })),
  // the part of the range the staircase stands in (from bay 4's west edge to the centre block's east edge: one
  // building), in room coordinates
  SHELL: [[TERR.bays[4] - TB / 2 - UD, TERR.vN - ST.v0], [TERR.centre[1] - UD, TERR.vN - ST.v0], [TERR.centre[1] - UD, TERR.vS - ST.v0], [TERR.bays[4] - TB / 2 - UD, TERR.vS - ST.v0]].map((q) => q.map(lr)),
  osm: 'w301621509', topMax: lr(TERR.y.f2.y0 - ST.y0 - 0.3),      // under the second-floor windows
  ext: { vS: TERR.vS, door: TERR.rec.door, sash: TERR.rec.f1 },      // the front's face; how far behind it the exterior paints the door and the sashes
  baseY: ST.y0, uDoor: UD, v0: ST.v0,
  toWorld: (x, z) => L2W(x + ST.u0, z + ST.v0),
};
{
  const S = STAIR, top = S.FH + S.RH;
  S.seamless = {
    // depth: out to just in front of the painted door (0.08 m: it is 0.42 m back from the 0.5 m wall's face) and of the
    // painted sashes (0.2 m back: the punched plane, depth + 0.03, stands 2 cm in front of them). baseY: world height of y = 0 (the threshold); `lift` says the same for a core that
    // works it out from the ground at the doorway (which is 0 inside the range).
    // (no `from` box on a portal any more: core now reads portal.from as the id of the ROOM a doorway leads from)
    portals: [{ at: [0, 0], out: S0, w: S.door.w, h: S.door.h, y: 0, depth: lr(S.WALL - S.ext.door), world: [...L2W(ST.u0, ST.v0), PHI] }],
    openings: [...S.wins.map((w) => ({ id: 'stair5:' + w.id, at: [w.x, 0], out: S0, w: w.w, y0: w.y0, y1: w.y1, depth: lr(S.WALL - S.ext.sash + 0.02 - 0.03),
      from: w.id === 'room' ? { x0: S.room.x0, x1: S.hall.x1, z0: S.room.z0, z1: 0.4, y0: S.FH - 0.3, y1: top + 0.2 } : { x0: S.room.x0, x1: S.hall.x1, z0: S.half.z0, z1: 0.4, y0: S.HALF - 0.3, y1: top + 0.2 } })),
      // the fanlight over the front door is a window of its own (second pass): with the leaves shut it was black from
      // inside (no world is drawn through a shut, unglazed door) and unlit from the quad
      { id: 'stair5:fan', at: [0, 0], out: S0, w: S.door.w, y0: S.door.spring + 0.06, y1: S.door.h, depth: 0.1, proud: 0.01, head: 'round',
        from: { x0: S.hall.x0, x1: S.hall.x1, z0: S.flights.z0, z1: 0.2, y0: -0.3, y1: S.FH } }],
    bounds: [
      { x0: S.hall.x0, x1: S.hall.x1, z0: S.hall.z0, z1: 0, y0: -0.3, y1: S.CHG },                    // ground hall
      { x0: S.hall.x0, x1: S.hall.x1, z0: S.half.z0, z1: S.hall.z0, y0: -0.3, y1: top },             // the stair well
      { x0: S.hall.x0, x1: S.hall.x1, z0: S.hall.z0, z1: 0, y0: S.FH - 0.3, y1: top },               // first-floor landing
      { x0: S.room.x0, x1: S.hall.x0, z0: S.room.z0, z1: 0, y0: S.FH - 0.3, y1: top },               // your room
    ],
    center: [-1.5, -3], lift: ST.y0, baseY: ST.y0,
  };
}
