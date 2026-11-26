// Somerville College, STANDALONE model: part 'hodgkin' build functions: the Dorothy Hodgkin Quad and the Margaret
// Thatcher Centre round their raised court, Radcliffe House and its glazed link, the Lisa Minoprio Garden, the covered
// way from the Hall - Maitland loggia passage, and the Oratory's block w303766520. Called by somerville_hodgkin.js with
// ctx.B in the college's LOCAL frame. Every figure is a named constant in _somerville_hodgkin_plan.js (source, K / G).
// Helpers the kit does not have (written here): a wall face of a plan box in its own frame (face), a face on any LOCAL
// segment turned to look away from a point (faceSeg), the DHQ window bay (glass, dark panel band, glass in one deep
// opening), eaves soffits, globe lamps reporting their light in LOCAL coordinates, iron railings, an asymmetric pitched
// roof (the east range), draping a polygon with holes exactly (triangulated first, so no ground key overlaps another).
import * as P from './_somerville_hodgkin_plan.js';
import { F as HF, LINK, MAIT, KIT } from './_somerville_hall_plan.js';

let K = null, B = null, ctx = null, S = null, INV = null;
const V3 = { x: 0, y: 0, z: 0 };

// ------------------------------------------------------------------------------------------------ small helpers
const rect = (x0, y0, x1, y1) => K.rectPts(Math.min(x0, x1), y0, Math.max(x0, x1), y1);
const R = (a0, a1, b0, b1) => [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
/** a point of the CURRENT Batch frame -> LOCAL [u, y, v] */
function toLocal(x, y, z) { const v = new K.THREE.Vector3(x, y, z).applyMatrix4(B.m).applyMatrix4(INV); V3.x = v.x; return [v.x, v.y, v.z]; }
/** the lowest surveyed ground under a box of a frame (F null = LOCAL), less FOOT: where a wall's foot goes */
function footOf(F, a0, a1, b0, b1) {
  let lo = Infinity;
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 4; j++) { const a = a0 + ((a1 - a0) * i) / 6, b = b0 + ((b1 - b0) * j) / 4; lo = Math.min(lo, F ? F.groundY(a, b) : S.groundY(a, b)); }
  return lo - P.FOOT;
}
// the four faces of a plan box [s0, s1, t0, t1] in the current frame (x = s, z = t); the face's x runs as noted
const FR = {
  T1: (b) => [K.frame(b[0], 0, b[3], 1, 0), b[1] - b[0]],      // looks +t; x = s - s0
  T0: (b) => [K.frame(b[1], 0, b[2], -1, 0), b[1] - b[0]],     // looks -t; x = s1 - s
  S1: (b) => [K.frame(b[1], 0, b[3], 0, -1), b[3] - b[2]],     // looks +s; x = t1 - t
  S0: (b) => [K.frame(b[0], 0, b[2], 0, 1), b[3] - b[2]],      // looks -s; x = t - t0
};
function face(side, box, y0, y1, ops = [], key = 'dhqBlock', o = {}) {
  const [fm, len] = FR[side](box);
  K.wall(B, fm, rect(o.x0 ?? 0, y0, o.x1 ?? len, y1), ops, key);
  return [fm, len];
}
/** a wall on a LOCAL segment p -> q (no frame pushed) turned to look away from the point `inside` */
function faceSeg(p, q, y0, y1, ops, key, inside) {
  let a = p, b = q; const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ax = (b[0] - a[0]) / L, az = (b[1] - a[1]) / L;
  if (-az * (inside[0] - (a[0] + b[0]) / 2) + ax * (inside[1] - (a[1] + b[1]) / 2) > 0) { a = q; b = p; }
  const fm = K.frame(a[0], 0, a[1], (b[0] - a[0]) / L, (b[1] - a[1]) / L);
  K.wall(B, fm, rect(0, y0, L, y1), ops.map((op) => ({ ...op, pts: op.f ? rect(op.f * L - op.w / 2, op.y0, op.f * L + op.w / 2, op.y1) : op.pts })), key);
  return [fm, L];
}
/** a sash window op (x centre, w, sill, head) */
const sash = (x, w, y0, y1, o = {}) => ({ pts: rect(x - w / 2, y0, x + w / 2, y1), kind: 'win', glass: 'sash', d: 0.2, ...o });
/** a dark-framed casement op (the DHQ's) */
const casement = (x, w, y0, y1, o = {}) => ({ pts: rect(x - w / 2, y0, x + w / 2, y1), kind: 'win', glass: 'glassDark', lights: 2, mullionKey: 'frame', mullionW: 0.07, d: 0.16, sillKey: 'dhqBlock', ...o });
// THE DHQ BAY: a ground-floor window (deck + 0.6 .. + 2.2), a dark slate-hung panel band, a first-floor window (+ 3.0 ..
// + 4.55), all in one deep opening (photo J Cairns 2021). Returns the wall's op; dhqInfill draws what is in it.
const BAY_W = 1.9, BAY_D = 0.16;
const dhqOp = (x, deck = P.DECK) => ({ pts: rect(x - BAY_W / 2, deck + 0.6, x + BAY_W / 2, deck + 4.55), kind: 'void', d: BAY_D });
function dhqInfill(fm, xs, deck = P.DECK) {
  B.push(fm);
  const z = -BAY_D + 0.02;
  for (const x of xs) {
    const x0 = x - BAY_W / 2, x1 = x + BAY_W / 2;
    for (const [y0, y1, tr] of [[deck + 0.6, deck + 2.2, deck + 1.75], [deck + 3.0, deck + 4.55, deck + 4.05]]) {
      B.unit('glassDark', rect(x0, y0, x, y1), z, K.nextBay(y0)); B.unit('glassDark', rect(x, y0, x1, y1), z, K.nextBay(y0));
      B.box('frame', x, (y0 + y1) / 2, z + 0.03, 0.07, y1 - y0, 0.06);
      B.box('frame', (x0 + x1) / 2, tr, z + 0.03, BAY_W, 0.06, 0.06);
      for (const xx of [x0 + 0.03, x1 - 0.03]) B.box('frame', xx, (y0 + y1) / 2, z + 0.03, 0.06, y1 - y0, 0.06);
    }
    B.box('leadDark', x, deck + 2.6, z + 0.04, BAY_W, 0.8, 0.08);      // the slate-hung panel between the floors
  }
  B.pop();
}
/** the deep eaves' soffit and fascia along a face (photo: deep eaves on exposed rafters, dark) */
function soffit(fm, len, y, ov = 0.6, x0 = 0, x1 = len) { B.push(fm); B.box('leadDark', (x0 + x1) / 2, y - 0.07, ov / 2, x1 - x0 + ov, 0.14, ov, 0, { bottom: true }); for (let x = x0 + 0.45; x < x1; x += 0.9) B.box('timberGrey', x, y - 0.2, ov / 2, 0.07, 0.12, ov - 0.05); B.pop(); }
function pipes(fm, xs, y0, y1) { B.push(fm); for (const x of xs) B.cyl('ironBlack', x, y0, 0.1, 0.05, y1 - y0, 6, false, 0.05); B.pop(); }
/** a globe wall lamp on a short bracket (photo), its light registered */
function globe(fm, x, y) {
  B.push(fm);
  B.box('ironBlack', x, y - 0.16, 0.1, 0.04, 0.04, 0.2);
  B.box('lampGlass', x, y, 0.27, 0.26, 0.26, 0.26, 0, { bottom: true });
  const l = toLocal(x, y, 0.27); B.pop(); ctx.lamp(l[0], l[1], l[2]);
}
/** an iron railing along a LOCAL polyline at level y (top rail 1.05) */
function railing(line, y) {
  K.parapet(B, 'ironBlack', line, y + 1.0, 0.05, 0.05); K.parapet(B, 'ironBlack', line, y + 0.12, 0.04, 0.04);
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.2));
    for (let k = 0; k <= n; k++) { const f = k / n; B.box('ironBlack', a[0] + (b[0] - a[0]) * f, y + 0.52, a[1] + (b[1] - a[1]) * f, 0.05, 1.04, 0.05); }
    for (let k = 0; k < n * 8; k++) { const f = (k + 0.5) / (n * 8); B.box('ironBlack', a[0] + (b[0] - a[0]) * f, y + 0.56, a[1] + (b[1] - a[1]) * f, 0.018, 0.88, 0.018, 0, { top: false }); }
  }
}
/** a ground key draped over a polygon with holes: triangulated first so the pieces meet exactly (ground keys are drawn
 *  by LAYER at a distance, so a flower bed must never lie over a path or a lawn) */
function drapeHoles(key, outer, holes, dy) {
  const T = K.THREE, V = (r) => r.map((p) => new T.Vector2(p[0], p[1]));
  const all = [...outer, ...holes.flat()], tris = T.ShapeUtils.triangulateShape(V(outer), holes.map(V));
  for (const t of tris) ctx.G.drape(B, key, t.map((i) => all[i]), dy);
}
const oval = (c, n = 24) => Array.from({ length: n }, (_, i) => [c.u + c.ru * Math.cos((i / n) * Math.PI * 2), c.v + c.rv * Math.sin((i / n) * Math.PI * 2)]);
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

// ------------------------------------------------------------------------------------------------ THE DHQ EAST RANGE (in its own frame)
/** the asymmetric roof between s0 and s1 (current frame = P.EF) with gables at both ends */
function asymRoof(s0, s1) {
  const E = P.E, ov = E.ov, tWo = E.tW + ov, yWo = P.EAVES - (ov * (E.ridge - P.EAVES)) / (E.tW - E.ridgeT), tEo = E.tE - 0.3, yEo = E.eaveBack - (0.3 * (E.ridge - E.eaveBack)) / (E.ridgeT - E.tE);
  B.poly('slate', [[s0 - 0.15, yWo, tWo], [s1 + 0.15, yWo, tWo], [s1 + 0.15, E.ridge, E.ridgeT], [s0 - 0.15, E.ridge, E.ridgeT]], [0, 1, 1]);
  B.poly('slate', [[s0 - 0.15, yEo, tEo], [s1 + 0.15, yEo, tEo], [s1 + 0.15, E.ridge, E.ridgeT], [s0 - 0.15, E.ridge, E.ridgeT]], [0, 1, -1]);
  for (const [s, h] of [[s0, -1], [s1, 1]]) B.poly('dhqBlock', [[s, P.EAVES, E.tW], [s, E.ridge, E.ridgeT], [s, E.eaveBack, E.tE], [s, P.EAVES, E.tE]], [h, 0, 0]);
  B.box('leadDark', (s0 + s1) / 2, E.ridge + 0.04, E.ridgeT, s1 - s0 + 0.3, 0.1, 0.3);      // ridge capping
}
function eastRange() {
  const E = P.E, F = P.EF;
  B.push(F.M);
  for (const [s0, s1, bays] of [[E.e1[0], E.e1[1], E.bays1], [E.e2[0], E.e2[1], E.bays2]]) {
    const box = [s0, s1, E.tE, E.tW], foot = footOf(F, s0, s1, E.tE, E.tW);
    // the court face: two storeys over the deck in the photo's bays
    const [fw, lw] = face('T1', box, foot, P.EAVES, bays.map((x) => dhqOp(x)));
    dhqInfill(fw, bays); soffit(fw, lw, P.EAVES, E.ov); pipes(fw, [0.35, lw - 0.35], P.DECK, P.EAVES - 0.1);
    for (let i = 0; i < bays.length - 1; i++) globe(fw, (bays[i] + bays[i + 1]) / 2, P.DECK + 2.3);
    // the back on the shops: three storeys (G)
    const back = []; for (let x = 1.7; x < lw - 1; x += E.pitch) back.push(x);
    const [fb] = face('T0', box, foot, E.eaveBack, [...back.map((x) => casement(x, 1.5, 1.7, 3.4)), ...back.map((x) => casement(x, 1.5, P.DECK + 0.8, P.DECK + 2.2)), ...back.map((x) => casement(x, 1.5, P.DECK + 3.1, P.DECK + 4.5))]);
    void fb;
    face('S0', box, foot, P.EAVES); face('S1', box, foot, P.EAVES);
    asymRoof(s0, s1);
    ctx.solid(F.ring(R(s0, s1, E.tE, E.tW)));
  }
  // the slot between the two blocks: a lower filler at the back (G)
  { const s0 = E.e1[1], s1 = E.e2[0], box = [s0, s1, E.tE, E.slotBack], foot = footOf(F, s0, s1, E.tE, E.slotBack);
    face('T1', box, P.DECK - 0.2, 7.5, [{ pts: rect(0.2, P.DECK, s1 - s0 - 0.2, P.DECK + 2.3), kind: 'win', glass: 'glassDark', lights: 2, mullionKey: 'frame', d: 0.12, sill: false }]);
    face('T0', box, foot, 7.5); B.flat('leadDark', R(s0, s1, E.tE, E.slotBack), 7.5); ctx.solid(F.ring(R(s0, s1, E.tE, E.slotBack))); }
  // the narrower north end, flat-roofed
  { const n = E.n, box = [n.s0, n.s1, E.tE, n.tW], foot = footOf(F, n.s0, n.s1, E.tE, n.tW);
    const [fw] = face('T1', box, foot, n.top, [dhqOp(2.0)]); dhqInfill(fw, [2.0]);
    face('S0', box, foot, n.top, [casement(1.8, 1.4, 1.8, 3.4), casement(1.8, 1.4, P.DECK + 0.8, P.DECK + 2.2), casement(1.8, 1.4, P.DECK + 3.1, P.DECK + 4.5)]);
    face('T0', box, foot, n.top);
    B.flat('leadDark', R(n.s0, n.s1, E.tE, n.tW), n.top - 0.15);
    K.parapet(B, 'dhqBlock', [[n.s0, E.tE], [n.s0, n.tW], [n.s1, n.tW]], n.top - 0.3, 0.42, 0.25, { coping: 'leadDark' });
    ctx.solid(F.ring(R(n.s0, n.s1, E.tE, n.tW))); }
  B.pop();
}

// ------------------------------------------------------------------------------------------------ THE MTC: west ranges, south range, pavilion, deck
function mtcRanges() {
  const W = P.W, W2 = P.W2, SR = P.SR;
  // the west range (court face on u 84.6)
  { const box = [W.u0, W.u1, W.v0, W.v1], foot = footOf(null, ...box);
    const xs = P.BAYS_W.map((v) => W.v1 - v), [fe, le] = face('S1', box, foot, P.EAVES, xs.map((x) => dhqOp(x)));
    dhqInfill(fe, xs); soffit(fe, le, P.EAVES, 0.6, 0, le - 0.3); pipes(fe, [0.3, 4.5, 11.2], P.DECK, P.EAVES - 0.1);
    globe(fe, W.v1 - 52.2, P.DECK + 2.3); globe(fe, W.v1 - 58.7, P.DECK + 2.3);
    const xw = [1.8, 5.3], [fw, lw] = face('S0', box, foot, P.EAVES, xw.map((x) => dhqOp(x)), 'dhqBlock', { x1: W2.v0 - W.v0 });
    dhqInfill(fw, xw); soffit(fw, lw, P.EAVES, 0.6, 0, W2.v0 - W.v0);
    face('T0', box, foot, P.EAVES);
    K.roof(B, 'slate', W.u0, W.u1, W.v0, W.roofTo, P.EAVES, W.rise, { axis: 'z', ends: ['gable', 'open'], ov: 0.6, wallKey: 'dhqBlock' });
    ctx.solid(R(W.u0, W.u1, W.v0, W.v1)); }
  // its wider south part: the MTC's glazed entrance on the garden (west) side over the steps
  { const box = [W2.u0, W2.u1, W2.v0, W2.v1], foot = footOf(null, ...box), st = P.STEPS;
    const [fw, lw] = face('S0', box, foot, P.EAVES, [{ pts: rect(0.45, st.top, lw0(box) - 0.45, 3.95), kind: 'win', glass: 'glassDark', lights: 4, mullionKey: 'frame', mullionW: 0.08, transoms: [3.0], d: 0.22, sill: false, revealKey: 'dhqBlock' }, dhqOp(1.4), dhqOp(4.3)]);
    dhqInfill(fw, [1.4, 4.3]); soffit(fw, lw, P.EAVES, 0.6);
    B.push(fw); for (const x of [0.2, lw - 0.2]) { const l = K.lantern(B, x, 3.35, 0.16, { size: 0.24 }); const q = toLocal(...l); ctx.lamp(q[0], q[1], q[2]); } B.pop();
    B.push(fw); B.box('leadDark', lw / 2, 4.05, 0.5, lw - 0.3, 0.12, 1.0, 0, { bottom: true }); B.pop();      // a canopy over the doors (G)
    const [fn] = face('T0', box, foot, P.EAVES, [dhqOp(1.45)]); dhqInfill(fn, [1.45]);
    K.roof(B, 'slate', W2.u0, W.u1, W2.v0, W2.roofTo, P.EAVES, W2.rise, { axis: 'z', ends: ['hip', 'open'], ov: 0.6 });
    ctx.solid(R(W2.u0, W2.u1, W2.v0, W2.v1)); }
  // the south range
  { const box = [SR.u0, SR.u1, SR.v0, SR.v1], foot = footOf(null, ...box), len = SR.u1 - SR.u0;
    // court face (only from the east end to the west range)
    const xs = P.BAYS_S.map((u) => SR.u1 - u), rc = P.RECESS, xr0 = SR.u1 - rc.u1, xr1 = SR.u1 - rc.u0;
    const [fc] = face('T0', box, foot, P.EAVES, [...xs.map((x) => dhqOp(x)), { pts: rect(xr0 + 0.05, P.DECK, xr1, P.DECK + 2.6), kind: 'void', d: rc.v1 - SR.v0 }], 'dhqBlock', { x1: SR.u1 - P.W.u1 });
    dhqInfill(fc, xs); soffit(fc, SR.u1 - P.W.u1, P.EAVES, 0.6); globe(fc, SR.u1 - 88.2, P.DECK + 2.3);
    B.push(fc); B.unit('doorDark', rect(xr0 + 0.8, P.DECK, xr0 + 1.9, P.DECK + 2.25), -(rc.v1 - SR.v0) + 0.02); B.flat('plasterLit', R(xr0, xr1, -(rc.v1 - SR.v0), 0).map(([x, z]) => [x, z]), P.DECK + 2.6, [], true); B.pop();
    const south = []; for (let x = 1.8; x < len - 1; x += P.E.pitch) south.push(x);
    face('T1', box, foot, P.EAVES, [...south.map((x) => casement(x, 1.5, 1.6, 3.3)), ...south.map((x) => casement(x, 1.5, P.DECK + 0.8, P.DECK + 2.2)), ...south.map((x) => casement(x, 1.5, P.DECK + 3.1, P.DECK + 4.5))]);
    const ws = [2.0, 6.0], [fw, lw] = face('S0', box, foot, P.EAVES, [...ws.map((x) => casement(x, 1.5, 1.6, 3.3)), ...ws.map((x) => dhqOp(x))]);
    dhqInfill(fw, ws); soffit(fw, lw, P.EAVES, 0.6); pipes(fw, [0.3], foot + 0.3, P.EAVES - 0.1);
    K.roof(B, 'slate', SR.u0, SR.u1, SR.v0, SR.v1, P.EAVES, SR.rise, { axis: 'x', ends: ['hip', 'open'], ov: 0.6 });
    ctx.solid(R(SR.u0, SR.u1, SR.v0, SR.v1)); }
}
const lw0 = (box) => box[3] - box[2];

function pavilion() {
  const p = P.PAV, box = [p.u0, p.u1, p.v0, p.vFront], foot = Math.min(footOf(null, ...box), P.ORATORY_YARD - P.FOOT);
  const slope = (p.ridge - p.eaves) / ((p.vPost - p.v0) / 2), frontTop = p.eaves + (p.vPost - p.vFront) * slope;
  const d = P.PAV_DOOR, xd = d.u - p.u0;
  face('T1', box, P.DECK - 0.3, frontTop, [
    { pts: rect(0.8, P.DECK, xd - 0.75, P.DECK + 2.6), kind: 'win', glass: 'glassDark', lights: 3, mullionKey: 'frame', mullionW: 0.08, transoms: [P.DECK + 2.1], d: 0.12, sill: false },
    { pts: rect(xd - d.w / 2, P.DECK, xd + d.w / 2, P.DECK + d.h), kind: 'door', doorKey: 'oakDoor', d: 0.15 },
    { pts: rect(xd + 0.75, P.DECK, p.u1 - p.u0 - 0.8, P.DECK + 2.6), kind: 'win', glass: 'glassDark', lights: 3, mullionKey: 'frame', mullionW: 0.08, transoms: [P.DECK + 2.1], d: 0.12, sill: false }]);
  const [fn] = face('T0', box, foot, p.eaves, [0.25, 0.5, 0.75].map((f) => casement(f * (p.u1 - p.u0), 1.2, P.DECK + 1.0, P.DECK + 2.1)));
  void fn;
  face('S1', box, foot, p.eaves);
  // the buff piers at the front and the beam on them; the loggia's ceiling
  for (const u of p.posts) { B.box('dhqBlock', u, (P.DECK + p.eaves) / 2, p.vPost, 0.42, p.eaves - P.DECK, 0.42); ctx.solid(R(u - 0.21, u + 0.21, p.vPost - 0.21, p.vPost + 0.21)); }
  B.box('timberGrey', (p.u0 + p.u1) / 2, p.eaves - 0.12, p.vPost, p.u1 - p.u0, 0.26, 0.3);
  B.flat('plasterLit', R(p.u0, p.u1, p.vFront, p.vPost), p.eaves - 0.25, [], true);
  K.roof(B, 'slate', p.u0, p.u1, p.v0, p.vPost, p.eaves, p.ridge - p.eaves, { axis: 'x', ends: ['hip', 'hip'], ov: p.ov });
  // globe lamps either side of the door (photo)
  const [ff] = FR.T1(box); globe(ff, 1.4, P.DECK + 2.2); globe(ff, p.u1 - p.u0 - 1.6, P.DECK + 2.2);
  ctx.solid(R(p.u0, p.u1, p.v0, p.vFront));
}

function deck() {
  const D = P.DECK;
  B.flat('pavingSolid', P.DECK_RING, D);
  ctx.floor(P.DECK_RING, D);
  // the strip east of the slot: its outer walls from the yard up to the deck, iron railings on top
  const strip = [[96.9, 48.6], [96.9, 42.6], [98.3, 42.6], [98.3, 38.6], [105.6, 38.6]], inside = [101.5, 44.0];
  for (let i = 0; i < strip.length - 1; i++) {
    const a = strip[i], b = strip[i + 1], foot = Math.min(S.groundY(...a), S.groundY(...b)) - P.FOOT;
    faceSeg(a, b, foot, D + 0.05, [], 'dhqBlock', inside); ctx.seg(a[0], a[1], b[0], b[1]);
  }
  railing(strip, D);
  // the glazed lean-to rooflight in the court
  { const r = P.ROOFLIGHT, ring = R(r.u0, r.u1, r.v0, r.v1);
    K.prism(B, 'dhqBlock', ring, D - 0.05, r.yLo - 0.02);
    B.box('dhqBlock', r.u0 + 0.15, (r.yLo + r.yHi) / 2 - 0.1, (r.v0 + r.v1) / 2, 0.3, r.yHi - r.yLo, r.v1 - r.v0);
    const y = (u) => r.yHi + ((r.yLo - r.yHi) * (u - r.u0)) / (r.u1 - r.u0);
    B.poly('glassRoof', [[r.u0 + 0.3, y(r.u0 + 0.3), r.v0], [r.u1, r.yLo, r.v0], [r.u1, r.yLo, r.v1], [r.u0 + 0.3, y(r.u0 + 0.3), r.v1]], [0.3, 1, 0]);
    for (const v of [r.v0, r.v1]) B.poly('glassRoof', [[r.u0 + 0.3, r.yLo - 0.02, v], [r.u1, r.yLo - 0.02, v], [r.u0 + 0.3, y(r.u0 + 0.3), v]], [0, 0, v === r.v0 ? -1 : 1]);
    for (let v = r.v0; v <= r.v1 + 1e-6; v += (r.v1 - r.v0) / 8) B.beam('frame', [r.u0 + 0.3, y(r.u0 + 0.3) + 0.02, v], [r.u1, r.yLo + 0.02, v], 0.05, 0.05);
    ctx.solid(ring); }
  // the raised planter on two steps
  { const p = P.PLANTER;
    B.box('pavingSolid', p.u, D + p.step / 2, p.v, p.base, p.step, p.base); B.box('pavingSolid', p.u, D + p.step * 1.5, p.v, p.base - 0.5, p.step, p.base - 0.5);
    B.box('leadDark', p.u, D + 2 * p.step + p.h / 2, p.v, p.box, p.h, p.box);
    K.tree(B, p.u, p.v, D + 2 * p.step + p.h, 1.6, 0.55, 7);
    ctx.solid(R(p.u - p.base / 2, p.u + p.base / 2, p.v - p.base / 2, p.v + p.base / 2)); }
}

/** the open stair in the slot from the yard's level up to the deck, a shut gate at its foot */
function slotStair() {
  const s = P.SLOT, n = P.STAIR.risers, rise = (P.DECK - P.ORATORY_YARD) / n, g = P.STAIR.going;
  K.steps(B, 'pavingSolid', s.u0 + 0.15, s.u1, s.v1, -1, n - 1, rise, g, P.DECK, P.ORATORY_YARD - 0.3);
  const vBot = s.v1 - (n - 1) * g;
  ctx.floor(R(s.u0, s.u1, s.v0, s.v1), (u, v) => (v >= s.v1 ? P.DECK : v <= vBot ? P.ORATORY_YARD : P.DECK - Math.ceil((s.v1 - v) / g) * rise));
  // handrail on the pavilion side, the gate (iron bars) at the foot, a cycle stand
  B.beam('ironBlack', [s.u0 + 0.08, P.ORATORY_YARD + 0.95, vBot], [s.u0 + 0.08, P.DECK + 0.95, s.v1], 0.045, 0.045);
  for (let u = s.u0 + 0.06; u < s.u1; u += 0.13) B.box('ironBlack', u, P.ORATORY_YARD + 1.0, s.v0, 0.022, 2.0, 0.022);
  B.box('ironBlack', (s.u0 + s.u1) / 2, P.ORATORY_YARD + 1.95, s.v0, s.u1 - s.u0, 0.06, 0.05); B.box('ironBlack', (s.u0 + s.u1) / 2, P.ORATORY_YARD + 0.1, s.v0, s.u1 - s.u0, 0.06, 0.05);
  ctx.seg(s.u0, s.v0, s.u1, s.v0);
  ctx.lamp((s.u0 + s.u1) / 2, P.DECK + 0.8, s.v1 - 1.0);
}

// ------------------------------------------------------------------------------------------------ RADCLIFFE HOUSE and the glazed link
function radcliffe() {
  const F = P.RF, r = P.R2, box = [r.s0, r.s1, r.t0, r.t1];
  B.push(F.M);
  { const foot = footOf(F, ...box), fl = P.FLOOR_R, gf = [fl + 0.8, fl + 2.35], ff = [fl + 3.4, fl + 4.85];
    face('T0', box, foot, r.eaves, [1.5, 4.0, 6.5, 9.0, 11.2].flatMap((x) => [sash(x, 1.0, ...gf), sash(x, 1.0, ...ff)]), 'brick');
    face('T1', box, foot, r.eaves, [sash(0.95, 1.0, ...gf), sash(1.0, 1.0, 4.95, 6.2), sash(3.2, 1.0, 4.95, 6.2), sash(5.4, 1.0, 4.95, 6.2)], 'brick');
    face('S0', box, foot, r.eaves, [sash(2.0, 1.0, 4.6, 6.0)], 'brick');
    face('S1', box, foot, r.eaves, [], 'brick');
    K.roof(B, 'clayTile', r.s0, r.s1, r.t0, r.t1, r.eaves, r.ridge - r.eaves, { axis: 'x', ends: ['hip', 'gable'], ov: 0.3, wallKey: 'brick' });
    K.chimney(B, 'brick', 1.4, 2.2, 1.6, 2.4, r.ridge - 0.6, r.ridge + 1.0, { pots: 2 });
    ctx.solid(F.ring(R(...box))); }
  B.pop();
  // the single-storey west end (1999): flat roof behind a parapet, its door on the garden
  { const q = P.R1, box = [q.u0, q.u1, q.v0, q.v1], foot = footOf(null, ...box), fl = P.FLOOR_R;
    const [fs] = face('T1', box, foot, q.roof, [{ pts: rect(1.0, fl, 2.05, fl + 2.2), kind: 'door', doorKey: 'doorDark', d: 0.18 }], 'brick');
    face('S0', box, foot, q.roof, [casement(1.9, 1.6, fl + 0.8, fl + 2.3)], 'brick');
    face('T0', box, foot, q.roof, [casement(1.5, 1.2, fl + 0.9, fl + 2.3)], 'brick');
    B.flat('leadDark', R(q.u0, q.u1, q.v0, q.v1), q.roof - 0.1);
    K.parapet(B, 'brick', [[q.u1, q.v1], [q.u0, q.v1], [q.u0, q.v0], [q.u1, q.v0]], q.roof - 0.3, 0.62, 0.25, { coping: 'bathDress' });
    B.push(fs); const l = K.lantern(B, 2.45, fl + 2.15, 0.15, { size: 0.22 }); const p = toLocal(...l); B.pop(); ctx.lamp(p[0], p[1], p[2]);
    // the threshold step
    const g = S.groundY(q.u0 + 1.5, q.v1 + 0.4); B.box('pavingSolid', q.u0 + 1.52, (g + fl) / 2, q.v1 + 0.25, 1.5, fl - g + 0.1, 0.5);
    ctx.solid(R(...box)); }
  // the glass-roofed link between the house and the MTC
  { const c = P.LINKG, box = [c.u0, c.u1, c.v0, c.v1], foot = footOf(null, ...box), len = c.v1 - c.v0;
    face('S0', box, foot, c.yLo, [{ pts: rect(0.45, foot + P.FOOT + 0.1, 1.55, foot + P.FOOT + 2.35), kind: 'door', doorKey: 'doorDark', d: 0.12 },
      { pts: rect(2.0, foot + P.FOOT + 0.65, len - 0.2, c.yLo - 0.25), kind: 'win', glass: 'glassDark', lights: 5, mullionKey: 'frame', mullionW: 0.08, d: 0.1, sill: false }], 'dhqBlock');
    face('T1', box, foot, c.yLo, [], 'dhqBlock', { x1: P.W2.u0 - c.u0 });
    B.poly('glassRoof', [[c.u0 - 0.1, c.yLo, c.v0], [c.u1, c.yHi, c.v0], [c.u1, c.yHi, c.v1], [c.u0 - 0.1, c.yLo, c.v1]], [-0.15, 1, 0]);
    for (let v = c.v0; v <= c.v1 + 1e-6; v += len / 8) B.beam('frame', [c.u0 - 0.1, c.yLo + 0.03, v], [c.u1, c.yHi + 0.03, v], 0.06, 0.06);
    B.box('leadDark', c.u0 - 0.05, c.yLo - 0.06, (c.v0 + c.v1) / 2, 0.2, 0.18, len);
    ctx.solid(R(...box)); }
}

// ------------------------------------------------------------------------------------------------ THE MTC's STEPS from the garden
function mtcSteps() {
  const st = P.STEPS, base = S.groundY(st.u0 - 0.3, (st.v0 + st.v1) / 2) + 0.08, n = Math.max(2, Math.round((st.top - base) / 0.17)), rise = (st.top - base) / n, going = (st.u1 - st.u0) / (n - 1), yb = base - 0.4;
  for (let i = 0; i < n; i++) { const u = st.u0 + going * i, y = base + rise * (i + 1); B.box('pavingSolid', (u + st.uLand) / 2, (yb + y) / 2, (st.v0 + st.v1) / 2, st.uLand - u, y - yb, st.v1 - st.v0); }
  B.box('dhqBlock', (st.u0 + st.uLand) / 2, (yb + st.top + 0.45) / 2, st.v1 + 0.12, st.uLand - st.u0 + 0.2, st.top + 0.45 - yb, 0.24);
  ctx.floor(R(st.u0, st.uLand, st.v0, st.v1), (u) => base + rise * Math.min(n, Math.floor(Math.max(0, u - st.u0) / going) + 1));
  ctx.seg(st.u0, st.v1 + 0.12, st.uLand, st.v1 + 0.12);
}

// (THE ORATORY's BLOCK w303766520 is not the college's: the city's own generator draws it from the map since the merge;
// the covered way below still meets its west wall on P.U1's line)

// ------------------------------------------------------------------------------------------------ THE COVERED WAY from the loggia passage
function cwPoints() {
  const P0 = HF.L(LINK.s0, LINK.tE), P1 = HF.L(...KIT.ring[6]), P10 = HF.L(MAIT.sN, LINK.tE), P9 = HF.L(MAIT.sN, MAIT.tBack);
  const sEnd = (P.CW_END_V + 5.02 + 0.0929 * MAIT.tBack) / 0.9957, P8 = HF.L(sEnd, MAIT.tBack);
  const [, P2, P3] = P.BOUND_NE, P4 = P.U1.ring[0], P5 = P.U1.ring[4], P6 = P.U1.ring[3], P7 = P.CW_SOUTH[1];
  return { P0, P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, sEnd };
}
function coveredWay() {
  const c = P.CW, Q = cwPoints();
  // (a) the lean-to over the yard by the passage's east mouth, falling east
  const A = [Q.P0, Q.P1, Q.P2, Q.P3, Q.P10], yA = (u) => c.leanHi - (u - Q.P0[0]) * c.leanFall;
  B.poly('leadDark', A.map((p) => [p[0], yA(p[0]), p[1]]), [0.05, 1, 0]);
  B.poly('plasterLit', A.map((p) => [p[0], yA(p[0]) - c.slab, p[1]]), [0, -1, 0]);
  for (let i = 0; i < A.length; i++) { const p = A[i], q = A[(i + 1) % A.length]; B.poly('leadDark', [[p[0], yA(p[0]) - c.slab, p[1]], [q[0], yA(q[0]) - c.slab, q[1]], [q[0], yA(q[0]), q[1]], [p[0], yA(p[0]), p[1]]], [q[1] - p[1], 0, -(q[0] - p[0])]); }
  // (b) the flat roof down Maitland's back
  const Bm = [Q.P10, Q.P3, Q.P4, Q.P5, Q.P6, Q.P7, Q.P8, Q.P9];
  B.flat('leadDark', Bm, c.flat); B.flat('plasterLit', Bm, c.flat - c.slab, [], true); K.prism(B, 'leadDark', Bm, c.flat - c.slab, c.flat);
  // the posts across the mouth of Maitland's yard
  for (const s of [36.3, 38.45, 40.6, 42.75, 44.55]) { const p = HF.L(s, MAIT.tBack + 0.12), g = S.groundY(...p); B.box('ironBlack', p[0], (g + c.flat) / 2 - 0.1, p[1], c.post, c.flat - g - 0.2, c.post, 0, {}); ctx.solid(R(p[0] - 0.09, p[0] + 0.09, p[1] - 0.09, p[1] + 0.09)); }
  // the rubble boundary wall to the Oratory's higher ground; the brick wall on the east south of the block
  { const L = P.BOUND_NE, foot = Math.min(...L.map((p) => S.groundY(...p))) - P.FOOT; K.parapet(B, 'rubble', L, foot, yA(Q.P2[0]) - foot, 0.4, { bottom: true }); for (let i = 0; i < L.length - 1; i++) ctx.seg(L[i][0], L[i][1], L[i + 1][0], L[i + 1][1]); }
  { const L = P.CW_SOUTH, foot = Math.min(...L.map((p) => S.groundY(...p))) - P.FOOT; K.parapet(B, 'brick', L, foot, c.flat - c.slab - foot, 0.3); ctx.seg(L[0][0], L[0][1], L[1][0], L[1][1]); }
  // lights under the roofs
  for (const [u, v, y] of [[55.0, 24.6, yA(55.0) - c.slab], [49.4, 33.5, c.flat - c.slab], [48.9, 42.5, c.flat - c.slab]]) { B.box('lampGlass', u, y - 0.06, v, 0.5, 0.06, 0.25); ctx.lamp(u, y - 0.15, v); }
  const ring = [Q.P0, Q.P1, Q.P2, Q.P3, Q.P4, Q.P5, Q.P6, Q.P7, Q.P8, Q.P9, Q.P10];
  ctx.floor(ring, (u, v) => S.groundY(u, v) + 0.07);
  return ring;
}

// ------------------------------------------------------------------------------------------------ THE GARDEN's walls, trees
function gardenWalls() {
  for (const L of [P.WALL_N, P.WALL_S]) {
    const gs = L.map((p) => S.groundY(...p)), foot = Math.min(...gs) - P.FOOT, top = Math.max(...gs) + P.WALL_H;
    K.parapet(B, 'brick', L, foot, top - foot, 0.3, { coping: 'bathDress' });
    for (let i = 0; i < L.length - 1; i++) ctx.seg(L[i][0], L[i][1], L[i + 1][0], L[i + 1][1]);
  }
  P.TREES.forEach(([u, v, h, r], i) => K.tree(B, u, v, S.groundY(u, v), h, r, 31 + i));
  P.SHRUBS.forEach(([u, v], i) => K.tree(B, u, v, S.groundY(u, v), 1.6 + (i % 3) * 0.3, 0.9 + (i % 2) * 0.3, 61 + i));
}

// ------------------------------------------------------------------------------------------------ THE GROUND (draped: LOCAL, no frame pushed)
function ground(cwRing) {
  const G = ctx.G, D = P.PATHS;
  G.drape(B, 'pavingSolid', cwRing, 0.07);
  for (const r of [D.north, D.north0, D.west, D.east, P.APRON]) G.drape(B, 'paving', r, 0.08);
  G.strip(B, 'paving', D.south, 1.8, 0.08);
  G.drape(B, 'paving', R(P.SLOT.u0, P.SLOT.u1, P.SLOT.v0, P.SLOT.v1 - (P.STAIR.risers - 1) * P.STAIR.going), 0.07);
  const ovN = oval(P.LAWN_N), ls = P.LAWN_S, lawnS = R(ls.u0, ls.u1, ls.v0, ls.v1);
  G.drape(B, 'lawn', ovN, 0.05); G.drape(B, 'lawn', lawnS, 0.05);
  const b = P.BEDS;
  drapeHoles('flowerbed', b.mid, [ovN], 0.05); drapeHoles('flowerbed', b.southMid, [lawnS], 0.05);
  for (const r of [b.north, b.west, b.southEast, b.south, b.wall]) G.drape(B, 'flowerbed', r, 0.05);
}

export function buildHodgkin(c) {
  ctx = c; B = c.B; K = c.K; S = c.S;
  INV = S.localMatrix().invert();
  K.addCell(c.pack, 'dhqBlock', 'stone', [1.12, 1.0, 0.76], { seed: 0.4 });      // buff reconstituted-stone blockwork (photo J Cairns 2021)
  const t0 = B.tris();
  eastRange(); mtcRanges(); pavilion(); deck(); slotStair();
  radcliffe(); mtcSteps();      // (the Oratory's block w303766520 is the city's own: unnamed() is no longer called)
  const cw = coveredWay(); gardenWalls();
  ground(cw);
  return { tris: Math.round(B.tris() - t0) };
}
