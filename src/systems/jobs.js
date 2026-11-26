// Jobs on wheels: bus passengers (seen through the windows of AI and taken buses), the taxi-driver job (hail, pick up,
// drive them somewhere real, meter + tip) and the bus-route job (R at a bus stop: a timetable of real stops along the
// bus streets, passengers on and off, fares, punctuality bonus, a summary at the terminus). Rules: systems/_jobs_logic.js.
// game.jobs = { taxi, route, stats(), debugHail(), debugBoard(), debugRoute(n), debugArrive(), destinations } -
// see docs/VEHICLES_API.md "Jobs". Talks to vehicles/traffic/pedestrians only through their public hooks.
import * as THREE from 'three';
import { randomLook } from '../core/characters.js';
import { TYPES, busPassengers, MATS, BLINDS } from './_vehiclemeshes.js';
import { makeBubble } from './_bubble.js';
import { TAXI, taxiFare, taxiTip, taxiPay, smoothness, expectedTime, BUS, timetable, punctuality, routeSummary, routeNumber, isNightTariff, whereWords, distWords } from './_jobs_logic.js';

const pick = (a) => a[(Math.random() * a.length) | 0];
const money = (x) => '£' + x.toFixed(2);
const mmss = (s) => { const n = Math.max(0, Math.round(s)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const COLLEGE_RE = /College$|Hall$|Christ Church$|Blackfriars/;
// GUESS: the Purple Turtle (under the Oxford Union, Frewin Court) is not in the map data
const EXTRA_DEST = [
  { name: 'Oxford station', x: -655, z: 178, kind: 'station' },
  { name: 'Gloucester Green coach station', x: -171, z: 108, kind: 'station' },
  { name: 'the supermarket on Magdalen Street', poi: 'n312915804', street: 'Magdalen Street', x: 54.8, z: 58.9, kind: 'shop' },
  { name: 'the Purple Turtle', x: 88, z: 224, kind: 'club', night: true },
  { name: 'the kebab shop on George Street', poi: 'n659858765', street: 'George Street', x: -82.7, z: 138.8, kind: 'kebab', night: true },   // named from the map: the real name ("Kebab King, George Street"), or its invented one under ?invented=1
];
// clubs among the map's bars, by their real (OSM) names (under ?invented=1 they are shown by invented ones: world/tradenames.js)
const CLUBS = /Plush|The Bridge|Thirst|Spirit|Purple Turtle/;

const LINES = {
  protest: ["Oi! This isn't the 5!", "Driver, you've missed my stop!", "I'm going to be late for my tute!", 'Excuse me, are you even a bus driver?',
    "I'm writing to the Oxford Mail!", 'Can I get off, please?', 'I only wanted to go to Cowley!', 'Is this a rail replacement service?', 'My return ticket is NOT valid on this!'],
  bell: ['DING DING! This is my stop!', 'DING! DING! DING!', 'I have pressed the bell FOUR times!', 'Ding ding. DING DING.'],
  off: ['Finally!', "I'm walking from here.", "Worst bus I've ever been on.", 'Five stars. Would be kidnapped again.', 'Never again.'],
  taxiHail: ['Taxi!', 'TAXI!', 'Taxi! Over here!', 'Are you free?'],
  taxiRide: ['Busy night?', 'You know a shortcut? Go on then.', "I'm late for formal.", 'Do you take cards? No? Fine.', "Mind the cyclists. There's always cyclists."],
  taxiDrunk: ['I love you, mate. I LOVE you.', 'Can we stop for cheesy chips?', 'Is the meter... is it spinning?', "Don't tell my tutor.", "*singing* Sweet Caroline! Bah bah bah!", "Wait. Where am I going? Oh yeah."],
  taxiThanks: ['Cheers, drive!', 'Ta very much.', 'Keep the change.', 'Brilliant, thanks.', 'Lovely stuff.'],
  taxiBail: ["I'm not getting nicked for a lift to {dest}!", "Is that the POLICE? I'm off!", "Nope. Nope nope nope.", "I'll walk, thanks!"],
  taxiWalk: ['Fine, I\'ll walk!', "You're leaving me here?!", 'One star.'],
  friendBus: ['Is that... a BUS?', 'Where did you get a double-decker?!', "Mate. That's not your bus.", "Does this go to the Turf?", "I'm not getting on that.", 'Very on brand.'],
};

export default {
  id: 'jobs',
  install(game) {
    const J = new Jobs(game);
    game.jobs = J.api;
    return { id: 'jobs', update: (dt) => J.update(dt) };
  },
};

class Jobs {
  constructor(game) {
    this.game = game;
    this.t = 0; this._scanT = 0; this._hudT = 0; this._friendT = 0;
    this.taxi = { phase: 'idle', hailT: 6, onDuty: true };
    this.route = null; this.summary = null; this._obj = null;
    this.bubble = makeBubble(1.15);
    this._queue = [];           // passengers stepping off: {x, z, h, look, t, line}
    this._friendSaid = new Map();
    const st = game.state || (game.state = {});
    this.stats = st.jobs || (st.jobs = { fares: 0, taxiEarned: 0, bestTip: 0, routes: 0, busEarned: 0, bestRoute: 0, passengers: 0 });
    this.api = this._api();
    try { game.input.onKey((c) => { if (this.summary && (c === 'KeyE' || c === 'Enter' || c === 'Escape')) this._closeSummary(); }); } catch { /* headless */ }
  }

  // ------------------------------------------------------------ hooks
  _hook() {
    const V = this.game.vehicles;
    if (this._hooked || !V || !V.on) return;
    this._hooked = true;
    V.on('take', (d) => { if (d.v && d.v.type === 'bus') this._takenBus(d.v, d.info); });
    V.on('busStop', (d) => this._onBusStop(d));
    V.on('exit', (d) => this._onExit(d.v));
    V.on('impact', (d) => { if (this.taxi.phase === 'ride' && d.v === V.current) { if (this.game.time.now() - (this._lastHit || 0) > 900) { this._lastHit = this.game.time.now(); this.taxi.collisions++; this.taxi.harsh++; } } });
    V.on('enter', (d) => { if (d.v && d.v.type === 'taxi') this._enterTaxi(d.v); if (d.v && d.v.type === 'bus' && !d.v.pax) this._busTip(); });
  }
  _tier() { const q = this.game.quality; return (q && q.level) || (this.game.traffic && this.game.traffic.tier) || 'medium'; }
  _toast(t, s) { try { this.game.ui.toast(t, s); } catch { /* */ } }

  // ------------------------------------------------------------ passengers drawn in buses
  _paxMesh(holder, n, seed) {
    const show = this._tier() !== 'low' && n > 0;
    let m = holder.paxMesh;
    if (!show) { if (m) m.visible = false; return; }
    const geo = busPassengers(n, seed);
    if (!m) { m = holder.paxMesh = new THREE.Mesh(geo || new THREE.BufferGeometry(), MATS.body); m.name = 'bus-passengers'; m.castShadow = false; holder.group.add(m); }
    if (geo) m.geometry = geo;
    m.visible = !!geo;
  }
  _scanBuses() {
    const tr = this.game.traffic; if (!tr) return;
    const tier = this._tier(), max = tier === 'high' ? 12 : 8;
    for (const a of tr.list) {
      if (a.type !== 'bus' || !a.active) continue;
      if (a.pax === undefined) { a.pax = 2 + ((Math.random() * (max - 1)) | 0); a.paxSeed = (Math.random() * 4) | 0; a._paxShown = -1; }
      // the route it runs (its blinds, front / side / rear): from what every client knows of it (pax, paxSeed are synced)
      if (a.blindI === undefined) a.blindI = (a.pax * 4 + a.paxSeed) % BLINDS.length;
      if (a.rig && a.rig.setBlind && a.rig.blind !== a.blindI && !(this.route && this.route.v && this.route.v.rig === a.rig)) a.rig.setBlind(a.blindI);
      const key = a.pax * 8 + a.paxSeed + (tier === 'low' ? 1000 : 0);
      if (a._paxShown !== key) { a._paxShown = key; this._paxMesh(a.rig, a.pax, a.paxSeed); }
    }
  }
  _setPax(v, n) {
    v.pax = Math.max(0, n | 0);
    if (v.rig) this._paxMesh(v.rig, Math.min(14, v.pax), v.paxSeed || 0);
  }
  _takenBus(v, info) {
    v.paxSeed = (Math.random() * 4) | 0;
    this._setPax(v, info && info.pax ? info.pax : 0);
    v.protestT = 2.5; v.bellT = 26; v.stopsMade = 0;
  }
  _busFrame(v, dt) {
    if (this.route) return;
    if (!v.pax || !v.stolen) return;
    this._attachBubble(v, 2.52 / 2 + 0.4, 4.2, 1.4);
    v.protestT -= dt; v.bellT -= dt;
    if (v.protestT <= 0) { v.protestT = 5 + Math.random() * 3.5; this._paxSay(pick(LINES.protest), 3); }
    if (v.bellT <= 0) {
      v.bellT = 6 + Math.random() * 3;
      this._paxSay(pick(LINES.bell), 2.5); this._ding(2);
      if (!v.bellTold) { v.bellTold = true; this._toast('The passengers are ringing the bell. Stop at a bus stop to let them off.', 4); }
    }
  }
  /** once per save: how the route job starts (nothing else in the game says so) */
  _busTip() {
    const fl = this.game.state.flags || (this.game.state.flags = {});
    if (fl.busTip || this.route) return;
    fl.busTip = true; this._toast('An empty bus. Pull in at any bus stop and press R to drive its route for the fares.', 6);
  }
  _attachBubble(v, x, y, z) {
    const s = this.bubble.sprite;
    if (s.parent !== v.mesh) { v.mesh.add(s); }
    s.position.set(x, y, z);
  }
  /** a bus passenger (any of them: a different person each time) or the taxi fare (tx.voiceHint) speaks */
  _paxSay(text, secs, hint = null) {
    const h = hint || { fig: Math.random() < 0.5 ? 'f' : 'm', older: Math.random() < 0.2, seed: (Math.random() * 1e9) >>> 0 };
    this.bubble.speak(this.game, h, text, secs);
  }
  _ding(n) {
    const a = this.game.audio; if (!a || !a.ctx) return;
    for (let i = 0; i < n; i++) a.tone(1310, 0.3, { gain: 0.05, when: i * 0.22 });
  }
  /** player stopped at a stop in a bus */
  _onBusStop({ v, stop }) {
    if (this.route && this.route.v === v) { this._routeArrive(stop); return true; }
    v.stopsMade = (v.stopsMade || 0) + 1;
    if (v.pax > 0 && v.stolen) {
      const n = v.pax;
      this._alight(v, n);
      this._paxSay(pick(LINES.off), 2.5);
      this._toast(`${stop.name ? stop.name + ': ' : ''}${n === 1 ? 'Your passenger flees' : `All ${n} passengers flee`}, muttering about the Oxford Mail.`, 3.5);
      this._busTip();
      return true;
    }
    return false;
  }
  /** n passengers step off at the nearside (left) front door, one by one */
  _alight(v, n) {
    const T = TYPES.bus, fx = Math.sin(v.heading), fz = Math.cos(v.heading), lx = fz, lz = -fx;
    const shown = Math.min(n, 6);
    for (let i = 0; i < shown; i++) {
      const x = v.x + fx * (T.L / 2 - 1.2 - i * 0.25) + lx * (T.W / 2 + 0.9 + (i % 2) * 0.5), z = v.z + fz * (T.L / 2 - 1.2 - i * 0.25) + lz * (T.W / 2 + 0.9 + (i % 2) * 0.5);
      this._queue.push({ x, z, h: Math.atan2(lx, lz), look: null, t: 0.2 + i * 0.4, line: i === 0 ? null : Math.random() < 0.35 ? pick(LINES.off) : null });
    }
    this._setPax(v, v.pax - n);
  }
  _flushQueue(dt) {
    const peds = this.game.pedestrians, col = this.game.worldCollider;
    for (let i = this._queue.length - 1; i >= 0; i--) {
      const q = this._queue[i];
      if ((q.t -= dt) > 0) continue;
      this._queue.splice(i, 1);
      if (!peds || !peds.adopt || (col && col.isWet && col.isWet(q.x, q.z))) continue;
      try {
        const p = q.look ? peds.adopt(q.x, q.z, q.look, { standing: true, heading: q.h, lookSeed: q.lookSeed, lookKind: q.lookKind, role: q.role }) : peds.adopt(q.x, q.z, null, { standing: true, heading: q.h, lookSeed: (Math.random() * 1e9) | 0, lookKind: 1 });
        if (p && q.line && p.character) p.character.say(q.line, 3);
        if (p && q.say) q.say(p);
      } catch (e) { console.warn('[jobs] alight', e); }
    }
  }
  _onExit(v) {
    if (!v) return;
    if (this.route && this.route.v === v) this._endRoute(false, 'You left the bus. Route abandoned; the passengers are stranded.');
    if (v.type === 'taxi' && (this.taxi.phase === 'ride' || this.taxi.phase === 'bail')) this._dropPassenger(v, false, pick(LINES.taxiWalk));
    if (v.type === 'taxi' && (this.taxi.phase === 'hail' || this.taxi.phase === 'boarding')) this._releaseHailer();
    if (v.type === 'taxi' && this._obj) { this._obj = null; try { this.game.ui.objective(null); } catch { /* */ } }     // (the taxi line used to stay up after you got out)
    if (this.bubble.sprite.parent === v.mesh) this.bubble.hide();
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, p = g.player, V = g.vehicles;
    if (!dt || dt <= 0) return;
    this.t += dt;
    this._hook();
    if ((this._scanT -= dt) <= 0) { this._scanT = 0.5; this._scanBuses(); }
    this.bubble.update(dt);
    if (this._queue.length) this._flushQueue(dt);
    const v = V && V.current;
    const ctl = !p.frozen && !g.activity && !(g.ui && g.ui.inDialog) && !g.input.typing;
    if (v && p.place === 'world') {
      if (v.type === 'bus') {
        this._busFrame(v, dt);
        if (ctl && g.input.hit('KeyR')) { g.input.pressed.delete('KeyR'); this.route ? this._endRoute(false, 'Route abandoned. The passengers are not impressed.') : this.startRoute(v); }
        if (this.route) this._routeFrame(dt);
        if ((this._friendT -= dt) <= 0) { this._friendT = 1; this._friendsComment(v); }
      } else if (v.type === 'taxi') {
        if (ctl && g.input.hit('KeyR')) { g.input.pressed.delete('KeyR'); this._toggleDuty(v); }
        this._taxiFrame(v, dt);
      }
    }
    if (this.summary && (this.summary.t -= dt) <= 0) this._closeSummary();
  }

  // ------------------------------------------------------------ friends notice the bus (public bubble hook only)
  _friendsComment(v) {
    const fr = this.game.friends;
    if (!fr || !fr.npcs || !v.stolen || Math.abs(v.speed) > 3) return;
    for (const n of fr.npcs) {
      if (!n || !n.shown || n.hidden || !n.ch || !n.ch.say) continue;
      const x = (n.x || 0) + (n.offX || 0), z = (n.z || 0) + (n.offZ || 0);
      if (Math.hypot(x - v.x, z - v.z) > 16) continue;
      const last = this._friendSaid.get(n.id) || -999;
      if (this.t - last < 90) continue;
      this._friendSaid.set(n.id, this.t);
      try { n.ch.say(pick(LINES.friendBus), 3); } catch { /* */ }
      return;
    }
  }

  // ------------------------------------------------------------ taxi job
  _enterTaxi(v) {
    const tx = this.taxi;
    if (tx.phase !== 'idle') this._releaseHailer();
    tx.phase = 'idle'; tx.hailT = 5 + Math.random() * 6; tx.v = v;
    if (v.rig && v.rig.setSign) v.rig.setSign(tx.onDuty);
  }
  _toggleDuty(v) {
    const tx = this.taxi;
    tx.onDuty = !tx.onDuty;
    if (v.rig && v.rig.setSign) v.rig.setSign(tx.onDuty && tx.phase !== 'ride');
    if (!tx.onDuty && (tx.phase === 'hail' || tx.phase === 'boarding')) this._releaseHailer();
    this._toast(tx.onDuty ? 'For hire: the TAXI light is on.' : 'Off duty.', 2);
  }
  _wanted() { const P = this.game.police; return P ? P.level : 0; }
  _taxiFrame(v, dt) {
    const g = this.game, tx = this.taxi;
    tx.v = v;
    if (tx.phase === 'idle') {
      if (!tx.onDuty || this._wanted() > 0) { tx.hailT = Math.max(tx.hailT, 4); if (tx.onDuty) this._taxiHud(v, dt); return; }
      // the how-to waits until the stars have gone (it used to be the fourth toast in a stack while a PCSO walked up)
      if (!g.state.flags.taxiTip) { g.state.flags.taxiTip = true; this._toast('Taxi: you are for hire. People will flag you down: pull up beside them. R: off duty.', 6); }
      if ((tx.hailT -= dt) <= 0) { tx.hailT = 3; this._findHailer(v); }
      this._taxiHud(v, dt);
      return;
    }
    if (tx.phase === 'hail') {
      const ped = tx.ped;
      if (!ped || !ped.active || !ped.ctl || this._wanted() > 0) { this._releaseHailer(); return; }
      const d = Math.hypot(ped.x - v.x, ped.z - v.z);
      if (tx.blip) { tx.blip.x = ped.x; tx.blip.z = ped.z; }
      if ((tx.t += dt) > 50 || d > 140) { this._releaseHailer(); return; }
      if (Math.abs(v.speed) < 1 && g.vehicles._sys.bodyDist(v, ped.x, ped.z) < 6.5) { tx.phase = 'boarding'; tx.t = 0; }
      this._taxiHud(v, dt);
      return;
    }
    if (tx.phase === 'boarding') {
      const ped = tx.ped;
      if (!ped || !ped.active) { this._releaseHailer(); return; }
      tx.t += dt;
      if (Math.abs(v.speed) > 2) { tx.phase = 'hail'; return; }
      // to the nearside rear door
      const T = TYPES.taxi, fx = Math.sin(v.heading), fz = Math.cos(v.heading), lx = fz, lz = -fx;
      const dx = v.x - fx * 0.7 + lx * (T.W / 2 + 0.45), dz = v.z - fz * 0.7 + lz * (T.W / 2 + 0.45);
      if (Math.hypot(dx - ped.x, dz - ped.z) < 0.6 || tx.t > 3.5) this._board(v, ped);
      return;
    }
    if (tx.phase === 'ride' || tx.phase === 'bail') {
      const sp = Math.abs(v.speed);
      tx.driven += sp * dt; tx.time += dt; if (sp < 2) tx.waitS += dt;
      // harsh driving: skids and emergency stops
      const dv = (tx.lastSp - sp) / dt;
      if (((v.vl && Math.abs(v.vl) > 3) || dv > 9) && this.t - tx.harshT > 1) { tx.harshT = this.t; tx.harsh++; }
      tx.lastSp = sp;
      this._attachBubble(v, 0, 2.3, -0.6);
      if ((tx.sayT -= dt) <= 0) { tx.sayT = 9 + Math.random() * 8; this._paxSay(pick(tx.drunk ? LINES.taxiDrunk : LINES.taxiRide), 3, tx.voiceHint); }
      if (tx.phase === 'ride' && this._wanted() > 0) { tx.phase = 'bail'; this._paxSay('Wait. Are those... sirens?!', 2.5, tx.voiceHint); this._toast('Your passenger has seen the stars. They will bail at the next stop.', 3); }
      if (sp < 0.6) {
        if (tx.phase === 'bail' && tx.time > 1) { this._dropPassenger(v, false, pick(LINES.taxiBail).replace('{dest}', tx.dest.short || tx.dest.name)); return; }
        if (Math.hypot(v.x - tx.dest.x, v.z - tx.dest.z) < 16) { this._dropPassenger(v, true); return; }
      }
      this._taxiHud(v, dt);
    }
  }
  _findHailer(v) {
    const g = this.game, peds = g.pedestrians, tx = this.taxi;
    if (!peds || !peds.near || !peds.control) return null;
    const night = !!(g.time && (g.time.hour >= 22 || g.time.hour < 4));
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let best = null, bs = -Infinity;
    for (const p of peds.near(v.x, v.z, 80, this._tmp || (this._tmp = []))) {
      if (!p.active || p.scripted || p.down || p.ctl || p.leader || p.dog) continue;
      if (p.role === 'porter' || p.role === 'police' || p.role === 'jogger' || p.role === 'rower') continue;
      if (p.child || (peds.isGuardian && peds.isGuardian(p))) continue;      // (no child is ever a fare, nor anyone who has children with them: systems/_ped_child.js)
      const dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz);
      if (d < 20) continue;
      const ahead = (dx * fx + dz * fz) / d;
      let s = ahead * 2 - d / 60 + Math.random() * 0.8;
      if (night && (p.role === 'clubber' || p.role === 'nightowl')) s += 2;
      if (s > bs) { bs = s; best = p; }
    }
    if (best && best.remote) best = peds.own ? peds.own(best) : null;          // multiplayer: someone else's walker becomes ours (pinned)
    if (!best) return null;
    tx.ped = best; tx.phase = 'hail'; tx.t = 0; tx.sayT = 0;
    peds.control(best, (ped, dt) => {
      // arm up, facing the cab, shouting now and then
      const cv = this.taxi.v;
      if (cv) ped.heading += Math.atan2(Math.sin(Math.atan2(cv.x - ped.x, cv.z - ped.z) - ped.heading), Math.cos(Math.atan2(cv.x - ped.x, cv.z - ped.z) - ped.heading)) * Math.min(1, dt * 4);
      if (this.taxi.phase === 'boarding') {
        const T = TYPES.taxi, fx2 = Math.sin(cv.heading), fz2 = Math.cos(cv.heading), lx = fz2, lz = -fx2;
        const dx = cv.x - fx2 * 0.7 + lx * (T.W / 2 + 0.45), dz = cv.z - fz2 * 0.7 + lz * (T.W / 2 + 0.45);
        if (ped.character.pose !== 'stand') ped.character.setPose('stand');
        peds.moveTo(ped, dx, dz, 1.7, dt);
        return true;
      }
      ped.speed = 0;
      if (ped.character.pose !== 'wave') ped.character.setPose('wave');
      if ((this.taxi.sayT -= dt) <= 0) { this.taxi.sayT = 4 + Math.random() * 3; ped.character.say(pick(LINES.taxiHail), 2); }
      return true;
    });
    try { tx.blip = g.ui.addBlip(best.x, best.z, '#3ad0ff', 'Fare'); } catch { tx.blip = null; }
    if (!this.stats.fares) this._toast(g.features && g.features.minimap ? 'Someone is flagging you down (cyan blip).' : 'Someone is flagging you down.', 3);   // the minimap is off by default (core/features.js)
    return best;
  }
  _releaseHailer() {
    const tx = this.taxi, peds = this.game.pedestrians;
    if (tx.ped && tx.ped.active && tx.ped.ctl && peds) peds.control(tx.ped, null);
    tx.ped = null;
    if (tx.blip) { try { this.game.ui.removeBlip(tx.blip); } catch { /* */ } tx.blip = null; }
    tx.phase = 'idle'; tx.hailT = 8 + Math.random() * 10;
  }
  _destinations() {
    if (this._dest) return this._dest;
    const map = this.game.map, out = [];
    for (const s of map.sites || []) if ((s.kind === 'university' || s.kind === 'college') && COLLEGE_RE.test(s.name || '')) out.push({ name: s.name, x: s.c[0], z: s.c[1], kind: 'college' });
    for (const p of map.pois || []) {
      if (!p.name) continue;
      if (p.kind === 'pub') out.push({ name: p.name.startsWith('The ') ? p.name : 'the ' + p.name, x: p.p[0], z: p.p[1], kind: 'pub' });
      else if (p.kind === 'nightclub' || (p.kind === 'bar' && CLUBS.test((map._rawTrade && map._rawTrade.get(p.id)) || p.name))) out.push({ name: p.name, x: p.p[0], z: p.p[1], kind: 'club', night: true });
    }
    for (const d of EXTRA_DEST) { const q = d.poi && (map.pois || []).find((p) => p.id === d.poi && p.name); out.push(q ? { ...d, name: `${q.name}, ${d.street}` } : { ...d }); }
    // snap each to the kerb of the nearest road
    const tr = this.game.traffic, ok = [];
    const B = map.bounds;
    for (const d of out) {
      d.short = d.name.replace(/ College$/, '').replace(/^the /, '');
      const q = tr && tr.nearestLane ? tr.nearestLane(d.x, d.z, 70) : null;
      if (!q) continue;
      d.dx = q.x; d.dz = q.z;
      if (!(map.boxes || [B]).some((q) => d.dx >= q.minX + 30 && d.dx <= q.maxX - 30 && d.dz >= q.minZ + 30 && d.dz <= q.maxZ - 30)) continue;
      ok.push(d);
    }
    return (this._dest = ok);
  }
  _pickDest(x, z, drunk, fromClub) {
    const night = !!(this.game.time && (this.game.time.hour >= 21 || this.game.time.hour < 4));
    const list = this._destinations().filter((d) => {
      const s = Math.hypot(d.dx - x, d.dz - z);
      if (s < TAXI.minKm * 1000 || s > TAXI.maxKm * 1000) return false;
      if (d.night && !night) return false;
      if (drunk && d.kind === 'club') return false;
      return true;
    });
    if (!list.length) return null;
    const w = (d) => (drunk ? (d.kind === 'college' ? 3 : d.kind === 'kebab' ? 4 : 0.5) : night && d.kind === 'club' && !fromClub ? 2.5 : d.kind === 'station' ? 2 : 1);
    let tot = 0; for (const d of list) tot += w(d);
    let r = Math.random() * tot;
    for (const d of list) { r -= w(d); if (r <= 0) return d; }
    return list[0];
  }
  _board(v, ped) {
    const g = this.game, tx = this.taxi, peds = g.pedestrians;
    const night = !!(g.time && (g.time.hour >= 22 || g.time.hour < 4));
    const zone = peds && peds.zone ? peds.zone(ped.x, ped.z) : 0;
    const drunk = !!(ped.drunk || (night && (ped.role === 'clubber' || ped.role === 'nightowl')));
    const dest = this._pickDest(v.x, v.z, drunk, !!(zone & 4));
    if (!dest) { this._releaseHailer(); return; }
    const look = ped.look, voiceHint = ped.character && ped.character.voiceHint;
    if (tx.blip) { try { g.ui.removeBlip(tx.blip); } catch { /* */ } tx.blip = null; }
    ped.ctl = null; if (peds) peds.remove(ped);
    tx.ped = null;
    Object.assign(tx, { phase: 'ride', look, lookSeed: ped.lookKind >= 0 ? ped.lookSeed : undefined, lookKind: ped.lookKind, lookRole: ped.role, drunk, dest: { name: dest.name, short: dest.short, x: dest.dx, z: dest.dz }, sx: v.x, sz: v.z, driven: 0, time: 0, waitS: 0, harsh: 0, collisions: 0,
      harshT: -9, lastSp: Math.abs(v.speed), sayT: 6, voiceHint, hour: g.time ? g.time.hour : 12, straight: Math.hypot(dest.dx - v.x, dest.dz - v.z) });
    if (v.rig && v.rig.setSign) v.rig.setSign(false);
    const a = g.audio; if (a && a.ctx) { a.tone(900, 0.03, { type: 'square', gain: 0.03 }); a.noise(0.16, { gain: 0.2, freq: 210, type: 'lowpass', q: 0.8, when: 0.5 }); }
    try { tx.blip = g.ui.addBlip(tx.dest.x, tx.dest.z, '#ffd23a', tx.dest.short); } catch { tx.blip = null; }
    this._attachBubble(v, 0, 2.3, -0.6);
    this._paxSay(drunk ? `${dest.short}... no, wait... ${dest.name}! Please!` : `${dest.name}, please.`, 3.2, voiceHint);
    this._toast(`Fare: ${dest.name} (${(tx.straight / 1000).toFixed(1)} km).${g.features && g.features.minimap ? ' Follow the yellow blip.' : ''}${isNightTariff(tx.hour) ? ' Night tariff.' : ''}`, 4);
  }
  _meter() { const tx = this.taxi; return taxiFare({ driven: tx.driven, straight: Math.max(tx.straight, 1), waitS: tx.waitS, hour: tx.hour }); }
  _dropPassenger(v, paid, line) {
    const g = this.game, tx = this.taxi;
    let pay = 0, fare = 0, tip = 0;
    if (paid) {
      fare = this._meter();
      tip = taxiTip({ fare, smooth: smoothness(tx.harsh), expectedS: expectedTime(tx.straight), actualS: tx.time, drunk: tx.drunk, rnd: Math.random() });
      pay = taxiPay(fare, tip, tx.collisions);
      g.pay(pay);
      const s = this.stats; s.fares++; s.taxiEarned = Math.round((s.taxiEarned + pay) * 100) / 100; s.bestTip = Math.max(s.bestTip, tip);
      try { g.save(); } catch { /* */ }
      this._toast(`${tx.dest.name}: fare ${money(fare)} + tip ${money(tip)}${tx.collisions ? ` − ${money(TAXI.collision * tx.collisions)} for the bumps` : ''} = ${money(pay)}`, 5);
    }
    // out of the nearside rear door
    const T = TYPES.taxi, fx = Math.sin(v.heading), fz = Math.cos(v.heading), lx = fz, lz = -fx;
    const say = line || (paid ? pick(LINES.taxiThanks) : null);
    this._queue.push({ x: v.x - fx * 0.7 + lx * (T.W / 2 + 0.7), z: v.z - fz * 0.7 + lz * (T.W / 2 + 0.7), h: Math.atan2(lx, lz), look: tx.look, lookSeed: tx.lookSeed, lookKind: tx.lookKind, role: tx.lookRole, t: 0.3, line: say });
    if (tx.blip) { try { g.ui.removeBlip(tx.blip); } catch { /* */ } tx.blip = null; }
    this.lastFare = { paid, fare, tip, pay, dest: tx.dest && tx.dest.name, harsh: tx.harsh, collisions: tx.collisions, time: Math.round(tx.time) };
    tx.phase = 'idle'; tx.hailT = 10 + Math.random() * 14; tx.look = null;
    if (v.rig && v.rig.setSign) v.rig.setSign(tx.onDuty);
    try { g.ui.objective(null); } catch { /* */ }
    this._obj = null;
    return this.lastFare;
  }
  _taxiHud(v, dt) {
    if ((this._hudT -= dt) > 0) return;
    this._hudT = 0.25;
    const tx = this.taxi;
    let s = null;
    if (tx.phase === 'ride' || tx.phase === 'bail') {
      const d = Math.hypot(v.x - tx.dest.x, v.z - tx.dest.z);
      // no map and no arrow: the fare tells you which way, in words (and you stop within 16 m of the place)
      s = `Taxi: ${tx.dest.name} · ${d < 16 ? 'here! Pull up.' : distWords(d) + ', ' + whereWords(tx.dest.x - v.x, tx.dest.z - v.z, v.heading)} · meter ${money(this._meter())}${tx.phase === 'bail' ? ' · passenger panicking!' : ''}`;
    } else if (tx.phase === 'boarding') s = 'Taxi: hold still while they get in.';
    else if (tx.phase === 'hail' && tx.ped) { const d = Math.hypot(tx.ped.x - v.x, tx.ped.z - v.z); s = `Taxi: someone is flagging you down, ${distWords(d)} ${whereWords(tx.ped.x - v.x, tx.ped.z - v.z, v.heading)}. Pull up next to them.`; }
    else if (tx.onDuty && this._wanted() > 0) s = 'Taxi: nobody will get in while you are wanted. Lose the police first.';
    if (s !== this._obj) { this._obj = s; try { this.game.ui.objective(s); } catch { /* */ } }
  }

  // ------------------------------------------------------------ bus-route job
  startRoute(v) {
    const g = this.game, tr = g.traffic;
    if (!tr || !tr.busRoute || !tr.nearBusStop) return null;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const here = tr.nearBusStop(v.x + fx * 3, v.z + fz * 3, 14);
    if (!here) { this._toast('Pull in at a bus stop first, then press R to start a route.', 3); return null; }
    if (Math.abs(v.speed) > 1) { this._toast('Stop at the bus stop first.', 2); return null; }
    // the way the bus faces first; a short run of two stops is still a route (a third of all stops used to
    // answer "no route from here": three were required); at a terminus, the longest route out of the stop in any direction
    // (it starts behind you: the toast and the HUD say so, and the timetable allows 25 s for turning the bus round)
    let stops = tr.busRoute(here.x, here.z, v.heading, 7), turned = false;
    if (stops.length < 2) {
      for (let k = 1; k < 8; k++) { const alt = tr.busRoute(here.x, here.z, v.heading + k * Math.PI / 4, 7); if (alt.length > stops.length) { stops = alt; turned = true; } }
    }
    if (stops.length < 2) { this._toast('This stop is the end of the line. Try another stop along the road.', 3); return null; }
    if (v.pax && v.stolen) this._alight(v, v.pax);
    const num = routeNumber(here.id * 7 + stops[stops.length - 1].id);
    const due = timetable(stops, turned ? 25 : 0);
    const R = this.route = { v, num, from: here.name || 'here', stops, due, i: 0, t: 0, legs: [], fares: 0, blip: null, nextT: 0, hereId: here.id };
    // the blinds (front, side, rear) show this route: its number and where it ends
    if (v.rig && v.rig.setBlind) { R.prevBlind = v.rig.blind ?? null; v.rig.setBlind({ num, dest: stops[stops.length - 1].name || 'Oxford' }); }
    if (!v.paxSeed) v.paxSeed = (Math.random() * 4) | 0;
    const board = 1 + ((Math.random() * 3) | 0);
    this._setPax(v, (v.pax || 0) + board);
    this._collect(board);
    R.legs.push({ name: R.from, due: 0, arrive: 0, status: 'start', board, alight: 0 });
    this._boardFromStop(here.x, here.z, v, 3);
    this._blipNext();
    this._toast(`Route ${num}: ${R.from} to ${stops[stops.length - 1].name}, ${stops.length} stops. ${board} on board (+${money(board * BUS.fare)}).${turned ? ' The first stop is ' + whereWords(stops[0].x - v.x, stops[0].z - v.z, v.heading) + '.' : ''}`, 5);
    if (!g.state.flags.routeTip) { g.state.flags.routeTip = true; this._toast('Stop at each stop on the timetable. On time = bonus. R abandons the route.', 6); }
    return R;
  }
  _collect(n) { if (n > 0) { this.game.pay(n * BUS.fare); this.route.fares += n * BUS.fare; } }
  _blipNext() {
    const R = this.route, g = this.game;
    if (R.blip) { try { g.ui.removeBlip(R.blip); } catch { /* */ } R.blip = null; }
    const s = R.stops[R.i];
    if (s) { try { R.blip = g.ui.addBlip(s.x, s.z, '#ffd23a', s.name); } catch { R.blip = null; } }
  }
  _routeFrame(dt) {
    const R = this.route, v = R.v;
    R.t += dt;
    const s = R.stops[R.i];
    if (!s) return;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading), d = Math.hypot(v.x + fx * 3 - s.x, v.z + fz * 3 - s.z);
    if (Math.abs(v.speed) < 0.4 && d < 13 && !R.atStop) { R.atStop = true; this._routeArrive(s); if (this.route !== R || !R.stops[R.i]) return; }
    else if (Math.abs(v.speed) > 2) R.atStop = false;
    // skipped it? (you reached a later stop) -> handled in _routeArrive; HUD
    if ((R.nextT -= dt) <= 0) {
      R.nextT = 0.25;
      const left = R.due[R.i] - R.t;
      const txt = `Route ${R.num} · next: ${s.name} (${R.i + 1}/${R.stops.length}) · ${left >= 0 ? 'due in ' + mmss(left) : mmss(-left) + ' late'} · ${d < 13 ? 'here: stop to open the doors' : distWords(d) + ', ' + whereWords(s.x - v.x, s.z - v.z, v.heading)} · ${v.pax || 0} aboard · fares ${money(R.fares)}`;
      if (txt !== R.hud) { R.hud = txt; try { this.game.ui.objective(txt); } catch { /* */ } }
    }
  }
  _routeArrive(stop) {
    const R = this.route; if (!R) return;
    // which route stop is this? (the next one, or a later one if you skipped some)
    let k = -1;
    for (let j = R.i; j < R.stops.length; j++) if (R.stops[j].id === stop.id || Math.hypot(R.stops[j].x - stop.x, R.stops[j].z - stop.z) < 14) { k = j; break; }
    if (k < 0) return;
    for (let j = R.i; j < k; j++) R.legs.push({ name: R.stops[j].name, due: R.due[j], arrive: null, status: 'missed', board: 0, alight: 0 });
    const v = R.v, last = k === R.stops.length - 1, status = punctuality(R.t, R.due[k]);
    const alight = last ? v.pax || 0 : Math.min(v.pax || 0, (Math.random() * 3.2) | 0);
    const board = last ? 0 : (Math.random() * 4.2) | 0;
    if (alight) this._alight(v, alight);
    if (board) { this._setPax(v, (v.pax || 0) + board); this._collect(board); this._boardFromStop(R.stops[k].x, R.stops[k].z, v, board); }
    R.legs.push({ name: R.stops[k].name, due: R.due[k], arrive: Math.round(R.t), status, board, alight });
    R.i = k + 1;
    const a = this.game.audio; if (a && a.ctx) { a.noise(0.6, { gain: 0.07, freq: 2600, q: 0.5 }); this._ding(2); }
    this._toast(`${R.stops[k].name}: ${status}${status === 'on time' ? ' (+' + money(BUS.onTime) + ' bonus)' : ''} · ${alight} off, ${board} on${board ? ' (+' + money(board * BUS.fare) + ')' : ''}`, 3.5);
    if (R.i >= R.stops.length) this._endRoute(true);
    else this._blipNext();
  }
  /** peds waiting near the stop walk to the door and get on (purely visual; the count is separate) */
  _boardFromStop(x, z, v, n) {
    const peds = this.game.pedestrians;
    if (!peds || !peds.near || !peds.control) return;
    let k = 0;
    for (let p of peds.near(x, z, 14, this._tmp || (this._tmp = [])).slice()) {
      if (k >= n) break;
      if (!p.active || p.scripted || p.down || p.ctl || p.leader || p.dog || p.role === 'porter' || p.role === 'police') continue;
      if (p.child || (peds.isGuardian && peds.isGuardian(p))) continue;      // (children and those with them are not taken aboard: systems/_ped_child.js)
      if (p.remote) { p = peds.own ? peds.own(p) : null; if (!p) continue; }      // multiplayer: someone else's walker, ours now
      k++;
      let t = 0;
      peds.control(p, (ped, dt) => {
        t += dt;
        const T = TYPES.bus, fx = Math.sin(v.heading), fz = Math.cos(v.heading), lx = fz, lz = -fx;
        const dx = v.x + fx * (T.L / 2 - 1.2) + lx * (T.W / 2 + 0.5), dz = v.z + fz * (T.L / 2 - 1.2) + lz * (T.W / 2 + 0.5);
        if (ped.character.pose !== 'stand') ped.character.setPose('stand');
        const left = peds.moveTo(ped, dx, dz, 1.6, dt);
        if (left < 0.5 || t > 6 || Math.abs(v.speed) > 1.5) { ped.ctl = null; peds.remove(ped); return true; }
        return true;
      });
    }
  }
  _endRoute(done, why) {
    const R = this.route, g = this.game;
    if (!R) return null;
    this.route = null;
    if (R.v && R.v.rig && R.v.rig.setBlind) R.v.rig.setBlind(R.prevBlind ?? null);   // back to its own blind
    if (R.blip) { try { g.ui.removeBlip(R.blip); } catch { /* */ } }
    try { g.ui.objective(null); } catch { /* */ }
    if (!done) { this._toast(why || 'Route abandoned.', 3); return null; }
    const sum = routeSummary(R.legs);
    if (sum.bonus > 0) g.pay(sum.bonus);
    const s = this.stats; s.routes++; s.busEarned = Math.round((s.busEarned + sum.total) * 100) / 100; s.bestRoute = Math.max(s.bestRoute, sum.total); s.passengers += sum.pax;
    try { g.save(); } catch { /* */ }
    this.lastRoute = { num: R.num, from: R.from, legs: R.legs, ...sum, time: Math.round(R.t) };
    this._showSummary(this.lastRoute);
    return this.lastRoute;
  }
  _showSummary(r) {
    const ui = this.game.ui;
    this.summary = { t: 16 };
    try {
      const o = ui.openOverlay({ dim: false });
      const rows = r.legs.map((l) => `<tr><td>${esc(l.name)}</td><td>${l.status === 'start' ? '—' : mmss(l.due)}</td><td>${l.arrive === null || l.status === 'start' ? '—' : mmss(l.arrive)}</td><td class="st-${l.status.replace(' ', '-')}">${l.status === 'start' ? 'depart' : l.status}</td><td>${l.alight}/${l.board}</td></tr>`).join('');
      o.innerHTML = `<div class="job-summary"><h2>Route ${esc(r.num)} · terminus</h2><div class="sub">${esc(r.from)} → ${esc(r.legs[r.legs.length - 1].name)} · ${mmss(r.time)}</div>
        <table><tr><th>Stop</th><th>Due</th><th>Arrived</th><th></th><th>Off/On</th></tr>${rows}</table>
        <div class="tot">${r.pax} passengers · fares ${money(r.fares)} · punctuality bonus ${money(r.bonus)}${r.perfect ? ' (perfect run!)' : ''}<br><b>Total ${money(r.total)}</b> · routes completed: ${this.stats.routes}</div>
        <div class="hint">E to close</div></div>`;
      o.style.pointerEvents = 'none';
    } catch { /* headless */ }
  }
  _closeSummary() { if (!this.summary) return; this.summary = null; try { this.game.ui.closeOverlay(); } catch { /* */ } }

  // ------------------------------------------------------------ API
  _api() {
    const self = this;
    return {
      get taxi() { return self.taxi; },
      get route() { return self.route; },
      get lastFare() { return self.lastFare; },
      get lastRoute() { return self.lastRoute; },
      get stats() { return self.stats; },
      destinations: () => self._destinations(),
      startRoute: (v) => self.startRoute(v || (self.game.vehicles && self.game.vehicles.current)),
      endRoute: () => self._endRoute(false),
      /** test hooks */
      debugHail: () => { const v = self.game.vehicles && self.game.vehicles.current; if (!v || v.type !== 'taxi') return 'not in a taxi'; self.taxi.v = v; const p = self._findHailer(v); return p ? { x: +p.x.toFixed(1), z: +p.z.toFixed(1), role: p.role } : null; },
      debugBoard: () => { const v = self.taxi.v, p = self.taxi.ped; if (!v || !p) return null; self._board(v, p); return self.taxi.dest; },
      debugArrive: () => { const R = self.route; if (!R) return null; const s = R.stops[R.i]; self._routeArrive(s); return R.legs[R.legs.length - 1]; },
      debugDrop: () => { const v = self.taxi.v; if (!v || self.taxi.phase !== 'ride') return null; return self._dropPassenger(v, true); },
      setPax: (v, n) => self._setPax(v, n),
      _sys: self,
    };
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
