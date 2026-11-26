// Folly Bridge and Folly Island, St Aldate's / Abingdon Road, c. 2013 — see docs/research/landmarks_batch4.md.
//
//   preMap   Caudwell's Castle (w95817192) is skipped (rebuilt here: brick, crenellated, turrets, balconies, statues);
//            the riverside pub (w95817197) restyled as a pale stone warehouse pub (city draw, no cost)
//   install  the bridge's parapets, cornice, pilasters, cutwaters and lamps over the mapped deck (_b4_folly.js), the
//            castle, the pub's terrace on the water, the boat-hire pontoon and kiosk and moored rowing boats, as LOD
//            groups in the batch-4 atlas draw (_b4_kit.js). The steamer is not drawn here any more: she sails on a
//            timetable (systems/steamer.js) and the hire boat you can row is systems/boathire.js. The mapped deck and water are left as
//            they are, so walking, "Jump off the bridge" and swimming are systems/swim.js's (nothing hand-placed).
//   game     the terrace dares you: jump off Folly Bridge (once a game day the drinkers stand you £5 for it).
//
// Test hooks: game.follyBridge = { sights, stats(), deck, onDeck(x, z) }     tools/smoke_batch4.mjs
import { shared, addSite, pip, DAY_MS } from './_b4_kit.js';
import { nearSet, DRINK_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';
import { BRIDGE, DECK, CASTLE, PUB, TERRACE, PONTOON, GANGWAY, STEAMER, TABLES, LAMPS, buildBridge, buildCastle, buildWaterfront } from './_b4_folly.js';
import { tn } from '../core/features.js';

export const IDS = { castle: 'w95817192', pub: 'w95817197' };
export const sights = [
  { id: 'folly-bridge', name: 'Folly Bridge', x: 253.5, z: 953, blurb: 'Ebenezer Perry\'s stone bridge of 1825-27 carries the Abingdon Road over the Thames in two parts, either side of Folly Island. Friar Bacon\'s study once stood on the old bridge here.' },
  { id: 'caudwells-castle', name: "Caudwell's Castle", x: 235.5, z: 988.5, blurb: 'The battlemented house on Folly Island, built in 1849 for Joshua Caudwell: statues, cast-iron balconies and a moat that is the Thames.' },
  { id: 'ferryman-terrace', name: tn('The Head of the River terrace', 'The Ferryman terrace'), x: 281, z: 977, blurb: 'A pub in an old riverside warehouse, its terrace out over the water by the bridge. A good place to watch people decide whether to jump.' },
  { id: 'grandpont-belle', name: 'The Grandpont Belle', x: STEAMER.x, z: STEAMER.z, blurb: 'A river steamer that sails from her berth by the terrace down past Christ Church Meadow to the college boathouses and back, every twelve minutes.' },
];
export const onDeck = (x, z) => pip(x, z, DECK);

export default {
  id: 'folly_bridge',
  preMap(game) {
    try {
      game.overrides.skip.add(IDS.castle);
      // photographs (docs/research/photo_comparison.md): the Head of the River is pale stone under a low hipped slate roof, not red brick
      game.overrides.style.set(IDS.pub, { wall: 'stone', roof: 'slate', shape: 'hipped', ground: 'pubFront', storeys: 3, tint: [1.06, 1.04, 0.99] });
    } catch (e) { console.error('[folly_bridge] preMap', e); }
  },

  install(game) {
    const K = shared(game), me = K.join('folly_bridge'), W = game.world, col = game.worldCollider;
    const S = { err: false, wasDeck: false, wasSwim: false, lastDryDeck: -1e9, t: 0, paidDay: null, jumps: 0 };
    try {
      addSite(K, 'folly:bridge', [253.5, 0.6, 955], 24, [80, 240, 1000], [buildBridge(0), buildBridge(1), buildBridge(2)]);
      addSite(K, 'folly:castle', [235.5, 6, 988.6], 15, [80, 230, 1000], [buildCastle(0), buildCastle(1), buildCastle(2)]);
      addSite(K, 'folly:front', [276, 1, 975], 16, [60, 160, 450], [buildWaterfront(0), buildWaterfront(1), buildWaterfront(2)]);
      K.boxes.push([215, 300, 930, 1000]);
      // colliders: the castle (its mapped outline was skipped with it), the kiosk, the tables; the
      // terrace, pontoon and gangway are walkable over the water
      col.addPolygon(CASTLE.poly);
      for (const P of [TERRACE, PONTOON, GANGWAY]) col.addWalkable(P);
      col.addBox(266.4, 976.6, 2.6, 1.8, 0.08);
      for (const [x, z] of TABLES) col.addCircle(x, z, 0.75, { low: true });
      for (const [x, z] of LAMPS) { try { W.addLampGlow(x, 3.8, z); } catch { /* stub */ } }
      // visual pass: the terrace's festoon lights join the pooled lamp lights (they light the boards and the water)
      for (const [x, z] of [[276.0, 973.6], [284.4, 978.2]]) { try { W.addLampGlow(x, 2.7, z); } catch { /* stub */ } }
    } catch (e) { console.error('[folly_bridge] build', e); } finally { K.joined(me); }

    // drinkers on the terrace (11:00-23:30, spawned only while you are near; existing voiced crowd lines)
    const pint = (i, o = {}) => ({ ...randomLook('ferryman-' + i, o), prop: 'pint' });
    const drinkers = nearSet(game, { c: [281, 977], r: 75, h0: 11, h1: 23.5, people: [
      { x: 277.6, z: 973.0, h: 2.6, look: pint(0), lines: DRINK_LINES }, { x: 278.6, z: 974.6, h: -0.6, look: pint(1) },
      { x: 282.3, z: 975.6, h: 2.2, look: pint(2, { outfit: 'tweed' }), lines: DRINK_LINES }, { x: 286.6, z: 977.7, h: 2.4, look: pint(3), pose: 'lean' },
      { x: 284.6, z: 974.6, h: -0.4, look: pint(4), pose: 'talk' }, { x: 280.4, z: 971.6, h: 0.3, look: pint(5, { outfit: 'gown' }), pose: 'phone' },
    ] });
    function tick(dt) {
      K.tick(me);
      drinkers.tick();
      const p = game.player, sw = game.swim, swimming = !!(sw && sw.active);
      if (p.place !== 'world') return;
      const now = game.time.now();
      if (!swimming) { if (onDeck(p.pos.x, p.pos.z)) S.lastDryDeck = now; }
      // a jump that starts on the deck: the terrace cheers (and pays once a game day)
      if (swimming && !S.wasSwim && now - S.lastDryDeck < 2500) {
        S.jumps++;
        const day = Math.floor(now / DAY_MS), flags = game.state.flags || (game.state.flags = {});
        if (flags.b4FollyJump !== day) {
          flags.b4FollyJump = day; game.pay(5); try { game.save(); } catch { /* */ }
          try { game.ui.toast(tn('A cheer from the Head of the River\'s terrace', 'A cheer from the Ferryman\'s terrace') + ' as you go off Folly Bridge. Someone sends £5 down in a pint glass. (Once a day.)', 6); } catch { /* */ }
        } else { try { game.ui.toast('Off Folly Bridge again. The terrace gives you a slow handclap.', 4); } catch { /* */ } }
      }
      S.wasSwim = swimming; void dt;
    }
    game.follyBridge = {
      sights, deck: DECK, onDeck, bridge: BRIDGE, pub: PUB,
      stats() { return { drinkers: drinkers.count(), jumps: S.jumps, levels: K.lod.groups.filter((g) => /^folly:/.test(g.name)).map((g) => g.name + ':' + g.level), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^folly:/.test(k)).map(([k, v]) => [k, v.tris])) }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[folly_bridge]', e); } } } };
  },
};
