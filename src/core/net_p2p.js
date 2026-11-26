// Peer-to-peer transport for core/net.js: lets the game run as static files (GitHub Pages) with no server of ours.
// Star topology over WebRTC data channels brokered by PeerJS (its free public broker, 0.peerjs.com, unless the URL has
// ?broker=host:port, e.g. a local `npx peer --port 9000`). One browser is the ROOM HOST: it claims the PeerJS id
// `gto-<code>` and runs the in-page relay (core/_p2p_relay.js), which speaks exactly the server's JSON protocol. The host's
// own client talks to that relay through a loopback, so everything above the transport is identical in both modes.
// Guests open one reliable, ordered data channel to the host.
// Host migration: every client knows the join order (ids are assigned in order); when the host goes away the
// earliest-joined remaining guest re-claims `gto-<code>` (retrying while the broker releases the old id) and starts a
// fresh relay; the others keep retrying the code for ~30 s, then give up with "Room closed — the host left".
// No TURN server: players behind strict NATs / corporate firewalls may be unable to connect at all.
//
// Transport interface (shared with WsTransport in core/net.js):
//   open(), send(obj), close(), and callbacks onopen(), onmessage(obj), onclose(reason?), onstatus(text)
import { Relay, successor } from './_p2p_relay.js';

export const PEER_PREFIX = 'gto-';
export const ICE_SERVERS = [      // (also used by core/voicechat.js for the voice links)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
const CONNECT_MS = 15000;      // first connection (host: claim the id; guest: open a channel to the host)
const MIGRATE_HOST_MS = 20000; // new host retrying to claim the room id
const MIGRATE_JOIN_MS = 30000; // guests retrying to reach the new host
const SILENCE_MS = 15000;      // guest: no frame from the host for this long = host gone
const MSG_NO_P2P = 'Couldn\'t connect directly — your network may block peer-to-peer';
const MSG_CLOSED = 'Room closed — the host left';

let peerLoad = null;
/** Lazily inject the vendored PeerJS bundle (UMD, sets window.Peer). */
export function loadPeerJS() {
  if (typeof window !== 'undefined' && window.Peer) return Promise.resolve(window.Peer);
  if (peerLoad) return peerLoad;
  peerLoad = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL('vendor/peerjs/peerjs.min.js', document.baseURI).href;
    s.onload = () => (window.Peer ? resolve(window.Peer) : reject(new Error('PeerJS did not load')));
    s.onerror = () => { peerLoad = null; reject(new Error('PeerJS could not be fetched')); };
    document.head.appendChild(s);
  });
  return peerLoad;
}

/** PeerJS options: public cloud broker by default, ?broker=host[:port][/path] for a local peerjs-server. */
export function peerOptions() {
  const o = { config: { iceServers: ICE_SERVERS }, debug: 0 };
  const b = new URLSearchParams(location.search).get('broker');
  if (b) {
    const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/.exec(b);
    if (m) {
      o.host = m[2]; o.port = +(m[3] || (m[1] === 'https' ? 443 : 80)); o.path = m[4] || '/';
      o.secure = m[1] ? m[1] === 'https' : !/^(localhost|127\.|192\.168\.|10\.)/.test(m[2]) && o.port === 443;
    }
  }
  return o;
}

export class P2PTransport {
  /** opts: { code, host: true to create the room } */
  constructor({ code, host = false }) {
    this.code = code;
    this.isHost = false;           // true once this browser runs the relay
    this.wantHost = host;
    this.state = 'idle';           // idle | connecting | open | migrating | closed
    this.peer = null; this.conn = null; this.relay = null; this.localId = 0;
    this.myId = 0; this.hostPlayerId = 0; this.ids = new Set();   // join-ordered knowledge for migration
    this.migrations = 0;
    this._timers = new Set();
    this.onopen = null; this.onmessage = null; this.onclose = null; this.onstatus = null;
    this._unload = () => this.close();
  }

  get peerId() { return PEER_PREFIX + this.code; }

  open() {
    this.state = 'connecting';
    addEventListener('pagehide', this._unload);
    loadPeerJS().then(() => {
      if (this.state === 'closed') return;
      if (this.wantHost) this._host(false); else this._join(false);
    }, () => this._fail('Couldn\'t load the peer-to-peer library'));
  }

  send(obj) {
    if (this.state !== 'open') return;
    const s = JSON.stringify(obj);
    if (this.isHost) { if (this.relay) this.relay.receive(this.localId, s); }
    else if (this.conn && this.conn.open) { try { this.conn.send(s); } catch { /* channel closing */ } }
  }

  /** Host only: remove a player (and refuse them for the rest of this room). */
  kick(id) { return !!(this.isHost && this.relay && this.relay.kick(id)); }

  close() { this._stop(); }

  // ---------------------------------------------------------------- host
  _host(migrating, until = 0) {
    const Peer = window.Peer, deadline = until || Date.now() + (migrating ? MIGRATE_HOST_MS : CONNECT_MS);
    let delay = 600;
    this._jctx = null;
    const attempt = () => {
      if (this.state === 'closed') return;
      const peer = (this.peer = new Peer(this.peerId, peerOptions()));
      let opened = false;
      const giveUp = this._later(() => { if (!opened && this.peer === peer) this._fail(migrating ? MSG_CLOSED : 'Couldn\'t reach the peer-to-peer matchmaking service'); }, deadline - Date.now());
      peer.on('open', () => {
        if (this.peer !== peer) return;
        opened = true; this._clear(giveUp);
        this._startRelay();
      });
      peer.on('connection', (conn) => this._accept(conn));
      peer.on('disconnected', () => {   // lost the broker socket: existing channels keep working; re-register the id
        if (this.peer === peer && this.state !== 'closed' && opened) this._later(() => { try { if (peer.disconnected && !peer.destroyed) peer.reconnect(); } catch { /* */ } }, 2000);
      });
      peer.on('error', (err) => {
        if (this.peer !== peer || this.state === 'closed') return;
        const t = err && err.type;
        if (opened) return;                                      // e.g. peer-unavailable chatter; the room keeps running
        if (t === 'unavailable-id' && !migrating) { this._clear(giveUp); this._fail('That room code is already in use — host again for a new code'); return; }
        this._clear(giveUp);
        try { peer.destroy(); } catch { /* */ }
        if (Date.now() + delay > deadline) { this._fail(migrating ? MSG_CLOSED : 'Couldn\'t reach the peer-to-peer matchmaking service'); return; }
        if (t === 'unavailable-id') {
          // migrating and someone holds the room id: the broker hasn't released the old host yet, the old host is in fact
          // still there (we only thought it had gone), or another guest took over. Try joining it; if nobody answers,
          // _newGuestPeer comes back here to claim the id again.
          this.peer = null;
          this._later(() => this._join(true, { successor: true, deadline }), 300);
          return;
        }
        this._later(attempt, delay); delay = Math.min(delay * 1.6, 4000);
      });
    };
    attempt();
  }

  _startRelay() {
    this.isHost = true; this.conn = null;
    this.relay = new Relay({ log: (t) => console.info('[p2p]', t) });
    const local = { send: (s) => queueMicrotask(() => this._deliver(s)), close: () => {} };
    this.localId = this.relay.add(local, { host: true });
    let last = Date.now();
    this._every(() => {
      const n = Date.now();
      if (!this.relay) return;
      if (n - last > 5000) this.relay.touch();     // this tab was stalled / throttled: don't blame the guests
      last = n;
      this.relay.heartbeat(); this.relay.sweep(20000);
    }, 2000);
    this.state = 'open';
    if (this.onopen) this.onopen();
  }

  _accept(conn) {
    if (!this.relay) { try { conn.close(); } catch { /* */ } return; }
    let id = 0;
    const ready = () => {
      if (id || !this.relay) return;
      id = this.relay.add({ send: (s) => { if (conn.open) conn.send(s); }, close: () => this._later(() => conn.close(), 200) }, { key: conn.peer });
    };
    if (conn.open) ready(); else conn.on('open', ready);
    conn.on('data', (d) => { if (id && this.relay) this.relay.receive(id, typeof d === 'string' ? d : String(d)); });
    const gone = (why) => { if (id && this.relay) { console.info('[p2p] guest', id, 'gone:', why); this.relay.remove(id); } id = 0; };
    conn.on('close', () => gone('channel closed'));
    conn.on('error', () => {});
    this._watchIce(conn, (st) => { gone('ICE ' + st); try { conn.close(); } catch { /* */ } });
  }

  // ---------------------------------------------------------------- guest
  _join(migrating, { successor = false, deadline: until = 0 } = {}) {
    const deadline = until || Date.now() + (migrating ? MIGRATE_JOIN_MS : CONNECT_MS);
    const ctx = (this._jctx = { migrating, successor, deadline, notFound: 0, brokerOk: !!(this.peer && this.peer.open), retry: null, giveUp: null });
    ctx.fail = () => this._fail(migrating ? MSG_CLOSED : ctx.notFound ? 'No room is open with that code (the host may have left)' : ctx.brokerOk ? MSG_NO_P2P : 'Couldn\'t reach the peer-to-peer matchmaking service');
    ctx.giveUp = this._later(() => { if (this._jctx === ctx && this.state !== 'open') ctx.fail(); }, deadline - Date.now());
    if (!this._watchdog) {
      let last = Date.now();
      this._watchdog = this._every(() => {
        const n = Date.now();
        if (n - last > 3000) this._rx = Math.max(this._rx || 0, n);   // we were stalled: queued frames may not be read yet
        last = n;
        if (this.state !== 'open' || this.isHost) return;
        if (n - this._rx > SILENCE_MS) { this._hostLost('silent for ' + (n - this._rx) + ' ms'); return; }
        // heartbeat to the host from a timer: player state only goes out from the render loop, which a slow or
        // background tab may run rarely, and the host drops anyone silent for 20 s
        if ((this._hbTick = (this._hbTick || 0) + 1) % 2 === 0 && this.conn && this.conn.open) { try { this.conn.send('{"t":"p"}'); } catch { /* */ } }
      }, 1000);
    }
    this._attempt();
  }

  _attempt() {
    const ctx = this._jctx;
    if (!ctx || this.state === 'closed' || this.state === 'open' || this.isHost) return;
    const peer = this.peer;
    if (!peer || peer.destroyed) { this._newGuestPeer(); return; }
    if (!peer.open) {                      // broker registration pending or lost
      if (peer.disconnected) { try { peer.reconnect(); } catch { /* */ } }
      this._later(() => this._attempt(), 1500); return;
    }
    const conn = peer.connect(this.peerId, { reliable: true, serialization: 'raw' });
    if (ctx.retry) this._clear(ctx.retry);
    ctx.retry = this._later(() => { if (this.conn !== conn) { try { conn.close(); } catch { /* */ } this._attempt(); } }, 6000);
    conn.on('open', () => {
      if (this.state === 'closed' || this.state === 'open' || this.isHost) { try { conn.close(); } catch { /* */ } return; }
      this._clear(ctx.retry); this._clear(ctx.giveUp);
      this.conn = conn; this.state = 'open'; this._rx = Date.now();
      if (this.onopen) this.onopen();
    });
    conn.on('data', (d) => { if (this.conn === conn) { this._rx = Date.now(); this._deliver(typeof d === 'string' ? d : String(d)); } });
    conn.on('close', () => { if (this.conn === conn) this._hostLost('channel closed'); });
    conn.on('error', () => {});
    this._watchIce(conn, (st) => { if (this.conn === conn) this._hostLost('ICE ' + st); });
  }

  _newGuestPeer() {
    const peer = (this.peer = new window.Peer(peerOptions()));
    peer.on('open', () => { if (this.peer === peer && this._jctx) { this._jctx.brokerOk = true; this._attempt(); } });
    peer.on('error', (err) => {
      const ctx = this._jctx;
      if (this.peer !== peer || this.state === 'closed' || this.isHost || !ctx) return;
      const t = err && err.type;
      if (t === 'peer-unavailable') {           // nobody holds gto-<code> (yet)
        ctx.notFound++;
        if (this.state === 'open') return;
        if (ctx.retry) { this._clear(ctx.retry); ctx.retry = null; }
        if (!ctx.migrating && ctx.notFound >= 3) { this._clear(ctx.giveUp); ctx.fail(); return; }
        if (ctx.successor) {                    // nobody holds the room id now: claim it (again)
          this._clear(ctx.giveUp); this._jctx = null;
          try { peer.destroy(); } catch { /* */ }
          this.peer = null;
          if (Date.now() > ctx.deadline) { this._fail(MSG_CLOSED); return; }
          this._later(() => this._host(true, ctx.deadline), 500);
          return;
        }
        this._later(() => this._attempt(), 1500);
      } else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') {
        if (this.state !== 'open') this._later(() => { if (this.peer === peer) { try { peer.destroy(); } catch { /* */ } this.peer = null; this._attempt(); } }, 2000);
      }
    });
  }

  _hostLost(why = '') {
    if (this.state !== 'open' || this.isHost) return;
    console.info('[p2p] lost the host:', why);
    const old = this.conn; this.conn = null;
    try { old && old.close(); } catch { /* */ }
    this.state = 'migrating'; this.migrations++;
    const next = successor(this.hostPlayerId, this.ids);
    if (this.onstatus) this.onstatus('The host left — moving the room…');
    if (next && next === this.myId) {
      try { this.peer && this.peer.destroy(); } catch { /* */ }
      this.peer = null;
      this._host(true);
    } else this._join(true);
  }

  // ---------------------------------------------------------------- shared
  /** Track join order from the protocol stream (for migration), handle P2P-only control messages, pass the rest on. */
  _deliver(s) {
    if (this.state === 'closed') return;
    let m; try { m = JSON.parse(s); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'welcome') {
      this.myId = m.id; this.hostPlayerId = m.host || 0;
      this.ids = new Set([m.id, ...(m.players || []).map((p) => p.id)]);
    } else if (m.t === 'join') this.ids.add(m.id);
    else if (m.t === 'leave') this.ids.delete(m.id);
    else if (m.t === 'kicked') { this._fail('The host removed you from the room'); return; }
    else if (m.t === 'full') { this._fail('That room is full'); return; }
    else if (m.t === 'p') return;
    if (this.onmessage) this.onmessage(m);
  }

  _watchIce(conn, lost, tries = 0) {
    const pc = conn.peerConnection;
    if (!pc || !pc.addEventListener) { if (tries < 40) this._later(() => this._watchIce(conn, lost, tries + 1), 500); return; }
    let t = null;
    pc.addEventListener('iceconnectionstatechange', () => {
      const st = pc.iceConnectionState;
      if (st === 'failed' || st === 'closed') lost(st);
      else if (st === 'disconnected') { if (!t) t = this._later(() => { t = null; if (pc.iceConnectionState === 'disconnected') lost(st); }, 7000); }
      else if (t) { this._clear(t); t = null; }
    });
  }

  _fail(reason) { const was = this.state; this._stop(); if (was !== 'closed' && this.onclose) this.onclose(reason); }
  _stop() {
    this.state = 'closed';
    removeEventListener('pagehide', this._unload);
    for (const t of this._timers) { clearTimeout(t); clearInterval(t); }
    this._timers.clear(); this._watchdog = null;
    if (this.relay) { this.relay.closeAll(); this.relay = null; }
    try { this.conn && this.conn.close(); } catch { /* */ }
    try { this.peer && this.peer.destroy(); } catch { /* */ }
    this.conn = null; this.peer = null; this.isHost = false;
  }
  _later(fn, ms) { const t = setTimeout(() => { this._timers.delete(t); fn(); }, Math.max(0, ms)); this._timers.add(t); return t; }
  _every(fn, ms) { const t = setInterval(fn, ms); this._timers.add(t); return t; }
  _clear(t) { if (t) { clearTimeout(t); clearInterval(t); this._timers.delete(t); } }
}
