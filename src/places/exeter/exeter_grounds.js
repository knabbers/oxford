// Exeter College, STANDALONE model: the ground the buildings stand on.
//   * the FRONT QUAD in full: flagged paving on its surveyed plane (it falls 0.47 m from the south-west corner to the
//     north-east), the lawn inside a low stone kerb, drain grids, benches;
//   * under everything else an earth sheet a little below each court's surveyed level. Margary Quad's ground is part
//     'margary', the Fellows' Garden and the Mound part 'garden', the Rector's Garden part 'rector'.
// Research: docs/research/exeter_survey.md sections 2, G01; levels: the 1:500 topographic survey in the Library's tree
// report (planning 21/00354/FUL; reference/exeter/20 planning drawings/DIMENSIONS.md) and LIDAR 2022.
import * as THREE from 'three';
import { SITE_RING } from './_exeter_shared.js';

// The Front Quad's paving as ONE plane through the surveyed spot levels (datum 64.40): 64.61 at the south-west corner
// (-15, 20), 64.14 at the north-east (18, -19), 64.54 at the gate and by the Hall, 64.22 by the east range.
export const quadY = (u, v) => -0.025 - 0.0071 * u + 0.006 * v;
// THE REGISTRATION (2026-11-23, the Front Quad registration pass). The 1:500 topographic survey (Tim Moya Associates,
// drg 210239-P-10, Feb 2021, p20 of the Library's tree report, planning 21/00354/FUL; the 400 dpi render, 31.5 px a metre,
// its scale bar checked: 20 m = 630 px) was measured by fitting lines to its dark pixels (scripts kept outside the repo)
// and registered to this frame by a RIGID fit (scale fixed, rotation held at 0: the frame is square to the lawn and the
// Library's 2.9 deg on the survey against LIDAR's 2.8 deg agrees) to 31 wall lines of the model: survey -> LOCAL is
// u = u_s + 1.287, v = v_s + 0.822 (u_s, v_s on axes turned 17.07 deg from the drawing's grid, origin the lawn kerb's
// middle). 18 walls agree to 0.21 m rms (the east range's two faces, the Chapel's south and north walls and apse, the
// south range, Palmer's Tower's north face, the Library's west and east gables, Margary Quad's three faces); the west
// range's quad face (-0.75 .. -0.96), the gate tower's street face (+0.69), the Hall's north face (+0.56 .. +1.07),
// Palmer's Tower's east face (-2.0) and the Library's long faces (-0.6) are off by more than 0.5 m and the survey wins
// for them (the west range is moved by part 'west'; the others are reported, not changed here).
export const FQ = {
  u0: -16.6, u1: 18.9, v0: -19.3, v1: 22.0,          // the court between the ranges' faces (the parts' walls stand on it): the west range's quad face is at -16.15 (survey), the east range's slants 18.2 (v -17) .. 18.9 (v 16)
  // the lawn's KERB, centre line: u -11.67 .. 14.25 (25.92), v -13.20 .. 14.84 (28.04). K: the topographic survey (the
  // kerb drawn as two lines 0.32 m apart: outside 26.23 x 28.36, grass 25.59 x 27.72; corners square to 0.1 m). Was
  // -13 .. 13 x -14 .. 14 (centred on the court): the lawn sits 1.3 m east and 0.8 m south of that.
  lawn: { u0: -11.67, u1: 14.25, v0: -13.2, v1: 14.84 },
  kerbW: 0.32, kerbH: 0.07,                          // width K (survey); height G
};
// THE COURT'S EDGE (joins pass, 2026-11-23): the paving is laid only inside the walls' feet as the parts now stand on the
// survey (none inside a building, where the Hall's and the Chapel's see-through windows and the doors would show it), so
// it is one polygon round the lawn, not a rectangle. Each point's source (all LOCAL):
//   north: the Chapel's paving strip takes over north of v -19.3 (_exeter_chapel_build.js); east of the apse the foot of
//     Palmer's Tower's south face (16.81, -18.66) .. (17.75, -18.57) and the slot's archway wall (u 17.75) (_exeter_east_plan.js WAY);
//   east: the east range's slanting quad face u = 18.539 + 0.0218 (v - 1.25), 18.14 at its north end (v -17.17) to 18.96 at
//     v 20.7 where the Hall's oriel stands against it (_exeter_east_plan.js R; survey);
//   south: the oriel's front (hall z 20.18), the Hall's skewed north face (hall z 21.10: LOCAL v = z + 0.066 (u - 9.25)),
//     round the undercroft's walled stair head (u 0.7 .. 2.9, front hall z 19.79) and the porch (u -3.85 .. -0.15, front
//     hall z 19.74 = LOCAL 19.0 at the door; its steps stand on the paving), the Hall's west gable u -4.55, the south
//     range's quad face v 22.2, the servery lobby (u -13.04, front 18.9) (_exeter_hall_plan.js HALL, PORCH, UC_STAIR, SR, LOBBY);
//   west: the west range's quad face -16.15 and the gate tower's -15.72 (v -0.7 .. 6.1), where the gate passage's own
//     floor begins (_exeter_west_plan.js).
const hallL = (u, z) => [u, z + 0.066 * (u - 9.25)];
const eastFace = (v) => 18.539 + 0.0218 * (v - 1.25);
export const UC_HOLE = { u0: 0.7, u1: 2.9, zF: 19.79, wallT: 0.15 };     // the undercroft stair head (hall plan UC_STAIR): no paving and no earth inside its walls
export const COURT = () => {
  const nf = (u) => hallL(u, 21.10), U = UC_HOLE;
  return [
    [-16.15, -19.3], [16.81, -19.3], [16.81, -18.66], [17.75, -18.57], [17.75, -17.17], [eastFace(-17.17), -17.17],
    [eastFace(-8), -8], [eastFace(4), 4], [eastFace(12), 12], [eastFace(20.7), 20.7],
    hallL(18.55, 20.18), hallL(15.2, 20.18), nf(14.7),
    nf(U.u1), hallL(U.u1, U.zF), hallL(U.u0, U.zF), nf(U.u0),
    nf(-0.15), hallL(-0.15, 19.74), hallL(-3.85, 19.74), nf(-3.85), nf(-4.55),
    [-4.55, 22.2], [-13.04, 22.2], [-13.04, 18.9], [-16.15, 18.9],
    [-16.15, 6.1], [-15.72, 6.1], [-15.72, -0.7], [-16.15, -0.7],
  ];
};
/** the stair head's inside (inside its low walls, to the Hall's wall face and through the wall's thickness) */
export const UC_INSIDE = () => { const U = UC_HOLE, t = U.wallT; return [hallL(U.u0 + t, U.zF + t), hallL(U.u1 - t, U.zF + t), hallL(U.u1 - t, 21.10 + 1.1), hallL(U.u0 + t, 21.10 + 1.1)]; };
/** a sheet over a plan ring (with holes) on y = f(u, v), facing up (UV metres / 3) */
function sheet(B, key, ring, holes, f) {
  const tris = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p[0], p[1])), holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1]))));
  const all = [...ring, ...holes.flat()];
  for (const t of tris) {
    const q = t.map((k) => [all[k][0], f(all[k][0], all[k][1]), all[k][1]]);
    const up = (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]), o = up > 0 ? [0, 1, 2] : [0, 2, 1];
    B.tri(key, q[o[0]], q[o[1]], q[o[2]], [q[o[0]][0] / 3, q[o[0]][2] / 3], [q[o[1]][0] / 3, q[o[1]][2] / 3], [q[o[2]][0] / 3, q[o[2]][2] / 3]);
  }
}
/** the part of a ring (u, v) inside the box u0..u1, v0..v1 (Sutherland - Hodgman: the box is convex, the ring need not be) */
function clipBox(ring, u0, v0, u1, v1) {
  let out = ring;
  for (const [k, lim, keepLess] of [[0, u1, true], [0, u0, false], [1, v1, true], [1, v0, false]]) {
    const inp = out; out = [];
    const ins = (p) => (keepLess ? p[k] <= lim : p[k] >= lim);
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], ia = ins(a), ib = ins(b);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (lim - a[k]) / (b[k] - a[k]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
  }
  return out;
}
/** benches [u, v, facing (ry), length]: survey rectangles (see CHECKED) */
export const BENCHES = [[-5.3, -17.15, 0, 1.25], [3.2, -17.0, 0, 1.6], [17.85, -6.6, -Math.PI / 2, 1.2], [18.1, 8.4, -Math.PI / 2, 1.2], [-15.72, 9.35, Math.PI / 2, 1.0]];
export const MARGARY_Y = -0.50, GARDEN_EARTH_Y = -0.40, RECTOR_EARTH_Y = -0.75;

export const CHECKED = [
  ['Front Quad paving: one plane 64.61 (SW) to 64.14 (NE)', 'K', 'topographic survey p20 of the tree report, planning 21/00354/FUL; LIDAR 2022'],
  ['Front Quad lawn kerb: centre line u -11.67 .. 14.25, v -13.20 .. 14.84 (25.9 x 28.0), 0.32 m wide; 1.3 m east and 0.8 m south of the court\'s middle', 'K', 'topographic survey 210239-P-10 (21/00354/FUL p20) fitted to 18 walls, rms 0.21 m (registration in this file); satellite by hand 2026-11-23 (paving 3.9 - 4.5 m wide between the lawn and the west range)'],
  ['York-stone flags laid right up to the walls; lawn striped inside a low kerb', 'K', '02 front quad general views/ (all); topographic survey "PAVING"; google photo sphere Jul 2016'],
  ['the paving\'s edge on the walls\' feet as the parts stand after the survey\'s registration (west -16.15 / tower -15.72, the Hall\'s skewed north face, porch, oriel and the undercroft stair head, the lobby, the east range\'s slanting face, Palmer\'s Tower); nothing paved inside a building', 'K', 'the parts\' plans (hall, east, west, chapel), all fitted to topographic survey 210239-P-10'],
  ['the undercroft stair head left open (no paving, no earth inside its walls); the flight down is part hall\'s', 'K', 'survey (the slot); 08/00644/LBC (a straight stair 1.9 m wide descending south)'],
  ['kerb 0.07 m high', 'G', 'seen as a low stone edge; height by eye'],
  ['four drain grids at the lawn corners (moved with the lawn)', 'G', 'PHOTO_NOTES: "drain grids"; number and places not readable (the survey marks only the kerb\'s corner and mid-side stones)'],
  ['benches: two before the Chapel (u -5.3 and 3.2, v -17.0), two against the east range (v -6.6 and 8.4), one against the west range south of the gate (v 9.35)', 'K', 'topographic survey: bench-sized rectangles in the paving at those places (2021)'],
  ['that those rectangles are benches, and their sizes', 'G', 'the survey draws outlines only; 04 chapel/ straight-on photo (2016) shows benches before the Chapel'],
];

export default {
  id: 'grounds', title: 'ground: Front Quad, earth under the site', replaces: [], CHECKED,
  build(ctx) {
    const { B, K } = ctx, L = FQ.lawn;
    const P = (u, v, dy = 0) => [u, quadY(u, v) + dy, v];
    // earth under the whole site, in three levels (convex pieces of the boundary would be simpler to read, but one
    // sheet per level with the others' areas simply lying higher is enough: nothing shows through a court's own floor)
    B.flat('soil', SITE_RING, RECTOR_EARTH_Y - 0.1, [UC_INSIDE()]);
    // (the merge, 2026-11-24: these two sheets were rectangles reaching up to 1 m past the boundary, under Turl Street's and
    //  Broad Street's pavements; where the city's pavement lies lower than a sheet it showed through it - a brown strip
    //  along the Turl front's foot, a dark patch before the Broad Street gate. They are cut to the site ring now)
    B.flat('soil', clipBox(SITE_RING, -30, -70, 23, -19), MARGARY_Y - 0.25);
    sheet(B, 'soil', clipBox(SITE_RING, -30, -19.3, 28.2, 31.2), [UC_INSIDE()], (u, v) => quadY(u, v) - 0.07);
    // (inside the boundary wall only: the lane and the square outside are lower than this sheet towards the east)
    B.flat('soil', [[26.8, -1], [54.6, -1], [54.01, 7.63], [64.25, 8.34], [64.8, -0.69], [88.79, 0.85], [88.2, 9.66], [94.86, 10.12], [94.35, 20.73], [97.0, 20.9], [95.8, 40.5], [83.98, 39.4], [44.5, 33.5], [26.8, 31.0]], GARDEN_EARTH_Y);
    // (Margary Quad's ground is part 'margary': 64.00 west to 63.78 east; only earth here, and a fall-back floor)
    ctx.floor([[-24.7, -64], [23, -64], [23, -19.3], [-24.7, -19.3]], MARGARY_Y);
    // the Front Quad: flags round the lawn on the plane, from wall foot to wall foot (COURT), the lawn a hole in them
    sheet(B, 'paving', COURT(), [[[L.u0, L.v0], [L.u1, L.v0], [L.u1, L.v1], [L.u0, L.v1]]], (u, v) => quadY(u, v) + 0.045);
    B.poly('lawn', [P(L.u0, L.v1, 0.06), P(L.u1, L.v1, 0.06), P(L.u1, L.v0, 0.06), P(L.u0, L.v0, 0.06)], [0, 1, 0], [[L.u0, L.v1], [L.u1, L.v1], [L.u1, L.v0], [L.u0, L.v0]].map(([a, b]) => [a / 3, b / 3]));
    // the kerb: four low stones on the plane (each sloped with it)
    const kerb = (a, b) => { const w = FQ.kerbW / 2, h = FQ.kerbH, du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv), nx = (-dv / l) * w, nz = (du / l) * w;
      const q = [[a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz]];
      B.poly('pavingSolid', q.map(([u, v]) => P(u, v, 0.045 + h)), [0, 1, 0]);
      for (let i = 0; i < 4; i++) { const p = q[i], r = q[(i + 1) % 4]; B.poly('pavingSolid', [P(p[0], p[1], 0.03), P(r[0], r[1], 0.03), P(r[0], r[1], 0.045 + h), P(p[0], p[1], 0.045 + h)], [r[1] - p[1], 0, -(r[0] - p[0])]); } };
    kerb([L.u0, L.v0], [L.u1, L.v0]); kerb([L.u1, L.v0], [L.u1, L.v1]); kerb([L.u1, L.v1], [L.u0, L.v1]); kerb([L.u0, L.v1], [L.u0, L.v0]);
    for (const [u, v] of [[L.u0 - 0.5, L.v0 - 0.5], [L.u1 + 0.5, L.v0 - 0.5], [L.u1 + 0.5, L.v1 + 0.5], [L.u0 - 0.5, L.v1 + 0.5]]) B.box('ironBlack', u, quadY(u, v) + 0.05, v, 0.4, 0.012, 0.4, 0, {});
    for (const [u, v, ry, len] of BENCHES) K.bench(B, u, v, quadY(u, v) + 0.045, ry, len);
    ctx.floor([[-24.7, -19.3], [28.2, -19.3], [28.2, 31.2], [-24.7, 31.2]], (u, v) => quadY(u, v) + 0.045);
  },
};
