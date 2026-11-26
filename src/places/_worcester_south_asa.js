// Worcester College, south: the Asa Briggs Building, the kitchen yard north of it and Gate 1 (Wolfson Gate) on
// Worcester Street. Called by places/worcester_south.js; see that file for sources and what is known or guessed.
import { frame, rectPts } from './_worcester_kit.js';
import { mk, T, win, frustum, dormer, stack, shrub, prism, blades } from './_worcester_south_kit.js';

// ---- Asa Briggs Building: the 2022 height survey's rectangle (the map's outline lies 2 m west of it). Axis from
// (-240.75, 73.5) to (-249.9, 103.0); a runs north -> south along the lawn (west) front, b out over the lawn
export const ASA = { NW: [-245.81, 71.93], SW: [-254.96, 101.43], SE: [-244.84, 104.57], NE: [-235.69, 75.07], W: 10.6, eaves: 7.0, top: 11.2, crown: 1.3, ov: 0.35 };
export const ASA_F = mk(ASA.NW, ASA.SW);
// window bays on the lawn front: metres either side of the archway (4 - arch - 4), dormers between them (8 a side)
const BAYS = [4.2, 7.25, 10.3, 13.35], DORMERS = [2.1, 5.7, 8.8, 11.85];
const ARCH = { r: 1.15, ys: 2.3, ring: 0.28, deep: 2.2 }, BALC = { hw: 1.3, y0: 4.5, y1: 6.7, deep: 1.1 };
// stacks: [a along the axis, metres west of it, pots]  (the 2022 survey's peaks; the satellite picture's pots)
const STACKS = [[3.6, 0, 3], [7.3, 1.66, 5], [24.6, 0.8, 5], [27.6, 0, 3]];
const WALLK = 'wsHoney';

/** a sash in a flush ashlar surround, in a face frame; returns the hole to cut in the wall */
const surround = (c, y0, w, h) => [c - w / 2 - 0.2, y0 - 0.16, c + w / 2 + 0.2, y0 + h + 0.24];
function sash(B, c, y0, w, h, o = {}) {
  const s = surround(c, y0, w, h);
  B.face('stoneDress', rectPts(s[0], s[1], s[2], s[3]), [rectPts(c - w / 2, y0, c + w / 2, y0 + h)]);
  win(B, c - w / 2, y0, c + w / 2, y0 + h, { wall: 'stoneDress', frame: 'wsDark', cols: o.cols || 3, rows: o.rows || 4, depth: 0.13, bar: 0.07, floor: y0 > 3 ? 1 : 0 });
  B.box('stoneDress', c, y0 - 0.2, 0.03, w + 0.56, 0.09, 0.07, 0, { bottom: true });
}
const arcPts = (c, r, ys, n = 10) => { const p = []; for (let i = 0; i <= n; i++) { const a = Math.PI * (1 - i / n); p.push([c + Math.cos(a) * r, ys + Math.sin(a) * r]); } return p; };

export function buildAsaBriggs(game, B, seg) {
  const F = ASA_F, L = F.L, W = ASA.W, c = L / 2, H = ASA.eaves - 0.2, col = game.worldCollider, ov = ASA.ov, run = W / 2 + ov - ASA.crown;
  B.push(F.mat());
  // ------------------------------------------------------------ the lawn (west) front
  {
    const R = ARCH.r + ARCH.ring, wins = [];
    for (const s of [-1, 1]) for (const d of BAYS) { wins.push([c + s * d, 1.0, 1.2, 1.95]); wins.push([c + s * d, 4.45, 1.2, 1.95]); }
    const balc = rectPts(c - BALC.hw, BALC.y0, c + BALC.hw, BALC.y1);
    const outline = [[0, 0.45], [c - R, 0.45], ...arcPts(c, R, ARCH.ys), [c + R, 0.45], [L, 0.45], [L, H], [0, H]];
    B.face(WALLK, outline, [...wins.map((w) => rectPts(...surround(...w))), balc]);
    for (const w of wins) sash(B, ...w);
    // the plinth, either side of the archway
    for (const [x0, x1] of [[0, c - R], [c + R, L]]) { B.poly('stoneDress', [[x0, 0, 0.04], [x1, 0, 0.04], [x1, 0.45, 0.04], [x0, 0.45, 0.04]], [0, 0, 1]); B.poly('stoneDress', [[x0, 0.45, 0.04], [x1, 0.45, 0.04], [x1, 0.45, 0], [x0, 0.45, 0]], [0, 1, 0]); }
    // the archway: an ashlar ring, the porch behind it with the staircase door (GUESS: what is inside the arch)
    const inner = arcPts(c, ARCH.r, ARCH.ys);
    B.face('stoneDress', [[c - R, 0], ...arcPts(c, R, ARCH.ys), [c + R, 0], [c + ARCH.r, 0], ...inner.slice().reverse(), [c - ARCH.r, 0]]);
    const mouth = [[c - ARCH.r, 0], [c + ARCH.r, 0], ...inner.slice().reverse()];
    B.reveal('stoneLit', mouth, 0, -ARCH.deep, true);
    const door = rectPts(c - 0.6, 0.03, c + 0.6, 2.15);
    B.face('stoneLit', mouth, [door], -ARCH.deep); B.unit('doorOak', door, -ARCH.deep + 0.005);
    B.poly('pavingSolid', [[c - ARCH.r, 0.03, 0.04], [c + ARCH.r, 0.03, 0.04], [c + ARCH.r, 0.03, -ARCH.deep], [c - ARCH.r, 0.03, -ARCH.deep]], [0, 1, 0]);
    // the recessed balcony over it: a solid parapet with a carved stone on it (no arms painted), a French window behind
    B.reveal('stoneDress', balc, 0, -BALC.deep);
    const fw = rectPts(c - 0.95, BALC.y0 + 0.02, c + 0.95, BALC.y1 - 0.25);
    B.face(WALLK, balc, [fw], -BALC.deep); B.push(T(0, 0, -BALC.deep)); win(B, fw[0][0], fw[0][1], fw[2][0], fw[2][1], { wall: null, frame: 'white', cols: 3, rows: 3, depth: 0.02, bar: 0.06 }); B.pop();
    B.box('stoneDress', c, BALC.y0 - 0.5, 0.05, 0.62, 0.74, 0.1, 0, { bottom: true });
    B.box('stoneDress', c, BALC.y0 - 0.02, 0.03, 2 * BALC.hw + 0.3, 0.1, 0.1, 0, { bottom: true });
    // rainwater pipes with hopper heads
    for (const x of [1.0, c - 2.25, c + 2.25, L - 1.0]) { B.boxXZ('iron', x - 0.045, x + 0.045, 0.3, H - 0.25, 0.06, 0.15, { top: false }); B.boxXZ('iron', x - 0.14, x + 0.14, H - 0.25, H + 0.02, 0.04, 0.24); }
    for (const s of [-1, 1]) for (const d of DORMERS) dorm(B, c + s * d);
    // the clipped evergreens either side of the archway, the irises along the foot of the wall
    for (const s of [-1, 1]) { shrub(B, 'leafC', c + s * 2.25, 1.25, 1.2, 1.75, 10); const q = F.pt(c + s * 2.25, 1.25); col.addCircle(q[0], q[1], 1.05, { tag: 'planter' }); }
    for (let i = 0; i < 70; i++) { const x = 0.5 + (i * (L - 1)) / 69; if (Math.abs(x - c) < 3.4) continue; blades(B, i % 3 ? 'leafB' : 'leafA', x, 0.3 + ((i * 5) % 4) * 0.16, 0.55 + ((i * 3) % 5) * 0.05, 4, i); }
  }
  // ------------------------------------------------------------ the street (east) side: small windows under the eaves
  B.push(frame(L, 0, -W, -1, 0));
  {
    const wins = [], small = [];
    for (const s of [-1, 1]) for (const d of DORMERS) { if (s < 0 && d > 11) continue; small.push([c + s * d, 5.25, 0.8, 1.05]); if (d > 5 && d < 11) wins.push([c + s * d, 1.0, 1.1, 1.8]); }
    wins.push([1.9, 1.0, 1.1, 1.95], [1.9, 4.3, 1.1, 1.95]);      // the tall sashes at the south end (seen through the gate)
    B.face(WALLK, rectPts(0, 0.45, L, H), [...wins, ...small].map((w) => rectPts(...surround(...w))));
    for (const w of wins) sash(B, ...w);
    for (const w of small) sash(B, ...w, { cols: 2, rows: 2 });
    B.poly('stoneDress', [[0, 0, 0.04], [L, 0, 0.04], [L, 0.45, 0.04], [0, 0.45, 0.04]], [0, 0, 1]); B.poly('stoneDress', [[0, 0.45, 0.04], [L, 0.45, 0.04], [L, 0.45, 0], [0, 0.45, 0]], [0, 1, 0]);
    for (const s of [-1, 1]) for (const d of DORMERS) dorm(B, c + s * d);
  }
  B.pop();
  // ------------------------------------------------------------ the ends: two windows to a floor (GUESS)
  for (const M of [frame(0, 0, -W, 0, 1), frame(L, 0, 0, 0, -1)]) {
    B.push(M);
    const wins = []; for (const x of [W / 2 - 2.3, W / 2 + 2.3]) wins.push([x, 1.0, 1.2, 1.95], [x, 4.45, 1.2, 1.95]);
    B.face(WALLK, rectPts(0, 0.45, W, H), wins.map((w) => rectPts(...surround(...w))));
    for (const w of wins) sash(B, ...w);
    B.poly('stoneDress', [[0, 0, 0.04], [W, 0, 0.04], [W, 0.45, 0.04], [0, 0.45, 0.04]], [0, 0, 1]); B.poly('stoneDress', [[0, 0.45, 0.04], [W, 0.45, 0.04], [W, 0.45, 0], [0, 0.45, 0]], [0, 1, 0]);
    B.pop();
  }
  // ------------------------------------------------------------ eaves course, the hipped roof with its lead crown, stacks
  B.boxXZ('stoneDress', -0.16, L + 0.16, H, ASA.eaves, -W - 0.16, 0.16, { bottom: true, top: false });
  frustum(B, 'stoneSlate', [-ov, L + ov, -W - ov, ov], ASA.eaves, [run - ov, L + ov - run, -W / 2 - ASA.crown, -W / 2 + ASA.crown], ASA.top, 'lead', 'stoneDress');
  const tp = (ASA.top - ASA.eaves) / run;
  for (const [a, w, pots] of STACKS) {
    const z = -W / 2 + w, y0 = Math.min(ASA.top, ASA.eaves + Math.min(a + ov, L + ov - a, W / 2 + ov - Math.abs(w)) * tp) - 0.4;
    B.push(T(a, 0, z)); stack(B, 0, 0, pots > 3 ? 1.7 : 1.1, 0.85, y0, 13.1, pots, WALLK); B.pop();
  }
  B.pop();
  // colliders: the walls, with the porch left open
  const P = (a, b) => F.pt(a, b), ring = [P(0, 0), P(c - ARCH.r, 0), P(c - ARCH.r, -ARCH.deep), P(c + ARCH.r, -ARCH.deep), P(c + ARCH.r, 0), P(L, 0), P(L, -W), P(0, -W)];
  col.addPolygon(ring, { tag: 'building' });

  function dorm(Bb, x) { dormer(Bb, x, ov, ASA.eaves, (ASA.top - ASA.eaves) / (W / 2 + ov - ASA.crown), -0.5, 1.15, 0.98, 0.5, { roof: 'stoneSlate', cheek: 'stoneSlate', front: 'wsDark', glass: 'leaded' }); }
}

// ---- the kitchen yard between Pump Quad's south range and the Asa Briggs Building (not in the map). World axes;
// from the 2022 height survey and the satellite picture, moved 0.8 m west of the survey so that the street range
// clears the Worcester Street wall as the game has it.
export const KITCHEN = {
  range: [-233.2, -228.4, 51.5, 70.0, 3.3, 4.9],         // the gabled range along the street: x0, x1, z0, z1, eaves, ridge
  block: [-239.4, -233.2, 62.5, 71.5, 3.3, 5.1],         // the kitchen block: its metal-topped roof runs east to the range's ridge
  link: [[-243.1, 56.0], [-239.4, 56.0], [-239.4, 71.5], [-236.3, 71.5], [-236.3, 74.86], [-243.1, 72.75]], linkH: 3.0,      // the flat-roofed link down the west side
};
export function buildKitchen(game, B) {
  const col = game.worldCollider, K = KITCHEN;
  { // the street range: rubble, stone slates, gables north and south; a boarded door and small windows to the yard (GUESS)
    const [x0, x1, z0, z1, e, r] = K.range, xc = (x0 + x1) / 2, o = 0.22, d = (o * (r - e)) / (xc - x0);
    prism(B, 'rubble', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0, e);
    for (const [z, n] of [[z0, -1], [z1, 1]]) B.poly('rubble', [[x0, e, z], [x1, e, z], [xc, r, z]], [0, 0, n]);
    B.poly('stoneSlate', [[x0 - o, e - d, z0 - o], [x0 - o, e - d, z1 + o], [xc, r, z1 + o], [xc, r, z0 - o]], [-1, 1, 0]);
    B.poly('stoneSlate', [[x1 + o, e - d, z1 + o], [x1 + o, e - d, z0 - o], [xc, r, z0 - o], [xc, r, z1 + o]], [1, 1, 0]);
    B.push(frame(x1, 0, z1, 0, -1));      // the east wall, towards the street wall: x south -> north
    for (const a of [2.6, 6.4, 13.4]) { B.unit('sash', rectPts(a - 0.45, 1.15, a + 0.45, 2.45), 0.02); B.box('stoneDress', a, 1.09, 0.02, 1.1, 0.1, 0.1, 0, { bottom: true }); }
    B.unit('doorGrey', rectPts(9.4, 0.02, 10.4, 2.1), 0.02);
    B.pop();
    stack(B, xc, z0 + 0.5, 0.8, 0.7, r - 0.5, r + 1.5, 2);
    col.addPolygon([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], { tag: 'building' });
  }
  { // the kitchen: stone-slate skirts up to a standing-seam metal top
    const [x0, x1, z0, z1, e, t] = K.block, xe = (K.range[0] + K.range[1]) / 2;
    prism(B, 'rubble', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0, e, { skip: [1] });
    frustum(B, 'stoneSlate', [x0 - 0.2, xe, z0 - 0.2, z1 + 0.2], e, [x0 + 1.5, xe, z0 + 1.0, z1 - 3.1], t, 'wsMetal', null);
    for (let x = x0 + 1.9; x < xe - 0.2; x += 0.6) B.boxXZ('wsMetal', x - 0.025, x + 0.025, t, t + 0.05, z0 + 1.02, z1 - 3.12, { top: true });
    col.addPolygon([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], { tag: 'building' });
  }
  { // the link: a flat lead roof behind a low upstand, a door and two windows to the lawn (GUESS)
    const h = K.linkH;
    prism(B, 'wsHoney', K.link, 0, h + 0.18); B.flat('lead', K.link, h);
    B.push(frame(K.link[0][0], 0, K.link[0][1], 0, 1));      // the west wall: x north -> south
    for (const a of [3.2, 9.8]) win(B, a - 0.6, 1.0, a + 0.6, 2.3, { wall: 'wsHoney', frame: 'wsDark', cols: 2, rows: 2, depth: 0.1, bar: 0.06, floor: 0, sill: 'stoneDress' });
    B.unit('doorGrey', rectPts(13.2, 0.02, 14.2, 2.1), 0.02);
    B.pop();
    col.addPolygon(K.link, { tag: 'building' });
  }
}

// ---- Gate 1, the Wolfson Gate (street picture 2026): the Worcester Street wall ends in a flat-capped ashlar pier;
// south of it tall solid dark double gates stand shut, set back behind a paved crossover between rubble returns.
// a runs south -> north along the wall's line, b out to the street
export const GATE1 = { S: [-240.55, 112.5], N: [-239.35, 106.8], open: 3.3, pier: 2.5, pierH: 3.3, back: 2.0, leafH: 2.85, postH: 3.0, lowH: 2.2 };
export const GATE1_F = mk(GATE1.S, GATE1.N);
export function buildGate1(game, B) {
  const G = GATE1, F = GATE1_F, col = game.worldCollider, P = (a, b) => F.pt(a, b);
  const seg = (p, q, h) => col.addSegment(p[0], p[1], q[0], q[1], { tag: 'wall', h });
  B.push(F.mat());
  // the pier at the wall's end
  B.boxXZ('stone', G.open, G.open + G.pier, 0, G.pierH, -0.34, 0.34, { top: false });
  B.boxXZ('stoneDress', G.open - 0.05, G.open + G.pier + 0.05, G.pierH, G.pierH + 0.12, -0.39, 0.39, { bottom: true });
  // the returns back to the gate posts: the high wall's on the north, a lower creeper-hung wall on the south
  B.boxXZ('rubbleDk', G.open + 0.02, G.open + 0.47, 0, G.postH - 0.1, -G.back, -0.34);
  B.boxXZ('wsIvy', -0.45, -0.02, 0, G.lowH, -G.back, 0.21);
  for (const a of [-0.25, G.open + 0.25]) { B.boxXZ('rubbleDk', a - 0.33, a + 0.33, 0, G.postH, -G.back - 0.33, -G.back + 0.33, { top: false }); B.boxXZ('stoneDress', a - 0.39, a + 0.39, G.postH, G.postH + 0.12, -G.back - 0.39, -G.back + 0.39, { bottom: true }); }
  // the leaves: boarded, dark, shut (K: the street picture). Thin rails across the back are not seen from the street
  B.boxXZ('wsGate', 0.08, G.open - 0.08, 0.06, G.leafH, -G.back - 0.05, -G.back + 0.05);
  B.boxXZ('dark', G.open / 2 - 0.012, G.open / 2 + 0.012, 0.06, G.leafH, -G.back + 0.05, -G.back + 0.056);
  for (const a of [G.open / 2 - 0.22, G.open / 2 + 0.22]) B.boxXZ('iron', a - 0.05, a + 0.05, 1.02, 1.14, -G.back + 0.05, -G.back + 0.09, { bottom: true });
  B.pop();
  for (const [a0, a1, b0, b1] of [[G.open, G.open + G.pier, -0.34, 0.34], [G.open, G.open + 0.47, -G.back, -0.34], [-0.45, 0, -G.back, 0.21]]) col.addPolygon([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], { tag: 'wall' });
  seg(P(0, -G.back), P(G.open, -G.back), G.leafH);
}
