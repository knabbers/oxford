// Multiplayer crowd sync: the DOM-free core (unit-tested in Node by tools/smoke_mp_npcs.mjs). systems/crowdsync.js wires
// it to game.net and to the providers (pedestrians, traffic, parked live vehicles).
//
// Model. Every free-roaming actor (ambient walker, AI car / cyclist / bus / taxi, ejected driver, parked live vehicle) has
// exactly ONE owner: the client that simulates it. Owners broadcast compact snapshots of the actors that are within
// SEND_R of another player (one batched message, HZ times a second, nothing when nobody is near); everybody else draws
// them as interpolated "proxies". Ownership moves by CLAIM: a client takes an actor over (its generation `gen` goes up by
// one) and the old owner, seeing a higher generation (or the same one from a lower player id), quietly turns its copy
// into a proxy. Nothing is ever destroyed and re-created during a handover, so nothing pops.
// Who should own what: the lowest-id player within R_AUTH of the actor (with HYST m of hysteresis for a higher-id owner,
// so ownership does not flap at the edge). A stale owner (silent STALE_MS, left the room, or gone indoors) is replaced
// by the lowest-id player still near. Only the would-be owner of a spot spawns new actors there, so two clients never
// fill the same street with two crowds. Interactions (knocking someone down, taking their car, hailing them as a fare)
// claim the actor first, "pinned" so it is not claimed back while the interaction lasts.
//
// Wire format (inside a {t:'e', k:'npc', d} relay event; quantised integers):
//   { t: sender's shared clock (ms), p|c|v: [[id, gen*2 + pinned, x*10, z*10, heading*100, speed*10, ...provider fields], ...],
//     g: [id, gen, ...]  actors that no longer exist (despawned / taken),  s: [id, text, secs*10, ...]  speech }
// Provider fields: see each provider's encode(); a "full" record also carries the static fields (look seed, type,
// colour...) - sent for the first 1.5 s an actor is included and every 2 s after that; a proxy is only created from one.
//
// Provider interface (code 'p' pedestrians, 'c' traffic, 'v' parked live vehicles):
//   each(fn)                    call fn(actor) for every LOCAL actor that may be synced (actor has x, z)
//   syncable(actor)             still eligible right now (e.g. not driven by the local player)
//   encode(actor, full)         -> array of provider fields
//   create(id, rec)             -> proxy handle (has x, z) or null (record not full / no capacity)
//   update(handle, rec)         apply pose / flags (called for every received record)
//   pose(handle, x, z, h, speed, dt)   draw the proxy here this frame
//   destroy(handle)             remove a proxy
//   claim(handle, forced)       -> local actor (may be the same object) or null; it then simulates from that state
//   release(actor)              -> proxy handle (someone else owns it now); must not report removed()
//   kill(actor)                 someone else took/removed it: remove the local actor without reporting removed()
//   say(handle, text, secs)     show a speech bubble
// Actors carry: nid (0 = never sent), ngen, npin (true = pinned), nsent (shared ms last sent), nclaim (shared ms of claim).

export const R_AUTH = 150;          // m: an actor belongs to the lowest-id player this close to it
export const HYST = 30;             // m: a higher-id owner keeps it until the lower-id owner-to-be is this much further in
export const SEND_R = 165;          // m: owners send actors this close to another player (proxies are drawn to ~150 m)
export const HZ = 5;                // snapshots per second (relay budget: ~30 msgs/s per client, burst 60, 16 KB each)
export const STALE_MS = 2500;       // proxy not heard of for this long: its owner is treated as gone
export const DROP_MS = 7000;        // ... and dropped if nobody could claim it by then
export const CLAIM_SEND_MS = 2000;  // a claimed actor is sent whatever the range for this long (so the old owner hears)
export const GONE_MS = 1200;        // a removed actor's id is repeated in `g` for this long
export const FULL_FIRST_MS = 1500;  // static fields with every record for the first 1.5 s an actor is included
const CODES = ['p', 'c', 'v'];
const SNAP = 4;                     // m: a proxy whose target jumps further than this snaps instead of easing

export function newTag(rnd = Math.random) { return 1 + Math.floor(rnd() * 65534); }
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

/** Lowest player id within r of (x,z) among players [{id,x,z}] (skipping skipId); 0 if none. */
export function lowestWithin(x, z, players, r, skipId = 0) {
  const r2 = r * r; let best = 0;
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.id === skipId || (best && q.id >= best)) continue;
    if (d2(q.x, q.z, x, z) <= r2) best = q.id;
  }
  return best;
}

/** Should player myId take over an actor at (ax,az)? owner = {id, x, z} of its current owner in the world, or null when the
 *  owner is gone / indoors / silent. players = every world player including me. Pure: unit-tested. */
export function wantClaim(myId, ax, az, owner, players, pinned = false) {
  if (owner && pinned) return false;
  const low = lowestWithin(ax, az, players, R_AUTH, owner ? 0 : -1);
  if (low !== myId) return false;
  if (!owner) return true;
  if (myId < owner.id) return true;
  return d2(owner.x, owner.z, ax, az) > (R_AUTH + HYST) * (R_AUTH + HYST);
}

export class CrowdSync {
  /** opts: { now(): shared ms, send(msg), myId(): number, tag?, clock?(): local ms, hold?(code, handle, x0, z0, x1, z1): 0..1 } */
  constructor(opts) {
    this.now = opts.now; this.sendFn = opts.send; this.myId = opts.myId;
    this.hold = opts.hold || null;      // (code, handle, x0, z0, x1, z1) -> 0..1: how much of a proxy's run-on past its last snapshot may be drawn (systems/crowdsync.js: not through a wall)
    this.clock = opts.clock || opts.now;
    this.tag = opts.tag || newTag();
    this.ctr = 0;
    this.prov = {};                      // code -> provider
    this.local = new Map();              // id -> {a, code}: local actors that have been given an id
    this.proxies = new Map();            // id -> entry
    this.plist = [];                     // the same entries, for allocation-free iteration
    this.gone = [];                      // [id, gen, until]
    this.says = [];                      // [id, text, secs]
    this.tomb = new Map();               // id -> [gen, until]: recently gone, so a late record does not resurrect it
    this.players = [];                   // world players incl. me: {id, x, z, h, speed, veh, me}
    this.remotes = [];                   // the remote ones only
    this.foci = [];                      // where I spawn: me + remote players whose surroundings I own
    this.active = false;                 // someone else is in the world with me
    this._ppool = [];
    this._sendT = 0; this._claimT = 0; this._tick = 0;
    this.stats = { sent: 0, bytes: 0, maxBytes: 0, recv: 0, claims: 0, releases: 0, proxies: 0, lastBytes: 0 };
  }

  register(code, provider) { this.prov[code] = provider; provider.code = code; }

  /** Rebuild the world player list (call a few times a second). me = {id, x, z, inWorld}; others = [{id, x, z, h, speed, veh, inWorld}] */
  setPlayers(me, others) {
    const P = this.players; let n = 0;
    const slot = () => { let q = this._ppool[n]; if (!q) q = this._ppool[n] = { id: 0, x: 0, z: 0, h: 0, speed: 0, veh: null, me: false }; P[n++] = q; return q; };
    if (me && me.inWorld) { const q = slot(); q.id = me.id; q.x = me.x; q.z = me.z; q.h = me.h || 0; q.speed = me.speed || 0; q.veh = null; q.me = true; }
    for (const o of others) { if (!o.inWorld) continue; const q = slot(); q.id = o.id; q.x = o.x; q.z = o.z; q.h = o.h || 0; q.speed = o.speed || 0; q.veh = o.veh || null; q.me = false; }
    P.length = n;
    const R = this.remotes; R.length = 0;
    for (const q of P) if (!q.me) R.push(q);
    this.active = R.length > 0 || this.plist.length > 0;
    const F = this.foci; F.length = 0;
    const my = this.myId();
    for (const q of P) if (q.me || lowestWithin(q.x, q.z, P, R_AUTH) === my) F.push(q);
  }
  player(id) { for (const q of this.players) if (q.id === id) return q; return null; }
  /** distance to the nearest world player (incl. me); Infinity if none */
  nearestD(x, z) { let b = Infinity; for (const q of this.players) { const d = d2(q.x, q.z, x, z); if (d < b) b = d; } return Math.sqrt(b); }
  /** distance to the nearest REMOTE world player */
  nearestRemoteD(x, z) { let b = Infinity; for (const q of this.remotes) { const d = d2(q.x, q.z, x, z); if (d < b) b = d; } return Math.sqrt(b); }
  /** may I spawn an actor here? (no lower-id player is closer than R_AUTH) */
  spawnOk(x, z) { const low = lowestWithin(x, z, this.players, R_AUTH); return low === 0 || low === this.myId(); }

  newId() { this.ctr = (this.ctr + 1) & 0xffff; if (!this.ctr) this.ctr = 1; return this.tag * 65536 + this.ctr; }
  _ensureId(code, a) {
    if (a.nid && this.local.get(a.nid)?.a === a) return;
    a.nid = this.newId(); a.ngen = a.ngen || 0; a.nsent = 0;
    this.local.set(a.nid, { a, code });
  }

  /** A local actor stopped existing (despawned, handed over to the player): tell the others if they knew of it. */
  removed(a) {
    if (!a || !a.nid) return;
    const L = this.local.get(a.nid);
    if (L && L.a === a) {
      this.local.delete(a.nid);
      // (a claimed actor may be removed before we ever sent it - a car taken straight away: its old owner must still hear)
      if ((a.nsent && this.now() - a.nsent < 3000) || (a.nclaim && this.now() - a.nclaim < 10000)) {
        this.gone.push([a.nid, a.ngen | 0, this.now() + GONE_MS]);
        // tombstone it here too: a record from its previous owner still in flight (sent before they heard of our claim)
        // must not re-create it as a proxy, which we would then claim again under the same id and generation while the
        // others, having heard it is gone, ignore it - an actor only we could see
        this.tomb.set(a.nid, [a.ngen | 0, this.clock() + 6000]);
      }
    }
    a.nid = 0; a.nsent = 0; a.nclaim = 0; a.npin = false;
  }
  /** Something a local actor says, mirrored as a speech bubble on the proxies. */
  said(a, text, secs) { if (this.active && a && a.nid && this.local.get(a.nid)?.a === a && (a.nsent || a.nclaim)) this.says.push(a.nid, String(text).slice(0, 90), Math.round((secs || 3) * 10)); }

  /** Interaction with a proxy: take it over right now (pinned). Returns the local actor or null. */
  claimNow(code, handle, pin = true) {
    for (const e of this.plist) if (e.handle === handle && e.code === code) return this._claim(e, true, pin);
    return null;
  }
  /** Pin / unpin a local actor (pinned actors are not claimed away from a live owner). */
  pin(a, on = true) { if (a) a.npin = !!on; }
  isProxy(code, handle) { for (const e of this.plist) if (e.handle === handle && e.code === code) return true; return false; }

  _claim(e, forced, pin) {
    const P = this.prov[e.code];
    let a = null;
    try { a = P.claim(e.handle, forced); } catch (err) { console.warn('[crowdsync] claim', err); a = null; }
    if (!a) return null;
    this._dropEntry(e);
    a.nid = e.id; a.ngen = e.gen + 1; a.nclaim = this.now(); a.nsent = 0; a.npin = !!pin;
    this.local.set(e.id, { a, code: e.code });
    this.stats.claims++;
    return a;
  }
  _dropEntry(e) {
    this.proxies.delete(e.id);
    const i = this.plist.indexOf(e);
    if (i >= 0) { this.plist[i] = this.plist[this.plist.length - 1]; this.plist.pop(); }
  }
  _destroy(e) { try { this.prov[e.code].destroy(e.handle); } catch (err) { console.warn('[crowdsync] destroy', err); } this._dropEntry(e); }

  /** Drop everything remote (disconnected): proxies become... nothing. (Owned actors stay local.) */
  reset() { for (let i = this.plist.length - 1; i >= 0; i--) this._destroy(this.plist[i]); this.gone.length = 0; this.says.length = 0; this.tomb.clear(); }
  /** Everyone else has gone (the last one left, or we lost the connection): take over every proxy we can (so nothing in
   *  view pops), drop the rest, and forget the bookkeeping. Followers last, as in _claims. */
  adoptAll() {
    for (let pass = 0; pass < 2; pass++) for (let i = this.plist.length - 1; i >= 0; i--) {
      const e = this.plist[i];
      if (!e || (pass === 0) === !!e.handle.nfollow) continue;
      if (!this._claim(e, false, false)) this._destroy(e);
    }
    this.gone.length = 0; this.says.length = 0; this.tomb.clear();
    for (const L of this.local.values()) { L.a.npin = false; L.a.nclaim = 0; }
  }

  // ------------------------------------------------------------------ receiving
  receive(msg, sender) {
    if (!msg || typeof msg !== 'object' || !sender) return;
    this.stats.recv++;
    const t = +msg.t || this.now(), heard = this.clock();
    for (const code of CODES) {
      const arr = msg[code], P = this.prov[code];
      if (!Array.isArray(arr) || !P) continue;
      for (const rec of arr) if (Array.isArray(rec) && rec.length >= 6) this._rec(P, code, rec, sender, t, heard);
    }
    const g = msg.g;
    if (Array.isArray(g)) for (let i = 0; i + 1 < g.length; i += 2) this._gone(g[i], g[i + 1] | 0, sender);
    const s = msg.s;
    if (Array.isArray(s)) for (let i = 0; i + 2 < s.length; i += 3) {
      const e = this.proxies.get(s[i]);
      if (e && e.owner === sender) { try { this.prov[e.code].say(e.handle, String(s[i + 1]).slice(0, 90), (s[i + 2] | 0) / 10); } catch { /* ignore */ } }
    }
  }
  _rec(P, code, rec, sender, t, heard) {
    const id = rec[0], gen = (rec[1] | 0) >> 1, pin = !!((rec[1] | 0) & 1), my = this.myId();
    const L = this.local.get(id);
    if (L) {
      const a = L.a;
      if (gen > (a.ngen | 0) || (gen === (a.ngen | 0) && sender < my)) {
        // somebody else owns it now: our copy becomes their proxy
        let h = null;
        this.local.delete(id); a.nid = 0;
        try { h = this.prov[L.code].release(a); } catch (err) { console.warn('[crowdsync] release', err); }
        this.stats.releases++;
        if (!h) return;
        const e = this._entry(id, L.code, h, sender, gen);
        this._seed(e, h.x, h.z, h.heading ?? h.h ?? 0, t);
        e.sx = h.x; e.sz = h.z; e.sh = h.heading ?? h.h ?? 0;
      } else return;
    }
    let e = this.proxies.get(id);
    if (!e) {
      const tb = this.tomb.get(id);
      if (tb && tb[0] >= gen) return;
      let h = null;
      try { h = P.create(id, rec); } catch (err) { console.warn('[crowdsync] create', err); h = null; }
      if (!h) return;
      e = this._entry(id, code, h, sender, gen);
      const x = rec[2] / 10, z = rec[3] / 10, hd = rec[4] / 100;
      this._seed(e, x, z, hd, t); e.sx = x; e.sz = z; e.sh = hd; e.fresh = true;
    } else if (e.owner !== sender) {
      if (gen < e.gen || (gen === e.gen && sender > e.owner)) return;
      e.owner = sender;
    } else if (gen < e.gen) return;
    e.gen = gen; e.heard = heard; e.pin = pin;
    this._push(e, t, rec[2] / 10, rec[3] / 10, rec[4] / 100, rec[5] / 10);
    try { P.update(e.handle, rec); } catch (err) { console.warn('[crowdsync] update', err); }
  }
  _entry(id, code, handle, owner, gen) {
    const e = { id, code, handle, owner, gen, pin: false, heard: this.clock(), t0: 0, x0: 0, z0: 0, h0: 0, t1: 0, x1: 0, z1: 0, h1: 0, sp: 0, sx: 0, sz: 0, sh: 0, fresh: false };
    this.proxies.set(id, e); this.plist.push(e);
    try { handle.pid = id; } catch { /* a frozen handle */ }      // (a proxy knows its own id: pedestrians._hasKids matches a child's leader id against it)
    return e;
  }
  _seed(e, x, z, h, t) { e.t0 = e.t1 = t; e.x0 = e.x1 = x; e.z0 = e.z1 = z; e.h0 = e.h1 = h; e.sp = 0; }
  _push(e, t, x, z, h, sp) {
    if (t <= e.t1) { if (t === e.t1) { e.x1 = x; e.z1 = z; e.h1 = h; e.sp = sp; } return; }   // late / duplicate
    e.t0 = e.t1; e.x0 = e.x1; e.z0 = e.z1; e.h0 = e.h1;
    e.t1 = t; e.x1 = x; e.z1 = z; e.h1 = h; e.sp = sp;
    if (d2(e.x0, e.z0, x, z) > 30 * 30) { e.t0 = t; e.x0 = x; e.z0 = z; e.h0 = h; }               // teleported
  }
  _gone(id, gen, sender) {
    this.tomb.set(id, [gen, this.clock() + 6000]);
    const e = this.proxies.get(id);
    if (e && gen >= e.gen) { this._destroy(e); return; }
    const L = this.local.get(id);
    if (L && gen > (L.a.ngen | 0)) {
      // someone claimed it and then removed it (took that car, put that fare in their cab)
      this.local.delete(id); L.a.nid = 0;
      try { this.prov[L.code].kill(L.a); } catch (err) { console.warn('[crowdsync] kill', err); }
    }
  }

  // ------------------------------------------------------------------ per frame
  /** Draw the proxies (interpolated / extrapolated to the shared clock), run claims and send snapshots. */
  frame(dt, connected = true) {
    const now = this.now(), clk = this.clock();
    // proxies: between the two newest snapshots, or run on along the last velocity for up to 0.5 s; eased so that a
    // correction is a glide, never a jump (unless it is a big one)
    for (let i = this.plist.length - 1; i >= 0; i--) {
      const e = this.plist[i];
      let x, z, h, vx = 0, vz = 0;
      const span = e.t1 - e.t0;
      if (span > 40 && span < 700) { vx = (e.x1 - e.x0) / span; vz = (e.z1 - e.z0) / span; }
      else { vx = Math.sin(e.h1) * e.sp / 1000; vz = Math.cos(e.h1) * e.sp / 1000; }
      if (now <= e.t1 && span > 0) {
        const a = Math.max(0, (now - e.t0) / span);
        x = e.x0 + (e.x1 - e.x0) * a; z = e.z0 + (e.z1 - e.z0) * a;
        let dh = e.h1 - e.h0; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); h = e.h0 + dh * a;
      } else {
        const ex = Math.min(Math.max(0, now - e.t1), 500);
        x = e.x1 + vx * ex; z = e.z1 + vz * ex; h = e.h1;
        if (this.hold !== null && ex > 0 && (vx !== 0 || vz !== 0)) { const k = this.hold(e.code, e.handle, e.x1, e.z1, x, z); if (k < 1) { x = e.x1 + (x - e.x1) * k; z = e.z1 + (z - e.z1) * k; } }
        if (span > 40 && span < 700) { let dh = e.h1 - e.h0; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); h = e.h1 + dh * Math.min(1, ex / span); }
      }
      if (e.fresh || d2(x, z, e.sx, e.sz) > SNAP * SNAP) { e.sx = x; e.sz = z; e.sh = h; e.fresh = false; }
      else {
        const k = Math.min(1, dt * 12);
        e.sx += (x - e.sx) * k; e.sz += (z - e.sz) * k;
        let dh = h - e.sh; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); e.sh += dh * k;
      }
      const spd = Math.hypot(vx, vz) * 1000;
      try { this.prov[e.code].pose(e.handle, e.sx, e.sz, e.sh, spd > 0.05 ? spd : 0, dt); } catch (err) { console.warn('[crowdsync] pose', err); }
    }
    this.stats.proxies = this.plist.length;
    if (!connected) return;
    if ((this._claimT -= dt) <= 0) { this._claimT = 0.5; this._claims(clk); }
    if ((this._sendT -= dt) <= 0) { this._sendT = 1 / HZ; this._send(now); }
  }

  _claims(clk) {
    const my = this.myId(), me = this.player(my);
    // tombstones expire
    if (this.tomb.size) for (const [id, v] of this.tomb) if (v[1] < clk) this.tomb.delete(id);
    // followers last (so their leaders are already ours when they are claimed)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = this.plist.length - 1; i >= 0; i--) {
        const e = this.plist[i];
        if (!e || (pass === 0) === !!e.handle.nfollow) continue;
        const o = this.player(e.owner), stale = clk - e.heard > STALE_MS;
        const owner = o && !stale ? o : null;
        const far = !me || d2(me.x, me.z, e.sx, e.sz) > (SEND_R + 40) * (SEND_R + 40);
        if (me && wantClaim(my, e.sx, e.sz, owner, this.players, e.pin || !!e.handle.npin)) { if (this._claim(e, false, false)) continue; }
        if ((stale && clk - e.heard > DROP_MS) || (far && clk - e.heard > 1500)) this._destroy(e);
      }
    }
  }

  _send(now) {
    const out = this._out || (this._out = { t: 0 });
    const R = this.remotes, my = this.myId();
    let n = 0;
    // gone ids (repeat for GONE_MS)
    let g = null;
    for (let i = this.gone.length - 1; i >= 0; i--) { const q = this.gone[i]; if (q[2] < now) { this.gone.splice(i, 1); continue; } (g || (g = [])).push(q[0], q[1]); }
    if (!R.length) { this.says.length = 0; this.gone.length = 0; this._tick++; return; }
    const sr2 = SEND_R * SEND_R, tick = this._tick++;
    for (const code of CODES) {
      const P = this.prov[code]; out[code] = undefined;
      if (!P) continue;
      let arr = null;
      P.each((a) => {
        const L = a.nid ? this.local.get(a.nid) : null;
        if (L && L.a === a && !P.syncable(a)) { this.removed(a); return; }       // e.g. the local player got into it
        if (!P.syncable(a)) return;
        if (a.npin && a.nclaim && now - a.nclaim > 20000) a.npin = false;           // an interaction's pin lasts 20 s
        let near = a.nclaim && now - a.nclaim < CLAIM_SEND_MS;
        if (!near) for (let i = 0; i < R.length; i++) if (d2(R[i].x, R[i].z, a.x, a.z) < sr2) { near = true; break; }
        if (!near) return;
        this._ensureId(code, a);
        const full = !a.nsent || now - a.nsent > 3000 || (a.nfirst && now - a.nfirst < FULL_FIRST_MS) || ((tick + a.nid) % 10) === 0;
        if (!a.nsent || now - a.nsent > 3000) a.nfirst = now;
        a.nsent = now;
        const h = a.heading ?? a.h ?? 0, sp = a.speed || 0;
        const rec = [a.nid, (a.ngen | 0) * 2 + (a.npin ? 1 : 0), Math.round(a.x * 10), Math.round(a.z * 10), Math.round(Math.atan2(Math.sin(h), Math.cos(h)) * 100), Math.round(sp * 10)];
        const f = P.encode(a, full);
        for (let i = 0; i < f.length; i++) rec.push(f[i]);
        (arr || (arr = [])).push(rec); n++;
      });
      out[code] = arr || undefined;
    }
    // local actors that vanished without telling us (vehicles provider) are swept here
    for (const [id, L] of this.local) {
      const P = this.prov[L.code];
      if (P && P.alive && !P.alive(L.a)) { this.local.delete(id); L.a.nid = id; this.removed(L.a); }
    }
    const s = this.says.length ? this.says.splice(0) : null;
    if (!n && !g && !s) return;
    out.t = Math.round(now); out.g = g || undefined; out.s = s || undefined;
    const msg = {}; msg.t = out.t;
    for (const code of CODES) if (out[code]) msg[code] = out[code];
    if (g) msg.g = g; if (s) msg.s = s;
    const bytes = JSON.stringify(msg).length;
    if (bytes > 15000) {
      // over the relay's 16 KB frame limit: drop the farthest-from-anyone records until it fits (never happens in practice)
      for (const code of CODES) if (msg[code] && msg[code].length > 40) msg[code].length = 40;
    }
    this.stats.sent++; this.stats.bytes += bytes; this.stats.lastBytes = bytes; if (bytes > this.stats.maxBytes) this.stats.maxBytes = bytes;
    void my;
    this.sendFn(msg);
  }
}
