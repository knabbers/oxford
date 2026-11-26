// Exeter College, STANDALONE model: THE RECTOR'S LODGINGS, CHAPEL ROW AND THE RECTOR'S GARDEN, the build functions.
// Every figure comes from _exeter_rector_plan.js (sources and K / G there). The house is built in its own frame (e east
// along the south front, s south, y up: the plan's header); Chapel Row and the garden in the LOCAL frame.
import * as THREE from 'three';
import * as K from './_exeter_kit.js';
import * as P from './_exeter_rector_plan.js';
import { shrub, hedge, climber } from './_exeter_plants.js';
import { plateWindow } from './_exeter_broad_build.js';      // (part broad's helper: Scott's plate tracery)

const { frame, rectPts, tudorPts, archPts, wall } = K;
const { A, O, toL, FOOT, FFL, LAWN_Y, PATH_Y, WALK_Y, QUAD_Y, COURT_Y, YARD_Y } = P;
const houseM = () => new THREE.Matrix4().makeRotationY(-A).setPosition(O[0], 0, O[1]);
const ringL = (ring) => ring.map(([e, s]) => toL(e, s));

// ------------------------------------------------------------------------------------------------ helpers
/** a coped gable wall in frame F: x 0..len, from foot to the eaves yE, apex at len/2 (yA = the coping's top) */
function gable(B, F, len, foot, yE, yA, ops, key = 'bath', o = {}) {
  const c = P.COPING, xa = o.apexX ?? len / 2;
  wall(B, F, [[0, foot], [len, foot], [len, yE + c.up], [xa, yA], [0, yE + c.up]], ops, key);
  B.push(F);
  const sl = [[[0, yE + c.up], [xa, yA]], [[xa, yA], [len, yE + c.up]]];
  for (const [p, q] of sl) B.beam('bathDress', [p[0], p[1] - 0.08, 0.02], [q[0], q[1] - 0.08, 0.02], c.w, 0.2);
  if (!o.noKneel) for (const x of [0.25, len - 0.25]) B.box('bathDress', x, yE + c.up - 0.15, 0.06, 0.62, 0.36, c.w + 0.1, 0, {});
  B.box('bathDress', xa, yA + 0.12, 0.02, 0.3, 0.3, 0.3, 0, {});      // a plain block at the apex
  B.pop();
}
/** a two-light window with a mullion: pointed (rise > 0), square-headed (rise === 0) */
const twoLight = (x, w, sill, spring, rise, o = {}) => ({ pts: rise > 0 ? K.pointedPts(x, w, sill, spring, rise, 8) : rectPts(x - w / 2, sill, x + w / 2, spring), kind: 'win', lights: 2, d: 0.28, label: rise === 0, ...o });
/** Tudor two-light window (two four-centred lights) as ops + its box, for rubble walls */
function tudor2(x, y, light = 0.45) {
  const gap = 0.14, w = 2 * light + gap, ops = [];
  for (let i = 0; i < 2; i++) { const c = x - w / 2 + light / 2 + i * (light + gap); ops.push({ pts: tudorPts(c, light, y[0], y[1] - 0.18, 0.18, 6), kind: 'win', glass: 'leaded', d: 0.3, sill: false }); }
  return { ops, box: [x - w / 2, x + w / 2, y[0], y[1]] };
}
function dressTudor(B, q) { K.label(B, q.box[0] - 0.08, q.box[1] + 0.08, q.box[3] + 0.06, 0.28); B.box('bathDress', (q.box[0] + q.box[1]) / 2, q.box[2] - 0.07, 0.05, q.box[1] - q.box[0] + 0.25, 0.14, 0.12, 0, { bottom: true }); }
/** ashlar quoins up the two ends of a rubble wall (current frame) */
function quoins(B, len, y0, y1) { for (let k = 0, y = y0; y < y1 - 0.3; k++, y += 0.4) { const lw = k % 2 ? 0.3 : 0.52; for (const x of [lw / 2, len - lw / 2]) B.box('bathDress', x, y + 0.19, 0.015, lw, 0.36, 0.03, 0, {}); } }
/** a straight flight down along -x or +x (dir) in the current frame: top edge at x = xTop, across z0..z1 */
function stepsX(B, key, xTop, dir, z0, z1, n, rise, going, yTop, yBase) {
  for (let i = 0; i < n; i++) { const yt = yTop - rise * (i + 1), xa = xTop + dir * going * i, xb = xTop + dir * going * (i + 1); B.box(key, (xa + xb) / 2, (yt + yBase) / 2, (z0 + z1) / 2, Math.abs(xb - xa), yt - yBase, z1 - z0, 0, {}); }
}
/** a sash with a plain stone architrave (current frame, wall at z = 0) */
function sashWin(x, w, y0, y1) { return { pts: rectPts(x - w / 2, y0, x + w / 2, y1), kind: 'win', glass: 'sash', d: 0.22 }; }
function architrave(B, x, w, y0, y1, a = 0.12) {
  B.box('bathDress', x - w / 2 - a / 2, (y0 + y1) / 2, 0.03, a, y1 - y0, 0.06, 0, {});
  B.box('bathDress', x + w / 2 + a / 2, (y0 + y1) / 2, 0.03, a, y1 - y0, 0.06, 0, {});
  B.box('bathDress', x, y1 + a / 2, 0.03, w + 2 * a, a, 0.06, 0, {});
}

// ------------------------------------------------------------------------------------------------ THE HOUSE
export function buildHouse(ctx) {
  const { B } = ctx;
  B.push(houseM());
  westBlock(ctx);
  eastWing(ctx);
  northParts(ctx);
  roofs(ctx);
  B.pop();
}

function westBlock(ctx) {
  const { B } = ctx, W = P.WEST, L = P.WB.s1 - P.WB.s0, gY = QUAD_Y;
  // WEST FRONT (facing Margary Quad): x = sw from the north end. THIRD PASS: four window columns from 04/02086, plate tracery
  // on the ground and first floors, the stair's two windows taller with a transom, two lights under a hood on the second
  // floor, a sill string a floor, the main door (porch()), three white Gothic dormers at the LIDAR's humps
  const Fw = frame(P.WB.e0, 0, P.WB.s0, 0, 1), ops = [], plates = [];
  const plate = (x, lv, o = {}) => {
    const w = W.winW, A = { x, w, sill: lv.sill, spring: lv.spring, rise: lv.rise, n: 2, lw: (w - 0.56) / 2, mull: 0.16, lApex: lv.spring + 0.1, lRise: 0.32, roundel: o.roundel ?? 0.16, transoms: lv.transom ? [lv.transom] : undefined, hood: true };
    ops.push({ pts: K.pointedPts(x, w, A.sill, A.spring, A.rise, 8), kind: 'none' }); plates.push(A);
  };
  for (const x of W.groundCols) plate(x, W.g);
  for (const x of W.cols) plate(x, W.stairCols.includes(x) ? W.st : W.f);
  for (const x of W.cols) plate(x, W.t, { roundel: 0 });
  ops.push({ pts: rectPts(W.door - P.DOOR.w / 2, P.DOOR.ffl, W.door + P.DOOR.w / 2, P.DOOR.ffl + P.DOOR.h), kind: 'void', d: P.DOOR.reveal });   // the leaves: porch()
  wall(B, Fw, rectPts(0, gY + FOOT - LAWN_Y, L, P.WB.eaves), ops, 'bath');
  B.push(Fw);
  for (const A of plates) plateWindow(B, A);
  K.stringCourse(B, 'bathDress', 0, L, gY + W.plinth, 0.18, 0.1);
  for (const y of W.strings) K.stringCourse(B, 'bathDress', 0, L, y, 0.16, 0.09);
  K.stringCourse(B, 'bathDress', -0.1, L + 0.1, W.cornice[1], W.cornice[1] - W.cornice[0], 0.22);
  // basement lights in the plinth (a basement under the whole house: 25/01435)
  for (const x of W.groundCols) B.unit('glassDark', rectPts(x - 0.45, gY + 0.05, x + 0.45, gY + 0.4), 0.01);
  B.pop();
  // the porch, its steps and floor; the lantern
  porch(ctx);
  // dormers in the west slope: white Gothic dormers (the east slope's, photographed) at the LIDAR's humps
  const D = W.dormer, slope = (P.WB.ridge - P.WB.eaves) / ((P.WB.e1 - P.WB.e0) / 2);
  for (const x of W.dormers) {
    const yD = P.WB.eaves + D.front * slope + 0.02;
    K.dormer(B, frame(P.WB.e0 + D.front, 0, P.WB.s0, 0, 1), x, yD, D.w, D.h, 1.6, { rise: D.rise, key: 'white', roofKey: 'slate', lights: 2, glass: 'leaded', margin: 0.12 });
    B.push(frame(P.WB.e0 + D.front - 0.01, 0, P.WB.s0, 0, 1));
    { const y = yD + D.h - 0.35; for (const dx of [-0.26, 0.26]) B.poly('white', [[x + dx - 0.21, y, 0.02], [x + dx + 0.21, y, 0.02], [x + dx, y + 0.34, 0.02]], [0, 0, 1]); }
    B.pop();
  }
  // EAST FACE to the garden (s 0 .. -6; north of -5 it is inside the east wing)
  const Fe = frame(P.WB.e1, 0, 0, 0, -1);
  const c = -P.WB_EAST.col;
  wall(B, Fe, rectPts(0, LAWN_Y + FOOT, 6.0, P.WB.eaves), [twoLight(c, 1.15, 4.7, 6.55, 0.6), twoLight(c, 1.1, 8.1, 9.75, 0)], 'bath');
  B.push(Fe); K.stringCourse(B, 'bathDress', -0.1, 5.1, P.WB.eaves, 0.4, 0.2); B.pop();
  const ED = P.WB_EAST.dormer;
  K.dormer(B, frame(P.WB.e1 - 0.4, 0, 0, 0, -1), -ED.s, P.WB.eaves + 0.4 * slope + 0.02, ED.w, ED.h, 1.6, { rise: ED.rise, key: 'white', roofKey: 'slate', lights: 2, glass: 'leaded', margin: 0.12 });
  // pointed heads on the white dormer: two small white gablets read as Gothic (Tilman 2025)
  B.push(frame(P.WB.e1 - 0.4 + 0.01, 0, 0, 0, -1));
  { const y = P.WB.eaves + 0.4 * slope + 0.02 + ED.h - 0.35; for (const dx of [-0.24, 0.24]) B.poly('white', [[-ED.s + dx - 0.2, y, 0.02], [-ED.s + dx + 0.2, y, 0.02], [-ED.s + dx, y + 0.32, 0.02]], [0, 0, 1]); }
  B.pop();
  // SOUTH GABLE over Chapel Row and the tower (s 0)
  const SW = P.WB_SOUTH_WIN;
  gable(B, frame(P.WB.e0, 0, P.WB.s1, 1, 0), P.WB.e1 - P.WB.e0, 4.0, P.WB.eaves, P.WB.ridge + P.COPING.up, [twoLight((P.WB.e1 - P.WB.e0) / 2, SW.w, SW.sill, SW.spring, SW.rise)], 'bath');
  // NORTH END: the party wall with part 'broad' (plain), its stacks
  gable(B, frame(P.WB.e1, 0, P.WB.s0, -1, 0), P.WB.e1 - P.WB.e0, QUAD_Y + FOOT - LAWN_Y, P.WB.eaves, P.WB.ridge + P.COPING.up, [], 'bathOld', { noKneel: true });
  for (const st of P.WB_STACKS) K.chimney(B, 'bath', st.e0, st.e1, P.WB.s0 - 0.35, P.WB.s0 + 0.5, P.WB.eaves, st.top, { pots: st.pots, capKey: 'bathDress' });
}

/** THE MAIN DOOR on the west front (second pass: no porch; see the plan's DOOR): its threshold floor (LOCAL), so a walker
 *  reaches the leaves from the forecourt (part 'margary' builds the forecourt and its floors) */
function doorFloor(ctx) {
  const D = P.DOOR, zc = P.WB.s0 + P.WEST.door, z0 = zc - D.w / 2, z1 = zc + D.w / 2;
  const e0 = P.WB.e0;
  ctx.floor(ringL([[e0 - 0.02, z0], [e0 + D.reveal - 0.03, z0], [e0 + D.reveal - 0.03, z1], [e0 - 0.02, z1]]), D.ffl);
}
function porch(ctx) {
  const { B } = ctx, W = P.WEST, D = P.DOOR, s0 = P.WB.s0, x = W.door, zc = s0 + x, y0 = D.ffl, y1 = D.ffl + D.h, d = D.reveal;
  // (the opening itself is cut in the west front by westBlock: kind 'door'); here, in the west front's frame (s = sw along
  // the face southwards, z out of the face): the threshold, the moulded reveal, the leaves, the ring, the name board
  B.push(frame(P.WB.e0, 0, s0, 0, 1));
  B.box('pavingSolid', x, (y0 + QUAD_Y) / 2, -d / 2 + 0.02, D.w + 0.1, y0 - QUAD_Y, d + 0.06, 0, {});
  for (const sx of [-1, 1]) {
    B.cyl('bathDress', x + sx * (D.w / 2 + 0.01), y0, -0.1, D.roll, D.h - 0.05, 8, false, D.roll);       // the roll on each jamb
    B.box('bathDress', x + sx * (D.w / 2 + D.case / 2 + 0.03), (y0 + y1 + 0.2) / 2, 0.03, D.case, y1 + 0.2 - y0, 0.06, 0, {});   // the moulded case
    B.box('bathDress', x + sx * (D.w / 2 + 0.11), (y0 + 0.4) / 2 + y0 / 2, -0.05, 0.22, 0.4, 0.12, 0, {});   // the roll's base
  }
  B.box('bathDress', x, y1 + 0.13, 0.03, D.w + 2 * D.case + 0.06, 0.26, 0.06, 0, { bottom: true });
  B.cyl('bathDress', x - D.w / 2, y1 - 0.02, -0.1, D.roll, 0.01, 6, true, D.roll);
  B.beam('bathDress', [x - D.w / 2, y1 - 0.03, -0.1], [x + D.w / 2, y1 - 0.03, -0.1], D.roll * 2, D.roll * 2);
  // the two leaves of vertical reeded boarding (the opening's own door unit is plain: reeds and the meeting stile over it)
  K.addCell(ctx.pack, 'rectorOak', 'boards', 0xc98f52);      // the photograph's honey-brown oak (G tint)
  const zL = -d + 0.04, lw = D.w / 2;
  B.face('rectorOak', rectPts(x - D.w / 2, y0, x + D.w / 2, y1), [], -d + 0.02);
  for (const sx of [-1, 1]) for (let k = 0; k < D.reeds; k++) { const c = x + sx * (0.04 + (k + 0.5) * ((lw - 0.08) / D.reeds)); B.cyl('rectorOak', c, y0 + 0.12, zL + 0.0, 0.024, D.h - 0.3, 5, false, 0.024); }
  B.box('oakDoor', x, (y0 + y1) / 2, zL + 0.01, 0.05, D.h, 0.04, 0, {});
  for (const sx of [-1, 1]) B.box('rectorOak', x + sx * (lw - 0.03), (y0 + y1) / 2, zL + 0.01, 0.06, D.h, 0.05, 0, {});
  { const cx = x - 0.07, cy = y0 + 0.95, r = 0.06; for (let k = 0; k < 6; k++) { const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2; B.beam('ironBlack', [cx + Math.sin(a0) * r, cy - Math.cos(a0) * r - r, zL + 0.06], [cx + Math.sin(a1) * r, cy - Math.cos(a1) * r - r, zL + 0.06], 0.012, 0.012); } B.box('ironBlack', cx, cy, zL + 0.045, 0.05, 0.05, 0.03, 0, {}); }
  // the oak name board with gilt lettering (two lines: plain gold strips, no lettering modelled)
  const NB = D.board, bx = x + NB.dx;
  B.box('rectorOak', bx, y0 + NB.y, 0.025, NB.w, NB.h, 0.035, 0, {});
  B.box('oakDoor', bx, y0 + NB.y, 0.044, NB.w - 0.08, NB.h - 0.08, 0.004, 0, {});
  for (const [dy, n] of [[0.065, 8], [-0.065, 8]]) for (let k = 0; k < n; k++) B.box('gold', bx - 0.21 + (k * 0.42) / (n - 1), y0 + NB.y + dy, 0.048, 0.034, 0.06, 0.004, 0, {});   // "RECTOR'S / LODGINGS": letter-sized gilt marks (no lettering modelled)
  B.pop();
  // the stone hood over the door on two corbels (G: LIDAR's low thing), in the house frame
  const H = D.hood, z0 = zc - H.w / 2, z1 = zc + H.w / 2, e0 = P.WB.e0;
  K.roof(B, 'slate', e0 - H.proj, e0, z0, z1, H.eaves, H.apex - H.eaves, { axis: 'x', ends: ['gable', 'open'], gableWalls: false, ov: 0.08 });
  B.push(frame(e0 - H.proj, 0, z0, 0, 1));
  for (const [p, q] of [[[0, H.eaves], [H.w / 2, H.apex]], [[H.w / 2, H.apex], [H.w, H.eaves]]]) B.beam('bathDress', [p[0], p[1] + 0.05, 0.04], [q[0], q[1] + 0.05, 0.04], 0.26, 0.14);
  B.poly('bath', [[0.12, H.eaves, -0.01], [H.w - 0.12, H.eaves, -0.01], [H.w / 2, H.apex - 0.1, -0.01]], [0, 0, 1]);
  B.pop();
  for (const z of [z0 + 0.12, z1 - 0.12]) { B.box('bathDress', e0 - H.proj / 2, H.eaves - 0.12, z, H.proj, 0.24, 0.2, 0, {}); B.box('bathDress', e0 - 0.12, H.eaves - 0.5, z, 0.24, 0.5, 0.18, 0, {}); }
  B.box('bathDress', e0 - H.proj / 2, H.eaves - 0.02, zc, H.proj, 0.06, H.w - 0.1, 0, { top: false });
  doorFloor(ctx);
  // the W1 lantern north of the door
  B.push(frame(e0, 0, s0, 0, 1));
  const lp = K.lantern(B, P.LAMPS.porch.sw, P.LAMPS.porch.y, 0.32);
  B.box('ironBlack', P.LAMPS.porch.sw, P.LAMPS.porch.y + 0.1, 0.15, 0.04, 0.04, 0.3, 0, {});
  B.pop();
  const lw0 = toL(e0 - 0.32, s0 + P.LAMPS.porch.sw); ctx.lamp(lw0[0], lp[1], lw0[1]);
}

function eastWing(ctx) {
  const { B } = ctx, C = P.CLASSIC, E = P.EW, s = E.s1;
  // THE CLASSICAL SOUTH FRONT
  const F = frame(E.e0, 0, s, 1, 0), ops = [];
  C.bays.forEach((x, i) => {
    if (i === C.door) ops.push({ pts: rectPts(x - C.doorW / 2, FFL, x + C.doorW / 2, FFL + C.doorH), kind: 'door', doorKey: 'doorOak', d: 0.25 });
    else ops.push(sashWin(x, C.win.w, C.win.g[0], C.win.g[1]));
    ops.push(sashWin(x, C.win.w, C.win.f[0], C.win.f[1]));
  });
  wall(B, F, rectPts(0, LAWN_Y + FOOT, C.len, E.eaves), ops, 'bath');
  B.push(F);
  K.stringCourse(B, 'bathDress', 0, C.len, LAWN_Y + C.plinth + 0.6, 0.2, 0.08);
  K.stringCourse(B, 'bathDress', 0, C.len, C.band, 0.16, 0.07);
  for (const x of C.bays) { architrave(B, x, C.win.w, C.win.f[0], C.win.f[1]); if (x !== C.bays[C.door]) architrave(B, x, C.win.w, C.win.g[0], C.win.g[1]); }
  // channelled quoin strips: alternate long and short blocks standing 6 cm proud, with channels
  for (const [a, b] of C.strips) for (let y = LAWN_Y + 0.6, k = 0; y < C.cornice.y0 - 0.25; y += 0.38, k++) B.box('bathDress', (a + b) / 2 + (k % 2 ? 0.04 : -0.04), y + 0.17, 0.035, b - a - (k % 2 ? 0.08 : 0), 0.32, 0.07, 0, {});
  // the cornice: frieze, bed moulding, corona
  B.box('bathDress', C.len / 2, (C.cornice.y0 + C.cornice.y0 + 0.25) / 2, 0.06, C.len + 0.1, 0.25, 0.12, 0, { bottom: true });
  B.box('bathDress', C.len / 2, C.cornice.y0 + 0.37, C.cornice.proj / 2 - 0.02, C.len + 0.3, 0.24, C.cornice.proj - 0.04, 0, { bottom: true });
  B.box('bathDress', C.len / 2, C.cornice.y1 - 0.08, C.cornice.proj / 2 + 0.02, C.len + 0.4, 0.16, C.cornice.proj + 0.04, 0, { bottom: true });
  // the door's pedimented hood on brackets
  const dx = C.bays[C.door], H = C.hood;
  architrave(B, dx, C.doorW, FFL, FFL + C.doorH, 0.15);
  for (const sx of [-1, 1]) B.box('bathDress', dx + sx * (H.w / 2 - 0.15), H.y - 0.22, H.d / 2, 0.16, 0.44, H.d, 0, {});
  B.box('bathDress', dx, H.y + 0.06, H.d / 2 + 0.02, H.w, 0.12, H.d + 0.04, 0, { bottom: true });
  B.poly('bathDress', [[dx - H.w / 2, H.y + 0.12, H.d + 0.04], [dx + H.w / 2, H.y + 0.12, H.d + 0.04], [dx, H.y + 0.12 + H.rise, H.d + 0.04]], [0, 0, 1]);
  B.poly('slate', [[dx - H.w / 2 - 0.05, H.y + 0.12, H.d + 0.06], [dx, H.y + 0.14 + H.rise, H.d + 0.06], [dx, H.y + 0.14 + H.rise, 0], [dx - H.w / 2 - 0.05, H.y + 0.12, 0]], [-1, 2, 0]);
  B.poly('slate', [[dx, H.y + 0.14 + H.rise, H.d + 0.06], [dx + H.w / 2 + 0.05, H.y + 0.12, H.d + 0.06], [dx + H.w / 2 + 0.05, H.y + 0.12, 0], [dx, H.y + 0.14 + H.rise, 0]], [1, 2, 0]);
  const lp = K.lantern(B, P.LAMPS.classic.x, P.LAMPS.classic.y, 0.3);
  B.box('ironBlack', P.LAMPS.classic.x, P.LAMPS.classic.y + 0.1, 0.13, 0.04, 0.04, 0.26, 0, {});
  B.pop();
  { const q = toL(E.e0 + P.LAMPS.classic.x, s + 0.3); ctx.lamp(q[0], lp[1], q[1]); }
  // steps down from the door to the path
  const St = C.steps, rise = (FFL - PATH_Y) / (St.n + 1);
  K.steps(B, 'pavingSolid', E.e0 + dx - St.w / 2, E.e0 + dx + St.w / 2, s, 1, St.n, rise, St.going, FFL, LAWN_Y - 0.1);
  B.box('pavingSolid', E.e0 + dx, (FFL + LAWN_Y - 0.1) / 2, s + 0.01, St.w, FFL - LAWN_Y + 0.1, 0.02, 0, {});
  ctx.floor(ringL([[E.e0 + dx - St.w / 2, s], [E.e0 + dx + St.w / 2, s], [E.e0 + dx + St.w / 2, s + St.n * St.going], [E.e0 + dx - St.w / 2, s + St.n * St.going]]), (u, v) => {
    const ss = -(u - O[0]) * Math.sin(A) + (v - O[1]) * Math.cos(A); const k = Math.min(St.n - 1, Math.max(0, Math.floor((ss - s) / St.going))); return FFL - rise * (k + 1);
  });
  // round-headed dormers
  const D = C.dormer, slope = (E.ridge - E.eaves) / ((E.s1 - E.s0) / 2);
  for (const x of C.dormers) roundDormer(B, E.e0 + x, s - D.setback, D, E.eaves + D.setback * slope, slope);
  // THE EAST GABLE and the flat piece's east face (x runs north from s -5.0)
  const G = P.EGABLE, Fe = frame(E.e1, 0, s, 0, -1), R = G.recess, yA = E.ridge + P.COPING.up, c = G.len / 2;
  const recess = archPts(c, R.w, R.sill, R.spring, 12);
  wall(B, Fe, [[0, LAWN_Y + FOOT], [G.flatLen, LAWN_Y + FOOT], [G.flatLen, P.NE.parapet], [G.len, P.NE.parapet], [G.len, E.eaves + P.COPING.up], [c, yA], [0, E.eaves + P.COPING.up]],
    [{ pts: recess, kind: 'none' }, sashWin(c, G.low.w, G.low.sill, G.low.head), ...G.flatWin.map((w) => sashWin(w.x, 1.05, w.y[0], w.y[1]))], 'bath');
  B.push(Fe);
  // the recess: its back wall 0.3 in, the sash in it, the reveal; the strings stop at it
  B.reveal('bathDress', recess, 0.0, -R.d, false);
  B.face('bath', recess, [rectPts(c - G.sash.w / 2, G.sash.sill, c + G.sash.w / 2, G.sash.head)], -R.d);
  B.reveal('bathDress', rectPts(c - G.sash.w / 2, G.sash.sill, c + G.sash.w / 2, G.sash.head), -R.d, -R.d - 0.15, false);
  B.unit('sash', rectPts(c - G.sash.w / 2, G.sash.sill, c + G.sash.w / 2, G.sash.head), -R.d - 0.13, K.nextBay(5));
  K.stringCourse(B, 'bathDress', 0, G.len, G.strings[0], 0.16, 0.08);
  K.stringCourse(B, 'bathDress', 0, c - R.w / 2 - 0.05, G.strings[1], 0.14, 0.07); K.stringCourse(B, 'bathDress', c + R.w / 2 + 0.05, G.len, G.strings[1], 0.14, 0.07);
  K.stringCourse(B, 'bathDress', 0, G.len, LAWN_Y + 0.95, 0.2, 0.08);
  architrave(B, c, G.low.w, G.low.sill, G.low.head);
  for (const w of G.flatWin) architrave(B, w.x, 1.05, w.y[0], w.y[1]);
  B.pop();
  // the gable's coping and kneelers
  B.push(Fe);
  for (const [p, q] of [[[0, E.eaves + P.COPING.up], [c, yA]], [[c, yA], [G.len, E.eaves + P.COPING.up]]]) B.beam('bathDress', [p[0], p[1] - 0.08, 0.02], [q[0], q[1] - 0.08, 0.02], P.COPING.w, 0.2);
  for (const x of [0.25, G.len - 0.25]) B.box('bathDress', x, E.eaves + P.COPING.up - 0.15, 0.06, 0.62, 0.36, P.COPING.w + 0.1, 0, {});
  B.box('bathDress', c, yA + 0.12, 0.02, 0.3, 0.3, 0.3, 0, {});
  B.pop();
}

/** a round-headed dormer facing south (+z) centred at (x, z) of the house frame, its sill at y */
function roundDormer(B, x, z, D, roofY, slope) {
  const w = D.w, r = w / 2, ys = D.spring, sill = Math.max(D.sill, roofY + 0.08), depth = (ys + r + 0.15 - roofY) / slope + 0.3;
  const F = frame(x - w / 2 - 0.12, 0, z, 1, 0), W = w + 0.24, front = archPts(W / 2, W, roofY - 0.05, ys, 10);
  wall(B, F, front, [{ pts: archPts(W / 2, w - 0.12, sill, ys, 10), kind: 'win', glass: 'archSash', spring: ys, d: 0.1, sill: false }], 'white');
  B.push(F);
  // cheeks back to the slope, and a lead barrel roof
  for (const xx of [0, W]) B.poly('leadDark', [[xx, roofY - 0.05, 0], [xx, roofY - 0.05, -depth], [xx, ys, -depth], [xx, ys, 0]], [xx ? 1 : -1, 0, 0]);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI, R0 = W / 2 + 0.04;
    const p0 = [W / 2 + Math.cos(a0) * R0, ys + Math.sin(a0) * R0], p1 = [W / 2 + Math.cos(a1) * R0, ys + Math.sin(a1) * R0];
    B.poly('lead', [[p0[0], p0[1], 0.06], [p1[0], p1[1], 0.06], [p1[0], p1[1], -depth], [p0[0], p0[1], -depth]], [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]);
  }
  B.pop();
}

function northParts(ctx) {
  const { B } = ctx, N = P.NS, X = P.NE, bay = P.NGABLE.bay;
  // north gable to the courtyard (x = 15.5 - e)
  const len = N.e1 - N.e0, F = frame(N.e1, 0, N.s0, -1, 0), c = len / 2;
  gable(B, F, len, COURT_Y + FOOT - LAWN_Y, N.eaves, N.gableTop, [
    twoLight(c, 1.2, 7.7, 9.4, 0), twoLight(c, 1.0, 11.0, 12.6, 0.5),
    sashWin(c - 2.6, 1.0, 4.4, 6.8), sashWin(c + 2.6, 1.0, 4.4, 6.8), sashWin(c - 2.6, 1.0, 0.9, 3.0), sashWin(c + 2.6, 1.0, 0.9, 3.0),
  ], 'bathOld');
  // the two-storey canted bay with a balcony on it
  B.push(F);
  const hf = bay.front / 2, hb = bay.base / 2, pr = bay.proj, y0 = COURT_Y - 0.3, y1 = bay.top;
  const pts = [[c - hb, 0], [c - hf, pr], [c + hf, pr], [c + hb, 0]];
  for (let i = 0; i < 3; i++) {
    const a = pts[i], b = pts[i + 1];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux, ww = Math.min(0.9, L - 0.3);
    for (const [ya, yb] of [[0.9, 3.0], [3.9, 5.9]]) B.poly('glassDark', [[m[0] - ux * ww / 2 + nx * 0.02, ya, m[1] - uz * ww / 2 + nz * 0.02], [m[0] + ux * ww / 2 + nx * 0.02, ya, m[1] + uz * ww / 2 + nz * 0.02], [m[0] + ux * ww / 2 + nx * 0.02, yb, m[1] + uz * ww / 2 + nz * 0.02], [m[0] - ux * ww / 2 + nx * 0.02, yb, m[1] - uz * ww / 2 + nz * 0.02]], [nx, 0, nz]);
    // the balcony's railing: top and bottom rails and balusters (iron)
    B.beam('ironBlack', [a[0], y1 + 0.1 + bay.rail, a[1]], [b[0], y1 + 0.1 + bay.rail, b[1]], 0.05, 0.05);
    B.beam('ironBlack', [a[0], y1 + 0.22, a[1]], [b[0], y1 + 0.22, b[1]], 0.04, 0.04);
    for (let t = 0.06; t < L; t += 0.16) B.box('ironBlack', a[0] + ux * t, y1 + 0.1 + bay.rail / 2, a[1] + uz * t, 0.025, bay.rail, 0.025, 0, {});
  }
  K.prism(B, 'bath', pts, y0, y1);
  B.flat('lead', pts, y1 + 0.1);
  B.box('bathDress', c, y1 + 0.05, pr / 2, bay.base + 0.1, 0.12, pr + 0.1, 0, { bottom: true });
  B.pop();
  // the north wing's west wall north of the west block (party wall to part 'broad')
  wall(B, frame(N.e0, 0, N.s0, 0, 1), rectPts(0, COURT_Y + FOOT, P.WB.s0 - N.s0, N.eaves), [], 'bathOld');
  // the flat-roofed piece: north face, lead flat, parapet
  wall(B, frame(X.e1, 0, X.s0, -1, 0), rectPts(0, COURT_Y + FOOT, X.e1 - X.e0, X.parapet), [sashWin(2.0, 1.0, 0.9, 3.0), sashWin(2.0, 1.0, 4.4, 6.8)], 'bathOld');
  B.flat('lead', [[X.e0, X.s0], [X.e1, X.s0], [X.e1, X.s1], [X.e0, X.s1]], X.top);
  K.parapet(B, 'bath', [[X.e0, X.s0 + 0.15], [X.e1 - 0.15, X.s0 + 0.15], [X.e1 - 0.15, X.s1]], X.top, X.parapet - X.top, 0.3, { coping: 'bathDress' });
}

function roofs(ctx) {
  const { B } = ctx, W = P.WB, E = P.EW, N = P.NS;
  K.roof(B, 'slate', W.e0, W.e1, W.s0, W.s1, W.eaves, W.ridge - W.eaves, { axis: 'z', ends: ['gable', 'gable'], gableWalls: false, ov: W.ov });
  K.roof(B, 'slate', E.roofE0, E.e1, E.s0, E.s1, E.eaves, E.ridge - E.eaves, { axis: 'x', ends: ['open', 'gable'], gableWalls: false, ov: E.ov });
  K.roof(B, 'slate', N.e0, N.e1, N.s0, N.s1, N.eaves, N.ridge - N.eaves, { axis: 'z', ends: ['gable', 'open'], gableWalls: false, ov: 0.2 });
  // eaves cornices of the west block (east side) and the wing's north side are hidden; the tall stack of two round shafts
  const S2 = P.STACK2;
  B.box('bath', (S2.e0 + S2.e1) / 2, (11.5 + S2.base) / 2, (S2.s0 + S2.s1) / 2, S2.e1 - S2.e0, S2.base - 11.5, S2.s1 - S2.s0, 0, { top: true });
  B.box('bathDress', (S2.e0 + S2.e1) / 2, S2.base + 0.08, (S2.s0 + S2.s1) / 2, S2.e1 - S2.e0 + 0.12, 0.16, S2.s1 - S2.s0 + 0.12, 0, {});
  for (const f of [-0.35, 0.35]) {
    const x = (S2.e0 + S2.e1) / 2 + f, z = (S2.s0 + S2.s1) / 2;
    B.cyl('bath', x, S2.base + 0.16, z, S2.r, S2.top - S2.base - 0.36, 10, false);
    B.cyl('bathDress', x, S2.top - 0.2, z, S2.r + 0.07, 0.2, 10, true);
  }
}

// ------------------------------------------------------------------------------------------------ CHAPEL ROW
export function buildChapelRow(ctx) {
  const { B } = ctx, C = P.CR, k = C.slope, yAt = (v) => C.ridge - k * Math.abs(v - C.ridgeV), eN = yAt(C.vN);
  // (second pass) the south face is one straight survey line, vSat(u); west of the notch's east end part east's covered way
  // wall stands on it; the face is drawn from u 25.9 (the yard apron's gate) to the east end
  const n1 = C.notch[0], vsE = C.vSat(C.u1), vsN = C.vSat(n1), eS = yAt(vsE);
  { const dx = C.u1 - n1, dz = vsE - vsN, len = Math.hypot(dx, dz), F = frame(n1, 0, vsN, dx / len, dz / len), sc = (C.southCol - n1) * (len / dx), q = [tudor2(sc, C.win.g), tudor2(sc, C.win.f), tudor2(sc, C.win.t)];
    wall(B, F, [[0, WALK_Y - 0.45], [len, WALK_Y - 0.45], [len, eS], [0, yAt(vsN)]], q.flatMap((t) => t.ops), 'rubble');
    B.push(F); for (const t of q) dressTudor(B, t); quoins(B, len, WALK_Y, Math.min(eS, yAt(vsN))); B.pop(); }
  // east face (x runs north from vS)
  { const len = vsE - C.vN, F = frame(C.u1, 0, vsE, 0, -1), q = [];
    for (const v of C.eastCols) q.push(tudor2(vsE - v, C.win.f), tudor2(vsE - v, C.win.t));
    q.push(tudor2(vsE - C.eastCols[0], C.win.g));
    const dv = vsE - C.eastDoor, door = { pts: tudorPts(dv, 1.0, LAWN_Y, LAWN_Y + 1.85, 0.3, 8), kind: 'door', doorKey: 'oakDoor', d: 0.3 };
    wall(B, F, [[0, LAWN_Y - 0.45], [len, LAWN_Y - 0.45], [len, eN], [0, eS]], [...q.flatMap((t) => t.ops), door], 'rubble');
    B.push(F); for (const t of q) dressTudor(B, t); K.label(B, dv - 0.55, dv + 0.55, LAWN_Y + 2.25, 0.3); quoins(B, len, LAWN_Y, Math.min(eS, eN)); B.pop(); }
  // north face east of the west block
  { const u2 = toL(P.WB.e1, 0)[0], len = C.u1 - u2, F = frame(C.u1, 0, C.vN, -1, 0), q = tudor2(len / 2, C.win.f);
    wall(B, F, rectPts(0, LAWN_Y - 0.45, len, eN), q.ops, 'rubble'); B.push(F); dressTudor(B, q); B.pop(); }
  // the roof: ridge from the tower's east face, the south slope down to the sloping eaves line, the north slope, the hip
  const ov = C.ov, R0 = [C.u0, C.ridge, C.ridgeV], R1 = [C.hipU, C.ridge, C.ridgeV], vn = C.vN - ov, ue = C.u1 + ov;
  const vsW = C.vSat(C.u0) + ov, vsX = C.vSat(ue) + ov;
  const SW = [C.u0, yAt(vsW), vsW], SE = [ue, yAt(vsX), vsX], NEp = [ue, yAt(vn), vn];
  B.poly('slate', [SW, SE, R1, R0], [0, 1, 1]);
  B.poly('slate', [R0, R1, NEp, [C.u0, yAt(vn), vn]], [0, 1, -1]);
  B.poly('slate', [R1, SE, NEp], [1, 1, 0]);
  B.beam('leadDark', [C.u0, C.ridge + 0.04, C.ridgeV], R1, 0.18, 0.08);
  B.beam('leadDark', R1, SE, 0.16, 0.06); B.beam('leadDark', R1, NEp, 0.16, 0.06);
  // a small stack on the ridge (LIDAR 11.1 at u 29)
  K.chimney(B, 'rubble', 28.7, 29.5, C.ridgeV - 0.35, C.ridgeV + 0.35, C.ridge - 0.3, 12.0, { pots: 2, capKey: 'bathDress' });
}

// ------------------------------------------------------------------------------------------------ THE GARDEN
export function buildGarden(ctx) {
  const { B } = ctx;
  // lawn over the whole L; the raised walk; the planter; paths; beds
  B.flat('lawn', P.LAWN, LAWN_Y);
  ctx.floor(P.LAWN, LAWN_Y);
  for (const w of [P.WALK_A, P.WALK_B]) { B.flat('paving', w, WALK_Y); ctx.floor(w, WALK_Y); }
  // the walk's retaining edge (a coped stone kerb down to the lawn)
  const edge = [[[29.4, -4.2], [29.4, P.SIDE_STEPS.v1]], [[29.4, P.SIDE_STEPS.v0], [29.4, -15.4]], [[29.4, -15.4], [31.6, -15.4]], [[31.6, -15.4], [31.6, -15.6]]];
  for (const [a, b] of edge) K.parapet(B, 'bathDress', [a, b], LAWN_Y - 0.1, WALK_Y - LAWN_Y + 0.12, 0.22, { bottom: false });
  // the planter by the library's north path
  B.flat('flowerbed', P.PLANTER, WALK_Y + 0.02);
  K.parapet(B, 'bathDress', [[29.4, -4.2], [46.9, -4.2], [46.4, -2.7]], LAWN_Y - 0.1, WALK_Y - LAWN_Y + 0.2, 0.25);
  ctx.floor(P.PLANTER, WALK_Y + 0.02);
  shrubRow(ctx, P.PLANT.planter);
  // steps down: east end of the Chapel Row walk; from the walk into the west arm
  { const S = P.WALK_STEPS, rise = (WALK_Y - LAWN_Y) / (S.n + 1);
    stepsX(B, 'pavingSolid', S.u0, 1, S.v0, S.v1, S.n, rise, S.going, WALK_Y, LAWN_Y - 0.1);
    ctx.floor([[S.u0, S.v0], [S.u0 + S.n * S.going, S.v0], [S.u0 + S.n * S.going, S.v1], [S.u0, S.v1]], (u) => WALK_Y - rise * (Math.min(S.n - 1, Math.max(0, Math.floor((u - S.u0) / S.going))) + 1)); }
  { const S = P.SIDE_STEPS, rise = (WALK_Y - LAWN_Y) / (S.n + 1);
    stepsX(B, 'pavingSolid', 29.4, 1, S.v0, S.v1, S.n, rise, S.going, WALK_Y, LAWN_Y - 0.1);
    ctx.floor([[29.4, S.v0], [29.4 + S.n * S.going, S.v0], [29.4 + S.n * S.going, S.v1], [29.4, S.v1]], (u) => WALK_Y - rise * (Math.min(S.n - 1, Math.max(0, Math.floor((u - 29.4) / S.going))) + 1)); }
  // paths: along Chapel Row, in front of the classical front and up the east gable (house frame), the north-east arm
  B.flat('paving', P.PATH_CR, PATH_Y - 0.005);
  B.flat('paving', ringL([[P.EW.e0 - 0.4, P.EW.s1], [P.EW.e1 + P.PATH_W, P.EW.s1], [P.EW.e1 + P.PATH_W, P.EW.s1 + P.PATH_W], [P.EW.e0 - 0.4, P.EW.s1 + P.PATH_W]]), PATH_Y);
  B.flat('paving', ringL([[P.EW.e1, -12.6], [P.EW.e1 + P.PATH_W, -12.6], [P.EW.e1 + P.PATH_W, P.EW.s1], [P.EW.e1, P.EW.s1]]), PATH_Y + 0.004);
  B.flat('gravel', P.PATH_NE, PATH_Y - 0.01);
  for (const bed of P.BEDS) B.flat('flowerbed', bed, LAWN_Y + 0.03);
  shrubRow(ctx, P.PLANT.north);
  shrubRow(ctx, P.PLANT.schools);
  shrubRow(ctx, P.PLANT.annexe);
  // low clipped hedges either side of the classical steps (Basher Eyre 2015: dark low shrubs at the foot)
  { const dx = P.EW.e0 + P.CLASSIC.bays[P.CLASSIC.door], H = P.PLANT.hedge;
    for (const [a, b] of [[P.EW.e0 + 0.3, dx - 1.2], [dx + 1.2, P.EW.e1 - 0.3]]) hedge(ctx, [toL(a, P.EW.s1 + H.off), toL(b, P.EW.s1 + H.off)], { w: H.w, h: H.h, y: PATH_Y, kind: H.kind, seed: 41 + a, lod: H.lod }); }
  // trees, furniture
  for (const t of P.TREES) K.tree(B, t.u, t.v, LAWN_Y, t.h, t.r, t.seed);
  K.bench(B, P.BENCH.u, P.BENCH.v, WALK_Y, Math.PI / 2);
  table(B, P.TABLE.u, P.TABLE.v, LAWN_Y);
  B.cyl('white', P.URN.u, LAWN_Y, P.URN.v, 0.42, 0.55, 12, true, 0.25); B.flat('soil', [[P.URN.u - 0.3, P.URN.v - 0.3], [P.URN.u + 0.3, P.URN.v - 0.3], [P.URN.u + 0.3, P.URN.v + 0.3], [P.URN.u - 0.3, P.URN.v + 0.3]], LAWN_Y + 0.5);
  shrub(ctx, P.URN.u, LAWN_Y + 0.5, P.URN.v, { kind: 'flower', r: 0.36, h: 0.4, seed: 77, blooms: ['bloomWhite', 'bloomPink'] });
  schoolsWall(ctx);
  northWall(ctx);
}

/** a row of shrubs along a bed's line (plan P.PLANT: line, spacing, sizes, kinds, lod), each kind from _exeter_plants.js */
function shrubRow(ctx, R) {
  const [a, b] = R.line, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / R.every));
  let s = R.seed * 7919; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n, t = rnd(), x = a[0] + (b[0] - a[0]) * f + (rnd() - 0.5) * 0.3, z = a[1] + (b[1] - a[1]) * f + (rnd() - 0.5) * 0.3;
    shrub(ctx, x, R.y, z, { kind: R.kinds[i % R.kinds.length], r: R.r[0] + (R.r[1] - R.r[0]) * t, h: R.h[0] + (R.h[1] - R.h[0]) * (0.3 * t + 0.7 * rnd()), seed: R.seed + i * 3.1, lod: R.lod, blooms: R.blooms });
  }
}
function table(B, u, v, y0) {
  B.cyl('ironBlack', u, y0 + 0.72, v, 0.45, 0.03, 14, true); B.cyl('ironBlack', u, y0, v, 0.04, 0.72, 6, false);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.3, x = u + Math.cos(a) * 0.85, z = v + Math.sin(a) * 0.85;
    B.box('ironBlack', x, y0 + 0.45, z, 0.42, 0.03, 0.42, -a, {});
    B.box('ironBlack', x + Math.cos(a) * 0.2, y0 + 0.68, z + Math.sin(a) * 0.2, 0.04, 0.45, 0.42, -a, {});
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B.box('ironBlack', x + dx, y0 + 0.22, z + dz, 0.025, 0.44, 0.025, 0, {});
  }
}

function schoolsWall(ctx) {
  const { B } = ctx, S = P.SCHOOLS, [a, b] = [S.a, S.b], L = Math.hypot(b[0] - a[0], b[1] - a[1]), dn = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], east = [-dn[1], dn[0]];
  const ex = [east[0] < 0 ? -east[0] : east[0], east[0] < 0 ? -east[1] : east[1]];      // the yard side's normal (u > 0)
  const yardA = [a[0] + ex[0] * S.t, a[1] + ex[1] * S.t], D = S.door, dxG = L - D.x;    // (garden x runs from the north end)
  // garden face (facing west, x from the north end) with the door through
  const Fg = frame(b[0], 0, b[1], -dn[0], -dn[1]);
  const doorG = rectPts(dxG - D.w / 2, LAWN_Y, dxG + D.w / 2, LAWN_Y + D.h);
  wall(B, Fg, rectPts(0, LAWN_Y - 0.45, L, S.top), [{ pts: doorG, kind: 'door', doorKey: 'doorOak', d: S.t / 2 }], 'rubble');
  B.push(Fg);
  B.box('bathDress', dxG, LAWN_Y + D.h + 0.12, 0.05, D.w + 0.4, 0.24, 0.1, 0, {});
  const lp = K.lantern(B, dxG, LAWN_Y + D.h + 0.55, 0.28);
  B.pop();
  { const q = [b[0] - dn[0] * dxG - ex[0] * 0.28, b[1] - dn[1] * dxG - ex[1] * 0.28]; ctx.lamp(q[0], lp[1], q[1]); }
  // yard face (facing east, x from the south end)
  const Fy = frame(yardA[0], 0, yardA[1], dn[0], dn[1]), ops = [];
  for (const x of S.niches) ops.push({ pts: archPts(x, S.niche.w, S.niche.y0, S.niche.spring, 10), kind: 'none' });
  ops.push({ pts: K.pointedPts(S.gothic.x, S.gothic.w, YARD_Y, S.gothic.spring, S.gothic.rise, 8), kind: 'door', doorKey: 'oakDoor', d: 0.35 });
  wall(B, Fy, rectPts(0, YARD_Y - 0.45, L, S.top), ops, 'rubble');
  B.push(Fy);
  // niches with shell heads
  for (const x of S.niches) {
    const nz = 0.32, p = archPts(x, S.niche.w, S.niche.y0, S.niche.spring, 10);
    B.reveal('bathOld', p, 0, -nz, false); B.face('bathOld', p, [], -nz);
    for (let i = 0; i < 7; i++) { const a0 = (i / 7) * Math.PI, a1 = ((i + 1) / 7) * Math.PI, r = S.niche.w / 2 - 0.02; B.poly(i % 2 ? 'bathDress' : 'bathOld', [[x, S.niche.spring, -nz + 0.02], [x + Math.cos(a0) * r, S.niche.spring + Math.sin(a0) * r, -0.05], [x + Math.cos(a1) * r, S.niche.spring + Math.sin(a1) * r, -0.05]], [0, -0.3, 1]); }
    B.box('bathDress', x, S.niche.y0 - 0.06, 0.05, S.niche.w + 0.2, 0.12, 0.12, 0, {});
  }
  // the pedimented doorcase: its projecting ashlar field, entablature, pediment, the blind niche over the door
  const hw = D.case / 2, pr = D.proj;
  B.box('bathOld', D.x, (YARD_Y + D.ent[0]) / 2, pr / 2, D.case, D.ent[0] - YARD_Y, pr, 0, {});
  B.unit('doorOak', rectPts(D.x - D.w / 2, YARD_Y, D.x + D.w / 2, YARD_Y + D.h), pr + 0.005);
  B.box('bathDress', D.x, D.niche[0] - 0.05, pr + 0.03, D.w + 0.2, 0.1, 0.06, 0, {});
  B.unit('glassDark', archPts(D.x, D.w * 0.9, D.niche[0], D.niche[1], 10), pr + 0.004);      // (a dark recess read as a niche)
  B.box('bathDress', D.x, (D.ent[0] + D.ent[1]) / 2, pr / 2 + 0.06, D.case + 0.3, D.ent[1] - D.ent[0], pr + 0.12, 0, { bottom: true });
  B.poly('bathOld', [[D.x - hw - 0.15, D.ent[1], pr + 0.1], [D.x + hw + 0.15, D.ent[1], pr + 0.1], [D.x, D.apex, pr + 0.1]], [0, 0, 1]);
  for (const sgn of [-1, 1]) B.beam('bathDress', [D.x + sgn * (hw + 0.2), D.ent[1] + 0.02, pr / 2 + 0.06], [D.x, D.apex + 0.08, pr / 2 + 0.06], 0.26, pr + 0.14);
  B.unit('ironBlack', rectPts(S.grille.x - S.grille.w / 2, YARD_Y + S.grille.y[0], S.grille.x + S.grille.w / 2, YARD_Y + S.grille.y[1]), 0.01);
  B.pop();
  // coping along the top and the urns on pedestals
  const mid = (t) => [a[0] + dn[0] * t + ex[0] * S.t / 2, a[1] + dn[1] * t + ex[1] * S.t / 2];
  K.parapet(B, 'bathDress', [mid(0), mid(L)], S.top - 0.02, S.coping, S.t + 0.12);
  for (const x of S.urns) {
    const p = mid(x), y0 = x === D.x ? D.apex + 0.1 : (Math.abs(x - D.x) < hw + 0.3 ? D.ent[1] + 0.05 : S.top + S.coping);
    B.box('bathDress', p[0], y0 + 0.25, p[1], 0.48, 0.5, 0.48, 0, {});
    B.cyl('bathOld', p[0], y0 + 0.5, p[1], 0.14, 0.12, 10, false, 0.2); B.cyl('bathOld', p[0], y0 + 0.62, p[1], 0.24, 0.3, 10, false, 0.14);
    B.cyl('bathOld', p[0], y0 + 0.92, p[1], 0.1, 0.18, 10, false, 0.24); B.cyl('bathOld', p[0], y0 + 1.1, p[1], 0.02, 0.2, 8, true, 0.1);
  }
  { const C = P.PLANT.schoolsClimber;      // on the garden face (Fg: s from the north end), clear of the door, its lintel and lantern
    climber(ctx, Fg, { s0: L - C.to, s1: L - C.from, ground: LAWN_Y, top: C.top, set: C.set, seed: 61, lod: C.lod, stems: 3, gaps: C.gaps, perCell: C.perCell, leaf: C.leaf, holes: [[dxG - D.w / 2 - 0.25, dxG + D.w / 2 + 0.25, LAWN_Y - 1, LAWN_Y + D.h + 0.75]] }); }
  ctx.solid([a, b, [b[0] + ex[0] * S.t, b[1] + ex[1] * S.t], yardA]);
  // the yard's flags along the wall's foot (the Sheldonian yard is not the college's: a 2 m strip so the wall stands on paving)
  B.flat('paving', [yardA, [b[0] + ex[0] * S.t, b[1] + ex[1] * S.t], [b[0] + ex[0] * (S.t + 2), b[1] + ex[1] * (S.t + 2)], [yardA[0] + ex[0] * 2, yardA[1] + ex[1] * 2]], YARD_Y);
}

function northWall(ctx) {
  const { B } = ctx, N = P.NWALL, [a, b] = [N.a, N.b], L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nN = [d[1], -d[0]];      // north normal
  // garden face (facing south, x east), climbers over it (conference guide p7)
  wall(B, frame(a[0], 0, a[1], d[0], d[1]), rectPts(0, LAWN_Y - 0.45, L, N.top), [], 'stoneIvyT');
  { const C = P.PLANT.northClimber; climber(ctx, frame(a[0], 0, a[1], d[0], d[1]), { s0: C.from, s1: L - C.from, ground: LAWN_Y, top: C.top, set: C.set, seed: 51, lod: C.lod, stems: 5, gaps: C.gaps, perCell: C.perCell, leaf: C.leaf }); }
  const c = [a[0] + nN[0] * N.t, a[1] + nN[1] * N.t], e = [b[0] + nN[0] * N.t, b[1] + nN[1] * N.t];
  K.parapet(B, 'bathDress', [[a[0] + nN[0] * N.t / 2, a[1] + nN[1] * N.t / 2], [b[0] + nN[0] * N.t / 2, b[1] + nN[1] * N.t / 2]], N.top - 0.02, 0.12, N.t + 0.1);
  // the neighbour's low flat roof behind it (plain, not the college's)
  const back = [[c[0], c[1]], [e[0], e[1]], [57.15, N.back], [43.25, N.back - 0.3]];
  B.flat('leadDark', back, N.roof);
  ctx.solid([a, b, e, c]);
}

// ------------------------------------------------------------------------------------------------ COLLIDERS
export function registerSolids(ctx) {
  const W = P.WB, E = P.EW, N = P.NS, X = P.NE, C = P.CR;
  // (fix-up pass) the west block's ring takes the recessed doorway in: its face line no longer runs across the reveal's
  // mouth, so a walker steps into the reveal to the leaves (the walk tool's 0.10 m rub at the threshold)
  const zc = W.s0 + P.WEST.door, D = P.DOOR, eR = W.e0 + D.reveal - 0.04;
  ctx.solid(ringL([[W.e0, W.s0], [W.e1, W.s0], [W.e1, W.s1], [W.e0, W.s1], [W.e0, zc + D.w / 2], [eR, zc + D.w / 2], [eR, zc - D.w / 2], [W.e0, zc - D.w / 2]]));
  ctx.solid(ringL([[E.e0, E.s0], [E.e1, E.s0], [E.e1, E.s1], [E.e0, E.s1]]));
  ctx.solid(ringL([[N.e0, N.s0], [N.e1, N.s0], [N.e1, N.s1], [N.e0, N.s1]]));
  ctx.solid(ringL([[X.e0, X.s0], [X.e1, X.s0], [X.e1, X.s1], [X.e0, X.s1]]));
  // (second pass: no porch; the door is recessed in the west front: the reveal is notched into the west block's ring above)
  // Chapel Row (the notch stays open: part east's way out)
  // Chapel Row (second pass): from the tower's east face to its east end, the south face on the survey's line
  ctx.solid([[21.86, C.vSat(21.86)], [C.u1, C.vSat(C.u1)], [C.u1, C.vN], [toL(W.e1, 0)[0], C.vN], [22.33, C.vN]]);
}
