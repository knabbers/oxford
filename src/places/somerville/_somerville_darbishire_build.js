// Somerville College, STANDALONE model, part 'darbishire' (B01): the build functions. Called by somerville_darbishire.js
// with ctx.B in the college's LOCAL frame. Everything is drawn in the court's own frame (P.FRAME: x = s "east" along the
// north range's court face, z = t "south"); colliders, floors and lamps are converted to LOCAL with F.L. Every figure
// comes from _somerville_darbishire_plan.js (sources and K / G there).
// Helpers written here (not in the kit): face (a wall frame for a face looking E / W / N / S in the court frame), hipDormer
// (a dormer with a hipped roof), ringArch (a voussoir ring), passage (a walk-through way: side walls, vault or flat
// ceiling, floor), shield (a blank carved shield), stepsS (a flight running along s), cycle hoops, a lavender row.
import * as P from './_somerville_darbishire_plan.js';

const RUB = 'darbRubble', DR = 'bathDress', ROOF = 'stoneSlate', BR = 'brick';
const { PITCH, WIN, AXIS, PASS, COURT, RAISED } = P;

// ------------------------------------------------------------------------------------------------ helpers
/** a wall face in the court frame looking `dir` ('E' +s, 'W' -s, 'S' +t, 'N' -t) in the plane s or t = c, spanning a..b
 *  of the other coordinate. x(q) gives the frame's x of a point at q along it; toF(x, z) the court-frame (s, t). */
function face(K, dir, c, a, b) {
  let M, x, toF;
  if (dir === 'E') { M = K.frame(c, 0, b, 0, -1); x = (q) => b - q; toF = (X, Z) => [c + Z, b - X]; }
  else if (dir === 'W') { M = K.frame(c, 0, a, 0, 1); x = (q) => q - a; toF = (X, Z) => [c - Z, a + X]; }
  else if (dir === 'S') { M = K.frame(a, 0, c, 1, 0); x = (q) => q - a; toF = (X, Z) => [a + X, c + Z]; }
  else { M = K.frame(b, 0, c, -1, 0); x = (q) => b - q; toF = (X, Z) => [b - X, c - Z]; }
  return { M, x, toF, len: b - a, dir, c, a, b };
}
/** the lowest surveyed ground 1 m out from a face, less 0.6 (a wall's foot) */
function footOf(st, fc) {
  let lo = Infinity;
  for (let X = 0; X <= fc.len + 1e-6; X += Math.max(1, fc.len / 12)) { const p = fc.toF(X, 1.0); lo = Math.min(lo, st.F.groundY(p[0], p[1])); }
  return Math.min(P.FOOT + 1.0, Math.max(-1.2, lo - 0.6));
}
const sash = (K, x, w, y) => ({ pts: K.rectPts(x - w / 2, y[0], x + w / 2, y[1]), kind: 'win', glass: 'sash', d: 0.22 });
/** a plain stone architrave round an opening (current wall frame) */
function architrave(B, x, w, y0, y1, a = WIN.arch) {
  B.box(DR, x - w / 2 - a / 2, (y0 + y1) / 2, 0.03, a, y1 - y0 + a, 0.07, 0, {});
  B.box(DR, x + w / 2 + a / 2, (y0 + y1) / 2, 0.03, a, y1 - y0 + a, 0.07, 0, {});
  B.box(DR, x, y1 + a / 2, 0.03, w + 2 * a, a, 0.07, 0, {});
}
/** a blank shield (no arms) standing 0.08 proud, centred at x, its top at y (current wall frame) */
function shield(B, x, y, w = 0.5, h = 0.62) {
  const pts = [[x - w / 2, y], [x - w / 2, y - h * 0.5], [x - w * 0.36, y - h * 0.8], [x, y - h], [x + w * 0.36, y - h * 0.8], [x + w / 2, y - h * 0.5], [x + w / 2, y]];
  B.face(DR, pts, [], 0.08);
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; B.poly(DR, [[p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], 0.08], [p[0], p[1], 0.08]], [(p[0] + q[0]) / 2 - x, (p[1] + q[1]) / 2 - (y - h / 2), 0]); }
  B.box(DR, x, y - h / 2, 0.02, w + 0.24, h + 0.24, 0.04, 0, {});      // the panel it is carved on
}
/** a voussoir ring round a semicircular opening (current wall frame): inner radius r, depth dep, standing `pr` proud */
function ringArch(B, xc, ys, r, dep = 0.35, pr = 0.04, seg = 12) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI, a1 = ((i + 1) / seg) * Math.PI, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    B.poly(DR, [[xc + c0 * r, ys + s0 * r, pr], [xc + c0 * (r + dep), ys + s0 * (r + dep), pr], [xc + c1 * (r + dep), ys + s1 * (r + dep), pr], [xc + c1 * r, ys + s1 * r, pr]], [0, 0, 1]);
    B.poly(DR, [[xc + c0 * (r + dep), ys + s0 * (r + dep), 0], [xc + c1 * (r + dep), ys + s1 * (r + dep), 0], [xc + c1 * (r + dep), ys + s1 * (r + dep), pr], [xc + c0 * (r + dep), ys + s0 * (r + dep), pr]], [(c0 + c1) / 2, (s0 + s1) / 2, 0]);
  }
  B.box(DR, xc, ys + r + dep * 0.55, pr + 0.03, 0.34, dep * 1.15, 0.08, 0, {});      // keystone
}
/** a low round-headed opening: upright jambs to ys, then a half-ellipse rising `rise` (CCW, current wall frame) */
function ellPts(x, w, y0, ys, rise, seg = 12) {
  const r = w / 2, p = [[x - r, y0], [x + r, y0], [x + r, ys]];
  for (let i = 1; i < seg; i++) { const a = (i / seg) * Math.PI; p.push([x + Math.cos(a) * r, ys + Math.sin(a) * rise]); }
  p.push([x - r, ys]);
  return p;
}
/** a brick (or stone) ring round a half-ellipse head (current wall frame): inner half-width r, rise; ring depth dep, `pr` proud */
function ellRing(B, key, xc, ys, r, rise, dep, pr = 0.03, seg = 12) {
  const P = (a, d) => [xc + Math.cos(a) * (r + d), ys + Math.sin(a) * (rise + d)];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI, a1 = ((i + 1) / seg) * Math.PI, i0 = P(a0, 0), i1 = P(a1, 0), o0 = P(a0, dep), o1 = P(a1, dep);
    B.poly(key, [[i0[0], i0[1], pr], [o0[0], o0[1], pr], [o1[0], o1[1], pr], [i1[0], i1[1], pr]], [0, 0, 1]);
    B.poly(key, [[o0[0], o0[1], 0], [o1[0], o1[1], 0], [o1[0], o1[1], pr], [o0[0], o0[1], pr]], [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]);
  }
}
/** a dormer with a HIPPED roof in wall frame Fm whose z = 0 is its own front: centred at x, sill y, w wide, h to the eaves */
function hipDormer(K, B, Fm, x, y, w, h, depth, o = {}) {
  const x0 = x - w / 2, x1 = x + w / 2, e = y + h, r = o.rise ?? w * 0.38, ov = 0.12, run = w / 2 + ov;
  const win = K.rectPts(x0 + 0.13, y + 0.1, x1 - 0.13, e - 0.1);
  K.wall(B, Fm, K.rectPts(x0, y, x1, e), [{ pts: win, kind: 'win', glass: 'sash', d: 0.1, sill: false }], o.key || DR);
  B.push(Fm);
  B.poly(o.cheek || 'leadDark', [[x0, y, -depth], [x0, y, 0], [x0, e, 0], [x0, e, -depth]], [-1, 0, 0]);
  B.poly(o.cheek || 'leadDark', [[x1, y, 0], [x1, y, -depth], [x1, e, -depth], [x1, e, 0]], [1, 0, 0]);
  const A = [x0 - ov, e - 0.02, ov], Bq = [x1 + ov, e - 0.02, ov], R0 = [x, e + r, ov - run], R1 = [x, e + r, -depth], A1 = [x0 - ov, e - 0.02, -depth], B1 = [x1 + ov, e - 0.02, -depth];
  B.poly(ROOF, [A, Bq, R0], [0, 1, 1]);
  B.poly(ROOF, [A1, A, R0, R1], [-1, 1, 0]);
  B.poly(ROOF, [Bq, B1, R1, R0], [1, 1, 0]);
  B.pop();
}
/** a walk-through way along s from s0 to s1 centred on t = tc, w wide: side walls, a round vault springing at ys (or a
 *  flat ceiling at o.flat), the floor at yf (key o.floor; null = drawn elsewhere). Drawn facing INTO the way. */
function passage(st, s0, s1, tc, w, yf, ys, o = {}) {
  const { B } = st, a = tc - w / 2, b = tc + w / 2, key = o.key || RUB, y0 = yf - 0.4, top = o.flat ?? ys;
  B.poly(key, [[s0, y0, a], [s1, y0, a], [s1, top, a], [s0, top, a]], [0, 0, 1]);
  B.poly(key, [[s0, y0, b], [s1, y0, b], [s1, top, b], [s0, top, b]], [0, 0, -1]);
  if (o.flat !== undefined) B.poly(o.ceil || 'plaster', [[s0, top, a], [s1, top, a], [s1, top, b], [s0, top, b]], [0, -1, 0]);
  else {
    const n = 10, r = w / 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI, p = (an, s) => [s, ys + Math.sin(an) * r, tc + Math.cos(an) * r];
      B.poly(o.vault || DR, [p(a0, s0), p(a0, s1), p(a1, s1), p(a1, s0)], [0, -Math.sin((a0 + a1) / 2), -Math.cos((a0 + a1) / 2)]);
    }
  }
  if (o.floor) B.flat(o.floor, [[s0, a], [s1, a], [s1, b], [s0, b]], yf);
  st.seg(s0, a, s1, a); st.seg(s0, b, s1, b);
}
/** a flight of n steps along s: its top edge at s = sTop (level yTop), going DOWN towards +s (dir 1) or -s (dir -1), across t0..t1 */
function stepsS(B, sTop, dir, t0, t1, n, rise, going, yTop, yBase) {
  for (let i = 0; i < n; i++) { const yt = yTop - rise * (i + 1), sa = sTop + dir * going * i, sb = sTop + dir * going * (i + 1); B.box('pavingSolid', (sa + sb) / 2, (yt + yBase) / 2, (t0 + t1) / 2, Math.abs(sb - sa), yt - yBase, t1 - t0, 0, {}); }
}
/** ashlar quoins up both ends of a face 0..len (current wall frame) */
function quoins(B, len, y0, y1) { for (let k = 0, y = y0; y < y1 - 0.3; k++, y += 0.42) { const lw = k % 2 ? 0.3 : 0.5; for (const x of [lw / 2, len - lw / 2]) B.box(DR, x, y + 0.2, 0.015, lw, 0.38, 0.03, 0, {}); } }
/** the eaves cornice (current wall frame) from x0 to x1 with its top at y; o.brackets: big stone brackets under it */
function cornice(K, B, x0, x1, y, o = {}) {
  const c = P.CORNICE;
  K.stringCourse(B, DR, x0, x1, y, c.h, c.proj);
  K.stringCourse(B, DR, x0, x1, y - c.h, 0.12, c.proj * 0.55);
  if (o.brackets) for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.95) B.box(DR, x, y - c.h - 0.22, 0.16, 0.16, 0.42, 0.32, 0, { bottom: true });
}
/** a low lavender row (planted on a border's edge) between two court-frame points at level y */
function lavender(B, a, b, y, w = 0.45) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), n = Math.max(1, Math.round(L / 0.5));
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n, x = a[0] + dx * f, z = a[1] + dz * f, j = ((i * 7919) % 13) / 13, h = 0.26 + j * 0.12, r = w * (0.8 + j * 0.3);
    B.box('lavLeaf', x, y + h / 2, z, r, h, r, i * 0.7, {});
    if (i % 2 === 0) B.box('lavFl', x, y + h + 0.04, z, r * 0.5, 0.08, r * 0.5, i * 0.7 + 0.4, { bottom: true });
  }
}
/** a planted clump (a few leafy lumps) at (x, z) on level y, about r across and h high */
function clump(B, x, z, y, r, h, seed) {
  for (let k = 0; k < 3; k++) { const j = ((seed * 31 + k * 17) % 11) / 11, a = seed + k * 2.1, d = r * 0.3; B.box(['leafA', 'leafC', 'leafB'][(seed + k) % 3], x + Math.cos(a) * d, y + (h * (0.6 + 0.4 * j)) / 2, z + Math.sin(a) * d, r * (0.55 + 0.3 * j), h * (0.6 + 0.4 * j), r * (0.5 + 0.35 * j), a, {}); }
}

// ------------------------------------------------------------------------------------------------ the build
export function buildDarbishire(ctx) {
  const { B, K, S, G } = ctx;
  K.addCell(ctx.pack, RUB, 'rubble', [1.08, 0.97, 0.8], { seed: 1.2, rx: 1 / 3.2, ry: 1 / 3.2 });
  K.addCell(ctx.pack, 'lavFl', 'lead', 0x8f82b4); K.addCell(ctx.pack, 'darbIvy', 'stoneDress', [1.1, 1.07, 1.0], { seed: 4005 });      // the bay under its wisteria (ivy grows on a cell whose seed >= 4000: places/_worcester_kit.js)
  K.addCell(ctx.pack, 'lavLeaf', 'lead', 0x6f7d5e);      // lavender flower and its grey-green leaf      // the warm buff coursed rubble (photographs 01)
  // the court's own gravel sheet lies UNDER its lawns, paths and beds: a copy of the ground cell 'gravel' on layer 2 (the
  // city's ground orders coplanar sheets by layer, world/materials.js LAYER_BIAS; plain gravel, layer 7, drew over the
  // lawns (layer 3) seen from above: touch-up 2)
  { const gc = ctx.pack.groundCells; if (gc && gc.has('gravel') && !gc.has('darbGravel')) gc.set('darbGravel', { ...gc.get('gravel'), layer: 2 }); }
  const F = S.ownFrame(...P.FRAME);
  const st = {
    ctx, B, K, S, G, F,
    seg: (s0, t0, s1, t1) => { const a = F.L(s0, t0), b = F.L(s1, t1); ctx.seg(a[0], a[1], b[0], b[1]); },
    poly: (pts) => { for (let i = 0; i < pts.length - 1; i++) st.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); },
    floor: (ring, y) => ctx.floor(F.ring(ring), typeof y === 'function' ? (u, v) => { const q = F.P(u, v); return y(q[0], q[1]); } : y),
    lamp: (fc, X, Y, Z) => { const q = fc.toF(X, Z), l = F.L(q[0], q[1]); ctx.lamp(l[0], Y, l[1]); },
    after: [],      // ground drapes in LOCAL, drawn once the court's frame is popped
    // the site's boundary on Woodstock Road (s at t), and the city's pavement / crossover level just outside it (the merge)
    bnd: (t) => { const b = P.BOUND; for (let i = 0; i < b.length - 1; i++) if (t <= b[i + 1][1] || i === b.length - 2) return b[i][0] + ((t - b[i][1]) * (b[i + 1][0] - b[i][0])) / (b[i + 1][1] - b[i][1]); return b[0][0]; },
    fore: (t) => F.groundY(st.bnd(t) + 0.3, t) + P.PAVE_UP,
    road: (t) => F.groundY(st.bnd(t) + 0.3, t) + P.ROAD_UP,
    // a drape given in the court's own (s, t): converted to LOCAL (the ring, its holes, a level function o.y(s, t)) and
    // drawn after the frame is popped, so ctx.G.drape never runs with a frame pushed (touch-up 2)
    drape: (key, ring, dy = 0, o = {}) => {
      const oy = o.y, lo = { ...o, holes: (o.holes || []).map((h) => F.ring(h)) };
      if (oy) lo.y = (u, v) => { const q = F.P(u, v); return oy(q[0], q[1]); }; else delete lo.y;
      st.after.push(() => G.drape(B, key, F.ring(ring), dy, lo));
    },
  };
  B.push(F.M);
  ground(st);
  westRange(st);
  northRange(st);
  neBlock(st);
  lodge(st);
  gateBlock(st);
  southSide(st);
  street(st);
  stacks(st);
  B.pop();
  for (const f of st.after) f();
  return { frameDeg: +F.deg.toFixed(2) };
}

/** the window bays of a face: ground and first-floor sashes with architraves at positions q (along the face) */
function bayOps(K, fc, qs, o = {}) {
  const ops = [], w = o.w ?? WIN.w;
  for (const q of qs) { if (o.ground !== false) ops.push(sash(K, fc.x(q), w, o.g || WIN.g)); if (o.first !== false) ops.push(sash(K, fc.x(q), o.fw ?? w, o.f || WIN.f)); }
  return ops;
}
function dressOps(B, ops) { B.push(ops.M); for (const q of ops.list) if (q.kind === 'win' && q.glass === 'sash' && !q.noArch) { const xs = q.pts.map((p) => p[0]), ys = q.pts.map((p) => p[1]); architrave(B, (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...xs) - Math.min(...xs), Math.min(...ys), Math.max(...ys)); } B.pop(); }
/** build a face: the wall with its openings, the architraves, the eaves cornice */
function wallFace(st, fc, top, ops, o = {}) {
  const { B, K } = st, foot = o.foot ?? footOf(st, fc);
  K.wall(B, fc.M, o.outline ? o.outline(foot) : K.rectPts(0, foot, fc.len, top), ops, o.key || RUB, { dress: DR });
  dressOps(B, { M: fc.M, list: ops });
  if (o.cornice !== false) { B.push(fc.M); cornice(K, B, o.cx0 ?? -0.05, o.cx1 ?? fc.len + 0.05, top, { brackets: o.brackets }); B.pop(); }
  return foot;
}

// ------------------------------------------------------------------------------------------------ the court's ground
function ground(st) {
  const { B, G, F } = st, C = P.COURT_BOX, low = (s, t) => Math.max(COURT, F.groundY(s, t)), flat = (y) => ({ y: () => y });
  const WN = P.WALK_N, WW = P.WALK_W, T0 = P.TERR.s0, LS = P.LAWN_S, top = RAISED, base = COURT - 0.3, s = P.STEP;
  const stepTop = P.CROSS[0] - 3 * s.going, stepBot = P.CROSS[1] + 3 * s.going, bedT = LS.t1, x0 = C.s0, b0 = WW[0];
  // the whole court at its own level (the DTM dips under the east range are not ground), then lawns and paths on it
  st.drape('darbGravel', [[C.s0, C.t0], [C.s1, C.t0], [C.s1, C.t1], [C.s0, C.t1]], 0.05, { y: low });
  const rect = (r) => [[r.s0, r.t0], [r.s1, r.t0], [r.s1, r.t1], [r.s0, r.t1]];
  st.drape('lawn', rect(P.LAWN_N), 0.07, { y: low });
  st.drape('lawn', rect(LS), 0.07, { y: low });
  st.drape('paving', [[x0, P.CROSS[0]], [23.25, P.CROSS[0]], [23.25, P.CROSS[1]], [x0, P.CROSS[1]]], 0.09, { y: low });
  st.drape('paving', [[b0, P.CROSS[1]], [LS.s0, P.CROSS[1]], [LS.s0, bedT], [b0, bedT]], 0.09, { y: low });
  st.drape('paving', [[LS.s1, P.CROSS[1]], [T0, P.CROSS[1]], [T0, bedT], [LS.s1, bedT]], 0.09, { y: low });
  st.drape('flowerbed', [[b0, bedT], [P.GATE.s0, bedT], [P.GATE.s0, C.t1], [b0, C.t1]], 0.1, { y: low });
  st.floor(rect(C), (ss, tt) => low(ss, tt) + 0.09);
  // the raised walks round the north lawn and the terraces before the lodge: stone-faced, flagged
  const walks = [
    [[x0, C.t0], [P.NE.s0, C.t0], [P.NE.s0, WN[1]], [x0, WN[1]]],                                  // north walk with the border on it
    [[x0, WN[1]], [WW[1], WN[1]], [WW[1], stepTop], [x0, stepTop]],                                // west walk with its border
    [[T0, WN[1]], [P.NE.s0, WN[1]], [P.NE.s0, P.NE.t1], [P.LODGE.s0, P.NE.t1], [P.LODGE.s0, stepTop], [T0, stepTop]],   // east terrace (north)
    [[T0, stepBot], [P.LODGE.s0, stepBot], [P.LODGE.s0, P.GATE.t0], [T0, P.GATE.t0]],             // south terrace
  ];
  for (const r of walks) { st.K.prism(B, DR, r, base, top, {}); st.drape('paving', r, 0.0, flat(top)); st.floor(r, top); }
  // borders on the walks along the ranges (planted), and the raised stone-edged bed along the west range south of the arch
  st.drape('flowerbed', [[x0, C.t0], [P.NE.s0, C.t0], [P.NE.s0, WN[0]], [x0, WN[0]]], 0.02, flat(top));
  st.drape('flowerbed', [[x0, WN[0]], [b0, WN[0]], [b0, stepTop], [x0, stepTop]], 0.02, flat(top));
  const bed = [[x0, P.CROSS[1] + 0.3], [b0, P.CROSS[1] + 0.3], [b0, C.t1], [x0, C.t1]];
  st.K.prism(B, DR, bed, base, COURT + 0.35, {}); st.drape('flowerbed', bed, 0, flat(COURT + 0.35));
  // the steps: from the cross path up to the west walk and the north terrace, from the cross path up to the south terrace
  const pv = P.PAV.s0;
  st.K.steps(B, 'pavingSolid', x0, WW[1], stepTop, 1, 3, s.rise, s.going, top, base);
  st.K.steps(B, 'pavingSolid', T0, pv, stepTop, 1, 3, s.rise, s.going, top, base);
  st.K.steps(B, 'pavingSolid', T0, pv, stepBot, -1, 3, s.rise, s.going, top, base);
  const flight = (s0, s1, tTop, dir) => st.floor([[s0, tTop], [s1, tTop], [s1, tTop + dir * 3 * s.going], [s0, tTop + dir * 3 * s.going]], (ss, tt) => Math.max(COURT + 0.09, top - s.rise * (1 + Math.min(2, Math.floor(Math.abs(tt - tTop) / s.going)))));
  flight(x0, WW[1], stepTop, 1); flight(T0, pv, stepTop, 1); flight(T0, pv, stepBot, -1);
  // the walks' drops are walls to walk into (the steps are the ways up)
  st.poly([[WW[1], WN[1]], [WW[1], stepTop]]); st.poly([[WW[1], WN[1]], [T0, WN[1]], [T0, stepTop]]); st.poly([[T0, stepBot], [T0, P.GATE.t0]]);
  st.poly([[pv, stepTop], [P.LODGE.s0, stepTop]]); st.poly([[pv, stepBot], [P.LODGE.s0, stepBot]]);
  // lavender along the walks' lawn edges; the court's planting; benches; the small tree south of the cross path
  lavender(B, [WW[1] - 0.25, WN[1] - 0.25], [T0 + 0.25, WN[1] - 0.25], top, 0.38);
  lavender(B, [WW[1] - 0.25, WN[1] + 0.25], [WW[1] - 0.25, stepTop - 0.2], top, 0.38);
  lavender(B, [T0 + 0.25, WN[1] + 0.25], [T0 + 0.25, stepTop - 0.2], top, 0.38);
  lavender(B, [b0 - 0.35, P.CROSS[1] + 0.6], [b0 - 0.35, C.t1 - 0.3], COURT + 0.35, 0.38);
  for (let i = 0; i < 16; i++) clump(B, x0 + 0.9 + i * 1.35, C.t0 + 0.5, top, 0.8, 0.45 + ((i * 37) % 5) * 0.12, i);
  for (let i = 0; i < 6; i++) clump(B, x0 + 0.5, WN[1] + 0.8 + i * 1.4, top, 0.75, 0.45 + ((i * 29) % 4) * 0.1, i + 3);
  for (let i = 0; i < 6; i++) clump(B, x0 + 0.4, P.CROSS[1] + 1.2 + i * 1.6, COURT + 0.35, 0.55, 0.4 + ((i * 13) % 3) * 0.1, i + 5);
  st.K.bench(B, 9.5, P.LAWN_N.t0 + 0.6, COURT + 0.07, 0);
  st.K.bench(B, P.LAWN_N.s0 + 0.6, 10.5, COURT + 0.07, Math.PI / 2);
  st.K.tree(B, 9.0, P.CROSS[1] + 1.5, COURT, 4.8, 2.0, 7);
  // wisteria over the north-west corner: thin masses on the north range's court face west of its first window, and on
  // the bay's north side
  // (the bay is built in a creeper-grown stone cell: the atlas shader's ivy; here a few low masses at its foot)
  for (const [sx, w, h] of [[x0 + 1.4, 1.2, 1.1], [x0 + 2.6, 1.0, 0.8]]) B.box('leafA', sx, top + h / 2, C.t0 + 0.25, w, h, 0.4, 0, {});
}

// ------------------------------------------------------------------------------------------------ the west range
function westRange(st) {
  const { B, K } = st, W = P.WEST, e = W.eaves;
  const arch = { pts: K.archPts(0, P.W_ARCH.w, COURT, P.W_ARCH.spring, 12), kind: 'void', d: 0.45, revealKey: DR };
  const lane = (x) => ({ pts: K.segPts(x, 2.8, P.LANE, 3.55, 0.45, 8), kind: 'void', d: 0.45, revealKey: DR });
  // court face (looking east)
  const fc = face(K, 'E', W.s1, P.NORTH.t1, W.t1);
  const ops = bayOps(K, fc, P.W_BAYS);
  ops.push({ ...arch, pts: K.archPts(fc.x(AXIS), P.W_ARCH.w, COURT, P.W_ARCH.spring, 12) }, lane(fc.x((PASS[0] + PASS[1]) / 2)));
  wallFace(st, fc, e, ops);
  B.push(fc.M);
  ringArch(B, fc.x(AXIS), P.W_ARCH.spring, P.W_ARCH.w / 2);
  for (const t of P.W_SHIELDS) shield(B, fc.x(t), 6.4);
  for (const t of [6.8, 19.2, 24.0]) B.box('ironBlack', fc.x(t), (COURT + e) / 2 - 0.15, 0.12, 0.1, e - COURT - 0.3, 0.1, 0, {});      // downpipes (photographs)
  for (const t of [AXIS - 1.75, AXIS + 1.75]) { const p = K.lantern(B, fc.x(t), 3.55, 0.36, { size: 0.24 }); B.box('ironBlack', fc.x(t), 3.85, 0.18, 0.04, 0.04, 0.36, 0, {}); st.lamp(fc, p[0], p[1], p[2]); }
  B.pop();
  // the square bay at the north end of the court face: tripartite sashes, flat-topped with a cornice
  const BY = P.BAY, s1 = W.s1 + BY.proj, bayFoot = RAISED - 0.4;
  const bf = face(K, 'E', s1, BY.t0, BY.t1);
  const tri = (y) => ({ pts: K.rectPts(0.25, y[0], bf.len - 0.25, y[1]), kind: 'win', glass: 'sash', lights: 3, mullionW: 0.16, d: 0.18 });
  wallFace(st, bf, BY.top, [tri([2.25, 4.3]), tri(WIN.f)], { key: 'darbIvy', foot: bayFoot });
  for (const [dir, c] of [['N', BY.t0], ['S', BY.t1]]) { const sf = face(K, dir, c, W.s1, s1); wallFace(st, sf, BY.top, [sash(K, BY.proj / 2, 0.42, [2.25, 4.3]), sash(K, BY.proj / 2, 0.42, WIN.f)], { key: 'darbIvy', foot: bayFoot, cornice: true }); }
  B.flat('lead', [[W.s1, BY.t0], [s1, BY.t0], [s1, BY.t1], [W.s1, BY.t1]], BY.top);
  st.poly([[W.s1, BY.t0], [s1, BY.t0], [s1, BY.t1], [W.s1, BY.t1]]);
  // west face (to the Traffic Quad): RED BRICK with white sashes under brick heads (photographs 02, P.WBACK), the archway
  // on the cross axis (a low round-headed brick arch), the lane's way at the south end, the porch
  westBack(st);
  // the ends: south (hipped; a window a floor) and north (on the Hostel's south face)
  const fs = face(K, 'S', W.t1, W.s0, W.s1); wallFace(st, fs, e, bayOps(K, fs, [-3.35]));
  const fn = face(K, 'N', W.t0, W.s0, P.NORTH.s0); wallFace(st, fn, e, []);
  // the west wing (gabled to the west): red brick like the face it stands on; its north face plain with the lantern
  const Wg = P.WING, plain = (ops) => ops.map((q) => ({ ...q, noArch: true }));
  wallFace(st, face(K, 'N', Wg.t0, Wg.s0, W.s0), e, [], { key: BR });
  { const f = face(K, 'S', Wg.t1, Wg.s0, W.s0); wallFace(st, f, e, plain(bayOps(K, f, [(Wg.s0 + W.s0) / 2])), { key: BR }); }
  const fwg = face(K, 'W', Wg.s0, Wg.t0, Wg.t1); wallFace(st, fwg, e, plain(bayOps(K, fwg, [Wg.t0 + 1.6, Wg.t1 - 1.6])).concat([{ pts: K.rectPts(fwg.x((Wg.t0 + Wg.t1) / 2) - 0.3, 8.3, fwg.x((Wg.t0 + Wg.t1) / 2) + 0.3, 9.1), kind: 'win', glass: 'sash', d: 0.15, noArch: true }]), { cornice: true, key: BR });
  { const f = face(K, 'N', Wg.t0, Wg.s0, W.s0); B.push(f.M); const x = f.x(W.s0 - 0.55), p = K.lantern(B, x, 3.4, 0.4, { size: 0.26 }); B.box('ironBlack', x, 3.72, 0.2, 0.04, 0.04, 0.4, 0, {}); st.lamp(f, p[0], p[1], p[2]); B.pop(); }
  // the roofs
  K.roof(B, ROOF, W.s0, W.s1, W.t0, W.t1, e, PITCH * (W.s1 - W.s0) / 2, { axis: 'z', ends: ['gable', 'hip'], ov: 0.35, wallKey: RUB });
  K.roof(B, ROOF, Wg.s0, -4.0, Wg.t0, Wg.t1, e, PITCH * (Wg.t1 - Wg.t0) / 2, { axis: 'x', ends: ['gable', 'open'], ov: 0.35, wallKey: BR });
  // dormers: small pedimented ones on the court slope, small gabled ones with pale fronts on the west slope (Halling 2025)
  const back = 0.45, dc = face(K, 'E', W.s1 - back, W.t0, W.t1), sill = e + back * PITCH + 0.05;
  for (const t of P.W_DORMERS) K.dormer(B, dc.M, dc.x(t), sill, 1.1, 1.25, 2.6, { key: DR, roofKey: ROOF, glass: 'sash', rise: 0.5, margin: 0.14 });
  const dw = face(K, 'W', W.s0 + back, W.t0, W.t1);
  for (const t of P.WBACK.dormers) K.dormer(B, dw.M, dw.x(t), sill, 1.05, 1.2, 2.4, { key: DR, roofKey: ROOF, glass: 'sash', rise: 0.5, margin: 0.14 });
  // the passages: the arch (court level) and the lane's way at the south end
  passage(st, W.s0, W.s1, AXIS, P.W_ARCH.w, COURT, P.W_ARCH.spring, { floor: 'pavingSolid' });
  st.floor([[W.s0 - 0.3, AXIS - 1.3], [W.s1 + 0.1, AXIS - 1.3], [W.s1 + 0.1, AXIS + 1.3], [W.s0 - 0.3, AXIS + 1.3]], COURT + 0.01);
  passage(st, W.s0, W.s1, (PASS[0] + PASS[1]) / 2, 2.8, P.LANE, 3.55, { flat: 3.98 });
  // colliders round the range (gaps for the two ways)
  const [a0, a1] = [AXIS - P.W_ARCH.w / 2, AXIS + P.W_ARCH.w / 2];
  st.poly([[W.s0, W.t0], [W.s0, a0]]); st.poly([[W.s0, a1], [W.s0, Wg.t0], [Wg.s0, Wg.t0], [Wg.s0, Wg.t1], [W.s0, Wg.t1], [W.s0, PASS[0] + 0.0]]);
  st.poly([[W.s0, PASS[1]], [W.s0, W.t1], [W.s1, W.t1], [W.s1, PASS[1]]]); st.poly([[W.s1, PASS[0]], [W.s1, a1]]); st.poly([[W.s1, a0], [W.s1, P.NORTH.t1]]);
  st.poly([[W.s0, W.t0], [P.NORTH.s0, W.t0]]);
}

/** the west range's WEST face (to the Traffic Quad): red brick, white 6 over 6 sashes under brick heads (flat over the
 *  first floor, segmental over the ground), the low round-headed archway on the cross axis, the lane's way, the porch with
 *  its stone doorcase, pale downpipes, the garden wall north of the archway path, planting along the foot. P.WBACK. */
function westBack(st) {
  const { B, K, F } = st, W = P.WEST, WB = P.WBACK, e = W.eaves, A = WB.arch;
  const fw = face(K, 'W', W.s0, W.t0, W.t1), ax = fw.x(AXIS), pc = (PASS[0] + PASS[1]) / 2;
  const sb = (t, y) => ({ ...sash(K, fw.x(t), WB.w, y), noArch: true });
  const ops = WB.first.map((t) => sb(t, WB.f)).concat(WB.ground.map((t) => sb(t, WB.g)), WB.south.map((t) => sb(t, WB.f)), WB.south.map((t) => sb(t, WB.g)));
  for (const t of WB.small) ops.push({ pts: K.rectPts(fw.x(t) - 0.25, 3.05, fw.x(t) + 0.25, 3.75), kind: 'win', glass: 'sash', d: 0.15, noArch: true });
  ops.push({ pts: ellPts(ax, A.w, COURT, A.spring, A.rise, 12), kind: 'void', d: 0.45, revealKey: BR });
  ops.push({ pts: K.segPts(fw.x(pc), 2.8, P.LANE, 3.55, 0.45, 8), kind: 'void', d: 0.45, revealKey: BR });
  wallFace(st, fw, e, ops, { key: BR });
  B.push(fw.M);
  // brick heads: flat gauged over the first floor, a shallow segmental ring over the ground floor (Halling 2025)
  for (const t of WB.first.concat(WB.south)) B.box('brickWarm', fw.x(t), WB.f[1] + WB.head / 2, 0.015, WB.w + 0.22, WB.head, 0.03, 0, {});
  for (const t of WB.ground.concat(WB.south)) ellRing(B, 'brickWarm', fw.x(t), WB.g[1] - 0.02, WB.w / 2, 0.14, WB.head, 0.025, 6);
  // the archway: two rings of gauged brick
  ellRing(B, 'brickWarm', ax, A.spring, A.w / 2, A.rise, A.ring, 0.05, 14);
  ellRing(B, 'brickDark', ax, A.spring, A.w / 2 + A.ring, A.rise + A.ring, 0.12, 0.03, 14);
  for (const t of WB.pipes) B.box('whitePaint', fw.x(t), (1.2 + e) / 2 - 0.1, 0.1, 0.09, e - 1.4, 0.09, 0, {});
  B.pop();
  // the porch: single storey, brick, flat roof behind a stone-coped parapet; the door in a stone doorcase with a fanlight
  const PO = WB.porch, sF = W.s0 - PO.proj, gD = F.groundY(sF - 0.6, PO.door), y0 = gD + 0.15;
  const pf = face(K, 'W', sF, PO.t0, PO.t1), dx = pf.x(PO.door);
  wallFace(st, pf, PO.top, [{ pts: K.rectPts(dx - 0.48, y0, dx + 0.48, y0 + 2.2), kind: 'door', doorKey: 'doorOak', d: 0.2 }, { pts: K.rectPts(dx - 0.48, y0 + 2.3, dx + 0.48, y0 + 2.75), kind: 'win', glass: 'glassDark', d: 0.2, sill: false, noArch: true }], { key: BR, cornice: false });
  for (const [dir, c] of [['N', PO.t0], ['S', PO.t1]]) wallFace(st, face(K, dir, c, sF, W.s0), PO.top, [], { key: BR, cornice: false });
  B.push(pf.M);
  for (const sx of [-0.66, 0.66]) B.box(DR, dx + sx, (y0 + y0 + 2.75) / 2, 0.06, 0.26, 2.8, 0.12, 0, {});      // pilasters
  B.box(DR, dx, y0 + 2.92, 0.08, 1.7, 0.34, 0.16, 0, { bottom: true });                                      // entablature
  B.box(DR, dx, y0 + 2.28, 0.03, 0.96, 0.08, 0.06, 0, {});                                                  // transom
  B.box(DR, dx, y0 - 0.08, 0.2, 1.5, 0.16, 0.4, 0, {});                                                     // the step
  B.pop();
  const pr = [[sF, PO.t0], [W.s0, PO.t0], [W.s0, PO.t1], [sF, PO.t1]];
  K.parapet(B, DR, [[W.s0, PO.t0], [sF + 0.1, PO.t0], [sF + 0.1, PO.t1], [W.s0, PO.t1]], PO.top - 0.02, 0.1, 0.36);
  B.flat('lead', pr, PO.top - 0.3);
  st.poly([[W.s0, PO.t0], [sF, PO.t0], [sF, PO.t1], [W.s0, PO.t1]]);
  // the garden wall square off the face north of the archway path, a stone-capped pier at its end
  const GW = WB.gwall, gy = Math.min(F.groundY(W.s0 - 1, GW.t), F.groundY(GW.s1, GW.t)) - 0.4, gt = F.groundY(W.s0 - 2, GW.t);
  B.box(BR, (W.s0 + GW.s1 + 0.25) / 2, (gy + gt + GW.h) / 2, GW.t, W.s0 - GW.s1 - 0.25, gt + GW.h - gy, 0.34, 0, {});
  B.box(DR, (W.s0 + GW.s1 + 0.25) / 2, gt + GW.h + 0.05, GW.t, W.s0 - GW.s1 - 0.25, 0.1, 0.42, 0, { bottom: true });
  B.box(BR, GW.s1, (gy + gt + GW.pier) / 2, GW.t, 0.5, gt + GW.pier - gy, 0.5, 0, {});
  B.box(DR, GW.s1, gt + GW.pier + 0.07, GW.t, 0.62, 0.14, 0.62, 0, { bottom: true });
  st.poly([[W.s0, GW.t], [GW.s1 - 0.25, GW.t]]);
  // planting along the foot (draped in LOCAL after the frame is popped; clumps here)
  for (const [a, b] of WB.beds) {
    st.after.push(() => st.G.drape(B, 'flowerbed', F.ring([[W.s0 - 0.9, a], [W.s0, a], [W.s0, b], [W.s0 - 0.9, b]]), 0.08));
    const n = Math.max(1, Math.round((b - a) / 1.3));
    for (let i = 0; i < n; i++) { const t = a + ((i + 0.5) * (b - a)) / n; if (t > PO.t0 - 0.3 && t < PO.t1 + 0.3) continue; clump(B, W.s0 - 0.45, t, F.groundY(W.s0 - 0.45, t) + 0.05, 0.6, 0.5 + ((i * 7) % 3) * 0.15, i + 2); }
  }
}

// ------------------------------------------------------------------------------------------------ the north range
function northRange(st) {
  const { B, K } = st, N = P.NORTH, PR = P.PROJ, e = N.eaves, GB = P.N_GABLE;
  // court face (looking south) with the pedimented centre gable
  const fc = face(K, 'S', N.t1, P.WEST.s1, N.s1), gx = fc.x(GB.s), hw = GB.w / 2;
  const ops = bayOps(K, fc, P.N_BAYS).concat(bayOps(K, fc, [GB.s]));
  ops.push({ pts: K.archPts(gx, 0.8, 8.35, 9.55, 10), kind: 'win', glass: 'archSash', spring: 9.55, d: 0.2 });
  wallFace(st, fc, e, ops, { outline: (foot) => [[0, foot], [fc.len, foot], [fc.len, e], [gx + hw, e], [gx, GB.apex], [gx - hw, e], [0, e]] });
  B.push(fc.M);
  for (const [p, q] of [[[gx - hw - 0.15, e - 0.05], [gx, GB.apex + 0.1]], [[gx, GB.apex + 0.1], [gx + hw + 0.15, e - 0.05]]]) B.beam(DR, [p[0], p[1], 0.08], [q[0], q[1], 0.08], 0.22, 0.2);
  for (const sgn of [-1, 1]) B.poly(ROOF, [[gx + sgn * (hw + 0.2), e - 0.02, 0.2], [gx, GB.apex + 0.12, 0.2], [gx, GB.apex + 0.12, -3.2], [gx + sgn * (hw + 0.2), e - 0.02, -3.2]], [sgn, 1, 0]);
  shield(B, gx, 5.0, 0.7, 0.75);
  for (const s of P.N_SHIELDS) shield(B, fc.x(s), 6.4);
  for (const s of [4.2, 18.0]) B.box('ironBlack', fc.x(s), (COURT + e) / 2, 0.12, 0.1, e - COURT - 0.3, 0.1, 0, {});
  B.pop();
  // north faces on Loverose Way: small first-floor windows, the ground floor behind the boundary wall
  const small = { g: [2.6, 3.9], f: [5.3, 6.5], w: 0.8 };
  const sides = [[N.s0, PR.s0, N.t0, [1.6, 3.8]], [PR.s0, PR.s1, PR.t0, [7.4, 9.7, 12.0, 14.3, 16.6]], [PR.s1, N.s1, N.t0, [19.6, 21.8]]];
  for (const [a, b, c, qs] of sides) { const f = face(K, 'N', c, a, b); wallFace(st, f, e, bayOps(K, f, qs, small)); }
  for (const [dir, c] of [['W', PR.s0], ['E', PR.s1]]) { const f = face(K, dir, c, PR.t0, N.t0); wallFace(st, f, e, []); }
  // the roofs: one roof the whole length (its court slope runs on unbroken), the deeper middle over it on the north
  K.roof(B, ROOF, N.s0, 27.2, N.t0, N.t1, e, PITCH * (N.t1 - N.t0) / 2, { axis: 'x', ends: ['gable', 'open'], ov: 0.35, wallKey: RUB });
  projRoof(B, PR.s0, PR.s1, PR.t0, N.t1, e, N.t0);
  // dormers: pedimented on the court slope, hipped on the north
  const back = 0.45, sill = e + back * PITCH + 0.05, dc = face(K, 'S', N.t1 - back, N.s0, 27.2);
  for (const s of P.N_DORMERS) K.dormer(B, dc.M, dc.x(s), sill, 1.1, 1.25, 2.6, { key: DR, roofKey: ROOF, glass: 'sash', rise: 0.5, margin: 0.14 });
  for (const s of P.NN_DORMERS) { const t = s > PR.s0 && s < PR.s1 ? PR.t0 : N.t0, f = face(K, 'N', t + back, N.s0, 27.2); hipDormer(K, B, f.M, f.x(s), sill, 1.1, 1.2, 2.4); }
  st.poly([[P.WEST.s1, N.t1], [N.s1, N.t1]]);
  st.poly([[N.s0, P.WEST.t0], [N.s0, N.t0], [PR.s0, N.t0], [PR.s0, PR.t0], [PR.s1, PR.t0], [PR.s1, N.t0], [N.s1, N.t0]]);
}
/** the north range's deeper middle: a hipped roof whose court slope is drawn only above the main ridge (below it the two
 *  slopes are one plane and the main roof draws it) */
function projRoof(B, s0, s1, t0, t1, e, tMain0) {
  const ov = 0.35, ye = e - ov * PITCH, half = (t1 - t0) / 2, tr = (t0 + t1) / 2, yr = e + half * PITCH, ra = s0 + half, rb = s1 - half;
  const A = [s0 - ov, ye, t0 - ov], Bq = [s1 + ov, ye, t0 - ov], C = [s1 + ov, ye, t1 + ov], D = [s0 - ov, ye, t1 + ov], R0 = [ra, yr, tr], R1 = [rb, yr, tr];
  B.poly(ROOF, [A, Bq, R1, R0], [0, 1, -1]);
  B.poly(ROOF, [D, A, R0], [-1, 1, 0]);
  B.poly(ROOF, [Bq, C, R1], [1, 1, 0]);
  const yMain = e + ((t1 - tMain0) / 2) * PITCH, f = (yr - yMain) / (yr - ye);
  const pL = [R0[0] + f * (D[0] - R0[0]), yMain, R0[2] + f * (D[2] - R0[2])], pR = [R1[0] + f * (C[0] - R1[0]), yMain, R1[2] + f * (C[2] - R1[2])];
  B.poly(ROOF, [pL, pR, R1, R0], [0, 1, 1]);
}

// ------------------------------------------------------------------------------------------------ the north-east block on Woodstock Road
function neBlock(st) {
  const { B, K } = st, E = P.NE, e = E.eaves, GB = P.NE_GABLE, mid = P.NE_BAYS[2];
  const tall = { g: [2.3, 4.25], f: [5.15, 6.95], w: 1.05 };
  const fs = face(K, 'E', E.s1, E.t0, E.t1), gx = fs.x(mid), hw = GB.w / 2;
  const ops = bayOps(K, fs, P.NE_BAYS, tall);
  ops.push({ pts: K.rectPts(gx - 0.3, e + 0.4, gx + 0.3, e + 1.25), kind: 'win', glass: 'sash', d: 0.15, noArch: true });
  wallFace(st, fs, e, ops, { brackets: true, outline: (foot) => [[0, foot], [fs.len, foot], [fs.len, e], [gx + hw, e], [gx + hw, e + 0.25], [gx, GB.apex], [gx - hw, e + 0.25], [gx - hw, e], [0, e]] });
  B.push(fs.M);
  for (const [p, q] of [[[gx - hw - 0.25, e + 0.2], [gx, GB.apex + 0.12]], [[gx, GB.apex + 0.12], [gx + hw + 0.25, e + 0.2]]]) B.beam(DR, [p[0], p[1], 0.12], [q[0], q[1], 0.12], 0.26, 0.24);
  for (const sgn of [-1, 1]) B.poly(ROOF, [[gx + sgn * (hw + 0.25), e + 0.15, 0.25], [gx, GB.apex + 0.14, 0.25], [gx, GB.apex + 0.14, -3.0], [gx + sgn * (hw + 0.25), e + 0.15, -3.0]], [sgn, 1, 0]);
  shield(B, gx, 4.95, 0.6, 0.7);
  K.stringCourse(B, DR, 0, fs.len, 1.95, 0.45, 0.06);      // plinth
  B.pop();
  const fn = face(K, 'N', E.t0, E.s0, E.s1); wallFace(st, fn, e, bayOps(K, fn, [25.2, 27.2, 29.1], { g: [2.6, 3.9], f: [5.3, 6.5], w: 0.8 }));
  const fsth = face(K, 'S', E.t1, E.s0, E.s1); wallFace(st, fsth, e, bayOps(K, fsth, [30.3], { ground: false, w: 0.8, f: [5.6, 6.8] }), { brackets: true });
  const fc = face(K, 'W', E.s0, P.NORTH.t1, E.t1);
  const tri = (y) => ({ pts: K.rectPts(fc.x(4.1) - 1.05, y[0], fc.x(4.1) + 1.05, y[1]), kind: 'win', glass: 'sash', lights: 3, mullionW: 0.16, d: 0.2 });
  wallFace(st, fc, e, [tri(WIN.g), tri(WIN.f)]);
  K.roof(B, ROOF, E.s0, E.s1, E.t0, E.t1, e, PITCH * (E.s1 - E.s0) / 2, { axis: 'z', ends: ['hip', 'hip'], ov: 0.45 });
  const back = 0.45, sill = e + back * PITCH + 0.05;
  { const d = face(K, 'W', E.s0 + back, E.t0, E.t1); K.dormer(B, d.M, d.x(4.1), sill, 1.1, 1.25, 2.4, { key: DR, roofKey: ROOF, glass: 'sash', rise: 0.5, margin: 0.14 }); }
  { const d = face(K, 'N', E.t0 + back, E.s0, E.s1); hipDormer(K, B, d.M, d.x(27.2), sill, 1.1, 1.2, 2.4); }
  st.poly([[E.s0, E.t0], [E.s1, E.t0], [E.s1, E.t1], [P.LODGE.s1, E.t1]]); st.poly([[E.s0, P.NORTH.t1], [E.s0, E.t1], [P.LODGE.s0, E.t1]]);
}

// ------------------------------------------------------------------------------------------------ the lodge range, its arch and pavilions
function lodge(st) {
  const { B, K } = st, L = P.LODGE, e = L.eaves, AC = P.L_ARCH.court, AS = P.L_ARCH.street, LS = P.L_STREET, LC = P.L_COURT;
  // street face (looking east)
  const fs = face(K, 'E', L.s1, L.t0, L.t1), ax = fs.x(AXIS);
  const sops = [
    { pts: K.archPts(ax, AS.w, st.fore(AXIS) - 0.05, AS.spring, 12), kind: 'void', d: 0.45, revealKey: DR },
    sash(K, fs.x(LS.sash), 1.0, [3.25, 4.5]),
    { pts: K.rectPts(fs.x(LS.two) - 0.3, 3.15, fs.x(LS.two) + 0.3, 4.2), kind: 'win', glass: 'sash', lights: 2, mullionW: 0.09, d: 0.2 },
  ];
  wallFace(st, fs, e, sops);
  B.push(fs.M);
  ringArch(B, ax, AS.spring, AS.w / 2, 0.42, 0.05, 14);
  B.box(DR, fs.x(LS.two), 4.27, 0.03, 0.86, 0.13, 0.07, 0, {});
  B.box('leadDark', fs.x(LS.plaque), 3.7, 0.02, 0.4, 0.38, 0.04, 0, {});      // the slate plaque (plain)
  K.stringCourse(B, DR, 0, fs.len, 1.95, 0.3, 0.05);
  B.pop();
  // the court face (looking west): the wide glazed arch between the pavilions
  const fc = face(K, 'W', L.s0, L.t0, L.t1), cx = fc.x(AXIS);
  const cops = [
    { pts: K.archPts(cx, AC.w, COURT, AC.spring, 12), kind: 'void', d: 0.45, revealKey: DR },
    sash(K, fc.x(LC.win), 1.0, [2.6, 4.05]),
    { pts: K.rectPts(fc.x(LC.win3) - 1.1, 2.6, fc.x(LC.win3) + 1.1, 4.05), kind: 'win', glass: 'sash', lights: 3, mullionW: 0.14, d: 0.2 },
  ];
  wallFace(st, fc, e, cops);
  B.push(fc.M);
  ringArch(B, cx, AC.spring, AC.w / 2, 0.38, 0.05, 14);
  // the glazed head of the arch (the doors below it stand open: the way is walkable)
  const r = AC.w / 2, head = [[cx - r, AC.spring]]; for (let i = 0; i <= 12; i++) { const a = Math.PI - (i / 12) * Math.PI; head.push([cx + Math.cos(a) * r, AC.spring + Math.sin(a) * r]); }
  B.unit('glassDark', head, -0.3, K.nextBay(4));
  B.box('whitePaint', cx, AC.spring - 0.05, -0.3, AC.w, 0.1, 0.08, 0, { bottom: true });
  for (const k of [-1, 0, 1]) B.box('whitePaint', cx + k * r * 0.5, AC.spring + 0.6, -0.3, 0.06, 1.2 * (k ? 0.75 : 1), 0.06, 0, {});
  for (const t of [AXIS - 1.62, AXIS + 1.62]) { const p = K.lantern(B, fc.x(t), 4.05, 0.36, { size: 0.24 }); B.box('ironBlack', fc.x(t), 4.35, 0.18, 0.04, 0.04, 0.36, 0, {}); st.lamp(fc, p[0], p[1], p[2]); }
  B.pop();
  K.roof(B, ROOF, L.s0, L.s1, L.t0, L.t1, e, L.pitch * (L.s1 - L.s0) / 2, { axis: 'z', ends: ['open', 'open'], ov: 0.3 });
  // dormers (hipped): street two, court three
  { const back = 1.35, d = face(K, 'E', L.s1 - back, L.t0, L.t1); for (const t of LS.dormers) hipDormer(K, B, d.M, d.x(t), e + back * L.pitch + 0.05, 1.05, 0.95, 1.2, { rise: 0.3 }); }
  { const back = 0.9, d = face(K, 'W', L.s0 + back, L.t0, L.t1); for (const t of LC.dormers) hipDormer(K, B, d.M, d.x(t), e + back * L.pitch + 0.05, 1.0, 0.95, 1.5, { rise: 0.3 }); }
  // the pavilions: two storeys, hipped, quoined; a window, a blank panel, a window
  for (const [t0, t1] of P.PAV.spans) {
    const pf = face(K, 'W', P.PAV.s0, t0, t1), x = pf.len / 2, wy = [RAISED + 0.6, RAISED + 1.95];
    wallFace(st, pf, P.PAV.eaves, [sash(K, x, 0.95, wy), sash(K, x, 0.95, [5.35, 6.55])], { key: DR });
    B.push(pf.M); quoins(B, pf.len, RAISED, P.PAV.eaves - 0.3); B.box(DR, x, 4.75, 0.04, 1.1, 0.65, 0.06, 0, {}); B.pop();
    for (const [dir, c] of [['N', t0], ['S', t1]]) { const f = face(K, dir, c, P.PAV.s0, P.PAV.s1); wallFace(st, f, P.PAV.eaves, [], { key: DR }); }
    K.roof(B, ROOF, P.PAV.s0, P.PAV.s1, t0, t1, P.PAV.eaves, P.PAV.ridge - P.PAV.eaves, { axis: 'x', ends: ['hip', 'open'], ov: 0.25, hipRun: (t1 - t0) / 2 });
    st.poly([[L.s0, t0], [P.PAV.s0, t0], [P.PAV.s0, t1], [L.s0, t1]]);
  }
  // the passage: vaulted, its floor up three steps from the court and two from the forecourt; the oak doors stand open
  const pw = AC.w, a = AXIS - pw / 2, b = AXIS + pw / 2, sIn = L.s1 - 0.45;
  passage(st, L.s0, sIn, AXIS, pw, P.LODGE_FL, AC.spring, {});
  { const f = face(K, 'W', sIn, a, b); B.push(f.M); B.face(RUB, [[0, P.LODGE_FL - 0.4], [pw, P.LODGE_FL - 0.4], [pw, AC.spring + pw / 2 + 0.3], [0, AC.spring + pw / 2 + 0.3]], [K.archPts(pw / 2, AS.w, P.LODGE_FL - 0.5, AS.spring, 12)]); B.pop(); }
  const top = P.LODGE_FL, s = P.STEP, sTop = L.s0 + 0.3;
  B.flat('pavingSolid', [[sTop, a], [L.s1 - 0.4, a], [L.s1 - 0.4, b], [sTop, b]], top);
  // up from the forecourt (flush with the city's pavement since the merge): n equal risers, the first two in the arch
  // (the threshold), any more as steps on the forecourt before the street face
  const yf = st.fore(AXIS), nR = Math.max(2, Math.round((top - yf) / 0.167)), rR = (top - yf) / nR, thr = top - rR;
  B.poly('pavingSolid', [[L.s1 - 0.4, thr, a], [L.s1 - 0.4, thr, b], [L.s1 - 0.4, top, b], [L.s1 - 0.4, top, a]], [1, 0, 0]);
  stepsS(B, sTop, -1, a, b, 3, s.rise, s.going, top, COURT - 0.3);
  B.box('pavingSolid', L.s1 - 0.175, thr - 0.225, AXIS, 0.45, 0.45, pw, 0, {});      // the threshold step in the street arch
  for (let k = 2; k < nR; k++) { const y = top - rR * k, s0 = L.s1 + 0.05 + s.going * (k - 2), s1 = s0 + s.going; B.box('pavingSolid', (s0 + s1) / 2, (y + yf - 0.3) / 2, AXIS, s.going, y - yf + 0.3, pw + 0.4, 0, {}); }
  st.floor([[sTop, a], [L.s1 - 0.4, a], [L.s1 - 0.4, b], [sTop, b]], top);
  st.floor([[L.s1 - 0.4, a], [L.s1 + 0.05, a], [L.s1 + 0.05, b], [L.s1 - 0.4, b]], thr);
  st.lodgeSteps = { a: a - 0.2, b: b + 0.2, s0: L.s1 + 0.05, n: nR - 2, going: s.going, y: (k) => top - rR * (k + 2) };      // (registered after the forecourt: street())
  st.floor([[sTop - 3 * s.going, a], [sTop, a], [sTop, b], [sTop - 3 * s.going, b]], (ss) => Math.max(COURT + 0.09, top - s.rise * (1 + Math.min(2, Math.floor((sTop - ss) / s.going)))));      // (the lowest tread is under the court's paving: touch-up 2's walk check found a 0.09 dip)
  for (const [t, dz] of [[a + 0.06, 1], [b - 0.06, -1]]) B.box('oakDoor', L.s1 - 1.05, (top + AS.spring + 0.4) / 2, t + dz * 0.0, 1.2, AS.spring + 0.4 - top, 0.08, 0, {});
  // colliders: the faces with the way left open
  st.poly([[L.s1, P.NE.t1], [L.s1, AXIS - AS.w / 2]]); st.poly([[L.s1, AXIS + AS.w / 2], [L.s1, L.t1]]);
  st.poly([[L.s0, P.NE.t1], [L.s0, a]]); st.poly([[L.s0, b], [L.s0, L.t1]]);
}

// ------------------------------------------------------------------------------------------------ the gateway block
function gateBlock(st) {
  const { B, K } = st, Gb = P.GATE, e = Gb.eaves, pc = (PASS[0] + PASS[1]) / 2, pw = PASS[1] - PASS[0];
  const way = (fc) => ({ pts: K.rectPts(fc.x(pc) - pw / 2, P.LANE, fc.x(pc) + pw / 2, P.PASS_H), kind: 'void', d: 0.45, revealKey: DR });
  const fs = face(K, 'E', Gb.s1, Gb.t0, Gb.t1);
  wallFace(st, fs, e, [way(fs), sash(K, fs.x(pc), 1.0, [5.2, 6.8])], { brackets: true });
  B.push(fs.M); B.box(DR, fs.x(pc), P.PASS_H + 0.22, 0.05, pw + 0.5, 0.44, 0.1, 0, {}); K.stringCourse(B, DR, 0, fs.len, 1.95, 0.45, 0.06); B.pop();      // the flat lintel; plinth
  const fc = face(K, 'N', Gb.t0, Gb.s0, Gb.s1);
  // the court face: a doorcase with an oculus over it; first-floor sashes (the part east of s 24 is behind the lodge)
  const dx = fc.x(20.4), ocu = []; for (let i = 0; i < 14; i++) { const an = (i / 14) * Math.PI * 2; ocu.push([dx + Math.cos(an) * 0.42, 5.55 + Math.sin(an) * 0.42]); }
  wallFace(st, fc, e, [
    { pts: K.rectPts(dx - 0.55, P.FFL, dx + 0.55, P.FFL + 2.3), kind: 'door', doorKey: 'doorOak', d: 0.3 },
    { pts: ocu, kind: 'win', glass: 'glassDark', d: 0.25, sill: false },
    sash(K, fc.x(18.2), 0.95, WIN.f), sash(K, fc.x(22.6), 0.95, WIN.f),
  ]);
  B.push(fc.M);
  B.box(DR, dx, P.FFL + 2.45, 0.08, 1.7, 0.28, 0.16, 0, { bottom: true });
  for (const sx of [-0.72, 0.72]) B.box(DR, dx + sx, P.FFL + 1.15, 0.05, 0.22, 2.3, 0.1, 0, {});
  ringArch(B, dx, 5.55, 0.42, 0.18, 0.04, 14);
  B.pop();
  const fw = face(K, 'W', Gb.s0, Gb.t0, Gb.t1); wallFace(st, fw, e, [way(fw), sash(K, fw.x(pc), 0.95, WIN.f)]);
  const fsth = face(K, 'S', Gb.t1, Gb.s0, Gb.s1); wallFace(st, fsth, e, []);      // (on the presbytery: never seen)
  K.roof(B, ROOF, Gb.s0, Gb.s1, Gb.t0, Gb.t1, e, PITCH * (Gb.t1 - Gb.t0) / 2, { axis: 'x', ends: ['hip', 'hip'], ov: 0.45 });
  passage(st, Gb.s0, Gb.s1, pc, pw, P.LANE, 0, { flat: P.PASS_H });
  st.drape('setts', [[Gb.s0, PASS[0]], [Gb.s1, PASS[0]], [Gb.s1, PASS[1]], [Gb.s0, PASS[1]]], 0.02, { y: () => P.LANE });
  st.floor([[Gb.s0 - 0.2, PASS[0]], [Gb.s1 + 0.2, PASS[0]], [Gb.s1 + 0.2, PASS[1]], [Gb.s0 - 0.2, PASS[1]]], P.LANE + 0.02);
  st.poly([[Gb.s1, Gb.t0], [Gb.s1, PASS[0]]]); st.poly([[Gb.s1, PASS[1]], [Gb.s1, Gb.t1], [Gb.s0, Gb.t1], [Gb.s0, PASS[1]]]); st.poly([[Gb.s0, PASS[0]], [Gb.s0, Gb.t0], [Gb.s1, Gb.t0]]);
}

// ------------------------------------------------------------------------------------------------ the court's south wall, the lean-to, the lane
function southSide(st) {
  const { B, K, G, F } = st, SW = P.SOUTH_WALL, SH = P.SHED, y0 = COURT - 0.5, tc = SW.t + SW.th / 2;
  for (const [a, b] of [[SW.s0, SW.gate[0]], [SW.gate[1], SW.s1]]) { B.box(RUB, (a + b) / 2, (y0 + SW.top) / 2, tc, b - a, SW.top - y0, SW.th, 0, {}); B.box(DR, (a + b) / 2, SW.top + 0.06, tc, b - a + 0.06, 0.12, SW.th + 0.12, 0, { bottom: true }); st.seg(a, tc, b, tc); }
  for (const s of SW.gate) B.box(DR, s, (y0 + SW.top + 0.25) / 2, tc, 0.45, SW.top + 0.25 - y0, 0.55, 0, {});
  // the lean-to on the lane side: a slate roof on posts falling from the wall (G)
  const tw = SW.t + SW.th;
  B.poly('slate', [[SH.s0, SH.back, tw], [SH.s1, SH.back, tw], [SH.s1, SH.front, SH.t1], [SH.s0, SH.front, SH.t1]], [0, 1, 0.3]);
  B.poly('timberGrey', [[SH.s0, SH.back - 0.06, tw], [SH.s1, SH.back - 0.06, tw], [SH.s1, SH.front - 0.06, SH.t1], [SH.s0, SH.front - 0.06, SH.t1]], [0, -1, -0.3]);
  for (let s = SH.s0; s <= SH.s1 + 1e-6; s += (SH.s1 - SH.s0) / 5) B.box('timberGrey', s, (P.LANE + SH.front) / 2, SH.t1 - 0.06, 0.12, SH.front - P.LANE, 0.12, 0, {});
  for (const s of [SH.s0, SH.s1]) { B.poly(RUB, [[s, P.LANE - 0.2, tw], [s, P.LANE - 0.2, SH.t1], [s, SH.front, SH.t1], [s, SH.back, tw]], [s === SH.s0 ? -1 : 1, 0, 0]); st.seg(s, tw, s, SH.t1); }
  // the lane: asphalt on the survey from the Traffic Quad side to the gateway block
  const lane = (s, t) => Math.max(1.3, F.groundY(s, t));
  st.drape('asphalt', [[P.WEST.s0 - 0.5, SH.t1], [P.GATE.s0, SH.t1], [P.GATE.s0, P.GATE.t1 - 0.4], [P.WEST.s0 - 0.5, P.GATE.t1 - 0.4]], 0.06, { y: lane });
  st.drape('asphalt', [[P.WEST.s1, tw], [SH.s0, tw], [SH.s0, SH.t1], [P.WEST.s1, SH.t1]], 0.06, { y: lane });
  st.floor([[P.WEST.s0 - 0.5, tw], [P.GATE.s0, tw], [P.GATE.s0, P.GATE.t1 - 0.4], [P.WEST.s0 - 0.5, P.GATE.t1 - 0.4]], (s, t) => lane(s, t) + 0.06);
}

// ------------------------------------------------------------------------------------------------ Woodstock Road: the forecourt, the hoops, the flagpole; the Loverose Way wall
function street(st) {
  const { B, K, G, F } = st, bnd = (t) => { const b = P.BOUND; for (let i = 0; i < b.length - 1; i++) if (t <= b[i + 1][1] || i === b.length - 2) return b[i][0] + ((t - b[i][1]) * (b[i + 1][0] - b[i][0])) / (b[i + 1][1] - b[i][1]); return b[0][0]; };
  // (two rings. The DRAWN forecourt runs 0.10 m out: over the 5 cm by which the city's base ground is holed beyond the
  // boundary (somerville.js preMap) - a gap there, with nothing under it, showed the sky as a pale line along the edge
  // seen low from the street - and short of the city's pavement and its kerb ramp (from about 0.15 m out), so nothing of
  // ours lies under the pavement; its outer face goes down into the ground. The WALKED floor runs 0.25 m out at the
  // pavement's level, so the step stays flush.)
  const fring = (k) => [[P.NE.s1, P.NE.t0], [bnd(P.NE.t0) - k, P.NE.t0], [bnd(P.NE.t1) - k, P.NE.t1], [bnd(15.4) - k, 15.4], [bnd(P.GATE.t0) - k, P.GATE.t0], [P.LODGE.s1, P.GATE.t0], [P.LODGE.s1, P.NE.t1], [P.NE.s1, P.NE.t1]];
  const k = -0.10, ring = fring(k), walkRing = fring(-0.25);
  // the forecourt: flush with the city's pavement just outside the boundary (the merge; was one level, P.STRIP, behind a kerb)
  const fy = (s, t) => st.fore(t), yLo = Math.min(...ring.map((p) => fy(p[0], p[1])));
  K.prism(B, DR, ring, P.STREET - 0.6, yLo - 0.02, {});
  st.drape('paving', ring, 0.0, { y: fy });
  st.floor(walkRing, fy);
  { const L = st.lodgeSteps; if (L) for (let k = 0; k < L.n; k++) st.floor([[L.s0 + L.going * k, L.a], [L.s0 + L.going * (k + 1), L.a], [L.s0 + L.going * (k + 1), L.b], [L.s0 + L.going * k, L.b]], L.y(k)); }
  // setts in the vehicle way's mouth, falling from the passage's level to the city's crossover at the boundary
  const mouth = [[P.GATE.s1, P.GATE.t0], [bnd(P.GATE.t0) - k, P.GATE.t0], [bnd(P.GATE.t1) - k, P.GATE.t1 - 0.1], [P.GATE.s1, P.GATE.t1 - 0.1]];
  const my = (s, t) => { const sb = bnd(t), f = Math.max(0, Math.min(1, (s - P.GATE.s1) / Math.max(0.5, sb - P.GATE.s1))); return P.LANE + 0.02 + (st.road(t) - P.LANE - 0.02) * f; };
  st.drape('setts', mouth, 0.0, { y: my });
  st.floor([[P.GATE.s1, P.GATE.t0], [bnd(P.GATE.t0) + 0.25, P.GATE.t0], [bnd(P.GATE.t1) + 0.25, P.GATE.t1 - 0.1], [P.GATE.s1, P.GATE.t1 - 0.1]], my);      // (walked 0.25 m out, as the forecourt)
  // hoop cycle stands (perpendicular to the wall) and the flagpole with a plain flag
  const hoop = (s, t) => { const y = fy(s, t); B.box('ironBlack', s - 0.3, y + 0.4, t, 0.05, 0.8, 0.05, 0, {}); B.box('ironBlack', s + 0.3, y + 0.4, t, 0.05, 0.8, 0.05, 0, {}); B.box('ironBlack', s, y + 0.8, t, 0.65, 0.05, 0.05, 0, {}); };
  for (let t = -5.0; t <= 6.0; t += 1.1) hoop(P.NE.s1 + 1.1, t);
  for (const t of [7.8, 8.9, 10.0, 11.1, 12.2, 13.3, 19.9, 21.0, 22.1, 23.2, 24.3]) hoop(P.LODGE.s1 + 1.0, t);
  { const yp = fy(0, AXIS - 2.6); B.cyl('whitePaint', P.LODGE.s1 + 1.1, yp, AXIS - 2.6, 0.045, 8.2, 8, true, 0.07); B.box('leadDark', P.LODGE.s1 + 1.1, yp + 7.55, AXIS - 2.6 - 0.75, 0.02, 0.85, 1.4, 0, {}); }
  // the boundary wall on Loverose Way: coursed rubble, flat coping, ramped up in a quadrant to a pier at the corner
  const LW = P.LOVEROSE, y0 = 0.6, tc = LW.t;
  const run = (a, b, h) => { B.box(RUB, (a + b) / 2, (y0 + h) / 2, tc, b - a, h - y0, LW.th, 0, {}); B.box(DR, (a + b) / 2, h + 0.06, tc, b - a + 0.04, 0.12, LW.th + 0.12, 0, { bottom: true }); st.seg(a, tc, b, tc); };
  const H = 1.3 + LW.h, rs = LW.s1 - LW.ramp - 0.8;
  run(LW.s0, rs, H); run(LW.w0, LW.w1, H);
  for (let i = 0; i < 6; i++) { const a = rs + (i * LW.ramp) / 6, b = rs + ((i + 1) * LW.ramp) / 6, f = 1 - Math.cos(((i + 0.5) / 6) * Math.PI / 2); run(a, b, H + f * (LW.pier - LW.h) * 0.85); }
  B.box(DR, LW.s1 - 0.4, (y0 + 1.3 + LW.pier) / 2, tc, 0.8, 1.3 + LW.pier - y0, 0.7, 0, {}); B.box(DR, LW.s1 - 0.4, 1.3 + LW.pier + 0.08, tc, 0.95, 0.16, 0.85, 0, { bottom: true });
  st.seg(LW.s1 - 0.8, tc, LW.s1, tc);
  B.box('leadDark', LW.s1 - 3.4, 2.8, tc - LW.th / 2 - 0.04, 0.9, 1.1, 0.06, 0, {});      // the notice board
}

// ------------------------------------------------------------------------------------------------ the stacks
function stacks(st) {
  const { B, K } = st;
  for (const c of P.STACKS) {
    const alongT = c.s < 1 && c.t > 0, w = c.big ? 1.2 : 0.85, d = c.big ? 1.7 : 1.5, hx = (alongT ? w : d) / 2, hz = (alongT ? d : w) / 2;
    K.chimney(B, DR, c.s - hx, c.s + hx, c.t - hz, c.t + hz, c.big ? 5.0 : 7.6, c.top - 0.45, { capKey: DR, pots: c.big ? 4 : 3, potH: 0.45 });
  }
}
