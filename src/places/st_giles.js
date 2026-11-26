// St Giles', c. 2013 (batch 6) — see docs/research/landmarks_batch6.md (sources; known vs guessed).
//
//   preMap   the generic St Giles' front of St John's (the gate tower and lodge, the two Front Quad staircases either
//            side of it, the kitchen range) and the two pubs facing each other across the street are skipped (rebuilt
//            here); the pubs keep their real names (the Eagle and Child, the Lamb and Flag; invented ones under
//            ?invented=1, core/features.js); the Taylor Institution's wing is
//            raised to its real three storeys and restyled (the world draws it)
//   install  St John's battlemented rubble front and gate tower with its statue niche, the Taylorian's four Ionic
//            columns and statues, the two pubs (painted fronts, fascias, hanging signs on iron brackets; the east one
//            bridging the passage through to the lane behind), the Oxford War Memorial on its island at the north end
//            — LOD groups in the ONE batch-5 atlas draw (_b5_kit.js: no draw call added)
//   game     buy a half at either pub (£2, a landlord's line by day); read the memorial; ask at St John's lodge
//
// Test hooks: game.stGiles = { sights, stats(), half(i), read() }     tools/smoke_batch6.mjs
import { shared, addSite, DAY_MS } from './_b5_kit.js';
import { SJ, TI, tiPt, PUBS, MEM, buildStJohns, buildTaylor, buildPubs, buildMemorial, solids, passages } from './_b6_giles.js';
import { sidePt, sideToward } from './_b6_kit.js';
import { PUB_A, PUB_B } from './_b6_cells.js';
import { tn, inventedNames } from '../core/features.js';

const OFF = (typeof location !== 'undefined' && /[?&]b6=0\b/.test(location.search || '')) || (typeof process !== 'undefined' && !!(process.env && process.env.B6OFF));
export const IDS = { stjohns: ['w228363362', 'w297318626', 'w300444722', 'w296659599'], pubs: [PUBS.west.id, PUBS.east.id], taylor: TI.id };
export const SKIP = [...IDS.stjohns, ...IDS.pubs];
export const PUB_NAMES = [PUB_A, PUB_B];
const mid = (R) => [R.cx, R.cz];
export const sights = [
  { id: 'sg-stjohns', name: 'St John\'s College gate', x: sidePt(SJ.tower, 0, 0, 6)[0], z: sidePt(SJ.tower, 0, 0, 6)[1], blurb: 'The St Giles\' front was built from 1437 for St Bernard\'s College, a house for Cistercian monks. Sir Thomas White refounded it as St John\'s in 1555.' },
  { id: 'sg-taylor', name: 'The Taylor Institution', x: tiPt(0, 6)[0], z: tiPt(0, 6)[1], blurb: 'C. R. Cockerell\'s east wing of the Ashmolean building (1841-45), the university\'s library of modern European languages. The four statues on the columns stand for France, Italy, Germany and Spain.' },
  { id: 'sg-pubs', name: 'Two pubs across St Giles\'', x: 10, z: -255, blurb: tn('The Eagle and Child and the Lamb and Flag face each other across the widest street in the centre. Writers have argued in both of them for longer than anyone remembers.', 'Old inns face each other across the widest street in the centre. Writers have argued in both of them for longer than anyone remembers.') },
  { id: 'sg-memorial', name: 'Oxford War Memorial', x: MEM.c[0], z: MEM.c[1] + 4, blurb: 'Thomas Rayson\'s cross of Clipsham stone, 11.4 m high on seven steps, unveiled in July 1921 where the Woodstock and Banbury Roads part. It bears no names.' },
];
export const LANDLORD = [
  ['"Half of the usual? Mind the step, it\'s older than the university."', '"Writers used to drink in the back room. Some of them still do."'],
  ['"There\'s a passage out the side to the lane, if anyone asks for you."', '"St Giles\' Fair is in September. Don\'t bring the car."'],
  ['"We had a professor in earlier arguing with the dartboard."', '"Quiz on Tuesday. The questions are harder than finals."'],
];
export const landlordLine = (pub, day) => LANDLORD[((day % 3) + 3) % 3][pub & 1];

export default {
  id: 'st_giles',
  preMap(game) {
    if (OFF) return;
    try {
      for (const id of SKIP) game.overrides.skip.add(id);
      // under ?invented=1 the invented names (the world's trade-name pass leaves a name a preMap set); by default the map's
      if (inventedNames()) for (const [id, name] of [[PUBS.west.id, PUB_A], [PUBS.east.id, PUB_B]]) { const b = game.map && game.map.buildings.find((q) => q.id === id); if (b) { b.tags = { ...b.tags, name }; delete b.tags.operator; delete b.tags.brand; } }
      if (inventedNames()) for (const p of (game.map && game.map.pois) || []) if (p.kind === 'pub' && /eagle and child|lamb and flag/i.test(p.name || '')) p.name = /eagle/i.test(p.name) ? PUB_A : PUB_B;
      game.overrides.heights.set(TI.id, TI.h);
      game.overrides.style.set(TI.id, { wall: 'stone', roof: 'slate', storeys: 3, up: 'stoneSashTall', tint: [1.04, 1.03, 1.0] });
    } catch (e) { console.error('[st_giles] preMap', e); }
  },

  install(game) {
    if (OFF) return { update() {} };
    const K = shared(game), me = K.join('st_giles'), W = game.world, col = game.worldCollider;
    const S = { err: false, halves: 0, read: 0, asked: 0 };
    try {
      addSite(K, 'sg:stjohns', [SJ.north.cx, 7, SJ.north.cz - 10], 45, [100, 180, 650], buildStJohns, { farArea: 0.4 });
      addSite(K, 'sg:taylor', [TI.m[0], 8, TI.m[1]], 10, [90, 170, 500], buildTaylor, { farArea: 0.3 });
      addSite(K, 'sg:pubs', [10, 5, -255], 36, [80, 150, 380], buildPubs, { farArea: 0.3 });
      addSite(K, 'sg:memorial', [MEM.c[0], 5, MEM.c[1]], 6, [70, 150, 500], buildMemorial, { farArea: 0.2 });
      K.boxes.push([-35, 80, -380, -25]);
      for (const p of solids()) col.addPolygon(p);
      for (const [x1, z1, x2, z2, w] of Object.values(passages())) col.addPassage(x1, z1, x2, z2, w);
      col.addCircle(MEM.c[0], MEM.c[1], 2.4);
      for (const x of [-4.6, -1.55, 1.55, 4.6]) { const p = tiPt(x, 1.45); col.addCircle(p[0], p[1], 0.7); }
      if (W && W.clearArea) { const r = 3.6, ring = []; for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2; ring.push([MEM.c[0] + Math.sin(t) * r, MEM.c[1] + Math.cos(t) * r]); } W.clearArea(ring); }
      // the pub doors: [E] buy a half; lanterns over them
      [PUBS.west, PUBS.east].forEach((P, i) => {
        const st = 0, door = sidePt(P.R, st, 0, 1.0);
        game.interact.add({ pos: door, radius: 1.8, label: 'Buy a half at ' + (i === 0 ? PUB_A : PUB_B) + ' (£2)', onUse: () => half(i) });
        try { const l = sidePt(P.R, st, 0, 0.4); W.addLampGlow(l[0], 3.7, l[1]); } catch { /* stub */ }
      });
      { const p = [MEM.c[0], MEM.c[1] + 3.3]; game.interact.add({ pos: p, radius: 1.8, label: 'Read the memorial', onUse: () => read() }); }
      game.interact.add({ pos: sidePt(SJ.tower, 0, 0, 1.4), radius: 2.0, label: 'Ask at St John\'s lodge', onUse: () => ask() });
    } catch (e) { console.error('[st_giles] build', e); } finally { K.joined(me); }

    function half(i) {
      if ((game.state.money || 0) < 2) { try { game.ui.toast('"Two pounds, love." You haven\'t got two pounds.', 4); } catch { /* */ } return false; }
      game.pay(-2); S.halves++;
      if (game.player) game.player.drunk = Math.min(1, (game.player.drunk || 0) + 0.12);
      const line = 'The landlord of ' + (i === 0 ? PUB_A : PUB_B) + ': ' + landlordLine(i, Math.floor(game.time.now() / DAY_MS));
      try { game.ui.toast(line + ' (-£2)', 6); game.save(); } catch { /* */ }
      return line;
    }
    function read() { S.read++; const t = 'On the steps: "To the men of Oxford who gave their lives, 1914-1918" (the wording here is approximate), and lines added on the steps for the wars since.'; try { game.ui.toast(t, 7); } catch { /* */ } return t; }
    function ask() { S.asked++; const l = ['St John\'s porter: "Front Quad\'s open to visitors in the afternoon. Canterbury Quad is through the far side; mind the lawns."', 'St John\'s porter: "The richest college? I couldn\'t possibly say. Lovely gardens, though."', 'St John\'s porter: "The fair? First Monday and Tuesday after St Giles\' Day. The whole street goes."'][Math.floor(game.time.now() / DAY_MS) % 3]; try { game.ui.toast(l, 6); } catch { /* */ } return l; }

    game.stGiles = {
      sights, ids: IDS, half, read, ask, pubs: PUB_NAMES,
      stats() { const gs = K.lod.groups.filter((q) => /^sg:/.test(q.name)); return { levels: Object.fromEntries(gs.map((q) => [q.name, q.level])), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^sg:/.test(k)).map(([k, v]) => [k, v.tris])), halves: S.halves }; },
    };
    void mid;
    return { update(dt) { try { K.tick(me); void dt; } catch (e) { if (!S.err) { S.err = true; console.error('[st_giles]', e); } } } };
  },
};
