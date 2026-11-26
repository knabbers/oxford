// Exeter College, STANDALONE model, part 'hall' (B02): the build functions. Called by exeter_hall.js with ctx.B already in
// the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from _exeter_hall_plan.js
// (sources and K / G there); the south range's storey heights repeat the west range's (_exeter_west_plan.js) so the two
// meet without a step. Local helpers written here (the west range's are not exported and may not be edited): groups of
// cusped / round lights, cusped heads and head tracery for the Hall's windows, hood moulds, a canted oriel in a wall
// frame, a sloped plinth band, a battlemented coped gable, a clock dial.
import * as K from './_exeter_kit.js';
import * as IK from './_exeter_interior_kit.js';
import {
  FOOT, LANE, HALL, HY, WIN, BAYS_N, BUTTRESS_N, BUTTRESS, UNDERCROFT, SHIELD_Y, BAYS_S, GROTESQUES_S, VENT, BREAST,
  STACK_W, STACK_S, PORCH, ORIEL, SR, QUAD_S_GROUND, STREET_S_GROUND, LANE_GROUND, QDS, STS, QUAD_BAYS, STAIR3, QUAD_PIPE,
  DORMER, DORMERS_Q, DORMERS_L, LOBBY, STREET_BAYS, ORIEL_T, GABLE_T, LANE_BAYS, LANE_PIPES, GABLE_L, STACK_L, STACK_C,
  GROTESQUE_PITCH, LAMPS_S, SHEAR, UC_STAIR, NE_CORNER,
} from './_exeter_hall_plan.js';

const { frame, wall, rectPts, archPts, tudorPts, pointedPts, THREE } = K;
const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [a, ya] = tab[i - 1], [b, yb] = tab[i]; return ya + ((x - a) / (b - a)) * (yb - ya); } return tab[tab.length - 1][1]; };
/** Brasenose Lane's wall line: v at u */
export const laneV = (u) => interp(LANE, u);
const laneY = (u) => interp(LANE_GROUND, u);
const quadSY = (u) => interp(QUAD_S_GROUND, u);
const streetSY = (v) => interp(STREET_S_GROUND, v);
const toLocal = (F, x, y, z) => { const p = new THREE.Vector3(x, y, z).applyMatrix4(F); return [p.x, p.y, p.z]; };
const BATTLE = { merlon: HY.merlonW, gap: HY.gapW, h: HY.merlon };
/** the south range's east end: the Hall's west gable (LOCAL u; gables are square to the quad) */
const SR_E = HALL.uW;

/** a wall outline whose foot follows the ground (FOOT below it) */
function footOutline(s0, s1, top, groundAt, n = 6) {
  const p = [];
  for (let i = 0; i <= n; i++) { const s = s0 + ((s1 - s0) * i) / n; p.push([s, groundAt(s) - FOOT]); }
  p.push([s1, top], [s0, top]);
  return p;
}
/** the highest point of an opening outline over x */
function topAt(pts, x) {
  let best = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    if (p[0] === q[0] || (p[0] - x) * (q[0] - x) > 0) continue;
    best = Math.max(best, p[1] + ((x - p[0]) / (q[0] - p[0])) * (q[1] - p[1]));
  }
  return best;
}

// ------------------------------------------------------------------------------------------------ windows
/** a group of n lights centred at x (head 'pointed' | 'round' | 'rect'); returns { ops, box } */
function lightGroup(x, n, y0, y1, lw, mull, head, d, glass = 'sash') {
  const w = n * lw + (n - 1) * mull, x0 = x - w / 2, ops = [];
  for (let i = 0; i < n; i++) {
    const c = x0 + lw / 2 + i * (lw + mull);
    const pts = head === 'round' ? archPts(c, lw, y0, y1 - lw / 2, 6) : head === 'pointed' ? pointedPts(c, lw, y0, y1 - STS.headRise, STS.headRise, 3) : rectPts(c - lw / 2, y0, c + lw / 2, y1);
    ops.push({ pts, kind: 'win', glass, d, sill: false });
  }
  return { ops, box: [x0, x0 + w, y0, y1] };
}
/** square labels and sills over / under window boxes, in the CURRENT frame */
function dressings(B, boxes, key = 'bathDress') {
  for (const [x0, x1, y0, y1] of boxes) {
    K.label(B, x0 - 0.05, x1 + 0.05, y1 + 0.08, 0.38, key);
    B.box(key, (x0 + x1) / 2, y0 - 0.08, 0.06, x1 - x0 + 0.24, 0.16, 0.12, 0, { bottom: true });
  }
}
/** a FOUR-CENTRED (Perpendicular) opening: steep out of the springing, then nearly straight to a pointed apex h above
 *  the springing (the kit's tudorPts reads round at this size). Outline as the kit's: CCW from the bottom left */
export function fourPts(x, w, y0, ys, h, seg = 12) {
  const r = w / 2, p = [[x - r, y0], [x + r, y0], [x + r, ys]], f = (k) => 0.62 * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k))) + 0.38 * k;
  const half = Math.floor(seg / 2);
  for (let i = 1; i < half; i++) { const k = 1 - Math.pow(1 - i / half, 1.8); p.push([x + r * (1 - k), ys + h * f(k)]); }
  p.push([x, ys + h]);
  for (let i = half - 1; i >= 1; i--) { const k = 1 - Math.pow(1 - i / half, 1.8); p.push([x - r * (1 - k), ys + h * f(k)]); }
  p.push([x - r, ys]);
  return p;
}
/** cusped heads: a stone spandrel with a pointed notch at the top of each of n lights across x0..x0 + w, under yTop,
 *  standing just proud of the glass at z */
function cusps(B, x0, w, n, mull, yTop, h, z, key = 'bathDress', flip = false) {
  for (let i = 0; i < n; i++) {
    const c = x0 + (w * (i + 0.5)) / n, lw = w / n - mull * 0.5, r = lw / 2;
    const arc = pointedPts(c, lw, yTop - h, yTop - h, h - 0.04, 4).slice(2).reverse();
    B.face(key, [[c - r, yTop], ...arc, [c + r, yTop]], [], z, flip);
  }
}
/** the dressings of a Hall window in the CURRENT wall frame: cusped heads under each transom, vertical tracery in the
 *  head (a sub-mullion up each light), a hood mould on the arch with label stops */
function hallWindowDress(B, x, w, sill, spring, apex, n, transoms, d) {
  const x0 = x - w / 2, mw = WIN.mullion, z = -WIN.glassZ + 0.05, zi = -WIN.glassZ - 0.05, pts = fourPts(x, w, sill, spring, apex - spring);
  for (const t of transoms) { cusps(B, x0, w, n, mw, t - mw / 2, 0.58, z); cusps(B, x0, w, n, mw, t - mw / 2, 0.58, zi, 'bathDress', true); }
  for (let i = 0; i < n; i++) {
    const c = x0 + (w * (i + 0.5)) / n, top = topAt(pts, c);
    if (top > spring + 0.15) B.box('bathDress', c, (spring + top) / 2, -d / 2, 0.09, top - spring, d, 0, { top: false });
  }
  // the head's sub-lights: each with a cusped head just under the arch (panel tracery)
  for (let j = 0; j < 2 * n; j++) {
    const a = x0 + (w * j) / (2 * n), c = a + w / (4 * n), yT = Math.min(topAt(pts, a + 0.04), topAt(pts, a + w / (2 * n) - 0.04)) - 0.03;
    if (yT - spring > 0.3) { cusps(B, a, w / (2 * n), 1, 0.06, yT, Math.min(0.32, yT - spring - 0.05), z); cusps(B, a, w / (2 * n), 1, 0.06, yT, Math.min(0.32, yT - spring - 0.05), zi, 'bathDress', true); }
    void c;
  }
  const hood = fourPts(x, w + 0.34, sill, spring, apex - spring + 0.17).slice(2);
  for (let i = 0; i < hood.length - 1; i++) B.beam('bathDress', [hood[i][0], hood[i][1], 0.06], [hood[i + 1][0], hood[i + 1][1], 0.06], WIN.hood, 0.12);
  for (const xx of [x - w / 2 - 0.17, x + w / 2 + 0.17]) B.box('bathDress', xx, spring - 0.2, 0.06, 0.16, 0.4, 0.12, 0, { bottom: true });
  B.box('bathDress', x, sill - 0.08, 0.08, w + 0.3, 0.16, 0.16, 0, { bottom: true });
}
/** a plain blank shield (arms are not drawn) centred at x, y in the CURRENT frame */
function shield(B, x, y, s = 0.5, key = 'bathDress', z = 0.05) {
  const h = s * 0.6;
  B.poly(key, [[x - s / 2, y + h, z], [x + s / 2, y + h, z], [x + s / 2, y - h * 0.15, z], [x, y - h * 1.05, z], [x - s / 2, y - h * 0.15, z]], [0, 0, 1]);
}
function pipe(B, s, yGround, yTop, z) {
  B.cyl('leadDark', s, yGround - 0.05, z, 0.055, yTop - yGround, 6, false);
  B.box('leadDark', s, yTop + 0.15, z, 0.3, 0.32, 0.26, 0, { bottom: true });
}
/** a plinth band in the CURRENT frame whose top follows topAt(s) from s0 to s1: a front face `proj` out and a chamfer */
function slopedBand(B, key, s0, s1, topAt, yb, proj, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = s0 + ((s1 - s0) * i) / n, b = s0 + ((s1 - s0) * (i + 1)) / n, ta = topAt(a), tb = topAt(b);
    B.poly(key, [[a, yb, proj], [b, yb, proj], [b, tb - 0.1, proj], [a, ta - 0.1, proj]], [0, 0, 1]);
    B.poly(key, [[a, ta - 0.1, proj], [b, tb - 0.1, proj], [b, tb, 0], [a, ta, 0]], [0, 1, 1]);
  }
  for (const [s, sg] of [[s0, -1], [s1, 1]]) { const t = topAt(s); B.poly(key, [[s, yb, 0], [s, yb, proj], [s, t - 0.1, proj], [s, t, 0]], [sg, 0, 0]); }
}
/** a coped gable wall in wall frame F from x a..b standing on y0 (the parapet line), apex at m; ops: its window */
function copedGable(B, F, a, b, y0, apex, ops, key = 'bath') {
  const m = (a + b) / 2;
  wall(B, F, [[a, y0 - 0.8], [b, y0 - 0.8], [b, y0], [m, apex], [a, y0]], ops, key);
  B.push(F);
  B.face(key, [[a, y0 - 0.8], [b, y0 - 0.8], [b, y0], [m, apex], [a, y0]], [], -0.4, true);      // the inner face (seen from the roof)
  for (const [p, q] of [[[a - 0.12, y0 - 0.02, -0.18], [m, apex + 0.12, -0.18]], [[m, apex + 0.12, -0.18], [b + 0.12, y0 - 0.02, -0.18]]]) B.beam('bathDress', p, q, 0.5, 0.16);
  B.box('bathDress', m, apex + 0.3, -0.05, 0.28, 0.4, 0.28, 0, {});                 // apex finial block
  for (const x of [a, b]) B.box('bathDress', x, y0 + 0.05, -0.1, 0.4, 0.3, 0.45, 0, { bottom: true });     // kneelers
  B.pop();
}

// ------------------------------------------------------------------------------------------------ THE HALL
// Everything of the Hall is drawn in its own SHEARED frame (plan SHEAR): hall coordinates (u, z) -> LOCAL (u, z + k (u - u0)).
// Its long faces are lines of constant z, its gables of constant u. hallCtx(ctx) hands the floors, colliders and lamps
// registered in hall coordinates on to the model in LOCAL ones; pushHall(B) / B.pop() put a Batch in the frame.
const H = HALL, F0 = H.floor;
/** hall (u, z) -> LOCAL [u, v] */
export const hallToL = (u, z) => [u, z + SHEAR.k * (u - SHEAR.u0)];
/** LOCAL (u, v) -> hall [u, z] */
export const hallOfL = (u, v) => [u, v - SHEAR.k * (u - SHEAR.u0)];
export const shearMatrix = () => new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, SHEAR.k, 0, 1, -SHEAR.k * SHEAR.u0, 0, 0, 0, 1);
export function pushHall(B) { B.push(shearMatrix()); return B; }
/** a LOCAL heading (forward (sin, cos) in (u, v)) of a hall-frame heading */
export const hallDirToL = (a) => Math.atan2(Math.sin(a), Math.cos(a) + SHEAR.k * Math.sin(a));
/** a ctx whose floor / solid / seg / lamp take hall coordinates (the Batch is the caller's to push) */
export function hallCtx(ctx) {
  const L = (p) => hallToL(p[0], p[1]);
  return { ...ctx,
    floor(ring, y) { ctx.floor(ring.map(L), typeof y === 'function' ? (u, v) => y(u, v - SHEAR.k * (u - SHEAR.u0)) : y); },
    solid(ring) { ctx.solid(ring.map(L)); },
    seg(u1, z1, u2, z2) { const a = L([u1, z1]), b = L([u2, z2]); ctx.seg(a[0], a[1], b[0], b[1]); },
    lamp(u, y, z) { const a = L([u, z]); ctx.lamp(a[0], y, a[1]); },
  };
}
// the faces (wall frames, hall coordinates)
const O = ORIEL;
const FN = () => frame(O.u0, 0, H.vN, -1, 0), sN = (u) => O.u0 - u;                 // north face: s runs west from the oriel
const FSo = () => frame(H.uW, 0, H.vS, 1, 0), sSo = (u) => u - H.uW, LS = H.uE - H.uW;  // lane face: s runs east
/** the quad's ground under the north face (and its way to the porch): LOCAL lgbox 0.1 - 0.2 */
const g = HY.quad;
/** a Hall window op (an open four-centred opening: the glass is real, see glazeHallWindow) */
function hallWindowOp(x, w, sill, spring, apex) {
  return { pts: fourPts(x, w, sill, spring, apex - spring), kind: 'void', d: WIN.reveal };
}
/** its mullions, transoms and pane (and heraldic roundels inside) in the CURRENT frame F (pushed on B) */
function glazeHallWindow(B, gl, F, x, w, sill, spring, apex, n, transoms) {
  IK.glazedLights(B, gl, F, fourPts(x, w, sill, spring, apex - spring), { lights: n, transoms, d: WIN.reveal, mullionW: WIN.mullion, zg: WIN.glassZ, heraldry: true, spring });
}

export function buildHall(ctx0, gl) {
  const { B } = ctx0, ctx = hallCtx(ctx0);
  pushHall(B); gl.B.push(shearMatrix());
  const L = sN(H.uW);
  // ---- the north face to the quad (from the west gable to the oriel)
  const ops = [];
  for (const u of BAYS_N) ops.push(hallWindowOp(sN(u), WIN.w, WIN.sill, WIN.spring, WIN.apex));
  const PU = PORCH.upper, pc = PORCH.doorU;
  ops.push(hallWindowOp(sN(pc), PU.w, PU.sill, PU.spring, PU.apex));
  const UC = UNDERCROFT, ucU = BAYS_N.slice(1);
  for (const u of ucU) for (const d of [-1, 1]) ops.push({ pts: archPts(sN(u) + d * (UC.lightW / 2 + 0.07), UC.lightW, UC.y[0], UC.y[1] - UC.lightW / 2, 6), kind: 'win', glass: 'glassDark', d: 0.32, sill: false });
  // the arch through the wall from the porch into the screens passage (the porch hides its outer face)
  const A = PORCH.arch, aw = A.u1 - A.u0;
  ops.push({ pts: fourPts(sN((A.u0 + A.u1) / 2), aw, F0, F0 + A.spring, A.rise, 10), kind: 'void', d: H.wall });
  // (the wall is notched where the undercroft's stair passes through it, up to the opening's head: buildUndercroftStair)
  const ucE = sN(UC_STAIR.u1 - UC_STAIR.wallT), ucW = sN(UC_STAIR.u0 + UC_STAIR.wallT);
  wall(B, FN(), [[0, g - FOOT], [ucE, g - FOOT], [ucE, UC_STAIR.head], [ucW, UC_STAIR.head], [ucW, g - FOOT], [L, g - FOOT], [L, HY.string], [0, HY.string]], ops, 'quadStone');
  B.push(FN());
  for (const u of BAYS_N) { hallWindowDress(B, sN(u), WIN.w, WIN.sill, WIN.spring, WIN.apex, WIN.lights, [WIN.transom, WIN.spring], WIN.reveal); glazeHallWindow(B, gl, FN(), sN(u), WIN.w, WIN.sill, WIN.spring, WIN.apex, WIN.lights, [WIN.transom, WIN.spring]); }
  hallWindowDress(B, sN(pc), PU.w, PU.sill, PU.spring, PU.apex, PU.lights, [PU.spring], WIN.reveal);
  glazeHallWindow(B, gl, FN(), sN(pc), PU.w, PU.sill, PU.spring, PU.apex, PU.lights, [PU.spring]);
  for (const u of ucU) B.box('bathDress', sN(u), UC.y[1] + 0.1, 0.05, 1.05, 0.1, 0.1, 0, { bottom: true });    // a drip over each low opening
  K.stringCourse(B, 'bathOld', 0, L, HY.plinthN, 0.28, 0.13);
  K.stringCourse(B, 'bathDress', 0, L, HY.string + 0.04, 0.22, 0.17);
  for (const u of BAYS_N) shield(B, sN(u), SHIELD_Y, 0.55);
  for (const u of BUTTRESS_N) K.buttress(B, 'bathOld', sN(u), g - FOOT, BUTTRESS.w, BUTTRESS.stages);
  { const s = sN(UC.lamp.u); B.box('ironBlack', s, UC.lamp.y + 0.55, 0.22, 0.05, 0.05, 0.42, 0, {}); const p = K.lantern(B, s, UC.lamp.y, 0.42, { size: 0.26 }); ctx.lamp(...toLocal(FN(), ...p)); }
  B.pop();
  { const t = HY.parapetT, v = H.vN + t / 2; K.parapet(B, 'quadStone', [[H.uW + t / 2, v], [O.u0 + 0.05, v]], HY.string, HY.embr - HY.string, t, { battle: BATTLE, coping: 'bathDress' }); }
  buildOriel(ctx, gl);
  buildPorch(ctx);
  buildUndercroftStair(ctx);

  // ---- the south face to Brasenose Lane: a rubble base, a string, ashlar, six windows set high, battlements
  const gS = (s) => laneY(H.uW + s);
  const vent = { pts: rectPts(sSo(VENT.u) - VENT.w / 2, VENT.y[0], sSo(VENT.u) + VENT.w / 2, VENT.y[1]), kind: 'win', lights: 3, glass: 'glassDark', d: 0.3, mullionW: 0.12 };
  wall(B, FSo(), footOutline(0, LS, HY.laneString, gS), [vent], 'rubble');
  const opsS = BAYS_S.map((u) => hallWindowOp(sSo(u), WIN.w, WIN.sillS, WIN.spring, WIN.apex));
  wall(B, FSo(), [[0, HY.laneString], [LS, HY.laneString], [LS, HY.string], [0, HY.string]], opsS, 'bath');
  B.push(FSo());
  for (const u of BAYS_S) { hallWindowDress(B, sSo(u), WIN.w, WIN.sillS, WIN.spring, WIN.apex, WIN.lights, [WIN.transomS, WIN.spring], WIN.reveal); glazeHallWindow(B, gl, FSo(), sSo(u), WIN.w, WIN.sillS, WIN.spring, WIN.apex, WIN.lights, [WIN.transomS, WIN.spring]); }
  K.stringCourse(B, 'bathDress', 0, LS, HY.laneString, 0.24, 0.15);
  K.stringCourse(B, 'bathDress', 0, LS, HY.string + 0.04, 0.22, 0.17);
  for (let i = 0; i < GROTESQUES_S; i++) { const s = 1.0 + ((LS - 2.0) * (i + 0.5)) / GROTESQUES_S; B.box('bathOld', s, HY.string - 0.14, 0.3, 0.28, 0.34, 0.36, 0, { bottom: true }); }
  { const s = sSo(BREAST.u), yb = laneY(BREAST.u) - FOOT; B.box('rubble', s, (yb + BREAST.top) / 2, BREAST.proj / 2, BREAST.w, BREAST.top - yb, BREAST.proj, 0, { top: false });
    B.poly('bathDress', [[s - BREAST.w / 2, BREAST.top, BREAST.proj], [s + BREAST.w / 2, BREAST.top, BREAST.proj], [s + BREAST.w / 2, BREAST.top + 0.3, 0], [s - BREAST.w / 2, BREAST.top + 0.3, 0]], [0, 1, 1]); }
  for (const Lm of LAMPS_S) {
    const s = sSo(Lm.u);
    B.box('ironBlack', s, Lm.y + 0.75, 0.35, 0.05, 0.05, 0.7, 0, {});
    B.beam('ironBlack', [s, Lm.y + 0.2, 0.02], [s, Lm.y + 0.72, 0.5], 0.035);
    const p = K.lantern(B, s, Lm.y + 0.05, 0.7, { size: 0.3 });
    ctx.lamp(...toLocal(FSo(), ...p));
  }
  B.pop();
  { const t = HY.parapetT; K.parapet(B, 'bath', [[H.uW + t / 2, H.vS - t / 2], [H.uE - t / 2, H.vS - t / 2]], HY.string, HY.embr - HY.string, t, { battle: BATTLE, coping: 'bathDress' }); }

  // ---- the gables, the roof, the stacks
  const W0 = H.vS - H.vN, rTop = HY.ridge + 0.35;
  copedGable(B, frame(H.uW, 0, H.vN, 0, 1), 0, W0, HY.embr, rTop, [], 'quadStone');
  // the west gable's face in the quad's south-west corner, between the Hall's north face and the south range's
  { const zq = hallOfL(H.uW, SR.vQ)[1]; wall(B, frame(H.uW, 0, H.vN, 0, 1), [[0, g - FOOT], [zq - H.vN, g - FOOT], [zq - H.vN, HY.embr - 0.7], [0, HY.embr - 0.7]], [], 'quadStone');
    B.push(frame(H.uW, 0, H.vN, 0, 1)); K.stringCourse(B, 'bathOld', 0, zq - H.vN, HY.plinthN, 0.28, 0.13); B.pop(); }
  copedGable(B, frame(H.uE, 0, H.vS, 0, -1), 0, W0, HY.embr, rTop, [], 'quadStone');
  // (the east gable below the parapet: a party wall with the east range, which hides it; drawn so the room is closed without it)
  wall(B, frame(H.uE, 0, H.vS, 0, -1), [[0, HY.lane - FOOT], [W0, HY.quad - FOOT], [W0, HY.embr - 0.8], [0, HY.embr - 0.8]], [], 'quadStone');
  hallRoof(B);
  { const S = STACK_W; K.chimney(B, 'quadStone', S.u - S.wu / 2, S.u + S.wu / 2, S.v - S.wv / 2, S.v + S.wv / 2, HY.ridge - 1.4, S.top, { pots: 2, capKey: 'bathDress' }); }
  { const S = STACK_S, v = H.vS - S.base[1] / 2 + 0.12, [bu, bv] = S.base, [su, sv] = S.shaft, y0 = HY.string - 1.2;
    B.box('bath', S.u, (y0 + S.baseTop) / 2, v, bu, S.baseTop - y0, bv, 0, { top: false });
    B.poly('bath', [[S.u - bu / 2, S.baseTop, v - bv / 2], [S.u + bu / 2, S.baseTop, v - bv / 2], [S.u + su / 2, S.baseTop + 0.4, v - sv / 2], [S.u - su / 2, S.baseTop + 0.4, v - sv / 2]], [0, 1, -1]);
    B.poly('bath', [[S.u + bu / 2, S.baseTop, v + bv / 2], [S.u - bu / 2, S.baseTop, v + bv / 2], [S.u - su / 2, S.baseTop + 0.4, v + sv / 2], [S.u + su / 2, S.baseTop + 0.4, v + sv / 2]], [0, 1, 1]);
    B.poly('bath', [[S.u - bu / 2, S.baseTop, v + bv / 2], [S.u - bu / 2, S.baseTop, v - bv / 2], [S.u - su / 2, S.baseTop + 0.4, v - sv / 2], [S.u - su / 2, S.baseTop + 0.4, v + sv / 2]], [-1, 1, 0]);
    B.poly('bath', [[S.u + bu / 2, S.baseTop, v - bv / 2], [S.u + bu / 2, S.baseTop, v + bv / 2], [S.u + su / 2, S.baseTop + 0.4, v + sv / 2], [S.u + su / 2, S.baseTop + 0.4, v - sv / 2]], [1, 1, 0]);
    K.chimney(B, 'bath', S.u - su / 2, S.u + su / 2, v - sv / 2, v + sv / 2, S.baseTop + 0.35, S.top - 0.16, { pots: 1, capKey: 'bathDress' }); }
  gl.B.pop(); B.pop();
}

/** the Hall's steep slate roof between the gables (hall frame: the slopes run square to the long faces), lead gutters */
function hallRoof(B) {
  const t = HY.parapetT, u0 = H.uW + 0.5, u1 = H.uE - 0.5, e = HY.gutter, r = HY.ridge;
  const vNe = H.vN + t, vSe = H.vS - t, vm = (H.vN + H.vS) / 2;
  B.poly('slate', [[u0, e, vNe], [u1, e, vNe], [u1, r, vm], [u0, r, vm]], [0, 1, -1]);
  B.poly('slate', [[u0, r, vm], [u1, r, vm], [u1, e, vSe], [u0, e, vSe]], [0, 1, 1]);
  B.poly('lead', [[u0, e - 0.02, H.vN + 0.02], [u1, e - 0.02, H.vN + 0.02], [u1, e - 0.02, vNe + 0.05], [u0, e - 0.02, vNe + 0.05]], [0, 1, 0]);
  B.poly('lead', [[u0, e - 0.02, vSe - 0.05], [u1, e - 0.02, vSe - 0.05], [u1, e - 0.02, H.vS - 0.02], [u0, e - 0.02, H.vS - 0.02]], [0, 1, 0]);
  B.beam('lead', [u0, r + 0.04, vm], [u1, r + 0.04, vm], 0.16, 0.1);
}

// ------------------------------------------------------------------------------------------------ the oriel (dais bay)
/** the oriel's outer corners (hall coordinates), west to east: on the north face, the front's two ends, on the face */
export const orielPts = () => [[O.u0, H.vN], [O.f0, O.z], [O.f1, O.z], [O.u1, H.vN]];
/** the north-east corner's outline (hall coordinates): the oriel's front corner, on along the front to the east range's
 *  quad face, under the range to the gable's line, back along the gable to the north face, to the return's foot */
export const neCornerPts = () => { const [, , P2, P3] = orielPts(), N = NE_CORNER; return [P2, hallOfL(N.uRange, N.vRange), hallOfL(H.uE, N.vRange), [H.uE, H.vN], P3]; };
function buildOriel(ctx, gl) {
  const { B } = ctx, [P0, P1, P2, P3] = orielPts();
  for (const [i, [a, b]] of [[P3, P2], [P2, P1], [P1, P0]].entries()) {
    if (i === 0) continue;      // (the east return is inside the north-east corner's mass: neCorner)
    const Lw = Math.hypot(b[0] - a[0], b[1] - a[1]), F = frame(a[0], 0, a[1], b[0] - a[0], b[1] - a[1]);
    const n = i === 1 ? 4 : 1, x0 = i === 1 ? 0.16 : 0.2, x1 = Lw - x0, mw = 0.12, pts = rectPts(x0, O.y[0], x1, O.y[1]);
    wall(B, F, [[0, g - FOOT], [Lw, g - FOOT], [Lw, HY.string], [0, HY.string]], [{ pts, kind: 'void', d: 0.24 }], 'quadStone');
    B.push(F);
    IK.glazedLights(B, gl, F, pts, { lights: n, transoms: O.transoms, d: 0.24, mullionW: mw, zg: 0.12, heraldry: true });
    for (const t of [...O.transoms, O.y[1] + mw / 2]) { cusps(B, x0, x1 - x0, n, mw, t - mw / 2, 0.42, -0.07); cusps(B, x0, x1 - x0, n, mw, t - mw / 2, 0.42, -0.17, 'bathDress', true); }
    K.stringCourse(B, 'bathOld', -0.02, Lw + 0.02, HY.plinthN, 0.28, 0.13);
    K.stringCourse(B, 'bathDress', -0.02, Lw + 0.02, HY.string + 0.04, 0.22, 0.17);
    K.stringCourse(B, 'bathDress', 0, Lw, O.y[0] - 0.05, 0.12, 0.08);
    B.pop();
  }
  // the north-east corner: a solid mass of the oriel's stone from its front corner to the east range and the gable
  const C = neCornerPts(), A = C[1], Bq = C[2];
  K.prism(B, 'quadStone', C, g - FOOT, HY.string, {});
  { const L = Math.hypot(A[0] - P2[0], A[1] - P2[1]), F = frame(P2[0], 0, P2[1], A[0] - P2[0], A[1] - P2[1]);
    B.push(F); K.stringCourse(B, 'bathOld', -0.02, L + 0.02, HY.plinthN, 0.28, 0.13); K.stringCourse(B, 'bathDress', -0.02, L + 0.02, HY.string + 0.04, 0.22, 0.17); B.pop(); }
  const t = HY.parapetT, q = t / 2;
  K.parapet(B, 'quadStone', [[P0[0] + q, P0[1]], [P1[0] + q * 0.4, P1[1] + q], [P2[0] - q * 0.4, P2[1] + q], [A[0], A[1] + q], [Bq[0] - q, Bq[1] + q]], HY.string, HY.embr - HY.string, t, { battle: BATTLE, coping: 'bathDress' });
  B.flat('lead', [P0, P1, P2, A, Bq, [H.uE, H.vN]], HY.string + 0.05);
}

// ------------------------------------------------------------------------------------------------ the porch (1820) and its steps
function clock(B, x, y, r) {
  const n = 20, ring = (rr) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; });
  B.face('bathDress', ring(r + 0.13), [ring(r)], 0.07);
  B.face('clockBlue', ring(r), [], 0.045);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; B.beam('gold', [x + Math.cos(a) * r * 0.68, y + Math.sin(a) * r * 0.68, 0.055], [x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88, 0.055], 0.045, 0.012); }
  for (const [a, len] of [[Math.PI * 0.33, 0.5], [Math.PI * 0.75, 0.78]]) B.beam('gold', [x, y, 0.06], [x + Math.cos(a) * r * len, y + Math.sin(a) * r * len, 0.06], 0.035, 0.012);
}
const porchF = () => frame(PORCH.u1, 0, PORCH.vF, -1, 0);      // the front faces north; s runs west from the east corner
/** the porch door's two leaves for an interior kit DoorSet (LOCAL hinges and headings; they open inward, to the south) */
export function porchDoors(doors) {
  const P = PORCH, Lv = P.leaves, z = P.vF + Lv.z;
  for (const [u, a, sw] of [[P.doorU - Lv.w, Math.PI / 2, -1], [P.doorU + Lv.w, -Math.PI / 2, 1]]) {
    const [lu, lv] = hallToL(u, z);
    doors.add({ name: 'porch' + sw, u: lu, v: lv, y: P.landing, w: Lv.w - 0.01, h: Lv.h, dir: hallDirToL(a), swing: sw, style: 'oak', heavy: true, thick: 0.07 });
  }
  return doors;
}
function buildPorch(ctx) {
  const { B } = ctx, P = PORCH, W = P.u1 - P.u0, D = P.door, sc = P.u1 - P.doorU;
  const F = porchF;
  const door = pointedPts(sc, D.w, P.landing, D.spring, D.rise, 8);
  const lanc = [];
  for (const s of P.lancets.s) for (const d of [-1, 1]) lanc.push({ pts: pointedPts(sc + d * s, P.lancets.w, P.lancets.y[0], P.lancets.y[1] - 0.16, 0.16, 3), kind: 'win', glass: 'glassDark', d: 0.12, sill: false });
  wall(B, F(), [[0, g - FOOT], [W, g - FOOT], [W, P.top], [0, P.top]], [{ pts: door, kind: 'void', d: 0.5 }, ...lanc], 'quadStone');
  B.push(F());
  // the door's fixed traceried head over the two leaves (the leaves are real: porchDoors), both faces
  { const z = -P.leaves.z, head = door.slice(2), y0 = D.spring;
    B.face('hallDoor', head, [], z + 0.03); B.face('hallDoor', head, [], z - 0.03, true);
    B.box('hallDoor', sc, y0 + 0.04, z, D.w, 0.1, 0.1, 0, { bottom: true });
    for (const k of [-1, 0, 1]) B.box('hallDoor', sc + k * D.w * 0.26, (y0 + D.spring + D.rise * (k ? 0.6 : 0.95)) / 2 + 0.05, z, 0.05, (D.rise * (k ? 0.6 : 0.95)) - 0.08, 0.09, 0, {});
    for (const sg of [1, -1]) cusps(B, sc - D.w / 2 + 0.06, D.w - 0.12, 4, 0.05, y0 + 0.42, 0.28, z + sg * 0.05, 'hallDoor', sg < 0);
    // the jambs' timber frame the leaves shut against
    for (const sx of [-1, 1]) B.box('hallDoor', sc + sx * (D.w / 2 - 0.03), (P.landing + y0) / 2, z, 0.06, y0 - P.landing, 0.14, 0, {}); }
  for (const [dw, z] of [[0.3, 0.05], [0.62, 0.09]]) {
    const a = pointedPts(sc, D.w + dw, P.landing, D.spring, D.rise + dw * 0.3, 8).slice(2);
    for (let i = 0; i < a.length - 1; i++) B.beam('bathDress', [a[i][0], a[i][1], z], [a[i + 1][0], a[i + 1][1], z], 0.15, 0.1);
    for (const sx of [-1, 1]) B.box('bathDress', sc + (sx * (D.w + dw)) / 2, (P.landing + D.spring) / 2, z, 0.15, D.spring - P.landing, 0.1, 0, {});
  }
  K.stringCourse(B, 'bathDress', 0, W, P.bossString, 0.16, 0.12);
  for (let k = 0; k < 7; k++) B.box('bathOld', 0.5 + ((W - 1.0) * k) / 6, P.bossString - 0.08, 0.14, 0.17, 0.17, 0.08, 0, {});     // foliage bosses
  for (const sx of [-1, 1]) shield(B, sc + sx * Math.min(P.shieldS, W / 2 - 0.55), P.shieldY, 0.32, 'white', 0.05);
  clock(B, sc, P.clock.y, P.clock.r);
  for (const s of P.lancets.s) for (const d of [-1, 1]) K.label(B, sc + d * s - P.lancets.w / 2, sc + d * s + P.lancets.w / 2, P.lancets.y[1] + 0.02, 0.12);
  K.stringCourse(B, 'bathDress', 0, W, P.band[0] + 0.07, 0.12, 0.1);
  for (let k = 0; k <= 14; k++) B.box('bathDress', 0.4 + ((W - 0.8) * k) / 14, (P.band[0] + P.band[1]) / 2 + 0.03, 0.04, 0.05, P.band[1] - P.band[0] - 0.1, 0.05, 0, {});
  K.stringCourse(B, 'bathDress', -0.06, W + 0.06, P.top + 0.12, 0.17, 0.12);       // the coping
  K.stringCourse(B, 'bathOld', 0, W, 0.9, 0.9 - (g - FOOT), 0.06);
  for (const x of [P.buttress.w / 2, W - P.buttress.w / 2]) K.buttress(B, 'bathOld', x, g - FOOT, P.buttress.w, P.buttress.stages);
  B.pop();
  // pinnacles on the corner buttresses (LIDAR 8.9)
  const st = P.buttress.stages[1];
  for (const u of [P.u1 - P.buttress.w / 2, P.u0 + P.buttress.w / 2]) K.pinnacle(B, 'bathDress', u, P.vF - st[1] / 2, st[0] - 0.05, P.buttress.pinnacle - 0.75, 0.38, 0.75);
  // the sides, back to the Hall's north face
  const top = P.top, dz = H.vN - P.vF;
  for (const F2 of [frame(P.u0, 0, P.vF, 0, 1), frame(P.u1, 0, H.vN, 0, -1)]) { wall(B, F2, [[0, g - FOOT], [dz, g - FOOT], [dz, top], [0, top]], [], 'quadStone'); B.push(F2); K.stringCourse(B, 'bathDress', -0.06, dz + 0.06, top + 0.12, 0.17, 0.12); B.pop(); }
  B.flat('lead', [[P.u0, P.vF], [P.u1, P.vF], [P.u1, H.vN], [P.u0, H.vN]], P.roof);
  buildSteps(ctx);
}
/** the steps: six treads wrapping the porch on three sides (front and both sides back to the Hall's face), each 0.2
 *  above the last, then the threshold. Floors: each tread a rectangle, the higher ones registered after (they win) */
function buildSteps(ctx) {
  const { B } = ctx, P = PORCH, S = P.steps, rise = (P.landing - g) / S.n, yb = g - 0.3, nT = S.n - 1;
  for (let k = nT - 1; k >= 0; k--) {      // k = 0 the top tread
    const y = P.landing - rise * (k + 1), a = P.u0 - S.goingW * (k + 1), b = P.u1 + S.goingE * (k + 1), zf = P.vF - S.goingF * (k + 1);
    // (each tread drawn as the outer band of its level: a front piece and two side pieces, solid down to below the ground)
    B.box('pavingSolid', (a + b) / 2, (y + yb) / 2, (zf + zf + S.goingF) / 2, b - a, y - yb, S.goingF, 0, {});
    for (const [x0, x1] of [[a, a + S.goingW], [b - S.goingE, b]]) B.box('pavingSolid', (x0 + x1) / 2, (y + yb) / 2, (zf + S.goingF + H.vN) / 2, x1 - x0, y - yb, H.vN - zf - S.goingF, 0, {});
    ctx.floor([[a, zf], [b, zf], [b, H.vN], [a, H.vN]], y);
  }
  // the threshold in the doorway and the porch's floor through to the Hall's (the Hall's own floor: part hallint)
  const I = P.inner;
  ctx.floor([[P.doorU - P.door.w / 2 - 0.1, P.vF - 0.02], [P.doorU + P.door.w / 2 + 0.1, P.vF - 0.02], [P.doorU + P.door.w / 2 + 0.1, P.vF + 0.6], [P.doorU - P.door.w / 2 - 0.1, P.vF + 0.6]], P.landing);
  ctx.floor([[I.u0, P.vF + 0.4], [I.u1, P.vF + 0.4], [I.u1, H.vN + 0.05], [I.u0, H.vN + 0.05]], P.landing);
  B.box('pavingSolid', P.doorU, P.landing - 0.12, P.vF + 0.25, P.door.w + 0.1, 0.24, 0.5, 0, { bottom: false });
}
/** the undercroft's way in: a walled stair head on the quad beside the porch, its gate standing open, a straight stone
 *  flight 1.9 m wide descending south through the Hall's north wall to a lobby with a shut door (the bar beyond it is not
 *  built). Hall coordinates (the Batch is in the Hall's frame); figures UC_STAIR (plan). The Hall's north face is notched
 *  over the opening (buildHall) */
function buildUndercroftStair(ctx) {
  const { B } = ctx, U = UC_STAIR, h = g + U.wallH, t = U.wallT, a = U.u0 + t, b = U.u1 - t, n = U.risers;
  const zOf = (k) => U.zStair + U.going * k, yOf = (k) => g - U.rise * (k + 1);      // riser k's line; the tread after it
  const yL = yOf(n - 1), zL = zOf(n - 1), yb = yL - 0.3;
  // the low walls either side (to the Hall's face) with their coping
  for (const [x0, x1] of [[U.u0, a], [b, U.u1]]) {
    B.box('quadStone', (x0 + x1) / 2, (h + g - 0.3) / 2, (U.zF + H.vN) / 2, x1 - x0, h - g + 0.3, H.vN - U.zF, 0, {});
    B.box('bathDress', (x0 + x1) / 2, h + 0.05, (U.zF + H.vN) / 2, x1 - x0 + 0.08, 0.1, H.vN - U.zF + 0.08, 0, { bottom: true });
  }
  // the well's walls below the low walls and on through the Hall's wall to the lobby (ashlar), the head of the opening
  for (const [x, nx] of [[a, 1], [b, -1]]) {
    const zs = nx > 0 ? [U.zF, U.zDoor] : [U.zDoor, U.zF];
    B.poly('quadStone', [[x, yb, zs[0]], [x, yb, zs[1]], [x, g - 0.3, zs[1]], [x, g - 0.3, zs[0]]].map(([X, Y, Z]) => [X, Y, Z]), [nx, 0, 0]);
    const zw = nx > 0 ? [H.vN, U.zDoor] : [U.zDoor, H.vN];
    B.poly('quadStone', [[x, g - 0.3, zw[0]], [x, g - 0.3, zw[1]], [x, U.head, zw[1]], [x, U.head, zw[0]]], [nx, 0, 0]);
  }
  B.flat('quadStone', [[a, H.vN], [b, H.vN], [b, U.zDoor + 0.05], [a, U.zDoor + 0.05]], U.head, [], true);
  // the landing inside the gate, at the quad's level
  B.box('pavingSolid', (a + b) / 2, g - 0.15, (U.zF + U.zStair) / 2, b - a, 0.3, U.zStair - U.zF, 0, { bottom: false });
  ctx.floor([[a, U.zF - 0.02], [b, U.zF - 0.02], [b, U.zStair], [a, U.zStair]], g);
  // the flight: each tread a stone block (its front the riser), registered as a floor
  for (let k = 0; k < n - 1; k++) {
    const z0 = zOf(k), z1 = zOf(k + 1), y = yOf(k);
    B.box('pavingSolid', (a + b) / 2, y - 0.14, (z0 + z1) / 2, b - a, 0.28, z1 - z0, 0, { bottom: false });
    B.box('bathDress', (a + b) / 2, y - 0.02, z0 + 0.025, b - a, 0.04, 0.05, 0, { bottom: false });      // the nosing
    ctx.floor([[a, z0], [b, z0], [b, z1], [a, z1]], y);
  }
  // the lobby at the foot, and its south wall with the shut door into the bar (oak, a plain stone surround)
  B.box('pavingSolid', (a + b) / 2, yL - 0.15, (zL + U.zDoor) / 2, b - a, 0.3, U.zDoor - zL, 0, { bottom: false });
  B.box('bathDress', (a + b) / 2, yL - 0.02, zL + 0.025, b - a, 0.04, 0.05, 0, { bottom: false });
  ctx.floor([[a, zL], [b, zL], [b, U.zDoor], [a, U.zDoor]], yL);
  { const Fd = frame(b, 0, U.zDoor, -1, 0), w = b - a, sc = w / 2, D = U.door;
    B.push(Fd);
    B.face('quadStone', [[0, yb], [w, yb], [w, U.head], [0, U.head]], [rectPts(sc - D.w / 2, yL, sc + D.w / 2, yL + D.h)], 0);
    B.unit('doorOak', rectPts(sc - D.w / 2, yL, sc + D.w / 2, yL + D.h), -0.06, [9, 0]);
    B.reveal('bathDress', rectPts(sc - D.w / 2, yL, sc + D.w / 2, yL + D.h), 0, -0.06, true);
    for (const sx of [-1, 1]) B.box('bathDress', sc + sx * (D.w / 2 + 0.07), yL + D.h / 2, 0.03, 0.14, D.h, 0.06, 0, {});
    B.box('bathDress', sc, yL + D.h + 0.08, 0.03, D.w + 0.28, 0.16, 0.06, 0, {});
    B.box('ironBlack', sc + D.w * 0.32, yL + 1.0, -0.03, 0.04, 0.14, 0.05, 0, {});
    B.pop(); }
  // the gate: two iron leaves standing open, each folded back against its side wall over the head of the flight
  const gw = Math.min(U.gateW, b - a) / 2;
  for (const [x, sx] of [[a + 0.03, 1], [b - 0.03, -1]]) {
    const z0 = U.zF + 0.08, z1 = z0 + gw;
    for (const y of [g + 0.15, h - 0.05]) B.box('ironBlack', x, y, (z0 + z1) / 2, 0.03, 0.04, gw, 0, {});
    for (let i = 0; i <= 6; i++) B.box('ironBlack', x, (g + 0.1 + h) / 2, z0 + (gw * i) / 6, 0.02, h - g - 0.1, 0.02, 0, { top: false });
    void sx;
  }
  // colliders: the side walls from the gate to the lobby's door; the door's wall
  ctx.solid([[U.u0, U.zF], [a, U.zF], [a, U.zDoor], [U.u0, U.zDoor]]);
  ctx.solid([[b, U.zF], [U.u1, U.zF], [U.u1, U.zDoor], [b, U.zDoor]]);
  ctx.seg(a, U.zDoor, b, U.zDoor);
}

// ------------------------------------------------------------------------------------------------ THE SOUTH-WEST / SOUTH RANGE
const N_LIGHTS = { 1: 1, 2: 2, 3: 3 };
export function buildSouthRange(ctx) {
  const { B } = ctx, t = SR.parapetT;
  // ---- the quad face (faces north; s runs west from the Hall's west gable)
  {
    const FQ = () => frame(H.uW, 0, SR.vQ, -1, 0), sQ = (u) => H.uW - u, Lq = sQ(SR.uQd), P = QDS;
    const ops = [], boxes = [], grp = (s, k, y) => { const gr = lightGroup(s, N_LIGHTS[k], y[0], y[1], P.lightW, P.mullion, 'round', P.reveal, 'sash'); ops.push(...gr.ops); boxes.push(gr.box); };
    let door = null;
    for (const b of QUAD_BAYS) {
      const s = sQ(b.u);
      grp(s, b.k, P.f); grp(s, b.k, P.t);
      if (b.door) { const y0 = quadSY(b.u) + 0.14; door = { s, y0 }; ops.push({ pts: tudorPts(s, P.door.w, y0, y0 + P.door.spring, P.door.rise, 6), kind: 'door', doorKey: 'oakDoor', d: 0.32, label: true, labelDrop: 0.3 }); }
      else if (!b.lobby) grp(s, b.k, P.g);
    }
    wall(B, FQ(), footOutline(0, Lq, SR.corniceSt, (s) => quadSY(H.uW - s)), ops, 'quadStone');
    B.push(FQ());
    dressings(B, boxes);
    slopedBand(B, 'bathOld', 0, Lq, (s) => quadSY(H.uW - s) + 0.42, Math.min(quadSY(H.uW), quadSY(SR.uQd)) - FOOT, 0.08);
    for (const y of [P.s1, P.s2]) K.stringCourse(B, 'bathDress', 0, Lq, y, 0.16, 0.09);
    K.stringCourse(B, 'bathDress', 0, Lq, SR.cornice, 0.22, 0.16);
    pipe(B, sQ(QUAD_PIPE), quadSY(QUAD_PIPE), SR.cornice - 0.3, 0.14);
    if (door) {
      B.box('pavingSolid', door.s, door.y0 - 0.25, 0.2, P.door.w + 0.5, 0.5, 0.4, 0, {});
      B.box('bathDress', door.s, door.y0 + P.door.spring + P.door.rise + 0.12, 0.04, P.door.w + 0.3, 0.12, 0.08, 0, {});
      B.box('white', door.s + P.door.w / 2 + 0.35, door.y0 + 1.75, 0.02, 0.22, 0.28, 0.03, 0, {});      // the staircase's number plate (3)
    }
    B.pop();
    // the west range's quad face continued from v 20 to the corner (faces east; s runs north from the corner)
    const FW = () => frame(SR.uQd, 0, SR.vQ, 0, -1), Lw = SR.vQ - SR.vW;
    wall(B, FW(), footOutline(0, Lw, SR.corniceSt, () => quadSY(SR.uQd)), [], 'quadStone');
    B.push(FW());
    for (const y of [P.s1, P.s2]) K.stringCourse(B, 'bathDress', 0, Lw, y, 0.16, 0.09);
    K.stringCourse(B, 'bathDress', 0, Lw, SR.cornice, 0.22, 0.16);
    K.stringCourse(B, 'bathOld', 0, Lw, quadSY(SR.uQd) + 0.42, 0.42 + FOOT, 0.08);
    B.pop();
    K.parapet(B, 'quadStone', [[SR.uQd - t / 2, SR.vW], [SR.uQd - t / 2, SR.vQ + t / 2], [H.uW, SR.vQ + t / 2]], SR.corniceSt, SR.parapet - SR.corniceSt - 0.08, t, { coping: 'bathDress' });
  }
  buildLobby(ctx);
  buildStreetReturn(ctx);
  buildLaneFace(ctx);
  buildSRRoof(ctx);
}

/** a canted oriel in the CURRENT wall frame (z out of the wall), centred at s = sc; tiers [[y0, y1, nFront]] */
function cantedOriel(B, sc, O, tiers) {
  const hf = O.front / 2, p = O.proj;
  const ring = (k, e = 0) => [[sc - hf * k - p * k - e, 0], [sc - hf * k - e * 0.4, p * k + e], [sc + hf * k + e * 0.4, p * k + e], [sc + hf * k + p * k + e, 0]];
  const [c0, c1] = O.corbel, ch = (c1 - c0) / 3;
  [0.4, 0.68, 0.9].forEach((k, i) => K.prism(B, i === 1 ? 'bathOld' : 'bathDress', ring(k), c0 + ch * i, c0 + ch * (i + 1), { bottom: true }));
  K.prism(B, 'bathDress', ring(1, 0.05), O.panel[0] - 0.12, O.panel[0], { bottom: true });
  K.prism(B, 'bathDress', ring(1), O.panel[0], O.panel[1], {});
  const r = ring(1), facets = [[r[0], r[1]], [r[1], r[2]], [r[2], r[3]]].map(([a, b]) => ({ F: frame(a[0], 0, a[1], b[0] - a[0], b[1] - a[1]), L: Math.hypot(b[0] - a[0], b[1] - a[1]) }));
  const y0 = tiers[0][0], y1 = tiers[tiers.length - 1][1];
  for (const [i, f] of facets.entries()) {
    const ops = [];
    for (const [ta, tb, nF] of tiers) { const n = i === 1 ? nF : 1, lw = i === 1 ? Math.min(0.62, (f.L - 0.5 - (n - 1) * 0.18) / n) : Math.min(0.5, f.L - 0.4); ops.push(...lightGroup(f.L / 2, n, ta + 0.05, tb - 0.08, lw, 0.18, 'pointed', 0.14).ops); }
    wall(B, f.F, rectPts(0, y0, f.L, y1), ops, 'bath');
    B.push(f.F); B.box('bathDress', 0.06, (y0 + y1) / 2, 0.06, 0.14, y1 - y0, 0.14, 0, {}); B.box('bathDress', f.L - 0.06, (y0 + y1) / 2, 0.06, 0.14, y1 - y0, 0.14, 0, {}); B.pop();
  }
  const q1 = O.parapet[1];
  K.prism(B, 'bathDress', ring(1, 0.04), y1, y1 + 0.1, { bottom: true });
  K.prism(B, 'bathDress', ring(1), y1 + 0.1, q1, { top: true });
  K.prism(B, 'bathDress', ring(1, 0.06), q1, q1 + 0.1, { top: true, bottom: true });
}

// the Turl Street return (faces west; s runs south from v 20 to the lane corner)
function buildStreetReturn(ctx) {
  const { B } = ctx, P = STS, t = SR.parapetT;
  const a0 = [SR.uSt, SR.vW], a1 = LANE[0], du = a1[0] - a0[0], dv = a1[1] - a0[1], L = Math.hypot(du, dv);
  const F = () => frame(a0[0], 0, a0[1], du, dv), sT = (v) => ((v - a0[1]) * L) / dv;
  const ops = [], boxes = [], grp = (s, n, y, lw) => { const gr = lightGroup(s, n, y[0], y[1], lw, P.mullion, 'pointed', P.reveal); ops.push(...gr.ops); boxes.push(gr.box); };
  for (const b of STREET_BAYS) {
    const s = sT(b.v);
    if (b.k === 'oriel') { grp(s, 1, P.g, P.singleW); grp(s, 2, P.t, P.lightW); continue; }
    for (const y of [P.g, P.f, P.t]) grp(s, 1, y, P.singleW);
  }
  wall(B, F(), footOutline(0, L, SR.corniceSt, (s) => streetSY(a0[1] + (s / L) * dv)), ops, 'bath');
  B.push(F());
  dressings(B, boxes);
  const gb = Math.min(streetSY(a0[1]), streetSY(a1[1])) - FOOT;
  K.stringCourse(B, 'bathOld', 0, L, P.plinth, P.plinth - gb, 0.12);
  K.stringCourse(B, 'bathDress', 0, L, P.plinth + 0.12, 0.12, 0.18);
  const G = GABLE_T, ga = sT(G.v - G.w / 2), gbb = sT(G.v + G.w / 2), oW = ORIEL_T.front / 2 + ORIEL_T.proj + 0.15, so = sT(ORIEL_T.v);
  for (const y of [P.s1, P.s2]) {
    if (y > ORIEL_T.corbel[0] - 0.3 && y < ORIEL_T.parapet[1] + 0.1) { K.stringCourse(B, 'bathDress', 0, so - oW, y, 0.17, 0.1); K.stringCourse(B, 'bathDress', so + oW, L, y, 0.17, 0.1); }
    else K.stringCourse(B, 'bathDress', 0, L, y, 0.17, 0.1);
  }
  K.stringCourse(B, 'bathDress', 0, L + 0.1, SR.corniceSt, 0.26, 0.2);
  for (let s = 0.85; s < L - 0.3; s += GROTESQUE_PITCH) if (s < ga - 0.2 || s > gbb + 0.2) B.box('bathDress', s, SR.corniceSt - 0.12, 0.3, 0.26, 0.3, 0.34, 0, { bottom: true });
  cantedOriel(B, so, ORIEL_T, [[ORIEL_T.lights[0], ORIEL_T.lights[1], 2]]);
  B.pop();
  // the coped gable over the oriel, its 2-light window, a short roof running back into the range's roof
  const gw = lightGroup(sT(G.v), 2, G.win[0], G.win[1], 0.46, 0.16, 'pointed', 0.18);
  copedGable(B, F(), ga, gbb, SR.parapet - 0.05, G.apex, gw.ops, 'bath');
  B.push(F()); dressings(B, [gw.box]); B.pop();
  const uG = SR.uSt - 0.2 * 0;
  K.roof(B, 'slate', uG + 0.15, -21.6, G.v - G.w / 2 + 0.05, G.v + G.w / 2 - 0.05, SR.parapet - 0.05, G.apex - SR.parapet - 0.07, { axis: 'x', ends: ['open', 'hip'], ov: 0.02 });
  // parapet north and south of the gable
  const P0 = (v) => [a0[0] + ((v - a0[1]) / dv) * du + t / 2, v];
  for (const [p, q] of [[SR.vW, G.v - G.w / 2], [G.v + G.w / 2, a1[1] - t / 2]]) K.parapet(B, 'bath', [P0(p), P0(q)], SR.corniceSt, SR.parapet - SR.corniceSt - 0.08, t, { coping: 'bathDress' });
}

// the lane face of the south range (faces south; s runs east from the corner to the Hall's west gable)
function buildLaneFace(ctx) {
  const { B } = ctx, P = STS, t = SR.parapetT;
  const a0 = LANE[0], a1 = [SR_E, laneV(SR_E)], du = a1[0] - a0[0], dv = a1[1] - a0[1], L = Math.hypot(du, dv);
  const F = () => frame(a0[0], 0, a0[1], du, dv), sL = (u) => ((u - a0[0]) * L) / du, uOf = (s) => a0[0] + (s / L) * du;
  const ops = [], boxes = [], grp = (s, n, y) => { const gr = lightGroup(s, n, y[0], y[1], n === 1 ? P.singleW : P.lightW, P.mullion, 'pointed', P.reveal); ops.push(...gr.ops); boxes.push(gr.box); };
  for (const b of LANE_BAYS) for (const y of [P.g, P.f, P.t]) grp(sL(b.u), b.k, y);
  wall(B, F(), footOutline(0, L, SR.corniceSt, (s) => laneY(uOf(s)), 8), ops, 'bath');
  B.push(F());
  dressings(B, boxes);
  const gmin = Math.min(laneY(a0[0]), laneY(a1[0])) - FOOT;
  slopedBand(B, 'bathOld', 0, L, (s) => Math.max(P.plinth, laneY(uOf(s)) + 0.68), gmin, 0.12, 8);
  for (const y of [P.s1, P.s2]) K.stringCourse(B, 'bathDress', -0.1, L, y, 0.17, 0.1);
  K.stringCourse(B, 'bathDress', -0.1, L, SR.corniceSt, 0.26, 0.2);
  const G = GABLE_L, ga = sL(G.u - G.w / 2), gbb = sL(G.u + G.w / 2);
  for (let s = 0.85; s < L - 0.5; s += GROTESQUE_PITCH) if (s < ga - 0.2 || s > gbb + 0.2) B.box('bathDress', s, SR.corniceSt - 0.12, 0.3, 0.26, 0.3, 0.34, 0, { bottom: true });
  for (const u of LANE_PIPES) pipe(B, sL(u), laneY(u), SR.corniceSt - 0.3, 0.14);
  B.pop();
  const gw = lightGroup(sL(G.u), 2, G.win[0], G.win[1], 0.46, 0.16, 'pointed', 0.18);
  copedGable(B, F(), ga, gbb, SR.parapet - 0.05, G.apex, gw.ops, 'bath');
  B.push(F()); dressings(B, [gw.box]); B.pop();
  K.roof(B, 'slate', G.u - G.w / 2 + 0.05, G.u + G.w / 2 - 0.05, 27.8, laneV(G.u) - 0.15, SR.parapet - 0.05, G.apex - SR.parapet - 0.07, { axis: 'z', ends: ['hip', 'open'], ov: 0.02 });
  // parapet west and east of the gable (on the slanted line, set in by half its thickness)
  const P0 = (u) => [u, laneV(u) - t / 2];
  for (const [p, q] of [[a0[0] + t / 2, G.u - G.w / 2], [G.u + G.w / 2, SR_E]]) K.parapet(B, 'bath', [P0(p), P0(q)], SR.corniceSt, SR.parapet - SR.corniceSt - 0.08, t, { coping: 'bathDress' });
}

// the roofs: the west range's low N-S ridge carried south to meet the south range's E-W ridge, which runs from Turl
// Street (a low gable behind the oriel's) to the Hall; dormers; the clustered stack at the corner; the stack on the lane
function buildSRRoof(ctx) {
  const { B } = ctx, t = SR.parapetT, vR = SR.ridgeUv;
  K.roof(B, 'slate', SR.uSt + 0.2, SR.uQd - t, SR.vW, vR, SR.gutter, SR.ridgeV - SR.gutter, { axis: 'z', ends: ['open', 'gable'], ov: 0, wallKey: 'slate' });
  const v0 = SR.vQ + t, v1 = 29.8, rise = SR.ridgeU - SR.gutter, uW = SR.uSt + 0.2;
  // the E-W roof: two slopes to a ridge on vR (the range is not symmetric about it: the lane wall slants)
  B.poly('slate', [[uW, SR.gutter, v0], [H.uW, SR.gutter, v0], [H.uW, SR.ridgeU, vR], [uW, SR.ridgeU, vR]], [0, 1, -1]);
  B.poly('slate', [[uW, SR.ridgeU, vR], [H.uW, SR.ridgeU, vR], [H.uW, SR.gutter, v1], [uW, SR.gutter, v1]], [0, 1, 1]);
  B.poly('bath', [[uW, SR.gutter, v0], [uW, SR.gutter, v1], [uW, SR.ridgeU, vR]], [-1, 0, 0]);      // its low gable at Turl Street
  B.beam('lead', [uW, SR.ridgeU + 0.04, vR], [H.uW, SR.ridgeU + 0.04, vR], 0.14, 0.08);
  // lead gutters: from the slates' foot to the parapets (the lane and street faces are not square to the frame)
  B.flat('lead', [[SR.uSt + 0.05, SR.vW], [uW, SR.vW], [uW, LANE[0][1] - t], [LANE[0][0] + t, LANE[0][1] - t]], SR.gutter - 0.03);
  B.flat('lead', [[SR.uQd - t, SR.vW], [SR.uQd - t / 2, SR.vW], [SR.uQd - t / 2, v0], [SR.uQd - t, v0]], SR.gutter - 0.03);
  B.flat('lead', [[uW, v1 - 0.4], [SR_E, v1 - 0.4], [SR_E, laneV(SR_E) - t / 2], [uW, laneV(uW) - t / 2]], SR.gutter - 0.03);
  // dormers: flat lead tops to the ridge, slate-hung cheeks, white sashes (as the west range's)
  const D = DORMER, depth = Math.min(vR - v0 - 0.05, (D.sill + D.h + 0.15 - SR.gutter) / (rise / (vR - v0)) + 0.25);
  const o = { roof: 'flat', key: 'leadDark', roofKey: 'slate', flatKey: 'lead', glass: 'sash', lights: D.lights };
  for (const u of DORMERS_Q) K.dormer(B, frame(u, 0, v0 + 0.1, -1, 0), 0, D.sill, D.w, D.h, depth, o);
  const depthL = Math.min(v1 - vR - 0.05, (D.sill + D.h + 0.15 - SR.gutter) / (rise / (v1 - vR)) + 0.25);
  for (const u of DORMERS_L) K.dormer(B, frame(u, 0, v1 - 0.1, 1, 0), 0, D.sill, D.w, D.h, depthL, o);
  // the clustered stack at the corner: a square base, round flues with moulded caps
  { const S = STACK_C, wu = S.nu * S.pitch + 0.2, wv = S.nv * S.pitch + 0.2, yb = SR.gutter + 0.6;
    B.box('bath', S.u, (yb + S.base) / 2, S.v, wu, S.base - yb, wv, 0, {});
    B.box('bathDress', S.u, S.base + 0.08, S.v, wu + 0.14, 0.16, wv + 0.14, 0, { bottom: true });
    for (let i = 0; i < S.nu; i++) for (let j = 0; j < S.nv; j++) {
      const x = S.u + (i - (S.nu - 1) / 2) * S.pitch, z = S.v + (j - (S.nv - 1) / 2) * S.pitch;
      B.cyl('bath', x, S.base + 0.16, z, S.flueR, S.top - S.base - 0.36, 8, false);
      B.cyl('bathDress', x, S.top - 0.2, z, S.flueR + 0.06, 0.2, 8, true, S.flueR + 0.02);
    } }
  { const S = STACK_L, v = laneV(S.u); K.chimney(B, 'bath', S.u - S.wu / 2, S.u + S.wu / 2, v - S.wv + 0.15, v + 0.15, SR.cornice, S.top, { pots: 2, capKey: 'bathDress' }); }
}

// the servery lobby in the quad's south-west corner (single storey, flat, coped parapet)
function buildLobby(ctx) {
  const { B } = ctx, Lb = LOBBY, g = quadSY((Lb.u0 + Lb.u1) / 2), W = Lb.u1 - Lb.u0, Dp = SR.vQ - Lb.v0;
  const FN2 = () => frame(Lb.u1, 0, Lb.v0, -1, 0), s = (u) => Lb.u1 - u;
  const win = lightGroup(s(Lb.win.u), Lb.win.n, Lb.win.y[0], Lb.win.y[1], 0.42, 0.13, 'rect', 0.2, 'sash');
  const door = { pts: tudorPts(s(Lb.door.u), Lb.door.w, Lb.floor, Lb.floor + Lb.door.h - 0.25, 0.25, 6), kind: 'door', doorKey: 'oakDoor', d: 0.3, label: true, labelDrop: 0.25 };
  wall(B, FN2(), [[0, g - FOOT], [W, g - FOOT], [W, Lb.top - 0.5], [0, Lb.top - 0.5]], [...win.ops, door], 'quadStone');
  B.push(FN2());
  dressings(B, [win.box]);
  shield(B, s(Lb.panel.u), Lb.panel.y, 0.5);
  B.box('bathDress', s(Lb.panel.u), Lb.panel.y, 0.02, 0.75, 0.9, 0.04, 0, {});
  K.stringCourse(B, 'bathOld', 0, W, 0.75, 0.75 - (g - FOOT), 0.06);
  K.stringCourse(B, 'bathDress', 0, W, Lb.top - 0.5, 0.14, 0.1);
  B.pop();
  wall(B, frame(Lb.u1, 0, SR.vQ, 0, -1), [[0, g - FOOT], [Dp, g - FOOT], [Dp, Lb.top - 0.5], [0, Lb.top - 0.5]], [], 'quadStone');
  B.push(frame(Lb.u1, 0, SR.vQ, 0, -1)); K.stringCourse(B, 'bathDress', 0, Dp, Lb.top - 0.5, 0.14, 0.1); B.pop();
  const tt = 0.3;
  K.parapet(B, 'quadStone', [[Lb.u0, Lb.v0 + tt / 2], [Lb.u1 - tt / 2, Lb.v0 + tt / 2], [Lb.u1 - tt / 2, SR.vQ]], Lb.top - 0.5, 0.42, tt, { coping: 'bathDress' });
  B.flat('lead', [[Lb.u0, Lb.v0], [Lb.u1, Lb.v0], [Lb.u1, SR.vQ], [Lb.u0, SR.vQ]], Lb.top - 0.42);
  // the landing at the door, two steps down to the north and a gentle ramp running east along the front
  const du = s(Lb.door.u), uD = Lb.door.u, yL = Lb.floor, gw = quadSY(uD), vA = Lb.v0 - 1.0;
  B.box('pavingSolid', uD - 0.05, (yL + gw - 0.3) / 2, (Lb.v0 + vA) / 2, 1.5, yL - gw + 0.3, Lb.v0 - vA, 0, {});
  ctx.floor([[uD - 0.8, vA], [uD + 0.7, vA], [uD + 0.7, Lb.v0], [uD - 0.8, Lb.v0]], yL);
  const yS = (yL + gw) / 2;
  B.box('pavingSolid', uD - 0.05, (yS + gw - 0.3) / 2, vA - 0.15, 1.5, yS - gw + 0.3, 0.3, 0, {});
  ctx.floor([[uD - 0.8, vA - 0.3], [uD + 0.7, vA - 0.3], [uD + 0.7, vA], [uD - 0.8, vA]], yS);
  void du;
  const R = Lb.ramp, rv0 = Lb.v0 - R.w - 0.02, rv1 = Lb.v0 - 0.02, ua = uD + 0.7, ub = R.u0, ya = yL, yb2 = quadSY(R.u0) + 0.02;
  const rampY = (u) => ya + ((u - ua) / (ub - ua)) * (yb2 - ya);
  B.poly('pavingSolid', [[ua, ya, rv0], [ub, yb2, rv0], [ub, yb2, rv1], [ua, ya, rv1]], [0, 1, 0]);
  B.poly('quadStone', [[ua, gw - 0.1, rv0], [ub, yb2 - 0.1, rv0], [ub, yb2, rv0], [ua, ya, rv0]], [0, 0, -1]);
  B.beam('ironBlack', [ua, ya + 0.9, rv0 + 0.04], [ub, yb2 + 0.9, rv0 + 0.04], 0.04);
  for (const f of [0.02, 0.5, 0.98]) { const u = ua + (ub - ua) * f; B.box('ironBlack', u, rampY(u) + 0.45, rv0 + 0.04, 0.04, 0.9, 0.04, 0, {}); }
  ctx.floor([[ua, rv0], [ub, rv0], [ub, rv1], [ua, rv1]], (u) => rampY(u));
}

// ------------------------------------------------------------------------------------------------ COLLIDERS
export function registerSolids(ctx0) {
  const P = PORCH, ctx = hallCtx(ctx0), [P0, P1, P2, P3] = orielPts(), dl = P.doorU - P.door.w / 2, dr = P.doorU + P.door.w / 2;
  // the Hall's outer faces (hall coordinates) as lines: the doorway in the porch is open; the inside is the interior part's
  const line = (pts) => { for (let i = 0; i < pts.length - 1; i++) ctx.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); };
  // (the north face is open over the undercroft's stair, u UC_STAIR.u0 .. u1: the stair head's walls are its colliders; the
  //  oriel's front runs on into the north-east corner's mass: neCornerPts)
  const U = UC_STAIR, NE = neCornerPts();
  line([[P.u1, H.vN], [U.u0, H.vN]]);
  line([[U.u1, H.vN], [P0[0], H.vN], P1, P2, NE[1], NE[2], [H.uE, H.vN], [H.uE, H.vS], [H.uW, H.vS], [H.uW, H.vN], [P.u0, H.vN]]);
  line([[P.u0, H.vN], [P.u0, P.vF], [dl, P.vF]]); line([[dr, P.vF], [P.u1, P.vF], [P.u1, H.vN]]);
  for (const u of BUTTRESS_N) ctx.solid([[u - BUTTRESS.w / 2, H.vN - BUTTRESS.stages[0][1]], [u + BUTTRESS.w / 2, H.vN - BUTTRESS.stages[0][1]], [u + BUTTRESS.w / 2, H.vN], [u - BUTTRESS.w / 2, H.vN]]);
  for (const u of [P.u1 - P.buttress.w / 2, P.u0 + P.buttress.w / 2]) ctx.solid([[u - P.buttress.w / 2, P.vF - P.buttress.stages[0][1]], [u + P.buttress.w / 2, P.vF - P.buttress.stages[0][1]], [u + P.buttress.w / 2, P.vF], [u - P.buttress.w / 2, P.vF]]);
  // the south range and the lobby (LOCAL)
  ctx0.solid([[SR.uSt, SR.vW], [SR.uQd, SR.vW], [SR.uQd, SR.vQ], [SR_E, SR.vQ], [SR_E, laneV(SR_E)], [LANE[0][0], LANE[0][1]]]);
  ctx0.solid([[LOBBY.u0, LOBBY.v0], [LOBBY.u1, LOBBY.v0], [LOBBY.u1, SR.vQ], [LOBBY.u0, SR.vQ]]);
}
