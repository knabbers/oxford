// The Oxford Union, St Michael's Street / Frewin Court, c. 2013 — see docs/research/landmarks_batch5.md.
//
//   preMap   the generic debating hall and Old Library are skipped (rebuilt here); the 1910-11 building on Frewin Court and
//            the other Union buildings restyled in brick; the car park in front of the hall becomes the garden lawn (an
//            ordinary map area, drawn by the world)
//   install  Waterhouse's debating hall (brick, terracotta, coved eaves, buttresses), Woodward's Old Library with its
//            roundels and apse, the gate and name board on St Michael's Street — LOD groups in the ONE batch-5 atlas
//            draw (_b5_kit.js); the debating chamber as an interior (benches facing across the floor, the despatch boxes,
//            the President's chair, the gallery, the motion on a board)
//   game     speak in tonight's debate (an invented, harmless motion): pick a side at the despatch box, the house divides
//            (a pure function of the game day and your side), win and the treasurer stands you £5 (once a game day)
//
// Test hooks: game.oxUnion = { sights, stats(), enter(), speak(side) }     tools/smoke_batch5.mjs
import * as THREE from 'three';
import { shared, addSite, DAY_MS } from './_b5_kit.js';
import { planWalkin, kitGaps, cityDoor, glazing, mergeRoom, warmLater, dressOpenings, archLining, roomCrowd, cityDoorMats } from './_walkin_city.js';
import { randomLook } from '../core/characters.js';
import { corners } from './_b5_kit.js';
import { UN, F, buildChamber, buildLibrary, buildGarden, lawnWorld, SOLIDS, MOTION, SPEECH, division, motionTexture, chamberContents } from './_b5_union.js';

export const IDS = { chamber: 'w308001638', library: 'w293563598', extension: 'w293563587', others: ['w293563584', 'w1366639561', 'w293563591'], parking: 'w229149259' };
export const SKIP = [IDS.chamber, IDS.library, IDS.parking];
const Q = F.Q, ROOM = 'oxunion_chamber', D = { w: 13, d: 27, h: 11 };
// Walk-in plan (core/interiors.js "seamless"; _walkin_city.js). Waterhouse's hall is 9.4 × 32.3 m outside and its door
// is in the long garden side, 14.3 m from the street gable: the old 13 × 27 m room (door in the short end) did not fit.
// Re-planned to the hall: 8.6 × 30 m, the dais at the street end, the door in the long west wall with a gangway through
// that side's benches, two tiers of benches a side (the hall is narrow: GUESS — the real chamber has more, steeper
// rows), a 1.2 m gallery, and the seven garden-side mullioned windows as real openings where the exterior has them
// (bays of 3.7 m about the hall's middle; the bay over the door has none).
const HALL_V = [-20.3, 12.0], HALL_MID = (HALL_V[0] + HALL_V[1]) / 2;
export const DS = { w: 8.6, d: 30, h: 9.8, t: 0.2, tiers: 2, gal: 1.2, doorZ: UN.chamberDoor[1] - HALL_MID, doorW: UN.door.w, doorH: UN.door.h };
DS.gang = { side: -1, z0: DS.doorZ - 1.05, z1: DS.doorZ + 1.05 };
export const WIN = { zs: [-12.95, -9.25, -5.55, 1.85, 5.55, 9.25, 12.95], w: 1.9, y0: 3.4, y1: 8.6, rec: 0.22 };
const unionPlanSpec = () => ({ building: corners(UN.chamber), portal: { at: [-(DS.w / 2 + DS.t / 2), DS.doorZ], out: -Math.PI / 2, w: DS.doorW, h: DS.doorH }, rects: [[-DS.w / 2, -DS.d / 2, DS.w / 2, DS.d / 2]], wall: 0.3,
  windows: WIN.zs.map((z) => ({ at: [-DS.w / 2, z], out: -Math.PI / 2, w: WIN.w, y0: WIN.y0, y1: WIN.y1, proud: 0.03 - WIN.rec })) });
export const sights = [
  { id: 'union-chamber', name: 'The Oxford Union debating hall', x: Q(4, -2)[0], z: Q(4, -2)[1], blurb: 'Alfred Waterhouse\'s debating hall of 1878, brick with terracotta. Members vote by walking out through the "aye" or "no" door, as in the Commons.' },
  { id: 'union-library', name: 'The Old Library', x: Q(-18, 28)[0], z: Q(-18, 28)[1], blurb: 'Benjamin Woodward\'s first debating room (1857), now the library, famous for the Pre-Raphaelite murals painted round its upper walls.' },
  { id: 'union-garden', name: 'The Union garden', x: Q(-5, -8)[0], z: Q(-5, -8)[1], blurb: 'The lawn between the buildings and St Michael\'s Street, where speakers are photographed and members argue on.' },
];
export { MOTION, division };

export default {
  id: 'oxford_union',
  preMap(game) {
    try {
      for (const id of SKIP) game.overrides.skip.add(id);
      game.overrides.style.set(IDS.extension, { wall: 'brick', roof: 'slate', storeys: 3, tint: [1.0, 0.88, 0.8] });
      for (const id of IDS.others) game.overrides.style.set(id, { wall: 'brick', roof: 'slate', tint: [1.0, 0.9, 0.82] });
      if (game.map && game.map.areas) game.map.areas.push({ id: 'b5_union_lawn', kind: 'grass', poly: lawnWorld() });
    } catch (e) { console.error('[oxford_union] preMap', e); }
  },

  install(game) {
    const K = shared(game), me = K.join('oxford_union'), W = game.world, col = game.worldCollider;
    const S = { err: false, speaking: false, spoken: 0, last: null };
    try {
      { const c = Q(11.5, -4); addSite(K, 'un:chamber', [c[0], 8, c[1]], 18, [80, 190, 550], buildChamber); }
      { const c = Q(-10, 30); addSite(K, 'un:library', [c[0], 6, c[1]], 12, [70, 180, 450], buildLibrary); }
      { const c = Q(-4.5, -20.4); addSite(K, 'un:garden', [c[0], 1.5, c[1]], 8, [60, 120, 200], buildGarden); }
      K.boxes.push([0, 80, 165, 245]);
      for (const p of SOLIDS()) col.addPolygon(p);
      for (const du of [-1.7, 1.7]) { const p = Q(UN.gate[0] + du, UN.gate[1]); col.addCircle(p[0], p[1], 0.45); }
      try { const p = Q(UN.chamberDoor[0] - 0.6, UN.chamberDoor[1] + 1.4); W.addLampGlow(p[0], 3.1, p[1]); } catch { /* stub */ }
    } catch (e) { console.error('[oxford_union] build', e); } finally { K.joined(me); }

    // ---------------------------------------------------------------- the debating chamber (interior)
    const doorW = Q(UN.chamberDoor[0] - 0.9, UN.chamberDoor[1]);
    let inside = null;
    let plan = null;
    try { plan = planWalkin(game, { id: ROOM, door: { pos: doorW, facing: F.H.nu }, mid: [-1.25, DS.doorZ + 6], route: [[-1.25, DS.doorZ]], ...unionPlanSpec() }); plan.seamless.portals[0].proud = 0.03 - UN.door.rec; plan.seamless.bounds = [{ x0: -DS.w / 2, x1: DS.w / 2, z0: -DS.d / 2, z1: DS.d / 2, y0: 0, y1: DS.h }]; } catch (e) { console.error('[oxford_union] plan', e); }
    game.interiors.register({
      id: ROOM, name: 'the Oxford Union debating chamber', background: 0x141010, ambient: 0.95,
      doors: [{ pos: doorW, facing: F.H.nu, label: 'Go into the debating chamber' }],
      seamless: plan && plan.fit.ok ? plan.seamless : null,
      build(ctx) { inside = ctx.seamless && plan ? buildRoomSL(ctx) : buildRoom(ctx); return { spawn: inside.spawn, heading: inside.heading ?? Math.PI }; },
      onEnter() { try { game.ui.toast('The debating chamber. Tonight\'s motion: ' + MOTION + '.', 5); } catch { /* */ } },
      update(dt) { roomTick(dt); }, updateShown(dt) { roomTick(dt); },
    });
    if (plan) warmLater(game, ROOM);
    // The outside of the seven garden windows (second pass): the opening is the shell's own window hole (same size, at
    // the back of its terracotta reveal); its mullion and transoms are drawn here in the world, terracotta, lit as the
    // wall is — Waterhouse's two-light mullion-and-transom windows. No white frame. The door is the pointed doorway of
    // the shell: the portal is the bounding rectangle of that arch, the shell's arch frames the oak leaf.
    try { if (plan && plan.fit.ok) dressOpenings(game, ROOM, [{ o: plan.seamless.openings.map((_, i) => i), mullions: 1, mullW: 0.14, transoms: [0.3, 0.62], stone: 0xa8573c, fill: false }]); } catch (e) { console.warn('[oxford_union] dressing', e); }
    // Who is in the chamber whenever it is shown (seen through the door and the high windows): a few members about by
    // day, the house sitting in the evening with a speaker at the despatch box (every evening 8 till 11: GUESS — the
    // board says Thursdays), nobody and no lights in the small hours. The same people for every player.
    const hourNow = () => (game.time.pinned != null ? game.time.pinned : game.time.hour);
    const band = () => { const h = hourNow(); return h >= 20 && h < 23 ? 'debate' : h >= 9.5 && h < 20 ? 'day' : h >= 23 && h < 23.5 ? 'late' : 'night'; };
    const crowd = roomCrowd(game, ROOM, { cap: 13, signature: band, populate(sp) {
      const b = band(); if (b === 'night' || b === 'late' || !inside || !inside.sl) return;
      const seat = (s, z, k, o = {}) => sp(s * 2.2, z, randomLook('oxunion-member-' + k, { outfit: k % 3 === 0 ? 'tweed' : k % 3 === 1 ? 'smart' : 'casual', ...(o.look || {}) }), { heading: -s * Math.PI / 2, pose: 'sit', label: '' });
      if (b === 'day') { seat(1, 4.0, 1, { look: { prop: 'book' } }); seat(-1, 6.2, 2); sp(0.7, -DS.d / 2 + 5.6, randomLook('oxunion-member-3', { outfit: 'casual' }), { heading: Math.PI, label: '' }); return; }
      sp(1.3, -1.0, randomLook('oxunion-speaker', { outfit: 'smart' }), { heading: -Math.PI / 2, pose: 'lecture', label: 'Speaker' });
      [-7.2, -5.1, -3.2, 1.6, 3.4, 6.1].forEach((z, i) => seat(1, z, 10 + i));
      [-7.6, -4.6, 1.2, 2.9, 5.0, 7.7].forEach((z, i) => seat(-1, z, 20 + i));
    } });
    function roomTick(dt) { try { const b = band(); if (inside && inside.setLight) inside.setLight(b === 'night' ? 0.07 : 1); crowd.tick(dt); } catch { /* */ } }
    function buildRoom(ctx) {
      const s = ctx.scene, Kit = W.interiorKit, c = ctx.collider;
      Kit.room(s, { w: D.w, d: D.d, h: D.h, floor: 'wood', walls: 'panelling', collider: c, doors: [{ wall: 's', at: 0, width: 1.8, height: 2.6 }] });
      const C = chamberContents(D);
      const m = new THREE.Mesh(C.geo, new THREE.MeshLambertMaterial({ vertexColors: true, name: 'b5:union-furniture' })); m.name = 'b5:union-furniture'; s.add(m);
      for (const [x, z, w, d] of C.solids) c.addBox(x, z, w, d, 0);
      // the motion on its board over the dais, the windows high on the long walls (glowing panes), the lights
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3), new THREE.MeshBasicMaterial({ map: motionTexture(), name: 'b5:union-motion' }));
      board.position.set(0, 5.3, -D.d / 2 + 0.4); board.name = 'b5:union-motion'; s.add(board);
      const paneMat = new THREE.MeshBasicMaterial({ color: 0x8a9cb0, name: 'b5:union-pane' });
      for (const sx of [-1, 1]) for (let z = -D.d / 2 + 3; z < D.d / 2 - 1; z += 3.6) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.6), paneMat); p.position.set(sx * (D.w / 2 - 0.05), 7.6, z); p.rotation.y = -sx * Math.PI / 2; s.add(p); }
      s.add(new THREE.HemisphereLight(0xfff0dc, 0x5a3a24, 1.3));
      for (const z of [-9, -3, 3, 9]) Kit.warmLight(s, { x: 0, y: D.h - 2.0, z, intensity: 9, distance: 16 });
      ctx.addExit(0, D.d / 2 - 0.9, 'Out to the garden');
      game.interact.add({ place: ctx.id, pos: [0.0, 1.25], radius: 1.8, label: 'Speak at the despatch box', enabled: () => !S.speaking, onUse: () => startSpeech() });
      game.interact.add({ place: ctx.id, pos: [0, -D.d / 2 + 5.0], radius: 2.2, label: 'Read the motion', onUse: () => { try { game.ui.toast('The motion: "' + MOTION + '". Proposition on the President\'s right, opposition on her left.', 5); } catch { /* */ } } });
      return { spawn: [0, D.d / 2 - 2.0], solids: C.solids };
    }

    /** the walk-in chamber (DS): the same furniture re-planned to the real hall, the door in the long garden wall */
    function buildRoomSL(ctx) {
      const s = ctx.scene, Kit = W.interiorKit, c = ctx.collider, d = DS;
      Kit.room(s, { w: d.w, d: d.d, h: d.h, floor: 'wood', walls: 'panelling', collider: c, doors: kitGaps(plan) });
      const C = chamberContents(d);
      const m = new THREE.Mesh(C.geo, new THREE.MeshLambertMaterial({ vertexColors: true, name: 'b5:union-furniture' })); m.name = 'b5:union-furniture'; s.add(m);
      for (const [x, z, w, dd] of C.solids) c.addBox(x, z, w, dd, 0);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3), new THREE.MeshBasicMaterial({ map: motionTexture(), name: 'b5:union-motion' }));
      board.position.set(0, 5.3, -d.d / 2 + 0.4); board.name = 'b5:union-motion'; s.add(board);
      // (the room's side of the windows: plain glass in a terracotta reveal; mullion and transoms are the world's)
      { const tc = new THREE.MeshLambertMaterial({ color: 0x9a5038, side: THREE.DoubleSide, name: 'b5:union-reveal' }); s.add(glazing(plan.seamless.openings, { frame: 0.001, bars: 0, mats: { ...cityDoorMats(), frame: tc, reveal: tc } })); }
      // the pointed head of the doorway, from inside (the wall over the arch, its soffit), a mat, the members' notice board
      { const pt = plan.seamless.portals[0], lin = archLining(null, [{ at: pt.at, out: pt.out, w: pt.w, y0: 0, y1: pt.h, depth: pt.depth, head: 'pointed', rise: UN.door.rise }], { color: 0x4a3220 }); if (lin) s.add(lin);
        const bx = (x, y, z, w, h, dd, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), new THREE.MeshLambertMaterial({ color: col })); m.position.set(x, y, z); s.add(m); };
        bx(-d.w / 2 + 0.85, 0.012, d.doorZ, 1.5, 0.02, 1.6, 0x4a2a22);
        bx(-d.w / 2 + 0.06, 1.8, d.doorZ + 2.0, 0.05, 0.9, 1.2, 0x2e2016); bx(-d.w / 2 + 0.09, 1.8, d.doorZ + 2.0, 0.02, 0.78, 1.08, 0x1a2a4a);
        for (const [dz, dy, w, h] of [[-0.3, 0.1, 0.3, 0.4], [0.12, 0.12, 0.3, 0.42], [-0.05, -0.24, 0.5, 0.2]]) bx(-d.w / 2 + 0.105, 1.8 + dy, d.doorZ + 2.0 + dz, 0.01, h, w, 0xf0e6c8); }
      cityDoor(ctx, plan, { style: 'oak', heavy: true, hinge: 1 });
      s.add(new THREE.HemisphereLight(0xfff0dc, 0x5a3a24, 1.3));
      for (const z of [-10, -3.5, 3.5, 10]) Kit.warmLight(s, { x: 0, y: d.h - 2.0, z, intensity: 9, distance: 16 });
      game.interact.add({ place: ctx.id, pos: [0.0, 1.25], radius: 1.8, label: 'Speak at the despatch box', enabled: () => !S.speaking, onUse: () => startSpeech() });
      game.interact.add({ place: ctx.id, pos: [0, -d.d / 2 + 5.0], radius: 2.2, label: 'Read the motion', onUse: () => { try { game.ui.toast('The motion: "' + MOTION + '". Proposition on the President\'s right, opposition on her left.', 5); } catch { /* */ } } });
      mergeRoom(s);
      const lights = []; s.traverse((o) => { if (o.isLight) lights.push([o, o.intensity]); });
      let litK = 1; const setLight = (k) => { if (Math.abs(k - litK) < 0.01) return; litK = k; for (const [l, i] of lights) l.intensity = i * k; };
      return { spawn: [-d.w / 2 + 1.3, d.doorZ], heading: Math.PI / 2, solids: C.solids, sl: true, setLight };
    }

    /** a speech: a few lines, heckles from the house, then the division (all on the shared game day; no network) */
    function speak(side) {
      const day = Math.floor(game.time.now() / DAY_MS), r = division(day, side), lines = SPEECH[side];
      S.spoken++; S.last = { side, ...r, day };
      const flags = game.state.flags || (game.state.flags = {});
      let paid = false;
      if (r.won && flags.b5UnionWin !== day) { flags.b5UnionWin = day; game.pay(5); paid = true; try { game.save(); } catch { /* */ } }
      return { lines, heckles: SPEECH.heckles, ...r, paid };
    }
    function startSpeech() {
      if (S.speaking) return false;
      S.speaking = true;
      let side = null, t = 0, k = 0, out = null;
      try {
        game.beginActivity({
          name: 'oxunion-debate', hint: 'At the despatch box. [1] speak for the motion, [2] against. (Esc to sit down)',
          onKey(code) { if (side) return; if (code === 'Digit1') side = 'prop'; else if (code === 'Digit2') side = 'opp'; if (side) { out = speak(side); t = 0; k = 0; } },
          update(dt) {
            if (!out) return; t += dt;
            if (t > 3.2 * k && k < out.lines.length) { try { game.ui.toast(out.lines[k] + '   ' + out.heckles[(k + out.ayes) % out.heckles.length], 3); } catch { /* */ } k++; }
            if (k >= out.lines.length && t > 3.2 * k + 1) {
              try { game.ui.toast(`The house divides. Ayes ${out.ayes}, noes ${out.noes}. ${out.won ? 'You carry the house!' : 'You lose the house, gracefully.'}${out.paid ? ' The treasurer stands you £5.' : ''}`, 6); } catch { /* */ }
              out = null; game.endActivity();
            }
          },
          onEnd() { S.speaking = false; },
        });
      } catch (e) { S.speaking = false; console.warn('[oxford_union] debate', e); }
      return true;
    }

    game.oxUnion = {
      sights, ids: IDS, speak, startSpeech, room: ROOM, dims: D, walkin: DS, plan: () => plan,
      enter() { const d = game.interiors.get(ROOM); return d ? game.interiors.enterNow(ROOM, d.doors[0]) : null; },
      inside: () => inside,
      stats() { const gs = K.lod.groups.filter((q) => /^un:/.test(q.name)); return { levels: Object.fromEntries(gs.map((q) => [q.name, q.level])), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^un:/.test(k)).map(([k, v]) => [k, v.tris])), spoken: S.spoken, last: S.last }; },
    };
    return { update(dt) { try { K.tick(me); void dt; } catch (e) { if (!S.err) { S.err = true; console.error('[oxford_union]', e); } } } };
  },
};
