// Streetscape grass: blade clumps near the camera on every tier (radius and spacing by tier), written into the
// streetscape's one merged mesh (no draw of its own). Positions are a hash of a fixed world grid, so a clump is always
// in the same place for everyone; refilled when the camera has moved a couple of metres.
//
// What grows where: town grass and verges get rough grass with buttercups and daisies, parks a mown sward with clover
// and daisies, gardens short grass and flowers, meadows long grass; within ~2.5 m of a hedge, fence, wall or the
// water's edge everything grows longer and flowers (the strimmer misses it). Not on college lawns (immaculate, and
// the quads are the colleges'), pitches, paths, roads, under buildings or inside a place module's own field.
import { h3 } from './_street_place.js';

const KINDS = { park: 'park', garden: 'garden', grass: 'grass', meadow: 'meadow', scrub: 'meadow' };
const BLOCK = new Set(['pitch', 'paved', 'parking', 'flowerbed', 'sand', 'bridge', 'pier', 'water']);
// tint (linear multipliers of the atlas blades) per kind: sward greens, a drier meadow
const TINT = { park: [0.86, 1.0, 0.8], garden: [0.9, 1.04, 0.82], grass: [0.95, 1.0, 0.82], meadow: [1.02, 0.98, 0.78] };

export function createGrass(env) {
  const { map, util, gh, Y, inCollege, excl } = env;
  const { pointInPoly, polyBounds, distToSeg } = util;
  const G = 64, grid = new Map(), key = (i, j) => i * 65536 + j;
  const add = (bb, rec) => { for (let i = Math.floor(bb.minX / G); i <= Math.floor(bb.maxX / G); i++) for (let j = Math.floor(bb.minZ / G); j <= Math.floor(bb.maxZ / G); j++) { const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(rec); } };
  for (const a of map.areas) {
    const kind = KINDS[a.kind], block = BLOCK.has(a.kind); if (!kind && !block) continue;
    if (env.skip && env.skip.has(a.id)) continue;
    const bb = polyBounds(a.poly); add(bb, { poly: a.poly, holes: a.holes || [], bb, kind, block });
  }
  // edges where grass grows long: hedges, fences, walls, railings, banks
  const edges = new Map(), E = 16, ek = (i, j) => i * 65536 + j;
  const addEdge = (ax, az, bx, bz) => { for (let i = Math.floor((Math.min(ax, bx) - 3) / E); i <= Math.floor((Math.max(ax, bx) + 3) / E); i++) for (let j = Math.floor((Math.min(az, bz) - 3) / E); j <= Math.floor((Math.max(az, bz) + 3) / E); j++) { const k = ek(i, j); let a = edges.get(k); if (!a) edges.set(k, (a = [])); a.push([ax, az, bx, bz]); } };
  for (const b of map.barriers) if (b.pts) for (let i = 0; i < b.pts.length - 1; i++) addEdge(b.pts[i][0], b.pts[i][1], b.pts[i + 1][0], b.pts[i + 1][1]);
  for (const a of map.areas) if (a.kind === 'water') for (let i = 0; i < a.poly.length; i++) { const p = a.poly[i], q = a.poly[(i + 1) % a.poly.length]; addEdge(p[0], p[1], q[0], q[1]); }
  for (const w of map.waterlines) if (w.pts && !w.tunnel) for (let i = 0; i < w.pts.length - 1; i++) addEdge(w.pts[i][0], w.pts[i][1], w.pts[i + 1][0], w.pts[i + 1][1]);
  const nearEdge = (x, z) => { const a = edges.get(ek(Math.floor(x / E), Math.floor(z / E))); if (a) for (const s of a) if (distToSeg(x, z, s[0], s[1], s[2], s[3]) < 2.4) return true; return false; };

  const inside = (r, x, z) => x >= r.bb.minX && x <= r.bb.maxX && z >= r.bb.minZ && z <= r.bb.maxZ && pointInPoly(x, z, r.poly) && !r.holes.some((h) => pointInPoly(x, z, h));
  const cache = new Map(), CELL = 2;
  /** kind of grass in the 2 m cell of (x, z): '' none, else park|garden|grass|meadow (+ '+' near an edge) */
  function cellKind(x, z) {
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL), ck = ci * 100003 + cj;
    let v = cache.get(ck); if (v !== undefined) return v;
    const cx = (ci + 0.5) * CELL, cz = (cj + 0.5) * CELL;
    v = '';
    const list = grid.get(key(Math.floor(cx / G), Math.floor(cz / G)));
    if (list) {
      let kind = '', block = false;
      for (const r of list) if (inside(r, cx, cz)) { if (r.block) block = true; else if (!kind || r.kind === 'meadow') kind = r.kind; }
      if (kind && !block && !(kind !== 'meadow' && inCollege(cx, cz)) && !excl(cx, cz)) v = kind + (nearEdge(cx, cz) ? '+' : '');
    }
    if (cache.size > 80000) cache.clear();
    cache.set(ck, v);
    return v;
  }
  const isGround = (x, z) => { const h = gh(x, z); return h <= Y.area2 + 0.004; };   // not a road, path or pavement

  /** write clumps around (cx, cz) through emit(proto, x, z, yaw, scale, tint) -> number written */
  function fill(cx, cz, R, step, emit, max) {
    let n = 0;
    const i0 = Math.floor((cx - R) / step), i1 = Math.floor((cx + R) / step), j0 = Math.floor((cz - R) / step), j1 = Math.floor((cz + R) / step);
    for (let i = i0; i <= i1 && n < max; i++) for (let j = j0; j <= j1 && n < max; j++) {
      const hh = h3(i, j, 51);
      const x = (i + 0.1 + 0.8 * h3(i, j, 52)) * step, z = (j + 0.1 + 0.8 * h3(i, j, 53)) * step, dx = x - cx, dz = z - cz, d = Math.sqrt(dx * dx + dz * dz);
      if (d > R) continue;
      // thinning towards the edge of the radius and in slow patches, so the sward is clumpy rather than a carpet
      const patch = 0.55 + 0.25 * Math.sin(x * 0.13 + Math.sin(z * 0.09) * 2) * Math.sin(z * 0.11 + 1.3) + 0.2 * Math.sin(x * 0.41 + z * 0.33);
      if (hh > patch * Math.min(1, (R - d) / (R * 0.35) + 0.15)) continue;
      const k = cellKind(x, z); if (!k || !isGround(x, z)) continue;
      const edge = k.endsWith('+'), kind = edge ? k.slice(0, -1) : k, r2 = h3(i, j, 54);
      let proto, sc = 0.8 + 0.5 * h3(i, j, 55);
      if (edge || kind === 'meadow') proto = r2 < 0.55 ? 'gLong' : r2 < 0.85 ? 'gFlower' : 'gShort', sc *= 1.15;
      else if (kind === 'park') proto = r2 < 0.62 ? 'gShort' : r2 < 0.85 ? 'gClover' : r2 < 0.95 ? 'gFlower' : 'gLong';
      else if (kind === 'garden') proto = r2 < 0.6 ? 'gShort' : r2 < 0.8 ? 'gFlower' : 'gClover';
      else proto = r2 < 0.4 ? 'gShort' : r2 < 0.72 ? 'gLong' : r2 < 0.88 ? 'gFlower' : 'gClover';
      sc *= 1 + Math.max(0, d - 6) * 0.03;           // a little bigger further out: fewer clumps, same cover
      const t = TINT[kind] || TINT.grass, tv = 0.88 + 0.24 * h3(i, j, 56);
      if (emit(proto, x, z, hh * 40, sc, [t[0] * tv, t[1] * tv, t[2] * tv])) n++; else return n;
    }
    return n;
  }
  return { fill, cellKind };
}
