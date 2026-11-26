// May Morning — sound. WebAudio synthesis only, through core/audio.js buses; no samples, no recordings.
//   choir     each note of the four parts is a pair of slightly detuned oscillators through a bank of vowel formants
//             ("ah" for the men, a rounder, straighter tone for the trebles) into a short feedback-delay "open air"
//   bells     struck-bell partials (hum, prime, tierce, quint, nominal) with their own decays; the hour bell is lower
//   crowd     a murmur bed that falls silent for the singing, cheers and applause after
//   morris    an original jig on a reedy melodeon (or a fiddle), bass and off-beat chords, ankle bells on every step and
//             a stick clack where the dancers' sticks meet — every note placed on the SHARED clock
// All timing comes from the caller (when = AudioContext time). Envelope gains start at 0. The only randomness is hash().
import { hash, jigNotes, clackOn, JIG, BELLS } from './_mm_rules.js';

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// formants [freq, Q, gain]
const AH = [[720, 5, 1], [1180, 6, 0.6], [2650, 7, 0.28]], OO = [[430, 4, 1], [860, 5, 0.42], [2700, 7, 0.2]];

export class MmAudio {
  constructor(audio) { this.audio = audio; this.voices = 0; this.ch = null; this.crowd = null; this.mor = null; this.lastBeat = -1; this._jn = []; }
  get ctx() { return this.audio.ctx; }
  _done(src, ...nodes) { this.voices++; src.onended = () => { this.voices--; for (const n of nodes) { try { n && n.disconnect(); } catch { /* */ } } }; }
  _bus(dest) { const c = this.ctx, g = c.createGain(); g.gain.value = 0; const sp = this.audio.steered ? this.audio.steered(dest) : null, p = sp || (c.createStereoPanner ? c.createStereoPanner() : null); if (sp) g.connect(sp.in); else if (p) { g.connect(p); p.connect(dest); } else g.connect(dest); return { g, p }; }
  _kill(B, extra = []) { const c = this.ctx; B.g.gain.setTargetAtTime(0, c.currentTime, 0.2); setTimeout(() => { for (const n of [B.g, B.p, ...extra]) { try { n && n.disconnect(); } catch { /* */ } } }, 3500); }

  // ---------------------------------------------------------------------------------------------- choir
  /** call every slow tick while the choir may be heard: level 0 = tear the bus down. dist dulls it (air takes the top off). */
  setChoir(gain, pan, dist = 0) {
    const c = this.ctx; if (!c) return;
    if (gain <= 0.0015) { if (this.ch) { const C = this.ch; this.ch = null; this._kill(C, [C.inA, C.inO, C.lp, C.dry, ...C.fx]); } return; }
    if (!this.ch) {
      const B = this._bus(this.audio.music), inA = c.createGain(), inO = c.createGain(), lp = c.createBiquadFilter(), dry = c.createGain(), fx = [];
      lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.3; dry.gain.value = 1;
      for (const [bank, input] of [[AH, inA], [OO, inO]]) for (const [f, q, g] of bank) { const b = c.createBiquadFilter(), bg = c.createGain(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; bg.gain.value = g; input.connect(b); b.connect(bg); bg.connect(lp); fx.push(b, bg); }
      // a little of the fundamental straight through, or small speakers lose the basses
      const thru = c.createGain(); thru.gain.value = 0.26; inA.connect(thru); inO.connect(thru); thru.connect(lp); fx.push(thru);
      lp.connect(dry); dry.connect(B.g);
      // the open air: three feedback delays (the sound off the street's fronts)
      for (const [dt, fb] of [[0.097, 0.3], [0.151, 0.26], [0.223, 0.2]]) { const d = c.createDelay(0.5), g = c.createGain(), f = c.createBiquadFilter(); d.delayTime.value = dt; g.gain.value = fb; f.type = 'lowpass'; f.frequency.value = 2400; lp.connect(d); d.connect(f); f.connect(g); g.connect(d); f.connect(B.g); fx.push(d, g, f); }
      this.ch = { ...B, inA, inO, lp, dry, fx };
    }
    const t = c.currentTime, C = this.ch;
    C.g.gain.setTargetAtTime(gain, t, 0.25); if (C.p) C.p.pan.setTargetAtTime(pan, t, 0.3);
    C.lp.frequency.setTargetAtTime(Math.max(1500, 6500 / (1 + dist / 260)), t, 0.4);
  }
  /** one sung note: voice 0 treble, 1 alto, 2 tenor, 3 bass; quick = madrigal (lighter, detached) */
  sing(when, midi, dur, voice, quick = false) {
    const c = this.ctx, C = this.ch; if (!c || !C) return;
    const f = hz(midi), g = c.createGain(), pk = [0.2, 0.15, 0.15, 0.2][voice] * (quick ? 0.9 : 1), at = quick ? 0.035 : 0.11, rel = quick ? 0.07 : 0.22, end = when + Math.max(at + 0.04, dur * (quick ? 0.86 : 0.97));
    g.gain.value = 0; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(pk, when + at); g.gain.setValueAtTime(pk * 0.92, end); g.gain.linearRampToValueAtTime(0, end + rel);
    g.connect(voice === 0 ? C.inO : C.inA); if (voice === 1) g.connect(C.inO);
    const os = [];
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator(); o.type = voice === 0 && i === 1 ? 'triangle' : 'sawtooth';
      const det = (i ? 1 : -1) * (voice === 0 ? 4 : 7) + (hash(midi, voice * 3 + i) - 0.5) * 6;
      o.frequency.setValueAtTime(f * Math.pow(2, (det - 14) / 1200), when); o.frequency.linearRampToValueAtTime(f * Math.pow(2, det / 1200), when + 0.09);      // voices find the note from just under it
      o.connect(g); o.start(when); o.stop(end + rel + 0.03); os.push(o);
    }
    this._done(os[0], g);
  }

  // ---------------------------------------------------------------------------------------------- bells
  /** bell index 0..9 (treble..tenor) or -1 = the hour bell; dist in metres dulls and softens it */
  bell(when, idx, gain, pan, dist = 0) {
    const c = this.ctx; if (!c || gain <= 0.001) return;
    const hour = idx < 0, f = hz(hour ? 50 : BELLS.midi[idx] - 12), near = 1 / (1 + dist / 500);
    const out = c.createGain(); out.gain.value = gain * (hour ? 0.5 : 0.2 + 0.02 * Math.max(0, idx));
    const p = this.audio.panTo(out, pan, this.audio.ambience);
    // partial: [ratio, level, decay s]
    const parts = hour ? [[0.5, 0.55, 5.5], [1, 0.9, 4.2], [1.19, 0.5, 2.6], [2, 0.45, 1.8], [2.51, 0.16, 1.1]] : [[0.5, 0.35, 2.2], [1, 0.8, 1.5], [1.19, 0.5, 1.0], [2, 0.55, 0.7], [3.01, 0.14 * near + 0.04, 0.4]];
    let first = null;
    for (const [r, lv, dec] of parts) {
      if (r > 2.2 && near < 0.35) continue;                         // far away the top partials are gone
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * r * (1 + (hash(idx + 2, r) - 0.5) * 0.004);
      g.gain.value = 0; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(lv, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0006, when + dec);
      o.connect(g); g.connect(out); o.start(when); o.stop(when + dec + 0.02);
      if (!first) first = o;
    }
    // the clapper's knock
    if (dist < 500) { const s = c.createBufferSource(), bf = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.audio.noiseBuf; bf.type = 'bandpass'; bf.frequency.value = f * 4.2; bf.Q.value = 2; g.gain.value = 0; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.5 * near, when + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, when + 0.05); s.connect(bf); bf.connect(g); g.connect(out); s.start(when, hash(idx, 9) * 2, 0.08); }
    this._done(first, out, p);
  }

  // ---------------------------------------------------------------------------------------------- crowd
  /** the murmur of a few thousand people: level 0..1 (0 = hushed), gain / pan from where it is */
  setCrowd(level, gain, pan) {
    const c = this.ctx; if (!c) return;
    if (gain <= 0.002) { if (this.crowd) { const K = this.crowd; this.crowd = null; K.g.gain.setTargetAtTime(0, c.currentTime, 0.3); for (const s of K.src) { try { s.stop(c.currentTime + 1.5); } catch { /* */ } } setTimeout(() => { for (const n of [K.g, K.p, ...K.nodes]) { try { n && n.disconnect(); } catch { /* */ } } }, 2500); } return; }
    if (!this.crowd) {
      const B = this._bus(this.audio.ambience), src = [], nodes = [];
      for (const [buf, f, q, lv, off] of [[this.audio.brownBuf, 420, 0.7, 1, 0], [this.audio.noiseBuf, 1300, 0.8, 0.1, 0.7], [this.audio.brownBuf, 800, 1.2, 0.5, 1.3]]) {
        const s = c.createBufferSource(), bf = c.createBiquadFilter(), g = c.createGain(); s.buffer = buf; s.loop = true; bf.type = 'bandpass'; bf.frequency.value = f; bf.Q.value = q; g.gain.value = lv;
        s.connect(bf); bf.connect(g); g.connect(B.g); s.start(0, off); src.push(s); nodes.push(bf, g);
      }
      // the babble moves: a slow wobble on the level
      const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 0.37; lg.gain.value = 0; l.connect(lg); lg.connect(B.g.gain); l.start(); src.push(l); nodes.push(lg);
      this.crowd = { ...B, src, nodes, lg };
    }
    const K = this.crowd, t = c.currentTime, v = gain * (0.05 + 0.95 * level) * 0.42;
    K.g.gain.setTargetAtTime(v, t, 0.5); K.lg.gain.setTargetAtTime(v * 0.18, t, 0.5); if (K.p) K.p.pan.setTargetAtTime(pan, t, 0.3);
  }
  /** a cheer: whoops over applause */
  cheer(when, dur, gain, pan, seed = 1) {
    const c = this.ctx; if (!c || gain <= 0.003) return;
    const dest = this.audio.ambience;
    for (const [hzc, k] of [[1500, 1], [2700, 0.8], [700, 0.7]]) {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), n = Math.floor(dur * 20);
      src.buffer = this.audio.noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = hzc; f.Q.value = 0.9;
      g.gain.value = 0; g.gain.setValueAtTime(0, when);
      for (let i = 0; i < n; i++) { const q = i / n, env = Math.sin(Math.min(1, q * 5) * Math.PI / 2) * Math.pow(1 - q, 0.8); g.gain.linearRampToValueAtTime(gain * 0.075 * k * env * (0.45 + 0.55 * hash(seed + i, hzc)), when + (i + 1) * (dur / n)); }
      src.connect(f); f.connect(g); const p = this.audio.panTo(g, pan, dest); src.start(when, hash(seed, hzc) * 2); src.stop(when + dur + 0.1); this._done(src, f, g, p);
    }
    // whoops: rising voices through two formants
    const out = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(); f1.type = f2.type = 'bandpass'; f1.frequency.value = 650; f1.Q.value = 4; f2.frequency.value = 1250; f2.Q.value = 5; out.gain.value = gain * 0.3;
    f1.connect(out); f2.connect(out); const p = this.audio.panTo(out, pan, dest);
    let last = null;
    for (let i = 0; i < 9; i++) {
      const o = c.createOscillator(), g = c.createGain(), t0 = when + hash(seed, i) * dur * 0.55, len = 0.5 + hash(i, seed) * 0.7, base = 170 + hash(seed + 3, i) * 230;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * (1.5 + hash(i, 7) * 0.5), t0 + len * 0.7); o.frequency.exponentialRampToValueAtTime(base * 1.2, t0 + len);
      g.gain.value = 0; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.3, t0 + 0.08); g.gain.linearRampToValueAtTime(0, t0 + len);
      o.connect(g); g.connect(f1); g.connect(f2); o.start(t0); o.stop(t0 + len + 0.02); last = o; this.voices++; o.onended = () => { this.voices--; try { g.disconnect(); } catch { /* */ } };
    }
    if (last) setTimeout(() => { try { f1.disconnect(); f2.disconnect(); out.disconnect(); p && p.disconnect(); } catch { /* */ } }, (dur + 3) * 1000);
  }

  // ---------------------------------------------------------------------------------------------- morris
  /** schedule the beats of the jig that begin in the next `win` seconds of the shared clock. kit 'sticks' = melodeon + clacks, 'hankies' = fiddle */
  setMorris(on, gain, pan, sharedSec = 0, win = 0.6, kit = 'sticks') {
    const c = this.ctx; if (!c) return;
    if (!on || gain <= 0.002) { if (this.mor) { const M = this.mor; this.mor = null; this._kill(M, [M.lp]); } this.lastBeat = -1; return; }
    if (!this.mor) { const B = this._bus(this.audio.music), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.5; lp.connect(B.g); this.mor = { ...B, lp }; }
    const M = this.mor, t = c.currentTime, beat = JIG.beat;
    M.g.gain.setTargetAtTime(gain, t, 0.3); if (M.p) M.p.pan.setTargetAtTime(pan, t, 0.3);
    const b0 = Math.max(this.lastBeat + 1, Math.ceil(sharedSec / beat)), b1 = Math.floor((sharedSec + win) / beat);
    for (let b = b0; b <= b1; b++) {
      const when = t + (b * beat - sharedSec);
      for (const [m, off, len, voice] of jigNotes(b, this._jn)) this._reed(when + off * beat, hz(m), len * beat * (voice === 0 ? 0.9 : 0.8), voice, kit, M.lp);
      // ankle bells: on the step and, lighter, on the hop
      this._jingle(when, 0.09, M.g); this._jingle(when + beat * 0.5, 0.05, M.g);
      if (kit === 'sticks' && clackOn(b)) this._clack(when, M.g, b);
      this.lastBeat = b;
    }
  }
  _reed(when, f, dur, voice, kit, dest) {
    const c = this.ctx, g = c.createGain(), pk = voice === 0 ? 0.16 : voice === 1 ? 0.18 : 0.04;
    g.gain.value = 0; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(pk, when + (kit === 'hankies' && voice === 0 ? 0.03 : 0.012)); g.gain.setValueAtTime(pk * 0.85, when + dur * 0.8); g.gain.linearRampToValueAtTime(0, when + dur);
    g.connect(dest);
    const o = c.createOscillator(); o.type = voice === 1 ? 'triangle' : kit === 'hankies' && voice === 0 ? 'sawtooth' : 'square'; o.frequency.value = f;
    o.connect(g); o.start(when); o.stop(when + dur + 0.02);
    if (voice === 0) {
      // the second reed, a few cents sharp (the melodeon's tremolo) — or the fiddle's vibrato
      const o2 = c.createOscillator(), g2 = c.createGain(); o2.type = kit === 'hankies' ? 'sawtooth' : 'square'; o2.frequency.value = f * (kit === 'hankies' ? 1.003 : 1.011); g2.gain.value = 0.7; o2.connect(g2); g2.connect(g); o2.start(when); o2.stop(when + dur + 0.02);
      if (kit === 'hankies') { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.8; lg.gain.value = f * 0.006; l.connect(lg); lg.connect(o.frequency); l.start(when); l.stop(when + dur + 0.02); }
    }
    this._done(o, g);
  }
  _jingle(when, gain, dest) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.audio.noiseBuf; f.type = 'bandpass'; f.frequency.value = 6800; f.Q.value = 3.5;
    g.gain.value = 0; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.003); g.gain.exponentialRampToValueAtTime(0.0004, when + 0.09);
    s.connect(f); f.connect(g); g.connect(dest); s.start(when, hash(Math.round(when * 100), 3) * 2, 0.12); this._done(s, f, g);
  }
  _clack(when, dest, b) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), o = c.createOscillator(), og = c.createGain();
    s.buffer = this.audio.noiseBuf; f.type = 'bandpass'; f.frequency.value = 1900 + (b % 2) * 350; f.Q.value = 3;
    g.gain.value = 0; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.6, when + 0.0015); g.gain.exponentialRampToValueAtTime(0.0005, when + 0.045);
    o.type = 'triangle'; o.frequency.setValueAtTime(980 + (b % 2) * 160, when); og.gain.value = 0; og.gain.setValueAtTime(0, when); og.gain.linearRampToValueAtTime(0.16, when + 0.002); og.gain.exponentialRampToValueAtTime(0.0005, when + 0.06);
    s.connect(f); f.connect(g); g.connect(dest); o.connect(og); og.connect(dest); s.start(when, (b % 17) * 0.1, 0.08); o.start(when); o.stop(when + 0.08); this._done(o, og, g, f);
  }
  stop() { this.setChoir(0, 0); this.setCrowd(0, 0, 0); this.setMorris(false, 0, 0); }
}
