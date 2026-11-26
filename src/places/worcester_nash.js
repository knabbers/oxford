// Nash Quad, Worcester College (2026-11-22): the paved court on the north side of the college off Worcester Place,
// from the owner's photograph `reference/worcester/worcester building.jpg` (taken at the court's narrow east end,
// looking west), New Oxford Architecture's picture of the "Ruskin Lane Building", the college's 2023 map and the
// owner's aerial picture. Looked at and never copied or used as textures.
//
//   LEFT of the photograph   the Nash Building (ADP, 2006-07; OSM w69991299, alt name "Ruskin Lane Building"): the
//                            long south range of three stepped pavilions. Ground storey set back behind round concrete
//                            columns, a concrete slab carrying grey metal bays two storeys tall, monopitch metal roofs.
//                            The Nash Cafe's tables and A-board stand at its foot.
//   RIGHT                    Staircase 24 (OSM w69991362), the quad's north range: three storeys of pale buff brick
//                            with grey metal windows, four wide zinc dormers in a slate roof (the "metal top storey"
//                            of the photograph); to Worcester Place it is the buff Victorian terrace Nos 14-16.
//   CENTRE                   the Sainsbury Building's east wing (places/_worcester_ranges.js draws it; a second
//                            photograph in `reference/worcester/14 sainsbury building/`): here the seven steps between
//                            cheek walls up to its raised passage, the brick wall along the court with the low
//                            lead-topped bay behind it, the low wall and black fence on the other side.
//   the court                pale flags with a line of setts, two round planted beds each with a young tree (ordinary
//                            map trees), clipped box balls and curved slatted benches you can sit on.
//
// KNOWN (K, seen in a picture): which building is which, materials, storey counts, the columns / slabs / bays of the
// Nash Building's court side, the window pattern of Staircase 24's court side and its metal top storey, the beds, box
// balls, trees, benches, the cafe tables and A-board, the brick wall with steps at its left end and the passage left of
// those. GUESSES (G, flagged): every dimension (by eye, +-0.5 m), all the sides the photograph does not show (the Nash
// Building's garden side and ends, Staircase 24's Worcester Place side and ends, its roof's form and its door), what is
// the steps down from the passage on the lake side (the photograph shows more steps going UP there), the wall closing the gap between
// the MCR and Staircase 24, the trees' species (the photograph suggests magnolias; the world plants its own kinds).
// `?wnash=0` (node: GTO_WNASH=0) turns the whole pass off for before / after pictures.
import * as THREE from 'three';
import { Batch, frame, rectPts, makePack } from './_worcester_kit.js';
import { NASHQ_ON as ON, SAINSBURY, SB_TERRACE, SB_PASSAGE, SB_REBUILT as SBR, paneWin } from './_worcester_ranges.js';
// SBR (2026-11-22): the Sainsbury Building is rebuilt (_worcester_sainsbury.js). The passage now comes out on its upper
// terrace, so the guessed flight down on the lake side is not drawn; and the owner's photograph of this quad (the true
// way round: the JCR page's picture of this front is mirrored) has the low canted bay SOUTH of the steps, where that
// file builds it, and the court wall with planting behind it north of them: the bay and the low wall here are not drawn.

const NASH_ID = 'w69991299', ST24_ID = 'w69991362';
/** hand-checked against a photograph (K) or a flagged guess (G): [id, K | G, what] (the form of worcester_streets.js) */
export const CHECKED = [
  [NASH_ID, 'K', 'Nash Building (Ruskin Lane Building), Nash Quad: court side from photographs; garden side, ends and roof from the planning elevations'],
  [ST24_ID, 'K', 'Staircase 24, Nash Quad north range: quad side, west gable and roof from photographs and the satellite picture; Worcester Place side from the planning elevation (as built not seen)'],
  [SAINSBURY.id, 'K', 'Sainsbury Building: the east wing on Nash Quad from the photograph (brick, black timber, slate, steps, raised passage, court wall, low bay); the rest as before'],
];

// ---- frames: o = a corner, e = the next corner along the court side; a runs o -> e, b to the south
const mk = (o, e, D) => {
  const dx = e[0] - o[0], dz = e[1] - o[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  return { o, ux, uz, L, D, pt: (a, b) => [o[0] + a * ux - b * uz, o[1] + a * uz + b * ux], mat: () => frame(o[0], 0, o[1], ux, uz) };
};
// the Nash Building's three pavilions, west to east (corners of the mapped outline; b = 0 is the court-side line of the bays)
export const PAV = [mk([-356.1, -105.9], [-345.7, -108.9], 11.8), mk([-343.9, -109.5], [-330.0, -115.0], 11.8), mk([-328.0, -115.5], [-310.8, -121.6], 12.0)];
// Staircase 24: a east along its court (south) front, the block lies at b = -D .. 0
export const S24 = mk([-347.8, -121.7], [-319.5, -124.4], 10.7);
const SBF = (() => { const c = Math.cos(SAINSBURY.th), s = Math.sin(SAINSBURY.th), O = SAINSBURY.O; return { pt: (a, b) => [O[0] + a * c + b * s, O[1] - a * s + b * c], inv: (x, z) => [(x - O[0]) * c - (z - O[1]) * s, (x - O[0]) * s + (z - O[1]) * c], mat: () => frame(O[0], 0, O[1], c, -s) }; })();

// the Nash Building's section (m): ground storey, slab, two bay storeys; the upper wall and the ground wall behind the bays
const NB = { g: 2.95, f1: 3.3, up: 2.85, wallB: 1.3, groundB: 2.6, colB: 0.45, bayW: 2.4, eaves: 9.0, ridge: 10.5, over: 0.9, bays: [3, 4, 4] };      // (ADP's elevations: 9 m to the eaves, 10.5 m to the ridge; 3 + 4 + 4 bays)
const roofMid = (P) => (P.D + 0.5 - NB.over) / 2, roofY = (P, b) => NB.eaves + (NB.ridge - NB.eaves) * (1 - Math.abs(b - roofMid(P)) / ((P.D + 0.5 + NB.over) / 2));      // a shallow double pitch
const bayCentres = (P) => { const n = NB.bays[PAV.indexOf(P)] || Math.max(2, Math.round(P.L / 3.6)); return Array.from({ length: n }, (_, i) => (P.L * (i + 0.5)) / n); };
// the two planted circles [x, z, radius] and their benches [circle, bearing of the middle (rad from east towards south), half span]
export const BEDS = [[-323.4, -122.0, 1.8], [-336.0, -117.9, 2.6], [-343.4, -116.3, 2.3]];      // (the satellite picture: three trees in beds, the east one against Staircase 24)
export const BENCHES = [[0, 0.95, 0.5], [0, -0.1, 0.42], [1, -0.5, 0.5], [2, 0.9, 0.45]];
const TREES = [[-323.6, -122.2, 7.6, 'broad'], [-335.8, -117.7, 7.0, 'broad'], [-343.6, -116.1, 6.4, 'broad']];      // (broadleaf: the world's nearest kind to the young trees in the photograph)
// before the Sainsbury Building (its frame: a east, b south; the wing's east face is a = 31.6): seven steps between
// brick cheek walls up to the passage through the wing, a steps down again on the lake side (G), the brick wall along
// the court north of the steps with the single-storey bay behind it, the low wall and black fence south of them
const TERR = { y: SB_TERRACE, wallH: 1.9, land: 34.1, foot: 36.2, n: 7, w0: 20.8, wFoot: 18.7, wallA: 36.3, wallB: 6.5, lowA: 34.6, lowB: 27.0, lowH: 1.15, bay: [31.66, 35.0, 11.0, 16.9, 2.75] };      // (the bay's top stays under the wing's first-floor glazed bay)
// cafe tables under the west pavilion's overhang [a, b] and the A-board
const TABLES = [[3.6, 1.5], [7.2, 1.5]], ABOARD = [10.35, 0.75];
// mapped footways the court's own paving replaces (they stay in the walk graph)
const WAYS = ['w169617911', 'w1041191959', 'w169617902', 'w1041191958', 'w130668905', 'w1480325735', 'w169617906'];

const SLOT_S = [-324.8, -104.1];      // the south end of the way through between the middle and east pavilions
const REROUTE = [
  // gate court -> quad: down between the Sainsbury Building's wall and the far bed, then along the Nash side
  ['w1041191958', (p) => [...p.slice(0, -1), [-356.0, -120.6], [-354.4, -115.5], [-353.0, -110.8], [-349.2, -111.0], [-337.8, -113.2], p[p.length - 1]]],
  // along the Sainsbury Building's front: outside the brick wall, to the foot of the steps
  ['w1041191959', (p) => [p[0], [-357.9, -119.8], [-356.7, -107.8], p[p.length - 1]]],
  // the way through the Nash Building to the garden, and the garden path that leaves it
  ['w1041191957', (p) => [p[0], SLOT_S.slice()]],
  ['w169617907', (p) => [SLOT_S.slice(), ...p.slice(1)]],
];

function pip(x, z, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
/** height of the passage floor / its steps at a point of the Sainsbury frame, or null */
export function terraceY(a, b) {
  if (b < SB_PASSAGE.b0 - 0.15 || b > SB_PASSAGE.b1 + 0.15 || a < TERR.wFoot || a > TERR.foot) return null;
  if (SBR && a < TERR.w0) return null;      // (the three steps up to the terrace are the Sainsbury Building's own)
  if (a > TERR.land) return (TERR.y * (TERR.foot - a)) / (TERR.foot - TERR.land);
  if (a < TERR.w0) return (TERR.y * (a - TERR.wFoot)) / (TERR.w0 - TERR.wFoot);
  return TERR.y;
}

export default {
  id: 'worcester_nash',
  preMap(game) {
    if (!ON) return;
    try {
      const ov = game.overrides, map = game.map;
      ov.skip.add(NASH_ID); ov.skip.add(ST24_ID);
      for (const id of WAYS) ov.skip.add(id);
      if (map && map.trees) for (const t of TREES) map.trees.push(t.slice());
      // the walk graph: three mapped ways are drawn schematically straight through where the beds, the court wall and the
      // east pavilion's wall stand; they are led round them (their end nodes stay where they were)
      for (const [id, fn] of REROUTE) { const r = map && map.roads && map.roads.find((x) => x.id === id); if (r && r.pts) r.pts = fn(r.pts.map((q) => q.slice())); }
    } catch (e) { console.error('[worcester_nash] preMap', e); }
  },
  install(game) {
    if (!ON) return null;
    const world = game.world, col = game.worldCollider;
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    // two colours the college's atlas did not have: board-marked concrete and pale zinc sheet (plain cells, tinted)
    if (pack.cells && pack.cells.get('plaster') && !pack.cells.get('concrete')) { pack.cells.set('concrete', { ...pack.cells.get('plaster'), tint: [0.86, 0.81, 0.71] }); pack.cells.set('zinc', { ...pack.cells.get('lead'), tint: lin(0x9ba6ad) });
      // the Nash Building's bays face north and never see the sun: their pale grey sheet is drawn by the court's bounce light
      pack.cells.set('clad', { ...pack.cells.get('lead'), tint: [0.5, 0.54, 0.58] }); pack.cells.set('benchTeak', { ...pack.cells.get('teak'), tint: [0.82, 0.47, 0.22] }); }
    const M = { _pack: pack };
    const B = new Batch();
    const grp = new THREE.Group(); grp.name = 'worcester-nash';
    world.addStatic(grp);
    let bayN = 900;
    const bay = (floor) => [1 + (bayN++ % 251), floor > 0 ? 1 + (bayN % 5) : 0];
    const seg = (a, b, tag = 'building', o = {}) => col.addSegment(a[0], a[1], b[0], b[1], { tag, ...o });
    /** a wall face with windows: wins = [[x0, y0, x1, y1, floor, opts]] */
    const wall = (key, outline, wins, o = {}) => { B.face(key, outline, wins.map((w) => rectPts(w[0], w[1], w[2], w[3]))); for (const w of wins) paneWin(B, w[0], w[1], w[2], w[3], bay(w[4]), { wall: key, frame: 'alu', cols: 2, tr: 0.68, sill: 'alu', ...o, ...(w[5] || {}) }); };
    /** a sloping roof slab over a0..a1, b0..b1: top at y0 over b0 and y1 over b1 */
    const slab = (a0, a1, b0, b1, y0, y1, t = 0.2) => {
      B.poly('zinc', [[a0, y0, b0], [a1, y0, b0], [a1, y1, b1], [a0, y1, b1]], [0, 1, 0]);
      B.poly('alu', [[a0, y0 - t, b0], [a1, y0 - t, b0], [a1, y1 - t, b1], [a0, y1 - t, b1]], [0, -1, 0]);
      B.poly('grey', [[a0, y0 - t, b0], [a1, y0 - t, b0], [a1, y0, b0], [a0, y0, b0]], [0, 0, -1]);
      B.poly('grey', [[a0, y1 - t, b1], [a1, y1 - t, b1], [a1, y1, b1], [a0, y1, b1]], [0, 0, 1]);
      B.poly('grey', [[a0, y0 - t, b0], [a0, y1 - t, b1], [a0, y1, b1], [a0, y0, b0]], [-1, 0, 0]);
      B.poly('grey', [[a1, y0 - t, b0], [a1, y1 - t, b1], [a1, y1, b1], [a1, y0, b0]], [1, 0, 0]);
    };

    // ================================================================= the Nash Building
    for (const [pi, P] of PAV.entries()) {
      const { L, D } = P, cs = bayCentres(P), yW = roofY(P, NB.wallB) - 0.24, yS = roofY(P, D) - 0.24;
      B.push(P.mat());
      // --- court side. Ground storey: brick with glazed screens between the columns' bays (the cafe and the suite)
      B.push(frame(L, 0, NB.groundB, -1, 0));
      wall('buff', rectPts(0, 0, L, NB.g), cs.map((c) => [L - c - 1.3, 0.08, L - c + 1.3, 2.6, 0]), { cols: 3, tr: 0.82, depth: 0.12, sill: null });
      B.pop();
      // the slab over the colonnade, a tongue of it under each bay, a round column under each tongue
      B.boxXZ('concrete', 0.02, L - 0.02, NB.g, NB.f1, NB.wallB, NB.groundB, { bottom: true });
      for (const c of cs) {
        B.boxXZ('concrete', c - 1.45, c + 1.45, NB.g - 0.02, NB.f1 + 0.02, -0.06, NB.wallB + 0.06, { bottom: true });
        B.cyl('concrete', c, 0, NB.colB, 0.19, NB.g - 0.02, 10, false);
        const q = P.pt(c, NB.colB); col.addCircle(q[0], q[1], 0.21, { tag: 'building' });
      }
      // the upper wall between the bays, a strip of grey cladding under the roof
      B.push(frame(L, 0, NB.wallB, -1, 0));
      B.face('buff', rectPts(0, NB.f1, L, NB.f1 + 2 * NB.up));
      B.face('clad', rectPts(0, NB.f1 + 2 * NB.up, L, yW));
      B.pop();
      // the bays: grey metal boxes two storeys tall on the slab, a pair of windows to each storey
      const yB = roofY(P, 0) - 0.4;
      for (const c of cs) {
        B.boxXZ('clad', c - NB.bayW / 2, c + NB.bayW / 2, NB.f1 + 0.02, yB, 0, NB.wallB + 0.05);
        B.boxXZ('alu', c - NB.bayW / 2 - 0.04, c + NB.bayW / 2 + 0.04, NB.f1 + NB.up - 0.07, NB.f1 + NB.up + 0.07, -0.035, NB.wallB - 0.1, { bottom: true });
        B.boxXZ('alu', c - NB.bayW / 2 - 0.06, c + NB.bayW / 2 + 0.06, yB, yB + 0.07, -0.06, NB.wallB + 0.02, { bottom: true });
        B.push(frame(c + NB.bayW / 2, 0, -0.02, -1, 0));
        for (let f = 0; f < 2; f++) paneWin(B, 0.3, NB.f1 + f * NB.up + 0.7, NB.bayW - 0.3, NB.f1 + f * NB.up + 2.45, bay(f + 1), { frame: 'alu', depth: 0, cols: 2, tr: 0.68 });
        B.pop();
      }
      // --- garden side (ADP's south elevation; no photograph): brick, the two upper storeys seen over the Orchard wall,
      // two-storey zinc-and-glass bays standing a little proud with small single windows between them
      B.push(frame(0, 0, D, 1, 0));
      { const n = 3, wins = [];
        for (let i = 0; i < n - 1; i++) { const c = (L * (i + 1)) / n; for (const f of [1, 2]) wins.push([c - 0.3, NB.f1 + (f - 1) * NB.up + 1.2, c + 0.3, NB.f1 + (f - 1) * NB.up + 2.2, f, { cols: 1, tr: 0 }]); }
        wall('buff', rectPts(0, 0, L, yS), wins);
        B.box('buff', L / 2, NB.f1 - 0.15, 0.02, L, 0.3, 0.06, 0, { bottom: true });      // the brick band at first-floor level
        for (let i = 0; i < n; i++) {
          const c = (L * (i + 0.5)) / n, w = i % 2 ? 1.5 : 2.2;
          B.boxXZ('clad', c - w / 2, c + w / 2, NB.f1 + 0.5, yS - 0.25, -0.05, 0.45);
          B.push(new THREE.Matrix4().makeTranslation(0, 0, 0.47));
          for (const f of [1, 2]) paneWin(B, c - w / 2 + 0.2, NB.f1 + (f - 1) * NB.up + 0.8, c + w / 2 - 0.2, NB.f1 + (f - 1) * NB.up + 2.45, bay(f), { frame: 'alu', depth: 0, cols: w > 2 ? 2 : 1, tr: 0.68 });
          B.pop();
        } }
      B.pop();
      // --- the ends: brick gables, open under the overhang; one window to each upper storey
      const dW = D - NB.wallB, gB = NB.groundB - NB.wallB, sm = roofMid(P) - NB.wallB, yR = roofY(P, roofMid(P)) - 0.24;
      const endWins = [1, 2].map((f) => [dW / 2 - 0.8, NB.f1 + (f - 1) * NB.up + 0.9, dW / 2 + 0.8, NB.f1 + (f - 1) * NB.up + 2.4, f]);
      B.push(frame(0, 0, NB.wallB, 0, 1));
      wall('buff', [[gB, 0], [dW, 0], [dW, yS], [sm, yR], [0, yW], [0, NB.g], [gB, NB.g]], endWins);
      B.pop();
      B.push(frame(L, 0, D, 0, -1));
      wall('buff', [[0, 0], [dW - gB, 0], [dW - gB, NB.g], [dW, NB.g], [dW, yW], [dW - sm, yR], [0, yS]], endWins);
      B.pop();
      // --- the roof: a shallow double pitch of zinc, oversailing the bays
      slab(-0.4 - pi * 0.01, L + 0.4, -NB.over, roofMid(P), NB.eaves, NB.ridge);
      slab(-0.4 - pi * 0.01, L + 0.4, roofMid(P), D + 0.5, NB.ridge, NB.eaves);
      B.pop();
      // colliders: the ground storey's walls
      const R = [P.pt(0, NB.groundB), P.pt(L, NB.groundB), P.pt(L, D), P.pt(0, D)];
      col.addPolygon(R, { tag: 'building' });
    }
    // the glazed links: west-middle (to the ground: the suite's lobby), middle-east (a bridge over the way through to the garden)
    for (const [i, y0] of [[0, 0], [1, NB.f1]]) {
      const A = PAV[i], C = PAV[i + 1], yT = 8.9 - i * 0.05;      // (flat links at eaves height)
      const nw = A.pt(A.L, NB.groundB), ne = C.pt(0, NB.groundB), sw = A.pt(A.L, A.D - 1.2), se = C.pt(0, C.D - 1.2);
      for (const [p, q] of [[ne, nw], [sw, se]]) {
        const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
        B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1]));
        B.face('clad', rectPts(0, y0, l, yT));
        B.push(new THREE.Matrix4().makeTranslation(0, 0, 0.02));
        for (let y = Math.max(y0, 0.1) + 0.15; y + 2.3 < yT; y += 3.0) paneWin(B, 0.15, y, l - 0.15, y + 2.4, bay(y > 3 ? 1 : 0), { frame: 'alu', depth: 0, cols: 1, tr: 0.75 });
        B.pop(); B.pop();
        if (!i) seg(p, q);
      }
      B.poly('zinc', [[nw[0], yT, nw[1]], [ne[0], yT, ne[1]], [se[0], yT, se[1]], [sw[0], yT, sw[1]]], [0, 1, 0]);
      if (i) B.poly('concrete', [[nw[0], y0, nw[1]], [ne[0], y0, ne[1]], [se[0], y0, se[1]], [sw[0], y0, sw[1]]], [0, -1, 0]);
    }

    // ================================================================= Staircase 24
    // (ADP's elevations, the college's photograph of its quad side and west gable, the satellite picture.) Three brick
    // storeys under a slate roof with gable ends. QUAD side: grey windows, a wide pair and a narrow one to each room, a
    // zinc-and-glass stair bay with the door in the middle, four wide zinc dormers. STREET side: the buff Victorian
    // terrace (Nos 14-16) and the 2007 infill east of it: white sashes, two-storey bays, the houses' doors, two stacks.
    {
      const P = S24, { L, D } = P, SH = 2.9, yE = 8.9, yR = 12.0, st0 = 10.3, st1 = 14.9;
      B.push(P.mat());
      // --- the quad front
      B.push(frame(0, 0, 0, 1, 0));
      { const wins = [];
        for (const [c, w] of [[1.7, 1.5], [3.4, 0.62], [6.4, 1.5], [8.1, 0.62], [L - 8.1, 0.62], [L - 6.4, 1.5], [L - 3.4, 0.62], [L - 1.7, 1.5], [17.0, 1.5], [19.0, 0.62]])
          for (let f = 0; f < 3; f++) wins.push([c - w / 2, f * SH + 0.95, c + w / 2, f * SH + 2.45, f, w < 1 ? { cols: 1 } : null]);
        wall('buff', [[0, 0], [st0, 0], [st0, yE], [0, yE]], wins.filter((w) => w[0] < st0));
        wall('buff', [[st1, 0], [L, 0], [L, yE], [st1, yE]], wins.filter((w) => w[0] > st1));
        // the stair bay: zinc and glass, a little proud of the brick, the door at its foot
        B.boxXZ('grey', st0, st1, 0, yE + 0.012, -0.3, 0.18, { top: true });
        B.push(new THREE.Matrix4().makeTranslation(0, 0, 0.2));
        for (let f = 0; f < 3; f++) paneWin(B, st0 + (f ? 0.3 : 2.0), f * SH + (f ? 0.5 : 0.15), st1 - 0.3, f * SH + 2.6, bay(f), { frame: 'alu', depth: 0, cols: f ? 3 : 2, tr: 0.7 });
        B.unit('doorGrey', rectPts(st0 + 0.5, 0.02, st0 + 1.6, 2.2), 0.004);
        B.pop();
        for (const x of [9.5, L - 9.5]) B.boxXZ('alu', x - 0.05, x + 0.05, 0.1, yE - 0.15, 0.02, 0.12, { top: false }); }
      B.pop();
      // --- the street front: s runs west from the east corner
      B.push(frame(L, 0, -D, -1, 0));
      { const sOf = (a) => L - a, holes = [], units = [];
        const sashAt = (a, f, w = 1.0) => { const r = rectPts(sOf(a) - w / 2, f * SH + 0.95, sOf(a) + w / 2, f * SH + 2.5); holes.push(r); units.push(['sash', r, bay(f)]); };
        const bays = [2.7, 8.0, 13.3, 20.2, 25.6], doors = [5.3, 10.6, 15.25, 16.6];
        for (const a of bays) sashAt(a, 2);
        for (const a of [5.3, 10.6, 22.9]) for (let f = 1; f < 3; f++) sashAt(a, f, 0.9);
        sashAt(22.9, 0, 0.9); sashAt(16.6, 2, 0.8); sashAt(16.6, 1, 0.8);
        for (const a of doors) { const r = rectPts(sOf(a) - 0.5, 0.02, sOf(a) + 0.5, 2.25); holes.push(r); units.push(['doorDark', r, [0, 0]]); }
        B.face('buff', rectPts(0, 0, L, yE), holes);
        for (const [k, r, bb] of units) { B.reveal('buff', r, 0, -0.12, k === 'doorDark'); B.unit(k, r, -0.11, bb); if (k === 'sash') B.box('stoneDress', (r[0][0] + r[2][0]) / 2, r[0][1] - 0.07, 0.07, r[2][0] - r[0][0] + 0.2, 0.1, 0.12, 0, { bottom: true }); }      // (a stone sill, wholly in front of the wall)
        // the two-storey bays (drawn square: the real ones are canted), a stone band and a lead flat on each
        for (const a of bays) {
          const c = sOf(a), yb = 2 * SH - 0.1;
          B.boxXZ('buff', c - 1.3, c + 1.3, 0, yb, 0.02, 0.8, { top: false });
          B.boxXZ('stoneDress', c - 1.36, c + 1.36, yb, yb + 0.16, 0.0, 0.86, { bottom: true });
          B.boxXZ('lead', c - 1.3, c + 1.3, yb + 0.16, yb + 0.3, 0.02, 0.8);
          B.push(new THREE.Matrix4().makeTranslation(0, 0, 0.81));
          for (let f = 0; f < 2; f++) B.unit('sash', rectPts(c - 0.6, f * SH + 0.9, c + 0.6, f * SH + 2.5), 0, bay(f));
          B.pop();
        } }
      B.pop();
      // --- the gables: the older red-brown brick to the west, buff to the east; one window to each storey
      for (const [key, F] of [['redBrick', frame(0, 0, -D, 0, 1)], ['buff', frame(L, 0, 0, 0, -1)]]) {
        B.push(F);
        wall(key, [[0, 0], [D, 0], [D, yE], [D / 2, yR - 0.12], [0, yE]], [0, 1, 2].map((f) => [D * 0.62 - 0.8, f * SH + 0.95, D * 0.62 + 0.8, f * SH + 2.45, f]));
        B.pop();
      }
      // --- the slate roof, the four zinc dormers on its quad side, the terrace's two stacks
      const ov = 0.35, dy = (ov * (yR - yE)) / (D / 2);
      B.poly('slate', [[-0.2, yE - dy, ov], [L + 0.2, yE - dy, ov], [L + 0.2, yR, -D / 2], [-0.2, yR, -D / 2]], [0, 1, 1]);
      B.poly('slate', [[L + 0.2, yE - dy, -D - ov], [-0.2, yE - dy, -D - ov], [-0.2, yR, -D / 2], [L + 0.2, yR, -D / 2]], [0, 1, -1]);
      for (const z of [ov, -D - ov]) B.boxXZ('alu', -0.2, L + 0.2, yE - dy - 0.13, yE - dy - 0.01, Math.min(z, z - Math.sign(z) * 0.4), Math.max(z, z - Math.sign(z) * 0.4), { bottom: true });      // gutters / eaves boards
      for (const c of [3.0, 7.9, L - 7.9, L - 3.0]) {
        B.boxXZ('grey', c - 2.1, c + 2.1, yE + 0.25, yR - 0.55, -D / 2 + 0.6, -0.9);
        B.boxXZ('alu', c - 2.2, c + 2.2, yR - 0.55, yR - 0.47, -D / 2 + 0.5, -0.8, { bottom: true });
        B.push(frame(c - 2.1, 0, -0.88, 1, 0)); paneWin(B, 0.5, yE + 0.75, 3.7, yR - 0.8, bay(3), { frame: 'alu', depth: 0, cols: 4 }); B.pop();
      }
      for (const a of [7.4, 15.9]) { B.boxXZ('buff', a - 0.5, a + 0.5, yR - 0.9, yR + 1.3, -D / 2 - 0.35, -D / 2 + 0.35); B.boxXZ('stoneDress', a - 0.57, a + 0.57, yR + 1.3, yR + 1.44, -D / 2 - 0.42, -D / 2 + 0.42, { bottom: true }); }
      B.pop();

      const mb = game.map && game.map.buildings && game.map.buildings.find((x) => x.id === ST24_ID);
      col.addPolygon(mb ? mb.poly : [P.pt(0, 0), P.pt(L, 0), P.pt(L, -D), P.pt(0, -D)], { tag: 'building' });
      // the gap between the MCR and Staircase 24: a boarded timber fence (the college's photograph of the west gable)
      const a = [-352.06, -123.58], b = P.pt(0.05, -0.6), l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      B.push(frame(a[0], 0, a[1], b[0] - a[0], b[1] - a[1])); B.boxXZ('wood', 0.02, l - 0.02, 0, 1.85, -0.05, 0.05); B.pop();
      seg(a, b, 'wall', { h: 1.85 });
    }

    // ================================================================= before the Sainsbury Building: steps, walls, the low bay
    {
      const T = TERR, PS = SB_PASSAGE, rise = T.y / T.n, go = (T.foot - T.land) / T.n, b0 = PS.b0, b1 = PS.b1, FA = 31.3;      // (FA: the lower wing's east face)
      B.push(SBF.mat());
      // the landing before the passage's mouth, the seven steps down to the court; the same again on the lake side (G)
      B.boxXZ('pavingSolid', FA + 0.02, T.land, 0, T.y, b0, b1);
      for (let i = 0; i < T.n; i++) B.boxXZ('pavingSolid', T.foot - (i + 1) * go, T.foot - i * go, 0, (i + 1) * rise - (i === T.n - 1 ? 0.004 : 0), b0, b1);
      const gw = (T.w0 - T.wFoot) / T.n;
      if (!SBR) for (let i = 0; i < T.n; i++) B.boxXZ('pavingSolid', T.wFoot + i * gw, T.wFoot + (i + 1) * gw, 0, (i + 1) * rise - 0.004, b0, b1);
      // the cheek walls with a black handrail on each
      for (const [s, bb] of [[-1, b0], [1, b1]]) {
        B.boxXZ('buff', FA + 0.02, T.foot + 0.15, 0, T.wallH + (s > 0 ? 0.008 : 0), s < 0 ? bb - 0.3 : bb, s < 0 ? bb : bb + 0.3);
        B.beam('iron', [T.foot - 0.1, 1.0, bb - s * 0.09], [T.land, T.y + 1.0, bb - s * 0.09], 0.04);
        if (SBR) continue;
        B.beam('iron', [T.w0 - 0.1, T.y + 0.95, bb - s * 0.06], [T.wFoot + 0.1, 0.95, bb - s * 0.06], 0.04);
        for (const a of [T.w0 - 0.15, T.wFoot + 0.15]) B.boxXZ('iron', a - 0.02, a + 0.02, 0, (a > T.w0 - 0.5 ? T.y : 0) + 0.93, bb - s * 0.08, bb - s * 0.04, { top: false });
      }
      // north of the steps: the brick wall along the court, a planted bed behind it, the single-storey bay with its
      // lead-clad parapet and roof planting, a black corner window (drawn square: the real one is a prism)
      B.boxXZ('buff', T.wallA - 0.15, T.wallA + 0.15, 0, T.wallH - 0.01, T.wallB, b0 - 0.3);
      B.boxXZ('buff', 35.42, T.wallA - 0.15, 0, T.wallH - 0.02, T.wallB, T.wallB + 0.3);
      B.boxXZ('leafC', 35.42, T.wallA - 0.15, 0, 1.55, T.wallB + 0.3, T.bay[2] - 0.1);
      B.boxXZ('leafC', SBR ? 31.62 : T.bay[1], T.wallA - 0.15, 0, 1.6, T.bay[2] - 0.1, b0 - 0.3);
      if (!SBR) { const [a0, a1, c0, c1, h] = T.bay;
        B.boxXZ('buff', a0, a1, 0, h, c0, c1 - 0.02, { top: false });
        B.boxXZ('lead', a0, a1 + 0.12, h, h + 0.45, c0 - 0.06, c1 + 0.03);
        B.boxXZ('leafC', a0 + 0.4, a1 - 0.3, h + 0.45, h + 0.57, c0 + 0.4, c1 - 0.5);
        B.push(frame(a1 + 0.02, 0, c1 - 0.4, 0, -1)); paneWin(B, 0, 1.7, 1.5, 2.55, bay(0), { frame: 'frame', depth: 0, cols: 1, bar: 0.07 }); B.pop(); }
      // south of the steps: a low brick wall with a bed behind it and a black timber fence
      if (!SBR) { B.boxXZ('buff', T.lowA - 0.12, T.lowA + 0.12, 0, T.lowH, b1 + 0.3, T.lowB);
      B.boxXZ('buff', FA + 0.02, T.lowA - 0.12, 0, T.lowH - 0.01, T.lowB - 0.24, T.lowB);
      B.boxXZ('leafC', FA + 0.02, T.lowA - 0.12, 0, T.lowH - 0.15, b1 + 0.3, T.lowB - 0.24);
      B.boxXZ('frame', 33.0, 33.06, T.lowH - 0.15, 1.95, b1 + 0.3, T.lowB - 0.24); }
      B.pop();
      const W = (a, b) => SBF.pt(a, b);
      seg(W(FA, b0 - 0.15), W(T.foot + 0.15, b0 - 0.15), 'wall', { h: T.wallH }); seg(W(FA, b1 + 0.15), W(T.foot + 0.15, b1 + 0.15), 'wall', { h: T.wallH });
      seg(W(T.wallA, T.wallB), W(T.wallA, b0 - 0.15), 'wall', { h: T.wallH }); seg(W(35.4, T.wallB), W(T.wallA, T.wallB), 'wall', { h: T.wallH });
      if (!SBR) { seg(W(T.lowA, b1 + 0.15), W(T.lowA, T.lowB), 'wall', { h: T.lowH }); seg(W(FA, T.lowB), W(T.lowA, T.lowB), 'wall', { h: T.lowH });
        seg(W(T.wFoot, b0 - 0.05), W(T.w0 - 0.3, b0 - 0.05), 'wall', { h: 1 }); seg(W(T.wFoot, b1 + 0.05), W(T.w0 - 0.3, b1 + 0.05), 'wall', { h: 1 }); }
      const prev = world.groundHeight.bind(world);
      world.groundHeight = (x, z) => {
        if (x > -377 && x < -356 && z > -108 && z < -100.5) { const q = SBF.inv(x, z), h = terraceY(q[0], q[1]); if (h !== null) return h; }
        return prev(x, z);
      };
    }

    // ================================================================= the court
    const Yp = 0.05;
    const ring = (x, z, r, n = 20) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [x + Math.cos(t) * r, z + Math.sin(t) * r]; });
    // (a cylinder's own cap takes its UVs from world coordinates: far from the origin that is one smeared texel of the whole atlas)
    const disc = (key, x, y, z, r, n = 20) => B.poly(key, ring(x, z, r, n).map(([px, pz]) => [px, y, pz]), [0, 1, 0]);
    {
      const [W, Mi, E] = PAV;
      const court = [[-369.8, -119.7], [-370.6, -127.3], [-363.4, -127.72], [-362.96, -122.63], [-352.06, -123.58], [-347.8, -121.7], [-319.5, -124.4], [-320.0, -128.5], [-309.7, -129.8], [-308.2, -121.5],
        E.pt(E.L, 3), E.pt(0, 3), Mi.pt(Mi.L, 3), Mi.pt(0, 3), W.pt(W.L, 3), W.pt(0, 3), W.pt(0, W.D - 1.4), [-361.05, -94.9] /* (stops short of the mapped garden path's own surface) */, [-362.2, -105.6], [-363.0, -113.1], [-359.3, -113.5], [-360.1, -120.5]];
      B.flat('paving', court, Yp, BEDS.map(([x, z, r]) => ring(x, z, r + 0.02)));
      B.flat('paving', [Mi.pt(Mi.L, 3), E.pt(0, 3), E.pt(0, E.D), Mi.pt(Mi.L, Mi.D)], Yp);      // the way through to the garden
      // the line of setts along the Nash Building's side, turning in to the passage
      const line = [E.pt(15, -2.3), E.pt(0, -2.2), Mi.pt(7, -2.4), W.pt(8, -2.3), W.pt(0.5, -2.4), [-359.6, -106.6]], hw = 0.13, lft = [], rgt = [];
      for (let i = 0; i < line.length; i++) {
        const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
        lft.push([line[i][0] + nx * hw, line[i][1] + nz * hw]); rgt.push([line[i][0] - nx * hw, line[i][1] - nz * hw]);
      }
      B.flat('setts', [...lft, ...rgt.reverse()], Yp + 0.013);
    }
    // the planted circles: a stone kerb, low planting, box balls round the tree
    const ball = (x, z, r, key = 'box', n = 12) => {
      const prof = [[0, 0.66], [0.3, 0.94], [0.62, 1], [0.95, 0.9], [1.2, 0.66], [1.36, 0.34], [1.43, 0.08]];      // [height, radius] in r: a clipped dome, wider than tall
      for (let i = 0; i < prof.length - 1; i++) B.cyl(key, x, 0.08 + prof[i][0] * r * 0.78, z, prof[i + 1][1] * r, (prof[i + 1][0] - prof[i][0]) * r * 0.78, n, false, prof[i][1] * r);
      disc(key, x, 0.08 + prof[prof.length - 1][0] * r * 0.78, z, prof[prof.length - 1][1] * r, n);
    };
    const benchArcs = [];
    for (const [bi, [x, z, r]] of BEDS.entries()) {
      B.cyl('greyStone', x, 0, z, r, 0.1, 20, false, r + 0.04); disc('greyStone', x, 0.1, z, r);
      B.cyl('leafC', x, 0.1, z, r - 0.5, 0.1, 20, false, r - 0.05); disc('leafC', x, 0.2, z, r - 0.5);      // dark ground cover
      // (kept off the benches' sides of the bed, which are open to the low planting as in the photograph)
      const mine = BENCHES.filter((q) => q[0] === bi), n = bi ? 7 : 6;
      for (let k = 0; k < n; k++) {
        const t = (k / n) * Math.PI * 2 + bi * 0.4 + 0.3, rr = 0.55 + ((k * 7 + bi * 3) % 4) * 0.09, d = r - rr - 0.12 - (k % 2) * 0.35;
        if (mine.some(([, mid, half]) => Math.abs(Math.atan2(Math.sin(t - mid), Math.cos(t - mid))) < half + 0.1) && k % 2) continue;
        ball(x + Math.cos(t) * d, z + Math.sin(t) * d, rr);
      }
      for (let k = 0; k < 11; k++) { const t = k * 2.4 + bi, d = r * (0.25 + 0.6 * ((k * 5) % 7) / 7); ball(x + Math.cos(t) * d, z + Math.sin(t) * d, 0.2 + ((k * 3) % 4) * 0.05, ['leafA', 'leafB', 'leafC'][k % 3], 6); }      // perennials under the box
      col.addCircle(x, z, r - 0.05, { tag: 'planter', low: true });
    }
    // the curved benches: a slatted timber seat on dark metal legs, on the paving at the bed's edge
    for (const [bi, mid, half] of BENCHES) {
      const [x, z, r] = BEDS[bi], r0 = r + 0.1, r1 = r + 0.56, N = 7, y0 = 0.4, y1 = 0.46;
      const at = (t, rad, y) => [x + Math.cos(t) * rad, y, z + Math.sin(t) * rad];
      for (let k = 0; k < N; k++) {
        const t0 = mid - half + (2 * half * k) / N, t1 = mid - half + (2 * half * (k + 1)) / N, tm = (t0 + t1) / 2, out = [Math.cos(tm), 0, Math.sin(tm)];
        B.poly('benchTeak', [at(t0, r0, y1), at(t0, r1, y1), at(t1, r1, y1), at(t1, r0, y1)], [0, 1, 0]);
        B.poly('benchTeak', [at(t0, r0, y0), at(t0, r1, y0), at(t1, r1, y0), at(t1, r0, y0)], [0, -1, 0]);
        B.poly('benchTeak', [at(t0, r1, y0), at(t1, r1, y0), at(t1, r1, y1), at(t0, r1, y1)], out);
        B.poly('benchTeak', [at(t0, r0, y0), at(t1, r0, y0), at(t1, r0, y1), at(t0, r0, y1)], [-out[0], 0, -out[2]]);
      }
      for (const [t, sgn] of [[mid - half, -1], [mid + half, 1]]) B.poly('benchTeak', [at(t, r0, y0), at(t, r1, y0), at(t, r1, y1), at(t, r0, y1)], [-Math.sin(t) * sgn, 0, Math.cos(t) * sgn]);
      for (const f of [0.06, 0.5, 0.94]) { const t = mid - half + 2 * half * f, c = at(t, (r0 + r1) / 2, 0); B.box('iron', c[0], 0.2, c[2], 0.07, 0.4 - 0.004, 0.4, Math.PI / 2 - t, { top: false }); }
      const p0 = at(mid - half, (r0 + r1) / 2, 0), pm = at(mid, (r0 + r1) / 2, 0), p1 = at(mid + half, (r0 + r1) / 2, 0);
      seg([p0[0], p0[2]], [pm[0], pm[2]], 'furniture', { low: true }); seg([pm[0], pm[2]], [p1[0], p1[2]], 'furniture', { low: true });
      benchArcs.push({ x: pm[0], z: pm[2], h: Math.atan2(Math.cos(mid), Math.sin(mid)), ox: Math.cos(mid), oz: Math.sin(mid) });
    }
    // the cafe's tables and chairs under the west pavilion's overhang, the A-board by the last column (a blackboard: no lettering)
    {
      const P = PAV[0];
      B.push(P.mat());
      for (const [a, b] of TABLES) {
        B.cyl('alu', a, 0.7, b, 0.34, 0.03, 10, false); disc('alu', a, 0.73, b, 0.34, 10); B.cyl('iron', a, 0.02, b, 0.03, 0.68, 6, false); B.cyl('iron', a, 0, b, 0.2, 0.02, 8, false); disc('iron', a, 0.02, b, 0.2, 8);
        for (const s of [-1, 1]) {
          const ca = a + s * 0.62;
          B.boxXZ('alu', ca - 0.2, ca + 0.2, 0.43, 0.46, b - 0.2, b + 0.2, { bottom: true });
          B.boxXZ('alu', ca + s * 0.17, ca + s * 0.2, 0.46, 0.86, b - 0.2, b + 0.2);
          for (const [da, db] of [[-0.17, -0.17], [0.17, -0.17], [0.17, 0.17], [-0.17, 0.17]]) B.boxXZ('iron', ca + da - 0.012, ca + da + 0.012, 0, 0.43, b + db - 0.012, b + db + 0.012, { top: false });
          const q = P.pt(ca, b); col.addCircle(q[0], q[1], 0.27, { tag: 'furniture', low: true });
        }
        const q = P.pt(a, b); col.addCircle(q[0], q[1], 0.36, { tag: 'furniture', low: true });
      }
      { const [a, b] = ABOARD;
        for (const s of [-1, 1]) { B.push(new THREE.Matrix4().makeTranslation(a, 0, b + s * 0.2).multiply(new THREE.Matrix4().makeRotationX(-s * 0.22))); B.box('wood', 0, 0.5, 0, 0.6, 1.0, 0.03, 0, { bottom: true }); B.box('dark', 0, 0.55, s * 0.021, 0.5, 0.74, 0.012, 0, { bottom: true }); B.pop(); }
        const q = P.pt(a, b); col.addCircle(q[0], q[1], 0.38, { tag: 'furniture', low: true }); }
      B.pop();
    }

    // stray generated trees and street furniture in the court go (the two bed trees are kept: the strips step round them)
    if (world.clearArea) {
      const X = [-362, ...TREES.flatMap((t) => [t[0] - 1, t[0] + 1]).sort((a, b) => a - b), -311], Z0 = -124.4, Z1 = -107;
      const R = (x0, x1, z0, z1) => world.clearArea([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], { lamps: false });
      for (let i = 0; i < X.length - 1; i++) {
        const t = TREES.find((q) => Math.abs((X[i] + X[i + 1]) / 2 - q[0]) < 0.5);
        if (!t) R(X[i], X[i + 1], Z0, Z1); else { R(X[i], X[i + 1], Z0, t[1] - 1); R(X[i], X[i + 1], t[1] + 1, Z1); }
      }
    }
    const meshes = B.build(M, grp, { pack, noCast: new Set(['signs']) });
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);

    // ================================================================= sitting on the curved benches
    let seat = null;
    if (game.interact && game.interact.add) for (const b of benchArcs) {
      game.interact.add({ pos: [b.x, b.z], radius: 1.7, label: 'Sit on the bench', enabled: () => !seat && !game.player.vehicle, onUse: () => {
        const P = game.player; if (seat || game.activity || P.place !== 'world') return;
        seat = { b, back: { x: P.pos.x, z: P.pos.z } };
        P.pose = 'sit'; P.pos.set(b.x, 0, b.z); P.heading = b.h; P.vx = P.vz = 0; P.speed = 0; if (P.syncMesh) P.syncMesh();
        game.beginActivity({ name: 'nashbench', pointer: 'locked',
          onKey(code) { if (/^(Key[WASDEF]|Arrow|Space)/.test(code)) game.endActivity(); },
          update() { if (seat) { P.pos.set(b.x, 0, b.z); P.heading = b.h; P.vx = P.vz = 0; } },
          onEnd() {
            const s = seat; seat = null; if (!s) return;
            if (P.pose === 'sit') P.pose = 'stand';
            let x = s.back.x, z = s.back.z;
            if (col.isFree && (!col.isFree(x, z, 0.3) || Math.hypot(x - b.x, z - b.z) > 3)) { x = b.x + b.ox * 0.8; z = b.z + b.oz * 0.8; }
            P.pos.set(x, world.groundHeight(x, z), z); P.vx = P.vz = 0; P.speed = 0; if (P.syncMesh) P.syncMesh();
          } });
      } });
    }
    game.worcesterNash = { on: true, tris, meshes: meshes.length, benches: benchArcs, beds: BEDS, checked: CHECKED, terraceY: (x, z) => { const q = SBF.inv(x, z); return terraceY(q[0], q[1]); } };
    console.log(`[gto] worcester_nash: Nash Quad, ${meshes.length} meshes, ${Math.round(tris)} triangles`);
    return null;
  },
};
