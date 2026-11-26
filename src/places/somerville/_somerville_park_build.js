// Somerville College, STANDALONE model: PARK's build functions (H. W. Moore, 1885 - 95), with the Walton Street gate,
// West (Park) Lodge, the boundary wall south to Wolfson and St Paul's Nursery. Called by somerville_park.js with ctx.B
// in the college's LOCAL frame. Every figure is a named constant in _somerville_park_plan.js (with its source and
// K / G mark). The work is done inside Park's own frame (P.F: s east along the main range's south wall line, y up,
// t south towards Park Lawn); P.F.ring / P.F.L convert to LOCAL for colliders, floors, lamps and the draped ground.
// Helpers the kit does not have (written here, not in the kit): a stone surround, a band along a polyline in a wall
// frame (gauged brick arches, arch rings), gable copings with kneelers and finials, the canted bay / oriel (with a
// stepped corbel and a hipped or lead top), the segmental bow, a gabled wall outline, a light iron railing and gates.
import * as P from './_somerville_park_plan.js';

let K = null, B = null, ctx = null, S = null, G = null, drapes = [];
/** ground laid on the survey (LOCAL ring): drawn after the frame is popped */
const drape = (key, ring, dy, o) => drapes.push([key, ring, dy, o]);
const F = P.F;
const BR = 'brickWarm', DR = 'bathDress', TILE = 'clayTile';

// ------------------------------------------------------------------------------------------------ frames (inside P.F)
const SF = (t) => K.frame(0, 0, t, 1, 0);      // a face looking SOUTH at t: x = s
const NF = (t) => K.frame(0, 0, t, -1, 0);     // looking NORTH at t: x = -s
const EF = (s) => K.frame(s, 0, 0, 0, -1);     // looking EAST at s: x = -t
const WF = (s) => K.frame(s, 0, 0, 0, 1);      // looking WEST at s: x = t
const R4 = (s0, s1, t0, t1) => [[s0, t0], [s1, t0], [s1, t1], [s0, t1]];
const gy = (s, t) => F.groundY(s, t);
/** the lowest surveyed ground under a box of the frame, less a margin: where a wall's foot goes */
function footAt(s0, s1, t0, t1, m = 0.6) {
  let lo = Infinity;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 2; j++) lo = Math.min(lo, gy(s0 + ((s1 - s0) * i) / 8, t0 + ((t1 - t0) * j) / 2));
  return lo - m;
}
// the roofs' pitches (rise a metre run)
const KW = (P.RIDGE - P.EAVES) / (P.S_RW - P.S_W);                 // west wing
const TR = (P.T_N1 + P.T_S) / 2, KP = (P.RIDGE - P.EAVES) / (P.T_S - TR);   // south pile: ridge line t, pitch
const SER = (P.S_EW0 + P.S_EW1) / 2, KE = (P.RIDGE - P.EAVES) / (P.S_EW1 - SER);   // east wing
const TRN = (P.T_N1 + P.T_N2) / 2, KN = (P.NRIDGE - P.EAVES) / (P.T_N1 - TRN);  // north pile

// ------------------------------------------------------------------------------------------------ small helpers (current wall frame: x along, y up, z out)
const circ = (x, y, r, n = 12) => Array.from({ length: n }, (_, i) => [x + r * Math.cos((i / n) * 2 * Math.PI), y + r * Math.sin((i / n) * 2 * Math.PI)]);
/** a rectangular stone-mullioned window op */
const rw = (x, w, sill, head, n, o = {}) => ({ pts: K.rectPts(x - w / 2, sill, x + w / 2, head), kind: 'win', lights: n, glass: o.glass || 'sash', d: o.d ?? 0.2, sill: false, mullionW: 0.11, transoms: o.tr });
/** a segmental-headed window op (gauged brick arch drawn separately), stone sill */
const sw = (x, w, sill, spring, rise, n, o = {}) => ({ pts: K.segPts(x, w, sill, spring, rise, 8), kind: 'win', lights: n, glass: o.glass || 'sash', d: 0.22, sillKey: DR, mullionW: 0.11 });
/** an oculus op */
const ocu = (x, y, r) => ({ pts: circ(x, y, r), kind: 'win', glass: 'glassDark', d: 0.16, sill: false });
/** a stone surround (jambs, lintel, sill) round x +- w/2, y0..y1 */
function surround(x, w, y0, y1, a = 0.14, p = 0.06) {
  for (const sx of [-1, 1]) B.box(DR, x + sx * (w / 2 + a / 2), (y0 + y1) / 2, p / 2, a, y1 - y0, p, 0, { top: false });
  B.box(DR, x, y1 + 0.1, p / 2 + 0.01, w + 2 * a, 0.2, p + 0.02, 0, { bottom: true });
  B.box(DR, x, y0 - 0.07, p / 2 + 0.03, w + 2 * a + 0.1, 0.14, p + 0.06, 0, { bottom: true });
}
/** a band of thickness h laid along a polyline pts [[x, y], ...] in the current wall frame, from z0 (front) back to z1 */
function bandPoly(key, pts, h, z0, z1) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], A = [a[0], a[1] + h], Bt = [b[0], b[1] + h];
    B.poly(key, [[A[0], A[1], z0], [Bt[0], Bt[1], z0], [Bt[0], Bt[1], z1], [A[0], A[1], z1]], [-(b[1] - a[1]), Math.abs(b[0] - a[0]) + 1e-3, 0]);
    B.poly(key, [[a[0], a[1], z0], [b[0], b[1], z0], [Bt[0], Bt[1], z0], [A[0], A[1], z0]], [0, 0, 1]);
  }
}
/** a stone ring round a semicircular arch (centre xc, springing yc, radius r), h deep radially, from z0 back to z1 */
function arcRing(xc, yc, r, h, z0, z1, n = 12) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const p = (c, s, rr, z) => [xc + c * rr, yc + s * rr, z];
    B.poly(DR, [p(c0, s0, r, z0), p(c1, s1, r, z0), p(c1, s1, r + h, z0), p(c0, s0, r + h, z0)], [0, 0, 1]);
    B.poly(DR, [p(c0, s0, r + h, z0), p(c1, s1, r + h, z0), p(c1, s1, r + h, z1), p(c0, s0, r + h, z1)], [(c0 + c1) / 2, (s0 + s1) / 2, 0]);
  }
}
/** the head curve of K.segPts (x +- w/2 at the springing, rising `rise`), n + 1 points from left to right */
const segCurve = (x, w, ys, rise, n = 8) => Array.from({ length: n + 1 }, (_, i) => [x - w / 2 + (w * i) / n, ys + rise * Math.sin((i / n) * Math.PI)]);
/** a gauged red-brick segmental arch over a segmental opening */
function brickArch(x, w, spring, rise) { bandPoly('brick', segCurve(x, w + 0.2, spring - 0.02, rise + 0.04), 0.3, 0.035, -0.06); }
/** a stone string course */
const band = (x0, x1, y, h = P.BAND_H, proj = 0.06) => K.stringCourse(B, DR, x0, x1, y, h, proj);
/** the plinth: a darker brick base from the foot to PLINTH_TOP */
const plinth = (x0, x1, foot) => K.stringCourse(B, 'brickDark', x0, x1, P.PLINTH_TOP, P.PLINTH_TOP - foot, 0.05);
/** a stone coping along a gable's rake from a to b ([x, y] in the wall plane) */
function rake(a, b, h = 0.2, zf = 0.08, zb = -0.32) {
  B.poly(DR, [[a[0], a[1] - 0.05, zf], [b[0], b[1] - 0.05, zf], [b[0], b[1] + h, zf], [a[0], a[1] + h, zf]], [0, 0, 1]);
  B.poly(DR, [[a[0], a[1] + h, zf], [b[0], b[1] + h, zf], [b[0], b[1] + h, zb], [a[0], a[1] + h, zb]], [0, 1, 0]);
}
/** a straight stone-coped gable's trim: copings, kneelers at the feet, a finial at the apex */
function gableTrim(x0, x1, E, apex, o = {}) {
  const xm = (x0 + x1) / 2;
  rake([x0 - 0.12, E], [xm, apex]); rake([xm, apex], [x1 + 0.12, E]);
  if (o.kneelers !== false) for (const x of [x0, x1]) B.box(DR, x, E + 0.12, -0.05, 0.42, 0.3, 0.5, 0, { bottom: true });
  if (o.finial !== false) K.pinnacle(B, DR, xm, -0.02, apex + 0.12, apex + 0.55, 0.2, 0.3);
}
/** a wall outline from x0 to x1 (foot .. eaves E) with straight gables rising from the eaves: gables [{ x0, x1, apex }] */
function gabled(x0, x1, foot, E, gables) {
  const out = [[x0, foot], [x1, foot], [x1, E]];
  for (const g of gables.slice().sort((a, b) => b.x0 - a.x0)) {
    out.push([g.x1, E]); out.push([(g.x0 + g.x1) / 2, g.apex]); out.push([g.x0, E]);
  }
  out.push([x0, E]);
  return out.filter((p, i) => { const q = out[(i + out.length - 1) % out.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4; });
}
/**
 * A canted bay / oriel in the current wall frame centred at x: back and front widths, projection, from `base` to `top`,
 * the glass from base + sill to top - head. o.corbel: a stepped stone corbel down to that level; o.roof: 'tile' (a little
 * hipped tile roof to o.roofTop) | 'lead' (a lead hipped top) ; o.lights on the front face; o.key the panels.
 */
function canted(x, o) {
  const hb = o.back / 2, hf = o.front / 2, p = o.proj, key = o.key || DR, sill = o.sill ?? 0.3, head = o.head ?? 0.2;
  const pl = [[x - hb, 0], [x - hf, p], [x + hf, p], [x + hb, 0]];
  const faces = [[pl[0], pl[1], 1], [pl[1], pl[2], o.lights || 2], [pl[2], pl[3], 1]];
  for (const [a, b, n] of faces) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const ops = [{ pts: K.rectPts(0.1, o.base + sill, L - 0.1, o.top - head), kind: 'win', lights: n, glass: o.glass || 'sash', d: 0.07, sill: false, mullionW: 0.1, transoms: o.transom ? [o.transom] : undefined }];
    if (o.mid) ops.push({ pts: K.rectPts(0.1, o.mid + 0.3, L - 0.1, o.top - head), kind: 'win', lights: n, glass: o.glass || 'sash', d: 0.07, sill: false, mullionW: 0.1 }), ops[0].pts = K.rectPts(0.1, o.base + sill, L - 0.1, o.mid - 0.15);
    K.wall(B, K.frame(a[0], 0, a[1], dx, dz), K.rectPts(0, o.base, L, o.top), ops, key);
  }
  if (o.mid) K.parapet(B, DR, pl, o.mid - 0.05, 0.2, 0.08);
  if (o.corbel != null) {      // a stepped corbel: the base slab and three courses shrinking to the wall
    const sc = (f) => pl.map(([px, pz]) => [x + (px - x) * f, pz * f]);
    K.prism(B, DR, sc(1.0), o.base - 0.22, o.base, { bottom: true });
    const n = 3, dy = (o.base - 0.22 - o.corbel) / n;
    for (let i = 0; i < n; i++) K.prism(B, DR, sc(0.85 - 0.22 * i), o.base - 0.22 - dy * (i + 1), o.base - 0.22 - dy * i, { bottom: true });
  }
  const y1 = o.top, yt = o.roofTop, ov = 0.12, rk = o.roof === 'tile' ? TILE : 'lead';
  K.prism(B, DR, pl, y1, y1 + 0.12);
  const FL = [x - hf - ov * 0.5, y1 + 0.1, p + ov], FR = [x + hf + ov * 0.5, y1 + 0.1, p + ov], BL = [x - hb - ov, y1 + 0.1, 0], BRr = [x + hb + ov, y1 + 0.1, 0];
  const TL = [x - hf * 0.5, yt, 0], TRr = [x + hf * 0.5, yt, 0];
  B.poly(rk, [FL, FR, TRr, TL], [0, 1, 1]); B.poly(rk, [BL, FL, TL], [-1, 1, 0.3]); B.poly(rk, [FR, BRr, TRr], [1, 1, 0.3]);
}
/** a light iron railing along x0..x1 at z in the current frame, from y0, h high, bars every `gap` */
function railing(x0, x1, z, y0, h, gap = 0.14) {
  B.box('ironBlack', (x0 + x1) / 2, y0 + h - 0.02, z, x1 - x0, 0.04, 0.04, 0, { bottom: true });
  B.box('ironBlack', (x0 + x1) / 2, y0 + 0.12, z, x1 - x0, 0.04, 0.04, 0, { bottom: true });
  const n = Math.max(1, Math.round((x1 - x0) / gap));
  for (let i = 0; i <= n; i++) B.box('ironBlack', x0 + ((x1 - x0) * i) / n, y0 + h / 2, z, 0.022, h, 0.022, 0, { top: false });
}

// ------------------------------------------------------------------------------------------------ PARK: the faces
/** the main range's south (Park Lawn) front from the west wing to the east wing */
function southFace() {
  const x0 = P.S_WE, x1 = P.SE.s0, T = P.T_S, E = P.EAVES, foot = footAt(x0, x1, T, T + 2.5);
  const gables = P.SOUTH_GABLES.map((g) => ({ x0: g - P.GABLE_W / 2, x1: g + P.GABLE_W / 2, apex: P.GABLE_APEX }));
  const W0 = P.WIN0, W1 = P.WIN1, W2 = P.WIN2, GW = P.GWIN, Pc = P.PORCH;
  const ops = [];
  for (const g of P.SOUTH_GABLES) {
    ops.push(sw(g, GW.w, GW.sill, GW.spring, GW.rise, GW.lights), ocu(g, P.OCULUS.y, P.OCULUS.r));
    if (Math.abs(g - Pc.s) > 0.1) ops.push(sw(g, W0.w, W0.sill, W0.spring, W0.rise, W0.lights));
  }
  for (const x of P.SOUTH_BAYS) ops.push(rw(x, W2.w, W2.sill, W2.head, W2.lights), rw(x, W1.w, W1.sill, W1.head, W1.lights), sw(x, W0.w, W0.sill, W0.spring, W0.rise, W0.lights));
  const dy0 = P.FFL - 0.25;
  ops.push({ pts: K.archPts(Pc.s, Pc.door, dy0, Pc.spring), kind: 'door', doorKey: 'archDoorOak', spring: Pc.spring, d: 0.4 });
  for (const sx of [-1, 1]) ops.push(rw(Pc.s + sx * 1.12, 0.34, 0.2, 1.75, 1, { d: 0.3 }));
  K.wall(B, SF(T), gabled(x0, x1, foot, E, gables), ops, BR);
  B.push(SF(T));
  plinth(x0, x1, foot); band(x0, x1, P.BAND1); band(x0, x1, P.BAND2);
  for (const g of gables) gableTrim(g.x0, g.x1, E, g.apex);
  for (const x of P.SOUTH_BAYS) { surround(x, W2.w, W2.sill, W2.head); surround(x, W1.w, W1.sill, W1.head); brickArch(x, W0.w, W0.spring, W0.rise); }
  for (const g of P.SOUTH_GABLES) {
    brickArch(g, GW.w, GW.spring, GW.rise);
    if (Math.abs(g - Pc.s) > 0.1) brickArch(g, W0.w, W0.spring, W0.rise);
    canted(g, { ...P.ORIEL, roof: 'lead', lights: P.ORIEL.lights });
  }
  porch(Pc, dy0);
  B.pop();
}
/** the porch's stone doorcase (current frame: the south face), its step, and its lantern */
function porch(Pc, dy0) {
  const x = Pc.s, hw = Pc.w / 2, pr = Pc.proj, top = Pc.top;
  for (const sx of [-1, 1]) {
    B.box(DR, x + sx * (hw - 0.2), (dy0 + top) / 2, pr / 2, 0.4, top - dy0, pr, 0, { top: false });          // pilasters
    B.box(DR, x + sx * (Pc.door / 2 + 0.12), (dy0 + Pc.spring) / 2, 0.06, 0.16, Pc.spring - dy0, 0.12, 0, { top: false });   // door jambs
  }
  B.box(DR, x, top - 0.2, pr / 2 + 0.03, Pc.w + 0.12, 0.4, pr + 0.06, 0, { bottom: true });                   // entablature
  B.box(DR, x, top + 0.05, pr / 2 + 0.06, Pc.w + 0.3, 0.12, pr + 0.12, 0, { bottom: true });                  // cornice
  B.box(DR, x, top + 0.35, 0.12, 0.7, 0.5, 0.24, 0, {});                                                       // cartouche block (blank)
  arcRing(x, Pc.spring, Pc.door / 2, 0.2, 0.06, -0.02, 10);
  // the step and the porch floor
  const g = gy(x, P.T_S + 1.2);
  B.box('pavingSolid', x, (dy0 + g - 0.3) / 2, (pr + 1.0) / 2, Pc.w + 0.3, dy0 - (g - 0.3), pr + 1.0, 0, {});
  ctx.floor(F.ring(R4(x - hw - 0.15, x + hw + 0.15, P.T_S, P.T_S + pr + 1.0)), dy0);
  const L = K.lantern(B, x - hw - 0.45, 2.55, 0.22, { size: 0.28 }); B.box('ironBlack', x - hw - 0.45, 2.55, 0.1, 0.05, 0.05, 0.25, 0, {});
  const q = F.L(L[0], P.T_S + L[2]); ctx.lamp(q[0], L[1], q[1]);
}
/** the east wing's Quad front (three gables, bays) with its ground windows, the tall stack at its south end */
function eastFace() {
  const S0 = P.S_EW1, E = P.EAVES, xa = -P.SE.t1, xb = -P.T_EWN, foot = footAt(S0, S0 + 2.5, P.T_EWN, P.SE.t1);
  const gs = P.EAST_GABLES.map((t) => ({ x0: -t - P.EG_W / 2, x1: -t + P.EG_W / 2, apex: P.EG_APEX }));
  const GW = P.GWIN, W0 = P.EWIN0_Y;
  const ops = [];
  for (const t of P.EAST_GABLES) ops.push(sw(-t, GW.w, GW.sill, GW.spring, GW.rise, GW.lights));
  for (const [t0, t1] of P.EWIN0) ops.push(rw(-(t0 + t1) / 2, t1 - t0, W0.sill, W0.head, W0.lights, { tr: [W0.transom] }));
  K.wall(B, EF(S0), gabled(xa, xb, foot, E, gs), ops, BR);
  B.push(EF(S0));
  plinth(xa, xb, foot); band(xa, xb, P.BAND1 - 0.1); band(xa, xb, P.BAND2);
  for (const g of gs) gableTrim(g.x0, g.x1, E, g.apex);
  for (const t of P.EAST_GABLES) { brickArch(-t, GW.w, GW.spring, GW.rise); canted(-t, { ...P.EBAY, roof: 'tile', sill: 0.35 }); }
  for (const [t0, t1] of P.EWIN0) surround(-(t0 + t1) / 2, t1 - t0, W0.sill, W0.head, 0.16, 0.07);
  const L = K.lantern(B, 11.0, 2.75, 0.22, { size: 0.28 }); B.box('ironBlack', 11.0, 2.75, 0.1, 0.05, 0.05, 0.25, 0, {});
  B.pop();
  { const q = F.L(S0 + L[2], -L[0]); ctx.lamp(q[0], L[1], q[1]); }
  // the tall stack against the south end of the front (F frame)
  const St = P.EAST_STACK;
  K.prism(B, BR, R4(S0 - 0.3, S0 + St.out, St.t0, St.t1), foot, St.top);
  B.box(BR, S0 + St.out / 2 - 0.15, St.top + 0.1, (St.t0 + St.t1) / 2, St.out + 0.45, 0.2, St.t1 - St.t0 + 0.15, 0, { bottom: true });
  for (const k of [0.25, 0.5, 0.75]) B.cyl('terracotta', S0 + St.out / 2 - 0.15, St.top + 0.2, St.t0 + (St.t1 - St.t0) * k, 0.13, 0.5, 8, true, 0.1);
  for (const y of [St.top - 0.9, St.top - 1.4]) B.box(BR, S0 + St.out / 2 - 0.15, y, (St.t0 + St.t1) / 2, St.out + 0.37, 0.12, St.t1 - St.t0 + 0.08, 0, { bottom: true });
}
/** the east wing's south end: the shaped gable over Teaching Space 3, its bow, the short west return */
function seEnd() {
  const T = P.SE.t1, x0 = P.SE.s0, x1 = P.SE.s1, xm = SER, E = P.EAVES, Sh = P.SHAPED, foot = footAt(x0, x1, T, T + 2.5);
  const so = Sh.stepW, out = [[x0, foot], [x1, foot], [x1, E], [xm + so + 0.2, Sh.step], [xm + so, Sh.step], [xm + so, Sh.step + 0.25], [xm, Sh.apex], [xm - so, Sh.step + 0.25], [xm - so, Sh.step], [xm - so - 0.2, Sh.step], [x0, E]];
  const W1 = P.WIN1, W2 = P.WIN2;
  K.wall(B, SF(T), out, [rw(xm, W2.w, W2.sill, W2.head, 3), rw(xm, W1.w, W1.sill, W1.head, 3), ocu(xm, Sh.oculus, 0.3)], BR);
  B.push(SF(T));
  plinth(x0, x1, foot); band(x0, x1, P.BAND1); band(x0, x1, P.BAND2);
  surround(xm, W2.w, W2.sill, W2.head); surround(xm, W1.w, W1.sill, W1.head);
  rake([x0 - 0.12, E], [xm - so - 0.2, Sh.step]); rake([xm + so + 0.2, Sh.step], [x1 + 0.12, E]);
  rake([xm - so - 0.05, Sh.step + 0.25], [xm, Sh.apex]); rake([xm, Sh.apex], [xm + so + 0.05, Sh.step + 0.25]);
  for (const sx of [-1, 1]) { B.box(DR, xm + sx * (so + 0.1), Sh.step + 0.12, -0.05, 0.5, 0.3, 0.5, 0, { bottom: true }); K.pinnacle(B, DR, xm + sx * (so + 0.1), -0.02, Sh.step + 0.27, Sh.step + 0.7, 0.18, 0.25); }
  for (const x of [x0, x1]) B.box(DR, x, E + 0.12, -0.05, 0.42, 0.3, 0.5, 0, { bottom: true });
  K.pinnacle(B, DR, xm, -0.02, Sh.apex + 0.12, Sh.apex + 0.6, 0.22, 0.32);
  bow();
  B.pop();
  // the short west return between the main south face and the projection
  const f2 = footAt(x0 - 1, x0, P.T_S, T);
  K.wall(B, WF(x0), K.rectPts(P.T_S, f2, T, E), [], BR);
  B.push(WF(x0)); plinth(P.T_S, T, f2); B.pop();
}
/** the stone bow window (five facets on a segmental plan) at the foot of the shaped gable (current frame: its face) */
function bow() {
  const Bw = P.BOW, c = Bw.w / 2, h = Bw.proj, Rr = (c * c + h * h) / (2 * h), zc = h - Rr, a0 = Math.asin(c / Rr), n = 5;
  const foot = footAt(Bw.s - c, Bw.s + c, P.SE.t1, P.SE.t1 + 1.5);
  const pt = (i) => { const a = -a0 + (2 * a0 * i) / n; return [Bw.s + Rr * Math.sin(a), zc + Rr * Math.cos(a)]; };
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = pt(i), b = pt(i + 1), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    ring.push(a);
    K.wall(B, K.frame(a[0], 0, a[1], dx, dz), K.rectPts(0, foot, L, Bw.top), [{ pts: K.rectPts(0.1, P.FFL + 0.45, L - 0.1, Bw.top - 0.35), kind: 'win', lights: 1, glass: 'sash', transoms: [P.FFL + 2.2], d: 0.1, sill: false, mullionW: 0.1 }], DR);
  }
  ring.push(pt(n));
  B.flat('lead', ring, Bw.top + 0.02);
  K.parapet(B, DR, ring, Bw.top, 0.25, 0.16, { coping: DR });
}
/** the west wing's Walton Street front: the north block with its small gable, the carriage arch under gable A with its
 *  two-storey oriel, the window bay, gable B with stacked oriels, the south bay */
function westFace() {
  const S0 = P.S_W, E = P.EAVES, xa = P.T_BOX, xb = P.tV4(S0), foot = footAt(S0 - 2.5, S0, xa, xb), A = P.ARCH;
  const gs = [P.WG_C, P.WG_A, P.WG_B].map((g) => ({ x0: g.t - g.w / 2, x1: g.t + g.w / 2, apex: g.apex }));
  // the outline with the carriage arch cut in (a notch from the foot)
  const pc = (P.PASS[0] + P.PASS[1]) / 2, pw = P.PASS[1] - P.PASS[0];
  const arc = K.archPts(pc, pw, foot, A.spring, 12).slice(3, -1).reverse();      // the arc's inner points, left to right
  const out0 = gabled(xa, xb, foot, E, gs);
  const out = [out0[0], [P.PASS[0], foot], [P.PASS[0], A.spring], ...arc, [P.PASS[1], A.spring], [P.PASS[1], foot], ...out0.slice(1)];
  const W1 = P.WIN1, W2 = P.WIN2, Wn = P.WEST_WIN, R0 = P.ROUND0;
  const ops = [{ pts: K.archPts(pc, pw, foot, A.spring, 12), kind: 'void', notch: true, d: P.S_WE - P.S_W, revealKey: BR }];
  for (const x of Wn.box) ops.push(sw(x, 1.0, W1.sill, W1.head - 0.2, 0.18, 1), sw(x, 1.0, W2.sill, W2.head - 0.15, 0.15, 1));
  ops.push(sw(-16.40, 1.0, 0.2, 2.2, 0.18, 1));
  ops.push(rw(P.WG_C.t, 0.9, E + 0.2, E + 1.1, 2));
  ops.push({ pts: circ(P.WG_A.t, 10.15, 0.3), kind: 'win', glass: 'glassDark', d: 0.16, sill: false });
  ops.push(rw(Wn.mid, 2.0, W2.sill, W2.head, 3), rw(Wn.mid, 2.0, W1.sill, W1.head, 3));
  for (const x of R0.t) ops.push({ pts: K.archPts(x, R0.w, R0.sill, R0.spring, 6), kind: 'win', glass: 'archSash', spring: R0.spring, d: 0.22, sillKey: DR });
  ops.push(rw(P.WG_B.t, 2.0, 0.2, 2.4, 3));
  ops.push(rw(Wn.south, 2.0, W2.sill, W2.head, 3), rw(Wn.south, 2.0, W1.sill, W1.head, 3), sw(Wn.south, 1.7, 0.2, 2.3, 0.28, 2));
  K.wall(B, WF(S0), out, ops, BR);
  B.push(WF(S0));
  plinth(xa, P.PASS[0], foot); plinth(P.PASS[1], xb, foot);
  band(xa, xb, P.BAND1); band(xa, xb, P.BAND2);
  for (const g of gs) gableTrim(g.x0, g.x1, E, g.apex);
  // the arch's stone ring
  arcRing(pc, A.spring, pw / 2, 0.38, 0.06, -0.03);
  for (const sx of [-1, 1]) B.box(DR, pc + sx * (pw / 2 + 0.2), (foot + A.spring) / 2, 0.03, 0.4, A.spring - foot, 0.06, 0, { top: false });
  for (const x of Wn.box) { brickArch(x, 1.0, W1.head - 0.2, 0.18); brickArch(x, 1.0, W2.head - 0.15, 0.15); }
  brickArch(-16.40, 1.0, 2.2, 0.18);
  surround(P.WG_C.t, 0.9, E + 0.2, E + 1.1);
  surround(Wn.mid, 2.0, W2.sill, W2.head); surround(Wn.mid, 2.0, W1.sill, W1.head); surround(Wn.south, 2.0, W2.sill, W2.head); surround(Wn.south, 2.0, W1.sill, W1.head);
  brickArch(Wn.south, 1.7, 2.3, 0.28); surround(P.WG_B.t, 2.0, 0.2, 2.4);
  const Wo = P.WORIEL;
  canted(P.WG_A.t, { ...Wo, roof: 'lead' });                                                  // two storeys over the arch
  canted(P.WG_B.t, { ...P.ORIEL, roof: 'lead' });                                             // first floor, on a corbel
  canted(P.WG_B.t, { back: 1.9, front: 1.1, proj: 0.4, corbel: 6.25, base: 6.75, top: 8.15, roofTop: 8.6, lights: 2, roof: 'lead' });   // second floor
  B.pop();
  // the carriage arch's court face (the passage's east mouth) and the wing's court face north of the shower block
  const S1 = P.S_WE, fc = footAt(S1, S1 + 2, P.T_BOX, P.SHOWER.t0);
  const xc0 = -P.SHOWER.t0, xc1 = -P.T_BOX, pa = -P.PASS[1], pb = -P.PASS[0];
  const arc2 = K.archPts(-pc, pw, fc, A.spring, 12).slice(3, -1).reverse();
  const outC = [[xc0, fc], [pa, fc], [pa, A.spring], ...arc2, [pb, A.spring], [pb, fc], [xc1, fc], [xc1, E], [xc0, E]];
  K.wall(B, EF(S1), outC, [sw(16.3, 1.0, W1.sill, W1.head - 0.2, 0.18, 1), sw(16.3, 1.0, W2.sill, W2.head - 0.15, 0.15, 1), sw(-pc, 1.0, W2.sill, W2.head - 0.15, 0.15, 1), sw(-pc, 1.0, 4.0, 5.3, 0.15, 1)], BR);
  B.push(EF(S1));
  arcRing(-pc, A.spring, pw / 2, 0.3, 0.05, -0.02);
  for (const x of [16.3, -pc]) brickArch(x, 1.0, W2.head - 0.15, 0.15);
  brickArch(16.3, 1.0, W1.head - 0.2, 0.18);
  B.pop();
  // the north end of the "box" (towards St Paul's)
  const fn = footAt(P.S_W, P.S_WE, P.T_BOX - 2, P.T_BOX);
  K.wall(B, NF(P.T_BOX), K.rectPts(-P.S_WE, fn, -P.S_W, E), [sw(-3.3, 1.0, W1.sill, W1.head - 0.2, 0.18, 1), sw(-3.3, 1.0, W2.sill, W2.head - 0.15, 0.15, 1), sw(-3.3, 1.0, 0.3, 2.2, 0.15, 1)], BR);
  B.push(NF(P.T_BOX)); plinth(-P.S_WE, -P.S_W, fn); band(-P.S_WE, -P.S_W, P.BAND2); for (const y of [W1.head - 0.2, W2.head - 0.15, 2.2]) brickArch(-3.3, 1.0, y, 0.16); B.pop();
  // the passage: its floor (setts on the survey) and lantern
  drape('setts', F.ring(R4(P.S_W, P.S_WE, P.PASS[0], P.PASS[1])), 0.08);
  ctx.floor(F.ring(R4(P.S_W - 0.05, P.S_WE + 0.05, P.PASS[0], P.PASS[1])), (u, v) => S.groundY(u, v) + 0.08);
  const L = K.lantern(B, (P.S_W + P.S_WE) / 2, A.spring + pw / 2 - 0.75, pc, { size: 0.3 });
  B.box('ironBlack', (P.S_W + P.S_WE) / 2, A.spring + pw / 2 - 0.25, pc, 0.04, 0.45, 0.04, 0, {});
  { const q = F.L(L[0], L[2]); ctx.lamp(q[0], L[1], q[1]); }
}
/** the west wing's south gable end on Wolfson's link line (v 4.0): plain brick, stone-coped (seen above the link) */
function westSouthGable() {
  const a = [P.S_W, P.tV4(P.S_W)], b = [P.S_WE, P.tV4(P.S_WE)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  const foot = footAt(P.S_W, P.S_WE, a[1] - 1, b[1]), E = P.EAVES, m = L * (P.S_RW - P.S_W) / (P.S_WE - P.S_W);
  const Fm = K.frame(a[0], 0, a[1], dx, dz);
  K.wall(B, Fm, [[0, foot], [L, foot], [L, E], [m, P.RIDGE], [0, E]], [], BR);
  B.push(Fm); rake([-0.12, E], [m, P.RIDGE]); rake([m, P.RIDGE], [L + 0.12, E]); for (const x of [0, L]) B.box(DR, x, E + 0.12, -0.05, 0.42, 0.3, 0.5, 0, { bottom: true }); B.pop();
  // the step between it and the main range's south face (behind Wolfson's link)
  if (b[1] > P.T_S + 0.02) K.wall(B, EF(P.S_WE), K.rectPts(-b[1], foot, -P.T_S, E), [], BR);
}
/** the court: the shower block, the south pile's court face, the north block's court face and the workshop */
function courtFaces() {
  const E = P.EAVES, W1 = P.WIN1, W2 = P.WIN2, Sh = P.SHOWER, s0 = Math.max(Sh.s0, P.S_WE);
  const sash = (x, y0, y1) => sw(x, 0.95, y0, y1, 0.15, 1);
  const arches = (xs, heads) => { for (const x of xs) for (const y of heads) brickArch(x, 0.95, y, 0.15); };
  const heads = [2.25, W1.head - 0.25, W2.head - 0.2];
  const rows = (xs) => xs.flatMap((x) => [sash(x, 0.4, heads[0]), sash(x, W1.sill, heads[1]), sash(x, W2.sill, heads[2])]);
  // shower block: north and east faces, flat roof with a parapet
  let f = footAt(s0, Sh.s1, Sh.t0 - 1.5, Sh.t0), top = P.SHOWER_TOP;
  K.wall(B, NF(Sh.t0), K.rectPts(-Sh.s1, f, -s0, top), rows([-9.9, -7.9]), BR);
  B.push(NF(Sh.t0)); plinth(-Sh.s1, -s0, f); arches([-9.9, -7.9], heads); B.pop();
  f = footAt(Sh.s1, Sh.s1 + 1.5, Sh.t0, Sh.t1);
  K.wall(B, EF(Sh.s1), K.rectPts(-Sh.t1, f, -Sh.t0, top), rows([8.35]), BR);
  B.push(EF(Sh.s1)); plinth(-Sh.t1, -Sh.t0, f); arches([8.35], heads); B.pop();
  B.flat('lead', R4(s0, Sh.s1, Sh.t0, Sh.t1), top - 0.15);
  K.parapet(B, BR, [[s0, Sh.t0 + 0.12], [Sh.s1 - 0.12, Sh.t0 + 0.12], [Sh.s1 - 0.12, Sh.t1]], top - 0.2, 0.32, 0.24, { coping: DR });
  // the south pile's court face east of the shower block
  f = footAt(Sh.s1, P.S_NB0, P.T_N1 - 1.5, P.T_N1);
  K.wall(B, NF(P.T_N1), K.rectPts(-P.S_NB0, f, -Sh.s1, E), rows([-13.3, -16.0]), BR);
  B.push(NF(P.T_N1)); plinth(-P.S_NB0, -Sh.s1, f); band(-P.S_NB0, -Sh.s1, P.BAND2); arches([-13.3, -16.0], heads); B.pop();
  // the north block's court (west) face: the north pile's gable end and the flat block's wall
  const Wk = P.WORKSHOP, t0 = P.T_NB, ya = P.NRIDGE - Math.abs(P.T_N2 - TRN) * KN;      // (the north pile's north slope at T_N2)
  f = footAt(P.S_NB0 - 1.5, P.S_NB0, t0, P.T_N1);
  const outW = [[t0, f], [P.T_N1, f], [P.T_N1, E], [TRN, P.NRIDGE], [P.T_N2, ya], [P.T_N2, P.PARAPET], [t0, P.PARAPET]];
  K.wall(B, WF(P.S_NB0), outW, [sash(-8.0, 0.4, heads[0]), sash(-8.0, W1.sill, heads[1]), sash(-8.0, W2.sill, heads[2]), sash(-10.1, 0.4, heads[0]), sash(-10.1, W1.sill, heads[1]), sash(-10.1, W2.sill, heads[2]),
    sash(-13.4, W1.sill, heads[1]), sash(-13.4, W2.sill, heads[2]), sash(-15.6, W1.sill, heads[1]), sash(-15.6, W2.sill, heads[2]), sash(-16.4, 7.85, 9.5), sash(-13.4, 0.4, heads[0]), sash(-15.6, 0.4, heads[0])], BR);
  B.push(WF(P.S_NB0)); plinth(t0, P.T_N1, f); arches([-8.0, -10.1], heads); arches([-13.4, -15.6], heads); brickArch(-16.4, 0.95, 9.5, 0.15); B.pop();
  // the workshop range north of the court
  const wt = P.WORKSHOP_TOP;
  f = footAt(Wk.s0, P.S_NB0, Wk.t1, Wk.t1 + 1.5);
  K.wall(B, SF(Wk.t1), K.rectPts(Wk.s0, f, P.S_NB0, wt), [{ pts: K.rectPts(14.8, P.FFL - 0.6, 16.8, 1.9), kind: 'door', doorKey: 'doorDark', d: 0.25 }, sash(12.0, 0.4, 2.3), sash(12.0, 3.4, 5.4), sash(16.0, 3.4, 5.4)], BR);
  B.push(SF(Wk.t1)); plinth(Wk.s0, P.S_NB0, f); arches([12.0], [2.3, 5.4]); brickArch(16.0, 0.95, 5.4, 0.15); B.pop();
  f = footAt(Wk.s0 - 1.5, Wk.s0, Wk.t0, Wk.t1);
  K.wall(B, WF(Wk.s0), K.rectPts(Wk.t0, f, Wk.t1, wt), [sash(-19.0, 3.4, 5.4)], BR);
  f = footAt(Wk.s0, Wk.s1, Wk.t0 - 1.5, Wk.t0);
  const nwin = [-12, -15, -18, -21, -24].map((x) => sash(x, 3.6, 5.5));
  K.wall(B, NF(Wk.t0), K.rectPts(-Wk.s1, f, -Wk.s0, wt), nwin, BR);
  B.push(NF(Wk.t0)); plinth(-Wk.s1, -Wk.s0, f); B.pop();
  f = footAt(Wk.s1, Wk.s1 + 1.5, Wk.t0, P.T_NB);
  K.wall(B, EF(Wk.s1), K.rectPts(-P.T_NB, f, -Wk.t0, wt), [], BR);
  B.flat('lead', R4(Wk.s0, Wk.s1, Wk.t0, Wk.t1), wt - 0.2);
  K.parapet(B, BR, [[Wk.s0 + 0.12, Wk.t1 - 0.12], [Wk.s0 + 0.12, Wk.t0 + 0.12], [Wk.s1 - 0.12, Wk.t0 + 0.12], [Wk.s1 - 0.12, P.T_NB]], wt - 0.25, 0.4, 0.24, { coping: DR });
  K.parapet(B, BR, [[Wk.s0 + 0.12, Wk.t1 - 0.12], [P.S_NB0, Wk.t1 - 0.12]], wt - 0.25, 0.4, 0.24, { coping: DR });
  // the court's north wall west of the workshop, with a door
  f = footAt(P.S_WE, Wk.s0, P.COURT_N - 1, P.COURT_N + 1);
  const cwTop = gy((P.S_WE + Wk.s0) / 2, P.COURT_N) + 2.5;
  K.wall(B, SF(P.COURT_N + 0.15), K.rectPts(P.S_WE, f, Wk.s0, cwTop), [{ pts: K.rectPts(8.0, gy(8.6, P.COURT_N) + 0.02, 9.1, gy(8.6, P.COURT_N) + 2.05), kind: 'door', doorKey: 'oakDoor', d: 0.3 }], 'brick');
  K.wall(B, NF(P.COURT_N - 0.15), K.rectPts(-Wk.s0, f, -P.S_WE, cwTop), [], 'brick');
  B.box(DR, (P.S_WE + Wk.s0) / 2, cwTop + 0.04, P.COURT_N, Wk.s0 - P.S_WE, 0.08, 0.4, 0, { top: false, bottom: true });
}
/** the north block: its north wall (east of the workshop), south strip over the north pile, east end, flat roof */
function northBlock() {
  const E = P.EAVES, t0 = P.T_NB, W1 = P.WIN1, W2 = P.WIN2, Wk = P.WORKSHOP, top = P.PARAPET;
  const sash = (x, y0, y1) => sw(x, 0.95, y0, y1, 0.15, 1);
  const f = footAt(P.S_NB0, 35.8, t0 - 1.5, t0);
  const ops = [];
  for (const x of [-27.6, -30.2, -32.8]) ops.push(sash(x, 0.4, 2.25), sash(x, W1.sill, W1.head - 0.25), sash(x, W2.sill, W2.head - 0.2));
  for (const x of [-19.5, -22.0, -24.5]) ops.push(sash(x, W2.sill, W2.head - 0.2));
  K.wall(B, NF(t0), K.rectPts(-35.8, f, -P.S_NB0, top), ops, BR);
  B.push(NF(t0)); plinth(-35.8, -Wk.s1, f); band(-35.8, -P.S_NB0, P.BAND2); for (const x of [-27.6, -30.2, -32.8]) for (const y of [2.25, W1.head - 0.25, W2.head - 0.2]) brickArch(x, 0.95, y, 0.15); B.pop();
  // the strip of wall facing south above the north pile, and the block's east end above the east wing's slope
  K.wall(B, SF(P.T_N2), K.rectPts(P.S_NB0, E - 0.4, P.S_EW0, top), [sash(22.0, 8.6, 9.9), sash(27.5, 8.6, 9.9), sash(32.0, 8.6, 9.9)], BR);
  K.wall(B, EF(P.S_EW0), K.rectPts(-P.T_N2, E - 0.3, -P.T_EWN, top), [], BR);
  K.wall(B, EF(35.8), K.rectPts(-P.T_EWN, E, -t0, top), [], BR);
  const ring = [[P.S_NB0, t0], [35.8, t0], [35.8, P.T_EWN], [P.S_EW0, P.T_EWN], [P.S_EW0, P.T_N2], [P.S_NB0, P.T_N2]];
  B.flat('lead', ring, P.FLAT);
  K.parapet(B, BR, [[P.S_NB0 + 0.12, P.T_N2 + 0.12], [P.S_NB0 + 0.12, t0 + 0.12], [35.8, t0 + 0.12]], P.FLAT - 0.1, top - P.FLAT, 0.24, { coping: DR });
  K.parapet(B, BR, [[P.S_NB0 + 0.12, P.T_N2 + 0.12], [P.S_EW0 - 0.12, P.T_N2 + 0.12], [P.S_EW0 - 0.12, P.T_EWN]], P.FLAT - 0.1, top - P.FLAT, 0.24, { coping: DR });
  // a glazed light over the map's inner court (no open court in the LIDAR)
  K.prism(B, 'lead', R4(27.0, 33.5, -15.2, -12.4), P.FLAT, P.FLAT + 0.35);
  K.coneRoof(B, 'glassDark', R4(27.0, 33.5, -15.2, -12.4), P.FLAT + 0.35, [30.25, -13.8], 0.7);
  // the east wing's north gable above Holtby's parapet
  K.wall(B, NF(P.T_EWN), [[-P.S_EW1, E], [-P.S_EW0, E], [-SER, P.RIDGE]], [], BR);
  B.push(NF(P.T_EWN)); rake([-P.S_EW1 - 0.12, E], [-SER, P.RIDGE]); rake([-SER, P.RIDGE], [-P.S_EW0 + 0.12, E]); B.pop();
}

// ------------------------------------------------------------------------------------------------ PARK: the roofs
function roofs() {
  const E = P.EAVES, Rg = P.RIDGE, ov = P.ROOF_OV, yo = (k) => E - ov * k;
  // the west wing: N - S ridge, hipped at the north, ending on the v 4.0 gable at the south
  const tHN = P.T_BOX + (P.S_RW - P.S_W), w0 = P.S_W - ov, w1 = P.S_WE + ov, tn = P.T_BOX - ov, y = yo(KW);
  B.poly(TILE, [[w0, y, tn], [w0, y, P.tV4(w0)], [P.S_RW, Rg, P.tV4(P.S_RW)], [P.S_RW, Rg, tHN]], [-1, 1, 0]);
  B.poly(TILE, [[P.S_RW, Rg, tHN], [P.S_RW, Rg, P.tV4(P.S_RW)], [w1, y, P.tV4(w1)], [w1, y, tn]], [1, 1, 0]);
  B.poly(TILE, [[w0, y, tn], [w1, y, tn], [P.S_RW, Rg, tHN]], [0, 1, -1]);
  // the south pile, clipped at its valleys with the two wings
  const yp = yo(KP), ts = P.T_S + ov, tn1 = P.T_N1 - ov;
  const sv = (tt) => P.S_RW + (Math.abs(tt - TR) * KP) / KW, ev = (tt) => SER - (Math.abs(tt - TR) * KP) / KE;
  B.poly(TILE, [[sv(ts), yp, ts], [ev(ts), yp, ts], [SER, Rg, TR], [P.S_RW, Rg, TR]], [0, 1, 1]);
  B.poly(TILE, [[P.S_RW, Rg, TR], [SER, Rg, TR], [ev(tn1), yp, tn1], [sv(tn1), yp, tn1]], [0, 1, -1]);
  // the north pile (east of the court), its west verge over the court gable, its east end in the east wing's slope
  const nv = (tt) => SER - (P.RIDGE - P.NRIDGE + Math.abs(tt - TRN) * KN) / KE, sw0 = P.S_NB0 - 0.2;
  B.poly(TILE, [[sw0, P.NRIDGE, TRN], [nv(TRN), P.NRIDGE, TRN], [nv(P.T_N1), E, P.T_N1], [sw0, E, P.T_N1]], [0, 1, 1]);
  B.poly(TILE, [[sw0, E, P.T_N2], [nv(P.T_N2), E, P.T_N2], [nv(TRN), P.NRIDGE, TRN], [sw0, P.NRIDGE, TRN]], [0, 1, -1]);
  // the east wing: N - S ridge from Holtby to the shaped gable
  K.roof(B, TILE, P.S_EW0, P.S_EW1, P.T_EWN, P.SE.t1, E, Rg - E, { axis: 'z', ends: ['open', 'open'], ov });
  // the cross gables' roofs: south front (ridge along t), Quad front and Walton Street front (ridge along s)
  for (const g of P.SOUTH_GABLES) K.roof(B, TILE, g - P.GABLE_W / 2, g + P.GABLE_W / 2, P.T_S - (P.GABLE_APEX - E) / KP - 0.15, P.T_S, E, P.GABLE_APEX - E, { axis: 'z', ends: ['open', 'open'], ov });
  for (const t of P.EAST_GABLES) K.roof(B, TILE, P.S_EW1 - (P.EG_APEX - E) / KE - 0.15, P.S_EW1, t - P.EG_W / 2, t + P.EG_W / 2, E, P.EG_APEX - E, { axis: 'x', ends: ['open', 'open'], ov });
  for (const g of [P.WG_C, P.WG_A, P.WG_B]) K.roof(B, TILE, P.S_W, P.S_W + (g.apex - E) / KW + 0.15, g.t - g.w / 2, g.t + g.w / 2, E, g.apex - E, { axis: 'x', ends: ['open', 'open'], ov });
  // ridge tiles along the main ridges (a darker roll)
  B.box('clayTile', P.S_RW, Rg + 0.05, (tHN + P.tV4(P.S_RW)) / 2, 0.2, 0.12, P.tV4(P.S_RW) - tHN, 0, {});
  B.box('clayTile', (P.S_RW + SER) / 2, Rg + 0.05, TR, SER - P.S_RW, 0.12, 0.2, 0, {});
  B.box('clayTile', SER, Rg + 0.05, (P.T_EWN + P.SE.t1) / 2, 0.2, 0.12, P.SE.t1 - P.T_EWN, 0, {});
  // stacks
  for (const c of P.CHIMNEYS) K.chimney(B, BR, c.s - c.w / 2, c.s + c.w / 2, c.t - c.d / 2, c.t + c.d / 2, Rg - 1.6, c.top, { pots: 3, capKey: BR, potKey: 'terracotta' });
}

// ------------------------------------------------------------------------------------------------ the Walton Street gate, West Lodge, wall, store
function gateAndLodge() {
  const Lg = P.LODGE, St = P.STREET_S;
  // West (Park) Lodge: brick, a stone band, one sash to the street, a hipped clay-tile roof
  let f = footAt(Lg.s0 - 0.5, Lg.s1, Lg.t0, Lg.t1);
  K.wall(B, WF(Lg.s0), K.rectPts(Lg.t0, f, Lg.t1, Lg.eaves), [{ pts: K.rectPts(Lg.sash - 0.48, Lg.band + 0.05, Lg.sash + 0.48, Lg.eaves - 0.35), kind: 'win', glass: 'sash', d: 0.18, sillKey: DR }], BR);
  B.push(WF(Lg.s0)); band(Lg.t0, Lg.t1, Lg.band, 0.16, 0.05); surround(Lg.sash, 0.96, Lg.band + 0.05, Lg.eaves - 0.35, 0.12, 0.05); B.pop();
  K.wall(B, SF(Lg.t1), K.rectPts(Lg.s0, f, Lg.s1, Lg.eaves), [{ pts: K.rectPts(-4.3, gy(-3.8, Lg.t1 + 0.5) + 0.1, -3.3, Lg.eaves - 0.25), kind: 'door', doorKey: 'doorDark', d: 0.2 }, { pts: K.rectPts(-7.3, -0.3, -6.3, Lg.eaves - 0.35), kind: 'win', glass: 'sash', d: 0.18, sillKey: DR }], BR);
  B.push(SF(Lg.t1)); band(Lg.s0, Lg.s1, Lg.band, 0.16, 0.05); B.pop();
  K.wall(B, EF(Lg.s1), K.rectPts(-Lg.t1, f, -Lg.t0, Lg.eaves), [{ pts: K.rectPts(17.6, -0.3, 18.6, Lg.eaves - 0.35), kind: 'win', glass: 'sash', d: 0.18, sillKey: DR }], BR);
  B.push(EF(Lg.s1)); band(-Lg.t1, -Lg.t0, Lg.band, 0.16, 0.05); B.pop();
  K.roof(B, TILE, Lg.s0, Lg.s1, Lg.t0, Lg.t1, Lg.eaves, Lg.ridge - Lg.eaves, { axis: 'x', ends: ['hip', 'hip'], ov: 0.3 });
  K.chimney(B, BR, -3.2, -2.5, -20.4, -19.7, Lg.eaves, Lg.ridge + 1.0, { pots: 1, potKey: 'terracotta' });
  // the gate piers (ashlar, capped) and the black iron gates (drawn open)
  const Pi = P.PIER, pz = St + Pi.w / 2;
  for (const t of P.PIERS) {
    const g = footAt(St - 0.5, St + 1, t - 0.4, t + 0.4);
    B.box('bath', pz, (g + Pi.top) / 2, t, Pi.w, Pi.top - g, Pi.w, 0, { top: false });
    B.box(DR, pz, Pi.top + Pi.cap / 2, t, Pi.w + 0.16, Pi.cap, Pi.w + 0.16, 0, { bottom: true });
    K.coneRoof(B, DR, R4(pz - 0.3, pz + 0.3, t - 0.3, t + 0.3), Pi.top + Pi.cap, [pz, t], 0.3);
    ctx.solid(F.ring(R4(St, St + Pi.w, t - Pi.w / 2, t + Pi.w / 2)));
  }
  const ga = P.PIERS[0] + Pi.w / 2, gb = P.PIERS[1] - Pi.w / 2, lw = (gb - ga) / 2, gyg = gy(pz, (ga + gb) / 2);
  for (const [t, dir] of [[ga, 1], [gb, -1]]) {        // each leaf hinged at its pier, swung 80 deg into the yard
    const a = (80 * Math.PI) / 180, M = new K.THREE.Matrix4().makeRotationY(dir * a).setPosition(pz, gyg + 0.05, t);
    B.push(M); B.push(WF(0));
    railing(dir > 0 ? 0 : -lw, dir > 0 ? lw : 0, 0, 0, 2.0, 0.12);
    for (const x of [0, dir * lw]) B.box('ironBlack', x, 1.0, 0, 0.05, 2.0, 0.05, 0, {});
    B.pop(); B.pop();
  }
  // the boundary wall from the south pier to Wolfson's wall at v 4.0 (coursed rubble, stone coping)
  const W = P.WALL, wz = St + W.th / 2, t0 = P.PIERS[1] + Pi.w / 2, t1 = P.tV4(wz);
  const fw = footAt(St - 1, St + 1, t0, t1);
  K.parapet(B, 'rubble', [[wz, t0], [wz, t1]], fw, W.top - fw, W.th, { coping: DR });
  ctx.solid(F.ring(R4(St, St + W.th, t0, t1)));
  // the low brick store behind the wall south of the gate (flat roof)
  const So = P.STORE, s0 = St + W.th, fs = footAt(s0, So.s1, So.t0, So.t1);
  K.wall(B, NF(So.t0), K.rectPts(-So.s1, fs, -s0, So.top), [], 'brick');
  K.wall(B, EF(So.s1), K.rectPts(-So.t1, fs, -So.t0, So.top), [1.9, 4.5, 7.1, 9.7].map((x) => ({ pts: K.rectPts(x - 1.1, gy(So.s1 + 0.5, -x) + 0.05, x + 1.1, So.top - 0.35), kind: 'door', doorKey: 'oakDoor', d: 0.12 })), 'brick');
  K.wall(B, SF(So.t1), K.rectPts(s0, fs, So.s1, So.top), [], 'brick');
  K.roof(B, 'slate', s0, So.s1, So.t0, So.t1, So.top, So.ridge - So.top, { axis: 'z', ends: ['gable', 'hip'], ov: 0.2, wallKey: 'brick' });
  ctx.solid(F.ring(R4(s0, So.s1, So.t0, So.t1)));
}

// ------------------------------------------------------------------------------------------------ St Paul's Nursery
function stPauls() {
  // walls of grey-buff COURSED RUBBLE with ashlar dressings (touch-up 1: they drew as smooth ashlar); the bay and the porch ashlar
  K.addCell(ctx.pack, 'spRubble', 'rubble', P.SP.rubbleTint, { seed: 3.1 });
  const Sp = P.SP, ST = 'spRubble', AS = 'bath', SD = DR, Ar = Sp.arm, Cr = Sp.cross, Po = Sp.porch;
  const f = footAt(Sp.s0 - 0.8, Ar.s1, Sp.t0, Sp.t1);
  const lw = (x, y0, y1, w = 1.05) => ({ pts: K.rectPts(x - w / 2, y0, x + w / 2, y1), kind: 'win', lights: 2, glass: 'leaded', d: 0.2, mullionW: 0.1, sillKey: SD });
  // the street front: the steep north cross gable and the range under the long slate roof
  K.wall(B, WF(Sp.s0), [[Sp.t0, f], [Sp.t1, f], [Sp.t1, Sp.eaves], [Cr.t1, Sp.eaves], [(Cr.t0 + Cr.t1) / 2, Cr.apex], [Cr.t0, Sp.eaves]],
    [lw(Sp.bay.t, 1.7, 3.15), lw(-26.4, 1.75, 3.25), lw(-26.4, -0.95, 0.85)], ST);
  B.push(WF(Sp.s0));
  for (const [x, y0, y1] of [[Sp.bay.t, 1.7, 3.15], [-26.4, 1.75, 3.25], [-26.4, -0.95, 0.85]]) surround(x, 1.05, y0, y1, 0.14, 0.06);
  gableTrim(Cr.t0, Cr.t1, Sp.eaves, Cr.apex, { finial: false });
  for (let i = 0; i < 8; i++) B.box('ironBlack', -27.5 + i * 1.35, Sp.eaves - 0.05, 0.12, 0.05, 0.22, 0.22, 0, {});     // gutter brackets
  canted(Sp.bay.t, { back: Sp.bay.back, front: Sp.bay.front, proj: Sp.bay.proj, base: f, top: Sp.bay.top, roofTop: Sp.bay.top + 0.05, lights: 3, glass: 'leaded', sill: Sp.floor - f + 0.55, head: 0.25, key: AS, roof: 'lead' });
  K.parapet(B, AS, [[Sp.bay.t - Sp.bay.back / 2, 0.1], [Sp.bay.t - Sp.bay.front / 2, Sp.bay.proj - 0.1], [Sp.bay.t + Sp.bay.front / 2, Sp.bay.proj - 0.1], [Sp.bay.t + Sp.bay.back / 2, 0.1]], Sp.bay.top + 0.1, 0.3, 0.2, { battle: { merlon: 0.28, gap: 0.22, h: 0.28 } });
  B.pop();
  // the street range's south gable end (with the tall brick stack), back wall
  K.wall(B, SF(Sp.t1), K.rectPts(Sp.s0, f, Sp.s1, Sp.eaves), [lw(-4.8, 1.75, 3.2, 0.9)], ST);
  K.wall(B, EF(Sp.s1), K.rectPts(-Sp.t1, f, -Cr.t1, Sp.eaves), [lw(24.0, 1.75, 3.2, 0.9), lw(26.6, -0.9, 0.9, 0.9)], ST);
  // the rear arm along the north boundary
  K.wall(B, SF(Ar.t1), K.rectPts(Sp.s1, f, Ar.s1, Ar.eaves), [-1.5, 1.8, 5.1, 8.0].map((x) => lw(x, -0.4, 2.3, 1.0)), ST);
  K.wall(B, NF(Ar.t0), K.rectPts(-Ar.s1, f, -Sp.s1, Ar.eaves), [], ST);
  K.wall(B, NF(Sp.t0), K.rectPts(-Sp.s1, f, -Sp.s0, Sp.eaves), [], ST);
  K.wall(B, EF(Ar.s1), K.rectPts(-Ar.t1, f, -Ar.t0, Ar.eaves), [lw(-(Ar.t0 + Ar.t1) / 2, 1.0, 2.9, 0.9)], ST);
  const ka = (Ar.ridge - Ar.eaves) / ((Ar.t1 - Ar.t0) / 2), td = Ar.t1 - 0.45, yd = Ar.eaves + 0.45 * ka;
  for (const x of Ar.dormers) K.dormer(B, SF(td), x, yd, 1.15, 1.05, 1.6, { key: ST, roofKey: 'slate', glass: 'leaded', lights: 2, rise: 0.5 });
  // roofs: the long slate roof, the cross wing (higher), the arm
  K.roof(B, 'slate', Sp.s0, Sp.s1, Cr.t1 - 1.6, Sp.t1, Sp.eaves, Sp.ridge - Sp.eaves, { axis: 'z', ends: ['open', 'gable'], ov: 0.25, wallKey: ST });
  K.roof(B, 'slate', Sp.s0, Sp.s1, Cr.t0, Cr.t1, Sp.eaves, Cr.apex - Sp.eaves, { axis: 'x', ends: ['open', 'gable'], ov: 0.2, wallKey: ST });
  K.roof(B, 'slate', Sp.s1 - 0.3, Ar.s1, Ar.t0, Ar.t1, Ar.eaves, Ar.ridge - Ar.eaves, { axis: 'x', ends: ['open', 'gable'], ov: 0.25, wallKey: ST });
  // the gabled porch with its pointed door
  const px = Sp.s0 - Po.proj, pm = (Po.t0 + Po.t1) / 2, fp = footAt(px - 0.5, Sp.s0, Po.t0, Po.t1);
  K.wall(B, WF(px), [[Po.t0, fp], [Po.t1, fp], [Po.t1, Po.eaves], [pm, Po.apex], [Po.t0, Po.eaves]], [{ pts: K.pointedPts(pm, 1.15, Sp.floor, Sp.floor + 1.75, 0.75, 6), kind: 'door', doorKey: 'oakDoor', d: 0.35 }], AS);
  B.push(WF(px)); gableTrim(Po.t0, Po.t1, Po.eaves, Po.apex, { finial: false }); bandPoly(SD, K.pointedPts(pm, 1.45, Sp.floor + 1.6, Sp.floor + 1.75, 0.85, 6).slice(2).reverse(), 0.15, 0.05, -0.02); B.pop();
  K.wall(B, NF(Po.t0), K.rectPts(-Sp.s0, fp, -px, Po.eaves), [], AS);
  K.wall(B, SF(Po.t1), K.rectPts(px, fp, Sp.s0, Po.eaves), [], AS);
  K.roof(B, 'slate', px - 0.05, Sp.s0 + 0.9, Po.t0, Po.t1, Po.eaves, Po.apex - Po.eaves, { axis: 'x', ends: ['open', 'open'], ov: 0.15 });
  ctx.floor(F.ring(R4(px, Sp.s0, Po.t0, Po.t1)), Sp.floor);
  B.box('pavingSolid', px + 0.2, (Sp.floor + gy(px, pm) - 0.2) / 2, pm, 0.4, Sp.floor - gy(px, pm) + 0.2, 1.3, 0, {});
  // chimneys: two octagonal stone shafts, the tall red-brick stack with stone bands on the south gable
  for (const c of Sp.stacks) {
    const y0 = c.y0, top = Cr.apex + 1.0;
    B.box(SD, c.s, y0 + 0.4, c.t, 0.75, 0.8, 0.75, 0, {});
    B.cyl('bathOld', c.s, y0 + 0.8, c.t, 0.22, top - y0 - 1.3, 8, false, 0.25);
    B.cyl('terracotta', c.s, top - 0.5, c.t, 0.3, 0.5, 8, true, 0.22);
  }
  const bs = Sp.brickStack;
  K.chimney(B, 'brick', bs.s - 0.45, bs.s + 0.45, bs.t - 0.35, bs.t + 0.3, Sp.eaves - 0.5, bs.top, { pots: 1, potKey: 'terracotta' });
  for (const y of [Sp.ridge - 0.2, Sp.ridge + 1.2, bs.top - 0.6]) B.box(SD, bs.s, y, bs.t - 0.03, 1.0, 0.14, 0.75, 0, { bottom: true });
  // the front railings and the strip behind them
  B.push(WF(Sp.rail.s));
  railing(Sp.rail.t0, Sp.rail.t1, 0, gy(Sp.rail.s, -28.5) - 0.02, Sp.rail.h, 0.16);
  B.pop();
  drape('paving', F.ring(R4(P.STREET_S, Sp.s0, Sp.t0, Po.t0)), 0.08);
  ctx.solid(F.ring(R4(Sp.s0, Sp.s1, Sp.t0, Sp.t1)));
  ctx.solid(F.ring(R4(Sp.s1, Ar.s1, Ar.t0, Ar.t1)));
  ctx.solid(F.ring([[px, Po.t0], [Sp.s0, Po.t0], [Sp.s0, Po.t1], [px, Po.t1]]).slice(0, 4));
  ctx.seg(...F.L(Sp.rail.s, Sp.rail.t0), ...F.L(Sp.rail.s, Sp.rail.t1));
}

// ------------------------------------------------------------------------------------------------ ground, colliders
function ground() {
  const Pa = P.PASS, So = P.STORE, St = P.STREET_S, W = P.WALL;
  // the yard between the street wall and the west front (paving), round the store
  const yard = [[St + W.th, P.LODGE.t1], [P.S_W, P.LODGE.t1], [P.S_W, P.tV4(P.S_W)], [So.s1, P.tV4(So.s1)], [So.s1, So.t0], [St + W.th, So.t0]];
  drape('paving', F.ring(yard), 0.08);
  ctx.floor(F.ring(yard), (u, v) => S.groundY(u, v) + 0.08);      // (the merge: walked where it is drawn)
  // THE MERGE (2026-11-24): the gate's threshold meets Walton Street's pavement FLUSH (the city draws it 0.13 over the
  // surveyed ground, world/ground.js Y.pavement): from 0.3 m outside the boundary at the pavement's level, falling to the
  // yard's paving (+0.08) at the wall's inner face. G: the fall (5 cm)
  // (drawn from the boundary only: the city's pavement runs up to the wall, and paving laid under it showed as a pale
  // sky-lit strip at its edge; walked from 0.3 m outside)
  { const s0 = St - 0.3, s1 = St + W.th, gate = F.ring(R4(s0, s1, P.PIERS[0], P.PIERS[1])), drawn = F.ring(R4(St + 0.02, s1, P.PIERS[0], P.PIERS[1]));
    const yT = (u, v) => { const q = F.P(u, v), f = Math.max(0, Math.min(1, (q[0] - s0) / (s1 - s0))), pv = F.groundY(s0, q[1]) + 0.13; return pv + (S.groundY(u, v) + 0.08 - pv) * f; };
    drape('paving', drawn, 0, { y: yT }); ctx.floor(gate, yT); }
  // the court (paving), round the shower block, and its north-west strip
  const Sh = P.SHOWER, Wk = P.WORKSHOP;
  drape('paving', F.ring([[P.S_WE, Wk.t1], [P.S_NB0, Wk.t1], [P.S_NB0, P.T_N1], [Sh.s1, P.T_N1], [Sh.s1, Sh.t0], [P.S_WE, Sh.t0]]), 0.08);
  drape('paving', F.ring(R4(P.S_WE, Wk.s0, P.COURT_N + 0.2, Wk.t1)), 0.08);
  // the brick setts before the east wing (survey "Brick Setts" 61.54 - 61.59)
  drape('setts', F.ring(R4(P.S_EW1, P.S_EW1 + 2.6, P.T_EWN + 3.3, P.SE.t1 + 0.6)), 0.08);      // (north of t -11.2 Holtby's loggia and its flagged apron: part 'library')
  // colliders: the blocks, with the carriage arch left open
  const solid = (r) => ctx.solid(F.ring(r));
  solid(R4(P.S_W, P.S_WE, P.T_BOX, Pa[0]));
  solid([[P.S_W, Pa[1]], [P.S_WE, Pa[1]], [P.S_WE, P.tV4(P.S_WE)], [P.S_W, P.tV4(P.S_W)]]);
  solid(R4(P.S_WE, Sh.s1, Sh.t0, Sh.t1));
  solid(R4(P.S_WE, P.SE.s0, P.T_N1, P.T_S));
  solid([[P.S_NB0, P.T_NB], [35.8, P.T_NB], [35.8, P.T_EWN], [P.S_EW0, P.T_EWN], [P.S_EW0, P.T_N1], [P.S_NB0, P.T_N1]]);
  solid(R4(Wk.s0, Wk.s1, Wk.t0, Wk.t1));
  solid(R4(P.S_EW0, P.S_EW1, P.T_EWN, P.SE.t1));
  solid(R4(P.BOW.s - P.BOW.w / 2, P.BOW.s + P.BOW.w / 2, P.SE.t1, P.SE.t1 + P.BOW.proj));
  solid(R4(P.S_WE, Wk.s0, P.COURT_N - 0.2, P.COURT_N + 0.2));
  solid(R4(P.LODGE.s0, P.LODGE.s1, P.LODGE.t0, P.LODGE.t1));
}

export function buildPark(c) {
  ctx = c; K = c.K; B = c.B; S = c.S; G = c.G; drapes = [];
  const n0 = B.tris();
  B.push(F.M);
  southFace(); seEnd(); eastFace(); westFace(); westSouthGable(); courtFaces(); northBlock(); roofs();
  const nPark = B.tris() - n0;
  gateAndLodge();
  const nGate = B.tris() - n0 - nPark;
  stPauls();
  const nSP = B.tris() - n0 - nPark - nGate;
  ground();
  B.pop();
  for (const [key, ring, dy, o] of drapes) G.drape(B, key, ring, dy, o || {});
  return { tris: { park: Math.round(nPark), gateLodgeWall: Math.round(nGate), stPauls: Math.round(nSP), ground: Math.round(B.tris() - n0 - nPark - nGate - nSP) } };
}
