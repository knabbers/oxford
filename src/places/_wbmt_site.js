// Behind 5, 6 & 7 Beaumont Street (places/worcester_beaumont.js): the courtyard side of the front range, the courtyard
// itself (open to the sky: the world), the orange-rendered, timber-clad two-storey block of the college's courtyard
// photograph — its shell, with REAL holes at its door and windows (the rooms behind them are the walk-in room
// _wbmt_plan.js BLOCK_ID, built by _wbmt_block.js) — and the other buildings round the courtyard as plain masses.
// Front frame (x = s, y up, z = -t). Keys: the Worcester atlas + this module's tints (bmt*, added to the pack in
// worcester_beaumont.js) + 'bmtDecal' + the ground key 'setts'.
//   buildSite(B, D)   everything outdoors behind the front range -> { openings, tris }
//   blockGlass(D)     the panes of the block's real windows (drawn with its rooms, in the room's scene)
// What is from the photographs and what is a guess: docs/research/worcester.md "Beaumont Street: the courtyard house".
import * as THREE from 'three';
import { frame, rectPts } from './_worcester_kit.js';
import { FRONT, DEPTH, PAVE, IN, BLOCK, BK, COURT, MASSES, PLANTER, BIKES, OPENINGS, openingEnds, BACKWAY } from './_wbmt_plan.js';

const Y = (h) => h + PAVE;
const M4 = () => new THREE.Matrix4();
/** the block's roof: a single pitch rising from the east (the white wall) to the west (the path), over wide eaves */
export const ROOF = { yE: BK.EAVES, yW: BK.EAVES + 0.6, over: 1.0, overN: 0.8, thick: 0.24 };
const roofY = (s) => ROOF.yE + ((s - BLOCK.s0) / (BLOCK.s1 - BLOCK.s0)) * (ROOF.yW - ROOF.yE);
const GLASS_IN = 0.09;                 // the panes stand this far behind the outer face

/** frame members round an opening u0..u1, y0..y1 on the wall the Batch is framed to (z = out): at depth z, with
 *  mullions at the given fractions and transoms at the given heights */
function joinery(B, key, u0, u1, y0, y1, z, mull = [], trans = [], m = 0.06) {
  const d = 0.05, um = (u0 + u1) / 2, ym = (y0 + y1) / 2;
  B.box(key, u0 + m / 2, ym, z, m, y1 - y0, d); B.box(key, u1 - m / 2, ym, z, m, y1 - y0, d);
  B.box(key, um, y1 - m / 2, z, u1 - u0, m, d); B.box(key, um, y0 + m / 2, z, u1 - u0, m, d);
  for (const f of mull) B.box(key, u0 + (u1 - u0) * f, ym, z, m * 0.8, y1 - y0 - m, d);
  for (const y of trans) B.box(key, um, y, z, u1 - u0 - m, m * 0.8, d);
}
/** a painted (not real) window: grey-blue frame round a dark pane, on the framed wall */
function paintedWin(B, u0, u1, y0, y1, mull = [], z = 0.02) {
  B.poly('glassDark', [[u0, y0, z], [u1, y0, z], [u1, y1, z], [u0, y1, z]], [0, 0, 1], [[0, 0], [0, 0], [0, 0], [0, 0]]);
  joinery(B, 'bmtFrame', u0, u1, y0, y1, z + 0.015, mull, [], 0.055);
  B.box('bmtFrame', (u0 + u1) / 2, y0 - 0.025, z + 0.03, u1 - u0 + 0.1, 0.05, 0.09, 0, { bottom: true });
}
const onWall = (B, a, b, fn) => { B.push(frame(a[0], 0, -a[1], b[0] - a[0], -(b[1] - a[1]))); fn(Math.hypot(b[0] - a[0], b[1] - a[1])); B.pop(); };

/** a parked bike leaning on the wall at its back (local: x along the bike, z out from the wall) */
function bike(B, s, t, rot, col) {
  B.push(M4().makeRotationY(rot).setPosition(s, Y(0.03), -t));
  const R = 0.33, lean = 0, wheel = (x) => { for (let i = 0; i < 8; i++) { const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2; B.beam('iron', [x + Math.cos(a0) * R, R + Math.sin(a0) * R, lean], [x + Math.cos(a1) * R, R + Math.sin(a1) * R, lean], 0.03); } };
  wheel(-0.52); wheel(0.52);
  const P = (x, y) => [x, y, lean - (y - R) * 0.12];
  B.beam(col, P(-0.52, R), P(-0.12, 0.3), 0.03); B.beam(col, P(-0.12, 0.3), P(-0.24, 0.82), 0.03); B.beam(col, P(-0.24, 0.82), P(0.36, 0.84), 0.03);
  B.beam(col, P(-0.12, 0.3), P(0.36, 0.84), 0.03); B.beam(col, P(-0.52, R), P(-0.24, 0.82), 0.022); B.beam(col, P(0.36, 0.84), P(0.52, R), 0.03); B.beam(col, P(0.36, 0.84), P(0.33, 0.98), 0.026);
  B.box('iron', -0.26, 0.9, lean - 0.07, 0.24, 0.05, 0.12); B.box('iron', 0.33, 1.0, lean - 0.08, 0.04, 0.03, 0.46);
  B.pop();
}

/**
 * Everything outdoors behind the front range. B: the exterior Batch (front frame). D: paintDecals().
 * -> { openings: how many real openings the block's shell has (windows + the door), tris }
 */
export function buildSite(B, D) {
  const t0 = B.tris();
  // ---------------------------------------------------------------- the courtyard side of the front range
  { const sE = BLOCK.s0, L = FRONT - sE, dA = FRONT - (BACKWAY.s + 0.45), dB = FRONT - (BACKWAY.s - 0.45), dy0 = Y(IN.G), dy1 = Y(IN.G + 2.04);
    B.push(frame(FRONT, 0, -DEPTH, -1, 0));
    const door = rectPts(dA, dy0, dB, dy1);
    B.face('bmtRear', rectPts(0, 0, L, Y(8.9)), [door], 0);
    B.reveal('white', door, 0, -0.1, true);
    B.box('white', dA + 0.025, (dy0 + dy1) / 2, -0.1, 0.05, dy1 - dy0, 0.09); B.box('white', dB - 0.025, (dy0 + dy1) / 2, -0.1, 0.05, dy1 - dy0, 0.09); B.box('white', (dA + dB) / 2, dy1 - 0.025, -0.1, dB - dA, 0.05, 0.09);
    B.box('bmtDress', (dA + dB) / 2, Y(IN.G / 2), 0.24, dB - dA + 0.5, IN.G, 0.48);                     // the stone step down into the courtyard
    B.box('grey', (dA + dB) / 2, dy1 + 0.32, 0.07, 0.2, 0.12, 0.14); B.box('lampGlass', (dA + dB) / 2, dy1 + 0.24, 0.09, 0.14, 0.05, 0.1, 0, { bottom: true }); B.card('bmtPool', [(dA + dB) / 2 - 0.22, dy1 + 0.02, 0.15], [(dA + dB) / 2 + 0.22, dy1 + 0.02, 0.15], [(dA + dB) / 2 + 0.22, dy1 + 0.46, 0.15], [(dA + dB) / 2 - 0.22, dy1 + 0.46, 0.15], [0, 0, 1, 1]);      // bulkhead light over the door
    B.sign('bmtDecal', dB + 0.16, Y(1.25), dB + 0.28, Y(1.45), 0.012, D.uv('entry'));
    // sashes (painted): three storeys; the column over the door starts on the first floor
    for (const [s, k, rows] of [[15.4, 0, 3], [18.4, 1, 3], [21.3, 2, 2], [24.6, 3, 3]]) for (const [ya, yc, f] of [[1.0, 2.6, 0], [4.0, 5.7, 1], [6.9, 8.0, 2]].slice(3 - rows)) {
      const u = FRONT - s; B.unit('sash', rectPts(u - 0.52, Y(ya), u + 0.52, Y(yc)), 0.02, [300 + k, f]); B.box('white', u, Y(ya) - 0.04, 0.05, 1.2, 0.07, 0.1, 0, { bottom: true });
    }
    B.box('white', L - 0.25, Y(4.4), 0.06, 0.09, 8.6, 0.09);                                             // a rainwater pipe by the white wall
    B.pop(); }

  // ---------------------------------------------------------------- the ground: setts
  B.flat('setts', COURT.map(([s, t]) => [s, -t]), Y(0.03));

  // ---------------------------------------------------------------- the masses round the courtyard
  const WALLKEY = { east: 'bmtWhiteBrick', west: 'bmtCream', south: 'bmtCream' };
  for (const Ms of MASSES) {
    const pts = Ms.poly.map(([s, t]) => [s, -t]), h = Y(Ms.h);
    let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = area > 0 ? 1 : -1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (Math.abs(a[1] + DEPTH) < 0.01 && Math.abs(b[1] + DEPTH) < 0.01) continue;                    // the joint with the front range
      B.poly(WALLKEY[Ms.id], [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]], [dz * sg / L, 0, -dx * sg / L]);
    }
    B.flat('bmtZinc', pts, h);
  }
  // the white-painted brick wall (east side of the courtyard): a grey coping, a downpipe at its end
  onWall(B, [BLOCK.s0, DEPTH], [BLOCK.s0, BLOCK.t0], (L) => {
    B.box('bmtZinc', L / 2, Y(6.2) + 0.04, 0.03, L, 0.1, 0.18, 0, { bottom: true });
    B.box('bmtFrame', L - 0.14, Y(3.0), 0.06, 0.09, 5.9, 0.09);
  });
  // the cream block on the Playhouse side: a blue glazed-brick plinth under a long grey-framed window (foreground of the
  // photograph), a buff brick pier with a downpipe, a brick ground storey beyond; windows in the cream render above
  onWall(B, [22.8, 20.6], [22.8, 9.6], (L) => {
    B.box('bmtBlueBrick', 9.0, Y(0.475), 0.025, 4.0, 0.95, 0.09); B.box('bmtFrame', 9.0, Y(0.955), 0.06, 4.06, 0.07, 0.16, 0, { bottom: true });
    paintedWin(B, 7.25, 10.75, Y(1.04), Y(2.55), [0.25, 0.5, 0.75], 0.03);
    B.box('bmtBrown', 6.45, Y(1.45), 0.06, 1.1, 2.9, 0.16); B.box('bmtFrame', 5.84, Y(4.5), 0.07, 0.1, 9.0, 0.1);
    B.box('bmtBrown', 2.95, Y(1.4), 0.01, 5.9, 2.8, 0.06);
    paintedWin(B, 3.6, 4.5, Y(1.1), Y(2.2), [0.5], 0.06); paintedWin(B, 1.0, 1.9, Y(1.1), Y(2.2), [0.5], 0.06);
    for (const y of [3.75, 6.5]) for (const u of [1.5, 4.1, 6.9, 9.6]) paintedWin(B, u - 0.55, u + 0.55, Y(y), Y(y + 1.3), [0.5]);
    void L;
  });
  onWall(B, [22.8, 9.6], [27.6, 9.6], (L) => {
    B.box('bmtBlueBrick', L / 2, Y(0.475), 0.025, L, 0.95, 0.09);
    for (const y of [1.15, 3.75, 6.5]) paintedWin(B, 1.6, 3.2, Y(y), Y(y + 1.3), [0.5]);
  });
  // the far block at the end of the path: a brick ground storey with its door, cream above, a rounded bay with a glazed top
  onWall(B, [BLOCK.s1, BLOCK.t1], [22.8, BLOCK.t1], (L) => {
    B.box('redBrick', L / 2, Y(1.45), 0.01, L, 2.9, 0.06); B.box('bmtBlueBrick', 0.3, Y(1.45), 0.05, 0.6, 2.9, 0.06);
    B.unit('doorOak', rectPts(0.85, Y(0.03), 1.8, Y(2.1)), 0.07, [7, 9]); B.box('bmtFrame', 1.325, Y(2.14), 0.06, 1.05, 0.08, 0.08);
    B.box('grey', 0.52, Y(1.35), 0.07, 0.2, 0.2, 0.05);
  });
  B.cyl('bmtCream', 21.75, Y(2.95), -BLOCK.t1 + 0.1, 1.0, 5.4, 14, false); B.cyl('glassDark', 21.75, Y(8.35), -BLOCK.t1 + 0.1, 1.02, 1.25, 14, false); B.cyl('bmtZinc', 21.75, Y(9.6), -BLOCK.t1 + 0.1, 1.12, 0.12, 14, true);
  for (const y of [3.6, 6.0]) B.cyl('bmtFrame', 21.75, Y(y), -BLOCK.t1 + 0.1, 1.012, 1.1, 14, false);
  // the boundary wall behind the orange block (seen from its back windows)
  B.poly('buff', [[BLOCK.s0, 0, -20.75], [BLOCK.s1, 0, -21.9], [BLOCK.s1, Y(2.6), -21.9], [BLOCK.s0, Y(2.6), -20.75]], [0, 0, 1]);

  // ---------------------------------------------------------------- the orange block: its shell, with real holes
  let real = 0;
  const holesOf = (wall, u) => OPENINGS.filter((o) => o.wall === wall).map((o) => ({ o, u0: u(o.c - o.w / 2), u1: u(o.c + o.w / 2) })).map((q) => ({ o: q.o, u0: Math.min(q.u0, q.u1), u1: Math.max(q.u0, q.u1) }));
  const shellWall = (a, b, outline, holes, extra = []) => onWall(B, a, b, () => {
    const hs = holes.map((q) => rectPts(q.u0, Y(q.o.y0), q.u1, Y(q.o.y1)));
    B.face('bmtOrange', outline, [...hs, ...extra], 0);
    for (const h of [...hs, ...extra]) { B.reveal('bmtFrame', h, 0, -GLASS_IN, false); real++; }
    for (const q of holes) {
      const o = q.o, y0 = Y(o.y0), y1 = Y(o.y1), z = -GLASS_IN + 0.02;
      // which pane is the wide one follows the corner: the narrow light is at the end away from it
      const west = o.wall === 'W', mull = o.kind === 'bay' ? [west ? 0.68 : 0.32] : o.kind === 'corner' ? [0.5] : o.w > 1.1 ? [0.5] : [];
      joinery(B, 'bmtFrame', q.u0, q.u1, y0, y1, z, mull, o.kind === 'corner' ? [y0 + 0.72] : []);
      if (o.kind === 'bay') {
        // the oriel's box frame, standing proud of the wall over the timber panel
        const p = 0.16; B.box('bmtFrame', (q.u0 + q.u1) / 2, y1 + 0.06, p / 2, q.u1 - q.u0 + 0.24, 0.12, p, 0, { bottom: true }); B.box('bmtFrame', (q.u0 + q.u1) / 2, y0 - 0.05, p / 2, q.u1 - q.u0 + 0.24, 0.1, p, 0, { bottom: true });
        for (const u of [q.u0 - 0.06, q.u1 + 0.06]) B.box('bmtFrame', u, (y0 + y1) / 2, p / 2, 0.12, y1 - y0, p);
      } else B.box('bmtFrame', (q.u0 + q.u1) / 2, y0 - 0.03, 0.03, q.u1 - q.u0 + 0.12, 0.06, 0.1, 0, { bottom: true });
    }
  });
  const W = BLOCK.s1 - BLOCK.s0, Dp = BLOCK.t1 - BLOCK.t0, yE = Y(ROOF.yE), yW = Y(ROOF.yW), F = BK.F1;
  // north (the face on the courtyard): u = s - s0
  shellWall([BLOCK.s0, BLOCK.t0], [BLOCK.s1, BLOCK.t0], [[0, 0], [W, 0], [W, yW], [0, yE]], holesOf('N', (s) => s - BLOCK.s0));
  onWall(B, [BLOCK.s0, BLOCK.t0], [BLOCK.s1, BLOCK.t0], () => {
    B.box('bmtCedar', (5.25 + W) / 2 + 0.04, Y((2.42 + F + 0.8) / 2), 0.04, W - 5.25 + 0.08, F + 0.8 - 2.42, 0.16, 0, { bottom: true });      // timber panel under the oriel
    paintedWin(B, 2.6, 3.2, Y(1.0), Y(1.55));                                                               // room 1's small window (painted)
    B.box('bmtFrame', 0.16, Y(2.8), 0.06, 0.09, 5.4, 0.09);                                                 // downpipe at the white wall
  });
  // west (the long side on the path): u = t - t0; the door
  const dU0 = BK.DOOR.t - BK.DOOR.w / 2 - BLOCK.t0, dU1 = BK.DOOR.t + BK.DOOR.w / 2 - BLOCK.t0, dy0 = Y(BK.G), dy1 = Y(BK.G + 2.06);
  shellWall([BLOCK.s1, BLOCK.t0], [BLOCK.s1, BLOCK.t1], rectPts(0, 0, Dp, yW), holesOf('W', (t) => t - BLOCK.t0), [rectPts(dU0, dy0, dU1, dy1)]);
  onWall(B, [BLOCK.s1, BLOCK.t0], [BLOCK.s1, BLOCK.t1], () => {
    B.box('bmtCedar', 0.98, Y((2.42 + F + 0.8) / 2), 0.04, 2.04, F + 0.8 - 2.42, 0.16, 0, { bottom: true });
    B.box('bmtFrame', -0.07, Y((2.42 + ROOF.yW) / 2), 0.07, 0.14, ROOF.yW - 2.42, 0.14);                   // the oriel's corner post
    for (const u of [dU0 + 0.03, dU1 - 0.03]) B.box('bmtFrame', u, (dy0 + dy1) / 2, -0.1, 0.06, dy1 - dy0, 0.1); B.box('bmtFrame', (dU0 + dU1) / 2, dy1 - 0.03, -0.1, dU1 - dU0, 0.06, 0.1);
    B.box('bmtFrame', (dU0 + dU1) / 2, dy1 + 0.36, 0.3, 1.5, 0.06, 0.6, 0, { bottom: true });              // a small flat canopy
    B.box('grey', (dU0 + dU1) / 2, dy1 + 0.2, 0.06, 0.2, 0.1, 0.12); B.box('lampGlass', (dU0 + dU1) / 2, dy1 + 0.13, 0.08, 0.14, 0.04, 0.1, 0, { bottom: true }); B.card('bmtPool', [(dU0 + dU1) / 2 - 0.2, dy1 - 0.08, 0.14], [(dU0 + dU1) / 2 + 0.2, dy1 - 0.08, 0.14], [(dU0 + dU1) / 2 + 0.2, dy1 + 0.32, 0.14], [(dU0 + dU1) / 2 - 0.2, dy1 + 0.32, 0.14], [0, 0, 1, 1]);
    B.sign('bmtDecal', dU1 + 0.18, Y(1.25), dU1 + 0.3, Y(1.45), 0.012, D.uv('entry'));
    for (const u of [2.45, 2.85, 5.6, 6.0]) paintedWin(B, u - 0.12, u + 0.12, Y(F + 1.3), Y(F + 2.1));    // the slit windows of the photograph (painted)
    paintedWin(B, 7.3, 7.9, Y(1.3), Y(2.1));
  });
  // south (the back, on the boundary): u = s1 - s
  shellWall([BLOCK.s1, BLOCK.t1], [BLOCK.s0, BLOCK.t1], [[0, 0], [W, 0], [W, yE], [0, yW]], holesOf('S', (s) => BLOCK.s1 - s));
  onWall(B, [BLOCK.s1, BLOCK.t1], [BLOCK.s0, BLOCK.t1], () => { paintedWin(B, 1.6, 2.8, Y(1.05), Y(2.2), [0.5]); paintedWin(B, 4.4, 5.6, Y(1.05), Y(2.2), [0.5]); });
  // the roof: zinc over a pale soffit, wide eaves to the courtyard and the path
  { const a = BLOCK.s0, b = BLOCK.s1 + ROOF.over, n = BLOCK.t0 - ROOF.overN, s = BLOCK.t1 + 0.3, ya = Y(roofY(a)) + ROOF.thick, yb = Y(roofY(b)) + ROOF.thick, th = ROOF.thick;
    B.poly('bmtZinc', [[a, ya, -n], [b, yb, -n], [b, yb, -s], [a, ya, -s]], [0, 1, 0]);
    B.poly('white', [[a, ya - th, -n], [b, yb - th, -n], [b, yb - th, -s], [a, ya - th, -s]], [0, -1, 0]);
    B.poly('bmtZinc', [[a, ya - th, -n], [b, yb - th, -n], [b, yb, -n], [a, ya, -n]], [0, 0, 1]);
    B.poly('bmtZinc', [[b, yb - th, -n], [b, yb - th, -s], [b, yb, -s], [b, yb, -n]], [1, 0, 0]);
    B.poly('bmtZinc', [[b, yb - th, -s], [a, ya - th, -s], [a, ya, -s], [b, yb, -s]], [0, 0, -1]);
    B.poly('bmtZinc', [[a, ya - th, -s], [a, ya - th, -n], [a, ya, -n], [a, ya, -s]], [-1, 0, 0]); }
  // Behind the real openings, when the rooms are not drawn (far off; before they are built): the dark of an unlit house.
  // Faces looking INWARDS a little outside the rooms' own walls, holed where the openings are.
  { const e = 0.06, x0 = BK.S0 - e, x1 = BK.S1 + e, n = BK.N - e, s = BK.S + e, y0 = 0.02, y1 = Y(BK.F1C) + 0.12;
    const liner = (a, b, holes) => onWall(B, a, b, (L) => B.face('bmtLiner', rectPts(0, y0, L, y1), holes, 0));
    liner([x1, n], [x0, n], holesOf('N', (q) => x1 - q).map((q) => rectPts(q.u0, Y(q.o.y0), q.u1, Y(q.o.y1))));
    liner([x1, s], [x1, n], [...holesOf('W', (q) => s - q).map((q) => rectPts(q.u0, Y(q.o.y0), q.u1, Y(q.o.y1))), rectPts(s - BK.DOOR.t - BK.DOOR.w / 2, dy0, s - BK.DOOR.t + BK.DOOR.w / 2, dy1)]);
    liner([x0, s], [x1, s], holesOf('S', (q) => q - x0).map((q) => rectPts(q.u0, Y(q.o.y0), q.u1, Y(q.o.y1))));
    liner([x0, n], [x0, s], []);
    B.poly('bmtLiner', [[x0, y1, -n], [x0, y1, -s], [x1, y1, -s], [x1, y1, -n]], [0, -1, 0]);
    B.poly('bmtLiner', [[x0, y0, -s], [x0, y0, -n], [x1, y0, -n], [x1, y0, -s]], [0, 1, 0]); }

  // ---------------------------------------------------------------- in the courtyard
  // the six-sided brick planter with its slatted timber seat and the old hydrangea (photograph)
  { const P = PLANTER, x = P.s, z = -P.t, top = Y(P.h);
    B.cyl('bmtBrown', x, Y(0.03), z, P.r, P.h - 0.03, 6, false); B.cyl('teak', x, top, z, P.r + 0.04, 0.05, 6, true);
    B.cyl('soil', x, top + 0.05, z, P.r * 0.42, 0.012, 6, true);
    const R = (i) => { const v = Math.sin(i * 127.1 + 3.7) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 9; i++) {
      const a = R(i) * 6.283, len = 0.9 + R(i + 20) * 0.7, rr = 0.2 + R(i + 40) * 0.75, hx = x + Math.sin(a) * rr, hz = z + Math.cos(a) * rr, hy = top + len;
      B.beam('bmtTwig', [x + Math.sin(a) * 0.12, top, z + Math.cos(a) * 0.12], [hx, hy, hz], 0.03);
      for (let j = 0; j < 2; j++) { const bx = hx + (R(i * 3 + j) - 0.5) * 0.36, bz = hz + (R(i * 5 + j) - 0.5) * 0.36, by = hy - 0.1 + R(i * 7 + j) * 0.2; B.cyl('bmtDry', bx, by, bz, 0.13, 0.09, 7, true, 0.06); B.cyl(j ? 'bmtDry' : 'bmtDry2', bx, by + 0.09, bz, 0.06, 0.08, 7, true, 0.13); B.cyl('bmtDry2', bx + 0.07, by + 0.02, bz + 0.06, 0.07, 0.07, 6, true, 0.04); }
    } }
  // the low planter with the grey-green shrub at the block's corner: rounded clumps, a few flower spikes
  B.boxXZ('bmtBrown', 18.75, 20.55, Y(0.03), Y(0.42), -12.34, -11.8); B.boxXZ('soil', 18.82, 20.48, Y(0.42), Y(0.44), -12.28, -11.86);
  { const R = (i) => { const v = Math.sin(i * 91.7 + 1.3) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 9; i++) { const s = 18.98 + (i / 8) * 1.36, t = 12.07 + (R(i) - 0.5) * 0.2, r = 0.2 + R(i + 9) * 0.1, key = i % 3 ? 'bmtSage' : 'leafC';
      B.cyl(key, s, Y(0.44), -t, r, r * 0.55, 8, false, r * 0.72); B.cyl(key, s, Y(0.44) + r * 0.55, -t, r * 0.5, r * 0.4, 8, true, r);
      if (i % 2) B.cyl('flP', s + 0.05, Y(0.44) + r * 0.9, -t + 0.04, 0.012, 0.22, 5, true, 0.03); } }
  // wheelie bins in the pocket by the Playhouse wall, drain covers in the setts, hoops for the bikes
  for (const [s, key] of [[24.3, 'bmtBinG'], [25.05, 'bmtBinB'], [25.8, 'bmtBinG']]) { B.boxXZ(key, s - 0.29, s + 0.29, Y(0.1), Y(0.98), -9.52, -8.86); B.boxXZ(key, s - 0.31, s + 0.31, Y(0.98), Y(1.05), -9.56, -8.8); B.boxXZ('iron', s - 0.22, s + 0.22, Y(1.05), Y(1.08), -8.84, -8.8); for (const dx of [-0.24, 0.24]) B.boxXZ('iron', s + dx - 0.03, s + dx + 0.03, Y(0.03), Y(0.2), -9.5, -9.32); }
  for (const [s, t] of [[21.6, 11.2], [21.9, 18.3], [15.2, 9.3]]) { B.boxXZ('iron', s - 0.2, s + 0.2, Y(0.03), Y(0.042), -t - 0.2, -t + 0.2); for (let i = 0; i < 4; i++) B.boxXZ('grey', s - 0.15, s + 0.15, Y(0.042), Y(0.052), -t + 0.1 - i * 0.09, -t + 0.14 - i * 0.09); }
  for (const t of [9.45, 10.05, 10.8]) { B.beam('alu', [13.25, Y(0.03), -t], [13.25, Y(0.8), -t], 0.04); B.beam('alu', [14.5, Y(0.03), -t], [14.5, Y(0.8), -t], 0.04); B.beam('alu', [13.25, Y(0.8), -t], [14.5, Y(0.8), -t], 0.04); }
  // the pools of light under the two lamps after dark (additive, unlit: worcester_beaumont.js sets their strength)
  for (const [s, t, r] of [[BACKWAY.s, DEPTH + 1.0, 2.3], [BLOCK.s1 + 0.9, BK.DOOR.t, 2.0]]) B.card('bmtPool', [s - r, Y(0.05), -t + r], [s + r, Y(0.05), -t + r], [s + r, Y(0.05), -t - r], [s - r, Y(0.05), -t - r], [0, 0, 1, 1]);
  onWall(B, [FRONT, DEPTH], [BLOCK.s0, DEPTH], () => { const u = FRONT - BACKWAY.s; B.card('bmtPool', [u - 1.5, Y(0.2), 0.012], [u + 1.5, Y(0.2), 0.012], [u + 1.5, Y(3.4), 0.012], [u - 1.5, Y(3.4), 0.012], [0, 0, 1, 0.62]); });
  onWall(B, [BLOCK.s1, BLOCK.t0], [BLOCK.s1, BLOCK.t1], () => { const u = BK.DOOR.t - BLOCK.t0; B.card('bmtPool', [u - 1.4, Y(0.2), 0.016], [u + 1.4, Y(0.2), 0.016], [u + 1.4, Y(3.2), 0.016], [u - 1.4, Y(3.2), 0.016], [0, 0, 1, 0.62]); });
  // bikes against the white wall
  BIKES.at.forEach(([s, t], i) => bike(B, s + (i % 2 ? 0.06 : 0), t, i % 2 ? Math.PI : 0, ['bmtBikeA', 'bmtBikeB', 'iron', 'bmtBikeA'][i]));
  return { openings: real, tris: B.tris() - t0 };
}

/** The panes of the block's real windows, in the room's frame: one small geometry (position, uv into the decal
 *  sheet's 'glass' cell) for a transparent, depthWrite:false material in the ROOM's scene. */
export function blockGlass(D) {
  const g = D.uv('glass'), pos = [], uv = [];
  const tri = (a, b, c, ta, tb, tc) => { pos.push(...a, ...b, ...c); uv.push(...ta, ...tb, ...tc); };
  for (const o of OPENINGS) {
    const e = openingEnds(o), k = GLASS_IN, a = [e.a[0] - e.out[0] * k, -(e.a[1] - e.out[1] * k)], b = [e.b[0] - e.out[0] * k, -(e.b[1] - e.out[1] * k)], y0 = Y(o.y0) + 0.04, y1 = Y(o.y1) - 0.04;
    tri([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [g[0], g[1]], [g[2], g[1]], [g[2], g[3]]); tri([a[0], y0, a[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [g[0], g[1]], [g[2], g[3]], [g[0], g[3]]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}
