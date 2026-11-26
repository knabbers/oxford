// Friends' spoken bubbles: a thin adapter over the pre-rendered voice runtime (core/voice.js, game.voice). Each line
// plays its rendered clip (tools/voices → public/audio/voice/, see docs/VOICES.md); a line without a clip falls back to
// the browser's live speechSynthesis with a voice for the friend's own locale (PEOPLE[id].locale), as before.
// Pedestrians never call this; professors stay silent, except a tutor marked `voiced` in _people.js (Prof. Yang), who
// speaks only the lines that have a rendered clip (his catchphrases) and never falls back to live speech. The live-voice chooser (pickVoice etc.) now lives in core/voice.js and is
// re-exported here for tools/smoke_friends.mjs.
import { VoiceRuntime, installVoice, lookGender, volumeAt } from '../core/voice.js';
export { voiceGender, lookGender, VOICE_TUNE, pickVoice, volumeAt } from '../core/voice.js';

const nowS = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

export class FriendVoices {
  /** people: PEOPLE roster; opts: { enabled (default true), game (installs/uses game.voice) } */
  constructor(people, opts = {}) {
    this.people = people;
    this.rt = opts.game ? installVoice(opts.game) : new VoiceRuntime(null, { loadManifest: false, enabled: true });
    if (opts.enabled !== undefined) this.rt.enabled = opts.enabled !== false;
    const hints = {};
    for (const [id, P] of Object.entries(people)) if (P.kind === 'friend') hints[id] = { locale: P.locale || null, gender: lookGender(P.look) };
    this.rt.registerSpeakers(hints);
    this.lastBy = new Map();
  }
  get available() { return this.rt.available; }
  get enabled() { return this.rt.enabled; }
  get speaking() { return this.rt.live.speaking || (this.rt.active[0] && this.rt.active[0].speaker) || null; }
  choice(id) { return this.rt.live.choice(id); }
  toggle() { return this.rt.toggle(); }
  stop() { this.rt.stop(); }
  /** seconds the clip for this line lasts (null if it has none) — bubbles can stay up that long */
  duration(id, text) { return this.rt.duration(id, text); }
  /**
   * Speak `text` as friend `id` heard from distance d (metres). ≥ 6 s between lines from the same person unless
   * priority (which also interrupts their current line). Returns true if it will be heard.
   * src = { pos, ch }: where the speaker is (a position in the frame the player is in; the live vector may be passed) and
   * their character, so the voice runtime can play the line from where they stand (spatial sound) — always give it.
   */
  say(id, text, d = 0, priority = false, src = null) {
    const rt = this.rt;
    if (!rt.enabled || !text) return false;
    const P = this.people[id]; if (!P || !(P.kind === 'friend' || P.voiced)) return false;
    if (volumeAt(d) < 0.08) return false;
    const now = nowS();
    if (!priority && now - (this.lastBy.get(id) || -99) < 6) return false;
    const clip = rt.has(id, text);
    if (!clip && P.kind !== 'friend') return false;     // a voiced tutor (Prof. Yang) speaks only his rendered lines, never live speech
    if (!clip && !rt.live.available) return false;
    if (!clip && !priority && (rt.live.synth.speaking || rt.live.synth.pending || now - rt.live.lastEnd < 1.2)) return false;
    if (clip && !priority && (rt.busy(id) || rt.active.length >= 3)) return false;
    if (!rt.started) return false;
    rt.say(id, text, src ? { dist: d, interrupt: priority, pos: src.pos || null, ch: src.ch || null } : { dist: d, interrupt: priority });
    this.lastBy.set(id, now);
    return true;
  }
  /** voice each page of the dialog just opened with game.ui.dialog (friends' [E] Talk) */
  dialog(id, lines, src = null) {
    const P = this.people[id]; if (!P) return;
    const where = src ? { pos: src.pos || null, ch: src.ch || null } : {};
    if (P.kind === 'friend') { this.rt.followDialog(id, lines, where); return; }
    if (!P.voiced) return;
    // a voiced tutor (Prof. Yang): only the pages that have a rendered clip are spoken (his catchphrases)
    const rt = this.rt, ui = rt.game && rt.game.ui, d = ui && ui._dialog;
    if (!d) return;
    let last = -1;
    const tick = () => {
      if (ui._dialog !== d) return;
      if (d.i !== last) {
        last = d.i;
        const l = d.lines[d.i], t = typeof l === 'object' && l ? l.text : l;
        if (t && rt.enabled && rt.has(id, t)) rt.say(id, t, { ...where, interrupt: true });
      }
      setTimeout(tick, 120);
    };
    tick();
  }
}
