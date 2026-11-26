// Synthesised piano for the Faculty of Music (owned by places/music_faculty.js). No samples: every note is rendered
// once into an AudioBuffer by an additive string model, then played through a per-voice envelope + velocity filter.
//
// String model (NoteRenderer, DOM-free so the smoke test can run it):
//   * stretched inharmonic partials  f_k = k·f0·sqrt(1 + B·k²), B rising towards the treble (and higher on an upright)
//   * amplitudes from a hammer striking 1/8 of the way along the string (|sin(πk/8)|) with a spectral tilt
//   * two-stage decay per partial (fast "prompt sound" + slow "aftersound"), longer in the bass, faster for high partials
//   * 1–3 unison strings per note, a few cents apart (beating); an upright is also individually a little out of tune
// Runtime (PianoEngine): velocity -> level + low-pass brightness that closes over time, hammer-noise transient,
// damper release (none above F6, like a real piano), sustain pedal, 32-voice pool with stealing, a body EQ per
// instrument and a generated-impulse ConvolverNode room. Separate buses for muffled practice through doors and for
// other players' pianos.
import { midiFreq } from './_music_logic.js';

export const INSTRUMENTS = {
  // a tired practice-room upright: boxy midrange, shorter sustain, strings a touch apart and the odd note out of tune
  upright: { name: 'Upright piano', B: 1.7, detune: 3.2, mistune: 7, sustain: 0.62, tilt: 1.25, strike: 0.125, hammer: 1.2,
    body: [['lowshelf', 160, 0, -5], ['peaking', 430, 1.0, 5], ['peaking', 1200, 1.4, 2], ['highshelf', 3800, 0, -7]], gain: 1.15 },
  // the practice-room grand: in tune, warmer
  grand: { name: 'Grand piano', B: 1.05, detune: 1.1, mistune: 1.2, sustain: 0.95, tilt: 1.0, strike: 0.12, hammer: 1.0,
    body: [['lowshelf', 140, 0, 1.5], ['peaking', 600, 1.0, 1], ['highshelf', 5000, 0, -2]], gain: 1.0 },
  // the Steinway in Denis Arnold Hall: full bass, long sustain, bright and even
  steinway: { name: 'Steinway grand', B: 0.85, detune: 0.7, mistune: 0.3, sustain: 1.3, tilt: 0.88, strike: 0.118, hammer: 0.9,
    body: [['lowshelf', 120, 0, 3.5], ['peaking', 2600, 0.8, 2], ['highshelf', 7000, 0, 1]], gain: 0.95 },
};
const DAMPER_TOP = 89;                // no dampers above F6
const SR = 22050;                     // note buffers (partials are capped well below Nyquist)

function hash(a) { let x = Math.sin(a * 91.345 + 17.17) * 43758.5453; return x - Math.floor(x); }

/** Parameters for one note on one instrument (pure). */
export function noteParams(midi, instName) {
  const I = INSTRUMENTS[instName] || INSTRUMENTS.grand;
  const mist = (hash(midi * 3.1 + instName.length) - 0.5) * 2 * I.mistune;
  const f0 = midiFreq(midi) * Math.pow(2, mist / 1200);
  const B = Math.min(0.004, Math.max(2e-5, 1.1e-4 * Math.pow(2, (midi - 60) / 17))) * I.B;
  const tau2 = 9.5 * Math.pow(2, -((midi - 21) / 87) * 3.7) * I.sustain;     // aftersound time constant (s)
  const nStr = midi < 33 ? 1 : midi < 47 ? 2 : 3;
  const kMax = Math.round(Math.min(44, Math.max(5, 46 - (midi - 21) * 0.47)));
  const len = Math.min(7.5, 2.2 * tau2 + 0.7);
  return { I, f0, B, tau2, nStr, kMax, len, mist };
}

/** Incremental renderer for one note: step(n) renders up to n samples; done when finished. */
export class NoteRenderer {
  constructor(midi, instName, sr = SR) {
    const P = (this.P = noteParams(midi, instName));
    this.midi = midi; this.inst = instName; this.sr = sr;
    this.N = Math.ceil(P.len * sr); this.data = new Float32Array(this.N); this.pos = 0; this.done = false;
    // components: partial k on string s
    const comps = [], nyq = Math.min(9800, sr * 0.45), I = P.I;
    for (let k = 1; k <= P.kMax; k++) {
      const fk = k * P.f0 * Math.sqrt(1 + P.B * k * k);
      if (fk >= nyq) break;
      const strike = Math.abs(Math.sin(Math.PI * k * I.strike)) + 0.02;
      const tilt = Math.exp(-(k - 1) * 0.11 * I.tilt * (0.6 + (midi - 21) / 70)) / Math.pow(k, 0.55);
      const amp = strike * tilt;
      const t2 = P.tau2 / (1 + 1.35 * (fk / 1000) * (0.4 + k * 0.08));
      const t1 = Math.max(0.03, t2 * 0.16);
      const strs = k <= 14 ? P.nStr : 1;
      for (let s = 0; s < strs; s++) {
        const cents = s === 0 ? 0 : (s === 1 ? 1 : -0.8) * I.detune * (0.6 + hash(midi * 7 + s * 13) * 0.8);
        const f = fk * Math.pow(2, cents / 1200);
        const w = (2 * Math.PI * f) / sr;
        const ph = hash(midi * 11 + k * 5 + s) * 2 * Math.PI;
        comps.push({ cr: Math.cos(w), sr: Math.sin(w), c: Math.cos(ph), s: Math.sin(ph), a: amp / strs, d1: Math.exp(-1 / (t1 * sr)), d2: Math.exp(-1 / (t2 * sr)), e1: 1, e2: 1 });
      }
    }
    this.comps = comps;
    this.attack = Math.floor(0.0015 * sr);
    this.fade0 = Math.floor(this.N * 0.82);
    this.peak = 0;
  }
  /** cost of the whole note in component-samples (for scheduling) */
  get cost() { return this.comps.length * this.N; }
  step(maxSamples) {
    if (this.done) return true;
    const end = Math.min(this.N, this.pos + maxSamples), D = this.data, C = this.comps, nc = C.length;
    for (let j = 0; j < nc; j++) {
      const q = C[j]; let c = q.c, s = q.s, e1 = q.e1, e2 = q.e2;
      const cr = q.cr, sr = q.sr, d1 = q.d1, d2 = q.d2, a = q.a;
      for (let i = this.pos; i < end; i++) {
        const nc2 = c * cr - s * sr; s = c * sr + s * cr; c = nc2;
        e1 *= d1; e2 *= d2;
        D[i] += a * s * (0.68 * e1 + 0.32 * e2);
      }
      const r = 1 / Math.sqrt(c * c + s * s); q.c = c * r; q.s = s * r; q.e1 = e1; q.e2 = e2;
    }
    this.pos = end;
    if (end >= this.N) this._finish();
    return this.done;
  }
  _finish() {
    const D = this.data, N = this.N;
    for (let i = 0; i < this.attack; i++) D[i] *= i / this.attack;
    for (let i = this.fade0; i < N; i++) { const x = (N - i) / (N - this.fade0); D[i] *= x * x; }
    let pk = 0; const look = Math.min(N, Math.floor(this.sr * 0.25));
    for (let i = 0; i < look; i++) { const v = Math.abs(D[i]); if (v > pk) pk = v; }
    const u = (this.midi - 62) / 46;
    const g = pk > 0 ? (0.55 * (1 - 0.3 * u * u) * this.P.I.gain) / pk : 0;
    for (let i = 0; i < N; i++) D[i] *= g;
    this.peak = pk; this.done = true; this.comps = null;
  }
  renderAll() { while (!this.step(1 << 16)); return this.data; }
}

/** Impulse response for a room: stereo decaying noise, high frequencies dying faster. */
export function makeIR(ctx, rt60, predelay = 0.01, bright = 0.5) {
  const sr = ctx.sampleRate, n = Math.floor(sr * (rt60 * 1.1 + predelay)), buf = ctx.createBuffer(2, n, sr);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch), p0 = Math.floor(predelay * sr);
    let lp = 0;
    for (let i = p0; i < n; i++) {
      const t = (i - p0) / sr, env = Math.pow(10, (-3 * t) / rt60);
      const k = Math.min(0.95, 0.15 + (1 - bright) * 0.5 + t / rt60 * 0.7);   // one-pole LP coefficient grows with time
      lp = lp * k + rnd() * (1 - k);
      d[i] = lp * env * (1.4 + t * 2);
    }
    // a few early reflections
    for (let r = 0; r < 6; r++) { const i = p0 + Math.floor(sr * (0.004 + r * 0.0067 + ch * 0.0011)); if (i < n) d[i] += (r % 2 ? -0.5 : 0.55) * (1 - r * 0.12); }
  }
  return buf;
}

export class PianoEngine {
  constructor(audio) {
    this.audio = audio; this.ctx = null; this.cache = new Map(); this.jobs = [];
    this.voices = []; this.maxVoices = 32; this.pedal = false; this.inst = 'upright'; this.room = 'room';
    this.muffledVoices = []; this.remoteVoices = [];
  }
  /** lazily build the audio graph (needs game.audio.start() to have happened) */
  ready() {
    const A = this.audio;
    if (!A || !A.ctx) return false;
    if (this.ctx) return true;
    const ctx = (this.ctx = A.ctx);
    this.out = ctx.createGain(); this.out.gain.value = 0.9; this.out.connect(A.master);
    this.irs = { room: makeIR(ctx, 0.55, 0.004, 0.45), hall: makeIR(ctx, 1.75, 0.018, 0.55), corridor: makeIR(ctx, 0.9, 0.006, 0.3) };
    this.conv = ctx.createConvolver(); this.conv.buffer = this.irs.room;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.22; this.conv.connect(this.wet); this.wet.connect(this.out);
    this.buses = {};
    for (const k of Object.keys(INSTRUMENTS)) {
      const input = ctx.createGain(); let node = input;
      for (const [type, f, q, g] of INSTRUMENTS[k].body) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; b.gain.value = g; node.connect(b); node = b; }
      const dry = ctx.createGain(); dry.gain.value = 1; node.connect(dry); dry.connect(this.out);
      const send = ctx.createGain(); send.gain.value = 1; node.connect(send); send.connect(this.conv);
      this.buses[k] = { input, send };
    }
    // muffled (through a practice-room door): steep low-pass, then the corridor reverb
    this.muffle = ctx.createGain(); this.muffle.gain.value = 0;
    const m1 = ctx.createBiquadFilter(); m1.type = 'lowpass'; m1.frequency.value = 520; m1.Q.value = 0.5;
    const m2 = ctx.createBiquadFilter(); m2.type = 'lowpass'; m2.frequency.value = 900; m2.Q.value = 0.3;
    const mconv = ctx.createConvolver(); mconv.buffer = this.irs.corridor;
    const mwet = ctx.createGain(); mwet.gain.value = 0.5;
    this.muffle.connect(m1); m1.connect(m2); m2.connect(this.out); m2.connect(mconv); mconv.connect(mwet); mwet.connect(this.out);
    this.muffleIn = ctx.createGain(); this.muffleIn.connect(this.muffle);
    // shared hammer-noise click
    const hn = Math.floor(ctx.sampleRate * 0.04); this.hammerBuf = ctx.createBuffer(1, hn, ctx.sampleRate);
    const hd = this.hammerBuf.getChannelData(0); let s = 7;
    for (let i = 0; i < hn; i++) { s = (s * 16807) % 2147483647; hd[i] = (s / 1073741823 - 1) * Math.exp(-i / (ctx.sampleRate * 0.0045)); }
    return true;
  }
  setInstrument(name) { this.inst = INSTRUMENTS[name] ? name : 'grand'; }
  setRoom(room) {
    if (!this.ready()) return;
    if (this.room === room) return; this.room = room;
    this.conv.buffer = this.irs[room] || this.irs.room;
    this.wet.gain.setTargetAtTime(room === 'hall' ? 0.34 : 0.2, this.ctx.currentTime, 0.1);
  }
  /** queue notes to be rendered in the background (most urgent first) */
  warm(midis, inst = this.inst) {
    for (const m of midis) { const k = inst + ':' + m; if (!this.cache.has(k) && !this.jobs.some((j) => j.key === k)) this.jobs.push({ key: k, r: null, midi: m, inst }); }
  }
  /** spend up to `ms` milliseconds rendering queued notes */
  pump(ms = 3) {
    if (!this.jobs.length || !this.ctx) return;
    const t0 = performance.now();
    while (this.jobs.length && performance.now() - t0 < ms) {
      const j = this.jobs[0];
      if (this.cache.has(j.key)) { this.jobs.shift(); continue; }
      if (!j.r) j.r = new NoteRenderer(j.midi, j.inst);
      if (j.r.step(4096)) { this._store(j.key, j.r); this.jobs.shift(); }
    }
  }
  _store(key, r) {
    const b = this.ctx.createBuffer(1, r.N, r.sr); b.getChannelData(0).set(r.data);
    this.cache.set(key, b);
    if (this.cache.size > 150) { const first = this.cache.keys().next().value; this.cache.delete(first); }
  }
  buffer(midi, inst) {
    const key = inst + ':' + midi;
    let b = this.cache.get(key);
    if (b) { this.cache.delete(key); this.cache.set(key, b); return b; }   // LRU touch
    const ji = this.jobs.findIndex((j) => j.key === key);
    const r = ji >= 0 && this.jobs[ji].r ? this.jobs[ji].r : new NoteRenderer(midi, inst);
    if (ji >= 0) this.jobs.splice(ji, 1);
    r.renderAll(); this._store(key, r);
    return this.cache.get(key);
  }

  /** strike a note. opts: {inst, muffled, remote, gain, when}. Returns the voice. */
  noteOn(midi, vel = 0.65, opts = {}) {
    if (!this.ready()) return null;
    const ctx = this.ctx, inst = opts.inst || this.inst, t = ctx.currentTime + (opts.when || 0);
    const pool = opts.muffled ? this.muffledVoices : opts.remote ? this.remoteVoices : this.voices;
    const cap = opts.muffled ? 10 : opts.remote ? 16 : this.maxVoices;
    // re-striking a sounding string: the old voice is choked quickly
    for (const v of pool.slice()) if (v.midi === midi && !v.dead) this._kill(v, t, 0.04);
    while (pool.length >= cap) this._kill(pool.find((v) => v.released) || pool[0], t, 0.025);
    const f0 = midiFreq(midi), v = Math.max(0.05, Math.min(1, vel));
    const src = ctx.createBufferSource(); src.buffer = this.buffer(midi, inst);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.35;
    const open = Math.min(15000, Math.max(250, f0 * (1.3 + 30 * v * v))), closed = Math.min(open, Math.max(220, f0 * (1.6 + 5 * v)));
    lp.frequency.setValueAtTime(open, t); lp.frequency.setTargetAtTime(closed, t + 0.02, 0.35 + 1.2 * (1 - (midi - 21) / 87));
    const g = ctx.createGain(); const lvl = (0.06 + 0.94 * Math.pow(v, 1.7)) * (opts.gain ?? 1);
    g.gain.setValueAtTime(lvl, t);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(lp); lp.connect(g);
    let dest = opts.muffled ? this.muffleIn : this.buses[inst].input;
    if (pan && !opts.muffled) { pan.pan.value = Math.max(-0.6, Math.min(0.6, (midi - 64) / 70)); g.connect(pan); pan.connect(dest); } else g.connect(dest);
    src.start(t); src.stop(t + src.buffer.duration);
    // hammer: a short filtered knock, louder and brighter with velocity
    if (!opts.muffled || v > 0.5) {
      const hs = ctx.createBufferSource(); hs.buffer = this.hammerBuf;
      const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = Math.min(5000, 400 + f0 * 2.2 + v * 1500); hf.Q.value = 0.9;
      const hg = ctx.createGain(); hg.gain.value = 0.28 * v * v * INSTRUMENTS[inst].hammer * (opts.gain ?? 1) * (midi > 84 ? 1.4 : 1);
      hs.connect(hf); hf.connect(hg); hg.connect(dest); hs.start(t);
    }
    const voice = { midi, src, g, lp, pan, t0: t, held: true, released: false, dead: false, inst, pool };
    if (opts.dur) {   // pre-scheduled release (sequenced/muffled playback)
      const te = t + opts.dur, tau = 0.08 + 0.15 * Math.max(0, (60 - midi) / 40);
      g.gain.setTargetAtTime(0, te, tau); try { src.stop(Math.min(t + src.buffer.duration, te + tau * 7)); } catch { /* */ }
      voice.held = false; voice.released = true;
    }
    src.onended = () => { voice.dead = true; const i = pool.indexOf(voice); if (i >= 0) pool.splice(i, 1); try { g.disconnect(); if (pan) pan.disconnect(); } catch { /* */ } };
    pool.push(voice);
    return voice;
  }
  noteOff(midi, opts = {}) {
    if (!this.ctx) return;
    const pool = opts.muffled ? this.muffledVoices : opts.remote ? this.remoteVoices : this.voices;
    const ped = opts.remote ? !!opts.pedal : opts.muffled ? false : this.pedal;
    for (const v of pool) if (v.midi === midi && v.held && !v.dead) { v.held = false; if (!ped) this._release(v); }
  }
  setPedal(down, opts = {}) {
    if (!this.ready()) return;
    if (opts.remote) { if (!down) for (const v of this.remoteVoices) if (!v.held && !v.released) this._release(v); return; }
    this.pedal = down;
    const t = this.ctx.currentTime;
    // open dampers let the strings resonate: a touch more room
    this.wet.gain.setTargetAtTime((this.room === 'hall' ? 0.34 : 0.2) * (down ? 1.35 : 1), t, 0.15);
    if (!down) for (const v of this.voices) if (!v.held && !v.released) this._release(v);
  }
  _release(v) {
    if (v.released || v.dead) return;
    v.released = true;
    if (v.midi >= DAMPER_TOP) return;             // undamped treble rings on
    const t = this.ctx.currentTime, tau = 0.05 + 0.22 * Math.max(0, (60 - v.midi) / 40) + 0.03;
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.setTargetAtTime(0, t, tau);
    try { v.src.stop(t + tau * 7); } catch { /* */ }
  }
  _kill(v, t, tau) {
    if (v.dead) return;
    v.dead = true; v.released = true;
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.setTargetAtTime(0, t, tau);
    try { v.src.stop(t + tau * 6); } catch { /* */ }
    const i = v.pool.indexOf(v); if (i >= 0) v.pool.splice(i, 1);
  }
  allOff() { if (!this.ctx) return; const t = this.ctx.currentTime; for (const p of [this.voices, this.remoteVoices]) for (const v of p.slice()) this._kill(v, t, 0.08); this.pedal = false; }
  setMuffle(level) { if (!this.ready()) return; this.muffle.gain.setTargetAtTime(level, this.ctx.currentTime, 0.12); }
  muffledOff() { if (!this.ctx) return; const t = this.ctx.currentTime; for (const v of this.muffledVoices.slice()) this._kill(v, t, 0.1); this.setMuffle(0); }
  get active() { return this.voices.length + this.remoteVoices.length + this.muffledVoices.length; }

  // ------------------------------------------------------------------------- incidental sounds
  _noise(dur, { f = 1000, q = 1, type = 'bandpass', gain = 0.3, when = 0, decay = dur / 4, dest = null } = {}) {
    const ctx = this.ctx, t = ctx.currentTime + when, n = Math.ceil(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
    const s = ctx.createBufferSource(); s.buffer = b; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(dest || this.out); s.start(t);
  }
  click(accent, when = 0) {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(accent ? 0.14 : 0.09, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = accent ? 2400 : 1800; f.Q.value = 2;
    o.connect(f); f.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.05);
  }
  /** neighbour banging on the wall: three dull thumps through plaster */
  wallKnock() {
    if (!this.ready()) return;
    for (let i = 0; i < 3; i++) {
      const w = i * 0.28 + (i === 2 ? 0.05 : 0);
      this._noise(0.18, { f: 110, q: 1.2, gain: 1.6, when: w, decay: 0.035 });
      const ctx = this.ctx, t = ctx.currentTime + w, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.2);
    }
  }
  /** knuckles on a wooden door */
  doorKnock(n = 3) { if (!this.ready()) return; for (let i = 0; i < n; i++) this._noise(0.09, { f: 700 + i * 30, q: 3, gain: 1.2, when: i * 0.19, decay: 0.012 }); }
  /** a corridor full of music students clapping, slightly muffled */
  applause(secs = 4.5, n = 70) {
    if (!this.ready()) return;
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * 0.03), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    const bus = ctx.createBiquadFilter(); bus.type = 'lowpass'; bus.frequency.value = 2600; const g = ctx.createGain(); g.gain.value = 0.5; bus.connect(g); g.connect(this.out); g.connect(this.conv);
    for (let i = 0; i < n; i++) {
      const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = 0.7 + Math.random() * 0.7;
      const at = ctx.currentTime + Math.pow(Math.random(), 1.3) * secs;
      const sg = ctx.createGain(); sg.gain.value = 0.4 + Math.random() * 0.6 * (1 - (at - ctx.currentTime) / secs);
      s.connect(sg); sg.connect(bus); s.start(at);
    }
  }
}
