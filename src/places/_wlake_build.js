// Worcester College, the lake (places/worcester_lake.js): what is drawn. Everything goes into the college's Batch
// (_worcester_kit.js) in the college's atlas; the one thing that is not is the upper pool's water (the world's own
// water material, at its own level). World coordinates unless a frame is pushed. Outlines and levels: _wlake_plan.js.
import * as THREE from 'three';
import { frame, tudorPts } from './_worcester_kit.js';
import { PK, LEAFS, hash as ph } from './_wgard_plants.js';
import * as P from './_wlake_plan.js';

const LV = P.LV;
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const hash = (a, b = 0) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };

/** this pass's colours: tinted copies of cells the college's atlas already has (nothing new is painted) */
export function cells(pack) {
  const G = pack.groundCells; if (G && G.get('gravel') && !G.get('wlGravel')) G.set('wlGravel', { ...G.get('gravel'), tint: [0.86, 0.98, 1.2], layer: 7.8 });      // (the walk's own gravel is a shade greyer than the plain cell)
  const K = pack.cells; if (!K || !K.get('boards') || K.get('wlTimber')) return;
  const boards = K.get('boards'), flags = K.get('pavingSolid'), plain = K.get('plaster'), ash = K.get('stone');
  K.set('wlTimber', { ...boards, tint: lin(0x9d9a8c) });      // weathered silver-grey oak
  K.set('wlTimberD', { ...boards, tint: lin(0x4d4a40) });     // its undersides, wet and dark
  K.set('wlDeck', { ...boards, tint: lin(0x86806f) });
  K.set('wlKerb', { ...flags, rx: 1 / 2.2, ry: 1 / 2.2, tint: [0.98, 0.96, 0.9] });
  K.set('wlSand', { ...flags, tint: [1.34, 1.16, 0.92] });    // sandstone slabs
  K.set('wlCope', { ...ash, tint: [1.3, 1.24, 1.06], seed: 0 });
  K.set('wlBench', { ...ash, rx: 1 / 2, ry: 1 / 2, tint: [0.78, 0.8, 0.72], seed: 0 });
  K.set('wlWet', { ...plain, tint: lin(0x23261f) });
  K.set('wlFoam', { ...plain, tint: lin(0xc9d6d4) });
  K.set('wlFall', { ...plain, tint: lin(0x6f8582) });         // the sheet of water down the weir's face
  // the old gateway (second pass: it read pale and new; K: both pictures have grey weathered ashlar and grey-brown rubble,
  // gold with lichen only where the low sun strikes it)
  K.set('wlOld', { ...ash, tint: [0.5, 0.485, 0.43] });       // weathered ashlar
  K.set('wlOldD', { ...ash, tint: [0.57, 0.555, 0.49], seed: 0 });
  K.set('wlOldR', { ...K.get('rubble'), tint: [0.72, 0.7, 0.63] });
  K.set('wlMoss', { ...ash, tint: [0.5, 0.54, 0.42], seed: 0 });
  K.set('wlBark', { ...boards, tint: lin(0x4a4034) });
  K.set('wlEdge', { ...K.get('rubble'), tint: [0.62, 0.62, 0.58], seed: 0 });
  K.set('wlPile', { ...plain, tint: lin(0x7f8a90) });
  K.set('wlStem', { ...plain, tint: lin(0xa53a24) });         // dogwood stems
  K.set('wlSedge', { ...plain, tint: lin(0x8f9150) });
  K.set('wlLily', { ...plain, tint: lin(0x5f8f3e) });
  K.set('wlHyd', { ...plain, tint: lin(0xe6d8dc) });
}

function tools(B) {
  const T = {
    /** a low wall / kerb / board between two ground points: width w, from y0 to y1 */
    lowWall(key, p, q, w, y0, y1, o) { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l < 1e-3) return; B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1])); B.boxXZ(key, 0, l, y0, y1, -w / 2, w / 2, o); B.pop(); },
    /** an upright face between two ground points, courses level, facing `toward` [x, z] */
    vface(key, p, q, y0, y1, toward) {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]), mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      B.poly(key, [[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]], [toward[0] - mx, 0, toward[1] - mz], [[0, y0], [l, y0], [l, y1], [0, y1]]);
    },
    /** a flat polygon of world points [x, z] at y (convex or not), up */
    flat(key, pts, y) { B.flat(key, pts, y); },
    /** a straight bar */
    bar(key, a, b, w, h = w) { if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 1e-3) B.beam(key, a, b, w, h); },
    disc(key, x, y, z, r, n = 6) { B.poly(key, Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2 + x; return [x + Math.cos(t) * r, y, z - Math.sin(t) * r]; }), [0, 1, 0]); },
  };
  return T;
}
const cen = (poly) => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];

// ================================================================================================= Mildred Allen Bridge
function bridge(B, T) {
  const R = P.BRIDGE, L = R.L, hw = R.hw, y = R.y;
  B.push(frame(R.S[0], 0, R.S[1], R.F.ux, R.F.uz));      // x = s (to the north end), z = t (east)
  const N = 14;
  for (let i = 0; i < N; i++) {
    const s0 = (L * i) / N, s1 = (L * (i + 1)) / N, y0 = y(s0), y1 = y(s1);
    // deck: grooved boards laid across; the soffit; the boarded fascia each side (planks along the span)
    B.poly('wlDeck', [[s0, y0, -hw], [s1, y1, -hw], [s1, y1, hw], [s0, y0, hw]], [0, 1, 0], [[s0, -hw], [s1, -hw], [s1, hw], [s0, hw]]);
    B.poly('wlTimberD', [[s0, y0 - R.fascia, -hw], [s1, y1 - R.fascia, -hw], [s1, y1 - R.fascia, hw], [s0, y0 - R.fascia, hw]], [0, -1, 0]);
    for (const e of [-1, 1]) B.poly('wlTimber', [[s0, y0 - R.fascia, e * (hw + 0.03)], [s1, y1 - R.fascia, e * (hw + 0.03)], [s1, y1 + 0.03, e * (hw + 0.03)], [s0, y0 + 0.03, e * (hw + 0.03)]], [0, 0, e], [[y0 - R.fascia, s0], [y1 - R.fascia, s1], [y1 + 0.03, s1], [y0 + 0.03, s0]]);
  }
  // parapets: ten posts a side, each on an outrigger with a raking strut; a broad top rail, a rail below it, a band of
  // X-lattice between two more
  const RAILS = [[R.post, 0.15, 0.05], [0.88, 0.05, 0.045], [0.74, 0.045, 0.04], [0.38, 0.045, 0.04]];
  for (const e of [-1, 1]) {
    const ps = [];
    for (let i = 0; i <= R.bays; i++) { const s = (L * i) / R.bays; ps.push([s, y(s), e * R.out(s)]); }
    ps.forEach(([s, yy, t], i) => {
      B.box('wlTimber', s, yy + (R.post - R.fascia) / 2 - 0.02, t, 0.09, R.post + R.fascia - 0.04, 0.09, 0, { bottom: true });
      T.bar('wlTimber', [s, yy - 0.12, t], [s, yy - 0.12, t + e * 0.52], 0.075, 0.1);
      T.bar('wlTimber', [s, yy - 0.08, t + e * 0.5], [s, yy + 0.95, t + e * 0.05], 0.11, 0.045);
      if (!i) return;
      const a = ps[i - 1];
      for (const [h, w, d] of RAILS) T.bar('wlTimber', [a[0], a[1] + h, a[2]], [s, yy + h, t], w, d);
      for (let k = 0; k < 2; k++) {
        const f0 = k / 2, f1 = (k + 1) / 2, p0 = [a[0] + (s - a[0]) * f0, a[1] + (yy - a[1]) * f0, a[2] + (t - a[2]) * f0], p1 = [a[0] + (s - a[0]) * f1, a[1] + (yy - a[1]) * f1, a[2] + (t - a[2]) * f1];
        T.bar('wlTimber', [p0[0], p0[1] + 0.39, p0[2]], [p1[0], p1[1] + 0.73, p1[2]], 0.02, 0.032);
        T.bar('wlTimber', [p0[0], p0[1] + 0.73, p0[2] + e * 0.012], [p1[0], p1[1] + 0.39, p1[2] + e * 0.012], 0.02, 0.032);
      }
    });
  }
  // rubble abutments under the two ends (TEMPORARY: with the approach ramps they stand in for the banks)
  for (const [s0, s1] of [[-0.55, 0.5], [L - 0.5, L + 0.55]]) B.boxXZ('rubbleDk', s0, s1, -0.3, y(0) - 0.02, -hw - 0.28, hw + 0.28, { top: true });
  B.pop();
  // the approach ramps: gravel up to the deck's ends, turf falling away each side
  const F = R.F, ramp = P.RAMP;
  for (const [sa, sb] of [[-ramp, 0], [L + ramp, L]]) {
    const yb = y(0), A = (t) => F.pt(sa, t), Bp = (t) => F.pt(sb, t);
    const q = (key, pts, uv) => B.poly(key, pts.map(([p, yy]) => [p[0], yy, p[1]]), [0, 1, 0], uv);
    q('gravel', [[A(-hw), 0.046], [Bp(-hw), yb], [Bp(hw), yb], [A(hw), 0.046]], [A(-hw), Bp(-hw), Bp(hw), A(hw)].map((p) => [p[0], p[1]]));
    for (const e of [-1, 1]) q('grass', [[A(e * hw), 0.046], [Bp(e * hw), yb], [Bp(e * (hw + 1.1)), 0.03]], [A(e * hw), Bp(e * hw), Bp(e * (hw + 1.1))].map((p) => [p[0], p[1]]));
  }
}

// ================================================================================================= the weir, the upper pool
function weir(B, T, PL) {
  const W = P.WEIR, U = P.UPPER, up = LV.upper, x0 = W.x - W.t / 2, x1 = W.x + W.t / 2, c = cen(U);
  // the wall across the arm, keyed into both banks; the water lies over its crest and falls down its west face
  B.boxXZ('wlWet', x0, x1, -0.3, up - 0.015, W.zN, W.zS, { top: true });
  for (const [za, zb] of [[W.zN - 0.5, W.zN], [W.zS, W.zS + 0.5]]) B.boxXZ('rubbleDk', x0 - 0.15, x1 + 0.15, -0.3, up + 0.12, za, zb, { top: true });
  B.poly('wlFall', [[x0 - 0.01, LV.water, W.zN], [x0 - 0.01, LV.water, W.zS], [x0 - 0.01, up - 0.005, W.zS], [x0 - 0.01, up - 0.005, W.zN]], [-1, 0, 0]);
  for (let k = 0, z = W.zN + 0.06; z < W.zS - 0.1; k++) {
    const w = 0.025 + hash(k, 3) * 0.06, g = 0.05 + hash(k, 7) * 0.2;
    B.poly('wlFoam', [[x0 - 0.02, LV.water, z], [x0 - 0.02, LV.water, Math.min(W.zS, z + w)], [x0 - 0.02, up - 0.005 - hash(k, 5) * 0.12, Math.min(W.zS, z + w)], [x0 - 0.02, up - 0.005 - hash(k, 5) * 0.12, z]], [-1, 0, 0]);
    z += w + g;
  }
  B.poly('wlFoam', [[x0 - 0.28, LV.water + 0.012, W.zN], [x0 - 0.28, LV.water + 0.012, W.zS], [x0, LV.water + 0.012, W.zS], [x0, LV.water + 0.012, W.zN]], [0, 1, 0]);
  // the banks: a planted berm round the pool (TEMPORARY: the bank proper once the terrain falls to the lake)
  const n = U.length, out = U.map((p, i) => {
    const a = U[Math.max(0, i - 1)], b = U[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; let nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
    if ((p[0] + nx - c[0]) ** 2 + (p[1] + nz - c[1]) ** 2 < (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2) { nx = -nx; nz = -nz; }
    return [p[0] + nx * 1.9, p[1] + nz * 1.9];
  });
  const rim = up + 0.07;
  for (let i = 0; i < n - 1; i++) {
    const a = U[i], b = U[i + 1], oa = out[i], ob = out[i + 1];
    B.poly('grass', [[a[0], rim, a[1]], [b[0], rim, b[1]], [ob[0], 0.03, ob[1]], [oa[0], 0.03, oa[1]]], [0, 1, 0], [a, b, ob, oa]);
    T.vface('soil', a, b, up - 0.12, rim, c);
  }
  // ... its two ends run down to the lower banks beside the weir
  for (const [i, dz] of [[0, -1], [n - 1, 1]]) {
    const a = U[i], oa = out[i], w = [x0 - 1.7, a[1] + dz * 0.35];
    B.poly('grass', [[a[0], rim, a[1]], [oa[0], 0.03, oa[1]], [w[0], 0.03, w[1] + dz * 1.6], [w[0], 0.03, w[1]]], [0, 1, 0], [a, oa, [w[0], w[1] + dz * 1.6], w]);
    B.poly('grass', [[a[0], rim, a[1]], [w[0], 0.03, w[1]], [x0, 0.05, a[1]]], [0, 1, 0], [a, w, [x0, a[1]]]);
  }
  // the end wall with its black estate railing (K: the 2016 picture)
  const [e0, e1] = P.UPPER_END, top = up + 0.4;
  T.lowWall('rubble', e0, e1, 0.42, -0.1, top, { top: false }); T.lowWall('stoneDress', e0, e1, 0.5, top, top + 0.07, { bottom: true });
  const rl = [[e0[0] - 2.1, e0[1] - 1.5], [e0[0] - 0.1, e0[1] - 0.25], [e1[0] - 0.1, e1[1] + 0.25], [e1[0] - 2.0, e1[1] + 1.3]];
  for (let i = 0; i < rl.length - 1; i++) {
    const a = rl[i], b = rl[i + 1], ya = i === 0 ? 0.25 : top + 0.07, yb = i === rl.length - 2 ? 0.25 : top + 0.07, l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(l / 1.15));
    for (const h of [0.2, 0.42, 0.64, 0.86, 1.05]) T.bar('iron', [a[0], ya + h, a[1]], [b[0], yb + h, b[1]], 0.012, h > 1 ? 0.035 : 0.028);
    for (let j = 0; j <= k; j++) { const f = j / k, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, yy = ya + (yb - ya) * f; B.box('iron', x, yy + 0.54, z, 0.035, 1.08, 0.012, -Math.atan2(b[1] - a[1], b[0] - a[0])); }
  }
  // reed, sedge and iris along both banks; tawny grasses and a big clipped evergreen on the north bank; the south bank
  // under the Hanging Garden overgrown with evergreens and ferns (K: the 2016 picture, both Geograph views from the bridge)
  let k = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i === 4) continue;      // (the end wall)
    const a = U[i], b = U[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0.15; d < l; d += 0.42, k++) {
      const f = d / l, h = ph(k, 1), x = a[0] + (b[0] - a[0]) * f + (c[0] - a[0]) * 0.05 * h, z = a[1] + (b[1] - a[1]) * f + (c[1] - a[1]) * (0.03 + 0.07 * h);
      PL.put(k % 5 === 0 ? 'iris' : k % 3 ? 'sedge' : 'reed', x, up - 0.03, z, k % 3 || k % 5 === 0 ? 0.8 + h * 0.5 : 0.62 + h * 0.3);
      if (k % 2) { const q = out[i], o = out[i + 1]; PL.put(k % 4 === 1 ? 'tawny' : 'fern', x + (q[0] + (o[0] - q[0]) * f - x) * 0.3, up - 0.1, z + (q[1] + (o[1] - q[1]) * f - z) * 0.3, 0.75 + h * 0.4); }
    }
  }
  for (const [x, z, sc] of [[-326.6, 27.5, 1.25], [-325.4, 27.9, 1.0], [-323.1, 28.5, 1.2], [-328.3, 27.9, 0.9]]) PL.put('tawny', x, 0.3, z, sc);
  PL.dome(-322.4, 0.1, 28.3, 1.15, 1.9, LEAFS.box, { n: 11, lump: 0.05 });      // the clipped dome at the pool's head (K: the 2016 picture)
  for (const [x, z, r, h, t] of [[-329.0, 35.9, 1.0, 2.0, 'laurel'], [-327.4, 36.2, 1.2, 2.5, 'holly'], [-325.9, 35.9, 0.95, 1.8, 'shrub'], [-324.4, 35.6, 1.1, 2.3, 'laurelL'], [-323.0, 35.2, 0.85, 1.7, 'shrubL'], [-327.5, 27.0, 0.8, 1.5, 'shrub']]) PL.dome(x, 0.1, z, r, h, LEAFS[t], { lump: 0.14 });
  for (const [x, z] of [[-328.3, 35.0], [-326.6, 35.0], [-325.1, 34.9], [-323.7, 34.7]]) PL.put('fern', x, 0.4, z, 1.1);
  for (const [x, z, h] of [[-329.0, 28.0, 0.95], [-328.5, 28.5, 0.8], [-329.2, 34.9, 0.9]]) PL.put('reed', x, up - 0.05, z, h);
  for (const [x, z, r] of [[-327.2, 30.4, 0.34], [-326.4, 31.0, 0.26], [-325.0, 32.6, 0.3], [-324.2, 31.9, 0.22], [-323.3, 31.2, 0.3], [-326.0, 33.2, 0.24]]) T.disc('wlLily', x, up + 0.012, z, r * 0.8, 9);
}
/** the upper pool's water: the world's water material on its own sheet (aEdge 1 at the banks -> 0 in the middle) */
export function upperWater(material) {
  const U = [[P.WEIR.x - P.WEIR.t / 2, P.WEIR.zN], ...P.UPPER.slice(1, -1), [P.WEIR.x - P.WEIR.t / 2, P.WEIR.zS]], c = cen(P.UPPER), n = U.length;
  const pos = [], edge = [], y = LV.upper;
  for (let i = 0; i < n; i++) {
    const a = U[i], b = U[(i + 1) % n], onWeir = i === n - 1;
    const up = (b[1] - c[1]) * (a[0] - c[0]) - (b[0] - c[0]) * (a[1] - c[1]) > 0, p = up ? b : a, q = up ? a : b;      // (wound to face up)
    pos.push(c[0], y, c[1], p[0], y, p[1], q[0], y, q[1]); edge.push(0, onWeir ? 0.4 : 1, onWeir ? 0.4 : 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.computeBoundingSphere(); g.computeBoundingBox();
  const m = new THREE.Mesh(g, material); m.name = 'worcester-lake:upper-pool'; m.receiveShadow = false; m.castShadow = false; m.matrixAutoUpdate = false; m.updateMatrix();
  return m;
}

// ================================================================================================= the stone kerb
function kerbs(B, T, lay, ring) {
  const G = P.GATEWAY, wallN = G.F.pt(G.len + 0.05, -0.1);
  lay.kerbs.forEach((run0, ri) => {
    const run = ri === 1 ? [wallN, ...run0] : run0, n = run.length; if (n < 2) return;
    const nor = run.map((p, i) => {
      const a = run[Math.max(0, i - 1)], b = run[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; let nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
      if (P.pip(p[0] + nx * 0.6, p[1] + nz * 0.6, ring)) { nx = -nx; nz = -nz; }
      return [nx, nz];
    });
    let u = 0;
    for (let i = 0; i < n - 1; i++) {
      const a = run[i], b = run[i + 1], na = nor[i], nb = nor[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = LV.kerb;
      const f = (p, q, d) => [p[0] + q[0] * d, p[1] + q[1] * d];
      const wide = ri === 1 && a[0] < -436 && a[0] > -470 ? 1.5 : 0.8;      // (behind the long kerb the gravel runs into the walk)
      const a0 = f(a, na, -0.04), b0 = f(b, nb, -0.04), a1 = f(a, na, 0.32), b1 = f(b, nb, 0.32), a2 = f(a, na, wide), b2 = f(b, nb, wide);
      B.poly('wlKerb', [[a0[0], k, a0[1]], [b0[0], k, b0[1]], [b1[0], k, b1[1]], [a1[0], k, a1[1]]], [0, 1, 0], [[u, 0], [u + l, 0], [u + l, 0.36], [u, 0.36]]);
      B.poly('wlKerb', [[a0[0], -0.18, a0[1]], [b0[0], -0.18, b0[1]], [b0[0], k, b0[1]], [a0[0], k, a0[1]]], [-na[0], 0, -na[1]], [[u, 0.4], [u + l, 0.4], [u + l, 0.72], [u, 0.72]]);
      B.poly('wlGravel', [[a1[0], k, a1[1]], [b1[0], k, b1[1]], [b2[0], 0.05, b2[1]], [a2[0], 0.05, a2[1]]], [0, 1, 0], [a1, b1, b2, a2]);
      u += l;
    }
  });
}

// ================================================================================================= the old gateway
function gateway(B, T, PL) {
  const G = P.GATEWAY, F = G.F, len = G.len, h = G.h, zf = G.th / 2, c = G.cx, arch = tudorPts(c, G.open, 0, G.spring, G.apex - G.spring, 8);
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const mirror = (pts) => pts.map((p) => [len - p[0], p[1]]).reverse();
  // ---- east face (the tour picture): rubble, an ashlar frame round a plain chamfered four-centred arch, a stepped
  // ashlar buttress north of it, dressed quoins at the south end
  B.push(frame(F.o[0], 0, F.o[1], F.ux, F.uz));      // x south -> north along the wall, z out of its east face
  B.face('wlOldR', rect(0, 0, len, h), [rect(c - 0.95, 0, c + 0.95, 2.5)], zf);
  B.face('wlOld', rect(c - 0.95, 0, c + 0.95, 2.5), [arch], zf + 0.03);
  B.reveal('wlOld', rect(c - 0.95, 0, c + 0.95, 2.5), zf + 0.03, zf, true);
  B.reveal('wlOldD', arch, zf + 0.03, -zf - 0.1, true);      // the passage through the wall, soffit and both jambs
  { const x0 = c + 0.8, x1 = c + 1.85, z1 = zf + 0.32;      // the buttress: a plinth course, a weathered top
    B.boxXZ('wlOld', x0, x1, 0, 1.95, zf, z1, { top: false }); B.boxXZ('wlOldD', x0 - 0.04, x1 + 0.04, 0, 0.5, zf, z1 + 0.05, { top: true });
    B.poly('wlOldD', [[x0, 1.95, z1], [x1, 1.95, z1], [x1, 2.45, zf], [x0, 2.45, zf]], [0, 1, 1]);
    for (const x of [x0, x1]) B.poly('wlOld', [[x, 1.95, zf], [x, 1.95, z1], [x, 2.45, zf]], [x === x0 ? -1 : 1, 0, 0]); }
  B.boxXZ('wlOld', 0, 0.42, 0, h, zf, zf + 0.035, { top: false });
  // the ends, the coping, ivy on it
  for (const [x, nx] of [[0, -1], [len, 1]]) B.poly('wlOldR', [[x, 0, -zf], [x, 0, zf], [x, h, zf], [x, h, -zf]], [nx, 0, 0]);
  B.boxXZ('wlMoss', -0.09, len + 0.09, h, h + 0.13, -zf - 0.2, zf + 0.1, { bottom: true });
  // ---- what grows on it and round it (second pass; K: the tour picture and the 2011 picture). Ivy over the coping and
  // down the faces; south of the opening on the east side a bed with a rough stone edge: an evergreen mass up to the
  // wall's top, tall spurge, ferns, hellebores; an arching shrub at the north jamb; a strip of turf with a stone edge
  // between the gravel and the water; the gravel wide in front of the opening
  const W2 = (x, z) => F.pt(x, z);      // wall frame -> world
  for (const [x0, x1, y0, y1, z, fl] of [[0.0, 1.9, 1.5, h + 0.45, zf + 0.05, 0], [3.9, len, 2.2, h + 0.4, zf + 0.05, 1], [1.5, 3.4, h - 0.5, h + 0.42, zf + 0.06, 0], [0.1, 1.6, 1.7, h + 0.4, -zf - 0.06, 1], [4.3, len + 0.1, 0.9, h + 0.42, -zf - 0.13, 0], [2.0, 4.2, h - 0.35, h + 0.4, -zf - 0.13, 1]]) PL.panel(PK.ivy, W2(x0, z), W2(x1, z), y0, y1, { flip: fl, tint: [0.9, 0.95, 0.85] });
  for (const [x, z, r, hh, t] of [[0.35, 1.5, 1.15, 2.7, 'holly'], [-0.9, 2.0, 1.3, 2.4, 'laurel'], [1.35, 1.25, 0.8, 1.7, 'shrub'], [-1.6, 3.3, 1.2, 2.0, 'laurelL'], [5.35, 1.0, 0.7, 2.0, 'shrubL'], [6.1, 0.2, 0.85, 1.6, 'shrub'], [0.4, -1.3, 1.0, 1.9, 'laurel'], [-0.8, -0.9, 0.9, 1.5, 'holly'], [5.2, -1.2, 0.7, 1.3, 'shrub']]) { const p = W2(x, z); PL.dome(p[0], 0, p[1], r, hh, LEAFS[t], { lump: 0.15 }); }
  for (const [name, x, z, sc] of [['euphorbia', 1.75, 2.0, 1.25], ['fern', 1.0, 2.6, 1.15], ['fern', 2.0, 1.25, 1.0], ['hosta', 0.2, 3.0, 1.1], ['fern', -0.5, 3.6, 1.2], ['hosta', 1.5, 3.1, 0.9], ['fern', 5.0, -1.9, 1.0], ['hosta', 0.9, -2.1, 1.0], ['fern', 5.6, 1.7, 0.9], ['climber', 4.3, 0.75, 1.0]]) { const p = W2(x, z); PL.put(name, p[0], 0.02, p[1], sc, name === 'climber' ? { tint: [1.05, 0.95, 0.6] } : {}); }
  // ---- the iron gate: one leaf hung on the north jamb, standing open to the east
  { const px = c + G.open / 2 - 0.03, pz = zf + 0.05, a = G.leafAng;
    B.push(new THREE.Matrix4().makeRotationY(a - Math.PI / 2).setPosition(px, 0, pz));      // x along the leaf from its hinge
    const W = G.leaf, t = 0.012;
    for (const x of [0, W - 0.035]) B.boxXZ('iron', x, x + 0.035, 0.08, 1.8, -t, t, { bottom: true });
    for (const [y0, y1] of [[0.1, 0.145], [0.92, 0.955], [1.74, 1.785]]) B.boxXZ('iron', 0.035, W - 0.035, y0, y1, -t, t, { bottom: true });
    for (let i = 1; i <= 9; i++) { const x = 0.035 + ((W - 0.07) * i) / 10; B.boxXZ('iron', x - 0.008, x + 0.008, 0.145, 1.74, -0.008, 0.008, { top: false }); }
    for (const y of [0.35, 1.5]) B.boxXZ('iron', -0.05, 0.02, y, y + 0.09, -0.03, 0.03, { bottom: true });      // the hinges
    B.pop(); }
  B.pop();
  // ---- west face (the 2011 picture): a broad ashlar centre standing a little proud on a plinth, the arch in a square
  // moulded label with dropped ends, rubble either side, dressed quoins at the north end
  B.push(frame(F.pt(len, 0)[0], 0, F.pt(len, 0)[1], -F.ux, -F.uz));      // x north -> south, z out of the west face
  const zw = zf + 0.1, m = mirror(arch);
  B.face('wlOldR', rect(0, 0, 1.2, h), [], zf); B.face('wlOldR', rect(4.4, 0, len, h), [], zf);
  B.face('wlOld', rect(1.2, 0, 4.4, h), [m], zw);
  for (const [x, nx] of [[1.2, -1], [4.4, 1]]) B.poly('wlOld', [[x, 0, zf], [x, 0, zw], [x, h, zw], [x, h, zf]], [nx, 0, 0]);
  for (const [x0, x1] of [[1.14, c - G.open / 2], [c + G.open / 2, 4.46]]) B.boxXZ('wlOldD', x0, x1, 0, 0.42, zw, zw + 0.05, { top: true });      // the plinth
  B.boxXZ('wlOld', 0, 0.36, 0, h, zf, zf + 0.035, { top: false });
  // the label and the inner moulding
  const bar = (x0, y0, x1, y1, d = 0.06, key = 'wlOldD') => B.boxXZ(key, x0, x1, y0, y1, zw, zw + d, { bottom: true });
  bar(c - 1.1, 2.47, c + 1.1, 2.6); bar(c - 1.1, 1.74, c - 0.99, 2.47); bar(c + 0.99, 1.74, c + 1.1, 2.47); bar(c - 1.24, 1.74, c - 1.1, 1.83); bar(c + 1.1, 1.74, c + 1.24, 1.83);
  bar(c - 0.84, 2.24, c + 0.84, 2.31, 0.03); bar(c - 0.84, 0.42, c - 0.78, 2.24, 0.03); bar(c + 0.78, 0.42, c + 0.84, 2.24, 0.03);
  B.pop();
  // ---- (world coordinates from here)
  { const a = W2(2.25, 0.62), b = W2(2.3, 4.2), d = W2(-2.6, 5.4), e = W2(-2.6, 4.9), f = W2(2.0, 3.9), g2 = W2(1.95, 0.62);      // the bed's rough stone edge
    for (const [p, q] of [[b, d]]) T.lowWall('wlEdge', p, q, 0.22, 0, 0.14, { top: true }); T.lowWall('wlEdge', a, b, 0.2, 0, 0.13, { top: true }); void e; void f; void g2; }
  // the gravel in front of the opening, and the turf strip with its stone edge along the water north of it
  { const y = 0.047, P = [W2(c - 0.75, zf), W2(c + 0.75, zf), W2(c + 2.6, 2.6), W2(c + 3.2, 7.5), W2(c - 0.9, 7.5), W2(c - 0.75, 3.5)];
    B.poly('wlGravel', P.map((p) => [p[0], y, p[1]]), [0, 1, 0], P);
    T.lowWall('wlEdge', W2(len + 0.2, 0.9), W2(len + 1.3, 7.4), 0.16, 0, 0.1, { top: true }); }
  // the tree that lies out over the water from the wall's north end (K: the tour picture: several grey stems, bare in
  // November; in leaf here like every tree in the game)
  { const o = W2(len + 1.1, 0.5), stems = [[5.6, 0.34, 0.14, 0.2], [6.3, 0.55, 0.3, 0.17], [4.6, 0.8, -0.1, 0.15], [5.2, 1.05, 0.45, 0.13], [3.6, 1.25, 0.0, 0.11]];
    const dirE = [F.pt(0, 1)[0] - F.pt(0, 0)[0], F.pt(0, 1)[1] - F.pt(0, 0)[1]], dirN = [F.ux, F.uz];
    stems.forEach(([L, el, az, w], i) => {
      const hx = Math.cos(el) * (dirE[0] * Math.cos(az + 0.5) + dirN[0] * Math.sin(az + 0.5)), hz = Math.cos(el) * (dirE[1] * Math.cos(az + 0.5) + dirN[1] * Math.sin(az + 0.5)), vy = Math.sin(el);
      const p0 = [o[0] + i * 0.12, 0.05, o[1] - i * 0.1], p1 = [p0[0] + hx * L, 0.05 + vy * L, p0[2] + hz * L];
      B.beam('wlBark', p0, p1, w, w);
      for (let j = 0; j < 3; j++) { const t = 0.45 + j * 0.2, q = [p0[0] + hx * L * t, p0[1] + vy * L * t, p0[2] + hz * L * t], bl = 1.4 + ph(i, j) * 1.2, up2 = 0.5 + ph(j, i) * 0.6, sd = j % 2 ? 1 : -1, e = [q[0] + (hx * 0.6 - hz * 0.5 * sd) * bl, q[1] + up2 * bl, q[2] + (hz * 0.6 + hx * 0.5 * sd) * bl];
        B.beam('wlBark', q, e, w * 0.42, w * 0.42); PL.card(PK.climber, e[0], e[1] - 0.9, e[2], 2.2, 1.7, { n: 2, tint: [0.95, 1.0, 0.62], dark: 0.85 }); }
      PL.card(PK.climber, p1[0], p1[1] - 0.8, p1[2], 2.4, 1.8, { n: 2, tint: [0.95, 1.0, 0.62], dark: 0.85 });
    }); }
}

// ================================================================================================= head of the lake: slab walk, Sainsbury weir
function sainsburyWeir(B, T, PL) {
  const S = P.SW, W = S.W, cope = LV.coping, bedY = cope - 0.04;
  const ringW = (r) => r.map((q) => W(q[0], q[1]));
  // ---- the two raised beds: rubble walls under pale stone copings, soil, dogwood and hydrangea
  for (const [name, ring, i0, i1] of [['north', P.BEDS.north, 1, P.BEDS.north.length - 1], ['south', P.BEDS.south, 0, P.BEDS.south.length - 2]]) {
    const R = ringW(ring), c = cen(R);
    B.flat('soil', R, bedY);
    for (let i = i0; i < i1; i++) {
      const a = R[i], b = R[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1e-3) continue;
      const away = [a[0] * 2 - c[0], a[1] * 2 - c[1]];
      // (inwards: towards the bed) coping 0.42 m wide, its face, the rubble below it
      const nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, sg = (c[0] - a[0]) * nx + (c[1] - a[1]) * nz > 0 ? 1 : -1, n = [nx * sg, nz * sg];
      const a1 = [a[0] + n[0] * 0.42, a[1] + n[1] * 0.42], b1 = [b[0] + n[0] * 0.42, b[1] + n[1] * 0.42], a0 = [a[0] - n[0] * 0.03, a[1] - n[1] * 0.03], b0 = [b[0] - n[0] * 0.03, b[1] - n[1] * 0.03];
      B.poly('wlCope', [[a0[0], cope, a0[1]], [b0[0], cope, b0[1]], [b1[0], cope, b1[1]], [a1[0], cope, a1[1]]], [0, 1, 0]);
      T.vface('wlCope', a0, b0, cope - 0.07, cope, away); T.vface('wlCope', a1, b1, bedY, cope, c);
      T.vface('rubble', a, b, -0.15, cope - 0.07, away);
    }
    // planting (K: dogwood and hydrangea, newly set in 2017)
    const inside = (q) => P.pip(q[0], q[1], ring);
    let k = name === 'north' ? 0 : 40;
    for (let s = S.head + 0.7; s < (name === 'north' ? S.bedN : S.bedS) - 0.4; s += 0.95, k++) for (const f of [0.26, 0.7]) {
      const v0 = name === 'north' ? 0 : S.vS, v1 = name === 'north' ? S.vN : S.wall, hsh = hash(k, f * 10), q = [s + (hsh - 0.5) * 0.5, v0 + 0.5 + (v1 - v0 - 1.0) * f];
      if (!inside([q[0] + 0.45, q[1]]) || !inside([q[0], q[1] + 0.35]) || !inside([q[0], q[1] - 0.35])) continue;
      const w = W(q[0], q[1]);
      if ((k + (f > 0.5 ? 1 : 0)) % 2) PL.put('dogwood', w[0], bedY - 0.02, w[1], 0.8 + hsh * 0.35);
      else PL.put('hydrangea', w[0], bedY - 0.02, w[1], 0.62 + hsh * 0.2);
      if (k % 3 === 0) PL.put(k % 2 ? 'fern' : 'hosta', w[0] + 0.35, bedY - 0.02, w[1] + 0.3, 0.8);
    }
  }
  // ---- the two cross-weirs; the head wall under the slab walk; steel sheet piling round the first pool
  for (const s of S.weirs) T.lowWall('wlCope', W(s + S.sillT / 2, S.vN - 0.03), W(s + S.sillT / 2, S.vS + 0.03), S.sillT, -0.15, LV.sill);
  T.vface('rubble', W(S.head, S.vN), W(S.head, S.vS), -0.15, LV.walk - 0.05, W(3, 4));
  for (const v of [S.vN, S.vS]) {
    const o = v === S.vN ? 1 : -1;
    for (let s = S.head, k = 0; s < S.weirs[0] - 0.01; s += 0.3, k++) {
      const d0 = k % 2 ? 0.07 : 0.02, d1 = k % 2 ? 0.02 : 0.07, s1 = Math.min(S.weirs[0], s + 0.3);
      T.vface('wlPile', W(s, v + o * d0), W(s1, v + o * d1), -0.15, cope - 0.2, W(s, v + o * 2));
    }
  }
  // ---- the slab walk at the head: sandstone flags, steel posts and two wires on the water side
  const wk = S.walk, dl = Math.hypot(wk.s[0] - wk.n[0], wk.s[1] - wk.n[1]), d = [(wk.s[0] - wk.n[0]) / dl, (wk.s[1] - wk.n[1]) / dl], nw = [-d[1], d[0]];      // nw: to the west (the water)
  const at = (a, t) => [wk.n[0] + d[0] * a + nw[0] * t, wk.n[1] + d[1] * a + nw[1] * t], hw = wk.w / 2;
  B.poly('wlSand', [at(-1.2, hw), at(dl + 0.3, hw), at(dl + 0.3, -hw), at(-1.2, -hw)].map((p) => [p[0], LV.walk, p[1]]), [0, 1, 0], [[0, 0], [dl + 1.5, 0], [dl + 1.5, wk.w], [0, wk.w]]);
  T.vface('wlSand', at(-1.2, hw), at(dl + 0.3, hw), -0.1, LV.walk, at(0, 5));
  T.vface('wlSand', at(-1.2, -hw), at(dl + 0.3, -hw), 0, LV.walk, at(0, -5));
  const posts = [0.5, 2.5, 4.5, dl - 0.35].map((a) => at(a, hw - 0.1));
  posts.forEach((p) => { B.cyl('alu', p[0], LV.walk, p[1], 0.027, 1.0, 7, false); T.disc('alu', p[0], LV.walk + 1.0, p[1], 0.027, 7); });
  for (const y of [0.52, 0.92]) T.bar('alu', [posts[0][0], LV.walk + y, posts[0][1]], [posts[3][0], LV.walk + y, posts[3][1]], 0.012);
  // ---- its two tall stone gate piers (rubble below, a tapering ashlar slab above) and the black iron gate, open
  const pier = (t, e) => {
    const p = at(-0.55, t);
    B.push(new THREE.Matrix4().makeRotationY(Math.atan2(d[0], d[1])).setPosition(p[0], 0, p[1]));      // z along the walk (south), x across it
    B.boxXZ('rubble', -0.4, 0.4, 0, 1.95, -0.24, 0.24, { top: false });
    const yo = 3.05, yi = 2.65;      // the slab's top rises towards the opening (K: both piers in the 2012 picture)
    const x0 = -0.4, x1 = 0.4, yL = e > 0 ? yi : yo, yR = e > 0 ? yo : yi;
    for (const z of [-0.2, 0.2]) B.poly('wlCope', [[x0, 1.95, z], [x1, 1.95, z], [x1, yR, z], [x0, yL, z]], [0, 0, z]);
    B.poly('wlCope', [[x0, 1.95, -0.2], [x0, 1.95, 0.2], [x0, yL, 0.2], [x0, yL, -0.2]], [-1, 0, 0]); B.poly('wlCope', [[x1, 1.95, -0.2], [x1, 1.95, 0.2], [x1, yR, 0.2], [x1, yR, -0.2]], [1, 0, 0]);
    B.poly('wlCope', [[x0, yL, -0.2], [x1, yR, -0.2], [x1, yR, 0.2], [x0, yL, 0.2]], [0, 1, 0]);
    B.pop();
    return p;
  };
  const pe = pier(-1.02, 1), pw = pier(1.02, -1);
  { const hinge = at(-0.3, -0.62), l = 1.2, e = at(-0.3 + l, -0.66);      // the leaf, swung back along the walk's east side
    B.push(frame(hinge[0], 0, hinge[1], e[0] - hinge[0], e[1] - hinge[1]));
    for (const x of [0, l - 0.035]) B.boxXZ('iron', x, x + 0.035, LV.walk + 0.05, 1.95, -0.012, 0.012, { bottom: true });
    for (const [y0, y1] of [[0.14, 0.18], [1.0, 1.035], [1.86, 1.9]]) B.boxXZ('iron', 0.035, l - 0.035, y0, y1, -0.012, 0.012, { bottom: true });
    for (let i = 1; i <= 9; i++) { const x = 0.035 + ((l - 0.07) * i) / 10; B.boxXZ('iron', x - 0.008, x + 0.008, 0.18, 1.86, -0.008, 0.008, { top: false }); }
    B.pop(); }
  // a length of the old wall going east from the east pier (GUESS: seen only beside the pier)
  T.lowWall('rubble', at(-0.55, -1.42), at(-0.55, -3.0), 0.45, 0, 2.3, { top: false }); T.lowWall('terracotta', at(-0.55, -1.38), at(-0.55, -3.04), 0.55, 2.3, 2.38, { bottom: true });
  // ---- the old rubble wall along the south side, a doorway with an ashlar frame near its west end, a landing and a rail
  const wz = S.wall + 0.25, H = S.wallH, [d0, d1] = S.door;
  for (const [s0, s1] of [[2.45, d0], [d1, S.wallEnd]]) { T.lowWall('rubble', W(s0, wz), W(s1, wz), 0.5, 0, H, { top: false }); }
  T.lowWall('rubble', W(d0, wz), W(d1, wz), 0.5, 2.05, H, { top: false, bottom: true });
  T.lowWall('stoneDress', W(2.4, wz), W(S.wallEnd + 0.05, wz), 0.62, H, H + 0.09, { bottom: true });
  for (const s of [d0, d1]) T.lowWall('stoneDress', W(s - 0.09, wz), W(s + 0.09, wz), 0.54, 0, 2.05, { top: false });
  T.lowWall('stoneDress', W(d0 - 0.09, wz), W(d1 + 0.09, wz), 0.54, 2.05, 2.23, { bottom: true });
  T.lowWall('wlCope', W(d0 - 0.2, S.wall - 0.5), W(d1 + 0.2, S.wall - 0.5), 1.0, -0.15, cope, { top: true });
  { const a = W(d0 - 0.15, S.wall - 0.95), b = W(d1 + 0.15, S.wall - 0.95);
    for (const p of [a, b]) B.box('iron', p[0], cope + 0.5, p[1], 0.035, 1.0, 0.035, 0);
    for (const y of [0.55, 1.0]) T.bar('iron', [a[0], cope + y, a[1]], [b[0], cope + y, b[1]], 0.03, 0.02); }
  return { piers: [pe, pw], posts, leaf: [at(-0.3, -0.62), at(0.9, -0.66)] };
}

// ================================================================================================= small things
function islandBridge(B, T) {
  const I = P.ISLAND_BRIDGE, y = LV.planks, l = Math.hypot(I.b[0] - I.a[0], I.b[1] - I.a[1]);
  B.push(frame(I.a[0], 0, I.a[1], I.b[0] - I.a[0], I.b[1] - I.a[1]));      // x along it, z to one side
  B.poly('wlDeck', [[-0.3, y, -I.w / 2], [l + 0.3, y, -I.w / 2], [l + 0.3, y, I.w / 2], [-0.3, y, I.w / 2]], [0, 1, 0], [[-0.3, 0], [l + 0.3, 0], [l + 0.3, I.w], [-0.3, I.w]]);
  for (const z of [-I.w / 2, I.w / 2]) B.boxXZ('wlTimberD', -0.3, l + 0.3, y - 0.16, y - 0.001, z - 0.04, z + 0.04, { top: false, bottom: true });
  for (const x of [0.15, l / 2, l - 0.15]) B.boxXZ('wlTimber', x - 0.04, x + 0.04, -0.2, y + 0.95, I.w / 2 - 0.04, I.w / 2 + 0.04, {});
  T.bar('wlTimber', [0.15, y + 0.93, I.w / 2], [l - 0.15, y + 0.93, I.w / 2], 0.09, 0.045); T.bar('wlTimber', [0.15, y + 0.5, I.w / 2], [l - 0.15, y + 0.5, I.w / 2], 0.05, 0.04);
  B.pop();
}
/** a carved stone garden seat about 1.5 m long with scrolled ends, on two shaped legs (K: the 2018 picture) */
function stoneBench(B, x, z, h) {
  B.push(new THREE.Matrix4().makeRotationY(h).setPosition(x, 0, z));      // z = the way the sitter faces
  const K = 'wlBench';
  B.boxXZ(K, -0.78, 0.78, 0.36, 0.46, -0.2, 0.26, { bottom: true });                         // the seat
  for (const s of [-0.5, 0.5]) { B.boxXZ(K, s - 0.13, s + 0.13, 0, 0.36, -0.16, 0.2, { top: false }); B.boxXZ(K, s - 0.17, s + 0.17, 0, 0.08, -0.2, 0.24, {}); }
  B.boxXZ(K, -0.7, 0.7, 0.46, 0.9, -0.22, -0.1, {});                                           // the back
  for (const s of [-0.78, 0.78]) {                                                                // the scrolled ends
    B.boxXZ(K, s - 0.08, s + 0.08, 0.46, 0.78, -0.22, 0.2, {});
    B.push(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(s + 0.08, 0.82, 0.1)); B.cyl(K, 0, 0, 0, 0.1, 0.16, 8, true); B.pop();
    B.push(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(s + 0.08, 0.95, -0.16)); B.cyl(K, 0, 0, 0, 0.09, 0.16, 8, true); B.pop();
  }
  B.pop();
}

/** everything of the lake into B. lay = _wlake_plan.lakeRing(), ring = the lake's outline as the map now has it.
 *  -> { built: {part: triangles}, weir: {…colliders' points} } */
export function buildLake(B, lay, ring, opts = {}) {
  const T = tools(B), built = {}, out = {}, PL = opts.PL;
  const part = (name, fn) => { const n0 = B.tris(), depth = B.stack.length; try { const r = fn(); if (r) out[name] = r; } catch (e) { console.error('[worcester_lake] ' + name, e); while (B.stack.length > depth) B.pop(); } built[name] = Math.round(B.tris() - n0); };
  part('Mildred Allen Bridge', () => bridge(B, T));
  part('weir and upper pool', () => weir(B, T, PL));
  part('stone kerb', () => kerbs(B, T, lay, ring));
  part('old gateway', () => gateway(B, T, PL));
  part('Sainsbury weir and slab walk', () => sainsburyWeir(B, T, PL));
  part('island bridge', () => islandBridge(B, T));
  part('stone benches', () => { for (const b of lay.benches) stoneBench(B, b[0], b[1], b[2]); });
  // dressed jambs at the way through the old Orchard wall (GUESS: its form)
  part('Orchard wall opening', () => { for (const j of opts.jambs || []) { B.box('stoneDress', j[0], 1.33, j[1], 0.5, 2.66, 0.5, 0.33, { top: true }); }  const h = opts.jambs && opts.jambs.head; if (h) B.box('stoneDress', h[0], 2.86, h[1], h[2] + 1.0, 0.4, 0.5, 0.33, { top: true, bottom: true }); });
  // the face under the Shah Centre's weir sill (hidden under today's water: see TEMPORARY)
  part('Shah Centre weir face', () => { const c = opts.channel; if (c) T.vface('greyStone', c[0], c[1], -0.85, 0.02, [(c[0][0] + c[1][0]) / 2 + 0.3, (c[0][1] + c[1][1]) / 2 + 3]); });
  return { built, out };
}
