// Worcester College, the south buildings (places/worcester_south.js): shared small things. Frames, windows, roofs,
// dormers and stacks, drawn into the college's Batch (_worcester_kit.js) in the college's atlas.
import * as THREE from 'three';
import { frame, rectPts } from './_worcester_kit.js';

// `?wsouth=0` (node: GTO_WSOUTH=0): the south end as it was before this pass, for before / after pictures
export const SOUTH_ON = !((typeof location !== 'undefined' && location && /[?&]wsouth=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_WSOUTH === '0'));

/** a frame on the ground: o = a corner, e = the next corner along a front; a runs o -> e, b is the front's OUTWARD normal */
export const mk = (o, e) => {
  const dx = e[0] - o[0], dz = e[1] - o[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  return { o, ux, uz, L, pt: (a, b) => [o[0] + a * ux - b * uz, o[1] + a * uz + b * ux], inv: (x, z) => [(x - o[0]) * ux + (z - o[1]) * uz, -(x - o[0]) * uz + (z - o[1]) * ux], mat: () => frame(o[0], 0, o[1], ux, uz) };
};
export const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

let bayN = 1300;
/** the next window's bay number (which lit-window hash the atlas shader gives it) */
export const bay = (floor = 1) => [1 + (bayN++ % 251), floor > 0 ? 1 + (bayN % 5) : 0];

/**
 * A plain modern window in the wall plane of the current face frame (x along, y up, z out): reveals, a flat frame set
 * back in them, clean panes in `cols` lights with a transom at `tr` (0..1 of the height; 0 = none). o: { wall, frame,
 * cols, rows, tr, depth, sill, bar }. rows > 1 gives glazing bars (a sash of cols x rows panes).
 */
export function win(B, x0, y0, x1, y1, o = {}) {
  const wall = o.wall || 'buff', fk = o.frame || 'alu', cols = o.cols || 2, rows = o.rows || 1, d = o.depth === undefined ? 0.1 : o.depth, m = o.bar || 0.055, by = o.bay || bay(o.floor ?? 1);
  const pts = rectPts(x0, y0, x1, y1);
  if (d > 0 && wall) B.reveal(wall, pts, 0, -d);
  B.poly(fk, pts.map((p) => [p[0], p[1], -d]), [0, 0, 1]);
  const pane = (a0, b0, a1, b1) => B.poly('sash', [[a0, b0, -d + 0.016], [a1, b0, -d + 0.016], [a1, b1, -d + 0.016], [a0, b1, -d + 0.016]], [0, 0, 1],
    [[by[0] + 0.16, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.87], [by[0] + 0.16, by[1] + 0.87]]);
  const w = (x1 - x0 - m) / cols, h = (y1 - y0 - m) / rows, mi = rows > 1 || cols > 2 ? m * 0.55 : m;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) pane(x0 + m + i * w + (i ? (mi - m) / 2 : 0), y0 + m + j * h + (j ? (mi - m) / 2 : 0), x0 + (i + 1) * w - (i < cols - 1 ? (mi - m) / 2 : 0), y0 + (j + 1) * h - (j < rows - 1 ? (mi - m) / 2 : 0));
  if (o.sill) B.box(o.sill, (x0 + x1) / 2, y0 - 0.035, 0.045, x1 - x0 + 0.14, 0.07, 0.09, 0, { bottom: true });      // (wholly in front of the wall: its top must not lie in the reveal's floor)
}
/** a wall face with windows cut in it: wins = [[x0, y0, x1, y1, opts]] */
export function wall(B, key, outline, wins = [], o = {}) {
  B.face(key, outline, wins.map((w) => rectPts(w[0], w[1], w[2], w[3])));
  for (const w of wins) win(B, w[0], w[1], w[2], w[3], { wall: key, ...o, ...(w[4] || {}) });
}

/**
 * A hipped roof that may stop at a flat crown: from the rectangle r0 = [x0, x1, z0, z1] at height y0 up to the
 * rectangle r1 (inside it) at y1; `top` = material of the crown (none when r1 is a line or a point), `sof` = soffit.
 */
export function frustum(B, key, r0, y0, r1, y1, top, sof) {
  const [a0, a1, c0, c1] = r0, [b0, b1, d0, d1] = r1;
  const q = (pts, n) => { const P = pts.filter((p, i) => { const k = pts[(i + 1) % pts.length]; return Math.hypot(p[0] - k[0], p[1] - k[1], p[2] - k[2]) > 1e-4; }); if (P.length >= 3) B.poly(key, P, n); };
  q([[a0, y0, c1], [a1, y0, c1], [b1, y1, d1], [b0, y1, d1]], [0, 1, 1]);
  q([[a1, y0, c0], [a0, y0, c0], [b0, y1, d0], [b1, y1, d0]], [0, 1, -1]);
  q([[a1, y0, c1], [a1, y0, c0], [b1, y1, d0], [b1, y1, d1]], [1, 1, 0]);
  q([[a0, y0, c0], [a0, y0, c1], [b0, y1, d1], [b0, y1, d0]], [-1, 1, 0]);
  if (top && b1 - b0 > 0.01 && d1 - d0 > 0.01) B.poly(top, [[b0, y1, d0], [b1, y1, d0], [b1, y1, d1], [b0, y1, d1]], [0, 1, 0]);
  if (sof) B.poly(sof, [[a0, y0, c0], [a1, y0, c0], [a1, y0, c1], [a0, y0, c1]], [0, -1, 0]);
}
/** a hipped roof over x0..x1, z0..z1 with eaves at y (already overhung by the caller) rising `rise` to its ridge */
export function hip(B, key, x0, x1, z0, z1, y, rise, sof) {
  const w = x1 - x0, d = z1 - z0, h = Math.min(w, d) / 2;
  if (w >= d) frustum(B, key, [x0, x1, z0, z1], y, [x0 + h, x1 - h, (z0 + z1) / 2, (z0 + z1) / 2], y + rise, null, sof);
  else frustum(B, key, [x0, x1, z0, z1], y, [(x0 + x1) / 2, (x0 + x1) / 2, z0 + h, z1 - h], y + rise, null, sof);
}

/**
 * A hipped dormer on a roof slope, in a face frame (x along the wall, y up, z out): the slope has its eaves' edge at
 * z = ov, y = ye and rises inwards at tan = tp. The dormer's front stands at z = zf, w wide and h tall above the
 * slope there, under a small hipped roof of rise r. `glass` = atlas unit of the casement, `cheek` / `roof` materials.
 */
export function dormer(B, cx, ov, ye, tp, zf, w, h, r, o = {}) {
  const roof = o.roof || 'stoneSlate', cheek = o.cheek || roof, yb = ye + (ov - zf) * tp, yt = yb + h, e = 0.14, hw = w / 2;
  const zAt = (y) => ov - (y - ye) / tp;      // where the main slope is at height y
  const zc = zAt(yt), zr = zAt(yt + r), hr = Math.min(hw, (zf - zr) * 0.6);
  // front: a stone or timber surround with the casement in it
  B.poly(o.front || 'stoneDress', [[cx - hw, yb, zf], [cx + hw, yb, zf], [cx + hw, yt, zf], [cx - hw, yt, zf]], [0, 0, 1]);
  B.unit(o.glass || 'leaded', rectPts(cx - hw + 0.12, yb + 0.14, cx + hw - 0.12, yt - 0.1), zf + 0.012, bay(2));
  // cheeks
  for (const s of [-1, 1]) B.poly(cheek, [[cx + s * hw, yb, zf], [cx + s * hw, yt, zf], [cx + s * hw, yt, zc]], [s, 0, 0]);
  // roof: two sides and the front hip, their eaves a little proud of the front
  const ap = [cx, yt + r, zf - hr], bk = [cx, yt + r, zr];
  for (const s of [-1, 1]) {
    const f = [cx + s * (hw + e), yt - 0.03, zf + e], b = [cx + s * (hw + e), yt - 0.03, zc];
    B.poly(roof, [f, ap, bk], [s, 1, 0]); B.poly(roof, [f, bk, b], [s, 1, 0]);
  }
  B.poly(roof, [[cx - hw - e, yt - 0.03, zf + e], [cx + hw + e, yt - 0.03, zf + e], ap], [0, 1, 1]);
  B.poly(o.front || 'stoneDress', [[cx - hw - e, yt - 0.03, zf + e], [cx + hw + e, yt - 0.03, zf + e], [cx + hw, yt - 0.03, zf], [cx - hw, yt - 0.03, zf]], [0, -1, 0]);
}

/** a chimney stack: a rubble shaft from y0 to y1 with an ashlar cap and `pots` clay pots (current frame, axis-aligned) */
export function stack(B, x, z, w, d, y0, y1, pots = 2, key = 'rubble') {
  B.boxXZ(key, x - w / 2, x + w / 2, y0, y1, z - d / 2, z + d / 2, { top: false });
  B.boxXZ('stoneDress', x - w / 2 - 0.07, x + w / 2 + 0.07, y1, y1 + 0.16, z - d / 2 - 0.07, z + d / 2 + 0.07, { bottom: true });
  for (let i = 0; i < pots; i++) B.cyl('terracotta', x - w / 2 + (w * (i + 0.5)) / pots, y1 + 0.16, z, 0.11, 0.4, 7, true, 0.13);
}

/** a clipped dome of leaves (a hydrangea, a box ball): r wide, k = height / radius */
export function shrub(B, key, x, z, r, k = 1.1, n = 8, y0 = 0) {
  const prof = [[0, 0.72], [0.35, 1], [0.72, 0.92], [1.0, 0.62], [1.14, 0.2]];
  for (let i = 0; i < prof.length - 1; i++) B.cyl(key, x, y0 + prof[i][0] * r * k, z, prof[i + 1][1] * r, (prof[i + 1][0] - prof[i][0]) * r * k, n, false, prof[i][1] * r);
  const t = prof[prof.length - 1];
  B.poly(key, Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [x + Math.sin(a) * t[1] * r, y0 + t[0] * r * k, z + Math.cos(a) * t[1] * r]; }), [0, 1, 0]);
}
export const ring = (x, z, rx, rz, n = 24) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [x + Math.cos(t) * rx, z + Math.sin(t) * rz]; });

/** outward normal of edge a -> b of a ring whose signed area is `area` */
const outN = (a, b, area) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return area > 0 ? [dz / l, -dx / l] : [-dz / l, dx / l]; };
export const ringArea = (poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
/** a ring moved outwards by d (inwards when negative): mitred corners */
export function offsetRing(poly, d) {
  const A = ringArea(poly), n = poly.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = poly[(i + n - 1) % n], c = poly[i], q = poly[(i + 1) % n], n0 = outN(p, c, A), n1 = outN(c, q, A);
    let mx = n0[0] + n1[0], mz = n0[1] + n1[1]; const k = mx * n0[0] + mz * n0[1] || 1;
    mx /= k; mz /= k; const l = Math.hypot(mx, mz); if (l > 3) { mx *= 3 / l; mz *= 3 / l; }
    out.push([c[0] + mx * d, c[1] + mz * d]);
  }
  return out;
}
/**
 * An upright prism on a ground ring [[x, z]] from y0 to y1: one wall quad per edge, facing outwards. o.top = material
 * of a flat lid, o.skip = edge indices left open, o.keys = { edge index: material } for single edges.
 */
export function prism(B, key, poly, y0, y1, o = {}) {
  const A = ringArea(poly);
  for (let i = 0; i < poly.length; i++) {
    if (o.skip && o.skip.includes(i)) continue;
    const a = poly[i], b = poly[(i + 1) % poly.length], n = outN(a, b, A);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-3) continue;
    const sg = o.inward ? -1 : 1;
    B.poly((o.keys && o.keys[i]) || key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [n[0] * sg, 0, n[1] * sg]);
  }
  if (o.top) B.flat(o.top, poly, y1);
}
/**
 * A roof slope band between two rings of the same number of points (the eaves ring at y0, the upper ring at y1):
 * a mansard, or a hipped roof up to a crown. o.top = material of the lid over the upper ring.
 */
export function band(B, key, lo, y0, hi, y1, o = {}) {
  const A = ringArea(lo);
  for (let i = 0; i < lo.length; i++) {
    if (o.skip && o.skip.includes(i)) continue;
    const a = lo[i], b = lo[(i + 1) % lo.length], c = hi[(i + 1) % hi.length], d = hi[i], n = outN(a, b, A);
    const P = [[a[0], y0, a[1]], [b[0], y0, b[1]], [c[0], y1, c[1]], [d[0], y1, d[1]]];
    if (Math.hypot(c[0] - d[0], c[1] - d[1]) < 1e-3) P.pop();
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-3) continue;
    B.poly(key, P, [n[0], 0.6, n[1]]);
  }
  if (o.top) B.flat(o.top, hi, y1);
}

/** a small low-polygon dome (a flower head): r wide, five-sided, flat on top */
export function blob(B, key, x, y, z, r) {
  const n = 5, rg = (yy, rr) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + x; return [x + Math.sin(a) * rr, yy, z + Math.cos(a) * rr]; });
  const a = rg(y - r * 0.2, r * 0.82), b = rg(y + r * 0.22, r), c = rg(y + r * 0.6, r * 0.6);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, nx = (a[i][0] + a[j][0]) / 2 - x, nz = (a[i][2] + a[j][2]) / 2 - z; B.poly(key, [a[i], a[j], b[j], b[i]], [nx, -0.3, nz]); B.poly(key, [b[i], b[j], c[j], c[i]], [nx, 0.6, nz]); }
  B.poly(key, c, [0, 1, 0]);
}
/** a clump of sword leaves (irises): a few thin upright blades fanned about (x, z) */
export function blades(B, key, x, z, h, n = 4, seed = 0) {
  for (let i = 0; i < n; i++) { const a = seed + i * 2.4, dx = Math.sin(a) * 0.09, dz = Math.cos(a) * 0.09, w = 0.035; B.poly(key, [[x - dz * w * 8, 0.02, z + dx * w * 8], [x + dz * w * 8, 0.02, z - dx * w * 8], [x + dx * 2.2, h * (0.75 + 0.25 * ((i * 7) % 3) / 2), z + dz * 2.2]], [dx, 0.3, dz]); }
}
