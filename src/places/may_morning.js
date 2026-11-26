// May Morning: at dawn on one game day in seven (game day mod 7 === 2, the friends' day counter) a crowd fills the High
// Street below Magdalen Tower and Magdalen Bridge; at 06:00 the tower clock strikes, the crowd falls silent and the
// choir sings the Hymnus Eucharisticus from the top of the tower; then a madrigal, a cheer, the bells, and Morris
// dancing in Radcliffe Square and Broad Street while the crowd drifts away. See docs/research/may_morning.md for what
// is known about the real morning and what is guessed, and _mm_rules.js for the timetable (real seconds from the start, 60 s before 06:00).
//
// Everyone sees and hears the same morning at the same moment: every position, note and step is a function of
// game.time.now() and the game day; there is no Math.random here and no network traffic. Sound is delayed by distance.
//
// Cost: nothing of the event exists in the scene unless it is on AND the player is within NEAR m of the tower (or
// MORRIS_NEAR m of a Morris side). On the day, far away, the only work is the 4 Hz tick and the road closure flag.
//
// THE BRIDGE. The real tradition of jumping from Magdalen Bridge has hurt people; here the parapets are lined with
// crowd barriers (with gaps — they are dressing, not walls, and have no collision) and stewards who say something
// when you go to the parapet, but nothing stops the player. Hooks for the swimming code:
//   game.mayDay.bridgeClosed()   always false (the bridge is never shut to the player)
//   game.mayDay.bridgeWatched()  true while the event's stewards are on the bridge
//   game.mayDay.bridgeJump(x, z) call when the player jumps from the bridge: the stewards react (a line, a toast). No injury.
//
// Test hooks: game.mayDay = { debugShow(t | null, {freeze}), state(), stats(), programme(), site, tiers }
//   ?mayday        the morning starts now (0 s of the programme)         ?mayday=70  … 70 s in (just before the hymn)
import * as THREE from 'three';
import { randomLook } from '../core/characters.js';
import { SITE, T, DAY_MS, JIG, KINDS, programme, levels, isMayDay, crowdSpots, barrierPlan, staffPlan, inClosure, onBridge, streetNear, choirNotes, bellStrikes, hash, smooth } from './_mm_rules.js';
import { createCrowd, createStandins, createChoir, createDressing, lookFor } from './_mm_fx.js';
import { createMorrisSide } from './_mm_morris.js';
import { MmAudio } from './_mm_audio.js';

const NEAR = 440, NEAR_OUT = 480, PRE = 260, MORRIS_NEAR = 130, MORRIS_OUT = 150, CAFE_NEAR = 110;
// cut-outs / 3D stand-ins (count, radius m) / live people round the player / staff / Morris kit detail / spectators per side
export const TIER = {
  // (crowd, staff, spect: WHO IS THERE — the same on every tier, systems/_busy.js; the rest is how near and how finely they are drawn)
  low: { crowd: 3600, standins: 20, sr: 12, live: 6, staff: 10, detail: false, spect: 8 },
  medium: { crowd: 3600, standins: 56, sr: 20, live: 10, staff: 10, detail: true, spect: 8 },
  high: { crowd: 3600, standins: 110, sr: 28, live: 14, staff: 10, detail: true, spect: 8 },
};
const CROWD_LINES = ['Can you see them up there?', 'We came straight from the ball.', 'My feet are killing me.', 'Happy May Morning!', 'I\'ve been up since four.', 'Is that a man dressed as a tree?', 'Bacon sandwich after this. Definitely.', 'I can\'t feel my toes.'];
const STEWARD_LINES = ['Morning! Road\'s closed till it\'s over.', 'Keep moving along, there\'s room further down.', 'Choir sings at six. Not long now.', 'Mind the barriers, please.'];
const POLICE_LINES = ['Morning.', 'Road\'s closed to traffic, on foot is fine.', 'Enjoy the singing.'];
const BRIDGE_LINES = ['Stay back from the parapet, please.', 'Nobody\'s jumping this year, thank you.', 'It\'s shallower than it looks down there.', 'Lovely morning for staying dry.'];
const JUMP_LINES = ['Oi! Not off the bridge! …Oh, for heaven\'s sake.', 'That\'s my whole risk assessment gone.', 'It\'s two foot deep, you know!', 'Every year. Every single year.', 'I\'m not coming in after you!'];
const PARAPET_LINES = ['Don\'t even think about it.', 'I can see what you\'re thinking. Don\'t.', 'Step away from the parapet, please… please?', 'You\'d only ruin your shoes.'];
const MORRIS_LINES = ['They\'ve been practising since February.', 'Mind the sticks!', 'Lovely tune, that.', 'Is it always this early?'];
const CHEERS = [[T.hymnEnd + 0.8, 6, 0.8], [T.madEnd + 0.5, 9, 1.1], [T.bells + 1, 7, 0.9]];      // event time, length s, level
const QUEUE_LINES = ['Is this the queue for coffee?', 'They opened at five, apparently.', 'Two bacon rolls. No — three.', 'Worth getting up for.'];

export default {
  id: 'may_morning',

  install(game) {
    const W = game.world, scene = game.worldScene, col = game.worldCollider;
    const tierName = () => { const l = game.quality && game.quality.level; return TIER[l] ? l : l === 'ultra' ? 'high' : 'medium'; };
    let tier = TIER[tierName()];
    const P = {}, L = {};
    const force = { base: null, freeze: null };
    try { const q = new URLSearchParams(location.search); if (q.has('mayday')) { const v = parseFloat(q.get('mayday')); force.base = game.time.now() - (Number.isFinite(v) ? v : 0) * 1000; } } catch { /* node */ }
    const S = { active: false, near: false, inScene: false, group: null, crowd: null, spots: null, crowdCol: [], standins: null, choir: null, dress: null, dressCol: [],
      live: [], liveBy: new Map(), staff: [], plan: null, closure: null, blip: null, mBlips: [], noted: {}, t0ms: 0, sndT: -1e9, bellT: -1e9, cheered: 0, cache: null, camX: 1e9, camZ: 1e9, lastN: -1,
      sides: [null, null], sideOb: [null, null], spect: [[], []], queues: [null, null, null], adopted: 0, adoptT: 0, warnT: 0, jumps: 0, present: 0 };
    const SA = new MmAudio(game.audio);
    const shared = () => game.time.now();
    const gy = (x, z) => { try { return W.groundHeight(x, z); } catch { return 0.04; } };

    function prog() {
      if (force.freeze !== null) { P.day = Math.floor(shared() / DAY_MS); P.today = true; P.upcoming = false; P.eve = false; P.t = force.freeze; P.active = P.t >= 0 && P.t < T.end; }
      else if (force.base !== null) {
        P.day = Math.floor(shared() / DAY_MS); P.t = (shared() - force.base) / 1000; P.active = P.t >= 0 && P.t < T.end; P.today = true; P.upcoming = P.t < 0; P.eve = false;
        if (P.t >= T.end) force.base = null;
      } else programme(shared(), P);
      levels(P.active ? P.t : -1, L);
      return P;
    }
    const tNow = () => (force.freeze !== null ? force.freeze : (shared() - S.t0ms) / 1000);

    // ------------------------------------------------------------------------------------- build / show / hide
    // (built a part a slow tick from NEAR + PRE m out — the crowd, the stand-ins, the choir, the dressing: ~80 ms all in
    // one frame on arriving used to stall the High Street — then compiled and first-drawn out of sight, world.prepare)
    function ensureEvent() { while (!S.group) buildStep(); }
    function buildStep() {
      if (S.group) return true;
      const k = S.bk || 0; S.bk = k + 1;
      if (k === 0) { buildPlaces(); return false; }
      if (k === 1) { S.crowd = createCrowd(S.spots); return false; }
      if (k === 2) { S.standins = createStandins(S.spots); return false; }
      if (k === 3) { const tw = (game.map.buildings || []).find((b) => b.id === SITE.towerId); let topY = SITE.towerTop; try { const h = game.overrides && game.overrides.heights && game.overrides.heights.get(SITE.towerId); if (h) topY = h; } catch { /* */ } S.choir = tw ? createChoir(tw.poly, topY, tierName() === 'low' ? 1 : 2) : null; return false; }
      S.bk = 0; buildRest(); return true;
    }
    function buildPlaces() {
      tier = TIER[tierName()];
      const okSpot = (x, z) => col.isFree(x, z, 0.3) && !(col.isWet && col.isWet(x, z));
      // (places and their colliders are made once per tier and kept, switched off, between mornings)
      const plan = barrierPlan();
      if (!S.cache || S.cache.tier !== tierName()) {
        const spots = crowdSpots(tier.crowd, okSpot);
        S.cache = { tier: tierName(), spots, cols: spots.map((s) => { const c = col.addCircle(s[0], s[1], 0.13, { tag: 'crowd', low: true }); c.on = false; return c; }),
          dress: plan.filter((p) => !onBridge(p[0], p[1])).map(([x, z, h]) => { const c = col.addBox(x, z, 0.3, 2.3, h); setCols([c], false); return c; }).filter(Boolean) };
      }
      S.spots = S.cache.spots; S.crowdCol = S.cache.cols; S.plan0 = plan;
    }
    function buildRest() {
      const plan = S.plan0;
      S.dress = createDressing(plan, gy);
      // only the barriers across the road are solid (they stop a car); the ones along the bridge are dressing: the
      // player can always reach the parapet (see the header)
      S.dressCol = S.cache.dress;
      S.group = new THREE.Group(); S.group.name = 'mayday:event';
      S.group.add(S.crowd.mesh, S.standins.group, S.dress.mesh); if (S.choir) S.group.add(S.choir.group);
      const hv = (i, c) => ({ ...randomLook(8800 + i, { outfit: 'casual' }), hivis: c, topStyle: 'jacket', hat: i % 3 === 0 ? 'beanie' : null, hatColor: 0x1a1a1a });
      S.plan = staffPlan().slice(0, tier.staff).map(([x, z, h, role], i) => ({ x, z, h, role, label: role === 'police' ? 'Police' : 'Steward', lines: role === 'police' ? POLICE_LINES : role === 'bridge' ? BRIDGE_LINES : STEWARD_LINES,
        look: role === 'police' ? randomLook(8900 + i, { outfit: 'police' }) : hv(i, role === 'bridge' ? 0xf07010 : 0xd8f030) }));
    }
    const setCols = (list, on) => { for (const c of list) { if (Array.isArray(c)) { for (const q of c) q.on = on; } else if (c) c.on = on; } };
    function showEvent(on) {
      if (on === S.inScene) return;
      S.inScene = on;
      if (on) { ensureEvent(); scene.add(S.group); S.group.updateMatrixWorld(true); S.lastN = -1; S.camX = 1e9; }
      else if (S.group) scene.remove(S.group);
      setCols(S.dressCol, on);
      if (!on) { for (const c of S.crowdCol) c.on = false; dismiss(S.live); S.liveBy.clear(); dismiss(S.staff); }
    }
    function dismiss(list) { for (const r of list) { try { game.pedestrians.remove(r.ped); } catch { /* */ } } list.length = 0; }
    function disposeEvent() {
      if (!S.group) return;
      showEvent(false);
      try { S.crowd.dispose(); S.standins.dispose(); S.dress.dispose(); S.choir && S.choir.dispose(); } catch { /* */ }
      S.group = S.crowd = S.standins = S.choir = S.dress = S.spots = S.plan = null; S.crowdCol = []; S.dressCol = [];
    }
    function teardown() {
      disposeEvent(); SA.stop(); S.active = false; S.near = false;
      for (let k = 0; k < 2; k++) showSide(k, false);
      for (let k = 0; k < S.queues.length; k++) showQueue(k, false);
      if (S.closure) { try { game.traffic.openRoads(S.closure); } catch { /* */ } S.closure = null; }
      for (const b of S.mBlips) game.ui.removeBlip(b); S.mBlips.length = 0;
      S.adopted = 0; S.cheered = 0; S.present = 0;
    }

    // ------------------------------------------------------------------------------------- people
    function spawn(x, z, look, opts) { const ped = game.pedestrians; if (!ped || !ped.spawnAt) return null; try { return ped.spawnAt(x, z, look, { role: 'townie', knockable: false, ...opts }); } catch (e) { if (!S.warned) { S.warned = true; console.warn('[may_morning] spawn', e); } return null; } }
    function staffTick() {
      if (!S.plan || S.staff.length >= S.plan.length) return;
      const q = S.plan[S.staff.length];
      S.staff.push({ ped: spawn(q.x, q.z, q.look, { heading: q.h, label: q.label, lines: q.lines }), q });
    }
    /** the people right round the player are real characters (they turn their heads, talk, clap); their cut-outs are hidden */
    function liveTick(px, pz, n) {
      for (let k = S.live.length - 1; k >= 0; k--) { const r = S.live[k], s = S.spots[r.i]; if (r.i >= n || (s[0] - px) ** 2 + (s[1] - pz) ** 2 > 9.5 * 9.5) { try { game.pedestrians.remove(r.ped); } catch { /* */ } S.liveBy.delete(r.i); S.live.splice(k, 1); S.camX = 1e9; } }
      if (S.live.length >= tier.live) return;
      let best = -1, bd = 7 * 7;
      for (let i = 0; i < n; i++) { if (S.liveBy.has(i)) continue; const s = S.spots[i], d = (s[0] - px) ** 2 + (s[1] - pz) ** 2; if (d < bd && d > 0.7 * 0.7) { bd = d; best = i; } }
      if (best < 0) return;
      const s = S.spots[best], look = lookFor(s[2], 1000 + best); if (KINDS[s[2]] === 'child') look.height = 1.22;
      const ped = spawn(s[0], s[1], look, { heading: s[5], lines: CROWD_LINES });
      if (!ped) return;
      const r = { i: best, ped, up: 0.34 + 0.2 * s[4], chatty: hash(best, 17) < 0.3 }; if (!r.chatty) ped.lines = null; S.live.push(r); S.liveBy.set(best, r); S.camX = 1e9;
    }
    function refreshStandins(n, force2) {
      const cam = game.camera.position;
      if (!force2 && n === S.lastN && Math.hypot(cam.x - S.camX, cam.z - S.camZ) < 1.5) return;
      S.camX = cam.x; S.camZ = cam.z; S.lastN = n;
      const dist = game.quality && game.quality.dist ? game.quality.dist : 1;
      const drawn = S.standins.refresh(cam.x, cam.z, n, tier.sr * dist, Math.round(tier.standins * dist), (i) => S.liveBy.has(i), gy);
      const hide = drawn.slice(); for (const r of S.live) hide.push(r.i);
      S.crowd.hide(hide);
    }

    // ------------------------------------------------------------------------------------- Morris sides, queues
    function sitePos(k) {
      const site = SITE.morris[k]; if (site._p) return site._p;
      let best = site.p, bd = 1e9;
      for (let dx = -12; dx <= 12; dx += 3) for (let dz = -12; dz <= 12; dz += 3) { const x = site.p[0] + dx, z = site.p[1] + dz, d = dx * dx + dz * dz; if (d < bd && col.isFree(x, z, 5)) { bd = d; best = [x, z]; } }
      return (site._p = best);
    }
    function showSide(k, on) {
      if (!!S.sides[k] === on) return;
      const ped = game.pedestrians;
      if (on) {
        const site = SITE.morris[k], p = sitePos(k), side = createMorrisSide({ ...site, p }, { detail: tier.detail, gy });
        S.sides[k] = side; scene.add(side.group);
        try { if (ped && ped.addObstacle) S.sideOb[k] = ped.addObstacle({ x: p[0], z: p[1], r: 5 }); } catch { /* */ }
        for (let j = 0; j < tier.spect; j++) {
          const a = site.h + Math.PI + (j - (tier.spect - 1) / 2) * 0.42 + (hash(k, j) - 0.5) * 0.15, r = 6.6 + hash(j, k) * 1.2, x = p[0] + Math.sin(a) * r, z = p[1] + Math.cos(a) * r;
          if (!col.isFree(x, z, 0.35)) continue;
          const pd = spawn(x, z, lookFor(Math.floor(hash(j * 3 + k, 7) * 14), 4000 + k * 50 + j), { heading: Math.atan2(p[0] - x, p[1] - z), lines: MORRIS_LINES, pose: j % 3 === 0 ? 'clap' : 'stand' });
          if (pd) S.spect[k].push({ ped: pd });
        }
      } else {
        const side = S.sides[k]; S.sides[k] = null; scene.remove(side.group); side.dispose();
        if (S.sideOb[k]) { try { ped.removeObstacle(S.sideOb[k]); } catch { /* */ } S.sideOb[k] = null; }
        dismiss(S.spect[k]);
      }
    }
    function showQueue(k, on) {
      if (!!S.queues[k] === on) return;
      if (!on) { dismiss(S.queues[k]); S.queues[k] = null; return; }
      const [cx, cz] = SITE.cafes[k], list = (S.queues[k] = []);
      // the queue stands on the pavement outside, along the street: find the street
      let seg = null, bd = 60;
      try { W.roadGrid.queryRadius(cx, cz, 45, (it) => { if (it.w < 5) return; const dx = it.bx - it.ax, dz = it.bz - it.az, l2 = dx * dx + dz * dz || 1; let t = ((cx - it.ax) * dx + (cz - it.az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(cx - it.ax - dx * t, cz - it.az - dz * t); if (d < bd) { bd = d; seg = { x: it.ax + dx * t, z: it.az + dz * t, dx: dx / Math.sqrt(l2), dz: dz / Math.sqrt(l2), w: it.w }; } }); } catch { /* */ }
      if (!seg) return;
      const ox = (cx - seg.x) / (bd || 1), oz = (cz - seg.z) / (bd || 1), off = seg.w / 2 + 1.5, n = 3 + Math.floor(hash(k, 31) * 3);
      for (let j = 0; j < n; j++) {
        const x = seg.x + ox * off + seg.dx * (j * 0.78 + 0.6), z = seg.z + oz * off + seg.dz * (j * 0.78 + 0.6);
        if (!col.isFree(x, z, 0.3)) continue;
        const pd = spawn(x, z, lookFor(Math.floor(hash(k * 5 + j, 13) * 14), 5000 + k * 20 + j), { heading: Math.atan2(-seg.dx, -seg.dz), lines: QUEUE_LINES });
        if (pd) list.push({ ped: pd });
      }
    }

    // ------------------------------------------------------------------------------------- per frame while it is on
    function frame(dt) {
      const tt = tNow();
      levels(tt, L);
      if (S.inScene) {
        const u = S.crowd.u; u.uTime.value = tt; u.uCheer.value = L.cheer;
        for (const r of S.live) { const ch = r.ped && r.ped.character; if (ch && ch.bones && ch.pose !== 'clap') { ch.bones.head.rotation.x -= r.up * (L.choir ? 1 : 0.3); } }
      }
      const beat = shared() / 1000 / JIG.beat, wp = game.player.place === 'world' ? game.player.pos : null;
      for (let k = 0; k < 2; k++) { const sd = S.sides[k]; if (sd && wp && Math.hypot(wp.x - sd.site.p[0], wp.z - sd.site.p[1]) < 110) sd.update(beat, dt, !!L.morris); }
    }

    // ------------------------------------------------------------------------------------- the slow tick (4 Hz)
    let slow = 0;
    function tick() {
      prog();
      notices();
      if (!P.active) { if (S.active) teardown(); return; }
      S.active = true;
      S.t0ms = force.base !== null ? force.base : shared() - P.t * 1000;
      const pl = game.player, outdoors = pl.place === 'world', wp = outdoors ? pl.pos : pl.worldPos || pl.pos;
      if (!S.closure && game.traffic && game.traffic.closeRoads) { try { S.closure = game.traffic.closeRoads(inClosure); } catch { S.closure = { edges: null }; } }
      const dSite = Math.hypot(wp.x - SITE.centre[0], wp.z - SITE.centre[1]);
      const near = outdoors && dSite < (S.near ? NEAR_OUT : NEAR);
      S.near = near;
      if (!near && outdoors && !S.group && dSite < NEAR + PRE && buildStep() && W.prepare) { try { W.prepare(S.group); } catch { /* */ } }
      if (!near && S.group && dSite > NEAR_OUT + 300) disposeEvent(); else showEvent(near);
      if (S.inScene) {
        const n = Math.floor(S.crowd.n * L.crowd), dl = game.time.daylight;
        if (n !== S.present) { S.crowd.setCount(n); for (let i = Math.min(n, S.present); i < Math.max(n, S.present) && i < S.crowdCol.length; i++) S.crowdCol[i].on = i < n; S.present = n; }
        const u = S.crowd.u;
        u.uAmb.value.setRGB(0.15 + 0.5 * dl, 0.17 + 0.5 * dl, 0.25 + 0.47 * dl);
        try { const sun = W.sun, el = W.sunElevation ?? 10, k = Math.min(1, (sun.intensity || 0) / 3.6) * 0.85 * smooth(-1, 3, el); u.uSun.value.copy(sun.color).multiplyScalar(k); if (W.sky && W.sky.sunDir) u.uSunDir.value.copy(W.sky.sunDir); } catch { /* stub world */ }
        try { const f = scene.fog; if (f) { u.uFog.value.copy(f.color); u.uFogD.value = f.density || 0.001; } } catch { /* */ }
        if (S.choir) S.choir.group.visible = !!L.choir;
        liveTick(wp.x, wp.z, n);
        for (const r of S.live) if (r.chatty && r.ped) r.ped.lines = L.hush > 0.5 ? null : CROWD_LINES;      // nobody talks through the singing
        refreshStandins(n, false);
        staffTick();
        bridgeWatch(wp);
        disperseTick(wp, n);
      } else S.present = 0;
      // Morris sides and café queues come and go with the player's distance
      for (let k = 0; k < 2; k++) {
        const p = SITE.morris[k]._p || SITE.morris[k].p, d = Math.hypot(wp.x - p[0], wp.z - p[1]), want = outdoors && P.t > T.morris - 25 && P.t < T.morrisEnd + 6 && d < (S.sides[k] ? MORRIS_OUT : MORRIS_NEAR);
        showSide(k, want);
      }
      for (let k = 0; k < SITE.cafes.length; k++) { const c = SITE.cafes[k]; showQueue(k, outdoors && !!L.cafes && Math.hypot(wp.x - c[0], wp.z - c[1]) < (S.queues[k] ? CAFE_NEAR + 20 : CAFE_NEAR)); }
      sound(wp, outdoors);
    }
    function bridgeWatch(wp) {
      if ((S.warnT -= 0.25) > 0) return;
      const n = streetNear(wp.x, wp.z);
      if (!(n[0] > SITE.bridgeS[0] && n[0] < SITE.bridgeS[1]) || Math.abs(n[1]) < SITE.parapet - 0.15 || Math.abs(n[1]) > 9) return;
      S.warnT = 7; stewardSays(wp, PARAPET_LINES, Math.floor(shared() / 7000));
    }
    function stewardSays(wp, lines, k) {
      let best = null, bd = 60;
      for (const r of S.staff) if (r.q.role === 'bridge' && r.ped) { const d = Math.hypot(r.q.x - wp.x, r.q.z - wp.z); if (d < bd) { bd = d; best = r; } }
      const line = lines[((k % lines.length) + lines.length) % lines.length];
      try { if (best && best.ped.character && best.ped.character.say) best.ped.character.say(line, 3.5); } catch { /* */ }
      return line;
    }
    /** as the crowd thins, some of the people who "leave" near the player really do walk off through the streets */
    function disperseTick(wp, n) {
      const ped = game.pedestrians;
      if (P.t < T.disperse || P.t > T.thin + 20 || !ped || !ped.adopt || S.adopted >= 40 || (S.adoptT -= 0.25) > 0 || force.freeze !== null) return;
      S.adoptT = 0.75;
      for (let i = n; i < Math.min(S.spots.length, n + 40); i++) {
        const s = S.spots[i]; if (Math.hypot(s[0] - wp.x, s[1] - wp.z) > 70) continue;
        try { if (ped.adopt(s[0], s[1], lookFor(s[2], 1000 + i), { standing: true, heading: s[5] + Math.PI })) S.adopted++; } catch { /* */ }
        return;
      }
    }

    function notices() {
      const N = S.noted, ui = game.ui, on = P.eve || P.upcoming || P.active;
      if (on && !S.blip) S.blip = ui.addBlip(SITE.tower[0], SITE.tower[1], '#f4d35e', 'May Morning');
      if (!on && S.blip) { ui.removeBlip(S.blip); S.blip = null; }
      if (!game.running) return;
      const key = P.eve ? P.day + 1 : P.day;
      if (P.eve && N.eve !== key) { N.eve = key; ui.toast('May Morning tomorrow: the choir sings from Magdalen Tower at 06:00', 8); }
      if (P.upcoming && N.up !== key && game.time.hour > 3.5) { N.up = key; ui.toast('May Morning — people are heading for Magdalen Bridge. The choir sings from the tower at 06:00', 8); }
      if (!P.active) return;
      if (P.t < 20 && N.start !== key) { N.start = key; N.up = key; N.eve = key; ui.toast('May Morning: the High Street is closed and filling up below Magdalen Tower. Singing at 06:00', 8); }
      if (P.t >= T.strike - 1 && P.t < T.strike + 12 && N.six !== key) { N.six = key; ui.toast('Six o\'clock. The crowd falls silent.', 5); }
      if (P.t >= T.hymn && P.t < T.hymn + 12 && N.hymn !== key && S.near) { N.hymn = key; ui.toast('From the top of the tower: the Hymnus Eucharisticus', 6); }
      if (P.t >= T.bells && P.t < T.bells + 15 && N.bells !== key) { N.bells = key; ui.toast('The bells ring out. Morris dancing in Radcliffe Square and Broad Street; the cafés are open', 8); }
      if (L.morris && !S.mBlips.length) for (let k = 0; k < 2; k++) { const p = SITE.morris[k]; S.mBlips.push(ui.addBlip(p.p[0], p.p[1], '#8fd36e', 'Morris dancing')); }
      if (!L.morris && S.mBlips.length && P.t > T.morris) { for (const b of S.mBlips) ui.removeBlip(b); S.mBlips.length = 0; }
    }

    function sound(wp, outdoors) {
      const A = game.audio; if (!A || !A.ctx || !A.running || force.freeze !== null) return;
      const c = A.ctx, tt = (shared() - S.t0ms) / 1000;
      if (!outdoors) { SA.stop(); S.sndT = -1e9; S.bellT = -1e9; return; }
      // the choir (heard along the street and well beyond: the tower carries, and it arrives late by distance / 343 m/s)
      let p = A.place(SITE.tower[0], SITE.tower[1], 950); const dT = p.dist, delay = dT / 343, cg = p.gain, cpan = p.pan * 0.7;
      const singing = tt - delay > T.hymn - 2 && tt - delay < T.madEnd + 3;
      SA.setChoir(singing ? cg * 0.9 : 0, cpan, dT);
      if (singing && SA.ch) {
        const t0 = Math.max(S.sndT, tt - delay), t1 = tt - delay + 0.6;
        if (t1 > t0) { S.sndT = t1; choirNotes(t0, t1, (m, at, dur, v, piece) => SA.sing(c.currentTime + Math.max(0.01, at - (tt - delay)), m, dur, v, piece === 1)); }
      } else S.sndT = -1e9;
      // the clock and the bells (further still)
      p = A.place(SITE.tower[0], SITE.tower[1], 2400); const bg = p.gain, bpan = p.pan * 0.6;
      if (bg > 0.004) {
        const t0 = Math.max(S.bellT, tt - delay), t1 = tt - delay + 0.6;
        if (t1 > t0) { S.bellT = t1; bellStrikes(t0, t1, (i, at) => SA.bell(c.currentTime + Math.max(0.01, at - (tt - delay)), i, bg, bpan + (i >= 0 ? (i - 4.5) * 0.03 : 0), dT)); }
      }
      // the crowd: a murmur, hushed for the singing; cheers
      p = A.place(SITE.centre[0] + 20, SITE.centre[1] + 14, 330); const kg = p.gain * Math.min(1, L.crowd * 1.4), kpan = p.pan * 0.5;
      SA.setCrowd(1 - L.hush, kg, kpan);
      CHEERS.forEach(([at, len, lv], k) => {
        if (tt < at || tt > at + 1.5 || (S.cheered & (1 << k))) return;
        S.cheered |= 1 << k;
        if (kg > 0.01) SA.cheer(c.currentTime + 0.05, len, kg * lv, kpan, 11 + k);
        for (const r of S.live) if (hash(r.i, 3) > 0.25) { try { r.ped.character.setPose('clap', { duration: len * 0.6 + hash(r.i, 5) * 3 }); } catch { /* */ } }
      });
      // Morris music from the nearer side
      let mk = -1, md = 1e9; for (let k = 0; k < 2; k++) { const q = SITE.morris[k]._p || SITE.morris[k].p, d = Math.hypot(wp.x - q[0], wp.z - q[1]); if (d < md) { md = d; mk = k; } }
      if (L.morris && md < 190) { const q = SITE.morris[mk]._p || SITE.morris[mk].p; p = A.place(q[0], q[1], 190); SA.setMorris(true, p.gain * 0.9, p.pan * 0.8, shared() / 1000, 0.6, SITE.morris[mk].kit); } else SA.setMorris(false, 0, 0);
    }

    // ------------------------------------------------------------------------------------- API
    game.mayDay = {
      id: 'may_morning', site: SITE, tiers: TIER, T,
      get tier() { return tierName(); },
      /** force the morning: t = seconds since the start of the programme (60 the clock strikes, 74 the hymn … T.end over),
       *  running on from there; {freeze: true} holds it at exactly t (screenshots); null = back to the clock */
      debugShow(t, opts = {}) {
        if (t === null || t === undefined) { force.base = null; force.freeze = null; }
        else if (opts.freeze) { force.freeze = +t; force.base = null; }
        else { force.freeze = null; force.base = shared() - t * 1000; }
        S.sndT = -1e9; S.bellT = -1e9; S.cheered = 0; S.camX = 1e9; tick(); if (S.active) { tick(); frame(0); }
        return this.state();
      },
      programme: () => ({ ...prog() }),
      state: () => ({ active: S.active, near: S.near, t: P.t, phase: L.phase, crowd: L.crowd, hush: L.hush, sing: L.sing, bells: L.bells, morris: L.morris, today: P.today, upcoming: P.upcoming, closed: !!S.closure, forced: force.base !== null || force.freeze !== null }),
      isToday: () => isMayDay(Math.floor(shared() / DAY_MS)),
      /** is the High Street / the bridge closed to AI traffic right now */
      roadClosed: () => !!S.closure,
      /** the bridge is never closed to the player: barriers and stewards are dressing (swimming / bridge-jumping code may rely on this) */
      bridgeClosed: () => false,
      bridgeWatched: () => S.active && S.inScene,
      /** the player has jumped off Magdalen Bridge at (x, z): the stewards despair. Returns the line said (or null when the event is off) */
      bridgeJump(x, z) {
        if (!S.active || !S.inScene) return null;
        const line = stewardSays({ x: x ?? game.player.pos.x, z: z ?? game.player.pos.z }, JUMP_LINES, S.jumps++);
        try { game.ui.toast('Steward: "' + line + '"', 4); } catch { /* */ }
        if (game.audio && game.audio.ctx && game.audio.running) { try { const p = game.audio.place(x ?? game.player.pos.x, z ?? game.player.pos.z, 120); SA.cheer(game.audio.ctx.currentTime + 0.3, 3.5, 0.5 * Math.min(1, L.crowd * 1.5), p.pan, 40 + S.jumps); } catch { /* */ } }
        return line;
      },
      debug: { crowd: () => S.crowd, spots: () => S.spots, standins: () => S.standins, sides: () => S.sides, live: () => S.live, staff: () => S.staff, audio: () => SA },
      /** what the event is costing right now */
      stats() {
        let draws = 0, tris = 0;
        const count = (o) => o.traverse((m) => { if (m.isMesh && m.visible && (m.layers.mask & 1) && (!m.parent || m.parent.visible)) { const g = m.geometry, k = m.isInstancedMesh ? m.count : g.isInstancedBufferGeometry ? g.instanceCount : 1; if (k > 0) { draws++; tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * k; } } });
        if (S.inScene) count(S.group);
        let mDraws = 0, mTris = 0; for (const sd of S.sides) if (sd) { const d0 = draws, t0 = tris; count(sd.group); mDraws += draws - d0; mTris += tris - t0; }
        return { active: S.active, near: S.near, inScene: S.inScene, tier: tierName(), draws, tris: Math.round(tris), morrisDraws: mDraws, morrisTris: Math.round(mTris), crowd: S.inScene ? S.crowd.count : 0, standins: S.inScene && S.standins ? S.crowd.hiddenCount - S.live.length : 0,
          live: S.live.length, staff: S.staff.length, sides: S.sides.filter(Boolean).length, spectators: S.spect[0].length + S.spect[1].length, queues: S.queues.reduce((a, q) => a + (q ? q.length : 0), 0), closed: !!S.closure, closedEdges: S.closure && S.closure.edges ? S.closure.edges.length : 0, adopted: S.adopted, voices: SA.voices, built: !!S.group };
      },
    };

    return {
      update(dt) {
        if ((slow -= dt) <= 0) { slow = 0.25; try { tick(); } catch (e) { if (!S.err) { S.err = true; console.error('[may_morning]', e); } } }
        if (S.active) { try { frame(dt); } catch (e) { if (!S.err2) { S.err2 = true; console.error('[may_morning] frame', e); } } }
      },
    };
  },
};
