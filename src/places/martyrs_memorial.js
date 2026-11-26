// The Martyrs' Memorial at the south end of St Giles' and the cross in the road in Broad Street, c. 2013 — see
// docs/research/landmarks_batch4.md (sources; known vs guessed).
//
//   preMap   the world's generic memorial silhouette (landmarks.js, keyed by the POI n16252895) is skipped: rebuilt here
//   install  the memorial (_b4_martyrs.js: steps, panelled pedestal with the inscription, three statues under canopies,
//            the lantern and crocketed spire) and the Broad Street cross, as LOD groups in the batch-4 atlas draw
//            (_b4_kit.js: ONE draw for all four batch-4 sites). Things to do: sit on the steps and people-watch (lines
//            on the shared clock: everyone sitting there hears the same), and find the cross in Broad Street.
//
// Test hooks: game.martyrs = { sights, stats(), sit(i), seats }     tools/smoke_batch4.mjs
import { shared, addSite } from './_b4_kit.js';
import { MM, CROSS, FACES, buildMemorial, buildCross } from './_b4_martyrs.js';
import { nearSet, TOURIST_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';

export const ID = 'n16252895';
export const sights = [
  { id: 'martyrs-memorial', name: "Martyrs' Memorial", x: MM.c[0], z: MM.c[1], blurb: "George Gilbert Scott's Gothic memorial of 1841-43, after the Eleanor crosses: Cranmer, Ridley and Latimer, the Protestant bishops executed in Oxford in 1555-56." },
  { id: 'broad-street-cross', name: 'The cross in Broad Street', x: CROSS.x, z: CROSS.z, blurb: 'A small cross set in the road surface outside Balliol marks the place, just outside the old city wall, where the three bishops were executed.' },
];
// what you see from the steps (invented, comic; one line per shared 20 s slot)
export const WATCH = [
  'A tour guide points up St Giles\' and says "cathedral". It is not a cathedral.',
  'Three language students take the same photograph of the spire, one after another.',
  'A cyclist rings a bell at a bus. The bus does not notice.',
  'Somebody asks where Hogwarts is. Somebody else points at Balliol.',
  'A pigeon lands on Cranmer. Cranmer does not react.',
  'Two students arrange to meet "at the Martyrs" and both wait on opposite sides.',
  'A man eats a Cornish pasty with great seriousness.',
  'An open-top bus goes round. Everyone on it waves at you.',
  'A busker by the Randolph starts Wonderwall again.',
  'A tourist reads the inscription aloud, slowly, all of it.',
];
export const watchLine = (ms) => WATCH[Math.floor(ms / 20000) % WATCH.length];

export default {
  id: 'martyrs_memorial',
  preMap(game) {
    try {
      game.overrides.skip.add(ID);
      // two great planes in St Mary Magdalen's churchyard behind the memorial (photo comparison item 5, "martyrs": a huge
      // plane over the churchyard wall). Positions and heights are a GUESS from the photograph. Map trees >= 19 m are
      // drawn as planes, with a trunk collider, by the world.
      if (game.map && game.map.trees) game.map.trees.push([80, 12, 23], [86.5, 23.5, 20.5]);
    } catch (e) { console.error('[martyrs_memorial] preMap', e); }
  },

  install(game) {
    const K = shared(game), me = K.join('martyrs_memorial');
    const col = game.worldCollider, S = { err: false, seated: false, crossT: 0, onCross: false, lastLine: -1 };
    const seats = [];
    try {
      const [cx, cz] = MM.c;
      addSite(K, 'martyrs', [cx, 11, cz], 12, [70, 220, 1300], [buildMemorial(0), buildMemorial(1), buildMemorial(2)]);
      addSite(K, 'bscross', [CROSS.x, 0.05, CROSS.z], 1.4, [55, 90, 120], [buildCross(), null, null], { layer: 8, midArea: 0, farArea: 0 });
      K.boxes.push([cx - 6, cx + 6, cz - 6, cz + 6]);
      // the steps are solid (you sit on them, from outside)
      const R = MM.steps[0][0], hex = []; for (let i = 0; i < 6; i++) { const t = MM.a0 + (i / 6) * Math.PI * 2; hex.push([cx + Math.sin(t) * R, cz + Math.cos(t) * R]); }
      col.addPolygon(hex);
      // a seat on each face's bottom step (the outer edge), facing out
      for (const t of FACES) { const ap = R * Math.cos(Math.PI / 6) + 0.38; seats.push({ x: cx + Math.sin(t) * ap, z: cz + Math.cos(t) * ap, h: t }); }
      // visual pass: floodlights at the foot of three faces (pooled lamp lights after dark: the stone lights up)
      for (const t of [FACES[0], FACES[2], FACES[4]]) { try { game.world.addLampGlow(cx + Math.sin(t) * 5.6, 0.35, cz + Math.cos(t) * 5.6); } catch { /* stub */ } }
      seats.forEach((s, i) => game.interact.add({ pos: [s.x, s.z], radius: 1.6, label: 'Sit on the steps', enabled: () => !S.seated, onUse: () => sit(i) }));
    } catch (e) { console.error('[martyrs_memorial] build', e); } finally { K.joined(me); }

    function sit(i) {
      const P = game.player, s = seats[i]; if (!s || P.vehicle) return false;
      const back = { x: P.pos.x, z: P.pos.z, h: P.heading };
      P.teleport(s.x, s.z, s.h); P.pose = 'sit'; S.seated = true; S.lastLine = -1;
      try {
        game.beginActivity({
          name: 'martyrs-steps', hint: 'Sitting on the steps of the Martyrs\' Memorial, watching St Giles\'. (Esc to get up)',
          update() { const k = Math.floor(game.time.now() / 20000); if (k !== S.lastLine) { S.lastLine = k; try { game.ui.toast(watchLine(game.time.now()), 6); } catch { /* */ } } },
          onEnd() { S.seated = false; P.pose = 'stand'; P.teleport(back.x, back.z, back.h); },
        });
      } catch (e) { S.seated = false; P.pose = 'stand'; console.warn('[martyrs_memorial] sit', e); }
      return true;
    }

    // tourists photographing the spire by day (09:30-18:00, only while you are near)
    const tl = (i) => randomLook('martyrs-tourist-' + i, { prop: i % 2 ? 'camera' : 'phone' });
    const tourists = nearSet(game, { c: MM.c, r: 70, h0: 9.5, h1: 18, people: [
      { x: MM.c[0] - 2.4, z: MM.c[1] - 8.8, h: 0.25, look: tl(0), pose: 'photo', lines: TOURIST_LINES }, { x: MM.c[0] + 3.6, z: MM.c[1] - 9.4, h: -0.35, look: tl(1), pose: 'photo' },
      { x: MM.c[0] + 1.0, z: MM.c[1] - 10.2, h: 0.05, look: tl(2), pose: 'talk' },
    ] });
    function tick(dt) {
      K.tick(me);
      tourists.tick();
      // the cross in Broad Street: a toast the first time you stand on it (each visit)
      const p = game.player, on = p.place === 'world' && Math.hypot(p.pos.x - CROSS.x, p.pos.z - CROSS.z) < 1.1;
      if (on && !S.onCross) { try { game.ui.toast('You are standing on the cross in Broad Street. Just outside the old city wall, this is where Latimer and Ridley (1555) and Cranmer (1556) were executed. The traffic goes round you.', 7); } catch { /* */ } }
      S.onCross = on; void dt;
    }
    game.martyrs = {
      sights, seats, sit,
      stats() { const g = K.lod.groups.filter((q) => q.name === 'martyrs' || q.name === 'bscross'); return { tourists: tourists.count(), levels: g.map((q) => q.level), tris: K.sites.martyrs ? K.sites.martyrs.tris : 0, seated: S.seated }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[martyrs_memorial]', e); } } } };
  },
};
