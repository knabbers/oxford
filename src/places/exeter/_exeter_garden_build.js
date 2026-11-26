// Exeter College, STANDALONE model, part 'garden' (G04 - G06): the build functions. Called by exeter_garden.js with ctx.B
// already in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from
// _exeter_garden_plan.js (sources and K / G there). Helpers written here (not in the kit): `drape` (a ground polygon laid on
// a height function, cut on a grid so neighbouring sheets meet without cracks), `oblock` (a block in a skew plan frame
// whose top may slope), `rail` (an iron handrail on posts). The planting is _exeter_plants.js's (shared with the other parts).
import * as THREE from 'three';
import * as K from './_exeter_kit.js';
import { shrub } from './_exeter_plants.js';
import {
  lerp, clamp, smooth, interp, distLine, groundY, WALL, LANE, SQUARE, IRON, LANE_DOOR, A1, N1, P1, ST1, SHED, E2, L2, P2, ST2,
  walkY, BANK, WALK, VIEW_BENCH, GARDEN_RING, inner, LAWN, BEDS, POND, TREES, BENCHES, PLANTING, LIB,
} from './_exeter_garden_plan.js';

const LIFT = { lawn: 0.02, bed: 0.03, walk: 0.02 };

// ------------------------------------------------------------------------------------------------ helpers
/** clip a ring to the axis box x0..x1, z0..z1 (Sutherland - Hodgman: exact for a convex window) */
function clipBox(ring, x0, z0, x1, z1) {
  let P = ring;
  const edges = [[(p) => p[0] >= x0, (p, q) => [x0, p[1] + ((q[1] - p[1]) * (x0 - p[0])) / (q[0] - p[0])]],
    [(p) => p[0] <= x1, (p, q) => [x1, p[1] + ((q[1] - p[1]) * (x1 - p[0])) / (q[0] - p[0])]],
    [(p) => p[1] >= z0, (p, q) => [p[0] + ((q[0] - p[0]) * (z0 - p[1])) / (q[1] - p[1]), z0]],
    [(p) => p[1] <= z1, (p, q) => [p[0] + ((q[0] - p[0]) * (z1 - p[1])) / (q[1] - p[1]), z1]]];
  for (const [inside, cut] of edges) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length], ip = inside(p), iq = inside(q);
      if (ip) out.push(p);
      if (ip !== iq) out.push(cut(p, q));
    }
    P = out; if (P.length < 3) return [];
  }
  const Q = []; for (const p of P) { const l = Q[Q.length - 1]; if (!l || Math.abs(l[0] - p[0]) > 1e-6 || Math.abs(l[1] - p[1]) > 1e-6) Q.push(p); }
  if (Q.length > 2 && Math.abs(Q[0][0] - Q[Q.length - 1][0]) < 1e-6 && Math.abs(Q[0][1] - Q[Q.length - 1][1]) < 1e-6) Q.pop();
  return Q;
}
/** a ground sheet: the plan ring laid on y = yfn(u, v) + lift, cut on a `cell` m grid (every vertex lifted; neighbouring
 *  sheets cut on the same grid meet exactly). UV = metres (ground cells). */
export function drape(B, key, ring, yfn, cell = 2, lift = 0) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const i0 = Math.floor(x0 / cell), i1 = Math.ceil(x1 / cell), j0 = Math.floor(z0 / cell), j1 = Math.ceil(z1 / cell);
  let n = 0;
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    const P = clipBox(ring, i * cell, j * cell, (i + 1) * cell, (j + 1) * cell); if (P.length < 3) continue;
    const tris = THREE.ShapeUtils.triangulateShape(P.map((p) => new THREE.Vector2(p[0], p[1])), []);
    for (const t of tris) {
      const q = t.map((k) => [P[k][0], yfn(P[k][0], P[k][1]) + lift, P[k][1]]);
      const up = (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]);
      if (Math.abs(up) < 1e-9) continue;
      const o = up > 0 ? [0, 1, 2] : [0, 2, 1];
      B.tri(key, q[o[0]], q[o[1]], q[o[2]], [q[o[0]][0], q[o[0]][2]], [q[o[1]][0], q[o[1]][2]], [q[o[2]][0], q[o[2]][2]]);
      n++;
    }
  }
  return n;
}
/** a block in a skew plan frame P(s, n) -> [u, v]: s0..s1 x n0..n1, bottom yb, top yt (numbers or functions of (s, n),
 *  linear between the corners: the top is cut into `seg` slices along n so a sloping top stays planar per slice) */
export function oblock(B, key, P, s0, s1, n0, n1, yb, yt, o = {}) {
  const fb = typeof yb === 'function' ? yb : () => yb, ft = typeof yt === 'function' ? yt : () => yt, seg = o.seg || 1;
  const V = (s, n, y) => { const p = P(s, n); return [p[0], y, p[1]]; };
  const c = P((s0 + s1) / 2, (n0 + n1) / 2), C = [c[0], 0, c[1]];
  const hint = (pts) => { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[2]; } return [x / pts.length - C[0], 0, z / pts.length - C[2]]; };
  for (let k = 0; k < seg; k++) {
    const na = n0 + ((n1 - n0) * k) / seg, nb = n0 + ((n1 - n0) * (k + 1)) / seg;
    if (o.top !== false) B.poly(o.topKey || key, [V(s0, na, ft(s0, na)), V(s1, na, ft(s1, na)), V(s1, nb, ft(s1, nb)), V(s0, nb, ft(s0, nb))], [0, 1, 0]);
    for (const s of [s0, s1]) { const q = [V(s, na, fb(s, na)), V(s, nb, fb(s, nb)), V(s, nb, ft(s, nb)), V(s, na, ft(s, na))]; B.poly(key, q, hint(q)); }
  }
  for (const n of [n0, n1]) { if (o.ends === false) continue; const q = [V(s0, n, fb(s0, n)), V(s1, n, fb(s1, n)), V(s1, n, ft(s1, n)), V(s0, n, ft(s0, n))]; B.poly(key, q, hint(q)); }
}
/** an iron handrail along 3D points [u, y, v] (the rail's own line), posts down `h` every ~`pitch` m, an optional mid rail */
export function rail(B, pts, h = 0.9, pitch = 1.4, mid = true) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    B.beam('ironBlack', a, b, 0.045, 0.035);
    if (mid) B.beam('ironBlack', [a[0], a[1] - h * 0.5, a[2]], [b[0], b[1] - h * 0.5, b[2]], 0.025);
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.round(L / pitch));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) { const t = k / n, x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), z = lerp(a[2], b[2], t); B.box('ironBlack', x, y - h / 2, z, 0.03, h, 0.03); }
  }
}
let seed = 7;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const inRing = (u, v, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const p = ring[i], q = ring[j]; if ((p[1] > v) !== (q[1] > v) && u < ((q[0] - p[0]) * (v - p[1])) / (q[1] - p[1]) + p[0]) c = !c; } return c; };

// ------------------------------------------------------------------------------------------------ the Mound's shapes
/** the bank: lawn level at its foot, the walk's level at its top, an S-curve between (topo spot levels) */
export function bankY(u, v) {
  const dF = distLine(BANK.foot, u, v), dT = distLine(BANK.top, u, v), t = dF / (dF + dT + 1e-9);
  return lerp(groundY(u, v), walkY(u, v), smooth(0, 1, t));
}
export const bankRing = () => [...BANK.foot, ...BANK.top.slice().reverse()];
/** the square wall's inner face meets stair 2's north wall (inner face, lateral -clear/2) at this x of stair 2's frame */
const sqInner = () => { const a = WALL.line[3]; return [a[0] - 0.3 * E2[0], a[1] - 0.3 * E2[1]]; };
const X_END = (() => { const q = sqInner(); return (q[0] - P2(0, 0)[0]) * E2[0] + (q[1] - P2(0, 0)[1]) * E2[1]; })();
/** the wall's centre line offset by d towards the garden (miter joins) */
export function offsetLine(line, d) {
  const nrm = []; for (let i = 0; i < line.length - 1; i++) { const [a, b] = [line[i], line[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); nrm.push([(b[1] - a[1]) / L, -(b[0] - a[0]) / L]); }
  return line.map((p, i) => {
    if (i === 0) return [p[0] + nrm[0][0] * d, p[1] + nrm[0][1] * d];
    if (i === line.length - 1) return [p[0] + nrm[i - 1][0] * d, p[1] + nrm[i - 1][1] * d];
    const m = [nrm[i - 1][0] + nrm[i][0], nrm[i - 1][1] + nrm[i][1]], k = d / (1 + nrm[i - 1][0] * nrm[i][0] + nrm[i - 1][1] * nrm[i][1]);
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
}
/** the plateau (walk and its planting) as one ring */
export function plateauRing() {
  const inn = offsetLine(WALL.line, 0.3);
  const r = [...BANK.top, P2(ST2.landTo, ST2.clear / 2 + ST2.sKerb), P2(ST2.landTo, -ST2.clear / 2), P2(X_END, -ST2.clear / 2)];
  r.push(inn[2], inner(84.0, 0.3), P1(ST1.s0, 0.3), P1(ST1.s0, ST1.nTop));
  // (inn[2] is the inner corner at Radcliffe Square; the lane's two segments are nearly straight: inner(84) is their joint)
  return r;
}
/** the walk as a band ring from WALK (centre points with half-widths) */
export function walkRing() {
  const L = [], R = [];
  for (let i = 0; i < WALK.length; i++) {
    const p = WALK[i], a = WALK[Math.max(0, i - 1)], b = WALK[Math.min(WALK.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    L.push([p[0] + dz * p[2], p[1] - dx * p[2]]); R.push([p[0] - dz * p[2], p[1] + dx * p[2]]);
  }
  return [...L, ...R.reverse()];
}

// ------------------------------------------------------------------------------------------------ the ground
export function buildGround(ctx) {
  const { B, pack } = ctx, gc = pack.groundCells;
  // two ground cells of my own at a LOW depth layer, so the lawn / walk laid 2 cm over them wins at any distance
  const low = (key, from, layer, tint) => { if (gc && !gc.has(key) && gc.get(from)) gc.set(key, { ...gc.get(from), layer, tint: tint || gc.get(from).tint }); return gc && gc.has(key) ? key : from; };
  // (the planted bank and the Mound's beds: the city's flowerbed darkened and greened: ivy and shrubs under the bushes, not a
  //  bed of flowers; the beds on the lawn keep the flowerbed as it is)
  const gravelLow = low('gardenGravel', 'gravel', 1), bedLow = low('gardenBed', 'flowerbed', 2, [0.5, 0.62, 0.42]);
  K.addCell(pack, 'gardenRubble', 'rubble', [0.84, 0.81, 0.75], { seed: 2.1 });
  K.addCell(pack, 'gardenCoping', 'stone', [0.8, 0.77, 0.7], { seed: 2.4 });
  K.addCell(pack, 'ironRust', 'lead', 0x4a3326);
  const ring = GARDEN_RING();
  drape(B, gravelLow, ring, groundY, 2);
  drape(B, 'lawn', LAWN, groundY, 2, LIFT.lawn);
  for (const b of BEDS) drape(B, bedLow, b, groundY, 2, LIFT.bed);      // (dark mulch under the shrubs: the city's flower-bed cell, darkened)
  ctx.floor(ring, (u, v) => groundY(u, v) + LIFT.lawn);
  // the Mound: the bank, the plateau (planting) and the walk over it
  const bank = bankRing(), plat = plateauRing(), walk = walkRing();
  drape(B, bedLow, bank, bankY, 1);
  drape(B, bedLow, plat, walkY, 1.5);
  drape(B, 'gravel', walk, walkY, 1.5, LIFT.walk);
  ctx.floor(bank, bankY);
  ctx.floor(plat, (u, v) => walkY(u, v) + LIFT.walk);
  return { ring, bank, plat, walk };
}

// ------------------------------------------------------------------------------------------------ the boundary wall
const laneY = (u) => interp(LANE, u), squareY = (v) => interp(SQUARE, v);
/** coping top (y) at a point of the centre line on segment k */
function copY(k, u, v) {
  if (k < 2) return u <= WALL.uShed ? lerp(WALL.copWest, WALL.copShed, (u - WALL.line[0][0]) / (WALL.uShed - WALL.line[0][0])) : Math.min(WALL.copShed, walkY(u, v - 1.3) + WALL.parapet);
  return Math.max(WALL.copWest + 0.2, walkY(95.5, v) + WALL.parapet + 0.02);
}
export function buildWall(ctx) {
  const { B } = ctx, t = WALL.t, line = WALL.line, out = offsetLine(line, -t / 2), inn = offsetLine(line, t / 2);
  const outC = offsetLine(line, -t / 2 - WALL.coping.over), innC = offsetLine(line, t / 2 + WALL.coping.over), ch = WALL.coping.h;
  let S = 0; const corner = line[2];
  for (let k = 0; k < line.length - 1; k++) {
    const a = line[k], b = line[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 2));
    const outside = (u, v) => (k < 2 ? laneY(u) : squareY(v));
    // cut points: even steps, plus the quoins' edges at the corner
    const ts = []; for (let i = 0; i <= n; i++) ts.push(i / n);
    if (k === 1) ts.push(1 - WALL.quoin / L); if (k === 2) ts.push(WALL.quoin / L);
    ts.sort((x, y) => x - y);
    const at = (P, tt) => [lerp(P[k][0], P[k + 1][0], tt), lerp(P[k][1], P[k + 1][1], tt)];
    for (let i = 0; i < ts.length - 1; i++) {
      const t0 = ts[i], t1 = ts[i + 1]; if (t1 - t0 < 1e-4) continue;
      const c0 = at(line, t0), c1 = at(line, t1), y0 = copY(k, c0[0], c0[1]), y1 = copY(k, c1[0], c1[1]);
      const f0 = Math.min(outside(c0[0], c0[1]), -0.3) - WALL.foot, f1 = Math.min(outside(c1[0], c1[1]), -0.3) - WALL.foot;
      const o0 = at(out, t0), o1 = at(out, t1), i0 = at(inn, t0), i1 = at(inn, t1), s0 = S + t0 * L, s1 = S + t1 * L;
      const nearCorner = Math.hypot((c0[0] + c1[0]) / 2 - corner[0], (c0[1] + c1[1]) / 2 - corner[1]) < WALL.quoin;
      const key = nearCorner ? 'bathOld' : 'gardenRubble';
      const mid = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2], ho = [(o0[0] + o1[0]) / 2 - mid[0], 0, (o0[1] + o1[1]) / 2 - mid[1]], hi = [-ho[0], 0, -ho[2]];
      B.poly(key, [[o0[0], f0, o0[1]], [o1[0], f1, o1[1]], [o1[0], y1 - ch, o1[1]], [o0[0], y0 - ch, o0[1]]], ho, [[s0, f0], [s1, f1], [s1, y1 - ch], [s0, y0 - ch]]);
      B.poly(nearCorner ? 'bathOld' : 'gardenRubble', [[i0[0], f0, i0[1]], [i1[0], f1, i1[1]], [i1[0], y1 - ch, i1[1]], [i0[0], y0 - ch, i0[1]]], hi, [[s0, f0], [s1, f1], [s1, y1 - ch], [s0, y0 - ch]]);
      // the coping slab: top, both edges, the overhangs' undersides
      const p0 = at(outC, t0), p1 = at(outC, t1), q0 = at(innC, t0), q1 = at(innC, t1);
      B.poly('gardenCoping', [[p0[0], y0, p0[1]], [p1[0], y1, p1[1]], [q1[0], y1, q1[1]], [q0[0], y0, q0[1]]], [0, 1, 0], [[s0, 0], [s1, 0], [s1, t + 0.12], [s0, t + 0.12]]);
      B.poly('gardenCoping', [[p0[0], y0 - ch, p0[1]], [p1[0], y1 - ch, p1[1]], [p1[0], y1, p1[1]], [p0[0], y0, p0[1]]], ho, [[s0, 0], [s1, 0], [s1, ch], [s0, ch]]);
      B.poly('gardenCoping', [[q0[0], y0 - ch, q0[1]], [q1[0], y1 - ch, q1[1]], [q1[0], y1, q1[1]], [q0[0], y0, q0[1]]], hi, [[s0, 0], [s1, 0], [s1, ch], [s0, ch]]);
      B.poly('gardenCoping', [[p0[0], y0 - ch, p0[1]], [p1[0], y1 - ch, p1[1]], [o1[0], y1 - ch, o1[1]], [o0[0], y0 - ch, o0[1]]], [0, -1, 0]);
      B.poly('gardenCoping', [[q0[0], y0 - ch, q0[1]], [q1[0], y1 - ch, q1[1]], [i1[0], y1 - ch, i1[1]], [i0[0], y0 - ch, i0[1]]], [0, -1, 0]);
      // a slab joint every segment: a slightly proud cap stone joint reads as a line across the coping
      B.box('gardenCoping', c1[0], y1 + 0.005, c1[1], 0.04, 0.012, t + 0.12, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), { bottom: false });
    }
    // colliders: the wall's footprint
    ctx.solid([out[k], out[k + 1], inn[k + 1], inn[k]]);
    S += L;
  }
  // the two ends (against the east range and the Bodleian): end caps
  for (const [i, j] of [[0, 1], [line.length - 1, line.length - 2]]) {
    const o = out[i], n = inn[i], k = i === 0 ? 0 : line.length - 2, y = copY(k, line[i][0], line[i][1]);
    const d = [line[i][0] - line[j][0], 0, line[i][1] - line[j][1]];
    B.poly('rubble', [[o[0], -1.2, o[1]], [n[0], -1.2, n[1]], [n[0], y, n[1]], [o[0], y, o[1]]], d);
  }
  buildIron(ctx);
  buildLaneDoor(ctx, out, inn);
}
/** the X tie and the square plates on the lane face (east segment) */
function buildIron(ctx) {
  const { B } = ctx, [a, b] = [WALL.line[1], WALL.line[2]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const outN = [-d[1], d[0]];                                     // outward (south)
  const face = (u, off) => { const tt = (u - a[0]) / (b[0] - a[0]), c = [lerp(a[0], b[0], tt), lerp(a[1], b[1], tt)]; return [c[0] + outN[0] * (WALL.t / 2 + off), c[1] + outN[1] * (WALL.t / 2 + off)]; };
  const X = IRON.x, c = face(X.u, 0.03), y = laneY(X.u) + X.up;
  for (const sg of [-1, 1]) {
    const p = [c[0] - d[0] * (X.w / 2) * sg, y - X.h / 2, c[1] - d[1] * (X.w / 2) * sg], q = [c[0] + d[0] * (X.w / 2) * sg, y + X.h / 2, c[1] + d[1] * (X.w / 2) * sg];
    B.beam('ironRust', p, q, X.bar, 0.04);
  }
  B.cyl('ironBlack', c[0], y - 0.06, c[1], 0.07, 0.12, 8);
  const ry = Math.atan2(-d[1], d[0]);
  for (const [u, up, w] of IRON.plates) { const p = face(u, 0.015); B.box('ironRust', p[0], laneY(u) + up, p[1], w, w * 1.1, 0.03, ry); }
}
/** the small door at the garden's south-west corner: a boarded leaf on both faces under a stone lintel; two steps inside */
function buildLaneDoor(ctx, out, inn) {
  const { B } = ctx, D = LANE_DOOR, ry = Math.atan2(-A1[1], A1[0]), y0 = laneY(D.u) - 0.02;
  for (const [ring, sg] of [[out, -1], [inn, 1]]) {
    const v = ring[0][1] + (D.u - ring[0][0]) * (A1[1] / A1[0]), p = [D.u - sg * N1[0] * 0.02, v - sg * N1[1] * 0.02];
    B.box('oakDoor', p[0], y0 + D.h / 2, p[1], D.w, D.h, 0.06, ry);
    B.box('bathOld', p[0], y0 + D.h + 0.14, p[1], D.w + 0.5, 0.28, 0.08, ry);
    B.box('bathOld', p[0], y0 - 0.04, p[1], D.w + 0.2, 0.08, 0.12, ry);
  }
  // two steps down into the garden (lane 64.85, garden 64.4 - 64.6)
  const g = groundY(D.u, 30.6), rise = (y0 - g) / 3;
  for (let i = 1; i <= 2; i++) {
    const n0 = WALL.t / 2 + (i - 1) * 0.32, n1 = n0 + 0.32;
    oblock(B, 'pavingSolid', (s, n) => [D.u + s * A1[0] + n * N1[0], WALL.line[0][1] + (D.u - WALL.line[0][0]) * (A1[1] / A1[0]) + s * A1[1] + n * N1[1]], -D.w / 2 - 0.1, D.w / 2 + 0.1, n0, n1, g - 0.1, y0 - rise * i);
  }
}

// ------------------------------------------------------------------------------------------------ the stairs and the shed
const st1N = (i) => ST1.nTop + i * ST1.going;           // the edge of tread i (0 = the top)
const st1Rise = () => (ST1.yTop - ST1.yFoot) / ST1.risers;
/** stair 1's walking level at n (treads), its nosing line (for walls and rails) */
export const st1Y = (n) => (n < ST1.nTop ? ST1.yTop : n >= st1N(ST1.risers - 1) ? ST1.yFoot : ST1.yTop - st1Rise() * (Math.floor((n - ST1.nTop) / ST1.going) + 1));
const st1Nose = (n) => ST1.yTop - ((n - ST1.nTop) / ST1.going) * st1Rise();
export const st2Y = (x) => (x < 0 ? ST2.yFoot : x >= (ST2.risers - 1) * ST2.going ? ST2.yTop : ST2.yFoot + ST2.rise * (Math.floor(x / ST2.going) + 1));
const st2Nose = (x) => ST2.yFoot + ST2.rise + (x / ST2.going) * ST2.rise;

export function buildStairs(ctx) {
  const { B } = ctx, R = st1Rise(), nFoot = st1N(ST1.risers - 1), sc = ST1.s0 + ST1.wall, sd = ST1.s1 - ST1.wall;
  // STAIR 1: treads, side walls with a sloping coping, foot piers, a rounded landing at the foot, handrails
  for (let i = 1; i < ST1.risers; i++) oblock(B, 'pavingSolid', P1, sc, sd, st1N(i - 1), st1N(i), ST1.yFoot - 0.2, ST1.yTop - R * i);
  const wallTop = (s, n) => Math.min(ST1.yTop + 0.3, st1Nose(n) + ST1.kerb);
  for (const [a, b] of [[ST1.s0, sc], [sd, ST1.s1]]) {
    oblock(B, 'rubble', P1, a, b, ST1.nTop, nFoot, (s, n) => groundY(...P1(s, n)) - 0.4, wallTop, { seg: 6, topKey: 'bathOld' });
    oblock(B, 'bathOld', P1, a - 0.03, b + 0.03, nFoot, nFoot + 0.45, (s, n) => groundY(...P1(s, n)) - 0.3, ST1.yFoot + 1.05);
    K.coneRoof(B, 'bathOld', [P1(a - 0.05, nFoot - 0.02), P1(b + 0.05, nFoot - 0.02), P1(b + 0.05, nFoot + 0.47), P1(a - 0.05, nFoot + 0.47)].reverse(), ST1.yFoot + 1.05, P1((a + b) / 2, nFoot + 0.225), 0.16);
    const rs = (a + b) / 2, r0 = P1(rs, ST1.nTop - 0.1), r1 = P1(rs, nFoot - 0.05);
    rail(B, [[r0[0], ST1.yTop + 0.3 + 0.85, r0[1]], [r1[0], st1Nose(nFoot) + 0.85 + 0.2, r1[1]]], 0.85);
    ctx.solid([P1(a, ST1.nTop), P1(b, ST1.nTop), P1(b, nFoot + 0.45), P1(a, nFoot + 0.45)]);
  }
  { const pts = []; for (let k = 0; k <= 10; k++) { const a = (Math.PI * k) / 10; pts.push(P1(Math.cos(a) * ST1.apronR * 0.95, nFoot + Math.sin(a) * ST1.apronR)); } pts.push(P1(-0.95, nFoot)); K.prism(B, 'pavingSolid', pts, ST1.yFoot - 0.35, ST1.yFoot + 0.03, { top: true }); ctx.floor(pts, ST1.yFoot + 0.03); }
  ctx.floor([P1(sc, ST1.nTop), P1(sd, ST1.nTop), P1(sd, nFoot), P1(sc, nFoot)], (u, v) => { const n = (u - P1(0, 0)[0]) * N1[0] + (v - P1(0, 0)[1]) * N1[1]; return st1Y(n); });

  // STAIR 2: treads, the landing, the leaning retaining wall on the north, a kerb wall on the south, piers, handrails
  const c0 = -ST2.clear / 2, c1 = ST2.clear / 2, xL = (ST2.risers - 1) * ST2.going;
  for (let k = 1; k < ST2.risers; k++) oblock(B, 'pavingSolid', P2, (k - 1) * ST2.going, k * ST2.going, c0, c1, ST2.yFoot - 0.2, ST2.yFoot + ST2.rise * k);
  oblock(B, 'pavingSolid', P2, xL, ST2.landTo, c0, c1, ST2.yFoot - 0.2, ST2.yTop);
  oblock(B, 'pavingSolid', P2, -0.9, 0, c0 - 0.1, c1 + 0.1, ST2.yFoot - 0.2, ST2.yFoot + 0.03);
  // (in P2's frame the block's "s" is x along the stair and its "n" the lateral)
  const PX = (x, l) => P2(x, l);
  const northTop = (x) => interp([[-0.35, ST2.yFoot + 0.4], [xL, ST2.yTop + 0.28], [ST2.landTo, ST2.yTop + 0.6], [6.6, ST2.yTop + 0.98], [X_END, copY(2, 97, 21) - WALL.coping.h]], x);
  oblock(B, 'rubble', (l, x) => PX(x, l), c0 - ST2.nWall, c0, -0.35, X_END, (l, x) => groundY(...PX(x, l)) - 0.4, (l, x) => northTop(x), { seg: 10, topKey: 'bathOld' });
  oblock(B, 'rubble', (l, x) => PX(x, l), c1, c1 + ST2.sKerb, -0.35, ST2.landTo, (l, x) => groundY(...PX(x, l)) - 0.4, (l, x) => Math.min(ST2.yTop + 0.3, st2Nose(Math.max(0, x)) + 0.25), { seg: 6, topKey: 'bathOld' });
  for (const [a, b] of [[c0 - ST2.nWall - 0.03, c0 + 0.03], [c1 - 0.03, c1 + ST2.sKerb + 0.03]]) {
    oblock(B, 'bathOld', (l, x) => PX(x, l), a, b, -0.8, -0.35, (l, x) => groundY(...PX(x, l)) - 0.3, ST2.yFoot + 1.05);
    K.coneRoof(B, 'bathOld', [PX(-0.82, a - 0.02), PX(-0.82, b + 0.02), PX(-0.33, b + 0.02), PX(-0.33, a - 0.02)], ST2.yFoot + 1.05, PX(-0.575, (a + b) / 2), 0.16);
  }
  for (const l of [c0 + 0.06, c1 - 0.06]) {
    const p = (x) => { const q = PX(x, l); return [q[0], st2Nose(x) + 0.9, q[1]]; };
    rail(B, [p(-0.2), p(xL), [PX(ST2.landTo - 0.3, l)[0], ST2.yTop + 0.9, PX(ST2.landTo - 0.3, l)[1]]], 0.9, 1.2, false);
  }
  ctx.solid([PX(-0.8, c0 - ST2.nWall), PX(X_END, c0 - ST2.nWall), PX(X_END, c0), PX(-0.8, c0)]);
  ctx.floor([PX(-0.9, c0), PX(ST2.landTo, c0), PX(ST2.landTo, c1), PX(-0.9, c1)], (u, v) => { const x = (u - O2x()) * E2[0] + (v - O2z()) * E2[1]; return x < 0 ? ST2.yFoot + 0.03 : st2Y(x); });

  // THE SHED: a rubble box against the lane wall, its flat roof part of the walk, a low parapet and railings N and W
  const g = (s, n) => groundY(...P1(s, n)) - 0.4;
  oblock(B, 'rubble', P1, SHED.s0, SHED.s1, SHED.n0, SHED.n1, g, SHED.roof, { topKey: 'pavingSolid', seg: 2 });
  oblock(B, 'rubble', P1, SHED.s0, SHED.s1, SHED.n1 - 0.25, SHED.n1, SHED.roof, SHED.roof + SHED.parapet, { topKey: 'bathOld' });
  oblock(B, 'rubble', P1, SHED.s0, SHED.s0 + 0.25, SHED.n0, SHED.n1 - 0.25, SHED.roof, SHED.roof + SHED.parapet, { topKey: 'bathOld' });
  { const D = SHED.door, yd = groundY(...P1(D.s, SHED.n1 + 0.3));
    oblock(B, 'oakDoor', P1, D.s - D.w / 2, D.s + D.w / 2, SHED.n1, SHED.n1 + 0.03, yd, yd + D.h);
    oblock(B, 'bathOld', P1, D.s - D.w / 2 - 0.15, D.s + D.w / 2 + 0.15, SHED.n1, SHED.n1 + 0.06, yd + D.h, yd + D.h + 0.22); }
  { const yr = SHED.roof + SHED.parapet + 0.8, a = P1(SHED.s1 - 0.05, SHED.n1 - 0.12), b = P1(SHED.s0 + 0.12, SHED.n1 - 0.12), c = P1(SHED.s0 + 0.12, SHED.n0 + 0.15);
    rail(B, [[a[0], yr, a[1]], [b[0], yr, b[1]], [c[0], yr, c[1]]], 0.8, 1.3, true); }
  ctx.solid([P1(SHED.s0, SHED.n0), P1(SHED.s1, SHED.n0), P1(SHED.s1, SHED.n1), P1(SHED.s0, SHED.n1)]);
  ctx.floor([P1(SHED.s0, SHED.n0), P1(SHED.s1, SHED.n0), P1(SHED.s1, SHED.n1), P1(SHED.s0, SHED.n1)], SHED.roof);
}
const O2x = () => P2(0, 0)[0], O2z = () => P2(0, 0)[1];

// ------------------------------------------------------------------------------------------------ pond, plants, benches
export function buildPond(ctx) {
  const { B } = ctx, P = POND, c = P.ring.reduce((a, p) => [a[0] + p[0] / P.ring.length, a[1] + p[1] / P.ring.length], [0, 0]);
  const top = P.y + P.kerbH, water = top - P.water;
  K.parapet(B, 'bathOld', [...P.ring, P.ring[0]], water - 0.35, top - (water - 0.35), P.kerbW, {});
  const inner = P.ring.map((p) => { const dx = p[0] - c[0], dz = p[1] - c[1], l = Math.hypot(dx, dz); return [p[0] - (dx / l) * P.kerbW * 0.5, p[1] - (dz / l) * P.kerbW * 0.5]; });
  B.flat('glassDark', inner, water);
  ctx.solid(P.ring.map((p) => { const dx = p[0] - c[0], dz = p[1] - c[1], l = Math.hypot(dx, dz); return [p[0] + (dx / l) * P.kerbW * 0.5, p[1] + (dz / l) * P.kerbW * 0.5]; }));
}
export function buildPlants(ctx, shapes) {
  const { B } = ctx;
  TREES.forEach(([u, v, h, r], i) => { const y = inRing(u, v, shapes.plat) ? walkY(u, v) : inRing(u, v, shapes.bank) ? bankY(u, v) : groundY(u, v); K.tree(B, u, v, y, h, r, 11 + i * 7); });
  seed = 7;
  let n = 0, tris = 0;
  const pick = (mix) => { const e = Object.entries(mix), t = e.reduce((a, [, w]) => a + w, 0); let x = rnd() * t; for (const [k, w] of e) { x -= w; if (x <= 0) return k; } return e[0][0]; };
  /** sow a ring on a jittered grid with a plan's planting spec (PLANTING: kinds, sizes, spacing, lod) */
  const sow = (ring, yfn, P, avoid, near) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let x = x0; x < x1; x += P.every) for (let z = z0; z < z1; z += P.every) {
      const u = x + rnd() * P.every, v = z + rnd() * P.every;
      if (!inRing(u, v, ring) || (avoid && avoid(u, v))) continue;
      const Q = near && near.test(u, v) ? near : P, kind = pick(Q.mix), t = rnd(), r = lerp(Q.r[0], Q.r[1], t), h = lerp(Q.h[0], Q.h[1], Math.min(1, t * 0.7 + rnd() * 0.5));
      if (distLine(WALL.line, u, v) < WALL.t / 2 + r * 0.8 + 0.1 || (P.keep && P.keep(u, v, r))) continue;
      tris += shrub(ctx, u, yfn(u, v), v, { kind, r, h, lod: Q.lod, seed: 100 + n * 7.3, blooms: Q.blooms }); n++;
    }
  };
  const nearTree = (d) => (u, v) => TREES.some(([a, b]) => Math.hypot(a - u, b - v) < d);
  const onWalk = (u, v) => nearTree(1.0)(u, v);
  // no crown over the walk or either stair (tools/exeter_walk.mjs found one over stair 2's head): the centre far enough
  // from their edges that a crown leans over their side walls at most
  const st1 = [P1(0, ST1.nTop - 0.3), P1(0, ST1.nTop + (ST1.risers - 1) * ST1.going + 1.0)], st2 = [P2(-1.0, 0), P2(ST2.landTo, 0)], ww = WALK.map((p) => [p[0], p[1]]);
  const keep = (u, v, r) => distLine(ww, u, v) < 0.85 + r * 0.6 || distLine(st1, u, v) < 1.0 + r * 0.5 || distLine(st2, u, v) < ST2.clear / 2 + 0.35 + r * 0.5;
  for (const k of ['bank', 'bankFoot', 'plateau']) PLANTING[k].keep = keep;
  const PL = PLANTING;
  // the Mound's bank: big mixed shrubs, lower flowering plants and ferns along its foot (09 simononly 2012, zh-wiki c2005)
  sow(shapes.bank, bankY, PL.bank, nearTree(1.0), { ...PL.bankFoot, test: (u, v) => distLine(BANK.foot, u, v) < PL.bankFoot.band });
  sow(shapes.plat, walkY, PL.plateau, onWalk);
  // (the Library's bed: no shrub's centre in front of a buttress (they stand 0.72 out on the surveyed face))
  const libA = (u, v) => (u - LIB.o[0]) * Math.cos(LIB.th) + (v - LIB.o[1]) * Math.sin(LIB.th);
  const onButt = (u, v) => LIB.butA.some((a) => Math.abs(libA(u, v) - a) < LIB.butW / 2 + 0.3);
  for (const b of [BEDS[0], BEDS[3]]) sow(b, groundY, PL.library, (u, v) => nearTree(0.9)(u, v) || onButt(u, v));
  sow(BEDS[1], groundY, PL.lane, nearTree(0.9));
  sow(BEDS[2], groundY, PL.bay, nearTree(0.9));
  return { n, tris };
}
export function buildBenches(ctx) {
  const { B } = ctx;
  for (const [u, v, fu, fv] of BENCHES) K.bench(B, u, v, groundY(u, v) + LIFT.lawn, Math.atan2(fu - u, fv - v), 1.8);
  K.bench(B, VIEW_BENCH[0], VIEW_BENCH[1], walkY(VIEW_BENCH[0], VIEW_BENCH[1]) + LIFT.walk, Math.atan2(1, 0.06), 1.6);
}
