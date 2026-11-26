// Earl Building interior plan: pure data (no three / DOM), shared by _worcint_earl.js (geometry, inside and outside)
// and places/friends.js (+ _friends_*.js: Miguel's chicken dippers). See docs/research/worcester.md "Earl Building
// interior" for what is from the owner's photographs and what is a guess, and docs/research/worcester_survey.md
// "Package E as built, part 2" for the 2026-11-22 re-lay.
//
// RE-LAID 2026-11-22 ON THE ARCHITECTS' PLAN (ADP, planning 05/00326/FUL, first-floor plan WCO1-D-062A; the 2022 height
// survey; the map's outline w69991346; satellite view at 28 m). Before, the kitchen stood across the NORTH end of the
// west wing, the automatic door in a recess at the wing's south end and a 15.6 m corridor ran between them down the
// middle of the wing: the true wing turned end for end. As it is:
//   * the KITCHEN is across the SOUTH end of the west wing (ADP's kitchen / dining room at that end; next to the Gym),
//     6.3 x 4.4 m; the owner's arrangement is kept: the table at the door end, the wide window with three coral blinds
//     on the wing's end wall, then fridge, fridge-freezer, dishwasher and the sink run to the far corner, and the far
//     window in the wing's WEST wall (the low sun of the photograph);
//   * the AUTOMATIC DOOR is under the copper canopy in the angle between the wing's east side and the middle section's
//     south side (ADP's south elevation: "entrance canopy with painted steel column and copper covered roof"; the
//     satellite view: a green patch in that angle; the height survey: a 2.9 m roof there), in the short wall that faces
//     south-south-east. "You go in, turn left, and the kitchen is at the end of that corridor" (the owner): in, left
//     through a fire door into the wing's corridor, and the kitchen door is at the corridor's south end;
//   * the CORRIDOR runs along the wing's EAST side on both floors; the study rooms are all on the WEST side with their
//     windows to the field (ADP), entered past an en-suite pod; two are open on the first floor;
//   * the STAIR is in the foyer north of the door, between the wing and the middle section (ADP's staircase / foyer).
// GUESSES: ADP's ground-floor plan is not on the planning register, so the ground floor is the first floor's plan with
// the door put under the canopy; the stair is one straight flight (ADP draws a dog-leg); the lobby's fire door is right
// inside the entrance; the wide blinds window is in the wing's end wall (ADP draws that wall blank: the owner's
// photograph has the window on the long wall beside the table, which at this kitchen is the end wall).
//
// The rooms are IN PLACE in the real building: the plan is drawn in a frame along the west wing.
//   +x = out through the wing's SOUTH end face (SSE in the world), x = 0 that face's outside;  +z = across the wing to
//   the WEST (WSW in the world): z = 3.8 is the wing's east face at the kitchen, z = 10.72 its west face;  y = 0 is the
//   GROUND floor (the door, the corridor, the kitchen), the first floor (the study rooms, up the stair) is y = FF.
// world = O + x * AX + z * AZ (FRAME below); a local heading h is the world heading h + FRAME.rot.
// Heading convention: forward = (sin h, cos h); 0 = +z, π/2 = +x, π = -z, -π/2 = -x.

export const FF = 3.0;          // storey height: the first floor is y = FF
export const CH = 2.5;          // ceiling height of the wing's rooms and corridors on either floor (suspended grid)
export const G = 0;             // ground-floor level
export const CHG = 2.62;        // ceiling height of the entrance lobby and the stair hall

// the map's outline is the frame of record: its vertex 13 (the wing's north-west corner) is at world (-407.2, -176.2),
// the wing runs 22.03 m from there to its south end and is 6.9 m wide at the kitchen
const V13 = [-407.2, -176.2], LEN = Math.hypot(10.3, 4.7), NX = [-4.7 / LEN, -10.3 / LEN], NZ = [10.3 / LEN, -4.7 / LEN];      // (NX: along the wing to the NNW; NZ: across it to the ENE)
const WING = 22.03, WEST_Z = 10.72;
const O = [V13[0] - WING * NX[0] + WEST_Z * NZ[0], V13[1] - WING * NX[1] + WEST_Z * NZ[1]];
export const FRAME = { O, AX: [-NX[0], -NX[1]], AZ: [-NZ[0], -NZ[1]], rot: Math.atan2(-NZ[0], -NZ[1]) };
export const toWorld = (x, z) => [O[0] + x * FRAME.AX[0] + z * FRAME.AZ[0], O[1] + x * FRAME.AX[1] + z * FRAME.AZ[1]];
export const toLocal = (wx, wz) => { const dx = wx - O[0], dz = wz - O[1]; return [dx * FRAME.AX[0] + dz * FRAME.AX[1], dx * FRAME.AZ[0] + dz * FRAME.AZ[1]]; };
/** the map's outline in the plan frame (map vertices 0..20) */
export const SHELL = [[-19.55, 19.0], [-16.29, 8.72], [-16.45, 6.89], [-22.04, 6.87], [-22.12, 4.64], [-24.5, 4.32], [-25.08, 5.81], [-35.81, 2.35], [-34.63, -1.18], [-24.34, -1.1], [-24.31, 2.21], [-22.16, 2.31], [-22.01, 0.07], [0, 0], [0, 11.32], [-4.39, 11.3], [-8.28, 22.49], [-2.76, 24.35], [-6.57, 35.36], [-25.47, 28.83], [-21.82, 18.18]]
  .map(([x, z]) => [+(-x - WING).toFixed(2), +(WEST_Z - z).toFixed(2)]);
export const WALL_T = 0.3;      // outer wall thickness (shell face to the room's wall face)
export const BAY_OUT = 0.45;    // how far the timber-boarded bays stand out from the wall (16/earl building - timber-boarded bay…)

const W = -Math.PI / 2, N = Math.PI, E = Math.PI / 2, S = 0;

// ---------------------------------------------------------------- the wing's faces (plan frame)
export const EAST_Z = 3.8;                      // the wing's east face at the kitchen (outside)
export const ANGLE_X = -5.6;                    // where that face ends: the short wall of the entrance faces +x there
export const ENTRY_Z = [2.0, EAST_Z];           // that wall, across (the map's 1.8 m; ADP draws 2.5)
// ---------------------------------------------------------------- ground floor (y = G)
// entrance: the automatic door in the short wall under the canopy, facing +x (out to the SSE)
export const ENTRANCE = { at: [ANGLE_X - WALL_T, 2.75], out: E, w: 1.2, h: 2.2 };
export const LOBBY = { x0: -7.75, x1: ANGLE_X - WALL_T, z0: 1.85, z1: 3.98 };          // the entrance lobby inside it
/** the fire door from the lobby into the corridor ("you go in, turn left"): in the corridor's east wall, z = CORR.z0 */
export const GDOOR = { z: 4.1, x0: -7.45, x1: -6.5 };
export const HALL = { x0: -11.2, x1: LOBBY.x0, z0: 0.0, z1: 3.98 };                    // the stair hall north of the lobby (ground floor): the flight's foot is 1.5 m into it
// stair: one straight flight along the hall's east wall, rising towards -x (north)
export const STAIR = { x0: -14.3, x1: -9.7, z0: 0.0, z1: 1.3, n: 17 };                 // ground (x1) up to the first floor (x0)
export const stairY = (x) => G + Math.min(1, Math.max(0, (STAIR.x1 - x) / (STAIR.x1 - STAIR.x0))) * FF;
// ---------------------------------------------------------------- first floor (y = FF)
export const LANDING = { x0: -16.4, x1: STAIR.x0, z0: 0.0, z1: 3.98 };
export const GALLERY = { x0: STAIR.x0, x1: STAIR.x1, z0: 1.5, z1: 3.98 };              // beside the stair's void, back towards the south
export const UPHALL = { x0: STAIR.x1, x1: LOBBY.x0, z0: 0.0, z1: 3.98 };               // over the hall: it looks down the flight
/** the first-floor fire door from the gallery into the corridor (ADP: at the corridor's north end) */
export const UDOOR = { z: 4.1, x0: -13.6, x1: -12.65 };
export const CORR = { x0: -16.4, x1: -4.7, z0: 4.1, z1: 5.6 };                        // the corridor (both floors), along the wing's east side: the kitchen is at its south end
// study rooms off the corridor's west side: x0..x1 each; a room is z ROOM_Z[0] (its window wall = the wing's west
// face) .. ROOM_Z[1] (its inner end); between that and the corridor an en-suite pod and the room's own entry
// (PASS_Z), 1.05 m wide at the room's -x side (PASS_X from its x0). `open` = modelled (first floor)
export const ROOM_Z = [10.42, 6.62];
export const PASS_Z = [5.72, 6.62];
export const PASS_X = [0.1, 1.15], ROOM_DOOR = [0.2, 1.05];      // the entry and the door in the corridor wall, from the room's x0
export const ROOMS = [
  { n: 104, x0: -16.4, x1: -13.95 }, { n: 103, x0: -13.85, x1: -10.95, open: true, seed: 3 },
  { n: 102, x0: -10.85, x1: -7.95, open: true, seed: 8 }, { n: 101, x0: -7.85, x1: -4.82 },
];
export const CORR_DOORS = { east: [], nums: [] };                                       // (no rooms on the corridor's east side: the foyer is there)
export const KIT = { x0: -4.7, x1: -0.3, z0: 4.1, z1: 10.42, door: [4.45, 5.45] };      // the GROUND-floor kitchen; doorway z 4.45..5.45 in its x0 (corridor) wall
/** windows (real openings): at = centre on the room's wall face, out = outward heading, w, y0..y1 above the floor fy; kind for the drawing */
export const WINDOWS = [
  // the wide window with three coral roller blinds: at the east corner of the wing's end wall, beside the table, in
  // the timber-boarded bay ADP's south elevation draws there with a window to each floor (the middle of that wall is
  // where the flat-roofed link to the Gym stands outside: the fridges are against it inside). `bay`: how far the bay
  // it is glazed in stands out from the wall (the opening runs through it: a deep sill inside)
  { id: 'kitBlinds', at: [KIT.x1, 5.07], out: E, w: 1.74, y0: 0.74, y1: 2.12, fy: 0, kind: 'blinds', bay: BAY_OUT, lights: 3, tr: 0.4 },
  { id: 'kitEnd', at: [-2.9, KIT.z1], out: S, w: 2.0, y0: 0.95, y1: 2.08, fy: 0, kind: 'timber', lights: 2, tr: 0.38 },        // the far window (the sun in the photo): the wing's west wall
  { id: 'kitEast', at: [-1.5, KIT.z0], out: N, w: 1.6, y0: 0.9, y1: 2.2, fy: 0, kind: 'timber', bay: BAY_OUT, lights: 2, tr: 0.4 },       // the two-light window by the table's end, in the timber bay on the east side of the same corner (ADP WF/13 and sectional east elevation; behind the photograph's camera)
  ...ROOMS.filter((r) => r.open).map((r) => ({ id: 'room' + r.n, at: [(r.x0 + r.x1) / 2 - 0.25, ROOM_Z[0]], out: S, w: 2.0, y0: 0.86, y1: 2.2, fy: FF, kind: 'room', lights: 3, tr: 0.42 })),
];

// ---------------------------------------------------------------- kitchen fittings
// (2026-11-22: the room is 6.32 m long, as the architects drew it, not 10.72: the window-wall run stands 0.35 m nearer
// the door than before, its last base unit against the far corner, and the first 3.8 m of the old room are gone.)
// From the photograph: on the window wall (x1) after the blinds, towards the far end: a short white fridge, a tall white
// fridge-freezer, a white dishwasher, three maple base units under a dark worktop with the sink, wall cupboards over
// them, and a short return along the end wall; the timber window in the end wall; a rectangular table by the blinds.
// GUESSES (the side the photo does not show, x0 = the corridor wall): the door, and a second run of units with the oven,
// hob, extractor, microwave, kettle and toaster; bins and noticeboard towards the near end.
export const K = {
  door: [-5.1, 4.95],                                   // in the corridor, just outside the kitchen doorway
  doorIn: [-4.0, 4.95],                                 // just inside it
  inKitchen: (x, z) => x > KIT.x0 && x < KIT.x1 && z > KIT.z0 && z < KIT.z1,
  unitsX: -4.1,                                         // front face of the cooker run (worktop x -4.7..-4.05)
  worktopY: 0.92,
  run: { z0: 5.75, z1: 10.3 },                          // the cooker run along the corridor wall
  oven: { x: -4.1, z: 7.45, w: 0.6, y0: 0.12, y1: 0.72 },   // built-under oven: door on the plane x = -4.1
  hob: [-4.38, 7.45],
  ovenStand: [-3.5, 7.45, W],
  // the photographed run (window wall): fronts on the plane x = -0.9
  frontX: -0.9,
  fridge2: { x0: -0.9, x1: -0.3, z0: 6.52, z1: 7.07, top: 0.87 },      // the short fridge (bananas on top)
  freezer: { x0: -0.95, x1: -0.3, z0: 7.07, z1: 7.67, top: 1.86 },     // the tall fridge-freezer (freezer = the bottom half)
  // …the same cabinet as the dippers scene draws its door and drawers: in a frame turned by freezerRot about the origin,
  // where it faces +z (x' = z, z' = -x)
  freezerC: { x0: 7.07, x1: 7.67, z0: 0.3, z1: 0.95 }, freezerRot: -Math.PI / 2,
  freezerStand: [-1.5, 7.37, E],
  dish: { z0: 7.67, z1: 8.27 },                         // white dishwasher under the worktop's end
  base: { z0: 8.27, z1: 10.07 },                        // three base units (drawer over door), the sink in the middle; the corner beyond them is under the worktop
  sinkZ: 9.15,
  ret: { x0: -1.8, x1: -0.3 },                          // the return along the end wall (base + wall cupboard)
  bar: { x0: -4.7, x1: -4.1, z0: 8.15, z1: 8.75, top: 0.92 },   // the stretch of worktop Miguel leans on while he waits (there is no breakfast bar)
  lean: [-3.5, 8.45, W],
  plateStand: [-3.5, 6.47, W],
  bagSpot: [-4.4, 7.87], ketchupSpot: [-4.45, 6.3],
  plateSpots: [[-4.38, 6.13], [-4.38, 6.45]],
  gloveHook: [-4.65, 1.22, 8.07],                       // oven glove on a hook on the splashback (x, y, z)
  sink: [-1.5, 9.15, E],                                 // standing at the sink
  microwave: [-3.5, 9.15, W],                           // waiting for the microwave (the generic flatmate's spot)
  microwaveBox: { z0: 8.9, z1: 9.4 },
  kettle: [-4.4, 9.65], toaster: [-4.4, 10.0],
  // table: rectangular; {x, z} is the middle of its cooker-side end (the bit of table the dippers are eaten at) and r the
  // reach of that scene's props about it
  table: { x: -1.75, z: 5.3, r: 0.6, y: 0.74 },
  tableRect: { x0: -2.25, x1: -1.45, z0: 4.4, z1: 6.05 },      // (by the blinds, its end a step from the short fridge, as photographed)
  // chairs (x, z, heading = facing the table): [0] window side (the generic flatmate), [1] window side opposite Lorenzo
  // (the guest), [2] aisle side (Lorenzo), [3] the cooker end (Miguel), [4] aisle side
  seats: [
    { x: -1.05, z: 4.7, h: W },
    { x: -1.15, z: 5.3, h: W },
    { x: -2.7, z: 5.3, h: E },
    { x: -1.75, z: 6.25, h: N },
    { x: -2.7, z: 4.7, h: E },
  ],
  bins: [[-3.6, 10.15], [-3.15, 10.15], [-2.7, 10.15]],   // general, recycling, food: under the far window
  notice: { x0: -4.3, x1: -3.0 },                       // noticeboard (the cleaning rota) on the door-end wall (z = KIT.z0)
};
// who sits where in the dippers scene (index into K.seats). Seat 0 is left for the generic flatmate (worcester_interiors).
export const SEAT = { miguel: 3, lorenzo: 2, guest: 1 };
// plates on the table, in front of Miguel's and Lorenzo's seats (+ the ketchup in the middle)
export const TABLE_PLATES = [[-1.75, 5.92], [-2.13, 5.3]];
export const TABLE_KETCHUP = [-1.57, 5.22];

// ---------------------------------------------------------------- the dippers scene's marks in this kitchen
// (_friends_logic.js: SPOT = the marks; VIA = the waypoints of its walks. Positions only.)
export const SPOT = {
  ovenNear: [-3.72, 7.45], plating: [-3.72, 6.47],
  deliver: [-2.37, 5.86],
  hover: [-2.6, 8.3],
  sinkL: [-1.3, 9.47],
  drinks: [-2.4, 5.8],
  tray: [-4.28, 7.47], traySide: [-4.26, 6.89],
  bag: [-4.42, 7.87],
  mitts: [-4.2, 7.77], mittsAfter: [-4.17, 6.635],
  plates: [[-4.22, 6.13], [-4.22, 6.45]],
  cupboard: [-4.42, 1.62, 6.3],
  ketchup: [-4.3, 6.29],
  spatula: [-4.26, 5.89],
  tableKetchup: [-1.8, 5.6],
  glasses: [[-2.08, 5.72], [-2.17, 5.54]],
  drainer: [[-0.68, 9.75], [-0.68, 9.63]],
  tap: [-0.64, 9.15],
  timer: [-4.09, 0.81, 7.37],
};
export const VIA = {
  aisleN: [-3.0, 7.6], aisleE: [-3.0, 8.3],
  mIn: [[-4.0, 4.95], [-3.2, 6.0]],                     // Miguel: door → freezer
  mPlates: [[-3.1, 6.2]],                               // worktop → table with the plates
  mSit: [[-2.45, 6.3]],                                // round the corner of the table to his chair
  mSink: [[-1.95, 6.9], [-1.6, 8.4]],                    // his seat → the sink
  mOut: [[-3.0, 6.9], [-4.0, 4.95]],                    // the sink → door
  lIn: [[-4.0, 4.95], [-3.3, 5.2]],                     // Lorenzo: door → his seat (and back out, reversed)
  lHover: [[-3.2, 5.9]],                                // seat → Miguel's shoulder
  lDrinks: [[-1.9, 8.4], [-2.5, 6.9]],                  // sink → table with the glasses
  gIn: [[-4.0, 4.95], [-3.0, 6.5], [-1.6, 6.9], [-1.2, 6.25]],   // the guest: door → round Miguel's end of the table → the window side
  sinkH: E,                                             // facing at the sink (it is on the window wall)
};

// ---------------------------------------------------------------- the way to the kitchen (ground floor all the way)
/** the automatic door's two sides, on its centre line: [x, z] 1.35 m outside (under the canopy) and just inside */
export const DOOR_OUT = [ENTRANCE.at[0] + WALL_T + 1.35, ENTRANCE.at[1]], DOOR_FACE = [ENTRANCE.at[0] + WALL_T + 0.05, ENTRANCE.at[1]], DOOR_IN = [ENTRANCE.at[0] - 0.05, ENTRANCE.at[1]];
const GX = (GDOOR.x0 + GDOOR.x1) / 2, CZ = K.door[1];
/**
 * inside the building, threshold -> the kitchen door in the corridor: [[x, z, y, door]] (plan frame). `door` 1: the leg
 * that ENDS here crosses a hinged door (the lobby's fire door): a walker pauses short of it for the leaf.
 */
export const WAY_IN = [[DOOR_IN[0], DOOR_IN[1], 0, 0], [GX, ENTRANCE.at[1], 0, 0], [GX, CZ, 0, 1], [K.door[0], CZ, 0, 0]];
/** outside the door -> the kitchen: [[x, y, z], ...] in the plan frame (tools/smoke_earl.mjs walks a player along it) */
export const KITCHEN_ROUTE = [
  [DOOR_OUT[0], 0, DOOR_OUT[1]], [ENTRANCE.at[0], 0, ENTRANCE.at[1]], [GX, 0, ENTRANCE.at[1]],
  [GX, 0, CZ], [K.door[0], 0, K.door[1]], [K.doorIn[0], 0, K.doorIn[1]],
];
/** Miguel's room: he lives in the Earl Building (the owner); WHICH room is not known. GUESS: the ground-floor room next to the kitchen: [x, z] before its door in the corridor */
export const ROOM_AT = [ROOMS[3].x0 + (ROOM_DOOR[0] + ROOM_DOOR[1]) / 2, CORR.z1 - 0.45];
