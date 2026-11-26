// Worcester Place and Richmond Road: the college's Victorian houses, hand-built (2026-11-22, third pass) from the
// September 2024 street views. Called by places/worcester_wplace.js (sources and K / G there).
//
//   17 | 18 and 21 | 22 Worcester Place: semi-detached pairs in buff stock brick with thin red bands, three storeys
//       over a basement: a two-storey canted bay and a brick gabled dormer to each house beside the party wall, the
//       door at the outer end up a flight of stone steps, one stack on the party wall, a red-brick wall to the footway.
//   23 Worcester Place: the low red-brick house at the end of the terrace: sashes under white flat arches, a white
//       door case.
//   16 and 17 Richmond Road: buff brick with red bands, each a gable to the street over a white canted bay, a paired
//       sash under a red arch and a sash in the gable; the door in a set-back bay at the side; a hedge behind a wall.
// Each is drawn in a FRONT FRAME: x along the front as seen from the street (left to right), y up, z out to the street.
import { frame, rectPts } from './_worcester_kit.js';
import { T, stack } from './_worcester_south_kit.js';
import { W, flatSash, segHead, gablePts, bay } from './_wplace_kit.js';

const BR = 'wpHB', RB = 'wpBandR', ST = 'stoneDress', WALL = 'wpN10o';
/** a front frame on the street frame: o = [u, v] the front's left end as seen from the street, d = [du, dv] along it */
const ff = (o, d) => ({ mat: () => frame(o[0], 0, -o[1], d[0], -d[1]), pt: (x, z) => W(o[0] + x * d[0] + z * d[1], o[1] + x * d[1] - z * d[0]) });

// ---- the plan: [u, v] of each front's left end, its direction, sizes (metres). Mass from the map outlines and the
// 2022 height survey; everything on the fronts scaled off the street views (GUESS to about 0.2 m).
export const HOUSES3 = {
  wp1718: { o: [18.8, 7.8], d: [1, 0], W: 10.6, D: 7.6, eaves: 9.0, ridge: 11.7, area: 2.4, wall0: 0.6 },      // (wall0: the footway wall begins clear of the mapped street lamp at its west end)
  wp2122: { o: [43.8, 8.0], d: [1, 0], W: 12.1, D: 7.9, eaves: 8.8, ridge: 11.6, area: 2.4, rails: true },
  wp23: { o: [55.9, 5.8], d: [1, 0], W: 4.6, D: 8.2, eaves: 6.3, ridge: 8.4 },
  // Richmond Road (the houses face north; world [x, z] of the main front's left end and of its right end)
  rr16: { a: [-378.2, -207.1], b: [-382.6, -206.9], We: 1.7, side: 1, sb: 1.1, D: 8.7, eaves: 9.2, apex: 13.2, area: 2.6 },
  rr17: { a: [-387.9, -206.7], b: [-392.1, -206.4], We: 1.0, side: -1, sb: 1.0, D: 8.6, eaves: 9.2, apex: 12.8, area: 2.6 },
};

/** a sash in a reveal with a stone sill and a lintel (current face frame) */
function sash(B, wall, x0, y0, x1, y1, f, o = {}) {
  const r = rectPts(x0, y0, x1, y1);
  B.reveal(wall, r, 0, -0.1); B.unit('sash', r, -0.09, bay(f));
  if (o.lintel !== false) B.poly(o.lintel || ST, [[x0 - 0.1, y1, 0.022], [x1 + 0.1, y1, 0.022], [x1 + 0.1, y1 + (o.lh || 0.2), 0.022], [x0 - 0.1, y1 + (o.lh || 0.2), 0.022]], [0, 0, 1]);
  B.box(o.sill || ST, (x0 + x1) / 2, y0 - 0.05, 0.05, x1 - x0 + 0.2, 0.09, 0.1, 0, { bottom: true });
}
/** a canted bay standing out of the face: o = { fw, hw, d, top, rise, stages: [[y0, y1, floor]], wall, y0, base, lintel } */
function cantedBay(B, c, o) {
  const cw = Math.hypot(o.hw - o.fw, o.d), y0 = o.y0 || 0;
  for (const [M, w, ww] of [[frame(c - o.fw, 0, o.d, 1, 0), 2 * o.fw, 2 * o.fw - 0.5], [frame(c - o.hw, 0, 0, o.hw - o.fw, o.d), cw, cw - 0.38], [frame(c + o.fw, 0, o.d, o.hw - o.fw, -o.d), cw, cw - 0.38]]) {
    B.push(M);
    const holes = o.stages.map(([a, b]) => rectPts(w / 2 - ww / 2, a, w / 2 + ww / 2, b));
    if (y0) B.face(o.base, rectPts(0, 0, w, y0));
    B.face(o.wall, rectPts(0, y0, w, o.top), holes);
    o.stages.forEach(([a, b, f], i) => sash(B, o.wall, holes[i][0][0], a, holes[i][2][0], b, f, { lintel: o.lintel }));
    B.pop();
  }
  const e = 0.1, ye = o.top, yt = o.top + o.rise, xa = c - o.fw, xb = c + o.fw, a = c - o.hw, b = c + o.hw;
  B.poly('slate', [[xa - e / 2, ye, o.d + e], [xb + e / 2, ye, o.d + e], [xb, yt, 0.02], [xa, yt, 0.02]], [0, 1, 1]);
  B.poly('slate', [[a - e, ye, 0.02], [xa - e / 2, ye, o.d + e], [xa, yt, 0.02]], [-1, 1, 1]); B.poly('slate', [[xb + e / 2, ye, o.d + e], [b + e, ye, 0.02], [xb, yt, 0.02]], [1, 1, 1]);
  for (const [p, q, n] of [[[a - e, 0.02], [xa - e / 2, o.d + e], [-1, 0, 1]], [[xa - e / 2, o.d + e], [xb + e / 2, o.d + e], [0, 0, 1]], [[xb + e / 2, o.d + e], [b + e, 0.02], [1, 0, 1]]]) B.poly('wpDark', [[p[0], ye - 0.1, p[1]], [q[0], ye - 0.1, q[1]], [q[0], ye, q[1]], [p[0], ye, p[1]]], n);
}
/** a flight of stone steps down from a door at height f, out from the face at z0: n treads, hw half width; cheeks in `cheek` */
function flight(B, c, f, z0, o = {}) {
  const n = o.n || 6, go = o.go || 0.3, hw = o.hw || 0.6, r = f / n;
  for (let i = 0; i < n; i++) B.boxXZ(ST, c - hw, c + hw, 0, f - i * r - (i ? 0 : 0.004), z0 + i * go + (i ? 0 : 0.004), z0 + (i + 1) * go);
  for (const s of [-1, 1]) {
    const x0 = c + s * hw, x1 = x0 + s * 0.2, L = n * go;
    B.poly(o.cheek || BR, [[x1, 0, z0 + 0.004], [x1, 0, z0 + L], [x1, 0.35, z0 + L], [x1, f + 0.35, z0 + 0.004]], [s, 0, 0]);
    B.poly(o.cheek || BR, [[x0, 0, z0 + 0.004], [x0, 0, z0 + L], [x0, 0.35, z0 + L], [x0, f + 0.35, z0 + 0.004]], [-s, 0, 0]);
    B.poly(ST, [[Math.min(x0, x1), f + 0.35, z0 + 0.004], [Math.max(x0, x1), f + 0.35, z0 + 0.004], [Math.max(x0, x1), 0.35, z0 + L], [Math.min(x0, x1), 0.35, z0 + L]], [0, 1, 1]);
    B.poly(o.cheek || BR, [[Math.min(x0, x1), 0, z0 + L], [Math.max(x0, x1), 0, z0 + L], [Math.max(x0, x1), 0.35, z0 + L], [Math.min(x0, x1), 0.35, z0 + L]], [0, 0, 1]);
    if (o.rails) { const xr = (x0 + x1) / 2; B.beam('iron', [xr, f + 1.25, z0 + 0.1], [xr, 1.25, z0 + L - 0.05], 0.035); for (const t of [0.05, 0.5, 0.97]) B.boxXZ('iron', xr - 0.015, xr + 0.015, f * (1 - t) + 0.35, f * (1 - t) + 1.25, z0 + 0.1 + (L - 0.15) * t - 0.015, z0 + 0.1 + (L - 0.15) * t + 0.015, { top: false }); }
  }
  return n * go;
}
/** a low wall along the footway at z = za from x0 to x1, broken at `gaps` = [[a, b]] */
function frontWall(B, za, x0, x1, gaps, h = 0.95, key = WALL) {
  const runs = []; let a = x0;
  for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) { if (g0 > a + 0.05) runs.push([a, g0]); a = Math.max(a, g1); }
  if (x1 > a + 0.05) runs.push([a, x1]);
  for (const [p, q] of runs) { B.boxXZ(key, p, q, 0, h - 0.06, za - 0.11, za + 0.11, { top: false }); B.boxXZ(ST, p, q, h - 0.06, h, za - 0.13, za + 0.13, { bottom: true }); }
  return runs;
}
/** red brick bands across a face: thin strips laid on it */
const bands = (B, x0, x1, ys, h = 0.11) => { for (const y of ys) B.poly(RB, [[x0, y, 0.012], [x1, y, 0.012], [x1, y + h, 0.012], [x0, y + h, 0.012]], [0, 0, 1]); };

// =================================================================== a Worcester Place pair
export function buildPair(game, B, P) {
  const col = game.worldCollider, F = ff(P.o, P.d), k = P.eaves / 8.95, h = P.W / 2, e = P.eaves, tp = (P.ridge - e) / (P.D / 2);
  const lv = { b: [0.35 * k, 1.35 * k], f: 1.7 * k, g: [2.9 * k, 5.1 * k], bt: 5.25 * k, f1: [6.15 * k, 7.95 * k] }, R = (x0, x1, z0, z1) => col.addPolygon([F.pt(x0, z0), F.pt(x1, z0), F.pt(x1, z1), F.pt(x0, z1)], { tag: 'building' });
  B.push(F.mat());
  const holes = [], doors = [], bays = [];
  for (const s of [-1, 1]) {
    const cB = h + s * 1.85, cD = h + s * (h - 0.85);
    bays.push(cB); doors.push(cD);
    holes.push(rectPts(cB - 1.05, lv.f1[0], cB - 0.15, lv.f1[1]), rectPts(cB + 0.15, lv.f1[0], cB + 1.05, lv.f1[1]), rectPts(cD - 0.5, lv.f, cD + 0.5, lv.f + 2.55));
  }
  B.face(BR, rectPts(0, 0, P.W, e), holes);
  bands(B, 0, P.W, [1.5 * k, 2.72 * k, 5.95 * k, 8.05 * k, e - 0.45]);
  B.boxXZ(ST, -0.05, P.W + 0.05, e - 0.16, e, 0.004, 0.12, { bottom: true });      // the eaves course
  for (const [i, s] of [-1, 1].entries()) {
    const cB = bays[i], cD = doors[i];
    sash(B, BR, cB - 1.05, lv.f1[0], cB - 0.15, lv.f1[1], 1); sash(B, BR, cB + 0.15, lv.f1[0], cB + 1.05, lv.f1[1], 1);
    // the door in its stone case, a light over it
    B.reveal(ST, rectPts(cD - 0.5, lv.f, cD + 0.5, lv.f + 2.55), 0, -0.3, true);
    B.unit('doorDark', rectPts(cD - 0.5, lv.f, cD + 0.5, lv.f + 2.05), -0.29); B.poly('glassDark', [[cD - 0.5, lv.f + 2.05, -0.29], [cD + 0.5, lv.f + 2.05, -0.29], [cD + 0.5, lv.f + 2.55, -0.29], [cD - 0.5, lv.f + 2.55, -0.29]], [0, 0, 1]);
    B.face(ST, rectPts(cD - 0.68, lv.f, cD + 0.68, lv.f + 2.75), [rectPts(cD - 0.5, lv.f, cD + 0.5, lv.f + 2.55)], 0.022);
    cantedBay(B, cB, { fw: 0.8, hw: 1.4, d: 0.75, top: lv.bt, rise: 0.75 * k, stages: [[lv.b[0], lv.b[1], 0], [lv.g[0], lv.g[1], 0]], wall: BR });
    // the brick gabled dormer over the bay, set a little behind the eaves
    { const zf = -0.3, yb = e + 0.3 * tp - 0.05, ys = e + 1.15, ya = e + 2.4, hw = 1.15, zs = zf - (ys - yb) / tp, zr = zf - (ya - yb) / tp;
      B.face(BR, [[cB - hw, yb], [cB + hw, yb], [cB + hw, ys], [cB, ya], [cB - hw, ys]], [rectPts(cB - 0.5, e + 0.35, cB + 0.5, e + 1.45)], zf);
      B.push(T(0, 0, zf)); sash(B, BR, cB - 0.5, e + 0.35, cB + 0.5, e + 1.45, 3); B.pop();
      for (const q of [-1, 1]) {
        B.poly(BR, [[cB + q * hw, yb, zf], [cB + q * hw, ys, zf], [cB + q * hw, ys, zs]], [q, 0, 0]);
        B.poly('slate', [[cB + q * (hw + 0.14), ys - 0.14, zf + 0.14], [cB, ya + 0.04, zf + 0.14], [cB, ya + 0.04, zr], [cB + q * (hw + 0.14), ys - 0.14, zs - 0.1]], [q, 1, 0]);
        B.poly('wpDark', [[cB + q * (hw + 0.14), ys - 0.28, zf + 0.14], [cB, ya - 0.1, zf + 0.14], [cB, ya + 0.04, zf + 0.14], [cB + q * (hw + 0.14), ys - 0.14, zf + 0.14]], [0, 0, 1]);
      } }
    const L = flight(B, cD, lv.f, 0, { rails: P.rails });
    R(cB - 1.4, cB + 1.4, 0, 0.75); R(cD - 0.8, cD + 0.8, 0, L);
    void s;
  }
  // the red-brick wall along the footway, open at the two flights
  for (const [p, q] of frontWall(B, P.area, P.wall0 || 0, P.W, doors.map((c) => [c - 0.6, c + 0.6]))) { const a = F.pt(p, P.area), b = F.pt(q, P.area); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'wall', low: true }); }
  // the sides (gables), the back (GUESS: its windows), the slate roof, the stack on the party wall
  for (const M of [frame(0, 0, -P.D, 0, 1), frame(P.W, 0, 0, 0, -1)]) { B.push(M); B.face(BR, gablePts(0, P.D, e, P.ridge)); B.pop(); }
  B.push(frame(P.W, 0, -P.D, -1, 0)); B.face(BR, rectPts(0, 0, P.W, e)); for (const c of [h - 3.6, h - 1.3, h + 1.3, h + 3.6]) for (const [y0, y1, f] of [[lv.g[0], lv.g[1], 0], [lv.f1[0], lv.f1[1], 1]]) flatSash(B, c - 0.5, y0, c + 0.5, y1, f); B.pop();
  { const ov = 0.3, ye = e - ov * tp;
    B.poly('slate', [[-0.12, ye, ov], [P.W + 0.12, ye, ov], [P.W + 0.12, P.ridge, -P.D / 2], [-0.12, P.ridge, -P.D / 2]], [0, 1, 1]);
    B.poly('slate', [[P.W + 0.12, ye, -P.D - ov], [-0.12, ye, -P.D - ov], [-0.12, P.ridge, -P.D / 2], [P.W + 0.12, P.ridge, -P.D / 2]], [0, 1, -1]);
    B.boxXZ('wpDark', -0.12, P.W + 0.12, ye - 0.14, ye - 0.004, 0.13, ov + 0.02, { bottom: true, top: false }); }
  B.push(T(h, 0, -P.D / 2 + 1.3)); stack(B, 0, 0, 1.2, 0.6, P.ridge - 1.4, P.ridge + 1.1, 4, BR); B.pop();
  B.pop();
  R(0, P.W, -P.D, 0);
}

// =================================================================== 23 Worcester Place
export function buildNo23(game, B, P) {
  const col = game.worldCollider, F = ff(P.o, P.d), e = P.eaves, tp = (P.ridge - e) / (P.D / 2), K = 'wpR23', f = 0.55;
  B.push(F.mat());
  const wins = [[0.85, f + 1.0, 1.8, f + 2.75, 0], [0.85, 4.2, 1.8, 5.75, 1]], door = rectPts(2.95, f, 3.85, f + 2.1);
  B.face(K, rectPts(0, 0, P.W, e), [...wins.map((w) => rectPts(w[0], w[1], w[2], w[3])), door]);
  for (const w of wins) {
    sash(B, K, w[0], w[1], w[2], w[3], w[4], { lintel: false, sill: 'white' });
    B.poly('white', [[w[0] - 0.05, w[3], 0.014], [w[2] + 0.05, w[3], 0.014], [w[2] + 0.2, w[3] + 0.3, 0.014], [w[0] - 0.2, w[3] + 0.3, 0.014]], [0, 0, 1]);      // the white flat arch
  }
  B.reveal('white', door, 0, -0.14, true); B.unit('wpDoorW', door, -0.13);
  B.face('white', rectPts(2.77, f, 4.03, f + 2.32), [door], 0.016);      // the white door case
  B.poly('dark', [[0.95, 0.12, 0.012], [1.7, 0.12, 0.012], [1.7, 0.5, 0.012], [0.95, 0.5, 0.012]], [0, 0, 1]);      // the basement grille
  for (let i = 0; i < 3; i++) B.boxXZ(ST, 2.85, 3.95, 0, f - i * (f / 3) - (i ? 0 : 0.004), i * 0.28 + 0.004, (i + 1) * 0.28);
  B.push(frame(0, 0, -P.D, 0, 1)); B.face(K, gablePts(0, P.D, e, P.ridge)); B.pop();
  B.push(frame(P.W, 0, -P.D, -1, 0)); B.face(K, rectPts(0, 0, P.W, e)); flatSash(B, 1.4, 1.5, 2.4, 3.1, 0); flatSash(B, 1.4, 4.2, 2.4, 5.6, 1); B.pop();
  { const ov = 0.25, ye = e - ov * tp;
    B.poly('slate', [[-0.1, ye, ov], [P.W, ye, ov], [P.W, P.ridge, -P.D / 2], [-0.1, P.ridge, -P.D / 2]], [0, 1, 1]);
    B.poly('slate', [[P.W, ye, -P.D - ov], [-0.1, ye, -P.D - ov], [-0.1, P.ridge, -P.D / 2], [P.W, P.ridge, -P.D / 2]], [0, 1, -1]);
    B.boxXZ('wpDark', -0.1, P.W, ye - 0.13, ye - 0.004, 0.1, ov + 0.02, { bottom: true, top: false }); }
  B.pop();
  col.addPolygon([F.pt(0, 0), F.pt(P.W, 0), F.pt(P.W, -P.D), F.pt(0, -P.D)], { tag: 'building' });
  col.addPolygon([F.pt(2.85, 0), F.pt(3.95, 0), F.pt(3.95, 0.84), F.pt(2.85, 0.84)], { tag: 'building' });
}

// =================================================================== a Richmond Road house
export function buildGabled(game, B, P, UVf) {
  const col = game.worldCollider, a = UVf(P.a[0], P.a[1]), b = UVf(P.b[0], P.b[1]), Wm = Math.hypot(b[0] - a[0], b[1] - a[1]), F = ff(a, [(b[0] - a[0]) / Wm, (b[1] - a[1]) / Wm]);
  const e = P.eaves, c = Wm / 2, tp = (P.apex - e) / c, f = 1.6, xa = P.side > 0 ? Wm : -P.We, xb = P.side > 0 ? Wm + P.We : 0, xo = P.side > 0 ? xb : xa, eL = e - 0.9;
  B.push(F.mat());
  // the gabled front: a paired sash in a white surround under a red arch, a sash in the gable, red bands
  { const p1 = [rectPts(c - 0.95, 5.9, c - 0.06, 7.6), rectPts(c + 0.06, 5.9, c + 0.95, 7.6)], g = rectPts(c - 0.45, e + 0.25, c + 0.45, e + 1.75);
    B.face(BR, gablePts(0, Wm, e, P.apex), [...p1, g]);
    for (const r of [...p1, g]) { B.reveal('white', r, 0, -0.1); B.unit('sash', r, -0.09, bay(r === g ? 3 : 1)); }
    B.face('white', rectPts(c - 1.12, 5.76, c + 1.12, 7.8), p1, 0.016); B.face('white', rectPts(c - 0.6, e + 0.11, c + 0.6, e + 1.93), [g], 0.016);
    segHead(B, RB, c - 1.12, c + 1.12, 7.84, 0.22, 0.24); bands(B, 0, Wm, [2.35, 5.4, 8.5]);
    for (const y of [e - 0.06, e + 2.1]) { const hw = (P.apex - y - 0.11) / tp - 0.02; bands(B, c - hw, c + hw, [y]); }      // (in the gable: cut to its slopes)
    for (const s of [-1, 1]) { const xe = c + s * (c + 0.22), y = e - 0.22 * tp; B.poly('wpDark', [[xe, y - 0.18, 0.2], [c, P.apex - 0.18, 0.2], [c, P.apex, 0.2], [xe, y, 0.2]], [0, 0, 1]); }
    cantedBay(B, c, { fw: 0.85, hw: 1.5, d: 0.8, y0: 2.3, base: BR, wall: 'white', top: 4.9, rise: 0.7, stages: [[2.7, 4.6, 0]], lintel: false }); }
  // the set-back entrance bay at the side: the door up its steps, a small window over it, a lean-to roof
  B.push(T(0, 0, -P.sb));
  { const cD = (xa + xb) / 2, dw = Math.min(0.45, P.We / 2 - 0.08), door = rectPts(cD - dw, f, cD + dw, f + 2.1), wn = rectPts(cD - dw + 0.1, 5.9, cD + dw - 0.1, 7.1), yi = P.side > 0 ? [e, eL] : [eL, e];
    B.face(BR, [[xa, 0], [xb, 0], [xb, yi[1]], [xa, yi[0]]], [door, wn]);
    B.reveal(ST, door, 0, -0.15, true); B.unit('doorDark', door, -0.14); B.reveal('white', wn, 0, -0.1); B.unit('sash', wn, -0.09, bay(1));
    B.poly(ST, [[cD - dw - 0.1, f + 2.1, 0.014], [cD + dw + 0.1, f + 2.1, 0.014], [cD + dw + 0.1, f + 2.32, 0.014], [cD - dw - 0.1, f + 2.32, 0.014]], [0, 0, 1]);
    const L = flight(B, cD, f, 0, { hw: dw + 0.1, n: 6 });
    col.addPolygon([F.pt(cD - dw - 0.3, -P.sb), F.pt(cD + dw + 0.3, -P.sb), F.pt(cD + dw + 0.3, -P.sb + L), F.pt(cD - dw - 0.3, -P.sb + L)], { tag: 'building' }); }
  B.pop();
  { const xm = P.side > 0 ? Wm : 0, s = P.side;      // the main block's cheek beside the entrance bay, the bay's outer wall and roof
    B.poly(BR, [[xm, 0, 0], [xm, 0, -P.sb], [xm, e, -P.sb], [xm, e, 0]], [s, 0, 0]);
    B.poly(BR, [[xo, 0, -P.sb], [xo, 0, -P.D], [xo, eL, -P.D], [xo, eL, -P.sb]], [s, 0, 0]);
    B.poly('slate', [[xm, e, -P.sb + 0.15], [xo + s * 0.15, eL - 0.1, -P.sb + 0.15], [xo + s * 0.15, eL - 0.1, -P.D], [xm, e, -P.D]], [s, 1, 0]); }
  // the other side (against the neighbour), the back (GUESS), the roof with its ridge running back from the street, a stack
  { const xp = P.side > 0 ? 0 : Wm;
    B.poly(BR, [[xp, 0, 0], [xp, 0, -P.D], [xp, e, -P.D], [xp, e, 0]], [-P.side, 0, 0]);
    B.push(frame(Math.max(xb, Wm), 0, -P.D, -1, 0));
    { const x0 = P.side > 0 ? P.We : 0, wt = Wm + P.We; B.face(BR, P.side > 0 ? [[0, 0], [wt, 0], [wt, e], [x0 + c, P.apex], [x0, e], [0, eL]] : [[0, 0], [wt, 0], [wt, eL], [Wm, e], [c, P.apex], [0, e]]);
      for (const [y0, y1, fl] of [[2.7, 4.5, 0], [5.9, 7.6, 1]]) flatSash(B, x0 + c - 0.5, y0, x0 + c + 0.5, y1, fl); }
    B.pop();
    const ov = 0.22, ye = e - ov * tp;
    B.poly('slate', [[-ov, ye, 0.2], [-ov, ye, -P.D - 0.15], [c, P.apex, -P.D - 0.15], [c, P.apex, 0.2]], [-1, 1, 0]);
    B.poly('slate', [[Wm + ov, ye, -P.D - 0.15], [Wm + ov, ye, 0.2], [c, P.apex, 0.2], [c, P.apex, -P.D - 0.15]], [1, 1, 0]);
    B.push(T(xp + (P.side > 0 ? 0.45 : -0.45), 0, -P.D * 0.3)); stack(B, 0, 0, 0.6, 1.1, e + 0.2, P.apex + 0.9, 2, BR); B.pop(); }
  // the hedged front: a low red wall along the footway, the hedge behind it, open before the steps
  { const cD = (xa + xb) / 2, x0 = Math.min(xa, 0), x1 = Math.max(xb, Wm);
    for (const [p, q] of frontWall(B, P.area, x0, x1, [[cD - 0.6, cD + 0.6]], 0.8)) { B.boxXZ('leafC', p + 0.1, q - 0.1, 0, 1.5, P.area - 0.75, P.area - 0.14); const u = F.pt(p, P.area), v = F.pt(q, P.area); col.addSegment(u[0], u[1], v[0], v[1], { tag: 'wall', low: true }); } }
  B.pop();
  col.addPolygon([F.pt(0, 0), F.pt(Wm, 0), F.pt(Wm, -P.D), F.pt(0, -P.D)], { tag: 'building' });
  col.addPolygon([F.pt(xa, -P.sb), F.pt(xb, -P.sb), F.pt(xb, -P.D), F.pt(xa, -P.D)], { tag: 'building' });
  col.addPolygon([F.pt(c - 1.5, 0), F.pt(c + 1.5, 0), F.pt(c + 1.5, 0.8), F.pt(c - 1.5, 0.8)], { tag: 'building' });
  return { F, Wm };
}
/** world rings of what is built, for the terrain and for clearing generated trees */
export function houseRings(UVf) {
  const out = {}, H = HOUSES3;
  for (const k of ['wp1718', 'wp2122', 'wp23']) { const P = H[k], F = ff(P.o, P.d), za = P.area || 0.9; out[k] = [F.pt(0, za), F.pt(P.W, za), F.pt(P.W, -P.D), F.pt(0, -P.D)]; }
  for (const k of ['rr16', 'rr17']) { const P = H[k], a = UVf(P.a[0], P.a[1]), b = UVf(P.b[0], P.b[1]), Wm = Math.hypot(b[0] - a[0], b[1] - a[1]), F = ff(a, [(b[0] - a[0]) / Wm, (b[1] - a[1]) / Wm]), x0 = P.side > 0 ? 0 : -P.We, x1 = P.side > 0 ? Wm + P.We : Wm; out[k] = [F.pt(x0, P.area), F.pt(x1, P.area), F.pt(x1, -P.D), F.pt(x0, -P.D)]; }
  return out;
}
