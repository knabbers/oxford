// Merton College (1264): geometry for places/merton.js — see docs/research/landmarks_batch5.md.
// Laid out in the chapel's frame (the mapped choir runs 13° north of east): u east along the choir, v south, origin M0.
import { RB, siteFrame, range, tower, statue, pointPts, rectPts, cityWall, ribbon, dormer, corners } from './_b5_kit.js';

export const F = siteFrame([520, 430], -0.2307);
const { Q, QR, QRv } = F;

export const MT = {
  choir: QR(-14.4, 16.3, -2.9, 9.6), trans: QRv(-27.5, -14.4, -14.8, 22.1),
  tower: { c: Q(-21, 3.35), w: 10.2, top: 37.4, pin: 6.4 },
  gate: QR(20.9, 28.9, -17.2, -10.4), gateU: 24.0,
  mob6: QR(-13.4, 5.5, 11.6, 18.3), treasury: QRv(7.8, 14.8, 16.9, 26.3), passV: 21.5,
  mob2: QRv(8.1, 15.2, 26.1, 40.8), mob5: QRv(-22.1, -14.2, 22.1, 37), libS: QR(-21, 9, 40.8, 48.3), libW: QRv(-21.6, -14, 36.7, 49.7),
  // the city wall along the Fellows' Garden (mapped w59290375, reversed so the meadow is to the left of travel), the bastion
  wall: [[721.5, 380.9], [720.3, 385.5], [718.7, 390.7], [711.5, 417.9], [701.5, 452.5], [639.2, 468], [635.2, 468.8], [626.1, 471.7], [584.4, 483.8], [583.2, 484.2], [572.1, 487.5], [561.3, 491.5], [554.7, 494.1], [545.2, 498.2], [534.9, 502.2], [520.2, 507.6], [511.9, 510.6], [490.9, 518.2]],
  bastion: [637.3, 470.8],
  street: [[487, 417.6], [536.9, 403], [543.7, 401.1], [578.7, 394], [607.4, 388.4], [616.5, 386.9], [642.3, 382.4], [657, 379.8], [658.3, 379.6], [704.5, 374.9], [706.3, 374.4]],
  streetW: 6.5,
  fellowsQuad: [572.2, 457.5], fqR: [9, 11],
};

/** the chapel: choir with the great east window, transepts, the crossing tower (1448-51) */
export function buildChapel(q) {
  const B = new RB();
  const dec = (w) => [4.8, 14.6, 'perp', w, 'point'];
  range(B, { R: MT.choir, farWin: true, h: 16.2, wall: 'stoneGrey', roof: 'gable', roofKey: 'lead', pitch: 0.55, parapet: 0.8, plinth: 0.5, strings: [4.3],
    buttress: { w: 1.0, d: 1.5, h: 14.5, pinnacle: true },
    sides: [{ rows: [[7.8, 14.6, 'perp', 2.6, 'point']], bay: 4.2 }, { rows: [dec(2.6)], bay: 4.2 },
      { extra: [{ x: 0, y0: 3.6, y1: 15.2, key: 'bigWin', w: 8.4, rec: 0.35, pts: pointPts(0, 8.4, 3.6, 15.2 - 8.4 * 0.62) }], noButtress: true }, {}], noWalls: [3] }, q);
  // transepts (south 14th century, north early 15th): a big Perpendicular window in each end, two to the west
  const P = (x, w, y0, y1) => ({ x, y0, y1, key: 'perp', w, rec: 0.3, pts: pointPts(x, w, y0, y1 - w * 0.68) });
  range(B, { R: MT.trans, farWin: true, h: 16.2, wall: 'stoneGrey', roof: 'gable', roofKey: 'lead', pitch: 0.62, parapet: 0.8, plinth: 0.5, strings: [4.3], coped: true,
    buttress: { w: 1.0, d: 1.3, h: 14.5 },
    sides: [{ extra: [P(-12.6, 2.6, 5, 14.2), P(12.6, 2.6, 7.5, 14.2)], noButtress: true }, { extra: [P(12.4, 2.6, 5, 14.2), P(-12.4, 2.6, 8.8, 14.2)], noButtress: true },
      { extra: [P(0, 5.6, 9.2, 15.4)], noButtress: true }, { extra: [P(0, 6.2, 4.0, 15.4)], noButtress: true }] }, q);
  // the crossing tower: plain lower stages above the roofs, a blind stage, the tall paired belfry lights, a pierced
  // battlemented parapet, tall corner pinnacles and smaller ones between
  const T = MT.tower, faces = [0, 1, 2, 3].map(() => [{ key: 'leaded', pts: pointPts(-1.5, 0.9, 22.6, 25.6 - 0.6) }, { key: 'leaded', pts: pointPts(1.5, 0.9, 22.6, 25.6 - 0.6) }]);
  tower(B, { cx: T.c[0], cz: T.c[1], a: F.a, w: T.w, top: T.top, wall: 'stoneGrey', stages: [[12, T.top, 'stoneGrey']], strings: [21.4, 27.2, 36.6], crenel: true, merlons: 5, pinnacles: [T.pin, true], corner: 1.25,
    belfry: { y0: 28.0, y1: 35.6, key: 'louvre', n: 2, w: 1.9 }, faces }, q);
  return B;
}

/** the gate tower on Merton Street (1418): the gate passage, the carved panel over it, two statues in niches */
export function buildGate(q) {
  const B = new RB(), R = MT.gate, uc = (20.9 + 28.9) / 2, xg = MT.gateU - uc, gw = 3.0;
  // side 1 = north (street, its local x runs -u), side 0 = south (Front Quad, local x +u)
  const gate = (n) => ({ x: n ? -xg : xg, y0: 0, y1: 4.4, key: null, farKey: 'shade', w: gw, rec: R.W, open: true, noReveal: !n, pts: pointPts(n ? -xg : xg, gw, 0, 4.4 - gw * 0.6) });
  const N = (x, y0) => ({ x, y0, y1: y0 + 2.6, key: 'niche', w: 1.1, rec: 0.32, pts: pointPts(x, 1.1, y0, y0 + 2.6 - 0.75) });
  range(B, { R, h: 19.2, wall: 'stoneGrey', roof: 'flat', roofKey: 'lead', crenel: true, parapet: 0.9, plinth: 0.45, strings: [5.0, 11.8, 15.4],
    sides: [{ extra: [gate(0), { x: xg, y0: 6.0, y1: 8.6, key: 'mullion', w: 2.0, pts: rectPts(xg - 1.0, 6.0, xg + 1.0, 8.6) }, { x: xg, y0: 12.4, y1: 14.6, key: 'mullion', w: 1.8, pts: rectPts(xg - 0.9, 12.4, xg + 0.9, 14.6) }] },
      { extra: [gate(1), { x: -xg, y0: 5.4, y1: 7.6, key: 'niche', w: 3.6, rec: 0.12, pts: rectPts(-xg - 1.8, 5.4, -xg + 1.8, 7.6) }, N(-xg - 2.3, 8.6), N(-xg + 2.3, 8.6), { x: -xg, y0: 8.8, y1: 11.2, key: 'mullion', w: 1.6, pts: rectPts(-xg - 0.8, 8.8, -xg + 0.8, 11.2) }, { x: -xg, y0: 12.4, y1: 14.6, key: 'mullion', w: 1.8, pts: rectPts(-xg - 0.9, 12.4, -xg + 0.9, 14.6) }] },
      { rows: [[12.4, 14.6, 'leaded', 1.0]], bay: 3 }, { rows: [[12.4, 14.6, 'leaded', 1.0]], bay: 3 }] }, q);
  // the two statues in the street front's niches (G: who they are is not shown; plain robed figures)
  if (q < 2) for (const dx of [-2.3, 2.3]) { const p = Q(MT.gateU - dx, -17.2 - 0.0 + 0.16); statue(B, p[0], 8.65, p[1], F.H.nv, q, 'statue', 0.82); }
  // the relief panel's figures: two small kneeling shapes and a standing one, in low relief (plain carving)
  if (q === 0) {
    B.push(F.face(MT.gateU, -17.2 - 0.12, 'nv'));
    for (const [x, hgt] of [[-1.0, 1.1], [0.1, 1.6], [1.1, 0.9]]) B.box('statueDk', x, 5.55 + hgt / 2, 0.05, 0.42, hgt, 0.18, 0, {});
    B.card('sign_merton', [-1.2, 3.05 + 1.95, 0.24], [1.2, 3.05 + 1.95, 0.24], [1.2, 3.45 + 1.95, 0.24], [-1.2, 3.45 + 1.95, 0.24], [0.004, 0.004, 0.996, 0.996]);
    B.pop();
  }
  return B;
}

/** Mob Quad (1288-1378): two-storey rubble ranges under steep stone-slate roofs; the Treasury's steep roof in the NE
 *  corner; the Old Library on the south and west with its dormers */
export function buildMob(q) {
  const B = new RB();
  const two = (bay = 3.1) => ({ rows: [[1.1, 2.8, 'leaded', 1.15], [4.3, 6.0, 'leaded', 1.15]], bay });
  const base = { h: 7.0, wall: 'rubble', dress: 'stoneGrey', roof: 'gable', roofKey: 'stoneSlate', ridgeKey: 'stoneDk', pitch: 0.95, coped: true };
  range(B, { ...base, R: MT.mob6, sides: [two(), two(), {}, {}] }, q);
  range(B, { ...base, R: MT.mob2, sides: [two(), two(), {}, {}] }, q);
  range(B, { ...base, R: MT.mob5, sides: [two(), two(), {}, {}] }, q);
  // the Treasury (the muniment room, c. 1288): taller, a steep hipped stone roof; the passage from Patey's Quad
  {
    const R = MT.treasury, vc = (16.9 + 26.3) / 2, x0 = MT.passV - vc;
    const pass = (s) => ({ x: s ? -x0 : x0, y0: 0, y1: 3.0, key: null, farKey: 'shade', w: 2.2, rec: R.W, open: true, noReveal: !!s, pts: pointPts(s ? -x0 : x0, 2.2, 0, 3.0 - 1.3) });
    range(B, { ...base, R, h: 8.2, roof: 'hip', pitch: 1.1, coped: false, sides: [{ extra: [pass(0), { x: x0, y0: 4.6, y1: 6.4, key: 'leaded', w: 0.9, pts: rectPts(x0 - 0.45, 4.6, x0 + 0.45, 6.4) }] }, { extra: [pass(1)] }, { rows: [[4.6, 6.4, 'leaded', 0.8]], bay: 3 }, { rows: [[4.6, 6.4, 'leaded', 0.8]], bay: 3 }] }, q);
  }
  // the library: narrow lancets all along the upper floor (the reading room), small lights below, dormers in the roof
  const lib = { rows: [[1.2, 2.8, 'leaded', 1.0], [4.0, 6.6, 'leaded', 0.75, 'point']], bay: 1.9 };
  range(B, { ...base, h: 7.4, R: MT.libS, sides: [{ ...lib, skip: (x) => x < -7.3 }, { ...lib, skip: (x) => x > 7.3 }, {}, {}] }, q);
  range(B, { ...base, h: 7.4, R: MT.libW, sides: [lib, { ...lib, skip: (x) => x > -5.6 && x < 2.9 }, {}, {}] }, q);
  if (q < 2) for (const [R, n] of [[MT.libS, 5], [MT.libW, 3]]) for (let k = 0; k < n; k++) { const u = -R.L / 2 + (k + 0.5) * (R.L / n); for (const sd of [1, -1]) dormer(B, R, u, sd, 7.4, 0.95, { w: 1.3, h: 1.3, back: 1.5, bay: k + 3 }); }
  // a name notice at the Mob Quad passage
  if (q === 0) { B.push(F.face(14.8 + 0.02, MT.passV - 2.2, 'u')); B.card('sign_time', [-0.6, 1.5, 0], [0.6, 1.5, 0], [0.6, 1.85, 0], [-0.6, 1.85, 0], [0.004, 0.004, 0.996, 0.996]); B.pop(); }
  return B;
}

/** the Fellows' Garden wall on Christ Church Meadow (the city wall, with its bastion) */
export function buildWall(q) {
  const B = new RB();
  const W = MT.wall, b = MT.bastion;
  // the bastion's outward normal: south-east of the wall line there
  // (no bastion drawn at the mapped bump: the map puts Dead Man's Walk's benches there)
  cityWall(B, { lines: [W], bastions: [], H: 5.2, key: 'wallOld' }, q); void b;
  return B;
}
/** Merton Street's cobbles (a ground-layer ribbon over the street's setts) */
export function buildCobbles() { const B = new RB(); ribbon(B, 'cobbles', MT.street, MT.streetW + 0.1, 0.044); return B; }
/** footprints for collision */
export const SOLIDS = () => [MT.choir, MT.trans, MT.mob6, MT.mob2, MT.mob5, MT.libS, MT.libW].map((R) => corners(R));
