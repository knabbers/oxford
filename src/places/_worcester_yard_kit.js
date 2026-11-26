// Worcester College, Provost's Yard and the Lodgings (places/worcester_yard.js): small shared things. Everything is
// drawn into the college's Batch (_worcester_kit.js) in the college's atlas, in the college's LOCAL frame (x = u east,
// z = v south) pushed once by the module; wall faces get a frame of their own inside it.
import * as THREE from 'three';
import { frame, rectPts, archPts } from './_worcester_kit.js';

export const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

/**
 * The frame of a wall face seen from OUTSIDE (x runs from the viewer's left to right, y up, z out of the wall), at the
 * face's left end: 's' faces south (x east), 'w' west (x south), 'n' north (x west), 'e' east (x north).
 */
export const face = (dir, u, v, y = 0) => (dir === 's' ? frame(u, y, v, 1, 0) : dir === 'w' ? frame(u, y, v, 0, 1) : dir === 'n' ? frame(u, y, v, -1, 0) : frame(u, y, v, 0, -1));
/** the four faces of a block r = { u0, u1, v0, v1 } (v0 its north side): { M: frame, L: length, x(u or v) -> along the face } */
export function faces(r) {
  return {
    s: { M: face('s', r.u0, r.v1), L: r.u1 - r.u0, x: (u) => u - r.u0 },
    w: { M: face('w', r.u0, r.v0), L: r.v1 - r.v0, x: (v) => v - r.v0 },
    n: { M: face('n', r.u1, r.v0), L: r.u1 - r.u0, x: (u) => r.u1 - u },
    e: { M: face('e', r.u1, r.v1), L: r.v1 - r.v0, x: (v) => r.v1 - v },
  };
}

let bayN = 2100;
/** the next window's bay number (which lit-window hash the atlas shader gives it) */
export const bay = (floor = 1) => [1 + (bayN++ % 251), floor > 0 ? 1 + (bayN % 5) : 0];

const rectOf = (w) => rectPts(w.c - w.w / 2, w.y0, w.c + w.w / 2, w.y0 + w.h);
const holeOf = (w) => (w.arch ? archPts(w.c, w.w, w.y0, w.y0 + w.h, 8) : rectOf(w));      // (arch: h = up to the springing)
/**
 * One window or door in the current face frame. w = { c, y0, w, h, key = 'sash', d = recess depth (0 = painted flat on
 * the wall), arch (round head: h is the height to the springing), sill, hood: 'cornice' | 'pediment', hoodY, ring:
 * width of a flat stone surround, floor }. In a recess the unit stands d back from the wall face, between stone reveals.
 */
export function win(B, wall, w) {
  const d = w.d === undefined ? 0.12 : w.d, key = w.key || 'sash', x0 = w.c - w.w / 2, x1 = w.c + w.w / 2, y1 = w.y0 + w.h, by = bay(w.floor ?? (w.y0 > 3 ? 1 : 0));
  const z = d > 0 ? -d : 0.014;
  if (d > 0) B.reveal(w.reveal || wall, holeOf(w), 0, -d, !!w.door);
  if (w.arch) B.archUnit(key, w.c, w.w, w.y0, y1, z, by, 8); else B.unit(key, rectOf(w), z, by);
  const top = w.arch ? y1 + w.w / 2 : y1;
  if (w.ring) {      // a flat stone surround, a little proud of the wall (a doorway's and an arch's stand on the sill line: a U, no hole)
    const a = w.ring;
    if (w.arch) { const inner = holeOf(w), outer = archPts(w.c, w.w + 2 * a, w.y0, y1, 8); B.face('stoneDress', [[x0 - a, w.y0], [x0, w.y0], ...inner.slice(2).reverse(), [x1, w.y0], [x1 + a, w.y0], ...outer.slice(2)], [], 0.026); }
    else if (w.door) B.face('stoneDress', [[x0 - a, w.y0], [x0, w.y0], [x0, y1], [x1, y1], [x1, w.y0], [x1 + a, w.y0], [x1 + a, y1 + a], [x0 - a, y1 + a]], [], 0.026);
    else B.face('stoneDress', rectPts(x0 - a, w.y0 - a, x1 + a, y1 + a), [rectOf(w)], 0.026);
  }
  if (w.sill) B.box('stoneDress', w.c, w.y0 - 0.05, 0.05, w.w + 0.3, 0.1, 0.1, 0, { bottom: true });
  if (w.hood) {
    const yh = w.hoodY ?? top + 0.3, hw = w.w / 2 + 0.3;
    if (w.hood === 'pediment') {
      const zf = 0.16, ap = 0.42;
      B.poly('stoneDress', [[w.c - hw, yh, zf], [w.c + hw, yh, zf], [w.c, yh + ap, zf]], [0, 0, 1]);
      B.poly('stoneDress', [[w.c - hw, yh, zf], [w.c, yh + ap, zf], [w.c, yh + ap, 0], [w.c - hw, yh, 0]], [-1, 1, 0]);
      B.poly('stoneDress', [[w.c + hw, yh, zf], [w.c + hw, yh, 0], [w.c, yh + ap, 0], [w.c, yh + ap, zf]], [1, 1, 0]);
      B.poly('stoneDress', [[w.c - hw, yh, 0], [w.c + hw, yh, 0], [w.c + hw, yh, zf], [w.c - hw, yh, zf]], [0, -1, 0]);
    } else B.box('stoneDress', w.c, yh + 0.09, 0.09, 2 * hw, 0.18, 0.18, 0, { bottom: true });
  }
}
/** a wall face with its windows: outline [[x, y]], wins as win() takes them (those with d > 0 are cut out of the wall) */
export function wall(B, key, outline, wins = []) {
  B.face(key, outline, wins.filter((w) => w.d === undefined || w.d > 0).map(holeOf));
  for (const w of wins) win(B, key, w);
}

/**
 * A pitched roof over the block r = [u0, u1, v0, v1] with its ridge along `axis` ('u' or 'v'), the slope passing
 * through the wall head (yE) and rising to yR on the middle line, overhanging by ov. ends = { a, b } at the low and the
 * high end of the axis: 'hip', 'gable' (the wall's triangle is drawn in `wallKey`) or 'open' (runs into another building).
 */
export function ridgeRoof(B, key, r, axis, yE, yR, ov, ends, wallKey) {
  const [u0, u1, v0, v1] = r, alongV = axis === 'v';
  const a0 = alongV ? v0 : u0, a1 = alongV ? v1 : u1, c0 = alongV ? u0 : v0, c1 = alongV ? u1 : v1, cm = (c0 + c1) / 2, hw = (c1 - c0) / 2, m = (yR - yE) / hw, yO = yE - ov * m;
  const P = (along, y, across) => (alongV ? [across, y, along] : [along, y, across]);
  const N = (along, y, across) => (alongV ? [across, y, along] : [along, y, across]);
  const eA = ends.a === 'hip' ? a0 - ov : ends.a === 'gable' ? a0 - 0.12 : a0, rA = ends.a === 'hip' ? a0 + hw : eA;
  const eB = ends.b === 'hip' ? a1 + ov : ends.b === 'gable' ? a1 + 0.12 : a1, rB = ends.b === 'hip' ? a1 - hw : eB;
  // the two long slopes (first edge = the eaves, so the slates' courses run level)
  B.poly(key, [P(eA, yO, c0 - ov), P(eB, yO, c0 - ov), P(rB, yR, cm), P(rA, yR, cm)], N(0, 1, -1));
  B.poly(key, [P(eB, yO, c1 + ov), P(eA, yO, c1 + ov), P(rA, yR, cm), P(rB, yR, cm)], N(0, 1, 1));
  // soffits under the eaves
  B.poly('stoneDress', [P(eA, yO, c0 - ov), P(eB, yO, c0 - ov), P(eB, yO, c0), P(eA, yO, c0)], [0, -1, 0]);
  B.poly('stoneDress', [P(eA, yO, c1 + ov), P(eB, yO, c1 + ov), P(eB, yO, c1), P(eA, yO, c1)], [0, -1, 0]);
  for (const [kind, e, rr, wallAt, sg] of [[ends.a, eA, rA, a0, -1], [ends.b, eB, rB, a1, 1]]) {
    if (kind === 'hip') {
      B.poly(key, [P(e, yO, c0 - ov), P(e, yO, c1 + ov), P(rr, yR, cm)], N(sg, 1, 0));
      B.poly('stoneDress', [P(e, yO, c0), P(e, yO, c1), P(wallAt, yO, c1), P(wallAt, yO, c0)], [0, -1, 0]);      // (between the side soffits: no two in one plane)
    } else if (kind === 'gable') B.poly(wallKey || 'stone', [P(wallAt, yE, c0), P(wallAt, yE, c1), P(wallAt, yR, cm)], N(sg, 0, 0));
  }
  return m;
}

/** a hipped roof up to a flat crown: from the rectangle r0 = [u0, u1, v0, v1] at y0 to r1 (inside it) at y1; `top` = the crown's material */
export function frustum(B, key, r0, y0, r1, y1, top) {
  const [a0, a1, c0, c1] = r0, [b0, b1, d0, d1] = r1;
  B.poly(key, [[a0, y0, c1], [a1, y0, c1], [b1, y1, d1], [b0, y1, d1]], [0, 1, 1]);
  B.poly(key, [[a1, y0, c0], [a0, y0, c0], [b0, y1, d0], [b1, y1, d0]], [0, 1, -1]);
  B.poly(key, [[a1, y0, c1], [a1, y0, c0], [b1, y1, d0], [b1, y1, d1]], [1, 1, 0]);
  B.poly(key, [[a0, y0, c0], [a0, y0, c1], [b0, y1, d1], [b0, y1, d0]], [-1, 1, 0]);
  if (top) B.poly(top, [[b0, y1, d0], [b1, y1, d0], [b1, y1, d1], [b0, y1, d1]], [0, 1, 0]);
}

const ringArea = (poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
/** upright walls on a ground ring [[u, v]] from y0 to y1, one quad an edge, facing outwards; o.skip = edges left out, o.keys = { edge: material } */
export function prism(B, key, poly, y0, y1, o = {}) {
  const A = ringArea(poly);
  for (let i = 0; i < poly.length; i++) {
    if (o.skip && o.skip.includes(i)) continue;
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    if (l < 1e-3) continue;
    const n = A > 0 ? [dz / l, -dx / l] : [-dz / l, dx / l];
    B.poly((o.keys && o.keys[i]) || key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [n[0], 0, n[1]]);
  }
}

/** a low clump of leaves: a six-sided dome r wide and h high standing at y0 */
export function clump(B, key, x, y0, z, r, h, n = 6) {
  const ring = (rr, y) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + x; return [x + Math.sin(a) * rr, y, z + Math.cos(a) * rr]; });
  const a = ring(r * 0.7, y0), b = ring(r, y0 + h * 0.45), c = ring(r * 0.5, y0 + h);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, nx = (a[i][0] + a[j][0]) / 2 - x, nz = (a[i][2] + a[j][2]) / 2 - z; B.poly(key, [a[i], a[j], b[j], b[i]], [nx, -0.2, nz]); B.poly(key, [b[i], b[j], c[j], c[i]], [nx, 0.7, nz]); }
  B.poly(key, c, [0, 1, 0]);
}
/** an iron rail: posts of height ph on the points [[x, y, z]] (y = their foot) and a top bar between them */
export function rail(B, pts, ph = 0.9) {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]; B.box('iron', p[0], p[1] + ph / 2, p[2], 0.03, ph, 0.03, 0, { top: false });      // (7.5 mm inside the bar's faces: nearer, and the two shimmer from afar)
    if (i) { const q = pts[i - 1]; B.beam('iron', [q[0], q[1] + ph, q[2]], [p[0], p[1] + ph, p[2]], 0.045); }
  }
}
