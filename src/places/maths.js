// Mathematical Institute, Andrew Wiles Building (Radcliffe Observatory Quarter, Woodstock Road; opened Oct 2013).
//   exterior  _maths_exterior.js  (replaces OSM w242287396 + the "Penrose Paving" area w1444671745)
//   interiors _maths_interior.js  'maths_institute' (lobby, stair + lift, mezzanine, crystals, café, L1–L6 doors)
//                                 'maths_lecture'   (Lecture Theatre 1: a walk-in room OFF the mezzanine, through a real
//                                 fire door — core/interiors.js room-to-room portal; no prompt, no fade)
//   lift      _maths_lift.js      a real car between the lobby and the mezzanine: walk in, the doors shut, it carries you
//   lecture   _maths_lecture.js   (Dr Earl's Analysis I lectures at 9, 10, 11, 12 game time; content _maths_lectures.js,
//                                  chalk _maths_chalk.js), Penrose tiling generator _maths_penrose.js
// Test hooks: game.maths.{startLecture(n, t), boardsDump(), state(), sitAt(row, block, i), sheet(), view(...), stats()}
import * as THREE from 'three';
import { AWB, buildExterior } from './_maths_exterior.js';
import { buildInstitute, instituteGround, buildTheatre, theatreGround, INST, LT, rowFloor, ENTR } from './_maths_interior.js';
import { planWalkin, cityDoor, glazing, warmLater } from './_walkin_city.js';
import { createLecture } from './_maths_lecture.js';
import { LECTURES, lectureNow, mmss, LECTURE_SEC, SLOT_MS, FRAME_B } from './_maths_lectures.js';
import { plainText, layoutFrame } from './_maths_chalk.js';
import { randomLook } from '../core/characters.js';

const IN = 'maths_institute', LEC = 'maths_lecture';

export default {
  id: 'maths',
  preMap(game) {
    game.overrides.skip.add('w242287396');     // Andrew Wiles Building (rebuilt by hand)
    game.overrides.skip.add('w1444671745');    // "Penrose Paving" area (drawn as the real tiling)
  },

  install(game) {
    const M = (game.maths = { built: false });
    let earlLook = null;
    import('./_people.js').then((m) => { const L = m.lookFor && m.lookFor('earl'); if (L) { delete L.friend; earlLook = L; } }).catch(() => {});

    // ---------------------------------------------------------------- exterior
    let ext = null;
    try { ext = buildExterior(game); M.exterior = { drawCalls: ext.drawCalls, tris: Math.round(ext.tris) }; } catch (e) { console.error('[maths] exterior', e); }

    const out = (p, n, d) => [p[0] + n[0] * d, p[1] + n[1] * d];
    const doorE = out(AWB.eMid, AWB.nE, 1.2), doorW = out(AWB.wMid, AWB.nW, 1.4);
    const hE = Math.atan2(AWB.nE[0], AWB.nE[1]), hW = Math.atan2(AWB.nW[0], AWB.nW[1]);
    // Building hours are game-time (8:00–20:00), but Dr Earl's lectures run around the clock on the real-time schedule,
    // and a lecture slot is always running, so the doors never refuse entry; out of hours you get a note instead.
    const closed = () => { const h = game.time.hour; if (!(h >= 8 && h < 20)) game.ui.toast('Out of hours — but the lecture theatres stay open for Dr Earl.', 3); return false; };

    // ---------------------------------------------------------------- the institute
    let L = null;                      // lecture runtime
    let lectureD = null;
    const peds = [];
    const spawn = (scene, place, x, z, look, opts) => {
      if (!game.pedestrians) return null;
      try { const p = game.pedestrians.spawnAt(x, z, look, { place, scene, knockable: false, ...opts }); peds.push(p); return p; } catch (e) { console.error('[maths] spawn', e); return null; }
    };
    // Walk-in (core/interiors.js "seamless"; _walkin_city.js): the lobby sits in the glazed link behind the EAST entrance
    // (the outline is the two wings and the link together: the lobby is 18 m wide, the link's own face 14.7 m, so its
    // side walls stand inside the wings). The mezzanine is 4.5 m below ground, under the lobby and the wings. The west
    // (revolving) door is not a way in on this plan: behind it the model has no ground floor (the mezzanine's void).
    let plan = null;
    try {
      const outline = [AWB.north[0], AWB.north[1], AWB.C0, AWB.En, AWB.Es, ...AWB.south.slice(1, -1).reverse(), AWB.E0, AWB.north[6]];
      const E = ENTR, z = INST.lobby.z1, win = (x, w, y0, y1, bars) => ({ at: [x, z], out: 0, w, y0, y1, bars });
      plan = planWalkin(game, { id: IN, building: outline, door: { pos: doorE, facing: hE }, portal: { at: [0, z], out: 0, w: E.doorW, h: E.doorH }, wall: 0.3,
        rects: [[INST.lobby.x0, INST.lobby.z0, INST.lobby.x1, INST.lobby.z1]], center: [0, 16], mid: [5.5, 20], route: [[0, 25.5]],
        windows: [win(-E.sideX, E.sideW, E.y0, E.y1, 2), win(E.sideX, E.sideW, E.y0, E.y1, 2), win(0, E.doorW, E.doorH + 0.15, E.y1, 1)] });
    } catch (e) { console.error('[maths] plan', e); }
    // (bounds: the inside of the room, storey by storey — the camera and other people are placed by where they are; a room
    //  with a room off it needs them. 0.2 m generous at the outer walls, exact at the theatre's wall.)
    let lift = null;
    const LB = INST.lobby, MZ = INST.mez, ST = INST.stair, LF = INST.lift;
    const instDef = game.interiors.register({
      id: IN, name: 'Mathematical Institute', background: 0xdfe6ea, ambient: 0.85,
      seamless: plan && plan.fit.ok ? Object.assign(plan.seamless, { bounds: [
        { x0: LB.x0 - 0.2, x1: LB.x1 + 0.2, z0: LB.z0, z1: LB.z1 + 0.2, y0: 0, y1: 11.5 },
        { x0: MZ.x0 - 0.2, x1: MZ.x1 + 0.2, z0: MZ.z0, z1: MZ.z1, y0: INST.MEZ, y1: INST.ceil },
        { x0: ST.x0, x1: ST.x1, z0: ST.z0, z1: ST.z1, y0: INST.MEZ, y1: 0 },
        { x0: LF.x0, x1: LF.x1, z0: LF.z0, z1: LF.z1, y0: INST.ceil, y1: LF.top },
      ] }) : null,
      doors: [{ pos: doorE, facing: hE, label: 'Enter the Mathematical Institute', locked: closed }, { pos: doorW, facing: hW, label: 'Enter the Mathematical Institute', locked: closed }],
      build(ctx) {
        const SL = !!(ctx.seamless && plan);
        const r = buildInstitute(ctx, game, plan);
        if (SL) { ctx.scene.add(glazing(plan.seamless.openings, { frame: 0.07 })); cityDoor(ctx, plan, { kind: 'slide', rangeOut: 2.6, rangeIn: 2.4, setBack: 0.1 }); }
        // the lift (a real car, _maths_lift.js): inside its shaft the floor is the car's
        lift = r.lift; M.lift = lift;
        ctx.setGround(lift ? (x, z) => { const y = lift.ground(x, z); return y === null ? instituteGround(x, z) : y; } : instituteGround);
        ctx.addExit(0, 27.2, 'Leave the building');
        M.instituteInfo = { meshes: r.meshes.length, tris: Math.round(r.tris) };
        const Y = INST.MEZ;
        // café
        game.interact.add({ place: IN, pos: [15.6, Y, -0.5], radius: 1.8, label: () => (cafeOpen() ? 'Buy a coffee (£1.80)' : 'Café π is closed (open 8:30–16:00)'), onUse: buyCoffee });
        // other teaching rooms
        const roomMsg = { L2: 'L2: a Part A lecture is in full flow. Better not.', L3: 'L3 is locked between bookings.', L4: 'L4: a seminar is under way ("…and hence the diagram commutes").', L5: 'L5 is empty and locked.', L6: 'L6: a reading group, deep in a proof. You leave them to it.' };
        for (const [k, [x, z]] of Object.entries(INST.doors)) {
          if (k === 'L1') continue;
          const nx = Math.abs(x) > 19 ? -Math.sign(x) : 0, nz = Math.abs(x) > 19 ? 0 : 1;
          game.interact.add({ place: IN, pos: [x + nx * 0.9, Y, z + nz * 0.9], radius: 1.3, label: `Lecture Theatre ${k.slice(1)}`, onUse: () => game.ui.toast(roomMsg[k], 4) });
        }
        const [l1x, l1z] = INST.doors.L1, l1door = { pos: [l1x, l1z + 0.6], facing: 0, from: IN };
        // (walk-in: Lecture Theatre 1 is through its real door; what is on is on the screen over it)
        if (!SL) game.interact.add({ place: IN, pos: [l1x, Y, l1z + 0.9], radius: 1.5, label: () => `Enter Lecture Theatre 1${lectureLabel()}`, onUse: () => game.interiors.enter(LEC, l1door) });
        game.interact.add({ place: IN, pos: [-5.5, Y, -29.2], radius: 2.2, label: 'Read the noticeboard', onUse: () => game.ui.dialog('Noticeboard', ['Prelims, Michaelmas Term — M2: Analysis I, Sequences and Series. Dr Richard Earl. L1, Lectures 1–4 in rotation, one every 12 minutes. ' + scheduleText() + '.', 'Number Theory Seminar: "Rational points on curves of genus two". Topology Seminar: "Knot Floer homology for the curious".', 'The Invariants: "Penrose tilings and aperiodic order" — all welcome.']) });
        // people: receptionist, barista, students working under the crystals
        const day = Math.floor(game.time.now() / 86400000);
        spawn(ctx.scene, IN, -5.4, 14.4, randomLook('awb-reception', { outfit: 'smart' }), { heading: 0, pose: 'stand', label: null, lines: ['Morning! Lecture theatres are downstairs.', 'The café is on the mezzanine.', 'Sign in if you are visiting, please.'], role: 'staff' });
        spawn(ctx.scene, IN, 15.6, 2.5, randomLook('awb-barista', { outfit: 'barstaff' }), { heading: Math.PI, pose: 'stand', lines: ['What can I get you?', 'Flat white?', 'Busy morning — first-years.'], role: 'staff' });
        const seats = r.seats;
        [3, 9, 18, 26].forEach((si, i) => { const st = seats[si % seats.length]; spawn(ctx.scene, IN, st.x, st.z, randomLook(`awb-student-${day % 7}-${i}`, { outfit: 'casual', prop: i === 2 ? 'coffee' : 'book' }), { heading: st.h, pose: i === 3 ? 'sit' : 'write', lines: ['Is this sheet due tomorrow?', 'I think the trick is Bolzano–Weierstrass.', 'Have you seen the crystal? K₃,₃, apparently.', 'Collections next week…'] }); });
        // live timetable screens: above the L1 door, and the listing at the foot of the stair
        const screen = (x, y, z, w, h, hd, cw, ch) => {
          const c = document.createElement('canvas'); c.width = cw; c.height = ch;
          const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
          m.position.set(x, y, z); m.rotation.y = hd; ctx.scene.add(m);
          return { g: c.getContext('2d'), t, cw, ch };
        };
        screens.door = screen(l1x, Y + 3.5, l1z + 0.05, 2.2, 0.55, 0, 512, 128);
        screens.list = screen(4.2, Y + 2.0, 3.94, 2.4, 1.2, Math.PI, 512, 256);
        drawScreens();
        return { spawn: [0, 25.6], heading: Math.PI };
      },
      onEnter() { M.place = IN; drawScreens(); if (plan && game.interiors.get(IN).sl && game.interiors.get(IN)._via == null) { try { closed(); } catch { /* */ } } },
      update(dt) { if (lift) lift.update(dt); if ((screenT -= dt) <= 0) { screenT = 1; drawScreens(); } },
      updateShown(dt) { if (lift) lift.update(dt); },
    });

    if (plan) warmLater(game, IN);
    const cafeOpen = () => { const h = game.time.hour; return h >= 8.5 && h < 16; };
    function buyCoffee() {
      if (!cafeOpen()) { game.ui.toast('Café π is closed. Try the vending machine in your college.', 3); return; }
      if (!game.pay(-1.8)) { game.ui.toast("You can't afford a coffee (£1.80).", 3); return; }
      const p = game.player; const before = p.drunk || 0; p.drunk = Math.max(0, before - 0.15);
      game.ui.toast(before > 0.02 ? 'A strong coffee. Things come back into focus.' : 'A good coffee. You feel ready for analysis.', 3.5);
    }
    const screens = {};
    let screenT = 0;
    /** schedule from the shared real-time clock (or the forced test lecture) */
    function sched() {
      const st = L ? L.state() : (() => { const a = lectureNow(game.time.now()); return { n: a.n, t: a.t }; })();
      const a = lectureNow(game.time.now());
      const live = st.t < FRAME_B;
      const msNext = L && L.R.forced ? Math.max(0, (1.2 - st.t) * LECTURE_SEC * 1000) : a.msLeft;
      const msLeft = Math.max(0, (FRAME_B - st.t) * LECTURE_SEC * 1000);
      return { n: st.n, live, msNext, msLeft, nextN: (st.n + 1) % LECTURES.length };
    }
    function scheduleText() {
      const s = sched();
      return s.live ? `Now: Lecture ${s.n + 1} (about ${mmss(s.msLeft)} left)` : `Next lecture (Lecture ${s.nextN + 1}) starts in ${mmss(s.msNext)}`;
    }
    function drawScreens() {
      const s = sched();
      if (screens.door) {
        const { g, t, cw, ch } = screens.door;
        g.fillStyle = '#0b1622'; g.fillRect(0, 0, cw, ch); g.fillStyle = s.live ? '#ffcf5a' : '#8fe3a0';
        g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(s.live ? `IN PROGRESS — Lecture ${s.n + 1} · ${mmss(s.msLeft)} left` : `Next lecture starts in ${mmss(s.msNext)}`, cw / 2, ch / 2);
        t.needsUpdate = true;
      }
      if (screens.list) {
        const { g, t, cw, ch } = screens.list;
        g.fillStyle = '#0b1622'; g.fillRect(0, 0, cw, ch);
        g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.font = 'bold 26px Arial, sans-serif'; g.fillText('Lecture Theatre 1', 20, 42);
        g.font = '22px Arial, sans-serif'; g.fillStyle = '#c8d3e2'; g.fillText('M2: Analysis I — Dr Richard Earl', 20, 80);
        const title = LECTURES[s.live ? s.n : s.nextN].title.replace('Analysis I — ', '');
        g.fillStyle = '#ffffff'; g.font = '20px Arial, sans-serif'; g.fillText(title.length > 44 ? title.slice(0, 44) + '…' : title, 20, 130);
        g.font = 'bold 28px Arial, sans-serif'; g.fillStyle = s.live ? '#ffcf5a' : '#8fe3a0';
        g.fillText(s.live ? `In progress · about ${mmss(s.msLeft)} left` : `Starts in ${mmss(s.msNext)}`, 20, 190);
        t.needsUpdate = true;
      }
    }
    function lectureLabel() {
      const s = sched();
      return s.live ? ` — Dr Earl, Analysis I, Lecture ${s.n + 1} (in progress, ${mmss(s.msLeft)} left)` : ` — next lecture starts in ${mmss(s.msNext)}`;
    }

    // ---------------------------------------------------------------- Lecture Theatre 1
    // A walk-in room OFF the institute (core/interiors.js: `off`): its doorway is in the middle of its back wall (room
    // z = LT.back, at the mezzanine's level), LT.door.depth behind the mezzanine's north wall at the L1 door.
    const lecSL = !!(instDef && instDef.sl);
    lectureD = game.interiors.register({
      id: LEC, name: 'Lecture Theatre 1', background: 0x101114, ambient: 0.42,
      doors: lecSL ? [{ pos: [INST.doors.L1[0], INST.doors.L1[1] + 0.6], facing: 0, from: IN, label: 'Enter Lecture Theatre 1' }] : [],      // (walk-in: no prompt — kept for the tools)
      seamless: lecSL ? {
        portals: [{ at: [0, LT.back], out: 0, w: LT.door.w, h: LT.door.h, y: 0, depth: LT.door.depth, off: IN, offAt: [INST.doors.L1[0], INST.mez.z0 - LT.door.depth], offOut: 0, offY: INST.MEZ }],
        // (it is seen only from the institute: its distances are measured from the middle of the LOBBY — built as you come
        //  up to the entrance, never because you walked over it in the street)
        openings: [], center: [INST.doors.L1[0] * -1, LT.back + LT.door.depth + 16 - INST.mez.z0], showR: 24, bounds: [{ x0: -LT.W - 0.2, x1: LT.W + 0.2, z0: -0.2, z1: LT.back, y0: LT.frontY, y1: 3.4 }],
      } : null,
      build(ctx) {
        const r = buildTheatre(ctx, game, !!ctx.seamless);
        M.theatreDoor = r.door;
        ctx.setGround(theatreGround);
        ctx.addExit(0, LT.back - 0.7, 'Leave Lecture Theatre 1');
        L = createLecture(game, ctx, earlLook);
        M.lecture = L;
        M.theatreInfo = { meshes: r.meshes.length, tris: Math.round(r.tris) };
        // sit: one point per row at each aisle; you take the nearest free seat in that row
        for (let row = 0; row < LT.rows; row++) for (const a of [-8.98, -3.35, 3.35, 8.98]) {
          const z = LT.rowZ0 + LT.rowD * row + 0.55, y = rowFloor(row);
          game.interact.add({ place: LEC, pos: [a, y, z], radius: 0.7, label: 'Sit down', onUse: () => { const i = L.freeSeatNear(row, a); if (i >= 0) L.sit(i); else game.ui.toast('This row is full.', 2); } });
        }
        game.interact.add({
          place: LEC, pos: [0, LT.frontY, 4.0], radius: 2.2,
          label: () => { const st = L.lastLecture(); return st ? `Take a problem sheet (Lecture ${st.n + 1})` : 'Problem sheets (after the lecture)'; },
          enabled: () => !!L.lastLecture() && !L.R.sheetDone.has(L.lastLecture().inst),
          onUse: () => { const st = L.lastLecture(); if (st) L.sheet(st.n, st.inst); },
        });
        return { spawn: [0, LT.back - 1.4], heading: Math.PI };
      },
      onEnter() { M.place = LEC; },
      onExit() { L && L.onExit(); if (game.activity && /^maths-/.test(game.activity.name)) game.endActivity(); },
      update(dt) { if (L) L.update(dt); },
    });

    // ---------------------------------------------------------------- students with rucksacks outside the entrance (day)
    const outside = [];
    let outT = 0;
    function outsidePeople() {
      const p = game.player, h = game.time.hour;
      const near = p.place === 'world' && Math.hypot(p.pos.x - AWB.eMid[0], p.pos.z - AWB.eMid[1]) < 140;
      const want = near && h >= 8 && h < 19;
      if (want && !outside.length && game.pedestrians) {
        const spots = [[-170.5, -604.5, 1.9, 'phone'], [-172.0, -602.0, -1.2, 'talk'], [-170.6, -601.4, -2.6, 'stand'], [-176.5, -597.5, 0.6, null], [-164.5, -606.5, -0.3, null]];
        spots.forEach(([x, z, hd, pose], i) => {
          const look = { ...randomLook('awb-out-' + i, { outfit: 'casual' }), backpack: [0x1d1d1d, 0x2a3f6a, 0x6a2a2a, 0x3a5a3a, 0x555555][i] };
          try {
            const ped = game.pedestrians.spawnAt(x, z, look, pose ? { heading: hd, pose, knockable: true, lines: ['Is it L1 or L2 at ten?', 'Have you done sheet one?', "Don't step on the thin rhombs.", 'Coffee after?'] } : { heading: hd, wander: { radius: 6, speed: 1.1 }, lines: ['Morning!', 'Running late…'] });
            outside.push(ped);
          } catch (e) { /* optional */ }
        });
      } else if (!want && outside.length) { for (const o of outside) game.pedestrians && game.pedestrians.remove(o); outside.length = 0; }
    }

    // ---------------------------------------------------------------- test hooks
    M.startLecture = (n, t = 0, hold = false) => {
      if (L) return L.startLecture(n, t, hold);
      M._pending = [n, t, hold]; return 'theatre not built yet: enter it (game.maths.enterTheatre()) and the lecture will jump';
    };
    M.enterTheatre = async () => { if (game.player.place !== IN && game.player.place !== LEC) await game.interiors.enter(IN); if (game.player.place !== LEC) await game.interiors.enter(LEC, { pos: [INST.doors.L1[0], INST.doors.L1[1] + 0.6], facing: 0, from: IN }); if (M._pending && L) { L.startLecture(...M._pending); M._pending = null; } return 'ok'; };
    M.boardsDump = () => LECTURES.map((lec, n) => ({ n, title: lec.title, frames: lec.frames.map((f) => ({ text: plainText(f.lines), say: f.say, fits: layoutFrame(f.lines).ok })) }));
    M.state = () => (L ? { ...L.state(), k: L.R.k, notes: L.R.notes, seated: L.R.seated } : null);
    M.sitAt = (row = 6, block = 1, i = 4) => { if (!L) return 'enter the theatre first'; const idx = L.seats.findIndex((q) => q.row === row && q.block === block && q.i === i); return L.sit(idx); };
    M.sheet = (n = 0) => L && L.sheet(n, 'test');
    M.notes = (v) => { if (L) L.R.notes = v; return L && L.R.notes; };
    M.view = (x, y, z, tx, ty, tz, fov = 60) => game.beginActivity({ name: 'maths-view', pointer: 'free', camera(dt, cam) { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); }, onEnd() { game.camera.fov = 60; game.camera.updateProjectionMatrix(); } });
    M.stats = () => { const i = game.renderer.info.render; let lights = 0; game.scene.traverse((o) => { if (o.isLight) lights++; }); return { calls: i.calls, tris: i.triangles, lights, place: game.player.place, exterior: M.exterior, institute: M.instituteInfo, theatre: M.theatreInfo, lecture: L && L.stats() }; };
    M.doors = { east: doorE, west: doorW, hE, hW }; M.plan = () => plan;
    M.schedule = () => ({ ...sched(), text: scheduleText(), slotMs: SLOT_MS });

    return {
      update(dt) {
        if ((outT -= dt) <= 0) { outT = 2; outsidePeople(); }
        void dt;
      },
    };
  },
};
