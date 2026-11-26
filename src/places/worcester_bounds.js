// Worcester College, boundaries and gates inside the grounds (2026-11-22; work package K of
// docs/research/worcester_survey.md, the parts no building's module owns):
//   the Orchard gate    (2014) by the Besse archway on the car-park side: a pair of black wrought-iron field gates,
//                       five bars and crossed braces with a small shield each, scrolls at the hinge ends, posts with
//                       ball finials, a young yew either side; shut. The mapped hedge is cut back for it.
//   the canal boundary  the college's bank on the Oxford Canal is a low mixed hedge at the water's edge, not the tall
//                       black fence the map's `fence` line was drawn as: that line is a hedge 1.2 m high from Nelson
//                       Street down to the old gateway by the lake; from there south it stays a fence (the tour
//                       picture shows a black iron post by the gateway's south end).
// K / G: CHECKED. Built elsewhere: Gate 1 and the Hythe Bridge Street wall (places/worcester_south.js), Gate 2 and the
// street walls (places/_worcester_street.js), the old gateway, the old wall south of the Sainsbury weir and the way
// through the Orchard wall (places/worcester_lake.js). `?wbounds=0` (node: GTO_WBOUNDS=0) = as before.
import * as THREE from 'three';
import { Batch, makePack, frame } from './_worcester_kit.js';
import { shrub } from './_worcester_south_kit.js';

const qs = (typeof location !== 'undefined' && location && location.search) || '', env = (typeof process !== 'undefined' && process.env) || {};
export const ON = !(/[?&]wbounds=0(&|$)/.test(qs) || env.GTO_WBOUNDS === '0');
export const GATE = { w: [-296.3, -59.04], e: [-292.7, -59.22], h: 1.25, post: 1.5 };      // its two posts, on the mapped hedge's line
const HEDGE = 'w1320810213', CANAL = 'w251686321', SPLIT = [-420.1, 54.2];
export const CHECKED = [
  ['Orchard gate: a pair of black wrought-iron gates, five bars, crossed braces, a shield each, ball-finial posts, about 3.6 m', 'K', '33/orchard gate - black wrought-iron field gate and hoggin apron (gardeners blog 2014)'],
  ['Orchard gate: where it stands', 'G', 'on the yew hedge between the car park by the Besse Building and the Orchard, just east of the tarmac path (the picture: the path at its left, the old wall far right, the Sainsbury Building beyond)'],
  ['canal boundary: a hedge about 1.2 m at the water\'s edge, no wall, no towpath on this side', 'K', '39 canal edge and wood walk/canal boundary - … (five pictures, gardeners blog 2018)'],
  ['canal boundary: a fence from the old gateway southwards', 'G', 'a black iron post with a ball finial stands by the gateway\'s south end in the tour picture; what runs on from it is not seen'],
  ['Gates 5 and 6 across Walton Street', 'G', 'NOT BUILT: Gate 5 is the carriage arch of 171 Walton Street (grey boarded gates, one photograph; which bay not established), Gate 6 has no picture; both stand in houses the street module draws'],
  ['Gate 2 on Provost\'s Drive: solid black boarded gates between ashlar piers, lettered "Gate 2", SHUT', 'K', '38/boundary wall on walton street looking south, provosts drive gate (Commons, Camboxer 2026); in the game (places/_worcester_street.js) they stand open: the friends and the bike-stand run go through'],
  ['Walton Street wall: 4.2 - 4.5 m high on the Fellows\' Garden side', 'K', 'height survey; NOT BUILT: the garden is not sunk until the terrain is drawn'],
  ['bike sheds, smoking shelters, lamp standards inside the college', 'G', 'NOT BUILT: map symbols only, no picture'],
];

export default {
  id: 'worcester_bounds',
  preMap(game) {
    if (!ON || game.worcesterBounds) return;
    try {
      const map = game.map, ov = game.overrides; if (!map || !map.barriers) return;
      // the yew hedge stops at the gate's east post
      const hedge = map.barriers.find((b) => b.id === HEDGE);
      if (hedge && hedge.pts && Math.hypot(hedge.pts[0][0] + 297.2, hedge.pts[0][1] + 59.0) < 1) hedge.pts = [[GATE.e[0] + 0.2, GATE.e[1] - 0.01], ...hedge.pts.slice(1)];
      // the canal side: a low hedge down to the old gateway, the fence from there on
      const c = map.barriers.find((b) => b.id === CANAL), i = c && c.pts ? c.pts.findIndex((p) => Math.hypot(p[0] - SPLIT[0], p[1] - SPLIT[1]) < 0.6) : -1;
      if (c && i > 0 && i < c.pts.length - 1) {
        ov.skip.add(c.id);
        map.barriers.push({ ...c, id: c.id + ':canal', kind: 'hedge', h: 1.2, pts: c.pts.slice(0, i + 1).map((p) => p.slice()) }, { ...c, id: c.id + ':south', pts: c.pts.slice(i).map((p) => p.slice()) });
      }
      game.worcesterBounds = { on: true };
    } catch (e) { console.error('[worcester_bounds] preMap', e); }
  },
  install(game) {
    const W = game.worcesterBounds; if (!ON || !W) return null;
    const world = game.world, col = game.worldCollider;
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    const B = new Batch(), grp = new THREE.Group(); grp.name = 'worcester-bounds';
    world.addStatic(grp);
    try {
      const G = GATE, l = Math.hypot(G.e[0] - G.w[0], G.e[1] - G.w[1]), t = 0.012;
      B.push(frame(G.w[0], 0, G.w[1], G.e[0] - G.w[0], G.e[1] - G.w[1]));      // x from the west post to the east, z towards the car park
      for (const x of [0, l]) { B.cyl('iron', x, 0, 0, 0.055, G.post, 8, false); B.cyl('iron', x, G.post, 0, 0.075, 0.04, 8, true); B.cyl('iron', x, G.post + 0.04, 0, 0.03, 0.05, 6, false); B.box('iron', x, G.post + 0.16, 0, 0.14, 0.14, 0.14, 0.78, { bottom: true }); }
      const leaf = (x0, x1, hinge) => {
        const w = x1 - x0, y0 = 0.1, y1 = G.h;
        for (const x of [x0, x1 - 0.03]) B.boxXZ('iron', x, x + 0.03, y0, y1 + (Math.abs(x - hinge) < 0.1 ? 0.14 : 0), -t, t, { bottom: true });
        for (let k = 0; k < 5; k++) { const y = y0 + ((y1 - y0 - 0.03) * k) / 4; B.boxXZ('iron', x0, x1, y, y + 0.03, -t, t, { bottom: true }); }
        B.beam('iron', [x0, y0 + 0.02, 0], [x1, y1 - 0.02, 0], 0.012, 0.03); B.beam('iron', [x0, y1 - 0.02, 0], [x1, y0 + 0.02, 0], 0.012, 0.03);
        const cx = x0 + w / 2, cy = (y0 + y1) / 2;      // the little shield where the braces cross
        for (const z of [-0.016, 0.016]) B.poly('iron', [[cx - 0.09, cy + 0.09, z], [cx + 0.09, cy + 0.09, z], [cx + 0.09, cy - 0.02, z], [cx, cy - 0.11, z], [cx - 0.09, cy - 0.02, z]], [0, 0, z]);
        const s = hinge < x0 + w / 2 ? 1 : -1;      // the scroll over the hinge end
        B.beam('iron', [hinge + s * 0.04, y1 + 0.13, 0], [hinge + s * 0.3, y1 + 0.02, 0], 0.012, 0.025); B.cyl('iron', hinge + s * 0.06, y1 + 0.1, 0, 0.035, 0.02, 6, true);
      };
      leaf(0.09, l / 2 - 0.02, 0.09); leaf(l / 2 + 0.02, l - 0.09, l - 0.09);
      B.pop();
      // a young yew either side (K: the 2014 picture)
      for (const [x, z, r] of [[G.w[0] - 0.75, G.w[1] + 0.05, 0.62], [G.e[0] + 0.85, G.e[1] - 0.1, 0.6]]) shrub(B, 'leafC', x, z, r, 2.1, 8, 0);
    } catch (e) { console.error('[worcester_bounds] orchard gate', e); while (B.stack.length) B.pop(); }
    const meshes = B.build({ _pack: pack }, grp, { pack });
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
    col.addSegment(GATE.w[0] - 1.2, GATE.w[1], GATE.e[0], GATE.e[1], { tag: 'gate' });      // shut (and the yew at its west end)
    if (world.clearArea) { try { world.clearArea([[GATE.w[0] - 1.5, GATE.w[1] - 1.2], [GATE.e[0] + 1.5, GATE.e[1] - 1.2], [GATE.e[0] + 1.5, GATE.e[1] + 1.2], [GATE.w[0] - 1.5, GATE.w[1] + 1.2]]); } catch (e) { /* */ } }
    Object.assign(W, { tris, meshes: meshes.length, checked: CHECKED, group: grp, gate: GATE });
    console.log(`[gto] worcester_bounds: ${meshes.length} meshes, ${Math.round(tris)} triangles`);
    const pp = game.player.pos; let vis = true;
    return { id: 'worcester_bounds', update() { const e = game.eye || pp, dx = e.x + 294, dz = e.z + 59, show = game.player.place === 'world' && dx * dx + dz * dz < 200 * 200; if (show !== vis) { vis = show; grp.visible = show; } } };
  },
};
