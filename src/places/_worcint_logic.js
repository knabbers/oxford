// Worcester College interiors — pure rules (no DOM / three): service + meal timetable, post in the pidge, essay jokes.
// Everything players should agree on derives from the shared game day + hour.

import { tn } from '../core/features.js';
/** game day index from game.time (the length of a game day: core/time.js) */
import { DAY_MS } from '../core/time.js';
export const dayOf = (time) => (!time ? 0 : typeof time.day === 'number' ? time.day : time.now ? Math.floor(time.now() / DAY_MS) : 0);
const mod = (a, n) => ((a % n) + n) % n;

/** choral evensong: four times a week in term (tour sheet). Day pattern + time are guesses: 18:00–18:45 */
export function evensong(day, hour) { return [0, 2, 4, 5].includes(mod(day, 7)) && hour >= 18 && hour < 18.75; }
/** candles lit in the chapel: from 17:30 on service days, otherwise after dark */
export function chapelCandles(day, hour, daylight) {
  if ([0, 2, 4, 5].includes(mod(day, 7)) && hour >= 17.5 && hour < 19.25) return 1;
  return daylight < 0.35 ? 0.55 : 0;
}
/** meals in Hall: lunch 12–14, dinner 18–20 (formal hall 19:00–20:30 three nights a week) */
export function meal(day, hour) {
  if (formal(day, hour)) return 'formal';
  if (hour >= 12 && hour < 14) return 'lunch';
  if (hour >= 18 && hour < 20) return 'dinner';
  return null;
}
export function formal(day, hour) { return [1, 3, 6].includes(mod(day, 7)) && hour >= 19 && hour < 20.5; }
export const MEAL_PRICE = { lunch: 3.1, dinner: 3.4, formal: 0 };   // formal is booked in advance (signed up via the JCR)
export const MENU = {
  lunch: ['jacket potato with beans and cheese', 'chicken curry and rice', 'veggie lasagne and salad', 'fish and chips (it is Friday somewhere)', 'shepherd’s pie and peas'],
  dinner: ['roast chicken, potatoes and greens', 'mushroom risotto', 'beef stew with dumplings', 'pasta bake and garlic bread', 'sausage and mash'],
};
export function menuItem(kind, day, n = 0) { const l = MENU[kind] || MENU.dinner; return l[mod(day * 3 + n, l.length)]; }

/** Worcester's grace: the long Christ Church text (Wikipedia, Traditions). Split into subtitle lines. */
export const GRACE = [
  'Nos miseri homines et egeni, pro cibis quos nobis ad corporis subsidium benigne es largitus,',
  'tibi, Deus omnipotens, Pater caelestis, gratias reverenter agimus;',
  'simul obsecrantes, ut iis sobrie, modeste atque grate utamur.',
  'Insuper petimus, ut cibum angelorum, verum panem caelestem, verbum Dei aeternum,',
  'Dominum nostrum Iesum Christum, nobis impertiaris;',
  'utque illo mens nostra pascatur et per carnem et sanguinem eius foveamur, alamur, et corroboremur.',
  'Amen.',
];

/** post in the pigeonhole: deterministic per (day, check number) */
export const POST = [
  { from: 'The Bursar', text: 'Battels statement: £1,284.16. Payment is due by Friday of 1st week. Please do not reply to this envelope.' },
  { from: 'Your tutor', text: '“Where is the essay on Hobbes? It was due at 9 a.m. We will discuss this — and Hobbes — at your tutorial. Bring something written.”' },
  { from: 'JCR Ents', text: 'BOP THIS FRIDAY — theme: “Things beginning with W”. Cellar Bar, 9pm. Stings £4.50.' },
  { from: 'The Library', text: 'Overdue notice: “Leviathan” (Penguin Classics). Fine: 40p and rising.' },
  { from: 'College Boat Club', text: 'Novice rowing! No experience needed. Outings at 6:30 a.m. Yes, a.m.' },
  { from: 'The Domestic Bursar', text: 'Your scout reports a toaster in your room. Toasters are a fire hazard. Please remove the toaster.' },
  { from: 'Mum', text: 'A postcard: “Hope you are eating properly. Love, Mum x” — with a £10 note inside.', money: 10 },
  { from: 'Pidge', text: 'Nothing but a flyer for a comedy night at the Oxford Union, and a free pen.' },
  { from: 'The Chaplain', text: 'Choral Evensong tonight at 6pm. All welcome; sherry afterwards.' },
  { from: 'Porters’ Lodge', text: 'A parcel is waiting for you at the Lodge (it rattles).' },
];
export function postFor(day, n, seed = 0) { return POST[mod(day * 7 + n * 3 + seed, POST.length)]; }

/** essay progress joke: words written so far after k sessions */
export function essayStep(words, k) {
  const add = [212, 37, 0, 480, -150, 95, 3, 640][mod(k, 8)];
  const w = Math.max(0, words + add);
  const msg = add > 400 ? `A burst of inspiration! ${w} words.` : add > 100 ? `Steady progress: ${w} words.` : add > 0 ? `You rewrite the first sentence. Again. ${w} words.` : add === 0 ? `You reorganise your highlighters. ${w} words.` : `You delete a paragraph that “wasn’t working”. ${w} words.`;
  return { words: w, msg: w >= 2000 ? `Done! ${w} words on Hobbes. Your tutor will be amazed (or at least not cross).` : msg, done: w >= 2000 };
}
export const clampEnergy = (e) => Math.max(0, Math.min(100, e));

// ------------------------------------------------------------------------------------------------ the pigeonhole room
/** start / spawn spots in the pidge room (room frame: x east, z south, door wall z = 0, far rack at z = -5.2), facing the
 *  far rack. Peer k takes slot (id - 1) mod N, skipping any slot another player already stands on (pidgeSlot). */
export const PIDGE_SLOTS = [[0.3, -2.0, Math.PI], [-0.65, -2.2, Math.PI], [1.25, -2.25, Math.PI], [-0.2, -1.25, Math.PI], [0.85, -1.3, Math.PI], [-1.35, -1.55, Math.PI]];
export function pidgeSlot(id, others = [], slots = PIDGE_SLOTS) {
  const n = slots.length, base = mod((id | 0) - 1, n);
  for (let k = 0; k < n; k++) {
    const i = (base + k) % n, s = slots[i];
    if (!others.some(([x, z]) => Math.hypot(x - s[0], z - s[1]) < 0.7)) return i;
  }
  return base;
}
/** the friends' holes (first names only), by rack (0 west, 1 north), column, row (0 = bottom) */
export const PIDGE_FRIENDS = [
  { name: 'Matt', rack: 1, col: 8, row: 5 }, { name: 'Miguel', rack: 1, col: 9, row: 2 }, { name: 'Aiken', rack: 0, col: 1, row: 4 },
  { name: 'Taskeen', rack: 1, col: 16, row: 6 }, { name: 'Lorenzo', rack: 1, col: 7, row: 3 }, { name: 'Dina', rack: 0, col: 4, row: 5 },
  { name: 'James', rack: 0, col: 7, row: 2 }, { name: 'Kotaro', rack: 0, col: 10, row: 6 },
];
// rough share of British surnames by initial (%): fills the racks A..Z in order
const INITIALS = { A: 3, B: 9, C: 7, D: 5, E: 2, F: 4, G: 5, H: 8, I: 0.6, J: 2.2, K: 3, L: 5, M: 8, N: 2, O: 1.5, P: 6, Q: 0.3, R: 5, S: 10, T: 4, U: 0.3, V: 1, W: 7, Y: 0.6, Z: 0.3 };
/** n holes in reading order -> the surname initial each one is for */
export function surnameLetters(n) {
  const ks = Object.keys(INITIALS), tot = ks.reduce((a, k) => a + INITIALS[k], 0), out = [];
  let acc = 0;
  for (const k of ks) { acc += INITIALS[k]; const upto = Math.round((acc / tot) * n); while (out.length < upto) out.push(k); }
  while (out.length < n) out.push(ks[ks.length - 1]);
  return out;
}
/** what is in your pigeonhole today: one item per game day, the same for everyone (no network) */
export const PIDGE_POST = [
  { kind: 'tutor', from: 'A note from your tutor', text: '“The essay on Hobbes was due on Friday. I look forward to reading it at your tutorial — or to hearing, at some length, why not.”' },
  { kind: 'tutor', from: 'A note from your tutor', text: '“Reading for next week below (eleven books). Please also bring last week’s essay, which I appear not to have.”' },
  { kind: 'tutor', from: 'A note from your tutor', text: '“Tutorial moved to 9 a.m. tomorrow. Essay by 6 p.m. tonight, please. Yes, tonight.”' },
  { kind: 'flyer', from: 'A neon-pink flyer', text: 'BOP this Friday! Cellar Bar, 9pm. Theme: Space. Stings £4.50.' },
  { kind: 'flyer', from: 'A Boat Club flyer', text: '“Novice rowing! No experience needed. Outings at 6:30.” Someone has written “A.M.” underneath and underlined it twice.' },
  { kind: 'flyer', from: 'A flyer', text: 'Comedy night on Thursday, two pounds on the door. On the back, in biro: “PLEASE COME, it’s my first gig.”' },
  { kind: 'library', from: 'A yellow slip', text: 'RECALL: “Leviathan” has been requested by another reader. Please return it to the College Library within three days.' },
  { kind: 'parcel', from: 'A pink slip', text: 'There is a PARCEL for you at the Lodge. Bring your Bod card. (The porter says it rattles.)' },
  { kind: 'battels', from: 'An envelope from the Bursary', text: 'Your battels. You read the total, put the envelope back in the pigeonhole and leave it for future you.' },
  { kind: 'jcr', from: 'JCR minutes', text: 'Minutes of the last JCR meeting. Motion 4 (a second toaster) passed. Motion 5 (shorter meetings) ran out of time.' },
  { kind: 'chapel', from: 'A card from the Chapel', text: 'Choral Evensong tonight at six. All welcome; sherry afterwards.' },
  { kind: 'none', from: 'Your pigeonhole', text: 'Nothing today. Just a flyer for a society you have never heard of and somebody else’s bus ticket.' },
  { kind: 'none', from: 'Your pigeonhole', text: 'Empty. You feel round the back of the hole, just in case. Still empty.' },
];
export const PIDGE_HOME = { kind: 'home', from: 'A card from home', text: '“Hope you are eating properly and not just toast. Lots of love x” — and a £10 note tucked inside.', money: 10 };
/** the very first time you look (new save): a note under the post with the way out and into town, by landmarks — the game
 *  has no map on purpose, so this is the only "tutorial" there is */
export const PIDGE_WELCOME = { from: 'A note folded into the back of the pigeonhole',
  text: '“Welcome. Three things nobody tells you. One: the way out is left from this door, along the cloister, then right through the Lodge arch to the gates on Walton Street. The bikes on the railings outside are there to be borrowed. Two: Beaumont Street runs straight ahead from the gates; at its far end turn right and keep going for the shops and Carfax. The black signposts at the big corners will do the rest. Three: the Cellar Bar is across this quad. — a second-year”' };
/** every day after that, one line of the list somebody keeps pinned inside the pigeonholes: things that are really in the
 *  game, with the way there in words (shared: the same line for everybody on the same game day) */
export const PIDGE_LIST = [
  'Climb Carfax Tower, where Cornmarket meets the High, and wave at somebody.',
  'Take a punt out from under Magdalen Bridge, at the far end of the High. Do not let go of the pole.',
  'Fly a glider. The club is up Airfield Lane, off the top of the Marston Road, over the river to the east.',
  'Swim in the Thames at Port Meadow: out through Jericho and down Walton Well Road.',
  'Sit through the banana lecture in the Robert Hooke Building on Parks Road.',
  'Run a timed mile at the Iffley Road track, where it was first done in under four minutes.',
  'Be in Tom Quad at five past nine at night and count Great Tom: a hundred and one.',
  'Win at darts or pool in the Cellar Bar, across Pump Quad.',
  'Dance at the Purple Turtle, down Frewin Court off Cornmarket. It opens at half past nine.',
  'Drive a bus round its whole route. Get in at a stop and press R.',
  'Find the dodo in the Museum of Natural History on Parks Road.',
  'Climb the Castle Mound, on the way down to the station.',
  'Go up St Mary’s tower on the High and look down on the Radcliffe Camera.',
  tn('Find a customer’s book in the Norrington Room at Blackwell’s on Broad Street.', 'Find a customer’s book in the basement of Haldane & Crewe on Broad Street.'),
  'Jump off Magdalen Bridge. (Everybody will tell you not to.)',
  'Get your sightseeing passport stamped somewhere new. (P opens it.)',
];
export function pidgeList(day) { const n = mod(Math.floor(day) * 5 + 3, PIDGE_LIST.length); return { n: n + 1, text: PIDGE_LIST[n] }; }
const hash32 = (n) => { let h = (n | 0) * 2654435761 >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
export function pidgeToday(day) {
  const h = hash32(mod(day, 1e6) + 7919);
  if (h % 9 === 0) return PIDGE_HOME;                 // about one day in nine
  return PIDGE_POST[(h >>> 4) % PIDGE_POST.length];
}
