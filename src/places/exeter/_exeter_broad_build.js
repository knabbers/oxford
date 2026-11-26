// Exeter College, STANDALONE model, part 'broad' (B08): the build functions. Called by exeter_broad.js with ctx.B already
// in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from _exeter_broad_plan.js
// (sources and K / G there). The street range, the tower and Underwood's part are drawn in the RANGE frame (x east along
// Broad Street from the Thomas Wood Building's party wall, z into the quad): one matrix pushed (frame(P0, E)). The
// staircase 9 block and the courtyard are drawn in LOCAL. Local helpers written here (not in the kit): pointed-light
// groups, a cheap flat roundel, a canted oriel of stacked bands, a lead-hipped dormer, railings, a W1 wall lantern.
import * as K from './_exeter_kit.js';
import * as P from './_exeter_broad_plan.js';
import { quadY, SETTS_TINT } from './_exeter_margary_plan.js';

const { frame, wall, rectPts, pointedPts } = K;
const { SC, TW, UW, EB, FOOT } = P;
const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [a, ya] = tab[i - 1], [b, yb] = tab[i]; return ya + ((x - a) / (b - a)) * (yb - ya); } return tab[tab.length - 1][1]; };
const streetY = (x) => interp(P.STREET, x);
const qyR = (x, z) => { const l = P.toL(x, z); return quadY(l[0], l[1]); };      // Margary Quad's paving at a range point
const RANGE = () => frame(P.P0[0], 0, P.P0[1], P.E[0], P.E[1]);
// wall frames in the RANGE frame: street faces look north (s runs WEST from xEnd), quad faces look south (s = x)
const FS = (xEnd, z = 0) => frame(xEnd, 0, z, -1, 0);
const FQ = (z) => frame(0, 0, z, 1, 0);

// ------------------------------------------------------------------------------------------------ small helpers
/** n lights centred at s from y0 to y1: pointed heads of `rise` (0: square); returns { ops, box } */
function lightGroup(s, n, y0, y1, lw, mull, rise, d, glass = 'leaded') {
  const w = n * lw + (n - 1) * mull, s0 = s - w / 2, ops = [];
  for (let i = 0; i < n; i++) {
    const c = s0 + lw / 2 + i * (lw + mull);
    ops.push({ pts: rise > 0 ? pointedPts(c, lw, y0, y1 - rise, rise, 3) : rectPts(c - lw / 2, y0, c + lw / 2, y1), kind: 'win', glass, d, sill: false });
  }
  return { ops, box: [s0, s0 + w, y0, y1] };
}
/** square labels and sills over window boxes, in the CURRENT frame */
function dressings(B, boxes, label = true) {
  for (const [x0, x1, y0, y1] of boxes) {
    if (label) K.label(B, x0 - 0.06, x1 + 0.06, y1 + 0.08, 0.36, 'bathDress');
    B.box('bathDress', (x0 + x1) / 2, y0 - 0.08, 0.06, x1 - x0 + 0.24, 0.16, 0.12, 0, { bottom: true });
  }
}
/** a flat moulded ring (8 quads) in the CURRENT frame's XY plane at z */
function roundel(B, x, y, r, z = 0.02, key = 'bathOld') {
  const t = Math.min(0.05, r * 0.3);
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    B.poly(key, [[x + c0 * (r - t), y + s0 * (r - t), z], [x + c1 * (r - t), y + s1 * (r - t), z], [x + c1 * r, y + s1 * r, z], [x + c0 * r, y + s0 * r, z]], [0, 0, 1]);
  }
}
/** coped rakes, apex block and kneelers of a gable in the CURRENT wall frame: shoulders (a, yE), (b, yE), apex (m, yA) */
function gableCoping(B, a, b, yE, yA) {
  const m = (a + b) / 2;
  B.beam('bathDress', [a - 0.12, yE - 0.02, 0.06], [m, yA + 0.1, 0.06], 0.4, 0.16);
  B.beam('bathDress', [m, yA + 0.1, 0.06], [b + 0.12, yE - 0.02, 0.06], 0.4, 0.16);
  B.box('bathDress', m, yA + 0.3, 0.0, 0.26, 0.42, 0.26, 0, {});
  K.pinnacle(B, 'bathDress', m, 0.0, yA + 0.5, yA + 0.62, 0.18, 0.35);
  for (const x of [a, b]) B.box('bathDress', x, yE + 0.12, 0.08, 0.42, 0.3, 0.42, 0, { bottom: true });
}
function pipe(B, s, yGround, yTop, z = 0.13) {
  B.cyl('leadDark', s, yGround - 0.05, z, 0.042, yTop - yGround, 6, false);
  B.box('leadDark', s, yTop + 0.13, z, 0.26, 0.28, 0.22, 0, { bottom: true });
}
/** railings between points a, b ([x, z] in the CURRENT frame) on ground y0 (number or (t) => y), h high */
function railing(B, a, b, y0, h = 1.0, pitch = 0.14) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / pitch)), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  const yAt = (t) => (typeof y0 === 'function' ? y0(t) : y0);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = yAt(t), post = i % 12 === 0;
    B.box('ironBlack', x, y + h / 2, z, post ? 0.05 : 0.018, h, post ? 0.05 : 0.018, ry, { top: false });
    if (!post) B.box('ironBlack', x, y + h + 0.05, z, 0.03, 0.1, 0.03, 0, { top: false });
  }
  for (const yy of [0.1, h - 0.05]) B.beam('ironBlack', [a[0], yAt(0) + yy, a[1]], [b[0], yAt(1) + yy, b[1]], 0.035, 0.025);
}
/** a W1 lantern on a 0.59 m bracket from a wall point (x, y, z) outwards along (nx, nz), in the RANGE or LOCAL frame */
function w1(B, x, y, z, nx, nz) {
  const arm = 0.59, lx = x + nx * arm, lz = z + nz * arm;
  B.box('ironBlack', x + nx * 0.02, y + 0.2, z + nz * 0.02, Math.abs(nz) * 0.25 + 0.04, 0.38, Math.abs(nx) * 0.25 + 0.04, 0, {});
  B.beam('ironBlack', [x, y + 0.32, z], [lx, y + 0.32, lz], 0.035);
  B.beam('ironBlack', [x, y, z], [x + nx * arm * 0.6, y + 0.3, z + nz * arm * 0.6], 0.03);
  return K.lantern(B, lx, y - 0.02, lz, { size: 0.25 });
}

// ------------------------------------------------------------------------------------------------ the canted oriel
/** in a pushed FACE frame (x = s along the wall, z outwards): a canted oriel centred at sc, front O.front wide, projecting
 *  O.proj with 45-degree sides; bands bottom-up: { kind: 'corbel' | 'solid' | 'panel' | 'win' | 'cornice' | 'parapet',
 *  y0, y1, front: lights in the front facet } */
function orielBay(B, sc, O, bands) {
  const hf = O.front / 2, p = O.proj;
  const ring = (k = 1, e = 0) => [[sc - (hf + p) * k - e, 0], [sc - hf * k - e * 0.4, p * k + e], [sc + hf * k + e * 0.4, p * k + e], [sc + (hf + p) * k + e, 0]];
  const r = ring(), facets = [[r[0], r[1]], [r[1], r[2]], [r[2], r[3]]].map(([a, b]) => ({ F: frame(a[0], 0, a[1], b[0] - a[0], b[1] - a[1]), L: Math.hypot(b[0] - a[0], b[1] - a[1]) }));
  const roundels = (y, rr) => { for (const [i, f] of facets.entries()) { const n = i === 1 ? 4 : 2; B.push(f.F); for (let k = 0; k < n; k++) roundel(B, ((k + 0.5) * f.L) / n, y, rr); B.pop(); } };
  for (const bd of bands) {
    const { y0, y1 } = bd;
    if (bd.kind === 'corbel') {
      const h = (y1 - y0) / 3;
      [0.35, 0.65, 0.9].forEach((k, i) => K.prism(B, i === 1 ? 'bathOld' : 'bathDress', ring(k), y0 + h * i, y0 + h * (i + 1), { bottom: true }));
    } else if (bd.kind === 'solid') K.prism(B, 'bath', ring(), y0, y1, {});
    else if (bd.kind === 'cornice') K.prism(B, 'bathDress', ring(1, 0.07), y0, y1, { bottom: true, top: true });
    else if (bd.kind === 'panel' || bd.kind === 'parapet') {
      K.prism(B, 'bathDress', ring(1, 0.04), y0, y0 + 0.1, { bottom: true });
      K.prism(B, 'bathDress', ring(), y0 + 0.1, y1, { top: bd.kind === 'parapet' });
      if (bd.kind === 'parapet') K.prism(B, 'bathDress', ring(1, 0.06), y1, y1 + 0.1, { top: true, bottom: true });
      roundels((y0 + 0.1 + y1) / 2, Math.min(0.2, (y1 - y0) * 0.33));
    } else if (bd.kind === 'win') {
      for (const [i, f] of facets.entries()) {
        const n = i === 1 ? bd.front : 1, lw = i === 1 ? Math.min(0.62, (f.L - 0.4 - (n - 1) * 0.16) / n) : Math.min(0.5, f.L - 0.4);
        const lo = lightGroup(f.L / 2, n, y0 + 0.08, y1 - 0.1, lw, 0.16, Math.min(0.35, lw * 0.6), 0.14, 'sash').ops;
        if (y1 - y0 > 2.4) for (const o of lo) o.transoms = [y1 - 0.75];
        wall(B, f.F, rectPts(0, y0, f.L, y1), lo, 'bath');
        B.push(f.F); for (const x of [0.07, f.L - 0.07]) B.box('bathDress', x, (y0 + y1) / 2, 0.06, 0.14, y1 - y0, 0.14, 0, {}); B.pop();
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ stacks
/** clustered round flues on a square base, in the CURRENT frame, base standing from y0 */
function clusterStack(B, x, z, y0, top, n = 4) {
  const w = 0.55 * Math.ceil(n / 2) + 0.2, d = n > 2 ? 1.1 : 0.6, baseTop = top - 1.9;
  B.box('bath', x, (y0 + baseTop) / 2, z, w, baseTop - y0, d, 0, {});
  B.box('bathDress', x, baseTop + 0.08, z, w + 0.14, 0.16, d + 0.14, 0, { bottom: true });
  const cols = Math.ceil(n / 2), rows = n > 2 ? 2 : 1;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const cx = x + (i - (cols - 1) / 2) * 0.55, cz = z + (j - (rows - 1) / 2) * 0.55;
    B.cyl('bath', cx, baseTop + 0.16, cz, 0.21, top - baseTop - 0.36, 8, false);
    B.cyl('bathDress', cx, top - 0.2, cz, 0.27, 0.2, 8, true, 0.22);
  }
}

// ================================================================================================ SCOTT'S PART
export function buildScott(ctx) {
  const { B } = ctx, FOOT = P.FOOT_ST;
  B.push(RANGE());
  const eav = SC.eaves, apexOf = (w) => Math.min(15.6, eav + (w / 2) * 1.9), crossR = (ap) => Math.min(ap - 0.3, SC.ridge - 0.04);
  // ---- the street front, bay by bay (FS: s = 21.6 - x)
  const s = (x) => SC.x1 - x;
  for (const bay of P.SC_STREET) {
    const a = s(bay.x1), b = s(bay.x0), m = (a + b) / 2, ops = [], boxes = [], plain = [];
    if (bay.kind === 'stair') {
      const S = P.SC_STAIR, c = s(bay.cols[0]);
      const g = lightGroup(c, 1, S.g[0], S.g[1], 0.5, 0, 0.3, SC.reveal); ops.push(...g.ops); plain.push(g.box);
      for (const y of [S.f, S.s]) {
        const q = lightGroup(c, 2, y[0], y[1] - 0.5, S.lw, S.mull, S.rise, SC.reveal); ops.push(...q.ops); plain.push(q.box);
        const rr = S.roundel; ops.push({ pts: Array.from({ length: 8 }, (_, k) => [c + Math.cos((k / 8) * 6.283) * rr, y[1] - 0.25 + Math.sin((k / 8) * 6.283) * rr]), kind: 'win', glass: 'leaded', d: SC.reveal, sill: false });
      }
    } else {
      for (const col of bay.cols) for (const y of [SC.g, SC.f, SC.s]) { const q = lightGroup(s(col), 2, y[0], y[1], SC.lightW, SC.mull, SC.headRise, SC.reveal, 'sash'); ops.push(...q.ops); boxes.push(q.box); }
    }
    let outline;
    if (bay.kind === 'gable') {
      const ap = apexOf(bay.x1 - bay.x0), G = SC.gableWin, q = lightGroup(m, 2, G.sill, G.spring + G.rise, G.lw, G.mull, G.rise, 0.2, 'sash');
      ops.push(...q.ops); plain.push(q.box);
      outline = [[a, FOOT], [b, FOOT], [b, eav], [m, ap], [a, eav]];
    } else outline = rectPts(a, FOOT, b, eav);
    wall(B, FS(SC.x1), outline, ops, 'bath');
    B.push(FS(SC.x1));
    dressings(B, boxes); dressings(B, plain, false);
    if (bay.kind === 'gable') gableCoping(B, a, b, eav, apexOf(bay.x1 - bay.x0));
    if (bay.kind === 'stair') for (const y of [P.SC_STAIR.f, P.SC_STAIR.s]) { const c = s(bay.cols[0]); B.beam('bathDress', [c - 0.62, y[1] - 0.55, 0.05], [c, y[1] + 0.15, 0.05], 0.12, 0.1); B.beam('bathDress', [c, y[1] + 0.15, 0.05], [c + 0.62, y[1] - 0.55, 0.05], 0.12, 0.1); }
    if (bay.x0 > 0) B.box('bathOld', b, (FOOT + eav - 0.4) / 2, 0.06, 0.34, eav - 0.4 - FOOT, 0.12, 0, {});      // buttress strip
    B.pop();
    if (bay.kind !== 'gable') K.parapet(B, 'bath', [[bay.x0, 0.15], [bay.x1, 0.15]], eav, SC.battle.h, 0.3, { coping: 'bathDress', battle: { merlon: SC.battle.merlon, gap: SC.battle.gap, h: SC.battle.mh } });
    else { const ap = apexOf(bay.x1 - bay.x0); K.roof(B, 'slate', bay.x0 + 0.12, bay.x1 - 0.12, 0.25, SC.ridgeZ, eav, crossR(ap) - eav, { axis: 'z', ends: ['open', 'open'], ov: 0.1 }); }
  }
  B.push(FS(SC.x1));
  const sx0 = 0, sx1 = SC.x1, gb = FOOT;
  K.stringCourse(B, 'bathOld', sx0, sx1, SC.plinth, SC.plinth - gb, 0.12);
  K.stringCourse(B, 'bathDress', sx0, sx1, SC.plinth + 0.1, 0.1, 0.18);
  for (const y of SC.strings) K.stringCourse(B, 'bathDress', sx0, sx1, y, 0.17, 0.1);
  K.stringCourse(B, 'bathDress', sx0, sx1, eav, SC.cornice, 0.2);
  for (const x of P.SC_PIPES) pipe(B, s(x), streetY(x), eav - 0.4, 0.16);
  B.pop();
  // ---- the quad front (third pass: the 16/01398 elevation, the 2008 / 2016 photographs, the survey; the plan's QF)
  const Fq = P.QF, Q = (h) => Fq.base + h, cornTop = Q(Fq.cornice[1]), zB = SC.depth + SC.bayProj, zQ = 7.75, yQ = cornTop + 0.14;
  buildQuadFace(ctx, Q, cornTop, zB);
  buildRamps(ctx, zB);
  // the quad's lanterns (W1): one on the wide bay (K), one on staircase 10's recess (G)
  for (const L of P.LAMPS_Q) { const z = L.z ?? zB, y = qyR(L.x, zB) + L.y, p = w1(B, L.x, y, z, 0, 1), l = P.toL(p[0], p[2]); ctx.lamp(l[0], p[1], l[1]); }
  // ---- the main roof (third pass): the street slope from the street's eaves (11.7) to the ridge 4.45 m in, the quad slope down
  // to the gutter behind the quad face's battlements (cornice top + 0.14) at z 7.75; the party-wall gable at x 0; lead
  // gutters behind the strip's parapet
  const ov = 0.25, slS = (SC.ridge - eav) / SC.ridgeZ, yS = eav - ov * slS;
  B.poly('slate', [[0, yS, -ov], [SC.x1, yS, -ov], [SC.x1, SC.ridge, SC.ridgeZ], [0, SC.ridge, SC.ridgeZ]], [0, 1, -1 / slS]);
  B.poly('slate', [[0, SC.ridge, SC.ridgeZ], [SC.x1, SC.ridge, SC.ridgeZ], [SC.x1, yQ, zQ], [0, yQ, zQ]], [0, 1, (zQ - SC.ridgeZ) / (SC.ridge - yQ)]);
  B.beam('leadDark', [0, SC.ridge + 0.03, SC.ridgeZ], [SC.x1, SC.ridge + 0.03, SC.ridgeZ], 0.2, 0.08);
  B.poly('bath', [[0, eav, 0], [0, cornTop, zQ], [0, yQ, zQ], [0, SC.ridge, SC.ridgeZ]], [-1, 0, 0]);
  for (const bay of P.SC_QUAD) if (bay.kind !== 'gable' && bay.z - 0.3 > zQ + 0.05) B.flat('lead', [[bay.x0, zQ], [bay.x1, zQ], [bay.x1, bay.z - 0.3], [bay.x0, bay.z - 0.3]], yQ - 0.02);
  for (const S of P.SC_STACKS) clusterStack(B, S.x, S.z, SC.ridge - 1.2, S.top, S.n);
  B.pop();
}

// ------------------------------------------------------------------------------------------------ the quad face's parts (third pass)
/** a pointed arc of beams (a hood mould or a relieving arch) in the CURRENT wall frame; stops: short drops at the springing */
function arcBeam(B, x, w, spring, rise, z, th, dp, key = 'bathDress', stops = false) {
  const a = pointedPts(x, w, spring, spring, rise, 8).slice(2);
  for (let i = 0; i < a.length - 1; i++) B.beam(key, [a[i][0], a[i][1], z], [a[i + 1][0], a[i + 1][1], z], th, dp);
  if (stops) for (const sx of [-1, 1]) B.box(key, x + (sx * w) / 2, spring - 0.12, z, 0.16, 0.24, dp + 0.02, 0, {});
}
/** PLATE TRACERY in the CURRENT wall frame (the face's own ops must hold { pts: the arch, kind: 'none' }): the containing
 *  pointed arch's reveal, a stone plate set back d holding n pointed lights and an optional roundel, a sill, a hood mould,
 *  an optional relieving arch of voussoirs. A: { x, w, sill, spring, rise, n, lw, mull, lApex, lRise, roundel, d, hood, relieve } */
export function plateWindow(B, A) {
  const arch = pointedPts(A.x, A.w, A.sill, A.spring, A.rise, 8), d = A.d ?? 0.16;
  B.reveal('bathDress', arch, 0, -d, false);
  const g = lightGroup(A.x, A.n, A.sill, A.lApex, A.lw, A.mull, A.lRise, 0.12, A.glass || 'sash'), ops = [...g.ops];
  if (A.transoms) for (const o of g.ops) o.transoms = A.transoms;
  if (A.roundel) {
    const r = A.roundel, cy = (A.lApex + A.spring + A.rise) / 2;
    ops.push({ pts: Array.from({ length: 8 }, (_, k) => [A.x + Math.cos(((k + 0.5) / 8) * 6.283) * r, cy + Math.sin(((k + 0.5) / 8) * 6.283) * r]), kind: 'win', glass: 'leaded', d: 0.1, sill: false });
  }
  wall(B, frame(0, 0, -d, 1, 0), arch, ops, A.plateKey || 'bath');
  B.box('bathDress', A.x, A.sill - 0.08, 0.06, A.w + 0.2, 0.16, 0.12, 0, { bottom: true });
  if (A.hood !== false) arcBeam(B, A.x, A.w + 0.26, A.spring, A.rise + 0.13, 0.06, 0.12, 0.1, 'bathDress', true);
  if (A.relieve) arcBeam(B, A.x, A.w + 0.75, A.spring - 0.05, A.rise + 0.42, 0.015, 0.3, 0.03, 'bathOld');
}
/** a gabled dormer in wall frame F (z = 0 its front, +z out, s along the face) centred at s = x: D { w, sill, eaves, apex,
 *  finial, lw, lightApex } (absolute y), running `depth` back into the slope. o.key front and cheeks, o.roofKey, o.lights,
 *  o.barge (a key: bargeboards on the rakes) */
export function gabledDormer(B, F, x, D, depth, o = {}) {
  const x0 = x - D.w / 2, x1 = x + D.w / 2, key = o.key || 'bath', rk = o.roofKey || 'lead', n = o.lights || 1, e = 0.1;
  const g = lightGroup(x, n, D.sill + 0.15, D.lightApex, D.lw, 0.1, Math.min(0.35, D.lw * 0.8), 0.1, o.glass || 'leaded');
  wall(B, F, [[x0, D.sill], [x1, D.sill], [x1, D.eaves], [x, D.apex], [x0, D.eaves]], g.ops, key);
  B.push(F);
  B.poly(key, [[x0, D.sill, -depth], [x0, D.sill, 0], [x0, D.eaves, 0], [x0, D.eaves, -depth]], [-1, 0, 0]);
  B.poly(key, [[x1, D.sill, 0], [x1, D.sill, -depth], [x1, D.eaves, -depth], [x1, D.eaves, 0]], [1, 0, 0]);
  B.poly(rk, [[x0 - e, D.eaves - 0.04, e], [x, D.apex + 0.05, e], [x, D.apex + 0.05, -depth], [x0 - e, D.eaves - 0.04, -depth]], [-(D.apex - D.eaves), D.w / 2, 0]);
  B.poly(rk, [[x, D.apex + 0.05, e], [x1 + e, D.eaves - 0.04, e], [x1 + e, D.eaves - 0.04, -depth], [x, D.apex + 0.05, -depth]], [D.apex - D.eaves, D.w / 2, 0]);
  if (o.barge) { B.beam(o.barge, [x0 - e, D.eaves - 0.06, e + 0.01], [x, D.apex + 0.02, e + 0.01], 0.12, 0.04); B.beam(o.barge, [x, D.apex + 0.02, e + 0.01], [x1 + e, D.eaves - 0.06, e + 0.01], 0.12, 0.04); }
  if (D.finial) B.cyl('ironBlack', x, D.apex + 0.04, e * 0.5, 0.022, D.finial - D.apex, 5, true, 0.03);
  B.pop();
}

/** Scott's quad face, bay by bay, in the RANGE frame (pushed): gabled bays at zB, recessed bays at their own z the whole
 *  height, their returns, windows by floor, strings, the cornice, battlements, the gables' coping, dormers, doors */
function buildQuadFace(ctx, Q, cornTop, zB) {
  const { B } = ctx, F = P.QF;
  const pair = (x, lv) => lightGroup(x, 2, Q(lv.sill), Q(lv.apex), F.lw, F.mull, F.rise, 0.26, 'sash');
  const single = (x, y0, y1) => lightGroup(x, 1, y0, y1, F.single.w, 0, F.rise, 0.26, 'sash');
  const battle = { merlon: F.merlon, gap: F.gap, h: F.merlonTop - F.crenel + 0.1 };
  const mainSlope = (SC.ridge - (cornTop + 0.14)) / (7.75 - SC.ridgeZ);
  for (const bay of P.SC_QUAD) {
    const gable = bay.kind === 'gable', z = gable ? zB : bay.z, ops = [], sills = [], plates = [], m = (bay.x0 + bay.x1) / 2;
    const bottom = bay.well ? P.WELL_Y - 0.25 : FOOT;
    // first and second floors: pairs of lancets over the columns, single lancets in staircase 11's bay
    for (const c of bay.cols || []) for (const lv of [F.f, F.s]) { const q = pair(c, lv); ops.push(...q.ops); sills.push(q.box); }
    for (const c of bay.singles || []) for (const lv of [F.f, F.s]) { const q = single(c, Q(lv.sill), Q(lv.apex)); ops.push(...q.ops); sills.push(q.box); }
    // ground floor: plate tracery (two lights under a containing arch) except where the door is
    for (const c of bay.cols || []) {
      if (bay.door !== undefined && Math.abs(c - bay.door) < 1.0) continue;
      const G = F.g, A = { x: c, w: G.w, sill: Q(G.sill), spring: Q(G.spring), rise: G.apex - G.spring, n: 2, lw: G.lw, mull: G.mull, lApex: Q(G.spring) + 0.12, lRise: 0.3, roundel: 0, relieve: gable };      // (a solid tympanum: 16/01398)
      ops.push({ pts: pointedPts(A.x, A.w, A.sill, A.spring, A.rise, 8), kind: 'none' }); plates.push(A);
    }
    if (bay.groundSingle !== undefined) { const q = single(bay.groundSingle, Q(F.single.g[0]), Q(F.single.g[1])); ops.push(...q.ops); sills.push(q.box); }
    // the door: a pointed doorway in the face with a hood mould (16/01398; photographs 2008, 2016)
    const thr = bay.door !== undefined ? qyR(bay.door, 9.9) + 0.35 : 0, D = F.door;
    if (bay.door !== undefined) ops.push({ pts: pointedPts(bay.door, D.w, thr, thr + D.spring, D.rise, 6), kind: 'door', doorKey: 'doorOak', d: 0.3 });
    // the gable: two lancets with a transom
    let outline;
    if (gable) {
      const gl = bay.gl ?? F.gl.gap;
      for (const dx of [-gl / 2, gl / 2]) { const q = lightGroup(m + dx, 1, Q(F.gl.sill), Q(F.gl.apex), F.gl.w, 0, F.gl.rise, 0.22, 'sash'); for (const o of q.ops) o.transoms = [Q(F.gl.sill) + 0.75]; ops.push(...q.ops); sills.push(q.box); }
      const k = Math.min(F.kneelIn, (bay.x1 - bay.x0) * 0.11);
      outline = [[bay.x0, bottom], [bay.x1, bottom], [bay.x1, Q(F.kneel)], [bay.x1 - k, Q(F.kneel)], [m, Q(F.apex)], [bay.x0 + k, Q(F.kneel)], [bay.x0, Q(F.kneel)]];
    } else outline = rectPts(bay.x0, bottom, bay.x1, cornTop);
    if (bay.well) ops.push({ pts: rectPts(P.WELL.doors[0], P.WELL_Y + 0.02, P.WELL.doors[1], P.WELL_Y + P.WELL.doorH), kind: 'door', doorKey: 'doorOak', d: 0.2, lights: 2 });   // the pair at the area's west end (16/01398: no windows in the area)
    wall(B, FQ(z), outline, ops, 'bath');
    B.push(FQ(z));
    dressings(B, sills, false);
    for (const A of plates) plateWindow(B, A);
    for (const y of F.strings) K.stringCourse(B, 'bathDress', bay.x0 - 0.05, bay.x1 + 0.05, Q(y), 0.15, 0.09);
    K.stringCourse(B, 'bathDress', bay.x0 - 0.1, bay.x1 + 0.1, cornTop, cornTop - Q(F.cornice[0]), 0.2);
    K.stringCourse(B, 'bathDress', bay.x0 - 0.05, bay.x1 + 0.05, Q(F.cornice[0]), 0.1, 0.12);
    K.stringCourse(B, 'bathOld', bay.x0 - 0.04, bay.x1 + 0.04, Q(F.plinth), F.plinth + 0.45, 0.08);
    if (bay.door !== undefined) { arcBeam(B, bay.door, D.w + 0.3, thr + D.spring, D.rise + 0.18, 0.06, 0.13, 0.1, 'bathDress', true); B.cyl('ironBlack', bay.door, thr + D.spring + D.rise + 0.5, 0.02, 0.07, 0.03, 8, true); }
    if (bay.vent !== undefined) B.box('leadDark', bay.vent, Q(2.45), 0.02, 0.42, 0.26, 0.04, 0, {});
    if (gable) {
      const k = Math.min(F.kneelIn, (bay.x1 - bay.x0) * 0.11);
      gableCoping(B, bay.x0 + k, bay.x1 - k, Q(F.kneel), Q(F.apex));
      for (const [a, b] of [[bay.x0, bay.x0 + k], [bay.x1 - k, bay.x1]]) B.box('bathDress', (a + b) / 2, Q(F.kneel) + 0.05, 0.0, b - a + 0.12, 0.12, 0.44, 0, {});
    } else for (const x of [bay.x0 + 0.18, bay.x1 - 0.18]) if (bay.door !== undefined) pipe(B, x, qyR(x, z), cornTop - 0.35, 0.12);
    B.pop();
    // the returns of a recessed bay to the gabled bays' fronts (the whole height), with their strings and cornice
    if (!gable) for (const [x, F2] of [[bay.x0, frame(bay.x0, 0, zB, 0, -1)], [bay.x1, frame(bay.x1, 0, bay.z, 0, 1)]]) {
      if (x <= 0.01) continue;
      const L = zB - bay.z; wall(B, F2, rectPts(0, FOOT, L, cornTop), [], 'bath');
      B.push(F2); for (const y of F.strings) K.stringCourse(B, 'bathDress', 0, L, Q(y), 0.15, 0.09); K.stringCourse(B, 'bathDress', 0, L, cornTop, cornTop - Q(F.cornice[0]), 0.2); K.stringCourse(B, 'bathOld', 0, L, Q(F.plinth), F.plinth + 0.45, 0.08); B.pop();
    }
    if (gable) {
      // the gabled bay's cross roof from the main ridge to the gable (eaves on its sides just over the cornice)
      const yE = cornTop + 0.12, yR = Math.min(Q(F.apex) - 0.35, SC.ridge - 0.05);
      K.roof(B, 'slate', bay.x0 + 0.04, bay.x1 - 0.04, SC.ridgeZ, zB - 0.2, yE, yR - yE, { axis: 'z', ends: ['open', 'open'], ov: 0.12 });
    } else {
      K.parapet(B, 'bath', [[bay.x0, z - 0.15], [bay.x1, z - 0.15]], cornTop, Q(F.crenel) - cornTop - 0.1, 0.3, { coping: 'bathDress', battle });
      if (bay.dormer !== undefined) {
        const DD = F.dormer, D2 = { w: DD.w, sill: Q(DD.sill), eaves: Q(DD.eaves), apex: Q(DD.apex), finial: Q(DD.finial), lw: DD.lw, lightApex: Q(DD.lightApex) };
        const zf = z - DD.front, zMeet = SC.ridgeZ + (SC.ridge - D2.apex) / mainSlope;
        gabledDormer(B, frame(0, 0, zf, 1, 0), bay.dormer, D2, Math.max(0.8, zf - zMeet + 0.1), { key: 'bath', roofKey: 'lead' });
        B.box('slate', bay.dormer, (cornTop + D2.sill) / 2, zf - 0.3, DD.w + 0.1, D2.sill - cornTop, 0.6, 0, { bottom: false });   // the slope under the dormer's sill, behind the battlements
      }
    }
  }
}

/** the ramps to staircases 11 and 10 with their landings over the recesses, railings and floors (RANGE frame, pushed) */
function buildRamps(ctx, zB) {
  const { B } = ctx, L4 = (x0, z0, x1, z1) => [P.toL(x0, z0), P.toL(x1, z0), P.toL(x1, z1), P.toL(x0, z1)];
  const xOf = (u, v) => (u - P.P0[0]) * P.E[0] + (v - P.P0[1]) * P.E[1];
  for (const R of P.RAMPS) {
    const bay = P.SC_QUAD.find((b) => b.no === R.bay); if (!bay) continue;
    const thr = qyR(bay.door, 9.9) + 0.35, zO = R.zOut, xa = R.x0, xb = R.x1;
    const inside = xa > bay.x0 && xa <= bay.x1 + 1e-6, zI = inside ? bay.z : zB, yA = qyR(xa, zO);
    // (fix-up pass) the basement area runs on in front of staircase 10's recess to its head (WELL.u1): the landing's front
    // part starts there; behind the area it keeps a strip (z bay.z .. zB) back to the recess's west return, railed
    const xW = wellX(zB), cut = inside && xW > bay.x0 + 0.05 ? xW : null;
    const lx0 = cut ?? bay.x0, lx1 = inside ? xb : bay.x1, s = Math.sign(xb - xa);
    // the ramp: its surface and its exposed edge; the landing over the recess and in front of it, its exposed edges
    B.poly('pavingSolid', [[xa, yA + 0.01, zI], [xb, thr, zI], [xb, thr, zO], [xa, yA + 0.01, zO]], [0, 1, 0]);
    B.poly('pavingSolid', [[xa, yA - 0.1, zO], [xb, yA - 0.1, zO], [xb, thr, zO], [xa, yA + 0.01, zO]], [0, 0, 1]);
    B.flat('pavingSolid', [[lx0, bay.z], [lx1, bay.z], [lx1, zO], [lx0, zO]], thr);
    B.poly('pavingSolid', [[lx0, yA - 0.1, zO], [lx1, yA - 0.1, zO], [lx1, thr, zO], [lx0, thr, zO]], [0, 0, 1]);
    const xe = s > 0 ? lx1 : lx0;      // the landing's far end, open to the quad (11: two steps down east; 10: on to the head of the basement area)
    B.poly('pavingSolid', [[xe, yA - 0.1, zB], [xe, yA - 0.1, zO], [xe, thr, zO], [xe, thr, zB]], [s, 0, 0]);
    if (cut) {
      B.flat('pavingSolid', [[bay.x0, bay.z], [cut, bay.z], [cut, zB], [bay.x0, zB]], thr);
      // (the railing stops 0.6 short of the flight's head: over its top two risers the drop is under 0.35 m)
      railing(B, [bay.x0 + 0.05, zB - 0.06], [cut - 0.6, zB - 0.06], thr, 1.0, 0.14);
      const p2 = P.toL(bay.x0, zB - 0.06), q2 = P.toL(cut - 0.6, zB - 0.06); ctx.seg(p2[0], p2[1], q2[0], q2[1]);
      ctx.floor(L4(bay.x0, bay.z - 0.05, cut, zB), thr);
    }
    // the railings on the ramp's outer edge (and, at 10, along the landing's front: Montgomery 2008)
    const tA = (t) => yA + 0.01 + (thr - yA - 0.01) * t;
    // (fix-up pass) the railing starts 0.35 m up the ramp from its foot (the walk tool's 0.20 m rub where the way turns on to it)
    const xr = xa + Math.sign(xb - xa) * 0.35, tr = Math.abs(xr - xa) / Math.abs(xb - xa);
    railing(B, [xr, zO - 0.05], [xb, zO - 0.05], (t) => tA(tr + (1 - tr) * t), 1.0, 0.16);
    let p = P.toL(xr, zO - 0.05), q = P.toL(xb, zO - 0.05); ctx.seg(p[0], p[1], q[0], q[1]);
    if (inside) { railing(B, [xb, zO - 0.05], [lx0 + 0.05, zO - 0.05], thr, 1.0, 0.16); p = P.toL(lx0 + 0.05, zO - 0.05); ctx.seg(q[0], q[1], p[0], p[1]); }
    ctx.floor(L4(Math.min(xa, xb), zI, Math.max(xa, xb), zO), (u, v) => { const t = Math.max(0, Math.min(1, (xOf(u, v) - xa) / (xb - xa))); return yA + 0.01 + (thr - yA - 0.01) * t; });
    ctx.floor(L4(lx0, bay.z - 0.05, lx1, zO), thr);
  }
}

// ------------------------------------------------------------------------------------------------ the basement area (LOCAL)
/** x (RANGE frame) of the basement area's head (LOCAL u = WELL.u1) on the line z */
function wellX(z) { return (P.WELL.u1 - P.P0[0] - P.N[0] * z) / P.E[0]; }
export function buildWell(ctx) {
  const { B } = ctx, W = P.WELL, yF = P.WELL_Y, vN = -52.35, vS = W.vS;
  const qy = (u) => quadY(u, vS), rise = (qy(W.u1) - yF) / W.steps;
  // the floor and the flight (down westwards from the head at the east end: 16/01398)
  const xFoot = W.u1 - W.steps * W.going;
  B.flat('pavingSolid', [[W.u0, vN], [xFoot, vN], [xFoot, vS], [W.u0, vS]], yF);
  for (let i = 0; i < W.steps; i++) { const yt = qy(W.u1) - rise * (i + 1), ua = W.u1 - W.going * (i + 1); B.box('pavingSolid', ua + W.going / 2, (yt + yF - 0.1) / 2, (vN + vS) / 2, W.going, yt - yF + 0.1, vS - vN, 0, {}); }
  ctx.floor([[W.u0, vN], [W.u1, vN], [W.u1, vS], [W.u0, vS]], (u) => (u <= xFoot ? yF : qy(W.u1) - rise * Math.min(W.steps, Math.max(1, Math.ceil((W.u1 - u) / W.going)))));
  // the retaining walls (south side and the west end) with a coped kerb, the railings on it
  B.poly('bathOld', [[W.u1, yF - 0.1, vS], [W.u0, yF - 0.1, vS], [W.u0, qy(W.u0), vS], [W.u1, qy(W.u1), vS]], [0, 0, -1]);
  B.poly('bathOld', [[W.u0, yF - 0.1, vS], [W.u0, yF - 0.1, vN], [W.u0, qy(W.u0), vN], [W.u0, qy(W.u0), vS]], [1, 0, 0]);
  B.box('bathDress', (W.u0 + W.u1) / 2, qy(8) + 0.06, vS + 0.13, W.u1 - W.u0 + 0.26, 0.14, 0.26, 0, {});
  railing(B, [W.u0, vS + 0.13], [W.u1, vS + 0.13], (t) => qy(W.u0 + (W.u1 - W.u0) * t) + 0.12, W.railH);
  railing(B, [W.u0 - 0.0, vN + 0.3], [W.u0 - 0.0, vS + 0.13], qy(W.u0) + 0.02, W.railH);
  ctx.seg(W.u0, vS + 0.13, W.u1, vS + 0.13); ctx.seg(W.u0, vN, W.u0, vS + 0.13);
  // in front of staircase 10's recess the gabled bay's wall is gone: the area's back is a retaining wall on the bays' front
  // line (RANGE z = zB), 0.3 thick, coped (the railing on it is ramp 10's landing's: buildRamps); the head is open east
  const zB = SC.depth + SC.bayProj, xa = SC_QUAD_X0(), xb = wellX(zB);
  B.push(RANGE());
  B.box('bath', (xa + xb) / 2, (yF - 0.1 + qyR(xb, zB) + 0.3) / 2, zB - 0.15, xb - xa, qyR(xb, zB) + 0.3 - yF + 0.1, 0.3, 0, { top: false });
  B.box('bathDress', (xa + xb) / 2, qyR(xb, zB) + 0.35, zB - 0.15, xb - xa + 0.02, 0.1, 0.36, 0, {});
  B.pop();
}
/** x (RANGE frame) where the wide gabled bay ends and staircase 10's recess begins */
function SC_QUAD_X0() { const b = P.SC_QUAD.find((q) => q.no === 10); return b ? b.x0 : 14.43; }

// ================================================================================================ THE TOWER
export function buildTower(ctx) {
  const { B } = ctx, T = TW, w = T.x1 - T.x0, sc = T.x1 - T.pass.xc, PW = T.pass, top = T.cornice;
  // (the merge, 2026-11-24) the passage's street end meets the city's own surface outside the gate flush (its field + what
  // it draws there; 5 cm under the survey's 63.70 here) and rises to the surveyed 63.77 at the quad end; within 0.15 m of
  // the survey, else (or without a city) the survey's level
  const PY0 = (() => { const Wd = ctx.world, l = P.toL(PW.xc, T.zF - 0.3), q = ctx.S.L2W(l[0], l[1]);
    if (!Wd || typeof Wd.terrainLevel !== 'function' || typeof Wd.groundHeight !== 'function') return P.PASSAGE_Y[0];
    const c = Wd.terrainLevel(q[0], q[1]) + Wd.groundHeight(q[0], q[1]) - ctx.S.DATUM + 0.004;
    return Number.isFinite(c) && Math.abs(c - P.PASSAGE_Y[0]) < 0.15 ? c : P.PASSAGE_Y[0]; })();
  B.push(RANGE());
  // ---- the street face (s = 28.3 - x)
  const Ff = FS(T.x1, T.zF), G = T.gate;
  const gatePts = pointedPts(sc, G.w, P.PASSAGE_Y[0], G.spring, G.rise, 8);
  const ops = [
    { pts: gatePts, kind: 'void', d: PW.frontWall },
    { pts: pointedPts(sc, T.win2.w, T.win2.sill, T.win2.spring, T.win2.rise, 6), kind: 'win', lights: 2, glass: 'sash', d: 0.3 },
    ...T.lancets.xs.map((x) => ({ pts: pointedPts(T.x1 - x, T.lancets.w, T.lancets.sill, T.lancets.spring, T.lancets.rise, 4), kind: 'win', glass: 'leaded', d: 0.3 })),
    { pts: pointedPts(sc, T.niche.w, T.niche.y0, T.niche.y1 - 0.4, 0.4, 4), kind: 'void', d: 0.32 },
  ];
  wall(B, Ff, rectPts(0, P.FOOT_ST, w, top), ops, 'bath');
  B.push(Ff);
  // the arch's mouldings: a roll on the arch and shafted jambs, the winged keystone, the plaques
  const arc = gatePts.slice(2);
  for (let i = 0; i < arc.length - 1; i++) B.beam('bathDress', [arc[i][0], arc[i][1], 0.07], [arc[i + 1][0], arc[i + 1][1], 0.07], 0.22, 0.14);
  for (const x of [sc - G.w / 2 - 0.12, sc + G.w / 2 + 0.12]) B.cyl('bathDress', x, P.PASSAGE_Y[0], 0.05, 0.09, G.spring - P.PASSAGE_Y[0], 6, false);
  B.box('bathOld', sc, G.spring + G.rise + 0.05, 0.12, 0.7, 0.55, 0.3, 0, { bottom: true });
  for (const x of [sc - G.w / 2 - 0.85, sc + G.w / 2 + 0.85]) B.box('bathOld', x, (T.plaques.y0 + T.plaques.y1) / 2, 0.05, T.plaques.w, T.plaques.y1 - T.plaques.y0, 0.1, 0, { bottom: true });
  roundel(B, sc, T.win2.spring + T.win2.rise * 0.55, 0.22, -0.26, 'bathDress');
  K.label(B, sc - T.win2.w / 2 - 0.1, sc + T.win2.w / 2 + 0.1, T.win2.spring + T.win2.rise + 0.1, 0.4);
  // the niche: a corbel, a canopy, the plain figure
  B.box('bathDress', sc, T.niche.y0 - 0.12, 0.08, 0.7, 0.25, 0.3, 0, { bottom: true });
  B.box('bathDress', sc, T.niche.y1 + 0.12, 0.08, 0.95, 0.22, 0.32, 0, { bottom: true });
  K.pinnacle(B, 'bathDress', sc, 0.08, T.niche.y1 + 0.23, T.niche.y1 + 0.4, 0.5, 0.5);
  B.cyl('bathOld', sc, T.niche.y0 + 0.02, -0.15, 0.16, T.niche.statue * 0.82, 7, true, 0.2);
  B.cyl('bathOld', sc, T.niche.y0 + T.niche.statue * 0.82, -0.15, 0.09, T.niche.statue * 0.18, 6, true, 0.1);
  for (const y of T.strings) K.stringCourse(B, 'bathDress', 0, w, y, 0.16, 0.1);
  for (const x of [T.angle.w / 2, w - T.angle.w / 2]) B.box('bath', x, (P.FOOT_ST + T.angle.top) / 2, T.angle.proj / 2, T.angle.w, T.angle.top - P.FOOT_ST, T.angle.proj, 0, {});
  for (const [p0, p1] of [[0, sc - G.w / 2 - 0.3], [sc + G.w / 2 + 0.3, w]]) K.stringCourse(B, 'bathOld', p0, p1, SC.plinth, SC.plinth - P.FOOT_ST, 0.14);      // (broken by the gate)
  // the oriel on its corbel
  const O = T.oriel;
  orielBay(B, sc, O, [{ kind: 'corbel', y0: O.corbel[0], y1: O.corbel[1] }, { kind: 'panel', y0: O.panel[0], y1: O.panel[1] }, { kind: 'win', y0: O.lights[0], y1: O.lights[1], front: 2 }, { kind: 'parapet', y0: O.parapet[0], y1: O.parapet[1] }]);
  B.pop();
  // ---- the quad face (s = x - 21.6) and the sides
  const QG = T.qgate;
  wall(B, frame(T.x0, 0, T.zB, 1, 0), rectPts(0, FOOT, w, top), [
    { pts: pointedPts(T.pass.xc - T.x0, QG.w, P.PASSAGE_Y[1], QG.spring, QG.rise, 8), kind: 'void', d: PW.backWall },
    { pts: pointedPts(T.pass.xc - T.x0, 1.3, 5.0, 6.5, 0.6, 5), kind: 'win', lights: 2, glass: 'sash', d: 0.28 },
    { pts: pointedPts(T.pass.xc - T.x0, 1.3, 9.0, 10.5, 0.6, 5), kind: 'win', lights: 2, glass: 'sash', d: 0.28 },
    { pts: pointedPts(T.pass.xc - T.x0, 0.55, 12.85, 14.15, 0.45, 4), kind: 'win', glass: 'leaded', d: 0.28 },
  ], 'bath');
  B.push(frame(T.x0, 0, T.zB, 1, 0));
  for (const y of T.strings) K.stringCourse(B, 'bathDress', 0, w, y, 0.16, 0.1);
  for (const x of [T.angle.w / 2, w - T.angle.w / 2]) B.box('bath', x, (FOOT + T.angle.top) / 2, T.angle.proj / 2, T.angle.w, T.angle.top - FOOT, T.angle.proj, 0, {});
  B.pop();
  const D = T.zB - T.zF;
  wall(B, frame(T.x0, 0, T.zF, 0, 1), rectPts(0, FOOT, D, top), [{ pts: pointedPts(D / 2, 0.5, 12.8, 14.15, 0.45, 4), kind: 'win', glass: 'leaded', d: 0.28 }], 'bath');
  wall(B, frame(T.x1, 0, T.zB, 0, -1), rectPts(0, FOOT, D, top), [{ pts: pointedPts(2.0, 0.5, 12.8, 14.15, 0.45, 4), kind: 'win', glass: 'leaded', d: 0.28 }], 'bath');
  // ---- the top: cornice with gargoyles, the lead flat, the battlements, the turret
  const rim = [[T.x0, T.zF], [T.x1, T.zF], [T.x1, T.zB], [T.x0, T.zB]];
  K.prism(B, 'bathDress', [[T.x0 - 0.14, T.zF - 0.14], [T.x1 + 0.14, T.zF - 0.14], [T.x1 + 0.14, T.zB + 0.14], [T.x0 - 0.14, T.zB + 0.14]], top - 0.2, top, { bottom: true });
  for (const [x, z, dx, dz] of [[T.x0, T.zF, -1, -1], [T.x1, T.zF, 1, -1], [T.x1, T.zB, 1, 1], [T.x0, T.zB, -1, 1]]) B.beam('bathOld', [x, top - 0.45, z], [x + dx * 0.55, top - 0.5, z + dz * 0.55], 0.2, 0.22);
  B.flat('lead', rim, T.roof);
  const t = 0.35, h = T.parapet - top;
  K.parapet(B, 'bath', [[T.x0 + t / 2, T.zF + t / 2], [T.x1 - t / 2, T.zF + t / 2], [T.x1 - t / 2, T.zB - t / 2], [T.x0 + t / 2, T.zB - t / 2], [T.x0 + t / 2, T.zF + t / 2]], top, h, t, { coping: 'bathDress', battle: T.battle });
  const R = T.turret;
  K.prism(B, 'bath', [[R.x0, R.z0], [R.x1, R.z0], [R.x1, R.z1], [R.x0, R.z1]], 11.0, R.top, { top: true });
  K.prism(B, 'bathDress', [[R.x0 - 0.08, R.z0 - 0.08], [R.x1 + 0.08, R.z0 - 0.08], [R.x1 + 0.08, R.z1 + 0.08], [R.x0 - 0.08, R.z1 + 0.08]], R.top - 0.18, R.top, { bottom: true, top: true });
  { const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, rr = 0.6; const oct = Array.from({ length: 8 }, (_, k) => [cx + Math.cos((k + 0.5) * Math.PI / 4) * rr, cz + Math.sin((k + 0.5) * Math.PI / 4) * rr]); K.coneRoof(B, 'lead', oct, R.top, [cx, cz], R.spire - R.top); B.cyl('ironBlack', cx, R.spire - 0.1, cz, 0.015, 0.6, 4, true, 0.025); }
  // ---- the passage: its inner faces, the vault, the floor, the open leaves, the lights
  const x0 = PW.xc - PW.w / 2, x1 = PW.xc + PW.w / 2, zi0 = T.zF + PW.frontWall, zi1 = T.zB - PW.backWall;
  // (second pass) three bays of transverse stone arches on wall shafts under a flat ceiling with downlights (G form; the
  // survey's dots on both walls, the photo sphere's downlights)
  const CEIL = PW.ceiling, Lp = zi1 - zi0;
  wall(B, frame(x0, 0, zi0, 1, 0), rectPts(0, FOOT, PW.w, CEIL), [{ pts: pointedPts(PW.w / 2, G.w, P.PASSAGE_Y[0], G.spring, G.rise, 8), kind: 'none' }], 'bathOld');
  wall(B, frame(x1, 0, zi1, -1, 0), rectPts(0, FOOT, PW.w, CEIL), [{ pts: pointedPts(PW.w / 2, QG.w, P.PASSAGE_Y[1], QG.spring, QG.rise, 8), kind: 'none' }], 'bathOld');
  wall(B, frame(x0, 0, zi1, 0, -1), rectPts(0, FOOT, Lp, CEIL), [], 'bathOld');
  wall(B, frame(x1, 0, zi0, 0, 1), rectPts(0, FOOT, Lp, CEIL), [], 'bathOld');
  B.flat('bathOld', [[x0, zi0], [x1, zi0], [x1, zi1], [x0, zi1]], CEIL, [], true);
  const sp = PW.archSpring, ar = PW.archRise, hw = PW.w / 2 - PW.shaftProj;
  for (let k = 0; k <= PW.bays; k++) {
    const z = zi0 + (Lp * k) / PW.bays, zc = Math.min(zi1 - PW.shaft / 2, Math.max(zi0 + PW.shaft / 2, z));
    for (const [x, sg] of [[x0, 1], [x1, -1]]) {
      B.box('bathDress', x + sg * PW.shaftProj / 2, (FOOT + sp) / 2, zc, PW.shaftProj, sp - FOOT, PW.shaft, 0, {});
      B.box('bathDress', x + sg * (PW.shaftProj + 0.04) / 2, sp + 0.08, zc, PW.shaftProj + 0.04, 0.16, PW.shaft + 0.08, 0, {});   // the capital
    }
    if (k === 0 || k === PW.bays) continue;
    // the transverse arch: a segmental soffit from shaft to shaft, the spandrels solid up to the ceiling
    const n = 8, R = (hw * hw + ar * ar) / (2 * ar), cy = sp + ar - R;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const xx = -hw + (2 * hw * i) / n, yy = cy + Math.sqrt(Math.max(0, R * R - xx * xx));
      if (prev) { const xm = (prev[0] + xx) / 2, ylo = Math.min(prev[1], yy); B.box('bathDress', PW.xc + xm, (ylo + CEIL) / 2, zc, (2 * hw) / n + 0.01, CEIL - ylo, PW.archW, 0, { top: false }); }
      prev = [xx, yy];
    }
  }
  // downlights in the ceiling, two a bay
  for (let k = 0; k < PW.bays; k++) {
    const zc = zi0 + (Lp * (k + 0.5)) / PW.bays;
    for (const dx of [-0.6, 0.6]) B.cyl('lampGlass', PW.xc + dx, CEIL - 0.03, zc, 0.09, 0.03, 8, true, 0.11);
    const l = P.toL(PW.xc, zc); ctx.lamp(l[0], CEIL - 0.3, l[1]);
  }
  // a removable bollard near the street end (the survey's small square in the passage: G)
  { const bz = zi0 + 0.6, bx = PW.xc + 0.25; B.cyl('ironBlack', bx, P.PASSAGE_Y[0], bz, 0.07, 0.9, 8, true, 0.08); B.box('leadDark', bx, P.PASSAGE_Y[0] + 0.75, bz, 0.16, 0.04, 0.16, 0, {}); }
  const yF = (z) => PY0 + ((z - T.zF) / (T.zB - T.zF)) * (P.PASSAGE_Y[1] - PY0);
  { const Gc = ctx.pack.groundCells; if (Gc && Gc.get('setts') && !Gc.get('mqSetts')) Gc.set('mqSetts', { ...Gc.get('setts'), tint: SETTS_TINT }); }   // (fix-up pass: Margary Quad's pale setts tint, not the dark city cell)
  B.poly(ctx.pack.groundCells && ctx.pack.groundCells.get('mqSetts') ? 'mqSetts' : 'setts', [[x0, yF(T.zF), T.zF], [x1, yF(T.zF), T.zF], [x1, yF(T.zB), T.zB], [x0, yF(T.zB), T.zB]], [0, 1, 0]);
  const fl = [P.toL(x0, T.zF - 0.05), P.toL(x1, T.zF - 0.05), P.toL(x1, T.zB + 0.05), P.toL(x0, T.zB + 0.05)];
  ctx.floor(fl, (u, v) => { const t2 = Math.max(0, Math.min(1, (v - fl[0][1]) / (fl[3][1] - fl[0][1]))); return PY0 + t2 * (P.PASSAGE_Y[1] - PY0); });
  for (const [x, sgn] of [[x0 + 0.07, 1], [x1 - 0.07, -1]]) {
    const yb = yF(zi0) + 0.03, za = zi0 + 0.02, zb = zi0 + G.w / 2;
    const leaf = [[x, yb, za], [x, yb, zb], [x, G.spring + G.rise - 0.05, zb], [x, G.spring + G.rise * 0.75, za + (zb - za) * 0.55], [x, G.spring, za]];
    B.poly('oakDoor', leaf, [sgn, 0, 0]); B.poly('oakDoor', leaf.map((p) => [p[0] - sgn * 0.08, p[1], p[2]]), [-sgn, 0, 0]);
    for (const y of [0.4, 1.6, 2.8]) B.box('ironBlack', x + sgn * 0.01, yb + y, (za + zb) / 2, 0.02, 0.07, zb - za - 0.1, 0, {});
  }
  for (const z of T.undercroftLamps) { B.box('ironBlack', x0 + 0.06, 2.2, z + 1.3, 0.1, 0.32, 0.16, 0, { bottom: true }); B.box('ironBlack', x1 - 0.06, 2.2, z + 1.3, 0.1, 0.32, 0.16, 0, { bottom: true }); }   // the C2 up / down lights on the walls (their light: the downlights')
  B.pop();
}

// ================================================================================================ UNDERWOOD'S PART
export function buildUnderwood(ctx) {
  const FOOT = P.FOOT_ST;
  const { B } = ctx, U = UW, L = U.x1 - U.x0, s = (x) => U.x1 - x, sg0 = s(EB.x0), sm = s(EB.oriel.xc);
  B.push(RANGE());
  const F = FS(U.x1, U.zF), ops = [], boxes = [];
  for (const c of U.cols) for (const y of [U.g, U.f, U.s]) { const q = lightGroup(s(c), 2, y[0], y[1], U.lightW, U.mull, U.headRise, 0.26, 'sash'); ops.push(...q.ops); boxes.push(q.box); }
  { const q = lightGroup(sm, 2, EB.win2[0], EB.win2[1], U.lightW, U.mull, U.headRise, 0.26, 'sash'); ops.push(...q.ops); boxes.push(q.box); }
  { const q = lightGroup(sm, 2, EB.gableWin[0], EB.gableWin[1], 0.46, 0.15, 0.14, 0.24, 'sash'); ops.push(...q.ops); boxes.push(q.box); }
  wall(B, F, [[0, FOOT], [L, FOOT], [L, U.eaves], [sg0, U.eaves], [sm, EB.apex], [0, U.eaves]], ops, 'bath');
  B.push(F);
  dressings(B, boxes);
  K.stringCourse(B, 'bathOld', 0, L, U.plinth, U.plinth - FOOT, 0.12);
  K.stringCourse(B, 'bathDress', 0, L, U.plinth + 0.1, 0.1, 0.18);
  for (const y of U.strings) K.stringCourse(B, 'bathDress', 0, L, y, 0.16, 0.1);
  K.stringCourse(B, 'bathDress', 0, L, U.cornice[1], U.cornice[1] - U.cornice[0], 0.22);
  for (const c of U.cols) B.box('ironBlack', s(c), streetY(c) + 0.55, 0.125, 0.75, 0.42, 0.02, 0, {});      // basement grilles
  for (let k = 0; k < 6; k++) B.box('bathOld', sg0 + 0.6 + ((L - sg0 - 1.2) * k) / 5, U.cornice[0] - 0.08, 0.14, 0.22, 0.24, 0.2, 0, { bottom: true });   // carved heads under the cornice
  gableCoping(B, 0, sg0, U.eaves, EB.apex);
  for (const x of U.pipes) pipe(B, s(x), streetY(x), U.cornice[0] - 0.35, 0.15);
  const O = EB.oriel;
  orielBay(B, sm, O, [{ kind: 'solid', y0: FOOT, y1: O.base }, { kind: 'cornice', y0: O.base, y1: O.base + 0.14 }, { kind: 'win', y0: O.base + 0.14, y1: O.low[1] + 0.05, front: 2 }, { kind: 'panel', y0: O.panel[0], y1: O.panel[1] }, { kind: 'win', y0: O.panel[1], y1: O.high[1], front: 2 }, { kind: 'cornice', y0: O.cornice[0], y1: O.cornice[1] }, { kind: 'parapet', y0: O.parapet[0], y1: O.parapet[1] }]);
  B.pop();
  // parapet, dormers, roofs, the end walls, the stack
  K.parapet(B, 'bath', [[U.x0, U.zF + 0.15], [EB.x0, U.zF + 0.15]], U.eaves, U.parapet - U.eaves - 0.1, 0.3, { coping: 'bathDress' });
  const DM = U.dormer;
  for (const c of U.cols) K.dormer(B, frame(c, 0, U.zF + 0.6, -1, 0), 0, DM.sill, DM.w, DM.h, DM.depth, { lights: 2, rise: DM.rise, key: 'bath', roofKey: 'slate' });
  K.roof(B, 'slate', U.x0, EB.oriel.xc, U.zF, U.zB, U.eaves, U.ridge - U.eaves, { axis: 'x', ends: ['open', 'open'], ov: 0.25 });
  K.roof(B, 'slate', EB.x0, EB.x1, U.zF + 0.2, U.zB, U.eaves, EB.apex - 0.25 - U.eaves, { axis: 'z', ends: ['open', 'gable'], ov: 0.15, wallKey: 'bath' });
  B.poly('bath', [[U.x1, FOOT, U.zF], [U.x1, FOOT, U.zB], [U.x1, U.eaves, U.zB], [U.x1, U.eaves, U.zF]], [1, 0, 0]);
  clusterStack(B, (U.stack.x0 + U.stack.x1) / 2, (U.stack.z0 + U.stack.z1) / 2, U.ridge - 1.0, U.stack.top, U.stack.n);
  B.pop();
}

// ================================================================================================ STAIRCASE 9 BLOCK (LOCAL)
export function buildBlock9(ctx) {
  const { B } = ctx, BK = P.BACK, ST = P.STRIP, S = P.S9, C = P.COURT;
  // the 1983 pile: plain faces (east, north under the roofs), the courtyard face with its windows
  const R = BK.ring;
  B.poly('bath', [[R[1][0], FOOT, R[1][1]], [R[2][0], FOOT, R[2][1]], [R[2][0], BK.eaves, R[2][1]], [R[1][0], BK.eaves, R[1][1]]], [1, 0, 0]);
  B.poly('bath', [[R[0][0], 11.5, R[0][1]], [R[1][0], 11.5, R[1][1]], [R[1][0], BK.eaves, R[1][1]], [R[0][0], BK.eaves, R[0][1]]], [0, 0, -1]);
  const cw = R[2][0] - ST.uE, cops = [];
  for (const u of S.courtCols) for (const r of S.rows) cops.push(...lightGroup(u - ST.uE, 2, r[0], r[1], 0.55, 0.12, 0, 0.18, 'sash').ops);
  cops.push({ pts: rectPts(0.45, -2.15, 1.35, -0.05), kind: 'door', doorKey: 'doorDark', d: 0.15 });
  wall(B, frame(ST.uE, 0, R[2][1], 1, 0), rectPts(0, -2.4, cw, BK.eaves), cops, 'bath');
  B.push(frame(ST.uE, 0, R[2][1], 1, 0)); K.stringCourse(B, 'bathDress', 0, cw, BK.eaves, 0.25, 0.18); B.pop();
  // (third pass) the pile starts EAST of the strip (u 30.95: LIDAR); its west end a gable over the strip's east slope, the wall
  // between the strip's eaves and the pile's carried up
  K.roof(B, 'slate', R[0][0], R[1][0] - 0.25, R[0][1], R[2][1], BK.eaves, BK.ridge - BK.eaves, { axis: 'x', ends: ['gable', 'hip'], ov: 0.2, wallKey: 'bath' });
  B.poly('bath', [[R[0][0], ST.eaves - 0.3, R[2][1]], [R[0][0], ST.eaves - 0.3, R[0][1]], [R[0][0], BK.eaves, R[0][1]], [R[0][0], BK.eaves, R[2][1]]], [-1, 0, 0]);
  clusterStack(B, S.stack.u, S.stack.v, ST.ridge - 1.0, S.stack.top, S.stack.n);
  // the strip down the quad's east side: the west (quad) face, the east face to the courtyard, the south gable, the roof
  const len = ST.vS - ST.vN, wops = [], boxes = [];
  const qyW = (v) => quadY(ST.uW, v);
  // (third pass) three storeys of paired pointed lancets over sill strings (Montgomery 2008, the bird's-eye map)
  const WL = S.westLight;
  for (const v of S.westCols) for (const [i, r] of S.westRows.entries()) {
    if (i === 0 && v === S.door) continue;
    const q = lightGroup(v - ST.vN, 2, r[0], r[1], WL.lw, WL.mull, WL.rise, 0.26, 'sash'); wops.push(...q.ops); boxes.push(q.box);
  }
  const ds = S.door - ST.vN, yD = P.LANDING9.y + 0.02;      // (second pass) the door opens on the landing at 64.16 (survey)
  wops.push({ pts: pointedPts(ds, 1.15, yD, yD + 1.95, 0.6, 4), kind: 'door', doorKey: 'oakDoor', d: 0.3 });
  const FW = frame(ST.uW, 0, ST.vN, 0, 1);
  wall(B, FW, rectPts(0, FOOT, len, ST.eaves), wops, 'bath');
  B.push(FW);
  dressings(B, boxes, false);
  for (const y of S.westStrings) K.stringCourse(B, 'bathDress', 0, len, y, 0.14, 0.09);
  K.stringCourse(B, 'bathDress', -0.1, len + 0.1, ST.eaves, 0.2, 0.18);
  K.stringCourse(B, 'bathOld', 0, len, qyW(-45) + 0.6, 0.6 + 0.5, 0.1);
  B.pop();
  landing9(ctx);
  K.parapet(B, 'bath', [[ST.uW + 0.15, ST.vN], [ST.uW + 0.15, ST.vS]], ST.eaves, ST.parapet - ST.eaves - 0.45, 0.3, { coping: 'bathDress', battle: { merlon: 0.6, gap: 0.55, h: 0.45 } });
  // gabled dormers with white fronts of two pointed lights in the west slope (Montgomery 2008; the map)
  { const DD = S.dormer, slope = (ST.ridge - ST.eaves) / ((ST.uE - ST.uW) / 2 - 0.15), D2 = { w: DD.w, sill: DD.sill, eaves: DD.eaves, apex: DD.apex, lw: 0.32, lightApex: DD.eaves - 0.12 };
    const uf = ST.uW + DD.front, depth = (DD.apex - ST.eaves) / slope - DD.front + 0.45;
    for (const v of S.dormers) gabledDormer(B, frame(uf, 0, ST.vN, 0, 1), v - ST.vN, D2, depth, { key: 'white', roofKey: 'slate', lights: 2, barge: 'white' }); }
  { const p = w1(B, ST.uW, qyW(S.lamp.v) + S.lamp.y, S.lamp.v, -1, 0); ctx.lamp(p[0], p[1], p[2]); }
  const eops = []; for (const v of S.stripEastCols) for (const r of S.rows) if (r[1] < ST.eaves - 0.3) eops.push(...lightGroup(-38.3 - v, 2, r[0], r[1], 0.5, 0.12, 0, 0.18, 'sash').ops);
  wall(B, frame(ST.uE, 0, ST.vS, 0, -1), rectPts(1.85, FOOT, -38.3 - R[2][1], ST.eaves), eops, 'bath');
  K.roof(B, 'slate', ST.uW + 0.3, ST.uE, ST.roofN, ST.vS, ST.eaves, ST.ridge - ST.eaves, { axis: 'z', ends: ['open', 'gable'], ov: 0.2, wallKey: 'bath' });   // (third pass: carried north behind the tower to Underwood's back wall)
  B.poly('bath', [[ST.uW, FOOT, ST.vS], [ST.uE, FOOT, ST.vS], [ST.uE, ST.eaves, ST.vS], [ST.uW, ST.eaves, ST.vS]], [0, 0, 1]);
  // ---- the internal courtyard: paving, the basement steps, the glazed 2018 extension
  // (second pass: the "basement steps adjacent 9" are on the QUAD side (survey; photograph): landing9(); the courtyard is flagged whole)
  const gl = C.glass;
  const court = C.ring.map((p) => [p[0], p[1]]);
  B.flat('paving', court, P.COURT_Y + 0.01, [[[gl.u0, gl.v0 + 0.01], [gl.u1, gl.v0 + 0.01], [gl.u1, gl.v1], [gl.u0, gl.v1]]]);
  ctx.floor(court, P.COURT_Y);
  const gring = [[gl.u0, gl.v0], [gl.u1, gl.v0], [gl.u1, gl.v1], [gl.u0, gl.v1]];
  K.prism(B, 'glassDark', gring, P.COURT_Y, gl.h, {});
  B.flat('lead', gring, gl.h);
  for (const [u, v] of gring) B.box('leadDark', u, gl.h / 2, v, 0.12, gl.h, 0.12, 0, {});
  for (let k = 1; k < 4; k++) { const v = gl.v0 + ((gl.v1 - gl.v0) * k) / 4; B.box('leadDark', gl.u0 - 0.03, gl.h / 2, v, 0.06, gl.h, 0.08, 0, {}); }
  B.box('leadDark', (gl.u0 + gl.u1) / 2, gl.h - 0.1, gl.v1 + 0.03, gl.u1 - gl.u0, 0.2, 0.06, 0, {});
  ctx.solid(gring);
}

// ------------------------------------------------------------------------------------------------ staircase 9's landing, the basement steps (LOCAL)
/** the landing at 64.16 before staircase 9's door (three steps up at its north end), the basement flight down southwards
 *  along the block's face behind a coped wall, the black flat-bar handrail on the face, the oak sign, the door at the foot */
function landing9(ctx) {
  const { B } = ctx, L = P.LANDING9, ST = P.STRIP, uF = ST.uW, uW0 = L.u0, uW1 = L.u0 + L.wallT, yL = L.y, F = L.flight;
  const vN = ST.vN, vH = L.v1, vFoot = vH + F.n * F.going, yFoot = yL - F.n * F.rise, wallTop = yL + L.wallH;
  const qy = (u, v) => quadY(u, v), box4 = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  // the landing and its steps up from the north (from the quad by the gate passage's mouth)
  B.box('pavingSolid', (uW0 + uF) / 2, (yL + qy(23.4, -50) - 0.2) / 2, (vN + vH) / 2, uF - uW0, yL - qy(23.4, -50) + 0.2, vH - vN, 0, {});
  // two steps up along its whole west side (the survey's double line; the tower's back closes its north end)
  const rise0 = (yL - qy(22.4, -49.3)) / (L.upSteps), uS = uW0 - (L.upSteps - 1) * L.upGoing;
  for (let i = 1; i < L.upSteps; i++) { const yt = yL - rise0 * i, ua = uW0 - L.upGoing * i; B.box('pavingSolid', ua + L.upGoing / 2, (yt + qy(22.4, -49.3) - 0.2) / 2, (vN + vH) / 2, L.upGoing, yt - qy(22.4, -49.3) + 0.2, vH - vN, 0, {}); }
  ctx.floor(box4(uW0, vN, uF, vH), yL);
  ctx.floor(box4(uS, vN, uW0, vH), (u) => yL - rise0 * Math.min(L.upSteps - 1, Math.max(1, Math.ceil((uW0 - u) / L.upGoing))));
  // the flight down southwards, its foot, the walls of the well (west, south end)
  for (let k = 1; k <= F.n; k++) { const yt = yL - F.rise * k, va = vH + F.going * (k - 1); B.box('pavingSolid', (uW1 + uF) / 2, (yt + yFoot - 0.3) / 2, va + F.going / 2, uF - uW1, yt - yFoot + 0.3, F.going, 0, {}); }
  B.flat('pavingSolid', box4(uW1, vFoot, uF, L.foot), yFoot);
  ctx.floor(box4(uW1, vH, uF, vFoot), (u, v) => yL - F.rise * Math.min(F.n, Math.max(1, Math.ceil((v - vH) / F.going))));
  ctx.floor(box4(uW1, vFoot, uF, L.foot), yFoot);
  B.box('bath', (uW0 + uW1) / 2, (wallTop + yFoot - 0.3) / 2, (vH - 0.4 + L.foot) / 2, L.wallT, wallTop - yFoot + 0.3, L.foot - vH + 0.4, 0, {});
  B.box('bathDress', (uW0 + uW1) / 2, wallTop + 0.05, (vH - 0.4 + L.foot) / 2, L.wallT + 0.08, 0.1, L.foot - vH + 0.4, 0, {});
  B.box('bath', (uW0 + uF) / 2, (wallTop + yFoot - 0.3) / 2, L.foot + 0.125, uF - uW0, wallTop - yFoot + 0.3, 0.25, 0, {});
  B.box('bathDress', (uW0 + uF) / 2, wallTop + 0.05, L.foot + 0.125, uF - uW0 + 0.05, 0.1, 0.33, 0, {});
  B.box('bath', (21.1 + uW0) / 2, qy(22, -42.5) + 0.25, L.foot + 0.25, uW0 - 21.1, 0.6, 0.3, 0, {});      // the low wall stub west from the foot (survey)
  ctx.seg(uW0, vH, uW0, L.foot + 0.25); ctx.seg(uW0, L.foot + 0.25, uF, L.foot + 0.25); ctx.seg(21.1, L.foot + 0.4, uW0, L.foot + 0.4);
  ctx.seg(uW1, vH, uF, vH - 0.01);       // (the flight's head: a walker on the landing stops here; the stair is a way down, not walked)
  // the door at the foot (in the block's face) and a small window beside the flight's head (white-painted, stone case)
  B.poly('bath', [[uF, yFoot - 0.3, vH - 0.5], [uF, yFoot - 0.3, L.foot], [uF, FOOT + 0.05, L.foot], [uF, FOOT + 0.05, vH - 0.5]], [-1, 0, 0]);   // the face carried down into the well
  B.push(frame(uF, 0, vFoot, 0, 1));
  B.unit('doorDark', rectPts(0.04, yFoot, 0.92, yFoot + 2.05), 0.02, K.nextBay(0));
  B.pop();
  // the black flat-bar handrail on the face (turning down at the head), the oak sign with gilt letters
  const hr = (v) => yL + 0.9 - F.rise * Math.max(0, (v - vH) / F.going);
  B.beam('ironBlack', [uF - 0.06, hr(vH - 0.3), vH - 0.3], [uF - 0.06, hr(vFoot), vFoot], 0.05, 0.012);
  B.beam('ironBlack', [uF - 0.06, hr(vH - 0.3), vH - 0.3], [uF - 0.06, yL + 0.45, vH - 0.55], 0.05, 0.012);
  for (const v of [vH + 0.3, (vH + vFoot) / 2, vFoot - 0.3]) B.box('ironBlack', uF - 0.03, hr(v) - 0.03, v, 0.06, 0.05, 0.025, 0, {});
  const S = L.sign;
  B.box('oakDoor', uF - 0.02, yL + S.y, S.v, 0.035, S.h, S.w, 0, {});
  for (const [dy, w] of [[0.1, 0.5], [0.0, 0.55], [-0.1, 0.5]]) B.box('gold', uF - 0.04, yL + S.y + dy, S.v, 0.006, 0.035, w, 0, {});
}

// ------------------------------------------------------------------------------------------------ the pavement strip
/** Broad Street's pavement from the site ring (where the city's ground stops) to the faces, in the RANGE frame */
export function buildPavement(ctx) {
  const { B } = ctx, ring = ctx.S.SITE_RING, i0 = ring.findIndex((p) => p[0] === -4.3 && p[1] === -62.55), i1 = ring.findIndex((p) => p[0] === 43.26);
  if (i0 < 0 || i1 < i0) return;
  const toR = ([u, v]) => { const du = u - P.P0[0], dv = v - P.P0[1]; return [du * P.E[0] + dv * P.E[1], du * P.N[0] + dv * P.N[1]]; };
  const line = ring.slice(i0, i1 + 1).map(toR);
  const ringZ = (x) => interp(line, x);
  const inner = (x) => (x > TW.x0 - 0.1 && x < TW.x1 + 0.1 ? TW.zF - 0.02 : x < TW.x0 ? 0.3 : UW.zF + 0.3);
  const xs = [];
  for (let x = -0.2; x < UW.x1 + 0.2; x += 1.0) xs.push(x);
  xs.push(TW.x0 - 0.1, TW.x0 - 0.099, TW.x1 + 0.099, TW.x1 + 0.1, UW.x1 + 0.2); xs.sort((a, b) => a - b);
  // (the merge, 2026-11-24) the strip's OUTER edge lies on the city's own surface just outside the ring (its field + what
  // the city draws there: bare paving, the footway), so there is no step at the ring; it runs to the surveyed level at
  // the faces and the gate (the city's field here is 0 - 6 cm under the survey). Where the city is more than 0.15 m off
  // (a basement yard's smoothing) the survey's level stays. Without a city field: the survey's level.
  const W0 = ctx.world, cityY = (x) => {
    if (!W0 || typeof W0.terrainLevel !== 'function' || typeof W0.groundHeight !== 'function') return null;
    const l = P.toL(x, ringZ(x) - 0.25), w = ctx.S.L2W(l[0], l[1]), f = W0.terrainLevel(w[0], w[1]), g = W0.groundHeight(w[0], w[1]);
    return Number.isFinite(f) && Number.isFinite(g) && f > 40 ? f + g - ctx.S.DATUM : null;
  };
  const outerAt = (x) => { const c = cityY(x), s0 = streetY(x) + 0.006; return c != null && Math.abs(c - s0) < 0.15 ? c + 0.004 : s0; };
  const OT = []; for (let x = xs[0] - 0.5; x <= xs[xs.length - 1] + 0.5; x += 0.5) OT.push([x, outerAt(x)]);      // (read once, at build: the city's ground is wrapped by the college's floors after)
  const outerY = (x) => interp(OT, x);
  B.push(RANGE());
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1]; if (b - a < 0.01) continue;
    const za0 = ringZ(a) - 0.06, zb0 = ringZ(b) - 0.06, za1 = inner(a + 0.0001), zb1 = inner(b - 0.0001);
    if (za0 >= za1 && zb0 >= zb1) continue;
    B.poly('paving', [[a, outerY(a), za0], [b, outerY(b), zb0], [b, streetY(b) + 0.006, Math.max(zb0, zb1)], [a, streetY(a) + 0.006, Math.max(za0, za1)]], [0, 1, 0]);
  }
  B.pop();
  // the strip is a floor: a walker stands on the drawn flags, not on the city's smoothed ground 0.15 - 0.2 m above them
  // (tools/exeter_walk.mjs 2026-11-23: a 0.2 m step at the gate's threshold). The step is now at the site ring, where
  // the city's own pavement begins (until the terrain precinct of docs/handoff/exeter/README.md item 2 is made).
  const outer = xs.map((x) => P.toL(x, ringZ(x) - 0.06)), back = xs.slice().reverse().map((x) => P.toL(x, Math.max(ringZ(x) - 0.06, inner(x))));
  ctx.floor([...outer, ...back], (u, v) => { const du = u - P.P0[0], dv = v - P.P0[1], x = du * P.E[0] + dv * P.E[1], z = du * P.N[0] + dv * P.N[1], z0 = ringZ(x) - 0.06, z1 = Math.max(z0 + 0.05, inner(x)), t = Math.max(0, Math.min(1, (z - z0) / (z1 - z0))), s0 = streetY(x) + 0.006; return outerY(x) + t * (s0 - outerY(x)); });
}

// ------------------------------------------------------------------------------------------------ colliders
export function registerSolids(ctx) {
  const L = P.toL, zR = SC.depth, zB = SC.depth + SC.bayProj;
  // Scott's block with its bays (recessed faces and the bays' fronts)
  const q = [];
  for (const bay of P.SC_QUAD) {
    const z = bay.kind === 'gable' ? zB : bay.z;
    if (bay.door === undefined) { q.push(L(bay.x0, z), L(bay.x1, z)); continue; }      // (third pass: the recessed bays' faces at their own z; the doors are in them)
    // (fix-up pass) the door's reveal taken into the ring, with a threshold floor, so a walker reaches the door
    const dw = P.QF.door.w / 2, zr = z - 0.27, thr = qyR(bay.door, 9.9) + 0.35;
    q.push(L(bay.x0, z), L(bay.door - dw, z), L(bay.door - dw, zr), L(bay.door + dw, zr), L(bay.door + dw, z), L(bay.x1, z));
    ctx.floor([L(bay.door - dw, zr), L(bay.door + dw, zr), L(bay.door + dw, z + 0.02), L(bay.door - dw, z + 0.02)], thr);
  }
  ctx.solid([L(0, 0), L(SC.x1, 0), ...q.reverse()]);
  // the tower's two walls either side of the passage
  const x0 = TW.pass.xc - TW.pass.w / 2, x1 = TW.pass.xc + TW.pass.w / 2;
  ctx.solid([L(TW.x0, TW.zF), L(x0, TW.zF), L(x0, TW.zB), L(TW.x0, TW.zB)]);
  ctx.solid([L(x1, TW.zF), L(TW.x1, TW.zF), L(TW.x1, TW.zB), L(x1, TW.zB)]);
  // Underwood's part, the 1983 pile and the strip down to the Lodgings
  const O = EB.oriel, ST = P.STRIP;
  ctx.solid([L(UW.x0, UW.zF), L(O.xc - O.front / 2 - O.proj, UW.zF), L(O.xc - O.front / 2, UW.zF - O.proj), L(O.xc + O.front / 2, UW.zF - O.proj), L(O.xc + O.front / 2 + O.proj, UW.zF), L(UW.x1, UW.zF), L(UW.x1, UW.zB),
    P.BACK.ring[1], P.BACK.ring[2], [ST.uE, -45.5], [ST.uE, ST.vS], [ST.uW, ST.vS], [ST.uW, ST.vN], L(UW.x0, TW.zB)]);
}
