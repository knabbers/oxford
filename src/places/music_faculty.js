// The old Faculty of Music, St Aldate's (the faculty's home 1981–2025), as c. 2013.
// Map building: OSM relation r4043339 (addr:postcode OX1 1DB = the Faculty's postcode, operator Christ Church), restyled
// as Worthington's 1936 St Catherine's Society building: "low and simple", Bladon stone with Clipsham dressings, Cotswold
// stone-slate roofs, set back from the street behind a gravel drive; main entrance facing St Aldate's with a deeply
// recessed door under a balcony bearing a gilded wrought-iron St Catherine supported by angels; Bate Collection entrance
// reached by turning left inside the gates and following a gravel path round to the side.
// Interior ('music_faculty'): _music_build.js. Pianos: _music_piano3d.js + _music_synth.js; playing: _music_session.js.
// Test hooks: game.music = { enter(where), sit(room), session, engine, mode(m), piece(id), press(midi), playExpected(),
//   view(x,y,z,tx,ty,tz), stats(), forceOpen, occupied() }.
import * as THREE from 'three';
import { MBatch, mbox, canvasTex } from './_music_batch.js';
import { buildInterior, L, ROOMS, groundAt, spaceAt, FIT } from './_music_build.js';
import { planWalkin, cityDoor, glazing, warmLater, hoursOpen, dressOpenings, roomCrowd } from './_walkin_city.js';
import { PianoEngine } from './_music_synth.js';
import { createSession } from './_music_session.js';
import { corridorLoops } from './_music_pieces.js';
import { randomLook } from '../core/characters.js';
import { HOUR_MS } from '../core/time.js';

const ID = 'music_faculty';
const BUILDING = 'r4043339';
const DOOR = { pos: [275.7, 700.3], facing: -Math.PI / 2, wall: [276.4, 700.3] };   // main entrance (OSM entrance=main n2353153076)
const BATE = { pos: [258.6, 681.15], facing: Math.PI, wall: [258.6, 681.9] };         // side entrance (OSM n11630205967)
const GATE = [245.0, 704.2];                                                          // drive gate on St Aldate's (OSM n13510774320)
const STUDENT_LINES = ['Has anyone seen my rosin?', 'Room 3 is free, I think. The upright\'s a bit out.', 'Harmony and counterpoint at nine. Again.',
  'Orchestra rehearsal till ten.', "Who's accompanying you on Friday?", 'I need more practice hours.', 'The Steinway in Denis Arnold is gorgeous.', 'Is the Bate open today?'];
const PORTER_LINES = ['Practice rooms are booked here at the lodge.', "Room 3's free. The upright's a bit out, mind.", 'No food or drink in the practice rooms, please.',
  'Denis Arnold Hall is booked for a rehearsal at six.', "Don't move the pianos. Every term someone moves the pianos."];

export default {
  id: ID,
  preMap(game) {
    // rebuilt by hand (pitched stone-slate roofs instead of the generic flat/battlemented treatment); collision re-added
    game.overrides.skip.add(BUILDING);
  },

  install(game) {
    const engine = new PianoEngine(game.audio);
    const M = (game.music = { id: ID, engine, forceOpen: false, session: null, built: false, pianos: [] });
    let R = null, sceneRef = null;
    const peds = [];
    const fac = {
      engine,
      inPracticeRoom: (rec) => rec && rec.room.startsWith('room'),
      onSit: (rec) => { M.sitting = rec.room; },
      onStand: () => { M.sitting = null; },
    };
    const session = (M.session = createSession(game, fac));

    // ----------------------------------------------------------------------------------------- walk-in plan
    // (core/interiors.js "seamless"; _walkin_city.js) The room in place inside the hand-built shell: the outline it must
    // fit is the union of the RANGES below (not the OSM ring, which is turned 2.5° from them); the doorway is the main
    // entrance in the entrance range's street end, square to it. Only the main entrance is a doorway: the Bate's own
    // door is at the far north-west corner of the north range, nowhere near the room the plan gives the collection.
    let plan = null;
    try {
      if (FIT) {
        const f = Math.atan2(-FRAME.e[0], -FRAME.e[1]);
        plan = planWalkin(game, {
          id: ID, building: SHELL.map(([u, v]) => toW(u, v)), door: { pos: [DOOR.wall[0] + Math.sin(f) * 0.2, DOOR.wall[1] + Math.cos(f) * 0.2], facing: f }, wall: 0.3,
          portal: { at: [L.lobby.x0 - L.T / 2, L.door.z], out: -Math.PI / 2, w: L.door.w, h: L.door.h },
          rects: [[L.lobby.x0, L.lobby.z0, L.lobby.x1, L.lobby.z1], [L.lodge.x0, L.lodge.z0, L.lodge.x1, L.lodge.z1], [L.bate.x0, L.bate.z0, L.bate.x1, L.bate.z1], [8, L.roomN.z0, 20, L.roomS.z1], [L.hall.x0, L.hall.z0, L.hall.x1, L.hall.z1]],
          windows: L.windows, center: [12, 0], mid: [14, 0],
          hours: { open: () => M.forceOpen || hoursOpen(game.time.hour, 7.5, 23), testShut: 3.5 },
        });
        if (!plan.fit.ok) { console.warn('[music] the plan does not fit its shell', plan.fit.min, plan.fit.out.slice(0, 4)); }
      }
    } catch (e) { console.error('[music] walk-in plan', e); plan = null; }
    const WALK = !!(plan && plan.fit.ok);
    // ----------------------------------------------------------------------------------------- exterior
    try { buildExterior(game, WALK); } catch (e) { console.error('[music] exterior', e); }
    const outside = [];
    const spawnOutside = () => {
      if (!game.pedestrians || outside.length) return;
      const looks = [
        { outfit: 'casual', prop: null, back: 'cello', topStyle: 'jumper' },
        { outfit: 'casual', prop: null, hand: 'violin', backpack: 0x2a3550 },
        { outfit: 'smart', prop: null, hand: 'folder' },
      ];
      const spots = [[268, 703.2, 2.2], [266.8, 701.0, -0.9], [253.2, 706.4, 1.4]];
      looks.forEach((lk, i) => {
        const look = randomLook('music-student-' + i, { outfit: lk.outfit }); if (lk.backpack) look.backpack = lk.backpack; if (lk.topStyle) look.topStyle = lk.topStyle; look.prop = null; look.hat = null;
        try {
          const p = game.pedestrians.spawnAt(spots[i][0], spots[i][1], look, { heading: spots[i][2], pose: i === 2 ? 'phone' : 'talk', lines: STUDENT_LINES, role: 'student', wander: i === 2 ? { radius: 2.5, speed: 0.8 } : null });
          attachCase(p.character, lk.back || lk.hand);
          outside.push(p);
        } catch (e) { console.error('[music] student', e); }
      });
    };
    const clearOutside = () => { for (const p of outside) game.pedestrians?.remove(p); outside.length = 0; };

    // ----------------------------------------------------------------------------------------- interior
    const open = () => { if (M.forceOpen) return true; const h = game.time.hour; return h >= 7.5 && h < 23; };
    const bateOpen = () => { if (M.forceOpen) return true; const h = game.time.hour; return h >= 14 && h < 17; };
    const def = game.interiors.register({
      id: ID, name: 'Faculty of Music', background: 0x0d0c0a, ambient: 0.42,
      seamless: WALK ? plan.seamless : null,
      doors: [
        { pos: DOOR.pos, facing: DOOR.facing, label: 'Enter the Faculty of Music', locked: () => (open() ? false : 'The Faculty is locked for the night. (Open 07:30–23:00)') },
        { pos: BATE.pos, facing: BATE.facing, label: 'Ring the bell: Bate Collection of Musical Instruments', locked: () => (bateOpen() ? false : 'The Bate Collection is open 2–5pm. Nobody answers the bell.') },
      ],
      build(ctx) {
        sceneRef = ctx.scene;
        R = buildInterior(ctx.scene, ctx.collider, game.world, { walkin: !!ctx.seamless });
        if (ctx.seamless) {
          // real glass in the window openings, and the street door: one heavy oak leaf, locked at night ("Closed" card)
          ctx.scene.add(glazing(ctx.seamless.openings, { frame: 0.03, bars: 0 }));      // (the bars and mullions are the outside's: dressOpenings below)
          M.door = cityDoor(ctx, plan, { style: 'oak', heavy: true, hinge: 1, open: plan.hours.open });
        }
        M.pianos = R.pianos; M.built = true;
        ctx.setGround(groundAt);
        ctx.addExit(L.exit[0], L.exit[1], 'Leave by the front door (St Aldate\'s)');
                if (!ctx.seamless) game.interact.add({ place: ID, pos: L.bateExit, radius: 1.4, label: 'Leave by the Bate Collection door', onUse: () => { def._via = def.doors[1]; game.interiors.exit(); } });
        for (const rec of R.pianos) {
          const label = rec.kind === 'steinway' ? 'Sit at the Steinway' : rec.kind === 'upright' ? 'Sit at the piano (upright)' : 'Sit at the piano (grand)';
          game.interact.add({ place: ID, pos: [rec.seat[0], rec.y0, rec.seat[1]], radius: 1.1, label, onUse: () => session.sit(rec) });
        }
        // closed practice-room doors: who's in there?
        for (const r of ROOMS) if (!r.open) game.interact.add({ place: ID, pos: [r.door[0], r.door[1] + (r.north ? 0.45 : -0.45)], radius: 0.9,
          label: () => { const o = occupant(r.n); return o ? `Room ${r.n} — occupied (${o.name}). Listen at the door` : `Room ${r.n} — locked` ; },
          onUse: () => { const o = occupant(r.n); game.ui.toast(o ? `Through the door: ${o.desc}` : 'Locked. The booking sheet says it is free later.', 4); } });
        game.interact.add({ place: ID, pos: [6.1, -2.4], radius: 1.3, label: 'Talk to the porter', onUse: () => game.ui.dialog('Porter', [PORTER_LINES[Math.floor(game.time.hour) % PORTER_LINES.length], 'Room 3 or Room 6 if you want a piano. Or the Steinway in Denis Arnold, if nobody\'s rehearsing.']) });
        game.interact.add({ place: ID, pos: [2.4, 2.2], radius: 1.4, label: 'Check your pigeonhole', onUse: () => game.ui.toast(['A flyer for choir auditions, and a reminder that your harmony exercise is overdue.', 'Empty. Except for a single paperclip.', 'A programme for Tuesday\'s lunchtime recital.'][Math.floor(game.time.hour) % 3], 4) });
        game.interact.add({ place: ID, pos: [1.9, -2.3], radius: 1.4, label: 'Read the notice board', onUse: () => game.ui.toast('Lunchtime recital, Denis Arnold Hall · Choir auditions · Bate Collection open 2–5pm · Prelims harmony sheet 4 due in pigeonholes.', 6) });
        game.interact.add({ place: ID, pos: [4.5, 6.6], radius: 2.2, label: 'Look at the cases', onUse: () => game.ui.dialog('Bate Collection of Musical Instruments', [
          'Founded on Philip Bate\'s gift of his collection to the University; it has been shown here in the Faculty building on St Aldate\'s since about 1970.',
          'Woodwind, brass and keyboard instruments: early oboes and flutes, natural horns and a serpent coiled like its name.']) });
        // (the people inside: `crowd` below — there whenever the building is shown, so they are seen through its windows)
        return { spawn: L.spawn, heading: L.spawnH };
      },
      onEnter() {
        if (!def.sl && def._via === def.doors[1]) game.player.teleport(L.bateSpawn[0], L.bateSpawn[1], Math.PI / 2);
        engine.ready(); engine.warm(Array.from({ length: 37 }, (_, i) => 48 + i), 'upright');
        clearOutside();
      },
      onExit() {
        if (game.activity && game.activity.name === 'piano') game.endActivity();
        engine.muffledOff(); engine.allOff();
        for (const k of Object.keys(loops)) delete loops[k];
      },
      updateShown(dt) { crowd.tick(dt); },
      update(dt) {
        crowd.tick(dt);
        if (!R) return;
        for (const p of R.pianos) if (!session.active || session.S.rec !== p) p.piano.update(dt);
        if (!session.active) engine.pump(3);
        corridorTick();
      },
    });

    // ---- the people of the building: the porter at the lodge hatch, students in the lobby and the corridor, a visitor
    // in the Bate (2–5 pm), two listeners in Denis Arnold Hall. Seeded looks (every player sees the same people); the
    // cast follows the hour. Spawned whenever the room is SHOWN (seen from the drive through the windows and the door).
    const band = () => { const h = game.time.hour; return !open() ? 'shut' : h < 9 ? 'early' : h < 18 ? 'day' : 'eve'; };
    const crowd = roomCrowd(game, ID, {
      cap: 9, signature: () => band() + (bateOpen() ? 'b' : ''),
      populate(spawn) {
        const b = band(); if (b === 'shut') return;
        spawn(6.1, -4.1, randomLook('music-porter', { outfit: 'porter' }), { heading: 0, pose: 'stand', lines: PORTER_LINES, label: 'Porter', role: 'porter' });
        const v = spawn(18.6, 0.55, randomLook('music-violinist', { outfit: 'casual' }), { heading: -Math.PI / 2 + 0.3, pose: 'stand', lines: ['Waiting for Room 8.', 'They said they\'d be out at the hour...', 'Scales, scales, scales.'], role: 'student' });
        if (v) attachCase(v.character, 'violin');
        if (b !== 'early') {
          // two by the pigeonholes, talking; one reading the notice board
          spawn(2.3, 1.5, randomLook('music-lobby-a', { outfit: 'casual' }), { heading: 2.5, pose: 'talk', lines: STUDENT_LINES, role: 'student' });
          spawn(3.1, 0.9, randomLook('music-lobby-b', { outfit: 'casual' }), { heading: -0.9, pose: 'talk', lines: STUDENT_LINES, role: 'student' });
          const c = spawn(2.2, -2.0, randomLook('music-lobby-c', { outfit: 'smart' }), { heading: Math.PI, pose: 'stand', lines: STUDENT_LINES, role: 'student' });
          if (c) attachCase(c.character, 'folder');
          spawn(12.2, -0.3, randomLook('music-corr-a', { outfit: 'casual' }), { heading: Math.PI / 2, pose: 'phone', lines: STUDENT_LINES, role: 'student' });
        }
        if (bateOpen()) spawn(5.2, 5.0, randomLook('bate-visitor', { outfit: 'tourist' }), { heading: Math.PI, pose: 'photo', lines: ['Is that a serpent? It is a serpent.', 'Fascinating.'], role: 'tourist' });
        if (b === 'day') { spawn(L.hall.x0 + 3.2, 1.6, randomLook('music-hall-a', { outfit: 'smart' }), { heading: Math.PI / 2, pose: 'stand', lines: ['Shh. She is about to start.'], role: 'student' }); }
      },
    });
    // ---- the outside of the windows (world scene; _walkin_city.js dressOpenings): Clipsham-stone surrounds in the
    // building's manner — two-light mullioned casements with leaded panes on the entrance front and the hall, white
    // sashes in the 1970s rear block (the Bate). GUESS: the real windows' exact pattern.
    try {
      if (def && def.sl) {
        const ST = 0xe8dcbc, WALLC = 0xd6c9ad, lead = { w: 0.035, color: 0x3b3a36 };
        dressOpenings(game, ID, [
          { o: [0, 1], wall: WALLC, stone: ST, mullions: 1, mullW: 0.12, frame: lead, bars: [6, 4], barW: 0.014, barColor: 0x3b3a36, surround: { w: 0.13, color: ST, proud: 0.05 }, sill: { h: 0.1, proj: 0.1, over: 0.16, color: ST }, lintel: { h: 0.06, over: 0.16, color: ST, proud: 0.065 } },
          { o: [2, 3], wall: WALLC, frame: { w: 0.06, color: 0xeeeae0 }, bars: [3, 4], barW: 0.024, meeting: 0.5, surround: { w: 0.11, color: ST, proud: 0.045 }, sill: { h: 0.09, proj: 0.1, over: 0.14, color: ST } },
          { o: 4, wall: WALLC, stone: ST, mullions: 1, mullW: 0.12, frame: lead, bars: [6, 3], barW: 0.014, barColor: 0x3b3a36, surround: { w: 0.13, color: ST, proud: 0.05 }, sill: { h: 0.1, proj: 0.1, over: 0.16, color: ST } },
        ]);
      }
    } catch (e) { console.error('[music] windows', e); }
    // (walk-in: the Bate's side door is not a way in — the bell is still there to ring)
    if (def && def.sl) game.interact.add({ place: 'world', pos: BATE.pos, radius: 1.6, label: 'Ring the bell: Bate Collection of Musical Instruments',
      onUse: () => game.ui.toast(bateOpen() ? 'The intercom crackles: "Bate Collection — come round to the main entrance on St Aldate\'s and we\'ll show you through."' : 'The Bate Collection is open 2–5pm. Nobody answers the bell.', 5) });
    try { warmLater(game, ID, { heavy: false }); } catch { /* */ }
    M.plan = () => plan;
    // ----------------------------------------------------------------------------------------- the rooms you can't get into
    // Each game hour a few of rooms 1,2,4,5,7,8 are taken; what they practise is shared (derived from game time).
    const LOOPS = corridorLoops();
    const PEOPLE = [{ name: 'scales', desc: 'D major scales, two octaves, hands together. Over and over.' }, { name: 'arpeggios', desc: 'G major arpeggios, rising and falling.' },
      { name: 'the same four bars', desc: 'Für Elise. The same four bars. The same wrong note. Again.' }, { name: 'scales', desc: 'E flat major, rather fast, slightly showing off.' }];
    function hashI(a) { let x = Math.sin(a * 12.9898) * 43758.5453; return x - Math.floor(x); }
    function occupant(n) {
      const hourSlot = Math.floor(game.time.now() / HOUR_MS), closed = [1, 2, 4, 5, 7, 8];
      if (!closed.includes(n)) return null;
      const h = game.time.hour; if (h < 8 || h >= 22.5) return null;
      const k = hashI(hourSlot * 7 + n * 3.1);
      if (k < 0.38) return null;
      const li = Math.floor(hashI(hourSlot + n) * LOOPS.length);
      return { ...PEOPLE[li], loop: LOOPS[li], room: ROOMS[n - 1] };
    }
    M.occupied = () => ROOMS.filter((r) => occupant(r.n)).map((r) => ({ room: r.n, playing: occupant(r.n).name }));
    const loops = {};
    function corridorTick() {
      const p = game.player.pos, here = spaceAt(p.x, p.z), ctx = engine.ctx;
      if (!ctx) return;
      engine.setMuffle(0.9);
      const tNow = game.time.now() / 1000;
      for (const r of ROOMS) {
        const o = occupant(r.n);
        if (!o) { delete loops[r.n]; continue; }
        const d = Math.hypot(p.x - r.door[0], p.z - r.door[1]);
        let g = Math.pow(Math.max(0, 1 - d / 13), 1.6) * 0.75;
        if (here === 'hall' || here === 'bate') g *= 0.2; else if (here.startsWith('room')) g *= 0.45;
        if (g < 0.01) continue;
        const loop = o.loop, spbL = 60 / loop.tempo, last = loop.notes[loop.notes.length - 1], len = (last[1] + last[2] + loop.gap) * spbL;
        const st = loops[r.n] || (loops[r.n] = { cycle: -1, idx: 0, name: o.name });
        const off = r.n * 1.37, pos = (tNow + off) / len, cycle = Math.floor(pos), tin = (pos - cycle) * len;
        if (cycle !== st.cycle) { st.cycle = cycle; st.idx = 0; }
        while (st.idx < loop.notes.length && loop.notes[st.idx][1] * spbL <= tin + 0.2) {
          const [m, b, du] = loop.notes[st.idx++], when = Math.max(0, b * spbL - tin);
          const hesitate = o.name === 'the same four bars' && st.idx === loop.notes.length ? 0.25 : 0;
          engine.noteOn(m, 0.55 + 0.15 * Math.sin(st.idx), { muffled: true, inst: 'upright', when: when + hesitate, dur: du * spbL * 0.95, gain: g });
        }
      }
    }

    // ----------------------------------------------------------------------------------------- other players' pianos
    const remotePedal = new Map();
    game.net?.on?.('piano', (d, o) => {
      if (!d || !o || o.place !== ID || game.player.place !== ID || !R) return;
      const rec = R.pianos.find((q) => q.room === d.r); if (!rec) return;
      if (session.active && session.S.rec === rec) return;            // someone else on my stool? ignore their keys
      const me = spaceAt(game.player.pos.x, game.player.pos.z), same = me === rec.room;
      const dist = Math.hypot(game.player.pos.x - rec.seat[0], game.player.pos.z - rec.seat[1]);
      const opts = same ? { remote: true, inst: rec.kind, pedal: remotePedal.get(o.id) } : { muffled: true, inst: rec.kind, gain: Math.max(0, 0.8 - dist / 20) };
      if (d.on) { const m = d.on[0] | 0, v = +d.on[1] || 0.6; if (m < 21 || m > 108) return; engine.noteOn(m, v, opts); rec.piano.press(m, true); }
      else if (d.off !== undefined) { const m = d.off | 0; engine.noteOff(m, opts); rec.piano.press(m, false); }
      else if (d.ped !== undefined) { remotePedal.set(o.id, !!d.ped); if (same) engine.setPedal(!!d.ped, { remote: true }); }
    });

    // ----------------------------------------------------------------------------------------- test hooks
    M.enter = async (where = 'lobby') => {
      M.forceOpen = true;
      await game.interiors.enter(ID, def.doors[where === 'bate' ? 1 : 0]);
      const spots = { lobby: [1.3, 0, Math.PI / 2], corridor: [9, 0, Math.PI / 2], room3: [15.5, -1.6, Math.PI], room6: [12.6, 1.5, 0], hall: [23.5, 0, Math.PI / 2], bate: [1.3, 7.6, Math.PI / 2] };
      const s = spots[where]; if (s) game.player.teleport(s[0], s[1], s[2]);
      return 'ok';
    };
    M.sit = async (room = 'room3') => { if (game.player.place !== ID) await M.enter(room); const rec = R.pianos.find((q) => q.room === room); session.sit(rec); return 'ok'; };
    M.mode = (m) => session.setMode(m);
    M.piece = (id) => session.setPiece(id);
    M.press = (midi, v) => session.press(midi, v);
    M.playExpected = () => session.playExpected();
    M.view = (x, y, z, tx, ty, tz, fov = 60) => game.beginActivity({ name: 'view', pointer: 'free', camera(dt, cam) { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); }, onEnd() { game.camera.fov = 60; game.camera.updateProjectionMatrix(); } });
    M.stats = () => { const i = game.renderer.info.render; let lights = 0; sceneRef && sceneRef.traverse((o) => { if (o.isPointLight || o.isSpotLight) lights++; }); return { calls: i.calls, tris: i.triangles, lights, voices: engine.active, cached: engine.cache.size, queued: engine.jobs.length, place: game.player.place }; };

    // outdoor students only while you are near and it's daytime
    let chk = 0;
    return {
      update(dt) {
        if ((chk -= dt) > 0) return; chk = 1.5;
        const p = game.player;
        const near = p.place === 'world' && Math.hypot(p.pos.x - 270, p.pos.z - 700) < 110;
        const day = game.time.hour > 8.5 && game.time.hour < 21;
        if (near && day) spawnOutside(); else if (outside.length && (!near || !day)) clearOutside();
      },
    };
  },
};

// ------------------------------------------------------------------------------------------- instrument cases on NPCs
const caseMat = { black: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6 }), brown: new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.7 }), folder: new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.6 }) };
function attachCase(ch, kind) {
  if (!ch || !kind) return;
  try {
    if (kind === 'cello') {
      // on the back, strapped: a tall rounded case
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.8, 10), caseMat.black); body.scale.z = 0.55; body.position.y = -0.1;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.55, 8), caseMat.black); neck.scale.z = 0.55; neck.position.y = 0.55;
      g.add(body, neck); g.position.set(0, 0.05, -0.2); ch.bones.torso.add(g);
    } else if (kind === 'violin') {
      const m = new THREE.Mesh(mbox(0.12, 0.08, 0.72), caseMat.brown); m.position.set(0, -0.08, 0.0); m.rotation.x = Math.PI / 2; ch.anchors.handR.add(m);
    } else if (kind === 'folder') {
      const m = new THREE.Mesh(mbox(0.24, 0.32, 0.03), caseMat.folder); m.position.set(0, -0.12, 0.03); ch.anchors.handR.add(m);
    }
  } catch (e) { console.error('[music] case', e); }
}

// ------------------------------------------------------------------------------------------- exterior details
// The footprint (OSM r4043339) decomposed into ranges in a frame aligned with the 1936 block (u along the north range,
// v towards the south). Which parts are 1936 (Worthington, pitched roofs) and which are the 1976 additions (flat roofs)
// is inferred from the plan ("a block running east to west with a short arm at either end", circular stair at the east
// end) — a guess where the sources are silent.
const FRAME = { o: [280, 690], e: [0.988, -0.155], n: [0.155, 0.988] };
// the outline of the hand-built shell in the (u, v) frame: the union of RANGES below (the round stair is left out — it
// only adds to it), clockwise from the north range's north-west corner. The walk-in room must stand inside this.
const SHELL = [[-25.1, -11.3], [26.0, -11.3], [26.0, -3.7], [25.9, -3.7], [25.9, 13.6], [33.3, 13.6], [33.3, 2.6], [37.6, 2.6], [37.6, 13.6], [40.9, 13.6], [40.9, 22.3], [22.2, 22.3], [22.2, 13.8], [21.1, 13.8],
  [21.1, 29.3], [-4.1, 29.3], [-4.1, 13.8], [-5.2, 13.8], [-5.2, 5.4], [-1.0, 5.4], [-1.0, -3.7], [-15.3, -3.7], [-15.3, 3.4], [-21.7, 3.4], [-21.7, -3.7], [-25.1, -3.7]];
const toW = (u, v) => [FRAME.o[0] + u * FRAME.e[0] + v * FRAME.n[0], FRAME.o[1] + u * FRAME.e[1] + v * FRAME.n[1]];
const rectW = (u0, u1, v0, v1) => [toW(u0, v0), toW(u1, v0), toW(u1, v1), toW(u0, v1)];
const RANGES = [
  { r: [-25.1, 26.0, -11.3, -3.7], h: 8.0, roof: 'gabled', wall: 'college' },   // north range (1936)
  { r: [-21.7, -15.3, -3.7, 3.4], h: 8.0, roof: 'gabled', wall: 'college' },    // west short arm (1936)
  { r: [19.0, 25.9, -3.7, 13.8], h: 8.0, roof: 'gabled', wall: 'college' },     // east arm (1936)
  { r: [-5.2, 19.0, 5.4, 13.8], h: 8.0, roof: 'gabled', wall: 'college', front: true },      // entrance range facing St Aldate's
  { r: [-1.0, 19.0, -3.7, 5.4], h: 5.2, roof: 'flat', wall: 'stone' },          // infill (later)
  { r: [-4.1, 21.1, 13.8, 29.3], h: 7.0, roof: 'flat', wall: 'stone' },         // rear block (1970s)
  { r: [22.2, 40.9, 13.6, 22.3], h: 5.5, roof: 'flat', wall: 'stone' },
  { r: [33.3, 37.6, 2.6, 13.6], h: 5.5, roof: 'flat', wall: 'stone' },
];
function buildRanges(game, walk = false) {
  const W = game.world;
  // (walk-in: the entrance range's only wall that is seen is its gable front, and that front's windows are the lobby's
  // real ones — dressOpenings in install — so the range is drawn without painted windows (style `noWindows`, world/buildings.js). The rear block's and the east
  // arm's bays that a room opens are blanked in world/walkin_bays.js.)
  for (const g of RANGES) W.makeBuilding({ poly: rectW(...g.r), h: g.h, roof: g.roof, style: { wall: g.wall, roof: 'slate', color: '#d6c9ad', ...(walk && g.front ? { noWindows: true } : {}) }, id: 'music-' + g.r.join('_') });
  // the circular staircase at the east end
  const ring = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ring.push(toW(25.9 + Math.cos(a) * 2.9, 6.8 + Math.sin(a) * 2.9)); }
  W.makeBuilding({ poly: ring, h: 9.6, roof: 'cone', style: { wall: 'stone', roof: 'slate', color: '#d6c9ad' }, id: 'music-stair' });
  const b = game.map.buildings.find((x) => x.id === BUILDING);
  if (b) game.worldCollider.addPolygon(b.poly, { tag: 'building' });
}

function buildExterior(game, walk = false) {
  const W = game.world, B = new MBatch();
  buildRanges(game, walk);
  const sign = (lines, w, h, bg, fg) => canvasTex(512, Math.round(512 * h / w), (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(10, 10, cw - 20, ch - 20);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([t, size, font], i) => { g.font = `${font || 'bold'} ${size}px Georgia, "Times New Roman", serif`; g.fillText(t, cw / 2, ch * (i + 1) / (lines.length + 1)); });
  });
  const mats = {
    dress: new THREE.MeshStandardMaterial({ color: 0xe8dcbc, roughness: 0.85 }),          // Clipsham dressings (paler than the Bladon walls)
    recess: new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.9 }),
    oak: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.6 }),
    iron: W.mats.iron, gold: new THREE.MeshStandardMaterial({ color: 0xd8a83a, roughness: 0.3, metalness: 0.9, emissive: 0x2a1a00 }),
    gravel: W.layerMaterial(W.mats.gravel, 'marking'), post: new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.5 }),
    signFac: new THREE.MeshStandardMaterial({ map: sign([['UNIVERSITY OF OXFORD', 34], ['Faculty of Music', 62]], 2.0, 0.8, '#0f2147', '#f4efe2'), roughness: 0.6 }),
    signBate: new THREE.MeshStandardMaterial({ map: sign([['Bate Collection', 54], ['of Musical Instruments', 34, 'italic'], ['← this way · ring the bell', 28, 'normal']], 1.4, 0.7, '#0f2147', '#f4efe2'), roughness: 0.6 }),
    plaque: new THREE.MeshStandardMaterial({ map: sign([['BATE COLLECTION', 50], ['Please ring', 36, 'italic']], 0.6, 0.3, '#e4d6b0', '#2a1a10'), roughness: 0.5 }),
  };
  // ---- main entrance (local frame: x = out of the wall, negative = towards the street; z along the facade)
  const E = new MBatch(), out = -1, dx = 0, dz = 0;
  E.span('dress', out * 0.45, 0.05, 0, 3.15, -1.35, -0.95); E.span('dress', out * 0.45, 0.05, 0, 3.15, 0.95, 1.35);   // jambs
  E.span('dress', out * 0.45, 0.05, 2.75, 3.15, -1.35, 1.35);   // lintel
  if (!walk) {                                                     // (walk-in: the doorway is a real opening with a real door in it)
    E.span('recess', -0.03, 0.05, 0, 2.75, -0.95, 0.95);           // the deep reveal (dark)
    E.span('oak', -0.09, -0.03, 0, 2.5, -0.75, -0.02); E.span('oak', -0.09, -0.03, 0, 2.5, 0.02, 0.75);
    E.span('iron', -0.12, -0.09, 1.1, 1.25, -0.1, -0.06); E.span('iron', -0.12, -0.09, 1.1, 1.25, 0.06, 0.1);
  } else { E.span('dress', -0.02, 0.05, L.door.h, 2.75, -0.95, 0.95); for (const sz of [-1, 1]) E.span('dress', -0.02, 0.05, 0, L.door.h, sz * 0.95, sz * (L.door.w / 2)); }      // stone round the leaf: the doorway is narrower than the surround
  E.span('dress', -1.0, 0.05, 3.15, 3.3, -1.6, 1.6);                     // balcony slab
  for (let i = 0; i <= 16; i++) E.span('iron', -1.0, -0.97, 3.3, 4.25, -1.6 + i * 0.2 - 0.012, -1.6 + i * 0.2 + 0.012);
  E.span('iron', -1.0, -0.95, 4.22, 4.28, -1.6, 1.6);
  for (const s of [-1, 1]) E.span('iron', -1.0, 0, 4.22, 4.28, s * 1.6 - 0.02, s * 1.6 + 0.02);
  // St Catherine (with her wheel) supported by two angels, gilded, on the balcony front
  const fx = -1.03;
  E.add('gold', new THREE.CylinderGeometry(0.09, 0.2, 0.95, 10), fx, 3.95, dz);
  E.add('gold', new THREE.SphereGeometry(0.1, 10, 8), fx, 4.5, dz);
  E.add('gold', new THREE.TorusGeometry(0.16, 0.025, 6, 16), fx - 0.05, 3.95, 0.24, -Math.PI / 2);
  E.add('gold', new THREE.TorusGeometry(0.11, 0.03, 6, 14), fx, 4.62, dz, [Math.PI / 2, 0, 0]);   // crown
  for (const s of [-1, 1]) {
    E.add('gold', new THREE.CylinderGeometry(0.05, 0.1, 0.5, 8), fx, 3.55, s * 0.42);
    E.add('gold', new THREE.SphereGeometry(0.06, 8, 6), fx, 3.86, s * 0.42);
    E.add('gold', mbox(0.02, 0.42, 0.22), fx + 0.03, 3.7, s * 0.58, [s * 0.5, 0, 0]);       // wings
  }
  const eg = E.build(mats, { shadows: true, name: 'music-entrance' });
  eg.position.set(DOOR.wall[0], 0, DOOR.wall[1]); eg.rotation.y = 0.1557; W.addStatic(eg);   // entrance front: the u = −5.2 face of the entrance range
  // ---- Bate side door (local frame: wall along x, outside = −z)
  const Bt = new MBatch();
  Bt.span('dress', -0.75, 0.75, 0, 2.5, -0.12, 0.05); Bt.span('oak', -0.5, 0.5, 0, 2.2, -0.16, -0.12);
  Bt.add('plaque', new THREE.PlaneGeometry(0.6, 0.3), 1.05, 1.4, -0.04, Math.PI);
  Bt.span('iron', 0.62, 0.7, 1.25, 1.33, -0.17, -0.12);
  const bg = Bt.build(mats, { shadows: true, name: 'music-bate-door' });
  bg.position.set(BATE.wall[0], 0, BATE.wall[1]); bg.rotation.y = 0.155; W.addStatic(bg);   // wall runs (253.5,682.7)->(280.3,678.5)
  // ---- gate piers + gates (open) at the drive on St Aldate's
  const [gx, gz] = GATE;
  for (const s of [-1, 1]) {
    B.span('dress', gx - 0.3, gx + 0.3, 0, 1.9, gz + s * 1.9 - 0.3, gz + s * 1.9 + 0.3); B.span('dress', gx - 0.36, gx + 0.36, 1.9, 2.0, gz + s * 1.9 - 0.36, gz + s * 1.9 + 0.36);
    for (let i = 0; i < 8; i++) B.span('iron', gx + 0.25 + i * 0.16, gx + 0.27 + i * 0.16, 0.05, 1.5, gz + s * 1.6 - 0.01, gz + s * 1.6 + 0.01);
    B.span('iron', gx + 0.25, gx + 1.45, 1.42, 1.48, gz + s * 1.6 - 0.015, gz + s * 1.6 + 0.015); B.span('iron', gx + 0.25, gx + 1.45, 0.12, 0.17, gz + s * 1.6 - 0.015, gz + s * 1.6 + 0.015);
  }
  game.worldCollider.addCircle(gx, gz - 1.9, 0.4, { tag: 'pier' }); game.worldCollider.addCircle(gx, gz + 1.9, 0.4, { tag: 'pier' });
  // ---- signboards: Faculty (by the gate, facing the street) and Bate (pointing left, inside the gates)
  B.span('post', gx - 0.6, gx - 0.52, 0, 1.4, gz + 2.6, gz + 2.68); B.span('post', gx - 0.6, gx - 0.52, 0, 1.4, gz + 4.32, gz + 4.4);
  B.add('signFac', new THREE.PlaneGeometry(2.0, 0.8), gx - 0.62, 1.55, gz + 3.5, -Math.PI / 2);
  B.span('post', gx - 0.6, gx - 0.52, 0.75, 1.95, gz + 2.65, gz + 4.35);
  B.span('post', gx + 3.0, gx + 3.06, 0, 1.0, gz - 3.0, gz - 2.94);
  B.add('signBate', new THREE.PlaneGeometry(1.4, 0.7), gx + 2.96, 1.3, gz - 2.97, -Math.PI / 2);
  game.worldCollider.addCircle(gx - 0.56, gz + 3.5, 0.25, { tag: 'sign' }); game.worldCollider.addCircle(gx + 3.03, gz - 2.97, 0.1, { tag: 'sign' });
  // ---- gravel: the drive to the front door and the path round to the Bate
  const drive = [[243.5, 704.2], [262, 702.4], [275.6, 700.3]], bate = [[249.5, 703.2], [247.6, 684.5], [250, 681.6], [258.4, 680.4]];
  B.addM('gravel', W.ribbon(drive, 3.6, 0.052), new THREE.Matrix4());
  B.addM('gravel', W.ribbon(bate, 1.6, 0.053), new THREE.Matrix4());
  const g = B.build(mats, { shadows: true, name: 'music-exterior' });
  W.addStatic(g);
  W.addLampGlow(DOOR.wall[0] - 0.6, 2.6, DOOR.wall[1] - 1.6);
}
