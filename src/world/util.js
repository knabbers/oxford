// Shared helpers for the world renderer: seeded RNG, polygon maths, a spatial hash, raw geometry buffers and the
// tile batcher that merges static geometry into ~250 m tiles (so frustum/distance culling still works).
import * as THREE from 'three';
import { terrainSubdivide, terrainRigid, terrainTol, TERRAIN } from './terrain.js';
import { buildStack, updateStacks } from './_terrain_lod.js';
// (terrain: the ground's upper layers are ordered by drawing and do not write depth; they share the base ground's material)
function stackNoDepth(r, s, c, g, material) { material._gtoDW = material.depthWrite; material.depthWrite = false; }
function stackDepth(r, s, c, g, material) { material.depthWrite = material._gtoDW !== false; }

// ---------------------------------------------------------------- RNG / hashing
export function hashStr(s) {
  s = String(s);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
/** 0..1 deterministic hash of anything stringifiable. */
export const hash01 = (s) => hashStr(s) / 4294967296;
export function hash2(x, z) {
  let h = Math.imul((x * 73856093) | 0, 0x27d4eb2d) ^ Math.imul((z * 19349663) | 0, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
/** Seeded RNG (mulberry32). rng() -> [0,1); rng.range(a,b), rng.int(a,b) inclusive, rng.pick(arr), rng.chance(p). */
export function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
  const r = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length) % arr.length];
  r.chance = (p) => r() < p;
  return r;
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- polygons ([x,z] arrays, open rings)
export function signedArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) { const q = p[i], r = p[(i + 1) % n]; a += q[0] * r[1] - r[0] * q[1]; }
  return a / 2;
}
export function polyCentroid(p) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[i], r = p[(i + 1) % n], f = q[0] * r[1] - r[0] * q[1];
    a += f; cx += (q[0] + r[0]) * f; cz += (q[1] + r[1]) * f;
  }
  if (Math.abs(a) < 1e-6) { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; }
  return [cx / (3 * a), cz / (3 * a)];
}
export function pointInPoly(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function polyBounds(p) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const q of p) { if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0]; if (q[1] < minZ) minZ = q[1]; if (q[1] > maxZ) maxZ = q[1]; }
  return { minX, maxX, minZ, maxZ };
}
/** Remove duplicate/near-duplicate consecutive points. */
export function cleanRing(p, eps = 0.05) {
  const out = [];
  for (const q of p) { const l = out[out.length - 1]; if (!l || Math.abs(l[0] - q[0]) > eps || Math.abs(l[1] - q[1]) > eps) out.push(q); }
  while (out.length > 1) { const a = out[0], b = out[out.length - 1]; if (Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps) out.pop(); else break; }
  return out;
}
export function cleanLine(p, eps = 0.05) {
  const out = [];
  for (const q of p) { const l = out[out.length - 1]; if (!l || Math.abs(l[0] - q[0]) > eps || Math.abs(l[1] - q[1]) > eps) out.push(q); }
  return out;
}
/**
 * Minimum-area oriented bounding box (tests each edge direction).
 * -> {cx, cz, ux, uz (unit long axis), vx, vz (unit short axis), hl (half length), hw (half width), area, rect (poly area / box area)}
 */
export function obb(p) {
  let best = null;
  const pa = Math.abs(signedArea(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    let ux = b[0] - a[0], uz = b[1] - a[1];
    const l = Math.hypot(ux, uz); if (l < 0.3) continue;
    ux /= l; uz /= l;
    const vx = -uz, vz = ux;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of p) { const u = q[0] * ux + q[1] * uz, v = q[0] * vx + q[1] * vz; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, ux, uz, vx, vz, u0, u1, v0, v1 };
  }
  if (!best) { const c = polyCentroid(p); return { cx: c[0], cz: c[1], ux: 1, uz: 0, vx: 0, vz: 1, hl: 0.5, hw: 0.5, area: 1, rect: 0 }; }
  let { ux, uz, vx, vz, u0, u1, v0, v1 } = best;
  if (u1 - u0 < v1 - v0) { // make u the long axis
    [ux, uz, vx, vz] = [vx, vz, -ux, -uz];
    [u0, u1, v0, v1] = [v0, v1, -u1, -u0];
  }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  return { cx: ux * cu + vx * cv, cz: uz * cu + vz * cv, ux, uz, vx, vz, hl: (u1 - u0) / 2, hw: (v1 - v0) / 2, area: best.area, rect: pa / Math.max(1e-6, best.area) };
}
export function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + dx * t - px, z = az + dz * t - pz;
  return Math.sqrt(x * x + z * z);
}
export function polylineLength(pts) {
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L;
}
/** Sub-polyline between arc lengths s0..s1. */
export function slicePolyline(pts, s0, s1) {
  const out = []; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l <= 0) continue;
    const e = acc + l;
    if (e >= s0 && acc <= s1) {
      const t0 = Math.max(0, (s0 - acc) / l), t1 = Math.min(1, (s1 - acc) / l);
      const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      if (!out.length) out.push(p0);
      out.push([a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]);
    }
    acc = e;
    if (acc > s1) break;
  }
  return cleanLine(out, 0.01);
}
/** Douglas-Peucker: drop the points of a polyline that lie within tol (m) of the simplified line; the ends stay. */
export function simplifyLine(pts, tol) {
  const n = pts.length; if (n < 3) return pts;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const st = [0, n - 1];
  while (st.length) {
    const b = st.pop(), a = st.pop(); let m = -1, md = tol;
    for (let i = a + 1; i < b; i++) { const d = distToSeg(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]); if (d > md) { md = d; m = i; } }
    if (m >= 0) { keep[m] = 1; st.push(a, m, m, b); }
  }
  return pts.filter((_, i) => keep[i]);
}
/** The same for an open ring ([x,z]…, last != first): split at the point farthest from point 0, simplify both halves. */
export function simplifyRing(ring, tol) {
  const n = ring.length; if (n < 5) return ring;
  let k = 1, md = -1; for (let i = 1; i < n; i++) { const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > md) { md = d; k = i; } }
  const a = simplifyLine(ring.slice(0, k + 1), tol), b = simplifyLine(ring.slice(k).concat([ring[0]]), tol);
  const out = a.concat(b.slice(1, -1));
  return out.length >= 3 ? out : ring;
}
/** Point + unit direction at arc length s along a polyline. */
export function pointAt(pts, s) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l <= 0) continue;
    if (acc + l >= s || i === pts.length - 1) {
      const t = clamp((s - acc) / l, 0, 1);
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / l, dz: (b[1] - a[1]) / l };
    }
    acc += l;
  }
  const p = pts[pts.length - 1]; return { x: p[0], z: p[1], dx: 1, dz: 0 };
}
/** Offset a polyline sideways by d (positive = left of travel, i.e. (-dz, dx)), mitred joins (clamped). */
export function offsetLine(pts, d) {
  const n = pts.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const [nx, nz, m] = miterAt(pts, i);
    out[i] = [pts[i][0] + nx * d * m, pts[i][1] + nz * d * m];
  }
  return out;
}
/** Unit miter normal at vertex i (left side) and its length factor. */
export function miterAt(pts, i) {
  const n = pts.length;
  const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[Math.min(n - 1, i + 1)];
  let d1x = b[0] - a[0], d1z = b[1] - a[1], d2x = c[0] - b[0], d2z = c[1] - b[1];
  let l1 = Math.hypot(d1x, d1z), l2 = Math.hypot(d2x, d2z);
  if (l1 < 1e-6) { d1x = d2x; d1z = d2z; l1 = l2; }
  if (l2 < 1e-6) { d2x = d1x; d2z = d1z; l2 = l1; }
  if (l1 < 1e-6) return [0, 1, 1];
  d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
  const n1x = -d1z, n1z = d1x, n2x = -d2z, n2z = d2x;
  let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
  if (ml < 1e-6) return [n1x, n1z, 1];
  mx /= ml; mz /= ml;
  const cos = mx * n1x + mz * n1z;
  return [mx, mz, Math.min(2.5, 1 / Math.max(0.2, cos))];
}

// ---------------------------------------------------------------- spatial hash
export class SpatialGrid {
  constructor(cell = 40) { this.cell = cell; this.map = new Map(); this.stamp = 1; }
  _k(ix, iz) { return (ix + 32768) * 65536 + (iz + 32768); }
  insertBox(minX, minZ, maxX, maxZ, item) {
    const c = this.cell, x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c), z0 = Math.floor(minZ / c), z1 = Math.floor(maxZ / c);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = this._k(ix, iz); let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(item);
    }
  }
  insertSeg(ax, az, bx, bz, item) { this.insertBox(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), item); }
  insertPoint(x, z, item) { this.insertBox(x, z, x, z, item); }
  /** cb(item) for every item in cells overlapping the box; each item at most once. Return true from cb to stop. */
  query(minX, minZ, maxX, maxZ, cb) {
    const st = ++this.stamp, c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c), z0 = Math.floor(minZ / c), z1 = Math.floor(maxZ / c);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const a = this.map.get(this._k(ix, iz)); if (!a) continue;
      for (let i = 0; i < a.length; i++) { const it = a[i]; if (it._qs === st) continue; it._qs = st; if (cb(it)) return; }
    }
  }
  queryRadius(x, z, r, cb) { this.query(x - r, z - r, x + r, z + r, cb); }
}

// ---------------------------------------------------------------- raw geometry buffer
/**
 * Accumulates indexed triangles. Optional per-vertex attributes:
 *   cell (vec4 aCell: atlas cell A, cell B, probability of B per bay, seed) and tint (vec3 aTint) — used by atlas materials,
 *   color (vec3 'color') — for vertexColors materials, edge (float aEdge) — water.
 * Set the "current" cell/tint/color with setCell/setTint/setColor before adding vertices.
 */
export class GeoBuf {
  constructor(opts = {}) {
    this.pos = []; this.nor = []; this.uv = []; this.idx = [];
    this.cell = opts.cell ? [] : null; this.tint = opts.tint ? [] : null; this.col = opts.color ? [] : null; this.edge = opts.edge ? [] : null;
    // top (float aTop: eave height for the shader's under-eave AO; 1e4 = none), det (per-vertex "small detail" flag:
    // left out of far-LOD tiles and shadow proxies)
    this.top = opts.top ? [] : null; this.det = opts.detail ? [] : null; this.lay = opts.layer ? [] : null;
    this.L = 0;
    // terrain: anc (per-vertex level of the building the vertex belongs to, NaN = it follows the ground; world/terrain.js terrainRigid)
    this.anc = opts.anchor ? [] : null; this.A = NaN;
    // graphics pass 6: `sink` redirects new triangles into an array instead of idx; `dyn` = [{x, z, v0, gen}] street-front
    // units whose flat quads (v0) are swapped for generated depth near the camera (TileBatcher.refreshDyn);
    // saved / spent = triangles removed / added against the pass-5 emitters (the budget for that depth)
    this.sink = null; this.dyn = null; this.saved = 0; this.spent = 0;
    // graphics pass 7: its own ledger against pass 6 (triangles pass 7 stopped emitting into this tile / added to it:
    // wall tops hidden under copings, low garden walls <-> garden gates, doors and unit splits of quad-facing ranges)
    this.saved7 = 0; this.spent7 = 0;
    this.n = 0; this.c = [0, 0, 0, 0]; this.t = [1, 1, 1]; this.k = [1, 1, 1]; this.e = 0; this.y = 1e4; this.d = 0;
  }
  /** Eave height for following vertices (walls); 1e4 = no under-eave darkening. */
  setTop(y = 1e4) { this.y = y; return this; }
  /** Following vertices: true/1 = small detail (chimneys, posts, sheds; near tiles only), 2 = far-LOD only, 0 = both. */
  setDetail(on = true) { this.d = on === true ? 1 : on ? on : 0; return this; }
  setCell(a, b = a, p = 0, seed = 0) { const c = this.c; c[0] = a; c[1] = b; c[2] = p; c[3] = seed; return this; }
  setTint(r, g, b) { const t = this.t; if (Array.isArray(r)) { t[0] = r[0]; t[1] = r[1]; t[2] = r[2]; } else { t[0] = r; t[1] = g; t[2] = b; } return this; }
  setColor(r, g, b) { const t = this.k; if (r && r.isColor) { t[0] = r.r; t[1] = r.g; t[2] = r.b; } else if (Array.isArray(r)) { t[0] = r[0]; t[1] = r[1]; t[2] = r[2]; } else { t[0] = r; t[1] = g; t[2] = b; } return this; }
  v(x, y, z, nx, ny, nz, u, w) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, w);
    if (this.cell) this.cell.push(this.c[0], this.c[1], this.c[2], this.c[3]);
    if (this.tint) this.tint.push(this.t[0], this.t[1], this.t[2]);
    if (this.col) this.col.push(this.k[0], this.k[1], this.k[2]);
    if (this.edge) this.edge.push(this.e);
    if (this.top) this.top.push(this.y);
    if (this.det) this.det.push(this.d);
    if (this.lay) this.lay.push(this.L);
    if (this.anc) this.anc.push(this.A);
    return this.n++;
  }
  tri(a, b, c) { (this.sink || this.idx).push(a, b, c); }
  /** Triangle whose winding is fixed so its face normal agrees with (nx,ny,nz). */
  triFacing(a, b, c, nx, ny, nz) {
    const P = this.pos;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
    const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const I = this.sink || this.idx;
    if (cx * nx + cy * ny + cz * nz >= 0) I.push(a, b, c); else I.push(a, c, b);
  }
  /** Quad a-b-c-d (in order around the perimeter), wound to face n. */
  quadFacing(a, b, c, d, nx, ny, nz) { this.triFacing(a, b, c, nx, ny, nz); this.triFacing(a, c, d, nx, ny, nz); }
  get empty() { return this.idx.length === 0; }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.cell) g.setAttribute('aCell', new THREE.Float32BufferAttribute(this.cell, 4));
    if (this.tint) g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 3));
    if (this.col) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.edge) g.setAttribute('aEdge', new THREE.Float32BufferAttribute(this.edge, 1));
    if (this.top) g.setAttribute('aTop', new THREE.Float32BufferAttribute(this.top, 1));
    if (this.lay) g.setAttribute('aLayer', new THREE.Float32BufferAttribute(this.lay, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------- primitive emitters into a GeoBuf
/**
 * Vertical wall quad from (ax,az) to (bx,bz), y0..y1, facing outward normal (nx,nz).
 * uv: u0..u1 along, v0..v1 up.
 */
export function wallQuad(buf, ax, az, bx, bz, y0, y1, nx, nz, u0, u1, v0, v1) {
  const a = buf.v(ax, y0, az, nx, 0, nz, u0, v0), b = buf.v(bx, y0, bz, nx, 0, nz, u1, v0);
  const c = buf.v(bx, y1, bz, nx, 0, nz, u1, v1), d = buf.v(ax, y1, az, nx, 0, nz, u0, v1);
  buf.quadFacing(a, b, c, d, nx, 0, nz);
}
/** Flat horizontal polygon (with holes) at height y, facing up (or down if down=true). uv = (x,z)/uvScale. */
export function flatPoly(buf, poly, holes, y, uvScale = 1, down = false, uvRot = null) {
  const contour = poly.map((p) => new THREE.Vector2(p[0], p[1]));
  const hs = (holes || []).filter((h) => h.length >= 3).map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(contour, hs); } catch (e) { return; }
  const all = contour.concat(...hs);
  const base = buf.n, ny = down ? -1 : 1;
  for (const p of all) {
    let u = p.x, w = p.y;
    if (uvRot) { u = p.x * uvRot[0] + p.y * uvRot[1]; w = p.x * uvRot[2] + p.y * uvRot[3]; }
    buf.v(p.x, y, p.y, 0, ny, 0, u / uvScale, w / uvScale);
  }
  for (const t of tris) buf.triFacing(base + t[0], base + t[1], base + t[2], 0, ny, 0);
}
/**
 * Flat ribbon along a polyline: from offset dl (left) to dr (right) of the centreline (dl > dr, e.g. +w/2 .. -w/2),
 * at height y, facing up. uvMode 'world' => uv=(x,z)/s ; 'along' => u = dist/s, v = offset/s.
 */
export function flatRibbon(buf, pts, dl, dr, y, s = 1, uvMode = 'world', vRange = null) {
  if (pts.length < 2) return;
  let acc = 0, prev = -1, prevR = -1;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const [nx, nz, m] = miterAt(pts, i);
    const lx = pts[i][0] + nx * dl * m, lz = pts[i][1] + nz * dl * m, rx = pts[i][0] + nx * dr * m, rz = pts[i][1] + nz * dr * m;
    let ul, vl, ur, vr;
    if (uvMode === 'world') { ul = lx / s; vl = lz / s; ur = rx / s; vr = rz / s; }
    else { ul = ur = acc / s; if (vRange) { vl = vRange[1]; vr = vRange[0]; } else { vl = dl / s; vr = dr / s; } }
    const L = buf.v(lx, y, lz, 0, 1, 0, ul, vl), R = buf.v(rx, y, rz, 0, 1, 0, ur, vr);
    if (prev >= 0) buf.quadFacing(prev, prevR, R, L, 0, 1, 0);
    prev = L; prevR = R;
  }
}
/** Vertical strip along a polyline at lateral offset d, y0..y1, facing side (+1 = left normal, -1 = right). uv u = dist/su, v = y/sv. */
export function sideStrip(buf, pts, d, y0, y1, side, su = 1, sv = 1, u0 = 0) {
  if (pts.length < 2) return;
  let acc = u0 * su, pa = -1, pb = -1;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const [nx, nz, m] = miterAt(pts, i);
    const x = pts[i][0] + nx * d * m, z = pts[i][1] + nz * d * m;
    // per-vertex normal = miter normal (smooth), face orientation checked per quad
    const a = buf.v(x, y0, z, nx * side, 0, nz * side, acc / su, y0 / sv), b = buf.v(x, y1, z, nx * side, 0, nz * side, acc / su, y1 / sv);
    if (pa >= 0) {
      // face normal of this segment
      const sx = pts[i][0] - pts[i - 1][0], sz = pts[i][1] - pts[i - 1][1], sl = Math.hypot(sx, sz) || 1;
      buf.quadFacing(pa, a, b, pb, (-sz / sl) * side, 0, (sx / sl) * side);
    }
    pa = a; pb = b;
  }
}
/** Axis-free box (cx,cz centre, along unit (ux,uz)) with half sizes hl (along), hw (across), y0..y1. All 6 faces optional. */
export function orientedBox(buf, cx, cz, ux, uz, hl, hw, y0, y1, opts = {}) {
  const vx = -uz, vz = ux, s = opts.uvScale || 1;
  const P = (a, b) => [cx + ux * a + vx * b, cz + uz * a + vz * b];
  const c = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)];
  const ln = [hl * 2, hw * 2, hl * 2, hw * 2];
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    // outward check
    const mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz; if (mx * nx + mz * nz < 0) { nx = -nx; nz = -nz; }
    wallQuad(buf, a[0], a[1], b[0], b[1], y0, y1, nx, nz, 0, ln[i] / s, y0 / s, y1 / s);
  }
  if (opts.top !== false) {
    const base = buf.n;
    for (const p of c) buf.v(p[0], y1, p[1], 0, 1, 0, p[0] / s, p[1] / s);
    buf.quadFacing(base, base + 1, base + 2, base + 3, 0, 1, 0);
  }
  if (opts.bottom) {
    const base = buf.n;
    for (const p of c) buf.v(p[0], y0, p[1], 0, -1, 0, p[0] / s, p[1] / s);
    buf.quadFacing(base, base + 1, base + 2, base + 3, 0, -1, 0);
  }
}
/** Regular n-gon prism (walls only unless cap) centred at cx,cz radius r. u counts sides (one bay per side if bayPerSide). */
export function prism(buf, cx, cz, r, sides, y0, y1, opts = {}) {
  const rot = opts.rot || 0, r1 = opts.r1 !== undefined ? opts.r1 : r;
  const vs = opts.vScale || (y1 - y0), u0 = opts.u0 || 0;
  for (let i = 0; i < sides; i++) {
    const a0 = rot + (i / sides) * Math.PI * 2, a1 = rot + ((i + 1) / sides) * Math.PI * 2, am = (a0 + a1) / 2;
    const ax = cx + Math.cos(a0) * r, az = cz + Math.sin(a0) * r, bx = cx + Math.cos(a1) * r, bz = cz + Math.sin(a1) * r;
    const tax = cx + Math.cos(a0) * r1, taz = cz + Math.sin(a0) * r1, tbx = cx + Math.cos(a1) * r1, tbz = cz + Math.sin(a1) * r1;
    const nx = Math.cos(am), nz = Math.sin(am);
    const uA = opts.bayPerSide ? u0 + i : (u0 + i * 2 * r * Math.sin(Math.PI / sides) / (opts.uScale || 1));
    const uB = opts.bayPerSide ? u0 + i + 1 : (u0 + (i + 1) * 2 * r * Math.sin(Math.PI / sides) / (opts.uScale || 1));
    const ny = r1 === r ? 0 : (r - r1) / (y1 - y0);
    const nl = Math.hypot(nx, ny, nz);
    const a = buf.v(ax, y0, az, nx / nl, ny / nl, nz / nl, uA, (opts.v0 || 0));
    const b = buf.v(bx, y0, bz, nx / nl, ny / nl, nz / nl, uB, (opts.v0 || 0));
    const c = buf.v(tbx, y1, tbz, nx / nl, ny / nl, nz / nl, uB, (opts.v0 || 0) + (y1 - y0) / vs);
    const d = buf.v(tax, y1, taz, nx / nl, ny / nl, nz / nl, uA, (opts.v0 || 0) + (y1 - y0) / vs);
    buf.quadFacing(a, b, c, d, nx, ny, nz);
  }
  if (opts.cap) {
    const base = buf.n, s = opts.capUv || 1;
    buf.v(cx, y1, cz, 0, 1, 0, cx / s, cz / s);
    for (let i = 0; i < sides; i++) { const a = rot + (i / sides) * Math.PI * 2; const x = cx + Math.cos(a) * r1, z = cz + Math.sin(a) * r1; buf.v(x, y1, z, 0, 1, 0, x / s, z / s); }
    for (let i = 0; i < sides; i++) buf.triFacing(base, base + 1 + i, base + 1 + ((i + 1) % sides), 0, 1, 0);
  }
}
/** Dome / cone / spire over a regular n-gon: profile 'dome' | 'cone' | 'onion'. */
export function cap(buf, cx, cz, r, sides, y0, h, profile = 'dome', opts = {}) {
  const rings = profile === 'cone' ? 1 : opts.rings || 6, rot = opts.rot || 0, s = opts.uvScale || 1;
  const prof = (t) => {
    if (profile === 'cone') return [1 - t, t];
    if (profile === 'onion') { const a = t * Math.PI / 2; return [Math.cos(a) * (1 + 0.25 * Math.sin(t * Math.PI)), Math.sin(a)]; }
    const a = t * Math.PI / 2; return [Math.cos(a), Math.sin(a)];
  };
  let prev = null;
  for (let k = 0; k <= rings; k++) {
    const [rr, yy] = prof(k / rings), row = [];
    for (let i = 0; i <= sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // approximate normal from profile slope
      const [r2, y2] = prof(Math.min(1, k / rings + 0.01)), [r0, y0p] = prof(Math.max(0, k / rings - 0.01));
      let dr = r2 - r0, dy = (y2 - y0p) * h / Math.max(0.01, r);
      let nr = dy, ny = -dr; const nl = Math.hypot(nr, ny) || 1; nr /= nl; ny /= nl;
      row.push(buf.v(cx + ca * r * rr, y0 + yy * h, cz + sa * r * rr, ca * nr, ny, sa * nr, (i / sides) * (2 * Math.PI * r) / s, (yy * h) / s));
    }
    if (prev) for (let i = 0; i < sides; i++) {
      const a0 = rot + ((i + 0.5) / sides) * Math.PI * 2;
      buf.quadFacing(prev[i], prev[i + 1], row[i + 1], row[i], Math.cos(a0), 0.5, Math.sin(a0));
    }
    prev = row;
  }
}

// ---------------------------------------------------------------- tile batcher
/**
 * Collects GeoBufs per (layer, tile). finish() turns each into one static Mesh, so the city is a grid of merged
 * meshes (frustum culled by three, distance culled by cull()).
 * Layer options beyond the basics:
 *   alias: 'other'            buf() returns the other layer's buffers (several emitters share one material/mesh)
 *   far: {tile, near}         also build big far-LOD tiles (detail-flagged vertices left out); a far tile is drawn
 *                             instead of its small tiles while the camera is more than `near` m outside its square
 *   shadow: {tile, dist}      the layer does not cast itself; position-only proxies (no detail) on `tile` m cells cast
 *                             instead, only those within `dist` m of the camera (enabled just for the shadow pass)
 */
export class TileBatcher {
  constructor(scene) { this.scene = scene; this.layers = new Map(); this.meshes = []; this.far = []; this.proxies = []; this.tris = 0; this.shadowDist = null; this.trisBy = {}; this.layerOff = {}; this.dynTiles = []; this.dynR = [28, 60]; this.dynGlobal = 0; }
  /** def: {material, tile (m), cell, tint, color, edge, top, detail, castShadow, receiveShadow, cull (m), renderOrder, alias, far, shadow} */
  layer(name, def) {
    const L = { tile: 250, cull: 1600, castShadow: false, receiveShadow: true, ...def, bufs: new Map() };
    // tile grids are offset by half a (far) tile so the city centre (the origin) sits in the middle of a tile, not on a
    // corner shared by four
    L.off = (L.far ? L.far.tile : L.tile) / 2;
    if (!L.alias && !L.east) L.east = { cull: L.cull };   // east-extension geometry never joins an original tile
    this.layers.set(name, L);
  }
  has(name) { return this.layers.has(name); }
  /** the buffer buf(name, x, z) would return, if it exists already and holds something (else null): for an emitter that must not open a tile of its own (a draw call) */
  peek(name, x, z) {
    let L = this.layers.get(name); if (!L) return null;
    if (L.alias) L = this.layers.get(L.alias);
    const E = L.east && this.eastX !== undefined && x >= this.eastX ? L.east : null, tile = (E && E.tile) || L.tile;
    const b = L.bufs.get(Math.floor((x + L.off) / tile) * 10000 + Math.floor((z + L.off) / tile) + (E ? 0.5 : 0));
    return b && !b.empty ? b : null;
  }
  buf(name, x, z, main = false) {
    let L = this.layers.get(name); if (!L) throw new Error('no layer ' + name);
    const A = L.alias ? L : null;
    if (A) L = this.layers.get(A.alias);
    // East Oxford extension (map.boxes[1]): what lies east of the original rectangle goes into buffers of its own (key
    // + 0.5) with the layer's `east: {cull, tile?}` distances, so the tiles the original city is drawn from hold exactly
    // what they held before the map grew and nothing of the extension is submitted from the old streets
    const E = !main && L.east && this.eastX !== undefined && x >= this.eastX ? L.east : null, tile = (E && E.tile) || L.tile;
    const ix = Math.floor((x + L.off) / tile), iz = Math.floor((z + L.off) / tile), k = ix * 10000 + iz + (E ? 0.5 : 0);
    let b = L.bufs.get(k);
    if (!b) { b = new GeoBuf({ cell: L.cell, tint: L.tint, color: L.color, edge: L.edge, top: L.top, detail: L.detail, layer: L.layered, anchor: L.anchor }); b.ix = ix; b.iz = iz; b.east = E; L.bufs.set(k, b); }
    // terrain: what is emitted next into a building layer from a building's own centre stands at that building's level
    if (L.anchor) { const a = this.anchors ? this.anchors.get(x + ',' + z) : undefined; b.A = a === undefined ? NaN : a; }
    // an alias may stamp its depth-bias layer / detail flag on what is emitted next (emitters fetch the buffer right
    // before emitting into it)
    if (L.layered) b.L = A ? A.layerIndex || 0 : L.layerIndex || 0;
    if (A && A.setDetail !== undefined) b.d = A.setDetail;
    else if (!A && L.layered) b.d = 0;
    return b;
  }
  _mesh(g, L, name) {
    const m = new THREE.Mesh(g, L.material);
    m.name = 'world:' + name; m.castShadow = L.castShadow && !L.shadow; m.receiveShadow = L.receiveShadow;
    if (L.renderOrder !== undefined) m.renderOrder = L.renderOrder;
    m.matrixAutoUpdate = false; m.updateMatrix();
    this.scene.add(m);
    this.trisBy[name] = (this.trisBy[name] || 0) + Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
    return m;
  }
  finish() {
    for (const [name, L] of this.layers) {
      if (L.alias) continue;
      const farMap = new Map(), shadowBufs = [];
      // hills (world/terrain.js): triangles a crease of the hill crosses are cut there, so flat faces lie on it
      // terrain (world/terrain.js): how far a flat triangle may run off the surveyed surface between its corners before it
      // is cut (0 = never cut: buildings stand on their corners, with their feet sunk)
      const hillTol = terrainTol(name);
      for (const b of L.bufs.values()) {
        if (b.empty && !b.dyn) continue;
        if (L.stack && TERRAIN.mode === 'real') {
          // terrain: a ground layer (world/_terrain_lod.js): sorted by real height, base ground drawn apart and first,
          // a far cut now and near cuts cell by cell as the camera comes
          (this.stacks || (this.stacks = [])).push(...buildStack(b, L, name, (g, base) => {
            const m = this._mesh(g, L, name), bs = g.boundingSphere;      // (both halves of the ground mesh keep its name: tools find the drawn ground by it)
            m.userData.groundBase = base;
            g.userData.keepArrays = m.userData.keepArrays = 'terrain';      // (every attribute's array and the index stay on the CPU side: the ring rewrites them, world/_terrain_lod.js; world/_geo_free.js reads the geometry's mark)
            m.renderOrder = (L.renderOrder || 0) - (base ? 2 : 0);
            if (!base && L.layered) { m.onBeforeRender = stackNoDepth; m.onAfterRender = stackDepth; }
            this.meshes.push({ mesh: m, x: bs.center.x, z: bs.center.z, r: bs.radius, cull: b.east ? b.east.cull : L.cull, far: null, layer: name, east: !!b.east });
            this.tris += g.index.count / 3;
            return m;
          }));
          continue;
        }
        if (name === 'water' && TERRAIN.mode === 'real') {
          // the water is level: nothing to cut, except a triangle that reaches from one level to another by 0.5 m or more (two
          // reaches at a weir; a ditch running down a bank): along a 16 m lattice, or it would slope across
          const I0 = b.idx, P0 = b.pos, wOf = TERRAIN.field.w;
          terrainSubdivide(b, 1, true, { tolOf: () => 1, gridOf: (i0, o) => { const h0 = wOf(P0[I0[o] * 3], P0[I0[o] * 3 + 2]), h1 = wOf(P0[I0[o + 1] * 3], P0[I0[o + 1] * 3 + 2]), h2 = wOf(P0[I0[o + 2] * 3], P0[I0[o + 2] * 3 + 2]); return Math.max(h0, h1, h2) - Math.min(h0, h1, h2) > 0.5 ? 16 : 0; } });
        } else if (hillTol) terrainSubdivide(b, hillTol, name === 'water');
        if (b.anc) terrainRigid(b.pos, b.top, b.anc);
        const g = (b.det && b.det.includes(2)) || b.dyn ? mergeBufs([b], { exclude: 2, dyn: true }) : b.toGeometry();
        if (!g) continue;
        const m = this._mesh(g, L, name);
        const bs = g.boundingSphere;
        const rec = { mesh: m, x: bs.center.x, z: bs.center.z, r: bs.radius, cull: b.east ? b.east.cull : L.cull, far: null, layer: name, east: !!b.east };
        if (g.userData.dyn) { rec.dyn = g.userData.dyn; rec.dyn.budget = Math.max(0, Math.floor(b.saved - b.spent)); rec.dyn.budget7 = Math.max(0, Math.floor(b.saved7 - b.spent7)); rec.dyn.staticGeo = g; this.dynTiles.push(rec); }
        this.meshes.push(rec);
        this.tris += g.index.count / 3;
        if (L.far) {
          const fx = Math.floor(((b.ix + 0.5) * L.tile) / L.far.tile), fz = Math.floor(((b.iz + 0.5) * L.tile) / L.far.tile), k = fx * 10000 + fz + (b.east ? 0.5 : 0);
          let f = farMap.get(k); if (!f) farMap.set(k, (f = { fx, fz, bufs: [], recs: [], cull: b.east ? b.east.cull : L.cull, east: b.east ? b.east.cull : 0 }));
          f.bufs.push(b); f.recs.push(rec);
        }
        if (L.shadow) shadowBufs.push(b);
      }
      for (const f of farMap.values()) {
        const g = mergeBufs(f.bufs, { exclude: 1 });
        const T = L.far.tile;
        const box = { minX: f.fx * T - L.off, maxX: (f.fx + 1) * T - L.off, minZ: f.fz * T - L.off, maxZ: (f.fz + 1) * T - L.off };
        let mesh = null;
        if (g) { mesh = this._mesh(g, L, name + 'Far'); mesh.castShadow = false; }
        const bs = g ? g.boundingSphere : null;
        for (const r of f.recs) r.far = true;
        this.far.push({ mesh, ...box, near: L.far.near, recs: f.recs, x: bs ? bs.center.x : 0, z: bs ? bs.center.z : 0, r: bs ? bs.radius : 0, cull: f.cull, east: f.east });
      }
      if (L.shadow) this._proxies(shadowBufs, L.shadow);
      // The tiles' raw arrays (plain JS numbers: positions, normals, uvs, cells, tints … of the whole city) are done with
      // once the geometries are made — but the closures that later give a street front its depth (buildings.js
      // bucket.gen) share a scope with the buffer their front was emitted into, and kept every one of them alive for
      // the life of the page: ~40% of the JS heap (tools/probe_heap.mjs). Emptied here, they are garbage.
      for (const b of L.bufs.values()) { b.pos = []; b.nor = []; b.uv = []; b.idx = []; for (const k of ['cell', 'tint', 'col', 'edge', 'top', 'det', 'lay']) if (b[k]) b[k] = []; b.dyn = null; b.sink = null; b.n = 0; }
      L.bufs.clear();
    }
    return this.meshes;
  }
  /** Position-only shadow casters on a fine grid, from the non-detail triangles of the layer. */
  _proxies(bufs, def) {
    const T = def.tile, cells = new Map();
    for (const b of bufs) {
      const P = b.pos, I = b.idx, D = b.det;
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t], c = I[t + 1], e = I[t + 2];
        if (D && (D[a] === 1 || D[c] === 1 || D[e] === 1)) continue;
        const cx = (P[a * 3] + P[c * 3] + P[e * 3]) / 3, cz = (P[a * 3 + 2] + P[c * 3 + 2] + P[e * 3 + 2]) / 3;
        const k = Math.floor(cx / T) * 10000 + Math.floor(cz / T);
        let arr = cells.get(k); if (!arr) cells.set(k, (arr = []));
        arr.push(P[a * 3], P[a * 3 + 1], P[a * 3 + 2], P[c * 3], P[c * 3 + 1], P[c * 3 + 2], P[e * 3], P[e * 3 + 1], P[e * 3 + 2]);
      }
    }
    if (!this.proxyGroup) {
      this.proxyGroup = new THREE.Group(); this.proxyGroup.name = 'world:shadowCasters';
      this.proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false });
      this.scene.add(this.proxyGroup);
      installShadowSentinel(this.scene, this);
    }
    for (const arr of cells.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.proxyMat);
      m.name = 'world:shadowProxy'; m.castShadow = true; m.receiveShadow = false; m.visible = false;
      m.matrixAutoUpdate = false; m.updateMatrix();
      this.proxyGroup.add(m);
      this.proxies.push({ mesh: m, x: g.boundingSphere.center.x, z: g.boundingSphere.center.z, r: g.boundingSphere.radius, dist: def.dist, on: false });
      this.tris += arr.length / 9; this.trisBy.proxy = (this.trisBy.proxy || 0) + arr.length / 9;
    }
    this.proxyGroup.updateMatrixWorld(true);
  }
  /** Hide tiles whose bounding sphere is beyond their layer's cull distance from the camera; pick near/far LOD tiles. */
  // aerial mode (world.setAerial, systems/gliding.js): `cy` = the camera's height above the ground enters every distance
  // (so near-ground detail — paths, markings, battlements, near LOD — drops away as you climb) and `eastK` stretches the
  // East Oxford tiles' own distances. Both are 0 / unset on the ground, where the sums below are exactly the old ones.
  cull(cx, cz, cy = 0) {
    const dy2 = cy * cy, ek = this.eastK || 0;
    for (let i = 0; i < this.meshes.length; i++) {
      const t = this.meshes[i]; if (t.far) continue;
      const dx = t.x - cx, dz = t.z - cz, lim = (ek && t.east ? t.cull * ek : t.cull) + t.r;
      t.mesh.visible = dx * dx + dz * dz + dy2 < lim * lim && !this.layerOff[t.layer];
    }
    for (let i = 0; i < this.far.length; i++) {
      const f = this.far[i];
      const ox = Math.max(f.minX - cx, 0, cx - f.maxX), oz = Math.max(f.minZ - cz, 0, cz - f.maxZ);
      const near = ox * ox + oz * oz + dy2 < f.near * f.near;
      if (f.mesh) { const dx = f.x - cx, dz = f.z - cz, lim = f.cull + f.r; f.mesh.visible = !near && dx * dx + dz * dz + dy2 < lim * lim; }
      const R = f.recs;
      for (let k = 0; k < R.length; k++) R[k].mesh.visible = near;
    }
    this.refreshDyn(cx, cz);
    if (this.stacks) updateStacks(this.stacks, cx, cz);
    const sd = this.shadowDist;
    for (let i = 0; i < this.proxies.length; i++) {
      const p = this.proxies[i], dx = p.x - cx, dz = p.z - cz, lim = (sd ?? p.dist) + p.r;
      p.on = dx * dx + dz * dz < lim * lim;
    }
    // aerial mode only (unset on the ground): the casters under the big aerial shadow box instead, [x, z, radius]
    const sa = this.shadowAt;
    if (sa) for (let i = 0; i < this.proxies.length; i++) {
      const p = this.proxies[i], dx = p.x - sa[0], dz = p.z - sa[1], lim = sa[2] + p.r;
      p.on = dx * dx + dz * dz < lim * lim;
    }
  }
}

/**
 * Dynamic facade depth (graphics pass 6). The street fronts of a near tile are flat quads at the end of its index
 * buffer, one group ("bucket") per house / shop unit. When the camera has moved a few metres, the units within
 * dynR[1] m get the bands that stand out of the wall (level 1) and those within dynR[0] m get every window, door and
 * shop window really set back (level 2): the geometry is GENERATED then (bucket.gen, buildings.js), written into a
 * vertex pool appended to a copy of the tile's geometry, and the index tail is rewritten. A tile with nothing in range
 * draws its original geometry; at most a handful of tiles hold a pool at any time.
 * The triangles this adds are capped, nearest units first, by a pool of triangles that pass 6 removed from meshes
 * which are certainly being drawn: `dynGlobal` (the always-drawn ground mesh: duplicate junction discs) plus the
 * unspent savings of every facade tile whose bounding sphere contains the camera (a sphere round the eye always meets
 * the frustum). So no view draws more than before. No extra draw call, no shader work.
 *
 * A NEW pool is a copy of the whole tile plus the pool: 3–11 MB that used to go up in the frame the tile was switched
 * to it (a 67–83 ms frame two frames later, at every arrival and every few seconds of a drive). Where the world gives
 * a `dynUpload(geometry) -> Promise | null` (index.js: the top tier), the pool is filled as before but the tile goes on
 * drawing its flat fronts (D.wait) until the pool's buffers are on the card, a few MB a frame, and is switched then.
 */
const DYN_CAP = 30000, DYN_ATTRS = ['position', 'normal', 'uv', 'aCell', 'aTint', 'aTop'];
const DYN_SCRATCH = new GeoBuf({ cell: true, tint: true, top: true });
function genBucket(b, level) {
  const s = DYN_SCRATCH;
  s.pos.length = s.nor.length = s.uv.length = s.idx.length = s.cell.length = s.tint.length = s.top.length = 0; s.n = 0; s.sink = null;
  b.gen(s, level);
  if (b.anc === b.anc) terrainRigid(s.pos, s.top, b.anc);     // (terrain: the unit's building stands level; its generated depth with it)
  return { level, n: s.n, position: Float32Array.from(s.pos), normal: Float32Array.from(s.nor), uv: Float32Array.from(s.uv), aCell: Float32Array.from(s.cell), aTint: Float32Array.from(s.tint), aTop: Float32Array.from(s.top), idx: Uint32Array.from(s.idx) };
}
function pooledGeometry(src, D) {
  const g = new THREE.BufferGeometry();
  for (const k of DYN_ATTRS) {
    const a = src.attributes[k], arr = new Float32Array((D.nStatic + DYN_CAP) * a.itemSize); arr.set(a.array);
    const at = new THREE.BufferAttribute(arr, a.itemSize); at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, at);
  }
  const idx = new Uint32Array(src.index.count + DYN_CAP * 1.5); idx.set(src.index.array);
  const ia = new THREE.BufferAttribute(idx, 1); ia.setUsage(THREE.DynamicDrawUsage); g.setIndex(ia);
  g.boundingSphere = src.boundingSphere.clone(); g.boundingBox = src.boundingBox.clone();
  return g;
}
TileBatcher.prototype.refreshDyn = function (cx, cz, force = false) {
  const R1 = this.dynR[0], R2 = this.dynR[1], S = this.dynState || (this.dynState = { x: 1e9, z: 1e9, r1: 0, r2: 0, act: [], extra: 0, pool: 0, pooled: 0 });
  if (!this.dynTiles.length) return;
  if (!force && Math.abs(cx - S.x) + Math.abs(cz - S.z) < 3.5 && S.r1 === R1 && S.r2 === R2) {   // (a site boundary is crossed at most 3.5 m late)
    // nothing moved: only tiles that were switched off while they still showed depth need putting back
    let stale = false; for (let i = 0; i < this.dynTiles.length; i++) { const t = this.dynTiles[i]; if (!t.dyn.plain && !t.mesh.visible) stale = true; }
    if (!stale) return;
  }
  S.x = cx; S.z = cz; S.r1 = R1; S.r2 = R2;
  // pass 7: walls that face a quad or garden (bucket.site = the college) only take depth while the camera is inside
  // that college's site — from the street they are behind the front ranges, and would cost triangles nobody sees
  const site = this.siteAt ? this.siteAt(cx, cz) : ''; this.dynSite = site;
  const act = S.act; act.length = 0;
  let pool = this.dynGlobal || 0;
  // ...and the depth of quad-facing walls (pass 7) is capped a second time by what pass 7 itself took out of every
  // view: dynOpen (always-drawn water and ground meshes) + the unspent pass-7 savings of the tiles round the camera
  let open = this.dynOpen || 0;
  for (let i = 0; i < this.dynTiles.length; i++) {
    const t = this.dynTiles[i], D = t.dyn, B = D.buckets;
    D.dirty = false; D.used = 0;
    const dx = t.x - cx, dz = t.z - cz, d2t = dx * dx + dz * dz, off = !t.mesh.visible || d2t > (t.r + R2) * (t.r + R2);
    if (off) { if (!D.plain || D.wait) { for (let k = 0; k < B.length; k++) { B[k].geo = null; if (B[k].lv) { B[k].lv = 0; D.dirty = true; } } } continue; }
    if (d2t < t.r * t.r) { pool += D.budget; open += D.budget7 || 0; }
    for (let k = 0; k < B.length; k++) {
      const b = B[k]; let ex = b.x - cx, ez = b.z - cz;
      // long units (a whole quad-facing wall): distance to the nearest point of the wall, not to its middle
      if (b.hl) { const al = Math.max(-b.hl, Math.min(b.hl, -(ex * b.ux + ez * b.uz))); ex += b.ux * al; ez += b.uz * al; }
      b.d2 = ex * ex + ez * ez;
      if (b.d2 < R2 * R2 && (!b.site || b.site === site)) { b.t = D; act.push(b); } else { b.geo = null; if (b.lv) { b.lv = 0; D.dirty = true; } }
    }
  }
  act.sort((p, q) => p.d2 - q.d2);
  S.pool = pool;
  // at most a few units are generated per refresh (a refresh is asked for again until all are done), so arriving
  // somewhere new fills in over a second, nearest fronts first, instead of stalling one frame
  let left = pool * 3, leftOpen = open * 3, gens = force ? -1e9 : 0, pending = false; S.open = open;
  for (let j = 0; j < act.length; j++) {
    const b = act[j], D = b.t;
    let want = b.d2 < R1 * R1 ? 2 : 1, q = null;
    for (; want > 0; want--) {
      q = b.geo && b.geo.level === want ? b.geo : null;
      if (!q) { if (gens >= 8) { pending = true; continue; } q = genBucket(b, want); gens++; }
      const extra = q.idx.length - (want === 2 ? b.v0.length : 0);
      // (the last 15 % of a tile's vertex pool is kept for the cheap level-1 bands of the units further out)
      if (extra <= left && (!b.site || extra <= leftOpen) && D.used + q.n <= (want === 2 ? DYN_CAP * 0.85 : DYN_CAP)) { left -= extra; if (b.site) leftOpen -= extra; D.used += q.n; break; }
    }
    b.geo = want ? q : null;
    if (b.lv !== want || b.geo !== b.shown) { b.lv = want; D.dirty = true; }
  }
  if (pending) S.x = 1e9;
  S.extra = pool - left / 3;
  let pooled = 0;
  for (let i = 0; i < this.dynTiles.length; i++) {
    const t = this.dynTiles[i], D = t.dyn;
    if (D.dirty || D.wait) {
      const B = D.buckets;
      if (!D.used) {
        for (let k = 0; k < B.length; k++) B[k].shown = null;
        D.plain = true; D.wait = false; t.mesh.geometry = D.staticGeo;
      } else {
        const g = D.pooled || (D.pooled = pooledGeometry(D.staticGeo, D)), I = g.index.array;
        let vo = D.nStatic, io = D.base;
        for (let k = 0; k < B.length; k++) {
          const b = B[k], q = b.lv ? b.geo : null;
          if (b.lv < 2) { I.set(b.v0, io); io += b.v0.length; }
          b.shown = q;
          if (!q) continue;
          for (let a = 0; a < DYN_ATTRS.length; a++) { const at = g.attributes[DYN_ATTRS[a]]; at.array.set(q[DYN_ATTRS[a]], vo * at.itemSize); }
          const qi = q.idx; for (let m = 0; m < qi.length; m++) I[io + m] = qi[m] + vo;
          io += qi.length; vo += q.n;
        }
        for (let a = 0; a < DYN_ATTRS.length; a++) { const at = g.attributes[DYN_ATTRS[a]]; at.clearUpdateRanges(); at.addUpdateRange(D.nStatic * at.itemSize, (vo - D.nStatic) * at.itemSize); at.needsUpdate = true; }
        g.index.clearUpdateRanges(); g.index.addUpdateRange(D.base, io - D.base); g.index.needsUpdate = true;
        g.setDrawRange(0, io);
        // (a pool that has never been on the card: sent up in the background first; the flat fronts stay meanwhile)
        if (!g._up) {
          const up = force || g._upP ? null : this.dynUpload ? this.dynUpload(g) : null;
          if (up) { g._upP = up; S.waits = (S.waits || 0) + 1; up.then(() => { g._up = true; g._upP = null; S.x = 1e9; }); }
          else if (!g._upP || force) g._up = true;
        }
        if (g._up) { D.plain = false; D.wait = false; t.mesh.geometry = g; }
        else { D.wait = true; D.plain = true; t.mesh.geometry = D.staticGeo; }
      }
    }
    if (D.pooled) pooled++;
  }
  // keep a few idle pools (walking to and fro across a tile edge), free the rest
  if (pooled > 4) for (let i = 0; i < this.dynTiles.length && pooled > 2; i++) { const D = this.dynTiles[i].dyn; if (D.pooled && D.plain && !D.wait && !D.pooled._upP) { D.pooled.dispose(); D.pooled = null; pooled--; } }
  S.pooled = pooled;
};

/**
 * Shadow-only meshes: three renders the shadow map after it has built the main-pass render list, so a sentinel first
 * child of the scene switches the proxies on in its onBeforeShadow (they are then in the shadow pass only) and the
 * scene's onAfterRender switches them off again. The sentinel itself never issues a draw (negative draw range).
 */
function installShadowSentinel(scene, batch) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -50, 0, 0, -50, 0.01, 0.01, -50, 0], 3));
  g.setDrawRange(1, -1);
  const s = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  s.name = 'world:shadowSentinel'; s.castShadow = true; s.frustumCulled = false; s.matrixAutoUpdate = false;
  s.userData.owner = 'world';
  const P = batch.proxies;
  let lit = false;
  s.onBeforeShadow = () => { if (lit) return; lit = true; for (let i = 0; i < P.length; i++) if (P[i].on) P[i].mesh.visible = true; };
  const prev = scene.onAfterRender;
  scene.onAfterRender = function (...a) {
    if (lit) { lit = false; for (let i = 0; i < P.length; i++) P[i].mesh.visible = false; }
    if (prev) prev.apply(this, a);
  };
  s.parent = scene; scene.children.unshift(s);
}

/** Merge GeoBufs into one BufferGeometry, optionally dropping triangles that touch vertices whose detail flag is `exclude`. */
export function mergeBufs(bufs, { exclude = 0, dyn = false } = {}) {
  const b0 = bufs[0];
  const out = new GeoBuf({ cell: !!b0.cell, tint: !!b0.tint, color: !!b0.col, edge: !!b0.edge, top: !!b0.top, layer: !!b0.lay });
  for (const b of bufs) {
    const remap = new Int32Array(b.n).fill(-1), I = b.idx, D = exclude ? b.det : null;
    const take = (i) => {
      if (remap[i] >= 0) return remap[i];
      out.pos.push(b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]); out.nor.push(b.nor[i * 3], b.nor[i * 3 + 1], b.nor[i * 3 + 2]); out.uv.push(b.uv[i * 2], b.uv[i * 2 + 1]);
      if (out.cell) out.cell.push(b.cell[i * 4], b.cell[i * 4 + 1], b.cell[i * 4 + 2], b.cell[i * 4 + 3]);
      if (out.tint) out.tint.push(b.tint[i * 3], b.tint[i * 3 + 1], b.tint[i * 3 + 2]);
      if (out.col) out.col.push(b.col[i * 3], b.col[i * 3 + 1], b.col[i * 3 + 2]);
      if (out.edge) out.edge.push(b.edge[i]);
      if (out.top) out.top.push(b.top ? b.top[i] : 1e4);
      if (out.lay) out.lay.push(b.lay ? b.lay[i] : 0);
      return (remap[i] = out.n++);
    };
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], c = I[t + 1], e = I[t + 2];
      if (D && (D[a] === exclude || D[c] === exclude || D[e] === exclude)) continue;
      out.idx.push(take(a), take(c), take(e));
    }
    if (dyn && b.dyn && b.dyn.length) {
      // street-front units: their flat quads go at the end of the index (remapped), their generators ride along
      const base = out.idx.length;
      const buckets = b.dyn.map((q) => ({ x: q.x, z: q.z, hl: q.hl || 0, ux: q.ux || 0, uz: q.uz || 0, site: q.site || '', anc: b.anc && q.v0.length ? b.anc[q.v0[0]] : NaN, v0: Uint32Array.from(q.v0, take), gen: q.gen, lv: 0, d2: 0, t: null, geo: null, shown: null }));
      for (const q of buckets) for (let k = 0; k < q.v0.length; k++) out.idx.push(q.v0[k]);
      const g = out.toGeometry();
      g.userData.dyn = { base, buckets, plain: true, dirty: false, budget: 0, used: 0, nStatic: out.n, pooled: null, staticGeo: null };
      return g;
    }
  }
  return out.empty ? null : out.toGeometry();
}

/** Mark a mesh/group static: no per-frame matrix recompute. */
export function makeStatic(obj) {
  obj.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  obj.updateMatrixWorld(true);
  return obj;
}

/** BoxGeometry with UVs in metres (so repeat-wrapped textures keep a constant scale). */
export function metricBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return g;
}
/** Give a geometry a constant vertex colour (adds/overwrites 'color'). */
export function paint(g, color) {
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Queue elements [start, start + count) of a BufferAttribute for upload without losing a write three has not uploaded
 * yet. three uploads `updateRanges` only when the object is next drawn (projected into a render or the shadow pass) and
 * clears them then, so `clearUpdateRanges(); addUpdateRange(...)` from a writer throws away any earlier write that was
 * never drawn — a second write in the same frame, an object culled or hidden for a while, the world while you are
 * indoors — and the GPU keeps the old data there under the new draw range / index (the 2026-11 "black triangles" class).
 * This folds the new range into the one still pending (a single range, its object reused: no allocation), and leaves
 * a pending whole-array upload (needsUpdate with no ranges) whole. Sets needsUpdate.
 */
export function markRange(a, start, count) {
  if (!(count > 0)) return;
  if (a.__upV === undefined) {        // (once per attribute: note the version three last uploaded)
    a.__upV = -1; a.__r = { start: 0, count: 0 };
    const prev = a.onUploadCallback;
    a.onUploadCallback = function () { a.__upV = a.version; prev.call(this); };
  }
  const R = a.updateRanges;
  if (a.version > a.__upV && R.length === 0) { a.needsUpdate = true; return; }   // a whole-array upload is queued: it covers this
  let lo = start, hi = start + count;
  for (let i = 0; i < R.length; i++) { const r = R[i]; if (r.start < lo) lo = r.start; if (r.start + r.count > hi) hi = r.start + r.count; }
  const r = a.__r; r.start = lo; r.count = hi - lo; R.length = 0; R.push(r);
  a.needsUpdate = true;
}
