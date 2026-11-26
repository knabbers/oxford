// Purple Turtle — pure rules of a night out (no DOM, no three.js): tonight's named club-goers (invented people, drawn
// from the night's seed: a name, a mood, tastes, a favourite drink, where they live), catching an eye, the approach,
// shouted conversation, drinks, dancing together on the track's beat, a rival, the scrap, and the walk home.
// Everything a player can win or lose at is decided here, from seeds, so tools/smoke_pt_social.mjs can play whole nights.
// Nothing here is a real person: names are first names only, from lists that avoid everyone in places/_people.js.
import { hash, rng, DRINKS, HOUR_MS } from './_pt_logic.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const NAMES_F = ['Rosie', 'Beth', 'Imogen', 'Priya', 'Hattie', 'Freya', 'Zara', 'Molly', 'Niamh', 'Tilly', 'Anya', 'Cerys', 'Flo', 'Esme', 'Jess', 'Leila', 'Martha', 'Sophie', 'Ottilie', 'Bea'];
export const NAMES_M = ['Tom', 'Ollie', 'Hugo', 'Raj', 'Callum', 'Ed', 'Josh', 'Theo', 'Finn', 'Sam', 'Alfie', 'Dev', 'Rory', 'Max', 'Will', 'Kit', 'Jonny', 'Luke', 'Barnaby', 'Seb'];
export const TASTES = ['funny', 'sincere', 'nerdy'];
/** what they drink (keys of DRINKS) — seen at the bar, or asked */
export const FAVOURITES = ['vodka', 'cider', 'gin', 'rum', 'pint', 'jager', 'alcopop', 'cocktail', 'snakebite'];
export const PER_SEX = 3;
export const SPARK = { noticed: 10, chatty: 28, dancing: 46, close: 68, home: 82 };

/** tonight's invented regulars of one sex ('f' | 'm'): deterministic from the night, the same on every client */
export function personasFor(night, sex) {
  const names = sex === 'f' ? NAMES_F : NAMES_M, r = rng(`pt-people|${night}|${sex}`), out = [], used = new Set();
  const pick = () => { let n; do { n = names[Math.floor(r() * names.length)]; } while (used.has(n)); used.add(n); return n; };
  // one is always open to meeting someone, one is always not interested tonight; the third is anyone's guess
  const moods = ['open', 'no', r() < 0.45 ? 'lukewarm' : r() < 0.6 ? 'open' : 'no'];
  for (let i = moods.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [moods[i], moods[j]] = [moods[j], moods[i]]; }
  for (let i = 0; i < PER_SEX; i++) {
    const shy = r();
    const P = {
      key: `${sex}${i}`, sex, i, night, name: pick(), seed: Math.floor(r() * 1e9), friendName: pick(), friendSeed: Math.floor(r() * 1e9),
      mood: moods[i], reason: ['friends', 'taken', 'tired'][Math.floor(r() * 3)],
      taste: TASTES[Math.floor(r() * 3)], drink: FAVOURITES[Math.floor(r() * FAVOURITES.length)],
      eye: [0.7 + shy * 0.5, 1.5 + shy * 1.5],                 // how long they hold a look (shy … bold)
      dance: 0.75 + r() * 0.5, near: 0.95 + r() * 0.5,          // how much dancing counts; the distance they like
      overdo: moods[i] !== 'open' && r() < 0.35,                // has a few too many: friends put them in a taxi about 01:00
      scrappy: r() < 0.18,                                      // the rare one who is impressed by a scrap
      chips: r() < 0.6, arrive: 0.25 + i * 0.3 + r() * 0.3,     // game hours after doors
      home: Math.floor(r() * 1e6), patience: 2 + Math.floor(r() * 2),
    };
    P.taxiAt = P.overdo ? 3.2 + r() * 0.7 : 99;                 // night-hours
    out.push(P);
  }
  return out;
}
/** how far gone they are at night-hour nh (0 sober … 1): only the ones who overdo it pass 0.6 */
export function tipsy(P, nh) { const t = Math.max(0, nh - P.arrive); return clamp(P.overdo ? t * 0.3 : t * 0.09, 0, P.overdo ? 1 : 0.4); }
export const SPOTS = ['floor', 'huddle', 'bar', 'sofa'];
/** where they are in 22 s slots of the shared clock, and whether their friend is with them (-> {spot, friend, slot}) */
export function spotAt(P, T) {
  const slot = Math.floor(T / 22000), x = hash('ptspot', P.night, P.key, slot);
  const spot = x < 0.36 ? 'floor' : x < 0.66 ? 'huddle' : x < 0.88 ? 'bar' : 'sofa';
  const friend = spot === 'bar' ? hash('ptfr', P.key, slot) < 0.2 : hash('ptfr', P.key, slot) < 0.68;
  return { spot, friend, slot };
}

// ------------------------------------------------------------------------------------------------ the court
export function newCourt() {
  return { spark: 0, warm: false, met: false, glances: 0, stares: 0, talks: 0, goodTalks: 0, convo: 0, inConvo: 0, drinks: 0, rightDrink: false, toldDrink: false, asked: 0,
    talkGain: 0, beats: 0, goodBeats: 0, danceGain: 0, strikes: 0, no: 0, over: false, why: null, idle: 0, fluffs: 0 };
}
const mult = (P, C) => (P.mood === 'no' ? 0 : P.mood === 'lukewarm' && !C.warm ? 0.6 : 1);
function bump(P, C, d) { if (C.over) return 0; const g = d > 0 ? d * mult(P, C) : d; const s0 = C.spark; C.spark = clamp(C.spark + g, 0, 100); return C.spark - s0; }
/** drinks help your nerve, then hurt it: 0 sober nerves … 1 at a couple of drinks … falling away again */
export function confidence(drunk) { return drunk < 0.08 ? 0.55 : drunk <= 0.45 ? 1 : clamp(1 - (drunk - 0.45) * 2.4, 0, 1); }
/** how well your feet do what you ask: 1 up to a couple of drinks, then worse */
export function coordination(drunk) { return clamp(1 - Math.max(0, drunk - 0.3) * 1.5, 0.25, 1); }

/** a look across the room. held = how long you kept looking after your eyes met; hers = how long they held it.
 *  -> 'missed' (you looked away first) | 'good' | 'perfect' (you looked away just as they did) | 'stare' */
export function judgeGlance(held, hers, drunk = 0) {
  const tol = 0.75 + 0.35 * confidence(drunk);
  if (held < hers * 0.6) return 'missed';
  if (held > hers + tol) return 'stare';
  return Math.abs(held - hers) < 0.35 ? 'perfect' : 'good';
}
export function glanceHold(P, k) { return P.eye[0] + (P.eye[1] - P.eye[0]) * hash('pteye', P.seed, k); }
export function onGlance(P, C, res) {
  if (res === 'stare') { C.stares++; return bump(P, C, C.stares > 1 ? -9 : -5); }
  if (res === 'missed' || P.mood === 'no') return 0;
  if (C.glances >= 3) return 0;
  C.glances++; return bump(P, C, res === 'perfect' ? 8 : 6);
}

export const REFUSALS = {
  friends: ["Sorry — I'm just out with my friends tonight!", "Honestly, not tonight. Have a good one though!"],
  taken: ["That's sweet, but I'm seeing someone. Sorry!", "Really — I'm taken. Night!"],
  tired: ["I'm shattered and going home soon. Sorry!", "I meant it — I'm off in a minute."],
  firm: ['I said no, thanks.', 'Please leave me alone.'],
};
/**
 * Walking up and saying hello. env: {friendTalking, running, drunk, herTipsy, crowded}
 * -> {ok (a conversation starts), line, delta, bouncer (their friend has gone to fetch one), who ('her' | 'friend')}
 */
export function onApproach(P, C, env = {}) {
  if (C.over) return { ok: false, line: REFUSALS.firm[1], delta: 0, who: 'her' };
  if (env.herTipsy > 0.6) return { ok: false, who: 'friend', delta: 0, line: `${P.name}'s had enough tonight. I'm getting ${P.sex === 'f' ? 'her' : 'him'} a taxi.` };
  if (P.mood === 'no') {
    C.no++; C.met = true;
    if (C.no <= 2) return { ok: false, who: 'her', delta: 0, line: REFUSALS[P.reason][C.no - 1] };
    C.strikes++; if (C.no >= 4) { C.over = true; C.why = 'pest'; }
    return { ok: false, who: C.no >= 4 ? 'friend' : 'her', delta: 0, bouncer: C.no >= 4, line: C.no >= 4 ? "Right, I'm getting the bouncer." : REFUSALS.firm[Math.min(1, C.no - 3)] };
  }
  if (env.drunk > 0.7) return { ok: false, who: 'her', delta: bump(P, C, -4), line: "You're hammered. Go and get some water." };
  if (env.friendTalking) return { ok: false, who: 'her', delta: bump(P, C, -5), line: 'Um — we were sort of mid-conversation?' };
  let d = 0, line;
  if (!C.met) { C.met = true; if (C.glances > 0) { d = bump(P, C, 3); line = "Oh — hi! You're the one who keeps looking over."; } else line = 'Er — hi?'; }
  else line = C.spark >= SPARK.dancing ? 'There you are!' : C.spark >= SPARK.chatty ? 'Oh, hello again.' : 'Hi.';
  if (env.running) { d += bump(P, C, -2); line = "Whoa — where's the fire?"; }
  C.convo++; C.inConvo = 0;
  return { ok: true, who: 'her', delta: d, line };
}

// What they shout over the music, the mood it is said in, and what you can shout back. Each answer has a kind
// (funny / sincere / nerdy, or an action). {college} is filled in by the caller. Nothing here states a fact about the
// player beyond their college.
export const PROMPTS = [
  { id: 'college', mood: 'playful', she: 'WHAT COLLEGE ARE YOU AT?', opts: [['funny', 'The one with the ducks. They all have ducks.'], ['sincere', '{college}! What about you?'], ['nerdy', '{college}. The library shuts at ten, tragically.']] },
  { id: 'moves', mood: 'playful', she: 'Is that your ACTUAL dancing?', opts: [['funny', "It's interpretive. You wouldn't understand."], ['sincere', "I'm trying my best here!"], ['nerdy', "It's a random walk. With drift."]] },
  { id: 'fresher', mood: 'playful', she: 'My friend thinks you look lost.', opts: [['funny', 'Lost? I live here now. By the jukebox.'], ['sincere', 'I was looking for you, actually.'], ['nerdy', 'Three rooms, one corridor. Hard to be lost.']] },
  { id: 'essay', mood: 'earnest', she: "I've got an essay crisis and I came out anyway.", opts: [['funny', 'Bold. Reckless. I respect it.'], ['sincere', "What's it on? You'll smash it."], ['nerdy', "That's optimal stopping. You stopped."]] },
  { id: 'loud', mood: 'earnest', she: "It's SO loud in here.", opts: [['funny', 'WHAT?'], ['sincere', 'I KNOW. I like talking to you, though.'], ['nerdy', "About a hundred decibels. You'll adapt."]] },
  { id: 'nearly', mood: 'earnest', she: "Honestly? I nearly didn't come out tonight.", opts: [['funny', 'And miss this floor? It grips.'], ['sincere', "I'm really glad you did."], ['nerdy', 'The stamp was a sunk cost, to be fair.']] },
  { id: 'teach', mood: 'curious', she: 'Go on then — tell me something I don\'t know.', opts: [['funny', 'The bar shuts at half two. That is all I know.'], ['sincere', "I'd rather hear about you."], ['nerdy', 'There are more ways to shuffle a deck than atoms on Earth.']] },
  { id: 'turtle', mood: 'curious', she: 'Why is it even called the Purple Turtle?', opts: [['funny', 'A turtle paid for it. Very wealthy turtle.'], ['sincere', 'No idea. I like it down here though.'], ['nerdy', 'Nobody knows. I have looked into it.']] },
  { id: 'bored', mood: 'bored', she: 'Mm. Yeah.', opts: [['dance', 'Fancy a dance?'], ['leave', "I'll let you get back to your friends."], ['funny', 'ANYWAY. As I was saying —']] },
  { id: 'thirsty', mood: 'thirsty', she: 'I need a drink.', opts: [['ask', "I'm going to the bar — what are you having?"], ['leave', 'Same. See you in a bit!'], ['funny', "Water's free, you know."]] },
];
const BEST = { playful: 'funny', earnest: 'sincere', curious: 'nerdy' }, WRONG = { playful: 'nerdy', earnest: 'funny', curious: 'funny' };
export const REPLIES = {
  funny: ['HA! OK, that was good.', "Stop it, I'm crying."], sincere: ["Aw. That's actually really nice.", 'OK, that was sweet.'], nerdy: ['Wait — is that TRUE?', "That's so nerdy. I love it."],
  ok: ['Ha. Right.', 'Yeah, fair.'], bad: ['…OK.', 'Wow. OK.', 'Right.'], fluff: ['Sorry — WHAT?', "I didn't catch any of that."],
};
/** which prompt comes next in this conversation (deterministic for a persona and how the night has gone) */
export function nextPrompt(P, C) {
  const pick = (m) => { const L = PROMPTS.filter((q) => q.mood === m); return L[Math.floor(hash('ptq', P.seed, C.talks, m) * L.length)]; };
  if (C.inConvo >= P.patience) return pick('bored');                       // they have talked enough: do something
  if (C.spark < SPARK.noticed && C.talks > 1) return pick('bored');
  if (!C.drinks && !C.asked && C.talks >= 1 && hash('ptth', P.seed, C.talks) < 0.6) return pick('thirsty');
  const x = hash('ptm', P.seed, C.talks, C.convo);
  return pick(C.talks === 0 ? 'playful' : x < 0.36 ? 'playful' : x < 0.72 ? 'earnest' : 'curious');
}
/**
 * You shout something back. kind = the chosen option's kind, or null (you said nothing). env: {drunk}
 * -> {delta, reply, end (the conversation is over), dance (they will dance), tell (they told you their drink), fluffed}
 */
export function onTalk(P, C, prompt, kind, env = {}) {
  const drunk = env.drunk || 0, r = { delta: 0, reply: '', end: false, dance: false, tell: null, fluffed: false };
  const say = (k) => REPLIES[k][Math.floor(hash('ptr', P.seed, C.talks, k) * REPLIES[k].length)];
  C.talks++; C.inConvo++; C.idle = 0;
  if (kind === null) { r.delta = bump(P, C, -2); r.reply = '…Anyway.'; r.end = C.inConvo >= 2; return r; }
  if (kind === 'leave') { r.delta = bump(P, C, prompt.mood === 'bored' ? 3 : 0); r.reply = prompt.mood === 'bored' ? 'Ha — see you on the dance floor, maybe.' : 'See you in a bit!'; r.end = true; return r; }
  if (kind === 'dance') {
    r.end = true;
    if (C.spark >= SPARK.chatty) { r.delta = bump(P, C, C.askedDance ? 0 : 4); C.askedDance = true; r.dance = true; r.reply = 'Go on then. I love this one!'; } else { r.delta = bump(P, C, -1); r.reply = "Maybe later — I've only just met you!"; }
    return r;
  }
  if (kind === 'ask') { C.asked++; C.toldDrink = true; r.tell = P.drink; r.delta = bump(P, C, 3); r.reply = `Ooh — ${DRINKS[P.drink].name}, please!`; r.end = true; return r; }
  if (prompt.mood === 'bored') { r.delta = bump(P, C, -5); r.reply = say('bad'); r.end = true; return r; }
  if (prompt.mood === 'thirsty') { const ok = P.taste === 'funny'; r.delta = bump(P, C, ok ? 3 : -3); r.reply = ok ? say('funny') : say('bad'); return r; }
  // sober nerves: now and then the line comes out wrong (a drink or two cures it; several bring it back)
  const conf = confidence(drunk);
  if (drunk > 0.7) { r.delta = bump(P, C, -4); r.reply = "I can't understand a word you're saying."; r.end = true; return r; }
  if (hash('ptfl', P.seed, C.talks, C.fluffs) > 0.56 + 0.44 * conf) { C.fluffs++; r.fluffed = true; r.delta = bump(P, C, P.taste === 'funny' && C.fluffs === 1 ? 2 : 0); r.reply = say('fluff'); return r; }
  const best = BEST[prompt.mood], wrong = WRONG[prompt.mood];
  let s = (kind === best ? 5 : 0) + (kind === P.taste ? 4 : 0) - (kind === wrong && kind !== P.taste ? 5 : 0);
  if (s >= 5) C.goodTalks++;
  let g = s >= 9 ? 10 : s >= 5 ? 7 : s > 0 ? 3 : s === 0 ? 1 : -5;
  if (g > 0 && C.talkGain >= 26) g *= 0.2;                                 // talk only gets you so far
  r.delta = bump(P, C, g); if (r.delta > 0) C.talkGain += r.delta;
  r.reply = s >= 5 ? say(kind) : s >= 0 ? say('ok') : say('bad');
  return r;
}

/** you hand them a drink (kind = a DRINKS key). env: {herTipsy} -> {delta, line, take} */
export function onDrink(P, C, kind, env = {}) {
  const d = DRINKS[kind], tip = env.herTipsy || 0, soft = !d || d.drunk <= 0;
  if (P.mood === 'no') return { delta: 0, take: false, line: "No, thank you. I'm fine." };
  if (C.drinks >= 2 && !soft) return { delta: bump(P, C, -6), take: false, line: 'Are you trying to get me drunk? No thanks.' };
  if (tip > 0.45 && !soft) return { delta: bump(P, C, -2), take: false, line: "I shouldn't — I've had plenty. Thanks though." };
  C.drinks++;
  if (soft) return { delta: bump(P, C, tip > 0.3 ? 8 : 2), take: true, line: tip > 0.3 ? 'Water! You absolute hero.' : 'Water. Sensible. Thanks.' };
  if (kind === P.drink) {
    const first = !C.rightDrink; C.rightDrink = true; C.warm = true;
    return { delta: bump(P, C, first ? (C.toldDrink ? 11 : 14) : 3), take: true, line: C.toldDrink ? 'You remembered! Thank you.' : `${DRINKS[kind].name[0].toUpperCase() + DRINKS[kind].name.slice(1)}?! How did you KNOW?` };
  }
  return { delta: bump(P, C, C.toldDrink ? -3 : 4), take: true, line: C.toldDrink ? `Oh. I said ${DRINKS[P.drink].name}… but thanks.` : 'Oh — thanks! Not my usual, but go on.' };
}

// ------------------------------------------------------------------------------------------------ dancing
export const MOVES = ['left', 'right', 'up', 'down'];
const PATTERNS = [['left', 'left', 'right', 'right'], ['left', 'right', 'left', 'right'], ['left', 'right', 'up', 'up'], ['up', 'down', 'up', 'down'], ['right', 'right', 'left', 'up'], ['left', 'up', 'right', 'down']];
/** the move they make on beat b (they keep a four-beat pattern for a 16-beat phrase, then change it) — seen from THEIR
 *  side: 'left' is their left. Facing them, you mirror it: their left is your right. */
export function partnerMove(P, b) { const ph = Math.floor(b / 16), pat = PATTERNS[Math.floor(hash('ptpat', P.seed, P.night, ph) * PATTERNS.length)]; return pat[((b % 4) + 4) % 4]; }
export const MIRROR = { left: 'right', right: 'left', up: 'up', down: 'down' };
export const BEAT_WIN = { perfect: 0.07, good: 0.14 };
/** a tap `off` seconds from the nearest beat, after a few drinks (jit = −1..1 noise) -> 'perfect' | 'good' | 'off' */
export function judgeTap(off, drunk = 0, jit = 0) {
  const c = coordination(drunk), o = Math.abs(off + jit * 0.11 * (1 - c));
  return o <= BEAT_WIN.perfect * (0.6 + 0.4 * c) ? 'perfect' : o <= BEAT_WIN.good * (0.7 + 0.3 * c) ? 'good' : 'off';
}
/**
 * One beat of dancing with (or near) them. q = 'perfect' | 'good' | 'off' | null (no tap this beat); match = you made
 * their move (mirrored); dist = metres apart; together = they are dancing WITH you (else you are only in their eyeline).
 * -> spark change
 */
export function onBeat(P, C, q, match, dist, together) {
  if (P.mood === 'no' || C.over) return 0;
  if (!together) {                                                       // showing off across the floor: a little, and not for long
    if (C.danceGain >= 8 || !q || q === 'off') return 0;
    const g = bump(P, C, (q === 'perfect' ? 0.5 : 0.3) * P.dance); C.danceGain += g; return g;
  }
  C.beats++;
  if (dist < 0.5) { C.crowdBeats = (C.crowdBeats || 0) + 1; return bump(P, C, -0.8); }
  if (dist > 3.2) return bump(P, C, -0.3);
  const near = dist <= P.near + 0.7 ? 1 : 0.6;
  let d;
  if (!q) d = -0.3; else if (q === 'off') d = -0.5;
  else { d = match ? (q === 'perfect' ? 1.0 : 0.7) : q === 'perfect' ? 0.35 : 0.2; if (match) { C.goodBeats++; if (C.goodBeats >= 16) C.warm = true; } }
  if (d > 0) { d *= P.dance * near; if (C.danceGain >= 28) d *= 0.12; }
  const g = bump(P, C, d); if (g > 0) C.danceGain += g; return g;
}
/** standing in their space when not dancing, following them when they have been led away, and so on */
export function onCrowd(P, C, kind = 'close') {
  C.strikes++;
  const d = bump(P, C, kind === 'follow' ? -8 : -4);
  if (C.strikes >= 5 && C.spark < SPARK.chatty) { C.over = true; C.why = 'crowding'; }
  return d;
}
/** left alone for a while they cool a little — never below most of what you had earned */
export function onIdle(P, C, dt) { C.idle += dt; C.peak = Math.max(C.peak || 0, C.spark); if (C.idle > 40 && C.spark > C.peak * 0.75) bump(P, C, -0.12 * dt); }
/** are they ready to suggest leaving together? env: {drunk (you), herTipsy, closing} */
export function readyToLeave(P, C, env = {}) {
  if (C.over || P.mood === 'no' || (P.mood === 'lukewarm' && !C.warm)) return false;
  if ((env.drunk || 0) > 0.6 || (env.herTipsy || 0) > 0.5) return false;       // never when either of you has had too many
  if (C.goodTalks < 2 || C.goodBeats < 12) return false;
  return C.spark >= (env.closing ? SPARK.close + 4 : SPARK.home);
}
/** how they carry themselves towards you, for the body language: 'cold' | 'polite' | 'warm' | 'keen' */
export function bearing(P, C) { return C.over || P.mood === 'no' ? 'cold' : C.spark >= SPARK.close ? 'keen' : C.spark >= SPARK.chatty ? 'warm' : C.spark >= SPARK.noticed ? 'polite' : 'cold'; }

// ------------------------------------------------------------------------------------------------ the bar
/** the bartender looks along the bar: which third they are looking at (0 west, 1 middle, 2 east), or −1 while pouring */
export function barLook(T, night) { const k = Math.floor(T / 1400), x = hash('ptbar', night, k); return x < 0.3 ? -1 : Math.floor(((x - 0.3) / 0.7) * 3); }
/** attention needed before you are served: a quiet bar serves you at once, a rammed one makes you work for it */
export function barNeed(density) { return 0.6 + 3.4 * clamp(density, 0, 1); }
/** dt of standing at the bar. env: {atBar, facing (you are looking at them), looked (they are looking at your third), money (a note held up)} */
export function barAttention(a, dt, env) {
  if (!env.atBar) return Math.max(0, a - dt * 0.8);
  return a + dt * (env.looked && env.facing ? 1.6 : env.facing ? 0.3 : 0.05);
}
/** carrying a drink through people: chance per second of slopping it. speed m/s, crowd = people within arm's reach */
export function spillRate(speed, crowd, drunk = 0) { return Math.max(0, speed - 1.9) * (0.25 + 0.5 * crowd) * (1 + 1.5 * drunk); }

// ------------------------------------------------------------------------------------------------ a scrap
// Comic and bloodless: two people shoving each other about until the bouncers arrive. There is no health, only balance
// (lose it and you sit down hard, get up and carry on). Times in seconds. The opponent telegraphs every swing.
export const SCRAP = { reach: 1.4, windup: 0.5, active: 0.15, myWindup: 0.16, myRecover: 0.42 };
export class Scrap {
  /** aggressor: 'him' (he swings first) | 'me' (you squared up) */
  constructor(seed, { aggressor = 'him', skill = 0.5 } = {}) {
    this.r = rng('scrap|' + seed); this.skill = skill; this.aggressor = aggressor;
    this.me = { bal: 1, s: 'idle', t: 0, downs: 0 }; this.opp = { bal: 1, s: 'circle', t: aggressor === 'him' ? 0.7 : 1.3, downs: 0 };
    this.t = 0; this.swung = false; this.heSwung = false; this.far = 0; this.over = null; this.bouncersAt = 11 + this.r() * 4; this.clinch = null;
  }
  /** inp: {swing (pressed), block (held), grapple (pressed), dist, facing (you face him), side (your sideways speed m/s)} -> events */
  step(dt, inp) {
    const ev = [], me = this.me, opp = this.opp, S = SCRAP;
    if (this.over) return ev;
    this.t += dt;
    // walking away ends it: nobody chases anybody round a club for long
    this.far = inp.dist > 4.5 ? this.far + dt : 0;
    if (this.far > 3.5) { this.over = 'fizzle'; ev.push('fizzle'); return ev; }
    if (this.t >= this.bouncersAt || me.downs + opp.downs >= 3) { this.over = 'bouncers'; ev.push('bouncers'); return ev; }
    const down = (who, tag) => { who.bal = 0; who.s = 'down'; who.t = 2.1; who.downs++; ev.push(tag); };
    // ---- a clinch: both grab hold and heave; whoever heaves harder shoves the other off
    if (this.clinch) {
      const c = this.clinch; c.t -= dt; if (inp.grapple) c.mine++; c.his += dt * (3 + 3 * this.skill) * (0.6 + 0.8 * this.r());
      if (c.t <= 0) {
        this.clinch = null;
        if (c.mine > c.his) { opp.bal -= 0.34; ev.push('shoveHim'); if (opp.bal <= 0) down(opp, 'oppDown'); else { opp.s = 'stagger'; opp.t = 0.9; } me.s = 'idle'; }
        else { me.bal -= 0.3; ev.push('shoveMe'); if (me.bal <= 0) down(me, 'meDown'); else { me.s = 'stagger'; me.t = 0.6; } opp.s = 'recover'; opp.t = 0.7; }
      }
      return ev;
    }
    // ---- you
    me.t -= dt;
    if (me.s === 'down' && me.t <= 0) { me.s = 'idle'; me.bal = 0.6; ev.push('meUp'); }
    else if (me.s === 'stagger' && me.t <= 0) me.s = 'idle';
    else if (me.s === 'recover' && me.t <= 0) me.s = 'idle';
    else if (me.s === 'windup' && me.t <= 0) {
      me.s = 'recover'; me.t = S.myRecover;
      if (inp.dist < S.reach && inp.facing && opp.s !== 'down') {
        // a swing only really lands when he is off balance (he has just missed, or been blocked); squared up he blocks
        // most of them, and one thrown while he is winding up does not stop what is coming
        const open = opp.s === 'recover' || opp.s === 'stagger';
        if (!open && this.r() < 0.4 + 0.4 * this.skill) { ev.push('heBlocks'); me.t += 0.35; }
        else if (open) { opp.bal -= 0.36; ev.push('hitHim'); if (opp.bal <= 0) down(opp, 'oppDown'); else { opp.s = 'stagger'; opp.t = 0.7; } }
        else { opp.bal -= 0.14; ev.push('glance'); if (opp.bal <= 0) down(opp, 'oppDown'); }
      } else ev.push('miss');
    }
    if (me.s === 'idle') {
      if (inp.grapple && inp.dist < 1.0 && opp.s !== 'down' && opp.s !== 'swing') { this.swung = true; this.clinch = { t: 1.8, mine: 0, his: 0 }; me.s = 'clinch'; opp.s = 'clinch'; ev.push('clinch'); return ev; }
      if (inp.swing) { me.s = 'windup'; me.t = S.myWindup; this.swung = true; ev.push('swing'); }
    }
    me.block = me.s === 'idle' && !!inp.block;
    me.bal = Math.min(1, me.bal + dt * 0.03);
    // ---- him
    opp.t -= dt;
    if (opp.s === 'down') { if (opp.t <= 0) { opp.s = 'circle'; opp.t = 0.8; opp.bal = 0.6; ev.push('oppUp'); } }
    else if (opp.s === 'circle') { if (opp.t <= 0) { if (inp.dist < S.reach + 0.3 && me.s !== 'down') { opp.s = 'windup'; opp.t = S.windup; ev.push('windup'); } else opp.t = 0.25; } }
    else if (opp.s === 'windup') { if (opp.t <= 0) { opp.s = 'swing'; opp.t = S.active; this.heSwung = true; ev.push('heSwings'); } }
    else if (opp.s === 'swing') {
      if (opp.t <= 0) {
        const dodged = inp.dist > S.reach + 0.05 || Math.abs(inp.side || 0) > 1.5;
        if (me.s === 'down') { opp.s = 'recover'; opp.t = 0.5; }
        else if (me.block) { ev.push('blocked'); opp.s = 'recover'; opp.t = 0.95; }
        else if (dodged) { ev.push('whiff'); opp.s = 'stagger'; opp.t = 0.85; opp.bal -= 0.08; }
        else { me.bal -= 0.28; ev.push('hitMe'); opp.s = 'recover'; opp.t = 0.55; if (me.bal <= 0) down(me, 'meDown'); else { me.s = 'stagger'; me.t = 0.45; } }
      }
    } else if ((opp.s === 'recover' || opp.s === 'stagger') && opp.t <= 0) { opp.s = 'circle'; opp.t = 0.5 + this.r() * 1.1 * (1.3 - this.skill); }
    opp.bal = Math.min(1, opp.bal + dt * 0.03);
    return ev;
  }
  /** who the bouncers throw out */
  get out() { return { me: this.over === 'bouncers' && this.swung, him: this.over === 'bouncers' && (this.heSwung || this.aggressor === 'him') }; }
}
/** what the person you were getting on with makes of it. -> {delta, line, impressed} */
export function onScrap(P, C, scrap) {
  if (scrap.over === 'fizzle' || !scrap.swung) { const d = bump(P, C, 10); return { delta: d, impressed: true, line: scrap.over === 'fizzle' ? 'You just walked away. Good.' : "You didn't even swing back. Classy." }; }
  if (P.scrappy) { const d = bump(P, C, 6); return { delta: d, impressed: true, line: 'That was SO stupid. …I sort of loved it.' }; }
  const d = bump(P, C, -40); if (C.spark < SPARK.chatty) { C.over = true; C.why = 'scrap'; }
  return { delta: d, impressed: false, line: "Fighting? Really? I'm going back to my friends." };
}
/** someone cuts in on the floor: over 16 beats, whoever keeps better time with them keeps the dance */
export function onCutIn(P, C, won) { return bump(P, C, won ? 6 : -8); }
export function rivalFor(night, sex) {
  const names = sex === 'f' ? NAMES_F : NAMES_M, taken = new Set(personasFor(night, sex).flatMap((p) => [p.name, p.friendName])), r = rng(`pt-rival|${night}|${sex}`);
  let name; do { name = names[Math.floor(r() * names.length)]; } while (taken.has(name));
  return { name, seed: Math.floor(r() * 1e9), skill: 0.45 + r() * 0.25, dance: 0.5 + r() * 0.22, arrive: 0.8 + r() * 0.4 };
}
export const PROVOKE = {
  spill: ['OI! That was a full pint!', "You've soaked me, you muppet!"], barge: ['Watch where you\'re going!', 'Oi — easy!'], rival: ['Mate. She was dancing with ME.', 'Do one, yeah?'],
  sorry: ["Sorry, mate — my fault.", 'Yeah, alright. Watch it.'], pint: ['Let me get you another.', 'Oh. Cheers. Fair play.'], walk: ['Yeah, walk away!', 'Thought so.'],
  grudge: ['Oops. Didn\'t see you there.', 'Shame about your drink.'], leave: ['Forget it. Not worth it.'], owe: ['You owe me a drink, mate.', 'Make me.'],
  cut: ['Alright? Mind if I cut in?'], cutWon: ["Sorry — I'm dancing with someone.", 'Whatever.'], cutLost: ['Back in a sec!', 'Unlucky, pal.'],
  ring: ['Leave it, mate!', 'SO not worth it!', 'BOUNCER!', 'Oh my GOD.', 'Fight! Fight!'],
  bouncer: { both: 'Right. Out. The pair of you.', him: "You — out. And you: good on you for keeping your hands down.", fizzle: 'Keep it friendly, yeah?', warn: "You're bothering people. Once more and you're out.", pest: "That's it. Out. Leave people alone.", barred: "Not tonight. You're barred." },
};

// ------------------------------------------------------------------------------------------------ the walk home
export const WALK = { pace: 1.35, heel: 0.55, lag: 9, lost: 32, sprint: 4.6 };
export function newWalk(spark) { return { mood: clamp(0.45 + (spark - SPARK.home) * 0.012, 0.4, 0.75), lagT: 0, lostT: 0, heelCd: 0, sprintT: 0, sprintCd: 0, aheadCd: 0, heels: 0, calls: 0, over: null, linked: false, chats: 0 }; }
/**
 * dt of walking. q: {d (metres from them), behind (metres directly behind them, >0), lateral (metres off to their side),
 * ahead (metres ahead of them along the route), speed (yours), moving (they are walking), vehicle, place ('world' or not), down}
 * -> events: 'heel' | 'sprint' | 'lag' | 'ahead' | 'lost' | 'vehicle' | 'indoors'
 */
export function walkStep(W, dt, q) {
  const ev = [];
  if (W.over) return ev;
  const hurt = (x) => { W.mood = clamp(W.mood - x, 0, 1); };
  W.heelCd -= dt; W.sprintCd -= dt; W.aheadCd -= dt;
  if (q.vehicle) { W.over = 'vehicle'; ev.push('vehicle'); return ev; }
  if (q.place !== 'world') { W.inT = (W.inT || 0) + dt; if (W.inT > 7) { W.over = 'indoors'; ev.push('indoors'); return ev; } } else W.inT = 0;
  if (q.moving && q.behind > 0 && q.behind < WALK.heel && Math.abs(q.lateral) < 0.3 && q.speed > 0.6 && W.heelCd <= 0) { W.heelCd = 5; W.heels++; hurt(0.07 + 0.03 * W.heels); ev.push('heel'); }
  if (q.speed > WALK.sprint && q.d < 14) { W.sprintT += dt; if (W.sprintT > 1.1 && W.sprintCd <= 0) { W.sprintCd = 8; W.sprintT = 0; hurt(0.04); ev.push('sprint'); } } else W.sprintT = Math.max(0, W.sprintT - dt);
  if (q.ahead > 7 && W.aheadCd <= 0) { W.aheadCd = 9; hurt(0.03); ev.push('ahead'); }
  if (q.d > WALK.lag) { W.lagT += dt; if (W.lagT > 3 && !W.called) { W.called = true; W.calls++; hurt(0.03 * W.calls); ev.push('lag'); } } else { W.lagT = 0; W.called = false; }
  if (q.d > WALK.lost) { W.lostT += dt; if (W.lostT > 9) { W.over = 'lost'; ev.push('lost'); } } else W.lostT = Math.max(0, W.lostT - dt * 2);
  // walking nicely beside them is its own quiet reward
  if (q.moving && q.d < 2.2 && !(q.behind > 0 && q.behind < 0.9 && Math.abs(q.lateral) < 0.3)) W.mood = clamp(W.mood + dt * 0.002 * (W.linked ? 2 : 1), 0, 1);
  return ev;
}
/** what they say on the way (kind: taste the answer suits). Filled with {college} by the caller. */
export const WALK_CHAT = [
  { she: "So what's the plan for tomorrow? Bed till noon?", opts: [['funny', 'Noon is ambitious.'], ['sincere', 'Honestly? Hoping to see you.'], ['nerdy', 'Library by ten. I say, every night.']] },
  { she: 'I love Oxford at this time. Nobody about.', opts: [['funny', 'Just us and the kebab vans.'], ['sincere', "It's better with company."], ['nerdy', 'Same streets since the twelve hundreds. Mad.']] },
  { she: 'Be honest. How bad was my dancing?', opts: [['funny', 'I feared for the mirror ball.'], ['sincere', 'I thought you were brilliant.'], ['nerdy', 'On the beat ninety per cent. I counted.']] },
];
export function onWalkChat(P, W, kind) {
  W.chats++;
  if (kind === null) { W.mood = clamp(W.mood - 0.02, 0, 1); return { good: false, reply: 'Hello? Earth to you?' }; }
  const good = kind === P.taste || kind === 'sincere';
  W.mood = clamp(W.mood + (kind === P.taste ? 0.07 : good ? 0.04 : 0.0), 0, 1);
  return { good, reply: kind === P.taste ? REPLIES[kind][W.chats % 2] : good ? 'Smooth. Very smooth.' : 'Ha. Idiot.' };
}
/** the doorstep: 'kiss' (a kiss on the cheek) | 'warm' (a smile and a wave) | 'flat' */
export function doorstep(W) { return W.over ? 'none' : W.mood >= 0.72 ? 'kiss' : W.mood >= 0.45 ? 'warm' : 'flat'; }
export const LOVE_MS = 9 * HOUR_MS, MARK_MS = 14 * HOUR_MS;      // the glow lasts nine game hours; the lipstick till about next lunchtime
