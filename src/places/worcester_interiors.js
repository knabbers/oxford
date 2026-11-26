// Worcester College interiors: Chapel, Hall, Porters' Lodge, Memorial Room, a Terrace staircase + "your room",
// the Library, the Earl Building, the pigeonhole room in Pump Quad (where the game starts: game.startSpot).
// Research: docs/research/worcester_interiors.md. Builders: _worcint_*.js.
// Doors are at the real doorways of the hand-built exterior (worcester.js local frame: rotated 0.0761 rad about
// (-250, 10)); the Library and Memorial Room doors, which worcester.js does not model, get a small door mesh here.
// Test hooks: game.worcint = { enter(id), view(x,y,z,tx,ty,tz,fov), stats(), force:{service,meal,formal}, grace(),
//   pidge() (your pigeonhole today), start (how the game started), sit(i), rooms, state }.
import * as THREE from 'three';
import { randomLook } from '../core/characters.js';
import { buildChapel, CHAPEL, ANIMALS } from './_worcint_chapel.js';
import { buildHall, HALL } from './_worcint_hall.js';
import { buildLodge } from './_worcint_lodge.js';
import { buildPidge, PR } from './_worcint_pidge.js';
import { WORC } from './_worcester_shared.js';
import { buildMemorial } from './_worcint_memorial.js';
import { buildStair } from './_worcint_stair.js';
import { LODGE, MEMORIAL, STAIR } from './_worcint_lodge_plan.js';
import { buildLibrary, LIB } from './_worcint_library.js';
import { buildEarl, earlExterior, EARL, EARL_FRAME } from './_worcint_earl.js';
import { IntAudio } from './_worcint_audio.js';
import { dayOf, evensong, chapelCandles, meal, formal, MEAL_PRICE, menuItem, GRACE, essayStep, clampEnergy, pidgeToday, pidgeSlot, PIDGE_SLOTS, PIDGE_WELCOME, pidgeList } from './_worcint_logic.js';
import { Batch, frame, rectPts, archPts, sharedMats } from './_worcint_kit.js';
import { dressOpenings } from './_walkin_city.js';
// the Lodge porter's [E] Talk pages (spoken in the porter's voice: tools/voices/extract.mjs reads this table)
const PORTER_TALK = {
  hello: ['Morning. What can I do for you?', 'Afternoon. What can I do for you?', 'Evening. What can I do for you?'],
  pages: ['Your post’s in the pidge room — Pump Quad, by Staircase 15. Parcels behind the counter here — sign for them, mind.', 'And if you’ve lost your key again, that’s a fiver.'],
};

const PHI = 0.0761, COS = Math.cos(PHI), SIN = Math.sin(PHI), C0 = [-250, 10], T = WORC.terraceY;
const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];
const headingL = (du, dv) => Math.atan2(du * COS + dv * SIN, -du * SIN + dv * COS);

// door positions in the college's local frame (u east, v south). See worcester.js.
const DOORS = {
  chapel: { uv: CHAPEL.doorUV, out: [-1, 0] },      // loggia back wall, by the WWI memorial: on the landing before the door (_worcint_hall_plan.js)
  hall: { uv: HALL.doorUV, out: [-1, 0] },          // loggia back wall, beside the WWII memorial
  lodge: { uv: [LODGE.doorUV[0], LODGE.doorUV[1] + 0.55], out: [0, 1] },   // gate hall, north side: in front of the Lodge's doorway (_worcint_lodge_plan.js LODGE)
  stair5: { uv: [STAIR.uDoor, STAIR.ext.vS + 0.55], out: [0, 1] },   // Terrace, Staircase 5 (bay 7 of the true Terrace: _worcint_lodge_plan.js STAIR)
  library: { uv: [LIB.doorUV[0], LIB.doorUV[1] - 0.55], out: [0, -1] },   // gateway passage, south side, opposite the Lodge's door (the owner; _worcint_library_plan.js DOOR) — drawn by worcester.js
  memorial: { uv: [MEMORIAL.ext.u + 0.6, MEMORIAL.ext.v], out: [1, 0] },   // Provost's Yard, the tall block of the west range (worcester_yard.js; plan: _worcint_lodge_plan.js MEMORIAL) — door-case drawn here
  // pigeonhole room: Pump Quad front of Staircase 15 (door drawn in worcester.js), 0.3 m out from the wall
  pidge: { uv: [WORC.pidgeDoor.uv[0] - WORC.pidgeDoor.along[1] * 0.3, WORC.pidgeDoor.uv[1] + WORC.pidgeDoor.along[0] * 0.3], out: [-WORC.pidgeDoor.along[1], WORC.pidgeDoor.along[0]] },
};

export default {
  id: 'worcester_interiors',
  preMap(game) { try { earlExterior.preMap(game); } catch (e) { console.warn('[worcint] earl preMap', e); } },
  install(game) {
    const ui = game.ui, peds = game.pedestrians, audio = new IntAudio(game);
    if (game.state.energy === undefined) game.state.energy = 70;
    const S = sharedMats(game);
    const W = (game.worcint = { rooms: {}, force: { service: null, meal: null, formal: null }, state: { essay: 0, essayK: 0, pidgeN: 0 } });
    const day = () => dayOf(game.time), hour = () => game.time.hour;
    const isService = () => (W.force.service !== null ? W.force.service : evensong(day(), hour()));
    const mealNow = () => (W.force.meal !== null ? W.force.meal : meal(day(), hour()));
    const isFormal = () => (W.force.formal !== null ? W.force.formal : formal(day(), hour()));

    // ---------------------------------------------------------------- doors drawn on the exterior (Library, Memorial Room)
    try { buildExtraDoors(game); } catch (e) { console.warn('[worcint] doors', e); }
    let earlExt = null;
    try { earlExt = earlExterior.install(game); } catch (e) { console.warn('[worcint] earl exterior', e); }

    // ---------------------------------------------------------------- NPC helpers (spawned on entry, removed on exit)
    const look = (seed, o = {}) => { const { outfit, prop, ...rest } = o; return { ...randomLook(seed, { outfit, prop }), ...rest }; };
    function spawnIn(room, x, z, lk, opts) {
      if (!peds) return null;
      try { const p = peds.spawnAt(x, z, lk, { place: room.id, scene: room.def.scene, knockable: false, static: true, ...opts }); room.npcs.push(p); return p; } catch (e) { console.warn('[worcint] spawn', e); return null; }
    }
    function populateTick(r, dt) { r.t = (r.t || 0) - dt; if (r.t <= 0) { r.t = 2; if (r.populate) { const s = r.signature ? r.signature() : ''; if (s !== r.sig) { clear(r); r.sig = s; r.populate(r); } } } }
    function clear(room) { for (const p of room.npcs) { try { peds && peds.remove(p); } catch (e) { /* */ } } room.npcs.length = 0; room.sig = ''; }

    // ---------------------------------------------------------------- activities: sit / sleep / work
    const P = game.player;
    let seated = null;
    function sitAt(seat, opts = {}) {
      const back = { x: P.pos.x, z: P.pos.z, h: P.heading };
      P.teleport(seat.x, seat.z, seat.h); P.pose = opts.pose || 'sit';
      seated = seat; let t = 0;
      game.beginActivity({
        name: opts.name || 'sit', hint: opts.hint || 'Sitting.',
        update(dt) { t += dt; if (opts.update) opts.update(dt, t); },
        onEnd() { P.pose = 'stand'; seated = null; P.teleport(opts.backTo ? opts.backTo[0] : back.x, opts.backTo ? opts.backTo[1] : back.z, back.h); if (opts.onEnd) opts.onEnd(t); },
      });
    }
    W.view = (x, y, z, tx, ty, tz, fov = 60) => game.beginActivity({ name: 'view', pointer: 'free', camera(dt, cam) { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); }, onEnd() { game.camera.fov = 60; game.camera.updateProjectionMatrix(); } });
    W.stats = () => { const i = game.renderer.info.render; let lights = 0; game.scene.traverse((o) => { if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight) lights++; }); return { calls: i.calls, tris: i.triangles, lights, npcs: (W.rooms[game.player.place] || { npcs: [] }).npcs.length }; };
    W.enter = async (id) => { await game.interiors.enter('worcint_' + id); return 'ok'; };

    // ---------------------------------------------------------------- room registry
    const rooms = W.rooms, roomList = [];
    function room(key, name, door, build, extra = {}) {
      const id = 'worcint_' + key, d = DOORS[door] || null;
      const r = { id, key, name, R: null, npcs: [], sig: '', def: null, ...extra };
      const doors = [];
      if (d) { const [x, z] = L2W(d.uv[0], d.uv[1]); doors.push({ pos: [x, z], facing: headingL(d.out[0], d.out[1]), label: extra.label || `Enter the ${name}`, radius: 1.5 }); }
      if (extra.doorsWorld) doors.push(...extra.doorsWorld);
      r.def = game.interiors.register({
        id, name, doors, background: extra.background ?? 0x0b0a08, ambient: 0.4,
        seamless: extra.seamless || null,      // a walk-in room (core/interiors.js): real doorway, real windows
        // (shown but you are outside it: its lights by the hour, and whoever is in it — seen through its windows and doorway)
        updateShown: (dt) => { if (!r.R) return; populateTick(r, dt); if (extra.shown) extra.shown(r, dt); },
        build: (ctx) => {
          const R = (r.R = build(ctx, game));
          ctx.addExit(R.exit[0], R.exit[1], 'Leave');
          if (r.setup) r.setup(r, ctx);
          return { spawn: R.spawn, heading: R.heading };
        },
        onEnter: () => { r.sig = null; r.t = 0; if (r.enter) r.enter(r); },
        // (a walk-in room keeps its people when you step out: they are still seen through the door; they go when the room is hidden)
        onExit: () => { if (!r.def.sl) clear(r); if (r.exit) r.exit(r); },
        update: (dt) => { populateTick(r, dt); if (r.tick) r.tick(r, dt); },
      });
      rooms[id] = r; rooms[key] = r; roomList.push(r);
      return r;
    }

    // Lights by occupancy (second pass): a room nobody is in is dark after dark — from the forecourt, the street and the
    // quad as well as from inside. `inside(r)`: you are in it (then its lights are on whatever the hour).
    const inside = (r) => P.place === r.id;
    const chapelLit = (r, d) => { const c = chapelCandles(day(), hour(), d); return isService() || c >= 1 ? 1 : inside(r) ? c : 0; };
    const hallLit = (r) => { const h = hour(); return (h >= 17 || h < 7) && (mealNow() || (h >= 17 && h < 21.5) || inside(r)) ? 1 : 0; };
    const libOpen = (r) => (hour() >= 8 && hour() < 23) || inside(r);
    const memOn = (r) => (hour() >= 9 && hour() < 18 && day() % 2 === 0) || inside(r);

    // ================================================================ CHAPEL
    // A walk-in room in the north wing (plan: _worcint_hall_plan.js): the oak pair in the loggia's back wall; the three
    // windows of each side wall and the east window's three lights are real openings glazed with the painted glass.
    room('chapel', 'Chapel', 'chapel', buildChapel, {
      seamless: CHAPEL.seamless,
      shown(r) { const d = game.time.daylight ?? 1; r.R.setLight(d, chapelLit(r, d)); },
      signature: () => `${isService()}|${hour() >= 9 && hour() < 17}`,
      setup(r) {
        const R = r.R;
        R.seats.forEach((s) => game.interact.add({ place: r.id, pos: [s.ax, s.az], radius: 0.9, label: 'Sit in the stalls', enabled: () => !seated, onUse: () => sitAt(s, { name: 'pew', hint: isService() ? 'Evensong. The choir sings; you sit quietly.' : 'You sit in the quiet of the Chapel.', backTo: [s.ax, s.az] }) }));
        R.animals.forEach((a) => game.interact.add({ place: r.id, pos: [a.x, a.z], radius: 0.7, label: `Look at the carved ${a.name}`, onUse: () => ui.toast(`A carved ${a.name} tops the stall end${['dodo', 'pangolin', 'unicorn', 'elephant', 'kangaroo', 'whale'].includes(a.name) ? '' : ' (one of Burges’s many beasts)'}.`, 4) }));
        game.interact.add({ place: r.id, pos: R.spots.console, radius: 1.4, label: 'Read the organ console shutters', onUse: () => ui.toast('The shutters list every organ scholar of the College since 1866.', 4) });
      },
      populate(r) {
        const R = r.R;
        if (isService()) {
          // choir in the front rows, organ scholar at the console, chaplain at the east end
          const { choir, organist, chaplain } = R.spots;
          choir.forEach(([x, z, h], i) => spawnIn(r, x, z, look(9100 + i, { outfit: 'gown', gown: 'scholar', top: 0xf4f4f0 }), { heading: h, pose: 'stand' }));
          spawnIn(r, organist[0], organist[1], look(9110, { outfit: 'subfusc' }), { heading: organist[2], pose: 'sit', label: 'Organ scholar' });
          spawnIn(r, chaplain[0], chaplain[1], look(9111, { outfit: 'gown', gown: 'scholar', hairStyle: 'short', hair: 0x8a8a88, glasses: true }), { heading: chaplain[2], pose: 'stand', label: 'Chaplain', lines: ['O Lord, open thou our lips.', 'Let us pray.'] });
          // a congregation in the stalls (seen through the doorway and, as shapes, through the glass)
          [1, 4, 6, 9, 12, 15].forEach((k, i) => { const st = R.seats[(k + day()) % R.seats.length]; if (st) spawnIn(r, st.x, st.z, look(9130 + i, { outfit: i % 3 === 0 ? 'gown' : 'casual' }), { heading: st.h, pose: 'sit' }); });
        } else if (hour() >= 9 && hour() < 17) {
          spawnIn(r, R.seats[3].x, R.seats[3].z, look(9120 + (day() % 5), { outfit: 'tourist', camera: true }), { heading: R.seats[3].h, pose: 'sit', lines: ['Is that a dodo?', 'Burges did all of this?'] });
        }
      },
      tick(r, dt) {
        const d = game.time.daylight ?? 1, svc = isService();
        r.R.setLight(d, chapelLit(r, d));
        audio.update(dt, true, svc);
        if (P.speed > 4.5 && !game.activity) { r.shh = (r.shh || 0) - dt; if (r.shh <= 0) { r.shh = 6; ui.toast('Your footsteps echo round the Chapel. Walk, please.', 2.5); } }
      },
      exit() { audio.update(0.5, false, false); },
    });

    // ================================================================ HALL
    const hallState = { tray: null, graceDay: -1, graceT: -1 };
    // A walk-in room in the south wing (plan: _worcint_hall_plan.js): the oak pair beside the WWII memorial, the north
    // sashes and the east Venetian window real openings onto the forecourt and Walton Street.
    room('hall', 'Hall', 'hall', buildHall, {
      seamless: HALL.seamless,
      shown(r) { r.R.setLight(game.time.daylight ?? 1, hallLit(r), isFormal()); },
      signature: () => `${mealNow()}|${isFormal()}|${day()}|${hour() >= 8 && hour() < 21}`,
      setup(r) {
        const R = r.R;
        game.interact.add({ place: r.id, pos: R.servery, radius: 1.6,
          label: () => { const m = mealNow(); return m === 'formal' ? 'Formal hall — sit down, grace is coming' : m ? `Queue for food (£${MEAL_PRICE[m].toFixed(2)})` : 'The servery is closed (lunch 12–2, dinner 6–8)'; },
          enabled: () => !hallState.tray,
          onUse: () => {
            const m = mealNow();
            if (!m || m === 'formal') { ui.toast(m ? 'Formal hall is served at the tables.' : 'Closed. Lunch is 12–2, dinner 6–8.', 3); return; }
            if (!game.pay(-MEAL_PRICE[m])) { ui.toast('Not enough money for a meal.', 3); return; }
            hallState.tray = menuItem(m, day(), (hallState.n = (hallState.n || 0) + 1));
            ui.toast(`Tray: ${hallState.tray}. Find a seat on one of the benches.`, 4);
          } });
        // bench seats you can sit at (every third seat)
        R.seats.forEach((s, i) => { if (i % 3) return; game.interact.add({ place: r.id, pos: [s.x, s.z + (s.h ? 0.45 : -0.45) * 0], radius: 0.75, label: () => (hallState.tray || isFormal() ? 'Sit and eat' : 'Sit on the bench'), enabled: () => !seated, onUse: () => eatAt(s) }); });
      },
      populate(r) {
        const R = r.R, m = mealNow(), f = isFormal(), dd = day();
        if (!m) { if (hour() >= 8 && hour() < 21) spawnIn(r, R.staff[0], R.staff[1], look(9200 + dd % 3, { outfit: 'barstaff' }), { heading: R.staff[2], pose: 'stand', lines: ['Hall opens at twelve.', 'Mind, the floor’s just been mopped.'] }); return; }
        const outfit = f ? 'subfusc' : 'casual';
        // (the benches at a meal: a dozen at dinner and formal hall, eight at lunch — the same people for every player;
        //  13 is coprime with the number of seats, so no two share one)
        const picks = Array.from({ length: m === 'lunch' ? 8 : 12 }, (_, i) => 3 + i * 13);
        picks.forEach((k, i) => { const s = R.seats[(k + dd * 7) % R.seats.length]; spawnIn(r, s.x, s.z, look(9300 + dd * 10 + i, f ? { outfit, gown: 'commoner' } : { outfit: i % 2 ? 'casual' : 'gown' }), { heading: s.h, pose: 'sit', lines: f ? ['Is it the long grace tonight?', 'Pass the wine?'] : ['Is there pudding?', 'Have you done the reading?', 'Collections next week…'] }); });
        if (f || m === 'dinner' || m === 'lunch') for (const k of [2, 5]) { const s = R.highSeats[k]; if (s) spawnIn(r, s.x, s.z, look(9400 + k, { outfit: 'tweed', gown: 'scholar', glasses: k === 2 }), { heading: s.h, pose: 'sit', label: k === 2 ? 'Fellow' : null }); }
      },
      tick(r, dt) {
        const d = game.time.daylight ?? 1, f = isFormal(), h = hour();
        r.R.setLight(d, hallLit(r), f);
        // grace at the start of formal hall (once per formal evening, or forced with game.worcint.grace())
        if (f && hallState.graceDay !== day() && h < 19.3) { hallState.graceDay = day(); W.grace(); }
        if (hallState.graceT >= 0) {
          hallState.graceT += dt; const i = Math.floor(hallState.graceT / 3.2);
          if (i !== hallState.graceI) { hallState.graceI = i; if (i < GRACE.length) ui.toast(`Scholar: “${GRACE[i]}”`, 3.3); else { hallState.graceT = -1; ui.toast('Everyone sits. The clatter of plates begins.', 3); } }
        }
      },
    });
    W.grace = () => { audio.gong(); hallState.graceT = 0; hallState.graceI = -1; ui.toast('The gong sounds. Everyone stands for grace.', 2.5); return GRACE.length; };
    function eatAt(s) {
      const f = isFormal(), food = hallState.tray || (f ? 'the three-course formal dinner' : null);
      sitAt(s, { name: 'eat', hint: food ? `You eat ${food}.` : 'You sit on the bench.', update(dt, t) { if (food && t > 6 && !s._ate) { s._ate = true; game.state.energy = clampEnergy((game.state.energy ?? 70) + 40); game.save(); ui.toast(`Finished. Energy ${Math.round(game.state.energy)}/100.`, 3); hallState.tray = null; } }, onEnd() { s._ate = false; } });
    }
    W.eat = () => { const r = rooms.hall; if (r.R) eatAt(r.R.seats[0]); };

    // ================================================================ PORTERS' LODGE
    room('lodge', 'Porters’ Lodge', 'lodge', buildLodge, {
      label: 'Enter the Porters’ Lodge',
      seamless: LODGE.seamless,      // a walk-in room: its doorway in the gate hall (the leaves folded back) and its one window, to the forecourt, are real openings
      shown(r) { r.R.setLight(game.time.daylight ?? 1); },
      setup(r) {
        const R = r.R;
        game.interact.add({ place: r.id, pos: R.keys, radius: 1.3, label: 'Look at the key board', onUse: () => ui.toast('Spare room keys on numbered hooks, and the porters’ sorting rack. Student post goes in the pidge room in Pump Quad.', 4) });
        game.interact.add({ place: r.id, pos: R.counter, radius: 1.5, label: 'Talk to the porter', onUse: () => { ui.dialog('Porter', [PORTER_TALK.hello[hour() < 12 ? 0 : hour() < 18 ? 1 : 2], ...PORTER_TALK.pages]); if (game.voice && game.voice.followDialog) game.voice.followDialog('porter'); } });
      },
      // (the porter behind the counter is a second porter — seed 8102, grey hair: the one worcester.js stands in the passage
      //  by the door, seed 8101, is seen through the open doorway at the same time)
      populate(r) { const R = r.R; spawnIn(r, R.porter[0], R.porter[1], look(8102, { outfit: 'porter', hairStyle: 'short', hair: 0x8a8a86 }), { heading: R.porter[2], pose: 'stand', label: 'Porter', lines: ['Pidges are in Pump Quad.', 'Sign the book, please.'] }); },
      tick(r) { r.R.setLight && r.R.setLight(game.time.daylight ?? 1); },
    });

    // ================================================================ PIGEONHOLE ROOM (Pump Quad, Staircase 15) — the start position
    const flags = () => game.state.flags || (game.state.flags = {});
    const pidgeChecked = () => flags().pidgeDay === day();
    let pidgeObjective = false;
    const clearObjective = () => { if (pidgeObjective) { pidgeObjective = false; ui.objective(null); } };
    // A walk-in room: in place behind the Staircase 15 front; its door and window are real openings onto Pump Quad.
    const pidgeSeamless = (() => {
      const out = [-WORC.pidgeDoor.along[1], WORC.pidgeDoor.along[0]], uv = WORC.pidgeDoor.uv, facing = headingL(out[0], out[1]);
      const [wx, wz] = L2W(uv[0] - out[0] * PR.WALL, uv[1] - out[1] * PR.WALL);      // the doorway's centre on the room's wall face
      return {
        // (depth = out to the range's own wall face: the doorway is punched 1 cm in front of the door painted there, the
        //  window 3 cm in front of the range's painted sash, whose glass it is — worcester.js, world/walkin_bays.js)
        portals: [{ at: [PR.door.x, 0], out: 0, w: PR.door.w, h: PR.door.h, y: 0, depth: PR.WALL, ...(PR.punch ? { proud: -PR.punch.door } : {}), world: [wx, wz, facing] }],      // (proud < 0: punched inside the hand-built front's own stone reveal — _worcint_pidge.js PR.punch)
        openings: [{ at: [PR.win.x, 0], out: 0, w: PR.win.w, y0: PR.win.y0, y1: PR.win.y1, depth: PR.WALL, ...(PR.punch ? { proud: -PR.punch.win } : {}), id: 'pidgeWin' }, ...(PR.win2 ? [{ at: [PR.win2.x, 0], out: 0, w: PR.win2.w, y0: PR.win2.y0, y1: PR.win2.y1, depth: PR.WALL, proud: -PR.punch.win, id: 'pidgeWin2' }] : [])],
        center: [0, -2.6], lift: 0.1,
        bounds: [{ x0: PR.X0, x1: PR.X1, z0: PR.Z0, z1: PR.Z1, y0: 0, y1: PR.H }],
      };
    })();
    room('pidge', 'Worcester College — Pigeonholes', 'pidge', buildPidge, {
      label: 'Enter the pigeonhole room',
      seamless: pidgeSeamless,
      shown(r) { r.R.setLight(game.time.daylight ?? 1); },
      setup(r) {
        const R = r.R;
        game.interact.add({ place: r.id, pos: R.own, radius: 0.95, label: () => (pidgeChecked() ? 'Check your pigeonhole again' : 'Check your pigeonhole'), enabled: () => !seated, onUse: () => W.pidge() });
        game.interact.add({ place: r.id, pos: R.notice, radius: 1.1, label: 'Read the noticeboard', onUse: () => ui.dialog('Noticeboard', ['Term card, Michaelmas 2013: Full Term from Sunday 13 October to Saturday 7 December. Formal Hall Monday, Wednesday, Saturday.', 'Novice rowing sign-up (seven names so far). JCR General Meeting, Sunday 8pm. A bop in 3rd week: theme, Space.', 'Lost property at the Lodge: one gown, three umbrellas, a bike lock key, one brown brogue.', 'And a laundry plea: “Whoever took a grey hoodie from dryer 2: it was mine and I miss it.”']) });
        game.interact.add({ place: r.id, pos: R.parcels, radius: 1.0, label: 'Look at the parcel shelf', onUse: () => ui.toast('Parcels waiting to be signed for at the Lodge. None of them has your name on. One of them is ticking gently (an alarm clock, says the label).', 4.5) });
        game.interact.add({ place: r.id, pos: R.bin, radius: 0.9, label: 'Look in the recycling bin', onUse: () => ui.toast('Flyers. So many flyers. Bops, comedy nights, choir auditions, a society for people who like other societies.', 4) });
        game.interact.add({ place: r.id, pos: R.window, radius: 1.0, label: 'Look out of the window', onUse: () => ui.toast('Pump Quad: picnic tables, the Hall’s south wall, the steps down to the Cellar Bar.', 3.5) });
      },
      signature: () => `${hour() >= 8.5 && hour() < 19}|${day() % 3}`,
      populate(r) {
        if (!(hour() >= 8.5 && hour() < 19)) return;
        // someone else checking their post at the west rack (look from the day)
        spawnIn(r, -2.25, -2.4 - (day() % 3) * 0.5, look(9800 + (day() % 7), { outfit: day() % 2 ? 'casual' : 'gown', prop: day() % 3 === 1 ? 'book' : null }), { heading: -Math.PI / 2, pose: 'stand', lines: ['Battels. Again.', 'Has anyone seen my parcel slip?', 'Bop flyer number six…'] });
      },
      tick(r) {
        const R = r.R;
        R.setLight(game.time.daylight ?? 1);
        R.setName((P.name || 'You').slice(0, 14));
        R.setOwnPost(!pidgeChecked() && pidgeToday(day()).kind !== 'none');
      },
      exit() { clearObjective(); },
    });
    W.pidge = () => {
      const d = day(), item = pidgeToday(d), F = flags(), first = F.pidgeDay !== d;
      clearObjective();
      if (first) {
        F.pidgeDay = d;
        if (item.money && F.pidgeMoneyDay !== d) { F.pidgeMoneyDay = d; game.pay(item.money); }
        try { game.save(); } catch (e) { /* storage blocked */ }
        // under the day's post: the first time ever, the way out and into town in words (there is no map); after that
        // one line a day of the list pinned inside the pigeonholes (things to go and find)
        const li = pidgeList(d), welcome = !F.pidgeWelcome;
        if (welcome) { F.pidgeWelcome = true; try { game.save(); } catch (e) { /* storage blocked */ } }
        const pages = Promise.resolve(ui.dialog(item.from, [item.text]));
        pages.then(() => (welcome ? ui.dialog(PIDGE_WELCOME.from, [PIDGE_WELCOME.text]) : null))
          .then(() => ui.dialog('Pinned inside: “Before you go down”', [`No. ${li.n}: ${li.text}`])).catch(() => {});
      } else ui.toast(item.kind === 'none' ? 'Still nothing.' : 'Nothing new since you last looked.', 3);
      return { ...item, first };
    };
    // the start position: the game boots inside the pidge room (main.js calls enter(); ?spawn=street skips it).
    // Before the network welcome everyone stands on slot 0; once our player id is known we move to our own slot
    // (pidgeSlot: by id, skipping slots other players already stand on) — unless we have already moved.
    const pidgeId = rooms.pidge.id;
    W.start = null;
    game.startSpot = {
      id: pidgeId,
      enter() {
        const d = game.interiors.get(pidgeId), s = PIDGE_SLOTS[0];
        game.interiors.enterNow(pidgeId, d.doors[0], s);
        const door = d.doors[0].pos; P.worldPos.set(door[0], game.world.groundHeight(door[0], door[1]), door[1]);
        W.start = { x: s[0], z: s[1], slot: 0, settled: false };
        return true;
      },
      play() {
        if (P.place !== pidgeId) return;
        if (ui._area !== undefined) ui._area = null;   // show the banner again now the start screen has gone
        ui.area(rooms.pidge.def.name);
        if (!pidgeChecked()) { pidgeObjective = true; ui.objective('Check your pigeonhole: far wall, press E'); }
      },
    };
    function settleStart() {
      const st = W.start;
      if (!st || st.settled) return;
      if (P.place !== pidgeId || Math.hypot(P.pos.x - st.x, P.pos.z - st.z) > 0.25) { st.settled = true; return; }
      const net = game.net;
      if (!net || !net.connected || !net.id) return;
      const others = [];
      for (const o of net.others.values()) if (o.seen && o.place === pidgeId) others.push([o.tx, o.tz]);
      const i = pidgeSlot(net.id, others), s = PIDGE_SLOTS[i];
      st.slot = i; st.settled = true; st.x = s[0]; st.z = s[1];
      if (i !== 0) P.teleport(s[0], s[1], s[2]);
    }
    W.settleStart = settleStart;

    // ================================================================ MEMORIAL ROOM
    room('memorial', 'Memorial Room', 'memorial', buildMemorial, {
      label: 'Enter the Memorial Room',
      seamless: MEMORIAL.seamless,      // a walk-in room: the yard door and the two west windows are real openings
      shown(r) { r.R.setLight(game.time.daylight ?? 1, memOn(r)); },
      populate(r) { const R = r.R; if (hour() >= 9 && hour() < 18 && day() % 2 === 0) { R.chairs.slice(0, 4).forEach((c, i) => spawnIn(r, c.x, c.z, look(9500 + i, { outfit: i ? 'casual' : 'tweed', prop: i ? 'book' : null }), { heading: c.h, pose: i ? 'write' : 'talk', label: i ? null : 'Tutor', lines: i ? null : ['So what does Locke mean by “property”?', 'Let us take the counter-argument.'] })); } },
      signature: () => `${hour() >= 9 && hour() < 18}|${day() % 2}`,
      tick(r) { r.R.setLight(game.time.daylight ?? 1, memOn(r)); },
    });

    // ================================================================ STAIRCASE 5 + YOUR ROOM
    room('stair5', 'Staircase 5', 'stair5', buildStair, {
      label: 'Enter Staircase 5',
      // a walk-in building: the front door, the landing's window and your room's window are real openings on the quad
      seamless: STAIR.seamless,
      shown(r) { r.R.setLight(game.time.daylight ?? 1, inside(r)); },      // (your lamp is off while you are out)
      enter(r) { if (r.R && r.R.setLevel) r.R.setLevel(game.player.pos.y > STAIR.HALF ? 1 : 0); },
      setup(r) {
        const R = r.R;
        game.interact.add({ place: r.id, pos: R.desk, radius: 1.1, label: 'Work on essay', enabled: () => !seated, onUse: () => {
          sitAt(R.deskSeat, { name: 'essay', pose: 'write', hint: 'You stare at the essay on Hobbes…', update(dt, t) { if (t > 5 && !R._wrote) { R._wrote = true; const st = essayStep(W.state.essay, W.state.essayK++); W.state.essay = st.words; ui.toast(st.msg, 4); game.state.energy = clampEnergy((game.state.energy ?? 70) - 8); } }, onEnd() { R._wrote = false; } });
        } });
        game.interact.add({ place: r.id, pos: R.bed, radius: 1.2, label: 'Sleep', enabled: () => !seated, onUse: () => {
          ui.fade(() => { game.state.energy = 100; game.save(); }).then(() => ui.toast('You nap for what feels like hours. (The College clock disagrees.) Energy 100/100.', 4));
        } });
        game.interact.add({ place: r.id, pos: R.shelf, radius: 1.0, label: 'Browse the bookshelf', onUse: () => ui.toast('Leviathan, a library copy of Locke, a mug, and a stack of unopened battels.', 4) });
        game.interact.add({ place: r.id, pos: R.window, radius: 1.2, label: 'Look out of the window', onUse: () => ui.toast('The Main Quad: striped lawn, the Cottages beyond. Someone is on the grass. The porter has noticed.', 4) });
        game.interact.add({ place: r.id, pos: R.bucket, radius: 0.9, label: 'Scout’s bucket', onUse: () => ui.toast('Your scout has been. The bin is empty and there is a note: “Please defrost your fridge.”', 4) });
      },
      tick(r) { r.R.setLight(game.time.daylight ?? 1); },
    });

    // ================================================================ LIBRARY
    // A walk-in room over the loggia (plan: _worcint_library_plan.js): the oak door in the gateway passage opposite the
    // Lodge's, the spiral stair up, the nine first-floor windows of the quad front real openings onto the Main Quad.
    room('library', 'Library', 'library', buildLibrary, {
      label: 'Up the stairs to the Library',
      seamless: LIB.seamless,
      shown(r) { r.R.setLight(game.time.daylight ?? 1, hour() >= 17 || hour() < 8, libOpen(r)); },
      signature: () => `${hour() >= 9 && hour() < 23}`,
      // (readers sit on the library's floor, 5.5 m up — and the attic's, 9.77 m — whether or not the player is in the room: p.y is theirs to keep)
      populate(r) { const R = r.R; if (hour() >= 9 && hour() < 23) { R.desks.filter((_, i) => i % 3 === 1).slice(0, 5).forEach((d, i) => { const p = spawnIn(r, d.x, d.z, look(9600 + i, { outfit: i % 2 ? 'casual' : 'gown' }), { heading: d.h, pose: 'write' }); if (p && !(p.y > 1)) p.y = p.gy = R.floor; });
        // the attic library (the owner: "where most people work"): readers at its desks, on its floor
        (R.adesks || []).filter((_, i) => i % 2 === 0).forEach((d, i) => { const p = spawnIn(r, d.x, d.z, look(9620 + i, { outfit: i % 3 ? 'casual' : 'gown' }), { heading: d.h, pose: 'write' }); if (p) p.y = p.gy = R.attic; }); } },
      tick(r, dt) {
        r.R.setLight(game.time.daylight ?? 1, hour() >= 17 || hour() < 8, libOpen(r));
        if (P.speed > 4.5 && P.pos.y > LIB.LF - 0.5 && !game.activity) { r.shh = (r.shh || 0) - dt; if (r.shh <= 0) { r.shh = 5; ui.toast('“Shhh!”', 2); const n = r.npcs[0]; if (n && n.character) n.character.say('Shhh!', 2); } }
      },
      setup(r) { const R = r.R; R.desks.forEach((d, i) => { if (i % 3) return; game.interact.add({ place: r.id, pos: [d.ax, d.az], radius: 0.9, label: 'Sit and read', enabled: () => !seated, onUse: () => sitAt(d, { pose: 'write', hint: 'You read under the red lamp.', backTo: [d.ax, d.az] }) }); });
        (R.adesks || []).forEach((d, i) => { if (i % 2 === 0) return; game.interact.add({ place: r.id, pos: [d.ax, d.az], radius: 0.9, label: 'Sit and work', enabled: () => !seated && P.pos.y > R.attic - 0.5, onUse: () => sitAt(d, { pose: 'write', hint: 'You work at a desk in the attic library.', backTo: [d.ax, d.az] }) }); }); },
    });

    // ================================================================ EARL BUILDING
    // A walk-in building: the automatic door under the canopy on the wing's east side, left into the ground-floor corridor
    // to the kitchen at its end (the owner: "ground floor kitchen"), the stair up to the first-floor corridor and two
    // study rooms — all in place inside the real footprint (plan: _worcint_earl_plan.js, re-laid 2026-11-22 on the
    // architects' plan).
    room('earl', 'Earl Building', null, buildEarl, {
      doorsWorld: [{ pos: EARL.door, facing: EARL.doorFacing, label: 'Enter the Earl Building', radius: 1.6 }],
      seamless: EARL.seamless,
      enter(r) { if (r.R && r.R.setLevel) r.R.setLevel(0); },
      setup(r) { const R = r.R;
        game.interact.add({ place: r.id, pos: R.kettle, radius: 1.2, label: 'Make a cup of tea', onUse: () => { game.state.energy = clampEnergy((game.state.energy ?? 70) + 10); ui.toast(`Tea. Someone has used your milk again. Energy ${Math.round(game.state.energy)}/100.`, 3); } });
        game.interact.add({ place: r.id, pos: R.bed, radius: 1.2, label: 'Sleep', onUse: () => ui.fade(() => { game.state.energy = 100; game.save(); }).then(() => ui.toast('A proper sleep in an en-suite room. Energy 100/100.', 3)) });
      },
      populate(r) { const R = r.R; if (hour() >= 8 && hour() < 24) { spawnIn(r, R.kitchenSeats[0].x, R.kitchenSeats[0].z, look(9700, { outfit: 'casual' }), { heading: R.kitchenSeats[0].h, pose: 'sit', lines: ['Whose turn is it to do the bins?', 'Pasta again.'] }); spawnIn(r, R.hob[0], R.hob[1], look(9701, { outfit: 'casual' }), { heading: R.hob[2], pose: 'stand' }); }
        // supper time: two more at the far end of the table (seats the dippers scene leaves free)
        if (hour() >= 18 && hour() < 21) for (const [i, seed] of [[4, 9702], [5, 9703]]) { const s = R.kitchenSeats[i]; if (s) spawnIn(r, s.x, s.z, look(seed, { outfit: 'casual' }), { heading: s.h, pose: 'sit', lines: ['Is this your pan?', 'Formal on Wednesday?'] }); } },
      signature: () => `${hour() >= 8}|${hour() >= 18 && hour() < 21}`,
      tick(r) { r.R.setLight(game.time.daylight ?? 1); },
      shown(r) { r.R.setLight(game.time.daylight ?? 1); },
    });
    // (built on the loading screen: it is seen through its own windows from the gardens)
    (game.warmups || (game.warmups = [])).push({ id: 'worcint:earl', fn: () => { game.interiors.warm(rooms.earl.id); } });

    // ---------------------------------------------------------------- the outside of the real windows (world scene)
    // Each real window's frame and glazing bars as the OUTSIDE has them — white-painted, in the pattern of the painted
    // windows beside it — drawn in the world a few centimetres in front of the punched opening, lit as the wall is
    // (places/_walkin_city.js dressOpenings). The painted window of the shell stays behind the opening: it is what is
    // seen from further off than rooms are shown (fill: false). Earl, Lodge and pigeonhole room only.
    try {
      const WHITE = 0xe9e7df;
      // Earl Building: dark green frames, each light a top-hung casement over a low fixed light (16/earl building -
      // timber-boarded bay…): one mullion per light the room's own timber window has, the transom where it has its own
      dressOpenings(game, rooms.earl.id, EARL.seamless.openings.map((o) => ({ at: o.at, out: o.out, w: o.w, y0: o.y0, y1: o.y1, depth: o.depth, frame: { w: 0.06, color: EARL_FRAME }, bars: [o.lights || 2, 1], barW: 0.05, meeting: (o.tr || 0.4) / (o.y1 - o.y0), fill: false })));
      // Porters' Lodge and the Library's stair: the street front's two round-headed ground-floor windows (white sashes
      // three lights wide: the 2025 photograph of the front), each room's ONE window to the forecourt
      dressOpenings(game, rooms.lodge.id, [{ o: 0, head: 'round', frame: { w: 0.05, color: WHITE }, bars: [3, 4], meeting: 0.5, fill: false }]);
      dressOpenings(game, rooms.library.id, [{ o: LIB.seamless.openings.findIndex((q) => q.id === 'libStair'), head: 'round', frame: { w: 0.05, color: WHITE }, bars: [3, 4], meeting: 0.5, fill: false }]);
      // pigeonhole room: the range's own six-over-six sash
      dressOpenings(game, rooms.pidge.id, [{ o: 0, frame: { w: 0.05, color: WHITE }, bars: [3, 4], meeting: 0.5, fill: false }, ...(PR.win2 ? [{ o: 1, frame: { w: 0.05, color: WHITE }, bars: [4, 4], meeting: 0.5, fill: false }] : [])]);      // (... and, in the hand-built front, its wide eight-over-eight)
    } catch (e) { console.warn('[worcint] window dressing', e); }

    console.log('[worcint] registered', Object.keys(rooms).filter((k) => k.startsWith('worcint_')).length, 'interiors');
    return {
      update(dt) {
        if (earlExt && earlExt.update) earlExt.update(dt); if (W.start && !W.start.settled) settleStart();
        // a walk-in room that is no longer shown lets its people go
        for (const r of roomList) if (r.npcs.length && r.def && r.def.sl && !r.def.sl.shown && game.player.place !== r.id) clear(r);
      },
    };
  },
};

// door mesh on the exterior where worcester.js has none: Library (north end of the loggia) + Memorial Room (yard)
function buildExtraDoors(game) {
  const world = game.world, S = sharedMats(game);
  const B = new Batch();
  const grp = new THREE.Group(); grp.position.set(C0[0], 0, C0[1]); grp.rotation.y = PHI; world.addStatic(grp);
  // (the Library's door is in the gateway passage and worcester.js draws it: the south wall, opposite the Lodge's)
  // Memorial Room: the doorway of the walk-in room on the yard face of the west range's tall block (plan:
  // _worcint_lodge_plan.js MEMORIAL; the range: places/worcester_yard.js), facing east. A stone door-case on the
  // hand-built wall: jambs, an overdoor, a hood, a step. The pair of half-glazed leaves is painted flat and one-sided
  // (not seen from inside the room): it is what shows from far off — near to, the opening is punched 1 cm in front of
  // it and the real leaves hang in the doorway.
  { const E = MEMORIAL.ext, dw = MEMORIAL.door.w / 2, top = MEMORIAL.seamless.lift + MEMORIAL.door.h;
    B.push(frame(E.u, 0, E.v, 0, -1));   // s runs north (−v) from the door's centre; normal = (1,0) east
    for (const sx of [-1, 1]) B.box('stone', sx * (dw + 0.11), top / 2, 0.09, 0.22, top, 0.18);
    B.box('stone', 0, top + 0.4, 0.07, 2 * dw + 0.44, 0.8, 0.14); B.box('stone', 0, top + 0.85, 0.13, 2 * dw + 0.7, 0.1, 0.26);
    B.box('stone', 0, 0.03, 0.22, 2 * dw + 0.5, 0.06, 0.44);
    B.face('oak', rectPts(-dw, 0, dw, top), [], E.leaf);
    for (const sx of [-1, 1]) B.face('glassD', rectPts(sx * dw / 2 - 0.24, 1.2, sx * dw / 2 + 0.24, top - 0.25), [], E.leaf + 0.003);
    B.pop(); }
  const mats = { stone: world.mats.stone, oak: S.oak, brass: S.brass, glassD: new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.2, metalness: 0.4 }) };
  const meshes = B.build(mats, grp);
  for (const m of meshes) { m.castShadow = false; }
  grp.updateMatrixWorld(true);
}
