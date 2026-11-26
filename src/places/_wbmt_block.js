// The inside of the courtyard house behind 7 Beaumont Street (walk-in room _wbmt_plan.js BLOCK_ID), as the user — who
// lived here — described it: through the door, a student room on the left, the kitchen on the right, straight ahead a
// small winding stair that turns through 180 degrees; at its head two more student rooms and, on the right, Matt's
// room: a rectangle with the corner windows of the photograph, an electric keyboard, and a square, mostly white
// bathroom boxed into its corner. Geometry only, in the front frame (x = s, z = -t), keys "zone|rrggbb|cell" for
// _wbmt_build.js interiorGeometries(). Zones: bhall (hall, stair, landing), kitchen, r1, matt, bath, r2, r3.
// Furnishing follows the college's bedroom photograph (cream walls, dark red carpet, beech desk with a drawer pedestal,
// tall bookcase, cork board, white column radiator, grey swivel chair, white fire doors); the rest is a plausible
// 2013 student room. Research and guesses: docs/research/worcester.md "Beaumont Street: the courtyard house".
import * as THREE from 'three';
import { rectPts } from './_worcester_kit.js';
import { PAVE, BK, OPENINGS, STAIR, tread, GO, KB } from './_wbmt_plan.js';
import { roomKit, C, KEY, U1 } from './_wbmt_build.js';

const Y = (h) => h + PAVE;
const RV = 0.1;                        // depth of a window's reveal on the room side (to the glass)

export function buildBlock(B) {
  const { wall, onWall, floor, box, skirt, decalDoor, architrave, radiator, board, light, curtains, at, chair, kChair, bed, desk, bookcase, wardrobe, prop } = roomKit(B);
  const { S0, S1, N, S, HN, HS, RE, AB } = BK, WL = BK.well, pd = BK.pod;
  const yG = Y(BK.G), yGC = Y(BK.GC), yF = Y(BK.F1), yFC = Y(BK.F1C);
  const hn = HN + 0.05, hs = HS - 0.05;            // the hall's wall faces (15.6, 17.5)
  const rn = HN - 0.05, rs = HS + 0.05;            // the rooms' faces of the same partitions (15.5, 17.6)
  const win = (wallId, lv, room) => OPENINGS.filter((o) => o.wall === wallId && o.level === lv && o.room === room);
  /** one wall face of a room with holes [[c0, c1, y0, y1, rv?]] (c along the wall through u()) */
  const face = (zone, w, y0, y1, holes = [], col = C.wall) => {
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    onWall(w.a, w.b, () => {
      const rects = holes.map((h) => { const a = w.u(h[0]), b = w.u(h[1]); return rectPts(Math.min(a, b), h[2], Math.max(a, b), h[3]); });
      B.face(KEY(zone, col, zone === 'bath' ? '' : '~plaster'), rectPts(0, y0, L, y1), rects, 0);
      rects.forEach((r, i) => B.reveal(KEY(zone, C.white), r, 0, -(holes[i][4] ?? 0.05), holes[i][2] <= y0 + 1e-3));
    });
  };
  /** the four walls of a rectangle of floor, as { a, b, u } (seen from inside) */
  const walls = (s0, s1, t0, t1) => ({ N: { a: [s1, t0], b: [s0, t0], u: (c) => s1 - c }, S: { a: [s0, t1], b: [s1, t1], u: (c) => c - s0 }, E: { a: [s0, t0], b: [s0, t1], u: (c) => c - t0 }, W: { a: [s1, t1], b: [s1, t0], u: (c) => t1 - c } });
  /** the outside faces of a box standing in a room (an en-suite pod): { N, S, E, W } seen from outside it */
  const podWalls = (s0, s1, t0, t1) => ({ N: { a: [s0, t0], b: [s1, t0], u: (c) => c - s0 }, S: { a: [s1, t1], b: [s0, t1], u: (c) => s1 - c }, E: { a: [s0, t1], b: [s0, t0], u: (c) => t1 - c }, W: { a: [s1, t0], b: [s1, t1], u: (c) => c - t0 } });
  const holesFor = (list) => list.map((o) => [o.c - o.w / 2, o.c + o.w / 2, Y(o.y0), Y(o.y1), RV]);
  const doorHole = (c0, c1, y) => [c0, c1, y, y + 2.02, 0.05];
  const sill = (zone, w, o) => onWall(w.a, w.b, () => { const a = w.u(o.c - o.w / 2), b = w.u(o.c + o.w / 2); B.box(KEY(zone, C.white), (a + b) / 2, Y(o.y0) - 0.02, 0.03, o.w + 0.1, 0.04, 0.08, 0, { bottom: true }); });
  const poster = (zone, w, c, y, cell, pw = 0.5, ph = 0.7) => onWall(w.a, w.b, () => { const u = w.u(c); B.sign(KEY(zone, 'ffffff', cell), u - pw / 2, y, u + pw / 2, y + ph, 0.008, U1); });

  // ================================================================== HALL, STAIR, LANDING (zone 'bhall')
  const Z = 'bhall';
  { const H = walls(WL.s1, S1, hn, hs), dT0 = BK.DOOR.t - BK.DOOR.w / 2, dT1 = BK.DOOR.t + BK.DOOR.w / 2;
    floor(Z, C.hallFloor, WL.s1, S1, hn, hs, yG); floor(Z, C.ceil, WL.s1, S1, hn, hs, yGC, true);
    floor(Z, C.hallFloor, S1, S1 + BK.WALL - 0.02, dT0, dT1, yG);                                   // the threshold in the wall's thickness
    face(Z, H.N, yG, yGC, [doorHole(17.75, 18.6, yG)]); face(Z, H.S, yG, yGC, [doorHole(17.9, 18.8, yG)]);
    face(Z, H.W, yG, yGC, [[dT0, dT1, yG, yG + 2.06, 0.07]]);
    architrave(Z, H.N.a, H.N.b, H.N.u(18.6), H.N.u(17.75), yG); architrave(Z, H.S.a, H.S.b, H.S.u(17.9), H.S.u(18.8), yG);
    onWall(H.N.a, H.N.b, () => { B.sign(KEY(Z, 'ffffff', 'lbl0'), H.N.u(17.75) + 0.1, yG + 1.5, H.N.u(17.75) + 0.4, yG + 1.58, 0.012, U1); });
    onWall(H.S.a, H.S.b, () => { B.sign(KEY(Z, 'ffffff', 'lbl4'), H.S.u(17.9) - 0.42, yG + 1.5, H.S.u(17.9) - 0.1, yG + 1.58, 0.012, U1); });
    skirt(Z, H.N.a, H.N.b, yG, [[H.N.u(18.64), H.N.u(17.71)]]); skirt(Z, H.S.a, H.S.b, yG, [[H.S.u(17.86), H.S.u(18.84)]]);
    board(Z, H.N.a, H.N.b, H.N.u(20.0), H.N.u(19.0), yG + 1.15, yG + 1.85, 'notice');
    radiator(Z, H.S.a, H.S.b, H.S.u(19.1), H.S.u(20.1), yG);
    box(Z, 'b02a22', 20.24, 20.36, yG + 0.5, yG + 0.98, 15.68, 15.8);                               // fire extinguisher by the door
    box(Z, C.dark, 19.5, 20.3, yG, yG + 0.012, 16.15, 16.95);                                       // door mat
    light(Z, 18.6, 16.55, yGC, 0.16); prop.detector(Z, 17.2, 16.55, yGC);
    // the house's post in its pigeonholes, coats on the hooks opposite, shoes kicked off under them, the fire notice,
    // a call point by the door and the running-man sign over it
    onWall(H.N.a, H.N.b, () => { const u = H.N.u(16.8); B.box(KEY(Z, C.oak), u, yG + 1.3, 0.05, 1.0, 0.44, 0.1); B.sign(KEY(Z, 'ffffff', 'envelopes'), u - 0.48, yG + 1.1, u + 0.48, yG + 1.5, 0.101, U1); });
    prop.coat(Z, H.S.a, H.S.b, H.S.u(16.25), yG, '2f4a3a'); prop.coat(Z, H.S.a, H.S.b, H.S.u(16.7), yG, '6a2a2a'); prop.coat(Z, H.S.a, H.S.b, H.S.u(17.15), yG, '2a3550');
    onWall(H.S.a, H.S.b, () => B.box(KEY(Z, C.oak), H.S.u(16.7), yG + 1.74, 0.012, 1.2, 0.07, 0.024));
    prop.shoes(Z, 16.3, hs - 0.16, yG, 0.2, '6a4a2a'); prop.shoes(Z, 16.95, hs - 0.17, yG, -0.15, '2a2c30');
    prop.sheet(Z, H.S.a, H.S.b, H.S.u(17.62), yG + 1.25, yG + 1.65, 0.3, 'fire');
    onWall(H.W.a, H.W.b, () => { B.box(KEY(Z, 'c8281e'), H.W.u(15.86), yG + 1.35, 0.025, 0.1, 0.1, 0.05); B.box(KEY(Z, '1f8a3a'), H.W.u(BK.DOOR.t), yG + 2.24, 0.03, 0.42, 0.16, 0.05); B.box(KEY(Z, 'f4f4ee'), H.W.u(BK.DOOR.t) - 0.08, yG + 2.24, 0.058, 0.1, 0.09, 0.004); });
    B.cyl(KEY(Z, '3a3e42'), 20.22, yG, -17.32, 0.1, 0.48, 8, false); B.beam(KEY(Z, '7a1a2a'), [20.22, yG + 0.05, -17.32], [20.3, yG + 0.9, -17.38], 0.035);
    // the edge of the landing's floor over the foot of the stair, and the wall that shuts off the space under the upper flight
    wall(Z, C.white, [WL.s1, hs], [WL.s1, WL.mid + 0.05], yGC, yF);
    wall(Z, C.wall, [WL.s1, hn], [WL.s1, WL.mid - 0.05], yG, yGC);
    // first floor: the landing
    floor(Z, C.hallFloor, WL.s1, S1, hn, hs, yF); floor(Z, C.ceil, S0, S1, hn, hs, yFC, true);
    const lw = OPENINGS.find((o) => o.room === 'bhall');
    face(Z, H.N, yF, yFC, [doorHole(17.75, 18.6, yF)]); face(Z, H.S, yF, yFC, [doorHole(15.9, 16.7, yF), doorHole(17.2, 18.0, yF)]);
    face(Z, H.W, yF, yFC, holesFor([lw])); sill(Z, H.W, lw);
    architrave(Z, H.N.a, H.N.b, H.N.u(18.6), H.N.u(17.75), yF); architrave(Z, H.S.a, H.S.b, H.S.u(15.9), H.S.u(16.7), yF); architrave(Z, H.S.a, H.S.b, H.S.u(17.2), H.S.u(18.0), yF);
    onWall(H.N.a, H.N.b, () => { B.sign(KEY(Z, 'ffffff', 'lbl3'), H.N.u(17.75) + 0.1, yF + 1.5, H.N.u(17.75) + 0.4, yF + 1.58, 0.012, U1); });
    onWall(H.S.a, H.S.b, () => { B.sign(KEY(Z, 'ffffff', 'lbl1'), H.S.u(16.7) + 0.08, yF + 1.5, H.S.u(16.7) + 0.38, yF + 1.58, 0.012, U1); B.sign(KEY(Z, 'ffffff', 'lbl2'), H.S.u(18.0) + 0.1, yF + 1.5, H.S.u(18.0) + 0.4, yF + 1.58, 0.012, U1); });
    skirt(Z, H.N.a, H.N.b, yF, [[H.N.u(18.64), H.N.u(17.71)]]); skirt(Z, H.S.a, H.S.b, yF, [[H.S.u(15.86), H.S.u(16.74)], [H.S.u(17.16), H.S.u(18.04)]]);
    radiator(Z, H.S.a, H.S.b, H.S.u(18.9), H.S.u(19.9), yF);
    light(Z, 18.4, 16.55, yFC, 0.16); light(Z, 14.6, 16.55, yFC, 0.16); prop.detector(Z, 17.0, 16.55, yFC);
    prop.sheet(Z, H.S.a, H.S.b, H.S.u(18.45), yF + 1.25, yF + 1.65, 0.3, 'fire');
    prop.plant(Z, 20.18, 17.28, yF); box(Z, 'e8e4da', 19.95, 20.33, yF, yF + 0.5, 15.68, 16.02); prop.heap(Z, 20.14, 15.85, yF + 0.46, ['7a8a9a', 'c8c8c4']);      // a plant by the window; somebody's laundry basket waiting for the machine
  }
  // the well: its walls from the ground to the upper ceiling; the spine wall between the flights
  { const E = { a: [WL.s0, hn], b: [WL.s0, hs] }, Nn = { a: [WL.s1, hn], b: [WL.s0, hn] }, Ss = { a: [WL.s0, hs], b: [WL.s1, hs] };
    for (const w of [E, Nn, Ss]) wall(Z, C.wall, w.a, w.b, yG, yFC);
    const m = WL.mid, yE = yG + STAIR.RISE * 11 + 0.06, yW = yF + 0.06, RUNL = WL.s1 - WL.cs;
    // (south face: u from the landing end east to the turn; north face the other way)
    onWall([WL.s1, m + 0.05], [WL.cs, m + 0.05], () => B.face(KEY(Z, C.wall, '~plaster'), [[0, yG], [RUNL, yG], [RUNL, yE], [0, yW]], [], 0));
    onWall([WL.cs, m - 0.05], [WL.s1, m - 0.05], () => B.face(KEY(Z, C.wall, '~plaster'), [[0, yG], [RUNL, yG], [RUNL, yW], [0, yE]], [], 0));
    wall(Z, C.wall, [WL.cs, m + 0.05], [WL.cs, m - 0.05], yG, yE); wall(Z, C.wall, [WL.s1, m - 0.05], [WL.s1, m + 0.05], yG, yW);
    B.poly(KEY(Z, C.white), [[WL.cs, yE, -(m - 0.05)], [WL.s1, yW, -(m - 0.05)], [WL.s1, yW, -(m + 0.05)], [WL.cs, yE, -(m + 0.05)]], [0, 1, 0]);
    // balusters and an oak rail up the string; a newel at the turn and one at the landing
    { const n = 13; for (let i = 0; i <= n; i++) { const f = i / n, sx = WL.cs + RUNL * f, y = yE + (yW - yE) * f; B.box(KEY(Z, C.white), sx, y + 0.44, -m, 0.03, 0.88, 0.03); }
      B.beam(KEY(Z, C.oak), [WL.cs, yE + 0.9, -m], [WL.s1, yW + 0.9, -m], 0.07, 0.05);
      box(Z, C.oak, WL.cs - 0.06, WL.cs + 0.06, yG, yE + 1.02, m - 0.06, m + 0.06); box(Z, C.oak, WL.s1 - 0.06, WL.s1 + 0.06, yF, yF + 1.06, m - 0.06, m + 0.06); }
    // balustrade across the head of the well (landing side), and handrails on the outer walls
    onWall([WL.s1, m + 0.05], [WL.s1, hs], (L) => { B.box(KEY(Z, C.oak), L / 2, yF + 0.98, 0, L, 0.05, 0.07); for (let u = 0.08; u < L; u += 0.13) B.box(KEY(Z, C.white), u, yF + 0.48, 0, 0.03, 0.96, 0.03); B.box(KEY(Z, C.white), L / 2, yF + 0.03, 0, L, 0.06, 0.06); });
    B.beam(KEY(Z, C.oak), [WL.s1 - 0.1, yG + 1.05, -(hs - 0.06)], [WL.cs, yG + STAIR.RISE * 5.5 + 0.95, -(hs - 0.06)], 0.05);
    B.beam(KEY(Z, C.oak), [WL.cs, yG + STAIR.RISE * 10.5 + 0.95, -(hn + 0.06)], [WL.s1 - 0.1, yF + 0.95, -(hn + 0.06)], 0.05);
  }
  // the treads: five up the south flight, five winders round the end of the spine wall, five back along the north flight
  { const k = KEY(Z, C.stairCarpet), kr = KEY(Z, '3f4852'), go = STAIR.RUN / WL.straight, cs = WL.cs, m = WL.mid, r = WL.r;
    for (let i = 0; i < WL.straight; i++) { const T = tread(i); box(Z, C.stairCarpet, WL.s1 - go * (i + 1), WL.s1 - go * i + 0.004, yG, Y(T.y), m + 0.05, hs); }
    const P = (phi) => { const sn = Math.sin(phi), c = Math.cos(phi), d = Math.min(r / Math.max(1e-6, Math.abs(sn)), r / Math.max(1e-6, Math.abs(c))); return [cs - sn * d, m + c * d]; };
    for (let j = 0; j < WL.winders; j++) {
      const T = tread(WL.straight + j), y = Y(T.y), f0 = (j / WL.winders) * Math.PI, f1 = ((j + 1) / WL.winders) * Math.PI, pts = [[cs, m], P(f0)];
      for (const fc of [Math.PI / 4, (3 * Math.PI) / 4]) if (fc > f0 + 1e-6 && fc < f1 - 1e-6) pts.push(P(fc));
      pts.push(P(f1));
      B.flat(k, pts.map(([s, t]) => [s, -t]), y);
      const p0 = P(f0); B.poly(kr, [[cs, y - STAIR.RISE, -m], [p0[0], y - STAIR.RISE, -p0[1]], [p0[0], y, -p0[1]], [cs, y, -m]], [Math.cos(f0), 0, -Math.sin(f0)]);
    }
    for (let i = 0; i < WL.straight; i++) { const T = tread(WL.straight + WL.winders + i); box(Z, C.stairCarpet, cs + go * i - 0.004, cs + go * (i + 1), Y(T.y) - 0.3, Y(T.y), hn, m - 0.05); }
    wall(Z, '3f4852', [WL.s1, m - 0.05], [WL.s1, hn], yF - STAIR.RISE, yF);                        // the last riser, up on to the landing
  }

  // ================================================================== SHARED KITCHEN (zone 'kitchen'): ground floor, south
  { const Kz = 'kitchen', R = walls(S0, S1, rs, S), kw = win('W', 0, 'kitchen')[0];
    floor(Kz, C.kitchFloor, S0, S1, rs, S, yG); floor(Kz, C.ceil, S0, S1, rs, S, yGC, true);
    face(Kz, R.N, yG, yGC, [doorHole(17.9, 18.8, yG)]); face(Kz, R.S, yG, yGC); face(Kz, R.E, yG, yGC); face(Kz, R.W, yG, yGC, holesFor([kw])); sill(Kz, R.W, kw);
    skirt(Kz, R.N.a, R.N.b, yG, [[R.N.u(18.84), R.N.u(17.86)]]);
    // the worktop run along the back wall: base units, sink, hob, wall cupboards, extractor, microwave, kettle, toaster
    const a0 = S0, a1 = 19.0, f = S - 0.6;
    box(Kz, C.white, a0, a1, yG + 0.1, yG + 0.88, f + 0.02, S); box(Kz, C.dark, a0, a1, yG, yG + 0.1, f + 0.06, S); box(Kz, C.worktop, a0, a1 + 0.02, yG + 0.88, yG + 0.92, f - 0.02, S);
    onWall([a0, f + 0.02], [a1, f + 0.02], (L) => { const n = 9; for (let i = 0; i < n; i++) B.sign(KEY(Kz, 'ffffff', 'cab'), (L * i) / n + 0.01, yG + 0.12, (L * (i + 1)) / n - 0.01, yG + 0.86, 0.006, U1); });
    B.card(KEY(Kz, 'ffffff', 'hob'), [16.7, yG + 0.925, -(f + 0.06)], [17.3, yG + 0.925, -(f + 0.06)], [17.3, yG + 0.925, -(S - 0.06)], [16.7, yG + 0.925, -(S - 0.06)], [0, 0, 1, 1]);
    box(Kz, C.steel, 14.3, 15.1, yG + 0.921, yG + 0.93, f + 0.08, S - 0.1); box(Kz, C.dark, 14.38, 14.8, yG + 0.931, yG + 0.934, f + 0.14, S - 0.16);
    B.beam(KEY(Kz, C.steel), [14.95, yG + 0.93, -(S - 0.08)], [14.95, yG + 1.18, -(S - 0.08)], 0.03); B.beam(KEY(Kz, C.steel), [14.95, yG + 1.18, -(S - 0.08)], [14.95, yG + 1.14, -(S - 0.26)], 0.03);
    box(Kz, C.white, a0, 16.4, yG + 1.45, yG + 2.15, S - 0.34, S); onWall([a0, S - 0.34], [16.4, S - 0.34], (L) => { for (let i = 0; i < 5; i++) B.sign(KEY(Kz, 'ffffff', 'cab'), (L * i) / 5 + 0.01, yG + 1.47, (L * (i + 1)) / 5 - 0.01, yG + 2.13, 0.006, U1); });
    box(Kz, C.steel, 16.7, 17.3, yG + 1.7, yG + 1.82, S - 0.5, S - 0.1);
    box(Kz, 'e8e8e6', 18.2, 18.7, yG + 0.92, yG + 1.2, S - 0.46, S - 0.06); onWall([18.2, S - 0.46], [18.7, S - 0.46], (L) => B.sign(KEY(Kz, 'ffffff', 'micro'), 0.01, yG + 0.93, L - 0.01, yG + 1.19, 0.006, U1));
    B.cyl(KEY(Kz, C.steel), 16.25, yG + 0.92, -(S - 0.3), 0.075, 0.2, 8, true, 0.085); box(Kz, C.steel, 15.5, 15.78, yG + 0.92, yG + 1.1, S - 0.42, S - 0.16);
    box(Kz, C.mug, 15.95, 16.03, yG + 0.92, yG + 1.01, S - 0.34, S - 0.26); box(Kz, 'f1efe6', 17.6, 17.95, yG + 0.92, yG + 0.96, S - 0.5, S - 0.12);      // a mug by the kettle; a chopping board
    // fridge-freezer in the corner by the stair wall; bin; table and four chairs; noticeboard; radiator; light
    box(Kz, C.white, S0, 13.86, yG, yG + 1.8, rs, 18.3); box(Kz, C.dark, 13.865, 13.875, yG + 1.08, yG + 1.09, rs + 0.02, 18.28); box(Kz, C.steel, 13.87, 13.9, yG + 1.2, yG + 1.6, 18.18, 18.22);
    box(Kz, C.bin, 19.95, 20.3, yG, yG + 0.62, rs + 0.08, rs + 0.43);
    box(Kz, C.beech, 15.3, 16.9, yG + 0.71, yG + 0.75, 18.3, 19.15, { bottom: true });
    for (const [s, t] of [[15.38, 18.38], [16.82, 18.38], [15.38, 19.07], [16.82, 19.07]]) box(Kz, C.steel, s - 0.025, s + 0.025, yG, yG + 0.71, t - 0.025, t + 0.025);
    kChair(Kz, 15.7, 18.0, Math.PI, yG); kChair(Kz, 16.5, 18.05, Math.PI - 0.3, yG); kChair(Kz, 15.7, 19.42, 0, yG); kChair(Kz, 16.5, 19.42, 0.15, yG);
    B.cyl(KEY(Kz, '2a4a8a'), 16.3, yG + 0.75, -18.6, 0.04, 0.09, 7, true); box(Kz, 'f4f0e4', 15.6, 15.85, yG + 0.751, yG + 0.756, 18.5, 18.8); box(Kz, 'd8b24a', 16.0, 16.12, yG + 0.75, yG + 0.95, 18.85, 18.93);
    board(Kz, R.N.a, R.N.b, R.N.u(20.25), R.N.u(19.15), yG + 1.15, yG + 1.95, 'notice');
    radiator(Kz, R.E.a, R.E.b, R.E.u(18.5), R.E.u(19.5), yG);
    light(Kz, 15.2, 18.9, yGC, 0.2); light(Kz, 18.6, 18.9, yGC, 0.2); prop.detector(Kz, 17.0, 18.9, yGC);
    // the oven under the hob with a tea towel on its rail; a pan left on; the washing-up; what lives on the worktop
    onWall([a0, f + 0.02], [a1, f + 0.02], () => { B.sign(KEY(Kz, 'ffffff', 'oven'), 16.7 - a0, yG + 0.12, 17.3 - a0, yG + 0.86, 0.012, U1); B.box(KEY(Kz, '3f6da8'), 16.86 - a0, yG + 0.6, 0.03, 0.2, 0.3, 0.02); });
    B.cyl(KEY(Kz, '2a2c30'), 16.86, yG + 0.925, -(f + 0.4), 0.11, 0.07, 10, false); B.box(KEY(Kz, '2a2c30'), 16.86, yG + 0.975, -(f + 0.16), 0.03, 0.02, 0.2);
    box(Kz, C.steel, 13.5, 14.2, yG + 0.92, yG + 0.94, f + 0.12, S - 0.1); for (let i = 0; i < 5; i++) box(Kz, 'f4f4f0', 13.6 + i * 0.11, 13.62 + i * 0.11, yG + 0.94, yG + 1.14, f + 0.18, S - 0.2);
    prop.bottle(Kz, 15.2, S - 0.12, yG + 0.92, '4aa84a'); box(Kz, 'e8d44a', 15.26, 15.36, yG + 0.92, yG + 0.95, f + 0.1, f + 0.17);
    prop.mug(Kz, 14.5, f + 0.3, yG + 0.932, 'f4f4f0'); prop.mug(Kz, 14.62, f + 0.36, yG + 0.932, '2a4a8a'); box(Kz, 'f4f4f0', 14.84, 15.04, yG + 0.932, yG + 0.95, f + 0.22, f + 0.42);
    for (const [sx, c2] of [[17.72, 'ffffff'], [17.9, 'ffffff']]) onWall([sx, S - 0.34], [sx + 0.16, S - 0.34], () => { B.box(KEY(Kz, 'c8902a'), 0.08, yG + 1.05, -0.03, 0.16, 0.26, 0.06); B.sign(KEY(Kz, c2, 'cereal'), 0, yG + 0.92, 0.16, yG + 1.18, 0.002, U1); });
    box(Kz, '8a5a2a', 18.05, 18.16, yG + 0.92, yG + 1.04, S - 0.3, S - 0.12); box(Kz, 'b8322a', 17.4, 17.62, yG + 1.35, yG + 1.62, S - 0.04, S);      // a jar of coffee; the fire blanket on the wall
    // the fridge door: rota, notes, a magnet or two; recycling beside the bin; the table as it was left
    onWall([13.862, rs + 0.04], [13.862, 18.26], (L) => { B.sign(KEY(Kz, 'ffffff', 'postits'), 0.04, yG + 1.3, L - 0.04, yG + 1.4, 0.004, U1); B.sign(KEY(Kz, 'ffffff', 'timetable'), 0.12, yG + 1.45, 0.48, yG + 1.72, 0.004, U1); B.box(KEY(Kz, 'c8281e'), 0.56, yG + 1.62, 0.006, 0.04, 0.04, 0.01); });
    box(Kz, '2a6a3a', 19.5, 19.9, yG, yG + 0.36, rs + 0.06, rs + 0.4); box(Kz, 'd8c8a0', 19.54, 19.86, yG + 0.3, yG + 0.44, rs + 0.1, rs + 0.36);
    B.cyl(KEY(Kz, 'd8d4c8'), 16.05, yG + 0.75, -18.72, 0.14, 0.07, 10, false, 0.08); for (const [dx, dz, c2] of [[0, 0, 'c8502a'], [0.07, 0.03, 'e0b83a'], [-0.05, 0.06, '8aa83a']]) B.cyl(KEY(Kz, c2), 16.05 + dx, yG + 0.79, -18.72 - dz, 0.045, 0.06, 6, true);
    prop.box(Kz, 16.55, 18.95, yG + 0.75, 0.33, 0.045, 0.33, 'c9b48a', 0.2); prop.glass(Kz, 15.5, 18.95, yG + 0.75); prop.bottle(Kz, 16.7, 18.45, yG + 0.75, '3a6a3a');
    prop.sheet(Kz, R.N.a, R.N.b, R.N.u(17.4), yG + 1.95, yG + 2.23, 0.28, 'clock'); prop.sheet(Kz, R.N.a, R.N.b, R.N.u(16.6), yG + 1.25, yG + 1.65, 0.3, 'fire');
    box(Kz, '3f6da8', 19.2, 19.9, yG + 0.5, yG + 0.9, S - 0.05, S - 0.03); onWall(R.S.a, R.S.b, () => B.box(KEY(Kz, C.steel), R.S.u(19.55), yG + 0.92, 0.04, 0.8, 0.02, 0.02));      // tea towels on a rail at the end of the run
  }

  // ================================================================== a student room on the north side (rooms 1 and 4)
  /** the shell of a north room on storey y0 (walls, floor, ceiling, its en-suite pod's outer faces) -> { R, Pd } */
  const northRoom = (zone, lv, podDoor) => {
    const y0 = lv ? yF : yG, y1 = lv ? yFC : yGC, R = walls(RE, S1, N, rn), Pd = podWalls(pd.s0, pd.s1, pd.t0, pd.t1);
    floor(zone, C.carpet, RE, S1, N, pd.t0, y0); floor(zone, C.carpet, pd.s1, S1, pd.t0, rn, y0);
    floor(zone, C.ceil, RE, S1, N, pd.t0, y1, true); floor(zone, C.ceil, pd.s1, S1, pd.t0, rn, y1, true);
    const wn = win('N', lv, zone), ww = win('W', lv, zone);
    face(zone, R.N, y0, y1, holesFor(wn)); face(zone, R.W, y0, y1, holesFor(ww));
    for (const o of wn) sill(zone, R.N, o); for (const o of ww) sill(zone, R.W, o);
    face(zone, { a: [pd.s1, rn], b: [S1, rn], u: (c) => c - pd.s1 }, y0, y1, [doorHole(17.75, 18.6, y0)]);                   // the wall on the hall, west of the pod
    face(zone, { a: [RE, N], b: [RE, pd.t0], u: (c) => c - N }, y0, y1);                                                     // east wall of the bed alcove
    face(zone, Pd.N, y0, y1); face(zone, Pd.W, y0, y1, podDoor ? [doorHole(podDoor[0], podDoor[1], y0)] : []);
    skirt(zone, R.N.a, R.N.b, y0); skirt(zone, Pd.N.a, Pd.N.b, y0);
    return { R, Pd, y0, y1, wn, ww };
  };

  // ---- room 1 (ground floor, on the left as you come in): zone 'r1'
  { const zone = 'r1', { R, Pd, y0, y1 } = northRoom(zone, 0, null);
    decalDoor(zone, Pd.W.a, Pd.W.b, 0.5, y0, 'lbl8');
    bed(zone, 15.98, N, y0, Math.PI, { head: 1, duvet: '3f6b4f' });
    desk(zone, 19.2, N, y0, Math.PI, { w: 1.4, laptop: 0.1, mug: -0.45, mugCol: 'e8e0d0', books: [[0.5, ['7a2a2a', '2a4a6a', 'd8d0c0'], 3]], lamp: -0.5 });
    chair(zone, 19.15, 13.7, 0.2, y0);
    wardrobe(zone, S1, 14.95, y0, -Math.PI / 2);
    bookcase(zone, 19.3, rn, y0, 0, { w: 0.6 });
    radiator(zone, R.N.a, R.N.b, R.N.u(18.2), R.N.u(17.2), y0); board(zone, R.N.a, R.N.b, R.N.u(18.4), R.N.u(17.0), y0 + 1.2, y0 + 2.0, 'cork');
    poster(zone, Pd.N, 15.9, y0 + 1.25, 'poster2', 0.6, 0.82);
    curtains(zone, R.N.a, R.N.b, R.N.u(20.3), R.N.u(18.7), y0 + 0.05, y0 + 2.3, 'c9bfa4');
    box(zone, '3a5a8a', 17.3, 17.9, y0, y0 + 0.012, 13.9, 14.9);                                    // a plain blue rug
    prop.bag(zone, 17.05, 13.25, y0, '1f3a6a', 1.2); prop.shoes(zone, 17.05, 14.05, y0, 1.3, 'd8d8d4'); prop.shoes(zone, 19.7, 15.38, y0, 3.2, '5a3a22');      // a sports bag, trainers, his good shoes
    prop.gown(zone, Pd.W.a, Pd.W.b, 1.58, y0); prop.bin(zone, 18.38, 12.82, y0);
    prop.heap(zone, 19.55, 14.2, y0, ['2a4a8a', 'e8e8e4', '8a2a2a', '3a3a3e']);                       // kit on the floor by the wardrobe
    prop.bottle(zone, 19.75, 12.82, y0 + 0.74, '2a8ad8'); prop.glass(zone, 18.7, 12.9, y0 + 0.74);
    prop.helmet(zone, 19.3, 15.36, y0 + 1.85, '2a2a2e'); prop.books(zone, 19.12, 15.36, y0 + 1.85, 2);
    prop.sheet(zone, [pd.s1, rn], [S1, rn], 18.84 - pd.s1, y0 + 1.35, y0 + 1.58, 0.3, 'timetable');
    prop.sheet(zone, [RE, N], [RE, pd.t0], 0.55, y0 + 1.15, y0 + 1.85, 0.5, 'poster3');
    onWall(R.N.a, R.N.b, () => B.sign(KEY(zone, 'ffffff', 'postits'), R.N.u(18.3), y0 + 1.24, R.N.u(18.3) + 0.6, y0 + 1.34, 0.03, U1));
    // an oar blade on the wall over the bed (a college's colours, no crest)
    onWall(Pd.N.a, Pd.N.b, () => { B.box(KEY(zone, 'e8d8b0'), 0.55, y0 + 2.24, 0.03, 0.9, 0.05, 0.04); B.box(KEY(zone, 'e86aa0'), 1.3, y0 + 2.24, 0.035, 0.6, 0.18, 0.03); B.box(KEY(zone, '141416'), 1.42, y0 + 2.24, 0.04, 0.08, 0.18, 0.032); });
    light(zone, 18.4, 14.1, y1, 0.2);
  }

  // ---- Matt's room (first floor, on the right at the head of the stair): zone 'matt'
  { const zone = 'matt', { R, Pd, y0, y1 } = northRoom(zone, 1, [14.55, 15.31]);
    architrave(zone, Pd.W.a, Pd.W.b, Pd.W.u(14.55), Pd.W.u(15.31), y0, 2.0);
    onWall(Pd.W.a, Pd.W.b, () => { B.box(KEY(zone, 'fbfbf7'), Pd.W.u(14.3), y0 + 1.22, 0.008, 0.085, 0.085, 0.016); B.box(KEY(zone, 'e4e4de'), Pd.W.u(14.3), y0 + 1.22, 0.018, 0.03, 0.045, 0.01); });      // the bathroom's light switch
    bed(zone, 15.98, N, y0, Math.PI, { head: 1, duvet: '4f6d92', messy: true });
    // shelf over the head of the bed; the cork board on the bathroom's wall along the bed
    onWall([RE, N], [RE, pd.t0], (L) => { B.box(KEY(zone, C.beech), L / 2, y0 + 1.45, 0.1, L - 0.1, 0.03, 0.2, 0, { bottom: true }); B.sign(KEY(zone, 'ffffff', 'books'), 0.1, y0 + 1.47, L - 0.3, y0 + 1.7, 0.16, U1); });
    board(zone, Pd.N.a, Pd.N.b, 0.2, 1.65, y0 + 1.0, y0 + 1.8, 'cork');
    // desk under the corner window, the grey swivel chair
    desk(zone, 19.2, N, y0, Math.PI, { w: 1.4, laptop: 0.15, mug: -0.5, books: [[0.52, ['2a4a6a', 'c8b890', '7a2a2a', '3a5a3a'], 4]], lamp: -0.55 });
    onWall(R.N.a, R.N.b, () => { const u = R.N.u(19.7); B.push(new THREE.Matrix4().makeRotationX(-Math.PI / 2 + 0.02).setPosition(u, y0 + 0.745, 0.42)); B.sign(KEY(zone, 'ffffff', 'sheet'), -0.11, -0.15, 0.11, 0.15, 0, U1); B.pop(); });
    chair(zone, 19.25, 13.72, -0.25, y0);
    wardrobe(zone, 17.7, N, y0, Math.PI);
    radiator(zone, R.W.a, R.W.b, R.W.u(14.1), R.W.u(12.9), y0);
    curtains(zone, R.N.a, R.N.b, R.N.u(20.3), R.N.u(18.5), y0 + 0.7, y0 + 2.3); curtains(zone, R.W.a, R.W.b, R.W.u(14.2), R.W.u(12.7), y0 + 0.7, y0 + 2.3);
    // THE ELECTRIC KEYBOARD: an 88-key stage piano on an X-stand against the hall wall. The instrument itself (case,
    // keys that move, stand) is places/_music_piano3d.js kind 'stage', hung in the room by worcester_beaumont.js so that
    // it can be played; here are its stool, the sustain pedal, the headphones and a pile of music
    at(KB.s, rn, y0, 0, () => {
      const k = (c, ce) => KEY(zone, c, ce), zS = KB.seatT;
      B.box(k('26282c'), 0, 0.47, zS, 0.5, 0.07, 0.32, 0, { bottom: true });
      for (const sg of [-1, 1]) { B.beam(k('18191b'), [-0.2, 0.02, zS + sg * 0.1], [0.2, 0.43, zS + sg * 0.1], 0.03); B.beam(k('18191b'), [0.2, 0.02, zS + sg * 0.1], [-0.2, 0.43, zS + sg * 0.1], 0.03); }
      B.box(k('18191b'), 0.22, 0.025, 0.5, 0.1, 0.05, 0.22);                                                                  // sustain pedal
      B.beam(k('18191b'), [0.22, 0.02, 0.4], [0.5, 0.02, 0.1], 0.012);
    });
    prop.books(zone, KB.s + 0.86, rn - 0.18, y0, 5, 0.2);                                                                      // a pile of music in the corner
    poster(zone, { a: [pd.s1, rn], b: [S1, rn], u: (c) => c - pd.s1 }, 19.4, y0 + 1.3, 'poster1', 0.55, 0.78); prop.gown(zone, [pd.s1, rn], [S1, rn], 17.28 - pd.s1, y0);
    poster(zone, Pd.W, 14.1, y0 + 1.2, 'poster3', 0.42, 0.6);
    B.card(KEY(zone, 'ffffff', 'rug'), [17.2, y0 + 0.012, -13.6], [18.7, y0 + 0.012, -13.6], [18.7, y0 + 0.012, -14.6], [17.2, y0 + 0.012, -14.6], [0, 0, 1, 1]);
    box(zone, 'e8e4da', 19.95, 20.35, y0, y0 + 0.42, 14.4, 14.8); box(zone, '7a8a9a', 19.99, 20.31, y0 + 0.42, y0 + 0.5, 14.44, 14.76);      // a laundry basket, half full
    prop.shoes(zone, 17.0, 13.5, y0, 0.4, '6a4a2a'); prop.shoes(zone, 16.98, 14.05, y0, 1.2, 'e4e4e0');
    prop.heap(zone, 19.6, 14.62, y0, ['3a3a3e', '7a8a9a', 'b03a2a']); prop.bin(zone, 19.62, 12.95, y0);
    prop.plant(zone, 18.62, 12.72, y0 + 0.74); prop.glass(zone, 19.86, 12.78, y0 + 0.74); prop.mug(zone, 18.9, 13.1, y0 + 0.74, 'f4f4f0');
    box(zone, '8a5a2a', 19.5, 19.58, y0 + 0.74, y0 + 0.92, 12.7, 12.78);                             // a metronome
    onWall([18.2, 13.19], [17.2, 13.19], () => { B.sign(KEY(zone, 'ffffff', 'timetable'), 0.08, y0 + 1.3, 0.44, y0 + 1.57, 0.012, U1); B.sign(KEY(zone, 'ffffff', 'postits'), 0.5, y0 + 1.42, 0.98, y0 + 1.5, 0.012, U1); });      // stuck on the wardrobe door
    prop.glass(zone, RE + 0.1, pd.t0 - 0.16, y0 + 1.465); onWall([RE, N], [RE, pd.t0], (L) => { B.box(KEY(zone, '2a2c30'), L - 0.42, y0 + 1.535, 0.1, 0.22, 0.14, 0.14); });      // a pint glass and a little speaker on the shelf
    onWall(Pd.N.a, Pd.N.b, () => B.sign(KEY(zone, 'ffffff', 'postits'), 0.3, y0 + 1.84, 0.9, y0 + 1.94, 0.03, U1));
    light(zone, 18.4, 14.1, y1, 0.2);
  }

  // ---- Matt's bathroom: a square box in the corner of his room, mostly white (zone 'bath')
  { const zone = 'bath', t0 = pd.t0 + 0.08, s1 = pd.s1 - 0.08, y0 = yF, y1 = yF + 2.3, R = walls(RE, s1, t0, rn);
    B.card(KEY(zone, 'ffffff', 'ftile'), [RE, y0 + 0.004, -t0], [s1, y0 + 0.004, -t0], [s1, y0 + 0.004, -rn], [RE, y0 + 0.004, -rn], [0, 0, 1, 1]);
    B.poly(KEY(zone, C.ceil), [[RE, y1, -t0], [s1, y1, -t0], [s1, y1, -rn], [RE, y1, -rn]], [0, -1, 0]);      // (the bathroom is all tile and gloss: no grained mesh of its own)
    for (const k of ['N', 'S', 'E']) { face(zone, R[k], y0, y1, [], C.tile); onWall(R[k].a, R[k].b, (L) => B.sign(KEY(zone, 'ffffff', 'tiles'), 0, y0, L, y1, 0.004, U1)); }
    face(zone, R.W, y0, y1, [doorHole(14.55, 15.31, y0)], C.tile);
    floor(zone, C.tile, s1, pd.s1, 14.55, 15.31, y0 + 0.002);                                       // the threshold under the door
    // the toilet against the east wall, facing the door: cistern, pan, seat; the roll on the wall beside it
    { const c = GO.t, k = (col) => KEY(zone, col);
      box(zone, C.sanitary, RE, RE + 0.2, y0 + 0.4, y0 + 0.82, c - 0.22, c + 0.22); box(zone, C.chrome, RE + 0.07, RE + 0.13, y0 + 0.82, y0 + 0.835, c - 0.03, c + 0.03);
      B.cyl(k(C.sanitary), RE + 0.47, y0, -c, 0.2, 0.4, 10, false, 0.13); box(zone, C.sanitary, RE + 0.18, RE + 0.45, y0, y0 + 0.4, c - 0.17, c + 0.17);
      B.cyl(k('eef0ee'), RE + 0.47, y0 + 0.4, -c, 0.215, 0.025, 10, true); box(zone, C.sanitary, RE + 0.2, RE + 0.235, y0 + 0.43, y0 + 0.8, c - 0.19, c + 0.19);      // seat; the lid up against the cistern
      onWall(R.S.a, R.S.b, () => { B.box(k(C.chrome), R.S.u(15.55), y0 + 0.72, 0.05, 0.14, 0.02, 0.1); B.cyl(k('fafaf6'), R.S.u(15.55), y0 + 0.64, 0.07, 0.055, 0.11, 8, true); }); }
    // the shower in the corner beyond it: a white tray, a chrome riser and head, a white curtain drawn back on its rail
    box(zone, C.sanitary, RE, 15.85, y0, y0 + 0.09, t0, 14.5); box(zone, 'd7dbdb', RE + 0.36, RE + 0.44, y0 + 0.09, y0 + 0.094, t0 + 0.32, t0 + 0.4);
    B.beam(KEY(zone, C.chrome), [RE + 0.03, y0 + 0.95, -(t0 + 0.36)], [RE + 0.03, y0 + 2.05, -(t0 + 0.36)], 0.022); B.beam(KEY(zone, C.chrome), [RE + 0.03, y0 + 2.05, -(t0 + 0.36)], [RE + 0.22, y0 + 2.0, -(t0 + 0.36)], 0.022);
    B.cyl(KEY(zone, C.chrome), RE + 0.24, y0 + 1.96, -(t0 + 0.36), 0.07, 0.03, 8, true); box(zone, C.chrome, RE + 0.02, RE + 0.07, y0 + 1.0, y0 + 1.14, t0 + 0.28, t0 + 0.44);
    B.beam(KEY(zone, C.chrome), [RE, y0 + 2.02, -14.5], [15.87, y0 + 2.02, -14.5], 0.02); B.beam(KEY(zone, C.chrome), [15.87, y0 + 2.02, -14.5], [15.87, y0 + 2.02, -t0], 0.02);
    box(zone, 'f2f4f4', 15.84, 15.9, y0 + 0.2, y0 + 2.02, t0 + 0.02, t0 + 0.3);                     // the curtain, bunched at the wall
    // the basin on the north wall with the mirror over it, a shelf, a mug with a toothbrush
    onWall(R.N.a, R.N.b, () => { const u = R.N.u(16.45), k = (col, ce) => KEY(zone, col, ce);
      B.box(k(C.sanitary), u, y0 + 0.8, 0.17, 0.5, 0.14, 0.34, 0, { bottom: true }); B.box(k('dfe3e3'), u, y0 + 0.872, 0.18, 0.36, 0.004, 0.2); B.box(k(C.sanitary), u, y0 + 0.37, 0.12, 0.16, 0.74, 0.16);
      B.beam(k(C.chrome), [u, y0 + 0.87, 0.05], [u, y0 + 0.99, 0.05], 0.022); B.beam(k(C.chrome), [u, y0 + 0.99, 0.05], [u, y0 + 0.97, 0.14], 0.02);
      B.sign(k('ffffff', 'mirror'), u - 0.22, y0 + 1.2, u + 0.22, y0 + 1.82, 0.012, U1);
      B.box(k('e9ecec'), u, y0 + 1.1, 0.05, 0.46, 0.012, 0.1, 0, { bottom: true }); B.cyl(k('5a9ad8'), u + 0.14, y0 + 1.106, 0.05, 0.03, 0.08, 7, true); B.beam(k('e84a4a'), [u + 0.14, y0 + 1.15, 0.05], [u + 0.17, y0 + 1.27, 0.05], 0.008);
      B.box(k('f4f4ee'), u - 0.14, y0 + 1.125, 0.05, 0.06, 0.04, 0.035); });
    // towel on its rail by the door, a bath mat, the extractor and the light on the ceiling
    onWall(R.S.a, R.S.b, () => { const u = R.S.u(16.3); B.beam(KEY(zone, C.chrome), [u - 0.25, y0 + 1.2, 0.05], [u + 0.25, y0 + 1.2, 0.05], 0.018); B.box(KEY(zone, '3f6da8'), u, y0 + 0.97, 0.055, 0.4, 0.5, 0.03); });
    box(zone, 'dfe6ee', 15.95, 16.5, y0 + 0.004, y0 + 0.016, 14.6, 15.3);
    box(zone, 'e4e6e6', 16.1, 16.34, y1 - 0.02, y1, 14.3, 14.54); for (let i = 0; i < 4; i++) box(zone, 'b8bcbc', 16.12, 16.32, y1 - 0.024, y1 - 0.02, 14.33 + i * 0.055, 14.355 + i * 0.055);
    light(zone, 15.75, 14.85, y1, 0.13);
    // shampoo in the corner of the tray, a spare roll on the cistern, the brush, a little bin
    prop.bottle(zone, RE + 0.1, t0 + 0.1, y0 + 0.09, 'e8e0c0'); prop.bottle(zone, RE + 0.2, t0 + 0.09, y0 + 0.09, '4a8ad0'); prop.bottle(zone, RE + 0.11, t0 + 0.2, y0 + 0.09, 'd84a8a');
    B.cyl(KEY(zone, 'fafaf6'), RE + 0.1, y0 + 0.835, -(GO.t + 0.1), 0.055, 0.1, 8, true);
    B.cyl(KEY(zone, 'f2f2ee'), RE + 0.1, y0, -(GO.t + 0.36), 0.05, 0.14, 8, true); B.beam(KEY(zone, 'e8e8e4'), [RE + 0.1, y0 + 0.14, -(GO.t + 0.36)], [RE + 0.1, y0 + 0.44, -(GO.t + 0.36)], 0.018);
    B.cyl(KEY(zone, C.chrome), 16.62, y0, -14.3, 0.08, 0.22, 8, true);
  }

  // ================================================================== rooms 2 and 3 (first floor, south side)
  { const zone = 'r2', s1 = AB - 0.05, R = walls(S0, s1, rs, S), pa = BK.podA, Pd = podWalls(pa.s0, pa.s1, pa.t0, pa.t1), y0 = yF, y1 = yFC, o = win('S', 1, 'r2')[0];
    floor(zone, C.carpet, S0, s1, rs, S, y0); floor(zone, C.ceil, S0, s1, rs, S, y1, true);
    face(zone, R.N, y0, y1, [doorHole(15.9, 16.7, y0)]); face(zone, R.S, y0, y1, holesFor([o])); sill(zone, R.S, o); face(zone, R.E, y0, y1); face(zone, R.W, y0, y1);
    face(zone, Pd.S, y0, y1); face(zone, Pd.W, y0, y1); decalDoor(zone, Pd.S.a, Pd.S.b, 0.25, y0, 'lbl8');
    bed(zone, 14.22, S, y0, 0, { head: -1, duvet: 'c8703a', pillow: 'f3ead8' });
    desk(zone, s1, 19.2, y0, -Math.PI / 2, { w: 1.2, monitor: -0.1, mug: 0.4, mugCol: '3a8a5a', books: [[-0.42, ['5a3a5a', 'd8d0c0'], 2]] });
    chair(zone, 15.7, 19.25, Math.PI / 2 + 0.3, y0);
    wardrobe(zone, 15.05, rs, y0, Math.PI, { w: 0.8, d: 0.55 });
    radiator(zone, R.S.a, R.S.b, R.S.u(15.65), R.S.u(16.6), y0);
    board(zone, R.W.a, R.W.b, R.W.u(19.8), R.W.u(18.6), y0 + 1.15, y0 + 1.85, 'cork');
    poster(zone, Pd.W, 18.3, y0 + 1.15, 'poster3', 0.5, 0.7);
    curtains(zone, R.S.a, R.S.b, R.S.u(14.4), R.S.u(15.6), y0 + 0.75, y0 + 2.15, 'a84a3a');
    B.beam(KEY(zone, 'c8a050'), [15.5, y0, -17.75], [15.62, y0 + 0.95, -17.66], 0.035); box(zone, '2a2c30', 15.8, 16.1, y0, y0 + 0.3, 19.9, 20.3);      // a hockey stick in the corner; a rucksack
    light(zone, 15.4, 18.9, y1, 0.2);
    prop.gown(zone, R.S.a, R.S.b, R.S.u(13.85), y0); prop.sheet(zone, R.S.a, R.S.b, R.S.u(16.15), y0 + 1.25, y0 + 1.95, 0.5, 'poster1');
    prop.heap(zone, 15.95, 19.55, y0, ['c8703a', '3a3a3e', 'e8e8e4']); prop.shoes(zone, 15.75, 17.82, y0, 0.2, '2a2c30'); prop.shoes(zone, 14.9, 19.25, y0, 1.5, 'c8281e');
    prop.bin(zone, 16.45, 18.42, y0); prop.bottle(zone, 16.55, 19.7, y0 + 0.74, 'd8a02a'); prop.plant(zone, 16.5, 18.7, y0 + 0.74);
    prop.books(zone, 14.75, 19.3, y0, 4, 0.5); prop.sheet(zone, R.W.a, R.W.b, R.W.u(18.22), y0 + 1.3, y0 + 1.57, 0.36, 'timetable');
    // a kettle and two mugs on top of the wardrobe (where everybody keeps them)
    B.cyl(KEY(zone, 'e8e8e6'), 15.2, y0 + 1.95, -17.85, 0.075, 0.19, 8, true, 0.085); prop.mug(zone, 14.95, 17.85, y0 + 1.95, 'f0d040'); prop.mug(zone, 14.82, 17.9, y0 + 1.95, '2a4a8a');
  }
  { const zone = 'r3', s0 = AB + 0.05, R = walls(s0, S1, rs, S), pb = BK.podB, Pd = podWalls(pb.s0, pb.s1, pb.t0, pb.t1), y0 = yF, y1 = yFC, o = win('W', 1, 'r3')[0];
    floor(zone, C.carpet, s0, S1, rs, S, y0); floor(zone, C.ceil, s0, S1, rs, S, y1, true);
    face(zone, R.N, y0, y1, [doorHole(17.2, 18.0, y0)]); face(zone, R.S, y0, y1); face(zone, R.E, y0, y1); face(zone, R.W, y0, y1, holesFor([o])); sill(zone, R.W, o);
    face(zone, Pd.S, y0, y1); face(zone, Pd.E, y0, y1); decalDoor(zone, Pd.E.a, Pd.E.b, 0.25, y0, 'lbl8');
    bed(zone, 19.38, S, y0, 0, { head: 1, duvet: '8a8f98', pillow: 'e8e4f0' });
    desk(zone, s0, 19.2, y0, Math.PI / 2, { w: 1.2, laptop: -0.1, lamp: 0.45, mug: -0.5, mugCol: 'f0d040', books: [[0.3, ['2a2a3a', 'a84a2a', 'c8b890'], 3]] });
    chair(zone, 17.85, 19.25, -Math.PI / 2 + 0.2, y0);
    wardrobe(zone, 17.95, S, y0, 0, { w: 0.8 });
    radiator(zone, R.N.a, R.N.b, R.N.u(18.95), R.N.u(18.15), y0);
    board(zone, R.E.a, R.E.b, R.E.u(18.6), R.E.u(19.8), y0 + 1.15, y0 + 1.85, 'cork');
    poster(zone, R.S, 19.5, y0 + 1.25, 'poster1', 0.5, 0.7); poster(zone, Pd.S, 19.7, y0 + 1.2, 'poster2', 0.5, 0.7);
    curtains(zone, R.W.a, R.W.b, R.W.u(20.2), R.W.u(19.2), y0 + 0.75, y0 + 2.15, '4a5a7a');
    box(zone, 'd83a3a', 17.0, 17.3, y0 + 0.74, y0 + 0.9, 19.45, 19.72);                             // a cycle helmet on the desk
    light(zone, 18.4, 19.2, y1, 0.2);
    prop.gown(zone, R.N.a, R.N.b, R.N.u(18.55), y0 + 0.12); prop.helmet(zone, 17.15, 19.6, y0 + 0.74, 'd83a3a');
    prop.heap(zone, 18.0, 19.55, y0, ['2a2a2e', 'd8d83a', '2a4a8a']); prop.shoes(zone, 17.7, 19.72, y0, 0.3, '3a3a3e'); prop.bin(zone, 17.2, 18.45, y0);
    prop.plant(zone, S1 - 0.06, 19.7, y0 + 0.9); prop.bottle(zone, 17.2, 18.75, y0 + 0.74, '2a2a2e');
    box(zone, 'e8c020', 17.0, 17.34, y0, y0 + 0.36, 20.12, 20.34); B.beam(KEY(zone, '1a1a1c'), [17.05, y0 + 0.02, -20.05], [17.3, y0 + 0.02, -19.98], 0.035);      // a pannier and a D-lock
    prop.sheet(zone, R.E.a, R.E.b, R.E.u(18.6) + 0.2, y0 + 1.9, y0 + 2.0, 0.6, 'postits');
    // a string of fairy lights along the wall over the bed
    onWall(R.S.a, R.S.b, () => { for (let i = 0; i < 14; i++) { const u = R.S.u(18.5) + i * 0.135; B.box(KEY(zone, i % 2 ? 'fff0b0' : 'ffe0e0'), u, y0 + 2.12 - Math.sin((i / 13) * Math.PI) * 0.08, 0.02, 0.03, 0.03, 0.03); } });
  }
  return { tris: B.tris() };
}
