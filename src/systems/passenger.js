// Riding as a PASSENGER in a vehicle another player is driving (2026-11: "i want to be able to get in the passenger
// seat when my friend is driving").
//   F   beside a friend's car / cab / van / bus / punt that is standing or crawling: get in. The front passenger seat
//       first, then the back seats (a bus: any free seat; a punt: the cushions). Not a bicycle.
//   F   again once it has all but stopped: get out, on the kerb side, never into a wall or over a fence
//   G   the view: from your seat (the mouse looks about) / from behind the car
//   the driver gets out: the car stands there as any empty car does; F slides you across to drive it, E gets you out
//   the driver leaves the room, goes through a door or is whisked away: you are put on the pavement where the car was
// How it is put together:
//   * A player's vehicle is not an object on anyone else's machine: the others draw it from the driver's own state
//     (core/net.js: position, heading, type, colour). A passenger therefore sends no position of their own that could
//     drift against it. They send only "I am riding player <id> in seat <n>", in the optional element s[9] of the
//     ordinary 10 Hz player state (`ride`, as [-id, n]: _passenger_logic.js). That state is what the relay hands a
//     late joiner for everybody in the room, so someone arriving mid-ride sees the passenger seated from the first
//     frame. No new message kind.
//   * Every machine then puts the passenger in that seat of ITS OWN copy of the car, every frame: the driver's from
//     the car they are driving, everyone else's from the driver's state as they draw it. Twice a frame: in core/net.js
//     as it draws the players (net.placers) and again in the camera hook, after every player has been moved, so the
//     seat never lags the car by a frame. The position the passenger does send (the seat, as they see it) is only what
//     an older client would use; voice chat reads the seat position (net.others x / z are the seat's here).
//   * the local passenger is `player.vehicle = this.veh`, a placeholder with type null (as the bus seat's and the
//     glider's: nothing is drawn for it, the traffic and the police take no notice of it), pose 'sit'.
//   * Police: offences are counted on the machine of whoever commits them, against their own vehicle. A passenger has
//     none (systems/police.js skips the placeholder), so the driver's wanted level stays the driver's.
//   * Players only. Nothing here seats a pedestrian, a friend or a child: the only things ever put in a seat are the
//     local player and the entries of net.others.
import * as THREE from 'three';
import { TYPES, PUNT, MATS, seatsOf, styleOf, makeLive, busRiderFigure } from './_vehiclemeshes.js';
import { BEAMS } from '../world/lightmap.js';
import { seatLayout, defaultSeat, windowOf, DOOR } from './_busride_logic.js';
import { barrierGap } from './_clearance.js';
import { makeInterior } from './_bus_interior.js';
import { BOARD_MAX, LEAVE_MAX, REACH, encodeRide, decodeRide, seatWorld, carFromRider, bodyDist, pickSeat, settleSeat, exitTries, exitSweep, driverGone } from './_passenger_logic.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const CAR_SEAT_NAMES = ['front passenger seat', 'back seat', 'back seat, behind the driver'];
const _c = mkCar(), _c2 = mkCar(), _s = { x: 0, y: 0, z: 0, h: 0 };
function mkCar() { return { ok: false, live: false, type: '', color: 0, x: 0, y: 0, z: 0, h: 0, speed: 0, v: null }; }

/** where the DRIVER's own feet origin is in a vehicle's frame (what a driving player reports as their position: systems/vehicles.js RIDER) */
function riderOf(type) {
  const T = TYPES[type];
  if (type === 'punt') return [0.08, PUNT.floorY, PUNT.standZ];
  return [T.seat.x, T.seat.y - 0.45, T.seat.z];
}
/** what a body is called: its type's name, but a bus in a single-decker's colours is a single-decker */
function nameOf(type, color) {
  const T = TYPES[type]; if (!T) return 'vehicle';
  if (type === 'bus') { try { if (styleOf('bus', color) === 'bus1') return 'single-decker bus'; } catch { /* */ } }
  return T.name;
}
const _seats = new Map(), _riders = new Map();
/** The passenger seats of a body: { seats: [[x, y, z, yaw]...], order: [seat index, best first], names } */
export function seatsFor(type, color) {
  const T = TYPES[type]; if (!T || T.kind === 'bike') return null;
  const hex = Number.isFinite(color) ? color : T.colors[0];
  let st = null; try { st = styleOf(type, hex); } catch { st = null; }
  const key = type + ':' + st;
  let S = _seats.get(key); if (S) return S;
  if (type === 'punt') {
    // the cushions amidships (where the people in the hired punts sit, systems/vehicles.js _npcPunts): the forward one faces the punter
    S = { seats: [[0, -0.02, 1.2, Math.PI], [0, -0.02, -0.6, 0]], order: [0, 1], names: ['the cushions, facing the punter', 'the cushions by the punter'] };
  } else if (type === 'bus') {
    const style = st === 'bus1' ? 'bus1' : 'bus', L = seatLayout(style), taken = new Set(), order = [];
    for (;;) { const i = defaultSeat(style, taken); if (i < 0) break; order.push(i); taken.add(i); }
    S = { seats: L.map((q) => [q.x, q.y, q.z, 0]), order, names: null, bus: true };
  } else {
    let P = null; try { P = seatsOf(type, hex); } catch { P = null; }
    const seats = [];
    if (P && P.p) { seats.push([P.p[0], P.p[1], P.p[2], 0]); for (const r of P.rear || []) seats.push([r[0], r[1], r[2], 0]); }
    else seats.push([-T.seat.x, T.seat.y - 0.45, T.seat.z, 0]);
    S = { seats, order: seats.map((_, i) => i), names: CAR_SEAT_NAMES };
  }
  _seats.set(key, S);
  return S;
}

class Passenger {
  constructor(game) {
    this.game = game; this.R = null; this.cand = null; this._candPos = { x: 0, y: 0, z: 0 };
    this.veh = { type: null, kind: 'seat', name: 'Passenger seat', playerSeat: true, chase: true, speed: 0, camDist: 1.5, x: 0, z: 0, heading: 0 };
    this.rideA = [0, 0];
    this.mem = new Map();          // driver id -> where their vehicle last was { type, color, x, y, z, h, t, v }
    this.stats = { boarded: 0, left: 0, evicted: 0, drove: 0 };
    this.lastExit = null; this.t = 0;
    const self = this;
    try {
      game.interact.add({ key: 'F', radius: 7, pos: () => (self.cand ? self._candPos : null), enabled: () => !!self.cand && !self.R, label: () => self._label(), onUse: () => { if (self.cand) self.board(self.cand.id, self.cand.seat); } });
    } catch { /* no interact in a bare test */ }
    // other players in a seat: core/net.js asks, as it draws each player with a `ride`, where they really are
    try { if (game.net && game.net.placers) game.net.placers.push((o) => self._placeOther(o)); } catch { /* */ }
    this.api = {
      get riding() { return !!self.R; }, get seat() { return self.R ? self.R.seat : -1; }, get driver() { return self.R ? self.R.driver : 0; },
      get parked() { return !!(self.R && self.R.parked); }, get candidate() { return self.cand; },
      board: (id, seat) => self.board(id, seat), leave: (force) => self.leave(force), drive: () => self.drive(),
      seatsFor, state: () => self.state(), stats: this.stats, _sys: self,
    };
  }

  _toast(t, s) { try { this.game.ui.toast(t, s); } catch { /* */ } }
  _V() { const V = this.game.vehicles; return V && V._sys ? V._sys : null; }
  _vprompt(text, key) { const V = this._V(); try { if (V && V._prompt) V._prompt(text, key); } catch { /* */ } }
  _label() {
    const c = this.cand; if (!c) return '';
    const T = TYPES[c.type], S = seatsFor(c.type, c.color), nm = S && S.names ? S.names[c.seat] : null;
    return `Get in ${c.name ? c.name + '’s' : 'the'} ${nameOf(c.type, c.color)}${nm ? ' · ' + nm : ''}`;
  }

  // ------------------------------------------------------------ whose vehicle is where
  /** The vehicle player `id` is driving, as THIS machine has it -> out { ok, live, type, color, x, y, z, h, speed, v }.
   *  live: being driven now. Not live: where it was left (v = the empty vehicle standing there, when there is one). */
  _carrier(id, out) {
    const g = this.game, net = g.net, V = g.vehicles;
    out.ok = false; out.live = false; out.v = null;
    if (!id || !net) return out;
    if (id === net.id) {
      const v = V && V.current;
      if (v && !v.ai && (v.kind === 'car' || v.kind === 'punt') && g.player.place === 'world') {
        out.type = v.type; out.color = v.color; out.x = v.x; out.y = v.y || 0; out.z = v.z; out.h = v.heading; out.speed = Math.abs(v.speed || 0); out.ok = out.live = true; out.v = v;
      }
    } else {
      const o = net.others.get(id), T = o ? TYPES[o.veh] : null;
      if (o && o.seen && o.place === 'world' && T && T.kind !== 'bike') {
        let r = _riders.get(o.veh); if (!r) _riders.set(o.veh, (r = riderOf(o.veh)));
        carFromRider(o.x, o.y, o.z, o.h, r, out);
        out.type = o.veh; out.color = Number.isFinite(o.vcol) ? o.vcol : T.colors[0]; out.speed = Math.abs(o.speed || 0); out.ok = out.live = true;
      }
    }
    let m = this.mem.get(id);
    if (out.live) {
      if (!m) this.mem.set(id, (m = { type: '', color: 0, x: 0, y: 0, z: 0, h: 0, t: 0, v: null }));
      m.type = out.type; m.color = out.color; m.x = out.x; m.y = out.y; m.z = out.z; m.h = out.h; m.t = this.t; m.v = null;
      return out;
    }
    if (!m) return out;
    // left standing: the empty vehicle of that type where it was (ours, or the copy the others are sent of it)
    let v = m.v;
    const L = V ? V.list : null;
    if (v && (!L || !L.includes(v) || v.driver || v === V.current)) v = m.v = null;
    if (!v && L) {
      let bd = 2.6;
      for (const q of L) {
        if (q.type !== m.type || q.driver || q === V.current || q.ai) continue;
        const d = Math.hypot(q.x - m.x, q.z - m.z);
        if (d < bd && Math.abs(wrap(q.heading - m.h)) < 0.7) { bd = d; v = q; }
      }
      m.v = v;
    }
    if (v) { m.x = v.x; m.y = v.y || 0; m.z = v.z; m.h = v.heading; m.t = this.t; }
    out.type = m.type; out.color = m.color; out.x = m.x; out.y = m.y; out.z = m.z; out.h = m.h; out.speed = 0; out.v = v; out.ok = true;
    return out;
  }
  /** the seats of `driver`'s vehicle that other players say they are in (not counting player `except`) */
  _claims(driver, except) {
    const net = this.game.net, out = [];
    if (net && net.others) for (const o of net.others.values()) {
      if (o.id === except) continue;
      const d = decodeRide(o.ride); if (d && d.driver === driver) out.push({ id: o.id, seat: d.seat });
    }
    return out;
  }
  _onFootOk() {
    const g = this.game, p = g.player, V = g.vehicles;
    return !!(g.net && g.net.connected) && p.place === 'world' && !p.vehicle && !p.swim && !p.down && !(V && (V.current || V.taking));
  }
  _ctl() { const g = this.game, inp = g.input; return !!inp && !inp.typing && !(g.ui && g.ui.inDialog) && !g.activity; }

  // ------------------------------------------------------------ getting in
  _scan() {
    const g = this.game, p = g.player, net = g.net;
    this.cand = null;
    if (!this._onFootOk() || p.frozen || !net.others.size) return;
    let best = 1e9;
    for (const o of net.others.values()) {
      const T = TYPES[o.veh];
      if (!T || T.kind === 'bike' || !o.seen || o.place !== 'world' || Math.abs(o.x - p.pos.x) > 16 || Math.abs(o.z - p.pos.z) > 16 || Math.abs((o.y || 0) - p.pos.y) > 3) continue;
      if (!(Math.abs(o.speed || 0) < BOARD_MAX)) continue;
      const c = this._carrier(o.id, _c2); if (!c.live) continue;
      const d = bodyDist(c.x, c.z, c.h, T.L, T.W, p.pos.x, p.pos.z);
      if (d > (T.kind === 'punt' ? REACH.punt : REACH.car) || d > best) continue;
      const S = seatsFor(c.type, c.color); if (!S) continue;
      const taken = new Set(); for (const q of this._claims(o.id, 0)) taken.add(q.seat);
      const seat = pickSeat(S.order, taken); if (seat < 0) continue;
      best = d;
      this.cand = { id: o.id, seat, type: c.type, color: c.color, name: o.name };
      const fx = Math.sin(c.h), fz = Math.cos(c.h), half = Math.max(0, T.L / 2 - T.W / 2), u = clamp((p.pos.x - c.x) * fx + (p.pos.z - c.z) * fz, -half, half);
      this._candPos.x = c.x + fx * u; this._candPos.y = p.pos.y; this._candPos.z = c.z + fz * u;
    }
  }
  /** get into the vehicle player `id` is driving (seat: the one wanted; left out = the best free one). false = refused */
  board(id, seat) {
    const g = this.game, p = g.player;
    if (this.R || !this._onFootOk()) return false;
    const c = this._carrier(id, _c); if (!c.live) return false;
    const T = TYPES[c.type], S = seatsFor(c.type, c.color); if (!T || !S) return false;
    if (c.speed >= BOARD_MAX) { this._toast('It is going too fast to get in.', 2.5); return false; }
    const taken = new Set(); for (const q of this._claims(id, 0)) taken.add(q.seat);
    if (seat === undefined || seat === null) seat = pickSeat(S.order, taken);
    if (seat < 0 || !S.seats[seat]) { this._toast('No seat free.', 2.5); return false; }
    if (taken.has(seat)) { this._toast('Somebody is sitting there.', 2.5); return false; }
    const o = g.net.others.get(id);
    this.R = { driver: id, seat, type: c.type, color: c.color, S, name: o ? o.name : '', parked: false, noV: 0, wasLive: true, cx: c.x, cz: c.z, camH: c.h, px: 0, pz: 0, t: 0 };
    this.cand = null;
    p.vehicle = this.veh; p.pose = 'sit'; p.speed = 0; p.vx = p.vz = 0;
    try { p.character.setPose('sit'); p.character.group.rotation.order = 'YXZ'; } catch { /* */ }
    this.veh.camDist = T.camDist || 1.5;
    this.rideA = encodeRide(id, seat); p.ride = this.rideA;
    this._place(c);
    this.stats.boarded++;
    try { const a = g.audio; if (a && a.ctx && T.kind === 'car') { a.noise(0.16, { gain: 0.2, freq: 210, type: 'lowpass', q: 0.8 }); } } catch { /* */ }
    this._toast(`${T.kind === 'punt' ? 'Aboard' : 'In'} ${this.R.name ? this.R.name + '’s' : 'the'} ${nameOf(c.type, c.color)}.  F: get out once it has stopped · G: the view from your seat`, 5);
    return true;
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;
    if (!this._camHooked) this._hookCam();
    if ((this._memT = (this._memT || 0) + dt) > 10) { this._memT = 0; for (const [id, m] of this.mem) if (this.t - m.t > 120 && !(this.R && this.R.driver === id)) this.mem.delete(id); }
    // (the vehicles other players ride in are followed from the moment somebody is in them, so that where one was left is known)
    const net = g.net;
    // (a friend's bus is drawn here as its outside only: while we sit in it, it is given its saloon - seats, stairs, poles,
    // the cab - the same interior an AI bus gets when ridden: systems/_bus_interior.js; in the body's own frame (the ghost's group
    // sits at the driver's seat, its body offset from it). Taken out again when we leave.)
    // (2026-11, second pass: seats and poles alone hung in the air - the ghost is an outside-only shell, not drawn from
    // within, and the box that closes its underside stood in the saloon. The bus we are IN is now drawn as the full
    // live body (makeLive: wheels turning, lamps) in its `inside` mode with the saloon in it, exactly as an AI bus
    // ridden through systems/busride.js; the plain ghost is hidden meanwhile and comes back when we leave: _busBody.)
    this._busBody(dt);
    if (net && net.others) for (const o of net.others.values()) { const d = decodeRide(o.ride); if (d && !(this.R && this.R.driver === d.driver)) this._carrier(d.driver, _c2); }
    const R = this.R;
    if (!R) {
      this._scan();
      if (this.cand && this._ctl() && g.input.hit('KeyF')) { g.input.pressed.delete('KeyF'); this.board(this.cand.id, this.cand.seat); }
      return;
    }
    // somebody else moved us (a door, the police, a teleport): no longer in the seat
    if (p.vehicle !== this.veh || p.place !== 'world' || Math.hypot(p.pos.x - R.px, p.pos.z - R.pz) > 4) { this._cleanup(false); return; }
    R.t += dt;
    const c = this._carrier(R.driver, _c);
    if (c.live) {
      // (whisked away with the car under them: we stay behind)
      if (Math.hypot(c.x - R.cx, c.z - R.cz) > 25) { c.x = R.cx; c.z = R.cz; c.live = false; this._evict(c); return; }
      if (c.type !== R.type) { c.x = R.cx; c.z = R.cz; this._evict(c); return; }       // (they are in something else now)
      R.cx = c.x; R.cz = c.z; R.parked = false; R.noV = 0; R.wasLive = true;
    } else {
      if (!c.ok) { this._evict(null); return; }
      if (R.wasLive) {
        R.wasLive = false;
        const o = net.others.get(R.driver);
        if (driverGone({ present: !!o, inWorld: !!o && o.place === 'world', dist: o ? Math.hypot(o.tx - c.x, o.tz - c.z) : Infinity })) { this._evict(c); return; }
      }
      if (c.v) { R.parked = true; R.noV = 0; R.cx = c.x; R.cz = c.z; }
      else { R.parked = false; if ((R.noV += dt) > 4) { this._evict(c); return; } }
    }
    // two of us asked for the same seat at once: the lower id keeps it
    const claims = this._claims(R.driver, 0), seat = settleSeat(net.id, R.seat, claims, R.S.order);
    if (seat !== R.seat) {
      if (seat < 0) { this._toast('Somebody was quicker: no seat free.', 3); this._evict(c); return; }
      R.seat = seat; this.rideA = encodeRide(R.driver, seat);
    }
    this._keys(c);
    if (!this.R) return;
    this._place(c);
    p.ride = this.rideA;
    const T = TYPES[R.type];
    if (R.parked) this._vprompt(`${T.kind === 'punt' ? 'Take the pole' : R.type === 'bus' ? 'Take the wheel' : 'Slide across and drive'} · <b>E</b> get out`, 'F');
    else if (c.live && c.speed < LEAVE_MAX) this._vprompt('Get out', 'F');
    else this._vprompt(null);
  }

  /** The friend's bus the local player is sitting in: the full body and its saloon in place of the ghost (every other
   *  player's bus stays a ghost). Called every frame, and at once when the ride ends. What is made here is ours to throw
   *  away: the two one-instance meshes' own buffers and the headlamp beam's entry in the light map's list; the
   *  geometries (per colour / style) and the materials are shared caches and stay. */
  _busBody(dt) {
    const g = this.game, net = g.net, Rb = this.R;
    const ob = Rb && Rb.type === 'bus' && net && net.others ? net.others.get(Rb.driver) : null;
    const host = ob && ob.veh === 'bus' && ob.ghost && ob.ghost.children[0] ? ob.ghost : null;
    if (this._intHost !== host) {
      const B = this._bus;
      if (B) {
        this._bus = null;
        try {
          B.rig.group.removeFromParent(); B.int.removeFromParent();
          B.int.dispose(); B.rig.body.dispose();
          if (B.fig) { B.fig.removeFromParent(); B.fig.geometry.dispose(); B.fig = null; }
          const i = BEAMS.indexOf(B.rig.beam); if (i >= 0) BEAMS.splice(i, 1);
        } catch (e) { console.warn('[passenger] bus body', e); }
        B.shell.visible = true;
        this.stats.busBodies = (this.stats.busBodies || 0) - 1;
      }
      this._intHost = host; this._int = null;
      if (host) {
        try {
          const shell = host.children[0], col = Number.isFinite(ob.vcol) ? ob.vcol : TYPES.bus.colors[0];
          const rig = makeLive('bus', col, { driver: true });       // (somebody at the wheel on its glass, as every driven bus seen from the street)
          let st = 'bus'; try { st = styleOf('bus', col) || 'bus'; } catch { st = 'bus'; }
          const int = makeInterior(st === 'bus1' ? 'bus1' : 'bus'); int.userData.setDoors(0);
          rig.group.name = 'remote-bus-body'; rig.group.position.copy(shell.position); rig.group.add(int);
          host.add(rig.group); shell.visible = false;
          this._bus = { rig, int, shell, style: st === 'bus1' ? 'bus1' : 'bus', fig: null, figSeat: -1 }; this._int = int;
          this.stats.busBodies = (this.stats.busBodies || 0) + 1;
        } catch (e) { console.warn('[passenger] bus body', e); this._intHost = null; }
      }
    }
    const B = this._bus; if (!B) return;
    const night = !!(g.time && g.time.isNight);
    B.int.userData.setLights(night); B.rig.setLights(night);
    B.rig.drive(ob.speed || 0, 0, dt, true);
    // inside the hull (the view from the seat) the body is drawn without the box under its floor; from behind, with it
    const cam = g.camera, T = TYPES.bus;
    let inside = !!g.firstPerson;
    if (cam && !inside) {
      const c = this._carrier(Rb.driver, _c2), fx = Math.sin(c.h), fz = Math.cos(c.h), dx = cam.position.x - c.x, dz = cam.position.z - c.z;
      inside = c.ok && Math.abs(dx * fz - dz * fx) < T.W / 2 && Math.abs(dx * fx + dz * fz) < T.L / 2 && cam.position.y - c.y > 0.15 && cam.position.y - c.y < 4.6;
    }
    if (inside !== B.rig.inside) { B.rig.driverIn = !inside; B.rig.setInside(inside); }      // (from within, the driver in the cab is the player themselves)
    // ourselves on the glass at our seat, for the view from behind (the glass is dark from outside: as systems/busride.js)
    if (B.figSeat !== Rb.seat) {
      if (B.fig) { B.fig.removeFromParent(); B.fig.geometry.dispose(); B.fig = null; }
      B.figSeat = Rb.seat;
      try { B.fig = new THREE.Mesh(busRiderFigure(windowOf(B.style, Rb.seat, g.player.look)), MATS.body); B.fig.name = 'bus-rider'; B.fig.castShadow = false; B.rig.group.add(B.fig); } catch { B.fig = null; }
    }
    if (B.fig) B.fig.visible = !inside;
  }

  _keys(c) {
    const g = this.game, inp = g.input, R = this.R;
    if (!this._ctl()) return;
    const hit = (k) => { if (inp.hit(k)) { inp.pressed.delete(k); return true; } return false; };
    if (hit('KeyG') && g.toggleFirstPerson) g.toggleFirstPerson();
    if (hit('KeyF')) { if (R.parked) this.drive(); else this.leave(); }
    else if (R.parked && hit('KeyE')) this.leave();
    void c;
  }

  /** put the local player (body and state) on the seat of the vehicle as it stands now */
  _place(c) {
    const R = this.R, p = this.game.player, seat = R.S.seats[R.seat] || R.S.seats[0];
    seatWorld(c, seat, _s);
    p.pos.set(_s.x, _s.y, _s.z); p.heading = _s.h; p.speed = 0;
    if (p.worldPos) p.worldPos.copy(p.pos);
    R.px = _s.x; R.pz = _s.z;
    try { const grp = p.character.group; grp.position.set(_s.x, _s.y, _s.z); grp.rotation.set(0, _s.h, 0); } catch { /* */ }
    const V = this.veh; V.x = c.x; V.z = c.z; V.heading = c.h; V.speed = c.speed;
  }
  /** core/net.js (and the camera hook, again): another player says they are in a seat of a player's vehicle */
  _placeOther(o) {
    const d = decodeRide(o.ride); if (!d) return false;
    const c = this._carrier(d.driver, _c2); if (!c.ok) return false;
    const S = seatsFor(c.type, c.color); if (!S) return false;
    seatWorld(c, S.seats[d.seat] || S.seats[0], _s);
    const grp = o.character.group;
    grp.position.set(_s.x, _s.y, _s.z); grp.rotation.y = _s.h; grp.rotation.z = 0;
    o.x = _s.x; o.y = _s.y; o.z = _s.z; o.h = _s.h;
    return true;
  }

  // ------------------------------------------------------------ getting out
  /** a free spot to step out onto beside vehicle c from seat `seat`: [x, z] or null. The driver's own rules
   *  (systems/vehicles.js _exitSpot: dry, outside buildings, clear of walls, and in a straight unobstructed line from
   *  the body, so never beyond a fence), tried on the kerb side first. */
  _exitSpot(c, seatI) {
    const V = this._V(), T = TYPES[c.type]; if (!V || !T) return null;
    const col = V.col, fx = Math.sin(c.h), fz = Math.cos(c.h);
    if (T.kind === 'punt') { try { return V._exitSpot({ type: c.type, kind: 'punt', x: c.x, z: c.z, heading: c.h }); } catch { return null; } }
    const S = seatsFor(c.type, c.color), seat = (S && S.seats[seatI]) || [0, 0, 0];
    const hb = Math.max(0, T.L / 2 - T.W / 2);
    const doorZ = c.type === 'bus' ? DOOR.zc : null;
    const parked = (x, z) => { try { return !!V.nearest(x, z, 0.3, (q) => q !== c.v && TYPES[q.type].kind === 'car'); } catch { return false; } };      // (not into the car parked alongside)
    const good = (u, d) => {
      const x = c.x + fx * u + fz * d, z = c.z + fz * u - fx * d;
      const uo = clamp(u, -hb, hb), ox = c.x + fx * uo, oz = c.z + fz * uo;
      if (!V.okSpot(x, z, 0.33) || col.raycast(ox, oz, x, z) !== null) return null;
      if (barrierGap(col, x, z, 0.6) < 0.25 || parked(x, z)) return null;
      return [x, z];
    };
    for (const [u, d] of exitTries(T, seat, doorZ)) { const q = good(u, d); if (q) return q; }
    // none of the usual places (hard against a building line, railings along the kerb, cars parked both sides, a narrow
    // lane): the nearest clear point anywhere round the body within a few metres, by the same rules - dry, outside every
    // building, in a straight unobstructed line from the body - off the carriageway if there is such a point, else on it
    let road = null;
    for (const [u, d] of exitSweep(T, seat, doorZ, 6)) {
      const q = good(u, d); if (!q) continue;
      if (!V.onCarriage(q[0], q[1], 0.3)) return q;
      if (!road) road = q;
    }
    if (road) return road;
    // Still nothing. A friend's vehicle is drawn here from their state and collides with nothing on this machine: a
    // corner cut by the smoothing, or a driver who is themselves through a wall, can leave its middle INSIDE a building's
    // footprint or half through a wall (where no car can stand: its own collision circles are not clear), and every
    // line from the body crosses a wall. Then (and only then: a car truly walled in stays shut) the nearest clear
    // ground to it, pavement before road.
    let inside = false;
    try { inside = V.inBuilding(c.x, c.z) || V.wet(c.x, c.z); for (const u of [-hb, 0, hb]) if (!col.isFree(c.x + fx * u, c.z + fz * u, 0.5)) inside = true; } catch { inside = false; }
    if (inside) {
      const dry = (x, z, r) => V.okSpot(x, z, r) && barrierGap(col, x, z, 0.6) >= 0.25 && bodyDist(c.x, c.z, c.h, T.L, T.W, x, z) > 0.4 && !parked(x, z);
      try {
        const any = V.findSpot(c.x, c.z, 0.33, 12, null, dry); if (!any) return null;
        // (the street it came in from, unless there is pavement about as near: not the quad beyond the building)
        const off = V.onCarriage(any[0], any[1], 0.3) ? V.findSpot(c.x, c.z, 0.33, Math.hypot(any[0] - c.x, any[1] - c.z) + 2, null, (x, z, r) => dry(x, z, r) && !V.onCarriage(x, z, 0.3)) : null;
        return off || any;
      } catch { return null; }
    }
    return null;
  }
  /** the nearest clear pavement to where vehicle c was (the driver is gone): never the road if there is pavement in reach */
  _safeSpot(c) {
    const V = this._V(), p = this.game.player;
    if (!V) return [p.pos.x, p.pos.z];
    if (!c || !c.ok) return V.findSpot(p.pos.x, p.pos.z, 0.33, 12) || [p.pos.x, p.pos.z];
    const T = TYPES[c.type] || { W: 1.8, L: 4 }, col = V.col, fx = Math.sin(c.h), fz = Math.cos(c.h);
    const kx = c.x + fz * (T.W / 2 + 0.8), kz = c.z - fx * (T.W / 2 + 0.8), from = [c.x, c.z];
    // (never inside the body of the car itself - it may still be standing there - nor of one parked alongside)
    const body = (x, z) => { if (bodyDist(c.x, c.z, c.h, T.L, T.W, x, z) < 0.4) return true; try { return !!V.nearest(x, z, 0.3, (q) => TYPES[q.type].kind === 'car'); } catch { return false; } };
    const dry = (x, z, r) => V.okSpot(x, z, r) && barrierGap(col, x, z, 0.6) >= 0.25 && !body(x, z);
    let q = null;
    try {
      q = V.findSpot(kx, kz, 0.33, 9, from, (x, z, r) => dry(x, z, r) && !V.onCarriage(x, z, 0.3))
        || this._exitSpot(c, this.R ? this.R.seat : 0)
        || V.findSpot(kx, kz, 0.33, 9, from, dry) || V.findSpot(kx, kz, 0.33, 14, null, dry) || V.findSpot(kx, kz, 0.33, 14, null, (x, z, r) => V.okSpot(x, z, r) && !body(x, z)) || V.findSpot(kx, kz, 0.33, 14);
    } catch { q = null; }
    return q || [kx, kz];
  }
  _stand(spot, h) {
    const g = this.game, p = g.player;
    p.pos.set(spot[0], g.groundHeight ? g.groundHeight(spot[0], spot[1]) : 0, spot[1]); p.heading = h; p.pose = 'stand'; p.vy = 0; p.onGround = true; p.speed = 0; p.vx = p.vz = 0;
    try { p.character.setPose('stand'); } catch { /* */ }
    if (p.syncMesh) p.syncMesh();
    const V = this._V(); if (V) { V._lpx = p.pos.x; V._lpz = p.pos.z; }
  }
  /** get out (F): only when it has all but stopped, onto a free spot beside it */
  leave(force = false) {
    const R = this.R; if (!R) return false;
    const c = this._carrier(R.driver, _c);
    if (!c.ok) { this._evict(null); return true; }
    if (!force && c.live && c.speed >= LEAVE_MAX) { this._toast('Not while it is moving.', 2); return false; }
    const spot = this._exitSpot(c, R.seat);
    if (!spot) {
      if (!force) { this._toast(R.type === 'punt' ? 'Mid-river: wait until the punt is at the bank.' : 'No room to get out here.', 2.5); return false; }
      this._evict(c); return true;
    }
    const h = Math.atan2(spot[0] - c.x, spot[1] - c.z);
    this._cleanup(true);
    this._stand(spot, h);
    this.stats.left++;
    this.lastExit = { x: spot[0], z: spot[1], evicted: false, car: { x: c.x, z: c.z, h: c.h, type: c.type } };
    try { const a = this.game.audio; if (a && a.ctx && TYPES[c.type].kind === 'car') a.noise(0.16, { gain: 0.2, freq: 210, type: 'lowpass', q: 0.8 }); } catch { /* */ }
    return true;
  }
  /** the vehicle has gone from under us (the driver left the room, went through a door, was whisked away) */
  _evict(c) {
    const spot = this._safeSpot(c), h = c && c.ok ? Math.atan2(spot[0] - c.x, spot[1] - c.z) : this.game.player.heading;
    const name = this.R ? this.R.name : '', T = this.R ? TYPES[this.R.type] : null;
    this._cleanup(true);
    this._stand(spot, h);
    this.stats.evicted++;
    this.lastExit = { x: spot[0], z: spot[1], evicted: true, car: c && c.ok ? { x: c.x, z: c.z, h: c.h, type: c.type } : null };
    this._toast(`${name || 'The driver'} has gone${T ? ', and the ' + T.name + ' with them' : ''}. You are on the pavement.`, 4);
  }
  /** the driver got out and the vehicle stands empty: slide across and drive it (the ordinary way into an empty vehicle) */
  drive() {
    const R = this.R, g = this.game; if (!R) return false;
    const c = this._carrier(R.driver, _c), v = c.ok && !c.live ? c.v : null;
    if (!v) { this._toast('There is somebody at the wheel.', 2); return false; }
    this._cleanup(true);
    let got = null;
    try { got = g.vehicles.enter(v); } catch (e) { console.warn('[passenger] drive', e); got = null; }
    if (!got) {
      // (could not: out onto the kerb instead)
      const spot = this._exitSpot(c, R.seat) || this._safeSpot(c);
      this._stand(spot, Math.atan2(spot[0] - c.x, spot[1] - c.z));
      this.lastExit = { x: spot[0], z: spot[1], evicted: false, car: { x: c.x, z: c.z, h: c.h, type: c.type } };
      return false;
    }
    this.stats.drove++;
    return true;
  }
  _cleanup(mine) {
    const R = this.R, p = this.game.player; if (!R) return;
    this.R = null;
    if (p.vehicle === this.veh) p.vehicle = null;
    p.ride = null;
    if (mine || p.pose === 'sit') { p.pose = 'stand'; try { p.character.setPose('stand'); } catch { /* */ } }
    try { p.character.group.rotation.set(0, p.heading, 0); } catch { /* */ }
    try { this._busBody(0); } catch { /* */ }       // (the friend's bus is a plain ghost again from this frame)
    this._vprompt(null);
  }

  // ------------------------------------------------------------ the camera, and the frame's last word on the seats
  _hookCam() {
    if (this._camHooked) return; this._camHooked = true;
    const g = this.game, self = this, prev = g.cameraHook;
    g.cameraHook = (dt, cam) => {
      let mine = false;
      try { mine = self._late(dt, cam); } catch (e) { if (!self._lateErr) { self._lateErr = true; console.error('[passenger]', e); } }
      return mine ? true : prev ? prev(dt, cam) : false;
    };
  }
  /** after every player has been moved this frame (core/net.js): the seats again, exactly on the vehicles as drawn;
   *  then the view from our own seat when first person is on (G). The follow camera does the view from behind. */
  _late(dt, cam) {
    const g = this.game, net = g.net, R = this.R;
    if (net && net.others) for (const o of net.others.values()) if (o.ride && o.ride[0] < 0 && o.character.group.parent) this._placeOther(o);
    if (!R || g.player.vehicle !== this.veh) return false;
    const c = this._carrier(R.driver, _c);
    if (!c.ok) return false;
    this._place(c);
    const dh = wrap(c.h - R.camH); R.camH = c.h;
    if (!g.firstPerson || !g._fpVehicle || (g.activity && g.activity.camera)) return false;
    // from the seat: the view turns with the car, the mouse looks about (nothing here moves the body)
    const inp = g.input;
    g.cameraYaw += dh;
    if (inp && inp.locked) {
      g.cameraYaw -= inp.mouseDX * 0.0026;
      g.cameraPitch = clamp(g.cameraPitch + inp.mouseDY * 0.0022, -1.2, 1.35);
    }
    g._fpVehicle(dt, this.veh);
    void cam;
    return true;
  }

  state() {
    const R = this.R, p = this.game.player;
    if (!R) return { riding: false, candidate: this.cand ? { ...this.cand } : null, lastExit: this.lastExit };
    const c = this._carrier(R.driver, _c2);
    return { riding: true, driver: R.driver, seat: R.seat, type: R.type, parked: R.parked, live: c.live, speed: c.speed, car: { x: c.x, y: c.y, z: c.z, h: c.h }, world: { x: p.pos.x, y: p.pos.y, z: p.pos.z, h: p.heading }, ride: this.rideA.slice() };
  }
}

export default {
  id: 'passenger',
  install(game) {
    const S = new Passenger(game);
    game.passenger = S.api;
    return S;
  },
};
