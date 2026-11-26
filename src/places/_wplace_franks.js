// Worcester Place: the Franks Building (17A; 1999; map w154788906) at the inside corner of the street's two legs.
// Called by places/worcester_wplace.js (sources and K / G there).
//
// Red brick with buff bands, white casements, slate roofs. Along the north leg, south to north: the corner block E
// (three storeys and an attic, its gable to the north leg, four wall-gablets to the east-west leg), block D (three
// storeys, a gablet over one bay), the low link with a dark-stained timber oriel over the gated carriage entrance,
// the two-storey gabled wing B, and block A (three storeys, gable to the street). Low brick planters before them.
import { rectPts } from './_worcester_kit.js';
import { frame } from './_worcester_kit.js';
import { win, shrub } from './_worcester_south_kit.js';
import { W, P3, FW, FE, FS, FN, LV, bandWall, flatSash, pitched, gablePts, railings, lowWall, stripWall, segHead, bay } from './_wplace_kit.js';

export const FR = {
  E: { uW: 5.1, uE: 17.7, v0: 7.2, v1: 15.9 },
  D: { uW: 6.0, uE: 14.4, v0: 15.9, v1: 21.9 },
  low: { uE: 14.4, v0: 21.9, v1: 29.7, link: 25.6, uLink: 7.3, uB: 5.75, uGate: 7.0, ridgeU: 10.2, uOriel: 6.15 },
  A: { uW: 6.0, uN: 5.2, uE: 14.4, v0: 29.7, step: 32.5, v1: 37.5 },
  // the south front (street view 2024): four gabled bays, metres from its west corner; the three eastern ones stand over
  // two-storey canted stone bays (front half-width, whole half-width, depth), the western one over a low lean-to bay
  southBays: [2.3, 5.45, 8.3, 11.0], gable: { hw: 1.25, rise: 2.0 }, cant: { fw: 0.72, hw: 1.25, d: 0.6, top: 5.25, roof: 0.7 }, lean: { x0: 0.75, x1: 3.85, d: 0.6, top: 2.6, roof: 0.65 },
  corner: { u: 4.6, c: [6.3, 7.45], r: 1.7, vN: 8.6 },      // the rounded planter wall on the corner
  planters: [[[6.0, 21.6], [4.95, 21.6], [4.95, 16.9], [6.0, 16.9]], [[5.75, 25.8], [4.8, 25.8], [4.8, 32.3], [5.2, 32.3]], ],
};
const K = 'wpFr', L = LV.fr, BANDS = L.band;
const flo = (f) => [L.sill + f * L.storey, L.sill + f * L.storey + L.winH];
/** the low wall before the south front: from the west face round the corner in a quarter circle, then along the footway */
export function cornerWall() {
  const Q = FR.corner, pts = [[FR.E.uW, Q.vN], [Q.u, Q.vN]];
  for (let k = 0; k <= 6; k++) { const t = Math.PI + (k / 6) * (Math.PI / 2); pts.push([+(Q.c[0] + Math.cos(t) * Q.r).toFixed(3), +(Q.c[1] + Math.sin(t) * Q.r).toFixed(3)]); }
  pts.push([FR.E.uE, Q.c[1] - Q.r]);
  return pts;
}
/** the building's two solid parts either side of the carriage way (street frame rings) */
export const frRings = () => { const { E, D, low, A } = FR; return [
  [[E.uW, E.v0], [E.uE, E.v0], [E.uE, E.v1], [D.uE, E.v1], [D.uE, D.v1], [D.uW, D.v1], [D.uW, E.v1], [E.uW, E.v1]],
  [[low.uB, low.link], [low.uE, low.link], [A.uE, A.v1], [A.uN, A.v1], [A.uN, A.step], [A.uW, A.step], [A.uW, A.v0], [low.uB, A.v0]],
]; };

/** a wall-gablet's roof and bargeboards, in a face frame: the wall's eaves at ye, the main slope rising inwards at tp */
function gablet(B, c, ye, hw, rise, tp) {
  const ya = ye + rise + 0.06, zf = 0.14, zb = -(ya - ye) / tp, k = rise / hw;
  for (const s of [-1, 1]) {
    const e = [c + s * (hw + 0.12), ye - 0.12 * k + 0.06, zf];
    B.poly('slate', [e, [c, ya, zf], [c, ya, zb]], [s, 1, 0]);
    B.poly('wpDark', [[e[0], e[1] - 0.13, zf], [c, ya - 0.13, zf], [c, ya, zf], e], [0, 0, 1]);
  }
}
/** a corbelled course under an eaves in a face frame: a projecting band on small brick dentils from x0 to x1, its top at y + 0.2 */
function dentils(B, x0, x1, y) {
  if (x1 - x0 < 0.12) return;
  B.boxXZ(K, x0, x1, y + 0.12, y + 0.2, 0.012, 0.09, { bottom: true });      // (its back 8 mm off the eaves board's: no two faces in one plane)
  const n = Math.max(1, Math.round((x1 - x0) / 0.34));
  for (let i = 0; i < n; i++) { const c = x0 + ((x1 - x0) * (i + 0.5)) / n; B.boxXZ(K, c - 0.06, c + 0.06, y, y + 0.12, 0.012, 0.07, { bottom: true, top: false }); }
}
/** bargeboards under a gable's verge, in its face frame (the roof oversails by og) */
function rake(B, x0, x1, ye, yr, xm = (x0 + x1) / 2, og = 0.25) {
  for (const [xa, s] of [[x0, -1], [x1, 1]]) { const tn = (yr - ye) / Math.abs(xm - xa), xe = xa + s * 0.3, y = ye - 0.3 * tn; B.poly('wpDark', [[xe, y - 0.17, og], [xm, yr - 0.17, og], [xm, yr, og], [xe, y, og]], [0, 0, 1]); }
}
/** a rooflight lying on a slope: corners [u, y, v] given by fn(u, v) -> y */
const rooflight = (B, u0, u1, v0, v1, yOf, n) => B.poly('glassDark', [P3(u0, yOf(u0, v0) + 0.05, v0), P3(u1, yOf(u1, v0) + 0.05, v0), P3(u1, yOf(u1, v1) + 0.05, v1), P3(u0, yOf(u0, v1) + 0.05, v1)], n);

export function buildFranks(game, B) {
  const col = game.worldCollider, { E, D, low, A } = FR;
  const tnE = (L.ridgeE - L.eavesE) / ((E.v1 - E.v0) / 2), tnD = (L.ridgeD - L.eavesD) / ((D.uE - D.uW) / 2);
  const cas = (c, w, f, o = {}) => { const [y0, y1] = flo(f); return [c - w / 2, y0, c + w / 2, y1, { floor: f, cols: w > 0.9 ? 2 : 1, sill: f === 0 ? 'wpBand' : undefined, ...o }]; };

  // ================================================================= E: the corner block
  B.push(FS(E.uW, E.v0));      // the south front on the east-west leg (street view 2024): four gabled bays
  { const len = E.uE - E.uW, G = FR.gable, C = FR.cant, LN = FR.lean, out = [[0, 0], [len, 0], [len, L.eavesE]], wins = [], [c0, ...cb] = FR.southBays;
    for (const c of FR.southBays.slice().reverse()) out.push([c + G.hw, L.eavesE], [c, L.eavesE + G.rise], [c - G.hw, L.eavesE]);
    out.push([0, L.eavesE]);
    for (const c of FR.southBays) { wins.push([c - 0.42, L.eavesE + 0.12, c + 0.42, L.eavesE + 1.02, { floor: 3, head: 'seg' }]); wins.push([c - 0.6, 6.45, c + 0.6, 7.8, { floor: 2 }]); }
    wins.push([c0 - 0.7, 3.7, c0 + 0.7, 5.05, { floor: 1, head: 'seg' }]);
    bandWall(B, K, out, wins, BANDS);
    for (const c of FR.southBays) { gablet(B, c, L.eavesE, G.hw, G.rise, tnE); B.poly('wpStone', [[c - 0.72, 7.8, 0.016], [c + 0.72, 7.8, 0.016], [c + 0.72, 8.0, 0.016], [c - 0.72, 8.0, 0.016]], [0, 0, 1]); }      // stone lintels
    // the corbelled brick course under the eaves, where they show between the gables (street view 2024)
    { const xs = [0, ...FR.southBays.flatMap((c) => [c - G.hw, c + G.hw]), len]; for (let i = 0; i < xs.length; i += 2) dentils(B, xs[i] + 0.04, xs[i + 1] - 0.04, L.eavesE - 0.2); }
    for (const x of [(c0 + cb[0]) / 2 + 0.25, (cb[0] + cb[1]) / 2, len - 0.12]) B.boxXZ('wpDark', x - 0.045, x + 0.045, 0.15, L.eavesE - 0.1, 0.02, 0.11, { top: false });
    // a canted bay through two storeys: brick with a stone stage at each floor, white casements
    const stage = [[0.95, 2.3, 0.7, 2.5, 0], [3.75, 5.0, 3.5, C.top, 1]];      // window sill / head, stone from / to, floor
    const bayFace = (M, w, lights) => {
      B.push(M);
      const holes = stage.map(([y0, y1]) => rectPts(w / 2 - lights * 0.27, y0, w / 2 + lights * 0.27, y1));
      B.face(K, rectPts(0, 0, w, C.top), holes);
      stage.forEach(([y0, y1, s0, s1, f], i) => { B.face('wpStone', rectPts(0, s0, w, s1), [holes[i]], 0.015); win(B, holes[i][0][0], y0, holes[i][2][0], y1, { wall: 'wpStone', frame: 'white', cols: lights, depth: lights > 1 ? 0.07 : 0, bar: 0.06, floor: f }); });
      B.pop();
    };
    for (const c of cb) {
      const cw = Math.hypot(C.hw - C.fw, C.d);
      bayFace(frame(c - C.fw, 0, C.d, 1, 0), 2 * C.fw, 2);
      bayFace(frame(c - C.hw, 0, 0, C.hw - C.fw, C.d), cw, 1);
      bayFace(frame(c + C.fw, 0, C.d, C.hw - C.fw, -C.d), cw, 1);
    }
    // their slate roofs: one over the first bay, one long one over the pair
    const bayRoof = (xa, xb) => { const o = 0.1, ye = C.top, yt = C.top + C.roof, a = xa - (C.hw - C.fw), b = xb + (C.hw - C.fw);
      B.poly('slate', [[xa - o * 0.5, ye, C.d + o], [xb + o * 0.5, ye, C.d + o], [xb, yt, 0.02], [xa, yt, 0.02]], [0, 1, 1]);
      B.poly('slate', [[a - o, ye, 0.02], [xa - o * 0.5, ye, C.d + o], [xa, yt, 0.02]], [-1, 1, 1]); B.poly('slate', [[xb + o * 0.5, ye, C.d + o], [b + o, ye, 0.02], [xb, yt, 0.02]], [1, 1, 1]);
      B.poly('wpDark', [[a - o, ye - 0.1, 0.02], [xa - o * 0.5, ye - 0.1, C.d + o], [xa - o * 0.5, ye, C.d + o], [a - o, ye, 0.02]], [-1, 0, 1]); B.poly('wpDark', [[xa - o * 0.5, ye - 0.1, C.d + o], [xb + o * 0.5, ye - 0.1, C.d + o], [xb + o * 0.5, ye, C.d + o], [xa - o * 0.5, ye, C.d + o]], [0, 0, 1]); B.poly('wpDark', [[xb + o * 0.5, ye - 0.1, C.d + o], [b + o, ye - 0.1, 0.02], [b + o, ye, 0.02], [xb + o * 0.5, ye, C.d + o]], [1, 0, 1]); };
    bayRoof(cb[0] - C.fw, cb[0] + C.fw); bayRoof(cb[1] - C.fw, cb[2] + C.fw);
    // the western bay's low lean-to: a stone front with two windows under a slate roof
    { const w = LN.x1 - LN.x0, hl = [rectPts(0.45, 0.95, 1.65, 2.2), rectPts(2.2, 0.95, 2.7, 2.2)];
      B.push(frame(LN.x0, 0, LN.d, 1, 0)); B.face(K, rectPts(0, 0, w, 0.7)); B.face('wpStone', rectPts(0, 0.7, w, LN.top), hl);
      win(B, 0.45, 0.95, 1.65, 2.2, { wall: 'wpStone', frame: 'white', cols: 2, depth: 0.07, bar: 0.06, floor: 0 }); win(B, 2.2, 0.95, 2.7, 2.2, { wall: 'wpStone', frame: 'white', cols: 1, depth: 0.07, bar: 0.06, floor: 0 }); B.pop();
      for (const x of [LN.x0, LN.x1]) B.poly(K, [[x, 0, 0.004], [x, 0, LN.d], [x, LN.top, LN.d], [x, LN.top, 0.004]], [x === LN.x0 ? -1 : 1, 0, 0]);
      B.poly('slate', [[LN.x0 - 0.1, LN.top, LN.d + 0.12], [LN.x1 + 0.1, LN.top, LN.d + 0.12], [LN.x1 + 0.1, LN.top + LN.roof, 0.02], [LN.x0 - 0.1, LN.top + LN.roof, 0.02]], [0, 1, 1]);
      for (const x of [LN.x0 - 0.1, LN.x1 + 0.1]) B.poly('wpDark', [[x, LN.top - 0.08, LN.d + 0.12], [x, LN.top - 0.08, 0.02], [x, LN.top + LN.roof, 0.02], [x, LN.top, LN.d + 0.12]], [x < LN.x1 ? -1 : 1, 0, 0]);
      B.poly('wpDark', [[LN.x0 - 0.1, LN.top - 0.08, LN.d + 0.12], [LN.x1 + 0.1, LN.top - 0.08, LN.d + 0.12], [LN.x1 + 0.1, LN.top, LN.d + 0.12], [LN.x0 - 0.1, LN.top, LN.d + 0.12]], [0, 0, 1]); } }
  B.pop();
  B.push(FW(E.uW, E.v1));      // its gable to the north leg: a casement near the corner and a slit to each floor (street view 2024), a vent in the gable
  { const len = E.v1 - E.v0;
    bandWall(B, K, gablePts(0, len, L.eavesE, L.ridgeE), [0, 1, 2].flatMap((f) => [cas(7.1, 1.2, f), cas(1.2, 0.34, f, { sill: undefined })]), BANDS);
    B.poly('dark', [[len / 2 - 0.1, 10.25, 0.012], [len / 2 + 0.1, 10.25, 0.012], [len / 2 + 0.1, 10.8, 0.012], [len / 2 - 0.1, 10.8, 0.012]], [0, 0, 1]);
    rake(B, 0, len, L.eavesE, L.ridgeE); }
  B.pop();
  B.push(FN(D.uW, E.v1)); bandWall(B, K, rectPts(0, 0, D.uW - E.uW, L.eavesE), [], BANDS); B.pop();      // the return
  B.push(FE(E.uE, E.v0)); B.face(K, gablePts(0, E.v1 - E.v0, L.eavesE, L.ridgeE)); B.pop();
  B.push(FN(E.uE, E.v1)); B.face(K, rectPts(0, 0, E.uE - D.uE, L.eavesE)); for (let f = 0; f < 3; f++) { const [y0, y1] = flo(f); flatSash(B, 1.0, y0, 2.2, y1, f); } B.pop();
  pitched(B, 'slate', false, E.uW, E.uE, E.v0, E.v1, L.eavesE, L.ridgeE, { ov: 0.3, og: 0.25, fascia: 'wpDark' });
  { const vm = (E.v0 + E.v1) / 2; rooflight(B, 7.6, 8.4, 13.0, 14.0, (u, v) => L.ridgeE - (v - vm) * tnE, [0, 1, -1]); }

  // ================================================================= D: three storeys, a gablet over the north bay
  B.push(FW(D.uW, D.v1));
  { const len = D.v1 - D.v0, wins = [];
    for (const c of [1.6, 4.3]) for (let f = 0; f < 3; f++) wins.push(cas(c, 1.25, f, f === 2 && c < 2 ? { head: 'seg' } : {}));
    bandWall(B, K, [[0, 0], [len, 0], [len, L.eavesD], [2.6, L.eavesD], [1.6, L.eavesD + 1.05], [0.6, L.eavesD], [0, L.eavesD]], wins, BANDS);
    gablet(B, 1.6, L.eavesD, 1.0, 1.05, tnD);
    dentils(B, 2.7, len - 0.05, L.eavesD - 0.2); dentils(B, 0.05, 0.5, L.eavesD - 0.2);      // (college photograph: a dog-tooth course at this eaves too)
    for (const x of [0.1, 2.95, len - 0.1]) B.boxXZ('wpDark', x - 0.045, x + 0.045, 0.15, L.eavesD - 0.12, 0.02, 0.11, { top: false });      // black downpipes (the photograph)
    // the small glazed triangular dormer between the bays
    { const x = 3.5, zf = -0.9, yb = L.eavesD + 0.9 * tnD, ya = yb + 0.85, zb = zf - 0.85 / tnD, by = bay(3);
      B.poly('white', [[x - 0.65, yb, zf], [x + 0.65, yb, zf], [x, ya, zf]], [0, 0, 1]);
      B.poly('sash', [[x - 0.45, yb + 0.08, zf + 0.012], [x + 0.45, yb + 0.08, zf + 0.012], [x, ya - 0.2, zf + 0.012]], [0, 0, 1], [[by[0] + 0.16, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.79], [by[0] + 0.21, by[1] + 0.87]]);
      for (const s of [-1, 1]) B.poly('slate', [[x + s * 0.72, yb - 0.05, zf + 0.06], [x, ya + 0.04, zf + 0.06], [x, ya + 0.04, zb]], [s, 1, 0]); } }
  B.pop();
  B.push(FE(D.uE, D.v0)); B.face(K, rectPts(0, 0, D.v1 - D.v0, L.eavesD)); for (let f = 0; f < 3; f++) for (const x of [0.9, 3.9]) { const [y0, y1] = flo(f); flatSash(B, x, y0, x + 1.2, y1, f); } B.pop();
  B.push(FN(D.uE, D.v1)); B.face(K, rectPts(0, 0, D.uE - D.uW, L.eavesD)); B.pop();      // (above the low roof; below, the carriage way's south side)
  { const mid = (D.uW + D.uE) / 2, ov = 0.3, ye = L.eavesD - ov * tnD, vS = 13.0, hip = D.v1 - (D.uE - D.uW) / 2, vN = D.v1 + ov;      // the roof runs south into E's; hipped at the north end
    B.poly('slate', [P3(D.uW - ov, ye, vS), P3(D.uW - ov, ye, vN), P3(mid, L.ridgeD, hip), P3(mid, L.ridgeD, vS)], [-1, 1, 0]);
    B.poly('slate', [P3(D.uE + ov, ye, vN), P3(D.uE + ov, ye, vS), P3(mid, L.ridgeD, vS), P3(mid, L.ridgeD, hip)], [1, 1, 0]);
    B.poly('slate', [P3(D.uW - ov, ye, vN), P3(D.uE + ov, ye, vN), P3(mid, L.ridgeD, hip)], [0, 1, -1]);
    B.boxXZ('wpDark', D.uW - ov - 0.02, D.uW - 0.004, ye - 0.15, ye - 0.004, -vN, -D.v0, { bottom: true, top: false }); }

  // ================================================================= the low range: wing B and the link over the carriage way
  const tl = (L.ridgeLow - (L.eavesLow - 0.1)) / (low.ridgeU - D.uW), te = (L.ridgeLow - L.eavesLow) / (low.uE - low.ridgeU);
  B.push(FW(low.uB, low.v1));      // B's gabled front
  { const len = low.v1 - low.link;
    bandWall(B, K, gablePts(0, len, L.eavesLow, L.apexB), [[len / 2 - 0.75, 0.9, len / 2 + 0.75, 2.25, { floor: 0, sill: 'wpBand' }], [len / 2 - 0.65, 3.7, len / 2 + 0.65, 5.0, { floor: 1, head: 'seg' }]], BANDS.slice(0, 2));
    rake(B, 0, len, L.eavesLow, L.apexB, len / 2, 0.15);
    B.boxXZ('wpDark', 0.06, 0.15, 0.15, L.eavesLow - 0.1, 0.02, 0.11, { top: false }); }
  B.pop();
  B.push(FS(low.uB, low.link)); B.face(K, [[0, 0], [low.uE - low.uB, 0], [low.uE - low.uB, 2.7], [low.uLink - low.uB, 2.7], [low.uLink - low.uB, L.eavesLow], [0, L.eavesLow]]); B.pop();      // B's side, then the carriage way's north side
  B.push(FN(A.uW, low.v1)); B.face(K, rectPts(0, 0, A.uW - low.uB, L.eavesLow)); B.pop();
  { const vm = (low.link + low.v1) / 2, tb = (L.apexB - L.eavesLow) / ((low.v1 - low.link) / 2), ya = L.apexB + 0.05, y = L.eavesLow - 0.15 * tb, uR = D.uW + (ya - (L.eavesLow - 0.1)) / tl, u0 = low.uB - 0.15;
    B.poly('slate', [P3(u0, y, low.link - 0.15), P3(D.uW, y, low.link - 0.15), P3(uR, ya, vm), P3(u0, ya, vm)], [0, 1, 1]);
    B.poly('slate', [P3(D.uW, y, low.v1 + 0.15), P3(u0, y, low.v1 + 0.15), P3(u0, ya, vm), P3(uR, ya, vm)], [0, 1, -1]); }
  // the carriage way: a louvred door, a brick pier with two plates on it, tall black railing gates, under the oriel
  B.push(FW(low.uGate, low.link));
  { B.face('wpStain', rectPts(0, 0, 1.0, 2.7), [rectPts(0.08, 0.03, 0.95, 2.1)]); B.unit('doorDark', rectPts(0.08, 0.03, 0.95, 2.1), -0.03);
    B.boxXZ(K, 1.0, 1.35, 0, 2.7, -0.28, 0.12, { top: false });
    B.poly('wpPlaque', [[1.06, 1.42, 0.132], [1.29, 1.42, 0.132], [1.29, 1.6, 0.132], [1.06, 1.6, 0.132]], [0, 0, 1]);
    B.poly('flY', [[1.08, 1.68, 0.132], [1.27, 1.68, 0.132], [1.27, 1.94, 0.132], [1.08, 1.94, 0.132]], [0, 0, 1]);
    railings(B, 1.37, 3.68, L.gate + 0.12, 0, { gap: 0.12 }); }
  B.pop();
  { const [y0, y1] = L.oriel, u0 = low.uOriel, by = bay(1), uv = [[by[0] + 0.16, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.87], [by[0] + 0.16, by[1] + 0.87]];
    const vA = low.v0 + 0.1, vB = low.link - 0.1, n = 6, w = (vB - vA) / n;
    B.boxXZ('wpStain', u0, low.uLink, y0, y1, -vB, -vA, { bottom: true });
    for (let i = 0; i < n; i++) B.poly('sash', [P3(u0 - 0.012, y0 + 1.42, vA + (i + 1) * w - 0.07), P3(u0 - 0.012, y0 + 1.42, vA + i * w + 0.07), P3(u0 - 0.012, y1 - 0.14, vA + i * w + 0.07), P3(u0 - 0.012, y1 - 0.14, vA + (i + 1) * w - 0.07)], [-1, 0, 0], uv);
    B.poly('wpStain', [P3(low.uLink, 2.7, low.v0), P3(low.uE, 2.7, low.v0), P3(low.uE, 2.7, low.link), P3(low.uLink, 2.7, low.link)], [0, -1, 0]); }
  B.push(FE(low.uE, low.v0));      // the court side (GUESS: its windows)
  { const len = low.v1 - low.v0, way = low.link - low.v0;
    B.face(K, [[way, 0], [len, 0], [len, L.eavesLow], [0, L.eavesLow], [0, 2.7], [way, 2.7]]);
    flatSash(B, 0.9, 3.7, 2.1, 5.0, 1); flatSash(B, 4.9, 3.7, 6.1, 5.0, 1); flatSash(B, 4.9, 0.95, 6.1, 2.25, 0); }
  B.pop();
  B.poly('slate', [P3(D.uW, L.eavesLow - 0.1, low.v0), P3(D.uW, L.eavesLow - 0.1, low.v1), P3(low.ridgeU, L.ridgeLow, low.v1), P3(low.ridgeU, L.ridgeLow, low.v0)], [-1, 1, 0]);
  B.poly('slate', [P3(low.uE + 0.3, L.eavesLow - 0.3 * te, low.v1), P3(low.uE + 0.3, L.eavesLow - 0.3 * te, low.v0), P3(low.ridgeU, L.ridgeLow, low.v0), P3(low.ridgeU, L.ridgeLow, low.v1)], [1, 1, 0]);
  B.boxXZ('wpDark', D.uW - 0.03, low.uOriel + 0.02, L.oriel[1], L.eavesLow - 0.08, -low.link, -low.v0, { bottom: false });      // the eaves board over the oriel

  // ================================================================= A: three storeys, its gable to the street in two planes
  { const vm = (A.v0 + A.v1) / 2, tn = (L.ridgeA - L.eavesA) / (A.v1 - vm), yStep = L.ridgeA - (vm - A.step) * tn, lenN = A.v1 - A.step, lenS = A.step - A.v0;
    B.push(FW(A.uN, A.v1)); bandWall(B, K, [[0, 0], [lenN, 0], [lenN, yStep], [A.v1 - vm, L.ridgeA], [0, L.eavesA]], [0, 1, 2].map((f) => cas(2.5, 1.5, f)), BANDS); B.pop();
    B.push(FW(A.uW, A.step)); bandWall(B, K, [[0, 0], [lenS, 0], [lenS, L.eavesA], [0, yStep]], [0, 1, 2].map((f) => cas(1.4, 1.5, f)), BANDS); B.pop();
    B.push(FS(A.uN, A.step)); bandWall(B, K, rectPts(0, 0, A.uW - A.uN, yStep), [], BANDS); B.pop();
    B.push(FW(A.uN, A.v1)); rake(B, 0, A.v1 - A.v0, L.eavesA, L.ridgeA, A.v1 - vm); B.pop();
    B.push(FN(A.uE, A.v1)); B.face(K, rectPts(0, 0, A.uE - A.uN, L.eavesA)); B.pop();
    B.push(FS(A.uW, A.v0)); B.face(K, rectPts(0, 0, A.uE - A.uW, L.eavesA)); B.pop();
    B.push(FE(A.uE, A.v0)); B.face(K, gablePts(0, A.v1 - A.v0, L.eavesA, L.ridgeA)); for (let f = 0; f < 3; f++) for (const x of [1.3, 5.3]) { const [y0, y1] = flo(f); flatSash(B, x, y0, x + 1.2, y1, f); } B.pop();
    pitched(B, 'slate', false, A.uN, A.uE, A.v0, A.v1, L.eavesA, L.ridgeA, { ov: 0.3, og: 0.25, fascia: 'wpDark' });
    rooflight(B, 7.4, 8.2, 35.0, 36.0, (u, v) => L.ridgeA - (v - vm) * tn, [0, 1, -1]); }

  // ================================================================= planters, the hedge on the corner, the little railing by E
  for (const pts of FR.planters) lowWall(B, K, pts, L.planter, 0.22, 'wpBand');
  { const soil = (u0, u1, v0, v1) => B.poly('soil', [P3(u0, L.planter - 0.16, v0), P3(u1, L.planter - 0.16, v0), P3(u1, L.planter - 0.16, v1), P3(u0, L.planter - 0.16, v1)], [0, 1, 0]);
    soil(5.06, 5.99, 17.01, 21.49); soil(4.91, 5.74, 25.91, 32.19); soil(4.72, 17.69, 5.87, 7.19); soil(4.72, 5.09, 7.19, 8.49);
    for (const [u, v, r] of [[5.5, 18.0, 0.45], [5.5, 19.6, 0.55], [5.5, 20.9, 0.4], [5.3, 27.2, 0.42], [5.3, 29.0, 0.5], [5.35, 31.0, 0.42]]) shrub(B, 'leafC', u, -v, r, 1.2, 7, L.planter - 0.16);
    B.boxXZ('leafC', 6.4, 17.6, L.planter - 0.16, 1.45, -6.5, -5.92);      // the clipped hedge behind the wall (street view 2024)
    for (const [u, v, r] of [[5.3, 6.9, 0.5], [5.6, 6.3, 0.42], [4.95, 7.9, 0.34]]) shrub(B, 'leafC', u, -v, r, 1.1, 7, L.planter - 0.16); }
  stripWall(B, K, cornerWall(), L.planter, 0.22, 'wpBand');
  B.push(FW(4.95, 16.9)); railings(B, 0, 1.0, 1.5, 0); B.pop();

  // colliders: the two solid parts, the gates across the carriage way, the planter walls
  for (const r of frRings()) col.addPolygon(r.map(([u, v]) => W(u, v)), { tag: 'building' });
  { const a = W(low.uGate, low.v0), b = W(low.uGate, low.link); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'gate' }); }
  for (const pts of FR.planters) for (let i = 0; i < pts.length - 1; i++) { const a = W(pts[i][0], pts[i][1]), b = W(pts[i + 1][0], pts[i + 1][1]); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'wall', low: true }); }
  { const a = W(4.95, 16.9), b = W(4.95, 15.9); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'wall', low: true }); }
  { const cw = cornerWall(); for (let i = 0; i < cw.length - 1; i++) { const a = W(cw[i][0], cw[i][1]), b = W(cw[i + 1][0], cw[i + 1][1]); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'wall', low: true }); } }
}
