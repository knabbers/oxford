// Worcester Place and Richmond Road, the college's buildings north of Nash Quad (places/worcester_wplace.js): the
// street frame, the one table of levels, and small shared shapes (walls with brick bands, casements, pitched roofs,
// railings), drawn into the college's Batch (_worcester_kit.js) in the college's atlas.
import { frame, rectPts } from './_worcester_kit.js';
import { win, bay } from './_worcester_south_kit.js';

// `?wplace=0` (node: GTO_WPLACE=0): the street as it was before this pass, for before / after pictures
export const WPLACE_ON = !((typeof location !== 'undefined' && location && /[?&]wplace=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_WPLACE === '0'));

// ---- the street frame. Worcester Place is two straight legs meeting at the bend before Gate 3 (the map's w4993489):
// origin = the bend of the carriageway's middle line; u east along the east-west leg, v north along the north leg
// (the legs are square to each other to a quarter of a degree, and every outline here is square to them).
export const O = [-358.6, -138.2], AX = [0.9934278, -0.1144602], NV = [-0.1144602, -0.9934278];
/** street frame (u, v) -> world [x, z], and back */
export const W = (u, v) => [O[0] + u * AX[0] + v * NV[0], O[1] + u * AX[1] + v * NV[1]];
export const UV = (x, z) => [(x - O[0]) * AX[0] + (z - O[1]) * AX[1], (x - O[0]) * NV[0] + (z - O[1]) * NV[1]];
/** the street frame as a matrix: local x = u, y up, local z = -v (south) */
export const SF = () => frame(O[0], 0, O[1], AX[0], AX[1]);
/** in the street frame: a point [u, y, v] -> local [x, y, z] */
export const P3 = (u, y, v) => [u, y, -v];
/** face frames inside the street frame (x runs to the viewer's right, z out of the wall):
 *  FW: a wall looking west on the line u, x = 0 at its north end vN;   FE: looking east, x = 0 at its south end vS;
 *  FS: looking south on the line v, x = 0 at its west end uW;          FN: looking north, x = 0 at its east end uE */
export const FW = (u, vN) => frame(u, 0, -vN, 0, 1), FE = (u, vS) => frame(u, 0, -vS, 0, -1), FS = (uW, v) => frame(uW, 0, -v, 1, 0), FN = (uE, v) => frame(uE, 0, -v, -1, 0);
export const HALF_ROAD = 3.25;      // the carriageway's half width (the map's 6.5 m)

// ---- LEVELS: every height of the package in one table (metres above the ground beside each building; the ground
// itself, and its gentle falls, are the terrain's). Sources in worcester_wplace.js ATTR.
export const LV = {
  // Gloucester House: three storeys of 2.63 m (ADP's outline elevation), shallow double pitch (2022 height survey)
  gh: { storey: 2.63, sill: 1.0, winH: 1.25, eaves: 8.0, ridge: 9.5, projEaves: 6.84, wall: 1.9, parapet: 0.22 },
  // Franks Building: three storeys of 2.75 m; heights by block from the 2022 height survey
  fr: { storey: 2.75, sill: 0.95, winH: 1.3, band: [[0.55, 0.8], [3.4, 3.7], [6.15, 6.45]], eavesE: 8.7, ridgeE: 11.9, eavesD: 8.6, ridgeD: 10.8, eavesLow: 5.4, ridgeLow: 8.1, apexB: 7.4, eavesA: 8.6, ridgeA: 10.9, planter: 0.75,
    oriel: [2.75, 5.25], gate: 2.5 },
  // 10 Worcester Place: two storeys and an attic (survey drawing of 2006, height survey)
  n10: { eaves: 5.7, ridge: 8.1, stack: 9.2, floor: 0.7, string: 2.97, plinth: 0.36, f1: 3.43 },
  // the MCR's yard walls, the railed gap, the Earl Building's side gate, the cobbled circle
  yard: { wallW: 3.4, wallS: 2.2 }, gap: { pier: 1.6, rail: 1.45 }, earlGate: { pier: 2.1, gate: 2.0 }, circle: { dome: 0.1 }, paving: 0.05,
};

/**
 * A wall face (current face frame) with casements cut in it and brick bands laid over it.
 * wins = [[x0, y0, x1, y1, opts]] (opts as _worcester_south_kit `win`, plus head: 'seg' = a buff segmental head);
 * bands = [[y0, y1]] across the face, broken at `gaps` = [[x0, x1]]. o: { band, frame, cols, depth, sill, x0, x1 }
 */
export function bandWall(B, key, outline, wins = [], bands = [], o = {}) {
  B.face(key, outline, wins.map((w) => rectPts(w[0], w[1], w[2], w[3])));
  for (const w of wins) {
    const wo = { wall: key, frame: o.frame || 'white', cols: o.cols || 2, depth: o.depth === undefined ? 0.09 : o.depth, bar: 0.06, ...(w[4] || {}) };
    win(B, w[0], w[1], w[2], w[3], wo);
    if (wo.head === 'seg') segHead(B, o.band || 'wpBand', w[0], w[2], w[3]);
  }
  let x0 = Infinity, x1 = -Infinity; for (const p of outline) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
  if (o.x0 !== undefined) x0 = o.x0; if (o.x1 !== undefined) x1 = o.x1;
  const gaps = (o.gaps || []).slice().sort((a, b) => a[0] - b[0]);
  for (const [y0, y1] of bands) {
    let a = x0;
    for (const [g0, g1] of [...gaps, [x1, x1]]) { if (g0 > a + 0.02) B.poly(o.band || 'wpBand', [[a, y0, 0.015], [Math.min(g0, x1), y0, 0.015], [Math.min(g0, x1), y1, 0.015], [a, y1, 0.015]], [0, 0, 1]); a = Math.max(a, g1); }
  }
}
/** a segmental head of gauged brick over the opening x0..x1 whose lintel is at y (a low arc, 0.22 m deep) */
export function segHead(B, key, x0, x1, y, rise = 0.12, t = 0.22, n = 5) {
  const xa = x0 - 0.08, xb = x1 + 0.08, at = (k) => { const f = k / n, x = xa + (xb - xa) * f; return [x, y + rise * Math.sin(f * Math.PI)]; };
  for (let k = 0; k < n; k++) { const a = at(k), b = at(k + 1); B.poly(key, [[a[0], a[1], 0.018], [b[0], b[1], 0.018], [b[0], b[1] + t, 0.018], [a[0], a[1] + t, 0.018]], [0, 0, 1]); }
}
/** a painted whole-cell sash (no reveal): the cheap window for sides seen from far off. Lit at night like the others */
export const flatSash = (B, x0, y0, x1, y1, floor = 1, z = 0.014) => B.unit('sash', rectPts(x0, y0, x1, y1), z, bay(floor));

/**
 * A double-pitched roof in the street frame. ns = true: the ridge runs north-south (r = v along it, s = u across);
 * false: east-west (r = u, s = v). Eaves at ye on the wall lines s0 / s1, ridge at yr over `mid` (default the middle),
 * the slopes run `ov` past the walls and `og` past the ends. o.only = 0 / 1 draws one slope. Returns the slope's tan.
 */
export function pitched(B, key, ns, r0, r1, s0, s1, ye, yr, o = {}) {
  const ov = o.ov === undefined ? 0.3 : o.ov, og = o.og === undefined ? 0.15 : o.og, sm = o.mid === undefined ? (s0 + s1) / 2 : o.mid;
  const Q = (s, y, r) => (ns ? [s, y, -r] : [r, y, -s]);
  const side = (sw, k) => {
    const tn = (yr - ye) / Math.abs(sm - sw), se = sw + (sw < sm ? -ov : ov), y = ye - ov * tn, sg = sw < sm ? -1 : 1;
    B.poly(key, [Q(se, y, r0 - og), Q(se, y, r1 + og), Q(sm, yr, r1 + og), Q(sm, yr, r0 - og)], ns ? [sg, 1, 0] : [0, 1, -sg]);
    if (o.fascia) { const f = 0.14; B.poly(o.fascia, [Q(se, y - f, r0 - og), Q(se, y - f, r1 + og), Q(se, y, r1 + og), Q(se, y, r0 - og)], ns ? [sg, 0, 0] : [0, 0, -sg]); B.poly(o.fascia, [Q(se, y - f, r0 - og), Q(se, y - f, r1 + og), Q(sw, y - f, r1 + og), Q(sw, y - f, r0 - og)], [0, -1, 0]); }
    void k;
  };
  if (o.only !== 1) side(s0, 0);
  if (o.only !== 0) side(s1, 1);
  return (yr - ye) / Math.abs(sm - s0);
}
/** a gable wall's outline in a face frame: from x0 to x1, eaves at ye on both sides (or [yL, yR]), apex yr over xm */
export const gablePts = (x0, x1, ye, yr, xm = (x0 + x1) / 2, y0 = 0) => { const [a, b] = Array.isArray(ye) ? ye : [ye, ye]; return [[x0, y0], [x1, y0], [x1, b], [xm, yr], [x0, a]]; };

/** black railings in a face frame along x0..x1 at z: uprights every `gap`, a top and a bottom rail */
export function railings(B, x0, x1, h, z = 0, o = {}) {
  const gap = o.gap || 0.14, n = Math.max(1, Math.round((x1 - x0) / gap)), key = o.key || 'iron', y0 = o.y0 || 0.08;
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; B.boxXZ(key, x - 0.011, x + 0.011, y0, h, z - 0.011, z + 0.011, { top: false }); }
  for (const y of [y0 + 0.06, h - 0.1]) B.boxXZ(key, x0, x1, y - 0.02, y + 0.02, z - 0.016, z + 0.016, { bottom: true });
}
/** a brick pier with a flat stone cap (current frame), w square */
export function pier(B, key, x, z, w, h, cap = 'stoneDress') {
  B.boxXZ(key, x - w / 2, x + w / 2, 0, h, z - w / 2, z + w / 2, { top: false });
  B.boxXZ(cap, x - w / 2 - 0.05, x + w / 2 + 0.05, h, h + 0.1, z - w / 2 - 0.05, z + w / 2 + 0.05, { bottom: true });
}
/** a low brick planter wall along a polyline of the street frame [[u, v]], t thick, with a brick-on-edge coping */
export function lowWall(B, key, pts, h, t = 0.22, cope = null) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    B.push(frame(a[0], 0, -a[1], b[0] - a[0], -(b[1] - a[1])));
    const s0 = i ? t / 2 : -t / 2;      // (after a corner a length begins at the last one's face: no two faces in one plane)
    B.boxXZ(key, s0, l + t / 2, 0, h - 0.07, -t / 2, t / 2, { top: false });
    B.boxXZ(cope || key, s0 + (i ? 0.015 : -0.015), l + t / 2 + 0.015, h - 0.07, h, -t / 2 - 0.015, t / 2 + 0.015, { bottom: true });
    B.pop();
  }
}
/** a low wall along a polyline of the street frame [[u, v]] with mitred corners (for curved lengths): sides in `key`, top in `cope` */
export function stripWall(B, key, pts, h, t = 0.22, cope = null) {
  const n = pts.length, dir = (i) => { const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const Lf = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const d0 = dir(Math.max(0, i - 1)), d1 = dir(Math.min(n - 2, i)), n0 = [-d0[1], d0[0]], n1 = [-d1[1], d1[0]], k = 1 + n0[0] * n1[0] + n0[1] * n1[1], m = [((n0[0] + n1[0]) / k) * (t / 2), ((n0[1] + n1[1]) / k) * (t / 2)];
    Lf.push([pts[i][0] + m[0], pts[i][1] + m[1]]); Rt.push([pts[i][0] - m[0], pts[i][1] - m[1]]);
  }
  const Q = (p, y) => [p[0], y, -p[1]];
  for (let i = 0; i < n - 1; i++) {
    const d = dir(i), nl = [-d[1], 0, -d[0]];
    B.poly(key, [Q(Lf[i], 0), Q(Lf[i + 1], 0), Q(Lf[i + 1], h), Q(Lf[i], h)], nl);
    B.poly(key, [Q(Rt[i], 0), Q(Rt[i + 1], 0), Q(Rt[i + 1], h), Q(Rt[i], h)], [-nl[0], 0, -nl[2]]);
    B.poly(cope || key, [Q(Lf[i], h), Q(Lf[i + 1], h), Q(Rt[i + 1], h), Q(Rt[i], h)], [0, 1, 0]);
  }
  for (const [i, s] of [[0, -1], [n - 1, 1]]) { const d = dir(Math.min(n - 2, i)); B.poly(key, [Q(Lf[i], 0), Q(Rt[i], 0), Q(Rt[i], h), Q(Lf[i], h)], [s * d[0], 0, -s * d[1]]); }
}
export { bay };
