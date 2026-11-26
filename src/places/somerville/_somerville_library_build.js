// Somerville College, STANDALONE model: THE LIBRARY AND HOLTBY's build functions (Champneys 1903; Hyslop 1951 - 56).
// Called by somerville_library.js with ctx.B in the college's LOCAL frame. Every figure is a named constant in
// _somerville_library_plan.js (with its source and K / G mark). The work is done inside the range's own frame
// (P.F: s east along the Library's wing face, y up, t south towards the Quad); P.F.ring / P.F.L convert to LOCAL for
// colliders, floors, lamps and the draped ground.
// Helpers the kit does not have (written here, not in the kit): surround (a stone architrave with ears, cornice and
// apron), rusticated blocks, ball finials, a band along a polyline in a wall frame (segmental pediments), the canted
// oriel, a light iron lattice railing.
import * as P from './_somerville_library_plan.js';

let K = null, B = null, ctx = null;

// ------------------------------------------------------------------------------------------------ frames (inside P.F)
const SF = (t) => K.frame(0, 0, t, 1, 0);      // a face looking SOUTH at t: x = s
const NF = (t) => K.frame(0, 0, t, -1, 0);     // looking NORTH at t: x = -s
const EF = (s) => K.frame(s, 0, 0, 0, -1);     // looking EAST at s: x = -t
const WF = (s) => K.frame(s, 0, 0, 0, 1);      // looking WEST at s: x = t
const R = (s0, s1, t0, t1) => [[s0, t0], [s1, t0], [s1, t1], [s0, t1]];
/** the lowest surveyed ground under a box of the frame, less a margin: where a wall's foot goes */
function footAt(s0, s1, t0, t1, m = 0.6) {
  let lo = Infinity;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 2; j++) lo = Math.min(lo, P.F.groundY(s0 + ((s1 - s0) * i) / 8, t0 + ((t1 - t0) * j) / 2));
  return lo - m;
}

// ------------------------------------------------------------------------------------------------ small helpers (current wall frame: x along, y up, z out)
/** a stone architrave round an opening x +- w/2, y0..y1: jambs and head a wide, p proud; o.ears, o.cornice, o.apron (height of a panel under the sill) */
function surround(x, w, y0, y1, o = {}) {
  const a = o.a ?? 0.17, p = o.p ?? 0.07, k = o.key || 'bathDress';
  for (const sx of [-1, 1]) B.box(k, x + sx * (w / 2 + a / 2), (y0 + y1) / 2, p / 2, a, y1 - y0, p, 0, { top: false });
  B.box(k, x, y1 + a / 2, p / 2, w + 2 * a, a, p, 0, { bottom: true });
  if (o.ears) for (const sx of [-1, 1]) B.box(k, x + sx * (w / 2 + a + 0.06), y1 + a - 0.12, p / 2, 0.12, 0.24, p, 0, { bottom: true });
  if (o.cornice) B.box(k, x, y1 + a + 0.07, p / 2 + 0.05, w + 2 * a + 0.3, 0.14, p + 0.1, 0, { bottom: true });
  if (o.apron) { B.box(k, x, y0 - 0.14 - o.apron / 2, p / 2, w + 2 * a, o.apron, p, 0, { top: false, bottom: true }); B.box(k, x, y0 - 0.12, p / 2 + 0.04, w + 2 * a + 0.12, 0.1, p + 0.08, 0, { bottom: true }); }
}
/** a rusticated block (pier, quoin pilaster): w wide, from y0 to y1, its face `proj` proud, courses `c` high with sunk joints */
function rustic(x, w, y0, y1, proj, c = 0.33, key = 'bath') {
  B.box(key, x, (y0 + y1) / 2, (proj - 0.04) / 2, w - 0.04, y1 - y0, proj - 0.04, 0, { top: false });
  for (let y = y0; y < y1 - 0.05; y += c) { const h = Math.min(c, y1 - y) - 0.04; B.box(key, x, y + 0.02 + h / 2, proj / 2, w, h, proj, 0, {}); }
}
/** a ball finial on a short neck standing on y at (x, z) of the current frame */
function ball(x, y, z, r) {
  B.box('bathDress', x, y + 0.06, z, r * 1.5, 0.12, r * 1.5, 0, {});
  B.cyl('bathDress', x, y + 0.12, z, r, r, 8, false, r * 0.45);
  B.cyl('bathDress', x, y + 0.12 + r, z, r * 0.25, r * 0.95, 8, true, r);
}
/** a band of thickness h laid along a polyline pts [[x, y], ...] in the current wall frame, from z0 (front) back to z1 */
function band(key, pts, h, z0, z1) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], A = [a[0], a[1] + h], Bt = [b[0], b[1] + h];
    B.poly(key, [[A[0], A[1], z0], [Bt[0], Bt[1], z0], [Bt[0], Bt[1], z1], [A[0], A[1], z1]], [-(b[1] - a[1]), Math.abs(b[0] - a[0]) + 1e-3, 0]);
    B.poly(key, [[a[0], a[1], z0], [b[0], b[1], z0], [Bt[0], Bt[1], z0], [A[0], A[1], z0]], [0, 0, 1]);
    B.poly(key, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], [b[1] - a[1], -Math.abs(b[0] - a[0]) - 1e-3, 0]);
  }
}
/** the points of a segmental arc from (x0, y) to (x1, y) rising `rise` in the middle */
function segArc(x0, x1, y, rise, n = 10) {
  const c = (x1 - x0) / 2, Rr = (c * c + rise * rise) / (2 * rise), xm = (x0 + x1) / 2, yc = y + rise - Rr, a0 = Math.asin(c / Rr);
  return Array.from({ length: n + 1 }, (_, i) => { const a = -a0 + (2 * a0 * i) / n; return [xm + Rr * Math.sin(a), yc + Rr * Math.cos(a)]; });
}
/** a stone eaves cornice with a bed-mould along x0..x1 of the current frame; `ends` runs it on past the ends (corners) */
function cornice(x0, x1, ends = 0) {
  K.stringCourse(B, 'bathDress', x0 - ends, x1 + ends, P.EAVES, 0.3, P.CORNICE_PROJ);
  K.stringCourse(B, 'bathDress', x0 - ends * 0.5, x1 + ends * 0.5, P.FRIEZE + 0.02, 0.14, 0.22);
}
/** the bands every Library face carries: plinth, the first-floor band, the capitals' architrave band, the cornice */
function bands(x0, x1, foot, o = {}) {
  K.stringCourse(B, 'bath', x0, x1, P.PLINTH, P.PLINTH - foot, 0.08);
  if (o.string !== false) K.stringCourse(B, 'bathDress', x0, x1, P.STRING.top, P.STRING.h, P.STRING.proj);
  K.stringCourse(B, 'bathDress', x0, x1, P.CAP + 0.2, 0.2, 0.05);
  cornice(x0, x1, o.ends ?? 0);
}
const win1Op = (x) => ({ pts: K.rectPts(x - P.WIN1.w / 2, P.WIN1.sill, x + P.WIN1.w / 2, P.WIN1.head), kind: 'win', lights: 2, transoms: [P.WIN1.transom], glass: 'leaded', d: 0.22, sill: false, mullionW: 0.11 });
const win0Op = (x) => ({ pts: K.rectPts(x - P.WIN0.w / 2, P.WIN0.sill, x + P.WIN0.w / 2, P.WIN0.head), kind: 'win', lights: 2, transoms: [P.WIN0.transom], glass: 'leaded', d: 0.2, sill: false, mullionW: 0.11 });
const dress1 = (x) => surround(x, P.WIN1.w, P.WIN1.sill, P.WIN1.head, { ears: true, cornice: true, apron: P.WIN1.apron });
const dress0 = (x) => surround(x, P.WIN0.w, P.WIN0.sill, P.WIN0.head, { a: 0.15, apron: 0.12 });

// ------------------------------------------------------------------------------------------------ the Library's faces
/** a plain front (a wing) at T_WING from s0 to s1 with its windows at bays (s) */
function wing(s0, s1, bays) {
  const foot = footAt(s0, s1, P.T_WING, P.T_WING + 1.5);
  K.wall(B, SF(P.T_WING), K.rectPts(s0, foot, s1, P.EAVES), [...bays.map(win1Op), ...bays.map(win0Op)], 'brick');
  B.push(SF(P.T_WING));
  bands(s0, s1, foot);
  for (const x of bays) { dress1(x); dress0(x); }
  B.pop();
}
/** a projecting pavilion from s0 to s1 at T_FWD with its returns, pilasters, windows, attic and finials. backW / backE: where
 *  its west / east returns end (t) */
function pavilion(s0, s1, bays, pilasters, backW, backE, onCorbels) {
  const T = P.T_FWD, foot = footAt(s0, s1, T, T + 1.5);
  K.wall(B, SF(T), K.rectPts(s0, foot, s1, P.EAVES), [...bays.map(win1Op), ...bays.map(win0Op)], 'brick');
  K.wall(B, WF(s0), K.rectPts(backW, foot, T, P.EAVES), [], 'brick');
  K.wall(B, EF(s1), K.rectPts(-T, foot, -backE, P.EAVES), [], 'brick');
  B.push(SF(T));
  bands(s0, s1, foot, { ends: P.CORNICE_PROJ });
  for (const x of bays) { surround(x, P.WIN1.w, P.WIN1.sill, P.WIN1.head, { ears: true, cornice: true, apron: onCorbels ? 0 : P.WIN1.apron }); dress0(x); }
  if (onCorbels) for (const x of bays) {      // the first-floor windows' sills on carved corbels (photo c2021: east pavilion)
    B.box('bathDress', x, P.WIN1.sill - 0.2, 0.2, P.WIN1.w + 0.6, 0.22, 0.4, 0, { bottom: true });
    for (const sx of [-0.35, 0.35]) B.box('bathDress', x + sx * P.WIN1.w, P.WIN1.sill - 0.55, 0.14, 0.24, 0.5, 0.28, 0, { bottom: true });
    B.box('bathDress', x, P.WIN1.sill - 0.6, 0.05, P.WIN1.w * 0.5, 0.45, 0.1, 0, { bottom: true });
  }
  const Pl = P.PILASTER;
  for (const x of pilasters) {
    rustic(x, Pl.w, foot, P.STRING.top - P.STRING.h, Pl.proj + 0.04);
    B.box('bath', x, (P.STRING.top + P.CAP) / 2, Pl.proj / 2, Pl.w - 0.1, P.CAP - P.STRING.top, Pl.proj, 0, { top: false });
    B.box('bathDress', x, P.CAP + 0.1, Pl.proj / 2 + 0.03, Pl.w + 0.06, 0.2, Pl.proj + 0.06, 0, { bottom: true });
    B.box('bathDress', x, (P.CAP + 0.2 + P.EAVES - 0.3) / 2, Pl.proj / 2 + 0.02, Pl.w + 0.1, P.EAVES - 0.3 - P.CAP - 0.2, Pl.proj + 0.04, 0, { bottom: true });
  }
  B.pop();
  // the returns' bands (short)
  B.push(WF(s0)); bands(backW, T, foot); B.pop();
  B.push(EF(s1)); bands(-T, -backE, foot); B.pop();
  attic(s0, s1, pilasters, [backW, backE]);
}
/** the brick attic with a stone coping over a projecting front (pavilion), pedestals and balls on the pilasters' axes,
 *  and the flat lead roof behind it back to the main slope */
function attic(s0, s1, axes, backs, gap) {
  const T = P.T_FWD, A = P.ATTIC, tc = T - A.t / 2, h = A.top - P.EAVES;
  const runs = gap ? [[s0, gap[0]], [gap[1], s1]] : [[s0, s1]];
  for (const [a, b] of runs) K.parapet(B, 'brick', [[a + A.t / 2, tc], [b - A.t / 2, tc]], P.EAVES, h, A.t, { coping: 'bathDress' });
  if (backs) {
    K.parapet(B, 'brick', [[s0 + A.t / 2, tc], [s0 + A.t / 2, Math.max(backs[0], -0.4)]], P.EAVES, h, A.t, { coping: 'bathDress' });
    K.parapet(B, 'brick', [[s1 - A.t / 2, tc], [s1 - A.t / 2, Math.max(backs[1], -0.4)]], P.EAVES, h, A.t, { coping: 'bathDress' });
  }
  B.flat('lead', R(s0 + 0.05, s1 - 0.05, -0.2, T - A.t + 0.01), P.EAVES + 0.02);
  for (const x of axes) {
    B.box('bathDress', x, (P.EAVES + P.PED.top) / 2, tc + 0.04, P.PED.w, P.PED.top - P.EAVES, P.PED.w, 0, {});
    B.box('bathDress', x, P.PED.top + 0.04, tc + 0.04, P.PED.w + 0.12, 0.08, P.PED.w + 0.12, 0, { bottom: true });
    ball(x, P.PED.top + 0.08, tc + 0.04, P.PED.ball);
  }
}

// ------------------------------------------------------------------------------------------------ the frontispiece
function frontispiece() {
  const [s0, s1] = P.FRONT, T = P.T_FWD, L = P.LOGGIA, foot = footAt(s0, s1, T, T + 2);
  const pitch = (s1 - s0 - L.pierW) / 3, piers = [0, 1, 2, 3].map((k) => s0 + L.pierW / 2 + k * pitch);
  const cols = [0, 1, 2].map((k) => (piers[k] + piers[k + 1]) / 2), aw = (pitch - L.pierW - 2 * L.colR) / 2, ar = aw / 2;
  const capH = 0.2, c = L.colR + 0.06;
  // the arcade: one opening a bay, two round arches meeting over the Tuscan column's capital
  const ops = [], arches = [];
  for (let k = 0; k < 3; k++) {
    const xa = piers[k] + L.pierW / 2, xb = piers[k + 1] - L.pierW / 2, xc = cols[k], sp = L.spring;
    const pts = [[xa, P.FFL], [xb, P.FFL], [xb, sp]];
    const cR = xb - ar, cL = xa + ar;
    for (let i = 1; i < 10; i++) { const a = (i / 10) * Math.PI; pts.push([cR + Math.cos(a) * ar, sp + Math.sin(a) * ar]); }
    pts.push([xc + c, sp], [xc - c, sp]);
    for (let i = 1; i < 10; i++) { const a = (i / 10) * Math.PI; pts.push([cL + Math.cos(a) * ar, sp + Math.sin(a) * ar]); }
    pts.push([xa, sp]);
    ops.push({ pts, kind: 'void', d: L.glassBack });
    arches.push({ x: cL, k, i: 0 }, { x: cR, k, i: 1 });
  }
  K.wall(B, SF(T), K.rectPts(s0, foot, s1, P.STRING.top - P.STRING.h), ops, 'bath');
  // the upper storey: brick between the giant columns, the side bays' windows; the oriel stands on the centre bay
  K.wall(B, SF(T), K.rectPts(s0, P.STRING.top - P.STRING.h, s1, P.EAVES), [win1Op(cols[0]), win1Op(cols[2])], 'brick');
  for (const [S, sgn] of [[s0, -1], [s1, 1]]) {
    const F = sgn < 0 ? WF(S) : EF(S), x0 = sgn < 0 ? 0 : -T, x1 = sgn < 0 ? T : 0;
    K.wall(B, F, K.rectPts(x0, foot, x1, P.STRING.top - P.STRING.h), [], 'bath');
    K.wall(B, F, K.rectPts(x0, P.STRING.top - P.STRING.h, x1, P.EAVES), [], 'brick');
    B.push(F); bands(x0, x1, foot); B.pop();
  }
  B.push(SF(T));
  bands(s0, s1, foot, { ends: P.CORNICE_PROJ });
  // the loggia: glazing set back in each arch (dark frames), glazed doors in the centre bay, the Tuscan columns
  const z = -L.glassBack + 0.03;
  for (const a of arches) {
    const door = L.doors.includes(a.k * 2 + a.i);
    B.archUnit('glassDark', a.x, aw, P.FFL, L.spring, z);
    B.box('ironBlack', a.x, (P.FFL + L.spring) / 2, z + 0.03, 0.07, L.spring - P.FFL, 0.06, 0, {});
    B.box('ironBlack', a.x, L.spring - (door ? 0.25 : 0), z + 0.03, aw, 0.07, 0.06, 0, {});
    if (door) for (const sx of [-1, 1]) B.box('ironBlack', a.x + sx * (aw / 2 - 0.05), (P.FFL + L.spring) / 2, z + 0.03, 0.08, L.spring - P.FFL, 0.06, 0, {});
    B.box('ironBlack', a.x, P.FFL + 0.05, z + 0.03, aw, 0.1, 0.06, 0, {});
    // the arch's voussoirs and keystone (ashlar, proud)
    band('bathDress', segArc(a.x - ar - 0.12, a.x + ar + 0.12, L.spring, ar + 0.12, 9), 0.18, 0.05, -0.02);
    B.box('bathDress', a.x, L.spring + ar + 0.12, 0.06, 0.26, 0.42, 0.12, 0, { bottom: true });
  }
  for (const x of cols) {
    B.box('bath', x, P.FFL + 0.08, -0.3, 0.52, 0.16, 0.52, 0, {});
    B.cyl('bath', x, P.FFL + 0.16, -0.3, L.colR * 0.9, L.spring - capH - P.FFL - 0.16, 10, false, L.colR);
    B.box('bathDress', x, L.spring - capH / 2, -0.3, 2 * c + 0.12, capH, 0.6, 0, { bottom: true });
    B.box('bathDress', x, (L.spring + P.STRING.top - P.STRING.h) / 2 + 0.2, 0.05, 0.42, 0.55, 0.12, 0, { bottom: true });     // the carved console over the column
  }
  // the piers (rusticated) and the giant engaged Ionic columns on them, the entablature broken forward over them
  const G = P.GIANT;
  for (const x of piers) {
    rustic(x, L.pierW, foot, P.STRING.top - P.STRING.h, 0.12, L.course);
    const y0 = P.STRING.top + 0.05;
    B.box('bath', x, y0 + 0.2, 0.2, 0.86, 0.4, 0.4, 0, {});                                   // pedestal block
    B.box('bathDress', x, y0 + 0.4 + G.base / 2, 0.2, 0.78, G.base, 0.42, 0, {});
    B.cyl('bath', x, y0 + 0.4 + G.base, 0.2, G.r * 0.88, P.CAP - y0 - 0.4 - G.base, 12, false, G.r);
    B.box('bathDress', x, P.CAP + 0.1, 0.22, 0.86, 0.2, 0.5, 0, { bottom: true });            // the capital: abacus, volutes
    for (const sx of [-1, 1]) B.box('bathDress', x + sx * 0.34, P.CAP - 0.05, 0.3, 0.16, 0.3, 0.42, 0, { bottom: true });
    B.box('bathDress', x, (P.CAP + 0.2 + P.EAVES - 0.3) / 2, 0.24, 0.9, P.EAVES - 0.3 - P.CAP - 0.2, 0.48, 0, { bottom: true });
    B.box('bathDress', x, P.EAVES - 0.15, 0.24 + 0.12, 1.1, 0.3, 0.72, 0, { bottom: true });
  }
  dress1(cols[0]); dress1(cols[2]);
  oriel(cols[1]);
  // the segmental pediment over the centre bay with its cartouche (a blank shield), and the attic over the side bays
  const pa = piers[1], pb = piers[2], arc = segArc(pa, pb, P.EAVES, P.PEDIMENT.rise, 12);
  B.face('brick', arc, [], -P.ATTIC.t / 2 + 0.18);
  B.face('brick', arc, [], -P.ATTIC.t / 2 - 0.18, true);
  band('bathDress', arc, P.PEDIMENT.w, 0.1, -P.ATTIC.t);
  const yc = P.EAVES + P.PEDIMENT.rise * 0.5, sh = [[0, -0.55], [0.36, -0.3], [0.42, 0.28], [0.28, 0.5], [-0.28, 0.5], [-0.42, 0.28], [-0.36, -0.3]];
  B.poly('bathDress', sh.map(([dx, dy]) => [(pa + pb) / 2 + dx, yc + dy, 0.08]), [0, 0, 1]);
  B.box('bathDress', (pa + pb) / 2, yc + 0.05, 0.02, 1.0, 1.25, 0.1, 0, {});
  ball((pa + pb) / 2, P.EAVES + P.PEDIMENT.rise + P.PEDIMENT.w - 0.05, -0.05, 0.2);
  B.pop();
  B.push(K.frame(0, 0, 0, 1, 0));
  attic(s0, s1, piers, [0, 0], [pa, pb]);
  B.pop();
  return { piers, cols };
}
/** the canted stone oriel at x on the frontispiece's upper face (current frame: z = 0 the face) */
function oriel(x) {
  const O = P.ORIEL, hw = O.w / 2, hf = O.front / 2;
  const plan = [[x - hw, 0], [x - hf, O.proj], [x + hf, O.proj], [x + hw, 0]];
  for (let i = 0; i < 3; i++) {
    const p = plan[i], q = plan[i + 1], len = Math.hypot(q[0] - p[0], q[1] - p[1]), m = i === 1 ? 0.14 : 0.1;
    K.wall(B, K.frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1]), K.rectPts(0, O.sill - 0.12, len, O.top),
      [{ pts: K.rectPts(m, O.sill, len - m, O.head), kind: 'win', lights: i === 1 ? O.lights : 1, transoms: [O.transom], glass: 'leaded', d: 0.1, sill: false, mullionW: 0.1 }], 'bath');
  }
  // the corbel: the plan narrowing down to the wall, a carved panel on its face
  const lo = O.corbel, low = [[x - hw * 0.55, 0], [x - hf * 0.5, 0.12], [x + hf * 0.5, 0.12], [x + hw * 0.55, 0]], yt = O.sill - 0.12;
  for (let i = 0; i < 3; i++) { const dx = plan[i + 1][0] - plan[i][0], dz = plan[i + 1][1] - plan[i][1]; B.poly('bath', [[low[i][0], lo, low[i][1]], [low[i + 1][0], lo, low[i + 1][1]], [plan[i + 1][0], yt, plan[i + 1][1]], [plan[i][0], yt, plan[i][1]]], [-dz, -0.7, dx]); }
  B.poly('bath', low.map((p) => [p[0], lo, p[1]]), [0, -1, 0]);
  B.box('bathDress', x, (lo + yt) / 2 + 0.05, O.proj * 0.55, O.front * 0.55, (yt - lo) * 0.55, 0.06, 0, {});
  // the cornice and lead top, a small segmental hood over it
  const top = plan.map(([a, b]) => [a + (a < x ? -0.1 : 0.1), b + 0.1]);
  K.prism(B, 'bathDress', [...top, [x + hw + 0.1, -0.05], [x - hw - 0.1, -0.05]], O.top - 0.04, O.top + 0.16, { top: true, topKey: 'lead' });
  band('bathDress', segArc(x - hf, x + hf, O.top + 0.16, 0.45, 8), 0.16, O.proj - 0.05, 0);
}

// ------------------------------------------------------------------------------------------------ the rest of the Library
function northFace(s0, s1, bays) {
  const foot = footAt(s0, s1, P.T_NORTH - 1, P.T_NORTH);
  const ops = [];
  for (const s of bays) {
    ops.push({ pts: K.rectPts(-s - 0.6, P.H(5.3), -s + 0.6, P.H(7.6)), kind: 'win', lights: 2, transoms: [P.H(6.8)], glass: 'leaded', d: 0.2, mullionW: 0.1 });
    ops.push({ pts: K.rectPts(-s - 0.5, P.H(1.4), -s + 0.5, P.H(2.8)), kind: 'win', lights: 2, glass: 'leaded', d: 0.2, mullionW: 0.1 });
  }
  K.wall(B, NF(P.T_NORTH), K.rectPts(-s1, foot, -s0, P.EAVES), ops, 'brick');
  B.push(NF(P.T_NORTH));
  K.stringCourse(B, 'bath', -s1, -s0, P.PLINTH, P.PLINTH - foot, 0.06);
  K.stringCourse(B, 'bathDress', -s1 - 0.3, -s0, P.EAVES, 0.3, 0.3);
  B.pop();
}
function roofAndEnds() {
  const s0 = P.S_LIB0, s1 = P.S_LIB1, rise = P.RIDGE - P.EAVES;
  K.roof(B, 'stoneSlate', s0, s1, P.T_NORTH, P.T_WING, P.EAVES, rise, { axis: 'x', ends: ['gable', 'gable'], ov: P.ROOF_OV, wallKey: 'brick' });
  const tm = (P.T_NORTH + P.T_WING) / 2;
  // the gable walls below the eaves (the west one is Holtby's party wall), stone copings on the rakes
  K.wall(B, WF(s0), K.rectPts(P.T_NORTH, footAt(s0 - 1, s0, P.T_NORTH, 0), 0, P.EAVES), [], 'brick');
  const fE = footAt(s1, s1 + 1, P.T_NORTH, 0);
  K.wall(B, EF(s1), K.rectPts(0, fE, -P.T_NORTH, P.EAVES), [], 'brick');
  B.push(EF(s1)); K.stringCourse(B, 'bathDress', -0.4, -P.T_NORTH + 0.3, P.EAVES, 0.3, 0.3); B.pop();
  for (const [west, F] of [[true, WF(s0)], [false, EF(s1)]]) {
    const xs = (t) => (west ? t : -t);
    B.push(F);
    band('bathDress', [[xs(P.T_NORTH - 0.25), P.EAVES - 0.1], [xs(tm), P.RIDGE + 0.05]], 0.22, 0.12, -0.3);
    band('bathDress', [[xs(tm), P.RIDGE + 0.05], [xs(P.T_WING + 0.25), P.EAVES - 0.1]], 0.22, 0.12, -0.3);
    B.pop();
  }
  // the ridge's stacks
  const yAt = (t) => P.EAVES + rise * (1 - Math.abs(t - tm) / (tm - P.T_NORTH));
  for (const c of P.CHIMNEYS) K.chimney(B, 'brick', c.s - P.CHIMNEY.w / 2, c.s + P.CHIMNEY.w / 2, c.t - P.CHIMNEY.d / 2, c.t + P.CHIMNEY.d / 2, yAt(c.t + P.CHIMNEY.d / 2) - 0.2, P.CHIMNEY.top, { capKey: 'bathDress', pots: 2 });
}
/** the lower east block with its canted bay under a pediment */
function eastBlock() {
  const E = P.EBLK, foot = footAt(E.s0, E.s1 + 1, E.t0, E.t1 + 1), tc = (E.t0 + E.t1) / 2, band1 = P.H(3.1);
  const ws = (x) => ({ pts: K.rectPts(x - 0.55, P.H(1.0), x + 0.55, P.H(2.6)), kind: 'win', lights: 2, glass: 'sash', d: 0.18 });
  const wf = (x) => ({ pts: K.rectPts(x - 0.55, P.H(3.7), x + 0.55, P.H(5.4)), kind: 'win', lights: 2, glass: 'sash', d: 0.18 });
  K.wall(B, SF(E.t1), K.rectPts(E.s0, foot, E.s1, E.top), [ws(78.05), wf(78.05)], 'brick');
  K.wall(B, NF(E.t0), K.rectPts(-E.s1, foot, -E.s0, E.top), [], 'brick');
  // the east face: plain either side of the canted bay
  const bw = E.cantW / 2 + E.cant * 0.45, x0 = -E.t1, x1 = -E.t0, xc = -tc;
  K.wall(B, EF(E.s1), K.rectPts(x0, foot, xc - bw, E.top), [], 'brick');
  K.wall(B, EF(E.s1), K.rectPts(xc + bw, foot, x1, E.top), [], 'brick');
  // the canted bay (plan in s, t)
  const pl = [[E.s1, tc + bw], [E.s1 + E.cant, tc + E.cantW / 2], [E.s1 + E.cant, tc - E.cantW / 2], [E.s1, tc - bw]];
  for (let i = 0; i < 3; i++) {
    const p = pl[i], q = pl[i + 1], len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = i === 1 ? 3 : 1, m = 0.18;
    K.wall(B, K.frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1]), K.rectPts(0, foot, len, E.top), [
      { pts: K.rectPts(m, P.H(0.9), len - m, P.H(2.6)), kind: 'win', lights: n, glass: 'leaded', d: 0.15, mullionW: 0.1 },
      { pts: K.rectPts(m, P.H(3.6), len - m, P.H(5.5)), kind: 'win', lights: n, transoms: [P.H(4.9)], glass: 'leaded', d: 0.15, mullionW: 0.1 }], 'brick');
  }
  K.prism(B, 'bathDress', [[E.s0, E.t0 - 0.1], [E.s1 + 0.1, E.t0 - 0.1], ...pl.slice().reverse().map(([a, b]) => [a + 0.1, b]), [E.s1 + 0.1, E.t1 + 0.1], [E.s0, E.t1 + 0.1]], E.top - 0.3, E.top, {});
  B.flat('lead', [[E.s0, E.t0], [E.s1, E.t0], [E.s1, tc - bw], [E.s1 + E.cant, tc - E.cantW / 2], [E.s1 + E.cant, tc + E.cantW / 2], [E.s1, tc + bw], [E.s1, E.t1], [E.s0, E.t1]], E.top - 0.05);
  // bands, and the pediment over the bay's front
  B.push(SF(E.t1)); K.stringCourse(B, 'bath', E.s0, E.s1, P.PLINTH, P.PLINTH - foot, 0.06); K.stringCourse(B, 'bathDress', E.s0, E.s1, band1, 0.2, 0.08); K.stringCourse(B, 'bathDress', E.s0, E.s1 + 0.1, E.top, 0.3, 0.25); B.pop();
  B.push(K.frame(E.s1 + E.cant, 0, tc + E.cantW / 2 + 0.2, 0, -1));
  const w = E.cantW + 0.4, tri = [[0, E.top], [w, E.top], [w / 2, E.ped]];
  B.face('brick', tri, [], 0); B.face('brick', tri, [], -0.3, true);
  band('bathDress', [[-0.15, E.top - 0.05], [w / 2, E.ped + 0.02], [w + 0.15, E.top - 0.05]], 0.2, 0.12, -0.35);
  K.stringCourse(B, 'bathDress', -0.15, w + 0.15, E.top + 0.05, 0.2, 0.15);
  B.pop();
  ctx.solid(P.F.ring([[E.s0, E.t0], [E.s1, E.t0], ...pl.slice().reverse(), [E.s1, E.t1], [E.s0, E.t1]]));
}

// ------------------------------------------------------------------------------------------------ steps, handrail
function steps() {
  const St = P.STEPS, T = P.T_FWD, gE = P.F.groundY(St.s1, T + St.n * St.going + 0.2), base = Math.min(gE, P.F.groundY(St.s0, T + St.n * St.going + 0.2)) - 0.35;
  K.steps(B, 'pavingSolid', St.s0, St.s1, T, 1, St.n, St.rise, St.going, P.FFL, base);
  // the loggia's floor inside the arcade and the landing before it
  B.box('pavingSolid', (P.FRONT[0] + P.FRONT[1]) / 2, (P.FFL + base) / 2, T - P.LOGGIA.glassBack / 2, P.FRONT[1] - P.FRONT[0] - 0.1, P.FFL - base, P.LOGGIA.glassBack, 0, {});
  const H = P.HANDRAIL, tB = T + St.n * St.going + 0.25, yB = P.F.groundY(H.s, tB);
  for (const [t, y] of [[T + 0.15, P.FFL], [tB, yB]]) B.cyl('zinc', H.s, y, t, 0.025, H.h + 0.02, 6, true);
  B.beam('zinc', [H.s, P.FFL + H.h, T + 0.15], [H.s, yB + H.h, tB], 0.05);
  B.beam('zinc', [H.s, P.FFL + H.h * 0.5, T + 0.15], [H.s, yB + H.h * 0.5, tB], 0.03);
  return (u, v) => { const [, t] = P.F.P(u, v); const i = Math.floor((t - T) / St.going); return i < 0 ? P.FFL : P.FFL - St.rise * (Math.min(i, St.n - 1) + 1); };
}

// ------------------------------------------------------------------------------------------------ Holtby
function holtby() {
  const Hh = P.HOL, s0 = Hh.s0, so = Hh.sOpen, s1 = Hh.s1, pitch = (s1 - so) / Hh.bays, bay = (k) => so + (k + 0.5) * pitch;
  const footS = footAt(so, s1, Hh.face, Hh.slab.t1 + 1.5), footW = footAt(s0, so, -1, 1), footN = footAt(s0, s1, P.T_NORTH - 1, P.T_NORTH);
  // the south front: the brick upper wall over the loggia (sOpen .. s1) and the stretch behind Park's wing (s0 .. sOpen)
  const ops = [];
  for (let k = 0; k < Hh.bays; k++) {
    const x = bay(k), W = k === Hh.bays - 1 ? Hh.stair : null;
    if (W) { ops.push({ pts: K.rectPts(x - W.w / 2, W.sill, x + W.w / 2, W.head), kind: 'win', glass: 'sash', d: 0.15, transoms: [5.75] , mullionKey: 'whitePaint', mullionW: 0.08 }); continue; }
    ops.push({ pts: K.rectPts(x - Hh.win1.w / 2, Hh.win1.sill, x + Hh.win1.w / 2, Hh.win1.head), kind: 'win', glass: 'sash', d: 0.15, sill: false });
    ops.push({ pts: K.rectPts(x - Hh.win2.w / 2, Hh.win2.sill, x + Hh.win2.w / 2, Hh.win2.head), kind: 'win', glass: 'sash', d: 0.15 });
  }
  K.wall(B, SF(Hh.face), K.rectPts(so, Hh.slab.bot, s1, Hh.top - 0.1), ops, 'brickWarm');
  K.wall(B, SF(0), K.rectPts(s0, footW, so, Hh.top - 0.1), [], 'brickWarm');
  K.wall(B, WF(so), K.rectPts(0, Hh.slab.top, Hh.face, Hh.top - 0.1), [], 'brickWarm');
  B.push(SF(Hh.face)); K.stringCourse(B, 'bathDress', so - 0.05, s1, Hh.top, 0.12, 0.06); B.pop();
  B.push(SF(0)); K.stringCourse(B, 'bathDress', s0, so + 0.05, Hh.top, 0.12, 0.06); B.pop();
  // the loggia: back wall (pale, glazed grids and round-arched openings), end walls, piers, the slab, the floor
  const bops = [];
  for (let k = 0; k < Hh.bays; k++) {
    const a = so + k * pitch;
    if (k === 0) { bops.push({ pts: K.rectPts(a + 0.55, Hh.ffl, a + 1.5, Hh.ffl + 2.15), kind: 'door', doorKey: 'doorOak', d: 0.12 }); continue; }
    bops.push({ pts: K.rectPts(a + 0.45, Hh.ffl + 0.25, a + 2.0, Hh.slab.bot - 0.3), kind: 'win', glass: 'glassDark', lights: 5, transoms: [Hh.ffl + 0.85, Hh.ffl + 1.45, Hh.ffl + 2.05], mullionKey: 'whitePaint', mullionW: 0.05, d: 0.12, sill: false });
    bops.push({ pts: K.archPts(a + 2.6, 0.8, Hh.ffl, Hh.ffl + 1.75, 8), kind: 'win', glass: 'glassDark', lights: 2, mullionKey: 'whitePaint', mullionW: 0.05, d: 0.25, sill: false });
  }
  K.wall(B, SF(Hh.back), K.rectPts(so, Hh.ffl - 0.3, s1, Hh.slab.bot + 0.01), bops, 'precast', { dress: 'precast' });
  B.push(SF(Hh.back));
  for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2 === 0) B.box('leadDark', so + 1.7 + i * 0.2, Hh.ffl + 0.6 + j * 0.25, 0.012, 0.09, 0.09, 0.02, 0, { top: false });
  B.pop();
  K.wall(B, EF(so), K.rectPts(-Hh.slab.t1, Hh.ffl - 0.3, -Hh.back, Hh.slab.bot), [], 'precast');
  K.wall(B, WF(s1), K.rectPts(Hh.back, Hh.ffl - 0.3, Hh.face, Hh.slab.bot), [], 'precast');
  for (let k = 1; k < Hh.bays; k++) B.box('bath', so + k * pitch, (Hh.ffl + Hh.slab.bot) / 2, Hh.pier.t, Hh.pier.w, Hh.slab.bot - Hh.ffl, Hh.pier.w, 0, {});
  B.box('bath', so + Hh.pier.w / 2, (Hh.ffl + Hh.slab.bot) / 2, Hh.pier.t, Hh.pier.w, Hh.slab.bot - Hh.ffl, Hh.pier.w, 0, {});      // the west pier, against Park's wing
  B.box('precast', (so + s1) / 2, (Hh.slab.bot + Hh.slab.top) / 2, (Hh.back + Hh.slab.t1) / 2, s1 - so, Hh.slab.top - Hh.slab.bot, Hh.slab.t1 - Hh.back, 0, { bottom: true });
  B.box('pavingSolid', (so + s1) / 2, (Hh.ffl + footS) / 2, (Hh.back + Hh.slab.t1) / 2, s1 - so, Hh.ffl - footS, Hh.slab.t1 - Hh.back, 0, {});
  // the globe lamps hung from the soffit, one a bay
  for (let k = 0; k < Hh.bays - 1; k++) {
    const x = bay(k) - (k === 0 ? 0.3 : 0), t = (Hh.back + Hh.face) / 2, y = Hh.slab.bot - 0.55;
    B.cyl('ironBlack', x, y + 0.18, t, 0.012, Hh.slab.bot - y - 0.18, 4, false);
    B.cyl('lampGlass', x, y, t, 0.13, 0.12, 8, false, 0.17); B.cyl('lampGlass', x, y - 0.12, t, 0.17, 0.12, 8, false, 0.13);
    B.cyl('lampGlass', x, y + 0.12, t, 0.06, 0.06, 8, true, 0.13); B.cyl('lampGlass', x, y - 0.18, t, 0.13, 0.06, 8, false, 0.05);
    const l = P.F.L(x, t); ctx.lamp(l[0], y, l[1]);
  }
  // the balcony's light iron railing on the slab's edge: rails, posts and a lattice
  const tr = Hh.slab.t1 - 0.08, yb = Hh.slab.top, yt = yb + Hh.rail;
  B.box('ironBlack', (so + s1) / 2, yt, tr, s1 - so - 0.2, 0.04, 0.05, 0, { bottom: true });
  B.box('ironBlack', (so + s1) / 2, yb + 0.1, tr, s1 - so - 0.2, 0.03, 0.03, 0, { bottom: true });
  for (let x = so + 0.1; x <= s1 - 0.05; x += pitch / 2) B.box('ironBlack', x, (yb + yt) / 2, tr, 0.03, yt - yb, 0.03, 0, {});
  for (let x = so + 0.1; x < s1 - 0.6; x += 0.5) {
    B.beam('ironBlack', [x, yb + 0.1, tr], [x + 0.5, yt - 0.02, tr], 0.014);
    B.beam('ironBlack', [x + 0.5, yb + 0.1, tr], [x, yt - 0.02, tr], 0.014);
  }
  // the north face (buff brick, white sashes) and the west party wall
  const nops = [];
  for (const s of Hh.north) for (const [y0, y1] of [[Hh.ffl + 0.95, Hh.ffl + 2.6], [3.6, 5.1], [6.55, 8.1]]) nops.push({ pts: K.rectPts(-s - 0.55, y0, -s + 0.55, y1), kind: 'win', glass: 'sash', d: 0.15 });
  K.wall(B, NF(P.T_NORTH), K.rectPts(-s1, footN, -s0, Hh.top - 0.1), nops, 'brickBuff');
  B.push(NF(P.T_NORTH)); K.stringCourse(B, 'bathDress', -s1, -s0, Hh.top, 0.12, 0.06); B.pop();
  K.wall(B, WF(s0), K.rectPts(P.T_NORTH, Math.min(footW, footN), 0, Hh.top - 0.1), [], 'brickWarm');
  // the pitched clay-tile roof behind the parapets with its glazed ridge, the parapets' backs
  const z0 = P.T_NORTH + 0.25, z1 = 2 * Hh.ridgeT - z0, rise = Hh.ridge - Hh.roofFoot;
  K.roof(B, 'clayTile', s0, s1, z0, z1, Hh.roofFoot, rise, { axis: 'x', ends: ['gable', 'open'], ov: 0, wallKey: 'brickWarm' });
  const slope = rise / (Hh.ridgeT - z0);
  for (const sg of [-1, 1]) B.poly('glassRoof', [[so + 0.5, Hh.ridge + 0.03, Hh.ridgeT], [s1 - 1.0, Hh.ridge + 0.03, Hh.ridgeT], [s1 - 1.0, Hh.ridge + 0.03 - 0.7 * slope, Hh.ridgeT + sg * 0.7], [so + 0.5, Hh.ridge + 0.03 - 0.7 * slope, Hh.ridgeT + sg * 0.7]], [0, 1, sg]);
  B.box('leadDark', (so + s1) / 2 - 0.25, Hh.ridge + 0.06, Hh.ridgeT, s1 - so - 1.5, 0.08, 0.12, 0, {});
  K.parapet(B, 'brickWarm', [[s0, P.T_NORTH + 0.15], [s1, P.T_NORTH + 0.15]], Hh.roofFoot - 0.2, Hh.top - 0.1 - Hh.roofFoot + 0.2, 0.3);
  K.parapet(B, 'brickWarm', [[so, Hh.face - 0.15], [s1, Hh.face - 0.15]], Hh.roofFoot - 0.2, Hh.top - 0.1 - Hh.roofFoot + 0.2, 0.3);
  const C = Hh.chimney; K.chimney(B, 'brickWarm', C.s - 0.6, C.s + 0.6, C.t - 0.4, C.t + 0.4, Hh.roofFoot, C.top, { capKey: 'bathDress', pots: 2 });
  // colliders: the closed block, and each pier
  ctx.solid(P.F.ring([[s0, P.T_NORTH], [s1, P.T_NORTH], [s1, Hh.back], [so, Hh.back], [so, 0], [s0, 0]]));
  for (let k = 1; k < Hh.bays; k++) { const x = so + k * pitch, w = Hh.pier.w / 2; ctx.solid(P.F.ring(R(x - w, x + w, Hh.pier.t - w, Hh.pier.t + w))); }
  { const w = Hh.pier.w / 2; ctx.solid(P.F.ring(R(so, so + 2 * w, Hh.pier.t - w, Hh.pier.t + w))); }
  ctx.floor(P.F.ring(R(so, s1, Hh.back, Hh.slab.t1)), Hh.ffl);
}

// ------------------------------------------------------------------------------------------------ the ground at the walls (draped: LOCAL)
function ground(stepFloor) {
  const { G } = ctx, Fr = P.F;
  // the planted strips before the wings and pavilions (lavender, the magnolias' beds), to the path
  for (const [a, b, t] of [[P.PAV_W[0] + 0.05, P.PAV_W[1], P.T_FWD], [P.WING_W[0], P.STEPS.s0, P.T_WING], [P.STEPS.s1, P.WING_E[1], P.T_WING], [P.PAV_E[0], P.PAV_E[1], P.T_FWD]]) {
    G.drape(B, 'flowerbed', Fr.ring(R(a, b, t, P.BED_T)), 0.08);
    G.edgeDown(B, 'soil', Fr.ring(R(a, b, t, P.BED_T)), 0.08, 0.12);
  }
  // the flagged apron before Holtby's loggia: from the loggia's floor down to the ground at the path
  const Hh = P.HOL, yA = (u, v) => { const [, t] = Fr.P(u, v), a = Math.max(0, Math.min(1, (t - Hh.slab.t1) / (P.APRON_T - Hh.slab.t1))); return Hh.ffl * (1 - a) + (S.groundY(u, v) + 0.07) * a; };
  const apron = Fr.ring(R(Hh.sOpen, P.S_LIB0 - 0.05, Hh.slab.t1, P.APRON_T));
  G.drape(B, 'paving', apron, 0, { y: yA }); G.edgeDown(B, 'pavingSolid', apron, 0, 0.5, { y: yA });
  ctx.floor(apron, yA);
  // the narrow gap between the range and ROQ West
  G.drape(B, 'gravel', Fr.ring(R(Hh.s0 + 9.5, P.EBLK.s1, P.T_ROQ, P.T_NORTH)), 0.07);
  // the steps and the loggia's floor
  ctx.floor(Fr.ring(R(P.STEPS.s0, P.STEPS.s1, P.T_FWD - P.LOGGIA.glassBack, P.T_FWD + P.STEPS.n * P.STEPS.going)), stepFloor);
}
let S = null;

// ------------------------------------------------------------------------------------------------ the part
export function buildLibrary(c) {
  ctx = c; K = c.K; B = c.B; S = c.S;
  const n0 = B.tris();
  B.push(P.F.M);
  pavilion(P.PAV_W[0], P.PAV_W[1], P.BAYS_PAV_W, P.PILASTERS_W, P.HOL.face, P.T_WING, false);
  wing(P.WING_W[0], P.WING_W[1], P.BAYS_WING_W);
  const fr = frontispiece();
  wing(P.WING_E[0], P.WING_E[1], P.BAYS_WING_E);
  pavilion(P.PAV_E[0], P.PAV_E[1], P.BAYS_PAV_E, P.PILASTERS_E, P.T_WING, P.EBLK.t1, true);
  northFace(P.S_LIB0, P.S_LIB1, P.BAYS_NORTH);
  roofAndEnds();
  eastBlock();
  const stepFloor = steps();
  // the planter wall at the east end (brick, raised bed)
  const Pl = P.PLANTER, gy = [P.F.groundY(Pl.s0, Pl.t), P.F.groundY(Pl.s1, Pl.t), P.F.groundY(Pl.s1, P.EBLK.t1)];
  K.parapet(B, 'brick', [[Pl.s0, Pl.t], [Pl.s1, Pl.t], [Pl.s1, P.EBLK.t1 - 0.1]], Math.min(...gy) - 0.2, Math.max(...gy) + Pl.h - Math.min(...gy) + 0.2, Pl.w, { coping: 'brickDark' });
  const nLib = B.tris() - n0;
  holtby();
  B.pop();
  ground(stepFloor);
  { const Pl2 = P.PLANTER; ctx.G.drape(B, 'flowerbed', P.F.ring(R(P.S_LIB1 + 0.02, Pl2.s1 - Pl2.w / 2, P.EBLK.t1 + 0.02, Pl2.t - Pl2.w / 2)), Pl2.h - 0.1, { y: (u, v) => Math.max(...gy) }); }
  // colliders: the Library's closed block (the loggia glazed: its wall is the glazing line), the steps' cheeks are open
  const T = P.T_FWD, gb = T - P.LOGGIA.glassBack;
  ctx.solid(P.F.ring([[P.S_LIB0, P.T_NORTH], [P.S_LIB1, P.T_NORTH], [P.S_LIB1, T], [P.PAV_E[0], T], [P.PAV_E[0], P.T_WING], [P.FRONT[1], P.T_WING], [P.FRONT[1], T], [P.FRONT[1] - 0.6, T], [P.FRONT[1] - 0.6, gb], [P.FRONT[0] + 0.6, gb], [P.FRONT[0] + 0.6, T], [P.FRONT[0], T], [P.FRONT[0], P.T_WING], [P.PAV_W[1], P.T_WING], [P.PAV_W[1], T], [P.S_LIB0, T]]));
  for (const x of fr.piers) ctx.solid(P.F.ring(R(x - 0.55, x + 0.55, gb, T + 0.12)));
  { const q = P.F.ring([[P.PLANTER.s0, P.PLANTER.t], [P.PLANTER.s1, P.PLANTER.t], [P.PLANTER.s1, P.EBLK.t1]]); ctx.seg(q[0][0], q[0][1], q[1][0], q[1][1]); ctx.seg(q[1][0], q[1][1], q[2][0], q[2][1]); }
  return { libraryTris: Math.round(nLib), totalTris: Math.round(B.tris() - n0) };
}
