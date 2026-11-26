// Pure helpers for the lecture-theatre audience (owned by places/maths.js; no three.js import, so tools/smoke_maths.mjs
// can test them): detail levels made from one baked seated character, and the per-view triangle budget.
// Level 0 = the baked body (lower legs dropped where the desks hide them), levels 1 and 2 = the same body simplified by
// vertex clustering, so a far member of the audience keeps the hair, skin and clothes colours and the silhouette of the
// near one. The whole audience never costs more triangles than the box-and-egg stand-ins it replaces (STANDIN_TRIS each).

export const STANDIN_TRIS = 136;      // the old stand-in: 3 boxes (36) + icosphere head (80) + hair cap (20)

/** drop the triangles that lie wholly below y (index array in, new Uint32Array out) */
export function trimBelow(pos, idx, y) {
  const out = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    if (pos[a * 3 + 1] < y && pos[b * 3 + 1] < y && pos[c * 3 + 1] < y) continue;
    out.push(a, b, c);
  }
  return new Uint32Array(out);
}

/** drop vertices no triangle uses: -> {pos, nor, col, idx} */
export function compact(pos, nor, col, idx) {
  const nv = pos.length / 3, map = new Int32Array(nv).fill(-1);
  let n = 0;
  for (let i = 0; i < idx.length; i++) if (map[idx[i]] < 0) map[idx[i]] = n++;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), I = new Uint32Array(idx.length);
  for (let v = 0; v < nv; v++) {
    const m = map[v]; if (m < 0) continue;
    for (let k = 0; k < 3; k++) { P[m * 3 + k] = pos[v * 3 + k]; N[m * 3 + k] = nor[v * 3 + k]; C[m * 3 + k] = col[v * 3 + k]; }
  }
  for (let i = 0; i < idx.length; i++) I[i] = map[idx[i]];
  return { pos: P, nor: N, col: C, idx: I };
}

/**
 * Vertex-clustering simplification: vertices in the same `cell`-sized cube become one (mean position; fine = {y, k}
 * shrinks the cells by k above height y),
 * collapsed and duplicate triangles go, normals are rebuilt area-weighted (smooth). -> {pos, nor, col, idx}
 */
export function clusterDecimate(pos, col, idx, cell, fine = null) {
  const nv = pos.length / 3, remap = new Int32Array(nv), keys = new Map();
  const sp = [], sc = [], cnt = [];
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const cs = fine && y > fine.y ? cell * fine.k : cell;       // the head keeps smaller cells than the body
    const k = (Math.floor(x / cs) + 512) + (Math.floor(y / cs) + 512) * 1024 + (Math.floor(z / cs) + 512) * 1048576 + (cs !== cell ? 1073741824 * 4 : 0);
    let m = keys.get(k);
    if (m === undefined) { m = cnt.length; keys.set(k, m); sp.push(0, 0, 0); sc.push(0, 0, 0); cnt.push(0); }
    sp[m * 3] += x; sp[m * 3 + 1] += y; sp[m * 3 + 2] += z; sc[m * 3] += col[v * 3]; sc[m * 3 + 1] += col[v * 3 + 1]; sc[m * 3 + 2] += col[v * 3 + 2]; cnt[m]++;
    remap[v] = m;
  }
  const n = cnt.length, P = new Float32Array(n * 3), C = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let m = 0; m < n; m++) for (let k = 0; k < 3; k++) P[m * 3 + k] = sp[m * 3 + k] / cnt[m];
  // colour: that of the member vertex nearest the cluster centre (a mean would smear hair into skin, shirt into jacket)
  const best = new Float32Array(n).fill(Infinity);
  for (let v = 0; v < nv; v++) {
    const m = remap[v], d = (pos[v * 3] - P[m * 3]) ** 2 + (pos[v * 3 + 1] - P[m * 3 + 1]) ** 2 + (pos[v * 3 + 2] - P[m * 3 + 2]) ** 2;
    if (d < best[m]) { best[m] = d; C[m * 3] = col[v * 3]; C[m * 3 + 1] = col[v * 3 + 1]; C[m * 3 + 2] = col[v * 3 + 2]; }
  }
  void sc;
  const out = [], seen = new Set();
  for (let i = 0; i < idx.length; i += 3) {
    const a = remap[idx[i]], b = remap[idx[i + 1]], c = remap[idx[i + 2]];
    if (a === b || b === c || a === c) continue;
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi, key = lo * 4294967296 + mid * 65536 + hi;
    if (seen.has(key)) continue; seen.add(key);
    out.push(a, b, c);
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { N[q * 3] += nx; N[q * 3 + 1] += ny; N[q * 3 + 2] += nz; }
  }
  for (let m = 0; m < n; m++) { const l = Math.hypot(N[m * 3], N[m * 3 + 1], N[m * 3 + 2]) || 1; N[m * 3] /= l; N[m * 3 + 1] /= l; N[m * 3 + 2] /= l; }
  return compact(P, N, C, new Uint32Array(out));
}

/** the simplification of a body with at most `maxTris` triangles (cell size found by bisection) */
export function decimateTo(pos, col, idx, maxTris, fine = null) {
  let lo = 0.01, hi = 0.4, best = null;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2, g = clusterDecimate(pos, col, idx, mid, fine);
    if (g.idx.length / 3 <= maxTris) { best = g; hi = mid; } else lo = mid;
  }
  return best || clusterDecimate(pos, col, idx, hi, fine);
}

/**
 * Detail level for each member, nearest first. tris[v] = [t0, t1, t2] triangle counts of variant v's levels;
 * order = member indices sorted by distance; variantOf[i] = variant of member i; near[i] (optional) = 1 where the full
 * (untrimmed) level-0 body is used, whose count is tris0full[v]. Everyone starts at level 2; the nearest are raised to
 * level 0 (at most max0) and the next to level 1 (at most max1) while the total stays within budget.
 * Fills level (Uint8Array) and returns the total triangle count.
 */
export function planLod(order, variantOf, tris, budget, level, max0 = 12, max1 = 40, cost0 = null) {
  let total = 0;
  for (const i of order) { level[i] = 2; total += tris[variantOf[i]][2]; }
  let n0 = 0, n1 = 0;
  for (const i of order) {
    const t = tris[variantOf[i]], c0 = cost0 ? cost0(i) : t[0];
    if (n0 < max0 && total - t[2] + c0 <= budget) { total += c0 - t[2]; level[i] = 0; n0++; }
    else if (n1 < max1 && total - t[2] + t[1] <= budget) { total += t[1] - t[2]; level[i] = 1; n1++; }
    else if (n0 >= max0 && n1 >= max1) break;
  }
  return total;
}
