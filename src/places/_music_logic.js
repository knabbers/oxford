// Pure logic for the Faculty of Music pianos (no DOM, no three.js): note parsing, piece compilation and checking,
// computer-keyboard mapping, sight-reading scorers (wait-for-note and in-tempo), practice streaks.
// Covered by tools/smoke_music.mjs.

export const MIDI_LO = 21, MIDI_HI = 108;          // A0 .. C8 (88 keys)
const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** 'C#4' -> {midi, letter, acc (-2..2), octave, step (diatonic index, C0 = 0)} or null */
export function parsePitch(s) {
  const m = /^([A-G])(##|#|bb|b|n)?(-?\d)$/.exec(s);
  if (!m) return null;
  const acc = { '#': 1, '##': 2, b: -1, bb: -2, n: 0 }[m[2]] ?? 0, oct = +m[3];
  return { midi: 12 * (oct + 1) + LETTERS[m[1]] + acc, letter: m[1], acc, natural: m[2] === 'n', octave: oct, step: oct * 7 + STEP[m[1]] };
}
export const isBlack = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
export const midiFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const midiName = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);

/** Duration code '8.' -> quarter-note units (0.75). null if invalid. */
export function parseDur(s) {
  const m = /^(1|2|4|8|16|32)(\.{0,2})$/.exec(s);
  if (!m) return null;
  const base = 4 / +m[1];
  return m[2] === '..' ? base * 1.75 : m[2] === '.' ? base * 1.5 : base;
}

/** Tokenise a bar string -> [{rest, pitches:[parsed], dur, code, tie}] ; throws on bad tokens */
export function parseBar(str) {
  const out = [];
  const re = /\[([^\]]+)\]:(\S+?)(~?)(?=\s|$)|(\S+?):(\S+?)(~?)(?=\s|$)/g;
  let m;
  const s = str.trim();
  if (s.replace(/\[[^\]]+\]:\S+|\S+:\S+/g, '').trim()) throw new Error(`unparsed text in "${str}"`);
  while ((m = re.exec(s))) {
    const isChord = m[1] !== undefined, body = isChord ? m[1] : m[4], code = isChord ? m[2] : m[5], tie = !!(isChord ? m[3] : m[6]);
    const dur = parseDur(code);
    if (dur === null) throw new Error(`bad duration "${code}" in "${str}"`);
    if (!isChord && body === 'r') { out.push({ rest: true, pitches: [], dur, code, tie: false }); continue; }
    const ps = body.trim().split(/\s+/).map((p) => { const q = parsePitch(p); if (!q) throw new Error(`bad pitch "${p}" in "${str}"`); return q; });
    out.push({ rest: false, pitches: ps, dur, code, tie });
  }
  return out;
}

export const barLength = (time) => (time[0] * 4) / time[1];   // in quarter notes

/**
 * Compile a piece -> {
 *   piece, barLen, bars: [{t0, len}], length,
 *   elements: [{voice, staff, hand, stem, t, dur, code, rest, pitches, tieIn[], tieOut, bar}]   (for drawing)
 *   notes:    [{t, dur, midi, hand, staff, el}]   (struck notes only: tied continuations merged into the first)
 *   groups:   [{t, notes:[...]} ]   onsets grouped by time (for wait mode)
 * }
 */
export function compilePiece(piece) {
  const barLen = barLength(piece.time), nb = piece.voices[0].bars.length;
  const bars = []; let t = 0;
  for (let b = 0; b < nb; b++) { const len = b === 0 && piece.pickup ? piece.pickup : barLen; bars.push({ t0: t, len }); t += len; }
  const elements = [], notes = [];
  piece.voices.forEach((v, vi) => {
    const open = new Map();        // midi -> note awaiting a tie continuation
    v.bars.forEach((bs, bi) => {
      let tt = bars[bi].t0;
      for (const e of parseBar(bs)) {
        const el = { voice: vi, staff: v.staff, hand: v.hand, stem: v.stem || 'auto', t: tt, dur: e.dur, code: e.code, rest: e.rest, pitches: e.pitches, tieOut: e.tie, tieIn: [], bar: bi, noteFor: {} };
        elements.push(el);
        const next = new Map();
        for (const p of e.pitches) {
          const prev = open.get(p.midi);
          if (prev && Math.abs(prev.t + prev.dur - tt) < 1e-6) { prev.dur += e.dur; el.tieIn.push(p.midi); el.noteFor[p.midi] = prev; if (e.tie) next.set(p.midi, prev); continue; }
          const n = { t: tt, dur: e.dur, midi: p.midi, hand: v.hand, staff: v.staff, el };
          notes.push(n); el.noteFor[p.midi] = n;
          if (e.tie) next.set(p.midi, n);
        }
        open.clear(); for (const [k, n] of next) open.set(k, n);   // a tie only reaches the very next element
        tt += e.dur;
      }
    });
  });
  notes.sort((a, b) => a.t - b.t || a.midi - b.midi);
  const groups = [];
  for (const n of notes) { const g = groups[groups.length - 1]; if (g && Math.abs(g.t - n.t) < 1e-6) g.notes.push(n); else groups.push({ t: n.t, notes: [n] }); }
  return { piece, barLen, bars, length: t, elements, notes, groups };
}

/** Problems with a piece definition (empty array = fine). */
export function validatePiece(piece) {
  const errs = [], barLen = barLength(piece.time);
  if (!piece.voices || !piece.voices.length) return ['no voices'];
  const nb = piece.voices[0].bars.length;
  if (![2, 3, 4, 6, 9, 12].includes(piece.time[0]) || ![2, 4, 8, 16].includes(piece.time[1])) errs.push(`odd time signature ${piece.time}`);
  if (!(piece.tempo > 20 && piece.tempo < 260)) errs.push('tempo out of range');
  if (Math.abs(piece.fifths || 0) > 7) errs.push('bad key signature');
  piece.voices.forEach((v, vi) => {
    if (v.bars.length !== nb) errs.push(`voice ${vi}: ${v.bars.length} bars, expected ${nb}`);
    if (!['t', 'b'].includes(v.staff)) errs.push(`voice ${vi}: bad staff`);
    v.bars.forEach((bs, bi) => {
      let els;
      try { els = parseBar(bs); } catch (e) { errs.push(`voice ${vi} bar ${bi}: ${e.message}`); return; }
      const want = bi === 0 && piece.pickup ? piece.pickup : barLen;
      const got = els.reduce((s, e) => s + e.dur, 0);
      if (Math.abs(got - want) > 1e-6) errs.push(`voice ${vi} bar ${bi}: ${got} quarters, expected ${want} ("${bs}")`);
      for (const e of els) for (const p of e.pitches) if (p.midi < MIDI_LO || p.midi > MIDI_HI) errs.push(`voice ${vi} bar ${bi}: ${p.letter}${p.octave} outside the 88 keys`);
      // range sanity per staff: treble voices shouldn't dive below F2, bass voices not above C6
      for (const e of els) for (const p of e.pitches) if ((v.staff === 't' && p.midi < 41) || (v.staff === 'b' && p.midi > 84)) errs.push(`voice ${vi} bar ${bi}: ${p.letter}${p.octave} unreadable on its staff`);
    });
  });
  // ties must connect equal pitches
  try {
    for (const v of piece.voices) {
      const all = v.bars.flatMap((b) => parseBar(b));
      all.forEach((e, i) => { if (e.tie) { const nx = all[i + 1]; if (!nx || nx.rest || !e.pitches.every((p) => nx.pitches.some((q) => q.midi === p.midi))) errs.push(`tie without a matching next note (${e.pitches.map((p) => p.letter + p.octave)})`); } });
    }
  } catch { /* reported above */ }
  return errs;
}

// --------------------------------------------------------------------------------------------- computer keyboard
// Home row = white keys, row above = black keys (the usual DAW layout). KeyA = C of the current octave.
export const KEYMAP = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
  KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17, BracketRight: 18,
};
export const VELOCITIES = [0.22, 0.35, 0.5, 0.65, 0.8, 0.95];   // pp p mp mf f ff
export const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff'];
export const OCT_MIN = 1, OCT_MAX = 6;                           // octave of KeyA: C1 .. C6 (C6 + 18 = F#7)

/** midi for a key code given the octave of KeyA (4 = middle C) and whether Shift (one octave down) is held; null if unmapped */
export function keyToMidi(code, octave, shift = false) {
  const k = KEYMAP[code];
  if (k === undefined) return null;
  const m = 12 * (octave + 1) + k - (shift ? 12 : 0);
  return m >= MIDI_LO && m <= MIDI_HI ? m : null;
}

// --------------------------------------------------------------------------------------------- scoring
/** Does a played midi satisfy an expected one? `fold` = octave-forgiving (pitch class only). */
export const matches = (played, expected, fold) => (fold ? ((played - expected) % 12 + 12) % 12 === 0 : played === expected);

/**
 * Wait-for-the-right-note mode. The cursor sits on an onset group until every note of it (in the hands being
 * practised) has been played; wrong notes count against accuracy but never move the cursor.
 */
export class WaitScorer {
  constructor(compiled, { hands = 'both', fold = true } = {}) {
    this.c = compiled; this.hands = hands; this.fold = fold;
    this.gi = -1; this.need = []; this.done = false; this.correct = 0; this.wrong = 0; this.streak = 0; this.bestStreak = 0;
    this._advance();
  }
  practised(n) { return this.hands === 'both' || (this.hands === 'right' ? n.hand === 'R' : n.hand === 'L'); }
  _advance() {
    for (;;) {
      this.gi++;
      if (this.gi >= this.c.groups.length) { this.done = true; this.need = []; return; }
      this.need = this.c.groups[this.gi].notes.filter((n) => this.practised(n)).map((n) => ({ n, hit: false }));
      if (this.need.length) return;
    }
  }
  /** Group index the cursor is on, and its onset time in beats */
  get t() { return this.done ? this.c.length : this.c.groups[this.gi].t; }
  /** All notes of groups up to the cursor that the computer should play for the other hand: returns groups skipped */
  /** -> 'hit' | 'wrong' | 'dup' | 'done' ; `advanced` true when the cursor moved */
  play(midi) {
    if (this.done) return { r: 'done', advanced: false };
    const slot = this.need.find((s) => !s.hit && matches(midi, s.n.midi, this.fold));
    if (!slot) {
      if (this.need.some((s) => s.hit && matches(midi, s.n.midi, this.fold))) return { r: 'dup', advanced: false };
      this.wrong++; this.streak = 0; return { r: 'wrong', advanced: false };
    }
    slot.hit = true; this.correct++; this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak);
    if (this.need.every((s) => s.hit)) { const from = this.gi; this._advance(); return { r: 'hit', advanced: true, from }; }
    return { r: 'hit', advanced: false };
  }
  get accuracy() { const t = this.correct + this.wrong; return t ? this.correct / t : 1; }
  get progress() { return this.c.groups.length ? Math.min(1, Math.max(0, this.gi) / this.c.groups.length) : 1; }
}

/**
 * In-tempo mode. Time runs at the piece tempo (after a one-bar count-in handled by the caller). Each expected note has a
 * window of ±win seconds around its onset; a press matches the nearest unmatched expected note of that pitch.
 */
export class TempoScorer {
  constructor(compiled, { hands = 'both', fold = true, tempo = compiled.piece.tempo, win = 0.16 } = {}) {
    this.c = compiled; this.hands = hands; this.fold = fold; this.spb = 60 / tempo; this.win = win;
    this.exp = compiled.notes.filter((n) => hands === 'both' || (hands === 'right' ? n.hand === 'R' : n.hand === 'L'))
      .map((n) => ({ n, time: n.t * this.spb, state: 0 }));    // 0 pending, 1 hit, -1 missed
    this.hits = 0; this.misses = 0; this.extras = 0; this.timingErr = 0; this.next = 0; this.done = false;
  }
  get duration() { return this.c.length * this.spb; }
  /** advance the clock to `time` seconds (since bar 1 beat 1); returns notes newly missed */
  tick(time) {
    let missed = 0;
    while (this.next < this.exp.length && this.exp[this.next].state !== 0) this.next++;
    for (let i = this.next; i < this.exp.length; i++) {
      const e = this.exp[i];
      if (e.time > time - this.win) break;
      if (e.state === 0) { e.state = -1; this.misses++; missed++; }
    }
    if (time > this.duration + this.win) this.done = true;
    return missed;
  }
  play(midi, time) {
    let best = null, bd = Infinity;
    for (let i = this.next; i < this.exp.length; i++) {
      const e = this.exp[i];
      if (e.time > time + this.win) break;
      if (e.state !== 0 || !matches(midi, e.n.midi, this.fold)) continue;
      const d = Math.abs(e.time - time);
      if (d <= this.win && d < bd) { bd = d; best = e; }
    }
    if (!best) { this.extras++; return { r: 'extra' }; }
    best.state = 1; this.hits++; this.timingErr += bd;
    return { r: 'hit', early: time < best.time, err: bd, e: best };
  }
  get accuracy() { const t = this.exp.length + this.extras * 0.5; return t ? Math.max(0, this.hits - this.extras * 0.25) / t : 1; }
  get meanError() { return this.hits ? this.timingErr / this.hits : 0; }
}

/** Grade text for an accuracy 0..1 */
export function grade(acc) { return acc >= 0.98 ? 'Flawless' : acc >= 0.92 ? 'Excellent' : acc >= 0.8 ? 'Good' : acc >= 0.6 ? 'Getting there' : 'Keep practising'; }

/**
 * Practice streak bookkeeping on a plain state object (game.state.music). `day` = shared game-day index
 * (core/time.js dayOf(game.time.now())). A completed run counts the day; consecutive days extend the streak.
 */
export function recordPractice(st, { day, pieceId, acc, mode, seconds = 0 }) {
  st.best = st.best || {}; st.runs = (st.runs || 0) + 1; st.seconds = (st.seconds || 0) + seconds;
  const key = pieceId + ':' + mode;
  const prev = st.best[key] ?? -1;
  if (acc > prev) st.best[key] = Math.round(acc * 1000) / 1000;
  if (st.lastDay === day) { /* already counted today */ }
  else if (st.lastDay === day - 1) { st.streak = (st.streak || 0) + 1; st.lastDay = day; }
  else { st.streak = 1; st.lastDay = day; }
  st.bestStreak = Math.max(st.bestStreak || 0, st.streak);
  return { newBest: acc > prev, streak: st.streak };
}

/**
 * "Playing badly" detector for the neighbour's knock on the wall: keeps a decaying score of wrong notes / mashing.
 * feed(kind, now): kind 'wrong' | 'mash' | 'good'. Returns true when the neighbour has had enough (then cools down).
 */
export class Grumpiness {
  constructor() { this.level = 0; this.t = 0; this.cool = 0; }
  feed(kind, now) {
    const dt = Math.max(0, now - this.t); this.t = now;
    this.level *= Math.exp(-dt / 12);
    if (kind === 'wrong') this.level += 1; else if (kind === 'mash') this.level += 1.6; else if (kind === 'good') this.level = Math.max(0, this.level - 0.35);
    if (now < this.cool) return false;
    if (this.level > 9) { this.level = 2; this.cool = now + 25; return true; }
    return false;
  }
}
