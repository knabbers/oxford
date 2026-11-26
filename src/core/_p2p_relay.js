// In-page multiplayer relay for peer-to-peer rooms. DOM-free (unit-tested in Node by tools/smoke_p2p.mjs).
// The room host runs one of these; it does exactly what server/index.js does for the WebSocket mode, speaking the same
// JSON text protocol (see the multiplayer section of server/index.js):
//   client -> relay:  {t:'hello', name, look} | {t:'s', s} | {t:'e', k, d} | {t:'to', to, k, d} | {t:'time', c}
//   relay -> client:  {t:'welcome', id, now, host, players:[{id,name,look,s}]} | {t:'join', id, name, look} | {t:'leave', id}
//                     {t:'s', id, s} | {t:'e', id, k, d} | {t:'time', now, c}
//   P2P-only extras:  {t:'p'} heartbeat both ways (ignored by core/net.js; refreshes the sender's liveness here),
//                     {t:'kicked'}, {t:'full'}
// A "conn" is anything with send(string) and close(). Ids are assigned in join order, so every client can work out who
// takes over when the host leaves (successor()).

export const MAX_PLAYERS = 16;
export const MAX_BYTES = 16 * 1024;

export class Relay {
  /** opts: { maxPlayers, now: () => ms, burst, refillPerMs, log(text) } */
  constructor(opts = {}) {
    this.maxPlayers = opts.maxPlayers || MAX_PLAYERS;
    this.now = opts.now || (() => Date.now());
    this.burst = opts.burst || 60;                 // same budget as the server: ~30 msgs/s sustained, burst 60
    this.refill = opts.refillPerMs || 0.03;
    this.log = opts.log || (() => {});
    this.conns = new Map();   // id -> {conn, key, joined, name, look, s, budget, last, seen}
    this.nextId = 1;
    this.hostId = 0;          // player id of the host's own (loopback) client
    this.banned = new Set();  // conn keys kicked this session
    this.closed = false;
  }

  /** Number of joined players. */
  get size() { let n = 0; for (const c of this.conns.values()) if (c.joined) n++; return n; }

  /** A new connection. key: stable id of the remote peer (for kick bans); host: true for the host's own client.
   *  Returns the connection id, or 0 when refused (full / banned). */
  add(conn, { key = '', host = false } = {}) {
    if (this.closed) { safeClose(conn); return 0; }
    if (key && this.banned.has(key)) { safeSend(conn, '{"t":"kicked"}'); safeClose(conn); return 0; }
    if (this.conns.size >= this.maxPlayers) { safeSend(conn, '{"t":"full"}'); safeClose(conn); return 0; }
    const id = this.nextId++;
    const t = this.now();
    this.conns.set(id, { conn, key, joined: false, name: '', look: {}, s: null, budget: this.burst, last: t, seen: t });
    if (host) this.hostId = id;
    return id;
  }

  /** A raw text frame (or already-parsed object) from connection id. */
  receive(id, raw) {
    const c = this.conns.get(id);
    if (!c) return;
    const t = this.now();
    c.seen = t;
    c.budget = Math.min(this.burst, c.budget + (t - c.last) * this.refill); c.last = t;
    if (c.budget < 1) return;   // over budget: drop (without going further into debt, so a burst recovers in ~1 s)
    c.budget--;
    let m = raw;
    if (typeof raw === 'string') {
      if (raw.length > MAX_BYTES) return;
      try { m = JSON.parse(raw); } catch { return; }
    }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello' && !c.joined) {
      c.joined = true;
      c.name = String(m.name || 'Fresher').slice(0, 24);
      c.look = m.look && typeof m.look === 'object' ? m.look : {};
      const players = [];
      for (const [pid, p] of this.conns) if (pid !== id && p.joined) players.push({ id: pid, name: p.name, look: p.look, s: p.s });
      this._send(c, { t: 'welcome', id, now: t, host: this.hostId, players });
      this._broadcast({ t: 'join', id, name: c.name, look: c.look }, id);
      this.log(`+ ${c.name} (#${id})  online: ${this.size}`);
    } else if (!c.joined) {
      return;
    } else if (m.t === 's') {
      c.s = m.s;
      this._broadcast({ t: 's', id, s: m.s }, id);
    } else if (m.t === 'e' && typeof m.k === 'string') {
      this._broadcast({ t: 'e', id, k: m.k.slice(0, 32), d: m.d }, id);
    } else if (m.t === 'to' && typeof m.k === 'string') {
      // an event for one player only (voice chat set-up, core/voicechat.js): arrives as an ordinary event from the sender
      const r = m.to !== id ? this.conns.get(m.to) : null;
      if (r && r.joined) this._send(r, { t: 'e', id, k: m.k.slice(0, 32), d: m.d });
    } else if (m.t === 'time') {
      this._send(c, { t: 'time', now: t, c: m.c });
    }
  }

  /** Connection closed / lost. */
  remove(id) {
    const c = this.conns.get(id);
    if (!c) return;
    this.conns.delete(id);
    if (c.joined) { this._broadcast({ t: 'leave', id }); this.log(`- ${c.name} (#${id})  online: ${this.size}`); }
  }

  /** Host-only moderation: drop a player and refuse its peer for the rest of this room's life. */
  kick(id) {
    const c = this.conns.get(id);
    if (!c || id === this.hostId) return false;
    if (c.key) this.banned.add(c.key);
    this._send(c, { t: 'kicked' });
    this.remove(id);
    safeClose(c.conn);
    return true;
  }

  /** Heartbeat to every remote connection (call every couple of seconds). */
  heartbeat() { for (const [id, c] of this.conns) if (id !== this.hostId) safeSend(c.conn, '{"t":"p"}'); }

  /** Drop connections silent for longer than timeoutMs (closed laptops). Returns the ids dropped. */
  sweep(timeoutMs = 20000) {
    const t = this.now(), gone = [];
    for (const [id, c] of this.conns) if (id !== this.hostId && t - c.seen > timeoutMs) gone.push(id);
    for (const id of gone) { const c = this.conns.get(id); this.log(`swept #${id} (silent ${t - c.seen} ms)`); this.remove(id); safeClose(c.conn); }
    return gone;
  }

  /** Treat every connection as just heard from (call after this tab was stalled or throttled). */
  touch() { const t = this.now(); for (const c of this.conns.values()) c.seen = t; }

  /** Join-ordered player list (what every client can also reconstruct from welcome/join/leave). */
  players() { return [...this.conns].filter(([, c]) => c.joined).map(([id, c]) => ({ id, name: c.name, look: c.look, s: c.s })); }

  closeAll() {
    this.closed = true;
    for (const c of this.conns.values()) safeClose(c.conn);
    this.conns.clear();
  }

  _send(c, obj) { safeSend(c.conn, JSON.stringify(obj)); }
  _broadcast(obj, exceptId) {
    const msg = JSON.stringify(obj);
    for (const [id, c] of this.conns) if (id !== exceptId && c.joined) safeSend(c.conn, msg);
  }
}

/** Who takes over when the host (hostId) leaves: the earliest-joined remaining player = the smallest other id. */
export function successor(hostId, ids) {
  let best = 0;
  for (const id of ids) if (id !== hostId && (best === 0 || id < best)) best = id;
  return best;
}

/** Room codes: 8 characters from a 31-symbol alphabet without look-alikes = 39.6 bits (anyone with it can join). */
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';   // 31 symbols (no i, l, o, 0, 1)
export function makeRoomCode(rand = defaultRandom) {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHA[rand(ALPHA.length)];
  return s;
}
export function normaliseRoomCode(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16); }
export function validRoomCode(s) { return /^[a-z0-9]{6,16}$/.test(s); }

function defaultRandom(n) {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    const a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n;
    do c.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  }
  return Math.floor(Math.random() * n);
}
function safeSend(conn, s) { try { conn.send(s); } catch { /* gone */ } }
function safeClose(conn) { try { conn.close(); } catch { /* gone */ } }
