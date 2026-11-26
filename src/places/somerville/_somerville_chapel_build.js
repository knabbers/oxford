// Somerville College, STANDALONE model, part 'chapel' (B08): the build functions. Called by somerville_chapel.js with
// ctx.B already in the college's LOCAL frame (x = u east, z = v south, y above the datum); the Chapel and its gardens
// are square to that frame, so no own frame is pushed except the kit's wall frames (and one turned frame for the
// west steps). Every figure comes from _somerville_chapel_plan.js (sources and K / G there). Helpers written here (not
// in the kit): aedicule (an eared, pedimented window surround), balusters (a balustrade panel set in a parapet),
// gardenWall (a wall on a LOCAL line whose foot and top follow the surveyed ground, a different key each face, a
// brick coping), hedgeRun (a clipped hedge on the ground), railing (iron posts and rails along a line).
import * as P from './_somerville_chapel_plan.js';

const { MAIN: M, WEST: W, EAST: E } = P;
const PI = Math.PI;

// ------------------------------------------------------------------------------------------------ cells
function addCells(K, pack) {
  K.addCell(pack, 'yew', 'box', 0x4a6c3c);            // the yew hedge along the Chapel's foot (dark)
  K.addCell(pack, 'hedgeGreen', 'box', 0x6a9450);     // the clipped hedge down the Fellows' Garden's east side
  K.addCell(pack, 'chapelBal', 'stone', [0.86, 0.83, 0.76]);   // the shadowed backs of the balustrade panels and the inscription
  // (touch-up 2: the high-layer ground copies chLawn / chGravel / chBed / chPaving are gone: part 'grounds' now cuts its
  // base sheet under every ring this part drapes, so the plain ground keys lie on bare ground with nothing under them)
}

// ------------------------------------------------------------------------------------------------ the Chapel's faces
/** every outer face: its wall frame [x, z, ax, az] (s along (ax, az), outward normal (-az, ax)), its length, and s of a
 *  LOCAL coordinate along it */
function faces() {
  const f = (id, x, z, ax, az, L) => ({ id, x, z, ax, az, L, s: (c) => (ax ? (c - x) * ax : (c - z) * az) });
  return [
    f('mainN', M.u1, M.v0, -1, 0, M.u1 - M.u0), f('mainS', M.u0, M.v1, 1, 0, M.u1 - M.u0),
    f('mainWn', M.u0, M.v0, 0, 1, W.v0 - M.v0), f('mainWs', M.u0, W.v1, 0, 1, M.v1 - W.v1),
    f('mainEs', M.u1, M.v1, 0, -1, M.v1 - E.v1), f('mainEn', M.u1, E.v0, 0, -1, E.v0 - M.v0),
    f('westN', W.u1, W.v0, -1, 0, W.u1 - W.u0), f('westW', W.u0, W.v0, 0, 1, W.v1 - W.v0), f('westS', W.u0, W.v1, 1, 0, W.u1 - W.u0),
    f('eastN', E.u1, E.v0, -1, 0, E.u1 - E.u0), f('eastE', E.u1, E.v1, 0, -1, E.v1 - E.v0), f('eastS', E.u0, E.v1, 1, 0, E.u1 - E.u0),
  ];
}

/** an eared, pedimented stone surround in the CURRENT wall frame round a round-headed opening of width w (centre xc)
 *  from `sill` to the springing `spring`; o.base: the surround's sill line when it is lower than the opening's (the end
 *  windows' apron); o.blocks: false leaves out the blocks under the sill */
function aedicule(K, B, xc, w, sill, spring, o = {}) {
  const A = P.AED, key = 'bathDress', r = w / 2, crown = spring + r, base = o.base ?? sill;
  const inner = r + A.band, outer = inner + A.sideGap + A.side, top = crown + A.band + A.head;
  // the architrave band round the opening: jambs and the arch
  for (const sg of [-1, 1]) B.box(key, xc + sg * (r + A.band / 2), (sill + spring) / 2, A.bandProj / 2, A.band, spring - sill, A.bandProj, 0, { top: false });
  const seg = 10, p = (a, R, z) => [xc + Math.cos(a) * R, spring + Math.sin(a) * R, z];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * PI, a1 = ((i + 1) / seg) * PI, am = (a0 + a1) / 2;
    B.poly(key, [p(a0, r, A.bandProj), p(a0, inner, A.bandProj), p(a1, inner, A.bandProj), p(a1, r, A.bandProj)], [0, 0, 1]);
    B.poly(key, [p(a0, inner, 0), p(a1, inner, 0), p(a1, inner, A.bandProj), p(a0, inner, A.bandProj)], [Math.cos(am), Math.sin(am), 0]);
    B.poly(key, [p(a0, r, 0), p(a1, r, 0), p(a1, r, A.bandProj), p(a0, r, A.bandProj)], [-Math.cos(am), -Math.sin(am), 0]);
  }
  // the outer strips with their ears, the frieze over the arch, the consoles
  for (const sg of [-1, 1]) {
    const x = xc + sg * (outer - A.side / 2);
    B.box(key, x, (base + top) / 2, A.sideProj / 2, A.side, top - base, A.sideProj, 0, { top: false });
    B.box(key, x + sg * 0.07, top - 0.21, A.sideProj / 2, A.side + 0.14, 0.42, A.sideProj, 0, { bottom: true, top: false });      // the ear
    B.box(key, x, top - A.console / 2, A.sideProj + 0.06, A.side * 0.7, A.console, 0.12, 0, { bottom: true });                // the console
  }
  B.box(key, xc, crown + A.band + A.head / 2, 0.03, 2 * outer, A.head, 0.06, 0, { bottom: true });
  // the pediment: a base moulding and the triangle
  const Wp = 2 * outer + 2 * A.pedOver, yb = top + 0.12, ya = yb + A.pedRise, z = A.pedProj;
  B.box(key, xc, top + 0.06, z / 2, Wp, 0.12, z, 0, { bottom: true });
  B.poly(key, [[xc - Wp / 2, yb, z], [xc + Wp / 2, yb, z], [xc, ya, z]], [0, 0, 1]);
  B.poly(key, [[xc - Wp / 2 - 0.04, yb, 0], [xc, ya + 0.05, 0], [xc, ya + 0.05, z + 0.04], [xc - Wp / 2 - 0.04, yb, z + 0.04]], [-A.pedRise, Wp / 2, 0]);
  B.poly(key, [[xc, ya + 0.05, 0], [xc + Wp / 2 + 0.04, yb, 0], [xc + Wp / 2 + 0.04, yb, z + 0.04], [xc, ya + 0.05, z + 0.04]], [A.pedRise, Wp / 2, 0]);
  // the sill and the blocks under it
  B.box(key, xc, base - A.sillH / 2, A.sillProj / 2, 2 * outer + 0.1, A.sillH, A.sillProj, 0, { bottom: true });
  if (o.blocks !== false) for (const sg of [-1, 1]) B.box(key, xc + sg * (r - 0.1), base - A.sillH - A.block / 2, 0.05, A.block, A.block, 0.1, 0, { bottom: true });
  return { top: ya + 0.05 };
}

/** a balustrade panel (an opening already cut in the face, depth d): its back, its plinth and its balusters */
function balusters(B, xc, o = P.BALUSTER_PANEL) {
  const { w, y0, y1, n, d } = o;
  B.face('chapelBal', [[xc - w / 2, y0], [xc + w / 2, y0], [xc + w / 2, y1], [xc - w / 2, y1]], [], -d);
  B.box('bathDress', xc, y0 + 0.04, -d / 2, w, 0.08, d, 0, {});
  for (let i = 0; i < n; i++) {
    const x = xc - w / 2 + (w * (i + 0.5)) / n;
    B.cyl('bathDress', x, y0 + 0.08, -d / 2, 0.045, (y1 - y0 - 0.08) * 0.45, 6, false, 0.07);
    B.cyl('bathDress', x, y0 + 0.08 + (y1 - y0 - 0.08) * 0.45, -d / 2, 0.065, (y1 - y0 - 0.08) * 0.55, 6, false, 0.045);
  }
}

function buildFace(ctx, K, B, f) {
  const top = P.PARAPET_TOP - 0.08, L = f.L, ops = [], after = [];
  const bp = P.BALUSTER_PANEL, panel = (xc) => { ops.push({ pts: K.rectPts(xc - bp.w / 2, bp.y0, xc + bp.w / 2, bp.y1), kind: 'void', d: bp.d }); after.push(() => balusters(B, xc)); };
  if (f.id === 'mainN' || f.id === 'mainS') {
    for (const u of P.WIN_U) {
      const xc = f.s(u);
      ops.push({ pts: K.archPts(xc, P.WIN.w, P.WIN.sill, P.WIN.spring, 12), kind: 'win', glass: 'leaded', d: 0.38, sill: false });
      after.push(() => aedicule(K, B, xc, P.WIN.w, P.WIN.sill, P.WIN.spring));
      panel(xc);
    }
  }
  if (f.id === 'westW' || f.id === 'eastE') {
    const xc = L / 2, N = P.NICHE, Sl = P.SLIT, niche = K.archPts(xc, N.w, N.sill, N.spring, 12), slit = K.archPts(xc, Sl.w, Sl.sill, Sl.spring, 10);
    ops.push({ pts: niche, kind: 'void', d: N.d });
    after.push(() => {
      B.face('bath', niche, [slit], -N.d);
      B.reveal('bath', slit, -N.d, -N.d - Sl.d);
      B.unit('leaded', slit, -N.d - Sl.d + 0.02, K.nextBay(Sl.sill));
      B.box('bathDress', xc, Sl.sill - 0.05, -N.d + 0.05, Sl.w + 0.16, 0.1, 0.12, 0, { bottom: true });
      aedicule(K, B, xc, N.w, N.sill, N.spring, { base: N.base, blocks: false });
      B.box('bathDress', xc, (N.base + N.sill) / 2, 0.02, N.w - 0.1, N.sill - N.base - 0.12, 0.04, 0, {});      // the apron's raised panel
    });
    panel(xc);
    if (f.id === 'westW') {
      const D = P.WEST_DOOR, I = P.INSCRIPTION, y0 = P.FFL, pts = K.rectPts(xc - D.w / 2, y0, xc + D.w / 2, y0 + D.h);
      ops.push({ pts, kind: 'door', doorKey: 'doorOak', d: 0.3 });
      after.push(() => {
        for (const sg of [-1, 1]) B.box('bathDress', xc + sg * (D.w / 2 + D.surround / 2), y0 + D.h / 2, 0.04, D.surround, D.h, 0.08, 0, { top: false });
        B.box('bathDress', xc, y0 + D.h + (D.cornice[0] - y0 - D.h) / 2, 0.04, D.w + 2 * D.surround, D.cornice[0] - y0 - D.h, 0.08, 0, {});
        B.box('bathDress', xc, (D.cornice[0] + D.cornice[1]) / 2, 0.11, D.w + 2 * D.surround + 0.3, D.cornice[1] - D.cornice[0], 0.22, 0, { bottom: true });
        B.box('chapelBal', xc, (I.y0 + I.y1) / 2, 0.015, I.w, I.y1 - I.y0, 0.03, 0, {});
        B.box('leadDark', xc, (I.y0 + I.y1) / 2, 0.032, I.w - 0.3, 0.035, 0.006, 0, {});      // the lettering: one incised line
      });
    }
  }
  if (f.id === 'eastN') {
    const D = P.NORTH_DOOR, xc = f.s(D.u), pts = K.rectPts(xc - D.w / 2, P.FFL, xc + D.w / 2, P.FFL + D.h);
    ops.push({ pts, kind: 'door', doorKey: 'doorOak', d: 0.3 });
    after.push(() => {
      for (const sg of [-1, 1]) B.box('bathDress', xc + sg * (D.w / 2 + 0.09), P.FFL + D.h / 2, 0.03, 0.18, D.h, 0.06, 0, { top: false });
      B.box('bathDress', xc, P.FFL + D.h + 0.11, 0.03, D.w + 0.36, 0.22, 0.06, 0, {});
    });
  }
  const gaps = ops.filter((q) => q.kind === 'door').map((q) => [Math.min(...q.pts.map((p) => p[0])) - 0.2, Math.max(...q.pts.map((p) => p[0])) + 0.2]);
  const F = K.frame(f.x, 0, f.z, f.ax, f.az);
  K.wall(B, F, K.rectPts(0, P.FOOT, L, top), ops, 'bath');
  B.push(F);
  for (const g of after) g();
  // plinth, frieze band, cornice, coping, the parapet's inner face
  const band = (key, y0, y1, pr) => B.box(key, L / 2, (y0 + y1) / 2, pr / 2, L + 2 * pr, y1 - y0, pr, 0, { bottom: true });
  const pp = P.PLINTH.proj, runs = []; let s0 = -pp;
  for (const [a, b] of gaps.sort((x, y) => x[0] - y[0])) { runs.push([s0, a]); s0 = b; }
  runs.push([s0, L + pp]);
  for (const [a, b] of runs) {
    if (b - a < 0.05) continue;
    B.box('bath', (a + b) / 2, (P.FOOT + P.PLINTH.top) / 2, pp / 2, b - a, P.PLINTH.top - P.FOOT, pp, 0, { bottom: true });
    B.poly('bathDress', [[a, P.PLINTH.top, pp], [b, P.PLINTH.top, pp], [b, P.PLINTH.top + 0.04, 0], [a, P.PLINTH.top + 0.04, 0]], [0, 1, 1]);
  }
  band('bathDress', P.FRIEZE.y - P.FRIEZE.h, P.FRIEZE.y, P.FRIEZE.proj);
  band('bathDress', P.CORNICE.y0, P.CORNICE.y1 - 0.1, P.CORNICE.proj * 0.5);
  band('bathDress', P.CORNICE.y1 - 0.1, P.CORNICE.y1, P.CORNICE.proj);
  B.box('bathDress', L / 2, top + 0.04, -P.PARAPET_T / 2 + 0.03, L + 0.08, 0.08, P.PARAPET_T + 0.1, 0, { bottom: true });
  B.poly('bath', [[0, P.GUTTER_Y, -P.PARAPET_T], [L, P.GUTTER_Y, -P.PARAPET_T], [L, top, -P.PARAPET_T], [0, top, -P.PARAPET_T]], [0, 0, -1]);
  B.pop();
  return F;
}

// ------------------------------------------------------------------------------------------------ roofs
function buildRoofs(K, B) {
  const RM = P.ROOF_MAIN, RE = P.ROOF_END, T = P.PARAPET_T, key = 'stoneSlate', cap = 'bathDress';
  const outline = [[W.u0, W.v0], [M.u0, W.v0], [M.u0, M.v0], [M.u1, M.v0], [M.u1, E.v0], [E.u1, E.v0], [E.u1, E.v1], [M.u1, E.v1], [M.u1, M.v1], [M.u0, M.v1], [M.u0, W.v1], [W.u0, W.v1]];
  B.flat('leadDark', outline, P.GUTTER_Y);
  K.roof(B, key, RM.u0, RM.u1, RM.v0, RM.v1, P.EAVES, P.RIDGE - P.EAVES, { axis: 'x', ends: ['hip', 'hip'], ov: 0 });
  const rise = P.END_RIDGE - P.EAVES;
  K.roof(B, key, W.u0 + T, RE.westIn, RE.v0, RE.v1, P.EAVES, rise, { axis: 'x', ends: ['hip', 'open'], ov: 0 });
  K.roof(B, key, RE.eastIn, E.u1 - T, RE.v0, RE.v1, P.EAVES, rise, { axis: 'x', ends: ['open', 'hip'], ov: 0 });
  // ridge and hip cappings (pale in every photograph)
  const hm = (RM.v1 - RM.v0) / 2, vc = (RM.v0 + RM.v1) / 2, r0 = RM.u0 + hm, r1 = RM.u1 - hm, y = P.RIDGE + 0.03;
  B.beam(cap, [r0, y, vc], [r1, y, vc], 0.2, 0.1);
  for (const [cu, cv, ru] of [[RM.u0, RM.v0, r0], [RM.u0, RM.v1, r0], [RM.u1, RM.v0, r1], [RM.u1, RM.v1, r1]]) B.beam(cap, [cu, P.EAVES + 0.03, cv], [ru, y, vc], 0.18, 0.08);
  const he = (RE.v1 - RE.v0) / 2, ye = P.END_RIDGE + 0.03, slope = (P.RIDGE - P.EAVES) / hm, meetW = RM.u0 + (P.END_RIDGE - P.EAVES) / slope, meetE = RM.u1 - (P.END_RIDGE - P.EAVES) / slope;
  for (const [ou, ru, mu] of [[W.u0 + T, W.u0 + T + he, meetW], [E.u1 - T, E.u1 - T - he, meetE]]) {
    B.beam(cap, [ru, ye, vc], [mu, ye, vc], 0.18, 0.08);
    for (const cv of [RE.v0, RE.v1]) B.beam(cap, [ou, P.EAVES + 0.03, cv], [ru, ye, vc], 0.16, 0.08);
  }
}

// ------------------------------------------------------------------------------------------------ fittings
function buildFittings(ctx, K, B) {
  const { S } = ctx;
  // lead downpipes with their heads
  for (const [u, v] of P.PIPES) {
    const g = S.groundY(u, v) - 0.05;
    B.cyl('leadDark', u, g, v, 0.055, 9.95 - g, 6, false);
    B.box('leadDark', u, 10.05, v, 0.3, 0.28, 0.3, 0, { bottom: true });
  }
  // steps at the doors
  const st = P.STEP, Dw = P.WEST_DOOR, Dn = P.NORTH_DOOR, vc = (W.v0 + W.v1) / 2;
  const gw = S.groundY(W.u0 - 0.3, vc);
  B.box('pavingSolid', W.u0 - st.d / 2, (gw - 0.3 + P.FFL) / 2, vc, st.d, P.FFL - gw + 0.3, Dw.w + 2 * st.over, 0, {});
  const gn = S.groundY(Dn.u, E.v0 - 0.3);
  B.box('pavingSolid', Dn.u, (gn - 0.3 + P.FFL) / 2, E.v0 - st.d / 2, Dn.w + 2 * st.over, P.FFL - gn + 0.3, st.d, 0, {});
  ctx.floor([[W.u0 - st.d, vc - Dw.w / 2 - st.over], [W.u0, vc - Dw.w / 2 - st.over], [W.u0, vc + Dw.w / 2 + st.over], [W.u0 - st.d, vc + Dw.w / 2 + st.over]], P.FFL);
  ctx.floor([[Dn.u - Dn.w / 2 - st.over, E.v0 - st.d], [Dn.u + Dn.w / 2 + st.over, E.v0 - st.d], [Dn.u + Dn.w / 2 + st.over, E.v0], [Dn.u - Dn.w / 2 - st.over, E.v0]], P.FFL);
  // the yew hedge along the north foot
  const H = P.HEDGE_N;
  hedgeRun(ctx, B, 'yew', H.u0, H.u1, H.v0, H.v1, H.h, 'u');
  ctx.solid([[H.u0, H.v0], [H.u1, H.v0], [H.u1, H.v1], [H.u0, H.v1]]);
  // the lamp post by the west door
  const lp = K.lampPost(B, P.LAMP[0], P.LAMP[1], S.groundY(P.LAMP[0], P.LAMP[1]), 3.3);
  ctx.lamp(lp[0], lp[1], lp[2]);
  ctx.solid([[P.LAMP[0] - 0.12, P.LAMP[1] - 0.12], [P.LAMP[0] + 0.12, P.LAMP[1] - 0.12], [P.LAMP[0] + 0.12, P.LAMP[1] + 0.12], [P.LAMP[0] - 0.12, P.LAMP[1] + 0.12]]);
}

/** the iron escape on the east face: the landing, the caged ladder over the parapet, two flights down */
function buildEscape(ctx, K, B) {
  const X = P.ESCAPE, u0 = E.u1, k = 'ironBlack';
  const rail = (a, b) => B.beam(k, a, b, 0.04);
  // the top landing and its rails
  const lu1 = u0 + X.out, [lv0, lv1] = X.landV;
  B.box(k, (u0 + lu1) / 2, X.landY - 0.04, (lv0 + lv1) / 2, X.out, 0.08, lv1 - lv0, 0, { bottom: true });
  for (const [a, b] of [[[u0, lv0], [lu1, lv0]], [[lu1, lv0], [lu1, lv1]]]) { rail([a[0], X.landY + 1.05, a[1]], [b[0], X.landY + 1.05, b[1]]); rail([a[0], X.landY + 0.5, a[1]], [b[0], X.landY + 0.5, b[1]]); }
  for (const [u, v] of [[lu1, lv0], [lu1, lv1], [u0 + 0.05, lv0]]) B.box(k, u, X.landY - 0.6, v, 0.06, 1.7 + 0.6, 0.06, 0, { bottom: true });
  // the caged ladder from the landing to over the parapet
  const lv = lv0 + 0.55, lu = u0 + 0.35;
  for (const dv of [-0.22, 0.22]) B.box(k, lu, (X.landY + X.cageTop) / 2, lv + dv, 0.05, X.cageTop - X.landY, 0.06, 0, {});
  for (let y = X.landY + 0.3; y < X.cageTop; y += 0.3) B.box(k, lu, y, lv, 0.03, 0.03, 0.44, 0, {});
  for (let y = X.landY + 2.2; y <= X.cageTop + 0.01; y += 0.9) {
    rail([lu, y, lv - 0.38], [lu + 0.7, y, lv - 0.38]); rail([lu + 0.7, y, lv - 0.38], [lu + 0.7, y, lv + 0.38]); rail([lu + 0.7, y, lv + 0.38], [lu, y, lv + 0.38]);
  }
  for (const [du, dv] of [[0.7, 0], [0.7, -0.38], [0.7, 0.38], [0.35, -0.38], [0.35, 0.38]]) B.box(k, lu + du, (X.landY + 2.2 + X.cageTop) / 2, lv + dv, 0.04, X.cageTop - X.landY - 2.2, 0.04, 0, {});
  // two flights: south from the landing to a half landing, back north to the ground
  const [mv0, mv1] = X.midV, fl = (ua, ub, va, ya, vb, yb) => {
    for (const u of [ua, ub]) { rail([u, ya, va], [u, yb, vb]); rail([u, ya + 0.95, va], [u, yb + 0.95, vb]); }
    const n = Math.max(2, Math.round(Math.abs(ya - yb) / 0.2));
    for (let i = 1; i < n; i++) { const t = i / n; B.box(k, (ua + ub) / 2, ya + (yb - ya) * t, va + (vb - va) * t, ub - ua, 0.04, 0.24, 0, { bottom: true }); }
  };
  fl(u0 + 0.08, u0 + X.w, lv1, X.landY, mv0, X.midY);
  const g = S0(ctx).groundY(u0 + X.w + 0.5, lv1);
  fl(u0 + X.w + 0.05, u0 + 2 * X.w, mv0, X.midY, lv1 - 0.4, g);
  B.box(k, u0 + X.w, X.midY - 0.04, (mv0 + mv1) / 2, 2 * X.w, 0.08, mv1 - mv0, 0, { bottom: true });
  for (const [u, v] of [[u0 + 2 * X.w, mv1], [u0 + 0.05, mv1], [u0 + 2 * X.w, mv0]]) B.box(k, u, (X.midY + 1.05 + g) / 2, v, 0.06, X.midY + 1.05 - g, 0.06, 0, { bottom: true });
  rail([u0 + 0.05, X.midY + 1.05, mv1], [u0 + 2 * X.w, X.midY + 1.05, mv1]);
}
const S0 = (ctx) => ctx.S;

// ------------------------------------------------------------------------------------------------ garden helpers
/** a clipped hedge u0..u1 x v0..v1 standing on the ground, h high, in runs of about 2 m along `axis` */
function hedgeRun(ctx, B, key, u0, u1, v0, v1, h, axis) {
  const a0 = axis === 'u' ? u0 : v0, a1 = axis === 'u' ? u1 : v1, n = Math.max(1, Math.ceil((a1 - a0) / 2));
  for (let i = 0; i < n; i++) {
    const b0 = a0 + ((a1 - a0) * i) / n, b1 = a0 + ((a1 - a0) * (i + 1)) / n;
    const [x0, x1, z0, z1] = axis === 'u' ? [b0, b1, v0, v1] : [u0, u1, b0, b1];
    const g = ctx.S.groundY((x0 + x1) / 2, (z0 + z1) / 2), lo = Math.min(ctx.S.groundY(x0, z0), ctx.S.groundY(x1, z1), g) - 0.1;
    B.box(key, (x0 + x1) / 2, (lo + g + h) / 2, (z0 + z1) / 2, x1 - x0 + 0.02, g + h - lo, z1 - z0, 0, {});
  }
}

/** a wall on the LOCAL line a -> b, t thick, its top h over the surveyed ground (sloping with it), its foot 0.4 under it;
 *  keyA on the face to (-dv, du) of the direction (walking east, the south face), keyB on the other; a coping of
 *  `cope` 0.06 proud each side; o.ends: [true, true] closes the ends */
function gardenWall(ctx, B, a, b, h, t, keyA, keyB, cope, o = {}) {
  const gy = ctx.S.groundY, du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv), n = Math.max(1, Math.ceil(L / 2));
  const eu = du / L, ev = dv / L, nu = -ev, nv = eu, ht = t / 2;
  for (let i = 0; i < n; i++) {
    const p = [a[0] + (du * i) / n, a[1] + (dv * i) / n], q = [a[0] + (du * (i + 1)) / n, a[1] + (dv * (i + 1)) / n];
    const yp = gy(p[0], p[1]) + h, yq = gy(q[0], q[1]) + h, fp = gy(p[0], p[1]) - 0.4, fq = gy(q[0], q[1]) - 0.4;
    for (const [sg, key] of [[1, keyA], [-1, keyB]]) {
      const o2 = sg * ht;
      B.poly(key, [[p[0] + nu * o2, fp, p[1] + nv * o2], [q[0] + nu * o2, fq, q[1] + nv * o2], [q[0] + nu * o2, yq - 0.1, q[1] + nv * o2], [p[0] + nu * o2, yp - 0.1, p[1] + nv * o2]], [nu * sg, 0, nv * sg]);
    }
    // the coping: brick on edge, 0.1 deep, 0.06 proud
    const c = ht + 0.06;
    B.poly(cope, [[p[0] + nu * c, yp, p[1] + nv * c], [q[0] + nu * c, yq, q[1] + nv * c], [q[0] - nu * c, yq, q[1] - nv * c], [p[0] - nu * c, yp, p[1] - nv * c]], [0, 1, 0]);
    for (const sg of [1, -1]) B.poly(cope, [[p[0] + nu * c * sg, yp - 0.1, p[1] + nv * c * sg], [q[0] + nu * c * sg, yq - 0.1, q[1] + nv * c * sg], [q[0] + nu * c * sg, yq, q[1] + nv * c * sg], [p[0] + nu * c * sg, yp, p[1] + nv * c * sg]], [nu * sg, 0, nv * sg]);
    for (const sg of [1, -1]) B.poly(cope, [[p[0] + nu * c * sg, yp - 0.1, p[1] + nv * c * sg], [q[0] + nu * c * sg, yq - 0.1, q[1] + nv * c * sg], [q[0] + nu * ht * sg, yq - 0.1, q[1] + nv * ht * sg], [p[0] + nu * ht * sg, yp - 0.1, p[1] + nv * ht * sg]], [0, -1, 0]);
  }
  const ends = o.ends || [true, true];
  for (const [k, pt, dir] of [[0, a, -1], [1, b, 1]]) {
    if (!ends[k]) continue;
    const y = gy(pt[0], pt[1]) + h, f = gy(pt[0], pt[1]) - 0.4, c = ht + 0.06;
    B.poly(keyB, [[pt[0] + nu * ht, f, pt[1] + nv * ht], [pt[0] - nu * ht, f, pt[1] - nv * ht], [pt[0] - nu * ht, y - 0.1, pt[1] - nv * ht], [pt[0] + nu * ht, y - 0.1, pt[1] + nv * ht]], [eu * dir, 0, ev * dir]);
    B.poly(cope, [[pt[0] + nu * c, y - 0.1, pt[1] + nv * c], [pt[0] - nu * c, y - 0.1, pt[1] - nv * c], [pt[0] - nu * c, y, pt[1] - nv * c], [pt[0] + nu * c, y, pt[1] + nv * c]], [eu * dir, 0, ev * dir]);
  }
  ctx.seg(a[0], a[1], b[0], b[1]);
}

/** iron railing along the LOCAL polyline at level y: posts every 1.6 m, a top rail and a middle rail */
function railing(B, line, y, h = P.RAIL_H) {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.6));
    for (let k = 0; k <= n; k++) { const t = k / n; B.box('ironBlack', a[0] + (b[0] - a[0]) * t, y + h / 2, a[1] + (b[1] - a[1]) * t, 0.05, h, 0.05, 0, {}); }
    for (const yy of [y + h, y + h * 0.5]) B.beam('ironBlack', [a[0], yy, a[1]], [b[0], yy, b[1]], 0.045);
  }
}

// ------------------------------------------------------------------------------------------------ the Fellows' Garden
function buildGarden(ctx, K, B) {
  const { G, S } = ctx, gy = S.groundY, GD = P.GARDEN, NW = P.NWALL, EW = P.EWALL, EH = P.EHEDGE;
  const R = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const eIn = EW.u - EW.t / 2;      // the east wall's garden face
  // ground: borders, walks, lawns (LOCAL rings draped on the survey; nothing pushed on the Batch here)
  G.drape(B, 'flowerbed', R(NW.u0 + 0.2, eIn, GD.northBed[0], GD.northBed[1]), 0.07);
  G.drape(B, 'gravel', R(GD.westWalk[0], eIn, GD.northWalk[0], GD.northWalk[1]), 0.08);
  G.drape(B, 'gravel', R(GD.westWalk[0], GD.westWalk[1], GD.northWalk[1], GD.southWalk[0]), 0.08);
  G.drape(B, 'gravel', R(GD.westWalk[0], EH.u1, GD.southWalk[0], GD.southWalk[1]), 0.08);
  const ring = []; for (let i = 0; i < 20; i++) { const a = (i / 20) * 2 * PI; ring.push([P.SUNDIAL.u + Math.cos(a) * P.SUNDIAL.r, P.SUNDIAL.v + Math.sin(a) * P.SUNDIAL.r]); }
  const Lw = GD.lawn;
  G.drape(B, 'lawn', R(Lw.u0, Lw.u1, Lw.v0, Lw.v1), 0.07);
  G.drape(B, 'flowerbed', ring, 0.09);
  G.drape(B, 'flowerbed', R(GD.westWalk[0], eIn, GD.southBed[0], GD.southBed[1]), 0.07);
  const LL = GD.lowLawn;
  G.drape(B, 'lawn', [[GD.westWalk[0], LL.v0], [eIn, LL.v0], [eIn, LL.v1], [LL.u0, LL.v1], [LL.u0, P.PENROSE_SE[1]], [GD.westWalk[0], P.PENROSE_SE[1]]], 0.07);
  G.drape(B, 'flowerbed', R(LL.u0, eIn, GD.vaughanBed[0], GD.vaughanBed[1]), 0.07);
  // a few clipped shrubs in the borders (the satellite's dark masses), low
  for (const [u, v, w, d, h] of [[-38.5, 40.5, 1.6, 0.9, 1.1], [-33.0, 40.5, 1.2, 0.9, 0.9], [-24.0, 40.5, 2.0, 0.9, 1.2], [-18.0, 40.5, 1.4, 0.9, 1.0],
    [-39.0, 54.5, 2.2, 1.8, 1.3], [-33.5, 54.0, 1.6, 1.4, 1.0], [-27.0, 54.8, 2.4, 1.8, 1.5], [-20.5, 54.2, 1.8, 1.5, 1.2], [-16.0, 54.8, 1.6, 1.6, 1.4]]) {
    const g = gy(u, v), key = ['leafA', 'leafC', 'leafB'][Math.abs(Math.round(u * 3)) % 3], r = (w + d) / 4;
    B.cyl(key, u, g - 0.05, v, r * 0.9, h * 0.55, 8, false, r * 0.75); B.cyl(key, u, g + h * 0.5 - 0.05, v, r * 0.35, h * 0.5, 8, true, r * 0.9);
  }
  // the north wall: rubble outside (north), red brick on the garden face, a brick coping; the plank door by Penrose
  const D = P.NDOOR;
  gardenWall(ctx, B, [NW.u0, NW.v], [D.u0, NW.v], NW.h, NW.t, 'brick', 'rubble', 'brick', { ends: [false, true] });
  gardenWall(ctx, B, [D.u1, NW.v], [NW.u1, NW.v], NW.h, NW.t, 'brick', 'rubble', 'brick', { ends: [true, false] });
  const gd = gy((D.u0 + D.u1) / 2, NW.v);
  B.box('oakDoor', (D.u0 + D.u1) / 2, gd + D.h / 2, NW.v, D.u1 - D.u0, D.h + 0.1, 0.06, 0, {});
  B.box('brick', (D.u0 + D.u1) / 2, gd + (D.h + NW.h) / 2 + 0.05, NW.v, D.u1 - D.u0 + 0.02, NW.h - D.h - 0.1, NW.t, 0, {});
  B.box('brick', (D.u0 + D.u1) / 2, gd + NW.h - 0.05, NW.v, D.u1 - D.u0 + 0.02, 0.1, NW.t + 0.12, 0, {});
  ctx.seg(D.u0, NW.v, D.u1, NW.v);
  // the east wall (rubble both faces) broken at the walk, and the clipped hedge outside it
  gardenWall(ctx, B, [EW.u, EW.v0], [EW.u, EW.gap[0]], EW.h, EW.t, 'rubble', 'rubble', 'brick', { ends: [false, true] });
  gardenWall(ctx, B, [EW.u, EW.gap[1]], [EW.u, EW.v1], EW.h, EW.t, 'rubble', 'rubble', 'brick', { ends: [true, false] });
  hedgeRun(ctx, B, 'hedgeGreen', EH.u0, EH.u1, EH.v0, EH.gap[0], EH.h, 'v');
  hedgeRun(ctx, B, 'hedgeGreen', EH.u0, EH.u1, EH.gap[1], EH.v1, EH.h, 'v');
  ctx.solid(R(EH.u0, EH.u1, EH.v0, EH.gap[0])); ctx.solid(R(EH.u0, EH.u1, EH.gap[1], EH.v1));
  // the lean-to shed on the north face of the north wall
  const SH = P.SHED, g0 = Math.min(gy(SH.u0, SH.v0), gy(SH.u1, SH.v0)), yb = gy((SH.u0 + SH.u1) / 2, SH.v1) + SH.hBack, yf = g0 + SH.hFront;
  K.prism(B, 'timberGrey', R(SH.u0, SH.u1, SH.v0, SH.v1), g0 - 0.2, yf, {});
  for (const u of [SH.u0, SH.u1]) B.poly('timberGrey', [[u, yf, SH.v0], [u, yf, SH.v1], [u, yb, SH.v1]], [u === SH.u0 ? -1 : 1, 0, 0]);
  B.poly('leadDark', [[SH.u0 - 0.1, yf - 0.03, SH.v0 - 0.15], [SH.u1 + 0.1, yf - 0.03, SH.v0 - 0.15], [SH.u1 + 0.1, yb + 0.02, SH.v1], [SH.u0 - 0.1, yb + 0.02, SH.v1]], [0, 1, -0.2]);
  B.push(K.frame(SH.u1 - 1.0, 0, SH.v0, -1, 0)); B.face('oakDoor', K.rectPts(0, g0, 0.85, g0 + 1.8), [], 0.01); B.pop();
  ctx.solid(R(SH.u0, SH.u1, SH.v0, SH.v1));
  // the sundial on its pedestal in the round bed
  const SD = P.SUNDIAL, gs = gy(SD.u, SD.v);
  B.box('bathOld', SD.u, gs + 0.06, SD.v, SD.plinth, 0.2, SD.plinth, 0, {});
  B.box('bathOld', SD.u, gs + 0.16 + (SD.h - 0.28) / 2, SD.v, SD.shaft, SD.h - 0.28, SD.shaft, 0, { top: false });
  B.box('bathDress', SD.u, gs + SD.h - 0.06, SD.v, SD.shaft + 0.14, 0.1, SD.shaft + 0.14, 0, { bottom: true });
  B.box('lead', SD.u, gs + SD.h + 0.005, SD.v, 0.3, 0.012, 0.3, 0, {});
  B.poly('ironBlack', [[SD.u, gs + SD.h + 0.01, SD.v + 0.12], [SD.u, gs + SD.h + 0.01, SD.v - 0.12], [SD.u, gs + SD.h + 0.14, SD.v + 0.1]], [1, 0, 0]);
  B.poly('ironBlack', [[SD.u, gs + SD.h + 0.01, SD.v + 0.12], [SD.u, gs + SD.h + 0.01, SD.v - 0.12], [SD.u, gs + SD.h + 0.14, SD.v + 0.1]], [-1, 0, 0]);
  ctx.solid(R(SD.u - 0.35, SD.u + 0.35, SD.v - 0.35, SD.v + 0.35));
  // the forecourt at the Chapel's west end
  G.drape(B, 'paving', P.FORECOURT, 0.08);
}

// ------------------------------------------------------------------------------------------------ the terrace
function buildTerrace(ctx, K, B) {
  const { G, S } = ctx, gy = S.groundY, TY = P.TY, WY = P.WALK_Y;
  const R = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  G.drape(B, 'paving', P.TERRACE, 0, { y: () => TY });
  ctx.floor(P.TERRACE, TY);
  // the wide steps from the forecourt, rising east along the west block's south side (in a turned frame: x = -v, z = u)
  const WS = P.WSTEPS, going = (WS.u1 - WS.u0) / (WS.n - 1), yb = gy(WS.u0 - 0.3, (WS.v0 + WS.v1) / 2), rise = (TY - yb) / WS.n;
  B.push(K.frame(0, 0, 0, 0, -1));
  K.steps(B, 'pavingSolid', -WS.v1, -WS.v0, WS.u1, -1, WS.n - 1, rise, going, TY, yb - 0.4);
  B.pop();
  ctx.floor(R(WS.u0, WS.u1, WS.v0, WS.v1), (u) => { const k = Math.min(WS.n - 2, Math.max(0, Math.floor((WS.u1 - u) / going))); return TY - rise * (k + 1); });
  // the steps' south cheek: stone, up to the walkway's level west of the terrace's wall, to the terrace's east of it
  const C = P.CHEEK, gc = gy(WS.u0, C.v0) - 0.4;
  B.box('bathOld', (WS.u0 - 0.2 + P.RWALL_W.u1) / 2, (gc + WY + 0.05) / 2, (C.v0 + C.v1) / 2, P.RWALL_W.u1 - WS.u0 + 0.2, WY + 0.05 - gc, C.v1 - C.v0, 0, {});
  B.box('bathOld', (P.RWALL_W.u1 + WS.u1) / 2, (gc + TY + 0.1) / 2, (C.v0 + C.v1) / 2, WS.u1 - P.RWALL_W.u1, TY + 0.1 - gc, C.v1 - C.v0, 0, {});
  ctx.seg(WS.u0 - 0.2, C.v0, WS.u1, C.v0);
  // the retaining walls up to the walkway, coped, with railings; the flight up in the south-west corner
  const RW = P.RWALL_W, RS = P.RWALL_S, SS = P.SSTEPS, low = (u0, u1, v0, v1) => Math.min(gy(u0, v0), gy(u1, v1), gy(u0, v1), gy(u1, v0)) - 0.5;
  const wallBox = (u0, u1, v0, v1) => { const f = low(u0, u1, v0, v1); B.box('rubble', (u0 + u1) / 2, (f + WY - 0.05) / 2, (v0 + v1) / 2, u1 - u0, WY - 0.05 - f, v1 - v0, 0, {}); B.box('bathDress', (u0 + u1) / 2, WY, (v0 + v1) / 2, u1 - u0 + 0.08, 0.1, v1 - v0 + 0.1, 0, { bottom: true }); };
  wallBox(RW.u0, RW.u1, RW.v0, RW.v1 - (RS.v1 - RS.v0));
  wallBox(RS.u0, SS.u0, RS.v0, RS.v1);
  wallBox(SS.u1, RS.u1, RS.v0, RS.v1);
  ctx.seg(RW.u1, RW.v0, RW.u1, RS.v0); ctx.seg(RW.u1, RS.v0, SS.u0, RS.v0); ctx.seg(SS.u1, RS.v0, RS.u1, RS.v0);
  railing(B, [[RW.u1 - 0.15, RW.v0 + 0.1], [RW.u1 - 0.15, RS.v0 + 0.15], [SS.u0, RS.v0 + 0.15]], WY + 0.05);
  railing(B, [[SS.u1, RS.v0 + 0.15], [RS.u1 - 0.2, RS.v0 + 0.15]], WY + 0.05);
  const srise = (WY - TY) / (SS.n + 1);
  K.steps(B, 'pavingSolid', SS.u0, SS.u1, SS.vTop, -1, SS.n, srise, SS.going, WY, TY - 0.05);
  B.box('pavingSolid', (SS.u0 + SS.u1) / 2, (TY + WY) / 2, (RS.v0 + RS.v1) / 2, SS.u1 - SS.u0, WY - TY, RS.v1 - RS.v0, 0, {});
  ctx.floor(R(SS.u0, SS.u1, SS.vTop - SS.n * SS.going, SS.vTop), (u, v) => { const k = Math.min(SS.n - 1, Math.max(0, Math.floor((SS.vTop - v) / SS.going))); return WY - srise * (k + 1); });
  ctx.floor(R(SS.u0, SS.u1, RS.v0, RS.v1), WY);
  // the boundary wall on the east
  const BW = P.BWALL, fb = low(BW.u0, BW.u1, BW.v0, BW.v1);
  B.box('rubble', (BW.u0 + BW.u1) / 2, (fb + TY + BW.h) / 2, (BW.v0 + BW.v1) / 2, BW.u1 - BW.u0, TY + BW.h - fb, BW.v1 - BW.v0, 0, {});
  B.box('brick', (BW.u0 + BW.u1) / 2, TY + BW.h + 0.05, (BW.v0 + BW.v1) / 2, BW.u1 - BW.u0 + 0.12, 0.1, BW.v1 - BW.v0, 0, { bottom: true });
  ctx.seg(BW.u0, BW.v0, BW.u0, BW.v1);
  K.bench(B, BW.u0 - 0.45, 70.5, TY, -PI / 2, 1.8);
  // the raised vegetable beds
  for (const b of P.BEDS) {
    K.prism(B, 'brick', R(b.u0, b.u1, b.v0, b.v1), TY - 0.02, TY + b.h, {});
    B.box('bathDress', (b.u0 + b.u1) / 2, TY + b.h + 0.02, b.v0 + 0.06, b.u1 - b.u0, 0.04, 0.12, 0, {});
    B.box('bathDress', (b.u0 + b.u1) / 2, TY + b.h + 0.02, b.v1 - 0.06, b.u1 - b.u0, 0.04, 0.12, 0, {});
    B.flat('soil', R(b.u0 + 0.11, b.u1 - 0.11, b.v0 + 0.11, b.v1 - 0.11), TY + b.h - 0.05);
    for (let i = 0; i < 4; i++) { const u = b.u0 + 0.6 + i * 2.6; B.box(i & 1 ? 'leafB' : 'leafA', u + 0.8, TY + b.h + 0.06, (b.v0 + b.v1) / 2, 1.7, 0.2, b.v1 - b.v0 - 0.6, 0, {}); }
    ctx.solid(R(b.u0, b.u1, b.v0, b.v1));
  }
  // the glasshouse: a brick base, glass walls and a glass ridged roof on white frames
  const GH = P.GLASSHOUSE, gr = R(GH.u0, GH.u1, GH.v0, GH.v1), ye = TY + GH.eaves;
  K.prism(B, 'brick', gr, TY - 0.02, TY + GH.base, { top: false });
  B.box('bathDress', (GH.u0 + GH.u1) / 2, TY + GH.base, (GH.v0 + GH.v1) / 2, GH.u1 - GH.u0 + 0.06, 0.05, GH.v1 - GH.v0 + 0.06, 0, {});
  K.prism(B, 'glassRoof', gr, TY + GH.base + 0.02, ye, {});
  K.roof(B, 'glassRoof', GH.u0, GH.u1, GH.v0, GH.v1, ye, GH.rise, { axis: 'z', ends: ['gable', 'gable'], ov: 0.05, wallKey: 'glassRoof' });
  for (const [u, v] of [[GH.u0, GH.v0], [GH.u1, GH.v0], [GH.u0, GH.v1], [GH.u1, GH.v1]]) B.box('whitePaint', u, (TY + GH.base + ye) / 2, v, 0.07, ye - TY - GH.base, 0.07, 0, {});
  for (let v = GH.v0 + 1.5; v < GH.v1 - 0.5; v += 1.5) for (const u of [GH.u0, GH.u1]) B.box('whitePaint', u, (TY + GH.base + ye) / 2, v, 0.05, ye - TY - GH.base, 0.05, 0, {});
  B.beam('whitePaint', [(GH.u0 + GH.u1) / 2, ye + GH.rise + 0.02, GH.v0 - 0.05], [(GH.u0 + GH.u1) / 2, ye + GH.rise + 0.02, GH.v1 + 0.05], 0.08);
  B.push(K.frame((GH.u0 + GH.u1) / 2 + 0.45, 0, GH.v0 - 0.01, -1, 0)); B.unit('doorGrey', K.rectPts(0, TY, 0.9, TY + 1.95), 0); B.pop();
  ctx.solid(gr);
  // the frames: low brick boxes with sloping glass lids
  const FR = P.FRAMES;
  K.prism(B, 'brick', R(FR.u0, FR.u1, FR.v0, FR.v1), TY - 0.02, TY + FR.hFront, { top: false });
  B.poly('brick', [[FR.u0, TY + FR.hFront, FR.v0], [FR.u1, TY + FR.hFront, FR.v0], [FR.u1, TY + FR.hBack, FR.v0]], [0, 0, -1]);
  B.poly('glassRoof', [[FR.u0, TY + FR.hBack, FR.v0], [FR.u1, TY + FR.hBack, FR.v0], [FR.u1, TY + FR.hFront, FR.v1], [FR.u0, TY + FR.hFront, FR.v1]], [0, 1, 0.3]);
  B.box('brick', FR.u0 + 0.06, TY + (FR.hBack + FR.hFront) / 2, (FR.v0 + FR.v1) / 2, 0.12, FR.hBack - FR.hFront, FR.v1 - FR.v0, 0, { top: false });
  B.box('brick', FR.u1 - 0.06, TY + (FR.hBack + FR.hFront) / 2, (FR.v0 + FR.v1) / 2, 0.12, FR.hBack - FR.hFront, FR.v1 - FR.v0, 0, { top: false });
  for (let u = FR.u0 + 1.4; u < FR.u1 - 0.1; u += 1.4) B.beam('whitePaint', [u, TY + FR.hBack + 0.01, FR.v0], [u, TY + FR.hFront + 0.01, FR.v1], 0.04);
  ctx.solid(R(FR.u0, FR.u1, FR.v0, FR.v1));
}

// ------------------------------------------------------------------------------------------------ the part
export function buildChapel(ctx) {
  const { B, K, pack } = ctx;
  addCells(K, pack);
  const n0 = B.tris();
  for (const f of faces()) buildFace(ctx, K, B, f);
  buildRoofs(K, B);
  buildFittings(ctx, K, B);
  buildEscape(ctx, K, B);
  const nChapel = B.tris() - n0;
  ctx.solid([[W.u0, W.v0], [M.u0, W.v0], [M.u0, M.v0], [M.u1, M.v0], [M.u1, E.v0], [E.u1, E.v0], [E.u1, E.v1], [M.u1, E.v1], [M.u1, M.v1], [M.u0, M.v1], [M.u0, W.v1], [W.u0, W.v1]]);
  buildGarden(ctx, K, B);
  const nGarden = B.tris() - n0 - nChapel;
  buildTerrace(ctx, K, B);
  return { chapelTris: Math.round(nChapel), gardenTris: Math.round(nGarden), terraceTris: Math.round(B.tris() - n0 - nChapel - nGarden) };
}
