// Shared helpers for the batch-6 landmarks (high_street.js, st_giles.js) — see docs/research/landmarks_batch6.md.
// Everything is drawn in the ONE batch-5 atlas draw (_b5_kit.js shared(game): the same LOD buffer, the same material,
// rows 5-6 of its atlas painted by _b6_cells.js). This file adds the street-front pieces those modules need:
//   frontRect     a building rectangle from a mapped street edge (side 0 = the street face)
//   sideFrame     the wall frame of one side of a rect (local x along, +z out), as _b5_kit.js range() uses
//   facade        a wall face in storey bands (each band its own key: rustication under ashlar), windows as holes with
//                 reveals and atlas units (q 0), or flat units 3 cm proud (q 1 / 2), strings, cornices, pilasters
//   pediment      a triangular pediment with raking cornices in the wall plane
//   balustrade    a balustrade (the painted balus cell on a solid slab, coping and plinth)
//   gableRow      wall-plane gables standing up from an eave (Univ's attics), with a window in each
//   pinnacle      a square pinnacle (shaft + crocketed spirelet)
import { frame, rectPts, archPts, pointPts, rect, corners, at, h01, TAU } from './_b5_kit.js';

export { frame, rectPts, archPts, pointPts, rect, corners, at, h01, TAU };

/** rect from a street edge A->B (mapped wall corners) and a depth; side 0 (+v) faces the point `street` */
export function frontRect(A, B, depth, street, o = {}) {
  let a = Math.atan2(B[1] - A[1], B[0] - A[0]);
  const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
  let vx = -Math.sin(a), vz = Math.cos(a);
  if (vx * (street[0] - mx) + vz * (street[1] - mz) < 0) { a += Math.PI; vx = -vx; vz = -vz; }
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]) + (o.ext || 0) * 2, fwd = o.fwd || 0;
  const cx = mx - vx * (depth / 2 - fwd), cz = mz - vz * (depth / 2 - fwd);
  return rect(cx, cz, a, L, depth + fwd);
}
/** the frame data of side i of rect R: [+v, -v, +u, -u] -> {m:[x,z], a:[x,z], L, n:[x,z]} (as range()) */
export function sideFrame(R, i) {
  const ux = Math.cos(R.a), uz = Math.sin(R.a), vx = -uz, vz = ux, hl = R.L / 2, hw = R.W / 2;
  return [
    { m: [R.cx + vx * hw, R.cz + vz * hw], a: [ux, uz], L: R.L, n: [vx, vz] },
    { m: [R.cx - vx * hw, R.cz - vz * hw], a: [-ux, -uz], L: R.L, n: [-vx, -vz] },
    { m: [R.cx + ux * hl, R.cz + uz * hl], a: [-vx, -vz], L: R.W, n: [ux, uz] },
    { m: [R.cx - ux * hl, R.cz - uz * hl], a: [vx, vz], L: R.W, n: [-ux, -uz] },
  ][i];
}
/** the side of R whose outward normal points most towards pt (as seen from R's centre) */
export function sideToward(R, pt) {
  let best = 0, bd = -Infinity;
  for (let i = 0; i < 4; i++) { const F = sideFrame(R, i), d = F.n[0] * (pt[0] - R.cx) + F.n[1] * (pt[1] - R.cz); if (d > bd) { bd = d; best = i; } }
  return best;
}
export const pushSide = (B, R, i, y = 0) => { const F = sideFrame(R, i); B.push(frame(F.m[0], y, F.m[1], F.a[0], F.a[1])); return F; };
/** a world point from a side's local (x along, z out) */
export function sidePt(R, i, x, z = 0) { const F = sideFrame(R, i); return [F.m[0] + F.a[0] * x + F.n[0] * z, F.m[1] + F.a[1] * x + F.n[1] * z]; }

/** window op helper: {x, y0, y1, key, w, shape, rec} -> with its outline */
export function op(x, y0, y1, key, w, shape = 'rect', o = {}) {
  const pts = shape === 'point' ? pointPts(x, w, y0, y1 - w * 0.7) : shape === 'round' ? archPts(x, w, y0, y1 - w / 2, 8) : rectPts(x - w / 2, y0, x + w / 2, y1);
  return { x, y0, y1, key, w, shape, pts, ...o };
}
/** evenly spaced x positions of n bays over length L (centred) */
export const bays = (n, step) => Array.from({ length: n }, (_, k) => -((n - 1) * step) / 2 + k * step);

/**
 * A wall face in the current frame (local x along, y up, +z out) from x = -L/2..L/2:
 * spec = {L, bands: [[y0, y1, key]], ops: [op], strings: [[y, h, d, key]], pilasters: {xs, w, d, y0, y1, key},
 *         dress, cornice: [y, h, d]}
 * ops must lie inside one band. q 0: holes + reveals + recessed units; q > 0: a quad per band and units proud.
 */
export function facade(B, s, q = 0) {
  const L = s.L, dress = s.dress || 'dress', ops = s.ops || [];
  for (const [y0, y1, key] of s.bands) {
    const mine = ops.filter((o) => o.y0 >= y0 - 1e-6 && o.y0 < y1 - 1e-6);
    if (q === 0 && mine.length) {
      B.face(key, rectPts(-L / 2, y0, L / 2, y1), mine.map((o) => o.pts), 0);
      for (const o of mine) {
        const rec = o.rec ?? 0.22;
        if (!o.noReveal) B.reveal(o.revKey || dress, o.pts, 0, -rec, !!o.open);
        if (o.key) B.unit(o.key, o.pts, -rec, [((o.x * 7 + y0) | 0) & 127, o.y0 < 4 ? 0 : 1]);
      }
    } else {
      B.poly(key, [[-L / 2, y0, 0], [L / 2, y0, 0], [L / 2, y1, 0], [-L / 2, y1, 0]], [0, 0, 1], [[-L / 2, y0], [L / 2, y0], [L / 2, y1], [-L / 2, y1]]);
      for (const o of mine) if (q < 2 || o.w >= 1.6 || s.farWin) B.unit(o.key || o.farKey || 'shade', o.pts, 0.03, [((o.x * 7 + y0) | 0) & 127, o.y0 < 4 ? 0 : 1]);
    }
  }
  if (q < 2) {
    for (const o of ops) if (o.y0 > 0.5 && !o.noSill) B.box(dress, o.x, o.y0 - 0.08, 0.08, o.w + 0.24, 0.12, 0.16, 0, { bottom: true });
    for (const o of ops) if (o.hood && q === 0) B.box(dress, o.x, o.y1 + 0.1, 0.07, o.w + 0.36, 0.14, 0.14, 0, { bottom: true });
    if (s.pilasters) { const P = s.pilasters; for (const x of P.xs) { B.box(P.key || dress, x, (P.y0 + P.y1) / 2, P.d / 2, P.w, P.y1 - P.y0, P.d, 0, { top: true }); if (P.cap) B.box(dress, x, P.y1 - 0.12, P.d / 2 + 0.03, P.w + 0.18, 0.24, P.d + 0.06, 0, { bottom: true }); } }
  }
  for (const [y, h, d, key] of s.strings || []) if (q < 2 || h >= 0.4) B.box(key || dress, 0, y, d / 2, L + d * 2, h, d, 0, { bottom: true });
  if (s.cornice) { const [y, h, d] = s.cornice; B.box(dress, 0, y + h / 2, d / 2, L + 2 * d, h, d, 0, { bottom: true }); }
}
/** pediment on the current frame's face: base at y, span L (centred), rise h; tympanum flush, raking cornices proud */
export function pediment(B, L, y, h, key, dress, q, o = {}) {
  B.poly(key, [[-L / 2, y, 0], [L / 2, y, 0], [0, y + h, 0]], [0, 0, 1], [[-L / 2, y], [L / 2, y], [0, y + h]]);
  const d = o.d ?? 0.45, t = o.t ?? 0.38;
  // raking cornices: slabs along each slope (their outer face proud by d), and the horizontal cornice
  for (const sg of [-1, 1]) {
    const a = [sg * (L / 2 + 0.25), y - 0.05, d], b = [0, y + h + 0.32, d], c = [0, y + h + 0.32, -0.3], dd = [sg * (L / 2 + 0.25), y - 0.05, -0.3];
    B.poly(dress, [a, b, [b[0], b[1] - t, b[2]], [a[0], a[1] - t, a[2]]], [0, 0, 1]);
    B.poly(dress, [a, b, c, dd], [sg * Math.sin(Math.atan2(h, L / 2)), Math.cos(Math.atan2(h, L / 2)), 0]);
    B.poly(dress, [[a[0], a[1] - t, a[2]], [b[0], b[1] - t, b[2]], [b[0], b[1] - t, 0.01], [a[0], a[1] - t, 0.01]], [-sg * 0.4, -1, 0]);
  }
  if (!o.noBase) B.box(dress, 0, y - 0.05 - 0.22, d / 2, L + 0.5, 0.44, d, 0, { bottom: true });
  if (q === 0 && o.acroteria) for (const [x, yy] of [[-L / 2, y + 0.3], [L / 2, y + 0.3], [0, y + h + 0.5]]) B.box(dress, x, yy + 0.3, 0.05, 0.6, 0.6, 0.6, 0, {});
}
/** balustrade on the current frame from x0 to x1 at y (height hgt), standing back `z` from the face */
export function balustrade(B, x0, x1, y, hgt, z, q, key = 'balus', dress = 'dress') {
  const L = x1 - x0;
  if (q === 2) { B.box(dress, (x0 + x1) / 2, y + hgt / 2, z, L, hgt, 0.3, 0, { top: true }); return; }
  B.poly(key, [[x0, y, z + 0.15], [x1, y, z + 0.15], [x1, y + hgt, z + 0.15], [x0, y + hgt, z + 0.15]], [0, 0, 1], [[0, 0], [L, 0], [L, hgt], [0, hgt]]);
  B.poly(key, [[x1, y, z - 0.15], [x0, y, z - 0.15], [x0, y + hgt, z - 0.15], [x1, y + hgt, z - 0.15]], [0, 0, -1], [[0, 0], [L, 0], [L, hgt], [0, hgt]]);
  B.box(dress, (x0 + x1) / 2, y + hgt + 0.07, z, L + 0.1, 0.14, 0.42, 0, { top: true });
  // dies (pedestals) every ~3.2 m
  const n = Math.max(1, Math.round(L / 3.2));
  for (let k = 0; k <= n; k++) B.box(dress, x0 + (L * k) / n, y + hgt / 2, z, 0.42, hgt, 0.38, 0, { top: false });
}
/** gables in a wall plane from an eave at y: per x a triangle of wall (width w, rise h) with coping and a window */
export function gableRow(B, xs, y, w, h, key, dress, win, q) {
  for (const x of xs) {
    B.poly(key, [[x - w / 2, y, 0], [x + w / 2, y, 0], [x, y + h, 0]], [0, 0, 1], [[x - w / 2, y], [x + w / 2, y], [x, y + h]]);
    B.poly(key, [[x + w / 2, y, -0.4], [x - w / 2, y, -0.4], [x, y + h, -0.4]], [0, 0, -1], [[x + w / 2, y], [x - w / 2, y], [x, y + h]]);
    for (const sg of [-1, 1]) {
      const a = [x + sg * (w / 2 + 0.1), y, 0.08], b = [x, y + h + 0.12, 0.08];
      B.poly(dress, [a, b, [b[0], b[1], -0.48], [a[0], a[1], -0.48]], [sg * h, w / 2, 0]);
      B.poly(dress, [a, b, [b[0], b[1] - 0.2, b[2]], [a[0], a[1] - 0.2, a[2]]], [0, 0, 1]);
    }
    if (q < 2 && win) B.unit(win, rectPts(x - w * 0.18, y + 0.25, x + w * 0.18, y + h * 0.55), 0.02, [((x * 3) | 0) & 63, 2]);
    if (q === 0) { B.box(dress, x, y + h + 0.35, -0.2, 0.26, 0.5, 0.26, 0, {}); }
  }
}
/** a square pinnacle at local (x, y, z): shaft side s, height hs, spirelet hp */
export function pinnacle(B, x, y, z, s, hs, hp, key, q, ry = 0) {
  B.box(key, x, y + hs / 2, z, s, hs, s, ry, { top: false });
  B.cyl(key, x, y + hs, z, 0.02, hp, q === 2 ? 4 : 8, false, s * 0.62);
  if (q === 0) B.box(key, x, y + hs + 0.05, z, s + 0.12, 0.1, s + 0.12, ry, {});
}
/** battlements along the current frame's top from x0..x1 at y (merlon pitch ~1.6 m) */
export function battlements(B, x0, x1, y, key, q, z = -0.12, ph = 0.8) {
  const L = x1 - x0, m = Math.max(1, Math.round(L / 1.6));
  B.box(key, (x0 + x1) / 2, y + ph / 2, z, L, ph, 0.34, 0, { top: true });
  if (q < 2) for (let k = 0; k < m; k++) B.box(key, x0 + (k + 0.5) * (L / m), y + ph + 0.25, z, (L / m) * 0.5, 0.5, 0.36, 0, { top: true });
}
/** a robed figure on a plinth in the current frame (local), facing +z */
export function figure(B, x, y, z, q, key = 'statue', s = 1) {
  const seg = q ? 6 : 9;
  B.lathe(key, x, z, [[0.3 * s, y], [0.31 * s, y + 0.1 * s], [0.27 * s, y + 0.6 * s], [0.25 * s, y + 1.0 * s], [0.22 * s, y + 1.28 * s], [0.18 * s, y + 1.4 * s], [0.08 * s, y + 1.47 * s]], { seg });
  B.lathe('statueDk', x, z + 0.03, [[0, y + 1.46 * s], [0.09 * s, y + 1.5 * s], [0.1 * s, y + 1.62 * s], [0.07 * s, y + 1.74 * s], [0, y + 1.77 * s]], { seg });
}
/** pure: the minimal oriented box of a polygon's points, long axis as u */
export function hullRect(poly) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q2 = poly[(i + 1) % poly.length], a = Math.atan2(q2[1] - p[1], q2[0] - p[0]), ux = Math.cos(a), uz = Math.sin(a);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const [x, z] of poly) { const u = x * ux + z * uz, v = -x * uz + z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0);
    if (!best || A < best.A) { const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; best = { A, R: rect(cu * ux - cv * uz, cu * uz + cv * ux, a, u1 - u0, v1 - v0) }; }
  }
  return best.R;
}
