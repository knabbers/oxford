// Somerville College, STANDALONE model: THE HALL, ITS KITCHENS, THE LOGGIA LINK AND MAITLAND's build functions (Edmund
// Fisher, 1910 - 13). Called by somerville_hall.js with ctx.B in the college's LOCAL frame. Every figure is a named
// constant in _somerville_hall_plan.js (with its source and K / G mark). The work is done inside the part's own frame
// (P.F: s SOUTH along the west fronts, y up, t WEST towards the Quad); P.F.ring / P.F.L convert to LOCAL for colliders,
// floors, lamps and the draped ground.
// Helpers the kit does not have (written here, not in the kit): an inset ring (offsetRing) for parapets that stand
// inside a wall line, stone quoins, a modillion cornice, a triangular pediment on a window, a balustrade, a wall
// lantern on a bracket that reports its light in LOCAL coordinates.
import * as P from './_somerville_hall_plan.js';

let K = null, B = null, ctx = null, S = null;

// ------------------------------------------------------------------------------------------------ frames (inside P.F: x = s, z = t)
const WF = (t) => K.frame(0, 0, t, 1, 0);      // a face looking WEST (to the Quad) at t: x = s
const EF = (t) => K.frame(0, 0, t, -1, 0);     // looking EAST at t: x = -s
const NF = (s) => K.frame(s, 0, 0, 0, 1);      // looking NORTH at s: x = t
const SF = (s) => K.frame(s, 0, 0, 0, -1);     // looking SOUTH at s: x = -t
const R = (s0, s1, t0, t1) => [[s0, t0], [s1, t0], [s1, t1], [s0, t1]];
const rect = (x0, y0, x1, y1) => K.rectPts(Math.min(x0, x1), y0, Math.max(x0, x1), y1);
/** the lowest surveyed ground under a box of the frame, less a margin: where a wall's foot goes */
function footAt(s0, s1, t0, t1, m = 0.55) {
  let lo = Infinity;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 3; j++) lo = Math.min(lo, P.F.groundY(s0 + ((s1 - s0) * i) / 8, t0 + ((t1 - t0) * j) / 3));
  return lo - m;
}
const inR = (a, b, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const p = ring[i], q = ring[j]; if ((p[1] > b) !== (q[1] > b) && a < ((q[0] - p[0]) * (b - p[1])) / (q[1] - p[1]) + p[0]) c = !c; } return c; };
/** a ring moved INWARDS by d (mitred corners) */
function offsetRing(ring, d) {
  const n = ring.length, lines = [];
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let nx = -(q[1] - p[1]) / L, nz = (q[0] - p[0]) / L;
    const m = [(p[0] + q[0]) / 2 + nx * 0.05, (p[1] + q[1]) / 2 + nz * 0.05];
    if (!inR(m[0], m[1], ring)) { nx = -nx; nz = -nz; }
    lines.push({ p: [p[0] + nx * d, p[1] + nz * d], d: [(q[0] - p[0]) / L, (q[1] - p[1]) / L] });
  }
  return ring.map((_, i) => {
    const a = lines[(i + n - 1) % n], b = lines[i], den = a.d[0] * b.d[1] - a.d[1] * b.d[0];
    if (Math.abs(den) < 1e-6) return b.p;
    const k = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / den;
    return [a.p[0] + a.d[0] * k, a.p[1] + a.d[1] * k];
  });
}
/** a parapet standing just inside a wall ring (its outer face 1 cm behind the walls'), from y0 to y1, with a coping */
function innerParapet(ring, y0, y1, th, key, coping) {
  const r = offsetRing(ring, th / 2 + 0.01);
  K.parapet(B, key, [...r, r[0]], y0, y1 - y0, th, coping ? { coping } : {});
}
/** walls round a plan ring (in s, t) from y0 to y1, facing out; edges whose midpoint passes `skip` are left out */
function ringWalls(ring, y0, y1, key, skip) {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    let p = ring[i], q = ring[(i + 1) % n];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (skip && skip(m)) continue;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = -(q[1] - p[1]) / L, nz = (q[0] - p[0]) / L;
    if (inR(m[0] + nx * 0.05, m[1] + nz * 0.05, ring)) { const x = p; p = q; q = x; }      // (normal (-az, ax) must point out)
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    K.wall(B, K.frame(p[0], 0, p[1], (q[0] - p[0]) / l, (q[1] - p[1]) / l), K.rectPts(0, y0, l, y1), [], key);
  }
}

// ------------------------------------------------------------------------------------------------ small helpers (current wall frame: x along, y up, z out)
/** stone quoins at a corner x (the blocks run towards -dir from it... i.e. into the face by `dir` = +1 / -1), from y0 to y1 */
function quoins(x, dir, y0, y1, o = {}) {
  const h = o.h ?? 0.3, gap = 0.05, long = o.long ?? 0.85, short = o.short ?? 0.45, key = o.key || 'brickWarm';
  let i = 0;
  for (let y = y0; y + h <= y1 + 0.01; y += h + gap, i++) { const w = i % 2 ? short : long; B.box(key, x + (dir * w) / 2, y + h / 2, 0.035, w, h, 0.07, 0, {}); }
}
/** a cornice: a frieze band, a corona with modillions under it (o.mod: spacing, 0 = none) from x0 to x1, its top at y */
function cornice(x0, x1, y, h, proj, o = {}) {
  const key = o.key || 'bathDress', e = o.ends ?? 0;
  K.stringCourse(B, key, x0 - e, x1 + e, y, h * 0.45, proj);
  K.stringCourse(B, key, x0 - e * 0.6, x1 + e * 0.6, y - h * 0.45, h * 0.25, proj * 0.45);
  K.stringCourse(B, key, x0 - e * 0.3, x1 + e * 0.3, y - h * 0.7, h * 0.3, 0.08);
  if (o.mod) for (let x = x0 + o.mod / 2; x < x1; x += o.mod) B.box(key, x, y - h * 0.45 - 0.08, proj * 0.5, 0.12, 0.16, proj * 0.85, 0, { bottom: true });
}
/** a triangular pediment over a window: base w at y, rising `rise`, in brick with a stone base line */
function pediment(x, w, y, rise, key = 'brickWarm') {
  const a = [x - w / 2, y], b = [x + w / 2, y], c = [x, y + rise], z0 = 0.12;
  B.poly(key, [[a[0], a[1], z0], [b[0], b[1], z0], [c[0], c[1], z0]], [0, 0, 1]);
  for (const [p, q] of [[a, c], [c, b]]) {      // the raking mouldings (rubbed brick, light-pointed: drawn in the stone dressing's colour as the photographs read)
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    B.push(new K.THREE.Matrix4().makeRotationZ(ang).setPosition((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0));
    B.box('bathDress', 0, 0.04, 0.09, L + 0.12, 0.09, 0.18, 0, { bottom: true });
    B.pop();
  }
  B.box('bathDress', x, y + 0.04, 0.09, w + 0.1, 0.09, 0.18, 0, { bottom: true });
}
/** a wall lantern on an iron bracket at x, y of the current wall frame (out 0.45); returns the light's point in the frame */
function wallLamp(x, y) {
  B.box('ironBlack', x, y + 0.55, 0.22, 0.05, 0.05, 0.45, 0, {});
  B.box('ironBlack', x, y + 0.3, 0.04, 0.12, 0.6, 0.06, 0, {});
  return K.lantern(B, x, y, 0.45, { size: 0.3 });
}
/** a sash opening in the current wall: { pts, kind 'win' } with its own stone sill */
const sash = (x, w, y0, y1, o = {}) => ({ pts: K.rectPts(x - w / 2, y0, x + w / 2, y1), kind: 'win', glass: 'sash', d: o.d ?? 0.2, sill: o.sill ?? true });
/** a rubbed-brick flat arch over an opening head, with an optional raised key */
function flatArch(x, w, head, h, key) {
  B.box('brickWarm', x, head + h / 2, 0.015, w + 0.22, h, 0.03, 0, { bottom: true });
  if (key) B.box('brickWarm', x, head + key / 2 - 0.04, 0.045, 0.3, key, 0.09, 0, { bottom: true });
}
/** a light's point given in a frame of P.F (s, y, t) -> ctx.lamp in LOCAL */
const lampAt = (s, y, t) => { const l = P.F.L(s, t); ctx.lamp(l[0], y, l[1]); };

// ------------------------------------------------------------------------------------------------ THE HALL
function hall() {
  const H = P.HALL, { s0, s1, tW, tE } = H, C = H.cornice;
  const pitch = (s1 - s0) / (H.bays - 1 + 2 * H.margin), bayX = (k) => s0 + H.margin * pitch + k * pitch;
  const xs = Array.from({ length: H.bays }, (_, k) => bayX(k));
  const c0 = (xs[H.centre.bays[0] - 1] + xs[H.centre.bays[0]]) / 2, c1 = (xs[H.centre.bays[1]] + xs[H.centre.bays[1] + 1]) / 2, tC = tW + H.centre.adv;
  const foot = footAt(s0, s1, tW, tW + 1.5), footN = footAt(s0 - 1.5, s0, tE, tW), footS = footAt(s1, s1 + 1.5, tW - 3.8, tW);
  // ---- the west front: three planes (the middle three bays forward), the returns
  const opsFor = (a, b) => {
    const ops = [];
    xs.forEach((x, k) => {
      if (x < a || x > b) return;
      if (k === H.door.bay) ops.push({ pts: K.rectPts(x - H.door.w / 2, H.ffl, x + H.door.w / 2, H.ffl + H.door.h), kind: 'door', doorKey: 'doorOak', d: 0.3 });
      else ops.push(sash(x, H.win0.w, H.win0.sill, H.win0.head, { sill: false, d: 0.22 }));
      ops.push({ pts: K.rectPts(x - H.win1.w / 2, H.win1.sill, x + H.win1.w / 2, H.win1.head), kind: 'none', d: 0.24 });
    });
    return ops;
  };
  const planes = [[s0, c0, tW], [c0, c1, tC], [c1, s1, tW]];
  for (const [a, b, t] of planes) K.wall(B, WF(t), rect(a, foot, b, C.top), opsFor(a, b), 'brick');
  K.wall(B, NF(c0), rect(tW, foot, tC, C.top), [], 'brick');
  K.wall(B, SF(c1), rect(-tC, foot, -tW, C.top), [], 'brick');
  for (const [a, b, t] of planes) {
    B.push(WF(t));
    K.stringCourse(B, 'brickDark', a, b, H.plinth, H.plinth - foot, 0.06);
    K.stringCourse(B, 'bathDress', a, b, H.band.top, H.band.h, 0.09);
    cornice(a, b, C.top, C.h, C.proj, { mod: C.mod, ends: t === tW ? 0 : C.proj });
    for (const x of xs) {
      if (x < a || x > b) continue;
      const k = xs.indexOf(x), w1 = H.win1;
      // the hall's tall sash (two painted units, one over the other), its brick architrave, keystone and apron
      const mid = (w1.sill + w1.head) / 2;
      B.unit('sash', K.rectPts(x - w1.w / 2, w1.sill, x + w1.w / 2, mid), -0.22, K.nextBay(w1.sill));
      B.unit('sash', K.rectPts(x - w1.w / 2, mid, x + w1.w / 2, w1.head), -0.22, K.nextBay(w1.sill));
      B.box('whitePaint', x, mid, -0.2, w1.w, 0.07, 0.06, 0, {});
      for (const sx of [-1, 1]) B.box('brickWarm', x + sx * (w1.w / 2 + 0.1), (w1.sill + w1.head) / 2, 0.025, 0.2, w1.head - w1.sill, 0.05, 0, { top: false });
      B.box('brickWarm', x, w1.head + 0.12, 0.025, w1.w + 0.4, 0.24, 0.05, 0, { bottom: true });
      B.box('bathDress', x, w1.head + H.keyH / 2, 0.06, 0.34, H.keyH, 0.12, 0, { bottom: true });
      B.box('brickWarm', x, (H.apron.y0 + H.apron.y1) / 2, 0.02, w1.w + 0.2, H.apron.y1 - H.apron.y0, 0.04, 0, {});
      B.box('bathDress', x, w1.sill - 0.04, 0.08, w1.w + 0.3, 0.08, 0.16, 0, { bottom: true });
      if (k === H.door.bay) {
        // the stone doorcase: pilasters, an entablature on consoles, a cornice hood; a stone step
        const d = H.door, y1 = H.ffl + d.h;
        for (const sx of [-1, 1]) {
          B.box('bathDress', x + sx * (d.w / 2 + 0.16), (H.ffl + y1) / 2, 0.07, 0.3, d.h, 0.14, 0, {});
          B.box('bathDress', x + sx * (d.w / 2 + 0.2), y1 + 0.2, 0.16, 0.22, 0.4, 0.3, 0, { bottom: true });
        }
        B.box('bathDress', x, y1 + 0.22, 0.09, d.w + 0.72, 0.44, 0.18, 0, { bottom: true });
        B.box('bathDress', x, y1 + 0.52, 0.2, d.w + 1.1, 0.16, 0.4, 0, { bottom: true });
        const gS = P.F.groundY(x, tW + 0.6);
        B.box('pavingSolid', x, (H.ffl + gS - 0.2) / 2, 0.3, d.w + 0.8, H.ffl - gS + 0.2, 0.6, 0, {});
      } else {
        const w0 = H.win0;
        B.box('bathDress', x, w0.sill - 0.06, 0.07, w0.w + 0.24, 0.12, 0.14, 0, { bottom: true });
        flatArch(x, w0.w, w0.head, H.arch.h, H.arch.key);
      }
    }
    B.pop();
  }
  B.push(NF(c0)); cornice(tW, tC, C.top, C.h, C.proj); K.stringCourse(B, 'bathDress', tW, tC, H.band.top, H.band.h, 0.09); B.pop();
  B.push(SF(c1)); cornice(-tC, -tW, C.top, C.h, C.proj); K.stringCourse(B, 'bathDress', -tC, -tW, H.band.top, H.band.h, 0.09); B.pop();
  // downpipes
  B.push(WF(tW));
  for (const x of H.pipes) { B.box('ironBlack', x, (foot + C.top - 0.6) / 2, 0.09, 0.1, C.top - 0.6 - foot, 0.1, 0, {}); B.box('ironBlack', x, C.top - 0.75, 0.12, 0.3, 0.3, 0.24, 0, {}); }
  quoins(s0, 1, foot + 0.4, C.top - C.h, {}); quoins(s1, -1, foot + 0.4, C.top - C.h, {});
  B.pop();
  // ---- the pediment over the middle bays: brick tympanum, stone raking cornices, the oculus; its lead roof
  B.push(WF(tC));
  const xm = (c0 + c1) / 2, ap = H.centre.apex, r = H.centre.oculus, yo = C.top + (ap - C.top) * 0.42, N = 16;
  const circ = (rr) => Array.from({ length: N }, (_, i) => [xm + Math.cos((i / N) * Math.PI * 2) * rr, yo + Math.sin((i / N) * Math.PI * 2) * rr]);
  B.face('brick', [[c0, C.top], [c1, C.top], [xm, ap]], [circ(r).slice().reverse()], 0);
  B.reveal('bathDress', circ(r), 0, -0.25);
  B.unit('glassDark', circ(r), -0.22, K.nextBay(8));
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); B.box('bathDress', xm + c * (r + 0.1), yo + s * (r + 0.1), 0.04, 0.24, 0.24, 0.08, 0, {}); }
  for (const [p, q] of [[[c0 - 0.35, C.top - 0.02], [xm, ap + 0.12]], [[xm, ap + 0.12], [c1 + 0.35, C.top - 0.02]]]) {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    B.push(new K.THREE.Matrix4().makeRotationZ(ang).setPosition((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0));
    B.box('bathDress', 0, -0.12, 0.2, L, 0.3, 0.45, 0, { bottom: true });
    B.pop();
  }
  B.pop();
  K.roof(B, 'lead', c0 - 0.2, c1 + 0.2, (tW + tE) / 2, tC + 0.25, C.top, ap - C.top, { axis: 'z', ends: ['open', 'gable'], ov: 0, gableWalls: false });
  // ---- the north end: doorway, window, plaques, the wall lantern at the north-west corner; the band and cornice
  K.wall(B, NF(s0), rect(tE, footN, tW, C.top), [
    { pts: K.rectPts(H.north.door - 0.55, H.ffl, H.north.door + 0.55, H.ffl + 2.4), kind: 'door', doorKey: 'doorOak', d: 0.25 },
    sash(H.north.win, H.win0.w, H.win0.sill, H.win0.head, { d: 0.22 })], 'brick');
  B.push(NF(s0));
  K.stringCourse(B, 'brickDark', tE, tW, H.plinth, H.plinth - footN, 0.06);
  K.stringCourse(B, 'bathDress', tE, tW, H.band.top, H.band.h, 0.09);
  cornice(tE, tW, C.top, C.h, C.proj, { mod: C.mod });
  flatArch(H.north.win, H.win0.w, H.win0.head, H.arch.h, H.arch.key);
  B.box('bathDress', H.north.door, H.ffl + 2.55, 0.1, 1.6, 0.3, 0.2, 0, { bottom: true });
  for (const x of H.north.plaques) B.box('bathDress', x, 4.0, 0.04, 0.55, 0.75, 0.08, 0, {});
  quoins(tW, -1, footN + 0.4, C.top - C.h, {});
  { const l = wallLamp(H.lampNW.t, H.lampNW.y); lampAt(s0 - l[2], l[1], l[0]); }
  B.pop();
  // ---- the south end: full height only where the loggia's recess shows it (tW .. the link's wall); a doorway into the loggia
  const tL = P.LINK.tW;
  K.wall(B, SF(s1), rect(-tW, footS, -tL, C.top), [{ pts: K.rectPts(-(tL + 0.95) - 0.5, P.LINK.ffl, -(tL + 0.95) + 0.5, P.LINK.ffl + 2.3), kind: 'door', doorKey: 'doorOak', d: 0.22 }], 'brick');
  K.wall(B, SF(s1), rect(-tL, P.LINK.top - 0.4, -tE, C.top), [], 'brick');
  B.push(SF(s1));
  K.stringCourse(B, 'brickDark', -tW, -tL, H.plinth, H.plinth - footS, 0.06);
  K.stringCourse(B, 'bathDress', -tW, -tL, H.band.top, H.band.h, 0.09);
  cornice(-tW, -tE, C.top, C.h, C.proj, { mod: C.mod });
  quoins(-tW, 1, footS + 0.4, C.top - C.h, {});
  { const l = wallLamp(-H.lampSW.t + 0.1, H.lampSW.y); lampAt(s1 + l[2], l[1], -l[0]); }
  B.pop();
  // ---- the east wall over the kitchens' roofs, with its oculi
  const ocs = H.oculiE.map((s) => Array.from({ length: 12 }, (_, i) => [-s + Math.cos((-i / 12) * Math.PI * 2) * 0.5, H.oculiEY + Math.sin((-i / 12) * Math.PI * 2) * 0.5]));
  K.wall(B, EF(tE), rect(-s1, P.KIT.roof - 0.1, -s0, C.top), ocs.map((pts) => ({ pts: pts.slice().reverse(), kind: 'none', d: 0.25 })), 'brick');
  B.push(EF(tE));
  for (const pts of ocs) B.unit('glassDark', pts.slice().reverse(), -0.22, K.nextBay(8));
  cornice(-s1, -s0, C.top, C.h, C.proj);
  B.pop();
  // ---- the hipped roof, the stacks, the finial
  K.roof(B, 'stoneSlateHall', s0, s1, tE, tW, C.top, H.ridge - C.top, { axis: 'x', ends: ['hip', 'hip'], ov: H.roofOv });
  for (const c of H.stacks) K.chimney(B, 'brickWarm', c.s - c.w / 2, c.s + c.w / 2, c.t - c.d / 2, c.t + c.d / 2, C.top - 0.5, c.top, { capKey: 'bathDress', pots: 2 });
  { const tm = (tW + tE) / 2; B.cyl('leadDark', H.finial.s, H.ridge - 0.05, tm, 0.0, H.finial.h, 6, false, 0.1); B.cyl('leadDark', H.finial.s, H.ridge - 0.1, tm, 0.16, 0.25, 8, true, 0.2); }
  ctx.solid(P.F.ring(R(s0, s1, tE, tW)));
  return { foot };
}

// ------------------------------------------------------------------------------------------------ THE KITCHENS
function kitchens() {
  const Kt = P.KIT, ring = Kt.ring, foot = footAt(1.7, 25.3, -31.5, -14.0), skipHall = (m) => Math.abs(m[1] - P.HALL.tE) < 0.05;
  ringWalls(ring, foot, Kt.parapet, 'brick', skipHall);
  // the north and east faces again with their windows (drawn over the plain walls: the plain ones skipped)
  innerParapet(ring, Kt.roof - 0.05, Kt.parapet, 0.3, 'brick', 'brickDark');
  B.flat('leadDark', offsetRing(ring, 0.3), Kt.roof);
  // windows (painted on: a reveal-less sash set 2 cm proud of the wall plane, the face is plain brick)
  B.push(NF(1.7));
  for (const t of Kt.wins.north) {
    B.unit('sash', K.rectPts(t - 0.8, Kt.ffl + 1.38, t + 0.8, Kt.ffl + 3.24), 0.02, K.nextBay(1)); flatArch(t, 1.6, Kt.ffl + 3.24, 0.3);
    B.unit('sash', K.rectPts(t - 0.6, Kt.ffl + 4.4, t + 0.6, Kt.ffl + 6.0), 0.02, K.nextBay(5)); flatArch(t, 1.2, Kt.ffl + 6.0, 0.3);
  }
  K.stringCourse(B, 'brickDark', -31.5, -14.0, Kt.ffl + 0.3, Kt.ffl + 0.3 - foot, 0.05);
  B.pop();
  B.push(EF(-31.5));
  for (const s of Kt.wins.east) {
    B.unit('sash', K.rectPts(-s - 0.6, Kt.ffl + 1.4, -s + 0.6, Kt.ffl + 3.2), 0.02, K.nextBay(1));
    B.unit('sash', K.rectPts(-s - 0.6, Kt.ffl + 4.64, -s + 0.6, Kt.ffl + 6.1), 0.02, K.nextBay(5));
  }
  K.stringCourse(B, 'stucco', -10.0, -1.7, Kt.ffl + 3.5, 0.25, 0.03);
  B.pop();
  // the tower, the rooflight, the plant, the flues
  const T = Kt.tower, tr = R(T.s0, T.s1, T.t1, T.t0);
  K.prism(B, 'brick', tr, Kt.roof - 0.1, T.top, { top: true, topKey: 'leadDark' });
  innerParapet(tr, T.top, T.top + 0.35, 0.25, 'brick', 'brickDark');
  B.push(NF(T.s0)); K.stringCourse(B, 'stucco', T.t1, T.t0, 10.1, 0.3, 0.03); B.unit('sash', K.rectPts(-17.8, 8.6, -16.8, 9.8), 0.02, K.nextBay(5)); B.pop();
  B.push(EF(T.t1)); K.stringCourse(B, 'stucco', -T.s1, -T.s0, 10.1, 0.3, 0.03); B.pop();
  const Lg = Kt.light;
  K.prism(B, 'leadDark', R(Lg.s0, Lg.s1, Lg.t1, Lg.t0), Kt.roof - 0.05, Kt.roof + 0.25, {});
  K.roof(B, 'glassRoof', Lg.s0, Lg.s1, Lg.t1, Lg.t0, Kt.roof + 0.25, Lg.top - Kt.roof - 0.25, { axis: 'x', ends: ['hip', 'hip'], ov: 0 });
  for (const [s, t, w, d, h] of Kt.plant) K.prism(B, 'zinc', R(s - w / 2, s + w / 2, t - d / 2, t + d / 2), Kt.roof, Kt.roof + h, { top: true });
  for (const [s, t, r, h] of Kt.ducts) { B.cyl('zinc', s, Kt.roof, t, r, h, 8, true); B.cyl('zinc', s, Kt.roof + h, t, r * 1.5, 0.25, 8, true, r * 1.2); }
  // the lower range on north towards Walton House (stopped at s -1.2: LOCAL v -6; the house part goes on from there)
  const Lk = Kt.link, lr = R(Lk.s0, 1.7, Lk.t1, Lk.t0), fL = footAt(Lk.s0, 1.7, Lk.t1, Lk.t0);
  K.wall(B, WF(Lk.t0), rect(Lk.s0, fL, 1.7, Lk.top), [sash(0.25, 1.1, 1.4, 3.3), sash(0.25, 1.1, 4.4, 6.3)], 'brick');
  K.wall(B, NF(Lk.s0), rect(Lk.t1, fL, Lk.t0, Lk.top), [], 'brick');
  K.wall(B, EF(Lk.t1), rect(-1.7, fL, -Lk.s0, Lk.top), [], 'brick');
  B.flat('leadDark', offsetRing(lr, 0.3), Lk.top - 0.6);
  innerParapet(lr, Lk.top - 0.65, Lk.top, 0.3, 'brick', 'brickDark');
  ctx.solid(P.F.ring(ring));
  ctx.solid(P.F.ring(lr));
}

// ------------------------------------------------------------------------------------------------ THE LINK and its LOGGIA
function link() {
  const L = P.LINK, fl = Math.max(...[0, 0.5, 1].map((f) => P.F.groundY(L.s0 + (L.s1 - L.s0) * f, L.colT - 0.25))) + L.dy,      // (the flags' level at the columns: their bases and the doors' thresholds)
    { s0, s1, tW, tE } = L, ps = L.pass, foot = footAt(s0, s1, L.colT, tW - 1), footE = footAt(s0, s1, tE - 1.5, tE);
  // the recessed west wall: the way through in the middle bay, doors either side, three windows a floor above
  const opsW = [{ pts: K.rectPts(ps.s0, fl, ps.s1, fl + ps.h - fl + 0.0), kind: 'void', d: 0.02 },
    { pts: K.rectPts(25.75, fl, 26.65, fl + 2.3), kind: 'door', doorKey: 'doorOak', d: 0.2 },
    { pts: K.rectPts(29.95, fl, 30.85, fl + 2.3), kind: 'door', doorKey: 'doorOak', d: 0.2 }];
  for (const x of L.bays) { opsW.push(sash(x, L.win1.w, L.win1.sill, L.win1.head, { sill: false })); opsW.push(sash(x, L.win2.w, L.win2.sill, L.win2.head)); }
  K.wall(B, WF(tW), rect(s0, foot, s1, L.top), opsW, 'brickWarm');
  B.push(WF(tW));
  for (const x of L.bays) { flatArch(x, L.win1.w, L.win1.head, 0.32); flatArch(x, L.win2.w, L.win2.head, 0.32); }
  cornice(s0, s1, 9.55, 0.4, 0.32);
  B.pop();
  // the east face with the passage's east mouth
  const opsE = [{ pts: rect(-ps.s1, fl, -ps.s0, ps.h), kind: 'void', d: 0.02 }];
  for (const x of L.bays) { opsE.push(sash(-x, 1.0, 4.0, 5.9)); opsE.push(sash(-x, 1.0, 6.95, 8.6)); }
  K.wall(B, EF(tE), rect(-s1, footE, -s0, L.top), opsE, 'brick');
  B.push(EF(tE)); K.stringCourse(B, 'bathDress', -s1, -s0, 9.5, 0.3, 0.2); { const l = wallLamp(-(ps.s1 + 0.45), ps.h + 0.2); lampAt(-l[0], l[1], tE - l[2]); } B.pop();
  // its south face beyond Maitland's north block (t -10.5 .. tE)
  K.wall(B, SF(s1), rect(-P.MAIT.tBack, footE, -tE, L.top), [sash(12.75, 1.0, 1.4, 3.1), sash(12.75, 1.0, 4.0, 5.9), sash(12.75, 1.0, 6.95, 8.6)], 'brick');
  // the roof and its parapet's coping
  const rr = R(s0, s1, tE, tW);
  B.flat('leadDark', offsetRing(rr, 0.3), L.roof);
  innerParapet(rr, L.roof - 0.05, L.top, 0.3, 'brickWarm', 'bathDress');
  // the way through: side walls, plastered ceiling, the floor (loggia + passage)
  K.wall(B, SF(ps.s0), rect(-tW, Math.min(foot, footE), -tE, ps.h), [], 'plaster');
  K.wall(B, NF(ps.s1), rect(tE, Math.min(foot, footE), tW, ps.h), [], 'plaster');
  B.flat('plaster', R(ps.s0, ps.s1, tE, tW), ps.h, [], true);
  // (the floor: flags laid on the surveyed ground through the loggia and the way, as the paths outside are)
  const flo = (u, v) => S.groundY(u, v) + L.dy;
  for (const r of [R(s0 + 0.02, s1 - 0.02, tW, L.colT + 0.3), R(ps.s0, ps.s1, tE - 0.3, tW)]) ctx.floor(P.F.ring(r), flo);      // (the flags themselves are draped in ground(), in the LOCAL frame)
  // the loggia: two white Tuscan columns and responds, the entablature (its soffit the loggia's ceiling), the balcony
  const pitch = (s1 - s0) / 3, cols = [s0 + pitch, s0 + 2 * pitch], tc = L.colT - 0.25;
  for (const x of cols) {
    B.box('whitePaint', x, fl + 0.12, tc, 0.5, 0.24, 0.5, 0, {});
    B.cyl('whitePaint', x, fl + 0.24, tc, L.colR * 0.85, L.colTop - fl - 0.24 - 0.2, 10, false, L.colR);
    B.box('whitePaint', x, L.colTop - 0.1, tc, 0.52, 0.2, 0.52, 0, { bottom: true });
    ctx.solid(P.F.ring(R(x - 0.25, x + 0.25, tc - 0.25, tc + 0.25)));
  }
  for (const x of [s0 + 0.15, s1 - 0.15]) B.box('whitePaint', x, (fl + L.colTop) / 2, tc, 0.3, L.colTop - fl, 0.42, 0, {});
  B.box('whitePaint', (s0 + s1) / 2, (L.ent.y0 + L.ent.y1) / 2, (L.colT + tW) / 2, s1 - s0, L.ent.y1 - L.ent.y0, L.colT - tW, 0, { bottom: true });
  B.box('whitePaint', (s0 + s1) / 2, L.ent.y1 - 0.05, L.colT + 0.04, s1 - s0, 0.14, 0.16, 0, { bottom: true });
  B.flat('lead', R(s0, s1, tW, L.colT), L.ent.y1 + 0.01);
  // the balustrade along the balcony's front: plinth, balusters, rail, pedestals at the ends and over the columns
  const tb = L.colT - 0.15, bl = L.bal;
  B.box('whitePaint', (s0 + s1) / 2, bl.y0 + 0.08, tb, s1 - s0, 0.16, 0.3, 0, {});
  B.box('whitePaint', (s0 + s1) / 2, bl.rail - 0.07, tb, s1 - s0, 0.14, 0.32, 0, { bottom: true });
  for (let i = 0; i < bl.n; i++) {
    const x = s0 + 0.35 + ((s1 - s0 - 0.7) * (i + 0.5)) / bl.n;
    if (cols.some((c) => Math.abs(c - x) < 0.22)) continue;
    B.cyl('whitePaint', x, bl.y0 + 0.16, tb, 0.045, bl.rail - bl.y0 - 0.3, 6, false, 0.075);
  }
  for (const x of [s0 + 0.2, ...cols, s1 - 0.2]) B.box('whitePaint', x, (bl.y0 + bl.rail) / 2 + 0.05, tb, 0.36, bl.rail - bl.y0 + 0.1, 0.36, 0, {});
  // a lantern hung in the loggia (G)
  { const y = L.ent.y0 - 0.5, t = (L.colT + tW) / 2, x = (s0 + s1) / 2; B.cyl('ironBlack', x, y + 0.4, t, 0.012, L.ent.y0 - y - 0.4, 4, false); const l = K.lantern(B, x, y, t, { size: 0.26 }); lampAt(l[0], l[1], l[2]); }
  // colliders: the link's walls with the way through left open
  for (const [a, b] of [[[s0, tW], [ps.s0, tW]], [[ps.s1, tW], [s1, tW]], [[ps.s0, tW], [ps.s0, tE]], [[ps.s1, tW], [ps.s1, tE]], [[s0, tE], [ps.s0, tE]], [[ps.s1, tE], [s1, tE]]]) { const p = P.F.L(...a), q = P.F.L(...b); ctx.seg(p[0], p[1], q[0], q[1]); }
}

// ------------------------------------------------------------------------------------------------ MAITLAND
function maitland() {
  const M = P.MAIT, W = M.winW, ring = [[M.sN, M.tEnd], [M.sC0, M.tEnd], [M.sC0, M.tCen], [M.sC1, M.tCen], [M.sC1, M.tEnd], [M.sS, M.tEnd], [M.sS, M.tSouthStep], [M.sS2, M.tSouthStep], [M.sS2, M.tBack], [M.sYard1, M.tBack], [M.sYard1, M.tYard], [M.sYard0, M.tYard], [M.sYard0, M.tBack], [M.sN, M.tBack]];
  const top = M.parapet.top - M.parapet.coping, C = M.cornice;
  const rowOps = (x, pedOK) => [sash(x, W, M.win0.sill, M.win0.head), sash(x, W, M.win1.sill, M.win1.head), sash(x, W, M.win2.sill, M.win2.head)];
  const dressRow = (x, ped) => {
    for (const w of [M.win0, M.win1, M.win2]) if (!(ped && w === M.win1)) flatArch(x, W, w.head, 0.3);
    if (ped) pediment(x, M.ped.w, M.win1.head + M.ped.gap, M.ped.rise);
  };
  /** a face of Maitland in wall frame Fr between x0 and x1 (frame coordinates), windows at xs (pediments if ped) */
  const face = (Fr, x0, x1, xs, ped, foot, o = {}) => {
    K.wall(B, Fr, rect(x0, foot, x1, top), xs.flatMap((x) => rowOps(x)), o.key || 'brick');
    B.push(Fr);
    K.stringCourse(B, 'brickDark', x0, x1, M.plinth, M.plinth - foot, 0.06);
    K.stringCourse(B, 'bathDress', x0, x1, M.band.top, M.band.h, 0.07);
    cornice(x0, x1, C.top, C.h, C.proj, { mod: o.mod || 0, ends: o.ends || 0 });
    for (const x of xs) dressRow(x, ped);
    // the parapet's sunk panels, one a bay
    if (o.panels !== false) { const n = Math.max(1, Math.round((x1 - x0) / 1.85)), pw = (x1 - x0) / n; for (let i = 0; i < n; i++) B.poly('brickDark', [[x0 + i * pw + 0.25, C.top + 0.12, 0.006], [x0 + (i + 1) * pw - 0.25, C.top + 0.12, 0.006], [x0 + (i + 1) * pw - 0.25, top - 0.15, 0.006], [x0 + i * pw + 0.25, top - 0.15, 0.006]], [0, 0, 1]); }
    if (o.quoins) for (const [x, d] of o.quoins) quoins(x, d, foot + 0.35, C.top - C.h, {});
    B.pop();
  };
  const fN = footAt(M.sN, M.sC0, M.tEnd, M.tEnd + 1.5), fC = footAt(M.sC0, M.sC1, M.tCen, M.tCen + 1.5), fS = footAt(M.sC1, M.sS, M.tEnd, M.tEnd + 1.5);
  const fBack = footAt(M.sN, M.sS2, M.tBack - 1.5, M.tBack);
  // the Quad front: two advanced end blocks with pediments over the first-floor windows, the centre between
  face(WF(M.tEnd), M.sN, M.sC0, M.bays.N, true, fN, { quoins: [[M.sN, 1], [M.sC0, -1]], ends: C.proj });
  face(WF(M.tCen), M.sC0, M.sC1, M.bays.C, false, fC, {});
  face(WF(M.tEnd), M.sC1, M.sS, M.bays.S, true, fS, { quoins: [[M.sC1, 1], [M.sS, -1]], ends: C.proj });
  face(SF(M.sC0), -M.tEnd, -M.tCen, [], false, fC, { panels: false, quoins: [[-M.tEnd, 1]] });
  face(NF(M.sC1), M.tCen, M.tEnd, [], false, fC, { panels: false, quoins: [[M.tEnd, -1]] });
  // the north return into the loggia's recess, the south end (seen in no look: G), the backs and the yard
  face(NF(M.sN), P.LINK.tW, M.tEnd, M.north, false, footAt(M.sN - 1.5, M.sN, P.LINK.tW, M.tEnd), { quoins: [[M.tEnd, -1]] });
  const back = (a, b) => { const n = Math.max(1, Math.floor((b - a) / M.back)), p = (b - a) / n; return Array.from({ length: n }, (_, i) => a + (i + 0.5) * p); };
  face(SF(M.sS), -M.tEnd, -M.tSouthStep, M.south.map((t) => -t), false, footAt(M.sS, M.sS + 1.5, M.tSouthStep, M.tEnd), { quoins: [[-M.tEnd, 1]] });
  face(WF(M.tSouthStep), M.sS, M.sS2, [], false, footAt(M.sS, M.sS2, M.tSouthStep, M.tSouthStep + 1.5), { panels: false });
  face(SF(M.sS2), -M.tSouthStep, -M.tBack, back(-M.tSouthStep, -M.tBack), false, footAt(M.sS2, M.sS2 + 1.5, M.tBack, M.tSouthStep));
  face(EF(M.tBack), -M.sS2, -M.sYard1, back(-M.sS2, -M.sYard1), false, fBack);
  face(NF(M.sYard1), M.tBack, M.tYard, back(M.tBack, M.tYard), false, fBack);
  face(EF(M.tYard), -M.sYard1, -M.sYard0, back(-M.sYard1, -M.sYard0), false, fBack);
  face(SF(M.sYard0), -M.tYard, -M.tBack, back(-M.tYard, -M.tBack), false, fBack);
  face(EF(M.tBack), -M.sYard0, -M.sN, back(-M.sYard0, -M.sN), false, fBack);
  // the north wall behind the link's roof (only its top shows) and the roofs: flat, behind the parapet, the grey block
  K.wall(B, NF(M.sN), rect(M.tBack, P.LINK.top - 0.3, P.LINK.tW, top), [], 'brick');
  B.flat('leadDark', offsetRing(ring, 0.3), M.roof);
  innerParapet(ring, M.roof - 0.05, top, 0.3, 'brick', 'bathDress');
  const Gb = M.grey;
  K.prism(B, 'zinc', R(Gb.s0, Gb.s1, Gb.t1, Gb.t0), M.roof - 0.05, Gb.top, { top: true, topKey: 'leadDark' });
  for (const [s, t, w, d, tp] of M.stacks) {
    K.chimney(B, 'brick', s - w / 2, s + w / 2, t - d / 2, t + d / 2, M.roof - 0.1, tp, { capKey: 'bathDress', pots: w > 2 ? 4 : 2 });
    B.box('bathDress', s, tp - 0.45, t, w + 0.14, 0.12, d + 0.14, 0, { bottom: true });      // the stacks' corniced band
  }
  B.push(WF(M.tEnd));
  for (const x of M.pipes) {
    const tz = x > M.sC0 && x < M.sC1 ? M.tCen - M.tEnd : 0;
    B.box('ironBlack', x, (fC + C.top - C.h - 0.2) / 2, tz + 0.09, 0.1, C.top - C.h - 0.2 - fC, 0.1, 0, {});
    B.box('ironBlack', x, C.top - C.h - 0.3, tz + 0.12, 0.28, 0.28, 0.22, 0, {});
  }
  B.pop();
  ctx.solid(P.F.ring(ring));
}

// ------------------------------------------------------------------------------------------------ the ground at the walls (draped: LOCAL)
function ground() {
  const { G } = ctx, H = P.HALL, M = P.MAIT, L = P.LINK;
  const pitch = (H.s1 - H.s0) / (H.bays - 1 + 2 * H.margin), xd = H.s0 + H.margin * pitch + H.door.bay * pitch;
  for (const [a, b] of [[H.s0 + 0.1, xd - 0.9], [xd + 0.9, H.s1 - 0.1]]) {
    const r = P.F.ring(R(a, b, H.tW + 0.02, H.tW + 1.5));
    G.drape(B, 'flowerbed', r, 0.09); G.edgeDown(B, 'soil', r, 0.09, 0.12);
  }
  for (const [a, b, t] of [[M.sN + 0.1, M.sC0, M.tEnd], [M.sC0, M.sC1, M.tCen], [M.sC1, M.sS - 0.1, M.tEnd]]) {
    const r = P.F.ring(R(a, b, t + 0.02, P.BEDS.mait));
    G.drape(B, 'flowerbed', r, 0.09); G.edgeDown(B, 'soil', r, 0.09, 0.12);
  }
  // the flags before the loggia (from the Hall's front line to its columns) and before the way's east mouth
  for (const r of [R(L.s0 + 0.02, L.s1 - 0.02, L.tW, H.tW + 1.5), R(L.pass.s0, L.pass.s1, L.tE - 0.3, L.tW)]) G.drape(B, 'pavingSolid', P.F.ring(r), L.dy);
  G.drape(B, 'pavingSolid', P.F.ring(R(L.pass.s0 - 0.3, L.pass.s1 + 0.3, L.tE - 2.0, L.tE - 0.3)), L.dy);
}

// ------------------------------------------------------------------------------------------------ the part
export function buildHall(c) {
  ctx = c; K = c.K; B = c.B; S = c.S;
  K.addCell(c.pack, 'stoneSlateHall', 'stoneSlate', [0.56, 0.54, 0.53]);      // the Hall's darker graded stone slates (photos 2006, 2025; satellite)
  const n0 = B.tris(), out = {};
  B.push(P.F.M);
  let n = B.tris(); hall(); out.hall = Math.round(B.tris() - n);
  n = B.tris(); kitchens(); out.kitchens = Math.round(B.tris() - n);
  n = B.tris(); link(); out.link = Math.round(B.tris() - n);
  n = B.tris(); maitland(); out.maitland = Math.round(B.tris() - n);
  B.pop();
  ground();
  out.total = Math.round(B.tris() - n0);
  return out;
}
