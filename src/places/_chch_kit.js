// Shared kit for the south-east landmark modules (christ_church.js, botanic_garden.js, magdalen.js): a few shared
// materials built from world.mats, octagonal prisms / ogee caps / battlements / window recesses for a Batch
// (places/_worcester_kit.js), and a builder that turns a Batch into a handful of named, static, shadow-casting meshes.
// Deterministic, no Math.random. Geometry helpers work in the Batch's current frame (B.push(matrix) first).
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts, tudorPts } from './_worcester_kit.js';

export { Batch, frame, rectPts, archPts, tudorPts };

/** small integer hash -> [0,1) */
export function hh(a, b = 0, c = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const pointInPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < ((P[j][0] - P[i][0]) * (z - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
export const dseg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
export const distToPoly = (x, z, P) => { let d = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; d = Math.min(d, dseg(x, z, a[0], a[1], b[0], b[1])); } return d; };

/** a local frame (u along `dir`, v = u rotated +90°, i.e. (-dz, dx)) about origin o: toW(u, v) / toL(x, z) / heading */
export function localFrame(o, dir) {
  const L = Math.hypot(dir[0], dir[1]), ux = dir[0] / L, uz = dir[1] / L, vx = -uz, vz = ux;
  return {
    o, ux, uz, vx, vz,
    toW: (u, v) => [o[0] + u * ux + v * vx, o[1] + u * uz + v * vz],
    toL: (x, z) => { const dx = x - o[0], dz = z - o[1]; return [dx * ux + dz * uz, dx * vx + dz * vz]; },
    /** game heading of local direction (du, dv) */
    heading: (du, dv) => Math.atan2(du * ux + dv * vx, du * uz + dv * vz),
    /** Matrix4: local x = u, local z = v, y up (for Batch.push) */
    matrix: (y = 0) => new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(vx, 0, vz)).setPosition(o[0], y, o[1]),
  };
}

let _mats = null;
/** shared exterior materials (lazily, once): honey ashlar, paler Clipsham, lead, paving, lawn, gravel, iron, dark glazing … */
export function seMats(world) {
  if (_mats) return _mats;
  const M = world.mats, std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  const tint = (m, c) => { const k = m.clone(); k.color = new THREE.Color(c); return k; };
  const win = std({ color: 0x1d2228, roughness: 0.25, metalness: 0.3, emissive: 0x000000 });
  world.registerWindows(new THREE.Mesh(new THREE.BufferGeometry(), win), 0.9);
  _mats = {
    stone: M.stone, stonePale: tint(M.stone, 0xf4ecdc), stoneWarm: tint(M.stone, 0xe8d2a8), stoneDark: tint(M.stone, 0x8a7a62),
    bark: M.bark, lead: M.lead, slate: M.slate, paving: M.paving, gravel: M.gravel, lawn: M.lawnStriped, grass: M.grass, soil: M.soil, flowerbed: M.flowerbed,
    iron: M.iron, brass: M.brass, darkWood: M.darkWood, wood: M.wood, whitePaint: M.whitePaint, blackPaint: M.blackPaint, hedge: M.hedge,
    win, shadow: std({ color: 0x2a2520, roughness: 1 }),
    gilt: std({ color: 0xc9a24a, metalness: 0.75, roughness: 0.35 }),
    bronze: std({ color: 0x4a3a26, metalness: 0.6, roughness: 0.45 }),
    glass: std({ color: 0xcfe6e8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
    whiteFrame: std({ color: 0xf2f2ee, roughness: 0.5 }),
    leaf: std({ color: 0x3f6a2c, roughness: 0.9, side: THREE.DoubleSide }),
    leafDark: std({ color: 0x24401c, roughness: 0.9 }),
    padGreen: std({ color: 0x3f7a30, roughness: 0.7, side: THREE.DoubleSide }),
    flowerPink: std({ color: 0xe9a6c8, roughness: 0.8 }), flowerWhite: std({ color: 0xf6f2e8, roughness: 0.8 }), flowerPurple: std({ color: 0x8a5bb0, roughness: 0.8 }),
    cactus: std({ color: 0x5f8a4a, roughness: 0.8 }), sand: std({ color: 0xd8c49a, roughness: 1 }),
    pondWater: std({ color: 0x24392e, roughness: 0.08, metalness: 0.2 }),
  };
  return _mats;
}

/** merge Batch parts by alias {from: to} (fewer materials = fewer draws) */
export function aliasParts(B, alias) {
  for (const [from, to] of Object.entries(alias || {})) {
    const P = B.parts.get(from); if (!P || from === to) continue;
    const Q = B._p(to); for (const k of ['pos', 'nor', 'uv']) { const a = P[k], q = Q[k]; for (let i = 0; i < a.length; i++) q.push(a[i]); }
    B.parts.delete(from);
  }
}
let _mono = null;
/** ONE material for a whole showpiece: the ashlar texture times a per-vertex colour (lead, gilt, glazing are tints) */
export function monoMaterial(world) {
  if (_mono) return _mono;
  _mono = new THREE.MeshStandardMaterial({ map: world.mats.stone.map, vertexColors: true, roughness: 0.82, name: 'se:mono' });
  return _mono;
}
const KEY_TINT = { stone: [1, 1, 1], stonePale: [1.06, 1.04, 0.98], stoneWarm: [1.02, 0.94, 0.8], stoneDark: [0.55, 0.5, 0.42], lead: [0.42, 0.44, 0.47], slate: [0.32, 0.34, 0.38],
  win: [0.09, 0.1, 0.12], shadow: [0.16, 0.14, 0.12], gilt: [1.25, 0.95, 0.42], iron: [0.12, 0.12, 0.13], bronze: [0.32, 0.25, 0.17], whitePaint: [1.5, 1.5, 1.45], blackPaint: [0.06, 0.06, 0.06],
  paving: [0.9, 0.88, 0.84], whiteFrame: [1.6, 1.6, 1.55], leaf: [0.32, 0.56, 0.24], leafDark: [0.18, 0.32, 0.15], padGreen: [0.34, 0.6, 0.28], lawn: [0.38, 0.62, 0.28],
  flowerPink: [1.45, 0.72, 1.05], flowerPurple: [0.72, 0.46, 1.05], flowerWhite: [1.5, 1.5, 1.45], darkWood: [0.42, 0.28, 0.18], bark: [0.42, 0.32, 0.24], soil: [0.38, 0.28, 0.2],
  sand: [1.15, 1.0, 0.74], cactus: [0.42, 0.66, 0.32], pondWater: [0.2, 0.32, 0.27] };
/** Batch -> ONE mesh (monoMaterial) with vertex colours by key; returns [mesh] */
export function buildMono(B, world, parent, name, opts = {}) {
  let n = 0; for (const P of B.parts.values()) n += P.pos.length / 3;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  let o = 0;
  for (const [key, P] of B.parts) {
    const t = KEY_TINT[key] || [1, 1, 1], k = P.pos.length / 3;
    pos.set(P.pos, o * 3); nor.set(P.nor, o * 3); uv.set(P.uv, o * 2);
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = t[0]; col[(o + i) * 3 + 1] = t[1]; col[(o + i) * 3 + 2] = t[2]; }
    o += k;
  }
  B.parts.clear();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere(); g.computeBoundingBox();
  const m = new THREE.Mesh(g, monoMaterial(world)); m.name = name; m.castShadow = opts.cast !== false; m.receiveShadow = true;
  m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m);
  return [m];
}

/** Batch -> meshes named prefix + key, static, under `parent` (castShadow per opts.noCast set; opts.alias merges keys;
 *  opts.mono = world: everything in ONE vertex-coloured mesh instead) */
export function buildMeshes(B, mats, parent, prefix, opts = {}) {
  if (opts.mono && !opts.keep) return buildMono(B, opts.mono, parent, prefix + 'mono');
  if (opts.mono) {
    // keys in opts.keep stay separate meshes (glass); the rest go into ONE vertex-coloured mesh
    const K = new Batch(); for (const k of opts.keep) { const P = B.parts.get(k); if (P) { K.parts.set(k, P); B.parts.delete(k); } }
    const out = buildMono(B, opts.mono, parent, prefix + 'mono');
    return out.concat(buildMeshes(K, mats, parent, prefix, { noCast: opts.keep }));
  }
  if (opts.alias) aliasParts(B, opts.alias);
  const out = B.build(mats, parent, { noCast: opts.noCast });
  for (const m of out) {
    const key = m.name.replace(/^worcester:/, '');
    m.name = prefix + key;
    if (opts.noShadow || (opts.noCast && opts.noCast.has(key))) m.castShadow = false;
    if (m.material === mats.glass) { m.renderOrder = 2; m.castShadow = false; }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ geometry helpers
/** n-sided prism round (cx, cz), circumradius r, y0..y1 (rot: phase of the first corner) — walls (+ top if cap) */
export function prism(B, key, cx, cz, r, y0, y1, n = 8, { rot = Math.PI / 8, cap = true, r1 = r } = {}) {
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
    const p = (a, rr, y) => [cx + Math.sin(a) * rr, y, cz + Math.cos(a) * rr];
    const am = (a0 + a1) / 2;
    B.poly(key, [p(a0, r, y0), p(a1, r, y0), p(a1, r1, y1), p(a0, r1, y1)], [Math.sin(am), 0, Math.cos(am)]);
    if (cap) B.poly(key, [[cx, y1, cz], p(a0, r1, y1), p(a1, r1, y1)], [0, 1, 0]);
  }
}
/** a lathe of an n-sided section through profile [[r, y], …] (bottom to top) round (cx, cz): ogee caps, domes, finials */
export function lathe(B, key, cx, cz, prof, n = 8, rot = Math.PI / 8) {
  for (let k = 0; k < prof.length - 1; k++) {
    const [ra, ya] = prof[k], [rb, yb] = prof[k + 1];
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
      const p = (a, rr, y) => [cx + Math.sin(a) * rr, y, cz + Math.cos(a) * rr];
      const nr = yb - ya, ny = ra - rb, nl = Math.hypot(nr, ny) || 1;
      const hint = [Math.sin(am) * nr / nl, ny / nl, Math.cos(am) * nr / nl];
      if (rb < 1e-4) B.poly(key, [p(a0, ra, ya), p(a1, ra, ya), [cx, yb, cz]], hint);
      else if (ra < 1e-4) B.poly(key, [[cx, ya, cz], p(a1, rb, yb), p(a0, rb, yb)], hint);
      else B.poly(key, [p(a0, ra, ya), p(a1, ra, ya), p(a1, rb, yb), p(a0, rb, yb)], hint);
    }
  }
}
/** an ogee profile: base radius r at y0, swelling to r*bulge, then the concave neck to a point at y0 + h */
export function ogeeProfile(r, y0, h, bulge = 1.08, steps = 7) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // convex lower part (t < 0.55) then concave neck: a sine S-curve on radius
    const rr = t < 0.55 ? r * (1 + (bulge - 1) * Math.sin((t / 0.55) * Math.PI)) * (1 - 0.35 * (t / 0.55) * (t / 0.55)) : r * 0.65 * Math.pow((1 - t) / 0.45, 1.6);
    out.push([Math.max(0, rr), y0 + h * t]);
  }
  out[out.length - 1][0] = 0;
  return out;
}
/** battlements along a straight edge in the current frame: from (x0,z0) to (x1,z1) at y, merlon w×h, wall thickness t */
export function crenels(B, key, x0, z0, x1, z1, y, { mw = 0.7, gap = 0.6, h = 0.75, t = 0.4, base = 0.5 } = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.5) return;
  const ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(ux, uz) - Math.PI / 2;
  const n = Math.max(1, Math.floor((L + gap) / (mw + gap))), pad = (L - (n * mw + (n - 1) * gap)) / 2;
  B.box(key, (x0 + x1) / 2, y + base / 2, (z0 + z1) / 2, L, base, t, ry);
  for (let i = 0; i < n; i++) { const s = pad + i * (mw + gap) + mw / 2; B.box(key, x0 + ux * s, y + base + h / 2, z0 + uz * s, mw, h, t, ry); }
}
/** a recessed window on a wall frame (pushed: wall in the XY plane facing +z): outline pts, depth d (reveals + glass) */
export function recess(B, pts, d = 0.3, glassKey = 'win', revealKey = 'stone') {
  B.reveal(revealKey, pts, 0, -d);
  B.face(glassKey, pts, [], -d);
}
/** pointed (two-centred) arch outline: width w centred at x, sill y0, springing ys, apex rise k*w */
export function pointedPts(x, w, y0, ys, k = 0.85, seg = 6) {
  const r = w * k, p = [[x - w / 2, y0], [x + w / 2, y0], [x + w / 2, ys]];
  // right arc centred at (x + w/2 - r, ys) from angle 0 up to the apex; left mirrored
  const cR = x + w / 2 - r, ax = Math.acos(Math.min(1, (x - cR) / r));
  for (let i = 1; i <= seg; i++) { const a = (ax * i) / seg; p.push([cR + Math.cos(a) * r, ys + Math.sin(a) * r]); }
  const apexY = ys + Math.sin(ax) * r;
  p[p.length - 1] = [x, apexY];
  for (let i = seg - 1; i >= 1; i--) { const a = (ax * i) / seg; p.push([x - (cR + Math.cos(a) * r - x), ys + Math.sin(a) * r]); }
  p.push([x - w / 2, ys]);
  return p;
}
/** a wall slab in the current frame from (x0,z0) to (x1,z1), y0..y1, thickness t (axis-free box) */
export function slab(B, key, x0, z0, x1, z1, y0, y1, t = 0.5) {
  const L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-3) return;
  B.box(key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, L, y1 - y0, t, Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2);
}
/** a simple standing figure (statue) of boxes/prisms centred at (x, y, z) facing +z, height h */
export function statue(B, key, x, y, z, h = 1.8, ry = 0, pose = 'stand') {
  const s = h / 1.8, c = Math.cos(ry), sn = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  const bx = (lx, ly, lz, w, hh2, d) => { const p = P(lx, lz); B.box(key, p[0], y + ly * s, p[1], w * s, hh2 * s, d * s, ry); };
  bx(-0.1, 0.42, 0, 0.13, 0.84, 0.15); bx(0.1, 0.42, pose === 'run' ? 0.12 : 0, 0.13, 0.84, 0.15);    // legs
  bx(0, 1.12, 0, 0.42, 0.6, 0.24);                                                                // torso
  const hp = P(0, 0.01); prism(B, key, hp[0], hp[1], 0.11 * s, y + 1.46 * s, y + 1.72 * s, 6);      // head
  if (pose === 'mercury') { bx(-0.28, 1.15, 0, 0.1, 0.55, 0.1); const a = P(0.24, 0); B.box(key, a[0], y + 1.62 * s, a[1], 0.09 * s, 0.6 * s, 0.09 * s, ry); const f = P(0.24, 0); prism(B, key, f[0], f[1], 0.02 * s, y + 1.9 * s, y + 2.25 * s, 4); }
  else { bx(-0.27, 1.05, 0, 0.1, 0.6, 0.11); bx(0.27, 1.05, 0, 0.1, 0.6, 0.11); }
}
/** a mown lawn / paved / any flat polygon at y (world coords; no frame) */
export function flatPoly(B, key, poly, y, holes = []) { B.flat(key, poly, y, holes); }

/** distance culling for merged showpiece meshes (core/cull.js leaves meshes bigger than 45 m radius alone):
 *  groups = [{meshes, c: [x, z], r, air?, W?}] — visible while outdoors and the camera is within r of c (8 m hysteresis);
 *  with air and W (the world) set, within max(r, air) while W.aerial */
export function distCull(groups, cam, outdoors) {
  for (const g of groups) {
    // (g.air + g.W: while world.aerial the group stays on out to g.air metres — a landmark seen from a glider)
    const R = g.air && g.W && g.W.aerial ? Math.max(g.r, g.air) : g.r;
    const d = Math.hypot(cam.x - g.c[0], cam.z - g.c[1]), on = outdoors && d < (g.on ? R + 8 : R);
    if (on !== g.on) { g.on = on; for (const m of g.meshes) m.visible = on; }
  }
}
