// Shared kit for the city-centre-west landmarks (places/carfax_tower.js, covered_market.js, oxford_castle.js,
// oxford_station.js). Research: docs/research/city_centre_west.md.
//
//   cwPack(world)   the Radcliffe area's atlas material (_rad_atlas.js: ashlar, rubble, lead, slate, flags, boards, painted
//                   windows and doors) + a few keys of our own (brick, coral rag, paint colours, rail, livery). Sharing the
//                   material means no new shader program anywhere (and nothing new to warm before a flight).
//   shared(game)    ONE level-of-detail mesh (_rad_lod.js) for the static exteriors of all four sites: every module
//                   registers its groups at install; the geometry is assembled on the first update tick, so the four
//                   sites together cost one draw (+ one shadow draw while the player is near one of them).
//   cwSigns(world)  one alpha-tested canvas atlas for the lettering (shown only within a few metres of a board: 1 draw).
//   createPerch()   a walkable look-out (tower roof, mound top) that renders the WORLD scene with its own small collider
//                   and floor height, a first-person view over the parapet (as places/_rad_climb.js does for St Mary's).
// Deterministic: no Math.random anywhere here.
import * as THREE from 'three';
import { Batch, RB, frame, rectPts, archPts, tudorPts } from './_rad_kit.js';
import { radPack, CELL } from './_rad_atlas.js';
import { Lod, geoOf, splitByCell } from './_rad_lod.js';
import { Collider } from '../core/collision.js';
import { markRange } from '../world/util.js';
import { tn } from '../core/features.js';

export { Batch, RB, frame, rectPts, archPts, tudorPts, geoOf, splitByCell };
export const TAU = Math.PI * 2;
export const hash = (a, b = 0, c = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return h - Math.floor(h); };
export const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };

// ------------------------------------------------------------------------------------------------ the pack
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
let PACKED = false;
/** the shared atlas pack with our extra keys (added once to the Radcliffe pack's key map) */
export function cwPack(world) {
  const P = radPack(world);
  if (PACKED) return P;
  PACKED = true;
  const K = P.cells;
  const add = (key, name, m, tint = 0xffffff, o = {}) => { if (!K.has(key)) K.set(key, { cell: CELL[name], rx: m ? 1 / m : 0, ry: m ? 1 / m : 0, ox: 0, oy: 0, tint: Array.isArray(tint) ? tint : lin(tint), seed: 0, ...o }); };
  // masonry: the ashlar cell at a third of its size reads as brick courses; coral rag is the rubble cell, greyer
  add('cwBrick', 'ashlar', 0.9, [0.62, 0.3, 0.24]); add('cwBrickDk', 'ashlar', 0.9, [0.45, 0.22, 0.18]);
  add('cwBuff', 'ashlar', 1.1, [0.95, 0.82, 0.62]);
  add('cwRag', 'rubble', 3.2, [0.86, 0.8, 0.7], { seed: 2.5 }); add('cwRagDk', 'rubble', 3.2, [0.66, 0.6, 0.52], { seed: 2.5 });
  add('cwTower', 'rubble', 3.8, [1.06, 1.0, 0.9], { seed: 3.5 });   // Carfax: weathered coursed stone, three stages
  add('cwTowerA', 'rubble', 3.8, [0.86, 0.8, 0.72], { seed: 3.5 }); add('cwTowerB', 'rubble', 3.8, [1.14, 1.09, 1.0], { seed: 3.5 });
  add('cwStucco', 'plain', 1, 0xe9e1cf); add('cwStuccoWarm', 'plain', 1, 0xe6d6b4);
  // roofs, ground
  add('cwSlate', 'slate', 2.0, [0.8, 0.82, 0.88]); add('cwGlassRoof', 'leaded', 0, [0.55, 0.62, 0.66], { ox: 0.5, oy: 0.55 });
  add('cwGrass', 'plain', 1, [0.12, 0.19, 0.06]); add('cwGrassLt', 'plain', 1, [0.14, 0.21, 0.07]); add('cwGravel', 'flags', 1.2, [0.86, 0.78, 0.62]);
  add('cwBallast', 'rubble', 1.0, [0.5, 0.47, 0.43], { seed: 4.5 }); add('cwSleeper', 'plain', 1, [0.09, 0.075, 0.06]);
  add('cwRail', 'plain', 1, [0.3, 0.29, 0.28]); add('cwRailTop', 'plain', 1, [0.62, 0.62, 0.64]);
  add('cwPlatform', 'flags', 1.2, [0.78, 0.78, 0.8]); add('cwTactile', 'plain', 1, [0.75, 0.62, 0.3]); add('cwEdge', 'plain', 1, [0.92, 0.88, 0.8]);
  add('cwYellow', 'plain', 1, [0.85, 0.62, 0.02]); add('cwConcrete', 'plain', 1, [0.55, 0.54, 0.52]); add('cwTarmac', 'plain', 1, [0.12, 0.12, 0.13]);
  // paint
  add('cwGreen', 'plain', 1, [0.02, 0.09, 0.05]); add('cwGreenLt', 'plain', 1, [0.06, 0.2, 0.1]); add('cwCream', 'plain', 1, [0.86, 0.8, 0.62]);
  add('cwRed', 'plain', 1, [0.42, 0.03, 0.03]); add('cwMaroon', 'plain', 1, [0.2, 0.02, 0.03]); add('cwNavy', 'plain', 1, [0.01, 0.025, 0.09]);
  add('cwDial', 'plain', 1, [0.86, 0.85, 0.8]);   /* Carfax's dial is white (photo comparison), not navy */ add('cwGilt', 'plain', 1, [0.75, 0.48, 0.1]); add('cwBronze', 'plain', 1, [0.25, 0.15, 0.06]);
  add('cwFlesh', 'plain', 1, [0.75, 0.5, 0.36]); add('cwSteel', 'plain', 1, [0.32, 0.35, 0.38]); add('cwSteelLt', 'plain', 1, [0.62, 0.65, 0.68]);
  add('cwWhite', 'plain', 1, [0.85, 0.85, 0.83]); add('cwBlack', 'plain', 1, [0.02, 0.02, 0.022]); add('cwShade', 'plain', 1, [0.03, 0.028, 0.025]);
  add('cwGlass', 'plain', 1, [0.05, 0.07, 0.08]); add('cwGlassLit', 'sash', 1, [0.5, 0.52, 0.5], { ox: 0.42, oy: 0.3, rx: 0.05, ry: 0.05 });
  add('cwTimber', 'boards', 1.2, [0.55, 0.42, 0.3]); add('cwTimberDk', 'boards', 1.2, [0.32, 0.22, 0.14]);
  // livery (generic: no operator's colours) and bikes
  add('cwTrain', 'plain', 1, [0.16, 0.2, 0.26]); add('cwTrainLt', 'plain', 1, [0.62, 0.64, 0.66]); add('cwTrainStripe', 'plain', 1, [0.55, 0.05, 0.05]);
  add('cwTrainWin', 'plain', 1, [0.02, 0.025, 0.03]); add('cwBogie', 'plain', 1, [0.05, 0.05, 0.05]);
  const BIKE = [0x1a1a1c, 0x2d3b6b, 0x7a1a1a, 0x9aa0a6, 0x2b5a3a, 0xc9c2b0, 0x4a2a5a, 0x1f4f6f];
  BIKE.forEach((c, i) => add('cwBike' + i, 'plain', 1, c));
  add('cwTyre', 'plain', 1, [0.015, 0.015, 0.015]);
  // produce / goods colours (market exterior glimpses, and the far LOD)
  for (const [k, c] of Object.entries(GOODS)) add('cwG_' + k, 'plain', 1, c);
  return P;
}
export const GOODS = { apple: 0x9c1c14, orange: 0xe07810, lemon: 0xe8c820, leaf: 0x3d7a28, potato: 0xb08850, carrot: 0xe06a18, aubergine: 0x3a1640, pink: 0xe890b0,
  cream: 0xf4ead0, choc: 0x5a3018, pastry: 0xd0a058, feather: 0x6a4a2a, ham: 0xc06850, flowerR: 0xd02030, flowerY: 0xf0d020, flowerW: 0xf4f0ec, flowerP: 0x9040a0, bucket: 0x404850 };
export const BIKE_KEYS = 8;

/** a copy of a non-indexed geometry without its triangles smaller than minArea m² (radcliffe_square.js farCopy) */
export function farCopy(geo, minArea) {
  const P = geo.attributes.position.array, nT = P.length / 9, keep = [];
  for (let t = 0; t < nT; t++) {
    const o = t * 9, ax = P[o + 3] - P[o], ay = P[o + 4] - P[o + 1], az = P[o + 5] - P[o + 2], bx = P[o + 6] - P[o], by = P[o + 7] - P[o + 1], bz = P[o + 8] - P[o + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (0.5 * Math.hypot(cx, cy, cz) >= minArea) keep.push(t);
  }
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) {
    const sz = a.itemSize, src = a.array, dst = new Float32Array(keep.length * 3 * sz);
    keep.forEach((t, i) => dst.set(src.subarray(t * 3 * sz, (t + 1) * 3 * sz), i * 3 * sz));
    out.setAttribute(name, new THREE.BufferAttribute(dst, sz));
  }
  return out;
}
export const tris = (g) => (g ? g.attributes.position.count / 3 : 0);

/** concatenate non-indexed atlas geometries (same attribute set as Batch.build through the pack) */
export function mergeGeos(geos) {
  geos = geos.filter((g) => g && g.attributes.position.count);
  if (!geos.length) return null;
  if (geos.length === 1) return geos[0];
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const [name, sz] of [['position', 3], ['normal', 3], ['uv', 2], ['aCell', 4], ['aTint', 3], ['aTop', 1]]) {
    const arr = new Float32Array(n * sz); let o = 0;
    for (const g of geos) { const a = g.attributes[name], c = g.attributes.position.count; if (a) arr.set(a.array, o * sz); else if (name === 'aTop') arr.fill(1e4, o, o + c); o += c; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  return out;
}
/** smooth 2D value noise in [0, 1] (deterministic) at scale s metres */
export function vnoise(x, z, s = 8, seed = 0) {
  const fx = x / s, fz = z / s, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const h = (a, b) => hash(a + seed * 17.1, b - seed * 3.3, 1.7);
  const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}
/** rewrite a geometry's per-vertex tint: fn(x, y, z, [r, g, b]) -> [r, g, b] */
export function tintGeo(geo, fn) {
  if (!geo) return geo;
  const P = geo.attributes.position.array, T = geo.attributes.aTint; if (!T) return geo;
  const A = T.array;
  for (let i = 0, n = P.length / 3; i < n; i++) { const r = fn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], [A[i * 3], A[i * 3 + 1], A[i * 3 + 2]]); A[i * 3] = r[0]; A[i * 3 + 1] = r[1]; A[i * 3 + 2] = r[2]; }
  T.needsUpdate = true;
  return geo;
}

// ------------------------------------------------------------------------------------------------ the shared LOD mesh
const SH = new WeakMap();
/**
 * The one draw for the four sites. sites: name -> {bb: [x0, x1, z0, z1]} (for the shadow switch). Modules call
 * S.lod.group(...)/S.lod.cells(...) during install and S.tick() every update; the first tick assembles the mesh.
 * S.dynamic(name, geo) registers a chunk whose vertices a module rewrites (clock hands, the quarter boys' arms):
 * returns {start, count} after finish; write with S.writeDyn(handle, positions, normals).
 */
export function shared(game) {
  let S = SH.get(game);
  if (S) return S;
  const W = game.world, P = cwPack(W), lod = new Lod();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), P.atlas);
  mesh.name = 'cw:atlas'; mesh.frustumCulled = false; mesh.visible = false; mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  game.worldScene.add(mesh);
  S = { lod, mesh, P, sites: new Map(), dyn: [], ready: false, shadow: false, stats: {}, ticker: undefined };
  S.site = (name, bb, r = 60) => { S.sites.set(name, { bb, r }); };
  S.dynamic = (name, geo, groupOpts) => { const h = { name, geo, chunk: null, groupOpts }; S.dyn.push(h); return h; };
  S.finish = () => {
    if (S.ready) return;
    // dynamic chunks: always-drawn groups of their own (small; near only)
    for (const h of S.dyn) {
      const o = h.groupOpts || {}; h.geo.computeBoundingSphere(); const s = h.geo.boundingSphere;
      const g = lod.group('dyn:' + h.name, [s.center.x, s.center.y, s.center.z], s.radius, o.d || [60, 0, 0]);
      h.chunk = g.add(0, h.geo);
      h.count = h.chunk ? h.chunk.count : 0;
    }
    const m = lod.finish(P.atlas);
    mesh.geometry.dispose(); mesh.geometry = m.geometry;
    for (const a of ['position', 'normal']) mesh.geometry.attributes[a].setUsage(THREE.DynamicDrawUsage);
    lod.mesh = mesh;
    S.total = lod.total; S.ready = true;
  };
  S.writeDyn = (h, pos, nor) => {
    if (!S.ready || !h.chunk) return;
    const g = mesh.geometry, A = g.attributes.position, N = g.attributes.normal, o = h.chunk.start * 3, n = Math.min(pos.length, h.chunk.count * 3);
    A.array.set(pos.subarray(0, n), o); if (nor) N.array.set(nor.subarray(0, n), o);
    markRange(A, o, n); if (nor) markRange(N, o, n);      // (never clear: another chunk's write may not be uploaded yet)
  };
  // every module calls tick(id) from its update; the first caller does the work (once a frame)
  S.tick = (id) => {
    if (S.ticker === undefined) S.ticker = id;
    if (id !== S.ticker) { if (!S.ready) S.finish(); return; }
    if (!S.ready) S.finish();
    const cam = game.camera, k = Math.max(0.75, (game.quality && game.quality.dist) || 1);
    lod.update(cam, k, W.aerial ? 4.2 : 1);    // from the air the far silhouettes stay out to ~1.6–2.7 km
    // shadows: only while the player is within 60 m of one of the sites (the sun's box is ±60 m round the player)
    const pp = game.player.place === 'world' ? game.player.pos : cam.position;
    let near = false;
    for (const s of S.sites.values()) { const [x0, x1, z0, z1] = s.bb, bx = Math.max(x0 - pp.x, 0, pp.x - x1), bz = Math.max(z0 - pp.z, 0, pp.z - z1); if (Math.hypot(bx, bz) < s.r) { near = true; break; } }
    if (W.aerial) near = false;
    S.shadow = near; mesh.castShadow = near && mesh.visible;
  };
  SH.set(game, S);
  return S;
}

/** register a site's three levels (geometries, may be null) on a grid of cells, each its own group with distances d */
export function addLevels(S, name, near, mid, far, d, cellM = 40) {
  const L = [near, mid, far].map((g) => (g && g.attributes.position.count ? g : null));
  if (!L[0]) return 0;
  S.lod.cells(name, L, d, {}, cellM);
  S.stats[name] = L.map(tris);
  return tris(L[0]);
}

// ------------------------------------------------------------------------------------------------ lettering
let SIGNS = null;
/** our lettering: {material, uv(name)}. 1024 x 1024, 16 x 16 grid of 64 px. */
export function cwSigns(world) {
  if (SIGNS) return SIGNS;
  const S = 64, N = 16, Wd = S * N;
  const c = document.createElement('canvas'); c.width = Wd; c.height = Wd;
  const g = c.getContext('2d');
  const cells = {};
  const put = (name, col, row, w, h, draw) => {
    g.save(); g.translate(col * S, row * S); g.beginPath(); g.rect(0, 0, w * S, h * S); g.clip(); draw(g, w * S, h * S); g.restore();
    const p = 1.5; cells[name] = [(col * S + p) / Wd, 1 - ((row + h) * S - p) / Wd, ((col + w) * S - p) / Wd, 1 - (row * S + p) / Wd];
  };
  const text = (gg, t, x, y, size, color, font = 'Georgia, "Times New Roman", serif', weight = 'bold') => { gg.fillStyle = color; gg.font = `${weight} ${size}px ${font}`; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(t, x, y); };
  const fit = (gg, t, w, size, font = 'Georgia, serif') => { gg.font = `bold ${size}px ${font}`; const m = gg.measureText(t).width; return m > w ? Math.floor(size * w / m) : size; };
  const board = (name, col, row, w, h, bg, fg, lines, o = {}) => put(name, col, row, w, h, (gg, ww, hh) => {
    if (bg) { gg.fillStyle = bg; gg.fillRect(0, 0, ww, hh); }
    if (o.rule) { gg.strokeStyle = fg; gg.lineWidth = 3; gg.strokeRect(5, 5, ww - 10, hh - 10); }
    const n = lines.length;
    lines.forEach((l, k) => { const font = o.sans ? 'Arial, Helvetica, sans-serif' : 'Georgia, serif'; const sz = fit(gg, l, ww - 24, Math.min(o.size || 40, (hh / n) * 0.72), font); text(gg, l, ww / 2, hh * (k + 0.55) / n, sz, fg, font, k && o.light ? 'normal' : 'bold'); });
  });
  // Covered Market (the real name, plain lettering) and its stall fascias (real names; invented under ?invented=1)
  board('market', 0, 0, 8, 1, '#173322', '#e8d9a8', ['COVERED MARKET'], { rule: true });
  board('marketN', 8, 0, 8, 1, '#173322', '#e8d9a8', ['MARKET  ·  AVENUE 2'], { rule: true });
  STALLS.forEach((s, i) => board('stall' + i, (i % 2) * 8, 1 + (i >> 1), 8, 1, s.bg, s.fg, [s.name], { rule: true }));
  GENERIC.forEach((s, i) => board('gen' + i, (i % 4) * 4, 14 + (i >> 2), 4, 1, s.bg, s.fg, [s.name], { rule: true, size: 30 }));
  // Carfax Tower and the castle
  board('carfax', 0, 7, 4, 2, '#1d2c22', '#efe6cc', ['Carfax Tower', 'Climb to the roof', '99 steps · £2.20'], { light: true, size: 30 });
  board('mound', 4, 7, 4, 2, '#2a2620', '#efe6cc', ['Castle Mound', 'Steps to the top', 'Mind the slope · £1'], { light: true, size: 30 });
  board('castle', 8, 7, 8, 1, '#1a1a1c', '#e0d6bc', ['OXFORD CASTLE'], { rule: true });
  // Castle Quarter c. 2013 (docs/research/real_names.md): Malmaison in the prison blocks, the Living Room (bar and
  // grill; sourced), Prezzo and the courtyard café (guessed); invented names under ?invented=1
  board('hotel', 8, 8, 8, 1, '#141414', '#d8cfa8', [tn('MALMAISON', 'THE OLD GAOL HOTEL')], { size: 34 });
  board('grill', 0, 9, 8, 1, '#3a1a12', '#f0dcb0', [tn('The Living Room', 'The Turnkey Grill')], { size: 34 });
  board('pizza', 8, 9, 8, 1, '#1f3a2a', '#f4ecd8', [tn('Prezzo', 'Cell Block Pizza')], { size: 34 });
  board('cafeC', 0, 10, 8, 1, '#2c2c44', '#efe8d0', [tn('Castleyard Café', 'The Debtors\' Tea Room')], { size: 32 });
  // the station: name boards (no operator, no logo), platform numbers, barriers, departures
  board('oxford', 8, 10, 8, 1, '#0f2a4a', '#ffffff', ['Oxford'], { sans: true, size: 46 });
  board('p1', 0, 11, 2, 2, '#0f2a4a', '#ffffff', ['1'], { sans: true, size: 90 });
  board('p2', 2, 11, 2, 2, '#0f2a4a', '#ffffff', ['2'], { sans: true, size: 90 });
  board('tickets', 4, 11, 4, 1, '#0f2a4a', '#ffffff', ['Tickets · Barriers'], { sans: true });
  board('taxi', 4, 12, 4, 1, '#111111', '#f2c200', ['TAXI RANK'], { sans: true });
  board('departures', 8, 11, 8, 2, '#050505', '#f0a020', ['Departures', 'P2  Banbury    on time', 'P1  Didcot Pkwy  on time'], { sans: true, light: true, size: 30 });
  board('station', 0, 13, 8, 1, '#0f2a4a', '#ffffff', ['Oxford Station'], { sans: true, size: 42 });
  board('bikes', 8, 13, 4, 1, '#ffffff', '#0f2a4a', ['Cycle parking'], { sans: true });
  board('mindgap', 12, 13, 4, 1, '#f2c200', '#111111', ['Mind the gap'], { sans: true });
  // a clock dial with gilt numerals (Carfax's east face)
  put('dial', 12, 7, 2, 2, (gg, w, h) => {
    gg.clearRect(0, 0, w, h); gg.fillStyle = '#0d1f5a'; gg.beginPath(); gg.arc(w / 2, h / 2, w / 2 - 3, 0, TAU); gg.fill();
    gg.strokeStyle = '#d8a83a'; gg.lineWidth = 5; gg.stroke(); gg.beginPath(); gg.arc(w / 2, h / 2, w / 2 - 14, 0, TAU); gg.lineWidth = 2; gg.stroke();
    gg.fillStyle = '#e6bc4a'; gg.font = 'bold 15px Georgia, serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; gg.fillText(R[k], w / 2 + Math.sin(a) * (w / 2 - 28), h / 2 - Math.cos(a) * (w / 2 - 28)); }
    gg.beginPath(); gg.arc(w / 2, h / 2, 6, 0, TAU); gg.fill();
  });
  put('dialPlain', 14, 7, 2, 2, (gg, w, h) => {
    gg.clearRect(0, 0, w, h); gg.fillStyle = '#f4f2ea'; gg.beginPath(); gg.arc(w / 2, h / 2, w / 2 - 3, 0, TAU); gg.fill(); gg.strokeStyle = '#222'; gg.lineWidth = 6; gg.stroke();
    gg.fillStyle = '#222'; for (let k = 0; k < 12; k++) { gg.save(); gg.translate(w / 2, h / 2); gg.rotate((k / 12) * TAU); gg.fillRect(-3, -w / 2 + 10, 6, 16); gg.restore(); }
  });
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, emissive: 0xfff0d8, emissiveMap: texture, emissiveIntensity: 0, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, name: 'cw-signs' });
  try { world.registerNight(material, 0.3); } catch { /* stub */ }
  SIGNS = { texture, material, uv: (n) => cells[n], cells };
  return SIGNS;
}

/** the market's stalls: real names of stalls trading c. 2013 (docs/research/real_names.md: sourced vs guessed), invented
 *  ones under ?invented=1 — shared by the sign atlas and the interior */
export const STALLS = [
  { id: 'butcher', name: tn('M. Feller, Son & Daughter, Butchers', 'Harcourt & Son, Family Butchers'), bg: '#5a1018', fg: '#f6ecd6' },
  { id: 'game', name: tn('Hedges, Game & Poultry', 'Wychwood Game & Poultry'), bg: '#24361e', fg: '#efe2b8' },
  { id: 'grocer', name: tn('Bonners, Greengrocers', 'Cherwell Greengrocers'), bg: '#1f5a2a', fg: '#fff6d8' },
  { id: 'cakes', name: tn('The Cake Shop', 'The Iced Fancy — Celebration Cakes'), bg: '#f2c6d6', fg: '#5a1f3a' },
  { id: 'cookies', name: tn('Ben’s Cookies', 'Hot Cookie Co.'), bg: '#3a2414', fg: '#f6d690' },
  { id: 'pies', name: tn('Pieminister', 'Crust & Gravy Pie Shop'), bg: '#1a2a4a', fg: '#f0e4c0' },
  { id: 'florist', name: tn('The Garden, Florist', 'Petal & Stem Florist'), bg: '#f4f0ea', fg: '#2a5a2a' },
  { id: 'cobbler', name: 'Heel Bar · Keys Cut', bg: '#202020', fg: '#e8c040' },
  { id: 'cafe', name: tn('Brown’s Café', 'The Avenue Café'), bg: '#6a2a1a', fg: '#f6ead0' },
  { id: 'cheese', name: tn('The Oxford Cheese Company', 'Wolvercote Cheese Counter'), bg: '#e8d48a', fg: '#3a2a10' },
  { id: 'fish', name: tn('Haymans Fisheries', 'Isis Fishmongers'), bg: '#1a4a6a', fg: '#eef6fa' },
  { id: 'hats', name: tn('The Hat Box', 'Mad Hatter\'s Hats & Gifts'), bg: '#3a1a4a', fg: '#f2e0f6' },
];

/** the other units along the avenues (generic trades, generic names) */
export const GENERIC = [
  { id: 'tea', name: 'Tea & Coffee', bg: '#2a3a2a', fg: '#efe2c0' }, { id: 'veg', name: 'Fruit & Veg', bg: '#2a5a24', fg: '#f6ecc8' },
  { id: 'jewel', name: 'Jewellery', bg: '#141a2a', fg: '#d8c890' }, { id: 'leather', name: 'Leather Goods', bg: '#4a2a14', fg: '#f0dcb0' },
  { id: 'cards', name: 'Cards & Prints', bg: '#e8e4dc', fg: '#2a2a5a' }, { id: 'deli', name: 'Delicatessen', bg: '#5a4a1a', fg: '#f6ecd0' },
  { id: 'bakery', name: 'Bakery', bg: '#f0dca0', fg: '#4a2a10' }, { id: 'gifts', name: tn('Oxford Gifts', 'Souvenirs'), bg: '#0f2a4a', fg: '#f2e8d0' },
];

/** a quad in the sign material: corners a,b (bottom, left->right seen from the front) and height y0..y1, facing (nx,nz) */
export function signQuad(B, uv, x0, z0, x1, z1, y0, y1, nx, nz, off = 0.02) {
  const ox = nx * off, oz = nz * off;
  B.card('signs', [x0 + ox, y0, z0 + oz], [x1 + ox, y0, z1 + oz], [x1 + ox, y1, z1 + oz], [x0 + ox, y1, z0 + oz], uv);
}

/** the signs of one site as a mesh (material = cwSigns), hidden by default; pts = board centres for the proximity test */
export function signsMesh(B, world, name) {
  const S = cwSigns(world), tmp = new THREE.Group();
  const meshes = B.build({ signs: S.material }, tmp, { noShadow: true });
  const m = meshes[0]; if (!m) return null;
  m.name = 'cw:signs:' + name; m.castShadow = false; m.visible = false;
  const p = m.geometry.attributes.position.array, pts = [];
  for (let i = 0; i < p.length; i += 18) pts.push((p[i] + p[i + 6]) / 2, (p[i + 1] + p[i + 7]) / 2, (p[i + 2] + p[i + 8]) / 2);
  m.userData.pts = pts;
  m.matrixAutoUpdate = false; m.updateMatrix();
  return m;
}
const _fwd = new THREE.Vector3();
/** show a signs mesh only while the camera is within d m of one of its boards and roughly facing it */
export function signsTick(m, camera, d = 25) {
  if (!m) return;
  const pts = m.userData.pts, c = camera.position, R2 = d * d, f = camera.getWorldDirection(_fwd);
  let on = false;
  for (let i = 0; i < pts.length && !on; i += 3) { const dx = pts[i] - c.x, dy = pts[i + 1] - c.y, dz = pts[i + 2] - c.z; on = dx * dx + dy * dy + dz * dz < R2 && dx * f.x + dy * f.y + dz * f.z > -3; }
  if (m.visible !== on) m.visible = on;
}

// ------------------------------------------------------------------------------------------------ look-outs
/**
 * A walkable look-out that renders the world scene. o: {place, area, floorY, outer (closed ring the player stays inside),
 * obstacles: [ring | {c, r}], spawn [x, z], heading, exitPt [x, z], doors: [{pos, facing, price, label}], lines, toast}
 */
export function createPerch(game, o) {
  const col = new Collider();
  col.addPolygon(o.outer);
  for (const ob of o.obstacles || []) { if (Array.isArray(ob)) col.addPolygon(ob); else col.addCircle(ob.c[0], ob.c[1], ob.r); }
  const xs = o.outer.map((p) => p[0]), zs = o.outer.map((p) => p[1]);
  col.bounds = { minX: Math.min(...xs) - 0.2, maxX: Math.max(...xs) + 0.2, minZ: Math.min(...zs) - 0.2, maxZ: Math.max(...zs) + 0.2 };
  const S = { on: false, prevHook: null, hooked: false, door: null, said: 0, entered: 0, headHidden: false };
  const last = { x: o.spawn[0], z: o.spawn[1] };
  const inside = (x, z) => pip(x, z, o.outer) && !(o.obstacles || []).some((ob) => (Array.isArray(ob) ? pip(x, z, ob) : Math.hypot(x - ob.c[0], z - ob.c[1]) < ob.r));
  function guard() {
    if (!S.on) return false;
    const p = game.player.pos;
    if (!inside(p.x, p.z)) { p.x = last.x; p.z = last.z; return true; }
    last.x = p.x; last.z = p.z; return false;
  }
  function showHead(on) { try { const b = game.player.character.bones; if (b && b.head) b.head.visible = on; } catch { /* */ } S.headHidden = !on; }
  function hook(dt, cam) {
    if (!S.on) { if (S.headHidden) showHead(true); return S.prevHook ? S.prevHook(dt, cam) : false; }
    const inp = game.input, p = game.player;
    if (inp.locked) { game.cameraYaw -= inp.mouseDX * 0.0026; game.cameraPitch = Math.max(-0.9, Math.min(1.2, (game.cameraPitch || 0) + inp.mouseDY * 0.0022)); }
    if (!S.headHidden) showHead(false);
    const pitch = game.cameraPitch || 0, cp = Math.cos(pitch), sp = Math.sin(pitch), fx = Math.sin(game.cameraYaw) * cp, fz = Math.cos(game.cameraYaw) * cp;
    const D = p.character && p.character.dims, eye = p.pos.y + (D ? (D.top || 1.7) - 0.1 : 1.6);
    cam.position.set(p.pos.x + fx * 0.12, eye, p.pos.z + fz * 0.12);
    cam.lookAt(p.pos.x + fx * 5, eye - sp * 5, p.pos.z + fz * 5);
    return true;
  }
  function ensureHook() { if (S.hooked) return; S.prevHook = game.cameraHook; game.cameraHook = hook; S.hooked = true; }
  function up() {
    if (S.on) return true;
    ensureHook();
    game.setPlace(o.place, game.worldScene, col, () => o.floorY);
    game.player.teleport(o.spawn[0], o.spawn[1], o.heading || 0); last.x = o.spawn[0]; last.z = o.spawn[1];
    game.cameraYaw = game.player.heading; game.cameraPitch = 0.25;
    S.on = true; S.entered++;
    try { game.ui.area(o.area); game.ui.toast(o.toast + ' ' + o.lines[S.entered % o.lines.length], 7); } catch { /* */ }
    return true;
  }
  function down() {
    if (!S.on) return;
    S.on = false; showHead(true);
    game.setPlace('world', game.worldScene, game.worldCollider, null);
    const d = S.door || o.doors[0];
    game.player.teleport(d.pos[0] + Math.sin(d.facing) * 1.3, d.pos[1] + Math.cos(d.facing) * 1.3, d.facing);
    game.cameraYaw = game.player.heading;
  }
  const fade = (fn) => { try { const r = game.ui.fade(fn); return r && r.then ? r : Promise.resolve(); } catch { fn(); return Promise.resolve(); } };
  for (const d of o.doors) {
    game.interact.add({ place: 'world', pos: d.pos, radius: d.radius || 1.8, label: d.label, onUse: () => {
      const st = game.state || {}, price = d.price || 0;
      if (o.open && !o.open()) { game.ui.toast(o.closedText || 'Closed.', 4); return; }
      if ((st.money ?? 0) < price) { game.ui.toast(`It's £${price.toFixed(2)} to go up. You have £${(st.money ?? 0).toFixed(2)}.`, 4); return; }
      if (price) game.pay(-price);
      S.door = d;
      try { if (o.upText) game.ui.toast(o.upText, 3); } catch { /* */ }
      fade(() => up());
    } });
  }
  game.interact.add({ place: o.place, pos: o.exitPt, radius: 1.4, label: o.downLabel || 'Go back down', onUse: () => fade(() => down()) });
  for (const [k, lk] of (o.lookouts || []).entries()) {
    game.interact.add({ place: o.place, pos: lk.pos, radius: 1.1, label: lk.label, onUse: () => { S.said++; try { game.ui.toast(lk.line || o.lines[(S.said + k) % o.lines.length], 5); } catch { /* */ } game.cameraYaw = lk.heading; game.cameraPitch = lk.pitch ?? 0.3; } });
  }
  return {
    get on() { return S.on; }, up, down, guard, inside, collider: col, floorY: o.floorY,
    debug(on) { if (!S.door) S.door = o.doors[0]; if (on) up(); else down(); return S.on; },
  };
}
