// Worcester College, south: the Casson Building (the slab, Staircases 17-18), the Wolfson Building (the crescent,
// Staircases 19-20) and the oval lawn between them inside Gate 1. Called by places/worcester_south.js; see that file
// for sources and what is known or guessed.
import { rectPts } from './_worcester_kit.js';
import { mk, T, win, wall, shrub, blob, prism, band, offsetRing, ring, bay } from './_worcester_south_kit.js';

// ---- Casson Building: the 2022 height survey's rectangle (30.0 x 10.2 m, due north-south; the map's outline is 2 m
// short at the north). Three brick storeys, a white storey set back, a zinc mansard with box dormers, a flat top.
export const CASSON = { x0: -281.5, x1: -271.3, z0: 109.8, z1: 139.8, S: 2.9, brick: 8.9, white: 11.35, fascia: 11.9, top: 13.2, pass: [129.6, 133.0], passH: 2.6, set: 0.6, bays: 9 };
export const CASSON_PARTS = [[[CASSON.x0, CASSON.z0], [CASSON.x1, CASSON.z0], [CASSON.x1, CASSON.pass[0]], [CASSON.x0, CASSON.pass[0]]], [[CASSON.x0, CASSON.pass[1]], [CASSON.x1, CASSON.pass[1]], [CASSON.x1, CASSON.z1], [CASSON.x0, CASSON.z1]]];
const CB = 'wsBrickC', GREY = 'wsWinGrey';

/** a metal box window standing d proud of the wall (no back), its glazing on the front */
function boxWin(B, x0, y0, x1, y1, d, o = {}) {
  lug(B, GREY, x0, y0, x1, y1, d, true);
  B.push(T(0, 0, d + 0.012)); win(B, x0, y0, x1, y1, { wall: null, frame: GREY, cols: o.cols || 2, depth: 0, bar: 0.07, floor: o.floor }); B.pop();
}
/** a block standing d proud of the wall: four sides and (unless open) a front */
function lug(B, key, x0, y0, x1, y1, d, open = false) {
  B.poly(key, [[x0, y0, 0], [x0, y0, d], [x0, y1, d], [x0, y1, 0]], [-1, 0, 0]); B.poly(key, [[x1, y0, d], [x1, y0, 0], [x1, y1, 0], [x1, y1, d]], [1, 0, 0]);
  B.poly(key, [[x0, y1, d], [x1, y1, d], [x1, y1, 0], [x0, y1, 0]], [0, 1, 0]); B.poly(key, [[x0, y0, 0], [x1, y0, 0], [x1, y0, d], [x0, y0, d]], [0, -1, 0]);
  if (!open) B.poly(key, [[x0, y0, d], [x1, y0, d], [x1, y1, d], [x0, y1, d]], [0, 0, 1]);
}

export function buildCasson(game, B) {
  const C = CASSON, L = C.z1 - C.z0, W = C.x1 - C.x0, col = game.worldCollider, bw = L / C.bays;
  // ------------------------------------------------------------ the long sides
  const sides = [['w', mk([C.x0, C.z0], [C.x0, C.z1]), [C.pass[0] - C.z0, C.pass[1] - C.z0], 3, 0.22], ['e', mk([C.x1, C.z1], [C.x1, C.z0]), [C.z1 - C.pass[1], C.z1 - C.pass[0]], 8, 0.45]];
  for (const [k, F, pa, doorBay, proud] of sides) {
    B.push(F.mat());
    const holes = [], after = [];
    let door = null;
    for (let i = 0; i < C.bays; i++) {
      const c = (i + 0.5) * bw, inPass = c > pa[0] && c < pa[1];
      // ground floor: tall plain windows; a staircase door (GUESS: which bay)
      if (i === doorBay) door = [c - 0.6, c + 0.6, 2.2];
      else if (!inPass) holes.push([c - 0.5, 0.5, c + 0.5, 2.45, { cols: 1, floor: 0 }]);
      for (let f = 1; f <= 2; f++) {
        const y = f * C.S + 0.95;
        if (i % 2 === 0) { after.push(() => boxWin(B, c - 0.8, y, c + 0.8, y + 1.5, proud, { floor: f })); if (k === 'e') after.push(() => { lug(B, CB, c - 0.74, y - 0.26, c + 0.74, y, proud - 0.1); lug(B, CB, c - 0.6, y - 0.5, c + 0.6, y - 0.26, proud - 0.26); }); }
        else for (const s of [-1, 1]) after.push(() => boxWin(B, c + s * 0.68 - 0.3, y, c + s * 0.68 + 0.3, y + 1.5, proud * 0.6, { cols: 1, floor: f }));
      }
    }
    // the brick wall, the way through and the door cut out of its foot
    const out = [[0, 0]];
    const notches = [[pa[0], pa[1], C.passH]]; if (door) notches.push(door);
    for (const n of notches.sort((p, q) => p[0] - q[0])) out.push([n[0], 0], [n[0], n[2]], [n[1], n[2]], [n[1], 0]);
    out.push([L, 0], [L, C.brick], [0, C.brick]);
    wall(B, CB, out, holes, { frame: GREY, depth: 0.1, bar: 0.06, sill: GREY });
    for (const fn of after) fn();
    if (door) { B.reveal(CB, rectPts(door[0], 0, door[1], door[2]), 0, -0.5, true); B.unit('doorGrey', rectPts(door[0], 0.02, door[1], door[2]), -0.5); lug(B, 'wsConc', door[0] - 0.2, door[2], door[1] + 0.2, door[2] + 0.22, 0.06); }
    lug(B, 'wsConc', pa[0] - 0.15, C.passH, pa[1] + 0.15, C.passH + 0.25, 0.05);
    lug(B, 'wsConc', 0, C.brick - 0.02, L, C.brick + 0.07, 0.03);
    // the white storey, set back behind the parapet: one window to a bay
    B.push(T(0, 0, -C.set));
    const ww = []; for (let i = 0; i < C.bays; i++) { const c = (i + 0.5) * bw; if (i % 2 === 0) ww.push([c - 0.7, 9.55, c + 0.7, 10.75, { floor: 3 }]); else ww.push([c - 0.3, 9.55, c + 0.3, 10.75, { cols: 1, floor: 3 }]); }
    wall(B, 'white', rectPts(C.set, C.brick, L - C.set, C.white), ww, { frame: GREY, depth: 0.08, bar: 0.06 });
    B.pop();
    // the box dormers in the mansard, one over every other bay
    for (let i = 0; i < C.bays; i += 2) {
      const c = (i + 0.5) * bw;
      B.boxXZ('wsZinc', c - 1.0, c + 1.0, C.fascia + 0.04, C.top - 0.08, -1.0, -0.15);
      B.push(T(0, 0, -0.15 + 0.012)); win(B, c - 0.82, C.fascia + 0.22, c + 0.82, C.top - 0.26, { wall: null, frame: GREY, cols: 2, depth: 0, bar: 0.08, floor: 4 }); B.pop();
    }
    // the standing seams of the mansard
    for (let a = 0.6; a < L - 0.3; a += 0.75) { if (Math.abs(((a / bw) % 2) - 0.5) * bw < 1.05) continue; B.beam('wsZincD', [a, C.fascia + 0.02, -0.14], [a, C.top - 0.01, -0.93], 0.035, 0.03); }
    B.pop();
  }
  // ------------------------------------------------------------ the ends (GUESS: a stair window to a floor; the south end's top storey is glazed round the corner, K)
  for (const [k, F] of [['n', mk([C.x1, C.z0], [C.x0, C.z0])], ['s', mk([C.x0, C.z1], [C.x1, C.z1])]]) {
    B.push(F.mat());
    const wins = []; for (let f = 0; f <= 2; f++) wins.push([W / 2 - 0.45, f * C.S + 0.95, W / 2 + 0.45, f * C.S + 2.45, { cols: 1, floor: f }]);
    wall(B, CB, rectPts(0, 0, W, C.brick), wins, { frame: GREY, depth: 0.1, bar: 0.06, sill: GREY });
    lug(B, 'wsConc', 0, C.brick - 0.02, W, C.brick + 0.07, 0.03);
    B.push(T(0, 0, -C.set));
    wall(B, 'white', rectPts(C.set, C.brick, W - C.set, C.white), k === 's' ? [[C.set + 0.25, 9.3, W - C.set - 0.25, 11.0, { cols: 6, floor: 3 }]] : [[W / 2 - 0.7, 9.55, W / 2 + 0.7, 10.75, { floor: 3 }]], { frame: GREY, depth: 0.08, bar: 0.06 });
    B.pop(); B.pop();
  }
  // ------------------------------------------------------------ the fascia, the mansard, the flat top
  const R = [[C.x0, C.z0], [C.x1, C.z0], [C.x1, C.z1], [C.x0, C.z1]];
  B.flat('wsConc', R, C.brick);
  prism(B, 'wsAgg', offsetRing(R, 0.04), C.white, C.fascia, { top: 'wsAgg' }); B.flat('wsConc', offsetRing(R, 0.04), C.white, [], true);
  band(B, 'wsZinc', offsetRing(R, -0.15), C.fascia, offsetRing(R, -0.95), C.top, { top: 'wsRoof' });
  for (const z of [C.z0 + 5, C.z0 + 13.5, C.z0 + 22]) B.boxXZ('alu', (C.x0 + C.x1) / 2 - 0.7, (C.x0 + C.x1) / 2 + 0.7, C.top, C.top + 0.28, z, z + 4.2);
  B.boxXZ('iron', C.x1 - 1.6, C.x1 - 1.56, C.top, C.top + 3.2, C.z1 - 1.8, C.z1 - 1.76);
  // ------------------------------------------------------------ the way through: its walls and soffit
  const [p0, p1] = C.pass;
  B.poly(CB, [[C.x0, 0, p0], [C.x1, 0, p0], [C.x1, C.passH, p0], [C.x0, C.passH, p0]], [0, 0, 1]);
  B.poly(CB, [[C.x1, 0, p1], [C.x0, 0, p1], [C.x0, C.passH, p1], [C.x1, C.passH, p1]], [0, 0, -1]);
  B.poly('wsConc', [[C.x0, C.passH, p0], [C.x1, C.passH, p0], [C.x1, C.passH, p1], [C.x0, C.passH, p1]], [0, -1, 0]);
  for (const P of CASSON_PARTS) col.addPolygon(P, { tag: 'building' });
}

// ---- Wolfson Building: the faceted crescent. Its inner (lawn) face from the map and the height survey, vertex by
// vertex, north to south-west; 6.0 m deep; two brick storeys, a lead mansard, two stair towers on the street side.
export const WOLF_IN = [[-255.4, 111.2], [-255.0, 116.1], [-254.7, 121.0], [-254.6, 125.9], [-256.0, 130.2], [-258.6, 133.8], [-262.0, 136.3], [-265.7, 137.9], [-269.4, 138.8]];
export const WOLF = { depth: 6.0, wallH: 5.6, cope: 5.75, top: 8.5, towerH: 8.7, doors: [2, 5] };      // (doors: where the map's two footways off the ring reach the building)
export const WOLF_OUT = WOLF_IN.map((p, i) => {
  const nrm = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [dz / l, -dx / l]; };
  const n0 = i ? nrm(WOLF_IN[i - 1], p) : nrm(p, WOLF_IN[1]), n1 = i < WOLF_IN.length - 1 ? nrm(p, WOLF_IN[i + 1]) : n0;
  let mx = n0[0] + n1[0], mz = n0[1] + n1[1]; const k = mx * n0[0] + mz * n0[1]; mx /= k; mz /= k;
  return [+(p[0] + mx * WOLF.depth).toFixed(2), +(p[1] + mz * WOLF.depth).toFixed(2)];
});
export const WOLF_RING = [...WOLF_IN, ...WOLF_OUT.slice().reverse()];
export const WOLF_TOWERS = [
  [[-248.9, 120.0], [-245.6, 119.6], [-244.5, 123.1], [-245.6, 126.5], [-248.9, 126.0]],                    // east, on Worcester Street
  [[-257.4, 137.2], [-254.5, 139.7], [-256.8, 142.8], [-260.4, 143.9], [-261.4, 140.3]],                    // south, towards Hythe Bridge Street
];
const WBK = 'wsBrickW';

export function buildWolfson(game, B) {
  const Wf = WOLF, col = game.worldCollider, n = WOLF_IN.length;
  // ------------------------------------------------------------ the inner side, facet by facet
  for (let k = 0; k < n - 1; k++) {
    const F = mk(WOLF_IN[k], WOLF_IN[k + 1]), L = F.L, isDoor = Wf.doors.includes(k), cb = (2.25 + L - 0.2) / 2, dw = Math.min(1.1, (L - 2.45) / 2 - 0.05), hw = Math.min(0.72, (L - 2.45) / 2 - 0.08);
    B.push(F.mat());
    const strip = rectPts(0.4, 0.25, 2.1, 5.45), holes = [[cb - hw, 3.45, cb + hw, 4.95, { floor: 1 }]];
    let out = rectPts(0, 0, L, Wf.wallH);
    if (isDoor) out = [[0, 0], [cb - dw, 0], [cb - dw, 2.25], [cb + dw, 2.25], [cb + dw, 0], [L, 0], [L, Wf.wallH], [0, Wf.wallH]];
    else holes.push([cb - hw, 0.95, cb + hw, 2.45, { floor: 0 }]);
    B.face(WBK, out, [strip, ...holes.map((w) => rectPts(w[0], w[1], w[2], w[3]))]);
    for (const w of holes) win(B, w[0], w[1], w[2], w[3], { wall: WBK, frame: GREY, cols: 2, depth: 0.09, bar: 0.06, sill: GREY, ...w[4] });
    // the recessed strip: exposed-aggregate panels with a window to each floor
    B.reveal(WBK, strip, 0, -0.12);
    const sw = [[0.52, 0.6, 1.98, 2.2, { floor: 0 }], [0.52, 3.35, 1.98, 4.95, { floor: 1 }]];
    B.push(T(0, 0, -0.12)); wall(B, 'wsAgg', strip, sw, { frame: GREY, cols: 2, depth: 0.05, bar: 0.06, sill: GREY }); B.pop();
    // the staircase doorway: a flat-headed recess under a concrete lintel, glazed timber doors, two globe lights
    if (isDoor) {
      const d = rectPts(cb - dw, 0, cb + dw, 2.25);
      B.reveal(WBK, d, 0, -0.9, true); B.push(T(0, 0, -0.9)); win(B, cb - dw, 0.03, cb + dw, 2.25, { wall: null, frame: 'oak', cols: 2, depth: 0, bar: 0.1, floor: 0 }); B.pop();
      B.poly('pavingSolid', [[cb - dw, 0.03, 0], [cb + dw, 0.03, 0], [cb + dw, 0.03, -0.9], [cb - dw, 0.03, -0.9]], [0, 1, 0]);
      lug(B, 'wsConc', cb - dw - 0.2, 2.25, cb + dw + 0.2, 2.5, 0.05);
      for (const s of [-1, 1]) B.cyl('white', cb + s * (dw + 0.45), 2.5, 0.17, 0.15, 0.24, 7, true, 0.15);
    }
    // the brick fin at the change of angle, the coping
    B.boxXZ(WBK, -0.17, 0.17, 0, Wf.cope + 0.12, 0.0, 0.42);
    if (k === n - 2) B.boxXZ(WBK, L - 0.17, L + 0.17, 0, Wf.cope + 0.12, 0.0, 0.42);
    B.boxXZ('wsConc', 0.17, L - 0.17, Wf.wallH, Wf.cope, -0.3, 0.035, { bottom: true });
    // a dormer in the mansard over the bay: splayed lead cheeks, the glass upright
    {
      const c = L / 2 + 0.3, yb = 6.25, yt = 7.9, sl = 0.9 / (Wf.top - Wf.cope), zs = (y) => -0.1 - (y - Wf.cope) * sl, zf = zs(yb) + 0.01, zt = zs(yt), by = bay(2);
      B.poly('wsWinGrey', [[c - 0.75, yb, zf], [c + 0.75, yb, zf], [c + 0.52, yt, zf], [c - 0.52, yt, zf]], [0, 0, 1]);
      B.poly('sash', [[c - 0.66, yb + 0.08, zf + 0.014], [c + 0.66, yb + 0.08, zf + 0.014], [c + 0.46, yt - 0.08, zf + 0.014], [c - 0.46, yt - 0.08, zf + 0.014]], [0, 0, 1], [[by[0] + 0.16, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.87], [by[0] + 0.16, by[1] + 0.87]]);
      for (const s of [-1, 1]) B.poly('wsLead', [[c + s * 0.75, yb, zf], [c + s * 0.52, yt, zf], [c + s * 0.52, yt, zt]], [s, 0.2, 0]);
      B.poly('wsLead', [[c - 0.52, yt, zf], [c + 0.52, yt, zf], [c + 0.52, yt, zt], [c - 0.52, yt, zt]], [0, 1, 0]);
      // the lead's rolls up the slope, either side of the dormer
      for (let a = 0.45; a < L - 0.2; a += 0.68) { if (Math.abs(a - c) < 0.95) continue; B.beam('wsLeadD', [a, Wf.cope + 0.05, zs(Wf.cope + 0.05) + 0.012], [a, Wf.top - 0.03, zs(Wf.top - 0.03) + 0.012], 0.045, 0.035); }
    }
    B.pop();
  }
  // ------------------------------------------------------------ the street side and the two ends: plain brick, narrow lights (GUESS)
  const edges = []; for (let k = n - 1; k > 0; k--) edges.push([WOLF_OUT[k], WOLF_OUT[k - 1]]);
  edges.push([WOLF_OUT[0], WOLF_IN[0]], [WOLF_IN[n - 1], WOLF_OUT[n - 1]]);
  for (const [a, b] of edges) {
    const F = mk(a, b), L = F.L, wins = [];
    for (let f = 0; f < 2; f++) for (const t of L > 5.2 ? [0.3, 0.7] : [0.5]) wins.push([L * t - 0.25, f * 2.75 + 0.95, L * t + 0.25, f * 2.75 + 2.45, { cols: 1, floor: f }]);
    B.push(F.mat()); wall(B, WBK, rectPts(0, 0, L, Wf.cope), wins, { frame: GREY, depth: 0.1, bar: 0.05 }); B.pop();
  }
  // ------------------------------------------------------------ the lead mansard round the whole crescent
  band(B, 'wsLead', offsetRing(WOLF_RING, -0.1), Wf.cope, offsetRing(WOLF_RING, -1.0), Wf.top, { top: 'wsLead' });
  // ------------------------------------------------------------ the stair towers: flat-topped brick with dark slits, a low lead roof
  for (const P of WOLF_TOWERS) {
    prism(B, WBK, P, 0, Wf.towerH);
    const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length;
    band(B, 'wsLead', offsetRing(P, 0.08), Wf.towerH, P.map(() => [cx, cz]), Wf.towerH + 0.6);
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], F = mk(a, b); if (F.L < 2.6 || i === P.length - 1) continue;
      B.push(F.mat()); B.poly('dark', [[F.L / 2 - 0.16, 1.2, -0.013], [F.L / 2 + 0.16, 1.2, -0.013], [F.L / 2 + 0.16, 7.4, -0.013], [F.L / 2 - 0.16, 7.4, -0.013]], [0, 0, -1]); B.pop();
    }
    col.addPolygon(P, { tag: 'building' });
  }
  col.addPolygon(WOLF_RING, { tag: 'building' });
}

// ---- the oval lawn inside Gate 1 (satellite picture: an oval about 7 x 12 m, long axis north-south), its stone kerb
// and ring of flags, the beds of hydrangeas against the two buildings
export const OVAL = { c: [-263.1, 119.4], rx: 3.6, rz: 6.0, path: 2.1 };
export function buildOval(game, B) {
  const O = OVAL, col = game.worldCollider;
  B.flat('greyStone', ring(O.c[0], O.c[1], O.rx + 0.16, O.rz + 0.16, 28), 0.062, [ring(O.c[0], O.c[1], O.rx, O.rz, 28)]);
  // the planted island in the lawn (the small tree is an ordinary map tree)
  for (const [dx, dz, r, key] of [[0.9, 0.6, 0.85, 'leafC'], [-0.6, 1.6, 0.7, 'leafA'], [0.3, -1.4, 0.6, 'leafB']]) shrub(B, key, O.c[0] + dx, O.c[1] + dz, r, 1.25, 8);
  // hydrangeas: against the Casson Building's east wall, and round the Wolfson Building's inner side
  const H = [];
  for (let z = 113.6; z < 128.5; z += 2.1) H.push([CASSON.x1 + 1.05 + ((z * 7) % 3) * 0.12, z, 0.82 + ((z * 3) % 4) * 0.05, z % 4 < 2 ? 'flR' : 'wsHyd']);
  for (let k = 0; k < WOLF_IN.length - 1; k++) {
    if (WOLF.doors.includes(k)) continue;
    const F = mk(WOLF_IN[k], WOLF_IN[k + 1]);
    for (const t of [0.3, 0.72]) { const p = F.pt(F.L * t, 1.15); H.push([p[0], p[1], 0.85 + (k % 3) * 0.06, 'wsHyd']); }
  }
  // (a dome of leaves with the flower heads standing on it)
  for (const [hi, [x, z, r, key]] of H.entries()) {
    shrub(B, hi % 2 ? 'leafC' : 'wsLeafH', x, z, r * 0.92, 1.0, 8);
    for (let i = 0; i < 7; i++) { const a = hi + i * 2.4, d = i ? r * (0.42 + 0.36 * ((i * 3) % 3) / 2) : 0, hy = r * (i ? 1.02 - 0.5 * (d / r) * (d / r) : 1.08); blob(B, key, x + Math.sin(a) * d, hy + i * 0.013 + (hi % 5) * 0.004, z + Math.cos(a) * d, 0.27 + 0.035 * (i % 3)); }      // (no two heads' flat tops at one height)
    col.addCircle(x, z, r * 0.8, { tag: 'planter', low: true });
  }
}
