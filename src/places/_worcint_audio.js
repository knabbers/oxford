// Worcester College interiors — synth audio for the Chapel (the room tones and small sounds of every room are
// systems/ambience.js): at evensong the organ and a choir-like pad move through a slow original chant-like chord
// sequence in a long synthetic reverb; at other times of day the organ scholar now and then practises a quiet phrase.
// Plus the gong for formal hall. Uses game.audio (music bus: ducks under speech, follows the U volume key);
// silent until the player has pressed Play. Leaving the Chapel fades it out and unhooks the reverb.
const SERVICE = [[50, 57, 62, 66], [47, 54, 62, 67], [43, 55, 62, 71], [45, 57, 61, 64], [50, 57, 62, 66], [52, 55, 59, 67], [45, 52, 61, 69], [50, 57, 62, 66]];
// two short practice phrases (plain diatonic cadences in D and G)
const PRACTICE = [[[50, 57, 62, 66], [43, 55, 59, 67], [45, 52, 61, 64], [50, 57, 62, 66]], [[43, 50, 59, 62], [48, 52, 60, 64], [50, 54, 57, 66], [43, 50, 59, 67]]];
export const CHAPEL_LEVEL = 1.0;

export class IntAudio {
  constructor(game) { this.game = game; this.ctx = null; this.out = null; this.verb = null; this.next = 0; this.step = 0; this.on = false; this.inside = false; this.pracT = 25; this.live = 0; this._off = null; }
  _init() {
    const a = this.game.audio; if (!a || !a.ctx) return false;
    if (this.ctx) return true;
    const ctx = (this.ctx = a.ctx);
    this.out = ctx.createGain(); this.out.gain.value = 0;
    // synthetic church impulse: 3.2 s of decaying noise (deterministic)
    const len = Math.floor(ctx.sampleRate * 3.2), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    let s = 0x1234abcd; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = rnd() * Math.pow(1 - i / len, 2.6); }
    this.verb = ctx.createConvolver(); this.verb.buffer = buf;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.6; this.verb.connect(this.wet); this.wet.connect(this.out);
    this.dry = ctx.createGain(); this.dry.gain.value = 0.35; this.dry.connect(this.out); this.dry.connect(this.verb);
    return true;
  }
  _hook(on) {
    const a = this.game.audio;
    if (on) { if (this._off) { clearTimeout(this._off); this._off = null; } if (!this.hooked) { this.out.connect(a.music || a.master); this.hooked = true; } }
    else if (this.hooked && !this._off) this._off = setTimeout(() => { this._off = null; if (!this.inside) { try { this.out.disconnect(); } catch { /* */ } this.hooked = false; } }, 6000);
  }
  _note(midi, t, dur, kind, vol = 1) {
    const ctx = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setValueAtTime(0, t);
    let first;
    if (kind === 'organ') {
      const v = 0.05 * vol;
      g.gain.linearRampToValueAtTime(v, t + 0.07); g.gain.setValueAtTime(v, t + dur - 0.18); g.gain.linearRampToValueAtTime(0, t + dur);
      for (const [m, a] of [[1, 1], [2, 0.5], [4, 0.25], [0.5, 0.6]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m; const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05); first = first || o; }
    } else {
      // choir "ah": sawtooth through formant band-passes, slow attack, gentle vibrato
      const v = 0.035 * vol;
      g.gain.linearRampToValueAtTime(v, t + 0.5); g.gain.setValueAtTime(v, t + dur - 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; first = o;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; const lg = ctx.createGain(); lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency);
      for (const [ff, q, a] of [[730, 6, 1], [1090, 8, 0.6], [2440, 10, 0.25]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; const bg = ctx.createGain(); bg.gain.value = a; o.connect(bp); bp.connect(bg); bg.connect(g); }
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }
    g.connect(this.dry);
    this.live++; first.onended = () => { this.live--; try { g.disconnect(); } catch { /* */ } };
  }
  /** one chord: organ (+ choir on the upper voices). Used by update() and by the offline tests. */
  chord(notes, t, dur, choir, vol = 1) {
    for (const n of notes) this._note(n, t, dur, 'organ', vol);
    if (choir) for (const n of notes.slice(1)) this._note(n + 12, t, dur, 'choir', vol);
  }
  /** call every frame: service = evensong in progress, inChapel = player inside */
  update(dt, inChapel, service) {
    if (!this._init()) return;
    const t = this.ctx.currentTime;
    if (inChapel !== this.inside) {
      this.inside = inChapel; this._hook(inChapel);
      this.out.gain.setTargetAtTime(inChapel ? CHAPEL_LEVEL : 0, t, inChapel ? 0.5 : 0.35);       // fades in over the door, out when you leave
      if (!inChapel) { this.on = false; this.pracT = 20 + Math.random() * 30; }
    }
    if (!inChapel) return;
    if (service) {
      if (!this.on) { this.on = true; this.next = t + 0.3; }
      if (t > this.next - 0.3) { const dur = 3.6; this.chord(SERVICE[this.step % SERVICE.length], this.next, dur, true); this.step++; this.next += dur; }
      return;
    }
    this.on = false;
    // out of service hours: the organ scholar tries a quiet phrase now and then (daytime only)
    const h = this.game.time ? this.game.time.hour : 12;
    if (h < 9 || h >= 22) return;
    if ((this.pracT -= dt) <= 0) {
      this.pracT = 45 + Math.random() * 60;
      const ph = PRACTICE[Math.floor(Math.random() * PRACTICE.length)];
      ph.forEach((c, i) => this.chord(c, t + 0.2 + i * 2.6, i === ph.length - 1 ? 4.2 : 2.7, false, 0.4));
    }
  }
  /** a single gong / bell strike (formal hall) */
  gong() {
    const a = this.game.audio; if (!a || !a.ctx) return; const ctx = a.ctx, t = ctx.currentTime;
    for (const [f, v] of [[196, 0.25], [393, 0.12], [587, 0.06]]) { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5); g.gain.linearRampToValueAtTime(0, t + 2.55); o.connect(g); g.connect(a.master); o.start(t); o.stop(t + 2.6); o.onended = () => { try { g.disconnect(); } catch { /* */ } }; }
  }
}
