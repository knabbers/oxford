// Worcester College, the lake (places/worcester_lake.js; work package H of docs/research/worcester_survey.md, G07):
// outlines, frames, levels and the record of what is known. Pure: no THREE, no world (tools/smoke_worc_lake.mjs).
//
// LEVELS. The lake is the world's water (y = Y.water); everything here is built from the local ground upwards and
// every height is in LV, so the whole can be re-based in one place when the drawn terrain arrives (the terrain holds
// the mapped lake at 56.80 m and lifts what stands at each spot by itself). What is only right for today's flat world
// is in TEMPORARY.
const qs = (typeof location !== 'undefined' && location && location.search) || '', env = (typeof process !== 'undefined' && process.env) || {};
/** `?wlake=0` (node: GTO_WLAKE=0): the lake as it was before this pass, for before / after pictures */
export const ON = !(/[?&]wlake=0(&|$)/.test(qs) || env.GTO_WLAKE === '0');

export const IDS = { lake: 'r1103089', bridgeA: 'w849457924', walkC: 'w1480325737', bridgeD: 'w1480325741', path: 'w251686319', orchardWall: 'w999275854' };

/** heights above the local ground, metres (the world's water lies at 0.035) */
export const LV = {
  water: 0.035,
  upper: 0.455,        // the upper pool above the south arm's weir: 0.42 m over the lake (K: a drop of about 0.45 m in the 2012 picture; the survey had 0.3)
  kerb: 0.14,          // top of the stone kerb (TEMPORARY: real 0.3 - 0.4 m over the water)
  deck0: 0.4, rise: 0.5,       // Mildred Allen Bridge: deck at its ends (TEMPORARY: the banks' height, reached by two ramps), and how much higher its crown is
  coping: 0.24,        // Sainsbury weir: the beds' stone copings (TEMPORARY: real about 0.9 m over the lake)
  sill: 0.11,          // ... its two cross-weirs (TEMPORARY: real steps of 0.15 - 0.2 m between three water levels)
  walk: 0.07,          // the slab walk at the head of the lake
  planks: 0.14,        // the plank bridge to the island
};
/** what is a stand-in for the flat world, to be refitted when the terrain is drawn (the coordinator's list) */
export const TEMPORARY = [
  'the stone kerb stands 0.14 m over the water (real 0.3 - 0.4 m): the flat world has no bank; LV.kerb',
  'the Sainsbury weir\'s two pools lie at the lake\'s level, their cross-weirs are sills 7 cm proud and the copings 0.2 m over the water (real: three water levels 0.15 - 0.2 m apart, the slab walk about 1 m above the lake); LV.coping, LV.sill',
  'the upper pool above the south weir is real (0.42 m over the lake) but is held by a planted berm 0.5 m high round it, which is the natural bank once the terrain falls to the lake',
  'the Mildred Allen Bridge springs 0.4 m above the water from two rubble abutments, reached by gravel ramps 2.6 m long: they stand in for the banks; LV.deck0, RAMP',
  'under the Shah Centre\'s weir sill a stone face goes 0.85 m down below today\'s water: it shows only when the terrain drops the lake 0.67 m below the pools',
];

// ------------------------------------------------------------------------------------------------ small maths
export const near = (p, q, d = 0.35) => Math.hypot(p[0] - q[0], p[1] - q[1]) < d;
export const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const r2 = (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
export function pip(x, z, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }
export function dSeg(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)) : 0; return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }
export function dRing(x, z, ring, closed = true) { let d = 1e9; for (let i = closed ? 0 : 1; i < ring.length; i++) d = Math.min(d, dSeg(x, z, ring[(i + ring.length - 1) % ring.length], ring[i])); return d; }
/** a frame on the ground: origin o, a along (ux, uz), b to its RIGHT seen from above with north up... b = (-uz, ux) */
export function mkFrame(o, dir) {
  const l = Math.hypot(dir[0], dir[1]), ux = dir[0] / l, uz = dir[1] / l;
  return { o, ux, uz, pt: (a, b) => [o[0] + a * ux - b * uz, o[1] + a * uz + b * ux], inv: (x, z) => [(x - o[0]) * ux + (z - o[1]) * uz, -(x - o[0]) * uz + (z - o[1]) * ux] };
}

// ------------------------------------------------------------------------------------------------ Mildred Allen Bridge
// (2005; K: seven photographs in `35 lake bridges and island/`; its place: the map's bridge, borne out by the satellite
// picture S13.) s runs from the south (Nuffield Lawn) end to the north (Provost's Garden) end, t to the east.
export const BRIDGE = (() => {
  const S = [-335.9, 34.75], N = [-336.1, 27.25], L = Math.hypot(N[0] - S[0], N[1] - S[1]);
  const F = mkFrame(S, [N[0] - S[0], N[1] - S[1]]);      // a = s (north), b = east... b = (-uz, ux): for u = north (0,-1) -> (1, 0) = east
  const hw = 1.3, bays = 9;
  const y = (s) => LV.deck0 + LV.rise * (1 - (2 * Math.min(L, Math.max(0, s)) / L - 1) ** 2);
  /** how far the parapet stands out at s: straight, the last bay at each end splayed (K: Geograph 3602871) */
  const out = (s) => { const e = Math.min(s, L - s), b = L / bays; return hw + (e < b ? 0.3 * (1 - e / b) : 0); };
  return { S, N, L, F, hw, bays, y, out, post: 1.1, fascia: 0.52 };
})();
/** length of the gravel ramp up to each end of the bridge */
export const RAMP = 2.6;

// ------------------------------------------------------------------------------------------------ the south arm: weir, upper pool
// K: the weir is a straight masonry wall across the arm with the water spilling over its whole length, about 6.5 m
// east of the bridge's middle (two Geograph views from the bridge, a 2016 view from the weir, the 2012 picture of the
// gardeners standing in the lower pool); beyond it a still pool with reed and sedge on both banks, lilies, and at its
// end a low stone wall carrying a black estate railing. G: how far that pool runs (the map's water ends at x -327.5,
// tree canopy hides it from above in every picture): to x -321.6, just short of the gravel walk by the yew columns.
export const WEIR = { x: -329.8, t: 0.5, zN: 28.45, zS: 34.31 };
export const UPPER = [[-329.55, 28.45], [-327.6, 28.6], [-324.6, 29.0], [-322.3, 29.8], [-321.6, 30.3], [-321.5, 33.9], [-323.0, 34.5], [-325.5, 34.55], [-327.5, 34.4], [-329.55, 34.3]];
export const UPPER_END = [[-321.6, 30.3], [-321.5, 33.9]];      // the end wall (north end, south end)

// ------------------------------------------------------------------------------------------------ the old gateway
// (NHLE 1046606, 16th century, re-sited early 19th. K: `38…/old stone gateway by the lake (worc.ox.ac.uk tour).jpg`
// (east face, the open metal leaf), `38…/16c gateway by the lake (Commons, Remi Mathis 2011).jpg` (west face).)
// Sizes scaled off the 2011 picture against its 3.3 m height: 5.6 m long (the survey had 4.5), opening 1.3 x 2.05 m.
// WHERE: the list entry's point is world (-421.8, 49.8) and the mapped path turns at (-420.8, 48.6), 1.3 m from it:
// the opening is centred between the two, (-421.3, 49.2), square to the path; the wall's north end then stands just
// over a metre from the water's corner, as both pictures have it (the lake's corner is left nearly as mapped for
// that, not rounded like the others). The friends' lakeside stroll (places/friends.js) is led through the opening.
export const GATEWAY = (() => {
  const C = [-421.3, 49.2], len = 5.6, th = 0.62, dir = [0.076, -0.997];      // the wall runs south -> north; b (out of its face) = east
  const o = [C[0] - dir[0] * len / 2, C[1] - dir[1] * len / 2];
  const F = mkFrame(o, dir);
  return { C, len, th, F, open: 1.3, spring: 1.72, apex: 2.05, h: 3.2, cx: len / 2, leaf: 1.2, leafAng: 0.14 };
})();
/**
 * The mapped lakeside path (one long way round the lake and the field) between the gateway and the west tip: through
 * the gateway's opening, then 1.9 m behind the kerb (K: the gravel lies directly behind the kerb in the 2011 pictures;
 * the map draws it 3 - 4 m back). `walk` = the points behind the kerb (layout().walk). Its other vertices stay.
 */
export function reroutePath(pts, walk) {
  const i = pts.findIndex((p) => near(p, [-420.8, 48.6], 1)); if (i < 1) return pts;
  const j = pts.findIndex((p, k) => k > i && near(p, [-474.8, 6.4], 1)); if (j !== i + 1) return pts;
  const G = GATEWAY, e = [0.997, 0.076];
  return [...pts.slice(0, i), [G.C[0] + e[0] * 2.6, G.C[1] + e[1] * 2.6], G.C, [G.C[0] - e[0] * 2.4, G.C[1] - e[1] * 2.4], ...walk, ...pts.slice(j + 1)];
}

// ------------------------------------------------------------------------------------------------ the head of the lake: slab walk, Sainsbury weir
// K: five photographs of 2012 and 2017 (`35…/footbridge at the head of the lake…`, `…/sainsbury weir - …` x5): what
// the map calls a footbridge is a walk of sandstone slabs ALONG THE HEAD of a formal channel, steel posts and two
// wires on its west side only; west of it two rectangular pools between raised beds with rubble walls and pale stone
// copings, two cross-weirs, steel sheet piling under the first pool's walls; the Sainsbury Building's wall on the
// north, an old rubble wall with a doorway at its west end on the south. The frame: s west along the Sainsbury wall's
// line from the walk, v south across the bay.
export const SW = (() => {
  const O = [-354.6, -93.7], F = mkFrame(O, [-0.985, 0.173]);      // a = s (west), b = (-uz, ux) = (-0.173, -0.985) = NORTH: so v = -b
  const W = (s, v) => F.pt(s, -v);
  const inv = (x, z) => { const q = F.inv(x, z); return [q[0], -q[1]]; };
  return {
    O, W, inv, head: 0.1, vN: 2.3, vS: 5.5, wall: 7.45,      // channel between v = vN and vS; the old wall's face at v = wall
    weirs: [5.0, 9.8], sillT: 0.45, bedN: 13.0, bedS: 14.5, wallEnd: 16.6, door: [15.2, 16.1], wallH: 2.6,
    walk: { n: [-353.9, -93.6], s: [-352.2, -87.1], w: 1.5 },
  };
})();
const arc = (c, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n; return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]; });
/** the two raised beds, in (s, v): rings */
/** the way through the old Orchard wall at the walk's south end: the mapped wall's vertex there, and half the opening */
export const WALL_GAP = { at: [-352.2, -87.1], half: 0.85 };
/** the mapped wall (an open polyline) with that opening cut in it: -> [piece, piece(, piece)] (any may be shorter than 2 points) */
export function cutWall(pts) {
  const i = pts.findIndex((p) => near(p, WALL_GAP.at, 0.4)); if (i < 0) return null;
  const back = (a, b, d) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + ((b[0] - a[0]) / l) * Math.min(d, l - 0.05), a[1] + ((b[1] - a[1]) / l) * Math.min(d, l - 0.05)]; };
  const A = i > 0 ? [...pts.slice(0, i), back(pts[i], pts[i - 1], WALL_GAP.half)] : [], B = i < pts.length - 1 ? [back(pts[i], pts[i + 1], WALL_GAP.half), ...pts.slice(i + 1)] : [];
  // the second way through: the 2007 gateway under the Nash Building's east link (the mapped wall has a 3 m piece
  // there, between two of its own vertices, and the mapped path through the link crosses its middle)
  const j = B.findIndex((p, k) => k < B.length - 1 && near(p, WALL_GATE.a, 0.4) && near(B[k + 1], WALL_GATE.b, 0.4));
  if (j < 0) return [A, B];
  const m = [(B[j][0] + B[j + 1][0]) / 2, (B[j][1] + B[j + 1][1]) / 2];
  return [A, [...B.slice(0, j + 1), back(m, B[j], WALL_GATE.half)], [back(m, B[j + 1], WALL_GATE.half), ...B.slice(j + 1)]];
}
/** the gateway in the old Orchard wall under the Nash Building's east link: the mapped wall's two vertices, half the opening */
export const WALL_GATE = { a: [-322.2, -97.2], b: [-319.3, -98.2], half: 0.9 };
export const BEDS = (() => {
  const S = SW, rn = 1.6, rs = 1.4;
  const north = [[S.head, 0], [S.bedN, 0], ...arc([S.bedN - rn, S.vN - rn], rn, 0, Math.PI / 2, 5), [S.head, S.vN]];
  const south = [[S.head, S.vS], ...arc([S.bedS - rs, S.vS + rs], rs, -Math.PI / 2, 0, 5), [S.bedS, S.wall], [S.head, S.wall]];
  return { north, south };
})();

// ------------------------------------------------------------------------------------------------ the lake's outline
/**
 * The mapped outline (map area r1103089) made into the lake as built: its generalised corners rounded (the survey: the
 * map's corners are generalised, +-3 m), the south arm ended at the weir, the bay at the head of the lake narrowed to
 * the channel between the two beds. The vertices of the Shah Centre's channel and its ponds, and the Sainsbury
 * Building's edge (the line agreed with the north-side builder), are left exactly as they are.
 * -> { ring, kerbs: runs of the ring that have the stone kerb, walk: the path's points behind the long kerb, benches }
 */
export function lakeRing(raw) {
  const idx = (q, d = 0.6) => raw.findIndex((p) => near(p, q, d));
  const iArmS = idx([-327.5, 34.4]), iArmN = idx([-327.6, 28.6]), iHeadA = idx([-354.6, -93.7]), iHeadB = idx([-355.8, -85.9]), iBay = idx([-357, -93.7]);
  if ([iArmS, iArmN, iHeadA, iHeadB, iBay].some((i) => i < 0)) return null;
  const n = raw.length, at = (i) => raw[((i % n) + n) % n];
  // which vertices may be rounded: the main body, between the arm's mouth and the north arm, and the Provost's side
  const ROUND = [[-397.1, 36.3], [-422.3, 44.6], [-433.9, 36.5], [-443.2, 28.6], [-452.6, 20.9], [-465.1, 11.2], [-473.1, 1.9], [-478.8, -6], [-479.8, -10.3], [-477.7, -15.4], [-473.4, -18.8], [-403.7, -72.1], [-400.7, -78.8],
    [-371.8, -76.2], [-372.6, -68.3], [-416.6, -27.8], [-423.7, -17.3], [-417.1, -1.2], [-383.7, 24.4]];
  const fillet = (i) => {
    const P = at(i - 1), V = at(i), Q = at(i + 1), lp = Math.hypot(P[0] - V[0], P[1] - V[1]), lq = Math.hypot(Q[0] - V[0], Q[1] - V[1]);
    const up = [(P[0] - V[0]) / lp, (P[1] - V[1]) / lp], uq = [(Q[0] - V[0]) / lq, (Q[1] - V[1]) / lq];
    const turn = Math.PI - Math.acos(Math.max(-1, Math.min(1, up[0] * uq[0] + up[1] * uq[1])));
    if (turn < 0.2) return [V];
    const d = Math.min(near(V, [-422.3, 44.6], 0.6) ? 2 : 7, 0.42 * lp, 0.42 * lq), A = [V[0] + up[0] * d, V[1] + up[1] * d], B = [V[0] + uq[0] * d, V[1] + uq[1] * d];
    const k = turn > 0.9 ? 4 : 3, out = [];
    for (let j = 0; j <= k; j++) { const t = j / k, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; out.push([a * A[0] + b * V[0] + c * B[0], a * A[1] + b * V[1] + c * B[1]]); }
    return out;
  };
  const S = SW, bedPt = (q) => S.W(q[0], q[1]);
  const ring = [];
  // start at the weir's south end and go round as the map does (west along the arm's south bank)
  ring.push([WEIR.x, WEIR.zS]);
  ring.push(at(iArmS + 1), [-348.0, 33.54]);      // (the second: where the kerb by the bridge stops)
  for (let i = iArmS + 2; i !== iArmN; i = (i + 1) % n) {
    const V = at(i);
    if (i === iBay) {
      // the bay: along the Sainsbury wall to the north bed's end, round the bed, up the channel to the head, back down
      // its south side, round the south bed and along the old wall to its end
      const N = BEDS.north, So = BEDS.south;
      ring.push(bedPt(N[1]));
      for (let k = 2; k < N.length; k++) ring.push(bedPt(N[k]));
      for (let k = 0; k < So.length - 1; k++) ring.push(bedPt(So[k]));
      ring.push(S.W(S.wallEnd, S.wall));
      i = iHeadB;      // (the loop's own step goes on to the vertex after the bay's old south corner)
      continue;
    }
    if (ROUND.some((q) => near(V, q, 0.6))) ring.push(...fillet(i)); else ring.push(V);
  }
  ring.push([WEIR.x, WEIR.zN]);
  const out = ring.map(r2);
  // ---- the kerb: from the gateway round the south-west side to the west tip (K at three places along it), and the
  // arm's south bank by the bridge (K: the bridge's south-west abutment)
  const nearest = (q) => { let b = 0, bd = 1e9; out.forEach((p, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; b = i; } }); return b; };
  const run = (a, b) => { const i0 = nearest(a), i1 = nearest(b), r = []; for (let i = i0; ; i = (i + 1) % out.length) { r.push(out[i]); if (i === i1) break; if (r.length > out.length) return []; } return r; };
  const kerbs = [run([WEIR.x, WEIR.zS], [-348.0, 33.54]), run([-422.3, 44.9], [-477.7, -15.4])];
  // ---- the path behind the long kerb, and the stone benches beyond it
  const K = kerbs[1], land = (i, d) => {
    const a = K[Math.max(0, i - 1)], b = K[Math.min(K.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; let nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
    if (pip(K[i][0] + nx * 0.5, K[i][1] + nz * 0.5, out)) { nx = -nx; nz = -nz; }
    return [K[i][0] + nx * d, K[i][1] + nz * d, nx, nz];
  };
  const walk = [];
  for (let i = 0; i < K.length; i++) if (K[i][0] < -428.5 && K[i][0] > -472.5) walk.push(r2(land(i, 1.9)));
  /** stone benches on the west side: [x, z, heading the sitter faces]. The first is K (two photographs: beside the
   *  path near the pavilion, its back to the laurels); the Register of Parks and Gardens counts three: where the other
   *  two stand is a GUESS (beyond the path, facing the water) */
  const benches = [[-485.2, -9.4, Math.PI / 2]];
  for (const at of [[-443.2, 28.6], [-461.0, 14.4]]) { let bi = 0, bd = 1e9; K.forEach((p, i) => { const d = Math.hypot(p[0] - at[0], p[1] - at[1]); if (d < bd) { bd = d; bi = i; } }); const q = land(bi, 4.15); benches.push([+q[0].toFixed(2), +q[1].toFixed(2), Math.atan2(-q[2], -q[3])]); }
  return { ring: out, kerbs, walk, benches };
}

// ------------------------------------------------------------------------------------------------ small things
/** the plank bridge to the island (G: the map draws a bridge with steps down to it; no picture shows it) */
export const ISLAND_BRIDGE = { a: [-387.9, -88.7], b: [-387.4, -82.9], w: 1.0 };

/** drawn floor heights this module adds: the bridge's deck, the slab walk, the planks. null = not ours */
export function groundY(x, z) {
  if (x > -339 && x < -333 && z > 23.5 && z < 38.5) {
    const q = BRIDGE.F.inv(x, z), L = BRIDGE.L; if (Math.abs(q[1]) > BRIDGE.hw || q[0] < -RAMP || q[0] > L + RAMP) return null;
    if (q[0] >= 0 && q[0] <= L) return BRIDGE.y(q[0]);
    const e = q[0] < 0 ? q[0] + RAMP : L + RAMP - q[0]; return 0.046 + (LV.deck0 - 0.046) * (e / RAMP);
  }
  if (x > -332.5 && x < -319 && z > 26 && z < 37) {      // the berm round the upper pool
    if (pip(x, z, UPPER)) return LV.upper; const d = dRing(x, z, UPPER); return d < 1.9 ? 0.03 + (LV.upper + 0.04) * (1 - d / 1.9) : null;
  }
  if (x > -356 && x < -350.5 && z > -95.5 && z < -86) { const w = SW.walk; if (dSeg(x, z, w.n, w.s) < w.w / 2) return LV.walk; return null; }
  if (x > -389.5 && x < -386 && z > -89.5 && z < -82) { const b = ISLAND_BRIDGE; if (dSeg(x, z, b.a, b.b) < b.w / 2) return LV.planks; }
  return null;
}
/** what the grounds module keeps its own trees, benches and reeds off (places/worcester_grounds.js) */
export function keepOff(x, z) {
  if (x > -332.5 && x < -319 && z > 26 && z < 37) return true;                                   // the weir, the upper pool and its banks
  { const q = GATEWAY.F.inv(x, z); if (q[0] > -2 && q[0] < GATEWAY.len + 2 && Math.abs(q[1]) < 3.5) return true; }
  { const q = SW.inv(x, z); if (q[0] > -3 && q[0] < 18 && q[1] > -0.5 && q[1] < 9) return true; }
  return false;
}

/** K = seen in a named picture / plan / measurement, G = a flagged guess: [what, K | G, what it rests on] */
export const CHECKED = [
  ['lake outline', 'K', 'the map\'s outline (checked against the height survey where the canopy lets the water be seen); corners rounded by up to 2 m: G'],
  ['water level', 'K', 'height survey 56.78 m over the whole lake'],
  ['Mildred Allen Bridge: place', 'K', 'the map; satellite S13 (the path crossing the arm)'],
  ['Mildred Allen Bridge: form', 'K', '35/mildred allen bridge - side elevation… (2015), …deck and parapets… (2015), …from its south end… (Geograph 3602871), …from the north-east bank (2012): a humped timber span, boards laid across, boarded fascia, ten posts a side each with an outrigger and a raking strut, a broad top rail, a rail below it, a band of X-lattice between two more, weathered grey, ends splayed'],
  ['Mildred Allen Bridge: sizes', 'G', '7.5 x 2.6 m, 0.5 m rise, parapet 1.1 m: scaled off the pictures'],
  ['no gate on the bridge', 'K', 'the 2015 picture along the deck shows none (the map has a gate node at its north end)'],
  ['weir east of the bridge', 'K', '35/weir east of the mildred allen bridge… (Geograph 3602859), …weir and upper pool… (Geograph 4148729), …weir pool east of the bridge - men in waders… (2012): a straight wall, water over its whole length'],
  ['weir: place and drop', 'G', 'about 6.5 m east of the bridge and 0.42 m: from the pictures\' geometry'],
  ['upper pool: banks, end wall with estate railing', 'K', '35/upper pool above the weir… (2016)'],
  ['upper pool: reed, sedge and iris along both banks, tawny grasses and a clipped evergreen dome on the north, evergreens under the Hanging Garden on the south', 'K', '35/upper pool above the weir… (2016), 35/weir east of the mildred allen bridge… (Geograph 3602859); each plant\'s place: G'],
  ['upper pool: extent', 'G', 'to x -321.6: hidden by canopy in every overhead picture; the map ends the water at x -327.5'],
  ['stone kerb: west tip, west side, west of the gateway, by the bridge', 'K', '35/lake west tip - stone-kerbed edge… (2011), …lake west side - stone kerb and fallen willow (2011), 38/16c gateway… (2011), 35/mildred allen bridge - from its south end…'],
  ['stone kerb: continuous between those places', 'G', 'inferred: the pictures show four stretches of it, each with the gravel walk directly behind'],
  ['old gateway: form', 'K', '38/old stone gateway by the lake (worc.ox.ac.uk tour).jpg, 38/16c gateway by the lake (Commons, Remi Mathis 2011).jpg; list entry 1046606'],
  ['old gateway: metal gate leaf standing open', 'K', 'the tour picture: a dark iron leaf at the north jamb, open to the east'],
  ['old gateway: place', 'K', 'between the list entry\'s point (world (-421.8, 49.8)) and the mapped path\'s corner (-420.8, 48.6), 0.8 m from each; its north end by the water as in both pictures'],
  ['old gateway: direction', 'G', 'square to the path (the wall runs 4 degrees east of north)'],
  ['old gateway: weathered grey stone, ivy over the coping and down both faces; on the east side south of the opening a bed with a rough stone edge, an evergreen mass to the wall\'s top, spurge, ferns; a strip of turf with a stone edge by the water; broad gravel before the opening; a many-stemmed tree lying out over the water from its north end', 'K', '38/old stone gateway by the lake (worc.ox.ac.uk tour).jpg, 38/16c gateway by the lake (Commons, Remi Mathis 2011).jpg; each plant\'s exact place: G'],
  ['slab walk at the head of the lake', 'K', '35/footbridge at the head of the lake - gate piers and slab path… (2012)'],
  ['its two stone slab piers and iron gate', 'K', 'the same picture; their exact spot: G'],
  ['Sainsbury weir: channel, two pools, cross-weirs, sheet piling, copings, raised beds', 'K', '35/sainsbury weir - … (five pictures, 2017)'],
  ['Sainsbury weir: sizes', 'G', 'channel 3.2 m, pools about 4.5 m long: by eye from the pictures inside the mapped bay'],
  ['old rubble wall south of the weir with a doorway at its west end', 'K', '35/sainsbury weir - south border and the old rubble wall with a doorway (2017); its line: G (the map\'s water edge; a pale wall top in the satellite picture of the island)'],
  ['gateway in the old Orchard wall under the Nash Building\'s east link: where it is', 'K', 'the map: the wall\'s 3 m piece between two vertices, the path through the link (w1041191957, w169617907) crossing its middle; ADP\'s south elevation ("a new arched stone gateway")'],
  ['that gateway\'s form (plain dressed jambs under a flat stone head, 1.8 m wide)', 'G', 'no photograph; the drawing says arched'],
  ['way through the old Orchard wall at the slab walk\'s south end', 'G', 'the tour route goes from the walk into the Orchard (tour sheet stop 12; the map\'s footway w1480325736); the 2012 picture shows the wall ahead with a gap; its form is not known: a plain opening with dressed jambs'],
  ['plank bridge to the island', 'G', 'the map draws a bridge and steps (w1480325741, w1480325739); no picture shows one; the satellite picture cannot tell'],
  ['stone bench by the path near the pavilion', 'K', '35/stone bench beside the lakeside path… (2018), …lake west tip… (2011)'],
  ['two more stone benches on the west side', 'G', 'the Register of Parks and Gardens counts three; places guessed'],
  ['face under the Shah Centre weir', 'G', 'hidden until the terrain lowers the lake'],
];
