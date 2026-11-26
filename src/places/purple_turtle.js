// The Purple Turtle (c. 2013): the student club in the Oxford Union's old cellars, down from Frewin Court off Cornmarket.
// Open 21:30–03:00 game time. Exterior in place (_pt_exterior.js), people outside (_pt_street.js: bouncers, queue,
// smokers, kebab van, leavers, couples walking home, street vignettes), the cellars (_pt_interior.js + _pt_crowd.js),
// table football and the menus (_pt_games.js), sound (_pt_audio.js), rules (_pt_logic.js), routes (_pt_routes.js).
// A night out — tonight's invented club-goers, catching an eye, talking, the bar, dancing on the beat, a rival and a
// scrap, and walking someone home: _pt_social.js, _pt_scrap.js, _pt_walkhome.js (rules: _pt_social_logic.js); the
// lighting rig and the glow afterwards: _pt_fx.js. All of it with the ordinary controls: nothing takes them away.
//
// Test hooks: game.pt = { enter(), setHour(h|null), setCrowd(0..1|null), queue(n|null), coupleNow({dest, chips, hold, skip}),
//   where(id), dance({auto}), foos({auto}), conga(), closeNow(bool), friends([ids]|null), list(), schedule(n?), stats(),
//   view(x,y,z,tx,ty,tz,fov), drink(kind, opts), state(),
//   people(), night(), auto({look, dance, bar, scrap, walk}), strip(), choose(i), tap(dir, off), court(key, {spark, …}),
//   approach(key), give(kind), offer(key), danceWith(key), invite(key), provoke(reason, fault), fight(aggressor), eject(),
//   walkHome(key), walkState(), walkSkip(s, back), love(), rig() }
import * as THREE from 'three';
import * as Lg from './_pt_logic.js';
import { ALLEY } from './_pt_routes.js';
import { buildExterior, tickExterior, BLD_ID } from './_pt_exterior.js';
import { buildInterior, LAY, groundAt } from './_pt_interior.js';
import { PTAudio } from './_pt_audio.js';
import { createStreet } from './_pt_street.js';
import { createCrowd } from './_pt_crowd.js';
import { createGames } from './_pt_games.js';
import { planWalkin, cityDoor, warmLater, roomCrowd } from './_walkin_city.js';
import { clubLook, CLUB_LINES } from './_pt_chars.js';
import * as So from './_pt_social_logic.js';
import { createSocial, createStrip } from './_pt_social.js';
import { createScrap } from './_pt_scrap.js';
import { createWalkHome } from './_pt_walkhome.js';
import { createRig, createLove } from './_pt_fx.js';

const ID = 'purple_turtle';
const FRIEND_LINES = ['Fancy seeing you here!', 'Shots? SHOTS.', 'This is my song!', "Have you tried your college's shot?", 'Turtle! Turtle! Turtle!'];

export default {
  id: ID,
  preMap(game) {
    game.overrides.skip.add(BLD_ID);              // rebuilt by hand with the club's doorway and the Union passage
    game.overrides.skip.add('n5424554834');       // "Plush" (the club here from 2019) — it's 2013
    game.overrides.skip.add('w1366639563');       // Plush's outdoor steps (the descent is inside our doorway)
  },
  install(game) {
    const P = ALLEY.P, doorPt = P(ALLEY.door[0], ALLEY.door[1]);
    const audio = new PTAudio(game);
    const pt = (game.pt = { id: ID, audio, hourOverride: null, densityOverride: null, forceLights: null, forcedFriends: null, crowd: null });
    let ext = null, street = null;
    try { ext = buildExterior(game); street = createStreet(game, ext, audio); } catch (e) { console.error('[purple_turtle] exterior', e); }
    // smoothness: the street's destinations and tonight's routes are worked out on the loading screen (world/prewarm.js)
    (game.warmups || (game.warmups = [])).push({ id: ID, fn: () => street && street.warm(Tnow()) });
    let people = null; import('./_people.js').then((m) => { people = m; }).catch(() => {});
    const strip = createStrip(game), love = createLove(game);
    let walk = null, social = null, scrap = null, rig = null;
    try { if (street) walk = pt.walk = createWalkHome(game, pt, street, audio, strip, love); } catch (e) { console.error('[purple_turtle] walk home', e); }
    const barred = () => !!(game.state.flags && game.state.flags.ptBarred === Lg.nightIndex(Tnow()));
    const BARRED = () => { game.ui.toast(`Bouncer: "${So.PROVOKE.bouncer.barred}"`, 4); };

    // ------------------------------------------------------------------ clock
    let pin = null;
    const hourNow = () => (pt.hourOverride !== null ? pt.hourOverride : game.time.hour);
    const Tnow = () => {
      if (pt.frozenT !== null && pt.frozenT !== undefined) return pt.frozenT;
      const now = game.time.now(), h = pt.hourOverride !== null ? pt.hourOverride : game.time.pinned;
      if (h === null || h === undefined) { pin = null; return now; }
      if (!pin || pin.h !== h) pin = { h, real: now, base: Math.floor(now / Lg.DAY_MS) * Lg.DAY_MS + h * Lg.HOUR_MS };
      return pin.base + (now - pin.real);
    };
    pt.college = () => game.state.college || 'Worcester';
    const stampedTonight = () => game.state.flags && game.state.flags.ptStamp === Lg.nightIndex(Tnow());

    // ------------------------------------------------------------------ the door
    const DOOR = { pos: P(1.8, 0.2), facing: ALLEY.hOut, from: 'world' };
    const enter = () => game.interiors.enter(ID, DOOR);
    // ---- walk-in (core/interiors.js "seamless"; _walkin_city.js). The cellars are BELOW GROUND (`under`): the street
    // doorway is at the back of the niche in Frewin Court, at pavement level, and opens on the head of the real stair
    // (LAY.stair: 15 steps down, 3.0 m). The doorway's plane is 2 cm behind the niche's back (ALLEY.nicheDepth), so the
    // opening is cut just in front of the painted stair and behind the exterior's own double doors (_pt_exterior.js),
    // which stay the doors you see: they swing out when the way is open. The way through is an (unseen) core door on the
    // portal: locked out of hours, and until the bouncers have stamped your hand — walking up to the door IS asking them.
    let plan = null, coreDoor = null, askAfter = 0;      // askAfter: shared-clock ms before which the bouncers are not asked again
    try {
      const SD = LAY.streetDoor;
      plan = planWalkin(game, { id: ID, building: null, snap: false, under: true, wall: 0.02, door: { pos: P(1.8, ALLEY.nicheDepth), facing: ALLEY.hOut },
        portal: { at: [LAY.stair.xe, SD.z], out: Math.PI / 2, w: SD.w, h: SD.h, y: LAY.stair.top }, rects: [], center: [LAY.stair.xe, SD.z],
        mid: [5.6, -2.2], route: [[12.0, -3.3], [8.6, -3.3]],
        hours: { open: () => wayOpen(), testOpen: 23, testShut: 14 },
        testPrep: () => { game.state.flags = game.state.flags || {}; game.state.flags.ptStamp = Lg.nightIndex(Tnow()); } });      // (the generic walk test: tonight's stamp, so the queue rule does not turn it away)
    } catch (e) { console.error('[purple_turtle] walk-in plan', e); plan = null; }
    const WALKIN = () => !!(ptDef && ptDef.sl);
    let ptDef = null;
    /** the bouncers, without the fade (walk-in): the same check as doorUse; true = stamped, the door will open */
    function bouncers(fromQueue = false) {
      const h = hourNow(); if (!Lg.isOpen(h)) return false;
      if (barred()) { BARRED(); askAfter = game.time.now() + 12000; return false; }
      const st = street && street.queue;
      if (!fromQueue && !stampedTonight() && st && st.Q >= 3) { game.ui.toast('Bouncer: "Back of the queue, mate." (join it at the end of the rope)', 4); askAfter = game.time.now() + 6000; return false; }
      const r = Lg.doorCheck({ hour: h, drunk: game.player.drunk || 0, stamped: stampedTonight(), money: game.state.money });
      // (the night after you walked someone home, the door staff have not forgotten)
      const sw = game.state.ptSweet; if (r.ok && sw && sw.night === Lg.nightIndex(Tnow()) - 1 && !sw.teased) { sw.teased = true; r.lines = [...r.lines, 'Saw you leave with someone last night. Behave yourself.']; }
      try { const d = game.ui.dialog('Bouncer', r.lines); if (d && d.catch) d.catch(() => {}); } catch { /* headless */ }
      if (!r.ok) { askAfter = game.time.now() + 10000; return false; }
      if (r.fee && !game.pay(-r.fee)) { game.ui.toast("You can't afford the £3.", 3); askAfter = game.time.now() + 10000; return false; }
      if (r.reason !== 'stamp') { game.state.flags = game.state.flags || {}; game.state.flags.ptStamp = Lg.nightIndex(Tnow()); game.save && game.save(); audio.stamp(); game.ui.toast(r.fee ? '£3 — hand stamped (purple turtle).' : 'Free entry — hand stamped.', 3); }
      if (street) street.doorPulse = 2;
      audio.door();
      return true;
    }
    let okUntil = 0;
    /** is the street door unlocked for the local player right now? (called every frame the room is shown) */
    function wayOpen() {
      const h = hourNow(), pl = game.player;
      if (pl.place === ID) return true;                                   // nobody is ever locked IN
      if (!Lg.isOpen(h)) return false;
      const now = game.time.now();
      if (now < okUntil) return true;
      // walking up to the door, on foot: the bouncers look you over (once; again after a pause if they said no)
      // (not as you come out: the bouncers have nothing to ask someone leaving)
      if (now - (pt._insideAt || 0) < 9000) return true;
      if (pl.place === 'world' && !pl.vehicle && !game.activity && now >= askAfter) {
        const dx = pl.pos.x - A0[0], dz = pl.pos.z - A0[1], u = dx * UX[0] + dz * UX[1], v = dx * VY[0] + dz * VY[1];
        if (Math.abs(u - 1.8) < 1.1 && v > -1.7 && v < ALLEY.nicheDepth) { if (bouncers(false)) okUntil = now + 20000; else return false; return true; }
      }
      return false;
    }
    const A0 = P(0, 0), UX = [P(1, 0)[0] - A0[0], P(1, 0)[1] - A0[1]], VY = [P(0, 1)[0] - A0[0], P(0, 1)[1] - A0[1]];
    async function doorUse(fromQueue = false) {
      const h = hourNow();
      if (!Lg.isOpen(h)) { game.ui.toast('CLOSED — the Purple Turtle opens at 9.30pm (till 3am).', 4); return; }
      if (barred()) { BARRED(); return; }
      const st = street && street.queue;
      if (!fromQueue && !stampedTonight() && st && st.Q >= 3) { game.ui.toast('Bouncer: "Back of the queue, mate." (join it at the end of the rope)', 4); return; }
      const r = Lg.doorCheck({ hour: h, drunk: game.player.drunk || 0, stamped: stampedTonight(), money: game.state.money });
      await game.ui.dialog('Bouncer', r.lines);
      if (!r.ok) return;
      if (r.fee && !game.pay(-r.fee)) { game.ui.toast("You can't afford the £3.", 3); return; }
      if (r.reason !== 'stamp') { game.state.flags = game.state.flags || {}; game.state.flags.ptStamp = Lg.nightIndex(Tnow()); game.save && game.save(); audio.stamp(); game.ui.toast(r.fee ? '£3 — hand stamped (purple turtle).' : 'Free entry — hand stamped.', 3); }
      if (street) street.doorPulse = 2;
      audio.door(); enter();
    }
    game.interact.add({ place: 'world', pos: P(1.8, -0.55), radius: 1.5, enabled: () => !WALKIN(),      // (walk-in: no prompt — you walk at the door)
      label: () => (Lg.isOpen(hourNow()) ? (stampedTonight() ? 'Show your stamp and go back in' : 'Go in (the bouncers will check)') : 'The Purple Turtle — closed'), onUse: () => doorUse(false) });
    // join the queue at the end of the rope
    const tailPos = new THREE.Vector3();
    game.interact.add({ place: 'world', radius: 1.6,
      pos: () => { const Q = street && street.queue ? street.queue.Q : 0, p = street ? street.slotPos(Q + 0.3) : doorPt; tailPos.set(p[0], 0, p[1]); return tailPos; },
      enabled: () => !!(street && street.queue && street.queue.Q >= 3 && !stampedTonight() && Lg.isOpen(hourNow())),
      label: () => `Join the queue (${street.queue.Q} ahead)`, onUse: joinQueue });
    function joinQueue() {
      const q = street.queue; street.playerJoin = q.f + q.Q;
      game.beginActivity({
        name: 'pt-queue', pointer: 'locked', hint: 'Queueing for the Turtle… it shuffles forward one at a time',
        update: (dt) => {
          const f = Math.floor(Tnow() / Lg.ADMIT_MS), slot = street.playerJoin - f, p = game.player;
          if (slot < 0) { game.endActivity(); if (WALKIN()) { if (bouncers(true)) okUntil = game.time.now() + 30000; } else doorUse(true); return; }
          const sp = street.slotPos(slot), dx = sp[0] - p.pos.x, dz = sp[1] - p.pos.z, d = Math.hypot(dx, dz);
          if (d > 0.05) { const s = Math.min(d, 1.1 * dt); p.pos.x += (dx / d) * s; p.pos.z += (dz / d) * s; p.heading = Math.atan2(dx, dz); p.syncMesh(); }
          else p.heading += Math.atan2(Math.sin(ALLEY.hU + Math.PI - p.heading), Math.cos(ALLEY.hU + Math.PI - p.heading)) * Math.min(1, dt * 4);
        },
        onEnd: () => { street.playerJoin = null; },
      });
    }

    // ------------------------------------------------------------------ the club
    let room = null, crowd = null, games = null, built = false, hemi = null, amb = null;
    const IL = (o) => game.interact.add({ place: ID, ...o });
    let cup = null, cupT = 0;
    const carry = (k) => { try { if (game.net && game.net.setCarried) game.net.setCarried(k); } catch { /* */ } };      // (what the other players see in our hand: core/_mp_actions.js)
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xe8eef2, transparent: true, opacity: 0.35, roughness: 0.15, depthWrite: false });
    /** a glass of something (kind = a DRINKS key), to put in a hand */
    pt.makeCup = (kind, liquid = null) => {
      const d = Lg.DRINKS[kind] || Lg.DRINKS.pint, shot = d.kind === 'shot', g = new THREE.Group(), hgt = shot ? 0.06 : d.kind === 'pint' ? 0.15 : 0.11, r = shot ? 0.022 : 0.04;
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, hgt, 10, 1, true).translate(0, hgt / 2, 0), cupMat));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.8, hgt * 0.75, 10).translate(0, hgt * 0.38, 0), new THREE.MeshStandardMaterial({ color: liquid ?? d.liquid, roughness: 0.3, transparent: true, opacity: 0.9 })));
      g.rotation.x = Math.PI / 2; g.position.set(0, 0.02, -0.06);
      return g;
    };
    pt.drink = (kind = 'pint', o = {}) => {
      const d = Lg.DRINKS[kind]; if (!d) return false;
      if (d.price && !game.pay(-d.price)) { game.ui.toast(`You can't afford ${d.name} (£${d.price.toFixed(2)}).`, 3); return false; }
      const p = game.player; p.drunk = Math.max(0, Math.min(1, (p.drunk || 0) + d.drunk));
      if (cup) { cup.removeFromParent(); cup = null; carry(null); }
      const shot = kind === 'shot', g = new THREE.Group(), hgt = shot ? 0.06 : d.kind === 'pint' ? 0.15 : 0.11, r = shot ? 0.022 : 0.04;
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, hgt, 10, 1, true).translate(0, hgt / 2, 0), cupMat));
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.8, hgt * 0.75, 10).translate(0, hgt * 0.38, 0), new THREE.MeshStandardMaterial({ color: shot && o.shot ? o.shot.color : d.liquid, roughness: 0.3, transparent: true, opacity: 0.9 }));
      g.add(liq); g.rotation.x = Math.PI / 2; g.position.set(0, 0.02, -0.06); p.character.anchors.handR.add(g); cup = g; cupT = shot ? 2.5 : 30; if (!shot) carry('pint');
      audio.coin();
      const msg = shot && o.shot ? `${o.hat ? 'The Sorting Hat says… ' : ''}${o.shot.college}: "${o.shot.name}" — ${o.shot.recipe} Down in one!` : `${d.name[0].toUpperCase() + d.name.slice(1)}${d.price ? ` — £${d.price.toFixed(2)}` : ''}`;
      game.ui.toast(msg, 4);
      return true;
    };
    function sit(sofa) {
      const p = game.player, s = sofa === 'A' ? { x: LAY.sofaA.x + 0.6, z: LAY.sofaA.z - 0.12, h: Math.PI } : { x: LAY.sofaB.x + 0.12, z: LAY.sofaB.z + 0.45, h: Math.PI / 2 };
      p.teleport(s.x, s.z, s.h); p.pose = 'sit';
      game.beginActivity({ name: 'pt-sit', pointer: 'locked', hint: 'Having a sit-down (sobers you up a little)',
        update: (dt) => { p.pos.x = s.x; p.pos.z = s.z; p.heading = s.h; p.syncMesh(); p.drunk = Math.max(0, (p.drunk || 0) - Lg.SIT_SOBER_PER_S * dt); },
        onEnd: () => { p.pose = 'stand'; p.teleport(s.x + Math.sin(s.h) * 0.75, s.z + Math.cos(s.h) * 0.75, s.h); } });
    }
    ptDef = game.interiors.register({
      id: ID, name: 'The Purple Turtle', doors: [], background: 0x050307, ambient: 0.16,
      seamless: plan ? plan.seamless : null,
      build(ctx) {
        room = buildInterior(ctx.scene, ctx.collider, game, { walkin: !!ctx.seamless }); const out0 = room;
        if (ctx.seamless) {
          // the way through: an automatic pair with no leaves to see (the doors you see are the exterior's)
          coreDoor = pt.coreDoor = cityDoor(ctx, plan, { kind: 'slide', open: plan.hours.open, rangeOut: 2.3, rangeIn: 2.2, hold: 1.4, setBack: 0 });
          if (coreDoor) {      // (nothing of it is ever seen: the group, its leaves wherever they hang, and the "Closed" card)
            const hide = (o) => { if (!o) return; o.visible = false; o.traverse((q) => { if (q.isMesh) { q.visible = false; q.layers.disableAll(); } }); };
            hide(coreDoor.group); for (const l of coreDoor.leaves || []) hide(l);
            if (coreDoor.sign) coreDoor.sign.visible = true;      // (its meshes are hidden above; the card's own on / off state is still the door's — the card you see is the exterior's)
          }
        }
        ctx.setGround(groundAt);
        ctx.addExit(LAY.exit[0], LAY.exit[1], 'Up the stairs to Frewin Court');
        for (const o of ctx.scene.children) { if (o.isHemisphereLight) { hemi = o; o.intensity = 0.26; } if (o.isAmbientLight) amb = o; }
        crowd = pt.crowd = createCrowd(game, ctx.scene, room, audio);
        games = pt.games = createGames(game, pt);
        const openNow = () => Lg.isOpen(hourNow()) && !pt.lightsUp;
        // (drinks are ordered from the bar staff by catching their eye — _pt_social.js; the board is the college shots)
        IL({ pos: [out0.menuAt[0], LAY.bar.front + 0.45], radius: 1.0, label: 'The shots board (a shot for every college, £1.50)', onUse: () => games.barMenu(), enabled: () => openNow() && !strip.open });
        try {
          rig = pt.rigFx = createRig(game, ctx.scene, room, audio);
          social = pt.social = createSocial(game, pt, ctx.scene, ctx.collider, audio, strip);
          scrap = pt.scrap = createScrap(game, pt, ctx.scene, ctx.collider, audio, strip, social);
        } catch (e) { console.error('[purple_turtle] night out', e); }
        IL({ pos: [LAY.foos.x - 1.1, LAY.foos.z], radius: 1.2, label: 'Play table football', onUse: () => games.startFoos() });
        IL({ pos: [LAY.jukebox.x - 0.75, LAY.jukebox.z], radius: 1.1, label: () => `Jukebox — £1 a song (now: "${audio.T.name}")`, onUse: () => games.jukebox() });
        IL({ pos: [LAY.sofaA.x + 0.6, LAY.sofaA.z - 0.7], radius: 0.9, label: 'Sit down', onUse: () => sit('A') });
        IL({ pos: [LAY.sofaB.x + 0.8, LAY.sofaB.z + 0.45], radius: 0.9, label: 'Sit down', onUse: () => sit('B') });
        const LOO = ['Occupied!', '"Two minutes!" (it is never two minutes)', "There's a queue. Obviously.", 'Someone is crying happy tears about a formal. You back away.'];
        IL({ pos: [LAY.toilets.x, LAY.corr.za + 0.5], radius: 0.9, label: 'Ladies', onUse: () => game.ui.toast(LOO[Math.floor(Math.random() * LOO.length)], 3) });
        IL({ pos: [LAY.toilets.x, LAY.corr.zb - 0.5], radius: 0.9, label: 'Gents', onUse: () => game.ui.toast(['Occupied!', 'The hand dryer does nothing. Classic.', 'Sticky floor. Stickier in here.'][Math.floor(Math.random() * 3)], 3) });
        IL({ pos: [7.1, LAY.R1.za + 0.7], radius: 1.0, label: 'Cloakroom (£1)', onUse: () => { if (game.player.look && game.player.look.jacket) { if (game.pay(-1)) game.ui.toast("Coat in. Ticket 147 — don't lose it.", 3); } else game.ui.toast('"No coat? Brave." — the cloakroom', 3); } });
        IL({ pos: [LAY.cash.x, LAY.cash.z - 0.6], radius: 1.0, label: 'Pay desk', onUse: () => game.ui.toast(stampedTonight() ? 'You show your stamp. "Have a good one!"' : '"Stamp? Bouncers do that upstairs."', 3) });
        built = true;
        return { spawn: LAY.spawn, heading: LAY.spawnH };
      },
      update(dt) { stairCrowd.tick(dt); },
      updateShown(dt) { stairCrowd.tick(dt); },
      onEnter() { audio.setMode('inside'); if (street) street.doorPulse = 2; game.ui.toast('Mind your head!', 2); if (rig) rig.enter(true); else pt._dark = true; },
      onExit() { try { if (scrap) scrap.leave(); if (social) social.leave(); } catch (e) { console.error(e); } if (cup) { cup.removeFromParent(); cup = null; carry(null); } if (game.activity && /^pt-/.test(game.activity.name)) game.endActivity(); audio.setMode('off'); if (street) street.doorPulse = 2; },
    });

    // the two you see from Frewin Court, down the stair through the open doors: the tail of the cloakroom queue at the
    // stair foot. There whenever the cellar is SHOWN and the club is open (the rest of the crowd — _pt_crowd.js — is
    // made when you are inside: nothing else of the cellar can be seen from the street).
    const stairCrowd = roomCrowd(game, ID, {
      cap: 2, signature: () => (Lg.isOpen(hourNow()) && !pt.lightsUp ? 'open' + Lg.nightIndex(Tnow()) : 'shut'),
      populate(spawn) {
        if (!Lg.isOpen(hourNow()) || pt.lightsUp) return;
        const n = Lg.nightIndex(Tnow());
        spawn(7.1, -4.15, clubLook(5100 + (n % 9), 0.3, { prop: null }), { heading: Math.PI, pose: 'stand', lines: CLUB_LINES });
        spawn(6.4, -3.95, clubLook(5200 + (n % 7), 0.3, { prop: null }), { heading: 2.3, pose: 'talk', lines: CLUB_LINES });
      },
    });
    // ------------------------------------------------------------------ interior effects
    const tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), yUp = new THREE.Vector3(0, 1, 0), tmpC = new THREE.Color();
    let lightsWere = false, closeT = 0, stepT = 0;
    function effects(dt, st) {
      if (rig) { if (pt._dark) { pt._dark = false; rig.enter(true); } rig.update(dt, st, hemi, amb); return; }
      const R = room, t = game.elapsed, L = R.lights, up = st.lightsUp, beat = audio.beatPhase, pulse = up ? 0 : 0.55 + 0.45 * Math.exp(-beat * 5);
      if (up !== lightsWere) {
        lightsWere = up;
        for (const k in L) { L[k].color.setHex(up ? 0xfff4e8 : L[k].userData.color); L[k].intensity = L[k].userData.base * (up ? 2.2 : 1); }
        if (hemi) hemi.intensity = up ? 0.7 : 0.26; if (amb) amb.intensity = up ? 0.6 : 0.16;
        R.pools.visible = R.beams.visible = R.haze.visible = R.dots.visible = !up;
      }
      if (!up) {
        const hue = (t * 0.06) % 1;
        L.dance.color.setHSL((hue + 0.8) % 1, 0.9, 0.55); L.dance.intensity = L.dance.userData.base * pulse * (0.4 + 0.6 * st.density + 0.3);
        L.back.intensity = L.back.userData.base * (0.85 + 0.15 * Math.sin(t * 0.7));
        // moving floor spots + beams from the cans
        const F = LAY.floor;
        for (let i = 0; i < 5; i++) {
          const x = (F.x0 + F.x1) / 2 + Math.sin(t * (0.5 + i * 0.13) + i * 1.7) * (F.x1 - F.x0) * 0.42, z = (F.z0 + F.z1) / 2 + Math.cos(t * (0.4 + i * 0.11) + i) * (F.z1 - F.z0) * 0.4;
          tmpV.set(x, 0.02, z); tmpQ.identity(); tmpS.set(1, 1, 1); tmpM.compose(tmpV, tmpQ, tmpS); R.pools.setMatrixAt(i, tmpM);
          const c = R.cans[i], dx = x - c[0], dy = 0 - c[1], dz = z - c[2], len = Math.hypot(dx, dy, dz);
          tmpV.set(-dx / len, -dy / len, -dz / len); tmpQ.setFromUnitVectors(yUp, tmpV);
          tmpS.set(1, len, 1); tmpV.set((c[0] + x) / 2, c[1] / 2, (c[2] + z) / 2); tmpM.compose(tmpV, tmpQ, tmpS); R.beams.setMatrixAt(i, tmpM);
          const on = ((Math.floor(audio.beatIndex / 2) + i) % 5) !== 0;
          R.pools.setColorAt(i, tmpC.setHex(R.pal[(i + Math.floor(audio.beatIndex / 4)) % R.pal.length]).multiplyScalar(on ? 0.9 * pulse : 0.05));
          R.beams.setColorAt(i, tmpC.setHex(R.pal[(i + Math.floor(audio.beatIndex / 4)) % R.pal.length]).multiplyScalar(on ? 1 : 0.05));
        }
        R.pools.instanceMatrix.needsUpdate = R.beams.instanceMatrix.needsUpdate = true; R.pools.instanceColor.needsUpdate = R.beams.instanceColor.needsUpdate = true;
        // haze billboards
        const cq = game.camera.quaternion;
        R.hazePos.forEach((p, i) => { tmpV.set(p[0] + Math.sin(t * 0.13 + i) * 0.5, p[1], p[2] + Math.cos(t * 0.11 + i) * 0.3); tmpS.set(1 + 0.2 * Math.sin(t * 0.2 + i), 1, 1); tmpM.compose(tmpV, cq, tmpS); R.haze.setMatrixAt(i, tmpM); });
        R.haze.instanceMatrix.needsUpdate = true; R.haze.material.opacity = 0.05 + 0.05 * st.density;
        // mirror ball
        R.ball.rotation.y = t * 0.6;
        const D = R.ballDirs, pos = R.dots.geometry.attributes.position, [bx, by, bz] = LAY.ball, ca = Math.cos(t * 0.6), sa = Math.sin(t * 0.6), r2 = LAY.R2;
        for (let i = 0; i < D.length / 3; i++) {
          const dx = D[i * 3] * ca + D[i * 3 + 2] * sa, dy = D[i * 3 + 1], dz = -D[i * 3] * sa + D[i * 3 + 2] * ca;
          let tt = -by / dy;
          if (dx > 0) tt = Math.min(tt, (LAY.X1 - bx) / dx); else if (dx < 0) tt = Math.min(tt, (LAY.X0 - bx) / dx);
          if (dz > 0) tt = Math.min(tt, (r2.zb - 0.02 - bz) / dz); else if (dz < 0) tt = Math.min(tt, (r2.za + 0.02 - bz) / dz);
          pos.setXYZ(i, bx + dx * tt, Math.max(0.02, by + dy * tt), bz + dz * tt);
        }
        pos.needsUpdate = true;
      } else { L.dance.intensity = L.dance.userData.base * 2.2; }
    }

    // ------------------------------------------------------------------ friends who are "in town"
    let friendsT = 0, friendsHere = [];
    function friendsTonight(st) {
      if ((friendsT -= 1) > 0) return friendsHere; friendsT = 120;
      const out = [];
      if (!people || !st.open || st.nh < 1) return (friendsHere = out);
      const me = people.personOf ? people.personOf(game.player.look, game.player.name) : null;
      const ids = pt.forcedFriends || (people.FRIEND_IDS || []).filter((id) => { try { const w = game.friends && game.friends.whereIs && game.friends.whereIs(id); return w && w.spot === 'town' && !w.taken; } catch { return false; } });
      for (const id of ids) {
        const P0 = people.PEOPLE[id]; if (!P0 || P0.kind !== 'friend' || id === me) continue;
        out.push({ id, label: P0.label || P0.name, look: () => people.lookFor(id), lines: FRIEND_LINES });
      }
      return (friendsHere = out);
    }

    // ------------------------------------------------------------------ test hooks
    pt.enter = async () => { await enter(); return 'ok'; };
    pt.setHour = (h) => { pt.hourOverride = h; pin = null; friendsT = 0; return h; };
    pt.setCrowd = (d) => { pt.densityOverride = d; return d; };
    pt.queue = (n) => { if (street) street.forcedQueue = n; return n; };
    pt.coupleNow = (o = {}) => (street ? street.coupleNow(Tnow(), o) : null);
    pt.where = (id) => (street ? street.where(id) : null);
    pt.dance = (o = {}) => { if (!games) return 'enter first'; games.startDance(o); return 'ok'; };
    pt.foos = (o = {}) => { if (!games) return 'enter first'; games.startFoos(o); return 'ok'; };
    /** freeze the club clock (screenshots: hold a moment of the schedule still); skip = seconds to add */
    pt.freeze = (on = true, skip = 0) => { pt.frozenT = null; pt.frozenT = on ? Tnow() + skip * 1000 : null; return pt.frozenT; };
    /** screenshots: show only forced couples (hide the scheduled leavers) */
    pt.onlyForced = (on = true) => { if (street) street.onlyForced = on; return on; };
    pt.conga = () => { pt._conga = true; return 'conga'; };
    pt.closeNow = (on = true) => { pt.forceLights = on === null ? null : !!on; return pt.forceLights; };
    pt.friends = (ids) => { pt.forcedFriends = ids; friendsT = 0; return ids; };
    pt.list = () => (game.player.place === ID ? (crowd ? crowd.list() : []) : street ? street.list() : []);
    pt.schedule = (n) => {
      const N = n ?? Lg.nightIndex(Tnow()), D = street ? street.destinations() : [];
      return Lg.leaversForNight(N, Math.max(1, D.length)).map((e) => `${Lg.clockStr(e.h)} ${e.kind}${e.couple ? ` (${e.hold === 'arm' ? 'arm in arm' : 'holding hands'})` : ''}${e.chips ? ' + cheesy chips' : ''} → ${D[e.dest] ? D[e.dest].name : '?'}`);
    };
    pt.plan = () => plan; pt.bouncers = bouncers;
    // ---- a night out (test hooks; all need you to be in the club unless they say otherwise)
    pt.people = () => (social ? social.list() : []);
    pt.night = () => ({ social: social ? { sex: social.sex, partner: social.partner ? social.partner.key : null, talking: social.talk ? social.talk.A.key : null, leaving: social.leaving ? social.leaving.key : null, dance: { active: social.dance.active, streak: social.dance.streak, best: social.dance.best, groove: +social.dance.groove.toFixed(2) },
      bar: { a: +social.bar.a.toFixed(2), need: social.bar.need, serving: !!social.bar.serving }, cup: social.cup ? social.cup.kind : null, gift: social.gift ? social.gift.kind : null, lastGlance: social.lastGlance, lastApproach: social.lastApproach, lastTalk: social.lastTalk, lastOffer: social.lastOffer, lastSpill: social.lastSpill, lastOrder: social.lastOrder } : null,
      scrap: scrap ? scrap.state() : null, walk: walk ? walk.state() : null, love: love.state(), strip: strip.open ? { tag: strip.tag, options: strip.options() } : null, money: game.state.money, drunk: +(game.player.drunk || 0).toFixed(2), beat: +audio.beatFloat.toFixed(2), light: rig ? rig.mode : null });
    pt.auto = (o) => (social ? Object.assign(social.auto, o || {}) : null);
    pt.strip = () => (strip.open ? { tag: strip.tag, options: strip.options() } : null);
    pt.choose = (i) => strip.pick(i);
    pt.tap = (dir, off) => (social ? social.tap(dir, off) : null);
    pt.court = (key, o) => { const A = social && social.get(key); if (!A) return null; Object.assign(A.C, o || {}); if (A.C.met) A.ch.setLabel(A.P.name); return { ...A.C }; };
    pt.approach = (key) => social && social.approach(key);
    pt.give = (kind = 'pint') => { if (social) social.takeGift(kind); return kind; };
    pt.hold = (kind = 'pint') => { if (social) social.takeCup(kind); return kind; };
    pt.offer = (key) => social && social.offer(key);
    pt.danceWith = (key) => social && social.startDance(key);
    pt.invite = (key) => { const A = social && social.get(key); if (A) social.invite_(A, st); return !!A; };
    pt.provoke = (reason = 'spill', fault = 'me') => scrap && scrap.provoke(reason, fault);
    pt.fight = (aggressor = 'him') => scrap && scrap.startFight(aggressor);
    pt.eject = () => scrap && scrap.eject();
    /** from anywhere: one of tonight's people sets off home from the club door, leading you */
    pt.walkHome = (key = null, spark = 90) => { if (!walk) return null; const n = Lg.nightIndex(Tnow()), sex = key ? key[0] : 'f', L0 = So.personasFor(n, sex), P = key ? L0[+key[1] || 0] : L0.find((p) => p.mood === 'open'); const C = So.newCourt(); C.spark = spark; if (street) street.doorPulse = 3; return walk.begin(P, C, null, null); };
    pt.walkState = () => (walk ? walk.state() : null);
    pt.walkSkip = (s, back = null) => (walk ? walk.skip(s, back) : null);
    pt.love = (kind) => { if (kind) love.love(kind, So.personasFor(Lg.nightIndex(Tnow()), 'f')[0]); return love.state(); };
    pt.rig = () => (rig ? { mode: rig.mode, adapt: +rig.adapt.toFixed(2), strobe: +rig.strobe.toFixed(2), section: rig.section() } : null);
    try { warmLater(game, ID, { heavy: false }); } catch { /* */ }
    pt.destinations = () => (street ? street.destinations() : []);
    pt.stats = () => { const i = game.renderer.info.render; let lights = 0; game.scene.traverse((o) => { if (o.isLight) lights++; }); return { calls: i.calls, tris: i.triangles, lights, crowd: crowd ? crowd.count() : null, outside: street ? street.list().length : 0 }; };
    pt.view = (x, y, z, tx, ty, tz, fov = 60) => { game.beginActivity({ name: 'pt-view', pointer: 'free', camera(dt, cam) { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); }, onEnd() { game.camera.fov = 60; game.camera.updateProjectionMatrix(); } }); return 'ok'; };

    // ------------------------------------------------------------------ per frame
    const st = { T: 0, hour: 0, nh: 0, open: false, density: 0, state: 0, night: 0, nearClub: false, vanOpen: false, active: false, lightsUp: false, beatPhase: 0, dance: null, friends: [], conga: false, social: false, avoid: null, fight: null };
    const danceSt = { active: false, streak: 0, x: 0, z: 0 }; pt.st = st;
    pt.state = () => ({ hour: +st.hour.toFixed(2), clock: Lg.clockStr(st.hour), open: st.open, density: +st.density.toFixed(2), queue: street && street.queue, lightsUp: st.lightsUp, night: st.night, track: audio.T.name, legend: game.state.legend || 0, drunk: +(game.player.drunk || 0).toFixed(2) });
    return {
      update(dt) {
        const h = hourNow(), T = Tnow(), pl = game.player, inside = pl.place === ID;
        const wp = pl.place === 'world' ? pl.pos : pl.worldPos, dDoor = Math.hypot(wp.x - doorPt[0], wp.z - doorPt[1]);
        st.T = T; st.hour = h; st.nh = Lg.nightHours(h); st.open = Lg.isOpen(h); st.night = Lg.nightIndex(T);
        st.density = pt.densityOverride !== null ? pt.densityOverride : Lg.density(h); st.state = Lg.lookState(h);
        st.nearClub = dDoor < 160; st.vanOpen = st.nh < 6.5 || pt.densityOverride !== null; st.active = st.nh < 7.2 || pt.hourOverride !== null;
        const night = game.time.isNight || st.active;
        // someone you are walking home, and the glow afterwards, wherever you are
        if (walk) walk.update(dt); love.update(dt);
        if (!inside && strip.open && strip.tag !== 'walk' && strip.tag !== 'van') strip.close(); else if (!inside) strip.update(dt);
        if (!inside && dDoor > 250 && !night) { audio.setMode('off'); if (street && !pt._cleared) { street.clear(); pt._cleared = true; } return; }
        pt._cleared = false;
        // closing time: lights up at 03:00 for whoever is inside
        const closing = pt.forceLights !== null ? pt.forceLights : !st.open && st.nh < Lg.NIGHT_LEN + 0.6 && inside;
        if (closing && !st.lightsUp) { st.lightsUp = true; closeT = 0; audio.setLightsUp(true); if (inside) game.ui.toast('Lights up! "Have you got homes to go to?"', 4); }
        if (!closing && st.lightsUp) { st.lightsUp = false; audio.setLightsUp(false); }
        pt.lightsUp = st.lightsUp;
        st.beatPhase = audio.beatPhase; st.beat = audio.beatFloat;   // the track's own beat (shared clock): lights and dancers follow it
        // outside
        if (street && !inside) { try { street.update(dt, st); } catch (e) { if (!street._err) console.error('[purple_turtle] street', e); street._err = true; } }
        // (walk-in: the exterior's double doors follow the real way through as well as the street's comings and goings)
        const coreOpen = coreDoor ? coreDoor.open : 0;
        if (ext) tickExterior(ext, dt, { doorOpen: inside && coreDoor ? coreOpen : Math.max(street ? street.doorOpen : 0, coreOpen), night: game.world ? game.world.night || 0 : 1, clubOpen: st.open, t: game.elapsed });
        // sound
        if (inside) audio.setMode('inside'); else audio.setMode(st.open && dDoor < 90 ? 'outside' : 'off');
        const g = Math.pow(Math.max(0, 1 - dDoor / 90), 2) * (0.25 + 0.75 * (street ? street.doorOpen : 0));
        audio.crowd = st.density; audio.update(dt, g);
        if (!inside || !built) return;
        // inside
        pt._insideAt = game.time.now();
        st.dance = games.dance.active ? games.dance : danceSt; st.friends = friendsTonight(st); st.conga = !!pt._conga; pt._conga = false;
        st.social = !!social; st.fight = null;
        if (social) { try { social.update(dt, st); if (scrap) scrap.update(dt, st); st.avoid = social.avoid; } catch (e) { if (!pt._serr) console.error('[purple_turtle] night out', e); pt._serr = true; } }
        if (!st.lightsUp && st.density > 0.6 && Math.floor(T / 60000) !== pt._congaSlot) { pt._congaSlot = Math.floor(T / 60000); if (Lg.hash('conga', pt._congaSlot) < 0.3) st.conga = true; }
        effects(dt, st);
        crowd.update(dt, st);
        if (st.lightsUp) { closeT += dt; if (closeT > 14 && pt.forceLights === null && !game.activity && !(social && (social.leaving || social.invite))) { closeT = -1e9; game.ui.toast('The bouncers herd everyone up the stairs.', 3); game.interiors.exit(); } }
        // sticky floor
        if (pl.speed > 0.6 && !game.activity) { stepT -= dt * pl.speed; if (stepT <= 0) { stepT = 0.75; audio.step(); } }
        // a drink in hand
        if (cup) {
          cupT -= dt; const bn = pl.character.bones;
          if (!game.activity && pl.character.pose !== 'sit') { const s = cupT < 2.5 && cupT > 1.2 ? Math.sin(((2.5 - cupT) / 1.3) * Math.PI) : 0; bn.armR.rotation.x = -0.25 - 0.4 * s; bn.foreR.rotation.x = -1.35 - 0.9 * s; }
          if (cupT <= 0) { cup.removeFromParent(); cup = null; carry(null); }
        }
      },
    };

  },
};
