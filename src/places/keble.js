// Keble College, Parks Road, c. 2013 — see docs/research/landmarks_batch5.md (sources; known vs guessed).
//
//   preMap   the generic chapel and Liddon Quad's ranges, the Parks Road front, the lodge, Pusey and the hall and
//            library are skipped (rebuilt here in Butterfield's polychrome brick); the mapped lawn is kept
//   install  the chapel (tall, banded and diapered, deep buttresses, the east window over Parks Road), the ranges, the
//            gatehouse, the hall and library, the sunken lawn's stone-kerbed lip — LOD groups in the ONE batch-5 atlas
//            draw (_b5_kit.js). Opposite: the Robert Hooke Building (hooke_building.js), untouched.
//   game     the porter in the gate passage tells you one thing about the brickwork a day (and that you are not to walk
//            on the grass); the lawn is fenced by its lip
//
// Test hooks: game.keble = { sights, stats(), porterLine(day) }     tools/smoke_batch5.mjs
import { shared, addSite, DAY_MS } from './_b5_kit.js';
import { KB, F, buildChapel, buildRanges, buildLawnLip, lawnWorld, SOLIDS } from './_b5_keble.js';

export const IDS = { chapel: 'w90709819', front: 'w90709838', lodge: 'w228658820', pusey: 'w296008123', west: 'w90709858', chapelBlock: 'w90709867', hall: 'w296009662', library: 'w295051660', south: 'w295051661' };
export const SKIP = [IDS.chapel, IDS.front, IDS.lodge, IDS.pusey, IDS.west, IDS.chapelBlock, IDS.hall, IDS.library];
const Q = F.Q;
export const sights = [
  { id: 'keble-chapel', name: 'Keble College Chapel', x: Q(15, -24)[0], z: Q(15, -24)[1], blurb: 'William Butterfield\'s chapel, consecrated in 1876, is the tallest building of the college: red brick banded and patterned in buff stone and blue-black brick.' },
  { id: 'keble-front', name: 'Keble\'s Parks Road front', x: Q(46, 30)[0], z: Q(46, 30)[1], blurb: 'The college was founded in 1870 in memory of John Keble. Butterfield built it in brick, not the local stone, which caused a stir: it still does.' },
  { id: 'keble-liddon', name: 'Liddon Quad', x: Q(0, 6)[0], z: Q(0, 6)[1], blurb: 'The main quad, named after Henry Liddon, with its lawn set below the surrounding walk.' },
  { id: 'keble-hall', name: 'Keble Hall and Library', x: Q(-20, 34)[0], z: Q(-20, 34)[1], blurb: 'Hall and library (1876-78) on the south side of the quad: the hall is one of the longest in Oxford.' },
];
export const PORTER = [
  'The porter: "Three colours of brick out there: red, a buff stone band, and the blue-black. People call it the Fair Isle jumper."',
  'The porter: "Butterfield used brick on purpose. Cheaper than stone, and nobody could mistake us for anyone else."',
  'The porter: "Chapel was paid for by one benefactor, William Gibbs. Very tall, as you can see. And no, you can\'t go on the grass."',
  'The porter: "The lawn\'s sunk below the path. Keeps the grass in and the students off it. Mostly."',
  'The porter: "Keble Road on one side, Parks Road on the other, and the museum over the way. Lovely spot. Keep off the lawn."',
];
export const porterLine = (day) => PORTER[((day % PORTER.length) + PORTER.length) % PORTER.length];

export default {
  id: 'keble',
  preMap(game) {
    try {
      for (const id of SKIP) game.overrides.skip.add(id);
      game.overrides.style.set(IDS.south, { wall: 'brick', roof: 'slate', tint: [1.0, 0.86, 0.78] });
    } catch (e) { console.error('[keble] preMap', e); }
  },

  install(game) {
    const K = shared(game), me = K.join('keble'), W = game.world, col = game.worldCollider;
    const S = { err: false, asked: 0, warned: false };
    try {
      { const c = Q(15, -35.6); addSite(K, 'kb:chapel', [c[0], 14, c[1]], 25, [110, 190, 1500], buildChapel, { farArea: 0.3 }); }
      { const c = Q(-5, 20); addSite(K, 'kb:ranges', [c[0], 7, c[1]], 75, [100, 190, 700], buildRanges); }
      { const c = Q(-1, 5); addSite(K, 'kb:lawn', [c[0], 0.3, c[1]], 34, [80, 160, 300], buildLawnLip); }
      K.boxes.push([40, 240, -520, -320]);
      for (const p of SOLIDS()) col.addPolygon(p);
      { const v = KB.gateV; col.addPolygon([Q(27.6, 33), Q(41.5, 33), Q(41.5, v - 1.75), Q(27.6, v - 1.75)]); col.addPolygon([Q(27.6, v + 1.75), Q(41.5, v + 1.75), Q(41.5, 39.2), Q(27.6, 39.2)]); }
      col.addPolygon(lawnWorld());
      if (W && W.clearArea) W.clearArea(lawnWorld(), { trees: false });
      try { for (const dv of [-2.4, 2.4]) { const p = Q(41.8, KB.gateV + dv); W.addLampGlow(p[0], 3.4, p[1]); } } catch { /* stub */ }
      // the porter's hatch in the gate passage
      const hatch = Q(33.5, KB.gateV + 1.2);
      game.interact.add({ pos: hatch, radius: 2.0, label: 'Ask the porter about the brickwork', onUse: () => ask() });
    } catch (e) { console.error('[keble] build', e); } finally { K.joined(me); }

    function ask() { S.asked++; const line = porterLine(Math.floor(game.time.now() / DAY_MS)); try { game.ui.toast(line, 6); } catch { /* */ } return line; }
    function tick() {
      K.tick(me);
      // walking into the lawn's lip: the porter's voice, once per visit to the quad
      const p = game.player.pos; if (game.player.place !== 'world') return;
      const [u, v] = F.toQ(p.x, p.z), nearLip = u > -29.5 && u < 27 && v > -24 && v < 33.8, onWalk = nearLip && !(u > -27 && u < 24.5 && v > -21.5 && v < 31);
      if (onWalk && !S.warned) { S.warned = true; try { game.ui.toast('A voice from the lodge: "Off the grass, please!" (Nobody walks on Liddon Quad\'s lawn.)', 4); } catch { /* */ } }
      if (!nearLip) S.warned = false;
    }
    game.keble = {
      sights, ids: IDS, porterLine, ask,
      stats() { const gs = K.lod.groups.filter((q) => /^kb:/.test(q.name)); return { levels: Object.fromEntries(gs.map((q) => [q.name, q.level])), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^kb:/.test(k)).map(([k, v]) => [k, v.tris])), asked: S.asked }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[keble]', e); } } } };
  },
};
