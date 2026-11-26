// Tree planting for the east side (photo comparison east, 2026-11). The photographs show Headington Road climbing
// between wooded banks, Marston Road under trees, a lime avenue to St Clement's church, Morrell Avenue as a tunnel of
// big trees and Headington Hill Park as an arboretum; the map has a thin scatter. Everything here is pure and
// deterministic (hashes of positions: the same trees for every player) and is run from the modules' preMap, so the
// trees are ordinary map trees: drawn, collided, cleared (world.clearArea) and culled by the world like mapped ones.
// Where each tree stands is a GUESS; that the trees are there is from the photographs.
const h01 = (a, b = 0) => { let h = Math.imul((a | 0) ^ 0x5bd1e995, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };
const dseg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };

/** a checker for one stretch of the map: ok(x, z) = clear of roads (and their pavements), paths, buildings, water, pitches and other trees */
export function planter(map, box) {
  const [x0, x1, z0, z1] = box, inb = (pts) => pts.some((p) => p[0] > x0 - 30 && p[0] < x1 + 30 && p[1] > z0 - 30 && p[1] < z1 + 30);
  const roads = map.roads.filter((r) => !r.tunnel && inb(r.pts));
  const blds = map.buildings.filter((b) => !b.part && b.c[0] > x0 - 60 && b.c[0] < x1 + 60 && b.c[1] > z0 - 60 && b.c[1] < z1 + 60);
  const areas = map.areas.filter((a) => /^(water|pitch|parking|paved|sand)$/.test(a.kind) && inb(a.poly));
  const bars = map.barriers.filter((b) => inb(b.pts));
  const trees = map.trees.filter((t) => t[0] > x0 - 10 && t[0] < x1 + 10 && t[1] > z0 - 10 && t[1] < z1 + 10);
  const VEH = /^(primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian)/;
  const ok = (x, z, gap = 5) => {
    for (const r of roads) { const need = r.w / 2 + (VEH.test(r.kind) ? (r.kind === 'service' ? 1.6 : 4.4) : 1.5); for (let i = 0; i < r.pts.length - 1; i++) if (dseg(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]) < need) return false; }
    for (const b of blds) { let near = false; for (let i = 0; i < b.poly.length && !near; i++) { const a = b.poly[i], c = b.poly[(i + 1) % b.poly.length]; if (dseg(x, z, a[0], a[1], c[0], c[1]) < 3.2) near = true; } if (near || pip(x, z, b.poly)) return false; }
    for (const a of areas) if (pip(x, z, a.poly)) return false;
    for (const b of bars) for (let i = 0; i < b.pts.length - 1; i++) if (dseg(x, z, b.pts[i][0], b.pts[i][1], b.pts[i + 1][0], b.pts[i + 1][1]) < 1.3) return false;
    for (const t of trees) if (Math.abs(t[0] - x) < gap && Math.abs(t[1] - z) < gap && Math.hypot(t[0] - x, t[1] - z) < gap) return false;
    return true;
  };
  const add = (x, z, h, sp) => { const t = sp ? [Math.round(x * 10) / 10, Math.round(z * 10) / 10, Math.round(h * 10) / 10, sp] : [Math.round(x * 10) / 10, Math.round(z * 10) / 10, Math.round(h * 10) / 10]; map.trees.push(t); trees.push(t); return t; };
  return { ok, add, trees };
}

/** rows of trees beside a polyline: offsets = lateral distances (m; + = left of the direction of travel), spacing along */
export function plantAlong(P, pts, offsets, spacing, hMin, hMax, seed, o = {}) {
  let n = 0, acc = 0, next = spacing * 0.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = uz, nz = -ux;
    while (next <= acc + L) {
      const s = next - acc, k = Math.round(next * 7);
      offsets.forEach((off, j) => {
        const jit = o.jitter ?? 2.2, x = a[0] + ux * (s + (h01(k, seed + j * 7) - 0.5) * jit * 2) + nx * (off + (h01(k, seed + j * 7 + 1) - 0.5) * jit), z = a[1] + uz * (s + (h01(k, seed + j * 7) - 0.5) * jit * 2) + nz * (off + (h01(k, seed + j * 7 + 1) - 0.5) * jit);
        if (o.where && !o.where(x, z)) return;
        if (h01(k, seed + j * 7 + 2) < (o.skip || 0)) return;
        if (!P.ok(x, z, o.gap || 5)) return;
        const r = h01(k, seed + j * 7 + 3), h = hMin + (hMax - hMin) * r; P.add(x, z, h, o.species ? o.species(r) : (h >= 19 ? 'plane' : 'broad')); n++;   // (two species only: no near-mesh draw the street did not already have)
      });
      next += spacing;
    }
    acc += L;
  }
  return n;
}

/** a scatter inside a polygon: one candidate per `cell` m square, kept with probability `fill` */
export function plantIn(P, poly, cell, fill, hMin, hMax, seed, o = {}) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, n = 0;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let gx = Math.floor(x0 / cell); gx * cell < x1; gx++) for (let gz = Math.floor(z0 / cell); gz * cell < z1; gz++) {
    if (h01(gx * 31 + seed, gz) > fill) continue;
    const x = (gx + 0.15 + 0.7 * h01(gx, gz * 17 + seed)) * cell, z = (gz + 0.15 + 0.7 * h01(gx * 13 + seed, gz)) * cell;
    if (!pip(x, z, poly) || (o.where && !o.where(x, z)) || !P.ok(x, z, o.gap || 6)) continue;
    const r = h01(gx + seed * 3, gz * 5), h = hMin + (hMax - hMin) * r; P.add(x, z, h, h >= 19 ? 'plane' : 'broad'); n++;
  }
  return n;
}

/** make the mapped trees within `d` m of a polyline at least hMin..hMax tall (an avenue that the map has as saplings) */
export function growAlong(map, pts, d, hMin, hMax, seed) {
  let n = 0;
  for (const t of map.trees) {
    let near = false;
    for (let i = 0; i < pts.length - 1 && !near; i++) if (dseg(t[0], t[1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < d) near = true;
    if (!near) continue;
    const h = hMin + (hMax - hMin) * h01(Math.round(t[0] * 3), Math.round(t[1] * 3) + seed);
    if (t[2] < h) { t[2] = Math.round(h * 10) / 10; n++; }
  }
  return n;
}
