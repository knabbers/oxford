// The recorded sounds of the ambience (public/audio/ambient/, public domain / CC0 — docs/AUDIO_CREDITS.md; cut and
// levelled by tools/audio/prepare_ambient.mjs, table in _amb_manifest.js): bird phrases, and the beds of people talking
// (a street, a pub, a hall at dinner, a market, a café, children playing). The bytes are already on the device (the
// loading screen: core/assets.js answers the fetch from memory); a recording is DECODED the first time it is wanted,
// one at a time, in the background, and until it is ready (or if it never is, or with ?amb=synth) the ambience uses
// its synthesised stand-in — nothing waits and nothing fails without one.
// Memory: a bed is half a minute and more of sound, so beds are decoded at 24 kHz (voices in a crowd carry nothing
// above that) and a bed nobody has asked for in two minutes is let go (sweep()); it is decoded again when wanted.
import { AMB_SAMPLES, AMB_DIR } from './_amb_manifest.js';

const BASE = (() => { try { return new URL('../../' + AMB_DIR, import.meta.url).href; } catch { return AMB_DIR; } })();
const OFF = (() => { try { return /[?&]amb=synth(&|$)/.test(globalThis.location ? globalThis.location.search : ''); } catch { return false; } })();
const BED_RATE = 24000, KEEP_S = 120;

export class AmbSamples {
  constructor(audio, base = BASE) { this.audio = audio; this.base = base; this.buf = {}; this.state = {}; this.used = {}; this.off = OFF || !globalThis.fetch; this.queue = []; this.busy = false; this.loaded = 0; this.dropped = 0; this._bedCtx = null; }
  /** the table entry of `name` with its decoded buffer ({buf, slices} | {buf, bed, dur, rms}), or null while it is not here (asking starts the decoding) */
  get(name) {
    if (this.off) return null;
    const st = this.state[name];
    if (st === 2) { this.used[name] = this.audio.ctx ? this.audio.ctx.currentTime : 0; return this.buf[name]; }
    if (st === undefined && AMB_SAMPLES[name]) { this.state[name] = 1; this.queue.push(name); this._next(); }
    return null;
  }
  /** start on these (in order, one at a time) */
  want(names) { for (const n of names) this.get(n); }
  /** let go of the beds nobody has asked for in two minutes (call now and then) */
  sweep() {
    const t = this.audio.ctx ? this.audio.ctx.currentTime : 0;
    for (const n in this.buf) { const m = this.buf[n]; if (m && m.bed && t - (this.used[n] || 0) > KEEP_S) { delete this.buf[n]; delete this.state[n]; this.loaded--; this.dropped++; } }
  }
  _next() {
    if (this.busy || !this.queue.length) return;
    const name = this.queue.shift(), m = AMB_SAMPLES[name]; let ctx = this.audio.ctx;
    if (m.bed && globalThis.OfflineAudioContext) { try { ctx = this._bedCtx || (this._bedCtx = new globalThis.OfflineAudioContext(1, 1, BED_RATE)); } catch { ctx = this.audio.ctx; } }
    this.busy = true;
    const done = (ok, b) => { if (ok) { this.buf[name] = { ...m, buf: b }; this.state[name] = 2; this.used[name] = this.audio.ctx ? this.audio.ctx.currentTime : 0; this.loaded++; } else this.state[name] = 3; this.busy = false; this._next(); };
    try {
      globalThis.fetch(this.base + m.file).then((r) => { if (!r || !r.ok) throw 0; return r.arrayBuffer(); })
        .then((ab) => new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }))
        .then((b) => done(true, b), () => done(false));
    } catch { done(false); }
  }
}
