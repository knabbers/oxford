// Exeter College, STANDALONE model: THE CHAPEL's build functions. Called by exeter_chapel.js with ctx.B already in the
// college's LOCAL frame (x = u east, z = v south, y up from the datum). Every dimension is a named constant in
// _exeter_chapel_plan.js (with its source and K / G mark). Helpers the kit does not have (written here, not in the kit):
// bar (a flat-faced tracery bar in a wall frame), slab (a coping along a rake), circle outlines, regular polygons with
// their face frames, a crocketed gabled pinnacle, a faceted cone that leaves one side open, a draped statue block.
import * as P from './_exeter_chapel_plan.js';
import * as IK from './_exeter_interior_kit.js';
import { chapelBeds } from './_exeter_plants.js';
import { groundY as mqGround } from './_exeter_margary_plan.js';      // (Margary Quad's ground: read, not edited)

const D2R = Math.PI / 180;
let K = null;      // the kit (set by buildChapel)

// ------------------------------------------------------------------------------------------------ small helpers
/** a circle outline (CCW) centred (x, y) in the current wall frame */
const circ = (x, y, r, n = 8, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2; return [x + Math.cos(a) * r, y + Math.sin(a) * r]; });
/** a regular polygon in plan (vertices rot + i * 360 / n degrees from +u towards +v), circumradius R */
const ngon = (cu, cv, R, n = 8, rotDeg = 22.5) => Array.from({ length: n }, (_, i) => { const a = (rotDeg + (i * 360) / n) * D2R; return [cu + Math.cos(a) * R, cv + Math.sin(a) * R]; });
/** a wall frame standing at plan point (u, v) whose outward normal is (nu, nv) */
const ff = (u, v, nu, nv) => K.frame(u, 0, v, nv, -nu);
/** the face frames of a plan ring round centre c: [{ F, L, n: [nu, nv] }] (s runs so the normal points away from c) */
function faceFrames(ring, c) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    let p = ring[i], q = ring[(i + 1) % ring.length];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); let tx = (q[0] - p[0]) / L, tz = (q[1] - p[1]) / L;
    let nu = -tz, nv = tx; const mx = (p[0] + q[0]) / 2 - c[0], mz = (p[1] + q[1]) / 2 - c[1];
    if (nu * mx + nv * mz < 0) { [p, q] = [q, p]; tx = -tx; tz = -tz; nu = -nu; nv = -nv; }
    out.push({ F: K.frame(p[0], 0, p[1], tx, tz), L, n: [nu, nv], p, q });
  }
  return out;
}
/** a tracery bar in the current wall frame from a to b ([s, y]), w wide, its face at z0 standing d deep (front + 2 sides) */
function bar(B, key, a, b, w, z0, d) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1e-4) return;
  const px = (-dy / L) * (w / 2), py = (dx / L) * (w / 2), z1 = z0 - d;
  B.poly(key, [[a[0] + px, a[1] + py, z0], [a[0] - px, a[1] - py, z0], [b[0] - px, b[1] - py, z0], [b[0] + px, b[1] + py, z0]], [0, 0, 1]);
  B.poly(key, [[a[0] + px, a[1] + py, z0], [b[0] + px, b[1] + py, z0], [b[0] + px, b[1] + py, z1], [a[0] + px, a[1] + py, z1]], [px, py, 0]);
  B.poly(key, [[a[0] - px, a[1] - py, z0], [b[0] - px, b[1] - py, z0], [b[0] - px, b[1] - py, z1], [a[0] - px, a[1] - py, z1]], [-px, -py, 0]);
  // (interior pass) tracery reaching through the glass (behind GLASS_Z) shows its back to the room: the dark leading
  // and stone of the window seen from inside
  if (z1 < -P.GLASS_Z) B.poly(key, [[a[0] + px, a[1] + py, z1], [a[0] - px, a[1] - py, z1], [b[0] - px, b[1] - py, z1], [b[0] + px, b[1] + py, z1]], [0, 0, -1]);
}
/** a polyline of bars */
const bars = (B, key, pts, w, z0, d, closed = false) => { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) bar(B, key, pts[i], pts[(i + 1) % pts.length], w, z0, d); };
/** a foiled circle: a ring of bars with n cusps pointing in */
function foiled(B, key, x, y, r, foils, w, z0, d, seg = 10) {
  bars(B, key, circ(x, y, r, seg), w, z0, d, true);
  for (let i = 0; i < foils; i++) { const a = Math.PI / 2 + (i / foils) * Math.PI * 2 + Math.PI / foils; bar(B, key, [x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62], w * 0.8, z0, d); }
}
/** a coping along a rake from a to b ([s, y]) in the current wall frame: h thick, from z0 (front) back to z1 */
function slab(B, key, a, b, h, z0, z1) {
  const A = [a[0], a[1] + h], Bt = [b[0], b[1] + h], nx = -(b[1] - a[1]), ny = b[0] - a[0];
  B.poly(key, [[A[0], A[1], z0], [Bt[0], Bt[1], z0], [Bt[0], Bt[1], z1], [A[0], A[1], z1]], [nx * Math.sign(ny || 1), Math.abs(ny), 0]);
  B.poly(key, [[a[0], a[1], z0], [b[0], b[1], z0], [Bt[0], Bt[1], z0], [A[0], A[1], z0]], [0, 0, 1]);
  B.poly(key, [[a[0], a[1], z1], [b[0], b[1], z1], [Bt[0], Bt[1], z1], [A[0], A[1], z1]], [0, 0, -1]);
}
/** the arc part of a pointed arch (springing to springing over the apex) for a hood mould */
const arcOf = (x, w, ys, rise, seg = 6) => K.pointedPts(x, w, ys - 1, ys, rise, seg).slice(2);
/** a crocketed, gabled square pinnacle in the current frame at (x, z): shaft y0..y1 w wide, gablets on its four faces,
 *  a spire to `tip` with three crockets on each arris and a finial */
function pinn(B, key, x, z, y0, y1, w, tip) {
  const h = w / 2;
  B.box(key, x, (y0 + y1) / 2, z, w, y1 - y0, w, 0, { top: false });
  const g = Math.min(0.55, (tip - y1) * 0.35);
  for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {      // the gablets, standing on the shaft's faces
    const cx = x + sx * (h + 0.01), cz = z + sz * (h + 0.01), ax = sz !== 0 ? 1 : 0, az = sx !== 0 ? 1 : 0;
    B.poly(key, [[cx - ax * h, y1, cz - az * h], [cx + ax * h, y1, cz + az * h], [cx, y1 + g, cz]], [sx, 0, sz]);
  }
  K.coneRoof(B, key, [[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]], y1, [x, z], tip - y1);
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (const t of [0.25, 0.5, 0.75]) {
    const yy = y1 + (tip - y1) * t, rr = h * (1 - t) + 0.07;
    B.box(key, x + cx * rr, yy, z + cz * rr, 0.09, 0.12, 0.09);
  }
  B.box(key, x, tip + 0.12, z, 0.07, 0.24, 0.07);
}
/** a plain draped standing figure on a corbel (no likeness): in the current frame, feet at (x, y, z), height h */
function statue(B, key, x, y, z, h) {
  B.box('bathDress', x, y - 0.17, z, 0.62, 0.34, 0.56, 0, { bottom: true });            // the corbel
  B.cyl(key, x, y, z, 0.2, h * 0.7, 8, true, 0.28);                                     // the draped body
  B.box(key, x, y + h * 0.74, z, 0.5, h * 0.1, 0.3);                                    // the shoulders
  B.cyl(key, x, y + h * 0.79, z, 0.1, h * 0.19, 6, true, 0.12);                          // the head
}
/** fan of triangles from consecutive points of an OPEN plan polyline (at level y) to an apex (a faceted half-cone) */
function fan(B, key, line, y, apex, ay) {
  for (let i = 0; i < line.length - 1; i++) {
    const p = line[i], q = line[i + 1], mx = (p[0] + q[0]) / 2 - apex[0], mz = (p[1] + q[1]) / 2 - apex[1];
    B.poly(key, [[p[0], y, p[1]], [q[0], y, q[1]], [apex[0], ay, apex[1]]], [mx, 1, mz]);
  }
}

// ------------------------------------------------------------------------------------------------ windows
const TD = 0.31;      // (interior pass) the tracery's depth: from 0.12 inside the face through the glass (0.4) to 0.43
/** a 3-light nave window at s = x in the current wall frame: mullions, light heads, three foiled circles, hood */
function tracery3(B, x, W) {
  const k = 'bathDress', z0 = -0.12, d = TD, w3 = W.w / 3, sp = W.spring;
  for (const m of [-1, 1]) bar(B, k, [x + (m * W.w) / 6, W.sill], [x + (m * W.w) / 6, sp + 0.2], 0.14, z0, d);
  for (let i = 0; i < 3; i++) { const a = x - W.w / 2 + i * w3, b = a + w3, c = (a + b) / 2; bars(B, k, [[a, sp + 0.05], [c, sp + 0.62], [b, sp + 0.05]], 0.09, z0, d); }
  foiled(B, k, x, 12.55, 0.62, 4, 0.1, z0, d);
  foiled(B, k, x - 0.62, 11.3, 0.4, 3, 0.09, z0, d, 8);
  foiled(B, k, x + 0.62, 11.3, 0.4, 3, 0.09, z0, d, 8);
  bars(B, k, arcOf(x, W.w + 0.42, sp, W.apex - sp + 0.25), 0.18, 0.1, 0.12);
}
/** a 2-light apse window: one mullion, two heads, a foiled circle, hood */
function tracery2(B, x, W) {
  const k = 'bathDress', z0 = -0.1, d = TD + 0.02, sp = W.spring;
  bar(B, k, [x, W.sill], [x, sp + 0.25], 0.14, z0, d);
  for (const [a, b] of [[x - W.w / 2, x], [x, x + W.w / 2]]) bars(B, k, [[a, sp + 0.05], [(a + b) / 2, sp + 0.7], [b, sp + 0.05]], 0.09, z0, d);
  foiled(B, k, x, sp + 1.85, 0.5, 4, 0.09, z0, d, 8);
  bars(B, k, arcOf(x, W.w + 0.4, sp, W.apex - sp + 0.22), 0.16, 0.1, 0.12);
}
/** a wheel window: ring, hub, six spokes, six foiled petals */
function wheel(B, x, y, r, z0) {
  const k = 'bathDress', d = TD;
  bars(B, k, circ(x, y, r, 16), 0.16, z0, d, true);
  bars(B, k, circ(x, y, r * 0.2, 8), 0.1, z0, d, true);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i / 6) * Math.PI * 2, b = a + Math.PI / 6;
    bar(B, k, [x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2], [x + Math.cos(a) * r, y + Math.sin(a) * r], 0.1, z0, d);
    foiled(B, k, x + Math.cos(b) * r * 0.58, y + Math.sin(b) * r * 0.58, r * 0.3, 3, 0.08, z0, d, 8);
  }
}
/** the openings of a side wall: windows at s positions; returns the ops for K.wall and draws the tracery afterwards */
// (interior pass) the windows are OPEN (kind 'void') with real stained glass 0.4 inside the face (IK.StainedGlazing); the
// room's splays behind the glass are part 'chapelint'
const winPts = (x, W) => K.pointedPts(x, W.w, W.sill, W.spring, W.apex - W.spring, 8);
const winOp = (x, W) => ({ pts: winPts(x, W), kind: 'void', d: P.GLASS_D });
let GL = null;      // the part's StainedGlazing (set by buildChapel)
/** the glass of a window in frame F (pushed on B) at s = x, and its projecting sill */
function glaze(B, F, x, W, sill = true) {
  GL.pane(F, winPts(x, W), -P.GLASS_Z);
  if (sill) B.box('bathDress', x, W.sill - 0.07, 0.07, W.w + 0.2, 0.14, 0.14, 0, { bottom: true });
}

/** a side wall of the vessel in frame F, L long: wall, plinth, sill string, frieze, cornice, pierced parapet */
function sideWall(B, F, L, key, ops, after, gaps = []) {
  K.wall(B, F, K.rectPts(0, P.FOOT, L, P.CORNICE), ops, key);
  B.push(F);
  // the plinth and the sill string, broken where an opening (the porch's doorway) passes through the wall: gaps [[s0, s1]]
  let x0 = 0;
  for (const [g0, g1] of [...gaps, [L, L]]) { if (g0 > x0) { K.stringCourse(B, 'bathDress', x0, g0, P.PLINTH, 0.3, 0.15); K.stringCourse(B, 'bathDress', x0, g0, P.SILL_STRING, 0.16, 0.12); } x0 = g1; }
  B.box('bathDress', L / 2, (P.FRIEZE[0] + P.FRIEZE[1]) / 2, 0.05, L, P.FRIEZE[1] - P.FRIEZE[0], 0.1, 0, { bottom: true });
  B.box('bathDress', L / 2, (P.FRIEZE[1] + P.CORNICE) / 2, 0.12, L, P.CORNICE - P.FRIEZE[1], 0.24, 0, { bottom: true });
  // the pierced parapet: a face with round piercings, their reveals, a plain back, a coping
  const yb = P.CORNICE, yt = P.PARAPET - 0.1, holes = [], n = Math.max(1, Math.floor((L - 0.4) / 0.6));
  for (let i = 0; i < n; i++) holes.push(circ(0.2 + ((i + 0.5) * (L - 0.4)) / n, (yb + yt) / 2, 0.16, 6, Math.PI / 6));
  B.face('bathDress', K.rectPts(0, yb, L, yt), holes, 0.08);
  for (const h of holes) B.reveal('bathDress', h, 0.08, -0.22);
  B.face('bathDress', K.rectPts(0, P.ROOF_FOOT - 0.05, L, yt), [], -0.22, true);
  B.box('bathDress', L / 2, yt + 0.05, -0.07, L, 0.1, 0.42);
  if (after) after();
  B.pop();
}

// ------------------------------------------------------------------------------------------------ buttresses
function buttress(B, u, v, nu, nv, o = {}) {
  const T = P.BUTTRESS, w = o.w ?? T.w, stages = o.stages || T.stages;
  B.push(ff(u, v, nu, nv));
  K.buttress(B, 'bath', 0, P.FOOT, w, stages);
  B.box('bath', 0, (T.stages[3][0] + P.CORNICE) / 2, T.pier / 2, w * 0.72, P.CORNICE - T.stages[3][0], T.pier, 0, { top: false });
  if (o.statue !== false) {
    B.face('bathOld', K.rectPts(-0.42, T.statue[0], 0.42, T.canopy[0]), [], T.pier + 0.01);      // the niche's shadowed back
    statue(B, 'statue', 0, T.statue[0], 0.74, T.statue[1] - T.statue[0]);
    B.box('bathDress', 0, (T.canopy[0] + T.canopy[0] + 0.55) / 2, 0.62, 0.78, 0.55, 0.62);
    B.poly('bathDress', [[-0.39, T.canopy[0] + 0.55, 0.94], [0.39, T.canopy[0] + 0.55, 0.94], [0, T.canopy[1], 0.94]], [0, 0, 1]);
  }
  B.box('bath', 0, (T.canopy[0] + T.pin[0]) / 2, 0.35, T.pinW, T.pin[0] - T.canopy[0], 0.7, 0, { top: false });
  pinn(B, 'bathDress', 0, 0.35, T.pin[0], T.pin[1], T.pinW, T.pin[2]);
  B.pop();
  // collider: the buttress's foot in plan
  const tu = nv, tv = -nu, h = w / 2, p = stages[0][1];
  return [[u - tu * h, v - tv * h], [u + tu * h, v + tv * h], [u + tu * h + nu * p, v + tv * h + nv * p], [u - tu * h + nu * p, v - tv * h + nv * p]];
}

// ------------------------------------------------------------------------------------------------ the whole chapel
export function buildChapel(ctx) {
  K = ctx.K;
  const { B } = ctx;
  GL = new IK.StainedGlazing();
  K.addCell(ctx.pack, 'chapelSlate', 'slate', [0.78, 0.9, 0.84]);      // the grey-green Welsh slate
  K.addCell(ctx.pack, 'statue', 'stone', [1.28, 1.26, 1.2], { seed: 0 });      // the statues: paler, cleaner stone (photographs)
  const solids = [];
  const L = P.JUNCTION - P.WEST;

  // ---- SOUTH wall (faces the Front Quad), s = u - WEST
  {
    const F = K.frame(P.WEST, 0, P.WALL_S, 1, 0), R = P.ROSE, rs = P.ROSE_U - P.WEST;
    const ops = P.WINDOW_U.map((u) => winOp(u - P.WEST, P.WIN));
    ops.push({ pts: K.pointedPts(rs, R.w, R.low, R.spring, R.apex - R.spring, 8), kind: 'void', d: P.GLASS_D });
    // the porch's inner order passes through the wall to the door (set in the wall's thickness): its hole
    const Q = P.PORCH, o = Q.orders[Q.orders.length - 1], uc = (Q.u0 + Q.u1) / 2;
    ops.push({ pts: K.pointedPts(uc - P.WEST, o.w, -0.45, Q.arch.spring, o.apex - Q.arch.spring, 8), kind: 'none' });
    sideWall(B, F, L, 'bath', ops, () => {
      for (const u of P.WINDOW_U) { tracery3(B, u - P.WEST, P.WIN); glaze(B, F, u - P.WEST, P.WIN); }
      GL.pane(F, K.pointedPts(rs, R.w, R.low, R.spring, R.apex - R.spring, 8), -P.GLASS_Z);
      wheel(B, rs, R.cy, R.r, -0.12);
      bar(B, 'bathDress', [rs, R.low], [rs, R.transom], 0.14, -0.12, TD);
      bar(B, 'bathDress', [rs - R.w / 2, R.transom], [rs + R.w / 2, R.transom], 0.12, -0.12, TD);
      bars(B, 'bathDress', arcOf(rs, R.w + 0.42, R.spring, R.apex - R.spring + 0.25), 0.18, 0.1, 0.12);
    }, [[uc - P.WEST - o.w / 2 - 0.02, uc - P.WEST + o.w / 2 + 0.02]]);
  }
  // ---- NORTH wall (faces Margary Quad), s = JUNCTION - u; the west bay plain (G: behind the Thomas Wood Building)
  {
    const F = K.frame(P.JUNCTION, 0, P.WALL_N, -1, 0);
    sideWall(B, F, L, 'bathOld', P.WINDOW_U.map((u) => winOp(P.JUNCTION - u, P.WIN)), () => { for (const u of P.WINDOW_U) { tracery3(B, P.JUNCTION - u, P.WIN); glaze(B, F, P.JUNCTION - u, P.WIN); } });
  }
  // ---- the APSE: five facets
  for (let i = 0; i < 5; i++) {
    const a = P.apsePt(P.APSE.angs[i]), b = P.apsePt(P.APSE.angs[i + 1]), Lf = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const F = K.frame(a[0], 0, a[1], (b[0] - a[0]) / Lf, (b[1] - a[1]) / Lf);
    sideWall(B, F, Lf, i >= 3 ? 'bathOld' : 'bath', [winOp(Lf / 2, P.APSE_WIN)], () => { tracery2(B, Lf / 2, P.APSE_WIN); glaze(B, F, Lf / 2, P.APSE_WIN); });
  }
  // ---- WEST gable (to Turl Street, behind the west range): s = v - WALL_N
  {
    const W = P.WEST_GABLE, Lw = P.WALL_S - P.WALL_N, m = Lw / 2, top = P.RIDGE + W.coping;
    const F = K.frame(P.WEST, 0, P.WALL_N, 0, 1);
    const outline = [[0, P.FOOT], [Lw, P.FOOT], [Lw, P.PARAPET], [Lw - 0.9, P.PARAPET], [m, top], [0.9, P.PARAPET], [0, P.PARAPET]];
    const sunk = (x, y, r) => ({ pts: circ(x, y, r, 10), kind: 'void', d: 0.12 });
    const ops = [
      { pts: K.pointedPts(m, W.win.w, W.win.sill, W.win.spring, W.win.apex - W.win.spring, 8), kind: 'win', glass: 'leaded', d: 0.4 },
      { pts: circ(m, W.rose.cy, W.rose.r, 14), kind: 'void', d: P.GLASS_D },
      sunk(m, W.oculus[0], W.oculus[1]), ...W.roundels.map(([dx, y, r]) => sunk(m + dx, y, r)),
    ];
    K.wall(B, F, outline, ops, 'bath');
    B.push(F);
    for (const [x, y, r] of [[m, W.oculus[0], W.oculus[1]], ...W.roundels.map(([dx, y, r]) => [m + dx, y, r])]) { B.face('bathDress', circ(x, y, r, 10), [], -0.12); foiled(B, 'bathDress', x, y, r * 0.8, 4, 0.06, 0.0, 0.1, 8); }
    // the window's head: mullion, two heads, a foiled circle
    bar(B, 'bathDress', [m, W.win.sill], [m, W.win.spring + 0.2], 0.13, -0.1, 0.2);
    for (const [a, b] of [[m - W.win.w / 2, m], [m, m + W.win.w / 2]]) bars(B, 'bathDress', [[a, W.win.spring + 0.05], [(a + b) / 2, W.win.spring + 0.6], [b, W.win.spring + 0.05]], 0.08, -0.1, 0.2);
    foiled(B, 'bathDress', m, W.win.spring + 1.0, 0.36, 4, 0.08, -0.1, 0.2, 8);
    bars(B, 'bathDress', arcOf(m, W.win.w + 0.36, W.win.spring, W.win.apex - W.win.spring + 0.2), 0.15, 0.1, 0.12);
    wheel(B, m, W.rose.cy, W.rose.r, -0.12);
    GL.pane(F, circ(m, W.rose.cy, W.rose.r, 14), -P.GLASS_Z);
    K.stringCourse(B, 'bathDress', 0, Lw, P.CORNICE, 0.3, 0.2);
    K.stringCourse(B, 'bathDress', 0, Lw, P.PLINTH, 0.3, 0.15);
    // the coping along both rakes and the gable's back above the roof; the cross
    slab(B, 'bathDress', [Lw - 0.9, P.PARAPET], [m, top], 0.3, 0.15, -P.THICK - 0.1);
    slab(B, 'bathDress', [m, top], [0.9, P.PARAPET], 0.3, 0.15, -P.THICK - 0.1);
    B.box('bathDress', Lw - 0.45, P.PARAPET + 0.15, -0.45, 0.95, 0.3, 1.1);
    B.box('bathDress', 0.45, P.PARAPET + 0.15, -0.45, 0.95, 0.3, 1.1);
    B.face('bath', [[Lw - 0.9, P.PARAPET - 1.2], [Lw - 0.9, P.PARAPET], [m, top], [0.9, P.PARAPET], [0.9, P.PARAPET - 1.2]], [], -P.THICK, true);
    B.box('bathDress', m, top + 0.3 + W.cross / 2, -0.45, 0.16, W.cross, 0.16);
    B.box('bathDress', m, top + 0.3 + W.cross * 0.68, -0.45, 0.7, 0.15, 0.16);
    B.pop();
  }
  // ---- buttresses (with statues, canopies and pinnacles)
  for (const u of P.BUTTRESS_U) { solids.push(buttress(B, u, P.WALL_S, 0, 1)); solids.push(buttress(B, u, P.WALL_N, 0, -1)); }
  {
    const ang = P.APSE.angs, normal = (deg) => [Math.cos(deg * D2R), Math.sin(deg * D2R)];
    const mid = (i) => (ang[i] + ang[i + 1]) / 2;
    const at = [[ang[0], (90 + mid(0)) / 2], [ang[1], ang[1]], [ang[2], ang[2]], [ang[3], ang[3]], [ang[4], ang[4]], [ang[5], (-90 + mid(4)) / 2]];
    for (const [pd, nd] of at) { const p = P.apsePt(pd), n = normal(nd); solids.push(buttress(B, p[0], p[1], n[0], n[1], { w: 1.2, stages: P.BUTTRESS.apseStages })); }
    // the north-west angle: no diagonal buttress (the covered way passes behind it) but the solid corner mass the BGS
    // 2018 plan draws, between the north wall and the Thomas Wood Building, carried up to the parapet with a lead top
    const M = P.NW_MASS, ring = [[M.u0, M.v0], [M.u1, M.v0], [M.u1, P.WALL_N], [M.u0, P.WALL_N]];
    K.prism(B, 'bathOld', ring, P.FOOT, P.PARAPET - 0.1, {});
    B.flat('lead', ring, P.PARAPET - 0.1);
    solids.push(ring);
  }
  buildAprons(ctx);
  buildNorthProjection(ctx, solids);
  buildBeds(ctx);

  // ---- ROOF: the long slate roof, the apse's half-cone, the lid behind the parapets, the ridge roll, the iron finial
  {
    const vS = P.VC + (P.HALF - P.ROOF_INSET), vN = P.VC - (P.HALF - P.ROOF_INSET), rise = P.RIDGE - P.ROOF_FOOT, x0 = P.WEST + 0.5;
    K.roof(B, 'chapelSlate', x0, P.APSE_APEX_U, vN, vS, P.ROOF_FOOT, rise, { axis: 'x', ends: ['gable', 'open'], ov: 0, gableWalls: false });
    const hf = ((P.APSE.angs[0] - P.APSE.angs[1]) / 2) * D2R;      // half a facet's angle
    const Ri = (P.APSE.R * Math.cos(hf) - P.ROOF_INSET) / Math.cos(hf);      // the apse's roof foot polygon (inset ROOF_INSET)
    const uj = P.APSE.cu + Math.sqrt(Math.max(0, Ri * Ri - (P.HALF - P.ROOF_INSET) ** 2));
    const line = [[P.APSE_APEX_U, vS], [uj, vS], ...P.APSE.angs.slice(1, 5).map((d) => P.apsePt(d, Ri)), [uj, vN], [P.APSE_APEX_U, vN]];
    fan(B, 'chapelSlate', line, P.ROOF_FOOT, [P.APSE_APEX_U, P.VC], P.RIDGE);
    for (const p of line.slice(1, -1)) B.beam('lead', [p[0], P.ROOF_FOOT + 0.05, p[1]], [P.APSE_APEX_U, P.RIDGE + 0.04, P.VC], 0.12, 0.08);
    B.flat('lead', P.OUTLINE, P.ROOF_FOOT - 0.03, [P.INNER_RING]);      // (only over the walls: the vault is inside)
    B.box('lead', (x0 + P.APSE_APEX_U) / 2, P.RIDGE + 0.05, P.VC, P.APSE_APEX_U - x0, 0.14, 0.2);
    B.box('ironBlack', P.APSE_APEX_U, P.RIDGE + 0.7, P.VC, 0.07, 1.3, 0.07);
    B.box('ironBlack', P.APSE_APEX_U, P.RIDGE + 1.0, P.VC, 0.07, 0.07, 0.55);
    B.box('ironBlack', P.APSE_APEX_U, P.RIDGE + 1.0, P.VC, 0.55, 0.07, 0.07);
  }

  // ---- the south PORCH (west bay): gabled frontispiece, a splayed recess of three pointed orders back to the door in the
  //      wall's thickness, statues on shafts, roundel; four risers and a landing inside the recess; the metal ramp
  {
    const Q = P.PORCH, W = Q.u1 - Q.u0, m = W / 2, uc = (Q.u0 + Q.u1) / 2, [ds, dt, dw] = Q.door, St = P.STEP, Rp = P.RAMP;
    const yP = fqY(uc, Q.front), depth = Q.front - Q.doorV;      // the paving at the mouth; front to door plane (2.45)
    const ord = Q.orders.map((o) => K.pointedPts(m, o.w, yP - 0.45, Q.arch.spring, o.apex - Q.arch.spring, 8));
    const door = K.rectPts(m - dw / 2, ds, m + dw / 2, dt);
    const F = K.frame(Q.u0, 0, Q.front, 1, 0);
    K.wall(B, F, [[0, P.FOOT], [W, P.FOOT], [W, Q.shoulder], [m, Q.apex], [0, Q.shoulder]], [{ pts: ord[0], kind: 'none' }], 'bath');
    B.push(F);
    let z = 0;
    for (let i = 0; i < ord.length; i++) {
      const z1 = -Q.orders[i].to;
      B.reveal('bathDress', ord[i], z, z1, true);
      if (i + 1 < ord.length) B.face('bathDress', ord[i], [ord[i + 1]], z1);
      // a shaft in each angle of the order (the photographs' jamb shafts), to the springing
      for (const sx of [-1, 1]) B.cyl('bathDress', m + sx * (Q.orders[i].w / 2 - 0.08), yP, z1 + 0.1, 0.07, Q.arch.spring - yP - 0.12, 8, false);
      z = z1;
    }
    B.face('bathDress', ord[ord.length - 1], [door], -depth);      // the tympanum and the wall round the door
    B.reveal('bathDress', door, -depth, -(Q.front - P.WALL_S + P.THICK_IN), true);      // (through to the room's face)
    // (interior pass) the door is two real oak leaves (IK.DoorSet, opening inwards: buildChapel); the reveal carries on
    // through the rest of the wall to the room (part 'chapelint' draws the rear arch)
    bars(B, 'bathDress', arcOf(m, Q.orders[0].w + 0.3, Q.arch.spring, Q.orders[0].apex - Q.arch.spring + 0.18), 0.14, 0.08, 0.1);
    for (const x of [0.42, W - 0.42]) {      // statues on shafts either side (plain figures)
      B.cyl('bathDress', x, yP, 0.22, 0.11, 1.45 + ds - yP, 8, true, 0.13);
      statue(B, 'statue', x, ds + 1.6, 0.22, 1.5);
      B.box('bathDress', x, ds + 3.35, 0.22, 0.55, 0.35, 0.45);
    }
    B.poly('bathDress', circ(m, 7.35, 0.42, 12).map(([x, y]) => [x, y, 0.04]), [0, 0, 1]);
    for (const dx of [-0.78, 0.78]) B.poly('bathDress', circ(m + dx, 6.55, 0.15, 8).map(([x, y]) => [x, y, 0.04]), [0, 0, 1]);
    slab(B, 'bathDress', [0, Q.shoulder], [m, Q.apex], 0.25, 0.12, -(Q.front - P.WALL_S) - 0.2);
    slab(B, 'bathDress', [m, Q.apex], [W, Q.shoulder], 0.25, 0.12, -(Q.front - P.WALL_S) - 0.2);
    B.box('bathDress', m, Q.apex + 0.62, 0.0, 0.13, 0.85, 0.13); B.box('bathDress', m, Q.apex + 0.75, 0.0, 0.5, 0.12, 0.13);
    B.pop();
    K.wall(B, K.frame(Q.u0, 0, P.WALL_S, 0, 1), K.rectPts(0, P.FOOT, Q.front - P.WALL_S, Q.shoulder), [], 'bath');
    K.wall(B, K.frame(Q.u1, 0, Q.front, 0, -1), K.rectPts(0, P.FOOT, Q.front - P.WALL_S, Q.shoulder), [], 'bath');
    B.poly('bathDress', [[Q.u0 - 0.05, Q.shoulder, Q.front], [uc, Q.apex, Q.front], [uc, Q.apex, P.WALL_S], [Q.u0 - 0.05, Q.shoulder, P.WALL_S]], [-1, 1, 0]);
    B.poly('bathDress', [[Q.u1 + 0.05, Q.shoulder, Q.front], [uc, Q.apex, Q.front], [uc, Q.apex, P.WALL_S], [Q.u1 + 0.05, Q.shoulder, P.WALL_S]], [1, 1, 0]);
    // the filler between the turret and the porch's west side (the survey's outline at u -15.1)
    const Fl = Q.filler, fr = [[Fl.u0, Fl.v1], [Q.u0, Fl.v1], [Q.u0, P.WALL_S], [Fl.u0, P.WALL_S]];
    K.prism(B, 'bath', fr, P.FOOT, Q.shoulder, { top: true });
    solids.push(fr);
    // the recess floor at the paving, the landing at the door, three steps between (four risers)
    const hw = Q.orders[0].w / 2 - 0.02, sw = Q.orders[2].w / 2 - 0.01, vTop = Q.doorV + St.landing, vFoot = vTop + St.n * St.going;
    B.flat('pavingSolid', [[uc - hw, vFoot], [uc + hw, vFoot], [uc + hw, Q.front], [uc - hw, Q.front]], yP + 0.004);
    ctx.floor([[uc - hw, vFoot], [uc + hw, vFoot], [uc + hw, Q.front + 0.01], [uc - hw, Q.front + 0.01]], yP + 0.004);
    B.box('pavingSolid', uc, (ds + yP - 0.3) / 2, (Q.doorV + vTop) / 2, 2 * sw, ds - yP + 0.3, vTop - Q.doorV, 0, {});
    K.steps(B, 'pavingSolid', uc - sw, uc + sw, vTop, 1, St.n, (ds - yP) / (St.n + 1), St.going, ds, yP - 0.3);
    ctx.floor([[uc - sw, Q.doorV], [uc + sw, Q.doorV], [uc + sw, vTop], [uc - sw, vTop]], ds);
    for (let i = 0; i < St.n; i++) { const a = vTop + St.going * i, b = a + St.going; ctx.floor([[uc - sw, a], [uc + sw, a], [uc + sw, b], [uc - sw, b]], ds - ((ds - yP) / (St.n + 1)) * (i + 1)); }
    // the RAMP: a chequer-plate slab from the threshold down over the steps to the paving at vFoot, with side skirts
    {
      const u0 = Rp.u - Rp.w / 2, u1 = Rp.u + Rp.w / 2, va = vTop, vb = Rp.vFoot, ya = ds + Rp.t, yb = fqY(Rp.u, vb) + 0.01;
      const yr = (v) => ya + ((v - va) / (vb - va)) * (yb - ya);
      B.poly('lead', [[u0, ya, va], [u1, ya, va], [u1, yb, vb], [u0, yb, vb]], [0, 1, 0]);
      for (const u of [u0, u1]) B.poly('leadDark', [[u, ya, va], [u, yb, vb], [u, yb - 0.04, vb], [u, ya - 0.12, va]], [u === u0 ? -1 : 1, 0, 0]);
      B.box('leadDark', Rp.u, ya - 0.02, va - 0.02, Rp.w, 0.04, 0.1, 0, {});      // the lip on the threshold
      ctx.floor([[u0, va], [u1, va], [u1, vb], [u0, vb]], (u, v) => yr(v));
    }
    // the porch's masonry (the jambs either side of the splayed recess)
    solids.push([[Q.u0, P.WALL_S], [Q.u0, Q.front], [uc - hw, Q.front], [uc - sw, P.WALL_S]]);
    solids.push([[uc + sw, P.WALL_S], [uc + hw, Q.front], [Q.u1, Q.front], [Q.u1, P.WALL_S]]);
  }

  // ---- the south-west stair TURRET: octagon, strings, slit windows, corbelled pierced crown, lead cap
  {
    const T = P.TURRET, c = [T.u, T.v], ring = ngon(T.u, T.v, T.R, 8, 22.5);
    K.prism(B, 'bath', ring, P.FOOT, T.corbel[0]);
    for (const y of T.strings) K.prism(B, 'bathDress', ngon(T.u, T.v, T.R + 0.1, 8, 22.5), y - 0.18, y, { top: true });
    K.prism(B, 'bathDress', ngon(T.u, T.v, T.R + 0.12, 8, 22.5), P.FOOT, P.PLINTH, { top: true });
    for (const f of faceFrames(ring, c)) {
      if (!(f.n[0] < -0.3 || f.n[1] > 0.3)) continue;      // only the faces that stand clear (west and south)
      B.push(f.F); for (const y of [2.6, 6.2, 10.2, 13.6, 16.6]) B.face('dark', K.rectPts(f.L / 2 - 0.08, y, f.L / 2 + 0.08, y + 0.75), [], 0.01); B.pop();
    }
    const crown = ngon(T.u, T.v, T.crownR, 8, 22.5);
    for (let i = 0; i < 8; i++) {      // the corbelled band: a frustum from the shaft out to the crown
      const a = ring[i], b = ring[(i + 1) % 8], A = crown[i], Bq = crown[(i + 1) % 8];
      B.poly('bathDress', [[a[0], T.corbel[0], a[1]], [b[0], T.corbel[0], b[1]], [Bq[0], T.corbel[1], Bq[1]], [A[0], T.corbel[1], A[1]]], [(a[0] + b[0]) / 2 - T.u, -0.6, (a[1] + b[1]) / 2 - T.v]);
    }
    for (const f of faceFrames(crown, c)) {
      K.wall(B, f.F, K.rectPts(0, T.corbel[1], f.L, T.crown), [{ pts: circ(f.L / 2, (T.corbel[1] + T.crown) / 2, 0.24, 6, Math.PI / 6), kind: 'void', d: 0.2 }], 'bathDress');
      B.push(f.F); B.face('bathDress', K.rectPts(0, T.corbel[1], f.L, T.crown), [], -0.2, true); B.pop();
    }
    K.prism(B, 'bathDress', ngon(T.u, T.v, T.crownR + 0.06, 8, 22.5), T.crown, T.crown + 0.12, { top: true });
    B.flat('lead', crown, T.corbel[1] + 0.02);
    K.coneRoof(B, 'lead', ngon(T.u, T.v, T.crownR - 0.3, 8, 22.5), T.corbel[1], c, T.cap - T.corbel[1]);
    solids.push(ring);
  }

  // ---- the FLECHE on the ridge
  buildFleche(B);

  // ---- colliders: the walls' outline, each buttress, the porch, the turret
  { const Q = P.PORCH, uc = (Q.u0 + Q.u1) / 2, sw = Q.orders[2].w / 2 - 0.01, o = P.OUTLINE;      // the outline, open at the door
    // (interior pass) a polyline round the outside from the door's east jamb to its west jamb, then the jambs on through
    // the wall to the room's face (the leaves are the doors' own colliders; the room's faces are part 'chapelint')
    const line = [[uc + sw, Q.doorV], [uc + sw, P.WALL_S], ...o.slice(1), o[0], [uc - sw, P.WALL_S], [uc - sw, Q.doorV]];
    for (let i = 0; i < line.length - 1; i++) ctx.seg(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]);
    for (const x of [uc - sw, uc + sw]) ctx.seg(x, Q.doorV, x, P.WALL_S - P.THICK_IN); }
  for (const r of solids) ctx.solid(r);
  GL.flush(ctx);
  // the porch door's two oak leaves, hinged at the jambs, opening inwards (north) into the antechapel
  const doors = new IK.DoorSet(), Q = P.PORCH, ucD = (Q.u0 + Q.u1) / 2, hw = Q.door[2] / 2;
  doors.add({ name: 'chapelS-w', u: ucD - hw, v: Q.doorV, y: Q.door[0], w: hw - 0.01, h: Q.door[1] - Q.door[0], dir: Math.PI / 2, swing: 1, style: 'oak', heavy: true, thick: 0.08 });
  doors.add({ name: 'chapelS-e', u: ucD + hw, v: Q.doorV, y: Q.door[0], w: hw - 0.01, h: Q.door[1] - Q.door[0], dir: -Math.PI / 2, swing: -1, style: 'oak', heavy: true, thick: 0.08 });
  return IK.chapelResult({ doors });
}

function buildFleche(B) {
  const Fl = P.FLECHE, c = [Fl.u, Fl.v];
  // 1. the octagonal base, lead in a lozenge lattice
  const base = ngon(Fl.u, Fl.v, Fl.base.R, 8, 22.5);
  K.prism(B, 'lead', base, Fl.base.y0, Fl.base.y1);
  for (const f of faceFrames(base, c)) {
    B.push(f.F);
    const ya = 22.4, yb = Fl.base.y1 - 0.15, H = yb - ya, sp = 0.5, Lf = f.L;
    for (let k = -H; k < Lf; k += sp) { const y0 = Math.max(ya, ya - k), y1 = Math.min(yb, ya + Lf - k); if (y1 - y0 > 0.05) bar(B, 'leadDark', [k + (y0 - ya), y0], [k + (y1 - ya), y1], 0.05, 0.04, 0.04); }
    for (let k = 0; k < Lf + H; k += sp) { const y0 = Math.max(ya, ya + k - Lf), y1 = Math.min(yb, ya + k); if (y1 - y0 > 0.05) bar(B, 'leadDark', [k - (y0 - ya), y0], [k - (y1 - ya), y1], 0.05, 0.04, 0.04); }
    B.pop();
  }
  K.prism(B, 'leadDark', ngon(Fl.u, Fl.v, Fl.base.R + 0.1, 8, 22.5), Fl.base.y1 - 0.2, Fl.base.y1, { top: true });
  // 2. the open octagonal stage: corner shafts, paired traceried openings, a dark core seen through them
  const st = ngon(Fl.u, Fl.v, Fl.stage.R, 8, 22.5), { y0, y1 } = Fl.stage;
  K.prism(B, 'leadDark', ngon(Fl.u, Fl.v, 0.55, 8, 22.5), y0, y1 + 0.1);
  for (const p of st) B.box('lead', p[0], (y0 + y1) / 2, p[1], 0.17, y1 - y0, 0.17, 0, { top: false });
  for (const f of faceFrames(st, c)) {
    B.push(f.F);
    const Lf = f.L, m = Lf / 2, ys = y1 - 0.75;
    B.face('lead', K.rectPts(0, y0, Lf, y0 + 0.3), [], 0); B.face('lead', K.rectPts(0, y0, Lf, y0 + 0.3), [], -0.12, true);
    bar(B, 'lead', [m, y0 + 0.3], [m, ys], 0.07, 0.02, 0.1);
    for (const [a, b] of [[0.08, m], [m, Lf - 0.08]]) bars(B, 'lead', [[a, ys], [(a + b) / 2, ys + 0.42], [b, ys]], 0.06, 0.02, 0.1);
    bars(B, 'lead', [[0.08, ys], [m, ys + 0.6], [Lf - 0.08, ys]], 0.07, 0.02, 0.1);
    B.face('lead', [[0, y1 - 0.12], [0, ys + 0.1], [m, ys + 0.62], [Lf, ys + 0.1], [Lf, y1 - 0.12]], [], 0);
    B.pop();
  }
  K.prism(B, 'lead', ngon(Fl.u, Fl.v, Fl.stage.R + 0.12, 8, 22.5), y1, y1 + Fl.cornice, { top: true });
  // 3. gablets on every face, corner pinnacles
  const yg = y1 + Fl.cornice, ring = ngon(Fl.u, Fl.v, Fl.stage.R + 0.05, 8, 22.5);
  for (const f of faceFrames(ring, c)) {
    B.push(f.F);
    B.face('lead', [[0, yg], [f.L, yg], [f.L / 2, yg + Fl.gablet]], [], 0);
    B.face('lead', [[0, yg], [f.L, yg], [f.L / 2, yg + Fl.gablet]], [], -0.08, true);
    B.face('dark', circ(f.L / 2, yg + Fl.gablet * 0.38, 0.2, 6), [], 0.02);
    B.pop();
  }
  for (const p of ring) pinn(B, 'lead', p[0], p[1], Fl.pinnacle[0], Fl.pinnacle[1], 0.17, Fl.pinnacle[2]);
  // 4. the spire: an octagonal pyramid with rolls on its arrises, two bands, four lucarnes at its foot
  const S = Fl.spire, sb = ngon(Fl.u, Fl.v, S.R, 8, 22.5);
  for (let i = 0; i < 8; i++) {
    const a = sb[i], b = sb[(i + 1) % 8];
    B.poly('lead', [[a[0], S.y0, a[1]], [b[0], S.y0, b[1]], [Fl.u, S.tip, Fl.v]], [(a[0] + b[0]) / 2 - Fl.u, 0.15, (a[1] + b[1]) / 2 - Fl.v]);
    B.beam('leadDark', [a[0], S.y0 + 0.2, a[1]], [Fl.u, S.tip - 0.1, Fl.v], 0.06, 0.06);
  }
  for (const t of [0.3, 0.6]) { const y = S.y0 + (S.tip - S.y0) * t; K.prism(B, 'leadDark', ngon(Fl.u, Fl.v, S.R * (1 - t) + 0.04, 8, 22.5), y - 0.08, y + 0.08, { top: true }); }
  for (const f of faceFrames(ngon(Fl.u, Fl.v, Fl.lucarne ? S.R * (1 - (Fl.lucarne + 0.4 - S.y0) / (S.tip - S.y0)) : S.R * 0.82, 8, 22.5), c).filter((_, i) => i % 2 === 0)) {
    B.push(f.F);
    const yl = Fl.lucarne ?? S.y0 + 1.6, m = f.L / 2;
    B.box('lead', m, yl + 0.3, 0.12, 0.34, 0.6, 0.5); B.face('lead', [[m - 0.2, yl + 0.6], [m + 0.2, yl + 0.6], [m, yl + 0.95]], [], 0.37);
    B.face('dark', K.rectPts(m - 0.09, yl + 0.08, m + 0.09, yl + 0.5), [], 0.375);
    B.pop();
  }
  // 5. ball, vane and cross
  B.cyl('lead', Fl.u, S.tip - 0.05, Fl.v, 0.1, 0.22, 8, true, 0.1);
  B.cyl('ironBlack', Fl.u, S.tip + 0.15, Fl.v, 0.025, Fl.vane - S.tip - 0.15, 6, true);
  B.box('ironBlack', Fl.u, Fl.vane - 0.35, Fl.v, 0.5, 0.04, 0.04);
  B.box('ironBlack', Fl.u, Fl.vane - 0.35, Fl.v, 0.04, 0.04, 0.5);
  B.box('ironBlack', Fl.u + 0.2, Fl.vane - 0.12, Fl.v, 0.55, 0.22, 0.02);
}

// ------------------------------------------------------------------------------------------------ the paving where the old (wider) walls stood
// the Front Quad's paving plane (exeter_grounds.js quadY + its 0.045 flags) and Margary Quad's (margary plan quadY + 0.01
// flags; the landing by the Thomas Wood Building at 64.05 + 0.035): copied, not imported, to keep the parts apart
const fqY = (u, v) => -0.025 - 0.0071 * u + 0.006 * v + 0.045;
function buildAprons(ctx) {
  // (registration pass) the Front Quad's paving stops at v -19.3 and Margary Quad's at -31.9 (its ring steps out to u 11.5
  // round the apse): these convex pieces fill between them and the Chapel's walls and apse
  const { B } = ctx, J = P.JUNCTION, a54 = P.apsePt(54), a18 = P.apsePt(18), b54 = P.apsePt(-54), b18 = P.apsePt(-18);
  const at = (p, q, u) => [u, p[1] + ((u - p[0]) / (q[0] - p[0])) * (q[1] - p[1])];
  const sCut = at(a54, a18, 11.5), nCut = at(b54, b18, 11.5), uW = -16.4;
  const south = [
    [[uW, -19.3], [J, -19.3], [J, P.WALL_S], [uW, P.WALL_S]],
    [[J, -19.3], [11.5, -19.3], a54, [J, P.WALL_S]],
    [[11.5, -19.3], sCut, a54],
  ];
  // (interior pass) the north strips on Margary Quad's own ground (its plan's groundY: part 'margary' draws its quad to v
  // -31.9 and its lobby over u -13.5 .. -10.65, so that strip is left to it); the north projection covers u 2.7 .. 8.0
  const fx = (u) => b54[1] !== P.WALL_N ? [u, P.WALL_N + ((u - J) / (b54[0] - J)) * (b54[1] - P.WALL_N)] : [u, P.WALL_N];
  const N = P.NPROJ;
  const north = [
    [[-10.65, -31.9], [N.u0, -31.9], [N.u0, P.WALL_N], [-10.65, P.WALL_N]],
    [[N.u1, -31.9], [9.3, -31.9], b54, fx(N.u1)],
    [[9.3, -31.9], [11.5, -30.0], b54],
    [[11.5, -30.0], nCut, b54],
  ];
  const lay = (ring, f) => {
    const pts = ring.map(([u, v]) => [u, f(u, v), v]);
    B.poly('paving', pts, [0, 1, 0], ring.map(([u, v]) => [u / 3, v / 3]));
    ctx.floor(ring, f);
  };
  for (const r of south) lay(r, fqY);
  for (const r of north) lay(r, (u, v) => mqGround(u, v) + 0.01);
}

// ------------------------------------------------------------------------------------------------ the north projection and door
/** (interior pass) the single-storey projection against the north wall (a vestry: survey outline, LIDAR) with the NORTH
 *  DOOR over the landing of part 'margary''s steps: ashlar, a plinth, a coped parapet round a flat lead roof, a small
 *  two-light window east of the door; the door pointed, under a hood mould, shut (an oak face in a moulded reveal) */
function buildNorthProjection(ctx, solids) {
  const { B } = ctx, N = P.NPROJ, D = P.NDOOR, g = (u) => mqGround(u, N.v - 0.3);
  const ring = [[N.u0, P.WALL_N], [N.u1, P.WALL_N], [N.u1, N.v], [N.u0, N.v]];
  // north face (faces north: frame from u1 going west), west and east faces
  const L = N.u1 - N.u0, sOf = (u) => N.u1 - u;
  const door = K.pointedPts(sOf(D.u), D.w, D.sill, D.spring, D.apex - D.spring, 6);
  const win = [-0.32, 0.32].map((dx) => ({ pts: K.pointedPts(sOf(6.4) + dx, 0.5, 1.9, 3.0, 0.45, 5), kind: 'win', glass: 'leaded', d: 0.2, sill: false }));
  K.wall(B, K.frame(N.u1, 0, N.v, -1, 0), K.rectPts(0, P.FOOT, L, N.parapet), [{ pts: door, kind: 'door', doorKey: 'oakDoor', d: D.d }, ...win], 'bathOld');
  B.push(K.frame(N.u1, 0, N.v, -1, 0));
  K.stringCourse(B, 'bathDress', 0, L, Math.max(g(N.u0), g(N.u1)) + 0.5, 0.25, 0.1);
  K.stringCourse(B, 'bathDress', 0, L, N.roof + 0.05, 0.18, 0.12);
  bars(B, 'bathDress', arcOf(sOf(D.u), D.w + 0.36, D.spring, D.apex - D.spring + 0.2), 0.14, 0.1, 0.1);      // the hood
  for (const sx of [-1, 1]) B.box('bathDress', sOf(D.u) + sx * (D.w / 2 + 0.18), D.spring - 0.12, 0.06, 0.16, 0.24, 0.12, 0, {});   // its stops
  B.box('ironBlack', sOf(D.u) - D.w * 0.3, D.sill + 1.05, -D.d + 0.06, 0.05, 0.16, 0.05, 0, {});      // a ring handle
  B.box('bathDress', sOf(6.4), 1.82, 0.07, 1.4, 0.12, 0.14, 0, { bottom: true });                       // the window's sill
  B.pop();
  for (const [F0, Lw] of [[K.frame(N.u0, 0, N.v, 0, 1), N.v - P.WALL_N], [K.frame(N.u1, 0, P.WALL_N, 0, -1), P.WALL_N - N.v]]) {
    K.wall(B, F0, [[0, P.FOOT], [Math.abs(Lw), P.FOOT], [Math.abs(Lw), N.parapet], [0, N.parapet]], [], 'bathOld');
  }
  // the roof: lead inside a parapet
  const t = N.t;
  B.flat('lead', [[N.u0 + t, P.WALL_N], [N.u1 - t, P.WALL_N], [N.u1 - t, N.v + t], [N.u0 + t, N.v + t]], N.roof);
  const h = t / 2;
  K.parapet(B, 'bathOld', [[N.u0 + h, P.WALL_N], [N.u0 + h, N.v + h], [N.u1 - h, N.v + h], [N.u1 - h, P.WALL_N]], N.roof - 0.1, N.parapet - N.roof + 0.1, t, { coping: 'bathDress' });
  solids.push(ring);
}
/** (interior pass) the planted beds between the south buttresses: _exeter_plants.js chapelBeds */
function buildBeds(ctx) {
  const Bd = P.BEDS;
  chapelBeds(ctx, { faceV: Bd.faceV, depth: Bd.depth, bays: Bd.bays, wall: Bd.wall, plants: Bd.plants, y: (u, v) => fqY(u, v), top: Bd.top, seed: 43 });
}
