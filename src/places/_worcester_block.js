// Worcester College: the MAIN BLOCK built to its true plan (places/_worcester_shared.js WORC_BLOCK; survey Appendix
// D.8) — the nine-arch loggia with the Library over it, the gate hall through the centre, the Chapel (north) and Hall
// (south) wings, the three-bay street front with its clock, the forecourt and its screen. Called by places/worcester.js,
// which owns the batch, the helpers (wall, outline, glaze …) and the colliders; this file owns the block's shapes.
//
// 2026-11-22, second pass. What changed from the block drawn to the map's outline: walls 26.0 x 35.8 m (were 27.9 x 37.2:
// the map has the cornice line); the loggia 4.9 m deep inside (was 2.6) under a groin vault; the arcade as it is (three
// groups of three arches 2.06 m wide, broad piers between the groups, corner piers 1.83 m: it was nine equal bays of
// 3 m arches); the centre of the quad front breaking forward under the pediment; the Hall and Chapel 0.3 m above the
// loggia, reached by timber-railed ramps along its back wall; a gate HALL (a vaulted room with a doorway at each end)
// where an open 3.4 m passage was; the street front's centre in THREE bays with round-headed ground-floor windows and
// its attic, small pediment and pale clock; the Venetian windows and the wings' side windows where the photographs
// have them; the gate screen forward, almost in line with the wings' street faces.
import * as THREE from 'three';
import { WORC_BLOCK as BLK } from './_worcester_shared.js';
import { frame, rectPts, archPts } from './_worcester_kit.js';

const r4 = (x) => +x.toFixed(4);

/** recess depths of what is painted outside at each walk-in opening (the rooms punch their openings inside them) */
export const BLOCK_OPENINGS = {
  door: { recess: 0.25 },                 // Chapel / Hall doors in the loggia's back wall (leaf 0.25 m in from its west face)
  side: { recess: 0.32 },                 // the wings' tall side windows
  east: { recess: 0.3 },                  // the Venetian windows
  lodgeDoor: { w: 1.25, spring: 2.1, recess: 0.2 },      // gate hall, north wall, at lodge.doorU
  libDoor: { w: 0.98, h: 2.33, recess: 0.1 },            // gate hall, south wall, at lodge.doorU
  gw: { recess: 0.25 },                   // the street front's two round-headed ground-floor windows
  lib: { recess: 0.25, archRecess: 0.3 }, // the Library's windows on the quad front
  endWall: 0.9,                           // the loggia's end walls
};

// the ramps along the loggia's back wall up to the Chapel and Hall doors: a landing at the door, a ramp falling
// towards the gate, a step on the landing's west side
const RAMP = { w: 1.4, land: 0.95, len: 3.0, step: 0.3 };
/** the Cellar Bar's four pavement lights (local [u0, u1, v0, v1]): two at the foot of the Hall's north wall in the
 *  forecourt, two at the foot of its east end on Walton Street's pavement (K: fire plan; the bar's room has a lit
 *  pane under each: _bar_plan.js) */
export const BAR_LIGHTS = [[24.07, 24.80, 7.6, 8.05], [16.71, 17.37, 7.6, 8.05], [28.0, 28.45, 15.97, 16.91], [28.0, 28.45, 14.77, 15.38]];
export const BLOCK_RAMPS = ['chapel', 'hall'].map((k) => {
  const d = BLK.doorV[k], sg = k === 'chapel' ? 1 : -1;      // the ramp runs towards the axis
  return { k, d, sg, u0: r4(BLK.uB - RAMP.w), u1: BLK.uB, l0: r4(d - RAMP.land), l1: r4(d + RAMP.land), r0: r4(d + sg * RAMP.land), r1: r4(d + sg * (RAMP.land + RAMP.len)) };
});

/** the block's own walking heights at local (u, v): the loggia, its ramps, the gate hall, the doorways; null outside. T: a paving stone. */
export function blockGround(u, v, T) {
  const G = BLK.gate, R = BLK.roomRise;
  if (u >= BLK.uW && u < BLK.uB && v > BLK.vN && v < BLK.vS) {
    for (const q of BLOCK_RAMPS) {
      if (u >= q.u0) {
        if (v > q.l0 && v < q.l1) return T + R;
        const t = (v - q.r0) / (q.r1 - q.r0);
        if (t >= 0 && t < 1) return T + R * (1 - t);
      } else if (u >= q.u0 - RAMP.step && v > q.l0 && v < q.l1) return T + R / 2;
    }
    return T;
  }
  // the Chapel and Hall doorways through the back wall (and a little way in: the rooms' own floors take over)
  if (u >= BLK.uB && u < BLK.uR + 0.8) for (const q of BLOCK_RAMPS) if (Math.abs(v - q.d) < BLK.door.w / 2 + 0.15) return T + R;
  // the gate hall and its two doorways
  if (u >= BLK.uB && u < BLK.uC + 0.05 && v > G.v0 - 0.05 && v < G.v1 + 0.05) return T;
  return null;
}

/** a groin vault over a rectangular bay, seen from below: springing ys at the four corners, crown yc */
function groinVault(B, key, u0, u1, v0, v1, ys, yc, n = 6) {
  const hu = (u) => { const t = (2 * u - u0 - u1) / (u1 - u0); return ys + (yc - ys) * Math.sqrt(Math.max(0, 1 - t * t)); };
  const hv = (v) => { const t = (2 * v - v0 - v1) / (v1 - v0); return ys + (yc - ys) * Math.sqrt(Math.max(0, 1 - t * t)); };
  const P = (i, j) => { const u = u0 + ((u1 - u0) * i) / n, v = v0 + ((v1 - v0) * j) / n; return [u, Math.max(hu(u), hv(v)), v]; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    // (split along the diagonal that runs with the groin in this quadrant)
    if ((i < n / 2) === (j < n / 2)) { B.poly(key, [a, b, c], [0, -1, 0]); B.poly(key, [a, c, d], [0, -1, 0]); } else { B.poly(key, [a, b, d], [0, -1, 0]); B.poly(key, [b, c, d], [0, -1, 0]); }
  }
}

/**
 * K: { B, atlas, wall, outline, pediment, dentils, railRun, grille, lantern, seg, pl, boxC, T, PQY, PIT, yFoot }
 * -> { lamps: [[u, v, y]] } (where the hanging lanterns glow)
 */
export function buildMainBlock(K) {
  const { B, atlas, wall, outline, pediment, dentils, railRun, grille, lantern, seg, pl, boxC, T, PQY, PIT } = K;
  const { uW, uE, uA, uB, uR, uC, vN, vS, vCs, vHn, axis, L } = BLK, Y = BLK.y, A = BLK.arcade, G = BLK.gate, RISE = BLK.roomRise;
  const HCM = Y.cornice, HCT = Y.corniceTop, AW = A.w, AR = AW / 2, AS = A.spring;
  const EW_ = BLOCK_OPENINGS.endWall, lamps = [];
  const sQ = (v) => v - vN;                      // along the quad front from its north end

  /** hipped roof on a rectangle (ridge along the longer side) */
  function hipRoof(key, x0, x1, z0, z1, y, pitch) {
    const w = x1 - x0, d = z1 - z0, tn = Math.tan(pitch);
    if (w >= d) {
      const r = (d / 2) * tn, zc = (z0 + z1) / 2, xa = x0 + d / 2, xb = x1 - d / 2;
      B.poly(key, [[x0, y, z1], [x1, y, z1], [xb, y + r, zc], [xa, y + r, zc]], [0, 1, 1]); B.poly(key, [[x1, y, z0], [x0, y, z0], [xa, y + r, zc], [xb, y + r, zc]], [0, 1, -1]);
      B.poly(key, [[x1, y, z1], [x1, y, z0], [xb, y + r, zc]], [1, 1, 0]); B.poly(key, [[x0, y, z0], [x0, y, z1], [xa, y + r, zc]], [-1, 1, 0]);
    } else {
      const r = (w / 2) * tn, xc = (x0 + x1) / 2, za = z0 + w / 2, zb = z1 - w / 2;
      B.poly(key, [[x1, y, z0], [x1, y, z1], [xc, y + r, zb], [xc, y + r, za]], [1, 1, 0]); B.poly(key, [[x0, y, z1], [x0, y, z0], [xc, y + r, za], [xc, y + r, zb]], [-1, 1, 0]);
      B.poly(key, [[x0, y, z1], [x1, y, z1], [xc, y + r, zb]], [0, 1, 1]); B.poly(key, [[x1, y, z0], [x0, y, z0], [xc, y + r, za]], [0, 1, -1]);
    }
  }
  /** the modillion cornice (bed mould BO out, corona CO out: the 2025 photograph of the Hall wing's end, where the
   *  corona stands about 0.9 m out on scrolled brackets) and the blocking course behind it, round a rectangle */
  const CO = 0.9, BO = 0.25;
  /** the brackets under the corona along a face (current frame; a0 / a1: left clear at an inner corner) */
  const modillions = (L, a0 = 0, a1 = 0) => { const n = Math.max(1, Math.round(L / 0.62)); for (let i = 0; i < n; i++) { const x = (L * (i + 0.5)) / n; if (x < a0 || x > L - a1) continue; B.box('stoneDress', x, HCM + 0.17, (BO + CO - 0.06) / 2, 0.28, 0.26, CO - 0.06 - BO, 0, { top: false }); } };
  function cornice(x0, x1, z0, z1, sides = 'nsew') {
    const y = HCM, m = HCM + 0.3;
    B.boxXZ('stoneDress', x0 - BO, x1 + BO, y, m, z0 - BO, z1 + BO, { bottom: true });
    B.boxXZ('stoneDress', x0 - CO, x1 + CO, m, HCT, z0 - CO, z1 + CO, { bottom: true });
    const t = 0.4, h0 = HCT, h1 = HCT + 0.45;
    if (sides.includes('n')) B.boxXZ('stoneDress', x0 - 0.1, x1 + 0.1, h0, h1, z0 - 0.1, z0 - 0.1 + t);
    if (sides.includes('s')) B.boxXZ('stoneDress', x0 - 0.1, x1 + 0.1, h0, h1, z1 + 0.1 - t, z1 + 0.1);
  }
  /** a round arch's dressings on a wall face (current frame): archivolt band, keystone */
  const archivolt = (c, ys, r, band = 0.26, z = 0.035, skipKey = false) => {
    const q = (a, rr) => [c + Math.cos(a) * rr, ys + Math.sin(a) * rr, z];
    for (let k = 0; k < 12; k++) { const a0 = (k / 12) * Math.PI, a1 = ((k + 1) / 12) * Math.PI; if (!skipKey && (k === 5 || k === 6)) continue; B.poly('stoneDress', [q(a0, r), q(a0, r + band), q(a1, r + band), q(a1, r)], [0, 0, 1]); }
    if (!skipKey) B.box('stoneDress', c, ys + r + 0.08, z + 0.03, 0.36, 0.5, 0.14);
  };

  // ================================================================= the quad front
  {
    const b0 = sQ(A.breakV[0]), b1 = sQ(A.breakV[1]), OUT = A.breakOut;
    const edges = A.v.map((v) => [sQ(v) - AR, sQ(v) + AR]);
    // the piers' faces between the arches (and at the ends): [s0, s1]
    const piers = [[0, edges[0][0]]]; for (let i = 0; i < 8; i++) piers.push([edges[i][1], edges[i + 1][0]]); piers.push([edges[8][1], L]);
    const part = (s0, s1, out, key) => {
      const F = frame(uW - out, 0, vN + s0, 0, 1), len = s1 - s0, ops = [], cs = [];
      A.v.forEach((v, i) => {
        const s = sQ(v); if (s < s0 || s > s1) return; const sc = s - s0; cs.push([sc, i]);
        ops.push({ pts: archPts(sc, AW, T - 0.02, AS, 12), d: BLK.pier + out, kind: 'void', revealKey: 'stoneLit' });
        if (i >= 3 && i <= 5) ops.push({ pts: archPts(sc, Y.libArch.w, Y.libSill, Y.libArch.spring, 12), d: BLOCK_OPENINGS.lib.archRecess, kind: 'win', spring: Y.libArch.spring, seed: i, sill: false });
        else ops.push({ pts: rectPts(sc - Y.libW / 2, Y.libSill, sc + Y.libW / 2, Y.libHead), d: BLOCK_OPENINGS.lib.recess, kind: 'win', seed: i, sill: false });      // (sill: the band below is their sill)
      });
      wall(B, F, outline(0, len, K.yFoot, HCM), ops, key);
      B.push(F);
      B.box('stone', len / 2, (Y.string[0] + Y.string[1]) / 2, 0.06, len, Y.string[1] - Y.string[0], 0.16);      // string course over the arcade
      B.box('stone', len / 2, Y.libSill - 0.08, 0.06, len, 0.16, 0.12);                                          // the Library windows' sill band
      for (const [a, b] of piers) {      // plinth and impost block on every pier
        const p0 = Math.max(a, s0), p1 = Math.min(b, s1); if (p1 - p0 < 0.05) continue;
        B.box('stone', (p0 + p1) / 2 - s0, T + 0.2, 0.04, p1 - p0, 0.4, 0.1); B.box('stoneDress', (p0 + p1) / 2 - s0, AS, 0.05, p1 - p0, 0.22, 0.12);
      }
      for (const [sc, i] of cs) {
        archivolt(sc, AS, AR);
        if (i < 3 || i > 5) B.box('stoneDress', sc, Y.hood, 0.08, Y.libW + 0.6, 0.2, 0.2);      // cornice hoods over the six square-headed windows
        else archivolt(sc, Y.libArch.spring, Y.libArch.w / 2, 0.22, 0.03);
      }
      modillions(len);
      B.pop();
      return F;
    };
    part(0, b0, 0, 'stoneIvyM'); part(b1, L, 0, 'stone');      // (the creeper: on the north third of the arcade storey, as in the 2011 and 2014 photographs)
    const Fc = part(b0, b1, OUT, 'stone');
    // the centre's returns, its pilasters between the three round-headed windows, the pediment and its clock
    for (const [s, n] of [[b0, -1], [b1, 1]]) B.poly('stone', [[uW - OUT, K.yFoot, vN + s], [uW, K.yFoot, vN + s], [uW, HCM, vN + s], [uW - OUT, HCM, vN + s]], [0, 0, n]);
    B.push(Fc);
    for (const d of [-4.95, -1.65, 1.65, 4.95]) B.box('stoneDress', (b1 - b0) / 2 + d, (Y.string[1] + HCM - 0.3) / 2, 0.06, 0.5, HCM - 0.3 - Y.string[1], 0.14);
    B.pop();
    pediment(B, Fc, 0, b1 - b0, HCT, Y.apexW - HCT, 'slate');
    B.push(Fc); B.sign('signs', (b1 - b0) / 2 - 0.85, HCT + 0.55, (b1 - b0) / 2 + 0.85, HCT + 2.25, 0.15, atlas.uv('clock')); B.pop();
    // the arcade's inner face (seen from inside the loggia)
    const opsI = A.v.map((v) => ({ pts: archPts(vS - v, AW, T, AS, 12), d: 0.01, kind: 'none', notch: true }));
    wall(B, frame(uA, 0, vS, 0, -1), outline(0, L, T, Y.vault, opsI.map((o) => o.pts)), opsI, 'stoneLit');
    // colliders: the piers
    for (const [a, b] of piers) boxC(uW, uA, vN + a, vN + b);
  }

  // ================================================================= the loggia: back wall, ends, vault, floor, ramps
  {
    const Fb = frame(uB, 0, vN, 0, 1), sA = sQ(axis), sC = sQ(BLK.doorV.chapel), sH = sQ(BLK.doorV.hall), D = BLK.door, yd = T + RISE;
    const opsB = [
      { pts: archPts(sA, G.wDoor.w, T, G.wDoor.spring, 12), d: BLK.back, kind: 'void', notch: true },      // into the gate hall
      // (the walk-in rooms' doorways are punched INSIDE these arched recesses: _worcint_hall_plan.js)
      { pts: archPts(sC, D.w, yd, yd + D.spring, 12), d: BLOCK_OPENINGS.door.recess, kind: 'door', doorKey: 'oak', spring: yd + D.spring },
      { pts: archPts(sH, D.w, yd, yd + D.spring, 12), d: BLOCK_OPENINGS.door.recess, kind: 'door', doorKey: 'oak', spring: yd + D.spring },
    ];
    wall(B, Fb, outline(0, L, T, Y.vault, [opsB[0].pts]), opsB, 'stoneLit');
    B.push(Fb);
    for (const s of [sC, sH]) {      // door-cases: jambs to the springing, impost blocks, an archivolt, a keystone
      for (const sx of [-1, 1]) { B.box('stone', s + sx * (D.w / 2 + 0.13), yd + D.spring / 2, 0.04, 0.24, D.spring, 0.08); B.box('stoneDress', s + sx * (D.w / 2 + 0.13), yd + D.spring, 0.05, 0.34, 0.14, 0.1); }
      archivolt(s, yd + D.spring, D.w / 2 + 0.01, 0.24, 0.04, true); B.box('stoneDress', s, yd + D.spring + D.w / 2 + 0.2, 0.05, 0.3, 0.42, 0.1);
    }
    archivolt(sA, G.wDoor.spring, G.wDoor.w / 2, 0.24, 0.035);
    // war memorials on the back wall: WWI by the Chapel door, WWII by the Hall door (over the ramps); a notice board
    B.sign('signs', sC + 1.5, T + 1.2, sC + 2.6, T + 3.4, 0.03, atlas.uv('ww1'));
    B.sign('signs', sH - 2.6, T + 1.2, sH - 1.5, T + 3.4, 0.03, atlas.uv('ww2'));
    B.sign('signs', sA + 3.4, T + 1.0, sA + 5.2, T + 1.9, 0.03, atlas.uv('noticeBoard'));
    B.pop();
    // the ends: the north one blind, the south one a round arch looking over Pump Quad with an iron balustrade
    // across its foot (the college's photograph from above; the Hall Wine Cellar's stair lies below it: the fire plan)
    wall(B, frame(uA, 0, vN + EW_, 1, 0), outline(0, BLK.loggia, T, Y.vault), [], 'stoneLit');
    const SA = BLK.southArch;
    wall(B, frame(uB, 0, vS - EW_, -1, 0), outline(0, BLK.loggia, T, Y.vault, [archPts(uB - SA.u, SA.w, T, T + SA.spring)]), [{ pts: archPts(uB - SA.u, SA.w, T, T + SA.spring), d: EW_ / 2, kind: 'void', notch: true }], 'stoneLit');
    railRun(B, [SA.u - SA.w / 2, vS - EW_ / 2], [SA.u + SA.w / 2, vS - EW_ / 2], T, T + 1.05);
    seg(uA, vS - EW_, uB, vS - EW_); seg(uA, vN + EW_, uB, vN + EW_);
    // the groin vault: a bay to every arch
    const cut = [vN + EW_]; for (let i = 0; i < 8; i++) cut.push((A.v[i] + A.v[i + 1]) / 2); cut.push(vS - EW_);
    for (let i = 0; i < 9; i++) groinVault(B, 'stoneLit', uA, uB, cut[i], cut[i + 1], AS + 0.1, Y.vault, 6);
    // bracket lanterns on the back wall (the college's photograph looking south)
    for (const dv of [-14.2, -5.6, 5.6, 14.2]) lantern(B, uB, T + 2.5, axis + dv, -1, 0, 0.5);
    // floor: stone flags, out to the arcade's face
    B.boxXZ('pavingLit', uW + 0.015, uB, 0, T, vN + 0.02, vS - EW_ / 2);      // (to the middle of the south end wall: the arch's own sill is the floor in its outer half)
    // the ramps to the Chapel and Hall doors (the college: "via ramp or stairs"; timber rails in its photograph)
    for (const q of BLOCK_RAMPS) {
      const yl = T + RISE, a = Math.min(q.l0, q.l1), b = Math.max(q.l0, q.l1), far = q.sg > 0 ? a : b;
      B.boxXZ('pavingLit', q.u0, q.u1 - 0.005, T, yl, a, b);                                                            // the landing
      B.poly('pavingLit', [[q.u0, yl, q.r0], [q.u1 - 0.005, yl, q.r0], [q.u1 - 0.005, T + 0.002, q.r1], [q.u0, T + 0.002, q.r1]], [0, 1, 0]);      // the ramp
      B.poly('stoneLit', [[q.u0, T, q.r0], [q.u0, yl, q.r0], [q.u0, T, q.r1]], [-1, 0, 0]);                              // its open side
      B.boxXZ('pavingLit', q.u0 - RAMP.step, q.u0, T, T + RISE / 2, a, b);                                               // the step on the landing's west side
      // timber rail along the ramp's open side and across the landing's far end
      const rail = (p, q2) => { for (const h of [0.5, 0.95]) B.beam('oak', [p[0], p[1] + h, p[2]], [q2[0], q2[1] + h, q2[2]], 0.06, 0.08); for (const e of [p, q2]) B.box('oak', e[0], e[1] + 0.5, e[2], 0.08, 1.0, 0.08, 0, { top: true }); };
      rail([q.u0 + 0.04, yl, q.r0 + q.sg * 0.05], [q.u0 + 0.04, T, q.r1 - q.sg * 0.05]);
      rail([q.u0 + 0.04, yl, far + q.sg * 0.04], [q.u1 - 0.1, yl, far + q.sg * 0.04]);
      seg(q.u0 + 0.04, q.r0, q.u0 + 0.04, q.r1, 'railing'); seg(q.u0 + 0.04, far, q.u1, far, 'railing');
    }
  }

  // ================================================================= the gate hall through the centre
  {
    const u0 = G.u0, u1 = G.u1, v0 = G.v0, v1 = G.v1, LD = BLOCK_OPENINGS.lodgeDoor, LB = BLOCK_OPENINGS.libDoor, du = BLK.lodge.doorU;
    // north wall (the Porters' Lodge): a round-headed doorway, its tympanum lettered, glazed notice boards either side
    const Fn = frame(u0, 0, v0, 1, 0), sd = du - u0;
    wall(B, Fn, outline(0, u1 - u0, T, G.vault, [archPts(sd, LD.w, T, T + LD.spring, 10)]), [{ pts: archPts(sd, LD.w, T, T + LD.spring, 10), d: LD.recess, kind: 'door', spring: T + LD.spring, notch: true }], 'stoneLit');
    B.push(Fn);
    B.sign('signs', sd - 0.5, T + LD.spring + 0.05, sd + 0.5, T + LD.spring + 0.3, -LD.recess + 0.035, atlas.uv('lodge'));
    for (const [a, b] of [[0.2, sd - LD.w / 2 - 0.25], [sd + LD.w / 2 + 0.25, u1 - u0 - 0.2]]) { B.box('oak', (a + b) / 2, T + 1.7, 0.03, b - a, 1.1, 0.06); B.sign('signs', a + 0.08, T + 1.23, b - 0.08, T + 2.17, 0.072, atlas.uv('noticeBoard')); }
    B.pop();
    // south wall: the Library's door, directly opposite the Lodge's (the owner), the foot of the spiral stair
    const Fs = frame(u1, 0, v1, -1, 0), ss = u1 - du;
    wall(B, Fs, outline(0, u1 - u0, T, G.vault, [rectPts(ss - LB.w / 2, T, ss + LB.w / 2, LB.h)]), [{ pts: rectPts(ss - LB.w / 2, T, ss + LB.w / 2, LB.h), d: LB.recess, kind: 'door', notch: true, doorKey: 'oak' }], 'stoneLit');
    // the two end walls' inner faces, with their doorways
    const hw = (v1 - v0) / 2;
    wall(B, frame(u0, 0, v1, 0, -1), outline(0, v1 - v0, T, G.vault, [archPts(hw, G.wDoor.w, T, G.wDoor.spring, 12)]), [{ pts: archPts(hw, G.wDoor.w, T, G.wDoor.spring, 12), d: 0.01, kind: 'none', notch: true }], 'stoneLit');
    wall(B, frame(u1, 0, v0, 0, 1), outline(0, v1 - v0, T, G.vault, [archPts(hw, G.eDoor.w, T, G.eDoor.spring, 12)]), [{ pts: archPts(hw, G.eDoor.w, T, G.eDoor.spring, 12), d: 0.01, kind: 'none', notch: true }], 'stoneLit');
    groinVault(B, 'stoneLit', u0, u1, v0, v1, 3.0, G.vault, 6);
    // floor (flags, level from the street to the loggia: the owner), and the thresholds of its two doorways
    B.boxXZ('pavingLit', u0, u1, 0, T, v0, v1);
    B.boxXZ('pavingLit', uB + 0.005, u0, 0, T, axis - G.wDoor.w / 2, axis + G.wDoor.w / 2); B.boxXZ('pavingLit', u1, uC - 0.03, 0, T, axis - G.eDoor.w / 2, axis + G.eDoor.w / 2);
    // the street doors folded back against the hall's east wall; a hanging lantern
    for (const sg of [-1, 1]) B.box('oak', u1 - 0.06, T + G.eDoor.spring / 2, axis + sg * (G.eDoor.w / 2 + 0.43), 0.08, G.eDoor.spring, 0.82);
    { const u = (u0 + u1) / 2, y = G.vault - 1.25; B.box('iron', u, y + 0.75, axis, 0.03, 1.0, 0.03, 0, { top: false }); B.box('iron', u, y + 0.25, axis, 0.34, 0.04, 0.34); B.box('lampGlass', u, y, axis, 0.26, 0.44, 0.26, 0, { top: false }); B.box('iron', u, y - 0.24, axis, 0.28, 0.04, 0.28, 0, { bottom: true }); lamps.push([u, axis, y]); }
  }

  // ================================================================= the street front's recessed centre: three bays
  {
    const F = frame(uC, 0, vHn, 0, -1), Lc = vHn - vCs, E = BLK.east, sA = vHn - axis, sb = E.bays.map((v) => vHn - v);
    const door = archPts(sA, G.eDoor.w, 0, G.eDoor.spring, 12);
    const ops = [{ pts: door, d: uC - G.u1, kind: 'void', notch: true, revealKey: 'stoneLit' }];
    for (const i of [0, 2]) ops.push({ pts: archPts(sb[i], E.gw.w, E.gw.sill, E.gw.spring, 12), d: BLOCK_OPENINGS.gw.recess, kind: 'win', spring: E.gw.spring, seed: 20 + i, sill: false, ...(i === 0 ? { lit: true } : {}) });      // (north: the Porters' Lodge; south: the Library stair)
    for (const s of sb) {
      ops.push({ pts: rectPts(s - E.f1.w / 2, E.f1.y0, s + E.f1.w / 2, E.f1.y1), kind: 'win', seed: 30 + s });
      ops.push({ pts: rectPts(s - E.f2.w / 2, E.f2.y0, s + E.f2.w / 2, E.f2.y1), kind: 'win', seed: 40 + s, rows: 2 });
    }
    wall(B, F, outline(0, Lc, 0, HCM, [door]), ops, 'stoneOld');      // (the recessed centre is browner and streaked: 2025 photograph)
    B.push(F);
    B.box('stone', Lc / 2, E.band - 0.3, 0.06, Lc, 0.2, 0.14); B.box('stone', Lc / 2, E.band, 0.08, Lc, 0.22, 0.18);      // the bands over the ground storey
    for (const [a, b] of [[0, sA - 1.2], [sA + 1.2, Lc]]) B.box('stone', (a + b) / 2, 0.3, 0.05, b - a, 0.6, 0.1);        // plinth either side of the doorway
    archivolt(sA, G.eDoor.spring, G.eDoor.w / 2, 0.26, 0.04);
    for (const i of [0, 2]) { archivolt(sb[i], E.gw.spring, E.gw.w / 2, 0.2, 0.035, true); B.box('stoneDress', sb[i], E.gw.sill - 0.08, 0.08, E.gw.w + 0.3, 0.16, 0.16); }
    for (const s of sb) {      // architraves: a cornice over each first-floor window, a sill under both
      B.box('stoneDress', s, E.f1.y1 + 0.24, 0.06, E.f1.w + 0.5, 0.18, 0.14);
      for (const sx of [-1, 1]) { B.box('stoneDress', s + sx * (E.f1.w / 2 + 0.09), (E.f1.y0 + E.f1.y1) / 2, 0.035, 0.16, E.f1.y1 - E.f1.y0, 0.07); B.box('stoneDress', s + sx * (E.f2.w / 2 + 0.09), (E.f2.y0 + E.f2.y1) / 2, 0.035, 0.16, E.f2.y1 - E.f2.y0, 0.07); }
      B.box('stoneDress', s, E.f2.y1 + 0.08, 0.035, E.f2.w + 0.34, 0.16, 0.07);
    }
    // the radial fanlight over the doorway (the doors themselves stand open inside)
    { const z = -(uC - G.u1) + 0.25, r = G.eDoor.w / 2, fan = [[sA - r, G.eDoor.spring]]; for (let k = 0; k <= 10; k++) { const a = Math.PI - (k / 10) * Math.PI; fan.push([sA + Math.cos(a) * r, G.eDoor.spring + Math.sin(a) * r]); }
      B.face('glassDark', fan, [], z); B.box('white', sA, G.eDoor.spring, z + 0.02, G.eDoor.w, 0.09, 0.07);
      for (let k = 1; k < 6; k++) { const a = (k / 6) * Math.PI; B.beam('white', [sA, G.eDoor.spring + 0.02, z + 0.02], [sA + Math.cos(a) * (r - 0.02), G.eDoor.spring + Math.sin(a) * (r - 0.02), z + 0.02], 0.035); } }
    modillions(Lc, 1.0, 1.0);
    // the attic over the cornice: a blocking course with panelled piers and swept sides, a small pediment, the clock
    // (pale blue-grey with gilt figures: the 2025 photograph)
    const AT = { hw: 3.4, y0: HCT + 0.45, y1: HCT + 1.9, back: -0.9 };
    B.boxXZ('stone', sA - AT.hw, sA + AT.hw, AT.y0, AT.y1, AT.back, -0.12);
    for (const d of [-AT.hw + 0.3, -1.25, 1.25, AT.hw - 0.3]) B.box('stoneDress', sA + d, (AT.y0 + AT.y1) / 2, -0.07, 0.5, AT.y1 - AT.y0, 0.14);
    B.box('stoneDress', sA, AT.y1 + 0.07, -0.5, AT.hw * 2 + 0.3, 0.14, 1.0);
    for (const sg of [-1, 1]) {      // the swept sides: concave ramps down to the blocking course
      const x0 = sA + sg * AT.hw, pts = [[x0, AT.y0], [x0 + sg * 2.2, AT.y0], [x0 + sg * 1.0, AT.y0 + 0.3], [x0 + sg * 0.35, AT.y0 + 0.8], [x0, AT.y1]];
      B.face('stone', sg > 0 ? pts : pts.slice().reverse(), [], -0.2); B.face('stone', sg > 0 ? pts : pts.slice().reverse(), [], AT.back + 0.1, true);
    }
    B.pop();
    pediment(B, frame(uC - 0.12, 0, vHn, 0, -1), sA - AT.hw, sA + AT.hw, AT.y1 + 0.14, 1.15, 'slate');
    B.push(F); B.sign('signs', sA - 0.75, AT.y0 + 0.2, sA + 0.75, AT.y0 + 1.7, 0.02, atlas.uv('clockPale')); B.pop();
    B.cyl('white', uC - 2.6, HCT + 1.0, axis, 0.045, 6.4, 6, true);      // the flagpole
  }

  // ================================================================= the wings: street ends, forecourt sides, outer sides
  {
    const V = BLK.venetian, S = BLK.side;
    // street ends: one Venetian window at main-floor level (balustraded apron, four pilasters, entablatures over the
    // side lights, an archivolt), a wreath roundel with swags over it, one small attic sash
    for (const [vEnd, wing] of [[vCs, 'chapel'], [vS, 'hall']]) {
      const F = frame(uE, 0, vEnd, 0, -1), Lw = BLK.wing, c = Lw / 2;
      // (the Chapel's glass is leaded, painted glass: dark lead lights from far off; near to, the walk-in rooms' real
      //  windows are punched inside these recesses — _worcint_hall_plan.js)
      const lead = wing === 'chapel' ? { mullion: 1, lit: false } : {};
      const ops = [
        { pts: archPts(c, V.cw, V.sill, V.spring, 12), kind: 'win', spring: V.spring, d: BLOCK_OPENINGS.east.recess, seed: wing.length, ...lead },
        { pts: rectPts(c - V.sideOut, V.sill, c - V.sideIn, V.sideTop), kind: 'win', d: BLOCK_OPENINGS.east.recess, seed: 2, ...lead },
        { pts: rectPts(c + V.sideIn, V.sill, c + V.sideOut, V.sideTop), kind: 'win', d: BLOCK_OPENINGS.east.recess, seed: 3, ...lead },
        { pts: rectPts(c - S.attic.w / 2, S.attic.y0, c + S.attic.w / 2, S.attic.y1), kind: 'win', seed: 4, rows: 2, sill: false },
      ];
      wall(B, F, outline(0, Lw, 0, HCM), ops);
      B.push(F);
      B.box('stoneDress', Lw / 2, 2.78, 0.09, Lw + 0.1, 0.3, 0.2);                             // the plat band over the channelled base
      // channelled masonry up to the band: five courses with open joints between them (darker, weathered: the photograph)
      for (let k = 0; k < 5; k++) B.box('stoneBase', c, 0.5 + k * 0.45, 0.008, Lw - 1.22, 0.4, 0.036, 0, { bottom: true });
      for (const x of [0.3, Lw - 0.3]) for (let k = 0; k < 5; k++) B.box('stoneBase', x, 0.5 + k * 0.45, 0.05, k % 2 ? 0.62 : 0.5, 0.4, 0.04, 0, { bottom: true });      // long-and-short quoins at the angles of the base      // (shallow: 9 cm courses read as a flight of steps)
      // the balustrade across the foot of the window: a ledge, a rail, dies at the ends and the middle, balusters between
      { const bw = V.sideOut * 2 + 0.6, y0 = V.sill - 0.62, y1 = V.sill - 0.06, ym = (y0 + y1) / 2, hb = y1 - y0 - 0.12;
        B.box('stoneDress', c, y0, 0.3, bw + 0.3, 0.12, 0.3, 0, { bottom: true }); B.box('stoneDress', c, y1, 0.3, bw + 0.3, 0.12, 0.26, 0, { bottom: true });
        for (const sx of [-1, 0, 1]) B.box('stoneDress', c + sx * bw / 2, ym, 0.3, sx ? 0.3 : 0.22, hb, 0.24, 0, { top: false });
        for (let i = 0; i < 12; i++) { if (i === 5 || i === 6) continue; B.box('stoneDress', c - bw / 2 + (bw * (i + 0.5)) / 12, ym, 0.3, 0.13, hb, 0.13, 0, { top: false }); }
        B.box('stoneDress', c, y0 - 0.25, 0.08, bw + 0.3, 0.38, 0.16, 0, { bottom: true }); }      // the apron wall behind and below it
      for (const sx of [-1, 1]) {
        for (const x of [(V.sideIn + V.cw / 2) / 2, V.sideOut + 0.16]) B.box('stoneDress', c + sx * x, (V.sill + V.sideTop) / 2, 0.08, 0.26, V.sideTop - V.sill, 0.16);      // pilasters
        B.box('stoneDress', c + sx * (V.sideIn + V.sideOut) / 2, V.sideTop + 0.2, 0.1, V.sideOut - V.sideIn + 0.7, 0.4, 0.22);      // entablature over each side light
      }
      archivolt(c, V.spring, V.cw / 2, 0.24, 0.06, true);
      // the roundel and its swags
      { const yr = V.spring + V.cw / 2 + 1.25, q = (a, rr) => [c + Math.cos(a) * rr, yr + Math.sin(a) * rr, 0.05]; for (let k = 0; k < 12; k++) { const a0 = (k / 12) * Math.PI * 2, a1 = ((k + 1) / 12) * Math.PI * 2; B.poly('stoneDress', [q(a0, 0.3), q(a0, 0.5), q(a1, 0.5), q(a1, 0.3)], [0, 0, 1]); }
        for (const sx of [-1, 1]) { B.beam('stoneDress', [c + sx * 0.5, yr, 0.05], [c + sx * 1.15, yr - 0.32, 0.05], 0.1); B.beam('stoneDress', [c + sx * 1.15, yr - 0.32, 0.05], [c + sx * 1.6, yr + 0.05, 0.05], 0.1); } }
      B.box('stoneDress', c, S.attic.y0 - 0.08, 0.06, S.attic.w + 0.5, 0.16, 0.12);
      { const aw = S.attic.w, ym = (S.attic.y0 + S.attic.y1) / 2, ah = S.attic.y1 - S.attic.y0;      // the attic window's moulded frame with ears at its head
        for (const sx of [-1, 1]) B.box('stoneDress', c + sx * (aw / 2 + 0.09), ym, 0.04, 0.18, ah, 0.08);
        B.box('stoneDress', c, S.attic.y1 + 0.09, 0.05, aw + 0.56, 0.18, 0.1); }
      { const yr = V.spring + V.cw / 2 + 1.25;      // under the roundel a scrolled keystone; the festoons hang from bows, with drops
        B.box('stoneDress', c, yr - 0.62, 0.09, 0.3, 0.42, 0.18);
        for (const sx of [-1, 1]) { B.box('stoneDress', c + sx * 1.6, yr + 0.1, 0.07, 0.3, 0.22, 0.12); B.beam('stoneDress', [c + sx * 1.6, yr, 0.05], [c + sx * 1.6, yr - 0.75, 0.05], 0.1); } }
      B.box('stone', 0.3, HCM / 2, 0.04, 0.6, HCM, 0.08); B.box('stone', Lw - 0.3, HCM / 2, 0.04, 0.6, HCM, 0.08);      // the angles
      modillions(Lw);
      B.pop();
    }
    // forecourt sides (Chapel south, Hall north): three tall windows where the venue plan has them, three small
    // square ones above. The Cellar Bar under the Hall is lit by PAVEMENT LIGHTS, not by windows in the wall: iron
    // gratings in the ground at the foot of its north and east walls (the fire plan draws all four wells)
    const us = S.fromEast.map((f) => BLK.uRe - f);
    for (const [F, hall, sOf] of [[frame(uC, 0, vCs, 1, 0), false, (u) => u - uC], [frame(uE, 0, vHn, -1, 0), true, (u) => uE - u]]) {
      const Ls = uE - uC, ops = [];
      for (const u of us) {
        const sc = sOf(u);
        ops.push({ pts: rectPts(sc - S.w / 2, S.y0, sc + S.w / 2, S.y1), kind: 'win', d: BLOCK_OPENINGS.side.recess, cols: 3, rows: 6, seed: 50 + sc + (hall ? 9 : 0), ...(hall ? {} : { mullion: 1, lit: false }) });
        ops.push({ pts: rectPts(sc - S.attic.w / 2, S.attic.y0, sc + S.attic.w / 2, S.attic.y1), kind: 'win', seed: 70 + sc, rows: 2 });
      }
      wall(B, F, outline(0, Ls, 0, HCM), ops);
      B.push(F); B.box('stoneDress', Ls / 2, 2.78, 0.09, Ls, 0.3, 0.2);
      for (let k = 0; k < 5; k++) B.box('stoneBase', Ls / 2, 0.5 + k * 0.45, 0.008, Ls - 0.1, 0.4, 0.036, 0, { bottom: true });      // the base's dark channelled courses carried round
      if (hall) modillions(Ls, 0, 1.0); else modillions(Ls, 1.0, 0);
      B.pop();
    }
    for (const [u0, u1, v0, v1] of BAR_LIGHTS) {
      B.boxXZ('stoneDress', u0 - 0.08, u1 + 0.08, 0, T + 0.012, v0 - 0.08, v1 + 0.08); B.boxXZ('dark', u0, u1, 0, T + 0.02, v0, v1);
      const along = u1 - u0 > v1 - v0, n = Math.max(2, Math.round((along ? u1 - u0 : v1 - v0) / 0.16));
      for (let k = 1; k < n; k++) { const q = (along ? u0 : v0) + ((along ? u1 - u0 : v1 - v0) * k) / n; if (along) B.boxXZ('grey', q - 0.02, q + 0.02, T + 0.02, T + 0.032, v0, v1); else B.boxXZ('grey', u0, u1, T + 0.02, T + 0.032, q - 0.02, q + 0.02); }
    }
    // the Chapel's north side: the same three windows (1939 plan), on the slip against the Senior Common Room range
    {
      const F = frame(uE, 0, vN, -1, 0), Ln = uE - uW, ops = [];
      for (const u of us) ops.push({ pts: rectPts(uE - u - S.w / 2, S.y0, uE - u + S.w / 2, S.y1), kind: 'win', d: BLOCK_OPENINGS.side.recess, mullion: 1, lit: false, seed: 90 + u });
      wall(B, F, outline(0, Ln, 0, HCM), ops);
    }
    // the Hall's south side, down to Pump Quad's court (1.25 m below): the loggia's south arch, no windows (the
    // fireplace side: both plans), the fireplace's stack over the eaves, the Cellar Bar's basement lights and door
    {
      const F = frame(uW, 0, vS, 1, 0), Ls = uE - uW, SA = BLK.southArch, ops = [];
      ops.push({ pts: archPts(SA.u - uW, SA.w, T, T + SA.spring, 10), d: EW_ / 2, kind: 'void' });
      // (the Cellar Bar under the Hall: K.hallSouth = { notch: [u0, u1, top], lights: [[u0, u1, y0, y1]], sign: [u, y] } from
      //  places/_worcester_pump.js — the double doors and the splayed window of the fire plan; until that court is in,
      //  the first pass's door and lights: K.barLights, PIT)
      const HS = K.hallSouth || { notch: [PIT.door[0], PIT.door[1], PIT.doorTop], lights: K.barLights.map(([u, y0, y1]) => [u - 0.4, u + 0.4, y0, y1]), sign: [PIT.u1 - 0.8, PQY + 1.85] };
      for (const [u0, u1, y0, y1] of HS.lights) ops.push({ pts: rectPts(u0 - uW, y0, u1 - uW, y1), kind: 'win', d: 0.3, lit: true, rows: 1, cols: u1 - u0 > 1.2 ? 6 : 3, sill: false });
      const doorN = rectPts(HS.notch[0] - uW, PQY - 0.3, HS.notch[1] - uW, HS.notch[2]);
      wall(B, F, outline(0, Ls, PQY - 0.3, HCM, [doorN]), ops);
      B.push(F);
      B.box('stone', Ls / 2, T + 3.6, 0.06, Ls, 0.24, 0.14);
      archivolt(SA.u - uW, T + SA.spring, SA.w / 2, 0.24, 0.035);
      const fu = BLK.uRe - 7.72 - uW;      // the fireplace: opposite the Hall's middle window (venue plan)
      B.boxXZ('stone', fu - 1.0, fu + 1.0, HCT, HCT + 3.6, -1.6, -0.5); B.boxXZ('stoneDress', fu - 1.12, fu + 1.12, HCT + 3.6, HCT + 3.82, -1.72, -0.38);
      for (const x of [-0.6, 0, 0.6]) B.cyl('terracotta', fu + x, HCT + 3.82, -1.05, 0.14, 0.5, 8, true);
      if (!K.hallSouth) B.sign('signs', HS.sign[0] - uW - 0.7, HS.sign[1] - 0.35, HS.sign[0] - uW + 0.7, HS.sign[1] + 0.35, 0.03, atlas.uv('cellarBar'));      // at the head of the bar's steps (the new court hangs its own)
      modillions(Ls);
      B.pop();
    }
    // cornices and roofs: hipped stone slates (the aerial views)
    // (the pieces abut, none overlaps another: wings whole, the centre between them, the break in front)
    cornice(uW, uE, vN, vCs, 'n'); cornice(uW, uE, vHn, vS, 's');
    B.boxXZ('stoneDress', uW - BO, uC + BO, HCM, HCM + 0.3, vCs + BO, vHn - BO, { bottom: true }); B.boxXZ('stoneDress', uW - CO, uC + CO, HCM + 0.3, HCT, vCs + CO, vHn - CO, { bottom: true });
    B.boxXZ('stoneDress', uW - A.breakOut - CO, uW - CO, HCM + 0.3, HCT, A.breakV[0] - CO, A.breakV[1] + CO, { bottom: true });      // the cornice round the centre's break
    {      // the blocking course: along the street ends, the forecourt's three sides, and the quad front either side of the pediment
      const bc = (x0, x1, z0, z1) => B.boxXZ('stoneBase', x0, x1, HCT, HCT + 0.45, z0, z1);      // (dark and weathered, set back over the corona: the dark band under the roofs in the 2025 photographs)
      bc(uE - 0.3, uE + 0.1, vN + 0.3, vCs + 0.1); bc(uE - 0.3, uE + 0.1, vHn - 0.1, vS - 0.3);
      bc(uC + 0.1, uE - 0.3, vCs - 0.3, vCs + 0.1); bc(uC + 0.1, uE - 0.3, vHn - 0.1, vHn + 0.3); bc(uC - 0.3, uC + 0.1, vCs - 0.3, vHn + 0.3);
      bc(uW - 0.1, uW + 0.3, vN + 0.3, A.breakV[0]); bc(uW - 0.1, uW + 0.3, A.breakV[1], vS - 0.3);
    }
    // ROOFS (LIDAR 2022; the 2025 street photograph: dark slates, a flat lead top on each): 29 degrees from the blocking
    // course; the quad range's flat at 15.95 m, the wings' at 15.4 m. One hip along the whole quad range; each wing's
    // roof runs west into its east slope: the wing's two slopes end on the valleys, which are the edges of the quad
    // range's end hips, so no plane is drawn twice.
    {
      const tn = Math.tan(0.51), y = HCT, x0 = uW + 0.3, xs = uC - 0.3, x1 = uE - 0.3, zN = vN + 0.3, zS = vS - 0.3;
      { const yT = 15.95, i = (yT - y) / tn;
        B.poly('slate', [[x0, y, zS], [x0, y, zN], [x0 + i, yT, zN + i], [x0 + i, yT, zS - i]], [-1, 1, 0]); B.poly('slate', [[xs, y, zN], [xs, y, zS], [xs - i, yT, zS - i], [xs - i, yT, zN + i]], [1, 1, 0]);
        B.poly('slate', [[xs, y, zN], [x0, y, zN], [x0 + i, yT, zN + i], [xs - i, yT, zN + i]], [0, 1, -1]); B.poly('slate', [[x0, y, zS], [xs, y, zS], [xs - i, yT, zS - i], [x0 + i, yT, zS - i]], [0, 1, 1]);
        B.poly('lead', [[x0 + i, yT, zN + i], [x0 + i, yT, zS - i], [xs - i, yT, zS - i], [xs - i, yT, zN + i]], [0, 1, 0]); }
      for (const [z0, z1] of [[zN, vCs - 0.3], [vHn + 0.3, zS]]) {
        const yT = 15.4, i = (yT - y) / tn;
        B.poly('slate', [[xs, y, z1], [x1, y, z1], [x1 - i, yT, z1 - i], [xs - i, yT, z1 - i]], [0, 1, 1]); B.poly('slate', [[x1, y, z0], [xs, y, z0], [xs - i, yT, z0 + i], [x1 - i, yT, z0 + i]], [0, 1, -1]);
        B.poly('slate', [[x1, y, z1], [x1, y, z0], [x1 - i, yT, z0 + i], [x1 - i, yT, z1 - i]], [1, 1, 0]);
        B.poly('lead', [[xs - i, yT, z0 + i], [xs - i, yT, z1 - i], [x1 - i, yT, z1 - i], [x1 - i, yT, z0 + i]], [0, 1, 0]);
      }
    }
    for (const [u, v] of [[uE + 0.1, vCs - 0.15], [uE + 0.1, vHn + 0.15], [uC + 0.1, vCs + 0.2], [uC + 0.1, vHn - 0.2]]) B.box('iron', u, HCM / 2, v, 0.12, HCM, 0.12);      // lead downpipes on the street side
  }

  // ================================================================= colliders: the two halves either side of the gate hall
  {
    const hwW = G.wDoor.w / 2, hwE = G.eDoor.w / 2;
    pl([[uB, vN], [uE, vN], [uE, vCs], [uC, vCs], [uC, axis - hwE], [G.u1, axis - hwE], [G.u1, G.v0], [G.u0, G.v0], [G.u0, axis - hwW], [uB, axis - hwW], [uB, vN]]);
    pl([[uB, vS], [uE, vS], [uE, vHn], [uC, vHn], [uC, axis + hwE], [G.u1, axis + hwE], [G.u1, G.v1], [G.u0, G.v1], [G.u0, axis + hwW], [uB, axis + hwW], [uB, vS]]);
    seg(uW, vN, uB, vN); seg(uW, vS, uB, vS);      // the loggia's two ends, outside
  }

  // ================================================================= the forecourt and its screen on the street
  {
    const U = BLK.screenU, gp = 1.9;      // the gate piers stand gp either side of the axis
    const lawnA = [[uC + 1.3, vCs + 0.8], [U - 1.2, vCs + 0.8], [U - 1.2, axis - 2.0], [uC + 1.3, axis - 2.0]], lawnB = [[uC + 1.3, axis + 2.0], [U - 1.2, axis + 2.0], [U - 1.2, vHn - 0.8], [uC + 1.3, vHn - 0.8]];
    B.flat('paving', [[uC, vCs], [U + 0.3, vCs], [U + 0.3, vHn], [uC, vHn]], 0.045, [lawnA, lawnB]);
    B.flat('lawn', lawnA, 0.03); B.flat('lawn', lawnB, 0.03);
    // the wide stone pavement in front of the college, out to the centre lines of Walton St / Worcester St (the
    // carriageways, kerbed pavements and footways are drawn over it): without it the city's base-ground grid shows
    // through as a square of bare earth right where the player starts
    B.flat('apron', [[uE, vN], [37.4, vN], [40.7, -7.3], [46.7, 0.7], [41.9, 5.0], [39.2, 9.1], [37.0, 12.5], [36.1, 15.0], [34.3, 20.4], [31.5, 40.9], [25.0, 40.3], [25.0, vS], [uE, vS], [uE, vHn], [U + 0.3, vHn], [U + 0.3, vCs], [uE, vCs]], 0.02);
    // dwarf wall + wrought-iron screen + gate piers + gates with overthrow (almost in line with the wings' street
    // faces: the 2025 photograph)
    const rail = (v0, v1) => { B.boxXZ('stone', U - 0.25, U + 0.25, 0, 0.6, v0, v1); B.boxXZ('stoneDress', U - 0.3, U + 0.3, 0.6, 0.7, v0, v1); railRun(B, [U, v0], [U, v1], 0.7, 2.28); };
    rail(vCs, axis - gp - 0.38); rail(axis + gp + 0.38, vHn);
    for (const v of [axis - gp, axis + gp]) {
      B.boxXZ('stone', U - 0.38, U + 0.38, 0, 3.0, v - 0.38, v + 0.38); B.boxXZ('stoneDress', U - 0.46, U + 0.46, 3.0, 3.18, v - 0.46, v + 0.46);
      B.boxXZ('stoneDress', U - 0.3, U + 0.3, 3.18, 3.3, v - 0.3, v + 0.3); B.cyl('stoneDress', U, 3.3, v, 0.24, 0.34, 8, true, 0.12);   // ball-ish finial
    }
    // open gate leaves (swung in, against the lawns' edge) and the overthrow: scrolled iron arch over the gateway
    for (const v of [axis - gp + 0.39, axis + gp - 0.39]) B.card('signs', [U - 0.1, 0.05, v], [U - 1.7, 0.05, v], [U - 1.7, 2.45, v], [U - 0.1, 2.45, v], atlas.uv('gateLeaf'));
    B.card('signs', [U, 2.95, axis + gp], [U, 2.95, axis - gp], [U, 4.85, axis - gp], [U, 4.85, axis + gp], atlas.uv('overthrow'));
    seg(U, vCs, U, axis - gp + 0.25, 'railing'); seg(U, axis + gp - 0.25, U, vHn, 'railing');
  }
  return { lamps };
}
