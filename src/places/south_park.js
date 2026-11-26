// South Park (Headington Hill side of St Clement's) and its fireworks night — the charity display held there each early
// November with a bonfire and a funfair. See docs/research/east_oxford.md for what is known and what is guessed.
//
//   by day     the park itself: _sp_dress.js (railings, gate piers, the open field, a kickabout and a kite, the skyline
//              that rises as you walk up the park — the ground stays flat, see the note there)
//   one night in seven (game day mod 7 === 5, the friends' day counter), on the shared clock — _sp_show.js:
//              19:30 gates, stewards, funfair, crowd · +30 s bonfire · +45 s the display, 360 real seconds · +480 s gone
//
// Everyone sees and hears the same show at the same moment: every position, colour and timing is a function of
// game.time.now() and the game day; there is no Math.random in anything visible here. Sound is delayed by distance.
// Scenery only: the fire and the firing site are fenced and solid, nothing can be aimed, nobody can be hurt.
//
// Cost (see docs/research/east_oxford.md): nothing of the event exists in the scene unless it is on; beyond NEAR m only
// the display's Points (one draw, thinned) are drawn; within it 12 more draws. Hard particle cap per tier (TIER.cap).
//
// Test hooks: game.southPark = { debugShow(t | null, {freeze}), state(), stats(), programme(), shells(), site, tier }
//   ?fireworks        the evening starts now (as if the gates had just opened)      ?fireworks=120  … 120 s in
import * as THREE from 'three';
import { randomLook } from '../core/characters.js';
import { createFlames, createEmbers } from './_randolph_fx.js';
import { SITE, T, TIER, FAR_FRAC, LOOKAHEAD, DAY_MS, clockAt, programme, levels, buildShow, emitShell, glowAt, soundEvents, crowdSpots, smooth, hash, isFireworksDay } from './_sp_show.js';
import { createStars, createPuffs, createCrowd, createGlow } from './_sp_fx.js';
import { buildEvent } from './_sp_build.js';
import { preMapPark, buildPark } from './_sp_dress.js';
import { SpAudio } from './_sp_audio.js';
import { bucketCoin } from '../systems/_object_audio.js';

const NEAR = 520, NEAR_OUT = 570;
const STEWARD_LINES = ['Evening! Straight through, mind the guy ropes.', 'Display starts at quarter past eight.', 'Keep behind the barriers, please.', 'Bonfire\'s that way, fair\'s to your left.', 'No sparklers past this point, sorry.'];
const COLLECTOR_LINES = ['Anything you can spare for the bucket?', 'It all goes to local charities.', 'Entry\'s free, the bucket isn\'t!', 'Thank you — enjoy the fireworks.'];
const STALL_LINES = ['Every one a winner!', 'Three goes for a pound!', 'Roll up, roll up!', 'Have a go, win a coconut.'];
const VAN_LINES = ['Onions with that?', 'Chips\'ll be two minutes.', 'Doughnuts, hot from the fryer!', 'Tea\'s a pound.'];

export default {
  id: 'south_park',
  preMap(game) { try { preMapPark(game); } catch (e) { console.error('[south_park] preMap', e); } },

  install(game) {
    const W = game.world, scene = game.worldScene, col = game.worldCollider;
    let park = null;
    try { park = buildPark(game); } catch (e) { console.error('[south_park] park', e); }
    const tierName = () => { const l = game.quality && game.quality.level; return TIER[l] ? l : l === 'ultra' ? 'high' : 'medium'; };
    let tier = TIER[tierName()];
    const P = {}, L = { crowd: 0, fair: 0, fire: 0, tau: -1, display: false, phase: 'off' };
    const force = { base: null, freeze: null, day: null };
    try { const q = new URLSearchParams(location.search); if (q.has('fireworks')) { const v = parseFloat(q.get('fireworks')); force.base = game.time.now() - (Number.isFinite(v) ? v : 0) * 1000; } } catch { /* node */ }
    const S = { active: false, near: false, ev: null, crowd: null, crowdCol: [], glow: null, flames: null, embers: null, puffs: null, stars: null, shells: null, shellsDay: null,
      next: 0, pending: [], glowIdx: 0, lastTau: -1e9, sndTau: -1e9, staff: [], staffPlan: null, obstacles: [], inScene: false, starsIn: false, blip: null, noted: {}, tEv: { value: 0 }, bucket: 0 };
    const glowRGB = [0, 0, 0];
    const SA = new SpAudio(game.audio);
    const shared = () => game.time.now();
    const day = () => Math.floor(shared() / DAY_MS);

    function prog() {
      if (force.freeze !== null) { P.day = day(); P.today = true; P.upcoming = false; P.t = force.freeze; P.active = P.t >= 0 && P.t < T.end; P.showDay = force.day ?? P.day; }
      else if (force.base !== null) {
        P.day = day(); P.t = (shared() - force.base) / 1000; P.active = P.t >= 0 && P.t < T.end; P.today = true; P.upcoming = P.t < 0; P.showDay = force.day ?? Math.floor(force.base / DAY_MS);
        if (P.t >= T.end) force.base = null;
      } else programme(shared(), P);
      levels(P.active ? P.t : -1, L);
      return P;
    }

    // ------------------------------------------------------------------------------------- build / show / hide
    // the parts whose size is the tier's (the crowd and its colliders, the embers, the smoke puffs, how many staff):
    // built with the event, and again if the tier has changed by the time it is shown (the event is built on the
    // loading screen now — see the warmup below — and the auto tier can still climb after that)
    function tierParts() {
      const tn = tierName();
      if (S.partsTier === tn) return;
      const again = !!S.partsTier;
      S.partsTier = tn; tier = TIER[tn];
      if (again) { for (const c of S.crowdCol) c.on = false; for (const o of [S.crowd.mesh, S.embers.mesh, S.puffs.mesh]) o.removeFromParent(); }   // (old materials not disposed: the new ones share their programs)
      // the crowd: cut-outs + a small collider each (you shoulder through the aisles, not through people)
      const okSpot = (x, z) => (!park || !park.inPark || park.inPark(x, z)) && col.isFree(x, z, 0.45) && !onPath(x, z);
      const spots = crowdSpots(tier.crowd, okSpot);
      S.crowd = createCrowd(spots);
      S.crowdCol = spots.map((s) => { const c = col.addCircle(s[0], s[1], 0.27, { tag: 'crowd', low: true }); c.on = false; return c; });
      const [bx, bz] = SITE.bonfire;
      S.embers = createEmbers(tn === 'low' ? 40 : 90, S.tEv, [bx, 5, bz], 2.6, 2.6, { wind: [0.25, 0.1] });
      S.puffs = createPuffs(tier.puffs);
      if (S.group) S.group.add(S.crowd.mesh, S.embers.mesh, S.puffs.mesh);
      if (S.plan) S.staffPlan = S.plan.slice(0, tier.staff);
    }
    function ensureEvent() {
      if (S.ev) { if (!S.group.parent) tierParts(); return; }
      const ev = (S.ev = buildEvent(game));
      tierParts();
      const [bx, bz] = SITE.bonfire, [lx, lz] = SITE.launch;
      S.glow = createGlow([[(SITE.crowd[0][0] + lx) / 2 + 20, lz, 250, 0], [bx, bz, 50, 1], ...ev.pools.map(([x, z, r]) => [x, z, r, 2])]);
      // the fire: nine flame cards and a column of sparks (shader-animated, places/_randolph_fx.js)
      const fl = [{ p: [bx, 1.2, bz], w: 6.5, h: 10.5, start: 0.25 }, { p: [bx + 0.4, 5.2, bz - 0.3], w: 3.6, h: 7.5, start: 0.6 }];
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.4; fl.push({ p: [bx + Math.cos(a) * 2.4, 0.5 + (i % 2) * 0.8, bz + Math.sin(a) * 2.4], w: 3.2 + (i % 3) * 0.5, h: 5 + (i % 3), start: i * 0.08 }); }
      S.flames = createFlames(fl, S.tEv, { wind: [0.18, 0.08], seed: 5 });
      S.group = new THREE.Group(); S.group.name = 'southpark:night';
      S.group.add(ev.group, S.crowd.mesh, S.glow.mesh, S.flames.mesh, S.embers.mesh, S.puffs.mesh);
      // who stands where (spawned a few at a time once the evening is under way)
      const plan = [];
      ev.spots.stewards.forEach(([x, z, h], i) => plan.push({ x, z, h, label: 'Steward', lines: STEWARD_LINES, look: { ...randomLook(9100 + i, { outfit: 'casual' }), hivis: 0xd8f030, topStyle: 'jacket', hat: i % 2 ? 'beanie' : null, hatColor: 0x1a1a1a } }));
      if (ev.spots.collector) plan.splice(1, 0, { x: ev.spots.collector[0], z: ev.spots.collector[1], h: ev.spots.collector[2], label: 'Charity collector', lines: COLLECTOR_LINES, bucket: true, look: { ...randomLook(9150, { outfit: 'casual' }), hivis: 0xf07010, topStyle: 'jacket' } });
      ev.spots.vans.forEach(([x, z, h], i) => plan.push({ x, z, h, label: null, lines: VAN_LINES, look: randomLook(9200 + i, { outfit: 'chef' }), solid: false }));
      ev.spots.stalls.forEach(([x, z, h], i) => plan.push({ x, z, h, label: null, lines: STALL_LINES, look: { ...randomLook(9300 + i, { outfit: 'casual' }), apron: 0xb02020 }, solid: false }));
      S.plan = plan; S.staffPlan = plan.slice(0, tier.staff);
    }
    const onPath = (x, z) => { let hit = false; try { W.roadGrid.queryRadius(x, z, 3, (it) => { const dx = it.bx - it.ax, dz = it.bz - it.az, l2 = dx * dx + dz * dz || 1; let t = ((x - it.ax) * dx + (z - it.az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; if (Math.hypot(x - it.ax - dx * t, z - it.az - dz * t) < it.w / 2 + 0.8) { hit = true; return true; } }); } catch { /* */ } return hit; };

    function showEvent(on) {
      if (on === S.inScene) return;
      S.inScene = on;
      if (on) { ensureEvent(); scene.add(S.group); S.group.updateMatrixWorld(true); }
      else if (S.group) scene.remove(S.group);
      if (S.ev) for (const c of S.ev.colliders) c.on = on;
      if (!on) for (const c of S.crowdCol) c.on = false;
      const ped = game.pedestrians;
      if (ped && ped.addObstacle) {
        if (on && S.ev) for (const [x, z, r] of S.ev.obstacles) S.obstacles.push(ped.addObstacle({ x, z, r }));
        else { for (const o of S.obstacles) { try { ped.removeObstacle(o); } catch { /* */ } } S.obstacles.length = 0; }
      }
      if (!on) dismissStaff();
    }
    function dismissStaff() {
      for (const s of S.staff) { try { if (s.bucketMesh) s.bucketMesh.removeFromParent(); game.pedestrians.remove(s.ped); } catch { /* */ } if (s.interact) s.interact.remove(); }
      S.staff.length = 0;
    }
    // the collector's bucket (one geometry and material, made and warm-drawn on the loading screen with the rest)
    let bk = null;
    const bucket = () => bk || (bk = { geo: new THREE.CylinderGeometry(0.13, 0.1, 0.24, 10), mat: new THREE.MeshLambertMaterial({ color: 0xd02020 }) });
    function staffTick() {
      const ped = game.pedestrians; if (!ped || !ped.spawnAt || !S.staffPlan) return;
      if (S.staff.length >= S.staffPlan.length || L.crowd < 0.03) return;
      const q = S.staffPlan[S.staff.length];
      let p = null;
      try { p = ped.spawnAt(q.x, q.z, q.look, { heading: q.h, label: q.label || undefined, lines: q.lines, role: 'townie', knockable: false }); } catch (e) { console.warn('[south_park] staff', e); }
      const rec = { ped: p, interact: null, bucketMesh: null };
      if (p && q.bucket) {
        try { const b = new THREE.Mesh(bucket().geo, bucket().mat); b.position.set(0, -0.2, 0.04); p.character.anchors.handR.add(b); rec.bucketMesh = b; } catch { /* no anchors */ }
        rec.interact = game.interact.add({ place: 'world', pos: [q.x, q.z], radius: 2.4, label: 'Give £1 to the charity bucket', enabled: () => S.inScene,
          onUse: () => {
            if ((game.state.money || 0) < 1) { game.ui.toast('You pat your pockets. Nothing. The collector is very understanding.', 3); return; }
            game.pay(-1); S.bucket++;
            try { bucketCoin(game.audio, { pos: { x: q.x, y: (game.groundHeight ? game.groundHeight(q.x, q.z) : 0) + 0.9, z: q.z, place: 'world' }, gain: 1.6 }); } catch { /* */ }      // (a coin into the bucket: it was two triangle-wave pips)
            game.ui.toast(['£1 in the bucket. "Thank you!"', '£1 more. "You\'re a star."', 'Clink. "That\'s the spirit!"'][S.bucket % 3], 3);
            try { p.character.say && p.character.say('Thank you!', 2); } catch { /* */ }
          } });
      }
      S.staff.push(rec);
    }

    function showStars(on) {
      if (on === S.starsIn) return;
      S.starsIn = on;
      if (on) {
        tier = TIER[tierName()];
        if (!S.stars || S.stars.cap !== tier.cap) { if (S.stars) S.stars.dispose(); S.stars = createStars(tier.cap); }
        S.stars.reset(); scene.add(S.stars.mesh); S.next = -1; S.lastTau = -1e9; S.sndTau = -1e9;
      } else if (S.stars) scene.remove(S.stars.mesh);
    }
    // Loading screen (game.warmups, world/prewarm.js): the whole evening is built now and every material in it drawn
    // once out of sight (world.warmDraw), the display's Points too — it used to be built and added on its first frame,
    // with ~7 programs linking and their pipelines built on the first draws (89 ms; once 694)
    (game.warmups || (game.warmups = [])).push({ id: 'south_park', fn: () => {
      if (!W || !W.warmDraw) return null;
      ensureEvent();
      tier = TIER[tierName()];
      if (!S.stars) S.stars = createStars(tier.cap);
      const o = { prio: 3, id: 'south_park' }, ps = [W.warmDraw(S.group, o), W.warmDraw(S.stars.mesh, o), W.warmDraw(new THREE.Mesh(bucket().geo, bucket().mat), o)].filter(Boolean);
      return ps.length ? Promise.all(ps) : null;
    } });
    function teardown() {
      showStars(false); showEvent(false); SA.stop(); S.active = false; S.near = false;
      if (S.blip && !P.upcoming) { game.ui.removeBlip(S.blip); S.blip = null; }
    }

    // ------------------------------------------------------------------------------------- per frame while it is on
    // a shell is written in two goes — the climb when it is launched, the stars when it bursts — so that a particle
    // only holds a slot of the ring buffer while it is in the air (the cap is a cap on live particles)
    function emit(s, near, part) {
      emitShell(s, near ? tier.frac : Math.min(tier.frac, FAR_FRAC), S.stars.put, part);
      if (part === 1 && near && S.puffs && s.type !== 'comet') {
        S.puffs.add(s.bx, s.by, s.bz, s.tb, 0.26, 30 * s.size, 90 * s.size, s.col[0], s.col[1], s.col[2], 1);
        if (s.i % tier.smokeEvery === 0) S.puffs.add(s.bx, s.by, s.bz, s.tb + 0.06, 15, 20 * s.size, 85 * s.size, s.col[0], s.col[1], s.col[2], 0);
      }
    }
    function frame(dt) {
      // P.t is refreshed on the slow tick; in between follow the shared clock exactly (S.t0ms = when the gates opened)
      const tt = force.freeze !== null ? force.freeze : (shared() - S.t0ms) / 1000;
      S.tEv.value = tt;
      const tau = tt - T.display;
      if (S.starsIn) {
        const st = S.stars, sh = S.shells;
        if (S.next < 0 || tau < S.lastTau - 0.5 || tau > S.lastTau + 8) {       // first frame / a jump in time: restart from what is still in the air
          st.reset(); if (S.puffs) S.puffs.reset();
          let i = 0; while (i < sh.length && sh[i].tb + 6 < tau) i++;
          S.next = i; S.glowIdx = 0; S.pending.length = 0;
        }
        while (S.next < sh.length && sh[S.next].t0 <= tau + LOOKAHEAD) { const s = sh[S.next++]; if (s.tb > tau - 1.6) emit(s, S.near, 0); if (s.type !== 'comet') S.pending.push(s); }
        for (let i = 0; i < S.pending.length; i++) if (S.pending[i].tb <= tau + LOOKAHEAD) { emit(S.pending[i], S.near, 1); S.pending[i] = S.pending[S.pending.length - 1]; S.pending.pop(); i--; }
        st.flush(); S.lastTau = tau;
        st.u.uTime.value = tau;
        if (S.near && S.puffs) { S.puffs.flush(); S.puffs.u.uTime.value = tau; }
      }
      if (S.inScene) {
        if (S.starsIn && L.display) S.glowIdx = glowAt(S.shells, tau, S.glowIdx, glowRGB); else glowRGB[0] = glowRGB[1] = glowRGB[2] = 0;
        S.crowd.u.uGlow.value.set(glowRGB[0], glowRGB[1], glowRGB[2]); S.glow.u.uShow.value.copy(S.crowd.u.uGlow.value); S.puffs.u.uGlow.value.copy(S.crowd.u.uGlow.value);
        S.crowd.u.uTime.value = tt; S.glow.u.uTime.value = tt; S.ev.bulbs.u.uTime.value = tt;
        for (const r of S.ev.rotors) r.obj.rotation[r.axis] = (L.fair ? r.w : 0) * tt;
      }
    }

    // ------------------------------------------------------------------------------------- the slow tick (4 Hz)
    let slow = 0, lifeNear = false;
    const size = new THREE.Vector2();
    function tick() {
      prog();
      const pl = game.player, wp = pl.place === 'world' ? pl.pos : pl.worldPos || pl.pos, outdoors = pl.place === 'world';
      const dSite = Math.hypot(wp.x - SITE.centre[0], wp.z - SITE.centre[1]);
      notices();
      // by day: skyline + kickabout
      if (park) {
        if (park.updateSkyline) park.updateSkyline(outdoors ? wp.x : -1e9, wp.z);
        const h = game.time.hour;
        lifeNear = outdoors && !P.active && h >= 10 && h < 18.5 && Math.hypot(wp.x - 1985, wp.z - 455) < 170 && (!game.quality || game.quality.level !== 'low' || Math.hypot(wp.x - 1985, wp.z - 455) < 90);
        if (!lifeNear && park.updateLife) park.updateLife(0, false, false);
      }
      if (!P.active) { if (S.active) teardown(); return; }
      S.active = true;
      S.t0ms = force.base !== null ? force.base : shared() - P.t * 1000;
      const near = outdoors && dSite < (S.near ? NEAR_OUT : NEAR);
      if (near !== S.near && S.starsIn) S.next = -1;      // detail changes: re-emit what is in the air at the new detail
      S.near = near;
      showEvent(near);
      const wantStars = L.display && outdoors;
      if (wantStars && (S.shellsDay !== P.showDay || !S.shells)) { S.shells = buildShow(P.showDay); S.shellsDay = P.showDay; }
      showStars(wantStars);
      const R = game.renderer, cam = game.camera;
      let scale = 600;
      try { R.getDrawingBufferSize(size); scale = size.y / (2 * Math.tan((cam.fov * Math.PI) / 360)); } catch { /* stub renderer */ }
      const dCam = Math.hypot(cam.position.x - SITE.launch[0], cam.position.z - SITE.launch[1]);
      if (S.starsIn) {
        const u = S.stars.u; u.uScale.value = scale; u.uMinPx.value = 1.6 * (R.getPixelRatio ? R.getPixelRatio() : 1);
        // far across the city the bursts are lifted so they clear the roofs (they would be ~4 degrees up from Worcester)
        // (physically they would stand ~4 degrees above the horizon from Worcester and never show over a street's roofs;
        // the lift keeps them about 24 degrees up from anywhere beyond ~1.5 km — a deliberate cheat, per-viewer, GPU-side)
        u.uRaise.value = smooth(600, 1500, dCam) * Math.max(0, dCam * 0.445 - 120); u.uGain.value = 1 + 0.3 * smooth(500, 1500, dCam);
        u.uFar.value = (cam.far || 2600) * 0.9;
        if (S.puffs) S.puffs.u.uRaise.value = u.uRaise.value;
      }
      if (S.inScene) {
        const dl = game.time.daylight, n = Math.floor(S.crowd.n * L.crowd);
        S.crowd.setCount(n); for (let i = 0; i < S.crowdCol.length; i++) S.crowdCol[i].on = i < n;
        S.crowd.u.uAmb.value.setRGB(0.17 + 0.8 * dl, 0.19 + 0.78 * dl, 0.27 + 0.68 * dl); S.crowd.u.uFire.value = L.fire;
        S.ev.fair.uOn.value = L.fair * (1 - 0.8 * dl); S.ev.bulbs.u.uOn.value = L.fair; S.ev.bulbs.u.uScale.value = scale;
        S.glow.u.uFair.value = L.fair * (1 - dl); S.glow.u.uFire.value = L.fire * (1 - 0.7 * dl);
        S.flames.u.uProg.value = L.fire; S.flames.u.uFlame.value = Math.min(1, L.fire * 1.6);
        S.embers.u.uOn.value = L.fire; S.embers.u.uScale.value = scale;
        S.puffs.u.uNight.value = 1 - dl; S.puffs.mesh.visible = S.starsIn;
        staffTick();
      }
      sound(dCam, wp);
    }

    function notices() {
      const N = S.noted, ui = game.ui;
      if ((P.upcoming || P.active) && !S.blip) S.blip = ui.addBlip(SITE.centre[0], SITE.centre[1], '#ff9a3a', 'Fireworks tonight');
      if (!P.upcoming && !P.active && S.blip) { ui.removeBlip(S.blip); S.blip = null; }
      if (!game.running) return;
      const key = P.active ? P.showDay : P.day;
      if (P.upcoming && N.day !== key) { N.day = key; ui.toast(`Fireworks in South Park tonight — gates ${clockAt(0)}, bonfire ${clockAt(T.bonfire)}, display ${clockAt(T.display)}`, 9); }
      if (P.active && P.t < 20 && N.gates !== key) { N.gates = key; N.day = key; ui.toast(`South Park: the gates are open. Funfair, bonfire, fireworks at ${clockAt(T.display)}`, 7); }
      if (P.active && L.tau >= 0 && L.tau < 20 && N.show !== key) { N.show = key; ui.toast('The South Park fireworks have started!', 6); }
    }

    function sound(dLaunch, wp) {
      const A = game.audio; if (!A || !A.ctx || !A.running || force.freeze !== null) { return; }
      const sharedSec = shared() / 1000, c = A.ctx;
      if (S.inScene) {
        let p = A.place(SITE.bonfire[0], SITE.bonfire[1], 150); SA.setFire(L.fire, p.gain, p.pan, 0.25, sharedSec);
        p = A.place(SITE.fair[0], SITE.fair[1], 200); SA.setOrgan(!!L.fair, p.gain * 0.9, p.pan, sharedSec, 0.7);
      } else { SA.setFire(0, 0, 0); SA.setOrgan(false, 0, 0); }
      if (!S.starsIn || !S.shells) return;
      const tau = (shared() - S.t0ms) / 1000 - T.display, t0 = Math.max(S.sndTau, tau), t1 = tau + 0.6;
      if (t1 <= t0) return;
      S.sndTau = t1;
      const pl = A.place(SITE.launch[0], SITE.launch[1], 6000), pan = pl.pan * 0.8, dist = pl.dist;
      const pc = A.place((SITE.crowd[0][0] + SITE.crowd[1][0]) / 2, (SITE.crowd[0][1] + SITE.crowd[2][1]) / 2, 260), cg = pc.gain * L.crowd, cpan = pc.pan, cd = pc.dist;
      const last = S.shells[S.shells.length - 1];
      soundEvents(S.shells, t0, t1, dist, cd, (kind, at, s) => {
        const when = c.currentTime + Math.max(0.01, at - tau);
        if (kind === 'boom') SA.boom(when, s.boom, pan + (hash(s.seed, 1) - 0.5) * 0.3, dist, tier.boomGap);
        else if (kind === 'crackle') { if (dist < 1600) SA.crackle(when, s.boom, pan, s.seed % 1000, dist); }
        else if (kind === 'whistle') { if (dist < 700) SA.whistle(when, 1 / (1 + dist / 200), pan); }
        else if (kind === 'launch') { if (dist < 500 && (s.i % 2 === 0 || s.t0 < 320)) SA.thump(when, 1 / (1 + dist / 120), pan); }
        else if (kind === 'ooh' && cg > 0.01) { SA.ooh(when, cg, cpan, s.i % 2 === 0, s.seed % 100); if (s === last) SA.applause(when + 1.2, 7, cg * 1.2, cpan, s.seed % 100); }
      });
    }

    // ------------------------------------------------------------------------------------- API
    game.southPark = {
      id: 'south_park', site: SITE, tiers: TIER,
      get tier() { return tierName(); },
      /** force the evening: t = seconds since the gates opened (0 gates, 30 bonfire, 45 display … 405 end of display,
       *  480 over), running on from there; {freeze: true} holds it at exactly t (screenshots); null = back to the clock */
      debugShow(t, opts = {}) {
        force.day = Number.isFinite(opts.day) ? opts.day : null;       // {day: n} = play the show of game day n (default: today's)
        if (t === null || t === undefined) { force.base = null; force.freeze = null; }
        else if (opts.freeze) { force.freeze = +t; force.base = null; }
        else { force.freeze = null; force.base = shared() - t * 1000; }
        S.next = -1; tick(); if (S.active) frame(0);
        return this.state();
      },
      programme: () => ({ ...prog() }),
      state: () => ({ active: S.active, near: S.near, t: P.t, phase: L.phase, tau: L.tau, crowd: L.crowd, fire: L.fire, fair: L.fair, showDay: P.showDay, today: P.today, upcoming: P.upcoming, forced: force.base !== null || force.freeze !== null }),
      shells: () => S.shells || buildShow(P.showDay ?? day()),
      isTonight: () => isFireworksDay(day()),
      debug: { stars: () => S.stars, crowd: () => S.crowd, event: () => S.ev },
      /** what the event is costing right now */
      stats() {
        let draws = 0, tris = 0;
        const count = (o) => { o.traverse((m) => { if ((m.isMesh || m.isPoints) && m.visible) { draws++; const g = m.geometry; tris += m.isPoints ? 0 : ((g.index ? g.index.count : g.attributes.position.count) / 3) * (g.isInstancedBufferGeometry ? g.instanceCount : 1); } }); };
        if (S.inScene) count(S.group); if (S.starsIn) draws++;
        return { active: S.active, near: S.near, inScene: S.inScene, stars: S.starsIn, tier: tierName(), cap: S.stars ? S.stars.cap : tier.cap, written: S.stars ? S.stars.written : 0,
          alive: S.starsIn ? S.stars.alive(L.tau) : 0, crowd: S.crowd && S.inScene ? S.crowd.count : 0, puffs: S.puffs ? S.puffs.cap : 0, draws, tris: Math.round(tris), staff: S.staff.length,
          voices: SA.voices, bucket: S.bucket, skyline: !!(park && park.skyline && park.skyline.mesh.visible), cleared: park ? park.cleared : 0 };
      },
    };

    return {
      update(dt) {
        if ((slow -= dt) <= 0) { slow = 0.25; try { tick(); } catch (e) { if (!S.err) { S.err = true; console.error('[south_park]', e); } } }
        if (S.active) frame(dt);
        else if (lifeNear && park && park.updateLife) park.updateLife(dt, true, true);
      },
    };
  },
};
