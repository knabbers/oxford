// Roads: asphalt/sett carriageways, raised pavements with kerbs (cut back at junctions), centre lines, double yellows,
// zebra crossings, footpaths by surface, steps, cycleways, bridge parapets. Also builds the road spatial index other
// modules use (street-facing tests, furniture orientation) and the list of street-lamp spots.
import { GROUND_CELLS as G, GROUND_SCALE as GS, MARK_ROWS, MARK_LEN, markRowV, setGroundCell, ROUGH, FACADE_CELLS as F } from './textures.js';
import { flatRibbon, sideStrip, polylineLength, slicePolyline, pointAt, cleanLine, SpatialGrid, distToSeg, hash01, wallQuad, pointInPoly, polyBounds } from './util.js';
import { Y, surfaceCell } from './ground.js';
import { thickWall } from './barriers.js';
import { roughStreet, roughPath, roughFlush, roughPaveExtra } from './rough.js';

const VEHICLE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'primary_link', 'secondary_link', 'tertiary_link', 'pedestrian']);
const PAVEMENT_W = { primary: 2.6, secondary: 2.4, tertiary: 2.2, primary_link: 2, secondary_link: 2, tertiary_link: 2, unclassified: 1.8, residential: 1.8 };
const CENTRE_LINE = new Set(['primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link', 'tertiary_link']);
const YELLOWS = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential']);
const PATHS = new Set(['footway', 'path', 'cycleway', 'steps', 'track', 'bridleway']);
// well-known Oxford street surfaces (c. 2013)
const NAMED = {
  'Cornmarket Street': { cell: G.paving, tint: [1.05, 1.03, 1.0] }, 'Queen Street': { cell: G.paving, tint: [1.05, 1.03, 1.0] },
  'Broad Street': { cell: G.asphalt, tint: [0.98, 0.97, 0.95], noLines: true }, 'Merton Street': { cell: G.setts, tint: [1.2, 1.12, 1.0], noLines: true },
  'Radcliffe Square': { cell: G.cobbles }, 'Brasenose Lane': { cell: G.cobbles }, 'Magpie Lane': { cell: G.paving },
  'Catte Street': { cell: G.setts, tint: [1.15, 1.1, 1.0], noLines: true }, 'Gloucester Green': { cell: G.paving },
};

const key = (p) => p[0] + ',' + p[1];
/**
 * Lanes and junctions pass (2026-11, photo comparison item 8): `?lanes=0` (GTO_LANES=0 in node) turns it off. Here:
 * pavements are cut at a junction only on the side a road really leaves from (the far side of a T runs on), the minor
 * road's pavement starts at the back of the main road's (no overlap) while the main road's still stops 1.5 m short of
 * the minor road's kerb (a flush corner the turning traffic cuts across, as before), and a way that merely continues another (a split in the mapped way)
 * no longer cuts anything (there was a 13 m gap in both pavements, and in the lines, at each of 324 such joins). The
 * named lanes' widths are set in systems/_street_sanity.js (fitLanes).
 */
export const LANES = !((typeof location !== 'undefined' && location && /[?&]lanes=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_LANES === '0'));
const pwOf = (r) => (r.pw !== undefined ? r.pw : PAVEMENT_W[r.kind] || 0);

export function buildRoads(ctx) {
  const { map, batch, ov } = ctx;
  const grid = (ctx.roadGrid = new SpatialGrid(40));
  const pathGrid = (ctx.pathGrid = new SpatialGrid(40));
  const junction = new Map(); // key -> [{id, w}]
  const H = (ctx.heightSegs = []);   // what groundHeight() samples: [kind (0 road, 1 pavement strip, 2 path), ax, az, bx, bz, hw, pw, open0, open1]
  const roads = map.roads.filter((r) => !ov.skip.has(r.id) && r.kind !== 'corridor' && r.pts && r.pts.length >= 2);

  for (const r of roads) {
    r._pts = cleanLine(r.pts, 0.05);
    if (r._pts.length < 2) continue;
    const veh = VEHICLE.has(r.kind);
    for (let i = 0; i < r._pts.length - 1; i++) {
      const a = r._pts[i], b = r._pts[i + 1];
      const it = { ax: a[0], az: a[1], bx: b[0], bz: b[1], w: r.w, kind: r.kind, name: r.name, road: r, veh };
      (veh ? grid : pathGrid).insertSeg(a[0], a[1], b[0], b[1], it);
    }
    if (!veh || r.kind === 'pedestrian') continue;
    const seen = new Set();
    for (const p of r._pts) { const k = key(p); if (seen.has(k)) continue; seen.add(k); let j = junction.get(k); if (!j) junction.set(k, (j = [])); j.push({ id: r.id, w: r.w, r }); }
  }
  // green ground and named sites (pass 5): untagged footways there are gravel / hoggin, not black tarmac, and paths
  // through grass get worn, tufted margins
  const greenGrid = new SpatialGrid(60), GREEN = new Set(['park', 'garden', 'grass', 'meadow', 'wood', 'scrub', 'pitch']);
  for (const it of ctx.areaList || []) if (GREEN.has(it.a.kind)) { const bb = polyBounds(it.poly); greenGrid.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, { poly: it.poly, holes: it.holes, bb }); }
  const inGreen = (x, z) => { let hit = false; greenGrid.queryRadius(x, z, 0.5, (it) => { if (x >= it.bb.minX && x <= it.bb.maxX && z >= it.bb.minZ && z <= it.bb.maxZ && pointInPoly(x, z, it.poly) && !it.holes.some((h) => pointInPoly(x, z, h))) { hit = true; return true; } }); return hit; };
  const sites = (map.sites || []).map((st) => ({ st, bb: polyBounds(st.poly) }));
  const inSite = (x, z) => sites.some(({ st, bb }) => x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && pointInPoly(x, z, st.poly));
  const otherMax = (k, id) => { const j = junction.get(k); if (!j || j.length < 2) return 0; let m = 0; for (const e of j) if (e.id !== id && e.w > m) m = e.w; return m; };
  // (lanes pass) unit directions of road o away from node k
  const dirsAt = (o, k) => {
    const P = o._pts, out = [];
    for (let i = 0; i < P.length; i++) {
      if (key(P[i]) !== k) continue;
      for (const j of [i - 1, i + 1]) { if (j < 0 || j >= P.length) continue; const dx = P[j][0] - P[i][0], dz = P[j][1] - P[i][1], l = Math.hypot(dx, dz); if (l > 1e-6) out.push([dx / l, dz / l]); }
    }
    return out;
  };
  const toIntervals = (cuts, L) => {
    cuts.sort((a, b) => a[0] - b[0]);
    const out = []; let s = 0;
    for (const c of cuts) { if (c[0] > s) out.push([s, c[0]]); s = Math.max(s, c[1]); }
    if (s < L) out.push([s, L]);
    return out.filter((iv) => iv[1] - iv[0] > 1.2);
  };
  /** (lanes pass) the raised-pavement intervals of r, per side: [left (+ normal), right]. extra = the line-marking pad
   *  (null: pavements, cut per side as described at the top of the file) */
  function sideIntervals(r) {
    const pts = r._pts, n = pts.length, cuts = [[], []], mySize = r.w + 2 * pwOf(r);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const k = key(pts[i]), J = junction.get(k); if (!J || J.length < 2) continue;
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)]; let tx = c[0] - a[0], tz = c[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const outs = []; for (const j of [i - 1, i + 1]) { if (j < 0 || j >= n) continue; const dx = pts[j][0] - pts[i][0], dz = pts[j][1] - pts[i][1], l = Math.hypot(dx, dz); if (l > 1e-6) outs.push([dx / l, dz / l]); }
      for (const e of J) {
        if (e.id === r.id || !e.r._pts) continue;
        const o = e.r, opw = pwOf(o), oSize = o.w + 2 * opw, main = oSize > mySize + 0.01 || (Math.abs(oSize - mySize) <= 0.01 && o.id < r.id);
        for (const d of dirsAt(o, k)) {
          if (outs.some((q) => q[0] * d[0] + q[1] * d[1] < -0.85)) continue;           // straight on: a split in the mapped way
          const side = -d[0] * tz + d[1] * tx, sn = Math.max(0.5, Math.abs(d[0] * tz - d[1] * tx));
          const half = (o.w / 2 + (main ? opw : 1.5)) / sn;   // (1.5: a flush corner the turning traffic may cut, as before)
          if (side > -0.2) cuts[0].push([acc - half, acc + half]);
          if (side < 0.2) cuts[1].push([acc - half, acc + half]);
        }
      }
    }
    const L = polylineLength(pts);
    return [toIntervals(cuts[0], L), toIntervals(cuts[1], L)];
  }
  /** (lanes pass) line-marking intervals: cut at real junctions only, not at a split in the mapped way */
  function markIntervals(r, extra) {
    const pts = r._pts, n = pts.length, cuts = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const k = key(pts[i]), J = junction.get(k); if (!J || J.length < 2) continue;
      const outs = []; for (const j of [i - 1, i + 1]) { if (j < 0 || j >= n) continue; const dx = pts[j][0] - pts[i][0], dz = pts[j][1] - pts[i][1], l = Math.hypot(dx, dz); if (l > 1e-6) outs.push([dx / l, dz / l]); }
      let m = 0;
      for (const e of J) { if (e.id === r.id || !e.r._pts) continue; if (dirsAt(e.r, k).some((d) => !outs.some((q) => q[0] * d[0] + q[1] * d[1] < -0.85))) m = Math.max(m, e.w); }
      if (m > 0) cuts.push([acc - m / 2 - extra, acc + m / 2 + extra]);
    }
    return toIntervals(cuts, polylineLength(pts));
  }
  const marks = (r, extra) => (LANES ? markIntervals(r, extra) : openIntervals(r, extra));

  /** Arc-length intervals of r not within junction mouths. extra = pad beyond the crossing road's half width. */
  function openIntervals(r, extra) {
    const pts = r._pts, L = polylineLength(pts), cuts = [];
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const m = otherMax(key(pts[i]), r.id);
      if (m > 0) cuts.push([acc - m / 2 - extra, acc + m / 2 + extra]);
    }
    cuts.sort((a, b) => a[0] - b[0]);
    const out = []; let s = 0;
    for (const c of cuts) { if (c[0] > s) out.push([s, c[0]]); s = Math.max(s, c[1]); }
    if (s < L) out.push([s, L]);
    return out.filter((iv) => iv[1] - iv[0] > 1.2);
  }

  // 2026-11 placement pass: a spot beside road `self` that lies in ANOTHER drawn carriageway (the cross road at a junction,
  // the other half of a dual carriageway, a service road's mouth) is no place for a lamp or a signal pole
  const inOtherCarriage = (x, z, rad, self) => {
    let hit = false;
    grid.queryRadius(x, z, 12, (it) => {
      if (it.road === self || it.kind === 'pedestrian' || (it.kind === 'service' && it.w < 3.5) || (it.road.tunnel && it.road.tunnel !== 'building_passage')) return;
      const d = distToSeg(x, z, it.ax, it.az, it.bx, it.bz);
      if (it.kind === 'service' ? d < it.w / 2 - 0.3 : d < it.w / 2 + rad + 0.1) { hit = true; return true; }
    });
    return hit;
  };
  const discs = new Map(); let discAsked = 0;
  const eastX = batch.eastX === undefined ? Infinity : batch.eastX;
  // Ribbons of ONE ground layer that lie over each other (z-fighting pass, 2026-11): the carriageways of two roads at a
  // junction, the pavements of two streets at a corner or of two ways mapped side by side, two paths where they cross.
  // The ground's layers are told apart by a depth bias per layer, so two ribbons of one layer lay in exactly the same
  // plane: pavements fought in zig-zags over every corner and traffic island (their flags run ALONG each street),
  // crossing paths of two surfaces swapped over, and carriageways were kept apart only by a width term plus a hash
  // (two roads of one width: from about 35 m away they flickered). Now every ribbon has a LEVEL that differs from
  // every ribbon it touches — the wider way on top, as before: taken in order of width, a way's level is above every
  // narrower way it lies over and is the lowest such level that no way of its own width (to half a metre) touching it
  // has taken — and its sub-layer is that level, a fixed step apart (what the levels in use
  // need: 0.1 of a layer for the nine levels the streets use, told apart to about 120 m, where the flags' joints and the
  // tarmac's grain are far below a pixel; 0.13 for the paths' seven).
  // world.groundHeight() is unchanged.
  const subLv = new Map(), subMax = [0, 0], subT0 = performance.now();
  for (const cls of [0, 1]) {
    const G = cls ? pathGrid : grid, list = roads.filter((r) => r._pts && r._pts.length >= 2 && (cls ? PATHS.has(r.kind) : VEHICLE.has(r.kind)));
    const reach = (r) => (cls ? Math.min(r.wide ? 14 : 6, Math.max(1.2, r.w)) / 2 + 0.3 : r.w / 2 + pwOf(r));
    const wq = (r) => Math.round(r.w * 2);
    list.sort((p, q) => wq(p) - wq(q) || hash01(p.id) - hash01(q.id));
    const taken = new Set(), known = new Set();
    let RMAX = 0; for (const r of list) RMAX = Math.max(RMAX, reach(r));
    // (the least distance between two segments: 0 where they cross)
    const side = (ax, az, bx, bz, px, pz) => (bx - ax) * (pz - az) - (bz - az) * (px - ax);
    const segDist = (ax, az, bx, bz, cx, cz, dx, dz) => (side(ax, az, bx, bz, cx, cz) * side(ax, az, bx, bz, dx, dz) < 0 && side(cx, cz, dx, dz, ax, az) * side(cx, cz, dx, dz, bx, bz) < 0 ? 0
      : Math.min(distToSeg(ax, az, cx, cz, dx, dz), distToSeg(bx, bz, cx, cz, dx, dz), distToSeg(cx, cz, ax, az, bx, bz), distToSeg(dx, dz, ax, az, bx, bz)));
    for (const r of list) {
      const pts = r._pts, R = reach(r), W = wq(r), pad = R + RMAX; let lv = 0; taken.clear(); known.clear();
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        G.query(Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad, (it) => {
          const o = it.road; if (o === r || known.has(o)) return;
          const lo = subLv.get(o); if (lo === undefined) return;      // (not placed yet: it will look at this one in its turn)
          if (segDist(a[0], a[1], b[0], b[1], it.ax, it.az, it.bx, it.bz) >= R + reach(o)) return;
          known.add(o);
          if (wq(o) < W) { if (lo >= lv) lv = lo + 1; } else taken.add(lo);
        });
      }
      while (taken.has(lv)) lv++;
      subLv.set(r, lv); if (lv > subMax[cls]) subMax[cls] = lv;
    }
  }
  // (a level's step: the layer shared out among the levels in use)
  const subStep = [0.88 / Math.max(6, subMax[0] + 1), 0.88 / Math.max(6, subMax[1] + 1)];
  const subL = (r, cls) => Math.min(0.88, ((subLv.get(r) || 0) + 1) * subStep[cls]);
  // (and a real hair of height per level, 0.6 mm — at most 5 mm, still under the footpaths' 0.045: the bias alone lifts
  //  a level by only step x 0.0005 x the eye's height above the road, a tenth of a millimetre for a walker, which the
  //  rounding of positions a kilometre from the origin swallows; seen on Radcliffe Square, setts against flags)
  const subY = (r) => Math.min(8, subLv.get(r) || 0) * 0.0006;
  ctx.stats.ribbonLevels = subMax.slice(); ctx.stats.ribbonMs = Math.round(performance.now() - subT0);
  for (const r of roads) {
    const pts = r._pts; if (!pts || pts.length < 2) continue;
    if (r.tunnel && r.tunnel !== 'building_passage') continue;
    if (r.layer && +r.layer < 0 && !r.bridge) continue;
    const mid = pointAt(pts, polylineLength(pts) / 2), mx = mid.x, mz = mid.z;
    const zone = ctx.zoneAt(mx, mz), hv = hash01(r.id);

    if (VEHICLE.has(r.kind)) {
      const named = r.name && NAMED[r.name];
      let cell = named ? named.cell : r.kind === 'pedestrian' ? surfaceCell(r.surface === 'asphalt' ? 'paving_stones' : r.surface, G.paving) : surfaceCell(r.surface, G.asphalt);
      if (cell === G.grass || cell === G.dirt && r.kind !== 'service') cell = G.asphalt;
      const tint = named && named.tint ? named.tint : cell === G.asphalt ? [0.92 + hv * 0.14, 0.92 + hv * 0.14, 0.92 + hv * 0.14] : [1, 1, 1];
      const layer = cell === G.asphalt || cell === G.parking ? 'road' : 'road2';
      const w = r.w;
      const buf = batch.buf(layer, mx, mz);
      // proper streets: the carriageway cell runs ALONG the road (gutters, wheel tracks, trench repairs); where two
      // roads overlap at a junction the wider one is on top (a fractional depth layer per road, so nothing z-fights)
      const along = layer === 'road' && cell === G.asphalt && r.kind !== 'service' && r.kind !== 'pedestrian' && w >= 4;
      if (along) {
        buf.L = 5 + subL(r, 0);
        setGroundCell(buf, G.carriageway, Math.floor(hv * 3200) / 8).setTint(tint);   // (roughness pass: + its patched version, some repeats)
        flatRibbon(buf, pts, w / 2, -w / 2, Y.road + subY(r), Math.max(5, w), 'along', [0.004, 0.996]);
        buf.L = 5;
      } else {
        // (road2: its levels in the lower 0.44 of the layer — place modules lay cobbles at 6.5)
        const L0 = buf.L; buf.L = L0 + (layer === 'road' ? subL(r, 0) : subL(r, 0) * 0.5);
        setGroundCell(buf, cell).setTint(tint);
        flatRibbon(buf, pts, w / 2, -w / 2, Y.road + subY(r), GS[cell], 'world');
        buf.L = L0;
      }
      buf.setCell(cell).setTint(tint);
      for (let i = 0; i < pts.length - 1; i++) H.push([0, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w / 2, 0, 1, 1]);
      // junction fill discs (only between asphalt roads). Pass 6: ONE disc per junction node (the largest asked for),
      // emitted after the loop — every road ending at a node used to lay its own 12-triangle disc on the same spot
      if (layer === 'road') for (const p of [pts[0], pts[pts.length - 1]]) {
        const om = otherMax(key(p), r.id); if (!om) continue;
        const rad = Math.min(w, om) / 2, k = key(p), prev = discs.get(k);
        if (!(mx >= eastX)) discAsked++;   // (the ledger counts the always-drawn mesh only: not the East Oxford tiles)
        // (every disc the same tone: two nodes a few metres apart lay their discs over each other in one plane, and
        //  each used to take the tone of its own road — a patch that flickered lighter and darker in the junction)
        if (!prev || rad > prev.rad) discs.set(k, { p, rad, cell, tint: cell === G.asphalt ? [0.99, 0.99, 0.99] : tint, mx, mz });
      }
      const pw = r.pw !== undefined ? r.pw : PAVEMENT_W[r.kind] || 0;     // r.pw: narrowed to fit the street (systems/_street_sanity.js fitWidths; 0 = a lane)
      const covered = r.tunnel || r.covered, rsegs = [];
      if (pw && !covered) {
        const ivs = openIntervals(r, 1.5);
        let pb = batch.buf('raised', mx, mz);
        const side = LANES ? sideIntervals(r) : null;
        const paveSide = (seg, s) => {
          const din = (s * w) / 2, dout = s * (w / 2 + pw);
          // flags or tarmac footway with the kerbstones painted in: the cell is mapped along the road, v 0 at the kerb
          // (pass 5: tarmac footways only in the suburbs — next to the flagged centre they read as slabs of road lying
          // on the pavement; and the cell is a fixed 2.6 m wide, cropped at the back, so kerbstones are 14 cm on every road)
          setGroundCell(pb, zone === 'centre' || zone === 'mid' || r.kind === 'primary' ? G.pavedKerb : (hv < 0.5 ? G.pavedKerb : G.tarmacKerb), Math.floor(hv * 3200) / 8 + (s > 0 ? 3 : 0)).setTint(zone === 'centre' ? [1.02, 1, 0.97] : [0.96, 0.96, 0.96]);
          const vb = Math.min(0.996, pw / 2.6);
          pb.L = 1 + subL(r, 0);      // (this street's pavements against the next street's: see subLv)
          flatRibbon(pb, seg, Math.max(din, dout), Math.min(din, dout), Y.pavement + subY(r), 5.2, 'along', s > 0 ? [0.004, vb] : [vb, 0.004]);
          pb.setCell(G.kerb).setTint(1, 1, 1);
          sideStrip(pb, seg, din, Y.road - 0.02, Y.pavement, -s, GS[G.kerb], GS[G.kerb]);
          sideStrip(pb, seg, dout, -0.02, Y.pavement, s, GS[G.kerb], GS[G.kerb]);
          // end caps (face outward along the road)
          for (const end of [0, 1]) {
            const L0 = pointAt(seg, end ? polylineLength(seg) : 0);
            const tx = end ? L0.dx : -L0.dx, tz = end ? L0.dz : -L0.dz, lx = -L0.dz, lz = L0.dx;
            wallQuad(pb, L0.x + lx * din, L0.z + lz * din, L0.x + lx * dout, L0.z + lz * dout, Y.road - 0.02, Y.pavement, tx, tz, 0, pw / GS[G.kerb], 0, 0.1);
          }
        };
        if (side) for (const [si, s] of [[0, 1], [1, -1]]) for (const [s0, s1] of side[si]) {
          // (lanes pass) each side's own intervals; groundHeight knows which side (flag 4: + side only, 8: - side only)
          const seg = slicePolyline(pts, s0, s1); if (seg.length < 2) continue;
          for (let i = 0; i < seg.length - 1; i++) H.push([1, seg[i][0], seg[i][1], seg[i + 1][0], seg[i + 1][1], w / 2, pw, i > 0 ? 1 : 0, (i < seg.length - 2 ? 1 : 0) + (s > 0 ? 2 : 4)]);
          paveSide(seg, s);
          roughPaveExtra(ctx, r, seg, w, pw);
        }
        // (lanes pass: the street's dirt goes where both sides really have their pavement)
        if (side) for (const [a0, a1] of side[0]) for (const [b0, b1] of side[1]) { const c0 = Math.max(a0, b0), c1 = Math.min(a1, b1); if (c1 - c0 > 1.2) { const seg = slicePolyline(pts, c0, c1); if (seg.length >= 2) rsegs.push(seg); } }
        for (const [s0, s1] of ivs) {
          const seg = slicePolyline(pts, s0, s1); if (seg.length < 2) continue;
          if (!side) rsegs.push(seg);
          if (!side) {
            for (let i = 0; i < seg.length - 1; i++) H.push([1, seg[i][0], seg[i][1], seg[i + 1][0], seg[i + 1][1], w / 2, pw, i > 0 ? 1 : 0, i < seg.length - 2 ? 1 : 0]);
            for (const s of [1, -1]) paveSide(seg, s);
          }
          // street lamps along the kerb, alternating sides
          const segL = polylineLength(seg), step = r.kind === 'primary' ? 26 : 32;
          for (let d = 6 + hv * 10, k = 0; d < segL - 3; d += step, k++) {
            const s = k % 2 ? 1 : -1;
            // slid a few metres along the kerb when the spot is in another carriageway (dropped if no nearby spot is clear)
            for (const sl of [0, 3, -3, 6, -6]) {
              const dd = d + sl; if (dd < 1.5 || dd > segL - 1.5) continue;
              const P = pointAt(seg, dd), x = P.x + -P.dz * s * (w / 2 + 0.5), z = P.z + P.dx * s * (w / 2 + 0.5);
              if (inOtherCarriage(x, z, 0.13, r)) continue;
              ctx.lampSpots.push([x, z, Math.atan2(P.dz * s, -P.dx * s)]);
              break;
            }
          }
        }
      } else if (PAVEMENT_W[r.kind] && !covered) {
        // a lane without a pavement (fitted between its walls): the odd lamp just off the carriageway, against the wall
        const L = polylineLength(pts);
        for (let d = 8 + hv * 10, k = 0; d < L - 4; d += 26, k++) {
          const P = pointAt(pts, d), s = k % 2 ? 1 : -1, off = w / 2 + 0.2, x = P.x - P.dz * s * off, z = P.z + P.dx * s * off;
          if (!inOtherCarriage(x, z, 0.13, r)) ctx.lampSpots.push([x, z, Math.atan2(P.dz * s, -P.dx * s)]);
        }
      } else if (r.kind === 'pedestrian' || r.kind === 'living_street') {
        const L = polylineLength(pts);
        for (let d = 8 + hv * 8, k = 0; d < L - 3; d += 22, k++) {
          const P = pointAt(pts, d), s = k % 2 ? 1 : -1, off = Math.max(1, w / 2 - 0.6);
          ctx.lampSpots.push([P.x - P.dz * s * off, P.z + P.dx * s * off, 0]);
        }
      }
      // markings
      if (!covered && !(named && named.noLines)) {
        let mb = batch.buf('markings', mx, mz);
        const mbAt = () => mb;
        // (paint has a thickness. The long lines — centre lines, yellow lines — lie 1 to 4 mm UNDER the other paint
        //  (zebra stripes, give-way lines, symbols, at Y.marking): a centre line running through a crossing used to be
        //  in the stripes' own plane and its dashes flickered through them. And the lines of the way that lies on top
        //  are 0.4 mm above those of the way under it: where one carriageway is mapped as two ways lying over each
        //  other, their lines were painted in one plane and their dashes flickered through each other.)
        const Ym = Y.marking - 0.004 + Math.min(8, subLv.get(r) || 0) * 0.0004;
        if (CENTRE_LINE.has(r.kind) && !r.oneway && w >= 6) {
          for (const [s0, s1] of marks(r, 1)) {
            const seg = slicePolyline(pts, s0, s1); if (seg.length < 2) continue;
            mbAt(seg);
            flatRibbon(mb, seg, 0.07, -0.07, Ym, 9, 'along', markRowV(MARK_ROWS.dash));
          }
        }
        if (YELLOWS.has(r.kind) && (zone === 'centre' || CENTRE_LINE.has(r.kind)) && w >= 5 && hv < 0.85) {
          for (const [s0, s1] of marks(r, 2.5)) {
            const seg = slicePolyline(pts, s0, s1); if (seg.length < 2) continue;
            mbAt(seg);
            for (const s of [1, -1]) { const o = s * (w / 2 - 0.35), yh = MARK_LEN.yellowHalf; flatRibbon(mb, seg, o + yh, o - yh, Ym, MARK_LEN.yellow, 'along', markRowV(MARK_ROWS.yellow)); }
          }
        }
      }
      if (!covered && r.kind !== 'pedestrian' && r.kind !== 'service' && w >= 5) streetDetail(ctx, r, pts, w, zone, hv, otherMax, named);
      if (r.bridge) bridgeParapets(ctx, r, pts, w / 2 + (pw || 0.3) + 0.25, true, mx, mz);
      if (!covered) roughStreet(ctx, r, pts, w, pw, rsegs, zone, mx, mz);   // roughness pass: gutters, stains, cracks, weeds (decals in the contact-shadow batch)
      continue;
    }

    if (PATHS.has(r.kind)) {
      if (r.footway === 'crossing' || r.surface === 'grass') continue;
      let fallback = r.kind === 'path' ? (zone === 'centre' ? G.gravel : G.dirt) : r.kind === 'track' || r.kind === 'bridleway' ? G.dirt : r.kind === 'cycleway' ? G.asphalt : zone === 'centre' ? G.paving : G.asphalt;
      if (r.kind === 'footway' && r.footway === 'sidewalk') fallback = G.paving;
      let cell = surfaceCell(r.surface, fallback);
      if (r.bridge === 'boardwalk') cell = G.boards;
      const q1 = pointAt(pts, polylineLength(pts) * 0.2), q3 = pointAt(pts, polylineLength(pts) * 0.8);
      const green = (inGreen(mx, mz) ? 1 : 0) + (inGreen(q1.x, q1.z) ? 1 : 0) + (inGreen(q3.x, q3.z) ? 1 : 0) >= 2;
      // untagged footways and paths across grass or inside a college / park site: hoggin, as in the college gardens
      if (!r.surface && r.kind !== 'cycleway' && r.kind !== 'steps' && r.footway !== 'sidewalk' && !r.bridge && (green || (cell === G.asphalt && inSite(mx, mz)))) cell = G.gravel;
      const worn = green && r.kind !== 'steps' && !r.bridge ? (cell === G.gravel ? G.gravelPath : cell === G.dirt ? G.earthPath : cell === G.asphalt ? G.tarmacPath : 0) : 0;
      // (a place module may set `r.wide` on a walk wider than 6 m, e.g. Broad Walk, and `r.tint` for its gravel)
      const w = Math.min(r.wide ? 14 : 6, Math.max(1.2, r.w)) + (worn ? 0.5 : 0);
      const buf = batch.buf('path', mx, mz);
      buf.L = 7 + subL(r, 1);      // (where two paths cross or run together the wider lies on top: see subLv)
      const tint = r.tint || (r.kind === 'cycleway' && cell === G.asphalt ? [1.03, 0.97, 0.95] : [0.96 + hv * 0.08, 0.96 + hv * 0.08, 0.95]);
      for (let i = 0; i < pts.length - 1; i++) H.push([2, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w / 2, 0, 1, 1]);
      if (r.kind === 'steps') { buf.setCell(G.steps).setTint(1, 1, 1); flatRibbon(buf, pts, w / 2, -w / 2, Y.path, GS[G.steps], 'along'); }
      else if (worn) { buf.setCell(worn).setTint(tint); flatRibbon(buf, pts, w / 2, -w / 2, Y.path + subY(r), 4, 'along', [0.004, 0.996]); roughPath(ctx, r, pts, w, mx, mz); }
      else { setGroundCell(buf, cell).setTint(tint); flatRibbon(buf, pts, w / 2, -w / 2, Y.path + subY(r), GS[cell], 'world'); }
      if (r.kind === 'footway' && zone !== 'west' && !r.footway) {
        const L = polylineLength(pts);
        if (L > 40 && hv < 0.6) for (let d = 12, k = 0; d < L - 10; d += 38, k++) { const P = pointAt(pts, d); ctx.lampSpots.push([P.x - P.dz * (w / 2 + 0.4), P.z + P.dx * (w / 2 + 0.4), 0]); }
      }
      // (r.noParapet: a footway mapped along the side of a road bridge - the road bridge's parapet is its railing;
      // systems/_street_sanity.js sidewalkBridges, 2026-11: iron railings ran through Magdalen Bridge's balustrade)
      if (r.bridge && !r.noParapet) bridgeParapets(ctx, r, pts, w / 2 + 0.15, false, mx, mz);
    }
  }
  // the junction discs, one per node. Pass 7: an octagon drawn ROUND the circle (6 triangles) instead of a 10-gon
  // inside it (8): it covers what the 10-gon covered, and the two triangles a node go to the quad-facing walls' depth
  for (const { p, rad, cell, tint, mx, mz } of discs.values()) {
    // (and groundHeight knows it is road: the corner a turning vehicle cuts across used to read as the bare ground round it)
    H.push([0, p[0], p[1], p[0] + 1e-3, p[1], rad, 0, 1, 1]);
    const buf = batch.buf('road', mx, mz); buf.L = 5; buf.setCell(cell).setTint(tint);
    const ring = [], ro = rad / Math.cos(Math.PI / 8);
    for (let k = 0; k < 8; k++) { const a = ((k + 0.5) / 8) * Math.PI * 2, x = p[0] + Math.cos(a) * ro, z = p[1] + Math.sin(a) * ro; ring.push(buf.v(x, Y.road, z, 0, 1, 0, x / GS[cell], z / GS[cell])); }
    for (let k = 1; k < 7; k++) buf.triFacing(ring[0], ring[k], ring[k + 1], 0, 1, 0);
  }
  roughFlush(ctx);
  let discMain = 0; for (const d of discs.values()) if (!(d.mx >= eastX)) discMain++;
  ctx.stats.groundSaved = discAsked * 12 - discMain * 8;
  ctx.stats.alwaysSaved7 = (ctx.stats.alwaysSaved7 || 0) + discMain * 2;

  // zebra crossings + Belisha beacons, traffic-light spots
  const zebras = [];
  for (const p of map.pois) {
    if (p.kind !== 'crossing' && p.kind !== 'traffic_signals') continue;
    const near = nearestRoad(ctx, p.p[0], p.p[1], 8, (it) => it.kind !== 'service' && it.kind !== 'pedestrian');
    if (!near) continue;
    const { it, t } = near;
    let dx = it.bx - it.ax, dz = it.bz - it.az; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz, nz = dx, cx = it.ax + (it.bx - it.ax) * t, cz = it.az + (it.bz - it.az) * t, hw = it.w / 2;
    if (p.kind === 'traffic_signals') {
      // signals mapped on the junction node: each pole goes back along its kerb until it is out of the cross road's
      // carriageway (it used to stand in the middle of the junction); the stop line moves with the poles
      let shift = 0;
      for (const sd of [1, -1]) {
        let ok = null;
        // (2026-11: 1.2 m clear of the cross road's kerb where that can be had - a bus turning the corner sweeps its tail
        // over the inside of it, the Carfax / Beaumont Street / Botley Road poles - else just clear of its carriageway)
        for (const clr of [1.2, 0.12]) for (let k = 0; k <= 16 && !ok; k += 2) for (const dir of k ? [-1, 1] : [1]) { const q = k * dir, x = cx + nx * sd * (hw + 0.5) + dx * q, z = cz + nz * sd * (hw + 0.5) + dz * q; if (!inOtherCarriage(x, z, clr, it.road)) { ok = [x, z, q]; break; } }
        if (!ok) continue;
        if (Math.abs(ok[2]) > Math.abs(shift)) shift = ok[2];
        ctx.signalSpots.push([ok[0], ok[1], sd > 0 ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz)]);
      }
      cross(batch.buf('markings', cx, cz), cx + dx * shift, cz + dz * shift, dx, dz, hw - 0.3, 0.2, MARK_ROWS.white, 1);
      continue;
    }
    if (!(p.crossing === 'zebra' || p.crossing === 'uncontrolled' || p.crossing === 'marked')) continue;
    // (one crossing mapped as two nodes a metre or two apart — eleven of them — painted two sets of stripes over each
    //  other in one plane, and stood two pairs of beacons in one place: the second is the first)
    if (zebras.some((q) => Math.hypot(q[0] - cx, q[1] - cz) < 3.2)) continue; zebras.push([cx, cz]);
    const mb = batch.buf('markings', cx, cz);
    const [v0, v1] = markRowV(MARK_ROWS.zebra), a = hw - 0.3, h = 1.5;
    const P = (s, q) => [cx + nx * s + dx * q, cz + nz * s + dz * q];
    const c0 = P(-a, -h), c1 = P(a, -h), c2 = P(a, h), c3 = P(-a, h);
    const i0 = mb.v(c0[0], Y.marking, c0[1], 0, 1, 0, 0, v0), i1 = mb.v(c1[0], Y.marking, c1[1], 0, 1, 0, (2 * a) / 1.0, v0);
    const i2 = mb.v(c2[0], Y.marking, c2[1], 0, 1, 0, (2 * a) / 1.0, v1), i3 = mb.v(c3[0], Y.marking, c3[1], 0, 1, 0, 0, v1);
    mb.quadFacing(i0, i1, i2, i3, 0, 1, 0);
    // zig-zags on both approaches: along each kerb and the centre line, 9 m either side of the crossing
    if (p.crossing === 'zebra' || p.crossing === 'marked') for (const dir of [1, -1]) for (const o of [-(hw - 0.45), 0, hw - 0.45]) {
      const a0 = P(o, dir * 2.3), a1 = P(o, dir * 11.3), [zv0, zv1] = markRowV(MARK_ROWS.zigzag);
      flatRibbon(mb, [a0, a1], 0.3, -0.3, Y.marking, 4, 'along', [zv0, zv1]);
    }
    if (p.crossing === 'zebra' || p.crossing === 'marked') ctx.belishaSpots.push([cx + nx * (hw + 0.6), cz + nz * (hw + 0.6)], [cx - nx * (hw + 0.6), cz - nz * (hw + 0.6)]);
  }
}

/** Transverse line across a road at (cx,cz): half-length a across (normal of d), half-thickness t along d. */
function cross(mb, cx, cz, dx, dz, a, t, row, rep) {
  const nx = -dz, nz = dx, [v0, v1] = markRowV(row);
  const c0 = [cx - nx * a - dx * t, cz - nz * a - dz * t], c1 = [cx + nx * a - dx * t, cz + nz * a - dz * t], c2 = [cx + nx * a + dx * t, cz + nz * a + dz * t], c3 = [cx - nx * a + dx * t, cz - nz * a + dz * t];
  const i0 = mb.v(c0[0], Y.marking, c0[1], 0, 1, 0, 0, v0), i1 = mb.v(c1[0], Y.marking, c1[1], 0, 1, 0, rep, v0), i2 = mb.v(c2[0], Y.marking, c2[1], 0, 1, 0, rep, v1), i3 = mb.v(c3[0], Y.marking, c3[1], 0, 1, 0, 0, v1);
  mb.quadFacing(i0, i1, i2, i3, 0, 1, 0);
}
/** A decal quad lying on the road: centre, direction d, half-length along, half-width across, u range within its row. */
function decal(mb, cx, cz, dx, dz, hl, hwid, row, u0, u1, lift = 0) {
  const nx = -dz, nz = dx, [v0, v1] = markRowV(row), Ym = Y.marking + lift;
  const P = (s, q) => [cx + dx * s + nx * q, cz + dz * s + nz * q];
  const a = P(-hl, -hwid), b = P(hl, -hwid), c = P(hl, hwid), d = P(-hl, hwid);
  const i0 = mb.v(a[0], Ym, a[1], 0, 1, 0, u0, v0), i1 = mb.v(b[0], Ym, b[1], 0, 1, 0, u1, v0), i2 = mb.v(c[0], Ym, c[1], 0, 1, 0, u1, v1), i3 = mb.v(d[0], Ym, d[1], 0, 1, 0, u0, v1);
  mb.quadFacing(i0, i1, i2, i3, 0, 1, 0);
}
/**
 * Paint and ironwork that make a carriageway read as a real street: give-way lines where a minor road meets a bigger
 * one, gully grates along the kerbs and the odd manhole cover, advisory cycle lanes with cycle symbols on the wide
 * radial roads, Broad Street's centre parking bays. All in the existing markings tiles.
 */
function streetDetail(ctx, r, pts, w, zone, hv, otherMax, named) {
  const { batch } = ctx, L = polylineLength(pts);
  if (L < 6) return;
  const mid = pointAt(pts, L / 2), mb = batch.buf('markings', mid.x, mid.z);
  // give-way: double broken line across the mouth of the narrower road
  for (const end of [0, 1]) {
    const p = end ? pts[pts.length - 1] : pts[0], om = otherMax(key(p), r.id);
    if (!(om > w + 0.4)) continue;
    const s = end ? L - om / 2 - 0.5 : om / 2 + 0.5; if (s < 1 || s > L - 1) continue;
    const P = pointAt(pts, s), sg = end ? 1 : -1;
    // on the side of the traffic arriving at the junction (drive on the left)
    const off = r.oneway ? 0 : -sg * w / 4, half = r.oneway ? w / 2 - 0.4 : w / 4 - 0.2;
    for (const k of [0, 0.42]) cross(mb, P.x - P.dz * off + P.dx * sg * -k, P.z + P.dx * off + P.dz * sg * -k, P.dx, P.dz, half, 0.1, MARK_ROWS.dash, half / 0.9);
  }
  // ironwork
  const step = 42 + hv * 12;
  for (let d = 5 + hv * 14, k = 0; d < L - 4; d += step, k++) {
    const P = pointAt(pts, d), s = k % 2 ? 1 : -1, o = s * (w / 2 - 0.34);
    // (roughness pass: the gully grate lies 8 mm proud of the paint, so the yellow lines it sits among — the same layer —
    // no longer fight it for the surface; the lines stop at it, as on a real street)
    decal(mb, P.x - P.dz * o, P.z + P.dx * o, P.dx, P.dz, 0.26, 0.2, MARK_ROWS.iron, 0.54, 0.96, ROUGH ? 0.008 : 0);
    if (k % 3 === 1) { const o2 = -s * w * 0.21; decal(mb, P.x - P.dz * o2 + P.dx * 3, P.z + P.dx * o2 + P.dz * 3, P.dx, P.dz, 0.33, 0.33, MARK_ROWS.iron, 0.03, 0.47); }
  }
  // advisory cycle lanes on the wide radial roads (Banbury, Woodstock, Iffley, Abingdon, Botley...): GUESS for c. 2013
  if (r.kind === 'primary' && w >= 9.5 && zone !== 'centre' && L > 30 && !r.oneway) {
    for (const s of [1, -1]) {
      const o = s * (w / 2 - 1.5);
      flatRibbon(mb, pts, o + 0.06, o - 0.06, Y.marking, 6, 'along', markRowV(MARK_ROWS.dash));
      for (let d = 18 + hv * 20; d < L - 8; d += 70) { const P = pointAt(pts, d), oo = s * (w / 2 - 0.8); decal(mb, P.x - P.dz * oo, P.z + P.dx * oo, P.dx * -s, P.dz * -s, 0.85, 0.5, MARK_ROWS.symbol, 0.03, 0.47); }
    }
  }
  // Broad Street, the wide eastern half: pay-and-display bays down the middle (as c. 2013)
  if (r.id === 'w282027362') {
    for (let d = 6; d < L - 6; d += 2.5) { const P = pointAt(pts, d); cross(mb, P.x, P.z, P.dx, P.dz, 4.9, 0.05, MARK_ROWS.white, 1); }
    flatRibbon(mb, slicePolyline(pts, 6, L - 6), 0.05, -0.05, Y.marking, 1, 'along', markRowV(MARK_ROWS.white));
  }
}

function bridgeParapets(ctx, r, pts, off, stone, mx, mz) {
  const { batch } = ctx;
  for (const s of [1, -1]) {
    const line = pts;
    if (stone) {
      const buf = batch.buf('facade', mx, mz);
      buf.setDetail(true).setCell(F.stoneBlank).setTint(0.95, 0.93, 0.88);
      thickWall(buf, line, -0.6, 1.05, 0.45, { offset: s * off, uScale: 3.2, vScale: 3.2 });
      buf.setDetail(false);
    } else {
      const fb = batch.buf('fence', mx, mz);
      const v = r.bridge === 'boardwalk' ? [0.02, 0.48] : [0.52, 0.98];
      railingStrip(fb, line, s * off, 0, 1.1, v);
    }
  }
}

/** Double-sided alpha-tested railing/fence strip along pts at lateral offset. v = [v0,v1] row range. */
export function railingStrip(buf, pts, off, y0, y1, v) {
  let acc = 0, pa = -1, pb = -1, prev = null;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const P = pts[i];
    const pp = pts[Math.max(0, i - 1)], pn = pts[Math.min(pts.length - 1, i + 1)];
    let dx = pn[0] - pp[0], dz = pn[1] - pp[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const x = P[0] - dz * off, z = P[1] + dx * off;
    const a = buf.v(x, y0, z, -dz, 0, dx, acc, v[0]), b = buf.v(x, y1, z, -dz, 0, dx, acc, v[1]);
    if (pa >= 0) buf.quadFacing(pa, a, b, pb, prev[0], 0, prev[1]);
    pa = a; pb = b; prev = [-dz, dx];
  }
}

/** Nearest vehicle-road segment to (x,z) within r. -> {it, t, d} or null */
export function nearestRoad(ctx, x, z, r, filter) {
  let best = null;
  ctx.roadGrid.queryRadius(x, z, r, (it) => {
    if (filter && !filter(it)) return;
    const d = distToSeg(x, z, it.ax, it.az, it.bx, it.bz);
    if (d <= r && (!best || d < best.d)) {
      const dx = it.bx - it.ax, dz = it.bz - it.az, l2 = dx * dx + dz * dz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - it.ax) * dx + (z - it.az) * dz) / l2)) : 0;
      best = { it, t, d };
    }
  });
  return best;
}

/**
 * Height of the drawn ground surface: world.groundHeight(x, z). Carriageways sit at Y.road, footpaths at Y.path, raised
 * pavements at Y.pavement (only where they are drawn: not across junction mouths, tunnels or covered ways). Off the
 * roads it is the drawn landuse layer: base ground 0.00, parks/meadows/woods 0.01, grass/gardens/paved squares 0.02,
 * college lawns/pitches/flowerbeds 0.03 (the drawn landuse triangles rasterised once into a 2 m Uint8Array of layer ids). The kerb is
 * a 0.14 m ramp on the LOW side of each pavement edge, so nothing standing on the pavement is ever below the drawn
 * surface. One grid-cell lookup + one typed-array read, no allocation.
 */
export function makeGroundHeight(ctx) {
  const CELL = 16, PAD = 9, RAMP = 0.14, cells = new Map();
  const segs = ctx.heightSegs || [], N = segs.length;
  const K = new Float32Array(N * 9);
  for (let i = 0; i < N; i++) {
    const s = segs[i], [kind, ax, az, bx, bz, hw, pw, o0, o1] = s, len = Math.hypot(bx - ax, bz - az) || 1e-6;
    K.set([kind, ax, az, (bx - ax) / len, (bz - az) / len, len, hw, pw, o0 + o1 * 2], i * 9);
    const reach = hw + pw + (kind === 1 ? RAMP : 0) + 0.1; if (reach > PAD) continue;
    const x0 = Math.floor((Math.min(ax, bx) - reach) / CELL), x1 = Math.floor((Math.max(ax, bx) + reach) / CELL), z0 = Math.floor((Math.min(az, bz) - reach) / CELL), z1 = Math.floor((Math.max(az, bz) + reach) / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const k = (ix + 32768) * 65536 + (iz + 32768); let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(i * 9); }
  }
  for (const [k, a] of cells) cells.set(k, Int32Array.from(a));
  // landuse raster: 2 m cells of layer ids (0 base, 1 area0, 2 area1, 3 area2); the highest drawn layer wins
  const AC = 2, AH = new Float32Array([Y.base, Y.area0, Y.area1, Y.area2]);
  const mb = ctx.map.bounds, ax0 = Math.floor(mb.minX / AC) * AC - 8, az0 = Math.floor(mb.minZ / AC) * AC - 8;
  const anx = Math.ceil((mb.maxX + 8 - ax0) / AC), anz = Math.ceil((mb.maxZ + 8 - az0) / AC), area = new Uint8Array(anx * anz);
  {
    const T = ctx.areaTris || [];
    for (let i = 0; i < T.length; i += 7) {
      const id = T[i], x0 = T[i + 1], z0 = T[i + 2], x1 = T[i + 3], z1 = T[i + 4], x2 = T[i + 5], z2 = T[i + 6];
      const zmin = Math.min(z0, z1, z2), zmax = Math.max(z0, z1, z2);
      const r0 = Math.max(0, Math.ceil((zmin - az0) / AC - 0.5)), r1 = Math.min(anz - 1, Math.floor((zmax - az0) / AC - 0.5));
      for (let r = r0; r <= r1; r++) {
        const zc = az0 + (r + 0.5) * AC; let xa = 1e9, xb = -1e9;
        if ((z0 > zc) !== (z1 > zc)) { const x = x0 + (zc - z0) / (z1 - z0) * (x1 - x0); if (x < xa) xa = x; if (x > xb) xb = x; }
        if ((z1 > zc) !== (z2 > zc)) { const x = x1 + (zc - z1) / (z2 - z1) * (x2 - x1); if (x < xa) xa = x; if (x > xb) xb = x; }
        if ((z2 > zc) !== (z0 > zc)) { const x = x2 + (zc - z2) / (z0 - z2) * (x0 - x2); if (x < xa) xa = x; if (x > xb) xb = x; }
        const c0 = Math.max(0, Math.ceil((xa - ax0) / AC - 0.5)), c1 = Math.min(anx - 1, Math.floor((xb - ax0) / AC - 0.5));
        for (let c = c0, o = r * anx; c <= c1; c++) if (area[o + c] < id) area[o + c] = id;
      }
    }
    ctx.areaTris = null;
  }
  const ROAD = Y.road, PATH = Y.path, PAVE = Y.pavement;
  return function groundHeight(x, z) {
    const gx = Math.floor((x - ax0) / AC), gz = Math.floor((z - az0) / AC);
    const BASE = gx >= 0 && gz >= 0 && gx < anx && gz < anz ? AH[area[gz * anx + gx]] : 0;
    const a = cells.get((Math.floor(x / CELL) + 32768) * 65536 + (Math.floor(z / CELL) + 32768));
    if (!a) return BASE;
    let h = BASE, road = false, deep = false, pave = -1;
    for (let j = 0; j < a.length; j++) {
      const o = a[j], kind = K[o], px = x - K[o + 1], pz = z - K[o + 2], dx = K[o + 3], dz = K[o + 4], len = K[o + 5], hw = K[o + 6];
      const t = px * dx + pz * dz, perp = Math.abs(px * dz - pz * dx);
      if (kind !== 1) {
        const tc = t < 0 ? 0 : t > len ? len : t, ex = px - dx * tc, ez = pz - dz * tc;
        const e2 = ex * ex + ez * ez;
        if (e2 < hw * hw) { if (kind === 0) { road = true; if (hw > RAMP && e2 < (hw - RAMP) * (hw - RAMP)) deep = true; } else if (PATH > h) h = PATH; }
        continue;
      }
      // pavement strip: both sides of the carriageway, hw .. hw + pw from the centre line (lanes pass: flag 4 = the left
      // (+ normal) side only, 8 = the right side only)
      const fl = K[o + 8], pw = K[o + 7];
      if (fl & 12) { const cr = px * dz - pz * dx; if (fl & 4 ? cr > 0 : cr < 0) continue; }
      let along = 1, d = perp;
      if (t < 0) { if (fl & 1) d = Math.hypot(px, pz); else if (t > -RAMP) along = 1 + t / RAMP; else continue; }
      else if (t > len) { const qx = px - dx * len, qz = pz - dz * len; if (fl & 2) d = Math.hypot(qx, qz); else if (t < len + RAMP) along = 1 - (t - len) / RAMP; else continue; }
      let k = 0;
      if (d >= hw && d <= hw + pw) k = 1;
      else if (d > hw - RAMP && d < hw) k = (d - (hw - RAMP)) / RAMP;
      else if (d > hw + pw && d < hw + pw + RAMP) k = 1 - (d - hw - pw) / RAMP;
      k *= along;
      if (k > pave) pave = k;
    }
    if (road && ROAD > h) h = ROAD;
    // (2026-11: a point well inside a carriageway - beyond its kerb ramp - is road, whatever pavement strip reaches it. The
    // round joins of a pavement's segments covered the inside of the street's own bends - drawn as mitred ribbons, so
    // nothing raised is drawn there - and every vehicle crossing one rose 9 cm: "a bump that isn't there")
    if (pave > 0 && !deep) { const hp = h + (PAVE - h) * pave; if (hp > h) h = hp; }
    return h;
  };
}
