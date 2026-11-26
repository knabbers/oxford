// Oxford Castle and the Castle Mound, c. 2013 — see docs/research/city_centre_west.md.
//   preMap    the generic St George's Tower (w30668669) is skipped; the tower and the mound are solid; the mound's mapped
//             paths are closed to the ambient walkers (they would walk through it); D-Wing and the round building are
//             skipped and hand-built (grey coral rag, rows of small barred windows, slate, a battlemented gate bastion);
//             the A-Wing range (a hotel since 2005-06) is restyled grey with small windows
//   install   the tower, the motte with its stepped path, handrail and the well-head on top, the weir on the Castle Mill
//             Stream (_cw_castle.js), the courtyard's restaurant tables and boards (real names; invented under ?invented=1), all in the shared
//             one-draw LOD (_cw_kit.js); two look-outs: the mound (£1, 10:00–17:00) and the tower's roof on the castle
//             tour (£9.25, 101 steps); a guide by the tower door with stories (shared-clock lines).
// No Math.random, no network traffic.  Test hooks: game.castle = { sights, stats(), debugClimb(which, on) }
import { shared, addLevels, farCopy, createPerch, cwSigns, signsMesh, signsTick, signQuad, Batch, TAU } from './_cw_kit.js';
import * as K from './_cw_castle.js';

export const OPEN = [10, 17], MOUND_PRICE = 1, TOUR_PRICE = 9.25;
export const isOpen = (hour) => hour >= OPEN[0] && hour < OPEN[1];
const GUIDE_LINES = ['This tower is older than the castle: a Saxon watch on the west gate, nine hundred and fifty years old.', 'In 1142 the Empress Matilda escaped from here across the snow, dressed in white. Allegedly.',
  'Prison until 1996, hotel since 2005. Same rooms, nicer pillows.', 'One hundred and one steps to the top. Mind your heads.', 'The mound is older than the stone: Robert d\'Oyly had it heaped up in 1071.'];

export default {
  id: 'oxford_castle',
  preMap(game) {
    try {
      const ov = game.overrides, map = game.map, C = game.worldCollider;
      ov.skip.add(K.TOWER_ID);
      const t = map.buildings.find((q) => q.id === K.TOWER_ID); if (t) C.addPolygon(t.poly);
      const base = K.moundBase(map); if (base) C.addPolygon(base);
      // D-Wing and the round building are hand-built in rubble (_cw_castle.js prison()); they stay solid
      for (const id of [K.DWING, K.ROUND]) { ov.skip.add(id); const b = map.buildings.find((q) => q.id === id); if (b) C.addPolygon(b.poly); }
      // the big A-Wing range (the hotel) keeps the city's renderer, in grey stone with small windows
      ov.style.set(K.RANGE, { wall: 'stone', roof: 'slate', tint: [0.6, 0.6, 0.6], up: 'stoneSmall', ground: 'stoneSmall', first: 'stoneSmall', ivy: false });
      if (base) for (const r of map.roads) { if (!r.pts || !/footway|steps|path/.test(r.kind)) continue; const n = r.pts.filter((p) => inPoly(p, base)).length; if (n >= Math.max(1, r.pts.length - 1)) r.access = 'no'; }
    } catch (e) { console.error('[oxford_castle] preMap', e); }
  },
  install(game) {
    const W = game.world, map = game.map, S = shared(game), st = { err: false, said: 0, debugFree: false };
    S.site('castle', [-260, -160, 270, 440]);
    const base = K.moundBase(map);
    if (base) { try { W.clearArea(base, { trees: true, furniture: true, lamps: true }); } catch { /* */ } }
    { const t = map.buildings.find((q) => q.id === K.TOWER_ID); if (t) { try { W.clearArea(t.poly, { trees: true, furniture: true, lamps: true }); } catch { /* */ } } }
    const g = K.build(S.P, map), yard = K.courtyard(S.P, map);
    addLevels(S, 'castle', g.near, farCopy(g.near, 0.8), g.far, [70, 200, 600], 48);
    addLevels(S, 'castleyard', yard.geo, null, null, [45, 0, 0], 48);
    for (const [x, z] of yard.tables) game.worldCollider.addCircle(x, z, 0.55);
    // boards: the hotel on D-Wing, the restaurants, the castle at the entrance from New Road, the mound's prices
    const sg = cwSigns(W), Bs = new Batch();
    const board = (name, cx, cz, nx, nz, w, y0, y1) => { const ux = nz, uz = -nx; /* left -> right as seen from the front */ signQuad(Bs, sg.uv(name), cx - ux * w / 2, cz - uz * w / 2, cx + ux * w / 2, cz + uz * w / 2, y0, y1, nx, nz, 0.04); };
    board('hotel', -221.3, 375.0, 0.288, 0.957, 4.0, 3.4, 3.9);
    board('grill', -200.8, 371.65, -0.815, -0.58, 3.4, 3.0, 3.42);
    board('pizza', -189.5, 370.4, 0.565, -0.824, 3.4, 3.0, 3.42);
    board('cafeC', -206.5, 371.5, 0, 1, 3.2, 2.9, 3.3);
    board('castle', -184.6, 339.6, 0.62, -0.78, 2.6, 1.7, 2.02); board('castle', -184.6, 339.6, -0.62, 0.78, 2.6, 1.7, 2.02);
    game.worldCollider.addCircle(-184.6, 339.6, 0.3);
    const path = K.moundPath(map), p0 = path[0], ra = Math.atan2(p0[0] - K.MOUND.c[0], p0[2] - K.MOUND.c[1]);
    const moundDoor = { pos: [p0[0] + Math.sin(ra) * 2.2, p0[2] + Math.cos(ra) * 2.2], facing: ra };
    board('mound', moundDoor.pos[0] + Math.sin(ra + 1.2) * 1.4, moundDoor.pos[1] + Math.cos(ra + 1.2) * 1.4, Math.sin(ra), Math.cos(ra), 1.0, 1.0, 1.5);
    { const [x, z] = K.tw(0.6 + 1.6, K.TW.hb + 0.04); board('castle', x, z, K.TW.v[0], K.TW.v[1], 1.6, 2.6, 2.8); }
    const signs = signsMesh(Bs, W, 'castle'); if (signs) W.addStatic(signs);
    // the mound top
    const MC = K.MOUND, ringN = 18, R = MC.top - 0.75;
    const outer = Array.from({ length: ringN }, (_, k) => { const a = (k / ringN) * TAU; return [MC.c[0] + Math.sin(a) * R, MC.c[1] + Math.cos(a) * R]; });
    const wellHead = [[-1.5, -1.3], [1.5, -1.3], [1.5, 1.3], [-1.5, 1.3]].map(([x, z]) => { const c = Math.cos(0.3), s = Math.sin(0.3); return [MC.c[0] + 0.5 + x * c + z * s, MC.c[1] + 4.0 - x * s + z * c]; });
    const pTop = path[path.length - 1];
    const MLINES = ['West: the Castle Mill Stream and the gasworks bridge.', 'North-east: Nuffield\'s green spire, then the whole skyline of spires.', 'South: the Westgate, and the hills beyond.', 'Below: the prison yard, now people eating pizza.'];
    const mound = createPerch(game, {
      place: 'cw_mound', area: 'The Castle Mound', floorY: MC.h + 0.02, outer, obstacles: [wellHead],
      spawn: [pTop[0] + (MC.c[0] - pTop[0]) * 0.15, pTop[2] + (MC.c[1] - pTop[2]) * 0.15], heading: Math.atan2(MC.c[0] - pTop[0], MC.c[1] - pTop[2]), exitPt: [pTop[0] + (MC.c[0] - pTop[0]) * 0.1, pTop[2] + (MC.c[1] - pTop[2]) * 0.1],
      doors: [{ pos: moundDoor.pos, facing: moundDoor.facing, price: MOUND_PRICE, label: `Climb the castle mound (£${MOUND_PRICE.toFixed(2)})` }],
      open: () => st.debugFree || isOpen(game.time.hour), closedText: 'The mound gate is locked. Open 10:00–17:00.',
      upText: 'Round and round the motte, up the steps…', toast: 'The top of the motte: eighteen metres of earth heaped up in 1071.', lines: MLINES, downLabel: 'Walk back down the mound',
      lookouts: [[0, -1, 'Look north'], [1, 0, 'Look east'], [0, 1, 'Look south'], [-1, 0, 'Look west']].map(([a, b, label], k) => ({ pos: [MC.c[0] + a * (R - 1.2), MC.c[1] + b * (R - 1.2)], heading: Math.atan2(a, b), pitch: 0.12, label, line: MLINES[[1, 3, 2, 0][k]] })),
    });
    // the tower top (the castle tour)
    const T = K.TW, tin = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => K.tw(a * (T.ha - 0.85 / T.taper), b * (T.hb - 0.85 / T.taper), T.roof));
    const TLINES = ['Below you, the Castle Mill Stream, where the mill wheel turned until 1930.', 'East, the mound, and over it the city\'s spires.', 'D-Wing below: cells once, hotel rooms now.'];
    const tower = createPerch(game, {
      place: 'cw_georges', area: 'St George\'s Tower', floorY: T.roof + 0.02, outer: tin, spawn: K.tw(0, 0, T.roof), heading: K.twH(1, 0), exitPt: K.tw(-T.ha * 0.45, -T.hb * 0.45, T.roof),
      doors: [{ pos: K.TOWER_DOOR.pos, facing: K.TOWER_DOOR.facing, price: TOUR_PRICE, label: `Castle tour: up St George's Tower (£${TOUR_PRICE.toFixed(2)}, 101 steps)` }],
      open: () => st.debugFree || isOpen(game.time.hour), closedText: 'The last tour has gone. Tours 10:00–17:00.',
      upText: 'A hundred and one steps, worn into dips by nine centuries of boots…', toast: 'The top of St George\'s Tower, the oldest building in Oxford.', lines: TLINES, downLabel: 'Go back down the tower',
    });
    // the guide at the tower door
    let guide = null;
    try { const [gx, gz] = K.tw(-1.9, T.hb + 1.4); guide = game.pedestrians.spawnAt(gx, gz, null, { heading: K.twH(0, 1), label: 'Castle guide', lines: GUIDE_LINES, knockable: false }); } catch { /* tests */ }
    game.interact.add({ place: 'world', pos: K.tw(-1.9, T.hb + 1.4), radius: 1.8, label: 'Ask the guide about the castle', onUse: () => { st.said++; const line = GUIDE_LINES[(st.said + Math.floor(game.time.now() / 60000)) % GUIDE_LINES.length]; try { if (guide && guide.character && guide.character.say) guide.character.say(line, 5); game.ui.toast(line, 5); } catch { /* */ } } });
    const sights = [
      { id: 'st-georges-tower', name: 'St George\'s Tower', x: T.c[0], z: T.c[1], blurb: 'Coral rag rubble, tapering as it rises: the oldest building in Oxford, an 11th-century watch tower on the west gate.' },
      { id: 'castle-mound', name: 'The Castle Mound', x: MC.c[0], z: MC.c[1], blurb: 'The motte Robert d\'Oyly heaped up in 1071: steps spiral to the top, and a well chamber lies beneath it.' },
      { id: 'castle-d-wing', name: 'D-Wing', x: -222, z: 370, blurb: 'The 18th-century prison range against the tower: Oxford\'s gaol until 1996, hotel rooms since 2005.' },
      { id: 'castle-yard', name: 'The castle courtyard', x: -205, z: 360, blurb: 'The old prison yard: restaurants and tables where the exercise yard was.' },
      { id: 'castle-mill-stream', name: 'Castle Mill Stream', x: -250, z: 383, blurb: 'The branch of the Thames that fed the castle\'s moat; a weir marks where the castle mill stood until 1930.' },
    ];
    function tick(dt) {
      S.tick('oxford_castle');
      if (mound.on) mound.guard(); if (tower.on) tower.guard();
      signsTick(signs, game.camera, 28);
      void dt;
    }
    game.castle = {
      sights, mound: () => mound, tower: () => tower, moundDoor,
      debugClimb(which, on) { st.debugFree = true; const p = which === 'tower' ? tower : mound; const r = p.debug(on); st.debugFree = false; return r; },
      stats() { return { lod: S.stats.castle, yard: S.stats.castleyard }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!st.err) { st.err = true; console.error('[oxford_castle]', e); } } } };
  },
};

function inPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) c = !c; } return c; }
