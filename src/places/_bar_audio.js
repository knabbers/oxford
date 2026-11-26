// Cellar Bar sound: crowd murmur and glasses, the jukebox (original band-style tunes, core/_groove_tracks.js JUKEBOX,
// at background level through a small-speaker low-pass), the bop (the club tracks, louder), darts/pool effects and the
// darts caller. Everything is WebAudio synthesis through game.audio (no files, no real songs).
// The jukebox plays by itself in the evening (17:00–01:00) on the shared clock, so everyone in the bar hears the same
// tune; 50p queues a tune from the next 8-bar line for everybody ('barjuke' net event).
import { Groove, SetPlayer, prepare } from '../core/_groove.js';
import { CLUB, JUKEBOX } from '../core/_groove_tracks.js';
import { coins } from '../systems/_object_audio.js';

export const TUNES = JUKEBOX.map(prepare);
const BOP_TRACKS = CLUB.map(prepare);
export const JUKE_LEVEL = 0.2, BOP_LEVEL = 0.62;

export class BarAudio {
  constructor(game) {
    this.game = game; this.groove = null; this.murmur = null; this.crowd = 0; this._mt = 0;
    this.active = false; this.mode = null;          // null | 'juke' | 'bop'
    this.bop = false; this._timer = null; this._lc = 0; this._tone = ''; this.manualUntil = 0;
    const shared = () => this.game.time.now() / 1000, clock = () => this.clock;
    this.juke = new SetPlayer({ tracks: TUNES, shared, clock, epoch: 1000, onStep: (T, s, w, sp) => this._step('juke', T, s, w, sp) });
    this.bopSet = new SetPlayer({ tracks: BOP_TRACKS, shared, clock, epoch: 7777, onStep: (T, s, w, sp) => this._step('bop', T, s, w, sp) });
    const net = game.net;
    if (net && net.on) net.on('barjuke', (d) => { if (d && Number.isFinite(d.i) && Number.isFinite(d.t0)) this._request(d.i, d.t0); });
  }
  /** the darts caller speaks when characters' voices are on (the Esc screen's sound panel); otherwise the score shows as a bubble. No key. */
  get speech() { const v = this.game && this.game.voice; return !v || v.enabled !== false; }
  get A() { return this.game.audio; }
  get ctx() { return this.game.audio.ctx; }
  get clock() { const c = this.ctx; return c ? c.currentTime : this._lc; }
  /** the bop's beat, for the lights */
  get beatPhase() { const b = this.bopSet.beat(); return b - Math.floor(b); }

  // ---------------------------------------------------------------- crowd murmur
  startMurmur() {
    this.active = true; this._run(true);
    const A = this.A, ctx = this.ctx; if (!ctx || this.murmur) return;
    // the shared brown noise through two speech-band filters, wobbling at syllable rate
    const src = ctx.createBufferSource(); src.buffer = A.brownBuf; src.loop = true;
    const out = ctx.createGain(); out.gain.value = 0;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 420; f1.Q.value = 0.9;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 1.2;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    const am = ctx.createGain(); am.gain.value = 0.7; const lfo = ctx.createOscillator(); lfo.frequency.value = 3.1; const lg = ctx.createGain(); lg.gain.value = 0.3; lfo.connect(lg); lg.connect(am.gain);
    src.connect(f1); src.connect(f2); f2.connect(g2); f1.connect(am); g2.connect(am); am.connect(out); out.connect(A.ambience || A.master);
    src.start(); lfo.start();
    this.murmur = { src, lfo, out };
  }
  setCrowd(n) { this.crowd = n; }
  stopAll() {
    this.active = false; this._run(false);
    if (this.murmur) { const m = this.murmur; this.murmur = null; try { const t = this.ctx.currentTime; m.out.gain.setTargetAtTime(0, t, 0.15); m.src.stop(t + 0.9); m.lfo.stop(t + 0.9); m.src.onended = () => { try { m.out.disconnect(); } catch { /* */ } }; } catch { /* */ } }
    this.bop = false; this._apply();
  }

  // ---------------------------------------------------------------- music (jukebox / bop)
  /** play(n): queue jukebox tune n (for everyone); play('bop'): the DJ takes over. Returns the tune's name. */
  play(tune) {
    if (tune === 'bop') { this.bop = true; this._apply(); return 'Bop'; }
    const i = typeof tune === 'number' ? tune : Math.max(0, TUNES.indexOf(tune));
    const t0 = this._request(i, null), net = this.game.net;
    if (net && net.connected && net.send) net.send('barjuke', { i: this.juke.override.ti, t0 });
    return TUNES[this.juke.override.ti].name;
  }
  _request(i, t0) {
    t0 = this.juke.request(i, t0);
    this.manualUntil = t0 + TUNES[this.juke.override.ti].dur;      // a paid-for tune plays even in the afternoon
    return t0;
  }
  /** what the jukebox (or the DJ) is playing, or null */
  get playing() { return this.mode === 'bop' ? 'Bop' : this.mode === 'juke' ? this.juke.track.name : null; }
  stopMusic() { this.bop = false; this._apply(); }
  /** the jukebox is on by itself from late afternoon until closing */
  jukeOn() { const h = this.game.time.hour, now = this.game.time.now() / 1000; return h >= 17 || h < 1 || now < this.manualUntil; }
  _apply() {
    const want = !this.active ? null : this.bop ? 'bop' : this.jukeOn() ? 'juke' : null;
    if (want !== this.mode) { this.mode = want; this._tone = ''; }
    const g = this.groove; if (!g) return;
    const key = String(this.mode);
    if (key !== this._tone) {
      this._tone = key;
      if (this.mode === 'bop') g.setTone(15000, BOP_LEVEL, 0.5);
      else if (this.mode === 'juke') g.setTone(5200, JUKE_LEVEL, 0.5);          // a wall-mounted jukebox speaker
      else g.setTone(3000, 0, 0.3);
    }
  }
  /** schedule the next 0.4 s of whatever is playing (a 10 Hz timer calls this; tools call it on an offline context) */
  pump() { if (this.mode === 'bop') this.bopSet.tick(0.4); else if (this.mode === 'juke') this.juke.tick(0.4); }
  _run(on) {
    const A = this.A;
    if (A && A.offline) return;
    if (on && !this._timer && typeof setInterval === 'function') {
      this._timer = setInterval(() => {
        const B = this.A, hidden = typeof document !== 'undefined' && document.hidden;
        if (hidden || (B && B.ctx && !B.running)) return;      // nothing is scheduled while the tab is hidden / suspended
        this.pump();
      }, 100);
    } else if (!on && this._timer) { clearInterval(this._timer); this._timer = null; }
  }
  _step(which, T, step, when, sp) {
    const g = this.groove; if (!g || this.mode !== which) return;
    g.mix.gain.setValueAtTime(T.gain || 1, Math.max(when, g.ctx.currentTime));
    g.step(T, step, when, sp, false);
  }
  update(dt) {
    const A = this.A, ctx = this.ctx;
    if (!ctx) { this._lc += dt; return; }
    if (this.active && !this.groove) this.groove = new Groove(A, A.music);
    if (this.active && !this.murmur) this.startMurmur();
    this._apply();
    if (this.murmur) {
      this._mt -= dt;
      if (this._mt <= 0) { this._mt = 0.3 + Math.random() * 0.6; const lvl = Math.min(1, this.crowd / 9) * (0.08 + Math.random() * 0.04) * (this.mode === 'bop' ? 0.6 : 1); this.murmur.out.gain.setTargetAtTime(lvl, ctx.currentTime, 0.4); }
      if (this.crowd > 2 && Math.random() < dt * 0.15) this.clink();
    }
  }

  // ---------------------------------------------------------------- effects
  clink() { const A = this.A, p = Math.random() * 1.2 - 0.6; A.tone(3200 + Math.random() * 800, 0.08, { gain: 0.012, pan: p }); A.tone(4700, 0.05, { gain: 0.006, when: 0.03, pan: p }); }
  // darts (all synthesised): the dart into sisal (k < 1: into the soft surround), the ping of a wire and the dart
  // dropping, a dart into the wall, the whisper of the throw, a dart pulled out, a dart landing on the flagstones
  thunk(k = 1) { const A = this.A; A.noise(0.07, { gain: 0.35 * k, freq: 380, q: 0.7, type: 'lowpass' }); A.tone(150, 0.06, { type: 'triangle', gain: 0.15 * k }); A.noise(0.03, { gain: 0.08 * k, freq: 2500, q: 2 }); }
  bounceOut() { const A = this.A; A.tone(3100, 0.09, { gain: 0.07 }); A.tone(4650, 0.06, { gain: 0.04 }); A.noise(0.05, { gain: 0.1, freq: 900, q: 1 }); }
  dartWall() { const A = this.A; A.noise(0.05, { gain: 0.2, freq: 1300, q: 1.2 }); A.tone(420, 0.04, { type: 'triangle', gain: 0.08 }); }
  dartFloor() { const A = this.A; for (let i = 0; i < 3; i++) A.tone(2300 + i * 500, 0.03, { gain: 0.05 - i * 0.012, when: i * 0.07 }); A.noise(0.04, { gain: 0.06, freq: 3000, q: 1.5 }); }
  swish() { this.A.noise(0.12, { gain: 0.035, freq: 2600, q: 0.5 }); }
  pluck() { const A = this.A; A.noise(0.05, { gain: 0.1, freq: 700, q: 1.2 }); A.tone(240, 0.04, { type: 'triangle', gain: 0.05 }); }
  /** crowd "ooh" (vowel formants on detuned saws) */
  ooh(big = false) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, out = ctx.createGain(); out.gain.value = 0; out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(big ? 0.12 : 0.07, t + 0.15); out.gain.exponentialRampToValueAtTime(0.001, t + (big ? 1.6 : 1.0)); out.gain.linearRampToValueAtTime(0, t + 1.68);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 420; f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 850; f2.Q.value = 4;
    f1.connect(out); f2.connect(out); out.connect(this.A.master);
    for (let i = 0; i < 6; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; const base = 140 + Math.random() * 120;
      o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * (big ? 1.35 : 1.15), t + 0.35); o.frequency.linearRampToValueAtTime(base * 0.95, t + 1.2);
      o.connect(f1); o.connect(f2); o.start(t + Math.random() * 0.08); o.stop(t + 1.7);
      if (i === 0) o.onended = () => { try { out.disconnect(); } catch { /* */ } };
    }
    if (big) this.A.noise(1.6, { gain: 0.12, freq: 1800, q: 0.4 });
  }
  /** "One hundred and EIGHTY" cheer */
  cheer() { this.ooh(true); const A = this.A; for (let i = 0; i < 10; i++) A.noise(0.08, { gain: 0.06, freq: 2500, q: 2, when: 0.4 + i * 0.09 + Math.random() * 0.05 }); }
  caller(kind = 'score') {
    const A = this.A;
    // (2026-11-23: no more square-wave fanfares for a 180, a bust, a win or a score — a pub has none; the crowd's
    //  cheer() and the caller's words are the sound of it)
    void A; void kind;
  }
  say(text) {
    if (!this.speech) return;
    if (this.game.voice) { this.game.voice.say('darts_caller', text, { interrupt: true }); return; }   // rendered clip / live fallback (core/voice.js)
    try {
      const s = window.speechSynthesis; if (!s) return;
      s.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/!/g, '')); u.lang = 'en-GB'; u.rate = 0.92; u.pitch = 0.75;
      const v = s.getVoices().find((x) => /en-GB/i.test(x.lang)); if (v) u.voice = v;
      s.speak(u);
    } catch { /* speech not available */ }
  }
  // pool (all synthesised): the tip on the white, phenolic balls clicking, the thud of a cushion (a rattle in the jaws
  // is sharper), a ball dropping into the pocket and running down the return, the rack going down, a foul
  ballClick(speed) { const A = this.A, g = Math.min(0.3, 0.015 + speed * 0.055), f = 2900 + Math.random() * 700; A.tone(f, 0.022, { gain: g }); A.tone(f * 1.52, 0.014, { gain: g * 0.55 }); A.noise(0.012, { gain: g * 0.7, freq: 5200, q: 0.8 }); }
  cushion(speed, jaw = false) { const A = this.A, g = Math.min(0.22, speed * 0.055); A.noise(0.09, { gain: g, freq: jaw ? 520 : 240, q: 0.8, type: 'lowpass' }); A.tone(jaw ? 210 : 105, 0.07, { type: 'triangle', gain: g * 0.6 }); }
  pocket() { const A = this.A; A.tone(110, 0.14, { type: 'triangle', gain: 0.13 }); A.noise(0.08, { gain: 0.1, freq: 420, q: 1, type: 'lowpass' }); for (let i = 0; i < 5; i++) A.noise(0.05, { gain: 0.035 - i * 0.005, freq: 900 - i * 90, q: 2, when: 0.16 + i * 0.07 }); A.tone(180, 0.09, { type: 'triangle', gain: 0.07, when: 0.55 }); }
  cueHit(p) { const A = this.A; A.noise(0.03, { gain: 0.07 + p * 0.16, freq: 1700, q: 1.1 }); A.tone(620 + p * 240, 0.028, { gain: 0.05 + p * 0.08 }); A.tone(180, 0.04, { type: 'triangle', gain: 0.03 + p * 0.05 }); }
  rack() { const A = this.A; A.noise(0.5, { gain: 0.07, freq: 700, q: 0.6 }); for (let i = 0; i < 9; i++) A.tone(2600 + Math.random() * 900, 0.02, { gain: 0.05, when: 0.05 + i * 0.05 + Math.random() * 0.03 }); A.tone(140, 0.1, { type: 'triangle', gain: 0.09, when: 0.55 }); }
  foul() { /* (was a two-note "wrong" tone: a pool table has none, 2026-11-23) */ }
  frame() { /* (was a three-note arpeggio for the frame won) */ }
  sip() { this.A.noise(0.25, { gain: 0.03, freq: 900, q: 0.6 }); }
  coin() { coins(this.A); }      // (coins on the counter / into the table's slot: it was a two-note square-wave bing)
}
