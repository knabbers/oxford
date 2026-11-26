// Keble College (Butterfield, 1868-82): geometry for places/keble.js — see docs/research/landmarks_batch5.md.
// Frame: u east along the chapel (Parks Road at u ~ 51), v south across Liddon Quad. Origin K0.
import { RB, siteFrame, range, pointPts, rectPts, corners, offsetLine } from './_b5_kit.js';

export const F = siteFrame([150, -460], -0.333);
const { Q, QR, QRv } = F;

export const KB = {
  chapel: QR(-6, 35.9, -43.2, -28),
  chapelBlock: QR(-47.1, -6, -43.6, -31.7), west: QRv(-44.9, -34.5, -28, 37.9),
  front: QRv(31.5, 41.3, -27.1, 33), gate: QRv(27.6, 41.5, 33, 39.2), gateV: 36.1, lodge: QRv(27.3, 39.1, 39.2, 44.5), pusey: QRv(27, 38, 44.5, 88.6),
  hall: QR(-57, -22.2, 37.9, 52.3), library: QR(-22.3, 16.7, 37.9, 51.6),
  // Liddon Quad's lawn (mapped w90709811), its edge inset to the lip of the sunken lawn
  lawn: [[-28.3, -18.6], [-23.9, -22.7], [-14.8, -22.5], [-11.1, -22.4], [-8.5, -19.4], [20.8, -19.2], [25.2, -14.9], [25.6, 10.5], [25.7, 27.7], [21, 32.2], [-13.8, 32.3], [-22.7, 32.3], [-27.7, 28.3], [-27.9, 11.2]],
};

const three = (bay = 3.4, w = 1.5) => ({ rows: [[1.3, 3.2, 'mullion', w], [4.7, 6.7, 'mullion', w], [8.1, 9.8, 'mullion', w]], bay });
const CHAPEL_PITCH = 0.62;      // rad: the chapel's shallow roof (was 1.0)
const base = { h: 11.0, wall: 'poly', dress: 'dress', roof: 'gable', roofKey: 'slate', pitch: 0.95, coped: true, plinth: 0.6, strings: [3.9, 7.4] };

/** the chapel (1876): very tall polychrome brick, deep buttresses, a band of patterned blind wall below tall two-light
 *  windows with plate tracery; the great east window over Parks Road. Photographs (docs/research/photo_comparison.md)
 *  refute the earlier guess of a steep slate roof with a flèche: the roof is a shallow one in pale lead-grey sheet behind
 *  the eaves, there is no flèche, and every buttress ends in a pinnacle standing above the eaves */
export function buildChapel(q) {
  const B = new RB();
  const hi = { rows: [[10.6, 19.0, 'bigWin', 3.0, 'point']], bay: 5.2 };
  range(B, { R: KB.chapel, farWin: true, h: 21.0, wall: 'poly', dress: 'dress', roof: 'gable', roofKey: 'lead', ridgeKey: 'lead', pitch: CHAPEL_PITCH, coped: true, plinth: 0.8, strings: [4.2, 9.6, 10.4],
    buttress: { w: 1.2, d: 1.8, h: 19.0, pinnacle: true },
    sides: [hi, hi, { extra: [{ x: 0, y0: 9.0, y1: 20.2, key: 'bigWin', w: 7.4, rec: 0.4, pts: pointPts(0, 7.4, 9.0, 20.2 - 7.4 * 0.62) }, { x: 0, y0: 22.4, y1: 25.0, key: 'leaded', w: 1.8, pts: pointPts(0, 1.8, 22.4, 25.0 - 1.1) }], noButtress: true }, {}] }, q);
  // a gilded cross on the east gable
  if (q < 2) { const e = Q(35.9, -35.6), roofH = Math.tan(CHAPEL_PITCH) * (KB.chapel.W / 2); B.box('gold', e[0], 21 + roofH + 0.9, e[1], 0.14, 1.6, 0.14, 0); B.box('gold', e[0], 21 + roofH + 1.25, e[1], 0.14, 0.14, 0.8, -F.a); }
  return B;
}

/** Liddon Quad's ranges and the Parks Road front: three storeys of polychrome brick with stone-dressed mullioned windows,
 *  steep slate roofs, the gatehouse with its arch; the hall (1878) and library on the south side */
export function buildRanges(q) {
  const B = new RB();
  range(B, { ...base, R: KB.chapelBlock, sides: [three(), three(), {}, {}] }, q);
  range(B, { ...base, R: KB.west, sides: [three(), three(), {}, {}] }, q);
  range(B, { ...base, R: KB.front, sides: [three(), three(), {}, {}] }, q);
  range(B, { ...base, R: KB.lodge, h: 9.6, sides: [three(3.2), three(3.2), {}, {}] }, q);
  range(B, { ...base, R: KB.pusey, sides: [three(), three(), {}, {}] }, q);
  // the gatehouse: taller, a steep hipped roof, the arch through to the quad, the name board over it
  {
    const R = KB.gate, gw = 3.4;
    const g = (s) => ({ x: 0, y0: 0, y1: 4.8, key: null, farKey: 'shade', w: gw, rec: R.W, open: true, noReveal: s === 0, revKey: 'dress', pts: pointPts(0, gw, 0, 4.8 - gw * 0.6) });
    range(B, { ...base, R, h: 14.2, roof: 'hip', pitch: 1.15, coped: false, strings: [3.9, 6.2, 10.4],
      sides: [{ extra: [g(0), { x: 0, y0: 7.0, y1: 9.8, key: 'mullion', w: 2.4, pts: rectPts(-1.2, 7.0, 1.2, 9.8) }] }, { extra: [g(1), { x: 0, y0: 5.2, y1: 5.8, key: 'sign_keble', w: 2.6, rec: 0.02, noReveal: true, noSill: true, pts: rectPts(-1.3, 5.2, 1.3, 5.8) }, { x: 0, y0: 7.0, y1: 9.8, key: 'mullion', w: 2.4, pts: rectPts(-1.2, 7.0, 1.2, 9.8) }, { x: 0, y0: 11.0, y1: 13.2, key: 'mullion', w: 1.6, pts: rectPts(-0.8, 11.0, 0.8, 13.2) }] }, {}, {}] }, q);
  }
  // the hall: raised over a basement, five tall windows to the quad, a very steep roof; the library beside it
  const hallW = { rows: [[1.0, 2.6, 'leaded', 1.2], [6.2, 12.4, 'bigWin', 2.4, 'point']], bay: 5.0 };
  range(B, { ...base, R: KB.hall, h: 13.4, pitch: 1.05, buttress: { w: 0.9, d: 1.2, h: 12 }, strings: [3.9, 5.6], sides: [hallW, hallW, {}, { extra: [{ x: 0, y0: 6.4, y1: 12.8, key: 'bigWin', w: 4.2, pts: pointPts(0, 4.2, 6.4, 12.8 - 2.6) }] }], noWalls: [2] }, q);
  const libW = { rows: [[1.2, 3.2, 'mullion', 1.5], [5.4, 10.0, 'perp', 1.8, 'point']], bay: 3.9 };
  range(B, { ...base, R: KB.library, h: 11.6, sides: [libW, libW, {}, {}] }, q);
  return B;
}

/** the sunken lawn's lip: a low stone-kerbed grass bank round the mapped lawn (the lawn sits below it); "keep off" signs */
export function buildLawnLip(q) {
  const B = new RB(), ring = KB.lawn.map(([u, v]) => Q(u, v)), closed = [...ring, ring[0], ring[1]];
  // the ring is clockwise in the frame: inward is to the LEFT of travel? test with the centroid
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const t = offsetLine(closed, 1), sgn = Math.hypot(t[1][0] - cx, t[1][1] - cz) < Math.hypot(closed[1][0] - cx, closed[1][1] - cz) ? 1 : -1;
  const O = offsetLine(closed, -0.05 * sgn), I1 = offsetLine(closed, 0.35 * sgn), I2 = offsetLine(closed, 1.9 * sgn), y1 = 0.48, y2 = 0.035;
  for (let i = 1; i < closed.length - 1; i++) {
    const a = O[i], b = O[i + 1], c = I1[i], d = I1[i + 1], e = I2[i], f = I2[i + 1];
    B.poly('dress', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [a[0] - c[0], 0, a[1] - c[1]]);   // the stone kerb face
    B.poly('dress', [[a[0], y1, a[1]], [b[0], y1, b[1]], [d[0], y1, d[1]], [c[0], y1, c[1]]], [0, 1, 0]);                       // its coping
    B.poly('turf', [[c[0], y1, c[1]], [d[0], y1, d[1]], [f[0], y2, f[1]], [e[0], y2, e[1]]], [0, 1, 0]);                         // the bank down to the lawn
  }
  if (q === 0) for (const [u, v] of [[-26, -16.5], [23.5, 30]]) { const p = Q(u, v); B.box('iron', p[0], 0.7, p[1], 0.06, 1.0, 0.06, 0); B.push(F.face(u, v + 0.05, 'v')); B.card('sign_grass', [-0.6, 0.95, 0], [0.6, 0.95, 0], [0.6, 1.3, 0], [-0.6, 1.3, 0], [0.004, 0.004, 0.996, 0.996]); B.pop(); }
  return B;
}
export const lawnWorld = () => KB.lawn.map(([u, v]) => Q(u, v));
export const SOLIDS = () => [KB.chapel, KB.chapelBlock, KB.west, KB.front, KB.lodge, KB.pusey, KB.hall, KB.library].map((R) => corners(R));
