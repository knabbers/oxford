// Worcester College: the Canal Building (1994; map w93711465), by the Oxford Canal at the college's far north-west
// corner. Called by places/worcester_west.js (sources and K / G there; the plan and levels in _wwest_plan.js).
//
// A cranked range of two wings (the west one 29.4 m at 65.8 degrees, the east one 20.4 m at 55.5 degrees), two storeys
// and attic rooms under a slate roof of 33 degrees: yellow-buff stock brick on a red-brick plinth, red flat arches over
// white casements, a red band under the eaves, gablets with triangular glazing standing on the eaves. Two cross wings
// in red brick with buff bands stand through it: the tall one of the west range (three storeys in its south gable, a
// balconette at the top, the flagpole on its apex) and the porch bay of the east range (a buff segmental arch on brick
// piers, a white box window over it). A white timber oriel on brackets between them. Only the south (college) side is
// in a photograph; the north side, both ends and the bays' north gables are guesses in the same vocabulary.
import { rectPts } from './_worcester_kit.js';
import { LV, CB, CP, WF, EF, canalSolid } from './_wwest_plan.js';
import { T, shrub } from './_worcester_south_kit.js';
import { onFace, onReturn, strip, bands, paneShape, wallFace, gable, bayRoof, bayReturns, gablet, rooflight, boxWindow, mk, bay } from './_wwest_kit.js';

const BUFF = 'wwBuff', RED = 'wwRed', SLATE = 'wwSlate', DARK = 'wwDark';
export const EVERGREEN = [[-642.1, -235.0, 2.4], [-644.7, -233.4, 2.2]];      // two overlapping domes of one bush: x, z, radius
const L = LV.canal;
const tW = (L.ridge - L.eaves) / (CB.depthW / 2), tE = (L.ridge - L.eaves) / (CB.depthE / 2);
const GF = L.gf, FF = L.ff;
// casements: three lights, two lights, one
const W3 = (c, f, o = {}) => { const y = f ? FF : GF; return [c - 0.775, y[0], c + 0.775, y[1], { cols: 3, floor: f, ...o }]; };
const W2 = (c, f, o = {}) => { const y = f ? FF : GF; return [c - 0.525, y[0], c + 0.525, y[1], { cols: 2, floor: f, ...o }]; };
const W1 = (c, f, o = {}) => { const y = f ? FF : GF; return [c - 0.26, y[0], c + 0.26, y[1], { cols: 1, floor: f, ...o }]; };
const pipe = (B, x, y1, z = 0.03) => B.boxXZ(DARK, x - 0.04, x + 0.04, 0.1, y1, z, z + 0.08, { top: false });

export function buildCanal(game, B) {
  const P = CP, C = CB;
  /** a buff wall between two corners: the red plinth, buff brick with its windows under red flat arches, the red band and corbel course under the eaves */
  const buffWall = (p0, p1, wins, tp, o = {}) => onFace(B, p0, p1, (len) => {
    strip(B, RED, 0, 0, len, L.plinth);
    wallFace(B, BUFF, rectPts(0, L.plinth, len, L.band), wins, { head: RED });
    strip(B, RED, 0, L.band, len, L.eaves);
    B.boxXZ(RED, 0, len, L.eaves - 0.15, L.eaves - 0.03, 0, 0.055, { bottom: true });
    for (const g of o.gablets || []) gablet(B, g, L.eaves, tp, { roof: SLATE, barge: DARK, h: L.gablet, ...(o.gab || {}) });
    for (const x of o.pipes || []) pipe(B, x, L.eaves - 0.16, 0.06);
    for (const r of o.lights || []) rooflight(B, r[0], 0.8, r[1], r[1] + 1.1, L.eaves, tp);
    if (o.then) o.then(len);
  });
  const cheap = (list) => list.map((w) => { w[4] = { ...w[4], flat: true }; return w; });

  // ================================================================= the south (college) side, west to east
  // west of the tall wing (hidden behind it in the photograph: a guess in the same vocabulary)
  buffWall(P.F, P.G, [2.2, 5.95, 9.7].flatMap((c) => [W3(c, 0), W3(c, 1)]), tW, { gablets: [4.05, 7.8], pipes: [0.25] });
  // between the tall wing and the bend (the photograph): two-light casements, the narrow light, the oriel on its brackets
  buffWall(P.J, P.K, [W2(2.6, 0), W2(5.0, 0), W2(7.4, 0), W3(10.1, 0), W2(3.3, 1), W1(11.25, 1)], tW, { gablets: [2.9, 10.6], gab: {}, pipes: [0.2, 8.55], lights: [[6.0, 2.6]], then: (len) => oriel(B, 6.9, len) });
  // between the bend and the porch bay: one bay of three-light casements under the big gablet
  buffWall(P.K, P.L, [W3(2.05, 0), W3(2.05, 1)], tE, { gablets: [2.05], gab: { hw: 1.15, h: 1.4 }, pipes: [0.2] });
  // east of the porch bay (the 2026 street pictures show its upper storey over the street wall)
  buffWall(P.O, P.P, [W3(2.0, 0), W3(5.6, 0), W3(9.2, 0), W3(2.0, 1), W3(5.6, 1), W3(9.2, 1)], tE, { gablets: [3.8, 6.9], pipes: [11.4], lights: [[1.2, 2.5], [8.6, 2.4], [9.7, 2.4], [10.8, 2.4]] });      // (2026 street pictures: three first-floor casements, two white-fronted gablets between them, rooflights at the east end)

  // ================================================================= the tall red cross wing
  onFace(B, P.H, P.I, (w) => {      // its south gable: narrow lights, a window, the attic door with its balconette
    wallFace(B, RED, gable(w, L.wingEaves, L.wingApex), [[1.85, GF[0], 2.37, GF[1], { cols: 1, floor: 0 }], [2.63, GF[0], 3.15, GF[1], { cols: 1, floor: 0 }], [w / 2 - 0.5, 3.45, w / 2 + 0.5, 4.75, { cols: 2, floor: 1 }], [w / 2 - 0.5, 5.75, w / 2 + 0.5, 7.25, { cols: 2, floor: 2, rows: 3 }]]);
    bands(B, BUFF, 0, w, [L.bandLo, L.bandHi]);
    // the balconette: a bowed basket of bars before the attic door
    { const x0 = w / 2 - 0.62, x1 = w / 2 + 0.62, y0 = 5.68, y1 = 6.75, z = 0.3;
      for (let i = 0; i <= 8; i++) { const x = x0 + ((x1 - x0) * i) / 8; B.boxXZ('iron', x - 0.011, x + 0.011, y0, y1, z - 0.011, z + 0.011, { top: false }); }
      for (const y of [y0, y1]) { B.boxXZ('iron', x0, x1, y - 0.02, y + 0.02, z - 0.015, z + 0.015, { bottom: true }); for (const x of [x0, x1]) B.boxXZ('iron', x - 0.015, x + 0.015, y - 0.02, y + 0.02, 0, z, { bottom: true }); } }
    bayReturns(B, RED, w, C.wing.s, L.wingEaves, L.eaves, tW, { band: BUFF, bands: [L.bandLo, L.bandHi] });
    bayRoof(B, SLATE, w, L.wingEaves, L.wingApex, C.wing.s + C.depthW / 2, { barge: DARK });
    B.cyl('white', w / 2, L.wingApex, 0.05, 0.025, L.flagpole - L.wingApex, 5, false, 0.03); B.cyl('gold', w / 2, L.flagpole, 0.05, 0.02, 0.12, 5, true, 0.045);      // the flagpole on the gable
    // the rooflight on its east slope (the photograph)
    { const tb = (L.wingApex - L.wingEaves) / (w / 2), xa = w - 1.5, xb = w - 0.6, ya = L.wingApex - (xa - w / 2) * tb + 0.05, yb = L.wingApex - (xb - w / 2) * tb + 0.05; B.poly('glassDark', [[xa, ya, -1.0], [xb, yb, -1.0], [xb, yb, -1.9], [xa, ya, -1.9]], [1, 1, 0]); }
  });
  onFace(B, P.n3, P.n2, (w) => {      // its north gable (a guess)
    wallFace(B, RED, gable(w, L.wingEaves, L.wingApex), cheap([[w / 2 - 0.55, GF[0], w / 2 + 0.55, GF[1], { floor: 0 }], [w / 2 - 0.55, FF[0], w / 2 + 0.55, FF[1], { floor: 1 }], [w / 2 - 0.45, 6.0, w / 2 + 0.45, 7.1, { floor: 2 }]]));
    bands(B, BUFF, 0, w, [L.bandLo, L.bandHi]);
    bayReturns(B, RED, w, C.wing.n, L.wingEaves, L.eaves, tW, { band: BUFF, bands: [L.bandLo, L.bandHi] });
    bayRoof(B, SLATE, w, L.wingEaves, L.wingApex, C.wing.n + C.depthW / 2, { barge: DARK });
  });

  // ================================================================= the porch bay
  porch(B);
  onFace(B, P.S, P.T, (w) => {      // the bay on the east range's north side (the 2026 picture from St Barnabas Street)
    const c = w / 2, fw = [c - 0.65, 2.78, c + 0.65, 4.85], oc = [c, 1.5], or = [0.5, 0.3], n = 12;
    wallFace(B, RED, gable(w, L.nBayEaves, L.nBayApex), [[...fw, { cols: 2, floor: 1, tr: 0.26 }]]);      // the white French window
    bands(B, BUFF, 0, w, [[2.55, 2.7]]);
    for (const s of [0, 1]) for (let k = 0; k < 10; k++) { const y = 0.3 + k * 0.5, q = k % 2 ? 0.22 : 0.34; strip(B, BUFF, s ? w - q : 0, y, s ? w : q, y + 0.225, 0.015); }      // buff quoins
    { const x0 = fw[0] - 0.14, x1 = fw[2] + 0.14, y0 = fw[1] - 0.02, y1 = fw[1] + 1.08, z = 0.14;      // its white Juliet railing
      for (let i = 0; i <= 10; i++) { const x = x0 + ((x1 - x0) * i) / 10; strip(B, 'white', x - 0.011, y0, x + 0.011, y1, z); }
      for (const y of [y0, y1]) B.boxXZ('white', x0, x1, y - 0.02, y + 0.02, 0, z + 0.012, { bottom: true }); }
    // the oval window in its ring of buff brick
    { const el = (r, i) => { const a = (i / n) * Math.PI * 2; return [oc[0] + Math.cos(a) * (or[0] + r), oc[1] + Math.sin(a) * (or[1] + r)]; };
      paneShape(B, Array.from({ length: n }, (_, i) => el(0, i)), 0.014);
      for (let i = 0; i < n; i++) { const a = el(0, i), b = el(0, i + 1), d = el(0.14, i + 1), e = el(0.14, i); B.poly(BUFF, [[a[0], a[1], 0.015], [b[0], b[1], 0.015], [d[0], d[1], 0.015], [e[0], e[1], 0.015]], [0, 0, 1]); } }
    bayReturns(B, RED, w, C.nBay.n, L.nBayEaves, L.eaves, tE, { band: BUFF, bands: [L.bandLo, L.bandHi] });
    bayRoof(B, SLATE, w, L.nBayEaves, L.nBayApex, C.nBay.n + 4.2, { barge: DARK });
  });

  // ================================================================= the north side (a guess: plain bays of two-light casements)
  const nb = (cs) => cheap(cs.flatMap((c) => [W2(c, 0), W2(c, 1)]));
  buffWall(P.Q, P.R, nb([1.9, 5.5, 9.0]), tE, { gablets: [5.4], pipes: [0.25] });      // (gablets on this side: counted on the 2026 satellite picture)
  buffWall(P.U, P.V, cheap([W2(2.45, 1)]), tE, { gablets: [2.45], then: () => { B.unit('doorDark', rectPts(1.95, 0.03, 2.95, 2.13), 0.014); strip(B, RED, 1.89, 2.13, 3.01, 2.13 + L.head, 0.014); } });      // a back door (a guess)
  buffWall(P.V, P.n4, nb([1.9, 5.2, 8.5]), tW, { gablets: [3.55, 6.85], pipes: [10.2] });
  buffWall(P.n1, P.A, nb([2.2, 5.95, 9.7]), tW, { gablets: [4.6], pipes: [11.65] });

  // ================================================================= the ends
  const end = (p0, p1, tp, wins, o = {}) => onFace(B, p0, p1, (len) => {
    strip(B, RED, 0, 0, len, L.plinth);
    wallFace(B, BUFF, [[0, L.plinth], [len, L.plinth], [len, L.eaves], [len / 2, L.eaves + (len / 2) * tp], [0, L.eaves]], cheap(wins(len)), { head: RED });
    for (const s of [0, 1]) { const xe = s ? len + 0.25 : -0.25, y = L.eaves - 0.25 * tp; B.poly(DARK, [[xe, y - 0.13, 0.2], [len / 2, L.ridge - 0.13, 0.2], [len / 2, L.ridge, 0.2], [xe, y, 0.2]], [0, 0, 1]); }
    if (o.then) o.then(len);
  });
  // the east gable, towards Nelson Street: red brick (2026 street pictures), a white box window at the first floor and
  // a window over it (planning photograph p2); its ground floor is hidden behind the street wall (a guess)
  onFace(B, P.P, P.Q, (len) => {
    const c = len / 2;
    wallFace(B, RED, [[0, 0], [len, 0], [len, L.eaves], [c, L.eaves + c * tE], [0, L.eaves]], cheap([W2(2.9, 0), W2(len - 2.9, 0), [c - 0.5, 6.3, c + 0.5, 7.45, { floor: 2 }]]));
    bands(B, BUFF, 0, len, [L.bandLo, L.bandHi], [[2.375, 3.425], [len - 3.425, len - 2.375]]);
    boxWindow(B, c, FF[0] - 0.1, FF[1] + 0.05, 1.9, 0.35, 3);
    for (const s of [0, 1]) { const xe = s ? len + 0.25 : -0.25, y = L.eaves - 0.25 * tE; B.poly(DARK, [[xe, y - 0.13, 0.2], [c, L.ridge - 0.13, 0.2], [c, L.ridge, 0.2], [xe, y, 0.2]], [0, 0, 1]); }
  });
  // the west gable, towards the canal, with its gabled projection
  end(P.A, P.F, tW, (len) => [W2(2.0, 0), W2(len - 1.7, 0), W2(2.0, 1), W2(len - 1.7, 1)]);
  onFace(B, P.C, P.D, (w) => {
    wallFace(B, RED, gable(w, L.wBayEaves, L.wBayApex), cheap([[w / 2 - 0.775, GF[0], w / 2 + 0.775, GF[1], { floor: 0 }], [w / 2 - 0.775, FF[0], w / 2 + 0.775, FF[1], { floor: 1 }]]));
    bands(B, BUFF, 0, w, [L.bandLo, L.bandHi]);
    bayReturns(B, RED, w, C.wBay.w, L.wBayEaves, 99, 1, { band: BUFF, bands: [L.bandLo, L.bandHi] });
    bayRoof(B, SLATE, w, L.wBayEaves, L.wBayApex, C.wBay.w, { barge: DARK });
  });

  // ================================================================= the main roof: two wings meeting on the line of the bend
  { const ov = 0.3, og = 0.25, y = (t) => L.eaves - ov * t, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const nW = [-WF.uz, WF.ux], nE = [-EF.uz, EF.ux], k = ov / (1 + nW[0] * nE[0] + nW[1] * nE[1]), m = [(nW[0] + nE[0]) * k, (nW[1] + nE[1]) * k];
    const Ks = [P.K[0] + m[0], P.K[1] + m[1]], Vn = [P.V[0] - m[0], P.V[1] - m[1]], Rb = mid(P.K, P.V);
    const Fs = WF.pt(-og, ov), An = WF.pt(-og, -C.depthW - ov), R0 = WF.pt(-og, -C.depthW / 2);
    const Ps = EF.pt(C.lenE + og, ov), Qn = EF.pt(C.lenE + og, -C.depthE - ov), Re = EF.pt(C.lenE + og, -C.depthE / 2);
    const q = (p, h) => [p[0], h, p[1]], up = (n) => [n[0], 1.2, n[1]];
    const slope = (a, b, ra, rb, t, n) => {
      B.poly(SLATE, [q(a, y(t)), q(b, y(t)), q(rb, L.ridge), q(ra, L.ridge)], up(n));
      B.poly(DARK, [q(a, y(t) - 0.15), q(b, y(t) - 0.15), q(b, y(t)), q(a, y(t))], [n[0], 0, n[1]]);      // the gutter board
    };
    slope(Fs, Ks, R0, Rb, tW, nW); slope(Ks, Ps, Rb, Re, tE, nE);
    slope(Vn, An, Rb, R0, tW, [-nW[0], -nW[1]]); slope(Qn, Vn, Re, Rb, tE, [-nE[0], -nE[1]]);
  }

  // ================================================================= the big evergreen by the north-east bay (2026 picture; the height survey has it 4.5 m and flat-topped)
  for (const [x, z, r] of EVERGREEN) shrub(B, 'leafC', x, z, r, 2.0, 9, 0);

  // ================================================================= colliders: the building, the porch's piers and side walls
  const col = game.worldCollider; for (const [x, z, r] of EVERGREEN) col.addCircle(x, z, r * 0.75, { tag: 'planter' });
  const segs = col.addPolygon(canalSolid(), { tag: 'building' }); if (segs) for (const s of segs) s.h = L.ridge;
  { const F = mk(P.M, P.N), S = (a0, b0, a1, b1) => { const a = F.pt(a0, b0), b = F.pt(a1, b1); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'building' }); };
    S(0, 0, PORCH.arch[0], 0); S(PORCH.arch[1], 0, F.L, 0); S(F.L, 0, F.L, -C.porch.s); S(0, 0, 0, -C.porch.s); }
}

// ---- the porch bay (the photograph): on its front, from the west, a strip of wall, a narrow open slot with a sill,
// a pier, and the buff segmental arch springing from the pier to the east pier; the buff band of the springing runs on
// over the slot to the corner. Dark doors in the main wall behind, a round light on the plastered ceiling; over the
// arch a wide white box window; a gable with a small triangular light (its top is above the photograph's edge)
export const PORCH = { slot: [0.65, 1.2, 0.75], arch: [1.75, 4.25], t: 0.33, door: [1.7, 2.15] };
function porch(B) {
  const P = CP, C = CB, proj = C.porch.s, { t, slot } = PORCH, [xa0, xa1] = PORCH.arch, ys = L.archSpring, rise = L.archRise, ceil = L.porchCeil, xc = (xa0 + xa1) / 2;
  onFace(B, P.M, P.N, (w) => {
    const n = 10, arc = Array.from({ length: n + 1 }, (_, i) => { const f = i / n; return [xa0 + (xa1 - xa0) * f, ys + rise * Math.sin(f * Math.PI)]; });
    const under = [[0, 0], [xa0, 0], ...arc, [xa1, 0], [w, 0]], hole = rectPts(slot[0], slot[2], slot[1], L.bandHi[0]);
    // the front: the arch, the slot, the buff bands, the ring of buff voussoirs
    B.face(RED, [...under, [w, L.porchEaves], [w / 2, L.porchApex], [0, L.porchEaves]], [hole]);
    bands(B, BUFF, 0, w, [L.bandLo, L.bandHi], [[xa0, xa1]]);
    for (let i = 0; i < n; i++) { const a = arc[i], b = arc[i + 1]; B.poly(BUFF, [[a[0], a[1], 0.015], [b[0], b[1], 0.015], [b[0], b[1] + 0.28, 0.015], [a[0], a[1] + 0.28, 0.015]], [0, 0, 1]); }
    B.reveal(RED, [[xa0, 0], [xa1, 0], ...arc.slice().reverse()], 0, -t, true);
    B.reveal(RED, hole, 0, -t); strip(B, 'stoneDress', slot[0] - 0.04, slot[2] - 0.07, slot[1] + 0.04, slot[2], 0.02);      // the slot's sill
    // inside: the back of the front wall, the plastered ceiling, the main wall with the doors
    B.face(RED, [...under, [w, ceil], [0, ceil]], [hole], -t, true);
    B.poly('white', [[0, ceil, -proj], [w, ceil, -proj], [w, ceil, -t], [0, ceil, -t]], [0, -1, 0]);
    B.push(T(0, 0, -proj));
    { const dx0 = xc - PORCH.door[0] / 2, dx1 = xc + PORCH.door[0] / 2;
      B.face(RED, rectPts(t, 0, w - t, ceil), [rectPts(dx0, 0.02, dx1, PORCH.door[1])]); B.reveal(RED, rectPts(dx0, 0.02, dx1, PORCH.door[1]), 0, -0.12, true);
      B.unit('doorDark', rectPts(dx0, 0.02, xc, PORCH.door[1]), -0.12); B.unit('doorDark', rectPts(xc, 0.02, dx1, PORCH.door[1]), -0.12);
      B.cyl('lampGlass', xc, ceil - 0.06, proj / 2, 0.16, 0.05, 8, false); }      // the round light on the ceiling
    B.pop();
    // the sides, outside and in
    onReturn(B, 0, -proj, 0, (d) => { B.face(RED, rectPts(0, 0, d, L.porchEaves)); bands(B, BUFF, 0, d, [L.bandLo, L.bandHi]); });
    onReturn(B, t, -t, -proj, (d) => { B.face(RED, rectPts(0, 0, d, ceil)); });
    onReturn(B, w, 0, -proj, (d) => { B.face(RED, rectPts(0, 0, d, L.porchEaves)); bands(B, BUFF, 0, d, [L.bandLo, L.bandHi]); B.unit('sash', rectPts(d / 2 - 0.27, FF[0], d / 2 + 0.27, FF[1]), 0.014, bay(1)); });      // (its narrow first-floor light: 2026 street pictures)
    onReturn(B, w - t, -proj, -t, (d) => { B.face(RED, rectPts(0, 0, d, ceil)); });
    // above the main roof: the bay's side walls
    for (const [x, s] of [[0, -1], [w, 1]]) B.poly(RED, [[x, L.eaves, -proj], [x, L.porchEaves, -proj], [x, L.porchEaves, -proj - (L.porchEaves - L.eaves) / tE]], [s, 0, 0]);
    // the white box window over the arch, the window in the gable
    boxWindow(B, xc, FF[0] + 0.1, FF[1] + 0.2, 3.4, 0.3, 3, { transom: 0.6 });
    B.unit('sash', rectPts(w / 2 - 0.45, 6.95, w / 2 + 0.45, 7.85), 0.014, bay(2));      // the small window in the gable (2026 street pictures)
    bayRoof(B, SLATE, w, L.porchEaves, L.porchApex, proj + C.depthE / 2, { barge: DARK });
  });
}

// ---- the oriel of the photograph: a white timber bay of three lights on two shaped brackets at the first floor, its
// little gabled roof tied into the main one, the gable boarded white
function oriel(B, xc) {
  const wd = 2.6, d = 0.7, y0 = FF[0] - 0.15, y1 = FF[1] + 0.05, hw = wd / 2 + 0.12, ya = y1 + 0.95, zf = d + 0.12, zr = -(ya - L.eaves) / tW;
  boxWindow(B, xc, y0, y1, wd, d, 3);
  B.boxXZ('white', xc - wd / 2 + 0.12, xc + wd / 2 - 0.12, y0 - 0.34, y0 - 0.1, 0, d - 0.1, { bottom: true });      // the moulded base
  for (const s of [-1, 1]) { const x = xc + s * 0.8; for (const e of [-0.03, 0.03]) B.poly('white', [[x + e, y0 - 0.34, 0], [x + e, y0 - 0.34, d - 0.14], [x + e, y0 - 1.05, 0]], [e, 0, 0]); B.poly('white', [[x - 0.03, y0 - 0.34, d - 0.14], [x + 0.03, y0 - 0.34, d - 0.14], [x + 0.03, y0 - 1.05, 0], [x - 0.03, y0 - 1.05, 0]], [0, -1, 1]); }
  B.poly('white', [[xc - wd / 2, y1 + 0.07, d + 0.02], [xc + wd / 2, y1 + 0.07, d + 0.02], [xc, ya - 0.1, d + 0.02]], [0, 0, 1]);      // the boarded gable
  for (const s of [-1, 1]) {
    B.poly(SLATE, [[xc + s * hw, y1 + 0.02, zf], [xc, ya, zf], [xc, ya, zr], [xc + s * hw, y1 + 0.02, 0]], [s, 1, 0]);
    B.poly(DARK, [[xc + s * hw, y1 - 0.1, zf], [xc, ya - 0.12, zf], [xc, ya, zf], [xc + s * hw, y1 + 0.02, zf]], [0, 0, 1]);
  }
}
