// Purple Turtle sound. The DJ's set is six original synthesised tracks (core/_groove_tracks.js: cheese, chart
// dance, indie disco, a drum & bass one, a hands-in-the-air closer — no real songs) played by core/_groove.js on the
// SHARED clock, so every player hears the same track at the same bar and the dancers' beat is the track's beat.
//   outside / in the queue: only the kick, bass and snare are synthesised, through a ~130 Hz low-pass that opens a
//                           little when the door does; level by distance
//   coming down the stairs: the low-pass opens up over a second or so
//   inside:                 full range on the dance floor, darker and ~5 dB quieter by the bar / sofas / stairs
// A dance-floor minigame "holds" the track (it loops its last drop locally, then rejoins the shared set on a bar
// line); a jukebox request starts that track at the next 8-bar line for everybody ('ptjuke' net event).
// The sequencer keeps counting without an AudioContext so the dance minigame and the lights still have a beat.
import { Groove, SetPlayer, prepare } from '../core/_groove.js';
import { CLUB } from '../core/_groove_tracks.js';
import { coins } from '../systems/_object_audio.js';

export const TRACKS = CLUB.map(prepare);
export const CLUB_LEVEL = 0.8;                 // bus gain on the dance floor (tracks are loudness-matched by their `gain`)
const FLOOR = [-1.9, 3.65], STAIR_X = 9;        // _pt_interior.js LAY.floor centre / where the stairs and corridor start
const OPEN_HZ = 18000;
/** the PA (cellar coordinates): the stacks either side of the DJ booth (_pt_interior.js) and two fills facing back down the floor */
export const PA = [{ x: -7.3, y: 1.0, z: 1.1, gain: 0.55 }, { x: -7.3, y: 1.0, z: 6.1, gain: 0.55 }, { x: 2.2, y: 2.2, z: 1.6, gain: 0.3 }, { x: 2.2, y: 2.2, z: 5.6, gain: 0.3 }];
const P_BAR = { x: 0.5, y: 1.1, z: -3.7, place: 'purple_turtle' }, P_DOOR = { x: 15.3, y: 4.2, z: -3.3, place: 'purple_turtle' }, P_FOOS = { x: 5.0, y: 0.9, z: 9.2, place: 'purple_turtle' }, P_DESK = { x: 7.4, y: 1.1, z: -0.85, place: 'purple_turtle' };

export class PTAudio {
  constructor(game) {
    this.game = game; this.mode = 'off';           // 'inside' | 'outside' | 'off'
    this.stopped = false; this.lightsUp = false; this.crowd = 0; this._hold = false;
    this._lc = 0; this.groove = null; this.murmur = null; this._mt = 0; this._timer = null; this._tone = ''; this.thumpGain = 0;
    this.player = new SetPlayer({
      tracks: TRACKS, shared: () => this.game.time.now() / 1000, clock: () => this.clock,
      onStep: (T, step, when, sp) => this._step(T, step, when, sp),
    });
    const net = game.net;
    if (net && net.on) net.on('ptjuke', (d) => { if (d && Number.isFinite(d.i) && Number.isFinite(d.t0)) this.player.request(d.i, d.t0); });
  }
  get A() { return this.game.audio; }
  get ctx() { return this.game.audio && this.game.audio.ctx; }
  /** local music clock, seconds (the AudioContext's when there is one) */
  get clock() { const c = this.ctx; return c ? c.currentTime : this._lc; }
  get T() { return this.player.track; }
  get track() { return TRACKS.indexOf(this.T); }
  /** the beat people dance to (half-time for the drum & bass track) */
  get bpm() { const T = this.T; return T.bpm / T.danceDiv; }
  get spb() { return 60 / this.bpm; }
  get beatFloat() { return this.player.beat(); }
  get beatPhase() { const b = this.player.beat(); return b - Math.floor(b); }
  get beatIndex() { return Math.floor(this.player.beat()); }
  /** clock time of the next bar line */
  nextBar() { return this.player.nextBar(); }
  get hold() { return this._hold; }
  set hold(v) { this._hold = !!v; this.player.setHold(this._hold); }

  setMode(m) {
    if (m === this.mode) return;
    const was = this.mode; this.mode = m;
    if (m !== 'off') this._run(true); else this._run(false);
    if (m === 'inside') this._startMurmur(); else this._stopMurmur();
    if (was === 'inside' && m !== 'inside') this._ringStart();
    this._tone = '';                                   // force a level update
    if (this.groove && m === 'inside' && was !== 'inside') this.groove.setTone(260, CLUB_LEVEL * 0.5, 0.05);   // start dark, open up below
    this._level(0);
  }
  /** jukebox: `i` plays from the next 8-bar line, for everyone. Returns its name. */
  request(i) {
    const t0 = this.player.request(i), net = this.game.net;
    if (net && net.connected && net.send) net.send('ptjuke', { i: this.player.override.ti, t0 });
    return TRACKS[this.player.override.ti].name;
  }
  setLightsUp(on) { this.lightsUp = on; this._tone = ''; this._level(0); }

  /** schedule the next 0.4 s of the set (a 10 Hz timer calls this; tools call it directly on an offline context) */
  pump() { this.player.tick(0.4); }
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
  // ---------------------------------------------------------------- where sounds are (headphones / HRTF)
  // The club's sounds are written against the game's central spatial hook when there is one:
  //   game.audio.spatial(position | () => position, opts) -> an AudioNode to play into
  // Positions are { x, y, z, place } — place 'purple_turtle' = the cellar's own coordinates (as game.walkers has it),
  // 'world' = map coordinates. Without the hook everything plays exactly as before (unpositioned).
  /** a node at `pos` to play into, or null (no spatial audio: the caller's old path) */
  at(pos, opts) { const A = this.A; if (!A || !A.ctx || typeof A.spatial !== 'function') return null; try { return A.spatial(pos || this.me(), opts) || null; } catch { return null; } }
  /** where the local player is */
  me() { const p = this.game.player; return { x: p.pos.x, y: p.pos.y + 1.2, z: p.pos.z, place: p.place }; }
  /** one-shot options with `dest` at pos when sounds are positioned */
  _o(o, pos, opts) { const d = this.at(pos, opts); if (d) o.dest = d; return o; }
  _ensure() {
    const A = this.A; if (!A || !A.ctx || this.groove) return;
    // The music is the room's own (diegetic): with spatial audio it comes from the PA — the two stacks either side of
    // the DJ and two fills at the east end of the floor — over a diffuse bed (the vault's reverberant field), so it is
    // full and wide on the floor and you can hear where the floor is from the bar and the stairs. Otherwise: the one bus.
    let dest = A.music;
    if (typeof A.spatial === 'function') {
      try {
        const ctx = A.ctx, bus = ctx.createGain(), bed = ctx.createGain(); bed.gain.value = 0.55; bus.connect(bed); bed.connect(A.music);
        this.pa = PA.map((q) => { const g = ctx.createGain(); g.gain.value = q.gain; const n = A.spatial({ x: q.x, y: q.y, z: q.z, place: 'purple_turtle' }, { kind: 'music', refDistance: 2.5, rolloff: 0.8, occlusion: true, reverb: 0.25 }); if (!n) throw new Error('no node'); bus.connect(g); g.connect(n); return { ...q, node: n }; });
        this.spatialBus = bus; dest = bus;
      } catch { this.pa = null; this.spatialBus = null; dest = A.music; }
    }
    this.groove = new Groove(A, dest);
  }
  _step(T, step, when, sp) {
    const g = this.groove;
    if (!g || this.stopped || this.lightsUp || this.mode === 'off') return;
    if (this.mode === 'outside' && this.thumpGain < 0.004) return;
    g.mix.gain.setValueAtTime(T.gain || 1, Math.max(when, g.ctx.currentTime));
    g.step(T, step, when, sp, this.mode === 'outside');
  }
  /** where the player stands → low-pass + gain of the whole set */
  _level(outsideGain) {
    const g = this.groove; if (!g) return;
    let hz = OPEN_HZ, gain = 0, tc = 0.3;
    if (this.stopped || this.lightsUp || this.mode === 'off') { gain = 0; tc = this.mode === 'off' ? 0.3 : 0.4; }
    else if (this.mode === 'outside') { gain = outsideGain * 0.5 * CLUB_LEVEL; hz = 110 + 420 * outsideGain; tc = 0.15; }
    else {
      const p = this.game.player.pos, d = Math.hypot(p.x - FLOOR[0], p.z - FLOOR[1]);
      let r = Math.max(0, Math.min(1, 1 - (d - 3.5) / 8));              // 1 on the dance floor … 0 at the far bar / sofas
      const stairs = Math.max(0, Math.min(1, (p.x - STAIR_X) / 4));      // up the stairs / along the corridor: darker again
      r *= 1 - stairs;
      hz = (4200 + 13800 * r * r) * (1 - 0.8 * stairs); gain = CLUB_LEVEL * (0.55 + 0.45 * r) * (1 - 0.35 * stairs); tc = 0.45;
      // the DJ's mix: the last four bars of a track are filtered down, the next one opens up over its first two
      const m = this.mixNow(); if (m < 1) { hz = Math.max(260, hz * (0.05 + 0.95 * m * m)); gain *= 0.82 + 0.18 * m; tc = 0.18; }
      this.loud = r * (1 - stairs);
    }
    const key = `${Math.round(hz / 50)}|${Math.round(gain * 100)}`;
    if (key !== this._tone) { this._tone = key; g.setTone(hz, gain, tc); }
    this.thumpGain = this.mode === 'outside' ? outsideGain : 0;
  }

  /** 1 = a track in full flow; < 1 through a transition (filtered out over its last four bars, in over the next one's first two) */
  mixNow() {
    if (this._hold) return 1;
    try {
      const a = this.player.now(); if (!a) return 1;
      const bar = a.T.spb * 4, el = this.clock - a.t0, rem = a.T.dur - el;
      if (rem < 4 * bar && rem > -0.5) return Math.max(0, rem / (4 * bar));
      if (el >= 0 && el < 2 * bar) return el / (2 * bar);
    } catch { /* */ }
    return 1;
  }
  /** ears ringing after the dance floor: a faint high whine that fades over half a minute outside */
  _ringStart() {
    const A = this.A, ctx = this.ctx, k = Math.min(1, (this.expo || 0) / 45);
    this.ringLast = { k: +k.toFixed(2), at: this.game.time.now() };
    if (!ctx || !A.master || k < 0.3 || this._ring) return;
    try {
      const g = ctx.createGain(), t = ctx.currentTime; g.gain.value = 0; g.gain.setTargetAtTime(0.0045 * k, t, 0.4); g.gain.setTargetAtTime(0, t + 2.5, 9); g.connect(A.master);
      const os = [4180, 6250].map((hz, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz; const og = ctx.createGain(); og.gain.value = i ? 0.45 : 1; o.connect(og); og.connect(g); o.start(t); o.stop(t + 40); return o; });
      this._ring = g; os[0].onended = () => { try { g.disconnect(); } catch { /* */ } this._ring = null; };
    } catch { /* */ }
  }
  /** dt per frame. outsideGain 0..1 = how loud the leak is in Frewin Court (distance + door open) */
  update(dt, outsideGain = 0) {
    const ctx = this.ctx;
    if (this.mode === 'inside' && !this.lightsUp) this.expo = Math.min(90, (this.expo || 0) + dt * (0.3 + 0.7 * (this.loud || 0)));
    else this.expo = Math.max(0, (this.expo || 0) - dt * 0.5);
    if (!ctx) this._lc += dt;
    else if (this.mode !== 'off') this._ensure();
    if (this.mode !== 'off' && !this._timer) this._run(true);
    this._level(outsideGain);
    if (this.murmur && ctx) {
      this._mt -= dt;
      if (this._mt <= 0) { this._mt = 0.3 + Math.random() * 0.5; const lvl = (this.lightsUp ? 0.7 : 1) * Math.min(1, this.crowd) * (0.05 + Math.random() * 0.03); this.murmur.out.gain.setTargetAtTime(lvl, ctx.currentTime, 0.35); }
    }
  }
  _startMurmur() {
    const A = this.A, ctx = this.ctx; if (!ctx || this.murmur) return;
    // crowd bed: the shared brown noise through two speech-band filters, wobbling at syllable rate
    const src = ctx.createBufferSource(); src.buffer = A.brownBuf; src.loop = true;
    const out = ctx.createGain(); out.gain.value = 0;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 0.8;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300; f2.Q.value = 1.1;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    const am = ctx.createGain(); am.gain.value = 0.7; const lfo = ctx.createOscillator(); lfo.frequency.value = 3.7; const lg = ctx.createGain(); lg.gain.value = 0.3; lfo.connect(lg); lg.connect(am.gain);
    src.connect(f1); src.connect(f2); f2.connect(g2); f1.connect(am); g2.connect(am); am.connect(out);
    // the crowd: with spatial audio, two wide sources — the bar room and the dance floor — else the one bed
    const spots = [[0.5, 1.5, -2.2], [-2.0, 1.5, 3.6]].map((q) => this.at({ x: q[0], y: q[1], z: q[2], place: 'purple_turtle' }, { kind: 'crowd', spread: 5, refDistance: 3, occlusion: true })).filter(Boolean);
    if (spots.length === 2) for (const n of spots) out.connect(n); else out.connect(A.ambience || A.master);
    src.start(); lfo.start();
    this.murmur = { src, lfo, out };
  }
  _stopMurmur() {
    if (!this.murmur) return; const m = this.murmur; this.murmur = null;
    try { const t = this.ctx.currentTime; m.out.gain.setTargetAtTime(0, t, 0.15); m.src.stop(t + 0.9); m.lfo.stop(t + 0.9); m.src.onended = () => { try { m.out.disconnect(); } catch { /* */ } }; } catch { /* */ }
  }

  // ---------------------------------------------------------------- effects
  /** sticky floor: a soft step and the little "tck" of a sole peeling off */
  // (each takes an optional position { x, y, z, place }; the default is where it happens — your feet, the bar, the door)
  step(pos) { const A = this.A; if (!A || !A.ctx) return; const p = pos || { ...this.me(), y: this.game.player.pos.y + 0.05 }; A.noise(0.06, this._o({ gain: 0.05, freq: 500, q: 0.7, type: 'lowpass' }, p)); A.noise(0.03, this._o({ gain: 0.03, freq: 3200, q: 3, when: 0.07 + Math.random() * 0.03 }, p)); }
  coin(pos) { const A = this.A, p = pos || (this.game.player.place === 'purple_turtle' ? P_BAR : this.me()); coins(A, this._o({}, p)); }      // (coins on the bar: it was a two-note square-wave bing, 2026-11-23)
  stamp(pos) { const A = this.A, p = pos || this.me(); A.noise(0.05, this._o({ gain: 0.15, freq: 300, q: 0.8, type: 'lowpass' }, p)); A.tone(120, 0.05, this._o({ type: 'triangle', gain: 0.1 }, p)); }
  door(pos) { const A = this.A, p = pos || (this.game.player.place === 'purple_turtle' ? P_DOOR : this.me()); A.noise(0.25, this._o({ gain: 0.05, freq: 600, q: 0.6 }, p)); A.tone(90, 0.12, this._o({ type: 'triangle', gain: 0.06, when: 0.2 }, p)); }
  hit(q) { const A = this.A; if (q !== 'perfect' && q !== 'good') A.noise(0.08, { gain: 0.05, freq: 300, q: 1 }); }      // (a step landed well made a beep until 2026-11-23: now only a missed one is heard, as a scuff; tap() is the step itself)
  cheer(pos) { const A = this.A, d = this.at(pos || this.me(), { spread: 2.5 }); for (let i = 0; i < 12; i++) { const o = { gain: 0.05, freq: 1800 + Math.random() * 1500, q: 2, when: i * 0.07 + Math.random() * 0.05 }; if (d) o.dest = d; A.noise(0.09, o); } }
  foosHit(p) { this.A.tone(700 + Math.random() * 300, 0.04, this._o({ type: 'square', gain: 0.03 + p * 0.03 }, P_FOOS)); this.A.noise(0.03, this._o({ gain: 0.05, freq: 2000, q: 2 }, P_FOOS)); }
  foosGoal() { const A = this.A; A.noise(0.2, this._o({ gain: 0.15, freq: 250, q: 0.8, type: 'lowpass' }, P_FOOS)); A.tone(180, 0.15, this._o({ type: 'triangle', gain: 0.08, when: 0.05 }, P_FOOS)); }
  /** a look returned / an arm taken: two soft notes */
  spark() { /* (was two soft notes a fifth apart: a moment between two people makes no sound, 2026-11-23) */ }
  /** a dance step landing (very quiet, under the music) */
  tap(q, pos) { const A = this.A, p = pos || { ...this.me(), y: this.game.player.pos.y + 0.05 }; if (q === 'perfect') A.noise(0.03, this._o({ gain: 0.035, freq: 5200, q: 2 }, p)); else if (q === 'good') A.noise(0.03, this._o({ gain: 0.025, freq: 3600, q: 2 }, p)); else A.noise(0.06, this._o({ gain: 0.03, freq: 240, q: 1, type: 'lowpass' }, p)); }
  splash(pos) { const A = this.A, p = pos || { ...this.me(), y: this.game.player.pos.y + 0.1 }; A.noise(0.35, this._o({ gain: 0.09, freq: 2600, q: 0.5 }, p)); A.noise(0.18, this._o({ gain: 0.06, freq: 700, q: 0.8, when: 0.05 }, p)); }
  /** a shove landing: a soft body thump, nothing sharper */
  thud(k = 1, pos) { const A = this.A, p = pos || this.me(); A.noise(0.09, this._o({ gain: 0.1 * k, freq: 190, q: 0.8, type: 'lowpass' }, p)); A.tone(82, 0.09, this._o({ type: 'triangle', gain: 0.07 * k }, p)); }
  sip() { this.A.noise(0.25, { gain: 0.03, freq: 900, q: 0.6 }); }
  stopAll() { this._stopMurmur(); this.setMode('off'); }
}
