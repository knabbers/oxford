// The Sultan Nazrin Shah Centre itself (places/worcester_snsc.js): Niall McLaughlin Architects, opened 2017. Clipsham
// limestone ashlar in 300 mm courses; a colonnade of thirteen tapered piers to the cricket field with sloping stone
// soffits between them (three bays of seminar room, six open bays of terrace and steps under an oak pergola, three
// more of seminar room); behind, the foyer under a flat grey roof, the fan-shaped auditorium rising through it as an
// arc of tall glass between stone fins, the dance studio with its splayed stone hood standing in the pool, the
// entrance front facing down the path from the court. Everything is in the building's frame (_snsc_plan.js): a along
// the field front, b into the building, y above the playing field. What is seen in which picture: CHECKED there.
import * as P from './_snsc_plan.js';
import { inset } from './_snsc_tools.js';
import { rectPts } from './_worcester_kit.js';
import { joists, JOIST } from './_snsc_climb.js';

const ST = 'snscStone', SOFK = 'snscSoffit', BR = 'snscBronze', OAK = 'snscOak', TIM = 'snscTimber', STEP = 'snscStep', ROOF = 'grey';

export function buildCentre(T, B) {
  const { q, vq, bx, fl, wall } = T, { Y, LEN, DEP, TERR, PIER, STUDIO: S, ENTR: E, FAN, DRUM, pierA } = P;
  const FL = Y.floor, HD = Y.head, PAR = Y.parapet, SOF = PAR - 0.14, PD = PIER.d, a0 = TERR.a0, a1 = TERR.a1, DR = Y.drum;
  const blank = (A, Bp, y1 = PAR, y0 = 0) => wall(A, Bp, (l) => B.face(ST, rectPts(0, y0, l, y1)));
  /** a wall with one framed window of glass */
  const windowed = (A, Bp, s0, s1, y0, y1, o = {}) => wall(A, Bp, (l) => {
    const r = rectPts(s0, y0, l - s1, y1), d = o.depth ?? 0.25;
    B.face(ST, rectPts(0, 0, l, PAR), [r]); B.reveal(ST, r, 0, -d); T.win(s0, y0, l - s1, y1, { z: -d, cols: o.cols || 1 });
  });

  T.inFrame(() => {
    // ================================================================= the field front: fascia, piers, soffits
    vq(ST, [[0, SOF, 0], [LEN, SOF, 0], [LEN, PAR, 0], [0, PAR, 0]], [0, 0, -1]);
    for (let i = 0; i <= 12; i++) {
      const c = pierA(i), free = i > 3 && i < 9;
      const fL = i === 0 ? 0 : i === 9 ? a1 : c - PIER.f, fR = i === 12 ? LEN : i === 3 ? a0 : c + PIER.f;
      vq(ST, [[fL, 0, 0], [fR, 0, 0], [fR, SOF, 0], [fL, SOF, 0]], [0, 0, -1]);
      if (i !== 0 && i !== 9) vq(ST, [[c - PIER.f, 0, 0], [c - PIER.k, 0, PD], [c - PIER.k, HD, PD], [c - PIER.f, SOF, 0]], [-1, 0, -0.2]);
      if (i !== 12 && i !== 3) vq(ST, [[c + PIER.f, 0, 0], [c + PIER.k, 0, PD], [c + PIER.k, HD, PD], [c + PIER.f, SOF, 0]], [1, 0, -0.2]);
      if (free) vq(ST, [[c - PIER.k, 0.9, PD], [c + PIER.k, 0.9, PD], [c + PIER.k, HD, PD], [c - PIER.k, HD, PD]], [0, 0, 1]);
    }
    const bayEdge = (i) => ({ lf: i === 3 ? a0 : pierA(i) + PIER.f, lb: i === 3 ? a0 : pierA(i) + PIER.k, rf: i === 8 ? a1 : pierA(i + 1) - PIER.f, rb: i === 8 ? a1 : pierA(i + 1) - PIER.k });
    for (let i = 0; i < 12; i++) { const e = bayEdge(i); q(SOFK, [[e.lf, SOF, 0], [e.rf, SOF, 0], [e.rb, HD, PD], [e.lb, HD, PD]], [0, -1, -0.3]); }
    vq(ST, [[a0, HD, PD], [a1, HD, PD], [a1, PAR, PD], [a0, PAR, PD]], [0, 0, 1]);      // the hood's back, over the terrace
    // the seminar rooms' bays: the plinth with its chequer of flood openings, a sill, one sheet of glass
    for (const i of [0, 1, 2, 9, 10, 11]) {
      const e = bayEdge(i), pb = PD - 0.12;
      wall([e.lb - 0.03, pb], [e.rb + 0.03, pb], (l) => {
        const holes = [], h = 0.13, x0 = l / 2 - 0.62;
        for (let j = 0; j < 3; j++) for (let k = 0; k < 4; k++) { const x = x0 + k * 0.3 + (j % 2) * 0.15, y = 0.16 + j * 0.15; holes.push(rectPts(x, y, x + h, y + h)); }
        B.face(ST, rectPts(0, 0, l, FL), holes);
        B.poly('dark', [[x0 - 0.05, 0.1, -0.1], [x0 + 1.25, 0.1, -0.1], [x0 + 1.25, 0.65, -0.1], [x0 - 0.05, 0.65, -0.1]], [0, 0, 1]);
      });
      q(ST, [[e.lb - 0.03, FL, pb], [e.rb + 0.03, FL, pb], [e.rb + 0.03, FL, PD], [e.lb - 0.03, FL, PD]], [0, 1, 0]);
      wall([e.lb, PD], [e.rb, PD], (l) => T.win(0, FL, l, HD));
    }
    // the ends: blank ashlar; two slot windows near the front of the south-east one
    wall([LEN, 0], [LEN, DEP], (l) => {
      const slots = [rectPts(1.45, FL + 0.1, 1.75, HD), rectPts(2.4, FL + 0.1, 2.7, HD)];
      B.face(ST, rectPts(0, 0, l, PAR), slots);
      for (const r of slots) { B.reveal(ST, r, 0, -0.3); T.pane(r[0][0], r[0][1], r[2][0], r[2][1], -0.3); }
    });
    blank([0, DEP], [0, 0]);
    // ================================================================= the terrace: walls, flight, floor, doors, pergola
    blank([a0, 0], [a0, DEP]); blank([a1, DEP], [a1, 0]);
    { const r = FL / TERR.n;
      for (let k = 0; k < TERR.n; k++) bx(STEP, a0, a1, 0, (k + 1) * r, TERR.s0 + k * TERR.tread, k === TERR.n - 1 ? DEP + 0.2 : TERR.s0 + (k + 1) * TERR.tread);      // (the terrace's floor runs on under the doors)
      // bronze handrails at the two ends of the flight
      for (const a of [a0 + 0.14, a1 - 0.14]) {
        B.beam(BR, [a, r + 0.92, -(TERR.s0 + 0.15)], [a, FL + 0.92, -(TERR.top + 0.35)], 0.045);
        for (const [b, y] of [[TERR.s0 + 0.15, r], [TERR.s0 + 4 * TERR.tread + 0.15, 5 * r], [TERR.top + 0.35, FL]]) bx(BR, a - 0.018, a + 0.018, y, y + 0.92, b - 0.018, b + 0.018, { top: false });
      } }
    wall([a0, DEP], [a1, DEP], (l) => {
      const edges = [0.12, ...[4, 5, 6, 7, 8].map((i) => pierA(i) - a0), l - 0.12], yT = FL + 3.3; let prev = 0;
      B.face(ST, rectPts(0, yT, l, PAR));
      for (let i = 0; i < 6; i++) {
        const s0 = edges[i] + (i ? 0.3 : 0), s1 = edges[i + 1] - (i < 5 ? 0.3 : 0), r = rectPts(s0, FL, s1, yT);
        B.face(ST, rectPts(prev, FL, s0, yT)); prev = s1;
        B.reveal(ST, r, 0, -0.14, true); T.win(s0, FL, s1, yT, { z: -0.14, cols: 2, bar: 0.085 });
      }
      B.face(ST, rectPts(prev, FL, l, yT));
    });
    for (const i of [4, 5, 6, 7, 8]) B.cyl(ST, pierA(i), FL, -(DEP - 0.34), 0.17, HD - FL + 0.02, 10, false);      // round stone columns before the glass
    for (let i = 3; i <= 9; i++) { const a = i === 3 ? a0 + 0.06 : i === 9 ? a1 - 0.06 : pierA(i); bx(TIM, a - 0.05, a + 0.05, HD - 0.02, HD + 0.28, PD, DEP, { bottom: true }); }      // the pergola (the photograph under it, looking north-west): a deep beam on each pier line ...
    for (const [b, j0, j1] of joists()) bx(TIM, j0, j1, JOIST.bot, JOIST.top, b - JOIST.hw, b + JOIST.hw, { bottom: true });      // ... ten joists housed into them, tops near flush: pale limed timber, about as wide as the beams (_snsc_climb.js I1: four are down in the south-east bay)
    // ================================================================= round the rest, counter-clockwise from the south-east end
    blank([LEN, DEP], [S.a0, DEP]);
    windowed([S.a0, DEP], [S.a0, S.b0], 0.3, 0.3, FL, HD, { depth: 0.3 });      // the foyer's window in the angle
    blank([S.a0, S.b0], [S.tip, S.b0]);                                         // the studio's flank to the field
    blank([S.tip, S.b1], [E.tip, S.b1]);                                        // ... and to the entrance path
    // --- the studio's hood: splayed cheeks and soffit, a stone apron in the water, three sheets of glass
    { const g = S.glass, tp = S.tip, ck = S.cheek, yH = FL + 3.4, e = 0.08;
      vq(ST, [[g, 0, S.b0 + ck], [tp, 0, S.b0 + e], [tp, SOF, S.b0 + e], [g, yH, S.b0 + ck]], [0, 0, 1]);
      vq(ST, [[g, 0, S.b1 - ck], [tp, 0, S.b1 - e], [tp, SOF, S.b1 - e], [g, yH, S.b1 - ck]], [0, 0, -1]);
      vq(ST, [[tp, 0, S.b0], [tp, 0, S.b0 + e], [tp, SOF, S.b0 + e], [tp, SOF, S.b0]], [1, 0, 0]);
      vq(ST, [[tp, 0, S.b1 - e], [tp, 0, S.b1], [tp, SOF, S.b1], [tp, SOF, S.b1 - e]], [1, 0, 0]);
      q(SOFK, [[g, yH, S.b0 + ck], [g, yH, S.b1 - ck], [tp, SOF, S.b1 - e], [tp, SOF, S.b0 + e]], [0.3, -1, 0]);
      vq(ST, [[tp, SOF, S.b0], [tp, SOF, S.b1], [tp, PAR, S.b1], [tp, PAR, S.b0]], [1, 0, 0]);
      const k0 = S.b0 + ck - 0.06, k1 = S.b1 - ck + 0.06;
      wall([g + 0.14, k0], [g + 0.14, k1], (l) => B.face(ST, rectPts(0, 0, l, FL)));
      q(ST, [[g, FL, k0], [g + 0.14, FL, k0], [g + 0.14, FL, k1], [g, FL, k1]], [0, 1, 0]);
      wall([g, S.b0 + ck], [g, S.b1 - ck], (l) => T.win(0, FL, l, yH, { cols: 3, bar: 0.06 })); }
    // --- the entrance front (faces down the path): five piers, sloping soffits, the bronze doors, two bays of the
    // e-hub's glass, the plant room's oak boarding
    { const eg = E.glass, et = E.tip, HE = FL + 3.2, bs = E.piers.slice().sort((x, y) => x - y), f = 0.15, k = 0.3;
      vq(ST, [[et, SOF, S.b1], [et, SOF, P.NEND], [et, PAR, P.NEND], [et, PAR, S.b1]], [1, 0, 0]);
      bs.forEach((bj, j) => {
        const lo = j === 0 ? S.b1 : bj - f, hi = j === bs.length - 1 ? P.NEND : bj + f;
        vq(ST, [[et, 0, lo], [et, 0, hi], [et, SOF, hi], [et, SOF, lo]], [1, 0, 0]);
        if (j < bs.length - 1) vq(ST, [[et, 0, bj + f], [eg, 0, bj + k], [eg, HE, bj + k], [et, SOF, bj + f]], [0.2, 0, 1]);
        if (j > 0) vq(ST, [[et, 0, bj - f], [eg, 0, bj - k], [eg, HE, bj - k], [et, SOF, bj - f]], [0.2, 0, -1]);
        if (j < bs.length - 1) { const n = bs[j + 1]; q(SOFK, [[et, SOF, bj + f], [et, SOF, n - f], [eg, HE, n - k], [eg, HE, bj + k]], [0.3, -1, 0]); }
      });
      wall([eg, bs[0] + k], [eg, bs[4] - k], (l) => {
        const s = (b) => b - bs[0] - k, door = [0, s(bs[1] - k)], g1 = [s(bs[1] + k), s(bs[2] - k)], g2 = [s(bs[2] + k), s(bs[3] - k)], pl = [s(bs[3] + k), l];
        B.face(ST, rectPts(0, 0, l, FL));
        for (const [u, v] of [[door[1], g1[0]], [g1[1], g2[0]], [g2[1], pl[0]]]) B.face(ST, rectPts(u, FL, v, HE));      // (behind the piers)
        // the doorway: a bronze frame, a light each side, two glazed bronze leaves with pull handles, lights over
        B.poly(BR, [[door[0], FL, 0], [door[1], FL, 0], [door[1], HE, 0], [door[0], HE, 0]], [0, 0, 1]);
        const m = (door[0] + door[1]) / 2, dw = 0.92, yD = FL + 2.5;
        T.pane(door[0] + 0.07, FL + 0.07, m - dw - 0.06, HE - 0.07, 0.016); T.pane(m + dw + 0.06, FL + 0.07, door[1] - 0.07, HE - 0.07, 0.016);
        for (const sg of [-1, 1]) { T.pane(Math.min(m, m + sg * dw) + 0.09, FL + 0.12, Math.max(m, m + sg * dw) - 0.09, yD - 0.09, 0.016); B.box(BR, m + sg * 0.16, FL + 1.15, 0.05, 0.03, 0.5, 0.05, 0, { bottom: true }); }
        T.pane(m - dw + 0.05, yD + 0.05, m + dw - 0.05, HE - 0.07, 0.016);
        T.win(g1[0], FL, g1[1], HE, { cols: 2 }); T.win(g2[0], FL, g2[1], HE, { cols: 2 });
        B.poly(OAK, [[pl[0], FL, 0], [pl[1], FL, 0], [pl[1], HE, 0], [pl[0], HE, 0]], [0, 0, 1]);
      }); }
    // --- the north and north-west sides (the plant room, the e-hub's back, the stage, the store): blank ashlar
    blank([E.tip, P.NEND], [17.3, 38.46]); blank([17.3, 38.46], [16.05, 38.46]); blank([16.05, 38.46], [16.05, 31.63]); blank([16.05, 31.63], [17.59, 31.63]);
    wall([17.59, 31.63], [17.59, DRUM.nB], (l) => {
      const ws = [rectPts(0.45, FL, 2.75, HD), rectPts(l - 2.75, FL, l - 0.45, HD)];
      B.face(ST, rectPts(0, 0, l, PAR), ws);
      for (const r of ws) { B.reveal(ST, r, 0, -0.25); T.win(r[0][0], FL, r[2][0], HD, { z: -0.25, cols: 2 }); }
    });
    const VY = DRUM.valley, STG = Y.stage, pv = DRUM.pv, qv = DRUM.qv, st = P.stageArc(8).reverse();      // st: from the north end round to the west end
    wall([DRUM.ne, DRUM.nB], pv, (l) => { const s0 = DRUM.ne - 17.59, sF = DRUM.ne - DRUM.fullA; B.face(ST, [[0, PAR], [s0, PAR], [s0, 0], [l, 0], [l, VY], [sF, DR], [0, DR]]); });
    wall([DRUM.ne, DRUM.neB], [DRUM.ne, DRUM.nB], (l) => B.face(ST, rectPts(0, PAR, l, DR)));
    wall([FAN.c[0] + FAN.rg, DRUM.neB], [DRUM.ne, DRUM.neB], (l) => B.face(ST, rectPts(0, PAR, l, DR)));
    wall(pv, st[0], (l) => B.face(ST, [[0, 0], [l, 0], [l, STG], [0, VY]]));
    for (let i = 0; i < st.length - 1; i++) blank(st[i], st[i + 1], STG);
    wall(st[st.length - 1], qv, (l) => B.face(ST, [[0, 0], [l, 0], [l, VY], [0, STG]]));
    wall(qv, [0, qv[1]], (l) => { B.face(ST, rectPts(0, 0, l, PAR)); B.unit('doorGrey', rectPts(0.55, 0.03, 1.5, 2.15), 0.012); });
    blank([0, qv[1]], [0, 8.66]); blank([0, 8.66], [3.05, 8.66]);
    windowed([3.05, 8.66], [3.05, DEP], 0.3, 0.3, FL, HD, { depth: 0.3 });
    blank([3.05, DEP], [0, DEP]);
    // ================================================================= the auditorium above the roof
    // its north-west wall and the return at the front; the clerestory: fifteen bays of glass between stone fins,
    // a sloping stone soffit and a flat cap over them
    wall(qv, [DRUM.nw, DRUM.front], (l) => B.face(ST, [[0, PAR], [l, PAR], [l, DR], [qv[1] - DRUM.fullB, DR], [0, VY]]));
    wall([DRUM.nw, DRUM.front], [DRUM.retA, DRUM.front], (l) => B.face(ST, rectPts(0, PAR, l, DR)));
    wall([DRUM.retA, DRUM.front], [DRUM.retA, FAN.c[1] - FAN.rg], (l) => B.face(ST, rectPts(0, PAR, l, DR)));
    const yG0 = PAR + 0.35, yG1 = DR - 0.75, yS1 = DR - 0.14, n = FAN.n, ri = FAN.rg - DRUM.capIn;
    const at = (phi, r, y) => { const p = P.fanPt(phi, r); return [p[0], y, p[1]]; };
    for (let i = 0; i < n; i++) {
      const f0 = (i / n) * Math.PI / 2, f1 = ((i + 1) / n) * Math.PI / 2, fm = (f0 + f1) / 2, out = [Math.cos(fm), 0, -Math.sin(fm)];
      vq(ST, [at(f0, FAN.rg, PAR), at(f1, FAN.rg, PAR), at(f1, FAN.rg, yG0), at(f0, FAN.rg, yG0)], out);
      { const b = T.bay(), g = [at(f0, FAN.rg, yG0), at(f1, FAN.rg, yG0), at(f1, FAN.rg, yG1), at(f0, FAN.rg, yG1)];
        q('snscGlass', g, out, [[b[0] + 0.16, b[1] + 0.79], [b[0] + 0.27, b[1] + 0.79], [b[0] + 0.27, b[1] + 0.87], [b[0] + 0.16, b[1] + 0.87]]); }
      q(SOFK, [at(f0, FAN.rg, yG1), at(f1, FAN.rg, yG1), at(f1, FAN.ro, yS1), at(f0, FAN.ro, yS1)], [out[0] * 0.3, -1, out[2] * 0.3]);
      vq(ST, [at(f0, FAN.ro, yS1), at(f1, FAN.ro, yS1), at(f1, FAN.ro, DR), at(f0, FAN.ro, DR)], out);
      q(ST, [at(f0, ri, DR), at(f1, ri, DR), at(f1, FAN.ro, DR), at(f0, FAN.ro, DR)], [0, 1, 0]);
    }
    for (let k = 1; k < n; k++) {
      const f = (k / n) * Math.PI / 2, er = [Math.cos(f), -Math.sin(f)], et = [-Math.sin(f), -Math.cos(f)], g = P.fanPt(f, FAN.rg), o = P.fanPt(f, FAN.ro), tg = 0.2, to = 0.07;
      for (const sg of [-1, 1]) vq(ST, [[g[0] + et[0] * tg * sg, PAR, g[1] + et[1] * tg * sg], [o[0] + et[0] * to * sg, PAR, o[1] + et[1] * to * sg], [o[0] + et[0] * to * sg, yS1, o[1] + et[1] * to * sg], [g[0] + et[0] * tg * sg, yG1, g[1] + et[1] * tg * sg]], [et[0] * sg, 0, et[1] * sg]);
      vq(ST, [[o[0] - et[0] * to, PAR, o[1] - et[1] * to], [o[0] + et[0] * to, PAR, o[1] + et[1] * to], [o[0] + et[0] * to, yS1, o[1] + et[1] * to], [o[0] - et[0] * to, yS1, o[1] - et[1] * to]], [er[0], 0, er[1]]);
    }
    // the tops of the two end blocks, then the butterfly roof: down from the clerestory's cap to the valley, up again to the stage wall
    fl(ST, [[DRUM.fullA, DRUM.nB], [DRUM.ne, DRUM.nB], [DRUM.ne, FAN.c[1]], [FAN.c[0] + ri, FAN.c[1]]], DR);
    fl(ST, [[DRUM.nw, DRUM.front], [FAN.c[0], DRUM.front], [FAN.c[0], FAN.c[1] - ri], [DRUM.nw, DRUM.fullB]], DR);
    { const rim = [[DRUM.fullA, DR, DRUM.nB]]; for (let i = 0; i <= n; i++) rim.push(at((i / n) * Math.PI / 2, ri, DR)); rim.push([DRUM.nw, DR, DRUM.fullB]);
      const m = rim.length - 1, ch = (j) => { const t = j / m; return [pv[0] + (qv[0] - pv[0]) * t, VY, pv[1] + (qv[1] - pv[1]) * t]; };
      for (let j = 0; j < m; j++) { q(ROOF, [rim[j], rim[j + 1], ch(j + 1)], [0, 1, 0]); q(ROOF, [rim[j], ch(j + 1), ch(j)], [0, 1, 0]); }
      const mid = [(pv[0] + qv[0]) / 2, VY, (pv[1] + qv[1]) / 2], per = [[pv[0], VY, pv[1]], ...st.map((p) => [p[0], STG, p[1]]), [qv[0], VY, qv[1]]];
      for (let j = 0; j < per.length - 1; j++) q(ROOF, [mid, per[j], per[j + 1]], [0, 1, 0]); }
    // ================================================================= the flat roof: grey, pale stone edges, rooflights
    { const R = P.roofOutline(), I = inset(R.pts, R.d), N = R.pts.length;
      for (let i = 0; i < N; i++) if (R.d[i] > 0) { const j = (i + 1) % N; fl(ST, [R.pts[i], R.pts[j], I[j], I[i]], PAR); }
      fl(ROOF, I, PAR);
      fl(ST, [[0, 0], [LEN, 0], [LEN, 0.8], [a1, 0.8], [a1, PD], [a0, PD], [a0, 0.8], [0, 0.8]], PAR);      // the colonnade's hood
      fl(ST, [[S.glass + P.BAND, S.b0], [S.tip, S.b0], [S.tip, S.b1], [S.glass + P.BAND, S.b1]], PAR);    // the studio's hood
      // rooflights (the satellite picture shows a grid over the foyer and boxes over the core and the studio; GUESS: exactly where)
      for (const [a, b, w, d] of [[20.7, 10.6, 1.3, 1.3], [22.5, 10.6, 1.3, 1.3], [20.7, 12.6, 1.3, 1.3], [22.5, 12.6, 1.3, 1.3], [20.7, 14.6, 1.3, 1.3], [22.5, 14.6, 1.3, 1.3], [28.3, 11.6, 1.6, 1.2], [28.3, 15.6, 1.6, 1.2], [39.2, 13.85, 6.4, 1.3], [21.8, 28.0, 1.8, 1.8]]) {
        bx('alu', a - w / 2, a + w / 2, PAR, PAR + 0.28, b - d / 2, b + d / 2, { top: false });
        const bb = T.bay(); q('snscGlass', [[a - w / 2, PAR + 0.28, b - d / 2], [a + w / 2, PAR + 0.28, b - d / 2], [a + w / 2, PAR + 0.28, b + d / 2], [a - w / 2, PAR + 0.28, b + d / 2]], [0, 1, 0], [[bb[0] + 0.16, bb[1] + 0.79], [bb[0] + 0.27, bb[1] + 0.79], [bb[0] + 0.27, bb[1] + 0.87], [bb[0] + 0.16, bb[1] + 0.87]]);
      } }
    // a teak bench in the middle bay of each seminar room, against the plinth
    for (const i of [1, 10]) { const c = (pierA(i) + pierA(i + 1)) / 2;
      bx('teak', c - 0.85, c + 0.85, 0.4, 0.46, 0.42, 0.9, { bottom: true }); bx('teak', c - 0.85, c + 0.85, 0.46, 0.86, 0.9, 0.96, { bottom: true });
      for (const s of [-0.75, 0.75]) bx('teak', c + s - 0.04, c + s + 0.04, 0, 0.4, 0.46, 0.92, { top: false }); }
  });
}
