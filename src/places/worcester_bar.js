// Worcester College Cellar Bar: the vaulted cellar under the Hall, laid out from the college's own fire plan of it
// (_bar_plan.js). A walk-in room (core/interiors.js "seamless"): it sits in place under the Hall, twelve risers below
// Pump Quad; you walk down the flight in the court's corner (the court's own geometry, _worcester_pump.js), through the
// lobby in the annex and in at the double doors in the Hall's wall, three more steps down inside. Its people, lights
// and bop exist while the room is SHOWN (seen through the doors or the window), not only while you are in it.
// Room: _bar_build.js (+ helpers in _bar_room.js). The games: darts (_bar_darts.js + _bar_darts_rules.js) and pool
// (_bar_pool.js + _bar_pool_physics.js), their fittings built with _bar_geo.js. Sound: _bar_audio.js. Team roster:
// _bar_roster.js (darts nicknames: scoreboards only). People, drinks, jukebox and bops here.
// Test hooks: game.bar.{darts, pool, drink(kind, free), forceBop (true/false/null), view(...), stats(), population()}.
import * as THREE from 'three';
import { LAY, buildRoomSteps } from './_bar_build.js';
import { seamless as barSeamless, toWorld as barToWorld, FACING as BAR_FACING } from './_bar_plan.js';
import { BarAudio, TUNES } from './_bar_audio.js';
import { createDarts } from './_bar_darts.js';
import { createPool } from './_bar_pool.js';
import { OPPONENTS, tagName } from './_bar_roster.js';
import { randomLook } from '../core/characters.js';
import { linkLeaves } from './_worcint_chapel.js';
import { dayOf } from '../core/time.js';

const ID = 'worcester_bar';
const DRINKS = {
  pint: { name: 'a pint', price: 2.8, drunk: 0.12, liquid: 0xd8901e, foam: true },
  sting: { name: 'a Sting', price: 4.5, drunk: 0.3, liquid: 0xd8461a, straw: true },
  soft: { name: 'a soft drink', price: 1.0, drunk: -0.02, liquid: 0x3a160a },
};
const BARTENDER_LINES = ['What can I get you?', 'Stings are £4.50.', 'A Sting? Four spirits. Do not ask which four.', 'Pint of the usual?', 'Bop on Friday — get your Stings in early.', 'No glass on the dance floor, please.'];
// what the room says about a game in progress (bubbles; new lines, listed for the voice render)
const WATCH_LINES = { pool: ['Winner stays on.', 'Who is next on the table?', 'Put your 50p on the rail.', 'He is going for the double.'], darts: ['Who is chalking?', 'Mugs away.', 'Good arrows tonight.', 'Next leg is mine.'] };
const PATRON_LINES = ['Have you done the reading?', 'Another round?', 'Who is on darts tonight?', 'I have a tute at nine.', 'Bop later?', 'Get the Stings in.', 'Is the pool table free?', 'Collections next week...'];

export default {
  id: ID,
  install(game) {
    const audio = new BarAudio(game);
    const bar = (game.bar = { id: ID, audio, room: null, scene: null, people: null, forceBop: null, roster: OPPONENTS });
    import('./_people.js').then((m) => { bar.people = m.PEOPLE || null; }).catch(() => {});
    let R = null, built = false;
    const peds = [];                // spawned NPC records {ped, kind, roster?}
    let popSig = '', popT = 0;
    const bop = { on: false, group: null, lasers: null, laserPos: null, dots: null, beat: 0 };
    let cup = null, cupT = 0, sipT = 0;
    let darts = null, pool = null, watchT = 8;

    bar.view = (x, y, z, tx, ty, tz, fov = 60) => {
      game.beginActivity({ name: 'view', pointer: 'free', camera(dt, cam) { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); }, onEnd() { game.camera.fov = 60; game.camera.updateProjectionMatrix(); } });
    };
    bar.stats = () => { const i = game.renderer.info.render; return { calls: i.calls, tris: i.triangles, npcs: peds.length, lights: countLights() }; };
    const countLights = () => { let n = 0; bar.scene && bar.scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) n++; }); return n; };

    // ------------------------------------------------------------------------------------------- time of day
    const isBop = () => {
      if (bar.forceBop !== null && bar.forceBop !== undefined) return !!bar.forceBop;
      const h = game.time.hour; if (!(h >= 22 || h < 1)) return false;
      const day = dayOf(game.time.now()) - (h < 1 ? 1 : 0);   // the game day, shared by all players
      return ((day % 2) + 2) % 2 === 0;
    };
    const crowdFor = (h) => (h >= 6 && h < 11 ? 0 : h < 17 && h >= 11 ? 2 : h >= 17 && h < 20 ? 4 : h >= 20 || h < 2 ? 4 : 1);

    // ------------------------------------------------------------------------------------------- people
    const spawn = (x, z, look, opts) => {
      if (!game.pedestrians) return null;
      try { const p = game.pedestrians.spawnAt(x, z, look, { place: ID, scene: bar.scene, knockable: false, ...opts }); p.y = 0; const g = p.character && p.character.group; if (g && g.position) { g.position.set(x, 0, z); g.rotation.y = opts && opts.heading || 0; } return p; } catch (e) { console.error('[bar] spawn', e); return null; }
    };
    function clearPeople(keep = null) { for (let i = peds.length - 1; i >= 0; i--) { if (keep && keep(peds[i])) continue; game.pedestrians && game.pedestrians.remove(peds[i].ped); peds.splice(i, 1); } }
    function rngFrom(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    // ordinary pub clothes from the roster (no coat), hair/build from the team photo
    function teamLook(t, prop) { const l = { ...randomLook('team-' + t.nick, { outfit: 'casual' }), jacket: null, hat: null, scarf: null, backpack: null, glasses: false, skirt: false, dress: false, skin: [0xeec7a8, 0xe8bc9a, 0xf0cdb2][t.nick.length % 3], ...t.look, prop }; return l; }
    function teamToday() {
      const r = rngFrom(dayOf(game.time.now()) * 7 + 3), pool2 = OPPONENTS.slice(), out = [];
      while (out.length < 3 && pool2.length) out.push(pool2.splice(Math.floor(r() * pool2.length), 1)[0]);
      return out;
    }
    function populate() {
      if (!built || !game.pedestrians) return;
      const h = game.time.hour, b = isBop(), n = b ? 4 : crowdFor(h), teamOn = b || h >= 17 || h < 1.5;
      const sig = `${b}|${n}|${teamOn}|${dayOf(game.time.now())}`;
      if (sig === popSig) return;
      popSig = sig;
      clearPeople((p) => p.kind === 'borrowed');
      const day = dayOf(game.time.now()), r = rngFrom(day * 13 + 1);
      // bartender (outfit 'barstaff'), behind the counter
      const bt = spawn(LAY.bar.backX + 0.3, LAY.bar.front - LAY.bar.depth - 0.55, randomLook(1000 + (day % 5), { outfit: 'barstaff' }), { heading: 0, pose: 'stand', lines: BARTENDER_LINES, role: 'barstaff' });
      if (bt) peds.push({ ped: bt, kind: 'bartender' });
      // darts team in the alcove (first names on tags; nicknames only in the darts UI)
      if (teamOn) {
        const team = teamToday();
        const greet = ['Grab some arrows.', 'You playing?'];
        team.forEach((t, i) => {
          if (i === 2 || (i === 1 && b)) return; // two of today's three in the alcove (draw-call budget)
          const look = teamLook(t, i === 0 ? 'dart' : 'pint');
          const lines = [...greet, ...t.lines];
          let p = null;
          if (i === 0) p = spawn(LAY.oche + 0.18, LAY.board.z + 0.12, look, { heading: -Math.PI / 2, pose: 'throw', label: tagName(t), lines });
          else if (i === 1) p = spawn(LAY.oche - 0.6, LAY.alcove.ledgeZ + 0.34, look, { heading: Math.PI, pose: 'lean', label: tagName(t), lines });      // (leaning on the alcove's stone ledge)
          else { const s = R.seats.find((q) => q.kind === 'darts'); if (s) p = spawn(s.x, s.z, look, { heading: s.h, pose: 'sit', label: tagName(t), lines }); }
          if (p) { p.roster = t; peds.push({ ped: p, kind: i === 0 ? 'thrower' : 'team', roster: t }); }
        });
      }
      // patrons
      if (b) {
        for (let i = 0; i < n; i++) {
          const x = -2.4 + (i % 4) * 1.5 + (r() - 0.5) * 0.5, z = LAY.ZM + 1.25 + Math.floor(i / 4) * 1.4 + (r() - 0.5) * 0.4;      // (the south aisle's floor, clear of the pier)
          const p = spawn(x, z, randomLook(day * 100 + i, { outfit: r() < 0.5 ? 'clubbing' : 'casual' }), { heading: r() * 6.28, pose: 'dance', lines: ['Tune!', 'Get the Stings in!', 'Wooo!'] });
          if (p) peds.push({ ped: p, kind: 'patron' });
        }
      } else {
        const seats = R.seats.filter((s) => s.kind !== 'darts');
        const used = new Set();
        for (let i = 0; i < n; i++) {
          if (i === n - 1 && n >= 4) { // one standing at the bar
            const p = spawn(LAY.bar.x1 - 0.6, LAY.bar.front + 0.45, randomLook(day * 100 + i, { outfit: 'casual', prop: 'pint' }), { heading: Math.PI, pose: 'lean', lines: PATRON_LINES });
            if (p) peds.push({ ped: p, kind: 'patron' }); continue;
          }
          let s = null; for (let k = 0; k < 20 && !s; k++) { const c = seats[Math.floor(r() * seats.length)]; if (!used.has(c)) s = c; }
          if (!s) continue; used.add(s);
          const p = spawn(s.x, s.z, randomLook(day * 100 + i, { outfit: 'casual', prop: 'pint' }), { heading: s.h, pose: 'sit', lines: PATRON_LINES });
          if (p) peds.push({ ped: p, kind: 'patron' });
        }
      }
      audio.setCrowd(peds.length);
    }
    // darts opponent: the team member steps up with darts in hand (respawned with a dart prop, returned afterwards)
    bar.borrowTeamMember = (r) => {
      const ex = peds.find((p) => p.kind === 'borrowed' && p.roster === r); if (ex) return ex.ped;
      const i = peds.findIndex((p) => p.roster === r);
      if (i >= 0) { game.pedestrians.remove(peds[i].ped); peds.splice(i, 1); }
      const thr = peds.findIndex((p) => p.kind === 'thrower');
      if (thr >= 0) { const t = peds[thr]; t.ped.x = LAY.oche + 2.3; t.ped.z = LAY.board.z + 1.9; t.ped.homeX = t.ped.x; t.ped.homeZ = t.ped.z; t.ped.heading = -Math.PI / 2 - 0.25; t.ped.character.setPose('stand'); t.kind = 'team'; }
      const look = teamLook(r, 'dart');
      const p = spawn(LAY.oche + 1.0, LAY.board.z + 0.75, look, { heading: -Math.PI / 2, pose: 'stand', label: tagName(r), lines: r.lines });
      if (p) { p.roster = r; peds.push({ ped: p, kind: 'borrowed', roster: r }); }
      return p;
    };
    bar.returnTeamMember = (ped) => { const i = peds.findIndex((p) => p.ped === ped); if (i >= 0) { game.pedestrians.remove(ped); peds.splice(i, 1); } popSig = ''; populate(); };
    // the bar regular at the pool table: the opponent, or (watching) sat on the chest freezer while the player practises
    bar.spawnPoolOpponent = (reg, watching = false) => { const p = spawn(LAY.table.x + 1.38, LAY.table.z + 1.3, { ...randomLook('pool-' + reg.name, reg.look), ...reg.look }, { heading: -Math.PI / 2, pose: watching ? 'sit' : 'stand', label: reg.name, lines: ['Nice shot.', 'Unlucky.', 'Your break.'] }); if (p) { p.y = LAY.pool.floor; if (p.character.group.position) p.character.group.position.y = p.y; peds.push({ ped: p, kind: 'borrowed' }); } return p; };
    // somebody of the team standing by the board (not the one at the oche): chalks, calls the scores, has opinions
    bar.dartsOnlooker = () => { const q = peds.find((p) => p.kind === 'team'); return q ? q.ped : null; };
    bar.removePoolOpponent = (ped) => { const i = peds.findIndex((p) => p.ped === ped); if (i >= 0) { game.pedestrians.remove(ped); peds.splice(i, 1); } };
    bar.refresh = () => { setBop(isBop()); popSig = ''; populate(); return { bop: bop.on, npcs: peds.length }; };
    bar.population = () => peds.map((p) => ({ kind: p.kind, pose: p.ped.character.pose, label: p.ped.label || null }));

    // ------------------------------------------------------------------------------------------- drinks
    const cupMats = { plastic: new THREE.MeshStandardMaterial({ color: 0xe8eef2, transparent: true, opacity: 0.35, roughness: 0.15, depthWrite: false }), straw: new THREE.MeshStandardMaterial({ color: 0x111111 }) };
    function makeCup(kind) {
      const d = DRINKS[kind], g = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.033, 0.15, 12, 1, true), cupMats.plastic); outer.position.y = 0.075; g.add(outer);
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.033, 0.12, 12), new THREE.MeshStandardMaterial({ color: d.liquid, roughness: 0.3, transparent: true, opacity: 0.9 })); liq.position.y = 0.062; g.add(liq);
      if (d.foam) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.015, 12), new THREE.MeshStandardMaterial({ color: 0xf2ead2 })); f.position.y = 0.128; g.add(f); }
      if (d.straw) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 5), cupMats.straw); s.position.set(0.012, 0.15, 0); s.rotation.z = -0.25; g.add(s); }
      return g;
    }
    const carry = (k) => { try { if (game.net && game.net.setCarried) game.net.setCarried(k); } catch { /* */ } };      // (what the other players see in our hand: core/_mp_actions.js)
    function dropCup() { if (cup) { cup.removeFromParent(); cup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); cup = null; carry(null); } }
    bar.drink = (kind = 'pint', free = false) => {
      const d = DRINKS[kind]; if (!d) return false;
      if (!free && !game.pay(-d.price)) { game.ui.toast(`You can't afford ${d.name} (£${d.price.toFixed(2)}).`, 3); return false; }
      const p = game.player; p.drunk = Math.max(0, Math.min(1, (p.drunk || 0) + d.drunk));
      dropCup(); cup = makeCup(kind);
      // held upright in the right hand with the forearm raised (forearm frame: -y along the arm, +z up when bent)
      cup.rotation.x = Math.PI / 2; cup.position.set(0, 0.02, -0.06);
      p.character.anchors.handR.add(cup); cupT = 45; sipT = 1.5; carry('pint');
      audio.coin();
      if (!free) game.ui.toast(`${d.name[0].toUpperCase() + d.name.slice(1)} — £${d.price.toFixed(2)}`, 2.5);
      return true;
    };
    function orderMenu() {
      game.beginActivity({ name: 'bar-menu', pointer: 'free' });
      const o = game.ui.openOverlay(), box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#14100c;border:2px solid #e584ab;border-radius:8px;padding:18px 22px;color:#f4ecd8;font-family:Georgia,serif;min-width:320px';
      box.innerHTML = `<div style="font-size:22px;color:#e584ab;font-weight:bold">Cellar Bar</div><div style="opacity:.7;margin-bottom:8px">You have £${game.state.money.toFixed(2)}</div>`;
      const btn = (label, fn) => { const b = document.createElement('button'); b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;background:#221a12;color:#f4ecd8;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font:inherit'; b.innerHTML = label; b.onclick = fn; box.appendChild(b); };
      btn('Pint — <b>£2.80</b>', () => { game.endActivity(); bar.drink('pint'); });
      btn('The Sting — house drink: four spirits (nobody will say which) and mixer, plastic pint cup, black straw — <b>£4.50</b>', () => { game.endActivity(); bar.drink('sting'); });
      btn('Soft drink — <b>£1.00</b>', () => { game.endActivity(); bar.drink('soft'); });
      btn('Nothing, thanks', () => game.endActivity());
      o.appendChild(box);
    }
    function jukebox() {
      if (bop.on) { game.ui.toast("The DJ's on — no jukebox during the bop.", 3); return; }
      if (!game.pay(-0.5)) { game.ui.toast('You need 50p for the jukebox.', 3); return; }
      audio.coin();
      const name = audio.play(Math.floor(Math.random() * TUNES.length));
      game.ui.toast(`Jukebox: "${name}"`, 3);
    }

    // ------------------------------------------------------------------------------------------- bop visuals
    function buildBop(scene) {
      const g = new THREE.Group(); g.visible = false; scene.add(g); bop.group = g;
      // lasers from a projector on the DJ table
      const N = 26; bop.laserPos = new Float32Array(N * 6); const col = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) { const c = i % 3 === 0 ? [1, 0.15, 0.2] : [0.2, 1, 0.3]; for (let k = 0; k < 2; k++) col.set(k === 0 ? c : c.map((v) => v * 0.6), i * 6 + k * 3); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(bop.laserPos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      bop.lasers = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 }));
      bop.lasers.frustumCulled = false; g.add(bop.lasers);
      // laser "starfield" dots on the vault
      const M = 220; bop.dotBase = new Float32Array(M * 2); bop.dotPos = new Float32Array(M * 3);
      for (let i = 0; i < M; i++) { bop.dotBase[i * 2] = LAY.X0 + 0.3 + Math.random() * (LAY.X1 - LAY.X0 - 0.6); bop.dotBase[i * 2 + 1] = LAY.Z0 + 0.3 + Math.random() * (LAY.Z1 - LAY.Z0 - 0.6); }
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(bop.dotPos, 3));
      bop.dots = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x40ff60, size: 0.05, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      bop.dots.frustumCulled = false; g.add(bop.dots);
      // balloons
      const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.3 }), 34);
      const m = new THREE.Matrix4(), c = new THREE.Color(), cols = [0xe584ab, 0x111111, 0xf0d020, 0x30c050, 0x3060e0, 0xe03030];
      for (let i = 0; i < 34; i++) {
        const onFloor = i < 22, x = LAY.X0 + 0.5 + Math.random() * (LAY.X1 - LAY.X0 - 1.6), z = onFloor ? LAY.ZM + 0.5 + Math.random() * 2.2 : LAY.Z0 + 0.5 + Math.random() * (LAY.Z1 - LAY.Z0 - 1);
        const y = onFloor ? 0.15 : R.ceil(x, z) - 0.17;
        m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(0.13, 0.16, 0.13)); bm.setMatrixAt(i, m); bm.setColorAt(i, c.setHex(cols[i % cols.length]));
      }
      g.add(bm);
      // DJ table with the laser projector, in front of the screen
      const djG = new THREE.BoxGeometry(0.7, 0.85, 1.5).translate(0, 0.425, 0).toNonIndexed(), prG = new THREE.BoxGeometry(0.2, 0.12, 0.2).translate(-0.1, 0.92, 0.4).toNonIndexed();
      const djP = new Float32Array([...djG.attributes.position.array, ...prG.attributes.position.array]), djN = new Float32Array([...djG.attributes.normal.array, ...prG.attributes.normal.array]);
      const djGeo = new THREE.BufferGeometry(); djGeo.setAttribute('position', new THREE.BufferAttribute(djP, 3)); djGeo.setAttribute('normal', new THREE.BufferAttribute(djN, 3));
      const dj = new THREE.Mesh(djGeo, new THREE.MeshStandardMaterial({ color: 0x141414, emissive: 0x082a0a })); dj.position.set(LAY.dj.x, 0, LAY.dj.z); g.add(dj);
      const pinkWash = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.15), new THREE.MeshBasicMaterial({ color: 0xff40c0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); pinkWash.position.set(LAY.X1 - 0.09, 1.875, LAY.screen.z); pinkWash.rotation.y = -Math.PI / 2; g.add(pinkWash);
      // trays of plastic cups on the bar, part-filled with amber
      const NC = 66, cupG = new THREE.CylinderGeometry(0.04, 0.03, 0.12, 8, 1, true), liqG = new THREE.CylinderGeometry(0.036, 0.03, 0.04, 8);
      const cups = new THREE.InstancedMesh(cupG, cupMats.plastic, NC), liq = new THREE.InstancedMesh(liqG, new THREE.MeshStandardMaterial({ color: 0xd08a20, roughness: 0.3 }), NC);
      for (let i = 0; i < NC; i++) {
        const x = LAY.bar.x0 + 0.25 + (i % 22) * 0.09, z = LAY.bar.front - 0.12 - Math.floor(i / 22) * 0.09, y = LAY.bar.top;
        m.makeTranslation(x, y + 0.06, z); cups.setMatrixAt(i, m); m.makeTranslation(x, y + 0.02, z); liq.setMatrixAt(i, m);
      }
      g.add(cups, liq);
    }
    function bopTick(dt) {
      const t = game.elapsed, ph = audio.beatPhase;   // the bop track's own beat (shared clock)
      const src = [LAY.dj.x - 0.1, 0.95, LAY.dj.z + 0.4], P = bop.laserPos, N = P.length / 6;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * 2.2 - 1.1 + Math.sin(t * 0.9 + i * 0.37) * 0.35, reach = 7 + 9 * (0.5 + 0.5 * Math.sin(t * 0.6 + i));
        const x = src[0] - Math.cos(a) * reach, z = src[2] + Math.sin(a) * reach * 0.8, zc = Math.max(LAY.Z0 + 0.1, Math.min(LAY.Z1 - 0.1, z)), xc = Math.max(LAY.X0 + 0.1, x);
        P[i * 6] = src[0]; P[i * 6 + 1] = src[1]; P[i * 6 + 2] = src[2];
        P[i * 6 + 3] = xc; P[i * 6 + 4] = R.ceil(xc, zc) - 0.03; P[i * 6 + 5] = zc;
      }
      bop.lasers.geometry.attributes.position.needsUpdate = true;
      bop.lasers.material.opacity = 0.55 + 0.4 * (ph < 0.5 ? 1 : 0);
      const D = bop.dotPos, B = bop.dotBase;
      for (let i = 0; i < B.length / 2; i++) { const x = Math.max(LAY.X0 + 0.1, Math.min(LAY.X1 - 0.1, B[i * 2] + Math.sin(t * 0.5 + i) * 0.8)), z = Math.max(LAY.Z0 + 0.1, Math.min(LAY.Z1 - 0.1, B[i * 2 + 1] + Math.cos(t * 0.4 + i * 1.3) * 0.6)); D[i * 3] = x; D[i * 3 + 1] = R.ceil(x, z) - 0.02; D[i * 3 + 2] = z; }
      bop.dots.geometry.attributes.position.needsUpdate = true;
      const L = R.lights, hue = (t * 0.07) % 1, pulse = 0.55 + 0.45 * Math.exp(-ph * 5);
      L.west.color.setHSL((hue + 0.85) % 1, 0.9, 0.5); L.west.intensity = L.west.userData.base * 0.4 * pulse;
      L.bay3.color.setHSL((hue + 0.55) % 1, 0.9, 0.5); L.bay3.intensity = L.bay3.userData.base * 0.4 * pulse;
      L.east.color.setHSL(0.9, 0.9, 0.55); L.east.intensity = L.east.userData.base * 0.7;
    }
    function setBop(on) {
      if (bop.on === on) return;
      bop.on = on; if (bop.group) bop.group.visible = on;
      const L = R.lights;
      if (!on) for (const k of ['west', 'bay3', 'east']) { L[k].color.setHex(L[k].userData.color); L[k].intensity = L[k].userData.base; }
      if (bar.hemi) bar.hemi.intensity = on ? 0.04 : 0.35;
      if (bar.amb) bar.amb.intensity = on ? 0.04 : 0.16;
      L.bar.intensity = L.bar.userData.base * (on ? 0.45 : 1);
      if (L.lobby) { L.lobby.color.setHex(on ? 0xff5cc0 : L.lobby.userData.color); L.lobby.intensity = L.lobby.userData.base * (on ? 0.8 : 1); }      // (what the doorway shows from the annex)
      if (game.player.place === ID) { if (on) audio.play('bop'); else if (audio.playing === 'Bop') audio.stopMusic(); }
      popSig = '';
    }

    // ------------------------------------------------------------------------------------------- the hour, the door, who can be seen
    // The doors stand open while the bar is (two heavy leaves left back against the passage's cheeks) and are shut in the
    // morning, when crowdFor() empties the room; either way walking at them opens them. A function of the shared clock.
    const DOOR_OPEN = 1.25, openHours = () => { const h = game.time.hour; return !(h >= 6 && h < 11); };
    let door = null, doors = [], def = null;
    function ambient(dt) {
      const h = game.time.hour, dl = game.time.daylight ?? 1;
      R.clockHands.minute.rotation.z = -((h % 1) * Math.PI * 2);
      R.clockHands.hour.rotation.z = -(((h % 12) / 12) * Math.PI * 2);
      R.windowMat.color.setRGB(0.05 + 0.85 * dl, 0.06 + 0.88 * dl, 0.09 + 0.88 * dl);      // the pavement lights' panes, by the day (old path: the window's too)
      { const rest = openHours() ? DOOR_OPEN : 0; for (const D of doors) if (D.o.rest !== rest) { D.o.rest = rest; if (!(D.clearT > 0)) D.target = rest; } }
      if ((popT -= dt) <= 0) { popT = 4; setBop(isBop()); populate(); }
      if (bop.on) bopTick(dt);
    }
    // from outside, a person is drawn only if the eye could see them: through the doors (and, for the main room, the
    // main door from the lobby; for the pool room, its door), or with the eye at the window. (x, z: the eye in ROOM
    // coordinates)
    function seenFromOutside(ex, ez, px, pz) {
      const D = LAY.door, LB = LAY.lobby;
      if (ez > D.wallZ && pz < D.wallZ) {
        const x = ex + (px - ex) * (D.wallZ - ez) / (pz - ez);
        if (Math.abs(x - D.x) < D.w / 2 + 0.35) {
          if (px > LB.X0 && px < LB.X1) return pz > LB.Z0;                                    // in the lobby
          const wx = px > LB.X1 ? LB.X1 : LB.X0, z = ez + (pz - ez) * (wx - ex) / (px - ex);      // where the line of sight crosses the lobby's side wall
          if (px > LB.X1) return z > LAY.entry.z0 - 0.35 && z < LAY.entry.z1 + 0.35;
          const pd = LAY.pool.door; return z > pd.z - pd.w / 2 - 0.35 && z < pd.z + pd.w / 2 + 0.35;
        }
      }
      if (px > LAY.X0) for (const w of LAY.windows) { if ((ex - w.x) ** 2 + (ez - (LAY.Z1 + w.depth)) ** 2 < 6) return true; }      // (looking down through the window from the court)
      return false;
    }
    const _eye = [0, 0];
    function shownPeople(dt) {
      const S = def && def.sl, e = game.eye; if (!S || !e) return;
      S.toLocal(e.x, e.z, _eye);
      for (const p of peds) {
        const q = p.ped, g = q.character.group, vis = (q.x - _eye[0]) ** 2 + (q.z - _eye[1]) ** 2 < 400 && seenFromOutside(_eye[0], _eye[1], q.x, q.z);
        if (g.visible !== vis) g.visible = vis;
        if (vis && q.character.update) q.character.update(dt, 0);      // (the crowd system only animates a room's people while you are in it)
      }
    }

    // ------------------------------------------------------------------------------------------- interior
    def = game.interiors.register({
      id: ID, name: 'Worcester College Cellar Bar', background: 0x0a0806, ambient: 0.16,
      doors: [{ pos: barToWorld(LAY.door.x, LAY.door.faceZ + 1.2), facing: BAR_FACING, label: 'Into the Cellar Bar' }],      // (in the annex's lobby, before the double doors. Walk-in: kept for tools — enterNow / the exit teleport)
      seamless: barSeamless(),
      *build(ctx) {      // (in pieces: core/interiors.js `*build`)
        bar.scene = ctx.scene;
        const walkIn = !!(ctx.seamless && ctx.addDoor);
        const R_ = yield* buildRoomSteps(ctx.scene, ctx.collider, game.world, { walkIn });
        R = bar.room = R_;
        ctx.setGround(R.ground);
        for (const o of ctx.scene.children) { if (o.isHemisphereLight) { bar.hemi = o; o.intensity = 0.35; } if (o.isAmbientLight) bar.amb = o; }
        if (walkIn) {
          // the double doors in the Hall's wall: a pair of oak leaves hung on the passage's two cheeks, opening inwards
          // (K: the plan draws the pair and their swing), answering as one door (linkLeaves)
          const D = LAY.door, oak = new THREE.MeshStandardMaterial({ name: 'bar:oak', color: 0x4a3220, roughness: 0.72 }), iron = new THREE.MeshStandardMaterial({ name: 'bar:iron', color: 0x24211e, roughness: 0.5, metalness: 0.6 });
          const o = { kind: 'hinged', style: 'oak', y: D.y, w: D.w / 2 - 0.045, h: D.h - 0.07, closer: false, heavy: true, thick: 0.06, mats: { leaf: oak, handle: iron }, portal: 0 }, open = openHours();
          const a = ctx.addDoor({ ...o, at: [D.x - D.w / 2 + 0.04, D.leafZ], dir: Math.PI / 2, swing: 1, rest: open ? DOOR_OPEN : 0 }), b = ctx.addDoor({ ...o, at: [D.x + D.w / 2 - 0.04, D.leafZ], dir: -Math.PI / 2, swing: -1, rest: open ? DOOR_OPEN : 0 });
          a.sgn = 1; b.sgn = -1; doors = bar.doors = linkLeaves([a, b], D.x, D.leafZ, 0, -1, D.w); door = bar.door = a;
          if (open) for (const q of doors) if (q.group) { q.th = DOOR_OPEN * q.sgn; q.target = DOOR_OPEN; q.group.rotation.y = q.o.dir + q.th; }      // found open, not seen opening
        } else ctx.addExit(LAY.exit[0], LAY.exit[1], 'Up the steps to Pump Quad');
        yield;
        darts = bar.darts = createDarts(game, bar); darts.build(ctx.scene);
        yield;
        pool = bar.pool = createPool(game, bar); pool.build(ctx.scene);
        yield;
        buildBop(ctx.scene);
        const I = (o) => game.interact.add({ place: ID, ...o });
        I({ pos: [LAY.bar.backX, LAY.bar.front + 0.5], radius: 1.6, label: 'Order a drink', onUse: orderMenu });
        I({ pos: [LAY.jukebox.x, LAY.jukebox.z - 0.75], radius: 1.1, label: () => (bop.on ? "The DJ's on" : audio.playing && audio.playing !== 'Bop' ? `Put another song on (50p) — playing "${audio.playing}"` : 'Put a song on (50p)'), onUse: jukebox });
        I({ pos: [LAY.oche + 0.35, LAY.board.z], radius: 1.4, label: 'Play darts', onUse: () => darts.menu() });
        I({ pos: [LAY.table.x, LAY.pool.floor, LAY.table.z], radius: 1.9, label: 'Play pool', onUse: () => pool.menu() });
        built = true;
        return { spawn: LAY.spawn, heading: LAY.spawnHeading };
      },
      // (the people are already there if the room was shown: only a change of hour re-seats them)
      onEnter() { audio.startMurmur(); populate(); audio.setCrowd(peds.length); setBop(isBop()); if (bop.on) audio.play('bop'); },
      onExit() {
        audio.stopAll(); dropCup();
        if (game.activity && /darts|pool|bar-menu/.test(game.activity.name)) game.endActivity();
      },
      // shown but not entered (seen from the annex through the doors, or down through the window): the hour, the lights, the
      // bop and the people — no sound, no games
      updateShown(dt) { if (!R) return; ambient(dt); shownPeople(dt); },
      update(dt) {
        if (!R) return;
        audio.update(dt);
        // zone culling: people in the main room are not drawn from the pool room / lobby and vice versa (draw-call budget)
        const cp = game.camera.position, cx = cp.x, camZone = cx < LAY.lobby.X0 ? 2 : cx < LAY.X0 && cp.z > LAY.lobby.Z0 ? 1 : 0;
        for (const p of peds) { const z = p.ped.x < LAY.lobby.X0 ? 2 : 0, far = (p.ped.x - cp.x) ** 2 + (p.ped.z - cp.z) ** 2 > 225, vis = !far && (camZone === 1 ? true : z === camZone); if (p.ped.character.group.visible !== vis) p.ped.character.group.visible = vis; }
        // clock (game time), the day in the pavement lights, the doors by the hour, who is in, the bop
        ambient(dt);
        // the team member at the oche practises while nobody is playing
        const thr = peds.find((p) => p.kind === 'thrower');
        darts.idleTick(dt, darts.active ? null : thr ? thr.ped : null);
        // the games: darts in flight and in the board, the balls, the cues, the shooter's stance (ours and other players')
        darts.frame(dt); pool.frame(dt);
        // the room has opinions about a game in progress (one chance every 20 s or so: a patron, in a bubble)
        if ((pool.active || darts.active) && (watchT -= dt) <= 0) {
          watchT = 16 + Math.random() * 14;
          const ps = peds.filter((p) => p.kind === 'patron'), q = ps.length ? ps[Math.floor(Math.random() * ps.length)] : null;
          if (q && Math.random() < 0.7) q.ped.character.say(WATCH_LINES[pool.active ? 'pool' : 'darts'][Math.floor(Math.random() * 4)], 2.6);
        }
        // a drink in hand: held up, sipped now and then
        if (cup) {
          cupT -= dt; sipT -= dt;
          const ch = game.player.character, bn = ch.bones;
          if (!game.activity && ch.pose !== 'sit') {
            const s = sipT < 0 && sipT > -1.3 ? Math.sin((-sipT / 1.3) * Math.PI) : 0;
            bn.armR.rotation.x = -0.25 - 0.35 * s; bn.foreR.rotation.x = -1.35 - 0.95 * s;
            if (sipT < -1.3) { sipT = 6 + Math.random() * 6; }
            if (s > 0.98 && !cup.userData.sipped) { cup.userData.sipped = true; audio.sip(); } else if (s < 0.5) cup.userData.sipped = false;
          }
          if (cupT <= 0) dropCup();
        }
      },
    });
    return { update(dt) {
      // drunkenness wears off over a few minutes, wherever you are
      const p = game.player; if (p.drunk > 0) p.drunk = Math.max(0, p.drunk - dt * 0.0035);
      const S = def && def.sl; if (!S) return;
      // the room's people last as long as it is shown
      if (!S.shown && p.place !== ID && peds.length) { clearPeople(); popSig = ''; }
    } };
  },
};
