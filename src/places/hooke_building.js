// The Robert Hooke Building, Parks Road (the mapped building w679676362): a ground-floor classroom you can see into from
// the street, where a delighted (invented, unnamed) lecturer waves at a whiteboard showing a banana on a set of x–y axes
// and says "Ah look, a banana." every 12–20 s on the shared clock. Pure data / schedule: _hooke_logic.js; the board
// picture: _hooke_board.js; geometry, the students and the lecturer's pose: _hooke_room.js.
//
// Building: the world still draws the building itself (city atlas, LOD, shadows: no new draw for the building). preMap
// cuts the classroom out of the footprint's Parks Road face as a bay (13 m × 9 m) and adds the floors above it as a part
// standing on the ground storey (minH 3.85). This module draws the bay: its stone front with real openings (glass panes
// you see through), the room, the board, the people, the lettering over the windows and the door plate.
// Research (2026-11, brief): the building is on the east side of Parks Road between the Keble Road junction and the
// Museum (OSM name, the University access guide: entrance to the left of the Museum's when coming from Keble Road), and
// houses Computer Science. Its Parks Road front as drawn — pale stone, tall ground-floor windows — is a GUESS.
//
// Cost: the bay (stone front, room shell, glass, lettering) = 4 draws within 300 m; the room's contents (board, the
// students as one merged mesh, the lecturer, his marker) only exist / draw within 80 m (built on first approach).
// Multiplayer: nothing sent; the lecturer's whole act is a function of game.time.now().
//
// Test hooks: game.hooke = { sights, state, stats(), prof(), debugEnter(), debugExit(), speakNow(), targets() }
import * as THREE from 'three';
import { HOOKE, ROOM, PROF_SPEAKER, PROF_LINE, SIGHTS, roomToWorld, notchedPoly, bayPoly, profAt, lineTime, lastLine, ROOM_YAW, LOOK_IN, FACING_OUT } from './_hooke_logic.js';
import { buildShell, buildExterior, buildGlass, boardQuads, makeSignTexture, glowMaterial, bakeStudents, createProfessor, poseProfessor, roomColliders } from './_hooke_room.js';

import { planWalkin, kitGaps, cityDoor, mergeRoom, warmLater, dressOpenings, roomCrowd } from './_walkin_city.js';
import { SEAMLESS } from '../core/interiors.js';
import { randomLook } from '../core/characters.js';
const NEAR = 80, SHELL_FAR = 300, ROOM_ID = 'hooke_room', UPPER_ID = 'hooke_upper';
// Walk-in (core/interiors.js "seamless"; _walkin_city.js). The interior was always drawn in the bay's own frame
// (roomToWorld), so it is in place as it stands; only the lobby moves 0.4 m back from the Parks Road face (LOBBY) so
// that its front wall is inside the mapped wall. The street door is an automatic sliding pair (GUESS: a 2000s lab
// building). The classroom's three windows are declared openings with `punch: false`: the bay's front is real
// modelled glass in the world already. From the street the classroom you see is the world's (root / dyn below); the
// room's own copy of it is shown only while you are inside (when the world's is hidden).
const LOBBY = { w: 4.9, d: 6, back: 0.4, t: 0.2, doorW: 1.6, doorH: 2.7 };      // (the doorway = the stone door-case's own opening, _hooke_room.js buildExterior)
export const sights = SIGHTS;

export default {
  id: 'hooke_building',
  preMap(game) {
    try {
      const map = game.map, b = map && map.buildings.find((q) => q.id === HOOKE.id);
      if (!b) return;
      const np = notchedPoly(b.poly);
      if (!np) { console.warn('[hooke_building] footprint changed: the classroom bay was not cut'); return; }
      b.poly = np;
      const bay = bayPoly(), c = [bay.reduce((s, p) => s + p[0], 0) / 4, bay.reduce((s, p) => s + p[1], 0) / 4];
      map.buildings.push({ id: UPPER_ID, h: b.h || HOOKE.H, minH: HOOKE.GROUND - 0.05, poly: bay, c, tags: { building: 'university' }, part: true });
      const look = { wall: 'stone', roof: 'flat', color: '#efe6d2', ivy: false };
      game.overrides.style.set(HOOKE.id, { ...look, storeys: 3 });
      game.overrides.style.set(UPPER_ID, { ...look, storeys: 2 });
      game.hookeCut = true;
    } catch (e) { console.error('[hooke_building] preMap', e); }
  },

  install(game) {
    const W = game.world, scene = game.worldScene, col = game.worldCollider;
    const S = { err: false, built: false, forceU: null, saidK: null, inSaidK: null, last: null, lines: 0 };
    const uGlow = { value: 0.45 };
    const sign = makeSignTexture();
    const M = {
      shell: new THREE.MeshBasicMaterial({ vertexColors: true, name: 'hooke:room' }),
      ext: new THREE.MeshLambertMaterial({ vertexColors: true, name: 'hooke:front' }),
      glass: new THREE.MeshStandardMaterial({ color: 0xc9d8de, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.14, depthWrite: false, name: 'hooke:glass' }),
      board: new THREE.MeshBasicMaterial({ map: sign.tex, color: 0xffffff, name: 'hooke:board' }),
      signs: new THREE.MeshLambertMaterial({ map: sign.tex, alphaTest: 0.5, name: 'hooke:signs' }),
      people: glowMaterial(uGlow),
    };
    const quads = boardQuads();
    const G = { shellW: buildShell({ interior: false }), ext: buildExterior({ door: !SEAMLESS }), glass: buildGlass(), board: quads.board, signs: quads.signs };
    const mesh = (geo, mat, name, opts = {}) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = false; m.receiveShadow = !!opts.rs; if (opts.ro !== undefined) m.renderOrder = opts.ro; return m; };

    // ---------------------------------------------------------------- the bay in the world (static) + the contents (dynamic)
    const [ox, oz] = roomToWorld(0, 0), oy = 0.0;
    const root = new THREE.Group(); root.name = 'hooke:bay'; root.position.set(ox, oy, oz); root.rotation.y = ROOM_YAW;
    const mExt = mesh(G.ext, M.ext, 'hooke:front', { rs: true }), mShell = mesh(G.shellW, M.shell, 'hooke:room'), mGlass = mesh(G.glass, M.glass, 'hooke:glass', { ro: 2 }), mSigns = mesh(G.signs, M.signs, 'hooke:signs', { rs: true });
    root.add(mExt, mShell, mGlass, mSigns);
    root.updateMatrixWorld(true);
    W && W.addStatic ? W.addStatic(root) : scene.add(root);
    const dyn = new THREE.Group(); dyn.name = 'hooke:people'; dyn.position.copy(root.position); dyn.rotation.y = ROOM_YAW;
    scene.add(dyn);
    const mBoard = mesh(G.board, M.board, 'hooke:board'); dyn.add(mBoard);
    dyn.updateMatrixWorld(true);      // (core/cull.js reads matrixWorld when it collects module meshes: never let it see the origin)
    let students = null, prof = null;
    function ensureContents() {
      if (S.built) return;
      S.built = true;
      try { students = mesh(bakeStudents(), M.people, 'hooke:students'); students.castShadow = false; dyn.add(students); } catch (e) { console.error('[hooke_building] students', e); }
      try { prof = createProfessor(M.people); prof.ch.group.position.set(ROOM.prof.x, 0.02, ROOM.prof.z); dyn.add(prof.ch.group); } catch (e) { console.error('[hooke_building] lecturer', e); }
      dyn.updateMatrixWorld(true);
    }
    // collision: the bay's front (the rest of the bay is walled by the notched map building)
    { const a = roomToWorld(-HOOKE.W / 2, 0.08), b = roomToWorld(HOOKE.W / 2, 0.08); col.addSegment(a[0], a[1], b[0], b[1]); }
    // nothing street-side in the bay, and no bins / benches / stands between the windows and the pavement
    try {
      if (W && W.clearArea) {
        W.clearArea(bayPoly());
        const k = [roomToWorld(-HOOKE.W / 2 - 0.5, 0.2), roomToWorld(HOOKE.W / 2 + 0.5, 0.2), roomToWorld(HOOKE.W / 2 + 0.5, 10.4), roomToWorld(-HOOKE.W / 2 - 0.5, 10.4)];
        W.clearArea(k, { trees: false, lamps: false });
      }
    } catch (e) { console.error('[hooke_building] clearArea', e); }

    // ---------------------------------------------------------------- speech
    if (game.voice && game.voice.registerSpeakers) { try { game.voice.registerSpeakers({ [PROF_SPEAKER]: { locale: 'en-GB', gender: 'm' } }); } catch { /* */ } }
    const profWorld = { get x() { return roomToWorld(ROOM.prof.x, ROOM.prof.z)[0]; }, get z() { return roomToWorld(ROOM.prof.x, ROOM.prof.z)[1]; } };
    /** say the line from lecturer P: a rendered clip when there is one (no bubble), else the bubble (and live speech) */
    function speak(P, opts, k) {
      const v = game.voice;
      let p = null;
      try { if (v && v.say) p = v.say(PROF_SPEAKER, PROF_LINE, { ...opts, important: true, replace: true }); } catch (e) { p = null; }
      const clip = !!(p && p.clip), why = p ? p.reason : 'no-voice';
      if (!clip && why !== 'far' && P) P.ch.say(PROF_LINE, 2.8);
      // the clip is played through game.voice directly (shared-clock timing), so move his jaw for its length ourselves
      else if (clip && P && P.ch) { P.ch._bubbleOn = false; P.ch._bubbleT = Math.max(P.ch._bubbleT || 0, (p.dur || 2.2) + 0.15); }
      S.last = { k, at: game.time.now(), via: clip ? 'clip' : why, opts: { ...opts, pos: undefined } };
      S.lines++;
      return S.last;
    }

    // ---------------------------------------------------------------- the way in: lobby + the classroom
    let inProf = null, inDims = null;
    const doorW = roomToWorld(HOOKE.doorS - HOOKE.Sc, 0.95);
    let plan = null, inCls = null;
    try {
      const dx = HOOKE.doorS - HOOKE.Sc, lx = -HOOKE.W / 2 - 0.1 - LOBBY.w / 2, z1 = -LOBBY.back;
      // the mapped outline without the notch preMap cut for the bay (the bay is the classroom: part of the building)
      const b0 = game.map.buildings.find((q) => q.id === HOOKE.id), nb = [roomToWorld(-HOOKE.W / 2, -HOOKE.D), roomToWorld(HOOKE.W / 2, -HOOKE.D)];
      const outline = b0 ? b0.poly.filter((p) => !nb.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.3)) : null;
      if (outline) plan = planWalkin(game, { id: ROOM_ID, building: outline, door: { pos: doorW, facing: FACING_OUT }, snap: false,
        portal: { at: [dx, z1 + LOBBY.t / 2], out: 0, w: LOBBY.doorW, h: LOBBY.doorH }, wall: LOBBY.back - LOBBY.t / 2,
        rects: [[lx - LOBBY.w / 2, z1 - LOBBY.d, lx + LOBBY.w / 2, z1], [-HOOKE.W / 2 + 0.1, -HOOKE.D + 0.1, HOOKE.W / 2 - 0.1, -0.2]],
        windows: ROOM.windows.map(([x0, x1]) => ({ at: [(x0 + x1) / 2, -0.12], out: 0, w: x1 - x0, y0: ROOM.sill, y1: ROOM.head, depth: 0.2, punch: false })),
        center: [0, -3], mid: [ROOM.talk.x, ROOM.talk.z], route: [[dx, -2.0], [lx + 0.6, -1.175], [-HOOKE.W / 2 + 1.0, -1.175], [-0.5, -1.2], [-0.5, ROOM.talk.z]] });
    } catch (e) { console.error('[hooke_building] plan', e); }
    game.interiors.register({
      id: ROOM_ID, name: 'Robert Hooke Building', background: 0x1d2024, ambient: 0.6,
      seamless: plan && plan.fit.ok ? plan.seamless : null,
      onExit() { if (inCls) inCls.visible = false; },
      doors: [{ pos: doorW, facing: FACING_OUT, label: 'Go into the Robert Hooke Building' }],
      build(ctx) { inDims = buildInterior(ctx); return { spawn: inDims.spawn, heading: inDims.heading }; },
      onEnter() { if (inCls) inCls.visible = true; try { game.ui.toast('The Robert Hooke Building. Somebody is very pleased about something in the room on the right.', 4); } catch { /* */ } },
      updateShown(dt) { lobbyCrowd.tick(dt); },
      update(dt) { lobbyCrowd.tick(dt); try { tickInside(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[hooke_building] inside', e); } } },
    });
    // the people of the lobby (the class and its lecturer are in the bay already): a receptionist at the desk all day,
    // students waiting about in teaching hours. There whenever the lobby is shown (seen through the glass doors).
    const LX = -HOOKE.W / 2 - 0.1 - LOBBY.w / 2;
    const lobbyCrowd = roomCrowd(game, ROOM_ID, {
      cap: 5, signature: () => { const h = game.time.hour; return h >= 9 && h < 18 ? 'day' : h >= 7.5 && h < 21 ? 'edge' : 'night'; },
      populate(spawn) {
        const h = game.time.hour; if (h < 7.5 || h >= 21) return;
        spawn(LX + 0.5, -6.04, randomLook('hooke-reception', { outfit: 'smart' }), { heading: 0, pose: 'stand',      // (behind the desk, clear of it: at -5.75 she stood with her front in the desk)
           lines: ['Lecture room is on your right.', 'He has been on that slide since nine.', 'Sign in, please. Nobody ever does.'], label: 'Receptionist', role: 'porter' });
        if (h < 9 || h >= 18) return;
        spawn(LX - 1.55, -3.2, randomLook('hooke-wait-a', { outfit: 'casual' }), { heading: Math.PI / 2, pose: 'sit', lines: ['I am early for the two o\'clock.', 'Is it still the banana?'], role: 'student' });
        spawn(LX - 0.9, -1.9, randomLook('hooke-wait-b', { outfit: 'casual' }), { heading: 2.2, pose: 'talk', lines: ['It is definitely a banana.', 'I think it is a metaphor.'], role: 'student' });
        spawn(LX - 0.25, -2.55, randomLook('hooke-wait-c', { outfit: 'casual' }), { heading: -1.0, pose: 'talk', lines: ['It is not a metaphor. It is a banana.'], role: 'student' });
      },
    });
    // the outside of the doorway (world scene): bronze frame in the stone door-case, a dark pane for the far view
    try { const d = game.interiors.get(ROOM_ID); if (d && d.sl) dressOpenings(game, ROOM_ID, [{ p: 0, fill: 0x1b2229, frame: { w: 0.05, color: 0x3a332b } }]); } catch (e) { console.error('[hooke_building] door dressing', e); }
    if (plan) warmLater(game, ROOM_ID);
    function buildInterior(ctx) {
      const s = ctx.scene, K = W.interiorKit, c = ctx.collider, dx = HOOKE.doorS - HOOKE.Sc, SL = !!(ctx.seamless && plan);
      // (walk-in: the classroom copy in its own group, shown only while you are inside — from the street it is the world's)
      const cls = SL ? (inCls = new THREE.Group()) : s; if (SL) { cls.name = 'hooke:classroom-in'; cls.userData.live = true; cls.visible = game.player.place === ROOM_ID; s.add(cls); }
      cls.add(mesh(buildShell({ interior: true }), M.shell, 'hooke:room-in'));
      cls.add(mesh(G.ext, M.ext, 'hooke:front-in'), mesh(G.glass, M.glass, 'hooke:glass-in', { ro: 2 }), mesh(G.board, M.board, 'hooke:board-in'));
      try { cls.add(mesh(students ? students.geometry : bakeStudents(), M.people, 'hooke:students-in')); } catch (e) { console.error('[hooke_building] students in', e); }
      // the lobby, north of the classroom: the street door in its front wall, the classroom door in its side wall
      const lw = 4.9, lx = -HOOKE.W / 2 - 0.1 - lw / 2, ld = 6, lz = SL ? -LOBBY.back - ld / 2 : -ld / 2;
      K.room(s, { x: lx, z: lz, w: lw, d: ld, h: 3.3, floor: 'floorTiles', walls: 'plaster', collider: c,
        doors: SL ? [...kitGaps(plan, { x: lx, z: lz }).filter((q) => q.solid), { wall: 'e', at: -1.175 - lz, width: 1.1, height: 2.2 }]
          : [{ wall: 's', at: dx - lx, width: 1.7, height: 2.7 }, { wall: 'e', at: ld / 2 - 1.175, width: 1.1, height: 2.2 }] });
      if (SL) cityDoor(ctx, plan, { kind: 'slide', rangeOut: 2.6, rangeIn: 2.2 });
      K.bench(s, { x: lx - 1.6, z: -3.6, rot: Math.PI / 2, w: 1.8 });
      if (SL) {
        // the lobby dressed (plain boxes: merged below): entrance mat, reception desk with a sign-in book and a monitor,
        // a staff directory behind it, a notice board and a row of posters, a pot plant, a ceiling light panel, a clock
        const bx = (w, h, d, col, x, y, z, em = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col, emissive: em })); m.position.set(x, y + h / 2, z); s.add(m); return m; };
        const zf = -LOBBY.back, zb = zf - ld, xw = lx - lw / 2, xe = lx + lw / 2;
        bx(1.5, 0.02, 1.1, 0x3a3d40, dx, 0.002, zf - 0.75);                                            // mat
        bx(2.0, 1.02, 0.55, 0xc6a97b, lx + 0.5, 0, zb + 1.05); bx(2.1, 0.04, 0.65, 0x3a332b, lx + 0.5, 1.02, zb + 1.05);   // desk
        bx(0.34, 0.02, 0.26, 0xf4f1e6, lx + 0.0, 1.06, zb + 1.1); bx(0.42, 0.3, 0.03, 0x2a2c30, lx + 1.0, 1.1, zb + 0.95); bx(0.1, 0.05, 0.1, 0x2a2c30, lx + 1.0, 1.06, zb + 0.95);
        c.addBox(lx + 0.5, zb + 1.05, 2.1, 0.65, 0);
        bx(1.7, 1.1, 0.03, 0x24313f, lx + 0.5, 1.45, zb + 0.03);                                       // directory: dark board, pale name strips
        for (let r = 0; r < 7; r++) for (let q = 0; q < 2; q++) bx(0.66, 0.07, 0.012, 0xe8e4d8, lx + 0.5 - 0.4 + q * 0.8, 1.56 + r * 0.13, zb + 0.05);
        bx(0.03, 0.95, 1.5, 0xa77f4c, xw + 0.025, 1.15, -3.6);                                         // cork notice board over the bench
        for (const [q, yy, w, h, col] of [[-0.5, 1.5, 0.3, 0.42, 0xf4f1e6], [-0.1, 1.62, 0.21, 0.3, 0xf2e37a], [0.2, 1.3, 0.3, 0.21, 0xf4f1e6], [0.5, 1.55, 0.21, 0.3, 0xbfe0f0], [-0.45, 1.22, 0.21, 0.15, 0xf6c8c8]]) bx(0.012, h, w, col, xw + 0.046, yy, -3.6 + q);
        for (const [z, col] of [[-1.3, 0x2f5d8a], [-5.5, 0x7a2f3a]]) { bx(0.02, 0.84, 0.6, 0xf4f1e6, xw + 0.02, 1.25, z); bx(0.012, 0.5, 0.48, col, xw + 0.035, 1.5, z); }      // framed posters
        bx(0.34, 0.4, 0.34, 0x6a5a48, xe - 0.45, 0, zb + 0.45); bx(0.5, 0.75, 0.5, 0x2f6b3a, xe - 0.45, 0.4, zb + 0.45); c.addBox(xe - 0.45, zb + 0.45, 0.4, 0.4, 0);   // plant
        bx(1.2, 0.03, 0.6, 0xf6f8ff, lx, 3.27, -3, 0xb8bcc4); bx(1.2, 0.03, 0.6, 0xf6f8ff, lx, 3.27, -5.2, 0xb8bcc4);                                 // light panels
        bx(0.3, 0.3, 0.03, 0xf4f1e6, lx - 1.2, 2.3, zb + 0.03); bx(0.02, 0.11, 0.012, 0x24211d, lx - 1.2, 2.45, zb + 0.05);                         // clock
        bx(0.03, 0.34, 0.9, 0x3a332b, xe - 0.025, 2.32, -1.175); bx(0.012, 0.2, 0.7, 0xe8e4d8, xe - 0.046, 2.39, -1.175);                         // "Lecture Room" over the classroom door (a plain strip)
      }
      c.addBox(lx - 1.6, -3.6, 0.6, 1.8, 0);
      K.warmLight(s, { x: lx, y: 3.0, z: -3, intensity: 4, distance: 9, color: 0xf4f6ff });
      K.warmLight(s, { x: 0, y: 3.3, z: -4.5, intensity: 6, distance: 16, color: 0xf6f8ff, shade: false });
      for (const [x, z, w, d] of roomColliders(true)) c.addBox(x, z, w, d, 0);
      // outside the windows: Parks Road (the street, Keble's brick across it, trees), painted
      if (!SL) s.add(backdrop());
      const P = (inProf = createProfessor(M.people));
      P.ch.group.position.set(ROOM.prof.x, 0.02, ROOM.prof.z); cls.add(P.ch.group);
      if (SL) mergeRoom(s);
      ctx.addExit(dx, -0.7, 'Out to Parks Road');
      game.interact.add({ place: ctx.id, pos: [ROOM.talk.x, ROOM.talk.z], radius: 2.0, label: 'Talk to the lecturer', onUse: () => talk() });
      game.interact.add({ place: ctx.id, pos: [ROOM.board.x, -HOOKE.D + 1.4], radius: 1.8, label: 'Look at the whiteboard', onUse: () => { try { game.ui.toast('A banana, carefully drawn over a set of x–y axes. Nothing else. Nothing else is needed.', 4); } catch { /* */ } } });
      return { spawn: [dx, -1.3], heading: 2.3, dx };
    }
    function talk() {
      if (!inProf) return null;
      const p = game.player.pos, d = Math.hypot(p.x - ROOM.prof.x, p.z - ROOM.prof.z);
      return speak(inProf, { dist: d, volume: 1, interrupt: true }, 'talk');
    }
    function backdrop() {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
      const g = cv.getContext('2d');
      try {
        const sky = g.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, '#9fc0dc'); sky.addColorStop(1, '#dfe7ec');
        g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
        g.fillStyle = '#5e7d4a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(60 + i * 118, 170 + (i % 3) * 14, 70 + (i % 2) * 18, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#9a4a34'; g.fillRect(0, 250, 1024, 140);                    // Keble's brick across the road
        for (let y = 262; y < 390; y += 26) { g.fillStyle = y % 52 === 0 ? '#d9c79a' : '#3b4a6a'; g.fillRect(0, y, 1024, 5); }
        g.fillStyle = '#4c4a48'; g.fillRect(0, 390, 1024, 70); g.fillStyle = '#9a968e'; g.fillRect(0, 460, 1024, 52);
        g.fillStyle = '#f2f0e8'; for (let x = 20; x < 1024; x += 120) g.fillRect(x, 423, 60, 4);
      } catch { /* node */ }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), new THREE.MeshBasicMaterial({ map: t }));
      m.position.set(0, 3.4, 7.5); m.rotation.y = Math.PI; m.name = 'hooke:backdrop';
      return m;
    }

    // ---------------------------------------------------------------- per frame
    const _c = new THREE.Vector3();
    /** the schedule (or, for screenshots, a pinned moment: S.forceU = seconds from a line, the clock still running) */
    const stateAt = (now) => (S.forceU == null ? profAt(now) : profAt(lineTime(lastLine(now).k) + S.forceU * 1000 + (now % 2500)));
    function light() {
      const night = W && W.night != null ? W.night : 0;
      uGlow.value = game.player.place === ROOM_ID ? 0.22 : 0.3 + 0.35 * night;
      const k = 0.8 + 0.18 * night; M.shell.color.setRGB(k, k, k);
    }
    function tick(dt) {
      const out = game.player.place === 'world', air = !!(W && W.aerial);
      _c.copy(game.camera.position);
      const d = Math.hypot(_c.x - ox, _c.z - oz);
      const shellOn = out && !air && d < SHELL_FAR, near = out && !air && d < NEAR;
      if (root.visible !== shellOn) root.visible = shellOn;
      if (dyn.visible !== near) dyn.visible = near;
      if (!near) return;
      ensureContents();
      light();
      const now = game.time.now(), st = stateAt(now);
      if (prof) poseProfessor(prof, st, dt);
      // the line, outside: heard through the glass (quieter), from the lecturer's spot; once per scheduled line
      if (st.u >= 0 && st.u < 1.0 && S.saidK !== st.k) {
        S.saidK = st.k;
        const p = game.player.pos, dp = Math.hypot(p.x - profWorld.x, p.z - profWorld.z);
        if (dp < 32) speak(prof, { pos: profWorld, volume: 0.5 }, st.k);
      }
    }
    function tickInside(dt) {
      if (!inProf) return;
      light();
      const st = stateAt(game.time.now());
      poseProfessor(inProf, st, dt);
      if (st.u >= 0 && st.u < 1.0 && S.inSaidK !== st.k) {
        S.inSaidK = st.k;
        const p = game.player.pos;
        speak(inProf, { dist: Math.hypot(p.x - ROOM.prof.x, p.z - ROOM.prof.z) * 0.6, volume: 1 }, st.k);
      }
    }

    game.hooke = {
      sights, state: S, root, dyn, sign, materials: M, plan: () => plan,
      prof: () => prof, profInside: () => inProf, students: () => students,
      schedule: profAt,
      /** screenshots: hold the act near u seconds from a line (null = the shared clock) */
      pose(u) { S.forceU = u; return u; },
      debugEnter() { const d = game.interiors.get(ROOM_ID); return d ? game.interiors.enterNow(ROOM_ID, d.doors[0]) : null; },
      debugExit() { if (game.interiors.current && game.interiors.current.id === ROOM_ID) game.interiors.leaveNow(); return game.player.place; },
      talk, speakNow: () => (prof ? speak(prof, { pos: profWorld, volume: 0.5 }, 'debug') : null),
      ensureContents,
      /** world points for tests / screenshots: the board's centre, the lecturer, two pavement spots looking in */
      targets() {
        const B = ROOM.board, b = roomToWorld(B.x, -HOOKE.D + 0.1), pr = roomToWorld(ROOM.prof.x, ROOM.prof.z);
        const pave = [-2.2, 1.6].map((x) => roomToWorld(x, 12.0));
        return { board: [b[0], B.y, b[1]], prof: [pr[0], 1.5, pr[1]], pavement: pave, door: doorW, lookIn: LOOK_IN, facingOut: FACING_OUT };
      },
      stats() {
        let draws = 0, tris = 0;
        const add = (o) => o.traverse((m) => { let v = true; for (let q = m; q; q = q.parent) if (q.visible === false) { v = false; break; } if (v && (m.isMesh || m.isSkinnedMesh) && m.layers.isEnabled(0)) { draws++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
        add(root); add(dyn);
        return { draws, tris: Math.round(tris), contents: S.built, root: root.visible, near: dyn.visible };
      },
    };
    tick(0);
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[hooke_building]', e); } } } };
  },
};
