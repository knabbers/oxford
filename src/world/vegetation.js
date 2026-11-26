// Trees (map trees + seeded scatter in woods, parks, gardens, scrub) as LOD'd InstancedMeshes with wind sway.
// Species: broadleaf (oak/lime/plane), conifer (yew/cedar), willow (by water), columnar (poplar/cypress), bush.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { InstanceSet } from './instancing.js';
import { makeRng, pointInPoly, polyBounds, distToSeg, hash2, SpatialGrid } from './util.js';
import { makeTreeBillboardTex, makeTreeAtlas } from './textures.js';
import { U, addWind } from './materials.js';
import { SURF, SURF_PARS } from './_surf_detail.js';

// LOD: full 3D crown + trunk in ONE draw per species only close to the camera (tier.treeNear: 30 / 45 / 60 m; shadow
// casting, wind sway), then ONE camera-facing card draw for every species out to FAR m. The cards are impostors baked at
// load from a much richer version of the same procedural model (hundreds of leaf clumps, limbs), so the far tree is
// the near tree's own silhouette and the swap is hard to see.
const NEAR = 45, FAR = 1100;
const BAKE_GAIN = '1.0';   // impostor albedo gain (the cards are lit like the near trees)
export const SPECIES = ['broad', 'conifer', 'plane', 'willow', 'column', 'bush'];   // order = impostor atlas cells (0 broad, 1 conifer are relied on by places/_parks_trees.js)
const CARD_W = 1.24;   // card / bake frame width in model units (model height = 1)
// [name, minX, maxX, minZ, maxZ, h0, h1, gap]: where every mapped tree is a London plane of h0..h1 m, none closer than
// gap m to one planted before it (trees pass, 2026-11)
export const PLANE_AREAS = [
  ["St Giles'", -70, 90, -480, -20, 19, 25, 6],          // the great planes down both sides (bare in the photographs, 20-25 m)
  ['Gloucester Green', -145, -98, 78, 128, 10, 14, 5],   // the square's grid of planes in block paving (younger, 1980s)
  ['The Plain', 1075, 1112, 524, 556, 18, 24, 10],       // the few big planes on the Victoria Fountain's island (nine mapped, tightly)
];

// crown envelope per species: radius of the crown at height y (0..1), trunk height, how the clumps sit
const FORM = {
  broad: { y0: 0.34, env: (t) => 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)), 0.62), trunk: [0.5, 0.017, 0.011], limbs: 4, squash: 0.78, bark: [0.33, 0.27, 0.2] },
  // trees pass (photo comparison item 5): a mature London plane — clear trunk to about a quarter of its height, then a
  // broad, lumpy dome on five big limbs (was a narrow lollipop on a pole)
  plane: { y0: 0.27, env: (t) => 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.86 + 0.14)), 0.5) * (0.88 + 0.12 * Math.sin(t * 11 + 1)), trunk: [0.5, 0.024, 0.014], limbs: 5, squash: 0.9, bark: [0.62, 0.6, 0.5] },
  conifer: { y0: 0.1, env: (t) => 0.36 * (1 - t) * (0.82 + 0.18 * Math.cos(t * 26)) + 0.03, trunk: [0.3, 0.014, 0.009], limbs: 0, squash: 0.55, bark: [0.3, 0.26, 0.22] },
  willow: { y0: 0.14, env: (t) => (t < 0.45 ? 0.5 + 0.08 * t : 0.56 * Math.pow(Math.sin(Math.PI * (0.5 + (t - 0.45) * 0.9)), 0.7)), trunk: [0.55, 0.024, 0.015], limbs: 3, squash: 1.5, hollow: 0.5, bark: [0.3, 0.26, 0.2] },
  column: { y0: 0.1, env: (t) => 0.15 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.88 + 0.12)), 0.45), trunk: [0.25, 0.016, 0.011], limbs: 0, squash: 1.7, bark: [0.33, 0.3, 0.25] },
  bush: { y0: 0.0, env: (t) => 0.58 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.5 + 0.5)), 0.6), trunk: null, limbs: 0, squash: 0.85, bark: [0.3, 0.25, 0.2] },
};

// ---- graphics pass 4: leaf-card trees. A crown is a small opaque core (dense shaded foliage, drawn first so it hides the
// far side) wrapped in alpha cut-out leaf sprays; normals point out of the crown so it shades as one volume; the vertex
// colour bakes the occlusion (dark inside and underneath). Fewer triangles than the pass-3 lumps (606 -> 256 for a
// broadleaf), indexed.
const CARDS = {   // n cards, half-size (model units), atlas cells, upright (texture up = world up), core [yFrac, rx/maxR, ry/span]
  broad: { n: 64, s: 0.118, cells: [0, 1], core: [0.5, 0.6, 0.35] },
  plane: { n: 66, s: 0.118, cells: [1, 0], core: [0.5, 0.64, 0.38] },   // (near planes use their own model where the near trees are batched, the broadleaf mesh otherwise)
  conifer: { n: 84, s: 0.1, cells: [2], upright: true, core: null },   // (trees pass: more, larger sprays round a slimmer core: the core cone read as a toy)
  willow: { n: 60, s: 0.125, cells: [3, 3, 3, 0], upright: true, core: [0.7, 0.52, 0.24] },
  column: { n: 34, s: 0.07, cells: [0, 1], core: [0.5, 0.58, 0.42] },
  bush: { n: 26, s: 0.19, cells: [0, 1], core: [0.2, 0.6, 0.5] },
};
// (conifer bark was a saturated red-brown [0.7, 0.54, 0.44]: the "fat red trunk" of the photo comparison; now grey-brown)
const BARK_TINT = { broad: [0.86, 0.82, 0.76], plane: [0.98, 0.96, 0.9], conifer: [0.66, 0.6, 0.54], willow: [0.74, 0.7, 0.6], column: [0.9, 0.88, 0.8], bush: [0.7, 0.62, 0.5] };
// bark strip of the tree atlas (textures.js makeTreeAtlas): furrowed bark in its left half, a plane's mottled bark in its right
const BARK_U = { plane: [0.887, 0.101] }, BARK_U0 = [0.762, 0.101];
function tube(x0, y0, z0, x1, y1, z1, r0, r1, seg = 5, bu = BARK_U0) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, seg, 1, true);
  const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), len = d.length();
  g.scale(1, len, 1); g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(x0, y0, z0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, bu[0] + Math.abs(uv.getX(i) * 2 - 1) * bu[1], uv.getY(i) * len * 5 + y0 * 5);
  return g;
}
/**
 * One tree in unit space (height 1): indexed geometry with position, normal, uv (makeTreeAtlas), color and aTrunk
 * (1 = bark: not tinted by the instance colour). rich = the bake-only version (3x the cards, smaller).
 */
export function treeModel(sp, rich = false) {
  const F_ = FORM[sp], C = CARDS[sp], rng = makeRng('tree4-' + sp), span = 1 - F_.y0;
  const P = [], Nn = [], UV = [], CL = [], TR = [], IX = [], AC = [];
  let maxR = 0; for (let i = 0; i <= 20; i++) maxR = Math.max(maxR, F_.env(i / 20));
  const yc = F_.y0 + span * (C.core ? C.core[0] : 0.4);
  const vert = (x, y, z, nx, ny, nz, u, v, r, g, b, tr) => { P.push(x, y, z); const l = Math.hypot(nx, ny, nz) || 1; Nn.push(nx / l, ny / l, nz / l); UV.push(u, v); CL.push(r, g, b); TR.push(tr); AC.push(x, y, z, 0); return P.length / 3 - 1; };
  const addGeo = (g, fn) => {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, base = P.length / 3;
    for (let i = 0; i < p.count; i++) fn(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i), uv.getX(i), uv.getY(i));
    if (g.index) for (let i = 0; i < g.index.count; i++) IX.push(base + g.index.getX(i)); else for (let i = 0; i < p.count; i++) IX.push(base + i);
    g.dispose();
  };
  // ---- core first (it fills the depth buffer before the far-side cards)
  if (C.core) {
    const rx = maxR * C.core[1], ry = span * C.core[2];
    addGeo(new THREE.IcosahedronGeometry(1, 1), (x, y, z) => {
      const kk = 1 + (hash2(Math.round(x * 90), Math.round(y * 70 + z * 50)) - 0.5) * 0.3, X = x * rx * kk, Yv = Math.min(0.98, yc + y * ry * kk), Z = z * rx * kk;
      const k = 0.5 + 0.32 * (y * 0.5 + 0.5);
      vert(X, Yv, Z, x, y * 0.9 + 0.35, z, 0.512 + (Math.atan2(z, x) / 6.2832 + 0.5) * 0.226, Yv * 2.2, k * 0.96, k, k * 0.9, 0);
    });
  } else {
    // a slim, uneven inner cone (it only fills the gaps between the sprays): each vertex pushed in or out by a hash
    const r = F_.env(0.05) * 0.42, h = span * 0.88;
    const g = new THREE.ConeGeometry(r, h, 7, 4, true); g.translate(0, F_.y0 + 0.03 + h / 2, 0);
    addGeo(g, (x, y, z, nx, ny, nz, u, v) => { const j = 0.75 + 0.5 * hash2(Math.round(x * 400 + y * 37), Math.round(z * 400 - y * 53)), k = 0.34 + 0.3 * v; vert(x * j, y, z * j, nx, ny + 0.3, nz, 0.512 + u * 0.226, y * 2.2, k * 0.96, k, k * 0.9, 0); });
  }
  // ---- trunk and limbs (the crown shades them: darker towards the top)
  if (F_.trunk) {
    const [th, r0, r1] = F_.trunk, bt = BARK_TINT[sp], bu = BARK_U[sp] || BARK_U0;
    const wood = [tube(0, 0, 0, 0, th * 0.22, 0, r0 * 1.7, r0, rich ? 8 : 6, bu), tube(0, th * 0.22, 0, 0, th, 0, r0, r1, rich ? 8 : 6, bu)];
    const nl = rich ? F_.limbs * 2 : F_.limbs;
    for (let k = 0; k < nl; k++) {
      const a = k * 2.4 + 0.5, y0 = th * (0.6 + 0.3 * rng()), t = 0.25 + 0.4 * rng(), R = F_.env(t) * 0.7;
      wood.push(tube(0, y0, 0, Math.cos(a) * R, F_.y0 + t * span, Math.sin(a) * R, r1 * 0.85, r1 * 0.3, rich ? 5 : 3, bu));
    }
    for (const g of wood) addGeo(g, (x, y, z, nx, ny, nz, u, v) => { const k = (1 - 0.5 * Math.min(1, Math.max(0, (y - F_.y0 * 0.55) / (F_.y0 * 0.6 + 0.02)))) * (0.92 + 0.16 * hash2(Math.round(x * 500), Math.round(y * 300))); vert(x, y, z, nx, ny, nz, u, v, bt[0] * k, bt[1] * k, bt[2] * k, 1); });
  }
  // ---- leaf cards on the crown shell
  const N = Math.round(C.n * (rich ? 3.2 : 1)), S0 = C.s * (rich ? 0.62 : 1);
  for (let k = 0; k < N; k++) {
    const t = (k + rng()) / N, y = F_.y0 + (0.03 + t * 0.94) * span, R = F_.env(t);
    const a = k * 2.39996 + rng() * 0.7, rr = R * (F_.hollow ? 0.72 + 0.24 * rng() : 0.46 + 0.46 * Math.sqrt(rng()));
    const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    let ox = cx, oy = (y - yc) * 0.9, oz = cz; { const l = Math.hypot(ox, oy, oz) || 1; ox /= l; oy /= l; oz /= l; }
    let ux, uy, uz, vx, vy, vz;
    if (C.upright) {
      const b = a + (rng() - 0.5) * 1.7; ux = -Math.sin(b); uy = 0; uz = Math.cos(b);
      const lean = (rng() - 0.3) * 0.5; vx = Math.cos(b) * lean; vy = 1; vz = Math.sin(b) * lean;
    } else {
      // random plane, biased to face out of the crown (more cover per card)
      let nx = rng() * 2 - 1 + ox * 0.7, ny = rng() * 2 - 1 + oy * 0.7, nz = rng() * 2 - 1 + oz * 0.7; { const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
      let qx = rng() - 0.5, qy = rng() - 0.5, qz = rng() - 0.5;
      ux = ny * qz - nz * qy; uy = nz * qx - nx * qz; uz = nx * qy - ny * qx; { const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l; }
      vx = ny * uz - nz * uy; vy = nz * ux - nx * uz; vz = nx * uy - ny * ux;
    }
    const su = S0 * (0.8 + 0.45 * rng()) * (0.8 + R * 0.7), sv = su * (C.upright ? 1.3 : 1);
    const cell = C.cells[(rng() * C.cells.length) | 0], cu = (cell % 2) * 0.25, cv = 1 - ((cell >> 1) + 1) * 0.5, flip = rng() < 0.5;
    const hj = rng() * 2 - 1, kj = (rng() - 0.5) * 0.16, base = P.length / 3;
    for (const [a1, b1] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const X = cx + ux * su * a1 + vx * sv * b1, Yv = Math.min(1, Math.max(0.02, y + uy * su * a1 + vy * sv * b1)), Z = cz + uz * su * a1 + vz * sv * b1;
      const tv = (Yv - F_.y0) / span, rN = Math.hypot(X, Z) / Math.max(0.05, F_.env(Math.max(0, Math.min(1, tv))));
      const kk = Math.max(0.5, Math.min(1.15, 0.5 + 0.36 * Math.pow(Math.max(0, tv), 0.8) + 0.2 * Math.min(1.2, rN) + kj));
      vert(X, Yv, Z, X * 0.9 + ox * 0.2, (Yv - yc) * 1.0 + 0.3 * maxR, Z * 0.9 + oz * 0.2, cu + ((a1 > 0) !== flip ? 0.25 : 0), cv + (b1 > 0 ? 0.5 : 0), kk * (1 + hj * 0.09), kk, kk * (1 - hj * 0.1), 0);
    }
    IX.push(base, base + 1, base + 2, base, base + 2, base + 3);
    // pass 7: in the SHADOW pass each card is drawn as a slender lozenge along one diagonal (treeDepthMaterial pulls the
    // corners towards the card centre by aCtr.w), so a crown casts a solid heart with dappled, leaf-shaped edges
    // instead of the union of 4 m squares
    const fl = hash2(k * 7 + 3, N) < 0.5;   // (not rng(): the tree shapes must not change)
    for (let j = 0; j < 4; j++) { const o = (base + j) * 4; AC[o] = cx; AC[o + 1] = Math.min(1, Math.max(0.02, y)); AC[o + 2] = cz; AC[o + 3] = (j % 2 === 0) === fl ? 0.42 : 0.74; }   // ~1/8 of the card: with ~60 overlapping cards the shell lets flecks of sun through
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(CL, 3));
  g.setAttribute('aTrunk', new THREE.Float32BufferAttribute(TR, 1));
  g.setAttribute('aCtr', new THREE.Float32BufferAttribute(AC, 4));
  g.setIndex(new THREE.Uint16BufferAttribute(IX, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

function tubeOld(x0, y0, z0, x1, y1, z1, r0, r1, seg = 5) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, seg, 1, true);
  const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), len = d.length();
  g.scale(1, len, 1); g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(x0, y0, z0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * len * 8);
  return g.toNonIndexed();
}
/** The pass-3 solid-lump model: only for speciesGeometries() (old API, drawn with the opaque world.mats.leaves). */
function legacyModel(sp, rich = false) {
  const F_ = FORM[sp], rng = makeRng('tree-' + sp), parts = [], wood = [];
  // real-time model: a dozen-odd 20-triangle clumps (shaded as one mass by the blended normals), ~300-400 triangles
  const N = rich ? (sp === 'column' ? 46 : sp === 'bush' ? 40 : 80) : sp === 'column' ? 4 : sp === 'bush' ? 3 : 7;
  const detail = 1, span = 1 - F_.y0;
  const rBase = rich ? 0.085 : sp === 'column' ? 0.14 : 0.2;
  const clumps = [];
  for (let k = 0; k < N; k++) {
    // stratified heights; real-time model: fewer, bigger clumps centred nearer the axis
    const t = (k + rng()) / N * (rich ? 1 : 0.9) + (rich ? 0 : 0.05), y = F_.y0 + t * span, R = F_.env(t);
    const a = rich ? rng() * Math.PI * 2 : k * 2.4 + 0.6, rr = R * (F_.hollow ? F_.hollow + (1 - F_.hollow) * Math.sqrt(rng()) : Math.sqrt(rng())) * (rich ? 0.86 : 0.7);
    const r = rBase * (0.75 + 0.5 * rng()) * (rich ? 0.8 + R * 1.3 : 0.7 + R * 1.5);
    clumps.push([Math.cos(a) * rr, y, Math.sin(a) * rr, r]);
  }
  for (const [x, y, z, r] of clumps) {
    const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      let vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const l = Math.hypot(vx, vy, vz) || 1;
      const kk = 1 + (hash2(Math.round(vx * 900 + x * 300), Math.round(vy * 900 + vz * 500 + y * 700)) - 0.5) * 0.42;
      const X = x + vx * kk, Yv = Math.min(1, y + vy * kk * F_.squash), Z = z + vz * kk;
      p.setXYZ(i, X, Yv, Z);
      // normals lean towards the whole crown's surface so the clumps shade as one mass
      const cx = X, cy = (Yv - (F_.y0 + span * 0.45)) * 1.2, cz = Z, cl = Math.hypot(cx, cy, cz) || 1;
      const wq = rich ? 0.55 : 0.3; let nx = vx / l * wq + cx / cl * (1 - wq), ny = vy / l * wq + cy / cl * (1 - wq) + (rich ? 0.15 : 0.8), nz = vz / l * wq + cz / cl * (1 - wq); const nl = Math.hypot(nx, ny, nz) || 1;
      n.setXYZ(i, nx / nl, ny / nl, nz / nl);
    }
    parts.push(g);
  }
  const crown = mergeGeometries(parts);
  sphericalUv(crown, 0.55);
  // baked shading: dark underneath and in the core, light on top and at the rim, per-vertex jitter
  {
    const p = crown.attributes.position, n = p.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = p.getY(i), t = (y - F_.y0) / span, R = Math.max(0.05, F_.env(Math.max(0, Math.min(1, t)))), r = Math.hypot(p.getX(i), p.getZ(i)) / R;
      const j = (hash2(Math.round(p.getX(i) * 700), Math.round(y * 900 + p.getZ(i) * 500)) - 0.5) * (rich ? 0.3 : 0.16);
      const k = Math.max(rich ? 0.42 : 0.6, Math.min(1.15, 0.52 + 0.4 * Math.pow(Math.max(0, t), 0.8) + 0.16 * Math.min(1.2, r) + j));
      c[i * 3] = k * 0.97; c[i * 3 + 1] = k; c[i * 3 + 2] = k * 0.9;
    }
    crown.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  if (F_.trunk) {
    const [th, r0, r1] = F_.trunk;
    wood.push(tubeOld(0, 0, 0, 0, th * 0.25, 0, r0 * 1.5, r0, rich ? 8 : 6), tubeOld(0, th * 0.25, 0, 0, th, 0, r0, r1, rich ? 8 : 5));
    const nl = rich ? F_.limbs * 2 : F_.limbs;
    for (let k = 0; k < nl; k++) {
      const a = k * 2.4 + 0.5, y0 = th * (0.62 + 0.3 * rng()), t = 0.25 + 0.4 * rng(), R = F_.env(t) * 0.75;
      wood.push(tubeOld(0, y0, 0, Math.cos(a) * R, F_.y0 + t * span, Math.sin(a) * R, r1 * 0.9, r1 * 0.35, rich ? 5 : 3));
    }
  }
  const cr = crown.index ? crown.toNonIndexed() : crown;
  cr.setAttribute('aTrunk', new THREE.BufferAttribute(new Float32Array(cr.attributes.position.count), 1));
  const out = [cr];
  for (const t of wood) {
    const n = t.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = 0.85 + 0.3 * hash2(i * 7, 3); c[i * 3] = F_.bark[0] * k; c[i * 3 + 1] = F_.bark[1] * k; c[i * 3 + 2] = F_.bark[2] * k; }
    t.setAttribute('color', new THREE.BufferAttribute(c, 3));
    t.setAttribute('aTrunk', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    out.push(t);
  }
  for (const g of out) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aTrunk'].includes(k)) g.deleteAttribute(k);
  return mergeGeometries(out);
}
function sphericalUv(g, cy) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); uv[i * 2] = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) * 3; uv[i * 2 + 1] = (y - cy) * 3; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Old API (places/_grounds_static.js): {broad|willow|…: {trunk, near}} — crown and trunk of the real-time model as separate geometries. */
export function speciesGeometries() {
  const out = {};
  for (const sp of SPECIES) {
    const g = legacyModel(sp, false), tr = g.attributes.aTrunk, n = g.attributes.position.count;
    const pick = (want) => {
      const idx = []; for (let i = 0; i < n; i += 3) if ((tr.getX(i) > 0.5) === want) idx.push(i, i + 1, i + 2);
      if (!idx.length) return null;
      const o = new THREE.BufferGeometry();
      for (const k of ['position', 'normal', 'uv']) { const a = g.attributes[k], sz = a.itemSize, arr = new Float32Array(idx.length * sz); idx.forEach((v, j) => { for (let c = 0; c < sz; c++) arr[j * sz + c] = a.array[v * sz + c]; }); o.setAttribute(k, new THREE.BufferAttribute(arr, sz)); }
      return o;
    };
    out[sp] = { trunk: pick(true), near: pick(false), far: pick(false) };
  }
  return out;
}

/** Render the rich model of every species into one atlas (species side by side). null without a real WebGL renderer. */
function bakeImpostors(renderer, leafTex) {
  if (!renderer || !renderer.setRenderTarget || !renderer.getContext || !renderer.capabilities || !renderer.capabilities.isWebGL2) return null;
  // whatever happens in here, the renderer leaves exactly as it came (a bake that threw half-way used to leave the
  // render target bound and the whole game black)
  const prevT = renderer.getRenderTarget(), prevC = new THREE.Color(), prevA = renderer.getClearAlpha(), prevAuto = renderer.autoClear, prevSh = renderer.shadowMap.autoUpdate;
  renderer.getClearColor(prevC);
  let rt = null, mat = null, ok = false;
  const geos = [];
  try {
    const S = 384, n = SPECIES.length;
    rt = new THREE.WebGLRenderTarget(S * n, S, { samples: 0, depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    rt.texture.colorSpace = THREE.SRGBColorSpace; rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping; rt.texture.anisotropy = 4;
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-CARD_W / 2, CARD_W / 2, 1, 0, 0.1, 10);
    cam.position.set(0, 0, 3); cam.lookAt(0, 0, 0); cam.position.y = 0; cam.updateMatrixWorld();
    // unlit: vertex colours carry the form shading; a faint leaf texture breaks up the clumps. The card is multiplied by
    // the tree's green instance colour at run time, so bark is baked in the complementary purple-brown: tinted, it comes
    // out grey-brown instead of lime (pass 5).
    mat = new THREE.MeshBasicMaterial({ vertexColors: true, map: leafTex, toneMapped: false, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTrunk;\nvarying float vTr;').replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvTr = aTrunk;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTr;').replace('#include <map_fragment>', '#include <map_fragment>\n\tif (diffuseColor.a < 0.4) discard;\n\tdiffuseColor.a = 1.0;\n\tdiffuseColor.rgb *= mix(vec3(' + BAKE_GAIN + '), vec3(1.25, 0.8, 1.9), vTr);');
    };
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x4a5a34, 0); renderer.autoClear = false; renderer.clear();
    SPECIES.forEach((sp, i) => {
      const g = treeModel(sp, true); geos.push(g);
      const m = new THREE.Mesh(g, mat); m.rotation.y = 0.6; scene.add(m);
      rt.viewport.set(i * S, 0, S, S); rt.scissor.set(i * S, 0, S, S); rt.scissorTest = true;
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      scene.remove(m);
    });
    rt.scissorTest = false; rt.viewport.set(0, 0, S * n, S);
    ok = true;
  } catch (e) { console.warn('[world] tree impostor bake failed, using painted cards', e); }
  finally {
    try { renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); renderer.autoClear = prevAuto; renderer.shadowMap.autoUpdate = prevSh; } catch (e) { /* context lost */ }
    for (const g of geos) g.dispose(); if (mat) mat.dispose();
    if (!ok && rt) { try { rt.dispose(); } catch (e) { /* */ } }
  }
  return ok ? rt.texture : null;
}

export function buildVegetation(ctx) {
  const { map, M, ov, scene } = ctx;
  if (!M.treeTex) M.treeTex = makeTreeAtlas();
  if (!M.treeNear) M.treeNear = addWind(treeNearMaterial(M.treeTex), 0.018, 'wTreeNear');
  if (!M.treeDepth) {
    M.treeDepth = treeDepthMaterial();
    // every mesh drawn with the near-tree material (the city's, and the place modules' own InstancedMeshes of
    // treeModel()) casts the dappled shadow: hooked up the first time it is drawn
    M.treeNear.onBeforeRender = (r, sc, cam, geometry, object) => { if (object && !object.customDepthMaterial && geometry && geometry.attributes && geometry.attributes.aCtr) object.customDepthMaterial = M.treeDepth; };
  }
  let baked = null;
  try { baked = bakeImpostors(ctx.game && ctx.game.renderer, M.treeTex); } catch (e) { console.warn('[world] tree impostor bake failed', e); baked = null; }
  if (!M.treeBillboard) M.treeBillboard = treeBillboardMaterial(baked);
  ctx.stats.treeImpostors = baked ? 'baked' : 'painted';
  const items = { broad: [], plane: [], conifer: [], willow: [], column: [], bush: [] };
  // ---- placement tests
  const waterPolys = map.areas.filter((a) => a.kind === 'water' && !ov.skip.has(a.id)).map((a) => ({ p: a.poly, bb: polyBounds(a.poly) }));
  const wGrid = new SpatialGrid(40);
  for (const w of ctx.waterSegs) { const p = w.pts; for (let i = 0; i < p.length - 1; i++) wGrid.insertBox(Math.min(p[i][0], p[i + 1][0]) - w.w / 2 - 10, Math.min(p[i][1], p[i + 1][1]) - w.w / 2 - 10, Math.max(p[i][0], p[i + 1][0]) + w.w / 2 + 10, Math.max(p[i][1], p[i + 1][1]) + w.w / 2 + 10, { ax: p[i][0], az: p[i][1], bx: p[i + 1][0], bz: p[i + 1][1], hw: w.w / 2 }); }
  const waterWithin = (x, z, pad) => { let hit = false; wGrid.query(x, z, x, z, (s) => { if (distToSeg(x, z, s.ax, s.az, s.bx, s.bz) < s.hw + pad) { hit = true; return true; } }); return hit; };
  const inWater = (x, z) => {
    for (const w of waterPolys) if (x >= w.bb.minX && x <= w.bb.maxX && z >= w.bb.minZ && z <= w.bb.maxZ && pointInPoly(x, z, w.p)) return true;
    return waterWithin(x, z, 1.2);
  };
  const nearWater = (x, z) => waterWithin(x, z, 9);
  // buildings a place module skipped (and rebuilds by hand in the same footprint: the Radcliffe Camera, the Castle...)
  const skipB = new SpatialGrid(20);
  for (const b of map.buildings) if (!b.part && ov.skip.has(b.id) && (b.minH || 0) <= 2.5) { const bb = polyBounds(b.poly); skipB.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, b); }
  const inSkipped = (x, z) => { let hit = false; skipB.queryRadius(x, z, 0.5, (b) => { if (pointInPoly(x, z, b.poly)) { hit = true; return true; } }); return hit; };
  const inBuildingAt = (x, z) => { let hit = false; ctx.buildingGrid.queryRadius(x, z, 0.5, (r) => { if (!r.b.part && pointInPoly(x, z, r.b.poly) && !(r.b.holes || []).some((h) => pointInPoly(x, z, h))) { hit = true; return true; } }); return hit || inSkipped(x, z); };
  // walls, fences and hedges: a planted tree's trunk is not put through one (2026-11)
  const wallG = new SpatialGrid(10);
  for (const w of map.barriers) { if (ov.skip.has(w.id) || !w.pts) continue; for (let i = 0; i < w.pts.length - 1; i++) { const a = w.pts[i], c = w.pts[i + 1]; wallG.insertSeg(a[0], a[1], c[0], c[1], [a[0], a[1], c[0], c[1]]); } }
  const nearWall = (x, z, r) => { let hit = false; wallG.queryRadius(x, z, r, (q) => { if (distToSeg(x, z, q[0], q[1], q[2], q[3]) < r) { hit = true; return true; } }); return hit; };
  // (tested on its own, after the seeded draws of each spot, so the random sequence — and every other tree — is as before)
  // (2026-11 sanity check: a TREE in a garden / park / grass area is not planted within 0.85 m of a building's wall -
  // `blocked` only tests the point itself at clear = 1, so a trunk stood 8 cm from a house with half its crown inside
  // it; shrubs still grow against the walls. Tested after the seeded draws, like `walled`, and it uses up the budget.)
  const nearBuilding = (x, z, r) => { let hit = false; ctx.buildingGrid.queryRadius(x, z, r + 1, (q) => { if (q.b.part) return; const P = q.b.poly; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; if (distToSeg(x, z, a[0], a[1], c[0], c[1]) < r) { hit = true; return true; } } }); return hit; };
  const walled = (x, z) => inSkipped(x, z) || nearWall(x, z, 0.7);
  const blocked = (x, z, clear = 1) => {
    let hit = false;
    ctx.buildingGrid.queryRadius(x, z, clear + 1, (r) => {
      if (pointInPoly(x, z, r.b.poly)) { hit = true; return true; }
      if (clear > 1) { const q = r.b.poly; for (let i = 0; i < q.length; i++) { const a = q[i], c = q[(i + 1) % q.length]; if (distToSeg(x, z, a[0], a[1], c[0], c[1]) < clear) { hit = true; return true; } } }
    });
    if (hit) return true;
    ctx.roadGrid.queryRadius(x, z, 12, (it) => { if (distToSeg(x, z, it.ax, it.az, it.bx, it.bz) < it.w / 2 + 2.2) { hit = true; return true; } });
    if (hit) return true;
    ctx.pathGrid.queryRadius(x, z, 4, (it) => { if (distToSeg(x, z, it.ax, it.az, it.bx, it.bz) < it.w / 2 + 0.6) { hit = true; return true; } });
    return hit;
  };
  // every planted tree goes through here: nothing closer than `gap` m to another
  const placed = new SpatialGrid(12);
  let total = 0;
  const plant = (sp, x, z, h, r, gap = 3.5) => {
    let clash = false;
    placed.queryRadius(x, z, gap, (t) => { if (Math.hypot(t.x - x, t.z - z) < Math.min(gap, t.g)) { clash = true; return true; } });
    if (clash) return false;
    placed.insertPoint(x, z, { x, z, g: gap });
    items[sp].push([x, z, h, r]); total++;
    return true;
  };
  const b = map.bounds, inMap = (x, z) => x > b.minX + 4 && x < b.maxX - 4 && z > b.minZ + 4 && z < b.maxZ - 4;

  // ---- 1. mapped trees. St Giles' and the big avenues are London planes; by water willows and alders.
  // Trees pass (photo comparison item 5): the street planes that frame Oxford's views were a quarter of their size and
  // a hash could make one a conifer. In PLANE_AREAS every mapped tree is a plane of that area's height range; anywhere,
  // a mapped tree 19 m or taller is a plane (that is how a place module plants a great street tree: map.trees.push
  // in preMap, as Worcester does on Beaumont Street). A fourth element names the species outright ([x, z, h, 'broad']).
  for (const t of map.trees) {
    const [x, z, h] = t;
    if (inBuildingAt(x, z)) continue;          // mapped inside a building (or one a place module rebuilt): not drawn
    const r = hash2(Math.round(x * 10), Math.round(z * 10));
    const pa = PLANE_AREAS.find((q) => x > q[1] && x < q[2] && z > q[3] && z < q[4]);
    const sp = SPECIES.includes(t[3]) ? t[3] : pa || h >= 19 ? 'plane' : nearWater(x, z) && r < 0.55 ? 'willow' : r < 0.5 ? 'broad' : r < 0.78 ? 'plane' : r < 0.9 ? 'conifer' : 'column';
    plant(sp, x, z, pa ? pa[5] + r * (pa[6] - pa[5]) : Math.max(5, Math.min(SPECIES.includes(t[3]) ? 31 : 26, h || 8 + r * 8)), r, pa ? pa[7] : 1.5);
  }
  // ---- 2. avenues and walks that are not mapped tree by tree (rows either side of the path)
  const ROWS = [
    [/^Broad Walk$/, 13, 7.5, 'plane', [17, 24], 2],          // Christ Church Meadow: the great avenue (elms once, planes now)
    [/^New Walk$/, 11, 5.5, 'broad', [15, 21], 2],            // the lime/poplar walk down to the Thames
    [/^Christ Church Meadow Walk$/, 24, 4.5, 'mix', [9, 17], 1],
    [/^Addison's Walk$/, 13, 3.6, 'broad', [11, 19], 2],
    [/^Mesopotamia Walk$/, 12, 3.2, 'willow', [8, 13], 2],
    [/^(North|South|West|Thorn) Walk$/, 26, 5, 'broad', [12, 20], 2],
    [/^Rose Lane$/, 16, 5.5, 'broad', [9, 14], 1],
    [/^(Banbury|Woodstock) Road$/, 21, 9.5, 'mix', [11, 19], 2],   // big front-garden trees overhanging the road
    [/^(Parks Road|Norham Gardens|Bardwell Road|Linton Road|Northmoor Road|Charlbury Road|Crick Road|Norham Road|Fyfield Road|Bradmore Road|Park Town|Canterbury Road|St Margaret's Road|Rawlinson Road|Polstead Road|Chalfont Road|Staverton Road|Belbroughton Road|South Parks Road|Mansfield Road|St Cross Road|Iffley Road|Marston Road)$/, 19, 7.5, 'mix', [8, 16], 2],
  ];
  for (const r of map.roads) {
    if (!r.name || !r.pts || r.pts.length < 2 || ov.skip.has(r.id) || r.tunnel) continue;
    const row = ROWS.find((q) => q[0].test(r.name)); if (!row) continue;
    const [, step, off0, kind, hs, sides] = row, off = off0 + (r.w || 2) / 2 - 1;
    let acc = 0, next = step * (0.3 + hash2(r.pts.length, Math.round(r.pts[0][0])) * 0.6), k = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], c = r.pts[i + 1], l = Math.hypot(c[0] - a[0], c[1] - a[1]); if (l < 0.01) continue;
      while (next <= acc + l) {
        const t = (next - acc) / l, px = a[0] + (c[0] - a[0]) * t, pz = a[1] + (c[1] - a[1]) * t, nx = -(c[1] - a[1]) / l, nz = (c[0] - a[0]) / l;
        for (const s of sides === 2 ? [1, -1] : [k % 2 ? 1 : -1]) {
          const h1 = hash2(Math.round(px * 3 + s * 7), Math.round(pz * 3)), x = px + nx * s * (off + (h1 - 0.5) * 1.6), z = pz + nz * s * (off + (h1 - 0.5) * 1.6);
          if (!inMap(x, z) || inWater(x, z) || blocked(x, z, 2.2) || walled(x, z)) continue;
          const sp = kind === 'mix' ? (h1 < 0.5 ? 'broad' : h1 < 0.82 ? 'plane' : 'conifer') : kind;
          plant(sp, x, z, hs[0] + (hs[1] - hs[0]) * ((h1 * 7.3) % 1), h1, 5);
        }
        next += step * (0.85 + 0.3 * hash2(k, 11)); k++;
      }
      acc += l;
    }
  }
  // ---- 3. river, stream and canal banks: willows, alders, the odd poplar
  for (const w of map.waterlines) {
    if (w.tunnel || ov.skip.has(w.id) || !(w.kind === 'river' || w.kind === 'stream' || w.kind === 'canal')) continue;
    const step = w.kind === 'canal' ? 26 : 17, off = (w.cw ?? w.w) / 2 + 2.6;
    let acc = 0, next = 6, k = 0;
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i], c = w.pts[i + 1], l = Math.hypot(c[0] - a[0], c[1] - a[1]); if (l < 0.01) continue;
      while (next <= acc + l) {
        const t = (next - acc) / l, px = a[0] + (c[0] - a[0]) * t, pz = a[1] + (c[1] - a[1]) * t, nx = -(c[1] - a[1]) / l, nz = (c[0] - a[0]) / l;
        for (const s of [1, -1]) {
          const h1 = hash2(Math.round(px * 2 + s * 5), Math.round(pz * 2));
          if (h1 < 0.3) continue;
          const o = off + h1 * 3.5, x = px + nx * s * o, z = pz + nz * s * o;
          if (!inMap(x, z) || inWater(x, z) || blocked(x, z, 3) || walled(x, z)) continue;
          plant(h1 < 0.62 ? 'willow' : h1 < 0.9 ? 'broad' : 'column', x, z, h1 < 0.62 ? 7 + h1 * 9 : 9 + h1 * 9, h1, 6);
        }
        next += step * (0.7 + 0.6 * hash2(k, 5)); k++;
      }
      acc += l;
    }
  }
  // ---- 4. scatter in woods, parks, gardens, meadows, scrub and rough grass
  let budget = 11000;
  for (const { a, poly, holes } of ctx.areaList) {
    let spacing, prob, sizes, species, gap = 3.5;
    if (a.kind === 'wood') { spacing = 7.5; prob = 0.85; sizes = [9, 20]; species = 'wood'; }
    else if (a.kind === 'park') { spacing = 21; prob = 0.36; sizes = [9, 19]; species = 'park'; gap = 7; }
    else if (a.kind === 'garden') { spacing = 11; prob = 0.4; sizes = [4, 12]; species = 'garden'; gap = 4; }
    else if (a.kind === 'scrub') { spacing = 5; prob = 0.5; sizes = [1.8, 3.5]; species = 'bush'; gap = 2; }
    else if (a.kind === 'meadow') { spacing = 34; prob = 0.2; sizes = [9, 18]; species = 'park'; gap = 8; }
    else if (a.kind === 'grass' && !ctx.inCollege(a.poly[0][0], a.poly[0][1])) { spacing = 19; prob = 0.25; sizes = [6, 14]; species = 'garden'; gap = 6; }
    else continue;
    const bb = polyBounds(poly);
    const rr = makeRng(a.id);
    for (let x = bb.minX + spacing / 2; x < bb.maxX && budget > 0; x += spacing) for (let z = bb.minZ + spacing / 2; z < bb.maxZ && budget > 0; z += spacing) {
      if (rr() > prob) continue;
      const px = x + (rr() - 0.5) * spacing * 0.9, pz = z + (rr() - 0.5) * spacing * 0.9;
      if (!pointInPoly(px, pz, poly) || holes.some((h) => pointInPoly(px, pz, h))) continue;
      if (blocked(px, pz)) continue;
      const h = sizes[0] + (sizes[1] - sizes[0]) * rr(), r = rr();
      // against a wall: not planted, but it uses up the budget as it did before, so the areas after it get the trees they had
      if (walled(px, pz)) { let clash = false, g = species === 'bush' ? 2 : gap; placed.queryRadius(px, pz, g, (t) => { if (Math.hypot(t.x - px, t.z - pz) < Math.min(g, t.g)) { clash = true; return true; } }); if (!clash) budget--; continue; }
      let sp = species === 'bush' ? 'bush' : species === 'wood' ? (r < 0.6 ? 'broad' : r < 0.84 ? 'plane' : 'conifer') : species === 'garden' ? (r < 0.42 ? 'broad' : r < 0.58 ? 'plane' : r < 0.76 ? 'conifer' : 'bush') : r < 0.5 ? 'broad' : r < 0.78 ? 'plane' : r < 0.9 ? 'conifer' : 'column';
      if (sp !== 'bush' && nearWater(px, pz) && r < 0.4) sp = 'willow';
      if (sp !== 'bush' && nearBuilding(px, pz, 0.85)) { let clash = false; placed.queryRadius(px, pz, gap, (t) => { if (Math.hypot(t.x - px, t.z - pz) < Math.min(gap, t.g)) { clash = true; return true; } }); if (!clash) budget--; continue; }
      if (plant(sp, px, pz, sp === 'bush' ? 1.6 + r * 2.2 : h, r, sp === 'bush' ? 2 : gap)) budget--;
    }
  }
  // ---- 5. back and front gardens of the houses outside the centre (not mapped as garden polygons): a tree or a shrub
  // every so often wherever there is open ground within a plot's depth of a house
  {
    const areaGrid = new SpatialGrid(60);
    for (const it of ctx.areaList) { const bb = polyBounds(it.poly); areaGrid.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, { poly: it.poly, bb }); }
    const inArea = (x, z) => { let hit = false; areaGrid.queryRadius(x, z, 0.5, (it) => { if (x >= it.bb.minX && x <= it.bb.maxX && z >= it.bb.minZ && z <= it.bb.maxZ && pointInPoly(x, z, it.poly)) { hit = true; return true; } }); return hit; };
    const STEP = 12;
    let n = 0;
    for (let gx = b.minX + 8; gx < b.maxX - 8; gx += STEP) for (let gz = b.minZ + 8; gz < b.maxZ - 8; gz += STEP) {
      const h1 = hash2(Math.round(gx * 3), Math.round(gz * 3 + 17));
      if (h1 > 0.62 || n > 5200) continue;
      const x = gx + (hash2(Math.round(gx), Math.round(gz)) - 0.5) * STEP * 0.9, z = gz + (hash2(Math.round(gz * 2), Math.round(gx * 2)) - 0.5) * STEP * 0.9;
      const zone = ctx.zoneAt(x, z); if (zone === 'centre') continue;
      let house = false;
      ctx.buildingGrid.queryRadius(x, z, 22, (r) => { const t = r.b.tags && r.b.tags.building; if ((t === 'house' || t === 'terrace' || t === 'semidetached_house' || t === 'detached' || t === 'residential' || t === 'apartments' || t === 'yes') && Math.hypot(r.b.c[0] - x, r.b.c[1] - z) < 24) { house = true; return true; } });
      if (!house || inArea(x, z) || inWater(x, z) || blocked(x, z, 2.6) || walled(x, z)) continue;
      const r = (h1 * 13.7) % 1, big = zone === 'north';
      const sp = r < 0.4 ? 'broad' : r < 0.54 ? 'plane' : r < 0.7 ? 'conifer' : 'bush';   // few species near any one garden = few near-mesh draws
      if (plant(sp, x, z, sp === 'bush' ? 1.5 + r * 2.5 : big ? 7 + r * 11 : 4.5 + r * 7, r, sp === 'bush' ? 2.5 : 5)) n++;
    }
    ctx.stats.gardenTrees = n;
  }
  // ---- 6. churchyards: yews by the churches
  for (const rec of ctx.buildingRecs || []) {
    const t = rec.b.tags || {};
    if (!(t.building === 'church' || t.building === 'chapel' || t.amenity === 'place_of_worship') || !rec.res) continue;
    for (let k = 0; k < 6; k++) {
      const h1 = hash2(Math.round(rec.b.c[0] * 3 + k * 31), Math.round(rec.b.c[1] * 3)), e = rec.res.edges[Math.floor(h1 * rec.res.edges.length)]; if (!e || e.street) continue;
      const tt = (h1 * 7.7) % 1, x = e.ax + (e.bx - e.ax) * tt + e.nx * (4 + h1 * 5), z = e.az + (e.bz - e.az) * tt + e.nz * (4 + h1 * 5);
      if (!inMap(x, z) || inWater(x, z) || blocked(x, z, 2.5) || walled(x, z)) continue;
      plant('conifer', x, z, 6 + h1 * 5, h1, 5);
    }
  }

  // instanced sets: one near InstanceSet per species (crown + trunk merged), one card set for all species
  const col = new THREE.Color();
  // [hue0, hue1, sat0, sat1, light0, light1]: the impostor/vertex shading is a grey value around 0.6-0.8 that this tints
  const HUE = { broad: [0.2, 0.29, 0.36, 0.56, 0.32, 0.45], plane: [0.19, 0.26, 0.34, 0.52, 0.35, 0.48], conifer: [0.28, 0.38, 0.3, 0.45, 0.17, 0.27], willow: [0.17, 0.22, 0.38, 0.52, 0.4, 0.5], column: [0.22, 0.28, 0.38, 0.52, 0.3, 0.4], bush: [0.2, 0.33, 0.35, 0.55, 0.26, 0.38] };
  const PLANE_SMALL_W = [0.6, 0.88];
  const WIDTH = { broad: [0.72, 1.05], plane: [0.74, 0.96], conifer: [0.75, 1.1], willow: [0.9, 1.25], column: [0.8, 1.1], bush: [0.9, 1.5] };
  // pass 5: near trees do not sample the shadow map, so a tree hemmed in by buildings is darkened once, here, from
  // the footprints round it: how much taller than its mid-crown the walls are over how far away, walls to the south
  // (where the sun is) counting most. Rides on the instance colour of the 3D tree and of its far card: free at run time.
  const recH = (rec) => (rec.res ? rec.res.wallTop : rec.b.h) || 0;
  const shadeAt = (x, z, h) => {
    let occ = 0;
    ctx.buildingGrid.queryRadius(x, z, 18, (rec) => {
      const H = recH(rec) - h * 0.5; if (H <= 0) return;
      const q = rec.b.poly; let d = 1e9;
      for (let i = 0; i < q.length; i++) { const a = q[i], c = q[(i + 1) % q.length], dd = distToSeg(x, z, a[0], a[1], c[0], c[1]); if (dd < d) d = dd; }
      if (d > 18) return;
      occ += Math.min(1, H / (d + 4)) * (rec.b.c[1] > z ? 1 : 0.4);
    });
    return 1 - Math.min(0.42, 0.24 * occ);
  };
  const sets = [];
  const bbGeo = new THREE.PlaneGeometry(CARD_W, 1); bbGeo.translate(0, 0.5, 0);
  const bb = new InstanceSet(scene, 'trees:far', [{ meshes: [], maxDist: NEAR }, { meshes: [{ geometry: bbGeo, material: M.treeBillboard, castShadow: false, receiveShadow: false }], maxDist: FAR }], total + 16);
  for (const m of bb.meshes) m.frustumCulled = true;
  // near meshes: with WEBGL_multi_draw (all near trees are one BatchedMesh draw, below) planes have their own model
  // (broad dome, pale mottled bark: no extra draw); without it they use the broadleaf model as before, so the
  // fallback path keeps its five InstancedMeshes
  const R0 = ctx.game && ctx.game.renderer;
  const canBatch = !!(R0 && R0.extensions && R0.extensions.has && R0.extensions.has('WEBGL_multi_draw') && THREE.BatchedMesh);
  const nearSets = {};
  for (let si = 0; si < SPECIES.length; si++) {
    const sp = SPECIES[si], list = items[sp]; if (!list.length) continue;
    const nsp = sp === 'plane' && !canBatch ? 'broad' : sp;
    const set = nearSets[nsp] || (nearSets[nsp] = new InstanceSet(scene, 'trees:' + nsp, [{ meshes: [{ geometry: treeModel(nsp, false), material: M.treeNear, castShadow: nsp !== 'bush', receiveShadow: false }], maxDist: NEAR }], Math.min(nsp === 'broad' && !canBatch ? items.broad.length + items.plane.length : list.length, 1500)));
    const hu = HUE[sp], wd = WIDTH[sp];
    for (const [x, z, h, r] of list) {
      const r2 = (r * 7.31) % 1, r3 = (r * 13.7) % 1;
      col.setHSL(hu[0] + (hu[1] - hu[0]) * r2, hu[2] + (hu[3] - hu[2]) * r3, hu[4] + (hu[5] - hu[4]) * ((r * 3.3) % 1));
      // (the broad mature-plane crown only for the great planes, 17 m and up; smaller planes keep the old proportions)
      const wq = sp === 'plane' && h < 17 ? PLANE_SMALL_W : wd, w = h * (wq[0] + (wq[1] - wq[0]) * r3);
      col.multiplyScalar(shadeAt(x, z, h));
      // the 3D tree stands at the yaw the impostor was baked from, so the swap keeps the same silhouette
      set.add(x, 0, z, 0.6, [w, h, w], col);
      // card: species index rides on the yaw (the card shader ignores rotation)
      bb.add(x, 0, z, (si - 2.5) * 0.9, [w, h, w], col);
    }
    if (!sets.includes(set)) sets.push(set);
  }
  sets.push(bb);
  if (ctx.batch && ctx.batch.eastX !== undefined) bb.gate = { x: ctx.batch.eastX, d: 250 };   // far cards of East Oxford trees: only from within 250 m of the extension
  ctx.stats.trees = total;
  // With WEBGL_multi_draw every near tree of every species is ONE BatchedMesh draw (+ one in the shadow pass) instead of
  // one InstancedMesh per species (up to 5 + 5). The InstanceSets stay as the data store (and as the geometry/material
  // source places/_parks_trees.js looks up by name); their own meshes are simply never shown.
  const nearList = sets.filter((s) => s !== bb);
  let batched = null;
  try {
    const R = ctx.game && ctx.game.renderer;
    if (R && R.extensions && R.extensions.has && R.extensions.has('WEBGL_multi_draw') && THREE.BatchedMesh && nearList.length) {
      const CAP = 1400, geos = nearList.map((s) => s.bands[0].meshes[0].geometry);
      let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
      const mesh = new THREE.BatchedMesh(CAP, nv, ni, M.treeNear);
      mesh.name = 'world:trees:near'; mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.perObjectFrustumCulled = true; mesh.sortObjects = false;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.customDepthMaterial = M.treeDepth;
      const ids = geos.map((g) => mesh.addGeometry(g));
      for (let i = 0; i < CAP; i++) { mesh.addInstance(ids[0]); mesh.setVisibleAt(i, false); }
      scene.add(mesh);
      for (const s of nearList) for (const m of s.meshes) { m.visible = false; m.userData.batched = true; }
      batched = { mesh, ids, used: 0, lastX: 1e9, lastZ: 1e9, cap: CAP };
    }
  } catch (e) { console.warn('[world] tree batching off', e); batched = null; }
  const _m = new THREE.Matrix4(), _c = new THREE.Color();
  function refreshBatched(cx, cz, force) {
    const B = batched; let dirty = force;
    for (const s of nearList) if (s.lastX > 1e8) { dirty = true; s.lastX = 0; }      // clearArea() removed something
    const dx0 = cx - B.lastX, dz0 = cz - B.lastZ;
    if (!dirty && dx0 * dx0 + dz0 * dz0 < 144) return;
    B.lastX = cx; B.lastZ = cz;
    let n = 0, tris = 0;
    for (let k = 0; k < nearList.length; k++) {
      const set = nearList[k], lim = set.bands[0].maxDist * set.bands[0].maxDist, XZ = set.xz, gt = set.bands[0].meshes[0].geometry.index.count / 3;
      for (let i = 0; i < set.n && n < B.cap; i++) {
        const dx = XZ[i * 2] - cx, dz = XZ[i * 2 + 1] - cz;
        if (dx * dx + dz * dz > lim) continue;
        _m.fromArray(set.mat, i * 16);
        B.mesh.setGeometryIdAt(n, B.ids[k]); B.mesh.setMatrixAt(n, _m); B.mesh.setColorAt(n, _c.setRGB(set.col[i * 3], set.col[i * 3 + 1], set.col[i * 3 + 2])); B.mesh.setVisibleAt(n, true);
        n++; tris += gt;
      }
    }
    for (let i = n; i < B.used; i++) B.mesh.setVisibleAt(i, false);
    B.used = n; B.mesh.visible = n > 0 && !B.off; B.mesh.userData.tris = tris;      // (B.off: world/_fx_trees.js is drawing the finer crowns instead)
  }
  return {
    sets,
    get batched() { return !!batched; },
    /** the near trees' one BatchedMesh ({mesh, cap, off}) or null: world/_fx_trees.js stands its finer crowns in for it on the top tier */
    get nearBatch() { return batched; },
    /** near/far switch distance (quality tier) */
    setNear(d) { for (const s of sets) s.bands[0].maxDist = d; if (batched) batched.lastX = 1e9; },
    setFar(d) { bb.bands[bb.bands.length - 1].maxDist = d; },
    refresh(cx, cz, force) {
      if (batched) { bb.refresh(cx, cz, force, 15); refreshBatched(cx, cz, force); }
      else for (const s of sets) s.refresh(cx, cz, force, 15);
    },
  };
}

/**
 * Near-tree material (pass 4): alpha cut-out leaf cards + opaque core + bark from one atlas, Lambert (cheaper per pixel
 * than the pass-3 PBR material, and the near trees no longer sample the shadow map: the occlusion is baked into the
 * vertex colours), instance-tinted crowns, wind sway, light through the leaves when the sun is behind the crown.
 * The cut-out is a manual discard (alphaTest stays 0) so the shadow pass keeps its plain depth shader.
 */
export function treeNearMaterial(tex) {
  const m = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide, name: 'treeNear' });
  // texture pass 2 (top tier): scanned bark over the painted trunk (world/_surf_detail.js 'bark'), mapped in world
  // space from the vertex's place BEFORE the wind moves it, so it does not slide as the tree sways
  const bark = SURF.on && SURF.index.bark !== undefined ? SURF.layers[SURF.index.bark] : null;
  if (bark) m.defines = { ...(m.defines || {}), USE_SURF: '' };
  m.onBeforeCompile = (sh) => {
    if (bark) { sh.uniforms.surfD = SURF.uD; sh.uniforms.surfN = SURF.uN; sh.uniforms.uSurfK = SURF.uK; sh.uniforms.uSurfL = { value: new THREE.Vector4(SURF.index.bark, 1 / bark.metres, bark.albedo, bark.normal) }; }
    sh.uniforms.uSunDirT = U.sunDir; sh.uniforms.uSunColT = U.sunColor; sh.uniforms.uNightT = U.night;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTrunk;\nvarying float vTrunk;\n#ifdef USE_SURF\nvarying vec3 vSurfW;\n#endif')
      .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_SURF\n\t{ vec4 sWp = vec4(position, 1.0);\n#ifdef USE_BATCHING\n\tsWp = batchingMatrix * sWp;\n#endif\n#ifdef USE_INSTANCING\n\tsWp = instanceMatrix * sWp;\n#endif\n\tvSurfW = (modelMatrix * sWp).xyz; }\n#endif')
      .replace('#include <color_vertex>', '#include <color_vertex>\n\tvTrunk = aTrunk;\n#ifdef USE_COLOR\n\tvColor.xyz = mix(vColor.xyz, color.xyz, aTrunk);\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunDirT;\nuniform vec3 uSunColT;\nuniform float uNightT;\nvarying float vTrunk;\n' + SURF_PARS + '#ifdef USE_SURF\nuniform vec4 uSurfL;\nvarying vec3 vSurfW;\n#endif')
      .replace('#include <map_fragment>', '#include <map_fragment>\n\tif (diffuseColor.a < 0.4) discard;\n\tdiffuseColor.a = 1.0;\n#ifdef USE_SURF\n\tif (uSurfK > 0.0 && vTrunk > 0.5) { vec2 sUv = vec2(vSurfW.x + vSurfW.z, vSurfW.y) * uSurfL.y; diffuseColor.rgb *= mix(vec3(1.0), texture(surfD, vec3(sUv, uSurfL.x)).rgb * 2.0, min(uSurfL.z, 1.0) * (1.0 - smoothstep(30.0, 60.0, length(vViewPosition)))); }\n#endif')
      // crown normals point out of the crown whichever way a card faces
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize(vNormal);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		vec3 sv = normalize((viewMatrix * vec4(uSunDirT, 0.0)).xyz);
		vec3 vd = normalize(-vViewPosition);
		float back = pow(max(dot(-vd, sv), 0.0), 4.0);
		totalEmissiveRadiance += diffuseColor.rgb * uSunColT * (back * 0.5 + 0.1 * max(dot(normal, -sv), 0.0)) * (1.0 - vTrunk) * (1.0 - uNightT) * step(0.0, uSunDirT.y);
	}`);
  };
  m.customProgramCacheKey = () => 'treeNear4' + (bark ? 's' : '');
  return m;
}

/**
 * Shadow-pass material of the near trees (pass 7): the plain depth shader, but each leaf card shrinks to a lozenge
 * (vertex shader only; fewer shadow-map pixels than the full quads, nothing sampled). Needs treeModel()'s aCtr.
 */
export function treeDepthMaterial() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.name = 'treeDepth';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aCtr;').replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = mix(transformed, aCtr.xyz, aCtr.w);');
  };
  m.customProgramCacheKey = () => 'treeDepth7';
  return m;
}

/** Far-tree billboards: camera-facing (around world up) cards from a 5-species silhouette atlas, lit like a sphere. */
export function treeBillboardMaterial(baked = null) {
  const m = new THREE.MeshLambertMaterial({ map: baked || makeTreeBillboardTex(), alphaTest: baked ? 0.5 : 0.42, name: 'treeBillboard' });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vBbY;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_INSTANCING
	{
		float sp = floor(atan(-instanceMatrix[0].z, instanceMatrix[0].x) / 0.9 + 3.0);
		vMapUv = vec2((uv.x + sp) / 6.0, uv.y);
	}
#endif`)
      .replace('#include <normal_vertex>', '#include <normal_vertex>\n\tvNormal = normalize(vec3(position.x * 1.5, (position.y - 0.45) * 1.2, 0.75));\n\tvBbY = position.y;')
      .replace('#include <project_vertex>', `
	vec3 bbWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
#ifdef USE_INSTANCING
	{
		vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
		float bw = length(instanceMatrix[0].xyz), bh = length(instanceMatrix[1].xyz);
		vec3 camR = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
		// seen from above (aerial views) the card leans back towards the camera instead of standing edge-on like a fence
		vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
		vec3 bbUp = normalize(vec3(0.0, 1.0, 0.0) + camU * clamp(viewMatrix[1][2] * 2.5 - 0.6, 0.0, 2.0));
		bbWp = c + camR * position.x * bw + bbUp * (position.y * bh);
	}
#endif
	vec4 mvPosition = viewMatrix * vec4(bbWp, 1.0);
	mvPosition.xyz += GTO_DH(bbWp.xz);     // hills (world/terrain.js; the macro comes with <common>)
	gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <worldpos_vertex>', `
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4(bbWp, 1.0);
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBbY;');
  };
  m.customProgramCacheKey = () => 'treeBB6';
  return m;
}
