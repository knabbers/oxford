// Carfax Tower (St Martin's Tower), c. 2013 — see docs/research/city_centre_west.md.
//   preMap    the generic tower (w311139684, and its custom stair turret in world/landmarks.js) is skipped; its outline and
//             the turret are solid
//   install   the tower by hand (_cw_carfax.js) in the shared one-draw LOD of the four city-west sites (_cw_kit.js), the
//             clock whose hands follow the game clock and the two quarter boys who strike the quarters on their bells;
//             the door under the clock: pay £2.20 (10:00–17:00) and climb the 99 steps to the roof (a look-out that renders
//             the real city: _cw_kit.js createPerch).
// Shared clock only (the boys strike for everyone at the same moment); no Math.random, no network traffic.
// Test hooks: game.carfax = { sights, stats(), debugClimb(on), strike(minutes) }      tools/smoke_citywest.mjs
import * as T0 from './_cw_carfax.js';
import { HOUR_S } from '../core/time.js';
import { shared, addLevels, farCopy, createPerch, signsMesh, signsTick, signQuad, cwSigns, Batch } from './_cw_kit.js';

const { T, tp, th, PRICE, OPEN } = T0;

/** pure: the quarter boys at `minutes` past midnight -> {q (strokes this quarter, 0 = none), swing: [a, b], stroke: index or -1} */
export function strikeAt(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440, t = m % 15, q = Math.round(m / 15) % 4 || 4;
  const STROKE = 30 / HOUR_S;      // game minutes per ding-dong (half a REAL second each, whatever the length of a game hour)
  if (t >= q * STROKE) return { q: 0, swing: [0, 0], stroke: -1 };
  const k = Math.floor(t / STROKE), f = (t / STROKE) - k;
  const a = f < 0.5 ? Math.sin(f * 2 * Math.PI) : 0, b = f >= 0.5 ? Math.sin((f - 0.5) * 2 * Math.PI) : 0;
  return { q, swing: [a, b], stroke: k * 2 + (f < 0.5 ? 0 : 1) };
}
export const isOpen = (hour) => hour >= OPEN[0] && hour < OPEN[1];

export default {
  id: 'carfax_tower',
  preMap(game) {
    try {
      game.overrides.skip.add(T0.ID);
      const b = game.map.buildings.find((q) => q.id === T0.ID);
      if (b) game.worldCollider.addPolygon(b.poly);
      const [cx, cz] = tp(T.turret.a, T.turret.b); game.worldCollider.addCircle(cx, cz, T.turret.r);
    } catch (e) { console.error('[carfax_tower] preMap', e); }
  },
  install(game) {
    const W = game.world, S = shared(game), st = { err: false, said: 0, lastStroke: -1, lastMin: -1 };
    const sights = [];
    S.site('carfax', [118, 136, 328, 346]);
    const built = T0.build(S.P);
    const mid = farCopy(built.near, 0.035);       // keeps the numerals' strokes, the boys and the canopy out to 170 m
    addLevels(S, 'carfax', built.near, mid, built.far, [55, 170, 400], 48);
    const mv = T0.moving(S.P), dyn = S.dynamic('carfax-clock', mv.geo, { d: [70, 0, 0] });
    // the board by the door (prices, hours)
    const Bs = new Batch(), sg = cwSigns(W);
    { const [x0, z0] = tp(T.ha + 0.03, -0.75), [x1, z1] = tp(T.ha + 0.03, -1.5), n = [T.u[0], T.u[1]]; signQuad(Bs, sg.uv('carfax'), x0, z0, x1, z1, 1.0, 1.75, n[0], n[1], 0.01); }
    const signs = signsMesh(Bs, W, 'carfax'); if (signs) W.addStatic(signs);
    // the climb: the roof inside the parapet (the turret's head is in the north-east corner)
    const inA = T.ha - 0.48, inB = T.hb - 0.48;
    const outer = [[-inA, -inB], [inA, -inB], [inA, inB], [-inA, inB]].map(([a, b]) => tp(a, b));
    const turret = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; return tp(T.turret.a + Math.sin(a) * (T.turret.r + 0.25), T.turret.b + Math.cos(a) * (T.turret.r + 0.25)); });
    const LINES = ['North: Cornmarket, St Michael\'s Saxon tower, St Giles beyond.', 'East: down the High, past the spires to Magdalen.', 'South: St Aldate\'s, the Town Hall, and Tom Tower.', 'West: Queen Street to the castle mound and the gasworks bridge.'];
    const climb = createPerch(game, {
      place: 'cw_carfax_roof', area: 'Carfax Tower: the roof', floorY: T.roof + 0.02, outer, obstacles: [turret],
      spawn: tp(-1.2, 1.8), heading: th(1, 0), exitPt: tp(T.turret.a - 0.3, T.turret.b + T.turret.r + 0.75), doors: [{ pos: T0.DOOR.pos, facing: T0.DOOR.facing, price: PRICE, label: `Climb Carfax Tower (£${PRICE.toFixed(2)}, 99 steps)` }],
      open: () => st.debugFree || isOpen(game.time.hour), closedText: 'Carfax Tower is closed. Open 10:00–17:00.',
      upText: 'Ninety-nine steps up a turret stair barely wider than your shoulders…', toast: '23 metres up: no building in the centre may be taller.',
      lines: LINES, downLabel: 'Go back down the 99 steps',
      lookouts: [[0, -1, 'Look north up Cornmarket'], [1, 0, 'Look east down the High'], [0, 1, 'Look south down St Aldate\'s'], [-1, 0, 'Look west along Queen Street']].map(([a, b, label], k) => ({ pos: tp(a * (inA - 0.6), b * (inB - 0.6)), heading: th(a, b), pitch: 0.18, label, line: LINES[k] })),
    });
    sights.push(
      { id: 'carfax-tower', name: 'Carfax Tower', x: T.c[0], z: T.c[1], blurb: 'All that is left of St Martin\'s, the city church, pulled down in 1896 to widen the crossroads: 23 m, and nothing in the centre may be taller.' },
      { id: 'carfax-quarter-boys', name: 'The quarter boys', x: tp(T.ha, 0)[0], z: tp(T.ha, 0)[1], blurb: 'Above the 1898 clock on the east face two little figures strike the quarters on a pair of bells.' },
      { id: 'carfax-roof', name: 'Carfax Tower roof', x: T.c[0], z: T.c[1], blurb: 'Ninety-nine steps up: the dreaming spires all round, and the crossroads of the four streets below.' },
    );

    function tick(dt) {
      S.tick('carfax_tower');
      if (climb.on) climb.guard();
      signsTick(signs, game.camera, 9);
      // the clock and the boys: only rewritten while someone is near enough to see them (the chunk is drawn within 70 m)
      const c = game.camera.position, d = Math.hypot(c.x - T.c[0], c.z - T.c[1]);
      const minutes = game.time.hour * 60, s = strikeAt(minutes);
      if (d < 75) {
        const key = Math.floor(minutes * 4) + (s.q ? s.swing[0] * 10 + s.swing[1] * 100 : 0);
        if (key !== st.lastMin) { st.lastMin = key; mv.pose(minutes, s.swing); S.writeDyn(dyn, mv.geo.attributes.position.array, mv.geo.attributes.normal.array); }
      }
      // the bells: ding (A) dong (B), heard within ~150 m
      if (s.stroke !== st.lastStroke) {
        st.lastStroke = s.stroke;
        if (s.stroke >= 0 && game.audio && game.audio.ctx) {
          const [bx, bz] = tp(T.ha, 0), pl = game.audio.place(bx, bz, 160);
          if (pl.gain > 0.01) { const f = s.stroke % 2 ? 523.3 : 659.3; game.audio.tone(f, 1.6, { gain: 0.16 * pl.gain, pan: pl.pan, attack: 0.002 }); game.audio.tone(f * 2.76, 0.6, { gain: 0.04 * pl.gain, pan: pl.pan }); }
        }
        if (s.stroke === 0) st.strikes = (st.strikes || 0) + 1;
      }
      void dt;
    }
    game.carfax = {
      sights, climb: () => climb, strikeAt,
      debugClimb(on) { st.debugFree = true; const r = climb.debug(on); st.debugFree = false; return r; },
      stats() { return { lod: S.stats.carfax, total: S.total, strikes: st.strikes || 0, shadow: S.shadow, drawn: S.lod.stats }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!st.err) { st.err = true; console.error('[carfax_tower]', e); } } } };
  },
};
