// Worcester College as seen from the street (2026-11-22: from street-level and aerial pictures of the present day,
// local `reference/streetview/`, looked at and never copied or used as textures). Called by places/worcester.js.
//
//   streetPreMap(game)        boundary walls and restyled ranges, before the world is built:
//     - the Walton Street wall (OSM w999276231) is coursed rubble (it was drawn as ashlar blocks); its height and line
//       are untouched (places/friends.js runs along its coping);
//     - a rubble wall along Walton Street north of the Provost's Lane gate, to the college's Walton Street houses;
//     - a rubble wall about 3 m high along Worcester Street from Staircase 15 to the Wolfson Building (nothing was
//       drawn there: the Nuffield Lawn lay open to the street);
//     - Staircases 14-16 (the ranges south of the Hall): two storeys under a pitched roof, eaves about 7 m (they were
//       three-storey ashlar blocks 13 m high); the Asa Briggs range behind the Worcester Street wall: one low storey
//       under a stone-slate roof with a row of dormers.
//   buildStreetFront(game, M) hand-built, in the college's atlas:
//     - the two wings' street ends: channelled ground storey, a balustrade across the foot of the Venetian window, a
//       roundel over it, a square attic window in a stone surround;
//     - the gate piers and the boarded double gates (shut) at Provost's Lane on Walton Street: Gate 2;
//     - the blocked ashlar doorway in the Worcester Street wall.
// KNOWN from the pictures: what stands where, materials, storeys. GUESSES (flagged): every dimension (by eye, +-0.4 m),
// where exactly the blocked doorway is along the wall, the gates' colour by night.
import * as THREE from 'three';
import { Batch, frame, rectPts } from './_worcester_kit.js';
import { SOUTH_ON } from './_worcester_south_kit.js';

// `?wfront=0` (node: GTO_WFRONT=0): the college as it was before this pass, for before / after pictures
const ON = !((typeof location !== 'undefined' && location && /[?&]wfront=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_WFRONT === '0'));
const PHI = 0.0761, COS = Math.cos(PHI), SIN = Math.sin(PHI), C0 = [-250, 10];
const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];

// the Worcester Street wall: world points, north to south, half a metre inside the college's mapped boundary
// 2026-11-22 (places/worcester_south.js): the wall stops at the ashlar pier of Gate 1 (Wolfson Gate; the 2022 height
// survey has the gap at z 109.5-112) and goes on south of the gates to the Wolfson Building's east stair tower. Both
// pieces lie on the old line. `?wsouth=0` draws it unbroken as before.
export const WST_WALL = SOUTH_ON ? [[-222.3, 47.75], [-225.8, 62.5], [-238.1, 100.8], [-239.35, 106.8]] : [[-222.3, 47.75], [-225.8, 62.5], [-238.1, 100.8], [-242.5, 121.9], [-246.1, 122.4]];
export const WST_WALL_S = SOUTH_ON ? [[-240.55, 112.5], [-242.5, 121.9], [-244.9, 122.3]] : [];
// the Walton Street wall north of Provost's Lane: from the gate's north pier to the corner of 1a Walton Street
export const WALTON_N_WALL = [[-227.0, -49.75], [-226.9, -69.0], [-227.0, -70.8]];
// Provost's Lane gateway on Walton Street: pier centres (world), the lane runs west between them
export const LANE_GATE = { piers: [[-227.0, -44.5], [-227.0, -49.3]], h: 3.3, leaf: 2.0, leafH: 2.85 };
// the blocked doorway: how far along the Worcester Street wall's first stretch (0..1)
const BLOCKED_T = 0.6;

export function streetPreMap(game) {
  if (!ON) return;
  const ov = game.overrides, map = game.map;
  if (map && map.barriers) {
    const w = map.barriers.find((b) => b.id === 'w999276231'); if (w) w.rubble = true;
    // (ids chosen so the barrier planner's hash draws them as coursed rubble: world/barriers.js)
    map.barriers.push({ id: 'worc:wall-walton-n', kind: 'wall', h: 2.6, rubble: true, pts: WALTON_N_WALL.map((p) => p.slice()) });
    map.barriers.push({ id: 'worc:wall-worcester-st', kind: 'wall', h: 3.0, rubble: true, pts: WST_WALL.map((p) => p.slice()) });
    if (WST_WALL_S.length) map.barriers.push({ id: 'worc:wall-worcester-st-s', kind: 'wall', h: 2.4, rubble: true, pts: WST_WALL_S.map((p) => p.slice()) });
  }
  // big trees over the Walton Street wall, by the lane gate (the street picture; ordinary map trees; G: exactly where)
  if (map && map.trees) map.trees.push([-235, -31, 14], [-233.5, -57.5, 15]);
  // Staircases 14-16: weathered grey-buff stone, plain sashes, two storeys (the street picture: eaves about 7 m, ridge
  // about 9 m). Eaves 7.8 m = two storeys of the 3.9 m the ranges had, so the pigeonhole room's window and door (fitted
  // to the glass of Staircase 15's ground-floor sash, _worcint_pidge.js PR.win) stay exactly where they were. Roofs: brown
  // stone slates (15 and 16 were bright red tile: from the street they are grey-brown, from the air a dull red-brown).
  const low = { wall: 'stone', tint: [0.74, 0.71, 0.65], ivy: false, rubble: true, storeys: 2, eaves: 7.8, up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor', parapet: false, crenel: false, dormers: false, shape: 'gabled' };
  for (const [id, roof] of STAIR_LOW) ov.style.set(id, { ...low, roof });
  // the Asa Briggs range behind the Worcester Street wall. It is hand-built by places/worcester_south.js (which skips
  // this outline); should that module be missing, the generic builder now gets what the survey measured: two storeys and
  // an attic, eaves 7.0 m, hipped stone slates with dormers (it was one storey, eaves 3.9 m, gabled: the street-side
  // view over the 3 m wall, from a street 1.3 m above the lawn, had hidden the ground floor)
  if (SOUTH_ON) ov.style.set('w28043595', { wall: 'stone', tint: [0.9, 0.87, 0.8], ivy: false, rubble: true, storeys: 2, eaves: 7.0, up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor', roof: 'stone', shape: 'hipped', dormers: true, parapet: false, crenel: false });
  else ov.style.set('w28043595', { wall: 'stone', tint: [0.9, 0.87, 0.8], ivy: false, rubble: true, storeys: 1, eaves: 3.9, up: 'stoneSash', roof: 'stone', shape: 'gabled', dormers: true, parapet: false, crenel: false });
}
// [id, roof]: see streetPreMap
const STAIR_LOW = [['w301621504', 'stone'], ['w301621503', 'stone'], ['w301621502', 'stone']];

export function buildStreetFront(game, M) {
  if (!ON) return { meshes: [], tris: 0 };
  const world = game.world, col = game.worldCollider;
  const B = new Batch();
  const grp = new THREE.Group(); grp.name = 'worcester-street';
  world.addStatic(grp);
  let bayN = 700;
  const bay = (y0) => [1 + (bayN++ % 251), y0 < 4.2 ? 0 : 1 + (bayN % 5)];

  // ---------------------------------------------------------------- college local frame
  B.push(frame(C0[0], 0, C0[1], COS, -SIN));      // x = u, z = v
  // (the wings' street ends — channelled base, balustrade, roundel, attic window — are drawn with the block itself,
  //  at their true heights: places/_worcester_block.js, 2026-11-22)
  // (the gabled range against the Chapel wing's north side is the Senior Common Room range's east end: built whole,
  //  to its true plan, by places/_worcester_terrace.js — the first pass's guessed "cottage" stood here)
  B.pop();

  // ---------------------------------------------------------------- world frame
  // Provost's Lane gateway (the college's Gate 2): two square ashlar piers with caps, the boarded double gates shut
  {
    const G = LANE_GATE;
    for (const [i, [x, z]] of G.piers.entries()) {
      B.boxXZ('stone', x - 0.4, x + 0.4, 0, G.h, z - 0.4, z + 0.4, { top: false });
      B.boxXZ('stoneDress', x - 0.5, x + 0.5, G.h, G.h + 0.2, z - 0.5, z + 0.5, { bottom: true });
      B.boxXZ('stoneDress', x - 0.32, x + 0.32, G.h + 0.2, G.h + 0.36, z - 0.32, z + 0.32);
      for (const [a, b] of [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]].map((q, k, arr) => [q, arr[(k + 1) % 4]])) col.addSegment(x + a[0], z + a[1], x + b[0], z + b[1], { tag: 'wall' });
    }
    // GATE 2 IS SHUT (the owner, 2026-11-22; the 2026 street photograph: solid black boarded gates lettered "Gate 2"):
    // the two leaves meet in the middle of the gateway, a wall to walkers and cars
    const gx = G.piers[0][0], za = Math.max(G.piers[0][1], G.piers[1][1]) - 0.4, zb = Math.min(G.piers[0][1], G.piers[1][1]) + 0.4, zm = (za + zb) / 2;
    for (const [z0, z1] of [[zb, zm - 0.015], [zm + 0.015, za]]) {
      B.boxXZ('door', gx - 0.04, gx + 0.04, 0.08, G.leafH, z0, z1);
      for (const y of [0.5, G.leafH - 0.5]) for (const sx of [-1, 1]) B.boxXZ('iron', gx + sx * 0.04 - (sx < 0 ? 0.025 : 0), gx + sx * 0.04 + (sx > 0 ? 0.025 : 0), y - 0.05, y + 0.05, z0 + 0.04, z1 - 0.04, { bottom: true });
    }
    // (its lettering is a card in the college's main batch — worcester.js — so that this batch needs no sign mesh of its own)
    col.addSegment(gx, zb, gx, za, { tag: 'wall' });
  }
  // the blocked doorway in the Worcester Street wall: an ashlar surround standing a little above the wall, walled up
  {
    const a = WST_WALL[0], b = WST_WALL[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l;
    const px = a[0] + (b[0] - a[0]) * BLOCKED_T, pz = a[1] + (b[1] - a[1]) * BLOCKED_T;
    // x north along the wall, z out to the street; the wall is 0.42 m thick about its line
    B.push(frame(px, 0, pz, -dx, -dz));
    const hw = 0.5, H = 2.0;
    for (const sx of [-1, 1]) B.box('stoneDress', sx * (hw + 0.17), (H + 0.1) / 2, 0.2, 0.34, H + 0.1, 0.16, 0, { top: false });
    B.box('stoneDress', 0, H + 0.33, 0.2, hw * 2 + 0.9, 0.46, 0.2, 0, { bottom: true });
    B.box('stoneDress', 0, H + 0.62, 0.2, hw * 2 + 1.1, 0.12, 0.26, 0, { bottom: true });
    B.box('greyStone', 0, H / 2 + 0.05, 0.2, hw * 2, H + 0.1, 0.1, 0, { top: false });
    B.pop();
  }
  const meshes = B.build(M, grp, { pack: M._pack, noCast: new Set(['signs']) });
  return { meshes, tris: meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0) };
}
