// The Randolph Hotel exterior, hand-built over OSM footprint w130731852 (corner of Beaumont St and Magdalen St).
// Local frame: x along the Beaumont Street front (west -> east), z into the building (north -> south), y up.
// Massing (Historic England 1369325): Beaumont St front 3 + 5 + 3 bays, side bays set forward and one storey higher,
// entrance in the centre; Magdalen St front similar; four storeys + attic, steep slate roofs with gabled dormers.
// The central tower over the entrance is how the 2015 fire reports describe it ("the top peak of the central tower");
// its exact form is a guess. West wing (1952) and the rear wing are plain city-style blocks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Geo, paintMaterial } from './_randolph_kit.js';
import { randolphAtlas, facadeUV, REGION, BANDS } from './_randolph_tex.js';

export const O = [3.6, -3.8], THETA = 0.2593;
const C = Math.cos(THETA), S = Math.sin(THETA);
export const L2W = (x, z) => [O[0] + x * C + z * S, O[1] - x * S + z * C];
export const W2L = (x, z) => { const dx = x - O[0], dz = z - O[1]; return [dx * C - dz * S, dx * S + dz * C]; };
export const L2W3 = (p) => { const w = L2W(p[0], p[2]); return [w[0], p[1], w[1]]; };
export const headingL = (h) => h + THETA;   // local heading -> world heading
export const FRAME = new THREE.Matrix4().makeRotationY(THETA).setPosition(O[0], 0, O[1]);

// key heights / positions (local)
export const H = { eaves: 14.9, pav: 17.9, infill: 8, towerTop: 20.4, peakBase: 23.6, apex: 27.2 };
export const TOWER = { x0: 18.14, x1: 21.96, z0: 0.25, z1: 4.3 };
export const DOOR = [20.05, -0.9];                   // just outside the entrance, under the canopy
export const DUCT = { x: 14.6, z: 13.0, y0: H.infill, y1: 16.6 };
const SPLIT = 11.7;

// ------------------------------------------------------------------------------------------------ helpers
function wall(G, p0, p1, n, y0, y1, bays, cols, topKey = 'wallLow') {
  const rx = n[1], rz = -n[0];
  if ((p1[0] - p0[0]) * rx + (p1[1] - p0[1]) * rz < 0) [p0, p1] = [p1, p0];
  for (let i = 0; i < bays; i++) {
    const a = i / bays, b = (i + 1) / bays;
    const L = [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a], R = [p0[0] + (p1[0] - p0[0]) * b, p0[1] + (p1[1] - p0[1]) * b];
    const col = typeof cols === 'function' ? cols(i) : cols[i % cols.length];
    const segs = [];
    if (y0 < SPLIT) segs.push([y0, Math.min(y1, SPLIT), 'wallLow']);
    if (y1 > SPLIT) segs.push([Math.max(y0, SPLIT), y1, topKey]);
    for (const [h0, h1, key] of segs) G.quadUV(key, [L[0], h0, L[1]], [R[0], h0, R[1]], [R[0], h1, R[1]], [L[0], h1, L[1]], facadeUV(col, h0, h1));
  }
}
/** quad mapped to an atlas rect, seen from outward normal n (3D) */
function panel(G, key, a, b, c, d, rect) { G.quadUV(key, a, b, c, d, rect); }
/** box whose 4 sides each show the whole uv rect (chimneys) */
function boxUV(G, key, x0, y0, z0, x1, y1, z1, rect) {
  G.quadUV(key, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], rect);   // -z
  G.quadUV(key, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], rect);   // +z
  G.quadUV(key, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], rect);   // -x
  G.quadUV(key, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], rect);   // +x
}
/** mansard in a canonical frame: runs along x 0..len, front at z=0 (faces -z), back at z=depth; base y0 */
function mansard(G, len, depth, y0, keyRoof, keyEnd) {
  const yb = y0 + 0.3, yk = y0 + 4.0, yr = y0 + 5.0, zf = -0.3, zb = depth + 0.3, zm = depth / 2;
  const zfk = 0.85, zbk = depth - 0.85;
  G.poly(keyRoof, [[0, yb, zf], [len, yb, zf], [len, yk, zfk], [0, yk, zfk]], [0, 0.3, -1]);
  G.poly(keyRoof, [[0, yk, zfk], [len, yk, zfk], [len, yr, zm], [0, yr, zm]], [0, 1, -0.2]);
  G.poly(keyRoof, [[len, yb, zb], [0, yb, zb], [0, yk, zbk], [len, yk, zbk]], [0, 0.3, 1]);
  G.poly(keyRoof, [[len, yk, zbk], [0, yk, zbk], [0, yr, zm], [len, yr, zm]], [0, 1, 0.2]);
  for (const [x, nx] of [[0, -1], [len, 1]]) G.poly(keyEnd, [[x, yb, zf], [x, yk, zfk], [x, yr, zm], [x, yk, zbk], [x, yb, zb]], [nx, 0, 0]);
  return { slopeZ: (y) => zf + ((y - yb) / (yk - yb)) * (zfk - zf), yb, yk, yr, zm };
}
/** gabled dormer on a mansard front slope (canonical frame, faces -z), centre x */
function dormer(G, xc, y0, faceKey, roofKey) {
  const yb = y0 + 0.35, ysh = yb + 1.85, yap = yb + 2.6, zf = -0.2, w = 1.8;
  const r = REGION.dormer;
  const U = (x) => r[0] + ((w / 2 - (x - xc)) / w) * (r[2] - r[0]), V = (y) => r[1] + ((y - yb) / 2.6) * (r[3] - r[1]);
  const pts = [[xc + w / 2, yb], [xc - w / 2, yb], [xc - w / 2, ysh], [xc, yap], [xc + w / 2, ysh]];
  // fan (convex), front normal -z
  for (let i = 1; i < pts.length - 1; i++) {
    const A = pts[0], B = pts[i], Cc = pts[i + 1];
    G.tri(faceKey, [A[0], A[1], zf], [B[0], B[1], zf], [Cc[0], Cc[1], zf], [U(A[0]), V(A[1])], [U(B[0]), V(B[1])], [U(Cc[0]), V(Cc[1])]);
  }
  const zBack = 0.55;
  for (const s of [-1, 1]) G.poly('stone', [[xc + s * w / 2, yb, zf], [xc + s * w / 2, ysh, zf], [xc + s * w / 2, ysh, zBack]], [s, 0, 0]);
  // little gable roof
  G.push(new THREE.Matrix4()); G.gable(roofKey, xc, zf - 0.15, zBack + 0.6, w + 0.3, ysh - 0.05, yap + 0.12, 'stone'); G.pop();
}
function cresting(G, x0, z0, x1, z1, y) {
  G.color(0x1a1c1e);
  const r = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (let i = 0; i < 4; i++) {
    const a = r[i], b = r[(i + 1) % 4];
    G.beam('paint', [a[0], y + 0.5, a[1]], [b[0], y + 0.5, b[1]], 0.05);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 0.45));
    for (let k = 0; k <= n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; G.beam('paint', [x, y, z], [x, y + (k % 2 ? 0.55 : 0.8), z], 0.035); }
  }
}
function chimney(G, x, z, y0, y1, wdt = 1.4, dep = 0.7) {
  boxUV(G, 'wallLow', x - wdt / 2, y0, z - dep / 2, x + wdt / 2, y1, z + dep / 2, REGION.brick);
  G.box('stone', x - wdt / 2 - 0.08, y1, z - dep / 2 - 0.08, x + wdt / 2 + 0.08, y1 + 0.18, z + dep / 2 + 0.08);
  G.color(0xa0522d);
  for (let i = 0; i < 3; i++) G.cyl('paint', x - wdt / 2 + 0.25 + i * (wdt - 0.5) / 2, y1 + 0.18, z, 0.12, 0.55, 7, 0.09);
}
function brackets(G, p0, p1, n, y) {
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), k = Math.max(2, Math.round(L / 0.9));
  for (let i = 0; i <= k; i++) {
    const t = i / k, x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t;
    G.boxC('stone', x + n[0] * 0.15, y - 0.2, z + n[1] * 0.15, Math.abs(n[0]) > 0.5 ? 0.3 : 0.14, 0.35, Math.abs(n[0]) > 0.5 ? 0.14 : 0.3);
  }
}
function bands(G, p0, p1, n, list) {
  for (const b of list) {
    const ax = Math.min(p0[0], p1[0]), bx = Math.max(p0[0], p1[0]), az = Math.min(p0[1], p1[1]), bz = Math.max(p0[1], p1[1]);
    G.box('stone', ax + Math.min(0, n[0]) * 0.12, b - 0.08, az + Math.min(0, n[1]) * 0.12, bx + Math.max(0, n[0]) * 0.12, b + 0.16, bz + Math.max(0, n[1]) * 0.12, { bottom: true });
  }
}
/** first-floor oriel on a wall at (x,z) along the wall direction d (unit, local), outward n */
function oriel(G, x, z, d, n) {
  const w = 2.3, p = 0.7, y0 = 4.7, y1 = 7.9;
  const P = (s, o, y) => [x + d[0] * s + n[0] * o, y, z + d[1] * s + n[1] * o];
  // front: storey-1 window from the atlas
  const rx = n[1], rz = -n[0], flip = d[0] * rx + d[1] * rz < 0 ? -1 : 1;
  panel(G, 'wallLow', P(-w / 2 * flip, p, y0), P(w / 2 * flip, p, y0), P(w / 2 * flip, p, y1), P(-w / 2 * flip, p, y1), facadeUV(0, 4.75, 7.95));
  for (const s of [-1, 1]) G.poly('stone', [P(s * w / 2, 0, y0), P(s * w / 2, p, y0), P(s * w / 2, p, y1), P(s * w / 2, 0, y1)], [d[0] * s, 0, d[1] * s]);
  // corbel underneath
  G.poly('stone', [P(-w / 2, p, y0), P(w / 2, p, y0), P(0.5, 0, y0 - 0.9), P(-0.5, 0, y0 - 0.9)], [n[0], -1, n[1]]);
  for (const s of [-1, 1]) G.poly('stone', [P(s * w / 2, 0, y0), P(s * w / 2, p, y0), P(s * 0.5, 0, y0 - 0.9)], [d[0] * s, -0.3, d[1] * s]);
  // lead roof
  G.poly('lead', [P(-w / 2 - 0.1, p + 0.1, y1), P(w / 2 + 0.1, p + 0.1, y1), P(w / 2 + 0.1, 0, y1 + 0.6), P(-w / 2 - 0.1, 0, y1 + 0.6)], [n[0], 1, n[1]]);
  for (const s of [-1, 1]) G.poly('lead', [P(s * (w / 2 + 0.1), 0, y1), P(s * (w / 2 + 0.1), p + 0.1, y1), P(s * (w / 2 + 0.1), 0, y1 + 0.6)], [d[0] * s, 0, d[1] * s]);
}

// ------------------------------------------------------------------------------------------------ polygon clip
function clipHalf(poly, nx, nz, d, keepBelow) {
  const out = [], f = (p) => (nx * p[0] + nz * p[1] - d) * (keepBelow ? 1 : -1);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the building
export function buildHotel(game) {
  const world = game.world, mats = world.mats, atlas = randolphAtlas();
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.88, ...o });
  const M = {
    wallLow: std({ map: atlas.map, emissiveMap: atlas.emissive, emissive: 0xffc58a, emissiveIntensity: 0 }),
    wallTop: std({ map: atlas.map, emissiveMap: atlas.emissive, emissive: 0xffc58a, emissiveIntensity: 0 }),
    stone: std({ map: mats.stone.map, color: 0xf3ead8, roughness: 0.92 }),
    slate: mats.slate, roofBurn: mats.slate, peak: mats.slate,
    lead: mats.lead, paint: paintMaterial(), peak2: paintMaterial(),
  };
  world.registerNight(M.wallLow, 1.15);
  const charred = std({ map: mats.slate.map, color: 0x2b2522, roughness: 1 });
  const G = new Geo(); G.push(FRAME);

  // ---- walls (bays: col 0/1 = windows with two lighting variants, col 2 = entrance bay)
  const pavCols = [0, 1, 0], pavH = H.pav, eav = H.eaves;
  // B1 west pavilion
  wall(G, [0, 0], [10.5, 0], [0, -1], 0, pavH, 3, pavCols, 'wallTop');
  wall(G, [0, 0], [0, 13], [-1, 0], 0, pavH, 4, [1, 0]);
  wall(G, [0, 13], [10.5, 13], [0, 1], H.infill, pavH, 3, [0, 1]);
  wall(G, [10.5, 0.6], [10.5, 13], [1, 0], eav, pavH, 3, [0], 'wallTop');
  G.poly('stone', [[10.5, 0, 0], [10.5, 0, 0.6], [10.5, eav, 0.6], [10.5, eav, 0]], [1, 0, 0]);
  // B2 centre (5 bays; the middle one is the tower)
  const bx = [10.5, 14.32, 18.14, 21.96, 25.78, 29.6];
  for (let i = 0; i < 5; i++) if (i !== 2) wall(G, [bx[i], 0.6], [bx[i + 1], 0.6], [0, -1], 0, eav, 1, [i % 2], 'wallTop');
  wall(G, [10.5, 13], [27, 13], [0, 1], H.infill, eav, 4, [1, 0, 0, 1], 'wallTop');
  // tower
  wall(G, [TOWER.x0, TOWER.z0], [TOWER.x1, TOWER.z0], [0, -1], 0, pavH, 1, [2], 'wallTop');
  for (const [x, nx] of [[TOWER.x0, -1], [TOWER.x1, 1]]) {
    G.poly('stone', [[x, 0, TOWER.z0], [x, 0, 0.6], [x, eav, 0.6], [x, eav, TOWER.z0]], [nx, 0, 0]);
    wall(G, [x, TOWER.z0], [x, TOWER.z1], [nx, 0], eav, pavH, 1, [0], 'wallTop');
  }
  wall(G, [TOWER.x0, TOWER.z1], [TOWER.x1, TOWER.z1], [0, 1], eav, pavH, 1, [1], 'wallTop');
  // B3 corner pavilion
  wall(G, [29.6, 0], [40.1, 0], [0, -1], 0, pavH, 3, pavCols);
  wall(G, [40.1, 0], [40.1, 10.5], [1, 0], 0, pavH, 3, [1, 0, 1]);
  wall(G, [29.6, 0.6], [29.6, 10.5], [-1, 0], eav, pavH, 3, [0]);
  G.poly('stone', [[29.6, 0, 0], [29.6, 0, 0.6], [29.6, eav, 0.6], [29.6, eav, 0]], [-1, 0, 0]);
  wall(G, [29.6, 10.5], [39.5, 10.5], [0, 1], eav, pavH, 3, [0]);
  G.poly('stone', [[39.5, 0, 10.5], [40.1, 0, 10.5], [40.1, pavH, 10.5], [39.5, pavH, 10.5]], [0, 0, 1]);
  // B4 Magdalen St centre
  wall(G, [39.5, 10.5], [39.5, 21], [1, 0], 0, eav, 3, [0, 1, 0]);
  wall(G, [27, 13], [27, 21], [-1, 0], H.infill, eav, 2, [1, 0]);
  // B5 south pavilion
  wall(G, [40.1, 21], [40.1, 27.2], [1, 0], 0, pavH, 2, [1, 0]);
  wall(G, [27, 27.2], [40.1, 27.2], [0, 1], 0, pavH, 3, [0, 1, 0]);
  wall(G, [27, 21], [27, 27.2], [-1, 0], H.infill, pavH, 2, [0, 1]);
  wall(G, [27, 21], [39.5, 21], [0, -1], eav, pavH, 3, [1]);
  G.poly('stone', [[39.5, 0, 21], [40.1, 0, 21], [40.1, pavH, 21], [39.5, pavH, 21]], [0, 0, -1]);
  // B6 rear infill (ground + first floor under a flat lead roof)
  const inf = [[0, 13], [27, 13], [27, 28.0], [23.3, 27.8], [3.7, 30.4], [0, 31]];
  for (let i = 0; i < inf.length; i++) {
    const a = inf[i], b = inf[(i + 1) % inf.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (i === 0 || (i === 1)) continue;          // north / east sides are inside the main ranges
    // outward: polygon is clockwise in x-right/z-down view -> outward = (-dz, dx)/L ... check against centroid
    let n = [dz / L, -dx / L]; const mx = (a[0] + b[0]) / 2 - 13, mz = (a[1] + b[1]) / 2 - 21; if (n[0] * mx + n[1] * mz < 0) n = [-n[0], -n[1]];
    wall(G, a, b, n, 0, H.infill, Math.max(1, Math.round(L / 3.6)), [0, 1]);
  }
  { // flat roof over the infill + parapet
    const shape = new THREE.Shape(inf.map(([x, z]) => new THREE.Vector2(x, z)));
    const sg = new THREE.ShapeGeometry(shape), p = sg.attributes.position, idx = sg.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const P = [0, 1, 2].map((k) => [p.getX(idx[i + k]), H.infill + 0.02, p.getY(idx[i + k])]);
      G.poly('lead', P, [0, 1, 0]);
    }
    sg.dispose();
    for (let i = 2; i < inf.length; i++) { const a = inf[i], b = inf[(i + 1) % inf.length]; G.beam('stone', [a[0], H.infill + 0.25, a[1]], [b[0], H.infill + 0.25, b[1]], 0.35, 0.5); }
  }

  // ---- stone dressings: string courses, cornices + brackets, plinths
  const fronts = [ // street fronts: [p0, p1, n, top]
    [[0, 0], [10.5, 0], [0, -1], pavH], [[10.5, 0.6], [18.14, 0.6], [0, -1], eav], [[21.96, 0.6], [29.6, 0.6], [0, -1], eav],
    [[TOWER.x0, TOWER.z0], [TOWER.x1, TOWER.z0], [0, -1], pavH], [[29.6, 0], [40.1, 0], [0, -1], pavH], [[40.1, 0], [40.1, 10.5], [1, 0], pavH],
    [[39.5, 10.5], [39.5, 21], [1, 0], eav], [[40.1, 21], [40.1, 27.2], [1, 0], pavH],
  ];
  for (const [p0, p1, n, top] of fronts) {
    bands(G, p0, p1, n, BANDS.filter((b) => b < top - 0.5));
    brackets(G, p0, p1, n, top);
  }
  const slab = (x0, z0, x1, z1, y, o = 0.35) => G.box('stone', x0 - o, y, z0 - o, x1 + o, y + 0.32, z1 + o, { bottom: true });
  slab(0, 0, 10.5, 13, pavH); slab(29.6, 0, 40.1, 10.5, pavH); slab(27, 21, 40.1, 27.2, pavH);
  slab(10.5, 0.6, 29.6, 13, eav, 0.3); slab(27, 10.5, 39.5, 21, eav, 0.3);
  slab(TOWER.x0, TOWER.z0, TOWER.x1, TOWER.z1, pavH, 0.25);

  // ---- roofs
  const pav = (x0, z0, x1, z1, top, keyR) => {
    const o = 0.35, w = x1 - x0 + 2 * o, d = z1 - z0 + 2 * o, tw = Math.min(3.2, w * 0.3), td = Math.min(5.5, d * 0.42);
    G.hipRoof(keyR, x0 - o, z0 - o, x1 + o, z1 + o, pavH + 0.32, top, (w - tw) / 2, (d - td) / 2);
    cresting(G, x0 - o + (w - tw) / 2, z0 - o + (d - td) / 2, x1 + o - (w - tw) / 2, z1 + o - (d - td) / 2, top);
  };
  pav(0, 0, 10.5, 13, 23.6, 'slate'); pav(29.6, 0, 40.1, 10.5, 23.6, 'slate'); pav(27, 21, 40.1, 27.2, 22.4, 'slate');
  // B2 mansard (the part that burns) with dormers front and back
  G.at(10.5, 0, 0.6, 0);
  mansard(G, 19.1, 12.4, eav, 'roofBurn', 'stone');
  for (const xc of [1.91, 5.73, 13.37, 17.19]) dormer(G, xc, eav, 'wallTop', 'roofBurn');
  G.pop();
  G.push(new THREE.Matrix4().makeRotationY(Math.PI).setPosition(29.6, 0, 13.0));   // back slope: canonical front faces +z
  for (const xc of [1.91, 5.73, 9.55, 13.37, 17.19]) if (Math.abs(29.6 - xc - DUCT.x) > 1.6) dormer(G, xc, eav, 'wallLow', 'roofBurn');
  G.pop();
  // B4 mansard facing Magdalen St (canonical front -> local +x)
  G.push(new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(39.5, 0, 10.5));
  mansard(G, 10.5, 12.5, eav, 'slate', 'stone');
  for (const xc of [1.75, 5.25, 8.75]) dormer(G, xc, eav, 'wallLow', 'slate');
  G.pop();
  // tower top stage (louvred lancets) + spire roof (lower part burns, the peak is destroyed in the fire)
  {
    const { x0, x1, z0, z1 } = TOWER, y0 = pavH + 0.32, y1 = H.towerTop, r = REGION.lancet;
    G.quadUV('wallTop', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], r);
    G.quadUV('wallTop', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], r);
    G.quadUV('wallTop', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], r);
    G.quadUV('wallTop', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], r);
    G.box('stone', x0 - 0.3, y1, z0 - 0.3, x1 + 0.3, y1 + 0.3, z1 + 0.3, { bottom: true });
    const bw = x1 - x0 + 0.5, bd = z1 - z0 + 0.5, k = (H.peakBase - y1 - 0.3) / (H.apex - y1 - 0.3);
    G.hipRoof('roofBurn', x0 - 0.25, z0 - 0.25, x1 + 0.25, z1 + 0.25, y1 + 0.3, H.peakBase, (bw / 2) * k, (bd / 2) * k);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, tw = bw * (1 - k), td = bd * (1 - k);
    G.hipRoof('peak', cx - tw / 2, cz - td / 2, cx + tw / 2, cz + td / 2, H.peakBase, H.apex, tw / 2, td / 2);
    G.color(0x1a1c1e); G.beam('peak2', [cx, H.apex - 0.3, cz], [cx, H.apex + 1.6, cz], 0.09);
    G.color(0xb8963a); G.cyl('peak2', cx, H.apex + 1.0, cz, 0.16, 0.25, 8, 0.16);
    // small corner pinnacles on the stage
    for (const [px, pz] of [[x0 - 0.15, z0 - 0.15], [x1 + 0.15, z0 - 0.15], [x0 - 0.15, z1 + 0.15], [x1 + 0.15, z1 + 0.15]]) {
      G.box('stone', px - 0.2, y1 + 0.3, pz - 0.2, px + 0.2, y1 + 1.2, pz + 0.2);
      G.hipRoof('stone', px - 0.2, pz - 0.2, px + 0.2, pz + 0.2, y1 + 1.2, y1 + 2.0, 0.2, 0.2);
    }
  }
  // chimneys
  chimney(G, 2.4, 7.0, 19.5, 25.4); chimney(G, 8.2, 11.4, 19.0, 24.8); chimney(G, 37.8, 3.2, 19.5, 25.4); chimney(G, 31.6, 8.6, 19.0, 24.8);
  chimney(G, 16.4, 6.8, 18.5, 21.8, 1.6); chimney(G, 26.2, 6.8, 18.5, 21.8, 1.6); chimney(G, 33.25, 13.2, 18.5, 21.6, 0.7, 1.6); chimney(G, 33.25, 18.6, 18.5, 21.6, 0.7, 1.6);
  chimney(G, 30.0, 24.1, 19.0, 24.0);
  // oriels at the sides (first floor)
  oriel(G, 5.25, 0, [1, 0], [0, -1]); oriel(G, 34.85, 0, [1, 0], [0, -1]); oriel(G, 40.1, 5.25, [0, 1], [1, 0]); oriel(G, 40.1, 24.1, [0, 1], [1, 0]);

  // ---- kitchen extract duct up the back wall (the 2015 fire went up a vent from the ground-floor kitchen)
  G.color(0x9aa0a4);
  G.box('paint', DUCT.x - 0.45, DUCT.y0, DUCT.z, DUCT.x + 0.45, DUCT.y1, DUCT.z + 0.8);
  G.box('paint', DUCT.x - 0.6, DUCT.y1, DUCT.z - 0.1, DUCT.x + 0.6, DUCT.y1 + 0.25, DUCT.z + 0.95);
  G.box('paint', DUCT.x - 0.4, DUCT.y0, DUCT.z + 0.8, DUCT.x + 0.4, DUCT.y0 + 0.9, DUCT.z + 2.4); // fan housing on the infill roof

  // ---- entrance canopy, lettering, flags, door lamps
  {
    const x0 = 17.95, x1 = 22.15, zf = -2.85, zb = TOWER.z0, yb = 3.25, yt = 3.8;
    G.color(0x18202c); G.box('paint', x0, yt - 0.05, zf, x1, yt + 0.12, zb, { bottom: true });
    const s = REGION.sign;
    G.quadUV('wallLow', [x1, yb, zf], [x0, yb, zf], [x0, yt, zf], [x1, yt, zf], s);                       // front faces -z (viewer right = -x)
    const half = [s[0], s[1], (s[0] + s[2]) / 2, s[3]];
    G.quadUV('wallLow', [x0, yb, zf], [x0, yb, zb], [x0, yt, zb], [x0, yt, zf], half);
    G.quadUV('wallLow', [x1, yb, zb], [x1, yb, zf], [x1, yt, zf], [x1, yt, zb], half);
    G.color(0x111214); G.box('paint', x0, yb - 0.04, zf, x1, yb, zb);
    for (const x of [x0 + 0.2, x1 - 0.2]) { G.cyl('paint', x, 0, zf + 0.2, 0.07, yb, 8); G.cyl('paint', x, 0, zf + 0.2, 0.13, 0.25, 8); }
    G.color(0x7a1d22); G.box('paint', x0 + 0.3, 0.135, zf + 0.3, x1 - 0.3, 0.16, zb - 0.05);  // red carpet under the canopy (guess)
    // flagpoles above the canopy
    const flags = [[15.6, 'union'], [20.05, 'navy'], [24.5, 'union']];
    for (const [fx, kind] of flags) {
      const base = [fx, 6.6, fx === 20.05 ? TOWER.z0 : 0.6], tip = [fx, 8.9, -2.3];
      G.color(0xe8e8e8); G.beam('paint', base, tip, 0.07);
      G.color(0xc9a24a); G.cyl('paint', tip[0], tip[1] - 0.05, tip[2], 0.09, 0.15, 6, 0.09);
      const t0 = 0.3, t1 = 0.95, A = (t) => [base[0], base[1] + (tip[1] - base[1]) * t, base[2] + (tip[2] - base[2]) * t];
      const a = A(t0), b = A(t1), fh = 1.25, r = REGION[kind];
      // both faces (the flag hangs in the x = fx plane)
      G.quadUV('wallLow', [fx + 0.01, a[1] - fh, a[2]], [fx + 0.01, b[1] - fh, b[2]], [fx + 0.01, b[1], b[2]], [fx + 0.01, a[1], a[2]], r);
      G.quadUV('wallLow', [fx - 0.01, b[1] - fh, b[2]], [fx - 0.01, a[1] - fh, a[2]], [fx - 0.01, a[1], a[2]], [fx - 0.01, b[1], b[2]], [r[2], r[1], r[0], r[3]]);
    }
  }

  const meshes = G.build(M, null, { name: 'randolph', cast: new Set(['wallLow', 'wallTop', 'stone', 'slate', 'roofBurn', 'peak', 'lead']) });
  const group = new THREE.Group(); group.name = 'randolph';
  for (const m of Object.values(meshes)) group.add(m);
  world.addStatic(group);
  // door lanterns
  for (const x of [18.2, 21.9]) { const w = L2W(x, -2.75); world.addLampGlow(w[0], 4.05, w[1]); }

  // ---- west wing (1952 extension, with the carriage arch to the service yard) and the rear wing: city blocks
  const west = [[6.57, 7.4], [3.6, -3.8], [3.6, -3.3], [-7.8, -0.1], [-9.0, 0.1], [-9.5, -0.5], [-18.3, 1.7], [-18.3, 2.3], [-21.1, 2.9], [-19.0, 12.6], [-6.2, 10.1]];
  const rear = [L2W(0, 16.8), [-21.6, 28.3], [-16.9, 38.9], [-13.8, 37.5], L2W(0, 31.0)];
  // the private driveway tunnel w629850480 runs (-7.8,-0.1) -> (-6.2,10.1); keep a 4 m arch open below 4.2 m
  const tn = [0.988, -0.155], td = tn[0] * -7.8 + tn[1] * -0.1;
  const westA = clipHalf(west, tn[0], tn[1], td - 2.0, true), westB = clipHalf(west, tn[0], tn[1], td + 2.0, false);
  const bridge = clipHalf(clipHalf(west, tn[0], tn[1], td + 2.0, true), tn[0], tn[1], td - 2.0, false);
  const style = { wall: 'stone', roof: 'flat', color: '#efe2c0' };
  const parts = [
    world.makeBuilding({ poly: westA, h: 14, style, roof: 'flat', add: false, id: 'randolph-west-a' }),
    world.makeBuilding({ poly: westB, h: 14, style, roof: 'flat', add: false, id: 'randolph-west-b' }),
    world.makeBuilding({ poly: bridge, h: 14, minH: 4.2, style, roof: 'flat', add: false, id: 'randolph-west-arch' }),
    world.makeBuilding({ poly: rear, h: 11, style, roof: 'flat', add: false, id: 'randolph-rear' }),
  ];
  const byMat = new Map();
  for (const g of parts) for (const m of g.children) { if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m.geometry); }
  const wings = new THREE.Group(); wings.name = 'randolph:wings';
  for (const [mat, geos] of byMat) {
    let geo = null;
    try { geo = mergeGeometries(geos, false); } catch (e) { geo = null; }
    if (geo) { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; wings.add(m); }
    else for (const g of geos) { const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; wings.add(m); }
  }
  // arch soffit + dark reveal inside the carriage arch
  {
    const A = new Geo(), dirx = 0.155, dirz = 0.988;
    const a0 = [-7.8 - tn[0] * 1.95, -0.1 - tn[1] * 1.95], a1 = [-7.8 + tn[0] * 1.95, -0.1 + tn[1] * 1.95];
    const L = 12.5, e = (p, t) => [p[0] + dirx * t, p[1] + dirz * t];
    A.color(0x2c2620);
    A.poly('paint', [[a0[0], 4.17, a0[1]], [a1[0], 4.17, a1[1]], [e(a1, L)[0], 4.17, e(a1, L)[1]], [e(a0, L)[0], 4.17, e(a0, L)[1]]], [0, -1, 0]);
    A.color(0x6a6052);
    for (const p of [a0, a1]) A.poly('paint', [[p[0], 0, p[1]], [e(p, L)[0], 0, e(p, L)[1]], [e(p, L)[0], 4.2, e(p, L)[1]], [p[0], 4.2, p[1]]], [p === a0 ? 1 : -1, 0, 0]);
    for (const m of Object.values(A.build({ paint: M.paint }, null, { name: 'randolph-arch' }))) wings.add(m);
  }
  world.addStatic(wings);

  // ---- colliders (world)
  const foot = [[0, 0], [10.5, 0], [10.5, 0.6], [TOWER.x0, 0.6], [TOWER.x0, TOWER.z0], [TOWER.x1, TOWER.z0], [TOWER.x1, 0.6], [29.6, 0.6], [29.6, 0],
    [40.1, 0], [40.1, 10.5], [39.5, 10.5], [39.5, 21], [40.1, 21], [40.1, 27.2], [27, 27.2], [27, 28.0], [23.3, 27.8], [3.7, 30.4], [0, 31]].map(([x, z]) => L2W(x, z));
  const col = game.worldCollider;
  col.addPolygon(foot, { tag: 'building' });
  for (const p of [westA, westB, rear]) if (p.length > 2) col.addPolygon(p, { tag: 'building' });
  for (const x of [17.95 + 0.2, 22.15 - 0.2]) { const w = L2W(x, -2.65); col.addCircle(w[0], w[1], 0.12, { tag: 'post' }); }

  let tris = 0;
  for (const m of [...Object.values(meshes), ...wings.children]) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  return { group, wings, meshes, mats: M, charred, foot, westPolys: [westA, westB, bridge, rear], tris, calls: Object.keys(meshes).length + wings.children.length };
}

// ------------------------------------------------------------------------------------------------ emergency response
/** simple UK fire engine (local frame: faces +z). Keys: 'paint' (vertex colours) and 'blue' (beacons). */
export function fireEngine(G, x, z, ry) {
  G.at(x, 0, z, ry);
  const R = 0xb5121b, W = 1.22;
  G.color(0x18191b); G.box('paint', -1.1, 0.38, -4.2, 1.1, 0.8, 4.3);                         // chassis + bumpers
  G.color(R); G.box('paint', -W, 0.8, -4.2, W, 3.0, 2.3);                                       // body
  G.color(R); G.box('paint', -W, 0.8, 2.3, W, 2.95, 4.25);                                      // crew cab
  G.color(0x1d252d); G.box('paint', -1.05, 1.85, 4.25, 1.05, 2.75, 4.28);                        // windscreen
  for (const s of [-1, 1]) G.box('paint', s * W, 1.85, 2.5, s * (W + 0.02), 2.7, 4.05);       // cab side windows
  G.color(0xb8bcc0);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) G.box('paint', s * W, 1.05, -3.95 + i * 1.5, s * (W + 0.03), 2.8, -2.6 + i * 1.5); // roller shutters
  G.color(0xf2d21a); for (const s of [-1, 1]) G.box('paint', s * W, 0.85, -4.2, s * (W + 0.04), 1.0, 4.25);   // yellow band
  G.color(0xf4f4f4); for (const s of [-1, 1]) G.box('paint', s * W, 1.0, 2.3, s * (W + 0.04), 1.12, 4.25);
  G.color(0xf4f4f0); for (const s of [-1, 1]) G.box('paint', s * 0.75 - 0.15, 1.0, 4.26, s * 0.75 + 0.15, 1.2, 4.3); // headlights
  G.color(0xc8ccd0); for (const s of [-1, 1]) G.box('paint', s * 0.4 - 0.05, 3.05, -4.4, s * 0.4 + 0.05, 3.17, 2.9);  // ladder rails
  for (let k = 0; k < 14; k++) G.box('paint', -0.4, 3.07, -4.2 + k * 0.5, 0.4, 3.13, -4.15 + k * 0.5);
  G.color(0x0c0c0d); for (const zz of [3.1, -2.0, -3.15]) for (const s of [-1, 1]) G.wheel('paint', s * 1.07 - 0.17, 0.52, zz, 0.52, 0.34, 12);
  G.color(0xffffff); G.box('blue', -0.95, 2.95, 3.55, 0.95, 3.15, 3.85); for (const s of [-1, 1]) G.box('blue', s * 0.95 - 0.13, 3.0, -4.15, s * 0.95 + 0.13, 3.25, -3.9);
  G.box('blue', -0.6, 1.25, 4.27, -0.42, 1.38, 4.31); G.box('blue', 0.42, 1.25, 4.27, 0.6, 1.38, 4.31);
  G.pop();
}
/** police tape between posts (alternating red/white segments), local coords */
export function tape(G, a, b, y = 0.95) {
  G.color(0x2a2a2a); for (const p of [a, b]) G.cyl('paint', p[0], 0, p[1], 0.04, y + 0.1, 6);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(L / 0.35));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, sag = (t) => -0.12 * 4 * t * (1 - t);
    G.color(i % 2 ? 0xf4f4f4 : 0xd81e1e);
    G.beam('paint', [a[0] + (b[0] - a[0]) * t0, y + sag(t0), a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, y + sag(t1), a[1] + (b[1] - a[1]) * t1], 0.008, 0.07);
  }
}
