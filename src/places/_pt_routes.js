// Purple Turtle — pure geometry of the walk home (no three.js): the Frewin Court alley frame, walk-home destinations
// (college lodges and house doors from the map), and the routes leavers follow over the pedestrian graph
// (game.pedestrians graph: {X, Z, start, nbr, count}). Covered by tools/smoke_pt.mjs.
import { graphPath, cumLen, makeTimeline, nearestGraphNode, hash } from './_pt_logic.js';

const A = [75.5, 232.5], EX = [0.9231, -0.3846], EY = [-0.3846, -0.9231];
/** alley frame: u along the north wall of Frewin Court from (75.5, 232.5) towards Cornmarket, v = depth INTO the building
 *  (v < 0 is the alley; the Clarendon Centre wall opposite is at v ≈ −2.27) */
export const ALLEY = {
  A, EX, EY, width: 2.27, depth: 11.6,
  P: (u, v) => [A[0] + u * EX[0] + v * EY[0], A[1] + u * EX[1] + v * EY[1]],
  hU: Math.atan2(EX[0], EX[1]), hOut: Math.atan2(-EY[0], -EY[1]),
  niche: [1.0, 2.6], nicheDepth: 0.9, nicheH: 2.45, passage: [3.25, 5.45], passageH: 3.0,
  door: [1.8, -0.3], doorIn: [1.8, 0.7],
  queue: { u0: 2.4, du: 0.72, v: -1.85, rope: -1.4 },
  lamp2: [15.5, -0.25], walkV: -0.62,
  van: { x: 113.64, z: 235.37, h: 0.32 },
};
const vanL = (x, z) => { const V = ALLEY.van, c = Math.cos(V.h), s = Math.sin(V.h); return [V.x + x * c + z * s, V.z - x * s + z * c]; };
/** where van customers stand (k = place in the van queue) and which way they face */
export const VAN = { spot: (k) => vanL(2.0 + (k % 2) * 0.15, -0.15 - k * 0.8), face: ALLEY.van.h - Math.PI / 2, vendor: vanL(0.45, -0.15), vendorH: ALLEY.van.h + Math.PI / 2 };

export const DEST_SPECS = [
  { name: "St Peter's College lodge", kind: 'lodge', p: [-47.7, 244.0] },
  { name: 'Exeter College lodge', kind: 'lodge', p: [256.1, 149.1] },
  { name: 'Lincoln College lodge', kind: 'lodge', p: [270.9, 203.1] },
  { name: 'Jesus College (Ship Street gate)', kind: 'lodge', p: [177.5, 216.9] },
  { name: 'Balliol College', kind: 'lodge', p: [188.1, 61.1] },
  { name: 'Worcester College lodge', kind: 'lodge', p: [-236.3, 9.6], via: [[-219.0, 8.6], [-229.5, 8.8]], out: [1, 0], noLeaf: true },
  { name: "St John's College lodge", kind: 'lodge', p: [83.0, -78.9] },
  { name: 'Pembroke College lodge', kind: 'lodge', p: [66.8, 499.6] },
  { name: 'Christ Church, Tom Gate', kind: 'lodge', p: [232.2, 530.7] },
  { name: '1 St John Street', kind: 'house', bld: 'w27183574', street: 'St John Street' },
  { name: '2-4 St John Street', kind: 'house', bld: 'w234794127', street: 'St John Street' },
  { name: '172 Walton Street', kind: 'house', bld: 'w304762001', street: 'Walton Street' },
  { name: '40 Pembroke Street', kind: 'house', bld: 'w378007963', street: 'Pembroke Street' },
];

function pip(x, z, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); const x = ax + dx * t, z = az + dz * t; return { d: Math.hypot(px - x, pz - z), x, z }; }

/**
 * Snap each destination to a building edge, find its outward normal and a reachable graph node.
 * blocked(x1,z1,x2,z2) -> true if a wall is in the way (optional). -> [{name, kind, door, out, node, approach, via, noLeaf}]
 */
export function resolveDestinations(map, G, blocked = null, fromNode = -1) {
  const out = [];
  const byId = new Map(); for (const b of map.buildings) byId.set(b.id, b);
  for (const S of DEST_SPECS) {
    let door = null, nrm = null, poly = null;
    if (S.kind === 'house') {
      const b = byId.get(S.bld); if (!b) continue; poly = b.poly;
      const roads = map.roads.filter((r) => r.name === S.street);
      let best = Infinity;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], c = poly[(i + 1) % poly.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 2.5) continue;
        const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
        for (const r of roads) for (let k = 0; k < r.pts.length - 1; k++) { const q = segDist(mx, mz, r.pts[k][0], r.pts[k][1], r.pts[k + 1][0], r.pts[k + 1][1]); if (q.d < best) { best = q.d; door = [mx, mz]; nrm = [(c[1] - a[1]) / L, -(c[0] - a[0]) / L]; } }
      }
    } else {
      let best = 5;
      for (const b of map.buildings) {
        if (b.part) continue;
        const p = b.poly; if (Math.abs(b.c[0] - S.p[0]) > 120 || Math.abs(b.c[1] - S.p[1]) > 120) continue;
        for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length], q = segDist(S.p[0], S.p[1], a[0], a[1], c[0], c[1]); const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
          if (q.d < best && L > 1.5) { best = q.d; door = [q.x, q.z]; nrm = [(c[1] - a[1]) / L, -(c[0] - a[0]) / L]; poly = p; } }
      }
      if (!door) { door = S.p.slice(); nrm = null; }
    }
    if (S.out) nrm = S.out.slice();
    if (!door) continue;
    if (!nrm) { const n = nearestGraphNode(G, door[0], door[1], 30); if (n < 0) continue; const dx = G.X[n] - door[0], dz = G.Z[n] - door[1], l = Math.hypot(dx, dz) || 1; nrm = [dx / l, dz / l]; }
    else if (poly && !S.out && pip(door[0] + nrm[0] * 0.5, door[1] + nrm[1] * 0.5, poly)) nrm = [-nrm[0], -nrm[1]];
    // try the outward side first, then the other; pick the reachable graph node with the shortest walk from the club
    let best = null;
    for (const sg of S.out ? [1] : [1, -1]) {
      const nn = [nrm[0] * sg, nrm[1] * sg], ap = S.via ? S.via[0] : [door[0] + nn[0] * 1.8, door[1] + nn[1] * 1.8];
      const cands = [];
      for (let i = 0; i < G.count; i++) { const d = Math.hypot(G.X[i] - ap[0], G.Z[i] - ap[1]); if (d < 35) cands.push([d, i]); }
      cands.sort((a, b) => a[0] - b[0]);
      let tried = 0;
      for (const [dd, i] of cands) {
        if (tried >= 8) break;
        if (blocked && !S.via && blocked(G.X[i], G.Z[i], ap[0], ap[1])) continue;
        tried++;
        let cost = dd;
        if (fromNode >= 0) { const pth = graphPath(G, fromNode, i); if (!pth) continue; cost += cumLen(pth.map((k) => [G.X[k], G.Z[k]])).pop(); }
        if (!best || cost < best.cost) best = { cost, node: i, ap, out: nn };
      }
      if (best && sg === 1 && poly) break;      // the outward side worked: don't go round the back
    }
    if (!best) continue;
    const node = best.node, ap = best.ap; nrm = best.out;
    out.push({ name: S.name, kind: S.kind, door, out: nrm, node, approach: ap, via: S.via || null, noLeaf: !!S.noLeaf });
  }
  return out;
}

/** the alley part of every route: inside the doorway, out, east along the north wall to the open end */
export function alleyPoints() {
  const P = ALLEY.P, v = ALLEY.walkV;
  return [P(ALLEY.doorIn[0], ALLEY.doorIn[1]), P(1.8, -0.2), P(3.2, v), P(ALLEY.lamp2[0], v), P(21, v), P(24, -1.1)];
}

/**
 * Build the path + stop list for a leaving event. ctx: {G, dests, alleyNode, vanNode}. kind/couple/chips/kiss from the event.
 * -> {pts, cum, stops, sDoor, dest, tl}
 */
export function buildRoute(ctx, ev) {
  const { G, dests } = ctx;
  const d = dests.length ? dests[ev.dest % dests.length] : null;
  const pts = alleyPoints().map((p) => p.slice()), stops = [], graphPt = pts.map(() => false);
  const add = (p, g = false) => { const l = pts[pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.05) { pts.push([p[0], p[1]]); graphPt.push(g); } };
  const addNodes = (path) => { if (path) for (const i of path) add([G.X[i], G.Z[i]], true); };
  let sKiss = -1, sChips = -1;
  const sNow = () => cumLen(pts)[pts.length - 1];
  if (ev.kiss) { const c = cumLen(pts); sKiss = c[3]; }
  if (d && G) {
    if (ev.chips && ctx.vanNode >= 0) {
      addNodes(graphPath(G, ctx.alleyNode, ctx.vanNode));
      add(VAN.spot(0)); sChips = sNow();
      addNodes(graphPath(G, ctx.vanNode, d.node));
    } else addNodes(graphPath(G, ctx.alleyNode, d.node));
    if (d.via) for (const p of d.via) add(p); else add(d.approach);
    const dOut = [d.door[0] + d.out[0] * 0.55, d.door[1] + d.out[1] * 0.55], dIn = [d.door[0] - d.out[0] * 1.0, d.door[1] - d.out[1] * 1.0];
    add(dOut); const sOut = sNow(); add(dIn);
    if (sKiss >= 0) stops.push({ s: sKiss, dur: 2.6, tag: 'kiss' });
    if (sChips >= 0) stops.push({ s: sChips, dur: 9, tag: 'chips' });
    stops.push({ s: sOut, dur: ev.couple ? 4 : 1.5, tag: 'fumble' });
    const cum = cumLen(pts);
    // legs that are not pedestrian-graph edges (the alley, the van and the doorstep): smoke_pt checks these against walls
    const ownLegs = []; for (let i = 0; i < pts.length - 1; i++) if (!(graphPt[i] && graphPt[i + 1])) ownLegs.push(i);
    return { pts, cum, stops, sDoor: sOut + 0.55, dest: d, ownLegs, tl: makeTimeline(cum[cum.length - 1], stops, ev.speed || 1.1) };
  }
  // no graph: walk out of the alley and away up Cornmarket
  add([118, 200]); add([100, 150]);
  if (sKiss >= 0) stops.push({ s: sKiss, dur: 2.6, tag: 'kiss' });
  const cum = cumLen(pts);
  return { pts, cum, stops, sDoor: Infinity, dest: null, tl: makeTimeline(cum[cum.length - 1], stops, ev.speed || 1.1) };
}

/** night-street vignettes (singers, a traffic cone, a friend being carried): endpoints around George St / Cornmarket */
export const STREET_ENDS = [[92, 152], [148, 318], [-58, 168], [112, 218], [40, 160], [-20, 172]];
export function vignettesForNight(n, startMs, lenMs) {
  const out = [];
  for (let k = 0, t = startMs; t < startMs + lenMs; k++, t += 30000) {
    const r = hash('ptv', n, k); if (r > 0.45) continue;
    const kinds = ['singers', 'singers', 'cone', 'carry'], kind = kinds[Math.floor(hash('ptvk', n, k) * kinds.length)];
    const a = Math.floor(hash('ptva', n, k) * STREET_ENDS.length); let b = Math.floor(hash('ptvb', n, k) * STREET_ENDS.length); if (b === a) b = (b + 1) % STREET_ENDS.length;
    const size = kind === 'singers' ? 3 : kind === 'carry' ? 3 : 1;
    const seeds = []; for (let i = 0; i < size; i++) seeds.push(Math.floor(hash('ptvs', n, k, i) * 1e9));
    out.push({ id: `v${n}:${k}`, t: t + Math.floor(hash('ptvt', n, k) * 20000), kind, a, b, seeds, speed: kind === 'carry' ? 0.8 : 1.05 });
  }
  return out;
}
