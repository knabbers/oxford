// Worcester College, the far north-west corner (places/worcester_west.js): small shared shapes, drawn into the
// college's Batch (_worcester_kit.js) in the college's atlas. Brick walls with windows under flat arches, bands laid
// over a wall, gabled bays and their roofs, eaves gablets with triangular glazing, box windows, a banded gate pier.
import { frame, rectPts } from './_worcester_kit.js';
import { mk, bay } from './_worcester_south_kit.js';

/** push the face frame of the wall from p0 to p1 (world [x, z]; the outside is on the right of p0 -> p1), run fn(length, frame), pop */
export const onFace = (B, p0, p1, fn) => { const F = mk(p0, p1); B.push(F.mat()); try { fn(F.L, F); } finally { B.pop(); } };
/** a frame inside the current face frame for a return wall: at x, from z0 running to z1 (its outside faces +x when z1 < z0, -x when z1 > z0) */
export const onReturn = (B, x, z0, z1, fn) => { B.push(frame(x, 0, z0, 0, z1 > z0 ? 1 : -1)); try { fn(Math.abs(z1 - z0)); } finally { B.pop(); } };

/** a quad in the wall plane (z) of the current face frame */
export const strip = (B, key, x0, y0, x1, y1, z = 0) => B.poly(key, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1]);
/** bands of another brick laid over a wall: [[y0, y1]] from x0 to x1, broken at gaps [[g0, g1]] */
export function bands(B, key, x0, x1, ys, gaps = [], z = 0.015) {
  const G = gaps.slice().sort((a, b) => a[0] - b[0]);
  for (const [y0, y1] of ys) { let a = x0; for (const [g0, g1] of [...G, [x1, x1]]) { if (Math.min(g0, x1) > a + 0.02) strip(B, key, a, y0, Math.min(g0, x1), y1, z); a = Math.max(a, g1); } }
}
const PANE = (by) => [[by[0] + 0.16, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.87], [by[0] + 0.16, by[1] + 0.87]];
/** one clean pane of glass (lit at night with its own bay number): a quad given by four points [x, y, z] */
export const pane = (B, pts, hint, by = bay(1)) => B.poly('sash', pts, hint, PANE(by));
/** a pane of any convex outline [[x, y]] in the wall plane at z (an oval window) */
export const paneShape = (B, pts, z, by = bay(0)) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  B.poly('sash', pts.map((q) => [q[0], q[1], z]), [0, 0, 1], pts.map((q) => [by[0] + 0.16 + (0.11 * (q[0] - x0)) / (x1 - x0), by[1] + 0.79 + (0.08 * (q[1] - y0)) / (y1 - y0)])); };
/** a triangular pane */
export const paneTri = (B, pts, hint, by = bay(2)) => B.poly('sash', pts, hint, [[by[0] + 0.16, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.79], [by[0] + 0.215, by[1] + 0.87]]);

/**
 * A white casement in the wall plane of the current face frame: reveals, a flat frame set back in them, `cols` lights
 * each with a small top light over a transom at o.tr of the height (the Canal Building's windows in the photograph).
 */
export function casement(B, x0, y0, x1, y1, o = {}) {
  const cols = o.cols || 2, d = o.depth ?? 0.1, m = o.bar ?? 0.055, tr = o.tr ?? 0.34, by = bay(o.floor ?? 1), pts = rectPts(x0, y0, x1, y1), z = -d + 0.016;
  if (d > 0 && o.wall) B.reveal(o.wall, pts, 0, -d);
  B.poly(o.frame || 'white', pts.map((p) => [p[0], p[1], -d]), [0, 0, 1]);
  const w = (x1 - x0 - m) / cols, yt = y1 - m - (y1 - y0 - 2 * m) * tr;
  for (let i = 0; i < cols; i++) {
    const a = x0 + m + i * w, b = a + w - m;
    pane(B, [[a, y0 + m, z], [b, y0 + m, z], [b, yt - m / 2, z], [a, yt - m / 2, z]], [0, 0, 1], by);
    pane(B, [[a, yt + m / 2, z], [b, yt + m / 2, z], [b, y1 - m, z], [a, y1 - m, z]], [0, 0, 1], by);
  }
}
/** a window laid flat on the wall, its frame in the colour `key`: `cols` plain lights (the cheap window where the frames are not white) */
export function flatWin(B, x0, y0, x1, y1, key, cols = 2, floor = 1, z = 0.014) {
  const m = 0.06, w = (x1 - x0 - m) / cols, by = bay(floor);
  strip(B, key, x0, y0, x1, y1, z);
  for (let i = 0; i < cols; i++) { const a = x0 + m + i * w, b = a + w - m; pane(B, [[a, y0 + m, z + 0.014], [b, y0 + m, z + 0.014], [b, y1 - m, z + 0.014], [a, y1 - m, z + 0.014]], [0, 0, 1], by); }
}
/**
 * A wall face (current face frame) with its windows. wins = [[x0, y0, x1, y1, opts]]; opts as `casement`
 * above, plus flat: true = a painted whole-cell sash laid on the wall (the cheap window of sides seen from far off), flat: 'key' = the same with a frame of that colour.
 * o.head = brick of a flat arch (o.headH tall) over every window; o.win = defaults for the windows.
 */
export function wallFace(B, key, outline, wins = [], o = {}) {
  const hk = o.head, hh = o.headH ?? 0.225, holes = [];
  const opt = (w) => ({ wall: key, frame: 'white', cols: 2, rows: 2, depth: 0.1, bar: 0.05, ...(o.win || {}), ...(w[4] || {}) });
  for (const w of wins) { const wo = opt(w); if (!wo.flat) holes.push(rectPts(w[0], w[1], w[2], w[3] + (hk && !wo.noHead ? hh : 0))); }
  B.face(key, outline, holes);
  for (const w of wins) {
    const wo = opt(w), head = hk && !wo.noHead;
    if (wo.flat) {
      if (wo.flat === true) B.unit('sash', rectPts(w[0], w[1], w[2], w[3]), 0.014, bay(wo.floor ?? 1));
      else flatWin(B, w[0], w[1], w[2], w[3], wo.flat, wo.cols, wo.floor);
      if (head) strip(B, hk, w[0] - 0.06, w[3], w[2] + 0.06, w[3] + hh, 0.014);
      continue;
    }
    casement(B, w[0], w[1], w[2], w[3], wo);
    if (head) strip(B, hk, w[0], w[3], w[2], w[3] + hh);
  }
}
/** a gable's outline: from 0 to w, eaves at ye, apex ya over the middle (or xm) */
export const gable = (w, ye, ya, xm = w / 2, x0 = 0, y0 = 0) => [[x0, y0], [x0 + w, y0], [x0 + w, ye], [x0 + xm, ya], [x0, ye]];

/**
 * The roof of a gabled bay, in the frame of its FRONT face (x 0..w along it, z out of it): two slopes from eaves at
 * ye to the ridge at ya over the middle, from `og` in front of the gable back to z = -back. o.barge = material of
 * the verge boards on the front.
 */
export function bayRoof(B, key, w, ye, ya, back, o = {}) {
  const ov = o.ov ?? 0.22, og = o.og ?? 0.18, tb = (ya - ye) / (w / 2), yl = ye - ov * tb, xm = w / 2;
  B.poly(key, [[-ov, yl, og], [xm, ya, og], [xm, ya, -back], [-ov, yl, -back]], [-1, 1, 0]);
  B.poly(key, [[w + ov, yl, og], [w + ov, yl, -back], [xm, ya, -back], [xm, ya, og]], [1, 1, 0]);
  if (o.barge) for (const s of [-1, 1]) { const xe = s < 0 ? -ov : w + ov; B.poly(o.barge, [[xe, yl - 0.13, og], [xm, ya - 0.13, og], [xm, ya, og], [xe, yl, og]], [0, 0, 1]); }
  return tb;
}
/**
 * The side walls of a bay, in the frame of its front face: from the front back `proj` to the main wall, up to ye; and
 * above the main roof (eaves yeM, rising inwards at tM) the triangle of wall that shows over it. o.bands = [[y0, y1]] of o.band.
 */
export function bayReturns(B, key, w, proj, ye, yeM, tM, o = {}) {
  for (const [x, s] of [[0, -1], [w, 1]]) {
    if (o.skip === s) continue;
    B.poly(key, [[x, 0, -proj], [x, 0, 0], [x, ye, 0], [x, ye, -proj]], [s, 0, 0]);
    if (ye > yeM + 0.05) B.poly(key, [[x, yeM, -proj], [x, ye, -proj], [x, ye, -proj - (ye - yeM) / tM]], [s, 0, 0]);
    for (const [y0, y1] of o.bands || []) B.poly(o.band, [[x + s * 0.015, y0, -proj], [x + s * 0.015, y0, 0], [x + s * 0.015, y1, 0], [x + s * 0.015, y1, -proj]], [s, 0, 0]);
  }
}

/**
 * An eaves gablet with triangular glazing, in a wall's face frame: the main slope leaves the wall's eaves (ye at z = 0)
 * rising inwards at tan tp; the gablet's glazed front stands `set` behind the wall plane, 2 hw wide and h tall.
 */
export function gablet(B, cx, ye, tp, o = {}) {
  const hw = o.hw ?? 1.0, h = o.h ?? 1.25, set = o.set ?? 0.32, roof = o.roof || 'slate', zf = -set, yb = ye + set * tp, ya = yb + h, zr = -(ya - ye) / tp, e = 0.1;
  B.poly('white', [[cx - hw, yb, zf], [cx + hw, yb, zf], [cx, ya, zf]], [0, 0, 1]);
  paneTri(B, [[cx - hw + 0.26, yb + 0.1, zf + 0.012], [cx + hw - 0.26, yb + 0.1, zf + 0.012], [cx, ya - 0.24, zf + 0.012]], [0, 0, 1]);
  for (const s of [-1, 1]) {
    const c = [cx + s * (hw + e), yb - e * (h / hw), zf + e];
    B.poly(roof, [c, [cx, ya + 0.03, zf + e], [cx, ya + 0.03, zr]], [s, 1, 0]);
    B.poly(o.barge || 'dark', [[c[0], c[1] - 0.11, zf + e], [cx, ya - 0.08, zf + e], [cx, ya + 0.03, zf + e], c], [0, 0, 1]);
  }
}
/**
 * A wall dormer: the wall carried up through the eaves as a small brick gable with a window, its roof running back
 * into the main slope (face frame; the main slope rises inwards from ye at tan tp).
 */
export function wallDormer(B, key, cx, ye, tp, o = {}) {
  const hw = o.hw ?? 1.15, k = o.knee ?? 0.55, rise = o.rise ?? 1.25, ya = ye + k + rise, roof = o.roof || 'slate', zk = -k / tp, zr = -(ya - ye) / tp, e = 0.12, yl = ye + k - e * (rise / hw);
  B.poly(key, [[cx - hw, ye, 0], [cx + hw, ye, 0], [cx + hw, ye + k, 0], [cx, ya, 0], [cx - hw, ye + k, 0]], [0, 0, 1]);
  B.unit('sash', rectPts(cx - 0.5, ye + 0.28, cx + 0.5, ye + k + rise * 0.42), 0.014, bay(2));
  for (const s of [-1, 1]) {
    B.poly(key, [[cx + s * hw, ye, 0], [cx + s * hw, ye + k, 0], [cx + s * hw, ye + k, zk]], [s, 0, 0]);
    B.poly(roof, [[cx + s * (hw + e), yl, 0.15], [cx, ya + 0.02, 0.15], [cx, ya + 0.02, zr], [cx + s * (hw + e), yl, zk]], [s, 1, 0]);
    B.poly(o.barge || 'dark', [[cx + s * (hw + e), yl - 0.11, 0.15], [cx, ya - 0.09, 0.15], [cx, ya + 0.02, 0.15], [cx + s * (hw + e), yl, 0.15]], [0, 0, 1]);
  }
}
/** a rooflight lying on a wall's main slope (face frame): cx along the wall, from s0 to s1 metres in from the wall */
export const rooflight = (B, cx, w, s0, s1, ye, tp) => B.poly('glassDark', [[cx - w / 2, ye + s0 * tp + 0.05, -s0], [cx + w / 2, ye + s0 * tp + 0.05, -s0], [cx + w / 2, ye + s1 * tp + 0.05, -s1], [cx - w / 2, ye + s1 * tp + 0.05, -s1]], [0, 1, 1]);

/**
 * A white timber box window standing out of a wall (face frame): xc, y0..y1, wd wide, d deep, n lights on the front
 * and one on each side, a moulded sill and a flat cap. o.z = the wall plane it stands on.
 */
export function boxWindow(B, xc, y0, y1, wd, d, n, o = {}) {
  const z0 = o.z ?? 0, x0 = xc - wd / 2, x1 = xc + wd / 2, m = 0.07, lw = (wd - m) / n, floor = o.floor ?? 1;
  B.boxXZ('white', x0, x1, y0, y1, z0, z0 + d, { bottom: true });
  B.boxXZ('white', x0 - 0.07, x1 + 0.07, y0 - 0.1, y0, z0, z0 + d + 0.08, { bottom: true });
  B.boxXZ(o.cap || 'white', x0 - 0.05, x1 + 0.05, y1, y1 + 0.07, z0, z0 + d + 0.06, { bottom: true });
  const tr = o.transom ?? 0.68, ym = y0 + m + (y1 - y0 - 2 * m) * tr;
  for (let i = 0; i < n; i++) {
    const a = x0 + m + i * lw, b = a + lw - m, by = bay(floor), z = z0 + d + 0.012;
    pane(B, [[a, y0 + m, z], [b, y0 + m, z], [b, ym - 0.02, z], [a, ym - 0.02, z]], [0, 0, 1], by);
    pane(B, [[a, ym + 0.02, z], [b, ym + 0.02, z], [b, y1 - m, z], [a, y1 - m, z]], [0, 0, 1], by);
  }
  if (d > 0.4) for (const s of [-1, 1]) { const x = (s < 0 ? x0 : x1) + s * 0.012; pane(B, [[x, y0 + m, z0 + 0.06], [x, y0 + m, z0 + d - m], [x, y1 - m, z0 + d - m], [x, y1 - m, z0 + 0.06]], [s, 0, 0], bay(floor)); }
}

/** a square brick pier (current frame, centred x, z): a wider plinth, bands of another brick, a stone cap in two steps */
export function pier(B, x, z, w, h, o = {}) {
  const key = o.key || 'redBrick', hw = w / 2, pl = o.plinth ?? 0, cuts = [pl, ...(o.bands || []).flat(), h], keys = [];
  for (let i = 0; i < cuts.length - 1; i++) keys.push(i % 2 === 1 && i < cuts.length - 1 && (o.bands || []).length ? o.band : key);
  if (pl > 0) B.boxXZ(key, x - hw - 0.05, x + hw + 0.05, 0, pl, z - hw - 0.05, z + hw + 0.05, { top: true });
  for (let i = 0; i < cuts.length - 1; i++) B.boxXZ(keys[i] || key, x - hw, x + hw, cuts[i], cuts[i + 1], z - hw, z + hw, { top: false });
  const c = o.cap ?? 0.18, ck = o.capKey || 'stoneDress';
  B.boxXZ(ck, x - hw - 0.07, x + hw + 0.07, h, h + c * 0.55, z - hw - 0.07, z + hw + 0.07, { bottom: true });
  B.boxXZ(ck, x - hw + 0.04, x + hw - 0.04, h + c * 0.55, h + c, z - hw + 0.04, z + hw - 0.04, {});
}

/**
 * A pyramid roof over a four-cornered ring (world [x, z], identity frame): eaves at ye oversailing by ov, the hips
 * meeting at ya over the middle; a dark board under the eaves' edge and a soffit back to the walls.
 */
export function pyramid(B, key, ring, ye, ya, o = {}) {
  const ov = o.ov ?? 0.35, c = ring.reduce((s, q) => [s[0] + q[0] / ring.length, s[1] + q[1] / ring.length], [0, 0]);
  const E = ring.map((q) => { const dx = q[0] - c[0], dz = q[1] - c[1], l = Math.hypot(dx, dz); return [q[0] + (dx / l) * ov * 1.41, q[1] + (dz / l) * ov * 1.41]; });
  const yl = ye - 0.06, fk = o.fascia || 'dark';
  for (let i = 0; i < E.length; i++) {
    const a = E[i], b = E[(i + 1) % E.length], n = [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1]];
    B.poly(key, [[a[0], yl, a[1]], [b[0], yl, b[1]], [c[0], ya, c[1]]], [n[0], 4, n[1]]);
    B.poly(fk, [[a[0], yl - 0.16, a[1]], [b[0], yl - 0.16, b[1]], [b[0], yl, b[1]], [a[0], yl, a[1]]], [n[0], 0, n[1]]);
  }
  B.flat(fk, E, yl - 0.16, [ring], true);
}
/** digits as painted strokes (seven-segment forms) on a wall: text at x, y (bottom left), h tall, in the face frame */
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
export function digits(B, key, text, x, y, h, z = 0.02) {
  const w = h * 0.52, t = h * 0.13;
  for (const ch of String(text)) {
    const S = SEG[ch] || '', q = (x0, y0, x1, y1) => strip(B, key, x + x0, y + y0, x + x1, y + y1, z);
    if (S.includes('a')) q(0, h - t, w, h); if (S.includes('g')) q(0, h / 2 - t / 2, w, h / 2 + t / 2); if (S.includes('d')) q(0, 0, w, t);
    if (S.includes('f')) q(0, h / 2, t, h); if (S.includes('b')) q(w - t, h / 2, w, h); if (S.includes('e')) q(0, 0, t, h / 2); if (S.includes('c')) q(w - t, 0, w, h / 2);
    x += w + h * 0.22;
  }
}
export { mk, bay, rectPts };
