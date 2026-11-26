// Round the Sultan Nazrin Shah Centre (places/worcester_snsc.js): the "Sainsbury Courtyard" inside Gate 3 with its two
// pools, the timber deck between them, the garden wall and gate, the plinths of the two bronzes, the paved way up to
// the main entrance and the planted bank beside it, the gravel path down to the field, beds, shrubs and bollard lights.
// World coordinates unless T.inFrame says otherwise; outlines and levels: _snsc_plan.js.
import * as P from './_snsc_plan.js';
import { steps } from './_snsc_tools.js';
import { frame } from './_worcester_kit.js';

const ST = 'snscStone', PV = 'snscPave';
const cen = (poly) => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
const off = (p, q, d) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = -(q[1] - p[1]) / l, nz = (q[0] - p[0]) / l; return [[p[0] + nx * d, p[1] + nz * d], [q[0] + nx * d, q[1] + nz * d]]; };

/** -> { lamps: [[x, y, z]], planters: [[x, z, r]] } for the module's lights and colliders */
export function buildSite(T, B) {
  const { surf, vface, lowWall, disc, shrub } = T, { Y, STUDIO: S, ENTR: E, RAMP } = P, C = Y.court, FL = Y.floor;
  const out = { lamps: [], planters: [] };
  const level = (y) => (x, z) => [x, y, z];
  // the slabs lie on the square's own grid (the Sainsbury Building's), whatever the piece
  const s0 = P.SQUARE[0], s3 = P.SQUARE[3], sl = Math.hypot(s3[0] - s0[0], s3[1] - s0[1]), e1 = [(s3[0] - s0[0]) / sl, (s3[1] - s0[1]) / sl];
  const cuv = (x, z) => [(x - s0[0]) * e1[0] + (z - s0[1]) * e1[1], -(x - s0[0]) * e1[1] + (z - s0[1]) * e1[0]];

  // ================================================================= the court
  for (const poly of [P.SQUARE, P.COURT_W, P.COURT_S]) surf(PV, poly, level(C), { uv: cuv });
  // east to the gatehouse and north into the yard: level, then the flagged fall to today's flat ground (fallY)
  const fall = (dy) => (x, z) => [x, P.fallY(x, z) + dy, z], cv = steps(-149, -126, 1.5);
  surf('snscPaveG', P.COURT_EN, fall(0), { cu: steps(-382, -362, 1.5), cv, uv: cuv });
  surf('snscPaveG', P.COURT_ES, fall(0), { cu: steps(-382, -362, 1.5), cv, uv: cuv });
  surf('snscTarmac', P.DRIVE, fall(0), { cu: steps(-382, -362, 1.5), cv });
  surf('snscPaveG', P.YARD_N, fall(0), { cu: steps(-396, -376, 1.5), cv, uv: cuv });

  // ================================================================= the pools' edges, the deck
  const c1 = cen(P.POOL1), c2 = cen(P.POOL2), hoodN = P.W(S.tip, S.b1), hoodS = P.W(S.tip, S.b0);
  // pool 1: dark brick under the paving's edge on the court and path sides; a rubble kerb with a stone top to the planting
  vface('snscBrick', P.POOL1[2], P.POOL1[3], 0, C, c1); vface('snscBrick', P.POOL1[3], hoodN, 0, C, c1);
  { const [p, q] = off(hoodS, P.POOL1[1], 0.175); lowWall('rubble', p, q, 0.35, 0, C - 0.07, { top: false }); lowWall(ST, p, q, 0.39, C - 0.07, C, { bottom: true }); }
  // the deck: grey boards laid across the way, a fascia board down to each pool
  { const d0 = P.DECK[0], d1 = P.DECK[1], l = Math.hypot(d1[0] - d0[0], d1[1] - d0[1]), u = [(d1[0] - d0[0]) / l, (d1[1] - d0[1]) / l];
    surf('snscDeck', P.DECK, level(C), { uv: (x, z) => [(x - d0[0]) * u[0] + (z - d0[1]) * u[1], -(x - d0[0]) * u[1] + (z - d0[1]) * u[0]] });
    vface('snscDeck', P.DECK[0], P.DECK[1], 0, C, c1); vface('snscDeck', P.DECK[3], P.DECK[2], 0, C, c2); }
  // pool 2: a rubble wall under the flush kerb on the court side; a low rubble wall on the garden side; a stone sill
  // (the weir) where the channel leaves for the lake; a timber edge to the planted west bank
  vface('rubble', P.POOL2[1], P.POOL2[2], 0, C, c2);
  { const [p, q] = off(P.POOL2[2], P.POOL2[3], -0.2); lowWall('rubble', p, q, 0.4, 0, C - 0.07, { top: false }); lowWall(ST, p, q, 0.46, C - 0.07, C, { bottom: true }); }
  lowWall(ST, P.CHANNEL[0], P.CHANNEL[1], 0.36, 0, 0.14);
  lowWall('snscDeck', P.POOL2[4], P.POOL2[5], 0.08, 0, 0.2);
  vface('snscDeck', P.POOL2[5], P.POOL2[0], 0, [P.apronY(P.POOL2[5][0]) + 0.02, C], c2);
  // (the lilies on both pools are the world's own)

  // ================================================================= the garden wall, its gate, the plinths
  for (const [p, q] of [P.WALL, P.WALL_STUB]) { lowWall('rubble', p, q, 0.42, 0, C + 1.5, { top: false }); lowWall(ST, p, q, 0.5, C + 1.5, C + 1.58, { bottom: true }); }
  { const g0 = P.GATE.w, g1 = P.GATE.e, l = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]), ry = -Math.atan2(g1[1] - g0[1], g1[0] - g0[0]);
    for (const g of [g0, g1]) { B.box('rubble', g[0], (C + 2.4) / 2, g[1], 0.7, C + 2.4, 0.7, ry, { top: false }); B.box(ST, g[0], C + 2.4 + 0.16, g[1], 0.84, 0.32, 0.84, ry, { bottom: true }); }
    B.push(frame(g0[0], 0, g0[1], g1[0] - g0[0], g1[1] - g0[1]));
    for (const y of [C + 0.14, C + 1.84]) B.boxXZ('iron', 0.35, l - 0.35, y, y + 0.05, -0.02, 0.02, { bottom: true });
    for (let s = 0.42; s < l - 0.36; s += 0.105) B.boxXZ('iron', s - 0.011, s + 0.011, C + 0.19, C + 1.97, -0.011, 0.011);
    B.pop(); }
  { const M = P.PLINTH;      // Henry Moore's: eight courses of long dark blue-grey bricks; a black label on the front, by the low end
    B.push(frame(M.c[0], 0, M.c[1], M.u[0], M.u[1]));
    B.boxXZ('snscBrick', -M.hl, M.hl, C, C + M.h, -M.hw, M.hw);
    B.poly('dark', [[-1.3, C + 0.5, -M.hw - 0.012], [-0.7, C + 0.5, -M.hw - 0.012], [-0.7, C + 0.71, -M.hw - 0.012], [-1.3, C + 0.71, -M.hw - 0.012]], [0, 0, -1]);
    B.pop(); }
  B.box('snscCorten', P.FRINK.c[0], C + P.FRINK.h / 2, P.FRINK.c[1], 0.72, P.FRINK.h, 0.72, 0.1);

  // ================================================================= the way up to the entrance, the walk, the bank
  T.inFrame(() => {
    surf(PV, P.PATH_AB, (a, b) => [a, P.rampY(a), -b], { cu: [RAMP.a0, RAMP.a1] });
    T.fl(PV, [[E.glass, S.b1], [E.tip, S.b1], [E.tip, RAMP.b1], [E.glass, RAMP.b1]], FL);
    T.fl(PV, [[E.glass, RAMP.b1], [RAMP.walkA, RAMP.b1], [RAMP.walkA, RAMP.walkB], [E.glass, RAMP.walkB]], FL);
    // the walk's end: a stone upstand where the bank has run out
    T.bx(ST, RAMP.walkA, RAMP.walkA + 0.3, 0, FL + 0.45, 30.6, RAMP.walkB + 0.3); T.bx(ST, E.glass, RAMP.walkA, 0, FL + 0.45, RAMP.walkB, RAMP.walkB + 0.3);
    const bank = (dy) => (a, b) => [a, Math.max(0.04, P.bankY(a, b)) + dy, -b];
    surf('snscBed', [[RAMP.walkA, RAMP.b1], [50, RAMP.b1], [53.6, 22.6], [53.9, 22.95], [50.0, 24.65], [45.85, RAMP.b1 + RAMP.bank], [RAMP.walkA, RAMP.b1 + RAMP.bank]], bank(0), { cu: [...steps(RAMP.walkA, 53.9, 1.0)], cv: steps(22.6, 26.5, 0.75) });
    surf('snscBed', [[RAMP.walkA, RAMP.b1 + RAMP.bank], [RAMP.walkA + RAMP.bank, RAMP.b1 + RAMP.bank], [RAMP.walkA + RAMP.bank, 32.6], [RAMP.walkA, 32.6]], bank(0), { cu: steps(RAMP.walkA, RAMP.walkA + 3.01, 1.0), cv: steps(26.5, 32.6, 0.75) });
    // slabs from the path to the Earl Building's garden door (GUESS; the friends go this way)
    { const p0 = [50.15, RAMP.b1 - 0.06], p1 = [42.7, 27.25], l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = [(p1[1] - p0[1]) / l * 0.55, -(p1[0] - p0[0]) / l * 0.55];      // (places/friends.js EARL_P -> EARL_D)
      surf('snscSpur', [[p0[0] + 0.7, p0[1]], [p1[0] + n[0], p1[1] + n[1]], [p1[0] - n[0], p1[1] - n[1]], [p0[0] - 0.7, p0[1]]], bank(0.018), { cu: steps(42, 51, 1.0), cv: steps(23.4, 28.5, 0.75) }); }
    // gravel to the foot of the front (the field path's own ribbon is the world's) and in the seminar bays
    T.fl('snscGravel', [[-0.6, -0.95], [P.TERR.a0, -0.95], [P.TERR.a0, 1.15], [-0.6, 1.15]], 0.05);
    T.fl('snscGravel', [[P.TERR.a1, -0.95], [P.LEN + 0.1, -0.95], [P.LEN + 0.1, 1.15], [P.TERR.a1, 1.15]], 0.05);
    T.fl('snscGravel', [[P.TERR.a0, -0.95], [P.TERR.a1, -0.95], [P.TERR.a1, P.TERR.s0 + 0.05], [P.TERR.a0, P.TERR.s0 + 0.05]], 0.05);
  });

  // ================================================================= west of the bridge: the gravel path down to the field, the beds
  const ap = (dy) => (x, z) => [x, Math.max(0.045, P.apronY(x)) + dy, z], WP = P.WPATH, x0 = P.APRON.x0;
  surf('snscGravel', [...WP.n, ...WP.s.slice().reverse()], ap(0), { cu: [x0] });
  surf('snscBed', [P.DECK[0], hoodS, P.APRON_POLY[2], WP.n[2], WP.n[1]], ap(0));
  surf('snscBed', [P.DECK[3], WP.s[1], WP.s[2], P.APRON_POLY[3], P.POOL2[5]], ap(0));
  surf('snscBed', [P.W(P.LEN, -0.45), WP.n[3], WP.n[2], P.APRON_POLY[2], P.W(S.a0, S.b0), P.W(S.a0, P.DEP), P.W(P.LEN, P.DEP)], level(0.045));
  surf('snscBed', P.BED_S, level(C + 0.03));

  // ================================================================= planting, bollard lights
  const gy = (x, z) => { const h = P.groundY(x, z); return h === null ? 0.04 : h; };
  const plant = (x, z, r, key, h = 1) => { r *= 0.85; shrub(x, gy(x, z) - 0.03, z, r, key, h); out.planters.push([x, z, r * 0.8]); };
  const K = ['leafC', 'leafA', 'box', 'leafB'];
  [[36.4, 1.2, 0.7], [36.7, 3.4, 0.9], [36.3, 5.0, 0.6], [35.2, 7.3, 0.7], [37.5, 7.6, 0.8], [39.6, 7.7, 0.7], [41.8, 7.6, 0.9], [44.0, 7.6, 0.7], [38.6, 4.4, 0.5], [40.6, 5.4, 0.6], [42.4, 2.2, 0.8], [39.6, 0.8, 0.6], [43.6, 0.2, 0.5], [45.9, 7.5, 0.6], [47.8, 7.7, 0.7], [50.2, 7.6, 0.55],
    [31.0, 24.3, 0.6], [33.2, 25.1, 0.8], [35.4, 24.2, 0.6], [37.6, 25.2, 0.75], [39.8, 24.3, 0.6], [41.6, 25.0, 0.7], [30.5, 27.4, 0.7], [31.1, 29.4, 0.6], [30.4, 31.2, 0.7], [52.4, 23.3, 0.45]]
    .forEach(([a, b, r], i) => { const w = P.W(a, b); plant(w[0], w[1], r, K[i % 4], 0.9 + (i % 3) * 0.2); });
  [[-407.5, -135.3, 0.6], [-405.7, -134.5, 0.5], [-409.6, -136.7, 0.7], [-410.4, -134.6, 0.5], [-406.0, -129.4, 0.6], [-408.5, -128.7, 0.7], [-410.2, -129.6, 0.5], [-405.3, -128.0, 0.5], [-394.5, -125.3, 0.6], [-395.4, -123.2, 0.55], [-394.0, -122.9, 0.45]]
    .forEach(([x, z, r], i) => plant(x, z, r, K[(i + 1) % 4], 1 + (i % 2) * 0.2));
  const bollard = (x, z) => { const y = gy(x, z); B.cyl('iron', x, y, z, 0.075, 0.95, 8, false); disc('iron', x, y + 0.95, z, 0.075, 8); B.cyl('lampGlass', x, y + 0.7, z, 0.082, 0.13, 8, false); out.lamps.push([x, y + 0.78, z]); };      // (black bollard lights; not lit at night yet: the world's lamp glow comes with a lantern head)
  for (const [a, b] of [[36.25, -0.25], [-0.95, -0.3], [33, 23.8], [39.5, 23.8], [46, 23.8]]) { const w = P.W(a, b); bollard(w[0], w[1]); }
  for (const [x, z] of [[-397.6, -135.0], [-409.9, -133.75], [-393.6, -127.9]]) bollard(x, z);
  return out;
}
