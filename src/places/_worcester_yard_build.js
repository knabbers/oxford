// Worcester College, Provost's Yard: the Besse Building with its archway, the west range (Memorial Room and Rose
// Garden Room), the Coach House, the veranda along the Terrace's foot and what stands in the yard. Called by
// places/worcester_yard.js with the college's Batch already in the LOCAL frame (x = u east, z = v south); the plan,
// its sources and what is known or guessed are in _worcester_yard_plan.js.
import { rectPts } from './_worcester_kit.js';
import { YARD, MEM_SHELL, YARD_RINGS, L2W } from './_worcester_yard_plan.js';
import { faces, face, wall, win, ridgeRoof, prism, clump } from './_worcester_yard_kit.js';

const OLD = 'wyOld';      // the old ranges' coursed, weathered stone
const ringW = (ring) => ring.map(([u, v]) => L2W(u, v));
const solid = (game, ring, tag = 'building') => game.worldCollider.addPolygon(ringW(ring), { tag });

// ------------------------------------------------------------------------------------------------ NORTH: the Besse Building
export function buildNorth(game, B) {
  const N = YARD.north, P = YARD.pass, F = faces(N), H = N.eaves;
  const notch = (a, b, L) => [[0, 0], [a, 0], [a, P.h], [b, P.h], [b, 0], [L, 0], [L, H], [0, H]];
  const g = (c, o = {}) => ({ c, y0: 0.95, w: 1.0, h: 1.5, sill: true, floor: 0, ...o }), f = (c, o = {}) => ({ c, y0: N.floor1 + 0.6, w: 1.0, h: 1.25, sill: true, floor: 1, ...o });
  // the yard (south) face: the archway, a sash either side, three above (ELEVATIONS: a guess)
  B.push(F.s.M);
  wall(B, 'stone', notch(F.s.x(P.u0), F.s.x(P.u1), F.s.L), [g(F.s.x(-43.4)), g(F.s.x(-36.4)), f(F.s.x(-43.4)), f(F.s.x(P.uc)), f(F.s.x(-36.4))]);
  B.pop();
  // the Orchard (north) face
  B.push(F.n.M);
  { const us = [-43.8, -36.0, -33.1, -30.2, -27.3];
    wall(B, 'stone', notch(F.n.x(P.u1), F.n.x(P.u0), F.n.L), [...us.map((u) => g(F.n.x(u))), ...us.map((u) => f(F.n.x(u))), f(F.n.x(P.uc))]); }
  B.pop();
  // the ends
  B.push(F.e.M); wall(B, 'stone', rectPts(0, 0, F.e.L, H), [2.6, 6.5].flatMap((c) => [g(c, { d: 0, ring: 0.1, sill: false }), f(c, { d: 0, ring: 0.1, sill: false })])); B.pop();
  B.push(F.w.M); wall(B, 'stone', rectPts(0, 0, F.w.L, H), [g(3.0, { d: 0, ring: 0.1, sill: false }), f(3.0, { d: 0, ring: 0.1, sill: false })]); B.pop();
  // the archway: ashlar side walls, a plastered soffit, a stone kerb at the foot of each wall, the bulkhead light
  B.push(face('e', P.u0, N.v1)); B.face('stoneLit', rectPts(0, 0, F.e.L, P.h)); B.pop();
  B.push(face('w', P.u1, N.v0)); B.face('stoneLit', rectPts(0, 0, F.w.L, P.h)); B.pop();
  B.flat('plasterLit', [[P.u0, N.v0], [P.u1, N.v0], [P.u1, N.v1], [P.u0, N.v1]], P.h, [], true);
  for (const [a, b] of [[P.u0, P.u0 + P.kerb], [P.u1 - P.kerb, P.u1]]) B.boxXZ('stoneDress', a, b, 0, 0.14, N.v0 - 0.3, N.v1 + 0.3);
  { const [lu, lv] = P.lamp, y = P.h;
    B.cyl('white', lu, y - 0.05, lv, 0.21, 0.05, 10, false);
    B.cyl('lampGlass', lu, y - 0.095, lv, 0.19, 0.045, 10, false, 0.14);      // a shallow glass dome
    B.poly('lampGlass', Array.from({ length: 10 }, (_, i) => { const t = (i / 10) * Math.PI * 2; return [lu + Math.sin(t) * 0.14, y - 0.095, lv + Math.cos(t) * 0.14]; }), [0, -1, 0]); }
  ridgeRoof(B, 'stoneSlate', [N.u0, N.u1, N.v0, N.v1], 'u', N.eaves, N.ridge, N.ov, { a: 'hip', b: 'hip' });
  solid(game, YARD_RINGS.northW); solid(game, YARD_RINGS.northE);
  return { lamps: [[P.lamp[0], P.h - 0.1, P.lamp[1], 'K']] };
}

// ------------------------------------------------------------------------------------------------ WEST: Memorial Room, Rose Garden Room, the porch
export function buildWest(game, B) {
  const Tl = YARD.westTall, Lo = YARD.westLow, Q = YARD.porch, M = MEM_SHELL;
  // ---- the tall block. Its yard door is the Memorial Room's (the door-case is drawn with the room, worcester_interiors.js);
  // the two ground-floor sashes named in MEM_SHELL are that room's real windows: painted here exactly where it opens them
  { const F = faces(Tl), H = Tl.eaves, up = (c) => ({ c, y0: 4.2, w: 1.0, h: 1.35, sill: true, floor: 1 }), room = (w, x) => ({ c: x, y0: w.y0, w: w.w, h: w.y1 - w.y0, d: M.rec, sill: true, floor: 0 });
    B.push(F.e.M); wall(B, OLD, rectPts(0, 0, F.e.L, H), [...M.east.map((w) => room(w, F.e.x(w.v))), ...[-43.2, -46.0, -48.8].map((v) => up(F.e.x(v)))]); B.pop();
    B.push(F.w.M); wall(B, OLD, rectPts(0, 0, F.w.L, H), [...M.west.map((w) => room(w, F.w.x(w.v))), ...[-48.65, -45.9, -43.2].map((v) => up(F.w.x(v)))]); B.pop();
    B.push(F.n.M); B.face(OLD, rectPts(0, 0, F.n.L, H)); B.pop();
    B.push(F.s.M); B.face(OLD, rectPts(0, 0, F.s.L, H)); B.pop();
    ridgeRoof(B, 'stoneSlate', [Tl.u0, Tl.u1, Tl.v0, Tl.v1], 'v', Tl.eaves, Tl.ridge, Tl.ov, { a: 'hip', b: 'gable' }, OLD);
    solid(game, YARD_RINGS.westTall);
    // the lean-to against its north end (outside the yard): three plain walls, a boarded door, stone slates falling north
    const Ln = YARD.leanTo;
    prism(B, OLD, [[Ln.u0, Ln.v0], [Ln.u1, Ln.v0], [Ln.u1, Ln.v1], [Ln.u0, Ln.v1]], 0, Ln.y0, { skip: [2] });
    for (const [u, n] of [[Ln.u0, -1], [Ln.u1, 1]]) B.poly(OLD, [[u, Ln.y0, Ln.v0], [u, Ln.y0, Ln.v1], [u, Ln.y1, Ln.v1]], [n, 0, 0]);
    B.poly('stoneSlate', [[Ln.u0 - 0.15, Ln.y0 - 0.08, Ln.v0 - 0.22], [Ln.u1 + 0.15, Ln.y0 - 0.08, Ln.v0 - 0.22], [Ln.u1 + 0.15, Ln.y1, Ln.v1], [Ln.u0 - 0.15, Ln.y1, Ln.v1]], [0, 1, -0.4]);
    B.push(face('n', Ln.u1, Ln.v0)); win(B, OLD, { c: 1.3, y0: 0.02, w: 0.9, h: 1.9, key: 'doorGrey', d: 0, door: true, ring: 0.07, floor: 0 }); B.pop();
    solid(game, YARD_RINGS.leanTo); }
  // ---- the low range: two tall narrow sashes to the yard, an iron gutter and a downpipe at the tall block's corner
  { const F = faces(Lo), H = Lo.eaves, S = Lo.sash, sashes = (x) => S.v.map((v) => ({ c: x(v), y0: S.y0, w: S.w, h: S.y1 - S.y0, sill: true, floor: 0 }));
    B.push(F.e.M); wall(B, OLD, rectPts(0, 0, F.e.L, H), sashes(F.e.x)); B.pop();
    B.push(F.w.M); wall(B, OLD, rectPts(0, 0, F.w.L, H), sashes(F.w.x)); B.pop();
    ridgeRoof(B, 'stoneSlate', [Lo.u0, Lo.u1, Lo.v0, Lo.v1], 'v', Lo.eaves, Lo.ridge, Lo.ov, { a: 'open', b: 'hip' });
    const ue = Lo.u1 + Lo.ov + 0.05, yg = H - Lo.ov * ((Lo.ridge - H) / ((Lo.u1 - Lo.u0) / 2));
    B.boxXZ('grey', ue - 0.06, ue + 0.06, yg - 0.1, yg, Lo.v0 + 0.05, Lo.v1 + Lo.ov, { bottom: true });
    B.boxXZ('grey', Lo.u1 + 0.03, Lo.u1 + 0.12, 0.12, yg - 0.1, Lo.v0 + 0.06, Lo.v0 + 0.15, { top: false });
    B.poly('grey', [[Lo.u1 + 0.03, yg - 0.1, Lo.v0 + 0.06], [ue + 0.06, yg - 0.1, Lo.v0 + 0.06], [ue + 0.06, yg - 0.1, Lo.v0 + 0.15], [Lo.u1 + 0.03, yg - 0.1, Lo.v0 + 0.15]], [0, 1, 0]);
    solid(game, YARD_RINGS.westLow); }
  // ---- the entrance block: a recess between two stone piers under a small white pediment (the door inside: a guess)
  { const ring = YARD_RINGS.porch, h = Q.h, p0 = Q.pier[0], p1 = Q.pier[1], w = Q.pierW, ub = Q.u1 - Q.deep, top = Q.pierH + 0.25;
    prism(B, OLD, [[Q.u0, Q.v0], [Q.u1, Q.v0], [Q.u1, Q.v1], [Q.u0, Q.v1]], 0, h + 0.12, { skip: [0, 1, 3] });      // the south wall (the others are below)
    // the east wall: solid south of the piers, over the recess above the entablature; the recess's three sides
    B.push(face('e', Q.u1, Q.v1));
    B.face(OLD, [[0, 0], [Q.v1 - p1, 0], [Q.v1 - p1, top], [Q.v1 - p0, top], [Q.v1 - p0, h + 0.12], [0, h + 0.12]]);
    B.pop();
    B.push(face('e', ub, p1 - w)); B.face(OLD, rectPts(0, 0, p1 - p0 - 2 * w, top)); win(B, OLD, { c: (p1 - p0 - 2 * w) / 2, y0: 1.0, w: 0.8, h: 1.0, key: 'sashAttic', d: 0, ring: 0.08, floor: 0 }); B.pop();
    // (the recess's two sides stop at the backs of the piers: a pier's inner face is its own, not also the wall's)
    const sd = Q.deep - 0.2;
    B.push(face('s', ub, p0 + w)); B.face(OLD, rectPts(0, 0, sd, top)); win(B, OLD, { c: sd / 2, y0: 0.02, w: 0.78, h: 1.95, key: 'doorDark', d: 0, door: true, ring: 0.05, floor: 0 }); B.pop();
    B.push(face('n', Q.u1 - 0.2, p1 - w)); B.face(OLD, rectPts(0, 0, sd, top)); B.pop();
    B.flat('plasterLit', [[ub, p0 + w], [Q.u1, p0 + w], [Q.u1, p1 - w], [ub, p1 - w]], top, [], true);
    B.flat('pavingSolid', [[ub, p0 + w], [Q.u1, p0 + w], [Q.u1, p1 - w], [ub, p1 - w]], 0.06);      // a threshold slab (flags: never a slate or glass cell flat on the ground)
    // the piers, the entablature across them, the pediment
    for (const v of [p0, p1 - w]) B.boxXZ('stoneDress', Q.u1 - 0.2, Q.u1 + 0.06, 0, Q.pierH, v, v + w, { top: false });
    B.boxXZ('white', Q.u1 - 0.2, Q.u1 + 0.14, Q.pierH, top, p0 - 0.1, p1 + 0.1, { bottom: true });
    B.push(face('e', Q.u1 + 0.1, p1 + 0.16));
    { const L = p1 - p0 + 0.32, a = Q.apex - top;
      B.poly('white', [[0, top, 0], [L, top, 0], [L / 2, Q.apex, 0]], [0, 0, 1]);
      B.poly('stoneSlate', [[0, top, 0.06], [L / 2, Q.apex + 0.04, 0.06], [L / 2, Q.apex + 0.04, -0.32], [0, top, -0.32]], [-a, L / 2, 0]);
      B.poly('stoneSlate', [[L, top, 0.06], [L, top, -0.32], [L / 2, Q.apex + 0.04, -0.32], [L / 2, Q.apex + 0.04, 0.06]], [a, L / 2, 0]); }
    B.pop();
    B.flat('lead', [[Q.u0, Q.v0], [Q.u1, Q.v0], [Q.u1, Q.v1], [Q.u0, Q.v1]], h);
    B.boxXZ('stoneDress', Q.u0, Q.u1 + 0.04, h, h + 0.12, Q.v1 - 0.2, Q.v1 + 0.04, { bottom: true });
    solid(game, ring); }
}

// ------------------------------------------------------------------------------------------------ EAST: the Coach House
export function buildEast(game, B) {
  const E = YARD.east, Fl = YARD.eastFlat, F = faces(E), H = E.eaves, hf = Fl.h, cp = Fl.h + 0.15;
  const sw = (c, o = {}) => ({ c, y0: 1.05, w: 1.0, h: 1.25, sill: true, floor: 0, ...o }), dr = (c, key = 'doorGrey') => ({ c, y0: 0.02, w: 1.25, h: 2.1, key, d: 0.1, door: true, floor: 0 });
  // the yard (west) side: boarded doors and small sashes (a guess: former stables)
  B.push(F.w.M); wall(B, OLD, rectPts(0, 0, F.w.L, H), [sw(F.w.x(-49.0)), dr(F.w.x(-46.9)), sw(F.w.x(-44.3)), dr(F.w.x(-41.2)), sw(F.w.x(-39.0))]); B.pop();
  B.push(face('w', Fl.u0, Fl.v0)); wall(B, OLD, rectPts(0, 0, Fl.v1 - Fl.v0, hf), [sw(1.5), dr(3.6, 'doorDark')]); B.pop();
  // the garden (east) side, one face for both parts
  B.push(face('e', E.u1, Fl.v1));
  { const L = Fl.v1 - E.v0, a = Fl.v1 - Fl.v0;
    wall(B, OLD, [[0, 0], [L, 0], [L, H], [a, H], [a, hf], [0, hf]], [2.0, 5.2, 10.0, 13.5, 17.0, 20.0].map((c) => sw(c, { d: 0, ring: 0.09, sill: false }))); }
  B.pop();
  // the flat part's north wall above the pitched roof's hip, its lead flat behind a low kerb
  B.push(face('n', Fl.u1, Fl.v0)); B.face(OLD, rectPts(0, H - 0.4, Fl.u1 - Fl.u0, hf)); B.pop();
  B.flat('lead', [[Fl.u0 + 0.2, Fl.v0 + 0.2], [Fl.u1 - 0.2, Fl.v0 + 0.2], [Fl.u1 - 0.2, Fl.v1], [Fl.u0 + 0.2, Fl.v1]], Fl.h);
  // (copings a little proud of the walls: no face of theirs lies in a wall's plane)
  for (const [a0, a1, b0, b1] of [[Fl.u0 - 0.03, Fl.u0 + 0.2, Fl.v0 - 0.03, Fl.v1], [Fl.u1 - 0.2, Fl.u1 + 0.03, Fl.v0 - 0.03, Fl.v1], [Fl.u0 + 0.2, Fl.u1 - 0.2, Fl.v0 - 0.03, Fl.v0 + 0.2]]) B.boxXZ('stoneDress', a0, a1, hf, cp, b0, b1, { bottom: true });
  const m = ridgeRoof(B, 'stoneSlate', [E.u0, E.u1, E.v0, E.v1], 'v', E.eaves, E.ridge, E.ov, { a: 'hip', b: 'hip' });      // (hipped at BOTH ends: the survey's ridge falls to the eaves against the Besse Building too)
  // three rooflights on the yard slope (the satellite picture)
  for (const v of [-47.6, -44.4, -40.4]) {
    const q = (t, dv) => [E.u0 + t, E.eaves + t * m + 0.05, v + dv];
    B.poly('frame', [q(1.05, -0.5), q(1.05, 0.5), q(2.25, 0.5), q(2.25, -0.5)], [-m, 1, 0]);
    B.poly('glassDark', [q(1.12, -0.43), q(1.12, 0.43), q(2.18, 0.43), q(2.18, -0.43)].map((p) => [p[0], p[1] + 0.012, p[2]]), [-m, 1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]]);
  }
  solid(game, YARD_RINGS.east);
}

// ------------------------------------------------------------------------------------------------ the veranda
export function buildVeranda(game, B, world) {
  const V = YARD.veranda, R = V.ret, vT = YARD.vT, col = game.worldCollider;
  const ring = [[V.u0, V.vEdge], [R.uEdge, V.vEdge], [R.uEdge, R.v0], [V.u1, R.v0], [V.u1, vT], [V.u0, vT]];
  B.flat('lead', ring, V.edge);                          // the lead flat
  B.flat('wood', ring, V.beam - 0.03, [], true);        // its boarded underside
  prism(B, 'wyFascia', ring, V.beam - 0.13, V.edge, { skip: [3, 4, 5] });      // the fascia on the three open edges
  // the beam on the columns
  B.boxXZ('oak', V.u0, R.colU + 0.09, V.colH, V.beam - 0.03, V.colV - 0.09, V.colV + 0.09, { top: false, bottom: true });
  B.boxXZ('oak', R.colU - 0.09, R.colU + 0.09, V.colH, V.beam - 0.03, R.v0 + 0.1, V.colV - 0.09, { top: false, bottom: true });
  const column = (u, v) => {
    B.boxXZ('stoneDress', u - 0.16, u + 0.16, 0, 0.2, v - 0.16, v + 0.16);
    B.cyl('wyCol', u, 0.2, v, 0.092, V.colH - 0.32, 8, false, 0.115);
    B.boxXZ('wyCol', u - 0.15, u + 0.15, V.colH - 0.12, V.colH, v - 0.15, v + 0.15, { bottom: true, top: false });
    const p = L2W(u, v); col.addCircle(p[0], p[1], 0.15, { tag: 'pillar' });
  };
  for (const u of V.cols) column(u, V.colV);
  for (const v of R.cols) column(R.colU, v);
  // a bulkhead light under the boards by the door of Staircase 6 (a guess: none shows in the photograph)
  const lu = (YARD.stair6Door.u0 + YARD.stair6Door.u1) / 2, lv = vT - 1.3, ly = V.beam - 0.03;
  B.cyl('white', lu, ly - 0.05, lv, 0.16, 0.05, 8, false);
  B.poly('lampGlass', Array.from({ length: 8 }, (_, i) => { const t = (i / 8) * Math.PI * 2; return [lu + Math.sin(t) * 0.15, ly - 0.05, lv + Math.cos(t) * 0.15]; }), [0, -1, 0]);
  void world;
  return { lamps: [[lu, ly - 0.06, lv, 'G']] };
}

// ------------------------------------------------------------------------------------------------ what stands in the yard
export function buildFurniture(game, B) {
  const col = game.worldCollider, box = (u, v, s) => col.addPolygon([[u - s / 2, v - s / 2], [u + s / 2, v - s / 2], [u + s / 2, v + s / 2], [u - s / 2, v + s / 2]].map(([a, b]) => L2W(a, b)), { tag: 'planter' });
  // the timber planters in the middle (the photograph)
  YARD.planters.forEach(([u, v, s, h], i) => {
    B.boxXZ('wyPlanter', u - s / 2, u + s / 2, 0.03, h, v - s / 2, v + s / 2, { top: false });
    B.flat('soil', [[u - s / 2 + 0.05, v - s / 2 + 0.05], [u + s / 2 - 0.05, v - s / 2 + 0.05], [u + s / 2 - 0.05, v + s / 2 - 0.05], [u - s / 2 + 0.05, v + s / 2 - 0.05]], h - 0.06);
    clump(B, i % 2 ? 'leafB' : 'leafA', u - 0.1, h - 0.08, v + 0.05, s * 0.42, 0.42);
    clump(B, i % 2 ? 'leafA' : 'leafC', u + 0.16, h + 0.1, v - 0.12, s * 0.2, 0.7 + (i % 3) * 0.12, 5);
    for (const [du, dv, k] of [[0.22, 0.2, 'flR'], [-0.25, -0.18, 'flM'], [0.05, 0.3, 'flW']]) B.poly(k, [[u + du - 0.07, h + 0.24, v + dv], [u + du + 0.07, h + 0.24, v + dv], [u + du, h + 0.34, v + dv - 0.04]], [0, 0.3, 1]);
    box(u, v, s);
  });
  // the Wollemi pine in its square planter in the corner by the arch: a young one, dark and narrow (three tiers of branches)
  { const [u, v] = YARD.pine, s = 1.15, h = 0.62;
    B.boxXZ('wyPlanter', u - s / 2, u + s / 2, 0.03, h, v - s / 2, v + s / 2, { top: false });
    B.flat('soil', [[u - s / 2 + 0.06, v - s / 2 + 0.06], [u + s / 2 - 0.06, v - s / 2 + 0.06], [u + s / 2 - 0.06, v + s / 2 - 0.06], [u - s / 2 + 0.06, v + s / 2 - 0.06]], h - 0.07);
    B.cyl('oak', u, h - 0.07, v, 0.05, 1.1, 6, false, 0.07);
    for (const [y0, hh, r0, r1] of [[1.25, 1.0, 0.72, 0.16], [2.05, 0.9, 0.56, 0.1], [2.75, 0.8, 0.4, 0.02]]) B.cyl('leafC', u, y0, v, r1, hh, 7, false, r0);
    box(u, v, s); }
  // the staging of pots under the veranda's corner
  { const [u, v] = YARD.pots;
    B.boxXZ('oak', u - 0.9, u + 0.9, 0.42, 0.46, v - 0.28, v + 0.02); B.boxXZ('oak', u - 0.9, u + 0.9, 0.78, 0.82, v - 0.02, v + 0.28);
    for (const du of [-0.85, 0.85]) B.boxXZ('oak', u + du - 0.03, u + du + 0.03, 0, 0.78, v - 0.26, v + 0.26, { top: false });
    [[-0.6, -0.13, 0.46], [0, -0.13, 0.46], [0.55, -0.13, 0.46], [-0.35, 0.13, 0.82], [0.3, 0.13, 0.82], [1.25, 0.05, 0.0]].forEach(([du, dv, y], i) => {
      B.cyl('terracotta', u + du, y, v + dv, 0.12, 0.22, 6, false, 0.085);
      clump(B, i % 2 ? 'leafA' : 'leafB', u + du, y + 0.2, v + dv, 0.17, 0.3 + (i % 3) * 0.08, 5);
    });
    col.addPolygon([[u - 0.95, v - 0.32], [u + 1.4, v - 0.32], [u + 1.4, v + 0.32], [u - 0.95, v + 0.32]].map(([a, b]) => L2W(a, b)), { tag: 'planter' }); }
}
