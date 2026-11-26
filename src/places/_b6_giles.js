// St Giles' (batch 6): geometry for places/st_giles.js — see docs/research/landmarks_batch6.md.
//   St John's College   the St Giles' front of the Front Quad (St Bernard's College, from 1437): two storeys of rubble
//                       with ashlar dressings, battlements, the gate tower with a statue niche over the arch; the
//                       kitchen range north of the hall
//   Taylor Institution  Cockerell's St Giles' face (1841-45): four detached Ionic columns on tall pedestals, each carrying
//                       a block of entablature with a standing statue (the mapped wing is raised and restyled by the
//                       world; the columns and statues stand in front of it)
//   two pubs            facing each other across St Giles', the Eagle and Child and the Lamb and Flag (invented names under
//                       ?invented=1), fascias and hanging signs; the east one bridges the
//                       narrow passage through to the lane behind
//   the war memorial    the Oxford War Memorial (Thomas Rayson, 1921): a Clipsham stone cross, 11.4 m, on an octagonal
//                       plinth and seven steps, on its island where the Woodstock and Banbury Roads part
import { RB, range, corners } from './_b5_kit.js';
import { frame } from './_worcester_kit.js';
import { ROOFSCAPE } from '../world/landmarks.js';
import { hullRect, frontRect, sideToward, pushSide, sidePt, op, bays, facade, balustrade, battlements, pinnacle, figure, rectPts, archPts, gableRow, TAU } from './_b6_kit.js';

const W_ = (x, z) => [x - 14, z];   // a point in the street west of an east-side front
const E_ = (x, z) => [x + 14, z];

// ------------------------------------------------------------------------------------------------ St John's
export const SJ = {
  south: frontRect([71.0, -94.0], [67.15, -114.9], 8.2, W_(70, -104), { ext: 0.15 }),
  tower: frontRect([67.25, -114.7], [65.7, -122.2], 8.4, W_(66, -118.5), { fwd: 0.6 }),   // the mapped gate passage is at z -118.6
  north: frontRect([65.75, -122.0], [62.3, -136.9], 8.0, W_(64, -129), { ext: 0.15 }),
  kitchens: frontRect([60.6, -145.5], [53.6, -175.6], 13.4, W_(57, -160), { ext: 0.1 }),
  street: [40, -125],
};
const sjRows = { rows: [[1.3, 3.3, 'mullion', 1.5], [4.8, 6.9, 'mullion', 1.5]], bay: 3.3 };
function sjRange(B, R, q, h = 8.6) {
  const st = 0, sides = []; sides[st] = sjRows; sides[1] = sjRows;
  if (ROOFSCAPE) {
    // photo comparison item 2 (stjohns): the ranges either side of the tower are gabled, not battlemented: a steep
    // stone-slate roof, a gabled attic with a two-light window over every other bay, tall stacks
    range(B, { R, h, wall: 'rubbleWarm', dress: 'dress', roof: 'gable', roofKey: 'stoneSlate', pitch: 0.9, plinth: 0.35, strings: [4.1], sides }, q);
    const F = pushSide(B, R, st), nb = Math.max(1, Math.floor((F.L - 0.8) / 3.3)), xs = bays(nb, 3.3);
    if (q === 0) for (const x of xs) for (const y of [3.42, 7.02]) B.box('dress', x, y, 0.07, 1.9, 0.13, 0.14, 0, { bottom: true });
    gableRow(B, xs.filter((_, k) => k % 2 === (nb % 2 ? 0 : 1) || nb <= 2), h - 0.2, 3.4, 3.2, 'rubbleWarm', 'dress', 'mullion', q);
    // two tall stacks on the ridge
    if (q < 2) for (const x of [-F.L * 0.3, F.L * 0.3]) { B.box('rubbleWarm', x, h + Math.tan(0.9) * R.W / 2 + 0.6, -R.W / 2, 0.9, 3.2, 1.6, 0, { top: true }); B.box('dress', x, h + Math.tan(0.9) * R.W / 2 + 2.25, -R.W / 2, 1.05, 0.14, 1.75, 0, { top: true }); }
    B.pop();
    return;
  }
  range(B, { R, h, wall: 'rubbleWarm', dress: 'dress', roof: 'flat', roofKey: 'lead', crenel: true, parapet: 0.75, plinth: 0.35, strings: [4.1], sides }, q);
  if (q === 0) { const F = pushSide(B, R, st); for (const x of bays(Math.max(0, Math.floor((F.L - 0.8) / 3.3)), 3.3)) for (const y of [3.42, 7.02]) B.box('dress', x, y, 0.07, 1.9, 0.13, 0.14, 0, { bottom: true }); B.pop(); }
}
export function buildStJohns(q) {
  const B = new RB();
  sjRange(B, SJ.south, q); sjRange(B, SJ.north, q);
  sjRange(B, SJ.kitchens, q, 9.4);
  const T = SJ.tower, th = 14.6;
  const gate = (k) => ({ ...op(0, 0, 4.3, null, 2.8, 'point', { open: true, rec: T.W, revKey: 'stoneDk', noSill: true, noReveal: k === 1 }), farKey: 'shade' });
  range(B, { R: T, h: th, wall: 'rubbleWarm', dress: 'dress', roof: 'flat', roofKey: 'lead', crenel: true, parapet: 0.9, plinth: 0.35, strings: [4.9, 9.4], sides: [
    { extra: [gate(0), op(0, 5.6, 8.7, 'niche', 1.2, 'point', { rec: 0.35 }), op(0, 10.2, 12.9, 'mullion', 1.8)] },
    { extra: [gate(1), op(0, 5.6, 8.4, 'mullion', 1.6), op(0, 10.2, 12.9, 'mullion', 1.8)] }, {}, {}] }, q);
  {
    pushSide(B, T, 0);
    if (q < 2) { const z = q ? 0.32 : -0.15; B.box('dress', 0, 5.65, z, 0.95, 0.2, 0.45, 0); figure(B, 0, 5.75, z - 0.03, q, 'statue', 1.2); }
    if (q < 2) B.card('sign6_stjohns', [-1.5, 4.55, 0.05], [1.5, 4.55, 0.05], [1.5, 4.95, 0.05], [-1.5, 4.95, 0.05], [0.004, 0.004, 0.996, 0.996]);
    B.pop();
    if (q < 2) for (const [x, z] of corners(T, -0.3)) pinnacle(B, x, th + 0.9, z, 0.5, 1.1, 1.5, 'dress', q, -T.a);
  }
  return B;
}

// ------------------------------------------------------------------------------------------------ the Taylorian
export const TI = { id: 'w134120759', a: [29.2, -61.3], b: [36.6, -31.6] };
{ const mx = (TI.a[0] + TI.b[0]) / 2, mz = (TI.a[1] + TI.b[1]) / 2, L = Math.hypot(TI.b[0] - TI.a[0], TI.b[1] - TI.a[1]), ax = (TI.a[0] - TI.b[0]) / L, az = (TI.a[1] - TI.b[1]) / L; TI.m = [mx, mz]; TI.ax = [ax, az]; TI.n = [-az, ax]; TI.L = L; TI.h = 16.5; }
export const tiPt = (x, z) => [TI.m[0] + TI.ax[0] * x + TI.n[0] * z, TI.m[1] + TI.ax[1] * x + TI.n[1] * z];
export const TI_COLS = [-4.6, -1.55, 1.55, 4.6];
export function buildTaylor(q) {
  const B = new RB();
  B.push(frame(TI.m[0], 0, TI.m[1], TI.ax[0], TI.ax[1]));     // local x along the face (north), +z out to St Giles'
  const z = 1.45, seg = q === 2 ? 6 : q === 1 ? 10 : 14;
  for (const x of TI_COLS) {
    B.box('portland', x, 1.1, z, 1.3, 2.2, 1.3, 0, {});                         // pedestal
    B.box('dress', x, 2.28, z, 1.42, 0.16, 1.42, 0, {});
    B.lathe('portland', x, z, [[0.5, 2.36], [0.48, 2.6], [0.45, 2.7], [0.45, 11.2], [0.4, 11.6]], { seg });  // shaft
    if (q < 2) for (const sg of [-1, 1]) B.lathe('dress', x + sg * 0.42, z + 0.0, [[0, 11.5], [0.22, 11.62], [0.24, 11.85], [0, 11.98]], { seg: 6 });   // volutes
    B.box('dress', x, 11.8, z, 1.25, 0.25, 1.15, 0, {});                         // abacus
    // the entablature block reaching back to the wall
    B.box('portland', x, 12.6, (z + 0.55) / 2 + 0.15, 1.5, 1.3, z + 0.55, 0, { bottom: true });
    B.box('dress', x, 13.33, (z + 0.75) / 2 + 0.15, 1.75, 0.2, z + 0.75, 0, { bottom: true });
    // the statue on top
    if (q < 2) { B.box('portland', x, 13.7, z, 0.9, 0.55, 0.9, 0, {}); figure(B, x, 13.95, z, q, 'statue', 1.3); }
  }
  if (q < 2) B.card('sign6_taylor', [-3.0, 2.9, 0.05], [3.0, 2.9, 0.05], [3.0, 3.35, 0.05], [-3.0, 3.35, 0.05], [0.004, 0.004, 0.996, 0.996]);
  B.pop();
  return B;
}

// ------------------------------------------------------------------------------------------------ the two pubs
export const PUBS = {
  // photo comparison item 18 ("eagle_child"): a low two-storey cream front under a slate roof with three gabled dormers,
  // small dark-framed windows, a black plinth and the name painted across the wall — no pub shopfront (was 10.4 m, three
  // storeys with a fascia). Eaves 6.4 m and the dormers' size are a GUESS from the photograph.
  west: { id: 'w113720981', R: frontRect([-19.9, -250.5], [-18.6, -243.1], 7.2, E_(-19, -247)), h: 6.4, key: 'pubA', sign: 'pubSignA', front: 'pubFront', wall: 'render', cottage: true },
  east: { id: 'w91097029', R: frontRect([38.4, -265.9], [40.7, -258.7], 7.4, W_(40, -262)), h: 8.6, key: 'pubB', sign: 'pubSignB', front: 'pubFrontRed', wall: 'honey' },
  // the passage beside the east pub, under its upper floor, through to the lane behind (mapped Lamb and Flag Passage)
  passage: [[36.0, -257.0], [47.2, -260.5]],
};
// the bridge over the passage: between the pub's north wall and the hall north of it, 6 m back from the street
PUBS.bridge = frontRect([40.75, -258.6], [41.15, -257.25], 6.0, W_(40, -258), { });
PUBS.back = hullRect([[46.4, -262.4], [59.6, -267.3], [57.8, -272.2], [45.6, -268.0]]);
export function buildPub(B, P, q) {
  if (P.cottage) return buildCottagePub(B, P, q);
  const R = P.R, st = 0, h = P.h, sh = 3.4;
  const sides = []; sides[1] = { rows: [[4.4, 6.4, 'sash', 1.1], [7.2, 8.4, 'sash', 1.0]], bay: 2.6 };
  range(B, { R, h, wall: P.wall, dress: 'dress', roof: 'gable', roofKey: 'slate', pitch: 0.75, plinth: 0.0, sides, noWalls: [st] }, q);
  const F = pushSide(B, R, st), L = F.L;
  const ups = h > 9.5 ? [[4.4, 6.5, 'sash', 1.15], [7.5, 9.3, 'sash', 1.05]] : [[4.4, 6.6, 'sash', 1.15]];
  facade(B, { L, bands: [[0, sh, P.wall], [sh, h, P.wall]], ops: ups.flatMap(([y0, y1, k, w]) => [-1, 1].map((sg) => op(sg * L * 0.24, y0, y1, k, w))), strings: [[sh + 0.06, 0.18, 0.1]], cornice: [h - 0.3, 0.35, 0.3] }, q);
  // the painted pub front on the ground floor (one unit 8 cm proud), its fascia with the name
  B.unit(P.front, rectPts(-L / 2 + 0.25, 0.15, L / 2 - 0.25, sh - 0.05), 0.08, [1, 0]);
  if (q < 2) { B.box(P.front === 'pubFront' ? 'pubGreen' : 'pubRed', 0, sh - 0.25, 0.16, L - 0.3, 0.55, 0.14, 0, { bottom: true }); B.card('sign6_' + P.key, [-L / 2 + 0.5, sh - 0.48, 0.24], [L / 2 - 0.5, sh - 0.48, 0.24], [L / 2 - 0.5, sh - 0.02, 0.24], [-L / 2 + 0.5, sh - 0.02, 0.24], [0.004, 0.004, 0.996, 0.996]); }
  // the hanging sign on its iron bracket, at the corner by the door, at right angles to the front
  if (q < 2) {
    const x = L / 2 - 0.7, y = sh + 0.6;
    B.box('iron', x, y + 1.35, 0.6, 0.06, 0.06, 1.2, 0, {});
    B.box('iron', x, y + 0.95, 0.25, 0.05, 0.8, 0.05, 0, {});
    for (const zz of [0.42, 1.05]) B.box('iron', x, y + 1.25, zz, 0.03, 0.2, 0.03, 0, {});
    // the board, both faces (x = +-0.035), 0.85 wide x 1.1 high
    const z0 = 0.3, z1 = 1.15, y0 = y, y1 = y + 1.12;
    B.card(P.sign, [x + 0.035, y0, z0], [x + 0.035, y0, z1], [x + 0.035, y1, z1], [x + 0.035, y1, z0], [0.0, 0.0, 1, 1]);
    B.card(P.sign, [x - 0.035, y0, z1], [x - 0.035, y0, z0], [x - 0.035, y1, z0], [x - 0.035, y1, z1], [0.0, 0.0, 1, 1]);
    B.box('pubGreen', x, (y0 + y1) / 2, (z0 + z1) / 2, 0.06, y1 - y0 + 0.04, z1 - z0 + 0.04, 0, { top: true, bottom: true });
  }
  // a lantern over the door
  if (q === 0) B.box('brass', 0, sh + 0.25, 0.35, 0.22, 0.32, 0.22, 0, {});
  B.pop();
}
/** the Eagle and Child: two storeys and three gabled dormers in the roof, the name painted on the wall */
function buildCottagePub(B, P, q) {
  const R = P.R, st = 0, h = P.h, sh = 3.1;
  const sides = []; sides[1] = { rows: [[1.2, 2.5, 'sash', 0.9], [3.9, 5.4, 'sash', 0.9]], bay: 2.6 };
  range(B, { R, h, wall: P.wall, dress: 'dress', roof: 'gable', roofKey: 'slate', pitch: 0.8, plinth: 0.0, sides, noWalls: [st] }, q);
  const F = pushSide(B, R, st), L = F.L, xs = [-L * 0.32, 0, L * 0.32];
  const ops = [...xs.map((x) => op(x, 3.95, 5.35, 'sash', 0.95)), op(-L * 0.32, 1.05, 2.45, 'sash', 1.0), op(L * 0.32, 1.05, 2.45, 'sash', 1.0), op(0, 0.64, 2.45, 'doorDark', 1.0)];
  facade(B, { L, bands: [[0, 0.62, 'iron'], [0.62, h, P.wall]], ops, strings: [], cornice: [h - 0.18, 0.2, 0.18] }, q);
  // three gables standing up from the eave over the upper windows, each with a small casement
  gableRow(B, xs, h, 2.2, 1.7, P.wall, 'dress', 'sash', q);
  // the name painted across the wall between the storeys
  if (q < 2) B.card('sign6_' + P.key, [-L * 0.36, sh - 0.02, 0.025], [L * 0.36, sh - 0.02, 0.025], [L * 0.36, sh + 0.52, 0.025], [-L * 0.36, sh + 0.52, 0.025], [0.004, 0.004, 0.996, 0.996]);
  // the hanging sign on its iron bracket by the door
  if (q < 2) {
    const x = L / 2 - 0.6, y = sh + 0.2;
    B.box('iron', x, y + 1.35, 0.6, 0.06, 0.06, 1.2, 0, {});
    B.box('iron', x, y + 0.95, 0.25, 0.05, 0.8, 0.05, 0, {});
    const z0 = 0.3, z1 = 1.15, y0 = y, y1 = y + 1.12;
    B.card(P.sign, [x + 0.035, y0, z0], [x + 0.035, y0, z1], [x + 0.035, y1, z1], [x + 0.035, y1, z0], [0.0, 0.0, 1, 1]);
    B.card(P.sign, [x - 0.035, y0, z1], [x - 0.035, y0, z0], [x - 0.035, y1, z0], [x - 0.035, y1, z1], [0.0, 0.0, 1, 1]);
    B.box('pubGreen', x, (y0 + y1) / 2, (z0 + z1) / 2, 0.06, y1 - y0 + 0.04, z1 - z0 + 0.04, 0, { top: true, bottom: true });
  }
  if (q === 0) B.box('brass', 0, 2.55, 0.3, 0.2, 0.28, 0.2, 0, {});
  B.pop();
}
/** the east pub's first floor carried over the passage, with an arched opening on the street */
function buildBridge(B, q) {
  const R = PUBS.bridge, st = 0, y0 = 2.7, h = PUBS.east.h;
  const c = corners(R);
  B.poly('stoneShade', c.map(([x, z]) => [x, y0, z]), [0, -1, 0]);
  for (const i of [0, 1]) { const F = pushSide(B, R, i); B.poly('honey', [[-F.L / 2, y0, 0], [F.L / 2, y0, 0], [F.L / 2, h, 0], [-F.L / 2, h, 0]], [0, 0, 1]); if (i === st && q < 2) B.box('dress', 0, y0 + 0.1, 0.06, F.L + 0.1, 0.2, 0.12, 0, {}); B.pop(); }
  B.poly('slate', c.map(([x, z]) => [x, h + 0.02, z]), [0, 1, 0]);
}

// ------------------------------------------------------------------------------------------------ the war memorial
export const MEM = { c: [-9.0, -367.0], h: 11.43 };
export function buildMemorial(q) {
  const B = new RB(), [cx, cz] = MEM.c, seg = 8, oct = { seg, facet: true, a0: Math.PI / 8, a1: Math.PI / 8 + TAU, crease: 0.2 };
  // seven octagonal steps
  let y = 0; for (let k = 0; k < 7; k++) { const r = 3.2 - k * 0.32, hh = 0.2; B.lathe('clipsham', cx, cz, [[r, y], [r, y + hh], [r - 0.32, y + hh]], oct); y += hh; }
  // the octagonal plinth with its carved panels (plain shields are painted on the dress band)
  B.lathe('clipsham', cx, cz, [[1.0, y], [1.0, y + 0.25], [0.9, y + 0.35], [0.9, y + 2.2], [1.0, y + 2.3], [1.0, y + 2.5], [0.62, y + 2.6]], oct);
  if (q < 2) for (let k = 0; k < 8; k += 2) { const a = Math.PI / 8 + (k / 8) * TAU + TAU / 16; B.push(frame(cx + Math.sin(a) * 0.98, 0, cz + Math.cos(a) * 0.98, Math.cos(a), -Math.sin(a))); B.poly('stoneDk', [[-0.22, y + 0.9, 0], [0.22, y + 0.9, 0], [0.22, y + 1.5, 0], [0, y + 1.7, 0], [-0.22, y + 1.5, 0]].map(([a2, b2, c2]) => [a2, b2, c2]), [0, 0, 1]); B.pop(); }
  y += 2.6;
  // the shaft, tapering, and the cross with its foliated head
  const top = MEM.h;
  B.lathe('clipsham', cx, cz, [[0.42, y], [0.32, top - 2.0]], { seg: 4, facet: true, a0: Math.PI / 4, a1: Math.PI / 4 + TAU });
  const ch = top - 2.0;
  B.box('clipsham', cx, ch + 0.95, cz, 0.42, 2.1, 0.42, 0, {});
  B.box('clipsham', cx, ch + 1.0, cz, 1.7, 0.4, 0.38, 0.6, {});
  if (q < 2) { for (const s of [-1, 1]) B.lathe('dress', cx + Math.cos(0.6) * s * 0.85, cz - Math.sin(0.6) * s * 0.85, [[0, ch + 0.75], [0.26, ch + 1.0], [0, ch + 1.25]], { seg: 6 }); B.lathe('dress', cx, cz, [[0, ch + 1.95], [0.26, ch + 2.1], [0, ch + 2.3]], { seg: 6 }); B.lathe('dress', cx, cz, [[0.36, ch + 0.7], [0.5, ch + 1.0], [0.36, ch + 1.3]], { seg: 8 }); }
  // the inscription board on the street face (towards St Giles', south)
  if (q < 2) { B.push(frame(cx, 0, cz + 0.92, 1, 0)); B.card('sign6_memorial', [-0.85, 1.8, 0.02], [0.85, 1.8, 0.02], [0.85, 2.5, 0.02], [-0.85, 2.5, 0.02], [0.004, 0.004, 0.996, 0.996]); B.pop(); }
  return B;
}
export function buildPubs(q) { const B = new RB(); buildPub(B, PUBS.west, q); buildPub(B, PUBS.east, q); buildBridge(B, q);
  range(B, { R: PUBS.back, h: 7.0, wall: 'honey', dress: 'dress', roof: 'gable', roofKey: 'slate', pitch: 0.7, sides: [{ rows: [[1.2, 2.6, 'sash', 1.0], [4.0, 5.8, 'sash', 1.0]], bay: 3.0 }, { rows: [[4.0, 5.8, 'sash', 1.0]], bay: 3.0 }, {}, {}] }, q);
  return B; }
export function solids() { return [SJ.south, SJ.tower, SJ.north, SJ.kitchens, PUBS.west.R, PUBS.east.R, PUBS.back].map((R) => corners(R)); }
export function passages() {
  const P = (R, w) => { const a = sidePt(R, 0, 0, 0.8), b = sidePt(R, 1, 0, 0.8); return [a[0], a[1], b[0], b[1], w]; };
  return { stjohns: P(SJ.tower, 2.2), pubPassage: [...PUBS.passage[0], ...PUBS.passage[1], 1.0] };
}
void archPts; void balustrade; void battlements;
