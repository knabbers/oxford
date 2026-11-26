// Andre and Computer Science Chris (friends of the user, places/_people.js) — pure rules, no DOM / three: their lines,
// where they are at any moment on the SHARED clock (so every player sees them in the same place), and which line is
// said when. Used by places/keble_pair.js; covered by tools/smoke_andre.mjs; lines extracted by tools/voices/extract.mjs.
//
// Where: by default on the pavement outside the Computer Science department — the Wolfson Building (OSM w197021482,
// tags "Computer Science", University of Oxford), on the Keble Road / Parks Road corner opposite Keble College — and
// otherwise around Keble (Keble Road, Keble's Parks Road front, the University Parks' Keble Gate). Some days they wander
// further into town together (always as a pair, Andre leading, Chris a step behind / beside him). Time model as in
// friends.js: absolute hours T = gameDay * 24 + hour; a game hour is HOUR_S real seconds (core/time.js); walking 100 m takes ~77 s.
// Night (GUESS, flagged in the report): absent (back into the department / home) roughly 23:00–08:30, or outside the
// Lamb and Flag on St Giles' until ~00:30 on about three nights in ten.

import { tn } from '../core/features.js';
import { HOUR_S } from '../core/time.js';
export function hash01(n) { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); }
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ------------------------------------------------------------------------------------------------ lines
// Andre: the user's two catchphrases, exactly (the user's spelling "welchcakes" is kept in the bubble; the voice clip
// says "Welsh cakes": tools/voices/overrides.json). He says nothing else.
export const ANDRE_LINES = { candy: "I don't like candy.", welsh: 'Mmm, welchcakes.' };
export const ANDRE_ALL = [ANDRE_LINES.candy, ANDRE_LINES.welsh];
// Computer Science Chris: everything he says includes "first principles" or "Brainfuck" (the esoteric language) —
// tools/smoke_andre.mjs holds every line to /first principles|brainfuck/i.
export const CHRIS_INTERP = [
  'I wrote a Brainfuck interpreter in Brainfuck.',
  'I wrote a Brainfuck interpreter in Haskell.',
  'I wrote a Python interpreter in Brainfuck.',
  'I wrote a Brainfuck interpreter in C.',
  'I wrote a Lisp interpreter in Brainfuck.',
  'I wrote a Brainfuck interpreter in Prolog.',
  'I wrote a JavaScript interpreter in Brainfuck.',
  'I wrote a Brainfuck interpreter in Excel formulas.',
  'I wrote a COBOL interpreter in Brainfuck.',
  'I wrote a Brainfuck interpreter in SQL.',
];
export const CHRIS_SOLO = [
  'Let’s derive how to order a coffee from first principles. Step one: what is a coffee?',
  'I don’t trust the bus timetable. I’m deriving it from first principles.',
  'Eight instructions. That’s all Brainfuck needs. Everything else is a lifestyle choice.',
  'My Brainfuck interpreter can now run my Brainfuck interpreter. Very slowly. Beautifully.',
  'Why use a library when you can rebuild it from first principles over a long weekend?',
  'Plus, minus, left, right, in, out and two brackets. Brainfuck is basically poetry.',
  'Andre, I’ve derived lunch from first principles. Sadly, it’s still a sandwich.',
  'Step one of any problem: forget everything and start from first principles.',
  'I printed Hello World in Brainfuck. It took all afternoon and I regret nothing.',
  'Bracket matching is the hardest part of a Brainfuck interpreter. And of life.',
  'Is it going to rain? Let’s not assume. Let’s go back to first principles.',
  'Keble’s brickwork? I could derive that pattern from first principles.',
];
// two-line exchanges: [first speaker, text], [second speaker, text]; Andre's side is only ever one of his catchphrases
export const EXCHANGES = [
  [['andre', ANDRE_LINES.welsh], ['chris', 'Then let’s derive the welchcake recipe from first principles. Flour seems axiomatic.']],
  [['chris', 'Andre, here’s candy derived from first principles: sugar, heat and patience.'], ['andre', ANDRE_LINES.candy]],
  [['andre', ANDRE_LINES.candy], ['chris', 'Noted. My Brainfuck interpreter now rejects candy at compile time.']],
  [['chris', 'I could write a welchcake recipe in Brainfuck. It’s mostly plus signs.'], ['andre', ANDRE_LINES.welsh]],
];
export const CHRIS_ALL = [...CHRIS_INTERP, ...CHRIS_SOLO, ...EXCHANGES.flatMap((x) => x.filter((p) => p[0] === 'chris').map((p) => p[1]))];
export const CHRIS_RULE = /first principles|brainfuck/i;

// ------------------------------------------------------------------------------------------------ places
// [x, z] (metres, map frame). `b` = a second mark ~8 m along the same pavement for a slow stroll while they stay.
// Points are pedestrian-graph nodes (pavements; read from the running game), and keble_pair.js snaps each to the nearest
// graph node within 6 m at install anyway.
export const KEBLE = [144, -401];          // Keble College (map site w23679616) centroid: the "around Keble" test centre
export const NEAR_R = 250;
export const SPOTS = {
  // outside the Wolfson Building (Computer Science), on the Keble Road pavement in front of it, and round the corner on
  // Parks Road by its entrance path (footway w154817155)
  cs:        { a: [116.9, -510.8], b: [125.5, -513.7], label: 'outside Computer Science (Wolfson Building), Keble Road' },
  csParks:   { a: [139.3, -543.1], b: [145.5, -537.9], label: 'Parks Road, by the Wolfson Building' },
  kebleRd:   { a: [69.6, -481.1], b: [78.1, -484.1], label: 'Keble Road, by Keble' },
  kebleFront:{ a: [205.6, -433.3], b: [202.6, -441.3], label: 'Keble’s Parks Road front' },
  parksGate: { a: [173.6, -535.4], b: [169.9, -530.4], label: 'University Parks, Keble Gate' },
  lambFlag:  { a: [29.0, -270.8], b: [26.8, -278.3], label: tn('outside the Lamb and Flag, St Giles’', 'outside the pub on St Giles’'), night: true },
  // hidden start / end of the day: the Wolfson Building's entrance path (footway w154817155) — they come out of the
  // department in the morning and go back in / off home at night (GUESS)
  home:      { a: [128.0, -524.0], hidden: true, label: 'in the department' },
  // further afield (day trips / evenings in town)
  nhm:       { a: [237.4, -367.3], b: [239.4, -374.3], label: 'in front of the Natural History Museum', away: true },
  pavilion:  { a: [430.6, -731.0], b: [436.0, -737.0], label: 'University Parks, the path by the cricket ground', away: true },
  stGiles:   { a: [-13.8, -331.2], b: [-11.6, -318.2], label: 'St Giles’, west side', away: true },
  martyrs:   { a: [67.3, -31.0], b: [76.0, -26.8], label: 'by the Martyrs’ Memorial', away: true },
  broad:     { a: [297.4, 58.3], b: [302.6, 56.7], label: tn('Broad Street, outside Blackwell’s', 'Broad Street, outside the bookshop'), away: true },
  radcliffe: { a: [432.3, 212.9], b: [436.3, 204.9], label: 'Radcliffe Square', away: true },
  cornmarket:{ a: [109.9, 209.0], b: [111.0, 201.0], label: 'Cornmarket Street', away: true },
  ashmolean: { a: [-36.9, -11.8], b: [-28.0, -12.0], label: 'outside the Ashmolean', away: true },
};
export const NEAR_SPOTS = ['cs', 'csParks', 'cs', 'parksGate', 'kebleRd', 'cs', 'csParks', 'kebleFront', 'parksGate', 'cs'];
const OUT_AND_BACK = ['nhm', 'stGiles', 'nhm', 'pavilion'];
const TOWN = ['martyrs', 'broad', 'radcliffe', 'cornmarket', 'ashmolean', 'broad'];
// day types by game day mod 8: Keble days, out-and-back walks, and evenings in town (they go home from there)
const WEEK = ['keble', 'town', 'keble', 'out', 'keble', 'keble', 'town', 'keble'];
export const WALK_V = 1.3;                 // m/s, the pair's pace (Andre sets it)
const ROUTE_F = 1.25;                      // pavements are longer than the straight line
/** game hours to walk between two spots (straight distance × ROUTE_F at WALK_V) */
export function walkH(a, b) { const A = SPOTS[a].a, B = SPOTS[b].a; return (Math.hypot(B[0] - A[0], B[1] - A[1]) * ROUTE_F) / WALK_V / HOUR_S; }
export const dayType = (day) => WEEK[mod(day, 8)];

/**
 * The pair's plan for game day `day`: [{t0, t1, kind: 'stay'|'walk', spot | from,to}] in absolute hours, starting when
 * they appear in the morning and ending when they go (hidden) — the gaps are 'away'. May run past midnight.
 */
const _plans = new Map();
export function dayPlan(day) {
  if (_plans.has(day)) return _plans.get(day);
  const P = [], T0 = day * 24, type = dayType(day);
  let t = T0 + 8.3 + 0.6 * hash01(day * 1.31 + 0.7), at = 'home', n = 0;
  const walk = (to) => { const d = walkH(at, to); P.push({ t0: t, t1: t + d, kind: 'walk', from: at, to }); t += d; at = to; };
  const stay = (h) => { const q = P[P.length - 1]; if (q && q.kind === 'stay' && q.spot === at) q.t1 += h; else P.push({ t0: t, t1: t + h, kind: 'stay', spot: at }); t += h; };
  /** hop round the Keble spots until hour `until` (absolute), ending at a stay */
  const nearUntil = (until) => {
    while (t < until - 0.4) {
      const pick = at === 'home' ? 'cs' : NEAR_SPOTS[Math.floor(hash01(day * 3.7 + n++ * 1.913) * NEAR_SPOTS.length) % NEAR_SPOTS.length];
      if (pick !== at) { if (t + walkH(at, pick) > until - 0.3) { stay(until - t); return; } walk(pick); }
      const want = at === 'cs' ? 3.2 + 2.0 * hash01(day * 5.1 + n * 0.77) : 1.4 + 1.2 * hash01(day * 5.1 + n * 0.77);
      stay(Math.max(0.3, Math.min(want, until - t)));
    }
  };
  walk('cs');
  if (type === 'town') {
    // an evening in town: set off in time to arrive ~19:30, stay till ~23:15, then home from there (hidden)
    const dest = TOWN[Math.floor(hash01(day * 2.27 + 4.1) * TOWN.length) % TOWN.length];
    // (the long walks into the centre pause by the Martyrs' Memorial on the way)
    const via = dest !== 'martyrs' && walkH('cs', dest) > 480 / HOUR_S, PAUSE = 0.8;      // (a walk of more than 480 real seconds)
    const trip = via ? walkH('cs', 'martyrs') + PAUSE + walkH('martyrs', dest) : walkH('cs', dest);
    const go = Math.max(t + 1.2, T0 + 19.5 - trip);
    nearUntil(go);
    if (at !== 'cs' && walkH(at, dest) > walkH('cs', dest) + 90 / HOUR_S) walk('cs');
    if (via) { walk('martyrs'); stay(PAUSE); }
    walk(dest);
    stay(Math.max(1.2, T0 + 23.2 - t));
  } else {
    if (type === 'out') {
      // a walk out and back after lunch (the Natural History Museum lawn, the Parks pavilion, St Giles')
      const dest = OUT_AND_BACK[Math.floor(hash01(day * 6.61 + 2.3) * OUT_AND_BACK.length) % OUT_AND_BACK.length];
      nearUntil(T0 + (dest === 'pavilion' ? 11.5 : 13.2));
      walk(dest); stay(1.3 + 0.8 * hash01(day * 8.3)); walk('cs');
      if (t > T0 + 21.2) { stay(Math.max(0.5, T0 + 22.5 - t)); walk('home'); _plans.set(day, P); return P; }
    }
    // evening by Keble, then ~half the nights outside the Lamb and Flag till ~00:30, else home
    const pub = hash01(day * 4.93 + 17.7) < 0.3;
    if (pub) {
      nearUntil(T0 + 22.1 - walkH('cs', 'lambFlag'));
      walk('lambFlag'); stay(Math.max(1.0, T0 + 24.5 - t));          // (then home from the pub: hidden)
    } else {
      nearUntil(T0 + 23.0);
      walk('home');
    }
  }
  _plans.set(day, P);
  if (_plans.size > 16) _plans.delete(_plans.keys().next().value);
  return P;
}

/** the plan entry at absolute hour T (or null = away), searching today's and yesterday's plans */
export function entryAt(T) {
  const d = Math.floor(T / 24);
  for (const dd of [d, d - 1]) for (const e of dayPlan(dd)) if (T >= e.t0 && T < e.t1) return e;
  return null;
}

/** stroll at a stay: stand at a for ~45 s, saunter to b (0.6 m/s), stand ~45 s, back — u = seconds into the stay */
export const STROLL_V = 0.6, STROLL_P = 45;
export function strollAt(S, u, out) {
  const A = S.a, B = S.b || S.a, L = Math.hypot(B[0] - A[0], B[1] - A[1]), leg = L / STROLL_V, C = 2 * (STROLL_P + leg), w = mod(u, C);
  let f = 0, dir = 1;
  if (w < STROLL_P) f = 0; else if (w < STROLL_P + leg) f = (w - STROLL_P) / leg; else if (w < 2 * STROLL_P + leg) f = 1; else { f = 1 - (w - 2 * STROLL_P - leg) / leg; dir = -1; }
  out.x = A[0] + (B[0] - A[0]) * f; out.z = A[1] + (B[1] - A[1]) * f;
  out.moving = f > 0 && f < 1; out.speed = out.moving ? STROLL_V : 0;
  out.h = Math.atan2((B[0] - A[0]) * dir, (B[1] - A[1]) * dir);
  return out;
}

/**
 * Where Andre is at absolute hour T, on the straight-line model (the game swaps the straight walk for the pavement
 * route between the same two spots, over the same time): out {hidden, x, z, h, speed, walking, spot, entry, u}.
 */
export function pairAt(T, out = {}) {
  const e = entryAt(T);
  out.entry = e;
  if (!e || (e.kind === 'stay' && SPOTS[e.spot].hidden)) { out.hidden = true; out.walking = false; out.spot = e ? e.spot : 'home'; out.speed = 0; return out; }
  out.hidden = false;
  if (e.kind === 'walk') {
    const A = SPOTS[e.from].a, B = SPOTS[e.to].a, u = clamp((T - e.t0) / (e.t1 - e.t0), 0, 1);
    out.u = u; out.walking = true; out.spot = e.to;
    out.x = A[0] + (B[0] - A[0]) * u; out.z = A[1] + (B[1] - A[1]) * u; out.h = Math.atan2(B[0] - A[0], B[1] - A[1]);
    out.speed = WALK_V;
    return out;
  }
  out.walking = false; out.spot = e.spot; out.u = 0;
  strollAt(SPOTS[e.spot], (T - e.t0) * HOUR_S, out);
  return out;
}
/** Chris relative to Andre: walking a step behind and to his left; standing ~1.1 m away, facing him */
export function chrisOffset(walking, h, out) {
  if (walking) { out.dx = -Math.sin(h) * 0.75 + Math.cos(h) * 0.45; out.dz = -Math.cos(h) * 0.75 - Math.sin(h) * 0.45; }
  else { out.dx = Math.cos(h) * 1.1; out.dz = -Math.sin(h) * 1.1; }
  return out;
}

// ------------------------------------------------------------------------------------------------ speech
/** shared speech slot (real seconds): one event per slot k = floor(now / (SLOT_S * 1000)), the same on every client */
export const SLOT_S = 14;
export const EXCHANGE_GAP_S = 3.6;
/**
 * What the pair say in slot k while someone is near: null, or [[who, text, delayS], …]. Chris's interpreter lines come
 * up most (the user asked for them often), then his other lines, the exchanges and Andre's catchphrases.
 */
export function slotEvent(k) {
  const u = hash01(k * 0.731 + 5.17), v = hash01(k * 1.913 + 0.41);
  if (u < 0.3) return [['chris', CHRIS_INTERP[Math.floor(v * CHRIS_INTERP.length) % CHRIS_INTERP.length], 0]];
  if (u < 0.48) return [['chris', CHRIS_SOLO[Math.floor(v * CHRIS_SOLO.length) % CHRIS_SOLO.length], 0]];
  if (u < 0.66) { const X = EXCHANGES[Math.floor(v * EXCHANGES.length) % EXCHANGES.length]; return [[X[0][0], X[0][1], 0], [X[1][0], X[1][1], EXCHANGE_GAP_S]]; }
  if (u < 0.8) return [['andre', ANDRE_ALL[Math.floor(v * 2) % 2], 0]];
  return null;
}
/** Andre's catchphrase when a player walks up (k = the shared minute index) */
export const walkupLine = (k) => ANDRE_ALL[Math.floor(hash01(k * 2.71 + 9.3) * 2) % 2];
/** the [E] Talk dialog for `who` ('andre' | 'chris'), talk number n: [{who, text}] */
export function talkPages(who, n) {
  const ci = (j) => CHRIS_ALL_TALK[mod(n * 2 + j, CHRIS_ALL_TALK.length)];
  if (who === 'andre') {
    const a = ANDRE_ALL[mod(n, 2)], X = EXCHANGES[mod(n, EXCHANGES.length)];
    // Andre's catchphrase, Chris chipping in with an exchange (Andre's half is a catchphrase too), or a line of his own
    if (mod(n, 3) === 2) return [{ who: 'andre', text: a }, { who: 'chris', text: ci(0) }];
    return X.map(([w, t]) => ({ who: w, text: t }));
  }
  return [{ who: 'chris', text: ci(0) }, { who: 'chris', text: ci(1) }, ...(mod(n, 2) ? [{ who: 'andre', text: ANDRE_ALL[mod(n >> 1, 2)] }] : [])];
}
// interpreter lines interleaved with the others, so a long talk with him gets plenty of both
const CHRIS_ALL_TALK = (() => { const o = [], a = CHRIS_INTERP, b = CHRIS_SOLO; for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) o.push(a[i]); if (b[i]) o.push(b[i]); } return o; })();
