// Exeter College, STANDALONE model: THE LIBRARY's build functions (Scott 1856-7, the stair turret, the annexe, the
// 2021-3 link). Called by exeter_library.js with ctx.B in the college's LOCAL frame; every figure is a named constant in
// _exeter_library_plan.js (with its source and K / G mark). Most of the work is done inside the library's own frame
// (a east along the axis, y up, c south: P.toL converts to LOCAL for colliders, floors and lamps).
// Helpers the kit does not have (written here, not in the kit): bar / bars (flat tracery bars in a wall frame), circ,
// foiled circles, slab (a coping along a rake), arcOf (a pointed arch's arc), inner faces of a ring.
import * as P from './_exeter_library_plan.js';
import { climber } from './_exeter_plants.js';

let K = null;

// ------------------------------------------------------------------------------------------------ small helpers
const circ = (x, y, r, n = 10, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2; return [x + Math.cos(a) * r, y + Math.sin(a) * r]; });
/** a tracery bar in the current wall frame from a to b ([s, y]), w wide, its face at z0, d deep (front + 2 sides) */
function bar(B, key, a, b, w, z0, d) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1e-4) return;
  const px = (-dy / L) * (w / 2), py = (dx / L) * (w / 2), z1 = z0 - d;
  B.poly(key, [[a[0] + px, a[1] + py, z0], [a[0] - px, a[1] - py, z0], [b[0] - px, b[1] - py, z0], [b[0] + px, b[1] + py, z0]], [0, 0, 1]);
  B.poly(key, [[a[0] + px, a[1] + py, z0], [b[0] + px, b[1] + py, z0], [b[0] + px, b[1] + py, z1], [a[0] + px, a[1] + py, z1]], [px, py, 0]);
  B.poly(key, [[a[0] - px, a[1] - py, z0], [b[0] - px, b[1] - py, z0], [b[0] - px, b[1] - py, z1], [a[0] - px, a[1] - py, z1]], [-px, -py, 0]);
}
const bars = (B, key, pts, w, z0, d, closed = false) => { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) bar(B, key, pts[i], pts[(i + 1) % pts.length], w, z0, d); };
/** a foiled circle: a ring of bars with n cusps pointing in */
function foiled(B, key, x, y, r, n, w, z0, d, seg = 10) {
  bars(B, key, circ(x, y, r, seg), w, z0, d, true);
  for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i / n) * Math.PI * 2 + Math.PI / n; bar(B, key, [x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6], w * 0.8, z0, d); }
}
/** the arc of a pointed arch (springing to springing over the apex) */
const arcOf = (x, w, ys, rise, seg = 6) => K.pointedPts(x, w, ys - 1, ys, rise, seg).slice(2);
/** a coping along a rake from a to b ([s, y]) in the current wall frame: h thick, from z0 (front) back to z1 */
function slab(B, key, a, b, h, z0, z1) {
  const A = [a[0], a[1] + h], Bt = [b[0], b[1] + h], nx = -(b[1] - a[1]), ny = b[0] - a[0];
  B.poly(key, [[A[0], A[1], z0], [Bt[0], Bt[1], z0], [Bt[0], Bt[1], z1], [A[0], A[1], z1]], [nx * Math.sign(ny || 1), Math.abs(ny), 0]);
  B.poly(key, [[a[0], a[1], z0], [b[0], b[1], z0], [Bt[0], Bt[1], z0], [A[0], A[1], z0]], [0, 0, 1]);
  B.poly(key, [[a[0], a[1], z1], [b[0], b[1], z1], [Bt[0], Bt[1], z1], [A[0], A[1], z1]], [0, 0, -1]);
}
/** vertical faces of a plan ring seen from INSIDE it (a parapet's back, a link's walls above its roof) */
function innerFaces(B, key, ring, y0, y1) {
  let cx = 0, cz = 0; for (const p of ring) { cx += p[0]; cz += p[1]; } cx /= ring.length; cz /= ring.length;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
    B.poly(key, [[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]], [cx - mx, 0, cz - mz]);
  }
}
/** a rectangle in the library frame -> a LOCAL ring */
const ringL = (a0, a1, c0, c1) => [P.toL(a0, c0), P.toL(a1, c0), P.toL(a1, c1), P.toL(a0, c1)];
/** a gothic window's head tracery: n light heads (small pointed arcs) and a foiled circle over them */
function headTracery(B, x, w, spring, apex, n, z0 = -0.1) {
  const k = 'bathDress', lw = w / n;
  for (let i = 0; i < n; i++) { const a = x - w / 2 + i * lw, b = a + lw; bars(B, k, arcOf((a + b) / 2, lw, spring, Math.min(lw * 0.85, (apex - spring) * 0.55), 4), 0.08, z0, 0.16); }
  const r = Math.min(w * 0.17, (apex - spring) * 0.24); foiled(B, k, x, spring + (apex - spring) * 0.62, r, n === 3 ? 4 : 3, 0.07, z0, 0.16, 8);
}
/** a hood mould over a pointed opening */
const hood = (B, x, w, spring, apex, key = 'bathDress') => bars(B, key, arcOf(x, w + 0.3, spring, apex - spring + 0.18, 7), 0.12, 0.1, 0.1);

// ------------------------------------------------------------------------------------------------ wall frames (library frame)
const FS = () => K.frame(0, 0, P.W, 1, 0);           // south face: s = a
const FN = () => K.frame(P.L, 0, 0, -1, 0);          // north face: s = L - a
const FW = () => K.frame(0, 0, 0, 0, 1);             // west gable: s = c
const FE = () => K.frame(P.L, 0, P.W, 0, -1);        // east gable: s = W - c

const lancetOp = (s) => { const T = P.ARC.lancet; return { pts: K.pointedPts(s, T.w, T.sill, T.spring, T.apex - T.spring, 6), kind: 'win', glass: 'leaded', d: 0.25, sill: false }; };
const wgOp = (s) => ({ pts: K.pointedPts(s, P.WG.w, P.WG.sill, P.WG.spring, P.WG.apex - P.WG.spring, 7), kind: 'win', lights: 2, transoms: [P.WG.transom], d: P.WG.d });

// ------------------------------------------------------------------------------------------------ the long faces
/** the upper arcade in the current (pushed) wall frame: colonnettes at s0 + k pitch for k = 0..n, arches between */
function arcade(B, sAt, n) {
  const A = P.ARC, z = A.proj - A.r;
  const s0 = Math.min(sAt(0), sAt(n)), s1 = Math.max(sAt(0), sAt(n));
  K.stringCourse(B, 'bathDress', s0 - 0.35, s1 + 0.35, A.ledge, 0.2, 0.24);
  for (let k = 0; k <= n; k++) {
    const s = sAt(k);
    B.box('bathDress', s, A.ledge + 0.1, z, 0.26, 0.2, 0.26, 0, {});
    B.cyl('bath', s, A.ledge + 0.2, z, A.r, A.cap - A.ledge - 0.32, 7, false);
    B.box('bathDress', s, A.cap - 0.06, z, 0.24, 0.12, 0.24, 0, { bottom: true });
    B.box('bathDress', s, A.cap + 0.05, z, 0.3, 0.1, 0.3, 0, { bottom: true });
    B.box('bathDress', s, A.boss, 0.12, 0.17, 0.17, 0.17, 0, { bottom: true });          // the ball at the springing
  }
  for (let k = 0; k < n; k++) {
    const a = sAt(k), b = sAt(k + 1), m = (a + b) / 2, w = Math.abs(b - a);
    bars(B, 'bathDress', arcOf(m, w, A.spring, A.apex - A.spring, 7), 0.1, A.proj, 0.12);            // the moulded arch
    bars(B, 'bathDress', arcOf(m, w + 0.16, A.spring + 0.05, A.apex - A.spring + 0.06, 7), 0.05, A.proj - 0.04, 0.06);   // hood
    // the trefoil: two cusps on the soffit
    const ys = A.spring + (A.apex - A.spring) * 0.48, xi = w * 0.36;
    bar(B, 'bathDress', [m - xi, ys], [m - xi * 0.62, ys - 0.06], 0.05, A.proj - 0.02, 0.08);
    bar(B, 'bathDress', [m + xi, ys], [m + xi * 0.62, ys - 0.06], 0.05, A.proj - 0.02, 0.08);
  }
}
/** a stone dormer gable in the current wall frame at s = x, its front on the wall plane, running back into the roof */
function dormer(B, x) {
  const D = P.DORMER, x0 = x - D.w / 2, x1 = x + D.w / 2, cop = 0.28, apW = D.apex - cop;
  const slope = (P.RIDGE - P.EAVES) / (P.W / 2);
  const ys = D.shoulder, dSh = (ys - P.EAVES) / slope, dAp = (apW - P.EAVES) / slope;
  const Wn = D.win;
  K.wall(B, K.frame(0, 0, 0, 1, 0), [[x0, P.EAVES - 0.05], [x1, P.EAVES - 0.05], [x1, ys], [x, apW], [x0, ys]],
    [{ pts: K.pointedPts(x, Wn.w, Wn.sill, Wn.spring, Wn.apex - Wn.spring, 8), kind: 'win', glass: 'leaded', d: 0.22, sill: false }], 'bath');
  // the window's tracery: a ring with four foiled circles
  const r = Math.min(Wn.r, Wn.w / 2 - 0.08);
  bars(B, 'bathDress', circ(x, Wn.cy, r, 16), 0.11, -0.05, 0.16, true);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; foiled(B, 'bathDress', x + Math.cos(a) * r * 0.52, Wn.cy + Math.sin(a) * r * 0.52, r * 0.36, 4, 0.06, -0.07, 0.14, 8); }
  bars(B, 'bathDress', arcOf(x, Wn.w + 0.22, Wn.spring, Wn.apex - Wn.spring + 0.12, 7), 0.1, 0.08, 0.1);
  // copings, shoulders, finial
  slab(B, 'bathDress', [x0 - 0.12, ys], [x + 0.02, apW], cop, 0.1, -0.5);
  slab(B, 'bathDress', [x - 0.02, apW], [x1 + 0.12, ys], cop, 0.1, -0.5);
  for (const sx of [x0, x1]) B.box('bathDress', sx, ys - 0.12, -0.05, 0.36, 0.34, 0.42, 0, { bottom: true });
  B.box('bathDress', x, D.apex + 0.12, -0.1, 0.24, 0.26, 0.24, 0, {});
  K.coneRoof(B, 'bathDress', [[x - 0.14, -0.24], [x + 0.14, -0.24], [x + 0.14, 0.04], [x - 0.14, 0.04]], D.apex + 0.25, [x, -0.1], 0.35);
  // its slated roof back into the main slope, and the cheeks below the shoulders
  B.poly('libSlate', [[x0, ys, 0], [x, apW, 0], [x, apW, -dAp], [x0, ys, -dSh]], [-1, 1, 0]);
  B.poly('libSlate', [[x, apW, 0], [x1, ys, 0], [x1, ys, -dSh], [x, apW, -dAp]], [1, 1, 0]);
  B.poly('bath', [[x0, P.EAVES, 0], [x0, ys, 0], [x0, ys, -dSh]], [-1, 0, 0]);
  B.poly('bath', [[x1, ys, 0], [x1, P.EAVES, 0], [x1, ys, -dSh]], [1, 0, 0]);
}
/** the eaves cornice along a face of length len in the current frame */
function cornice(B, len) {
  const C = P.CORNICE;
  K.stringCourse(B, 'bathDress', -0.05, len + 0.05, C.string, 0.13, 0.1);
  B.box('bathDress', len / 2, C.top - 0.14, 0.09, len + 0.1, 0.28, 0.18, 0, { bottom: true });
  B.box('bathDress', len / 2, C.top - 0.04, C.proj / 2, len + 0.2, 0.08, C.proj, 0, { bottom: true });
}

/** the climbers on the south front east of the door (wisteria and creeper: photographs 08 2010, c2017; DAS 2021 render):
 *  a deep ragged mass of leaf cards (_exeter_plants.js climber) in each bay between the buttresses and over the
 *  buttresses' fronts, below a ragged top under the first-floor string, the windows kept clear (G: extent and height).
 *  Called inside the south face's frame (s along the face, y up, z out). */
function creeper(ctx, sOf) {
  const C = P.CREEPER, I = new K.THREE.Matrix4();
  const holes = P.BAYS.slice(1).map((a) => [sOf(a) - P.WG.w / 2, sOf(a) + P.WG.w / 2, P.WG.sill, P.WG.apex]);
  const buts = P.BUT_S.map((a) => sOf(a)).filter((s) => s > C.s0 - P.BUT.w && s < C.s1 + P.BUT.w).sort((a, b) => a - b);
  // the bays: C.s0 .. C.s1 cut at each buttress
  const cuts = [C.s0]; for (const b of buts) { if (b - P.BUT.w / 2 > cuts[cuts.length - 1]) { cuts.push(b - P.BUT.w / 2, b + P.BUT.w / 2); } } cuts.push(C.s1);
  const o = { ground: P.GARDEN + 0.02, top: C.top, set: 'wisteria', leaf: C.leaf, proud: C.proud, perCell: C.perCell, margin: C.margin, overhang: C.overhang, gaps: C.gaps, lod: C.lod, back: 1 };
  let n = 0;
  for (let i = 0; i + 1 < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > 0.3) n += climber(ctx, I, { ...o, s0: cuts[i], s1: cuts[i + 1], holes, seed: 41 + i, stems: 3, fade: 0.4 });
  for (const b of buts) { if (b < C.s0 - 0.1 || b > C.s1 + 0.1) continue; n += climber(ctx, I, { ...o, s0: b - P.BUT.w / 2 - 0.05, s1: b + P.BUT.w / 2 + 0.05, faceZ: P.BUT.stages[1][1], seed: 71 + b, stems: 1, fade: 0.15 }); }
  return n;
}

function longFace(ctx, south) {
  const { B } = ctx, F = south ? FS() : FN(), sOf = (a) => (south ? a : P.L - a);
  const key = south ? 'bath' : 'bathOld';
  const ops = [];
  const bays = south ? P.BAYS : P.BAYS.slice(0, 3);
  // the blind arcade's recesses (each arch's field is set back; the lancets are cut in the back of four of them)
  const A = P.ARC, nA = south ? A.nS : A.nN, recesses = [];
  for (let k = 0; k < nA; k++) {
    const m = sOf(A.s0 + (k + 0.5) * A.pitch), pts = K.pointedPts(m, A.pitch - 0.2, A.ledge, A.spring, A.apex - A.spring - 0.1, 7);
    const lancet = bays.some((a) => Math.abs(sOf(a) - m) < 0.2);
    ops.push({ pts, kind: 'void', d: A.recess }); recesses.push({ pts, m, lancet });
  }
  const ground = south ? P.BAYS.slice(1) : P.BAYS.slice(0, 3);
  for (const a of ground) ops.push(wgOp(sOf(a)));
  if (south) ops.push({ pts: K.pointedPts(P.DG1.s, P.DG1.w, P.FFL, P.DG1.spring, P.DG1.apex - P.DG1.spring, 8), kind: 'door', doorKey: 'oakDoor', d: P.DG1.d });
  K.wall(B, F, K.rectPts(0, P.FOOT, P.L, P.EAVES), ops, key);
  B.push(F);
  for (const r of recesses) K.wall(B, K.frame(0, 0, -A.recess, 1, 0), r.pts, r.lancet ? [lancetOp(r.m)] : [], key);
  K.stringCourse(B, 'bathDress', 0, P.L, P.PLINTH, 0.3, 0.09);
  K.stringCourse(B, 'bathDress', -0.02, P.L + 0.02, P.STRING1.top, P.STRING1.h, P.STRING1.proj);
  arcade(B, (k) => sOf(P.ARC.s0 + k * P.ARC.pitch), south ? P.ARC.nS : P.ARC.nN);
  cornice(B, P.L);
  for (const a of ground) { const s = sOf(a); headTracery(B, s, P.WG.w, P.WG.spring, P.WG.apex, 2); hood(B, s, P.WG.w, P.WG.spring, P.WG.apex); }
  for (const a of bays) { const T = P.ARC.lancet; bars(B, 'bathDress', arcOf(sOf(a), T.w + 0.12, T.spring, T.apex - T.spring + 0.06, 5), 0.06, 0.06, 0.08); }
  if (south) {      // DG1: shafted jambs, moulded orders, hood
    const D = P.DG1;
    for (const sx of [-1, 1]) {
      const s = D.s + sx * (D.w / 2 + 0.13);
      B.box('bathDress', s, P.FFL + 0.12, 0.02, 0.22, 0.24, 0.22, 0, {});
      B.cyl('bath', s, P.FFL + 0.24, 0.02, 0.065, D.spring - P.FFL - 0.36, 7, false);
      B.box('bathDress', s, D.spring - 0.06, 0.02, 0.22, 0.12, 0.22, 0, { bottom: true });
    }
    bars(B, 'bathDress', arcOf(D.s, D.w + 0.26, D.spring, D.apex - D.spring + 0.1, 8), 0.1, 0.04, 0.2);
    bars(B, 'bathDress', arcOf(D.s, D.w + 0.55, D.spring, D.apex - D.spring + 0.2, 8), 0.1, 0.06, 0.2);
    bars(B, 'bathDress', arcOf(D.s, D.hoodW, D.spring, D.hoodApex - D.spring, 8), 0.12, 0.12, 0.12);
    // the lantern hung in the head of the doorway (photograph 08 exeter.ox.ac.uk c2017)
    B.box('ironBlack', D.s, (D.apex + D.spring + 0.75) / 2 - 0.1, -0.3, 0.03, D.apex - D.spring - 0.55, 0.03, 0, {});
    const lp = K.lantern(B, D.s, D.spring + 0.35, -0.3, { size: 0.22 });
    const l = P.toL(D.s, P.W + 0.3); ctx.lamp(l[0], lp[1], l[1]);
    creeper(ctx, sOf);
  }
  const buts = south ? P.BUT_S : P.BUT_N;
  for (const a of buts) K.buttress(B, key, sOf(a), P.FOOT, P.BUT.w, P.BUT.stages);
  for (const a of (south ? P.PIPES_S : P.PIPES_N)) {
    const s = sOf(a);
    B.cyl('leadDark', s, south ? P.GARDEN : P.NORTH_PATH, 0.12, 0.055, P.FIRST - 0.35 - (south ? P.GARDEN : P.NORTH_PATH), 6, false);
    B.box('leadDark', s, P.FIRST - 0.2, 0.14, 0.24, 0.3, 0.2, 0, { bottom: true });
  }
  for (const a of (south ? P.DORMERS_S : P.DORMERS_N)) dormer(B, sOf(a));
  B.pop();
}

// ------------------------------------------------------------------------------------------------ the gables
function gable(ctx, west) {
  const { B } = ctx, G = P.GABLE, F = west ? FW() : FE(), W = P.W, apW = G.apex - G.coping;
  const outline = [[0, P.FOOT], [W, P.FOOT], [W, G.kneel], [W / 2, apW], [0, G.kneel]];
  const win = west ? P.WF1 : P.WF7, sc = W / 2;
  const ops = [
    { pts: K.pointedPts(sc, win.w, win.sill, win.spring, win.apex - win.spring, 8), kind: 'win', lights: 2, transoms: [win.transom], d: win.d },
    { pts: circ(sc, P.WS1.y, P.WS1.r, 12, Math.PI / 12), kind: 'win', glass: 'leaded', d: 0.25, sill: false },
  ];
  if (west) ops.push({ pts: K.pointedPts(sc, P.WG1.w, P.WG1.sill, P.WG1.spring, P.WG1.apex - P.WG1.spring, 8), kind: 'win', lights: 3, transoms: [P.WG1.transom], d: P.WG1.d });
  K.wall(B, F, outline, ops, west ? 'bath' : 'bathOld');
  B.push(F);
  K.stringCourse(B, 'bathDress', 0, W, P.PLINTH, 0.3, 0.09);
  K.stringCourse(B, 'bathDress', 0, W, P.STRING1.top, P.STRING1.h, P.STRING1.proj);
  K.stringCourse(B, 'bathDress', 0, W, P.CORNICE.string, 0.13, 0.1);
  headTracery(B, sc, win.w, win.spring, win.apex, 2); hood(B, sc, win.w, win.spring, win.apex);
  foiled(B, 'bathDress', sc, P.WS1.y, P.WS1.r - 0.04, 5, 0.06, -0.06, 0.14, 10);
  if (west) { headTracery(B, sc, P.WG1.w, P.WG1.spring, P.WG1.apex, 3); hood(B, sc, P.WG1.w, P.WG1.spring, P.WG1.apex); }
  // the coped rakes between the corner piers, the apex block, the piers ("pinnacle stumps")
  const pr = G.pier, kn = G.kneel + (G.coping * 0), rake = (apW - G.kneel) / (W / 2);
  slab(B, 'bathDress', [pr - 0.05, G.kneel + rake * (pr - 0.05)], [W / 2 + 0.02, apW], G.coping, 0.12, -G.copW + 0.12);
  slab(B, 'bathDress', [W / 2 - 0.02, apW], [W - pr + 0.05, G.kneel + rake * (pr - 0.05)], G.coping, 0.12, -G.copW + 0.12);
  B.box('bathDress', W / 2, G.apex + 0.1, -0.15, 0.3, 0.35, 0.3, 0, {});
  for (const s of [pr / 2 - 0.05, W - pr / 2 + 0.05]) {
    B.box('bath', s, (P.CORNICE.string + G.pierTop) / 2, -pr / 2 + 0.08, pr, G.pierTop - P.CORNICE.string, pr, 0, { top: false });
    B.box('bathDress', s, G.pierTop + 0.06, -pr / 2 + 0.08, pr + 0.1, 0.12, pr + 0.1, 0, {});
    K.coneRoof(B, 'bathDress', [[s - pr / 2, -pr + 0.08], [s + pr / 2, -pr + 0.08], [s + pr / 2, 0.08], [s - pr / 2, 0.08]], G.pierTop + 0.12, [s, -pr / 2 + 0.08], G.pierCap);
  }
  void kn;
  // the gable's back above the roof (seen from the roof side)
  B.face('bath', [[0, G.kneel], [W / 2, apW], [W, G.kneel]], [], -0.5, true);
  if (west) for (const c of P.BUT_W) {
    const st = P.BUT.stages.map(([y, p]) => [y, (p * P.BUT_W_PROJ) / P.BUT.proj]);
    K.buttress(B, 'bath', c, P.FOOT, P.BUT.w, st);
  }
  B.pop();
}

// ------------------------------------------------------------------------------------------------ roof
function mainRoof(ctx) {
  const { B } = ctx, rise = P.RIDGE - P.EAVES;
  K.roof(B, 'libSlate', 0, P.L, 0, P.W, P.EAVES, rise, { axis: 'x', ends: ['open', 'open'], ov: P.ROOF_OV });
  B.box('leadDark', P.L / 2, P.RIDGE + 0.06, P.W / 2, P.L - 0.4, 0.14, 0.3, 0, {});      // the ridge
}

// ------------------------------------------------------------------------------------------------ the stair turret
function turret(ctx) {
  const { B } = ctx, T = P.TURRET, ring = T.ring, c = T.c;
  K.prism(B, 'bathOld', ring, P.FOOT, T.top);
  const grow = (r, k) => r.map(([a, cc]) => [c[0] + (a - c[0]) * k, c[1] + (cc - c[1]) * k]);
  K.prism(B, 'bathDress', grow(ring, 1.06), P.STRING1.top - P.STRING1.h, P.STRING1.top);
  K.prism(B, 'bathDress', grow(ring, 1.08), T.top - T.cornice, T.top, { top: true, topKey: 'bathDress' });
  // the octagonal stone spire
  const oct = Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return [c[0] + Math.cos(a) * T.spireR, c[1] + Math.sin(a) * T.spireR]; });
  K.prism(B, 'bath', oct, T.top, T.spireBase);
  K.coneRoof(B, 'bath', oct, T.spireBase, c, T.tip - T.spireBase);
  B.box('bathDress', c[0], T.tip + 0.1, c[1], 0.16, 0.3, 0.16, 0, {});
  // the gablets (lucarnes) at the spire's foot on its four main faces, each with a small trefoil light
  const ap = Math.cos(Math.PI / 8) * T.spireR, Lu = T.lucarne;
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const F = K.frame(c[0] + nx * (ap + 0.05) - nz * (Lu.w / 2), 0, c[1] + nz * (ap + 0.05) + nx * (Lu.w / 2), nz, -nx);
    B.push(F);
    B.face('bath', [[0, T.spireBase], [Lu.w, T.spireBase], [Lu.w / 2, T.spireBase + Lu.h]], [], 0);
    B.unit('leaded', K.pointedPts(Lu.w / 2, 0.24, T.spireBase + 0.1, T.spireBase + 0.35, 0.2, 4), 0.02);
    B.poly('bath', [[0, T.spireBase, 0], [Lu.w / 2, T.spireBase + Lu.h, 0], [Lu.w / 2, T.spireBase + Lu.h, -0.6], [0, T.spireBase + 0.1, -0.6]], [-1, 1, 0]);
    B.poly('bath', [[Lu.w / 2, T.spireBase + Lu.h, 0], [Lu.w, T.spireBase, 0], [Lu.w, T.spireBase + 0.1, -0.6], [Lu.w / 2, T.spireBase + Lu.h, -0.6]], [1, 1, 0]);
    B.pop();
  }
  // its lancets on the north face (painted lights in a stone surround)
  const F = K.frame(16.26, 0, -2.81, -1, 0); B.push(F);
  for (const L of [T.WF5, T.WG5]) {
    const pts = K.pointedPts(0.8, L.w, L.y0, L.y1 - L.w * 0.6, L.w * 0.6, 5);
    B.unit('leaded', pts, 0.015);
    bars(B, 'bathDress', [[0.8 + L.w / 2, L.y0], ...arcOf(0.8, L.w, L.y1 - L.w * 0.6, L.w * 0.6, 5), [0.8 - L.w / 2, L.y0]], 0.07, 0.06, 0.06);
  }
  B.pop();
}

// ------------------------------------------------------------------------------------------------ the annexe
function annexe(ctx) {
  const { B } = ctx, X = P.ANX, len = -X.c1, wid = X.a1 - X.a0;
  // west face (to the Rector's Garden): s runs south from the north end
  const FWa = K.frame(X.a0, 0, X.c1, 0, 1);
  const ops = X.win.map((c) => ({ pts: K.pointedPts(c - X.c1, X.winW, X.sill, X.spring, X.apex - X.spring, 8), kind: 'win', lights: 3, d: 0.32 }));
  K.wall(B, FWa, K.rectPts(0, P.FOOT, len, X.parapet), ops, 'bath');
  B.push(FWa);
  K.stringCourse(B, 'bathDress', 0, len, P.RECTOR + 0.35, 0.3, 0.08);
  K.stringCourse(B, 'bathDress', 0, len, X.cornice, 0.16, 0.14);
  B.box('bathDress', len / 2, X.parapet + 0.05, -0.15, len, 0.1, 0.5, 0, { bottom: true });
  for (const c of X.win) { headTracery(B, c - X.c1, X.winW, X.spring, X.apex, 3); hood(B, c - X.c1, X.winW, X.spring, X.apex); }
  for (const c of X.but) {
    const s = c - X.c1;
    K.buttress(B, 'bath', s, P.FOOT, X.butW, [[P.H(1.8), X.butProj], [P.H(4.4), 0.5]]);
    // the gabled cap rising to the parapet's top
    B.face('bath', [[s - X.butW / 2, P.H(4.4)], [s + X.butW / 2, P.H(4.4)], [s, X.butTop]], [], 0.5);
    B.poly('bathDress', [[s - X.butW / 2 - 0.04, P.H(4.4), 0.52], [s, X.butTop + 0.04, 0.52], [s, X.butTop + 0.04, -0.05], [s - X.butW / 2 - 0.04, P.H(4.4), -0.05]], [-1, 1, 0]);
    B.poly('bathDress', [[s, X.butTop + 0.04, 0.52], [s + X.butW / 2 + 0.04, P.H(4.4), 0.52], [s + X.butW / 2 + 0.04, P.H(4.4), -0.05], [s, X.butTop + 0.04, -0.05]], [1, 1, 0]);
  }
  B.pop();
  // east face (to the gap by the Convocation House): plain
  K.wall(B, K.frame(X.a1, 0, 0, 0, -1), K.rectPts(0, P.FOOT, len, X.parapet), [], 'bathOld');
  // north gable with WG10 over DG6
  const FNa = K.frame(X.a1, 0, X.c1, -1, 0), N = X.north, sc = wid / 2, yS = P.H(4.9), apW = X.gable - 0.22;
  K.wall(B, FNa, [[0, P.FOOT], [wid, P.FOOT], [wid, yS], [sc, apW], [0, yS]],
    [{ pts: K.pointedPts(sc, N.w, Math.max(N.sill, P.RECTOR), N.spring, N.apex - N.spring, 8), kind: 'win', lights: 3, transoms: [P.H(2.0)], d: 0.3, sill: false }], 'bathOld');
  B.push(FNa);
  B.face('oakDoor', K.rectPts(sc + N.w / 2 - 0.08 - N.door.w, P.RECTOR, sc + N.w / 2 - 0.08, P.RECTOR + N.door.h), [], -0.25);
  headTracery(B, sc, N.w, N.spring, N.apex, 3); hood(B, sc, N.w, N.spring, N.apex);
  slab(B, 'bathDress', [-0.05, yS], [sc + 0.02, apW], 0.22, 0.1, -0.5);
  slab(B, 'bathDress', [sc - 0.02, apW], [wid + 0.05, yS], 0.22, 0.1, -0.5);
  K.stringCourse(B, 'bathDress', 0, wid, X.cornice, 0.16, 0.14);
  B.pop();
  // pinnacled corner buttresses at the north end
  for (const a of [X.a0 + 0.2, X.a1 - 0.2]) K.pinnacle(B, 'bath', a, X.c1 - 0.2, P.FOOT, X.pin.top, X.pin.w, X.pin.spire);
  // the roof: the parapet's back, a low-pitched slated roof (22/01763 section BB) and four rectangular rooflights in a row
  const inA0 = X.a0 + 0.45, inA1 = X.a1 - 0.35, inC1 = X.c1 + 0.35, inC0 = -0.1;
  innerFaces(B, 'bath', [[inA0, inC1], [inA1, inC1], [inA1, inC0], [inA0, inC0]], X.roofFoot - 0.1, X.parapet);
  K.roof(B, 'libSlate', inA0, inA1, inC1, inC0, X.roofFoot, X.ridge - X.roofFoot, { axis: 'z', ends: ['open', 'open'], ov: 0 });
  const am = (inA0 + inA1) / 2, RL = X.rooflights;
  for (const c of X.win) {
    const r = [[am - RL.w / 2, c - RL.l / 2], [am + RL.w / 2, c - RL.l / 2], [am + RL.w / 2, c + RL.l / 2], [am - RL.w / 2, c + RL.l / 2]];
    K.prism(B, 'lead', r, X.ridge - 0.3, RL.top - 0.35);                      // the upstand
    const g = r.map(([a, z]) => [am + (a - am) * 0.92, c + (z - c) * 0.95]);
    K.prism(B, 'glassDark', g, RL.top - 0.35, RL.top, { top: true, topKey: 'glassDark' });
  }
}

// ------------------------------------------------------------------------------------------------ the link (2021-3)
function link(ctx) {
  const { B } = ctx, Q = P.LINK, len = Q.a1 - Q.a0, sA = Q.stepA - Q.a0;
  const D = Q.door, ds = D.a - Q.a0;
  const F = K.frame(Q.a0, 0, Q.front, 1, 0);
  K.wall(B, F, [[0, P.FOOT], [len, P.FOOT], [len, Q.stepTop], [sA, Q.stepTop], [sA, Q.top], [0, Q.top]],
    [{ pts: K.rectPts(ds - D.w / 2, P.FFL, ds + D.w / 2, P.FFL + D.h), kind: 'door', doorKey: 'oakDoor', d: D.d }], 'bath');
  B.push(F);
  // the rounded, chamfered surround (finer stone) and the panels stepping back in layers
  bars(B, 'bathDress', [[ds - D.w / 2 - 0.08, P.FFL], [ds - D.w / 2 - 0.08, P.FFL + D.h + 0.08], [ds + D.w / 2 + 0.08, P.FFL + D.h + 0.08], [ds + D.w / 2 + 0.08, P.FFL]], 0.16, 0.05, 0.1);
  for (const [y, s0, s1] of [[P.H(3.2), sA, len], [P.H(2.1), ds + D.w / 2 + 0.3, len]]) B.box('bathDress', (s0 + s1) / 2, y, 0.01, s1 - s0, 0.03, 0.04, 0, {});
  B.box('bathDress', len / 2, Q.stepTop + 0.04, -0.12, len, 0.08, 0.3, 0, {});
  B.box('bathDress', sA / 2, Q.top + 0.04, -0.12, sA, 0.08, 0.3, 0, {});
  // the bronze fitting over the door
  B.box('copper', ds, P.FFL + D.h + 0.3, 0.06, 0.5, 0.08, 0.12, 0, { bottom: true });
  B.box('lampGlass', ds, P.FFL + D.h + 0.255, 0.06, 0.42, 0.012, 0.08, 0, { bottom: true });
  // the stone bench
  B.box('bathDress', Q.bench.a - Q.a0, P.FFL + Q.bench.h / 2 - 0.05, 0.3, Q.bench.len, Q.bench.h, Q.bench.d, 0, {});
  B.pop();
  const lp = P.toL(D.a, Q.front + 0.1); ctx.lamp(lp[0], P.FFL + D.h + 0.22, lp[1]);
  // the roof behind the front, and the wall by the annexe rising above it
  B.flat('lead', [[Q.a0, 0], [Q.a1, 0], [Q.a1, Q.front - 0.3], [Q.a0, Q.front - 0.3]], Q.roof);
  innerFaces(B, 'bath', [[Q.a0 + 0.01, 0.01], [Q.a1 - 0.01, 0.01], [Q.a1 - 0.01, Q.front - 0.3], [Q.a0 + 0.01, Q.front - 0.3]], Q.roof, Q.stepTop);
  K.wall(B, K.frame(Q.a0, 0, 0, 1, 0), K.rectPts(0, Q.roof - 0.05, len, Q.northTop), [], 'bathOld');
  K.wall(B, K.frame(Q.a1, 0, -0.01, -1, 0), K.rectPts(0, P.FOOT, Q.a1 - P.ANX.a1, Q.northTop), [], 'bathOld');      // its back in the gap
  B.box('bathDress', Q.a0 + len / 2, Q.northTop + 0.05, -0.15, len, 0.1, 0.4, 0, {});
}

// ------------------------------------------------------------------------------------------------ ground: paving, path, thresholds
function ground(ctx) {
  const { B } = ctx;
  // the stone paving before DG1 and the link door (the gravel beyond is the garden's)
  const pads = [
    { a0: P.DG1.s - 1.0, a1: P.DG1.s + 1.0, c0: P.W, c1: P.PAVE_S.c1, y: P.FFL - 0.01 },
    { a0: P.LINK.a0 - 0.02, a1: P.LINK.a1, c0: P.LINK.front, c1: P.PAVE_S.c1 + 0.2, y: P.FFL - 0.03 },
  ];
  for (const p of pads) {
    const ring = [[p.a0, p.c0], [p.a1, p.c0], [p.a1, p.c1], [p.a0, p.c1]];
    K.prism(B, 'bathDress', ring, -0.5, p.y, { top: true, topKey: 'pavingSolid' });
    ctx.floor(ringL(p.a0, p.a1, p.c0, p.c1), p.y);
  }
  // the raised path along the north face (to the Rector's Garden: a stone kerb down to the lawn)
  const np = [[0, -P.NORTH_PATH_W], [P.TURRET.ring[1][0], -P.NORTH_PATH_W], [P.TURRET.ring[1][0], 0], [0, 0]];
  K.prism(B, 'bathDress', np, -0.95, P.NORTH_PATH, { top: true, topKey: 'pavingSolid' });
  ctx.floor(ringL(0, P.TURRET.ring[1][0], -P.NORTH_PATH_W, 0), P.NORTH_PATH);
  // the threshold before the annexe's north door
  const X = P.ANX, nd = [[X.a1 - 2.6, X.c1 - 1.2], [X.a1 - 0.6, X.c1 - 1.2], [X.a1 - 0.6, X.c1], [X.a1 - 2.6, X.c1]];
  K.prism(B, 'bathDress', nd, -0.95, P.RECTOR + 0.02, { top: true, topKey: 'pavingSolid' });
  ctx.floor(ringL(X.a1 - 2.6, X.a1 - 0.6, X.c1 - 1.2, X.c1), P.RECTOR + 0.02);
}

/** the wall with a gate between the east range's garden face and the library's west end (LOCAL frame) */
function gardenWall(ctx) {
  const { B } = ctx, G = P.GARDEN_WALL, a = G.from, b = P.toL(-0.02, G.toC);
  const Lw = Math.hypot(b[0] - a[0], b[1] - a[1]), tu = (b[0] - a[0]) / Lw, tv = (b[1] - a[1]) / Lw;
  const at = (s) => [a[0] + tu * s, a[1] + tv * s];
  const g0 = Lw * G.gate.at, g1 = g0 + G.gate.w;
  K.parapet(B, 'bath', [a, at(g0)], P.FOOT, G.h - P.FOOT, G.t, { coping: 'bathDress' });
  K.parapet(B, 'bath', [at(g1), b], P.FOOT, G.h - P.FOOT, G.t, { coping: 'bathDress' });
  const gm = at((g0 + g1) / 2), ry = Math.atan2(-tv, tu);
  B.box('bath', gm[0], (G.gate.h + G.h) / 2, gm[1], G.gate.w + 0.02, G.h - G.gate.h, G.t, ry, { bottom: true });
  B.box('bathDress', gm[0], G.h + 0.05, gm[1], G.gate.w + 0.1, 0.1, G.t + 0.1, ry, { bottom: true });
  B.box('oakDoor', gm[0], (P.GARDEN + G.gate.h) / 2, gm[1], G.gate.w, G.gate.h - P.GARDEN, 0.06, ry, {});
  ctx.seg(a[0], a[1], b[0], b[1]);
}

// ------------------------------------------------------------------------------------------------ colliders
function solids(ctx) {
  ctx.solid(ringL(0, P.L, 0, P.W));
  ctx.solid(P.TURRET.ring.map(([a, c]) => P.toL(a, c)));
  ctx.solid(ringL(P.ANX.a0, P.ANX.a1, P.ANX.c1, 0));
  ctx.solid(ringL(P.LINK.a0, P.LINK.a1, 0, P.LINK.front));
  const bw = P.BUT.w / 2;
  for (const a of P.BUT_S) ctx.solid(ringL(a - bw, a + bw, P.W, P.W + P.BUT.proj));
  for (const a of P.BUT_N) ctx.solid(ringL(a - bw, a + bw, -P.BUT.proj, 0));
  for (const c of P.BUT_W) ctx.solid(ringL(-P.BUT_W_PROJ, 0, c - bw, c + bw));
  for (const c of P.ANX.but) ctx.solid(ringL(P.ANX.a0 - P.ANX.butProj, P.ANX.a0, c - P.ANX.butW / 2, c + P.ANX.butW / 2));
}

export function buildLibrary(ctx) {
  K = ctx.K;
  K.addCell(ctx.pack, 'libSlate', 'slate', [0.9, 0.8, 0.95]);      // the purple-grey Welsh slate (survey section 5)
  const { B } = ctx;
  gardenWall(ctx);
  B.push(K.frame(P.ORIGIN[0], 0, P.ORIGIN[1], Math.cos(P.TH), Math.sin(P.TH)));
  longFace(ctx, true);
  longFace(ctx, false);
  gable(ctx, true);
  gable(ctx, false);
  mainRoof(ctx);
  turret(ctx);
  annexe(ctx);
  link(ctx);
  ground(ctx);
  B.pop();
  solids(ctx);
  return null;
}
