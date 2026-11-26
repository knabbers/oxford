// Breath you can see on a cold morning (fidelity pass, 2026-11). When the shared weather's temperature drops under
// about 6 °C (the game's term runs October to December: most nights and early mornings late in term, any frosty day)
// everybody outdoors near you breathes out a small cloud — you, the other players, the walkers within 24 m, people
// sitting on benches, cyclists — and cars and buses crawling or standing in the cold trail a wisp of exhaust.
//   rule        strength = clamp((6.5 − tempC) / 3): nothing at 6.5 °C and above, full from 3.5 °C down
//   who / when  each person breathes on their own rhythm: a period of 2.8–3.6 s from their look seed (half that at a
//               run), counted on the SHARED clock, so two players watching the same walker see the same breath
//   multiplayer nothing sent: the temperature is the shared weather's, the people are where every client has them
//   drawn       in the pass's one pooled Points draw (systems/_fid.js fidPuffs: the vehicles' puff shader, no new
//               program); at most 26 sources; hidden when empty
//   off         ?breath=0 (node: GTO_BREATH=0)
//   cost        warm: one comparison a frame. Cold: a 4 Hz scan of the walkers near + ≤ 26 sources a frame (~3 µs)
// game.breath = { strength, sources, emitted, stats() }                    test: tools/smoke_fidelity.mjs
import { fidOn, fidPuffs, h01 } from './_fid.js';

const RANGE = 24, CAR_RANGE = 30, MAX = 26;
/** pure: 0..1 how visible breath is at this temperature */
export const breathStrength = (tempC) => (tempC === undefined || tempC === null ? 0 : Math.max(0, Math.min(1, (6.5 - tempC) / 3)));
/** pure: the breathing period (s) and phase (s) of the person with this seed */
export const breathRhythm = (seed, fast) => ({ period: (2.8 + 0.8 * h01(seed, 11)) * (fast ? 0.5 : 1), phase: 4 * h01(seed, 12) });
/** pure: which breath (an integer) the person with this seed is on at shared time ms */
export const breathIndex = (seed, ms, fast) => { const r = breathRhythm(seed, fast); return Math.floor((ms / 1000 + r.phase) / r.period); };
const QUIET = { drive: 1, swim: 1, dive: 1, hang: 1, tumble: 1, tumblef: 1, knocked: 1, knockedf: 1, fall: 1 };

export default {
  id: 'breath',
  install(game) {
    if (!fidOn('breath')) { game.breath = { off: true, strength: 0, sources: 0, emitted: 0, stats: () => ({ off: true, sources: 0, emitted: 0 }) }; return null; }
    const P = fidPuffs(game);
    // kinds as the Puffs rows: [r, g, b, alpha, size0, size1, life, rise, drag, gravity] (colour follows the daylight)
    const K_BREATH = [0.95, 0.96, 0.98, 0.32, 0.08, 0.6, 1.5, 0.22, 2.0, 0], K_EXH = [0.8, 0.8, 0.82, 0.34, 0.1, 0.8, 1.5, 0.45, 1.6, 0];
    const A_BREATH = 0.32, A_EXH = 0.3;
    const src = [], state = new WeakMap(), tmp = [];
    let scanT = 0, k = 0, emitted = 0, exT = 0;
    const st = (o) => { let s = state.get(o); if (!s) state.set(o, (s = { c: null, burst: 0, bt: 0 })); return s; };
    const push = (ch, seed, speed) => { if (src.length < MAX && ch && ch.group && ch.group.visible !== false && !QUIET[ch.pose]) src.push({ ch, seed: seed | 0, speed: speed || 0 }); };
    const api = game.breath = { get strength() { return k; }, get sources() { return src.length; }, get emitted() { return emitted; }, breathStrength, breathIndex, stats: () => ({ strength: +k.toFixed(2), sources: src.length, emitted, alive: P.alive }) };
    return {
      id: 'breath',
      update(dt) {
        P.step(dt, 'breath');
        const W = game.weather, pl = game.player;
        k = W && pl.place === 'world' ? breathStrength(W.tempC) : 0;
        if (k <= 0) { if (src.length) src.length = 0; return; }
        const wp = pl.pos, now = game.time.now();
        if ((scanT -= dt) <= 0) {
          scanT = 0.25; src.length = 0;
          if (!pl.swim && !pl.ride && !(pl.vehicle && pl.pose === 'drive')) push(pl.character, (game.net && game.net.id) || 1, pl.vehicle ? 0 : pl.speed);
          if (game.net) for (const o of game.net.others.values()) if (o.place === 'world' && !o.ride && (o.x - wp.x) ** 2 + (o.z - wp.z) ** 2 < RANGE * RANGE) push(o.character, o.id, o.veh ? 0 : o.speed);
          const peds = game.pedestrians;
          if (peds && peds.near) for (const p of peds.near(wp.x, wp.z, RANGE, tmp)) { if (!p.active || p.down || p.dog === true || !p.character) continue; push(p.character, p.lookSeed || p.sid || p.poolIdx || 7, p.speed); }
          const day = game.time.daylight === undefined ? 1 : game.time.daylight, b = 0.3 + 0.7 * day;
          K_BREATH[0] = 0.95 * b; K_BREATH[1] = 0.96 * b; K_BREATH[2] = 0.98 * b; K_BREATH[3] = A_BREATH * k;
          K_EXH[0] = K_EXH[1] = 0.8 * b; K_EXH[2] = 0.82 * b; K_EXH[3] = A_EXH * k;
        }
        const wind = W.wind || null, wx = wind ? Math.sin(wind.dir || 0) * (wind.speed || 0) * 0.12 : 0, wz = wind ? -Math.cos(wind.dir || 0) * (wind.speed || 0) * 0.12 : 0;   // (dir = the way it blows: world (sin, -cos))
        for (let i = 0; i < src.length; i++) {
          const s = src[i], ch = s.ch, g = ch.group, q = st(ch), c = breathIndex(s.seed, now, s.speed > 3.4);
          if (q.c === null) q.c = c;                     // (first seen: wait for their next breath)
          else if (c !== q.c) { q.c = c; q.burst = 5; q.bt = 0; }
          if (q.burst <= 0 || (q.bt -= dt) > 0) continue;
          q.bt = 0.08; q.burst--;
          const h = g.rotation.y, sc = ch.dims && ch.dims.s ? ch.dims.s : 1, fx = Math.sin(h), fz = Math.cos(h);
          const hy = ch.pose === 'sit' || ch.pose === 'sitground' ? 1.17 : ch.pose === 'cycle' ? 1.42 : 1.5;
          P.emit(K_BREATH, g.position.x + fx * 0.16, g.position.y + hy * sc, g.position.z + fz * 0.16, fx * 0.75 + wx, 0.05, fz * 0.75 + wz, 0.1);
          emitted++;
        }
        // exhaust: motor traffic standing or crawling near the camera
        if ((exT -= dt) <= 0 && game.traffic && game.traffic.list) {
          exT = 0.3;
          for (const a of game.traffic.list) {
            if (!a.active || a.kind !== 'car' || a.speed > 6) continue;
            const dx = a.x - wp.x, dz = a.z - wp.z; if (dx * dx + dz * dz > CAR_RANGE * CAR_RANGE) continue;
            const fx = Math.sin(a.heading), fz = Math.cos(a.heading), r = (a.half || 2) + (a.radius || 0.8) * 0.6;
            P.emit(K_EXH, a.x - fx * r + fz * 0.45, (a.y || 0) + 0.3, a.z - fz * r - fx * 0.45, -fx * 0.7 + wx, 0.1, -fz * 0.7 + wz, 0.12);
            emitted++;
          }
        }
        void api;
      },
    };
  },
};
