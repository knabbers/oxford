// Merton College, c. 2013 — see docs/research/landmarks_batch5.md (sources; known vs guessed).
//
//   preMap   the generic chapel, gate tower (Lodge), Mob Quad's ranges and library and the Fellows' Garden stretch of the
//            city wall are skipped (rebuilt here); the Merton Street fronts restyled (city draw, no cost)
//   install  the chapel (choir with its great east window, transepts) and its crossing tower — the skyline from Christ
//            Church Meadow; the gate tower with its carved panel and statues; Mob Quad in rubble and stone slates with
//            the Treasury and the Old Library's dormers; the wall onto the meadow; Merton Street's cobbles (a ground-layer
//            ribbon over the mapped setts) — all LOD groups in the ONE batch-5 atlas draw (_b5_kit.js)
//   game     the Time Ceremony: between 2 and 3 in the morning walk BACKWARDS once round Fellows' Quad (the college's own
//            joke about the clocks going back); £5 once a game day
//
// Test hooks: game.merton = { sights, stats(), ceremony }     tools/smoke_batch5.mjs
import { shared, addSite, corners, DAY_MS } from './_b5_kit.js';
import { MT, F, buildChapel, buildGate, buildMob, buildWall, buildCobbles, SOLIDS } from './_b5_merton.js';

export const IDS = {
  chapel: 'w39606739', lodge: 'w301498998', mob1: 'w301498999', mob2: 'w301499000', mob5: 'w301499001', mob6: 'w39606975', library: 'w228196820', wall: 'w59290375',
  fronts: ['w301498993', 'w301498994', 'w301498995', 'w95664347', 'w301498996'], others: ['w204276101', 'w204275576', 'w301499006', 'w301499007', 'w301499008', 'w301499009', 'w301499010', 'w301498988', 'w301498989', 'w301498990', 'w301498991', 'w301499011', 'w301498992', 'w991996414', 'w301498997', 'w39607373'],
};
export const SKIP = [IDS.chapel, IDS.lodge, IDS.mob1, IDS.mob2, IDS.mob5, IDS.mob6, IDS.library, IDS.wall];
const Q = F.Q;
export const sights = [
  { id: 'merton-tower', name: 'Merton Chapel tower', x: MT.tower.c[0], z: MT.tower.c[1], blurb: 'The chapel\'s great crossing tower, finished about 1450, rises over the meadow. The choir was complete by 1294; the nave was planned but never built.' },
  { id: 'merton-gate', name: 'Merton gate tower', x: Q(24, -19)[0], z: Q(24, -19)[1], blurb: 'The gate tower on Merton Street, licensed in 1418, with a carved panel over the gate.' },
  { id: 'merton-mob', name: 'Mob Quad', x: Q(-3, 30)[0], z: Q(-3, 30)[1], blurb: 'Built between 1288 and 1378 and often called the oldest quadrangle in Oxford; its south and west ranges hold the Old Library, with the dormers added in the 17th century.' },
  { id: 'merton-street', name: 'Merton Street\'s cobbles', x: 620, z: 386, blurb: 'One of the last cobbled streets in the city: rattling on a bicycle, treacherous in the rain.' },
  { id: 'merton-wall', name: 'The wall on Dead Man\'s Walk', x: 610, z: 480, blurb: 'The Fellows\' Garden is held up by the old city wall, facing Christ Church Meadow across Dead Man\'s Walk.' },
];

/** the Time Ceremony: accumulate the angle walked round the quad's centre while moving backwards (pure, testable) */
export function createCeremony(c = MT.fellowsQuad) {
  const S = { on: false, turn: 0, lastA: null, done: false, back: 0 };
  return {
    S,
    reset() { S.on = false; S.turn = 0; S.lastA = null; S.done = false; S.back = 0; },
    /** one step: position, the player's heading and velocity; -> 'start' | 'lap' | 'forward' | null */
    step(x, z, heading, vx, vz) {
      const dx = x - c[0], dz = z - c[1], r = Math.hypot(dx, dz);
      if (r < 4 || r > 24) { if (S.on) { S.on = false; S.turn = 0; S.lastA = null; return 'left'; } return null; }
      const sp = Math.hypot(vx, vz); if (sp < 0.4) return null;
      const fwd = Math.sin(heading) * vx + Math.cos(heading) * vz;
      const a = Math.atan2(dx, dz);
      if (fwd > 0.25 * sp) { if (S.on && Math.abs(S.turn) > 0.5) { S.on = false; S.turn = 0; S.lastA = null; return 'forward'; } S.lastA = a; return null; }
      if (fwd < -0.5 * sp) {
        if (!S.on) { S.on = true; S.turn = 0; S.lastA = a; return 'start'; }
        let d = a - S.lastA; d = Math.atan2(Math.sin(d), Math.cos(d)); S.turn += d; S.lastA = a;
        if (Math.abs(S.turn) >= Math.PI * 2) { S.on = false; S.turn = 0; S.lastA = null; S.done = true; return 'lap'; }
      }
      return null;
    },
  };
}
export const inCeremonyHours = (hour) => hour >= 2 && hour < 3;

export default {
  id: 'merton',
  preMap(game) {
    try {
      for (const id of SKIP) game.overrides.skip.add(id);
      for (const id of IDS.fronts) game.overrides.style.set(id, { wall: 'stone', roof: 'stone', storeys: 3, tint: [0.94, 0.92, 0.86] });
      for (const id of IDS.others) game.overrides.style.set(id, { wall: 'college', roof: 'stone', tint: [0.94, 0.92, 0.86] });
    } catch (e) { console.error('[merton] preMap', e); }
  },

  install(game) {
    const K = shared(game), me = K.join('merton'), W = game.world, col = game.worldCollider;
    const S = { err: false, laps: 0, lastPos: null, said: null };
    const cer = createCeremony();
    try {
      // the chapel and tower read from the meadow (~200-300 m) and the air: far level out to 1.8 km
      { const c = Q(-8, 4); addSite(K, 'mt:chapel', [c[0], 16, c[1]], 30, [110, 200, 1800], buildChapel, { farArea: 0.25 }); }
      { const c = Q(24.9, -13.8); addSite(K, 'mt:gate', [c[0], 10, c[1]], 11, [75, 180, 450], buildGate); }
      { const c = Q(-4, 31); addSite(K, 'mt:mob', [c[0], 6, c[1]], 25, [80, 190, 600], buildMob); }
      addSite(K, 'mt:wall', [606, 3, 450], 120, [90, 220, 600], buildWall);
      addSite(K, 'mt:cobbles', [597, 0.05, 396], 112, [130, 200, 260], (q) => (q === 0 ? buildCobbles() : null), { layer: 6.5, mid: false, far: false, midArea: 0, farArea: 0 });
      K.boxes.push([480, 725, 370, 520]);

      for (const poly of SOLIDS()) col.addPolygon(poly);
      { const T = MT.tower; void T; }
      // the gate tower either side of its passage; the Treasury either side of its passage
      { const R = MT.gate, g = MT.gateU; col.addPolygon([Q(20.9, -17.2), Q(g - 1.6, -17.2), Q(g - 1.6, -10.4), Q(20.9, -10.4)]); col.addPolygon([Q(g + 1.6, -17.2), Q(28.9, -17.2), Q(28.9, -10.4), Q(g + 1.6, -10.4)]); void R; }
      { const v = MT.passV; col.addPolygon([Q(7.8, 16.9), Q(14.8, 16.9), Q(14.8, v - 1.2), Q(7.8, v - 1.2)]); col.addPolygon([Q(7.8, v + 1.2), Q(14.8, v + 1.2), Q(14.8, 26.3), Q(7.8, 26.3)]); }
      // the way from the Front Quad to Patey's Quad (through the mapped Sacristy / Hall seam)
      { const a = Q(21.2, 6.5), b = Q(18.0, 19.8); col.addPassage(a[0], a[1], b[0], b[1], 1.4); }
      col.addPolyline(MT.wall);
      if (W && W.clearArea) W.clearArea(corners(MT.trans)), W.clearArea(corners(MT.choir));
      if (W && W.clearArea) for (let i = 0; i < MT.wall.length - 1; i++) { const p = MT.wall[i], r = MT.wall[i + 1], L = Math.hypot(r[0] - p[0], r[1] - p[1]) || 1, nx = (r[1] - p[1]) / L * 1.3, nz = -(r[0] - p[0]) / L * 1.3; W.clearArea([[p[0] + nx, p[1] + nz], [r[0] + nx, r[1] + nz], [r[0] - nx, r[1] - nz], [p[0] - nx, p[1] - nz]], { furniture: false, lamps: false }); }
      try { const a = Q(MT.gateU - 2.4, -17.6), b = Q(MT.gateU + 2.4, -17.6); W.addLampGlow(a[0], 3.3, a[1]); W.addLampGlow(b[0], 3.3, b[1]); } catch { /* stub */ }
    } catch (e) { console.error('[merton] build', e); } finally { K.joined(me); }

    function tick(dt) {
      K.tick(me);
      const p = game.player;
      if (p.place !== 'world' || p.vehicle || !inCeremonyHours(game.time.hour)) { if (cer.S.on) cer.reset(); S.lastPos = null; return; }
      const d = Math.hypot(p.pos.x - MT.fellowsQuad[0], p.pos.z - MT.fellowsQuad[1]);
      if (d > 30) { S.lastPos = null; return; }
      const lp = S.lastPos; S.lastPos = [p.pos.x, p.pos.z];
      if (!lp || dt <= 0) return;
      const vx = (p.pos.x - lp[0]) / dt, vz = (p.pos.z - lp[1]) / dt;
      const ev = cer.step(p.pos.x, p.pos.z, p.heading, vx, vz);
      try {
        if (ev === 'start') game.ui.toast('The Time Ceremony: walking backwards round Fellows\' Quad, to keep the space-time continuum in order. Keep going.', 5);
        else if (ev === 'forward') game.ui.toast('You turned round. The continuum wobbles. Start again.', 3);
        else if (ev === 'lap') {
          S.laps++;
          const day = Math.floor(game.time.now() / DAY_MS), flags = game.state.flags || (game.state.flags = {});
          if (flags.b5MertonTime !== day) { flags.b5MertonTime = day; game.pay(5); try { game.save(); } catch { /* */ } game.ui.toast('Once round Fellows\' Quad, backwards. Time is safe for another year. A fellow hands you £5 and a glass of port. (Once a day.)', 6); }
          else game.ui.toast('Round again, backwards. Time is extremely safe now.', 3);
        }
      } catch { /* */ }
    }

    game.merton = {
      sights, ids: IDS, ceremony: cer,
      stats() { const gs = K.lod.groups.filter((q) => /^mt:/.test(q.name)); return { levels: Object.fromEntries(gs.map((q) => [q.name, q.level])), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^mt:/.test(k)).map(([k, v]) => [k, v.tris])), laps: S.laps }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[merton]', e); } } } };
  },
};
