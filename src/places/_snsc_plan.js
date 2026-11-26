// Sultan Nazrin Shah Centre, Worcester College: the PLAN (pure numbers, no three.js, no DOM): frames, levels, outlines
// and the walkable-height function of places/worcester_snsc.js. Tested by tools/smoke_snsc.mjs.
//
// REGISTRATION. The architects' published 1:200 plan (`reference/worcester/18 sultan nazrin shah centre/snsc - DRAWING
// ground floor plan...`, 17.2 px per metre, looked at and never copied) is tied to the world by the colonnade's front
// line; a grid search against the 2022 LIDAR roof (Environment Agency, OGL v3) puts the best fit at 0 m / 0 degrees, so
// positions here are good to about half a metre. The map's own outline (OSM w131313832) is 1.3 m short at the studio.
//   building frame: a = along the front from its north-west pier to the south-east, b = into the building (north-east)
//   plan pixel (px, py)  ->  a = (px - 342.5) / 17.2,  b = (794 - py) / 17.2
//
// LEVELS (survey section 2 and B21; planning drawings 14/00392/FUL; LIDAR). y = 0 here is the playing field and the
// pools' water, 57.45 m above sea level (the terrain's precinct "worcester_snsc" is that level):
//   court paving +0.45 (57.90)   floor and terrace +1.60 (59.04 as designed)   parapet +6.00 (63.45)
//   clerestory drum +10.80 (68.25: the published elevation and the LIDAR; the planning drawing said 69.04)

const qs = typeof location !== 'undefined' && location && location.search ? location.search : '';
const env = typeof process !== 'undefined' && process.env ? process.env : {};
/** `?wsnsc=0` (node: GTO_WSNSC=0) leaves the two generic boxes of before, for before / after pictures; the old `?snsc=0` (2013: no building at all) also stands this pass down */
export const ON = !(/[?&]wsnsc=0(&|$)/.test(qs) || env.GTO_WSNSC === '0' || /[?&]snsc=0(&|$)/.test(qs) || env.GTO_SNSC === '0');

export const IDS = { main: 'w131313832', drum: 'w721939492', lake: 'r1103089' };
export const O = [-449.19, -163.87], D = [0.7351, 0.6779], N = [0.6779, -0.7351];
/** frame (a, b) -> world [x, z] */
export const W = (a, b) => [O[0] + a * D[0] + b * N[0], O[1] + a * D[1] + b * N[1]];
/** world (x, z) -> frame [a, b] */
export const F = (x, z) => { const dx = x - O[0], dz = z - O[1]; return [dx * D[0] + dz * D[1], dx * N[0] + dz * N[1]]; };
const px = (x, y) => [(x - 342.5) / 17.2, (794 - y) / 17.2];
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

export const Y = { court: 0.45, floor: 1.6, head: 4.95, parapet: 6.0, drum: 10.8, stage: 7.2, water: 0.035 };

// ------------------------------------------------------------------------------------------------ the building
export const LEN = 35.47, DEP = 5.84;                 // the front range: 12 bays, the seminar rooms and the terrace between
export const BAY = (LEN - 0.58) / 12;                 // 2.91 m (the elevation: 2.95)
export const pierA = (i) => 0.29 + i * BAY;           // 13 piers, i = 0..12; 3 and 9 are the terrace's end walls
export const PIER = { d: 1.25, f: 0.17, k: 0.34 };    // depth; half width at the front edge and at the back (a wedge)
export const GLASS_B = 1.05;                          // the seminar rooms' glass behind the piers' front edge
export const TERR = { a0: pierA(3) + 0.23, a1: pierA(9) - 0.23, s0: -0.45, n: 9, tread: 0.30 };      // the open six bays: a flight of nine risers
TERR.top = TERR.s0 + (TERR.n - 1) * TERR.tread;       // b of the top riser (1.95)
// the auditorium's fan: centre, the radius of the clerestory glass and of the fins' outer edges, 15 bays of 6 degrees
// from +a (phi = 0) round to -b (phi = 90 degrees): the arc faces due south
export const FAN = { c: px(450, 399), rg: 13.05, ro: 13.9, n: 15 };
export const fanPt = (phi, r) => [FAN.c[0] + Math.cos(phi) * r, FAN.c[1] - Math.sin(phi) * r];
// the stage's curved back wall: centre, radius, its two ends
export const STAGE = { c: px(539, 486), r: 9.77, p0: px(380, 432), p1: px(492, 325) };
export const stageArc = (n = 8) => {
  const a0 = Math.atan2(STAGE.p0[1] - STAGE.c[1], STAGE.p0[0] - STAGE.c[0]); let a1 = Math.atan2(STAGE.p1[1] - STAGE.c[1], STAGE.p1[0] - STAGE.c[0]);
  if (a1 > a0) a1 -= Math.PI * 2;
  return Array.from({ length: n + 1 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [STAGE.c[0] + Math.cos(t) * STAGE.r, STAGE.c[1] + Math.sin(t) * STAGE.r]; });
};
export const STUDIO = { a0: 34.0, glass: 44.61, tip: 46.66, b0: 8.72, b1: 18.98, cheek: 0.8 };      // the dance studio and its stone hood
export const ENTR = { glass: 25.55, tip: 26.42, plant: 25.67, piers: [35.29, 31.63, 27.44, 23.49, 19.59] };      // the entrance front (faces south-east): pier lines in b
export const NEND = 35.6;      // the north end of the entrance front (the plant room's corner)
// the drum above the main roof: its north-east wall (b = nB) ends at a = ne, its north-west wall (a = nw) at the front
// return (b = front); the roof's valley runs between PV and QV; the walls' tops reach the full height at `full`
export const DRUM = { nB: 24.42, ne: FAN.c[0] + FAN.ro, neB: 22.77, nw: 5.03, front: 9.07, retA: 6.45, valley: 6.1, pv: [9.45, 24.42], qv: [5.03, 18.84], fullA: 19.0, fullB: 9.92, capIn: 0.35 };
export const BAND = 0.45;      // the pale stone edge round the grey roof
/**
 * The grey roof's outline before its stone edge is taken off (counter-clockwise in a, b) and how far each edge is set
 * in: 0 along the drum, BAND elsewhere. The front edge is at b = 0.8 (the colonnade's hood, b 0..1.25, is all stone)
 * and steps round the terrace, which is open to the sky under the pergola.
 */
export function roofOutline(nArc = 15) {
  const E = [], add = (p, d = BAND) => E.push([p, d]);
  add([0, 0.8]); add([TERR.a0, 0.8]); add([TERR.a0, DEP]); add([TERR.a1, DEP]); add([TERR.a1, 0.8]); add([LEN, 0.8]); add([LEN, DEP]); add([STUDIO.a0, DEP]);
  add([STUDIO.a0, STUDIO.b0]); add([STUDIO.glass + BAND, STUDIO.b0]); add([STUDIO.glass + BAND, STUDIO.b1]); add([ENTR.tip, STUDIO.b1]); add([ENTR.tip, NEND]);
  add([17.3, 38.46]); add([16.05, 38.46]); add([16.05, 31.63]); add([17.59, 31.63]); add([17.59, DRUM.nB], 0);
  add([DRUM.ne, DRUM.nB], 0); add([DRUM.ne, DRUM.neB], 0); add([FAN.c[0] + FAN.rg, DRUM.neB], 0);
  for (let i = 0; i <= nArc; i++) add(fanPt((i / nArc) * Math.PI / 2, FAN.rg), 0);
  add([DRUM.nw, FAN.c[1] - FAN.rg], 0);
  add([DRUM.nw, DRUM.qv[1]]); add([0, DRUM.qv[1]]); add([0, 8.66]); add([3.05, 8.66]); add([3.05, DEP]); add([0, DEP]);
  return { pts: E.map((e) => e[0]), d: E.map((e) => e[1]) };
}
/** what is solid on the ground (colliders): the two seminar rooms and everything behind the terrace, in frame coordinates */
export function solids() {
  const st = stageArc(8).reverse();
  return [
    [[0, 0], [TERR.a0, 0], [TERR.a0, DEP], [0, DEP]],
    [[TERR.a1, 0], [LEN, 0], [LEN, DEP], [TERR.a1, DEP]],
    [[3.05, DEP], [STUDIO.a0, DEP], [STUDIO.a0, STUDIO.b0], [STUDIO.tip, STUDIO.b0], [STUDIO.tip, STUDIO.b1], [ENTR.tip, STUDIO.b1], [ENTR.tip, NEND],
      [17.3, 38.46], [16.05, 38.46], [16.05, 31.63], [17.59, 31.63], [17.59, DRUM.nB], DRUM.pv, ...st, DRUM.qv, [0, DRUM.qv[1]], [0, 8.66], [3.05, 8.66]],
  ];
}

// ------------------------------------------------------------------------------------------------ the site (world x, z)
// the way up to the main entrance along the studio's north-east wall: level with the court to a = 50, then 1 in 19 to a
// landing before the doors; its north-east edge gives way to the corner of the Earl Building's low wing
export const RAMP = { a0: 28.5, a1: 50, b0: 18.98, b1: 23.49, walkA: 29.33, walkB: 34.3, bank: 3 };
export const rampY = (a) => Y.court + (Y.floor - Y.court) * clamp01((RAMP.a1 - a) / (RAMP.a1 - RAMP.a0));
export const PATH_AB = [[ENTR.tip, RAMP.b0], [57.06, 18.98], [60.3, 22.6], [53.6, 22.6], [50.0, RAMP.b1], [ENTR.tip, RAMP.b1]];
export const PATH = PATH_AB.map((p) => W(p[0], p[1]));
export const WALK = [[ENTR.tip, RAMP.b1], [RAMP.walkA, RAMP.b1], [RAMP.walkA, RAMP.walkB], [ENTR.tip, RAMP.walkB]].map((p) => W(p[0], p[1]));      // along the e-hub's glass
// the "Sainsbury Courtyard": a square of pale slabs 13.1 m each way on the Sainsbury Building's grid (the plan; the
// survey's 15 m was by eye), its west corner at the head of the path and the corner of pool 1
export const SQUARE = [[57.06, 18.98], [65.78, 28.73], [75.6, 20.07], [66.88, 10.32]].map((p) => W(p[0], p[1]));      // W, N, E, S corners
// pool 1, before the studio's glass: a rectangle with its south corner cut off by the bridge; the water runs under the hood
const P1 = { e: [57.06, STUDIO.b1], cutE: [57.06, 11.47], cutW: [54.60, STUDIO.b0] };
export const POOL1 = [[44.7, STUDIO.b0], P1.cutW, P1.cutE, P1.e, [44.7, STUDIO.b1]].map((p) => W(p[0], p[1]));
// the bridge: a flat timber deck between the pools, level with the paving, no handrail: 3.7 m long (the way across) by
// 3.0 m between the pools. The published plan's pools, fitted edge by edge (17.2 px per metre), leave 3.60 x 2.89 m
// between their fills; the satellite view shows 3.75 x 3.07 m; the map's bridge way is 3.7 m long. (Until 2026-11-22
// it was 4.9 x 3.1 m and 0.6 m into pool 1, to lie under the friends' old line z = -133: places/friends.js BR_E and
// BR_W now stand on its centre line instead.)
const dn = [W(...P1.cutW), W(...P1.cutE)], dl = Math.hypot(dn[1][0] - dn[0][0], dn[1][1] - dn[0][1]), du = [(dn[1][0] - dn[0][0]) / dl, (dn[1][1] - dn[0][1]) / dl];
export const DECK_W = 3.0;
export const DECK = [dn[0], dn[1], [dn[1][0] - du[1] * DECK_W, dn[1][1] + du[0] * DECK_W], [dn[0][0] - du[1] * DECK_W, dn[0][1] + du[0] * DECK_W]];      // NW, NE, SE, SW
// pool 2, south of the court: the deck's south edge, the kerb on the court side (THE KERB, below), the garden
// side, the mouth of the channel to the lake (the lake polygon's own two vertices: a clean join), the planted west bank
export const CHANNEL = [[-399.1, -120.3], [-401.4, -119.7]];      // east bank, west bank: where pool 2 ends and the lake's north arm begins
const sqSW = (z) => { const p = SQUARE[0], q = SQUARE[3], t = (z - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, z]; };      // a point of the square's south-west side
// THE KERB on the court side runs from the deck's corner straight at the square's south corner (the plan: 6.8 degrees
// off the Centre's front; the satellite view: 36.7 degrees south of east; here 36.3). It ends where the pool's
// garden-side wall, which leaves the square's side at P2C, crosses that line: 0.47 m short of the square's corner.
const P2C = sqSW(-126.7);
const meet = (a, b, c, d) => { const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / (rx * sz - rz * sx); return [a[0] + rx * t, a[1] + rz * t]; };
export const POOL2 = [DECK[3], DECK[2], meet(DECK[2], SQUARE[3], P2C, CHANNEL[0]), CHANNEL[0], CHANNEL[1], [-407.3, -124.6]];
// Henry Moore's plinth: its long axis along that kerb (the Commons picture from the bridge: the plinth's sides and the
// kerb run to one vanishing point), its centre 4.0 m along the kerb from the deck's corner (the same picture; the
// satellite view: 3.7 to 3.95 m) and 1.55 m back from the water's edge, so that its pool-side face is 1.05 m from the
// edge (the same picture: the gap is 0.85 to 1.0 times the plinth's depth, 0.85 to 1.1 m; CEH_0585, taken at 85 mm
// and 29 degrees off square: plinth and gap together 2.0 to 2.15 m deep; the satellite view: the centre 1.25 to 1.55 m
// back). Centre; half sizes.
const ku = (() => { const p = POOL2[1], q = POOL2[2], l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; })();
export const PLINTH = { c: [POOL2[1][0] + ku[0] * 4.0 + ku[1] * 1.55, POOL2[1][1] + ku[1] * 4.0 - ku[0] * 1.55], u: ku, hl: 1.45, hw: 0.5, h: 0.8 };
export const FRINK = { c: [-379.0, -125.3], h: 0.95, s: 0.36 };      // (GUESS: where in the drive court the seated figure stands)
// the court's paving round the square: west to the pools and the deck, south to the garden wall, east to the gatehouse
// the rubble garden wall before the Sainsbury Building's north wing (1.2 m off it, parallel), its two gate piers at
// the west end by pool 2, a stub on to the pool's own wall
export const GATE = { w: [-393.5, -122.25], e: [-392.0, -122.4] };
export const WALL = [GATE.e, [-377.75, -123.9]], WALL_STUB = [[-397.15, -122.2], GATE.w];
export const COURT_W = [SQUARE[0], P2C, POOL2[2], POOL2[1], DECK[1]];      // the piece between the square, pool 1, the deck and pool 2
export const COURT_S = [SQUARE[3], SQUARE[2], [-377.9, -127.1], [-377.75, -123.9], [-393.6, -122.3], [-393.9, -125.3], P2C];      // (the friends' way round: map way w154769424) and the way to the garden gate
export const BED_S = [P2C, [-393.9, -125.3], [-393.6, -122.3], [-397.05, -122.25]];      // the birch's bed between the gate and pool 2
export const COURT_E = [SQUARE[2], SQUARE[1], [-377.6, -140.6], [-376.9, -138.25], [-368.3, -138.4], [-363.4, -127.8], [-377.9, -127.1]];      // the drive court, to the gatehouse
// ... in three pieces: north of the tarmac drive in from Gate 3, the drive, south of it (the drive abuts the square)
const onSq = (z) => { const p = SQUARE[1], q = SQUARE[2], t = (z - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, z]; };
const DRV = { nw: onSq(-137.3), ne: [-368.07, -137.9], se: [-366.27, -134.0], sw: onSq(-133.6) };
export const DRIVE = [DRV.nw, DRV.ne, DRV.se, DRV.sw];
export const COURT_EN = [SQUARE[1], [-377.6, -140.6], [-376.9, -138.25], [-368.3, -138.4], DRV.ne, DRV.nw];
export const COURT_ES = [DRV.sw, DRV.se, [-363.4, -127.8], [-377.9, -127.1], SQUARE[2]];
// the yard north of the court, between the Earl Building's low wing and Gloucester House (paved; it leads on north)
export const YARD_N = [W(53.6, 22.6), W(60.3, 22.6), SQUARE[1], [-377.6, -140.6], [-377.85, -147.8], [-390.25, -147.8], [-390.25, -144.7], [-393.95, -144.3]];
/**
 * THE EAST AND NORTH EDGES (temporary, flagged). The real court is level with Gate 3 and with the yard to its north
 * (57.9 -> 58.1); in today's flat world they stand at y 0, so the paving falls 0.45 m over 6 m: east of x = -378.2 and
 * north of z = -141.6, in the shape of the terrain's own seam (a smoothstep). When the terrain is on, `setTerrain(fn)`
 * swaps this for y = court - (terrain(x, z) - terrain inside the precinct), which cancels the seam exactly wherever it
 * runs: the drawn court is then level, as it really is. Nothing else in this file depends on the flat world.
 */
export const FALL = { x0: -378.2, zN: -141.6, len: 6, ref: [-388, -133] };
let terrain = null;
export function setTerrain(fn) { terrain = null; if (typeof fn !== 'function') return false; const d = fn(-366, -134) - fn(FALL.ref[0], FALL.ref[1]); if (!(Math.abs(d) > 0.15)) return false; terrain = fn; return true; }
export function fallY(x, z) {
  if (terrain) return Math.max(0.05, Math.min(Y.court, Y.court - (terrain(x, z) - terrain(FALL.ref[0], FALL.ref[1]))));
  return 0.05 + (Y.court - 0.05) * (1 - smooth(Math.max((x - FALL.x0) / FALL.len, (FALL.zN - z) / FALL.len)));
}
// west of the bridge the gravel path falls to the field (LIDAR: 57.6 at the deck, 57.3 twelve metres on); the planted
// ground either side falls with it. One plane: y = court at x = -403.5, 0 at x = -411.5
export const APRON = { x0: -411.5, x1: -403.5 };
export const apronY = (x) => Y.court * clamp01((x - APRON.x0) / (APRON.x1 - APRON.x0));
const flankX = (x) => { const a = (x - O[0] - STUDIO.b0 * N[0]) / D[0]; return W(a, STUDIO.b0); };      // the point of the studio's south-west wall line at world x
export const APRON_POLY = [DECK[0], W(STUDIO.tip, STUDIO.b0), flankX(APRON.x0), [APRON.x0, -127.6], POOL2[5], DECK[3]];
export const WPATH = { n: [DECK[0], [-407.6, -133.15], [APRON.x0, -133.05], [-416.7, -132.9]], s: [DECK[3], [-407.6, -130.35], [APRON.x0, -130.4], [-416.7, -130.5]] };      // the gravel path's two edges, deck -> field path: straight on from the deck's two corners (the plan)
// ------------------------------------------------------------------------------------------------ walkable heights
function pip(x, z, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const p = poly[i], q = poly[j]; if ((p[1] > z) !== (q[1] > z) && x < ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]) + p[0]) c = !c; } return c; }
const COURT_ALL = [SQUARE, COURT_W, COURT_S, DECK, BED_S];
/** b of the entrance path's north-east edge at a (it gives way to the corner of the Earl Building's low wing) */
export const pathEdgeB = (a) => (a <= 50 ? RAMP.b1 : RAMP.b1 - 0.89 * clamp01((a - 50) / 3.6));
/** the planted bank beside the entrance path and the e-hub's walk: paving level at the paving's edge, the old ground 3 m out */
export function bankY(a, b) {
  let h = 0;
  if (a >= RAMP.walkA && a <= 53.6) h = rampY(a) * clamp01(1 - (b - pathEdgeB(a)) / RAMP.bank);
  if (a >= RAMP.walkA && b >= RAMP.b1 && b <= RAMP.walkB) h = Math.max(h, Y.floor * clamp01(1 - (a - RAMP.walkA) / RAMP.bank) * clamp01((32.6 - b) / 1.5));
  return h;
}
/** height of what is built here at (x, z), or null where the world's own ground stands */
export function groundY(x, z) {
  if (x < -452 || x > -362 || z < -190 || z > -116) return null;
  const [a, b] = F(x, z);
  // the terrace and its flight (linear over the nine risers, as every flight in the game)
  if (a > TERR.a0 && a < TERR.a1 && b > TERR.s0 - TERR.tread && b < DEP) return Y.floor * clamp01((b - (TERR.s0 - TERR.tread)) / (TERR.top - (TERR.s0 - TERR.tread)));
  // the way up to the entrance, the landing, the walk along the e-hub, the planted bank
  if (a >= ENTR.glass - 0.05 && a < 62 && b > RAMP.b0 - 0.1 && b < RAMP.walkB + 0.2) {
    if (a <= RAMP.walkA && b >= RAMP.b1) return Y.floor;
    if (pip(x, z, PATH)) return rampY(a);
    if (a < ENTR.tip && b < RAMP.b1) return Y.floor;      // (the doorway between the piers)
    if (b > RAMP.b1 - 1) { const h = bankY(a, b); if (h > 0.02) return h; }
  }
  if (x > -404.2) {
    for (const p of COURT_ALL) if (pip(x, z, p)) return Y.court;
    if (x > -395 && (pip(x, z, COURT_E) || pip(x, z, YARD_N))) return fallY(x, z);
  }
  if (x > APRON.x0 && x <= DECK[1][0] && pip(x, z, APRON_POLY)) return apronY(x);
  return null;
}

/** hand-checked against a named picture or plan (K) or a flagged guess (G): [id, K | G, what] (the form of worcester_streets.js) */
export const CHECKED = [
  [IDS.main, 'K', 'Sultan Nazrin Shah Centre: position, plan, levels (published plan and sections, planning drawings, LIDAR); the field front, terrace, steps, pergola, studio hood, entrance range and clerestory from the photographs'],
  [IDS.drum, 'K', 'its auditorium: fan plan, 15-bay clerestory between stone fins, butterfly roof (published plan and section 2, photographs, satellite)'],
  ['snsc:front', 'K', '12 bays (3 seminar + 6 open + 3 seminar), 13 tapered piers, sloping soffits, chequer of flood openings in the plinth, nine risers across the six open bays, bronze handrails, oak pergola, glazed doors behind round columns'],
  ['snsc:pergola', 'K', 'the oak pergola over the terrace: a deep beam on each pier line from the pier\'s back to the foyer wall, ten joists along the terrace housed into them, tops flush (photograph under the pergola looking north-west; the square-on photograph of the front); GUESS: the sections, 100 x 300 and 70 x 210 mm, by eye from that photograph'],
  ['snsc:climb-I1', 'G', 'INVENTED (_snsc_climb.js I1): four joists of the pergola\'s south-east bay taken down and stacked on the terrace by the foyer wall'],
  ['snsc:climb-I2', 'G', 'INVENTED (_snsc_climb.js I2): a roofers\' crawl board in three lengths lying up the head of the auditorium\'s north wall'],
  ['snsc:climb-I3', 'G', 'INVENTED in its size (_snsc_climb.js I3): the capping of the stage wall, the two short walls and the two sloping wall heads drawn 0.34 m wide and 60 mm proud (the detail section\'s key names an aluminium capping; nothing gives its width)'],
  ['snsc:climb-I4', 'G', 'INVENTED (_snsc_climb.js I4): a traffic cone and a cane with a plain red pennant on the north-east end block of the clerestory\'s cap'],
  ['snsc:climb-I7', 'G', 'INVENTED (_snsc_climb.js I7): roofers\' materials (three bags and a drum) stacked across the stage wall\'s head, two lengths of capping round from its west end'],
  ['snsc:climb-I8', 'G', 'INVENTED (_snsc_climb.js I8): 1.6 m of the stage wall\'s capping lifted off, the bare head not standable'],
  ['snsc:climb-I9', 'G', 'INVENTED (_snsc_climb.js I9): scaffold-tube edge protection round the north-east end block of the cap and along the outside of the last crawl board'],
  ['snsc:climb-I6', 'G', 'ADJUSTED (_snsc_climb.js I6): generated trees within about 6 m of the stage wall and north wall taken out; the big tree at the north-west end and the one behind the stage (both guesses) moved 3 and 5 m further off (the satellite picture shows both roofs clear of crowns, the crowns meeting the stage wall)'],
  ['snsc:climb-I10', 'G', 'INVENTED BEHAVIOUR (_snsc_climb.js I10): a landing on a flat roof from 1.5 m or more above is a roll to the nearest outer edge and off it'],
  ['snsc:climb-I5', 'G', 'INVENTED BEHAVIOUR (_snsc_climb.js I5): the auditorium\'s roof and the bare sloping wall heads cannot be stood on (you slide to the valley and out over its north end); every other roof, the timbers, the handrails and the level wall heads can'],
  ['snsc:ends', 'K', 'south-east end wall with two slot windows, recessed foyer window, the studio flank (photograph from the south-east); the north-west end is seen in one photograph only'],
  ['snsc:studio', 'K', 'studio 10.6 x 10.3 m, splayed stone hood 2 m deep standing in pool 1, glass of three panes, stone apron below it'],
  ['snsc:entrance', 'K', 'main entrance on the north-east side facing down the path: bronze doors, two glazed e-hub bays, an oak-boarded bay; the path 4.4 m wide rising from the court'],
  ['snsc:roof', 'K', 'flat grey roof with pale stone edges and rooflights (satellite); GUESS: the rooflights\' exact places'],
  ['snsc:back', 'G', 'north-west and north sides (store, stage wall, plant): outline from the plan, blank ashlar from the planning elevations; doors and details guessed'],
  ['snsc:levels', 'K', 'floor 1.6 m above the field and 1.15 m above the court; water 0.4 m below the paving (planning levels, LIDAR, photographs)'],
  ['snsc:court', 'K', 'the paved square on the Sainsbury Building\'s grid, its west piece to the pools, pale slabs (published plan, satellite, photographs); GUESS: the slab size'],
  ['snsc:court-falls', 'G', 'the falls of 0.45 m to the Gate 3 drive (x -378 to -372) and to the yard north of the court (z -142 to -148): NOT real, the flat world\'s price; they cancel when the terrain is on'],
  ['snsc:pool1', 'K', 'pool 1: rectangle 12.4 x 10.3 m with the corner cut by the bridge, dark brick lining (plan, photographs)'],
  ['snsc:pool2', 'K', 'pool 2: six-sided, rubble wall and flush kerb on the court side, planted west bank, the channel to the lake (plan, satellite, photographs); its south half is under trees in the satellite picture: outline from the plan'],
  ['snsc:bridge', 'K', 'flat grey timber deck, no handrail (photographs)'],
  ['snsc:bridge-size', 'K', 'the deck 3.7 m long and 3.0 m between the pools, where the published plan has it (its pools\' edges fitted: 3.60 x 2.89 m; the satellite view S4: 3.75 x 3.07 m; the map\'s bridge way: 3.7 m)'],
  ['snsc:kerb', 'K', 'pool 2\'s court-side kerb: from the deck\'s corner straight at the square\'s south corner (plan; satellite view S4: 36 to 37 degrees south of east)'],
  ['snsc:moore', 'K', 'Henry Moore plinth: 8 courses of dark blue-grey brick 2.9 x 1.0 x 0.8 m, bronze base plate, label, by pool 2 (photographs); the figure is a plain abstract reclining form, not a copy'],
  ['snsc:moore-place', 'K', 'the plinth\'s place: along the kerb, its pool-side face 1.05 m from the water\'s edge, its centre 4.0 m from the deck\'s corner (the Commons picture from the bridge; CEH_0585, taken at 85 mm; the satellite view S4); good to about 0.3 m'],
  ['snsc:frink', 'G', 'Elisabeth Frink seated figure on a corten plinth in the drive court: known to be there, the spot is guessed; an abstract form'],
  ['snsc:garden-wall', 'K', 'rubble wall with two ashlar-capped piers and a black iron gate south of the court (photograph); GUESS: its exact line and length'],
  ['snsc:garden', 'G', 'the planted bank between the entrance path and the Earl Building, its trees and the slab spur to the Earl Building\'s door; the planning drawings\' pergola with stone seats is not built here (not seen in any picture)'],
  ['snsc:beds', 'G', 'shrubs, trees and bollard lights: kinds and places by eye from the photographs'],
];
