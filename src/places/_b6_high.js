// The High Street curve (batch 6): geometry for places/high_street.js — see docs/research/landmarks_batch6.md.
// World coordinates (x east, z south). Every front is a rect from the mapped street edge (frontRect: side 0 = street).
//   The Queen's College   Hawksmoor / Townesend screen (1733-36) and cupola over the gate with Queen Caroline, the two
//                         tall pedimented ends of the Front Quad's west and east ranges, the ranges' quad arcades
//   All Souls College     the 15th-century High Street front: battlemented ranges, the gate tower with its two statue
//                         niches; the Warden's Lodgings (1704-06, classical) at its east end
//   University College    the long 17th-century Gothic front (Main Quad 1634-77, Radcliffe Quad 1716-19): two storeys,
//                         gabled attics, two gate towers each with a statue niche over the arch and an oriel
//   Examination Schools   T. G. Jackson's Jacobean front (1876-82, Clipsham stone): two tall storeys of mullion-and-
//                         transom windows, slightly projecting end bays, the carved porch on Ionic columns, the louvre
// (St Mary's south porch and All Souls' twin towers belong to places/radcliffe_square.js and are left alone.)
import { RB, range, tower, corners } from './_b5_kit.js';
import { frame } from './_worcester_kit.js';
import { ROOFSCAPE } from '../world/landmarks.js';   // ?roofs=0: the fronts as before (photo comparison items 14-15)
import { frontRect, sideFrame, sideToward, pushSide, sidePt, op, bays, facade, pediment, balustrade, gableRow, pinnacle, battlements, figure, hullRect, rectPts, archPts, pointPts, TAU } from './_b6_kit.js';

const N = (x, z) => [x, z + 12], S_ = (x, z) => [x, z - 12];   // a point in the street from a north- / south-side front

// ------------------------------------------------------------------------------------------------ Queen's
export const QN = {
  west: hullRect([[584.0, 241.1], [594.4, 241.4], [598.8, 178.9], [588.5, 178.2]]),
  east: hullRect([[637.3, 246.2], [649.0, 247.0], [652.0, 205.8], [640.5, 200.2], [637.6, 240.7]]),
  screen: frontRect([594.4, 241.5], [637.4, 244.8], 1.6, N(615, 243)),
  quad: [616, 215],
  street: [616, 258],
};
{ const Sc = QN.screen, g = sidePt(Sc, 0, 0, 0), L = Sc.L; QN.gateAt = g; QN.gate = frontRect(sidePt(Sc, 0, -4.2, 0.6), sidePt(Sc, 0, 4.2, 0.6), 7.2, QN.street);
  QN.screenW = frontRect(sidePt(Sc, 0, -L / 2, 0), sidePt(Sc, 0, -4.2, 0), 1.6, QN.street); QN.screenE = frontRect(sidePt(Sc, 0, 4.2, 0), sidePt(Sc, 0, L / 2, 0), 1.6, QN.street); }
QN.cupola = (() => { const c = sidePt(QN.gate, 0, 0, -3.3); return { c, base: 8.4, r: 2.35, colH: 4.6, domeR: 2.75 }; })();

function queensRange(B, R, q, east) {
  const hi = sideToward(R, [R.cx, R.cz + 60]), lo = sideToward(R, [R.cx, R.cz - 80]), quad = sideToward(R, QN.quad);
  const out = [0, 1, 2, 3].find((i) => i !== hi && i !== lo && i !== quad);
  const longRows = { rows: [[1.0, 3.6, 'roundSash', 1.3, 'round'], [5.0, 8.1, 'sash', 1.4], [9.3, 11.4, 'sash', 1.25]], bay: 3.4 };
  const arcade = { rows: [[0, 3.9, null, 2.6, 'round'], [5.0, 8.1, 'sash', 1.4], [9.3, 11.4, 'sash', 1.25]], bay: 3.4 };
  for (const r of arcade.rows) if (!r[2]) r[2] = 'shade';
  const sides = []; sides[quad] = arcade; sides[out] = longRows; sides[lo] = {};
  const h = 12.6, pitch = 0.56;
  range(B, { R, h, wall: 'stone', dress: 'dress', roof: 'gable', roofKey: 'slate', pitch, plinth: 0.4, strings: [4.4], sides, noWalls: [hi] }, q);
  // the pedimented end on the High: rusticated ground storey, giant pilasters, three round-headed bays, the pediment
  const F = pushSide(B, R, hi), L = F.L, xs = bays(3, 3.0);
  facade(B, {
    L, bands: [[0, 4.4, 'rustic'], [4.4, h, 'stone']],
    ops: [...xs.map((x) => op(x, 1.0, 3.6, 'roundSash', 1.3, 'round')), ...xs.map((x) => op(x, 5.2, 8.8, 'roundSash', 1.5, 'round', { hood: true })), ...xs.map((x) => op(x, 9.6, 11.5, 'sash', 1.25))],
    strings: [[4.4, 0.32, 0.2]], pilasters: { xs: [-4.5, -1.5, 1.5, 4.5].map((x) => x * L / 10.4), w: 0.62, d: 0.2, y0: 4.6, y1: 12.2, cap: true },
    cornice: [12.2, 0.55, 0.55],
  }, q);
  const rise = Math.tan(pitch) * (L / 2);
  pediment(B, L + 0.6, h + 0.25, rise, 'stone', 'dress', q, { acroteria: !east && !ROOFSCAPE });
  if (q < 2) { const oc = 0.18; B.unit('roundSash', archPts(0, 1.0, h + 0.9, h + 0.9 + 0.5, 8), oc, [9, 3]); }
  // statues on the pediment of both pavilions (high_curve: both ends carry figures)
  if ((east || ROOFSCAPE) && q < 2) for (const [x, y] of [[-L / 2 + 0.4, h + 0.75], [0, h + rise + 0.75], [L / 2 - 0.4, h + 0.75]]) { B.box('dress', x, y - 0.2, 0.0, 0.8, 0.4, 0.7, 0); figure(B, x, y, 0.0, q, 'statue', 1.1); }
  B.pop();
}
export function buildQueens(q) {
  const B = new RB();
  queensRange(B, QN.west, q, false);
  queensRange(B, QN.east, q, true);
  // the screen: rusticated, a niche in every bay, a balustrade; the gate block in the middle
  const top = 6.6;
  for (const Sc of [QN.screenW, QN.screenE]) {
    const F = pushSide(B, Sc, 0), L = F.L, nx = bays(Math.max(1, Math.floor((L - 0.6) / 3.4)), 3.4);
    facade(B, { L, bands: [[0, top, 'rustic']], ops: nx.map((x) => op(x, 1.6, 4.9, 'niche', 1.3, 'round', { rec: 0.35 })), strings: [[top - 0.25, 0.5, 0.35]] }, q);
    balustrade(B, -L / 2, L / 2, top, 1.0, -0.6, q, 'balus');
    // item 15 (high_curve): urns on the screen's balustrade, one over each niche bay
    if (ROOFSCAPE && q < 2) for (const x of nx) B.lathe('portland', x, -0.6, [[0.26, top + 1.14], [0.3, top + 1.3], [0.18, top + 1.42], [0.36, top + 1.72], [0.32, top + 1.98], [0.14, top + 2.08], [0.1, top + 2.25], [0, top + 2.32]], { seg: q ? 6 : 8 });
    B.pop();
    // the back of the screen (to the quad) and its top
    { pushSide(B, Sc, 1); B.poly('stone', [[-L / 2, 0, 0], [L / 2, 0, 0], [L / 2, top, 0], [-L / 2, top, 0]], [0, 0, 1]); B.pop(); }
    { const c = corners(Sc, -0.02); B.poly('stoneDk', c.map(([x, z]) => [x, top + 0.01, z]), [0, 1, 0]); }
  }
  // the gate block: a big round arch through, pilasters, a deep cornice, the inscription, the cupola on top
  const G = QN.gate, gh = QN.cupola.base;
  range(B, { R: G, h: gh, wall: 'rustic', dress: 'dress', roof: 'flat', roofKey: 'lead', sides: [
    { extra: [{ ...op(0, 0, 5.6, null, 3.6, 'round', { open: true, rec: G.W, revKey: 'stoneDk', noSill: true }), farKey: 'shade' }] },
    { extra: [{ ...op(0, 0, 5.6, null, 3.6, 'round', { open: true, rec: G.W, revKey: 'stoneDk', noSill: true, noReveal: true }), farKey: 'shade' }] }, {}, {}] }, q);
  {
    const F3 = pushSide(B, G, 0), Lg = F3.L;
    if (q < 2 && !ROOFSCAPE) for (const x of [-2.9, -2.2, 2.2, 2.9]) B.box('portland', x, gh / 2, 0.2, 0.55, gh - 0.6, 0.4, 0, { top: true });
    // item 15 (high_queens): two pairs of free columns banded with vermiculated drums either side of the arch, on
    // pedestals, a deep block of entablature over each pair; rusticated voussoirs round the arch
    if (ROOFSCAPE) {
      const cy0 = 0.9, cy1 = gh - 0.9, nd = 7, dh = (cy1 - cy0) / nd, sg = q === 0 ? 10 : q === 1 ? 7 : 5;
      for (const x of [-3.15, -2.3, 2.3, 3.15]) {
        B.box('dress', x, cy0 / 2, 0.5, 0.86, cy0, 0.86, 0, { top: true });
        if (q === 2) { B.cyl('portland', x, cy0, 0.5, 0.36, cy1 - cy0, sg, false, 0.34); continue; }
        for (let k = 0; k < nd; k++) B.cyl(k % 2 ? 'stoneDk' : 'portland', x, cy0 + k * dh, 0.5, k % 2 ? 0.43 : 0.35, dh, sg, false, k % 2 ? 0.43 : 0.34);
        B.box('dress', x, cy1 + 0.18, 0.5, 0.82, 0.36, 0.82, 0, { top: false, bottom: true });
      }
      for (const sx of [-1, 1]) B.box('dress', sx * 2.725, cy1 + 0.55, 0.45, 1.85, 0.4, 1.0, 0, { bottom: true });
      if (q < 2) for (let k = 0; k <= 8; k++) { const t = Math.PI * (k / 8), r = 2.3; B.box(k % 2 ? 'stoneDk' : 'dress', Math.cos(t) * r, 5.6 - 1.8 + Math.sin(t) * r, 0.12, 0.62, 0.62, 0.3, 0, {}); }
    }
    B.box('dress', 0, gh - 0.1, 0.3, Lg + 0.4, 0.5, 0.6, 0, { bottom: true });
    if (q < 2) B.card('sign6_carolina', [-1.6, 6.2, 0.04], [1.6, 6.2, 0.04], [1.6, 7.0, 0.04], [-1.6, 7.0, 0.04], [0.004, 0.004, 0.996, 0.996]);
    // the wrought-iron gates, open by day: each leaf folded back against the side of the arch (bars, rails, a crest)
    if (q === 0 && !ROOFSCAPE) for (const sg of [-1, 1]) {
      const x = sg * 1.66;
      for (let z = -0.45; z > -2.2; z -= 0.19) B.box('iron', x, 1.75, z, 0.035, 3.3, 0.035, 0, {});
      for (const y of [0.25, 1.4, 3.3]) B.box('iron', x, y, -1.32, 0.05, 0.07, 1.8, 0, {});
    }
    // the great panelled doors (high_queens), open by day: each leaf folded back against the side of the arch
    if (q < 2 && ROOFSCAPE) for (const sg of [-1, 1]) {
      B.push(frame(sg * 1.64, 0, -1.25, 0, sg));
      B.box('oak', 0, 2.2, 0.04, 1.75, 4.3, 0.08, 0, { top: true });   // under the vault (4.5 m at the side of the arch)
      B.unit('door', rectPts(-0.82, 0.05, 0.82, 4.3), 0.085, [0, 0]);
      B.pop();
    }
    B.pop();
  }
  // the cupola: eight columns on a round plinth, entablature, a lead dome, a lantern and ball; Queen Caroline on her
  // stepped pyramid inside
  const C = QN.cupola, [cx, cz] = C.c, y0 = gh + 0.05, seg = q === 2 ? 10 : q === 1 ? 14 : 20;
  B.lathe('portland', cx, cz, [[C.r + 0.55, y0], [C.r + 0.55, y0 + 0.6], [C.r + 0.35, y0 + 0.7]], { seg });
  B.lathe('stoneDk', cx, cz, [[C.r + 0.35, y0 + 0.7], [0, y0 + 0.7]], { seg: Math.min(seg, 12) });
  const cTop = y0 + 0.7 + C.colH;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + TAU / 16, x = cx + Math.sin(a) * C.r, z = cz + Math.cos(a) * C.r; B.cyl('portland', x, y0 + 0.7, z, 0.24, C.colH, q === 2 ? 5 : 8, false, 0.28); if (q < 2) B.box('portland', x, cTop - 0.12, z, 0.62, 0.24, 0.62, a); }
  B.lathe('portland', cx, cz, [[C.r + 0.5, cTop], [C.r + 0.5, cTop + 0.75], [C.r + 0.75, cTop + 0.95], [C.r + 0.2, cTop + 1.05]], { seg });
  B.lathe('portland', cx, cz, [[C.r - 0.45, cTop], [C.r - 0.45, cTop + 0.75]], { seg, inside: true });
  B.lathe('portland', cx, cz, [[C.r - 0.45, cTop], [C.r + 0.5, cTop]], { seg });
  B.lathe('stoneShade', cx, cz, [[0, cTop + 0.7], [C.r - 0.45, cTop + 0.7]], { seg: Math.min(seg, 12) });
  const dome = []; for (let i = 0; i <= (q === 2 ? 4 : 7); i++) { const t = (i / (q === 2 ? 4 : 7)) * Math.PI / 2; dome.push([Math.cos(t) * C.domeR, cTop + 1.05 + Math.sin(t) * C.domeR * 0.92]); }
  dome[dome.length - 1][0] = 0.55;
  B.lathe('lead', cx, cz, dome, { seg, crease: 0.9 });
  const lt = cTop + 1.05 + C.domeR * 0.92;
  B.lathe('portland', cx, cz, [[0.55, lt], [0.5, lt + 1.1], [0.62, lt + 1.25], [0, lt + 1.5]], { seg: 8 });
  B.lathe('gold', cx, cz, [[0, lt + 1.45], [0.22, lt + 1.68], [0, lt + 1.92]], { seg: 6 });
  // the statue on its stepped pyramid
  for (let k = 0; k < 4; k++) { const s = 2.2 - k * 0.42; B.box('portland', cx, y0 + 0.7 + k * 0.28 + 0.14, cz, s, 0.28, s, QN.screen.a, { top: true }); }
  const fy = y0 + 0.7 + 4 * 0.28;
  B.lathe('statue', cx, cz, [[0.42, fy], [0.36, fy + 0.4], [0.3, fy + 1.2], [0.24, fy + 1.55], [0.1, fy + 1.66]], { seg: q ? 6 : 9 });
  B.lathe('statueDk', cx, cz, [[0, fy + 1.64], [0.11, fy + 1.7], [0.12, fy + 1.84], [0.16, fy + 1.92], [0, fy + 2.02]], { seg: q ? 6 : 9 });
  return B;
}

// ------------------------------------------------------------------------------------------------ All Souls (the High)
export const AS = {
  st1: frontRect([463.8, 253.1], [477.9, 249.5], 7.0, N(470, 252), { ext: 0.2 }),
  tower: frontRect([477.7, 249.55], [483.6, 247.95], 7.4, N(480, 249), { fwd: 0.5 }),   // the mapped gate passage is at x 480.5
  st6: frontRect([483.4, 248.0], [498.5, 243.6], 7.0, N(490, 246), { ext: 0.2 }),
  st7: frontRect([498.5, 243.6], [511.5, 242.0], 7.0, N(505, 243), { ext: 0.2 }),
  st8: frontRect([511.5, 242.0], [521.5, 241.2], 7.0, N(516, 242), { ext: 0.2 }),
  warden: frontRect([521.5, 241.2], [538.5, 239.8], 10.2, N(530, 240), { ext: 0.1 }),
  wings: [hullRect([[488.8, 236.6], [496.4, 234.9], [497.3, 238.9], [489.6, 240.4]]), hullRect([[512.5, 228.5], [520.4, 229.5], [520.6, 235.2], [513.2, 235.0]]), hullRect([[535.9, 223.7], [543.1, 223.1], [543.9, 230.8], [536.4, 231.2]])],
  street: [500, 262],
};
const asRows = { rows: [[1.4, 3.5, 'mullion', 1.7], [5.0, 7.3, 'mullion', 1.7]], bay: 3.3 };
function asRange(B, R, q, o = {}) {
  const st = 0;
  const sides = []; sides[st] = { ...asRows, skip: o.skip }; sides[1] = { rows: asRows.rows, bay: 3.3 };
  range(B, { R, h: o.h || 9.0, wall: 'stoneGrey', dress: 'dress', roof: 'flat', roofKey: 'lead', crenel: true, parapet: 0.8, plinth: 0.35, strings: [4.3], sides, noWalls: o.noWalls }, q);
  if (q === 0) { const F = pushSide(B, R, st); const nb = Math.max(0, Math.floor((F.L - 0.8) / 3.3)); for (const x of bays(nb, 3.3)) if (!(o.skip && o.skip(x))) for (const y of [3.62, 7.42]) B.box('dress', x, y, 0.07, 2.1, 0.13, 0.14, 0, { bottom: true }); B.pop(); }
}
export function buildAllSouls(q) {
  const B = new RB();
  asRange(B, AS.st1, q, { noWalls: [] });
  asRange(B, AS.st6, q, { h: 9.25 }); asRange(B, AS.st7, q, { h: 8.8 }); asRange(B, AS.st8, q, { h: 9.15 });
  for (const W of AS.wings) { const sides = [asRows, asRows, asRows, asRows]; sides[sideToward(W, AS.street)] = {}; range(B, { R: W, h: 8.4, wall: 'stoneGrey', dress: 'dress', roof: 'flat', roofKey: 'lead', crenel: true, parapet: 0.7, sides }, q); }
  // the gate tower: the arch through, two statue niches over it (Henry VI and Archbishop Chichele, as on the real
  // front), a Perpendicular window, battlements and pinnacles
  const T = AS.tower, th = 15.2;
  const gate = (k) => ({ ...op(0, 0, 4.4, null, 2.9, 'point', { open: true, rec: T.W, revKey: 'stoneDk', noSill: true, noReveal: k === 1 }), farKey: 'shade' });
  range(B, { R: T, h: th, wall: 'stoneGrey', dress: 'dress', roof: 'flat', roofKey: 'lead', crenel: true, parapet: 0.9, strings: [5.1, 10.0], plinth: 0.35, sides: [
    { extra: [gate(0), op(-1.25, 5.8, 8.6, 'niche', 1.0, 'point', { rec: 0.35 }), op(1.25, 5.8, 8.6, 'niche', 1.0, 'point', { rec: 0.35 }), op(0, 10.8, 13.8, 'perp', 1.9, 'point')] },
    { extra: [gate(1), op(0, 6.0, 8.6, 'mullion', 1.7)] }, {}, {}] }, q);
  {
    const F = pushSide(B, T, 0);
    if (q < 2) for (const x of [-1.25, 1.25]) { const z = q ? 0.3 : -0.15; B.box('dress', x, 5.9, z, 0.9, 0.2, 0.4, 0); figure(B, x, 6.0, z - 0.05, q, 'statue', 1.15); }
    if (q < 2) B.card('sign6_allsouls', [-1.5, 4.85, 0.05], [1.5, 4.85, 0.05], [1.5, 5.25, 0.05], [-1.5, 5.25, 0.05], [0.004, 0.004, 0.996, 0.996]);
    B.pop();
    if (q < 2) for (const [x, z] of corners(T, -0.3)) pinnacle(B, x, th + 0.9, z, 0.5, 1.2, 1.6, 'dress', q, -T.a);
  }
  // the Warden's Lodgings: three storeys of sashes, a cornice and balustrade, a pedimented doorcase
  const Wd = AS.warden, wh = 12.4, st = 0;
  const sashRows = { rows: [[1.3, 3.6, 'sash', 1.25], [4.8, 7.4, 'sash', 1.3], [8.6, 10.6, 'sash', 1.2]], bay: 2.9 };
  const sides = []; sides[[1, 0, 3, 2][st]] = sashRows;
  range(B, { R: Wd, h: wh, wall: 'honey', dress: 'dress', roof: 'hip', roofKey: 'slate', pitch: 0.55, plinth: 0.5, sides, noWalls: [st] }, q);
  {
    const F = pushSide(B, Wd, st), L = F.L, xs = bays(5, 2.9);
    facade(B, { L, bands: [[0, wh, 'honey']], ops: [...xs.filter((x, k) => k !== 2).map((x) => op(x, 1.3, 3.6, 'sash', 1.25)), op(0, 0, 3.3, 'doorDark', 1.4, 'rect', { rec: 0.18, noSill: true }), ...xs.map((x) => op(x, 4.8, 7.4, 'sash', 1.3)), ...xs.map((x) => op(x, 8.6, 10.6, 'sash', 1.2))],
      strings: [[4.4, 0.24, 0.14], [0.25, 0.5, 0.12]], cornice: [wh - 0.4, 0.5, 0.5] }, q);
    if (q < 2) { B.push(frame(0, 0, 0.18, 1, 0)); pediment(B, 2.4, 3.6, 0.7, 'honey', 'dress', q, { d: 0.18, t: 0.18 }); B.pop(); }
    balustrade(B, -L / 2, L / 2, wh + 0.1, 0.9, -0.3, q, 'balus');
    B.pop();
  }
  return B;
}

// ------------------------------------------------------------------------------------------------ University College
export const UC = {
  u1: frontRect([514.7, 264.1], [546.6, 261.7], 9.0, S_(530, 263), { ext: 0.2 }),
  t1: frontRect([546.4, 261.7], [556.6, 261.3], 9.2, S_(551, 262), { fwd: 0.55 }),   // the mapped gate passage is at x 551.5
  u2: frontRect([556.4, 261.3], [574.4, 261.0], 9.4, S_(565, 261), { ext: 0.03 }),
  u3: frontRect([574.4, 261.0], [581.9, 261.7], 10.6, S_(578, 261), { ext: 0.03 }),
  t2: frontRect([581.7, 261.7], [590.4, 262.6], 9.4, S_(586, 262), { fwd: 0.55 }),   // the mapped gate passage is at x 586
  u4: frontRect([590.2, 262.6], [609.5, 264.6], 10.6, S_(600, 264), { ext: 0.1 }),
  wings: [hullRect([[528.4, 272.0], [536.3, 271.1], [536.5, 279.3], [528.6, 279.5]]), hullRect([[566.9, 270.4], [574.6, 270.4], [575.1, 278.1], [567.2, 278.3]])],
  street: [560, 250],
};
// item 15 (high_univ): the real front has about three times the windows (a bay of about 2.6 m, not 3.3) and a gable
// with its own two-light window over every other bay
const UC_BAY = ROOFSCAPE ? 2.6 : 3.3, UC_WIN = ROOFSCAPE ? 1.45 : 1.7;
const ucRows = (bay = UC_BAY) => ({ rows: [[1.3, 3.5, 'mullion', UC_WIN], [5.0, 7.5, 'mullion', UC_WIN]], bay });
function ucRange(B, R, q, towers = []) {
  const st = 0, back = 1, noEnds = towers.map((T) => sideToward(R, [T.cx, T.cz]));
  const sides = []; sides[st] = ucRows(); sides[back] = ucRows();
  const h = 9.6, pitch = 0.9;
  range(B, { R, h, wall: 'honey', dress: 'dress', roof: 'gable', roofKey: 'stoneSlate', pitch, plinth: 0.45, strings: [4.3, h - 0.15], sides, noWalls: noEnds }, q);
  const F = pushSide(B, R, st), nb = Math.max(1, Math.floor((F.L - 0.8) / UC_BAY)), xs = bays(nb, UC_BAY);
  if (q === 0) for (const x of xs) for (const y of [3.62, 7.62]) B.box('dress', x, y, 0.07, UC_WIN + 0.4, 0.13, 0.14, 0, { bottom: true });
  // gabled attics over every other bay (wall-plane gables with a two-light window)
  const gx = xs.filter((_, k) => k % 2 === (nb % 2 ? 0 : 1) || nb <= 2);
  if (ROOFSCAPE) gableRow(B, gx, h - 0.2, Math.min(3.9, UC_BAY * 1.45), 3.5, 'honey', 'dress', 'mullion', q);
  else gableRow(B, gx, h, 3.6, 2.9, 'honey', 'dress', 'leaded', q);
  B.pop();
}
function ucTower(B, R, q, th, sign) {
  const gate = (k) => ({ ...op(0, 0, 4.6, null, 3.1, 'point', { open: true, rec: R.W, revKey: 'stoneDk', noSill: true, noReveal: k === 1 }), farKey: 'shade' });
  range(B, { R, h: th, wall: 'honey', dress: 'dress', roof: 'flat', roofKey: 'lead', crenel: true, parapet: 0.9, plinth: 0.45, strings: [5.4, 9.4, 13.6], sides: [
    { extra: [gate(0), op(0, 5.9, 8.9, 'niche', 1.3, 'round', { rec: 0.4 }), op(0, 14.2, 16.4, 'perp', 1.8, 'point')] },
    { extra: [gate(1), op(0, 5.9, 8.9, 'niche', 1.3, 'round', { rec: 0.4 }), op(0, 10.2, 12.8, 'mullion', 2.2), op(0, 14.2, 16.4, 'perp', 1.8, 'point')] },
    { extra: [op(0, 14.2, 16.4, 'perp', 1.5, 'point')] }, { extra: [op(0, 14.2, 16.4, 'perp', 1.5, 'point')] }] }, q);
  const F = pushSide(B, R, 0);
  // the statue over the arch; the oriel (a canted bay of lights on a corbel)
  if (q < 2) { const z = q ? 0.35 : -0.2; B.box('dress', 0, 5.95, z, 1.1, 0.2, 0.5, 0); figure(B, 0, 6.05, z - 0.02, q, 'statue', 1.25); }
  const oy = 9.9, oh = 3.0, ow = 2.6, od = 0.75;
  B.box('dress', 0, oy - 0.35, od / 2, ow + 0.2, 0.7, od + 0.1, 0, { bottom: true });
  B.unit('mullion', rectPts(-ow / 2 + 0.25, oy + 0.2, ow / 2 - 0.25, oy + oh - 0.3), od + 0.01, [5, 2]);
  B.poly('honey', [[-ow / 2, oy, od], [ow / 2, oy, od], [ow / 2, oy + oh, od], [-ow / 2, oy + oh, od]], [0, 0, 1]);
  for (const sg of [-1, 1]) B.poly('honey', [[sg * ow / 2, oy, od], [sg * ow / 2, oy, 0], [sg * ow / 2, oy + oh, 0], [sg * ow / 2, oy + oh, od]], [sg, 0, 0]);
  B.box('dress', 0, oy + oh + 0.12, od / 2, ow + 0.2, 0.24, od + 0.1, 0, {});
  if (sign && q < 2) B.card(sign, [-1.6, 5.05, 0.05], [1.6, 5.05, 0.05], [1.6, 5.45, 0.05], [-1.6, 5.45, 0.05], [0.004, 0.004, 0.996, 0.996]);
  B.pop();
  // the courtyard side's statue too (James II over Main Quad's gate, Dr Radcliffe over his quad's)
  { pushSide(B, R, 1); if (q < 2) { const z = q ? 0.35 : -0.2; B.box('dress', 0, 5.95, z, 1.1, 0.2, 0.5, 0); figure(B, 0, 6.05, z - 0.02, q, 'statueDk', 1.2); } B.pop(); }
  if (q < 2) for (const [x, z] of corners(R, -0.3)) pinnacle(B, x, th + 0.9, z, 0.6, 1.3, 1.9, 'dress', q, -R.a);
}
export function buildUniv(q) {
  const B = new RB();
  ucRange(B, UC.u1, q, [UC.t1]); ucRange(B, UC.u2, q, [UC.t1]); ucRange(B, UC.u3, q, [UC.t2]); ucRange(B, UC.u4, q, [UC.t2]);
  for (const W of UC.wings) { const sides = [ucRows(), ucRows(), ucRows(), ucRows()]; sides[sideToward(W, UC.street)] = {}; range(B, { R: W, h: 9.2, wall: 'honey', dress: 'dress', roof: 'gable', roofKey: 'stoneSlate', pitch: 0.9, sides }, q); }
  ucTower(B, UC.t1, q, 18.8, 'sign6_univ');
  ucTower(B, UC.t2, q, 17.6, null);
  return B;
}

// ------------------------------------------------------------------------------------------------ the Examination Schools
export const EX = {
  front: frontRect([668.1, 278.2], [707.4, 286.5], 12.0, S_(688, 282)),
  street: [688, 268], id: 'w60860891',
  // the porch's round-headed doorway as modelled (the walk-in room's oak leaf fills it: high_street.js): width, crown, recess
  doorway: { w: 1.9, h: 3.55, rec: 0.6 },
};
{
  const R = EX.front;
  EX.endW = frontRect(sidePt(R, 0, -R.L / 2 + 0.25, 0), sidePt(R, 0, -R.L / 2 + 7.2, 0), 3.0, EX.street, { fwd: 0.6 });
  EX.endE = frontRect(sidePt(R, 0, R.L / 2 - 7.2, 0), sidePt(R, 0, R.L / 2 - 0.25, 0), 3.0, EX.street, { fwd: 0.6 });
  EX.porch = frontRect(sidePt(R, 0, -3.9, 0), sidePt(R, 0, 3.9, 0), 2.6, EX.street, { fwd: 1.6 });
  EX.door = sidePt(R, 0, 0, 1.6 + 1.2);
}
/** the remaining Schools (wings and the Merton Street quad): the mapped outline without its front block */
export function schoolsRest(poly) {
  // drop the front-block vertices between [665.6, 289.7] and [702.0, 297.8] (a straight inner wall joins them)
  const i0 = poly.findIndex((p) => Math.abs(p[0] - 665.6) < 0.2 && Math.abs(p[1] - 289.7) < 0.2), i1 = poly.findIndex((p) => Math.abs(p[0] - 702.0) < 0.2 && Math.abs(p[1] - 297.8) < 0.2);
  if (i0 < 0 || i1 < 0 || i1 <= i0) return null;
  return [...poly.slice(0, i0 + 1), ...poly.slice(i1)];
}
export function buildSchools(q) {
  const B = new RB(), R = EX.front, eh = 15.4, pitch = 0.95;
  const bigN = (x, y0, y1, w, n) => { const gap = 0.16, lw = (w - gap * (n - 1)) / n; return Array.from({ length: n }, (_, k) => op(x - w / 2 + lw / 2 + k * (lw + gap), y0, y1, 'mullion', lw, 'rect', { rec: 0.3, noSill: k > 0 })); };
  const big = (x, y0, y1, w) => bigN(x, y0, y1, w, w > 3.5 ? 3 : 2);
  // the main block: the street face drawn by facade(); back and ends by range()
  range(B, { R, h: eh, wall: 'clipsham', dress: 'dress', roof: 'gable', roofKey: 'stoneSlate', pitch, plinth: 0.6, strings: [7.4, eh - 0.2], sides: [null, { rows: [[1.6, 6.0, 'mullion', 2.2], [8.6, 13.4, 'mullion', 2.2]], bay: 3.8 }, {}, {}], noWalls: [0] }, q);
  {
    const F = pushSide(B, R, 0), L = F.L, mid = [-11.2, -6.6, 6.6, 11.2];
    // item 15 (exam_schools): the front between the end bays and the porch is mostly glass: on each side two tall
    // mullion-and-transom windows below and ONE great window of the Writing Schools above, nearly the bay's width
    // (sizes measured off the photograph: a GUESS within half a metre)
    const sideC = (L / 2 - 7.2 + 3.9) / 2, sideW = L / 2 - 7.2 - 3.9;
    const ops = ROOFSCAPE ? [...[-1, 1].flatMap((sg) => [...bigN(sg * (sideC - sideW * 0.24), 1.5, 6.7, sideW * 0.4, 3), ...bigN(sg * (sideC + sideW * 0.24), 1.5, 6.7, sideW * 0.4, 3), ...bigN(sg * sideC, 8.0, 14.5, sideW * 0.86, 5)]), ...bigN(0, 9.0, 14.5, 5.4, 4)]
      : [...mid.flatMap((x) => big(x, 1.8, 6.4, 2.6)), ...mid.flatMap((x) => big(x, 8.6, 13.6, 2.6)), ...big(0, 9.2, 13.6, 4.6)];
    facade(B, { L, bands: [[0, eh, 'clipsham']], ops, strings: [[7.4, 0.36, 0.22], [0.3, 0.6, 0.12]], cornice: [eh - 0.4, 0.45, 0.4] }, q);
    balustrade(B, -L / 2 + 7.2, L / 2 - 7.2, eh + 0.05, 1.1, -0.25, q, 'balusPale');
    B.pop();
  }
  // the end bays: a little forward, two great five-light windows each, a shaped gable with a ball
  for (const E of [EX.endW, EX.endE]) {
    const st = 0, F = pushSide(B, E, st), L = F.L;
    facade(B, { L, bands: [[0, eh + 1.2, 'clipsham']], ops: ROOFSCAPE ? [...bigN(0, 1.4, 6.7, 5.0, 4), ...bigN(0, 8.2, 14.3, 5.0, 4)] : [...big(0, 1.6, 6.4, 4.4), ...big(0, 8.4, 13.8, 4.4)], strings: [[7.4, 0.36, 0.22], [0.3, 0.6, 0.12]], cornice: [eh + 0.8, 0.45, 0.4] }, q);
    // shaped (Jacobean) gable: stepped with scrolls, approximated by a stack of narrowing slabs and a ball finial
    const gy = eh + 1.25;
    B.poly('clipsham', [[-L / 2 + 0.3, gy, 0], [L / 2 - 0.3, gy, 0], [L / 2 - 1.6, gy + 1.6, 0], [1.2, gy + 2.6, 0], [1.2, gy + 3.6, 0], [-1.2, gy + 3.6, 0], [-1.2, gy + 2.6, 0], [-L / 2 + 1.6, gy + 1.6, 0]].reverse(), [0, 0, 1]);
    B.poly('clipsham', [[-L / 2 + 0.3, gy, -0.5], [L / 2 - 0.3, gy, -0.5], [L / 2 - 1.6, gy + 1.6, -0.5], [1.2, gy + 2.6, -0.5], [1.2, gy + 3.6, -0.5], [-1.2, gy + 3.6, -0.5], [-1.2, gy + 2.6, -0.5], [-L / 2 + 1.6, gy + 1.6, -0.5]], [0, 0, -1]);
    if (q < 2) { B.box('dress', 0, gy + 3.7, -0.25, 2.8, 0.2, 0.7, 0, {}); B.lathe('dress', 0, -0.25, [[0, gy + 3.8], [0.3, gy + 4.05], [0, gy + 4.4]], { seg: 6 }); B.unit('leaded', rectPts(-0.7, gy + 1.0, 0.7, gy + 2.6), 0.02, [3, 3]); }
    B.pop();
    // its sides (the 0.6 m step forward) and top
    for (const i of [2, 3]) { const Fs = pushSide(B, E, i); B.poly('clipsham', [[-Fs.L / 2, 0, 0], [Fs.L / 2, 0, 0], [Fs.L / 2, eh + 1.2, 0], [-Fs.L / 2, eh + 1.2, 0]], [0, 0, 1]); B.pop(); }
    { const c = corners(E, -0.02); B.poly('lead', c.map(([x, z]) => [x, eh + 1.21, z]), [0, 1, 0]); }
  }
  // the porch: four Ionic columns, the round-headed entrance, the two carved panels (a viva and a degree day), the name
  {
    const P = EX.porch, ph = 8.4, st = 0;
    range(B, { R: P, h: ph, wall: 'clipsham', dress: 'dress', roof: 'flat', roofKey: 'lead', sides: [], noWalls: [st, [1, 0, 3, 2][st]] }, q);
    const F = pushSide(B, P, st), L = F.L;
    facade(B, { L, bands: [[0, ph, 'clipsham']], ops: [op(0, 0, EX.doorway.h, 'archDoorDk', EX.doorway.w, 'round', { rec: EX.doorway.rec, noSill: true, revKey: 'dress', hood: true })], cornice: [ph - 0.6, 0.6, 0.5] }, q);
    for (const x of [-1.9, 1.9]) if (q < 2) B.unit('relief', rectPts(x - 1.4, 5.0, x + 1.4, 7.4), 0.06, [0, 0]);
    if (q === 0) { const dw = EX.doorway.w / 2; B.box('dress', 0, EX.doorway.h + 0.42, 0.08, 0.42, 0.6, 0.16, 0, { bottom: true }); for (const sx of [-1, 1]) B.box('dress', sx * (dw + 0.17), EX.doorway.h - dw - 0.1, 0.05, 0.4, 0.2, 0.1, 0, { bottom: true }); }   // keystone, imposts
    if (q < 2) B.card('sign6_schools', [-2.6, 7.85, 0.52], [2.6, 7.85, 0.52], [2.6, 8.3, 0.52], [-2.6, 8.3, 0.52], [0.004, 0.004, 0.996, 0.996]);
    for (const x of [-3.2, -1.7, 1.7, 3.2]) {
      B.box('dress', x, 0.45, 0.55, 0.8, 0.9, 0.8, 0, {});
      B.cyl('clipsham', x, 0.9, 0.55, 0.25, 6.1, q === 2 ? 6 : 10, false, 0.29);
      if (q < 2) { B.box('dress', x, 7.1, 0.55, 0.9, 0.22, 0.66, 0, {}); if (q === 0) for (const sg of [-1, 1]) B.cyl('dress', x + sg * 0.4, 6.85, 0.55, 0.13, 0.01, 6, true, 0.13); }
    }
    balustrade(B, -L / 2, L / 2, ph, 0.9, 0.3, q, 'balusPale');
    B.pop();
  }
  // the louvre on the ridge: an octagonal lantern, ogee lead cap, vane
  {
    const c = sidePt(R, 0, 0, -R.W / 2), y = eh + Math.tan(pitch) * (R.W / 2) - 0.3, seg = q === 2 ? 8 : 8;
    B.lathe('clipsham', c[0], c[1], [[1.5, y], [1.5, y + 1.2], [1.65, y + 1.3]], { seg, facet: true });
    B.lathe('louvre', c[0], c[1], [[1.25, y + 1.3], [1.25, y + 3.6]], { seg, facet: true, crease: 0.1 });
    B.lathe('lead', c[0], c[1], [[1.55, y + 3.6], [1.55, y + 3.85], [1.1, y + 4.5], [0.4, y + 5.4], [0.12, y + 6.0], [0, y + 6.3]], { seg, facet: true });
    if (q < 2) B.box('gold', c[0], y + 6.7, c[1], 0.06, 0.9, 0.06, 0);
  }
  return B;
}

/** world polygons that are solid (the rebuilt fronts); the gates are opened by passages in high_street.js */
export function solids() {
  const out = [];
  for (const R of [QN.west, QN.east, QN.screenW, QN.screenE, QN.gate, AS.st1, AS.tower, AS.st6, AS.st7, AS.st8, AS.warden, ...AS.wings, UC.u1, UC.t1, UC.u2, UC.u3, UC.t2, UC.u4, ...UC.wings, EX.front, EX.endW, EX.endE]) out.push(corners(R));
  // the porch: the two side walls and column bases (the doorway between is open, the door is an interior's door)
  return out;
}
/** passages through the gates: [x1, z1, x2, z2, width] */
export function passages() {
  const P = (R, w) => { const a = sidePt(R, 0, 0, 0.8), b = sidePt(R, 1, 0, 0.8); return [a[0], a[1], b[0], b[1], w]; };
  return { queens: P(QN.gate, 2.6), allsouls: P(AS.tower, 2.2), univ1: P(UC.t1, 2.4), univ2: P(UC.t2, 2.4) };
}
