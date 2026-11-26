// The Library as a walk-in room: pure data (no three / DOM), shared by _worcint_library.js (geometry),
// worcester_interiors.js (registration) and tools/smoke_walkin_library.mjs.
//
// The room is IN PLACE in the main block as it is (places/_worcester_shared.js WORC_BLOCK; the exterior:
// places/_worcester_block.js): over the loggia of the Main Quad's east range, behind the nine first-floor windows of
// the quad front, reached by the round stone stair south of the gate hall.
//   Frame: x = south along the range (x = 0 is the block's north face, college v = WORC_BLOCK.vN);
//          z = west (z = 0 is the quad front's face, college u = WORC_BLOCK.uW); u = Z0 - z, v = x + V0;
//          y = height above the college's datum (the street = the loggia floor = the gate hall's floor), less BASE.
//   Heading convention: forward = (sin h, cos h); 0 = +z (west, the windows), π/2 = +x (south), -π/2 = north.
//
// 2026-11-22, second pass: REFITTED TO THE TRUE PLAN. The block was drawn to the map's outline (the cornice line): the
// range over the loggia was 3.4 m deep, so the room was 2.9 m wide at its ends and 6.4 m only in the middle, and the
// stair's drum was 3.8 m across and turned the wrong way. Now:
//   K  the range over the loggia is 6.9 m deep outside for the whole 35.8 m (1939 RCHM plan scaled on the Hall's
//      17.9 m; the 2014 photograph of the quad front): ONE long room, the same width from end to end.
//   K  the nine windows stand over the nine arches (WORC_BLOCK.arcade.v): six square-headed 1.5 m wide, sills 6.0,
//      heads 9.3; the middle three round-headed 2.2 m wide, springing 10.2, in the part of the front that breaks
//      0.15 m forward (the 2014 photograph, 25.1 px to the metre). Three lights wide and six high in the square ones,
//      four wide under an intersecting head in the round ones, an armorial panel in each lower sash (the photograph).
//   G  the walls' thickness over the loggia (window wall 0.8 m; the east wall is the loggia's back wall carried up,
//      1 m), so the room is 5.1 m wide inside; its floor 5.5 m above the datum (the foot of the string course over the
//      arcade: sills 0.5 m up); its ceiling 11.8 (0.5 m over the round heads' crowns, 0.3 under the cornice); end
//      walls 0.9 m.
//   G  what the room holds is what it held (college photographs of the room: docs/research/worcester_interiors.md):
//      desks under the windows, white cases with brass grilles on the east wall, the gallery on gilded columns over
//      them — now the whole length of the east wall (11 columns 3 m apart; their number is not known).
//
// THE STAIR ("STAIR TO LIBRARY" on the 1939 plan; the college's photograph `library cantilevered spiral staircase
// looking up (worc.ox.ac.uk)` and Commons 165456703, both in reference/worcester/01 …) — RE-LAID 2026-11-22 on the
// owner's word: "a much larger spiral staircase than first implemented": JUST UNDER ONE FULL TURN brings you into the
// main Library; ANOTHER FULL TURN brings you to the floor above, an ATTIC LIBRARY ("not famous but where most books are
// and where most people work"; he thinks it covers the whole attic). The stair built before this put all its steps
// (62 of 0.088 m) below the Library: wrong.
//   K  a round drum 4.6 m across inside (WORC_BLOCK.drum), immediately south of the gate hall; its door in the gate
//      hall's south wall directly opposite the Porters' Lodge door (the owner; the plan);
//   K  an OPEN-WELL cantilevered stone stair: the well about half the drum (plan; the photograph looking straight
//      up) -> well radius 1.1 m, treads 1.2 m;
//   K  it rises CLOCKWISE seen from above (north -> east -> south -> west), the wall on the climber's left: the 1939
//      plan draws the first treads from NNE round to E of the door (at N); the college's photograph (taken at the
//      foot, the newel in front, the forecourt window behind it, the flight going up to the right) and the Commons
//      one (looking up: the turn runs anticlockwise in the picture) agree, so neither is mirrored;
//   K  two landings, both seen in the Commons photograph: one on the WEST side with a level length of handrail over
//      it (about 46 degrees: the LIBRARY's — 0.84 of a turn from the foot door: the owner's "just under one full
//      turn"), and the top one, whose plastered soffit runs round by west and north: the ATTIC's;
//   K  "over 60 steps" (the college's library page);
//   K  moulded stone treads with sunk soffits, a wrought-iron balustrade (every baluster a bar with collars and two
//      pairs of scrolls), a dark handrail ending in a scroll on the newel at the first step, bare ashlar walls, ONE
//      window to the forecourt (the street front's south ground-floor window: round-headed, iron-barred), a stone
//      tablet on the wall beyond it, a saucer ceiling with a plaster rose and a lamp in it;
//   G  THE NUMBERS. Equal risers (as any stair has) with the Library's floor at 5.5 m and the attic's at about 9.7 m
//      (its small square windows' sills are at 9.9 / 10.2; the Chapel's dome crown is at 9.65) give: 66 risers of
//      0.147 m, 37 to the Library and 29 more to the attic at 9.77 m. The lower flight climbs 5.45 m in two thirds of
//      a turn and the upper 4.27 m in rather more, so their treads CANNOT have the same angle: 36 winders of 6.8
//      degrees below (the 1939 plan draws its ten first treads in about 65 degrees: 6.5 each), 28 of 8.9 degrees above
//      (the Commons photograph measured round the upper flight: 9.0 - 9.2). The first riser 22 degrees east of north
//      (plan). The top landing begins 204 degrees round (the photograph has its soffit beginning nearer 236: it is
//      begun earlier here for the south doorway, below);
//   G  the doors on the top landing (no source for either's place): one at the NORTH, straight over the foot door,
//      into the attic's link over the gate hall; one at the SOUTH-WEST, a passage southwards through the wall the
//      drum shares with the Hall wing, into that wing's attic. West of the drum at that level is the Library's own
//      upper air, so the attic is not entered on the west;
//   G  where the flight crosses the forecourt window's lower part (0.147 m risers bring it there) the window's inside
//      sill rakes with the stair; the ceiling's height; the baize doors; the one oak leaf at the foot.
//
// OWNER, 2026-11-25: the attic library does run over the main Library (CONFIRMED), and the stair's doors are "about
// where they were from your guess" (so the doors' places above are owner-checked; the attic's own plan stays a guess).
// THE ATTIC LIBRARY (2026-11-22; the owner as above; its plan is NOT known: all of this layout is a GUESS from the
// section): the storey behind the small square windows under the cornice — floor 9.77, ceiling 12.2 (the cornice's
// foot) — over the two wings and the link between them, NOT over the quad range (the Library itself rises to 11.8
// there): the LINK over the Lodge and the gate hall (4.3 x 8.35 m, two of the street centre's three top windows),
// the CHAPEL wing's attic (17.9 x 9.0 m) through an opening in the wing's wall, and the HALL wing's attic (17.9 x
// 9.0 m) by the passage from the top landing's south-west door; each wing has its three forecourt windows and its
// street-end one (WORC_BLOCK.side.attic, east.f2: K, the 2025 photographs). Bookstacks, reading desks with lamps.
// In the engine it is the SAME room as the Library (another storey of it, as the drum is): its footprint lies wholly
// east of the Library's, so the two share nothing but the stair.
import { WORC, WORC_BLOCK as WB } from './_worcester_shared.js';

const PHI = 0.0761, COS = Math.cos(PHI), SIN = Math.sin(PHI), C0 = [-250, 10];
const r4 = (x) => +x.toFixed(4);
export const T = WORC.terraceY;                 // the paving of the gate hall and the loggia
/** world height of room y = 0 (a paving stone's worth under the flags, so the room's floor at the door is exactly the gate hall's) */
export const BASE = 0.02;
/** a height above the datum, in room y */
export const yOf = (h) => r4(h - BASE);
export const Z0 = WB.uW, V0 = WB.vN;
export const toUV = (x, z) => [Z0 - z, x + V0];
export const fromUV = (u, v) => [v - V0, Z0 - u];
export const toWorld = (x, z) => { const u = Z0 - z, v = x + V0; return [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS]; };
export const toLocal = (wx, wz) => { const dx = wx - C0[0], dz = wz - C0[1]; return fromUV(dx * COS - dz * SIN, dx * SIN + dz * COS); };
/** the frame's turn: a room heading h is the world heading h + ROT */
export const ROT = PHI - Math.PI / 2;

/** what the exterior paints at this room's openings (places/_worcester_block.js BLOCK_OPENINGS, which imports three and
 *  so cannot be read here: tools/smoke_walkin_library.mjs compares the two) */
export const EXT = { libDoor: { w: 0.98, h: 2.33, recess: 0.1 }, gw: { recess: 0.25 }, lib: { recess: 0.25, archRecess: 0.3 },
  glass: 0.02 };      // glass: a painted glazing unit stands 2 cm in FRONT of its recess's back (worcester.js glaze(): z = -d + 0.02)

/** the shell the plan is fitted to (college local u east / v south, heights above the datum): WORC_BLOCK */
export const SHELL = {
  range: { u0: WB.uW, u1: WB.uR, v0: WB.vN, v1: WB.vS, y0: WB.y.vault, y1: WB.y.cornice },      // over the loggia: its vault .. the cornice's base
  back: { u0: WB.uB, u1: WB.uR },                                                               // the loggia's back wall, carried up: the room's east wall
  gate: { v0: WB.gate.v0, v1: WB.gate.v1, u0: WB.gate.u0, u1: WB.gate.u1 },
  drum: { ...WB.drum }, hallN: WB.vHn, uC: WB.uC,
  // the quad front's first-floor windows: over the nine arches; the middle three round-headed, in the part that breaks forward
  front: { v: WB.arcade.v.slice(), y0: WB.y.libSill, y1: WB.y.libHead, w: WB.y.libW, archW: WB.y.libArch.w, archSpring: WB.y.libArch.spring, arched: [3, 4, 5], breakOut: WB.arcade.breakOut },
  // the street front's south ground-floor window: the stair's
  gw: { v: WB.east.bays[2], w: WB.east.gw.w, sill: WB.east.gw.sill, spring: WB.east.gw.spring },
};

export const LF = yOf(5.5);                     // library floor (GUESS: the foot of the string course over the arcade; sills 0.5 m up)
export const TOP = yOf(11.8);                   // ceiling (GUESS: 0.3 m under the cornice's base)
export const LH = r4(TOP - LF);                 // floor to ceiling
export const GY = r4(LF + 3.0);                 // gallery floor
export const WT = 0.8;                          // the quad front's wall over the loggia: its face to the room's wall face (GUESS)
export const ZW = -WT;                          // window wall
export const ZE = r4(Z0 - WB.uB);               // east wall: the west face of the loggia's back wall, carried up
export const END = 0.9;                         // the end walls (the loggia's are 0.9: _worcester_block.js)
export const ROOM = { x0: END, x1: r4(WB.L - END) };
export const CASE = 0.3;                        // bookcase depth
export const GAL = 1.2;                         // the gallery's depth from the east wall

// ---------------------------------------------------------------- the stair (south of the gate hall)
const D2R = Math.PI / 180;
/** room x of the gate hall's south wall face */
export const PASS_X = r4(WB.gate.v1 - V0);
/**
 * The drum: centre (xc, zc), inside radius R; the open well's radius RW (the treads are R - RW long).
 * Angles in degrees, a = 0 at the NORTH point, increasing CLOCKWISE seen from above (north -> east -> south -> west):
 * the way up. A point at (a, r) is (xc - r cos a, zc - r sin a).
 * The stair, by UNWRAPPED angle: the floor until a0 (the first riser); treads 1 .. kLand - 1, winders of da1 degrees;
 * tread kLand is the LIBRARY's landing (aL0 .. aL1) at LF; treads kLand + 1 .. n - 1, winders of da2 degrees; tread n is
 * the TOP landing (a1 .. a2) at the attic's floor AF, n risers up. The flights pass over one another and over the
 * floor: `drumY` takes the height of whoever is asking. On the ground floor the drum is open under the stair wherever
 * there is headroom (from aOpen round by the door to the first riser), and the well's floor is open floor.
 */
export const SP = {
  xc: r4(WB.drum.v - V0), zc: r4(Z0 - WB.drum.u), R: WB.drum.r, RW: 1.1,
  y0: yOf(T),                                   // the floor inside the door: the gate hall's paving
  n: 66, kLand: 37, a0: 22, aL0: 268.4, land: 46, a1: 564.4, a2: 766.4,
  ramp: 0.3,                                    // the first 30% of a tread's width is its nosing's ramp (feet rise onto the tread, then stand on it)
  walk: 1.7,                                    // the walking line (0.6 m in from the drum wall)
  TH: 0.14,                                     // a tread's thickness at its back edge
  rail: 0.9,                                    // handrail above the treads
};
SP.rise = (LF - SP.y0) / SP.kLand;
SP.aL1 = r4(SP.aL0 + SP.land); SP.top = r4(SP.a2 - SP.a1);
SP.da1 = (SP.aL0 - SP.a0) / (SP.kLand - 1);      // the lower flight's winders
SP.da2 = (SP.a1 - SP.aL1) / (SP.n - 1 - SP.kLand);      // the upper flight's
SP.da = SP.da1;
SP.yLand = LF;
/** the attic's floor: n equal risers up */
export const AF = SP.y0 + SP.n * SP.rise;
export const ATOP = yOf(12.2);                  // the attic's ceiling (GUESS: the cornice's foot)
SP.aOpen = Math.ceil(SP.a0 + Math.ceil((1.9 + SP.TH) / SP.rise) * SP.da1);      // ground floor: from here on round to the first riser a body stands upright under the stair
SP.split = r4(AF - 0.3);                        // feet above this are on the top landing (its collider: the attic's doors)
SP.going = SP.walk * SP.da1 * D2R; SP.going2 = SP.walk * SP.da2 * D2R;      // goings on the walking line, lower and upper flight
SP.ceil = r4(AF + 2.5);                         // the saucer ceiling's rim (GUESS)
SP.rb = r4(SP.RW + 0.05);                       // the balustrade's line
/** unwrapped angle at which tread k (1 .. n) begins, its angular width, and its top's height */
export const treadA = (k) => (k <= SP.kLand ? SP.a0 + (k - 1) * SP.da1 : k < SP.n ? SP.aL1 + (k - SP.kLand - 1) * SP.da2 : SP.a1);
export const treadW = (k) => (k < SP.kLand ? SP.da1 : k === SP.kLand ? SP.land : k < SP.n ? SP.da2 : SP.top);
export const treadY = (k) => SP.y0 + k * SP.rise;
/** point of the drum at angle a (degrees), radius r */
export const spAt = (a, r) => [SP.xc - r * Math.cos(a * D2R), SP.zc - r * Math.sin(a * D2R)];
/** angle (0 .. 360, clockwise from north) of a point about the drum's centre */
export const azOf = (x, z) => { let a = Math.atan2(-(z - SP.zc), -(x - SP.xc)) / D2R; if (a < 0) a += 360; return a; };
/** the tread (1 .. n) under UNWRAPPED angle a (> a0) */
export const treadOf = (a) => (a < SP.aL0 ? Math.min(SP.kLand - 1, Math.floor((a - SP.a0) / SP.da1) + 1) : a < SP.aL1 ? SP.kLand : a < SP.a1 ? Math.min(SP.n - 1, SP.kLand + 1 + Math.floor((a - SP.aL1) / SP.da2)) : SP.n);
/** height of the stair's surface at UNWRAPPED angle a (degrees, .. a2) */
export function helixY(a) {
  if (a <= SP.a0) return SP.y0;
  const k = treadOf(a), d = k <= SP.kLand ? SP.da1 : SP.da2;
  return SP.y0 + SP.rise * (k - 1 + Math.min(1, (a - treadA(k)) / d / SP.ramp));
}
/** height inside the drum at (x, z) for someone whose feet are at about yRef: of the floors over that spot, the one
 *  UNDER their feet — the highest that is not more than a step above them (so someone on the flags under the stair, or
 *  jumping there, is never lifted onto the turn overhead); the lowest if every floor there is above them */
export function drumY(x, z, yRef = 0) {
  const dx = x - SP.xc, dz = z - SP.zc;
  if (dx * dx + dz * dz < SP.RW * SP.RW) return SP.y0;                          // the well's floor
  const a = azOf(x, z);
  let best = null, low = null;
  const take = (y) => { if (low === null || y < low) low = y; if (y <= yRef + 0.45 && (best === null || y > best)) best = y; };
  if (a >= SP.aOpen || a <= SP.a0) take(SP.y0);                                 // the ground floor, where it is open under the stair
  for (const c of [a, a + 360, a + 720]) if (c > SP.a0 && c <= SP.a2 + 1e-9) take(helixY(c));
  return best !== null ? best : low !== null ? low : SP.y0;
}
// the passage from the Library's landing through the back wall to the Library's east wall (on the skew: the landing
// lies west-north-west; the doorway stands on its first metre, clear of the gallery's columns in the room)
export const LINK = { x0: r4(SP.xc - 1.02), x1: r4(SP.xc - 0.02), z0: r4(SP.zc + SP.R), z1: ZE, h: 2.3 };
SP.aExit = r4(360 - Math.acos((SP.xc - (LINK.x0 + LINK.x1) / 2) / SP.R) / D2R);      // the way out to the Library, on its landing
// the foot door: an oak leaf in the gate hall's south wall, opposite the Lodge's door (college u = WORC_BLOCK.lodge.doorU).
// `at`: the doorway's centre on a plane 0.3 m inside the gate hall's wall face (the drum's own wall crosses the
// doorway on the skew: 0.25 m in at its east jamb, 0.48 m at its west); the opening is punched 5 cm inside the gate
// hall's face, in front of the leaf the exterior paints 0.1 m in; the real leaf hangs just behind it.
const DOOR_Z = r4(Z0 - WB.lodge.doorU), DOOR_IN = 0.3;
export const DOOR = { at: [r4(PASS_X + DOOR_IN), DOOR_Z], out: -Math.PI / 2, w: EXT.libDoor.w, h: r4(EXT.libDoor.h - BASE - SP.y0), y: SP.y0, depth: r4(DOOR_IN - 0.08), uv: [WB.lodge.doorU, WB.gate.v1], leafX: r4(PASS_X + EXT.libDoor.recess + 0.035) };      // (the real leaf's outer face 5 mm behind the recess's back: no plane shared with the painted leaf)
/** room x of the drum's wall along the line z: its north side (the foot doorway, the attic's north doorway) */
export const drumX = (z) => SP.xc - Math.sqrt(Math.max(0, SP.R * SP.R - (z - SP.zc) * (z - SP.zc)));
/** … and its south side (the passage to the Hall wing's attic) */
export const drumXS = (z) => SP.xc + Math.sqrt(Math.max(0, SP.R * SP.R - (z - SP.zc) * (z - SP.zc)));

// ---------------------------------------------------------------- the attic library (plan: a GUESS, see the head)
const CH = WB.chapel, HA = WB.hall;
export const ATTIC = {
  // the three rooms' insides, room coordinates
  link: { x0: r4(WB.lodge.v0 - V0), x1: PASS_X, z0: r4(Z0 - WB.gate.u1), z1: r4(Z0 - WB.gate.u0) },
  chapel: { x0: r4(CH.v0 - V0), x1: r4(CH.v1 - V0), z0: r4(Z0 - WB.uRe), z1: r4(Z0 - WB.uR) },
  hall: { x0: r4(HA.v0 - V0), x1: r4(HA.v1 - V0), z0: r4(Z0 - WB.uRe), z1: r4(Z0 - WB.uR) },
  h: r4(ATOP - AF),
  // the north door: straight over the foot door, through the same thin wall
  north: { z: DOOR_Z, w: EXT.libDoor.w, h: 2.1 },
  // the south door: a passage running south from the top landing's first metre to the Hall wing's attic
  south: { z0: r4(SP.zc + 0.95), z1: r4(SP.zc + 1.93), h: 2.1 },
  // the opening between the link and the Chapel wing's attic, through the wing's wall
  arch: { z0: r4(Z0 - 11.6), z1: r4(Z0 - 9.6), h: 2.15 },
  stack: { d: 0.5, h: 2.05, pitch: 1.55 },
};
ATTIC.south.x1 = ATTIC.hall.x0;                 // (the passage ends at the Hall attic's north wall face)
/** the attic's windows (the exterior's small square windows, WORC_BLOCK.side.attic and east.f2): room `at` on the wall's
 *  inner face, outward heading, the wall's thickness there */
const SA = WB.side.attic, F2 = WB.east.f2, ARECESS = 0.22;      // (worcester.js wall(): the default recess of a painted window)
export const AWIN = [
  ...[0, 1].map((i) => ({ id: 'atticC' + i, at: [r4(WB.east.bays[i] - V0), ATTIC.link.z0], out: Math.PI, w: F2.w, y0: yOf(F2.y0), y1: yOf(F2.y1), wall: r4(WB.uC - WB.gate.u1), room: 'link' })),
  ...WB.side.fromEast.map((d, i) => ({ id: 'atticN' + i, at: [ATTIC.chapel.x1, r4(Z0 - (WB.uRe - d))], out: Math.PI / 2, w: SA.w, y0: yOf(SA.y0), y1: yOf(SA.y1), wall: WB.wingWall, room: 'chapel' })),
  { id: 'atticNE', at: [r4(CH.vc - V0), ATTIC.chapel.z0], out: Math.PI, w: SA.w, y0: yOf(SA.y0), y1: yOf(SA.y1), wall: WB.eastWall, room: 'chapel' },
  ...WB.side.fromEast.map((d, i) => ({ id: 'atticS' + i, at: [ATTIC.hall.x0, r4(Z0 - (WB.uRe - d))], out: -Math.PI / 2, w: SA.w, y0: yOf(SA.y0), y1: yOf(SA.y1), wall: WB.wingWall, room: 'hall' })),
  { id: 'atticSE', at: [r4(HA.vc - V0), ATTIC.hall.z0], out: Math.PI, w: SA.w, y0: yOf(SA.y0), y1: yOf(SA.y1), wall: WB.eastWall, room: 'hall' },
].map((w) => ({ ...w, depth: r4(w.wall - ARECESS + EXT.glass + 0.02 - 0.03), pane: r4(w.wall - ARECESS - 0.005) }));      // (depth + 0.03 = the punched plane, 2 cm in front of the painted glazing; pane: the room's own, just inside the exterior's recess, so the room's reveal shares no plane with it)
EXT.attic = { recess: ARECESS };
/** attic desks: one under each window, the seat facing it (heading = the window's outward heading) */
export const ADESKS = AWIN.map((w, i) => { const dx = Math.sin(w.out), dz = Math.cos(w.out); return { i, id: w.id, cx: w.at[0], cz: w.at[1], out: w.out, x: r4(w.at[0] - dx * 1.05), z: r4(w.at[1] - dz * 1.05), h: w.out, ax: r4(w.at[0] - dx * 1.7), az: r4(w.at[1] - dz * 1.7) }; });
/** bookstacks in the two wings: double-sided, running across the wing from its blind wall, a reading aisle along the windows */
export const STACKS = (() => {
  const out = [], S = ATTIC.stack;
  for (const [key, sg] of [['chapel', 1], ['hall', -1]]) { const R = ATTIC[key], blind = sg > 0 ? R.x0 : R.x1, len = 5.9;
    for (let z = R.z1 - 2.2; z > R.z0 + 3.4; z -= S.pitch) out.push({ room: key, z: r4(z), x0: r4(sg > 0 ? blind + 0.05 : blind - 0.05 - len), x1: r4(sg > 0 ? blind + 0.05 + len : blind - 0.05) }); }
  return out;
})();

/** The ways for someone WALKED by a script (Prof. Yang: places/friends.js roomLegs): room [x, z, y]. WALK_UP: from just
 *  inside the foot door, round the lower flight's walking line to the Library's landing, through the link and the baize
 *  door into the Library. WALK_ATTIC: the same and on round the upper flight to the top landing and through the north
 *  door into the attic's link. Straight pieces of about 17 / 22 degrees. */
const walkTo = (aEnd) => { const out = [], put = (a, y) => { const q = spAt(a, SP.walk); out.push([r4(q[0]), r4(q[1]), r4(y)]); };
  put(-4, SP.y0); put(SP.a0 - 6, SP.y0);
  for (let a = SP.a0 + SP.da1 * 0.65; a < Math.min(aEnd, SP.aL0) - 4; a += SP.da1 * 2.5) put(a, helixY(a));
  if (aEnd <= SP.aL1) { put(aEnd, LF); return out; }
  put(SP.aL0 + 8, LF); put(SP.aL1 - 6, LF);
  for (let a = SP.aL1 + SP.da2 * 0.65; a < SP.a1 - 4; a += SP.da2 * 2.5) put(a, helixY(a));
  for (let a = SP.a1 + 10; a < aEnd - 8; a += 22) put(a, AF);
  put(aEnd, AF); return out; };
export const WALK_UP = [...walkTo(SP.aExit), [r4((LINK.x0 + LINK.x1) / 2), r4(SP.zc + SP.R + 0.3), LF], [r4((LINK.x0 + LINK.x1) / 2), r4(ZE + 0.75), LF]];
export const WALK_ATTIC = (() => { const aN = 720 + azOf(DOOR.at[0], DOOR_Z) - 360; return [...walkTo(aN), [r4(PASS_X - 0.9), DOOR_Z, AF]]; })();
// the baize door at the head of the stair: in the Library's east wall (the cases stand either side of it)
export const INNER = { x0: LINK.x0, x1: LINK.x1, z: r4(ZE + 0.02), h: 2.1 };
/** whose height the stair is asked for (the local player's feet; set by the room every frame) */
let yRef = 0;
export const setRef = (y) => { yRef = y; };
const inBox = (b, x, z, m = 0) => x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m;
/** is (x, z) in the attic (its three rooms, the two doorways off the top landing, the opening between link and wing)? */
export function inAttic(x, z) {
  const A = ATTIC;
  if (inBox(A.link, x, z, 0.05) || inBox(A.chapel, x, z, 0.05) || inBox(A.hall, x, z, 0.05)) return true;
  if (x >= A.chapel.x1 && x <= A.link.x0 && z >= A.arch.z0 && z <= A.arch.z1) return true;                 // the opening in the wing's wall
  if (x >= SP.xc && x <= A.hall.x0 && z >= A.south.z0 - 0.05 && z <= A.south.z1 + 0.05 && (x - SP.xc) * (x - SP.xc) + (z - SP.zc) * (z - SP.zc) > SP.R * SP.R) return true;      // the south passage
  return false;
}
/** floor height anywhere in the room */
export function groundY(x, z, y = yRef) {
  const dx = x - SP.xc, dz = z - SP.zc;
  if (dx * dx + dz * dz <= (SP.R + 0.06) * (SP.R + 0.06)) return drumY(x, z, y);
  if (x < SP.xc - SP.R + 0.35 && x >= PASS_X - 0.05 && Math.abs(z - DOOR_Z) < DOOR.w / 2 + 0.05) return y > SP.split - 1 ? AF : SP.y0;      // the foot doorway; over it the attic's north doorway
  if (inAttic(x, z)) return AF;
  return LF;
}
/** the stair's window: the street front's south ground-floor window, through the drum's east side (round-headed).
 *  zAt: the drum's wall on the window's centre line; zGlass: the plane the exterior paints its glazing on */
const SWX = r4(SHELL.gw.v - V0);
export const SWIN = { x: SWX, w: SHELL.gw.w, y0: yOf(SHELL.gw.sill), ys: yOf(SHELL.gw.spring), y1: yOf(SHELL.gw.spring + SHELL.gw.w / 2),
  zAt: r4(SP.zc - Math.sqrt(SP.R * SP.R - (SWX - SP.xc) * (SWX - SP.xc))), zGlass: r4(Z0 - (WB.uC - EXT.gw.recess + EXT.glass)) };
SWIN.zPunch = r4(SWIN.zGlass - 0.02);          // the punched plane: 2 cm outside that glazing
SWIN.zPane = r4(SWIN.zPunch + 0.03);           // the room's own pane, just inside it
// the press against the north end wall, in the corner by the cases
export const PRESS = { x0: ROOM.x0, x1: r4(ROOM.x0 + 0.6), z0: ZE, z1: r4(ZE + 1.7), h: 2.7 };

// ---------------------------------------------------------------- windows (real openings onto the Main Quad)
export const WINDOWS = SHELL.front.v.map((v, i) => {
  const F = SHELL.front, arched = F.arched.includes(i), w = arched ? F.archW : F.w, ys = arched ? F.archSpring : F.y1;
  // out: how far west of the block's face (z = 0) the front's face is at this window (the centre breaks forward)
  return { id: 'libW' + i, i, x: r4(v - V0), w, y0: yOf(F.y0), ys: yOf(ys), y1: yOf(arched ? ys + w / 2 : ys), arched, out: arched ? F.breakOut : 0 };
});
/** the room's own glass stands this far behind the front's face (a Georgian sash near the outside of its wall) */
export const GLASS_IN = 0.2;
// desks: one under each window; the seat faces the window
export const DESKS = WINDOWS.map((w) => ({ i: w.i, cx: w.x, x: r4(w.x - 0.1), z: r4(ZW - 1.05), h: 0, ax: r4(w.x - 0.1), az: r4(ZW - 1.7) }));
export const DESK = { w: 1.3, d: 0.6, off: 0.14 };       // top 1.3 x 0.6 m, 0.14 m off the wall
// the gallery's columns: 3 m apart, the one bay with the door from the stair in it clear of the door (GUESS: their number)
export const COLUMNS = Array.from({ length: 11 }, (_, k) => [r4(WB.axis - V0 + 3 * (k - 5)), r4(ZE + GAL - 0.15)]);

// ---------------------------------------------------------------- registration data (core/interiors.js `seamless`)
// where a window can be seen from (a little slack into the walls' thickness: a third-person camera pressed against a wall)
// (and back as far as the stair's top landing: a window is glimpsed from it through the passage and the baize door)
const insideLib = { x0: ROOM.x0 - 0.3, x1: ROOM.x1 + 0.3, z0: SP.zc, z1: ZW + WT + 0.2, y0: LF - 0.5, y1: TOP + 0.5 };
const insideDrum = { x0: SP.xc - SP.R - 0.3, x1: SP.xc + SP.R + 0.3, z0: SP.zc - SP.R - 0.5, z1: SP.zc + SP.R + 0.3, y0: SP.y0 - 0.5, y1: SP.ceil + 0.8 };
const insideAttic = { x0: ATTIC.chapel.x0 - 0.3, x1: ATTIC.hall.x1 + 0.3, z0: ATTIC.chapel.z0 - 0.3, z1: ATTIC.link.z1 + 0.3, y0: AF - 0.5, y1: ATOP + 0.5 };
/** openings: ONE per window, sill to head (a round-headed one to its crown). The quad front is cut for real at each
 *  (_worcester_block.js: an arched or square hole with a stone reveal, its painted sash at the back of the recess for
 *  the view from far off); the punched rectangle stands INSIDE that hole (PUNCH_IN behind the front's face there, in
 *  front of this room's own sash), so the wall itself shapes it: an arched window is arched, and its reveal is the
 *  front's stone. The stair's window the same way, 2 cm outside the glazing the street front paints. */
export const PUNCH_IN = 0.1;
export const OPENINGS = [
  ...WINDOWS.map((w) => ({ id: w.id, at: [w.x, ZW], out: 0, w: w.w, y0: w.y0, y1: w.y1, depth: r4(WT + w.out), proud: -PUNCH_IN, head: w.arched ? 'round' : 'flat', from: insideLib })),
  // (`at` on a plane 0.15 m inside the punched one: the drum's curved wall crosses the window on the skew, between 0.07
  //  and 0.27 m inside the glazing — the street front's wall is thin where the drum comes nearest it)
  { id: 'libStair', at: [SWIN.x, r4(SWIN.zPunch + 0.15)], out: Math.PI, w: SWIN.w, y0: SWIN.y0, y1: SWIN.y1, depth: 0.12, head: 'round', from: insideDrum },
  // the attic's small square windows
  ...AWIN.map((w) => ({ id: w.id, at: w.at, out: w.out, w: w.w, y0: w.y0, y1: w.y1, depth: w.depth, head: 'flat', from: insideAttic })),
];
// (no `from` box on the portal: core reads portal.from as the id of the ROOM a doorway leads from)
export const PORTAL = { at: DOOR.at, out: DOOR.out, w: DOOR.w, h: DOOR.h, y: DOOR.y, depth: DOOR.depth };
/** the inside of the room, per storey (room coordinates) */
export const BOUNDS = [
  { x0: SP.xc - SP.R, x1: SP.xc + SP.R, z0: SP.zc - SP.R, z1: SP.zc + SP.R, y0: SP.y0 - 0.3, y1: r4(SP.ceil + 0.5) },      // the stair drum, floor to ceiling
  { x0: PASS_X, x1: r4(SP.xc - SP.R + 0.3), z0: r4(DOOR_Z - DOOR.w / 2), z1: r4(DOOR_Z + DOOR.w / 2), y0: SP.y0 - 0.3, y1: r4(SP.y0 + DOOR.h) },   // the foot doorway
  { x0: LINK.x0, x1: LINK.x1, z0: r4(LINK.z0 - 0.45), z1: LINK.z1, y0: LF - 0.3, y1: r4(LF + LINK.h) },                   // the passage from the Library's landing
  { x0: ROOM.x0, x1: ROOM.x1, z0: ZE, z1: ZW, y0: LF - 0.3, y1: TOP },                                                   // the Library
  { ...ATTIC.link, y0: AF - 0.3, y1: ATOP }, { ...ATTIC.chapel, y0: AF - 0.3, y1: ATOP }, { ...ATTIC.hall, y0: AF - 0.3, y1: ATOP },      // the attic's three rooms
  { x0: ATTIC.chapel.x1, x1: ATTIC.link.x0, z0: ATTIC.arch.z0, z1: ATTIC.arch.z1, y0: AF - 0.3, y1: r4(AF + ATTIC.arch.h) },                // the opening between link and Chapel wing
  { x0: r4(SP.xc + 1.2), x1: ATTIC.hall.x0, z0: ATTIC.south.z0, z1: ATTIC.south.z1, y0: AF - 0.3, y1: r4(AF + ATTIC.south.h) },             // the passage to the Hall wing
  { x0: PASS_X, x1: r4(SP.xc - SP.R + 0.3), z0: r4(DOOR_Z - DOOR.w / 2), z1: r4(DOOR_Z + DOOR.w / 2), y0: AF - 0.3, y1: r4(AF + ATTIC.north.h) },   // the attic's north doorway
];
export const CENTER = [r4(WB.axis - V0), r4((ZE + ZW) / 2)];
