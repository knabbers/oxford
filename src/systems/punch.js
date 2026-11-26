// Punching people (2026-11-23, "make it possible to punch people including police"). Click (with the mouse captured)
// or C, on foot: the player throws a punch — guard, wind-up, strike, recovery, the hands taking turns, on the move too
// (core/characters.js punch()). It reaches about an arm's length in front (pure rules: systems/_punch_logic.js).
// Comic and BLOODLESS: nobody is hurt, nobody stays down, there is no health.
//
// Who it lands on and what they do:
//   a townsperson / student (game.pedestrians)  a stagger back; a second punch soon after (or one thrown at a run) puts
//                 them down (pedestrians.knock: the 'fall', up again in ~4 s). Then, by who they are (role + seed): most
//                 shout or run off, some square up and have a go back (two hits: you stagger, then you go down —
//                 Player.stumble / knockDown), and walk off. Staff at a post, shop visitors inside a room, anyone seated
//                 or in somebody else's charge (a fare, a bus passenger, an owner chasing their car) stagger or flinch
//                 and say so, and are left to what they were doing (doors, seats and queues are theirs).
//   a police officer   an officer walking the beat goes over the same way and then comes for you ("You're nicked!"):
//                 stand still beside them and you are arrested (police.bust); run and they give up in time. An officer
//                 sent after you (police units, road blocks) is knocked over as a car knocks one, and gets up and goes on.
//   a friend      (places/friends.js punch()) goes over as a bike puts him over and says one of his own lines for it.
//   another player   a harmless stagger on their screen (each player owns their own body: they stagger themselves).
//   a child, the adult with children, an animal: nothing at all — the swing does not touch them, and a child or an
//                 animal nearest in front stops it reaching anyone behind.
// Everybody near sees it: they turn to look, back off or scatter (a line or two), police nearby come over. It is an
// offence like the others (police.add: 'punch' = a star when witnessed; 'punch_police' = two).
//
// Multiplayer: 'punch' events — {s} a swing (the others play it on our figure), {s, hit: id, vx, vz} a punch that met
// that player, {n: 1, x, z, s} a swing by a townsperson having a go back (played on their copy). Falls of walkers go out
// through the crowd sync (the walker is claimed first), scripted NPCs' falls as 'pknock', friends' as 'friendLine',
// officers' with the police's own state. Not sent: the staggers of scripted NPCs and the bystanders' reactions (each
// client's own walkers), the responses of a townsperson beyond the poses their owner sends.
//
// Cost: nothing when nobody is punching (two input reads a frame); a swing gathers the people within 2 m once.
// game.punch = { swing(side?), stats(), incidents, config, debugTarget() } (test hooks; tools/smoke_punch.mjs).
import { REACH, CONE, COOLDOWN, STRIKE_AT, DOWN_V, STAGGER_V, HEAT_PUNCH, pickTarget, mayHit, solidHit, temperament, pickLine } from './_punch_logic.js';
import { GUARD_ROLES } from './_ped_child.js';

const UPRIGHT = new Set(['stand', 'talk', 'phone', 'photo', 'drunk', 'wave', 'clap', 'lecture', 'holding-hands', 'arm-in-arm']);      // (as systems/_ped_solid.js: not at a desk, a stool, the bar)
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const R = Math.random;

class Punch {
  constructor(game) {
    this.game = game;
    this.cd = 0; this.side = -1; this.sw = null;
    this.inc = [];                // people answering a punch: { p, t, hits, last, resp, phase, ... }
    this.cands = []; this._near = [];
    this.config = { enabled: true };
    this.stat = { swings: 0, landed: 0, whiffs: 0, blocked: 0, downs: 0, staggers: 0, police: 0, friends: 0, players: 0, hitBack: 0, bystanders: 0 };
    this.last = null;             // what the last swing did (tests)
  }

  update(dt) {
    const g = this.game, inp = g.input;
    if (!this._hooked) this._hook();
    if (this.cd > 0) this.cd -= dt;
    if (inp && (inp.pressed.has('KeyC') || (inp.clicked && inp.locked))) this.swing();
    if (this.sw !== null) this._swingTick(dt);
    if (this.inc.length) this._tick(dt);
  }

  /** may the player throw a punch now? */
  canPunch() {
    const g = this.game, p = g.player;
    return this.config.enabled && !!p && !p.vehicle && !p.swim && !p.ride && !p.frozen && !g.activity && !(g.ui && g.ui.inDialog) && !(g.input && g.input.typing)
      && !(p.downT > 0) && !(p.stumbleT > 0) && p.pose === 'stand' && !!p.character && p.character.pose === 'stand';
  }
  swing(side) {
    if (this.cd > 0 || this.sw !== null || !this.canPunch()) return false;
    const g = this.game, p = g.player;
    this.side = side ? (side < 0 ? -1 : 1) : -this.side;
    p.character.punch(this.side);
    this.cd = COOLDOWN; this.sw = { t: 0, side: this.side }; this.stat.swings++;
    this._sound('whoosh', p.pos.x, p.pos.z);
    const net = g.net; if (net && net.connected) { try { net.send('punch', { s: this.side }); } catch { /* */ } }
    return true;
  }
  _swingTick(dt) {
    const s = this.sw; s.t += dt;
    if (s.t < STRIKE_AT) return;
    this.sw = null;
    try { this.last = this._strike(s.side); } catch (e) { console.warn('[punch]', e); }
  }

  // ------------------------------------------------------------------ what the fist meets
  _gather() {
    const g = this.game, pl = g.player, px = pl.pos.x, pz = pl.pos.z, py = pl.pos.y, C = this.cands;
    let n = 0;
    const add = (x, z, kind, ref, extra) => { const c = C[n] || (C[n] = { x: 0, z: 0, kind: '', ref: null, extra: null, d: 0 }); c.x = x; c.z = z; c.kind = kind; c.ref = ref; c.extra = extra || null; n++; };
    const peds = g.pedestrians, S = peds && peds._sys, r = REACH + 0.5;
    if (peds && peds.near) for (const q of peds.near(px, pz, r, this._near)) {
      if (!q.character || Math.abs((q.y || 0) - py) > 1.1) continue;
      const kind = q.child ? 'child' : GUARD_ROLES[q.role] || (S && S._hasKids && S._hasKids(q)) ? 'guard' : 'ped';
      add(q.x, q.z, kind, q);
    }
    if (pl.place === 'world') {
      if (peds && peds.animals) for (const a of peds.animals) { const ax = a.o[a.kx], az = a.o[a.kz]; if (Math.abs(ax - px) < r && Math.abs(az - pz) < r) add(ax, az, 'animal', a); }
      const P = g.police, U = P && P.units;
      if (U) for (const u of U) {
        if (u.kind === 'foot' && u.ch && !u.down && Math.abs(u.x - px) < r && Math.abs(u.z - pz) < r) add(u.x, u.z, 'unit', u);
        else if (u.kind === 'block' && u.officers) for (const ch of u.officers) { const q = ch.group.position; if (!ch.isDown && Math.abs(q.x - px) < r && Math.abs(q.z - pz) < r) add(q.x, q.z, 'block', ch); }
      }
    }
    const net = g.net;
    if (net && net.connected && net.others) for (const o of net.others.values()) {
      if (!o.seen || o.place !== pl.place || o.veh || o.ride || Math.abs(o.x - px) > r || Math.abs(o.z - pz) > r || Math.abs(o.y - py) > 1.1) continue;
      add(o.x, o.z, 'player', o);
    }
    return n;
  }
  _strike(side) {
    const g = this.game, pl = g.player, px = pl.pos.x, pz = pl.pos.z, fx = Math.sin(pl.heading), fz = Math.cos(pl.heading);
    if (pl.vehicle || pl.swim || pl.downT > 0) return { what: 'none' };
    const n = this._gather();
    let c = pickTarget(this.cands, n, px, pz, fx, fz);
    // a friend nearer than anybody else in front (they are not in the pedestrians' list)
    const F = g.friends, fr = F && F.punch ? F.punch(px, pz, fx, fz, REACH, CONE, true) : null;
    if (fr && (!c || fr.d < c.d)) c = { kind: 'friend', d: fr.d, x: 0, z: 0, ref: fr };
    if (!c) { this.stat.whiffs++; return { what: 'miss' }; }
    if (!mayHit(c.kind)) {
      // a child, the adult with children, an animal, a scripted crowd: the punch has no effect on them whatsoever
      this.stat.blocked++;
      // (the adult with them may say so: a bubble and nothing else — not even their speaking cooldown is touched)
      const now = g.elapsed || 0;
      if (c.kind === 'guard' && c.ref && !c.ref.remote && c.ref.character && now - (this._guardT || -99) > 6) { this._guardT = now; c.ref.character.say(pickLine('guard', (now * 0.618) % 1), 2.5); }
      return { what: 'blocked', kind: c.kind, ref: c.ref };
    }
    const run = Math.hypot(pl.vx || 0, pl.vz || 0);
    switch (c.kind) {
      case 'ped': return this._hitPed(c.ref, fx, fz, run, side);
      case 'unit': case 'block': return this._hitOfficer(c, fx, fz, run);
      case 'friend': {
        const r = F.punch(px, pz, fx, fz, REACH, CONE, false);
        if (!r || !r.down) return { what: 'miss' };
        this.stat.landed++; this.stat.friends++; this.stat.downs++;
        this._sound('thwack', px + fx * 0.8, pz + fz * 0.8, 0.8);
        this._heat('punch_friend', px, pz);
        this._bystanders(px + fx * 0.8, pz + fz * 0.8, null);
        return { what: 'friend', id: r.id, down: true };
      }
      case 'player': {
        const o = c.ref, net = g.net;
        this.stat.landed++; this.stat.players++;
        this._sound('thwack', o.x, o.z, 0.7);
        if (o.character) { try { o.character.setPose('stand'); o.character.setPose('stumble'); } catch { /* */ } }      // (shown at once here; their own state carries the real one)
        if (net && net.connected) { try { net.send('punch', { s: side, hit: o.id, vx: Math.round(fx * 100) / 100, vz: Math.round(fz * 100) / 100 }); } catch { /* */ } }
        return { what: 'player', id: o.id };
      }
    }
    return { what: 'miss' };
  }

  // ------------------------------------------------------------------ townspeople
  _incOf(p) { for (const q of this.inc) if (q.p === p) return q; return null; }
  _hitPed(p0, fx, fz, run, side) {
    const g = this.game, peds = g.pedestrians, S = peds._sys;
    const p = p0.remote ? peds.own(p0) : p0;
    if (!p || !p.active || !p.character || p.child) return { what: 'miss' };      // (could not be claimed: someone else's walker)
    if (GUARD_ROLES[p.role] || (S._hasKids && S._hasKids(p))) return { what: 'blocked', kind: 'guard' };
    const pl = g.player, now = g.elapsed || performance.now() / 1000;
    let I = this._incOf(p);
    const solid = solidHit(I ? I.hits : 0, I ? now - I.last : 99, run);
    if (!I) { I = { p, t: 0, hits: 0, last: now, resp: null, phase: 'wait', round: 0, said: false, x0: p.x, z0: p.z }; this.inc.push(I); }
    I.hits++; I.last = now; I.t = 0; I.said = false;
    let mine = !!p.ctl && p.ctl.punch === true;
    const other = !!p.ctl && !mine;
    // ours already (looking on, backing off, running): handed back first, to answer this punch instead. Someone having a
    // go back, or an officer coming for you, keeps at it unless this one puts them down.
    if (mine && p.ctl.kind !== 'fight' && p.ctl.kind !== 'arrest') { peds.control(p, null); mine = false; }
    // who may be put down: not inside a shop on a visit (the room's own walk), not seated, not at a desk / on a stool, not
    // in somebody else's charge (a fare, a passenger, a car's owner)
    // (knockable: false — the people a place keeps where they are, a college's staff in their rooms, a scripted crowd —
    //  flinch where they stand and say so: never moved)
    const fixed = p.knockable === false;
    const canDown = !fixed && !(p.visit && p.place !== 'world') && p.state !== 'sit' && !(p.scripted && !UPRIGHT.has(p.basePose)) && !other;
    const canMove = canDown || (!fixed && p.visit && p.place !== 'world');
    this.stat.landed++;
    this._sound('thwack', p.x, p.z, solid && canDown ? 1 : 0.75);
    this._heat(p.role === 'police' ? 'punch_police' : 'punch', p.x, p.z);
    if (p.role === 'police') this.stat.police++;
    let what = 'flinch';
    if (solid && canDown) {
      if (mine) { p.ctl = null; p.state = 'walk'; }      // (ours — answering an earlier punch: it goes down first, and answers again after)
      const r = peds.knock(p, fx * DOWN_V, fz * DOWN_V);
      if (r === true) { what = 'down'; this.stat.downs++; I.round++; }
    }
    if (what !== 'down' && canMove && !(p.hopT > 0) && !p.down) {
      // a stagger back along the punch, facing the one who threw it (the hop is the walkers' own: walls, doors, kerb)
      p.bumpT = 1.2; p.hopVx = fx * STAGGER_V; p.hopVz = fz * STAGGER_V; p.hopT = 0.3; p.hopSoft = true;
      p.heading = Math.atan2(-fx, -fz);
      if (p.static) p.stepped = true;      // (staff at a post walk back to it)
      p.character.setPose('stand'); p.character.setPose('stumble');
      what = 'stagger'; this.stat.staggers++;
    }
    if (what === 'flinch' && UPRIGHT.has(p.basePose) && p.state !== 'sit' && !p.down && !(p.hopT > 0)) { p.character.setPose('stand'); p.character.setPose('stumble'); }      // (a flinch on the spot)
    if (what !== 'down') this._say(p, pickLine('stagger', R()), 2.2, 4);
    // what they do about it, once on their feet: decided now (who they are), started when they are up
    const free = !other && !p.cm && !p.scripted && !p.det && !(p.visit) && p.state !== 'sit' && p.role !== 'porter';
    I.resp = free ? temperament(p.role, p.lookSeed || p.sid || p.poolIdx || 1, I.round > 1 ? 1 : 0) : 'shout';
    I.phase = 'wait';
    if (mine && what !== 'down') { /* still under our controller: it carries on (a fighter keeps fighting) */ I.phase = 'on'; }
    this._bystanders(p.x, p.z, p);
    return { what, ped: p, resp: I.resp, solid };
  }
  _tick(dt) {
    const g = this.game, peds = g.pedestrians;
    for (let i = this.inc.length - 1; i >= 0; i--) {
      const I = this.inc[i], p = I.p;
      I.t += dt;
      if (!p.active || p.remote || I.t > 40) { this.inc.splice(i, 1); continue; }
      if (I.phase === 'wait') {
        if (p.down || p.hopT > 0 || I.t < 0.45) continue;
        I.phase = 'on';
        if (I.resp === 'shout') { this._say(p, pickLine('shout', R()), 2.6, 6); I.phase = 'done'; continue; }
        const fn = I.resp === 'fight' ? (q, d) => this._fight(I, q, d) : I.resp === 'arrest' ? (q, d) => this._arrest(I, q, d) : (q, d) => this._flee(I, q, d);
        fn.punch = true; fn.kind = I.resp; I.st = 0; I.sub = 0; I.cdT = 0; I.hitsOn = 0; I.sayT = 0; I.holdT = 0; I.shoveT = 0;
        if (!peds.control(p, fn)) { this._say(p, pickLine('shout', R()), 2.6, 6); I.phase = 'done'; }
        else if (I.resp === 'fight') this._say(p, pickLine('square', R()), 2.2, 6);
        else if (I.resp === 'arrest') this._say(p, pickLine('arrest', R()), 2.4, 6);
        else this._say(p, pickLine('flee', R()), 2.2, 6);
      } else if (I.phase === 'done' || (I.phase === 'on' && !p.ctl && !p.down)) { if (I.t > 6) this.inc.splice(i, 1); }
    }
  }
  /** knocked over while ours (a car, a bike): let go so the fall is the walkers' own (returning false would stand them up) */
  _downNow(p) { p.ctl = null; p.state = 'down'; return true; }
  /** the player as this person can see them: same place, on foot */
  _plOf(p) { const pl = this.game.player; return pl.place === p.place && !pl.vehicle && !pl.swim ? pl : null; }
  _flee(I, p, dt) {
    if (p.down) return this._downNow(p);
    const pl = this._plOf(p), peds = this.game.pedestrians;
    I.st += dt;
    if (!pl || I.st > 5.5) return false;
    let ax = p.x - pl.pos.x, az = p.z - pl.pos.z; const d = Math.hypot(ax, az) || 1;
    if (d > 22) return false;
    ax /= d; az /= d;
    const bend = Math.sin(I.st * 0.9 + (p.poolIdx || 0)) * 0.5;      // (not a straight line: round things, a bit of a zigzag)
    peds.moveTo(p, p.x + (ax - az * bend) * 4, p.z + (az + ax * bend) * 4, 3.8, dt);
    if (p.character.pose !== 'stand') p.character.setPose('stand');
    return true;
  }
  _fight(I, p, dt) {
    if (p.down) return this._downNow(p);
    const g = this.game, pl = this._plOf(p), peds = g.pedestrians, ch = p.character;
    I.st += dt;
    if (!pl || pl.frozen) return false;
    const ex = pl.pos.x - p.x, ez = pl.pos.z - p.z, d = Math.hypot(ex, ez), face = Math.atan2(ex, ez);
    if (d > 9 || I.st > 12) { this._say(p, pickLine('giveUp', R()), 2.4, 6); return false; }
    if (I.hitsOn >= 2) { this._say(p, pickLine('win', R()), 2.6, 8); return false; }
    if (ch.pose !== 'stand' && !ch.isDown) ch.setPose('stand');
    if (I.st < 0.7) { p.speed = 0; p.heading += wrapA(face - p.heading) * Math.min(1, dt * 8); return true; }      // squaring up
    if (I.sub > 0) {
      // the swing in the air: the fist is out STRIKE_AT in
      I.sub += dt; p.speed = 0; p.heading += wrapA(face - p.heading) * Math.min(1, dt * 8);
      if (I.sub >= STRIKE_AT && !I.struck) {
        I.struck = true;
        const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
        if (d < REACH + 0.05 && (ex * fx + ez * fz) / (d || 1) > CONE && !(pl.downT > 0)) {
          I.hitsOn++; this.stat.hitBack++;
          this._sound('thwack', pl.pos.x, pl.pos.z, 0.85);
          if (I.hitsOn >= 2) pl.knockDown(fx * 3.4, fz * 3.4); else pl.stumble({ x: fx, z: fz }, 0.5);
        }
      }
      if (I.sub > 0.5) { I.sub = 0; I.struck = false; }
      return true;
    }
    if (d > 0.95) { peds.moveTo(p, pl.pos.x, pl.pos.z, d > 3 ? 3.4 : 1.8, dt); return true; }
    p.speed = 0; p.heading += wrapA(face - p.heading) * Math.min(1, dt * 8);
    if ((I.cdT -= dt) <= 0 && Math.abs(wrapA(face - p.heading)) < 0.5) {
      I.cdT = 0.9 + R() * 0.4; I.sub = 1e-4; I.struck = false; I.side = -(I.side || 1);
      ch.punch(I.side); this._sound('whoosh', p.x, p.z, 0.8);
      const net = g.net; if (net && net.connected && p.place === 'world') { try { net.send('punch', { n: 1, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, s: I.side }); } catch { /* */ } }
    }
    return true;
  }
  _arrest(I, p, dt) {
    if (p.down) return this._downNow(p);
    const g = this.game, pl = this._plOf(p), peds = g.pedestrians, P = g.police;
    I.st += dt;
    if (!P || P.busy) return false;
    if (!pl || I.st > 20) { this._say(p, pickLine('arrestGive', R()), 2.6, 8); return false; }
    const ex = pl.pos.x - p.x, ez = pl.pos.z - p.z, d = Math.hypot(ex, ez);
    if (d > 30) { this._say(p, pickLine('arrestGive', R()), 2.6, 8); return false; }
    if ((I.sayT -= dt) <= 0 && d < 25) { I.sayT = 3 + R() * 2; this._say(p, pickLine('arrest', R()), 2.2, 2); }
    if (p.character.pose !== 'stand' && !p.character.isDown) p.character.setPose('stand');
    if (d > 1.05) { peds.moveTo(p, pl.pos.x, pl.pos.z, d > 4 ? 3.6 : 1.6, dt); I.holdT = Math.max(0, I.holdT - dt); return true; }
    p.speed = 0; p.heading += wrapA(Math.atan2(ex, ez) - p.heading) * Math.min(1, dt * 8);
    // standing still beside them: nicked (the police's own arrest: fine or caution, released at St Aldate's)
    if (pl.speed < 0.8 && !(pl.downT > 0)) { if ((I.holdT += dt) > 1.8 && pl.place === 'world') { try { P.bust(); } catch { /* */ } return false; } }
    else if ((I.shoveT -= dt) <= 0 && d < 1.0 && !(pl.downT > 0)) { I.shoveT = 3; this._say(p, pickLine('shove', R()), 2, 2); pl.stumble({ x: ex / (d || 1), z: ez / (d || 1) }, 0.4); this.stat.hitBack++; }
    return true;
  }
  /** everybody near notices: a look, a step back or a run, a word or two; officers near come for you */
  _bystanders(x, z, victim) {
    const g = this.game, peds = g.pedestrians; if (!peds || !peds.near) return;
    const near = peds.near(x, z, 14, this._near);
    let n = 0, said = 0;
    for (let i = 0; i < near.length && n < 10; i++) {
      const q = near[i];
      if (q === victim || !q.active || q.remote || q.child || q.down || !q.character || GUARD_ROLES[q.role]) continue;
      if (this._incOf(q)) continue;
      const S = peds._sys; if (S._hasKids && S._hasKids(q)) continue;      // (a parent or teacher: leave them, and their children, be)
      const d = Math.hypot(q.x - x, q.z - z), free = !q.ctl && !q.cm && !q.scripted && !q.det && !q.visit && q.state !== 'sit' && q.state !== 'down';
      n++; this.stat.bystanders++;
      if (said < 2 && q.sayCd <= 0 && R() < 0.5) { said++; this._say(q, pickLine('bystander', R()), 2.2, 6); }
      if (!free) continue;
      if (q.role === 'police') { const I = { p: q, t: 0, hits: 0, last: 0, resp: 'arrest', phase: 'wait', round: 0 }; this.inc.push(I); continue; }
      const mode = d < 7 ? (R() < 0.4 ? 'run' : 'back') : 'look', T = mode === 'run' ? 2.5 + R() * 1.5 : mode === 'back' ? 1.1 + R() * 0.6 : 1.2 + R() * 1;
      const st = { t: 0 };
      const fn = (p, dt) => {
        if (p.down) return this._downNow(p);
        st.t += dt; if (st.t > T) return false;
        const ax = p.x - x, az = p.z - z, dd = Math.hypot(ax, az) || 1;
        if (mode === 'look') { p.speed = 0; p.heading += wrapA(Math.atan2(-ax, -az) - p.heading) * Math.min(1, dt * 5); return true; }
        peds.moveTo(p, p.x + ax / dd * 3, p.z + az / dd * 3, mode === 'run' ? 3.6 : 1.3, dt);
        if (mode === 'back') p.heading = Math.atan2(-ax, -az);      // (backing off, eyes on it)
        return true;
      };
      fn.punch = true; fn.kind = mode;
      peds.control(q, fn);
    }
  }

  // ------------------------------------------------------------------ police
  _hitOfficer(c, fx, fz, run) {
    const g = this.game, P = g.police, S = P && P._sys; if (!S) return { what: 'miss' };
    const now = g.elapsed || performance.now() / 1000, key = c.ref;
    const prev = this._offT && this._offT.get(key), solid = solidHit(prev ? 1 : 0, prev ? now - prev : 99, run);
    (this._offT || (this._offT = new Map())).set(key, now); if (this._offT.size > 20) this._offT.clear();
    this.stat.landed++; this.stat.police++;
    this._heat('punch_police', c.x, c.z);
    this._sound('thwack', c.x, c.z, solid ? 1 : 0.75);
    let what = 'stagger';
    if (c.kind === 'unit') {
      const u = c.ref;
      if (solid && S._knockUnit(u, fx * DOWN_V, fz * DOWN_V)) what = 'down';
      else { u.ch.setPose('stand'); u.ch.setPose('stumble'); const q = this._P || (this._P = { x: 0, z: 0 }); q.x = u.x + fx * 0.35; q.z = u.z + fz * 0.35; g.worldCollider.resolve(q, 0.3); u.x = q.x; u.z = q.z; u.speed = 0; u.ch.say(pickLine('arrest', R()), 2.2); }
    } else {
      if (solid && S._knockBlockOfficer(c.ref, fx * DOWN_V, fz * DOWN_V)) what = 'down';
      else { c.ref.setPose('stand'); c.ref.setPose('stumble'); c.ref.say(pickLine('arrest', R()), 2.2); }
    }
    if (what === 'down') this.stat.downs++; else this.stat.staggers++;
    this._bystanders(c.x, c.z, null);
    return { what, officer: c.kind };
  }
  _heat(src, x, z) {
    const P = this.game.police;
    if (!P || P.busy || (P.config && P.config.enabled === false) || !P.add) return 0;
    const seen = src === 'punch_police' ? 1.5 : Math.max(1, P.witnesses ? P.witnesses(x, z) : 1);      // (the one punched saw it, whoever else did)
    return P.add(src, HEAT_PUNCH[src] || 10, seen);
  }

  // ------------------------------------------------------------------ the rest
  _say(p, text, secs, cd) { const S = this.game.pedestrians && this.game.pedestrians._sys; if (S && S._say) S._say(p, text, secs, cd); else if (p.character) p.character.say(text, secs); }
  /** a soft comic whoosh (the swing) / thwack (a punch that lands): filtered noise, at the place, on the effects bus */
  _sound(kind, x, z, k = 1) {
    const A = this.game.audio; if (!A || !A.ctx || !A.noise) return;
    const pos = [x, z];
    try {
      if (kind === 'whoosh') A.noise(0.17, { gain: 0.045 * k, freq: 900 + R() * 300, q: 0.7, type: 'bandpass', attack: 0.07, pos, cls: 'small' });
      else { A.noise(0.11, { gain: 0.26 * k, freq: 340 + R() * 60, q: 0.8, type: 'lowpass', attack: 0.002, pos, cls: 'small' }); A.noise(0.035, { gain: 0.07 * k, freq: 2100, q: 1.2, type: 'bandpass', attack: 0.001, pos, cls: 'small' }); }
    } catch { /* */ }
  }
  _hook() {
    this._hooked = true;
    const g = this.game, net = g.net; if (!net || !net.on) return;
    net.on('punch', (d, o) => {
      if (!d || typeof d !== 'object' || !o) return;
      const pl = g.player, s = d.s < 0 ? -1 : 1;
      if (d.n) {
        // a townsperson having a go back at the player who owns them: the same swing on our copy of them
        const x = +d.x, z = +d.z; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        const peds = g.pedestrians; if (!peds || pl.place !== 'world') return;
        let best = null, bd = 1.5;
        for (const q of peds.list) { if (!q.active || q.place !== 'world' || q.child || !q.character) continue; const dd = Math.hypot(q.x - x, q.z - z); if (dd < bd) { bd = dd; best = q; } }
        if (best) best.character.punch(s);
        return;
      }
      if (o.character && o.seen) o.character.punch(s);
      if (o.place === pl.place) this._sound('whoosh', o.x, o.z, 0.7);
      if (d.hit === net.id && o.place === pl.place && Math.hypot(o.tx - pl.pos.x, o.tz - pl.pos.z) < 3.2) {
        // their punch met us: a harmless stagger (players never knock each other down; our body is ours to move)
        let vx = +d.vx, vz = +d.vz; if (!Number.isFinite(vx) || !Number.isFinite(vz) || Math.hypot(vx, vz) < 0.1) { vx = pl.pos.x - o.tx; vz = pl.pos.z - o.tz; }
        this._sound('thwack', pl.pos.x, pl.pos.z, 0.7);
        if (pl.stumble) pl.stumble({ x: vx, z: vz }, 0.45);
      }
    });
  }
  api() {
    const self = this;
    return {
      swing: (side) => self.swing(side),
      canPunch: () => self.canPunch(),
      get incidents() { return self.inc; },
      get last() { return self.last; },
      get busy() { return self.sw !== null || self.cd > 0; },
      config: self.config,
      stats: () => ({ ...self.stat, incidents: self.inc.length }),
      /** test hook: what a swing thrown now would meet (no effect) */
      debugTarget() {
        const g = self.game, pl = g.player, n = self._gather();
        const c = pickTarget(self.cands, n, pl.pos.x, pl.pos.z, Math.sin(pl.heading), Math.cos(pl.heading));
        return c ? { kind: c.kind, d: +c.d.toFixed(2) } : null;
      },
      _sys: self,
    };
  }
}

export default {
  id: 'punch',
  install(game) {
    const P = new Punch(game);
    game.punch = P.api();
    return { id: 'punch', update: (dt) => P.update(dt) };
  },
};
