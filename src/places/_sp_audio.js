// South Park fireworks night — sound (WebAudio synthesis only, through core/audio.js buses; original tune).
//   bursts    boom(when, …): a falling sine thump + low-passed noise with a slap-back off the houses; the further away,
//             the duller (air takes the top off) and — the caller's job — the later: when = burst time + distance / 343
//   crackle   a rattle of short bright ticks;  whistle: a rising screamer;  thump: the mortar going off (close by only)
//   crowd     "ooh" (rising) / "aah" (falling): a few detuned voices through two vowel formants, plus applause
//   bonfire   roar (brown noise) + crackle ticks while it burns, positioned
//   organ     an original fairground waltz, every note placed on the SHARED clock (two players hear the same bar)
// Envelope gains start at 0 (a GainNode defaults to 1 and would click). All timing comes from the caller; the only
// randomness is a hash of the shell's seed, so the same shell sounds the same for everyone.
import { hash } from './_sp_show.js';

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// The waltz: 16 bars of 3/4 in C. melody = [midi, beats] (0 = rest); the left hand is oom-pah-pah on the chord of the bar.
export const WALTZ = {
  bpm: 176,
  chords: ['C', 'C', 'G7', 'G7', 'G7', 'G7', 'C', 'C', 'C', 'C7', 'F', 'F', 'C', 'G7', 'C', 'C'],
  melody: [[72, 1], [76, 1], [79, 1], [84, 2], [79, 1], [77, 1], [74, 1], [79, 1], [77, 3], [74, 1], [77, 1], [83, 1], [81, 2], [77, 1], [76, 1], [72, 1], [79, 1], [76, 3],
    [72, 1], [76, 1], [79, 1], [84, 2], [82, 1], [81, 1], [77, 1], [84, 1], [81, 3], [79, 1], [76, 1], [84, 1], [83, 2], [74, 1], [72, 3], [0, 3]],
  CH: { C: [48, 64, 67, 72], C7: [48, 64, 67, 70], F: [41, 65, 69, 72], G7: [43, 62, 65, 71] },
};
/** notes of the waltz that START in beat b (absolute beat index on the shared clock) -> [[midi, beats, voice]] voice 0 melody, 1 bass, 2 chord */
export function waltzNotes(b, out = []) {
  out.length = 0;
  const bar = Math.floor(b / 3), beat = b - bar * 3, ch = WALTZ.CH[WALTZ.chords[((bar % 16) + 16) % 16]];
  if (beat === 0) out.push([ch[0], 1, 1]); else out.push([ch[1], 0.6, 2], [ch[2], 0.6, 2], [ch[3], 0.6, 2]);
  let k = ((b % 48) + 48) % 48, acc = 0;
  for (const [m, len] of WALTZ.melody) { if (acc === k) { if (m) out.push([m, len, 0]); break; } acc += len; if (acc > k) break; }
  return out;
}
export const WALTZ_BEATS = WALTZ.melody.reduce((s, n) => s + n[1], 0);

export class SpAudio {
  constructor(audio) { this.audio = audio; this.fire = null; this.organ = null; this.lastBeat = -1; this.lastBoom = -1; this.voices = 0; }
  get ctx() { return this.audio.ctx; }
  _pan(node, pan, dest) { return this.audio.panTo(node, pan, dest || this.audio.master); }
  _done(src, ...nodes) { this.voices++; src.onended = () => { this.voices--; for (const n of nodes) { try { n && n.disconnect(); } catch { /* */ } } }; }

  /** a shell bursting `dist` metres away: size 0..1 loudness, when = AudioContext time of arrival */
  boom(when, size, pan, dist, minGap = 0.1) {
    const c = this.ctx; if (!c) return false;
    if (when - this.lastBoom < minGap) return false;      // the finale: cap the voices, the roll of thunder is kept
    this.lastBoom = when;
    const near = 1 / (1 + dist / 260), far = Math.min(1, dist / 1500), g0 = (0.16 + 0.5 * size) * (0.1 + 0.9 * near);
    // thump
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150 + 60 * far, when); o.frequency.exponentialRampToValueAtTime(46 + 40 * far, when + 0.5);
    og.gain.value = 0; og.gain.setValueAtTime(0, when); og.gain.linearRampToValueAtTime(g0 * (0.9 - 0.45 * far), when + 0.008 + 0.03 * far); og.gain.exponentialRampToValueAtTime(0.0008, when + 0.9 + 0.5 * size);
    o.connect(og); const p1 = this._pan(og, pan); o.start(when); o.stop(when + 1.6 + 0.5 * size); this._done(o, og, p1);
    // the tearing noise of the burst, and its echo off the terraces
    const src = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
    src.buffer = this.audio.noiseBuf; src.loop = true; f.type = 'lowpass'; f.Q.value = 0.4;
    // (a distant burst is a dull crump, but not only sub-bass: small speakers must still carry it)
    f.frequency.setValueAtTime(Math.max(1100, 5200 / (1 + dist / 110)), when); f.frequency.exponentialRampToValueAtTime(Math.max(380, 900 / (1 + dist / 300)), when + 1.3);
    ng.gain.value = 0; ng.gain.setValueAtTime(0, when); ng.gain.linearRampToValueAtTime(g0 * (0.55 + 0.9 * far), when + 0.012); ng.gain.exponentialRampToValueAtTime(g0 * 0.12, when + 0.32);
    ng.gain.linearRampToValueAtTime(g0 * 0.2, when + 0.4); ng.gain.exponentialRampToValueAtTime(0.0006, when + 1.7 + size);
    src.connect(f); f.connect(ng); const p2 = this._pan(ng, pan * 0.6); src.start(when, (size * 1.7) % 2); src.stop(when + 2.8 + size); this._done(src, f, ng, p2);
    return true;
  }
  /** crackling stars: n ticks over ~1 s */
  crackle(when, gain, pan, seed, dist) {
    const c = this.ctx; if (!c) return;
    const near = 1 / (1 + dist / 180), n = Math.round(8 + 16 * near);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.audio.noiseBuf; src.loop = true; f.type = 'highpass'; f.frequency.value = Math.max(700, 3400 * near + 600);
    g.gain.value = 0; g.gain.setValueAtTime(0, when);
    for (let i = 0; i < n; i++) { const t = when + (i + hash(seed, i)) * (1.1 / n), pk = gain * near * 0.5 * (0.4 + 0.6 * hash(i, seed)); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03); }
    g.gain.setValueAtTime(0, when + 1.25);
    src.connect(f); f.connect(g); const p = this._pan(g, pan); src.start(when, hash(seed, 3) * 2); src.stop(when + 1.3); this._done(src, f, g, p);
  }
  /** a screamer on the way up (close by only) */
  whistle(when, gain, pan) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1300, when); o.frequency.exponentialRampToValueAtTime(3100, when + 1.1);
    l.frequency.value = 28; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency);
    g.gain.value = 0; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain * 0.05, when + 0.08); g.gain.linearRampToValueAtTime(gain * 0.03, when + 0.9); g.gain.linearRampToValueAtTime(0, when + 1.15);
    o.connect(g); const p = this._pan(g, pan); o.start(when); l.start(when); o.stop(when + 1.2); l.stop(when + 1.2); this._done(o, g, lg, p);
  }
  /** the mortar: a dull thoomp */
  thump(when, gain, pan) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(95, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.16);
    g.gain.value = 0; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain * 0.3, when + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, when + 0.3);
    o.connect(g); const p = this._pan(g, pan); o.start(when); o.stop(when + 0.35); this._done(o, g, p);
  }
  /** the crowd: up = "ooh" (rising), else "aah" (falling) */
  ooh(when, gain, pan, up, seed = 1) {
    const c = this.ctx; if (!c) return;
    const dest = this.audio.ambience, dur = up ? 1.5 : 1.9, out = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
    f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7;
    f1.frequency.setValueAtTime(up ? 330 : 700, when); f1.frequency.linearRampToValueAtTime(up ? 400 : 620, when + dur);
    f2.frequency.setValueAtTime(up ? 760 : 1150, when); f2.frequency.linearRampToValueAtTime(up ? 900 : 1050, when + dur);
    out.gain.value = 0; out.gain.setValueAtTime(0, when); out.gain.linearRampToValueAtTime(gain * 0.5, when + 0.35); out.gain.setValueAtTime(gain * 0.5, when + dur * 0.55); out.gain.linearRampToValueAtTime(0, when + dur);
    f1.connect(out); f2.connect(out); const p = this._pan(out, pan, dest);
    const os = [];
    for (let i = 0; i < 6; i++) {
      const o = c.createOscillator(), base = [110, 147, 196, 220, 262, 294][i] * (1 + (hash(seed, i) - 0.5) * 0.03), d = hash(i, seed) * 0.18;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base * (up ? 0.94 : 1.07), when + d); o.frequency.linearRampToValueAtTime(base * (up ? 1.1 : 0.9), when + dur);
      o.connect(f1); o.connect(f2); o.start(when + d); o.stop(when + dur + 0.05); os.push(o);
    }
    this._done(os[0], f1, f2, out, p);
  }
  applause(when, dur, gain, pan, seed = 1) {
    const c = this.ctx; if (!c) return;
    for (const [hzc, k] of [[1500, 1], [2700, 0.8]]) {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), n = Math.floor(dur * 22);
      src.buffer = this.audio.noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = hzc; f.Q.value = 0.9;
      g.gain.value = 0; g.gain.setValueAtTime(0, when);
      for (let i = 0; i < n; i++) { const q = i / n, env = Math.sin(Math.min(1, q * 4) * Math.PI / 2) * Math.pow(1 - q, 0.7); g.gain.linearRampToValueAtTime(gain * 0.06 * k * env * (0.35 + 0.65 * hash(seed + i, hzc)), when + (i + 1) * (dur / n)); }
      src.connect(f); f.connect(g); const p = this._pan(g, pan, this.audio.ambience); src.start(when, hash(seed, hzc) * 2); src.stop(when + dur + 0.1); this._done(src, f, g, p);
    }
  }

  /** bonfire bed: call every slow tick with the level (0 = stop) and where it sits for the listener */
  setFire(level, gain, pan, win = 0.5, sharedSec = 0) {
    const c = this.ctx; if (!c) return;
    if (level <= 0.01 || gain <= 0.002) { if (this.fire) { const F = this.fire; this.fire = null; F.g.gain.setTargetAtTime(0, c.currentTime, 0.3); try { F.src.stop(c.currentTime + 1.5); } catch { /* */ } F.src.onended = () => { try { F.g.disconnect(); F.f.disconnect(); F.p && F.p.disconnect(); } catch { /* */ } }; } return; }
    if (!this.fire) {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.audio.brownBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0;
      src.connect(f); f.connect(g);
      const sp = this.audio.steered ? this.audio.steered(this.audio.ambience) : null, p = sp || (c.createStereoPanner ? c.createStereoPanner() : null); if (sp) g.connect(sp.in); else if (p) { g.connect(p); p.connect(this.audio.ambience); } else g.connect(this.audio.ambience);      // (spatial sound: core/audio.js steered())
      src.start(); this.fire = { src, f, g, p };
    }
    const t = c.currentTime;
    this.fire.g.gain.setTargetAtTime(level * gain * 0.55, t, 0.4); if (this.fire.p) this.fire.p.pan.setTargetAtTime(pan, t, 0.3);
    // snaps and pops: a few per second, on the shared clock
    const k0 = Math.floor(sharedSec * 8), k1 = Math.floor((sharedSec + win) * 8);
    for (let k = k0; k < k1; k++) if (hash(k, 77) < 0.42 * level) this.audio.noise(0.02 + hash(k, 5) * 0.03, { gain: gain * level * (0.05 + 0.12 * hash(k, 9)), freq: 1400 + hash(k, 2) * 2600, q: 1.2, when: (k / 8 - sharedSec) + 0.02 + hash(k, 3) * 0.1, dest: this.audio.ambience, pan });
  }

  /** the fairground organ: schedule the beats of the waltz that begin in the next `win` seconds of the shared clock */
  setOrgan(on, gain, pan, sharedSec = 0, win = 0.6) {
    const c = this.ctx; if (!c) return;
    if (!on || gain <= 0.002) { if (this.organ) { const O = this.organ; this.organ = null; O.g.gain.setTargetAtTime(0, c.currentTime, 0.25); setTimeout(() => { try { O.g.disconnect(); O.p && O.p.disconnect(); } catch { /* */ } }, 2500); } this.lastBeat = -1; return; }
    if (!this.organ) {
      const g = c.createGain(); g.gain.value = 0;
      const sp = this.audio.steered ? this.audio.steered(this.audio.ambience) : null, p = sp || (c.createStereoPanner ? c.createStereoPanner() : null); if (sp) g.connect(sp.in); else if (p) { g.connect(p); p.connect(this.audio.ambience); } else g.connect(this.audio.ambience);      // (spatial sound: core/audio.js steered())
      this.organ = { g, p };
    }
    const O = this.organ, t = c.currentTime, beat = 60 / WALTZ.bpm;
    O.g.gain.setTargetAtTime(gain, t, 0.3); if (O.p) O.p.pan.setTargetAtTime(pan, t, 0.3);
    const b0 = Math.max(this.lastBeat + 1, Math.ceil(sharedSec / beat)), b1 = Math.floor((sharedSec + win) / beat);
    const N = this._wn || (this._wn = []);
    for (let b = b0; b <= b1; b++) {
      const when = t + (b * beat - sharedSec);
      for (const [m, len, voice] of waltzNotes(b, N)) this._pipe(when, hz(m), len * beat * (voice === 0 ? 0.92 : 0.8), voice, O.g);
      this.lastBeat = b;
    }
  }
  _pipe(when, f, dur, voice, dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), pk = voice === 0 ? 0.05 : voice === 1 ? 0.075 : 0.022;
    o.type = voice === 1 ? 'triangle' : 'square'; o.frequency.value = f;
    g.gain.value = 0; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(pk, when + 0.012); g.gain.setValueAtTime(pk * 0.85, when + dur * 0.8); g.gain.linearRampToValueAtTime(0, when + dur);
    o.connect(g); g.connect(dest);
    let o2 = null;
    if (voice === 0) { o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = f * 2.004; const g2 = c.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(g); o2.start(when); o2.stop(when + dur + 0.02); }   // the octave pipe, a hair sharp: that fairground shimmer
    o.start(when); o.stop(when + dur + 0.02); this._done(o, g);
  }
  stop() { this.setFire(0, 0, 0); this.setOrgan(false, 0, 0); }
}
