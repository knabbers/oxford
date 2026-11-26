// A bike time trial to stumble on: a chalked start line on Boathouses Walk with a stopwatch post beside it, a chalked
// finish 165 m on by the river (_timetrial_logic.js). Ride over the start line on a bicycle and the clock starts; over
// the finish and it stops. Your best is saved (localStorage['gto-timetrial']) and shown on the post ([E] Read the board).
// The first ride pays £2, a new best £1. Nothing is sent: peers' times are not on the board (that would need a new
// network message; see the report).
//
// Cost: one small merged draw (the post and the two chalk lines, batch-4 atlas) within 120 m.
// Test hooks: game.timeTrial = { best(id), stats() }   tools/smoke_todo.mjs
import * as THREE from 'three';
import { b4Pack, geoOf, RB } from '../places/_b4_kit.js';
import { TRIALS, crossed, fmt } from './_timetrial_logic.js';

const KEY = 'gto-timetrial';

export default {
  id: 'timetrial',
  install(game) {
    const S = { err: false, run: null, last: null, lastXZ: [0, 0], built: false, mesh: null, rides: 0 };
    let best = {};
    try { best = JSON.parse(globalThis.localStorage.getItem(KEY) || '{}') || {}; } catch { best = {}; }
    const save = () => { try { globalThis.localStorage.setItem(KEY, JSON.stringify(best)); } catch { /* */ } };
    const toast = (t, s = 5) => { try { game.ui.toast(t, s); } catch { /* */ } };
    const now = () => game.time.now();
    function build() {
      const B = new RB(), g = (x, z) => (game.world && game.world.groundHeight ? game.world.groundHeight(x, z) : 0);
      for (const t of TRIALS) {
        const h = Math.atan2(t.dir[0], t.dir[1]);
        for (const p of [t.start, t.finish]) { B.box('chalk', p[0], g(p[0], p[1]) + 0.012, p[1], t.half * 2, 0.012, 0.16, h); B.box('chalk', p[0] + t.dir[0] * 0.5, g(p[0], p[1]) + 0.012, p[1] + t.dir[1] * 0.5, t.half * 2, 0.012, 0.1, h); }
        const [px, pz] = t.post, y = g(px, pz);
        B.cyl('iron', px, y, pz, 0.05, 1.7, 6, true); B.box('white', px, y + 1.55, pz, 0.62, 0.42, 0.05, h); B.cyl('dark', px, y + 1.55, pz + 0.04, 0.12, 0.02, 10, true);
      }
      const pack = b4Pack(game.world), geo = geoOf(B, pack);
      if (geo) { S.mesh = new THREE.Mesh(geo, pack.atlas); S.mesh.name = 'timetrial'; S.mesh.receiveShadow = true; S.mesh.visible = false; game.worldScene.add(S.mesh); }
      for (const t of TRIALS) {
        try { game.interact.add({ pos: t.post, radius: 2.2, label: 'Read the stopwatch board', onUse: () => toast(`Stopwatch post: ${t.name}, start line to finish line on a bicycle. Your best: ${best[t.id] ? fmt(best[t.id]) : 'no time yet'}.`, 6) }); } catch { /* */ }
      }
    }
    function tick() {
      if (!S.built) { S.built = true; try { build(); } catch (e) { console.error('[timetrial] build', e); } }
      const p = game.player, v = p.vehicle, onBike = p.place === 'world' && v && v.kind === 'bike';
      const x = p.pos.x, z = p.pos.z;
      if (S.mesh) { const c = game.camera.position, t = TRIALS[0]; S.mesh.visible = Math.hypot(c.x - t.start[0], c.z - t.start[1]) < 200; }
      if (S.last && onBike) {
        for (const t of TRIALS) {
          if (crossed(t.start, t.dir, t.half, S.last[0], S.last[1], x, z)) { S.run = { t, t0: now() }; toast(`On your marks... GO! (${t.name}${best[t.id] ? ', best ' + fmt(best[t.id]) : ''})`, 3); }
          else if (S.run && S.run.t === t && crossed(t.finish, t.dir, t.half, S.last[0], S.last[1], x, z)) {
            const secs = (now() - S.run.t0) / 1000; S.run = null; S.rides++;
            const prev = best[t.id];
            if (!prev || secs < prev) { best[t.id] = secs; save(); game.pay(prev ? 1 : 2); toast(`${fmt(secs)}! ${prev ? `A new best (was ${fmt(prev)}). +£1` : 'Your first time on the board. +£2'}`, 5); }
            else toast(`${fmt(secs)}. Your best is still ${fmt(prev)}.`, 4);
          }
        }
      }
      if (S.run && (!onBike || now() - S.run.t0 > 180000)) { S.run = null; }
      if (onBike) { S.lastXZ[0] = x; S.lastXZ[1] = z; S.last = S.lastXZ; } else S.last = null;
    }
    game.timeTrial = { best: (id) => best[id], stats: () => ({ running: !!S.run, rides: S.rides, best: { ...best } }) };
    return { id: 'timetrial', update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[timetrial]', e); } } } };
  },
};
