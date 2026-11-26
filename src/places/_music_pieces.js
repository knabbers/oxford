// Sight-reading repertoire for the Faculty of Music practice rooms (owned by places/music_faculty.js). Pure data, no DOM.
// All pieces are public domain (or original exercises). Encoded by hand; see tools/smoke_music.mjs for the checks.
//
// Format: { id, title, composer, note, fifths (key signature: +sharps / -flats), time: [num, den], tempo (quarter-note
// bpm), pickup (length of an anacrusis bar in quarter notes, optional), voices: [{ staff:'t'|'b', hand:'R'|'L',
// stem:'up'|'down'|'auto', bars: [string per bar] }] }.
// A bar string is a list of tokens: `C#4:8` (pitch:duration), `r:4` (rest), `[C4 E4 G4]:2` (chord), durations
// 1 2 4 8 16 (whole..sixteenth), `.` = dotted, trailing `~` = tied into the next note of the same pitch (not re-struck).
// Every voice has the same number of bars and each bar adds up to the time signature (bar 0 = pickup if given).

// Bach, Prelude in C major BWV 846 (WTC I), bars 1–19. Each bar is one five-note chord shape [n1..n5] broken as
// n1 n2 n3 n4 n5 n3 n4 n5, twice. Notated as in the Urtext: lower voice holds n1 (half note), upper bass voice
// enters on the second semiquaver with n2 (tied), the right hand has a quaver rest then six semiquavers.
const BWV846 = [
  ['C3', 'E3', 'G3', 'C4', 'E4'], ['C3', 'D3', 'A3', 'D4', 'F4'], ['B2', 'D3', 'G3', 'D4', 'F4'], ['C3', 'E3', 'G3', 'C4', 'E4'],
  ['C3', 'E3', 'A3', 'E4', 'A4'], ['C3', 'D3', 'F#3', 'A3', 'D4'], ['B2', 'D3', 'G3', 'D4', 'G4'], ['B2', 'C3', 'E3', 'G3', 'C4'],
  ['A2', 'C3', 'E3', 'G3', 'C4'], ['D2', 'A2', 'D3', 'F#3', 'C4'], ['G2', 'B2', 'D3', 'G3', 'B3'], ['G2', 'Bb2', 'E3', 'G3', 'C#4'],
  ['F2', 'A2', 'D3', 'A3', 'D4'], ['F2', 'Ab2', 'D3', 'F3', 'B3'], ['E2', 'G2', 'C3', 'G3', 'C4'], ['E2', 'F2', 'A2', 'C3', 'F3'],
  ['D2', 'F2', 'A2', 'C3', 'F3'], ['G1', 'D2', 'G2', 'B2', 'F3'], ['C2', 'E2', 'G2', 'C3', 'E3'],
];
function bachVoices() {
  const rh = [], b1 = [], b2 = [];
  for (const [n1, n2, n3, n4, n5] of BWV846) {
    const half = `r:8 ${n3}:16 ${n4}:16 ${n5}:16 ${n3}:16 ${n4}:16 ${n5}:16`;
    rh.push(half + ' ' + half);
    b1.push(`r:16 ${n2}:8.~ ${n2}:4 r:16 ${n2}:8.~ ${n2}:4`);
    b2.push(`${n1}:2 ${n1}:2`);
  }
  return [
    { staff: 't', hand: 'R', stem: 'auto', bars: rh },
    { staff: 'b', hand: 'L', stem: 'up', bars: b1 },
    { staff: 'b', hand: 'L', stem: 'down', bars: b2 },
  ];
}

// Hanon, The Virtuoso Pianist No. 1, ascending bars 1–8 (hands an octave apart). Degree d: d, d+2, d+3, d+4, d+5, d+4, d+3, d+2.
const SCALE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const deg = (d, oct) => SCALE[((d % 7) + 7) % 7] + (oct + Math.floor(d / 7));
function hanon1(oct) {
  const bars = [];
  for (let d = 0; d < 8; d++) bars.push([0, 2, 3, 4, 5, 4, 3, 2].map((k) => deg(d + k, oct) + ':16').join(' '));
  return bars;
}

export const PIECES = [
  {
    id: 'scale_c', title: 'C major scale', composer: 'Exercise', note: 'One octave, hands together, two octaves apart.',
    fifths: 0, time: [4, 4], tempo: 72,
    voices: [
      { staff: 't', hand: 'R', stem: 'auto', bars: ['C4:4 D4:4 E4:4 F4:4', 'G4:4 A4:4 B4:4 C5:4', 'B4:4 A4:4 G4:4 F4:4', 'E4:4 D4:4 C4:2'] },
      { staff: 'b', hand: 'L', stem: 'auto', bars: ['C2:4 D2:4 E2:4 F2:4', 'G2:4 A2:4 B2:4 C3:4', 'B2:4 A2:4 G2:4 F2:4', 'E2:4 D2:4 C2:2'] },
    ],
  },
  {
    id: 'five_finger', title: 'Five-finger exercise in C', composer: 'Exercise (Hanon-style)', note: 'Thumbs on C. Even quavers.',
    fifths: 0, time: [4, 4], tempo: 80,
    voices: [
      { staff: 't', hand: 'R', stem: 'auto', bars: ['C4:8 D4:8 E4:8 F4:8 G4:8 F4:8 E4:8 D4:8', 'C4:8 E4:8 D4:8 F4:8 E4:8 G4:8 F4:8 D4:8', 'C4:8 D4:8 E4:8 F4:8 G4:8 F4:8 E4:8 D4:8', 'C4:1'] },
      { staff: 'b', hand: 'L', stem: 'auto', bars: ['C3:8 D3:8 E3:8 F3:8 G3:8 F3:8 E3:8 D3:8', 'C3:8 E3:8 D3:8 F3:8 E3:8 G3:8 F3:8 D3:8', 'C3:8 D3:8 E3:8 F3:8 G3:8 F3:8 E3:8 D3:8', 'C3:1'] },
    ],
  },
  {
    id: 'hanon1', title: 'The Virtuoso Pianist, No. 1', composer: 'C.-L. Hanon', note: 'Bars 1–8 (ascending). Lift each finger high.',
    fifths: 0, time: [2, 4], tempo: 60,
    voices: [
      { staff: 't', hand: 'R', stem: 'auto', bars: hanon1(4) },
      { staff: 'b', hand: 'L', stem: 'auto', bars: hanon1(3) },
    ],
  },
  {
    id: 'ode', title: 'Ode to Joy (simple arrangement)', composer: 'L. van Beethoven, arr.', note: 'Theme from Symphony No. 9, simple left hand.',
    fifths: 0, time: [4, 4], tempo: 96,
    voices: [
      { staff: 't', hand: 'R', stem: 'auto', bars: ['E4:4 E4:4 F4:4 G4:4', 'G4:4 F4:4 E4:4 D4:4', 'C4:4 C4:4 D4:4 E4:4', 'E4:4. D4:8 D4:2', 'E4:4 E4:4 F4:4 G4:4', 'G4:4 F4:4 E4:4 D4:4', 'C4:4 C4:4 D4:4 E4:4', 'D4:4. C4:8 C4:2'] },
      { staff: 'b', hand: 'L', stem: 'auto', bars: ['C3:1', 'G2:1', 'C3:1', 'G2:1', 'C3:1', 'G2:1', 'C3:1', 'G2:2 C3:2'] },
    ],
  },
  {
    id: 'mozart545', title: 'Sonata in C, K. 545 — I. Allegro', composer: 'W. A. Mozart', note: 'Opening, bars 1–3. Alberti bass in the left hand.',
    fifths: 0, time: [4, 4], tempo: 100,
    voices: [
      { staff: 't', hand: 'R', stem: 'auto', bars: ['C5:2 E5:4 G5:4', 'B4:4. C5:16 D5:16 C5:2', 'A5:2 G5:4 C6:4'] },
      { staff: 'b', hand: 'L', stem: 'auto', bars: ['C4:8 G4:8 E4:8 G4:8 C4:8 G4:8 E4:8 G4:8', 'D4:8 G4:8 F4:8 G4:8 C4:8 G4:8 E4:8 G4:8', 'C4:8 A4:8 F4:8 A4:8 C4:8 G4:8 E4:8 G4:8'] },
    ],
  },
  {
    id: 'elise', title: 'Für Elise, WoO 59', composer: 'L. van Beethoven', note: 'Theme, bars 1–8 (first-time bar), with the upbeat.',
    fifths: 0, time: [3, 8], tempo: 66, pickup: 0.5,
    voices: [
      { staff: 't', hand: 'R', stem: 'auto', bars: ['E5:16 D#5:16', 'E5:16 D#5:16 E5:16 B4:16 D5:16 C5:16', 'A4:8 r:16 C4:16 E4:16 A4:16', 'B4:8 r:16 E4:16 G#4:16 B4:16', 'C5:8 r:16 E4:16 E5:16 D#5:16',
        'E5:16 D#5:16 E5:16 B4:16 D5:16 C5:16', 'A4:8 r:16 C4:16 E4:16 A4:16', 'B4:8 r:16 E4:16 C5:16 B4:16', 'A4:8 r:8 r:8'] },
      { staff: 'b', hand: 'L', stem: 'auto', bars: ['r:8', 'r:4.', 'A2:16 E3:16 A3:16 r:16 r:8', 'E2:16 E3:16 G#3:16 r:16 r:8', 'A2:16 E3:16 A3:16 r:16 r:8',
        'r:4.', 'A2:16 E3:16 A3:16 r:16 r:8', 'E2:16 E3:16 G#3:16 r:16 r:8', 'A2:16 E3:16 A3:16 r:16 r:8'] },
    ],
  },
  {
    id: 'gymnopedie', title: 'Gymnopédie No. 1', composer: 'E. Satie', note: 'Lent et douloureux. Bars 1–9.',
    fifths: 2, time: [3, 4], tempo: 66,
    voices: [
      { staff: 't', hand: 'R', stem: 'auto', bars: ['r:2.', 'r:2.', 'r:2.', 'r:2.', 'r:4 F#5:4 A5:4', 'G5:4 F#5:4 C#5:4', 'B4:4 C#5:4 D5:4', 'A4:2.', 'F#4:2.'] },
      { staff: 'b', hand: 'L', stem: 'up', bars: ['r:4 [B3 D4 F#4]:2', 'r:4 [A3 C#4 F#4]:2', 'r:4 [B3 D4 F#4]:2', 'r:4 [A3 C#4 F#4]:2', 'r:4 [B3 D4 F#4]:2', 'r:4 [A3 C#4 F#4]:2', 'r:4 [B3 D4 F#4]:2', 'r:4 [A3 C#4 F#4]:2', 'r:4 [B3 D4 F#4]:2'] },
      { staff: 'b', hand: 'L', stem: 'down', bars: ['G2:2.', 'D2:2.', 'G2:2.', 'D2:2.', 'G2:2.', 'D2:2.', 'G2:2.', 'D2:2.', 'G2:2.'] },
    ],
  },
  {
    id: 'bach846', title: 'Prelude in C, BWV 846', composer: 'J. S. Bach', note: 'The Well-Tempered Clavier, Book I. Bars 1–19.',
    fifths: 0, time: [4, 4], tempo: 66,
    voices: bachVoices(),
  },
];

// Background practice heard through the doors (muffled): short loops as [midi, beatsFromStart, durBeats] at a tempo.
// Generated, so they can be any length; "the four bars" person stumbles in the same place every time.
export function corridorLoops() {
  const C = (s) => s;
  const scale = (root, oct) => { const st = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24]; const n = []; const b = 12 * (oct + 1) + root;
    st.forEach((x, i) => n.push([b + x, i * 0.5, 0.5])); for (let i = st.length - 2; i >= 0; i--) n.push([b + st[i], (st.length * 2 - 2 - i) * 0.5, 0.5]); return n; };
  const arp = (root, oct) => { const n = []; const b = 12 * (oct + 1) + root; const s = [0, 4, 7, 12, 16, 19, 24, 19, 16, 12, 7, 4];
    s.forEach((x, i) => n.push([b + x, i * 0.333, 0.333])); return n; };
  const fourBars = () => { // Für Elise bars 1–4 (as above) — with the same wrong note and restart every time
    const t = [[76, 0], [75, .25], [76, .5], [75, .75], [76, 1], [71, 1.25], [74, 1.5], [72, 1.75], [69, 2], [60, 2.75], [64, 3], [69, 3.25], [71, 3.5], [64, 4.25], [68, 4.5], [71, 4.75], [72, 5], [64, 5.75], [77, 6.0]];
    return t.map(([m, b]) => [m, b, 0.25]);
  };
  return C([
    { name: 'scales', tempo: 120, notes: scale(2, 3), gap: 1.5 },          // D major, two octaves
    { name: 'arpeggios', tempo: 100, notes: arp(7, 2), gap: 1.0 },         // G major arpeggio
    { name: 'four bars', tempo: 90, notes: fourBars(), gap: 1.2 },
    { name: 'scales (E flat)', tempo: 132, notes: scale(3, 3), gap: 2.0 },
  ]);
}
