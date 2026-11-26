// WebAudio core: everything is synthesised, there are no audio files (except the voice clips, core/voice.js).
// Modules may use game.audio.ctx directly. Buses (all GainNodes, null until Play is pressed):
//
//   sources ─► master (vehicles and effects) ──────────► out ─► limiter ─► destination   one-shots, engines, doors, footsteps
//   voiceBus (characters' voices) ─────────────────────► out                            core/voice.js
//   chatBus (other players' microphones) ──────────────► out                            core/voicechat.js
//   music ────► bed (ducks under speech) ─► bedVol ────► out                            club / jukebox / organ (venue music)
//   ambience ─► bed                                                                    room tones, birds, traffic, people
//
// VOLUMES (the sound panel on the Esc screen, systems/keyhelp.js): audio.levels = { master, voice, chat, music,
// ambience, bells, fx, venue }, each 0..2 with 1 the default, saved together ('gto.levels'); setLevel(name, v),
// resetLevels(). Every source is on exactly one of these: `master` (the node everything used to connect to) is now
// the vehicles-and-effects bus, so anything that connects to audio.master is counted there; voices, microphones, venue
// music and ambience have their own; `music` (the background soundtrack, its own player) and `bells` (a family
// inside the ambience) are applied by their owners through audio.onLevel(name, fn).
// Characters' voices are at half the amplitude they were made at (VOICE_BASE 0.5, -6 dB): at 100% a line spoken beside
// you is about -26.5 LUFS at the output, against -29 to -46 for the ambience (tools/smoke_ambience.mjs measures the latter).
//
//   audio.tone(freq, dur, opts) / audio.noise(dur, opts)   one-shots; opts.pan (−1..1), opts.dest, opts.when;
//                                                          opts.pos ([x, z] | {x, y, z}) + opts.cls: AT that place (spatial)
//   audio.noiseBuf / brownBuf                              shared looping noise buffers (never allocate noise per note)
//   audio.duck(on)                                         speech is playing: dip music + ambience a little
//   audio.bedLevel / cycleBed()                            the player's music + ambience volume (1 → 0.5 → 0), saved
//   audio.levels / setLevel(name, v) / resetLevels()       the volumes of the sound panel (see VOLUMES below)
//   audio.listener(x, z, yaw[, y]) / audio.place(x, z, range)   → {pan, gain} of a world position for the current camera
//
// SPATIAL SOUND (2026-11). Every sound that has a place in the world goes through ONE mechanism:
//   const h = audio.spatial(pos, opts)      pos = {x, y?, z} (a live object — a Vector3 — is followed if opts.follow) or [x, z]
//   source.connect(h.in); h.out is already connected to opts.dest (default: master); h.free() when the sound is over
//   (or pass opts.until = the source node: freed when it ends); h.set(x, y, z); h.occlude(0..1)
//   opts.cls    the class of sound: how far it carries (CLASSES: voice, step, small, vehicle, bird, water, bell, wall …)
//   opts.dist   false = direction only (the caller has already applied its own fall-off with distance)
//   audio.occluder(x, z) -> is there a wall between the listener and that point (set by systems/ambience.js: one ray at
//               the real walls, out of doors). Characters' voices ask it by themselves, and so does anything with
//               occlusion: true while it is in the same place as the listener (in another place it is muffled outright)
//   WALLS: audio.occlusion (core/_occlusion.js, set by core/game.js) looks at EVERY node made here — what stands between it
//               and the listener — and gives it a gain and a low-pass (h._occSet). When it is installed the two lines above
//               (occluder, occlusion: true) are its business, not this file's; opts.occlude: false = never ask for this sound.
//   opts.rev    true = also sent into the reverberation of the room the listener is in (voices are, always)
//   opts.occl   0..1 at birth: behind a wall — low-passed and attenuated (occlude() moves it; the filter is only there if asked for)
// Headphones (the default): a PannerNode with HRTF — direction, front / back and height read binaurally. HRTF is costly,
// so only MAX_HRTF sounds have it at once; the ones past that (and everything in "speakers" mode) use equal-power
// panning, which costs next to nothing. The listener (position, facing) follows the camera: audio.listener() every frame.
// Positions are in the frame the listener is in (the world out of doors, a walk-in room's own frame inside it).
// audio.output = 'hp' | 'sp' (saved; setOutput(), from the Esc screen's sound panel). Not spatial, on purpose: the music, UI sounds, and the
// wide beds (general wind, rain, the city's hush, a crowd's murmur) — those are everywhere, not somewhere.
// The old `pan` argument of tone() / noise() / panTo(): when it is the pan that place() has just returned (the usual
// call: `const p = audio.place(x, z); audio.tone(f, d, { pan: p.pan, gain: g * p.gain })`), the sound is put AT that
// place (direction only: the caller's gain already has the distance in it) — existing callers became spatial unchanged.
// Nothing here throws without an AudioContext; before start() every call is a no-op. The context is suspended while
// the tab is hidden so no synthesis runs in the background.
const PREF = 'gto.bedLevel', PREF_OUT = 'gto.audioOut';
const LEVELS = [1, 0.5, 0];
export const MAX_HRTF = 20;
const OPEN_HZ = 20000;      // the wall filter's cutoff when nothing is in the way (core/_occlusion.js OCC.OPEN_HZ)
export const LEVEL_NAMES = ['master', 'voice', 'chat', 'music', 'ambience', 'bells', 'fx', 'venue'];
export const VOICE_BASE = 0.5, MASTER_BASE = 0.6, VENUE_BASE = 0.8;      // (voices: half the amplitude they were made at, -6 dB)
const PREF_LEVELS = 'gto.levels';
/** which volume a class of positioned sound belongs to (spatial() takes its bus from this when no dest is given) */
export const BUS_OF = { voice: 'voice', step: 'fx', small: 'fx', vehicle: 'fx', wall: 'venue', bird: 'ambience', water: 'ambience', bell: 'bells', boom: 'fx' };
// ref = metres at which it is at full level, roll = how fast it falls beyond (inverse law), far = metres at which it is gone
export const CLASSES = {
  voice: { ref: 2.2, roll: 1.5, far: 24 }, step: { ref: 1.5, roll: 1.4, far: 28 }, small: { ref: 3, roll: 1.3, far: 45 },
  vehicle: { ref: 6, roll: 1.2, far: 110 }, bird: { ref: 14, roll: 1.0, far: 160 }, water: { ref: 16, roll: 1.0, far: 240 },
  wall: { ref: 8, roll: 1.2, far: 70 }, bell: { ref: 150, roll: 0.9, far: 1800 }, boom: { ref: 200, roll: 0.8, far: 4000 },
};

export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.music = null; this.ambience = null; this.bed = null; this.bedVol = null; this.limiter = null;
    this.noiseBuf = null; this.brownBuf = null; this.offline = false;
    this.bedLevel = 1; this._duck = false; this._lx = 0; this._lz = 0; this._ly = 0; this._lh = 1.6; this._res = { pan: 0, gain: 0, x: 0, z: 0, at: -1 };
    this.reverbIn = null; this.output = 'hp'; this.hrtf = 0; this.spatials = 0; this.peakHrtf = 0; this._follow = []; this._tick = 0; this._P = { x: 0, y: 0, z: 0, other: false }; this.frames = null; this.framePlace = null; this.occluder = null; this.occlusion = null; this._handles = new Set(); this._recent = new Array(24).fill(''); this._recentN = 0; this._log = []; this._taps = null; this._cut = {}; this._events = []; this.reports = {};      // (reports: name -> fn() of what another owner of sound has alive, shown by health()) this._warned = null;
    this.levels = {}; for (const k of LEVEL_NAMES) this.levels[k] = 1;
    this._onLevel = {}; this.out = null; this.voiceBus = null; this.chatBus = null;
    try { const raw = globalThis.localStorage.getItem(PREF_LEVELS), o = raw ? JSON.parse(raw) : null; if (o) for (const k of LEVEL_NAMES) if (isFinite(o[k]) && o[k] >= 0 && o[k] <= 2) this.levels[k] = +o[k]; } catch { /* storage blocked / node / not JSON */ }
    try { const o = globalThis.localStorage.getItem(PREF_OUT); if (o === 'sp' || o === 'hp') this.output = o; } catch { /* storage blocked / node */ }
    // The U key (music + ambience: full / half / off) is gone: the sliders do it. A setting saved by it is folded into
    // them once — ambience (the bells with it), venue music and the background music each times what U had — so nobody is left with a
    // silence there is no key to undo.
    try {
      const LS = globalThis.localStorage, raw = LS.getItem(PREF), v = +raw;
      if (raw !== null && LEVELS.includes(v) && v < 1) {
        this.levels.ambience *= v; this.levels.venue *= v;
        const m = LS.getItem('gto.soundtrack'), mv = m !== null && m !== '' && isFinite(+m) ? +m : 1; LS.setItem('gto.soundtrack', String(Math.round(mv * v * 100) / 100));
        LS.setItem(PREF_LEVELS, JSON.stringify(this.levels)); LS.setItem(PREF, '1');
      }
    } catch { /* storage blocked / node */ }
  }
  /** Must be called from a user gesture (the Play button does it). `ctx` may be injected (OfflineAudioContext in tools). */
  start(ctx = null) {
    if (this.ctx) return;
    try {
      const AC = ctx ? null : (globalThis.AudioContext || globalThis.webkitAudioContext);
      if (!ctx && !AC) return;
      this.ctx = ctx || new AC();
      this.offline = !!ctx;
      const c = this.ctx;
      // a limiter so that nothing a module does can clip the output (idle in normal play: levels are set to peak under −4 dBFS)
      this.limiter = c.createDynamicsCompressor();
      this.limiter.threshold.value = -4; this.limiter.knee.value = 3; this.limiter.ratio.value = 16; this.limiter.attack.value = 0.002; this.limiter.release.value = 0.15;
      this.limiter.connect(c.destination);
      const Lv = this.levels;
      this.out = c.createGain(); this.out.gain.value = MASTER_BASE * Lv.master; this.out.connect(this.limiter);
      this.master = c.createGain(); this.master.gain.value = Lv.fx; this.master.connect(this.out);                 // vehicles and effects (and anything that connects to "master")
      this.voiceBus = c.createGain(); this.voiceBus.gain.value = VOICE_BASE * Lv.voice; this.voiceBus.connect(this.out);
      this.chatBus = c.createGain(); this.chatBus.gain.value = Lv.chat; this.chatBus.connect(this.out);
      this.bedVol = c.createGain(); this.bedVol.gain.value = this.bedLevel; this.bedVol.connect(this.out);
      this.bed = c.createGain(); this.bed.gain.value = 1; this.bed.connect(this.bedVol);
      this.music = c.createGain(); this.music.gain.value = VENUE_BASE * Lv.venue; this.music.connect(this.bed);
      this.ambience = c.createGain(); this.ambience.gain.value = Lv.ambience; this.ambience.connect(this.bed);
      this._buffers();
      if (!this.offline) {
        // the watchdog (heal()): once a second, on its own timer — it must not depend on any system of the game still running
        try { const iv = setInterval(() => this.heal(), 1000); if (iv && iv.unref) iv.unref(); } catch { /* */ }
        try { c.addEventListener('statechange', () => { this._note('context ' + c.state + (typeof document !== 'undefined' && document.hidden ? ' (page hidden)' : '')); }); } catch { /* */ }
        try { if (globalThis.navigator && navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { this._note('the sound devices changed'); this._devT = Date.now(); }); } catch { /* */ }
      }
      if (!this.offline && typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          try { if (document.hidden) this.ctx.suspend(); else this.ctx.resume(); } catch { /* */ }
        });
      }
    } catch (e) { console.warn('[audio] unavailable', e); this.ctx = null; this.master = this.music = this.ambience = this.out = this.voiceBus = this.chatBus = null; }
  }
  _buffers() {
    const c = this.ctx, sr = c.sampleRate, n = Math.floor(sr * 2.5);
    // deterministic noise (same buffers for every player and for the offline tests)
    let s = 0x2545f491; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
    const w = (this.noiseBuf = c.createBuffer(1, n, sr)).getChannelData(0);
    for (let i = 0; i < n; i++) w[i] = rnd();
    const b = (this.brownBuf = c.createBuffer(1, n, sr)).getChannelData(0);
    // brown noise: n + xf samples, the overhang cross-faded into the head so the loop point is seamless; DC removed
    const xf = Math.floor(sr * 0.05), tmp = new Float32Array(n + xf);
    let v = 0, mean = 0;
    for (let i = 0; i < n + xf; i++) { v = v * 0.985 + rnd() * 0.12; tmp[i] = v; mean += v; }
    mean /= n + xf;
    for (let i = 0; i < n; i++) b[i] = tmp[i] - mean;
    for (let i = 0; i < xf; i++) { const k = i / xf; b[i] = (tmp[i] - mean) * k + (tmp[n + i] - mean) * (1 - k); }
    mean = 0; for (let i = 0; i < n; i++) mean += b[i]; mean /= n; for (let i = 0; i < n; i++) b[i] -= mean;
  }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  get running() { return !!this.ctx && (this.offline || this.ctx.state === 'running'); }

  // ---------------------------------------------------------------- mix controls
  /** speech playing → dip the bed (music + ambience) by ~5 dB; smooth both ways */
  /**
   * SELF-HEALING (2026-11, after "all of the sound stopped ... and does not come back"). Called about once a second
   * (systems/ambience.js). Three ways the sound can die for good, each put right here, with one warning each:
   *   the context is suspended while the page is showing  -> resumed; its clock has stopped though it says "running" -> kicked
   *   a bus gain is not a number, or sits at nothing though its saved level is not  -> set again from the saved level
   *   a sample that is not a number has reached the output: every filter, convolver and the limiter it passed through
   *   then gives nothing but NaN for ever  -> the output chain (limiter, the under-water filter) is made anew, and
   *   whoever registered with onPoison(fn) is asked to rebuild what it owns (the ambience rebuilds its synthesiser)
   * -> a short word for what was done ('' = all well). audio.healed counts them.
   */
  /** the wall clock in ms (a test puts its own here) */
  wall() { return Date.now(); }
  /** a line in the watchdog's diary (health().events): the last forty things that happened to the sound, with the context's time */
  _note(what) { const E = this._events || (this._events = []); E.push((this.ctx ? this.ctx.currentTime.toFixed(1) : '-') + ' s: ' + what); if (E.length > 40) E.shift(); }
  heal() {
    const c = this.ctx; if (!c || !this.out) return '';
    let did = '';
    try {
      if (!this.offline && c.state !== 'running' && c.state !== 'closed' && !(typeof document !== 'undefined' && document.hidden)) { this._note('context was ' + c.state + ': resumed'); const p = c.resume(); if (p && p.catch) p.catch((e) => this._note('resume refused: ' + (e && e.message))); did = 'resumed'; this._bad('the AudioContext was ' + c.state + ': resumed'); }
      if (!this.offline && c.state === 'closed' && !this._closedSaid) { this._closedSaid = true; this._note('the AudioContext is CLOSED: only a reload brings sound back'); console.warn('[audio] the AudioContext is closed'); }
      const t = c.currentTime, L = this.levels;
      // the context says it is running but its clock has stopped (the output device went away under it): kick it
      if (!this.offline && c.state === 'running') { const w = this.wall(); if (t !== this._healT) { this._healT = t; this._healW = w; } else if (w - this._healW >= 2500) { this._healW = w; this._note('the audio clock had stopped at ' + t.toFixed(1) + ' s: context restarted'); this._bad('the audio clock had stopped: restarting the context'); did = did || 'kicked'; try { const p = c.suspend(); if (p && p.then) p.then(() => c.resume(), () => {}); } catch { /* */ } } }
      const fix = (node, want, name) => { if (!node) return; const v = node.gain.value; if (!isFinite(v) || (want > 0.001 && Math.abs(v) < want * 0.02 && (node._low = (node._low || 0) + 1) >= 3)) { node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(want, t); node._low = 0; did = did || 'gain'; this._bad('the ' + name + ' volume was ' + v + ': set back to ' + want); } else if (Math.abs(v) >= want * 0.02) node._low = 0; };
      fix(this.out, MASTER_BASE * L.master, 'output'); fix(this.master, L.fx, 'effects'); fix(this.voiceBus, VOICE_BASE * L.voice, 'voices'); fix(this.chatBus, L.chat, 'microphones');
      fix(this.bedVol, this.bedLevel, 'music + ambience'); fix(this.bed, this._duck ? 0.55 : 1, 'bed'); fix(this.music, VENUE_BASE * L.venue, 'venue music'); fix(this.ambience, L.ambience, 'ambience');
      // is every bus, and the output itself, still made of numbers? (an analyser on each: which one went first names the culprit)
      if (c.createAnalyser && !this.offline) {
        const buf = this._nanBuf || (this._nanBuf = new Float32Array(256));
        if (!this._taps) { this._taps = {}; const tap = (name, node) => { if (!node) return; const a = c.createAnalyser(); a.fftSize = 256; node.connect(a); this._taps[name] = a; }; tap('fx', this.master); tap('voice', this.voiceBus); tap('chat', this.chatBus); tap('venue', this.music); tap('ambience', this.ambience); tap('bed', this.bedVol); tap('out', this.out); tap('limiter', this.limiter); }
        const isNaNOn = (a) => { a.getFloatTimeDomainData(buf); for (let i = 0; i < 256; i += 4) { const v = buf[i]; if (v !== v || v === Infinity || v === -Infinity) return true; } return false; };
        let bad = false; const which = [];
        for (const k in this._taps) if (isNaNOn(this._taps[k])) { which.push(k); if (k === 'out' || k === 'limiter') bad = true; }
        if (which.length && !bad && (this._cool || 0) <= 0) bad = true;      // (a bus has gone though the output has not yet: same cure)
        // a bus cut out earlier: put back once it has been clean for five looks
        for (const k in this._cut) { const B = this._cut[k]; if (which.includes(k)) { B.clean = 0; which.splice(which.indexOf(k), 1); } else if (++B.clean >= 5) { try { B.node.connect(B.to); } catch { /* */ } delete this._cut[k]; this._note('the ' + k + ' bus is clean again: put back'); } }
        if (!which.some((k) => k !== 'bed')) bad = false;
        // still non-numbers on a bus right after a rebuild: something on it goes on making them. Cut that bus out so that everything else can be heard.
        if (which.length && (this._after || 0) > 0) {
          const PARENT = { fx: [this.master, this.out], voice: [this.voiceBus, this.out], chat: [this.chatBus, this.out], venue: [this.music, this.bed], ambience: [this.ambience, this.bed] };
          for (const k of which) if (PARENT[k] && !this._cut[k]) { try { PARENT[k][0].disconnect(PARENT[k][1]); } catch { /* */ } this._cut[k] = { node: PARENT[k][0], to: PARENT[k][1], clean: 0 }; this._note('the ' + k + ' bus went on giving non-numbers after the rebuild: CUT OUT until it is clean (last sounds: ' + this._recent.filter(Boolean).slice(-4).join('; ') + ')'); console.warn('[audio] the ' + k + ' bus is still poisoned: cut out so the rest can be heard'); }
          for (const k in this._cut) if (which.includes(k)) which.splice(which.indexOf(k), 1);
          if (!which.some((k) => k !== 'bed' && k !== 'out' && k !== 'limiter')) { bad = false; this._cool = 0; }      // (what is left on the output drains away now that its source is cut)
        }
        if ((this._after || 0) > 0) this._after--;
        if ((this._cool || 0) > 0) { this._cool--; bad = false; }
        if (bad) {
          const first = which.filter((k) => k !== 'out' && k !== 'limiter' && k !== 'bed');
          const entry = { at: +t.toFixed(1), poisoned: which.slice(), handles: this._handles.size, hrtf: this.hrtf, recent: this._recent.filter(Boolean).slice(-10) };
          this._log.push(entry); if (this._log.length > 12) this._log.shift(); this._note('DIED: non-numbers on ' + which.join(', ') + ' — rebuilt'); this._after = 5;
          console.warn('[audio] sound had died: non-numbers on ' + which.join(', ') + ' — rebuilding. game.audio.health() has the details.', entry);
          // every occlusion filter on a poisoned bus (they latch), then the shared chain
          for (const h of this._handles) if (!first.length || first.includes(h._bus) || (h._bus === 'bells' && first.includes('ambience'))) { try { h._refilter(); } catch { /* */ } }
          this._cool = 2;
          this._bad('the output had stopped being numbers (a NaN reached the limiter): output chain rebuilt');
          const old = this.limiter, lim = c.createDynamicsCompressor();
          lim.threshold.value = -4; lim.knee.value = 3; lim.ratio.value = 16; lim.attack.value = 0.002; lim.release.value = 0.15; lim.connect(c.destination);
          try { this.out.disconnect(); if (this._lp) this._lp.disconnect(); old.disconnect(); } catch { /* */ }
          this._lp = null; this.limiter = lim; this.out.connect(lim); if (this._taps && c.createAnalyser) { const a2 = c.createAnalyser(); a2.fftSize = 256; lim.connect(a2); this._taps.limiter = a2; }
          for (const fn of this._onPoison || []) { try { fn(); } catch (e) { console.warn('[audio] onPoison', e); } }
          did = 'rebuilt';
        }
      }
    } catch (e) { this._bad('heal(): ' + (e && e.message)); }
    if (did) this.healed = (this.healed || 0) + 1;
    return did;
  }
  /**
   * What the watchdog knows, to paste into a bug report: the context's state, the volumes and bus gains, how many
   * positioned sounds are alive, what has been refused or repaired, and for each time the sound died: which buses
   * carried non-numbers and the last sounds started before it.
   */
  health() {
    const c = this.ctx, g = (n) => (n ? +n.gain.value.toFixed(4) : null);
    return { state: c ? c.state : 'no context', time: c ? +c.currentTime.toFixed(1) : 0, sampleRate: c ? c.sampleRate : 0, output: this.output, levels: { ...this.levels }, bedLevel: this.bedLevel,
      gains: { out: g(this.out), fx: g(this.master), voice: g(this.voiceBus), chat: g(this.chatBus), bedVol: g(this.bedVol), bed: g(this.bed), venue: g(this.music), ambience: g(this.ambience) },
      spatials: this.spatials, hrtf: this.hrtf, peakHrtf: this.peakHrtf, handles: this._handles.size, followed: this._follow.length, refused: this.refused || 0, healed: this.healed || 0,
      warnings: Object.keys(this._warned || {}), cut: Object.keys(this._cut), events: (this._events || []).slice(), deaths: this._log.slice(), recent: this._recent.filter(Boolean).slice(-12), ...this._reports() };
  }
  _reports() { const o = {}; for (const k in this.reports) { try { o[k] = this.reports[k](); } catch (e) { o[k] = 'error: ' + (e && e.message); } } return o; }
  /** fn() is called when the output chain has had to be rebuilt after a NaN: rebuild the nodes you keep (your filters may be latched too) */
  onPoison(fn) { (this._onPoison || (this._onPoison = [])).push(fn); }
  duck(on) {
    if (!this.ctx || on === this._duck) return;
    this._duck = on;
    this.bed.gain.setTargetAtTime(on ? 0.55 : 1, this.ctx.currentTime, on ? 0.08 : 0.35);
  }
  setBedLevel(v) {
    this.bedLevel = Math.max(0, Math.min(1, v));
    try { globalThis.localStorage.setItem(PREF, String(this.bedLevel)); } catch { /* */ }
    if (this.ctx) this.bedVol.gain.setTargetAtTime(this.bedLevel, this.ctx.currentTime, 0.1);
    return this.bedLevel;
  }
  /**
   * Head under water (systems/swim.js): k = 1 low-passes everything on the way to the limiter, 0 opens it again.
   * The filter is only put in the chain the first time it is asked for.
   */
  muffle(k) {
    if (!this.ctx || !this.master) return;
    if (!this._lp) {
      if (!k) return;
      const f = (this._lp = this.ctx.createBiquadFilter()); f.type = 'lowpass'; f.frequency.value = 20000; f.Q.value = 0.6;
      this.out.disconnect(); this.out.connect(f); f.connect(this.limiter);
    }
    this._lp.frequency.setTargetAtTime(k > 0 ? 20000 * Math.pow(0.019, Math.min(1, k)) : 20000, this.ctx.currentTime, k > 0 ? 0.05 : 0.12);
  }
  /** one of the volumes of the sound panel (LEVEL_NAMES): 0 (off) .. 1 (as made) .. 2; saved; -> the value kept */
  setLevel(name, v, save = true) {
    if (!LEVEL_NAMES.includes(name)) return 0;
    v = Math.max(0, Math.min(2, isFinite(v) ? +v : 1)); this.levels[name] = v;
    if (save) { try { globalThis.localStorage.setItem(PREF_LEVELS, JSON.stringify(this.levels)); } catch { /* */ } }
    const c = this.ctx, t = c ? c.currentTime : 0, to = (node, g) => { if (c && node) node.gain.setTargetAtTime(g, t, 0.05); };
    if (name === 'master') to(this.out, MASTER_BASE * v); else if (name === 'fx') to(this.master, v); else if (name === 'voice') to(this.voiceBus, VOICE_BASE * v);
    else if (name === 'chat') to(this.chatBus, v); else if (name === 'venue') to(this.music, VENUE_BASE * v); else if (name === 'ambience') to(this.ambience, v);
    const fn = this._onLevel[name]; if (fn) { try { fn(v); } catch (e) { console.warn('[audio] level', name, e); } }
    return v;
  }
  /** the owner of a volume that is not a bus here (the soundtrack's player: 'music'; the ambience's bells: 'bells') is told when it changes — and now */
  onLevel(name, fn) { this._onLevel[name] = fn; try { fn(this.levels[name]); } catch { /* */ } }
  /** every volume back to 100% */
  resetLevels() { for (const k of LEVEL_NAMES) this.setLevel(k, 1, false); try { globalThis.localStorage.setItem(PREF_LEVELS, JSON.stringify(this.levels)); } catch { /* */ } return this.levels; }
  get ambLevel() { return this.levels.ambience; }
  setAmbLevel(v) { return this.setLevel('ambience', v); }
  /** music + ambience: full → half → off → full */
  cycleBed() { const i = LEVELS.indexOf(this.bedLevel); return this.setBedLevel(LEVELS[(i + 1) % LEVELS.length]); }

  // ---------------------------------------------------------------- positioned sources
  /** where the listener (camera) is and which way it faces: forward = (sin yaw, cos yaw). Values that are not numbers are refused (the last good ones stand). */
  listener(x, z, yaw, y = 1.6) {
    if (!(isFinite(x) && isFinite(z) && isFinite(yaw))) { this._bad('listener'); return; }
    if (!isFinite(y)) y = this._lh;
    this._lx = x; this._lz = z; this._ly = yaw; this._lh = y; this._tick++;
    const c = this.ctx; if (!c || !c.listener) return;
    const L = c.listener, fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (L.positionX) { L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z; L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else if (L.setPosition) { L.setPosition(x, y, z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
    // sounds that follow something moving (a speaker walking, a car), and one-shots nobody freed: brought up to date here
    const F = this._follow, P = this._P, now = c.currentTime;
    for (let i = F.length - 1; i >= 0; i--) {
      const h = F[i];
      if (h.dead || (h._ttl && now > h._ttl)) { if (!h.dead) h.free(); F[i] = F[F.length - 1]; F.pop(); continue; }
      if (!h._src) continue;
      try { this._resolve(typeof h._src === 'function' ? h._src() : h._src, h._dy, P); } catch (e) { this._bad('a position function threw (' + (e && e.message) + ')'); continue; }
      h.set(P.x, P.y, P.z); h._place = P.place;
      if (this.occlusion && this.occlusion.enabled) continue;      // (walls: core/_occlusion.js looks at every positioned sound, below; what follows is how it was done without it)
      if (h._auto && P.other !== h._other) { h._other = P.other; h.occlude(P.other ? 0.85 : 0); }
      if ((h._walls || (h._auto && !P.other)) && ((this._tick + i) % 10) === 0 && this.occluder) { let k = 0; try { k = this.occluder(P.x, P.z) ? 0.7 : 0; } catch { k = 0; } if (k !== h._wk) { h._wk = k; h.occlude(k); } }      // (in the same place: a wall between, by one ray)
    }
    if (this.occlusion) this.occlusion.update(this);
  }
  /** one warning, ever, for each kind of bad value handed to this file (a NaN position, an infinite gain): the call is dropped, nothing throws */
  _bad(what) { this.refused = (this.refused || 0) + 1; const W = this._warned || (this._warned = {}); if (!W[what]) { W[what] = true; console.warn('[audio] a value that is not a number was refused: ' + what); } return false; }
  /**
   * A position as given by a caller -> out {x, y, z} in the frame the listener is in, and out.other = the source is in
   * another place than the listener (the other side of a wall). pos = {x, y?, z, place?} | [x, z]; place = the id of
   * the room whose coordinates these are ('world' = the map). The rooms' frames come from audio.frames(id) and
   * audio.framePlace (the listener's place), both kept by systems/ambience.js.
   */
  _resolve(pos, dy, out) {
    let x, y, z, place;
    if (Array.isArray(pos)) { x = pos[0]; z = pos[1]; y = 0; } else if (pos) { x = pos.x; z = pos.z; y = pos.y || 0; place = pos.place; }
    out.other = false;
    if (place !== undefined && place !== null && this.framePlace && place !== this.framePlace) {
      out.other = true;
      const Fr = this.frames, A = place !== 'world' && Fr ? Fr(place) : null, B = this.framePlace !== 'world' && Fr ? Fr(this.framePlace) : null, w = this._w2 || (this._w2 = [0, 0]);
      if ((place !== 'world' && !A) || (this.framePlace !== 'world' && !B)) { x = this._lx; z = this._lz; y = this._lh - dy; }      // (a room with no place on the map: nowhere in particular)
      else { if (A) { A.toWorld(x, z, w); x = w[0]; z = w[1]; y += A.base(); } if (B) { B.toLocal(x, z, w); x = w[0]; z = w[1]; y -= B.base(); } }
    }
    y += dy;
    if (!(isFinite(x) && isFinite(y) && isFinite(z))) { this._bad('a position'); x = this._lx; y = this._lh; z = this._lz; }
    out.x = x; out.y = y; out.z = z; out.place = place;
    return out;
  }
  /** 'hp' (headphones: binaural) <-> 'sp' (speakers: equal-power panning); saved. Sounds already playing keep what they had. */
  cycleOutput() { return this.setOutput(this.output === 'hp' ? 'sp' : 'hp'); }
  setOutput(o) { if (o === 'hp' || o === 'sp') { this.output = o; try { globalThis.localStorage.setItem(PREF_OUT, o); } catch { /* */ } } return this.output; }
  /**
   * A place in the world for a sound (see the top of this file). -> an AudioNode to play into (connect your source to
   * it; it is also reachable as .in) carrying .set(x, y, z), .occlude(k), .free(), .hrtf; null without an AudioContext.
   * pos may be a function returning the position (asked every frame). Also understood, as places/_pt_audio.js asks:
   * opts.kind ('music' -> the music bus, 'crowd' -> the ambience bus), refDistance, rolloff, occlusion: true (muffled
   * by itself whenever the source is in another place than the listener), reverb (> 0: sent into the room).
   * A node nobody says how to free (no follow, no until, no keep, not music / crowd) frees itself after opts.ttl s (8).
   */
  spatial(pos, opts = {}) {
    const c = this.ctx; if (!c) return null;
    const fn = typeof pos === 'function' ? pos : null, kind = opts.kind, p0 = fn ? fn() : pos;
    const C = CLASSES[opts.cls] || (kind === 'music' ? CLASSES.wall : kind === 'crowd' ? CLASSES.voice : CLASSES.small);
    const bus = opts.bus || (kind === 'music' ? 'venue' : kind === 'crowd' ? 'ambience' : BUS_OF[opts.cls] || 'fx');
    const dest = opts.dest || (bus === 'venue' && this.music ? this.music : bus === 'ambience' || bus === 'bells' ? this.ambience || this.master : bus === 'voice' && this.voiceBus ? this.voiceBus : bus === 'chat' && this.chatBus ? this.chatBus : this.master);
    const tagged = p0 && !Array.isArray(p0) && p0.place !== undefined;
    const dy = opts.dy ?? (tagged ? 0 : opts.cls === 'voice' ? 1.6 : opts.cls === 'step' ? 0.1 : 1.2), P = this._resolve(p0, dy, this._P);
    if (!c.createPanner) { const g = c.createGain(); g.in = g.out = g; g.connect(dest); g.set = g.occlude = () => {}; g.dead = false; g.hrtf = false; g.free = () => { if (!g.dead) { g.dead = true; try { g.disconnect(); } catch { /* */ } } }; return g; }
    const p = c.createPanner(), hrtf = this.output === 'hp' && this.hrtf < MAX_HRTF && !opts.cheap;
    p.panningModel = hrtf ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.maxDistance = 100000;
    p.refDistance = isFinite(opts.refDistance) && opts.refDistance > 0 ? opts.refDistance : C.ref; p.rolloffFactor = opts.dist === false ? 0 : isFinite(opts.rolloff) ? Math.max(0, opts.rolloff) : C.roll;
    if (p.positionX) { p.positionX.value = P.x; p.positionY.value = P.y; p.positionZ.value = P.z; } else p.setPosition(P.x, P.y, P.z);
    const auto = opts.occlusion === true, svc = this.occlusion && this.occlusion.enabled ? this.occlusion : null; const h = p; let f = null, og = null;
    const rev = this.reverbIn && (opts.cls === 'voice' || opts.rev || opts.reverb > 0) ? this.reverbIn : null;
    // a character's voice with no occlusion of its own asked for: muffled when a wall stands between (audio.occluder, asked a few times a second while it speaks)
    const walls = !svc && opts.cls === 'voice' && !!this.occluder && opts.occl === undefined && !auto && (!!opts.follow || !!fn);
    p.connect(dest);
    if (rev) p.connect(rev);      // into the room you are in (systems/_amb_synth.js sets the send by the room: nothing out of doors)
    // BEHIND A WALL: a low-pass and a gain AFTER the panner, made the first time this sound is muffled (a sound that never
    // is has neither). Two askers, the stronger wins: the caller (opts.occl, h.occlude(k): k 0..1) and the walls
    // (core/_occlusion.js: h._occSet(gain, hz, seconds)). Every change is eased on the audio thread: no step, no click.
    h._k = Math.max(0, Math.min(1, svc ? +opts.occl || 0 : auto ? (P.other ? 0.85 : 0) : +opts.occl || 0)); h._og = 1; h._ohz = OPEN_HZ;
    const chain = () => { f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7; f.frequency.value = OPEN_HZ; og = c.createGain(); og.gain.value = 1; try { p.disconnect(dest); if (rev) p.disconnect(rev); } catch { try { p.disconnect(); } catch { /* */ } } p.connect(f); f.connect(og); og.connect(dest); if (rev) og.connect(rev); h._f = f; h._g = og; };
    const muffle = (tc) => {
      if (h.dead) return;
      const k = h._k, g = Math.max(0, Math.min(1 - 0.6 * k, h._og)), hz = Math.max(60, Math.min(k > 0 ? 16000 * Math.pow(0.05, k) : OPEN_HZ, h._ohz));
      if (!(isFinite(g) && isFinite(hz))) { this._bad('an occlusion'); return; }
      if (!f) { if (g > 0.995 && hz > OPEN_HZ * 0.95) return; chain(); if (!(tc > 0)) { f.frequency.value = hz; og.gain.value = g; return; } }
      const tt = c.currentTime;
      if (tc > 0) { f.frequency.setTargetAtTime(hz, tt, tc); og.gain.setTargetAtTime(g, tt, tc); } else { f.frequency.setValueAtTime(hz, tt); og.gain.setValueAtTime(g, tt); }
    };
    h._occSet = (g, hz, tc) => { if (Math.abs(g - h._og) < 0.004 && Math.abs(hz - h._ohz) < h._ohz * 0.01) return; h._og = g; h._ohz = hz; muffle(tc); };
    if (h._k > 0) muffle(0);
    if (hrtf) { this.hrtf++; if (this.hrtf > this.peakHrtf) this.peakHrtf = this.hrtf; }
    this.spatials++;
    h.in = h; h.out = p; h.hrtf = hrtf; h.dead = false; h._x = P.x; h._y = P.y; h._z = P.z; h._dy = dy; h._auto = auto; h._other = P.other; h._walls = walls; h._wk = 0;
    h._place = tagged ? p0.place : undefined; h._cls = opts.cls || (kind === 'music' ? 'wall' : kind === 'crowd' ? 'voice' : 'small'); h._oc = opts.occlude;
    h.set = (nx, ny, nz) => { if (h.dead || (nx === h._x && ny === h._y && nz === h._z)) return; if (!(isFinite(nx) && isFinite(ny) && isFinite(nz))) { this._bad('a position'); return; } h._x = nx; h._y = ny; h._z = nz; const tt = c.currentTime; if (p.positionX) { p.positionX.setTargetAtTime(nx, tt, 0.04); p.positionY.setTargetAtTime(ny, tt, 0.04); p.positionZ.setTargetAtTime(nz, tt, 0.04); } else p.setPosition(nx, ny, nz); };
    h.occlude = (k) => { if (h.dead || !isFinite(k)) return; k = Math.max(0, Math.min(1, k)); if (k === h._k) return; h._k = k; muffle(0.15); };
    h.free = () => { if (h.dead) return; h.dead = true; this.spatials--; if (hrtf) this.hrtf--; this._handles.delete(h); try { p.disconnect(); if (f) { f.disconnect(); og.disconnect(); } } catch { /* */ } };
    /** a filter that has had a NaN through it gives NaN for ever: a new one in its place (heal()) */
    h._refilter = () => { if (!f || h.dead) return false; const was = f; try { p.disconnect(was); was.disconnect(); } catch { /* */ } f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7; f.frequency.value = OPEN_HZ; f.connect(og); p.connect(f); h._f = f; muffle(0); return true; };
    h._bus = bus; this._handles.add(h);
    { const R = this._recent; R[this._recentN++ % R.length] = (opts.cls || kind || 'small') + '>' + bus + ' @' + c.currentTime.toFixed(1) + ' (' + P.x.toFixed(1) + ',' + P.y.toFixed(1) + ',' + P.z.toFixed(1) + ')' + (hrtf ? ' hrtf' : ''); }
    const persistent = kind === 'music' || kind === 'crowd' || opts.keep;
    h._src = fn || (opts.follow || (tagged && persistent) ? p0 : null);
    if (!h._src && !opts.until && !persistent && opts.ttl !== 0 && (tagged || opts.ttl)) h._ttl = c.currentTime + (opts.ttl || 8);      // (a one-shot's node that its caller will not free)
    if (h._src || h._ttl) this._follow.push(h);
    if (opts.until) { const s2 = opts.until, was = s2.onended; s2.onended = (e) => { h.free(); if (was) was.call(s2, e); }; }
    if (svc) svc.born(this, h);
    return h;
  }
  /** → {pan −1..1, gain 0..1, dist} for a source at world (x, z) audible out to `range` metres. Reuses one object. */
  place(x, z, range = 60) {
    const dx = x - this._lx, dz = z - this._lz, d = Math.hypot(dx, dz), r = this._res;
    const rx = -Math.cos(this._ly), rz = Math.sin(this._ly);
    r.x = x; r.z = z; r.at = this._tick;
    r.dist = d; r.pan = d < 0.5 ? 0 : Math.max(-0.85, Math.min(0.85, ((dx * rx + dz * rz) / d) * Math.min(1, d / 6)));
    const k = Math.max(0, 1 - d / range); r.gain = k * k;
    if (!(isFinite(r.pan) && isFinite(r.gain) && isFinite(d))) { this._bad('place(' + x + ', ' + z + ')'); r.pan = 0; r.gain = 0; r.dist = 1e9; r.at = -1; }
    return r;
  }
  /**
   * A continuous sound that its owner steers with a pan from place() (a bonfire, a band, a choir): -> a stand-in for the
   * StereoPanner it used to make — connect into .in, and .pan.setTargetAtTime(pan) puts the sound AT the place that
   * pan was just worked out for (place() in the same frame); .disconnect() frees it. Binaural on headphones.
   */
  steered(dest = null) {
    const h = this.spatial([this._lx, this._lz], { dist: false, keep: true, dest: dest || this.master }); if (!h) return null;
    const R = this._res, self = this;
    return { in: h, pan: { value: 0, setTargetAtTime(v) { if (v === R.pan && R.at === self._tick && isFinite(R.x) && isFinite(R.z)) h.set(R.x, 1.5, R.z); } }, disconnect() { h.free(); } };
  }
  /** tone() / noise() with opts.pos ([x, z] | {x, y, z, place?}) and opts.cls: the sound is AT that place, falling off with distance as its class does */
  _at(node, pos, cls, dest) { const h = this.spatial(pos, { cls, dest: dest || this.master, ttl: 0 }); if (!h) { node.connect(dest || this.master); return null; } node.connect(h); return { disconnect: h.free }; }
  /** connect `node` through a StereoPanner to dest (falls back to a plain connect); returns the panner or null */
  panTo(node, pan, dest = null) {
    const d = dest || this.master;
    if (!isFinite(pan)) { this._bad('a pan'); pan = 0; }
    // the pan place() has just given: the sound is put at that place (direction only: the caller's gain has the distance in it)
    if (pan && pan === this._res.pan && this._res.at === this._tick && this.ctx.createPanner) { const h = this.spatial([this._res.x, this._res.z], { dist: false, dest: d, ttl: 0 }); node.connect(h); return { disconnect: h.free }; }
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(d); return p; }
    node.connect(d); return null;
  }

  // ---------------------------------------------------------------- one-shots
  /** One-shot oscillator note. Safe to call before start(). */
  tone(freq, dur = 0.2, { type = 'sine', gain = 0.2, attack = 0.005, when = 0, dest = null, pan = 0, pos = null, cls = 'small' } = {}) {
    if (!this.ctx) return;
    if (!(isFinite(freq) && isFinite(dur) && isFinite(gain) && isFinite(when) && isFinite(attack) && dur > 0)) { this._bad('tone()'); return; }
    const t = this.ctx.currentTime + Math.max(0, when), o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    o.connect(g); const p = pos ? this._at(g, pos, cls, dest) : this.panTo(g, pan, dest); o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { try { g.disconnect(); if (p) p.disconnect(); } catch { /* */ } };
  }
  /** Filtered noise burst (thuds, clacks, splashes). Plays a slice of the shared noise buffer: no allocation. */
  noise(dur = 0.15, { gain = 0.2, freq = 1200, q = 1, type = 'bandpass', when = 0, dest = null, pan = 0, attack = 0.002, pos = null, cls = 'small' } = {}) {
    if (!this.ctx) return;
    if (!(isFinite(freq) && isFinite(dur) && isFinite(gain) && isFinite(when) && isFinite(q) && dur > 0)) { this._bad('noise()'); return; }
    const t = this.ctx.currentTime + Math.max(0, when);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noiseBuf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    src.connect(f); f.connect(g); const p = pos ? this._at(g, pos, cls, dest) : this.panTo(g, pan, dest);
    src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
    src.onended = () => { try { g.disconnect(); if (p) p.disconnect(); } catch { /* */ } };
  }
}
