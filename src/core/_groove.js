// Step-sequenced music engine for the club (places/_pt_audio.js) and the Cellar Bar jukebox / bop (places/_bar_audio.js).
// Three layers, each usable on its own (tools/smoke_audio.mjs tests the first two in node):
//
//   stepEvents(track, step, emit)   PURE: what sounds on 16th-note `step` of a track (a function of the step only, so a
//                                   player who walks in half-way through hears exactly what everyone else hears)
//   SetPlayer                       the playlist on the SHARED clock (game.time.now()): which track / step is due, with
//                                   a local "hold" (dance minigame) and jukebox requests; no audio in it at all
//   Groove                          turns events into WebAudio nodes on one bus: drums, pumped tonal bus, tempo delay,
//                                   one low-pass + gain for "muffled through the door" → dest
//
// Track format: see _groove_tracks.js. All music is original; nothing here quotes a real song.
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const CH = {
  maj: [0, 4, 7], min: [0, 3, 7], dom7: [0, 4, 7, 10], min7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], sus2: [0, 2, 7],
  pow: [0, 7, 12], add9: [0, 4, 7, 14], m9: [0, 3, 7, 14], six: [0, 4, 7, 9],
};
const d36 = (c) => { const n = c.charCodeAt(0); return n >= 97 ? n - 87 : n - 48; };   // '0'-'9','a'-'z' → 0..35
const OPEN = 18000;

/** prepare a track once: section table, bar count, the loop used while a dance game holds the track */
export function prepare(T) {
  if (T._sec) return T;
  let bar = 0; T._sec = [];
  for (const [bars, layers] of T.form) {
    const has = {}; for (const ch of layers) if (ch !== ' ') has[ch] = true;
    T._sec.push({ start: bar, bars, has }); bar += bars;
  }
  T.bars = bar; T.steps = bar * 16; T.spb = 60 / T.bpm; T.dur = T.bars * 4 * T.spb;
  T.danceDiv = T.danceDiv || 1;
  // hold loop: the last full-band section with a lead (a "drop")
  let hold = T._sec[0];
  for (const s of T._sec) if (s.has.k && (s.has.l || s.has.L) && s.bars >= 8) hold = s;
  T._hold = { from: hold.start * 16, to: (hold.start + hold.bars) * 16 };
  T._chordNotes = {};
  for (const k of Object.keys(T.chords)) T._chordNotes[k] = T.chords[k].map(([r, q]) => CH[q].map((i) => r + i));
  return T;
}
export function sectionAt(T, bar) { const S = T._sec; for (let i = S.length - 1; i >= 0; i--) if (bar >= S[i].start) return S[i]; return S[0]; }

/**
 * Emit every sound of 16th `step` (0 … T.steps-1) of track T:  emit(kind, a, b, c)
 *   'kick' vel | 'snare' vel | 'clap' vel | 'hat' vel open(0/1) | 'shaker' vel
 *   'bass' midi lenSteps | 'stab' notes[] lenSteps | 'pad' notes[] lenSteps | 'arp' midi | 'lead' midi lenSteps
 *   'crash' | 'impact' | 'riser' frac0 frac1 (one bar of a rise) | 'sweep' hz0 hz1 (tonal low-pass over this bar)
 * lowOnly: just the parts you would hear through a wall (kick, bass, snare).
 */
export function stepEvents(T, step, emit, lowOnly = false) {
  const bar = Math.floor(step / 16), st = step - bar * 16, S = sectionAt(T, bar), H = S.has, P = T.parts;
  const bs = bar - S.start, last = bs === S.bars - 1, frac = (bs + st / 16) / S.bars;
  const prog = H['2'] && T.chords.B ? 'B' : 'A', cn = T._chordNotes[prog], ci = bs % cn.length, notes = cn[ci], root = T.chords[prog][ci][0];
  // ---- drums
  if (H.R) {                                  // build: a snare roll that doubles up, then a beat of air before the drop
    const div = frac < 0.5 ? 4 : frac < 0.75 ? 2 : 1;
    const gap = last && st >= 14;
    if (!gap && st % div === 0) emit('snare', 0.3 + 0.45 * frac);
    if (H.k && frac < 0.5 && st % 4 === 0) emit('kick', 1);
  } else {
    const gap = H['!'] && last && st >= 12;
    const kp = H.K ? P.K : H.k ? P.k : null;
    if (kp && !gap && kp[st] !== '.') emit('kick', kp[st] === 'x' ? 1 : 0.6);
    if (H.c) {
      const c = P.c[st];
      if (c !== '.') emit(P.clap ? 'clap' : 'snare', c === 'x' ? 1 : 0.4);
      else if (last && st >= 13 && S.bars >= 8 && !gap && P.fill !== false) emit('snare', 0.35 + 0.15 * (st - 13));   // fill into the next section
      else if (gap && st >= 12) emit('snare', 0.5 + 0.12 * (st - 12));
    }
    if (!lowOnly) {
      if (H.h) { const h = P.h[st]; if (h !== '.') emit('hat', h === 'x' ? 1 : h === 'o' ? 0.9 : 0.45, h === 'o' ? 1 : 0); }
      if (H.o && st % 4 === 2) emit('hat', 0.9, 1);
      if (H.s) emit('shaker', st % 4 === 2 ? 1 : st % 2 ? 0.45 : 0.7);
    }
  }
  // ---- bass
  const bp = H.B ? P.B : H.b ? P.b : null;
  if (bp) { const c = bp[st]; if (c !== '.' && c !== '-') { let len = 1; while (st + len < 16 && bp[st + len] === '-') len++; emit('bass', root + d36(c) + (P.bassOct ?? -1) * 12, len === 1 ? (P.bassLen || 1.6) : len); } }
  if (lowOnly) return;
  // ---- chords
  const tp = H.T ? P.T : H.t ? P.t : null;
  if (tp && tp[st] !== '.') emit('stab', notes, P.stabLen || 1.5, tp[st] === 'x' ? 1 : 0.6);
  if (H.p && st === 0) emit('pad', notes, 16);
  if (H.a && P.a) { const c = P.a[st]; if (c !== '.') { const i = d36(c), n = notes.length; emit('arp', notes[i % n] + 12 * Math.floor(i / n) + (P.arpOct ?? 1) * 12); } }
  // ---- lead
  const lp = H.L ? P.L : H.l ? P.l : null;
  if (lp) {
    if (lp.seq) { const ms = (bs * 16 + st) % lp.len; for (const e of lp.seq) if (e[0] === ms) emit('lead', e[1], e[2] || lp.dur || 3); }
    else { const str = lp[bs % lp.length], c = str[st]; if (c !== '.' && c !== '-') { let len = 1; while (st + len < 16 && str[st + len] === '-') len++; emit('lead', T.key + d36(c) + (P.leadOct ?? 1) * 12, len + 0.6); } }
  }
  // ---- section effects (per bar, stateless)
  if (st === 0) {
    if (bs === 0) { if (H.x) emit('crash'); if (H.d) emit('impact'); }
    if (H.r) emit('riser', bs / S.bars, (bs + 1) / S.bars);
    if (H.f) emit('sweep', 260 * Math.pow(40, bs / S.bars), 260 * Math.pow(40, (bs + 1) / S.bars));
    else if (H.m) emit('sweep', 800, 800);
    else emit('sweep', OPEN, OPEN);
  }
}

// ================================================================================================ playlist on the shared clock
function perm(n, seed) {       // deterministic shuffle of 0..n-1
  const a = []; for (let i = 0; i < n; i++) a.push(i);
  let s = (seed * 2654435761 + 12345) >>> 0;
  for (let i = n - 1; i > 0; i--) { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; const j = s % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
export class SetPlayer {
  /**
   * tracks: prepared tracks; shared(): shared seconds (game.time.now()/1000); clock(): local audio seconds;
   * onStep(track, step, when, sp): schedule one 16th (when = local clock seconds, sp = seconds per 16th);
   * shuffle: reorder the playlist every cycle (the same for everyone); epoch: offsets this set from others.
   */
  constructor({ tracks, shared, clock, onStep, shuffle = true, epoch = 0 }) {
    this.tracks = tracks.map(prepare); this.shared = shared; this.clock = clock; this.onStep = onStep; this.shuffle = shuffle; this.epoch = epoch;
    this.cycle = this.tracks.reduce((s, t) => s + t.dur, 0);
    this.hold = false; this.override = null;       // {ti, t0} a requested track that plays from shared time t0
    this.pos = null;                               // {ti, step, t (shared s of that step)}
    this.off = 0;                                  // shared − clock, latched at each (re)locate
    this.cur = null; this.pending = null;          // beat anchors {T, ti, t0 (clock time of step 0), from}
    this._loc = { ti: 0, step: 0, t: 0 };
  }
  order(c) { return this.shuffle ? perm(this.tracks.length, c) : perm(this.tracks.length, 0).sort((a, b) => a - b); }
  /** which track and 16th are sounding at shared second `sec` → {ti, step, t (start of that step)}; reuses one object */
  locate(sec, out = this._loc) {
    const o = this.override;
    if (o && sec >= o.t0 && sec < o.t0 + this.tracks[o.ti].dur) {
      const T = this.tracks[o.ti], sp = T.spb / 4, k = Math.floor((sec - o.t0) / sp);
      out.ti = o.ti; out.step = k; out.t = o.t0 + k * sp; return out;
    }
    const s = sec + this.epoch, c = Math.floor(s / this.cycle); let r = s - c * this.cycle;
    const ord = this.order(c);
    for (let i = 0; i < ord.length; i++) {
      const T = this.tracks[ord[i]];
      if (r < T.dur || i === ord.length - 1) { const sp = T.spb / 4, k = Math.min(T.steps - 1, Math.floor(r / sp)); out.ti = ord[i]; out.step = k; out.t = sec - r + k * sp; return out; }
      r -= T.dur;
    }
    return out;
  }
  _relocate(sec) {
    const l = this.locate(sec), T = this.tracks[l.ti], sp = T.spb / 4;
    if (!this.pos) this.pos = { ti: 0, step: 0, t: 0 };
    this.pos.ti = l.ti; this.pos.step = l.step; this.pos.t = l.t;
    if (this.pos.t < sec - 1e-6) { this.pos.step++; this.pos.t += sp; }                 // the first step not yet begun
    if (this.pos.step >= T.steps) { const n = this.locate(this.pos.t + 1e-4); this.pos.ti = n.ti; this.pos.step = n.step; this.pos.t = n.t; }
    this.off = this.shared() - this.clock();
    this._anchor();
  }
  _anchor() {
    const p = this.pos, T = this.tracks[p.ti], sp = T.spb / 4, when = p.t - this.off;
    const a = { T, ti: p.ti, t0: when - p.step * sp, from: when };
    if (!this.cur) this.cur = a; else this.pending = a;
  }
  /** schedule every step that starts within `horizon` seconds; call from a timer (~10 Hz) */
  tick(horizon = 0.4) {
    const now = this.shared();
    if (!this.pos || this.pos.t < now - 0.6 || this.pos.t > now + horizon + 2) { this.cur = null; this.pending = null; this._relocate(now + 0.03); }
    const p = this.pos; let guard = 0;
    while (p.t < now + horizon && guard++ < 64) {
      let T = this.tracks[p.ti];
      const o = this.override;
      if (o && !o.done && p.t >= o.t0 - 1e-4 && p.step % 16 === 0) { o.done = true; this._relocate(p.t + 1e-4); continue; }
      if (this._resync && p.step % 16 === 0 && !this.hold) { this._resync = false; this._relocate(p.t + 1e-4); continue; }
      if (this.hold && p.step >= T._hold.to) { p.step = T._hold.from; this._anchor(); this._resync = true; }
      if (p.step >= T.steps) { this._relocate(p.t + 1e-4); continue; }
      const sp = T.spb / 4;
      let when = p.t - this.off;
      if (T.swing && p.step % 2 === 1) when += (T.swing - 0.5) * 2 * sp;
      if (when >= this.clock() - 0.02) this.onStep(T, p.step, when, sp);
      p.step++; p.t += sp;
    }
  }
  /** play track `ti` from the next 8-bar line (returns the shared time it starts) */
  request(ti, t0 = null) {
    if (t0 === null) {
      const now = this.shared(), l = this.locate(now), T = this.tracks[l.ti], sp = T.spb / 4;
      const next8 = (Math.floor(l.step / 128) + 1) * 128;
      t0 = l.t + (Math.min(next8, T.steps) - l.step) * sp;
    }
    this.override = { ti: ((ti % this.tracks.length) + this.tracks.length) % this.tracks.length, t0, done: false };
    return t0;
  }
  setHold(on) { if (this.hold && !on) this._resync = true; this.hold = on; }
  /** the track whose beat is sounding now (anchors switch when their first step arrives) */
  now() {
    const c = this.clock();
    if (this.pending && c >= this.pending.from) { this.cur = this.pending; this.pending = null; }
    if (!this.cur) { this.tick(); }
    return this.cur;
  }
  /** beats (in dance beats) since the current track's bar 0 — fractional */
  beat() { const a = this.now(); return a ? (this.clock() - a.t0) / (a.T.spb * a.T.danceDiv) : 0; }
  get track() { const a = this.now(); return a ? a.T : this.tracks[0]; }
  /** local clock time of the next bar line of the current track (dance-beat bars) */
  nextBar() { const a = this.now(), bar = a.T.spb * a.T.danceDiv * 4, k = Math.ceil((this.clock() - a.t0) / bar + 1e-6); return a.t0 + k * bar; }
}

// ================================================================================================ the synth
const KITS = {
  club: { kf: [165, 48], kd: 0.32, kg: 1.0, sn: [1700, 0.9, 0.16], hat: 8200, body: 185 },
  band: { kf: [120, 52], kd: 0.2, kg: 0.75, sn: [2100, 0.7, 0.14], hat: 6800, body: 200 },
  dnb: { kf: [180, 52], kd: 0.2, kg: 1.0, sn: [2300, 0.6, 0.17], hat: 9000, body: 215 },
};
export class Groove {
  /** audio: core Audio (started); dest: node to feed (default audio.music) */
  constructor(audio, dest = null) {
    this.audio = audio; const ctx = (this.ctx = audio.ctx);
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = OPEN; this.muffle.Q.value = 0.5;
    this.mix = ctx.createGain(); this.mix.gain.value = 1;
    this.mix.connect(this.muffle); this.muffle.connect(this.out); this.out.connect(dest || audio.music);
    this.drum = ctx.createGain(); this.drum.connect(this.mix);
    this.pump = ctx.createGain(); this.pump.connect(this.mix);
    this.sweep = ctx.createBiquadFilter(); this.sweep.type = 'lowpass'; this.sweep.frequency.value = OPEN; this.sweep.Q.value = 0.9; this.sweep.connect(this.pump);
    this.tonal = ctx.createGain(); this.tonal.connect(this.sweep);
    // tempo delay for leads / stabs
    this.send = ctx.createGain(); this.send.gain.value = 1;
    this.delay = ctx.createDelay(1.2); this.delay.delayTime.value = 0.36;
    const fb = ctx.createGain(); fb.gain.value = 0.33; const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    const ret = ctx.createGain(); ret.gain.value = 0.5;
    this.send.connect(this.delay); this.delay.connect(dlp); dlp.connect(fb); fb.connect(this.delay); dlp.connect(ret); ret.connect(this.sweep);
    // one-oscillator "organ" and "electric piano" timbres
    const pw = (h) => { const re = new Float32Array(h.length + 1), im = new Float32Array(h.length + 1); h.forEach((v, i) => { im[i + 1] = v; }); return ctx.createPeriodicWave(re, im); };
    this.waves = { organ: pw([1, 0.55, 0.3, 0.12, 0, 0.08]), epiano: pw([1, 0.28, 0.04, 0.1, 0, 0.02]), pick: pw([1, 0.5, 0.33, 0.22, 0.15, 0.1, 0.07, 0.05]) };
    this.live = 0; this.peakLive = 0; this.made = 0;
    this._emit = (kind, a, b, c) => this.play(kind, a, b, c);
    this._T = null; this._when = 0; this._sp = 0.12; this._delayT = 0;
  }
  /** schedule every event of one 16th. when = ctx time */
  step(T, step, when, sp, lowOnly = false) {
    this._T = T; this._when = Math.max(when, this.ctx.currentTime); this._sp = sp;
    const dt = sp * 3;                                         // dotted-eighth echo
    if (Math.abs(dt - this._delayT) > 1e-4) { this._delayT = dt; this.delay.delayTime.setValueAtTime(dt, this._when); }
    stepEvents(T, step, this._emit, lowOnly);
  }
  /** "through the door" control: cutoff Hz + gain, eased with time-constant tc */
  setTone(hz, gain, tc = 0.25) {
    const t = this.ctx.currentTime;
    this.muffle.frequency.setTargetAtTime(Math.max(60, Math.min(OPEN, hz)), t, tc);
    this.out.gain.setTargetAtTime(gain, t, tc);
  }
  dispose() { try { this.out.disconnect(); } catch { /* */ } }

  _track(src, tail) {
    this.live += 1; this.made += 1; if (this.live > this.peakLive) this.peakLive = this.live;
    src.onended = () => { this.live -= 1; try { tail.disconnect(); } catch { /* */ } };
  }
  /** a gain that is silent until its envelope says otherwise (a GainNode defaults to 1: a source that starts a sample
   *  before the envelope's first event would leak one raw sample — a click) */
  _g() { const g = this.ctx.createGain(); g.gain.value = 0; return g; }
  _osc(type, hz, t, detune = 0) {
    const o = this.ctx.createOscillator();
    if (this.waves[type]) o.setPeriodicWave(this.waves[type]); else o.type = type;
    o.frequency.setValueAtTime(hz, t); if (detune) o.detune.value = detune;
    return o;
  }
  _noise(t, dur, type, hz, q) {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter();
    s.buffer = this.audio.noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(hz, t); f.Q.value = q;
    s.connect(f); s.start(t, (t * 7.31) % 2); s.stop(t + dur + 0.03);
    return { s, f };
  }
  play(kind, a, b, c) {
    const ctx = this.ctx, T = this._T, t = this._when, sp = this._sp, P = T.parts, K = KITS[T.kit || 'club'], L = T.levels || {};
    switch (kind) {
      case 'kick': {
        const o = ctx.createOscillator(), g = this._g(), v = a * K.kg * (L.kick ?? 1);
        o.frequency.setValueAtTime(K.kf[0], t); o.frequency.exponentialRampToValueAtTime(K.kf[1], t + 0.09);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + K.kd); g.gain.linearRampToValueAtTime(0, t + K.kd + 0.02);
        o.connect(g); g.connect(this.drum); o.start(t); o.stop(t + K.kd + 0.04); this._track(o, g);
        const d = T.pump || 0;
        if (d > 0 && a > 0.8) { const pg = this.pump.gain; pg.setValueAtTime(1, t); pg.linearRampToValueAtTime(1 - d, t + 0.012); pg.linearRampToValueAtTime(1, t + T.spb * 0.62); }
        break;
      }
      case 'snare': {
        const v = a * (L.snare ?? 1), n = this._noise(t, K.sn[2], 'bandpass', K.sn[0], K.sn[1]), g = this._g();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + K.sn[2]); g.gain.linearRampToValueAtTime(0, t + K.sn[2] + 0.02);
        n.f.connect(g); g.connect(this.drum); this._track(n.s, g);
        const o = this._osc('triangle', K.body, t), og = this._g();
        o.frequency.exponentialRampToValueAtTime(K.body * 0.75, t + 0.07);
        og.gain.setValueAtTime(0.22 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09); og.gain.linearRampToValueAtTime(0, t + 0.1);
        o.connect(og); og.connect(this.drum); o.start(t); o.stop(t + 0.12); this._track(o, og);
        break;
      }
      case 'clap': {
        const v = a * (L.clap ?? 1), n = this._noise(t, 0.2, 'bandpass', 1350, 1.1), g = this._g(), G = g.gain;
        G.setValueAtTime(0, t);
        for (let i = 0; i < 3; i++) { const u = t + i * 0.011; G.linearRampToValueAtTime(0.5 * v, u + 0.002); G.exponentialRampToValueAtTime(0.08 * v, u + 0.01); }
        G.linearRampToValueAtTime(0.5 * v, t + 0.035); G.exponentialRampToValueAtTime(0.001, t + 0.19); G.linearRampToValueAtTime(0, t + 0.21);
        n.f.connect(g); g.connect(this.drum); this._track(n.s, g);
        break;
      }
      case 'hat': case 'shaker': {
        const open = kind === 'hat' && b, dur = kind === 'shaker' ? 0.035 : open ? Math.min(0.22, sp * 1.7) : 0.045;
        const v = a * (kind === 'shaker' ? 0.09 : 0.2) * (L.hat ?? 1), n = this._noise(t, dur, 'highpass', kind === 'shaker' ? 5200 : K.hat, 0.7), g = this._g();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
        n.f.connect(g); g.connect(this.drum); this._track(n.s, g);
        break;
      }
      case 'bass': {
        const hz = midiHz(a), dur = b * sp, type = P.bassType || 'sawtooth', v = 0.26 * (L.bass ?? 1);
        const f = ctx.createBiquadFilter(), g = this._g(); f.type = 'lowpass'; f.Q.value = type === 'reese' ? 0.7 : 2.2;
        const top = type === 'sub' ? 300 : type === 'reese' ? 620 : (P.bassCut || 1100);
        f.frequency.setValueAtTime(top, t); f.frequency.exponentialRampToValueAtTime(Math.max(140, top * 0.3), t + Math.max(0.08, dur));
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.setValueAtTime(v, t + Math.max(0.02, dur - 0.03)); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
        f.connect(g); g.connect(this.tonal);
        const o = this._osc(type === 'reese' || type === 'sub' ? (type === 'sub' ? 'sine' : 'sawtooth') : type, hz, t, type === 'reese' ? -14 : 0);
        o.connect(f); o.start(t); o.stop(t + dur + 0.05); this._track(o, g);
        if (type === 'reese') { const o2 = this._osc('sawtooth', hz, t, 14); o2.connect(f); o2.start(t); o2.stop(t + dur + 0.05); this._track(o2, o2); }
        if (type !== 'sub' && type !== 'pick') { const s = this._osc('sine', hz, t), sg = this._g(); sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(v * 0.42, t + 0.008); sg.gain.setValueAtTime(v * 0.42, t + Math.max(0.02, dur - 0.03)); sg.gain.linearRampToValueAtTime(0, t + dur + 0.02); s.connect(sg); sg.connect(this.tonal); s.start(t); s.stop(t + dur + 0.05); this._track(s, sg); }
        break;
      }
      case 'stab': {
        const type = P.stabType || 'sawtooth', dur = b * sp, v = (c || 1) * 0.16 * (L.stab ?? 1), oct = (P.stabOct ?? 1) * 12;
        const f = ctx.createBiquadFilter(), g = this._g(); f.type = 'lowpass'; f.Q.value = 1.2;
        const pl = type === 'pluck' || type === 'pick';
        if (pl) { f.frequency.setValueAtTime(3600, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.16); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 1.5, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.18, dur * 1.4)); g.gain.linearRampToValueAtTime(0, t + Math.max(0.18, dur * 1.4) + 0.02); }
        else if (type === 'epiano' || type === 'organ') { f.frequency.setValueAtTime(type === 'organ' ? 2600 : 2000, t); const d2 = type === 'organ' ? dur : Math.max(dur, 0.5); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 1.7, t + 0.006); if (type === 'organ') g.gain.setValueAtTime(v * 1.7, t + Math.max(0.01, d2 - 0.03)); else g.gain.exponentialRampToValueAtTime(v * 0.25, t + d2); g.gain.linearRampToValueAtTime(0, t + d2 + 0.03); }
        else { f.frequency.setValueAtTime(P.stabCut || 3000, t); f.frequency.exponentialRampToValueAtTime(900, t + Math.max(0.05, dur)); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setValueAtTime(v, t + Math.max(0.01, dur - 0.03)); g.gain.linearRampToValueAtTime(0, t + dur + 0.02); }
        const end = t + (pl ? Math.max(0.18, dur * 1.4) : type === 'epiano' ? Math.max(dur, 0.5) : dur) + 0.06;
        f.connect(g); g.connect(this.tonal); if (P.stabSend) { const sg = this._g(); sg.gain.value = P.stabSend; g.connect(sg); sg.connect(this.send); }
        for (let i = 0; i < a.length; i++) { const o = this._osc(pl ? 'pick' : type, midiHz(a[i] + oct), t, (i - 1) * 5); o.connect(f); o.start(t); o.stop(end); if (i === 0) this._track(o, g); else this._track(o, o); }
        break;
      }
      case 'pad': {
        const dur = b * sp, v = 0.05 * (L.pad ?? 1), f = ctx.createBiquadFilter(), g = this._g(); f.type = 'lowpass'; f.frequency.value = P.padCut || 1100; f.Q.value = 0.6;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.25); g.gain.setValueAtTime(v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur * 1.15);
        f.connect(g); g.connect(this.tonal);
        for (let i = 0; i < a.length; i++) for (const d of [-9, 9]) { const o = this._osc('sawtooth', midiHz(a[i] + (P.padOct ?? 1) * 12), t, d); o.connect(f); o.start(t); o.stop(t + dur * 1.15 + 0.05); if (i === 0 && d < 0) this._track(o, g); else this._track(o, o); }
        break;
      }
      case 'arp': {
        const v = 0.13 * (L.arp ?? 1), dur = sp * 1.5, o = this._osc(P.arpType || 'pick', midiHz(a), t), f = ctx.createBiquadFilter(), g = this._g(); f.type = 'lowpass';
        f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(900, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
        o.connect(f); f.connect(g); g.connect(this.tonal); const sg = this._g(); sg.gain.value = 0.35; g.connect(sg); sg.connect(this.send);
        o.start(t); o.stop(t + dur + 0.05); this._track(o, g);
        break;
      }
      case 'lead': {
        const type = P.leadType || 'square', dur = b * sp, v = 0.17 * (L.lead ?? 1), o = this._osc(type, midiHz(a), t), f = ctx.createBiquadFilter(), g = this._g();
        f.type = 'lowpass'; f.frequency.setValueAtTime(P.leadCut || 3200, t); f.Q.value = 0.8;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(v * 0.6, t + Math.max(0.05, dur)); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
        o.connect(f); f.connect(g); g.connect(this.tonal); const sg = this._g(); sg.gain.value = P.leadSend ?? 0.3; g.connect(sg); sg.connect(this.send);
        // a little vibrato on held notes
        if (b > 3.5) { o.frequency.setValueAtTime(midiHz(a), t + sp * 2); o.frequency.linearRampToValueAtTime(midiHz(a + 0.12), t + sp * 3); o.frequency.linearRampToValueAtTime(midiHz(a - 0.08), t + sp * 4); o.frequency.linearRampToValueAtTime(midiHz(a), t + sp * 5); }
        o.start(t); o.stop(t + dur + 0.08); this._track(o, g);
        break;
      }
      case 'crash': {
        const n = this._noise(t, 1.4, 'highpass', 5200, 0.5), g = this._g();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4); g.gain.linearRampToValueAtTime(0, t + 1.42);
        n.f.connect(g); g.connect(this.drum); this._track(n.s, g);
        break;
      }
      case 'impact': {
        const o = ctx.createOscillator(), g = this._g();
        o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.5);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9); g.gain.linearRampToValueAtTime(0, t + 0.92);
        o.connect(g); g.connect(this.drum); o.start(t); o.stop(t + 0.95); this._track(o, g);
        break;
      }
      case 'riser': {
        const dur = sp * 16, n = this._noise(t, dur, 'bandpass', 500 * Math.pow(14, a), 2.5), g = this._g();
        n.f.frequency.exponentialRampToValueAtTime(500 * Math.pow(14, b), t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.015 + 0.13 * a, t + 0.03); g.gain.linearRampToValueAtTime(0.015 + 0.13 * b, t + dur - 0.02); g.gain.linearRampToValueAtTime(0, t + dur + 0.01);
        n.f.connect(g); g.connect(this.drum); this._track(n.s, g);
        break;
      }
      case 'sweep': {
        const fq = this.sweep.frequency;
        // never cancel: the previous bar's ramp ends exactly where this one starts
        if (a === b) { if (this._sw !== a) { this._sw = a; fq.setTargetAtTime(a, t + 0.001, 0.03); } }
        else { this._sw = -1; fq.setValueAtTime(a, t + 0.001); fq.exponentialRampToValueAtTime(b, t + sp * 16 - 0.001); }
        break;
      }
    }
  }
}
