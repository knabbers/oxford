// May Morning — pure rules (no DOM, no three): which game day, the morning's timetable, where the crowd stands, the
// Morris choreography, the bells' changes. Everything is a function of the shared clock (game.time.now()) and the game
// day, so every player sees and hears the same morning at the same moment. Tested by tools/smoke_mayday.mjs.
// What is known about the real event and what is guessed: docs/research/may_morning.md.
//
// THE CLOCK. The length of a game day is set in core/time.js and the game has no calendar. May Morning
// is held on one game day in seven — game day mod 7 === WEEKDAY (the friends' day counter, floor(now / DAY_MS); the
// South Park fireworks are day 5 from 19:30, this is day 2 at dawn, so they never overlap). Like the fireworks it
// is played in real seconds, not squeezed to the game clock, so that there is time to reach it and to listen. It is
// anchored on the stroke of six: it starts T.strike real seconds before 06:00 on the game clock (T.startHour):
//
//     0 s          High Street closed from Longwall Street to The Plain; barriers and stewards out; people gather
//    60 s   06:00  the tower clock strikes six; the crowd falls silent
//    74 s          the choir sings the Hymnus Eucharisticus from the top of the tower (HYMN_LEN s)
//   then           a short silence (the prayer), a madrigal, and the crowd cheers
//   T.bells        the bells ring out (rounds and changes, T.bellsLen s: five minutes of the game clock, as the owner asked); Morris sides strike up in Radcliffe Square
//                  and Broad Street; cafés and pubs that opened early have queues; the crowd drifts away
//   T.end          the road reopens, everything is gone again (480 real seconds after the start)
import { DAY_MS, HOUR_MS, HOUR_S } from '../core/time.js'; export { DAY_MS, HOUR_MS };
export const WEEKDAY = 2;
export const mod = (a, n) => ((a % n) + n) % n;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const hash = (a, b = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };

// ------------------------------------------------------------------------------------------------ the music (data)
const N = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'd4:2 e4 fs4:1.5 r:1' -> [[midi, beats], ...] (s = sharp, f = flat, r = rest; default length 1) */
export function notes(str) {
  return str.trim().split(/\s+/).map((tok) => {
    const [n, len] = tok.split(':'), beats = len ? +len : 1;
    if (n === 'r') return [0, beats];
    const m = /^([a-g])(s|f)?(\d)$/.exec(n); if (!m) throw new Error('bad note ' + tok);
    return [12 * (+m[3] + 1) + N[m[1].toUpperCase()] + (m[2] === 's' ? 1 : m[2] === 'f' ? -1 : 0), beats];
  });
}
export const beatsOf = (part) => part.reduce((s, n) => s + n[1], 0);

/*HYMN-BEGIN*/
// Hymnus Eucharisticus ("Te Deum Patrem colimus"), Benjamin Rogers, c. 1673 — public domain. Four parts, 16 bars of
// 3/4 in G minor, transcribed from the Cyber Hymnal edition on hymnary.org (tune "Hymnus Eucharisticus, LM") and
// checked against the first bars of the 19th-century print (see docs/research/may_morning.md). The source's bars 3
// (alto), 11 and 15 are over-full; their rhythm here is a reconstruction (pitches as printed), and the last beat of
// bar 15 is simplified to a held A. The tower sings five verses; the game sings two. Rendered by synthesis only.
export const HYMN = {
  source: 'hymnary.org / Cyber Hymnal, G minor', beat: 0.64, verses: 2, gap: 2.2,
  parts: [
    notes('g4 g4 a4  bf4:1.5 c5:.5 d5  c5:.5 bf4:.5 a4:1.5 g4:.5  g4 fs4:2  fs4 fs4 g4  a4:2 bf4  c5 c5:1.5 bf4:.5  bf4:3  bf4 bf4 bf4  a4:2 bf4:.5 a4:.5  g4 g4:1.5 a4:.5  g4 fs4:2  g4 a4 bf4  c5:2 c5:.5 bf4:.5  bf4 a4:2  g4:3'),
    notes('d4 d4 d4  d4:2 d4  ef4 ef4:2  d4:3  d4 d4 d4  f4:2 f4  ef4:.5 d4:.5 c4:1.5 d4:.5  d4:3  d4 d4 d4  c4:2 d4  d4:1.5 d4:.5 c4  d4:3  bf3 c4 d4  c4:1.5 d4:.5 ef4  d4:1.5 c4:.5 d4  bf3:3'),
    notes('bf3 bf3 fs3  g3:2 a3  g3 c4:1.5 bf3:.5  a3:3  a3 a3 bf3  c4:2 d4  c4:.5 bf3:.5 bf3 a3:.5 bf3:.5  bf3:3  f3 f3 f3  f3:2 f3  g3:2 g3  a3:3  bf3 a3 f3  g3:2 a3:.5 g3:.5  g3:2 g3:.5 fs3:.5  g3:3'),
    notes('g3 g3 d3  g3:2 f3  ef3 c3:2  d3:3  d3 d3 g3  f3:2 d3  ef3 f3:2  bf2:3  bf2 bf2 bf2  f3:2 d3  ef3:2 ef3  d3:3  g3 f3 d3  ef3:1.5 d3:.5 c3  d3:2 d3  g2:3'),
  ],
};
/*HYMN-END*/
export const HYMN_VERSE = beatsOf(HYMN.parts[0]) * HYMN.beat;
export const HYMN_LEN = HYMN.verses * HYMN_VERSE + (HYMN.verses - 1) * HYMN.gap;

// The madrigal that follows: an ORIGINAL four-part "fa la la" written for the game in the style of an English ballett
// (G major, quick two-in-a-bar). It is not a transcription of any real madrigal.
export const MADRIGAL = {
  beat: 0.36, repeats: 2, gap: 0.8,
  parts: [
    notes('g4 g4 a4 b4 c5:2 b4:2 a4 a4 b4 c5 d5:2 d5:2 d5 e5 d5 c5 b4 c5 d5:2 c5 b4 a4 g4 a4:2 g4:2'),
    notes('d4 d4 fs4 g4 g4:2 g4:2 fs4 fs4 g4 a4 a4:2 b4:2 b4 c5 b4 a4 g4 g4 g4:2 g4 g4 e4 e4 fs4:2 d4:2'),
    notes('b3 b3 d4 d4 e4:2 d4:2 d4 d4 d4 e4 fs4:2 g4:2 g4 g4 g4 e4 d4 e4 d4:2 e4 d4 c4 b3 d4:2 b3:2'),
    notes('g3 g3 d3 g3 c3:2 g3:2 d3 d3 g3 a3 d3:2 g3:2 g3 c3 g3 a3 b3 c4 b3:2 c3 g3 a3 e3 d3:2 g2:2'),
  ],
};
export const MAD_ONCE = beatsOf(MADRIGAL.parts[0]) * MADRIGAL.beat;
export const MAD_LEN = MADRIGAL.repeats * MAD_ONCE + (MADRIGAL.repeats - 1) * MADRIGAL.gap;

// The Morris tune: an ORIGINAL 32-bar jig (6/8, G major, AABB) written for the game. A beat here is a dotted crotchet
// (two to the bar); the dance below is counted in the same beats. Lengths are in beats (1/3 = a quaver).
const q = 1 / 3;
const jig = (str) => str.trim().split(/\s+/).map((tok) => { const [n, len] = tok.split(':'); const [[m]] = [notes(n)[0]]; return [m, (len ? +len : 1) * q]; });
export const JIG = {
  beat: 0.52,                                         // seconds per beat (≈ 115 to the minute)
  A: jig('g4:2 a4 b4:2 d5 e5:2 d5 b4:2 g4 a4:2 b4 a4:2 g4 e4:2 g4 d4:3 g4:2 a4 b4:2 d5 e5:2 g5 d5:2 b4 a4:2 b4 a4:2 fs4 g4:3 g4:3'),
  B: jig('g5:2 fs5 e5:2 d5 e5:2 d5 b4:2 d5 e5:2 fs5 g5:2 e5 d5:2 b4 a4:3 g5:2 fs5 e5:2 d5 b4:2 d5 e5:2 g5 d5:2 b4 a4:2 fs4 g4:3 g4:3'),
  chordsA: ['G', 'G', 'C', 'G', 'D', 'D', 'C', 'D', 'G', 'G', 'C', 'G', 'D', 'D', 'G', 'G'],     // one per beat
  chordsB: ['G', 'C', 'C', 'G', 'C', 'C', 'G', 'D', 'G', 'C', 'G', 'C', 'G', 'D', 'G', 'G'],
  CH: { G: [43, 59, 62, 67], C: [48, 60, 64, 67], D: [50, 57, 62, 66] },
};
export const JIG_BEATS = 64;                           // AABB, 16 beats each
/** jig notes starting in beat b (absolute beat index on the shared clock) -> [[midi, startBeatFraction, lenBeats, voice]] voice 0 tune, 1 bass, 2 chord */
export function jigNotes(b, out = []) {
  out.length = 0;
  const k = mod(b, JIG_BEATS), sec = k < 32 ? 'A' : 'B', kk = k % 16, ch = JIG.CH[JIG['chords' + sec][kk]];
  out.push([ch[0], 0, 0.6, 1], [ch[1], 2 * q, 0.3, 2], [ch[2], 2 * q, 0.3, 2], [ch[3], 2 * q, 0.3, 2]);
  let acc = 0;
  for (const [m, len] of JIG[sec]) { if (acc >= kk + 1 - 1e-6) break; if (acc >= kk - 1e-6 && m) out.push([m, acc - kk, len, 0]); acc += len; }
  return out;
}

// ------------------------------------------------------------------------------------------------ timetable
const hymnEnd = 74 + HYMN_LEN, madStart = hymnEnd + 9, madEnd = madStart + MAD_LEN, bells = Math.ceil(madEnd + 5);
export const T = { startHour: 6 - 60 / HOUR_S, strike: 60, hymn: 74, hymnEnd, madrigal: madStart, madEnd, bells, bellsLen: (5 / 60) * HOUR_S, morris: bells + 8, cafes: 150, disperse: bells + 14, thin: bells + 150, morrisEnd: 462, end: 480 };

export function isMayDay(day) { return mod(day, 7) === WEEKDAY; }
/** shared ms at which the road closes and people start to gather (T.strike seconds before 06:00) on game day `day` */
export function startMs(day) { return day * DAY_MS + T.startHour * HOUR_MS; }
export function nextMayDay(day) { return day + mod(WEEKDAY - mod(day, 7), 7); }
/** -> out {day, today, upcoming (still to start today), active, t (s since the start; -1 when not active), eventDay} */
export function programme(nowMs, out = {}) {
  const d = Math.floor(nowMs / DAY_MS), t = (nowMs - startMs(d)) / 1000;
  out.day = d; out.today = isMayDay(d); out.active = out.today && t >= 0 && t < T.end; out.t = out.active ? t : -1;
  out.eventDay = out.active ? d : null; out.upcoming = out.today && t < 0;
  // the evening before (from 19:00 the day before) counts as "upcoming" for the notice: the crowd gathers before dawn
  out.eve = !out.today && isMayDay(d + 1) && nowMs - d * DAY_MS > 19 * HOUR_MS;
  return out;
}
/** what is going on t seconds in -> out {crowd 0..1 (share of the crowd present), hush 0..1, sing 0|1 (choir singing),
 *  bells 0|1, morris 0|1, cafes 0|1, closed 0|1, phase} */
export function levels(t, out = {}) {
  const on = t >= 0 && t < T.end;
  out.crowd = on ? (0.12 + 0.88 * smooth(0, 52, t)) * (1 - 0.86 * smooth(T.disperse, T.thin, t)) * (1 - smooth(T.end - 60, T.end - 8, t)) : 0;
  out.hush = on ? smooth(T.strike - 3, T.strike + 1, t) * (1 - smooth(T.madEnd, T.madEnd + 1.5, t)) : 0;
  const inH = t >= T.hymn && t < T.hymnEnd, inM = t >= T.madrigal && t < T.madEnd;
  out.sing = on && (inH || inM) ? 1 : 0;
  out.choir = on && t > 20 && t < T.bells + 40 ? 1 : 0;
  out.bells = on && t >= T.bells && t < T.bells + T.bellsLen ? 1 : 0;
  out.morris = on && t >= T.morris && t < T.morrisEnd ? 1 : 0;
  out.cafes = on && t >= T.cafes && t < T.end - 12 ? 1 : 0;
  out.closed = on ? 1 : 0;
  out.cheer = on ? Math.max(pulse(t, T.hymnEnd + 0.8, 6), pulse(t, T.madEnd + 0.5, 9), 0.7 * pulse(t, T.bells + 1, 7)) : 0;
  out.phase = !on ? 'off' : t < T.strike ? 'gathering' : t < T.hymn ? 'strike' : t < T.hymnEnd ? 'hymn' : t < T.madrigal ? 'prayer' : t < T.madEnd ? 'madrigal' : t < T.bells ? 'cheer' : t < T.bells + T.bellsLen ? 'bells' : 'after';
  return out;
}
const pulse = (t, t0, len) => (t < t0 || t > t0 + len ? 0 : Math.min(1, (t - t0) * 3) * (1 - smooth(t0 + len * 0.6, t0 + len, t)));

/** choir notes that START in [t0, t1) of event time -> cb(midi, startT, durSec, voice 0..3, piece 0 hymn | 1 madrigal) */
export function choirNotes(t0, t1, cb) {
  const run = (P, start, once, reps, gap, piece) => {
    for (let r = 0; r < reps; r++) {
      const base = start + r * (once + gap);
      if (base >= t1 || base + once < t0) continue;
      for (let v = 0; v < P.parts.length; v++) { let b = 0; for (const [m, len] of P.parts[v]) { const at = base + b * P.beat; if (m && at >= t0 && at < t1) cb(m, at, len * P.beat, v, piece); b += len; if (base + b * P.beat >= t1) break; } }
    }
  };
  run(HYMN, T.hymn, HYMN_VERSE, HYMN.verses, HYMN.gap, 0);
  run(MADRIGAL, T.madrigal, MAD_ONCE, MADRIGAL.repeats, MADRIGAL.gap, 1);
}

// ------------------------------------------------------------------------------------------------ the bells
// A ring of ten in D (treble first). Rounds for six rows, then plain hunt on all ten (each row swaps alternate pairs),
// with a pause after every second row (the handstroke gap), as change ringing is. GUESS: the real tower's bells are
// ten; their notes and what is rung on the day were not researched.
export const BELLS = { n: 10, midi: [78, 76, 74, 73, 71, 69, 67, 66, 64, 62], gap: 0.21 };
export const ROW_LEN = BELLS.n * BELLS.gap, PAIR_LEN = 2 * ROW_LEN + BELLS.gap;
/** order of the bells (indices, 0 = treble) in row r */
export function bellRow(r, out = []) {
  const n = BELLS.n; out.length = n;
  for (let i = 0; i < n; i++) out[i] = i;
  const k = Math.max(0, r - 6) % (2 * n);
  for (let j = 0; j < k; j++) for (let i = j % 2; i + 1 < n; i += 2) { const a = out[i]; out[i] = out[i + 1]; out[i + 1] = a; }
  return out;
}
/** bell strikes in [t0, t1) of event time -> cb(bellIndex, at). Also the six strokes of the hour at T.strike (bell 9, cb index -1). */
export function bellStrikes(t0, t1, cb) {
  for (let i = 0; i < 6; i++) { const at = T.strike + i * 1.9; if (at >= t0 && at < t1) cb(-1, at); }
  const s0 = T.bells, s1 = T.bells + T.bellsLen;
  if (t1 <= s0 || t0 >= s1 + ROW_LEN) return;
  const row = [];
  for (let r = Math.max(0, Math.floor((t0 - s0) / PAIR_LEN) * 2 - 2); ; r++) {
    const base = s0 + Math.floor(r / 2) * PAIR_LEN + (r % 2) * ROW_LEN;
    if (base >= t1 || base >= s1) break;
    bellRow(r, row);
    for (let i = 0; i < BELLS.n; i++) { const at = base + i * BELLS.gap; if (at >= t0 && at < t1) cb(row[i], at); }
  }
}

// ------------------------------------------------------------------------------------------------ the place
// World metres. The High Street centre line from the Longwall Street corner to The Plain (map ways w2987960 … w977424105).
export const STREET = [[778, 294], [789, 298], [794, 299], [805, 304], [824, 313], [839, 322], [854, 332], [863, 340], [871, 347], [884, 358], [902, 376], [906, 380], [912, 386], [937, 410], [985, 451], [1040, 498], [1049, 507]];
export const SITE = {
  tower: [905.6, 362.5], towerTop: 40, towerId: 'w77881357',
  centre: [900, 374],
  crowdS: [34, 322],                      // the crowd stands between these distances along STREET
  bridgeS: [199, 335],                    // Magdalen Bridge
  closeS: [9, 345],                       // barrier lines across the road (west: just east of Longwall; east: The Plain end of the bridge)
  halfLeft: 8.6, halfRight: 6.6,          // how far the crowd may spread north / south of the centre line (pavements, forecourts)
  parapet: 5.9,                           // barrier line along each side of the bridge, from the centre line (the stone parapet is at ~6.85)
  morris: [{ name: 'Radcliffe Square', p: [428, 211], h: -1.35, kit: 'sticks' }, { name: 'Broad Street', p: [288, 62], h: 1.4, kit: 'hankies' }],   // the setts on the south side of the square, between the Camera's lawn and the University Church; the wide part of Broad Street
  cafes: [[782, 310], [758, 278], [299, 45]],     // map POIs: a café at the Longwall corner, one opposite, a pub on Broad Street
};
const CUM = [0]; for (let i = 1; i < STREET.length; i++) CUM.push(CUM[i - 1] + Math.hypot(STREET[i][0] - STREET[i - 1][0], STREET[i][1] - STREET[i - 1][1]));
export const STREET_LEN = CUM[CUM.length - 1];
/** point s metres along the street, off metres to its left (north-east side) -> out [x, z, dirx, dirz] */
export function streetAt(s, off = 0, out = [0, 0, 0, 0]) {
  let i = 0; while (i < STREET.length - 2 && CUM[i + 1] < s) i++;
  const a = STREET[i], b = STREET[i + 1], L = CUM[i + 1] - CUM[i], dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L, u = s - CUM[i];
  out[0] = a[0] + dx * u + dz * off; out[1] = a[1] + dz * u - dx * off; out[2] = dx; out[3] = dz;
  return out;
}
/** nearest point of the street to (x, z) -> out [s, off (left +), dist] */
export function streetNear(x, z, out = [0, 0, 0]) {
  let best = 1e9;
  for (let i = 0; i < STREET.length - 1; i++) {
    const a = STREET[i], b = STREET[i + 1], L = CUM[i + 1] - CUM[i], dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    const u = clamp((x - a[0]) * dx + (z - a[1]) * dz, 0, L), px = a[0] + dx * u, pz = a[1] + dz * u, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; out[0] = CUM[i] + u; out[1] = (x - px) * dz - (z - pz) * dx; out[2] = d; }
  }
  return out;
}
/** is (x, z) on the closed stretch of road (for the traffic system) */
export function inClosure(x, z) { const n = streetNear(x, z, _n); return n[2] < 7 && n[0] > SITE.closeS[0] - 4 && n[0] < SITE.closeS[1] - 2; }
const _n = [0, 0, 0];
export const onBridge = (x, z) => { const n = streetNear(x, z, _n); return n[2] < 8 && n[0] > SITE.bridgeS[0] && n[0] < SITE.bridgeS[1]; };

// who is in the crowd: kinds 0..15 (the cut-out atlas has one column per kind; the 3D stand-ins and the live people
// near the player are dressed from the same list). Shares are GUESSES at the mix on the day.
export const KINDS = ['blacktie', 'gown', 'blacktie2', 'gown2', 'student', 'studentF', 'flowers', 'flowers2', 'family', 'child', 'coat', 'coatF', 'tweed', 'tourist', 'greenman', 'hoodie'];
const KIND_W = [7, 7, 5, 6, 10, 10, 7, 5, 8, 6, 8, 8, 4, 5, 0.9, 6];
const KIND_SUM = KIND_W.reduce((a, b) => a + b, 0);
export function kindOf(h) { let r = h * KIND_SUM; for (let i = 0; i < KIND_W.length; i++) { r -= KIND_W[i]; if (r <= 0) return i; } return 4; }

/**
 * Deterministic standing places: up to n spots [x, z, kind, scale, phase, heading (towards the tower)], densest below
 * the tower, thinning towards Longwall Street and the far end of the bridge. ok(x, z) rejects a place (walls, water).
 * Ordered so that the first k are an even sample of the whole and a smaller crowd is the first part of a bigger one.
 */
export function crowdSpots(n, ok = () => true) {
  const cand = [], p = [0, 0, 0, 0], [s0, s1] = SITE.crowdS, [tx, tz] = SITE.tower, [b0, b1] = SITE.bridgeS;
  let row = 0;
  for (let s = s0; s < s1; s += 0.92, row++) {
    const bridge = s > b0 && s < b1, hl = bridge ? SITE.parapet - 0.7 : SITE.halfLeft, hr = bridge ? SITE.parapet - 0.7 : SITE.halfRight;
    // a clear lane behind each barrier line and a narrow way through the middle (stewards keep it open)
    for (let o = -hr; o <= hl; o += 0.9) {
      if (Math.abs(o - 0.3) < 0.75) continue;
      const h = hash(row * 3.17 + 1, Math.round(o * 10) * 1.31);
      streetAt(s + (hash(row, o) - 0.5) * 0.5, o + (hash(o, row) - 0.5) * 0.45, p);
      const w = 0.3 + 0.7 * (1 - smooth(45, 150, Math.abs(s - 156)));         // 156 m along = abreast of the tower
      cand.push([p[0], p[1], h / w, s]);
    }
  }
  cand.sort((a, b) => a[2] - b[2]);
  const out = [];
  for (const [x, z] of cand) {
    if (out.length >= n) break;
    if (!ok(x, z)) continue;
    const h = hash(x * 5.3, z * 9.1), k = kindOf(hash(z * 2.7, x * 1.9));
    out.push([x, z, k, (KINDS[k] === 'child' ? 0.68 : 0.93) + hash(z, x) * 0.14, h, Math.atan2(tx - x, tz - z)]);
  }
  return out;
}
/** barrier panels (each 2.3 m): [[x, z, heading, kind]] kind 0 = crowd barrier, 1 = with a ROAD CLOSED board.
 *  Along both parapets of the bridge with a gap every fifth panel (dressing, never a wall: see may_morning.js), and
 *  across the road at each end of the closure. */
export function barrierPlan() {
  const out = [], p = [0, 0, 0, 0], [b0, b1] = SITE.bridgeS;
  let k = 0;
  for (let s = b0 + 3; s < b1 - 3; s += 2.36, k++) {
    if (k % 5 === 4) continue;
    for (const side of [1, -1]) { streetAt(s, side * SITE.parapet, p); out.push([p[0], p[1], Math.atan2(p[2], p[3]), 0]); }
  }
  for (const [s, dir] of [[SITE.closeS[0], 1], [SITE.closeS[1], -1]]) {
    for (let j = -2; j <= 2; j++) { if (j === 2) continue; streetAt(s, j * 2.36 - 0.6, p); out.push([p[0], p[1], Math.atan2(p[2], p[3]) + Math.PI / 2, j === 0 || j === -1 ? 1 + (dir < 0 ? 0 : 0) : 0]); }
  }
  // Rose Lane's mouth (it joins inside the closure)
  out.push([836.5, 326.5, Math.atan2(15, 9), 1]);
  return out;
}
/** where the stewards and officers stand: [[x, z, heading, role]] role 'steward' | 'police' | 'bridge' (a steward by the parapet) */
export function staffPlan() {
  const out = [], p = [0, 0, 0, 0], [b0, b1] = SITE.bridgeS;
  const face = (s, off, towards) => { streetAt(s, off, p); const x = p[0], z = p[1]; streetAt(s + towards[0], towards[1], p); return [x, z, Math.atan2(p[0] - x, p[1] - z)]; };
  out.push([...face(SITE.closeS[0] + 1.6, 3.4, [-10, 0]), 'steward'], [...face(SITE.closeS[1] - 1.6, 3.2, [10, 0]), 'steward']);
  out.push([...face(b0 + 34, SITE.parapet - 0.9, [0, -6]), 'bridge'], [...face(b0 + 34, -(SITE.parapet - 0.9), [0, 6]), 'bridge']);
  out.push([...face(SITE.closeS[0] + 1.6, -3.2, [-10, 0]), 'police'], [...face(b0 + 88, SITE.parapet - 0.9, [0, -6]), 'bridge']);
  out.push([...face(b0 + 88, -(SITE.parapet - 0.9), [0, 6]), 'bridge'], [...face(SITE.closeS[1] - 1.6, -3.2, [10, 0]), 'police']);
  out.push([...face(120, 0.3, [10, 0]), 'steward'], [...face(b0 + 6, 0.3, [-10, 0]), 'steward']);
  return out;
}

// ------------------------------------------------------------------------------------------------ the Morris
// A Cotswold set of six in two files of three, the musician at the top. Local metres: x across the set, +z "up"
// (towards the music). Counted in the jig's beats, 64 to the loop:
//    0-16  foot-up: both files face up, forward and back twice
//   16-32  chorus: partners face; sticks clash (or hankies flick) on beats 1 2 3, 5 6 7; then back-to-back
//   32-48  rounds: all six half-way round the ring and back
//   48-64  chorus again
export const SET = { dx: 0.95, dz: 1.9, ring: 1.95 };
const RING_ORDER = [0, 2, 4, 5, 3, 1];
export function morrisHome(i, out = [0, 0]) { out[0] = (i % 2 ? 1 : -1) * SET.dx; out[1] = (1 - Math.floor(i / 2)) * SET.dz; return out; }
const tri = (u) => 1 - Math.abs(mod(u, 2) - 1);          // 0 → 1 → 0 over u = 0..2
const _h = [0, 0];
/** dancer i (0..5) at beat b -> out {x, z, h (local heading, 0 = facing up), fig 0..3, u (beat in the figure), clash 0..1, high bool, move 0..1 (travelling)} */
export function morrisAt(i, b, out = {}) {
  const k = mod(b, 64), fig = Math.floor(k / 16), u = k - fig * 16, left = i % 2 === 0;
  morrisHome(i, _h);
  let x = _h[0], z = _h[1], h = 0, clash = 0, high = true, move = 0;
  if (fig === 0) { const e = tri(u / 4); z += 0.95 * e * e * (3 - 2 * e); move = 1; }
  else if (fig === 2) {
    const kI = RING_ORDER.indexOf(i), w = smooth(0, 1.5, u) * (1 - smooth(14.5, 16, u));
    const e = tri(u / 8), d = Math.PI * e * e * (3 - 2 * e), a = Math.PI / 2 + Math.PI / 6 + kI * (Math.PI / 3) - d;
    // ring angles: dancer 0 (top left) starts at the upper left and the ring turns clockwise seen from above
    const rx = Math.cos(a) * SET.ring, rz = Math.sin(a) * SET.ring * 1.05;
    x += (rx - x) * w; z += (rz - z) * w;
    const fwd = u < 8 ? 1 : -1, tx = Math.sin(a) * fwd, tz = -Math.cos(a) * fwd;
    h = lerpAngle(0, Math.atan2(tx, tz), w); move = w;
  } else {
    h = left ? Math.PI / 2 : -Math.PI / 2;
    if (u < 8) {
      const beat = Math.floor(u), f = u - beat;
      if (beat % 4 !== 3) { clash = Math.max(Math.exp(-f * 9), f > 0.72 && (beat + 1) % 4 !== 3 ? (f - 0.72) / 0.28 : 0); high = (f > 0.72 ? beat + 1 : beat) % 2 === 0; }
      else if (f > 0.72) { clash = (f - 0.72) / 0.28; high = true; }
    } else {
      const th = ((u - 8) / 8) * Math.PI * 2, s = left ? 1 : -1;
      x = -s * SET.dx * Math.cos(th); z += s * 0.5 * Math.sin(th); move = 1;
    }
  }
  out.x = x; out.z = z; out.h = h; out.fig = fig; out.u = u; out.clash = clash; out.high = high; out.move = move;
  return out;
}
function lerpAngle(a, b, t) { let d = mod(b - a + Math.PI, Math.PI * 2) - Math.PI; return a + d * t; }
/** is there a stick clash (a "clack") exactly on beat b (integer)? */
export function clackOn(b) { const k = mod(b, 64), fig = Math.floor(k / 16), u = k % 16; return (fig === 1 || fig === 3) && u < 8 && u % 4 !== 3; }
