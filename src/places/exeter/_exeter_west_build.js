// Exeter College, STANDALONE model, part 'west' (B01): the build functions. Called by exeter_west.js with ctx.B already
// in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from
// _exeter_west_plan.js (sources and K / G there). Local helpers written here (not in the kit): pointed-light window
// groups, a canted oriel on corbelling, an octagonal turret, a barrel vault.
import * as K from './_exeter_kit.js';
import {
  RANGE, ROOF, STREET_GROUND, QUAD_GROUND, FOOT, ST, QD, STREET_N, STREET_N_PIPES, STREET_S, STREET_S_PIPES, GROTESQUES_S,
  GROTESQUE_PITCH_N, QUAD_N, QUAD_N_PIPES, QUAD_S, QUAD_S_PIPES, DORMER, DORMERS_ST, DORMERS_QD, STACKS, STACK, ORIEL_N,
  TOWER, GATE, ORIEL_G, PASSAGE, LAMPS, WAY, BEDS, ROSE, CLOSERS,
} from './_exeter_west_plan.js';

const { frame, wall, rectPts, archPts, tudorPts, pointedPts } = K;
const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [a, ya] = tab[i - 1], [b, yb] = tab[i]; return ya + ((x - a) / (b - a)) * (yb - ya); } return tab[tab.length - 1][1]; };
export const streetY = (v) => interp(STREET_GROUND, v);
export const quadY = (v) => interp(QUAD_GROUND, v);
/** the Front Quad's paving plane (exeter_grounds.js quadY + its 0.045 flags: copied, not imported, to keep the parts apart) */
const fqPave = (u, v) => -0.025 - 0.0071 * u + 0.006 * v + 0.045;
/** the covered way's threshold (one step above the paving at the door) */
const wayY0 = () => fqPave(RANGE.uQd, WAY.v) + WAY.step;

// the wall frames (kit CONVENTIONS): street faces WEST (s = v - v0 runs south), quad faces EAST (s = v1 - v runs north)
const FS = () => frame(RANGE.uSt, 0, RANGE.vN, 0, 1), sS = (v) => v - RANGE.vN;
const FQ = () => frame(RANGE.uQd, 0, RANGE.vS, 0, -1), sQ = (v) => RANGE.vS - v;
const T = TOWER;
// THE STREET THRESHOLD (the merge, 2026-11-24): the passage's floor and the setts apron meet Turl Street's pavement as the
// CITY draws it, flush: the city lays its raised pavement Y.pavement (0.13 m, world/ground.js) over its field, and the field
// here is the survey smoothed (terrain precinct exeter_rim): so the threshold is that field at the tower's street face +
// Y.pavement (+ 5 mm: the college's flags lie on the city's, which runs on 0.33 m under the tower). Without a city field
// (a bare dry run) the measured figure stands in: the survey's pavement + 0.17. K: measured in the game (the walk showed a
// 0.17 m step down here before)
let TH = null;
const CITY_PAVE = 0.13;
function threshold(ctx) {
  const w = ctx && ctx.world, S = ctx && ctx.S;
  if (w && typeof w.terrainLevel === 'function' && S && S.L2W) { const p = S.L2W(T.uSt - 0.2, T.vc), f = w.terrainLevel(p[0], p[1]); if (Number.isFinite(f) && f > 40) return f + CITY_PAVE + 0.005 - S.DATUM; }
  return streetY(T.vc) + 0.17;
}
const FTS = () => frame(T.uSt, 0, T.v0, 0, 1), sTS = (v) => v - T.v0;
const FTQ = () => frame(T.uQd, 0, T.v1, 0, -1), sTQ = (v) => T.v1 - v;

/** a wall outline whose foot follows the ground (FOOT below it): s0..s1 along the face, groundAt(s) */
function footOutline(s0, s1, top, groundAt, n = 6) {
  const p = [];
  for (let i = 0; i <= n; i++) { const s = s0 + ((s1 - s0) * i) / n; p.push([s, groundAt(s) - FOOT]); }
  p.push([s1, top], [s0, top]);
  return p;
}

// ------------------------------------------------------------------------------------------------ windows
/** a group of n lights centred at x from y0 to y1 (head shape 'pointed' | 'round' | 'tudor'); returns { ops, box } */
function lightGroup(x, n, y0, y1, lw, mull, head, d, glass = 'sash') {
  const w = n * lw + (n - 1) * mull, x0 = x - w / 2, ops = [];
  for (let i = 0; i < n; i++) {
    const c = x0 + lw / 2 + i * (lw + mull);
    const pts = head === 'round' ? archPts(c, lw, y0, y1 - lw / 2, 6) : head === 'tudor' ? tudorPts(c, lw, y0, y1 - 0.2, 0.2, 6) : head === 'pointed' ? pointedPts(c, lw, y0, y1 - ST.headRise, ST.headRise, 3) : rectPts(c - lw / 2, y0, c + lw / 2, y1);
    ops.push({ pts, kind: 'win', glass, d, sill: false });
  }
  return { ops, box: [x0, x - w / 2 + w, y0, y1] };
}
/** labels (square hood-moulds) and sills for the window boxes, in the CURRENT frame */
function dressings(B, boxes, key = 'bathDress') {
  for (const [x0, x1, y0, y1] of boxes) {
    K.label(B, x0 - 0.05, x1 + 0.05, y1 + 0.08, 0.38, key);
    B.box(key, (x0 + x1) / 2, y0 - 0.08, 0.06, x1 - x0 + 0.24, 0.16, 0.12, 0, { bottom: true });
  }
}
const N_OF = { one: 1, two: 2, three: 3 };

// ------------------------------------------------------------------------------------------------ THE STREET FRONT
export function buildStreet(ctx) {
  const { B } = ctx, P = ST, lights = (s, k, y) => lightGroup(s, N_OF[k], y[0], y[1], k === 'one' ? P.singleW : P.lightW, P.mullion, 'pointed', P.reveal);
  const pieces = [[RANGE.vN, T.v0, STREET_N, STREET_N_PIPES], [T.v1, RANGE.vS, STREET_S, STREET_S_PIPES]];
  const G = ORIEL_N.gable, gv0 = ORIEL_N.v - G.w / 2, gv1 = ORIEL_N.v + G.w / 2;
  for (const [v0, v1, bays, pipes] of pieces) {
    const ops = [], boxes = [];
    for (const b of bays) {
      const s = sS(b.v);
      if (b.k === 'oriel') {
        for (const [k, y] of [['three', P.g], ['three', P.t]]) { const g = lights(s, k, y); ops.push(...g.ops); boxes.push(g.box); }
        continue;
      }
      for (const y of [P.g, P.f, P.t]) { const g = lights(s, b.k, y); ops.push(...g.ops); boxes.push(g.box); }
    }
    wall(B, FS(), footOutline(sS(v0), sS(v1), ROOF.cornice, (s) => streetY(RANGE.vN + s)), ops, 'bath');
    B.push(FS());
    dressings(B, boxes);
    const a = sS(v0), b = sS(v1), gb = Math.min(streetY(v0), streetY(v1)) - FOOT;
    K.stringCourse(B, 'bathOld', a, b, P.plinth, P.plinth - gb, P.plinthProj);
    K.stringCourse(B, 'bathDress', a, b, P.plinth + 0.12, 0.12, P.plinthProj + 0.06);      // the plinth's chamfered top
    for (const y of [P.s1, P.s2]) K.stringCourse(B, 'bathDress', a, b, y, 0.17, 0.1);
    K.stringCourse(B, 'bathDress', a, b, ROOF.cornice, 0.26, 0.2);
    // downpipes with hopper heads
    for (const v of pipes) pipe(B, sS(v), streetY(v), ROOF.cornice - 0.3, 0.14);
    // grotesques at the cornice: 13 south of the tower (MARILYN BUTLER), every GROTESQUE_PITCH_N north
    const nG = v0 > 0 ? GROTESQUES_S : Math.floor((b - a) / GROTESQUE_PITCH_N);
    for (let i = 0; i < nG; i++) {
      const s = a + ((b - a) * (i + 0.5)) / nG;
      B.box('bathDress', s, ROOF.cornice - 0.12, 0.3, 0.26, 0.3, 0.34, 0, { bottom: true });
    }
    // basement grilles in the plinth (south part: the lower ground floor, Stapeldon Room side)
    if (v0 > 0) for (const bb of bays) B.box('ironBlack', sS(bb.v), 0.45, P.plinthProj + 0.005, 0.6, 0.3, 0.02, 0, {});
    B.pop();
    // the parapet (broken by the oriel's gable)
    const u = RANGE.uSt + ROOF.parapetT / 2, runs = v0 < gv0 ? [[v0, gv0], [gv1, v1]] : [[v0, v1]];
    for (const [p, q] of runs) K.parapet(B, 'bath', [[u, p + ROOF.parapetT / 2], [u, q - ROOF.parapetT / 2]], ROOF.cornice, ROOF.parapet - ROOF.cornice - 0.08, ROOF.parapetT, { coping: 'bathDress' });
  }
  buildOrielN(ctx);
  for (const L of LAMPS.filter((l) => l.face === 'st')) {
    B.push(FS());
    const s = sS(L.v);
    B.box('ironBlack', s, L.y + 0.75, L.arm / 2, 0.05, 0.05, L.arm, 0, {});
    B.beam('ironBlack', [s, L.y + 0.2, 0.02], [s, L.y + 0.72, L.arm * 0.7], 0.035);
    const p = K.lantern(B, s, L.y + 0.05, L.arm, { size: 0.32 });
    B.pop();
    ctx.lamp(RANGE.uSt - p[2], p[1], RANGE.vN + p[0]);
  }
}
function pipe(B, s, yGround, yTop, z) {
  B.cyl('leadDark', s, yGround - 0.05, z, 0.055, yTop - yGround, 6, false);
  B.box('leadDark', s, yTop + 0.15, z, 0.3, 0.32, 0.26, 0, { bottom: true });
}

// ------------------------------------------------------------------------------------------------ oriels
/** a canted oriel on a wall plane u = uw facing WEST: front width O.front, projection O.proj, centred at v = vc.
 *  tiers: [[y0, y1, nFront], ...] window tiers; O.corbel, O.panel, O.parapet: [y0, y1] */
function oriel(B, uw, vc, O, tiers) {
  const hf = O.front / 2, p = O.proj;
  const ring = (k, e = 0) => [[uw, vc - hf * k - p * k - e], [uw - p * k - e, vc - hf * k - e * 0.4], [uw - p * k - e, vc + hf * k + e * 0.4], [uw, vc + hf * k + p * k + e]];
  // three stepped corbel courses and a band of paterae
  const [c0, c1] = O.corbel, ch = (c1 - c0) / 3;
  [0.4, 0.68, 0.9].forEach((k, i) => K.prism(B, i === 1 ? 'bathOld' : 'bathDress', ring(k), c0 + ch * i, c0 + ch * (i + 1), { bottom: true }));
  K.prism(B, 'bathDress', ring(1, 0.05), O.panel[0] - 0.12, O.panel[0], { bottom: true });
  K.prism(B, 'bathDress', ring(1), O.panel[0], O.panel[1], {});
  // quatrefoil roundels on the base panel's front: small discs
  const facetFrames = () => { const r = ring(1); return [[r[0], r[1]], [r[1], r[2]], [r[2], r[3]]].map(([a, b]) => ({ F: frame(a[0], 0, a[1], b[0] - a[0], b[1] - a[1]), L: Math.hypot(b[0] - a[0], b[1] - a[1]) })); };
  const facets = facetFrames();
  for (const [i, f] of facets.entries()) {
    const n = i === 1 ? 4 : 2, y = (O.panel[0] + O.panel[1]) / 2;
    B.push(f.F); for (let k = 0; k < n; k++) roundel(B, ((k + 0.5) * f.L) / n, y, 0.15); B.pop();
  }
  // the window stage: each facet a wall with its lights; tiers share the facet
  const y0 = tiers[0][0], y1 = tiers[tiers.length - 1][1];
  for (const [i, f] of facets.entries()) {
    const ops = [];
    for (const [ta, tb, nF] of tiers) {
      const n = i === 1 ? nF : 1, lw = i === 1 ? Math.min(0.62, (f.L - 0.5 - (n - 1) * 0.18) / n) : Math.min(0.5, f.L - 0.4);
      ops.push(...lightGroup(f.L / 2, n, ta + 0.05, tb - 0.08, lw, 0.18, 'pointed', 0.14).ops);
    }
    wall(B, f.F, rectPts(0, y0, f.L, y1), ops, 'bath');
    // shafts at the angles
    B.push(f.F); B.box('bathDress', 0.06, (y0 + y1) / 2, 0.06, 0.14, y1 - y0, 0.14, 0, {}); B.box('bathDress', f.L - 0.06, (y0 + y1) / 2, 0.06, 0.14, y1 - y0, 0.14, 0, {}); B.pop();
  }
  // the parapet: quatrefoil panels, a coping and carved head-stops at the front angles
  const [q0, q1] = O.parapet;
  K.prism(B, 'bathDress', ring(1, 0.04), y1, y1 + 0.1, { bottom: true });
  K.prism(B, 'bathDress', ring(1), y1 + 0.1, q1, { top: true });
  K.prism(B, 'bathDress', ring(1, 0.06), q1, q1 + 0.1, { top: true, bottom: true });
  const r = ring(1);
  for (const c of [r[1], r[2]]) B.box('bathOld', c[0] - 0.08, q0 - 0.05, c[1], 0.3, 0.34, 0.3, 0, { bottom: true });
  for (const [i, f] of facets.entries()) { const n = i === 1 ? 4 : 2; B.push(f.F); for (let k = 0; k < n; k++) roundel(B, ((k + 0.5) * f.L) / n, (y1 + q1) / 2 + 0.03, 0.11); B.pop(); }
}
/** a quatrefoil roundel: a flat moulded ring (octagon of short bars) standing just proud of the face, in the CURRENT frame */
function roundel(B, x, y, r) {
  for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2; B.beam('bathOld', [x + Math.cos(a0) * r, y + Math.sin(a0) * r, 0.02], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, 0.02], 0.045, 0.04); }
}
function buildOrielN(ctx) {
  const { B } = ctx, O = ORIEL_N, G = O.gable, vc = O.v;
  oriel(B, RANGE.uSt, vc, O, [[O.lights[0], O.lights[1], 4]]);
  // the coped gable over the bay, with its 2-light window, rising from the cornice
  const a = sS(vc - G.w / 2), b = sS(vc + G.w / 2), m = sS(vc), yP = ROOF.parapet - 0.05;
  const win = lightGroup(m, 2, G.win[0], G.win[1], 0.46, 0.16, 'pointed', 0.18);
  wall(B, FS(), [[a, ROOF.cornice], [b, ROOF.cornice], [b, yP], [m, G.apex], [a, yP]], win.ops, 'bath');
  B.push(FS());
  dressings(B, [win.box]);
  for (const [p, q] of [[[a - 0.12, yP - 0.02, 0.05], [m, G.apex + 0.12, 0.05]], [[m, G.apex + 0.12, 0.05], [b + 0.12, yP - 0.02, 0.05]]]) B.beam('bathDress', p, q, 0.42, 0.16);
  B.box('bathDress', m, G.apex + 0.3, 0.0, 0.28, 0.4, 0.28, 0, {});       // apex kneeler / finial block
  B.pop();
  K.roof(B, 'slate', RANGE.uSt + 0.15, G.roofTo, vc - G.w / 2 + 0.05, vc + G.w / 2 - 0.05, yP, G.apex - yP - 0.12, { axis: 'x', ends: ['open', 'hip'], ov: 0.02 });
}

// ------------------------------------------------------------------------------------------------ THE QUAD FRONT
export function buildQuad(ctx) {
  const { B } = ctx, P = QD;
  const pieces = [[T.v1, RANGE.vS, QUAD_S, QUAD_S_PIPES, 'round'], [RANGE.vN, T.v0, QUAD_N, QUAD_N_PIPES, 'tudor']];
  for (const [v0, v1, bays, pipes, head] of pieces) {
    const ops = [], boxes = [], doors = [];
    const grp = (s, k, y) => { const g = lightGroup(s, N_OF[k], y[0], y[1], P.lightW, P.mullion, head, P.reveal, 'leaded'); ops.push(...g.ops); boxes.push(g.box); };
    for (const b of bays) {
      const s = sQ(b.v);
      if (b.k === 'way') {
        // the covered way's open square-headed doorway (its threshold one step above the paving) and the low 2-lights
        const y0 = wayY0();
        ops.push({ pts: rectPts(s - WAY.w / 2, y0, s + WAY.w / 2, y0 + WAY.h), kind: 'void', d: WAY.wallT, revealKey: 'quadStone' });
        grp(s, 'two', WAY.upF); grp(s, 'two', WAY.upT);
        continue;
      }
      if (b.k === 'door') {
        const D = P.door, y0 = quadY(b.v) + 0.14;
        ops.push({ pts: tudorPts(s, D.w, y0, y0 + D.spring, D.rise, 6), kind: 'door', doorKey: 'oakDoor', d: 0.32, label: true, labelDrop: 0.3 });
        doors.push({ s, v: b.v, y0, stair: b.stair });
        grp(s, b.up, P.f); grp(s, b.up, P.t);
      } else for (const y of [P.g, P.f, P.t]) grp(s, b.k, y);
    }
    const a = sQ(v1), bEnd = sQ(v0);
    // (north piece) the covered way's way out at the north end, into the Thomas Wood Building's vestibule (no reveal: the
    // passage's own walls line it)
    if (v0 === RANGE.vN) ops.push({ pts: rectPts(sQ(WAY.vNs), WAY.yOut, sQ(WAY.vN), WAY.yOut + WAY.clear), kind: 'none' });
    wall(B, FQ(), footOutline(a, bEnd, ROOF.cornice, (s) => quadY(RANGE.vS - s)), ops, 'quadStone');
    B.push(FQ());
    dressings(B, boxes);
    const gb = Math.min(quadY(v0), quadY(v1)) - FOOT;
    // the plinth, broken at the covered way's doorway and at its way out at the north end
    const gaps = v0 === RANGE.vN ? [[sQ(WAY.v) - WAY.w / 2 - WAY.caseW, sQ(WAY.v) + WAY.w / 2 + WAY.caseW], [sQ(WAY.vNs), sQ(WAY.vN)]] : [];
    let x0 = a;
    for (const [g0, g1] of gaps) { K.stringCourse(B, 'bathOld', x0, g0, P.plinth, P.plinth - gb, P.plinthProj); x0 = g1; }
    K.stringCourse(B, 'bathOld', x0, bEnd, P.plinth, P.plinth - gb, P.plinthProj);
    for (const y of [P.s1, P.s2]) K.stringCourse(B, 'bathDress', a, bEnd, y, 0.16, 0.09);
    K.stringCourse(B, 'bathDress', a, bEnd, P.cornice, 0.22, 0.16);
    for (const v of pipes) pipe(B, sQ(v), quadY(v), P.cornice - 0.3, 0.14);
    for (const d of doors) {
      // the step, a door-case (square head over the four-centred arch) and the number plate
      B.box('pavingSolid', d.s, d.y0 - 0.25, 0.2, P.door.w + 0.5, 0.5, 0.4, 0, {});
      B.box('bathDress', d.s, d.y0 + P.door.spring + P.door.rise + 0.12, 0.04, P.door.w + 0.3, 0.12, 0.08, 0, {});
      if (d.stair) B.box('white', d.s + P.door.w / 2 + 0.35, d.y0 + 1.75, 0.02, 0.22, 0.28, 0.03, 0, {});
    }
    B.pop();
    const u = RANGE.uQd - ROOF.parapetT / 2;
    K.parapet(B, 'quadStone', [[u, v0 + ROOF.parapetT / 2], [u, v1 - ROOF.parapetT / 2]], ROOF.cornice, ROOF.parapet - ROOF.cornice - 0.08, ROOF.parapetT, { coping: 'bathDress' });
  }
  // north of the Chapel's south wall the quad face is a party wall: the Chapel's builder stands against it
}

// ------------------------------------------------------------------------------------------------ ENDS, ROOF, DORMERS, STACKS
export function buildRoof(ctx) {
  const { B } = ctx, u0 = RANGE.uSt + ROOF.parapetT, u1 = RANGE.uQd - ROOF.parapetT, rise = ROOF.ridge - ROOF.gutter;
  // party walls at the two ends (plain; the neighbours' builders stand against them)
  wall(B, frame(RANGE.uQd, 0, RANGE.vN, -1, 0), [[0, -0.9], [RANGE.uQd - RANGE.uSt, -0.9], [RANGE.uQd - RANGE.uSt, ROOF.gutter], [0, ROOF.gutter]], [], 'bathOld');
  wall(B, frame(RANGE.uSt, 0, RANGE.vS, 1, 0), [[0, -0.9], [RANGE.uQd - RANGE.uSt, -0.9], [RANGE.uQd - RANGE.uSt, ROOF.gutter], [0, ROOF.gutter]], [], 'bathOld');
  K.roof(B, 'slate', u0, u1, RANGE.vN, T.v0, ROOF.gutter, rise, { axis: 'z', ends: ['gable', 'open'], ov: 0, wallKey: 'bathOld' });
  K.roof(B, 'slate', u0, u1, T.v1, RANGE.vS, ROOF.gutter, rise, { axis: 'z', ends: ['open', 'gable'], ov: 0, wallKey: 'bathOld' });
  // the lead gutters behind the parapets
  for (const u of [u0 + 0.12, u1 - 0.12]) for (const [a, b] of [[RANGE.vN, T.v0], [T.v1, RANGE.vS]]) B.box('lead', u, ROOF.gutter - 0.05, (a + b) / 2, 0.3, 0.1, b - a, 0, {});
  // dormers: flat lead tops, slate-hung cheeks, white sashes
  const slope = rise / (RANGE.uQd - RANGE.uSt - 2 * ROOF.parapetT) * 2, depth = (DORMER.sill + DORMER.h + 0.15 - ROOF.gutter) / slope + 0.25;
  const D = DORMER, o = { roof: 'flat', key: 'leadDark', roofKey: 'slate', flatKey: 'lead', glass: 'sash', lights: D.lights };
  for (const v of DORMERS_ST) K.dormer(B, frame(u0 + 0.1, 0, v, 0, 1), 0, D.sill, D.w, D.h, depth, o);
  for (const v of DORMERS_QD) K.dormer(B, frame(u1 - 0.1, 0, v, 0, -1), 0, D.sill, D.w, D.h, depth, o);
  // clustered stacks: a square base on the ridge, round flues with moulded caps
  const roofAt = (u) => ROOF.ridge - (Math.abs(u - ROOF.ridgeU) / ((u1 - u0) / 2)) * rise;
  for (const S of STACKS) {
    const wu = S.nu * STACK.pitch + 0.2, wv = S.nv * STACK.pitch + 0.2, yb = roofAt(S.u - wu / 2) - 0.4;
    B.box('bath', S.u, (yb + STACK.base) / 2, S.v, wu, STACK.base - yb, wv, 0, {});
    B.box('bathDress', S.u, STACK.base + 0.08, S.v, wu + 0.14, 0.16, wv + 0.14, 0, { bottom: true });
    for (let i = 0; i < S.nu; i++) for (let j = 0; j < S.nv; j++) {
      const x = S.u + (i - (S.nu - 1) / 2) * STACK.pitch, z = S.v + (j - (S.nv - 1) / 2) * STACK.pitch;
      B.cyl('bath', x, STACK.base + 0.16, z, STACK.flueR, S.top - STACK.base - 0.36, 8, false);
      B.cyl('bathDress', x, S.top - 0.2, z, STACK.flueR + 0.06, 0.2, 8, true, STACK.flueR + 0.02);
    }
  }
}

/** the closing returns (plain stone from below the ground to the parapet's top) */
export function buildClosers(ctx) {
  for (const C of CLOSERS) K.prism(ctx.B, 'quadStone', C.ring, -0.6, C.top, { top: true });
}

// ------------------------------------------------------------------------------------------------ THE GATE TOWER
export function buildTower(ctx) {
  TH = threshold(ctx);
  const { B } = ctx, W = T.v1 - T.v0, D = T.uQd - T.uSt, sc = T.vc - T.v0;
  // ---- street face (faces west): the gate, the oriel over it, the 2-light above, two singles in the top stage
  {
    const gw = GATE.w, gy = streetY(T.vc), gp = pointedPts(sc, gw, gy - 0.02, GATE.spring, GATE.rise, 8);
    const arc = gp.slice(2).reverse();
    const bottomL = streetY(T.v0) - FOOT, bottomR = streetY(T.v1) - FOOT;
    const outline = [[0, bottomL], [sc - gw / 2, bottomL], ...arc, [sc + gw / 2, bottomR], [W, bottomR], [W, T.cornice], [0, T.cornice]];
    const up2 = lightGroup(sc, T.st.upper2.lights, T.st.upper2.y[0], T.st.upper2.y[1], 0.58, 0.17, 'pointed', 0.26);
    const up1 = T.st.upper1.s.map((d) => lightGroup(sc + d, 1, T.st.upper1.y[0], T.st.upper1.y[1], 0.55, 0, 'pointed', 0.26));
    wall(B, FTS(), outline, [{ pts: gp, kind: 'void', d: PASSAGE.rebate, notch: true, revealKey: 'bathDress' }, ...up2.ops, ...up1.flatMap((g) => g.ops)], 'bath');
    B.push(FTS());
    dressings(B, [up2.box, ...up1.map((g) => g.box)]);
    const oW = ORIEL_G.front / 2 + ORIEL_G.proj + 0.15;
    for (const y of T.st.strings) {
      if (y < ORIEL_G.parapet[1] + 0.1 && y > ORIEL_G.corbel[0] - 0.3) { K.stringCourse(B, 'bathDress', 0, sc - oW, y, 0.17, 0.1); K.stringCourse(B, 'bathDress', sc + oW, W, y, 0.17, 0.1); }
      else K.stringCourse(B, 'bathDress', -0.02, W + 0.02, y, 0.17, 0.1);
    }
    for (const [x0, x1] of [[0, sc - gw / 2 - 0.2], [sc + gw / 2 + 0.2, W]]) K.stringCourse(B, 'bathOld', x0, x1, ST.plinth, ST.plinth - Math.min(bottomL, bottomR), ST.plinthProj);
    // the arch's hood-moulding (an outer order) and the shafted jambs with capitals
    const hood = pointedPts(sc, gw + 0.5, gy, GATE.spring, GATE.rise + 0.3, 8).slice(2);
    for (let i = 0; i < hood.length - 1; i++) B.beam('bathDress', [hood[i][0], hood[i][1], 0.07], [hood[i + 1][0], hood[i + 1][1], 0.07], 0.18, 0.14);
    for (const x of [sc - gw / 2 - 0.1, sc + gw / 2 + 0.1]) {
      B.cyl('bathDress', x, gy, -0.05, 0.09, GATE.spring - gy - 0.15, 8, false);
      B.box('bathDress', x, GATE.spring - 0.08, -0.05, 0.3, 0.16, 0.3, 0, { bottom: true });
      B.box('bathDress', x, gy + 0.12, -0.05, 0.3, 0.24, 0.3, 0, {});
    }
    // the angel corbel under the oriel (a plain carved block with spread wings)
    const A = GATE.angel;
    B.box('bathDress', sc, A.y + A.h / 2, 0.2, 0.45, A.h, 0.4, 0, { bottom: true });
    for (const d of [-1, 1]) B.beam('bathDress', [sc + d * 0.15, A.y + 0.15, 0.18], [sc + d * A.w / 2, A.y + A.h, 0.12], 0.12, 0.22);
    // the pier buttresses either side of the gate
    for (const x of [sc - gw / 2 - 0.62, sc + gw / 2 + 0.62]) K.buttress(B, 'bath', x, Math.min(bottomL, bottomR), GATE.pier.w, GATE.pier.stages);
    B.pop();
    oriel(B, T.uSt, T.vc, ORIEL_G, [[ORIEL_G.lights[0], ORIEL_G.lights[1], 2], [ORIEL_G.lights2[0], ORIEL_G.lights2[1], 2]]);
    // the setts apron from the door to the kerb
    const y = (TH ?? streetY(T.vc)) + 0.003;      // (the apron: on the threshold's level, a hair under the passage's flags)
    // (fix-up pass: the pale setts tint of Margary Quad (_exeter_margary_plan.js SETTS_TINT, copied to keep the parts apart),
    // not the city's dark cell)
    { const Gc = ctx.pack.groundCells; if (Gc && Gc.get('setts') && !Gc.get('mqSetts')) Gc.set('mqSetts', { ...Gc.get('setts'), tint: [2.95, 3.0, 3.0] }); }
    B.flat(ctx.pack.groundCells && ctx.pack.groundCells.get('mqSetts') ? 'mqSetts' : 'setts', [[GATE.setts.u0, GATE.setts.v0], [T.uSt, GATE.setts.v0], [T.uSt, GATE.setts.v1], [GATE.setts.u0, GATE.setts.v1]], y);
  }
  // ---- quad face (faces east): four-centred arch; 3-light; 2-light; two singles; shield; lantern
  {
    // (sc here is measured from the quad face's own start, v1: the first pass used the street face's, 0.11 m off)
    const sc = T.v1 - T.vc, Q = T.qd, A = PASSAGE.qArch, gy = passY(T.uQd), ap = fourPts(sc, A.w, gy - 0.02, gy + A.spring, A.rise), big = growArch(ap, PASSAGE.chamfer);
    const arc = big.slice(2).reverse(), bL = quadY(T.v1) - FOOT, bR = quadY(T.v0) - FOOT;
    const outline = [[0, bL], [big[0][0], bL], ...arc, [big[1][0], bR], [W, bR], [W, T.cornice], [0, T.cornice]];
    const w3 = lightGroup(sc, 3, Q.w3[0], Q.w3[1], 0.5, 0.15, 'tudor', 0.24, 'leaded');
    const w2 = lightGroup(sc, 2, Q.w2[0], Q.w2[1], 0.52, 0.15, 'tudor', 0.24, 'leaded');
    const w1 = Q.w1s.map((d) => lightGroup(sc + d, 1, Q.w1[0], Q.w1[1], 0.5, 0, 'tudor', 0.24, 'leaded'));
    wall(B, FTQ(), outline, [...w3.ops, ...w2.ops, ...w1.flatMap((g) => g.ops)], 'quadStone');
    B.push(FTQ());
    chamferedReveal(B, 'bathDress', ap, big, T.uQd - PASSAGE.uE, PASSAGE.chamfer);      // the four-centred arch, chamfered both faces, through the 1.15 m wall
    dressings(B, [w3.box, w2.box, ...w1.map((g) => g.box)]);
    for (const y of Q.strings) K.stringCourse(B, 'bathDress', -0.02, W + 0.02, y, 0.17, 0.1);
    for (const [x0, x1] of [[0, big[0][0] - 0.05], [big[1][0] + 0.05, W]]) K.stringCourse(B, 'bathOld', x0, x1, QD.plinth, QD.plinth - Math.min(bL, bR), QD.plinthProj);      // (broken at the arch)
    const hood = fourPts(sc, A.w + 2 * PASSAGE.chamfer + 0.42, gy, gy + A.spring, A.rise + 0.18).slice(2);
    for (let i = 0; i < hood.length - 1; i++) B.beam('bathDress', [hood[i][0], hood[i][1], 0.06], [hood[i + 1][0], hood[i + 1][1], 0.06], 0.16, 0.12);
    // a blank shield over the arch (painted arms in life: no arms drawn)
    B.poly('bathDress', [[sc - 0.24, Q.shield + 0.3, 0.06], [sc + 0.24, Q.shield + 0.3, 0.06], [sc + 0.24, Q.shield - 0.05, 0.06], [sc, Q.shield - 0.32, 0.06], [sc - 0.24, Q.shield - 0.05, 0.06]], [0, 0, 1]);
    // (fix-up pass: a longer bracket was tried and made no measurable difference to the night wash near the arch: that comes
    // from the world's lamp pool and the nearest-lamp point light, both of which every lantern gets; see the report)
    const L = Q.lamp; B.box('ironBlack', sc + L.s, L.y + 0.62, L.arm / 2 + 0.02, 0.05, 0.05, L.arm + 0.05, 0, {});
    B.beam('ironBlack', [sc + L.s, L.y + 0.05, 0.02], [sc + L.s, L.y + 0.6, L.arm * 0.6], 0.035);      // the bracket's brace
    const p = K.lantern(B, sc + L.s, L.y, L.arm, { size: 0.3 });
    B.pop();
    ctx.lamp(T.uQd + p[2], p[1], T.v1 - p[0]);
  }
  // ---- side faces (north, south): full depth; seen above the range's roof and at the breaks forward
  for (const side of ['n', 's']) {
    const F = side === 'n' ? frame(T.uQd, 0, T.v0, -1, 0) : frame(T.uSt, 0, T.v1, 1, 0);
    const sW = side === 'n' ? (u) => T.uQd - u : (u) => u - T.uSt;
    const g = () => Math.min(streetY(T.v0), quadY(T.v0)) - FOOT;
    const groups = (side === 'n' ? [sW(-21.8), sW(-18.3)] : [sW(-22.3), sW(-16.4)]).map((s) => lightGroup(s, 1, T.sides.w1[0], T.sides.w1[1], 0.5, 0, 'pointed', 0.24));
    if (side === 'n') groups.push(lightGroup(sW(-21.8), 1, 13.35, 14.6, 0.5, 0, 'pointed', 0.24));
    // (below the range's gutter only the strips where the tower breaks forward of the range's two faces show: the rest
    // stands inside the range, where staircase 1's lobby is)
    const yG = ROOF.gutter - 0.3, sq = side === 'n' ? T.uQd - RANGE.uQd : RANGE.uSt - T.uSt, ss = side === 'n' ? T.uQd - RANGE.uSt : RANGE.uQd - T.uSt;
    wall(B, F, [[0, yG], [D, yG], [D, T.cornice], [0, T.cornice]], groups.flatMap((q) => q.ops), 'bath');
    wall(B, F, [[0, g()], [sq, g()], [sq, yG], [0, yG]], [], 'bath');
    wall(B, F, [[ss, g()], [D, g()], [D, yG], [ss, yG]], [], 'bath');
    B.push(F); dressings(B, groups.map((q) => q.box)); K.stringCourse(B, 'bathDress', -0.02, D + 0.02, T.st.strings[3], 0.17, 0.1); B.pop();
  }
  // ---- the top: cornice with bosses, battlemented parapet, octagonal corner turrets, lead flat, flagpole
  const ring = [[T.uSt, T.v0], [T.uQd, T.v0], [T.uQd, T.v1], [T.uSt, T.v1]];
  const t = 0.4, inner = [[T.uSt + t / 2, T.v0 + t / 2], [T.uQd - t / 2, T.v0 + t / 2], [T.uQd - t / 2, T.v1 - t / 2], [T.uSt + t / 2, T.v1 - t / 2]];
  for (let i = 0; i < 4; i++) {
    const a = ring[i], b = ring[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    // cornice band projecting all round, with carved bosses (plain blocks) at intervals
    const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, nx = dz, nz = -dx;      // outward normal of a clockwise ring edge
    B.box('bathDress', cx + nx * 0.1, T.cornice - 0.14, cz + nz * 0.1, Math.abs(dx) * (L + 0.4) + Math.abs(dz) * 0.2 + 0.001, 0.28, Math.abs(dz) * (L + 0.4) + Math.abs(dx) * 0.2 + 0.001, 0, { bottom: true });
    const nB = Math.max(2, Math.round(L / 1.9));
    for (let k = 1; k < nB; k++) { const f = k / nB; B.box('bathOld', a[0] + (b[0] - a[0]) * f + nx * 0.22, T.cornice - 0.3, a[1] + (b[1] - a[1]) * f + nz * 0.22, 0.26, 0.3, 0.26, 0, { bottom: true }); }
  }
  K.parapet(B, 'bath', [...inner, inner[0]], T.cornice, T.parapetH, t, { battle: T.merlon, coping: 'bathDress' });
  B.flat('lead', inner, T.roof);
  for (const [u, v] of ring) {
    B.cyl('bathDress', u, T.cornice - 0.75, v, T.turretR, 0.6, 8, false, 0.12);            // corbelled out under the cornice
    B.cyl('bath', u, T.cornice - 0.15, v, T.turretR, T.turretTop - T.cornice + 0.15, 8, false);
    B.cyl('bathDress', u, T.turretTop, v, T.turretR + 0.1, 0.18, 8, true, T.turretR + 0.04);
    B.cyl('bathDress', u, T.turretTop + 0.18, v, 0.03, T.turretCap - 0.18, 8, false, T.turretR);
  }
  // the octagonal stair turret on the south side, rising out of the range's roof, with a moulded cap
  { const S = T.stair; B.cyl('bath', S.u, ROOF.gutter, S.v, S.r, S.top - ROOF.gutter, 8, false);
    B.cyl('bathDress', S.u, S.top, S.v, S.r + 0.14, 0.22, 8, true, S.r + 0.05);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; B.box('bath', S.u + Math.cos(a) * S.r * 0.92, S.top + 0.47, S.v + Math.sin(a) * S.r * 0.92, 0.32, 0.5, 0.22, -a + Math.PI / 2, {}); }
    B.cyl('lead', S.u, S.top + 0.22, S.v, 0.05, 0.6, 8, false, S.r * 0.8);
    for (const y of [13.4, 15.6]) B.box('glassDark', S.u + S.r * 0.93, y, S.v, 0.03, 0.7, 0.14, 0, {}); }
  B.cyl('white', T.flag.u, T.roof, T.flag.v, 0.035, T.flag.top - T.roof, 6, true, 0.06);
}

// ------------------------------------------------------------------------------------------------ THE PASSAGE
// (joins pass: rebuilt from the 1:50 drawings; every figure and its source in PASSAGE, _exeter_west_plan.js)
/** the passage's floor at u: the street threshold's level rising to the quad's */
const passY = (u) => { const yW = TH ?? streetY(T.vc), yE = quadY(T.vc); return yW + ((u - T.uSt) / (T.uQd - T.uSt)) * (yE - yW); };
/** the passage's geometry derived from the plan */
function passGeo() {
  const P = PASSAGE, L = P.uE - P.uW, hw = (P.vS - P.vN) / 2, a = (L - P.band - 2 * P.endBand) / 4, um = (P.uW + P.uE) / 2;
  const F0 = passY(um), S = F0 + P.spring, R = Math.hypot(a, hw);
  return { P, L, hw, a, um, F0, S, R, bays: [P.uW + P.endBand + a, P.uE - P.endBand - a] };
}
/** a true FOUR-CENTRED arch opening [lb, rb, rs, ...arc, ls]: at each springing a haunch arc of radius kh x half-width
 *  turns until its tangent runs straight to the apex `rise` above the springing (the Tudor arch of Halling 2025: quick
 *  haunches, nearly straight upper sides to a point; the kit's tudorPts reads round at this width) */
function fourPts(x, w, y0, ys, rise, seg = 5, kh = 0.42) {
  const r = w / 2, rh = kh * r, cx = r - rh;      // the right haunch's centre, from x
  const apexY = (f) => { const px = cx + rh * Math.cos(f), py = rh * Math.sin(f); return py + (px / Math.sin(f)) * Math.cos(f); };
  let lo = 0.05, hi = Math.PI / 2 - 0.01; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (apexY(m) > rise) lo = m; else hi = m; }
  const phi = (lo + hi) / 2, right = [];
  for (let i = 0; i <= seg; i++) { const f = (phi * i) / seg; right.push([x + cx + rh * Math.cos(f), ys + rh * Math.sin(f)]); }
  const p = [[x - r, y0], [x + r, y0], ...right, [x, ys + rise]];
  for (let i = right.length - 1; i >= 0; i--) p.push([2 * x - right[i][0], right[i][1]]);
  return p;
}
/** a flat moulding ribbon from a to b, w wide across `side` (a unit vector), facing n (one quad; two sides if both) */
function ribbon(B, key, a, b, w, side, n, both = false) {
  const h = w / 2, q = [add3(a, side, -h), add3(b, side, -h), add3(b, side, h), add3(a, side, h)];
  B.poly(key, q, n); if (both) B.poly(key, q, [-n[0], -n[1], -n[2]]);
}
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
/** an arch opening outline (pointed / four-centred: [lb, rb, rs, ...arc, ls]) grown outwards by c (its chamfer's width) */
function growArch(pts, c) {
  const ch = [pts[1], ...pts.slice(2), pts[0]], out = [];
  const nrm = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
  for (let i = 0; i < ch.length; i++) {
    const n1 = i > 0 ? nrm(ch[i - 1], ch[i]) : null, n2 = i < ch.length - 1 ? nrm(ch[i], ch[i + 1]) : null;
    if (i === 0 || i === ch.length - 1) { out.push([ch[i][0] + (i === 0 ? c : -c), ch[i][1]]); continue; }
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const k = c / Math.max(0.5, nx * n1[0] + ny * n1[1]); out.push([ch[i][0] + nx * k, ch[i][1] + ny * k]);
  }
  return [out[out.length - 1], out[0], ...out.slice(1, -1)];
}
/** chamfers (45 deg) round an opening in the CURRENT wall frame: from the grown outline on the face (z 0) to the opening
 *  at z -c, the reveal to -(depth - c), and the chamfer on the far face; the bottom edge left open */
function chamferedReveal(B, key, pts, big, depth, c) {
  const n = pts.length, ring = (q) => [...q.slice(1), q[0]];      // rb .. ls, lb (the chain without the bottom edge)
  const A = ring(pts), G = ring(big);
  for (let i = 0; i < n - 1; i++) {
    const p = A[i], q = A[i + 1], P = G[i], Q = G[i + 1], cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2, ox = (P[0] + Q[0]) / 2 - cx, oy = (P[1] + Q[1]) / 2 - cy;
    B.poly(key, [[P[0], P[1], 0], [Q[0], Q[1], 0], [q[0], q[1], -c], [p[0], p[1], -c]], [-ox, -oy, 1]);
    B.poly(key, [[p[0], p[1], -c], [q[0], q[1], -c], [q[0], q[1], -(depth - c)], [p[0], p[1], -(depth - c)]], [-ox, -oy, 0]);
    B.poly(key, [[p[0], p[1], -(depth - c)], [q[0], q[1], -(depth - c)], [Q[0], Q[1], -depth], [P[0], P[1], -depth]], [-ox, -oy, -1]);
  }
}
/** a wall outline [[s, y]] from s0 to s1 whose foot is at yb and whose top follows top(s), with an opening notched into the
 *  foot (op = the opening's [lb, rb, rs, ...arc, ls] in the same s) or none */
function notchedOutline(s0, s1, yb, top, op, n = 48) {
  const out = [[s0, yb]];
  if (op) { out.push([op[0][0], yb], ...op.slice(2).reverse(), [op[1][0], yb]); }
  out.push([s1, yb]);
  for (let i = 0; i <= n; i++) { const s = s1 - ((s1 - s0) * i) / n; out.push([s, top(s)]); }
  return out;
}
export function buildPassage(ctx) {
  const { B } = ctx, g = passGeo(), { P, L, hw, a, um, F0, S, R } = g, vc = P.vc, D = P.dome;
  const sph = (du, dv) => S + Math.sqrt(Math.max(0, R * R - du * du - dv * dv));
  // ---- the floor: York flags from the street face to the quad face
  const fl = [[T.uSt, P.vN], [T.uQd, P.vN], [T.uQd, P.vS], [T.uSt, P.vS]];
  B.poly('paving', fl.map(([u, v]) => [u, passY(u) + 0.01, v]), [0, 1, 0], fl.map(([u, v]) => [u / 2.2, v / 2.2]));
  ctx.floor(fl, (u) => passY(u) + 0.01);
  // ---- the side walls: up to the springing, the wall arches' semicircles in each bay
  const sideTop = (u) => { for (const bc of g.bays) if (Math.abs(u - bc) < a) return S + Math.sqrt(a * a - (u - bc) * (u - bc)); return S; };
  const sc1 = P.sc1, uSc = g.bays[1], uLo = g.bays[0], LO = P.lodge;
  wall(B, frame(P.uW, 0, P.vN, 1, 0), notchedOutline(0, L, -0.4, (s) => sideTop(P.uW + s), null), [], 'bathDress');
  { const FS = frame(P.uE, 0, P.vS, -1, 0), s = (u) => P.uE - u, ySc = passY(uSc), yLo = passY(uLo);
    const ops = [
      { pts: rectPts(s(uSc) - sc1.w / 2, ySc - 0.05, s(uSc) + sc1.w / 2, ySc + sc1.head), kind: 'void', d: sc1.wallT, revealKey: 'bathDress' },
      { pts: rectPts(s(uLo) - LO.w / 2, yLo + LO.sill, s(uLo) + LO.w / 2, yLo + LO.sill + LO.h), kind: 'win', glass: 'glassDark', sill: false, d: 0.3, revealKey: 'bathDress' },
    ];
    wall(B, FS, notchedOutline(0, L, -0.4, (q) => sideTop(P.uE - q), null), ops, 'bathDress');
    B.push(FS);
    // staircase 1's square-headed doorway: a moulded architrave and a cornice over it
    { const x = s(uSc), w = sc1.w / 2, t = sc1.sur, y0 = ySc, yH = ySc + sc1.head;
      for (const d of [-1, 1]) B.box('bathDress', x + d * (w + t / 2), (y0 + yH + t) / 2, 0.04, t, yH + t - y0, 0.08, 0, {});
      B.box('bathDress', x, yH + t / 2, 0.04, sc1.w + 2 * t, t, 0.08, 0, {});
      B.box('bathDress', x, ySc + sc1.surTop - 0.05, 0.07, sc1.w + 2 * t + 0.16, 0.1, 0.14, 0, { bottom: true }); }
    // the lodge's opening: a plain stone surround, the glazed door's middle rail and a blank plate where the arms are etched
    { const x = s(uLo), w = LO.w / 2, t = LO.sur, y0 = yLo + LO.sill, yH = y0 + LO.h;
      for (const d of [-1, 1]) B.box('bathDress', x + d * (w + t / 2), (y0 + yH + t) / 2 - 0.15, 0.03, t, yH + t - y0 + 0.3, 0.06, 0, {});
      B.box('bathDress', x, yH + t / 2, 0.03, LO.w + 2 * t, t, 0.06, 0, {});
      B.box('frame', x, (y0 + yH) / 2, -0.27, 0.06, LO.h, 0.04, 0, {});
      B.box('white', x - w / 2, y0 + 1.35, -0.26, 0.3, 0.3, 0.01, 0, {}); }
    B.pop();
  }
  // ---- pilasters with moulded bases and capitals: at both ends (corner pilasters) and under the cross arch
  const Pl = P.pil;
  for (const [u, w] of [[P.uW + Pl.wEnd / 2, Pl.wEnd], [um, Pl.w], [P.uE - Pl.wEnd / 2, Pl.wEnd]]) for (const sd of [-1, 1]) {
    const vw = vc + sd * hw, vf = vw - sd * Pl.proj / 2, y0 = passY(u);
    B.box('bathDress', u, (y0 + S - Pl.capH) / 2, vf, w, S - Pl.capH - y0, Pl.proj, 0, {});
    B.box('bathOld', u, y0 + Pl.baseH / 2, vw - sd * (Pl.proj + 0.06) / 2, w + 0.1, Pl.baseH, Pl.proj + 0.06, 0, {});
    B.box('bathDress', u, S - Pl.capH * 0.65, vw - sd * (Pl.proj + Pl.capProj) / 2, w + 2 * Pl.capProj, Pl.capH * 0.7, Pl.proj + Pl.capProj, 0, { bottom: true });
    B.box('bathOld', u, S - Pl.capH * 0.15, vw - sd * (Pl.proj + Pl.capProj + 0.04) / 2, w + 2 * Pl.capProj + 0.08, Pl.capH * 0.3, Pl.proj + Pl.capProj + 0.04, 0, { bottom: true });
  }
  // ---- the arches across the passage: the cross arch (a flat soffit `band` wide) and the two end arches; each soffit is a
  // semicircle of archR, its faces the ring between the soffit and the bays' vault (radius hw at the bays' ends)
  const N = 18, arc = (u, r, i) => { const t = (i / N) * Math.PI; return [u, S + Math.sin(t) * r, vc - Math.cos(t) * r]; };
  const archBand = (u0, u1, faces) => {
    for (let i = 0; i < N; i++) {
      const t = ((i + 0.5) / N) * Math.PI;
      B.poly('bathDress', [arc(u0, P.archR, i), arc(u1, P.archR, i), arc(u1, P.archR, i + 1), arc(u0, P.archR, i + 1)], [0, -Math.sin(t), Math.cos(t)]);
      for (const [u, dir] of faces) B.poly('bathDress', [arc(u, P.archR, i), arc(u, hw, i), arc(u, hw, i + 1), arc(u, P.archR, i + 1)], [dir, 0, 0]);
      for (const u of [u0 + 0.06, u1 - 0.06]) ribbon(B, 'bathOld', arc(u, P.archR - 0.015, i), arc(u, P.archR - 0.015, i + 1), 0.06, [1, 0, 0], [0, -Math.sin(t), Math.cos(t)]);      // the panel's mouldings
    }
  };
  archBand(um - P.band / 2, um + P.band / 2, [[um - P.band / 2, -1], [um + P.band / 2, 1]]);
  archBand(P.uW, P.uW + P.endBand, [[P.uW + P.endBand, 1]]);
  archBand(P.uE - P.endBand, P.uE, [[P.uE - P.endBand, -1]]);
  cartouche(B, um, S + P.archR - 0.04, vc, 0.2, 0.26);
  // ---- each bay: pendentives (the sphere through the four corners, from the bay's edges in to the ring), the wreath ring,
  // the saucer dome with interlaced ribs, the pendant, blank cartouches in the spandrels, the wall arches' mouldings
  for (const bc of g.bays) {
    const yR = sph(D.r, 0), yC = yR + D.rise, dome = (du, dv) => yR + D.rise * (1 - (du * du + dv * dv) / (D.r * D.r));
    const th = []; for (let i = 0; i < 32; i++) th.push((i / 32) * Math.PI * 2);
    for (const c of [Math.atan2(hw, a), Math.atan2(hw, -a), Math.atan2(-hw, -a), Math.atan2(-hw, a)]) th.push((c + Math.PI * 2) % (Math.PI * 2));
    th.sort((x, y) => x - y);
    const rho = (t) => Math.min(a / Math.max(1e-6, Math.abs(Math.cos(t))), hw / Math.max(1e-6, Math.abs(Math.sin(t))));
    const at = (t, k) => { const r = D.r + (rho(t) - D.r) * k, du = Math.cos(t) * r, dv = Math.sin(t) * r; return [bc + du, sph(du, dv), vc + dv]; };
    for (let i = 0; i < th.length; i++) {
      const t0 = th[i], t1 = i + 1 < th.length ? th[i + 1] : th[0] + Math.PI * 2;
      for (let k = 0; k < 4; k++) B.poly('plasterLit', [at(t0, k / 4), at(t1, k / 4), at(t1, (k + 1) / 4), at(t0, (k + 1) / 4)], [0, -1, 0]);
    }
    const M = 20, ringPt = (r, i, y) => { const t = (i / M) * Math.PI * 2; return [bc + Math.cos(t) * r, y, vc + Math.sin(t) * r]; };
    for (let i = 0; i < M; i++) {
      for (const [r0, r1] of [[0, D.r * 0.4], [D.r * 0.4, D.r * 0.75], [D.r * 0.75, D.r]]) {
        const p = (r, j) => { const t = (j / M) * Math.PI * 2, du = Math.cos(t) * r, dv = Math.sin(t) * r; return [bc + du, dome(du, dv), vc + dv]; };
        if (r0 === 0) B.poly('plasterLit', [p(0, i), p(r1, i), p(r1, i + 1)], [0, -1, 0]);
        else B.poly('plasterLit', [p(r0, i), p(r1, i), p(r1, i + 1), p(r0, i + 1)], [0, -1, 0]);
      }
      B.beam('bathDress', ringPt(D.r + 0.02, i - 0.08, yR - 0.05), ringPt(D.r + 0.02, i + 1.08, yR - 0.05), D.ring, 0.16);       // the wreath (segments lapped)
      const ro = D.r + D.ring / 2 + 0.12, y1 = sph(ro, 0) - 0.02;
      { const t0 = ((i + 0.5) / M) * Math.PI * 2; ribbon(B, 'bathOld', ringPt(ro, i, y1), ringPt(ro, i + 1, y1), 0.07, [Math.cos(t0), 0, Math.sin(t0)], [0, -1, 0]); }   // its outer moulding
    }
    // interlaced ribs: circles through the dome's centre touching the ring, as thin strips under the dome's surface
    for (let k = 0; k < D.ribs; k++) {
      const ca = (k / D.ribs) * Math.PI * 2, cu = Math.cos(ca) * D.r / 2, cv = Math.sin(ca) * D.r / 2, rr = D.r / 2, n = 14;
      for (let i = 0; i < n; i++) {
        const q = (j, o) => { const t = (j / n) * Math.PI * 2, du = cu + Math.cos(t) * (rr + o), dv = cv + Math.sin(t) * (rr + o); return [bc + du, dome(du, dv) - 0.02, vc + dv]; };
        B.poly('bathDress', [q(i, -0.025), q(i + 1, -0.025), q(i + 1, 0.025), q(i, 0.025)], [0, -1, 0]);
      }
    }
    // the pendant: a carved drop (a tapering boss, a blank cartouche, a finial)
    B.cyl('bathDress', bc, yC - 0.4, vc, 0.2, 0.4, 8, false, 0.1);
    cartouche(B, bc, yC - 0.5, vc, 0.14, 0.18, true);
    B.cyl('bathDress', bc, yC - D.pendant, vc, 0.08, D.pendant - 0.55, 8, false, 0.02);
    for (const sd of [-1, 1]) cartouche(B, bc, 0, vc + sd * 1.45, 0.26, 0.3, false, (du, dv) => sph(du, dv + sd * 1.45) - 0.03);
    for (const sd of [-1, 1]) {
      const v = vc + sd * (hw - 0.03);
      for (let i = 0; i < 14; i++) { const t0 = (i / 14) * Math.PI, t1 = ((i + 1) / 14) * Math.PI, tm = (t0 + t1) / 2, r = a - 0.06; ribbon(B, 'bathOld', [bc - Math.cos(t0) * r, S + Math.sin(t0) * r, v], [bc - Math.cos(t1) * r, S + Math.sin(t1) * r, v], 0.1, [-Math.cos(tm), Math.sin(tm), 0], [0, 0, -sd]); }
    }
  }
  // ---- the end walls' inner faces: up to the end arches' soffits; the street door opening (2.6 at the leaves) and the
  // quad arch (four-centred, chamfered, 2.85) through them
  const endTop = (dv) => (Math.abs(dv) < P.archR ? S + Math.sqrt(P.archR * P.archR - dv * dv) : S);
  const W = P.vS - P.vN;
  { const yW = passY(P.uW), sc = P.vS - vc, leaf = pointedPts(sc, 2 * P.leafW, yW - 0.3, yW + P.leafSpring, P.leafRise, 8);
    wall(B, frame(P.uW, 0, P.vS, 0, -1), notchedOutline(0, W, -0.4, (s) => endTop(P.vS - s - vc), leaf), [{ pts: leaf, kind: 'void', d: P.uW - T.uSt - P.rebate, notch: true, revealKey: 'bathDress' }], 'bathDress');
    // the step in the reveal where the face's wider arch meets the leaves' opening (faces the street)
    const FR = frame(T.uSt + P.rebate, 0, T.v0, 0, 1), so = T.vc - T.v0, gy = streetY(T.vc);
    const O = pointedPts(so, GATE.w, gy - 0.02, GATE.spring, GATE.rise, 8), I = pointedPts(so, 2 * P.leafW, gy - 0.02, yW + P.leafSpring, P.leafRise, 8);
    B.push(FR); B.face('bathDress', [O[0], I[0], ...I.slice(2).reverse(), I[1], O[1], ...O.slice(2)]); B.pop(); }
  { const yE = passY(P.uE), sc = vc - P.vN, A = P.qArch, ap = fourPts(sc, A.w, yE - 0.3, yE + A.spring, A.rise), big = growArch(ap, P.chamfer);
    wall(B, frame(P.uE, 0, P.vN, 0, 1), notchedOutline(0, W, -0.4, (s) => endTop(P.vN + s - vc), big), [], 'bathDress'); }
  // ---- the street doors: two studded oak leaves of 1.3 standing OPEN into the passage, the wicket in the north leaf
  { const yb = passY(P.uW), half = P.leafW, sp = yb + P.leafSpring;
    const arcPts = pointedPts(0, 2 * half, yb, sp, P.leafRise, 8).slice(2).filter((p) => p[0] >= -0.001);
    const top = arcPts.map((p) => [half - p[0], p[1]]).sort((x, y) => x[0] - y[0]);      // (0, spring) .. (half, apex)
    const ol = [[0, yb], [half, yb], ...top.slice().reverse()];
    for (const d of [-1, 1]) {
      const v = vc + d * (half - 0.07), F = frame(P.uW + 0.02, 0, v, 1, 0);
      B.push(F);
      B.face('oakDoor', ol, [], 0.06 * d);
      B.face('oakDoor', ol, [], -0.06 * d, true);
      B.box('oakDoor', half - 0.03, (yb + top[top.length - 1][1]) / 2, 0, 0.06, top[top.length - 1][1] - yb, 0.12, 0, {});      // the meeting stile's edge
      for (let k = 1; k < 8; k++) B.box('ironBlack', half / 2, yb + (k * (sp - 0.2 - yb)) / 7.5, 0.065 * -d, half - 0.1, 0.05, 0.02, 0, {});
      for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { const x = 0.2 + (i * (half - 0.4)) / 3, y = yb + 0.25 + (j * (sp - 0.45 - yb)) / 7, z = 0.068 * d; B.poly('ironBlack', [[x - 0.025, y - 0.025, z], [x + 0.025, y - 0.025, z], [x + 0.025, y + 0.025, z], [x - 0.025, y + 0.025, z]], [0, 0, d]); }      // studs
      if (d < 0) {      // the wicket: its frame on both faces, a ring handle
        const W2 = P.wicket, x0 = (half - W2.w) / 2, x1 = x0 + W2.w, y0 = yb + 0.12, y1 = y0 + W2.h;
        for (const z of [0.07, -0.07]) { B.box('ironBlack', x0, (y0 + y1) / 2, z, 0.05, W2.h, 0.02, 0, {}); B.box('ironBlack', x1, (y0 + y1) / 2, z, 0.05, W2.h, 0.02, 0, {}); B.box('ironBlack', (x0 + x1) / 2, y1, z, W2.w, 0.05, 0.02, 0, {}); }
        B.cyl('ironBlack', x1 - 0.12, y0 + 0.95, 0.09, 0.05, 0.02, 8, true);
      }
      B.pop();
    }
  }
  // ---- the platform lift in the flags before the lodge's door (lowered): a steel edge round a flagged plate
  { const Lf = P.lift, y = passY(uLo) + 0.016, u0 = uLo - Lf.l / 2, u1 = uLo + Lf.l / 2, v0 = P.vS - Lf.d, v1 = P.vS;
    B.box('ironBlack', (u0 + u1) / 2, y, v0, Lf.l, 0.012, 0.05, 0, {});
    for (const u of [u0, u1]) B.box('ironBlack', u, y, (v0 + v1) / 2, 0.05, 0.012, Lf.d, 0, {}); }
  // ---- the 2021 access gates at the cross arch: fixed panels from the pilasters, two leaves standing open towards the quad
  { const Gt = P.gate, y0 = passY(um), pf = hw - Pl.proj;
    const panel = (F, len) => {
      B.push(F);
      for (const y of [y0 + 0.08, y0 + Gt.h - 0.32, y0 + Gt.h]) B.box('ironBlack', len / 2, y, 0, len, 0.035, 0.03, 0, {});
      const nb = Math.max(2, Math.round(len / 0.13));
      for (let i = 0; i <= nb; i++) { const x = (i * len) / nb, e = i === 0 || i === nb; B.box('ironBlack', x, y0 + (Gt.h + 0.08) / 2, 0, e ? 0.05 : 0.018, Gt.h - 0.08, e ? 0.05 : 0.018, 0, { top: e }); }
      for (let i = 0; i < nb; i++) { const xa = (i * len) / nb, xb = ((i + 1) * len) / nb, xm = (xa + xb) / 2;      // pointed loops under the top rail
        for (const [p, q] of [[[xa, y0 + Gt.h - 0.32, 0], [xm, y0 + Gt.h - 0.1, 0]], [[xm, y0 + Gt.h - 0.1, 0], [xb, y0 + Gt.h - 0.32, 0]]]) { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); ribbon(B, 'ironBlack', p, q, 0.016, [-dy / l, dx / l, 0], [0, 0, 1], true); } }
      B.pop();
    };
    for (const d of [-1, 1]) {
      panel(frame(um, 0, vc + d * pf, 0, -d), pf - Gt.leaf);                    // the fixed panel, from the pilaster to the leaf's post
      panel(frame(um + 0.03, 0, vc + d * Gt.leaf, 1, 0), Gt.leaf);              // the leaf, open: along the passage towards the quad
    }
    B.box('ironBlack', um + 0.03, y0 + 0.6, vc - Gt.leaf - 0.04, 0.1, 0.22, 0.08, 0, {});     // the lock box on the north post
  }
  // ---- a small light fitting at the quad arch's crown inside (Halling 2025); the passage's light comes from the
  // pendants' level in the middle (a single lamp: one at the arch doubled the tower's lantern and burnt the quad face out)
  { const y = passY(P.uE) + P.qArch.spring + P.qArch.rise + 0.35; B.box('white', P.uE - 0.08, y, vc, 0.14, 0.18, 0.22, 0, {}); ctx.lamp(um, S + P.archR - 0.25, vc); }
  buildSc1(ctx, g);
}
/** a blank oval cartouche (no arms): a framed oval plate in a horizontal plane at y, facing down (or a hanging plate) */
function cartouche(B, u, y, v, ru, rv, hanging = false, yOn = null) {
  const n = 12, pts = []; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pts.push([Math.cos(t) * ru, Math.sin(t) * rv]); }
  if (hanging) { for (const sd of [-1, 1]) B.poly('bathDress', pts.map(([x, z]) => [u + x, y + z, v + sd * 0.05]), [0, 0, sd]); return; }
  // (yOn: the plate follows a curved soffit, each point at yOn(du, dv) below it)
  const Y = (x, z, k = 1) => (yOn ? yOn(x * k, z * k) : y);
  B.poly('bathDress', pts.map(([x, z]) => [u + x, Y(x, z), v + z]), [0, -1, 0]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = Math.hypot(p[0] + q[0], p[1] + q[1]) || 1; ribbon(B, 'bathOld', [u + p[0] * 1.1, Y(p[0], p[1], 1.1) - 0.02, v + p[1] * 1.1], [u + q[0] * 1.1, Y(q[0], q[1], 1.1) - 0.02, v + q[1] * 1.1], 0.07, [(p[0] + q[0]) / m, 0, (p[1] + q[1]) / m], [0, -1, 0]); }
}
/** staircase 1's three steps and its lobby (the stair's foot and the lodge's inner door) */
function buildSc1(ctx, g) {
  const { B } = ctx, P = PASSAGE, C = P.sc1, uc = g.bays[1], y0 = passY(uc), u0 = uc - C.w / 2, u1 = uc + C.w / 2, vW = P.vS + C.wallT;
  C.steps.forEach((h, i) => {
    const va = P.vS + i * C.going, vb = i < C.steps.length - 1 ? va + C.going : vW;
    B.box('pavingSolid', uc, (y0 - 0.05 + y0 + h) / 2, (va + vb) / 2, C.w, h + 0.05, vb - va, 0, {});
    ctx.floor([[u0, va], [u1, va], [u1, vb], [u0, vb]], y0 + h);
  });
  // the lobby
  const [lu0, lu1] = C.lobbyU, lv0 = vW, lv1 = C.lobbyV1, yf = y0 + C.steps[C.steps.length - 1], yc = yf + C.ceil;
  B.flat('pavingSolid', [[lu0, lv0], [lu1, lv0], [lu1, lv1], [lu0, lv1]], yf);
  ctx.floor([[lu0, lv0], [lu1, lv0], [lu1, lv1], [lu0, lv1]], yf);
  B.flat('plaster', [[lu0, lv0], [lu1, lv0], [lu1, lv1], [lu0, lv1]], yc, [], true);
  const box = (s0, s1) => [[s0, yf - 0.05], [s1, yf - 0.05], [s1, yc + 0.02], [s0, yc + 0.02]];
  wall(B, frame(lu0, 0, lv0, 1, 0), box(0, lu1 - lu0), [{ pts: rectPts(u0 - lu0, yf - 0.06, u1 - lu0, y0 + C.head), kind: 'none' }], 'plasterLit');      // north (the doorway)
  wall(B, frame(lu1, 0, lv1, -1, 0), box(0, lu1 - lu0), [], 'plasterLit');                                                                              // south
  wall(B, frame(lu1, 0, lv0, 0, 1), box(0, lv1 - lv0), [], 'plasterLit');                                                                               // east
  wall(B, frame(lu0, 0, lv1, 0, -1), box(0, lv1 - lv0), [{ pts: rectPts(lv1 - (lv0 + 0.7), yf, lv1 - (lv0 + 0.15), yf + 2.05), kind: 'door', doorKey: 'doorOak', d: 0.08 }], 'plasterLit');   // west: the lodge's inner door
  // the stair's foot: four winders rising west along the south wall, the well dark above them
  for (let i = 0; i < 4; i++) { const ua = lu1 - 0.3 - (i + 1) * 0.28, h = 0.18 * (i + 1); B.box('pavingSolid', ua + 0.14, yf + h / 2, lv1 - 0.45, 0.28, h, 0.9, 0, {}); }
  B.poly('dark', [[lu1 - 1.45, yc - 0.01, lv1 - 0.9], [lu1 - 0.3, yc - 0.01, lv1 - 0.9], [lu1 - 0.3, yc - 0.01, lv1], [lu1 - 1.45, yc - 0.01, lv1]], [0, -1, 0]);
  // (fix-up pass: no ctx.lamp here: a lamp's light is a pool on the ground plan that ignores walls, and this closed lobby's
  //  pool, 3 m from the quad arch, added to the arch lantern's and the passage's and washed the quad face out white)
}

// ------------------------------------------------------------------------------------------------ THE COVERED WAY (staircase 7)
/** the covered way's floor at (u, v): the door's level, a ramp down the corridor, the north end's level */
function wayFloor(u, v) {
  const W = WAY, y0 = wayY0();
  if (v >= W.ramp[0]) return y0;
  if (v <= W.ramp[1]) return W.yOut;
  return y0 + ((W.ramp[0] - v) / (W.ramp[0] - W.ramp[1])) * (W.yOut - y0);
}
/** a plastered inner wall in frame F from s0 to s1 whose foot and head follow the floor (floorAtS(s)); ops openings */
function lining(B, F, s0, s1, floorAtS, ops = [], n = 6) {
  const p = [];
  for (let i = 0; i <= n; i++) { const s = s0 + ((s1 - s0) * i) / n; p.push([s, floorAtS(s) - 0.05]); }
  for (let i = n; i >= 0; i--) { const s = s0 + ((s1 - s0) * i) / n; p.push([s, floorAtS(s) + WAY.clear + 0.02]); }
  wall(B, F, p, ops, 'plasterLit');
}
export function buildWay(ctx) {
  const { B } = ctx, W = WAY, y0 = wayY0(), vc = W.v, s = sQ(vc), hw = W.w / 2, c = W.caseW, top = y0 + W.h;
  const uIn = RANGE.uQd - W.wallT;
  // ---- outside, in the quad face's frame: the step, a plain stone case and label, the lantern, the shield, the plate
  B.push(FQ());
  const pv = fqPave(RANGE.uQd + 0.2, vc);
  B.box('pavingSolid', s, (y0 + pv - 0.3) / 2, 0.19, W.w + 0.6, y0 - pv + 0.3, 0.38, 0, {});
  for (const x of [s - hw - c / 2, s + hw + c / 2]) B.box('bathDress', x, (y0 + top) / 2, 0.03, c, W.h, 0.07, 0, {});
  B.box('bathDress', s, top + c / 2, 0.03, W.w + 2 * c, c, 0.07, 0, {});
  K.label(B, s - hw - c - 0.06, s + hw + c + 0.06, top + c + 0.1, 0.32);
  const sl = sQ(vc + W.lantern.dv), yl = W.lantern.y;
  B.box('ironBlack', sl, yl + 0.66, 0.3, 0.045, 0.045, 0.6, 0, {});
  B.beam('ironBlack', [sl, yl + 0.2, 0.02], [sl, yl + 0.64, 0.4], 0.028);
  const p = K.lantern(B, sl, yl, 0.55, { size: 0.26 });
  const ss = sQ(vc + W.shield.dv), ys = W.shield.y;
  B.poly('bathDress', [[ss - 0.16, ys + 0.2, 0.05], [ss + 0.16, ys + 0.2, 0.05], [ss + 0.16, ys - 0.04, 0.05], [ss, ys - 0.24, 0.05], [ss - 0.16, ys - 0.04, 0.05]], [0, 0, 1]);
  B.box('white', s - hw - c - 0.3, y0 + 1.6, 0.02, 0.2, 0.26, 0.03, 0, {});      // the staircase's number plate (7)
  B.pop();
  ctx.lamp(RANGE.uQd + p[2], p[1], RANGE.vS - p[0]);

  // ---- floors (flags): the lobby with the door's reveal, the corridor (level, ramp, level), the north leg
  const flat = (u0, u1, v0, v1, f) => B.poly('pavingSolid', [[u0, f(u0, v1), v1], [u1, f(u1, v1), v1], [u1, f(u1, v0), v0], [u0, f(u0, v0), v0]], [0, 1, 0]);
  const ceil = (u0, u1, v0, v1, f) => B.poly('plaster', [[u0, f(u0, v0) + W.clear, v0], [u1, f(u1, v0) + W.clear, v0], [u1, f(u1, v1) + W.clear, v1], [u0, f(u0, v1) + W.clear, v1]], [0, -1, 0]);
  const pieces = [[W.uW, uIn, W.vL, W.vS], [W.uW, W.uE, W.ramp[0], W.vL], [W.uW, W.uE, W.ramp[1], W.ramp[0]], [W.uW, W.uE, W.vNs, W.ramp[1]], [W.uW, W.uOut, W.vN, W.vNs]];
  for (const [u0, u1, v0, v1] of pieces) { flat(u0, u1, v0, v1, wayFloor); ceil(u0, u1, v0, v1, wayFloor); }
  ctx.floor([[W.uW, W.vS], [RANGE.uQd, W.vS], [RANGE.uQd, W.vL], [W.uW, W.vL]], y0);
  ctx.floor([[W.uW, W.vL], [W.uE, W.vL], [W.uE, W.vNs], [W.uW, W.vNs]], (u, v) => wayFloor(u, v));
  ctx.floor([[W.uW, W.vNs], [W.uOut, W.vNs], [W.uOut, W.vN], [W.uW, W.vN]], W.yOut);
  ctx.floor([[RANGE.uQd, vc - hw - 0.3], [RANGE.uQd + 0.38, vc - hw - 0.3], [RANGE.uQd + 0.38, vc + hw + 0.3], [RANGE.uQd, vc + hw + 0.3]], y0);   // the step

  // ---- the plastered walls
  const St = W.stair, sd = St.n * St.going + 0.12;
  // west wall (faces east, s north from the lobby's south wall), with the opening to staircase 7's foot
  { const yS = wayFloor(0, St.v1);
    lining(B, frame(W.uW, 0, W.vS, 0, -1), 0, W.vS - W.vN, (q) => wayFloor(0, W.vS - q), [{ pts: rectPts(W.vS - St.v1, yS, W.vS - St.v0, yS + 2.1), kind: 'void', d: sd, revealKey: 'plasterLit' }], 10);
    for (let i = 0; i < St.n; i++) {
      const ua = W.uW - i * St.going, yt = yS + St.rise * (i + 1);
      B.box('pavingSolid', ua - St.going / 2, (yt + yS - 0.1) / 2, (St.v0 + St.v1) / 2, St.going, yt - yS + 0.1, St.v1 - St.v0, 0, {});
    }
    B.poly('dark', [[W.uW - sd + 0.01, yS - 0.05, St.v1], [W.uW - sd + 0.01, yS - 0.05, St.v0], [W.uW - sd + 0.01, yS + 2.1, St.v0], [W.uW - sd + 0.01, yS + 2.1, St.v1]], [1, 0, 0]); }
  // east wall (faces west, s south from the north leg's south wall to the lobby's north wall: the Chapel's gable behind it)
  lining(B, frame(W.uE, 0, W.vNs, 0, 1), 0, W.vL - W.vNs, (q) => wayFloor(0, W.vNs + q), [], 10);
  lining(B, frame(W.uE, 0, W.vL, 1, 0), 0, uIn - W.uE, () => y0, [], 1);                 // lobby, north wall
  lining(B, frame(uIn, 0, W.vS, -1, 0), 0, uIn - W.uW, () => y0, [], 1);                 // lobby, south wall
  lining(B, frame(uIn, 0, W.vL, 0, 1), 0, W.vS - W.vL, () => y0, [{ pts: rectPts(vc - hw - W.vL, y0, vc + hw - W.vL, top), kind: 'none' }], 1);   // the quad wall's inner face
  lining(B, frame(W.uW, 0, W.vN, 1, 0), 0, W.uOut - W.uW, () => W.yOut, [], 1);          // north wall (the party wall behind)
  lining(B, frame(W.uOut, 0, W.vNs, -1, 0), 0, W.uOut - W.uE, () => W.yOut, [], 1);      // the north leg's south wall
  // ceiling lights (small white fittings) and their light
  for (const v of W.lights) {
    const u = v < W.vNs ? (W.uW + W.uOut) / 2 : (W.uW + W.uE) / 2, yc = wayFloor(u, v) + W.clear;
    B.box('white', u, yc - 0.04, v, 0.32, 0.06, 0.32, 0, {});
    ctx.lamp(u, yc - 0.2, v);
  }
}

// ------------------------------------------------------------------------------------------------ THE BED AND THE ROSE (north of staircase 8)
export function buildBed(ctx) {
  const { B } = ctx;
  K.addCell(ctx.pack, 'roseBloom', 'leafA', 0xb04a63);
  K.addCell(ctx.pack, 'flowerY', 'leafA', 0xd9b43a);
  let seed = 4127; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const y = (u, v) => fqPave(u, v) + 0.015;
  for (const Bd of BEDS) {
    const u0 = Bd.uWall ?? RANGE.uQd, u1 = u0 + Bd.w, small = !!Bd.flowers;
    B.poly('flowerbed', [[u0, y(u0, Bd.s), Bd.s], [u1, y(u1, Bd.s), Bd.s], [u1, y(u1, Bd.n), Bd.n], [u0, y(u0, Bd.n), Bd.n]], [0, 1, 0]);
    // big-leaved plants (or, in the flower strips, low tufts with a few blooms): rosettes of leaves arching out from the
    // crown (each leaf two tilted triangles)
    for (let i = 0; i < Bd.plants; i++) {
      const v = Bd.s - ((i + 0.5) / Bd.plants) * (Bd.s - Bd.n) + (rnd() - 0.5) * 0.25, u = u0 + Math.min(0.3, Bd.w / 2) + rnd() * Math.max(0.05, Bd.w - 0.45), g = y(u, v), n = 9 + Math.floor(rnd() * 5), H = (small ? 0.18 : 0.35) + rnd() * (small ? 0.12 : 0.35);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rnd() * 0.5, L = (small ? 0.18 : 0.35) + rnd() * (small ? 0.12 : 0.3), w = (small ? 0.06 : 0.12) + rnd() * 0.08, up = H * (0.5 + rnd() * 0.7);
        const ca = Math.cos(a), sa = Math.sin(a), tip = [u + ca * L, g + up * 0.55, v + sa * L];
        const side = (d) => [u + ca * L * 0.5 - sa * w * d, g + up * 0.85, v + sa * L * 0.5 + ca * w * d];
        const key = ['leafC', 'box', 'leafA', 'leafC'][(i + k) % 4];
        B.poly(key, [[u, g + 0.04, v], side(1), tip], [0, 1, 0]); B.poly(key, [[u, g + 0.04, v], tip, side(-1)], [0, 1, 0]);
      }
      if (small) for (let k = 0; k < 4; k++) B.box(rnd() < 0.5 ? 'flowerY' : 'roseBloom', u + (rnd() - 0.5) * 0.3, g + H + 0.02, v + (rnd() - 0.5) * 0.3, 0.06, 0.05, 0.06, 0, {});
    }
  }
  // the rose: a fan of wires from the bed, leaves along them kept off the windows, a few blooms
  const clearOf = (v, yy) => {
    for (const b of QUAD_N) {
      if (b.k === 'three' || b.k === 'two') { const hw = (N_OF[b.k] * QD.lightW + (N_OF[b.k] - 1) * QD.mullion) / 2 + 0.12; if (Math.abs(v - b.v) < hw) for (const r of [QD.g, QD.f, QD.t]) if (yy > r[0] - 0.2 && yy < r[1] + 0.45) return false; }
      if (b.k === 'door' && Math.abs(v - b.v) < QD.door.w / 2 + 0.3 && yy < 3.1) return false;
    }
    return true;
  };
  B.push(FQ());
  const R = ROSE, lines = [...R.wires.map((e) => [[R.v, R.y0], e]), R.cross];
  for (const [a, b] of lines) {
    B.beam('ironBlack', [sQ(a[0]), a[1], 0.03], [sQ(b[0]), b[1], 0.03], 0.012);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / 0.07);
    for (let k = 1; k <= n; k++) {
      const t = k / n, v = a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * 0.4, yy = a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * 0.4;
      if (!clearOf(v, yy) || yy < 0.4) continue;
      const x = sQ(v), r = 0.05 + rnd() * 0.05, ang = rnd() * Math.PI * 2, z = 0.05 + rnd() * 0.12;
      B.poly(rnd() < 0.55 ? 'leafC' : 'box', [0, 1, 2].map((j) => [x + Math.cos(ang + j * 2.09) * r, yy + Math.sin(ang + j * 2.09) * r, z + (j === 0 ? 0.03 : 0)]), [0, 0.2, 1]);
      if (rnd() < 0.09) B.box('roseBloom', x, yy, z + 0.04, 0.07, 0.07, 0.05, 0, {});
    }
  }
  B.pop();
}

// ------------------------------------------------------------------------------------------------ COLLIDERS
export function registerSolids(ctx) {
  const P = PASSAGE, W = WAY, uIn = RANGE.uQd - W.wallT, d0 = W.v + W.w / 2, d1 = W.v - W.w / 2;
  // the range north of the tower, with the covered way through it: the outline (open at the doorway and at the north end)
  // and the way's own walls
  ctx.seg(RANGE.uSt, RANGE.vN, RANGE.uSt, T.v0); ctx.seg(RANGE.uSt, T.v0, RANGE.uQd, T.v0); ctx.seg(RANGE.uQd, RANGE.vN, RANGE.uSt, RANGE.vN);
  ctx.seg(RANGE.uQd, T.v0, RANGE.uQd, d0); ctx.seg(RANGE.uQd, d1, RANGE.uQd, W.vNs); ctx.seg(RANGE.uQd, W.vN, RANGE.uQd, RANGE.vN);
  const line = (pts) => { for (let i = 0; i < pts.length - 1; i++) ctx.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); };
  line([[RANGE.uQd, d0], [uIn, d0], [uIn, W.vS], [W.uW, W.vS], [W.uW, W.vN], [W.uOut, W.vN]]);
  line([[RANGE.uQd, d1], [uIn, d1], [uIn, W.vL], [W.uE, W.vL], [W.uE, W.vNs], [W.uOut, W.vNs]]);
  // the range south of the tower and the tower's south part, as one outline open at staircase 1's doorway into its lobby
  { const C = P.sc1, uc = passGeo().bays[1], d0 = uc - C.w / 2, d1 = uc + C.w / 2, vW = P.vS + C.wallT, [l0, l1] = C.lobbyU;
    line([[d1, P.vS], [T.uQd, P.vS], [T.uQd, T.v1], [RANGE.uQd, T.v1], [RANGE.uQd, RANGE.vS], [RANGE.uSt, RANGE.vS], [RANGE.uSt, T.v1], [T.uSt, T.v1], [T.uSt, P.vS], [d0, P.vS]]);
    line([[d0, P.vS], [d0, vW], [l0, vW], [l0, C.lobbyV1], [l1, C.lobbyV1], [l1, vW], [d1, vW], [d1, P.vS]]); }
  ctx.solid([[T.uSt, T.v0], [T.uQd, T.v0], [T.uQd, P.vN], [T.uSt, P.vN]]);
  // the jambs of the two openings inside the passage's width (the street doors' 2.6 m, the quad arch's 2.85 m)
  const g0 = P.vc - P.leafW, g1 = P.vc + P.leafW, q0 = P.vc - P.qArch.w / 2, q1 = P.vc + P.qArch.w / 2;
  ctx.solid([[T.uSt, P.vN], [P.uW, P.vN], [P.uW, g0], [T.uSt, g0]]); ctx.solid([[T.uSt, g1], [P.uW, g1], [P.uW, P.vS], [T.uSt, P.vS]]);
  ctx.solid([[P.uE, P.vN], [T.uQd, P.vN], [T.uQd, q0], [P.uE, q0]]); ctx.solid([[P.uE, q1], [T.uQd, q1], [T.uQd, P.vS], [P.uE, P.vS]]);
  // the street doors standing open along the passage, the 2021 gates' fixed panels and open leaves (the middle stays clear)
  for (const d of [-1, 1]) {
    const v = P.vc + d * (P.leafW - 0.07); ctx.seg(P.uW, v, P.uW + P.leafW, v);
    const um = (P.uW + P.uE) / 2, pf = (P.vS - P.vN) / 2 - P.pil.proj;
    ctx.seg(um, P.vc + d * pf, um, P.vc + d * P.gate.leaf); ctx.seg(um, P.vc + d * P.gate.leaf, um + P.gate.leaf, P.vc + d * P.gate.leaf);
  }
  for (const C of CLOSERS) ctx.solid(C.ring);
  // the gate's pier buttresses
  for (const v of [g0 - 0.62, g1 + 0.62]) ctx.solid([[T.uSt - GATE.pier.stages[0][1], v - GATE.pier.w / 2], [T.uSt, v - GATE.pier.w / 2], [T.uSt, v + GATE.pier.w / 2], [T.uSt - GATE.pier.stages[0][1], v + GATE.pier.w / 2]]);
}
