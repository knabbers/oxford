// The Sultan Nazrin Shah Centre from the outside, upwards (2026-11-24): what of places/worcester_snsc.js can be stood
// on above the ground, which of its walls end where, and the few things ADDED so that there is a way to the top.
// The floors, edges and wall tops go to core/_climb.js (the player's catching / pulling up / balancing lives there and
// knows nothing of this building). Frame and levels: _snsc_plan.js (a along the field front, b into the building,
// y above the playing field).
//
// REAL FABRIC used as it stands (K: the published plan, sections, elevation and photographs; see _snsc_plan.js CHECKED):
//   the bronze handrails at the two ends of the terrace flight; the timber pergola (deep beams on the pier lines,
//   ten joists along the terrace); the flat roofs at the parapet level and their rooflights; the stage's curved back
//   wall and the two short walls that fall from it to the roof's valley; the north wall of the auditorium rising with
//   the roof to the clerestory; the clerestory's flat stone cap; the valley of the butterfly roof running out over the
//   wall at its north end.
// INVENTED (flagged: not in any picture or drawing; an accuracy pass may take every one of these out):
//   I1  four joists of the pergola's south-east bay "taken down" (the bay between the last free pier and the end wall
//       is open to the sky from the hood back to the fifth joist) and lying stacked on the terrace by the foyer wall.
//       (The south-east bay: the published photograph of the pergola looks north-west and shows that end whole.)
//   I2  a roofers' crawl board with battens, in three lengths with 1.4 and 1.5 m between them, lying up the north
//       wall's head
//   I3  the wall heads' capping drawn 0.34 m wide and 60 mm proud (a capping is in the detail section's key; its width
//       and that it can be walked along are guesses)
//   I4  an orange traffic cone and a cane with a plain red pennant on the clerestory cap's north-east end block, where
//       the crawl board arrives (the top of the way)
//   I6  the generated trees within about six metres of the stage wall and the north wall taken out (worcester_snsc.js),
//       and the two big trees this module plants at the north-west end and behind the stage moved 3 and 5 m further off
//   I7  roofers' materials stacked across the stage wall's head, two lengths of capping along it: three bags and a
//       drum, 1.6 m high. It cannot be walked or jumped past: down to hang from the wall head's outer edge (X), hand
//       over hand along under it, up
//   I8  one and a half lengths of the stage wall's capping "lifted off" (1.6 m of the head bare; the bare bed counts as
//       the roof beside it does: not standable): a jump
//   I9  roofers' edge protection (scaffold tube, two rails and a toe board) round the north-east end block of the cap
//       and along the outside of the last length of crawl board: the three sides of the top that have a flat roof under
//       them. With it nobody can go from the upper half of the way down onto a flat roof: every fall up there is over
//       the outside of a wall or down the zinc, to the ground. (The rest of the cap, beyond the rail, is not reached.)
//   I10 BEHAVIOUR: nobody lands on a flat roof from 1.5 m or more above and keeps their feet: over, and rolling to the
//       nearest outer edge of the building and off it. (Two leaps from the upper half could reach a flat roof: back from
//       the top of the short wall to the north-west roof, and off the crawl boards onto the e-hub's.) The way up is
//       not touched: it comes onto the roof from below.
//   I5  BEHAVIOUR: the auditorium's roof (both slopes, 7 to 20 degrees, and its valley) and the bare sloping wall heads
//       count as too smooth to stand on: you sit and slide to the valley and out over its north end
import * as P from './_snsc_plan.js';
import { climbOf } from '../core/_climb.js';

const qs = typeof location !== 'undefined' && location && location.search ? location.search : '';
const env = typeof process !== 'undefined' && process.env ? process.env : {};
/** `?snscclimb=0` (node: GTO_SNSCCLIMB=0): the building as it was before this pass (no added things, nothing to stand on above the ground) */
export const CLIMB_ON = P.ON && !(/[?&]snscclimb=0(&|$)/.test(qs) || env.GTO_SNSCCLIMB === '0');

const { Y, TERR, PIER, DRUM, FAN, STAGE, LEN, DEP, STUDIO: S, pierA } = P;
const HD = Y.head, PAR = Y.parapet, DR = Y.drum, VY = DRUM.valley, STG = Y.stage, FL = Y.floor;
const pv = DRUM.pv, qv = DRUM.qv, RI = FAN.rg - DRUM.capIn;
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
const eq = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

// ------------------------------------------------------------------------------------------------ the pergola
export const BEAM = { top: HD + 0.28, bot: HD - 0.02, hw: 0.05 }, JOIST = { top: HD + 0.24, bot: HD + 0.03, hw: 0.045, n0: 4 };
/** the deep beams' a (one on each pier line of the terrace, the end ones against the end walls) */
export const beamsA = () => [3, 4, 5, 6, 7, 8, 9].map((i) => (i === 3 ? TERR.a0 + 0.06 : i === 9 ? TERR.a1 - 0.06 : pierA(i)));
/** the joists: [b, a0, a1]. I1: the first four stop at the last free pier's beam (their south-east bay is open) */
export function joists() {
  const out = []; let k = 0;
  for (let b = PIER.d + 0.38; b < DEP - 0.25; b += 0.43, k++) out.push([b, TERR.a0, CLIMB_ON && k < JOIST.n0 ? pierA(8) + BEAM.hw : TERR.a1]);
  return out;
}
/** I1: where the four joists lie (a0, a1, b0, b1, height of the stack) */
export const STACK = { a0: TERR.a1 - 0.5 - (TERR.a1 - pierA(8) - 0.1), a1: TERR.a1 - 0.5, b0: DEP - 0.62, b1: DEP - 0.28, h: 0.3 };
/** the handrails: [a, b low, y low, b high, y high] */
export const rails = () => { const r = FL / TERR.n; return [TERR.a0 + 0.14, TERR.a1 - 0.14].map((a) => [a, TERR.s0 + 0.15, r + 0.92, TERR.top + 0.35, FL + 0.92]); };

// ------------------------------------------------------------------------------------------------ the auditorium's walls and roof
const st = P.stageArc(8).reverse();                    // the stage wall from its north end round to its west end
const P1 = st[0], P0 = st[st.length - 1];
/** the north wall's head at a (it rises with the roof from the valley's end to the clerestory) */
export const northTop = (a) => VY + (DR - VY) * clamp01((a - pv[0]) / (DRUM.fullA - pv[0]));
const nwTop = (b) => VY + (DR - VY) * clamp01((qv[1] - b) / (qv[1] - DRUM.fullB));
export const CAP = 0.06, COPE = 0.17;                   // I3: the capping's height over the wall head, its half width
/** I2: the crawl board's two lengths along the north wall (a from, a to), half width, thickness */
export const BOARD = { runs: [[pv[0] + 0.75, 12.6], [14.0, 15.9], [17.4, DRUM.fullA]], hw: 0.15, t: 0.045 };
export const GAP = 0.6;                                // the short wall from the stage to the valley's mouth stops this far from it
/** I4: the cone and the pennant */
export const MARK = { cone: [19.72, 23.42], cane: [20.02, 23.1] };
/** where the way up begins and where it ends (frame a, b; world via P.W) */
export const START = [TERR.a1 - 1.2, TERR.s0 - 1.2], SUMMIT = [19.45, 23.85];

/** the top of an outer wall between two of the plan's corners: [yA, yB] */
function edgeTop(A, B) {
  const N17 = [17.59, DRUM.nB];
  if ((eq(A, N17) && eq(B, pv)) || (eq(B, N17) && eq(A, pv))) return [northTop(A[0]), northTop(B[0])];
  const sy = (p) => (eq(p, pv) || eq(p, qv) ? VY : st.some((q) => eq(p, q)) ? STG : NaN);
  const a = sy(A), b = sy(B);
  return a === a && b === b ? [a, b] : [PAR, PAR];
}
/** a wall A -> B whose head runs from yA to yB, in pieces: [[A, B, top], ...]. A sloping head is cut into short pieces,
 *  each counted half a metre lower than it is, so that a body walking up along the head is never stopped by the end
 *  of the next piece */
function pieces(A, B, yA, yB, out) {
  if (Math.abs(yA - yB) < 1e-6) { out.push([A, B, yA > PAR + 0.01 ? yA - 0.25 : yA]); return; }      // (a level head that carries on from a sloping one: a little low too)
  const n = Math.max(1, Math.ceil(dist(A, B) / 0.6));
  for (let i = 0; i < n; i++) out.push([lerp(A, B, i / n), lerp(A, B, (i + 1) / n), Math.min(yA + (yB - yA) * i / n, yA + (yB - yA) * (i + 1) / n) - 0.5]);
}
/** the building's ground-plan walls with their tops (frame coordinates): what worcester_snsc.js makes solid */
export function walls() {
  const out = [];
  for (const poly of P.solids()) for (let i = 0; i < poly.length; i++) { const A = poly[i], B = poly[(i + 1) % poly.length], t = edgeTop(A, B); pieces(A, B, t[0], t[1], out); }
  return out;
}
/** the walls that stand on the roof (base = the parapet level): the hood's back over the pergola is the one exception */
export function upperWalls() {
  const out = [], n = FAN.n, r = FAN.rg + 0.05, c = FAN.c;
  for (let i = 0; i < n; i++) out.push([P.fanPt((i / n) * Math.PI / 2, r), P.fanPt(((i + 1) / n) * Math.PI / 2, r), DR, PAR]);
  const add = (A, B, yA, yB) => { const o = []; pieces(A, B, yA, yB, o); for (const w of o) out.push([w[0], w[1], w[2], PAR]); };
  add([c[0] + FAN.rg, DRUM.neB], [DRUM.ne, DRUM.neB], DR, DR); add([DRUM.ne, DRUM.neB], [DRUM.ne, DRUM.nB], DR, DR);
  add([DRUM.ne, DRUM.nB], [DRUM.fullA, DRUM.nB], DR, DR); add([DRUM.fullA, DRUM.nB], [17.59, DRUM.nB], DR, northTop(17.59));
  add(qv, [DRUM.nw, DRUM.fullB], VY, DR); add([DRUM.nw, DRUM.fullB], [DRUM.nw, DRUM.front], DR, DR);
  add([DRUM.nw, DRUM.front], [DRUM.retA, DRUM.front], DR, DR); add([DRUM.retA, DRUM.front], [DRUM.retA, c[1] - FAN.rg], DR, DR);
  out.push([[TERR.a0, PIER.d], [TERR.a1, PIER.d], PAR, HD]);
  return out;
}
/** the butterfly roof as the building draws it: triangles [[a, b, y] x 3] */
export function roofTris() {
  const n = FAN.n, rim = [[DRUM.fullA, DRUM.nB, DR]], out = [];
  for (let i = 0; i <= n; i++) { const p = P.fanPt((i / n) * Math.PI / 2, RI); rim.push([p[0], p[1], DR]); }
  rim.push([DRUM.nw, DRUM.fullB, DR]);
  const m = rim.length - 1, ch = (j) => { const p = lerp(pv, qv, j / m); return [p[0], p[1], VY]; };
  for (let j = 0; j < m; j++) { out.push([rim[j], rim[j + 1], ch(j + 1)]); out.push([rim[j], ch(j + 1), ch(j)]); }
  const mid = [(pv[0] + qv[0]) / 2, (pv[1] + qv[1]) / 2, VY], per = [[pv[0], pv[1], VY], ...st.map((p) => [p[0], p[1], STG]), [qv[0], qv[1], VY]];
  for (let j = 0; j < per.length - 1; j++) out.push([mid, per[j], per[j + 1]]);
  return out;
}
/** I8: the stretch of the stage wall's head without its capping, as distance along the head from its west end */
export const BARE = { s0: 5.43, s1: 0 };
/** the stage wall's head as lines [A, B, yA, yB]: up from the valley's south-west end, round (but for I8), down towards its mouth */
export function stageHeads() {
  const out = [[qv, P0, VY, STG]]; let s = 0;
  for (let i = st.length - 1; i > 0; i--) {
    const A = st[i], Bq = st[i - 1], l = dist(A, Bq), e = s + l;
    if (!BARE.s1 && e > BARE.s0 + 1.2) BARE.s1 = e;      // (the bare stretch ends at a joint of the capping)
    if (e <= BARE.s0 || (BARE.s1 && s >= BARE.s1)) out.push([A, Bq, STG, STG]);
    else if (s < BARE.s0) out.push([A, lerp(A, Bq, (BARE.s0 - s) / l), STG, STG]);
    s = e;
  }
  const l = dist(P1, pv), t = 1 - GAP / l; out.push([P1, lerp(P1, pv, t), STG, STG + (VY - STG) * t]);
  return out;
}
/** I8: where the capping stops and where it starts again (frame points) */
export function bareEnds() { const h = stageHeads(); for (let i = 1; i < h.length - 1; i++) if (dist(h[i][1], h[i + 1][0]) > 0.5) return [h[i][1], h[i + 1][0], h[i + 1][1]]; return null; }
/** I7: the stack on the stage wall's head: where (frame: the joint two lengths round from the west end), the head's height there, its radius and height; `before` / `after`: the joints either side */
export const STACKED = { c: st[st.length - 3], before: st[st.length - 2], after: st[st.length - 4], y: STG + CAP, r: 0.45, h: 1.6, solid: 1.75 };
/** I9: the edge protection: lines [A, B] (frame), the height of its top rail, the height it stops a body to */
export const RAIL = { lines: [[[17.3, DRUM.nB + 0.35], [DRUM.ne, DRUM.nB + 0.35]], [[DRUM.ne, DRUM.nB + 0.35], [DRUM.ne, FAN.c[1]]], [[DRUM.ne, FAN.c[1]], [FAN.c[0] + RI, FAN.c[1]]]], h: 1.1, solid: 1.45 };
/** the building's outer edges at roof level with the ground (or a pool) below: [A, B] in frame coordinates */
export function outerEdges() {
  const E = P.ENTR, pts = [[0, 0], [LEN, 0], [LEN, DEP], [S.a0, DEP], [S.a0, S.b0], [S.tip, S.b0], [S.tip, S.b1], [E.tip, S.b1], [E.tip, P.NEND], [17.3, 38.46], [16.05, 38.46], [16.05, 31.63], [17.59, 31.63], [17.59, DRUM.nB]];
  const out = []; for (let i = 0; i < pts.length - 1; i++) out.push([pts[i], pts[i + 1]]);
  const w = [qv, [0, qv[1]], [0, 8.66], [3.05, 8.66], [3.05, DEP], [0, DEP], [0, 0]]; for (let i = 0; i < w.length - 1; i++) out.push([w[i], w[i + 1]]);
  return out;
}
export const ROOFLIGHTS = [[20.7, 10.6, 1.3, 1.3], [22.5, 10.6, 1.3, 1.3], [20.7, 12.6, 1.3, 1.3], [22.5, 12.6, 1.3, 1.3], [20.7, 14.6, 1.3, 1.3], [22.5, 14.6, 1.3, 1.3], [28.3, 11.6, 1.6, 1.2], [28.3, 15.6, 1.6, 1.2], [39.2, 13.85, 6.4, 1.3], [21.8, 28.0, 1.8, 1.8]];

// ------------------------------------------------------------------------------------------------ drawn: the added things
/** I1 - I4, into the building's own batch (T: _snsc_tools.js, inside T.inFrame) */
export function drawClimb(T, B) {
  const { bx } = T;
  T.inFrame(() => {
    // I1: the four joists on two bearers by the foyer wall
    { const s = STACK; for (const a of [s.a0 + 0.4, s.a1 - 0.4]) bx('snscTimber', a - 0.05, a + 0.05, FL, FL + 0.08, s.b0 - 0.03, s.b1 + 0.03, { bottom: true });
      for (let k = 0; k < 4; k++) { const b = s.b0 + 0.045 + (k % 2) * 0.17, y = FL + 0.08 + (k >> 1) * 0.105; bx('snscTimber', s.a0, s.a1, y, y + 0.09, b, b + 0.15, { bottom: true }); } }
    // I3: the capping of the stage wall, of the two short walls and of the north and north-west walls' sloping heads
    const cap = (A, Bq, yA, yB, key = 'alu') => { const l = dist(A, Bq), nx = -(Bq[1] - A[1]) / l * COPE, nz = (Bq[0] - A[0]) / l * COPE;
      const q = (p, y, s) => [p[0] + nx * s, y, p[1] + nz * s];
      T.q(key, [q(A, yA + CAP, 1), q(Bq, yB + CAP, 1), q(Bq, yB + CAP, -1), q(A, yA + CAP, -1)], [0, 1, 0]);
      for (const s of [1, -1]) T.q(key, [q(A, yA - 0.02, s), q(Bq, yB - 0.02, s), q(Bq, yB + CAP, s), q(A, yA + CAP, s)], [nx * s, 0, nz * s]); };
    for (const [A, Bq, yA, yB] of stageHeads()) cap(A, Bq, yA, yB);      // (I8: not along the bare stretch; nor over the valley's mouth)
    cap(pv, [DRUM.fullA, DRUM.nB], VY, DR); cap(qv, [DRUM.nw, DRUM.fullB], VY, DR);
    // I2: the crawl board: two boards side by side, battens across
    for (const [a0, a1] of BOARD.runs) {
      const y0 = northTop(a0) + CAP, y1 = northTop(a1) + CAP, b = DRUM.nB, w = BOARD.hw, t = BOARD.t;
      for (const s of [-1, 1]) T.q('wood', [[a0, y0 + t, b + s * w], [a1, y1 + t, b + s * w], [a1, y1, b + s * w], [a0, y0, b + s * w]], [0, 0, s]);
      T.q('wood', [[a0, y0 + t, b - w], [a1, y1 + t, b - w], [a1, y1 + t, b + w], [a0, y0 + t, b + w]], [0, 1, 0]);
      T.q('wood', [[a0, y0, b - w], [a0, y0 + t, b - w], [a0, y0 + t, b + w], [a0, y0, b + w]], [-1, 0, 0]); T.q('wood', [[a1, y1, b - w], [a1, y1 + t, b - w], [a1, y1 + t, b + w], [a1, y1, b + w]], [1, 0, 0]);
      for (let a = a0 + 0.2; a < a1 - 0.1; a += 0.4) { const y = northTop(a) + CAP + t; bx('teak', a - 0.02, a + 0.02, y - 0.01, y + 0.03, b - w, b + w, { bottom: true }); }
    }
    // I7: three bags and a drum on the stage wall's head
    { const o = STACKED, [a, b] = o.c; for (let k = 0; k < 3; k++) bx('snscSoffit', a - 0.36 + (k % 2) * 0.05, a + 0.36 + (k % 2) * 0.05, o.y - 0.03 + k * 0.22, o.y + 0.19 + k * 0.22, b - 0.3, b + 0.3, { bottom: true });
      B.cyl('snscDrum', a, o.y + 0.63, -b, 0.27, 0.9, 10, true); B.cyl('iron', a, o.y + 1.53, -b, 0.1, 0.04, 6, true); }
    // I9: the edge protection: standards, two rails, a toe board
    for (const [A, Bq] of RAIL.lines) {
      const l = dist(A, Bq), n = Math.max(1, Math.round(l / 1.3)), y0 = Math.min(northTop(A[0]), northTop(Bq[0])) - 0.3;
      for (let k = 0; k <= n; k++) { const q = lerp(A, Bq, k / n); B.cyl('alu', q[0], y0, -q[1], 0.024, DR + RAIL.h + 0.08 - y0, 5, true); }
      for (const h of [RAIL.h, RAIL.h * 0.52]) B.beam('alu', [A[0], DR + h, -A[1]], [Bq[0], DR + h, -Bq[1]], 0.045);
      B.beam('wood', [A[0], DR + 0.09, -A[1]], [Bq[0], DR + 0.09, -Bq[1]], 0.03, 0.15);
    }
    // I4: a traffic cone and a cane with a plain pennant, left on the cap
    { const [a, b] = MARK.cone; bx('dark', a - 0.17, a + 0.17, DR, DR + 0.03, b - 0.17, b + 0.17, { bottom: true });
      B.cyl('snscCone', a, DR + 0.03, -b, 0.03, 0.25, 8, false, 0.13); B.cyl('snscSoffit', a, DR + 0.28, -b, 0.02, 0.12, 8, false, 0.065); B.cyl('snscCone', a, DR + 0.4, -b, 0.012, 0.1, 8, true, 0.045);
      const [ca, cb] = MARK.cane; B.cyl('teak', ca, DR, -cb, 0.012, 1.25, 5, true);
      for (const s of [1, -1]) T.q('snscFlag', [[ca, DR + 1.22, cb], [ca, DR + 0.98, cb], [ca + 0.42, DR + 1.1, cb - 0.05]], [0, 0, s]); }
  });
}

// ------------------------------------------------------------------------------------------------ handed to core/_climb.js
/**
 * shapes: [[collider shape, top], ...] already made solid by worcester_snsc.js (walls, piers, rails, benches, the stack).
 * -> { decks, walls } counts
 */
export function installClimb(game, shapes) {
  const C = climbOf(game), col = game.worldCollider, W = (p) => P.W(p[0], p[1]);
  const n0 = C.decks.length, w0 = C.walls.length;
  for (const [s, top] of shapes) C.addWall(s, top);
  for (const [A, Bq, top, base] of upperWalls()) { const a = W(A), b = W(Bq), s = col.addSegment(a[0], a[1], b[0], b[1], { tag: 'building' }); if (s) { s.h = top; C.addWall(s, top, base); } }
  { const o = STACKED, w = W(o.c), c = col.addCircle(w[0], w[1], o.r, { tag: 'furniture' }); if (c) C.addWall(c, o.y + o.solid, o.y); }      // I7
  for (const [A, Bq] of RAIL.lines) { const a = W(A), b = W(Bq), g = col.addSegment(a[0], a[1], b[0], b[1], { tag: 'wall' }); if (g) { g.h = DR + RAIL.solid; C.addWall(g, DR + RAIL.solid, 9.4 + 1.75); } }      // I9
  const rect = (a0, a1, b0, b1) => [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].map(W);
  // ---- the flat roofs, the hoods, the rooflights (I10: shedding towards the nearest outer edge of the building)
  const EDGE = outerEdges().map(([A, Bq]) => [W(A), W(Bq)]), _e = [0, 0];
  const shed = (x, z) => { let bd = Infinity, qx = x + 1, qz = z; for (const [a, b] of EDGE) { const ex = b[0] - a[0], ez = b[1] - a[1]; let t = ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1e-9); t = t < 0 ? 0 : t > 1 ? 1 : t; const px = a[0] + ex * t, pz = a[1] + ez * t, dd = Math.hypot(x - px, z - pz); if (dd < bd) { bd = dd; qx = px; qz = pz; } }
    if (bd < 0.05) { const c = W([FAN.c[0] + 8, FAN.c[1] - 8]); qx = 2 * x - c[0]; qz = 2 * z - c[1]; bd = Math.hypot(qx - x, qz - z); }      // (on the edge itself: away from the middle of the building)
    _e[0] = (qx - x) / bd; _e[1] = (qz - z) / bd; return _e; };
  C.addDeck(P.roofOutline().pts.map(W), PAR, { tag: 'roof', shed });
  C.addDeck([[0, 0], [LEN, 0], [LEN, 0.8], [TERR.a1, 0.8], [TERR.a1, PIER.d], [TERR.a0, PIER.d], [TERR.a0, 0.8], [0, 0.8]].map(W), PAR, { tag: 'hood', shed });
  C.addDeck(rect(S.glass + P.BAND, S.tip, S.b0, S.b1), PAR, { tag: 'hood', shed });
  for (const [a, b, w, d] of ROOFLIGHTS) C.addDeck(rect(a - w / 2, a + w / 2, b - d / 2, b + d / 2), PAR + 0.28, { tag: 'rooflight', grab: false });
  // ---- the pergola, the handrails
  for (const a of beamsA()) C.addStrip(W([a, PIER.d]), W([a, DEP]), BEAM.top, BEAM.top, BEAM.hw, { bot: BEAM.bot, tag: 'beam' });
  for (const [b, a0, a1] of joists()) C.addStrip(W([a0, b]), W([a1, b]), JOIST.top, JOIST.top, JOIST.hw, { bot: JOIST.bot, tag: 'joist' });
  for (const [a, b0, y0, b1, y1] of rails()) C.addStrip(W([a, b0]), W([a, b1]), y0, y1, 0.08, { tag: 'rail' });      // (the rail and its brackets: a body kept off the end wall by its own width still has a foot on it)
  // ---- the auditorium: its roof (I5: too smooth), the wall heads, the crawl board, the cap
  const v0 = W(qv), vd = (() => { const a = W(qv), b = W(pv), l = dist(a, b); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; })(), _s = [0, 0];
  for (const t of roofTris()) {
    const p = t.map((v) => [...W(v), v[2]]), ux = p[1][0] - p[0][0], uz = p[1][1] - p[0][1], uy = p[1][2] - p[0][2], vx = p[2][0] - p[0][0], vz = p[2][1] - p[0][1], vy = p[2][2] - p[0][2];
    const det = ux * vz - uz * vx; if (Math.abs(det) < 1e-6) continue;
    const gx = (uy * vz - uz * vy) / det, gz = (ux * vy - uy * vx) / det, g = Math.hypot(gx, gz);
    // downhill to the valley, and along the valley to its mouth: the nearer the valley's line, the more along it
    const dx = g > 1e-3 ? -gx / g : 0, dz = g > 1e-3 ? -gz / g : 0;
    const slip = (x, z) => { const off = Math.abs((x - v0[0]) * vd[1] - (z - v0[1]) * vd[0]), k = off > 0.7 ? 1 : off / 0.7; let sx = dx * k + vd[0] * (1.4 - k), sz = dz * k + vd[1] * (1.4 - k); const l = Math.hypot(sx, sz) || 1; _s[0] = sx / l; _s[1] = sz / l; return _s; };
    C.addDeck(p.map((q) => [q[0], q[1]]), [p[0][2], p[0][0], p[0][1], gx, gz], { slip, tag: 'zinc' });
  }
  for (const [A, Bq, yA, yB] of stageHeads()) C.addStrip(W(A), W(Bq), yA + CAP, yB + CAP, COPE, { tag: 'head' });
  for (const [a0, a1] of BOARD.runs) C.addStrip(W([a0, DRUM.nB]), W([a1, DRUM.nB]), northTop(a0) + CAP + BOARD.t, northTop(a1) + CAP + BOARD.t, BOARD.hw, { tag: 'board' });
  { const ring = [], n = FAN.n; for (let i = 0; i <= n; i++) ring.push(P.fanPt((i / n) * Math.PI / 2, FAN.ro)); for (let i = n; i >= 0; i--) ring.push(P.fanPt((i / n) * Math.PI / 2, RI));
    C.addDeck(ring.map(W), DR, { tag: 'cap' });
    // (the two end blocks: out to the outer edge of the capping, so that the wall's own line is well inside them)
    C.addDeck([[DRUM.fullA, DRUM.nB + COPE], [DRUM.ne, DRUM.nB + COPE], [DRUM.ne, FAN.c[1]], [FAN.c[0] + RI, FAN.c[1]]].map(W), DR, { tag: 'cap' });
    C.addDeck([[DRUM.nw - COPE, DRUM.front], [FAN.c[0], DRUM.front], [FAN.c[0], FAN.c[1] - RI], [DRUM.nw - COPE, DRUM.fullB]].map(W), DR, { tag: 'cap' }); }
  for (const s of P.solids()) C.addSolid(s.map(W));
  void nwTop;
  return { decks: C.decks.length - n0, walls: C.walls.length - w0 };
}
