// Exeter College, STANDALONE model, part 'east' (B04 + B05): the build functions. Called by exeter_east.js with ctx.B
// already in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from
// _exeter_east_plan.js (sources and K / G there). Local helpers written here (not in the kit): round-arched light groups
// with label-strings (the west range's helpers are not exported), a mansard roof section, a white timber dormer with slate
// cheeks, a three-sided bay, quoins, a creeper mat, a sundial.
import * as K from './_exeter_kit.js';
import {
  R, QUAD_GROUND, GARDEN_GROUND, LANE_GROUND, FOOT, ROOF, QF, GP, QUAD_COLS, QUAD_PIPES, GRILLES, GARDEN_COLS, BAY,
  DORMERS_Q, DORMERS_G, DORMERS_G_FLAT, DORMER, STACKS, STACK, HALL_STACKS, ROOM_P, FINIALS, SOUTH_STACK, PASSAGE, TOWER,
  WAY, LAMPS, CREEPER, RANGE, BED, vNorth, vSouth,
} from './_exeter_east_plan.js';
import { shrub, leaf as leafCard } from './_exeter_plants.js';

const { frame, wall, rectPts, archPts, tudorPts } = K;
const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [a, ya] = tab[i - 1], [b, yb] = tab[i]; return ya + ((x - a) / (b - a)) * (yb - ya); } return tab[tab.length - 1][1]; };
export const quadY = (v) => interp(QUAD_GROUND, v);
export const gardenY = (v) => interp(GARDEN_GROUND, v);
export const laneY = (u) => interp(LANE_GROUND, u);

// THE RANGE is built in its own frame (RANGE coordinates, _exeter_east_plan.js): `rangeCtx` gives the range's builders a
// ctx whose Batch has the range's turn pushed and whose floor / solid / seg / lamp take range coordinates; Palmer's Tower
// and the way round are built with the plain ctx (LOCAL; the tower in its own frame).
export function rangeCtx(ctx) {
  const T = RANGE.toL, w = Object.create(ctx);
  w.floor = (ring, y) => ctx.floor(ring.map((p) => T(p[0], p[1])), typeof y === 'function' ? (u, v) => { const r = RANGE.toR(u, v); return y(r[0], r[1]); } : y);
  w.solid = (ring) => ctx.solid(ring.map((p) => T(p[0], p[1])));
  w.seg = (u1, v1, u2, v2) => { const a = T(u1, v1), b = T(u2, v2); ctx.seg(a[0], a[1], b[0], b[1]); };
  w.lamp = (u, y, v) => { const a = T(u, v); ctx.lamp(a[0], y, a[1]); };
  return w;
}
export const rangeFrame = () => { const o = RANGE.toL(0, 0); return frame(o[0], 0, o[1], Math.cos(RANGE.th), Math.sin(RANGE.th)); };

// wall frames (kit CONVENTIONS): quad face faces WEST (s = v - vN runs south); garden face faces EAST (s = vSg - v runs north)
const FQ = () => frame(R.uQ, 0, R.vN, 0, 1), sQ = (v) => v - R.vN;
const FG = () => frame(R.uG, 0, R.vSg, 0, -1), sG = (v) => R.vSg - v;
const T = TOWER;
const N_OF = { one: 1, two: 2, three: 3 };

/** a wall outline whose foot follows the ground (FOOT below it) */
function footOutline(s0, s1, top, groundAt, n = 8) {
  const p = [];
  for (let i = 0; i <= n; i++) { const s = s0 + ((s1 - s0) * i) / n; p.push([s, groundAt(s) - FOOT]); }
  p.push([s1, top], [s0, top]);
  return p;
}
/** n round-arched lights centred at x from y0 to y1; returns { ops, box: [x0, x1, y0, y1] } */
function lights(x, n, y0, y1, lw, mull, d, glass = 'leaded') {
  const w = n * lw + (n - 1) * mull, x0 = x - w / 2, ops = [];
  for (let i = 0; i < n; i++) { const c = x0 + lw / 2 + i * (lw + mull); ops.push({ pts: archPts(c, lw, y0, y1 - lw / 2, 6), kind: 'win', glass, d, sill: false }); }
  return { ops, box: [x0, x0 + w, y0, y1] };
}
/** the quad's label: a hood standing `rise` over the head whose returns step down into the head-level string; and a sill */
function labelOver(B, [x0, x1, y0, y1], rise, key = 'bathDress') {
  const a = x0 - 0.14, b = x1 + 0.14;
  B.box(key, (a + b) / 2, y1 + rise - 0.07, 0.06, b - a, 0.14, 0.12, 0, { bottom: true });
  for (const x of [a + 0.06, b - 0.06]) B.box(key, x, y1 + rise / 2, 0.06, 0.12, rise, 0.12, 0, { bottom: true });
  B.box(key, (x0 + x1) / 2, y0 - 0.08, 0.06, x1 - x0 + 0.2, 0.14, 0.12, 0, { bottom: true });
}
function pipe(B, s, yGround, yTop, z = 0.12) {
  B.cyl('leadDark', s, yGround - 0.05, z, 0.055, yTop - yGround, 6, false);
  B.box('leadDark', s, yTop + 0.15, z, 0.32, 0.32, 0.26, 0, { bottom: true });
}
/** a blank shield on a sunk panel, in the current frame, centred at x between y0 and y1 */
function shieldPanel(B, x, y0, y1) {
  B.box('bathDress', x, (y0 + y1) / 2, 0.03, 0.85, y1 - y0, 0.06, 0, { bottom: true });
  const yc = (y0 + y1) / 2;
  B.poly('bathOld', [[x - 0.22, yc + 0.3, 0.07], [x + 0.22, yc + 0.3, 0.07], [x + 0.22, yc - 0.02, 0.07], [x, yc - 0.32, 0.07], [x - 0.22, yc - 0.02, 0.07]], [0, 0, 1]);
}
function lamp(ctx, F, s, y, toLocal, outer = null) {
  const { B } = ctx;
  if (outer) B.push(outer);
  B.push(F);
  B.box('ironBlack', s, y + 0.62, 0.3, 0.05, 0.05, 0.6, 0, {});
  const p = K.lantern(B, s, y, 0.55, { size: 0.28 });
  B.pop();
  if (outer) B.pop();
  const [u, v] = toLocal(p[0], p[2]); ctx.lamp(u, p[1], v);
}

// ------------------------------------------------------------------------------------------------ THE QUAD FACE
export function buildQuad(ctx) {
  const { B } = ctx, P = QF, ops = [], boxes = [], doors = [];
  const grp = (s, n, y) => { const g = lights(s, n, y[0], y[1], P.lightW, P.mullion, P.reveal); ops.push(...g.ops); boxes.push(g.box); };
  for (const c of QUAD_COLS) {
    const s = sQ(c.v);
    if (c.door) {
      const D = P.door, y0 = c.passage ? PASSAGE.floor + 0.01 : quadY(c.v) + 0.02, pts = tudorPts(s, D.w, y0, y0 + D.spring, D.rise, 6);
      if (c.passage) ops.push({ pts, kind: 'void', d: R.wall, revealKey: 'bathDress' });
      else ops.push({ pts, kind: 'door', doorKey: 'oakDoor', d: 0.3 });
      doors.push({ s, y0, c });
      grp(s, c.n, P.f); grp(s, c.n, P.t);
    } else for (const y of [P.g, P.f, P.t]) grp(s, c.n, y);
  }
  const L = sQ(R.vHall);
  // the face to the gutter (the parapet box carries it up to the coping), to the front of the Hall's oriel: south of it
  // the range's west wall is the Hall's east gable (part hall)
  wall(B, FQ(), footOutline(0, L, ROOF.gutter, (s) => quadY(R.vN + s)), ops, 'quadStone');
  B.push(FQ());
  for (const bx of boxes) labelOver(B, bx, P.labelRise);
  const sH = sQ(R.vHall);
  for (const y of [P.g[1], P.f[1], P.t[1]]) K.stringCourse(B, 'bathDress', 0, sH, y + 0.1, 0.14, 0.08);
  for (const d of doors) {
    const D = P.door;
    K.label(B, d.s - D.w / 2 - 0.08, d.s + D.w / 2 + 0.08, d.y0 + D.spring + D.rise + 0.06, 0.3);
    B.box('white', d.s + D.w / 2 + 0.38, d.y0 + 1.7, 0.02, 0.2, 0.26, 0.03, 0, {});      // the staircase's number board
  }
  for (const c of QUAD_COLS.filter((q) => q.panel)) shieldPanel(B, sQ(c.v), P.panel[0], P.panel[1]);
  for (const v of QUAD_PIPES) pipe(B, sQ(v), quadY(v), ROOF.coping - 0.55);
  for (const v of GRILLES) B.box('ironBlack', sQ(v), quadY(v) + 0.28, 0.01, 0.7, 0.32, 0.02, 0, {});
  B.pop();
  // the parapet: the wall's own face carried up from the gutter, coped
  parapetRun(B, R.uQ + ROOF.parapetT / 2, R.vN, R.vHall, ROOF.gutter, ROOF.coping, 'quadStone');
  for (const L of LAMPS.filter((l) => l.at === 'quad')) lamp(ctx, FQ(), sQ(L.v), L.y, (s, z) => [R.uQ - z, R.vN + s]);
  return boxes.map(([x0, x1, y0, y1]) => [x0, x1, y0, y1]).concat(doors.map((d) => [d.s - P.door.w / 2, d.s + P.door.w / 2, d.y0, d.y0 + P.door.spring + P.door.rise + 0.4]));
}
/** a coped parapet along u = uc from v0 to v1 between y0 and the coping's top */
function parapetRun(B, uc, v0, v1, y0, top, key) {
  const t = ROOF.parapetT;
  B.box(key, uc, (y0 + top - 0.12) / 2, (v0 + v1) / 2, t, top - 0.12 - y0, v1 - v0, 0, {});
  B.box('bathDress', uc, top - 0.06, (v0 + v1) / 2, t + 0.1, 0.12, v1 - v0, 0, {});
}

// ------------------------------------------------------------------------------------------------ THE GARDEN FACE
export function buildGarden(ctx) {
  const { B } = ctx;
  K.addCell(ctx.pack, 'doorBlue', 'door', 0x3c64a0);
  // two runs: Peryam (lower storeys, lower parapet) south of vP, Armagh north of it
  const runs = [{ v0: R.vP, v1: R.vSg, top: ROOF.gutterP, cop: ROOF.copingP, L: GP, labelRise: 0.32 },
    { v0: R.vNg, v1: R.vP, top: ROOF.gutter, cop: ROOF.coping, L: QF, labelRise: QF.labelRise }];
  for (const run of runs) {
    const P = run.L, ops = [], boxes = [], extra = [];
    const grp = (s, n, y) => { const g = lights(s, n, y[0], y[1], P.lightW, P.mullion, P.reveal); ops.push(...g.ops); boxes.push(g.box); };
    for (const c of GARDEN_COLS.filter((q) => q.v > run.v0 && q.v < run.v1)) {
      const s = sG(c.v);
      if (c.k === 'bay') { bay(ctx, c.v); continue; }
      if (c.door === 'blue') {
        const D = GP.door, y0 = gardenY(c.v) + 0.12;
        ops.push({ pts: rectPts(s - D.w / 2, y0, s + D.w / 2, y0 + D.h - D.fan), kind: 'door', doorKey: 'doorBlue', d: 0.25 });
        ops.push({ pts: rectPts(s - D.w / 2, y0 + D.h - D.fan + 0.05, s + D.w / 2, y0 + D.h), kind: 'win', lights: 3, glass: 'leaded', d: 0.25, sill: false });
        extra.push({ hood: [s - D.w / 2 - 0.15, s + D.w / 2 + 0.15, y0 + D.h + 0.12], step: [s, y0] });
        grp(s, 2, P.f); grp(s, 2, P.t);
      } else if (c.door === 'passage') {
        const D = QF.door, y0 = PASSAGE.floor + 0.01;
        ops.push({ pts: tudorPts(s, D.w, y0, y0 + D.spring, D.rise, 6), kind: 'void', d: R.wall, revealKey: 'bathDress' });
        extra.push({ label: [s - D.w / 2 - 0.08, s + D.w / 2 + 0.08, y0 + D.spring + D.rise + 0.06] });
        grp(s, 2, P.f); grp(s, 2, P.t);
      } else for (const y of [P.g, P.f, P.t]) grp(s, N_OF[c.k], y);
    }
    const a = sG(run.v1), b = sG(run.v0);
    wall(B, FG(), footOutline(a, b, run.top, (s) => gardenY(R.vSg - s)), ops, 'quadStone');
    B.push(FG());
    for (const bx of boxes) labelOver(B, bx, run.labelRise);
    for (const y of [P.g[1], P.f[1], P.t[1]]) K.stringCourse(B, 'bathDress', a, b, y + 0.1, 0.14, 0.08);
    if (P.cornice) K.stringCourse(B, 'bathDress', a, b, P.cornice, 0.2, 0.14);
    for (const e of extra) {
      if (e.hood) { B.box('bathDress', (e.hood[0] + e.hood[1]) / 2, e.hood[2], 0.12, e.hood[1] - e.hood[0], 0.14, 0.24, 0, { bottom: true }); B.box('pavingSolid', e.step[0], e.step[1] - 0.1, 0.25, 1.6, 0.22, 0.5, 0, {}); }
      if (e.label) K.label(B, e.label[0], e.label[1], e.label[2], 0.3);
    }
    B.pop();
    parapetRun(B, R.uG - ROOF.parapetT / 2, run.v0, run.v1, run.top, run.cop, 'quadStone');
  }
}
/** a three-sided bay through three storeys to Peryam's parapet, centred at v on the garden face */
function bay(ctx, vc) {
  const { B } = ctx, P = GP, u0 = R.uG, u1 = R.uG + BAY.proj;
  const A = [u0, vc + BAY.base / 2], Bp = [u1, vc + BAY.front / 2], C = [u1, vc - BAY.front / 2], D = [u0, vc - BAY.base / 2];
  const facets = [[A, Bp], [Bp, C], [C, D]];
  const top = ROOF.copingP, g = gardenY(vc);
  for (const [i, [p, q]] of facets.entries()) {
    const Lf = Math.hypot(q[0] - p[0], q[1] - p[1]), F = frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1]), ops = [], boxes = [];
    for (const y of [P.g, P.f, P.t]) {
      const n = i === 1 ? BAY.nFront : 1, lw = i === 1 ? P.lightW : Math.min(0.34, Lf - 0.4);
      const gr = lights(Lf / 2, n, y[0], y[1], lw, P.mullion, 0.18); ops.push(...gr.ops); boxes.push(gr.box);
    }
    wall(B, F, rectPts(0, g - FOOT, Lf, top - 0.12), ops, 'quadStone');
    B.push(F);
    for (const bx of boxes) labelOver(B, bx, 0.3);
    for (const y of [P.g[1], P.f[1], P.t[1]]) K.stringCourse(B, 'bathDress', -0.02, Lf + 0.02, y + 0.1, 0.14, 0.08);
    K.stringCourse(B, 'bathDress', -0.02, Lf + 0.02, P.cornice, 0.2, 0.14);
    B.box('bathDress', Lf / 2, top - 0.06, 0.03, Lf + 0.1, 0.12, 0.2, 0, { bottom: true });
    B.pop();
  }
  B.flat('lead', [A, Bp, C, D], top - 0.3);
  return [A, Bp, C, D];
}
export const bayRing = (vc) => [[R.uG, vc + BAY.base / 2], [R.uG + BAY.proj, vc + BAY.front / 2], [R.uG + BAY.proj, vc - BAY.front / 2], [R.uG, vc - BAY.base / 2]];

// ------------------------------------------------------------------------------------------------ ENDS
/** the mansard's outline across the range at a gable end, as (u, y) from the quad face to the garden face */
function gableProfile(copG, u0 = R.uQ) {
  return [[u0, ROOF.coping], [DORMER.frontQ, ROOF.coping], [ROOF.kneeQ, ROOF.knee + 0.15], [(ROOF.kneeQ + ROOF.kneeG) / 2, ROOF.ridge + 0.15], [ROOF.kneeG, ROOF.knee + 0.15], [DORMER.frontG, copG], [R.uG, copG]];
}
export function buildEnds(ctx) {
  const { B } = ctx;
  // north end (faces north, onto the way round): plain ashlar to the mansard's outline, coped. G: no windows seen
  {
    // (the end is not square to the faces: it runs from the garden corner (uG, vNg) to the quad corner (uQ, vN))
    const Ln = Math.hypot(R.uG - R.uQ, R.vNg - R.vN), F = frame(R.uG, 0, R.vNg, (R.uQ - R.uG) / Ln, (R.vN - R.vNg) / Ln);
    const prof = gableProfile(ROOF.coping), s = (u) => ((R.uG - u) / (R.uG - R.uQ)) * Ln, g = WAY.floor - FOOT;
    const out = [[0, g], [Ln, g], ...prof.map(([u, y]) => [s(u), y])];
    wall(B, F, out, [], 'bathOld');
    B.push(F); coping(B, prof.map(([u, y]) => [s(u), y])); B.pop();
  }
  // south end (faces south onto Brasenose Lane): two-light windows at Peryam's garden levels, coped gable. G
  {
    // (not square either: from the Hall's east gable (uHall) to the garden corner (uG, vSg); west of uHall stands the Hall)
    const u0 = R.uHall, v0 = vSouth(u0), Lx = Math.hypot(R.uG - u0, R.vSg - v0), F = frame(u0, 0, v0, (R.uG - u0) / Lx, (R.vSg - v0) / Lx);
    const prof = gableProfile(ROOF.copingP, u0).slice().reverse(), s = (u) => ((u - u0) / (R.uG - u0)) * Lx, k = (R.uG - u0) / Lx;
    const ops = [], boxes = [], sc = s(22.6);
    for (const y of [GP.g, GP.f, GP.t]) { const gr = lights(sc, 2, y[0] + 0.3, y[1], GP.lightW, GP.mullion, GP.reveal); ops.push(...gr.ops); boxes.push(gr.box); }
    const out = [];
    for (let i = 0; i <= 6; i++) { const x = (Lx * i) / 6; out.push([x, laneY(RANGE.toL(u0 + x * k, v0)[0]) - FOOT]); }
    // the profile runs garden -> quad here (s descending): reverse so the outline stays CCW
    out.push(...gableProfile(ROOF.copingP, u0).map(([u, y]) => [s(u), y]).reverse());
    wall(B, F, out, ops, 'quadStone');
    B.push(F); for (const bx of boxes) labelOver(B, bx, 0.32); coping(B, gableProfile(ROOF.copingP, u0).map(([u, y]) => [s(u), y])); B.pop();
    void prof;
    const vs = vSouth(SOUTH_STACK.u);
    K.chimney(B, 'quadStone', SOUTH_STACK.u - 0.45, SOUTH_STACK.u + 0.45, vs - 0.75, vs - 0.05, ROOF.knee, SOUTH_STACK.top, { pots: 2, capKey: 'bathDress' });
  }
}
/** a coping along a polyline [[s, y]] in the current wall frame */
function coping(B, pts) {
  for (let i = 0; i < pts.length - 1; i++) B.beam('bathDress', [pts[i][0], pts[i][1] + 0.05, 0], [pts[i + 1][0], pts[i + 1][1] + 0.05, 0], 0.12, 0.5);
}

// ------------------------------------------------------------------------------------------------ THE ROOF
export function buildRoof(ctx) {
  const { B } = ctx, mid = (ROOF.kneeQ + ROOF.kneeG) / 2;
  // the two ends are not square to the faces: v0 / v1 are functions of u (vNorth, vSouth); the Armagh / Peryam joint is square
  // south of the Hall's oriel the quad-side gutter starts at the Hall's east gable (uHall), not at the quad parapet
  const sections = [{ v0: vNorth, v1: () => R.vP, gG: ROOF.gutter }, { v0: () => R.vP, v1: () => R.vHall, gG: ROOF.gutterP },
    { v0: () => R.vHall, v1: vSouth, gG: ROOF.gutterP, uq: R.uHall }];
  const quad = (key, a, b, v0, v1, n) => B.poly(key, [[a[0], a[1], v1(a[0])], [b[0], b[1], v1(b[0])], [b[0], b[1], v0(b[0])], [a[0], a[1], v0(a[0])]], n);
  for (const S of sections) {
    const { v0, v1 } = S;
    const gq = [S.uq ?? R.uQ + ROOF.parapetT, ROOF.gutter], fq = [DORMER.frontQ, ROOF.gutter], kq = [ROOF.kneeQ, ROOF.knee], m = [mid, ROOF.ridge];
    const kg = [ROOF.kneeG, ROOF.knee], fg = [DORMER.frontG, S.gG], gg = [R.uG - ROOF.parapetT, S.gG];
    quad('lead', gq, fq, v0, v1, [0, 1, 0]);
    quad('slate', fq, kq, v0, v1, [-1, 0.7, 0]);
    quad('lead', kq, m, v0, v1, [-0.1, 1, 0]);
    quad('lead', m, kg, v0, v1, [0.1, 1, 0]);
    quad('slate', kg, fg, v0, v1, [1, 0.7, 0]);
    quad('lead', fg, gg, v0, v1, [0, 1, 0]);
    // lead rolls across the flat every 0.8 m (roof plan)
    for (let v = Math.max(v0(ROOF.kneeQ), v0(ROOF.kneeG)) + 0.8; v < Math.min(v1(ROOF.kneeQ), v1(ROOF.kneeG)) - 0.3; v += 0.8) B.beam('lead', [kq[0], kq[1] + 0.04, v], [mid, ROOF.ridge + 0.04, v], 0.06, 0.06), B.beam('lead', [mid, ROOF.ridge + 0.04, v], [kg[0], kg[1] + 0.04, v], 0.06, 0.06);
  }
  // the step where Peryam's lower garden gutter meets Armagh's: a small lead-flashed upstand
  B.poly('quadStone', [[DORMER.frontG, ROOF.gutter, R.vP], [R.uG - ROOF.parapetT, ROOF.gutter, R.vP], [R.uG - ROOF.parapetT, ROOF.gutterP, R.vP], [DORMER.frontG, ROOF.gutterP, R.vP]], [0, 0, 1]);
  // dormers
  for (const v of DORMERS_Q) dormer(B, frame(DORMER.frontQ, 0, v, 0, 1), ROOF.gutter, (ROOF.kneeQ - DORMER.frontQ) / (ROOF.knee - ROOF.gutter), false, DORMER.w);
  for (const v of DORMERS_G) { const gG = v > R.vP ? ROOF.gutterP : ROOF.gutter; dormer(B, frame(DORMER.frontG, 0, v, 0, -1), gG, (DORMER.frontG - ROOF.kneeG) / (ROOF.knee - gG), false, DORMER.w); }
  for (const d of DORMERS_G_FLAT) { const gG = d.v > R.vP ? ROOF.gutterP : ROOF.gutter; dormer(B, frame(DORMER.frontG, 0, d.v, 0, -1), gG, (DORMER.frontG - ROOF.kneeG) / (ROOF.knee - gG), true, d.w); }
  // the clustered stacks in the flat
  for (const S of STACKS) {
    const us = S.rows.map((r) => r.u), vs = S.rows.flatMap((r) => r.v);
    const a = Math.min(...us) - 0.38, b = Math.max(...us) + 0.38, c = Math.min(...vs) - 0.38, d = Math.max(...vs) + 0.38;
    B.box('quadStone', (a + b) / 2, (ROOF.knee - 0.3 + STACK.band) / 2, (c + d) / 2, b - a, STACK.band - ROOF.knee + 0.3, d - c, 0, {});
    B.box('bathDress', (a + b) / 2, STACK.band + 0.1, (c + d) / 2, b - a + 0.16, 0.2, d - c + 0.16, 0, { bottom: true });
    for (const r of S.rows) for (const v of r.v) {
      B.cyl('quadStone', r.u, STACK.band + 0.2, v, STACK.r, S.top - STACK.cap - STACK.band - 0.2, 8, false);
      B.cyl('bathDress', r.u, (STACK.band + S.top - STACK.cap) / 2, v, STACK.r + 0.04, 0.12, 8, false);      // the shafts' moulded band
    }
    B.box('bathDress', (a + b) / 2, S.top - STACK.cap / 2, (c + d) / 2, b - a + 0.1, STACK.cap, d - c + 0.1, 0, { bottom: true });
  }
  // the stacks on the wall line behind the Hall (octagonal flues on a plain base)
  for (const H of HALL_STACKS) {
    const wv = H.n * 0.62 + 0.3, u = (H.v > R.vHall ? R.uHall : R.uQ) + 0.35;
    B.box('quadStone', u, (ROOF.coping - 0.5 + 13.4) / 2, H.v, 0.9, 13.4 - ROOF.coping + 0.5, wv, 0, {});
    B.box('bathDress', u, 13.5, H.v, 1.04, 0.2, wv + 0.14, 0, { bottom: true });
    for (let i = 0; i < H.n; i++) { const v = H.v + (i - (H.n - 1) / 2) * 0.62; B.cyl('quadStone', u, 13.6, v, 0.25, H.top - 13.9, 8, false); B.cyl('bathDress', u, H.top - 0.3, v, 0.31, 0.3, 8, true, 0.27); }
  }
  // the room in the roof over Peryam's quad side behind the Hall
  K.prism(B, 'leadDark', [[R.uHall, ROOM_P.v0], [ROOF.kneeQ, ROOM_P.v0], [ROOF.kneeQ, ROOM_P.v1], [R.uHall, ROOM_P.v1]], ROOF.gutter, ROOM_P.top, { top: true, topKey: 'lead' });
  // two stone finials on the flat
  for (const v of FINIALS) { B.box('bathDress', mid, ROOF.ridge + 0.3, v, 0.32, 0.6, 0.32, 0, {}); B.cyl('bathDress', mid, ROOF.ridge + 0.6, v, 0.12, 0.3, 8, true, 0.2); B.cyl('bathDress', mid, ROOF.ridge + 0.9, v, 0.02, 0.22, 8, false, 0.12); }
}
/** a dormer in frame F (z 0 = its front at the slope's foot, -z into the roof), centred at x 0: white timber front with a
 *  two-light casement, slate cheeks and a slate gable (or a flat lead top); slope = run per metre of rise */
function dormer(B, F, gutter, slope, flat, w) {
  const D = DORMER, x0 = -w / 2, x1 = w / 2, ye = D.sill + D.h, ya = ye + D.rise, dE = (ye - gutter) * slope, dA = (ya - gutter) * slope;
  const front = flat ? [[x0, gutter], [x1, gutter], [x1, ye], [x0, ye]] : [[x0, gutter], [x1, gutter], [x1, ye], [0, ya], [x0, ye]];
  const win = rectPts(x0 + 0.13, D.sill, x1 - 0.13, ye - 0.14);
  wall(B, F, front, [{ pts: win, kind: 'win', d: 0.1, lights: flat && w > 2 ? 4 : 2, glass: 'sash', sill: false, mullionKey: 'white', mullionW: 0.07 }], 'white');
  B.push(F);
  for (const [x, nx] of [[x0, -1], [x1, 1]]) B.poly('slate', [[x, gutter, 0], [x, ye, 0], [x, ye, -dE]], [nx, 0, 0]);
  if (flat) B.poly('lead', [[x0 - 0.06, ye + 0.04, 0.08], [x1 + 0.06, ye + 0.04, 0.08], [x1 + 0.06, ye + 0.04, -dE - 0.1], [x0 - 0.06, ye + 0.04, -dE - 0.1]], [0, 1, 0]);
  else {
    B.poly('slate', [[x0 - 0.08, ye - 0.04, 0.12], [0, ya + 0.04, 0.12], [0, ya + 0.04, -dA], [x0 - 0.08, ye - 0.04, -dA]], [-1, 1.2, 0]);
    B.poly('slate', [[0, ya + 0.04, 0.12], [x1 + 0.08, ye - 0.04, 0.12], [x1 + 0.08, ye - 0.04, -dA], [0, ya + 0.04, -dA]], [1, 1.2, 0]);
    for (const [a, b] of [[[x0 - 0.06, ye - 0.02, 0.12], [0, ya + 0.02, 0.12]], [[0, ya + 0.02, 0.12], [x1 + 0.06, ye - 0.02, 0.12]]]) B.beam('white', a, b, 0.1, 0.05);   // bargeboards
  }
  B.pop();
}

// ------------------------------------------------------------------------------------------------ THE PASSAGE (staircase 5)
export function buildPassage(ctx) {
  const { B } = ctx, P = PASSAGE, vn = P.v - P.w / 2, vs = P.v + P.w / 2, ua = R.uQ + R.wall, ub = R.uG - R.wall, y = P.floor, D = QF.door;
  // the flagged floor through the wall reveals and the passage, and the apron outside the garden door
  const fl = [[R.uQ - 0.05, vn], [R.uG + 0.05, vn], [R.uG + 0.05, vs], [R.uQ - 0.05, vs]];
  B.flat('pavingSolid', fl, y + 0.01); ctx.floor(fl, y + 0.01);
  const A = P.apron, ap = [[R.uG, A.v0], [A.u1, A.v0], [A.u1, A.v1], [R.uG, A.v1]];
  // (a stone landing at the door's own level, FFL 64.48: survey; it steps down to the garden's gravel at its edge)
  K.prism(B, 'bathDress', ap, gardenY(P.v) - 0.2, y + 0.01, { top: true, topKey: 'pavingSolid' }); ctx.floor(ap, y + 0.01);
  // the passage's floor stands 0.18 above the quad's paving (survey FFL 64.47 against 64.29): a threshold step outside the
  // quad door (G: its form)
  const st = [[R.uQ - 0.34, P.v - D.w / 2 - 0.15], [R.uQ - 0.04, P.v - D.w / 2 - 0.15], [R.uQ - 0.04, P.v + D.w / 2 + 0.15], [R.uQ - 0.34, P.v + D.w / 2 + 0.15]];
  const ys = (quadY(P.v) + y) / 2;
  K.prism(B, 'bathDress', st, quadY(P.v) - 0.2, ys, { top: true, topKey: 'pavingSolid' }); ctx.floor(st, ys);
  // side walls (plastered), ceiling
  wall(B, frame(ua, 0, vn, 1, 0), rectPts(0, y - 0.1, ub - ua, P.ceil), [], 'plasterLit');
  wall(B, frame(ub, 0, vs, -1, 0), rectPts(0, y - 0.1, ub - ua, P.ceil), [], 'plasterLit');
  B.flat('plasterLit', [[ua, vn], [ub, vn], [ub, vs], [ua, vs]], P.ceil, [], true);
  // the outer walls' inner faces round the two doorways (the door narrower than the passage)
  const door = (s) => tudorPts(s, D.w, y + 0.01, y + 0.01 + D.spring, D.rise, 6);
  wall(B, frame(ua, 0, vs, 0, -1), rectPts(0, y - 0.1, P.w, P.ceil), [{ pts: door(P.w / 2), kind: 'none' }], 'plasterLit');
  wall(B, frame(ub, 0, vn, 0, 1), rectPts(0, y - 0.1, P.w, P.ceil), [{ pts: door(P.w / 2), kind: 'none' }], 'plasterLit');
  // the doors stand open, folded back against the passage's north wall
  for (const u of [ua + 0.02, ub - D.w - 0.02]) { B.push(frame(u, 0, vn + 0.06, 1, 0)); B.face('oakDoor', rectPts(0, y + 0.02, D.w, y + D.spring), [], 0); B.face('oakDoor', rectPts(0, y + 0.02, D.w, y + D.spring), [], -0.05, true); B.pop(); }
  ctx.lamp((ua + ub) / 2, P.ceil - 0.2, P.v);
}

// ------------------------------------------------------------------------------------------------ THE BED along the quad face
export function buildBed(ctx) {
  // the planted bed the creeper grows from (survey: its edge 1.15 m out from the face, parallel to it): soil a little
  // above the paving inside a low stone kerb, low plants along it; broken at door 6, the benches and the passage
  const { B } = ctx, b = BED, u0 = R.uQ - b.w, k = b.kerb, P = b.plants;
  let seed = P.seed;
  for (const [v0, v1] of b.runs) {
    const yk = Math.max(quadY(v0), quadY(v1));
    K.prism(B, 'bathDress', [[u0, v0], [u0 + k.w, v0], [u0 + k.w, v1], [u0, v1]], yk - 0.2, yk + k.h, { top: true });
    for (const [a, c] of [[v0, v0 + k.w], [v1 - k.w, v1]]) K.prism(B, 'bathDress', [[u0, a], [R.uQ, a], [R.uQ, c], [u0, c]], yk - 0.2, yk + k.h, { top: true });
    B.flat('flowerbed', [[u0 + k.w, v0 + k.w], [R.uQ, v0 + k.w], [R.uQ, v1 - k.w], [u0 + k.w, v1 - k.w]], yk + k.h - 0.04);
    const n = Math.max(1, Math.round((v1 - v0) / P.every));
    for (let i = 0; i < n; i++) {
      const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const v = v0 + ((i + 0.5) * (v1 - v0)) / n + (r() - 0.5) * 0.4, kind = P.kinds[Math.floor(r() * P.kinds.length)];
      shrub(ctx, u0 + 0.45 + r() * 0.25, yk + k.h - 0.04, v, { kind, r: P.r[0] + r() * (P.r[1] - P.r[0]), h: P.h[0] + r() * (P.h[1] - P.h[0]), seed: seed / 1000, lod: P.lod });
    }
  }
}

// ------------------------------------------------------------------------------------------------ CREEPER
export function buildCreeper(ctx, holes) {
  // Virginia creeper as it reads on the photographs: an irregular mass of many small overlapping leaves standing a few
  // centimetres proud of the stone, darker and greyer than a lawn, dense in the middle and thinning at its edges (a dark
  // under-layer only where it is thick), stopping short of every window and door. Built on a 0.3 m grid in the quad
  // face's frame: each cell is covered or not (below a ragged top, clear of the openings, thinning at the two ends); its
  // distance from the nearest bare cell sets how many leaves it carries; bare cells next to the mass get a few strays.
  const { B } = ctx, C = CREEPER;
  for (const [k, hex] of Object.entries(C.tints)) K.addCell(ctx.pack, k, 'leafA', hex);
  let seed = C.seed * 9301 + 49297; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const s0 = sQ(C.v0), s1 = sQ(C.v1), c = C.cell, H = holes.map(([a, b, y0, y1]) => [a - C.margin[0], b + C.margin[0], y0 - C.margin[1], y1 + C.margin[2]]);
  const nI = Math.ceil((s1 - s0) / c), nJ = Math.ceil(C.top[1] / c) + 2;
  // the ragged top: a smoothed random walk between C.top[0] and C.top[1]
  const tops = []; let t = (C.top[0] + C.top[1]) / 2, dt = 0;
  for (let i = 0; i < nI; i++) { dt = dt * 0.7 + (rnd() - 0.5) * 0.5; t = Math.max(C.top[0], Math.min(C.top[1], t + dt)); tops.push(t); }
  const inHole = (x, y, e = 0) => H.some(([a, b, y0, y1]) => x > a - e && x < b + e && y > y0 - e && y < y1 + e);
  const cov = [];
  for (let i = 0; i < nI; i++) {
    const x = s0 + (i + 0.5) * c, g = quadY(R.vN + x) + 0.02, end = Math.min(x - s0, s1 - x), col = [];
    for (let j = 0; j < nJ; j++) {
      const y = g + (j + 0.5) * c;
      let on = y < tops[i] && !inHole(x, y);
      if (on && end < C.fade) on = rnd() < 0.35 + 0.65 * (end / C.fade);     // thinning at the two ends
      col.push(on);
    }
    cov.push(col);
  }
  const at = (i, j) => i >= 0 && i < nI && j >= 0 && j < nJ && cov[i][j];
  // distance (in cells, up to 3) to the nearest bare cell
  const dist = cov.map((col, i) => col.map((on, j) => { if (!on) return 0; for (let d = 1; d <= 3; d++) for (let a = -d; a <= d; a++) for (let b = -d; b <= d; b++) if ((Math.abs(a) === d || Math.abs(b) === d) && !at(i + a, j + b) && !(j + b < 0)) return d; return 4; }));
  const keys = Object.keys(C.tints).filter((k) => k !== 'creeperBack');
  B.push(FQ());
  // the dark under-layer where the mass is thick, merged along each row
  for (let j = 0; j < nJ; j++) {
    let run = -1;
    for (let i = 0; i <= nI; i++) {
      const thick = i < nI && dist[i][j] >= 2;
      if (thick && run < 0) run = i;
      if (!thick && run >= 0) {
        // (its ends and its top and foot jittered so the layer's outline is never a clean rectangle)
        const xa = s0 + run * c - 0.02 + rnd() * 0.12, xb = s0 + i * c + 0.02 - rnd() * 0.12;
        const ya = quadY(R.vN + xa) + 0.02 + j * c - rnd() * 0.08, yb = quadY(R.vN + xb) + 0.02 + j * c - rnd() * 0.08;
        B.poly('creeperBack', [[xa, ya, C.proud[0]], [xb, yb, C.proud[0]], [xb, yb + c + rnd() * 0.08, C.proud[0]], [xa, ya + c + rnd() * 0.08, C.proud[0]]], [0, 0, 1]);
        run = -1;
      }
    }
  }
  // the leaves (fix-up pass: the single-triangle cards read as large triangles from the Front Quad's main path 5 - 10 m
  // away): LEAF-SHAPED cards (_exeter_plants.js leaf: a pointed oval of two triangles folded along its midrib), the same
  // number and spread, each turned and tilted a little off the face, overlapping
  const leaf = (x, y) => {
    if (inHole(x, y, -C.overhang)) return;
    const r = C.leaf[0] + rnd() * (C.leaf[1] - C.leaf[0]), z = C.proud[0] + 0.03 + rnd() * (C.proud[1] - C.proud[0]);
    const n = [(rnd() - 0.5) * 0.7, 0.15 + (rnd() - 0.3) * 0.5, 1], L = r * C.leafShape[0];
    leafCard(B, keys[Math.floor(rnd() * keys.length)], [x, y, z], [n[0] / Math.hypot(...n), n[1] / Math.hypot(...n), n[2] / Math.hypot(...n)], L, L * C.leafShape[1], rnd, 0.2);
  };
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
    const x0 = s0 + i * c, y0 = quadY(R.vN + x0 + c / 2) + 0.02 + j * c, d = dist[i][j];
    let n = 0;
    if (d >= 2) n = C.perCell[1];
    else if (d === 1) n = rnd() < 0.8 ? C.perCell[0] : 0;
    else if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) n = rnd() < C.stray ? 1 : 0;     // strays beyond the edge
    for (let k = 0; k < n; k++) leaf(x0 + rnd() * c, y0 + rnd() * c);
  }
  B.pop();
}

// ------------------------------------------------------------------------------------------------ PALMER'S TOWER
// A gate tower, built in its own frame (a east, c south from the outer NW corner; TOWER.toL gives LOCAL): four walls of
// rubble with ashlar quoins, the gate passage through it north-south (chamfered jambs at each mouth, a rib vault), the
// lead flat, battlements and the NE turret.
const towerFrame = () => frame(T.O[0], 0, T.O[1], Math.cos(T.th), Math.sin(T.th));
const tRing = (a0, a1, c0, c1) => [T.toL(a0, c0), T.toL(a1, c0), T.toL(a1, c1), T.toL(a0, c1)];
export function buildTower(ctx) {
  const { B } = ctx, P = T.pass, top = T.flat, gW = quadY(-21), gN = -0.1, gS = WAY.floor;
  const tl = (x, n, y) => { const w = n * 0.45 + (n - 1) * 0.14, ops = []; for (let i = 0; i < n; i++) { const c = x - w / 2 + 0.225 + i * 0.59; ops.push({ pts: tudorPts(c, 0.45, y[0], y[1] - 0.2, 0.2, 6), kind: 'win', glass: 'leaded', d: 0.3, sill: false }); } return { ops, box: [x - w / 2, x + w / 2, y[0], y[1]] }; };
  const am = (P.a0 + P.a1) / 2, aw = P.a1 - P.a0 - 2 * P.jamb;
  const gate = (x) => tudorPts(x, aw, P.floor, P.floor + P.arch.spring, P.arch.rise, 8);
  B.push(towerFrame());
  const faces = [
    // frame, length, ground, windows [[s, n, y]], the gate arch's s (or null)
    { F: frame(0, 0, 0, 0, 1), L: T.C, g: gW, win: [[T.west.c, 2, T.west.w2], [T.west.c, 1, T.west.w1]], gate: null, name: 'w' },
    { F: frame(0, 0, T.C, 1, 0), L: T.A, g: gS, win: T.south.w1.map((y) => [T.south.a, 1, y]), gate: am, name: 's' },
    { F: frame(T.A, 0, 0, -1, 0), L: T.A, g: gN, win: T.north.w1.map((y) => [T.A - T.north.a, 1, y]), gate: T.A - am, name: 'n' },
    { F: frame(T.A, 0, T.C, 0, -1), L: T.C, g: gN, win: [], gate: null, name: 'e' },
  ];
  for (const f of faces) {
    const gs = f.win.map(([s, n, y]) => tl(s, n, y)), ops = gs.flatMap((q) => q.ops);
    if (f.gate != null) ops.push({ pts: gate(f.gate), kind: 'void', d: P.jambD, revealKey: 'bathDress' });
    wall(B, f.F, rectPts(0, f.g - FOOT, f.L, top), ops, 'rubble');
    B.push(f.F);
    for (const q of gs) { K.label(B, q.box[0] - 0.08, q.box[1] + 0.08, q.box[3] + 0.06, 0.3); B.box('bathDress', (q.box[0] + q.box[1]) / 2, q.box[2] - 0.07, 0.05, q.box[1] - q.box[0] + 0.25, 0.14, 0.12, 0, { bottom: true }); }
    if (f.gate != null) {      // the arch's hood mould
      const hood = tudorPts(f.gate, aw + 0.34, P.floor, P.floor + P.arch.spring, P.arch.rise + 0.12, 8).slice(2);
      for (let i = 0; i < hood.length - 1; i++) B.beam('bathDress', [hood[i][0], hood[i][1], 0.05], [hood[i + 1][0], hood[i + 1][1], 0.05], 0.14, 0.1);
    }
    for (const y of T.strings) K.stringCourse(B, 'bathDress', -0.02, f.L + 0.02, y, 0.14, 0.08);
    K.stringCourse(B, 'bathDress', -0.06, f.L + 0.06, T.string + 0.2, 0.22, 0.16);
    // ashlar quoins up both corners
    for (let k = 0, y = f.g - 0.05; y < T.string - 0.1; k++, y += 0.42) { const lw = k % 2 ? 0.32 : 0.55; for (const x of [lw / 2, f.L - lw / 2]) B.box('bathDress', x, y + 0.2, 0.015, lw, 0.38, 0.03, 0, {}); }
    if (f.name === 'w') {
      const s = T.west.c, Tb = T.west.tablet;
      B.box('bathDress', s, (Tb[0] + Tb[1]) / 2, 0.06, Tb[2], Tb[1] - Tb[0], 0.12, 0, { bottom: true });       // the memorial: a plain tablet
      B.box('bathOld', s, (Tb[0] + Tb[1]) / 2, 0.125, Tb[2] - 0.2, Tb[1] - Tb[0] - 0.25, 0.01, 0, {});
      B.box('bathDress', s, Tb[1] + 0.08, 0.1, Tb[2] + 0.2, 0.16, 0.2, 0, { bottom: true });
      for (const b of [T.buttSW, T.buttNW]) K.buttress(B, 'bath', (b.c0 + b.c1) / 2, -0.4, b.c1 - b.c0, b.stages);
    }
    if (f.name === 's') sundial(B, T.south.dial.a, T.south.dial.y, T.south.dial.w);
    B.pop();
  }
  // THE GATE PASSAGE: the jambs' inner faces (closing up to the vault), the side walls, D01, the rib vault, the floor
  const Lp = P.a1 - P.a0, cIn0 = P.jambD, cIn1 = T.C - P.jambD;
  const inner = [[0, P.floor - 0.1], [Lp, P.floor - 0.1], [Lp, P.spring], [Lp / 2, P.crown], [0, P.spring]];
  wall(B, frame(P.a0, 0, cIn0, 1, 0), inner, [{ pts: gate(Lp / 2), kind: 'none' }], 'bath');           // north mouth, facing south
  wall(B, frame(P.a1, 0, cIn1, -1, 0), inner, [{ pts: gate(Lp / 2), kind: 'none' }], 'bath');          // south mouth, facing north
  wall(B, frame(P.a0, 0, cIn1, 0, -1), rectPts(0, P.floor - 0.1, cIn1 - cIn0, P.spring), [], 'bath');   // west wall, facing east
  const D = P.door;
  wall(B, frame(P.a1, 0, cIn0, 0, 1), rectPts(0, P.floor - 0.1, cIn1 - cIn0, P.spring),
    [{ pts: tudorPts(D.c - cIn0, D.w, P.floor + 0.01, P.floor + D.h - 0.25, 0.25, 6), kind: 'door', doorKey: 'oakDoor', d: 0.3 }], 'bath');   // east wall (D01), facing west
  B.push(frame(P.a1, 0, cIn0, 0, 1)); K.label(B, D.c - cIn0 - D.w / 2 - 0.08, D.c - cIn0 + D.w / 2 + 0.08, P.floor + D.h + 0.06, 0.3); B.pop();
  B.poly('bath', [[P.a0, P.spring, cIn0], [am, P.crown, cIn0], [am, P.crown, cIn1], [P.a0, P.spring, cIn1]], [0.5, -1, 0]);
  B.poly('bath', [[am, P.crown, cIn0], [P.a1, P.spring, cIn0], [P.a1, P.spring, cIn1], [am, P.crown, cIn1]], [-0.5, -1, 0]);
  const cm = (cIn0 + cIn1) / 2, rib = (a, b) => B.beam('bathDress', a, b, 0.14, 0.12);
  for (const a of [P.a0, P.a1]) for (const c of [cIn0, cIn1]) rib([a, P.spring, c], [am, P.crown - 0.05, cm]);
  rib([am, P.crown - 0.05, cIn0], [am, P.crown - 0.05, cIn1]);
  for (const c of [cIn0 + (cm - cIn0) / 2, cm + (cIn1 - cm) / 2]) { rib([P.a0, P.spring, c], [am, P.crown - 0.05, c]); rib([P.a1, P.spring, c], [am, P.crown - 0.05, c]); }
  const fl = [[P.a0, 0], [P.a1, 0], [P.a1, T.C], [P.a0, T.C]];
  K.prism(B, 'bathDress', fl, P.floor - 0.35, P.floor, { top: true, topKey: 'pavingSolid' });
  // the top: lead flat, battlemented parapet (round the turret), the turret
  const t = 0.4, i0 = t / 2, i1 = T.A - t / 2, j0 = t / 2, j1 = T.C - t / 2, U = T.turret;
  B.flat('lead', [[0, 0], [T.A, 0], [T.A, T.C], [0, T.C]], top);
  K.parapet(B, 'rubble', [[U.a0, j0], [i0, j0], [i0, j1], [i1, j1], [i1, U.c1]], top, T.parapet - top, t, { battle: T.merlon, coping: 'bathDress' });
  const tr = [[U.a0, U.c0], [U.a1, U.c0], [U.a1, U.c1], [U.a0, U.c1]];
  K.prism(B, 'rubble', tr, top, U.top);
  B.flat('lead', tr, U.top - 0.3);
  K.parapet(B, 'rubble', [[U.a0 + 0.15, U.c0 + 0.15], [U.a1 - 0.15, U.c0 + 0.15], [U.a1 - 0.15, U.c1 - 0.15], [U.a0 + 0.15, U.c1 - 0.15], [U.a0 + 0.15, U.c0 + 0.15]], U.top - 0.02, 0.07, 0.3, { battle: { merlon: 0.55, gap: 0.4, h: U.merlonTop - U.top - 0.05 } });
  B.push(frame(U.a0, 0, U.c0, 0, 1)); B.unit('oakDoor', rectPts(0.7, top + 0.02, 1.5, top + 2.0), 0.02); K.label(B, 0.7, 1.5, top + 2.08, 0.2); B.pop();      // door onto the roof (west side)
  B.pop();
  // floors, lamps (LOCAL)
  ctx.floor(tRing(P.a0, P.a1, 0, T.C), P.floor);
  const lc = T.toL(am, (cIn0 + cIn1) / 2); ctx.lamp(lc[0], P.crown - 0.4, lc[1]);
  lamp(ctx, frame(0, 0, 0, 0, 1), T.west.c + 0.9, LAMPS.find((l) => l.at === 'tower').y, (s, z) => T.toL(-z, s), towerFrame());
}
function sundial(B, x, [y0, y1], w) {
  B.box('bathDress', x, (y0 + y1) / 2, 0.04, w, y1 - y0, 0.08, 0, { bottom: true });
  B.box('white', x, (y0 + y1) / 2, 0.085, w - 0.12, y1 - y0 - 0.12, 0.01, 0, {});
  const cx = x, cy = y1 - 0.15;
  for (let k = 0; k <= 8; k++) { const a = Math.PI * (1.08 + (0.84 * k) / 8); B.beam('ironBlack', [cx, cy, 0.092], [cx + Math.cos(a) * (w / 2 - 0.1), cy + Math.sin(a) * (y1 - y0 - 0.3), 0.092], 0.02, 0.005); }
  B.poly('ironBlack', [[cx, cy, 0.09], [cx, cy - 0.55, 0.09], [cx, cy, 0.42]], [1, 0, 0]);
  B.poly('ironBlack', [[cx, cy - 0.55, 0.09], [cx, cy, 0.09], [cx, cy, 0.42]], [-1, 0, 0]);
}

// ------------------------------------------------------------------------------------------------ THE SLOT AND THE WAY ROUND (LOCAL)
/** the range's north end in LOCAL: its corners and its v at u */
function northEndL() {
  const a = RANGE.toL(R.uQ, R.vN), b = RANGE.toL(R.uG, R.vNg);
  return { a, b, vR: (u) => a[1] + ((u - a[0]) / (b[0] - a[0])) * (b[1] - a[1]) };
}
export function buildWay(ctx) {
  const { B } = ctx, W = WAY, S = W.screen, A = W.arch, y = W.floor, vT = W.vT, { a: nA, b: nB, vR } = northEndL(), G = W.gate;
  // the slot's floor from the archway to the gate; the yard behind the range east of the gate
  const fl = [[S.u0, vT(S.u0)], [G.u, vT(G.u)], [G.u, vR(G.u)], [nA[0], nA[1]], [S.u0, S.vS]];
  B.flat('pavingSolid', fl, y + 0.01); ctx.floor(fl, y + 0.01);
  const yy = gardenY(-15) + 0.03, ap = [[G.u, vT(G.u)], [W.apron.u1, vT(W.apron.u1)], [W.apron.u1, W.apron.v1], [nB[0] + 0.1, W.apron.v1], [nB[0], nB[1]], [G.u, vR(G.u)]];
  B.flat('pavingSolid', ap, yy); ctx.floor(ap, yy);
  // the archway's coped wall across the slot's quad mouth (front, back, its south end) and the arch's hood
  const v0 = vT(S.u0), wd = S.vS - v0, arch = (s) => tudorPts(s, A.w, y, y + A.spring, A.rise, 8);
  wall(B, frame(S.u0, 0, v0, 0, 1), rectPts(0, y - FOOT, wd, S.top), [{ pts: arch(wd / 2), kind: 'void', d: S.u1 - S.u0, revealKey: 'bathDress' }], 'quadStone');
  wall(B, frame(S.u1, 0, S.vS, 0, -1), rectPts(0, y - FOOT, wd, S.top), [{ pts: arch(wd / 2), kind: 'none' }], 'quadStone');
  wall(B, frame(S.u0, 0, S.vS, 1, 0), rectPts(0, y - FOOT, S.u1 - S.u0, S.top), [], 'quadStone');
  B.push(frame(S.u0, 0, v0, 0, 1));
  const hood = tudorPts(wd / 2, A.w + 0.3, y, y + A.spring, A.rise + 0.1, 8).slice(2);
  for (let i = 0; i < hood.length - 1; i++) B.beam('bathDress', [hood[i][0], hood[i][1], 0.05], [hood[i + 1][0], hood[i + 1][1], 0.05], 0.12, 0.1);
  B.pop();
  B.box('bathDress', (S.u0 + S.u1) / 2, S.top + 0.07, (v0 + S.vS) / 2, S.u1 - S.u0 + 0.14, 0.14, wd + 0.1, 0, {});
  // the covered way under Chapel Row's south end: ceiling, the block over it (west / east faces, top), Chapel Row's
  // south face under it, a lintel band over the way in
  const C = W.cover, cr = [[C.u0, vT(C.u0)], [C.u1, vT(C.u1)], [C.u1, vR(C.u1)], [C.u0, vR(C.u0)]];
  B.flat('plasterLit', cr, C.ceil, [], true);
  wall(B, frame(C.u0, 0, vT(C.u0), 0, 1), rectPts(0, C.ceil, vR(C.u0) - vT(C.u0), C.top), [], 'rubble');
  wall(B, frame(C.u1, 0, vR(C.u1), 0, -1), rectPts(0, C.ceil, vR(C.u1) - vT(C.u1), C.top), [], 'rubble');
  const Ln = Math.hypot(C.u1 - C.u0, vT(C.u1) - vT(C.u0));
  wall(B, frame(C.u0, 0, vT(C.u0) + 0.01, (C.u1 - C.u0) / Ln, (vT(C.u1) - vT(C.u0)) / Ln), rectPts(0, y - FOOT, Ln, C.top), [], 'rubble');
  B.flat('lead', cr, C.top);
  B.box('bathDress', C.u0 - 0.06, C.ceil + 0.08, (vT(C.u0) + vR(C.u0)) / 2, 0.12, 0.16, vR(C.u0) - vT(C.u0), 0, {});
  // the gate across the slot at its east end (survey line): a wall to the covered way's ceiling with an open doorway
  const g0 = vT(G.u), gl = vR(G.u) - g0, door = rectPts(gl / 2 - G.w / 2, y + 0.01, gl / 2 + G.w / 2, y + G.h);
  wall(B, frame(G.u - G.t / 2, 0, g0, 0, 1), rectPts(0, y - FOOT, gl, C.ceil), [{ pts: door, kind: 'void', d: G.t, revealKey: 'bathDress' }], 'rubble');
  wall(B, frame(G.u + G.t / 2, 0, g0 + gl, 0, -1), rectPts(0, y - FOOT, gl, C.ceil), [{ pts: door, kind: 'none' }], 'rubble');
}

// ------------------------------------------------------------------------------------------------ COLLIDERS
/** the range's colliders: called with the range's ctx (range coordinates) */
export function registerRangeSolids(ctx) {
  const seg = (a, b) => ctx.seg(a[0], a[1], b[0], b[1]);
  const P = PASSAGE, hw = QF.door.w / 2, pv0 = P.v - hw, pv1 = P.v + hw, ua = R.uQ + R.wall, ub = R.uG - R.wall;
  // quad face (split at the passage door), the ends (not square), the garden face (split at the door)
  seg([R.uQ, R.vN], [R.uQ, pv0]); seg([R.uQ, pv1], [R.uQ, R.vHall]);
  seg([R.uHall, vSouth(R.uHall)], [R.uG, R.vSg]); seg([R.uQ, R.vN], [R.uG, R.vNg]);
  // garden face between the bays and the door; the bays round
  const bays = GARDEN_COLS.filter((c) => c.k === 'bay').map((c) => c.v).sort((a, b) => a - b);
  let cur = R.vNg;
  const stops = [[pv0, pv1], ...bays.map((v) => [v - BAY.base / 2, v + BAY.base / 2])].sort((a, b) => a[0] - b[0]);
  for (const [a, b] of stops) { seg([R.uG, cur], [R.uG, a]); cur = b; }
  seg([R.uG, cur], [R.uG, R.vSg]);
  for (const v of bays) { const r = bayRing(v); seg(r[0], r[1]); seg(r[1], r[2]); seg(r[2], r[3]); }
  // the passage: the door reveals, the inner end walls, the side walls
  for (const [u0, u1] of [[R.uQ, ua], [ub, R.uG]]) { seg([u0, pv0], [u1, pv0]); seg([u0, pv1], [u1, pv1]); }
  const vn = P.v - P.w / 2, vs = P.v + P.w / 2;
  for (const u of [ua, ub]) { seg([u, vn], [u, pv0]); seg([u, pv1], [u, vs]); }
  seg([ua, vn], [ub, vn]); seg([ua, vs], [ub, vs]);
  // the bed's kerb is low (0.1): walkable, no collider
}
/** Palmer's Tower, the archway's wall and the gate (LOCAL) */
export function registerTowerSolids(ctx) {
  const P = T.pass;
  ctx.solid(tRing(0, P.a0, 0, T.C)); ctx.solid(tRing(P.a1, T.A, 0, T.C));                      // the side walls
  for (const [c0, c1] of [[0, P.jambD], [T.C - P.jambD, T.C]]) { ctx.solid(tRing(P.a0, P.a0 + P.jamb, c0, c1)); ctx.solid(tRing(P.a1 - P.jamb, P.a1, c0, c1)); }
  for (const b of [T.buttSW, T.buttNW]) ctx.solid(tRing(-b.stages[0][1], 0, b.c0, b.c1));
  const W = WAY, S = W.screen, vT = W.vT, v0 = vT(S.u0), m = (v0 + S.vS) / 2, a0 = m - W.arch.w / 2, a1 = m + W.arch.w / 2;
  ctx.solid([[S.u0, v0], [S.u1, v0], [S.u1, a0], [S.u0, a0]]); ctx.solid([[S.u0, a1], [S.u1, a1], [S.u1, S.vS], [S.u0, S.vS]]);
  const G = W.gate, { vR } = northEndL(), g0 = vT(G.u), g1 = vR(G.u), gm = (g0 + g1) / 2;
  for (const [p, q] of [[g0, gm - G.w / 2], [gm + G.w / 2, g1]]) ctx.solid([[G.u - G.t / 2, p], [G.u + G.t / 2, p], [G.u + G.t / 2, q], [G.u - G.t / 2, q]]);
  ctx.seg(W.cover.u0, vT(W.cover.u0), G.u, vT(G.u));                                           // Chapel Row's south face under the cover
}
