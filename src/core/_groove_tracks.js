// Original tracks for the Purple Turtle (CLUB) and the Cellar Bar jukebox (JUKEBOX). Engine: core/_groove.js.
// Everything here was written for this game: common chord loops, made-up riffs. No melody, hook or lyric of a real song.
//
// A track:
//   name, style, bpm, key (MIDI root the lead is written against), kit 'club'|'band'|'dnb', swing (0.5 = straight),
//   pump (side-chain depth 0..1), danceDiv (2 = dancers move at half tempo), gain (loudness trim, set from measurements
//   by tools/smoke_audio.mjs), levels { kick, snare, clap, hat, bass, stab, pad, arp, lead: multipliers },
//   chords { A: [[rootMidi, quality] per bar…], B: … },
//   parts: 16-character patterns, one character per 16th note
//     k / K kick ('x' hit, other = soft)      c clap or snare (parts.clap)      h hats ('x' closed, '-' soft, 'o' open)
//     b / B bass: base-36 semitones above the chord root ('0' root, '7' fifth, 'c' octave), '-' ties, '.' rest
//     t / T chord stabs ('x', other = soft)   a arpeggio: chord-tone index (0,1,2 then 3 = root an octave up…)
//     l / L lead: one string per bar, base-36 semitones above `key`, '-' ties — or { seq: [[step, midi, len]], len }
//   form: [[bars, layers]…] — layers is a string of part letters that sound in that section, plus
//     o off-beat open hat   s shaker   p pad   R snare-roll build   r noise riser   f filter opens over the section
//     m muffled (steady low-pass)   x crash on bar 1   d sub drop on bar 1   ! a beat of air + fill in the last bar
//     2 use chord loop B
const FOUR = 'x...x...x...x...', BACK = '....x.......x...', OFF = '..o...o...o...o.';

export const CLUB = [
  {
    name: 'Saturday Night Sequins', style: 'cheese', bpm: 124, key: 60, kit: 'club', pump: 0.45, gain: 1.29,
    chords: { A: [[48, 'maj'], [45, 'min'], [41, 'maj'], [43, 'maj']], B: [[41, 'maj'], [43, 'maj'], [40, 'min'], [45, 'min']] },
    parts: {
      clap: true, k: FOUR, c: BACK, h: '..x...x...x...x.',
      b: '0.c.0.c.0.c.0.c.', B: '0.0c..0c0.c.0.c7', bassLen: 1.3, bassType: 'sawtooth',
      t: 'x..x..x...x..x..', T: '..x...x...x...x.', stabLen: 1.2, stabType: 'sawtooth', stabSend: 0.2,
      a: '0.1.2.3.2.1.2.1.', arpOct: 1,
      l: ['g...j...g.e.c...', 'c.e.g...9...-...', 'h...g.e.c...9...', 'b...e...j.-.e...', 'g.g.j...l...j...', 'o...l.j.g...-...', 'h.g.e.c.e...g...', 'e...-...b...-...'],
      L: ['j...-...l.j.g...', 'l...-.j.g...-...', 'h.h.l...o...l...', 'j...-...e...g...', 'j...-...l.j.g...', 'o...-.l.j...-...', 'h...g...e...c...', 'e...-...-...-...'],
      leadType: 'square', leadOct: 1,
    },
    form: [[8, 'khtm'], [16, 'kcobt'], [8, 'kRrftp'], [16, 'kcosbtlxd'], [8, 'pa2'], [8, 'kRrfpa'], [16, 'kcosBtLxd'], [8, 'kcob!']],
  },
  {
    name: 'Cornmarket Anthem', style: 'chart', bpm: 128, key: 57, kit: 'club', pump: 0.6, gain: 1.32,
    chords: { A: [[45, 'min'], [41, 'maj'], [48, 'maj'], [43, 'maj']], B: [[41, 'maj'], [43, 'maj'], [45, 'min'], [45, 'min']] },
    parts: {
      clap: true, k: FOUR, c: BACK, h: '..x...x...x...x.',
      b: '..0...0...0...0.', B: '..0.0.0...0.0.0.', bassLen: 1.8, bassType: 'sawtooth',
      t: 'x.x.x.x.x.x.x.x.', T: 'x..x..x.x..x..x.', stabLen: 0.9, stabType: 'sawtooth', stabSend: 0.15,
      a: '0.2.1.2.0.2.1.2.', arpOct: 1,
      l: ['c...-.a.c...f...', 'c...-.a.8...-...', '7...-.a.c...f...', 'e...-...a...-...', 'j...-.h.f...c...', 'f...-.c.8...-...', 'c...a...7...a...', 'e...-...-...-...'],
      L: ['j.j.-.h.j...m...', 'o...-.m.j...-...', 'j.j.-.h.j...f...', 'e...-...h...e...', 'c.c.-.a.c...f...', 'h...-.f.c...-...', 'j...f...c...a...', 'e...-...-...-...'],
      leadType: 'sawtooth', leadOct: 1, leadCut: 2800,
    },
    form: [[8, 'khtm'], [16, 'kcobt'], [8, 'kRrftp'], [16, 'kcosbtlxd'], [8, 'pa2'], [8, 'kRrfpa'], [16, 'kcosBTLxd'], [8, 'kcob!']],
  },
  {
    name: 'Frewin Court Disco', style: 'indie disco', bpm: 118, key: 52, kit: 'band', pump: 0.2, gain: 1.12,
    levels: { kick: 1.3, bass: 1.7, stab: 1.4, lead: 1.3, snare: 0.9 },
    chords: { A: [[40, 'min'], [36, 'maj'], [43, 'maj'], [38, 'maj']], B: [[36, 'maj'], [38, 'maj'], [40, 'min'], [40, 'min']] },
    parts: {
      clap: false, k: FOUR, c: BACK, h: 'x-x-x-o-x-x-x-o-',
      b: '0..0..c.0.0..a7.', bassOct: 0, bassLen: 1.2, bassType: 'pick', bassCut: 1400,
      t: '..x.x.x...x.x.x.', T: 'x.....x.x.....x.', stabLen: 0.8, stabType: 'pluck', stabOct: 2, stabSend: 0.2,
      l: ['c.c.f.c.a.c.7...', '8.8.c.8.7.8.3...', 'a.a.f.a.7.a.3...', 'a.a.h.a.7.5.2...'],
      L: ['j...h.f.c...-...', 'f...c.8.c...-...', 'f...a.7.a...-...', 'h...e.a.5...-...'],
      leadType: 'triangle', leadOct: 1,
    },
    form: [[4, 'h'], [4, 'khb'], [16, 'kchbt'], [16, 'kchbtl'], [8, 'pT2'], [8, 'kRrfp'], [16, 'kchobtLxd'], [16, 'kchbtl'], [4, 'kchb!']],
  },
  {
    name: 'Turtle Power Hour', style: 'cheese', bpm: 132, key: 50, kit: 'club', pump: 0.5, gain: 0.93,
    chords: { A: [[50, 'min'], [46, 'maj'], [41, 'maj'], [48, 'maj']], B: [[46, 'maj'], [48, 'maj'], [50, 'min'], [45, 'maj']] },
    parts: {
      clap: true, k: FOUR, c: BACK, h: '..x...x...x...x.',
      b: '0.00.00.0.00.0c.', bassLen: 0.9, bassType: 'square', bassCut: 800,
      t: 'x..x..x..x..x.x.', T: '..x...x...x...x.', stabLen: 1.4, stabType: 'organ',
      a: '0123210301232103', arpOct: 1,
      l: ['7.7.c...a.8.7...', '8.8.a...8.7.5...', '7.7.a...f.c.a...', 'e...-...c...a...', 'f.f.h...f.c.a...', 'f...c...a.8.-...', 'c.a.7...a.c.f...', 'e...-...-...-...'],
      L: ['j...-.h.f...c...', 'k...-.h.f...-...', 'j...-.m.o...m...', 'm...-...j...h...', 'j...-.h.f...c...', 'k...-.h.k...-...', 'o...m...j...h...', 'e...-...-...-...'],
      leadType: 'square', leadOct: 1,
    },
    form: [[8, 'kham'], [16, 'kcobt'], [8, 'kRrftp'], [16, 'kcosbtlaxd'], [8, 'pa2'], [8, 'kRrfpa'], [16, 'kcosbTLaxd'], [8, 'kcob!']],
  },
  {
    name: 'Sub-Warden', style: 'drum & bass', bpm: 174, key: 53, kit: 'dnb', pump: 0, danceDiv: 2, gain: 1.02,
    chords: { A: [[41, 'min'], [41, 'min'], [37, 'maj'], [39, 'maj']] },
    parts: {
      clap: false, k: 'x.........x.....', K: 'x.....x...x.....', c: BACK, h: 'x.-.x.-.x.-.x.-.',
      b: '0-------..0-3-5-', B: '0-----0-----7-a-', bassOct: 0, bassType: 'reese',
      t: '......x.........', stabLen: 2.5, stabType: 'epiano', stabOct: 2, stabSend: 0.5, padOct: 2,
      l: ['c.......a...7...', 'c.......-.......', '8.......7...3...', 'a.......-...7...'],
      leadType: 'triangle', leadOct: 1, leadSend: 0.45,
    },
    form: [[8, 'hpm'], [8, 'kchp'], [8, 'Rrfp'], [16, 'kchbtlxd'], [16, 'KchBtp'], [8, 'pl'], [8, 'Rrfp'], [16, 'kchBtlxd'], [16, 'kchbpl'], [8, 'kchb!']],
  },
  {
    name: 'Lights Up at Three', style: 'hands in the air', bpm: 130, key: 55, kit: 'club', pump: 0.55, gain: 1.3,
    chords: { A: [[43, 'maj'], [38, 'maj'], [40, 'min'], [36, 'maj']], B: [[36, 'maj'], [38, 'maj'], [40, 'min'], [40, 'min']] },
    parts: {
      clap: true, k: FOUR, c: BACK, h: '..x...x...x...x.',
      b: '.000.000.000.000', bassOct: 0, bassLen: 0.9, bassType: 'sawtooth', bassCut: 700,
      t: 'x.....x.....x...', T: 'x..x..x..x..x.x.', stabLen: 2.2, stabType: 'sawtooth', stabOct: 2, stabSend: 0.25,
      a: '0.2.1.3.0.2.1.3.', arpOct: 2, padOct: 2,
      l: ['g...-...e...c...', 'e...-...b...9...', 'g...-...c...e...', 'c...-...-...7...', 'g...-...e...c...', 'j...-...h...e...', 'g...e...c...9...', 'c...-...-...-...'],
      L: ['j...-.l.j...g...', 'l...-.j.e...b...', 'j...-.g.c...g...', 'h...-.g.c...-...', 'j...-.l.j...g...', 'o...-.l.j...-...', 'g...e...c...e...', 'c...-...-...-...'],
      leadType: 'sawtooth', leadOct: 1, leadSend: 0.4, leadCut: 2600,
    },
    form: [[8, 'pam'], [8, 'khpa'], [16, 'kcobta'], [8, 'kRrfpt'], [16, 'kcosbtlxd'], [8, 'pal2'], [8, 'kRrfpa'], [16, 'kcosbTLaxd'], [8, 'kcobp!']],
  },
];

// The Cellar Bar jukebox: gentler, a band rather than a DJ. (The first four tunes are the bar's original ones.)
export const JUKEBOX = [
  {
    name: 'Pump Quad Shuffle', style: 'shuffle', bpm: 128, swing: 0.64, key: 60, kit: 'band', gain: 0.88,
    chords: { A: [[48, 'dom7'], [48, 'dom7'], [53, 'dom7'], [48, 'dom7'], [55, 'dom7'], [53, 'dom7'], [48, 'dom7'], [55, 'dom7']] },
    parts: {
      clap: false, k: 'x.......x.......', c: BACK, h: 'x.-.x.-.x.-.x.-.',
      b: '0.4.7.9.a.9.7.4.', bassOct: -1, bassLen: 1.7, bassType: 'triangle',
      t: '..x.......x.....', stabLen: 1.6, stabType: 'organ',
      l: { len: 64, dur: 3, seq: [[0, 72], [3, 75], [4, 76], [6, 79], [8, 81], [10, 79], [12, 76], [14, 72], [16, 70], [20, 72], [24, 69], [28, 67], [32, 72], [35, 75], [36, 76], [40, 79], [44, 76], [48, 74], [52, 72], [56, 67]] },
      leadType: 'triangle',
    },
    form: [[8, 'kchbt'], [16, 'kchbtl'], [8, 'kchbt'], [16, 'kchbtl'], [8, 'kchbt!']],
  },
  {
    name: 'Jericho Rain', style: 'indie ballad', bpm: 96, key: 57, kit: 'band', gain: 1.16,
    chords: { A: [[57, 'min'], [53, 'maj'], [48, 'maj'], [55, 'maj']] },
    parts: {
      clap: false, k: 'x.....x...x.....', c: BACK, h: '..x...x...x...x.',
      b: '0.....0...0.....', bassOct: -2, bassLen: 3, bassType: 'triangle',
      a: '0.1.2.0.1.2.0.1.', arpOct: 1, arpType: 'pick', padOct: 0,
      l: { len: 64, dur: 4, seq: [[0, 76], [4, 74], [6, 72], [8, 69], [16, 72], [20, 72], [22, 74], [24, 76], [32, 79], [36, 76], [40, 74], [48, 74], [52, 72], [56, 71]] },
      leadType: 'sine',
    },
    form: [[4, 'a'], [8, 'kchba'], [16, 'kchbal'], [8, 'bap'], [16, 'kchbalp'], [4, 'ba']],
  },
  {
    name: 'Last Orders', style: 'indie rock', bpm: 158, key: 62, kit: 'band', gain: 1.29,
    chords: { A: [[50, 'pow'], [45, 'pow'], [47, 'pow'], [43, 'pow']] },
    parts: {
      clap: false, k: 'x...x...x...x...', c: BACK, h: 'x.x.x.x.x.x.x.x.',
      b: '0.0.0.0.0.0.0.0.', bassOct: -1, bassLen: 1.4, bassType: 'pick', bassCut: 1200,
      t: 'x.x.x.x.x.x.x.x.', stabLen: 1.1, stabType: 'pluck', stabOct: 0,
      l: { len: 64, dur: 3, seq: [[0, 74], [2, 74], [4, 76], [6, 78], [8, 81], [12, 78], [16, 76], [20, 73], [24, 71], [28, 69], [32, 74], [36, 78], [40, 79], [44, 78], [48, 76], [56, 74]] },
      leadType: 'square', leadCut: 2400,
    },
    form: [[4, 'ht'], [16, 'kchbt'], [16, 'kchbtl'], [8, 'hbt'], [16, 'kchbtl'], [4, 'kchbt!']],
  },
  {
    name: 'Isis Blues', style: 'slow blues', bpm: 80, swing: 0.67, key: 64, kit: 'band', gain: 0.91,
    chords: { A: [[40, 'dom7'], [40, 'dom7'], [40, 'dom7'], [40, 'dom7'], [45, 'dom7'], [45, 'dom7'], [40, 'dom7'], [40, 'dom7'], [47, 'dom7'], [45, 'dom7'], [40, 'dom7'], [47, 'dom7']] },
    parts: {
      clap: false, k: 'x.......x.......', c: BACK, h: 'x.-.x.-.x.-.x.-.',
      b: '0...7...9...7...', bassOct: 0, bassLen: 3.4, bassType: 'triangle',
      t: '....x.......x...', stabLen: 2, stabType: 'epiano', stabOct: 2,
      l: { len: 64, dur: 3.5, seq: [[0, 64], [3, 67], [4, 69], [6, 70], [8, 71], [12, 67], [16, 64], [24, 62], [26, 64], [32, 69], [36, 67], [40, 64], [48, 71], [52, 69], [56, 67], [60, 64]] },
      leadType: 'sawtooth', leadCut: 1500, fill: false,
    },
    form: [[12, 'kchbt'], [12, 'kchbtl'], [12, 'kchbt'], [12, 'kchbtl']],
  },
  {
    name: 'Provost’s Garden', style: 'gentle pop', bpm: 108, key: 55, kit: 'band', gain: 0.91,
    chords: { A: [[43, 'add9'], [40, 'min7'], [36, 'maj7'], [38, 'sus4']], B: [[36, 'maj7'], [38, 'maj'], [40, 'min7'], [38, 'sus4']] },
    parts: {
      clap: false, k: 'x.....x...x.....', c: BACK, h: 'x.-.x.-.x.-.x.o.',
      b: '0.....0.7.....0.', bassOct: 0, bassLen: 2.6, bassType: 'triangle',
      t: 'x.....x...x.....', stabLen: 3, stabType: 'epiano', stabOct: 2,
      a: '0.2.1.2.3.2.1.2.', arpOct: 2, arpType: 'pick', padOct: 2,
      l: ['g...e...c...-...', 'e...c...9...-...', 'c...9...7...9...', 'e...-...-...7...', 'g...e...j...-...', 'h...g...e...-...', 'c...e...g...e...', 'c...-...-...-...'],
      leadType: 'sine', leadOct: 1,
    },
    form: [[4, 'ta'], [16, 'kchbt'], [16, 'kchbtl'], [8, 'pa2'], [16, 'kchbtla'], [4, 'tap']],
  },
];
