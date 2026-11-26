// Worcester College, the RANGES of Pump Quad (Staircases 13 - 16): the plan. College LOCAL frame (u east, v south; see
// places/worcester.js), heights above the core's datum (61.05 mOD = the loggia floor = the street: WORC_LEVELS).
// Built by places/worcester_pumpranges.js + _worcester_pumpranges_build.js in place of the city generator's boxes
// (mapped w301621502 / 3 / 4 and worcester.js's 'worc-st13'). `?wpumpr=0` (node: GTO_WPUMPR=0) = as before.
//
// HOW IT WAS MEASURED (2026-11-22/23). Sources, in the order they rank here:
//   LIDAR 2022 (1 m; roof edges are eaves, 0.2 - 0.3 m outside the walls; it lies 0.5 m east of the map);
//   the RCHM plan of 1939 scaled by the Hall's 17.9 m (it runs about 4 % long southwards of the Hall: its south range
//   lies 0.5 m south of LIDAR's on both faces, so only its u readings and its drawing are used);
//   the photographs in reference/worcester/06 (the corner with the doorway, the owner's and the college's from above,
//   Worcester Street looking north 2014, the range from the north-east 2021), 05 (the garden side), the 2026 street
//   view over the kitchen-yard wall, the satellite views (max zoom; S5).
// WHAT STANDS THERE (the map's four "staircases" are not the masses):
//   - ONE three-storey range along the court's south side and on west behind the Cottages' east building: the SOUTH
//     RANGE (u 3.6 .. 21) and, in the same line, the OLD KITCHEN (u -11.9 .. 2.2; here only its east 3.5 m: the rest
//     is worcester.js's "Staircase 13 west wing", still two storeys: see DEFECTS in the module). Clay tiles, ridge 9.7 -
//     9.9 m, eaves 7.25 m (8.5 m above the court), ashlar stacks rising from the garden wall's eaves.
//   - the EAST RANGE on Worcester Street, meeting it in a hipped corner; its street wall is not straight (LIDAR and the
//     1939 plan agree: it swells 0.35 m to about v 26 and then runs back south-west), and stands 0.4 m proud of the
//     Hall wing's face.
//   - across the court's south-east ANGLE a canted wall with the 15th-century doorway, its stone-slated hood and the
//     one-light cinquefoiled window (1939 plan; the college's photograph).
//   - two wings running SOUTH from the range (not on the 1939 plan; LIDAR, satellite, photographs): the lower WEST
//     WING (two storeys and three Gothick dormers under steep stone slates: seen from the garden) and the tall EAST
//     WING beside it (clay tiles; its top windows show over the Worcester Street wall).
import { WORC, WORC_LEVELS, WORC_BLOCK } from './_worcester_shared.js';

const _qs = typeof location !== 'undefined' && location && location.search ? location.search : '';
const _env = typeof process !== 'undefined' && process.env ? process.env : {};
export const PUMPR_ON = !(/[?&]wpumpr=0(&|$)/.test(_qs) || _env.GTO_WPUMPR === '0');
export const PUMPR_IDS = ['w301621502', 'w301621503', 'w301621504'];

const PHI = 0.0761, COS = Math.cos(PHI), SIN = Math.sin(PHI), C0 = [-250, 10];
export const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];
export const W2L = (x, z) => { const dx = x - C0[0], dz = z - C0[1]; return [dx * COS - dz * SIN, dx * SIN + dz * COS]; };
export const FRAME = { c0: C0, cos: COS, sin: SIN };

const PD = WORC.pidgeDoor, SLOPE = PD.along[1] / PD.along[0];
/** the court's south side = the south range's court face (the line the pigeonhole room's door stands on) */
export const front = (u) => PD.uv[1] + (u - PD.uv[0]) * SLOPE;
/** the range's garden / kitchen-yard face (LIDAR: eaves at v 35.8 by u -6, 38.6 by u 19, 39.6 - 40.2 by u 24 - 26) */
export const back = (u) => 36.12 + 0.137 * u;
export const LEVEL = { court: WORC_LEVELS.pumpQuad, street: 0.05, yard: WORC_LEVELS.yOf(WORC_LEVELS.lowOD.kitchenYard), garden: WORC_LEVELS.yOf(59.15) };

export const RG = {
  yE: 7.25, tan: 0.72, ov: 0.25,                       // eaves (68.3 mOD), roof pitch 36 deg (LIDAR: 0.7 - 0.8 m/m), the eaves' overhang
  uW: -1.3, ue: 21.3, vN: WORC_BLOCK.vS,                // the west end built here; the east range's court face (PUMP.ue); the Hall's wall
  cant: { u0: 19.8, v1: 30.55, top: 3.65 },             // the canted angle: (u0, front(u0)) -> (ue, v1); its weathered top (4.9 m above the court)
  east: [[28.4, WORC_BLOCK.vS], [28.75, 26.0], [27.6, back(27.6)]],      // the street face, north to south
  // storeys, above the datum: [sill, head] of the ground, first and second floors' windows on the court side (the
  // corner photograph, scaled by the 8.5 m eaves: 0.35 - 0.65 .. 2.35, 3.3 .. 5.65, 6.75 .. 8.3 m above the court)
  g: [-0.7, 1.1], f1: [2.05, 4.4], f2: [5.5, 7.0],
  // the same on Worcester Street (2014 photograph, scaled by the 7.3 m eaves above the pavement)
  sf1: [2.0, 3.6], sf2: [5.25, 6.85],
  w1: { u0: -0.5, u1: 7.0, v1: 45.6, yE: 3.25, ridgeU: 4.5, ridgeY: 8.15 },        // west wing (LIDAR: eaves 64.3, ridge 69.2 mOD)
  w2: { u0: 7.0, u1: 13.9, v1: 48.4, ridgeU: 10.45, ridgeY: 9.75, s: { u0: 8.5, u1: 13.3, v1: 52.6, ridgeY: 8.8 } },      // east wing and its narrower south end
};
/** the east range's street face at v (u) */
export const eastU = (v) => { const E = RG.east; const [a, b] = v <= E[1][1] ? [E[0], E[1]] : [E[1], E[2]]; return a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]); };

// The pigeonhole room's openings in the court front (places/_worcint_pidge.js punches its door and window INSIDE
// these recesses, 7 cm in front of what is painted at their backs: the scheme of _worcester_block.js BLOCK_OPENINGS).
// door: at WORC.pidgeDoor (u 14.0), 1.0 m wide, from the room's floor (a 10 cm step above the gravel) to 2.2 m;
// win: the range's six-over-six sash 3.78 m east of it (the corner photograph has that sash 2.1 m from the canted
// angle, u 17.7: it is the room's window), 0.55 .. 2.35 m above the court.
export const RANGE_OPENINGS = {
  door: { u: PD.uv[0], w: 1.0, y0: 0.1, y1: 2.3, recess: 0.145 },
  win: { u: PD.uv[0] + 3.78 * -PD.along[0], w: 0.95, y0: 0.55, y1: 2.35, recess: 0.12 },
  // win2: the wide eight-over-eight sash west of it in the same photograph (about 4.5 m from the angle), 1.25 m wide
  win2: { u: PD.uv[0] + 1.5 * -PD.along[0], w: 1.25, y0: 0.55, y1: 2.35, recess: 0.12 },
};

/** staircase doors (local u, v on the wall; `face`: outward normal), where the 1939 plan and the photographs have doorways */
export const STAIR_DOORS = {
  13: { uv: [3.5, front(3.5)], face: [SLOPE, -1], note: 'the 1939 plan\'s through-passage in the court\'s south-west corner' },
  14: { uv: [11.4, front(11.4)], face: [SLOPE, -1], note: 'the 1939 plan\'s doorway to the south range\'s stair' },
  15: { uv: [(RG.cant.u0 + RG.ue) / 2, (front(RG.cant.u0) + RG.cant.v1) / 2], face: [-0.58, -0.81], note: 'the angle doorway' },
  16: { uv: [RG.ue, 25.05], face: [-1, 0], note: 'the 1939 plan\'s doorway to the east range\'s stair' },
};

/** the outline of everything built here (anticlockwise on a north-up plan: outside on the right hand), for colliders and clearing */
export const RING = (() => {
  const C = RG.cant, E = RG.east, W1 = RG.w1, W2 = RG.w2, r = (p) => [+p[0].toFixed(3), +p[1].toFixed(3)];
  return [[RG.uW, front(RG.uW)], [RG.uW, back(RG.uW)], [W1.u0, back(W1.u0)], [W1.u0, W1.v1], [W2.u0, W1.v1], [W2.u0, W2.v1], [W2.s.u0, W2.v1], [W2.s.u0, W2.s.v1], [W2.s.u1, W2.s.v1], [W2.s.u1, W2.v1], [W2.u1, W2.v1], [W2.u1, back(W2.u1)],
    E[2], E[1], E[0], [RG.ue, RG.vN], [RG.ue, C.v1], [C.u0, front(C.u0)]].map(r);
})();
/** ways a player or a friend walks past what is built here (local points): nothing of ours may cross them */
export const WAYS = {
  court: [[3.6, front(3.6) - 0.75], [19.2, front(19.2) - 0.75], [20.6, 29.6], [20.6, 24.4]],
  pidgeDoor: [[PD.uv[0], PD.uv[1] - 3.0], [PD.uv[0], PD.uv[1] - 0.45]],
  street: [[30.0, 19.5], [30.2, 26.0], [29.3, 39.5]],
};

// K (seen in a named source or measured) / G (guess): [element, K | G, source or what is guessed]
export const CHECKED = [
  ['one three-storey range on the court\'s south side, in line with the Old Kitchen; eaves 8.5 m above the court, ridge 11 m; red-brown clay tiles', 'K', 'LIDAR 2022 (eaves 68.2 - 68.4, ridge 70.6 - 70.8 mOD); 40 satellite/…max zoom…; 06/pump quad south range south side… (Mathis 2011)'],
  ['court face of the south range on the line of the pigeonhole room\'s door (the map\'s; = PUMP.south to 4 cm)', 'G', 'LIDAR\'s eaves put the wall 0.1 m north of it at u 7 and 0.3 - 0.5 m SOUTH of it at u 17 - 20 (slope 0.13 against 0.094); the 1939 plan agrees with LIDAR\'s slope. Not moved: the court, the room and its door are fitted to this line'],
  ['east range: court face u 21.3; street face from (28.4, 19.1) by (28.75, 26.0) to (27.6, 39.9), 0.4 m proud of the Hall wing', 'K', 'LIDAR (eaves 28.6 - 29.0 to v 28, 28.4 at v 30, 27.9 at v 38); RCHM 1939 plan (the same bend, 0.4 m further east). The map has it 0.3 - 2.3 m west'],
  ['garden / yard face on one line from (-1.3, 35.9) to (27.6, 39.9)', 'K / G', 'LIDAR; G: the south-east block really stands about 0.6 m proud of the range\'s yard face east of u 21.5 (built as one line)'],
  ['the canted angle with the four-centred doorway, a stone-slated hood on brackets, a one-light cusped window over it, the cant weathered back to the square corner 4.9 m up; a small round lamp over the arch', 'K', '06/pump quad corner with doorway (worc.ox.ac.uk); RCHM 1939 plan (the doorway drawn through a canted wall). G: the hood\'s size to 0.2 m; that the round fitting is a lamp'],
  ['court windows, east range: ground floor two wide 8-over-8 sashes by the angle (v 27.3, 29.6), a tall 6-over-6 above the second, 8-over-8 and 6-over-6 on the top floor', 'K', 'the corner photograph; RCHM plan (openings at v 20.9, 23.0, 27.8, 30.0, a doorway at 25)'],
  ['court windows, south range: from the angle a narrow blocked light, a 6-over-6 sash (u 17.7), then wide 8-over-8 sashes; tall first-floor sashes; a narrow sash by the angle on the top floor', 'K', 'the corner photograph; RCHM plan (openings at u 5.5, 7.1, 9.3, 13.6, 17.2, 20.0, a doorway at 11.4)'],
  ['windows not in any picture (the court fronts west of u 14 above the ground floor, the east range north of v 26)', 'G', 'one to a bay over the 1939 plan\'s ground-floor openings'],
  ['top storey of 1824 in more regular, paler stone above the old rubble', 'K', 'the corner photograph (a change of masonry at the second-floor sills); RCHM: raised from two storeys to three in 1824'],
  ['Staircase 15 = the angle doorway; 14 = the doorway at u 11.4; 16 = the doorway at v 25 in the east range; 13 = the archway in the south-west corner', 'K (the doorways) / G (which number hangs at which)', 'RCHM 1939 plan; the college\'s 2023 map (13 by the Buttery, 14 south-west, 15 south-east: Student Post Room, 16 east)'],
  ['pigeonhole room: its door at u 14.0 where the 1939 plan has a window; its windows the six-over-six sash at u 17.7 and the wide eight-over-eight at u 15.5', 'G (the door) / K (the sashes; the wide one +-0.5 m)', 'the college\'s map puts the post room at Staircase 15; where its door is is not in any picture'],
  ['Worcester Street face: two rows of sashes over a blank sunk ground storey (heads 3.6 and 6.85 m above the pavement); a low grilled doorway with an ashlar surround (v 35.1); a second doorway (v 25.3); a dark two-light 17th-century casement (v 34.5); downpipes; soot-dark rubble', 'K', '06/worcester street elevation… looking north (2014); 06/hall wing from NE… (2021): positions along the wall from both, +-0.7 m'],
  ['the "blocked archway and two blocked 17th-century windows" of the list description', 'G', 'not found in either street photograph: NOT built'],
  ['tall ashlar stack with a battlemented cap on the street wall near its south end', 'K', 'both street photographs; LIDAR (71.4 mOD at u 26.2, v 36.5); 2026 street view'],
  ['stacks: on the ridge at the Old Kitchen\'s east wall (u 2.4), on the garden eaves at u -1.0, 5.5 and (the tallest) 11.5', 'K', 'LIDAR (70.3 - 72.4 mOD); the Mathis photograph; satellite. Heights +-0.4 m'],
  ['hipped south-east corner, a valley in the court\'s angle; the east range\'s roof runs into the Hall\'s wall', 'K', 'LIDAR; satellite; 2026 street view (the eaves turn the corner)'],
  ['west wing: two storeys, eaves 5.1 m, steep stone slates to a ridge at u 4.5, three gabled Gothick dormers and three ashlar-framed windows on its west side, a rubble gable to the south, a bracket lantern on its south-west corner', 'K', 'LIDAR; 06/…south range south side… (Mathis); 06/…west block south front… (PXL 2025); 06/south range passage arch… (2010). G: its ground floor (behind planting in every picture)'],
  ['east wing: three storeys under clay tiles, ridge 9.75 m at u 10.5, gabled; a narrower lower south end; six sashes in its top storey to the yard', 'K (masses, roof, top windows) / G (everything below the top storey, hidden by the street wall)', 'LIDAR; S5 satellite; streetview/street 2026 - Worcester St, college wall and cottages…'],
  ['lanterns: the bracket lantern on the west wing\'s corner (K); the round lamp over the angle doorway (K that a fitting is there); a bracket lantern by the pigeonhole room\'s door (G: a door in use after dark, where the game starts)', 'K / G', 'the owner, 2026-11-22: "real lanterns where they really are; no general brightening"'],
  ['the west end at u -1.3: a plain rubble gable closing the range', 'G', 'TEMPORARY: the Old Kitchen really runs on west at the same height to its great chimney at u -11.9 (worcester.js still has that part two storeys high)'],
];
