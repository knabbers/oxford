// Map sanity (2026-11 placement pass): mapped street furniture and trees that the source data puts in a carriageway.
// Pure (no DOM, no THREE), deterministic (positions and ids only), run from systems/streetscape.js preMap — i.e. before
// the map collision, the world, traffic and the parked cars read the map, so every one of them sees the same result.
//
// OpenStreetMap puts street_lamp / bus_stop / waste_basket / bench / bicycle_parking nodes at the kerb or on the way
// itself, and our carriageways are drawn at default widths (residential 6.5 m, primary 10 m) that are often wider than
// the real street, so the kerb in the data lies inside the drawn road (St Giles', Walton Street, Hythe Bridge Street,
// Jericho, Parks Road's verge trees...). Each such thing is moved straight out to the drawn kerb on its own side (or,
// when that is taken, the other side or a couple of metres along), deterministically; if there is no free spot at all
// (between the two halves of a dual carriageway drawn as one tarmac) it is dropped.
//
// sanitiseMap(map) -> {moved: {kind: n}, dropped: {kind: n}, list: [{kind, id, from, to}]}

const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
const PAVED = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'primary_link', 'secondary_link', 'tertiary_link']);
// footprint radius (m), and how far behind the kerb the thing goes (m)
export const SNAP = {
  street_lamp: [0.15, 0.45], waste_basket: [0.3, 0.55], bench: [0.4, 0.8], post_box: [0.3, 0.55], telephone: [0.5, 0.75], bus_stop: [0.1, 0.35],
  bicycle_parking: [0.45, 0.8], picnic_table: [0.9, 1.4], vending_machine: [0.4, 0.6], recycling: [0.6, 0.9], grit_bin: [0.4, 0.6], parcel_locker: [0.5, 0.7],
  tree: [0.35, 0.75],
};

import { SANITY } from './_clearance.js';
function dseg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
function inPoly(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; }
  return c;
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; }

class Grid {
  constructor(c) { this.c = c; this.m = new Map(); }
  k(i, j) { return (i + 32768) * 65536 + (j + 32768); }
  box(x0, z0, x1, z1, o) { const c = this.c; for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) { const k = this.k(i, j); let a = this.m.get(k); if (!a) this.m.set(k, (a = [])); a.push(o); } }
  near(x, z, fn) { const a = this.m.get(this.k(Math.floor(x / this.c), Math.floor(z / this.c))); if (a) for (const o of a) if (fn(o) === true) return true; return false; }
}

// default carriageway widths of tools/build_map.py (a road with one of these exact widths had no width / lanes tag) and
// pavement widths of world/roads.js
const DEFAULT_W = { primary: 10, secondary: 9, tertiary: 8, unclassified: 6.5, residential: 6.5, primary_link: 7, secondary_link: 7, tertiary_link: 6 };
export const PAVEMENT_W = { primary: 2.6, secondary: 2.4, tertiary: 2.2, primary_link: 2, secondary_link: 2, tertiary_link: 2, unclassified: 1.8, residential: 1.8 };
const MIN_HALF = { primary: 3, secondary: 3, tertiary: 2.75, primary_link: 2.5, secondary_link: 2.5, tertiary_link: 2.4, unclassified: 2.3, residential: 2.3 };

/**
 * Lanes pass (2026-11, photo comparison item 8): `?lanes=0` (GTO_LANES=0 in node) turns it off (world/roads.js reads the
 * same switch for its junction pavements).
 */
export const LANES_ON = () => !((typeof location !== 'undefined' && location && /[?&]lanes=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_LANES === '0'));
/**
 * The old centre's named lanes, per way name: cw = the carriageway (m) a lane with pavements keeps, pwMax = the most
 * pavement it is given (0: none — wall to wall, as Magpie Lane and Brasenose Lane are), surface = what it is laid with.
 * Widths: KNOWN in outline from the photographs (newcoll_lane, turl, merton_st, north_parade: a 4 m carriageway and one
 * thin pavement in New College Lane, about 5 m and two pavements in the Turl, setts in Merton Street); the exact
 * figures are GUESSES. Walls stay where the map has them: the lane is fitted between them (fitLanes), so the
 * carriageway or the pavement reaches the walls instead of leaving a strip of bare ground.
 */
export const LANE_TABLE = {
  'New College Lane': { cw: 4.0, pwMax: 1.6 }, "Queen's Lane": { cw: 4.0, pwMax: 1.6 }, 'Turl Street': { cw: 5.0, pwMax: 2.4 },
  'Merton Street': { cw: 4.6, pwMax: 2.2 }, 'Ship Street': { cw: 4.4, pwMax: 2.2 }, 'Market Street': { cw: 4.8, pwMax: 2.2 },
  'Brasenose Lane': { cw: 0, pwMax: 0, surface: 'unhewn_cobblestone' }, 'Magpie Lane': { cw: 0, pwMax: 0 },
  'Logic Lane': { cw: 0, pwMax: 0 }, "St Helen's Passage": { cw: 0, pwMax: 0, maxW: 2.6 }, 'North Parade Avenue': { cw: 0, pwMax: 0, maxW: 7 },
};
const PATHY = new Set(['footway', 'path', 'cycleway', 'bridleway', 'pedestrian', 'service', 'living_street']);
/**
 * Fit the named lanes (LANE_TABLE) between their walls: per way, the half gap h to the nearer wall (a low quantile
 * along it). A lane with pavements keeps its carriageway (never wider than mapped) and gets pavements to the walls (up to
 * pwMax), or is wall to wall with none when it is narrower than that; a lane without (cw 0) is surfaced wall to wall.
 * Footways / service ways stay under 5 m (the walkers walk down their middle). Marks r.laneFit (fitWidths skips it).
 */
export function fitLanes(map, opts = {}) {
  const skip = opts.skip || new Set(), out = { fitted: 0, list: [] };
  if (!LANES_ON()) return out;
  const cast = wallCaster(map, skip, 12);
  for (const r of map.roads) {
    const T = r.name && LANE_TABLE[r.name];
    if (!T || skip.has(r.id) || !r.pts || r.pts.length < 2 || r.bridge || r.tunnel || r.covered || r.layer || r.kind === 'steps') continue;
    const hs = [];
    let acc = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.01) continue;
      const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
      for (let d = Math.ceil(acc / 2) * 2 - acc; d < l; d += 2) {
        const x = a[0] + ux * d, z = a[1] + uz * d, q = Math.min(cast(x, z, -uz, ux), cast(x, z, uz, -ux));
        if (q < 11.9) hs.push(q);
      }
      acc += l;
    }
    if (hs.length < 4 || acc < 8) continue;                       // (a stub at a junction keeps its width)
    hs.sort((p, q) => p - q);
    const h = hs[Math.floor(hs.length * 0.25)], pw0 = PAVEMENT_W[r.kind];
    const wasW = r.w, wasPw = r.pw;
    if (PATHY.has(r.kind) || !pw0) {
      // surfaced wall to wall (no raised pavement): the way's own surface, at most maxW / 4.9 m (walkers) / 6 m (paths)
      // (a pedestrian street / service way is never made wider than mapped; a footway or path mapped at the default
      // 2.2-2.4 m is widened to its walls)
      const cap = Math.min(T.maxW || 6, r.kind === 'service' ? 4.9 : r.kind === 'pedestrian' || r.kind === 'living_street' || r.kind === 'service' ? wasW : 6);
      r.w = +Math.max(1.4, Math.min(cap, 2 * h - 0.1)).toFixed(1);
      if (r.kind === 'pedestrian' || r.kind === 'living_street' || r.kind === 'service') r.pw = 0;
    } else if (!T.pwMax || 2 * h <= T.cw + 1.0) {
      // a lane: wall to wall, no pavement (never wider than mapped)
      r.w = +Math.max(3.2, Math.min(wasW, 2 * h - 0.1)).toFixed(1); r.pw = 0;              // (3.2: a car still fits: traffic)
    } else {
      // (a pavement narrower than 0.6 m is none: the lane is wall to wall. The carriageway is not narrowed further to
      // widen the pavements: Turl Street at 3.7 m turned into a one-at-a-time run that jammed Carfax in audit_motion)
      const cw = Math.min(wasW, T.cw), p = Math.min(T.pwMax, h - cw / 2 - 0.05);
      if (p < 0.6) { r.w = +Math.max(3.2, Math.min(wasW, 2 * h - 0.1)).toFixed(1); r.pw = 0; }
      else { r.w = cw; r.pw = Math.floor(p * 10) / 10; }
    }
    if (T.surface) r.surface = T.surface;
    r.laneFit = true; if (r.w0 === undefined) r.w0 = wasW;
    out.fitted++;
    if (opts.list) out.list.push({ id: r.id, name: r.name, kind: r.kind, from: [wasW, wasPw], w: r.w, pw: r.pw, h: +h.toFixed(2) });
  }
  return out;
}
/** distance along the ray (x, z) + t (nx, nz), t in [0, R], to the first building wall / barrier: R if none */
function wallCaster(map, skip, R) {
  const segs = new Grid(16);
  const addSeg = (ax, az, bx, bz) => segs.box(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), [ax, az, bx, bz]);
  for (const b of map.buildings) {
    if (b.part || (b.minH || 0) > 2.5 || (b.tags && b.tags.building === 'roof') || skip.has(b.id)) continue;
    const P = b.poly; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; addSeg(a[0], a[1], c[0], c[1]); }
  }
  for (const w of map.barriers) {
    if (skip.has(w.id) || !w.pts || w.kind === 'retaining_wall' || w.kind === 'guard_rail') continue;
    for (let i = 0; i < w.pts.length - 1; i++) addSeg(w.pts[i][0], w.pts[i][1], w.pts[i + 1][0], w.pts[i + 1][1]);
  }
  return (x, z, nx, nz) => {
    let best = R; const seen = new Set();
    for (let t = 0; t <= R + 8; t += 8) segs.near(x + nx * Math.min(t, R), z + nz * Math.min(t, R), (q) => {
      if (seen.has(q)) return; seen.add(q);
      const ex = q[2] - q[0], ez = q[3] - q[1], den = nx * ez - nz * ex; if (Math.abs(den) < 1e-9) return;
      const u = ((q[0] - x) * ez - (q[1] - z) * ex) / den, v = ((q[0] - x) * nz - (q[1] - z) * nx) / den;
      if (u >= 0 && u < best && v >= 0 && v <= 1) best = u;
    });
    return best;
  };
}

/**
 * Streets drawn at the default width where the buildings / front walls stand closer than that: the carriageway (and, if
 * need be, the pavement) is narrowed to what fits between them, so pavements no longer run under the house fronts and
 * the furniture on them is not pushed into the road (Jericho, Magpie Lane, Turl Street...). Sets r.w and r.pw (pavement
 * width, 0 = none: a lane) on the road object. Only roads with a default width; never wider than before.
 */
export function fitWidths(map, opts = {}) {
  const skip = opts.skip || new Set(), out = { fitted: 0, lanes: 0, list: [] };
  const segs = new Grid(16);
  const addSeg = (ax, az, bx, bz) => segs.box(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), [ax, az, bx, bz]);
  for (const b of map.buildings) {
    if (b.part || (b.minH || 0) > 2.5 || (b.tags && b.tags.building === 'roof') || skip.has(b.id)) continue;
    const P = b.poly; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; addSeg(a[0], a[1], c[0], c[1]); }
  }
  for (const w of map.barriers) {
    if (skip.has(w.id) || !w.pts || w.kind === 'retaining_wall' || w.kind === 'guard_rail') continue;
    for (let i = 0; i < w.pts.length - 1; i++) addSeg(w.pts[i][0], w.pts[i][1], w.pts[i + 1][0], w.pts[i + 1][1]);
  }
  // distance along the ray (x, z) + t (nx, nz), t in [0, R], to the first wall: R if none
  const R = 12;
  const cast = (x, z, nx, nz) => {
    let best = R; const seen = new Set();
    for (let t = 0; t <= R + 8; t += 8) segs.near(x + nx * Math.min(t, R), z + nz * Math.min(t, R), (q) => {
      if (seen.has(q)) return; seen.add(q);
      const ex = q[2] - q[0], ez = q[3] - q[1], den = nx * ez - nz * ex; if (Math.abs(den) < 1e-9) return;
      const u = ((q[0] - x) * ez - (q[1] - z) * ex) / den, v = ((q[0] - x) * nz - (q[1] - z) * nx) / den;
      if (u >= 0 && u < best && v >= 0 && v <= 1) best = u;
    });
    return best;
  };
  for (const r of map.roads) {
    const pw = PAVEMENT_W[r.kind];
    // residential streets and lanes only: the main roads are what the place modules build their sites against
    if ((r.kind !== 'residential' && r.kind !== 'unclassified') || !pw || r.w !== DEFAULT_W[r.kind] || r.laneFit || skip.has(r.id) || !r.pts || r.pts.length < 2 || r.bridge || r.tunnel || r.covered || r.layer) continue;
    let L = 0; for (let i = 1; i < r.pts.length; i++) L += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
    if (L < 14) continue;
    const cs = [];
    let acc = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.01) continue;
      const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
      for (let d = Math.ceil(acc / 3) * 3 - acc; d < l; d += 3) {
        const s = acc + d; if (s < 7 || s > L - 7) continue;
        const x = a[0] + ux * d, z = a[1] + uz * d;
        cs.push(Math.min(cast(x, z, -uz, ux), cast(x, z, uz, -ux)));
      }
      acc += l;
    }
    if (cs.length < 3) continue;
    cs.sort((p, q) => p - q);
    const q = cs[Math.floor(cs.length * 0.3)], avail = q - 0.05, half = r.w / 2;
    if (avail >= half + pw - 0.15) continue;                       // it fits (near enough)
    const ow = r.oneway === 'yes' || r.oneway === '-1' || r.oneway === 'true' || r.oneway === '1';
    const hmin = ow ? Math.max(1.8, MIN_HALF[r.kind] - 0.6) : MIN_HALF[r.kind];
    // the carriageway gives way first (down to hmin), then the pavement (down to 0.8 m), then there is none (a lane)
    let hc, p;
    if (avail >= hmin + 0.8) { hc = Math.min(half, Math.max(hmin, avail - pw)); p = Math.min(pw, avail - hc); }
    else if (avail >= 1.75 + 0.8) { hc = Math.min(half, avail - 0.8); p = 0.8; }           // a narrow old street: 3.5 m and up, 0.8 m pavements
    else { hc = Math.min(half, Math.max(1.6, avail)); p = 0; }                               // a lane: wall to wall, no pavement
    hc = Math.min(half, Math.floor(hc * 10) / 10); p = Math.floor(p * 10) / 10;
    if (hc >= half - 0.05 && p >= pw - 0.05) continue;
    if (opts.list) out.list.push({ id: r.id, name: r.name, kind: r.kind, w: r.w, to: +(hc * 2).toFixed(1), pw: p, q: +q.toFixed(2) });
    r.w0 = r.w; r.w = +(hc * 2).toFixed(1); if (p < pw) r.pw = p;
    out.fitted++; if (!p) out.lanes++;
  }
  return out;
}

/**
 * Traffic islands: a small mapped structure standing between the lanes (the Victoria Fountain on The Plain) that our
 * default-width carriageways would run over. The roads round it are drawn at the width of a gyratory lane (6 m one-way,
 * 7 m two-way, if they had a default width) and their inner vertices are pushed out so that the island — the structure
 * plus a 2.2 m kerbed margin (a module may build the structure bigger: the fountain's plinth) — exists. Shared nodes (junctions) never move, so the lane graph keeps its topology.
 */
export function makeIslands(map, opts = {}) {
  const skip = opts.skip || new Set(), out = { islands: 0, roads: [] };
  const ISLAND = /^(drinking_fountain|fountain|monument|memorial|shrine|clock)$/;
  const use = new Map(), key = (p) => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10);
  for (const r of map.roads) if (r.pts) r.pts.forEach((p, i) => { const k = key(p); use.set(k, (use.get(k) || 0) + (i === 0 || i === r.pts.length - 1 ? 2 : 1)); });
  for (const b of map.buildings) {
    if (b.part || skip.has(b.id) || !b.tags || !(ISLAND.test(b.tags.building || '') || ISLAND.test(b.tags.amenity || '') || ISLAND.test(b.tags.historic || ''))) continue;
    const c = b.c, R = Math.max(...b.poly.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))); if (R > 6) continue;
    let hit = false;
    for (const r of map.roads) {
      if (!DRIVE.has(r.kind) || !r.pts || r.pts.length < 2 || r.tunnel || skip.has(r.id)) continue;
      const near = () => { let d = 1e9; for (let i = 0; i < r.pts.length - 1; i++) d = Math.min(d, dseg(c[0], c[1], r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1])); return d; };
      if (near() >= r.w / 2 + R + 2.2) continue;
      const ow = r.oneway === 'yes' || r.oneway === '-1' || r.oneway === 'true' || r.oneway === '1';
      if (r.w === DEFAULT_W[r.kind]) { r.w0 = r.w; r.w = Math.min(r.w, ow ? 6 : 7); }
      const need = R + 2.2 + r.w / 2;
      for (let it = 0; it < 24; it++) {
        let moved = false;
        for (let i = 0; i < r.pts.length - 1; i++) {
          const a = r.pts[i], e = r.pts[i + 1], dx = e[0] - a[0], dz = e[1] - a[1], l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / l2)), qx = a[0] + dx * t, qz = a[1] + dz * t, d = Math.hypot(qx - c[0], qz - c[1]);
          if (d >= need - 0.01) continue;
          // the closest point: an inner vertex that only this road uses moves; else a new vertex is put in there
          let j = t < 0.05 ? i : t > 0.95 ? i + 1 : -1;
          if (j >= 0 && (j === 0 || j === r.pts.length - 1 || (use.get(key(r.pts[j])) || 0) > 1)) j = -1;
          if (j < 0) { if (t < 0.05 || t > 0.95) continue; r.pts.splice(i + 1, 0, [qx, qz]); use.set(key([qx, qz]), 1); j = i + 1; }
          const p = r.pts[j], vx = p[0] - c[0], vz = p[1] - c[1], vl = Math.hypot(vx, vz) || 1;
          r.pts[j] = [Math.round((c[0] + vx / vl * need) * 100) / 100, Math.round((c[1] + vz / vl * need) * 100) / 100];
          moved = true; break;
        }
        if (!moved) break;
      }
      hit = true; out.roads.push(r.id);
    }
    if (hit) out.islands++;
  }
  return out;
}

/**
 * Walls, fences and hedges mapped straight ACROSS a drivable street (away from its ends and from any gate) are cut where
 * they cross the carriageway: the gliding club's field hedges over Hugh Allen Crescent and Pullens Lane, the odd
 * mis-joined garden wall. The pieces keep the barrier's id (so overrides.skip still finds every piece).
 */
export function cutBarriers(map, opts = {}) {
  const skip = opts.skip || new Set(), out = { cut: 0 };
  const roads = new Grid(16);
  for (const r of map.roads) {
    if (!DRIVE.has(r.kind) || !r.pts || r.pts.length < 2 || r.tunnel || r.covered || skip.has(r.id) || (r.layer && +r.layer !== 0)) continue;
    let L = 0; const cum = [0]; for (let i = 1; i < r.pts.length; i++) cum.push((L += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1])));
    for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1], pad = r.w / 2 + 2; roads.box(Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad, { a, b, r, s0: cum[i], L }); }
  }
  const gates = new Grid(16); for (const g of map.gates) gates.box(g.p[0] - 8, g.p[1] - 8, g.p[0] + 8, g.p[1] + 8, g.p);
  const add = [];
  for (const w of map.barriers) {
    if (skip.has(w.id) || !w.pts || w.pts.length < 2 || w.kind === 'guard_rail') continue;
    const cuts = []; let acc = 0;
    for (let i = 0; i < w.pts.length - 1; i++) {
      const p = w.pts[i], q = w.pts[i + 1], ex = q[0] - p[0], ez = q[1] - p[1], el = Math.hypot(ex, ez); if (el < 1e-3) continue;
      const seen = new Set();
      for (const P of [p, q, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]]) roads.near(P[0], P[1], (s) => {
        if (seen.has(s)) return; seen.add(s);
        const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], den = ex * dz - ez * dx; if (Math.abs(den) < 1e-9) return;
        const u = ((s.a[0] - p[0]) * dz - (s.a[1] - p[1]) * dx) / den, v = ((s.a[0] - p[0]) * ez - (s.a[1] - p[1]) * ex) / den;
        if (u < 0 || u > 1 || v < 0 || v > 1) return;
        const along = s.s0 + v * Math.hypot(dx, dz); if (along < 3 || along > s.L - 3) return;    // the end of a street at a wall: not ours to open
        const x = p[0] + ex * u, z = p[1] + ez * u;
        if (gates.near(x, z, (g) => Math.hypot(g[0] - x, g[1] - z) < s.r.w / 2 + 2)) return;
        const sin = Math.abs(den) / (el * Math.hypot(dx, dz)), g = Math.min(s.r.w * 1.5, (s.r.w / 2 + 0.6) / Math.max(0.3, sin));
        cuts.push([acc + u * el - g, acc + u * el + g]);
      });
      acc += el;
    }
    if (!cuts.length) continue;
    cuts.sort((a, b) => a[0] - b[0]);
    // the pieces outside the cuts
    const pieces = []; let cur = [], pos = 0, ci = 0;
    const inCut = (d) => cuts.some((c) => d > c[0] && d < c[1]);
    const P0 = w.pts; let a0 = 0;
    for (let i = 0; i < P0.length - 1; i++) {
      const p = P0[i], q = P0[i + 1], el = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const marks = [0, el]; for (const c of cuts) for (const e of c) if (e > a0 && e < a0 + el) marks.push(e - a0);
      marks.sort((x, y) => x - y);
      for (let k = 0; k < marks.length; k++) {
        const t = marks[k] / (el || 1), pt = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], d = a0 + marks[k];
        const insideNext = k < marks.length - 1 ? inCut(d + (marks[k + 1] - marks[k]) / 2) : inCut(d + 1e-3);
        if (!cur.length || Math.hypot(cur[cur.length - 1][0] - pt[0], cur[cur.length - 1][1] - pt[1]) > 1e-4) cur.push(pt);
        if (insideNext && cur.length) { if (cur.length >= 2) pieces.push(cur); cur = []; }
      }
      a0 += el;
    }
    if (cur.length >= 2) pieces.push(cur);
    const good = pieces.filter((pc) => { let l = 0; for (let i = 1; i < pc.length; i++) l += Math.hypot(pc[i][0] - pc[i - 1][0], pc[i][1] - pc[i - 1][1]); return l > 0.4; });
    out.cut++;
    w.pts = good.length ? good[0].map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]) : [];
    for (let k = 1; k < good.length; k++) add.push({ ...w, pts: good[k].map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]) });
  }
  for (let i = map.barriers.length - 1; i >= 0; i--) if (map.barriers[i].pts && map.barriers[i].pts.length < 2) map.barriers.splice(i, 1);
  for (const b of add) map.barriers.push(b);
  return out;
}

/**
 * Footways mapped as bridges of their own along the SIDE of a road bridge (the pavements of Magdalen Bridge, Folly
 * Bridge, the Botley Road bridges are separate ways in the data): the world gave each its own pair of iron railings,
 * which ran along and - where the way kinks to join the road - diagonally through the road bridge's stone parapet or a
 * place module's balustrade. A bridge footway most of which lies within the road bridge's width (carriageway +
 * pavement + 2 m) gets `noParapet` (world/roads.js): it keeps its surface and its walkable deck. -> how many.
 */
export function sidewalkBridges(map, opts = {}) {
  const skip = opts.skip || new Set(); let n = 0;
  const decks = map.roads.filter((r) => r.bridge && DRIVE.has(r.kind) && r.pts && r.pts.length > 1 && !skip.has(r.id));
  if (!decks.length) return 0;
  for (const r of map.roads) {
    if (!r.bridge || !r.pts || r.pts.length < 2 || skip.has(r.id) || !/^(footway|path|cycleway|pedestrian)$/.test(r.kind)) continue;
    let on = 0, tot = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], c = r.pts[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), k = Math.max(1, Math.ceil(L / 1.5));
      for (let j = 0; j <= k; j++) {
        const x = a[0] + (c[0] - a[0]) * j / k, z = a[1] + (c[1] - a[1]) * j / k; tot++;
        for (const d of decks) {
          const reach = d.w / 2 + (d.pw !== undefined ? d.pw : PAVEMENT_W[d.kind] || 0) + 2; let hit = false;
          for (let q = 0; q < d.pts.length - 1 && !hit; q++) if (dseg(x, z, d.pts[q][0], d.pts[q][1], d.pts[q + 1][0], d.pts[q + 1][1]) < reach) hit = true;
          if (hit) { on++; break; }
        }
      }
    }
    if (on >= tot * 0.7) { r.noParapet = true; n++; }
  }
  return n;
}

export function sanitiseMap(map, opts = {}) {
  const skip = opts.skip || new Set();
  const out = { moved: {}, dropped: {}, list: [] };
  if (SANITY) out.sidewalkBridges = sidewalkBridges(map, opts);
  if (opts.fit !== false) { out.lanes = fitLanes(map, opts); out.widths = fitWidths(map, opts); out.islands = makeIslands(map, opts); out.barriers = cutBarriers(map, opts); }
  const roads = new Grid(16), blds = new Grid(16), water = new Grid(32);
  for (const r of map.roads) {
    if (!r.pts || r.pts.length < 2 || skip.has(r.id)) continue;
    if ((r.tunnel && r.tunnel !== 'building_passage') || r.covered || (r.layer && +r.layer < 0 && !r.bridge)) continue;
    const drive = DRIVE.has(r.kind), service = r.kind === 'service' && r.w >= 3.5;
    if (!drive && !service) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], pad = r.w / 2 + 3;
      roads.box(Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad, { ax: a[0], az: a[1], bx: b[0], bz: b[1], w: r.w, r, drive });
    }
  }
  for (const b of map.buildings) {
    if (b.part || (b.minH || 0) > 2.5 || (b.tags && b.tags.building === 'roof')) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of b.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    b._sbb = [x0, z0, x1, z1]; blds.box(x0 - 1, z0 - 1, x1 + 1, z1 + 1, b);
  }
  for (const a of map.areas) {
    if (a.kind !== 'water') continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of a.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    water.box(x0, z0, x1, z1, a);
  }
  /** the road a circle (x, z, rad) reaches furthest into: {s, pen} (service roads only count well inside) */
  const worst = (x, z, rad) => {
    let best = null;
    roads.near(x, z, (s) => {
      const d = dseg(x, z, s.ax, s.az, s.bx, s.bz), pen = s.drive ? s.w / 2 + rad - d : s.w / 2 - 0.4 - d;
      if (pen > (s.drive ? 0.05 : 0) && (!best || pen > best.pen)) best = { s, pen, d };
    });
    return best;
  };
  const inBuilding = (x, z, rad) => blds.near(x, z, (b) => {
    const [x0, z0, x1, z1] = b._sbb; if (x < x0 - rad || x > x1 + rad || z < z0 - rad || z > z1 + rad) return false;
    if (inPoly(x, z, b.poly) && !(b.holes || []).some((h) => inPoly(x, z, h))) return true;
    const P = b.poly; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; if (dseg(x, z, a[0], a[1], c[0], c[1]) < rad) return true; }
    return false;
  });
  const inWater = (x, z) => water.near(x, z, (a) => inPoly(x, z, a.poly) && !(a.holes || []).some((h) => inPoly(x, z, h)));
  // walls / fences / hedges (a trunk is not grown through a garden wall) and the lines of footways and paths (a bench
  // mapped on the path is put beside it)
  const walls = new Grid(8), paths = new Grid(8);
  for (const w of map.barriers) { if (skip.has(w.id) || !w.pts) continue; for (let i = 0; i < w.pts.length - 1; i++) { const a = w.pts[i], b = w.pts[i + 1]; walls.box(Math.min(a[0], b[0]) - 1, Math.min(a[1], b[1]) - 1, Math.max(a[0], b[0]) + 1, Math.max(a[1], b[1]) + 1, [a[0], a[1], b[0], b[1]]); } }
  for (const r of map.roads) { if (skip.has(r.id) || !r.pts || !/^(footway|path|cycleway|bridleway|steps)$/.test(r.kind) || r.footway === 'crossing' || r.tunnel) continue; const hw = Math.min(6, Math.max(1.2, r.w)) / 2; for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; paths.box(Math.min(a[0], b[0]) - hw - 1, Math.min(a[1], b[1]) - hw - 1, Math.max(a[0], b[0]) + hw + 1, Math.max(a[1], b[1]) + hw + 1, [a[0], a[1], b[0], b[1], hw]); } }
  const onWall = (x, z, rad) => walls.near(x, z, (q) => dseg(x, z, q[0], q[1], q[2], q[3]) < rad);
  const onPath = (x, z, rad) => paths.near(x, z, (q) => { const d = dseg(x, z, q[0], q[1], q[2], q[3]); return d - rad < q[4] && q[4] + d - rad < 0.9; });
  const free = (x, z, rad) => !worst(x, z, rad) && !inBuilding(x, z, rad) && !inWater(x, z);

  // entrances (doorways) and the furniture already kept: a bench is not put on a doorstep or on top of a bin
  const doors = new Grid(8); for (const g of map.gates) if (g.kind === 'entrance' && !skip.has(g.id)) doors.box(g.p[0] - 1, g.p[1] - 1, g.p[0] + 1, g.p[1] + 1, g.p);
  const kept = new Grid(8);
  const onDoor = (x, z, rad) => doors.near(x, z, (q) => Math.hypot(q[0] - x, q[1] - z) < rad + 0.7);
  const onKept = (x, z, rad) => kept.near(x, z, (o) => Math.hypot(o[0] - x, o[1] - z) < o[2] + rad);
  const keepAt = (x, z, rad) => kept.box(x - rad - 1, z - rad - 1, x + rad + 1, z + rad + 1, [x, z, rad]);
  const RING = []; for (const d of [0.3, 0.6, 0.9, 1.3, 1.8]) for (let k = 0; k < 8; k++) RING.push([Math.cos(k * Math.PI / 4) * d, Math.sin(k * Math.PI / 4) * d]);
  /** -> [x, z] where (x, z) should be, or null to drop it; returns the input array when it is fine */
  const fix = (x, z, kind, id, p) => {
    const [rad, off] = SNAP[kind];
    const w0 = worst(x, z, rad);
    if (!w0) {
      // not in a road: mapped inside a building -> not an outdoor thing; against a wall, on a doorstep or on top of
      // another mapped thing -> the nearest clear spot within 1.8 m (or left where it is)
      if (inBuilding(x, z, 0)) return null;
      // (2026-11 sanity check: a tree's trunk stands 0.85 m clear of a building, not 0.3 - with a 3-5 m crown half the
      // tree was inside the house: "growing through the roof")
      const tree = kind === 'tree', tr = tree ? 0.3 : rad, tb = SANITY ? 0.85 : 0.3;
      const okAt = (qx, qz) => tree ? free(qx, qz, 0.05) && !inBuilding(qx, qz, tb) && !onWall(qx, qz, tr) : free(qx, qz, rad) && !onDoor(qx, qz, rad) && !onKept(qx, qz, rad) && !onWall(qx, qz, rad) && !onPath(qx, qz, rad);
      if (okAt(x, z) || (tree && !inBuilding(x, z, tb) && !onWall(x, z, tr))) return p;
      for (const [ox, oz] of RING) { const qx = x + ox, qz = z + oz; if (okAt(qx, qz)) return [Math.round(qx * 100) / 100, Math.round(qz * 100) / 100]; }
      return p;
    }
    const s = w0.s, dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const t = Math.max(0, Math.min(L, (x - s.ax) * ux + (z - s.az) * uz)), fx = s.ax + ux * t, fz = s.az + uz * t;
    const signed = (x - fx) * -uz + (z - fz) * ux;            // + = left of the drawn direction (left normal (-uz, ux)... see below)
    // the side it is on; on the line itself: a one-way street's stop / lamp goes to the kerb on the left of travel, else by hash
    let side = signed > 0.12 ? 1 : signed < -0.12 ? -1 : 0;
    if (!side) {
      const ow = s.r.oneway === 'yes' || s.r.oneway === 'true' || s.r.oneway === '1' ? 1 : s.r.oneway === '-1' ? -1 : 0;
      // left of travel in x-east / z-south: (fz, -fx) for heading (fx, fz); the normal (-uz, ux) used here is its negative
      side = ow ? -ow : hash(String(id) + kind) < 0.5 ? 1 : -1;
    }
    const hw = s.w / 2 + (s.drive ? off : 0.6 + rad);
    for (const sd of [side, -side]) for (const along of [0, 1.5, -1.5, 3, -3, 5, -5]) {
      const qx = fx + ux * along + -uz * sd * hw, qz = fz + uz * along + ux * sd * hw;
      if (free(qx, qz, rad)) return [Math.round(qx * 100) / 100, Math.round(qz * 100) / 100];
    }
    return null;
  };
  const note = (kind, id, from, to) => { const m = to ? out.moved : out.dropped; m[kind] = (m[kind] || 0) + 1; if (opts.list) out.list.push({ kind, id, from, to }); };

  // ---- points of interest (furniture)
  const keep = [];
  for (const p of map.pois) {
    if (!SNAP[p.kind] || skip.has(p.id)) { keep.push(p); continue; }
    const r = fix(p.p[0], p.p[1], p.kind, p.id, p.p);
    if (r) keepAt(r[0], r[1], p.kind === 'street_lamp' || p.kind === 'bus_stop' ? 0.2 : p.kind === 'bench' || p.kind === 'picnic_table' ? 0.8 : SNAP[p.kind][0]);
    if (r === p.p) { keep.push(p); continue; }
    note(p.kind, p.id, p.p.slice(), r);
    if (r) { p.p = r; p.snapped = true; keep.push(p); }
  }
  if (keep.length !== map.pois.length) { map.pois.length = 0; for (const p of keep) map.pois.push(p); }
  // ---- mapped trees ([x, z, h])
  const trees = [];
  for (const t of map.trees) {
    const r = fix(t[0], t[1], 'tree', Math.round(t[0] * 10) + ',' + Math.round(t[1] * 10), t);
    if (r === t) { trees.push(t); continue; }
    note('tree', '', [t[0], t[1]], r);
    if (r) { t[0] = r[0]; t[1] = r[1]; trees.push(t); }
  }
  if (trees.length !== map.trees.length) { map.trees.length = 0; for (const t of trees) map.trees.push(t); }
  return out;
}
