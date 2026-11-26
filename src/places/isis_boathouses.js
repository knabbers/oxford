// The college boathouses and the Isis below Christ Church Meadow, c. 2013 — see docs/research/landmarks_batch4.md.
//
//   preMap   one map box south of the map's edge (x 560…860, z 1216…1470: the boathouse island and Boathouses Walk,
//            whose mapped line already runs there); the mapped first boathouse (w95661025) skipped and rebuilt with
//            the row. Nothing else of the map changes.
//   install  eight two-storey boathouses (_b4_boathouses.js: boat bays, club rooms, balconies over the river, flags of
//            invented colours, landing stages, eights on racks) in the batch-4 atlas draw (_b4_kit.js); a second crewed
//            eight (the meadow's `ccm:eight` mesh and shader, _ccm_eight.js, reused) rowing the boathouse reach on the
//            shared clock (its own mesh, drawn only within 220 m by day).
//   game     "Keep up with the crew": jog Boathouses Walk beside the eight for a minute as the coach on the bank does.
//
// Test hooks: game.boathouses = { sights, stats(), eight(tMs), follow }     tools/smoke_batch4.mjs
import { shared, addSite, DAY_MS } from './_b4_kit.js';
import { BOX, SKIP, HOUSES, footprint, stage, at, RACKS, RACK_Z, REACH, buildRow, SIGHT_AT, CARRY, WALK } from './_b4_boathouses.js';
import { createCarry, createCoach } from './_b4_life.js';
import { eightAt, createEight } from './_ccm_eight.js';

export const sights = [
  { id: 'college-boathouses', name: 'The college boathouses', x: SIGHT_AT[0], z: SIGHT_AT[1], blurb: 'The colleges\' boathouses in a row on the island below the meadow: boat bays below, balconies above for watching Torpids and Summer Eights, raced as bumps because the Isis is too narrow to race side by side.' },
  { id: 'boathouse-stages', name: 'The landing stages', x: at(30, -6)[0], z: at(30, -6)[1], blurb: 'Crews carry their eights down from the racks and boat from these stages, then row off towards Iffley.' },
];
/** the second eight's reach (pure): the boathouse reach of the river */
export function reachPath() {
  const pts = REACH, cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, L: cum[cum.length - 1] - 12 };
}
export const EIGHT_OFFSET = 97000, EIGHT_NEAR = 220;
export const FOLLOW = { secs: 60, keep: 32, lose: 48, reward: 8 };

export default {
  id: 'isis_boathouses',
  preMap(game) {
    try {
      const m = game.map;
      if (m && !m._b4Boathouses) { if (m.boxes) m.boxes.push({ ...BOX }); Object.defineProperty(m, '_b4Boathouses', { value: true, enumerable: false }); }
      for (const id of SKIP) game.overrides.skip.add(id);
    } catch (e) { console.error('[isis_boathouses] preMap', e); }
  },

  install(game) {
    const K = shared(game), me = K.join('isis_boathouses'), W = game.world, col = game.worldCollider;
    const S = { err: false, follow: null, cool: 0 };
    let eight = null; const P8 = reachPath(), e8 = {};
    try {
      // the row in two LOD groups (upstream and downstream halves) so the far half drops first
      const halves = [[0, 1, 2, 3], [4, 5, 6, 7]];
      halves.forEach((hs, k) => {
        const a = footprint(hs[0])[0], b = footprint(hs[hs.length - 1])[1], c = [(a[0] + b[0]) / 2, 4, (a[1] + b[1]) / 2], r = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 + 12;
        addSite(K, 'boathouses:' + k, c, r, [70, 220, 900], [buildRow(0, hs), buildRow(1, hs), buildRow(2, hs)]);
      });
      K.boxes.push([BOX.minX, BOX.maxX, 1190, BOX.maxZ]);
      HOUSES.forEach((_, i) => {
        const fp = footprint(i);
        col.addPolygon(fp); col.addWalkable(stage(i));
        try { W.clearArea([at(HOUSES[i][0] - 1.5, -1.5), at(HOUSES[i][0] + HOUSES[i][1] + 1.5, -1.5), at(HOUSES[i][0] + HOUSES[i][1] + 1.5, 18), at(HOUSES[i][0] - 1.5, 18)], { trees: true, furniture: true, lamps: true }); } catch { /* stub */ }
      });
      for (const [s] of RACKS) { const p = at(s, -RACK_Z); col.addBox(p[0], p[1], 1.1, 16, Math.atan2(0.7071, 0.7071), { low: true }); }
    } catch (e) { console.error('[isis_boathouses] build', e); } finally { K.joined(me); }
    try { eight = createEight(); eight.mesh.name = 'b4x:eight'; game.worldScene.add(eight.mesh); } catch (e) { console.warn('[isis_boathouses] eight', e); eight = null; }
    const eightNow = (t) => eightAt(P8, t + EIGHT_OFFSET, {});
    // visual pass: a crew carrying their eight down the walk to the stage (every 3 min of shared time), and the coach
    // cycling the towpath on the far bank level with the second eight (existing voiced crowd lines only)
    const carry = createCarry(game, CARRY, { period: 180000, walk: 18000, offset: 40000, seed: 3 });
    const n = WALK.n, towpath = (x, z, h) => {
      // from the eight across the river away from the boathouses to the first dry ground, then 2.5 m onto the towpath
      let wet = false;
      for (let d = 0; d < 40; d += 1.5) { const px = x + n[0] * d, pz = z + n[1] * d; if (col.isWater(px, pz)) wet = true; else if (wet) return { x: px + n[0] * 2.5, z: pz + n[1] * 2.5, h }; }
      return null;
    };
    const ce = {}; const coach = createCoach(game, (t) => eightAt(P8, (S.eightT ?? t) + EIGHT_OFFSET, ce), towpath, { near: 170 });

    // ---- Keep up with the crew
    const follow = {
      start() {
        if (S.follow) return;
        const e = eightNow(game.time.now());
        if (!e.rowing) { try { game.ui.toast('The crew is turning. Wait till they are rowing again.', 3); } catch { /* */ } return; }
        S.follow = { t: 0, worst: 0 };
        try { game.ui.toast('Coach: "Keep up with them! Shout the rate!" Stay level with the eight along the walk for a minute.', 5); } catch { /* */ }
      },
      stop(msg) { S.follow = null; try { game.ui.objective(null); if (msg) game.ui.toast(msg, 4); } catch { /* */ } },
    };
    try {
      const p = at(8, -0.5);
      game.interact.add({ pos: p, radius: 2.2, label: () => (S.follow ? 'Stop following the crew' : 'Coach the crew from the bank'), onUse: () => (S.follow ? follow.stop('You stop. The crew row on without you.') : follow.start()) });
    } catch (e) { console.warn('[isis_boathouses] coach', e); }

    function tick(dt) {
      K.tick(me);
      carry.tick(dt); coach.tick(dt);
      const pl = game.player, out = pl.place === 'world', cam = game.camera.position, now = S.eightT ?? game.time.now();
      if (eight) {
        eightAt(P8, now + EIGHT_OFFSET, e8);
        const on = out && Math.hypot(cam.x - e8.x, cam.z - e8.z) < EIGHT_NEAR && game.time.hour > 6 && game.time.hour < 20.5;
        if (on !== eight.mesh.visible) eight.mesh.visible = on;
        if (on) { eight.mesh.position.set(e8.x, 0.02, e8.z); eight.mesh.rotation.y = e8.h; eight.mesh.updateMatrix(); eight.uniforms.uStroke.value = e8.stroke % (Math.PI * 2000); eight.uniforms.uRow.value = e8.rowing; }
      }
      if (S.follow) {
        const F = S.follow; eightAt(P8, game.time.now() + EIGHT_OFFSET, e8);
        const d = Math.hypot(pl.pos.x - e8.x, pl.pos.z - e8.z);
        F.t += dt; F.worst = Math.max(F.worst, d);
        try { game.ui.objective(`Keep up with the crew: ${Math.max(0, FOLLOW.secs - F.t).toFixed(0)} s · ${d.toFixed(0)} m away${d > FOLLOW.keep ? ' — catch up!' : ''}`); } catch { /* */ }
        if (d > FOLLOW.lose || !out) follow.stop('The crew leave you behind. The coach sighs into his megaphone.');
        else if (F.t >= FOLLOW.secs) {
          const day = Math.floor(game.time.now() / DAY_MS), paid = (game.state.flags || {}).b4CrewDay === day;
          if (!paid) { (game.state.flags || (game.state.flags = {})).b4CrewDay = day; game.pay(FOLLOW.reward); try { game.save(); } catch { /* */ } }
          follow.stop(paid ? 'You kept up again. "Same time tomorrow," says the coach.' : `You kept level for a whole piece. The coach gives you £${FOLLOW.reward} and a squashed banana.`);
        }
      }
    }
    game.boathouses = {
      sights, follow, houses: HOUSES, footprint, stage, carry,
      eight: (tMs = game.time.now()) => eightNow(tMs),
      freezeEight(tMs) { S.eightT = tMs; return tMs == null ? null : eightNow(tMs); },
      state: () => ({ follow: S.follow && { ...S.follow } }),
      stats() { return { carry: carry.stats(), coach: coach.stats(), eightOn: !!(eight && eight.mesh.visible), levels: K.lod.groups.filter((g) => /^boathouses:/.test(g.name)).map((g) => g.level), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^boathouses:/.test(k)).map(([k, v]) => [k, v.tris])) }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[isis_boathouses]', e); } } } };
  },
};
