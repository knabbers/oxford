// Somerville College, STANDALONE model, part 'hughes' (B12): the build functions. Called by somerville_hughes.js with
// ctx.B already in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from
// _somerville_hughes_plan.js (sources and K / G there). Inside the CHB's own frame F the Batch's x = s (east along the
// west block's north face), z = t (south). Ground (G.drape) is laid with no own frame pushed (it takes LOCAL rings).
// Helpers written here (not in the kit): brickFace (a brick face of spans with corbelled window bays cut into it),
// drawBay (one bay), parapetIn (a roof membrane with the parapet's inner faces), slabBench (the courts' slatted benches),
// railRun (a line of iron bars), offsetPt / lerp2 (plan arithmetic).
import * as P from './_somerville_hughes_plan.js';

const { BAY, FL, FFL, FOOT, STOREY, ROOF_W, ROOF_H, MEMBRANE, PLINTH, SHOULDER: SH, SLANT } = P;
const ST = BAY.step, NS = BAY.steps;

// ------------------------------------------------------------------------------------------------ small helpers
const lerp2 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const norm2 = (d) => { const l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
/** the street face's s at t, set back d (metres, square to the face) */
const sAt = (t, d = 0) => SLANT * t + d * Math.hypot(1, SLANT);
/** the window head of storey f */
const winTop = (f) => (f < 4 ? FL[f + 1] : FL[4] + STOREY) - BAY.spandrel;

// ------------------------------------------------------------------------------------------------ the window bays
/** the figures of one bay placed at x along its face */
function bayDims(b, x) {
  const gw = b.street ? BAY.street : b.n === 2 ? BAY.light2 : BAY.light1, wo = gw + 2 * NS * ST;
  const yb = FL[b.floors[0]], gt = winTop(b.floors[1]), yt = gt + NS * ST;
  return { ...b, x, gw, wo, x0: x - wo / 2, x1: x + wo / 2, g0: x - gw / 2, g1: x + gw / 2, yb, gt, yt };
}
/** one bay in the CURRENT wall frame (x along, y up, z out of the face): the corbelled jambs and head stepping in to the
 *  deep-set glass, per storey a bronze frame sheet with the lights, a low transom, a sloping hood at the floor above,
 *  the vertical fin between two lights */
function drawBay(K, B, d) {
  const zg = -BAY.glassD;
  for (let k = 0; k < NS; k++) {
    const a0 = d.x0 + k * ST, a1 = d.x1 - k * ST, top = d.yt - k * ST, b0 = a0 + ST, b1 = a1 - ST, top2 = top - ST;
    B.reveal('brickNew', K.rectPts(a0, d.yb, a1, top), -k * ST, -(k + 1) * ST, true);
    B.face('brickNew', [[a0, d.yb], [b0, d.yb], [b0, top2], [b1, top2], [b1, d.yb], [a1, d.yb], [a1, top], [a0, top]], [], -(k + 1) * ST);
  }
  B.reveal('brickNew', K.rectPts(d.g0, d.yb, d.g1, d.gt), -NS * ST, zg, true);
  B.poly('chbStone', [[d.x0, d.yb, 0], [d.x1, d.yb, 0], [d.x1, d.yb, zg], [d.x0, d.yb, zg]], [0, 1, 0]);
  const n = d.n, lw = (d.g1 - d.g0) / n, fr = BAY.frame;
  for (let f = d.floors[0]; f <= d.floors[1]; f++) {
    const fy0 = f === d.floors[0] ? d.yb : FL[f], fy1 = f === d.floors[1] ? d.gt : FL[f + 1];
    const lights = [];
    for (let i = 0; i < n; i++) {
      const door = f === 0 && (d.door === 'all' || (d.door === 'left' && i === 0));
      const wy0 = FL[f] + (door ? 0.02 : BAY.sill), wy1 = Math.min(f === 0 && door ? Math.min(winTop(0), FL[0] + P.DOOR_H) : winTop(f), fy1 - 0.06);
      lights.push({ r: K.rectPts(d.g0 + i * lw + fr, wy0, d.g0 + (i + 1) * lw - fr, wy1), door, wy0 });
    }
    B.face('bronze', K.rectPts(d.g0, fy0, d.g1, fy1), lights.map((l) => l.r), zg + 0.015);
    for (const l of lights) {
      B.unit('glassDark', l.r, zg, K.nextBay(l.wy0));
      const lx0 = l.r[0][0], lx1 = l.r[1][0];
      if (!l.door) B.box('bronze', (lx0 + lx1) / 2, l.wy0 + 0.42, zg + 0.03, lx1 - lx0, BAY.bar, 0.04, 0, { bottom: true });
      else B.box('bronze', (lx0 + lx1) / 2, l.wy0 + 0.16, zg + 0.03, lx1 - lx0, 0.3, 0.04, 0, {});      // the door's kick panel
    }
    if (f < d.floors[1]) {      // the hood at the floor above: sloping from the glass out to the face
      const yh = FL[f + 1], hd = BAY.hood, lip = BAY.hoodLip;
      B.poly('bronze', [[d.g0, yh, zg], [d.g1, yh, zg], [d.g1, yh - hd, 0.03], [d.g0, yh - hd, 0.03]], [0, 1, 0.6]);
      B.poly('bronze', [[d.g0, yh - hd - lip, 0.03], [d.g1, yh - hd - lip, 0.03], [d.g1, yh - hd, 0.03], [d.g0, yh - hd, 0.03]], [0, 0, 1]);
      B.poly('bronze', [[d.g0, yh - hd - lip, 0.03], [d.g1, yh - hd - lip, 0.03], [d.g1, yh - lip - 0.02, zg], [d.g0, yh - lip - 0.02, zg]], [0, -1, 0.4]);
    }
  }
  if (n === 2) B.box('bronze', (d.g0 + d.g1) / 2, (d.yb + d.gt) / 2, zg / 2 - 0.01, BAY.fin, d.gt - d.yb, -zg - 0.06, 0, { bottom: true });
}

/**
 * A brick face from plan point A to Bp (F frame) whose outward side is the LEFT of A -> Bp seen from above (the kit's
 * frame convention): spans [[x0, x1, top], ...] cover x 0 .. L in order; bays (bayDims) are cut into it; precast bands
 * at the floors, a thin coping on every span's top, the stone plinth following the ground (unless o.bottom is given:
 * a face that starts on a lower roof).
 */
function brickFace(ctx, F, A, Bp, spans, bays, o = {}) {
  const { B, K } = ctx;
  const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), dir = [(Bp[0] - A[0]) / L, (Bp[1] - A[1]) / L], yBot = o.bottom ?? FOOT;
  const gAt = (x) => F.groundY(A[0] + dir[0] * x, A[1] + dir[1] * x);
  B.push(K.frame(A[0], 0, A[1], dir[0], dir[1]));
  const out = [[0, yBot], [L, yBot]];
  for (let i = spans.length - 1; i >= 0; i--) { out.push([spans[i][1], spans[i][2]]); out.push([spans[i][0], spans[i][2]]); }
  const R = out.filter((p, i) => { const q = out[(i + out.length - 1) % out.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
  B.face('brickNew', R, bays.map((d) => K.rectPts(d.x0, d.yb, d.x1, d.yt)));
  for (const d of bays) drawBay(K, B, d);
  const topAt = (x) => { for (const s of spans) if (x >= s[0] - 1e-6 && x <= s[1] + 1e-6) return s[2]; return yBot; };
  // the precast bands at the floors, broken by the bays that run through them
  for (const y of FL.slice(1)) {
    if (y < yBot + 0.3) continue;
    const cuts = bays.filter((d) => d.yb < y - 0.01 && d.yt > y).map((d) => [d.x0, d.x1]).sort((a, b) => a[0] - b[0]);
    let x = 0; const segs = [];
    for (const c of cuts) { if (c[0] > x) segs.push([x, c[0]]); x = Math.max(x, c[1]); }
    if (x < L) segs.push([x, L]);
    for (const [a, b] of segs) {
      // (only under the span tops)
      const parts = []; let p0 = a;
      for (const s of spans) { const lo = Math.max(a, s[0]), hi = Math.min(b, s[1]); if (hi - lo > 0.05 && s[2] > y + 0.3) parts.push([lo, hi]); }
      void p0;
      for (const [lo, hi] of parts) B.box('precast', (lo + hi) / 2, y - P.BANDS.h / 2, P.BANDS.proj / 2, hi - lo, P.BANDS.h, P.BANDS.proj, 0, { bottom: true });
    }
  }
  // the copings
  for (const s of spans) B.box('precast', (s[0] + s[1]) / 2, s[2] + 0.025, -0.15, s[1] - s[0] + 0.02, 0.05, 0.36, 0, { bottom: true });
  // the plinth, following the ground
  if (o.bottom === undefined) {
    const n = Math.max(1, Math.ceil(L / 2));
    for (let i = 0; i < n; i++) {
      const xa = (L * i) / n, xb = (L * (i + 1)) / n, ga = gAt(xa), gb = gAt(xb);
      const ta = Math.max(ga + 0.08, Math.min(ga + PLINTH, FFL - 0.02)), tb = Math.max(gb + 0.08, Math.min(gb + PLINTH, FFL - 0.02));
      B.poly('chbStone', [[xa, yBot, 0.015], [xb, yBot, 0.015], [xb, tb, 0.015], [xa, ta, 0.015]], [0, 0, 1]);
      B.poly('chbStone', [[xa, ta, 0.015], [xb, tb, 0.015], [xb, tb, 0], [xa, ta, 0]], [0, 1, 0]);
    }
  }
  B.pop();
  void topAt;
}

/** a flat roof membrane over a plan ring (current frame) at y, with the parapet's inner faces (0.32 in from the listed
 *  edges, from y up to top) */
function parapetIn(B, ring, y, top, edges, key = 'leadDark', wallKey = 'brickNew') {
  B.flat(key, ring, y);
  let ar = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; ar += p[0] * q[1] - q[0] * p[1]; }
  const sg = ar > 0 ? 1 : -1;      // (x east, z south: a positive shoelace is clockwise from above; the inside is then to the right)
  for (const i of edges) {
    const p = ring[i], q = ring[(i + 1) % ring.length], d = norm2([q[0] - p[0], q[1] - p[1]]), n = [-d[1] * sg, d[0] * sg];      // inward
    const a = [p[0] + n[0] * 0.32, p[1] + n[1] * 0.32], b = [q[0] + n[0] * 0.32, q[1] + n[1] * 0.32];
    B.poly(wallKey, [[a[0], y, a[1]], [b[0], y, b[1]], [b[0], top, b[1]], [a[0], top, a[1]]], [n[0], 0, n[1]]);
    B.poly('precast', [[p[0], top, p[1]], [q[0], top, q[1]], [b[0], top, b[1]], [a[0], top, a[1]]], [0, 1, 0]);
  }
}

/** a slatted timber bench (no back) centred at (x, z) on ground y0, its length along the frame's x turned rot degrees */
function slabBench(K, B, x, z, y0, rot, len) {
  const M = new K.THREE.Matrix4().makeRotationY((-rot * Math.PI) / 180).setPosition(x, y0, z);
  B.push(M);
  for (let i = 0; i < 6; i++) B.box('bench', 0, 0.42, -0.25 + 0.035 + i * 0.086, len, 0.07, 0.068, 0, {});
  const legs = Math.max(2, Math.round(len / 1.6) + 1);
  for (let k = 0; k < legs; k++) { const lx = -len / 2 + 0.25 + ((len - 0.5) * k) / (legs - 1); for (let j = 0; j < 3; j++) B.box('bench', lx - 0.09 + j * 0.09, 0.19, 0, 0.06, 0.38, 0.42, 0, {}); }
  B.pop();
}

/** a run of vertical iron bars from plan point a to b (current frame) standing on yb(pt) from h0 to h1 above it, with a
 *  top and bottom rail; bar pitch `pitch` */
function railRun(B, a, b, yb, h0, h1, pitch = 0.13) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / pitch)), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  for (let i = 0; i <= n; i++) { const p = lerp2(a, b, i / n), g = yb(p); B.box('ironBlack', p[0], g + (h0 + h1) / 2, p[1], 0.022, h1 - h0, 0.022, ry, { top: false }); }
  const m = lerp2(a, b, 0.5), g = yb(m);
  for (const y of [h0 + 0.08, h1 - 0.04]) B.box('ironBlack', m[0], g + y, m[1], L, 0.04, 0.035, ry, {});
}

// ------------------------------------------------------------------------------------------------ the CHB
function buildCHB(ctx, F) {
  const { B, K } = ctx;
  const bays = (list, toX) => list.map((b) => bayDims(b, toX(b.c)));
  const BY = P.BAYS, wb = P.WB, hb = P.HB, eb = P.EB;
  const d1 = SH.back, d2 = SH.roofBack, tN = SH.w * Math.cos(Math.atan(-SLANT)), tS = wb.t1 - tN;      // (the shoulders' sides, in t)
  const xd1 = sAt(0, d1), xd2 = sAt(0, d2);      // where the set-backs meet the north / south faces (along them)
  const swS = wb.swS;
  // the west block
  brickFace(ctx, F, [wb.s1, 0], [0, 0], [[0, wb.s1 - xd2, ROOF_W], [wb.s1 - xd2, wb.s1 - xd1, SH.upTop], [wb.s1 - xd1, wb.s1, SH.faceTop]], bays(BY.north, (c) => wb.s1 - c));
  const Ls = Math.hypot(swS, wb.t1);
  brickFace(ctx, F, [0, 0], [swS, wb.t1], [[0, SH.w, SH.faceTop], [SH.w, Ls - SH.w, ROOF_W], [Ls - SH.w, Ls, SH.faceTop]], bays(BY.street, (c) => c));
  brickFace(ctx, F, [swS, wb.t1], [hb.s0, wb.t1], [[0, xd1, SH.faceTop], [xd1, xd2, SH.upTop], [xd2, hb.s0 - swS, ROOF_W]], bays(BY.southW, (c) => c - swS));
  brickFace(ctx, F, [wb.s1, hb.t0], [wb.s1, 0], [[0, hb.t0, ROOF_W]], bays(BY.eastW, (c) => hb.t0 - c));
  // the five storey block and the east end
  const nL = eb.s1 - wb.s1;
  brickFace(ctx, F, [eb.s1, hb.t0], [wb.s1, hb.t0], [[0, eb.s1 - eb.s0, ROOF_W], [eb.s1 - eb.s0, nL, ROOF_H]], bays(BY.north2, (c) => eb.s1 - c));
  brickFace(ctx, F, [wb.s1, hb.t0], [hb.s0, hb.t0], [[0, wb.s1 - hb.s0, ROOF_H]], bays(BY.northTop, (c) => wb.s1 - c), { bottom: ROOF_W - MEMBRANE });
  brickFace(ctx, F, [hb.s0, hb.t0], [hb.s0, wb.t1], [[0, wb.t1 - hb.t0, ROOF_H]], [], { bottom: ROOF_W - MEMBRANE });
  brickFace(ctx, F, [hb.s0, wb.t1], [hb.s0, hb.t1], [[0, hb.t1 - wb.t1, ROOF_H]], bays(BY.westH, (c) => c - wb.t1));
  brickFace(ctx, F, [hb.s0, hb.t1], [hb.notchS, hb.t1], [[0, hb.notchS - hb.s0, ROOF_H]], bays(BY.south, (c) => c - hb.s0));
  brickFace(ctx, F, [hb.notchS, hb.t1], [hb.notchS, hb.notchT], [[0, hb.t1 - hb.notchT, ROOF_H]], []);
  brickFace(ctx, F, [hb.notchS, hb.notchT], [eb.s1, hb.notchT], [[0, hb.s1 - hb.notchS, ROOF_H], [hb.s1 - hb.notchS, eb.s1 - hb.notchS, ROOF_W]], bays(BY.southE, (c) => c - hb.notchS));
  brickFace(ctx, F, [eb.s1, eb.t1], [eb.s1, eb.t0], [[0, eb.t1 - eb.t0, ROOF_W]], bays(BY.east, (c) => eb.t1 - eb.t0 - c));
  brickFace(ctx, F, [hb.s1, eb.t1], [hb.s1, eb.t0], [[0, eb.t1 - eb.t0, ROOF_H]], bays(BY.eastTop, (c) => eb.t1 - eb.t0 - c), { bottom: ROOF_W - MEMBRANE });

  // the street end's shoulders: the ledge at the cut, the set-back face, its top, the step up to the roof, the returns
  for (const [ta, tb, side] of [[0, tN, -1], [tS, wb.t1, 1]]) {
    const tc = side < 0 ? tb : ta;      // the side against the central volume
    const P0 = (t, d) => [sAt(t, d), t];
    B.flat('leadDark', [P0(ta, 0), P0(tb, 0), P0(tb, d1), P0(ta, d1)], SH.faceTop - 0.02);
    B.poly('brickNew', [[sAt(ta, d1), SH.faceTop - 0.02, ta], [sAt(tb, d1), SH.faceTop - 0.02, tb], [sAt(tb, d1), SH.upTop, tb], [sAt(ta, d1), SH.upTop, ta]], [-1, 0, SLANT]);
    B.flat('leadDark', [P0(ta, d1), P0(tb, d1), P0(tb, d2), P0(ta, d2)], SH.upTop - 0.02);
    B.box('precast', sAt((ta + tb) / 2, d1) + 0.15, SH.upTop + 0.025, (ta + tb) / 2, 0.36, 0.05, tb - ta, 0, { bottom: true });
    B.poly('brickNew', [[sAt(ta, d2), SH.upTop - 0.02, ta], [sAt(tb, d2), SH.upTop - 0.02, tb], [sAt(tb, d2), ROOF_W, tb], [sAt(ta, d2), ROOF_W, ta]], [-1, 0, SLANT]);
    // the central volume's returns
    B.poly('brickNew', [[sAt(tc, 0), SH.faceTop - 0.02, tc], [sAt(tc, d1), SH.faceTop - 0.02, tc], [sAt(tc, d1), ROOF_W, tc], [sAt(tc, 0), ROOF_W, tc]], [0, 0, side]);
    B.poly('brickNew', [[sAt(tc, d1), SH.upTop - 0.02, tc], [sAt(tc, d2), SH.upTop - 0.02, tc], [sAt(tc, d2), ROOF_W, tc], [sAt(tc, d1), ROOF_W, tc]], [0, 0, side]);
    B.box('precast', sAt(tc, d2 / 2), ROOF_W + 0.025, tc - side * 0.15, d2, 0.05, 0.34, 0, { bottom: true });
  }

  // the roofs: membranes and parapets' inner faces
  const yW = ROOF_W - MEMBRANE, yH = ROOF_H - MEMBRANE;
  const wRing = [[sAt(tN, 0), tN], [sAt(tS, 0), tS], [sAt(tS, d2), tS], [sAt(wb.t1, d2), wb.t1], [hb.s0, wb.t1], [hb.s0, hb.t0], [wb.s1, hb.t0], [wb.s1, 0], [sAt(0, d2), 0], [sAt(tN, d2), tN]];
  parapetIn(B, wRing, yW, ROOF_W, [0, 1, 2, 3, 6, 7, 8, 9]);
  const hRing = [[hb.s0, hb.t0], [hb.s1, hb.t0], [hb.s1, hb.notchT], [hb.notchS, hb.notchT], [hb.notchS, hb.t1], [hb.s0, hb.t1]];
  parapetIn(B, hRing, yH, ROOF_H, [0, 1, 2, 3, 4, 5]);
  parapetIn(B, [[eb.s0, eb.t0], [eb.s1, eb.t0], [eb.s1, eb.t1], [eb.s0, eb.t1]], yW, ROOF_W, [0, 1, 2]);
  // PV rows (tilted south) and the staircase rooflights
  for (const pv of P.PV) {
    const dt = (pv.t1 - pv.t0) / pv.rows;
    for (let r = 0; r < pv.rows; r++) {
      const t0 = pv.t0 + r * dt + 0.2, t1 = t0 + dt * 0.62, y0 = yH + 0.25, y1 = yH + 0.25 + (t1 - t0) * 0.3;
      B.poly('chbPV', [[pv.s0, y1, t0], [pv.s1, y1, t0], [pv.s1, y0, t1], [pv.s0, y0, t1]], [0, 1, 0.3]);
      B.poly('zinc', [[pv.s0, yH, t0], [pv.s1, yH, t0], [pv.s1, y1, t0], [pv.s0, y1, t0]], [0, 0, -1]);
      for (const s of [pv.s0, pv.s1]) B.poly('zinc', [[s, yH, t0], [s, yH, t1], [s, y0, t1], [s, y1, t0]], [s === pv.s0 ? -1 : 1, 0, 0]);
    }
  }
  for (const r of P.ROOFLIGHTS) {
    const y0 = r.s < wb.s1 ? yH : yH;      // (both on the five storey block)
    B.box('leadDark', r.s, y0 + 0.2, r.t + r.d / 2, r.w, 0.4, r.d, 0, {});
    B.box('glassRoof', r.s, y0 + 0.47, r.t + r.d / 2, r.w - 0.1, 0.14, r.d - 0.1, 0, {});
  }

  // wall lights at the doors
  const lamps = [];
  for (const wl of P.WALL_LAMPS) {
    const t = wl.face === 'north' ? -0.18 : wl.face === 'north2' ? hb.t0 - 0.18 : hb.notchT + 0.18;
    B.box('bronze', wl.s, wl.y, t + (wl.face === 'southE' ? -0.08 : 0.08), 0.12, 0.3, 0.16, 0, { bottom: true });
    B.box('lampGlass', wl.s, wl.y - 0.02, t, 0.2, 0.12, 0.2, 0, { bottom: true });
    lamps.push([wl.s, wl.y, t]);
  }
  return lamps;
}

// ------------------------------------------------------------------------------------------------ Bedford House
function buildBedford(ctx, F) {
  const { B, K } = ctx, b = P.BED, W = b.t1 - b.t0, yF = P.BED_FL, yE = P.BED_EAVES, yR = P.BED_RIDGE, foot = -1.7;
  const FB = K.frame(b.s0, 0, b.t0, 0, 1);      // the gable, facing Walton Street (x runs south from its north end)
  const w = P.BED_WIN, dr = P.BED_DOOR, oc = P.BED_OCULUS;
  const circ = (cx, cy, r, n = 16) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)]);
  const ops = w.at.map((x) => ({ pts: K.archPts(x, w.w, w.sill, w.spring), kind: 'win', glass: 'archSash', spring: w.spring, d: 0.24 }));
  ops.push({ pts: K.archPts(dr.at, dr.w, yF, dr.spring), kind: 'door', doorKey: 'doorDark', d: 0.3 });
  ops.push({ pts: circ(W / 2, oc.y, oc.r), kind: 'win', glass: 'leaded', sill: false, d: 0.18 });
  K.wall(B, FB, [[0, foot], [W, foot], [W, yE], [W / 2, yR], [0, yE]], ops, 'brickBuff');
  B.push(FB);
  // red brick: the base, the band at the springing, the arch heads, the oculus ring, the verges
  B.face('brick', K.rectPts(0, foot, dr.at - dr.w / 2, yF + P.BED_PLINTH), [], 0.012);
  B.face('brick', K.rectPts(dr.at + dr.w / 2, foot, W, yF + P.BED_PLINTH), [], 0.012);
  const cuts = [...w.at.map((x) => [x - w.w / 2 - 0.02, x + w.w / 2 + 0.02])];
  let x0 = 0; for (const [a, c] of cuts) { if (a > x0) K.stringCourse(B, 'brick', x0, a, P.BED_BAND.y + P.BED_BAND.h, P.BED_BAND.h, 0.015); x0 = c; }
  K.stringCourse(B, 'brick', x0, W, P.BED_BAND.y + P.BED_BAND.h, P.BED_BAND.h, 0.015);
  const archRing = (x, wd, ys, band) => { const r = wd / 2, R = r + band, n = 10, pts = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pts.push([x + R * Math.cos(a), ys + R * Math.sin(a)]); } for (let i = n; i >= 0; i--) { const a = (i / n) * Math.PI; pts.push([x + r * Math.cos(a), ys + r * Math.sin(a)]); } return pts; };
  for (const x of w.at) B.face('brick', archRing(x, w.w, w.spring, 0.13), [], 0.014);
  B.face('brick', archRing(dr.at, dr.w, dr.spring, 0.14), [], 0.014);
  B.face('brick', circ(W / 2, oc.y, oc.r + oc.ring, 20), [circ(W / 2, oc.y, oc.r, 16)], 0.014);
  // the verges: red band under a stone coping, kneelers, the apex
  const rake = (xa, ya, xb, yb) => {
    B.poly('brick', [[xa, ya - 0.24, 0.012], [xb, yb - 0.24, 0.012], [xb, yb, 0.012], [xa, ya, 0.012]], [0, 0, 1]);
    B.poly('bathDress', [[xa, ya, 0.06], [xb, yb, 0.06], [xb, yb + 0.14, 0.06], [xa, ya + 0.14, 0.06]], [0, 0, 1]);
    B.poly('bathDress', [[xa, ya + 0.14, 0.06], [xb, yb + 0.14, 0.06], [xb, yb + 0.14, -0.42], [xa, ya + 0.14, -0.42]], [0, 1, 0]);
  };
  rake(0, yE, W / 2, yR); rake(W, yE, W / 2, yR);
  B.box('bathDress', 0.18, yE + 0.02, -0.15, 0.4, 0.28, 0.46, 0, {}); B.box('bathDress', W - 0.18, yE + 0.02, -0.15, 0.4, 0.28, 0.46, 0, {});
  B.box('bathDress', W / 2, yR + 0.12, -0.15, 0.34, 0.3, 0.46, 0, {});
  // the tablet, the globe lamp
  const tb = P.BED_TABLET;
  B.box('bathDress', (tb.x0 + tb.x1) / 2, (tb.y0 + tb.y1) / 2, 0.03, tb.x1 - tb.x0, tb.y1 - tb.y0, 0.06, 0, {});
  B.box('ironBlack', 4.95, 1.62, 0.06, 0.06, 0.06, 0.12, 0, {});
  B.cyl('lampGlass', 4.95, 1.46, 0.2, 0.15, 0.3, 8, true, 0.15);
  B.pop();
  // the south side wall (to the Co-op's yard wall), its eaves
  K.wall(B, K.frame(b.s0, 0, b.t1, 1, 0), K.rectPts(0, foot, b.s1 - b.s0, yE), [], 'brickBuff');
  B.box('whitePaint', (b.s0 + b.s1) / 2 + 0.1, yE - 0.08, b.t1 + 0.1, b.s1 - b.s0 - 0.2, 0.16, 0.12, 0, { bottom: true });
  // the roof: slate, set behind the coped gable
  K.roof(B, 'slate', b.s0 + 0.2, b.s1, b.t0, b.t1, yE, yR - yE, { axis: 'x', ends: ['gable', 'open'], ov: 0.15, gableWalls: false });
  // the step at the door
  const g = F.groundY(b.s0 - 0.5, b.t0 + dr.at);
  B.box('pavingSolid', b.s0 - 0.35, (g - 0.2 + yF) / 2, b.t0 + dr.at, 0.7, yF - g + 0.2, dr.w + 0.5, 0, {});
  return [[b.s0 - 0.2, 1.46 + 0.15, b.t0 + 4.95]];
}

// ------------------------------------------------------------------------------------------------ the forecourt
function buildForecourt(ctx, F) {
  const { B } = ctx, f = P.FORE, a = [P.WB.swS, P.WB.t1], b = [P.WB.swS + (f.t1 - P.WB.t1) * -0.092, f.t1];
  const d = norm2([b[0] - a[0], b[1] - a[1]]), n = [d[1], -d[0]];      // inward (east)
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), at = (t) => (t - a[1]) / (b[1] - a[1]);
  const pieces = [[0, at(f.gate[0])], [at(f.gate[1]), 1]];
  const yb = (p) => F.groundY(p[0] + n[0] * 0.15, p[1] + n[1] * 0.15);
  for (const [fa, fb] of pieces) {
    const p = lerp2(a, b, fa), q = lerp2(a, b, fb), m = lerp2(p, q, 0.5), c = [m[0] + n[0] * 0.15, m[1] + n[1] * 0.15], len = L * (fb - fa), ry = Math.atan2(-d[1], d[0]), g = yb(m);
    B.box('brickBuff', c[0], (g - 0.5 + g + f.wallH) / 2, c[1], len, f.wallH + 0.5, 0.3, ry, {});
    B.box('brick', c[0], g + f.wallH + 0.05, c[1], len + 0.02, 0.1, 0.34, ry, { bottom: true });
    railRun(B, [p[0] + n[0] * 0.15, p[1] + n[1] * 0.15], [q[0] + n[0] * 0.15, q[1] + n[1] * 0.15], yb, f.wallH + 0.1, f.railH);
  }
  // the gate, open: hinged at its north post, swung in
  const h = lerp2(a, b, at(f.gate[0])), hp = [h[0] + n[0] * 0.15, h[1] + n[1] * 0.15], gw = (f.gate[1] - f.gate[0]) * 0.95;
  B.box('ironBlack', hp[0], yb(hp) + f.railH / 2, hp[1], 0.08, f.railH + 0.1, 0.08, 0, {});
  railRun(B, [hp[0] + d[0] * 0.08, hp[1] + d[1] * 0.08], [hp[0] + d[0] * 0.08 + n[0] * gw, hp[1] + d[1] * 0.08 + n[1] * gw], yb, 0.05, f.railH - 0.05, 0.12);
  // the planter with a small tree, a bench
  const pl = f.planter;
  B.boxXZ('precast', pl.s0, pl.s1, F.groundY(pl.s0, pl.t0) - 0.3, F.groundY(pl.s0, pl.t0) + pl.h, pl.t0, pl.t1, {});
  B.flat('flowerbed', [[pl.s0 + 0.1, pl.t0 + 0.1], [pl.s1 - 0.1, pl.t0 + 0.1], [pl.s1 - 0.1, pl.t1 - 0.1], [pl.s0 + 0.1, pl.t1 - 0.1]], F.groundY(pl.s0, pl.t0) + pl.h + 0.01);
  slabBench(ctx.K, B, 3.6, 13.0, F.groundY(3.6, 13.0) + 0.08, 90, 2.0);
  return { a, b, n, gate: [lerp2(a, b, at(f.gate[0])), lerp2(a, b, at(f.gate[1]))] };
}

// ------------------------------------------------------------------------------------------------ the service gate
function buildGate(ctx, F) {
  const { B } = ctx, [w0, w1] = P.WALL_LINE_END, g = P.GATE;
  const f = (g.pierV - w0[1]) / (w1[1] - w0[1]), su = w0[0] + f * (w1[0] - w0[0]);      // the street face at the pier's south face
  const dl = norm2([w1[0] - w0[0], w1[1] - w0[1]]), inw = [dl[1], -dl[0]];
  const hnL = [su + inw[0] * 0.3, g.pierV + inw[1] * 0.3], hn = F.P(hnL[0], hnL[1]), hs = [hn[0], -0.1];      // (square: both hinges at one s)
  const L = Math.hypot(hs[0] - hn[0], hs[1] - hn[1]), dg = norm2([hs[0] - hn[0], hs[1] - hn[1]]), e = [dg[1], -dg[0]];      // e: into the court
  const yb = (p) => F.groundY(p[0], p[1]);
  for (const hp of [hn, hs]) railRun(B, hp, [hp[0] + e[0] * (L / 2 - 0.05), hp[1] + e[1] * (L / 2 - 0.05)], yb, 0.06, g.h, g.bar);
  B.box('ironBlack', hs[0], yb(hs) + (g.h + 0.1) / 2, hs[1], 0.1, g.h + 0.1, 0.1, 0, {});
  return { hn, hs, e, L };
}

// ------------------------------------------------------------------------------------------------ the court's furniture
function buildCourt(ctx, F) {
  const { B, K } = ctx;
  for (const [s, t] of P.CTREES) { const y = F.groundY(s, t) + 0.1; B.flat('ironBlack', [[s - 0.65, t - 0.65], [s + 0.65, t - 0.65], [s + 0.65, t + 0.65], [s - 0.65, t + 0.65]], y); }
  for (const b of P.BENCHES) slabBench(K, B, b.s, b.t, F.groundY(b.s, b.t) + 0.08, b.rot, b.len);
  const l = P.LAMP, g = F.groundY(l.s, l.t) + 0.08;
  B.cyl('ironBlack', l.s, g, l.t, 0.06, l.h, 8, true);
  B.box('lampGlass', l.s, g + l.h + 0.08, l.t, 0.16, 0.16, 0.16, 0, {});
  B.box('ironBlack', l.s, g + l.h + 0.19, l.t, 0.22, 0.04, 0.22, 0, {});
  // the cycle stands along the five storey block's south face
  const c = P.CYCLES;
  for (let i = 0; i < c.n; i++) {
    const s = c.s0 + ((c.s1 - c.s0) * i) / (c.n - 1), y = F.groundY(s, c.t) + 0.08;
    for (const dt of [-0.35, 0.35]) B.box('ironBlack', s, y + 0.4, c.t + dt, 0.05, 0.8, 0.05, 0, { top: false });
    B.box('ironBlack', s, y + 0.8, c.t, 0.05, 0.05, 0.75, 0, {});
  }
  return [[l.s, g + l.h + 0.08, l.t]];
}

// ------------------------------------------------------------------------------------------------ Barbara Craig House
function buildBCH(ctx) {
  const { B, K } = ctx, H = P.BCH, R = H.ring, foot = -1.3, top = H.roof, key = 'bchBrick';
  const faces = [[0, 1, 'north'], [1, 2, 'west'], [2, 3, 'chamfer'], [4, 0, 'party']];      // (the outside is the left of from -> to)
  for (const [i, j, kind] of faces) {
    const A = R[i], Bp = R[j], L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), M = K.frame(A[0], 0, A[1], Bp[0] - A[0], Bp[1] - A[1]);
    const ops = [];
    if (kind !== 'party') {
      const n = Math.max(1, Math.floor((L - 0.8) / H.pitch)), x0 = (L - (n - 1) * H.pitch) / 2;
      for (const y of [H.ground + 1.0, ...H.floors.map((f) => f + H.win.sill)]) for (let k = 0; k < n; k++) ops.push({ pts: K.rectPts(x0 + k * H.pitch - H.winW / 2, y, x0 + k * H.pitch + H.winW / 2, y + H.winH), kind: 'win', glass: 'glassDark', d: 0.16, sillKey: 'precast' });
    }
    K.wall(B, M, K.rectPts(0, foot, L, top), ops, key, { dress: 'precast' });
    B.push(M); B.box(key, L / 2, top + 0.04, -0.15, L + 0.02, 0.08, 0.34, 0, { bottom: true }); B.pop();
  }
  // THE STREET FACE: the arcade and the piers
  const A = R[3], Bp = R[4], L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), dir = [(Bp[0] - A[0]) / L, (Bp[1] - A[1]) / L], nrm = [-dir[1], dir[0]];
  const at = (x, z) => [A[0] + dir[0] * x + nrm[0] * z, A[1] + dir[1] * x + nrm[1] * z];
  const pw = H.pier, px = [0, 1, 2, 3, 4].map((i) => pw / 2 + ((L - pw) * i) / 4), gr = H.ground;
  B.push(K.frame(A[0], 0, A[1], dir[0], dir[1]));
  const arches = [], upper = [], midPiers = [];
  for (let k = 0; k < 4; k++) {
    const a0 = px[k] + pw / 2, a1 = px[k + 1] - pw / 2, w = a1 - a0, c = (a0 + a1) / 2;
    arches.push(K.segPts(c, w, gr - 0.05, H.spring, H.rise));
    for (const f of H.floors) {
      const y0 = f + H.win.sill, y1 = y0 + H.win.h, ww = H.win.wide, wn = H.win.narrow, mp = H.win.pier;
      upper.push({ pts: K.rectPts(c - ww / 2, y0, c + ww / 2, y1), kind: 'win', glass: 'glassDark', lights: 3, mullionKey: 'leadDark', mullionW: 0.07, d: 0.18, sillKey: key });
      for (const sg of [-1, 1]) { const cx = c + sg * (ww / 2 + mp + wn / 2); upper.push({ pts: K.rectPts(cx - wn / 2, y0, cx + wn / 2, y1), kind: 'win', glass: 'glassDark', d: 0.18, sillKey: key }); }
    }
    // the brick piers parting each narrow side light from the wide window, full height over the arcade (the look)
    for (const sg of [-1, 1]) midPiers.push(c + sg * (H.win.wide / 2 + H.win.pier / 2));
  }
  B.face(key, [[0, foot], [L, foot], [L, top], [0, top]], [...arches, ...upper.map((o) => o.pts)]);
  for (const o of upper) { const bb = o.pts; B.reveal(key, bb, 0, -o.d); }
  B.pop();
  B.push(K.frame(A[0], 0, A[1], dir[0], dir[1]));
  for (const o of upper) {
    const bb = o.pts, x0 = bb[0][0], x1 = bb[1][0], y0 = bb[0][1], y1 = bb[2][1], n = o.lights || 1;
    for (let i = 0; i < n; i++) B.unit('glassDark', K.rectPts(x0 + ((x1 - x0) * i) / n, y0, x0 + ((x1 - x0) * (i + 1)) / n, y1), -o.d + 0.02, K.nextBay(y0));
    for (let i = 1; i < n; i++) B.box('leadDark', x0 + ((x1 - x0) * i) / n, (y0 + y1) / 2, -o.d / 2, 0.06, y1 - y0, o.d - 0.04, 0, {});
    B.box(key, (x0 + x1) / 2, y0 - 0.05, 0.03, x1 - x0 + 0.1, 0.1, 0.1, 0, { bottom: true });
  }
  for (const ar of arches) B.reveal(key, ar, 0, -0.35, true);
  // the piers standing proud, full height
  for (const x of px) B.box(key, x, (foot + top) / 2, H.pierProj / 2, pw, top - foot, H.pierProj, 0, { top: false });
  for (const x of midPiers) B.box(key, x, (H.band + top) / 2, H.win.pierProj / 2, H.win.pier, top - H.band, H.win.pierProj, 0, { top: false, bottom: true });
  B.box(key, L / 2, top + 0.04, -0.15 + H.pierProj / 2, L + 0.02, 0.08, 0.34 + H.pierProj, 0, { bottom: true });
  // the arcade behind: soffit, the shop fronts with the flats' door, the end walls
  const dp = -H.deep;
  B.poly('precast', [[0, H.spring + H.rise, -0.35], [L, H.spring + H.rise, -0.35], [L, H.spring + H.rise, dp], [0, H.spring + H.rise, dp]], [0, -1, 0]);
  const fronts = [];
  for (let k = 0; k < 4; k++) {
    const a0 = px[k] + pw / 2 + 0.15, a1 = px[k + 1] - pw / 2 - 0.15;
    if (k === H.door) { fronts.push({ r: K.rectPts(a0, gr + 0.02, a0 + 1.1, gr + 2.4), key: 'oakDoor' }); fronts.push({ r: K.rectPts(a0 + 1.35, gr + 0.5, a1, gr + 2.6), key: 'glassDark' }); }
    else { fronts.push({ r: K.rectPts(a0, gr + 0.45, (a0 + a1) / 2 - 0.55, gr + 2.6), key: 'glassDark' }); fronts.push({ r: K.rectPts((a0 + a1) / 2 - 0.45, gr + 0.02, (a0 + a1) / 2 + 0.45, gr + 2.4), key: 'doorGrey' }); fronts.push({ r: K.rectPts((a0 + a1) / 2 + 0.55, gr + 0.45, a1, gr + 2.6), key: 'glassDark' }); }
  }
  B.face('whitePaint', [[0, foot], [L, foot], [L, H.spring + H.rise], [0, H.spring + H.rise]], fronts.map((f) => f.r), dp);
  for (const f of fronts) { if (f.key === 'oakDoor') B.face('oakDoor', f.r, [], dp + 0.01); else B.unit(f.key, f.r, dp, K.nextBay(0)); }
  for (const [x, nx] of [[0.02, 1], [L - 0.02, -1]]) B.poly(key, [[x, foot, 0], [x, foot, dp], [x, H.spring + H.rise, dp], [x, H.spring + H.rise, 0]], [nx, 0, 0]);
  B.pop();
  parapetIn(B, R, H.membrane, top, [0, 1, 2, 3, 4], 'leadDark', key);
  const bx = H.box;
  K.prism(B, 'zinc', [[bx.u0, bx.v0], [bx.u1, bx.v0], [bx.u1, bx.v1], [bx.u0, bx.v1]], H.membrane, bx.top, { top: true, topKey: 'leadDark' });
  return { arcade: [at(0, 0), at(L, 0), at(L, dp), at(0, dp)], solid: [R[0], R[1], R[2], at(0, dp), at(L, dp)], piers: px.map((x) => [at(x - pw / 2, H.pierProj), at(x + pw / 2, H.pierProj), at(x + pw / 2, -0.3), at(x - pw / 2, -0.3)]) };
}

// ------------------------------------------------------------------------------------------------ the yard
function buildYard(ctx, F) {
  const { B, K, S } = ctx, Y = P.YWALL, st = P.STORE;
  // the west wall, broken by the gate to the alley
  const [a, b] = Y.west, at = (v) => lerp2(a, b, (v - a[1]) / (b[1] - a[1]));
  const runs = [[a, at(Y.gate[0])], [at(Y.gate[1]), b]];
  for (const [p, q] of runs) {
    const m = lerp2(p, q, 0.5), g = S.groundY(m[0], m[1]), L = Math.hypot(q[0] - p[0], q[1] - p[1]), ry = Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
    B.box('brick', m[0] - 0.15, (g - 0.5 + g + Y.h) / 2, m[1], L, Y.h + 0.5, 0.3, ry, {});
    B.box('brick', m[0] - 0.15, g + Y.h + 0.05, m[1], L + 0.02, 0.1, 0.38, ry, { bottom: true });
  }
  const gp = at(Y.gate[0]), gw = Y.gate[1] - Y.gate[0];
  railRun(B, [gp[0] + 0.05, gp[1]], [gp[0] + 0.05 + gw * 0.9, gp[1] + 0.02], (p) => S.groundY(p[0], p[1]), 0.05, 1.9, 0.12);
  // the single-storey store against the shops
  const g = S.groundY((st.u0 + st.u1) / 2, (st.v0 + st.v1) / 2) - 0.6;
  const sw = (A, Bp, ops) => K.wall(B, K.frame(A[0], 0, A[1], Bp[0] - A[0], Bp[1] - A[1]), K.rectPts(0, g, Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), st.roof), ops, 'brick');
  const gd = S.groundY((st.u0 + st.u1) / 2, st.v0 - 0.3), sm = (st.u1 - st.u0) / 2;
  sw([st.u1, st.v0], [st.u0, st.v0], [{ pts: K.rectPts(sm - 0.8, gd + 0.05, sm + 0.8, gd + 2.15), kind: 'door', doorKey: 'doorGrey', d: 0.12 }]);
  sw([st.u0, st.v0], [st.u0, st.v1], []); sw([st.u1, st.v1], [st.u1, st.v0], []);
  B.flat('leadDark', [[st.u0, st.v0], [st.u1, st.v0], [st.u1, st.v1], [st.u0, st.v1]], st.roof);
  B.box('precast', (st.u0 + st.u1) / 2, st.roof + 0.04, st.v0 - 0.02, st.u1 - st.u0 + 0.1, 0.08, 0.2, 0, { bottom: true });
  // trees
  for (let i = 0; i < P.YTREES.length; i++) { const [u, v, h, r] = P.YTREES[i]; K.tree(B, u, v, S.groundY(u, v), h, r, 61 + i); }
  void F;
}

// ------------------------------------------------------------------------------------------------ the ground
function courtRingF() {
  const p = P.PEN;
  return [[-0.1, p.rangeT], [p.s0, p.rangeT], [p.s0, p.bedT], [p.spS0, p.bedT], [p.spS0, p.spT], [p.spS1, p.spT], [p.spS1, p.rangeT], [p.ewS, p.rangeT],
    [p.ewS, p.bayT0], [p.bayS, p.bayT0], [p.bayS, p.bayT1], [p.ewS, p.bayT1], [p.ewS, p.ewT], [P.COURT_E, p.ewT], [P.COURT_E, P.HB.t0], [P.WB.s1, P.HB.t0],
    [P.WB.s1, 0], [0, 0], [-0.1, -0.1], [-0.6, -3.99], [-0.1, -4.02]];
}
function yardRing(F) {
  const hb = P.HB, eb = P.EB, e = F.L(eb.s1, hb.notchT);
  return [F.L(hb.s0, hb.t1), F.L(hb.notchS, hb.t1), F.L(hb.notchS, hb.notchT), e, [P.YARD_E, e[1]], [P.YARD_E, 80.08], [-52.30, 80.11], [-52.44, 75.42],
    [-56.52, 75.35], [-56.46, 79.98], [-57.99, 79.97], [-58.06, 75.56], [-62.06, 75.54], [-61.91, 79.64], [-76.14, 79.95], P.YWALL.west[1], P.YWALL.west[0]];
}
function buildGround(ctx, F) {
  const { B, G } = ctx, r = P.RESIN;
  const resin = F.ring([[r.s0, r.t0], [r.s1, r.t0], [r.s1, r.t1], [r.s0, r.t1]]);
  const court = F.ring(courtRingF());
  G.drape(B, 'chbPaving', court, 0.08, { holes: [resin] });
  G.drape(B, 'gravel', resin, 0.08);
  const fo = P.FORE, pl = fo.planter, fb = [P.WB.swS + (fo.t1 - P.WB.t1) * -0.092, fo.t1];
  const fore = F.ring([[P.WB.swS, P.WB.t1], [P.BED.s0, P.WB.t1], [P.BED.s0, fo.t1], fb]);
  G.drape(B, 'paving', fore, 0.08, { holes: [F.ring([[pl.s0, pl.t0], [pl.s1, pl.t0], [pl.s1, pl.t1], [pl.s0, pl.t1]])] });
  const st = P.STORE, yard = yardRing(F);
  G.drape(B, 'paving', yard, 0.08, { holes: [[[st.u0, st.v0], [st.u1, st.v0], [st.u1, st.v1], [st.u0, st.v1]]] });
  return { court, fore, yard };
}

// ------------------------------------------------------------------------------------------------ registration
function register(ctx, F, gd, fc, gate, lampsF, lampsL, bch) {
  const { S } = ctx, gy = (u, v) => S.groundY(u, v) + 0.08;
  for (const r of [gd.court, gd.fore, gd.yard]) ctx.floor(r, gy);
  const wb = P.WB, hb = P.HB, eb = P.EB;
  ctx.solid(F.ring([[0, 0], [wb.s1, 0], [wb.s1, hb.t0], [eb.s1, hb.t0], [eb.s1, eb.t1], [hb.notchS, eb.t1], [hb.notchS, hb.t1], [hb.s0, hb.t1], [hb.s0, wb.t1], [wb.swS, wb.t1]]));
  const b = P.BED; ctx.solid(F.ring([[b.s0, b.t0], [b.s1, b.t0], [b.s1, b.t1], [b.s0, b.t1]]));
  ctx.solid(bch.solid); for (const r of bch.piers) ctx.solid(r);
  ctx.floor(bch.arcade, gy);
  const st = P.STORE; ctx.solid([[st.u0, st.v0], [st.u1, st.v0], [st.u1, st.v1], [st.u0, st.v1]]);
  // the forecourt's wall (the gate open), the yard's west wall (its gate open), the gate leaves standing open
  const segF = (p, q) => { const a = F.L(p[0], p[1]), c = F.L(q[0], q[1]); ctx.seg(a[0], a[1], c[0], c[1]); };
  segF(fc.a, fc.gate[0]); segF(fc.gate[1], fc.b);
  const Y = P.YWALL, [ya, yb2] = Y.west, at = (v) => lerp2(ya, yb2, (v - ya[1]) / (yb2[1] - ya[1]));
  for (const [p, q] of [[ya, at(Y.gate[0])], [at(Y.gate[1]), yb2]]) ctx.seg(p[0], p[1], q[0], q[1]);
  for (const hp of [gate.hn, gate.hs]) segF(hp, [hp[0] + gate.e[0] * (gate.L / 2), hp[1] + gate.e[1] * (gate.L / 2)]);
  for (const [s, y, t] of lampsF) { const q = F.L(s, t); ctx.lamp(q[0], y, q[1]); }
  for (const [u, y, v] of lampsL) ctx.lamp(u, y, v);
}

// ------------------------------------------------------------------------------------------------ the part
export function buildHughes(ctx) {
  const { B, K, S, pack } = ctx;
  K.addCell(pack, 'bronze', 'lead', 0x8f7a52);           // the bronze-anodised window frames, fins and hoods (touch-up 2: lighter, was 0x5c4c33)
  K.addCell(pack, 'chbStone', 'stone', [1.04, 0.88, 0.80]);   // the pink reconstituted-stone plinth
  K.addCell(pack, 'chbPV', 'lead', 0x1e2633);            // photovoltaic panels
  K.addCell(pack, 'bchBrick', 'redBrick', [0.70, 1.40, 1.75], { seed: 1.1 });   // Barbara Craig House's brown-red brick (touch-up 2: was orange-red; linear tint, so green and blue up)
  { const gc = pack.groundCells; if (gc && gc.has('paving') && !gc.has('chbPaving')) gc.set('chbPaving', { ...gc.get('paving'), tint: [1.25, 1.08, 0.78] }); }   // the court's buff block paving (a tinted copy of the ground cell 'paving', same layer)
  const F = S.ownFrame(P.ORIGIN[0], P.ORIGIN[1], P.ORIGIN[0] + Math.cos(P.ANG) * 50, P.ORIGIN[1] + Math.sin(P.ANG) * 50);
  const gd = buildGround(ctx, F);
  // trees (LOCAL)
  for (let i = 0; i < P.CTREES.length; i++) { const [s, t, h, r] = P.CTREES[i], q = F.L(s, t); K.tree(B, q[0], q[1], S.groundY(q[0], q[1]), h, r, 51 + i); }
  { const [s, t, h, r] = P.PATH_TREE, q = F.L(s, t); K.tree(B, q[0], q[1], S.groundY(q[0], q[1]), h, r, 55); }
  B.push(F.M);
  const lampsF = buildCHB(ctx, F);
  lampsF.push(...buildBedford(ctx, F));
  const fc = buildForecourt(ctx, F);
  const gate = buildGate(ctx, F);
  lampsF.push(...buildCourt(ctx, F));
  B.pop();
  const bch = buildBCH(ctx);
  ctx.G.drape(B, 'paving', bch.arcade, 0.08);
  buildYard(ctx, F);
  register(ctx, F, gd, fc, gate, lampsF, [], bch);
  return { frame: P.ORIGIN };
}
