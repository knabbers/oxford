// Worcester College, south: the Linbury Building (Maguire & Murray, 1990; Staircases 21-23): the stepped rendered
// range along Hythe Bridge Street with its roof-top loggias, the single-storey wing of square units behind it with a
// saw-tooth side to the court, and the square Linbury Room pavilion at its north corner. Called by
// places/worcester_south.js; see that file for sources and what is known or guessed.
import { frame, rectPts } from './_worcester_kit.js';
import { mk, T, win, wall, frustum, hip, offsetRing, prism } from './_worcester_south_kit.js';

const RK = 'wsRender', FR = 'wsBrown', RF = 'wsMetal', SH = 2.55;
// ---- the street range, east to west (world axes; north faces from the map, heights from the 2022 height survey; the
// south faces are held to the map's depth because the map's Hythe Bridge Street lies about 2 m north of the survey's).
// [x0, x1, z0, z1, solid height, loggia?, ridge]
export const RANGE = [
  { r: [-284.6, -281.7, 136.3, 144.0], h: 3 * SH, top: 9.6 },                    // against the Casson Building's west side
  { r: [-281.7, -279.8, 139.95, 144.0], h: 3 * SH, top: 9.6, plain: true },     // ... and round its south end
  { r: [-289.6, -284.6, 138.6, 145.6], h: 9.4, log: true, top: 12.4 },           // the tower: Staircase 21
  { r: [-299.6, -289.6, 139.2, 147.4], h: 3 * SH, log: true, top: 10.6 },
  { r: [-309.6, -299.6, 142.2, 149.6], h: 3 * SH, top: 8.3 },                    // the link: Staircase 22
  { r: [-313.4, -308.4, 145.6, 151.6], h: 2 * SH, log: true, top: 8.0 },         // the loggia block at the wall
  { r: [-318.4, -313.4, 145.4, 152.0], h: 2 * SH, top: 5.8 },                    // Staircase 23
  { r: [-323.4, -316.4, 150.6, 153.6], h: 4.4, top: 5.2 },
  { r: [-325.6, -319.0, 141.0, 150.6], h: 3.0, top: 4.2 },                       // the Morley Fletcher Room and laundry end (GUESS: under trees in every picture)
];
const boxRing = (r) => [[r[0], r[2]], [r[1], r[2]], [r[1], r[3]], [r[0], r[3]]];

/** a small square window in a raised render surround, dark brown frame, slate sill (face frame) */
function sq(B, c, y0, s, floor, pair = false) {
  for (const x of pair ? [c - s / 2 - 0.2, c + s / 2 + 0.2] : [c]) {
    win(B, x - s / 2, y0, x + s / 2, y0 + s, { wall: RK, frame: FR, cols: 1, depth: 0.12, bar: 0.07, floor });
    B.box('frame', x, y0 - 0.03, 0.057, s + 0.1, 0.05, 0.07, 0, { bottom: true });
  }
  const w = pair ? 2 * s + 0.4 : s;
  B.face(RK, rectPts(c - w / 2 - 0.16, y0 - 0.16, c + w / 2 + 0.16, y0 + s + 0.16), (pair ? [c - s / 2 - 0.2, c + s / 2 + 0.2] : [c]).map((x) => rectPts(x - s / 2, y0, x + s / 2, y0 + s)), 0.02);
}
/** a raised band on a wall face: its front, top and underside (no back: a neighbour's wall may lie in that plane) */
function band3(B, x0, x1, y0, y1, d) {
  B.poly(RK, [[x0, y0, d], [x1, y0, d], [x1, y1, d], [x0, y1, d]], [0, 0, 1]); B.poly(RK, [[x0, y1, d], [x1, y1, d], [x1, y1, 0], [x0, y1, 0]], [0, 1, 0]); B.poly(RK, [[x0, y0, 0], [x1, y0, 0], [x1, y0, d], [x0, y0, d]], [0, -1, 0]);
}
const holesOf = (list) => list.flatMap(([c, y0, s, , pair]) => (pair ? [c - s / 2 - 0.2, c + s / 2 + 0.2] : [c]).map((x) => rectPts(x - s / 2, y0, x + s / 2, y0 + s)));

export function buildLinburyRange(game, B) {
  const col = game.worldCollider;
  for (const [bi, K] of RANGE.entries()) {
    const [x0, x1, z0, z1] = K.r, R = boxRing(K.r), nSt = Math.max(1, Math.floor((K.h + 0.2) / SH));      // (whole storeys only: a window must lie inside its wall)
    const faces = [['n', mk([x1, z0], [x0, z0])], ['s', mk([x0, z1], [x1, z1])], ['w', mk([x0, z0], [x0, z1])], ['e', mk([x1, z1], [x1, z0])]];
    const doorA = faces[0][1].L * 0.22, dq = faces[0][1].pt(doorA, 0.3), inOther = (q) => RANGE.some((o, oi) => oi !== bi && q[0] > o.r[0] && q[0] < o.r[1] && q[1] > o.r[2] && q[1] < o.r[3]);
    const hasDoor = !K.plain && K.r[1] - K.r[0] > 4 && bi !== 8 && !inOther(dq);
    for (const [k, F] of faces) {
      const L = F.L, wins = [], mid = F.pt(L / 2, 0.3);
      // (no windows in a wall that stands against the next block)
      const free = !inOther(mid);
      if (!K.plain && free) for (let f = 0; f < nSt; f++) {
        const y = f * SH + 0.95, court = k === 'n';
        // the court side has the rooms' paired windows; the street side few and small ones; the returns one each
        if (court) { const m = Math.max(1, Math.round(L / 4.6)); for (let i = 0; i < m; i++) { const c = (L * (i + 0.5)) / m; if (f === 0 && hasDoor && Math.abs(c - doorA) < 2.2) continue; wins.push([c, y, 1.05, f, true]); } }      // (not where the door is)
        else if (k === 's') { if ((f + bi) % 2 === 0 || L > 8) wins.push([L * (f % 2 ? 0.3 : 0.68), y + 0.1, 0.85, f, false]); }
        else if (L > 5) wins.push([L / 2, y + 0.1, 0.85, f, false]);
      }
      B.push(F.mat());
      B.face(RK, rectPts(0, 0, L, K.h), holesOf(wins));
      for (const w of wins) sq(B, ...w);
      // the raised bands at the floor levels
      for (let f = 1; f * SH < K.h - 0.3; f++) band3(B, 0, L, f * SH - 0.2, f * SH - 0.04, 0.026);
      B.pop();
    }
    // a boarded door to the court under a small lead pent roof (one to each staircase block)
    if (hasDoor) {
      const F = faces[0][1], a = doorA;
      B.push(F.mat()); B.unit('doorOak', rectPts(a - 0.5, 0.02, a + 0.5, 2.1), 0.014);
      B.poly('lead', [[a - 0.9, 2.3, 1.0], [a + 0.9, 2.3, 1.0], [a + 0.9, 2.75, 0.0], [a - 0.9, 2.75, 0.0]], [0, 1, 1]); B.poly('wood', [[a - 0.9, 2.3, 1.0], [a + 0.9, 2.3, 1.0], [a + 0.9, 2.74, 0.0], [a - 0.9, 2.74, 0.0]], [0, -1, -1]);
      B.pop();
    }
    const ov = 0.95;
    if (K.log) {
      // the roof-top loggia: a solid parapet, the storey's own wall set back, slim posts carrying the deep-eaved roof
      const yP = K.h + 0.95, yE = K.top - 0.9, In = offsetRing(R, -1.3);
      prism(B, RK, R, K.h, yP); prism(B, RK, offsetRing(R, -0.22), K.h, yP, { inward: true });
      B.flat(RK, R, yP, [offsetRing(R, -0.22)]); B.flat('wsConc', offsetRing(R, -0.22), K.h + 0.04, [In]);
      prism(B, FR, In, K.h, yE);
      const posts = []; for (const [a, b] of [[R[0], R[1]], [R[1], R[2]], [R[2], R[3]], [R[3], R[0]]]) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.round(l / 2.6)); for (let i = 0; i < m; i++) posts.push([a[0] + ((b[0] - a[0]) * i) / m, a[1] + ((b[1] - a[1]) * i) / m]); }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      for (const p of posts) { const px = p[0] + Math.sign(cx - p[0]) * 0.11, pz = p[1] + Math.sign(cz - p[1]) * 0.11; B.boxXZ('wsPost', px - 0.055, px + 0.055, yP, yE, pz - 0.055, pz + 0.055, { top: false }); }
      hip(B, RF, x0 - ov, x1 + ov, z0 - ov, z1 + ov, yE, K.top - yE, 'wsSoffit');
      B.boxXZ('wsMetalD', x0 - ov, x1 + ov, yE - 0.1, yE, z0 - ov, z1 + ov, { top: false, bottom: false });
    } else {
      hip(B, RF, x0 - ov * 0.7, x1 + ov * 0.7, z0 - ov * 0.7, z1 + ov * 0.7, K.h + 0.02 + bi * 0.013, K.top - K.h, 'wsSoffit');      // (eaves a centimetre apart from block to block: neighbours' soffits overlap)
      prism(B, RK, R, K.h, K.h + 0.02 + bi * 0.013);
    }
    col.addPolygon(R, { tag: 'building' });
  }
}

// ---- the wing behind: a grid of 5.2 m units set at 41 degrees to the street (the map's outline is a staircase of
// them; the satellite picture shows each under its own low hipped metal roof). a runs south-east along the north-east
// side from the north corner, b south-west along the north-west side. The Linbury Room is the 2 x 2 at the corner.
export const WING_F = mk([-307.6, 118.7], [-291.75, 132.48]);
export const ROOM = 10.6, VER = 2.3;
export const UNITS = [[10.7, 15.9, 0, 6.7], [15.9, 21.0, 0, 5.9], [10.7, 15.9, 6.7, 11.7], [0, 5.9, 10.6, 16.9], [5.9, 10.7, 10.6, 16.9], [0, 5.9, 16.9, 22.4], [0, 5.3, 22.4, 27.6]];
const UNIT_E = 3.0, UNIT_R = 1.05;
/** is the point (wing frame) inside the Linbury Room or one of the units? */
const covered = (a, b) => (a > 0 && a < ROOM && b > 0 && b < ROOM) || UNITS.some((u) => a > u[0] && a < u[1] && b > u[2] && b < u[3]);

export function buildLinburyWing(game, B) {
  const F = WING_F, col = game.worldCollider, W = (a, b) => F.pt(a, b);
  B.push(F.mat());
  // ------------------------------------------------------------ the units: rendered walls, a low hipped metal roof each
  for (const [ui, [a0, a1, b0, b1]] of UNITS.entries()) {
    // (which sides are outside walls: north-west a = 0, north-east b = 0, and the saw-tooth sides to the court)
    const am = (a0 + a1) / 2, bm = (b0 + b1) / 2;
    const sides = [[frame(a0, 0, b0, 0, 1), b1 - b0, !covered(a0 - 0.3, bm)], [frame(a1, 0, b0, -1, 0), a1 - a0, !covered(am, b0 - 0.3)], [frame(a1, 0, b1, 0, -1), b1 - b0, !covered(a1 + 0.3, bm)], [frame(a0, 0, b1, 1, 0), a1 - a0, !covered(am, b1 + 0.3)]];
    for (const [M, L, open] of sides) {
      B.push(M);
      if (open) { const wins = [[L / 2, 1.0, 1.0, 0, L > 4.6]]; B.face(RK, rectPts(0, 0, L, UNIT_E), holesOf(wins)); for (const w of wins) sq(B, ...w); }
      else B.face(RK, rectPts(0, 0, L, UNIT_E));      // (against a neighbour: it shows only where the two do not quite meet)
      B.pop();
    }
    hip(B, RF, a0 - 0.45, a1 + 0.45, b0 - 0.45, b1 + 0.45, UNIT_E + ui * 0.013, UNIT_R + ((a0 + b0) % 3) * 0.04, 'wsSoffit');      // (eaves a centimetre or two apart: neighbours' soffits overlap)
    col.addPolygon([W(a0, b0), W(a1, b0), W(a1, b1), W(a0, b1)], { tag: 'building' });
  }
  // ------------------------------------------------------------ the Linbury Room: glazed to the garden on two sides behind a veranda
  const R = ROOM, yE = 2.6, c = R / 2, up = 3.3, yU = 3.95, yC = 4.7, yL = 5.6;
  for (const [mi, M] of [frame(0, 0, 0, 0, 1), frame(R, 0, 0, -1, 0)].entries()) {
    B.push(M);
    // rendered piers at the corners, four timber screens with a small-square grid between them
    const pier = 0.9, n = 4, sw = (R - 2 * pier) / n, wins = [];
    for (let i = 0; i < n; i++) wins.push([pier + i * sw + 0.09, 0.08, pier + (i + 1) * sw - 0.09, 2.5, { cols: 3, rows: 5, floor: 0 }]);
    wall(B, RK, rectPts(0, 0, R, 2.7), wins, { frame: 'wsTimber', depth: 0.07, bar: 0.07 });
    for (let i = 0; i <= n; i++) B.boxXZ('wsTimber', pier + i * sw - 0.09, pier + i * sw + 0.09, 0, 2.62, 0, 0.07, { top: false });
    // the veranda: flags flush with the lawn, white posts
    for (let i = 0; i <= 4; i++) { const x = (mi ? 0.25 : -VER + 0.25) + (i * (R + VER - 0.5)) / 4; B.boxXZ('white', x - 0.05, x + 0.05, 0.04, yE, VER - 0.3, VER - 0.2, { top: false }); }
    B.pop();
  }
  for (const M of [frame(R, 0, R, 0, -1), frame(0, 0, R, 1, 0)]) { B.push(M); B.face(RK, rectPts(0, 0, R, 2.7)); B.pop(); }
  // the lower roof over room and veranda, the raised upper tier, the lantern with its stepped cap and finial
  frustum(B, RF, [-VER - 0.35, R + 0.5, -VER - 0.35, R + 0.5], yE, [c - up, c + up, c - up, c + up], yU, null, 'wsSoffit');
  B.boxXZ('wsMetalD', -VER - 0.35, R + 0.5, yE - 0.1, yE, -VER - 0.35, R + 0.5, { top: false, bottom: false });
  B.boxXZ('wsMetalD', c - up, c + up, yU, yC, c - up, c + up, { top: false });
  frustum(B, RF, [c - up - 0.45, c + up + 0.45, c - up - 0.45, c + up + 0.45], yC, [c - 1.25, c + 1.25, c - 1.25, c + 1.25], yL, null, 'wsMetalD');
  B.boxXZ('wsMetalD', c - 1.25, c + 1.25, yL, yL + 0.85, c - 1.25, c + 1.25, { top: false });
  frustum(B, RF, [c - 1.6, c + 1.6, c - 1.6, c + 1.6], yL + 0.85, [c - 0.45, c + 0.45, c - 0.45, c + 0.45], yL + 1.2, RF, 'wsMetalD');
  B.boxXZ('iron', c - 0.025, c + 0.025, yL + 1.2, yL + 2.5, c - 0.025, c + 0.025);
  for (const [dx, dz] of [[0.3, 0], [0, 0.3]]) B.boxXZ('iron', c - dx - 0.015, c + dx + 0.015, yL + 2.1, yL + 2.13, c - dz - 0.015, c + dz + 0.015, { bottom: true });
  B.pop();
  col.addPolygon([W(0, 0), W(R, 0), W(R, R), W(0, R)], { tag: 'building' });
  for (const s of [0, 1]) for (let i = 0; i <= 4; i++) { const t = -VER + 0.25 + (i * (R + VER - 0.5)) / 4, p = s ? W(t, -(VER - 0.25)) : W(-(VER - 0.25), t); col.addCircle(p[0], p[1], 0.07, { tag: 'furniture' }); }
}
