// Proximity voice chat: the parts with no DOM, no audio and no network in them (unit-tested in Node by
// tools/smoke_voicechat_logic.mjs). core/voicechat.js is the part that touches the microphone, WebRTC and Web Audio.
//
//   VC                  the numbers (ranges, limits, codec settings)
//   fade(d)             the extra gain that takes a voice to nothing by the hearing range
//   Proximity           who we should hold a voice link with: in within CONNECT metres, out after DROP_AFTER seconds
//                       beyond DROP metres, nearest first, at most MAX_LINKS
//   Gate                a noise gate with hysteresis and a hang time (an open mic's hiss is not played)
//   mungeOpus(sdp)      Opus fmtp for speech: mono, DTX, a capped bitrate
//   Link                one pair's signalling: the "perfect negotiation" pattern over an injected RTCPeerConnection
//                       factory and an injected send(); sessions are numbered so that messages for a connection that
//                       has since been closed are recognised and dropped
//   backoff(tries)      seconds to wait before trying a pair again

export const VC = {
  CONNECT: 45,        // m: a link is made with players nearer than this
  DROP: 60,           // m: ... and closed once they have been farther than this for DROP_AFTER seconds
  DROP_AFTER: 4,      // s
  HEAR: 45,           // m: a voice has faded to nothing by here (so a link is always up before it could be heard)
  FULL: 22,           // m: within this only the ordinary fall-off with distance applies
  REF: 4,             // m: full level within this (the spatial node's refDistance)
  ROLL: 1,            // inverse-law roll-off beyond REF: 0.4 at 10 m, 0.2 at 20 m
  MAX_LINKS: 8,       // voice links one player starts (nearest first)
  HARD_LINKS: 10,     // ... and the most it accepts from others
  BITRATE: 28000,     // bit/s, Opus, mono
  CONNECT_MS: 15000,  // a pair that is not connected by then is closed and tried again later
  SHAKY_MS: 8000,     // a connected pair that lost its path and did not find it again
  TRIES: 3,           // attempts before a pair is given up (until the two walk apart and meet again)
  STAGGER_MS: 400,    // between two new links (the signalling shares the game's message budget)
  ORPHAN: 10,         // s: a link whose player has gone from the room list is kept this long (a host migration renumbers everyone)
  ORPHAN_SOLO: 45,    // s: ... and this long while we are not in the room ourselves (the migration is still going on)
  GATE_OPEN: 0.006, GATE_CLOSE: 0.0035, GATE_HANG: 0.4,       // rms; about -44 / -49 dBFS
  TALK_OPEN: 0.012, TALK_CLOSE: 0.007, TALK_HANG: 0.3,        // "is speaking" (mouth, the mark over the head)
  PHONE_ON: 46, PHONE_OFF: 42,   // m: a pair in phone mode is heard as a call beyond PHONE_ON, as a voice in the world again within PHONE_OFF
  PHONE_LEVEL: 0.5,              // the call's fixed level (about a voice 8 m away)
  PHONE_LO: 300, PHONE_HI: 3400, // Hz: the call's telephone band
  MAX_SDP: 12000, MAX_CAND: 24,
};

/** 1 within FULL metres, smoothly to 0 at HEAR. Anything that is not a distance is silence. */
export function fade(d, full = VC.FULL, hear = VC.HEAR) {
  if (!(d >= 0)) return 0;
  if (d <= full) return 1;
  if (d >= hear) return 0;
  const k = 1 - (d - full) / (hear - full);
  return k * k * (3 - 2 * k);
}

/** A pair is in PHONE mode when EITHER of the two has the phone on (so one lost player can call the other; both then
 *  hear each other whatever the distance). */
export const pairPhone = (mine, theirs) => !!(mine || theirs);
/** Is a pair in phone mode heard as a call (true) or as a voice in the world (false)? With hysteresis, so that standing
 *  at the edge does not flip it: a call beyond PHONE_ON metres (or with no distance at all: somewhere off the map),
 *  a voice again within PHONE_OFF. */
export function phoneHeard(was, phone, d) {
  if (!phone) return false;
  if (!(d >= 0) || d === Infinity) return true;
  return was ? d > VC.PHONE_OFF : d > VC.PHONE_ON;
}

export const backoff = (tries) => Math.min(60, 8 * Math.pow(2, Math.max(0, tries - 1)));

export class Proximity {
  constructor(o = {}) {
    this.connect = o.connect ?? VC.CONNECT; this.drop = o.drop ?? VC.DROP; this.after = o.after ?? VC.DROP_AFTER; this.max = o.max ?? VC.MAX_LINKS;
    this.in = new Map();      // key -> seconds spent beyond `drop`
  }
  /** a pair the other side started (and we accepted): held like one of ours */
  add(key) { if (!this.in.has(key)) this.in.set(key, 0); }
  delete(key) { this.in.delete(key); }
  clear() { this.in.clear(); }
  /**
   * cands: [{key, d, hold?, phone?}] — everyone a link could be held with and how far away they are (Infinity: cannot be
   * heard at all, e.g. in a room with no place on the map); hold: keep as it is (their position is not known just now).
   * phone: the pair is in phone mode — in range whatever the distance (still under the cap, nearest first).
   * Someone who is not in cands is out at once. -> the Map of keys to hold links with.
   */
  step(cands, dt) {
    const S = this.in, seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (const c of cands) {
      seen.add(c.key);
      if (!S.has(c.key) || c.hold) continue;
      if (!(c.d <= this.drop) && !c.phone) { const t = S.get(c.key) + dt; if (t >= this.after) S.delete(c.key); else S.set(c.key, t); } else S.set(c.key, 0);
    }
    for (const k of [...S.keys()]) if (!seen.has(k)) S.delete(k);
    if (S.size < this.max) {
      const far = (c) => (c.d >= 0 ? c.d : Infinity);
      const fresh = cands.filter((c) => !c.hold && !S.has(c.key) && (c.d <= this.connect || c.phone)).sort((a, b) => (far(a) === far(b) ? 0 : far(a) - far(b)));
      for (const c of fresh) { if (S.size >= this.max) break; S.set(c.key, 0); }
    }
    return S;
  }
}

export class Gate {
  constructor(open = VC.GATE_OPEN, close = VC.GATE_CLOSE, hang = VC.GATE_HANG) { this.open = open; this.close = close; this.hang = hang; this.isOpen = false; this.t = 0; }
  step(rms, dt) {
    if (rms >= this.open) { this.isOpen = true; this.t = 0; }
    else if (this.isOpen) { if (!(rms >= this.close)) { this.t += dt; if (this.t >= this.hang) this.isOpen = false; } else this.t = 0; }
    return this.isOpen;
  }
}

/** Opus for speech in the given SDP: mono, discontinuous transmission (silence costs next to nothing), a bitrate cap.
 *  Applied to the REMOTE description, which is what tells our encoder how to send. */
export function mungeOpus(sdp, bitrate = VC.BITRATE) {
  if (typeof sdp !== 'string') return sdp;
  const m = /a=rtpmap:(\d+) opus\/48000(?:\/2)?\r?\n/i.exec(sdp);
  if (!m) return sdp;
  const pt = m[1], want = { usedtx: 1, stereo: 0, 'sprop-stereo': 0, maxaveragebitrate: bitrate, useinbandfec: 1 };
  const re = new RegExp('a=fmtp:' + pt + ' ([^\\r\\n]*)');
  const f = re.exec(sdp);
  const kv = new Map();
  if (f) for (const part of f[1].split(';')) { const s = part.trim(); if (!s) continue; const i = s.indexOf('='); kv.set(i < 0 ? s : s.slice(0, i), i < 0 ? null : s.slice(i + 1)); }
  for (const k in want) kv.set(k, String(want[k]));
  const line = 'a=fmtp:' + pt + ' ' + [...kv].map(([k, v]) => (v === null ? k : k + '=' + v)).join(';');
  if (f) return sdp.replace(re, line);
  return sdp.replace(m[0], m[0] + line + (m[0].endsWith('\r\n') ? '\r\n' : '\n'));
}

const plain = (d) => ({ type: d.type, sdp: d.sdp });

/**
 * One pair's signalling. o: { polite, makePC() -> RTCPeerConnection, send(msg), newSid() -> integer > 0,
 *   later(fn, ms) -> handle, cancel(handle), now() -> ms, setup(pc) (the first offerer: add the one audio transceiver),
 *   attach(pc) (the answerer, with the remote offer applied: turn its transceiver to send as well; may be async),
 *   munge(sdp) -> sdp (optional), accept() -> bool (may a connection be opened for an offer that arrives?),
 *   ontrack(event), onstate(state), onclose(why), log(what, error) }
 * Messages (plain objects; the caller adds its addressing): {s, r, sdp:{type, sdp}} | {s, r, c:[candidate, ...]} |
 *   {s, r, bye: why}.  s = the sender's session number, r = the session number of ours it is answering (0: not known yet).
 * state: 'idle' (no connection) | 'connecting' | 'open' | 'shaky' (was open, the path is lost for now); `since` = when it changed.
 * Only the impolite side calls offer() to begin; after that either side may renegotiate and a collision is settled
 * the usual way (the polite side rolls its offer back).
 */
export class Link {
  constructor(o) {
    this.o = o; this.polite = !!o.polite; this.pc = null; this.sid = 0; this.rsid = 0;
    this.making = false; this.ignore = false; this.srdAnswer = false;
    this.state = 'idle'; this.since = o.now ? o.now() : 0; this.q = Promise.resolve(); this._c = []; this._ct = null;
  }
  get live() { return !!this.pc; }
  _set(s) { if (s === this.state) return; this.state = s; this.since = this.o.now ? this.o.now() : 0; if (this.o.onstate) this.o.onstate(s); }
  _tx(m) { m.s = this.sid; m.r = this.rsid; try { this.o.send(m); } catch (e) { /* the room is away */ } }
  _log(what, e) { if (this.o.log) this.o.log(what, e); }

  _open() {
    const pc = (this.pc = this.o.makePC());
    this.sid = this.o.newSid(); this.rsid = 0; this.making = false; this.ignore = false; this.srdAnswer = false;
    this._set('connecting');
    pc.onnegotiationneeded = () => { this._offer(pc); };
    pc.onicecandidate = (e) => {
      if (this.pc !== pc || !e.candidate) return;
      // candidates go a few at a time in one message (each message counts against the game's relay budget)
      this._c.push(e.candidate.toJSON ? e.candidate.toJSON() : e.candidate);
      if (!this._ct) this._ct = this.o.later(() => { this._ct = null; this._flush(); }, 150);
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      const s = pc.connectionState;
      if (s === 'connected') this._set('open');
      else if (s === 'disconnected') { if (this.state === 'open') this._set('shaky'); }
      else if (s === 'failed') this.close('failed', true);
      else if (s === 'closed') this.close('closed');
    };
    pc.ontrack = (e) => { if (this.pc === pc && this.o.ontrack) this.o.ontrack(e); };
    return pc;
  }
  _flush() { if (!this.pc || !this._c.length) return; const c = this._c.splice(0, VC.MAX_CAND); this._tx({ c }); if (this._c.length) this._ct = this.o.later(() => { this._ct = null; this._flush(); }, 150); }
  async _offer(pc) {
    try {
      this.making = true;
      await pc.setLocalDescription();
      if (this.pc !== pc) return;
      this._tx({ sdp: plain(pc.localDescription) });
    } catch (e) { this._log('offer', e); } finally { this.making = false; }
  }

  /** begin (the impolite side) */
  offer() { if (this.pc) return false; const pc = this._open(); try { this.o.setup(pc); } catch (e) { this._log('setup', e); this.close('error'); return false; } return true; }

  /** a message from the other side; handled strictly one after another -> a promise of what was done with it */
  signal(m) { const p = this.q.then(() => this._signal(m)).catch((e) => { this._log('signal', e); return 'error'; }); this.q = p; return p; }
  async _signal(m) {
    if (!m || typeof m !== 'object') return 'bad';
    if (m.bye) {
      if (this.pc && (!m.r || m.r === this.sid) && (!this.rsid || !m.s || m.s === this.rsid)) { this.close('bye'); return 'bye'; }
      return 'stale';
    }
    if (!(m.s > 0)) return 'bad';
    if (this.pc && m.r && m.r !== this.sid) return 'stale';                    // for a connection of ours that is gone
    if (this.pc && this.rsid && m.s !== this.rsid) this.close('restart');      // they closed theirs and began again
    const d = m.sdp;
    if (d && (typeof d.sdp !== 'string' || d.sdp.length > VC.MAX_SDP || (d.type !== 'offer' && d.type !== 'answer'))) return 'bad';
    if (!this.pc) {
      if (!d || d.type !== 'offer') return 'nopc';
      if (this.o.accept && !this.o.accept()) { try { this.o.send({ s: 0, r: m.s, bye: 'no' }); } catch (e) { /* */ } return 'refused'; }
      this._open();
    }
    const pc = this.pc;
    this.rsid = m.s;
    if (d) {
      const ready = !this.making && (pc.signalingState === 'stable' || this.srdAnswer);
      const collision = d.type === 'offer' && !ready;
      this.ignore = !this.polite && collision;
      if (this.ignore) return 'ignored';
      this.srdAnswer = d.type === 'answer';
      try { await pc.setRemoteDescription({ type: d.type, sdp: this.o.munge ? this.o.munge(d.sdp) : d.sdp }); } finally { this.srdAnswer = false; }
      if (this.pc !== pc) return 'closed';
      if (d.type === 'offer') {
        if (this.o.attach) await this.o.attach(pc);
        if (this.pc !== pc) return 'closed';
        await pc.setLocalDescription();
        if (this.pc !== pc) return 'closed';
        this._tx({ sdp: plain(pc.localDescription) });
        return 'answered';
      }
      return 'answer';
    }
    if (Array.isArray(m.c)) {
      for (const c of m.c.slice(0, VC.MAX_CAND)) { try { await pc.addIceCandidate(c); } catch (e) { if (!this.ignore) this._log('candidate', e); } if (this.pc !== pc) return 'closed'; }
      return 'candidates';
    }
    return 'bad';
  }

  /** close our end; tell = let the other side know (so it closes its end now, not when its path times out) */
  close(why = '', tell = false) {
    const pc = this.pc;
    if (!pc) return;
    if (tell) this._tx({ bye: why || 'bye' });
    this.pc = null;
    if (this._ct) { if (this.o.cancel) this.o.cancel(this._ct); this._ct = null; }
    this._c.length = 0;
    pc.onnegotiationneeded = pc.onicecandidate = pc.onconnectionstatechange = pc.ontrack = null;
    try { pc.close(); } catch (e) { /* */ }
    this.sid = 0; this.rsid = 0; this.making = false; this.ignore = false;
    this._set('idle');
    if (this.o.onclose) this.o.onclose(why);
  }
}
