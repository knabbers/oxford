// Riding an AI bus as a PASSENGER (2026-11; walked on and about since 2026-11-23). F still takes a bus from its driver
// (systems/vehicles.js); this is the other thing people do with buses. Whenever one stands at a stop with its doors
// open you simply WALK ON: up to the door, through it, up the step (the fare, £2, goes to the driver as you pass him:
// skint, he waves you on), down the aisle or up the stairs, and sit down in any free seat with the ordinary interact
// key (E; E again to stand up). Sitting puts the view in your own eyes, free mouse look (G: from outside and back);
// standing up gives you back the view you had. The bus carries on along its AI route; you can stand and walk about in it
// while it moves, ring the bell (Space in a seat, or E at a bell push), walk down and step off at a stop.
// How it is put together:
//   * aboard, the local player is `player.vehicle = this.veh` (a placeholder with type null, as gliding's: no ghost for
//     watchers, traffic and the walkers' rules ignore us) and lives in the BUS'S OWN FRAME: the character is a child of
//     the bus rig's group (so it rides with every move, lean and nod of the body, and its planted feet stay planted on
//     the floor) and the real Player.update runs each frame on local coordinates, against the bus's own walls and
//     floors (_busride_logic.js walls / floorAt: a Collider per deck, the door leaves that slide) - the ordinary
//     controls, momentum, steps and stairs, nothing scripted. player.pos is then put back in the world (the camera hook
//     does it again after the traffic has moved the bus, so nothing lags it);
//   * you are in the bus's frame from the pavement just outside its door (where the traffic would otherwise hold you
//     off its side) until you walk back out of it; the doors are a real opening with leaves that close (and that will
//     not close on you: whoever is in the doorway keeps them open, and the bus stands);
//   * sitting down / standing up is the one eased move (from the aisle into the seat), as on a bench;
//   * the inside (_bus_interior.js: one draw + one for the people aboard) exists only for the bus we are in;
//   * the bus leans into corners and nods under braking a little while we are aboard (the rig's own roll and pitch,
//     springs on the measured lateral / longitudinal acceleration; not with prefers-reduced-motion);
//   * on the hills the bus and everything in it are drawn by the terrain warp like the rest of the world (logic flat:
//     world/terrain.js); nothing here knows about the ground's height;
//   * multiplayer: an AI bus is a crowdsync actor (one owner simulates it, the others draw a proxy), not a function of
//     the clock, so a passenger first makes the bus theirs (traffic.hold: claimNow, pinned while aboard) and every peer
//     agrees where it is the usual way. Where the passenger is rides in the ordinary 10 Hz player state as one optional
//     element, s[9] (core/net.js `ride`): [bus actor id, seat index] seated, [bus actor id, -1, x, y, z, heading]
//     standing (bus frame). Watchers put that player there in their copy of that bus (exact, no lag between the two)
//     and draw a seated one on the glass like the other passengers. No new message kind.
import * as THREE from 'three';
import { Collider } from '../core/collision.js';
import { BLINDS, MATS, busRiderFigure, busPaxLayout, setBusNext, blindText } from './_vehiclemeshes.js';
import { makeInterior, paxPlan, makeRain } from './_bus_interior.js';
import { FARE, BUS, DOOR, DOORWAY, decks, seatLayout, paxSeats, windowOf, walkPath, toLocal, toWorld, fareLine, LINES,
  walls, floorAt, ceilAt, deckOf, insideHull, seatReach, seatToSit, bellPushes } from './_busride_logic.js';
import { barrierGap } from './_clearance.js';

const SIT_V = 1.1, TERMINUS = 9, WAIT_BELL = 20, WAIT_DOOR = 25, DOOR_NEAR = 4.5;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pick = (a) => a[Math.floor(Math.random() * a.length) % a.length];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _w = { x: 0, y: 0, z: 0, h: 0, done: false }, _l = { x: 0, z: 0 }, _m = new THREE.Matrix4(), _q2 = new THREE.Quaternion(), _cp = new THREE.Vector3(), _cq = new THREE.Quaternion();
const REDUCED = (() => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

class BusRide {
  constructor(game) {
    this.game = game; this.R = null; this.cand = null; this._candPos = new THREE.Vector3(); this._scanT = 0; this._waitT = 0; this._refused = null;
    this.veh = { type: null, kind: 'bus', name: 'Bus', passenger: true, ownView: true, chase: true, roof: 7.5, speed: 0, camDist: 2.6, x: 0, z: 0, heading: 0 };
    this.riders = new Map();       // other players aboard: id -> { a, rig, style, seat, mesh }
    this.stats = { boarded: 0, fares: 0, free: 0, stops: 0, interiors: 0, sat: 0 };
    this._cols = {};               // per body style: { decks: [Collider...], leaves: [shape, shape] } (the bus frame's walls)
    this.hud = null; this.prm = null;
    try {
      if (typeof document !== 'undefined' && document.body && document.createElement) {
        const el = document.createElement('div'); el.id = 'busride-hud';
        el.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);display:none;padding:6px 14px;background:rgba(10,10,10,.72);border:1px solid #3a3a3a;border-radius:5px;color:#e8e6df;font:13px/1.5 system-ui,sans-serif;text-align:center;pointer-events:none;z-index:20;max-width:92vw';
        document.body.appendChild(el); this.hud = el;
      }
    } catch { /* headless */ }
    const self = this;
    // the camera: ours while aboard (in our seat, or walking about inside); anybody hooked before us comes after
    // (hooked the first time somebody gets on, in front of whoever has the hook by then: systems/swim.js takes it
    // outright at install. Handing the view back - G to the outside view, stepping off - eases over from where our
    // camera was: no cut.)
    this._hookCam = () => {
      if (self._camHooked) return; self._camHooked = true;
      const prev = game.cameraHook, C = self.camS = { live: false, out: 0, p: new THREE.Vector3(), q: new THREE.Quaternion() };
      game.cameraHook = (dt, cam) => {
        if (self._camera(dt, cam)) { C.live = true; C.p.copy(cam.position); C.q.copy(cam.quaternion); return true; }
        if (C.live) { C.live = false; C.out = 1; }
        if (!(C.out > 0)) return prev ? prev(dt, cam) : false;
        if (!(prev && prev(dt, cam))) { if (!game._followCamera) { C.out = 0; return false; } game._followCamera(dt); }
        C.out -= dt / 0.45;
        if (C.out > 0) { const k = C.out * C.out * (3 - 2 * C.out); cam.position.lerp(C.p, k); cam.quaternion.slerp(C.q, k); }
        return true;
      };
    };
    // other players aboard: core/net.js asks each frame where a player with a `ride` really is
    try { if (game.net && game.net.placers) game.net.placers.push((o) => self._placeRemote(o)); } catch { /* */ }
    this.api = {
      get riding() { return !!self.R; }, get phase() { return self.R ? self.R.mode : null; }, get mode() { return self.R ? self.R.mode : null; },
      get bus() { return self.R ? self.R.a : null; }, get seat() { return self.R && self.R.mode !== 'walk' ? self.R.seat : -1; }, get view() { return self.R ? self.R.view : null; },
      get candidate() { return self.cand ? self.cand.a : null; }, get prompt() { return self.R ? self.R.act : null; },
      bell: () => self.bell(), toggleView: () => self.toggleView(),
      /** sit down in seat i (it has to be free and within reach of where you stand: as E does) / stand up */
      sit: (i) => self.sit(i), stand: () => self.stand(),
      /** the seat E would sit you in now (-1: none) */
      seatHere: () => self._seatHere(),
      /** where things are, for tests and tools: the player in the bus and in the world, the bus, what is built */
      state: () => self.state(), stats: self.stats, fare: FARE, _sys: self,
    };
  }

  // ------------------------------------------------------------ helpers
  _toast(t, s) { try { this.game.ui.toast(t, s); } catch { /* */ } }
  _blind(a) { try { return blindText(a.rig && a.rig.blind !== null && a.rig.blind !== undefined ? a.rig.blind : a.blindI ?? null, a.rig ? a.rig.color : 0) || BLINDS[0]; } catch { return null; } }
  _style(a) { return a.rig && a.rig.style === 'bus1' ? 'bus1' : 'bus'; }
  _wanted() { const P = this.game.police; return P ? P.level | 0 : 0; }
  _stopNear(x, z, r) { const tr = this.game.traffic; return tr && tr.nearBusStop ? tr.nearBusStop(x, z, r) : null; }
  _now() { const t = this.game.time; return t && t.now ? t.now() : Date.now(); }
  /** the kerb beside the door of bus a (world) -> _v */
  _doorKerb(a, d = BUS.hw + 0.8, out = _v) {
    const s = Math.sin(a.heading), c = Math.cos(a.heading);
    return out.set(a.x + c * d + s * DOOR.zc, a.y || 0, a.z - s * d + c * DOOR.zc);
  }
  /** is the bus standing at a stop with its doors open (or as good as)? */
  _atStop(a) {
    if (!a || !a.active) return false;
    if (a.dwell > 0 && Math.abs(a.speed) < 0.3) return true;
    if (Math.abs(a.speed) > 0.2) return false;
    if (!a.remote) return false;                       // (our own bus standing in a queue: doors shut)
    this._doorKerb(a);
    return !!this._stopNear(_v.x, _v.z, 12);
  }
  /** its doors are open and it is standing: you can walk on */
  _boardable(a) {
    if (!a || !a.active || a.type !== 'bus' || !a.rig || Math.abs(a.speed) > 0.25 || a.shove) return false;
    if (a.dwell > 0) return true;
    if (!a.remote) return false;
    this._doorKerb(a);
    return !!this._stopNear(_v.x, _v.z, 12);
  }
  /** the crowdsync id of an agent (ours or somebody's proxy), 0 when it has never been on the wire */
  _nidOf(a) {
    if (a.nid) return a.nid;
    const cs = this.game.crowdsync, core = cs && cs.core;
    if (core && core.plist) for (const e of core.plist) if (e.handle === a) return e.id;
    return 0;
  }
  _agentOf(nid) {
    if (!nid) return null;
    const cs = this.game.crowdsync, core = cs && cs.core;
    if (core) { const L = core.local.get(nid); if (L && L.a) return L.a; const e = core.proxies.get(nid); if (e && e.handle) return e.handle; }
    const tr = this.game.traffic; if (tr) for (const a of tr.list) if (a.nid === nid) return a;
    return null;
  }
  /** seats nobody else may have: the AI passengers' and other players' */
  _taken(a, style) {
    const t = new Set();
    for (const w of paxSeats(style, busPaxLayout(a.pax || 0, a.paxSeed || 0))) t.add(w.seat);
    for (const r of this.riders.values()) if (r.a === a && r.seat >= 0) t.add(r.seat);
    return t;
  }
  /** the bus frame's walls for a body style (built once): a Collider per deck; the two door leaves on the lower one */
  _colliders(style) {
    let C = this._cols[style];
    if (C) return C;
    const Wl = walls(style), decksC = [];
    let leaves = null;
    for (let d = 0; d < Wl.decks.length; d++) {
      const col = new Collider();
      for (const s of Wl.decks[d]) col.addSegment(s[0], s[1], s[2], s[3], { tag: 'bus' });
      if (d === 0) leaves = Wl.leaves.map((L) => col.addSegment(L[0], L[1], L[0], L[2], { tag: 'door' }));
      decksC.push(col);
    }
    return (this._cols[style] = C = { decks: decksC, leaves, closed: Wl.leaves });
  }
  /** the leaves as far open as the doors are drawn (k 0..1): each slides 0.5 m away from the middle */
  _leaves(C, k) {
    const s = 0.5 * clamp(k, 0, 1), A = C.leaves[0], B = C.leaves[1], a = C.closed[0], b = C.closed[1];
    A.z1 = a[1]; A.z2 = Math.max(a[1], a[2] - s);
    B.z1 = Math.min(b[2], b[1] + s); B.z2 = b[2];
  }
  /** the world's ground under a point of the bus frame, in the bus frame (the pavement by the door) */
  _groundLocal(a, x, z) {
    toWorld(a.x, a.z, a.heading, x, z, _l);
    const W = this.game.world;
    return (W && W.groundHeight ? W.groundHeight(_l.x, _l.z) : 0) - (a.y || 0);
  }

  // ------------------------------------------------------------ getting on: walking in at the door
  _tryEnter() {
    const g = this.game, p = g.player, c = this.cand;
    if (!c || p.vehicle || p.place !== 'world' || p.swim || p.down || p.frozen) return;
    const a = c.a;
    if (!this._boardable(a) || Math.abs(p.pos.y - (a.y || 0)) > 1.2) return;
    toLocal(a.x, a.z, a.heading, p.pos.x, p.pos.z, _l);
    if (!(_l.x > BUS.hw && _l.x < DOORWAY.inX && _l.z > DOORWAY.z0 && _l.z < DOORWAY.z1)) return;
    if (this._wanted() > 0) { if (this._refused !== a) { this._refused = a; this._toast(pick(LINES.wanted), 3.5); } return; }
    this._enter(a);
  }
  /** into the bus's frame, from wherever we stand by its door (nothing moves: the same spot, now the bus's) */
  _enter(a) {
    const g = this.game, p = g.player, tr = g.traffic;
    if (this.R || !tr || !a || !a.active || a.type !== 'bus' || p.vehicle || p.place !== 'world') return false;
    if (!tr.hold(a)) { this._toast('The doors hiss shut. There will be another one along.', 3); return false; }
    const style = this._style(a);
    toLocal(a.x, a.z, a.heading, p.pos.x, p.pos.z, _l);
    const lp = { x: _l.x, y: p.pos.y - (a.y || 0), z: _l.z, h: wrap(p.heading - a.heading) };
    const s = Math.sin(a.heading), c = Math.cos(a.heading);
    const R = this.R = {
      a, rig: a.rig, style, D: decks(style), S: seatLayout(style), C: this._colliders(style), seat: -1, mode: 'walk', t: 0, lp,
      lvx: c * (p.vx || 0) - s * (p.vz || 0), lvz: s * (p.vx || 0) + c * (p.vz || 0), hold: true, paid: false, free: false,
      path: null, st: { i: 0, u: 0 }, sit: 0, view: 'fp', ry: wrap(g.cameraYaw - a.heading), pitch: g.cameraPitch, camW: NaN,
      door: a.dwell > 0 ? 1 : 0, bell: false, wasAt: true, stops: 0, served: a.stopId ?? -1, next: null, nextT: 0, shoveSeen: false,
      roll: 0, rollV: 0, nod: 0, nodV: 0, pv: a.speed || 0, ph: a.heading, acc: 0, lat: 0, bob: 0, wx: p.pos.x, wy: p.pos.y, wz: p.pos.z,
      rideA: [0, 0], rideW: [0, -1, 0, 0, 0, 0], int: null, people: null, plan: null, paxKey: -1, fig: null, inside: false,
      last: { x: a.x, y: a.y || 0, z: a.z, h: a.heading }, term: 6 + ((a.uid | 0) % 4) || TERMINUS, termHold: false, termT: 0,
      waitT: 0, fd: false, act: null, camMode: '', blendT: 0, fromP: new THREE.Vector3(), fromQ: new THREE.Quaternion(), camD: undefined, fpA: false, ceilE: undefined,
    };
    R.floorFn = (x, z) => { const f = floorAt(style, x, z, p.pos.y); return f !== null ? f : this._groundLocal(a, x, z); };
    this._hookCam();
    p.vehicle = this.veh; p.ride = null;
    // the character joins the bus: its planted feet go with it into the bus's frame (no step, no slide)
    const ch = p.character, grp = ch.group;
    try { if (ch.carried) ch.carried(p.pos.x, p.pos.z, lp.x, lp.z, wrap(lp.h - p.heading)); } catch { /* */ }
    R.rig.group.add(grp); grp.position.set(lp.x, lp.y, lp.z); grp.rotation.set(0, lp.h, 0);
    this._build();
    this.stats.boarded++;
    this._sync(a);
    this._place(false);
    return true;
  }
  _build() {
    const R = this.R;
    try {
      R.int = makeInterior(R.style); R.rig.group.add(R.int); this.stats.interiors++;
      R.int.userData.setDoors(R.door);
    } catch (e) { console.warn('[busride] interior', e); R.int = null; }
    this._plan();
  }
  /** (re)seat the AI passengers inside: baked one a frame in update(), merged when all are done */
  _plan() {
    const R = this.R, a = R.a;
    R.paxKey = (a.pax | 0) * 8 + (a.paxSeed | 0);
    try { R.plan = paxPlan(R.style, a.pax || 0, a.paxSeed || 0, true); } catch (e) { console.warn('[busride] people', e); R.plan = null; }
  }
  _people() {
    const R = this.R; if (!R.plan) return;
    if (!R.plan.done) { R.plan.step(); return; }
    const m = R.plan.mesh(); R.plan = null;
    this._dropPeople(R);
    if (m) { R.people = m; R.rig.group.add(m); if (m.userData.night) R.rig.group.add(m.userData.night); }
  }
  _dropPeople(R) {
    const m = R && R.people; if (!m) return;
    m.removeFromParent(); if (m.userData.night) m.userData.night.removeFromParent();
    m.geometry.dispose(); R.people = null;
  }

  // ------------------------------------------------------------ the frame of the bus: the real Player, on local coordinates
  /** Player.update while we are in the bus (installed over the player's own update; anything else: the original). */
  _frame(dt, orig) {
    const R = this.R, g = this.game, p = g.player;
    if (!R) return orig.call(p, dt);
    if (p.vehicle !== this.veh || p.place !== 'world') { this._cleanup(false); return orig.call(p, dt); }   // somebody else moved us (a door, the police)
    const a = R.a;
    if (!a.active || a.rig !== R.rig) { this._evict(); return orig.call(p, dt); }
    // put somewhere else by somebody (a teleport, a tool): off the bus, where they put us
    if (Math.abs(p.pos.x - R.wx) + Math.abs(p.pos.z - R.wz) > 0.6 || Math.abs(p.pos.y - R.wy) > 1) { this._drop(); return orig.call(p, dt); }
    if (R.mode === 'walk') this._walkStep(dt, orig); else this._seatStep(dt);
  }
  _walkStep(dt, orig) {
    const R = this.R, g = this.game, p = g.player, a = R.a, lp = R.lp;
    if (g.cameraYaw !== R.camW && R.camW === R.camW) R.ry = wrap(g.cameraYaw - a.heading);      // (the view turned by somebody else: a test, a tool)
    this._leaves(R.C, R.door);
    const col = g.collider, veh = g.vehicles, solid = g.solid, yaw = g.cameraYaw, ownGH = hasOwn(g, 'groundHeight'), gh = g.groundHeight;
    p.pos.set(lp.x, lp.y, lp.z); p.heading = lp.h; p.vx = R.lvx; p.vz = R.lvz; p.vehicle = null; p.support = null;
    g.collider = R.C.decks[deckOf(R.style, lp.y)] || R.C.decks[0]; g.vehicles = null; g.solid = null; g.cameraYaw = R.ry; g.groundHeight = R.floorFn;
    try { orig.call(p, dt); }
    finally {
      g.collider = col; g.vehicles = veh; g.solid = solid; g.cameraYaw = yaw;
      if (ownGH) g.groundHeight = gh; else delete g.groundHeight;
      p.vehicle = this.veh;
    }
    lp.x = p.pos.x; lp.y = p.pos.y; lp.z = p.pos.z; lp.h = wrap(p.heading); R.lvx = p.vx; R.lvz = p.vz;
    // the head under the ceiling (a jump bumps it)
    const top = (p.character.dims && p.character.dims.top) || 1.75, c = ceilAt(R.style, lp.x, lp.z, lp.y);
    if (c !== null && lp.y + top > c + 0.06 && !p.onGround) { if (p.vy > 0) p.vy = 0; const fl = R.floorFn(lp.x, lp.z); lp.y = Math.max(fl, c + 0.06 - top); }
    // walked back out of the door onto the pavement: the world's again
    if (!insideHull(lp.x, lp.z) && (lp.x > DOORWAY.outX || lp.x < 0 || lp.z < DOORWAY.z0 - DOORWAY.side || lp.z > DOORWAY.z1 + DOORWAY.side)) { this._leave(); return; }
    this._place(false);
  }
  /** sitting down, sat, standing up: the one eased move (from the aisle into the seat and back) */
  _seatStep(dt) {
    const R = this.R, p = this.game.player, lp = R.lp, s = R.S[R.seat];
    let sp = 0;
    if (R.mode === 'sit' || R.mode === 'rise') {
      walkPath(R.path, R.st, SIT_V * dt, _w);
      lp.x = _w.x; lp.y = _w.y; lp.z = _w.z; sp = _w.done ? 0 : SIT_V;
      const want = R.mode === 'sit' && R.st.i >= R.path.length - 2 ? 0 : _w.h;
      lp.h += wrap(want - lp.h) * Math.min(1, dt * 9);
      if (_w.done) {
        if (R.mode === 'sit') { R.mode = 'seated'; R.t = 0; p.pose = 'sit'; this.stats.sat++; if (R.view === 'fp') { R.ry = s.front ? 0 : s.win ? s.side * 0.45 : 0; R.pitch = 0.04; } }
        else { R.mode = 'walk'; R.t = 0; p.pose = 'stand'; R.seat = -1; }
      }
    } else if (R.mode === 'seated') {
      lp.x = s.x; lp.y = s.y; lp.z = s.z;
      lp.h += wrap(0 - lp.h) * Math.min(1, dt * 8);
    }
    if (R.mode === 'seated') R.sit = Math.min(1, R.sit + dt * 2.6); else R.sit = Math.max(0, R.sit - dt * 3.2);
    p.speed = 0; p.vx = p.vz = 0; R.lvx = R.lvz = 0; p.vy = 0; p.onGround = true;
    const ch = p.character, grp = ch.group;
    ch.setPose(p.pose);
    grp.position.set(lp.x, lp.y, lp.z); grp.rotation.set(0, lp.h, 0);
    if (grp.scale.y !== 1) grp.scale.set(1, 1, 1);
    ch.update(dt, sp);
    this._place(false);
  }
  /** sit down in seat i (free, within reach of where we stand) */
  sit(i) {
    const R = this.R; if (!R || R.mode !== 'walk') return false;
    if (!Number.isInteger(i)) i = this._seatHere();
    const s = R.S[i]; if (!s || this._taken(R.a, R.style).has(i)) return false;
    const r = seatReach(R.style, i), lp = R.lp;
    if (deckOf(R.style, lp.y) !== s.deck || Math.hypot(r[0] - lp.x, r[1] - lp.z) > 1.0) return false;
    R.seat = i; R.mode = 'sit'; R.t = 0; R.view = 'fp';
    R.path = [[lp.x, lp.y, lp.z], [r[0], s.y, r[1]], [s.x, s.y, s.z]]; R.st.i = 0; R.st.u = 0;
    const p = this.game.player; p.pose = 'stand'; p.vx = p.vz = 0; R.lvx = R.lvz = 0;
    return true;
  }
  stand() {
    const R = this.R; if (!R || R.mode !== 'seated') return false;
    const s = R.S[R.seat], r = seatReach(R.style, R.seat);
    R.mode = 'rise'; R.t = 0; R.path = [[s.x, s.y, s.z], [r[0], s.y, r[1]]]; R.st.i = 0; R.st.u = 0;
    this.game.player.pose = 'stand';
    return true;
  }
  _seatHere() {
    const R = this.R; if (!R || R.mode !== 'walk') return -1;
    return seatToSit(R.style, R.lp.x, R.lp.y, R.lp.z, R.ry, this._taken(R.a, R.style), R.pitch);
  }

  // ------------------------------------------------------------ the bell
  bell() {
    const R = this.R, g = this.game, tr = g.traffic;
    if (!R) return false;
    const a = R.a;
    if (R.bell) return true;
    if (a.remote && !tr.hold(a)) { this._toast('The bell button is jammed. Try again.', 2.5); return false; }
    if (a.held && !R.hold && !R.termHold) tr.unhold(a);                 // (hold() was only our way of making it ours)
    R.bell = true; a.reqStop = true; R.waitT = 0;
    // the stop coming up may already have been "nobody waiting, sail past": un-decide it if there is room to pull up
    const nx = this._next(a, true);
    if (nx && nx.id === a.lastStop && nx.id !== R.served && nx.dist > a.speed * a.speed / 5 + 4) a.lastStop = -1;
    R.next = this._next(a, false); R.nextT = 0.4;
    try { const au = g.audio; if (au && au.ctx) { au.tone(1310, 0.42, { gain: 0.07 }); au.tone(1965, 0.3, { gain: 0.018 }); } } catch { /* */ }
    this._toast(R.next ? `Ding. Bus stopping at ${this._stopName(R.next.id)}.` : 'Ding. Bus stopping.', 3);
    return true;
  }
  toggleView() {
    const R = this.R; if (!R || R.mode === 'walk') return false;
    R.view = R.view === 'fp' ? 'chase' : 'fp';
    if (R.view === 'chase') { this.game.cameraYaw = R.a.heading; this.game.cameraPitch = clamp(this.game.cameraPitch, 0.12, 1.2); }
    return true;
  }

  // ------------------------------------------------------------ stops
  _stopName(id) { const tr = this.game.traffic, s = tr && tr.busStops ? tr.busStops[id] : null; return s ? s.name || 'the next stop' : 'the next stop'; }
  /** the next stop the bus will come to: { id, dist }. all: including one it has decided to sail past */
  _next(a, all) {
    const tr = this.game.traffic, R = this.R, served = R ? R.served : -1, S = tr.busStops;
    // (another stand of the stop just served - Queens Lane has five in 60 m - is the same stop: the bus does not pull in again)
    const same = (id) => id === served || (served >= 0 && S[id] && S[served] && S[id].name && S[id].name === S[served].name && Math.hypot(S[id].x - S[served].x, S[id].z - S[served].z) < 120);
    const l = a.lane;
    if (l && typeof l === 'object') {
      if (l.stops) for (const st of l.stops) { if (same(st.id) || st.s < a.s - 1 || (!all && st.id === a.lastStop)) continue; return { id: st.id, dist: st.s - a.s }; }
      let d = l.len - a.s;
      for (const n of [a.next, a.next2]) {
        if (!n || typeof n !== 'object' || !(n.len > 0)) break;
        if (n.stops) for (const st of n.stops) { if (same(st.id) || (!all && st.id === a.lastStop)) continue; return { id: st.id, dist: d + st.s }; }
        d += n.len;
      }
    }
    try { const r = tr.busRoute(a.x, a.z, a.heading, 3); for (const q of r) if (!same(q.id)) return { id: q.id, dist: q.dist }; } catch { /* */ }
    return null;
  }
  /** a bus coming up to the stop the player is standing at pulls in for them (it sails past one stop in four otherwise) */
  _wait(dt) {
    if ((this._waitT -= dt) > 0) return;
    this._waitT = 0.3;
    const g = this.game, p = g.player, tr = g.traffic;
    if (p.vehicle || p.place !== 'world') return;
    const st = this._stopNear(p.pos.x, p.pos.z, 6); if (!st) return;
    for (const a of tr.list) {
      if (a.type !== 'bus' || !a.active || a.remote || !a.lane || !a.lane.stops || a.dwell > 0) continue;
      for (const q of a.lane.stops) {
        if (q.id !== st.id) continue;
        const ds = q.s - a.s;
        if (ds < 3 || ds > 70) break;
        a.reqStop = true;
        if (a.lastStop === q.id && a.stopId !== q.id && ds > a.speed * a.speed / 5 + 4) a.lastStop = -1;
      }
    }
  }
  _scan(dt) {
    if ((this._scanT -= dt) > 0) { if (this.cand && !this._boardable(this.cand.a)) this.cand = null; return; }
    this._scanT = 0.15;
    const g = this.game, p = g.player, tr = g.traffic;
    this.cand = null;
    if (p.vehicle || p.place !== 'world' || p.swim) return;
    let bd = 2.7;
    for (const a of tr.list) {
      if (a.type !== 'bus' || Math.abs(a.x - p.pos.x) > 12 || Math.abs(a.z - p.pos.z) > 12 || !this._boardable(a)) continue;
      this._doorKerb(a, BUS.hw + 0.7);
      const d = Math.hypot(_v.x - p.pos.x, _v.z - p.pos.z);
      // the driver has seen you coming: the doors stay open a little longer (at most 8 s more per stop)
      if (d < 7 && a.dwell > 0 && !a.remote) { if (a._brStop !== a.stopId) { a._brStop = a.stopId; a._brT = 0; } if (a._brT < 8) { a._brT += 0.15; if (a.dwell < 1.2) a.dwell = 1.2; } }
      if (d < bd) { bd = d; this.cand = { a }; this._candPos.set(_v.x, p.pos.y, _v.z); }
    }
    if (!this.cand) this._refused = null;
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, tr = g.traffic;
    if (!tr) return;
    this._riders();
    if (!this.R) { this._scan(dt); this._wait(dt); this._tryEnter(); return; }
    const R = this.R, a = R.a, p = g.player;
    if (p.vehicle !== this.veh || p.place !== 'world') { this._cleanup(false); return; }
    if (!a.active || a.rig !== R.rig) { this._evict(); return; }
    R.last.x = a.x; R.last.y = a.y || 0; R.last.z = a.z; R.last.h = a.heading;
    if (!a.remote) { a.npin = true; a.nclaim = this._now(); }     // ours while we are aboard
    this._people();
    if (R.paxKey !== (a.pax | 0) * 8 + (a.paxSeed | 0) && !R.plan) this._plan();
    this._motion(dt);
    // (a stop: not doors we are holding open ourselves - a jam, the doorway after its dwell ran out)
    const at = this._atStop(a) && !R.fd, lp = R.lp, dk = deckOf(R.style, lp.y);
    R.t += dt;
    // ---- the doorway: whoever stands in it keeps the doors open (they reopen if they were closing) and the bus stands
    const inDoor = R.mode === 'walk' && dk === 0 && lp.x > DOORWAY.x0 && lp.z > DOOR.z0 - 0.3 && lp.z < DOOR.z1 + 0.3;
    if (inDoor && R.door > 0.05 && !R.hold) { if (tr.hold(a)) R.hold = true; }
    else if (!inDoor && R.hold) { R.hold = false; if (!R.termHold) tr.unhold(a); }
    // ---- the fare, to the driver as you step in past him
    if (!R.paid && R.mode === 'walk' && insideHull(lp.x, lp.z) && lp.x < 0.95) this._pay();
    // ---- standing at a stop: the driver waits for somebody on their way to the door (after the bell, or near the door)
    if (at && a.dwell > 0 && !a.remote) {
      R.waitT += dt;
      const nearDoor = R.mode === 'walk' && dk === 0 && Math.hypot(lp.x - 0.4, lp.z - DOOR.zc) < DOOR_NEAR;
      if ((R.bell && R.waitT < WAIT_BELL) || (nearDoor && R.waitT < WAIT_DOOR)) { if (a.dwell < 0.8) a.dwell = 0.8; }
    }
    this._keys();
    if (!this.R) return;
    // ---- stops: the name on the display, arriving, the terminus
    if (at && !R.wasAt) {
      R.wasAt = true; R.stops++; this.stats.stops++; R.waitT = 0;
      if (a.stopId >= 0 && a.dwell > 0) R.served = a.stopId;
      const st = a.dwell > 0 && a.stopId >= 0 ? tr.busStops[a.stopId] : (this._doorKerb(a), this._stopNear(_v.x, _v.z, 14));
      const name = st && st.name ? st.name : 'Bus stop';
      R.here = name; setBusNext(name);
      if (R.stops >= R.term && !a.remote) this._terminus(name);
      else this._toast(R.bell ? `${name}. This is your stop.` : `${name}.`, 3.2);
      if (R.bell) a.reqStop = false;
    } else if (!at && R.wasAt && Math.abs(a.speed) > 0.6) { R.wasAt = false; R.here = null; R.nextT = 0; R.bell = false; }
    // the end of the road (no lane after this one): it terminates there rather than vanish with us in it
    if (!R.termHold && !a.remote && a.lane && typeof a.lane === 'object' && !a.next && a.lane.len - a.s < 35) { this._terminus(R.here || 'End of the route'); R.termEnd = true; }
    if (R.termHold) {
      if (!a.held) tr.hold(a);
      if ((R.termT += dt) > 90 && !R.termEnd) { R.termHold = false; R.stops = 0; tr.unhold(a); this._toast('The driver shrugs and sets off again with you still aboard.', 3.5); }
    }
    if (!at && (R.nextT -= dt) <= 0) {
      R.nextT = 0.5;
      const nx = this._next(a, false);
      R.next = nx;
      if (nx) { const nm = this._stopName(nx.id); setBusNext('Next stop: ' + nm); if (nx.id !== R.told && R.mode === 'seated' && !R.bell) { R.told = nx.id; this._toast(`Next stop: ${nm}`, 2.4); } }
    }
    // ---- doors, lamps, the sign
    // standing in a queue for a quarter of a minute: the driver gives up and opens the doors for anyone who would rather walk
    // (by the ground covered, not the speed: a bus that backs a metre off the van in front and creeps up to it again -
    // traffic.js does that every few seconds with nothing queued behind it - is still stuck. While the doors stand open
    // for a jam the bus stands too: a.standT, traffic.js.)
    if (at || R.jamX === undefined || Math.hypot(a.x - R.jamX, a.z - R.jamZ) > 3) { R.jamX = a.x; R.jamZ = a.z; R.jamT = 0; R.jam = false; }
    else R.jamT = (R.jamT || 0) + dt;
    if (R.jamT > 15 && !R.jam) { R.jam = true; this._toast('Stuck in traffic. The driver shrugs and opens the doors for anyone who would rather walk.', 5); }
    if (R.jam && !a.remote) a.standT = 0.5;
    // (held open for us - the doorway, a jam, the terminus - on our own bus: its dwell is kept up so the body's own doors,
    //  drawn from it by systems/_carfid.js, stand open too; let go when we are done with them)
    const force = !a.remote && (R.hold || R.jam || R.termHold);
    if (force) { if (!(a.dwell > 0.3)) { a.dwell = 0.3; R.fd = true; } } else if (R.fd) { R.fd = false; if (a.dwell > 0 && a.dwell <= 0.3) a.dwell = 0; }
    const open = at || R.hold || R.jam || R.termHold ? 1 : 0;
    if (R.door !== open) {
      const was = R.door; R.door = clamp(R.door + Math.sign(open - R.door) * dt * 2.4, 0, 1);
      if ((was === 0 || was === 1) && g.audio && g.audio.ctx) { try { g.audio.noise(0.5, { gain: 0.05, freq: 2600, q: 0.5 }); } catch { /* */ } }
    }
    const night = !!(g.time && g.time.isNight);
    if (R.int) { const U = R.int.userData; U.setDoors(R.door); U.setLights(night); U.setStopping(R.bell); }
    if (R.people && R.people.userData.night) { const n = R.people.userData.night; if (n.visible !== night) { n.visible = night; R.people.visible = !night; } }
    // rain on the glass (seen from inside only; made the first time it rains on this ride)
    {
      const wet = !!(g.weather && g.weather.rain > 0.04) && R.inside;
      if (wet && !R.rain) { try { R.rain = makeRain(R.style); R.rig.group.add(R.rain); } catch (e) { console.warn('[busride] rain', e); R.rain = false; } }
      if (R.rain && R.rain.visible !== wet) R.rain.visible = wet;
    }
    if (a.shove && !R.shoveSeen) { R.shoveSeen = true; this._toast(pick(LINES.crash), 4); if (g.shake) g.shake(0.35); }
    else if (!a.shove) R.shoveSeen = false;
    this._place(false);
    this._act(at);
    this._hud();
    // what goes on the wire: the seat, or where we stand in the bus
    const nid = this._nidOf(a);
    if (R.mode === 'seated' || R.mode === 'sit') { R.rideA[0] = nid; R.rideA[1] = R.seat; p.ride = R.rideA; }
    else { const W = R.rideW, rr = (v) => Math.round(v * 100) / 100; W[0] = nid; W[1] = -1; W[2] = rr(lp.x); W[3] = rr(lp.y); W[4] = rr(lp.z); W[5] = rr(lp.h); p.ride = W; }
  }

  /** the one thing E does here and now: sit down / stand up / ring the bell */
  _act(at) {
    const R = this.R; let act = null;
    if (R.mode === 'seated') act = { k: 'stand', label: 'Stand up' };
    else if (R.mode === 'walk') {
      const i = this._seatHere();
      if (i >= 0) act = { k: 'sit', i, label: R.S[i].front ? 'Sit at the front' : R.S[i].win ? 'Sit by the window' : 'Sit down' };
      else if (!R.bell && !at) {
        const lp = R.lp, dk = deckOf(R.style, lp.y);
        for (const b of bellPushes(R.style)) { if (deckOf(R.style, b[1] - 1.38) === dk && Math.hypot(b[0] - lp.x, b[2] - lp.z) < 0.8) { act = { k: 'bell', label: 'Ring the bell' }; break; } }
      }
    }
    R.act = act ? act.label : null; R._act = act;
  }
  _keys() {
    const g = this.game, inp = g.input, R = this.R;
    if (!inp || inp.typing || (g.ui && g.ui.inDialog) || g.activity) return;
    const hit = (c) => { if (inp.hit(c)) { inp.pressed.delete(c); return true; } return false; };
    if (hit('KeyF')) this._toast('You are a passenger. Get off first if you want to drive it.', 3);
    if (hit('KeyG')) { if (R.mode === 'walk') { if (g.toggleFirstPerson) g.toggleFirstPerson(); } else this.toggleView(); }
    if (R.mode !== 'walk' && hit('Space')) this.bell();
    if (hit('KeyE')) {
      const A = R._act;
      if (A && A.k === 'sit') this.sit(A.i); else if (A && A.k === 'stand') this.stand(); else if (A && A.k === 'bell') this.bell();
    }
  }

  _pay() {
    const R = this.R, g = this.game, b = this._blind(R.a);
    R.paid = true;
    let ok = false;
    try { ok = !!g.pay(-FARE); } catch { ok = false; }
    if (ok) { this.stats.fares++; this._toast(fareLine(b && b[0], b && b[1], true), 3.5); try { if (g.audio && g.audio.ctx) { g.audio.tone(1760, 0.07, { gain: 0.04 }); g.audio.noise(0.25, { gain: 0.03, freq: 5200, q: 2, when: 0.1 }); } } catch { /* */ } }
    else { R.free = true; this.stats.free++; this._toast(pick(LINES.skint), 4); }
    if (g.ui && g.ui.setMoney) { try { g.ui.setMoney(g.state.money); } catch { /* */ } }
  }

  /** the bus body leans out of corners and nods as it brakes (only the one we are in; springs, a little overshoot) */
  _motion(dt) {
    const R = this.R, a = R.a, rot = R.rig.group.rotation;
    if (dt > 0) {
      const acc = clamp((a.speed - R.pv) / dt, -7, 5), yaw = wrap(a.heading - R.ph) / dt;
      R.pv = a.speed; R.ph = a.heading;
      R.acc += (acc - R.acc) * Math.min(1, dt * 5); R.lat += (clamp(a.speed * yaw, -4, 4) - R.lat) * Math.min(1, dt * 5);
    }
    const k = REDUCED || a.remote ? 0 : 1, W2 = 42, Z2 = 5.2;
    R.rollV += (W2 * (clamp(R.lat * 0.011, -0.035, 0.035) * k - R.roll) - Z2 * R.rollV) * dt; R.roll += R.rollV * dt;
    R.nodV += (W2 * (clamp(-R.acc * 0.0052, -0.014, 0.022) * k - R.nod) - Z2 * R.nodV) * dt; R.nod += R.nodV * dt;
    if (Math.abs(R.roll) < 1e-5 && Math.abs(R.rollV) < 1e-4) R.roll = 0;
    if (Math.abs(R.nod) < 1e-5 && Math.abs(R.nodV) < 1e-4) R.nod = 0;
    if (rot.z !== R.roll) rot.z = R.roll;
    if (rot.x !== R.nod) rot.x = R.nod;
    R.bob += dt * (3 + Math.abs(a.speed) * 1.1);
  }

  /** the player's world position (logic: on the flat) from where they are in the bus, as the bus stands now */
  _place() {
    const R = this.R, a = R.a, p = this.game.player, lp = R.lp;
    toWorld(a.x, a.z, a.heading, lp.x, lp.z, _l);
    p.pos.set(_l.x, (a.y || 0) + lp.y, _l.z); p.heading = wrap(a.heading + lp.h);
    if (p.worldPos) p.worldPos.copy(p.pos);
    const s = Math.sin(a.heading), c = Math.cos(a.heading);
    p.vx = c * R.lvx + s * R.lvz; p.vz = -s * R.lvx + c * R.lvz;
    R.wx = p.pos.x; R.wy = p.pos.y; R.wz = p.pos.z;
    const V = this.veh; V.x = a.x; V.z = a.z; V.heading = a.heading; V.speed = a.speed || 0;
  }

  /** where to step off when the bus has gone from under us: on the pavement beside the door, never in the road, the
   *  water, a wall or a hedge */
  _spot(a) {
    const g = this.game, col = g.worldCollider, V = g.vehicles && g.vehicles._sys;
    const s = Math.sin(a.heading), c = Math.cos(a.heading), y = a.y || 0;
    const at = (d, u, out) => out.set(a.x + c * d + s * u, y, a.z - s * d + c * u);
    const free = (x, z) => {
      if (col) {
        if (col.isFree && !col.isFree(x, z, 0.33)) return false;
        if (col.isWet && col.isWet(x, z)) return false;
        if (barrierGap(col, x, z, 0.6) < 0.3) return false;
        at(BUS.hw + 0.05, DOOR.zc, _v2);
        if (col.raycast && col.raycast(_v2.x, _v2.z, x, z) !== null) return false;
      }
      return true;
    };
    const paved = (x, z) => !(V && V.onCarriage && V.onCarriage(x, z, 0.3));
    let fall = null;
    for (const d of [0.8, 1.1, 1.5, 2.0, 2.6, 3.2]) for (const u of [DOOR.zc, DOOR.zc - 0.9, DOOR.zc + 0.8, 2.2, 1.0]) {
      at(BUS.hw + d, u, _v);
      if (!free(_v.x, _v.z)) continue;
      if (paved(_v.x, _v.z)) return { x: _v.x, z: _v.z, ok: true };
      if (!fall) fall = { x: _v.x, z: _v.z, ok: false };
    }
    at(BUS.hw + 0.9, DOOR.zc, _v);
    try { const q = V && V.findSpot ? V.findSpot(_v.x, _v.z, 0.33, 9, null, (x, z, r) => V.standOk(x, z, r) && free(x, z)) : null; if (q) return { x: q[0], z: q[1], ok: true }; } catch { /* */ }
    if (fall) return fall;
    at(BUS.hw + 0.9, DOOR.zc, _v);
    return { x: _v.x, z: _v.z, ok: false };
  }
  /** walked out of the door: the pavement is the world's again (the same spot, the same step: nothing moves) */
  _leave() {
    const R = this.R, g = this.game, p = g.player, a = R.a, lp = R.lp, ch = p.character, grp = ch.group;
    toWorld(a.x, a.z, a.heading, lp.x, lp.z, _l);
    const wx = _l.x, wz = _l.z, wh = wrap(a.heading + lp.h), s = Math.sin(a.heading), c = Math.cos(a.heading);
    const vx = c * R.lvx + s * R.lvz, vz = -s * R.lvx + c * R.lvz;
    try { if (ch.carried) ch.carried(lp.x, lp.z, wx, wz, wrap(wh - lp.h)); } catch { /* */ }
    g.worldScene.add(grp);
    g.cameraYaw = wrap(a.heading + R.ry); if (!g.firstPerson) g.cameraPitch = clamp(R.pitch, -0.35, 1.35);
    this._cleanup(true);
    p.pos.set(wx, (a.y || 0) + lp.y, wz); p.heading = wh; p.vx = vx; p.vz = vz; p.speed = Math.hypot(vx, vz); p._spd = p.speed;
    if (p.syncMesh) p.syncMesh();
    if (a.dwell > 0 && !a.remote) { a._brStop = a.stopId; a._brT = 8; }      // (the driver does not wait on at this stop for the one who just got off)
    this.lastExit = { x: wx, z: wz, ok: !(g.vehicles && g.vehicles._sys && g.vehicles._sys.onCarriage && g.vehicles._sys.onCarriage(wx, wz, 0.3)), bus: { x: a.x, z: a.z, h: a.heading } };
    if (R.paid || R.free) { if (Math.random() < 0.6) this._toast(pick(LINES.thanks), 2.2); }
  }
  /** put somewhere else while aboard (a teleport): off the bus, left where we were put */
  _drop() {
    const p = this.game.player, x = p.pos.x, y = p.pos.y, z = p.pos.z, h = p.heading;
    this._cleanup(true);
    p.pos.set(x, y, z); p.heading = h; if (p.syncMesh) p.syncMesh();
  }
  /** the bus has gone from under us (taken from its driver, removed): everybody off where it stood, grumbling */
  _evict() {
    const R = this.R, g = this.game, p = g.player, L = R.last;
    const sp = this._spot({ x: L.x, y: L.y, z: L.z, heading: L.h });
    this._cleanup(true);
    p.pos.set(sp.x, g.groundHeight ? g.groundHeight(sp.x, sp.z) : 0, sp.z); p.heading = wrap(L.h + Math.PI / 2); p.pose = 'stand'; p.vy = 0; p.onGround = true; p.vx = p.vz = 0;
    if (p.syncMesh) p.syncMesh();
    this.lastExit = { x: sp.x, z: sp.z, ok: sp.ok, evicted: true };
    this._toast(pick(LINES.taken), 4);
  }
  _terminus(name) {
    const R = this.R, a = R.a, g = this.game, tr = g.traffic;
    this._toast(`${name}. ${pick(LINES.terminus)}`, 4.5);
    // the others get off (a few are seen stepping down; the rest are simply gone when you look round)
    const n = Math.min(4, a.pax | 0), peds = g.pedestrians;
    if (peds && peds.adopt) for (let i = 0; i < n; i++) {
      this._doorKerb(a, BUS.hw + 1.0 + (i % 2) * 0.5);
      const x = _v.x - Math.sin(a.heading) * (0.6 + i * 0.7), z = _v.z - Math.cos(a.heading) * (0.6 + i * 0.7);
      const V = g.vehicles && g.vehicles._sys;
      if (V && V.standOk && !V.standOk(x, z, 0.33)) continue;
      try { peds.adopt(x, z, null, { standing: true, heading: a.heading + Math.PI / 2, lookSeed: (Math.random() * 1e9) | 0, lookKind: 1 }); } catch { /* */ }
    }
    a.pax = 0; a._paxShown = -1; R.stops = 0;
    // it waits there, doors open, until we have got off (and gives up after a minute and a half)
    R.termHold = true; R.termT = 0; tr.hold(a);
  }

  // ------------------------------------------------------------ leaving
  _cleanup(mine) {
    const R = this.R, g = this.game, p = g.player, tr = g.traffic; if (!R) return;
    this.R = null;
    const a = R.a, rig = R.rig;
    try {
      const grp = p.character.group;
      if (grp.parent === rig.group) g.worldScene.add(grp);         // (anything that moved us elsewhere has re-parented us itself)
      if (R.int) R.int.removeFromParent();
      this._dropPeople(R);
      if (R.fig) { R.fig.removeFromParent(); R.fig.geometry.dispose(); }
      if (R.rain) R.rain.removeFromParent();
      if (rig && rig.setInside) rig.setInside(false);
      if (rig && rig.group) { rig.group.rotation.x = 0; rig.group.rotation.z = 0; }
    } catch (e) { console.warn('[busride] cleanup', e); }
    if (a) {
      a._paxShown = -1; a.reqStop = false; a.npin = false;
      if ((R.hold || R.termHold) && tr && a.active) tr.unhold(a);
      if (R.fd && a.dwell > 0 && a.dwell <= 0.3) a.dwell = 0;
    }
    if (p.vehicle === this.veh) p.vehicle = null;
    p.ride = null;
    if (mine) p.pose = 'stand';
    try { const grp = p.character.group; grp.rotation.set(0, p.heading, 0); } catch { /* */ }
    if (g._fp && !g.firstPerson && g._setFirstPerson) g._setFirstPerson(false);
    if (this.hud) this.hud.style.display = 'none';
    this._hudText = '';
    setBusNext('Welcome aboard');
  }

  // ------------------------------------------------------------ the camera
  _camera(dt, cam) {
    const R = this.R, g = this.game;
    if (!R) return false;
    const a = R.a, p = g.player, inp = g.input;
    if (!a.active || a.rig !== R.rig || p.vehicle !== this.veh) return false;
    this._place();                                       // (the bus has moved since the player's update)
    const m = R.rig.group;
    m.updateMatrix();
    if (R.mode !== 'walk' && R.view !== 'fp') { this._setInside(false); R.camMode = 'out'; return false; }
    const mode = R.mode === 'walk' ? 'walk' : 'seat';
    // the first frame of a view: remember where the camera was (in the bus's frame) and ease over from there
    if (R.camMode !== mode) { _m.copy(m.matrix).invert(); R.fromP.copy(cam.position).applyMatrix4(_m); R.fromQ.copy(m.quaternion).invert().multiply(cam.quaternion); R.blendT = 1e-6; R.camMode = mode; }
    const fpWalk = mode === 'walk' && (!!g.firstPerson || R.fpA);
    if (inp && inp.locked) {
      R.ry = wrap(R.ry - inp.mouseDX * 0.0026);
      R.pitch = clamp(R.pitch + inp.mouseDY * 0.0022, mode === 'seat' ? -1.15 : fpWalk ? -1.2 : -0.35, mode === 'seat' ? 1.3 : 1.35);
      if (inp.wheel && mode === 'walk') g.cameraDist = Math.max(1.6, Math.min(40, g.cameraDist * (1 + inp.wheel * 0.12)));
    }
    const fp = mode === 'seat' ? this._seatCam(dt) : this._walkCam(dt);
    if (R.blendT < 1) { R.blendT = Math.min(1, R.blendT + dt / 0.45); const k = R.blendT * R.blendT * (3 - 2 * R.blendT); _cp.lerpVectors(R.fromP, _cp, k); _cq.copy(_q2.copy(R.fromQ).slerp(_cq, k)); }
    const lx = _cp.x, ly = _cp.y, lz = _cp.z;
    cam.position.copy(_cp.applyMatrix4(m.matrix));
    cam.quaternion.copy(m.quaternion).multiply(_cq);
    const fov = mode === 'seat' ? 66 : 62;
    if (cam.fov !== fov) { const d = fov - cam.fov; cam.fov = Math.abs(d) < 0.05 ? fov : cam.fov + d * Math.min(1, dt * 4); cam.updateProjectionMatrix(); }
    { const want = fp && (mode === 'walk' || R.blendT > 0.55); if (want !== !!g._fp || (want && g._fpChar !== p.character)) g._setFirstPerson(want); }      // (the head goes once the camera is nearly in it)
    g.cameraYaw = wrap(a.heading + R.ry); R.camW = g.cameraYaw; g.cameraPitch = clamp(R.pitch, -1.2, 1.35);
    this._setInside(insideHull(lx, lz) && ly > 0.15);
    return true;
  }
  /** first person from the seat (and sitting down / getting up): local pose -> _cp / _cq; true = first person */
  _seatCam(dt) {
    const R = this.R, p = this.game.player, a = R.a;
    // the eye: over the hips when seated, standing height on the way; a touch ahead of the neck, the way the head faces
    const D = p.character.dims || {}, up = (D.neckY || 1.5) - (D.hipY || 0.945) + (D.headC || 0.12) + 0.03;
    const eSit = (D.seat || 0.525) + up - 0.02, eStand = (D.top || 1.75) - 0.11, k = R.sit * R.sit * (3 - 2 * R.sit);
    let ey = eStand + (eSit - eStand) * k;
    if (!REDUCED && Math.abs(a.speed) > 0.5) ey += (Math.sin(R.bob * 2.3) + Math.sin(R.bob * 3.7 + 1) * 0.6) * 0.0035 * Math.min(1, Math.abs(a.speed) / 6);
    // the head tips about the top of the neck: looking down, the eyes come forward over the chest
    const lp = R.lp, cq = Math.cos(R.pitch), sq = Math.sin(R.pitch), fw = Math.max(0.02, 0.09 * cq + 0.13 * sq);
    _cp.set(lp.x + Math.sin(R.ry) * fw, lp.y + ey - 0.13 + 0.13 * cq - 0.09 * sq, lp.z + Math.cos(R.ry) * fw);
    this._underCeil(dt, lp);
    // (never outside the saloon wall when seated by it)
    if (R.sit > 0.5) _cp.x = clamp(_cp.x, -(BUS.wall - 0.15), BUS.wall - 0.15);
    _e.set(-R.pitch, R.ry + Math.PI, 0); _cq.setFromEuler(_e);
    return true;
  }
  /** a tall passenger stoops: the eye is held 13 cm under the ceiling over the head (eased, so a stair does not step it) */
  _underCeil(dt, lp) {
    const R = this.R, c = ceilAt(R.style, lp.x, lp.z, lp.y);
    if (c === null) { R.ceilE = undefined; return; }
    const want = c - 0.13;
    R.ceilE = R.ceilE === undefined ? want : R.ceilE + (want - R.ceilE) * Math.min(1, dt * 7);
    if (_cp.y > R.ceilE) _cp.y = R.ceilE;
  }
  /** standing / walking about inside: the view you had (behind you, or your own eyes; G), kept inside the bus's own
   *  walls and under its ceilings; too tight behind you for the view from behind (sideways in the aisle, the stairs):
   *  your own eyes until there is room again. Local pose -> _cp / _cq; true = first person */
  _walkCam(dt) {
    const R = this.R, g = this.game, p = g.player, lp = R.lp, D = p.character.dims || {}, top = D.top || 1.75;
    const cp = Math.cos(R.pitch), sp = Math.sin(R.pitch), sy = Math.sin(R.ry), cy = Math.cos(R.ry);
    const inside = insideHull(lp.x, lp.z), ceil = ceilAt(R.style, lp.x, lp.z, lp.y);
    let tp = !g.firstPerson;
    if (tp) {
      const ty = Math.min(lp.y + 1.5, ceil !== null ? ceil - 0.18 : Infinity), dx = -sy * cp, dz = -cy * cp;
      let dist = Math.min(g.cameraDist, inside ? 2.6 : 3.6);
      const col = R.C.decks[deckOf(R.style, lp.y)] || R.C.decks[0];
      const t = col.raycast(lp.x, lp.z, lp.x + dx * dist, lp.z + dz * dist);
      if (t !== null) dist = Math.max(0, t * dist - 0.22);
      // under the ceiling wherever the camera would be (the eye rises with the distance when looking down)
      const ex = lp.x + dx * dist, ez = lp.z + dz * dist, cc = ceilAt(R.style, ex, ez, lp.y);
      if (cc !== null && sp > 0.02) dist = Math.min(dist, Math.max(0, (cc - 0.14 - ty) / sp));
      const f0 = floorAt(R.style, ex, ez, lp.y), fl = (f0 !== null ? f0 : lp.y) + 0.3;
      if (sp < -0.02) dist = Math.min(dist, Math.max(0, (fl - ty) / sp));
      const tight = R.fpA ? dist < 1.35 : dist < 1.0;
      R.fpA = tight;
      if (!tight) {
        const cur = R.camD === undefined ? dist : R.camD;
        R.camD = dist < cur ? dist : cur + (dist - cur) * Math.min(1, dt * 3);
        const d = Math.min(R.camD, dist);
        _cp.set(lp.x + dx * d, ty + sp * d, lp.z + dz * d);
        _e.set(-R.pitch, R.ry + Math.PI, 0); _cq.setFromEuler(_e);
        return false;
      }
    } else R.fpA = false;
    R.camD = undefined;
    // through your own eyes: a little ahead of the neck the way you look, dipping as the head tips forward
    const fw = Math.max(0.02, 0.09 * cp + 0.13 * sp);
    _cp.set(lp.x + sy * fw, lp.y + top - 0.1 - 0.13 + 0.13 * cp - 0.09 * sp, lp.z + cy * fw);
    this._underCeil(dt, lp);
    _e.set(-R.pitch, R.ry + Math.PI, 0); _cq.setFromEuler(_e);
    return true;
  }
  /** the camera is inside the hull (the body without its under-box, no figures on the glass) or not */
  _setInside(on) {
    const R = this.R; if (!R || R.inside === on) { if (R && R.fig) R.fig.visible = !on; return; }
    R.inside = on;
    const rig = R.rig;
    try {
      if (rig.setInside) rig.setInside(on);
      if (rig.paxMesh) { if (on) rig.paxMesh.visible = false; else R.a._paxShown = -1; }
      if (R.fig) R.fig.visible = !on;
      for (const r of this.riders.values()) if (r.rig === rig && r.mesh) r.mesh.visible = !on;
    } catch (e) { console.warn('[busride] inside', e); }
  }

  // ------------------------------------------------------------ people on the glass: us and other players
  _riders() {
    const g = this.game, net = g.net, R = this.R;
    // ourselves in a seat, seen from outside (the outside view; what others see is drawn by them the same way)
    if (R) {
      const want = R.mode === 'seated' ? R.seat : -1;
      if (R.figSeat !== want) {
        if (R.fig) { R.fig.removeFromParent(); R.fig.geometry.dispose(); R.fig = null; }
        R.figSeat = want;
        if (want >= 0) { try { R.fig = new THREE.Mesh(busRiderFigure(windowOf(R.style, want, g.player.look)), MATS.body); R.fig.name = 'bus-rider'; R.fig.castShadow = false; R.fig.visible = !R.inside; R.rig.group.add(R.fig); } catch { R.fig = null; } }
      }
    }
    if (!net || !net.others) return;
    for (const [id, r] of this.riders) {
      const o = net.others.get(id);
      if (!o || !o.ride || this._agentOf(o.ride[0]) !== r.a || (o.ride[1] | 0) !== r.seat || !r.a.active || r.a.rig !== r.rig) {
        if (r.mesh) { r.mesh.removeFromParent(); r.mesh.geometry.dispose(); }
        this.riders.delete(id);
      }
    }
    for (const o of net.others.values()) {
      if (!o.ride || this.riders.has(o.id)) continue;
      const a = this._agentOf(o.ride[0]); if (!a || !a.active || !a.rig || a.type !== 'bus') continue;
      const style = this._style(a), S = seatLayout(style), seat = o.ride[1] | 0;
      if (seat >= 0 && !S[seat]) continue;
      if (seat < 0 && o.ride.length < 6) continue;
      let mesh = null;
      if (seat >= 0) { try { mesh = new THREE.Mesh(busRiderFigure(windowOf(style, seat, o.look)), MATS.body); mesh.name = 'bus-rider'; mesh.castShadow = false; mesh.visible = !(R && R.rig === a.rig && R.inside); a.rig.group.add(mesh); } catch { mesh = null; } }
      this.riders.set(o.id, { a, rig: a.rig, style, seat, mesh });
    }
  }
  /** core/net.js: another player says they are in a seat / standing in a bus: put their character there in our copy */
  _placeRemote(o) {
    const r = this.riders.get(o.id); if (!r || !o.ride) return false;
    const m = r.rig.group;
    m.updateMatrix();
    let h = r.a.heading;
    if (r.seat >= 0) { const s = seatLayout(r.style)[r.seat]; _v.set(s.x, s.y, s.z); }
    else { _v.set(+o.ride[2] || 0, +o.ride[3] || 0, +o.ride[4] || 0); h += +o.ride[5] || 0; }
    _v.applyMatrix4(m.matrix);
    const grp = o.character.group;
    grp.position.copy(_v); grp.rotation.y = h; grp.rotation.z = 0;
    o.x = _v.x; o.y = _v.y; o.z = _v.z; o.h = h;
    return true;
  }

  _hud() {
    const R = this.R, b = this._blind(R.a);
    if (!this.hud) return;
    const head = (b ? `Route ${b[0]} towards ${b[1]}` : 'Bus') + (R.here ? ` · ${R.here}` : R.next ? ` · next stop: ${this._stopName(R.next.id)}` : '');
    const line = R.act ? `<b style="display:inline-block;background:#f3e7b3;color:#111;border-radius:4px;padding:0 7px;margin-right:8px">E</b>${R.act}` : (R.bell ? '<b style="color:#ff6a55">BUS STOPPING</b>' : '');
    const t = head + '|' + line;
    if (t === this._hudText) return;
    this._hudText = t;
    this.hud.innerHTML = `<span style="color:#ffa41c">${head.replace(/</g, '&lt;')}</span>${line ? '<br>' + line : ''}`;
    this.hud.style.display = 'block';
  }

  state() {
    const R = this.R, p = this.game.player;
    if (!R) return { riding: false, candidate: !!this.cand, lastExit: this.lastExit || null };
    const s = R.seat >= 0 ? R.S[R.seat] : null;
    return { riding: true, mode: R.mode, phase: R.mode, seat: R.seat, deck: s && R.mode !== 'walk' ? s.deck : deckOf(R.style, R.lp.y), win: s ? s.win : false,
      local: { x: R.lp.x, y: R.lp.y, z: R.lp.z, h: R.lp.h }, world: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
      bus: { x: R.a.x, z: R.a.z, h: R.a.heading, speed: R.a.speed, dwell: R.a.dwell, remote: !!R.a.remote, nid: this._nidOf(R.a), held: !!R.a.held }, style: R.style, view: R.view, inside: R.inside,
      bell: R.bell, paid: R.paid, free: R.free, stops: R.stops, next: R.next ? this._stopName(R.next.id) : null, here: R.here || null, door: R.door, sit: R.sit,
      jam: !!R.jam, terminus: !!R.termHold, interior: !!R.int, people: !!R.people, rain: !!(R.rain && R.rain.visible), roll: R.roll, nod: R.nod, prompt: R.act, hold: R.hold, cam: R.camMode, fp: !!this.game._fp };
  }
  /** multiplayer: the bus is ours now (pinned): everyone hears of it at once */
  _sync(a) { try { a.npin = true; } catch { /* */ } }
}

export default {
  id: 'busride',
  install(game) {
    const S = new BusRide(game);
    game.busride = S.api;
    // the player's own update, run in the bus's frame while aboard (BusRide._frame); untouched otherwise
    const P = game.player;
    if (P && typeof P.update === 'function' && !P.update._bus) {
      const orig = P.update;
      const fn = function (dt) { return S._frame(dt, orig); };
      fn._bus = true; P.update = fn;
    }
    return S;
  },
};
