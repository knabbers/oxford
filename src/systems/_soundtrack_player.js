// Recorded background music (systems/soundtrack.js; rules in _soundtrack_logic.js): the tracks in public/audio/music
// (CC0; see CREDITS.md there and tools/audio/prepare_music.mjs), played through <audio> elements: decoded by the
// browser as a stream, never on the main thread.
//
//   fetch ─► Blob ─► <audio> ─► MediaElementSource ─► gain (the mood's crossfade weight) ─► sum ─► tone (low-pass: night, rain)
//                                                        ─► high-pass 90 Hz ─► out (level × TRACK_GAIN) ─► audio.bed
//
// One <audio> element per playing track, made when the track is about to start and thrown away when it ends or has
// faded out. The file (about a megabyte of MP3) is fetched whole as a Blob first and played from an object URL: the
// game's server does not answer Range requests, and Chrome will not seek in a plain stream, which a track that
// carries on from where you left it needs. At most MAX_ALIVE exist at once (the track of the mood you are in and the
// one fading out behind you). A file that will not load or play marks its slot
// `failed` and the caller drops it: no sound, no message. `tap` listens to the game's own music bus (club, jukebox,
// organ, choir) so the explorer music can get out of its way.
export const TRACK_GAIN = 0.042;       // out gain at level 1 for tracks prepared at −23 LUFS: about 21 dB under the Parks' daytime ambience (20.7 to 22.3 by track)
export const MAX_ALIVE = 2;

export class TrackPlayer {
  /** can this browser (or test stub) stream an element into the graph? (an OfflineAudioContext cannot) */
  static supported(audio) { return !!(audio && audio.ctx && typeof audio.ctx.createMediaElementSource === 'function' && typeof globalThis.Audio === 'function'); }
  constructor(audio, base) {
    const c = (this.ctx = audio.ctx); this.audio = audio; this.base = base;
    this.slots = []; this.started = 0; this.peakAlive = 0; this.awake = false; this.level = 0;
    const G = (v) => { const g = c.createGain(); g.gain.value = v; return g; };
    this.out = G(0);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90; hp.Q.value = 0.6; hp.connect(this.out);      // background music: no bass to speak of
    this.tone = c.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 9000; this.tone.Q.value = 0.5; this.tone.connect(hp);
    this.sum = G(1); this.sum.connect(this.tone);
    this.tap = null;
    if (c.createAnalyser && audio.music) {
      this.tap = c.createAnalyser(); this.tap.fftSize = 256; this._buf = new Float32Array(256);
      this._tapEnd = G(0); this.tap.connect(this._tapEnd);
    }
    // a hidden tab suspends the AudioContext (core/audio.js): hold the streams there too, so no track plays on unheard
    this._vis = () => { const hid = this._hidden(); for (const s of this.slots) { if (hid) { try { s.el.pause(); } catch { /* */ } } else if (!s.paused) this._play(s); } };
    this._hidden = () => { try { return !!globalThis.document.hidden; } catch { return false; } };
    this.wake();
  }
  wake() {
    if (this.awake) return; this.awake = true;
    this.out.connect(this.audio.bed || this.audio.master);
    if (this.tap) { this.audio.music.connect(this.tap); this._tapEnd.connect(this.audio.master); }
    try { globalThis.document.addEventListener('visibilitychange', this._vis); } catch { /* node */ }
  }
  /** leave the mix entirely and drop every stream (the music is off) */
  sleep() {
    if (!this.awake) return; this.awake = false;
    for (const s of this.slots.slice()) this.release(s);
    try { this.out.disconnect(); if (this.tap) { this.audio.music.disconnect(this.tap); this._tapEnd.disconnect(); } } catch { /* */ }
    try { globalThis.document.removeEventListener('visibilitychange', this._vis); } catch { /* node */ }
  }
  /** RMS on the game's own music bus right now (0 when it cannot be measured) */
  probe() {
    if (!this.tap || !this.awake) return 0;
    const b = this._buf; this.tap.getFloatTimeDomainData(b);
    let e = 0; for (let i = 0; i < b.length; i++) e += b[i] * b[i];
    return Math.sqrt(e / b.length);
  }
  setLevel(v, tau = 0.25) { this.level = v; this.out.gain.setTargetAtTime(v * TRACK_GAIN, this.ctx.currentTime, tau); }
  setTone(hz) { this.tone.frequency.setTargetAtTime(hz, this.ctx.currentTime, 1.5); }

  slotFor(mood) { for (const s of this.slots) if (s.mood === mood) return s; return null; }
  _play(s) {
    if (!s.ready) return;                                               // still downloading: it starts when it is in (unless paused by then)
    try { const p = s.el.play(); if (p && p.catch) p.catch(() => { if (!s.gone && !s.paused && !this._hidden()) s.failed = true; }); } catch { s.failed = true; }
  }
  /** start `track` ({id, file, duration}) for a mood at `offset` seconds, silent until setWeight(); → the slot, or null at the cap */
  start(mood, track, offset = 0) {
    if (this.slots.length >= MAX_ALIVE) return null;
    const c = this.ctx, s = { mood, track, el: null, src: null, g: null, url: null, w: -1, t0: c.currentTime, ready: false, live: false, ended: false, failed: false, paused: false, dying: false, gone: false };
    try {
      const el = (s.el = new globalThis.Audio());
      el.preload = 'auto'; el.loop = false;
      el.addEventListener('playing', () => { s.live = true; });
      el.addEventListener('ended', () => { s.ended = true; });
      el.addEventListener('error', () => { s.failed = true; });
      s.src = c.createMediaElementSource(el);
      s.g = c.createGain(); s.g.gain.value = 0;
      s.src.connect(s.g); s.g.connect(this.sum);
      globalThis.fetch(this.base + track.file).then((r) => { if (!r || !r.ok) throw 0; return r.blob(); }).then((b) => {
        if (s.gone) return;
        el.src = s.url = globalThis.URL.createObjectURL(b);
        if (offset > 0) {                                               // before the data: the default start position; again once the length is known
          const seek = () => { try { if (!(el.currentTime >= offset - 1)) el.currentTime = offset; } catch { /* from the top */ } };
          seek(); el.addEventListener('loadedmetadata', seek);
        }
        s.ready = true;
        if (!s.paused && !this._hidden()) this._play(s);
      }).catch(() => { s.failed = true; });
    } catch { s.failed = true; }
    this.slots.push(s); this.started++; if (this.slots.length > this.peakAlive) this.peakAlive = this.slots.length;
    return s;
  }
  /** crossfade weight 0..1 (equal power: two different tunes do not add up) */
  setWeight(s, w) { if (s.dying || !s.g || Math.abs(s.w - w) < 1e-4) return; s.w = w; s.g.gain.setTargetAtTime(Math.sin(Math.min(1, Math.max(0, w)) * Math.PI / 2), this.ctx.currentTime, 0.12); }
  /** a quick fade before release() (making room for a third mood's track) */
  fade(s) { s.dying = true; if (s.g) s.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); }
  pause(s) { if (s.paused) return; s.paused = true; try { s.el.pause(); } catch { /* */ } }
  resume(s) { if (!s.paused) return; s.paused = false; this._play(s); }
  position(s) { try { return s.el.currentTime || 0; } catch { return 0; } }
  release(s) {
    const i = this.slots.indexOf(s); if (i >= 0) this.slots.splice(i, 1);
    s.gone = true;
    try { if (s.el) s.el.pause(); } catch { /* */ }
    try { if (s.src) s.src.disconnect(); if (s.g) s.g.disconnect(); } catch { /* */ }
    try { if (s.el) { s.el.removeAttribute('src'); s.el.load(); } } catch { /* */ }      // frees the decoder
    try { if (s.url) globalThis.URL.revokeObjectURL(s.url); } catch { /* */ }
  }
}
