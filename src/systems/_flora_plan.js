// Flora pass (2026-11): where every small plant stands. Pure and DOM-free (node-tested: tools/smoke_flora.mjs); owned by
// systems/flora.js, which draws what this plans. Nothing is stored for the whole map: the world is cut into 16 m cells
// and a cell is planned the first time the camera comes near it, from position hashes of the shared map data only (no
// system random numbers, no clock), so every player gets the same plants in the same places. A lower quality tier shows a fixed
// subset of the same plants (each has a rank 0..1; a tier draws the ranks below its density).
//
// Rules by kind of place (docs/ARCHITECTURE.md "Flora and insects"):
//   flowerbeds        dense herbaceous planting in drifts: tall spikes in the middle, mounds at the edge, clipped box
//                     along the edge of the big beds
//   gardens, formal   borders along about half the walls, hedges and house walls (tall at the back, low at the front),
//   parks             wildflower strips beside some paths, bluebells and cow parsley round the trees, daisies and
//                     clover in patches on PUBLIC park grass only (college lawns and pitches stay bare)
//   meadows           buttercups in broad patches, ox-eye daisies, clover, long tufts, the odd thistle and dock, cow
//                     parsley along hedges and banks; snake's-head fritillaries in Magdalen's meadow
//   woods, scrub      ferns, bluebell drifts, ivy, nettles, cow parsley by the paths
//   water             reeds, rushes and yellow flag at the edge (reeds in the first metre of water), waterlilies on
//                     ponds and lakes, nettles and willowherb on rough banks
//   churchyards       primroses, cow parsley, long grass
//   streets           tufts and weeds in the pits of pavement trees, weeds / ferns / ivy / red valerian / the odd
//                     buddleia at the foot of walls and fences, weeds on verges
// Never on a carriageway, path or (except the tree pits and the wall joint) a pavement, in a building, inside the drawn
// thickness of a wall or hedge, in water (except the water plants), on a pitch or lawn, or in a site a place module
// rebuilt by hand.
import { SpatialGrid, pointInPoly, polyBounds, distToSeg, signedArea } from '../world/util.js';
import { barrierGap, BARRIER_HALF } from './_clearance.js';
import * as PM from '../places/_pm_site.js';

export const CELL = 16;
// [name, atlas cell, width m, height m, range class (0 small, 1 medium, 2 tall / border), flat, nectar, water plant]
const K = (name, w, h, rc, o = {}) => ({ name, w, h, rc, flat: !!o.flat, nectar: !!o.nectar, water: !!o.water });
export const KINDS = [
  K('tuft', 0.5, 0.3, 0), K('weed', 0.34, 0.2, 0, { nectar: 1 }), K('daisy', 0.55, 0, 0, { flat: 1, nectar: 1 }), K('buttercup', 0.46, 0.38, 1, { nectar: 1 }),
  K('clover', 0.5, 0, 0, { flat: 1, nectar: 1 }), K('oxeye', 0.5, 0.55, 1, { nectar: 1 }), K('cowparsley', 0.8, 1.0, 2, { nectar: 1 }), K('thistle', 0.5, 0.9, 1, { nectar: 1 }),
  K('dock', 0.45, 0.8, 1), K('nettle', 0.62, 0.85, 1), K('willowherb', 0.6, 1.3, 2, { nectar: 1 }), K('reed', 0.9, 1.8, 2, { water: 1 }),
  K('iris', 0.62, 0.9, 1, { nectar: 1, water: 1 }), K('rush', 0.6, 0.7, 1, { water: 1 }), K('lily', 0.95, 0, 1, { flat: 1, water: 1 }), K('fern', 0.95, 0.65, 1),
  K('ivy', 0.6, 0.28, 0), K('moss', 0.42, 0, 0, { flat: 1 }), K('buddleia', 1.3, 1.7, 2, { nectar: 1 }), K('valerian', 0.5, 0.6, 1, { nectar: 1 }),
  K('delphinium', 0.55, 1.35, 2, { nectar: 1 }), K('lupin', 0.5, 1.05, 2, { nectar: 1 }), K('rose', 0.9, 0.95, 2, { nectar: 1 }), K('lavender', 0.66, 0.5, 1, { nectar: 1 }),
  K('geranium', 0.6, 0.4, 1, { nectar: 1 }), K('allium', 0.45, 0.85, 2, { nectar: 1 }), K('grass', 0.8, 1.0, 2), K('bluebell', 0.62, 0.42, 1, { nectar: 1 }),
  K('primrose', 0.36, 0.17, 0, { nectar: 1 }), K('bedding', 0.45, 0.3, 1, { nectar: 1 }), K('fritillary', 0.4, 0.34, 1, { nectar: 1 }), K('box', 0.62, 0.5, 2),
];
export const KI = Object.fromEntries(KINDS.map((k, i) => [k.name, i]));
/** how far each range class is drawn (m) before the tier's scale */
export const RANGE = [44, 62, 96];
export const HAB = { none: 0, lawn: 1, formal: 2, park: 3, meadow: 4, wood: 5, scrub: 6, church: 7, verge: 8, sports: 9, bed: 10, hard: 11 };
const PRIO = [0, 7, 4, 2, 2.5, 4.5, 4.4, 5, 3, 6, 9, 8];

/** integer hash -> [0, 1) */
export const hh = (a, b, c = 0) => { let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
/** smooth value noise in [0, 1], s metres a cell */
export function vn(x, z, s, seed) {
  const fx = x / s, fz = z / s, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = hh(ix, iz, seed), b = hh(ix + 1, iz, seed), c = hh(ix, iz + 1, seed), d = hh(ix + 1, iz + 1, seed);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

const COLLEGE_RE = /College|Hall|Christ Church|House|Blackfriars|Wycliffe|St Stephen|Cohen Quad/;
const NOT_COLLEGE_RE = /Science|Department|Faculty|School|Quarter|Centre|Library|Institute|Triangle|Acland|Examination|Smith|Statistics|Sociology|History|Education|Rhodes|Maison|Development|Botanic|Meadow|Castle|Museum|Weston/;
const SPORT_RE = /Sports|Playing|Recreation|School Field|Rugby|Football|Cricket|Playground|Fields?$/;
const MEADOW_RE = /Meadow|Nature|Mead\b/;
const STILL_RE = /Lake|Pond|Water Garden|Bog/;
const PATHS = new Set(['footway', 'path', 'cycleway', 'steps', 'track', 'bridleway', 'pedestrian', 'service', 'corridor']);

// border palettes: [tall (back / middle), mid, low (front)]
const PAL = [
  [KI.delphinium, KI.lupin, KI.geranium], [KI.allium, KI.rose, KI.lavender], [KI.grass, KI.rose, KI.bedding], [KI.allium, KI.grass, KI.lavender],
  [KI.lupin, KI.fern, KI.geranium], [KI.delphinium, KI.rose, KI.lavender], [KI.lupin, KI.allium, KI.geranium],
];

/**
 * env: { map, skip (Set of overridden ids), groundHeight(x, z), collider, buildingGrid (world.buildingGrid), baseGreen(x, z) | null,
 *        trees: [[x, z, h, bush]] }
 * -> { cell(ci, cj) -> {n, d: Float32Array(n * 8) [x, y, z, rot, w, h, kind (+64 = flat), range class], rank: Float32Array, kind: Uint8Array},
 *      habitatAt(x, z), stats }
 */
export function createFloraPlan(env) {
  const { map, skip, groundHeight, collider, buildingGrid, baseGreen } = env;
  const stats = { cells: 0, plants: 0, ms: 0, worstMs: 0, byKind: new Int32Array(KINDS.length), t: [0, 0, 0, 0, 0], worstAt: [0, 0] };   // t: ms in [gathering, beds, scatter, trees, wall feet]
  // ---------------------------------------------------------------- one-off preparation (a few ms)
  const colleges = (map.sites || []).filter((s) => s.kind === 'university' && COLLEGE_RE.test(s.name) && !NOT_COLLEGE_RE.test(s.name)).map((s) => ({ s, bb: polyBounds(s.poly) }));
  const inSite = (list, x, z) => { for (const { s, bb } of list) if (x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && pointInPoly(x, z, s.poly)) return true; return false; };
  const magd = (map.sites || []).filter((s) => /^Magdalen College$/.test(s.name)).map((s) => ({ s, bb: polyBounds(s.poly) }));
  const polyArea = (p) => Math.abs(signedArea(p));
  const centre = (p) => { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; };
  const areaGrid = new SpatialGrid(48), siteGrid = new SpatialGrid(48), stillGrid = new SpatialGrid(48);
  for (const a of map.areas || []) {
    if (!a.poly || a.poly.length < 3) continue;
    const bb = polyBounds(a.poly);
    if (skip.has(a.id)) { if (a.kind !== 'water') siteGrid.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, { poly: a.poly, bb }); continue; }
    const name = a.name || '', [cx, cz] = centre(a.poly);
    if (a.kind === 'water') {
      const A = polyArea(a.poly); let per = 0; for (let i = 0; i < a.poly.length; i++) { const p = a.poly[i], q = a.poly[(i + 1) % a.poly.length]; per += Math.hypot(q[0] - p[0], q[1] - p[1]); }
      if (!/Fountain|Lock/.test(name) && (STILL_RE.test(name) || (A > 60 && A < 5000 && A / (per * per) > 0.03))) stillGrid.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, { poly: a.poly, holes: a.holes || [], bb });
      continue;
    }
    let hab = -1, formal = false, frit = false, public_ = false;
    switch (a.kind) {
      case 'flowerbed': hab = HAB.bed; break;
      case 'pitch': hab = HAB.lawn; break;
      case 'paved': case 'parking': case 'bridge': case 'pier': case 'sand': hab = HAB.hard; break;
      case 'grass': hab = /Cemetery|Churchyard/.test(name) ? HAB.church : inSite(colleges, cx, cz) || inSite(colleges, a.poly[0][0], a.poly[0][1]) ? HAB.lawn : HAB.verge; break;
      case 'garden': hab = /Allotment/.test(name) ? HAB.hard : HAB.formal; formal = true; break;
      case 'park': hab = SPORT_RE.test(name) ? HAB.sports : MEADOW_RE.test(name) ? HAB.meadow : HAB.park; formal = /University Parks|Headington Hill Park|Botanic/.test(name) || !name; public_ = true; break;
      case 'meadow': hab = HAB.meadow; frit = inSite(magd, cx, cz); break;
      case 'wood': hab = HAB.wood; break;
      case 'scrub': hab = HAB.scrub; break;
      default: continue;
    }
    // The Plain's roundabout island: municipal bedding (the one traffic island the map draws as a garden)
    const bedding = (a.kind === 'garden' || a.kind === 'grass') && Math.hypot(cx - 1093, cz - 540) < 26;
    areaGrid.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, { poly: a.poly, holes: a.holes || [], bb, hab, prio: PRIO[hab], formal, frit, public_, bedding, big: a.kind === 'flowerbed' && polyArea(a.poly) > 40, id: a.id });
  }
  // Port Meadow lies outside the map's bounds, drawn by its own module (places/port_meadow.js): a meadow here too
  { const bb = polyBounds(PM.MEADOW); areaGrid.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, { poly: PM.MEADOW, holes: [], bb, hab: HAB.meadow, prio: PRIO[HAB.meadow], pm: true, id: 'pm' }); }
  for (const b of map.buildings || []) if (skip.has(b.id) && b.poly && b.poly.length >= 3) { const bb = polyBounds(b.poly); siteGrid.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, { poly: b.poly, bb }); }
  const pathGrid = new SpatialGrid(32);
  for (const r of map.roads || []) {
    if (!r.pts || r.pts.length < 2 || skip.has(r.id) || r.tunnel || !PATHS.has(r.kind)) continue;
    const hw = (r.w || 2) / 2;
    for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; pathGrid.insertSeg(a[0], a[1], b[0], b[1], { ax: a[0], az: a[1], bx: b[0], bz: b[1], hw }); }
  }
  const barGrid = new SpatialGrid(32);
  for (const w of map.barriers || []) {
    if (!w.pts || w.pts.length < 2 || skip.has(w.id) || BARRIER_HALF[w.kind] === undefined) continue;
    for (let i = 0; i < w.pts.length - 1; i++) { const a = w.pts[i], b = w.pts[i + 1]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) continue; barGrid.insertSeg(a[0], a[1], b[0], b[1], { ax: a[0], az: a[1], bx: b[0], bz: b[1], half: BARRIER_HALF[w.kind], kind: w.kind, h: w.h || 1.5, id: w.id, i }); }
  }
  const gateGrid = new SpatialGrid(32);
  for (const g of map.gates || []) if (g.p) gateGrid.insertPoint(g.p[0], g.p[1], g);
  for (const p of map.pois || []) if (p.p && (p.kind === 'crossing' || p.kind === 'traffic_signals')) gateGrid.insertPoint(p.p[0], p.p[1], p);
  const treeCells = new Map(), ckey = (i, j) => (i + 32768) * 65536 + (j + 32768);
  for (const t of env.trees || []) { if (!(Math.abs(t[0]) < 1e6)) continue; const k = ckey(Math.floor(t[0] / CELL), Math.floor(t[1] / CELL)); let a = treeCells.get(k); if (!a) treeCells.set(k, (a = [])); a.push(t); }
  const churches = new SpatialGrid(64);
  for (const b of map.buildings || []) { const t = b.tags || {}; if ((t.building === 'church' || t.building === 'chapel' || t.amenity === 'place_of_worship') && b.c && !b.part) churches.insertPoint(b.c[0], b.c[1], b); }
  const boxes = map.boxes && map.boxes.length ? map.boxes : [map.bounds];
  const inMap = (x, z) => { for (const b of boxes) if (x > b.minX + 2 && x < b.maxX - 2 && z > b.minZ + 2 && z < b.maxZ - 2) return true; return false; };

  // ---------------------------------------------------------------- scratch for one cell (reused: nothing allocated per point)
  let cap = 512, D = new Float32Array(cap * 8), RK = new Float32Array(cap), KD = new Uint8Array(cap), n = 0;
  const grow = () => { cap *= 2; const d = new Float32Array(cap * 8); d.set(D); D = d; const r = new Float32Array(cap); r.set(RK); RK = r; const k = new Uint8Array(cap); k.set(KD); KD = k; };
  const areas = [], paths = [], bars = [], blds = [], sites = [], stills = [], gates = [];
  const WN = CELL + 8, wet = new Uint8Array(WN * WN);
  let wx0 = 0, wz0 = 0, hasWater = false, cx0 = 0, cz0 = 0;

  const inside = (r, x, z) => x >= r.bb.minX && x <= r.bb.maxX && z >= r.bb.minZ && z <= r.bb.maxZ && pointInPoly(x, z, r.poly) && !(r.holes && r.holes.some((h) => pointInPoly(x, z, h)));
  let _rec = null;
  // aFull[i] = 1: no edge of areas[i] comes near the cell and the cell is inside it (most cells of a big park: no polygon test per point)
  const aFull = [];
  const edgeInBox = (r, bx0, bz0, bx1, bz1) => {
    for (let h = -1; h < (r.holes ? r.holes.length : 0); h++) { const P = h < 0 ? r.poly : r.holes[h]; for (let a = 0, b = P.length - 1; a < P.length; b = a++) { const p = P[a], q = P[b]; if ((p[0] > q[0] ? p[0] : q[0]) >= bx0 && (p[0] < q[0] ? p[0] : q[0]) <= bx1 && (p[1] > q[1] ? p[1] : q[1]) >= bz0 && (p[1] < q[1] ? p[1] : q[1]) <= bz1) return true; } }
    return false;
  };
  /** the habitat at a point (areas of the current cell) -> HAB.*, the winning record in _rec */
  function habOf(x, z) {
    let best = null;
    for (let i = 0; i < areas.length; i++) { const r = areas[i]; if (best && r.prio <= best.prio) continue; if (aFull[i] || inside(r, x, z)) best = r; }
    _rec = best;
    if (best && best.pm && (PM.inRiver(x, z) || PM.inFlood(x, z) || PM.distToLine(x, z, PM.PATH) < 1.6 || pointInPoly(x, z, PM.CAR_PARK))) { _rec = null; return HAB.hard; }
    return best ? best.hab : HAB.none;
  }
  const inBld = (x, z) => {
    for (let i = 0; i < blds.length; i++) { const b = blds[i], bb = b.bb; if (x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && pointInPoly(x, z, b.poly)) return true; }
    for (let i = 0; i < sites.length; i++) { const b = sites[i], bb = b.bb; if (x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && pointInPoly(x, z, b.poly)) return true; }
    return false;
  };
  const dPath = (x, z) => { let d = 9; for (let i = 0; i < paths.length; i++) { const p = paths[i], q = distToSeg(x, z, p.ax, p.az, p.bx, p.bz) - p.hw; if (q < d) d = q; } return d; };
  let _barKind = '', _barNz = 0;
  /** metres to the nearest drawn wall / hedge / fence face (9 = none near); its kind in _barKind */
  const dBar = (x, z) => { let d = 9; _barKind = ''; for (let i = 0; i < bars.length; i++) { const p = bars[i], q = distToSeg(x, z, p.ax, p.az, p.bx, p.bz) - p.half; if (q < d) { d = q; _barKind = p.kind; } } return d; };
  /** metres to the nearest building wall (9 = none near); _barNz = z of the unit vector from the wall to the point */
  const dBld = (x, z) => {
    let d = 9;
    for (let k = 0; k < blds.length; k++) {
      const b = blds[k], bb = b.bb; if (x < bb.minX - 3 || x > bb.maxX + 3 || z < bb.minZ - 3 || z > bb.maxZ + 3) continue;
      const P = b.poly;
      for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length], q = distToSeg(x, z, a[0], a[1], c[0], c[1]); if (q < d) d = q; }
    }
    return d;
  };
  const wetAt = (x, z) => { const i = Math.round(x - wx0), j = Math.round(z - wz0); return i >= 0 && j >= 0 && i < WN && j < WN ? wet[j * WN + i] : 0; };
  /** metres (1 m steps) from a dry point to water / from a wet point to dry ground, up to 4 (9 = further) */
  const dShore = (x, z, want) => {
    const ci = Math.round(x - wx0), cj = Math.round(z - wz0); let best = 81;
    for (let j = Math.max(0, cj - 4); j <= Math.min(WN - 1, cj + 4); j++) for (let i = Math.max(0, ci - 4); i <= Math.min(WN - 1, ci + 4); i++) {
      if (wet[j * WN + i] !== want) continue;
      const dx = wx0 + i - x, dz = wz0 + j - z, d2 = dx * dx + dz * dz; if (d2 < best) best = d2;
    }
    return best >= 81 ? 9 : Math.max(0, Math.sqrt(best) - 0.5);
  };
  const okGround = (x, z) => groundHeight(x, z) <= 0.032;
  // anything solid within r m — but only what is the same for every player at every moment: parked and moving cars,
  // street items (wheelie bins are out one game day in seven; a knocked-over bin has no collider) and lamp posts are
  // not asked (Collider.isFree would count them, and the plan would depend on the day a cell was first seen)
  const DYNAMIC = { car: 1, street: 1, lamp: 1 };
  const solidAt = (x, z, r) => {
    let hit = false;
    collider._near(x - r - 0.7, z - r - 0.7, x + r + 0.7, z + r + 0.7, (s) => {
      if (hit || s.floor || DYNAMIC[s.tag]) return;
      if (s.seg) { if (distToSeg(x, z, s.x1, s.z1, s.x2, s.z2) < r) hit = true; } else if (Math.hypot(x - s.x, z - s.z) < r + (s.r || 0)) hit = true;
    });
    return hit;
  };
  const nearGate = (x, z, r) => { for (let i = 0; i < gates.length; i++) { const g = gates[i].p; if (Math.abs(g[0] - x) < r && Math.abs(g[1] - z) < r) return true; } return false; };
  const inCell = (x, z) => x >= cx0 && x < cx0 + CELL && z >= cz0 && z < cz0 + CELL;

  /** one plant. sz scales the kind's size; rank 0..1 (drawn when rank < the tier's density) */
  function put(x, y, z, kind, sz, rank, seed) {
    if (n >= cap) grow();
    const k = KINDS[kind], o = n * 8, j = 0.82 + 0.36 * hh(seed, 71, kind);
    D[o] = x; D[o + 1] = y + (k.flat ? 0.028 : 0); D[o + 2] = z; D[o + 3] = hh(seed, 13, 5) * 6.2832;
    D[o + 4] = k.w * sz * j; D[o + 5] = k.h * sz * (0.85 + 0.3 * hh(seed, 29, 3)); D[o + 6] = kind + (k.flat ? 64 : 0); D[o + 7] = k.rc;
    RK[n] = rank; KD[n] = kind; n++;
  }
  /** a plant on open ground: clear of paths, buildings, walls, anything solid */
  function land(x, z, kind, sz, rank, seed, clear = 0.22) {
    if (!okGround(x, z) || inBld(x, z)) return false;
    const w = KINDS[kind].w * sz;
    if (dPath(x, z) < clear + w * 0.22) return false;
    if (barrierGap(collider, x, z, 0.6) < 0.12 + w * 0.2) return false;
    if (solidAt(x, z, 0.1)) return false;
    if (hasWater ? wetAt(x, z) || collider.isWater(x, z) : collider.isWater(x, z)) return false;
    put(x, groundHeight(x, z), z, kind, sz, rank, seed);
    return true;
  }

  // ---------------------------------------------------------------- rules
  function border(x, z, depth, seed, r1, shade) {
    // depth: 0 at the back (the wall / the middle of a bed) .. 1 at the front edge
    const pal = PAL[Math.floor(vn(x, z, 7, 91) * 0.999 * PAL.length + (shade ? 4 : 0)) % PAL.length];
    const row = depth < 0.4 ? 0 : depth < 0.72 ? 1 : 2;
    let kind = pal[row];
    if (r1 > 0.86) kind = row === 0 ? KI.grass : row === 1 ? KI.allium : KI.geranium;          // an odd one out now and then
    if (shade && row < 2 && r1 < 0.4) kind = KI.fern;
    return kind;
  }
  function beds(x0, z0, x1, z1) {
    for (const bed of areas) {
      if (bed.hab !== HAB.bed) continue;
      const S = 0.8, bb = bed.bb;
      const i0 = Math.ceil(Math.max(x0, bb.minX) / S), i1 = Math.floor(Math.min(x1 - 1e-6, bb.maxX) / S), j0 = Math.ceil(Math.max(z0, bb.minZ) / S), j1 = Math.floor(Math.min(z1 - 1e-6, bb.maxZ) / S);
      const P = bed.poly, wide = Math.min(bb.maxX - bb.minX, bb.maxZ - bb.minZ);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const r0 = hh(i, j, 201), x = (i + (hh(i, j, 202) - 0.5) * 0.7) * S, z = (j + (hh(i, j, 203) - 0.5) * 0.7) * S;
        if (r0 > 0.68 || !inCell(x, z) || !inside(bed, x, z)) continue;
        let de = 9; for (let k = 0; k < P.length; k++) { const a = P[k], c = P[(k + 1) % P.length], q = distToSeg(x, z, a[0], a[1], c[0], c[1]); if (q < de) de = q; }
        if (de < 0.18 || inBld(x, z) || groundHeight(x, z) > 0.032 || (hasWater && (wetAt(x, z) || collider.isWater(x, z))) || barrierGap(collider, x, z, 0.6) < 0.2) continue;
        const depth = Math.min(1, 1 - de / Math.max(0.5, Math.min(1.6, wide * 0.4)));
        const kind = border(x, z, depth, i * 131 + j, hh(i, j, 204), false);
        put(x, 0.03, z, kind, 0.9 + 0.25 * hh(i, j, 205), hh(i, j, 206), i * 7919 + j * 104729 + 1);
      }
      if (!bed.big) continue;
      // clipped box along the edge of a big bed: a ball every 0.55 m, on every tier
      for (let k = 0; k < P.length; k++) {
        const a = P[k], c = P[(k + 1) % P.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]); if (l < 0.6) continue;
        const m = Math.max(1, Math.round(l / 0.6)), ux = (c[0] - a[0]) / l, uz = (c[1] - a[1]) / l;
        for (let q = 0; q < m; q++) {
          const t = (q + 0.5) / m * l; let x = a[0] + ux * t, z = a[1] + uz * t;
          // 0.2 m inside the bed (whichever side that is)
          if (inside(bed, x - uz * 0.2, z + ux * 0.2)) { x -= uz * 0.2; z += ux * 0.2; } else if (inside(bed, x + uz * 0.2, z - ux * 0.2)) { x += uz * 0.2; z -= ux * 0.2; } else continue;
          if (!inCell(x, z) || inBld(x, z) || groundHeight(x, z) > 0.032 || dPath(x, z) < 0.12 || barrierGap(collider, x, z, 0.6) < 0.2 || (hasWater && (wetAt(x, z) || collider.isWater(x, z)))) continue;
          put(x, 0.03, z, KI.box, 0.95, q % 2 ? 0.5 : 0, k * 977 + q * 31 + 7);
        }
      }
    }
  }
  function scatter(x0, z0) {
    const S = 1.25, i0 = Math.ceil(x0 / S), j0 = Math.ceil(z0 / S), i1 = Math.ceil((x0 + CELL) / S) - 1, j1 = Math.ceil((z0 + CELL) / S) - 1;
    const anyArea = areas.length > 0;
    let church = false;
    churches.queryRadius(x0 + CELL / 2, z0 + CELL / 2, 34, () => { church = true; return true; });
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const r0 = hh(i, j, 1);
      const x = (i + (hh(i, j, 2) - 0.5) * 0.9) * S, z = (j + (hh(i, j, 3) - 0.5) * 0.9) * S;
      if (!inCell(x, z)) continue;
      const seed = i * 7919 + j * 104729, r1 = hh(i, j, 4), rank = hh(i, j, 5);
      const isWet = hasWater && wetAt(x, z);
      if (isWet) { water(x, z, seed, r0, r1, rank); continue; }
      let hab = anyArea ? habOf(x, z) : HAB.none; const rec = _rec;
      if (hab === HAB.hard || hab === HAB.bed) continue;
      // (ground with no landuse that is not drawn as grass — a quay, a gravel surround, a yard — is left alone, by water too)
      if (hab === HAB.none) { if (!baseGreen || !inMap(x, z) || !baseGreen(x, z) || groundHeight(x, z) > 0.005) continue; hab = HAB.verge; }
      if (hasWater && bank(x, z, seed, r0, r1, rank, hab)) continue;
      if (hab === HAB.lawn) continue;
      const dp = dPath(x, z);
      switch (hab) {
        case HAB.formal: case HAB.park: case HAB.sports: {
          const formal = hab === HAB.formal || (rec && rec.formal);
          if (rec && rec.bedding) { const bd = vn(x, z, 7, 81); if (bd > 0.5 && r0 < 0.85) land(x, z, bd > 0.74 && r1 < 0.3 ? KI.box : r1 < 0.7 ? KI.bedding : r1 < 0.88 ? KI.lavender : KI.geranium, 1 + 0.25 * r1, rank, seed); continue; }
          const db = dBar(x, z), bk = _barKind, dbl = dBld(x, z), dw = bk === 'fence' || bk === 'railing' || bk === 'guard_rail' ? dbl : Math.min(db, dbl);
          // herbaceous border along about half the walls, hedges and house walls of gardens and formal parks (not along
          // a fence or a railing: nothing stands behind one)
          if (formal && hab !== HAB.sports && dw > 0.3 && dw < 2.3 && vn(x, z, 15, 31) > 0.42) {
            if (r0 < 0.86) land(x, z, border(x, z, (dw - 0.3) / 2, seed, r1, vn(x, z, 23, 37) > 0.62), 1.05 + 0.25 * r1, rank, seed);
            continue;
          }
          // rough margin where there is no border: long grass, cow parsley, nettles against a hedge or fence
          if (db < 2.4 && db > 0.3 && bk !== 'railing') {
            const p = hab === HAB.formal ? 0.1 : 0.3;
            if (r0 < p) land(x, z, r1 < 0.42 ? KI.cowparsley : r1 < 0.62 ? KI.tuft : r1 < 0.78 ? KI.nettle : r1 < 0.9 ? KI.dock : KI.fern, 0.9 + 0.3 * r1, rank, seed);
            continue;
          }
          if (hab === HAB.sports) continue;
          // wildflower strip beside some lengths of path
          if (rec && rec.public_ && dp > 0.9 && dp < 4.6 && vn(x, z, 26, 41) > 0.6) {
            if (r0 < 0.5) land(x, z, r1 < 0.36 ? KI.oxeye : r1 < 0.62 ? KI.buttercup : r1 < 0.74 ? KI.tuft : r1 < 0.86 ? KI.cowparsley : r1 < 0.94 ? KI.clover : KI.thistle, 0.9 + 0.3 * r1, rank, seed);
            continue;
          }
          // public park grass: daisies and clover in patches, thinning away from the paths; a buttercup here and there
          if (rec && rec.public_) {
            const patch = vn(x, z, 11, 43), fall = 0.3 + 0.7 * Math.exp(-Math.max(0, dp) / 9);
            if (patch > 0.52 && r0 < 0.34 * fall * Math.min(1, (patch - 0.52) * 6)) land(x, z, r1 < 0.6 ? KI.daisy : r1 < 0.85 ? KI.clover : r1 < 0.95 ? KI.buttercup : KI.weed, 0.85 + 0.4 * r1, rank, seed, 0.1);
          }
          break;
        }
        case HAB.meadow: {
          const pm = rec && rec.pm ? 0.5 : 1, db = dBar(x, z);
          if (db < 3.4 && db > 0.3) { if (r0 < 0.42) land(x, z, r1 < 0.62 ? KI.cowparsley : r1 < 0.78 ? KI.nettle : r1 < 0.9 ? KI.tuft : KI.dock, 0.9 + 0.35 * r1, rank, seed); continue; }
          const a = vn(x, z, 19, 51), b = vn(x, z, 27, 53), c = vn(x, z, 13, 57);
          let p = 0.05, kind = KI.tuft;
          if (rec && rec.frit && c > 0.6) { p = 0.5 * Math.min(1, (c - 0.6) * 7); kind = r1 < 0.8 ? KI.fritillary : KI.buttercup; }
          else if (a > 0.5) { p = 0.07 + 0.5 * Math.min(1, (a - 0.5) * 4); kind = r1 < 0.72 ? KI.buttercup : r1 < 0.86 ? KI.tuft : KI.clover; }
          else if (b > 0.58) { p = 0.07 + 0.4 * Math.min(1, (b - 0.58) * 5); kind = r1 < 0.6 ? KI.oxeye : r1 < 0.8 ? KI.tuft : KI.buttercup; }
          else { p = 0.09; kind = r1 < 0.5 ? KI.tuft : r1 < 0.7 ? KI.clover : r1 < 0.84 ? KI.buttercup : r1 < 0.92 ? KI.thistle : KI.dock; }
          if (r0 < p * pm) land(x, z, kind, 0.9 + 0.35 * r1, rank, seed);
          break;
        }
        case HAB.wood: case HAB.scrub: {
          if (hab === HAB.scrub) { if (r0 < 0.22) land(x, z, r1 < 0.3 ? KI.nettle : r1 < 0.5 ? KI.willowherb : r1 < 0.68 ? KI.tuft : r1 < 0.8 ? KI.thistle : r1 < 0.9 ? KI.dock : KI.cowparsley, 0.9 + 0.35 * r1, rank, seed); break; }
          if (dp < 3 && dp > 0.3) { if (r0 < 0.3) land(x, z, r1 < 0.55 ? KI.cowparsley : r1 < 0.8 ? KI.fern : KI.nettle, 0.9 + 0.3 * r1, rank, seed); break; }
          const a = vn(x, z, 14, 61), b = vn(x, z, 10, 63);
          // the bare earth under the trees: bluebell drifts, fern beds, and ivy / grass / nettles between
          if (a > 0.54) { if (r0 < 0.3 + 0.5 * Math.min(1, (a - 0.54) * 7)) land(x, z, r1 < 0.86 ? KI.bluebell : r1 < 0.94 ? KI.fern : KI.tuft, 0.9 + 0.3 * r1, rank, seed); }
          else if (b > 0.5) { if (r0 < 0.3 + 0.35 * Math.min(1, (b - 0.5) * 7)) land(x, z, r1 < 0.7 ? KI.fern : r1 < 0.9 ? KI.ivy : KI.tuft, 0.95 + 0.4 * r1, rank, seed); }
          else if (r0 < 0.32) land(x, z, r1 < 0.34 ? KI.ivy : r1 < 0.62 ? KI.tuft : r1 < 0.78 ? KI.fern : r1 < 0.9 ? KI.nettle : KI.cowparsley, 0.9 + 0.3 * r1, rank, seed);
          break;
        }
        case HAB.church: {
          const a = vn(x, z, 8, 67);
          if (r0 < 0.3) land(x, z, a > 0.55 ? (r1 < 0.7 ? KI.primrose : KI.tuft) : r1 < 0.3 ? KI.cowparsley : r1 < 0.7 ? KI.tuft : r1 < 0.85 ? KI.oxeye : KI.ivy, 0.9 + 0.35 * r1, rank, seed);
          break;
        }
        case HAB.verge: {
          // unmown edges of public grass and the odd weed on a verge; by a church, primroses and cow parsley
          if (church && r0 < 0.12) { land(x, z, r1 < 0.4 ? KI.primrose : r1 < 0.7 ? KI.cowparsley : KI.tuft, 0.9 + 0.3 * r1, rank, seed); break; }
          const p = rec ? 0.07 : 0.03;
          if (r0 < p) land(x, z, r1 < 0.36 ? KI.weed : r1 < 0.62 ? KI.daisy : r1 < 0.84 ? KI.tuft : r1 < 0.93 ? KI.clover : KI.buttercup, 0.85 + 0.35 * r1, rank, seed, 0.1);
          break;
        }
        default:
      }
    }
  }
  /** dry ground beside water: reeds, rushes and yellow flag at the edge; nettles, willowherb and cow parsley behind */
  function bank(x, z, seed, r0, r1, rank, hab) {
    const d = dShore(x, z, 1);
    if (d > 3.6) return false;
    if (hab === HAB.lawn || hab === HAB.hard || hab === HAB.bed) return true;
    if (collider.onBridge && collider.onBridge(x, z)) return true;
    const stretch = vn(x, z, 12, 71);
    if (d < 1.3) { if (stretch > 0.4 && r0 < 0.55) land(x, z, r1 < 0.45 ? KI.reed : r1 < 0.72 ? KI.rush : r1 < 0.9 ? KI.iris : KI.tuft, 0.85 + 0.4 * r1, rank, seed); return true; }
    if (hab === HAB.formal || hab === HAB.sports) return false;
    if (stretch > 0.3 && r0 < 0.26) land(x, z, r1 < 0.34 ? KI.nettle : r1 < 0.56 ? KI.willowherb : r1 < 0.8 ? KI.cowparsley : r1 < 0.92 ? KI.tuft : KI.dock, 0.9 + 0.35 * r1, rank, seed);
    return true;
  }
  /** in the water: reeds in the first metre from the bank, waterlilies on ponds and lakes */
  function water(x, z, seed, r0, r1, rank) {
    const d = dShore(x, z, 0);
    if (d > 7 || r0 > 0.5 || inBld(x, z) || !collider.isWet(x, z)) return;
    if (d < 1.1) { if (vn(x, z, 12, 71) > 0.46 && !solidAt(x, z, 0.1)) put(x, 0.0, z, r1 < 0.75 ? KI.reed : KI.rush, 0.9 + 0.35 * r1, rank, seed); return; }
    if (!stills.length) return;
    let still = false; for (const s of stills) if (inside(s, x, z)) { still = true; break; }
    if (still && vn(x, z, 6, 73) > 0.5 && r0 < 0.42 && !solidAt(x, z, 0.3)) put(x, 0.012, z, KI.lily, 0.8 + 0.5 * r1, rank, seed);
  }
  /** round the trunks: weeds in a pavement tree's pit; bluebells, cow parsley and unmown grass under park trees */
  function trees(ci, cj) {
    const list = treeCells.get(ckey(ci, cj)); if (!list) return;
    for (const t of list) {
      const tx = t[0], tz = t[1]; if (t[3]) continue;                       // not round bushes
      const ti = Math.round(tx * 10), tj = Math.round(tz * 10), g0 = groundHeight(tx, tz), trunk = 0.05 + 0.03 * (t[2] || 8);
      const onPave = Math.abs(g0 - 0.13) < 0.006;
      if (!onPave && g0 > 0.032) continue;
      const hab = onPave ? HAB.hard : areas.length ? habOf(tx, tz) : HAB.none, rec = _rec;
      if (hab === HAB.bed) continue;
      if (onPave || hab === HAB.hard || (hab === HAB.none && !(baseGreen && inMap(tx, tz) && baseGreen(tx, tz)))) {
        // a street tree in paving (in the pavement: inside its iron grille): a few tufts and weeds in the pit, hard against the trunk
        if (nearGate(tx, tz, 3) || !inMap(tx, tz)) continue;
        const m = 2 + Math.floor(hh(ti, tj, 301) * 3.99);
        for (let k = 0; k < m; k++) {
          const a = hh(ti, tj, 310 + k) * 6.2832, r = trunk + 0.07 + 0.2 * hh(ti, tj, 320 + k), x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r, r1 = hh(ti, tj, 330 + k);
          const g = groundHeight(x, z);
          if (Math.abs(g - g0) > 0.004 || inBld(x, z) || barrierGap(collider, x, z, 0.5) < 0.15 || collider.isWater(x, z)) continue;
          put(x, g, z, r1 < 0.5 ? KI.tuft : KI.weed, r1 < 0.5 ? 0.5 + 0.3 * r1 : 0.7 + 0.3 * r1, hh(ti, tj, 340 + k), ti * 31 + tj * 17 + k);
        }
        continue;
      }
      // every tree on soft ground: a little unmown grass or ivy hard against the trunk
      const big = Math.min(1.4, 0.6 + (t[2] || 8) / 22);
      for (let k = 0; k < 3; k++) {
        const a = hh(ti, tj, 350 + k) * 6.2832, r = trunk + 0.1 + 0.1 * k, x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r, r1 = hh(ti, tj, 360 + k);
        if (inCellAny(x, z)) land(x, z, r1 < 0.6 ? KI.tuft : r1 < 0.85 ? KI.ivy : KI.fern, 0.7 + 0.4 * r1, hh(ti, tj, 370 + k), ti * 37 + tj * 19 + k, 0.1);
      }
      if (hab === HAB.lawn || hab === HAB.sports) continue;
      // a ring of bluebells (parks, gardens, woods), cow parsley (meadows, verges) or primroses (churchyards) under about half of them
      const pick = hh(ti, tj, 380);
      if (pick > (hab === HAB.none || hab === HAB.verge ? 0.3 : 0.55)) continue;
      const kind = hab === HAB.church ? KI.primrose : hab === HAB.meadow || hab === HAB.scrub || hab === HAB.verge || hab === HAB.none ? (pick < 0.12 ? KI.cowparsley : KI.tuft) : KI.bluebell;
      const m = hab === HAB.none || hab === HAB.verge ? 4 : 9 + Math.floor(hh(ti, tj, 381) * 8), R = (1.0 + 1.4 * hh(ti, tj, 382)) * big;
      for (let k = 0; k < m; k++) {
        const a = hh(ti, tj, 400 + k) * 6.2832, r = trunk + 0.35 + (R - 0.7) * Math.sqrt(hh(ti, tj, 430 + k)), x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r;
        if (!inCellAny(x, z)) continue;
        if (areas.length && (habOf(x, z) !== hab || _rec !== rec)) continue;   // stays in the tree's own piece of ground
        land(x, z, hh(ti, tj, 460 + k) < 0.85 ? kind : KI.tuft, 0.85 + 0.35 * hh(ti, tj, 490 + k), hh(ti, tj, 520 + k), ti * 41 + tj * 23 + k);
      }
    }
  }
  // (a tree's ring belongs to the tree's cell even where it reaches into the next one: the lists were gathered 4 m wide)
  const inCellAny = (x, z) => x >= cx0 - 3.5 && x < cx0 + CELL + 3.5 && z >= cz0 - 3.5 && z < cz0 + CELL + 3.5;
  /** the foot of walls and fences: something small in the joint every few metres */
  function wallFeet() {
    for (const w of bars) {
      if (w.kind === 'hedge' || w.kind === 'guard_rail') continue;
      const dx = w.bx - w.ax, dz = w.bz - w.az, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, STEP = 1.15;
      const wi = Math.round(w.ax * 10) * 3 + w.i * 7, wj = Math.round(w.az * 10);
      const m = Math.floor(l / STEP);
      for (let q = 0; q <= m; q++) for (const s of [1, -1]) {
        const r0 = hh(wi, wj, 600 + q * 2 + (s > 0 ? 1 : 0));
        if (r0 > 0.26) continue;
        const t = (q + hh(wi, wj, 700 + q)) * STEP; if (t > l) continue;
        const off = w.half + 0.09, nx = -uz * s, nz = ux * s, x = w.ax + ux * t + nx * off, z = w.az + uz * t + nz * off;
        if (!inCell(x, z)) continue;
        const g = groundHeight(x, z), pave = Math.abs(g - 0.13) < 0.004;
        if (!pave && g > 0.032) continue;
        if (pave && r0 > 0.1) continue;                                        // sparser on a pavement than on soft ground
        if (!pave) { const hab = areas.length ? habOf(x, z) : HAB.none; if (hab === HAB.hard || hab === HAB.lawn || hab === HAB.bed) continue; if (hab === HAB.none && !(baseGreen && inMap(x, z) && baseGreen(x, z))) { if (r0 > 0.08) continue; } }
        const gap = barrierGap(collider, x, z, 0.6);
        if (gap < 0.03 || gap > 0.3) continue;                                 // (Infinity in a gateway; < 0 inside a wall that crosses this one)
        if (nearGate(x, z, 2) || inBld(x, z) || dBld(x, z) < 0.25 || dPath(x, z) < 0.05 || collider.isWater(x, z)) continue;
        const r1 = hh(wi, wj, 800 + q * 2 + (s > 0 ? 1 : 0)), north = nz < -0.35, stone = w.kind === 'wall' || w.kind === 'city_wall' || w.kind === 'retaining_wall';
        let kind, sz = 0.75 + 0.4 * r1;
        if (north) kind = r1 < 0.36 ? KI.fern : r1 < 0.6 ? KI.ivy : r1 < 0.8 ? KI.moss : KI.tuft;
        else if (stone && w.h >= 1.2 && r1 < 0.2) kind = KI.valerian;
        else if (stone && w.h >= 1.8 && !pave && r1 < 0.25) { kind = KI.buddleia; sz = 0.7 + 0.5 * hh(wi, wj, 900 + q); }
        else kind = r1 < 0.62 ? KI.weed : r1 < 0.9 ? KI.tuft : KI.ivy;
        if (pave) sz *= KINDS[kind].h > 0.5 ? 0.7 : 0.8;
        put(x, g, z, kind, sz, hh(wi, wj, 1000 + q * 2 + (s > 0 ? 1 : 0)), wi * 13 + wj * 7 + q * 2 + (s > 0 ? 1 : 0));
      }
    }
    // house and college walls where they stand in soft ground (never a street front: the ground there is paving)
    for (const b of blds) {
      if (b.skipFeet) continue;
      const P = b.poly, sg = signedArea(P) > 0 ? 1 : -1, bi = Math.round(P[0][0] * 10), bj = Math.round(P[0][1] * 10);
      for (let e = 0; e < P.length; e++) {
        const a = P[e], c = P[(e + 1) % P.length], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz); if (l < 1.6) continue;
        const ux = dx / l, uz = dz / l, nx = uz * sg, nz = -ux * sg, m = Math.floor(l / 1.3);
        for (let q = 0; q < m; q++) {
          const r0 = hh(bi + e * 5, bj, 1100 + q); if (r0 > 0.17) continue;
          const t = 0.5 + (q + hh(bi + e * 5, bj, 1200 + q) * 0.8) * 1.3; if (t > l - 0.4) continue;
          const x = a[0] + ux * t + nx * 0.14, z = a[1] + uz * t + nz * 0.14;
          if (!inCell(x, z) || inBld(x, z)) continue;
          const gx = x + nx * 0.4, gz = z + nz * 0.4;
          if (groundHeight(x, z) > 0.032 || groundHeight(gx, gz) > 0.032) continue;
          const hab = areas.length ? habOf(gx, gz) : HAB.none;
          if (hab === HAB.hard || hab === HAB.lawn || hab === HAB.bed) continue;
          if (hab === HAB.none && !(baseGreen && inMap(gx, gz) && baseGreen(gx, gz))) continue;
          if (dPath(x, z) < 0.3 || nearGate(x, z, 1.6) || barrierGap(collider, x, z, 0.5) < 0.1 || collider.isWater(x, z)) continue;
          const r1 = hh(bi + e * 5, bj, 1300 + q), north = nz < -0.35;
          const kind = north ? (r1 < 0.45 ? KI.fern : r1 < 0.75 ? KI.ivy : KI.moss) : r1 < 0.3 ? KI.tuft : r1 < 0.55 ? KI.weed : r1 < 0.7 ? KI.valerian : r1 < 0.85 ? KI.ivy : KI.cowparsley;
          put(x, groundHeight(x, z), z, kind, 0.75 + 0.4 * r1, hh(bi + e * 5, bj, 1400 + q), bi * 11 + bj * 5 + e * 3 + q);
        }
      }
    }
  }

  // the collider's water (map water, and what place modules added) rasterised for one cell: each polygon's edges are
  // walked once and every row filled between its crossings (a river polygon has thousands of vertices: 576 point
  // tests against it cost milliseconds)
  let waterGrid = null;
  const rows = Array.from({ length: WN }, () => []), numAsc = (a, b) => a - b;
  function rasterWater() {
    if (!waterGrid) {
      waterGrid = new SpatialGrid(64);
      for (const w of collider.water || []) waterGrid.insertBox(w.minX, w.minZ, w.maxX, w.maxZ, { w });
      for (const l of collider.waterLines || []) waterGrid.insertBox(Math.min(l.x1, l.x2) - l.r, Math.min(l.z1, l.z2) - l.r, Math.max(l.x1, l.x2) + l.r, Math.max(l.z1, l.z2) + l.r, { l });
      for (const b of collider.walkable || []) { if (b.poly) { const bb = polyBounds(b.poly); waterGrid.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, { b }); } else waterGrid.insertBox(Math.min(b.x1, b.x2) - b.r, Math.min(b.z1, b.z2) - b.r, Math.max(b.x1, b.x2) + b.r, Math.max(b.z1, b.z2) + b.r, { b }); }
    }
    const X1 = wx0 + WN - 1, Z1 = wz0 + WN - 1; let cleared = false, bridges = null;
    waterGrid.query(wx0, wz0, X1, Z1, (it) => {
      if (it.b) { (bridges || (bridges = [])).push(it.b); return; }
      if (!cleared) { wet.fill(0); cleared = true; }
      if (it.l) {
        const l = it.l, i0 = Math.max(0, Math.ceil(Math.min(l.x1, l.x2) - l.r - wx0)), i1 = Math.min(WN - 1, Math.floor(Math.max(l.x1, l.x2) + l.r - wx0)), j0 = Math.max(0, Math.ceil(Math.min(l.z1, l.z2) - l.r - wz0)), j1 = Math.min(WN - 1, Math.floor(Math.max(l.z1, l.z2) + l.r - wz0));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!wet[j * WN + i] && distToSeg(wx0 + i, wz0 + j, l.x1, l.z1, l.x2, l.z2) < l.r) { wet[j * WN + i] = 1; hasWater = true; }
        return;
      }
      const w = it.w; if (w.maxX < wx0 || w.minX > X1 || w.maxZ < wz0 || w.minZ > Z1) return;
      // even-odd fill of the outer ring and the holes together, into a row of toggles, then OR-ed into the raster
      for (let j = 0; j < WN; j++) rows[j].length = 0;
      for (let h = -1; h < (w.holes ? w.holes.length : 0); h++) {
        const ring = h < 0 ? w.poly : w.holes[h];
        for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
          const p = ring[a], q = ring[b], zl = p[1] < q[1] ? p[1] : q[1], zh = p[1] < q[1] ? q[1] : p[1];
          if (zh < wz0 || zl > Z1 || zl === zh) continue;
          // the rows z with zl <= z < zh (the same half-open rule as pointInPoly's (p.z > z) !== (q.z > z))
          for (let j = Math.max(0, Math.ceil(zl - wz0)); j < WN; j++) { const z = wz0 + j; if (z >= zh) break; rows[j].push((q[0] - p[0]) * (z - p[1]) / (q[1] - p[1]) + p[0]); }
        }
      }
      for (let j = 0; j < WN; j++) {
        const xs = rows[j]; if (xs.length < 2) continue;
        xs.sort(numAsc);
        for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.max(0, Math.ceil(xs[k] - wx0)), i1 = Math.min(WN - 1, Math.floor(xs[k + 1] - wx0)); for (let i = i0; i <= i1; i++) { wet[j * WN + i] = 1; hasWater = true; } }
      }
    });
    if (hasWater && bridges) for (let j = 0; j < WN; j++) for (let i = 0; i < WN; i++) if (wet[j * WN + i] && collider.onBridge(wx0 + i, wz0 + j)) wet[j * WN + i] = 0;
  }

  const cache = new Map();
  function cell(ci, cj) {
    const key = ckey(ci, cj); let c = cache.get(key);
    if (c) return c;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const x0 = (cx0 = ci * CELL), z0 = (cz0 = cj * CELL), x1 = x0 + CELL, z1 = z0 + CELL, M = 4;
    n = 0;
    areas.length = paths.length = bars.length = blds.length = sites.length = stills.length = gates.length = 0;
    areaGrid.query(x0 - M, z0 - M, x1 + M, z1 + M, (r) => { if (r.bb.maxX >= x0 - M && r.bb.minX <= x1 + M && r.bb.maxZ >= z0 - M && r.bb.minZ <= z1 + M) areas.push(r); });
    areas.sort((a, b) => b.prio - a.prio || (a.id < b.id ? -1 : 1));
    { let w = 0; for (let i = 0; i < areas.length; i++) { const r = areas[i]; let full = 0; if (!edgeInBox(r, x0 - M - 1, z0 - M - 1, x1 + M + 1, z1 + M + 1)) { if (!inside(r, x0 + CELL / 2, z0 + CELL / 2)) continue; full = 1; } areas[w] = r; aFull[w++] = full; } areas.length = w; }
    siteGrid.query(x0 - M, z0 - M, x1 + M, z1 + M, (r) => { sites.push(r); });
    stillGrid.query(x0, z0, x1, z1, (r) => { stills.push(r); });
    pathGrid.query(x0 - 9, z0 - 9, x1 + 9, z1 + 9, (r) => { paths.push(r); });
    barGrid.query(x0 - M, z0 - M, x1 + M, z1 + M, (r) => { bars.push(r); });
    bars.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.i - b.i));
    gateGrid.query(x0 - M, z0 - M, x1 + M, z1 + M, (r) => { gates.push(r); });
    if (buildingGrid) buildingGrid.query(x0 - M, z0 - M, x1 + M, z1 + M, (r) => {
      const b = r.b; if (!b || !b.poly || b.poly.length < 3) return;
      const bb = r.bb || (b._fbb || (b._fbb = polyBounds(b.poly)));
      if (bb.maxX < x0 - M || bb.minX > x1 + M || bb.maxZ < z0 - M || bb.minZ > z1 + M) return;
      blds.push({ poly: b.poly, bb, skipFeet: !!b.part || skip.has(b.id) || (b.minH || 0) > 0.5 || (b.tags && b.tags.building === 'roof'), id: b.id });
    });
    blds.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    // the cell's water, 1 m samples out to 4 m beyond it
    wx0 = x0 - 4; wz0 = z0 - 4; hasWater = false;
    rasterWater();
    if (areas.length || blds.length || bars.length || hasWater || treeCells.has(key) || (baseGreen && inMap(x0 + CELL / 2, z0 + CELL / 2))) {
      const P = typeof performance !== 'undefined' ? performance : null, T = stats.t, ta = P ? P.now() : 0;
      beds(x0, z0, x1, z1); const tb = P ? P.now() : 0;
      scatter(x0, z0); const tc = P ? P.now() : 0;
      trees(ci, cj); const td = P ? P.now() : 0;
      wallFeet(); const te = P ? P.now() : 0;
      T[0] += ta - t0; T[1] += tb - ta; T[2] += tc - tb; T[3] += td - tc; T[4] += te - td;
    }
    c = { n, d: D.slice(0, n * 8), rank: RK.slice(0, n), kind: KD.slice(0, n) };
    cache.set(key, c);
    stats.cells++; stats.plants += n; for (let i = 0; i < n; i++) stats.byKind[KD[i]]++;
    if (t0) { const ms = performance.now() - t0; stats.ms += ms; if (ms > stats.worstMs) { stats.worstMs = ms; stats.worstAt = [x0, z0]; } }
    return c;
  }
  return {
    cell, has: (ci, cj) => cache.has(ckey(ci, cj)), cache, stats,
    /** drop planned cells further than `far` m from (x, z) (memory: a cell is a few hundred bytes to a few KB) */
    trim(x, z, far) { for (const [k, c] of cache) { const ci = Math.floor(k / 65536) - 32768, cj = (k % 65536) - 32768; if (Math.abs((ci + 0.5) * CELL - x) > far || Math.abs((cj + 0.5) * CELL - z) > far) cache.delete(k); } },
    /** what kind of ground the rules take (x, z) for -> name */
    habitatAt(x, z) { areas.length = 0; areaGrid.query(x, z, x, z, (r) => { areas.push(r); }); areas.sort((a, b) => b.prio - a.prio); aFull.length = 0; const h = habOf(x, z); return Object.keys(HAB).find((k) => HAB[k] === h); },
  };
}
