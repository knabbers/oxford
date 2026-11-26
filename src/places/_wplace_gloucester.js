// Worcester Place: Gloucester House (c. 1978-79; map w69991353), its street wall on the north leg and the Earl
// Building's side gate at the wall's north end. Called by places/worcester_wplace.js (sources and K / G there).
//
// Three identical blocks in echelon, each 0.9 m further west than the one south of it, under shallow double-pitched
// roofs between raised party walls. West (court) face: two casements and a projecting timber corner window to each
// flat. East (street) side: a stair tower to each block under a catslide of the same roof, behind a 1.9 m wall.
import { rectPts } from './_worcester_kit.js';
import { win, T } from './_worcester_south_kit.js';
import { W, P3, FW, FE, FS, FN, LV, pier, bay } from './_wplace_kit.js';

export const GH = {
  uW: -18.0, step: 0.9, depth: 7.6,      // the south block's west wall, the echelon's step, a block's depth
  v: [1.6, 9.9, 17.7, 25.5],             // the blocks' ends along the street, south to north
  proj: { at: 4.1, w: 2.9, d: 2.9 },     // a stair tower: metres north of its block's south end, width, depth
  slab: 0.24,                            // thickness of the party walls and end gables above the roofs
  wall: { u0: -6.59, u1: -6.21, v0: 7.1, v1: 25.9 },      // the street wall (it carries on places/worcester.js's 4.6 m of it)
  door: { v0: 11.45, v1: 12.55, h: 1.78 }, cabinet: { v0: 7.9, v1: 9.4, d: 0.5, h: 1.15 },      // the boarded gate in it and the green cabinet on the pavement (street view 2024)
  gate: { v0: 26.5, v1: 27.6, pier: 0.6 },                // the Earl Building's side gate between two buff piers
  tree: [-8.0, 10.0, 11, 'broad'],                        // [u, v, height, kind]: the tree behind the wall
};
const K = 'wpGH', L = LV.gh, TN = (L.ridge - L.eaves) / (GH.depth / 2);
const blk = (k) => { const uW = GH.uW - GH.step * k, v0 = GH.v[k], v1 = GH.v[k + 1]; return { k, uW, uE: uW + GH.depth, mid: uW + GH.depth / 2, v0, v1, len: v1 - v0, p0: v0 + GH.proj.at, p1: v0 + GH.proj.at + GH.proj.w }; };
const roofY = (b, u) => L.ridge - Math.abs(u - b.mid) * TN;
/** the mapped outline as built, clockwise from the south-west corner (street frame [u, v]) */
export function ghRing() {
  const B = [0, 1, 2].map(blk), r = [];
  for (const b of B) { r.push([b.uW, b.v0], [b.uW, b.v1]); }
  for (const b of B.slice().reverse()) r.push([b.uE, b.v1], [b.uE, b.p1], [b.uE + GH.proj.d, b.p1], [b.uE + GH.proj.d, b.p0], [b.uE, b.p0], [b.uE, b.v0]);
  return r;
}

/** a wall slab across the building between v = vS and vN whose top follows prof = [[u, y]] (west to east): its south
 *  and north faces and a coping. Its lower part stands inside the blocks; what shows is what rises above the roofs. */
function slab(B, key, vS, vN, prof, cope, yW0 = 0) {
  const u0 = prof[0][0], u1 = prof[prof.length - 1][0];
  B.push(FS(u0, vS)); B.face(key, [[0, 0], [u1 - u0, 0], ...prof.slice().reverse().map(([u, y]) => [u - u0, y])]); B.pop();
  B.push(FN(u1, vN)); B.face(key, [[0, 0], [u1 - u0, 0], ...prof.map(([u, y]) => [u1 - u, y])]); B.pop();
  for (let i = 0; i < prof.length - 1; i++) { const a = prof[i], b = prof[i + 1]; B.poly(cope, [P3(a[0], a[1] + 0.004, vS - 0.03), P3(b[0], b[1] + 0.004, vS - 0.03), P3(b[0], b[1] + 0.004, vN + 0.03), P3(a[0], a[1] + 0.004, vN + 0.03)], [0, 1, 0]); }
  B.poly(key, [P3(u0, yW0, vS), P3(u0, yW0, vN), P3(u0, prof[0][1], vN), P3(u0, prof[0][1], vS)], [-1, 0, 0]);      // (yW0: from where the end shows; a block's own wall covers it below)
  B.poly(key, [P3(u1, L.eaves, vS), P3(u1, L.eaves, vN), P3(u1, prof[prof.length - 1][1], vN), P3(u1, prof[prof.length - 1][1], vS)], [1, 0, 0]);
}

export function buildGloucester(game, B) {
  const col = game.worldCollider, blocks = [0, 1, 2].map(blk), S = GH.slab, P = GH.proj, pe = L.parapet, ov = 0.3;
  const floors = [0, 1, 2].map((f) => [L.sill + f * L.storey, L.sill + f * L.storey + L.winH]);
  for (const b of blocks) {
    const { k, uW, uE, len } = b;
    // ---------------------------------------------------------------- west (court) face: casements, the corner window
    B.push(FW(uW, b.v1));
    { const wins = [];
      for (const [f, [y0, y1]] of floors.entries()) for (const [c, w] of k === 0 ? [[2.0, 1.25], [4.9, 1.25]] : [[1.5, 0.65], [4.0, 1.25]]) wins.push([c - w / 2, y0, c + w / 2, y1, { cols: w > 1 ? 2 : 1, floor: f }]);
      B.face(K, rectPts(0, 0, len, L.eaves), wins.map((w) => rectPts(w[0], w[1], w[2], w[3])));
      for (const w of wins) win(B, w[0], w[1], w[2], w[3], { wall: K, frame: 'wpBrown', depth: 0.08, bar: 0.07, ...w[4] });
      B.boxXZ('iron', 0.1, 0.19, 0.2, L.eaves - 0.2, 0.02, 0.11, { top: false });      // the downpipe in the angle of the step
    }
    B.pop();
    // the corner window of each flat: a dark timber box standing out of both faces at the block's south-west corner
    for (const [f, [y0, y1]] of floors.entries()) {
      const d = 0.18, a = 0.9, c = 0.62, by = bay(f), vc = b.v0 - (k ? S : 0);      // (the exposed south face: the party wall's, north of the first block)
      const uv = [[by[0] + 0.16, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.79], [by[0] + 0.27, by[1] + 0.87], [by[0] + 0.16, by[1] + 0.87]];
      B.boxXZ('wpBrown', uW - d, uW + c, y0 - 0.12, y1 + 0.1, -(vc + a), -(vc - d), { bottom: true });
      for (const [v0, v1] of [[vc - d + 0.07, vc + a - 0.07]]) B.poly('sash', [P3(uW - d - 0.012, y0, v1), P3(uW - d - 0.012, y0, v0), P3(uW - d - 0.012, y1 - 0.02, v0), P3(uW - d - 0.012, y1 - 0.02, v1)], [-1, 0, 0], uv);
      B.poly('sash', [P3(uW - d + 0.07, y0, vc - d - 0.012), P3(uW + c - 0.07, y0, vc - d - 0.012), P3(uW + c - 0.07, y1 - 0.02, vc - d - 0.012), P3(uW - d + 0.07, y1 - 0.02, vc - d - 0.012)], [0, 0, 1], uv);
    }
    // ---------------------------------------------------------------- east (street) side: a window and a slit, the tower, a window
    B.push(FE(uE, b.v0));
    { const wins = [], c3 = Math.min(len - 0.4, 7.45);
      for (const [f, [y0, y1]] of floors.entries()) for (const [c, w] of [[1.35, 0.9], [2.65, 0.32], [c3, 0.7]]) wins.push([c - w / 2, y0, c + w / 2, y1, { cols: w > 0.8 ? 2 : 1, floor: f, depth: f ? 0.08 : 0 }]);
      B.face(K, rectPts(0, 0, len, L.eaves), wins.map((w) => rectPts(w[0], w[1], w[2], w[3])));
      for (const w of wins) win(B, w[0], w[1], w[2], w[3], { wall: K, frame: 'wpBrown', bar: 0.07, ...w[4] });
    }
    B.pop();
    // the stair tower under the catslide: blank to the street, its door on the south side (GUESS: the door)
    { const d = P.d, yE = L.projEaves;
      B.push(FE(uE + d, b.p0)); B.face(K, rectPts(0, 0, P.w, yE)); B.pop();
      B.push(FS(uE, b.p0)); B.face(K, [[0, 0], [d, 0], [d, yE], [0, L.eaves]], [rectPts(1.0, 0.03, 1.9, 2.08)]); B.unit('doorDark', rectPts(1.0, 0.03, 1.9, 2.08), -0.06); B.reveal(K, rectPts(1.0, 0.03, 1.9, 2.08), 0, -0.06, true); B.pop();
      B.push(FN(uE + d, b.p1)); B.face(K, [[0, 0], [d, 0], [d, L.eaves], [0, yE]]); B.pop();
    }
    // ---------------------------------------------------------------- the roof: two shallow slopes, the catslide over the tower
    const r0 = b.v0 + (k === 0 ? S : 0), r1 = b.v1 - S, yW = L.eaves - ov * TN, uC = uE + P.d + 0.25, yC = L.eaves - (P.d + 0.25) * TN;
    B.poly('wpTile', [P3(uW - ov, yW, r0), P3(uW - ov, yW, r1), P3(b.mid, L.ridge, r1), P3(b.mid, L.ridge, r0)], [-1, 1, 0]);
    B.boxXZ('wpDark', uW - ov - 0.02, uW, yW - 0.16, yW - 0.004, -r1, -r0, { bottom: true, top: false });      // fascia, gutter and soffit
    for (const [a, c, far] of [[r0, b.p0 - 0.1, false], [b.p0 - 0.1, b.p1 + 0.1, true], [b.p1 + 0.1, r1, false]]) {
      const ue = far ? uC : uE + ov, ye = far ? yC : yW;
      B.poly('wpTile', [P3(ue, ye, c), P3(ue, ye, a), P3(b.mid, L.ridge, a), P3(b.mid, L.ridge, c)], [1, 1, 0]);
      B.poly('wpDark', [P3(ue, ye - 0.14, a), P3(ue, ye - 0.14, c), P3(ue, ye, c), P3(ue, ye, a)], [1, 0, 0]);
      B.poly('wpDark', [P3(uE, ye - 0.14, a), P3(uE, ye - 0.14, c), P3(ue, ye - 0.14, c), P3(ue, ye - 0.14, a)], [0, -1, 0]);
    }
    for (const [v, s] of [[b.p0 - 0.1, 1], [b.p1 + 0.1, -1]]) B.poly('wpDark', [P3(uE + ov, yW - 0.14, v), P3(uC, yC - 0.14, v), P3(uC, yC, v), P3(uE + ov, yW, v)], [0, 0, s]);      // the catslide's verges
    B.boxXZ('wpCope', b.mid - 0.11, b.mid + 0.11, L.ridge - 0.03, L.ridge + 0.05, -r1, -r0);                                                                                      // ridge tiles
  }
  // ---------------------------------------------------------------- the party walls and the two end gables, standing above the roofs
  for (let k = 0; k < 2; k++) {
    const a = blocks[k], b = blocks[k + 1], uc = (a.mid + b.mid) / 2;
    slab(B, K, a.v1 - S, a.v1, [[b.uW, L.eaves + pe], [b.mid, L.ridge + pe], [uc, roofY(a, uc) + pe], [a.mid, L.ridge + pe], [a.uE, L.eaves + pe]], 'wpCopeD');
  }
  { const a = blocks[0], c = blocks[2], g = (b) => [[b.uW, L.eaves + pe], [b.mid, L.ridge + pe], [b.uE, L.eaves + pe]];
    slab(B, K, a.v0, a.v0 + S, g(a), 'wpCope', L.eaves);      // (the pale coping of the south end: the photograph from the drive)
    slab(B, K, c.v1 - S, c.v1, g(c), 'wpCope', L.eaves); }

  // ---------------------------------------------------------------- the street wall, the Earl Building's side gate
  { const w = GH.wall, g = GH.gate, um = (w.u0 + w.u1) / 2, h = L.wall, E = LV.earlGate;
    const d = GH.door, cb = GH.cabinet;
    B.boxXZ('wpGHw', w.u0, w.u1, 0, h - 0.1, -d.v0, -w.v0, { top: false }); B.boxXZ('wpGHw', w.u0, w.u1, 0, h - 0.1, -w.v1, -d.v1, { top: false });
    B.boxXZ('wpGHw', w.u0, w.u1, d.h, h - 0.1, -d.v1, -d.v0, { top: false, bottom: true });
    B.boxXZ('boards', um - 0.03, um + 0.03, 0.05, d.h, -d.v1, -d.v0);                                                                    // the grey boarded gate
    B.poly('white', [P3(w.u1 + 0.012, 1.6, d.v1 + 0.18), P3(w.u1 + 0.012, 1.6, d.v1 + 0.62), P3(w.u1 + 0.012, 1.7, d.v1 + 0.62), P3(w.u1 + 0.012, 1.7, d.v1 + 0.18)], [1, 0, 0]);      // the name plate (no lettering drawn)
    B.poly('wpDark', [P3(w.u1 + 0.012, 1.5, d.v0 - 0.42), P3(w.u1 + 0.012, 1.5, d.v0 - 0.2), P3(w.u1 + 0.012, 1.62, d.v0 - 0.2), P3(w.u1 + 0.012, 1.62, d.v0 - 0.42)], [1, 0, 0]);
    B.boxXZ('wpCab', w.u1 + 0.02, w.u1 + 0.02 + cb.d, 0, cb.h, -cb.v1, -cb.v0);                                                           // the utility cabinet
    col.addPolygon([W(w.u1, cb.v0), W(w.u1 + cb.d, cb.v0), W(w.u1 + cb.d, cb.v1), W(w.u1, cb.v1)], { tag: 'furniture', low: true });
    B.boxXZ('wpCopeD', w.u0 - 0.03, w.u1 + 0.03, h - 0.1, h, -w.v1, -w.v0 + 0.004, { bottom: true });
    for (const v of [g.v0 - g.pier / 2, g.v1 + g.pier / 2]) { B.push(T(um, 0, -v)); pier(B, 'buff', 0, 0, g.pier, E.pier); B.pop(); }
    B.boxXZ('boards', um - 0.03, um + 0.03, 0.06, E.gate, -g.v1, -g.v0, { bottom: true });
    for (const v of [g.v0 + 0.5, g.v1 - 0.05]) B.boxXZ('grey', um - 0.045, um + 0.045, 0.06, E.gate + 0.04, -v - 0.03, -v + 0.03);      // the leaf's frame and the meeting post
    const seg = (v0, v1, tag) => { const p = W(um, v0), q = W(um, v1); col.addSegment(p[0], p[1], q[0], q[1], { tag }); };
    seg(w.v0, g.v0, 'wall'); seg(g.v0, g.v1, 'gate'); seg(g.v1, g.v1 + g.pier, 'wall');
  }
  col.addPolygon(ghRing().map(([u, v]) => W(u, v)), { tag: 'building' });
}
