// Proximity voice chat: the players' own microphones, heard from their avatars' heads.
//
// OFF until the player presses Y. The first press is when the browser asks for the microphone (its prompt is the
// consent; nothing here asks before that or remembers an answer for it). From then the mic is open until Y is pressed
// again (or "mute my mic" in the Tab list: the microphone is released, the others are still heard). Without a
// microphone, or with the permission refused, the others are still heard.
//
// What goes where: microphone sound goes ONLY to the other players in the same room who also have voice chat on and
// are within hearing range, straight from browser to browser (WebRTC media: Opus over SRTP / UDP, encrypted end to
// end between the two browsers; the browser's own jitter buffer, loss concealment and echo canceller). It does not
// pass through the room host, the game server or the PeerJS broker, and it is never recorded or stored. The STUN
// servers (the same ones core/net_p2p.js uses) see addresses only. There is no TURN relay: a pair of players whose
// networks will not let them reach each other directly do not hear each other (one quiet message; the game carries on).
//
// Topology: a small mesh. Each pair of players in range holds one RTCPeerConnection with one audio transceiver each
// way; the game's data still goes through the room as before (nothing here touches the data channel). The offer /
// answer / ICE exchange travels as ordinary game messages addressed to one player (net.sendTo -> {t:'to'} -> relayed
// as an event of kind 'rtc'), so it works the same over the WebSocket server and over a peer-to-peer room. Presence
// ("I have voice chat on", with a random id for this page load that survives a host migration's renumbering) is the
// broadcast event 'vc'. Who links with whom, the ranges, the retry rules and the negotiation are in _vc_logic.js.
//
// Sound: remote MediaStream -> MediaStreamAudioSourceNode -> gain (noise gate, per-player mute, fade to nothing by
// the hearing range) -> game.audio.spatial(the avatar's head, { cls: 'voice', occlusion: true, keep: true }) -> master.
// So direction (HRTF on headphones, equal-power on speakers: the K key), the fall-off with distance, the muffling when
// the speaker is in another place than the listener (through a wall) and the send into the listener's room
// reverberation are all the central mechanism's; nothing of that is done here. A level meter on the received stream
// opens the speaker's mouth (character.mouth) and shows a small mark over their head.
//
// PHONE (the . key): "hear each other at any distance", for when friends have lost each other. A pair is in phone
// mode when EITHER of the two has it on (it travels in the 'vc' presence event); such a pair is linked whatever the
// distance (still at most MAX_LINKS, nearest first). Within hearing range nothing changes. Beyond it (past 46 m, back
// under 42 m: hysteresis) the voice is heard as a call instead: not positioned, the same in both ears, a fixed level,
// through a telephone band-pass (300 Hz - 3.4 kHz), cross-faded over about half a second; into the same volume bus
// (audio.chatBus, "Friends' microphones") as the positioned voice. Not saved between visits; off whenever voice chat is.
//
// game.voicechat: phone, togglePhone(on?), setVolume(v),  on, toggle(on?), muteSelf(on?), mutePlayer(netId, on?), isMuted(netId), has(netId), info(), probe(netId)
import * as THREE from 'three';
import { VC, fade, backoff, Proximity, Gate, Link, mungeOpus, pairPhone, phoneHeard } from './_vc_logic.js';
import { ICE_SERVERS } from './net_p2p.js';

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const rmsOf = (b) => { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); };

export class VoiceChat {
  constructor(game) {
    this.game = game;
    this.on = false; this.micMuted = false; this.micState = 'off';       // off | asking | live | none
    this.phone = false; this.vol = 1;
    this.stream = null; this.track = null; this.level = 0; this._mic = null;
    this.uid = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
    this.peers = new Map();      // net id -> { uid, on }
    this.links = new Map();      // uid -> L (see _ensure)
    this.muted = new Set();      // uids the player has muted (for this page load)
    this.prox = new Proximity();
    this._said = new Set(); this._seen = new Set(); this._myId = 0; this._annDue = false; this._annAt = -1e9; this._lastStart = -1e9; this._n = 0;
    this._w = [0, 0]; this._w2 = [0, 0];
    game.net.on('vc', (d, o) => this._presence(d, o));
    game.net.on('rtc', (d, o) => this._rtc(d, o));
    // (no keys: voice chat and the phone are switched on the Esc screen's sound panel — systems/keyhelp.js — so that
    //  nobody turns their microphone on or off by brushing a key)
    const dot = (this.dot = document.createElement('div'));
    dot.id = 'vc-mic'; dot.title = 'Voice chat';
    dot.style.cssText = 'position:fixed;left:8px;bottom:8px;width:9px;height:9px;border-radius:50%;box-sizing:border-box;display:none;pointer-events:none;z-index:6';
    document.body.appendChild(dot);
    // from timers, not the frame loop: the logic needs ~10 Hz and the level meters ~20 Hz however slowly frames come
    setInterval(() => { try { this._meter(0.05); if (++this._n & 1) this._tick(0.1); } catch (e) { if (!this._err) console.error('[voicechat]', e); this._err = true; } }, 50);
    addEventListener('pagehide', () => { for (const L of this.links.values()) L.link.close('gone', true); this._closeMic(); });
  }

  // ---------------------------------------------------------------- the player's controls
  _toast(t, s = 4) { try { this.game.ui.toast(t, s); } catch (e) { /* headless */ } }
  /** a message that is shown once per page load, however often its cause comes round */
  _once(key, t, s = 7) { if (this._said.has(key)) return; this._said.add(key); this._toast(t, s); }

  /** Voice chat on / off (the Esc screen's sound panel). Turning it on is what asks the browser for the microphone. */
  async toggle(v = !this.on) {
    v = !!v;
    if (v === this.on) return this.on;
    const g = this.game;
    if (v) {
      if (!g.net.connected) { this._toast('Voice chat is for a room with other players in it'); return false; }
      if (typeof RTCPeerConnection === 'undefined' || !g.audio.ctx || !g.audio.ctx.createMediaStreamSource) { this._toast('Voice chat is not available in this browser'); return false; }
      this.on = true; this.micMuted = false;
      this._announce();
      this._toast('Voice chat on: players near you hear your microphone  (Esc: sound panel to turn it off)', 5);
      await this._openMic();
    } else {
      this.on = false; this.phone = false;
      this._closeMic(); this.micState = 'off';
      for (const L of [...this.links.values()]) this._drop(L, true);
      this.prox.clear();
      this._announce();
      this._toast('Voice chat off', 2.5);
    }
    this._paint();
    return this.on;
  }
  /** Phone (the Esc screen's sound panel): you and every player with voice chat on hear each other at any distance. Needs voice chat:
   *  pressed with it off, it turns it on first (the same microphone prompt). Not remembered between visits. */
  async togglePhone(v = !this.phone) {
    v = !!v;
    let also = false;
    if (v && !this.on) { also = true; if (!(await this.toggle(true))) return false; }
    if (!this.on) v = false;
    if (v === this.phone) return this.phone;
    this.phone = v;
    this._announce();
    this._toast(v ? (also ? 'Voice chat on, and phone on' : 'Phone on') + ': you and your friends hear each other at any distance' : 'Phone off: voices carry about 45 m again', v ? 6 : 3);
    this._paint();
    return this.phone;
  }
  /** our own output level for the other players' voices (0..2), on top of the "Friends' microphones" volume */
  setVolume(v) { v = +v; this.vol = isFinite(v) ? Math.max(0, Math.min(2, v)) : 1; return this.vol; }
  /** Stop sending (the microphone is released) but keep hearing the others; again to talk. */
  async muteSelf(v = !this.micMuted) {
    this.micMuted = !!v;
    if (!this.on) return this.micMuted;
    if (this.micMuted) this._closeMic(); else await this._openMic();
    this._paint();
    return this.micMuted;
  }
  /** Do not play one player's voice (by their id in the room). Local; they are not told. */
  mutePlayer(id, v) { const p = this.peers.get(id); if (!p) return false; if (v === undefined) v = !this.muted.has(p.uid); if (v) this.muted.add(p.uid); else this.muted.delete(p.uid); return !!v; }
  isMuted(id) { const p = this.peers.get(id); return !!p && this.muted.has(p.uid); }
  /** what the sound panel shows: can it be switched (and if not, why), is it on, the phone, the microphone's state */
  status() {
    const g = this.game, noRoom = !g.net || !g.net.connected, noRtc = typeof RTCPeerConnection === 'undefined' || !g.audio || !g.audio.ctx || !g.audio.ctx.createMediaStreamSource;
    return { can: !noRoom && !noRtc, why: noRoom ? 'for a room with other players in it' : noRtc ? 'not available in this browser' : '', on: this.on, phone: this.phone, mic: this.on ? (this.micMuted ? 'muted' : this.micState) : 'off' };
  }
  /** has that player voice chat on? */
  has(id) { const p = this.peers.get(id); return !!p && p.on; }

  async _openMic() {
    if (this.track || this.micState === 'asking') return;
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
    const listen = ': you hear the others but they do not hear you';
    if (!md || !md.getUserMedia) {
      this.micState = 'none';
      this._once('nomic', (typeof isSecureContext !== 'undefined' && !isSecureContext ? 'The microphone needs an https (or localhost) address' : 'No microphone here') + listen);
      return;
    }
    this.micState = 'asking';
    let s = null, err = null;
    // asked for once per press of the key, never in a loop
    try { s = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); } catch (e) { err = e; }
    const tr = s && s.getAudioTracks()[0];
    if (!this.on || this.micMuted) { if (s) for (const t of s.getTracks()) t.stop(); this.micState = 'off'; return; }      // (turned off while the prompt was up)
    if (!tr) {
      this.micState = 'none';
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      this._once('nomic', (denied ? 'Microphone not allowed' : 'No microphone found') + listen);
      this._paint();
      return;
    }
    this.stream = s; this.track = tr; this.micState = 'live';
    tr.onended = () => { if (this.track === tr) { this._closeMic(); this.micState = 'none'; this._paint(); } };      // unplugged
    // our own level (the mark that the mic is live pulses with it; our avatar's mouth): analysed, never played
    try { const ctx = this.game.audio.ctx, src = ctx.createMediaStreamSource(s), an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an); this._mic = { src, an, buf: new Float32Array(1024), talk: new Gate(VC.TALK_OPEN, VC.TALK_CLOSE, VC.TALK_HANG) }; } catch (e) { this._mic = null; }
    for (const L of this.links.values()) this._send(L);
    this._paint();
  }
  _closeMic() {
    const s = this.stream;
    this.stream = null; this.track = null; this.level = 0;
    if (this._mic) { try { this._mic.src.disconnect(); } catch (e) { /* */ } this._mic = null; const ch = this.game.player && this.game.player.character; if (ch && this._mouthed) { ch.mouth = 0; this._mouthed = false; } }
    if (s) for (const t of s.getTracks()) { t.onended = null; try { t.stop(); } catch (e) { /* */ } }
    if (this.micState !== 'none') this.micState = 'off';
    for (const L of this.links.values()) this._send(L);
  }
  /** What a link sends: the microphone, or — while there is none (not granted, muted, not there) — a track of pure
   *  silence made here. Every link always has a track on its one sender, and the microphone is swapped in and out
   *  with replaceTrack (no renegotiation): the recipe of nettest/index.html, which is the one tried on real networks. */
  _out() {
    if (this.track) return this.track;
    if (!this._silent) {
      try { const ctx = this.game.audio.ctx, d = ctx.createMediaStreamDestination(), o = ctx.createConstantSource(); o.offset.value = 0; o.connect(d); o.start(); this._silent = d.stream.getAudioTracks()[0] || null; } catch (e) { this._silent = null; }
    }
    return this._silent || null;
  }
  _send(L) {
    const pc = L.link.pc; if (!pc) return;
    const t = this._out();
    try { const tr = pc.getTransceivers()[0]; if (tr && tr.sender && tr.sender.track !== t) tr.sender.replaceTrack(t).catch(() => {}); } catch (e) { /* closing */ }
  }
  _paint() {
    const d = this.dot, live = this.on && this.micState === 'live';
    d.style.display = this.on ? 'block' : 'none';
    d.style.background = live ? '#e5484d' : 'transparent';
    d.style.border = live ? '0' : '2px solid rgba(232,230,223,.55)';
    d.title = (live ? 'Your microphone is live' : 'Voice chat on, microphone off') + (this.phone ? '; phone on' : '') + ' (Esc: sound panel)';
    // phone on: the dot wears a ring
    d.style.boxShadow = this.phone ? '0 0 0 2px rgba(10,13,20,.85), 0 0 0 4px #f3e7b3' : 'none';
  }

  // ---------------------------------------------------------------- presence and signalling
  _announce() { const n = this.game.net; this._annDue = false; this._annAt = nowMs(); if (n.connected) n.send('vc', { u: this.uid, on: this.on ? 1 : 0, ph: this.phone ? 1 : 0 }); }
  _presence(d, o) {
    if (!o || !d || typeof d.u !== 'string' || d.u.length > 24 || d.u === this.uid) return;
    this.peers.set(o.id, { uid: d.u, on: !!d.on, ph: !!d.ph });
    const L = this.links.get(d.u);
    if (L) { L.id = o.id; L.orphan = 0; }      // (after a host migration: the same page under a new number)
  }
  _rtc(d, o) {
    if (!o || !d || typeof d !== 'object' || d.t !== this.uid || typeof d.u !== 'string' || d.u.length > 24 || d.u === this.uid) return;
    const net = this.game.net;
    if (!this.on) { if (d.w || (d.sdp && d.sdp.type === 'offer')) net.sendTo(o.id, 'rtc', { u: this.uid, t: d.u, s: 0, r: d.s || 0, bye: 'off' }); return; }
    if (!this.peers.has(o.id)) this.peers.set(o.id, { uid: d.u, on: true, ph: false });
    let L = this.links.get(d.u);
    if (!L) { if (d.bye || !(d.w || (d.sdp && d.sdp.type === 'offer'))) return; L = this._ensure(d.u, o.id); }
    L.id = o.id; L.orphan = 0; L.d = this._dist(o);
    if (d.w) {      // the polite side would like a link: it is ours to begin
      if (L.link.polite || L.link.live) return;
      if (nowMs() >= L.cool && !L.gaveUp && this._accept(L)) L.link.offer(); else net.sendTo(o.id, 'rtc', { u: this.uid, t: d.u, s: 0, r: 0, bye: 'no' });
      return;
    }
    L.link.signal(d);
  }
  _accept(L) {
    const p = this.peers.get(L.id);
    if (!this.on || !L.id || !(L.d <= VC.DROP || pairPhone(this.phone, p && p.ph))) return false;
    let n = 0; for (const x of this.links.values()) if (x.link.live) n++;
    if (n >= VC.HARD_LINKS) return false;
    this.prox.add(L.uid);
    return true;
  }
  _ensure(uid, id) {
    const net = this.game.net;
    const L = { uid, id: id || 0, d: Infinity, phone: false, call: false, rx: null, tries: 0, cool: 0, gaveUp: false, orphan: 0, poke: -1e9, pokes: 0, level: 0, speaking: false, spr: null, mouthed: null,
      gate: new Gate(), talk: new Gate(VC.TALK_OPEN, VC.TALK_CLOSE, VC.TALK_HANG), link: null };
    L.link = new Link({
      polite: this.uid > uid,
      makePC: () => new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' }),
      newSid: () => 1 + Math.floor(Math.random() * 1e9),
      now: nowMs, later: (fn, ms) => setTimeout(fn, ms), cancel: (t) => clearTimeout(t),
      send: (m) => { if (L.id && net.connected) { m.u = this.uid; m.t = uid; net.sendTo(L.id, 'rtc', m); } },
      setup: (pc) => { pc.addTransceiver(this._out() || 'audio', { direction: 'sendrecv' }); },
      attach: async (pc) => { const tr = pc.getTransceivers()[0]; if (!tr) return; try { tr.direction = 'sendrecv'; await tr.sender.replaceTrack(this._out()); } catch (e) { /* */ } },
      munge: mungeOpus,
      accept: () => this._accept(L),
      ontrack: (e) => this._rxOpen(L, e),
      onstate: (s) => { if (s === 'open') this._tune(L); },
      onclose: (why) => this._closed(L, why),
      log: (what, e) => console.info('[voicechat]', what, e && e.message ? e.message : e),
    });
    this.links.set(uid, L);
    return L;
  }
  /** our encoder for this link: speech does not need more */
  _tune(L) {
    try {
      const s = L.link.pc.getSenders()[0], p = s.getParameters();
      if (p.encodings && p.encodings[0]) { p.encodings[0].maxBitrate = VC.BITRATE; s.setParameters(p).catch(() => {}); }
    } catch (e) { /* not supported: the SDP's cap stands */ }
  }
  _closed(L, why) {
    this._rxClose(L);
    const t = nowMs();
    if (why === 'bye') L.cool = Math.max(L.cool, t + 4000);
    else if (why === 'failed') this._failed(L);
  }
  _failed(L) {
    L.tries++; L.cool = nowMs() + backoff(L.tries) * 1000;
    if (L.tries >= VC.TRIES) {
      L.gaveUp = true;
      const o = this.game.net.others.get(L.id);
      this._once('nat', `Voice chat could not reach ${o ? o.name : 'a player'} directly (a network in between will not allow it). Everything else carries on`, 8);
    }
  }
  _drop(L, tell) { L.link.close('far', !!tell); this._rxClose(L); this.links.delete(L.uid); this.prox.delete(L.uid); }

  // ---------------------------------------------------------------- distance
  /** metres between us and room player o as far as hearing goes; Infinity when one of the two is somewhere with no place on the map */
  _dist(o) {
    const p = this.game.player;
    if (!o || !o.seen || !p) return Infinity;
    const mine = p.place, theirs = o.place;
    if (mine === theirs) return Math.hypot(o.tx - p.pos.x, o.ty - p.pos.y, o.tz - p.pos.z);
    const Fr = this.game.audio.frames;
    let ax = p.pos.x, az = p.pos.z, bx = o.tx, bz = o.tz;
    if (mine !== 'world') { const f = Fr ? Fr(mine) : null; if (!f) return Infinity; f.toWorld(ax, az, this._w); ax = this._w[0]; az = this._w[1]; }
    if (theirs !== 'world') { const f = Fr ? Fr(theirs) : null; if (!f) return Infinity; f.toWorld(bx, bz, this._w2); bx = this._w2[0]; bz = this._w2[1]; }
    const d = Math.hypot(bx - ax, bz - az);
    return isFinite(d) ? d : Infinity;
  }

  // ---------------------------------------------------------------- ~10 Hz: who to link with
  _tick(dt) {
    const net = this.game.net, t = nowMs();
    if (!this.on) return;
    if (!net.connected) {      // out of the room (a host migration, or for good): the links themselves do not need the room; keep them a while
      for (const L of [...this.links.values()]) { L.id = 0; L.orphan += dt; if (L.orphan > VC.ORPHAN_SOLO) this._drop(L, false); }
      this._myId = 0;
      return;
    }
    let fresh = net.id !== this._myId;
    this._myId = net.id;
    for (const id of net.others.keys()) if (!this._seen.has(id)) fresh = true;
    this._seen.clear(); for (const id of net.others.keys()) this._seen.add(id);
    for (const id of [...this.peers.keys()]) if (!net.others.has(id)) this.peers.delete(id);
    if (fresh) this._annDue = true;      // somebody new (or we are new): say again that we have voice chat on
    if (this._annDue && t - this._annAt > 1000) this._announce();

    const cands = this._cands || (this._cands = []);
    cands.length = 0;
    for (const L of this.links.values()) if (L.id && !net.others.has(L.id)) { L.id = 0; L.orphan = 0; }
    for (const [id, p] of this.peers) {
      if (!p.on) continue;
      const d = this._dist(net.others.get(id)), L = this.links.get(p.uid);
      const phone = pairPhone(this.phone, p.ph);
      if (L) { L.id = id; L.orphan = 0; L.d = d; L.phone = phone; }
      cands.push({ key: p.uid, d, id, phone });
    }
    for (const L of [...this.links.values()]) {
      if (L.id) continue;
      L.orphan += dt;
      if (L.orphan > VC.ORPHAN) this._drop(L, false); else cands.push({ key: L.uid, d: L.d, hold: true, id: 0 });
    }
    const want = this.prox.step(cands, dt);
    for (const c of cands) {
      if (!want.has(c.key) || !c.id) continue;
      const L = this.links.get(c.key) || this._ensure(c.key, c.id);
      L.d = c.d; L.phone = !!c.phone;
      if (L.link.live || L.gaveUp || t < L.cool) continue;
      if (L.link.polite) {      // theirs to begin: ask (rarely; they may not want it yet)
        if (t - L.poke > (L.pokes < 5 ? 3000 : 15000)) { L.poke = t; L.pokes++; net.sendTo(L.id, 'rtc', { u: this.uid, t: L.uid, w: 1 }); }
      } else if (t - this._lastStart >= VC.STAGGER_MS) { this._lastStart = t; L.link.offer(); }
    }
    for (const L of [...this.links.values()]) {
      if (!want.has(L.uid)) { this._drop(L, true); continue; }
      const K = L.link;
      if (!K.live) continue;
      const age = t - K.since;
      if ((K.state === 'connecting' && age > VC.CONNECT_MS) || (K.state === 'shaky' && age > VC.SHAKY_MS)) { K.close('timeout', true); this._failed(L); }
      else if (K.state === 'open') { if (age > 30000) { L.tries = 0; L.pokes = 0; } if (L.rx && L.rx.out !== this.game.audio.output) this._spat(L); }
    }
  }

  // ---------------------------------------------------------------- sound
  _rxOpen(L, e) {
    const A = this.game.audio, ctx = A.ctx;
    if (!ctx || !e.track) return;
    this._rxClose(L);
    const stream = (e.streams && e.streams[0]) || new MediaStream([e.track]);
    // Chrome plays nothing of a remote WebRTC stream into Web Audio unless a media element has the stream too
    const el = document.createElement('audio'); el.muted = true; el.autoplay = true; el.srcObject = stream;
    try { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (err) { /* */ }
    const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser(), g = ctx.createGain();
    an.fftSize = 2048; g.gain.value = 0;
    src.connect(an); src.connect(g);
    // the call (phone mode, beyond hearing range): not positioned, a telephone band, into the same volume bus
    const pg = ctx.createGain(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    pg.gain.value = 0; hp.type = 'highpass'; hp.frequency.value = VC.PHONE_LO; hp.Q.value = 0.7; lp.type = 'lowpass'; lp.frequency.value = VC.PHONE_HI; lp.Q.value = 0.7;
    src.connect(pg); pg.connect(hp); hp.connect(lp); lp.connect(A.chatBus || A.master);
    const P = { x: 0, y: 0, z: 0, place: undefined };
    L.rx = { el, src, an, g, pg, hp, lp, ptg: 0, h: null, out: null, P, tg: 0, buf: new Float32Array(2048), pr: null,
      // (asked by the spatial mechanism every frame: where the speaker's avatar is drawn now)
      pos: () => { const o = L.id ? this.game.net.others.get(L.id) : null; if (o && o.seen) { P.x = o.x; P.y = o.y; P.z = o.z; P.place = o.place; } return P; } };
    L.gate.isOpen = false; L.talk.isOpen = false;
    this._spat(L);
  }
  /** (re)make the place in the world this voice is played from (again when the player switches headphones / speakers) */
  _spat(L) {
    const A = this.game.audio, rx = L.rx;
    if (!rx) return;
    const o = L.id ? this.game.net.others.get(L.id) : null, hgt = o && o.character && isFinite(o.character.height) ? o.character.height * 0.93 : 1.6;
    const old = rx.h;
    const h = A.spatial(rx.pos, { cls: 'voice', bus: 'chat', refDistance: VC.REF, rolloff: VC.ROLL, occlusion: true, keep: true, dy: hgt });      // (bus: 'chat' = the "Friends' microphones" volume, core/audio.js)
    if (!h) return;
    try { rx.g.disconnect(); } catch (e) { /* */ }
    rx.g.connect(h.in);
    if (old) { try { if (rx.pr) old.out.disconnect(rx.pr.sp); } catch (e) { /* */ } old.free(); }
    rx.h = h; rx.out = A.output;
    if (rx.pr) h.out.connect(rx.pr.sp);
  }
  _rxClose(L) {
    const rx = L.rx;
    if (L.mouthed) { L.mouthed.mouth = 0; L.mouthed = null; }
    if (L.spr) { L.spr.removeFromParent(); L.spr.material.dispose(); L.spr = null; }
    L.speaking = false; L.level = 0;
    if (!rx) return;
    L.rx = null;
    L.call = false;
    try { rx.src.disconnect(); rx.g.disconnect(); rx.pg.disconnect(); rx.hp.disconnect(); rx.lp.disconnect(); if (rx.h) rx.h.free(); if (rx.pr) rx.pr.sp.disconnect(); } catch (e) { /* */ }
    try { rx.el.pause(); rx.el.srcObject = null; } catch (e) { /* */ }
  }
  /** ~20 Hz: levels -> noise gate, fade with distance, mouths, marks */
  _meter(dt) {
    const g = this.game, ctx = g.audio.ctx;
    if (!this.on || !ctx) return;
    if (this._mic) {
      const m = this._mic; m.an.getFloatTimeDomainData(m.buf);
      const r = (this.level = rmsOf(m.buf)), talking = m.talk.step(r, dt), ch = g.player && g.player.character;
      if (ch && (talking || this._mouthed)) { ch.mouth = talking ? Math.min(1, 0.25 + r * 7) : 0; this._mouthed = talking; }
      this.dot.style.opacity = talking ? '1' : '.6';
    }
    for (const L of this.links.values()) {
      const rx = L.rx; if (!rx) continue;
      rx.an.getFloatTimeDomainData(rx.buf);
      const r = (L.level = rmsOf(rx.buf)), open = L.gate.step(r, dt), near = fade(L.d), muted = this.muted.has(L.uid);
      const call = (L.call = phoneHeard(L.call, L.phone, L.d));
      const tg = open && !muted ? near * this.vol : 0;
      if (tg !== rx.tg) { rx.tg = tg; rx.g.gain.setTargetAtTime(tg, ctx.currentTime, tg > 0 ? 0.012 : 0.06); }
      // (the call comes and goes over about half a second as the pair crosses the edge; the gate opens it fast)
      const ptg = call && open && !muted ? VC.PHONE_LEVEL * this.vol : 0;
      if (ptg !== rx.ptg) { const edge = call !== rx.pcall; rx.pcall = call; rx.ptg = ptg; rx.pg.gain.setTargetAtTime(ptg, ctx.currentTime, edge ? 0.18 : ptg > 0 ? 0.012 : 0.06); }
      const talking = (L.speaking = L.talk.step(r, dt) && (near > 0 || call) && !muted);
      const o = L.id ? g.net.others.get(L.id) : null, ch = o && o.character;
      if (L.mouthed && L.mouthed !== ch) { L.mouthed.mouth = 0; L.mouthed = null; }
      if (ch && (talking || L.mouthed)) { ch.mouth = talking ? Math.min(1, 0.25 + r * 7) : 0; L.mouthed = talking ? ch : null; }
      if (talking && ch && !L.spr) L.spr = mark();
      if (L.spr) {
        if (ch && L.spr.parent !== ch.group) { ch.group.add(L.spr); L.spr.position.set(0, ((ch.dims && ch.dims.top) || 1.75) + 0.2, 0); }
        L.spr.visible = talking && !!ch;
      }
    }
  }

  // ---------------------------------------------------------------- for the tools
  info() {
    const links = [];
    for (const L of this.links.values()) links.push({ id: L.id, uid: L.uid, sid: L.link.sid, state: L.link.state, polite: L.link.polite, d: isFinite(L.d) ? Math.round(L.d * 10) / 10 : null, level: L.level, gain: L.rx ? L.rx.tg : 0, phone: L.phone, call: L.call, pgain: L.rx ? L.rx.ptg : 0, speaking: L.speaking, rx: !!L.rx, hrtf: !!(L.rx && L.rx.h && L.rx.h.hrtf), tries: L.tries, gaveUp: L.gaveUp, muted: this.muted.has(L.uid) });
    return { on: this.on, phone: this.phone, mic: this.micState, micMuted: this.micMuted, level: this.level, uid: this.uid, peers: [...this.peers].map(([id, p]) => ({ id, uid: p.uid, on: p.on, ph: p.ph })), links };
  }
  /** rms of the left and right channel of one player's voice AFTER the spatial node (what reaches the mix, before the master gain) */
  probe(id) {
    let L = null; for (const x of this.links.values()) if (x.id === id) L = x;
    const rx = L && L.rx, ctx = this.game.audio.ctx;
    if (!rx || !rx.h || !ctx) return null;
    if (!rx.pr) {
      const sp = ctx.createChannelSplitter(2), l = ctx.createAnalyser(), r = ctx.createAnalyser(), i = ctx.createAnalyser();
      const ph = ctx.createAnalyser(); ph.fftSize = 16384; rx.lp.connect(ph);
      l.fftSize = r.fftSize = i.fftSize = 16384; sp.connect(l, 0); sp.connect(r, 1); rx.h.out.connect(sp); rx.src.connect(i);
      rx.pr = { sp, l, r, i, ph, bp: new Float32Array(16384), bl: new Float32Array(16384), br: new Float32Array(16384), bi: new Float32Array(16384) };
      return { l: 0, r: 0, i: 0, p: 0, fresh: true };
    }
    rx.pr.l.getFloatTimeDomainData(rx.pr.bl); rx.pr.r.getFloatTimeDomainData(rx.pr.br); rx.pr.i.getFloatTimeDomainData(rx.pr.bi);
    rx.pr.ph.getFloatTimeDomainData(rx.pr.bp);
    return { l: rmsOf(rx.pr.bl), r: rmsOf(rx.pr.br), i: rmsOf(rx.pr.bi), p: rmsOf(rx.pr.bp), channels: rx.lp.channelCount };      // p: the call (one channel, so the same in both ears)      // i: as received, before the gate and the spatial node
  }
}

// the small mark over a speaking player's head (one shared texture)
let markTex = null;
function mark() {
  if (!markTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    c.strokeStyle = 'rgba(243,231,179,.95)'; c.lineWidth = 5; c.lineCap = 'round';
    for (const [r, a] of [[10, 1], [20, 0.8], [30, 0.55]]) { c.globalAlpha = a; c.beginPath(); c.arc(14, 32, r, -0.75, 0.75); c.stroke(); }
    c.globalAlpha = 1; c.fillStyle = 'rgba(243,231,179,.95)'; c.beginPath(); c.arc(12, 32, 5, 0, Math.PI * 2); c.fill();
    markTex = new THREE.CanvasTexture(cv);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(0.17, 0.17, 1); s.visible = false; s.raycast = () => {};
  return s;
}

export function installVoiceChat(game) {
  if (!game || game.voicechat || typeof document === 'undefined' || !game.net || !game.input) return game && game.voicechat;
  try { game.voicechat = new VoiceChat(game); } catch (e) { console.error('[voicechat]', e); }
  return game.voicechat;
}
