// Radcliffe Square: the games. Light, comic, bloodless; everything other players should see alike is a function of the
// shared clock and the game day (porter lines, the tourists' shutter, the degree-day procession); the walking-tour job
// and its little group are the local player's own (as the taxi / bus jobs are).
//   The Camera door      readers only: the porter turns you away with rotating lines, until you have found a reader's
//                        card (left on a table in the Turf's yard); then you may stand inside the door and look in.
//   Photobombing         a tourist photographs friends in front of the Camera every 9 s (shared); stand in the frame
//                        when the shutter goes and you are in it. Or offer to take the photo for them (a small tip).
//   Walking-tour guide   a board on Broad Street: lead five tourists past four sights in six minutes; tips per stop, a
//                        bonus for time left, less if you leave them behind.
//   Degree days          two days in seven (never May Morning's day or the fireworks day), at 11:00 and 14:30, the
//                        graduands process from the Divinity School's north door to the Sheldonian; applaud them.
import * as THREE from 'three';
import { planWalkin, cityDoor, warmLater, roomCrowd, dressOpenings } from './_walkin_city.js';
import { ROOM as RR, WIN as RWIN, DOOR as RDOOR } from './_rad_reading.js';
import { CAMERA as CAM } from './_rad_camera.js';
import { createCharacter, randomLook } from '../core/characters.js';
import { DAY_MS, HOUR_MS, mod } from './_mm_rules.js';
import { HOUR_S } from '../core/time.js';
import { hash, strHash, wrapA } from './_rad_kit.js';

// ------------------------------------------------------------------------------------------------ pure rules (tested)
export const PORTER_LINES = [
  "Readers only, I'm afraid.", 'Have you got your Bod card? No card, no Camera.', "It's a library, not a museum. Readers only.",
  "Nice try. The tours go from the Great Gate.", "I've seen that face before. Still no.", "If you're a reader I'm the Chancellor.",
  'Shh. Readers only. And shh.', "No card? Then I'm afraid the answer's still no.",
];
export const ADMIT_LINES = ['Card? ...Fine. Quietly, mind.', 'In you go. Not a whisper.', "Right. Don't touch anything."];
export const CAMERA_HOURS = [9, 22];
export function porterLine(slot, tries) { return PORTER_LINES[mod(Math.floor(hash(slot, 7) * 97) + tries, PORTER_LINES.length)]; }

export const PHOTO = { P: [421.5, 131.5], target: [413.9, 172.1], everyMs: 9000, friends: 2, hours: [9, 18.5], zone: [1.0, 6.6, 0.95] };
/** the photographer's line of sight: unit dir from P towards the Camera */
export function photoDir() { const dx = PHOTO.target[0] - PHOTO.P[0], dz = PHOTO.target[1] - PHOTO.P[1], l = Math.hypot(dx, dz); return [dx / l, dz / l]; }
/** is (x, z) in the frame (between the lens and the friends, or just behind them)? */
export function inFrame(x, z) {
  const [dx, dz] = photoDir(), px = x - PHOTO.P[0], pz = z - PHOTO.P[1], along = px * dx + pz * dz, across = Math.abs(px * dz - pz * dx);
  return along > PHOTO.zone[0] && along < PHOTO.zone[1] && across < PHOTO.zone[2] + along * 0.12;
}
export const shutterSlot = (ms) => Math.floor(ms / PHOTO.everyMs);

export const TOUR = { board: [352.5, 42.6], seconds: 360, group: 5, stops: ['emperors-heads', 'bridge-of-sighs', 'radcliffe-camera', 'stmary-porch'], stopAt: { 'emperors-heads': [343.5, 46.0], 'bridge-of-sighs': [420.0, 58.4], 'radcliffe-camera': [411.0, 130.0], 'stmary-porch': [412.0, 274.0] }, radius: 8, perStop: 2.5, perSec: 0.02 };
/** tips: stops reached in time, how many of the group were with you at each, seconds left */
export function tourPay(stops, withYou, secsLeft, finished) {
  let t = 0; for (let i = 0; i < stops; i++) t += TOUR.perStop * (0.4 + 0.6 * Math.min(1, (withYou[i] ?? TOUR.group) / TOUR.group));
  if (finished) t += Math.max(0, secsLeft) * TOUR.perSec;
  else t *= 0.5;
  return Math.round(t * 100) / 100;
}

export const DEGREE = { days: [3, 6], times: [11.0, 14.5], n: 20, speed: 0.55, gap: 1.3, from: [349.3, 106.6], to: [346.2, 89.6], lead: 2 };
export const isDegreeDay = (day) => DEGREE.days.includes(mod(day, 7));
/** state of the procession at shared ms: null when none is under way, else {t (s since it began), L} */
export function procession(ms) {
  const day = Math.floor(ms / DAY_MS); if (!isDegreeDay(day)) return null;
  const h = (ms - day * DAY_MS) / HOUR_MS;             // game hour
  for (const t0 of DEGREE.times) { const t = (h - t0) * HOUR_S; const L = Math.hypot(DEGREE.to[0] - DEGREE.from[0], DEGREE.to[1] - DEGREE.from[1]); const dur = (L + (DEGREE.n + DEGREE.lead) * DEGREE.gap) / DEGREE.speed + 8; if (t >= -20 && t < dur) return { t, L, dur, t0, day }; }
  return null;
}
/** position of walker i (0..lead-1 the Bedels, then graduands in pairs) at time t (s); null = not out (inside a door) */
export function walkerAt(i, t, out = {}) {
  const L = Math.hypot(DEGREE.to[0] - DEGREE.from[0], DEGREE.to[1] - DEGREE.from[1]), row = i < DEGREE.lead ? i * 0.6 : DEGREE.lead * 0.6 + Math.floor((i - DEGREE.lead) / 2) + 0.5;
  const s = t * DEGREE.speed - row * DEGREE.gap;
  if (s < 0 || s > L) return null;
  const ux = (DEGREE.to[0] - DEGREE.from[0]) / L, uz = (DEGREE.to[1] - DEGREE.from[1]) / L, side = i < DEGREE.lead ? 0 : ((i - DEGREE.lead) % 2 ? 0.5 : -0.5);
  out.x = DEGREE.from[0] + ux * s - uz * side; out.z = DEGREE.from[1] + uz * s + ux * side; out.h = Math.atan2(ux, uz); out.s = s;
  return out;
}

// ------------------------------------------------------------------------------------------------ the games
export const TOURIST_LINES = ['Say "cheese"!', 'Can you move? You\'re in the shot.', 'Is this Hogwarts?', 'Just one more!', 'Oh, it\'s round!', 'Lovely light today.'];
const BOMB_LINES = ['Oi! You were in that one!', 'Not again!', 'Delete, delete, delete…', 'Every time!', 'Was that on purpose?', 'Now we have a stranger in our holiday photos.'];
const GROUP_LINES = ['Is it far?', 'Who built that one?', 'Can we get ice cream after?', 'Slow down!', 'Is this where they filmed…?', 'What\'s that one?', 'My feet!', 'Ooh.'];
const LIBRARIAN = ['Shh.', 'Readers only past the rope.', 'Shhhhh.', 'This is a reading room.'];
const BEDEL_LINES = ['Make way, please.', 'Mind the procession.', 'Graduands only, sir.'];
const FAMILY_LINES = ['There she is!', 'Wave! WAVE!', 'Four years for that hat.', 'Get a picture!', "That's my boy!", 'He looks just like his grandad.'];

export function createGames(game, ctx) {
  const W = game.world, scene = game.worldScene, col = game.worldCollider, P = game.pedestrians;
  const S = { tries: 0, bombs: 0, photoPeds: [], lastSlot: -1, flash: 0, tour: null, proc: null, procChars: [], family: [], applauded: -1, err: false };
  const flags = () => (game.state.flags || (game.state.flags = {}));
  const now = () => game.time.now();
  const hour = () => (game.time.pinned != null ? game.time.pinned : game.time.hour);
  const say = (ped, text, secs = 3) => { try { if (ped && ped.character && ped.character.say) ped.character.say(text, secs); } catch { /* */ } };
  const toast = (t, s = 4) => { try { game.ui.toast(t, s); } catch { /* */ } };
  const spawn = (x, z, look, o = {}) => { try { return P && P.spawnAt ? P.spawnAt(x, z, look, { knockable: false, ...o }) : null; } catch (e) { return null; } };
  const unspawn = (list) => { for (const p of list) { try { P.remove(p); } catch { /* */ } } list.length = 0; };

  // ---------------------------------------------------------------- the Camera door: porter, card, reading room
  const door = ctx.cameraDoor, a0 = ctx.cameraFacing;
  let porter = null;
  const pd = [door[0] + Math.cos(a0) * 1.9, door[1] - Math.sin(a0) * 1.9];
  const ensurePorter = (on) => {
    if (on && !porter) porter = spawn(pd[0], pd[1], randomLook('rad-camera-porter', { outfit: 'porter' }), { heading: a0, label: 'Library porter', lines: ['Morning.', 'Readers only.', 'Lovely day for reading.'] });
    else if (!on && porter) { try { P.remove(porter); } catch { /* */ } porter = null; }
  };
  // ---- walk-in (core/interiors.js "seamless", places/_walkin_city.js): the room concentric in the drum, the real north
  // door at the top of its steps. Locked out of hours AND without a reader's card (the porter says why); the test of
  // every city room (tools/smoke_walkin_city.mjs) reads hours.testOpen, which admits it as a reader.
  const canEnter = () => { const h = hour(); if (S.walkinTest) return h >= 8 && h < 20; return h >= CAMERA_HOURS[0] && h < CAMERA_HOURS[1] && !!(flags().radBodCard || S.debugCard); };
  let plan = null;
  try {
    if (ctx.cameraCentre) {
      const [cx, cz] = ctx.cameraCentre, A = ctx.cameraA || 15.1, R0 = RR.R, st = Math.PI / 8;
      plan = planWalkin(game, {
        id: 'rad_reading', door: { pos: door, facing: a0 },
        building: Array.from({ length: 16 }, (_, k) => { const t = a0 + (k + 0.5) * st, r = A / Math.cos(Math.PI / 16); return [cx + Math.sin(t) * r, cz + Math.cos(t) * r]; }),
        portal: { at: [0, -R0], out: Math.PI, w: RDOOR.w, h: RDOOR.h, y: 0 }, wall: A - R0, lift: 0,
        rects: [[-R0, -1, R0, 1], [-1, -R0, 1, R0], [-R0 * Math.SQRT1_2, -R0 * Math.SQRT1_2, R0 * Math.SQRT1_2, R0 * Math.SQRT1_2]], center: [0, 0], mid: [0, -R0 + 1.9], route: [[-1.0, -R0 + 2.3], [1.0, -R0 + 2.3], [-1.0, -R0 + 2.3], [1.0, -R0 + 2.3]],
        // (each window is declared at its iron grille, 0.3 m inside the glazing plane of the shell — not at the room's wall face
        //  2 m further in: what core draws of an opening from a distance is what stands within its `depth`; the 2 m
        //  embrasure behind it is the room's own geometry, _rad_reading.js)
        windows: [1, 3, 5, 7, 9, 11, 13, 15].map((k) => { const t = Math.PI + k * st, ro = A + 0.08 - RWIN.depth; return { at: [Math.sin(t) * ro, Math.cos(t) * ro], out: t, w: RWIN.w, y0: RWIN.y0, y1: RWIN.y1, depth: RWIN.depth, lights: 3 }; }),
        hours: { open: canEnter, get testOpen() { S.walkinTest = true; return 14; }, testShut: 3.5 },
      });
      // (the doorway is punched at the back of the modelled reveal, where the oak leaf hangs: the shell's own arch frames it)
      plan.seamless.portals[0].proud = 0.03 - CAM.door.rec;
      { const q = R0 * Math.SQRT1_2, e = R0 - 0.3, y1 = RR.domeTop;      // (the inside of the round room as three boxes that stay within its wall: which frame the camera is in, who is in it)
        plan.seamless.bounds = [{ x0: -q, x1: q, z0: -q, z1: q, y0: 0, y1 }, { x0: -5, x1: 5, z0: -e, z1: e, y0: 0, y1: RR.wall }, { x0: -e, x1: e, z0: -5, z1: 5, y0: 0, y1: RR.wall }]; }
    }
  } catch (e) { console.warn('[radcliffe_square] reading room plan', e); }
  let lastSay = -1e9;
  game.interiors.register({
    id: 'rad_reading', name: 'Radcliffe Camera (reading room)', background: 0x2a2620, ambient: 0.4,
    seamless: plan && plan.fit.ok ? plan.seamless : null,
    // (shown, you outside: the porter tells a caller at the locked door why — no toast)
    update(dt) { roomTick(dt); },
    updateShown(dt) { roomTick(dt); const p = game.player, t = now(); if (p.place !== 'world' || canEnter() || t - lastSay < 7000 || Math.hypot(p.pos.x - door[0], p.pos.z - door[1]) > 3.2) return; lastSay = t; const h = hour(); say(porter, h < CAMERA_HOURS[0] || h >= CAMERA_HOURS[1] ? 'Closed. Readers from nine in the morning.' : porterLine(Math.floor(t / 30000), S.tries++), 4); },
    doors: [{ pos: door, facing: a0, radius: 2.2, label: 'Go into the Radcliffe Camera', locked: () => {
      const h = hour();
      if (h < CAMERA_HOURS[0] || h >= CAMERA_HOURS[1]) { const l = 'Closed. Readers from nine in the morning.'; say(porter, l); return l; }
      if (!flags().radBodCard && !S.debugCard) { const l = porterLine(Math.floor(now() / 30000), S.tries++); say(porter, l); return 'Porter: "' + l + '"'; }
      say(porter, ADMIT_LINES[S.tries++ % ADMIT_LINES.length]); return false;
    } }],
    build(c) { const r = ctx.buildReading({ ...c, world: W, plan }); c.addExit(r.exit[0], r.exit[1], 'Back out into the square'); S.reading = r;
      if (c.seamless && plan) S.door = cityDoor(c, plan, { style: 'oak', heavy: true, setBack: plan.seamless.portals[0].depth - CAM.door.rec - 0.06, open: canEnter });
      return { spawn: r.spawn, heading: r.heading }; },
    onEnter() { toast('The reading room, from inside the door: you may look, not touch. (Readers are working.)', 6); },
  });
  if (plan) warmLater(game, 'rad_reading');
  const ROOMZ = 13.2;
  // the room by the hour, whenever it is shown (seen through the eight windows from the square): lit and at work in
  // library hours (the readers are one baked draw: _rad_reading.js), dark and empty after ten; the librarian at her
  // desk and two readers on their feet among the desks are real people (same for every player)
  const libOpen = () => { const h = hour(); return h >= CAMERA_HOURS[0] && h < CAMERA_HOURS[1]; };
  const crowd = roomCrowd(game, 'rad_reading', { signature: () => (libOpen() ? 'open' : 'shut'), cap: 4, populate(sp) {
    if (!libOpen()) return;
    S.librarian = sp(2.6, -ROOMZ + 4.25, randomLook('rad-librarian', { outfit: 'smart' }), { heading: Math.PI, label: 'Librarian', lines: LIBRARIAN });
    sp(-8.6, -6.2, randomLook('rad-reader-a', { outfit: 'casual', prop: 'book' }), { heading: 2.2, pose: 'stand', label: '' });
    sp(6.1, 9.9, randomLook('rad-reader-b', { outfit: 'tweed', prop: 'book' }), { heading: -2.6, pose: 'stand', label: '' });
  } });
  function roomTick(dt) { try { if (S.reading && S.reading.setOpen) { const h = hour(); S.reading.setOpen(libOpen(), h >= CAMERA_HOURS[0] - 0.5 && h < CAMERA_HOURS[1] + 0.5); } /* (the lights stay on half an hour after the last reader) */ crowd.tick(dt); } catch { /* */ } }
  // far look of the eight windows and the door (beyond the distance rooms are shown, the painted units of the shell do it)
  // the reader's card, forgotten on a table in the Turf's yard (else on the bench by the Schools' south gate)
  const cardAt = ctx.cardAt;
  let cardMesh = null;
  if (cardAt) {
    const uv = ctx.signs.uv('card'), g = new THREE.PlaneGeometry(0.12, 0.075);
    const a = g.attributes.uv; a.setXY(0, uv[0], uv[3]); a.setXY(1, uv[2], uv[3]); a.setXY(2, uv[0], uv[1]); a.setXY(3, uv[2], uv[1]);
    cardMesh = new THREE.Mesh(g, ctx.signs.material); cardMesh.rotation.x = -Math.PI / 2; cardMesh.rotation.z = 0.4; cardMesh.position.set(cardAt[0], cardAt[2] + 0.005, cardAt[1]); cardMesh.name = 'rad:card';
    cardMesh.visible = !flags().radBodCard; scene.add(cardMesh); cardMesh.updateMatrix(); cardMesh.matrixAutoUpdate = false;
    game.interact.add({ pos: [cardAt[0], cardAt[1]], radius: 1.6, label: "Pick up the reader's card", enabled: () => !flags().radBodCard, onUse: () => {
      flags().radBodCard = true; cardMesh.visible = false; try { game.save(); } catch { /* */ }
      toast("A Bodleian reader's card. The photo looks a bit like you, if you squint. The Radcliffe Camera might let you in now.", 7);
    } });
  }

  // ---------------------------------------------------------------- tourists in front of the Camera
  const [dx, dz] = photoDir();
  const photoH = Math.atan2(dx, dz);
  const friends = []; for (let k = 0; k < PHOTO.friends; k++) friends.push([PHOTO.P[0] + dx * 3.4 + (k - 0.5) * 0.8 * dz, PHOTO.P[1] + dz * 3.4 - (k - 0.5) * 0.8 * dx]);
  function photoPeds(on) {
    if (on === S.photoPeds.length > 0) return;
    if (!on) { unspawn(S.photoPeds); return; }
    const ph = spawn(PHOTO.P[0], PHOTO.P[1], randomLook('rad-tourist-cam', { outfit: 'tourist', prop: 'camera' }), { heading: photoH, pose: 'photo', lines: TOURIST_LINES });
    if (ph) S.photoPeds.push(ph);
    friends.forEach(([x, z], k) => { const f = spawn(x, z, randomLook('rad-tourist-' + k, { outfit: 'tourist' }), { heading: photoH + Math.PI, pose: k ? 'wave' : 'stand' }); if (f) S.photoPeds.push(f); });
  }
  // the flash: a small radial-gradient sprite of its own (64 px)
  const fc = document.createElement('canvas'); fc.width = fc.height = 64;
  { const g = fc.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,240,0.7)'); gr.addColorStop(1, 'rgba(255,255,240,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fc), transparent: true, depthWrite: false, toneMapped: false }));
  flash.scale.set(0.9, 0.9, 1); flash.visible = false; flash.name = 'rad:flash'; flash.position.set(PHOTO.P[0] + dx * 0.4, 1.6, PHOTO.P[1] + dz * 0.4); scene.add(flash);
  game.interact.add({ pos: PHOTO.P, radius: 1.8, label: 'Offer to take their photo', enabled: () => S.photoPeds.length > 0, onUse: () => {
    const k = Math.floor(now() / 120000);
    if (S.helped === k) { say(S.photoPeds[0], "We've got loads now, thanks!"); return; }
    S.helped = k; game.pay(1); S.flash = 0.15; flash.visible = true;
    say(S.photoPeds[0], 'Oh, thank you! Here, for a coffee.'); toast('You take their photo: two tourists and a very round library. They tip you £1.', 4);
  } });
  function photoTick(dt, wp, outdoors) {
    const h = hour(), on = outdoors && h >= PHOTO.hours[0] && h < PHOTO.hours[1] && Math.hypot(wp.x - PHOTO.P[0], wp.z - PHOTO.P[1]) < (S.photoPeds.length ? 85 : 70);
    photoPeds(on);
    if (S.flash > 0) { S.flash -= dt; if (S.flash <= 0) flash.visible = false; }
    if (!S.photoPeds.length) return;
    const k = shutterSlot(now());
    if (k !== S.lastSlot) {
      const first = S.lastSlot < 0; S.lastSlot = k;
      if (first) return;
      S.flash = 0.15; flash.visible = true;
      if (inFrame(game.player.pos.x, game.player.pos.z) && game.player.place === 'world') {
        S.bombs++; const st = flags(); st.radBombs = (st.radBombs || 0) + 1;
        say(S.photoPeds[0], BOMB_LINES[mod(k, BOMB_LINES.length)]);
        toast(`Photobombed! (${st.radBombs} holiday album${st.radBombs > 1 ? 's' : ''} ruined)`, 3);
      } else if (hash(k, 3) < 0.3) say(S.photoPeds[0], TOURIST_LINES[mod(k, TOURIST_LINES.length)]);
    }
  }

  // ---------------------------------------------------------------- the walking-tour job
  const sights = ctx.sights;
  game.interact.add({ pos: TOUR.board, radius: 2.0, label: () => (S.tour ? 'Walking tour under way' : 'Lead a walking tour (4 sights, 6 minutes, tips)'), enabled: () => !S.tour, onUse: () => startTour() });
  function startTour() {
    if (S.tour) return;
    const seed = Math.floor(now() / 60000);
    const T = { t: TOUR.seconds, stop: 0, with: [], chars: [], blip: null, said: 0 };
    for (let i = 0; i < TOUR.group; i++) {
      try {
        const ch = createCharacter(randomLook('rad-tour-' + seed + '-' + i, { outfit: 'tourist', prop: i === 1 ? 'camera' : undefined }));
        const a = (i / TOUR.group) * Math.PI * 2, x = TOUR.board[0] + Math.sin(a) * 1.8, z = TOUR.board[1] + Math.cos(a) * 1.8;
        ch.group.position.set(x, W.groundHeight(x, z), z); scene.add(ch.group);
        let blob = null; try { blob = W.blobShadow(ch.group, 0.4); } catch { /* */ }
        T.chars.push({ ch, x, z, h: 0, sp: 0, blob, k: i });
      } catch (e) { console.warn('[radcliffe_square] tour', e); }
    }
    S.tour = T; nextStop();
    toast('Walking tour! Lead your group to four sights in six minutes. They walk slower than you: don\'t lose them.', 6);
  }
  function nextStop() {
    const T = S.tour; try { if (T.blip) game.ui.removeBlip(T.blip); } catch { /* */ }
    if (T.stop >= TOUR.stops.length) return endTour(true);
    const id = TOUR.stops[T.stop], at = TOUR.stopAt[id], s = sights.find((q) => q.id === id);
    T.blip = game.ui.addBlip(at[0], at[1], '#e8b84a', 'Tour stop');
    T.target = at; T.name = s ? s.name : id;
  }
  function endTour(done) {
    const T = S.tour; if (!T) return;
    try { if (T.blip) game.ui.removeBlip(T.blip); game.ui.objective(null); } catch { /* */ }
    const pay = tourPay(T.stop, T.with, T.t, done);
    if (pay > 0) game.pay(pay);
    const st = flags(); st.radTours = (st.radTours || 0) + (done ? 1 : 0);
    toast(done ? `Tour over! Your group tips you £${pay.toFixed(2)}.${T.t > 60 ? ' "Best tour ever!"' : ''}` : `Time's up — the group drifts off to find a coffee. £${pay.toFixed(2)} in tips.`, 7);
    for (const c of T.chars) { try { c.blob && c.blob.remove(); scene.remove(c.ch.group); c.ch.dispose(); } catch { /* */ } }
    S.tour = null;
  }
  function tourTick(dt) {
    const T = S.tour; if (!T) return;
    T.t -= dt;
    const p = game.player, inWorld = p.place === 'world', px = inWorld ? p.pos.x : p.worldPos.x, pz = inWorld ? p.pos.z : p.worldPos.z;
    // the group follows: each to a slot behind the player, at up to 1.9 m/s (2.8 when far behind)
    const ph = p.heading;
    for (const c of T.chars) {
      const a = ph + Math.PI + (c.k - 2) * 0.45, r = 2.2 + (c.k % 2) * 1.1, tx = px + Math.sin(a) * r, tz = pz + Math.cos(a) * r;
      const ddx = tx - c.x, ddz = tz - c.z, d = Math.hypot(ddx, ddz), v = d > 12 ? 2.8 : 1.9;
      if (d > 0.4) { const s = Math.min(d, v * dt); const q = { x: c.x + (ddx / d) * s, z: c.z + (ddz / d) * s }; col.resolve(q, 0.3); c.sp = Math.hypot(q.x - c.x, q.z - c.z) / Math.max(dt, 1e-3); c.x = q.x; c.z = q.z; c.h += wrapA(Math.atan2(ddx, ddz) - c.h) * Math.min(1, dt * 6); }
      else c.sp = 0;
      c.ch.group.position.set(c.x, W.groundHeight(c.x, c.z), c.z); c.ch.group.rotation.y = c.h; c.ch.update(dt, c.sp);
    }
    const near = T.chars.filter((c) => Math.hypot(c.x - px, c.z - pz) < 12).length;
    if ((T.said -= dt) <= 0) { T.said = 9; const c = T.chars[mod(Math.floor(T.t), T.chars.length)]; if (c) c.ch.say(near < 3 ? 'Wait for us!' : GROUP_LINES[mod(Math.floor(T.t * 7), GROUP_LINES.length)], 2.5); }
    try { game.ui.objective(`Tour: ${T.name} (${T.stop + 1}/4) · ${Math.max(0, Math.ceil(T.t))} s · group with you ${near}/${TOUR.group}`); } catch { /* */ }
    if (T.target && Math.hypot(px - T.target[0], pz - T.target[1]) < TOUR.radius) {
      const s = sights.find((q) => q.id === TOUR.stops[T.stop]);
      T.with[T.stop] = near;
      toast(`${T.name}: ${s ? s.blurb : ''}${near < 3 ? ' (Half the group missed it.)' : ''}`, 6);
      T.stop++; nextStop();
    }
    if (S.tour && T.t <= 0) endTour(false);
  }

  // ---------------------------------------------------------------- degree days at the Sheldonian
  const procLooks = []; for (let i = 0; i < DEGREE.n + DEGREE.lead; i++) procLooks.push(i < DEGREE.lead ? { ...randomLook('rad-bedel-' + i, { outfit: 'subfusc', gown: 'scholar' }) } : randomLook('rad-grad-' + i, { outfit: 'subfusc', gown: 'scholar' }));
  const famSpots = [[355.0, 97.2], [341.5, 99.0], [343.0, 96.0], [356.0, 101.0], [339.8, 102.6], [358.0, 94.0]];
  const tmp = {};
  const applaudAt = new THREE.Vector3((DEGREE.from[0] + DEGREE.to[0]) / 2 + 4, 0, (DEGREE.from[1] + DEGREE.to[1]) / 2);
  game.interact.add({ pos: () => applaudAt, radius: 6, label: 'Applaud the graduands', enabled: () => !!S.proc && S.proc.t > 0, onUse: () => {
    const k = S.proc.t0 * 100 + S.proc.day; if (S.applauded === k) { toast('You have clapped yourself hoarse already.', 3); return; }
    S.applauded = k; try { game.player.character.setPose('clap', { duration: 4 }); } catch { /* */ }
    const c = S.procChars.find((q) => q && q.ch.group.visible); if (c) c.ch.say('Thank you!', 2.5);
    for (const f of S.family) say(f, FAMILY_LINES[mod(Math.floor(now() / 1000) + f.homeX | 0, FAMILY_LINES.length)], 3);
    toast('You applaud. A graduand in a borrowed gown beams at you.', 4);
  } });
  function procTick(dt, wp, outdoors) {
    let pr = procession(now());
    if (S.forceProc != null) { const L = Math.hypot(DEGREE.to[0] - DEGREE.from[0], DEGREE.to[1] - DEGREE.from[1]); pr = { t: S.forceProc, L, dur: 999, t0: 11, day: -1 }; }
    const near = outdoors && pr && Math.hypot(wp.x - DEGREE.from[0], wp.z - DEGREE.from[1]) < (S.procChars.length ? 110 : 90);
    if (!near) {
      if (S.procChars.length) { for (const c of S.procChars) { try { scene.remove(c.ch.group); c.ch.dispose(); } catch { /* */ } } S.procChars.length = 0; }
      if (S.family.length) unspawn(S.family);
      if (S.procBlip) { try { game.ui.removeBlip(S.procBlip); } catch { /* */ } S.procBlip = null; }
      S.proc = null; return;
    }
    S.proc = pr;
    if (!S.procBlip) { S.procBlip = game.ui.addBlip(DEGREE.to[0], DEGREE.to[1], '#c03050', 'Degree ceremony'); if (S.noted !== pr.t0 * 100 + pr.day) { S.noted = pr.t0 * 100 + pr.day; toast('Degree day: the graduands are about to process from the Divinity School to the Sheldonian.', 6); } }
    if (!S.procChars.length) procLooks.forEach((look) => { try { const ch = createCharacter(look); ch.group.visible = false; scene.add(ch.group); S.procChars.push({ ch }); } catch { /* */ } });
    if (!S.family.length) famSpots.forEach(([x, z], i) => { if (!col.isFree(x, z, 0.35)) return; const f = spawn(x, z, randomLook('rad-family-' + i, { outfit: i % 2 ? 'smart' : 'casual', prop: i === 2 ? 'camera' : undefined }), { heading: Math.atan2(DEGREE.from[0] - x, DEGREE.from[1] - z), lines: FAMILY_LINES, pose: i === 2 ? 'photo' : 'stand' }); if (f) S.family.push(f); });
    S.procChars.forEach((c, i) => {
      const w = walkerAt(i, pr.t, tmp);
      if (!w) { if (c.ch.group.visible) c.ch.group.visible = false; return; }
      c.ch.group.visible = true; c.ch.group.position.set(w.x, W.groundHeight(w.x, w.z), w.z); c.ch.group.rotation.y = w.h; c.ch.update(dt, DEGREE.speed);
      if (i === 0 && Math.hypot(wp.x - w.x, wp.z - w.z) < 1.6 && (S.bedelT = (S.bedelT || 0) - dt) <= 0) { S.bedelT = 5; c.ch.say(BEDEL_LINES[mod(Math.floor(now() / 5000), BEDEL_LINES.length)], 2.5); }
    });
  }

  return {
    update(dt) {
      const p = game.player, outdoors = p.place === 'world', wp = outdoors ? p.pos : (p.worldPos || p.pos);
      const nearDoor = outdoors && Math.hypot(wp.x - door[0], wp.z - door[1]) < 60 && hour() >= 7 && hour() < 23;
      ensurePorter(nearDoor);
      if (cardMesh) { const on = !flags().radBodCard && outdoors && Math.hypot(wp.x - cardAt[0], wp.z - cardAt[1]) < 30; if (cardMesh.visible !== on) cardMesh.visible = on; }
      photoTick(dt, wp, outdoors);
      tourTick(dt);
      procTick(dt, wp, outdoors);
    },
    stats: () => ({ porter: !!porter, photoPeds: S.photoPeds.length, bombs: S.bombs, tour: S.tour ? { stop: S.tour.stop, t: S.tour.t } : null, proc: S.proc ? { t: S.proc.t, chars: S.procChars.filter((c) => c.ch.group.visible).length } : null, card: !!flags().radBodCard }),
    debugCard(on) { S.debugCard = !!on; },
    readingPlan: () => plan, readingDoor: () => S.door || null,
    /** hold the procession at t seconds (screenshots); null = follow the clock */
    debugProc(t) { S.forceProc = t; return t; },
    startTour, endTour: () => endTour(false), tour: () => S.tour,
    PHOTO, inFrame,
  };
}
