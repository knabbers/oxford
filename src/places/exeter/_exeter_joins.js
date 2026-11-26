// Exeter College: the CITY SIDE of the joins round the site (the merge, 2026-11-24). Called from exeter.js preMap, after
// every system's preMap (systems/streetscape.js has already fitted the named lanes between the MAP's walls, so the widths
// set here are final), before the world is built. It edits the map's own records, as other places do (worcester_*.js):
// each change below says what it moves, by how much and on what evidence. Points are LOCAL (u east, v south;
// _exeter_shared.js) and carried to the world with L2W.
//
//  1. TURL STREET along the college (roads w110348415 south of Ship Street, w27896352 north of it) is given its real
//     section: the kerb on the college's side at u -25.4 (K: the topographic survey 210239-P-10, at the gate), the
//     carriageway 5.3 m, pavements 1.7 m (south of Ship Street) / 1.85 m (north of it) reaching each face. The centre
//     line moves 0.25 - 0.85 m west of the map's (the map's ran nearer Exeter: the city drew a pavement 0.4 m too far
//     out at the gate and none beyond the range's foot further north, and 2.1 - 2.4 m of bare ground on the far side).
//  2. JESUS COLLEGE's Turl Street front (map buildings w191369421, w301448619, w227803491, w301448613 and the wall
//     w331385290 between Ship Street and the range) moves 2.2 - 2.5 m EAST onto u -32.4: LIDAR 2022 (1 m surface, mixed
//     cells at u -32.5 .. -32.0 on v -5, 2.65, 8, 20, 27 and 31) and Street View / photographs (Hilton 2017, Halling 2025:
//     about 1.8 - 2 m of pavement before Jesus, a carriageway of about 5 m). The wall's line is a GUESS (in line with
//     the range: LIDAR cannot see it under the chestnut).
//  3. The CONVOCATION HOUSE (map building w114575324, the Bodleian's): its south face moves onto the topographic
//     survey's line (v 8.33 at u 59.5), which is also the Fellows' Garden's north edge (_exeter_garden_plan.js
//     NORTH_EDGE): 0.54 m south at its west end, 0.12 m at its east end (the map's face ran 0.3 m north of the survey
//     and left a strip of nothing between the garden's gravel and the wall's foot). Its other faces do not move.
//  4. BRASENOSE LANE (w4884545, w1675518) runs down the middle between the college's surveyed lane face (the Hall's
//     face is 1 - 1.3 m south of the map's line) and the buildings opposite, wall to wall: its centre line moves
//     0.4 - 1.1 m north and the way is drawn in four lengths of their own widths (5.3 / 4.6 / 4.9 / 6.6 m) instead of 3.9 m,
//     so no strip of bare ground is left at the college's walls (the buildings opposite: the map's, checked against
//     LIDAR to 0.2 - 0.6 m, not moved).
//  5. Margary Quad: the city's cycle stands and lot cars are not stood there (below).
import { L2W, W2L } from './_exeter_shared.js';

const near = (p, q, d = 0.06) => Math.abs(p[0] - q[0]) < d && Math.abs(p[1] - q[1]) < d;
const W = (u, v) => { const p = L2W(u, v); return [+p[0].toFixed(3), +p[1].toFixed(3)]; };
const L = (p) => W2L(p[0], p[1]);

/** move every road vertex at world point `from` to `to` (a shared node moves in every way that has it: the walk
 *  graph and the junctions keep their topology) -> how many vertices moved */
function moveNode(map, from, to) {
  let n = 0;
  for (const r of map.roads || []) if (r.pts) for (let i = 0; i < r.pts.length; i++) if (near(r.pts[i], from)) { r.pts[i] = to.slice(); n++; }
  return n;
}
/** move the vertices of a building / barrier ring that lie in a LOCAL box onto a new u (or through fn(u, v) -> [u, v]) */
function moveVerts(list, id, box, fn) {
  const it = list.find((x) => x.id === id); if (!it) return 0;
  const P = it.poly || it.pts; let n = 0;
  for (let i = 0; i < P.length; i++) { const l = L(P[i]); if (l[0] >= box[0] && l[0] <= box[2] && l[1] >= box[1] && l[1] <= box[3]) { const q = fn(l[0], l[1]); P[i] = W(q[0], q[1]); n++; } }
  if (n && it.poly && it.c) it.c = [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
  return n;
}

// Turl Street: the section along the college (u of the centre line at v, carriageway, pavement)
export const TURL = {
  kerbE: -25.4,          // K: the survey's kerb at the gate
  jesusFace: -32.4,      // K: LIDAR (+- 0.3)
  south: { id: 'w110348415', w: 5.3, pw: 1.7, cu: -28.05 },        // faces -23.7 / -32.4
  north: { id: 'w27896352', w: 5.3, pw: 1.85, cu: -28.3 },         // faces -23.7 .. -24.0 / -32.7 .. -32.9 (the map's: LIDAR -32.6)
};
// Brasenose Lane: midline (u, v) and width of each length between the faces (the college's colliders, the map's opposite)
export const LANE = [
  { id: 'w4884545', pts: [[-20, 33.08], [-6.5, 33.38]], w: 5.3 },             // gap 5.6 .. 5.3
  { id: 'w1675518', pts: [[-6.5, 33.38], [6, 33.8], [18, 34.2]], w: 4.6 },     // gap 5.3 .. 4.2 (the Hall)
  { id: 'w1675518:b', pts: [[18, 34.2], [24, 34.08], [36, 36.2]], w: 4.9 },    // gap 4.6 .. 5.4
  { id: 'w1675518:c', pts: [[36, 36.2], [60, 40.19], [84, 43.78], [94.45, 44.48], [98.15, 44.35]], w: 6.6 },   // gap 5.4 .. 7.2
];

export function cityJoins(game) {
  const map = game.map, out = { moved: [] };
  if (!map || !map.roads) return out;
  const road = (id) => map.roads.find((r) => r.id === id);
  const log = (s) => out.moved.push(s);
  // ---- 2. Jesus College's Turl Street front onto u -32.4 (before the street: nothing else keys on these vertices)
  for (const id of ['w191369421', 'w301448619', 'w227803491', 'w301448613']) { const n = moveVerts(map.buildings || [], id, [-35.3, -7, -34.0, 34], (u, v) => [TURL.jesusFace, v]); if (n) log(`${id}: ${n} street-face vertices to u ${TURL.jesusFace}`); }
  { const n = moveVerts(map.barriers || [], 'w331385290', [-35.3, -27.5, -34.0, -5], (u, v) => [TURL.jesusFace, v]); if (n) log(`w331385290: ${n} vertices to u ${TURL.jesusFace}`); }
  // (the footway in from Jesus's gate starts at the old face: its node moves with the face, shared with the private
  //  path inside the college)
  moveNode(map, W(-34.60, 12.06), W(TURL.jesusFace, 12.06));
  // ---- 1. Turl Street
  { const T = TURL.south, r = road(T.id);
    if (r && r.pts && r.pts.length >= 5) {
      // interior nodes onto the section's centre line (each moved in every way that shares it); a node added at v 29.5
      // keeps the section to the college's south-west corner (the junction with Brasenose Lane, v 33.17, stays)
      for (const v of [12.12, 1.23]) { const i = r.pts.findIndex((p) => Math.abs(L(p)[1] - v) < 0.1); if (i > 0) moveNode(map, r.pts[i].slice(), W(T.cu, v)); }
      const j = r.pts.findIndex((p) => Math.abs(L(p)[1] - 33.17) < 0.1); if (j >= 0) r.pts.splice(j + 1, 0, W(T.cu, 29.5));
      r.w = T.w; r.pw = T.pw; r.laneFit = true; log(`${T.id}: centre u ${T.cu} (v 1.2 .. 29.5), w ${T.w}, pw ${T.pw}`);
    } }
  { const T = TURL.north, r = road(T.id);
    if (r && r.pts && r.pts.length >= 3) {
      // the Ship Street junction and the two nodes before Broad Street move onto the centre line (Ship Street's and the
      // Broad Street footway's shared nodes with them); the junction with Broad Street itself stays
      for (const v of [-28.94, -65.97, -67.21]) { const i = r.pts.findIndex((p) => Math.abs(L(p)[1] - v) < 0.1); if (i >= 0) moveNode(map, r.pts[i].slice(), W(T.cu, v)); }
      r.w = T.w; r.pw = T.pw; r.laneFit = true; log(`${T.id}: centre u ${T.cu}, w ${T.w}, pw ${T.pw}`);
    } }
  // ---- 3. the Convocation House's south face onto the survey / the garden's north edge: v = 8.18 + 0.0283 (u - 54.2)
  { const sv = (u) => 8.18 + 0.0283 * (u - 54.2);
    const n = moveVerts(map.buildings || [], 'w114575324', [53.5, 7.0, 64.6, 9.0], (u, v) => (u > 60 ? [u - 0.0609 * (sv(u) - v), sv(u)] : [u, sv(u)]));
    if (n) log(`w114575324 (Convocation House): ${n} south-face vertices onto v 8.17 .. 8.46`); }
  // ---- 4. Brasenose Lane down the middle, wall to wall
  { const A = road('w4884545'), B = road('w1675518');
    if (A && B && A.pts && B.pts && A.pts.length >= 2 && B.pts.length >= 2) {
      const turl = A.pts[0].slice(), square = B.pts[B.pts.length - 1].slice(), joint = B.pts[0].slice(), newJoint = W(LANE[0].pts[1][0], LANE[0].pts[1][1]);
      moveNode(map, joint, newJoint);
      A.pts = [turl, ...LANE[0].pts.slice(0, -1).map(([u, v]) => W(u, v)), newJoint]; A.w = LANE[0].w; A.laneFit = true;
      const proto = { ...B }; delete proto.pts;
      B.pts = LANE[1].pts.map(([u, v], i) => (i === 0 ? newJoint : W(u, v))); B.w = LANE[1].w; B.pw = 0; B.laneFit = true;
      const at = map.roads.indexOf(B);
      const more = LANE.slice(2).map((s) => ({ ...proto, id: s.id, pts: s.pts.map(([u, v]) => W(u, v)), w: s.w, pw: 0, laneFit: true }));
      // (the end at Radcliffe Square keeps the map's node: the square's way joins there)
      const last = more[more.length - 1]; last.pts[last.pts.length - 1] = square;
      map.roads.splice(at + 1, 0, ...more);
      log(`Brasenose Lane: w4884545 + w1675518 redrawn as ${LANE.length} lengths down the middle, w ${LANE.map((s) => s.w).join(' / ')}`);
    } }
  // ---- 5. what the city stands in Margary Quad: the map's cycle parking (n13034659647, 2.5 m from the statue in the
  // middle of the setts) is not stood (part 'margary' builds the college's stands where the survey and the satellite
  // view have them, along the Thomas Wood wing), and the map's car park (w1418427625, already not drawn) no longer parks
  // cars: systems/vehicles.js laid its rows over the whole quad (a van on the middle panels, a saloon half off the big
  // bay onto the flags), not in the surveyed bays, which are too small for its rows. The bays stand empty (no car of the
  // college's own: a flaw, listed in the hand-over)
  if (game.overrides) game.overrides.skip.add('n13034659647');
  { const a = (map.areas || []).find((x) => x.id === 'w1418427625'); if (a && a.kind === 'parking') { a.kind = 'parking:exeter'; log('w1418427625: no longer a car park for systems/vehicles.js'); } }
  return out;
}
