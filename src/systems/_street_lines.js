// What ordinary passers-by say, and how often (pure data + logic, no three / DOM; node-testable: tools/smoke_speech.mjs).
//
// STREET_LINES: about 200 overheard snippets for the anonymous crowd, c. 2013, on top of each role's few lines in
// systems/pedestrians.js LINES. Each group is tagged with who says it and, where it only fits some of the time, when:
//   who   the walker's line set (pedestrians.js ROLES[..].lines): student (students and gowns), club (clubbers and
//         night owls), tourist, townie (locals), shopper, don, subfusc, rower, jogger, dog, builder
//   when  morning 6-11 | day 9-18 | evening 17-22 | night 22-5        (the game clock)
//   wx    rain | cold (under 6 °C) | fine (dry and 15 °C or more)      (game.weather)
//   zone  coll | shop | tour | green (parks, meadows, the river)       (pedestrians.zone(x, z) flags)
// Tags are lower-case words on purpose: the voice extractor (tools/voices/extract_crowd.mjs) walks this table and takes
// every string that reads as speech, in all six crowd voices, so every line here has a clip per voice and the bubble
// text and the clip are the same string. After changing a line: node tools/voices/render.mjs (docs/VOICES.md).
// Nobody real is named or alluded to; the friends and the named academics have their own lines elsewhere.
//
// SPEECH: how often anyone speaks unprompted (2026-11: cut to a fifth of what it was; reactions to the player — being
// bumped, dodged, knocked over — are untouched). Measured by tools/measure_speech.mjs.
//
// ambientLine(): a walker's next line. Lines that fit the moment (a when / wx / zone tag that matches) are favoured;
// nothing heard in the last RECENT_S seconds is said again while there is anything else to say, and never the line
// before. The memory is the listener's: it also notes lines mirrored from other players' walkers (note()).
// Multiplayer: as before, the walker's owner picks the line and it is mirrored as text in the crowd-sync event, so every
// peer hears the same line in the same voice; nothing new is sent. slotLine() is for speakers decided by the shared
// clock (the quad walkers of systems/college_life.js): the same line for everybody, no repeats within a pass.

export const STREET_LINES = [
  // ------------------------------------------------------------------ students: any time, anywhere, not Oxford at all
  { who: 'student', lines: [
    "I'll start it tomorrow. Properly, this time.", 'Two thousand words by nine. I have a title.', "I've read the introduction. Twice.",
    "It's not procrastinating if I'm tidying.", 'My bibliography is longer than my essay.', "Someone's nicked my saddle. Just the saddle.",
    'They took the front wheel and left the lock.', 'My bike lights lasted one whole night.',
    'Someone ate my labelled yoghurt.', 'The washing machine ate my pound again.', "I've run out of clean socks. Laundry or shop?",
    "My phone's on four percent.", "He's seen the message. He's definitely seen it.",
    'My ex has got a fringe now. Apparently.', "I'm never drinking again. Until Friday.", 'My overdraft has an overdraft.',
    "Rent's due and I bought a waffle maker.", 'I had cereal for dinner. Twice.',
    'I slept through it. Both of them.', 'I nodded for an hour. No idea.',
    'My alarm went off. I did not.',
    "I've got forty tabs open and no ideas.", 'Coffee first. Then feelings.',
    "I think my flatmate's learning the trumpet.", 'We need a house meeting about the bins.', 'Who keeps using my mug?',
    'I emailed it at eight fifty-nine.', "The deadline's a suggestion, surely.", "I've got a plan. It's a bad plan.",
    "Mum's sent a parcel. It's all socks.",
    'Are you out tonight or pretending to work?', "I'm skint till Monday.", 'The radiator is either off or the sun.',
    "I haven't seen daylight since Sunday.",
    "I'm going to learn to cook. Next term.", "Pasta again. Pesto if I'm celebrating.",
    "I've got an interview. I own one shirt.", "I'm fine. Just tired. Since October.", 'I walked into a lamp post. Texting.',
    "He's nice. He owns a kettle. That's it.", "She said we should get coffee. What does that mean?",
  ] },
  // ------------------------------------------------------------------ students: Oxford
  { who: 'student', lines: [
    'Fifth week. Say no more.', "Eighth week can't come soon enough.",
    'Is it noughth week or minus first?', 'Michaelmas goes on forever.', 'Hilary is just Michaelmas with less hope.',
    "Roll on Trinity. Punts and Pimm's.", "My tutor's read it. He sighed.", "She called it a brave argument. Is that good?",
    "I talked for an hour about a book I haven't read.", "My tute partner's done the reading. Traitor.", 'Tute at nine. Essay at eight fifty.',
    "I've got collections on Friday. Collections!", 'A beta double minus. Is that even a mark?', 'Anything in my pidge? Just a library fine.',
    'My scout has seen things. Terrible things.', "The porter knows my name now. That's bad.",
    'I got locked out. In a towel.',
    'Hall was beige again. All of it.', 'Hall or the kebab van? Be honest.',
    'Brunch in hall. Only reason to get up.', 'College bar, then see what happens.', "What's the bop theme? Not togas again.",
    'I need a costume by eight. I have a bedsheet.', 'Battels came through. I need a sit down.', "My Bod card's stopped working. Again.",
    "The Rad Cam's full. At nine in the morning.", "There's a man asleep in the Gladstone Link.",
    'I got shushed in the Bodleian. By a tourist.', "You can't take coffee into the Bod. I tried.",
    "Finals are ages away. Aren't they?", 'The finalists look so tired. Poor things.', 'Where do you even buy sub fusc?',
    'I cycled down the High in a gown. Regrets.', "It's uphill to Cowley both ways, I swear.",
    'There are cows on Port Meadow. Actual cows.', 'A tourist photographed me eating a sandwich.',
    'I got stuck behind a tour group. For a week.', 'I went in the wrong college. Nobody noticed.',
    "I've joined eleven societies. I go to none.", "I signed up for rowing at Freshers' Fair. Help.",
    'He let go of the punt pole. Then the punt.',
  ] },
  // ------------------------------------------------------------------ students: by hour
  { who: 'student', when: 'morning', lines: [
    "Nine o'clock lectures should be illegal.", "I've been up since six. Rowing. Why.",
    "I haven't been to bed. It's still Tuesday.", "Morning. Don't talk to me yet.", 'I can still taste last night.',
    'My head. Who ordered the last round?', 'Breakfast ends at nine. Run.',
  ] },
  { who: 'student', when: 'evening', lines: [
    'Pre-drinks at mine. Bring a chair.', 'Bar at eight? Library till then. Allegedly.', "I'm staying in tonight. I mean it.",
    "Formal at seven. I've got to iron something.", 'Library shuts at ten. So do I.', "Just one at the King's Arms. One.",
    "Who's cooking? Nobody? Kebab, then.", 'Is it a Bridge night or a Camera night?',
  ] },
  // ------------------------------------------------------------------ students: by weather
  { who: 'student', wx: 'rain', lines: [
    "It's raining sideways.", "My umbrella's inside out again.", 'I cycled through a puddle. I am the puddle.',
    'A wet gown smells like a wet dog.', 'My essay has dissolved in my bag.', 'Of course it rained. I hung washing out.',
  ] },
  { who: 'student', wx: 'cold', lines: ["I can't feel my hands. Cycling was a mistake.", "It's colder in my room than out here.", "I'm wearing two jumpers and a gown."] },
  { who: 'student', wx: 'fine', lines: ['Too nice for the library. Tragic.', "Picnic in the Parks? I'll bring crisps.", "Punting weather. Who's bringing the lemonade?", 'I revised on the lawn. I revised the sky.'] },
  // ------------------------------------------------------------------ students: by place
  { who: 'student', zone: 'coll', lines: [
    'Keep off the grass. Even the grass looks nervous.', "Is the lodge open? I've lost my key.", 'Second quad, staircase four. Mind the step.',
    "Don't walk on the lawn. He's watching.", 'Is chapel compulsory? Asking for a friend.',
  ] },
  { who: 'student', zone: 'shop', lines: ['Meal deal for dinner. Living the dream.', 'Three pounds for a coffee? In this economy?', 'I only came out for milk.', "Blackwell's first. Then I'm broke."] },
  { who: 'student', zone: 'green', lines: ['Geese. Give them the path.', 'A swan looked at me. I left.'] },
  // ------------------------------------------------------------------ the small hours
  { who: 'club', lines: [
    "Cheesy chips. It's the law.", "Chips, cheese, and don't tell my mum.", 'The kebab van man knows my order.',
    'Is the kebab van still there? Please.', "I've lost my friends. All of them.",
    "I've lost my coat. I never had a coat.", "Has anyone got my Bod card? It's my ID.", "We're not going home. We're never going home.",
    'One more song! One more!', "The queue's round the corner. Kebab instead?",
    "Who's got the keys? Not me. Definitely not me.", "The porter's going to see me like this.", "Shh. We're being so quiet.",
    "I've got rowing at six. Ha. Ha ha.", "Is the essay still due if I'm dancing?",
    'Hold my chips. No. Give them back.', 'That was the best night. What happened?',
    "I'm walking. Taxis are for the rich.", 'Tell my tutor I was brave.', "Whose bike is this? It's not mine.",
    "Water. I'm drinking water. Look at me.",
  ] },
  // ------------------------------------------------------------------ visitors
  { who: 'tourist', lines: [
    'Is the whole town a college?', 'Which one is the oldest? They all look oldest.',
    'The guide said it is haunted. All of it.', 'Do the students really live in there?', 'Where do we find the punts?',
    "We've done three colleges. My feet!", 'Look at the gargoyles! That one is pulling a face.', 'Is the big round one a church?',
    'Stand there. No, left. With the tower.', 'They cycle in those gowns?',
    "The map says we're here. We're not here.", "Is there a gift shop? There's always a gift shop.",
  ] },
  { who: 'tourist', wx: 'rain', lines: ['The postcards had sunshine.'] },
  // ------------------------------------------------------------------ locals
  { who: 'townie', lines: [
    "Forty years I've lived here. Still get lost.", 'Tourists stop dead. Right in front of you.', "That's the third bike in the river this week.",
    "The park and ride's full again.", 'Bus is late. Bus is always late.', 'Term time. You can tell by the bikes.',
    "Lovely and quiet when they've gone home.", "They've dug the road up again.", "Mind the cyclists. They don't mind you.",
    "Cup of tea and a sit down, that's me.",
  ] },
  { who: 'townie', wx: 'rain', lines: ['Never rains but it pours. On a Saturday.', 'Good for the gardens, I suppose.'] },
  { who: 'townie', wx: 'cold', lines: ['Bit fresh today.'] },
  { who: 'townie', wx: 'fine', lines: ["Nice to see the sun. Won't last."] },
  { who: 'townie', when: 'night', lines: ['Students on bikes, no lights. Every night.'] },
  { who: 'shopper', lines: [
    "Queue's out the door. For a sandwich.", 'Have you got the list? I thought you had the list.',
    "Everything's a coffee shop now.", 'Do we need bin bags? We always need bin bags.',
    "They've put the prices up again.", 'Back to the car park. If I can find it.',
  ] },
  // ------------------------------------------------------------------ senior members (generic, unnamed)
  { who: 'don', lines: [
    'I set that essay in 1994. Still no good answer.', 'Forty scripts to mark. Send sherry.', 'The undergraduates get younger every year.',
    "I had a thought this morning. It's gone now.", 'Committee at four. Pray for me.',
    "It's all in my book. Nobody has read my book.", 'A promising essay. It promised a great deal.', "I've lost my spectacles. They're on my head.",
    'Governing Body sat three hours. Over a hedge.',
  ] },
  { who: 'subfusc', lines: [
    "Two papers down. Don't ask.", "I wrote my name. After that it's a blur.", 'Which carnation is it today? Pink?',
    'My mortarboard keeps blowing off.', 'Did anyone else answer question four?', "Three hours. My hand's gone.",
  ] },
  // ------------------------------------------------------------------ the river, the parks, the scaffolding
  { who: 'rower', lines: [
    'My hands are just blisters now.', 'We nearly bumped. Nearly.', "Cox says we're rushing the slide.",
    'Is the river on red flag again?', 'Carbs. I need all the carbs.', 'Ergs at seven. Somebody stop me.',
  ] },
  { who: 'jogger', lines: ['Just one more lap!', "Don't stop, don't stop.", 'Coming through!'] },
  { who: 'dog', lines: ["No, we don't chase the ducks.", 'Drop it. Whatever it is, drop it.', "He's never done that before. Honestly."] },
  { who: 'builder', lines: ['Four hundred years old and they want it by Friday.', "Can't touch that wall. It's older than America.", "Who's got the kettle on?"] },
];

// ---------------------------------------------------------------------------------------------- how often
export const SPEECH = {
  /** ambient walkers (pedestrians.js): the chatter timer still looks for someone near to speak every `tick` seconds by
   *  day / `tickNight` by night, but only one opportunity in `every` is taken (drawn afresh each time, mean 6: one in 5
   *  measured a quarter of the old rate in tools/measure_speech.mjs, one in 6 a fifth) */
  tick: [4, 8], tickNight: [2.5, 5], every: [5, 7],
  /** a scripted NPC's clock-driven idle line (staff, queues, patrons, porters): chance per 6 s slot while a player is
   *  within 6 m (was 0.2) */
  idleSlot: 0.04,
  /** a static / wandering NPC without a shared id: chance per second while the player is close (was 0.5 / 0.4, then the
   *  25-50 s pause both still have): about one line in 3 minutes instead of one in 40 s */
  idlePerS: 0.0065,
  /** quad walkers (college_life.js): chance per 14 s slot within 9 m (was 0.4) */
  quadSlot: 0.08,
  /** the Purple Turtle: seconds between remarks on the dance floor and in the queue outside (were 2.2-4.2 and 2-4.5) */
  club: [11, 21], clubQueue: [10, 22.5],
};
/** a line is not said again within this many seconds while there is anything else to say */
export const RECENT_S = 480;

// ---------------------------------------------------------------------------------------------- context
// pedestrians.js zone bits (kept in step by tools/smoke_speech.mjs)
const Z_TOUR = 1, Z_SHOP = 2, Z_RIVER = 8, Z_UPARKS = 16, Z_PARK = 32, Z_COLL = 64, Z_ISIS = 256;
const WHEN = { morning: (h) => h >= 6 && h < 11, day: (h) => h >= 9 && h < 18, evening: (h) => h >= 17 && h < 22, night: (h) => h >= 22 || h < 5 };
const WX = { rain: (w) => w.rain > 0.15, cold: (w) => w.tempC < 6, fine: (w) => w.rain < 0.03 && w.tempC >= 15 };
const ZONE = { coll: Z_COLL, shop: Z_SHOP, tour: Z_TOUR, green: Z_RIVER | Z_UPARKS | Z_PARK | Z_ISIS };
/** does a group fit { hour, rain, tempC, zone }? → 0 no, 1 untagged, 2+ the more tags match */
export function fits(g, ctx) {
  let n = 1;
  if (g.when) { if (!WHEN[g.when] || !WHEN[g.when](ctx.hour)) return 0; n++; }
  if (g.wx) { if (!WX[g.wx] || !WX[g.wx](ctx)) return 0; n++; }
  if (g.zone) { if (!((ctx.zone | 0) & ZONE[g.zone])) return 0; n++; }
  return n;
}
/** the context of a walker at (x, z): game clock, weather, the pedestrians' zone flags there */
export function contextOf(game, zone = 0) {
  const w = (game && game.weather) || null, t = game && game.time;
  return { hour: t ? t.hour : 12, rain: w && w.rain > 0 ? w.rain : 0, tempC: w && Number.isFinite(w.tempC) ? w.tempC : 10, zone: zone | 0 };
}
const BY_WHO = new Map();
for (const g of STREET_LINES) { if (!BY_WHO.has(g.who)) BY_WHO.set(g.who, []); BY_WHO.get(g.who).push(g); }
/** every new line of a line set, whatever its tags */
export function linesOf(who) { const out = []; for (const g of BY_WHO.get(who) || []) for (const t of g.lines) out.push(t); return out; }
/** the line set of a walker's own `lines` array (pedestrians.js hands in LINES[role.lines]): by identity, set up once */
const SETS = new Map();
export function registerSets(LINES) { for (const k of Object.keys(LINES || {})) if (BY_WHO.has(k)) SETS.set(LINES[k], k); }

// ---------------------------------------------------------------------------------------------- memory + choice
/** what this client has heard lately: text → seconds (clock passed in), and the last line of all */
export function makeMemory() { return { at: new Map(), last: null }; }
export const MEMORY = makeMemory();
export function note(text, now, mem = MEMORY) {
  if (!text) return;
  mem.at.set(text, now); mem.last = text;
  if (mem.at.size > 600) for (const [k, t] of mem.at) if (now - t > RECENT_S * 2) mem.at.delete(k);
}
const _c = [], _w = [];
/**
 * A walker's next unprompted line. base = its own few lines (pedestrians.js LINES[..], or a place's), who = its line
 * set (null: just `base`), ctx = contextOf(...), now = seconds, rnd = Math.random. New lines that fit the moment weigh
 * more (x2 per matching tag: a rain line in the rain is 2x, a rainy-evening one 4x); a line heard within RECENT_S is
 * left out while anything else remains, else the one heard longest ago is said; never the line just heard.
 */
export function ambientLine(base, who, ctx, now, rnd = Math.random, mem = MEMORY) {
  _c.length = 0; _w.length = 0;
  let total = 0, oldest = null, oldestT = Infinity;
  const add = (t, w) => {
    const at = mem.at.get(t);
    if (at !== undefined && now - at < RECENT_S) { if (t !== mem.last && at < oldestT) { oldestT = at; oldest = t; } return; }
    _c.push(t); _w.push(w); total += w;
  };
  if (base) for (let i = 0; i < base.length; i++) add(base[i], 1);
  const G = who ? BY_WHO.get(who) : null;
  if (G) for (let i = 0; i < G.length; i++) { const f = fits(G[i], ctx); if (!f) continue; const w = f === 1 ? 1 : f === 2 ? 2 : 4, L = G[i].lines; for (let j = 0; j < L.length; j++) add(L[j], w); }
  let text = null;
  if (_c.length) { let x = rnd() * total; for (let i = 0; i < _c.length; i++) { x -= _w[i]; if (x < 0 || i === _c.length - 1) { text = _c[i]; break; } } }
  else text = oldest || (base && base.length ? base[(rnd() * base.length) | 0] : null);
  if (text) note(text, now, mem);
  return text;
}
/** ambientLine for a pedestrian record: its line set from its own `lines` array (registerSets) */
export function walkerLine(lines, ctx, now, rnd = Math.random, mem = MEMORY) { return ambientLine(lines, SETS.get(lines) || null, ctx, now, rnd, mem); }
/** how many found opportunities to let pass before the next ambient line (SPEECH.every) */
export function nextGap(rnd = Math.random) { const [a, b] = SPEECH.every; return a + Math.floor(rnd() * (b - a + 1)); }

// ---------------------------------------------------------------------------------------------- shared-clock speakers
const h01 = (a, b = 0) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** the line of slot k from `list`, the same for everybody: the list is gone through in a shuffled order (a new shuffle
 *  each pass, seeded by the pass and salt), so nothing comes round again until everything else has */
export function slotLine(list, k, salt = 0) {
  const n = list.length; if (!n) return null;
  const pass = Math.floor(k / n), i = ((k % n) + n) % n;
  // i-th element of the pass's permutation: an affine walk x -> (a x + b) mod n with a coprime to n
  let a = 1 + Math.floor(h01(pass, salt * 31 + 7) * (n - 1)); const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  while (gcd(a, n) !== 1) a = a % n + 1;
  const b = Math.floor(h01(pass, salt * 31 + 11) * n);
  return list[(a * i + b) % n];
}
/** For a speaker who speaks on some slots only (spoke(q) → did slot q speak?): how many slots spoke before s since its
 *  epoch (256 slots) began, and the line for the c-th of them — its list in a shuffled order, a new shuffle each epoch,
 *  so the same speaker never says a line twice running (except, rarely, across an epoch) and everybody agrees. */
export function spokenBefore(s, spoke) { let c = 0; for (let q = s - (s & 255); q < s; q++) if (spoke(q)) c++; return c; }
export function epochLine(list, s, c, salt = 0) { const n = list.length; return n ? slotLine(list, (s >> 8) * n + (c % n), salt) : null; }
/** quad walkers: the short college lists plus every new student / don line that needs no particular hour or weather */
const QUAD = new Map();
export function quadLines(who, own) {
  let L = QUAD.get(own);
  if (!L) { L = own.slice(); for (const g of BY_WHO.get(who) || []) if (!g.when && !g.wx && (!g.zone || g.zone === 'coll')) for (const t of g.lines) if (!L.includes(t)) L.push(t); QUAD.set(own, L); }
  return L;
}
