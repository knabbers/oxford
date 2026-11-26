// Somerville College, STANDALONE model, part 'penrose' (B07): the build functions. Called by somerville_penrose.js with
// ctx.B already in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from
// _somerville_penrose_plan.js (sources and K / G there). Inside Penrose's own frame (PF) the Batch's x = plan x (east
// along the north faces), z = plan y (south). Helpers written here (not in the kit): faces (the outline's faces with their
// wall frames), roofH (the height of the roof envelope at a plan point), hipDormer (a small hipped dormer on any slope).
import * as P from './_somerville_penrose_plan.js';

const { OUTLINE, FFL, FOOT, PLINTH, SILL, HEAD, BAND, FRIEZE, EAVES, CORNICE, WIN, OPENINGS, DOORS, DOORCASE, PORCH, LOGGIA, QUOIN, ROOFS } = P;

// ------------------------------------------------------------------------------------------------ the outline's faces
/** the faces of the outline: each with its plan end points, its wall frame (s from q back to p, outward normal +z), s of
 *  a plan coordinate along it, whether each end is a salient corner, and its openings by floor */
function faces(K) {
  const n = OUTLINE.length, pt = (i) => OUTLINE[(i + n) % n][0];
  const salient = (i) => { const a = pt(i - 1), b = pt(i), c = pt(i + 1), d1 = [b[0] - a[0], b[1] - a[1]], d2 = [c[0] - b[0], c[1] - b[1]]; return d1[0] * d2[1] - d1[1] * d2[0] > 0; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pt(i), q = pt(i + 1), name = OUTLINE[i][1], dx = p[0] - q[0], dz = p[1] - q[1], L = Math.hypot(dx, dz);
    const horiz = Math.abs(dz) < 1e-6, sOf = (at) => (horiz ? (at - q[0]) * Math.sign(dx) : (at - q[1]) * Math.sign(dz));
    const ops = (OPENINGS[name] || []).map((o) => ({ ...o, s: sOf(o.at) })), doors = (DOORS[name] || []).map((o) => ({ ...o, s: sOf(o.at) }));
    out.push({ i, name, p, q, L, F: K.frame(q[0], 0, q[1], dx, dz), sOf, horiz, ops, doors, salQ: salient(i + 1), salP: salient(i), out: [-dz / L, dx / L] });
  }
  return out;
}

/** the roof envelope's height at plan (x, y): the highest of the hipped boxes there (-Infinity outside them all) */
export function roofH(x, y) {
  let h = -Infinity;
  for (const r of ROOFS) {
    if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
    const ax = r.axis === 'x', a = ax ? x : y, a0 = ax ? r.x0 : r.y0, a1 = ax ? r.x1 : r.y1, c = ax ? y : x, c0 = ax ? r.y0 : r.x0, c1 = ax ? r.y1 : r.x1;
    const R = r.ridge - EAVES, hs = (c1 - c0) / 2, hr = r.hipRun ?? hs;
    const dA = Math.min(r.ends[0] === 'hip' ? a - a0 : Infinity, r.ends[1] === 'hip' ? a1 - a : Infinity);
    h = Math.max(h, EAVES + Math.min((R / hs) * Math.min(c - c0, c1 - c), (R / hr) * dA, R));
  }
  return h;
}

// ------------------------------------------------------------------------------------------------ walls
const arch = (K, s, w, y0, ys) => K.archPts(s, w, y0, ys, 12);
function loggiaArches() { const L = LOGGIA, out = []; for (let k = 0; k < 3; k++) { const y0 = L.y0 + k * (L.open + L.pier); out.push([y0, y0 + L.open]); } return out; }

function buildFace(K, B, f) {
  const ops = [];
  for (const o of f.ops) for (const fl of o.fl) {
    ops.push({ pts: K.rectPts(o.s - o.w / 2, SILL[fl], o.s + o.w / 2, HEAD[fl]), kind: 'win', glass: 'sash', d: WIN.reveal, sillKey: 'brickDark' });
  }
  for (const d of f.doors) {
    if (d.doorcase) ops.push({ pts: K.rectPts(d.s - d.w / 2, FFL, d.s + d.w / 2, DOORCASE.over[1]), kind: 'void', d: 0.25, revealKey: 'bathDress' });
    else ops.push({ pts: K.rectPts(d.s - d.w / 2, FFL, d.s + d.w / 2, FFL + d.h), kind: 'door', doorKey: 'doorOak', d: 0.2 });
  }
  if (f.name === 'recE') for (const [y0, y1] of loggiaArches()) ops.push({ pts: arch(K, f.sOf((y0 + y1) / 2), LOGGIA.open, FFL, LOGGIA.spring), kind: 'void', d: LOGGIA.pierD });
  K.wall(B, f.F, K.rectPts(0, FOOT, f.L, FRIEZE.y0), ops, 'brick');
  B.push(f.F);
  // gauged flat arches of rubbed brick over the ground and first floor windows
  for (const o of f.ops) for (const fl of o.fl) if (fl !== 's') B.box('brickWarm', o.s, HEAD[fl] + WIN.arch / 2, 0.012, o.w + 0.2, WIN.arch, 0.024, 0, { bottom: true });
  for (const d of f.doors) if (!d.doorcase) B.box('brickWarm', d.s, FFL + d.h + WIN.arch / 2, 0.012, d.w + 0.2, WIN.arch, 0.024, 0, { bottom: true });
  // a stone step at the yard doors (the west door has its own platform)
  for (const d of f.doors) if (!d.doorcase && f.name !== 'wwW') B.box('pavingSolid', d.s, (FOOT + 0.6 + FFL) / 2, 0.2, d.w + 0.3, FFL - FOOT - 0.6, 0.4);
  // the loggia's rubbed-brick arch rings
  if (f.name === 'recE') for (const [y0, y1] of loggiaArches()) {
    const c = f.sOf((y0 + y1) / 2), r0 = LOGGIA.open / 2, r1 = r0 + 0.24, N = 12;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI, a1 = ((k + 1) / N) * Math.PI, P0 = (a, r) => [c + Math.cos(a) * r, LOGGIA.spring + Math.sin(a) * r, 0.012];
      B.poly('brickWarm', [P0(a0, r0), P0(a0, r1), P0(a1, r1), P0(a1, r0)], [0, 0, 1]);
    }
  }
  // the plinth, the plat band, the eaves band: stopped at the doors and the loggia's arches
  const e0 = f.salQ ? 0.04 : 0, e1 = f.salP ? 0.04 : 0, gaps = [];
  for (const d of f.doors) gaps.push([d.s - d.w / 2 - (d.doorcase ? DOORCASE.pil + 0.05 : 0.02), d.s + d.w / 2 + (d.doorcase ? DOORCASE.pil + 0.05 : 0.02)]);
  if (f.name === 'recE') for (const [y0, y1] of loggiaArches()) gaps.push([f.sOf(y1), f.sOf(y0)].sort((a, b) => a - b));
  const runs = (a, b, gs) => { const R = []; let s = a; for (const g of gs.slice().sort((x, y) => x[0] - y[0])) { if (g[0] > s) R.push([s, Math.min(g[0], b)]); s = Math.max(s, g[1]); } if (s < b) R.push([s, b]); return R; };
  for (const [a, b] of runs(-e0, f.L + e1, gaps)) if (b - a > 0.02) B.box('brickDark', (a + b) / 2, (FOOT + PLINTH) / 2, 0.02, b - a, PLINTH - FOOT, 0.04);
  const bandGaps = f.doors.filter((d) => d.doorcase).map((d) => [d.s - DOORCASE.w / 2 - 0.05, d.s + DOORCASE.w / 2 + 0.05]);
  for (const [a, b] of runs(-e0 + 0.01, f.L + e1 - 0.01, bandGaps)) if (b - a > 0.02) B.box('brickDark', (a + b) / 2, (BAND.y0 + BAND.y1) / 2, BAND.proj / 2, b - a, BAND.y1 - BAND.y0, BAND.proj, 0, { bottom: true });
  B.poly('stucco', [[-e0 * 0.4, FRIEZE.y0, 0.015], [f.L + e1 * 0.4, FRIEZE.y0, 0.015], [f.L + e1 * 0.4, FRIEZE.y1, 0.015], [-e0 * 0.4, FRIEZE.y1, 0.015]], [0, 0, 1]);
  B.pop();
}

/** the white timber cornice along a face: bed mould, soffit, fascia, the gutter; it runs on past salient corners */
function buildCornice(B, f) {
  if (f.L < 0.7) return;
  const pr = f.name === 'recE' ? CORNICE.proj + (P.EW.x1 - P.EREC.x) : CORNICE.proj, a = f.salQ ? -CORNICE.proj : 0, b = f.L + (f.salP ? CORNICE.proj : 0), y0 = FRIEZE.y1, y1 = EAVES + 0.02;
  B.push(f.F);
  B.box('whitePaint', (a + b) / 2, y0 - 0.05, 0.05, b - a, 0.1, 0.1, 0, { bottom: true });
  B.poly('whitePaint', [[a, y0, 0], [b, y0, 0], [b, y0, pr], [a, y0, pr]], [0, -1, 0]);
  B.poly('whitePaint', [[a, y0, pr], [b, y0, pr], [b, y1, pr], [a, y1, pr]], [0, 0, 1]);
  B.box('leadDark', (a + b) / 2, EAVES - 0.01, pr + CORNICE.gutter / 2, b - a, CORNICE.gutter, CORNICE.gutter, 0, { bottom: true });
  B.pop();
}

/** rusticated quoin strips at every salient corner: alternate bands stand proud, long and short, kept clear of openings */
function buildQuoins(B, F) {
  const n = OUTLINE.length;
  for (let i = 0; i < n; i++) {
    const inc = F[(i - 1 + n) % n], og = F[i];
    if (!inc.salQ) continue;                                       // inc's q end is vertex i
    const C = OUTLINE[i][0];
    const clear = (f, atQ) => { let c = QUOIN.long; for (const o of [...f.ops, ...f.doors]) { const e = atQ ? o.s - o.w / 2 : f.L - (o.s + o.w / 2); c = Math.min(c, e - 0.06); } return Math.max(0.2, c); };
    const la = clear(inc, true), lb = clear(og, false);
    // the interior's quadrant at C: back along the incoming edge plus along the outgoing one
    const pin = inc.p, pout = og.q, ix = Math.sign(pin[0] - C[0] + pout[0] - C[0]), iy = Math.sign(pin[1] - C[1] + pout[1] - C[1]);
    const lx = inc.horiz ? la : lb, ly = inc.horiz ? lb : la;
    let k = 0;
    for (let y = PLINTH + 0.12; y + QUOIN.h < FRIEZE.y0 - 0.04; y += QUOIN.pitch, k++) {
      const f = k % 2 ? QUOIN.short / QUOIN.long : 1, X = [C[0] - ix * QUOIN.proj, C[0] + ix * lx * f], Z = [C[1] - iy * QUOIN.proj, C[1] + iy * ly * f];
      B.boxXZ('brickWarm', X[0], X[1], y, y + QUOIN.h, Z[0], Z[1], { bottom: true });
    }
  }
}

// ------------------------------------------------------------------------------------------------ the doorcase and the steps
function buildDoorcase(ctx, K, B, F, PF) {
  const f = F.find((x) => x.name === 'cbN'), d = f.doors[0], D = DOORCASE, c = d.s, hw = d.w / 2, st = 'bathDress';
  B.push(f.F);
  // the leaves, the transom, the overlight
  B.unit('doorOak', K.rectPts(c - hw, FFL, c, D.over[0] - 0.07), -0.23, K.nextBay(0));
  B.unit('doorOak', K.rectPts(c, FFL, c + hw, D.over[0] - 0.07), -0.23, K.nextBay(0));
  B.box(st, c, D.over[0] - 0.035, -0.12, d.w, 0.07, 0.22);
  B.unit('sash', K.rectPts(c - hw, D.over[0], c + hw, D.over[1]), -0.22, K.nextBay(0));
  // architrave pilasters, consoles, frieze and cornice, the pediment
  for (const sg of [-1, 1]) {
    B.box(st, c + sg * (hw + D.pil / 2), (FFL + D.lintel) / 2, D.proj / 2, D.pil, D.lintel - FFL, D.proj, 0, { bottom: true });
    B.box(st, c + sg * (hw + D.pil + 0.1), D.lintel - D.console / 2 + 0.05, 0.14, 0.18, D.console, 0.28, 0, { bottom: true });
  }
  B.box(st, c, (D.lintel + D.cornice) / 2, D.proj / 2 + 0.03, d.w + 2 * D.pil + 0.2, D.cornice - D.lintel, D.proj + 0.06, 0, { bottom: true });
  B.box(st, c, D.cornice + 0.04, 0.15, D.w, 0.08, 0.3, 0, { bottom: true });
  const hwP = D.w / 2, y0 = D.cornice + 0.08, za = 0.0, zb = 0.28;
  B.poly(st, [[c - hwP, y0, zb], [c + hwP, y0, zb], [c, D.apex, zb]], [0, 0, 1]);
  B.poly(st, [[c - hwP, y0, za], [c - hwP, y0, zb], [c, D.apex, zb], [c, D.apex, za]], [-0.5, 1, 0]);
  B.poly(st, [[c + hwP, y0, zb], [c + hwP, y0, za], [c, D.apex, za], [c, D.apex, zb]], [0.5, 1, 0]);
  B.pop();
  // the porch: a landing at the floor, steps down to the path between low brick cheeks, black handrails
  const { S } = ctx, Pp = PORCH, xi0 = Pp.x0 + Pp.cheek, xi1 = Pp.x1 - Pp.cheek, yL = P.CB.y0 - Pp.landing;
  const g = S.groundY(...PF.L((Pp.x0 + Pp.x1) / 2, Pp.y0 - 0.3)), n = Pp.n - 1, rise = (FFL - g) / Pp.n, going = (yL - Pp.y0) / Pp.n;
  B.boxXZ('brickDark', xi0, xi1, FOOT + 0.5, FFL, yL, P.CB.y0, {});
  K.steps(B, 'brickDark', xi0, xi1, yL, -1, n, rise, going, FFL, g - 0.3);
  for (const [a, b] of [[Pp.x0, xi0], [xi1, Pp.x1]]) {
    B.boxXZ('brick', a, b, FOOT + 0.5, FFL + 0.15, Pp.y0, P.CB.y0, {});
    B.boxXZ('bathDress', a - 0.03, b + 0.03, FFL + 0.15, FFL + 0.22, Pp.y0 - 0.03, P.CB.y0, { bottom: true });
    const xr = a < c ? xi0 + 0.06 : xi1 - 0.06;
    for (const y of [Pp.y0 + 0.15, yL]) B.cyl('ironBlack', xr, y === yL ? FFL : g, y, 0.022, 0.95, 6, true);
    B.beam('ironBlack', [xr, g + 0.95, Pp.y0 + 0.15], [xr, FFL + 0.95, yL], 0.04);
  }
  ctx.floor(PF.ring([[xi0, yL], [xi1, yL], [xi1, P.CB.y0], [xi0, P.CB.y0]]), FFL);
  ctx.floor(PF.ring([[xi0, yL - n * going], [xi1, yL - n * going], [xi1, yL], [xi0, yL]]), (u, v) => { const y = PF.P(u, v)[1], k = Math.min(n - 1, Math.max(0, Math.floor((yL - y) / going))); return FFL - rise * (k + 1); });
  ctx.solid(PF.ring([[Pp.x0, Pp.y0], [xi0, Pp.y0], [xi0, P.CB.y0], [Pp.x0, P.CB.y0]]));
  ctx.solid(PF.ring([[xi1, Pp.y0], [Pp.x1, Pp.y0], [Pp.x1, P.CB.y0], [xi1, P.CB.y0]]));
}

function buildWestStep(ctx, K, B, F, PF) {
  const W = P.WSTEP, g = ctx.S.groundY(...PF.L(W.x0 - 0.3, (W.y0 + W.y1) / 2)), mid = (FFL + g) / 2;
  B.boxXZ('pavingSolid', W.x0, 0, FOOT + 0.5, mid, W.y0, W.y1, {});
  B.boxXZ('pavingSolid', W.x0 * 0.5, 0, mid, FFL, W.y0 + 0.4, W.y1 - 0.4, {});
  ctx.floor(PF.ring([[W.x0, W.y0], [0, W.y0], [0, W.y1], [W.x0, W.y1]]), mid);
  ctx.floor(PF.ring([[W.x0 * 0.5, W.y0 + 0.4], [0, W.y0 + 0.4], [0, W.y1 - 0.4], [W.x0 * 0.5, W.y1 - 0.4]]), FFL);
  // the wall light over the door (Daniels 2016)
  const f = F.find((x) => x.name === 'wwW'), d = f.doors[0];
  B.push(f.F); const lp = K.lantern(B, d.s + 0.85, FFL + 2.45, 0.22, { size: 0.24 }); B.box('ironBlack', d.s + 0.85, FFL + 2.5, 0.1, 0.04, 0.04, 0.2); B.pop();
  // (the light's point: from the face frame to the plan frame, then LOCAL)
  const s = d.s + 0.85, px = f.q[0] + (f.p[0] - f.q[0]) * (s / f.L) + f.out[0] * 0.22, py = f.q[1] + (f.p[1] - f.q[1]) * (s / f.L) + f.out[1] * 0.22;
  const L = PF.L(px, py); ctx.lamp(L[0], lp[1], L[1]);
}

// ------------------------------------------------------------------------------------------------ the loggia
function buildLoggia(ctx, K, B, PF) {
  const L = LOGGIA, xb = L.back, xf = P.EREC.x - L.pierD, ya = L.y0, yb = L.y1;
  B.poly('brickDark', [[xb, FFL, ya], [xb, FFL, yb], [xb, L.ceil, yb], [xb, L.ceil, ya]], [1, 0, 0]);
  B.poly('brickDark', [[xb, FFL, ya], [xf, FFL, ya], [xf, L.ceil, ya], [xb, L.ceil, ya]], [0, 0, 1]);
  B.poly('brickDark', [[xb, FFL, yb], [xf, FFL, yb], [xf, L.ceil, yb], [xb, L.ceil, yb]], [0, 0, -1]);
  B.flat('leadDark', [[xb, ya], [xf, ya], [xf, yb], [xb, yb]], L.ceil, [], true);
  B.flat('pavingSolid', [[xb, ya], [P.EREC.x, ya], [P.EREC.x, yb], [xb, yb]], FFL);
  // the house door at the back, a bench
  B.push(K.frame(xb + 0.01, 0, 10.45, 0, -1)); B.unit('doorOak', K.rectPts(0, FFL, 1.0, FFL + 2.15), 0, K.nextBay(0)); B.pop();
  K.bench(B, xb + 0.45, 8.0, FFL, Math.PI / 2, 1.6);
  ctx.floor(PF.ring([[xb, ya], [P.EREC.x + 0.05, ya], [P.EREC.x + 0.05, yb], [xb, yb]]), FFL);
}

// ------------------------------------------------------------------------------------------------ the roof
function hipDormer(ctx, K, B, x, y, nrm, w, lights) {
  const D = P.DORMER, hf = roofH(x, y), sill = hf + D.sillAbove, top = sill + D.h;
  let db = 0.3; while (db < 4 && roofH(x - nrm[0] * db, y - nrm[1] * db) < top + 0.05) db += 0.1;
  B.push(K.frame(x, 0, y, nrm[1], -nrm[0]));
  K.wall(B, K.frame(-w / 2, 0, 0, 1, 0), K.rectPts(0, hf - 0.15, w, top), [{ pts: K.rectPts(0.14, sill, w - 0.14, top - 0.12), kind: 'win', glass: 'sash', lights: lights || 1, d: 0.08, sill: false, mullionKey: 'whitePaint', mullionW: 0.05, revealKey: 'whitePaint' }], 'clayTile');
  B.box('whitePaint', 0, top - 0.06, 0.03, w, 0.12, 0.06, 0, { bottom: true });
  B.poly('clayTile', [[-w / 2, hf - 0.15, -db], [-w / 2, hf - 0.15, 0], [-w / 2, top, 0], [-w / 2, top, -db]], [-1, 0, 0]);
  B.poly('clayTile', [[w / 2, hf - 0.15, 0], [w / 2, hf - 0.15, -db], [w / 2, top, -db], [w / 2, top, 0]], [1, 0, 0]);
  K.roof(B, 'clayTile', -w / 2 - 0.08, w / 2 + 0.08, -db - 0.25, 0.1, top, D.rise, { axis: 'z', ends: ['open', 'hip'], ov: 0.05, hipRun: w / 2 + 0.08 });
  B.pop();
}

function buildRoof(ctx, K, B) {
  for (const r of ROOFS) K.roof(B, 'clayTile', r.x0, r.x1, r.y0, r.y1, EAVES, r.ridge - EAVES, { axis: r.axis, ends: r.ends, ov: P.TILE_OV, hipRun: r.hipRun });
  // stacks
  for (const s of P.STACKS) {
    const a = (s.along === 'x' ? P.STACK.a : P.STACK.b) / 2, b = (s.along === 'x' ? P.STACK.b : P.STACK.a) / 2;
    K.chimney(B, 'brick', s.x - a, s.x + a, s.y - b, s.y + b, EAVES + 1.0, s.top, { pots: P.STACK.pots, capKey: 'brickDark', potH: 0.5 });
    B.box('brickDark', s.x, s.top - 0.32, s.y, 2 * a + 0.1, 0.12, 2 * b + 0.1, 0, { bottom: true });          // the corbel course under the cap
  }
  // dormers
  for (const d of P.DORMERS) {
    if (d.face === 'S') hipDormer(ctx, K, B, d.at, P.RANGE.y1 + 0.5 - 1.4, [0, 1], d.w, d.lights);
    else if (d.face === 'W') hipDormer(ctx, K, B, -0.5 + 1.4, d.at, [-1, 0], d.w, d.lights);
    else hipDormer(ctx, K, B, P.EW.x0 - 0.5 + 1.4, d.at, [-1, 0], d.w, d.lights);
  }
  // rooflights on the north slope (lying on it)
  for (const x of P.ROOFLIGHTS) {
    const ya = 5.55, yb = 6.3, Pt = (xx, yy, e) => [xx, roofH(xx, yy) + e, yy];
    B.poly('leadDark', [Pt(x - 0.38, ya - 0.05, 0.03), Pt(x + 0.38, ya - 0.05, 0.03), Pt(x + 0.38, yb + 0.05, 0.03), Pt(x - 0.38, yb + 0.05, 0.03)], [0, 1, -0.9]);
    B.poly('glassDark', [Pt(x - 0.31, ya, 0.06), Pt(x + 0.31, ya, 0.06), Pt(x + 0.31, yb, 0.06), Pt(x - 0.31, yb, 0.06)], [0, 1, -0.9]);
  }
}

/** the small single-storey hipped bay at the east wing's south-west corner (G) */
function buildBay(ctx, K, B) {
  const b = P.SWBAY;
  K.wall(B, K.frame(b.x0, 0, b.y0, 0, 1), K.rectPts(0, FOOT, b.y1 - b.y0, b.eaves), [{ pts: K.rectPts(0.7, SILL.g, b.y1 - b.y0 - 0.7, HEAD.g - 0.2), kind: 'win', glass: 'sash', d: 0.1, sillKey: 'brickDark' }], 'brick');
  K.wall(B, K.frame(b.x1, 0, b.y0, -1, 0), K.rectPts(0, FOOT, b.x1 - b.x0, b.eaves), [], 'brick');
  K.wall(B, K.frame(b.x0, 0, b.y1, 1, 0), K.rectPts(0, FOOT, b.x1 - b.x0, b.eaves), [], 'brick');
  K.roof(B, 'clayTile', b.x0 - 0.25, b.x1 + 0.3, b.y0 - 0.25, b.y1 + 0.25, b.eaves, b.rise, { axis: 'z', ends: ['hip', 'hip'], ov: 0.05 });
}

// ------------------------------------------------------------------------------------------------ the ground at its walls
function buildGround(ctx, PF) {
  const { B, G, S } = ctx, R = (x0, x1, y0, y1) => PF.ring([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), Gd = P.GROUNDS;
  const bedY = P.RANGE.y0 - 2.65, pY = Gd.pathN;
  // the beds against the range and beside the porch
  G.drape(B, 'flowerbed', R(P.WW.x1, P.CB.x0, bedY > pY[1] ? bedY : pY[1], P.RANGE.y0), 0.07);
  G.drape(B, 'flowerbed', R(P.CB.x1, P.EW.x0, pY[1], P.RANGE.y0), 0.07);
  G.drape(B, 'flowerbed', R(P.CB.x0, PORCH.x0, pY[1], P.CB.y0), 0.07);
  G.drape(B, 'flowerbed', R(PORCH.x1, P.CB.x1, pY[1], P.CB.y0), 0.07);
  // the asphalt walk along the north front, its apron at the porch, and on west to the passage by Wolfson
  G.drape(B, 'asphalt', R(P.WW.x1 + 2.0, P.EW.x0, pY[0], pY[1]), 0.08);
  const sinA = Math.sin(P.ANG), cosA = Math.cos(P.ANG), yLink = (x) => (Gd.passV - P.V0 - x * sinA) / cosA;
  // the street wall's inner face (Wolfson's registered WALL_LINE + its thickness) as a plan x at plan y
  const [w0, w1] = Gd.wallLine, xAt = (y) => { let x = (Gd.streetU - P.U0) / cosA; for (let i = 0; i < 4; i++) { const q = PF.L(x, y), u = w0[0] + ((q[1] - w0[1]) * (w1[0] - w0[0])) / (w1[1] - w0[1]) + Gd.wallTh; x += (u - q[0]) / cosA; } return x; };
  const xW = xAt(0), yL = yLink(xAt(yLink(xW)));
  const strip = [[xAt(yL), yL], [P.WW.x1 + 2.0, yLink(P.WW.x1 + 2.0)], [P.WW.x1 + 2.0, pY[1]], [P.WW.x1, pY[1]], [P.WW.x1, 0], [xW, 0]];
  G.drape(B, 'asphalt', PF.ring(strip), 0.08);
  // the walk along the west end and the bed between it and the street wall
  G.drape(B, 'paving', R(-Gd.walkW, 0, 0, P.WW.y1), 0.08, { holes: [R(P.WSTEP.x0, 0, P.WSTEP.y0, P.WSTEP.y1)] });
  G.drape(B, 'flowerbed', PF.ring([[xW, 0], [-Gd.walkW, 0], [-Gd.walkW, P.WW.y1], [xAt(P.WW.y1), P.WW.y1]]), 0.07);
  // the bed along the range's south face west of the stair block
  G.drape(B, 'flowerbed', R(0, P.SP.x0, P.RANGE.y1, P.RANGE.y1 + Gd.bedS), 0.07);
  // the flagged strip along the east faces (the loggia's own floor is the building's)
  G.drape(B, 'paving', PF.ring([[P.EW.x1, 0], [P.EW.x1 + Gd.flagsE, 0], [P.EW.x1 + Gd.flagsE, P.EW.y1], [P.EW.x1, P.EW.y1], [P.EW.x1, P.EREC.y1], [P.EREC.x, P.EREC.y1], [P.EREC.x, P.EREC.y0], [P.EW.x1, P.EREC.y0]]), 0.08);
  void S;
}

// ------------------------------------------------------------------------------------------------ registration
function registerSolids(ctx, PF) {
  const ring = [];
  for (const [p, name] of OUTLINE) {
    ring.push(p);
    if (name === 'recE') { const L = LOGGIA; ring.push([P.EREC.x, L.y0], [L.back, L.y0], [L.back, L.y1], [P.EREC.x, L.y1]); }
  }
  // (OUTLINE's recE starts at (EREC.x, y0) and runs south: the loggia's notch is inserted in that order)
  ctx.solid(PF.ring(ring));
  const arches = loggiaArches(), xf = P.EREC.x - LOGGIA.pierD;
  for (let k = 0; k < arches.length - 1; k++) ctx.solid(PF.ring([[xf, arches[k][1]], [P.EREC.x, arches[k][1]], [P.EREC.x, arches[k + 1][0]], [xf, arches[k + 1][0]]]));
  const b = P.SWBAY; ctx.solid(PF.ring([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]));
}

export function buildPenrose(ctx) {
  const { B, K, S } = ctx;
  const PF = S.ownFrame(P.U0, P.V0, P.U0 + Math.cos(P.ANG) * 40, P.V0 + Math.sin(P.ANG) * 40);
  const F = faces(K);
  B.push(PF.M);
  for (const f of F) buildFace(K, B, f);
  for (const f of F) buildCornice(B, f);
  buildQuoins(B, F);
  buildDoorcase(ctx, K, B, F, PF);
  buildWestStep(ctx, K, B, F, PF);
  buildLoggia(ctx, K, B, PF);
  buildRoof(ctx, K, B);
  buildBay(ctx, K, B);
  B.pop();
  buildGround(ctx, PF);
  registerSolids(ctx, PF);
  return { faces: F.length, ang: P.ANG };
}
