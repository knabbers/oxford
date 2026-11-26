// The user's own quoted lines for the chicken-dippers scene. Kept EXACTLY as the user wrote them. Reading of the quote
// "hey lorenzo do you want some chhhhickin deepers? o miguel!": Miguel offers, Lorenzo replies. If both halves were meant
// to be Miguel's, set reply.who to 'miguel' (one-line fix).
export const DIPPERS_LINES = {
  offer: { who: 'miguel', text: 'Hey Lorenzo, do you want some chhhhickin deepers?' },
  reply: { who: 'miguel', text: 'O Miguel!' },   // user: both halves are Miguel's line
};

// Friends — pure rules (no DOM / three): the chicken-dippers schedule on the shared clock, the per-person day timeline
// (routine + kitchen sessions), and the kitchen scene timeline (actor tracks, props, lines). Used by friends.js and
// _friends_dippers.js; covered by tools/smoke_friends.mjs.
import { K, SEAT, TABLE_PLATES, SPOT as PLAN_SPOT, VIA, CORR, toWorld as earlToWorld, toLocal as earlToLocal } from './_worcint_earl_plan.js';
import * as EP from './_worcint_earl_plan.js';      // (the way in: WAY_IN, DOOR_OUT, DOOR_FACE, ROOM_AT, HALL)

export function hash01(n) { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); }
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mod = (a, n) => ((a % n) + n) % n;

// ------------------------------------------------------------------------------------------------ Prof. Yang
// The user's catchphrases for Prof. Yang (his former tutor, South Korean: user). Kept EXACTLY as the user wrote them —
// affectionate quotes of how he spoke, so the grammar is his. Spoken by tools/voices (speaker 'yang').
export const YANG_LINES = {
  exam: 'You are professional exam taker.',
  clever: 'Aah, you are too clever.',
  maybe: 'Maybeee.',
  tasty: 'Tasty food.',
};
/** shared speech slot length (real seconds): his ambient lines are decided per slot k = floor(now / (YANG_SLOT_S*1000)) */
export const YANG_SLOT_S = 20;
/**
 * Which catchphrase Prof. Yang says (or null). Pure function of the context and a shared integer k, so every client
 * near him shows the same line at the same moment. ctx:
 *   'meal'    slot k while he is eating in Hall (lunch / dinner / formal)  -> mostly "Tasty food.", sometimes "Maybeee."
 *   'near'    slot k while someone is within ~10 m of him                   -> now and then "Maybeee."
 *   'walkup'  a player has just walked up to him (k = minute index)         -> "You are professional exam taker." / "Aah, you are too clever."
 *   'walkupMeal' the same, while he is eating                              -> "Tasty food."
 *   'talk'    the reply page of the [E] Talk dialog (k = how many talks)    -> cycles too clever / exam taker / Maybeee.
 */
export function yangLine(ctx, k) {
  const u = hash01(k * 3.917 + 71.3);
  switch (ctx) {
    case 'meal': return u < 0.42 ? YANG_LINES.tasty : u < 0.54 ? YANG_LINES.maybe : null;
    case 'near': return u < 0.2 ? YANG_LINES.maybe : null;
    case 'walkup': return u < 0.5 ? YANG_LINES.exam : YANG_LINES.clever;
    case 'walkupMeal': return YANG_LINES.tasty;
    case 'talk': return [YANG_LINES.clever, YANG_LINES.exam, YANG_LINES.maybe][mod(k, 3)];
    default: return null;
  }
}
// His spots (friends.js SPOTS): Worcester rooms he goes into (hidden outdoors, drawn inside by _friends_yang.js) and the
// far ends of his street walks (hidden: "at the department"). GUESSES: which rooms (Memorial Room as his tutorial room on
// odd game days — the room has another tutor's tutorial on even days — and a Library desk on even days; high table at
// meals; the Lodge pidges) and which streets (Beaumont Street towards St Giles' and the Computer Science department on
// Parks Road; Walton Street north towards Little Clarendon Street).
export const YANG_ROOMS = { yLodge: 'worcint_lodge', yLib: 'worcint_library', yMem: 'worcint_memorial', yHall: 'worcint_hall' };
export const YANG_STREETS = { yBeau: 'Beaumont Street', yWalN: 'Walton Street' };
// Day types, one per weekday (game day mod 7), so every week has all three: 'college' (in college all day: Lodge, study,
// Hall), 'beaumont' (walks in along Beaumont Street in the morning and back out that way to the department after lunch),
// 'walton' (leaves after lunch up Walton Street). Study room by parity: Memorial Room on odd days, Library on even days.
// Walking speed 1.15 m/s, so 100 m takes ~87 real seconds; the hours below were laid out when a game hour was a real
// minute (Library <-> Hall ~25 s, Memorial Room <-> Hall ~90 s, Hall -> end of Beaumont St ~145 s, -> Walton St ~210 s)
// and leave at least that long to arrive (core/time.js HOUR_S: with a longer hour he arrives earlier and stays longer).
const YANG_WEEK = ['college', 'beaumont', 'walton', 'college', 'walton', 'beaumont', 'college'];
const YANG_DAYS = {
  'college:lib': [[0, 'gone'], [8.9, 'lodge'], [9.2, 'yLodge'], [9.7, 'yLib'], [11.7, 'yHall'], [13.8, 'stairs'], [14.6, 'yLib'], [17.6, 'yHall'], [19.6, 'gone']],
  'college:mem': [[0, 'gone'], [8.9, 'lodge'], [9.2, 'yLodge'], [9.6, 'yMem'], [14.2, 'quadN'], [15.3, 'yMem'], [17.0, 'yHall'], [19.8, 'gone']],
  'beaumont:lib': [[0, 'yBeau'], [8.2, 'lodge'], [10.3, 'yLodge'], [10.8, 'yLib'], [11.8, 'yHall'], [13.7, 'yBeau']],
  'beaumont:mem': [[0, 'yBeau'], [8.2, 'lodge'], [10.3, 'yLodge'], [10.8, 'yMem'], [13.3, 'yBeau']],
  'walton:lib': [[0, 'gone'], [9.0, 'lodge'], [9.3, 'stairs'], [10.0, 'yLib'], [11.8, 'yHall'], [13.6, 'yWalN']],
  'walton:mem': [[0, 'gone'], [9.0, 'lodge'], [9.3, 'yMem'], [13.0, 'yWalN']],
};
export function yangDayType(day) { return YANG_WEEK[mod(day, 7)]; }
/** Prof. Yang's routine for game day `day`: [[hour, spot, flags?]] (deterministic; the midnight entry is a jump between
 *  hidden spots, so he never walks across town at night) */
export function yangRoutine(day) {
  const r = YANG_DAYS[`${yangDayType(day)}:${mod(day, 2) ? 'mem' : 'lib'}`];
  return r.map((e, i) => (i === 0 ? [e[0], e[1], { jump: true }] : e));
}
/** people whose routine depends on the game day (personTimeline uses these instead of the ROUTINE array) */
export const DAY_ROUTINE = { yang: yangRoutine };

// ------------------------------------------------------------------------------------------------ routines (hour, spot)
export const ROUTINE = {
  matt:      [[0, 'home'], [9, 'lodge'], [9.6, 'quadN'], [11, 'town'], [13, 'pump'], [14.5, 'lake'], [16, 'fields'], [17.5, 'nuffield'], [19, 'pump'], [20.5, 'bar'], [23.5, 'home']],
  // Miguel lives in the Earl Building (user): his 'home' is the Earl door, and he is back in his room before meals.
  miguel:    [[0, 'earl'], [8.5, 'walton'], [10, 'town'], [12.2, 'earl'], [14, 'nuffield'], [16, 'pump'], [18.4, 'earl'], [19.7, 'pump'], [21, 'bar'], [23.8, 'earl']],
  aiken:     [[0, 'home'], [9.5, 'loggia'], [11, 'lake'], [13, 'pump'], [15, 'fields'], [17, 'quadN'], [19, 'pump'], [20, 'bar'], [23, 'home']],
  taskeen:   [[0, 'home'], [8, 'town'], [11.5, 'quadN'], [13, 'nuffield'], [15, 'lodge'], [16.5, 'pump'], [18.5, 'town'], [20, 'pump'], [21.5, 'bar'], [23.5, 'home']],
  // Lorenzo: an early walk to the south bank of the lake (the ducks: friends.js CATCH.duck), arriving ~08:30 and strolling
  // the shore (out to the ducks ~09:10 and ~10:25) until ~10:55; Pump Quad; on most afternoons a Tesco run (tescoTrips).
  lorenzo:   [[0, 'home'], [5.9, 'lakeside'], [10.9, 'pump'], [17, 'walton'], [18.5, 'pump'], [20, 'bar'], [23.6, 'home']],
  dina:      [[0, 'home'], [9, 'quadN'], [10.5, 'town'], [12.5, 'nuffield'], [14.5, 'loggia'], [16, 'town'], [19, 'pump'], [20.5, 'bar'], [23, 'home']],
  james:     [[0, 'home'], [10, 'loggia'], [11.5, 'town'], [14, 'lake'], [16, 'quadN'], [17.5, 'pump'], [20, 'bar'], [23.5, 'home']],
  kotaro:    [[0, 'home'], [9, 'quadN'], [10, 'parkourA'], [11.5, 'town'], [12.5, 'parkourC'], [13.5, 'pump'], [14, 'parkourB'], [15.5, 'fields'], [17, 'parkourA'], [18.5, 'pump'], [20.5, 'bar'], [23, 'home']],
  // Prof. Yang's day depends on the game day (yangRoutine / DAY_ROUTINE above); this is one of his days (day 1).
  yang:      yangRoutine(1),
  goldsmith: [[0, 'gone'], [10, 'lodge'], [10.5, 'loggia'], [12, 'quadN'], [13, 'gone'], [15, 'lodge'], [15.5, 'stairs'], [17, 'quadN'], [18, 'gone']],
  earl:      [[0, 'gone'], [12.2, 'lodge'], [12.5, 'stairs'], [13.2, 'gone'], [16.8, 'lodge'], [17.1, 'quadN'], [17.6, 'gone']],
};
// ------------------------------------------------------------------------------------------------ session schedule
// A game hour is HOUR_S real seconds (core/time.js). The scenes are played in REAL seconds from a start on the game
// clock: a session lasts DUR_S real seconds, however many game hours that is.
import { HOUR_S } from '../core/time.js';
export const DUR_S = 114;
export const DUR_H = DUR_S / HOUR_S;
export const LEAD_H = 36 / HOUR_S;      // they set off for the Earl Building this long (36 real seconds) before a session
export const GUEST_IN_S = 34;           // a friend drawn by the smell walks in this many seconds after the start
export const GUEST_POOL = ['kotaro', 'aiken', 'taskeen', 'matt', 'dina', 'james'];
export const COOKS = ['miguel', 'lorenzo'];

/** Sessions on game day `day` (absolute hours T = day*24 + hour). "Sometimes": lunch ~62 % of days (12:54–13:09),
 *  dinner ~58 % (19:00–19:30), a late post-bar session ~30 % (00:30–00:36). Deterministic per day → all clients agree. */
export function dipperSessions(day) {
  const out = [];
  const add = (kind, k, p, h0, jit) => {
    if (hash01(day * 7.13 + k) >= p) return;
    const start = day * 24 + h0 + jit * hash01(day * 3.71 + k * 11.3);
    const g = hash01(day * 5.27 + k * 2.9);
    const guest = g < 0.5 ? GUEST_POOL[Math.floor(hash01(day * 1.93 + k * 4.1) * GUEST_POOL.length) % GUEST_POOL.length] : null;
    // "This is basically row." — Lorenzo's line while eating in roughly one session in three (per session, shared)
    const row = hash01(day * 2.77 + k * 5.13) < 0.34;
    out.push({ day, kind, start, end: start + DUR_H, guest, alarm: false, row });
  };
  add('late', 3, 0.3, 0.5, 0.1);
  add('lunch', 1, 0.62, 12.9, 0.25);
  add('dinner', 2, 0.58, 19.0, 0.5);
  // smoke-alarm joke: at most once a day, in the day's first session, on ~35 % of days
  if (out.length && hash01(day * 9.91 + 77) < 0.35) out[0].alarm = true;
  return out;
}
/** the session running at absolute hour T (or null) and seconds since its start */
export function sessionAt(T) {
  const d = Math.floor(T / 24);
  for (const dd of [d, d - 1]) for (const s of dipperSessions(dd)) if (T >= s.start && T < s.end) return s;
  return null;
}
/** does `id` take part in session s? (Miguel + Lorenzo always; the guest from GUEST_IN_S) */
export function inSession(id, s) { return COOKS.includes(id) || (s && s.guest === id); }

// ------------------------------------------------------------------------------------------------ nights out
// On some game nights (deterministic per day, ~half of them) 2–4 of the friends (never the tutors) leave the bar for town
// around 22:20–22:45 and stay out until ~02:10–02:50 (the Purple Turtle shows friends whose spot is 'town'). The cooks
// come home from the club for a late chicken-dippers session (personTimeline splices the session in over the night).
export const NIGHT_POOL = ['matt', 'miguel', 'aiken', 'taskeen', 'lorenzo', 'dina', 'james', 'kotaro'];
const HOME_SPOT = { miguel: 'earl' };
/** the night out starting on the evening of game day `day`: {day, ids, start, end (absolute hours)} or null */
export function nightOut(day) {
  if (hash01(day * 4.37 + 19.1) >= 0.5) return null;
  const n = 2 + Math.floor(hash01(day * 2.11 + 5.3) * 3);           // 2..4 people
  const pool = NIGHT_POOL.slice(), ids = [];
  for (let k = 0; k < n && pool.length; k++) ids.push(pool.splice(Math.floor(hash01(day * 6.71 + k * 3.3) * pool.length) % pool.length, 1)[0]);
  const start = day * 24 + 22.33 + 0.4 * hash01(day * 8.9 + 1), end = day * 24 + 24 + 2.15 + 0.6 * hash01(day * 3.3 + 2);
  return { day, ids, start, end };
}

// ------------------------------------------------------------------------------------------------ Tesco runs
// On ~60 % of afternoons Lorenzo goes to Tesco Metro, Magdalen Street (supermarkets.js 'shop_tesco_magdalen'): he
// leaves the college (spot 'shop'; by Worcester Place, 'shopW', when he comes straight from the Earl kitchen), and for
// SHOP_S real seconds from `start` he is inside the shop (_friends_tesco.js plays the visit from the shared clock):
// walks in, sees the Jaffa Cakes ("Might as well."), takes a box, pays at a self-checkout and leaves. Start 15:45–16:06,
// so even on Sundays (11:00–17:00) the shop is open for the whole visit.
export const SHOP_ID = 'shop_tesco_magdalen';
export const SHOP_S = 51;
export const SHOP_H = SHOP_S / HOUR_S;
export const SHOP_LEAD_H = 60 / HOUR_S;  // he sets off this long (60 real seconds) before (Pump Quad -> main gate is ~54 s on foot)
export const SHOP_WHO = 'lorenzo';
/** Tesco runs on game day `day`: [{day, start, end}] (absolute hours) */
export function tescoTrips(day) {
  if (hash01(day * 6.07 + 41.3) >= 0.6) return [];
  const start = day * 24 + 15.75 + 0.35 * hash01(day * 2.39 + 7.7);
  return [{ day, start, end: start + SHOP_H }];
}
/** the Tesco run in progress at absolute hour T (or null) */
export function tripAt(T) {
  const d = Math.floor(T / 24);
  for (const dd of [d, d - 1]) for (const s of tescoTrips(dd)) if (T >= s.start && T < s.end) return s;
  return null;
}

// ------------------------------------------------------------------------------------------------ hal (Worcester Hall)
// The user: Miguel says Hall as "hal" (short a, as in "pal") and often invites people to come with him to hal; when he
// gets inside he asks the cook "Do you have any schicken deepers?" (the user's spelling, kept exactly). Every line of
// his writes it "hal"; the clips say /hal/ (kokoro_worker.py keeps the h of "hal" in his Portuguese rules) and
// "schicken deepers" as s + his "shicken deepers" (overrides.json). ASSUMPTION: "hall" = Worcester College Hall.
// On a meal with no chicken-dippers session of that kind (he is cooking in the Earl kitchen then), Miguel walks from
// wherever his routine has him to the loggia outside the Hall door ('halGo': waits there, inviting people), goes in at
// inT ('halIn': hidden outdoors, drawn inside by _friends_hal.js) and comes out at `out`. All on the shared clock.
export const HAL_WHO = 'miguel';
export const HAL_ASK = 'Do you have any schicken deepers?';
/** his invitations (a {name} line is addressed to a friend standing with him, else to the player) */
export const HAL_INVITE = ['Are you coming to hal?', 'Let’s go to hal.', 'Hal? Now? Come on.', 'I’m going to hal. Coming, pá?',
  '{name}, are you coming to hal?', 'Come to hal with me.', 'Hal time. Who’s coming?', 'Hal, {name}? Vamos!'];
/** said when the player takes him up on it ([E] Go to hal with Miguel) */
export const HAL_ACCEPT = 'Boa! To hal, then.';
/** his happy dippers line (his own catchphrase) after the cook's "You're in luck." */
export const HAL_HAPPY = 'Mmmm, shicken deepers.';
/** the cook's answers (generic, unnamed cook behind the hot counter); the last one is the lucky day */
export const COOK_REPLY = ['Not today, love. It’s fish.', 'Chicken dippers? Thursday.', 'I’ll see what’s in the freezer.',
  'Every day you ask me that.', 'You’re in luck.'];
export const COOK_LUCK = COOK_REPLY.length - 1;
/** what the cook says to the player ([E] Talk to the cook) */
export const COOK_TALK = { hello: 'What can I get you, love?', served: 'There you go, love. Enjoy.', skint: 'You’re short, love. Come back with some change.',
  formal: 'It’s formal tonight, love. They’ll serve you at the tables.' };
export const COOK_PRICE = { lunch: 3.1, dinner: 3.4 };     // as the servery (_worcint_logic.js MEAL_PRICE)
// [kind, go (game hour), lead (real s), inside (real s)]: he sets off at go (lunch: back from town, dinner: from Pump
// Quad; ~25–35 s on foot; before his routine would take him back to his room), waits outside, goes in `lead` seconds
// after setting off (meals: lunch 12–14, dinner 18–20) and comes out `inside` seconds after that. The trip is played in
// real time from its start on the game clock (core/time.js), whatever the length of a game hour.
export const HAL_MEALS = [['lunch', 12.05, 54, 51], ['dinner', 18.3, 39, 51]];
export const HAL_DOOR_S = 3;          // the indoor scene starts this long after inT (the walk from the loggia through the door)
/** hal trips on game day `day`: [{day, kind, go, inT, out (absolute hours), reply (COOK_REPLY index), luck, key}] */
export function halTrips(day) {
  const kinds = dipperSessions(day).map((s) => s.kind), out = [];
  HAL_MEALS.forEach(([kind, g, leadS, insideS], k) => {
    const i = g + leadS / HOUR_S, o = i + insideS / HOUR_S;
    if (kinds.includes(kind)) return;                 // cooking chicken dippers in the Earl kitchen instead
    const u = hash01(day * 3.17 + k * 7.7 + 0.31);
    const reply = u < 0.25 ? COOK_LUCK : Math.floor(hash01(day * 1.37 + k * 2.3 + 5.1) * COOK_LUCK) % COOK_LUCK;
    out.push({ day, kind, go: day * 24 + g, inT: day * 24 + i, out: day * 24 + o, reply, luck: reply === COOK_LUCK, key: `H${day}${kind[0]}` });
  });
  return out;
}
/** the trip that is on at absolute hour T (from `lead` hours before it sets off until it is over), or null */
export function halTripAt(T, lead = 0) {
  const d = Math.floor(T / 24);
  for (const dd of [d, d - 1]) for (const t of halTrips(dd)) if (T >= t.go - lead && T < t.out) return t;
  return null;
}
/** invitations: one chance per shared HAL_SLOT_S slot k (same line on every client), likelier around meal times and
 *  almost certain while he waits outside the Hall door. Returns the line (maybe a {name} template) or null. */
export const HAL_SLOT_S = 25;
export function halMealWindow(hour) { return (hour >= 11.5 && hour < 13.5) || (hour >= 17.5 && hour < 19.5); }
export function halInvite(k, hour, waiting = false) {
  const p = waiting ? 0.9 : halMealWindow(hour) ? 0.6 : 0.16;
  if (hash01(k * 5.31 + 19.7) >= p) return null;
  return HAL_INVITE[Math.floor(hash01(k * 2.71 + 3.3) * HAL_INVITE.length) % HAL_INVITE.length];
}
/** the indoor scene, t = seconds since inT + HAL_DOOR_S. Marks (Hall frame, _worcint_hall.js): in at the west door,
 *  through the column screen, to the hot counter by the servery door; the exchange; a bench seat; back out. */
export const HAL_T = { counter: 5.6, ask: 6.2, reply: 9.8, clap: 12.4, happy: 12.8, leaveCounter: 17, seated: 24 };
export const halEnd = (trip) => (trip.out - trip.inT) * HOUR_S - HAL_DOOR_S;
/** lines of the indoor scene: [t, who ('miguel'|'cook'), text, secs] */
export function halLines(trip) {
  const L = [[HAL_T.ask, 'miguel', HAL_ASK, 3.2], [HAL_T.reply, 'cook', COOK_REPLY[trip.reply], 3.2]];
  if (trip.luck) L.push([HAL_T.happy, 'miguel', HAL_HAPPY, 3]);
  return L;
}
/** the lines whose moment falls in (t0, t1] */
export const halLinesBetween = (trip, t0, t1) => halLines(trip).filter((l) => l[0] > t0 && l[0] <= t1);

// ------------------------------------------------------------------------------------------------ day timeline
/** Absolute timeline [{T, h, spot}] for one person covering days day-1..day+1: the routine (array of [hour, spot])
 *  with kitchen sessions spliced in: [start-LEAD 'earl' (walk there)], [start 'earlIn' (in the kitchen, hidden outside)],
 *  [end: whatever the routine says then]. Base entries inside the session window are dropped. */
export function personTimeline(id, routine, day) {
  let tl = [];
  // (DAY_ROUTINE people get that day's routine; an entry's optional 3rd element adds flags, e.g. {jump: true})
  for (let d = day - 1; d <= day + 1; d++) for (const [h, spot, f] of (DAY_ROUTINE[id] ? DAY_ROUTINE[id](d) : routine)) tl.push({ T: d * 24 + h, h, spot, ...f });
  const hOf0 = (T) => ((T % 24) + 24) % 24;
  // nights out: 'town' from start to end, then home (routine entries inside the window are dropped)
  for (let d = day - 2; d <= day + 1; d++) {
    const no = nightOut(d);
    if (!no || !no.ids.includes(id)) continue;
    tl = tl.filter((e) => e.T < no.start || e.T >= no.end);
    tl.push({ T: no.start, h: hOf0(no.start), spot: 'town', night: true }, { T: no.end, h: hOf0(no.end), spot: HOME_SPOT[id] || 'home', night: true });
  }
  tl.sort((a, b) => a.T - b.T);
  const sessions = [];
  for (let d = day - 1; d <= day + 1; d++) for (const s of dipperSessions(d)) if (inSession(id, s)) sessions.push(s);
  for (const s of sessions) {
    const isCook = COOKS.includes(id);
    const go = isCook ? s.start - LEAD_H : s.start + GUEST_IN_S / HOUR_S - LEAD_H;
    const inT = isCook ? s.start : s.start + GUEST_IN_S / HOUR_S;
    // the routine spot when the session ends
    let after = null; for (const e of tl) if (e.T <= s.end && !e.dip) after = (e.night && e.spot === 'town') ? (HOME_SPOT[id] || 'home') : e.spot;
    tl = tl.filter((e) => e.T < go || e.T >= s.end);
    const hOf = (T) => ((T % 24) + 24) % 24;
    tl.push({ T: go, h: hOf(go), spot: 'earl', dip: true }, { T: inT, h: hOf(inT), spot: 'earlIn', dip: true, session: s });
    if (after) tl.push({ T: s.end, h: hOf(s.end), spot: after, dip: true });
  }
  tl.sort((a, b) => a.T - b.T);
  // Tesco runs: [go 'shop'|'shopW' (walk out of college)], [start 'shop' inShop (in Tesco, hidden outdoors)], [end: the
  // routine spot then, or the next one if it starts within 36 s (that entry is dropped, so he walks straight there)]
  if (id === SHOP_WHO) {
    for (let d = day - 1; d <= day + 1; d++) for (const t of tescoTrips(d)) {
      let go = t.start - SHOP_LEAD_H, spot = 'shop';
      // after a lunch session he is still at (or walking from) the Earl Building: leave from there by Worcester Place as
      // soon as the session is over (the walk back to college would take minutes: a session that ended in the 360 s before)
      for (const s of sessions) if (s.start - LEAD_H < t.start && s.end > t.start - 360 / HOUR_S) { go = s.end; spot = 'shopW'; }
      if (go > t.start - 15 / HOUR_S) continue;          // no time (15 s) to get there: skip this one
      const hOf = (T) => ((T % 24) + 24) % 24;
      let after = null; for (const e of tl) if (e.T <= t.end) after = e.spot;
      const next = tl.find((e) => e.T > t.end);
      const nextNear = next && next.T - t.end < 36 / HOUR_S && !next.dip && !next.night ? next : null;
      if (nextNear) after = nextNear.spot;
      if (after === 'earlIn' || after === 'earl') after = 'pump';
      tl = tl.filter((e) => (e.T < go || e.T >= t.end) && e !== nextNear);
      tl.push({ T: go, h: hOf(go), spot, shopGo: true }, { T: t.start, h: hOf(t.start), spot, inShop: true, trip: t });
      if (after) tl.push({ T: t.end, h: hOf(t.end), spot: after, shopBack: true });
    }
    tl.sort((a, b) => a.T - b.T);
  }
  // hal (Miguel): [go 'halGo' (walk to the loggia outside the Hall door, wait)], [inT 'halIn' (in Hall, hidden
  // outdoors)], [out: the routine spot then, or the next one if it starts within 36 s (dropped: he walks straight there)]
  if (id === HAL_WHO) {
    for (let d = day - 1; d <= day + 1; d++) for (const t of halTrips(d)) {
      const hOf = (T) => ((T % 24) + 24) % 24;
      let after = null; for (const e of tl) if (e.T <= t.out) after = e.spot;
      const next = tl.find((e) => e.T > t.out);
      const nextNear = next && next.T - t.out < 36 / HOUR_S && !next.dip && !next.night ? next : null;
      if (nextNear) after = nextNear.spot;
      if (!after || after === 'earl' || after === 'earlIn' || after === 'halGo' || after === 'halIn') after = 'pump';
      tl = tl.filter((e) => (e.T < t.go || e.T >= t.out) && e !== nextNear);
      tl.push({ T: t.go, h: hOf(t.go), spot: 'halGo', trip: t }, { T: t.inT, h: hOf(t.inT), spot: 'halIn', trip: t }, { T: t.out, h: hOf(t.out), spot: after, halBack: true });
    }
    tl.sort((a, b) => a.T - b.T);
  }
  return tl;
}
/** index of the entry active at absolute hour T (last with e.T <= T) */
export function entryAt(tl, T) { let ei = 0; for (let i = 0; i < tl.length; i++) if (tl[i].T <= T) ei = i; return ei; }

// ------------------------------------------------------------------------------------------------ kitchen scene
// Times in seconds from the session start. Tracks: [t0, t1, path [[x,z]...], heading|null, pose]. A path of one point
// is a stationary pose; longer paths are walked at constant speed over t0..t1. Outside every segment: hidden.
const P = (a) => [a[0], a[1]];
const seatM = K.seats[SEAT.miguel], seatL = K.seats[SEAT.lorenzo], seatG = K.seats[SEAT.guest];
const faceTo = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
const OV = P(K.ovenStand), FR = P(K.freezerStand), LEAN = P(K.lean), SINK = P(K.sink), DOOR = K.door;
const AISLE_N = VIA.aisleN, AISLE_E = VIA.aisleE;
const W = -Math.PI / 2, FRH = K.freezerStand[2], SKH = VIA.sinkH;      // facing the oven run / the freezer / the sink
/** marks of the choreography (kitchen coordinates; see _worcint_earl_plan.js for the fittings) */
// (the marks themselves are in the plan, with the fittings they belong to: _worcint_earl_plan.js SPOT, and VIA for the
//  waypoints of the walks below)
export const SPOT = PLAN_SPOT;
const OVW = SPOT.ovenNear, PLW = SPOT.plating, DELIV = SPOT.deliver, HOV = SPOT.hover, SINKL = SPOT.sinkL, LDEL = SPOT.drinks;
const TBL = [K.table.x, K.table.z];
export const TRACKS = {
  miguel: [
    [0, 4.6, [DOOR, ...VIA.mIn, FR], null, 'stand'],
    [4.6, 7.4, [FR], FRH, 'crouch'],                                         // opens the freezer drawer, gets the bag out
    [7.4, 12.0, [FR], faceTo(FR, [seatL.x, seatL.z]), 'talk'],             // the offer, bag in hand
    [12.0, 14.0, [FR, OVW], null, 'stand'],
    [14.0, 17.2, [OVW], W, 'stand'],                                       // shakes the dippers onto the tray, picks the tray up
    [17.2, 17.9, [OVW, OV], W, 'stand'],                                   // a step back from the oven door
    [17.9, 20.3, [OV], W, 'crouch'],                                       // door open, tray in, door shut
    [20.3, 20.7, [OV, OVW], W, 'stand'],
    [20.7, 21.5, [OVW], W, 'stand'],                                       // sets the timer
    [21.5, 24.2, [OVW, AISLE_N, AISLE_E, LEAN], null, 'stand'],
    [24.2, 38.4, [LEAN], K.lean[2], 'lean'],                               // leaning on the breakfast bar: waits, checks his phone
    [38.4, 41.0, [LEAN, AISLE_E, AISLE_N, OV], null, 'stand'],
    [41.0, 44.0, [OV], W, 'crouch'],                                       // peeks through the oven door
    [44.0, 46.6, [OV], W, 'stand'],                                        // …and waits for the timer
    [46.6, 47.1, [OV, OVW], W, 'stand'],
    [47.1, 48.3, [OVW], W, 'stand'],                                       // oven mitts on
    [48.3, 48.8, [OVW, OV], W, 'stand'],
    [48.8, 51.2, [OV], W, 'crouch'],                                       // door open, tray out
    [51.2, 52.1, [OV], W, 'stand'],                                        // nudges the door shut with a knee
    [52.1, 53.0, [OV, PLW], W, 'stand'],
    [53.0, 60.55, [PLW], W, 'stand'],                                       // tray down, mitts off, plates, ketchup ('wave' at the smoke alarm)
    [60.55, 63.6, [PLW, ...VIA.mPlates, DELIV], null, 'stand'], // carries the two plates to the table
    [63.6, 64.5, [DELIV], faceTo(DELIV, [(TABLE_PLATES[0][0] + TABLE_PLATES[1][0]) / 2, (TABLE_PLATES[0][1] + TABLE_PLATES[1][1]) / 2]), 'stand'],   // square on to the two places                    // sets them down
    [64.5, 65.1, [DELIV, ...VIA.mSit, [seatM.x, seatM.z]], null, 'stand'],
    [65.1, 105.5, [[seatM.x, seatM.z]], seatM.h, 'sit'],
    [105.5, 109.0, [[seatM.x, seatM.z], ...VIA.mSink, SINK], null, 'stand'],
    [109.0, 109.8, [SINK], K.sink[2], 'stand'],
    [109.8, 114.0, [SINK, ...VIA.mOut, DOOR], null, 'stand'],
  ],
  lorenzo: [
    [1.0, 4.4, [DOOR, ...VIA.lIn, [seatL.x, seatL.z]], null, 'stand'],
    [4.4, 13.0, [[seatL.x, seatL.z]], seatL.h, 'sit'],
    [13.0, 15.4, [[seatL.x, seatL.z], ...VIA.lHover, HOV], null, 'stand'],     // comes to see what is going on
    [15.4, 21.6, [HOV], faceTo(HOV, [K.oven.x, K.oven.z]), 'stand'],       // hovers at Miguel's shoulder
    [21.6, 23.0, [HOV, SINKL], null, 'stand'],
    [23.0, 29.0, [SINKL], SKH, 'stand'],                                     // two glasses off the drainer, fills them at the tap
    [29.0, 32.4, [SINKL, ...VIA.lDrinks, LDEL], null, 'stand'],
    [32.4, 33.4, [LDEL], faceTo(LDEL, TBL), 'stand'],                      // sets the drinks down
    [33.4, 34.0, [LDEL, [seatL.x, seatL.z]], null, 'stand'],
    [34.0, 106.5, [[seatL.x, seatL.z]], seatL.h, 'sit'],
    [106.5, 109.5, [[seatL.x, seatL.z], ...VIA.lIn.slice().reverse(), DOOR], null, 'stand'],
  ],
  guest: [
    [GUEST_IN_S, GUEST_IN_S + 3.5, [DOOR, ...VIA.gIn, [seatG.x, seatG.z]], null, 'stand'],
    // (2026-11-22: he gets up 1.8 s later than he did. Lorenzo is at the door at 109.5 and the way out is now a few
    //  metres, not a long corridor: half a second behind him the guest, who walks faster, came out of the building's
    //  door on the same spot as Lorenzo)
    [GUEST_IN_S + 3.5, 108.6, [[seatG.x, seatG.z]], seatG.h, 'sit'],
    [108.6, 111.8, [[seatG.x, seatG.z], ...VIA.gIn.slice().reverse(), DOOR], null, 'stand'],
  ],
};
// precompute path lengths
for (const tr of Object.values(TRACKS)) for (const s of tr) { let L = 0; for (let i = 1; i < s[2].length; i++) L += Math.hypot(s[2][i][0] - s[2][i - 1][0], s[2][i][1] - s[2][i - 1][1]); s.push(L); }

/** state on a track (array of [t0, t1, path, heading|null, pose, length]) at time t → out {visible, x, z, h, pose, speed, seg} */
export function trackAt(tr, t, out) {
  out.visible = false; out.speed = 0; out.seg = -1;
  for (let i = 0; i < tr.length; i++) {
    const s = tr[i];
    if (t < s[0] || t >= s[1]) continue;
    out.visible = true; out.seg = i;
    const path = s[2], L = s[5];
    if (path.length === 1 || L < 1e-6) { out.x = path[0][0]; out.z = path[0][1]; out.h = s[3] ?? out.h; out.pose = s[4]; }
    else {
      let d = (t - s[0]) / (s[1] - s[0]) * L;
      for (let j = 1; j < path.length; j++) {
        const a = path[j - 1], b = path[j], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= l || j === path.length - 1) { const u = l > 0 ? clamp(d / l, 0, 1) : 1; out.x = a[0] + (b[0] - a[0]) * u; out.z = a[1] + (b[1] - a[1]) * u; out.h = s[3] ?? Math.atan2(b[0] - a[0], b[1] - a[1]); break; }
        d -= l;
      }
      out.pose = 'stand'; out.speed = L / (s[1] - s[0]);
      // a fixed heading that faces away from the way he is going = stepping backwards (negative speed: the gait runs in reverse)
      if (s[3] !== null && s[3] !== undefined) { const a = path[0], b = path[path.length - 1]; if ((b[0] - a[0]) * Math.sin(s[3]) + (b[1] - a[1]) * Math.cos(s[3]) < -0.35 * L) out.speed = -out.speed; }
    }
    return out;
  }
  return out;
}
/** actor state at time t → out {visible, x, z, h, pose, speed, seg}; heading null = keep walking direction */
export function actorAt(role, t, out, alarm = false) {
  trackAt(TRACKS[role], t, out);
  if (role === 'miguel' && alarm && t >= 53.6 && t < 54.6) out.pose = 'wave';      // flapping at the smoke alarm, mitts still on
  return out;
}

// ------------------------------------------------------------------------------------------------ Tesco visit
// Lorenzo's walk through Tesco Metro (ground floor), as a track built from the shop's own fixtures (W, from
// _friends_tesco.js): door → aisle mouth → a few steps short of the Jaffa Cakes (he sees them: "Might as well.") → the
// shelf (takes a box) → a self-checkout (scans, pays) → out. Times in seconds from the trip start; the whole visit fits
// in SHOP_S. W = { inPath: [door … look], bay, bayH, back: [[x,z]…], sco, scoH, outPath: [… door] } ([x,z], headings).
export const SHOP_WALK = 1.15;
export const SHOP_LINES = { jaffa: 'Might as well.' };
export function buildShopTrack(W) {
  const tr = [], ev = {};
  let t = 0.6;
  const len = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
  const walk = (p) => { const d = len(p) / SHOP_WALK; tr.push([t, t + d, p, null, 'stand']); t += d; };
  const stay = (p, h, pose, d) => { tr.push([t, t + d, [p], h, pose]); t += d; };
  const look = W.inPath[W.inPath.length - 1];
  walk(W.inPath);
  ev.jaffa = t + 0.2;                       // sees the Jaffa Cakes
  stay(look, W.bayH, 'stand', 2.6);
  walk([look, W.bay]);
  stay(W.bay, W.bayH, 'stand', 1.6);
  ev.take = t - 0.5;                        // box in hand from here
  walk([W.bay, ...W.back, W.sco]);
  ev.scan0 = t + 0.8;
  stay(W.sco, W.scoH, 'stand', 7.0);
  ev.scan1 = t - 1.2;
  walk([W.sco, ...W.outPath]);
  ev.out = t;
  for (const s of tr) s.push(len(s[2]));
  return { tr, ev, T: t };
}
/** shop lines: [t, who, text, secs] for a built track */
export const shopLines = (B) => [[B.ev.jaffa, 'lorenzo', SHOP_LINES.jaffa, 2.8]];

// ---- gestures: what each person's hands are doing. [t0, t1, name, cond?] — cond 'row' = row sessions only.
// _friends_dippers.js turns a gesture + its progress u (0..1) into arm reaches and attached props.
export const ACTS = {
  miguel: [
    [4.9, 5.6, 'fzOpen'], [5.6, 6.6, 'fzReach'], [6.6, 7.4, 'fzClose'], [7.4, 14.2, 'holdBag'],
    [14.2, 16.7, 'shake'], [16.7, 17.05, 'bagDown'], [17.05, 18.0, 'carryTray'], [18.0, 18.8, 'ovOpen'], [18.8, 19.6, 'trayIn'], [19.6, 20.3, 'ovClose'],
    [20.75, 21.4, 'timer'], [29.0, 35.5, 'phone'], [41.0, 44.0, 'peek'], [44.2, 46.2, 'wait'], [47.2, 48.3, 'mittsOn'],
    [49.0, 49.8, 'ovOpen'], [49.8, 50.6, 'trayGrab'], [50.6, 52.75, 'carryTray'], [52.75, 53.5, 'trayDown'],
    [54.6, 55.2, 'mittsOff'], [55.2, 56.0, 'cupboard'], [56.0, 58.0, 'scoop'], [58.1, 60.2, 'ketchup'], [60.2, 63.6, 'carryPlates'], [63.6, 64.4, 'setPlates'],
    [65.4, 66.0, 'ketchupDown'], [83.0, 85.6, 'what', 'row'], [104.55, 109.0, 'carryPlates'],
  ],
  lorenzo: [[15.6, 21.4, 'hover'], [25.2, 26.4, 'glassTake'], [26.4, 28.8, 'fill'], [28.8, 32.4, 'carryGlasses'], [32.4, 33.3, 'setGlasses'], [79.6, 81.7, 'inspect', 'row']],
  guest: [[GUEST_IN_S + 0.3, GUEST_IN_S + 2.4, 'sniff'], [70.2, 71.0, 'pinch'], [71.0, 73.6, 'pinchEat']],
};
/** the gesture of `role` at time t → out {name (or null), u, t0, t1} (s = the session, for 'row') */
export function actAt(role, t, s, out) {
  out.name = null; out.u = 0; out.t0 = 0; out.t1 = 0;
  for (const a of ACTS[role] || []) {
    if (t < a[0] || t >= a[1]) continue;
    if (a[3] === 'row' && !(s && s.row)) continue;
    out.name = a[2]; out.t0 = a[0]; out.t1 = a[1]; out.u = (t - a[0]) / (a[1] - a[0]); return out;
  }
  return out;
}
// ---- eating: each pick is EAT_S seconds: reach for the plate, dip in the ketchup, bite, chew, second bite, chew.
// Pick times are placed between that person's own lines (nobody talks with a full mouth).
/** the four passes of the fish slice as fractions of the 'scoop' gesture (the first is longer: he has to pick the slice up) */
export const SCOOP_U = [0, 0.31, 0.54, 0.77, 1];
export const EAT_S = 4.4;
export const EAT = { miguel: [67.8, 74.6, 81.2, 85.8, 90.4, 99.0], lorenzo: [70.8, 79.0, 86.0, 95.4, 99.9] };
/** eating state of `role` at t → out {k (pick index or −1), u (0..1 through the pick), done (dippers finished)} */
export function eatAt(role, t, out) {
  const P = EAT[role] || []; out.k = -1; out.u = 0; out.done = 0;
  for (let i = 0; i < P.length; i++) { if (t >= P[i] + EAT_S) out.done++; else if (t >= P[i]) { out.k = i; out.u = (t - P[i]) / EAT_S; } }
  return out;
}
// ---- one-shot sound cues [t, name] (synthesised in _friends_dippers.js)
export const CUES = [[4.95, 'fridge'], [7.3, 'fridgeShut'], [14.4, 'rattle'], [15.2, 'rattle'], [16.0, 'rattle'], [18.25, 'ovenOpen'], [19.3, 'traySlide'], [20.15, 'ovenShut'],
  [21.2, 'beep'], [27.0, 'tap'], [32.8, 'glass'], [33.1, 'glass'], [49.25, 'ovenOpen'], [50.5, 'traySlide'], [51.95, 'ovenShut'], [53.3, 'trayDown'],
  [56.4, 'clink'], [58.8, 'squirt'], [59.5, 'squirt'], [63.95, 'plate'], [64.3, 'plate'], [109.2, 'plate']];

const _e = { k: -1, u: 0, done: 0 };
/** props at time t → out (plain fields; see _friends_dippers.js for where each state is drawn). s = the session (guest) */
export function propsAt(t, out, s = null) {
  const r = (a, b) => clamp((t - a) / (b - a), 0, 1);
  out.freezer = t < 5.05 ? 0 : t < 5.55 ? r(5.05, 5.55) : t < 6.9 ? 1 : 1 - r(6.9, 7.4);                      // freezer door 0..1
  out.bag = t < 6.3 ? 'none' : t < 16.98 ? 'hand' : t < 108 ? 'counter' : 'none';
  out.shake = t >= 14.2 && t < 16.7 ? 1 : 0;
  out.tray = t < 17.05 ? 'hob' : t < 19.3 ? 'hand' : t < 50.5 ? 'oven' : t < 53.3 ? 'hand' : t < 108 ? 'side' : 'hob';
  out.cook = r(21, 49);
  out.trayN = t < 14.4 ? 0 : t < 16.7 ? Math.min(14, 1 + Math.floor((t - 14.4) / 0.165)) : t < 56.19 ? 14 : t < 56.76 ? 10 : t < 57.22 ? 7 : t < 57.68 ? 3 : 0;      // (four loads of the fish slice: SCOOP_U)
  out.door = t < 18.2 ? 0 : t < 18.8 ? r(18.2, 18.8) : t < 19.6 ? 1 : t < 20.2 ? 1 - r(19.6, 20.2) : t < 49.2 ? 0 : t < 49.8 ? r(49.2, 49.8) : t < 51.4 ? 1 : 1 - r(51.4, 52.0);
  out.light = t >= 18.2 && t < 52.0;
  out.timer = t < 21.2 ? null : t < 46 ? Math.ceil(20 * 60 * (46 - t) / (46 - 21.2)) : t < 50 ? ((t * 2) | 0) % 2 ? 0 : -1 : null;   // secs left; −1 = blank (blink)
  out.glove = t >= 47.6 && t < 54.9 ? 'hand' : t < 47.6 ? 'hook' : 'after';                               // the oven mitts ('hook' = their place by the hob)
  out.spatula = t >= 55.95 && t < 58.0 ? 'hand' : 'counter';
  out.plates = t < 55.9 ? 'none' : t < 60.4 ? 'counter' : t < 64.3 ? 'hands' : t < 104.8 ? 'table' : t < 109 ? 'hands' : 'none';
  out.plate1Down = t >= 63.95;                                                                              // Lorenzo's plate goes down first
  const fill0 = t < 56.5 ? 0 : t < 57.45 ? 4 : 7, fill1 = t < 56.99 ? 0 : t < 57.91 ? 3 : 7;
  const pinched = s && s.guest && t > 71 ? 1 : 0;
  out.plateN0 = t < 64.3 ? fill0 : Math.max(0, 7 - eatAt('miguel', t, _e).done - (_e.k >= 0 && _e.u > 0.14 ? 1 : 0));            // "There's always one left."
  out.plateN1 = t < 64.3 ? fill1 : Math.max(1, 7 - eatAt('lorenzo', t, _e).done - (_e.k >= 0 && _e.u > 0.14 ? 1 : 0) - pinched);  // (the guest pinches one of Lorenzo's: the plate within reach)
  out.ketchup = t < 58.3 ? 'counter' : t < 60.2 ? 'hand' : t < 65.5 ? 'plate' : t < 66.0 ? 'hand' : t < 108 ? 'table' : 'counter';
  out.dollop0 = r(58.8, 59.3); out.dollop1 = r(59.5, 60.0);
  out.dollops = t >= 60.0 && t < 109;
  out.glasses = t < 25.6 ? 'drainer' : t < 33.1 ? 'hands' : t < 107 ? 'table' : 'drainer';
  out.glass0Down = t >= 32.8;                                                                               // Miguel's glass goes down first (right hand), then Lorenzo's own
  out.water = r(26.6, 28.6);
  out.phone = t >= 29.3 && t < 35.2;
  out.steam = clamp((t - 30) / 14, 0, 1) * (t < 50 ? 1 : 0);                                                // from the oven vent
  out.steamTray = t >= 49.8 && t < 84 ? 1 - r(53, 84) : 0;                                                  // off the hot tray
  out.fan = t >= 21.2 && t < 62 ? 1 : 0;
  out.sizzle = t < 26 ? 0 : t < 50 ? r(26, 44) * 0.8 : t < 60 ? 1 - r(52, 60) : 0;
  out.beep = t >= 46 && t < 48.2;
  return out;
}
/** can the player take a dipper? (plates on the table) */
export const dipperOnTable = (t) => t >= 64.6 && t < 104;
export const OFFER_T = 8.0, REPLY_T = 12.0;

/** scene lines: [t, who ('miguel'|'lorenzo'|'guest'), text, secs, cond?, 'pri'?] — cond: 'guest' / 'alarm' / 'noalarm' /
 *  'row' (session.row) / 'evening' (the dinner session, 19:00–19:30: Lorenzo hurrying them along); 'pri' = spoken even if that person spoke < 6 s ago */
export const SCENE_LINES = [
  [OFFER_T, DIPPERS_LINES.offer.who, DIPPERS_LINES.offer.text, 4.5],
  [REPLY_T, DIPPERS_LINES.reply.who, DIPPERS_LINES.reply.text, 3.5],
  [15.6, 'lorenzo', "if we don't start now, brrrrrrrrrrr, MIDNIGHT!", 3.4, 'evening'],   // user's line for Lorenzo (exactly as written; friends.js CATCH.lorenzo.late): evening sessions only
  [19.0, 'miguel', 'Twenty minutes. Eighteen if I believe in myself.', 3.5],
  [24.0, 'lorenzo', 'Dai, Miguel. Do they really take twenty minutes?', 3.5],
  [28.5, 'miguel', 'Patience, pá. Art takes time.', 3],
  [33.0, 'lorenzo', 'Don’t tell anyone in Italy about this, okay?', 3.5],
  [GUEST_IN_S + 2.5, 'guest', '@arrive', 3.5, 'guest'],
  [GUEST_IN_S + 5.5, 'miguel', 'Olá! You followed the smell, right?', 3, 'guest'],
  [44.0, 'lorenzo', 'I can hear them sizzling. Is that normal?', 3],
  [46.3, 'miguel', 'Ding! That’s my cue.', 2.5],
  [50.2, 'miguel', 'It’s fine, it’s fine! They’re just extra crispy.', 3.5, 'alarm'],
  [53.0, 'lorenzo', 'Mamma mia, the alarm again.', 3, 'alarm'],
  [51.0, 'miguel', 'Look at that. Perfectly golden.', 3, 'noalarm'],
  [58.0, 'miguel', 'Ketchup? Of course ketchup.', 2.5],
  [62.0, 'guest', 'Is one of those for me?', 2.5, 'guest'],
  [63.6, 'miguel', 'Fine, you can have one. One!', 3, 'guest'],
  [66.0, 'miguel', 'Mmmm, shicken deepers.', 3, null, 'pri'],          // the user's catchphrase for Miguel, food on the table
  [67.0, 'lorenzo', 'Okay. I admit it. These are really good.', 3.5],
  [72.2, 'miguel', 'Obrigado. It’s all in the timing.', 3],
  [76.0, 'lorenzo', 'Same time tomorrow?', 2.5],
  [79.0, 'miguel', 'Obviously.', 2],
  [82.5, 'lorenzo', 'This is basically row.', 3, 'row'],              // user: he said "raw" as "row" (rhymes with go); ~1 session in 3
  [85.0, 'guest', '@eat', 3.5, 'guest'],
  [92.0, 'lorenzo', 'I’m full. ...Is there one left?', 3],
  [96.0, 'miguel', 'There’s always one left.', 3],
  [105.6, 'miguel', 'Right, washing up. Lorenzo, you’re drying.', 3.5],
  [107.0, 'lorenzo', 'Ciao, ciao! See you at the bar.', 3],
];
export const GUEST_LINES = {
  arrive: {
    kotaro: 'Yosh! I could smell these from the other side of the garden.', aiken: 'Is that chicken dippers? Go on then, I’ll have one.',
    matt: 'Something smells proper good in here. Mind if I join you?', taskeen: 'I was told there were chicken dippers. I’m here for the chicken dippers.',
    dina: 'I followed the smell all the way from the library.', james: 'I brought emergency ketchup. Just in case.',
  },
  eat: {
    kotaro: 'Sugoi. Crispy outside, soft inside.', aiken: 'Cheers, Miguel. Cracking dippers, these.', matt: 'Cheers, mate. That hit the spot.',
    taskeen: 'Okay, that was worth leaving the library for.', dina: 'Best thing I’ve eaten all week.', james: 'These are going straight in the emergency rations bag.',
  },
};
/** the text of scene line L for a session (null = skip) */
export function lineText(L, s) {
  const cond = L[4];
  if (cond === 'guest' && !(s && s.guest)) return null;
  if (cond === 'alarm' && !(s && s.alarm)) return null;
  if (cond === 'noalarm' && s && s.alarm) return null;
  if (cond === 'row' && !(s && s.row)) return null;
  if (cond === 'evening' && !(s && s.kind === 'dinner')) return null;
  if (L[2] === '@arrive' || L[2] === '@eat') return (GUEST_LINES[L[2].slice(1)] || {})[s.guest] || null;
  return L[2];
}

// ------------------------------------------------------------------------------------------------ walk-in legs
// Friends WALK into the walk-in rooms (core/interiors.js "seamless") instead of vanishing at the door: a LEG is a timed
// polyline in WORLD x/z with a height per point (a room-frame height, or null = the world's ground), the room each
// point is in (null = outdoors) and a pause at a point (waiting for a door). It is a pure function of time, so every
// client puts a friend at the same spot of a leg at the same moment of the shared clock. Positions only.
//   point: [x, z, y | null, room | null, wait s, pace (x speed on the segment that ENDS here), intent (1 = the pause is at a door)]
export const EARL_ID = 'worcint_earl';
export const DOOR_INTENT_V = 0.5;        // reported speed while paused at a hinged door: "walking at it" (core/_doors.js opens for > 0.35 m/s)
export function mkLeg(pts, speed) {
  const n = pts.length, xs = new Float64Array(n), zs = new Float64Array(n), ys = new Float64Array(n), ta = new Float64Array(n), td = new Float64Array(n), rm = new Array(n).fill(null), intent = new Uint8Array(n);
  let t = 0, len = 0, waits = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    xs[i] = p[0]; zs[i] = p[1]; ys[i] = p[2] === null || p[2] === undefined ? NaN : p[2]; rm[i] = p[3] || null; intent[i] = p[6] ? 1 : 0;
    if (i) { const l = Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]); len += l; t += l / (speed * (p[5] || 1)); }
    ta[i] = t; t += p[4] || 0; td[i] = t; waits += p[4] || 0;
  }
  return { n, xs, zs, ys, rm, ta, td, intent, len, dur: t, waits, speed };
}
/** where a leg has its walker tr seconds after its start -> out { x, z (world), y (room-frame height), yg (0..1: how much
 *  of the height is the world's ground: 1 outdoors, 0 indoors, between on the threshold), room (id | null), h, speed
 *  (the gait), intent (paused at a door, facing it) } */
export function legAt(L, tr, out) {
  const n = L.n; tr = clamp(tr, 0, L.dur);
  if (n === 1) { out.x = L.xs[0]; out.z = L.zs[0]; out.y = L.ys[0] === L.ys[0] ? L.ys[0] : 0; out.yg = L.ys[0] === L.ys[0] ? 0 : 1; out.room = L.rm[0]; out.speed = 0; out.intent = false; return out; }
  let i = 1; while (i < n - 1 && L.td[i] <= tr) i++;
  // on the segment i-1 -> i, or paused at its far end
  const a = i - 1, t0 = L.td[a], t1 = L.ta[i], paused = tr >= t1;
  const u = paused || t1 <= t0 ? 1 : clamp((tr - t0) / (t1 - t0), 0, 1);
  out.x = L.xs[a] + (L.xs[i] - L.xs[a]) * u; out.z = L.zs[a] + (L.zs[i] - L.zs[a]) * u;
  const ya = L.ys[a], yb = L.ys[i], ga = ya !== ya, gb = yb !== yb;
  out.y = ga && gb ? 0 : ga ? yb : gb ? ya : ya + (yb - ya) * u;
  out.yg = ga && gb ? 1 : ga ? 1 - u : gb ? u : 0;
  out.room = L.rm[i] || L.rm[a];
  // heading: along the segment; paused at a point: towards the next one (the door); at the very end: as he arrived
  let ha = a, hb = i;
  if (paused && i < n - 1) { ha = i; hb = i + 1; }
  const dx = L.xs[hb] - L.xs[ha], dz = L.zs[hb] - L.zs[ha];
  if (dx * dx + dz * dz > 1e-8) out.h = Math.atan2(dx, dz);
  out.intent = paused && !!L.intent[i] && tr < L.dur;
  out.speed = paused || t1 <= t0 ? 0 : Math.hypot(L.xs[i] - L.xs[a], L.zs[i] - L.zs[a]) / (t1 - t0);
  return out;
}

// ---- the Earl Building (plan: _worcint_earl_plan.js, re-laid 2026-11-22 on the architects' plan). The kitchen is on
// the GROUND floor (the owner), so nobody climbs the stair: the automatic door under the canopy -> the lobby -> left
// through its two-way fire door into the wing's corridor -> the kitchen door at the corridor's south end: the plan's
// WAY_IN, from the plan's own numbers.
const CZ = K.door[1], EY = 0;      // (EY: the kitchen's floor = the ground floor)
/** the hinged doors the route crosses (plan frame): a plane across z (the lobby's fire door) or across x */
export const EARL_DOORS = [{ z: (EP.HALL.z1 + CORR.z0) / 2 }];
export const EARL_DOOR_X = EARL_DOORS.filter((d) => d.x !== undefined).map((d) => d.x);      // (before the re-lay both doors stood across x)
/** inside the building, threshold -> the kitchen door in the corridor: [[x, z, y]] (plan frame) */
export const EARL_WAY = EP.WAY_IN.map((p) => [p[0], p[1], EY]);
export const DOOR_WAIT = { slide: 0.4, hinged: 0.6 };
const DOOR_BACK = 0.9;                  // m short of a hinged door's plane at which he pauses for the leaf
/** Miguel's room: he lives in the Earl Building (the user); WHICH room is not known. GUESS: the ground-floor room next
 *  to the kitchen (the plan's ROOM_AT). He stops at its door and is "in his room" (not drawn), as he was at the entrance. */
export const EARL_ROOM_AT = EP.ROOM_AT.slice();
/** a polyline [[x, z, y]] walked in order, with a pause (wait, intent) put DOOR_BACK short of every door plane it crosses */
function withDoorPauses(P) {
  const out = [[P[0][0], P[0][1], P[0][2], 0, 0]];
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const D of EARL_DOORS) {
      const k = D.z !== undefined ? 1 : 0, X = k ? D.z : D.x;
      if (!((a[k] - X) * (b[k] - X) < 0) || l < 1e-6) continue;
      const tc = (X - a[k]) / (b[k] - a[k]), back = Math.min(DOOR_BACK, tc * l), u = tc - back / l;
      if (u < 0.05 / l) { const q = out[out.length - 1]; q[3] = DOOR_WAIT.hinged; q[4] = 1; }
      else out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, DOOR_WAIT.hinged, 1]);
    }
    out.push([b[0], b[1], b[2], 0, 0]);
  }
  return out;
}
const RECESS = [EP.DOOR_OUT[0], EP.DOOR_OUT[1], null], FACE = [EP.DOOR_FACE[0], EP.DOOR_FACE[1], null];      // (under the canopy; at the door's face)
const _legs = new Map();
/**
 * A leg in the Earl Building for someone walking at a given speed. kind:
 *   'in:K' / 'in:R'   from the friends' door node (world [x, z]) in through the automatic door and the lobby's fire
 *                     door to the kitchen door (K.door: where the dippers scene picks them up) / to
 *                     Miguel's room door
 *   'K:out' / 'R:out' the same way back out to the node
 *   'R:K' / 'K:R'     along the corridor between Miguel's room door and the kitchen door
 */
export function earlLeg(kind, node, speed) {
  const key = kind + '|' + speed + '|' + node[0] + ',' + node[1];
  let L = _legs.get(key); if (L) return L;
  const W = (p, wait, intent) => { const w = earlToWorld(p[0], p[1]); return [w[0], w[1], p[2] === undefined ? EY : p[2], p[2] === null ? null : EARL_ID, wait || 0, 1, intent ? 1 : 0]; };
  const nd = [node[0], node[1], null, null, 0, 1, 0];
  const [a, b] = kind.split(':');
  // the way inside to the kitchen door, or (R) as far along the corridor as his room, then to its door
  const toEnd = (e) => { if (e === 'K') return EARL_WAY.slice(); return [...EARL_WAY.slice(0, -1), [EARL_ROOM_AT[0], CZ, EY], [EARL_ROOM_AT[0], EARL_ROOM_AT[1], EY]]; };
  let pts;
  if (a === 'in') {
    pts = [nd, W(RECESS, DOOR_WAIT.slide), W(FACE), ...withDoorPauses(toEnd(b)).map((p) => W(p, p[3], p[4]))];
  } else if (b === 'out') {
    const P = withDoorPauses(toEnd(a).reverse()).map((p) => W(p, p[3], p[4]));
    // (a pause inside the automatic door, which has already seen him coming)
    const k = P.length - 2; if (k >= 0 && !P[k][4]) P[k][4] = DOOR_WAIT.slide;
    pts = [...P, W(FACE), W(RECESS), nd];
  } else {
    const R = [[EARL_ROOM_AT[0], EARL_ROOM_AT[1], EY], [EARL_ROOM_AT[0], CZ, EY], [K.door[0], CZ, EY]];
    pts = (a === 'R' ? R : R.reverse()).map((p) => W(p));
  }
  // (drop a doubled point where two pieces meet)
  pts = pts.filter((p, i) => !i || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.02);
  L = mkLeg(pts, speed); L.kind = kind;
  _legs.set(key, L);
  return L;
}
/** when the dippers scene has `id` in the kitchen: [t0, t1] seconds from the session start (their track: TRACKS) */
export function kitchenWindow(id) { const tr = TRACKS[COOKS.includes(id) ? id : 'guest']; return [tr[0][0], tr[tr.length - 1][1]]; }
/** the same leg walked a little faster (up to `max` times) so that it takes no longer than `avail` seconds */
export const LEG_HURRY = 1.4;
export function earlLegIn(kind, node, speed, avail) {
  const L = earlLeg(kind, node, speed);
  if (L.dur <= avail || avail <= L.waits + 1) return L;
  const f = (L.dur - L.waits) / (avail - L.waits) * 1.0005;
  return f <= LEG_HURRY ? earlLeg(kind, node, speed * f) : L;
}
export { earlToLocal, earlToWorld };
export { TABLE_PLATES };
