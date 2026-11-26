// Rivers, streams, the canal, lakes and ponds: water areas + ribbons along waterlines (animated shader in materials.js).
import { flatPoly, miterAt, cleanRing, cleanLine, polyCentroid, signedArea, pointInPoly, distToSeg, polyBounds, simplifyLine, simplifyRing } from './util.js';
import { Y } from './ground.js';

// OSM waterway widths are mostly defaults (river = 14 m); real channel widths (approx.) by name
const WIDTH = {
  'River Cherwell': 13, 'River Thames': 26, 'Castle Mill Stream': 8, 'Holywell Mill Stream': 5, 'Kings Mill Stream': 5,
  'Osney Mill Stream': 6, 'Osney Stream': 6, 'Bulstake Stream': 7, 'Wareham Stream': 5, 'Sheepwash Channel': 9,
  'Oxford Canal': 9, 'Isis Canal': 8, 'Osney Pool': 14,
};
const KIND_W = { river: 10, canal: 9, stream: 3.5, ditch: 1.2, drain: 1.2 };

// Pass 7: the water mesh is one always-drawn draw. Banks and channel centre lines are simplified to within TOL metres
// (the map digitises gentle curves every metre or two) and the round ends are octagons; the triangles that saves in
// EVERY view (ctx.stats.alwaysSaved7) are what the quad-facing walls' depth may spend (TileBatcher.dynOpen).
const TOL = 0.3;
export function buildWater(ctx) {
  const { map, batch, ov } = ctx;
  let saved = 0;
  const eastX = batch.eastX === undefined ? Infinity : batch.eastX;   // (savings in the East Oxford tiles are not "always drawn")
  for (const a of map.areas) {
    if (a.kind !== 'water' || ov.skip.has(a.id)) continue;
    const poly0 = cleanRing(a.poly); if (poly0.length < 3) continue;
    const poly = simplifyRing(poly0, TOL);
    const [cx, cz] = polyCentroid(poly);
    const buf = batch.buf('water', cx, cz);
    buf.e = 0;
    const holes0 = (a.holes || []).map((h) => cleanRing(h)).filter((h) => h.length >= 3), holes = holes0.map((h) => simplifyRing(h, TOL));
    if (!(cx >= eastX)) { saved += poly0.length - poly.length; for (let i = 0; i < holes.length; i++) saved += holes0[i].length - holes[i].length; }
    // graphics pass 2: a shore band (aEdge 1 at the bank -> 0 a few metres out, 8 mm above the surface) so lakes and
    // ponds get the same darker, greener margins as the rivers
    buf.e = 0; flatPoly(buf, poly, holes, Y.water, 1);
    if (batch.has('waterEdge') && poly0.length <= 120) shoreBand(batch.buf('waterEdge', cx, cz), poly, holes);   // (the pass-6 test, on the unsimplified ring: no lake gains a band)
  }
  // stone pass (2026-11): the water shader draws a dark lip where aEdge reaches 1 (the bank). Ribbon edges that lie in
  // other water (a stream joining a river, a ribbon down the middle of a riverbank polygon) and the round end caps
  // (junctions) are not banks: they get aEdge 0.75, which keeps the lip off them.
  const wetAreas = [];
  for (const a of map.areas) if (a.kind === 'water' && !ov.skip.has(a.id)) { const r = cleanRing(a.poly); if (r.length >= 3) wetAreas.push({ r, bb: polyBounds(r), holes: (a.holes || []).map((h) => cleanRing(h)).filter((h) => h.length >= 3) }); }
  const lines = [];
  for (const w of map.waterlines) {
    if (w.tunnel || ov.skip.has(w.id)) continue;
    const pts = cleanLine(w.pts, 0.1); if (pts.length < 2) continue;
    lines.push({ w, pts, hw: (w.cw || (w.name && WIDTH[w.name]) || (w.kind === 'river' ? KIND_W.river : (w.w && w.w < 14 ? w.w : KIND_W[w.kind] || 3))) / 2 });
  }
  const GC = 24, grid = new Map(), gk = (i, j) => i * 65536 + j;
  for (const L of lines) for (let i = 0; i < L.pts.length - 1; i++) {
    const a = L.pts[i], b = L.pts[i + 1], sg = { L, a, b };
    for (let gi = Math.floor((Math.min(a[0], b[0]) - L.hw) / GC); gi <= Math.floor((Math.max(a[0], b[0]) + L.hw) / GC); gi++)
      for (let gj = Math.floor((Math.min(a[1], b[1]) - L.hw) / GC); gj <= Math.floor((Math.max(a[1], b[1]) + L.hw) / GC); gj++) { const k = gk(gi, gj); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(sg); }
  }
  const inOtherWater = (x, z, self) => {
    for (const A of wetAreas) if (x >= A.bb.minX && x <= A.bb.maxX && z >= A.bb.minZ && z <= A.bb.maxZ && pointInPoly(x, z, A.r) && !A.holes.some((h) => pointInPoly(x, z, h))) return true;
    const c = grid.get(gk(Math.floor(x / GC), Math.floor(z / GC)));
    if (c) for (const { L, a, b } of c) if (L.w !== self && distToSeg(x, z, a[0], a[1], b[0], b[1]) < L.hw) return true;
    return false;
  };
  for (const w of map.waterlines) {
    if (w.tunnel || ov.skip.has(w.id)) continue;
    const pts0 = cleanLine(w.pts, 0.1); if (pts0.length < 2) continue;
    const pts = simplifyLine(pts0, TOL); if (!(pts[pts.length >> 1][0] >= eastX)) saved += (pts0.length - pts.length) * 4 + 4;
    const width = w.cw || (w.name && WIDTH[w.name]) || (w.kind === 'river' ? KIND_W.river : (w.w && w.w < 14 ? w.w : KIND_W[w.kind] || 3));
    const mid = pts[pts.length >> 1];
    const buf = batch.buf('water', mid[0], mid[1]);
    const hw = width / 2;
    let prev = null;
    for (let i = 0; i < pts.length; i++) {
      const [nx, nz, m] = miterAt(pts, i), x = pts[i][0], z = pts[i][1];
      const lx = x + nx * hw * m, lz = z + nz * hw * m, rx = x - nx * hw * m, rz = z - nz * hw * m;
      buf.e = inOtherWater(x + nx * (hw * m + 0.6), z + nz * (hw * m + 0.6), w) ? 0.75 : 1; const L = buf.v(lx, Y.water, lz, 0, 1, 0, 0, 0);
      buf.e = 0; const C = buf.v(x, Y.water, z, 0, 1, 0, 0, 0);
      buf.e = inOtherWater(x - nx * (hw * m + 0.6), z - nz * (hw * m + 0.6), w) ? 0.75 : 1; const R = buf.v(rx, Y.water, rz, 0, 1, 0, 0, 0);
      if (prev) { buf.quadFacing(prev[0], prev[1], C, L, 0, 1, 0); buf.quadFacing(prev[1], prev[2], R, C, 0, 1, 0); }
      prev = [L, C, R];
    }
    // round-ish ends so joins between waterways have no notches
    for (const p of [pts[0], pts[pts.length - 1]]) {
      buf.e = 0; const c = buf.v(p[0], Y.water, p[1], 0, 1, 0, 0, 0);
      const ring = [];
      buf.e = 0.75;
      const ro = hw / Math.cos(Math.PI / 8);   // an octagon round the circle the 10-gon was drawn in
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ring.push(buf.v(p[0] + Math.cos(a) * ro, Y.water, p[1] + Math.sin(a) * ro, 0, 1, 0, 0, 0)); }
      for (let k = 0; k < 8; k++) buf.triFacing(c, ring[k], ring[(k + 1) % 8], 0, 1, 0);
    }
    ctx.waterSegs.push({ pts: pts0, w: width });   // (tree placement keeps the mapped line)
  }
  ctx.stats.alwaysSaved7 = (ctx.stats.alwaysSaved7 || 0) + saved;
}

// ---------------------------------------------------------------- shore band for water areas
// A strip from each ring (aEdge 1) to its inset copy (aEdge 0), lifted 8 mm over the water polygon. Inset points that
// would land on land (narrow arms, islands close to the bank) collapse back onto the bank, so the band never leaves
// the water; overlaps inside the water are harmless (same shading).
const LIFT = 0.008;
function insetPoint(ring, i, d, sg) {
  const n = ring.length, p = ring[(i + n - 1) % n], c = ring[i], q = ring[(i + 1) % n];
  let ax = c[0] - p[0], az = c[1] - p[1], bx = q[0] - c[0], bz = q[1] - c[1];
  const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1; ax /= la; az /= la; bx /= lb; bz /= lb;
  let nx = -(az + bz), nz = ax + bx; const ln = Math.hypot(nx, nz);
  if (ln < 1e-4) { nx = -az; nz = ax; } else { nx /= ln; nz /= ln; }
  const cosHalf = Math.max(0.4, nx * -az + nz * ax);
  const m = d / cosHalf;
  return [c[0] + nx * m * sg, c[1] + nz * m * sg];
}
function ringDist(x, z, rings) {
  let d = 1e9;
  for (const r of rings) for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; d = Math.min(d, distToSeg(x, z, a[0], a[1], b[0], b[1])); }
  return d;
}
function shoreBand(buf, poly, holes) {
  const bb = polyBounds(poly), size = Math.min(bb.maxX - bb.minX, bb.maxZ - bb.minZ);
  if (size < 5 || poly.length > 120) return false;     // lakes and ponds; big riverbank polygons cost too many triangles
  const d = Math.min(3.5, size * 0.18), rings = [poly, ...holes];
  const wet = (x, z) => pointInPoly(x, z, poly) && !holes.some((h) => pointInPoly(x, z, h));
  const y = Y.water + LIFT;
  for (let k = 0; k < rings.length; k++) {
    const r = rings[k], n = r.length;
    // inside of the water: for the outer ring towards its interior, for holes away from the island
    const sg0 = signedArea(r) > 0 ? 1 : -1, sg = k === 0 ? sg0 : -sg0;
    let inner = r.map((_, i) => insetPoint(r, i, d, sg));
    // wrong way round (the sign convention differs per ring)? flip once if most points left the water
    if (inner.filter((p) => !wet(p[0], p[1])).length > n / 2) inner = r.map((_, i) => insetPoint(r, i, d, -sg));
    for (let i = 0; i < n; i++) {
      const p = inner[i];
      if (!wet(p[0], p[1]) || ringDist(p[0], p[1], rings) < d * 0.45) inner[i] = r[i];
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      buf.e = 1; const a = buf.v(r[i][0], y, r[i][1], 0, 1, 0, 0, 0), b = buf.v(r[j][0], y, r[j][1], 0, 1, 0, 0, 0);
      buf.e = 0; const c = buf.v(inner[j][0], y, inner[j][1], 0, 1, 0, 0, 0), e = buf.v(inner[i][0], y, inner[i][1], 0, 1, 0, 0, 0);
      buf.quadFacing(a, b, c, e, 0, 1, 0);
    }
  }
  buf.e = 0;
  return true;
}
