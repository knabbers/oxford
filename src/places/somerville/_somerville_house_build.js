// Somerville College, STANDALONE model: HOUSE (Walton House), THE HOSTEL, THE ARCHWAY TO THE QUAD AND THE TRAFFIC QUAD:
// the build functions. Called by somerville_house.js with ctx.B in the college's LOCAL frame. Every figure is a named
// constant in _somerville_house_plan.js (with its source and K / G mark). The work is done inside the part's own frame
// (P.F: s "east" along House's north face and the Hostel, y up, t "south"); P.F.ring / P.F.L convert to LOCAL for
// colliders, lamps and the draped ground (drawn last, with no frame of this part pushed).
// Helpers the kit does not have (written here, not in the kit): faces addressed by side (W / E / N / S) and position,
// an inset ring for parapets, brick / stone quoins, eared architraves, gable copings with kneelers and a finial, a wall
// with arched notches (the archway's screen), a barrel vault, a clock dial, a blank shield.
import * as P from './_somerville_house_plan.js';

let K = null, B = null, ctx = null, S = null;
const out = {};

// ------------------------------------------------------------------------------------------------ faces (inside P.F: x = s, z = t)
// a face is named by the way it looks: W (at s = c, along +t), E (at s = c, along -t), N (at t = c, along -s), S (at t = c, along +s)
const FR = { W: (c) => K.frame(c, 0, 0, 0, 1), E: (c) => K.frame(c, 0, 0, 0, -1), N: (c) => K.frame(0, 0, c, -1, 0), S: (c) => K.frame(0, 0, c, 1, 0) };
const SG = { W: 1, E: -1, N: -1, S: 1 };
/** the face's own x of a house-frame coordinate along it (t for W / E, s for N / S) */
const X = (f, a) => SG[f] * a;
/** a point of a face frame (x, z) -> house frame [s, t] */
function toHouse(f, c, x, z) { if (f === 'W') return [c - z, x]; if (f === 'E') return [c + z, -x]; if (f === 'N') return [-x, c - z]; return [x, c + z]; }
const R = (s0, s1, t0, t1) => [[s0, t0], [s1, t0], [s1, t1], [s0, t1]];
const rectF = (f, a0, a1, y0, y1) => { const x0 = X(f, a0), x1 = X(f, a1); return K.rectPts(Math.min(x0, x1), y0, Math.max(x0, x1), y1); };
/** the lowest surveyed ground under a box of the frame, less FOOT_M: where a wall's foot goes */
function footAt(s0, s1, t0, t1) {
  let lo = Infinity;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 4; j++) lo = Math.min(lo, P.F.groundY(s0 + ((s1 - s0) * i) / 8, t0 + ((t1 - t0) * j) / 4));
  return lo - P.FOOT_M;
}
/** a wall face from along a0 to a1, y0 to y1 (or a gable to `apex`), openings `ops` (pts already in face x) */
function face(f, c, a0, a1, y0, y1, key, ops = [], apex) {
  const x0 = Math.min(X(f, a0), X(f, a1)), x1 = Math.max(X(f, a0), X(f, a1));
  const outline = apex ? [[x0, y0], [x1, y0], [x1, y1], [(x0 + x1) / 2, apex], [x0, y1]] : K.rectPts(x0, y0, x1, y1);
  K.wall(B, FR[f](c), outline, ops, key);
}
/** run fn inside a face's frame; fn gets x(a) */
function on(f, c, fn) { B.push(FR[f](c)); fn((a) => X(f, a)); B.pop(); }
const sash = (f, a, w, y0, y1, o = {}) => ({ pts: rectF(f, a - w / 2, a + w / 2, y0, y1), kind: 'win', glass: o.glass || 'sash', d: o.d ?? 0.2, sill: o.sill ?? true, lights: o.lights, transoms: o.transoms, mullionW: o.mullionW });
const archWin = (f, a, w, y0, spring, o = {}) => ({ pts: K.archPts(X(f, a), w, y0, spring), kind: 'win', glass: 'archSash', spring, d: o.d ?? 0.2, sill: o.sill ?? true });
const door = (f, a, w, y0, y1, key = 'doorCream') => ({ pts: rectF(f, a - w / 2, a + w / 2, y0, y1), kind: 'door', doorKey: key, d: 0.22 });

/** a ring moved INWARDS by d (mitred corners) */
function offsetRing(ring, d) {
  const n = ring.length, lines = [];
  let ar = 0; for (let i = 0; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n]; ar += p[0] * q[1] - q[0] * p[1]; }
  const sg = ar > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const nx = (-(q[1] - p[1]) / L) * sg, nz = ((q[0] - p[0]) / L) * sg;
    lines.push({ p: [p[0] + nx * d, p[1] + nz * d], d: [(q[0] - p[0]) / L, (q[1] - p[1]) / L] });
  }
  return ring.map((_, i) => {
    const a = lines[(i + n - 1) % n], b = lines[i], den = a.d[0] * b.d[1] - a.d[1] * b.d[0];
    if (Math.abs(den) < 1e-6) return b.p;
    const k = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / den;
    return [a.p[0] + a.d[0] * k, a.p[1] + a.d[1] * k];
  });
}
/** a parapet standing just inside a wall ring (its outer face 1 cm behind the walls'), from y0 to y1, with a coping */
function innerParapet(ring, y0, y1, th, key, coping) {
  const r = offsetRing(ring, th / 2 + 0.01);
  K.parapet(B, key, [...r, r[0]], y0, y1 - y0, th, coping ? { coping } : {});
}

// ------------------------------------------------------------------------------------------------ small helpers (current wall frame: x along, y up, z out)
/** quoins at a corner x running into the face by dir (+1 / -1): alternate long and short blocks from y0 to y1 */
function quoins(x, dir, y0, y1, key = 'bathDress', o = {}) {
  const h = o.h ?? 0.3, gap = o.gap ?? 0.04, long = o.long ?? 0.75, short = o.short ?? 0.4;
  let i = 0;
  for (let y = y0; y + h <= y1 + 0.01; y += h + gap, i++) { const w = i % 2 ? short : long; B.box(key, x + (dir * w) / 2, y + h / 2, 0.03, w, h, 0.06, 0, {}); }
}
/** an eared stone architrave round an opening centred at x (w wide, y0 .. y1) */
function architrave(x, w, y0, y1, k = 0.14) {
  for (const sx of [-1, 1]) B.box('bathDress', x + sx * (w / 2 + k / 2), (y0 + y1) / 2, 0.04, k, y1 - y0, 0.08, 0, {});
  B.box('bathDress', x, y1 + k / 2, 0.04, w + 2 * k, k, 0.08, 0, { bottom: true });
  for (const sx of [-1, 1]) B.box('bathDress', x + sx * (w / 2 + k + 0.06), y1 - 0.12, 0.04, 0.12, 0.38, 0.08, 0, {});      // the ears
}
/** a cornice of two stepped courses, its top at y, from x0 to x1 */
function cornice(x0, x1, y, h, proj, key = 'bathDress') {
  K.stringCourse(B, key, x0, x1, y, h * 0.55, proj);
  K.stringCourse(B, key, x0, x1, y - h * 0.55, h * 0.45, proj * 0.5);
}
/** the copings up the rakes of a gable from (x0, yE) to the apex and down to (x1, yE), kneelers at the feet, a finial */
function gableCoping(x0, x1, yE, apex, key = 'bathDress', o = {}) {
  const xm = (x0 + x1) / 2, w = o.w ?? 0.38;
  for (const [p, q] of [[[x0, yE], [xm, apex]], [[xm, apex], [x1, yE]]]) {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    B.push(new K.THREE.Matrix4().makeRotationZ(ang).setPosition((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0));
    B.box(key, 0, 0.09, -w / 2 + 0.08, L + 0.15, 0.18, w, 0, { bottom: true });
    B.pop();
  }
  for (const x of [x0, x1]) B.box(key, x + (x === x0 ? 0.2 : -0.2), yE - 0.1, -0.1, 0.55, 0.35, 0.45, 0, {});      // kneelers
  if (o.finial !== false) { B.box(key, xm, apex + 0.3, -0.12, 0.26, 0.45, 0.26, 0, {}); B.box(key, xm, apex + 0.62, -0.12, 0.16, 0.2, 0.16, 0, {}); }
}
/** a wall lantern on an iron bracket at x, y of the current wall frame; returns the light's point in the frame */
function wallLamp(x, y) {
  B.box('ironBlack', x, y + 0.55, 0.22, 0.05, 0.05, 0.45, 0, {});
  B.box('ironBlack', x, y + 0.3, 0.04, 0.12, 0.6, 0.06, 0, {});
  return K.lantern(B, x, y, 0.45, { size: 0.3 });
}
/** a half-annulus (an arch ring) in the current wall frame: centre x, springing ys, radii r0 < r1, at z */
function archRing(key, x, ys, r0, r1, z, seg = 10, step = 0) {
  const o = [], n = seg;
  if (step > 0) for (let i = 0; i < n; i++) {      // the ring's soffit step back to the face behind it (so the rings read)
    const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI, am = (a0 + a1) / 2;
    B.poly(key, [[x + Math.cos(a0) * r0, ys + Math.sin(a0) * r0, z], [x + Math.cos(a1) * r0, ys + Math.sin(a1) * r0, z], [x + Math.cos(a1) * r0, ys + Math.sin(a1) * r0, z - step], [x + Math.cos(a0) * r0, ys + Math.sin(a0) * r0, z - step]], [-Math.cos(am), -Math.sin(am), 0]);
  }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; o.push([x + Math.cos(a) * r1, ys + Math.sin(a) * r1]); }
  for (let i = n; i >= 0; i--) { const a = (i / n) * Math.PI; o.push([x + Math.cos(a) * r0, ys + Math.sin(a) * r0]); }
  B.face(key, o, [], z);
}
/** a clock dial facing +z at (x, y) radius r */
function dial(x, y, r, z) {
  const n = 16, ring = (rr) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; });
  B.face('ironBlack', ring(r + 0.05), [ring(r)], z);
  B.face('whitePaint', ring(r), [], z + 0.005);
  for (const [a, len] of [[Math.PI * 0.4, 0.55], [Math.PI * 0.95, 0.8]]) B.beam('ironBlack', [x, y, z + 0.015], [x + Math.cos(a) * r * len, y + Math.sin(a) * r * len, z + 0.015], 0.03, 0.01);
}
/** a blank shield (no arms: house rule) centred at x, its top at y, w wide */
function shield(x, y, w, z, key = 'gold') {
  const h = w * 1.2, pts = [[x - w / 2, y], [x - w / 2, y - h * 0.55]];
  for (let i = 1; i < 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push([x - (w / 2) * Math.cos(a), y - h * 0.55 - h * 0.45 * Math.sin(a)]); }
  pts.push([x, y - h]);
  for (let i = 5; i >= 1; i--) { const a = (i / 6) * (Math.PI / 2); pts.push([x + (w / 2) * Math.cos(a), y - h * 0.55 - h * 0.45 * Math.sin(a)]); }
  pts.push([x + w / 2, y - h * 0.55], [x + w / 2, y]);
  B.face(key, pts.slice().reverse(), [], z);
}
const lampAt = (f, c, l) => { const h = toHouse(f, c, l[0], l[2]), q = P.F.L(h[0], h[1]); ctx.lamp(q[0], l[1], q[1]); };
const solid = (ring) => ctx.solid(P.F.ring(ring));

// ------------------------------------------------------------------------------------------------ THE MAIN BLOCK
function mainBlock() {
  const M = P.MAIN, { s0, s1, t0, t1 } = M, foot = footAt(s0 - 1, s1, t0, t1 + 1), Cn = M.cornice, wF = M.winF;
  // ---- the west front
  const opsW = M.front.first.map((t) => sash('W', t, wF.w, wF.sill, wF.head, { d: 0.22 }));
  const [sa, sb] = M.front.triW, tc = M.front.tri;
  for (const [t, w] of [[tc - sb / 2 - 0.15 - sa / 2, sa], [tc, sb], [tc + sb / 2 + 0.15 + sa / 2, sa]]) opsW.push(sash('W', t, w, wF.sill, wF.head, { d: 0.22, sill: false }));
  for (const t of M.front.ground) opsW.push(sash('W', t, M.winG.w, M.winG.sill, M.winG.head, { d: 0.22 }));
  face('W', s0, t0, t1, foot, M.parapet, 'rubble', opsW);
  on('W', s0, (x) => {
    K.stringCourse(B, 'bathDress', x(t0), x(t1), M.band.top, M.band.h, 0.08);
    cornice(x(t0), x(t1), Cn.top, Cn.h, Cn.proj);
    K.stringCourse(B, 'bathDress', x(t0) - 0.02, x(t1) + 0.02, M.parapet + 0.06, 0.08, 0.05);
    for (const t of M.front.first) architrave(x(t), wF.w, wF.sill, wF.head);
    architrave(x(tc), sb + 2 * (sa + 0.15), wF.sill, wF.head);
    B.box('bathDress', x(tc), wF.sill - 0.07, 0.07, sb + 2 * sa + 0.7, 0.14, 0.14, 0, { bottom: true });
    for (const t of M.front.ground) B.box('bathDress', x(t), M.winG.head + 0.16, 0.07, M.winG.w + 0.36, 0.3, 0.14, 0, { bottom: true });
    // the projecting strip under the front stack: ashlar with red-brick bands
    const st = M.strip, w = st.t1 - st.t0, xm = x((st.t0 + st.t1) / 2);
    B.box('bathDress', xm, (foot + Cn.top - Cn.h) / 2, st.proj / 2, w, Cn.top - Cn.h - foot, st.proj, 0, { bottom: false });
    for (const y of st.bricks) B.box('brick', xm, y, st.proj + 0.003, w - 0.1, 0.3, 0.01, 0, { bottom: true });
    quoins(x(t1), -1, foot + 0.5, Cn.top - Cn.h);
  });
  // ---- north, east, south faces
  face('N', t0, s0, s1, foot, M.parapet, 'rubble', M.north.flatMap((s) => [sash('N', s, 1.0, 1.9, 3.9), sash('N', s, 1.0, wF.sill, 8.4)]));
  face('E', s1, t0, t1, foot, M.parapet, 'rubble', M.east.map((t) => sash('E', t, 1.0, wF.sill, 8.4)));
  const sw = M.south;
  face('S', t1, s0, P.WING.s0, foot, M.parapet, 'rubble', [sash('S', 1.6, 1.0, 1.9, 3.9), sash('S', sw.first[0], 1.0, wF.sill, wF.head), sash('S', sw.first[1], sw.triW, wF.sill, wF.head, { lights: 3, mullionW: 0.16 })]);
  on('N', t0, (x) => { cornice(x(s1), x(s0), Cn.top, Cn.h, Cn.proj); K.stringCourse(B, 'bathDress', x(s1), x(s0), M.band.top, M.band.h, 0.08); });
  on('E', s1, (x) => { cornice(x(t1), x(t0), Cn.top, Cn.h, Cn.proj); });
  on('S', t1, (x) => {
    cornice(x(s0), x(P.WING.s0), Cn.top, Cn.h, Cn.proj); K.stringCourse(B, 'bathDress', x(s0), x(P.WING.s0), M.band.top, M.band.h, 0.08);
    quoins(x(s0), 1, foot + 0.5, Cn.top - Cn.h);
  });
  // ---- the lean-to on the south face (lead roof)
  const Ln = M.lean, fL = footAt(Ln.s0, Ln.s1, t1, Ln.t1);
  face('S', Ln.t1, Ln.s0, Ln.s1, fL, Ln.top, 'rubble', [...Ln.wins.map((s, i) => (i === 1 ? door('S', s, 1.0, M.ffl, 3.1, 'doorDark') : sash('S', s, 1.1, 1.7, 3.3)))]);
  face('W', Ln.s0, t1, Ln.t1, fL, Ln.top, 'rubble', [sash('W', (t1 + Ln.t1) / 2, 1.0, 1.7, 3.3)]);
  B.poly('lead', [[Ln.s0 - 0.1, Ln.top, Ln.t1 + 0.12], [Ln.s1, Ln.top, Ln.t1 + 0.12], [Ln.s1, Ln.top + 0.35, t1], [Ln.s0 - 0.1, Ln.top + 0.35, t1]], [0, 1, 0.3]);
  B.poly('lead', [[Ln.s0 - 0.1, Ln.top, Ln.t1 + 0.12], [Ln.s0 - 0.1, Ln.top + 0.35, t1], [Ln.s0 - 0.1, Ln.top, t1]], [-1, 0, 0]);
  solid(R(Ln.s0, Ln.s1, t1, Ln.t1));
  // ---- parapet, gutter, the slate mansard and its dormers
  const ring = R(s0, s1, t0, t1), m = M.mansard;
  innerParapet(ring, Cn.top - 0.4, M.parapet, 0.3, 'rubble');
  const o0 = offsetRing(ring, m.inset0), o1 = offsetRing(ring, m.inset1), yF = M.parapet - 0.15;
  B.flat('lead', offsetRing(ring, 0.3), yF - 0.05);
  const cx = (s0 + s1) / 2, cz = (t0 + t1) / 2;
  for (let i = 0; i < 4; i++) {
    const a = o0[i], b = o0[(i + 1) % 4], c = o1[(i + 1) % 4], d = o1[i], mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz;
    B.poly('slate', [[a[0], yF, a[1]], [b[0], yF, b[1]], [c[0], m.kerb, c[1]], [d[0], m.kerb, d[1]]], [mx, 0.5, mz]);
  }
  K.roof(B, 'slate', o1[0][0], o1[1][0], o1[0][1], o1[2][1], m.kerb, m.top - m.kerb, { axis: 'z', ends: ['hip', 'hip'], ov: 0.08 });
  const dm = M.dormer, dh = dm.head - dm.sill, dOpt = (n) => ({ roof: 'flat', key: 'whitePaint', lights: n, glass: 'sash', flatKey: 'lead', margin: 0.07 });
  for (const [a0, a1, n] of M.dormersW) K.dormer(B, FR.W(s0 + 0.45), X('W', (a0 + a1) / 2), dm.sill, a1 - a0, dh, 0.95, dOpt(n));
  for (const [a0, a1, n] of M.dormersN) K.dormer(B, FR.N(t0 + 0.45), X('N', (a0 + a1) / 2), dm.sill, a1 - a0, dh, 0.95, dOpt(n));
  for (const [a0, a1, n] of M.dormersS) K.dormer(B, FR.S(t1 - 0.45), X('S', (a0 + a1) / 2), dm.sill, a1 - a0, dh, 0.95, dOpt(n));
  for (const [a, b, c, d, top] of M.stacks) K.chimney(B, 'brick', a, b, c, d, Cn.top - 0.5, top, { pots: 2, capKey: 'bathDress' });
  solid(ring);
  return foot;
}

// ------------------------------------------------------------------------------------------------ the brick bay and the porch on the front
function bayAndPorch() {
  const Bq = P.BAY, M = P.MAIN, fB = footAt(Bq.s0, 0, Bq.t0, Bq.t1);
  const win = (f, a0, a1) => sash(f, (a0 + a1) / 2, a1 - a0, Bq.sill, Bq.head, { lights: 2, transoms: [Bq.transom], mullionW: 0.1, d: 0.16 });
  face('W', Bq.s0, Bq.t0, Bq.t1, fB, Bq.top, 'brick', [
    { pts: K.archPts(X('W', (Bq.door[0] + Bq.door[1]) / 2), Bq.door[1] - Bq.door[0], M.ffl, 2.95), kind: 'door', doorKey: 'archDoor', spring: 2.95, d: 0.2 },
    ...Bq.wins.map(([a, b]) => win('W', a, b))]);
  face('N', Bq.t0, Bq.s0, 0, fB, Bq.top, 'brick', Bq.winsN.map((s) => win('N', s - 0.6, s + 0.6)));
  face('S', Bq.t1, Bq.s0, 0, fB, Bq.top, 'brick', []);
  on('W', Bq.s0, (x) => { K.stringCourse(B, 'bathDress', x(Bq.t0), x(Bq.t1), Bq.head + 0.2, 0.2, 0.05); K.stringCourse(B, 'brickDark', x(Bq.t0), x(Bq.t1), M.ffl + 0.05, M.ffl + 0.05 - fB, 0.04); });
  on('N', Bq.t0, (x) => { K.stringCourse(B, 'bathDress', x(0), x(Bq.s0), Bq.head + 0.2, 0.2, 0.05); });
  on('S', Bq.t1, (x) => { K.stringCourse(B, 'bathDress', x(Bq.s0), x(0), Bq.head + 0.2, 0.2, 0.05); });
  const br = R(Bq.s0, 0, Bq.t0, Bq.t1);
  B.flat('lead', offsetRing(br, 0.2), Bq.top - 0.35);
  innerParapet(br, Bq.top - 0.4, Bq.top, 0.25, 'brick', 'bathDress');
  B.box('pavingSolid', Bq.s0 - 0.25, (M.ffl + fB) / 2, (Bq.door[0] + Bq.door[1]) / 2, 0.5, M.ffl - fB, 1.6, 0, {});
  solid(br);
  // ---- the stone porch: two piers, glazed doors and side lights between them, entablature, pediment, lead roof
  const Po = P.PORCH, s = -Po.proj, fP = footAt(s - 1, 0, Po.t0, Po.t1), dw = (Po.door[1] - Po.door[0]) / 4;
  face('W', s, Po.t0, Po.t1, fP, Po.cornice, 'bath', [
    sash('W', Po.door[0] + dw / 2, dw, M.ffl, Po.doorTop, { sill: false, d: 0.12 }), sash('W', (Po.door[0] + Po.door[1]) / 2, dw * 2 - 0.08, M.ffl, Po.doorTop, { sill: false, d: 0.12 }),
    sash('W', Po.door[1] - dw / 2, dw, M.ffl, Po.doorTop, { sill: false, d: 0.12 })]);
  face('N', Po.t0, s, 0, fP, Po.cornice, 'bath', []);
  face('S', Po.t1, s, 0, fP, Po.cornice, 'bath', []);
  on('W', s, (x) => {
    for (const t of [Po.t0 + 0.2, Po.t1 - 0.2]) B.box('bathDress', x(t), (fP + Po.ent) / 2, 0.06, 0.4, Po.ent - fP, 0.12, 0, {});
    K.stringCourse(B, 'bathDress', x(Po.t0) - 0.08, x(Po.t1) + 0.08, Po.cornice, Po.cornice - Po.ent, 0.14);
    const xa = x(Po.t0) - 0.12, xb = x(Po.t1) + 0.12;
    B.face('bath', [[xa, Po.cornice], [xb, Po.cornice], [(xa + xb) / 2, Po.apex]], [], 0.04);
    for (const [p, q] of [[[xa - 0.05, Po.cornice], [(xa + xb) / 2, Po.apex + 0.1]], [[(xa + xb) / 2, Po.apex + 0.1], [xb + 0.05, Po.cornice]]]) {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      B.push(new K.THREE.Matrix4().makeRotationZ(ang).setPosition((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0));
      B.box('bathDress', 0, -0.06, 0.1, L, 0.16, 0.24, 0, { bottom: true });
      B.pop();
    }
  });
  K.roof(B, 'lead', s - 0.12, 0, Po.t0 - 0.12, Po.t1 + 0.12, Po.cornice, Po.apex - Po.cornice, { axis: 'x', ends: ['open', 'open'], ov: 0 });
  B.box('pavingSolid', s - 0.3, (M.ffl - 0.02 + fP) / 2, (Po.t0 + Po.t1) / 2, 0.6, M.ffl - 0.02 - fP, Po.t1 - Po.t0 - 0.6, 0, {});
  ctx.floor(P.F.ring(R(s - 0.6, s, Po.t0 + 0.3, Po.t1 - 0.3)), M.ffl - 0.02);
  solid(R(s, 0, Po.t0, Po.t1));
}

// ------------------------------------------------------------------------------------------------ THE EAST PART with the entrance bay and the clock cupola
function eastPart() {
  const E = P.EAST, { s0, s1, t0, t1 } = E, foot = footAt(s0, s1 + 1.5, t0, t1), w = E.win;
  const col = (f, a) => [sash(f, a, w.w, w.g[0], w.g[1]), sash(f, a, w.w, w.f[0], w.f[1]), sash(f, a, w.w, w.s[0], w.s[1])];
  face('E', s1, t0, t1, foot, E.eaves, 'rubble', E.side.flatMap((t) => col('E', t)));
  face('N', t0, s0, s1, foot, E.eaves, 'rubble', [sash('N', 15.5, w.w, w.f[0], w.f[1]), sash('N', 15.5, w.w, w.s[0], w.s[1])]);
  on('E', s1, (x) => { cornice(x(t1), x(t0), E.eaves, 0.3, 0.25); for (const y of E.bands) K.stringCourse(B, 'brick', x(t1), x(t0), y, 0.25, 0.02); });
  on('N', t0, (x) => { cornice(x(s1), x(s0), E.eaves, 0.3, 0.25); });
  K.roof(B, 'clayTile', s0, s1, t0, t1, E.eaves, E.ridge - E.eaves, { axis: 'z', ends: ['hip', 'gable'], ov: 0.3, gableWalls: false });
  // ---- the entrance bay (0.3 proud), its door, balcony, window door, top window, the cross gable and the cupola
  const b = E.bay, sB = s1 + b.proj, tm = (b.t0 + b.t1) / 2, fB = footAt(s1, sB + 2, b.t0, b.t1);
  face('E', sB, b.t0, b.t1, fB, E.eaves, 'rubble', [
    { pts: K.archPts(X('E', tm), E.door.w, E.ffl, E.door.spring), kind: 'door', doorKey: 'archDoorCream', spring: E.door.spring, d: 0.3 },
    archWin('E', tm, E.door1.w, E.door1.sill, E.door1.spring, { sill: false }),
    sash('E', tm, E.win2.w, E.win2.sill, E.win2.head)], E.gable.apex);
  face('N', b.t0, s1, sB, fB, E.eaves, 'rubble'); face('S', b.t1, s1, sB, fB, E.eaves, 'rubble');
  on('E', sB, (x) => {
    for (const y of E.bands) K.stringCourse(B, 'brick', x(b.t1), x(b.t0), y, 0.25, 0.02);
    quoins(x(b.t1), 1, fB + 0.4, E.eaves - 0.3, 'brick'); quoins(x(b.t0), -1, fB + 0.4, E.eaves - 0.3, 'brick');
    // the door's rusticated stone surround and the window door's pilasters
    const r = E.door.w / 2;
    for (const sx of [-1, 1]) B.box('bathDress', x(tm) + sx * (r + 0.18), (E.ffl + E.door.spring) / 2, 0.06, 0.36, E.door.spring - E.ffl, 0.12, 0, {});
    archRing('bathDress', x(tm), E.door.spring, r, r + 0.32, 0.05);
    for (const sx of [-1, 1]) B.box('bathDress', x(tm) + sx * (E.door1.w / 2 + 0.25), (E.balcony.y + E.door1.spring + 0.7) / 2, 0.06, 0.24, E.door1.spring + 0.7 - E.balcony.y, 0.12, 0, {});
    archRing('bathDress', x(tm), E.door1.spring, E.door1.w / 2, E.door1.w / 2 + 0.16, 0.04);
    // the balcony on brackets with a balustrade
    const Bl = E.balcony, x0 = x(tm) - Bl.w / 2, x1 = x(tm) + Bl.w / 2, d = Bl.proj;
    B.box('bathDress', x(tm), Bl.y - 0.09, d / 2, Bl.w, 0.18, d, 0, { bottom: true });
    for (const sx of [-0.38, 0.38]) B.box('bathDress', x(tm) + sx * Bl.w, Bl.y - 0.45, d * 0.35, 0.22, 0.55, d * 0.7, 0, {});
    B.box('bathDress', x(tm), Bl.rail - 0.05, d - 0.08, Bl.w, 0.1, 0.16, 0, { bottom: true });
    for (const xx of [x0 + 0.08, x1 - 0.08]) { B.box('bathDress', xx, (Bl.y + Bl.rail) / 2, d / 2, 0.16, Bl.rail - Bl.y, d - 0.1, 0, {}); }
    for (let i = 1; i < 12; i++) B.cyl('bathDress', x0 + (Bl.w * i) / 12, Bl.y, d - 0.08, 0.04, Bl.rail - Bl.y - 0.1, 6, false, 0.06);
    gableCoping(x(b.t1) - 0.1, x(b.t0) + 0.1, E.eaves, E.gable.apex, 'bathDress');
    // a small round window in the gable
    const n = 14, ring = (rr) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [x(tm) + Math.cos(a) * rr, E.eaves + 0.85 + Math.sin(a) * rr]; });
    B.face('bathDress', ring(0.4), [ring(0.28)], 0.03); B.face('glassDark', ring(0.28), [], 0.02);
  });
  K.roof(B, 'clayTile', E.ridgeS, sB + 0.25, b.t0 - 0.15, b.t1 + 0.15, E.eaves, E.gable.apex - E.eaves, { axis: 'x', ends: ['open', 'open'], ov: 0.0 });
  B.box('pavingSolid', sB + 0.45, (E.ffl + fB) / 2, tm, 0.9, E.ffl - fB, E.door.w + 0.8, 0, {});
  ctx.floor(P.F.ring(R(sB, sB + 0.9, tm - E.door.w / 2 - 0.4, tm + E.door.w / 2 + 0.4)), E.ffl);
  // the cupola: a white base with clock dials, four posts, an entablature, a lead cap and a finial
  const C = E.cupola, h = C.base / 2;
  B.box('whitePaint', C.s, (C.y0 + C.y1) / 2, C.t, C.base, C.y1 - C.y0, C.base, 0, { bottom: false });
  for (const [f, c, a] of [['E', C.s + h, C.t], ['N', C.t - h, C.s], ['S', C.t + h, C.s]]) on(f, c, (x) => dial(x(a), (C.y0 + C.y1) / 2, 0.3, 0.01));
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box('whitePaint', C.s + dx * (h - 0.08), (C.y1 + C.post) / 2, C.t + dz * (h - 0.08), 0.13, C.post - C.y1, 0.13, 0, {});
  B.box('whitePaint', C.s, (C.post + C.cap) / 2, C.t, C.base + 0.12, C.cap - C.post, C.base + 0.12, 0, { bottom: true });
  K.coneRoof(B, 'lead', [[C.s - h - 0.06, C.t - h - 0.06], [C.s + h + 0.06, C.t - h - 0.06], [C.s + h + 0.06, C.t + h + 0.06], [C.s - h - 0.06, C.t + h + 0.06]], C.cap, [C.s, C.t], C.top - C.cap);
  B.cyl('ironBlack', C.s, C.top - 0.05, C.t, 0.02, 0.7, 5, true);
  B.box('ironBlack', C.s, C.top + 0.5, C.t, 0.5, 0.02, 0.02, 0.4, {});
  solid(R(s0, sB, t0, t1));
}

// ------------------------------------------------------------------------------------------------ THE NORTH-EAST BLOCK and the one-storey link
function northEast() {
  const N = P.NE, { s0, s1, t0, t1 } = N, foot = footAt(s0, s1, t0 - 1, t1), w = P.EAST.win, apex = N.ridge;
  const col = (f, a) => [sash(f, a, 1.0, w.g[0], w.g[1]), sash(f, a, 1.0, w.f[0], w.f[1]), sash(f, a, 1.0, w.s[0], w.s[1])];
  face('S', t1, P.EAST.s1, s1, foot, N.eaves, 'rubble', N.wins.flatMap((s) => col('S', s)));
  face('N', t0, s0, s1, foot, N.eaves, 'rubble', [20.5, 24.0, 27.5].flatMap((s) => [sash('N', s, 0.9, w.f[0], w.f[1]), sash('N', s, 0.9, w.s[0], w.s[1])]));
  face('E', s1, t0, t1, foot, N.eaves, 'rubble', [sash('E', (t0 + t1) / 2, 0.6, 11.6, 12.6)], apex);
  face('W', s0, t0, t1, foot, N.eaves, 'rubble', [sash('W', (t0 + t1) / 2, 0.9, w.s[0], w.s[1])], apex);
  on('S', t1, (x) => { cornice(x(P.EAST.s1), x(s1), N.eaves, 0.3, 0.25); for (const y of P.EAST.bands) K.stringCourse(B, 'brick', x(P.EAST.s1), x(s1), y, 0.25, 0.02); quoins(x(s1), -1, foot + 0.6, N.eaves - 0.3, 'brick'); });
  on('N', t0, (x) => cornice(x(s1), x(s0), N.eaves, 0.3, 0.25));
  on('E', s1, (x) => { gableCoping(x(t1) - 0.1, x(t0) + 0.1, N.eaves, apex); for (const y of P.EAST.bands) K.stringCourse(B, 'brick', x(t1), x(t0), y, 0.25, 0.02); quoins(x(t1), 1, foot + 0.6, N.eaves - 0.3, 'brick'); });
  on('W', s0, (x) => gableCoping(x(t0) + 0.1, x(t1) - 0.1, N.eaves, apex, 'bathDress', { finial: false }));
  K.roof(B, 'clayTile', s0, s1, t0, t1, N.eaves, N.ridge - N.eaves, { axis: 'x', ends: ['gable', 'gable'], ov: 0.25, gableWalls: false });
  for (const s of N.dormers) K.dormer(B, FR.S(t1 - 0.3), X('S', s), N.eaves + 0.26, 1.3, 1.25, 2.3, { key: 'rubble', roofKey: 'clayTile', lights: 2, glass: 'sash', margin: 0.12 });
  const [a, b, c, d, top] = N.stack; K.chimney(B, 'brick', a, b, c, d, N.eaves, top, { pots: 3, capKey: 'bathDress' });
  solid(R(s0, s1, t0, t1));
  // the one-storey link (brick, lead flat)
  const Lk = P.LINK, fL = footAt(Lk.s0, Lk.s1, Lk.t0 - 1, Lk.t1);
  face('N', Lk.t0, Lk.s0, Lk.s1, fL, Lk.top, 'brick', [door('N', 15.5, 1.0, P.NE.ffl, 3.2, 'doorDark'), sash('N', 17.0, 0.9, 1.9, 3.4)]);
  const lr = R(Lk.s0, Lk.s1, Lk.t0, Lk.t1);
  B.flat('lead', offsetRing(lr, 0.2), Lk.top - 0.4);
  innerParapet(lr, Lk.top - 0.45, Lk.top, 0.25, 'brick', 'bathDress');
  solid(lr);
}

// ------------------------------------------------------------------------------------------------ THE 1881 WING
function wing() {
  const W = P.WING, { s0, s1, t0, t1 } = W, foot = footAt(s0 - 1, s1 + 1, t0, t1 + 1), apex = W.ridge;
  // ---- the south face: brick, stone-dressed windows, round-headed below, a dentil band
  const ops = [];
  for (const s of W.south) {
    if (s > P.ARCH.s0 - 0.8 && s < P.ARCH.sScreen + 0.8) continue;
    ops.push({ pts: K.archPts(s, 1.05, 1.75, 3.55), kind: 'win', glass: 'archSash', spring: 3.55, d: 0.2 }, sash('S', s, 1.05, 5.0, 6.9), sash('S', s, 0.95, 8.1, 9.7));
  }
  face('S', t1, s0, s1, foot, W.eaves, 'brick', ops);
  on('S', t1, (x) => {
    cornice(x(s0), x(s1), W.eaves, 0.32, 0.28);
    K.stringCourse(B, 'brick', x(s0), x(s1), 4.75, 0.3, 0.06);
    for (let xx = x(s0) + 0.15; xx < x(s1); xx += 0.3) B.box('brick', xx, 4.38, 0.09, 0.12, 0.09, 0.06, 0, { bottom: true });
    for (const s of W.south) {
      if (s > P.ARCH.s0 - 0.8 && s < P.ARCH.sScreen + 0.8) continue;
      for (const [y0, y1] of [[1.75, 4.1], [5.0, 6.9]]) for (const sx of [-1, 1]) quoins(s + sx * 0.54, sx, y0, y1, 'bathDress', { long: 0.34, short: 0.2, h: 0.24, gap: 0.08 });
      archRing('brickWarm', s, 3.55, 0.525, 0.75, 0.02, 8);
    }
    quoins(x(s1), -1, foot + 0.5, W.eaves - 0.35, 'bathDress');
  });
  face('N', t0, P.EAST.s1, s1, foot, W.eaves, 'rubble', W.north.flatMap((s) => [sash('N', s, 1.0, 1.9, 3.7), sash('N', s, 1.0, 5.0, 6.9), sash('N', s, 0.95, 8.1, 9.7)]));
  on('N', t0, (x) => { cornice(x(s1), x(P.EAST.s1), W.eaves, 0.32, 0.28); for (const y of W.bands) K.stringCourse(B, 'brick', x(s1), x(P.EAST.s1), y, 0.25, 0.02); });
  // ---- the east gable (to the Traffic Quad): stone with red-brick quoins and bands
  const ew = W.eastWins, eo = [ew.g, ew.g2, ew.f, ew.s, ew.gable].map(([t, w, a, b]) => sash('E', t, w, a, b));
  face('E', s1, t0, t1, foot, W.eaves, 'rubble', eo, apex);
  on('E', s1, (x) => {
    for (const y of W.bands) K.stringCourse(B, 'brick', x(t1), x(t0), y, 0.25, 0.02);
    quoins(x(t1), 1, foot + 0.5, W.eaves - 0.3, 'brick'); quoins(x(t0), -1, foot + 0.5, W.eaves - 0.3, 'brick');
    const [t, w2, a, b] = ew.g; for (const sx of [-1, 1]) B.box('brick', x(t) + sx * (w2 / 2 + 0.14), (a + b) / 2, 0.02, 0.28, b - a, 0.04, 0, {}); B.box('brick', x(t), b + 0.15, 0.02, w2 + 0.56, 0.3, 0.04, 0, {});
    gableCoping(x(t1) - 0.1, x(t0) + 0.1, W.eaves, apex);
  });
  // ---- the west gable with its two-storey canted bay
  const wb = W.westBay, bpts = [[s0, wb.t - wb.w / 2 - wb.proj], [s0 - wb.proj, wb.t - wb.w / 2], [s0 - wb.proj, wb.t + wb.w / 2], [s0, wb.t + wb.w / 2 + wb.proj]];
  face('W', s0, t0, t1, foot, W.eaves, 'rubble', [sash('W', wb.t - 1.1, 0.75, 8.6, 10.0), sash('W', wb.t + 1.1, 0.75, 8.6, 10.0), sash('W', wb.t, 0.4, 12.0, 12.7)], apex);
  on('W', s0, (x) => {
    for (const y of W.bands) K.stringCourse(B, 'brick', x(t0), x(t1), y, 0.25, 0.02);
    quoins(x(t0), 1, foot + 0.5, W.eaves - 0.3, 'brick'); quoins(x(t1), -1, foot + 0.5, W.eaves - 0.3, 'brick');
    gableCoping(x(t0) + 0.1, x(t1) - 0.1, W.eaves, apex);
  });
  for (let i = 0; i < 3; i++) {
    const a = bpts[i], b = bpts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), Fm = K.frame(a[0], 0, a[1], (b[0] - a[0]) / L, (b[1] - a[1]) / L), ww = i === 1 ? 1.2 : 0.55;
    K.wall(B, Fm, K.rectPts(0, foot, L, wb.top), [{ pts: K.rectPts(L / 2 - ww / 2, 1.8, L / 2 + ww / 2, 3.9), kind: 'win', glass: 'sash', d: 0.18 }, { pts: K.rectPts(L / 2 - ww / 2, 5.0, L / 2 + ww / 2, 6.9), kind: 'win', glass: 'sash', d: 0.18 }], 'rubble');
    B.push(Fm); K.stringCourse(B, 'bathDress', 0, L, wb.top, 0.25, 0.12); K.stringCourse(B, 'brick', 0, L, 4.6, 0.25, 0.02); B.pop();
  }
  K.coneRoof(B, 'lead', [...bpts], wb.top, [s0 + 0.1, wb.t], 0.6);
  K.roof(B, 'clayTile', s0, s1, t0, t1, W.eaves, W.ridge - W.eaves, { axis: 'x', ends: ['gable', 'gable'], ov: 0.3, gableWalls: false });
  for (const [a, b, c, d, top] of W.stacks) K.chimney(B, 'brick', a, b, c, d, W.eaves, top, { pots: 3, capKey: 'bathDress' });
  solid(R(s0, s1, t0, t1)); solid(bpts);
}

// ------------------------------------------------------------------------------------------------ THE ARCHWAY
/** a wall outline from x0 to x1 (y0 .. y1) whose bottom has round-arched notches [[xc, w, spring], ...] (CCW) */
function notched(x0, x1, y0, y1, arches) {
  const o = [[x0, y0]];
  for (const [xc, w, ys] of arches.slice().sort((a, b) => a[0] - b[0])) {
    const r = w / 2; o.push([xc - r, y0], [xc - r, ys]);
    for (let i = 1; i < 12; i++) { const a = Math.PI - (i / 12) * Math.PI; o.push([xc + Math.cos(a) * r, ys + Math.sin(a) * r]); }
    o.push([xc + r, ys], [xc + r, y0]);
  }
  o.push([x1, y0], [x1, y1], [x0, y1]);
  return o;
}
function archway() {
  const A = P.ARCH, yp = P.F.groundY((A.s0 + A.sScreen) / 2, (A.t0 + A.tK) / 2), foot = footAt(A.s0, A.sScreen, A.t0, A.tK);
  // the screen's divisions (t)
  const tN = A.t0 + A.jamb, tNS = tN + A.side, tPm = tNS + A.pier, tPs = tPm + A.mid, tSS = tPs + A.pier, tS = tSS + A.side;
  const mid = (tPm + tPs) / 2, rM = A.mid / 2, rS = A.side / 2, sideC = [(tN + tNS) / 2, (tSS + tS) / 2];
  const ySp = yp + A.spring, ySs = yp + A.sideSpring;
  // three rubbed-brick rings, each stepped forward of the one inside it, with pale joints between them
  const rings = (xc, ys, r, seg) => {
    for (let k = 0; k < 3; k++) {
      const z = 0.03 + (2 - k) * 0.06;
      archRing('brickWarm', xc, ys, r + k * 0.2 + (k ? 0.012 : 0), r + (k + 1) * 0.2 - 0.012, z, seg, 0.06);
      archRing('brickBuff', xc, ys, r + (k + 1) * 0.2 - 0.012, r + (k + 1) * 0.2 + 0.012, z - 0.004, seg);
    }
  };
  // ---- the east screen (s = sScreen, facing the Traffic Quad)
  B.push(FR.E(A.sScreen));
  const x = (t) => X('E', t);
  B.face('brick', notched(x(A.tK), x(A.t0), foot, A.top, [[x(mid), A.mid, ySp], ...sideC.map((t) => [x(t), A.side, ySs])]), [], 0);
  for (const t of sideC) {
    const pts = K.archPts(x(t), A.side, yp - 0.05, ySs);
    B.reveal('plaster', pts, 0, -A.recess, true);
    const dw = A.side - 0.12;
    B.face('plaster', pts, [K.rectPts(x(t) - dw / 2, yp, x(t) + dw / 2, yp + 2.0)], -A.recess);
    B.unit('doorCream', K.rectPts(x(t) - dw / 2, yp, x(t) + dw / 2, yp + 2.0), -A.recess + 0.01, K.nextBay(0));
    rings(x(t), ySs, rS, 8);
  }
  rings(x(mid), ySp, rM, 12);
  // piers' stone bases and impost bands, the key, the arms panel, the coping
  for (const [a, b] of [[tN - A.jamb, tN], [tNS, tPm], [tPs, tSS], [tS, tS + A.jamb]]) {
    B.box('bathDress', (x(a) + x(b)) / 2, (yp + 0.3 + foot) / 2, 0.04, Math.abs(x(b) - x(a)), 0.3 + (yp - foot), 0.08, 0, {});
    B.box('brickWarm', (x(a) + x(b)) / 2, ySp, 0.05, Math.abs(x(b) - x(a)) + 0.06, 0.12, 0.1, 0, { bottom: true });
  }
  const Ky = A.key;
  B.face('brickNew', [[x(mid) - Ky.w0 / 2, yp + Ky.y0], [x(mid) + Ky.w0 / 2, yp + Ky.y0], [x(mid) + Ky.w1 / 2, yp + Ky.y1], [x(mid) - Ky.w1 / 2, yp + Ky.y1]], [], 0.14);
  B.box('brickWarm', x(mid), yp + Ky.y1 + 0.06, 0.06, Ky.w1 + 0.12, 0.12, 0.12, 0, {});
  const Pn = A.panel, py0 = yp + Pn.y0, py1 = yp + Pn.y1;
  B.box('bathDress', x(mid), (py0 + py1) / 2, 0.04, Pn.w + 0.24, py1 - py0 + 0.24, 0.08, 0, {});
  B.face('whitePaint', K.rectPts(x(mid) - Pn.w / 2, py0, x(mid) + Pn.w / 2, py1), [], 0.085);
  const cart = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; cart.push([x(mid) + Math.cos(a) * Pn.w * 0.42, (py0 + py1) / 2 + Math.sin(a) * (py1 - py0) * 0.44]); }
  B.face('bathDress', cart, [], 0.09);
  shield(x(mid), (py0 + py1) / 2 + (py1 - py0) * 0.3, Pn.w * 0.5, 0.1);
  B.pop();
  B.box('brickDark', (A.s1 + A.sScreen) / 2 + 0.03, A.top + A.coping / 2, (A.t0 + A.tK) / 2, A.sScreen - A.s1 + 0.12, A.coping, A.tK - A.t0, 0, { bottom: true });
    // ---- the north part of the block (s0 .. s1, t0 .. t1): roof, parapet; its west face across the whole block
  B.flat('lead', R(A.s0 + 0.3, A.s1, A.t0, A.t1), A.roof);
  K.parapet(B, 'brickWarm', [[A.s0 + 0.16, A.t0], [A.s0 + 0.16, A.t1]], A.roof, A.top - A.roof, 0.3, { coping: 'brickDark' });
  const sW = A.s0 - 0.18;      // (proud of the hall part's box face, whose sills stand 0.14 out)
  B.push(FR.W(sW));
  const wq = K.rectPts(mid - 0.55, yp + 4.4, mid + 0.55, yp + 6.25);
  B.face('brickWarm', notched(A.t0, A.tK, foot, A.top, [[mid, A.mid, ySp]]), [wq], 0);
  archRing('brickWarm', mid, ySp, rM, rM + 0.35, 0.03, 12);
  B.reveal('brickWarm', wq, 0, -0.2); B.unit('sash', wq, -0.18, K.nextBay(5));
  B.box('bathDress', mid, yp + 4.33, 0.06, 1.3, 0.12, 0.14, 0, { bottom: true });
  B.pop();
  // ---- the passage: plastered walls and barrel vault from the west face to the screen
  const s0 = sW, s1 = A.sScreen, n = 10;
  B.poly('plaster', [[s0, yp - 0.1, tPm], [s1, yp - 0.1, tPm], [s1, ySp, tPm], [s0, ySp, tPm]], [0, 0, 1]);
  B.poly('plaster', [[s1, yp - 0.1, tPs], [s0, yp - 0.1, tPs], [s0, ySp, tPs], [s1, ySp, tPs]], [0, 0, -1]);
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI - (i / n) * Math.PI, a1 = Math.PI - ((i + 1) / n) * Math.PI;
    const p = (a) => [mid + Math.cos(a) * rM, ySp + Math.sin(a) * rM];
    const q0 = p(a0), q1 = p(a1), am = (a0 + a1) / 2;
    B.poly('plaster', [[s0, q0[1], q0[0]], [s1, q0[1], q0[0]], [s1, q1[1], q1[0]], [s0, q1[1], q1[0]]], [0, -Math.sin(am), -Math.cos(am)]);
  }
  out.archFloor = yp;
  solid(R(sW, A.sScreen, A.t0, tPm)); solid(R(sW, A.sScreen, tPs, A.tK));
  return { yp, tPm, tPs, sW };
}

// ------------------------------------------------------------------------------------------------ THE HOSTEL
function hostel() {
  const H = P.HOSTEL, { s0, s1, t0, t1 } = H, foot = footAt(s0, s1, t0 - 1, t1 + 1), O = H.open;
  const up = H.bays.flatMap((s) => [sash('S', s, H.winW, H.winF[0], H.winF[1]), sash('S', s, H.winW, H.winS[0], H.winS[1])]);
  // the south face above the open ground floor; below it the solid east bay and the west end
  face('S', t1, s0, s1, O.ceil, H.parapet, 'brick', up);
  face('S', t1, O.s1, s1, foot, O.ceil + 0.001, 'brick', [door('S', H.door, 1.0, H.ffl, 3.25, 'doorCream')]);
  face('S', t1, s0, O.s0, foot, O.ceil + 0.001, 'brick', []);
  for (let k = 1; k < H.bays.length - 1; k++) {      // square brick piers between the bays of the open ground floor
    const s = (H.bays[k - 1] + H.bays[k]) / 2;
    B.box('brick', s, (foot + O.ceil) / 2, t1 - 0.25, 0.5, O.ceil - foot, 0.5, 0, { top: false });
    ctx.solid(P.F.ring(R(s - 0.25, s + 0.25, t1 - 0.5, t1)));
  }
  face('S', O.back, O.s0, O.s1, foot, O.ceil, 'brick', [door('S', 33.5, 1.0, H.ffl, 3.1, 'doorDark'), door('S', 39.0, 1.0, H.ffl, 3.1, 'doorDark'), sash('S', 31.0, 1.1, 1.5, 3.0), sash('S', 36.3, 1.1, 1.5, 3.0), sash('S', 41.4, 1.1, 1.5, 3.0)]);
  face('E', O.s0, O.back, t1, foot, O.ceil, 'brick'); face('W', O.s1, O.back, t1, foot, O.ceil, 'brick');
  B.flat('concrete', R(O.s0, O.s1, O.back, t1), O.ceil, [], true);
  on('S', t1, (x) => {
    K.stringCourse(B, 'brick', x(s0), x(s1), H.band.top, 0.16, 0.14);
    K.stringCourse(B, 'brick', x(s0), x(s1), H.band.top - 0.16, 0.1, 0.07);
    for (let xx = x(s0) + 0.2; xx < x(s1); xx += 0.36) B.box('brick', xx, H.band.top - 0.31, 0.1, 0.16, 0.12, 0.12, 0, { bottom: true });
    K.stringCourse(B, 'bathDress', x(s0), x(s1), H.parapet + 0.06, 0.08, 0.05);
  });
  face('N', t0, s0, s1, foot, H.parapet, 'brick');
  face('E', s1, t0, t1, foot, H.parapet, 'brick');
  const r = R(s0, s1, t0, t1);
  B.flat('precast', offsetRing(r, 0.2), H.roof);
  innerParapet(r, H.roof - 0.05, H.parapet, 0.25, 'brick', 'bathDress');
  solid(R(s0, s1, t0, O.back)); solid(R(O.s1, s1, O.back, t1));
  ctx.solid(P.F.ring(R(s0, O.s0, O.back, t1)));
  // ---- the older range east of it
  const Q = P.OLD, fQ = footAt(Q.s0, Q.dar, Q.t0 - 1, Q.t1 + 1), G = Q.gable;
  const col = (s, w, three) => [sash('S', s, w, 1.8, 3.5), sash('S', s, w, 4.6, 6.3), ...(three ? [sash('S', s, w, 7.1, 8.6)] : [])];
  face('S', Q.t1, Q.s0, G.s0, fQ, Q.eaves, 'rubble', col(Q.wins[0], 0.95, true));
  face('S', Q.t1, G.s1, Q.dar + 0.3, fQ, Q.eaves, 'rubble');
  const tg = Q.t1 + 0.15, gm = (G.s0 + G.s1) / 2;
  face('S', tg, G.s0, G.s1, fQ, Q.eaves, 'rubble', [...Q.wins.slice(1).flatMap((s) => col(s, 0.7, false)), { pts: K.archPts(gm, 1.5, Q.eaves - 0.2, Q.eaves + 0.6), kind: 'win', glass: 'archSash', spring: Q.eaves + 0.6, lights: 3, d: 0.2 }], G.apex);
  face('W', G.s0, Q.t1, tg, fQ, Q.eaves, 'rubble'); face('E', G.s1, Q.t1, tg, fQ, Q.eaves, 'rubble');
  on('S', Q.t1, (x) => { cornice(x(Q.s0), x(G.s0), Q.eaves, 0.28, 0.22); for (const y of [4.25, 6.95]) K.stringCourse(B, 'brick', x(Q.s0), x(G.s0), y, 0.22, 0.02); });
  on('S', tg, (x) => {
    for (const y of [4.25, 6.95]) K.stringCourse(B, 'brick', x(G.s0), x(G.s1), y, 0.22, 0.02);
    quoins(x(G.s0), 1, fQ + 0.5, Q.eaves - 0.3, 'brick'); quoins(x(G.s1), -1, fQ + 0.5, Q.eaves - 0.3, 'brick');
    gableCoping(x(G.s0) - 0.05, x(G.s1) + 0.05, Q.eaves, G.apex);
    for (const s of Q.wins.slice(1)) B.box('ironBlack', s, 4.95, 0.12, 0.9, 0.04, 0.04, 0, {}), B.box('ironBlack', s, 4.62, 0.12, 0.9, 0.04, 0.04, 0, {});
  });
  face('N', Q.t0, Q.s0, Q.s1, fQ, Q.north, 'brick');
  on('N', Q.t0, (x) => K.stringCourse(B, 'bathDress', x(Q.s1), x(Q.s0), Q.north + 0.06, 0.08, 0.05));
  face('E', Q.s1, Q.t0, Q.darN[0], fQ, Q.north, 'brick');
  K.roof(B, 'clayTile', Q.s0, Q.s1, Q.t0 + 0.2, Q.t1, Q.eaves, Q.ridge - Q.eaves, { axis: 'x', ends: ['gable', 'gable'], ov: 0.2, wallKey: 'brick' });
  K.roof(B, 'clayTile', G.s0 - 0.1, G.s1 + 0.1, 4.2, tg + 0.2, Q.eaves, G.apex - Q.eaves, { axis: 'z', ends: ['open', 'open'], ov: 0.15 });
  for (const [a, b, c, d, top] of Q.stacks) K.chimney(B, 'brick', a, b, c, d, d > Q.t1 ? fQ : Q.eaves - 1.5, top, { pots: 4, capKey: 'bathDress' });
  solid(R(Q.s0, Q.s1, Q.t0, Q.t1));
}

// ------------------------------------------------------------------------------------------------ lanterns
function lanterns() {
  for (const [f, c, a, y] of P.LAMPS) { B.push(FR[f](c)); const l = wallLamp(X(f, a), y); B.pop(); lampAt(f, c, l); }
}

// ------------------------------------------------------------------------------------------------ the ground (LOCAL rings, no frame of this part pushed)
function ground(arch) {
  const G = ctx.G, dy = P.DY;
  G.drape(B, 'asphalt', P.TQ, dy);
  G.drape(B, 'asphalt', P.F.ring(P.DRIVE_W), dy);
  G.drape(B, 'asphalt', P.F.ring(R(arch.sW - 0.02, P.ARCH.sScreen + 0.02, arch.tPm, arch.tPs)), dy);
  const O = P.HOSTEL.open;
  G.drape(B, 'paving', P.F.ring(R(O.s0, O.s1, O.back, P.HOSTEL.t1)), dy);
  // flags along the House's Traffic Quad faces and in front of the arch's side doors (photographs)
  G.drape(B, 'paving', P.F.ring(R(P.EAST.s1 + P.EAST.bay.proj, P.EAST.s1 + 2.0, P.NE.t1, P.WING.t0)), dy + 0.01);
  G.drape(B, 'paving', P.F.ring(R(P.ARCH.sScreen, P.ARCH.sScreen + 1.4, P.ARCH.t0, P.ARCH.tK)), dy + 0.01);
}

// ------------------------------------------------------------------------------------------------ the part
export function buildHouse(c) {
  ctx = c; B = c.B; K = c.K; S = c.S; void S;
  K.addCell(c.pack, 'doorCream', 'doorOak', 0xe2d8b8);
  K.addCell(c.pack, 'archDoorCream', 'archDoorOak', 0xe2d8b8);
  const n = () => B.tris();
  B.push(P.F.M);
  let t = n(); mainBlock(); out.main = Math.round(n() - t);
  t = n(); bayAndPorch(); out.bayPorch = Math.round(n() - t);
  t = n(); eastPart(); out.east = Math.round(n() - t);
  t = n(); northEast(); out.northEast = Math.round(n() - t);
  t = n(); wing(); out.wing = Math.round(n() - t);
  t = n(); const arch = archway(); out.archway = Math.round(n() - t);
  t = n(); hostel(); out.hostel = Math.round(n() - t);
  t = n(); lanterns(); out.lanterns = Math.round(n() - t);
  B.pop();
  t = n(); ground(arch); out.ground = Math.round(n() - t);
  return out;
}
