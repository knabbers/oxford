// Exeter College, STANDALONE model: PLANTING that reads as plants, shared by the parts (garden, rector, library; the
// Chapel's south beds through `chapelBeds`, for the lead to call). The standard is the east range's Virginia creeper
// (_exeter_east_build.js buildCreeper, accepted by the owner): many small overlapping leaf cards on a dark under-layer,
// darker and greyer greens than the pack's lawn-green leaf cells, thinning at the edges. Everything here is built from
// single-triangle leaf cards (one draw cost: the college's atlas, plain tinted cells added with K.addCell), seeded so a
// plant is the same every time.
//
//   shrub(ctx, u, y0, v, o)     a rounded, irregular mass of leaf cards over a dark core. o.kind:
//                                 'box'      clipped ball / dome, small even leaves (box, small-leaved hebe)
//                                 'yew'      the same, taller and tapering (a clipped yew / holly cone)
//                                 'laurel'   a loose lobed mound of big glossy leaves (laurel, viburnum, choisya)
//                                 'gold'     the same in yellow-green (golden privet / choisya 'Sundance')
//                                 'flower'   a low flowering mound: lighter leaves, a sparse scatter of coloured cards
//                                 'fern'     a low clump of arching fronds (shade under the trees)
//                                 'hosta'    a rosette of broad leaves (hosta, bergenia, fatsia when large)
//                                 'lavender' a grey-green dome with purple spikes
//                               o.r crown radius, o.h height, o.seed, o.lod (1 near .. 0.3 seen only from far: fewer,
//                               larger cards), o.blooms [cell keys]. Returns the triangles spent.
//   hedge(ctx, line, o)         a clipped run along a LOCAL polyline: o.w, o.h, o.y (number | (u, v) => y), o.kind.
//   climber(ctx, F, o)          a wall climber in wall frame F (kit convention: s along, y up, z out of the face):
//                               ragged mass of small leaves on a dark under-layer over s0..s1 below a ragged top, clear
//                               of o.holes [[s0, s1, y0, y1]], woody stems at the foot (the east range's creeper
//                               generalised: same grid, same distance-to-edge density, not edited there).
//   rose(ctx, F, o)             a fan-trained climbing rose in wall frame F: thin stems, sparse leaves, a few blooms.
//   chapelBeds(ctx, spec)       the beds between the Chapel's south buttresses (satellite 2026-11-23, 04 "chapel south
//                               face straight on" 2016): soil, one to three plants a bay, a climber or a fan-trained
//                               plant on the wall of each bay. See its comment for `spec`.
// Budget (the owner wants frame rate): a shrub 60 - 500 triangles by size and lod, a hedge about 100 - 150 a metre, a
// climber about 30 a square metre at lod 1.
// NEAR PLANTS (joins pass 2026-11-23): within a metre or two of a path the single-triangle cards read as spiky triangles
// (worst on laurel). A shrub or climber at lod 1 (the callers' "seen close": the Library's bed, the Chapel's beds, the
// Library's creeper ...) is therefore clad in LEAF-SHAPED cards instead: a pointed oval of two triangles (base, the two
// sides, the tip) folded a little along its midrib, at about half the old card's size, more of them, set at a range of
// depths over the dark core so the gaps between them show leaves behind, not black. Plants at lod < 1 (the Mound's
// bank, the beds seen across a lawn) keep the cheap cards. o.near (true / false) overrides the lod test for a caller
// that knows better. Figures in NEAR (G: by eye, against the budget).
import * as K from './_exeter_kit.js';

// ------------------------------------------------------------------------------------------------ colours
// Read off the photographs (09 simononly 2012, 08 exeter.ox.ac.uk c2017, 04 chapel 2016): the planting is darker and
// greyer than the pack's leafA - C (0x5c8c3e ...), with paler sunlit leaves; the insides of bushes nearly black-green. G
// figures (by eye).
export const TINTS = {
  plantCore: 0x24331e, climbBack: 0x2d4026, stem: 0x4b3d30, stemGrey: 0x5f564b,
  boxA: 0x34522a, boxB: 0x416232, boxC: 0x2d4825, boxD: 0x50713a,
  yewA: 0x213520, yewB: 0x2a4126, yewC: 0x31492b,
  laurA: 0x284624, laurB: 0x3a5f2e, laurC: 0x4f7536, laurD: 0x6b8d48,
  goldA: 0x6f7c3c, goldB: 0x84904a, goldC: 0x5c6b37,
  flowA: 0x4a6b37, flowB: 0x5b7d42, flowC: 0x415f33,
  fernA: 0x4b7533, fernB: 0x5f8a3d, fernC: 0x3b6130,
  hostA: 0x416a3d, hostB: 0x587f48, hostC: 0x365c3c,
  lavA: 0x6f7d66, lavB: 0x5f6e5a, lavC: 0x84917a, lavFl: 0x6c5a9a, lavFl2: 0x7d6bad,
  creeperA: 0x47653a, creeperB: 0x557540, creeperC: 0x3c5732, creeperD: 0x67864a,
  ivyA: 0x2c4626, ivyB: 0x395a2e, ivyC: 0x4a6b38,
  wistA: 0x58803a, wistB: 0x6d9446, wistC: 0x4a6e34, wistD: 0x80a352,
  roseLeafA: 0x3a5a2e, roseLeafB: 0x4b6d39,
  bloomPink: 0xdc8aa6, bloomRose: 0xc04f68, bloomWhite: 0xefe9de, bloomMauve: 0xb48ac2, bloomYellow: 0xe8cf63,
};
const SET = {
  box: ['boxA', 'boxB', 'boxC', 'boxD'], yew: ['yewA', 'yewB', 'yewC'], laurel: ['laurA', 'laurB', 'laurC', 'laurD'],
  gold: ['goldA', 'goldB', 'goldC'], flower: ['flowA', 'flowB', 'flowC'], fern: ['fernA', 'fernB', 'fernC'],
  hosta: ['hostA', 'hostB', 'hostC'], lavender: ['lavA', 'lavB', 'lavC'],
  creeper: ['creeperA', 'creeperB', 'creeperC', 'creeperD'], ivy: ['ivyA', 'ivyB', 'ivyC'], wisteria: ['wistA', 'wistB', 'wistC', 'wistD'],
};
/** triangles spent so far, by kind (shrub kinds, 'hedge', 'climber', 'rose'): for the budget (tools/exeter_walk.mjs --results) */
export const SPENT = {};
const spend = (k, n) => { SPENT[k] = (SPENT[k] || 0) + n; return n; };
/** add the plant tints to the pack once (plain cells copied from 'leafA') */
export function tints(pack) {
  if (pack._exeterPlants) return; pack._exeterPlants = true;
  for (const [k, hex] of Object.entries(TINTS)) K.addCell(pack, k, 'leafA', hex);
}
/** a seeded random source */
export function rng(seed) { let a = (Math.floor(seed * 7919) ^ 0x9e3779b9) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ------------------------------------------------------------------------------------------------ small vector helpers
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
/** near plants' leaves, per kind: width / length of the leaf, its fold (the sides drop back by fold x width), the share of
 *  the old card's size (half), how many leaves for each old card, how deep into the mass they reach (shell factor). G */
const NEAR = {
  size: 0.62, count: 1.65, depth: [0.8, 1.03], core: 0.88, climbSize: 0.85,     // (climbers keep their leaf count: their dark under-layer fills the gaps)
  ratio: { box: 0.55, yew: 0.3, laurel: 0.42, gold: 0.45, flower: 0.5, lavender: 0.22, creeper: 0.75, ivy: 0.7, wisteria: 0.42 },
  fold: 0.22,
  // (fix-up pass) SMALL near plants (crown radius under 0.6: the Chapel's beds' laurels and box) showed their dark core at
  // 1.5 m: the core is drawn smaller (smallCore) and the leaves are counted to cover the shell fill times over (each leaf's
  // area 1.75 L W), up to fillMax times the usual count. G (by eye at 1.5 m)
  small: 0.6, smallCore: 0.82, fill: 2.1, fillMax: 3.2,
};
const isNear = (o, lod) => (o.near ?? lod >= 0.999) === true;
/** a leaf: a pointed oval of two triangles (petiole end, two sides, tip) centred at c, facing n, half-length L along an
 *  axis turned by a random angle in its plane, half-width W, its two halves folded back along the midrib */
export function leaf(B, key, c, n, L, W, R, fold = NEAR.fold) {
  const t1 = norm(crossV(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t2 = crossV(n, t1), a = R() * Math.PI * 2;
  const ax = add3(add3([0, 0, 0], t1, Math.cos(a)), t2, Math.sin(a)), sd = crossV(n, ax), k = 0.8 + R() * 0.4, l = L * k, w = W * k;
  const base = add3(c, ax, -l * 0.75), tip = add3(c, ax, l), back = add3([0, 0, 0], n, -w * fold);
  const sL = add3(add3(add3(c, ax, l * 0.02), sd, w), back), sR = add3(add3(add3(c, ax, l * 0.02), sd, -w), back);
  B.poly(key, [base, sL, tip], n); B.poly(key, [base, tip, sR], n);
}
/** an irregular leaf card (one triangle) centred at c, facing n, radius s, stretched e along its long axis */
function card(B, key, c, n, s, R, e = 1) {
  const t1 = norm(crossV(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t2 = crossV(n, t1);
  const a = R() * Math.PI * 2, pts = [[a, 1.0], [a + 2.15 + R() * 0.3, 0.8 + R() * 0.3], [a + 4.0 + R() * 0.35, 0.8 + R() * 0.3]].map(([q, k]) => {
    const x = Math.cos(q) * s * k * e, y = Math.sin(q) * s * k;
    return [c[0] + t1[0] * x + t2[0] * y, c[1] + t1[1] * x + t2[1] * y, c[2] + t1[2] * x + t2[2] * y];
  });
  B.poly(key, pts, n);
}

// ------------------------------------------------------------------------------------------------ SHRUBS
// per kind: leaf radius [min, max] at lod 1, lobe noise, the leaves' tilt off the surface, leaf stretch, cover (leaf area /
// surface), the dark core's size, the vertical semi-axis as a share of the height, taper to the top (yew), blooms
const KIND = {
  box: { leaf: [0.055, 0.085], noise: 0.06, tilt: 0.35, e: 1.2, cover: 1.15, core: 0.9, ry: 0.56, taper: 0 },
  yew: { leaf: [0.06, 0.09], noise: 0.07, tilt: 0.35, e: 1.3, cover: 1.15, core: 0.9, ry: 0.55, taper: 0.55, set: 'yew' },
  laurel: { leaf: [0.08, 0.14], noise: 0.3, tilt: 0.8, e: 1.6, cover: 1.15, core: 0.84, ry: 0.62, taper: 0 },
  gold: { leaf: [0.065, 0.11], noise: 0.25, tilt: 0.6, e: 1.4, cover: 1.15, core: 0.85, ry: 0.62, taper: 0, set: 'gold' },
  flower: { leaf: [0.06, 0.1], noise: 0.2, tilt: 0.7, e: 1.3, cover: 1.05, core: 0.85, ry: 0.7, taper: 0, blooms: 0.14 },
  lavender: { leaf: [0.04, 0.065], noise: 0.08, tilt: 0.6, e: 2.2, cover: 0.9, core: 0.88, ry: 0.8, taper: 0 },
};
/** the shrub kinds (for a plan's mix) */
export const KINDS = [...Object.keys(KIND), 'fern', 'hosta'];

export function shrub(ctx, u, y0, v, o = {}) {
  const { B } = ctx; tints(ctx.pack);
  const n0 = B.tris(), kind = o.kind || 'laurel';
  // (the low kinds keep to their natural size whatever a bed's range asks for)
  if (kind === 'fern') { fern(B, u, y0, v, { ...o, r: Math.min(o.r ?? 0.45, 0.6), h: Math.min(o.h ?? 0.55, 0.8) }); return spend(kind, B.tris() - n0); }
  if (kind === 'hosta') { hosta(B, u, y0, v, { ...o, r: Math.min(o.r ?? 0.4, 0.65), h: Math.min(o.h ?? 0.45, 0.75) }); return spend(kind, B.tris() - n0); }
  if (kind === 'lavender') o = { ...o, r: Math.min(o.r ?? 0.4, 0.45), h: Math.min(o.h ?? 0.5, 0.6) };
  const P = KIND[kind] || KIND.laurel, R = rng(o.seed ?? (u * 31.7 + v * 17.3)), lod = Math.max(0.25, Math.min(1, o.lod ?? 1));
  const keys = SET[P.set || kind] || SET.laurel;
  const r = o.r ?? 0.6, h = o.h ?? r * 1.4;
  const rx = r * (0.88 + R() * 0.24), rz = r * (0.88 + R() * 0.24), ry = h * P.ry, cy = y0 + h - ry, rot = R() * Math.PI;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  // lobes: bulges in random (mostly upward / outward) directions
  const lobes = []; for (let i = 0; i < 3 + Math.floor(R() * 3); i++) { const a = R() * 6.283, y = R() * 0.8 - 0.1; lobes.push([Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y), P.noise * (0.5 + R() * 0.7)]); }
  const shape = (d) => { let k = 1 - P.noise * 0.35; for (const L of lobes) { const q = d[0] * L[0] + d[1] * L[1] + d[2] * L[2]; if (q > 0) k += L[3] * q * q * q; } return k; };
  // a point of the shell in direction d (unit), and its outward normal
  const dyG = Math.max(-1, -(cy - y0) / ry);      // the direction's y at which the shell meets the ground
  const shell = (d, f = 1) => {
    const k = shape(d) * f, tp = P.taper ? 1 - P.taper * Math.max(0, d[1]) * Math.max(0, d[1]) : 1;
    const x = d[0] * rx * k * tp, z = d[2] * rz * k * tp;
    return [u + x * cs - z * sn, Math.max(y0 + 0.01, cy + d[1] * ry * k), v + x * sn + z * cs];
  };
  const nrm = (d) => { const x = d[0] / rx, z = d[2] / rz; return norm([x * cs - z * sn, d[1] / ry + (P.taper ? P.taper * 0.4 * Math.max(0, d[1]) : 0), x * sn + z * cs]); };
  // the dark core: an irregular low ellipsoid (6 x 3) (a near plant's sits deeper, under its layered leaves)
  const small = isNear(o, lod) && r < NEAR.small;
  const coreF = P.core * (isNear(o, lod) ? NEAR.core : 1) * (small ? NEAR.smallCore : 1);
  {
    const seg = 6, rings = [dyG, dyG + (1 - dyG) * 0.4, dyG + (1 - dyG) * 0.78, 1];
    const ring = (dy, j) => Array.from({ length: seg }, (_, i) => { const a = ((i + (j % 2) * 0.5) / seg) * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - dy * dy)); return shell([Math.cos(a) * s, dy, Math.sin(a) * s], coreF); });
    const Rg = rings.map((dy, j) => (j === rings.length - 1 ? null : ring(dy, j))), top = shell([0, 1, 0], coreF);
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < seg; i++) {
      const a = Rg[j][i], b = Rg[j][(i + 1) % seg];
      const mid = [(a[0] + b[0]) / 2 - u, 0.2, (a[2] + b[2]) / 2 - v];
      if (j === rings.length - 2) B.poly('plantCore', [a, b, top], add3(mid, [0, 0.6, 0]));
      else { const c = Rg[j + 1][(i + 1) % seg], d = Rg[j + 1][i]; B.poly('plantCore', [a, b, c], mid); B.poly('plantCore', [a, c, d], mid); }
    }
  }
  // leaf count: cover the visible shell at the kind's leaf size, capped by size and lod (bigger leaves when capped)
  const a1 = (rx + rz) / 2, area = 4 * Math.PI * Math.pow((Math.pow(a1 * a1, 1.6) + 2 * Math.pow(a1 * ry, 1.6)) / 3, 1 / 1.6) * ((1 - dyG) / 2) * (P.taper ? 0.8 : 1);
  const s0 = (P.leaf[0] + P.leaf[1]) / 2, cap = Math.max(36, Math.round(Math.min(480, 130 + 260 * r * h) * lod * lod));
  const n = Math.min(cap, Math.ceil((P.cover * area) / (1.3 * s0 * s0 * P.e)));
  const grow = Math.sqrt((P.cover * area) / (1.3 * n * s0 * s0 * P.e));      // >= 1 when capped
  const bloomKeys = o.blooms || ['bloomPink', 'bloomWhite'], nb = P.blooms ? Math.round(n * P.blooms) : 0;
  const near = isNear(o, lod), ratio = NEAR.ratio[P.set || kind] ?? 0.45;
  let nl = near ? Math.round(n * NEAR.count) : n;
  if (small) { const Lm = s0 * Math.max(1, grow) * P.e * NEAR.size; nl = Math.max(nl, Math.min(Math.round(n * NEAR.fillMax), Math.ceil((NEAR.fill * area) / (1.75 * Lm * Lm * ratio)))); }
  for (let i = 0; i < nl; i++) {
    const dy = dyG + (1 - dyG) * Math.pow(R(), 0.85), a = R() * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - dy * dy)), d = [Math.cos(a) * s, dy, Math.sin(a) * s];
    const f = near ? NEAR.depth[0] + (NEAR.depth[1] - NEAR.depth[0]) * Math.sqrt(R()) : 1 + (R() - 0.6) * 0.14;
    const p = shell(d, f), nn = norm(add3(nrm(d), [(R() - 0.5) * P.tilt, (R() - 0.3) * P.tilt, (R() - 0.5) * P.tilt]));
    const sz = (P.leaf[0] + R() * (P.leaf[1] - P.leaf[0])) * Math.max(1, grow);
    if (near) { const L = sz * P.e * NEAR.size; leaf(B, keys[Math.floor(R() * keys.length)], p, nn, L, L * ratio, R); }
    else card(B, keys[Math.floor(R() * keys.length)], p, nn, sz, R, P.e);
  }
  for (let i = 0; i < nb; i++) {      // blooms: small pale cards on the upper half, standing a little proud
    const dy = 0.1 + 0.9 * R(), a = R() * Math.PI * 2, s = Math.sqrt(1 - dy * dy), d = [Math.cos(a) * s, dy, Math.sin(a) * s];
    card(B, bloomKeys[Math.floor(R() * bloomKeys.length)], shell(d, 1.06), nrm(d), P.leaf[0] * 0.75 * Math.max(1, grow * 0.8), R);
  }
  if (kind === 'lavender') {      // flower spikes: a thin stalk and a purple head, facing all ways
    const ns = Math.round(Math.min(70, 30 + 60 * r) * lod);
    for (let i = 0; i < ns; i++) {
      const dy = 0.25 + 0.75 * R(), a = R() * Math.PI * 2, s = Math.sqrt(1 - dy * dy), d = [Math.cos(a) * s, dy, Math.sin(a) * s], p = shell(d, 0.95);
      const L = 0.18 + R() * 0.16, lean = [d[0] * 0.35, 1, d[2] * 0.35], top = add3(p, norm(lean), L), f = R() * Math.PI * 2, w = [Math.cos(f) * 0.012, 0, Math.sin(f) * 0.012];
      const fn = [Math.sin(f), 0.2, -Math.cos(f)];
      B.poly('lavC', [add3(p, w, -1), add3(p, w), top], fn);
      const hb = add3(p, norm(lean), L * 0.55);
      B.poly(R() < 0.5 ? 'lavFl' : 'lavFl2', [add3(hb, w, -2.2), add3(hb, w, 2.2), add3(top, [0, 0.03, 0])], fn);
    }
  }
  return spend(kind, B.tris() - n0);
}
/** a fern clump: arching fronds from the crown, each a tapering strip of 4 segments with a zig-zag edge */
function fern(B, u, y0, v, o) {
  const R = rng(o.seed ?? (u * 13.1 + v * 7.7)), r = o.r ?? 0.45, h = o.h ?? 0.55, lod = Math.max(0.3, Math.min(1, o.lod ?? 1));
  const nf = Math.max(6, Math.round((8 + 10 * r) * lod)), keys = SET.fern;
  for (let i = 0; i < nf; i++) {
    const a = (i / nf) * Math.PI * 2 + R() * 0.5, L = r * (0.75 + R() * 0.35), up = h * (0.75 + R() * 0.4), dir = [Math.cos(a), 0, Math.sin(a)], side = [-dir[2], 0, dir[0]];
    const seg = 4, pts = [];
    for (let k = 0; k <= seg; k++) { const t = k / seg; pts.push([u + dir[0] * L * t, y0 + 0.03 + up * (1.9 * t - 1.35 * t * t), v + dir[2] * L * t, (1 - t * 0.85) * L * 0.2]); }
    const key = keys[Math.floor(R() * keys.length)];
    for (let k = 0; k < seg; k++) {
      const p = pts[k], q = pts[k + 1], zz = (k % 2 ? 1 : -1) * 0.15;
      const A = [p[0] - side[0] * p[3], p[1], p[2] - side[2] * p[3]], Bq = [p[0] + side[0] * p[3], p[1], p[2] + side[2] * p[3]];
      const C = [q[0] + side[0] * q[3] * (1 + zz), q[1], q[2] + side[2] * q[3] * (1 + zz)], D = [q[0] - side[0] * q[3] * (1 - zz), q[1], q[2] - side[2] * q[3] * (1 - zz)];
      B.poly(key, [A, Bq, C], [0, 1, 0]); B.poly(key, [A, C, D], [0, 1, 0]);
    }
  }
}
/** a rosette of broad leaves, each folded along its midrib (two triangles a side) */
function hosta(B, u, y0, v, o) {
  const R = rng(o.seed ?? (u * 11.3 + v * 5.9)), r = o.r ?? 0.4, h = o.h ?? 0.45, lod = Math.max(0.3, Math.min(1, o.lod ?? 1));
  // (fix-up pass: more leaves, and an inner ring of short, steep leaves over the crown, so the soil between the rosette's
  // leaves no longer shows as a dark hole at 1.5 m)
  const nOut = Math.max(6, Math.round((12 + 24 * r) * lod)), nIn = Math.max(4, Math.round((6 + 8 * r) * lod)), nl = nOut + nIn, keys = SET.hosta;
  for (let i = 0; i < nl; i++) {
    const inner = i >= nOut, a = (inner ? (i - nOut) / nIn : i / nOut) * Math.PI * 2 + R() * 0.6, L = r * (inner ? 0.32 + R() * 0.2 : 0.6 + R() * 0.45), dir = [Math.cos(a), 0, Math.sin(a)], side = [-dir[2], 0, dir[0]];
    const base = [u + dir[0] * 0.04, y0 + 0.04, v + dir[2] * 0.04], tipH = h * (0.35 + R() * 0.6), mid = h * (0.55 + R() * 0.45);
    const tip = [u + dir[0] * L, y0 + tipH, v + dir[2] * L], m = [u + dir[0] * L * 0.45, y0 + mid + 0.04, v + dir[2] * L * 0.45], w = L * (0.28 + R() * 0.12);
    const lft = [m[0] - side[0] * w, m[1] - w * 0.35, m[2] - side[2] * w], rgt = [m[0] + side[0] * w, m[1] - w * 0.35, m[2] + side[2] * w];
    const key = keys[Math.floor(R() * keys.length)];
    B.poly(key, [base, m, lft], [0, 1, 0]); B.poly(key, [lft, m, tip], [0, 1, 0]); B.poly(key, [base, rgt, m], [0, 1, 0]); B.poly(key, [rgt, tip, m], [0, 1, 0]);
  }
}

// ------------------------------------------------------------------------------------------------ HEDGES
/** a clipped hedge along a LOCAL polyline: a dark core with slightly rounded top edges, its sides and top carpeted with
 *  small leaf cards. o: { w, h, y: number | (u, v) => y, kind 'box' | 'yew' | 'laurel', seed, lod }. Returns triangles. */
export function hedge(ctx, line, o = {}) {
  const { B } = ctx; tints(ctx.pack);
  const n0 = B.tris(), R = rng(o.seed ?? 3), w = o.w ?? 0.6, h = o.h ?? 0.9, lod = Math.max(0.25, Math.min(1, o.lod ?? 1));
  const P = KIND[o.kind || 'box'] || KIND.box, keys = SET[P.set || o.kind || 'box'] || SET.box;
  const yf = typeof o.y === 'function' ? o.y : () => o.y ?? 0;
  const dens = Math.min((P.cover * 0.95) / (1.3 * ((P.leaf[0] + P.leaf[1]) / 2) ** 2 * P.e), 70 * lod), grow = Math.sqrt(((P.cover * 0.95) / (1.3 * ((P.leaf[0] + P.leaf[1]) / 2) ** 2 * P.e)) / dens);
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
    const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nl = [-d[1], d[0]];
    const P3 = (s, x, y) => { const u = a[0] + d[0] * s + nl[0] * x, v = a[1] + d[1] * s + nl[1] * x; return [u, yf(a[0] + d[0] * s, a[1] + d[1] * s) + y, v]; };
    const hw = w / 2, sh = h - Math.min(0.15, w * 0.25), ti = hw * 0.72;
    // core: two sides, the shoulders, the top, the ends
    for (const sg of [-1, 1]) {
      B.poly('plantCore', [P3(0, sg * hw, -0.05), P3(L, sg * hw, -0.05), P3(L, sg * hw, sh), P3(0, sg * hw, sh)], [nl[0] * sg, 0, nl[1] * sg]);
      B.poly('plantCore', [P3(0, sg * hw, sh), P3(L, sg * hw, sh), P3(L, sg * ti, h), P3(0, sg * ti, h)], [nl[0] * sg, 1, nl[1] * sg]);
    }
    B.poly('plantCore', [P3(0, -ti, h), P3(L, -ti, h), P3(L, ti, h), P3(0, ti, h)], [0, 1, 0]);
    if (i === 0) B.poly('plantCore', [P3(0, -hw, -0.05), P3(0, hw, -0.05), P3(0, hw, sh), P3(0, ti, h), P3(0, -ti, h), P3(0, -hw, sh)], [-d[0], 0, -d[1]]);
    if (i === line.length - 2) B.poly('plantCore', [P3(L, -hw, -0.05), P3(L, hw, -0.05), P3(L, hw, sh), P3(L, ti, h), P3(L, -ti, h), P3(L, -hw, sh)], [d[0], 0, d[1]]);
    // leaves: on each side (an area L x h), the top (L x w), the ends
    const put = (n, at) => { for (let k = 0; k < n; k++) { const [p, nn] = at(); card(B, keys[Math.floor(R() * keys.length)], p, norm(add3(nn, [(R() - 0.5) * P.tilt, (R() - 0.4) * P.tilt, (R() - 0.5) * P.tilt])), (P.leaf[0] + R() * (P.leaf[1] - P.leaf[0])) * grow, R, P.e); } };
    for (const sg of [-1, 1]) put(Math.round(L * h * dens), () => { const s = R() * L, y = R() * h, x = sg * (y > sh ? hw - (hw - ti) * ((y - sh) / (h - sh)) : hw) + sg * (R() * 0.04); return [P3(s, x, y), [nl[0] * sg, y > sh ? 0.8 : 0.05, nl[1] * sg]]; });
    put(Math.round(L * w * 0.8 * dens), () => [P3(R() * L, (R() - 0.5) * 2 * ti, h + 0.02 * R()), [0, 1, 0]]);
    if (i === 0) put(Math.round(w * h * dens * 0.8), () => [P3(-0.02, (R() - 0.5) * w, R() * h), [-d[0], 0.1, -d[1]]]);
    if (i === line.length - 2) put(Math.round(w * h * dens * 0.8), () => [P3(L + 0.02, (R() - 0.5) * w, R() * h), [d[0], 0.1, d[1]]]);
  }
  return spend('hedge', B.tris() - n0);
}

// ------------------------------------------------------------------------------------------------ CLIMBERS
/**
 * A wall climber in wall frame F (s along the wall, y up, z out of the face; the kit's frame()). o:
 *   s0, s1       its extent along the wall           ground  y of the foot: number | (s) => y
 *   top [lo, hi] its ragged top (absolute y)          holes  [[s0, s1, y0, y1]] kept clear (windows, doors)
 *   set          'creeper' | 'ivy' | 'wisteria'       seed, lod (1 near; lower: fewer, larger leaves)
 *   cell (0.3), perCell [edge, inside] ([2, 3]), stray (0.35), fade (1.2 m of thinning at each end), leaf [min, max]
 *   radius ([0.09, 0.16]), proud [min, max] (how far the leaves stand off the face: [0.025, 0.13]), margin [sides,
 *   below, above] of the holes ([0.07, 0.12, 0.32]), overhang (0.06), gaps (0: the chance a cell inside is bare: patches),
 *   stems (woody stems rising from the foot: 0 = none), faceZ (the face's z in F: 0), back (the dark under-layer where a
 *   cell is this many cells inside the mass: 2)
 * Returns triangles. (The east range's buildCreeper, generalised: the same grid, ragged top and distance-to-edge density.)
 */
export function climber(ctx, F, o = {}) {
  const { B } = ctx; tints(ctx.pack);
  const n0 = B.tris(), R = rng(o.seed ?? 5), lod = Math.max(0.25, Math.min(1, o.lod ?? 1));
  const keys = SET[o.set || 'creeper'] || SET.creeper, z0 = o.faceZ ?? 0;
  const c = (o.cell ?? 0.3) / Math.sqrt(lod), leafR = (o.leaf || [0.09, 0.16]).map((x) => x / Math.sqrt(lod)), proud = o.proud || [0.025, 0.13];
  const per = o.perCell || [2, 3];
  const mg = o.margin || [0.07, 0.12, 0.32], over = o.overhang ?? 0.06, fade = o.fade ?? 1.2, stray = o.stray ?? 0.35, top = o.top || [2.0, 3.0];
  const g = typeof o.ground === 'function' ? o.ground : () => o.ground ?? 0;
  const H = (o.holes || []).map(([a, b, y0, y1]) => [a - mg[0], b + mg[0], y0 - mg[1], y1 + mg[2]]);
  const s0 = o.s0 ?? 0, s1 = o.s1 ?? 2, nI = Math.max(1, Math.ceil((s1 - s0) / c)), yMax = top[1], nJ = Math.ceil((yMax - Math.min(...Array.from({ length: nI }, (_, i) => g(s0 + (i + 0.5) * c)))) / c) + 1;
  const tops = []; let t = (top[0] + top[1]) / 2, dt = 0;
  for (let i = 0; i < nI; i++) { dt = dt * 0.7 + (R() - 0.5) * 0.5; t = Math.max(top[0], Math.min(top[1], t + dt)); tops.push(t); }
  const inHole = (x, y, e = 0) => H.some(([a, b, y0, y1]) => x > a - e && x < b + e && y > y0 - e && y < y1 + e);
  const cov = [];
  for (let i = 0; i < nI; i++) {
    const x = s0 + (i + 0.5) * c, gy = g(x) + 0.02, end = Math.min(x - s0, s1 - x), col = [];
    for (let j = 0; j < nJ; j++) {
      const y = gy + (j + 0.5) * c;
      let on = y < tops[i] && !inHole(x, y);
      if (on && end < fade) on = R() < 0.35 + 0.65 * (end / fade);
      if (on && o.gaps && j > 1 && R() < o.gaps) on = false;
      col.push(on);
    }
    cov.push(col);
  }
  const at = (i, j) => i >= 0 && i < nI && j >= 0 && j < nJ && cov[i][j];
  const dist = cov.map((col, i) => col.map((on, j) => { if (!on) return 0; for (let d = 1; d <= 3; d++) for (let a = -d; a <= d; a++) for (let b = -d; b <= d; b++) if ((Math.abs(a) === d || Math.abs(b) === d) && !at(i + a, j + b) && !(j + b < 0)) return d; return 4; }));
  B.push(F);
  // the dark under-layer where the mass is thick: a quad a cell, lapping its neighbours, its corners jittered and its edge
  // cells drawn in from the bare side (so its outline is never a row of clean steps against the stone)
  const thick = (i, j) => i >= 0 && i < nI && j >= 0 && j < nJ && dist[i][j] >= (o.back ?? 2);
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
    if (!thick(i, j)) continue;
    const xa = s0 + i * c, xb = xa + c, ya = g(xa + c / 2) + 0.02 + j * c, yb = ya + c, z = z0 + proud[0], J = () => (R() - 0.5) * 0.1;
    const l = thick(i - 1, j) ? -0.04 : 0.05 + R() * 0.08, r = thick(i + 1, j) ? 0.04 : -0.05 - R() * 0.08;
    const d = thick(i, j - 1) ? -0.04 : 0.04 + R() * 0.08, u = thick(i, j + 1) ? 0.04 : -0.06 - R() * 0.12;
    B.poly('climbBack', [[xa + l + J(), ya + d + J(), z], [xb + r + J(), ya + d + J(), z], [xb + r + J(), yb + u + J(), z], [xa + l + J(), yb + u + J(), z]], [0, 0, 1]);
  }
  const near = isNear(o, lod), ratio = NEAR.ratio[o.set || 'creeper'] ?? 0.6;
  const leafAt = (x, y) => {
    if (inHole(x, y, -over)) return;
    const r = leafR[0] + R() * (leafR[1] - leafR[0]), a = R() * Math.PI * 2, z = z0 + proud[0] + 0.01 + R() * (proud[1] - proud[0]);
    if (near) {      // a leaf-shaped card at half the size, turned a little off the wall (the leaves of a creeper face out and down)
      const nn = norm([(R() - 0.5) * 0.5, 0.15 + (R() - 0.5) * 0.4, 1]);
      leaf(B, keys[Math.floor(R() * keys.length)], [x, y, z], nn, r * NEAR.climbSize, r * NEAR.climbSize * ratio, R);
      return;
    }
    const tz = (R() - 0.5) * r * 0.9, ts = (R() - 0.5) * r * 0.9;
    const pts = [[a, 1.0], [a + 2.15 + R() * 0.3, 0.8 + R() * 0.3], [a + 4.0 + R() * 0.35, 0.8 + R() * 0.3]].map(([q, k], n) => [x + Math.cos(q) * r * k, y + Math.sin(q) * r * k, z + (n === 0 ? tz : n === 1 ? ts : 0)]);
    B.poly(keys[Math.floor(R() * keys.length)], pts, [0, 0.15, 1]);
  };
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
    const x0 = s0 + i * c, y0 = g(x0 + c / 2) + 0.02 + j * c, d = dist[i][j];
    let n = 0;
    if (d >= 2) n = per[1];
    else if (d === 1) n = R() < 0.8 ? per[0] : 0;
    else if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) n = R() < stray ? 1 : 0;
    for (let k = 0; k < n; k++) leafAt(x0 + R() * c, y0 + R() * c);
  }
  // woody stems from the foot, wandering up into the mass (seen where the mass is thin at the bottom)
  for (let k = 0; k < (o.stems || 0); k++) {
    let x = s0 + 0.3 + R() * (s1 - s0 - 0.6), y = g(x) + 0.01; const z = z0 + proud[0] * 0.6, hgt = (top[0] - y) * (0.35 + R() * 0.4), n = 4;
    for (let q = 0; q < n; q++) { const nx = x + (R() - 0.5) * 0.35, ny = y + hgt / n, w = 0.035 - q * 0.006; B.poly('stem', [[x - w, y, z], [x + w, y, z], [nx + w * 0.8, ny, z], [nx - w * 0.8, ny, z]], [0, 0, 1]); x = nx; y = ny; }
  }
  B.pop();
  return spend('climber', B.tris() - n0);
}

/**
 * A fan-trained climbing rose (or any fan-trained wall shrub) in wall frame F: from a root at s = o.s on the ground,
 * `stems` thin stems spread up to o.h above it and o.spread either side, with side shoots, sparse leaves and a few blooms.
 * o: { s, ground (y), h (2.2), spread (1.2), stems (7), leaves (per metre of stem, 9), blooms (14), bloom keys, seed,
 * lod, faceZ (0) }. Returns triangles.
 */
export function rose(ctx, F, o = {}) {
  const { B } = ctx; tints(ctx.pack);
  const n0 = B.tris(), R = rng(o.seed ?? 9), lod = Math.max(0.3, Math.min(1, o.lod ?? 1));
  const s = o.s ?? 0, y0 = o.ground ?? 0, h = o.h ?? 2.2, sp = o.spread ?? 1.2, ns = o.stems ?? 7, z = (o.faceZ ?? 0) + 0.05;
  const bk = o.bloom || ['bloomPink', 'bloomRose', 'bloomWhite'], perM = (o.leaves ?? 9) * lod;
  B.push(F);
  const strip = (a, b, w, key = 'stem') => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, px = (-dy / L) * w, py = (dx / L) * w; B.poly(key, [[a[0] - px, a[1] - py, z], [a[0] + px, a[1] + py, z], [b[0] + px * 0.7, b[1] + py * 0.7, z], [b[0] - px * 0.7, b[1] - py * 0.7, z]], [0, 0, 1]); };
  const leafCard = (x, y) => { const r = (0.05 + R() * 0.035) / Math.sqrt(lod), a = R() * 6.283, zz = z + 0.015 + R() * 0.05; B.poly(R() < 0.5 ? 'roseLeafA' : 'roseLeafB', [[x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, zz], [x + Math.cos(a + 2.3) * r, y + Math.sin(a + 2.3) * r, zz + 0.02], [x + Math.cos(a + 3.9) * r, y + Math.sin(a + 3.9) * r, zz]], [0, 0.1, 1]); };
  const bloom = (x, y) => { const r = 0.045 + R() * 0.02, k = bk[Math.floor(R() * bk.length)], zz = z + 0.06; for (let i = 0; i < 3; i++) { const a = R() * 0.5 + (i / 3) * 6.283; B.poly(k, [[x, y, zz + 0.02], [x + Math.cos(a) * r, y + Math.sin(a) * r, zz], [x + Math.cos(a + 2.1) * r, y + Math.sin(a + 2.1) * r, zz]], [0, 0, 1]); } };
  const tipsAll = [];
  for (let i = 0; i < ns; i++) {
    const f = ns === 1 ? 0 : (i / (ns - 1)) * 2 - 1, ang = f * 1.1 + (R() - 0.5) * 0.15;     // the fan's spread from the root
    let p = [s + (R() - 0.5) * 0.12, y0 + 0.02]; const L = h * (0.75 + R() * 0.3) / Math.cos(ang * 0.6), n = 4;
    const tx = s + Math.sin(ang) * sp * 1.15 * (0.85 + R() * 0.3), ty = y0 + Math.min(h, L * Math.cos(ang * 0.8));
    for (let q = 1; q <= n; q++) {
      const t = q / n, e = Math.pow(t, 0.8), nx = s + (tx - s) * e + (R() - 0.5) * 0.08, ny = y0 + (ty - y0) * t;
      strip(p, [nx, ny], 0.018 * (1.2 - t * 0.6), 'stem');
      const segL = Math.hypot(nx - p[0], ny - p[1]), nl = Math.round(segL * perM * (0.3 + t));
      for (let k = 0; k < nl; k++) { const tt = R(); leafCard(p[0] + (nx - p[0]) * tt + (R() - 0.5) * 0.14, p[1] + (ny - p[1]) * tt + (R() - 0.5) * 0.1); }
      if (q >= 2 && R() < 0.6) {      // a side shoot
        const sx = nx + (R() - 0.5) * 0.5, sy = ny + 0.15 + R() * 0.25; strip([nx, ny], [sx, sy], 0.01, 'stem');
        for (let k = 0; k < Math.round(3 * lod) + 1; k++) leafCard(nx + (sx - nx) * R() + (R() - 0.5) * 0.08, ny + (sy - ny) * R());
        tipsAll.push([sx, sy]);
      }
      p = [nx, ny];
    }
    tipsAll.push(p);
  }
  const nb = o.blooms ?? 14;
  for (let i = 0; i < nb; i++) { const p = tipsAll[Math.floor(R() * tipsAll.length)]; bloom(p[0] + (R() - 0.5) * 0.25, p[1] - R() * 0.3); }
  B.pop();
  return spend('rose', B.tris() - n0);
}

// ------------------------------------------------------------------------------------------------ the Chapel's south beds
/**
 * The beds between the Chapel's south buttresses facing the Front Quad (satellite 2026-11-23: a round dark-green clump in
 * each bay; 04 "chapel south face straight on from quad (exeter.ox.ac.uk 2016)": in the bays east of the porch a
 * big-leaved plant or small shrubs at the foot of each bay, and on the wall, alternately, a green creeper patch up to
 * about the sill string and a bare fan-trained wall shrub (a rose or a wisteria, leafless in that picture)). For the lead
 * to call from the chapel or grounds part:
 *   chapelBeds(ctx, {
 *     faceV:  the south wall's face (LOCAL v; the Chapel's south wall, _exeter_chapel_plan.js P.WALL_S, -19.75),
 *     bays:   [[u0, u1], ...] the clear span of each bed between two buttresses' side faces (LOCAL u), west to east,
 *     depth:  the bed's depth out from the wall (0.9; the buttresses stand 2.0 out at the foot),
 *     y:      the ground's level (number, or (u, v) => y; the Front Quad's paving there),
 *     top:    the y the wall climbers reach (default y + 3.0: about the sill string),
 *     plants: optional per bay [kinds, ...] (default: a hosta / fatsia-like clump and a small laurel or a fern),
 *     wall:   optional per bay 'creeper' | 'rose' | null (default: alternately 'rose', 'creeper', from the west),
 *     holes:  optional per bay [[u0, u1, y0, y1]] to keep clear (a door, a grille),
 *     seed, lod (1),
 *   })
 * Draws a soil strip ('flowerbed', 2 cm proud) in each bay, registers nothing (people do not walk into beds; the
 * buttresses' colliders are the Chapel's). Returns triangles. Places of plants and the alternation: G.
 */
export function chapelBeds(ctx, spec) {
  const { B } = ctx; tints(ctx.pack);
  const n0 = B.tris(), R = rng(spec.seed ?? 41), depth = spec.depth ?? 0.9, fv = spec.faceV, lod = spec.lod ?? 1;
  const yf = typeof spec.y === 'function' ? spec.y : () => spec.y ?? 0;
  (spec.bays || []).forEach(([u0, u1], i) => {
    const w = u1 - u0, yc = yf((u0 + u1) / 2, fv + depth / 2);
    B.flat('flowerbed', [[u0, fv], [u1, fv], [u1, fv + depth], [u0, fv + depth]], yc + 0.02);
    const kinds = (spec.plants && spec.plants[i]) || (i % 2 ? ['laurel', 'fern'] : ['hosta', 'box']);
    kinds.forEach((k, j) => {
      const f = (j + 0.5) / kinds.length, u = u0 + w * (0.2 + 0.6 * f) + (R() - 0.5) * 0.3, v = fv + depth * (0.45 + R() * 0.2);
      const big = k === 'hosta' ? { r: 0.55 + R() * 0.2, h: 0.75 + R() * 0.3 } : k === 'fern' ? { r: 0.4, h: 0.5 } : { r: 0.35 + R() * 0.15, h: 0.6 + R() * 0.4 };
      shrub(ctx, u, yf(u, v), v, { kind: k, ...big, seed: 41 + i * 7 + j, lod });
    });
    // the wall: the face is at v = fv, facing +v (south): frame(u0, 0, fv, 1, 0)
    const kind = spec.wall ? spec.wall[i] : (i % 2 ? 'creeper' : 'rose');
    const F = K.frame(u0, 0, fv, 1, 0), g = yc, top = spec.top ?? g + 3.0;
    if (kind === 'creeper') climber(ctx, F, { s0: 0.05, s1: w - 0.05, ground: g, top: [top - 1.0, top], set: 'creeper', seed: 51 + i, lod, holes: (spec.holes && spec.holes[i] || []).map(([a, b, y0, y1]) => [a - u0, b - u0, y0, y1]), stems: 2 });
    else if (kind === 'rose') rose(ctx, F, { s: w / 2, ground: g, h: top - g - 0.2, spread: Math.min(1.3, w / 2 - 0.15), stems: 7, seed: 61 + i, lod, blooms: 10 });
  });
  return B.tris() - n0;
}
