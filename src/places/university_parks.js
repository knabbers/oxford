// University Parks: dressing (_parks_dress.js) and "The Parks Census" — Dr Sufrin's survey of dog mess (the user's own
// affectionate in-joke; played straight). Rules and the shared daily data live in _parks_census.js.
// Dr Sufrin: neutral elderly-don look (tweed, flat cap, glasses, clipboard) — deliberately not based on any photograph.
// Test hooks: game.parks = { jump(), start(variant), messes(), plan(), tally(), recordNearest(guess?), report(), census,
//   tread(), view(x,y,z,tx,ty,tz), stats(), detail(), life() }. Static detail: _parks_detail.js; ambient life: _parks_people.js.
import * as THREE from 'three';
import { createCharacter } from '../core/characters.js';
import { buildParks, PAVILION_ID, BRIDGE_ROAD, BRIDGE_AREA, CRICKET } from './_parks_dress.js';
import { dailyMesses, surveyPlan, sufrinAt, countedBy, quadratFor, inQuadrat, freshness, QUADRAT_SIZE, SURVEY, SIZES,
  Census, MISSION, addToLeague, MUTTER, AT_MESS, AT_WALKER, WALKER_SHEEPISH, mulberry } from './_parks_census.js';
import { mbox, canvasTex } from './_music_batch.js';
import { buildParkDetail } from './_parks_detail.js';
import { buildParkPeople } from './_parks_people.js';
import { buildParkTrees } from './_parks_trees.js';
import { dayOf, HOUR_S } from '../core/time.js';

const CENTRE = [430, -800];
const SUFRIN_LOOK = { seed: 1983, outfit: 'tweed', height: 1.74, build: 0.95, skin: 0xecc9ad, hair: 0xd9d6cf, hairStyle: 'short', glasses: true,
  hat: 'flatcap', hatColor: 0x5a5244, jacket: 0x7a6248, shirt: 0xdfe6ee, neck: 'tie', neckColor: 0x6a2a2a, bottom: 0x5b4a3a, shoes: 0x3a2a1c, shoeStyle: 'shoe', prop: 'clipboard' };

export default {
  id: 'university_parks',
  preMap(game) {
    game.overrides.skip.add(PAVILION_ID);           // rebuilt (collision re-added in _parks_dress.js)
    game.overrides.skip.add(BRIDGE_ROAD); game.overrides.skip.add(BRIDGE_AREA);   // drawn as the arch; still walkable (map collision)
    game.overrides.heights.set('w228391321', 6.5);   // Rhodes Pavilion: OSM gives no height (12.8 m default); a low building beside the pavilion (guess)
    game.overrides.heights.set('w304660803', 3.4);   // the Parks toilets (single storey; guess)
    // photo comparison item 18 ("norham"): the Parks' North Lodge at the Norham Gardens gate is a gabled stone cottage,
    // not a 9 m block. Two low storeys, steep tiled gables (height and roof a GUESS from the photograph).
    game.overrides.style.set('w173096602', { wall: 'stone', roof: 'tile', shape: 'gabled', storeys: 2, tint: [1.0, 0.94, 0.82], up: 'stoneTudor', ground: 'stoneTudor', door: 'stoneDoor' });
    game.overrides.heights.set('w173096602', 5.4);
  },

  install(game) {
    const W = game.world, col = game.worldCollider;
    const P = (game.parks = { id: 'university_parks' });
    let dress = null;
    try { dress = buildParks(game); } catch (e) { console.error('[parks] dressing', e); }
    /** read-only: distance from (x,z) to the nearest pond duck, or Infinity (friends.js: Lorenzo's duck remark) */
    P.nearestDuck = (x, z) => (dress && dress.nearestDuck ? dress.nearestDuck(x, z) : Infinity);
    let detail = null, life = null, trees = null;
    try { detail = buildParkDetail(game); } catch (e) { console.error('[parks] detail', e); }
    try { trees = buildParkTrees(game); } catch (e) { console.error('[parks] trees', e); }
    try { life = buildParkPeople(game, detail); } catch (e) { console.error('[parks] people', e); }
    const parkArea = game.map.areas.find((a) => a.id === 'r12532311_2');
    const parkPoly = parkArea ? parkArea.poly : null;
    const inP = W.util.pointInPoly;
    const woods = game.map.areas.filter((a) => (a.kind === 'wood' || a.kind === 'scrub') && a.poly.some(([x, z]) => x > 0 && x < 870 && z > -1140 && z < -480)).map((a) => a.poly);
    const inPark = (x, z) => parkPoly && inP(x, z, parkPoly);
    const ok = (x, z) => {
      if (!inPark(x, z)) return false;
      for (const [dx, dz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) if (col.isWater(x + dx, z + dz)) return false;
      if (!col.isFree(x, z, 0.7)) return false;
      if (Math.hypot(x - CRICKET.c[0], z - CRICKET.c[1]) < 16) return false;
      for (const w of woods) if (inP(x, z, w)) return false;
      let road = false; W.roadGrid.queryRadius(x, z, 2.2, () => { road = true; }); if (road) return false;
      return true;
    };

    // ------------------------------------------------------------------------------------- the day's data (shared)
    const D = { day: null, messes: [], plan: null, yesterday: 0, local: [], bagged: new Set(), trodden: new Set() };
    const refreshDay = () => {
      const day = dayOf(game.time.now());
      if (day === D.day) return;
      D.day = day; D.messes = dailyMesses(day, ok); D.plan = surveyPlan(day, D.messes);
      D.yesterday = surveyPlan(day - 1, dailyMesses(day - 1, ok)).total;
      D.local.length = 0; D.bagged.clear(); D.trodden.clear();
      placeFrame(D.plan.quadrat);
    };
    const sec = () => game.time.hour * HOUR_S;
    const visible = () => { const h = game.time.hour, out = []; for (const m of D.messes) if (m.born <= h && !D.bagged.has(m.id)) out.push(m); for (const m of D.local) if (!D.bagged.has(m.id)) out.push(m); return out; };
    const counted = () => countedBy(D.plan, sec());

    // ------------------------------------------------------------------------------------- meshes: messes, stink, footprints, frame flags
    const swirlG = (() => {
      const parts = [];
      for (let i = 0; i < 3; i++) parts.push(new THREE.TorusGeometry(0.075 - i * 0.022, 0.03 - i * 0.004, 6, 12).rotateX(Math.PI / 2).translate(0, 0.025 + i * 0.038, 0).toNonIndexed());
      parts.push(new THREE.ConeGeometry(0.025, 0.05, 6).translate(0, 0.13, 0).toNonIndexed());
      const g = new THREE.BufferGeometry();
      for (const k of ['position', 'normal']) { const tot = parts.reduce((s, p) => s + p.attributes[k].array.length, 0), a = new Float32Array(tot); let o = 0; for (const p of parts) { a.set(p.attributes[k].array, o); o += p.attributes[k].array.length; } g.setAttribute(k, new THREE.BufferAttribute(a, 3)); }
      return g;
    })();
    const CAP = 96;
    const messIM = new THREE.InstancedMesh(swirlG, new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.55 }), CAP);
    messIM.count = 0; messIM.frustumCulled = false; messIM.castShadow = false; messIM.name = 'parks-messes'; game.worldScene.add(messIM);
    const stinkTex = canvasTex(64, 64, (g) => { g.strokeStyle = 'rgba(120,140,60,0.9)'; g.lineWidth = 4; for (const x of [18, 32, 46]) { g.beginPath(); for (let y = 60; y > 6; y -= 2) g.lineTo(x + Math.sin(y * 0.18 + x) * 5, y); g.stroke(); } });
    const stinkIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: stinkTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 }), 40);
    stinkIM.count = 0; stinkIM.frustumCulled = false; game.worldScene.add(stinkIM);
    const footTex = canvasTex(32, 64, (g) => { g.fillStyle = 'rgba(80,52,26,0.9)'; g.beginPath(); g.ellipse(16, 22, 10, 18, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(16, 52, 8, 10, 0, 0, 7); g.fill(); });
    const footIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.26).rotateX(-Math.PI / 2), W.layerMaterial(new THREE.MeshBasicMaterial({ map: footTex, transparent: true, depthWrite: false }), 'marking'), 40);
    footIM.count = 0; footIM.frustumCulled = false; game.worldScene.add(footIM);
    const flagG = (() => {
      const post = new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6).translate(0, 0.65, 0).toNonIndexed(), flag = new THREE.BoxGeometry(0.02, 0.22, 0.32).translate(0, 1.18, 0.17).toNonIndexed();
      const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); };
      paint(post, 0xe8e2d0); paint(flag, 0xf07018);
      const g = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'color']) { const a = new Float32Array(post.attributes[k].array.length + flag.attributes[k].array.length); a.set(post.attributes[k].array); a.set(flag.attributes[k].array, post.attributes[k].array.length); g.setAttribute(k, new THREE.BufferAttribute(a, 3)); }
      return g;
    })();
    const flagIM = new THREE.InstancedMesh(flagG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 4);
    flagIM.frustumCulled = false; game.worldScene.add(flagIM);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
    function placeFrame(qd) {
      const h = QUADRAT_SIZE / 2; [[-h, -h], [h, -h], [h, h], [-h, h]].forEach(([dx, dz], i) => { m4.compose(v3.set(qd[0] + dx, 0, qd[1] + dz), q.setFromAxisAngle(up, i * 0.7), sc.set(1, 1, 1)); flagIM.setMatrixAt(i, m4); });
      flagIM.instanceMatrix.needsUpdate = true;
    }
    let shown = [];
    function redrawMesses() {
      const list = visible(), h = game.time.hour, cam = game.camera.position;
      let n = 0, s = 0;
      shown = list;
      for (const m of list) {
        if (n >= CAP) break;
        const r = mulberry(m.id.length * 97 + Math.floor(m.x * 13) + Math.floor(-m.z * 7))(), size = [1.0, 1.3, 1.7][m.size];
        const trod = D.trodden.has(m.id);
        m4.compose(v3.set(m.x, 0.0, m.z), q.setFromAxisAngle(up, r * 6.28), sc.set(size * (trod ? 1.6 : 1), size * (trod ? 0.25 : 1), size * (trod ? 1.3 : 1)));
        messIM.setMatrixAt(n++, m4);
        if (!trod && freshness(m, h) === 'fresh' && s < 40 && (m.x - cam.x) ** 2 + (m.z - cam.z) ** 2 < 900) {
          for (const a of [0, Math.PI / 2]) { if (s >= 40) break; m4.compose(v3.set(m.x, 0.28 * size, m.z), q.setFromAxisAngle(up, a + r), sc.set(1, 1, 1)); stinkIM.setMatrixAt(s++, m4); }
        }
      }
      messIM.count = n; messIM.instanceMatrix.needsUpdate = true; stinkIM.count = s; stinkIM.instanceMatrix.needsUpdate = true;
    }

    // ------------------------------------------------------------------------------------- fresh messes from passing dogs
    const seenPed = new Set();
    function adoptPedMesses() {
      const ped = game.pedestrians; if (!ped || !ped.messes) return;
      const qd = D.plan.quadrat, sys = ped._sys;
      ped.messes.forEach((pm, i) => {
        const key = pm.t + ':' + Math.round(pm.x * 10);
        if (seenPed.has(key) || !inPark(pm.x, pm.z)) return;
        seenPed.add(key);
        D.local.push({ id: 'f' + key, x: pm.x, z: pm.z, born: game.time.hour, size: Math.floor(Math.random() * 3), inQ: inQuadrat(qd, pm.x, pm.z), local: true });
        // the system draws a tiny pebble there; ours replaces it (same position, same list — kept consistent)
        try { if (sys && sys.messMesh) { m4.makeScale(0, 0, 0); sys.messMesh.setMatrixAt(i, m4); sys.messMesh.instanceMatrix.needsUpdate = true; } } catch { /* optional */ }
      });
    }

    // ------------------------------------------------------------------------------------- Dr Sufrin
    let sufrin = null, lastSeg = -1, sayT = 0, walkerT = 4;
    // multiplayer: his remarks come from the shared clock (shash) and are said when ANY player is near (anyNear)
    const shash = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
    const anyNear = (x, z, r) => {
      const p = game.player; if (p.place === 'world' && Math.hypot(p.pos.x - x, p.pos.z - z) < r) return true;
      const o = game.net && game.net.connected ? game.net.others : null;
      if (o) for (const q of o.values()) if (q.place === 'world' && Math.hypot(q.tx - x, q.tz - z) < r) return true;
      return false;
    };
    const reacted = new WeakMap();
    // (made once — on the loading screen, see the warmup below — and kept: he only leaves the scene when far)
    let sufrinCh = null;
    const makeSufrin = () => { if (sufrinCh) return sufrinCh; const c = createCharacter(SUFRIN_LOOK); c.setLabel('Dr Sufrin'); c.voiceAs = 'sufrin'; { const s0 = c.say.bind(c); c.say = (t, secs) => { s0(t, secs); game.voice?.say('sufrin', t, { pos: c.group.position }); }; } return (sufrinCh = c); };
    function ensureSufrin(on) {
      if (on && !sufrin) { sufrin = makeSufrin(); game.worldScene.add(sufrin.group); lastSeg = -1; }
      else if (!on && sufrin) { sufrin.group.removeFromParent(); sufrin = null; }
    }
    const sPos = new THREE.Vector3();
    function tickSufrin(dt) {
      const st = sufrinAt(D.plan, sec());
      const near = Math.hypot(game.player.pos.x - (st ? st.x : 1e9), game.player.pos.z - (st ? st.z : 1e9)) < 250 && game.player.place === 'world';
      ensureSufrin(!!st && near);
      if (!sufrin || !st) return;
      const g = sufrin.group;
      g.position.set(st.x, 0, st.z); sPos.set(st.x, 0, st.z);
      if (st.heading !== null) { let d = st.heading - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 6); }
      else if (st.kind === 'crouch') { const m = D.messes.find((x) => x.id === st.mess); if (m) g.rotation.y = Math.atan2(m.x - st.x, m.z - st.z); }
      const pose = st.kind === 'crouch' ? 'crouch' : 'stand';
      if (sufrin.pose !== pose) sufrin.setPose(pose);
      sufrin.update(dt, st.moving ? 0.75 : 0);
      sufrin.headTurn(st.kind === 'peer' ? Math.sin(game.elapsed * 0.7) * 0.8 : 0);
      if (st.seg !== lastSeg) {
        lastSeg = st.seg;
        // (decided by the segment index and the shared clock, so every player near him sees the same remark)
        if (st.kind === 'crouch' && shash(st.seg, 1) < 0.8) { const n = countedBy(D.plan, D.plan.segs[st.seg].t1).size; sufrin.say(shash(st.seg, 2) < 0.5 ? `${AT_MESS[n % AT_MESS.length]} That makes ${n}.` : AT_MESS[(n * 3) % AT_MESS.length], 3.5); }
      }
      // a mutter per shared 13 s slot (most slots), heard by anyone within 30 m
      { const ms = Math.floor(game.time.now() / 13000); if (ms !== sayT && st.kind !== 'crouch') { const first = sayT === 0; sayT = ms; if (!first && shash(ms, 3) < 0.75 && anyNear(st.x, st.z, 30)) sufrin.say(MUTTER[Math.floor(shash(ms, 4) * MUTTER.length)], 5); } }
      // the Hawthorne effect: dog walkers he looks at turn sheepish (and may bag it)
      if ((walkerT -= dt) <= 0 && game.pedestrians) {
        walkerT = 2;
        const list = game.pedestrians.near(st.x, st.z, 12);
        for (const p of list) {
          if (!p.dog || p.scripted || (reacted.get(p) || 0) > game.elapsed) continue;
          reacted.set(p, game.elapsed + 40);
          sufrin.headTurn(Math.max(-1.2, Math.min(1.2, Math.atan2(p.x - st.x, p.z - st.z) - g.rotation.y)));
          sufrin.say(AT_WALKER[Math.floor(Math.random() * AT_WALKER.length)], 3);
          setTimeout(() => { try { p.character && p.character.say(WALKER_SHEEPISH[Math.floor(Math.random() * WALKER_SHEEPISH.length)], 3); } catch { /* */ } }, 900);
          const mine = D.local.find((m) => !D.bagged.has(m.id) && (m.x - p.x) ** 2 + (m.z - p.z) ** 2 < 64);
          if (mine) { D.bagged.add(mine.id); dirty = true; if (M.census && M.census.state === 'running' && Math.hypot(game.player.pos.x - mine.x, game.player.pos.z - mine.z) < 40) game.ui.toast('A dog walker hurriedly bags it under Dr Sufrin\'s gaze. "The Hawthorne effect," he notes.', 4); }
          break;
        }
      }
    }
    game.interact.add({
      pos: () => sPos, radius: 2.2, enabled: () => !!sufrin && game.player.place === 'world',
      label: () => (M.census && M.census.state !== 'running' ? 'Report back to Dr Sufrin' : M.census ? 'Dr Sufrin (survey in progress)' : 'Talk to Dr Sufrin'),
      onUse: () => talk(),
    });

    // ------------------------------------------------------------------------------------- the mission
    const M = { census: null, t0: 0, blip: null, steps: [], footT: 0, lastFoot: null, footN: 0 };
    let dirty = true;
    const now = () => performance.now() / 1000;
    function menu(title, text, options) {
      return new Promise((resolve) => {
        game.beginActivity({ name: 'parks-menu', pointer: 'free', onEnd: () => resolve(null) });
        const o = game.ui.openOverlay(), box = document.createElement('div');
        box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#16180f;border:2px solid #9ab070;border-radius:8px;padding:18px 22px;color:#f0ecd8;font-family:Georgia,serif;min-width:340px;max-width:560px';
        box.innerHTML = `<div style="font-size:20px;color:#c8dc90;font-weight:bold">${title}</div><div style="opacity:.85;margin:8px 0 10px;white-space:pre-line">${text}</div>`;
        for (const [label, val] of options) { const b = document.createElement('button'); b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;background:#22261a;color:#f0ecd8;border:1px solid #5a6a40;border-radius:4px;cursor:pointer;font:inherit'; b.innerHTML = label; b.onclick = () => { game.activity && (game.activity.onEnd = null); game.endActivity(); resolve(val); }; box.appendChild(b); }
        o.appendChild(box);
      });
    }
    async function talk() {
      if (!sufrin) return;
      const tally = counted().size;
      if (M.census && M.census.state === 'running') { sufrin.say(`${M.census.score} of ${M.census.target}. Carry on.`, 3); return; }
      if (M.census) return report();
      await game.ui.dialog('Dr Sufrin', [
        'Ah. Good afternoon. You\'ll forgive me if I don\'t shake hands.',
        'I am conducting a census of canine deposits in the Parks. Today\'s sampling frame is the square marked by the four orange flags.',
        'Formally: a deposit is counted exactly once, by exactly one observer, if and only if it lies within the frame and has not been bagged. The specification is on the back of the clipboard.',
        `So far today: ${tally}. Yesterday's total: ${D.yesterday}. The trend is, regrettably, a trend.`,
      ]);
      const v = await menu('The Parks Census', `I could use a research assistant.\nLog ${MISSION.basic.target} deposits in the frame that I haven't counted, in the next ${MISSION.basic.time / 60} minutes. Don't step in any — it confounds the data, and the carpet.`, [
        [`Accept (£${MISSION.basic.pay} + bonuses)`, 'basic'], [`Accept the harder protocol: classify each one by size and freshness (£${MISSION.classify.pay})`, 'classify'], ['Not today, thank you', null]]);
      if (v) start(v);
      else sufrin && sufrin.say('Quite right. Bring a bag.', 3);
    }
    function start(variant) {
      refreshDay();
      M.census = new Census(variant, now()); M.census.trodden = D.trodden;
      const qd = D.plan.quadrat;
      if (M.blip) game.ui.removeBlip(M.blip);
      M.blip = game.ui.addBlip(qd[0], qd[1], '#f07018', 'Census frame');
      game.ui.toast(variant === 'classify' ? 'Find, classify (size & freshness) and [E] record. Mind your feet.' : 'Find and [E] record deposits inside the flags that he hasn\'t counted. Mind your feet.', 5);
      return M.census;
    }
    async function report() {
      const c = M.census; if (!c) return;
      c.tick(now());
      const pay = c.payout(), st = (game.state.parks = game.state.parks || {});
      const rank = addToLeague(st, { day: D.day, score: c.score, steps: c.steps, variant: c.variant, name: game.player.name });
      if (pay > 0) game.pay(pay); game.save();
      if (M.blip) { game.ui.removeBlip(M.blip); M.blip = null; }
      game.ui.objective(null);
      const lines = c.state === 'won'
        ? [`${c.score} logged${c.steps ? `, ${c.steps} trodden in (I saw)` : ', and clean shoes'}. Excellent methodology.`, `Here is £${pay.toFixed(2)} from the departmental petty cash. Strictly for bags.`]
        : [`${c.score} of ${c.target}. An incomplete sample${c.steps ? ' — and a contaminated one' : ''}. Still, data are data.`, pay > 0 ? `£${pay.toFixed(2)}, pro rata.` : 'I\'m afraid the budget doesn\'t stretch to incomplete samples.'];
      lines.push(rank >= 0 ? `You are number ${rank + 1} in my league table of assistants.` : 'Not quite the league table, I\'m afraid.');
      M.census = null;
      await game.ui.dialog('Dr Sufrin', lines);
      showLeague();
    }
    function showLeague() {
      const st = game.state.parks || {}; if (!st.league || !st.league.length) return;
      game.ui.toast('Census league: ' + st.league.slice(0, 5).map((e, i) => `${i + 1}. ${e.name || 'you'} ${e.score}${e.variant === 'classify' ? '★' : ''}`).join(' · '), 7);
    }
    function nearestMess(r = 1.6) {
      const p = game.player.pos; let best = null, bd = r * r;
      for (const m of shown) { const d = (m.x - p.x) ** 2 + (m.z - p.z) ** 2; if (d < bd) { bd = d; best = m; } }
      return best;
    }
    const recPos = new THREE.Vector3();
    game.interact.add({
      pos: () => { const m = nearestMess(); if (m) recPos.set(m.x, 0, m.z); else recPos.set(1e9, 0, 1e9); return recPos; }, radius: 1.6,
      enabled: () => !!(M.census && M.census.state === 'running') && game.player.place === 'world',
      label: () => { const m = nearestMess(); if (!m) return 'Record'; const w = M.census.why(m, counted()); return w === 'counted' ? 'Already counted by Dr Sufrin (a circled tally mark)' : w === 'outside' ? 'Outside the sampling frame' : w === 'logged' ? 'Logged' : w === 'trodden' ? 'Contaminated sample' : 'Record'; },
      onUse: () => recordNearest(),
    });
    async function recordNearest(guess) {
      const c = M.census, m = nearestMess(); if (!c || !m) return { ok: false, reason: 'none' };
      const why = c.why(m, counted());
      if (why) { game.ui.toast({ counted: 'He\'s already counted that one.', outside: 'Outside the sampling frame. Scientifically speaking, it doesn\'t exist.', logged: 'Already logged.', trodden: 'Contaminated sample. (That was you.)' }[why] || why, 3); return { ok: false, reason: why }; }
      const truth = { size: SIZES[m.size], fresh: freshness(m, game.time.hour) };
      if (c.variant === 'classify' && !guess) {
        guess = await menu('Classify the specimen', 'Size and freshness, please. Be honest.', SIZES.flatMap((s) => [[`${s}, fresh`, { size: s, fresh: 'fresh' }], [`${s}, old`, { size: s, fresh: 'old' }]]));
        if (!guess) return { ok: false, reason: 'cancel' };
      }
      const r = c.record(m, counted(), now(), guess, truth);
      if (r.ok) {
        game.ui.toast(r.delta > 0 ? `Logged. ${c.score}/${c.target}` : `Misclassified (it was ${truth.size}, ${truth.fresh}). ${c.score}/${c.target}`, 2.5);
        if (c.state === 'won') game.ui.toast('That\'s the sample. Report back to Dr Sufrin.', 5);
      }
      return r;
    }
    function squelch(m) {
      const A = game.audio;
      A.noise(0.35, { freq: 260, q: 0.8, type: 'lowpass', gain: 0.35 }); A.tone(110, 0.25, { type: 'sine', gain: 0.12 }); A.noise(0.2, { freq: 900, q: 3, gain: 0.08, when: 0.08 });
      M.footT = 25; dirty = true;
      const lines = ['Oh dear. You\'ve contaminated the sample.', 'That one now counts as a negative observation.', 'I shall have to note that in the methodology section.'];
      const d = sufrin ? Math.hypot(sufrin.group.position.x - m.x, sufrin.group.position.z - m.z) : 999;
      if (d < 40 && sufrin) sufrin.say(lines[Math.floor(Math.random() * lines.length)], 4); else game.ui.toast('Squelch. You\'ve trodden in it.', 3);
      if (M.census && M.census.state === 'running') game.ui.toast(`−1 for treading in it. ${M.census.score}/${M.census.target}`, 2.5);
    }
    function footprints(dt) {
      if (M.footT <= 0) return;
      M.footT -= dt;
      const p = game.player.pos;
      if (!M.lastFoot || Math.hypot(p.x - M.lastFoot[0], p.z - M.lastFoot[1]) > 0.55) {
        const side = (M.footN % 2 ? 1 : -1) * 0.1, h = game.player.heading;
        m4.compose(v3.set(p.x + Math.cos(h) * side, 0.0, p.z - Math.sin(h) * side), q.setFromAxisAngle(up, h), sc.set(1, 1, 1));
        footIM.setMatrixAt(M.footN % 40, m4); footIM.count = Math.min(40, M.footN + 1); footIM.instanceMatrix.needsUpdate = true;
        M.footN++; M.lastFoot = [p.x, p.z];
      }
    }

    // ------------------------------------------------------------------------------------- hooks
    P.messes = () => visible().map((m) => ({ ...m, counted: counted().has(m.id), fresh: freshness(m, game.time.hour), trodden: D.trodden.has(m.id) }));
    P.plan = () => ({ quadrat: D.plan.quadrat, total: D.plan.total, yesterday: D.yesterday, segs: D.plan.segs.length });
    P.tally = () => counted().size;
    P.jump = () => { const st = sufrinAt(D.plan, sec()); const x = st ? st.x : D.plan.quadrat[0], z = st ? st.z : D.plan.quadrat[1]; game.player.teleport(x + 3, z + 3, Math.atan2(-3, -3)); game.cameraPitch = 0.3; game.cameraDist = 6; return st ? st.kind : 'not surveying now'; };
    P.start = (variant = 'basic') => { const c = start(variant); return { target: c.target, time: c.limit }; };
    P.recordNearest = (g) => recordNearest(g);
    P.report = () => report();
    P.goTo = (id) => { const m = visible().find((x) => x.id === id); if (m) game.player.teleport(m.x + 0.9, m.z, -Math.PI / 2); return !!m; };
    P.tread = () => { const m = visible().find((x) => !D.trodden.has(x.id)); if (m) game.player.teleport(m.x, m.z, 0); return m ? m.id : null; };
    P.view = (x, y, z, tx, ty, tz, fov = 60) => game.beginActivity({ name: 'view', pointer: 'free', camera(dt, cam) { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); }, onEnd() { game.camera.fov = 60; game.camera.updateProjectionMatrix(); } });
    P.stats = () => ({ calls: game.renderer.info.render.calls, tris: game.renderer.info.render.triangles, messes: messIM.count, stink: stinkIM.count, sufrin: !!sufrin, day: D.day, local: D.local.length });
    Object.defineProperty(P, 'census', { get: () => M.census });
    P.data = D;
    P.detail = () => (detail ? detail.stats() : null);
    P.life = () => (life ? life.stats() : null);
    P.trees = () => (trees ? { planted: trees.count, cleared: trees.removed } : null);

    // ------------------------------------------------------------------------------------- per frame
    let slow = 0, objT = 0;
    refreshDay();
    // Loading screen (game.warmups, world/prewarm.js): the park's people are made now instead of in the frame the player
    // arrives (one frame of ~40 ms of createCharacter, and the bats' program linking on its first draw), hidden; the
    // never-drawn materials among them drawn once out of sight (world.warmDraw)
    (game.warmups || (game.warmups = [])).push({ id: 'university_parks', fn: () => {
      const geos = life && life.warm ? life.warm() : null;
      if (geos && geos.length && W.warmDraw) W.warmDraw(null, { upload: geos, prio: 1, id: 'university_parks:buffers' });
      const g = new THREE.Group(), sf = makeSufrin(); g.add(sf.group);
      const p = W.warmDraw ? W.warmDraw(g, { prio: 2, id: 'university_parks' }) : null;
      const back = () => g.remove(sf.group);
      if (p) p.then(back, back); else back();
      return p;
    } });
    return {
      update(dt) {
        const p = game.player.pos, far = game.player.place !== 'world' || Math.hypot(p.x - CENTRE[0], p.z - CENTRE[1]) > 650;
        messIM.visible = stinkIM.visible = flagIM.visible = !far;
        if (trees && game.player.place === 'world') trees.update();
        if (detail) detail.update(dt, p.x, p.z, far);
        if (life) life.update(dt, p.x, p.z, far);
        if (far) { ensureSufrin(false); return; }
        if (dress) dress.update(dt, p.x, p.z);
        if ((slow -= dt) <= 0) { slow = 1; refreshDay(); adoptPedMesses(); dirty = true; }
        if (dirty) { dirty = false; redrawMesses(); }
        tickSufrin(dt);
        // treading
        if (inPark(p.x, p.z) && game.player.onGround !== false && !game.player.vehicle) {
          for (const m of shown) {
            if (D.trodden.has(m.id) || (m.x - p.x) ** 2 + (m.z - p.z) ** 2 > 0.08) continue;
            if (M.census && M.census.state === 'running') { const hit = M.census.step(p.x, p.z, [m], now()); if (hit) squelch(hit); }
            else { D.trodden.add(m.id); squelch(m); }
            break;
          }
        }
        footprints(dt);
        if (M.census) {
          const c = M.census; c.tick(now());
          if ((objT -= dt) <= 0) {
            objT = 0.25;
            const left = Math.ceil(c.timeLeft(now())), mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
            game.ui.objective(c.state === 'running' ? `Parks Census${c.variant === 'classify' ? ' (classify)' : ''}: ${c.score}/${c.target} logged · ${mm}:${ss} left · inside the orange flags` : c.state === 'won' ? 'Parks Census: sample complete — report back to Dr Sufrin' : 'Parks Census: out of time — report back to Dr Sufrin');
          }
        }
      },
    };
  },
};
