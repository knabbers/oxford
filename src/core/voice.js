// Pre-rendered voice clips (game.voice). Every speakable line is rendered offline by tools/voices/render.mjs into
// public/audio/voice/<id>.mp3 and listed in public/audio/voice/manifest.json {id: {file, dur, speaker, h}}, so every
// player hears the same audio whatever their device. A line's id is voiceId(speaker, text) — a stable hash of the
// speaker and the exact displayed text — so callers just pass the line itself. See docs/VOICES.md.
//
// Everyone speaks: every Character.say() goes through characterHook() (installed by main.js). A line is HEARD, with no
// bubble, when its clip exists, voices are on (the sound panel) and audio is running; otherwise the character shows the bubble as
// before (also late, if a clip then fails to load). People with a voice of their own (friends, tutors, the porter, the
// Hall cook) are known by their look's seed or ch.voiceAs; everyone else gets one of six crowd voices from their look
// (crowdSpeaker), the same on every client. Positional: volume by distance, at most MAX_VOICES at once, a nearer or
// named speaker takes the quietest crowd channel, one line at a time per person.
//
//   game.voice.say(speaker, text, { pos, dist, volume, interrupt }) -> Promise<{ played, via: 'clip'|'live'|null, dur }>
//       (the promise also carries .dur synchronously when the clip is known, so a bubble can stay up for its length)
//   game.voice.duration(speaker, text) -> seconds | null      game.voice.has(speaker, text) -> bool
//   game.voice.followDialog(speaker, lines)  speak each page of the ui.dialog that was just opened, as it is shown
//   game.voice.enabled / toggle() / stop(speaker?)            game.voice.debugPlay(id) -> Promise<{ played, dur }>
//
// No clip for a line (new, unrendered, or a {name} the render did not cover) → if every sentence of it has a clip, those
// play in sequence; otherwise the browser's live speechSynthesis (voice by the speaker's locale, as before), and if that
// is missing too, silence. Nothing but the small manifest is fetched up front; clips are fetched (relative to this
// module, so a GitHub Pages sub-path works) and decoded on first use, LRU-cached (~40). Nothing plays before the Play
// button has created game.audio.ctx. At most MAX_VOICES clips at once, one per channel (a speaker, or a character).
// This module is DOM-free at import (node smoke tests import it with mocks: tools/smoke_voice.mjs).

// ------------------------------------------------------------------------------------------------ ids (shared with tools/voices)
export function normText(t) { return String(t == null ? '' : t).normalize('NFC').replace(/\s+/g, ' ').trim(); }
/** cyrb53: fast 53-bit string hash → 14 hex chars */
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
/** stable clip id for (speaker, displayed text) */
export function voiceId(speaker, text) { return `${speaker}_${hash53(speaker + '␟' + normText(text)).slice(0, 12)}`; }
/** "A. B? C!" → ['A.', 'B?', 'C!'] (used when a whole line has no clip but its sentences do) */
export function splitSentences(t) { return normText(t).split(/(?<=[.!?…])\s+(?=\S)/).filter(Boolean); }

// ------------------------------------------------------------------------------------------------ crowd voices
/** Everyone without a voice of their own (walkers, shop staff, stewards, bouncers, police, passengers...) speaks with one
 *  of six stock voices, three per figure; the third of each is the older-sounding one. Chosen from the character's look
 *  (core/characters.js voiceHint: figure, grey/bald, seed), so the same person has the same voice on every client and
 *  nothing extra goes over the network. Every crowd line is rendered in all six (tools/voices/extract.mjs). */
export const CROWD = { m: ['crowd_m1', 'crowd_m2', 'crowd_m3'], f: ['crowd_f1', 'crowd_f2', 'crowd_f3'] };
export const CROWD_IDS = [...CROWD.m, ...CROWD.f];
export function crowdSpeaker(hint) {
  const H = hint || {}, pool = CROWD[H.fig === 'f' ? 'f' : 'm'];
  const h = parseInt(hash53('crowd␟' + (H.seed >>> 0), 7).slice(-8), 16) >>> 0;
  if (H.older) return pool[h % 4 === 0 ? (h >>> 4) % 2 : 2];      // grey / bald: mostly the older voice
  return pool[h % 8 === 0 ? 2 : (h >>> 4) % 2];
}

// ------------------------------------------------------------------------------------------------ live speech helpers
// (moved from places/_friends_voice.js, which re-exports them; covered by tools/smoke_friends.mjs)
const FEMALE = new Set(['joana', 'catarina', 'fernanda', 'luciana', 'raquel', 'alice', 'federica', 'paola', 'elsa', 'isabella', 'kyoko', 'o-ren', 'ayumi', 'haruka', 'nanami', 'veena', 'lekha', 'heera', 'neerja', 'kate', 'serena', 'stephanie', 'fiona', 'moira', 'tessa', 'karen', 'samantha', 'victoria', 'allison', 'ava', 'susan', 'zoe', 'martha', 'hazel', 'libby', 'sonia', 'maisie', 'emma', 'amy']);
const MALE = new Set(['joaquim', 'duarte', 'luca', 'cosimo', 'diego', 'otoya', 'hattori', 'ichiro', 'keita', 'rishi', 'ravi', 'prabhat', 'daniel', 'oliver', 'arthur', 'george', 'ryan', 'thomas', 'fred', 'alex', 'tom', 'aaron', 'gordon', 'lee', 'rocko', 'eddy', 'reed', 'ralph', 'albert', 'brian', 'malcolm']);
export function voiceGender(v) {
  const name = String((v && v.name) || '').toLowerCase();
  if (/\bfemale\b/.test(name)) return 'f';
  if (/\bmale\b/.test(name)) return 'm';
  const first = name.replace(/^(microsoft|google|apple)\s+/, '').split(/[\s(-]/)[0];
  const w = first === 'o' ? 'o-ren' : first;
  return FEMALE.has(w) ? 'f' : MALE.has(w) ? 'm' : null;
}
const normLoc = (l) => String(l || '').replace('_', '-').toLowerCase();
/** gender hint from a roster look, only where it is unambiguous (beard → m, skirt → f), else null */
export function lookGender(look) {
  if (!look) return null;
  if (look.beard) return 'm';
  if (look.skirt || look.dress) return 'f';
  return null;
}
/** per-speaker pitch/rate for live speech (bigger offsets on the en-GB fallback so people stay distinct) */
export const VOICE_TUNE = {
  miguel: { pitch: 0.95, rate: 1.0, fbPitch: 0.85, fbRate: 1.02 },
  lorenzo: { pitch: 1.0, rate: 1.04, fbPitch: 1.08, fbRate: 1.08 },
  kotaro: { pitch: 1.04, rate: 1.06, fbPitch: 1.15, fbRate: 1.1 },
  aiken: { pitch: 1.02, rate: 1.0, fbPitch: 1.04, fbRate: 1.0 },
  matt: { pitch: 0.88, rate: 0.96, fbPitch: 0.86, fbRate: 0.95 },
  taskeen: { pitch: 1.08, rate: 1.0, fbPitch: 1.2, fbRate: 1.02 },
  dina: { pitch: 1.1, rate: 1.0, fbPitch: 1.15, fbRate: 1.0 },
  james: { pitch: 0.98, rate: 0.98, fbPitch: 0.95, fbRate: 0.98 },
  earl: { pitch: 0.9, rate: 0.95, fbPitch: 0.9, fbRate: 0.95 },
  porter: { pitch: 0.8, rate: 1.0, fbPitch: 0.8, fbRate: 1.0 },
  darts_caller: { pitch: 0.75, rate: 0.92, fbPitch: 0.75, fbRate: 0.92 },
  sufrin: { pitch: 1.05, rate: 0.92, fbPitch: 1.05, fbRate: 0.92 },
};
/** live-speech hints for the non-roster speakers (roster people are registered by places/_friends_voice.js) */
export const NPC_SPEAKERS = {
  earl: { locale: 'en-GB', gender: 'm' }, porter: { locale: 'en-GB', gender: 'm' },
  darts_caller: { locale: 'en-GB', gender: 'm' }, sufrin: { locale: 'en-GB', gender: 'm' },
};
/**
 * Choose a live voice: exact locale (preferring the hinted gender) → en-GB (gender-preferred) → any English → first.
 * Returns { voice, exact, pitch, rate } or null when there are no voices.
 */
export function pickVoice(voices, locale, gender = null, tune = null) {
  if (!voices || !voices.length) return null;
  const best = (list) => (gender && list.find((v) => voiceGender(v) === gender)) || list[0];
  const loc = normLoc(locale);
  const T = tune || { pitch: 1, rate: 1, fbPitch: 1, fbRate: 1 };
  if (loc) {
    const exact = voices.filter((v) => normLoc(v.lang) === loc);
    if (exact.length) {
      const v = best(exact);
      const g = voiceGender(v), adj = gender && g && g !== gender ? (gender === 'm' ? 0.82 : 1.18) : 1;
      return { voice: v, exact: true, pitch: T.pitch * adj, rate: T.rate };
    }
  }
  const gb = voices.filter((v) => normLoc(v.lang) === 'en-gb');
  const en = gb.length ? gb : voices.filter((v) => normLoc(v.lang).startsWith('en'));
  const v = en.length ? best(en) : voices[0];
  return { voice: v, exact: false, pitch: T.fbPitch, rate: T.fbRate };
}
/** distance (m) → volume; 0 beyond ~25 m */
export const volumeAt = (d) => Math.max(0, Math.min(1, 1 - (d - 3) / 22));

const nowS = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const MAX_LIVE_CHARS = 140;

/** The browser's speechSynthesis, one utterance at a time, with a voice per speaker's locale. */
export class LiveSpeech {
  constructor() {
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    this.synth = g.speechSynthesis && typeof g.SpeechSynthesisUtterance === 'function' ? g.speechSynthesis : null;
    this.voices = []; this.cache = new Map(); this.lastEnd = -99; this.speaking = null; this.hints = {};
    if (this.synth) {
      const load = () => { try { this.voices = this.synth.getVoices() || []; this.cache.clear(); } catch (e) { this.voices = []; } };
      load();
      try { this.synth.addEventListener ? this.synth.addEventListener('voiceschanged', load) : (this.synth.onvoiceschanged = load); } catch (e) { /* */ }
    }
  }
  get available() { return !!this.synth; }
  choice(speaker) {
    if (this.cache.has(speaker)) return this.cache.get(speaker);
    const H = this.hints[speaker] || NPC_SPEAKERS[speaker] || { locale: 'en-GB' };
    const c = pickVoice(this.voices, H.locale || null, H.gender || null, VOICE_TUNE[speaker]);
    if (this.voices.length) this.cache.set(speaker, c);
    return c;
  }
  stop() { try { this.synth && this.synth.cancel(); } catch (e) { /* */ } this.speaking = null; }
  /** -> Promise resolved at the end (or null if it did not speak). Not before a 1.2 s gap unless interrupt. */
  speak(speaker, text, vol, interrupt) {
    if (!this.synth || !text || text.length > MAX_LIVE_CHARS) return null;
    if (!interrupt) {
      if (this.synth.speaking || this.synth.pending) return null;
      if (nowS() - this.lastEnd < 1.2) return null;
    } else this.stop();
    const c = this.choice(speaker), H = this.hints[speaker] || NPC_SPEAKERS[speaker] || {};
    try {
      const u = new globalThis.SpeechSynthesisUtterance(String(text).replace(/\.\.\./g, ', ').replace(/\*[^*]*\*/g, ''));
      if (c && c.voice) { u.voice = c.voice; u.lang = c.voice.lang; } else if (H.locale) u.lang = H.locale;
      u.pitch = c ? c.pitch : 1; u.rate = c ? c.rate : 1; u.volume = vol;
      const p = new Promise((res) => { u.onend = u.onerror = () => { this.lastEnd = nowS(); if (this.speaking === speaker) this.speaking = null; res(); }; });
      this.synth.speak(u);
      this.speaking = speaker; this.lastEnd = nowS();
      return p;
    } catch (e) { return null; }
  }
}

// ------------------------------------------------------------------------------------------------ runtime
export const MAX_VOICES = 3;
export const LRU_CLIPS = 40;
const PREF_KEY = 'gto.friendVoices';

export class VoiceRuntime {
  /** game: the game (null for headless tests); opts: { base, fetch, enabled, ctx() } */
  constructor(game, opts = {}) {
    this.game = game || null;
    this.base = opts.base || defaultBase();
    this.fetch = opts.fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    this._ctx = opts.ctx || null;
    let pref = true; try { pref = globalThis.localStorage ? globalThis.localStorage.getItem(PREF_KEY) !== '0' : true; } catch (e) { /* */ }
    this.enabled = opts.enabled !== undefined ? !!opts.enabled : pref;
    this.manifest = null; this.manifestP = null;
    this.buffers = new Map(); this.loading = new Map();
    this.active = [];                 // [{ speaker, src, gain, id, live }]
    this.live = new LiveSpeech();
    this.stats = { clip: 0, live: 0, dropped: 0, cut: 0, missing: new Set(), errors: 0, fetched: [] };
    if (opts.manifest) this.manifest = opts.manifest; else if (opts.loadManifest !== false) this.loadManifest();
  }
  get ctx() { return this._ctx ? this._ctx() : (this.game && this.game.audio && this.game.audio.ctx) || null; }
  get dest() { return (this.game && this.game.audio && this.game.audio.master) || (this.ctx && this.ctx.destination); }
  /** has the player pressed Play (AudioContext exists)? headless (no game) counts as started for live speech */
  get started() { return this.game ? !!this.ctx : true; }
  get available() { return !!this.manifest && Object.keys(this.manifest).length > 1 || this.live.available; }
  url(file) { return new URL(file, this.base).href; }
  loadManifest() {
    if (this.manifestP) return this.manifestP;
    if (!this.fetch) { this.manifest = this.manifest || {}; return (this.manifestP = Promise.resolve(this.manifest)); }
    const u = this.url('manifest.json');
    this.stats.fetched.push(u);
    this.manifestP = this.fetch(u).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => (this.manifest = m && typeof m === 'object' ? m : {}));
    return this.manifestP;
  }
  /** register live-speech hints { id: { locale, gender } } */
  registerSpeakers(map) { Object.assign(this.live.hints, map); this.live.cache.clear(); }
  entry(id) { const m = this.manifest; return (m && id !== '_meta' && m[id]) || null; }
  /** the clip entries that would play for (speaker, text): the whole line, else every sentence, else null */
  resolve(speaker, text) {
    const e = this.entry(voiceId(speaker, text));
    if (e) return [{ id: voiceId(speaker, text), e }];
    const parts = splitSentences(text);
    if (parts.length < 2) return null;
    const out = [];
    for (const p of parts) { const id = voiceId(speaker, p), q = this.entry(id); if (!q) return null; out.push({ id, e: q }); }
    return out;
  }
  has(speaker, text) { return !!this.resolve(speaker, text); }
  duration(speaker, text) { const r = this.resolve(speaker, text); return r ? r.reduce((s, x) => s + (x.e.dur || 0) + 0.08, -0.08) : null; }
  toggle() { this.enabled = !this.enabled; if (!this.enabled) this.stop(); try { globalThis.localStorage && globalThis.localStorage.setItem(PREF_KEY, this.enabled ? '1' : '0'); } catch (e) { /* */ } return this.enabled; }
  setEnabled(on) { if (!!on !== this.enabled) this.toggle(); return this.enabled; }
  busy(chan) { return this.active.some((a) => a.channel === chan || a.speaker === chan) || this.live.speaking === chan; }
  stop(speaker = null) {
    for (const a of this.active.slice()) if (speaker === null || a.speaker === speaker || a.channel === speaker) this._kill(a);
    if (speaker === null || this.live.speaking === speaker) this.live.stop();
  }
  _kill(a) { a.dead = true; try { a.src && a.src.stop(); } catch (e) { /* */ } this._drop(a); if (a.done) a.done(); }
  _drop(a) { const i = this.active.indexOf(a); if (i >= 0) this.active.splice(i, 1); }
  _gain(opts) {
    let v = opts.volume == null ? 1 : opts.volume;
    let d = opts.dist;
    if (d == null && opts.pos && this.game && this.game.player && this.game.player.pos) { const p = this.game.player.pos; d = Math.hypot(p.x - opts.pos.x, p.z - opts.pos.z); }
    if (d != null) v *= volumeAt(d);
    return v;
  }

  /**
   * Speak `text` as `speaker`. opts: pos {x,z} (distance attenuation to the player) or dist (m), volume (0..1),
   * channel (key for "one line at a time": default the speaker; a character passes itself), interrupt (cut this
   * channel's current line, or the oldest voice if all channels are busy), replace (cut this channel's line only),
   * important (a named speaker: wins a channel from a crowd voice).
   * The returned promise carries, synchronously, .clip (true = a rendered clip is going to play), .dur and .reason
   * ('off' | 'not-started' | 'suspended' | 'far' | 'loading' | 'busy' | 'cap' | 'missing') so a caller can decide at
   * once whether to show a bubble. The same line from the same speaker while it is still playing is not restarted:
   * the call returns the playing line's promise.
   */
  say(speaker, text, opts = {}) {
    const res = (played, via, dur = 0, reason = null) => { const q = Promise.resolve({ played, via, dur, reason }); q.clip = false; q.dur = 0; q.reason = reason; return q; };
    if (!text || !speaker) return res(false, null, 0, 'missing');
    if (!this.enabled) return res(false, null, 0, 'off');
    if (!this.started) return res(false, null, 0, 'not-started');
    const ctx = this.game ? this.ctx : null;
    if (ctx && ctx.state && ctx.state !== 'running') { try { ctx.resume && ctx.resume(); } catch (e) { /* */ } return res(false, null, 0, 'suspended'); }
    const nt = normText(text), chan = opts.channel || speaker;
    const dup = this.active.find((a) => a.speaker === speaker && a.text === nt && !a.dead && a.p && (a.channel === chan || a.channel === speaker || chan === speaker));
    if (dup) return dup.p;
    const vol = this._gain(opts);
    if (vol < 0.05) return res(false, null, 0, 'far');
    if (!this.manifest && this.manifestP) {          // manifest still loading (first second of play): wait for it
      const p = this.manifestP.then(() => this.say(speaker, text, opts));
      p.clip = false; p.dur = 0; p.reason = 'loading';
      return p;
    }
    const parts = this.resolve(speaker, text);
    if (!parts) {
      this.stats.missing.add(`${speaker}: ${nt}`);
      if (!this._liveOk(speaker)) return res(false, null, 0, 'missing');
      if (this.busy(chan) && !opts.interrupt) { this.stats.dropped++; return res(false, null, 0, 'busy'); }
      const p = this.live.speak(speaker, text, vol, !!opts.interrupt);
      if (!p) return res(false, null, 0, 'missing');
      this.stats.live++;
      const q = p.then(() => ({ played: true, via: 'live', dur: 0 }));
      q.clip = false; q.dur = 0; q.reason = 'live';
      return q;
    }
    // channel rules: one line per channel, MAX_VOICES overall; when full, the nearer / more important line wins
    if (this.busy(chan)) { if (!opts.interrupt && !opts.replace) { this.stats.dropped++; return res(false, null, 0, 'busy'); } this.stop(chan); }
    if (this.active.length >= MAX_VOICES) {
      let victim = null;
      if (opts.interrupt) victim = this.active[0];
      else {
        const rank = (a) => (a.important ? 10 : 0) + this._slotVol(a);
        const mine = (opts.important ? 10 : 0) + vol;
        for (const a of this.active) if (a.speaker !== '_debug' && (!victim || rank(a) < rank(victim))) victim = a;
        if (victim && !(mine > rank(victim) * 1.15 + 0.02)) victim = null;
      }
      if (!victim) { this.stats.dropped++; return res(false, null, 0, 'cap'); }
      this.stats.cut++; this._kill(victim);
    }
    const dur = parts.reduce((s, x) => s + (x.e.dur || 0) + 0.08, -0.08);
    const slot = { speaker, channel: chan, text: nt, src: null, gain: null, id: parts[0].id, dead: false, done: null, vol, important: !!opts.important, p: null };
    this.active.push(slot);
    this.stats.clip++;
    const p = (async () => {
      if (parts.length > 1) this.predecode(parts.slice(1).map((x) => x.id));      // (the rest of the line is decoded while its first part plays)
      for (let i = 0; i < parts.length && !slot.dead; i++) {
        let buf = null;
        try { buf = await this._buffer(parts[i].id, parts[i].e); } catch (e) { this.stats.errors++; buf = null; }
        if (!buf && i === 0 && !slot.dead) {                 // clip missing / undecodable: say it live instead (named speakers only)
          this._drop(slot);
          const lp = this._liveOk(speaker) ? this.live.speak(speaker, text, vol, !!opts.interrupt) : null;
          if (lp) { await lp; return { played: true, via: 'live', dur: 0, reason: 'error' }; }
          return { played: false, via: null, dur: 0, reason: 'error' };
        }
        if (!buf || slot.dead) break;
        await this._playBuf(slot, buf, vol, opts.pos, opts.volume == null ? 1 : opts.volume, opts.ch);
        if (i < parts.length - 1 && !slot.dead) await new Promise((r) => setTimeout(r, 80));
      }
      const played = slot.src !== null;
      this._drop(slot);
      return { played, via: 'clip', dur };
    })();
    p.dur = dur; p.clip = true; p.reason = null;
    slot.p = p;
    return p;
  }
  /** live speechSynthesis only for the people who had it before (friends, the lecturer, the porter...), never the crowd */
  _liveOk(speaker) { return !!(this.live.hints[speaker] || NPC_SPEAKERS[speaker]); }
  _slotVol(a) { return a.gain && a.gain.gain ? a.gain.gain.value : a.vol || 0; }

  // ---------------------------------------------------------------- characters (core/characters.js characterSpeech.hook)
  /**
   * The hook every Character.say() goes through (main.js installs it). seeds: { lookSeed: speaker } for the people with
   * a voice of their own (_people.js looks: friends, Prof. Yang, Dr Earl...), so they sound like themselves wherever
   * they appear. A character can also name its speaker (ch.voiceAs = 'porter') or opt out (ch.voiceAs = false).
   * Everyone else: crowdSpeaker(ch.voiceHint). → { voiced, dur, p } (voiced = a clip is going to play: no bubble).
   */
  characterHook(seeds = {}) {
    const hook = (ch, text) => {
      const sp = this.speakerFor(ch, seeds);
      if (!sp || !this._inView(ch)) return null;
      const named = !CROWD_IDS.includes(sp);
      const p = this.say(sp, text, { pos: charPos(ch, this.game), ch, channel: named ? sp : ch, replace: true, important: named });      // (ch: spatial sound takes the speaker's head height from it)
      return { voiced: !!p.clip, dur: p.dur || 0, p, reason: p.reason, speaker: sp };
    };
    hook.stop = (ch) => { for (const a of this.active.slice()) if (a.channel === ch) this._kill(a); };
    return hook;
  }
  crowdSpeaker(hint) { return crowdSpeaker(hint); }
  /** is the character in the scene being drawn (not hidden, not in another place)? else its bubble path is unseen anyway */
  _inView(ch) {
    let o = ch && ch.group, root = o;
    while (o) { if (o.visible === false) return false; root = o; o = o.parent; }
    const sc = this.game && this.game.scene;
    return !(root && root.isScene && sc && root !== sc);
  }
  speakerFor(ch, seeds = {}) {
    if (!ch || ch.voiceAs === false) return null;
    if (ch.voiceAs) return ch.voiceAs;
    const H = ch.voiceHint || null;
    const named = H && seeds[H.seed];
    if (named) return named;
    return crowdSpeaker(H);
  }

  _playBuf(slot, buf, vol, pos, base = 1, ch = null) {
    const ctx = this.ctx; if (!ctx) return Promise.resolve();
    return new Promise((resolve) => {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; g.gain.value = vol;
      // (spatial sound: the voice comes from the speaker's head — core/audio.js spatial(); direction only, the volume above already has the distance in it)
      const A = this.game && this.game.audio, sp = pos && typeof pos.x === 'number' && A && A.spatial && A.ctx === ctx ? A.spatial(pos, { cls: 'voice', dist: false, follow: true, dest: (A && A.voiceBus) || this.dest, dy: ch && isFinite(ch.height) ? ch.height * 0.93 : 1.6 }) : null;      // (ch: the character speaking — its head, not its feet)
      src.connect(g); g.connect(sp ? sp.in : (A && A.ctx === ctx && A.voiceBus) || this.dest);      // (the characters' voices have their own volume: core/audio.js voiceBus)
      slot.src = src; slot.gain = g; slot.done = resolve;
      src.onended = () => { try { g.disconnect(); if (sp) sp.free(); } catch (e) { /* */ } resolve(); };
      // follow a moving speaker (pos is usually a live Vector3)
      if (pos && this.game && this.game.player) {
        const t = setInterval(() => { if (slot.dead || slot.src !== src) { clearInterval(t); return; } g.gain.value = base * volumeAt(this._d(pos)); }, 250);
        const end = src.onended; src.onended = () => { clearInterval(t); end(); };
      }
      try { src.start(); } catch (e) { resolve(); }
    });
  }
  _d(pos) { const p = this.game.player.pos; return Math.hypot(p.x - pos.x, p.z - pos.z); }
  async _buffer(id, e) {
    if (this.buffers.has(id)) { const b = this.buffers.get(id); this.buffers.delete(id); this.buffers.set(id, b); return b; }
    if (this.loading.has(id)) return this.loading.get(id);
    const ctx = this.ctx; if (!ctx) return null;
    // The game: every clip was downloaded on the loading screen, packed (core/assets.js; this.packs = game.assets.voice):
    // its mp3 bytes are cut out of the pack in memory and decoded now — nothing is fetched. this.noFetch (set with the
    // packs): a clip that is not in them is silence, never a request. Tools and tests (no packs): the clip's own file.
    const P = this.packs; let src;
    if (P && P.has(id)) { src = Promise.resolve(P.clip(id)); this.stats.packed = (this.stats.packed || 0) + 1; }
    else if (this.noFetch || !this.fetch) return null;
    else {
      const u = this.url(e.file + (e.h ? '?v=' + e.h : ''));
      this.stats.fetched.push(u);
      src = this.fetch(u).then((r) => { if (!r.ok) throw new Error(`voice ${id}: HTTP ${r.status}`); return r.arrayBuffer(); });
    }
    const p = src
      .then((ab) => new Promise((res, rej) => { const q = ctx.decodeAudioData(ab, res, rej); if (q && q.then) q.then(res, rej); }))
      .then((buf) => {
        this.buffers.set(id, buf);
        while (this.buffers.size > LRU_CLIPS) this.buffers.delete(this.buffers.keys().next().value);
        return buf;
      })
      .finally(() => this.loading.delete(id));
    this.loading.set(id, p);
    return p;
  }

  /** decode clips ahead of their being spoken (ids of manifest entries): someone near by who is about to talk — the
   *  line then starts without the few milliseconds its decoding takes. Bounded by the decoded cache (LRU_CLIPS). */
  predecode(ids) { for (const id of ids || []) { const e = this.entry(id); if (e && !this.buffers.has(id) && !this.loading.has(id)) { const p = this._buffer(id, e); if (p && p.catch) p.catch(() => {}); } } }
  /** Speak each page of the ui.dialog opened just before this call as it is shown; stops when the dialog closes. */
  followDialog(speaker, lines, opts = {}) {
    const ui = this.game && this.game.ui, d = ui && ui._dialog;
    if (!d) return;
    let last = -1;
    const tick = () => {
      if (ui._dialog !== d) { if (last >= 0) this.stop(speaker); return; }
      if (d.i !== last) {
        last = d.i;
        const l = d.lines[d.i], t = typeof l === 'object' && l ? l.text : l;
        if (t) this.say(speaker, t, { ...opts, interrupt: true });
      }
      setTimeout(tick, 120);
    };
    tick();
  }

  /** test hook: play clip `id` at full volume → { played, dur, error? } */
  async debugPlay(id) {
    if (!this.manifest) await this.loadManifest();
    const e = this.entry(id); if (!e) return { played: false, dur: 0, error: 'no such clip' };
    if (!this.ctx) return { played: false, dur: e.dur, error: 'audio not started' };
    try {
      const buf = await this._buffer(id, e);
      const slot = { speaker: '_debug', channel: '_debug', src: null, id, dead: false, done: null };
      const t0 = this.ctx.currentTime;
      this._playBuf(slot, buf, 1, null);
      return { played: !!slot.src, dur: +buf.duration.toFixed(3), manifestDur: e.dur, ctxTime: t0, state: this.ctx.state };
    } catch (err) { return { played: false, dur: 0, error: String(err && err.message || err) }; }
  }
  /** test hook: every clip id (optionally of one speaker) */
  debugIds(speaker = null) { return Object.keys(this.manifest || {}).filter((k) => k !== '_meta' && (!speaker || this.manifest[k].speaker === speaker)); }
}

/** a live {x, z} for a character: its world position (it may sit inside a moving parent) */
function charPos(ch, game = null) {
  const g = ch && ch.group; if (!g) return null;
  const w = () => { try { if (g.updateWorldMatrix) g.updateWorldMatrix(true, false); } catch (e) { /* */ } const e = g.parent && g.matrixWorld && g.matrixWorld.elements; return e || null; };
  return { get x() { const e = w(); return e ? e[12] : g.position.x; }, get z() { const e = g.parent && g.matrixWorld && g.matrixWorld.elements; return e ? e[14] : g.position.z; },
    // which place these coordinates are in (the scene the character stands in): somebody speaking inside a walk-in room is
    // then heard from the street where they are, through its wall and its door (core/audio.js spatial, core/_occlusion.js)
    get place() { return placeOf(g, game); } };
}

const SCENE_PLACE = new WeakMap();
function placeOf(g, game) {
  if (!game) return undefined;
  let r = g; for (let i = 0; i < 12 && r.parent; i++) r = r.parent;
  if (!r.isScene) return undefined;
  if (r === game.worldScene) return 'world';
  let id = SCENE_PLACE.get(r);
  if (id === undefined) {
    id = null;
    try { const I = game.interiors, defs = I && I.defs; if (defs && defs.values) for (const d of defs.values()) if (d.scene === r) { id = d.sl && d.sl.toWorld ? d.id : null; break; } } catch { id = null; }
    SCENE_PLACE.set(r, id);
  }
  return id === null ? undefined : id;
}

function defaultBase() {
  try { return new URL('../../audio/voice/', import.meta.url).href; } catch (e) { return 'audio/voice/'; }
}

/** create game.voice once (idempotent) */
export function installVoice(game, opts = {}) {
  if (!game) return new VoiceRuntime(null, opts);
  if (!game.voice) game.voice = new VoiceRuntime(game, opts);
  return game.voice;
}
