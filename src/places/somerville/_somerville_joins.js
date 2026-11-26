// Somerville College in the city: the CITY SIDE of the joins round the college (2026-11-24, the merge). Called from
// somerville.js preMap, before the city is built: it corrects the map's records of the NEIGHBOURS where the college's
// surveyed plans or the LIDAR show the map wrong, so that the city's own generator draws them where they stand. Each
// change: what moved, by how much, on what evidence (survey section 12.2). LOCAL coordinates (_somerville_shared.js).
import { L2W, W2L } from './_somerville_shared.js';

// [map building id, why, [[old LOCAL vertex, [new LOCAL vertices...]], ...]] - each old vertex is matched within 0.15 m;
// a vertex that is not found is reported and nothing of that building is changed (the map has moved on: look again).
export const NEIGHBOUR_EDITS = [
  // THE ORATORY's BLOCK between the Hall's kitchens and Radcliffe House (not the college's: the 2016 site plan hatches it
  // "Non-College Areas"). The map's outline runs 1.5 - 5 m too far south (to v 41 - 45) over the covered way down
  // Maitland's back and the Lisa Minoprio Garden's north beds; the LIDAR's roofs (+8 .. +14) stop at v 39.3 - 39.8, open
  // ground and trees beyond, and its west face is the diagonal (55.4, 28.6) - (51.0, 38.4) (the hodgkin part's U1 / U2
  // reading, which its covered way meets). The north edge (the site ring, against the Oratory) is kept.
  ['w303766520', 'LIDAR roofs (hodgkin plan U1 / U2); the map\'s south lobes are open ground and trees', [
    [[50.55, 44.971], []], [[50.741, 40.137], []],
    [[55.859, 28.36], [[55.40, 28.60], [55.859, 28.36]]],
    [[72.089, 41.449], [[72.20, 39.80]]],
    [[70.012, 40.623], [[58.80, 39.80], [58.80, 39.30], [51.00, 39.30], [51.00, 38.40]]],
    [[69.821, 41.683], []], [[65.539, 42.309], []], [[57.928, 41.09], []], [[57.546, 43.21], []], [[53.147, 42.702], []], [[53.211, 44.864], []],
  ]],
  // the building on the corner of Walton Street and Little Clarendon Street: its north wall is Bedford House's south
  // wall and, west of it, the south side of Bedford House's forecourt, which the NMLA plan puts on one line, t 16.03 (v
  // 66.54 at Bedford's east wall .. 66.0 at the street), where the map has v 65.9 .. 64.9 (0.6 - 1.1 m too far north,
  // under Bedford House and the forecourt); the LIDAR's roof edge lies at v 66 from u -90 to -77. The north wall moves
  // onto that line; its west corner slides down the street face to it.
  ['w131312900', 'NMLA plan (Bedford House and forecourt t 16.03, hughes plan); LIDAR roof edge v 66', [
    [[-77.273, 65.918], [[-77.273, 66.51], [-85.21, 66.24]]],
    [[-87.597, 65.835], []],
    [[-91.593, 64.87], [[-91.84, 66.0]]],
  ]],
];

/** apply NEIGHBOUR_EDITS to the map's building records (world coordinates); returns a list of what was done */
export function mendNeighbours(map) {
  const done = [];
  if (!map || !map.buildings) return done;
  for (const [id, why, edits] of NEIGHBOUR_EDITS) {
    const b = map.buildings.find((x) => x.id === id); if (!b || b._somervilleMended) continue;
    const loc = b.poly.map((p) => W2L(p[0], p[1]));
    const idx = edits.map(([old]) => loc.findIndex((q) => Math.hypot(q[0] - old[0], q[1] - old[1]) < 0.15));
    if (idx.some((i) => i < 0)) { console.warn('[somerville] map building ' + id + ' has moved: not mended (' + why + ')'); continue; }
    const out = [];
    loc.forEach((q, i) => { const k = idx.indexOf(i); if (k < 0) out.push(q); else out.push(...edits[k][1]); });
    b.poly = out.map(([u, v]) => { const w = L2W(u, v); return [+w[0].toFixed(2), +w[1].toFixed(2)]; });
    const c = b.poly.reduce((s, p) => [s[0] + p[0] / b.poly.length, s[1] + p[1] / b.poly.length], [0, 0]);
    if (b.c) b.c = [+c[0].toFixed(1), +c[1].toFixed(1)];
    b._somervilleMended = why; done.push(id);
  }
  return done;
}

// THE WAYS THAT CROSS THE RING into the college and are not the college's own (MAP_IDS.paths takes those): cut at the
// boundary, so that the city draws no footway / service road over the college's own paving in the gateways, and the
// townspeople's walk graph (systems/pedestrians.js, built from map.roads) ends at the gate instead of running on into the
// courts. The street part (the crossover over the pavement, the alley from Little Clarendon Street) stays.
//   w97853779 footway, Woodstock Road -> the Porters' Lodge (5.9 m into the ring); w97853785 service (setts), Woodstock
//   Road -> the vehicle gateway (3.4 m in); w62288452 service, the alley from Little Clarendon Street beside the corner
//   building, on into the Catherine Hughes yard and east along v 73 (23 m in).
export const CLIP_WAYS = ['w97853779', 'w97853785', 'w62288452'];
const inR = (x, z, ring) => { const l = W2L(x, z); return inRingL(l[0], l[1], ring); };
function inRingL(a, b, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const p = ring[i], q = ring[j]; if ((p[1] > b) !== (q[1] > b) && a < ((q[0] - p[0]) * (b - p[1])) / (q[1] - p[1]) + p[0]) c = !c; } return c; }
/** cut each listed way at the ring: the run from its outside end up to where it first enters (to 1 cm) */
export function clipWays(map, ring) {
  const done = [];
  for (const id of CLIP_WAYS) {
    const r = map && map.roads && map.roads.find((x) => x.id === id); if (!r || r._somervilleClipped) continue;
    let P = r.pts.slice(); if (inR(P[0][0], P[0][1], ring)) P.reverse();
    if (inR(P[0][0], P[0][1], ring)) continue;
    const out = [P[0]];
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      if (!inR(b[0], b[1], ring)) { out.push(b); continue; }
      let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (inR(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, ring)) hi = m; else lo = m; }
      out.push([+(a[0] + (b[0] - a[0]) * lo).toFixed(2), +(a[1] + (b[1] - a[1]) * lo).toFixed(2)]);
      break;
    }
    if (out.length >= 2) { r.pts = out; r._somervilleClipped = true; done.push(id); }
  }
  return done;
}

// A STAND-IN FENCE ON THE WALTON STREET BOUNDARY while the city is set up. The systems that place things from the map
// (the walk graph's pavement lines, parked cars along the kerb) are built when the game installs its systems, BEFORE the
// places install their colliders; the map's Walton Street (w52041693, 8 m) is the whole width between the college's wall
// and the houses opposite, so the east pavement's walk line (5.1 m off the centre) fell 0.6 - 1.6 m inside the college's
// wall (walk edges through Wolfson's and Penrose's street wall). The fence is the ring's Walton Street edges with the real
// gates open (the Walton Street gate by Park, Wolfson's railing gate, the Penrose service gate; LOCAL v ranges, from the
// park / wolfson / hughes plans); install() turns it off once the college's own walls are in (unfence).
const FENCE_LINE = [[-94.12, -24.68], [-88.62, 16.14], [-88.02, 32.55], [-89.84, 51.11], [-91.59, 64.87]];   // SITE_RING
const FENCE_OPEN = [[-10.25, -6.18], [28.8, 31.9], [46.0, 50.04]];
const FENCE_END_V = 64.0;      // (Bedford House's forecourt gate is at the corner: the fence stops short of it)
export function fence(collider) {
  const segs = [];
  if (!collider || !collider.addSegment) return segs;
  for (let i = 0; i < FENCE_LINE.length - 1; i++) {
    const a = FENCE_LINE[i], b = FENCE_LINE[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 0.5);
    for (let k = 0; k < n; k++) {
      const p = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n], q = [a[0] + ((b[0] - a[0]) * (k + 1)) / n, a[1] + ((b[1] - a[1]) * (k + 1)) / n];
      const vm = (p[1] + q[1]) / 2; if (vm > FENCE_END_V || FENCE_OPEN.some(([v0, v1]) => vm > v0 - 0.25 && vm < v1 + 0.25)) continue;
      const w0 = L2W(p[0], p[1]), w1 = L2W(q[0], q[1]);
      segs.push(collider.addSegment(w0[0], w0[1], w1[0], w1[1], { tag: 'somerville:fence' }));
    }
  }
  return segs;
}
export function unfence(segs) { for (const s of segs || []) if (s) s.on = false; }
