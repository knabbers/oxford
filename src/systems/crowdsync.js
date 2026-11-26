// Multiplayer crowd sync (system id 'crowdsync', sets game.crowdsync). Makes the free-roaming world simulation - ambient
// walkers, ejected drivers, AI cars / taxis / vans / buses / cyclists, parked live vehicles - the SAME for every player
// who can see it: one owner simulates each actor and broadcasts it ('npc' relay events, 5 Hz, batched, only actors near
// another player); the others draw interpolated proxies; ownership moves by claim (see _crowdsync_core.js for the model).
// Providers: pedestrians.js (game.pedestrians._sys.netProvider), traffic.js (game.traffic._sys.netProvider) and the
// parked-live-vehicle provider below. Also: a parked slot promoted by one player is removed for everyone ('slot' events).
// Solo (not connected / nobody else in the world): update() returns straight away; nothing is allocated or sent.
import { CrowdSync } from './_crowdsync_core.js';

export default {
  id: 'crowdsync',
  install(game) {
    const S = new Sys(game);
    game.crowdsync = S.api;
    return { id: 'crowdsync', update: (dt) => S.update(dt) };
  },
};

const RAYP = { passages: true };      // (open doorways, archways and covered roads are open)
class Sys {
  constructor(game) {
    this.game = game;
    this.core = new CrowdSync({
      now: () => (game.time && game.time.now ? game.time.now() : Date.now()),
      clock: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      send: (msg) => { if (game.net && game.net.connected) game.net.send('npc', msg); },
      myId: () => (game.net ? game.net.id : 0),
      // A proxy is drawn run on along its last velocity past its newest snapshot (it is always a little behind the
      // owner). That run-on is never drawn through a wall: the snapshot itself was the owner's simulated position,
      // on the right side of every wall; the straight line on from it is cut where it meets the world's walls, less
      // the body's reach (2026-11 pass-through pass: a walker stopping at a shop front or turning at a corner, a car
      // braking at a wall, were drawn up to 0.5 s of travel into it on the screens of the players who do not own them).
      hold: (code, h, x0, z0, x1, z1) => {
        const col = game.worldCollider; if (!col || !col.raycast) return 1;
        const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.03) return 1;
        const m = code === 'p' ? 0.3 : h && h.kind === 'bike' ? 0.5 : 1.0, R = L + m;
        const t = col.raycast(x0, z0, x0 + (dx / L) * R, z0 + (dz / L) * R, RAYP);
        return t === null ? 1 : Math.max(0, t * R - m) / L;
      },
    });
    this._plT = 0; this._others = []; this._oPool = []; this._was = false; this._hooked = false;
    this.takenSlots = [];          // slot keys this client promoted (re-sent when someone joins)
    const self = this;
    this.api = {
      core: this.core,
      /** an MP session with someone else in the world (providers use this to switch on multi-player rules) */
      get active() { return self.core.active && !!(game.net && game.net.connected); },
      get stats() { return self.core.stats; },
      claimNow: (code, h, pin) => self.core.claimNow(code, h, pin),
    };
  }

  _hook() {
    const g = this.game, net = g.net;
    if (this._hooked || !net || !net.on) return;
    this._hooked = true;
    net.on('npc', (d, o) => { if (o) this.core.receive(d, o.id); });
    net.on('slot', (d) => this._slotGone(d));
    // someone new: tell them which parked slots are gone
    const join0 = net._add && net._add.bind(net);
    if (join0) net._add = (p) => { const o = join0(p); if (this.takenSlots.length) setTimeout(() => { try { net.send('slot', { k: this.takenSlots.slice(-120) }); } catch { /* */ } }, 1500); return o; };
    // a parked slot promoted to a live vehicle (the player got in): everyone else removes it too
    const V = g.vehicles && g.vehicles._sys;
    if (V && V.promote && !V._csPromote) {
      const p0 = V.promote.bind(V); V._csPromote = true;
      V.promote = (s) => {
        if (s && s.static && !s._remoteGone) { const k = slotKey(s); this.takenSlots.push(k); if (this.takenSlots.length > 400) this.takenSlots.splice(0, 100); if (net.connected) net.send('slot', { k: [k] }); }
        return p0(s);
      };
    }
    // getting into a vehicle somebody else owns: claim it first (then it is ours, and driven, so it leaves the sync)
    if (g.vehicles && g.vehicles.on) g.vehicles.on('enter', ({ v }) => { if (v && v.remote) this.core.claimNow('v', v, true); });
  }
  _slotGone(d) {
    const V = this.game.vehicles && this.game.vehicles._sys;
    if (!V || !d || !Array.isArray(d.k)) return;
    for (const k of d.k) {
      const [type, xs, zs] = String(k).split('|'), x = +xs / 10, z = +zs / 10, pool = V.pools && V.pools.get(type);
      if (!pool || !Number.isFinite(x)) continue;
      let hit = null;
      pool.grid.each(x, z, 1.5, (s) => { if (!hit && !s.taken && slotKey(s) === k) hit = s; });
      if (hit) { hit._remoteGone = true; try { V.remove(hit); } catch { /* */ } }
    }
  }

  _providers() {
    const g = this.game, C = this.core;
    if (!C.prov.p && g.pedestrians && g.pedestrians._sys && g.pedestrians._sys.netProvider) C.register('p', g.pedestrians._sys.netProvider);
    if (!C.prov.c && g.traffic && g.traffic._sys && g.traffic._sys.netProvider) C.register('c', g.traffic._sys.netProvider);
    if (!C.prov.v && g.vehicles && g.vehicles._sys) C.register('v', vehicleProvider(g));
  }

  update(dt) {
    const g = this.game, net = g.net;
    if (!net || !net.connected || !net.others.size) {
      // alone again (the others left / we were disconnected): what we were shown of theirs becomes ours, seamlessly
      if (this._was) { this._was = false; this.core.adoptAll(); this.core.players.length = 0; this.core.remotes.length = 0; this.core.foci.length = 0; this.core.active = false; }
      return;
    }
    this._hook();
    this._providers();
    this._was = true;
    if ((this._plT -= dt) <= 0) {
      this._plT = 0.25;
      const p = g.player, O = this._others; let n = 0;
      for (const o of net.others.values()) {
        let q = this._oPool[n]; if (!q) q = this._oPool[n] = { id: 0, x: 0, z: 0, h: 0, speed: 0, veh: null, inWorld: false };
        q.id = o.id; q.x = o.tx; q.z = o.tz; q.h = o.th; q.speed = o.speed || 0; q.veh = o.veh || null; q.inWorld = o.seen && o.place === 'world';
        O[n++] = q;
      }
      O.length = n;
      const me = this._me || (this._me = { id: 0, x: 0, z: 0, h: 0, speed: 0, inWorld: false });
      me.id = net.id; me.x = p.pos.x; me.z = p.pos.z; me.h = p.heading; me.speed = p.speed || 0; me.inWorld = p.place === 'world';
      this.core.setPlayers(me, O);
    }
    this.core.frame(dt, true);
  }
}

const slotKey = (s) => `${s.type}|${Math.round(s.x * 10)}|${Math.round(s.z * 10)}`;

// ---------------------------------------------------------------- parked live vehicles (cars, bikes, punts left by players)
// A proxy is a real live vehicle flagged v.remote (so it can be bumped into and entered like any other); claiming it just
// clears the flag. Vehicles being driven (by anyone) are not in the sync: the driver's player state shows them.
const VTYPES = ['bike_roadster', 'bike_road', 'bike_mtb', 'car_hatch', 'car_saloon', 'taxi', 'van', 'bus', 'punt'];
function vehicleProvider(game) {
  const V = () => game.vehicles;
  return {
    each(fn) { const L = V().list; for (let i = 0; i < L.length; i++) { const v = L[i]; if (!v.remote) fn(v); } },
    syncable(v) { const VV = V(); return !v.remote && !v.driver && v !== VV.current && !v.policeUnit && v.livery !== 'police' && VV.list.includes(v); },
    alive(v) { return V().list.includes(v) && !v.driver; },
    encode(v, full) { return full ? [VTYPES.indexOf(v.type), v.color | 0] : []; },
    create(id, r) {
      if (r.length < 8) return null;
      const type = VTYPES[r[6]]; if (!type) return null;
      const v = V().spawn(type, r[2] / 10, r[3] / 10, r[4] / 100, { color: r[7] });
      v.remote = true; v.parked = true;
      return v;
    },
    update() {},
    pose(v, x, z, h) {
      if (Math.abs(v.x - x) + Math.abs(v.z - z) < 0.02 && Math.abs(v.heading - h) < 0.005) return;
      v.x = x; v.z = z; v.heading = h; v.speed = 0; v.vx = v.vz = 0;
      try { const S = V()._sys; if (S._ground && v.kind !== 'punt') S._ground(v, 0); if (S._pose) S._pose(v); } catch { /* */ }
    },
    destroy(v) { try { V().remove(v); } catch { /* */ } },
    claim(v) { v.remote = false; v.lastUse = 0; return v; },
    release(v) { v.remote = true; return v; },
    kill(v) { try { V().remove(v); } catch { /* */ } },
    say() {},
  };
}
