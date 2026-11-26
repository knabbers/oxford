// Worcester College: the Sultan Nazrin Shah Centre, the court inside Gate 3, its two pools, the bridge and the two
// bronzes (2026-11-22; work package F of docs/research/worcester_survey.md, B21 and G09).
//
// Built from the architects' published plan, sections and elevation, the planning drawings 14/00392/FUL, twenty
// photographs, the satellite picture and the 2022 LIDAR (all under `reference/worcester/18 ...`, `37 ...`, `40 ...`;
// looked at, never copied, never a texture). What each part rests on is the CHECKED table of _snsc_plan.js
// (K = seen in a named picture or plan, G = a flagged guess).
//
//   _snsc_plan.js      frames, levels, outlines, the walkable-height function (pure; tools/smoke_snsc.mjs)
//   _snsc_building.js  the Centre: colonnade, terrace and steps, pergola, studio hood, entrance front, drum, roof
//   _snsc_site.js      court, pools' edges, deck, garden wall and gate, plinths, entrance path, bank, beds, lights
//   _snsc_figures.js   the two bronzes (plain abstract forms: not copies of the sculptures)
//   _snsc_climb.js     what can be stood on above the ground and where the walls end (core/_climb.js), and the few
//                      INVENTED things on the way to the top (listed and flagged there)
//
// LEVELS are real geometry: y 0 = the playing field = the pools' water; the court is 0.45 m up, the Centre's floor and
// terrace 1.6 m up (nine risers from the field, a 1-in-19 paved way from the court). The one thing that is NOT real is
// the fall of the paving to today's flat Gate 3 drive and north yard (_snsc_plan.js fallY: it cancels by itself once
// the terrain is on). The map's two "diamond" ponds, part of the lake's outline, become the two real pools (separate
// water areas), so the drawn water, swimming, the walkers' "not into the water" and this module's kerbs agree.
// `?wsnsc=0` (node: GTO_WSNSC=0) leaves everything as it was, for before / after pictures.
import * as THREE from 'three';
import { Batch, makePack } from './_worcester_kit.js';
import * as P from './_snsc_plan.js';
import { tools } from './_snsc_tools.js';
import { buildCentre } from './_snsc_building.js';
import { buildSite } from './_snsc_site.js';
import { buildBronzes } from './_snsc_figures.js';
import * as CL from './_snsc_climb.js';

export const CHECKED = P.CHECKED;
// mapped footways this module's own paving replaces (they stay in the walk graph)
const WAYS = ['w130668900', 'w721939489', 'w721939490', 'w721939491', 'w154769424'];
// trees [x, z, height, kind]: the birch by the garden gate, three in the bank by the entrance path, the old tree and
// two young ones in the bed at the south-east end, the plane at the north-west end, one behind the stage (all GUESSES
// as to kind and exact place; the pictures show trees there)
const TREES = [[-394.6, -123.9, 5.2], [...P.W(34.5, 25.5), 5.5], [...P.W(39.0, 25.0), 6], [...P.W(31.3, 28.6), 5], [...P.W(42.9, 4.3), 6.5], [...P.W(37.7, 2.5), 4.5], [...P.W(39.8, 6.4), 4.2], [...P.W(-9.0, 2.5), 19], [...P.W(4.5, 38.5), 15]];      // (2026-11-24: these two stood 3 and 5 m nearer and their crowns lay over the north-west roof and the stage wall; the satellite picture shows both roofs clear of the trees)
const MOORE = 'HENRY MOORE 1898–1986 · Reclining Figure, 1982 · Bronze. On loan from the Henry Moore Foundation courtesy of the Barrie and Deedee Wigmore Foundation. Please do not climb on the sculpture.';
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.35;

/** this pass's colours in the college's atlas (plain or tinted cells: nothing new is painted) and in the city's ground atlas */
function cells(pack, world) {
  const K = pack.cells, G = pack.groundCells;
  if (K && K.get('stone') && !K.get('snscStone')) {
    const ash = K.get('stone'), flags = K.get('pavingSolid'), plain = K.get('plaster'), boards = K.get('boards'), sash = K.get('sash');
    K.set('snscStone', { ...ash, tint: [1.2, 1.23, 1.28], seed: 0 });       // Clipsham limestone: paler and cooler than the college's Headington / Bath stone
    K.set('snscSoffit', { ...ash, tint: [1.46, 1.48, 1.52], seed: 0 });      // the sloping soffits never see the sun: lit by the ground
    K.set('snscStep', { ...flags, tint: [1.32, 1.3, 1.24] });
    K.set('snscPave', { ...flags, tint: [1.24, 1.17, 1.0] });                // the court's buff slabs
    K.set('snscDeck', { ...boards, tint: lin(0x9c9388) });
    K.set('snscOak', { ...boards, tint: lin(0xd8b485) });
    K.set('snscTimber', { ...plain, tint: lin(0xd9bea8) });                  // the pergola: pale, pinkish limed timber with a long grain (the photograph under it), not the boarding's oak
    K.set('snscBrick', { ...K.get('slate'), rx: 1 / 1.6, ry: 1 / 1.6, tint: [0.82, 0.86, 0.96] });      // dark blue-grey brick in 100 mm courses (the slate cell's half bond, smaller)
    K.set('snscBronze', { ...plain, tint: lin(0xa27e3e) });
    K.set('snscCorten', { ...plain, tint: lin(0x8a4b2a) });
    K.set('snscLily', { ...plain, tint: lin(0x5f8f3e) });
    K.set('snscCone', { ...plain, tint: lin(0xe2581a) }); K.set('snscFlag', { ...plain, tint: lin(0xb3202a) }); K.set('snscDrum', { ...plain, tint: lin(0x2d5c9c) });      // (_snsc_climb.js I4)
    K.set('snscGlass', { ...sash, alt: sash.cell, p: 0, tint: [0.46, 0.62, 0.6] });            // dark blue-green mirror glass
  }
  if (G && !G.get('snscPaveG') && world.tex && world.tex.cells && world.tex.cells.ground) {
    const mk = (key, kind, layer, tint = [1, 1, 1]) => { const ci = world.tex.cells.ground[kind]; if (ci === undefined) return; const s = ((world.tex.ground(kind) || {}).userData || {}).scale || 3; G.set(key, { cell: ci, rx: 1 / s, ry: 1 / s, ox: 0, oy: 0, tint, layer, seed: 0 }); };
    mk('snscPaveG', 'paving', 8, [1.36, 1.24, 1.0]); mk('snscSpur', 'paving', 9, [1.36, 1.24, 1.0]); mk('snscTarmac', 'asphalt', 8.2); mk('snscGravel', 'gravel', 7.6); mk('snscBed', 'flowerbed', 4);
  }
}

export default {
  id: 'worcester_snsc',
  preMap(game) {
    if (!P.ON) return;
    try {
      const ov = game.overrides, map = game.map;
      game.worcesterSnsc = { on: true, court: true };      // (places/worcester.js: the old court inside Gate 3 is not drawn under this one)
      ov.skip.add(P.IDS.main); ov.skip.add(P.IDS.drum);
      for (const id of WAYS) ov.skip.add(id);
      if (!map) return;
      // the lake's outline ends at the head of its north arm; the two ponds beyond become the real pools
      const lake = map.areas && map.areas.find((a) => a.id === P.IDS.lake);
      if (lake && lake.poly && !map.areas.some((a) => a.id === 'worc_snsc_pool1')) {
        const i0 = lake.poly.findIndex((p) => near(p, P.CHANNEL[1])), i1 = lake.poly.findIndex((p) => near(p, P.CHANNEL[0]));
        if (i0 >= 0 && i1 > i0 + 1) lake.poly.splice(i0 + 1, i1 - i0 - 1);
        else if (i1 >= 0 && i0 > i1 + 1) lake.poly.splice(i1 + 1, i0 - i1 - 1);
        map.areas.push({ id: 'worc_snsc_pool1', kind: 'water', name: 'Sultan Nazrin Shah Centre pool', poly: P.POOL1.map((p) => p.slice()) }, { id: 'worc_snsc_pool2', kind: 'water', name: 'Sainsbury Courtyard pool', poly: P.POOL2.map((p) => p.slice()) });
      }
      if (map.trees) for (const t of TREES) map.trees.push([t[0], t[1], t[2], 'broad']);
      // the mapped way from the court to the entrance cut the pool's corner: it goes round it, up the paved path
      const r = map.roads && map.roads.find((x) => x.id === 'w721939491');
      if (r && r.pts && r.pts.length >= 2) r.pts = [r.pts[0], [-393.4, -139.4], ...r.pts.slice(1)];
    } catch (e) { console.error('[worcester_snsc] preMap', e); }
  },
  install(game) {
    if (!P.ON) return null;
    const world = game.world, col = game.worldCollider;
    // the terrain, once it is the real ground: the paving's flagged fall follows it instead (see _snsc_plan.js)
    let onTerrain = false;
    try { if (typeof world.terrainHeight === 'function') onTerrain = P.setTerrain((x, z) => world.terrainHeight(x, z)); } catch (e) { /* flat world */ }
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    cells(pack, world);
    const B = new Batch(), T = tools(B);
    const grp = new THREE.Group(); grp.name = 'worcester-snsc';
    world.addStatic(grp);
    buildCentre(T, B);
    if (CL.CLIMB_ON) CL.drawClimb(T, B);
    const site = buildSite(T, B);
    const meshes = B.build({ _pack: pack }, grp, { pack });
    const M = P.PLINTH, fy = P.Y.court;
    const bronze = buildBronzes({ x: M.c[0], y: fy + M.h, z: M.c[1], ux: M.u[0], uz: M.u[1] }, { x: P.FRINK.c[0], y: fy + P.FRINK.h, z: P.FRINK.c[1], h: 0.1 + Math.PI, s: P.FRINK.s });
    grp.add(bronze); meshes.push(bronze);
    const tris = meshes.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);

    // ================================================================= colliders: what is drawn is what is solid
    const circle = (p, r, o) => col.addCircle(p[0], p[1], r, o), seg = (p, q, o) => col.addSegment(p[0], p[1], q[0], q[1], o);
    // (each shape with the height it stands to: tall [shape, top] goes to core/_climb.js, for which a wall is a wall only to a body beside it)
    const tall = [], T2 = (s, top) => { if (s) tall.push([s, top]); return s; }, PAR = P.Y.parapet;
    if (CL.CLIMB_ON) for (const [p, q, top] of CL.walls()) { const g = seg(P.W(p[0], p[1]), P.W(q[0], q[1]), { tag: 'building' }); if (g) { g.h = top; T2(g, top); } }
    else for (const s of P.solids()) { const segs = col.addPolygon(s.map((p) => P.W(p[0], p[1])), { tag: 'building' }); if (segs) for (const g of segs) g.h = PAR; }
    for (let i = 4; i <= 8; i++) { T2(circle(P.W(P.pierA(i), 0.3), 0.22, { tag: 'building' }), PAR); T2(circle(P.W(P.pierA(i), 0.92), 0.32, { tag: 'building' }), PAR); }      // the free piers of the terrace
    // the handrails (in short pieces, each as high as the rail is there less a hand's width: it can be got onto and walked up)
    for (const [a, b0, y0, b1, y1] of CL.rails()) {
      if (!CL.CLIMB_ON) { seg(P.W(a, P.TERR.s0 + 0.1), P.W(a, P.TERR.top + 0.4), { tag: 'furniture', low: true }); continue; }
      const lo = P.TERR.s0 + 0.1, hi = P.TERR.top + 0.4, n = 6, ry = (b) => y0 + (y1 - y0) * (b - b0) / (b1 - b0);
      for (let k = 0; k < n; k++) { const u = lo + (hi - lo) * k / n, v = lo + (hi - lo) * (k + 1) / n; T2(seg(P.W(a, u), P.W(a, v), { tag: 'furniture', low: true }), ry(u) - 0.25); }
    }
    for (const i of [1, 10]) { const c = (P.pierA(i) + P.pierA(i + 1)) / 2; T2(seg(P.W(c - 0.85, 0.66), P.W(c + 0.85, 0.66), { tag: 'furniture', low: true }), 0.9); }
    if (CL.CLIMB_ON) { const s = CL.STACK, y = P.Y.floor + s.h; for (const [u, v] of [[[s.a0, s.b0], [s.a1, s.b0]], [[s.a0, s.b0], [s.a0, s.b1]], [[s.a1, s.b0], [s.a1, s.b1]]]) T2(seg(P.W(u[0], u[1]), P.W(v[0], v[1]), { tag: 'furniture', low: true }), y); }      // (_snsc_climb.js I1: the joists taken down)
    seg(P.W(P.RAMP.walkA + 0.15, 30.6), P.W(P.RAMP.walkA + 0.15, P.RAMP.walkB + 0.15), { tag: 'wall', low: true }); seg(P.W(P.ENTR.glass, P.RAMP.walkB + 0.15), P.W(P.RAMP.walkA + 0.15, P.RAMP.walkB + 0.15), { tag: 'wall', low: true });
    for (const [p, q] of [P.WALL, P.WALL_STUB]) seg(p, q, { tag: 'wall', h: 1.95 });
    seg(P.GATE.w, P.GATE.e, { tag: 'gate' });      // (shut: the garden beyond is the Sainsbury Building's)
    circle(P.GATE.w, 0.4, { tag: 'wall' }); circle(P.GATE.e, 0.4, { tag: 'wall' });
    seg(P.POOL2[2], P.POOL2[3], { tag: 'wall', low: true, top: P.Y.court });
    { const u = M.u, n = [-u[1], u[0]], c = (s, t) => [M.c[0] + u[0] * s + n[0] * t, M.c[1] + u[1] * s + n[1] * t];
      const sg = col.addPolygon([c(-M.hl, -M.hw), c(M.hl, -M.hw), c(M.hl, M.hw), c(-M.hl, M.hw)], { tag: 'furniture' }); if (sg) for (const g of sg) g.h = M.h; }
    circle(P.FRINK.c, 0.5, { tag: 'furniture' });
    for (const [x, z, r] of site.planters) col.addCircle(x, z, r, { tag: 'planter', low: true });
    for (const [x, , z] of site.lamps) col.addCircle(x, z, 0.1, { tag: 'furniture', low: true });

    // ================================================================= above the ground: roofs, timbers, wall heads (core/_climb.js)
    let climb = null;
    if (CL.CLIMB_ON) { try { climb = CL.installClimb(game, tall); } catch (e) { console.error('[worcester_snsc] climb', e); } }

    // ================================================================= walkable heights (terrace, steps, ramp, court, deck)
    const prev = world.groundHeight.bind(world);
    world.groundHeight = (x, z) => { if (x > -452 && x < -362 && z > -190 && z < -116) { const h = P.groundY(x, z); if (h !== null) return h; } return prev(x, z); };

    // stray generated trees, lamps and benches where the building and the paving now are
    if (world.clearArea) for (const poly of [P.roofOutline().pts.map((p) => P.W(p[0], p[1])), P.SQUARE, P.COURT_W, P.COURT_S, P.COURT_E, P.YARD_N, P.PATH, P.WALK, P.DECK, P.POOL1, P.POOL2, [...P.WPATH.n, ...P.WPATH.s.slice().reverse()]]) { try { world.clearArea(poly); } catch (e) { /* */ } }

    // (_snsc_climb.js I6, an adjustment: the generated trees within some six metres of the stage wall and of the north wall
    //  are taken out, so that a body on the wall heads is not inside a crown; the satellite picture has crowns meeting the wall there)
    if (CL.CLIMB_ON && world.clearArea) { try { world.clearArea([[-6.5, 17.5], [-6.5, 30], [1, 34.5], [15.5, 34.5], [15.5, 24.6], [9, 25], [3, 19.2]].map((p) => P.W(p[0], p[1])), { furniture: false, lamps: false }); } catch (e) { /* */ } }

    // the label on the Moore's plinth
    if (game.interact && game.interact.add) { const lp = [M.c[0] - M.u[0] * 1.0 + M.u[1] * 1.3, M.c[1] - M.u[1] * 1.0 - M.u[0] * 1.3]; game.interact.add({ pos: lp, radius: 1.5, label: 'Read the label', onUse: () => { if (game.ui && game.ui.toast) game.ui.toast(MOORE, 9); } }); }

    game.worcesterSnsc = { on: true, court: true, tris, meshes: meshes.length, onTerrain, climb, climbPlan: CL.CLIMB_ON ? CL : null, plan: P, groundY: P.groundY, checked: CHECKED, group: grp, join: { lake: P.CHANNEL } };
    console.log(`[gto] worcester_snsc: Sultan Nazrin Shah Centre, court and pools, ${meshes.length} meshes, ${Math.round(tris)} triangles${onTerrain ? ' (on the terrain)' : ''}`);
    // nothing here moves: the one job per frame is not to draw it from the far side of the college
    const pp = game.player.pos; let vis = true;
    return { id: 'worcester_snsc', update() { const e = game.eye || pp, dx = e.x - -420, dz = e.z - -150, show = dx * dx + dz * dz < 650 * 650; if (show !== vis) { vis = show; grp.visible = show; } } };
  },
};
