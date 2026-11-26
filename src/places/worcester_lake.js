// Worcester College, the lake (2026-11-22; work package H of docs/research/worcester_survey.md, G07): its outline with
// the map's generalised corners rounded; the Mildred Allen Bridge (2005) over the south arm, a humped timber span with
// X-lattice parapets; the weir east of it with the upper pool behind, the water really 0.42 m higher there; the stone
// kerb along the south-west side with the gravel walk directly behind it; the old 16th-century gateway on that walk, a
// free-standing length of rubble wall with an ashlar four-centred arch and a dark iron gate leaf standing open; at
// the head of the lake the slab walk between two tall stone piers and the Sainsbury weir (a formal channel, two pools
// with cross-weirs, raised beds with stone copings, the old rubble wall with its doorway); a plank bridge to the
// island (a flagged guess); three stone seats on the west side that can be sat on.
//
//   _wlake_plan.js    outlines, frames, levels (LV), TEMPORARY (what stands in for the missing banks until the terrain
//                     is drawn), CHECKED (K = seen in a named picture, G = guess); pure (tools/smoke_worc_lake.mjs)
//   _wlake_build.js   what is drawn, in the college's atlas
//
// SOURCES (looked at, never copied or used as textures; local `reference/worcester/`): `35 lake bridges and island`
// (30 photographs, two plans), `38 walls gates and old gateways`, the satellite pictures S3, S13 and of the island,
// the 2022 height survey. The birds, the reeds, the trees and "[E] Feed the ducks" are places/worcester_grounds.js's
// as before: it reads the outline this module leaves in the map and keeps its planting off what stands here
// (game.worcesterLake.keep / .hard). `?wlake=0` (node: GTO_WLAKE=0) = the lake as it was.
import * as THREE from 'three';
import { Batch, makePack } from './_worcester_kit.js';
import * as P from './_wlake_plan.js';
import { cells, buildLake, upperWater } from './_wlake_build.js';
import { groundsPlants } from './_wgard_plants.js';

export const CHECKED = P.CHECKED, TEMPORARY = P.TEMPORARY;
const SHAH_CHANNEL = [[-399.1, -120.3], [-401.4, -119.7]];      // (places/_snsc_plan.js CHANNEL: where the Shah Centre's pool ends and the lake begins)

export default {
  id: 'worcester_lake',
  preMap(game) {
    if (!P.ON || game.worcesterLake) return;      // (places/worcester_gardens.js calls this first if it loads before us)
    try {
      const ov = game.overrides, map = game.map; if (!map || !map.areas) return;
      const lake = map.areas.find((a) => a.id === P.IDS.lake); if (!lake || !lake.poly) return;
      const lay = P.lakeRing(lake.poly.map((p) => p.slice())); if (!lay) { console.warn('[worcester_lake] the mapped outline is not the one this was drawn for: left alone'); return; }
      lake.poly = lay.ring.map((p) => p.slice());
      // the two bridges and the slab walk are drawn here (they stay in the walk graph and stay walkable over the water)
      for (const id of [P.IDS.bridgeA, P.IDS.walkC, P.IDS.bridgeD]) { ov.skip.add(id); const r = map.roads && map.roads.find((x) => x.id === id); if (r) r.noParapet = true; }
      // the lakeside path: through the old gateway, then directly behind the kerb
      const path = map.roads && map.roads.find((x) => x.id === P.IDS.path);
      if (path && path.pts) path.pts = P.reroutePath(path.pts.map((q) => q.slice()), lay.walk);
      // the old Orchard wall: an opening where the slab walk meets it (the tour route; the map draws it unbroken)
      const wall = map.barriers && map.barriers.find((b) => b.id === P.IDS.orchardWall), cut = wall && wall.pts ? P.cutWall(wall.pts.map((q) => q.slice())) : null;
      let jambs = null;
      if (cut) { ov.skip.add(wall.id); cut.forEach((pts, k) => { if (pts.length >= 2) map.barriers.push({ ...wall, id: wall.id + ':' + 'abc'[k], pts }); }); jambs = [cut[0][cut[0].length - 1], cut[1][0]].filter(Boolean); if (cut[2]) { const a = cut[1][cut[1].length - 1], b = cut[2][0]; jambs.push(a, b); jambs.head = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(b[0] - a[0], b[1] - a[1])]; } }
      // nothing wild grows where something is built (systems/_flora_plan.js leaves a skipped area alone)
      if (!map.areas.some((a) => a.id === 'worc:site-lake-0')) {
        const S = P.SW, G = P.GATEWAY, R = P.BRIDGE, sites = [[S.W(-2.2, -0.2), S.W(17.2, -0.2), S.W(17.2, 8.3), S.W(-2.2, 8.3)], [[-331.9, 26.3], [-319.5, 27.6], [-319.4, 36.6], [-331.9, 36.6]],
          [G.F.pt(-0.6, -1.3), G.F.pt(G.len + 0.6, -1.3), G.F.pt(G.len + 0.6, 1.9), G.F.pt(-0.6, 1.9)], [R.F.pt(-P.RAMP, -2.6), R.F.pt(R.L + P.RAMP, -2.6), R.F.pt(R.L + P.RAMP, 2.6), R.F.pt(-P.RAMP, 2.6)]];
        for (const k of lay.kerbs) for (let i = 0; i < k.length - 1; i++) { const a = k[i], b = k[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [(-(b[1] - a[1]) / l) * 1.3, ((b[0] - a[0]) / l) * 1.3], e = [((b[0] - a[0]) / l) * 0.4, ((b[1] - a[1]) / l) * 0.4]; sites.push([[a[0] - e[0] + n[0], a[1] - e[1] + n[1]], [b[0] + e[0] + n[0], b[1] + e[1] + n[1]], [b[0] + e[0] - n[0], b[1] + e[1] - n[1]], [a[0] - e[0] - n[0], a[1] - e[1] - n[1]]]); }
        sites.forEach((poly, i) => { map.areas.unshift({ id: 'worc:site-lake-' + i, kind: 'paved', poly }); ov.skip.add('worc:site-lake-' + i); });
      }
      const hard = (x, z) => lay.kerbs.some((k) => P.dRing(x, z, k, false) < 1.3);
      const keep = (x, z) => P.keepOff(x, z) || lay.benches.some((b) => Math.hypot(x - b[0], z - b[1]) < 2.4) || lay.kerbs.some((k) => P.dRing(x, z, k, false) < 1.1);
      game.worcesterLake = { on: true, layout: lay, keep, hard, jambs };
    } catch (e) { console.error('[worcester_lake] preMap', e); }
  },
  install(game) {
    const L = game.worcesterLake; if (!P.ON || !L || !L.layout) return null;
    const world = game.world, col = game.worldCollider, map = game.map, lay = L.layout;
    const lake = map.areas.find((a) => a.id === P.IDS.lake), ring = lake.poly;      // (as it is now: the Shah Centre's module has taken its two ponds out)
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    cells(pack);
    const B = new Batch(), grp = new THREE.Group(); grp.name = 'worcester-lake';
    world.addStatic(grp);
    const WP = groundsPlants(game), plants0 = WP.PL.tris();      // (the planting: cards and leaf volumes, in the grounds' shared set)
    const { built, out } = buildLake(B, lay, ring, { channel: SHAH_CHANNEL, jambs: L.jambs, PL: WP.PL });
    WP.finish(world);
    // (three chunks, so that the south arm is not drawn from the head of the lake and the other way round)
    const meshes = B.build({ _pack: pack }, grp, { pack, chunk: (x, z) => (z > 10 ? (x > -380 ? 0 : 1) : 2) });
    let pool = null;
    try { pool = upperWater(world.mats.water); grp.add(pool); meshes.push(pool); } catch (e) { console.error('[worcester_lake] upper pool', e); }
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);

    // ================================================================= colliders: what is drawn is what is solid
    const seg = (p, q, o) => col.addSegment(p[0], p[1], q[0], q[1], o);
    { const R = P.BRIDGE, F = R.F, b = R.L / R.bays;      // the bridge's parapets, with their splayed ends and the ramps' edges
      for (const e of [-1, 1]) { const pts = [[-P.RAMP, R.hw + 0.25], [0, R.out(0)], [b, R.out(b)], [R.L - b, R.out(R.L - b)], [R.L, R.out(R.L)], [R.L + P.RAMP, R.hw + 0.25]].map(([s, t]) => F.pt(s, e * t)); for (let i = 1; i < 4; i++) seg(pts[i], pts[i + 1], { tag: 'railing', low: true }); } }
    { const W = P.WEIR, U = P.UPPER, x0 = W.x - W.t / 2;      // the upper pool: nobody walks or swims into it (its water is not the lake's)
      seg([x0, W.zN - 0.5], [x0, W.zS + 0.5], { tag: 'wall', h: 0.5 });
      for (let i = 0; i < U.length - 1; i++) seg(U[i], U[i + 1], { tag: i === 4 ? 'wall' : 'bank', low: true, h: i === 4 ? 1.6 : 0 }); }
    { const G = P.GATEWAY, F = G.F, a = G.cx - G.open / 2, b = G.cx + G.open / 2, z = G.th / 2 + 0.06;      // the gateway: two lengths of wall, the open leaf
      for (const [x0, x1] of [[0, a], [b, G.len]]) { const sg = col.addPolygon([F.pt(x0, -z - 0.06), F.pt(x1, -z - 0.06), F.pt(x1, z), F.pt(x0, z)], { tag: 'wall' }); if (sg) for (const s of sg) s.h = G.h; }
      { const x0 = G.cx + 0.8, x1 = G.cx + 1.85; col.addPolygon([F.pt(x0, z), F.pt(x1, z), F.pt(x1, z + 0.3), F.pt(x0, z + 0.3)], { tag: 'wall' }); }
      const h0 = F.pt(b - 0.03, G.th / 2 + 0.05), h1 = F.pt(b - 0.03 + Math.sin(G.leafAng) * G.leaf, G.th / 2 + 0.05 + Math.cos(G.leafAng) * G.leaf); seg(h0, h1, { tag: 'gate', low: true }); }
    { const S = P.SW, W = S.W, sw = out['Sainsbury weir and slab walk'] || {};      // the head of the lake
      for (const R of [P.BEDS.north, P.BEDS.south]) col.addPolygon(R.map((q) => W(q[0], q[1])), { tag: 'planter', low: true });
      const sg = seg(W(2.45, S.wall + 0.25), W(S.wallEnd, S.wall + 0.25), { tag: 'wall' }); if (sg) sg.h = S.wallH;
      seg(W(S.wallEnd, S.wall), W(S.wallEnd, S.wall + 0.5), { tag: 'wall' });
      for (const p of sw.piers || []) col.addCircle(p[0], p[1], 0.42, { tag: 'wall' });
      if (sw.posts) seg(sw.posts[0], sw.posts[sw.posts.length - 1], { tag: 'railing', low: true });
      if (sw.leaf) seg(sw.leaf[0], sw.leaf[1], { tag: 'gate', low: true }); }
    { const I = P.ISLAND_BRIDGE, l = Math.hypot(I.b[0] - I.a[0], I.b[1] - I.a[1]), u = [(I.b[0] - I.a[0]) / l, (I.b[1] - I.a[1]) / l], n = [-u[1] * I.w / 2, u[0] * I.w / 2];
      seg([I.a[0] + n[0], I.a[1] + n[1]], [I.b[0] + n[0], I.b[1] + n[1]], { tag: 'railing', low: true }); }
    const seats = [];
    for (const [x, z, h] of lay.benches) {
      col.addBox(x, z, 1.7, 0.55, h, { tag: 'furniture', low: true });
      const rec = { x, z, y: 0, h, kind: 'bench', set: null, i: -1, it: { gone: false, taken: false }, stone: true }; seats.push(rec);
      // (the world's own benches are found by the sitting system; these are not its furniture, so they ask it themselves)
      if (game.interact && game.interact.add) game.interact.add({ pos: [x + Math.sin(h) * 0.5, z + Math.cos(h) * 0.5], radius: 1.7, label: 'Sit down', enabled: () => !!(game.sitting && game.sitting.sit && !game.sitting.seated && !game.activity), onUse: () => { try { game.sitting.sit(rec); } catch (e) { /* */ } } });
    }

    // ================================================================= walkable heights: the humped deck, the walk, the planks
    const prev = world.groundHeight.bind(world);
    world.groundHeight = (x, z) => { if (x > -390 && x < -319 && z > -96 && z < 39) { const h = P.groundY(x, z); if (h !== null) return h; } return prev(x, z); };

    // generated trees, lamps and benches where something now stands
    if (world.clearArea) {
      const F = P.GATEWAY.F, G = P.GATEWAY, R = P.BRIDGE, S = P.SW;
      const polys = [[F.pt(-1, -1.6), F.pt(G.len + 1, -1.6), F.pt(G.len + 1, 1.8), F.pt(-1, 1.8)], [[-331.8, 26.4], [-319.4, 27.6], [-319.2, 36.6], [-331.8, 36.6]],
        [R.F.pt(-P.RAMP, -2.6), R.F.pt(R.L + P.RAMP, -2.6), R.F.pt(R.L + P.RAMP, 2.6), R.F.pt(-P.RAMP, 2.6)], [S.W(-3.4, -1.5), S.W(17.5, -0.2), S.W(17.5, 8.4), S.W(-3.4, 8.4)],
        ...lay.benches.map(([x, z]) => [[x - 1.5, z - 1.5], [x + 1.5, z - 1.5], [x + 1.5, z + 1.5], [x - 1.5, z + 1.5]])];
      for (const k of lay.kerbs) for (let i = 0; i < k.length - 1; i++) { const a = k[i], b = k[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [(-(b[1] - a[1]) / l) * 1.0, ((b[0] - a[0]) / l) * 1.0]; polys.push([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]]); }
      for (const p of polys) { try { world.clearArea(p); } catch (e) { /* */ } }
    }

    Object.assign(L, { tris, meshes: meshes.length, built, plantTris: WP.PL.tris() - plants0, checked: CHECKED, temporary: TEMPORARY, plan: P, groundY: P.groundY, seats, group: grp, pool });
    console.log(`[gto] worcester_lake: ${meshes.length} meshes, ${Math.round(tris)} triangles`, JSON.stringify(built));
    // nothing here moves: the one job per frame is not to draw it from the far side of the college
    const pp = game.player.pos; let vis = true;
    return { id: 'worcester_lake', update() { const e = game.eye || pp, dx = e.x + 400, dz = e.z + 30, show = game.player.place === 'world' && dx * dx + dz * dz < 520 * 520; if (show !== vis) { vis = show; grp.visible = show; if (!(game.worcesterGardens && game.worcesterGardens.on)) WP.show(show); } } };
  },
};
