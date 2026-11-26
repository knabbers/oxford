// New College, c. 2013 — see docs/research/landmarks_batch5.md (sources; known vs guessed).
//
//   preMap   the generic chapel, hall, Muniment Tower, bell tower, gate tower (Old Lodge), cloister, the Holywell lodge,
//            the city wall and the Mound's wood are skipped (rebuilt here); the Holywell front (Scott's New Buildings)
//            and the Great Quad ranges are restyled (city draw, no cost)
//   install  the chapel and hall range with its Perpendicular windows, pinnacles and battlements, the Muniment Tower, the
//            bell tower, the gate tower on New College Lane with its statues, the cloister (walk in: the walks, the
//            wagon ceilings, the holm oak in the garth), the city wall with its bastions along the garden, the Mound,
//            the Robinson Tower on Holywell — as LOD groups in the ONE batch-5 atlas draw (_b5_kit.js)
//   game     climb the Mound for the view over the garden (a camera activity: the steps are steep, nothing to fall off)
//
// Test hooks: game.newCollege = { sights, stats(), climb(), ids }     tools/smoke_batch5.mjs
import { shared, addSite, corners, DAY_MS } from './_b5_kit.js';
import { NC, Q, A, buildChapelRange, buildGate, buildCloister, buildWall, buildMound, buildRobinson, moundFoot } from './_b5_newcoll.js';

export const IDS = {
  chapel: 'w23762392', hall: 'w23950697', muniment: 'w23950708', bell: 'w126369404', gate: 'w126369411', cloister: 'r11267',
  undercroft: 'w297867730', lodge: 'w228200461', wall: 'w23762464', wall2: 'w126369476', moundWood: 'w295073492',
  newBuildings: 'w126369479', oldBuildings: ['r3961794', 'r3961794_1'],
};
export const SKIP = [IDS.chapel, IDS.hall, IDS.muniment, IDS.bell, IDS.gate, IDS.cloister, IDS.undercroft, IDS.lodge, IDS.wall, IDS.wall2, IDS.moundWood];
const P = (u, v) => Q(u, v);
export const sights = [
  { id: 'nc-gate', name: 'New College gate tower', x: P(-32, 3)[0], z: P(-32, 3)[1], blurb: 'The gate tower on New College Lane, part of William of Wykeham\'s first building of 1379-86: the Virgin, an angel and the kneeling founder stand in its niches.' },
  { id: 'nc-chapel', name: 'New College Chapel and Hall', x: P(5, -10)[0], z: P(5, -10)[1], blurb: 'Chapel and hall make one long range on the north side of the Great Quad, the first college quadrangle planned as a whole. The chapel follows Merton\'s, without the transepts and tower.' },
  { id: 'nc-cloister', name: 'The cloister and the holm oak', x: NC.oak[0], z: NC.oak[1], blurb: 'Consecrated as a burial ground in 1400. The great evergreen oak in the garth has been in more films than most actors.' },
  { id: 'nc-bell-tower', name: 'The bell tower', x: NC.bell.c[0], z: NC.bell.c[1], blurb: 'A four-storey tower of about 1400, built on the line of the city wall. Its five bells were recast as eight in 1655; two more came in 1712.' },
  { id: 'nc-city-wall', name: 'The city wall', x: 700, z: 82, blurb: 'Oxford\'s medieval wall, with its semicircular bastions. When the college took the land in 1379 Wykeham agreed to keep it up, and it is still the best-preserved stretch in the city.' },
  { id: 'nc-mound', name: 'The Mound', x: NC.mound.c[0], z: NC.mound.c[1], blurb: 'A garden mount first laid out in 1594, given steps in 1649, for looking out over the garden and the wall.' },
  { id: 'nc-holywell', name: 'New Buildings, Holywell Street', x: 640.8, z: 16, blurb: 'The long High Victorian range on Holywell (George Gilbert Scott, 1872) and Basil Champneys\' Robinson Tower over the gate (1896).' },
];

const MOUND_VIEW = [
  'From the top of the Mound: the garden, the long line of the city wall, and the chapel\'s pinnacles over the Garden Quad.',
  'The wall turns the corner here at a bastion. Beyond it, the backs of Holywell Street.',
  'Somebody is reading on the lawn below. Somebody else is pretending to.',
  'You can see why they built it: on a garden this flat, a hill is a luxury.',
];

export default {
  id: 'new_college',
  preMap(game) {
    try {
      for (const id of SKIP) game.overrides.skip.add(id);
      game.overrides.style.set(IDS.newBuildings, { wall: 'college', roof: 'slate', storeys: 4, tint: [0.98, 0.95, 0.88] });
      for (const id of IDS.oldBuildings) game.overrides.style.set(id, { wall: 'college', roof: 'lead', storeys: 3, tint: [0.95, 0.94, 0.9] });
    } catch (e) { console.error('[new_college] preMap', e); }
  },

  install(game) {
    const K = shared(game), me = K.join('new_college'), W = game.world, col = game.worldCollider;
    const S = { err: false, climbing: false, lastLine: -1, climbs: 0 };
    try {
      addSite(K, 'nc:chapel', [...(() => { const c = P(10, -24); return [c[0], 12, c[1]]; })()], 42, [110, 165, 1500], buildChapelRange, { farArea: 0.25 });
      { const c = P(-25.5, 3); addSite(K, 'nc:gate', [c[0], 9, c[1]], 12, [75, 180, 450], buildGate); }
      { const c = P(-58, -19.5); addSite(K, 'nc:cloister', [c[0], 5, c[1]], 32, [75, 150, 550], buildCloister); }
      addSite(K, 'nc:wall:west', [560, 5, 55], 66, [85, 150, 550], (q) => buildWall(q, 'west'));
      addSite(K, 'nc:wall:north', [700, 5, 78], 58, [85, 150, 550], (q) => buildWall(q, 'north'));
      addSite(K, 'nc:wall:east', [757, 5, 155], 68, [85, 150, 550], (q) => buildWall(q, 'east'));
      addSite(K, 'nc:mound', [NC.mound.c[0], 3, NC.mound.c[1]], 17, [80, 180, 450], buildMound);
      addSite(K, 'nc:robinson', [NC.robinson.c[0], 10, NC.robinson.c[1]], 12, [80, 200, 800], buildRobinson);
      K.boxes.push([470, 765, 35, 225]);

      // ---- collision: the rebuilt buildings, the gate's passage open, the cloister walks open, the wall and bastions
      const solid = (R) => col.addPolygon(corners(R));
      solid(NC.choir); solid(NC.ante); solid(NC.hall);
      for (const T of [NC.muniment, NC.bell]) { const c = T.c, w = T.w / 2, u = [Math.cos(A), Math.sin(A)], v = [-Math.sin(A), Math.cos(A)]; col.addPolygon([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c[0] + (u[0] * a + v[0] * b) * w, c[1] + (u[1] * a + v[1] * b) * w])); }
      { const g = NC.gateV; col.addPolygon([P(-31, -1), P(-20, -1), P(-20, g - 1.65), P(-31, g - 1.65)]); col.addPolygon([P(-31, g + 1.65), P(-20, g + 1.65), P(-20, 7), P(-31, 7)]); }
      { const R = NC.robinson, u = [Math.cos(A), Math.sin(A)], v = [-Math.sin(A), Math.cos(A)], w = R.w / 2; col.addPolygon([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [R.c[0] + (u[0] * a + v[0] * b) * w, R.c[1] + (u[1] * a + v[1] * b) * w])); }
      // the cloister: the outer wall (with the door from the quad passage) and the garth arcade (open in the middle of
      // each side); the passage through the mapped block between the quad and the cloister's east walk
      const C = NC.cloister, seg = (a, b) => col.addSegment(a[0], a[1], b[0], b[1]);
      seg(P(C.u0, C.v0), P(C.u1, C.v0)); seg(P(C.u1, C.v0), P(C.u1, C.door - 0.85)); seg(P(C.u1, C.door + 0.85), P(C.u1, C.v1)); seg(P(C.u1, C.v1), P(C.u0, C.v1)); seg(P(C.u0, C.v1), P(C.u0, C.v0));
      const g = [[C.gu0, C.gv0], [C.gu1, C.gv0], [C.gu1, C.gv1], [C.gu0, C.gv1]];
      for (let i = 0; i < 4; i++) { const a = g[i], b = g[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]), du = (b[0] - a[0]) / L, dv = (b[1] - a[1]) / L, half = L / 2; seg(P(a[0], a[1]), P(a[0] + du * (half - 1.1), a[1] + dv * (half - 1.1))); seg(P(a[0] + du * (half + 1.1), a[1] + dv * (half + 1.1)), P(b[0], b[1])); }
      { const a = P(-18.6, C.door), b = P(-34.0, C.door); col.addPassage(a[0], a[1], b[0], b[1], 1.5); }
      col.addCircle(NC.oak[0], NC.oak[1], 0.9);
      col.addPolyline(NC.wall); col.addPolyline(NC.wall2);
      for (const [bx, bz] of NC.bastions) col.addCircle(bx, bz, 3.1);
      col.addCircle(NC.mound.c[0], NC.mound.c[1], NC.mound.r - 0.8);
      // nothing generic standing inside what was rebuilt (mapped trees in the garth / on the mound, lamps in the walks)
      if (W && W.clearArea) {
        W.clearArea([P(C.u0, C.v0), P(C.u1, C.v0), P(C.u1, C.v1), P(C.u0, C.v1)]);
        const M = NC.mound, ring = []; for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; ring.push([M.c[0] + Math.sin(t) * (M.r + 1.5), M.c[1] + Math.cos(t) * (M.r + 1.5)]); }
        W.clearArea(ring);
        for (const L0 of [NC.wall, NC.wall2]) for (let i = 0; i < L0.length - 1; i++) { const p = L0[i], r = L0[i + 1], L = Math.hypot(r[0] - p[0], r[1] - p[1]) || 1, nx = (r[1] - p[1]) / L * 1.3, nz = -(r[0] - p[0]) / L * 1.3; W.clearArea([[p[0] + nx, p[1] + nz], [r[0] + nx, r[1] + nz], [r[0] - nx, r[1] - nz], [p[0] - nx, p[1] - nz]], { furniture: false, lamps: false }); }
      }
      // lanterns: the gate on the lane, the Holywell gate, the cloister door
      try { const a = P(-31.6, NC.gateV - 2.4), b = P(-31.6, NC.gateV + 2.4); W.addLampGlow(a[0], 3.4, a[1]); W.addLampGlow(b[0], 3.4, b[1]); W.addLampGlow(644.6, 3.6, 17.6); } catch { /* stub */ }
      // [E] at the foot of the Mound's steps
      const foot = moundFoot();
      game.interact.add({ pos: foot, radius: 2.2, label: 'Climb the Mound', enabled: () => !S.climbing, onUse: () => climb() });
    } catch (e) { console.error('[new_college] build', e); } finally { K.joined(me); }

    function climb() {
      const Pl = game.player; if (Pl.vehicle || S.climbing) return false;
      S.climbing = true; S.climbs++; S.lastLine = -1;
      const M = NC.mound, top = [M.c[0], M.top + 1.65, M.c[1]];
      let yaw = Math.atan2(Q(40, -10)[0] - M.c[0], Q(40, -10)[1] - M.c[1]) + Math.PI, t = 0;
      try {
        game.beginActivity({
          name: 'nc-mound', pointer: 'locked', hint: 'On top of the Mound. Look around with the mouse. (Esc to come down)',
          update(dt) { t += dt; const k = Math.floor(t / 7); if (k !== S.lastLine && k < MOUND_VIEW.length) { S.lastLine = k; try { game.ui.toast(MOUND_VIEW[k], 6); } catch { /* */ } } },
          camera(dt, cam) {
            const inp = game.input; yaw -= ((inp && inp.mouseDX) || 0) * 0.003;
            cam.position.set(top[0], top[1], top[2]);
            cam.lookAt(top[0] + Math.sin(yaw) * 10, top[1] - 1.2, top[2] + Math.cos(yaw) * 10);
          },
          onEnd() { S.climbing = false; },
        });
      } catch (e) { S.climbing = false; console.warn('[new_college] climb', e); }
      return true;
    }

    game.newCollege = {
      sights, ids: IDS, climb,
      stats() { const gs = K.lod.groups.filter((q) => /^nc:/.test(q.name)); return { levels: Object.fromEntries(gs.map((q) => [q.name, q.level])), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^nc:/.test(k)).map(([k, v]) => [k, v.tris])), climbing: S.climbing, climbs: S.climbs }; },
    };
    void DAY_MS;
    return { update(dt) { try { K.tick(me); void dt; } catch (e) { if (!S.err) { S.err = true; console.error('[new_college]', e); } } } };
  },
};
