// Somerville College, STANDALONE model, part 'roq' (B11): the build functions. Called by somerville_roq.js with ctx.B
// already in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from
// _somerville_roq_plan.js (sources and K / G there). Inside a block's own frame (FW / FE) the Batch's x = s (east along
// the north wall), z = t (south, into the building); the north faces look to -t. Helpers written here (not in the kit):
// vq (a vertical quad between two plan points), pane (a painted glass / door unit between two plan points), wedge (a
// tilted PV array), clipLine (a straight line clipped to a ring, for the lattice of the paving).
import * as P from './_somerville_roq_plan.js';

const { BAY, TOWER, PLINTH, RECESS, WALL_T, SLOT, ROOF, GATE } = P;
const TP = TOWER.proj;

// ------------------------------------------------------------------------------------------------ helpers
/** a vertical quad between plan points a = [x, z] and b in the CURRENT frame from y0 to y1, facing n = [x, z] */
function vq(B, key, a, b, y0, y1, n) { B.poly(key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [n[0], 0, n[1]]); }
/** a painted unit (glass, door) between plan points a and b in the CURRENT frame, y0..y1, facing `out` ([x, z]) */
function pane(K, B, key, a, b, y0, y1, out) {
  let p = a, q = b; const dx0 = b[0] - a[0], dz0 = b[1] - a[1];
  if (-dz0 * out[0] + dx0 * out[1] < 0) { p = b; q = a; }
  const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
  B.push(K.frame(p[0], 0, p[1], dx, dz)); B.unit(key, K.rectPts(0, y0, L, y1), 0, K.nextBay(y0)); B.pop();
}
/** a framed window on a flat face at t = tf facing nt (+1 / -1 in t), centred at s, w wide, y0..y1 */
function faceWin(K, B, s, tf, nt, w, y0, y1) {
  B.poly('roqOak', [[s - w / 2 - 0.07, y0 - 0.07, tf + nt * 0.012], [s + w / 2 + 0.07, y0 - 0.07, tf + nt * 0.012], [s + w / 2 + 0.07, y1 + 0.07, tf + nt * 0.012], [s - w / 2 - 0.07, y1 + 0.07, tf + nt * 0.012]], [0, 0, nt]);
  pane(K, B, 'glassDark', [s - w / 2, tf + nt * 0.024], [s + w / 2, tf + nt * 0.024], y0, y1, [0, nt]);
}
/** a PV array: s0..s1 along, from tLow (its foot, yLow) up to tHigh (yHigh), with its back and ends closed to the roof yR */
function wedge(B, key, s0, s1, tHigh, tLow, yHigh, yLow, yR) {
  B.poly(key, [[s0, yLow, tLow], [s1, yLow, tLow], [s1, yHigh, tHigh], [s0, yHigh, tHigh]], [0, 1, tLow > tHigh ? 1 : -1]);
  vq(B, 'zinc', [s0, tHigh], [s1, tHigh], yR, yHigh, [0, tHigh < tLow ? -1 : 1]);
  for (const [s, n] of [[s0, -1], [s1, 1]]) B.poly('zinc', [[s, yR, tHigh], [s, yR, tLow], [s, yLow, tLow], [s, yHigh, tHigh]], [n, 0, 0]);
}
/** the parts of the infinite line p + k d inside a ring (LOCAL or any 2D): [[a, b], ...] */
function clipLine(p, d, ring) {
  const ks = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ex = b[0] - a[0], ez = b[1] - a[1], den = d[0] * ez - d[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const wx = a[0] - p[0], wz = a[1] - p[1], k = (wx * ez - wz * ex) / den, m = (wx * d[1] - wz * d[0]) / den;
    if (m >= 0 && m < 1) ks.push(k);
  }
  ks.sort((x, y) => x - y);
  const out = [], inR = (x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  for (let i = 0; i + 1 < ks.length; i++) { const km = (ks[i] + ks[i + 1]) / 2; if (ks[i + 1] - ks[i] > 0.05 && inR(p[0] + d[0] * km, p[1] + d[1] * km)) out.push([[p[0] + d[0] * ks[i], p[1] + d[1] * ks[i]], [p[0] + d[0] * ks[i + 1], p[1] + d[1] * ks[i + 1]]]); }
  return out;
}

// ------------------------------------------------------------------------------------------------ a block
const faceT = (k) => (k === 'tower' ? -TP : k === 'strip' || k === 'recess' ? RECESS : 0);

/** one block (ROQ West or ROQ East) in its own frame F. Returns { ring (frame), lamps (frame) } */
function buildBlock(ctx, F, C, west) {
  const { B, K } = ctx;
  const L = C.L, fl = C.floors, pt = fl[0] - PLINTH.below, par = C.parapet, roof = C.roof, shaft = par + TOWER.above, top = C.towerTop;
  const step = C.D2 !== undefined;
  const Dat = (s) => (step && s >= C.sStep ? C.D2 : C.D);
  const segs = C.segs, tW = segs[0], tE = segs[segs.length - 1];
  const lamps = [], floors = [];
  B.push(F.M);

  // --- the outer ring (for the plinth and the collider)
  const ring = [];
  for (const g of segs) { const f = faceT(g.k); ring.push([g.s0, f], [g.s1, f]); }
  ring.push([L, Dat(L)]);
  if (step) ring.push([C.sStep, C.D2], [C.sStep, C.D]);
  ring.push([0, C.D]);
  const R = ring.filter((p, i) => { const q = ring[(i + ring.length - 1) % ring.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });

  // --- the plinth: pale concrete, its top 0.15 under the ground floor at the wall, battered out and down into the ground
  const foot = (s, t, n) => { const g = F.groundY(s, t), b = Math.max(0.05, Math.min(PLINTH.maxOut, PLINTH.batter * (pt - g))); return [s + n[0] * b, t + n[1] * b, Math.min(g, F.groundY(s + n[0] * b, t + n[1] * b)) - PLINTH.sink]; };
  const feet = [];
  for (let i = 0; i < R.length; i++) {
    const a = R[i], b = R[(i + 1) % R.length], ds = b[0] - a[0], dt = b[1] - a[1], len = Math.hypot(ds, dt), n = [dt / len, -ds / len];
    const m = Math.max(1, Math.ceil(len / 2));
    let prev = null;
    for (let k = 0; k <= m; k++) {
      const s = a[0] + (ds * k) / m, t = a[1] + (dt * k) / m, f = foot(s, t, n);
      if (prev) B.poly('precast', [[prev[0], pt, prev[1]], [s, pt, t], [f[0], f[2], f[1]], [prev[2][0], prev[2][2], prev[2][1]]], [n[0], 0.3, n[1]]);
      if (k === 0) feet.push({ start: f }); if (k === m) feet[feet.length - 1].end = f;
      prev = [s, t, f];
    }
  }
  for (let i = 0; i < R.length; i++) {      // convex corners: close the gap between the two batters
    const p = R[i], a = R[(i + R.length - 1) % R.length], b = R[(i + 1) % R.length];
    const d1 = [p[0] - a[0], p[1] - a[1]], d2 = [b[0] - p[0], b[1] - p[1]];
    if (d1[0] * d2[1] - d1[1] * d2[0] <= 0) continue;
    const fa = feet[(i + R.length - 1) % R.length].end, fb = feet[i].start;
    B.poly('precast', [[p[0], pt, p[1]], [fa[0], fa[2], fa[1]], [fb[0], fb[2], fb[1]]], [(fa[0] + fb[0]) / 2 - p[0], 0.3, (fa[1] + fb[1]) / 2 - p[1]]);
  }

  // --- the north face, segment by segment
  let bayIx = 0;
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i], f = faceT(g.k);
    if (g.k !== 'tower') {
      vq(B, g.k === 'bays' ? 'brickNew' : 'precast', [g.s1, f], [g.s0, f], pt, par, [0, -1]);
      B.box('precast', (g.s0 + g.s1) / 2, par + 0.03, (f - 0.04 + RECESS + WALL_T + 0.04) / 2, g.s1 - g.s0, 0.06, RECESS + WALL_T + 0.08 - f, 0, { bottom: true });   // coping
      if (g.k === 'recess') for (const y of fl) faceWin(K, B, (g.s0 + g.s1) / 2, f, -1, SLOT.w, y + SLOT.y0, y + SLOT.y1);
      // returns to the neighbours that stand forward or back
      for (const [nb, sB, side] of [[segs[i - 1], g.s0, -1], [segs[i + 1], g.s1, 1]]) {
        if (!nb || nb.k === 'tower') continue;
        const fn = faceT(nb.k); if (fn >= f) continue;       // only the face that stands forward draws its side
        vq(B, 'brickNew', [sB, fn], [sB, f], pt, par, [side, 0]);
      }
    }
    if (g.k === 'bays') {
      const c0 = (g.c ?? (g.s0 + g.s1) / 2) - ((g.n - 1) / 2) * C.pitch;
      for (let j = 0; j < g.n; j++) { for (const y of fl) bay(K, B, c0 + j * C.pitch, y, (bayIx + j) % 2); }
      bayIx += g.n;
    }
  }
  // the tower's sides that stand forward of the neighbouring white joints
  for (const [tw, sB, side] of [[tW, tW.s1, 1], [tE, tE.s0, -1]]) vq(B, 'brickNew', [sB, -TP], [sB, Dat(sB)], pt, shaft, [side, 0]);

  // --- the south (corridor) face: white render; the step on ROQ East
  const sa = tW.s1, sb = tE.s0;
  if (!step) vq(B, 'precast', [sa, C.D], [sb, C.D], pt, par, [0, 1]);
  else {
    vq(B, 'precast', [sa, C.D], [C.sStep, C.D], pt, par, [0, 1]);
    vq(B, 'precast', [C.sStep, C.D2], [sb, C.D2], pt, par, [0, 1]);
    vq(B, 'precast', [C.sStep, C.D], [C.sStep, C.D2], pt, par, [-1, 0]);
  }
  for (const w of C.southWin || []) faceWin(K, B, w.s, Dat(w.s), 1, w.w, w.y0, w.y1);

  // --- the roof: parapets' inner faces, copings, the membrane, PV, rooflights
  const tN = RECESS + WALL_T;
  const roofs = step ? [[sa, C.sStep + WALL_T, C.D], [C.sStep + WALL_T, sb, C.D2]] : [[sa, sb, C.D]];
  for (const [r0, r1, D] of roofs) {
    B.poly('precast', [[r0, roof, tN], [r1, roof, tN], [r1, roof, D - WALL_T], [r0, roof, D - WALL_T]], [0, 1, 0]);
    vq(B, 'brickNew', [r0, tN], [r1, tN], roof, par, [0, 1]);
    vq(B, 'precast', [r0, D - WALL_T], [r1, D - WALL_T], roof, par, [0, -1]);
    B.box('precast', (r0 + r1) / 2, par + 0.03, D - WALL_T / 2, r1 - r0, 0.06, WALL_T + 0.08, 0, { bottom: true });
  }
  if (step) {
    vq(B, 'precast', [C.sStep + WALL_T, C.D - WALL_T], [C.sStep + WALL_T, C.D2 - WALL_T], roof, par, [1, 0]);
    B.box('precast', C.sStep + WALL_T / 2, par + 0.03, (C.D + C.D2) / 2 - WALL_T / 2, WALL_T + 0.08, 0.06, C.D2 - C.D + 0.08, 0, { bottom: true });
  }
  for (const g of segs) if (g.k === 'bays') wedge(B, 'leadDark', g.s0 + 0.4, g.s1 - 0.4, tN + ROOF.pv.t0 - 0.3, tN + ROOF.pv.t1, par - 0.02, roof + 0.25, roof);
  for (const [r0, r1, D] of roofs) {
    const a = r0 + 2.2, b = r1 - 2.2; if (b - a < 2) continue;
    const t0 = D - WALL_T - ROOF.light.t0, t1 = D - WALL_T - ROOF.light.t1, yh = roof + ROOF.light.h;
    B.box('zinc', (a + b) / 2, roof + (yh - roof) / 2, (t0 + t1) / 2, b - a, yh - roof, t1 - t0, 0, { top: false });
    B.poly('glassRoof', [[a, yh, t0], [b, yh, t0], [b, yh + 0.12, (t0 + t1) / 2], [a, yh + 0.12, (t0 + t1) / 2]], [0, 1, -1]);
    B.poly('glassRoof', [[a, yh + 0.12, (t0 + t1) / 2], [b, yh + 0.12, (t0 + t1) / 2], [b, yh, t1], [a, yh, t1]], [0, 1, 1]);
  }

  // --- the stair towers
  for (const tw of [tW, tE]) {
    const isW = tw === tW, endS = isW ? tw.s0 : tw.s1, inS = isW ? tw.s1 : tw.s0, out = isW ? -1 : 1, D = Dat(endS);
    vq(B, 'brickNew', [tw.s1, -TP], [tw.s0, -TP], pt, shaft, [0, -1]);
    vq(B, 'brickNew', [tw.s0, D], [tw.s1, D], pt, shaft, [0, 1]);
    B.poly('leadDark', [[tw.s0, shaft, -TP], [tw.s1, shaft, -TP], [tw.s1, shaft, D], [tw.s0, shaft, D]], [0, 1, 0]);
    if (west) for (const k of TOWER.southWin.floors) faceWin(K, B, (tw.s0 + tw.s1) / 2, D, 1, TOWER.southWin.w, fl[k] + 1.0, fl[k] + 1.0 + TOWER.southWin.h);
    // the END face: brick below and beside the oak fin screen; the screen's glazing in storey bands up into the lantern
    const sc = TOWER.screen, y0 = fl[0] + sc.y0, tS = -TP + sc.d, capY = top - 0.2;
    vq(B, 'brickNew', [endS, -TP], [endS, D], pt, y0, [out, 0]);
    vq(B, 'brickNew', [endS, tS], [endS, D], y0, shaft, [out, 0]);
    const bands = [y0, ...fl.filter((y) => y > y0 + 0.5), shaft, capY];
    for (let i = 0; i + 1 < bands.length; i++) pane(K, B, 'glassDark', [endS, -TP], [endS, tS], bands[i], bands[i + 1], [out, 0]);
    const nf = Math.round(sc.d / sc.pitch), fx = endS + out * sc.fin[1] / 2;
    for (let i = 0; i < nf + 1; i++) B.box('roqOak', fx, (y0 + capY) / 2, -TP + (i * sc.d) / nf + (i === 0 ? sc.fin[0] / 2 : i === nf ? -sc.fin[0] / 2 : 0), sc.fin[1], capY - y0, sc.fin[0], 0, { bottom: true });
    for (const y of bands) B.box('roqOak', fx, y, -TP + sc.d / 2, sc.fin[1], sc.rail, sc.d, 0, { bottom: true });
    // the lantern on the shaft (its end face is the screen's top)
    const si = inS + out * TOWER.lantern.inset, ls0 = isW ? endS : si, ls1 = isW ? si : endS;
    for (const [a, b, n] of [[[ls1, -TP], [ls0, -TP], [0, -1]], [[si, -TP], [si, tS], [-out, 0]], [[ls0, tS], [ls1, tS], [0, 1]]]) {
      pane(K, B, 'glassDark', a, b, shaft, capY, n);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(2, Math.round(len / sc.pitch));
      for (let i = 0; i <= m; i++) { const f = i / m, x = a[0] + (b[0] - a[0]) * f + n[0] * 0.08, z = a[1] + (b[1] - a[1]) * f + n[1] * 0.08; B.box('roqOak', x, (shaft + capY) / 2, z, n[0] ? 0.2 : 0.11, capY - shaft, n[0] ? 0.11 : 0.2, 0, { bottom: true }); }
    }
    B.box('zinc', (ls0 + ls1) / 2 + out * 0.02, capY + 0.1, (-TP + tS) / 2, ls1 - ls0 + 0.12, 0.2, sc.d + 0.12, 0, { bottom: true });
    // the gate tower's entrance: a glazed door, the precast canopy, a precast bench
    if (C.gateEnd === (isW ? 'west' : 'east')) {
      const d = TOWER.door, t0 = D - d.t0, t1 = D - d.t1, cy = fl[0] + TOWER.canopy.y, ct = (t0 + t1) / 2;
      B.poly('roqOak', [[endS + out * 0.012, fl[0] - 0.02, t0 - 0.08], [endS + out * 0.012, fl[0] - 0.02, t1 + 0.08], [endS + out * 0.012, fl[0] + d.h + 0.08, t1 + 0.08], [endS + out * 0.012, fl[0] + d.h + 0.08, t0 - 0.08]], [out, 0, 0]);
      pane(K, B, 'glassDark', [endS + out * 0.024, t0], [endS + out * 0.024, t1], fl[0], fl[0] + d.h, [out, 0]);
      B.box('precast', endS + out * TOWER.canopy.d / 2, cy + TOWER.canopy.h / 2, Math.min(ct, D - TOWER.canopy.w / 2), TOWER.canopy.d, TOWER.canopy.h, TOWER.canopy.w, 0, { bottom: true });
      const bt = t0 - 0.5 - TOWER.bench.len / 2, gB = F.groundY(endS + out * 0.4, bt);
      B.box('precast', endS + out * (TOWER.bench.d / 2 + 0.02), gB + TOWER.bench.h / 2 - 0.05, bt, TOWER.bench.d, TOWER.bench.h + 0.1, TOWER.bench.len, 0, {});
      // the floor at the door: a precast threshold step from the square up to the ground floor
      const gD = F.groundY(endS + out * 0.6, ct);
      if (fl[0] - gD > 0.03) {
        B.box('pavingSolid', endS + out * 0.6, (fl[0] + gD - 0.2) / 2, ct, 1.2, fl[0] - gD + 0.2, t1 - t0 + 0.4, 0, {});
        floors.push([F.ring([[endS, t0 - 0.2], [endS + out * 1.2, t0 - 0.2], [endS + out * 1.2, t1 + 0.2], [endS, t1 + 0.2]]), fl[0]]);
      }
      lamps.push([endS + out * (TOWER.canopy.d - 0.3), cy - 0.05, ct]);
    }
  }

  B.pop();
  return { ring: R, lamps, floors, step, Dat };
}

/** one oak window box centred at s = c on the floor at y (side: which way its window goes) */
function bay(K, B, c, y, side) {
  const w = BAY.w, fw = BAY.front, P = BAY.proj, y0 = y - BAY.below, y1 = y0 + BAY.h;
  const x0b = c - w / 2, x1b = c + w / 2, x0f = c - fw / 2, x1f = c + fw / 2;
  const W = BAY.win, x0 = side ? fw - W.inset - W.w : W.inset;     // in the front's wall frame (x from the box's east edge westwards)
  K.wall(B, K.frame(x1f, 0, -P, -1, 0), K.rectPts(0, y0, fw, y1), [{ pts: K.rectPts(x0, y0 + W.sill, x0 + W.w, y0 + W.head), kind: 'win', glass: 'glassDark', d: 0.1, sill: false, revealKey: 'roqOak' }], 'roqOak');
  const sw = x1f - x0 - W.w / 2;                                    // the window's centre (s)
  B.box('roqOak', sw, y0 + W.sill - 0.04, -P - 0.05, W.w + 0.14, 0.08, 0.12, 0, { bottom: true });    // the sill board
  // the splayed cheeks; the narrow light in the cheek on the window's side
  vq(B, 'roqOak', [x0b, 0], [x0f, -P], y0, y1, [-P, -(w - fw) / 2]);
  vq(B, 'roqOak', [x1f, -P], [x1b, 0], y0, y1, [P, -(w - fw) / 2]);
  const L = BAY.light, chk = side ? [[x0b, 0], [x0f, -P], -1] : [[x1b, 0], [x1f, -P], 1];
  const [a, b, sg] = chk, nx = sg * P, nz = -(w - fw) / 2, nl = Math.hypot(nx, nz), off = [(nx / nl) * 0.015, (nz / nl) * 0.015];
  const f0 = 0.5 - L.w / 2 / Math.hypot(b[0] - a[0], b[1] - a[1]), f1 = 1 - f0;
  pane(K, B, 'glassDark', [a[0] + (b[0] - a[0]) * f0 + off[0], a[1] + (b[1] - a[1]) * f0 + off[1]], [a[0] + (b[0] - a[0]) * f1 + off[0], a[1] + (b[1] - a[1]) * f1 + off[1]], y0 + L.y0, y0 + L.y1, [nx, nz]);
  // the lead-capped top and the boarded soffit
  B.poly('leadDark', [[x0b, y1, 0], [x1b, y1, 0], [x1f + 0.03, y1, -P - 0.04], [x0f - 0.03, y1, -P - 0.04]], [0, 1, 0]);
  B.poly('leadDark', [[x0f - 0.03, y1 - 0.06, -P - 0.04], [x1f + 0.03, y1 - 0.06, -P - 0.04], [x1f + 0.03, y1, -P - 0.04], [x0f - 0.03, y1, -P - 0.04]], [0, 0, -1]);
  B.poly('roqOak', [[x0b, y0, 0], [x1b, y0, 0], [x1f, y0, -P], [x0f, y0, -P]], [0, -1, 0]);
}

// ------------------------------------------------------------------------------------------------ the whole part
export function buildRoq(ctx) {
  const { B, K, S, G } = ctx;
  const FW = P.FW, FE = P.FE;
  // the ROQ's oak: a honey-gold tint of the boards cell (the kit's 'timberOak' is a dark weathered oak, too brown for
  // these boxes and fins in every photograph). K: photos folder 12
  K.addCell(ctx.pack, 'roqOak', 'boards', 0xf0b45f);
  const W = buildBlock(ctx, FW, P.WEST, true);
  const E = buildBlock(ctx, FE, P.EAST, false);
  // colliders: each block's outline taken out to the bay fronts
  for (const [F, C, r] of [[FW, P.WEST, W], [FE, P.EAST, E]]) {
    const ring = [[0, -TP], [C.L, -TP], [C.L, r.Dat(C.L)]];
    if (r.step) ring.push([C.sStep, C.D2], [C.sStep, C.D]);
    ring.push([0, C.D]);
    ctx.solid(F.ring(ring));
  }
  for (const [F, r] of [[FW, W], [FE, E]]) for (const l of r.lamps) { const q = F.L(l[0], l[2]); ctx.lamp(q[0], l[1], q[1]); }

  // --- the gate between the towers' north corners: painted steel bars; the two leaves hinged at the towers' corners and
  // drawn OPEN INWARDS, each standing against its tower's gate face (touch-up 1: they swung out into Loverose Way)
  const gW = FW.L(P.WEST.L, -TP), gE = FE.L(0, -TP), GF = S.ownFrame(gW[0], gW[1], gE[0], gE[1]), Lg = GF.len;
  B.push(GF.M);
  const run = (a, b) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / GATE.pitch));
    const ya = GF.groundY(a[0], a[1]) + 0.06, yb = GF.groundY(b[0], b[1]) + 0.06;
    for (let i = 0; i < n; i++) { const f = (i + 0.5) / n, y = ya + (yb - ya) * f; B.box('ironBlack', a[0] + (b[0] - a[0]) * f, y + GATE.h / 2, a[1] + (b[1] - a[1]) * f, GATE.bar, GATE.h, GATE.bar, 0, { top: false }); }
    for (const dy of [0.08, GATE.h - 0.1]) B.beam('ironBlack', [a[0], ya + dy, a[1]], [b[0], yb + dy, b[1]], 0.05, 0.07);
    for (const [p, y] of [[a, ya], [b, yb]]) B.box('ironBlack', p[0], y - 0.3 + (GATE.h + 0.42) / 2, p[1], 0.11, GATE.h + 0.42, 0.11, 0, {});
  };
  // each tower's gate face as a direction in the gate's frame (into the square), and the leaf GATE.off off it
  const along = (Fr, s0) => { const a = GF.P(...Fr.L(s0, -TP)), b = GF.P(...Fr.L(s0, -TP + 1)); return [b[0] - a[0], b[1] - a[1]]; };
  const dW = along(FW, P.WEST.L), dE = along(FE, 0), [wW, wE] = GATE.leaves;
  const legs = [
    [[0, 0], [wW * dW[0] + GATE.off, wW * dW[1]], [GATE.off, 0]],                 // the fire-engine leaf at the west tower
    [[Lg, 0], [Lg + wE * dE[0] - GATE.off, wE * dE[1]], [Lg - GATE.off, 0]],      // the wicket at the east tower
  ];
  for (const [, tip, hinge] of legs) run(hinge, tip);
  run([wW, 0], [Lg - wE, 0]);                                                     // the fixed run between the openings
  B.pop();
  for (const [a, b] of [...legs.map((l) => [l[2], l[1]]), [[wW, 0], [Lg - wE, 0]]]) { const p = GF.L(a[0], a[1]), q = GF.L(b[0], b[1]); ctx.seg(p[0], p[1], q[0], q[1]); }

  // --- the paved square inside the gate (its diagonal lattice), the tarmac on to the Quad's path
  const houseAt = (v) => { const t = (v - P.HOUSE_NW[1]) / P.HOUSE_DIR[0]; return [P.HOUSE_NW[0] - P.HOUSE_DIR[1] * t, v]; };
  const libAt = (v) => { const [a, b] = P.LIB_EAST; return [a[0] + ((v - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), v]; };
  const hL = (s, t) => [P.HOUSE_NW[0] + s * P.HOUSE_DIR[0] - t * P.HOUSE_DIR[1], P.HOUSE_NW[1] + s * P.HOUSE_DIR[1] + t * P.HOUSE_DIR[0]], HB = P.HOUSE_BAY;
  const bayEdge = [hL(0, HB.t0), hL(HB.s0, HB.t0), hL(HB.s0, HB.t1), hL(0, HB.t1)];      // round the House's brick bay (touch-up 1)
  const sq = [gW, gE, FE.L(0, P.EAST.D), ...bayEdge, houseAt(P.SQUARE_S), libAt(P.SQUARE_S), P.LIB_EAST[0], FW.L(P.WEST.L - 2.0, P.WEST.D), FW.L(P.WEST.L, P.WEST.D)];
  G.drape(B, 'paving', sq, 0.08);
  ctx.floor(sq, (u, v) => S.groundY(u, v) + 0.08);
  const sqG = sq.map((p) => GF.P(p[0], p[1])), cG = sqG.reduce((a, p) => [a[0] + p[0] / sqG.length, a[1] + p[1] / sqG.length], [0, 0]);
  for (const d of [[Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2]]) {
    const n = [-d[1], d[0]];
    for (let k = -14; k <= 14; k++) {
      const o = [cG[0] + n[0] * k * P.LATTICE.pitch, cG[1] + n[1] * k * P.LATTICE.pitch];
      for (const [a, b] of clipLine(o, d, sqG)) G.strip(B, 'setts', [GF.L(a[0], a[1]), GF.L(b[0], b[1])], P.LATTICE.w, 0.1);
    }
  }
  for (const r of [W, E]) for (const [ring, y] of r.floors) ctx.floor(ring, y);
  const drive = [libAt(P.SQUARE_S), houseAt(P.SQUARE_S), houseAt(P.DRIVE_S), [P.PLANTER_NE[0] + 0.2, P.DRIVE_S], [P.PLANTER_NE[0], P.PLANTER_NE[1]], P.LIB_EAST[1]];
  G.drape(B, 'asphalt', drive, 0.07);
  ctx.floor(drive, (u, v) => S.groundY(u, v) + 0.07);

  // --- west of ROQ West: the raised shrub bed, the rubble wall at Holtby's foot, the passage and its timber gate
  const Bd = P.BED, bed = [Bd.kerb[0], Bd.kerb[1], Bd.back[1], Bd.back[0]];
  G.drape(B, 'flowerbed', bed, Bd.rise);
  G.edgeDown(B, 'precast', bed, Bd.rise, Bd.rise + 0.25);
  ctx.solid(bed);
  {
    const [a, b] = Bd.back, ga = S.groundY(a[0], a[1]), gb = S.groundY(b[0], b[1]), y0 = Math.min(ga, gb) - 0.3;
    K.parapet(B, 'rubble', Bd.back, y0, Math.max(ga, gb) + Bd.wallH - y0, Bd.wallT, { coping: 'bathOld' });
    ctx.seg(a[0], a[1], b[0], b[1]);
  }
  let sh = 1;
  for (const f of [0.15, 0.38, 0.6, 0.82]) {
    const u = Bd.kerb[0][0] + (Bd.kerb[1][0] - Bd.kerb[0][0]) * f, v = (Bd.kerb[0][1] + Bd.back[0][1]) / 2 + ((Bd.kerb[1][1] + Bd.back[1][1]) / 2 - (Bd.kerb[0][1] + Bd.back[0][1]) / 2) * f;
    K.tree(B, u, v, S.groundY(u, v) + Bd.rise, 2.0 + 0.3 * (sh % 2), 1.2, 40 + sh++);
  }
  const passage = [Bd.kerb[1], FW.L(0, 0.34), FW.L(0, P.WEST.D), Bd.back[1]];
  G.drape(B, 'paving', passage, 0.08);
  ctx.floor(passage, (u, v) => S.groundY(u, v) + 0.08);
  {
    const a = Bd.kerb[1], b = [a[0] + 1.35, a[1] + 0.02], g = Math.min(S.groundY(a[0], a[1]), S.groundY(b[0], b[1]));
    K.parapet(B, 'timberGrey', [a, b], g - 0.05, P.PASSAGE_GATE.h + 0.05, 0.05, {});
    ctx.seg(a[0], a[1], b[0], b[1]);
  }
  return null;
}
