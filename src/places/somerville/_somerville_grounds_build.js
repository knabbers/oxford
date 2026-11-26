// Somerville College, STANDALONE model, part 'grounds' (survey G00): THE BUILD of the open ground. Every figure comes
// from _somerville_grounds_plan.js. Everything is drawn in the LOCAL frame with no own frame pushed on the Batch.
//
// EXACT DRAPING. The kit's drape (_somerville_ground.js) drops whole triangles whose middle falls in a hole, so a cut is
// ragged. `drapeX` below lays a ring on the surveyed surface by exact polygon clipping instead: the ring is cut into
// triangles, each is clipped to the 2 m grid's own triangles (the surface is planar on each, as S.groundY), and every
// hole is subtracted exactly (each hole cut into triangles, each subtracted as a convex piece). So the base sheet, cut
// where a lawn, path or bed lies, and the lawn laid in that cut meet edge to edge: each patch of ground is drawn once.
import * as THREE from 'three';
import * as P from './_somerville_grounds_plan.js';

// ------------------------------------------------------------------------------------------------ geometry helpers
// keep the part of polygon Q with a*u + b*v <= c
function clip(Q, a, b, c) {
  const out = [];
  for (let i = 0; i < Q.length; i++) {
    const p = Q[i], q = Q[(i + 1) % Q.length], dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
const area = (Q) => { let s = 0; for (let i = 0; i < Q.length; i++) { const p = Q[i], q = Q[(i + 1) % Q.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
const bbox = (Q) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of Q) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; };
const clean = (R) => { const o = []; for (const p of R) { const q = o[o.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) o.push(p); } if (o.length > 1 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 1e-4) o.pop(); return o; };
/** a ring cut into triangles [[u, v] x 3] */
function triRing(ring) {
  const R = clean(ring); if (R.length < 3) return [];
  const T = THREE.ShapeUtils.triangulateShape(R.map((p) => new THREE.Vector2(p[0], p[1])), []);
  return T.map((t) => t.map((i) => R[i])).filter((t) => Math.abs(area(t)) > 1e-6);
}
/** the three half-planes (a, b, c: a u + b v <= c) of a triangle */
function halfPlanes(t) {
  const hp = [];
  for (let i = 0; i < 3; i++) {
    const p = t[i], q = t[(i + 1) % 3], r = t[(i + 2) % 3];
    let a = q[1] - p[1], b = -(q[0] - p[0]), c = a * p[0] + b * p[1];
    if (a * r[0] + b * r[1] > c) { a = -a; b = -b; c = -c; }
    hp.push([a, b, c]);
  }
  return hp;
}
/** convex polygon Q minus convex triangle (as half-planes): convex pieces */
function subtract(Q, hp) {
  const out = []; let rest = Q;
  for (const [a, b, c] of hp) {
    const o = clip(rest, -a, -b, -c); if (o.length >= 3 && Math.abs(area(o)) > 1e-5) out.push(o);
    rest = clip(rest, a, b, c); if (rest.length < 3 || Math.abs(area(rest)) < 1e-6) return out;
  }
  return out;      // (what is left is inside the hole)
}
const boxHit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * drapeX(B, key, ring, dy, o): the ring laid on the surveyed ground (or on o.y(u, v)) dy above it, holes (o.holes:
 * rings) cut exactly. B must have no own frame pushed (LOCAL). Returns the triangles drawn.
 */
export function drapeX(ctx, key, ring, dy = 0, o = {}) {
  const { B, S } = ctx, G = S.GROUND_GRID, St = G.STEP, yf = o.y || S.groundY, m = o.uv || 3;
  const holes = [];
  for (const h of o.holes || []) for (const t of triRing(h)) holes.push({ hp: halfPlanes(t), bb: bbox(t) });
  let n = 0;
  const emit = (Q) => {
    for (let k = 1; k < Q.length - 1; k++) {
      let a = Q[0], b = Q[k], c = Q[k + 1];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) < 1e-7) continue;
      if ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]) < 0) { const x = b; b = c; c = x; }      // (so the face looks up)
      B.tri(key, [a[0], yf(a[0], a[1]) + dy, a[1]], [c[0], yf(c[0], c[1]) + dy, c[1]], [b[0], yf(b[0], b[1]) + dy, b[1]], [a[0] / m, a[1] / m], [c[0] / m, c[1] / m], [b[0] / m, b[1] / m]);
      n++;
    }
  };
  for (const T of triRing(ring)) {
    const bb = bbox(T);
    const i0 = Math.floor((bb[0] - G.U0) / St), i1 = Math.ceil((bb[2] - G.U0) / St), j0 = Math.floor((bb[1] - G.V0) / St), j1 = Math.ceil((bb[3] - G.V0) / St);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const a = G.U0 + i * St, b = G.V0 + j * St;
      let C = clip(clip(clip(clip(T, 1, 0, a + St), -1, 0, -a), 0, 1, b + St), 0, -1, -b);
      if (C.length < 3) continue;
      // the cell's two triangles (as S.groundY splits it: u - a >= v - b, and the other)
      for (const Q0 of [clip(C, -1, 1, b - a), clip(C, 1, -1, a - b)]) {
        if (Q0.length < 3 || Math.abs(area(Q0)) < 1e-6) continue;
        let pieces = [Q0];
        const qb = bbox(Q0);
        for (const h of holes) {
          if (!boxHit(qb, h.bb)) continue;
          const next = []; for (const q of pieces) { if (boxHit(bbox(q), h.bb)) next.push(...subtract(q, h.hp)); else next.push(q); }
          pieces = next; if (!pieces.length) break;
        }
        for (const q of pieces) emit(q);
      }
    }
  }
  return n;
}

/** f made piecewise planar on the ground grid's triangles (corner values of f interpolated exactly as S.groundY does) */
export function cellPlanar(S, f) {
  const G = S.GROUND_GRID, St = G.STEP;
  return (u, v) => {
    const fu = Math.max(0, Math.min(G.NU - 1.001, (u - G.U0) / St)), fv = Math.max(0, Math.min(G.NV - 1.001, (v - G.V0) / St));
    const i = Math.floor(fu), j = Math.floor(fv), a = fu - i, b = fv - j, x = G.U0 + i * St, z = G.V0 + j * St;
    const h00 = f(x, z), h10 = f(x + St, z), h01 = f(x, z + St), h11 = f(x + St, z + St);
    return a >= b ? h00 + a * (h10 - h00) + b * (h11 - h10) : h00 + b * (h01 - h00) + a * (h11 - h01);
  };
}
/** a point where line a (two points) meets line b (two points), both taken as infinite */
export function meet(a, b) {
  const [p, q] = a, [r, s] = b, d1 = [q[0] - p[0], q[1] - p[1]], d2 = [s[0] - r[0], s[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
  const t = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den;
  return [p[0] + d1[0] * t, p[1] + d1[1] * t];
}
/** piecewise linear v of a polyline [[u, v], ...] (u increasing) at u */
const vAt = (line, u) => { for (let i = 0; i < line.length - 1; i++) { const p = line[i], q = line[i + 1]; if (u >= p[0] - 1e-9 && u <= q[0] + 1e-9) return p[1] + ((q[1] - p[1]) * (u - p[0])) / (q[0] - p[0]); } return u < line[0][0] ? line[0][1] : line[line.length - 1][1]; };
const ellipse = (u, v, a, b, n = 14) => Array.from({ length: n }, (_, i) => [u + a * Math.cos((i / n) * 2 * Math.PI), v + b * Math.sin((i / n) * 2 * Math.PI)]);

/**
 * A wall along a LOCAL polyline as a strip th thick centred on it: per vertex top yT(u, v) and foot yB(u, v); `keep(p, q)`
 * may skip a piece. Faces: both sides, the top (key topKey), the ends of each run. Pieces at most `step` long.
 */
export function wallStrip(B, key, line, th, yT, yB, o = {}) {
  const step = o.step ?? 1.0, topKey = o.topKey || key, keep = o.keep || (() => true);
  const pieces = [];
  for (let i = 0; i < line.length - 1; i++) {
    const p = line[i], q = line[i + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.01) continue;
    const n = Math.max(1, Math.ceil(L / step)), nu = (-(q[1] - p[1]) / L) * th / 2, nv = ((q[0] - p[0]) / L) * th / 2;
    for (let k = 0; k < n; k++) {
      const a = [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n], b = [p[0] + ((q[0] - p[0]) * (k + 1)) / n, p[1] + ((q[1] - p[1]) * (k + 1)) / n];
      pieces.push({ a, b, nu, nv, on: keep(a, b) });
    }
  }
  let tris = 0;
  for (let i = 0; i < pieces.length; i++) {
    const { a, b, nu, nv, on } = pieces[i]; if (!on) continue;
    const ta = yT(a[0], a[1]), tb = yT(b[0], b[1]), ba = yB(a[0], a[1]), bb = yB(b[0], b[1]);
    const aL = [a[0] + nu, a[1] + nv], aR = [a[0] - nu, a[1] - nv], bL = [b[0] + nu, b[1] + nv], bR = [b[0] - nu, b[1] - nv];
    B.poly(key, [[aL[0], ba, aL[1]], [bL[0], bb, bL[1]], [bL[0], tb, bL[1]], [aL[0], ta, aL[1]]], [nu, 0, nv]);
    B.poly(key, [[bR[0], bb, bR[1]], [aR[0], ba, aR[1]], [aR[0], ta, aR[1]], [bR[0], tb, bR[1]]], [-nu, 0, -nv]);
    B.poly(topKey, [[aL[0], ta, aL[1]], [bL[0], tb, bL[1]], [bR[0], tb, bR[1]], [aR[0], ta, aR[1]]], [0, 1, 0]);
    tris += 6;
    const cap = (p, L, R, y0, y1, dir) => { B.poly(key, [[L[0], y0, L[1]], [R[0], y0, R[1]], [R[0], y1, R[1]], [L[0], y1, L[1]]], dir); tris += 2; };
    if (i === 0 || !pieces[i - 1].on) cap(a, aL, aR, ba, ta, [a[0] - b[0], 0, a[1] - b[1]]);
    if (i === pieces.length - 1 || !pieces[i + 1].on) cap(b, bL, bR, bb, tb, [b[0] - a[0], 0, b[1] - a[1]]);
  }
  return tris;
}

// ------------------------------------------------------------------------------------------------ planting
let seed = 7;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
/** a low clump of planting: a rounded mound r across, h high (a flattened six-sided ellipsoid sunk a little) */
function clump(B, K, key, u, v, y0, r, h) {
  blob(B, key, u, y0 + h * 0.4, v, r * (0.85 + rnd() * 0.3), h * 0.6, 6, 3);
}
/** clumps scattered over a ring (density a square metre), keys picked from `keys` */
function plant(ctx, ring, density, keys, rMin, rMax, hMin, hMax, yf) {
  const { B, K, S } = ctx, bb = bbox(ring), A = Math.abs(area(ring)), n = Math.round(A * density);
  let placed = 0, tries = 0;
  while (placed < n && tries < n * 20) {
    tries++;
    const u = bb[0] + rnd() * (bb[2] - bb[0]), v = bb[1] + rnd() * (bb[3] - bb[1]);
    if (!S.inRing(u, v, ring)) continue;
    const r = rMin + rnd() * (rMax - rMin), h = hMin + rnd() * (hMax - hMin);
    clump(B, K, keys[Math.floor(rnd() * keys.length)], u, v, (yf || S.groundY)(u, v) + P.DY.bed, r, h);
    placed++;
  }
  return placed;
}

/** a flattened ellipsoid of foliage (seg sides, rings bands) */
function blob(B, key, cx, cy, cz, r, ry, seg = 7, rings = 4) {
  for (let j = 0; j < rings; j++) {
    const t0 = (j / rings) * Math.PI, t1 = ((j + 1) / rings) * Math.PI;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (t, a) => [cx + Math.sin(t) * Math.cos(a) * r, cy + Math.cos(t) * ry, cz + Math.sin(t) * Math.sin(a) * r];
      const q = [p(t0, a0), p(t1, a0), p(t1, a1), p(t0, a1)], nn = [Math.cos((a0 + a1) / 2), Math.cos((t0 + t1) / 2) + 0.01, Math.sin((a0 + a1) / 2)];
      if (j === 0) B.poly(key, [q[0], q[1], q[2]], nn); else if (j === rings - 1) B.poly(key, [q[0], q[1], q[3]], nn); else B.poly(key, q, nn);
    }
  }
}
/** the blue Atlas cedar: a short thick trunk and a broad, layered crown of flat blue-grey masses from 2 m up, tapering
 *  to a blunt top (photograph c2021, Brigade Piron 2009) */
function cedar(B, K, keys, u, v, y0, h, r) {
  B.cyl('oak', u, y0, v, 0.32, h * 0.55, 8, false, 0.55);
  const layers = 6;
  for (let k = 0; k < layers; k++) {
    const f = k / (layers - 1), y = y0 + 2.6 + f * (h - 4.6), R = r * (1.0 - 0.62 * f) * (0.9 + rnd() * 0.15), n = k < 2 ? 5 : k < 4 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.9 + k, d = R * (0.42 + rnd() * 0.2), rr = R * (0.5 + rnd() * 0.15);
      blob(B, keys[(i + k) % keys.length], u + Math.cos(a) * d, y + (rnd() - 0.5) * 0.8, v + Math.sin(a) * d, rr, rr * (0.32 + rnd() * 0.12));
    }
    blob(B, keys[k % keys.length], u + (rnd() - 0.5), y + 0.4, v + (rnd() - 0.5), R * 0.45, R * 0.28);
  }
  blob(B, keys[0], u + 0.4, y0 + h - 1.2, v, r * 0.3, 1.3);
}

// ------------------------------------------------------------------------------------------------ the build
export function buildGrounds(ctx) {
  const { B, K, S, pack } = ctx, gY = S.groundY;
  seed = 7;
  // ground keys: the base sheet on the lowest ground layer; the cedar's and the planting's plain colours
  const gc = pack && pack.groundCells;
  if (gc && !gc.has('gBase') && gc.has('gravel')) gc.set('gBase', { ...gc.get('gravel'), layer: P.BASE_LAYER });
  const baseKey = gc && gc.has('gBase') ? 'gBase' : 'gravel';
  K.addCell(pack, 'grCedar', 'leafA', 0x7f9c9a); K.addCell(pack, 'grCedarDk', 'leafA', 0x67827f);
  K.addCell(pack, 'grFlowerA', 'leafA', 0x9c7a98); K.addCell(pack, 'grFlowerB', 'leafA', 0xc9b46a); K.addCell(pack, 'grFlowerC', 'leafA', 0xd2d0cb);
  K.addCell(pack, 'grGrass', 'leafA', 0xa9a27a); K.addCell(pack, 'grSteel', 'lead', 0x8c8f91);
  const has = (k) => !pack || !pack.cells || pack.cells.has(k);
  const pick = (k, alt) => (has(k) ? k : alt);
  const FLOWERS = ['leafA', 'leafB', 'leafC', 'box', 'leafA', 'leafB', 'box', pick('grGrass', 'leafB'), pick('grGrass', 'leafB'), pick('grFlowerA', 'leafB'), pick('grFlowerB', 'leafB'), pick('grFlowerC', 'leafB')];
  const CEDAR = [pick('grCedar', 'leafC'), pick('grCedarDk', 'leafC')];
  const SHRUBS = ['leafA', 'leafC', 'box'];

  // ---- the lines everything is cut along
  const LF = S.ownFrame(...P.LIB_FRAME);
  const Tl = (t) => [LF.L(0, t), LF.L(100, t)];
  const NWc = meet(P.WALL_LINE, Tl(P.LIB_T.lawn)), NEc = meet(P.DRIVE_W, Tl(P.LIB_T.lawn));
  const A5 = meet(P.SETTS_E, Tl(P.LIB_T.lawn)), A36 = meet(P.SETTS_E, Tl(P.LIB_T.holtby)), D26 = meet(P.DRIVE_W, Tl(P.LIB_T.beds));
  const cpS = (u) => vAt(P.CROSS_S, u), cpN = (u) => vAt(P.CROSS_N, u);
  const plat = P.PLATEAU;
  const yQraw = (u, v) => Math.max(gY(u, v), plat.y - Math.max(0, v - plat.fadeV0) * plat.fadeV - Math.max(0, u - plat.fadeU0) * plat.fadeU);
  const yQ = cellPlanar(S, yQraw);      // (planar on each of the grid's triangles, as S.groundY: so no crack opens where one patch has an extra vertex on an edge)

  // ---- rings
  const crossN = P.CROSS_N.map((p) => p.slice());
  const extraS = [-16.0, -11.6, -9.4, -4.5].map((u) => [u, cpS(u)]);
  const crossS = [...P.CROSS_S, ...extraS].sort((a, b) => a[0] - b[0]);
  const QUAD = [NWc, NEc, P.DRIVE_W[0], P.QUAD_E[1], ...crossN.filter((p) => p[0] < 34 && p[0] >= -35.0).reverse(), P.WALL_LINE[0]];
  const SETTS = [A5, NWc, P.WALL_LINE[0], P.SETTS_E[1]];
  const LIBPATH = [A36, LF.L(P.LIB_T.sHoltby, P.LIB_T.holtby), LF.L(P.LIB_T.sHoltby, P.LIB_T.beds), D26, NEc, NWc, A5];
  const CROSS = [...crossN, P.CROSS_S[P.CROSS_S.length - 1], ...crossS.slice(0, -1).reverse()];
  const WB = [[-16.0, cpS(-16.0)], [-11.6, cpS(-11.6)], [-11.6, P.BORDER_W.v1], [-16.0, P.BORDER_W.v1]];
  const NSP = [[-11.6, cpS(-11.6)], [-9.4, cpS(-9.4)], [-9.4, P.NS_PATH.v1], [-11.6, P.NS_PATH.v1]];
  const EB = P.BORDER_E.map((p) => [p[0], p[1] == null ? cpS(p[0]) : p[1]]);
  const ew = P.EAST_WALK, ewW = [ew[18], ew[17], ew[16]];      // the walk's west edge south of the cross path: (32.98, 25.8), (32.17, 34.5), (31.15, 45.4)
  const CHAPEL_LAWN = [[-4.5, cpS(-4.5)], [33.0, 22.0], ...ewW, [30.76, 49.6], [-4.0, 49.6], [-4.0, 41.0], [-4.5, 40.0]];
  const PARK_LAWN = [[-57.2, 3.9], [-38.67, 2.6], [-37.4, 20.91], [-40, 21.2], [-54.55, 21.77], [-57.2, 21.8]];
  const woodchip = [LF.L(P.WOODCHIP_BED.topS[0], P.WOODCHIP_BED.topT[0]), LF.L(P.WOODCHIP_BED.topS[1], P.WOODCHIP_BED.topT[0]), LF.L(P.WOODCHIP_BED.topS[1], P.WOODCHIP_BED.topT[1]),
    meet([[-31.75, 0], [-31.75, 1]], Tl(P.WOODCHIP_BED.topT[1])), [-31.75, -0.75], [LF.L(P.WOODCHIP_BED.topS[0], P.WOODCHIP_BED.topT[0])[0], -0.75]];
  const shrubBeds = P.PENROSE_SHRUBS.map(([u, v, a, b]) => ellipse(u, v, a, b, 12));
  const chapelBeds = P.CHAPEL_BEDS.map(([u, v, a, b]) => ellipse(u, v, a, b, 14));

  // ---- the walking surface: the whole site first (as the scaffold), then the made level of the Quad
  ctx.floor(S.SITE_RING, (u, v) => gY(u, v) + 0.04);
  ctx.floor(QUAD, (u, v) => yQ(u, v) + P.DY.lawn);

  // ---- lawns, paths, beds (each patch once; the base sheet is cut under them)
  const mine = [];
  const lay = (key, ring, dy, o = {}) => { drapeX(ctx, key, ring, dy, o); mine.push(ring); };
  lay('lawn', QUAD, P.DY.lawn, { y: yQ, holes: [woodchip] });
  drapeX(ctx, 'flowerbed', woodchip, P.DY.bed, { y: yQ });
  lay('setts', SETTS, P.DY.path);
  lay('asphalt', LIBPATH, P.DY.path);
  lay('asphalt', P.WEST_PATH, P.DY.path);
  lay('asphalt', CROSS, P.DY.path);
  lay('asphalt', P.EAST_WALK, P.DY.path);
  lay('asphalt', P.SE_PATH, P.DY.path);
  lay('asphalt', NSP, P.DY.path);
  lay('asphalt', P.CHAPEL_N_PATH, P.DY.path);
  lay('asphalt', P.PARK_WALK, P.DY.path);
  lay('flowerbed', WB, P.DY.bed);
  lay('flowerbed', EB, P.DY.bed);
  lay('lawn', CHAPEL_LAWN, P.DY.lawn, { holes: chapelBeds });
  for (const r of chapelBeds) drapeX(ctx, 'flowerbed', r, P.DY.bed);
  lay('lawn', PARK_LAWN, P.DY.lawn);
  lay('lawn', P.PENROSE_LAWN, P.DY.lawn, { holes: shrubBeds });
  for (const r of shrubBeds) drapeX(ctx, 'flowerbed', r, P.DY.bed);
  lay('lawn', P.SE_GARDEN, P.DY.lawn);

  // ---- THE BASE SHEET under everything: the whole site, cut where this part or another lays its own ground
  drapeX(ctx, baseKey, S.SITE_RING, 0, { holes: [...mine, ...P.OTHERS_GROUND.map((r) => r[1])] });
  for (const [, r] of P.OTHERS_KEEP || []) drapeX(ctx, baseKey, r, 0);
  ctx.G.edgeDown(B, 'soil', S.SITE_RING, 0, 0.6);

  // ---- the retaining wall on the Quad's west side and along the Library path past Holtby
  const RW = [[P.WALL_LINE[0][0], 12.0], P.WALL_LINE[0], NWc, LF.L(45, P.LIB_T.lawn)];
  const inQ = (p, d) => { const q = [p[0] + d[0], p[1] + d[1]]; return S.inRing(q[0], q[1], QUAD); };
  // the lawn's side of the line: for the wall's top read the lawn just inside it, for its foot the ground just outside
  const side = (u, v) => {
    for (const d of [[0.35, 0], [0, 0.35], [-0.35, 0], [0, -0.35], [0.25, 0.25], [-0.25, 0.25]]) if (inQ([u, v], d) && !inQ([u, v], [-d[0], -d[1]])) return d;
    return [0.35, 0];
  };
  const wTop = (u, v) => { const d = side(u, v); return yQ(u + d[0], v + d[1]) + P.DY.lawn + 0.05; };
  const wLow = (u, v) => { const d = side(u, v); return gY(u - d[0], v - d[1]) + P.DY.path; };
  const keepW = (a, b) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return wTop(m[0], m[1]) - 0.05 - wLow(m[0], m[1]) > P.RETAIN.minH; };
  wallStrip(B, 'rubble', RW, P.RETAIN.th, wTop, (u, v) => gY(u, v) - P.RETAIN.foot, { step: 0.5, keep: keepW, topKey: 'bathDress' });
  for (let i = 0; i < RW.length - 1; i++) {
    const p = RW[i], q = RW[i + 1], n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2);
    for (let k = 0; k < n; k++) { const a = [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n], b = [p[0] + ((q[0] - p[0]) * (k + 1)) / n, p[1] + ((q[1] - p[1]) * (k + 1)) / n]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (wTop(m[0], m[1]) - wLow(m[0], m[1]) > 0.35) ctx.seg(a[0], a[1], b[0], b[1]); }
  }

  // ---- planting: the herbaceous borders, the shrub bed inside the wall, the shrub ovals, the Chapel lawn's beds
  plant(ctx, WB, 0.75, FLOWERS, 0.3, 0.55, 0.35, 0.95);
  plant(ctx, EB, 0.7, FLOWERS, 0.3, 0.6, 0.35, 1.0);
  plant(ctx, woodchip, 0.35, SHRUBS, 0.5, 0.85, 0.5, 1.1, yQ);
  for (const r of shrubBeds) plant(ctx, r, 0.6, SHRUBS, 0.5, 0.85, 0.7, 1.3);
  for (const r of chapelBeds) plant(ctx, r, 0.6, FLOWERS, 0.25, 0.45, 0.25, 0.7);
  // the clipped hedge south of the path to the Hodgkin Quad
  { const L = P.SE_HEDGE.line, m = [(L[0][0] + L[1][0]) / 2, (L[0][1] + L[1][1]) / 2]; K.parapet(B, 'box', L, gY(m[0], m[1]) - 0.15, P.SE_HEDGE.h + 0.15, P.SE_HEDGE.w); ctx.seg(L[0][0], L[0][1], L[1][0], L[1][1]); }

  // ---- trees
  let ti = 0;
  for (const t of P.TREES) {
    ti++;
    const [u, v] = t[0] === 'lib' ? LF.L(t[1], 1.8) : [t[0], t[1]], [, , h, r, kind] = t;
    const y0 = S.inRing(u, v, QUAD) ? yQ(u, v) : gY(u, v);
    if (kind === 'cedar') { cedar(B, K, CEDAR, u, v, y0, h, r); ctx.seg(u - 0.4, v - 0.4, u + 0.4, v + 0.4); }
    else K.tree(B, u, v, y0, h, r, ti);
  }

  // ---- lamp posts
  for (const L of P.LAMPS) {
    const [u, v] = L[0] === 'lib' ? LF.L(L[1], P.LIB_T.lawn + 0.25) : [L[0], L[1]];
    const y0 = S.inRing(u, v, QUAD) ? yQ(u, v) : gY(u, v);
    const pt = K.lampPost(B, u, v, y0, P.LAMP_H); ctx.lamp(pt[0], pt[1], pt[2]);
  }
  // ---- benches
  const tAng = Math.atan2(LF.L(0, 1)[0] - LF.L(0, 0)[0], LF.L(0, 1)[1] - LF.L(0, 0)[1]);      // (a bench faces +z at ry 0: here the Library frame's +t, towards the lawn)
  for (const b of P.BENCHES) {
    const [u, v] = b[0] === 'lib' ? LF.L(b[1], P.LIB_T.lawn + 0.7) : [b[0], b[1]];
    const ry = b[0] === 'lib' ? tAng : (b[2] * Math.PI) / 180, len = b[0] === 'lib' ? b[2] : b[3];
    K.bench(B, u, v, S.inRing(u, v, QUAD) ? yQ(u, v) : gY(u, v), ry, len);
  }
  // ---- sculptures (plain abstract forms)
  {
    const s = P.SCULPTURES.steel, y = yQ(s.u, s.v);
    B.box('bathDress', s.u, y + 0.1, s.v, 1.4, 0.3, 1.4, 0.3);
    for (let i = 0; i < 3; i++) { const M = new THREE.Matrix4().makeRotationY(0.3 + i * 2.1).multiply(new THREE.Matrix4().makeRotationZ(0.18 - i * 0.12)); M.setPosition(s.u + Math.cos(i * 2.1) * 0.25, y + 0.25, s.v + Math.sin(i * 2.1) * 0.25); B.push(M); B.box(pick('grSteel', 'lead'), 0, 1.2 + i * 0.25, 0, 0.12, 2.4 + i * 0.5, 0.55, 0, { bottom: true }); B.pop(); }
    ctx.seg(s.u - 0.7, s.v - 0.7, s.u + 0.7, s.v + 0.7);
    const t = P.SCULPTURES.triad, yt = gY(t.u, t.v);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, M = new THREE.Matrix4().makeRotationY(-a).multiply(new THREE.Matrix4().makeRotationZ(-0.22)); M.setPosition(t.u + Math.cos(a) * 0.6, yt, t.v + Math.sin(a) * 0.6); B.push(M); B.box('leadDark', 0, 0.9, 0, 0.18, 1.9, 0.5, 0, { bottom: true }); B.pop(); }
    ctx.seg(t.u - 0.8, t.v - 0.8, t.u + 0.8, t.v + 0.8);
    const e = P.SCULPTURES.ellipse, ye = gY(e.u, e.v);
    B.box('bathDress', e.u, ye + 0.2, e.v, 1.6, 0.4, 0.6, 0);
    for (let i = 0; i < 16; i++) { const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2, x0 = Math.cos(a0) * 1.1, y0 = Math.sin(a0) * 0.75, x1 = Math.cos(a1) * 1.1, y1 = Math.sin(a1) * 0.75, L = Math.hypot(x1 - x0, y1 - y0);
      const M = new THREE.Matrix4().makeTranslation(e.u + (x0 + x1) / 2, ye + 1.2 + (y0 + y1) / 2, e.v).multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(y1 - y0, x1 - x0))); B.push(M); B.box('copper', 0, 0, 0, L + 0.02, 0.12, 0.12, 0, { bottom: true }); B.pop(); }
    ctx.seg(e.u - 0.8, e.v - 0.3, e.u + 0.8, e.v + 0.3);
  }

  // ---- boundary walls no part builds
  for (const [, line, h, key, cop, th] of P.WALLS) {
    const top = (u, v) => gY(u, v) + h, foot = (u, v) => gY(u, v) - 0.5;
    wallStrip(B, key, line, th, top, foot, { step: 2.0 });
    wallStrip(B, cop, line, th + 0.1, (u, v) => top(u, v) + 0.1, top, { step: 2.0 });
    for (let i = 0; i < line.length - 1; i++) ctx.seg(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]);
  }
  {
    const R = P.NORTH_RAIL, L = R.line, top = (u, v) => gY(u, v) + R.wallH;
    wallStrip(B, 'brickDark', L, 0.3, top, (u, v) => gY(u, v) - 0.5, { step: 2.0 });
    wallStrip(B, 'bathDress', L, 0.38, (u, v) => top(u, v) + 0.08, top, { step: 2.0 });
    for (let i = 0; i < L.length - 1; i++) {
      const p = L[i], q = L[i + 1], len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.floor(len / 0.25), ry = Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
      for (let k = 0; k <= n; k++) { const f = k / n, u = p[0] + (q[0] - p[0]) * f, v = p[1] + (q[1] - p[1]) * f, y = top(u, v) + 0.08; B.box('ironBlack', u, y + (R.railH - R.wallH) / 2, v, 0.025, R.railH - R.wallH, 0.025, ry, { top: false }); }
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      B.box('ironBlack', m[0], top(m[0], m[1]) + R.railH - R.wallH + 0.06, m[1], len, 0.05, 0.05, ry);
      ctx.seg(p[0], p[1], q[0], q[1]);
    }
  }
  return { quad: QUAD };
}
