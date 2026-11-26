// Worcester College, the gardens (2026-11-22; work package I of docs/research/worcester_survey.md: G02 - G06, the
// trees). Everything outside the quad's walls that is not the lake (places/worcester_lake.js), the playing fields or a
// building:
//   the trees          every tree top the 2022 height survey finds on the college's ground, at its measured place and
//                      height, as map trees (so the city's own tree system draws them: 3D near, a card far); the
//                      Orchard's rows; the copper beech in its own colour. The grounds module's hand-placed belt,
//                      specimen trees and orchard go in exchange.                              (_wgard_trees.js)
//   the rose garden    (second pass: to the satellite picture) one round-ended figure of ten rose beds in lawn, the
//                      yew columns down its west side and across its north end, the flying Mercury on the middle
//                      round, a pedestal in the north half-round, a stone seat in the south one, the stone head, the
//                      Portuguese laurel hedge.
//   the rest           (second pass, _wgard_more.js) the car park's clipped hedges, the Fellows' Garden's borders,
//                      the Provost's box hedges and meadow, the benches as map benches, lamp standards, the stone
//                      gateway at the Hanging Garden's foot.
//   the plants         painted cut-out cards and leaf-textured volumes, one set for all the grounds (_wgard_plants.js).
//   the Hanging Garden its 21 m west of the tunnel: a level lawn 2.7 m up between rubble walls, the flight of stone
//                      steps at its west end (it can be walked up), the Long Border's planting at its foot.
//   the Orchard        mown grass, its central path in tarmac; the two greenhouses in glass; the shepherd's hut in
//                      the Provost's Garden.                                                    (_wgard_build.js)
// Lawns: the Nuffield Lawn and the Orchard are mown college lawns now (they were rough garden grass with scattered
// garden trees, conifers among them).
// SOURCES (looked at, never copied or used as textures; local `reference/worcester/`): the height survey; `31 provosts
// garden and formal garden`, `33 orchard…`, `34 nuffield lawn…` (two folders), `05 cottages…`; satellite S1, S13; the
// 2014 and 2023 aerial pictures; the Register of Parks and Gardens entry 1000465; the college's garden pages.
// K / G for every element: CHECKED below and the trees' own records (game.worcesterGardens.trees.records).
// `?wgard=0` (node: GTO_WGARD=0) = the gardens as they were.
import * as THREE from 'three';
import { Batch, makePack } from './_worcester_kit.js';
import { plantTops, orchardRows } from './_wgard_trees.js';
import * as G from './_wgard_build.js';
import { buildTrees } from './_grounds_static.js';
import { FOOTPRINTS as SOUTH } from './worcester_south.js';
import lakeModule from './worcester_lake.js';
import { UPPER as UPPER_POOL } from './_wlake_plan.js';
import { groundsPlants } from './_wgard_plants.js';
import * as M from './_wgard_more.js';

const qs = (typeof location !== 'undefined' && location && location.search) || '', env = (typeof process !== 'undefined' && process.env) || {};
export const ON = !(/[?&]wgard=0(&|$)/.test(qs) || env.GTO_WGARD === '0');
const ID = { nuffield: 'r4008715', orchard: 'r18123045', orchardE: 'w999275856', rose: 'w169617898', field: 'w23153013', orchardPath: 'w169617910' };
export const CHECKED = [
  ...M.CHECKED_MORE,
  ['trees: where they stand and how tall', 'K', '2022 height survey (Environment Agency LIDAR, 1 m): every top over about 9 m on the college\'s ground'],
  ['trees: what kind each is', 'G', 'named for 23 of them from pictures, the Register and the 2014 planning site plan (see _wgard_trees.js KINDS: 12 K, 11 G); the rest by height and place'],
  ['Nuffield Lawn and Orchard: mown grass', 'K', '34/nuffield lawn - … (striped lawn in every picture), 33/orchard lower section - rows of apple trees on mown grass (2018)'],
  ['Orchard: rows of fruit trees about 6.5 m apart', 'K', '33/orchard - old apple trees in long grass, rows visible; where each tree stands: G'],
  ['Orchard: central path in tarmac', 'K', 'the tour sheet; 33/orchard gate… (2014) shows it'],
  ['rose garden: yew columns: eleven down the west side about 2.55 m apart, four across the north end; the gravel walk just outside the west row', 'K', '40/rose garden satellite close (zoom of the above).png (2026); the row\'s line also in the height survey; 31/rose garden - the yew columns in line… (2016)'],
  ['rose garden: the columns round, tapering, flat-topped, each in a square of soil', 'K', '31/rose garden in winter - bed shapes, yew columns… (2015), …row of yew columns on a grass strip… (2014)'],
  ['rose garden: the five more columns of the gardeners\' blog\'s twenty', 'G', 'NOT BUILT: fifteen are seen in the satellite picture; where the others stand is not known (the first pass had put four across the north end and sixteen in the row at 1.83 m)'],
  ['rose garden: one round-ended planted figure on the axis inside a lawn margin: a half-round ring at the north round a half-round of lawn, the long body, a round at its middle, a round south end', 'K', 'the same satellite picture, scaled by the 15.3 m from the yew row to the quad wall and the 32.2 m from the Lodgings to the laurel hedge'],
  ['rose garden: ten beds, rectangular and curved, grass paths about a metre wide between them', 'K', 'gardeners\' blog 2017; 31/rose garden in winter… (2015), …curved beds and central stone pedestal (2014)'],
  ['rose garden: how the figure is cut into its ten beds', 'G', 'three lengthwise rows of two either side of a cross path through the middle round, two quarter-rings at each end: in summer the roses close over the paths (the satellite picture shows one mass); the December 2023 aerial picture has rows lying lengthwise'],
  ['rose garden: old shrub roses chest- to head-high, magenta, pink, blush and white, with white crambe, foxgloves and lupins, low edging', 'K', '31/rose garden - beds in flower, columns beyond (2014), …general view across the beds… (2015); which plant where: G'],
  ['rose garden: Mercury on a pedestal on the middle round', 'K', '31/rose garden - mercury statue at the centre… (college website), …beds in flower… (2014: lead grey-blue); the satellite picture (a pale round base at the middle); the figure here is a plain form, not a copy'],
  ['rose garden: a small pedestal on a round base in the north half-round of lawn', 'K', 'the satellite picture; G: what it carries (the sundial of the 1903 design the Register names is put there)'],
  ['rose garden: a pale stone feature about 3.4 x 1.7 m in the south round end', 'K', 'the satellite picture; G: that it is a stone seat on a paved apron'],
  ['rose garden: stone head on a plinth on the lawn at the south-west foot', 'K', '31/rose garden in winter… (2015), …stone head among the beds…; the satellite picture (a small pale thing there)'],
  ['rose garden: a clipped hedge along the east side against the quad\'s wall; no long bed there', 'K', 'the satellite picture; its height (1.5 m): G'],
  ['rose garden: Portuguese laurel hedge across the south end', 'K', 'the same pictures; height survey 5 - 6 m (built 4.6 m)'],
  ['Hanging Garden: a level lawn 2.7 m up, world x -293 … -321, z 35.5 … 39', 'K', 'height survey; satellite S1; 31/secret garden above the rose garden… (2015)'],
  ['Hanging Garden: stone steps at its west end on the south side', 'K', 'Register of Parks and Gardens; the pale straight strip in satellite S1 and S13; their number (16) and width: G'],
  ['Hanging Garden: rubble walls, a parapet about 1 m on the north', 'K', '05/cottages west end, hanging garden wall… (2011), 31/secret garden…'],
  ['Long Border: shrubs head-high and over at the back, a banana, a white rambler and wisteria on the wall, white lupins, delphiniums, blue mounds at the front', 'K', '05/herbaceous border below hanging garden wall, terrace beyond (worc.ox.ac.uk tour), 34/nuffield lawn - long border and gravel path… (Geograph 4148720); which plant where: G'],
  ['how the plants are drawn: painted cut-out cards and leaf-textured volumes (places/_wgard_plants.js)', 'G', 'painted from the list of what the pictures show growing; nothing copied from a photograph'],
  ['small mapped trees no measured top replaced (the one at (-295.9, 51.5) among them): round-crowned broadleaves under 9 m', 'K', '40/S1 satellite - hanging garden… (the round crown south of the path); they are under the height survey\'s 9 m'],
  ['lawn between the rose garden and the Provost\'s lawn (the map leaves a strip in no area)', 'K', '40/S1, S13 satellite; 31/rose garden - the yew columns in line beside the gravel walk (2016)'],
  ['greenhouses: glass on a low wall, aluminium bars, shallow roof, a green ridge', 'K', '33/greenhouse - roof from outside… (2015), …interior…; the brick base and the small one\'s form: G'],
  ['shepherd\'s hut: pale green boarded, curved dark roof, iron wheels, steps', 'K', '31/provosts garden far end - long-grass bulb meadow and shepherds hut (2016)'],
  ['shepherd\'s hut: where it stands', 'G', 'the small roofed thing satellite S13 shows north of the south arm, about 27 m west of the bridge'],
];
/** stand-ins for the flat world (the coordinator's list) */
export const TEMPORARY = [
  'the Hanging Garden stands 2.7 m above flat ground on BOTH sides (real: 2.3 - 2.8 m above the rose garden, 2.6 - 3.0 m above the Nuffield path): right as it is once the terrain is drawn; G.HG.top',
  'its east end is a rubble face against the older mound over the tunnel (places/worcester.js), whose top still slopes up from the quad: one level when that mound is rebuilt',
  'the rose garden lies at the flat world\'s level, 2.6 m above the quad\'s floor (real: 0.3 m below the quad\'s west path); the quad\'s wall therefore shows only its top from here',
];

const pip = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const dRing = (x, z, r) => { let d = 1e9; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)) : 0; d = Math.min(d, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz)); } return d; };
const inBox = (p) => p[0] > -700 && p[0] < -220 && p[1] > -262 && p[1] < 182;

export default {
  id: 'worcester_gardens',
  preMap(game) {
    if (!ON || game.worcesterGardens) return;
    try {
      const ov = game.overrides, map = game.map; if (!map || !map.areas) return;
      // the lake's outline and the lakeside path are the lake module's: its preMap first, whatever order the two load in
      if (!game.worcesterLake && lakeModule.preMap) lakeModule.preMap(game);
      const WL = game.worcesterLake && game.worcesterLake.on ? game.worcesterLake : null;
      const area = (id) => map.areas.find((a) => a.id === id);
      // ---- the rose garden's gravel walk lies BESIDE the yew columns (K: 31/rose garden - the yew columns in line beside the
      // gravel walk, 2016; the map drew it 1.5 m further west): its two vertices there, and the ends of the two paths
      // that meet it, move with it (places/friends.js LAKE_A / LAKE_A2 stand on it)
      if (map.roads) { const mv = (id, from, to) => { const r = map.roads.find((x) => x.id === id); if (r && r.pts) for (const p of r.pts) if (Math.hypot(p[0] - from[0], p[1] - from[1]) < 0.3) { p[0] = to[0]; p[1] = to[1]; } };
        mv('w130668899', [-320.9, 1.6], G.ROSE.walk[0]); mv('w130668899', [-319.8, 18.9], G.ROSE.walk[1]); mv('w849457926', [-319.8, 18.9], G.ROSE.walk[1]); mv('w130668903', [-320.9, 1.6], G.ROSE.walk[0]); }
      // ---- lawns: mown grass (a college's `grass` is its striped lawn and grows no scattered garden trees)
      for (const id of [ID.nuffield, ID.orchard, ID.orchardE, ID.rose]) { const a = area(id); if (a) a.kind = 'grass'; }
      // ---- the rose garden's beds, the yews' squares; nothing wild on the Hanging Garden or in the beds
      const beds = G.ROSE.beds.map((b) => b.map((q) => G.L2W(q[0], q[1])));
      beds.forEach((poly, i) => map.areas.push({ id: 'worc:rose-bed-' + i, kind: 'flowerbed', poly }));
      const H = G.HG, hgRing = [[H.stairX0 - 0.3, H.zN - 0.3], [H.xE + 0.3, H.zN - 0.3], [H.xE + 0.3, H.zS + 0.2], [H.stairX0 - 0.3, H.zS + 0.2]];
      map.areas.unshift({ id: 'worc:site-hanging-garden', kind: 'garden', poly: hgRing }); ov.skip.add('worc:site-hanging-garden');
      // ---- the greenhouses are built here; the Orchard's central path is tarmac
      for (const g of G.GREENHOUSES) ov.skip.add(g.id);
      const op = map.roads && map.roads.find((r) => r.id === ID.orchardPath); if (op) op.surface = 'asphalt';
      // ---- the trees
      const field = area(ID.field), near = (a) => a.poly.some(inBox);
      const water = map.areas.filter((a) => a.kind === 'water' && near(a)).map((a) => a.poly); water.push(UPPER_POOL);
      const buildings = map.buildings.filter((b) => !b.part && b.poly.some(inBox)).map((b) => b.poly);
      buildings.push(SOUTH.asaBriggs, SOUTH.kitchen, SOUTH.casson, SOUTH.wolfson, ...SOUTH.wolfsonTowers, ...SOUTH.linburyRange, SOUTH.linburyWing, hgRing, G.ROSE.lawn.map((q) => G.L2W(q[0], q[1])), ...G.GREENHOUSES.map((g) => g.poly));
      const paths = map.roads.filter((r) => r.pts && r.pts.some(inBox) && !ov.skip.has(r.id) && !r.tunnel).map((r) => ({ pts: r.pts, w: Math.min(6, r.w || 2.2) + (r.kind === 'footway' || r.kind === 'path' ? 0.5 : 0) }));
      const hut = G.HUT;
      const WFk = game.worcesterFields && game.worcesterFields.on ? game.worcesterFields.keep : null;      // (places/worcester_fields.js loads before this module)
      const keep = (x, z) => !!(WL && WL.keep(x, z)) || Math.hypot(x - hut.c[0], z - hut.c[1]) < 3.2 || !!(WFk && WFk(x, z));
      // this package's ground: the college west of Walton Street, less the core, Nash Quad and Worcester Place, the Shah
      // Centre's precinct, the south buildings' courts (their modules plant their own) and the open playing field
      const own = (x, z) => x < -226 && !(x > -304 && z > -21 && z < 48) && !(z < -121 && x > -415) && !(x > -398 && x < -326 && z < -100) && !(x > -287 && z > 104)
        && !(field && pip(x, z, field.poly) && dRing(x, z, field.poly) > 9) && !(x > -310 && x < -280 && z > -62 && z < -20);
      const mappedIdx = []; map.trees.forEach((t, i) => { if (inBox(t) && own(t[0], t[1]) && t.length < 4) mappedIdx.push(i); });
      const lines = (map.waterlines || []).filter((w) => w.pts && w.pts.some(inBox) && !w.tunnel);
      const wet = (x, z) => lines.some((w) => { for (let i = 0; i < w.pts.length - 1; i++) if (dRing(x, z, [w.pts[i], w.pts[i + 1]]) < (w.cw ?? w.w ?? 3) / 2 + 1.2) return true; return false; });
      const plan = plantTops({ water, wet, buildings, paths, mapped: mappedIdx.map((i) => map.trees[i]), keep, own });
      const drop = new Set(plan.drop.map((k) => mappedIdx[k]));
      map.trees = map.trees.filter((_, i) => !drop.has(i));
      const lidarN = plan.trees.length;
      // the Orchard's rows, clear of the paths and of the measured trees
      const orch = area(ID.orchard), pathNear = (x, z, d) => paths.some((p) => { for (let i = 0; i < p.pts.length - 1; i++) if (dRing(x, z, [p.pts[i], p.pts[i + 1]]) < p.w / 2 + d) return true; return false; });
      const rows = orch ? orchardRows(orch.poly, (x, z) => dRing(x, z, orch.poly) > 2 && !pathNear(x, z, 1.6) && !plan.trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < 5) && !buildings.some((b) => pip(x, z, b))) : [];
      // a few that the pictures show and the height survey is too coarse for (G: exactly where)
      // (the young golden weeping willow of 2013 on the lakeside border; and, K in three pictures, the big evergreen oak
      //  on the north bank between the bridge and the weir)
      const extra = [[-372.0, 36.4, 5.5, 'willow']].filter((t) => !keep(t[0], t[1]) && !water.some((w) => pip(t[0], t[1], w)));
      extra.push([-331.6, 26.7, 12, 'broad']);
      // (the mapped path across the rose garden's north end runs north of the yew columns' north row, as the satellite picture has it: it is left as mapped)
      // mapped trees on this ground that no measured top took the place of: under the survey's 9 m, so small broadleaves
      // (K: satellite S1 has the one south of the Long Border's path, at (-295.9, 51.5), round-crowned; the generator's hash
      // had drawn it as a poplar-like column, and could make any of them a conifer)
      let small = 0; map.trees.forEach((t, i) => { if (t.length < 4 && inBox(t) && own(t[0], t[1])) { map.trees[i] = [t[0], t[1], Math.min(9, t[2] || 7.5), 'broad']; small++; } });
      for (const t of [...plan.trees, ...rows, ...extra]) map.trees.push(t);
      // the strip between the rose garden and the Provost's lawn that the map leaves in no area (it was drawn as rough
      // town grass): mown lawn like both (K: satellite S1 and S13, the 2016 picture of the walk)
      if (!area('worc:lawn-rose-walk')) { const P0 = [-320.6, 34.2], P1 = [-325.1, -24.9], zt = 2.7, f = (P0[1] - zt) / (P0[1] - P1[1]);
        map.areas.push({ id: 'worc:lawn-rose-walk', kind: 'grass', name: 'Provost\'s Garden', poly: [P0, [-317.2, 32.1], [-319.4, 2.7], [P0[0] + (P1[0] - P0[0]) * f, zt]] }); }
      // benches (map benches: they can be sat on), lamp standards, the cushion's and the strawberry trees
      const more = M.morePreMap(map, (x, z) => !keep(x, z) && !water.some((w) => pip(x, z, w)) && !buildings.some((b) => pip(x, z, b)) && !pathNear(x, z, 0.5) && map.trees.every((t) => Math.hypot(t[0] - x, t[1] - z) > 1.5)
        && !(map.barriers || []).some((b) => { if (!b.pts || ov.skip.has(b.id) || !b.pts.some(inBox)) return false; for (let i = 0; i < b.pts.length - 1; i++) if (dRing(x, z, [b.pts[i], b.pts[i + 1]]) < 1.3) return true; return false; }), ov.skip);
      game.worcesterGardens = { on: true, more, trees: { ...plan, rows: rows.length, extra: extra.length, lidar: lidarN, dropped: drop.size, small }, beds, hgRing };
    } catch (e) { console.error('[worcester_gardens] preMap', e); }
  },
  install(game) {
    const WG = game.worcesterGardens; if (!ON || !WG || !WG.on) return null;
    const world = game.world, col = game.worldCollider;
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    G.cells(pack);
    const B = new Batch(), grp = new THREE.Group(); grp.name = 'worcester-gardens';
    world.addStatic(grp);
    const WP = groundsPlants(game), plants0 = WP.PL.tris();      // (roses, borders, hedges, topiary: the grounds' shared set of plants)
    const { built } = G.buildGardens(B, WP.PL);
    Object.assign(built, M.buildMore(B, WP.PL));
    WP.finish(world);
    const meshes = B.build({ _pack: pack }, grp, { pack, chunk: (x, z) => (z < -60 ? 1 : x < -340 ? 2 : 0) });
    // the copper beech: the one tree whose colour the city's trees do not have (its own instance of the city's model)
    let special = [];
    try { special = buildTrees(world, WG.trees.special.map((t) => ({ sp: 'broad', x: t.x, z: t.z, h: Math.min(26, t.h), w: t.h * 0.86, color: 0x7d3f4c }))); for (const m of special) { m.name = 'worcester-gardens:copper-beech'; grp.add(m); } for (const t of WG.trees.special) col.addCircle(t.x, t.z, 0.45, { tag: 'tree' }); } catch (e) { console.error('[worcester_gardens] copper beech', e); }
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);

    // ================================================================= colliders
    const seg = (a, b, o) => col.addSegment(a[0], a[1], b[0], b[1], o);
    for (const [u, v] of G.ROSE.yews) { const p = G.L2W(u, v); col.addCircle(p[0], p[1], 0.52, { tag: 'planter', low: true }); }
    for (const b of WG.beds) col.addPolygon(b, { tag: 'planter', low: true });
    { const R = G.ROSE, m = G.L2W(R.cu, R.cv), hd = G.L2W(R.head[0], R.head[1]), Hd = R.hedge; col.addCircle(m[0], m[1], 0.4, { tag: 'furniture', low: true }); col.addCircle(hd[0], hd[1], 0.3, { tag: 'furniture', low: true });
      { const d = G.L2W(R.dial[0], R.dial[1]), st = G.L2W(R.seat[0], R.seat[1] + 0.35), E = R.east; col.addCircle(d[0], d[1], 0.3, { tag: 'furniture', low: true }); col.addBox(st[0], st[1], 2.5, 0.6, 0.0761, { tag: 'furniture', low: true });
        const eh = col.addPolygon([G.L2W(E.u - E.w / 2, E.v0), G.L2W(E.u + E.w / 2, E.v0), G.L2W(E.u + E.w / 2, E.v1), G.L2W(E.u - E.w / 2, E.v1)], { tag: 'hedge' }); if (eh) for (const q of eh) q.h = E.h; }
      const sg = col.addPolygon([G.L2W(Hd.u0, Hd.v0), G.L2W(Hd.u1, Hd.v0), G.L2W(Hd.u1, Hd.v1), G.L2W(Hd.u0, Hd.v1)], { tag: 'hedge' }); if (sg) for (const s of sg) s.h = Hd.h; }
    { const H = G.HG, zs = H.zS - H.stairW, T = H.top;      // the Hanging Garden: walls all round, open only at the foot of its steps
      const walls = [[[H.xW, H.zN + 0.17], [H.xE, H.zN + 0.17]], [[H.stairX0, H.zS - 0.15], [H.xE, H.zS - 0.15]], [[H.xW - 0.17, H.zN], [H.xW - 0.17, zs]], [[H.xE + 0.15, H.zN], [H.xE + 0.15, H.zS]], [[H.stairX0, zs - 0.14], [H.xW, zs - 0.14]]];
      for (const [a, b] of walls) { const s = seg(a, b, { tag: 'wall' }); if (s) s.h = T + 0.5; } }
    for (const g of G.GREENHOUSES) { const sg = col.addPolygon(g.poly, { tag: 'building' }); if (sg) for (const s of sg) s.h = g.ridge; }
    { const U = G.HUT, l = Math.hypot(U.dir[0], U.dir[1]); col.addBox(U.c[0], U.c[1], U.l, U.w, -Math.atan2(U.dir[1] / l, U.dir[0] / l), { tag: 'building' }); }

    M.moreColliders(col);

    // ================================================================= walkable heights: the Hanging Garden's lawn and steps
    const prev = world.groundHeight.bind(world);
    world.groundHeight = (x, z) => { if (x > -326 && x < -300 && z > 34.5 && z < 41) { const h = G.hgGroundY(x, z); if (h !== null) return h; } return prev(x, z); };

    // scattered trees and furniture off the rose garden, the Hanging Garden, the glasshouses
    const yw = M.YEW, cu = M.CUSHION;
    if (world.clearArea) for (const p of [G.ROSE.lawn.map((q) => G.L2W(q[0], q[1])), WG.hgRing, ...G.GREENHOUSES.map((g) => g.poly), [[yw.a[0], yw.a[1] - 1.6], [yw.b[0], yw.b[1] - 1.6], [yw.b[0], yw.b[1] + 1.6], [yw.a[0], yw.a[1] + 1.6]], [[cu.c[0] - 3, cu.c[1] - 3], [cu.c[0] + 3, cu.c[1] - 3], [cu.c[0] + 3, cu.c[1] + 3], [cu.c[0] - 3, cu.c[1] + 3]]]) { try { world.clearArea(p); } catch (e) { /* */ } }

    Object.assign(WG, { tris, plantTris: WP.PL.tris() - plants0, plants: WP, meshes: meshes.length + special.length, built, checked: CHECKED, temporary: TEMPORARY, group: grp, plan: G });
    console.log(`[gto] worcester_gardens: ${meshes.length + special.length} meshes, ${Math.round(tris)} triangles; ${WG.trees.lidar} measured trees (${WG.trees.dropped} at mapped trunks, ${WG.trees.skipped.length} not planted), ${WG.trees.rows} orchard trees`, JSON.stringify(built));
    const pp = game.player.pos; let vis = true;
    return { id: 'worcester_gardens', update() { const e = game.eye || pp, dx = e.x + 310, dz = e.z + 20, show = game.player.place === 'world' && dx * dx + dz * dz < 520 * 520; if (show !== vis) { vis = show; grp.visible = show; WP.show(show); } } };
  },
};
