// Multiplayer client: relays our state ~10 Hz, shows other players, and carries small custom events.
// The socket is behind a tiny transport interface so the same client runs over the Node server's WebSocket relay
// (WsTransport, below) or peer-to-peer rooms (P2PTransport in net_p2p.js). Both speak the protocol documented in
// server/index.js. Transport: open(), send(obj), close(); callbacks onopen(), onmessage(obj), onclose(reason?), onstatus(text).
// Set game.net.transport before connect() to choose one (null = solo, undefined = WebSocket to this page's host).
import { createCharacter } from './characters.js';
import { createActions } from './_mp_actions.js';

// ---- remote-player interpolation (see Net._state / Net.update)
const SNAPS = 6, DELAY = 0.15;
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
function pushSnap(o, t, x, y, z, h) {
  const b = o.buf, i = o.bi * 5;
  b[i] = t; b[i + 1] = x; b[i + 2] = y; b[i + 3] = z; b[i + 4] = h;
  o.bi = (o.bi + 1) % SNAPS; if (o.bn < SNAPS) o.bn++;
}
/** Where remote player o was at time t: writes o.x/y/z/h and o.yaw (turn rate, rad/s). No allocation. */
function sample(o, t) {
  const b = o.buf, n = o.bn;
  o.ext = false;
  if (!n) return;
  // newest first: find the first state at or before t
  let k = (o.bi + SNAPS - 1) % SNAPS, newer = -1;
  for (let c = 0; c < n; c++) {
    const i = k * 5;
    if (b[i] <= t || c === n - 1) {
      if (newer < 0 || b[i] > t) {
        // t is after the newest state (a late packet) or before the oldest: hold that state (run on a little if moving)
        const j = i;
        let e = newer < 0 && n > 1 && o.speed > 0.5 ? Math.min(t - b[j], 0.1) : 0;
        if (e > 0) {
          const q = ((k + SNAPS - 1) % SNAPS) * 5, span = b[j] - b[q];
          if (span > 0.02 && span < 0.3) { e /= span; o.ext = true; o.ex0 = b[j + 1]; o.ez0 = b[j + 3]; o.x = b[j + 1] + (b[j + 1] - b[q + 1]) * e; o.y = b[j + 2]; o.z = b[j + 3] + (b[j + 3] - b[q + 3]) * e; let d = b[j + 4] - b[q + 4]; d = Math.atan2(Math.sin(d), Math.cos(d)); o.h = b[j + 4] + d * e; o.yaw = d / span; return; }
        }
        o.x = b[j + 1]; o.y = b[j + 2]; o.z = b[j + 3]; o.h = b[j + 4]; o.yaw = 0;
        return;
      }
      const span = b[newer] - b[i], a = span > 1e-4 ? (t - b[i]) / span : 1;
      o.x = b[i + 1] + (b[newer + 1] - b[i + 1]) * a; o.y = b[i + 2] + (b[newer + 2] - b[i + 2]) * a; o.z = b[i + 3] + (b[newer + 3] - b[i + 3]) * a;
      let d = b[newer + 4] - b[i + 4]; d = Math.atan2(Math.sin(d), Math.cos(d)); o.h = b[i + 4] + d * a; o.yaw = span > 1e-4 ? d / span : 0;
      return;
    }
    newer = i; k = (k + SNAPS - 1) % SNAPS;
  }
}
/** A state run on past the last packet (sample: a late packet) is never carried through a wall: the player was last
 *  KNOWN on the near side of it (2026-11 pass-through pass: a runner stopping at a wall, a car braking at one, drawn up
 *  to 0.1 s of travel inside it on the other players' screens until the next packet). The run-on is cut where the
 *  straight line from the last known position meets the walls of the place they are in (the world's, or a one-storey
 *  room's; open doorways and archways are open), less the reach of the body ahead of its centre. */
const _RAYP = { passages: true };
function holdRunOn(g, o) {
  let col = null;
  if (o.place === 'world') col = g.worldCollider;
  else { const I = g.interiors, d = I && I.defs ? I.defs.get(o.place) : null; if (d && d.collider && !d.pickCollider) col = d.collider; }
  if (!col || !col.raycast) return;
  if (o.place === 'world' && g.world && g.world.groundHeight && o.y - g.world.groundHeight(o.x, o.z) > 2.5) return;      // (in the air over the roofs: a glider, somebody on a roof)
  const dx = o.x - o.ex0, dz = o.z - o.ez0, L = Math.hypot(dx, dz); if (L < 0.03) return;
  const m = !o.veh ? 0.34 : String(o.veh).startsWith('bike') ? 0.9 : o.veh === 'bus' ? 5.3 : 2.3, R = L + m;
  const t = col.raycast(o.ex0, o.ez0, o.ex0 + (dx / L) * R, o.ez0 + (dz / L) * R, _RAYP);
  if (t === null) return;
  const k = Math.max(0, t * R - m) / L;
  if (k < 1) { o.x = o.ex0 + dx * k; o.z = o.ez0 + dz * k; }
}

export class WsTransport {
  constructor(url) { this.url = url || new URL('ws', document.baseURI).href.replace(/^http/, 'ws'); this.ws = null; }
  open() {
    const ws = (this.ws = new WebSocket(this.url));
    ws.onopen = () => this.onopen && this.onopen();
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (this.onmessage) this.onmessage(m); };
    ws.onclose = () => this.onclose && this.onclose();
    ws.onerror = () => {};
  }
  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  close() { if (this.ws) this.ws.close(); }
}

export class Net {
  constructor(game) {
    this.game = game; this.transport = undefined; this.id = 0; this.connected = false;
    this.others = new Map();     // id -> {id,name,look,x,y,z,h,place,pose,veh,character,ghost,tx,ty,tz,th,speed}
    this.handlers = new Map();   // event kind -> [fn(data, other)]
    this.placers = [];           // fn(other, dt) -> true when it has put that player's character somewhere itself (a bus seat: systems/busride.js)
    this.posers = [];            // fn(other, dt, group): called each frame for every player shown, right after their figure is placed: may adjust how it is DRAWN for a moment (systems/vehicles.js: a tumble shown before their own state says so)
    this._acc = 0;
    this.on('chat', (d, o) => game.ui.chat(o ? o.name : '?', String(d).slice(0, 140)));
    // what each player is holding, carrying, wearing and doing (core/_mp_actions.js): a small record per player, sent when it changes
    this.actions = createActions(game, this);
  }
  /** Show a prop in our hand on everyone else's screen (a PROPS id of core/characters.js: 'pint', 'umbrella', 'cue'...; null = nothing). */
  setCarried(item) { return this.actions.set('held', item || null); }
  /** Say what we are visibly doing (null = nothing): others get [id, start time on the shared clock, params] (handlers: net.actions.activity(id, {...})). */
  setActivity(id, params) { return this.actions.set('act', id ? [id, Math.round(this.game.time.now()), params ?? null] : null); }

  connect(name, look) {
    if (this.transport === null) return;                        // solo
    const tr = (this.transport = this.transport || new WsTransport());
    this._hello = { t: 'hello', name, look };
    tr.onopen = () => tr.send(this._hello);                     // again after a P2P host migration: a fresh welcome follows
    tr.onmessage = (m) => this._msg(m);
    tr.onstatus = (text) => this.game.ui.toast(text, 5);
    tr.onclose = (reason) => {
      if (this.connected || reason) this.game.ui.toast(reason ? `${reason}: playing solo` : 'Disconnected from server: playing solo', reason ? 8 : 3.5);
      this.connected = false;
      for (const o of this.others.values()) this._remove(o);
      this.others.clear();
    };
    tr.open();
  }
  /** P2P room host only: remove a player from the room. */
  kick(id) { return !!(this.transport && this.transport.kick && this.transport.kick(id)); }
  get isHost() { return !!(this.transport && this.transport.isHost); }

  /** Listen for a custom event kind sent by other players. fn(data, otherPlayer). */
  on(kind, fn) { if (!this.handlers.has(kind)) this.handlers.set(kind, []); this.handlers.get(kind).push(fn); }
  /** Broadcast a custom event to everyone else (not echoed back to you). */
  send(kind, data) { if (this.connected) this.transport.send({ t: 'e', k: kind, d: data }); }
  /** The same event to ONE other player (their id in the room); it reaches their on(kind) handlers like a broadcast one.
   *  Used for the voice chat's connection set-up (core/voicechat.js). A relay too old to know {t:'to'} drops it. */
  sendTo(id, kind, data) { if (this.connected && id !== this.id) this.transport.send({ t: 'to', to: id, k: kind, d: data }); }

  _msg(m) {
    if (m.t === 'welcome') {
      const again = this._welcomed; this._welcomed = true;
      for (const o of this.others.values()) this._remove(o);    // a fresh welcome (P2P host migration) rebuilds everyone
      this.others.clear();
      this.id = m.id; this.connected = true; this.game.time.sync(m.now); this._last = null; this._ping = 0;
      for (const p of m.players) { const o = this._add(p); if (p.s) this._state(o, p.s, true); }
      const n = m.players.length;
      this.game.ui.toast(again ? `Back in the room (${n} other${n === 1 ? '' : 's'})` : n ? `${n} other ${n === 1 ? 'person is' : 'people are'} in Oxford` : 'You are the first one here');
    } else if (m.t === 'time') { if (m.c && m.now) this.game.time.sync(m.now + Math.max(0, Date.now() - m.c) / 2); } else if (m.t === 'join') { this._add(m); this.game.ui.toast(`${m.name} matriculated`); }
    else if (m.t === 'leave') { const o = this.others.get(m.id); if (o) { this.game.ui.toast(`${o.name} was rusticated`); this._remove(o); this.others.delete(m.id); } }
    else if (m.t === 's') { const o = this.others.get(m.id); if (o) this._state(o, m.s, !o.seen); }
    else if (m.t === 'e') { const o = this.others.get(m.id); for (const fn of this.handlers.get(m.k) || []) { try { fn(m.d, o); } catch (e) { console.error(e); } } }
  }

  _add(p) {
    const o = { id: p.id, name: p.name, look: p.look, x: 0, y: 0, z: 0, h: 0, tx: 0, ty: 0, tz: 0, th: 0, place: 'nowhere', pose: 'stand', veh: null, speed: 0, seen: false, ghost: null,
      buf: new Float64Array(SNAPS * 5), bn: 0, bi: 0, lastT: -1e9, lean: 0, yaw: 0 };       // the last few states with their arrival times (t, x, y, z, h), see update()
    o.character = createCharacter(p.look && p.look.skin !== undefined ? p.look : undefined);
    o.character.setLabel(p.name); o.character.group.rotation.order = 'YXZ';
    this.others.set(p.id, o);
    return o;
  }
  _remove(o) { if (this.actions) this.actions.drop(o); o.character.group.removeFromParent(); o.character.dispose(); if (o.ghost) o.ghost.removeFromParent(); }

  _state(o, s, snap) {
    // Snapshot interpolation: states arrive ~10 Hz and are kept, time-stamped, in a small ring; update() draws the player
    // where they were DELAY seconds ago, on the straight line between the two states either side of that moment. Even
    // speed and turn rate between packets, instead of the old lunge-and-ease towards each packet as it landed.
    const now = clock();
    const jump = snap || Math.abs(s[0] - o.tx) + Math.abs(s[2] - o.tz) > 30 || s[5] !== o.place;       // first sight / teleport / through a door
    if (jump) o.bn = 0;
    else if (now - o.lastT > 0.25 && o.bn) pushSnap(o, now - 0.11, o.tx, o.ty, o.tz, o.th);      // was standing still (nothing is sent then): they set off just now, not when we last heard
    o.lastT = now;
    o.tx = s[0]; o.ty = s[1]; o.tz = s[2]; o.th = s[3]; o.speed = s[4]; o.place = s[5];
    pushSnap(o, now, o.tx, o.ty, o.tz, o.th);
    if (o.pose !== s[6]) { o.pose = s[6]; o.character.setPose(o.pose); }
    // s[8] (optional, newer clients): vehicle body colour, so a taken bus / cab / car shows in the right colour
    const vc = Number.isFinite(s[8]) ? s[8] : null;
    if (o.veh !== s[7] || o.vcol !== vc) {
      o.veh = s[7]; o.vcol = vc;
      if (o.ghost) { o.ghost.removeFromParent(); o.ghost = null; }
      const make = this.game.vehicles && this.game.vehicles.createMesh;
      if (o.veh && make) { o.ghost = make.call(this.game.vehicles, o.veh, vc ?? undefined); if (o.ghost) o.ghost.rotation.order = 'YXZ'; }
    }
    // s[9] (optional): riding as a passenger, [crowdsync id of the bus, seat index] (systems/busride.js seats them in their own copy of that bus;
    // standing in a bus: [id, -1, x, y, z, heading] in the bus's own frame)
    o.ride = Array.isArray(s[9]) && s[9].length >= 2 ? s[9] : null;
    // s[10] (optional): the revision of their record of things held / worn / being done (core/_mp_actions.js asks them for it when ours is not that one)
    o.arev = Number.isFinite(s[10]) ? s[10] : 0;
    if (jump) { o.x = o.tx; o.y = o.ty; o.z = o.tz; o.h = o.th; o.yaw = 0; o.seen = true; }
  }

  update(dt) {
    const g = this.game, p = g.player, now = clock();
    for (const o of this.others.values()) {
      sample(o, now - DELAY);
      if (o.ext && this.holdRunOn !== false) holdRunOn(g, o);      // (holdRunOn = false: measuring, tools/audit_passthrough.mjs)
      // someone on a bicycle leans into their turns (from the interpolated yaw rate), low-passed
      const bike = typeof o.veh === 'string' && o.veh.startsWith('bike');
      const lt = bike ? Math.max(-0.5, Math.min(0.5, -Math.atan((o.speed * o.yaw) / 9.81))) : 0;
      o.lean += (lt - o.lean) * Math.min(1, dt * 5);
      // Where they are drawn: in the scene of the place they are in, wherever we are — outdoors (seen from the street, or
      // through a walk-in room's windows), or inside a walk-in room that is shown (seen through its windows and doorway
      // from outside, and by whoever is in it). Their coordinates are that place's own, so nothing is converted.
      // An old-style room (its own scene somewhere else): only when we are in it too.
      let sc = null;
      if (o.seen) {
        const I = g.interiors, cur = I && I.current, mine = cur && cur.sl && p.place === cur.id ? cur : null;
        if (o.place === 'world') { if (p.place === 'world' || mine) sc = g.worldScene; }
        else { const d = I && I.get ? I.get(o.place) : null; if (d && d.sl && d.scene && (d === mine || d.sl.shown)) sc = d.scene; else if (o.place === p.place) sc = g.scene; }
      }
      const here = !!sc;
      const grp = o.character.group;
      if (here) {
        if (grp.parent !== sc) sc.add(grp);
        grp.position.set(o.x, o.y, o.z); grp.rotation.y = o.h; grp.rotation.z = o.lean;
        for (let i = 0; this.posers && i < this.posers.length; i++) { try { this.posers[i](o, dt, grp); } catch (e) { /* a poser never breaks the drawing */ } }
        o.character.update(dt, o.speed);
        if (o.ghost) { if (o.ghost.parent !== sc) sc.add(o.ghost); o.ghost.position.set(o.x, o.y, o.z); o.ghost.rotation.y = o.h; o.ghost.rotation.z = o.lean; }
        if (o.ride) for (let i = 0; i < this.placers.length; i++) { try { if (this.placers[i](o, dt)) break; } catch (e) { /* a placer never breaks the others */ } }
      } else { if (grp.parent) grp.removeFromParent(); if (o.ghost && o.ghost.parent) o.ghost.removeFromParent(); }
    }
    if (this.actions) this.actions.update(dt);
    if (!this.connected) return;
    if ((this._ping = (this._ping || 0) + dt) > 60) { this._ping = 0; this.transport.send({ t: 'time', c: Date.now() }); }
    if ((this._acc += dt) < 0.1) return;
    this._acc = 0;
    const r = (v) => Math.round(v * 100) / 100;
    const s = [r(p.pos.x), r(p.pos.y), r(p.pos.z), r(p.heading), r(p.vehicle ? Math.abs(p.vehicle.speed || 0) : p.speed), p.place, p.pose, p.vehicle ? p.vehicle.type : 0];
    if (p.vehicle && Number.isFinite(p.vehicle.color)) s.push(p.vehicle.color);
    if (p.ride) { if (s.length < 9) s.push(0); s.push(p.ride.slice()); }      // a bus passenger's seat, or where they stand in the bus (s[8] = 0: no vehicle colour)
    if (this.actions && this.actions.rev) { while (s.length < 10) s.push(s.length === 8 ? null : 0); s.push(this.actions.rev); }      // (s[8] null: no vehicle colour; s[9] 0: no bus seat)
    const js = JSON.stringify(s);
    if (js !== this._last || (this._idle = (this._idle || 0) + 1) > 20) { this._last = js; this._idle = 0; this.transport.send({ t: 's', s }); }
  }
}
