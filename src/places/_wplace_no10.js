// Worcester Place, south side: No. 10 (map w304762197) with its yard at Nash Quad's east end (the steps to its back
// door, the raised beds, the cobbled circle round a young tree, two benches), the railed gap between it and
// Staircase 24, and the walls of the MCR's yard beside Gate 3. Called by places/worcester_wplace.js (K / G there).
import * as THREE from 'three';
import { rectPts } from './_worcester_kit.js';
import { win, T, stack, shrub } from './_worcester_south_kit.js';
import { W, P3, FW, FE, FS, FN, LV, pitched, gablePts, railings, pier, bay } from './_wplace_kit.js';

// ---- No. 10: the map's outline, but begun 1.5 m east of Staircase 24's gable (the map draws the two touching; the
// height survey and the planning drawings have a 1.2 - 1.5 m gap) and its east wall just outside the mapped boundary wall
export const N10 = { u0: 38.75, u1: 47.85, vF: -4.7, vR: -14.0, bays: 2.6, door: 4.77, rearWin: [1.7, 7.63], steps: { hw: 0.75, land: 1.0, go: 0.3, n: 4, cheek: 0.34 }, bed: 1.25 };
// ---- the cobbled circle [u, v] with its two benches [u, v, heading of the sitter (rad, 0 = facing south), length]
export const CIRCLE = { c: [45.3, -18.8], r: 1.7, rSett: 1.45, rIn: 0.8, benches: [[45.9, -16.5, 0, 2.0], [47.25, -19.0, -Math.PI / 2, 1.8]], tree: 3.6 };      // (4.8 m from the back wall: the satellite picture; and north of the strip Nash Quad clears of trees)
// ---- the gap's piers along the back of the pavement [u], and the MCR's yard (west and north walls high, south low)
export const GAP = { v: -4.92, piers: [37.3, 34.6], w: 0.45, back: 0.7, plinth: 0.55 };      // (street view 2024: one pier, a boarded gate set back beside No. 10, railings on a dark brick plinth)
export const YARD = { u0: -9.8, u1: -6.05, v0: -13.2, v1: -5.88, t: 0.24, door: [-8.45, -7.55] };
const KO = 'wpN10o', KN = 'wpN10n', L = LV.n10;
export const n10Ring = () => [[N10.u0, N10.vF], [N10.u1, N10.vF], [N10.u1, N10.vR], [N10.u0, N10.vR]];
/** the height of the steps to No. 10's back door at a point of the street frame, or null */
export function stepsY(u, v) {
  const S = N10.steps, c = N10.u0 + N10.door, d = N10.vR - v;
  if (Math.abs(u - c) > S.hw || d < 0 || d > S.land + (S.n - 1) * S.go) return null;
  return d <= S.land ? L.floor : L.floor - (L.floor / S.n) * (1 + Math.floor((d - S.land) / S.go));
}

export function buildNo10(game, B) {
  const col = game.worldCollider, len = N10.u1 - N10.u0, dep = N10.vF - N10.vR, vm = (N10.vF + N10.vR) / 2, tn = (L.ridge - L.eaves) / (dep / 2);
  const sashIn = (key, r, f) => { B.reveal('white', r, 0, -0.1); B.unit('sash', r, -0.09, bay(f)); B.box('stoneDress', (r[0][0] + r[2][0]) / 2, r[0][1] - 0.05, 0.05, r[2][0] - r[0][0] + 0.16, 0.08, 0.1, 0, { bottom: true }); void key; };
  // ---------------------------------------------------------------- the street front: three bays, the door in the middle
  B.push(FN(N10.u1, N10.vF));
  { const c = len / 2, holes = [], door = rectPts(c - 0.45, 0.05, c + 0.45, 2.5);
    const wins = []; for (const s of [-1, 1]) { wins.push([rectPts(c + s * N10.bays - 0.55, 0.8, c + s * N10.bays + 0.55, 2.58), 0]); }
    for (const s of [-1, 0, 1]) wins.push([rectPts(c + s * N10.bays - 0.465, L.f1, c + s * N10.bays + 0.465, L.f1 + 1.61), 1]);
    for (const w of wins) holes.push(w[0]); holes.push(door);
    B.face(KO, rectPts(0, 0, len, L.eaves), holes);
    for (const w of wins) sashIn(KO, w[0], w[1]);
    B.reveal('white', door, 0, -0.12, true); B.unit('doorDark', rectPts(c - 0.45, 0.05, c + 0.45, 2.08), -0.11); B.poly('glassDark', [[c - 0.45, 2.08, -0.11], [c + 0.45, 2.08, -0.11], [c + 0.45, 2.5, -0.11], [c - 0.45, 2.5, -0.11]], [0, 0, 1]);
    B.boxXZ(KO, 0, len, L.string - 0.06, L.string + 0.06, 0.004, 0.035, { bottom: true });      // the string course
    B.boxXZ(KO, 0, len, 0, L.plinth, 0.004, 0.03); }
  B.pop();
  // ---------------------------------------------------------------- the west gable (old brick): two windows near the back, a vent
  B.push(FW(N10.u0, N10.vF));
  { const wins = [[7.5, 1.0, 8.3, 2.2, 0], [7.5, 3.4, 8.3, 4.6, 1]];
    B.face(KO, gablePts(0, dep, L.eaves, L.ridge), wins.map((w) => rectPts(w[0], w[1], w[2], w[3])));
    for (const w of wins) win(B, w[0], w[1], w[2], w[3], { wall: KO, frame: 'white', cols: 2, rows: 3, depth: 0.09, floor: w[4], sill: 'stoneDress' });
    B.poly('terracotta', [[dep / 2 - 0.13, 6.75, 0.012], [dep / 2 + 0.13, 6.75, 0.012], [dep / 2 + 0.13, 7.0, 0.012], [dep / 2 - 0.13, 7.0, 0.012]], [0, 0, 1]); }
  B.pop();
  B.push(FE(N10.u1, N10.vR)); B.face(KO, gablePts(0, dep, L.eaves, L.ridge)); B.pop();
  // ---------------------------------------------------------------- the back: new brick, white casements, the white door up four steps
  B.push(FS(N10.u0, N10.vR));
  { const S = N10.steps, c = N10.door, f = L.floor, door = rectPts(c - 0.45, f, c + 0.45, f + 2.05), wins = [];
    for (const x of N10.rearWin) { wins.push([x - 0.75, f + 0.75, x + 0.75, f + 2.05, { cols: 3, rows: 2, floor: 0 }]); wins.push([x - 0.75, 4.45, x + 0.75, 5.45, { cols: 3, rows: 2, floor: 1 }]); }
    wins.push([c - 0.55, 4.1, c + 0.55, 5.45, { cols: 2, rows: 3, floor: 1 }]);
    B.face(KN, rectPts(0, 0, len, L.eaves), [...wins.map((w) => rectPts(w[0], w[1], w[2], w[3])), door]);
    for (const w of wins) win(B, w[0], w[1], w[2], w[3], { wall: KN, frame: 'white', depth: 0.09, bar: 0.05, sill: 'white', ...w[4] });
    B.reveal(KN, door, 0, -0.1, true); B.unit('wpDoorW', door, -0.09);
    B.box('lampGlass', c + 0.85, f + 1.75, 0.07, 0.3, 0.3, 0.14, 0, { bottom: true });                         // the bulkhead light
    B.poly('dark', [[c + 0.7, f + 1.05, 0.012], [c + 1.02, f + 1.05, 0.012], [c + 1.02, f + 1.27, 0.012], [c + 0.7, f + 1.27, 0.012]], [0, 0, 1]);      // the house's plate (no lettering)
    // the landing and three more treads between brick cheeks with steel handrails; a raised bed each side
    const rise = f / S.n, zf = S.land + (S.n - 1) * S.go;
    B.boxXZ('wpCheek', c - S.hw, c + S.hw, 0, f - 0.004, 0, S.land);
    for (let i = 1; i < S.n; i++) B.boxXZ('wpCheek', c - S.hw, c + S.hw, 0, f - rise * i, S.land + (i - 1) * S.go, S.land + i * S.go);
    for (const s of [-1, 1]) {
      const x0 = c + s * S.hw, x1 = x0 + s * S.cheek;
      B.boxXZ('wpCheek', Math.min(x0, x1), Math.max(x0, x1), 0, f + 0.38, 0.004, S.land + 0.25);
      B.boxXZ('wpCheek', Math.min(x0, x1), Math.max(x0, x1), 0, 0.78, S.land + 0.25, zf + 0.12);
      B.beam('alu', [x0 - s * 0.07, f + 0.92, 0.1], [x0 - s * 0.07, f + 0.92, S.land], 0.04); B.beam('alu', [x0 - s * 0.07, f + 0.92, S.land], [x0 - s * 0.07, 0.95, zf], 0.04);
      const [a, b] = s < 0 ? [0.004, x1] : [x1, len - 0.004];
      B.boxXZ('wpCheek', a, b, 0, 0.74, 0.004, N10.bed);
      B.boxXZ('wpLav', a + 0.22, b - 0.22, 0.74, 0.92, 0.24, N10.bed - 0.22);      // lavender (the photograph)
    } }
  B.pop();
  // ---------------------------------------------------------------- slate roof, one rooflight at the back, a stack at each end
  pitched(B, 'slate', false, N10.u0, N10.u1, N10.vR, N10.vF, L.eaves, L.ridge, { ov: 0.25, og: 0.06, fascia: 'wpDark' });
  B.poly('glassDark', [P3(N10.u0 + 3.9, L.ridge - 2.0 * tn + 0.05, vm - 2.0), P3(N10.u0 + 4.7, L.ridge - 2.0 * tn + 0.05, vm - 2.0), P3(N10.u0 + 4.7, L.ridge - 1.0 * tn + 0.05, vm - 1.0), P3(N10.u0 + 3.9, L.ridge - 1.0 * tn + 0.05, vm - 1.0)], [0, 1, 1]);
  for (const u of [N10.u0 + 0.33, N10.u1 - 0.33]) { B.push(T(u, 0, -vm)); stack(B, 0, 0, 0.6, 0.95, L.ridge - 0.7, L.stack, 2, KO); B.pop(); }

  // colliders: the house, the cheeks and beds (the steps themselves are walked: stepsY)
  col.addPolygon(n10Ring().map(([u, v]) => W(u, v)), { tag: 'building' });
  { const S = N10.steps, c = N10.u0 + N10.door, zf = S.land + (S.n - 1) * S.go + 0.12, R = (a, b, d) => col.addPolygon([W(a, N10.vR), W(b, N10.vR), W(b, N10.vR - d), W(a, N10.vR - d)], { tag: 'planter' });
    R(N10.u0, c - S.hw - S.cheek, N10.bed); R(c + S.hw + S.cheek, N10.u1, N10.bed); R(c - S.hw - S.cheek, c - S.hw, zf); R(c + S.hw, c + S.hw + S.cheek, zf); }
}

/** the cobbled circle in the yard behind No. 10: a ring of setts, cobbles rising a little to a planted middle, two benches */
export function buildCircle(game, B) {
  const col = game.worldCollider, C = CIRCLE, [cu, cv] = C.c, n = 20, y = LV.paving + 0.02, h = LV.circle.dome;
  const pt = (r, k, yy) => { const t = (k / n) * Math.PI * 2; return P3(cu + Math.cos(t) * r, yy, cv + Math.sin(t) * r); };
  for (let k = 0; k < n; k++) {
    B.poly('setts', [pt(C.r, k, y), pt(C.r, k + 1, y), pt(C.rSett, k + 1, y), pt(C.rSett, k, y)], [0, 1, 0]);
    B.poly('wpCobble', [pt(C.rSett, k, y), pt(C.rSett, k + 1, y), pt(C.rIn, k + 1, y + h), pt(C.rIn, k, y + h)], [0, 1, 0]);
    B.poly('wpCheek', [pt(C.rIn, k, y + h - 0.02), pt(C.rIn, k + 1, y + h - 0.02), pt(C.rIn - 0.08, k + 1, y + h + 0.03), pt(C.rIn - 0.08, k, y + h + 0.03)], [0, 1, 0]);      // a brick-on-edge kerb round the bed
  }
  B.poly('soil', Array.from({ length: n }, (_, k) => pt(C.rIn - 0.08, k, y + h + 0.02)), [0, 1, 0]);
  for (const [k, r, key] of [[1, 0.3, 'leafC'], [6, 0.26, 'leafA'], [11, 0.32, 'leafB'], [16, 0.24, 'leafC']]) { const q = pt(0.42, k, 0); shrub(B, key, q[0], q[2], r, 1.3, 6, y + h); }
  // the young tree: a thin stem and a light head (drawn here: a map tree's crown would hide the house from the circle)
  { const q = pt(0, 0, 0), y0 = y + h;
    B.cyl('oak', q[0], y0, q[2], 0.03, C.tree - 0.6, 5, false, 0.045);
    for (const [dx, dz, yy, r] of [[0, 0, C.tree - 0.75, 0.42], [0.28, 0.1, C.tree - 1.25, 0.3], [-0.22, 0.2, C.tree - 1.45, 0.27], [-0.05, -0.3, C.tree - 1.1, 0.3]]) shrub(B, 'leafB', q[0] + dx, q[2] + dz, r, 1.15, 6, yy); }
  col.addCircle(...W(cu, cv), C.rIn - 0.1, { tag: 'planter', low: true });
  // the benches: slats of oiled timber on grey metal ends, a seat and a raked back
  const seats = [];
  for (const [u, v, hd, l] of C.benches) {
    B.push(new THREE.Matrix4().makeTranslation(u, 0, -v).multiply(new THREE.Matrix4().makeRotationY(hd)));      // local: x along the bench, +z = the way the sitter faces
    B.boxXZ('wpTeak', -l / 2, l / 2, 0.4, 0.46, -0.22, 0.26, { bottom: true });
    B.push(new THREE.Matrix4().makeTranslation(0, 0.46, -0.24).multiply(new THREE.Matrix4().makeRotationX(-0.22))); B.boxXZ('wpTeak', -l / 2, l / 2, 0, 0.46, -0.03, 0.03, { bottom: true }); B.pop();
    for (const s of [-1, 1]) B.boxXZ('grey', s * (l / 2) - 0.03, s * (l / 2) + 0.03, 0, 0.64, -0.3, 0.28);
    B.pop();
    const dx = Math.cos(hd) * (l / 2), dv = Math.sin(hd) * (l / 2), a = W(u - dx, v - dv), b = W(u + dx, v + dv);
    col.addSegment(a[0], a[1], b[0], b[1], { tag: 'furniture', low: true });
    seats.push({ p: W(u, v), l });
  }
  return seats;
}

/** the gap between No. 10 and Staircase 24: buff piers and black railings along the back of the pavement, a gate between the first two */
export function buildGap(game, B) {
  const col = game.worldCollider, G = GAP, h = LV.gap;
  B.push(FN(N10.u0, G.v));
  const xs = G.piers.map((u) => N10.u0 - u);
  for (const x of xs) pier(B, 'buff', x, 0, G.w, h.pier);
  B.boxXZ('wpPlinth', xs[0] + G.w / 2, xs[1] - G.w / 2, 0, G.plinth, -0.11, 0.11);
  railings(B, xs[0] + G.w / 2, xs[1] - G.w / 2, h.rail + 0.1, 0, { gap: 0.13, y0: G.plinth + 0.02 });
  B.boxXZ('wpStain', 0.02, xs[0] - G.w / 2, 0.05, 1.9, -G.back - 0.03, -G.back + 0.03);      // the boarded gate, set back
  B.pop();
  const a = W(N10.u0, G.v), b = W(G.piers[G.piers.length - 1] - G.w / 2, G.v);
  col.addSegment(a[0], a[1], b[0], b[1], { tag: 'wall' });
}

/** the walls of the MCR's yard: high buff brick on the west (the line of the gatehouse's inner face) and north, a lower
 *  one with a boarded door on the south; the MCR's own west gable closes the east side */
export function buildYard(game, B) {
  const col = game.worldCollider, Y = YARD, h = LV.yard, t = Y.t;
  // (plain walls with a flush brick-on-edge top: no oversailing coping, so no two tops overlap at the corners)
  const wallU = (u, v0, v1, hh) => B.boxXZ('buff', u - t / 2, u + t / 2, 0, hh, -v1, -v0);
  const wallV = (v, u0, u1, hh) => B.boxXZ('buff', u0, u1, 0, hh, -v - t / 2, -v + t / 2);
  wallU(Y.u0, Y.v0 - t / 2, Y.v1 + t / 2, h.wallW);
  wallV(Y.v1, Y.u0 + t / 2 + 0.004, -6.57, h.wallW - 0.004);
  wallV(Y.v0, Y.u0 + t / 2 + 0.004, Y.u1, h.wallS);
  B.push(FS(Y.door[0], Y.v0 - t / 2 - 0.012)); B.unit('doorGrey', rectPts(0, 0.04, Y.door[1] - Y.door[0], 2.0), 0); B.pop();
  const seg = (a, b) => { const p = W(a[0], a[1]), q = W(b[0], b[1]); col.addSegment(p[0], p[1], q[0], q[1], { tag: 'wall' }); };
  seg([Y.u0, Y.v0], [Y.u0, Y.v1]); seg([Y.u0, Y.v1], [-6.57, Y.v1]); seg([Y.u0, Y.v0], [Y.u1, Y.v0]);
}
