// Streetscape planner: where every street item goes. Pure (no DOM, no THREE), deterministic (hashes of positions and
// map ids, never Math.random), so every player gets the same street and tools/smoke_streetscape.mjs can run it in node.
//
// planStreet(env) -> { items, beacons, stats }
//   env: { map, gh(x,z) (world.groundHeight), Y (world.Y), roadGrid, buildingGrid, zoneAt, util, excl(x,z) -> true when
//          a place module's footprint (or anything else) forbids street furniture there, walkLines (optional),
//          lamps [{x, z}], furniture [[x, z, r]] (mapped furniture), crossKerbs [[x, z]] (where crossings meet the kerb),
//          solid(x, z, r) -> true where the collider has something (walls, parked cars, module props) or water,
//          room(x, z, nx, nz, max) -> metres from the kerb point (x, z) along (nx, nz) to the first wall / house front — all optional }
//   items: { k: kind, x, z, y, h: heading (+z of the prototype faces it), v: variant, tint, r: collider radius (0 = none),
//            box: [w, d] collider box, low, day: bin day (0..6, -1 always), roll, knock, sh: contact-shadow radius }
//
// Placement rules (all on the raised pavement of mapped streets unless said otherwise; nothing in a carriageway, a
// junction mouth, a crossing, a doorway / entrance, on the pedestrians' walk lines, in a building or a place footprint):
//   litter bins     shopping streets every ~30 m a side, other centre streets ~60 m, arterials ~120 m, residential ~220 m
//   post boxes      one per ~380 m of street where none is mapped within 200 m
//   cabinets        ~260 m, grit bins ~700 m, pay-and-display machines (centre side streets) ~110 m with a sign
//   signs           20 mph at residential entries from main roads, one-way / no-entry at one-way streets' ends,
//                   permit-holder plates in the residential zones ~70 m, cycle-route signs on arterials ~250 m
//   bollards        across the mouths of pedestrian streets, pairs on centre street corners
//   A-boards        outside mapped cafés, pubs, bars, restaurants, takeaways; hanging baskets on pubs
//   wheelie bins    residential streets outside the centre, one street in seven puts them out on a given game day
//   estate boards   front gardens of residential streets; bikes chained to heritage lamp posts and centre railings
//   pedestrian signals at signal-controlled crossings; Belisha flash positions at zebras

const STREET = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'primary_link', 'secondary_link', 'tertiary_link']);
const PAVEMENT_W = { primary: 2.6, secondary: 2.4, tertiary: 2.2, primary_link: 2, secondary_link: 2, tertiary_link: 2, unclassified: 1.8, residential: 1.8 };
const MAIN = new Set(['primary', 'secondary', 'tertiary']);
const SHOPPY = /^(shop:|cafe$|restaurant$|pub$|bar$|fast_food$|bank$|pharmacy$|ice_cream$)/;
const SIGNWORTHY = new Set(['bench', 'waste_basket', 'post_box', 'telephone', 'bus_stop', 'bicycle_parking', 'street_lamp', 'picnic_table', 'crossing', 'traffic_signals', 'atm', 'vending_machine', 'recycling', 'grit_bin', 'parcel_locker', 'charging_station', 'fountain', 'artwork', 'memorial', 'clock', 'information']);

/** integer-ish hash of two numbers and a salt -> [0, 1) */
export function h3(a, b, c = 0) {
  let h = Math.imul((a * 73.13) | 0, 0x27d4eb2d) ^ Math.imul((b * 91.71) | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; }

class Grid {
  constructor(c) { this.c = c; this.m = new Map(); }
  k(i, j) { return (i + 32768) * 65536 + (j + 32768); }
  add(x, z, o) { const k = this.k(Math.floor(x / this.c), Math.floor(z / this.c)); let a = this.m.get(k); if (!a) this.m.set(k, (a = [])); a.push(o); }
  near(x, z, r, fn) {
    const c = this.c;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
      const a = this.m.get(this.k(i, j)); if (a) for (const o of a) if (fn(o)) return true;
    }
    return false;
  }
}

export function planStreet(env) {
  const { map, gh, Y, roadGrid, buildingGrid, zoneAt, util, excl } = env;
  const { pointAt, polylineLength, pointInPoly, distToSeg } = util;
  const items = [], beacons = [], stats = {};
  const count = (k) => { stats[k] = (stats[k] || 0) + 1; };
  const skip = env.skip || new Set();

  // ---- indexes
  const taken = new Grid(8);       // what stands on the pavement already (mapped furniture, entrances, trees, our items)
  for (const p of map.pois) if (SIGNWORTHY.has(p.kind) && !skip.has(p.id)) taken.add(p.p[0], p.p[1], { x: p.p[0], z: p.p[1], r: p.kind === 'bus_stop' ? 3.5 : p.kind === 'bicycle_parking' ? 4 : p.kind === 'crossing' || p.kind === 'traffic_signals' ? 3.2 : 1.2 });
  for (const g of map.gates) taken.add(g.p[0], g.p[1], { x: g.p[0], z: g.p[1], r: g.kind === 'entrance' ? 2.0 : 1.4 });
  for (const t of map.trees) taken.add(t[0], t[1], { x: t[0], z: t[1], r: 1.0 });
  const shops = new Grid(40); for (const p of map.pois) if (SHOPPY.test(p.kind)) shops.add(p.p[0], p.p[1], p);
  const mappedPost = new Grid(100); for (const p of map.pois) if (p.kind === 'post_box') mappedPost.add(p.p[0], p.p[1], p);
  // what else stands there (2026-11): the lamp posts, the mapped furniture, the kerbs where crossings leave the road
  for (const l of env.lamps || []) taken.add(l.x, l.z, { x: l.x, z: l.z, r: 0.35 });
  for (const f of env.furniture || []) taken.add(f[0], f[1], { x: f[0], z: f[1], r: f[2] });
  for (const k of env.crossKerbs || []) taken.add(k[0], k[1], { x: k[0], z: k[1], r: 0.75 });
  const solid = env.solid || (() => false);        // (x, z, r) -> true where the collider has something (walls, parked cars, a module's props) or water
  const isTaken = (x, z, r) => taken.near(x, z, r + 1.6, (o) => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r) ** 2);
  // within `pad` of a building means within pad of its walls (it used to pad only the bounding-box pre-test)
  const edgeNear = (x, z, P, pad) => { for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; if (distToSeg(x, z, a[0], a[1], c[0], c[1]) < pad) return true; } return false; };
  const inBuilding = (x, z, pad = 0) => { let hit = false; buildingGrid.queryRadius(x, z, 1 + pad, (it) => { const b = it.b; if (b.part) return; if (x < it.bb.minX - pad || x > it.bb.maxX + pad || z < it.bb.minZ - pad || z > it.bb.maxZ + pad) return; if ((pointInPoly(x, z, b.poly) && !(b.holes || []).some((h) => pointInPoly(x, z, h))) || (pad > 0 && edgeNear(x, z, b.poly, pad))) { hit = true; return true; } }); return hit; };
  const onPave = (x, z) => Math.abs(gh(x, z) - Y.pavement) < 0.004;
  // the pedestrians walk 1.1 m behind the kerb (systems/pedestrians.js offsetPts): keep footprints clear of that line
  const offCarriage = (x, z, rad) => { let bad = false; roadGrid.queryRadius(x, z, 14, (it) => { if (it.kind === 'service' && it.w < 4) return; const d = distToSeg(x, z, it.ax, it.az, it.bx, it.bz); if (d < it.w / 2 + 0.12 + rad) { bad = true; return true; } if (STREET.has(it.kind) && Math.abs(d - (it.w / 2 + 1.1)) < rad + 0.27) { bad = true; return true; } }); return !bad; };
  const ok = (x, z, rad, pave = true, across = rad) => (pave ? onPave(x, z) && onPave(x + rad * 0.7, z) && onPave(x - rad * 0.7, z) && onPave(x, z + rad * 0.7) && onPave(x, z - rad * 0.7) : true)
    && !inBuilding(x, z, rad + 0.15) && !isTaken(x, z, rad) && !excl(x, z) && offCarriage(x, z, pave ? across : 0) && !solid(x, z, rad);
  const put = (it, rad = 0.4) => { items.push(it); taken.add(it.x, it.z, { x: it.x, z: it.z, r: rad }); count(it.k); return it; };

  // ---- streets
  const roads = map.roads.filter((r) => STREET.has(r.kind) && r.pts && r.pts.length >= 2 && !r.tunnel && !r.covered && !skip.has(r.id) && !(r.layer && +r.layer < 0));
  // which roads end where (for 20 mph signs and one-way ends)
  const ends = new Grid(10); for (const r of map.roads) if (r.pts && r.pts.length >= 2 && (STREET.has(r.kind) || r.kind === 'pedestrian')) for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) ends.add(p[0], p[1], { r, p });
  const nodeRoads = (p) => { const out = []; ends.near(p[0], p[1], 0.6, (o) => { if (Math.hypot(o.p[0] - p[0], o.p[1] - p[1]) < 0.5) out.push(o.r); }); roadGrid.queryRadius(p[0], p[1], 1, (it) => { if (STREET.has(it.kind) && distToSeg(p[0], p[1], it.ax, it.az, it.bx, it.bz) < 0.5 && !out.includes(it.road)) out.push(it.road); }); return out; };

  const myPost = [];
  for (const r of roads) {
    const pts = r.pts, L = polylineLength(pts); if (L < 12) continue;
    const w = r.w, pw = r.pw !== undefined ? r.pw : PAVEMENT_W[r.kind] || 1.8, hv = strHash(r.id);
    const mid = pointAt(pts, L / 2), zone = zoneAt(mid.x, mid.z);
    let nShop = 0; for (let d = 5; d < L; d += 20) { const P = pointAt(pts, d); shops.near(P.x, P.z, 26, (p) => { if (Math.hypot(p.p[0] - P.x, p.p[1] - P.z) < 26) nShop++; }); }
    const shopping = nShop / Math.max(1, L / 20) > 1.0 && (zone === 'centre' || zone === 'mid' || zone === 'east' || zone === 'jericho');
    const centre = zone === 'centre';
    const main = MAIN.has(r.kind) || r.kind.endsWith('_link');
    const resi = r.kind === 'residential' || r.kind === 'unclassified';
    const suburb = !centre && (zone === 'north' || zone === 'jericho' || zone === 'east' || zone === 'west' || zone === 'south' || zone === 'mid');
    // a kerbside spot `off` behind the kerb on side s at arc length d -> {x, z, h (facing the road), dx, dz} | null
    // 2026-11: and it leaves 0.9 m of pavement to walk past, behind it (the pavement ends at the first wall or house
    // front: env.room) — else it goes right to the kerb edge, else not here
    const room = env.room || (() => 99);
    const spot = (d, s, off, rad, tries = [0, 2, -2, 4, -4], across = rad) => {
      for (const t of tries) {
        const dd = d + t; if (dd < 3 || dd > L - 3) continue;
        const P = pointAt(pts, dd), nx = -P.dz * s, nz = P.dx * s;
        const back = Math.min(pw, room(P.x + nx * w / 2, P.z + nz * w / 2, nx, nz, pw));
        for (const o of [off, Math.min(off, across + 0.14)]) {
          if (back - (o + across) < 0.9) continue;
          const x = P.x + nx * (w / 2 + o), z = P.z + nz * (w / 2 + o);
          if (ok(x, z, rad, true, across)) return { x, z, h: Math.atan2(-nx, -nz), dx: P.dx, dz: P.dz, nx, nz };
        }
      }
      return null;
    };
    const along = (spacing, phase, fn, sides = [1, -1]) => {
      if (!(spacing > 0)) return;
      for (const s of sides) for (let d = spacing * (0.3 + 0.6 * h3(hv * 1e4, s, phase)), j = 0; d < L - 3; d += spacing * (0.8 + 0.4 * h3(hv * 1e4 + j, s, phase + 1)), j++) fn(d, s, j);
    };
    // litter bins
    const binSp = shopping ? 30 : centre ? 60 : main ? 120 : 230;
    along(binSp, 1, (d, s, j) => { if (!shopping && !centre && !main && (s > 0) === (hv < 0.5)) return; const q = spot(d, s, 0.5, 0.3); if (q) put({ k: centre || zone === 'mid' ? 'binC' : 'binP', x: q.x, z: q.z, h: q.h, r: 0.28, sh: 0.45 }, 0.35); });
    // post boxes (where none is mapped near)
    along(380, 2, (d, s) => {
      if (s !== (hv < 0.5 ? 1 : -1)) return;
      const P = pointAt(pts, d); if (mappedPost.near(P.x, P.z, 200, (p) => Math.hypot(p.p[0] - P.x, p.p[1] - P.z) < 200)) return;
      if (myPost.some((it) => Math.hypot(it.x - P.x, it.z - P.z) < 260)) return;
      const q = spot(d, s, 0.5, 0.3); if (q) myPost.push(put({ k: 'postBox', x: q.x, z: q.z, h: q.h + Math.PI / 2 * (h3(q.x, q.z, 3) < 0.5 ? 1 : -1), r: 0.29, sh: 0.5, post: true }, 0.4));
    });
    // cabinets, grit bins
    if (!shopping) along(260, 3, (d, s) => { if (s !== (hv < 0.3 ? 1 : -1)) return; const q = spot(d, s, 0.5, 0.45, undefined, 0.22); if (q) put({ k: 'cabinet', x: q.x, z: q.z, h: q.h, box: [1.15, 0.42], low: true, sh: 0.8 }, 0.7); });
    along(700, 4, (d, s) => { if (s !== (hv < 0.6 ? 1 : -1)) return; const q = spot(d, s, 0.5, 0.4, undefined, 0.28); if (q) put({ k: 'grit', x: q.x, z: q.z, h: q.h, box: [0.8, 0.55], low: true, sh: 0.6 }, 0.6); });
    // pay and display in the centre's side streets; permit plates in the residential zones
    if ((centre || zone === 'mid') && !main && !shopping && r.kind !== 'pedestrian') along(110, 5, (d, s) => { if (s !== (hv < 0.5 ? 1 : -1)) return; const q = spot(d, s, 0.45, 0.25); if (q) { put({ k: 'payMachine', x: q.x, z: q.z, h: q.h, r: 0.22, sh: 0.4 }, 0.35); const q2 = spot(d + 5, s, 0.35, 0.1, [0, 1, -1]); if (q2) put({ k: 'pay', x: q2.x, z: q2.z, h: q2.h + Math.PI / 2, sh: 0 }, 0.2); } });
    if (suburb && resi) along(45, 6, (d, s) => { const q = spot(d, s, 0.35, 0.1, [0, 1.5, -1.5]); if (q) put({ k: 'permit', x: q.x, z: q.z, h: q.h + Math.PI / 2, sh: 0 }, 0.2); });
    if (main && !centre) along(250, 7, (d, s) => { const q = spot(d, s, 0.35, 0.1, [0, 2, -2]); if (q) put({ k: 'cycle', x: q.x, z: q.z, h: q.h + Math.PI / 2 * s, sh: 0 }, 0.2); });
    // cones (the odd one), benches on wide shopping pavements
    along(650, 8, (d, s) => { if (h3(hv * 999, d, s) > 0.5) return; const q = spot(d, s, 0.4, 0.22); if (q) put({ k: 'cone', x: q.x, z: q.z, h: h3(q.x, q.z, 9) * 6.28, knock: true, sh: 0.3 }, 0.3); });
    if (shopping && pw >= 2.2) along(85, 9, (d, s) => { const q = spot(d, s, 0.45, 0.5, undefined, 0.24); if (q) put({ k: 'bench', x: q.x, z: q.z, h: q.h + Math.PI, box: [1.7, 0.45], sh: 0.9 }, 1.0); });
    // wheelie bins outside terraces and semis (out on this street's bin day)
    if (suburb && resi) {
      const day = Math.floor(h3(hv * 7777, 1, 11) * 7);
      along(6.5, 10, (d, s, j) => {
        if (h3(hv * 31 + d, s, 12) > 0.55) return;
        const k = h3(hv * 53 + d, s, 13), kind = k < 0.55 ? 'wheelieG' : k < 0.88 ? 'wheelieB' : 'recBox';
        // the rest of the week the bin lives in the front garden, behind the wall
        { const P = pointAt(pts, d), nx = -P.dz * s, nz = P.dx * s;
          for (const off of [pw + 0.65, pw + 1.0]) { const x = P.x + nx * (w / 2 + off), z = P.z + nz * (w / 2 + off);
            if (onPave(x, z) || gh(x, z) > 0.035 || inBuilding(x, z, 0.4) || isTaken(x, z, 0.35) || excl(x, z) || !offCarriage(x, z, 0) || solid(x, z, 0.36)) continue;
            put({ k: kind, x, z, h: Math.atan2(-nx, -nz) + (h3(x, z, 14) - 0.5) * 0.4, nday: day, knock: kind !== 'recBox', sh: 0.45 }, 0.4); break; } }
        const q = spot(d, s, 0.45, 0.34, [0, 0.8, -0.8], 0.3); if (!q) return;
        const it = put({ k: kind, x: q.x, z: q.z, h: q.h + (h3(q.x, q.z, 14) - 0.5) * 0.5, day, knock: kind !== 'recBox', sh: 0.45 }, 0.45);
        if (k > 0.3 && k < 0.45) { const q2 = { x: q.x + q.dx * 0.6, z: q.z + q.dz * 0.6 }; if (ok(q2.x, q2.z, 0.18)) put({ k: 'caddy', x: q2.x, z: q2.z, h: it.h, day, sh: 0.25 }, 0.2); }
      });
      // estate agents' boards in front gardens (behind the pavement, never on it)
      along(95, 15, (d, s) => {
        if (h3(hv * 17 + d, s, 16) > 0.32) return;
        const P = pointAt(pts, d), nx = -P.dz * s, nz = P.dx * s, off = w / 2 + pw + 0.7, x = P.x + nx * off, z = P.z + nz * off;
        if (onPave(x, z) || gh(x, z) > 0.035 || inBuilding(x, z, 0.4) || isTaken(x, z, 0.5) || excl(x, z) || !offCarriage(x, z, 0) || solid(x, z, 0.3)) return;
        put({ k: 'agent', v: Math.floor(h3(x, z, 17) * 4), x, z, h: Math.atan2(-nx, -nz), sh: 0 }, 0.5);
      });
    }
    // 20 mph and one-way signs at the ends
    for (const end of [0, 1]) {
      const p = end ? pts[pts.length - 1] : pts[0], others = nodeRoads(p).filter((o) => o !== r);
      const d = end ? L - 9 : 9; if (L < 24) continue;
      if (resi && others.some((o) => MAIN.has(o.kind))) { const s = end ? -1 : 1; const q = spot(d, s, 0.35, 0.1, [0, 1.5, -1.5]); if (q) put({ k: 'limit20', x: q.x, z: q.z, h: Math.atan2(end ? q.dx : -q.dx, end ? q.dz : -q.dz), sh: 0 }, 0.2); }
      if (r.oneway && others.length) {
        const fwd = r.oneway !== '-1';
        const entry = fwd ? end === 0 : end === 1;      // traffic enters the one-way here
        for (const s of entry ? [1] : [1, -1]) {
          const q = spot(d, s, 0.35, 0.1, [0, 1.5, -1.5]); if (!q) continue;
          // the plate faces drivers arriving at this end from outside
          const hOut = Math.atan2(end ? q.dx : -q.dx, end ? q.dz : -q.dz);
          put({ k: entry ? 'oneWay' : 'noEntry', x: q.x, z: q.z, h: entry ? hOut + Math.PI / 2 : hOut, sh: 0 }, 0.2);
        }
      }
    }
  }

  // ---- pedestrian streets: bins and benches either side of the middle, bollards across both ends
  for (const r of map.roads) {
    if (r.kind !== 'pedestrian' || !r.pts || r.pts.length < 2 || skip.has(r.id) || r.w < 5) continue;
    const pts = r.pts, L = polylineLength(pts), hv = strHash(r.id), off = Math.max(1.4, r.w / 4);
    const clearOfTraffic = (x, z, rad) => { let bad = false; roadGrid.queryRadius(x, z, 14, (it) => { if (it.kind === 'pedestrian' || (it.kind === 'service' && it.w < 4)) return; const d = distToSeg(x, z, it.ax, it.az, it.bx, it.bz); if (d < it.w / 2 + 0.6 + rad || (STREET.has(it.kind) && Math.abs(d - (it.w / 2 + 1.1)) < rad + 0.3)) { bad = true; return true; } }); return !bad; };
    const inside = (x, z, rad) => !inBuilding(x, z, rad + 0.6) && !isTaken(x, z, rad) && !excl(x, z) && Math.abs(gh(x, z) - Y.road) < 0.02 && clearOfTraffic(x, z, rad) && !solid(x, z, rad);
    for (let d = 10 + hv * 10, j = 0; d < L - 6; d += 32, j++) {
      const P = pointAt(pts, d), s = j % 2 ? 1 : -1, x = P.x - P.dz * s * off, z = P.z + P.dx * s * off;
      if (!inside(x, z, 0.5)) continue;
      if (j % 3 === 1) put({ k: 'bench', x, z, h: Math.atan2(P.dz * s, -P.dx * s) + Math.PI, box: [1.7, 0.45], sh: 0.9 }, 1);
      else put({ k: 'binC', x, z, h: 0, r: 0.28, sh: 0.45 }, 0.4);
    }
    for (const end of [0, 1]) {
      const p = end ? pts[pts.length - 1] : pts[0], others = nodeRoads(p).filter((o) => o !== r && STREET.has(o.kind));
      if (!others.length) continue;
      const P = pointAt(pts, end ? Math.max(L / 2, L - 3.5) : Math.min(L / 2, 3.5)), n = Math.max(1, Math.floor((r.w - 1.6) / 1.6));
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 1.6; if (Math.abs(o) < 0.8) continue;          // the walk line runs down the middle
        const x = P.x - P.dz * o, z = P.z + P.dx * o; if (!inside(x, z, 0.12)) continue;
        put({ k: 'bollard', x, z, h: 0, r: 0.12, sh: 0.2 }, 0.2);
      }
    }
  }

  // ---- bollard pairs on the centre's street corners
  for (const r of roads) {
    const pts = r.pts, L = polylineLength(pts); if (L < 20) continue;
    const mid = pointAt(pts, L / 2); if (zoneAt(mid.x, mid.z) !== 'centre') continue;
    for (const end of [0, 1]) {
      const p = end ? pts[pts.length - 1] : pts[0], others = nodeRoads(p).filter((o) => o !== r && STREET.has(o.kind)); if (!others.length) continue;
      const ow = Math.max(...others.map((o) => o.w)), dd = ow / 2 + 1.4;
      for (const s of [1, -1]) {
        if (h3(strHash(r.id) * 99, end, s) > 0.55) continue;
        for (const k of [0, 1.5]) {
          const P = pointAt(pts, end ? L - dd - k : dd + k), nx = -P.dz * s, nz = P.dx * s, x = P.x + nx * (r.w / 2 + 0.32), z = P.z + nz * (r.w / 2 + 0.32);
          // (2026-11 sanity check: not on a pavement too narrow to walk past one - 0.9 m of clear footway behind it)
          if (ok(x, z, 0.12) && onPave(x + nx * 0.55, z + nz * 0.55) && onPave(x + nx * 1.0, z + nz * 1.0) && !solid(x + nx * 0.6, z + nz * 0.6, 0.45) && !inBuilding(x + nx * 0.6, z + nz * 0.6, 0.45)) put({ k: 'bollard', x, z, h: 0, r: 0.12, sh: 0.2 }, 0.2);
        }
      }
    }
  }

  // ---- A-boards outside cafés, pubs and restaurants; hanging baskets on pubs
  const ABOARD = { cafe: [0, 1], pub: [2, 3, 4], bar: [2, 4], restaurant: [3, 1], fast_food: [5], ice_cream: [0] };
  for (const p of map.pois) {
    const vars = ABOARD[p.kind]; if (!vars || skip.has(p.id)) continue;
    const [px, pz] = p.p; let best = null;
    roadGrid.queryRadius(px, pz, 24, (it) => { if (!STREET.has(it.kind) && it.kind !== 'pedestrian') return; const d = distToSeg(px, pz, it.ax, it.az, it.bx, it.bz); if (d < 24 && (!best || d < best.d)) best = { it, d }; });
    if (best && h3(px, pz, 21) < 0.85) {
      const it = best.it, dx = it.bx - it.ax, dz = it.bz - it.az, l = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(1, ((px - it.ax) * dx + (pz - it.az) * dz) / (l * l)));
      const fx = it.ax + dx * t, fz = it.az + dz * t, sx = px - fx, sz = pz - fz, sl = Math.hypot(sx, sz) || 1;
      const off = it.kind === 'pedestrian' ? Math.min(it.w / 2 - 1.2, sl - 1.5) : it.w / 2 + 0.55;
      if (off > 0.8) for (const slide of [0, 1.5, -1.5, 3, -3]) {
        const x = fx + (sx / sl) * off + (dx / l) * slide, z = fz + (sz / sl) * off + (dz / l) * slide;
        const good = it.kind === 'pedestrian' ? !inBuilding(x, z, 1) && !isTaken(x, z, 0.4) && !excl(x, z) && Math.abs(gh(x, z) - Y.road) < 0.02 && Math.abs(off) > 1.0 && !solid(x, z, 0.35) : ok(x, z, 0.35);
        if (!good) continue;
        put({ k: 'aboard', v: vars[Math.floor(h3(px, pz, 22) * vars.length)], x, z, h: Math.atan2(dx, dz), knock: true, sh: 0.4 }, 0.45);
        break;
      }
    }
    if (p.kind === 'pub' && !excl(px, pz)) {
      // the nearest wall of the pub's building, two baskets either side of the foot point
      let wb = null;
      buildingGrid.queryRadius(px, pz, 14, (bi) => { const poly = bi.b.poly; if (bi.b.part) return; for (let i = 0; i < poly.length; i++) { const a = poly[i], c = poly[(i + 1) % poly.length], d = distToSeg(px, pz, a[0], a[1], c[0], c[1]); if (d < 14 && (!wb || d < wb.d)) wb = { a, c, d, poly }; } });
      if (wb) {
        const ex = wb.c[0] - wb.a[0], ez = wb.c[1] - wb.a[1], el = Math.hypot(ex, ez);
        if (el > 4.5) {
          const t = Math.max(2, Math.min(el - 2, ((px - wb.a[0]) * ex + (pz - wb.a[1]) * ez) / el));
          let nx = -ez / el, nz = ex / el; const tx = wb.a[0] + (ex / el) * t, tz = wb.a[1] + (ez / el) * t;
          if (pointInPoly(tx + nx * 0.3, tz + nz * 0.3, wb.poly)) { nx = -nx; nz = -nz; }
          for (const o of [-1.7, 1.7]) {
            const x = tx + (ex / el) * o + nx * 0.02, z = tz + (ez / el) * o + nz * 0.02;
            if (!excl(x, z)) put({ k: 'basket', x, z, y: 2.75, h: Math.atan2(nx, nz), sh: 0 }, 0.1);
          }
        }
      }
    }
  }

  // ---- pedestrian signals at signal-controlled crossings; Belisha beacon positions at zebras
  const vehicleNear = (x, z, r) => { let best = null; roadGrid.queryRadius(x, z, r, (it) => { if (it.kind === 'service' || it.kind === 'pedestrian') return; const d = distToSeg(x, z, it.ax, it.az, it.bx, it.bz); if (d <= r && (!best || d < best.d)) best = { it, d }; }); return best; };
  for (const p of map.pois) {
    if (p.kind !== 'crossing' || skip.has(p.id)) continue;
    const near = vehicleNear(p.p[0], p.p[1], 8); if (!near) continue;
    const it = near.it, l = Math.hypot(it.bx - it.ax, it.bz - it.az) || 1, dx = (it.bx - it.ax) / l, dz = (it.bz - it.az) / l, nx = -dz, nz = dx;
    const t = Math.max(0, Math.min(1, ((p.p[0] - it.ax) * (it.bx - it.ax) + (p.p[1] - it.az) * (it.bz - it.az)) / (l * l))), cx = it.ax + (it.bx - it.ax) * t, cz = it.az + (it.bz - it.az) * t, hw = it.w / 2;
    if (p.crossing === 'zebra' || p.crossing === 'marked') for (const s of [1, -1]) beacons.push([cx + nx * s * (hw + 0.6), 2.55, cz + nz * s * (hw + 0.6), h3(p.p[0], p.p[1], 0)]);
    if (p.crossing !== 'traffic_signals') continue;
    for (const s of [1, -1]) {
      let x = 0, z = 0, found = false;
      for (const al of [1.6, 2.4, 1.0, 3.2]) { x = cx + nx * s * (hw + 0.45) + dx * al * s; z = cz + nz * s * (hw + 0.45) + dz * al * s; if (onPave(x, z) && onPave(x + 0.15, z + 0.15) && onPave(x - 0.15, z - 0.15) && !inBuilding(x, z, 0.4) && !excl(x, z) && offCarriage(x, z, 0.1) && !solid(x, z, 0.12)) { found = true; break; } }
      if (!found) continue;
      // +z of the prototype looks across the road (at the far kerb); +x along it, at the traffic on this side
      items.push({ k: 'pedSig', x, z, h: Math.atan2(-nx * s, -nz * s), r: 0.09, sh: 0.25 }); count('pedSig');
      taken.add(x, z, { x, z, r: 0.4 });
    }
  }

  // ---- bikes chained to the centre's railings (on the pavement side)
  for (const b of map.barriers) {
    if (b.kind !== 'railing' || skip.has(b.id) || !b.pts || b.pts.length < 2) continue;
    const L = polylineLength(b.pts); if (L < 3) continue;
    const m = pointAt(b.pts, L / 2); if (zoneAt(m.x, m.z) !== 'centre') continue;
    for (let d = 0.8, j = 0; d < L - 0.8 && j < 14; d += 0.75) {
      if (h3(m.x * 3 + d, m.z, 31) > 0.33) continue;
      const P = pointAt(b.pts, d);
      for (const s of [1, -1]) {
        const x = P.x - P.dz * s * 0.3, z = P.z + P.dx * s * 0.3;
        if (!onPave(x, z) || isTaken(x, z, 0.25) || excl(x, z) || !offCarriage(x, z, 0.25) || inBuilding(x, z, 0.5) || solid(x, z, 0.1)) continue;
        put({ k: 'bike', x, z, h: Math.atan2(P.dx, P.dz) - Math.PI / 2, roll: 0.16 * s, tint: bikeTint(x, z), sh: 0 }, 0.3); j++;
        break;
      }
    }
  }
  return { items, beacons, stats };
}

const BIKE_COLS = [[0.05, 0.05, 0.06], [0.55, 0.06, 0.05], [0.08, 0.16, 0.4], [0.75, 0.75, 0.72], [0.12, 0.3, 0.14], [0.45, 0.42, 0.4], [0.6, 0.35, 0.06]];
export function bikeTint(x, z) { return BIKE_COLS[Math.floor(h3(x, z, 41) * BIKE_COLS.length)]; }

/**
 * Where vehicles sweep when they turn (2026-11): at every node of the AI lane graph, each turn from a lane in to a lane out
 * (not straight on, not a U-turn) as a quadratic curve from the kept-left line Ld before the node through the point where
 * the two lines meet to Ld after it, swept by the half width of the body plus, on the inside of the turn, the rear wheels'
 * off-tracking (a bus: 1.28 + 1.1 m; a car 0.92 + 0.35). Street furniture is kept out of it (streetscape.js) and
 * tools/audit_placement.mjs "sweep" checks the same shape. traffic: game.traffic (lanePos, graph). Pure, deterministic.
 * -> { hit(x, z, rad, slack = 0) : {pen, bus, nx, nz} | null }   (pen > slack: the circle reaches into a sweep)
 */
export function turnSweeps(traffic) {
  const cells = new Map(), C = 16, key = (i, j) => (i + 32768) * 65536 + (j + 32768);
  const put = (s) => { for (let i = Math.floor((Math.min(s.ax, s.bx) - 3) / C); i <= Math.floor((Math.max(s.ax, s.bx) + 3) / C); i++) for (let j = Math.floor((Math.min(s.az, s.bz) - 3) / C); j <= Math.floor((Math.max(s.az, s.bz) + 3) / C); j++) { const k = key(i, j); let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(s); } };
  if (traffic && traffic.graph) {
    const G = traffic.graph, lp = (l, s, o) => { const q = { x: 0, z: 0 }; traffic.lanePos(l, s, l.off, q); return q; };
    for (const n of G.nodes) {
      const ins = n.inl || G.lanes.filter((l) => l.to === n);
      for (const a of ins) for (const b of n.out) {
        if (b.e === a.e) continue;
        const turn = Math.atan2(a.edx * b.sdz - a.edz * b.sdx, a.edx * b.sdx + a.edz * b.sdz);
        if (Math.abs(turn) < 0.35 || Math.abs(turn) > 2.6) continue;
        const bus = !!(a.bus && b.bus), hw = bus ? 1.28 : 0.92, track = bus ? 1.1 : 0.35, Ld = Math.min(bus ? 11 : 7, a.len * 0.5, b.len * 0.5);
        if (Ld < 2) continue;
        const A = lp(a, a.len - Ld), E = lp(a, a.len), P = lp(b, 0), Q = lp(b, Ld);
        const d1x = E.x - A.x, d1z = E.z - A.z, d2x = Q.x - P.x, d2z = Q.z - P.z, den = d1x * d2z - d1z * d2x;
        let cx = (E.x + P.x) / 2, cz = (E.z + P.z) / 2;
        if (Math.abs(den) > 1e-6) { const u = ((P.x - A.x) * d2z - (P.z - A.z) * d2x) / den; if (u > 0 && u < 3) { cx = A.x + d1x * u; cz = A.z + d1z * u; } }
        let px = A.x, pz = A.z;
        for (let k = 1; k <= 10; k++) {
          const t = k / 10, mt = 1 - t, x = mt * mt * A.x + 2 * mt * t * cx + t * t * Q.x, z = mt * mt * A.z + 2 * mt * t * cz + t * t * Q.z;
          const sx = x - px, sz = z - pz, sl = Math.hypot(sx, sz) || 1, side = turn > 0 ? 1 : -1;
          put({ ax: px, az: pz, bx: x, bz: z, hw, track, ix: (sz / sl) * side, iz: (-sx / sl) * side, bus, n });
          px = x; pz = z;
        }
      }
    }
  }
  const dseg = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  return {
    segs: cells,
    hit(x, z, rad, slack = 0) {
      let best = null; const seen = new Set();
      for (let i = Math.floor((x - rad - 3) / C); i <= Math.floor((x + rad + 3) / C); i++) for (let j = Math.floor((z - rad - 3) / C); j <= Math.floor((z + rad + 3) / C); j++) {
        const a = cells.get(key(i, j)); if (!a) continue;
        for (const s of a) {
          if (seen.has(s)) continue; seen.add(s);
          const d = dseg(x, z, s.ax, s.az, s.bx, s.bz); if (d > s.hw + s.track + rad + 0.5) continue;
          const side = (x - s.ax) * s.ix + (z - s.az) * s.iz > 0 ? s.hw + s.track : s.hw, pen = side + rad - d;
          if (pen > slack && (!best || pen > best.pen)) best = { pen, bus: s.bus, n: s.n, ix: s.ix, iz: s.iz };
        }
      }
      return best;
    },
  };
}
