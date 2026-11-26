// Children of the town (2026-11-21, "make sure there are children and pets too"): who they are, what they wear, when and
// where they may be, what they say. Pure data and rules — no three.js, no DOM — so tools/smoke_children.mjs can check the
// rules without a world. The walking is systems/pedestrians.js (they are followers of an adult, like any group); the
// things they have with them (pushchair, scooter, kite, ball) are drawn by systems/_ped_child_kit.js; what keeps them
// safe from vehicles and players is systems/_ped_protect.js.
//
// THE RULES (hard; every one is asserted by tools/smoke_children.mjs over several simulated days):
//  * ordinary daytime townsfolk in ordinary everyday clothes: families, school parties, pupils on their way to and from
//    school. Kept entirely apart from the night life: nothing here ever puts a child in or near the club, its queue, the
//    Cellar Bar or a pub, and no child is out after early evening (childHours).
//  * toddlers, children and pupils are always WITH an adult (needsAdult): they exist only as followers of a parent or a
//    teacher and are removed with them; teenagers walk in twos and threes by themselves, in school uniform, at the times
//    school starts and ends on school days.
//  * never knocked over, never carried, never in a vehicle or the water, never in a fight, never part of the flirting /
//    clubbing play: game.pedestrians.isChild(ped) is true for every one of them (and for nothing else), for any code
//    that picks people to exclude them; pedestrians.knock / control refuse them outright.
import { randomLook } from '../core/characters.js';
import { DAY_MS } from '../core/time.js';

/** `?kids=0` in the page (GTO_KIDS=0 in node tools): no families, school parties, pupils or park / college scenes
 *  (systems/_ped_scenes.js) — the town as it was before 2026-11-21, for before / after measurements. Dogs keep their
 *  new breeds either way. */
export function kidsOn() {
  try { if (typeof process !== 'undefined' && process.env && process.env.GTO_KIDS !== undefined) return !/^(0|false|off|no)$/i.test(process.env.GTO_KIDS); } catch { /* */ }
  try { const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || ''); if (q.has('kids')) return !/^(0|false|off|no)$/i.test(q.get('kids') || ''); } catch { /* */ }
  return true;
}
/** roles that are children (pedestrians.js ROLES has an entry for each) */
export const CHILD_ROLES = { toddler: true, child: true, pupil: true, teen: true };
/** roles that look after children (the leader of a family / a school party) */
export const GUARD_ROLES = { parent: true, teacher: true };
export const isChildRole = (role) => CHILD_ROLES[role] === true;
/** must have an adult within reach at all times (everyone but the teenagers) */
export const needsAdult = (role) => role === 'toddler' || role === 'child' || role === 'pupil';
/** how far (m) a child that needsAdult may ever be from its adult (the follow slots are within 2.5 m; this is the limit
 *  the test asserts, with room for a crossing taken in single file) */
export const ADULT_RANGE = 9;

// ------------------------------------------------------------------------------------------------ when
/** families and school parties are made between these hours… */
export const CHILD_FROM = 8, CHILD_TO = 18.25;
/** …and none is left out after CHILD_LAST (early evening) or before CHILD_FIRST: whoever is still about is taken home
 *  (removed) whether or not anyone is looking */
export const CHILD_FIRST = 7.75, CHILD_LAST = 19;
export const mayAppear = (h) => h >= CHILD_FROM && h < CHILD_TO;
export const mayBeOut = (h) => h >= CHILD_FIRST && h < CHILD_LAST;
/** five game days in seven are school days (the length of a game day: core/time.js) */
export function schoolDay(nowMs) { const d = Math.floor((nowMs || 0) / DAY_MS) % 7; return ((d % 7) + 7) % 7 < 5; }
/** pupils walking to school (about 08:30) and home (about 15:30) */
export function schoolRun(h, nowMs) { return schoolDay(nowMs) && ((h >= 8 && h < 9.1) || (h >= 15.2 && h < 16.4)); }
/** school parties are out between the morning and afternoon bells */
export function schoolTrip(h, nowMs) { return schoolDay(nowMs) && h >= 9.5 && h < 15; }
/** teenagers in uniform are about only around the school run (a little either side of it) */
export const teenMayBeOut = (h, nowMs) => schoolDay(nowMs) && ((h >= 7.75 && h < 9.4) || (h >= 15 && h < 16.9));

// ------------------------------------------------------------------------------------------------ where
/** never here, at any hour: [x, z, radius]. Frewin Court (the alley of the Purple Turtle and its queue, off Cornmarket)
 *  — by day nothing is there but an alley and a door; the circles make the
 *  rule one of place as well as of time. (The Cellar Bar is inside Worcester College, where no street walker goes. Pubs: nobody here goes in at any door — pedestrians.js keeps families, school
 *  parties and pupils out of every doorway — and none is out in the evening.) */
export const NO_GO = [[84, 230, 15], [100, 223, 7]];      // (the alley from St Peter's side to within a few metres of Cornmarket's west pavement, which stays open to everyone)
export function noGo(x, z, margin = 0) {
  for (let i = 0; i < NO_GO.length; i++) { const c = NO_GO[i], dx = x - c[0], dz = z - c[1], r = c[2] + margin; if (dx * dx + dz * dz < r * r) return true; }
  return false;
}

// ------------------------------------------------------------------------------------------------ what they look like
const BRIGHT = [0xd23a3a, 0x2f6fd0, 0x2f9a5a, 0xe2b93a, 0xe07a2a, 0x8a4ab8, 0x2aa7a7, 0xe26a9a, 0x4a4a9a, 0x8ab83a, 0xd0d0d8, 0x35507a];
const SOFT = [0x6a86b8, 0x7a9a6a, 0xb86a6a, 0xb8a06a, 0x8a7ab0, 0x5a8a8a, 0xc8c8cc, 0x4a5a78, 0xa85a7a];
const DENIM = [0x2f456c, 0x3d5a80, 0x26334d, 0x4a4a52, 0x5a4a3a, 0x33383f];
const CHILD_HAIR = ['short', 'short', 'bob', 'ponytail', 'curly', 'long', 'fringe', 'bun', 'afro', 'buzz'];
/** the colours of the school a party or a group of pupils belongs to (one per group, by its seed) */
export const SCHOOLS = [
  { jumper: 0xa01d2a, tie: 0xa01d2a, blazer: 0x1a1d2a }, { jumper: 0x1f3f8a, tie: 0x1f3f8a, blazer: 0x16203a },
  { jumper: 0x1f5a3a, tie: 0x1f5a3a, blazer: 0x14261c }, { jumper: 0x5a1d4a, tie: 0xc8a030, blazer: 0x1a1a1c },
  { jumper: 0x1a2a4a, tie: 0xc02a2a, blazer: 0x1a2a4a },
];
const rndOf = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const of = (a, r) => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
const r2 = (x) => Math.round(x * 100) / 100;

/**
 * The look of a child of the given role, from its seed alone (so multiplayer sends only the seed: pedestrians.js lookOf).
 * `school` (0..SCHOOLS.length-1): the school of a party / a group of pupils — the caller derives it from the leader's
 * seed, so a whole party wears one school's colours.
 * Heights (m), from the UK growth charts (50th centile, both sexes within a few cm at these ages): 2 y 0.87, 3 y 0.96,
 * 5 y 1.10, 7 y 1.22, 9 y 1.33, 11 y 1.44, 13 y 1.56, 15 y 1.67. look.child makes core/characters.js give them a
 * child's proportions (a head large for the body, narrow shoulders) instead of a scaled-down adult.
 */
export function childLook(role, seed, school = 0) {
  const r = rndOf((seed >>> 0) ^ 0x51ed270b), L = randomLook(seed, { outfit: 'casual' });
  // (from the adult look: skin, hair colour - never grey - and nothing else)
  const K = { outfit: 'casual', seed: seed >>> 0, child: true, skin: L.skin, hair: [0x8a8a86, 0xb8b8b0, 0xd8d8d0, 0xeeeeea].includes(L.hair) ? 0x5a3a1c : L.hair };
  const girl = r() < 0.5;
  K.figure = 'm';                                   // (a child's build: no adult body shape either way)
  K.hairStyle = girl ? of(['bob', 'ponytail', 'long', 'bun', 'curly', 'ponytail', 'bob'], r) : of(['short', 'short', 'buzz', 'curly', 'short', 'afro'], r);
  if (!CHILD_HAIR.includes(K.hairStyle)) K.hairStyle = 'short';
  K.shoeStyle = 'trainer'; K.shoes = of([0xeeeeee, 0x2a2a2a, 0xd23a3a, 0x2f6fd0, 0xe26a9a, 0x3a3a3a], r);
  const S = SCHOOLS[((school | 0) % SCHOOLS.length + SCHOOLS.length) % SCHOOLS.length];
  if (role === 'toddler') {
    K.height = r2(0.86 + r() * 0.12); K.build = r2(0.6 + r() * 0.06);
    K.topStyle = r() < 0.5 ? 'jumper' : 'tee'; K.top = of(BRIGHT, r); K.sleeves = 'long';
    K.bottom = of(DENIM.concat(BRIGHT.slice(0, 4)), r); K.legs = 'trousers';
    if (r() < 0.35) { K.hat = r() < 0.5 ? 'beanie' : 'sunhat'; K.hatColor = of(BRIGHT, r); }
    if (girl && r() < 0.3) K.hairStyle = 'bob';
  } else if (role === 'child') {
    K.height = r2(1.08 + r() * 0.3); K.build = r2(0.64 + (K.height - 1.08) * 0.35 + r() * 0.05);
    const t = r();
    K.topStyle = t < 0.4 ? 'tee' : t < 0.7 ? 'jumper' : 'hoodie'; K.top = of(BRIGHT, r);
    if (r() < 0.25) { K.jacket = of(SOFT.concat(BRIGHT), r); K.jacketLen = 'hip'; }
    if (girl && r() < 0.35) { K.skirt = 'knee'; K.skirtColor = of(SOFT.concat(DENIM), r); K.tights = of([0x2a2a33, 0xd8d8dc, 0x5a3a5a, 0x35507a], r); }
    else { K.bottom = of(DENIM, r); K.legs = r() < 0.3 ? 'shorts' : 'trousers'; }
    if (r() < 0.3) K.backpack = of(BRIGHT, r);
    if (r() < 0.15) { K.hat = 'cap'; K.hatColor = of(BRIGHT, r); }
  } else if (role === 'pupil') {
    // a primary school party: polo shirt and the school jumper, grey below, black shoes, a hi-vis tabard for the outing
    K.height = r2(1.14 + r() * 0.22); K.build = r2(0.66 + (K.height - 1.14) * 0.35 + r() * 0.05);
    K.topStyle = 'jumper'; K.top = S.jumper; K.shirt = 0xf2f2ee; K.collar = 0xf2f2ee;
    if (girl && r() < 0.5) { K.skirt = 'knee'; K.skirtColor = 0x5a5d66; K.tights = r() < 0.6 ? 0x3a3d46 : 0xe8e8ec; } else { K.bottom = 0x5a5d66; K.legs = r() < 0.25 ? 'shorts' : 'trousers'; }
    K.shoeStyle = 'shoe'; K.shoes = 0x141414; K.hivis = 0xd8f030;
  } else {
    // a secondary school pupil: blazer, white shirt, the school tie, dark trousers or a skirt and tights, a bag
    K.height = r2(1.5 + r() * 0.2); K.build = r2(0.8 + (K.height - 1.5) * 0.4 + r() * 0.08);
    K.topStyle = 'shirt'; K.top = 0xf2f2ee; K.shirt = 0xf2f2ee; K.jacket = S.blazer; K.jacketLen = 'hip'; K.neck = 'tie'; K.neckColor = S.tie;
    if (girl && r() < 0.6) { K.skirt = 'knee'; K.skirtColor = 0x25272e; K.tights = 0x1c1c22; } else { K.bottom = 0x25272e; K.legs = 'trousers'; }
    K.shoeStyle = 'shoe'; K.shoes = 0x141414; K.backpack = of([0x1a1a1a, 0x2f456c, 0x5a1d2a, 0x2a3a2a, 0x4a4a52], r);
    K.figure = girl ? 'f' : 'm';
    if (!girl && r() < 0.4) K.hairStyle = of(['short', 'quiff', 'curly', 'tousled'], r) === 'quiff' ? 'quiff' : K.hairStyle;
    if (r() < 0.12) K.glasses = true;
  }
  return K;
}
/** the adult with them: a parent in ordinary clothes (a coat as often as not, a bag), or a teacher in a hi-vis vest with
 *  the register on a clipboard. Adult looks come from the usual wardrobe (randomLook). */
export function guardLook(role, seed) {
  const r = rndOf((seed >>> 0) ^ 0x2c1b3c6d), L = randomLook(seed, { outfit: 'casual' });
  if (L.hairStyle === 'grey-wild') L.hairStyle = 'short';
  delete L.prop;
  if (role === 'teacher') { L.hivis = 0xd8f030; L.prop = r() < 0.6 ? 'clipboard' : undefined; L.shoeStyle = 'shoe'; if (L.legs === 'shorts') L.legs = 'trousers'; }
  else { if (r() < 0.55) { L.jacket = of([0x3e4230, 0x1c2436, 0x5a4636, 0x7a2a2a, 0x2a3a4a, 0x6a6a72], r); L.jacketLen = 'hip'; } if (r() < 0.3) L.backpack = of([0x1a1a1a, 0x2f456c, 0x5a4636], r); if (r() < 0.25) L.prop = 'bag'; }
  if (L.prop === undefined) delete L.prop;
  return L;
}
/** which school a group led by this seed belongs to */
export const schoolOf = (seed) => ((seed >>> 0) % 9973) % SCHOOLS.length;

// ------------------------------------------------------------------------------------------------ families and parties
/** what a parent has with them, by the leader's seed: [{ role, carried }] — a toddler by the hand or in a pushchair,
 *  one or two children; never nobody. `pram` true: the first toddler rides in a pushchair the parent pushes. */
export function familyOf(seed) {
  const r = rndOf((seed >>> 0) ^ 0x7f4a7c15), t = r();
  if (t < 0.24) return { pram: true, kids: [] };                                   // a baby / toddler in the pushchair
  if (t < 0.4) return { pram: true, kids: ['child'] };
  if (t < 0.62) return { pram: false, kids: ['toddler'] };                           // by the hand
  if (t < 0.84) return { pram: false, kids: ['child'] };
  if (t < 0.94) return { pram: false, kids: ['child', 'child'] };
  return { pram: false, kids: ['toddler', 'child'] };
}
/** a school party: so many pupils in pairs behind the teacher (a second adult brings up the rear) */
export function partyOf(seed) { const r = rndOf((seed >>> 0) ^ 0x1b873593); return { pupils: 6 + 2 * Math.floor(r() * 3), rear: true }; }
/** follow slots (x across, z behind the leader, m): a hand-held child beside the parent; pupils two by two */
export const HAND_SLOT = [0.5, 0.02], SIDE_SLOTS = [[-0.55, 0.35], [0.6, 0.75], [-0.6, 1.1]];
export const pairSlot = (i) => [(i % 2 ? 0.34 : -0.34), 1.1 + Math.floor(i / 2) * 0.95];

// ------------------------------------------------------------------------------------------------ what they say
// (bubbles only for now: there are no children's voices rendered, and a grown-up's voice from a six-year-old would be
// wrong — pedestrians.js sets character.voiceAs = false on every child. tools/voices: see the report of 2026-11-21.)
export const CHILD_LINES = {
  toddler: ['Duck!', 'Doggy!', 'Bus! Big bus!', 'Again! Again!', 'Up! Up!', 'Birdie!', 'Splash!', 'More ducks!'],
  child: ['Can we feed the ducks?', 'Are we nearly there?', 'Look, a dog!', 'Can I have an ice cream?', 'My legs are tired.', 'I saw a squirrel!',
    'Is that where the dinosaurs live?', 'Can we go on a boat?', 'Why is everything so old?', 'I can see a tower!', 'Race you to the bench!', 'Can we go to the park after?'],
  pupil: ['Miss, are we nearly there?', 'Is the dodo real?', 'Can we see the dinosaurs first?', "I've lost my worksheet.", 'Miss, my lace is undone.', 'I can see my house from here! Nearly.',
    'Are the shrunken heads real?', "Miss, he's walking too fast.", 'Can I be at the front?'],
  teen: ['Have you done the French homework?', 'Double maths. Why.', 'Wait up!', 'Got any crisps?', "We've got a test. A TEST.", 'Is it PE today?', "I'm getting the number 5.", 'Did you see the group chat?', "I left my blazer on the bus. Again."],
};
