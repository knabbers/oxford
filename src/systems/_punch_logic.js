// Punching (systems/punch.js): the pure rules — who a swing can reach, whether it lands as a stagger or a knock-down,
// how a person answers it, the heat it earns, the words. No three.js, no DOM: tools/smoke_punch.mjs checks these
// without a world. Comic and bloodless: nobody is hurt, nobody stays down; people stagger, sit down hard, get up and
// carry on (or leave, or have a go back).
//
// THE HARD RULES (asserted by tools/smoke_punch.mjs):
//  * a child (game.pedestrians.isChild) is never hit, pushed or moved by a punch — the swing has no effect at all on
//    one, and a child standing nearest in front stops the punch reaching anybody behind it;
//  * nor is the adult looking after children (isGuardian: a parent, a teacher), nor an animal (game.pedestrians.animals:
//    dogs on leads, dogs off them, cats, the tortoise; wildlife has no body a punch can find);
//  * nobody in a vehicle can be reached (they are not people on foot: nothing here looks at them).

/** metres from the player's centre to the centre of somebody who can be hit (bodies 0.32 + 0.26, an arm beyond) */
export const REACH = 1.25;
/** the cone in front: cos of the half angle (60 degrees either side of the way the player faces) */
export const CONE = 0.5;
/** seconds between punches; the strike lands this long after the button (the arm is straight then: core/characters.js) */
export const COOLDOWN = 0.5, STRIKE_AT = 0.14;
/** a second punch on the same person within this long is a solid one (they go down) */
export const COMBO_S = 4;
/** running at least this fast (m/s) the first punch is solid */
export const RUN_HIT = 4.2;
/** how hard a solid punch pushes (m/s, given to pedestrians.knock: over HOP_V 2.6 = a fall, under TUMBLE_V 7) / a stagger */
export const DOWN_V = 3.6, STAGGER_V = 1.8;
/** heat, as the police's offences (systems/_police_logic.js HEAT): one witnessed punch is a star; an officer, two */
export const HEAT_PUNCH = { punch: 12, punch_police: 40, punch_friend: 8 };

/** nearest of `cands` ({x, z, kind, ...}) within reach and in the cone in front of (px, pz) facing (fx, fz).
 *  Whatever is nearest is what the fist meets — a child, a guardian or an animal included (and then nothing happens). */
export function pickTarget(cands, n, px, pz, fx, fz, reach = REACH, cos = CONE) {
  let best = null, bd = reach;
  for (let i = 0; i < n; i++) {
    const c = cands[i], ex = c.x - px, ez = c.z - pz, d = Math.hypot(ex, ez);
    if (d >= bd || d < 1e-3) continue;
    if ((ex * fx + ez * fz) / d < cos) continue;
    bd = d; best = c;
  }
  if (best) best.d = bd;
  return best;
}
/** kinds a punch may never land on */
export const SAFE = { child: true, guard: true, animal: true };
export const mayHit = (kind) => !!kind && SAFE[kind] !== true;

/** solid (they go down) or a stagger */
export function solidHit(prevHits, sinceLast, runSpeed) {
  if (runSpeed >= RUN_HIT) return true;
  return prevHits >= 1 && sinceLast <= COMBO_S;
}

function hash(a, b) { let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca77)) >>> 0; h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; return (h >>> 0) / 4294967296; }
// share of each role who would have a go back (the rest: some run, some just shout and walk on)
const FIGHT = { builder: 0.45, clubber: 0.4, nightowl: 0.35, rower: 0.35, townie: 0.25, student: 0.15, gown: 0.1, subfusc: 0.1, shopper: 0.1, shopworker: 0.12,
  dogwalker: 0.08, tourist: 0.05, don: 0.05, jogger: 0, porter: 0 };
const FLEE = { tourist: 0.6, don: 0.5, jogger: 0.9, shopper: 0.5, student: 0.45, gown: 0.45, subfusc: 0.45, dogwalker: 0.45, townie: 0.35, shopworker: 0.4,
  builder: 0.2, clubber: 0.25, nightowl: 0.3, rower: 0.25, porter: 0 };
/** how this person answers being hit: 'arrest' (police), 'fight', 'flee' or 'shout'. Fixed by who they are (role + seed),
 *  so the same person answers the same way; `round` = how many times they have been put down already (more makes them
 *  less keen). */
export function temperament(role, seed, round = 0) {
  if (role === 'police') return 'arrest';
  const u = hash(seed | 0, 77 + round * 13), f = (FIGHT[role] ?? 0.15) * (round > 0 ? 0.5 : 1), fl = FLEE[role] ?? 0.4;
  if (u < f) return 'fight';
  if (u < f + (1 - f) * fl) return 'flee';
  return 'shout';
}

// ---- the people's words (anonymous townspeople only; the friends say their own existing lines: places/friends.js)
export const LINES = {
  stagger: ['Oi!', 'Ow! What was THAT for?', 'Did you just...?!', 'Hey!', "That's assault, that is!", 'Ow! My nose! It is fine. Ow.'],
  shout: ["I'm calling the police!", 'Hooligan!', "I'm writing to the Oxford Mail about you!", 'Animal!', 'Unbelievable.', 'Not even sorry, are you?'],
  flee: ['Help! HELP!', 'Nutter! Nutter on the loose!', "I'm off!", 'Somebody call the police!', 'Not today, thank you!'],
  square: ['Right. That is IT.', 'Come on then!', 'You want some?', 'Oh, you have done it now.', 'Put em up!'],
  win: ['And STAY down!', "Let that be a lesson!", 'Had enough?', "Don't start what you can't finish."],
  giveUp: ['Yeah, you run!', 'Not worth it.', 'Coward!', "I'll remember that face!"],
  arrest: ["You're nicked!", 'Stop right there!', 'Assaulting an officer! Right!', "Don't you move!", 'Hands where I can see them!'],
  arrestGive: ["I'll remember that face!", 'We know where you live! Probably.', 'Control, suspect is legging it.'],
  shove: ['Stay where you are!', 'Calm DOWN.', 'Back off!'],
  bystander: ['Oi! Leave it!', 'Somebody call the police!', 'Steady on!', "Leave 'em alone!", 'Woah woah woah!', 'Is that allowed?', 'Not on the High Street!'],
  guard: ['Not in front of the children!', 'Do you mind? There are children here!', 'Shame on you.'],
};
export const pickLine = (set, k) => { const L = LINES[set]; return L[Math.floor(Math.abs(k) * L.length) % L.length]; };
