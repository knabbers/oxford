// Ambient street life: a recycled pool of ~30 pedestrians walking a pavement graph built from map.roads, flavoured by
// place (colleges, tourist spots, shopping streets, parks, river, nightlife) and the shared game clock.
// Also hosts scripted NPCs for place modules (game.pedestrians.spawnAt), in the world or inside interiors.
//
// game.pedestrians = { list, knock(ped, vx, vz), nearest(x, z, r), near(x, z, r, out), spawnAt(x, z, look, opts), remove(ped),
//                      messes, stats(),
//                      graph               read-only walk graph {X, Z, start, nbr, count, edges} (CSR adjacency)
//                      route(ax, az, bx, bz) -> [[x, z], ...] | null   shortest walk over the graph between the nearest nodes
//                      addObstacle({x, z, r, until?}) -> handle, removeObstacle(handle), obstacles
//                          circles (world place) that pedestrians walk round and traffic (systems/traffic.js) stops for;
//                          `until` = game.time.now() ms after which it expires by itself
//                      addDoorway({ placeId, portal?, hours?, inside?, cap?, every?, dwell? }) -> handle
//                          the street door of a walk-in room (core/interiors.js): now and then a passing walker turns off
//                          the pavement, goes in through the real door, stands a while inside and comes out again }
// See docs/CHARACTERS_API.md.
import * as THREE from 'three';
import { createCharacter, randomLook, createDog, characterMaterial, fadeMaterial, fadeMeshes, POSES } from '../core/characters.js';
import { TUMBLE } from '../core/_tumble_pose.js';
// knocked by a vehicle (m/s): below HOP_V they hop clear, from TUMBLE_V they go up and over the bonnet
const HOP_V = 2.6, TUMBLE_V = 7;
import { pointInPoly } from '../core/collision.js';
import { K_CAR, K_BUS, K_BIKE, K_PED, K_PLAYER, K_REMOTE, capsulePoint } from './_motion.js';
import { busyOn, busyTier, busyHour, CORE_BOX } from './_busy.js';
import { SPEECH, MEMORY, note, registerSets, walkerLine, contextOf, nextGap, spokenBefore, epochLine } from './_street_lines.js';
// children and animals (2026-11-21): who they are and the rules they live by (_ped_child.js), the animals themselves
// (_ped_pets.js), what a family has with it (_ped_child_kit.js), what keeps them from ever being hit (_ped_protect.js)
import { isChildRole, needsAdult, GUARD_ROLES, childLook, guardLook, familyOf, partyOf, schoolOf, SCHOOLS, mayAppear, mayBeOut, schoolRun, schoolTrip, teenMayBeOut, noGo,
  HAND_SLOT, SIDE_SLOTS, pairSlot, CHILD_LINES, ADULT_RANGE, CHILD_TO } from './_ped_child.js';
import { createTownDog, bark } from './_ped_pets.js';
import { createPushchair } from './_ped_child_kit.js';
import { Protect } from './_ped_protect.js';
import { TYPES as PROTECT_TYPES } from './_vehiclemeshes.js';
import { TownScenes } from './_ped_scenes.js';
import { kidsOn } from './_ped_child.js';
import { Lanes } from './_ped_lanes.js';
import { Solid, R_PLAYER, R_REMOTE } from './_ped_solid.js';
import { personShare, THROW_K, THROW_MAX, SLIDE_DEC } from './_collide.js';
const KIDS = kidsOn();
const BUSY = busyOn();

const POOL = 30, PORTERS = 4;
const KID_EXTRA = 12;         // records beyond the walkers' own for the children who come with a parent or a teacher (they are not counted against the street's head count)
const SPAWN_MAX = 120, SPAWN_MIN = 45, SPAWN_MIN_BEHIND = 22, DESPAWN = 150, ANIM_FAR = 80;
// Nobody comes into being, or goes, in the player's view (2026-11-24; tools/smoke_popin.mjs). A walker is drawn whole
// within FADE_FAR of the player and thins out to nothing at SHOW_FAR (a dithered fade: characters.js setFade), so
// whoever is made beyond FADE_FAR is not there to be seen yet and walks into the picture. Nearer than that a walker
// is made, or taken away, only where the camera does not look or a building stands in the way (_unseen).
const FADE_FAR = 128, SHOW_FAR = DESPAWN - 5, SPAWN_FAR = SHOW_FAR + 2, FADE_IN_S = 0.5, FADE_IN_FAR_S = 1.4;
const DESPAWN_PER_FRAME = 8;  // far people disposed a frame
const BURST_PER_FRAME = 2;   // people made a frame during an arrival burst (the burst's 1.5 s stretched to the same number of tries)
// The top tier: a second walker (or second follower) is not started in a frame in which the first took longer than
// this, ms — a person whose body is not in the geometry cache yet costs 10-17 ms to build, and two of them in a frame
// were the 35-42 ms of pedestrian work seen 5-15 frames after arriving at Cornmarket. The burst is stretched by what
// was put off, so it makes the same number of tries; who is made, where, and with whom is untouched (a group's own
// members are made as before). ?spawnbudget=0: off (A/B); ?spawnbudget=<ms>. Other tiers: counted, never timed.
const SPAWN_MS = (() => { try { const v = new URLSearchParams(location.search).get('spawnbudget'); return v === null ? 4 : Math.max(0, +v || 0); } catch (e) { return 4; } })();
const TAU = Math.PI * 2;

// ------------------------------------------------------------------------------------------------ zones
const Z_TOUR = 1, Z_SHOP = 2, Z_NIGHT = 4, Z_RIVER = 8, Z_UPARKS = 16, Z_PARK = 32, Z_COLL = 64, Z_SCI = 128, Z_ISIS = 256, Z_EXAM = 512, Z_PUB = 1024;
const TOUR_STREETS = ['Broad Street', 'Radcliffe Square', 'Catte Street', 'Turl Street', "St Aldate's", 'High Street', 'Merton Street', 'New College Lane', 'Queen\'s Lane', 'Parks Road', 'Magdalen Bridge', 'Brewer Street', 'Oriel Square', 'Bear Lane'];
const SHOP_STREETS = ['Cornmarket Street', 'Queen Street', 'Magdalen Street', 'High Street', 'Market Street', 'George Street', "St Ebbe's Street", 'New Inn Hall Street', 'Westgate', 'Golden Cross', 'Turl Street', 'Broad Street', 'Little Clarendon Street', 'Cowley Road', 'St Clements Street'];
const NIGHT_STREETS = ['George Street', 'Cornmarket Street', 'Park End Street', 'Frewin Court', 'Hythe Bridge Street', 'Worcester Street', 'Gloucester Green', 'Magdalen Street', 'St Michael\'s Street', 'New Inn Hall Street', 'Beaumont Street', 'Gloucester Street', 'Queen Street', 'Cowley Road', 'St Clements Street'];   // (East Oxford: takeaways, pubs and the music venue keep both busy late)

// ------------------------------------------------------------------------------------------------ lines (clean!)
const LINES = {
  student: ["My essay's due at nine. Which nine?", 'Three tutes this week. THREE.', 'Anyone going to the bop?', "I've been in the Rad Cam since Tuesday.",
    'Formal hall or Hassan\'s?', "My tutor said 'interesting'. Bad sign.", 'Collections in noughth week?!', 'Who moved the Bod?', "I'm not lost, I'm exploring.",
    'Punting? In November?', 'Has anyone seen my gown?', 'Library fine. Again.', 'Essay crisis mode: activated.', 'Is it fifth week blues already?',
    'I need to find a reading list. And a will to live.', 'Battels are HOW much?', 'Pidge me later!', 'Did you do the problem sheet?', 'Hall food or Pret?'],
  subfusc: ['Is my bow tie straight?', 'Exam Schools is that way, right?', 'Last paper!', 'Carnation colour check: white?', 'Good luck!', 'Matriculation photo, smile!',
    'Trashing is officially banned. Officially.', 'This gown is not breathable.', 'I revised the wrong paper.'],
  don: ['In my day we wrote in Latin.', 'Fascinating. Utterly wrong, but fascinating.', 'Have you read the footnotes?', 'High Table awaits.',
    'The Senior Common Room has the better port.', "I've been on sabbatical since 1998.", 'Where did I leave my bicycle? 1987, I think.', 'One more footnote...',
    'Ah, a tutorial at nine. Splendid.', 'The Bodleian does not lend. Ever.'],
  tourist: ['Is this the way to Hogwarts?', 'Which one is the Harry Potter college?', 'Excuse me, where is Oxford University?', 'Can you take our photo?',
    'Is this the real Bridge of Sighs?', 'So which building IS the university?', 'Are those people wearing capes?', 'Where can we get a scone?', 'Hogwarts! Hogwarts!',
    'Is the Radcliffe Camera a camera?'],
  shopper: ['Cornmarket is heaving.', 'Clubcard prices!', 'Meal deal. Best deal.', 'They\'ve moved the Boots again.', 'Where did all the bike racks go?',
    'Covered Market for a cookie?', "It's raining. Of course it's raining."],
  townie: ['Bloody students.', 'Morning!', 'Lovely day for it.', 'The buses on the High, honestly.', 'Mind yourself.', "Typical. It's raining.", 'You alright?'],
  jogger: ["Can't stop, PB!", '*pant pant*', 'Morning!', 'On your left!', 'Nearly done... nearly...'],
  dog: ['Sit! Good boy.', "Sorry, he's friendly!", 'Leave it! LEAVE IT!', "Who's a good dog?", 'Not the squirrels again!', 'Heel. HEEL.'],
  rower: ['Erg scores are up!', '6am outing. Again.', 'Torpids next term!', 'Who left the blades out?', 'Bumps!', 'Easy oars!', 'Catch the crab next time, Rupert.'],
  builder: ['Mind the scaffold!', "Wouldn't park there.", 'Tea break!', 'Listed building, innit.', 'Another six months, minimum.'],
  police: ['Evening.', 'Move along now.', 'Mind how you go.', 'Everything alright here?', "Let's keep it down, eh?"],
  club: ['PARK END!', "Where's my shoe?", 'Bridge, then Plush?', 'Who wants cheesy chips?', 'I love you guys!', 'Taxi! TAXI!', "Hassan's! Hassan's!",
    'Shots? Shots.', "I'm not drunk, you're drunk!", "Where's Jess?", 'Is it Wahoo tonight?', 'Bop was ICONIC.', "I've got a 9am...", 'Sing it! SING IT!'],
  porter: ['Can I help you?', 'College is closed to visitors.', 'Off the grass, please.', 'Members only, I\'m afraid.', 'Name and college?', 'Post\'s in your pidge.'],
  react: ['Watch it!', 'Steady on!', 'Sorry! Sorry.', "Where's the fire?", 'Late for a tute?', 'Oi!', 'Excuse YOU.'],
  knock: ['Oi!', "I've got a tute!", 'My essay!', 'Mind the gown!', 'Rude!', 'Ow! My dignity!', 'I\'m writing to the Proctors!', "That's going in the Cherwell!", 'Not again!'],
  dodge: ['Whoa!', "Watch where you're going!", 'Mind out!', 'Are you blind?!', 'Pedestrians! Ever heard of them?', 'Close one!'],
  fist: ['You maniac!', "I'll have your number plate!", "I'm fine! No thanks to you!", 'Bad driver! BAD!', 'Learn to drive!', 'I was on the zebra!'],
  dogmess: ["Has anyone got a bag?", 'Oh, not on the grass...', 'Good boy... ugh.', "I'll get that. Probably."],
  // (2026-11-21: families, school parties, more dogs. The children's own lines are bubbles only for now: _ped_child.js CHILD_LINES)
  parent: ['Hold my hand by the road.', 'Not far now.', 'Wait for the green man.', 'Mind the bikes!', 'Stay where I can see you.', "We'll feed the ducks after lunch.",
    'Shoes on the right feet today. Well done.', 'One more museum, then cake.', 'Careful on the cobbles.', 'Who wants to see the dinosaurs?'],
  teacher: ['Two by two, please!', 'Hold hands with your partner.', 'Wait for the green man, everyone.', 'Stop. Look. Listen.', 'Stay on the pavement, Year Three!',
    'Walking feet, please!', 'Has everyone got a partner?', 'Count off, please. One...', 'Nearly at the museum.', 'Fingers on lips. Lovely.'],
  dogbark: ["Sorry! He's all bark.", 'Bertie! Enough!', "She only wants to say hello.", 'Quiet, you.', 'That is a duck. You have seen ducks.'],
  dogfetch: ['Fetch! Go on!', 'Drop it. Drop. Good girl!', 'Bring it here!', "That's not your ball!", 'Good boy! Again?'],
  dogtie: ['Stay. Two minutes.', "I'll only be a minute.", 'Wait there. Good dog.'],
  // (said in the park and museum scenes of systems/_ped_scenes.js — the same words there; listed here for tools/voices)
  parentpark: ['Not too far!', 'Lovely. Well done!', 'Five more minutes.', 'Mind the path!', 'Shall we feed the ducks after?', 'Hold it tight!'],
  teachermuseum: ['Who can tell me what a dodo was?', 'Stay together inside, please.', 'Worksheets out. Pencils only.', 'Indoor voices, Year Four.', 'We are guests here. Hands to ourselves.'],
};

registerSets(LINES);     // (each role's lines are topped up from _street_lines.js STREET_LINES when a walker speaks unprompted)

// ------------------------------------------------------------------------------------------------ roles
const ROLES = {
  student: { spd: [1.15, 1.6], pause: 0.06, bench: 0.12, lines: 'student' },
  gown: { spd: [1.15, 1.55], pause: 0.05, bench: 0.08, lines: 'student' },
  subfusc: { spd: [1.1, 1.4], pause: 0.06, group: [2, 4], lines: 'subfusc' },
  don: { spd: [0.85, 1.2], pause: 0.1, bench: 0.15, lines: 'don' },
  tourist: { spd: [0.75, 1.1], pause: 0.25, group: [1, 4], lines: 'tourist' },
  shopper: { spd: [1.0, 1.4], pause: 0.1, bench: 0.08, lines: 'shopper' },
  townie: { spd: [1.1, 1.5], pause: 0.05, bench: 0.08, lines: 'townie' },
  jogger: { spd: [2.7, 3.5], pause: 0, lines: 'jogger' },
  dogwalker: { spd: [0.95, 1.25], pause: 0.15, lines: 'dog' },
  rower: { spd: [1.3, 1.6], pause: 0.04, group: [2, 4], lines: 'rower' },
  builder: { spd: [1.0, 1.3], pause: 0.1, lines: 'builder' },
  police: { spd: [0.9, 1.1], pause: 0.15, group: [2, 2], lines: 'police' },
  shopworker: { spd: [1.0, 1.3], pause: 0.12, lines: 'shopper' },
  clubber: { spd: [0.9, 1.35], pause: 0.12, group: [2, 5], drunk: 0.55, lines: 'club' },
  nightowl: { spd: [1.0, 1.4], pause: 0.06, drunk: 0.3, lines: 'club' },
  porter: { spd: [1, 1], pause: 0, lines: 'porter' },
  // (appended 2026-11-21 — the order is on the wire, NET_ROLES: new roles go at the end)
  parent: { spd: [0.8, 1.05], pause: 0.12, lines: 'parent' },
  teacher: { spd: [0.72, 0.9], pause: 0.08, lines: 'teacher' },
  toddler: { spd: [0.8, 1.05], pause: 0 }, child: { spd: [0.9, 1.2], pause: 0 }, pupil: { spd: [0.8, 1.0], pause: 0 },
  teen: { spd: [1.1, 1.45], pause: 0.06, group: [2, 3] },
};
/** the shared clock (ms), for the rules that go by the day of the week (school days): set every frame in update() */
let NOW_MS = 0;
const ROLE_NAMES = Object.keys(ROLES).filter((r) => r !== 'porter');

function roleWeights(z, h, w) {
  const day = h >= 7 && h < 22, night = h >= 22 || h < 4;
  const coll = z & Z_COLL ? 1 : 0, sci = z & Z_SCI ? 1 : 0, tour = z & Z_TOUR ? 1 : 0, shop = z & Z_SHOP ? 1 : 0, nz = z & Z_NIGHT ? 1 : 0;
  const parks = z & Z_UPARKS ? 1 : 0, park = z & Z_PARK ? 1 : 0, river = z & Z_RIVER ? 1 : 0, isis = z & Z_ISIS ? 1 : 0, exam = z & Z_EXAM ? 1 : 0, pub = z & Z_PUB ? 1 : 0;
  w.student = day ? 26 * (coll ? 1.5 : 1) * (sci ? 1.5 : 1) : 0;
  w.gown = day ? 3 * (coll ? 2.5 : 1) : 0;
  w.subfusc = day ? 1.2 * (exam ? 10 : 1) * (coll ? 1.5 : 1) : 0;
  w.don = day && h < 20 ? 2 * (coll ? 3 : 1) * (sci ? 3 : 1) : 0;
  w.tourist = h >= 9 && h < 19 ? 4 * (tour ? 6 : 1) : 0;
  w.shopper = h >= 8 && h < 20 ? 4 * (shop ? 10 : 1) : 0;
  w.townie = day ? 14 : h >= 5.5 && h < 7 ? 5 : 1.5;
  w.jogger = ((h >= 6 && h < 10) || (h >= 16 && h < 20) ? 3 : day ? 1 : 0) * (parks || park ? 7 : 1) * (river ? 2 : 1) * (tour || shop ? 0.3 : 1);
  w.dogwalker = (h >= 6.5 && h < 21 ? 1 : 0) * (parks ? 30 : park ? 8 : 0.6) * (h < 10 || h >= 16 ? 1.5 : 1);
  w.rower = ((h >= 5.5 && h < 9) || (h >= 13 && h < 17) ? 1 : 0) * (isis ? 30 : river ? 3 : 0);
  w.builder = h >= 7 && h < 17 ? 1.2 * (parks || park ? 0.1 : 1) : 0;
  w.police = 0.35 + (night && nz ? 3 : 0);
  w.shopworker = h >= 8 && h < 20 ? 0.6 * (shop ? 3 : 0.3) : 0;
  w.clubber = night ? (nz ? 60 : pub ? 8 : 1) : h >= 20.5 && nz ? 8 : 0;
  w.nightowl = night || h < 5.5 ? 6 : 0;
  // families by day (most in the parks and round the sights); a school party now and then on a school day, between the
  // bells; pupils in uniform around the school run. Never made as leaders: the children themselves (they come with an adult)
  w.parent = KIDS && mayAppear(h) ? 3 * (parks || park ? 2.4 : 1) * (tour ? 1.6 : 1) * (shop ? 1.2 : 1) * (river ? 1.3 : 1) : 0;
  w.teacher = KIDS && mayAppear(h) && schoolTrip(h, NOW_MS) ? 1.3 * (tour ? 3 : 1) * (sci ? 3 : 1) * (parks ? 2 : 1) : 0;
  w.teen = KIDS && schoolRun(h, NOW_MS) ? 8 : 0;
  w.toddler = 0; w.child = 0; w.pupil = 0;
  return w;
}

function targetCount(h, nightFrac) {
  if (h >= 7 && h < 20) return POOL;
  if (h >= 20 && h < 22) return Math.round(POOL * 0.8);
  if (h >= 22 || h < 3) return Math.min(POOL, Math.round(8 + 22 * Math.min(1, nightFrac * 3)));
  if (h < 5.5) return 4 + (nightFrac > 0.1 ? 6 : 0);
  return 16;
}

/** a line from a list, not the one heard last */
const pick = (a) => { const i = (Math.random() * a.length) | 0; return a[i] === MEMORY.last && a.length > 1 ? a[(i + 1 + ((Math.random() * (a.length - 1)) | 0)) % a.length] : a[i]; };
const rand = (a, b) => a + Math.random() * (b - a);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function lookFor(role, seed, hour) {
  const r = (seed % 1000) / 1000, r2 = ((seed / 1000) % 1000) / 1000;
  let L;
  switch (role) {
    case 'student': case 'nightowl': {
      L = randomLook(seed, { outfit: 'casual' });
      if (L.hairStyle === 'grey-wild') L.hairStyle = 'short';
      if ([0x8a8a86, 0xb8b8b0, 0xd8d8d0, 0xeeeeea].includes(L.hair)) L.hair = 0x3b2616;
      if (r < 0.35) L.backpack = L.backpack ?? 0x1a1a1a;
      if (r2 < 0.3) L.scarf = L.scarf ?? [[0x1a2a5a, 0xc8a030], [0x7a1a2a, 0x1a1a1a], [0x1a4a2a, 0xe0e0e0], [0x5a1a5a, 0xe0c040]][seed % 4];
      L.prop = role === 'nightowl' ? (r < 0.25 ? 'kebab' : r < 0.4 ? 'phone' : undefined) : r2 < 0.55 ? 'phone' : r2 < 0.65 ? 'coffee' : r2 < 0.73 ? 'book' : undefined;
      break;
    }
    case 'gown': L = randomLook(seed, { outfit: 'gown' }); if (r < 0.2) L.prop = 'book'; break;
    case 'subfusc': L = randomLook(seed, { outfit: 'subfusc' }); break;
    case 'don': L = randomLook(seed, { outfit: 'tweed' }); if (r < 0.3) L.prop = 'book'; else if (r < 0.4) L.prop = 'umbrella'; break;
    case 'tourist': L = randomLook(seed, { outfit: 'tourist' }); if (!L.camera && r < 0.6) L.prop = 'camera'; else if (r < 0.75) L.prop = 'phone'; break;
    case 'shopper': L = randomLook(seed, { outfit: 'casual' }); L.prop = ['bag-tesco', 'bag-sainsburys', 'bag-waitrose', 'bag', 'bag-tesco', 'bag-sainsburys'][seed % 6]; break;
    case 'townie': L = randomLook(seed, { outfit: r < 0.2 ? 'smart' : 'casual' }); if (r2 < 0.12) L.prop = 'umbrella'; else if (r2 < 0.25) L.prop = 'coffee'; else if (r2 < 0.4) L.prop = 'phone'; break;
    case 'jogger': L = randomLook(seed, { outfit: 'jogger' }); break;
    case 'dogwalker': L = randomLook(seed, { outfit: 'casual' }); L.jacket = [0x3e4230, 0x1c2436, 0x5a4636, 0x2a3a2a][seed % 4]; L.jacketLen = 'hip'; L.shoeStyle = 'boot';
      if (r < 0.3) { L.hat = 'flatcap'; L.hatColor = 0x5a5030; } delete L.prop; break;
    case 'rower': L = randomLook(seed, { outfit: 'rower' }); break;
    case 'builder': L = randomLook(seed, { outfit: 'builder' }); if (r < 0.2) L.prop = 'clipboard'; break;
    case 'police': L = randomLook(seed, { outfit: 'police' }); break;
    case 'shopworker': L = randomLook(seed, { outfit: 'shopworker' }); L.prop = r < 0.5 ? 'coffee' : 'phone'; break;
    case 'clubber': L = randomLook(seed, { outfit: 'clubbing', hour: hour ?? globalThis.game?.time?.hour }); if (r < 0.12) L.prop = 'bottle'; else if (r < 0.22) L.prop = 'kebab'; else if (r < 0.32) L.prop = 'phone'; break;
    case 'porter': L = randomLook(seed, { outfit: 'porter' }); break;
    case 'parent': case 'teacher': L = guardLook(role, seed); break;
    // (a child's school is in its seed - the follower's seed is made to carry the leader's school: _spawnFollower)
    case 'toddler': case 'child': case 'pupil': case 'teen': L = childLook(role, seed, seed % SCHOOLS.length); break;
    default: L = randomLook(seed);
  }
  if (L.prop === undefined) delete L.prop;
  return L;
}

/** A look from what multiplayer sends: kind 0 = lookFor(role, seed, hour), 1 = randomLook(seed), 2 = a bus driver. */
function lookOf(kind, role, seed, hour) {
  if (kind === 1) return randomLook(seed);
  if (kind === 2) return Object.assign(randomLook(seed), { topStyle: 'shirt', top: 0xb9cde3, sleeves: 'short', bottom: 0x23262d, jacket: undefined, hivis: 0xd9ec2a });
  return lookFor(role, seed, hour);
}
export { lookOf };
const NET_ROLES = [...Object.keys(ROLES)];
const POSE_I = Object.fromEntries(POSES.map((k, i) => [k, i]));
const newSeed = () => (Math.random() * 1e9) | 0;
/** integer hash of (a, b, c) -> [0, 1): the same on every client */
function hh(a, b, c) {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca77) ^ Math.imul((c | 0) + 0x165667b1, 0xc2b2ae3d)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }

// ------------------------------------------------------------------------------------------------ graph building
const FOOT = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'living_street', 'track', 'bridleway']);
const PAVE = new Set(['residential', 'tertiary', 'unclassified', 'primary', 'secondary', 'primary_link', 'secondary_link', 'tertiary_link']);

function buildGraph(map, collider, wet, onRoad = () => false) {
  const MC = 1.5, MERGE2 = 1.5 * 1.5;
  const nx = [], nz = [], adj = [], nw = [];      // (nw: half the width of the way a node lies on - _ped_lanes.js)
  const hash = new Map();
  const hk = (cx, cz) => (cx + 20000) * 40000 + (cz + 20000);
  const B = collider.bounds || { minX: map.bounds.minX + 5, maxX: map.bounds.maxX - 5, minZ: map.bounds.minZ + 5, maxZ: map.bounds.maxZ - 5 };
  const inR = (q, x, z) => x > q.minX + 2 && x < q.maxX - 2 && z > q.minZ + 2 && z < q.maxZ - 2;
  const inB = B.boxes ? (x, z) => { for (let i = 0; i < B.boxes.length; i++) if (inR(B.boxes[i], x, z)) return true; return false; } : (x, z) => inR(B, x, z);   // union of map.boxes
  function node(x, z, w = 0) {
    const cx = Math.floor(x / MC), cz = Math.floor(z / MC);
    let best = -1, bd = MERGE2;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const a = hash.get(hk(cx + dx, cz + dz)); if (!a) continue;
      for (const i of a) { const ex = nx[i] - x, ez = nz[i] - z, d2 = ex * ex + ez * ez; if (d2 < bd) { bd = d2; best = i; } }
    }
    if (best >= 0) { if (w > nw[best]) nw[best] = w; return best; }
    const id = nx.length; nx.push(x); nz.push(z); adj.push([]); nw.push(w);
    const k = hk(cx, cz); let a = hash.get(k); if (!a) hash.set(k, (a = [])); a.push(id);
    return id;
  }
  const link = (a, b) => { if (a === b || a < 0 || b < 0) return; if (!adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); } };
  const edgeOk = (x1, z1, x2, z2, walls) => {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(len / 4));
    for (let i = 1; i < n; i++) if (wet(x1 + (x2 - x1) * (i / n), z1 + (z2 - z1) * (i / n))) return false;
    if (walls && collider.raycast(x1, z1, x2, z2) !== null) return false;
    return true;
  };
  // pts may contain nulls (invalid points) which break the chain. Returns [firstNode, lastNode].
  function chain(pts, walls, ids = null, hw = 1.1) {
    let prev = -1, px = 0, pz = 0, first = -1, last = -1, have = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!p) { prev = -1; have = false; continue; }
      const [x, z] = p;
      if (!have) { if (!wet(x, z) && inB(x, z)) { prev = node(x, z, hw); if (first < 0) first = prev; last = prev; if (ids) ids.push(prev); } px = x; pz = z; have = true; continue; }
      const len = Math.hypot(x - px, z - pz), n = Math.max(1, Math.ceil(len / 10));
      for (let j = 1; j <= n; j++) {
        const sx = px + (x - px) * (j / n), sz = pz + (z - pz) * (j / n);
        if (wet(sx, sz) || !inB(sx, sz)) { prev = -1; continue; }
        const id = node(sx, sz, hw);
        if (prev >= 0 && id !== prev && edgeOk(nx[prev], nz[prev], sx, sz, walls)) link(prev, id);
        prev = id; if (first < 0) first = id; last = id; if (ids) ids.push(id);
      }
      px = x; pz = z;
    }
    return [first, last];
  }
  function offsetPts(pts, base, side) {
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[Math.min(pts.length - 1, i + 1)];
      let d1x = b[0] - a[0], d1z = b[1] - a[1], d2x = c[0] - b[0], d2z = c[1] - b[1];
      let l1 = Math.hypot(d1x, d1z), l2 = Math.hypot(d2x, d2z);
      if (l1 < 1e-6) { d1x = d2x; d1z = d2z; l1 = l2; } if (l2 < 1e-6) { d2x = d1x; d2z = d1z; l2 = l1; }
      if (l1 < 1e-6) { out[i] = null; continue; }
      const n1x = -d1z / l1, n1z = d1x / l1, n2x = -d2z / l2, n2z = d2x / l2;
      let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      const k = 1 / Math.max(0.5, mx * n1x + mz * n1z);
      out[i] = null;
      // (the pavement line, else the kerb line, never out on a carriageway: the inner side of a dual carriageway like
      // St Giles' would otherwise run down the middle of the other one; only where house fronts stand right at the road
      // edge, as before: along the edge of this road)
      for (let t = 0; t < 3 && !out[i]; t++) {
        const off = t === 0 ? base : t === 1 ? base - 0.95 : base * 0.6 + 0.3;
        const x = b[0] + mx * off * k * side, z = b[1] + mz * off * k * side;
        if (inB(x, z) && !wet(x, z) && (t === 2 || !onRoad(x, z)) && collider.isFree(x, z, 0.3)) out[i] = [x, z];
      }
    }
    return out;
  }
  for (const r of map.roads) {
    if (!r.pts || r.pts.length < 2) continue;
    if (r.access === 'private' || r.access === 'no') continue;
    if (FOOT.has(r.kind)) chain(r.pts, false, null, r.kind === 'steps' ? Math.min(1.1, (r.w || 2.2) / 2) : (r.w || 2.2) / 2);
    else if (r.kind === 'service' && r.w < 5) chain(r.pts, false, null, (r.w || 4) / 2);   // (not where a mapped service road lies over a street)
    else if (PAVE.has(r.kind) || r.kind === 'service') {
      const base = r.w / 2 + 1.1;
      const li = [], ri = [], L = chain(offsetPts(r.pts, base, 1), true, li), R = chain(offsetPts(r.pts, base, -1), true, ri);
      for (let e = 0; e < 2; e++) {   // crossings at both ends of the way
        const a = L[e], b = R[e];
        if (a < 0 || b < 0) continue;
        // straight across: where one chain's end node is far along the street from the other's (a pavement line broken
        // near the end), cross from that end to the nearest node of the other side, not tens of metres down the middle
        if (Math.hypot(nx[a] - nx[b], nz[a] - nz[b]) < 2 * base + 3) { if (edgeOk(nx[a], nz[a], nx[b], nz[b], true)) link(a, b); continue; }
        for (const [p, other] of [[a, ri], [b, li]]) {
          let q = -1, qd = 2 * base + 3;
          for (const o of other) { const d = Math.hypot(nx[o] - nx[p], nz[o] - nz[p]); if (d < qd) { qd = d; q = o; } }
          if (q >= 0 && edgeOk(nx[p], nz[p], nx[q], nz[q], true)) link(p, q);
        }
      }
    }
  }
  // join dangling ends to the nearest other node within ~7 m (T-junction pavements, footway stubs)
  const N0 = nx.length;
  for (let i = 0; i < N0; i++) {
    if (adj[i].length > 1) continue;
    const x = nx[i], z = nz[i], cx = Math.floor(x / MC), cz = Math.floor(z / MC);
    let best = -1, bd = 49;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      const a = hash.get(hk(cx + dx, cz + dz)); if (!a) continue;
      for (const j of a) {
        if (j === i || adj[i].includes(j)) continue;
        // skip our own chain neighbour's neighbours (would just make a tiny triangle)
        if (adj[i].length && adj[adj[i][0]].includes(j)) continue;
        const ex = nx[j] - x, ez = nz[j] - z, d2 = ex * ex + ez * ez;
        if (d2 < bd) { bd = d2; best = j; }
      }
    }
    if (best >= 0 && edgeOk(x, z, nx[best], nz[best], true)) link(i, best);
  }
  // keep decent-sized connected components only
  const N = nx.length, comp = new Int32Array(N).fill(-1), sizes = [];
  const stack = [];
  for (let i = 0; i < N; i++) {
    if (comp[i] >= 0 || adj[i].length === 0) continue;
    const c = sizes.length; let size = 0; stack.push(i); comp[i] = c;
    while (stack.length) { const u = stack.pop(); size++; for (const v of adj[u]) if (comp[v] < 0) { comp[v] = c; stack.push(v); } }
    sizes.push(size);
  }
  const remap = new Int32Array(N).fill(-1); let M = 0;
  for (let i = 0; i < N; i++) if (comp[i] >= 0 && sizes[comp[i]] >= 25) remap[i] = M++;
  const X = new Float32Array(M), Z = new Float32Array(M), W = new Float32Array(M), start = new Int32Array(M + 1);
  let E = 0;
  for (let i = 0; i < N; i++) { const j = remap[i]; if (j < 0) continue; X[j] = nx[i]; Z[j] = nz[i]; W[j] = nw[i]; start[j] = E; for (const v of adj[i]) if (remap[v] >= 0) E++; }
  start[M] = E;
  const nbr = new Int32Array(E); let e = 0;
  for (let i = 0; i < N; i++) { if (remap[i] < 0) continue; for (const v of adj[i]) if (remap[v] >= 0) nbr[e++] = remap[v]; }
  return { X, Z, W, start, nbr, count: M, edges: E / 2 };
}

// ------------------------------------------------------------------------------------------------ the system
const FAR_AWAY = { x: 1e7, y: 0, z: 1e7 };
class Pedestrians {
  constructor(game) {
    this.game = game;
    const map = game.map, col = game.worldCollider;
    const b = map.bounds;
    this.bounds = col.bounds || { minX: b.minX + 5, maxX: b.maxX - 5, minZ: b.minZ + 5, maxZ: b.maxZ - 5 };
    const T = (typeof performance !== 'undefined' ? performance : Date), tm = {}; let t0 = T.now();
    const lap = (k) => { const t = T.now(); tm[k] = Math.round(t - t0); t0 = t; };
    this._buildWetMask(col, b); this._buildRoadMask(map); lap('wet');
    const wet = (x, z) => this.wet(x, z);
    this.graph = buildGraph(map, col, wet, (x, z) => this.road(x, z)); lap('graph');
    this._buildNodeGrid();
    this.lanes = new Lanes(game, this);      // (each walker's own line across the width of the street: _ped_lanes.js)
    this._buildZones(map, b); lap('zones');
    this._buildBenches(map);
    this._buildPorterGates(map, col); lap('gates');
    this.installMs = tm;
    // pool
    this.list = [];
    this.pool = [];
    for (let i = 0; i < POOL + PORTERS; i++) { const p = this._record(); p.poolIdx = i; this.pool.push(p); this.list.push(p); }
    this.amb = this.pool.slice(0, POOL);     // the ambient walkers' records (grows in multiplayer: one crowd per player owned, see _grow)
    this.sync = null;                        // game.crowdsync (multiplayer), looked up lazily
    this.netProvider = this._netProvider();
    this.leashMat = new THREE.LineBasicMaterial({ color: 0x2a1a10 });
    this.messes = [];
    this._makeMessMesh();
    this.weights = {};
    this._queue = []; this.nightFrac = 0; this._nightT = 0; this._chatT = 0; this._sayT = 3; this._porterT = 0; this._spawnT = 0; this.burst = 2;
    this._last = new THREE.Vector3().copy(game.player.pos); this._fwd = new THREE.Vector3(); this.frame = 0;
    this.obstacles = [];
    this.doorways = []; this._dwT = 0; this.doorStats = { in: 0, out: 0, seeded: 0, gaveUp: 0, dropped: 0 };
    // children and animals (2026-11-21): the animals about this frame, what keeps vehicles off them and the children,
    // and counters the tests read (every one of the "never" counters must stay 0: tools/smoke_children.mjs)
    this.animals = []; this._animN = 0; this._animPool = []; this.protect = new Protect(game, this); this._kidT = 0;
    this.solid = new Solid(game, this); game.solid = this.solid;      // (people are solid to a player on foot: core/player.js asks it)
    this.scenes = KIDS ? new TownScenes(game, this) : null;
    this.kidStats = { families: 0, parties: 0, teens: 0, sentHome: 0, broughtBack: 0, noGo: 0, indoors: 0, orphans: 0, tied: 0 };
    this._visitCtl = (p, dt) => this._visitWorld(p, dt);
    for (const o of game.streetDoors || []) { try { this.addDoorway(o); } catch (e) { console.warn('[pedestrians] doorway', e); } }
    this.api = this._api();
  }

  // ---------------------------------------------------------------- obstacles + routing (public API)
  addObstacle(o) {
    const ob = { x: +o.x || 0, z: +o.z || 0, r: Math.max(0.1, +o.r || 1), until: o.until ?? null };
    this.obstacles.push(ob);
    return ob;
  }
  removeObstacle(ob) { const i = this.obstacles.indexOf(ob); if (i >= 0) this.obstacles.splice(i, 1); }
  /** Is (x,z) inside an obstacle (with margin)? */
  _inObstacle(x, z, m) {
    const O = this.obstacles;
    for (let i = 0; i < O.length; i++) { const o = O[i], dx = x - o.x, dz = z - o.z, R = o.r + m; if (dx * dx + dz * dz < R * R) return o; }
    return null;
  }
  /** Shortest path over the walk graph (A*), as world points; null if unreachable. */
  route(ax, az, bx, bz) {
    const G = this.graph, a = this.nearestNode(ax, az, 40), b = this.nearestNode(bx, bz, 40);
    if (a < 0 || b < 0) return null;
    if (a === b) return [[G.X[a], G.Z[a]]];
    const N = G.count, g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [], hx = G.X[b], hz = G.Z[b], hf = (i) => Math.hypot(G.X[i] - hx, G.Z[i] - hz);
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    g[a] = 0; push(a, hf(a));
    let exp = 0;
    while (heap.length) {
      const u = pop()[1]; if (closed[u]) continue; closed[u] = 1;
      if (u === b || ++exp > 80000) break;
      for (let e = G.start[u]; e < G.start[u + 1]; e++) {
        const v = G.nbr[e]; if (closed[v]) continue;
        const d = g[u] + Math.hypot(G.X[v] - G.X[u], G.Z[v] - G.Z[u]);
        if (d < g[v]) { g[v] = d; prev[v] = u; push(v, d + hf(v)); }
      }
    }
    if (!closed[b]) return null;
    const out = []; for (let v = b; v >= 0; v = prev[v]) { out.push([G.X[v], G.Z[v]]); if (v === a) break; }
    return this._detour(out.reverse());
  }
  /**
   * The walk graph runs past lamp posts, trees, bins and bollards standing on the pavement line (they were placed after
   * it was built): step round each one a route would walk through (motion pass). Deterministic: every solid circle of
   * the outdoor collider counts whether or not it has been knocked over, so two players get the same route (named
   * characters walking on the shared clock, places/keble_pair.js).
   */
  _detour(pts) {
    const col = this.game.worldCollider; if (!col || !col.grid || pts.length < 2) return pts;
    const out = [pts[0]], key = (cx, cz) => cx * 73856093 ^ cz * 19349663, hits = [];
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], az = pts[i - 1][1], bx = pts[i][0], bz = pts[i][1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
      hits.length = 0;
      if (L > 0.3) {
        for (let cx = Math.floor((Math.min(ax, bx) - 1) / 8); cx <= Math.floor((Math.max(ax, bx) + 1) / 8); cx++)
          for (let cz = Math.floor((Math.min(az, bz) - 1) / 8); cz <= Math.floor((Math.max(az, bz) + 1) / 8); cz++) {
            const a = col.grid.get(key(cx, cz)); if (!a) continue;
            for (const c of a) {
              if (c.seg || c.r > 1.2 || hits.includes(c)) continue;
              const t = ((c.x - ax) * dx + (c.z - az) * dz) / L2; if (t <= 0.02 || t >= 0.98) continue;
              const px = ax + dx * t - c.x, pz = az + dz * t - c.z, d = Math.hypot(px, pz);
              if (d < c.r + 0.32) { c._t = t; hits.push(c); }
            }
          }
        hits.sort((p, q) => p._t - q._t);
      }
      for (const c of hits) {
        // a point beside it, on whichever side the line passes (left of travel if dead centre), if that is open ground
        const nx = -dz / L, nz = dx / L, px = ax + dx * c._t, pz = az + dz * c._t, sd = (px - c.x) * nx + (pz - c.z) * nz >= 0 ? 1 : -1;
        const qx = c.x + nx * sd * (c.r + 0.45), qz = c.z + nz * sd * (c.r + 0.45), last = out[out.length - 1];
        if (this.wet(qx, qz) || col.raycast(last[0], last[1], qx, qz) !== null || col.raycast(qx, qz, bx, bz) !== null) continue;
        out.push([qx, qz]);
      }
      out.push(pts[i]);
    }
    return out;
  }

  // ---------------------------------------------------------------- spatial helpers
  // 2 m raster of the water: bit1 = centre in water, bit2 = centre on a bridge/pier, bit4 = within 1.5 m of a boundary
  // (only those cells fall back to the exact, slow Collider.isWet).
  _buildWetMask(col, b) {
    const C = 2, x0 = b.minX, z0 = b.minZ, w = Math.ceil((b.maxX - b.minX) / C) + 2, h = Math.ceil((b.maxZ - b.minZ) / C) + 2;
    const m = new Uint8Array(w * h), BAND = 1.5;
    const fillPoly = (rings, bit) => {
      let minZ = Infinity, maxZ = -Infinity;
      for (const r of rings) for (const q of r) { if (q[1] < minZ) minZ = q[1]; if (q[1] > maxZ) maxZ = q[1]; }
      const xs = [];
      for (let cz = Math.max(0, Math.floor((minZ - z0) / C)); cz <= Math.min(h - 1, Math.floor((maxZ - z0) / C)); cz++) {
        const z = z0 + (cz + 0.5) * C; xs.length = 0;
        for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          const zi = r[i][1], zj = r[j][1];
          if ((zi > z) !== (zj > z)) xs.push(r[i][0] + ((z - zi) / (zj - zi)) * (r[j][0] - r[i][0]));
        }
        xs.sort((a, c) => a - c);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          for (let cx = Math.max(0, Math.ceil((xs[k] - x0) / C - 0.5)); cx <= Math.min(w - 1, Math.floor((xs[k + 1] - x0) / C - 0.5)); cx++) m[cz * w + cx] |= bit;
        }
      }
    };
    // capsule: cells with centre within rIn get `bit`, cells within |d - r| < BAND get 4
    const capsule = (ax, az, bx, bz, r, bit) => {
      const R = r + BAND;
      const minx = Math.max(0, Math.floor((Math.min(ax, bx) - R - x0) / C)), maxx = Math.min(w - 1, Math.floor((Math.max(ax, bx) + R - x0) / C));
      const minz = Math.max(0, Math.floor((Math.min(az, bz) - R - z0) / C)), maxz = Math.min(h - 1, Math.floor((Math.max(az, bz) + R - z0) / C));
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      for (let cz = minz; cz <= maxz; cz++) for (let cx = minx; cx <= maxx; cx++) {
        const px = x0 + (cx + 0.5) * C, pz = z0 + (cz + 0.5) * C;
        let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(px - ax - dx * t, pz - az - dz * t);
        if (d < r && bit) m[cz * w + cx] |= bit;
        if (d < R && d > r - BAND - 1.42) m[cz * w + cx] |= 4;
      }
    };
    const edges = (ring) => { for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) capsule(ring[j][0], ring[j][1], ring[i][0], ring[i][1], 0, 0); };
    for (const wa of col.water) { fillPoly([wa.poly, ...(wa.holes || [])], 1); edges(wa.poly); for (const hl of wa.holes || []) edges(hl); }
    for (const l of col.waterLines) capsule(l.x1, l.z1, l.x2, l.z2, l.r, 1);
    for (const wk of col.walkable) {
      if (wk.poly) { fillPoly([wk.poly], 2); edges(wk.poly); } else capsule(wk.x1, wk.z1, wk.x2, wk.z2, wk.r, 2);
    }
    this._wm = { m, w, h, C, x0, z0 };
  }
  /** motor carriageways as segments in a 20 m grid (motion pass): road(x, z) is true on a carriageway (0.25 m in from its
   *  mapped edge): where a walker looks before stepping out, where the walk graph's pavement lines may not run, where the
   *  traffic counts people as in its way */
  _buildRoadMask(map) {
    const g = (this._rg = new Map());
    for (const r of map.roads) {
      if (!PAVE.has(r.kind) || !r.pts || r.pts.length < 2 || r.tunnel) continue;
      const hw = (r.w || 6.5) / 2 - 0.25;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const q = [r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1], hw];
        for (let cx = Math.floor((Math.min(q[0], q[2]) - hw) / 20); cx <= Math.floor((Math.max(q[0], q[2]) + hw) / 20); cx++)
          for (let cz = Math.floor((Math.min(q[1], q[3]) - hw) / 20); cz <= Math.floor((Math.max(q[1], q[3]) + hw) / 20); cz++) {
            const k = cx * 65536 + cz; let a = g.get(k); if (!a) g.set(k, (a = [])); a.push(q);
          }
      }
    }
  }
  road(x, z, margin = 0) {
    const a = this._rg && this._rg.get(Math.floor(x / 20) * 65536 + Math.floor(z / 20));
    if (!a) return false;
    for (let i = 0; i < a.length; i++) {
      const q = a[i], dx = q[2] - q[0], dz = q[3] - q[1], l2 = dx * dx + dz * dz;
      let t = l2 ? ((x - q[0]) * dx + (z - q[1]) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - q[0] - dx * t, ez = z - q[1] - dz * t, r = q[4] + margin;
      if (ex * ex + ez * ez < r * r) return true;
    }
    return false;
  }
  /**
   * About to step off the kerb from (x, z) towards (tx, tz): is anything coming that would get there while we are in the
   * road? Uses the shared neighbour grid (game.traffic.grid, last frame): every vehicle moving towards the crossing line
   * that would reach it within the time we need to cross (+1.5 s), within its width + 1.5 m of it.
   */
  _roadClear(p, tx, tz) {
    const T = this.game.traffic, G = T && T.grid;
    if (!G || !G.n) return true;
    const dx = tx - p.x, dz = tz - p.z, L = Math.hypot(dx, dz) || 1, tCross = L / Math.max(0.8, p.vmax) + 1.5;
    const n = G.gather(p.x + dx / 2, p.z + dz / 2, 70, _gi);
    for (let j = 0; j < n; j++) {
      const i = _gi[j], k = G.K[i];
      if (k === K_PED || k === K_PLAYER || (k === K_REMOTE && G.HALF[i] === 0)) continue;
      const v = G.V[i];
      if (v < 0.5) {
        if (k !== K_CAR && k !== K_BUS && k !== K_BIKE) continue;     // (a parked / abandoned car: walk round it)
        // stopped across the way over (a queue): wait for it to move rather than squeeze between the bumpers
        const d = Math.min(capsulePoint(G, i, p.x + dx * 0.5, p.z + dz * 0.5, _cp), capsulePoint(G, i, p.x + dx * 0.85, p.z + dz * 0.85, _cp), capsulePoint(G, i, p.x + dx * 0.2, p.z + dz * 0.2, _cp));
        if (d < G.R[i] + 0.45) { this._kerbBlock = true; return false; }
        continue;
      }
      const fx = G.FX[i], fz = G.FZ[i], reach = v * tCross + G.HALF[i] + 3;
      for (let s = 0; s <= 2; s++) {
        const qx = p.x + dx * s / 2 - G.X[i], qz = p.z + dz * s / 2 - G.Z[i];
        const along = qx * fx + qz * fz, lat = Math.abs(qx * fz - qz * fx);
        if (along > -G.HALF[i] && along < reach && lat < G.R[i] + 1.5) return false;
      }
    }
    return true;
  }
  wet(x, z) {
    const W = this._wm, cx = Math.floor((x - W.x0) / W.C), cz = Math.floor((z - W.z0) / W.C);
    if (cx < 0 || cz < 0 || cx >= W.w || cz >= W.h) return false;
    const v = W.m[cz * W.w + cx];
    if (v & 4) return this.game.worldCollider.isWet(x, z);
    return (v & 3) === 1;
  }
  _buildNodeGrid() {
    const G = this.graph, C = 16, map = new Map();
    for (let i = 0; i < G.count; i++) {
      const k = (Math.floor(G.X[i] / C) + 4000) * 8000 + (Math.floor(G.Z[i] / C) + 4000);
      let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(i);
    }
    this.ngrid = map; this.NC = C;
  }
  _cellNodes(x, z) { return this.ngrid.get((Math.floor(x / this.NC) + 4000) * 8000 + (Math.floor(z / this.NC) + 4000)); }
  nearestNode(x, z, r = 24) {
    const C = this.NC, G = this.graph; let best = -1, bd = r * r;
    const cx = Math.floor(x / C), cz = Math.floor(z / C), n = Math.ceil(r / C);
    for (let dx = -n; dx <= n; dx++) for (let dz = -n; dz <= n; dz++) {
      const a = this.ngrid.get((cx + dx + 4000) * 8000 + (cz + dz + 4000)); if (!a) continue;
      for (const i of a) { const ex = G.X[i] - x, ez = G.Z[i] - z, d2 = ex * ex + ez * ez; if (d2 < bd) { bd = d2; best = i; } }
    }
    return best;
  }
  _buildZones(map, b) {
    const C = 10, w = Math.ceil((b.maxX - b.minX) / C) + 2, h = Math.ceil((b.maxZ - b.minZ) / C) + 2;
    const Zm = new Uint16Array(w * h);
    const x0 = b.minX, z0 = b.minZ;
    const seg = (ax, az, bx, bz, r, bit) => {
      const minx = Math.max(0, Math.floor((Math.min(ax, bx) - r - x0) / C)), maxx = Math.min(w - 1, Math.floor((Math.max(ax, bx) + r - x0) / C));
      const minz = Math.max(0, Math.floor((Math.min(az, bz) - r - z0) / C)), maxz = Math.min(h - 1, Math.floor((Math.max(az, bz) + r - z0) / C));
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      for (let cx = minx; cx <= maxx; cx++) for (let cz = minz; cz <= maxz; cz++) {
        const px = x0 + (cx + 0.5) * C, pz = z0 + (cz + 0.5) * C;
        let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (Math.hypot(px - ax - dx * t, pz - az - dz * t) <= r) Zm[cz * w + cx] |= bit;
      }
    };
    const line = (pts, r, bit) => { for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, bit); };
    const circle = (x, z, r, bit) => seg(x, z, x, z, r, bit);
    const poly = (P, bit, buf) => {
      let a = Infinity, bb = -Infinity, c = Infinity, d = -Infinity;
      for (const [x, z] of P) { a = Math.min(a, x); bb = Math.max(bb, x); c = Math.min(c, z); d = Math.max(d, z); }
      for (let cx = Math.max(0, Math.floor((a - x0) / C)); cx <= Math.min(w - 1, Math.floor((bb - x0) / C)); cx++)
        for (let cz = Math.max(0, Math.floor((c - z0) / C)); cz <= Math.min(h - 1, Math.floor((d - z0) / C)); cz++)
          if (pointInPoly(x0 + (cx + 0.5) * C, z0 + (cz + 0.5) * C, P)) Zm[cz * w + cx] |= bit;
      if (buf) { line(P, buf, bit); seg(P[P.length - 1][0], P[P.length - 1][1], P[0][0], P[0][1], buf, bit); }
    };
    const T = new Set(TOUR_STREETS), S = new Set(SHOP_STREETS), N = new Set(NIGHT_STREETS);
    for (const r of map.roads) {
      if (!r.name) continue;
      if (T.has(r.name)) line(r.pts, 25, Z_TOUR);
      if (S.has(r.name)) line(r.pts, 22, Z_SHOP);
      if (N.has(r.name)) line(r.pts, 25, Z_NIGHT);
    }
    for (const a of map.areas) {
      if (a.name === 'University Parks') poly(a.poly, Z_UPARKS | Z_PARK, 0);
      else if ((a.kind === 'park' || a.kind === 'meadow') && a.name) poly(a.poly, Z_PARK, 0);
      if (a.name === 'Christ Church Meadow') poly(a.poly, Z_TOUR, 0);
      if (a.name === 'Gloucester Green' || a.name === 'Bonn Square') poly(a.poly, Z_NIGHT | Z_SHOP, 15);
    }
    for (const s of map.sites || []) {
      if (s.kind === 'university') poly(s.poly, Z_COLL, 20);
      if (s.kind === 'attraction') poly(s.poly, Z_TOUR, 25);
      if (s.name === 'Christ Church') poly(s.poly, Z_TOUR, 30);
      if (s.name === 'Science Area' || s.name === 'Keble Triangle' || s.name === 'Radcliffe Observatory Quarter') poly(s.poly, Z_SCI, 25);
      if (s.name === 'Examination Schools') circle(s.c[0], s.c[1], 90, Z_EXAM);
    }
    for (const wl of map.waterlines) {
      if (wl.tunnel) continue;
      if (wl.name === 'River Thames' || wl.name === 'Isis') { line(wl.pts, 60, Z_RIVER | Z_ISIS); }
      else if (wl.kind === 'river' || wl.kind === 'canal') line(wl.pts, 35, Z_RIVER);
    }
    for (const p of map.pois) {
      if (p.kind === 'pub' || p.kind === 'bar' || p.kind === 'nightclub') circle(p.p[0], p.p[1], p.kind === 'nightclub' ? 50 : 20, p.kind === 'nightclub' ? Z_NIGHT | Z_PUB : Z_PUB);
      else if (p.kind === 'shop:supermarket' || p.kind === 'shop:department_store') circle(p.p[0], p.p[1], 40, Z_SHOP);
      else if (p.kind === 'fast_food') circle(p.p[0], p.p[1], 15, Z_PUB);
    }
    this._zm = { Zm, w, h, C, x0, z0 };
  }
  zone(x, z) {
    const Z = this._zm, cx = Math.floor((x - Z.x0) / Z.C), cz = Math.floor((z - Z.z0) / Z.C);
    return cx < 0 || cz < 0 || cx >= Z.w || cz >= Z.h ? 0 : Z.Zm[cz * Z.w + cx];
  }
  _buildBenches(map) {
    const C = 16, g = new Map(), list = [];
    for (const p of map.pois) {
      if (p.kind !== 'bench') continue;
      if (this.wet(p.p[0], p.p[1])) continue;
      const i = list.length; list.push({ x: p.p[0], z: p.p[1], busy: false });
      const k = (Math.floor(p.p[0] / C) + 4000) * 8000 + Math.floor(p.p[1] / C) + 4000;
      let a = g.get(k); if (!a) g.set(k, (a = [])); a.push(i);
    }
    this.benches = list; this.bgrid = g;
  }
  _benchNear(x, z, r) {
    const C = 16, cx = Math.floor(x / C), cz = Math.floor(z / C);
    let best = null, bd = r * r;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const a = this.bgrid.get((cx + dx + 4000) * 8000 + cz + dz + 4000); if (!a) continue;
      for (const i of a) { const bn = this.benches[i]; if (bn.busy) continue; const d2 = (bn.x - x) ** 2 + (bn.z - z) ** 2; if (d2 < bd) { bd = d2; best = bn; } }
    }
    return best;
  }
  _buildPorterGates(map, col) {
    const sites = (map.sites || []).filter((s) => s.kind === 'university');
    const out = [];
    const re = /lodge|main gate|tom gate|great gate|porter/i;
    for (const g of map.gates) {
      if (g.kind !== 'gate' && g.kind !== 'entrance') continue;
      if (!(g.entrance === 'main' || (g.name && re.test(g.name)))) continue;
      const [x, z] = g.p;
      let site = null;
      for (const s of sites) { if (pointInPoly(x, z, s.poly)) { site = s; break; } }
      if (!site) for (const s of sites) { if (Math.hypot(s.c[0] - x, s.c[1] - z) < 120) { let close = false; for (const q of s.poly) if (Math.hypot(q[0] - x, q[1] - z) < 12) { close = true; break; } if (close) { site = s; break; } } }
      if (!site) continue;
      let dx = x - site.c[0], dz = z - site.c[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      let px = x + dx * 1.3, pz = z + dz * 1.3;
      if (!col.isFree(px, pz, 0.3)) { const q = { x: px, z: pz }; col.resolve(q, 0.35); px = q.x; pz = q.z; }
      if (this.wet(px, pz) || out.some((o) => Math.hypot(o.x - px, o.z - pz) < 30)) continue;
      out.push({ x: px, z: pz, h: Math.atan2(dx, dz), site: site.name, ped: null });
    }
    this.porterGates = out;
  }
  _makeMessMesh() {
    const g = new THREE.IcosahedronGeometry(0.045, 0);
    const n = g.attributes.position.count, c = new Float32Array(n * 3), col = new THREE.Color(0x4a3018);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.scale(1.4, 0.6, 1);
    this.messMesh = new THREE.InstancedMesh(g, characterMaterial, 24);
    this.messMesh.count = 0; this.messMesh.frustumCulled = false; this.messMesh.name = 'dog-mess';
    this._messIdx = 0; this._m4 = new THREE.Matrix4();
    this.game.worldScene.add(this.messMesh);
  }
  _addMess(x, z) {
    const t = this.game.time && this.game.time.now ? this.game.time.now() : Date.now();
    const i = this._messIdx; this._messIdx = (i + 1) % 24;
    if (this.messes.length < 24) this.messes.push({ x, z, t }); else { this.messes[i].x = x; this.messes[i].z = z; this.messes[i].t = t; }
    this._m4.makeRotationY(Math.random() * TAU).setPosition(x, 0.02, z);
    this.messMesh.setMatrixAt(i, this._m4); this.messMesh.instanceMatrix.needsUpdate = true;
    this.messMesh.count = Math.max(this.messMesh.count, i + 1);
  }

  // ---------------------------------------------------------------- records
  _record() {
    const p = {
      x: 0, z: 0, y: 0, heading: 0, character: null, active: false, scripted: false, place: 'world', scene: null, role: '', state: 'idle',
      speed: 0, vmax: 1.3, timer: 0, a: -1, b: -1, lat: 0, latBase: 0, latT: 0, dodgeT: 0, px: 0, pz: 0, tx: 0, tz: 0,
      partner: null, leader: null, ox: 0, oz: 0, dog: null, leash: null, dogX: 0, dogZ: 0, dogH: 0, dogState: 'follow', dogT: 0, dogSpeed: 0, messT: 0,
      bench: null, homeX: 0, homeZ: 0, homeH: 0, basePose: 'stand', static: false, wander: null, lines: null, sayCd: 0, vx: 0, vz: 0, down: false,
      knockT: 0, drunk: false, pause: 0.05, benchP: 0, yT: 0, gy: 0, gx: 0, gz: 0, gpl: null, anim: true, poolIdx: -1, porterGate: null, knockable: true, label: null,
      // multiplayer (systems/crowdsync.js): remote = a proxy of someone else's ped; look recipe so only the seed is sent
      remote: false, nid: 0, ngen: 0, npin: false, nsent: 0, nclaim: 0, nfollow: false, lookSeed: 0, lookKind: -1, lookHour: 12, sid: 0,
      // motion pass: waiting at the kerb for traffic (timer, re-check timer)
      child: false, kit: null, waitT: 0, asideT: 0, asideH: 0, orphanT: 0, handSide: 0, dogLoose: 0, dogBarkT: 0, dogTie: null, dogMarkT: 0,
      kerbT: 0, kerbChk: 0, kerbOk: false, freeB: 0, roadT: 0, roadA: false, sepT: 0, stallD: 1e9, stallT: 0, slotT: 0, fRoad: 0, animDt: 0, rdX: 1e9, rdZ: 1e9, rdV: false, obsT: 0, bumpT: 0, hopT: 0, hopVx: 0, hopVz: 0,
      // solid to players (systems/_ped_solid.js): pressed by our player this frame (how fast, the player's speed), for how
      // long; a step aside taken for a player; clock-driven people's offset from where the clock has them; a far-crowd
      // figure's stand-in (cm: its member; cx.. where the clock has it; veil: not drawn yet, the figure is fading in)
      pressV: 0, pressS: 0, pressT: 0, yieldT: 0, hopSoft: false, stepped: false, clock: false, offX: 0, offZ: 0, cm: null, cx: 0, cz: 0, chx: 0, chz: 1, cF: 0, veil: false,
    };
    p.knock = (vx, vz, mass) => this.knock(p, vx, vz, null, mass);
    return p;
  }

  /** lk/ls: how the look was made (see lookOf) and its seed, so multiplayer can send just that; -1 = not reproducible */
  _activate(p, role, look, x, z, heading, scene, lk = -1, ls = 0) {
    p.role = role; p.x = x; p.z = z; p.y = 0; p.heading = heading; p.active = true; p.down = false; p.speed = 0; p.vx = p.vz = 0; p.freeB = 0;
    p.gpl = null; p.y = p.gy = this._gh(p); p.gx = x; p.gz = z;                // stand on the drawn surface from the first frame
    p.lookKind = lk; p.lookSeed = ls; p.lookHour = Math.floor(this.game.time ? this.game.time.hour : 12); p.remote = false; p.nfollow = false; p.pid = 0; p.nlead = 0;
    p.det = false; p.sid = 0; p.wk = undefined; p.lineS = undefined; p.fin = 1; p.dogF = -1; p.kitF = -1;
    p.pressV = 0; p.pressS = 0; p.pressT = 0; p.yieldT = 0; p.hopT = 0; p.hopSoft = false; p.stepped = false; p.clock = false; p.offX = 0; p.offZ = 0; p.cm = null; p.veil = false;
    p.character = createCharacter(look); p.look = look;
    this._wrapSay(p);
    const R = ROLES[role] || ROLES.townie;
    p.vmax = rand(R.spd[0], R.spd[1]); p.pause = R.pause || 0; p.benchP = R.bench || 0;
    p.lines = LINES[R.lines] || LINES.townie;
    // a child: never knocked over, never anything but an ordinary sober walker, its lines its own (bubbles: no grown-up's voice)
    p.child = isChildRole(role); p.knockable = !p.child; p.waitT = 0; p.asideT = 0; p.orphanT = 0; p.handSide = 0; p.kit = null;
    if (p.child) { p.lines = CHILD_LINES[role] || null; p.character.voiceAs = false; }
    p.drunk = !p.child && !GUARD_ROLES[role] && !!(R.drunk && Math.random() < R.drunk);
    p.basePose = p.drunk ? 'drunk' : 'stand';
    p.character.setPose(p.basePose); p.character.blend = 1;
    p.sayCd = rand(4, 20); p.lat = p.latBase = p.latT = rand(-0.55, 0.55); p.dodgeT = 0;
    p.partner = null; p.leader = null; p.bench = null; p.timer = 0; p.knockT = 0; p.yT = Math.random() * 0.3; p.anim = true; p.ctl = null;
    p.scene = scene || this.game.worldScene;
    p.scene.add(p.character.group);
    // blob shadow while beyond the shadow map (world/blobs.js; skipped automatically indoors / when hidden)
    try { p.blob = this.game.world && this.game.world.blobShadow ? this.game.world.blobShadow(p.character.group, 0.38) : null; } catch (e) { p.blob = null; }
    // a parent whose seed says so pushes a pushchair (from the seed: the same for every player)
    if (role === 'parent' && lk === 0) {
      const F = familyOf(ls);
      if (F.pram) { p.kit = createPushchair(ls); p.scene.add(p.kit); p.character.pushing = true; }       // both hands on the handle
      else if (F.kids[0] === 'toddler') { p.character.reach = 1; p.character.reachUp = 0.34; p.handSide = 1; }      // a hand held down and out to the toddler on their left
    } else if (role === 'toddler' && lk === 0) { p.character.reach = -1; p.character.reachUp = 2.05; p.handSide = -1; }      // …who reaches up to it
    this._sync(p);
  }

  /** whatever a synced ped says (whoever makes it speak: this file, police, jobs, traffic) shows on the other clients too */
  _wrapSay(p) {
    const ch = p.character; if (!ch) return;
    ch._csRec = p;                                    // (a character handed between records keeps one wrapper)
    if (ch._csSay) return;
    const say0 = ch.say; ch._csSay = true;
    ch.say = (text, secs) => { const r = say0.call(ch, text, secs), q = ch._csRec; if (q && q.nid && !q.remote && this.sync) this.sync.core.said(q, text, secs); return r; };
  }
  /** game.crowdsync when someone else is in the world with us, else null */
  _mp() { const s = this.sync || (this.sync = this.game.crowdsync || null); return s && s.active ? s : null; }

  _deactivate(p) {
    if (!p.active) return;
    if (p.nid && this.sync) this.sync.core.removed(p);
    p.active = false; p.ctl = null;
    if (p.visit) { p.visit.dw.n = Math.max(0, p.visit.dw.n - 1); p.visit = null; p.vx = p.vz = 0; if (p.character) p.character.noLod = false; }
    p.place = 'world';
    if (p.bench) { p.bench.busy = false; p.bench = null; }
    if (p.partner) { const q = p.partner; q.partner = null; if (q.state === 'chat') this._resume(q); p.partner = null; }
    if (p.porterGate) { p.porterGate.ped = null; p.porterGate = null; }
    if (p.blob) { p.blob.remove(); p.blob = null; }
    if (p.character) { p.character.group.removeFromParent(); p.character.dispose(); p.character = null; }
    if (p.dog) { p.dog.group.removeFromParent(); p.dog.dispose(); p.dog = null; }
    if (p.leash) { p.leash.removeFromParent(); p.leash.geometry.dispose(); p.leash = null; }
    if (p.kit) { p.kit.removeFromParent(); p.kit = null; }
    p.dogTie = null; p.dogLoose = 0; this._tieOver(p); p.tiedProxy = false;
    // (a child is never left without its adult: it goes when they go, unless another of its adults is beside it)
    for (const q of this.list) if (q.active && q.leader === p) { q.leader = null; if (q.child && needsAdult(q.role)) { if (q.remote || !this._adopt(q)) { if (!q.remote) this._deactivate(q); } } else if (!q.remote) this._resume(q); }
    for (let i = this._queue.length - 1; i >= 0; i--) if (this._queue[i].lead === p) this._queue.splice(i, 1);
    p.state = 'idle';
  }

  /** Height of the drawn ground under a ped (the world's surface outdoors, the current place's floor indoors). */
  /** is `place` a walk-in room that is being shown (core/interiors.js)? */
  _roomShown(place) { const I = this.game.interiors, d = I && I.get ? I.get(place) : null; return !!(d && d.sl && d.sl.shown); }
  _gh(p) {
    const g = this.game;
    let h;
    if (p.place === 'world' || !p.place) h = g.world && g.world.groundHeight ? g.world.groundHeight(p.x, p.z) : 0;
    else if (g.player && g.player.place === p.place && g.groundHeight) h = g.groundHeight(p.x, p.z);       // an interior's floor is only known while it is the current place
    else return p.y || 0;
    return h === h && Number.isFinite(h) ? h : 0;
  }

  /** How much of somebody is drawn, dPl m from the player: whole within FADE_FAR, thinning to nothing at SHOW_FAR; one
   *  made where they might be seen comes in over FADE_IN_S (p.fin); the dog and the pushchair with them. */
  _show(p, dPl, dt) {
    let al = dPl >= SHOW_FAR ? 0 : dPl > FADE_FAR ? (SHOW_FAR - dPl) / (SHOW_FAR - FADE_FAR) : 1;
    if (p.fin < 1) { p.fin = Math.min(1, p.fin + dt / (dPl >= FADE_FAR - 12 ? FADE_IN_FAR_S : FADE_IN_S)); if (p.fin < al) al = p.fin; }
    const show = al > 0.03, ch = p.character;
    ch.group.visible = show && !p.tiedProxy && !p.veil;
    if (show) ch.setFade(al);
    if (p.kit) { if (p.kit.visible !== show) p.kit.visible = show; if (show) p.kitF = fadeMeshes(p.kit, al, p.kitF); }
    if (p.dog) { const dg = p.dog.group; if (dg.visible !== show) dg.visible = show; if (show) { p.dogF = fadeMeshes(dg, al, p.dogF); dg.userData.fade = al; } if (p.leash && !show && p.leash.visible) p.leash.visible = false; }
  }
  /** somebody just made out of doors: drawn as their distance has it from this frame on (the frame's own pass over the
   *  people may already be over - a place module's update comes after ours - and a new figure is visible by default) */
  _showNew(p) { const V = this._vw; if (V && !V.none && p.place === 'world' && p.character) this._show(p, Math.hypot(p.x - V.px, p.z - V.pz), 0); }
  _sync(p) {
    const g = p.character.group;
    g.position.set(p.x, p.y, p.z); if (g.rotation.y !== p.heading) g.rotation.y = p.heading;   // (an Euler write recomputes the quaternion)
  }

  // ---------------------------------------------------------------- spawning
  /** busy-streets pass: extra walkers wanted round p by day in the centre's shopping / sightseeing streets (medium and
   *  high tiers only; the far crowd is systems/crowd.js). Re-worked out once a second. Sets this._coreBias. */
  _boost(p) {
    if (!BUSY) return 0;
    if ((this._boostT = (this._boostT || 0) - 1) > 0) return this._boostN;
    this._boostT = 60;
    const q = this.game.quality, tier = busyTier((q && q.level) || 'low'), B = CORE_BOX;
    const inCore = p.x > B.minX - 40 && p.x < B.maxX + 40 && p.z > B.minZ - 40 && p.z < B.maxZ + 40 && (this.zone(p.x, p.z) & (Z_SHOP | Z_TOUR)) !== 0;
    this._coreBias = inCore && busyHour(this._hour) > 0.3;
    this._boostN = inCore ? Math.round(tier.near * busyHour(this._hour)) : 0;
    this._nearMin = tier.nearMin;
    return this._boostN;
  }
  /** the camera's place and reach for this frame (_unseen): V.none = the street is not being drawn at all (the player is
   *  in a room of its own scene); V.all = no "behind the camera" (a walk-in room, a camera looking straight down) */
  _sight(pl, pp, walkIn) {
    const V = this._vw || (this._vw = { cx: 0, cz: 0, fx: 0, fz: 1, cosH: 2, all: true, none: false, px: 0, pz: 0 });
    const cam = this.game.camera;
    // (no camera at all - a headless test: nobody is looking, as before the rule)
    V.px = pp.x; V.pz = pp.z; V.none = !cam || (pl.place !== 'world' && !walkIn); V.all = true; V.cx = pp.x; V.cz = pp.z;
    if (V.none || walkIn) return V;
    const f = this._fwd, l = Math.hypot(f.x, f.z);
    V.cx = cam.position.x; V.cz = cam.position.z;
    if (l < 0.25) return V;
    // (half the picture's width as an angle, and 12 degrees over: somebody just off the edge is a step from being in it)
    V.all = false; V.fx = f.x / l; V.fz = f.z / l; V.cosH = Math.cos(Math.min(3, Math.atan(Math.tan(cam.fov * Math.PI / 360) * (cam.aspect || 1.78)) + 0.21));
    return V;
  }
  /** Would somebody at (x, z) be out of every player's sight right now? Out of the camera's picture (by a margin), or
   *  with a building between them and both the camera and the player (the camera swings about the player). Multiplayer:
   *  the other players' cameras are not known - there, a building between, or further off than they are drawn whole. */
  _unseen(x, z) { return this._unseenMe(x, z) && this._unseenOthers(x, z); }
  _unseenMe(x, z) {
    const V = this._vw, col = this.game.worldCollider;
    if (!V || V.none) return true;
    const dx = x - V.cx, dz = z - V.cz, d = Math.hypot(dx, dz);
    if (!V.all && d > 3 && (dx * V.fx + dz * V.fz) / d < V.cosH) return true;
    return col.sightBlocked(V.cx, V.cz, x, z) && (V.all || col.sightBlocked(V.px, V.pz, x, z));
  }
  _unseenOthers(x, z) {
    const R = this._remF, col = this.game.worldCollider;
    if (R) for (let k = 0; k < R.length; k++) { const q = R[k], d2 = (q.x - x) * (q.x - x) + (q.z - z) * (q.z - z); if (d2 < FADE_FAR * FADE_FAR && !col.sightBlocked(q.x, q.z, x, z)) return false; }
    return true;
  }
  /** as _unseen, or too far off to be drawn at all yet */
  _unseenOrFar(x, z) { const V = this._vw; return (V && !V.none && Math.hypot(x - V.px, z - V.pz) >= SHOW_FAR ? true : this._unseenMe(x, z)) && this._unseenOthers(x, z); }
  _free() { const A = this.amb; for (let i = 0; i < A.length; i++) if (!A[i].active) return A[i]; return null; }
  _activeCount() { const A = this.amb; let n = 0; for (let i = 0; i < A.length; i++) if (A[i].active && !A[i].child) n++; return n; }
  /** multiplayer: room for one crowd per player whose surroundings we own (max 3 x POOL records; never shrinks) */
  _grow(n) { while (this.amb.length < n) { const p = this._record(); p.poolIdx = this.pool.length; this.pool.push(p); this.list.push(p); this.amb.push(p); } }

  _pickRole(z, h) {
    const w = roleWeights(z, h, this.weights);
    let tot = 0; for (const r of ROLE_NAMES) tot += w[r];
    if (tot <= 0) return 'townie';
    let x = Math.random() * tot;
    for (const r of ROLE_NAMES) { x -= w[r]; if (x <= 0) return r; }
    return 'townie';
  }

  /** F (multiplayer): spawn around this player instead of ours ({x, z, me}) */
  _trySpawn(minD, h, F = null) {
    const G = this.graph, me = !F || F.me, pl = me ? this.game.player.pos : F, cam = this.game.camera, S = F ? this._mp() : null;
    if (!G.count) return false;
    if (!this._vw) this._sight(this.game.player, this.game.player.pos, false);      // (called before the first frame: a test)
    const arrive = minD < SPAWN_MIN_BEHIND;      // (the burst on arriving somewhere: anywhere from 8 m, each fading in)
    const pv = this._pv, moving = me && pv && pv.s > 0.8;      // (walking counts: on a straight street the far edge ahead is the only place in front of a walker where somebody can be made)
    for (let attempt = 0; attempt < 8; attempt++) {
      // where: all round, or - more often when the player is on the move, and ahead of them then - at the far edge,
      // beyond where people are drawn whole: those are the ones the player is about to meet
      const far = !arrive && Math.random() < (moving ? (pv.s > 2.5 ? 0.62 : 0.5) : 0.3);
      const ang = far && moving ? Math.atan2(pv.x, pv.z) + (Math.random() - 0.5) * 2.4 : Math.random() * TAU;
      const d = far ? FADE_FAR + 2 + Math.random() * (SPAWN_FAR - FADE_FAR - (moving ? 2 : 5)) : minD + Math.random() * (SPAWN_MAX - minD);
      const sx = pl.x + Math.sin(ang) * d, sz = pl.z + Math.cos(ang) * d;
      const cell = this._cellNodes(sx, sz);
      if (!cell) continue;
      const n = cell[(Math.random() * cell.length) | 0];
      const x = G.X[n], z = G.Z[n];
      const dd = Math.hypot(x - pl.x, z - pl.z);
      if (dd > SPAWN_FAR || dd < Math.min(minD, SPAWN_MIN_BEHIND)) continue;
      if (!arrive) {
        // nearer than people are drawn whole: only where no player can see the spot (behind the camera, a side street, a
        // passage, round a corner); further off they fade in with the distance. The same for every other player's eyes,
        // and for our own when the walker is made for another player's street (`!me`).
        const V = this._vw;
        if (me) {
          if (dd < FADE_FAR) {
            // (closer than 45 m only behind the camera - or, in the centre by day, from 22 m where a building hides the spot)
            if (dd < SPAWN_MIN && !V.none && !(!V.all && this._behind(x, z)) && !(this._coreBias && dd >= this._nearMin)) continue;
            if (!this._unseenMe(x, z)) continue;
          }
          if (!this._unseenOthers(x, z)) continue;
        } else {
          if (!this._unseenOthers(x, z)) continue;
          if (Math.hypot(x - V.px, z - V.pz) < FADE_FAR && !this._unseenMe(x, z)) continue;
        }
      }
      // multiplayer: never in front of another player, and only where we are the owner-to-be (one crowd per street)
      if (S && (!S.core.spawnOk(x, z) || (minD >= SPAWN_MIN_BEHIND && S.core.nearestRemoteD(x, z) < SPAWN_MIN) || (!me && Math.hypot(x - this.game.player.pos.x, z - this.game.player.pos.z) < SPAWN_MIN_BEHIND))) continue;
      // (not on top of a parked car: the walk graph was built before the cars were parked in the car parks)
      const V = this.game.vehicles;
      if (V && V.nearest && V.nearest(x, z, 0.6, (q) => q.type !== 'stand' && q.kind !== 'bike' && q.type && !/^bike/.test(q.type))) continue;
      const zf = this.zone(x, z);
      // (busy-streets pass: in the centre by day, half the spawns that would land off the shopping / sightseeing streets
      // try again, so the walkers gather where the crowd is)
      if (this._coreBias && me && attempt < 6 && !(zf & (Z_SHOP | Z_TOUR)) && Math.random() < 0.5) continue;
      let role = this._pickRole(zf, h);
      // (families, school parties and pupils: never made in Frewin Court; and no more than a few groups about at once)
      if ((GUARD_ROLES[role] || role === 'teen') && (noGo(x, z, 6) || this._kidGroups() >= (role === 'teacher' ? 1 : 4))) role = 'townie';
      this._spawnGroup(role, n, far ? pl : null, arrive || dd >= FADE_FAR ? 0 : 1);
      return true;
    }
    return false;
  }
  /** behind the camera (outside its picture by the margin of _sight) */
  _behind(x, z) { const V = this._vw, dx = x - V.cx, dz = z - V.cz, d = Math.hypot(dx, dz) || 1; return (dx * V.fx + dz * V.fz) / d < V.cosH; }

  /** toward: {x, z} - set off along the way that leads there (somebody made at the far edge walks in, not out again);
   *  fin: 0 = fades in (made where it might be seen: the arrival burst, FADE_IN_S; at the far edge, FADE_IN_FAR_S on top
   *  of the fade with the distance), 1 = there at once (made out of sight) */
  _spawnGroup(role, n, toward = null, fin = 1) {
    const G = this.graph, R = ROLES[role];
    const lead = this._free(); if (!lead) return;
    const s0 = G.start[n], s1 = G.start[n + 1];
    let next = s1 > s0 ? G.nbr[s0 + ((Math.random() * (s1 - s0)) | 0)] : n;
    if (toward && s1 > s0 + 1) { let bd = 1e18; for (let k = s0; k < s1; k++) { const m = G.nbr[k], dd = (G.X[m] - toward.x) * (G.X[m] - toward.x) + (G.Z[m] - toward.z) * (G.Z[m] - toward.z); if (dd < bd) { bd = dd; next = m; } } }
    const h = Math.atan2(G.X[next] - G.X[n], G.Z[next] - G.Z[n]) || 0;
    { const sd = newSeed(), st = this.lanes.start({ lookKind: 0, lookSeed: sd }, n, next); this._activate(lead, role, lookFor(role, sd), st ? st.x : G.X[n], st ? st.z : G.Z[n], h, null, 0, sd); }      // (in its own lane across the street from the start)
    lead.state = 'walk'; lead.a = n; lead.b = next; this._edgeTarget(lead); lead.fin = fin;
    if (role === 'dogwalker') this._addDog(lead);
    if (role === 'parent') {
      // a family: the children its seed gives it - the first toddler by the hand, the others at the parent's side
      const F = familyOf(lead.lookSeed); let side = 0; this.kidStats.families++;
      F.kids.forEach((kr, i) => { const hand = kr === 'toddler' && !F.pram; this._queue.push({ lead, role: kr, i: i + 1, slot: hand ? HAND_SLOT : SIDE_SLOTS[side++ % SIDE_SLOTS.length], hand }); });
      if (F.pram) lead.vmax = Math.min(lead.vmax, 0.98);
      return;
    }
    if (role === 'teacher') {
      { let free = 0; for (const q of this.amb) if (!q.active) free++; if (free < partyOf(lead.lookSeed).pupils + 1) return; }      // (no room for the party: a teacher on the way to school)
      // a school party: the pupils two by two behind the teacher, another grown-up at the back
      const P = partyOf(lead.lookSeed); this.kidStats.parties++;
      for (let i = 0; i < P.pupils; i++) this._queue.push({ lead, role: 'pupil', i: i + 1, slot: pairSlot(i) });
      if (P.rear) this._queue.push({ lead, role: 'teacher', i: P.pupils + 1, slot: [0, pairSlot(P.pupils + 1)[1] + 0.2] });
      return;
    }
    let size = 1;
    if (R.group) size = R.group[0] + ((Math.random() * (R.group[1] - R.group[0] + 1)) | 0);
    else if ((role === 'student' || role === 'tourist' || role === 'townie' || role === 'nightowl') && Math.random() < 0.18) size = 2;
    for (let i = 1; i < size; i++) this._queue.push({ lead, role, i });
  }
  /** has this adult children with them (following, or in the pushchair)? Nobody takes them away from them. */
  _hasKids(p) {
    if (!GUARD_ROLES[p.role]) return false; if (p.kit) return true;
    // (multiplayer: a proxy has no `leader` link — the child's record names its adult by sync id (nlead), and the adult is
    // known by its own id: pid as somebody else's proxy, nid as ours. Without this a player could knock over the proxy of
    // a parent whose child was at its side)
    const id = p.remote ? p.pid : p.nid;
    for (const q of this.list) if (q.active && q.child && (q.leader === p || (id && q.remote && q.nlead === id))) return true;
    return false;
  }
  /** how many families / school parties / groups of pupils are about (their leaders) */
  _kidGroups() { let n = 0; const A = this.amb; for (let i = 0; i < A.length; i++) { const p = A[i]; if (p.active && !p.leader && (GUARD_ROLES[p.role] || p.role === 'teen')) n++; } return n; }
  /** a child whose adult has gone: another of its adults within a few steps takes it on (a school party's second
   *  grown-up; in multiplayer the same parent in its new record); false: there is none */
  _adopt(q) {
    let best = null, bd = 7 * 7;
    for (const g of this.list) { if (!g.active || g === q || !GUARD_ROLES[g.role] || g.down || g.place !== q.place) continue; const d = (g.x - q.x) ** 2 + (g.z - q.z) ** 2; if (d < bd) { bd = d; best = g; } }
    if (!best) return false;
    q.leader = best; q.state = 'follow'; q.orphanT = 0;
    if (!(Math.abs(q.ox) + Math.abs(q.oz) > 0.1)) { q.ox = 0.5; q.oz = 0.5; }
    return true;
  }

  /** Create one queued group member next to its leader (spreads character creation over frames). */
  _spawnFollower(q) {
    const lead = q.lead;
    if (!lead.active || lead.down || lead.state === 'idle') return;
    const f = this._free(); if (!f) return;
    const OFF = [[0.75, 0.45], [-0.75, 0.45], [0, 1.2], [0.8, 1.5], [-0.8, 1.5]];
    const [ox, oz] = q.slot || OFF[(q.i - 1) % OFF.length], h = lead.heading;
    const kid = isChildRole(q.role);
    if (kid && (!mayAppear(this._hour) && q.role !== 'teen')) return;
    let x = lead.x + Math.cos(h) * ox - Math.sin(h) * oz, z = lead.z - Math.sin(h) * ox - Math.cos(h) * oz;
    if (this.wet(x, z) || !this.game.worldCollider.isFree(x, z, 0.25) || this.game.worldCollider.raycast(lead.x, lead.z, x, z) !== null) { x = lead.x - Math.sin(h) * 0.6; z = lead.z - Math.cos(h) * 0.6; if (this.wet(x, z) || this.game.worldCollider.raycast(lead.x, lead.z, x, z) !== null) { x = lead.x; z = lead.z; } }
    // (a child's seed carries its school - the leader's - so a party, or a group of pupils, wears one school's colours)
    { let sd = newSeed(); if (kid) { const sc = lead.child ? lead.lookSeed % SCHOOLS.length : schoolOf(lead.lookSeed); sd = sd - (sd % SCHOOLS.length) + sc; } this._activate(f, q.role, lookFor(q.role, sd), x, z, h, null, 0, sd); }
    f.vmax = lead.vmax; f.drunk = kid || GUARD_ROLES[q.role] ? false : q.role === 'clubber' ? Math.random() < 0.6 : lead.drunk; f.basePose = f.drunk ? 'drunk' : 'stand'; f.character.setPose(f.basePose);
    f.leader = lead; f.ox = ox; f.oz = oz; f.state = 'follow';
    // (made a frame or more after its leader: unseen where the leader still is, else it fades in beside them)
    f.fin = lead.fin < 1 ? lead.fin : !this._vw || this._unseen(x, z) || Math.hypot(x - this._vw.px, z - this._vw.pz) >= FADE_FAR ? 1 : 0;
    // (hand in hand: the toddler on the parent's left, reaching up; the parent's hand held down to it - set from the seeds in _activate)
  }

  _addDog(p) {
    const dog = createTownDog({ seed: p.lookKind >= 0 ? (p.lookSeed * 7 + 13) % 1000000007 : newSeed() });     // from the owner's seed: the same dog for everyone (a dozen breeds: _ped_pets.js)
    p.dogLoose = 0; p.dogBarkT = rand(8, 30); p.dogTie = null; p.dogMarkT = rand(10, 40);
    p.dog = dog; p.dogX = p.x + Math.cos(p.heading) * 0.8; p.dogZ = p.z - Math.sin(p.heading) * 0.8; p.dogH = p.heading; p.dogState = 'follow'; p.dogT = rand(4, 10); p.messT = rand(25, 70);
    if (this.wet(p.dogX, p.dogZ)) { p.dogX = p.x; p.dogZ = p.z; }
    p.character.leftHand = 'lead';
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    p.leash = new THREE.Line(geo, this.leashMat); p.leash.frustumCulled = false;
    p.scene.add(dog.group); p.scene.add(p.leash);
  }

  _spawnPorter(g) {
    let p = null;
    for (let i = POOL; i < POOL + PORTERS; i++) if (!this.pool[i].active) { p = this.pool[i]; break; }
    if (!p) return;
    // the same porter at the same gate for everyone (seeded by the gate and the day): deterministic, not synced
    const seed = (Math.round(g.x * 7 + g.z * 13) * 31 + (this.game.time ? Math.floor(this.game.time.now() / 86400000) : 0)) | 0;
    this._activate(p, 'porter', lookFor('porter', seed), g.x, g.z, g.h);
    p.det = true; p.sid = (seed >>> 0) || 1;
    p.state = 'post'; p.homeX = g.x; p.homeZ = g.z; p.homeH = g.h; p.static = true; p.porterGate = g; g.ped = p;
    p.fin = 0; this._showNew(p);      // (the gate is looked at once a second, so he may already be nearer than the far fade: he comes in over a second or so)
  }

  // ---------------------------------------------------------------- walking
  _edgeTarget(p) {
    const G = this.graph, a = p.a, b = p.b;
    let dx = G.X[b] - G.X[a], dz = G.Z[b] - G.Z[a]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    p.px = dz; p.pz = -dx;   // perpendicular (right-hand side of travel)
    // its own line across the width of the street at the next node (_ped_lanes.js: from its seed, so the same on every
    // client; a group's leader half a metre further from the edges): the walk there is a straight line from here
    p.lat = p.latT = p.latBase = this.lanes.pick(p, a, b, p.x, p.z, GUARD_ROLES[p.role] || p.dog || p.kit || (ROLES[p.role] && ROLES[p.role].group) ? 0.5 : 0); p.dodgeT = 0;
    p.tx = G.X[b] + p.px * p.lat; p.tz = G.Z[b] + p.pz * p.lat;
    if (p.lat !== 0 && this.wet(p.tx, p.tz)) { p.lat = p.latT = 0; p.tx = G.X[b]; p.tz = G.Z[b]; }
  }

  _arrive(p) {
    const G = this.graph, b = p.b, h = this._hour;
    // pause, bench, or carry on
    if (p.pause > 0 && Math.random() < p.pause * 0.35 && !(p.place === 'world' && this.road(p.x, p.z, 1.5))) {
      p.state = 'pause'; p.timer = rand(3, 10); p.speed = 0;
      const prop = p.look.prop;
      if (p.role === 'tourist' && (prop === 'camera' || p.look.camera) && Math.random() < 0.6) p.character.setPose('photo');
      else if (Math.random() < 0.15 && !p.drunk) p.character.setPose('phone');
      return;
    }
    if (p.benchP > 0 && h > 7.5 && h < 20 && !this._isGroup(p) && Math.random() < p.benchP) {
      const bn = this._benchNear(G.X[b], G.Z[b], 12);
      if (bn && this.game.worldCollider.raycast(p.x, p.z, bn.x, bn.z) === null && !this._wetLine(p.x, p.z, bn.x, bn.z)) {
        bn.busy = true; p.bench = bn; p.state = 'toBench'; p.tx = bn.x; p.tz = bn.z; p.stallD = 1e9; p.stallT = 0; return;
      }
    }
    const s0 = G.start[b], s1 = G.start[b + 1], deg = s1 - s0;
    let next = p.a;
    if (deg > 1) {
      // prefer going roughly straight on
      const hx = G.X[b] - G.X[p.a], hz = G.Z[b] - G.Z[p.a], hl = Math.hypot(hx, hz) || 1;
      let tot = 0;
      for (let i = s0; i < s1; i++) { const n = G.nbr[i]; if (n === p.a) continue; const dx = G.X[n] - G.X[b], dz = G.Z[n] - G.Z[b], dl = Math.hypot(dx, dz) || 1; tot += 0.25 + Math.max(0, (dx * hx + dz * hz) / (dl * hl)); }
      let x = Math.random() * tot;
      for (let i = s0; i < s1; i++) { const n = G.nbr[i]; if (n === p.a) continue; const dx = G.X[n] - G.X[b], dz = G.Z[n] - G.Z[b], dl = Math.hypot(dx, dz) || 1; x -= 0.25 + Math.max(0, (dx * hx + dz * hz) / (dl * hl)); next = n; if (x <= 0) break; }
    } else if (deg === 1) next = G.nbr[s0];
    if ((GUARD_ROLES[p.role] || p.child) && noGo(G.X[next], G.Z[next], 3)) {
      // (Frewin Court: not with children. Another way on, else back the way they came)
      let alt = p.a;
      for (let i = s0; i < s1; i++) { const n = G.nbr[i]; if (n !== p.a && !noGo(G.X[n], G.Z[n], 3)) { alt = n; break; } }
      next = alt;
    }
    p.a = b; p.b = next;
    this._edgeTarget(p);
  }

  _isGroup(p) { if (p.leader) return true; for (const q of this.pool) if (q.active && q.leader === p) return true; return false; }
  _wetLine(x1, z1, x2, z2) { const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 3)); for (let i = 1; i <= n; i++) if (this.wet(x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n)) return true; return false; }

  _resume(p) {
    if (p.cm) { p.character.setPose('stand'); p.state = 'crowd'; p.offX = 0; p.offZ = 0; return; }      // (a far-crowd stand-in: back to its line)
    if (p.scripted || p.role === 'porter') { p.character.setPose(p.drunk ? 'drunk' : 'stand'); p.state = 'return'; return; }
    p.character.setPose(p.basePose);
    if (p.leader && p.leader.active) { p.state = 'follow'; return; }
    p.leader = null;
    if (p.child && needsAdult(p.role)) { if (!this._adopt(p)) { this.kidStats.orphans++; this._deactivate(p); } return; }
    let n = this.nearestNode(p.x, p.z, 30);
    // (getting up in the middle of a wide road or a car park, further than that from any pavement — a driver pulled out
    // of their car there used to vanish as they stood up: they make for the nearest pavement, however far, up to 120 m)
    if (n < 0) n = this.nearestNode(p.x, p.z, 120);
    if (n < 0) { this._deactivate(p); return; }
    const G = this.graph, s0 = G.start[n], s1 = G.start[n + 1];
    p.a = s1 > s0 ? G.nbr[s0] : n; p.b = n; p.state = 'walk'; p.lat = p.latT = p.latBase;
    this._edgeTarget(p);
  }

  /** Move p toward (tx,tz) at speed v; returns remaining distance. Rejects steps into water. */
  /** The walls a walker is held by: the world's, or those of the room it is in — the ROOM's own collider whether or not
   *  the player is in that room (2026-11 pass-through pass: it was `game.collider`, i.e. the walls of wherever the
   *  PLAYER was — the street's, read in the room's coordinates — or none at all, so a room's people seen through its
   *  window, and the Covered Market's from its avenues' far end, walked through counters and stalls; two players in
   *  different places also disagreed about where a wanderer by the shared clock would go). A room of several storeys:
   *  the player's storey while the player is in it, otherwise its ground storey for people near the ground floor. */
  _colOf(p) {
    const g = this.game;
    if (p.place === 'world') return g.worldCollider;
    if (g.player.place === p.place) return g.collider;
    const I = g.interiors, d = I && I.defs ? I.defs.get(p.place) : null;
    if (!d || !d.collider) return null;
    if (d.colliders && d.colliders.length > 1 && Math.abs((p.y || 0) - ((d.sl && d.sl.portals && d.sl.portals[0] && d.sl.portals[0].y) || 0)) > 1.2) return null;
    return d.collider;
  }
  _moveTo(p, tx, tz, v, dt) {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 1e-4) { p.speed = 0; return 0; }
    const step = Math.min(d, v * dt);
    let nx = p.x + (dx / d) * step, nz = p.z + (dz / d) * step;
    if (p.place === 'world' && this.obstacles.length) {
      if (this._inObstacle(tx, tz, 0.3)) { p.speed = 0; return 0; }     // target is inside: treat as reached, pick another
      const o = this._inObstacle(nx, nz, 0.35);
      if (o) {          // slide round the circle on the side nearer the target
        // blocked for a while on a walk (a cordon across the pavement): turn round and take another way
        if (p.state === 'walk' && (p.obsT = (p.obsT || 0) + dt) > 1.2) {
          p.obsT = 0; const t = p.a; p.a = p.b; p.b = t; this._edgeTarget(p); p.speed = 0; return 1;
        }
        let ox = nx - o.x, oz = nz - o.z, od = Math.hypot(ox, oz);
        if (od < 1e-3) { ox = -dz / d; oz = dx / d; od = 1; }
        ox /= od; oz /= od;
        const sgn = (-oz * dx + ox * dz) >= 0 ? 1 : -1, R = o.r + 0.36;
        nx = o.x + ox * R - oz * sgn * step; nz = o.z + oz * R + ox * sgn * step;
        // overlapping circles (a row of them along a taped-off pavement): straight out of any other one too
        for (let k = 0; k < 2; k++) {
          const o2 = this._inObstacle(nx, nz, 0.3); if (!o2) break;
          let qx = nx - o2.x, qz = nz - o2.z; const qd = Math.hypot(qx, qz) || 1; qx /= qd; qz /= qd;
          nx = o2.x + qx * (o2.r + 0.36); nz = o2.z + qz * (o2.r + 0.36);
        }
      } else p.obsT = 0;
    }
    if (p.place === 'world' && this.wet(nx, nz)) { p.speed = 0; return d; }
    // street furniture, trees, parked cars and walls (the walk graph only knew the walls): slide round them, side-stepping
    // when one stands square on the line (motion pass)
    const col = this._colOf(p);
    // (cheap: one wide probe tells how far the walker can go before anything could be in reach; until it has walked
    // that far nothing is tested. The budget is spent on the step, reset when the place changes)
    if (col && step > 1e-4 && (p.place !== 'world' || this._near(p)) && (p.freeB -= step) < 0) {
      const q = this._tmpQ || (this._tmpQ = { x: 0, z: 0 });
      q.x = nx; q.z = nz;
      const c = this._clearance(col, nx, nz, 1.2);
      p.freeB = c > 0.3 ? c - 0.3 : 0;
      if (p.freeB === 0 && col.resolve(q, 0.26)) {
        const prog = ((q.x - p.x) * dx + (q.z - p.z) * dz) / d;
        if (prog < step * 0.3) {
          const sd = ((p.lookSeed || p.sid || p.poolIdx || 0) & 1) ? 1 : -1, ux = dx / d, uz = dz / d;
          q.x = p.x + (ux * 0.35 + uz * sd * 0.94) * step; q.z = p.z + (uz * 0.35 - ux * sd * 0.94) * step;
          col.resolve(q, 0.26);
        }
        if (p.place === 'world' && this.wet(q.x, q.z)) { p.speed = 0; return d; }
        nx = q.x; nz = q.z;
      }
    }
    p.x = nx; p.z = nz; p.speed = dt > 0 ? step / dt : 0;
    const want = Math.atan2(dx, dz);
    p.heading += wrapA(want - p.heading) * Math.min(1, dt * 7);
    return d - step;
  }

  /** distance from (x, z) to the nearest solid shape of col within R (R if none); no allocation */
  _clearance(col, x, z, R) {
    if (col.passages.length && col.inPassage(x, z)) return 0.3 + 0.26;
    this._cx = x; this._cz = z; this._cd = R;
    col._near(x - R, z - R, x + R, z + R, this._clFn || (this._clFn = (sh) => {
      let d;
      if (sh.seg) {
        const dx = sh.x2 - sh.x1, dz = sh.z2 - sh.z1, l2 = dx * dx + dz * dz;
        let t = l2 ? ((this._cx - sh.x1) * dx + (this._cz - sh.z1) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        d = Math.hypot(this._cx - sh.x1 - dx * t, this._cz - sh.z1 - dz * t);
      } else d = Math.hypot(this._cx - sh.x, this._cz - sh.z) - sh.r;
      if (d < this._cd) this._cd = d;
    }));
    return this._cd;
  }
  _near(p, r = 150) { const pp = this.game.player.pos, dx = p.x - pp.x, dz = p.z - pp.z; return dx * dx + dz * dz < r * r || (this._remF !== null && this._remF !== undefined); }
  /** keep out of other walkers (both step half the overlap) and out of vehicles (all of it); last frame's grid */
  _separate(p, dt) {
    const T = this.game.traffic, G = T && T.grid;
    if (!G || !G.n) return;
    const n = G.gather(p.x, p.z, 1.6, _gi);
    let mx = 0, mz = 0, veh = false;
    for (let j = 0; j < n; j++) {
      const i = _gi[j], o = G.ref[i];
      if (o === p) continue;
      const k = G.K[i];
      if (k === K_PLAYER) continue;                                 // (the player bump has its own reaction above)
      if (k === K_PED) {
        if (o.down || o.place !== p.place) continue;
        const ex = p.x - G.X[i], ez = p.z - G.Z[i], d2 = ex * ex + ez * ez, mn = o.leader === p || p.leader === o ? 0.46 : 0.56;   // (a group walks a little closer)
        if (d2 >= mn * mn || d2 < 1e-8) continue;
        const d = Math.sqrt(d2), push = (mn - d) * (o.static || o.state === 'sit' || o.state === 'post' || o.state === 'static' ? 1 : 0.5);
        mx += ex / d * push; mz += ez / d * push;
      } else {
        const d = capsulePoint(G, i, p.x, p.z, _cp), R = G.R[i] + 0.3;
        if (d >= R || d < 1e-6) continue;
        const nx = (p.x - _cp.x) / d, nz = (p.z - _cp.z) / d;
        mx += nx * (R - d); mz += nz * (R - d); veh = true;
        // ... and round it towards where we are going (else a walker heading through a stopped car stands at its bumper)
        if (p.speed > 0.2) { const gx = p.tx - p.x, gz = p.tz - p.z, sg = gx * -nz + gz * nx >= 0 ? 1 : -1; mx += -nz * sg * p.speed * dt * 0.9; mz += nx * sg * p.speed * dt * 0.9; }
      }
    }
    if (mx === 0 && mz === 0) return;
    const ml = Math.hypot(mx, mz), cap = Math.max(0.02, 2.5 * dt);
    if (ml > cap) { mx *= cap / ml; mz *= cap / ml; }
    const q = this._tmpQ || (this._tmpQ = { x: 0, z: 0 });
    q.x = p.x + mx; q.z = p.z + mz;
    this.game.worldCollider.resolve(q, 0.26);
    if (!this.wet(q.x, q.z) && (veh || !this.road(q.x, q.z) || this.road(p.x, p.z))) { p.x = q.x; p.z = q.z; }      // (never jostled off the kerb into the road by other walkers; round a parked taxi, a step off it is fine)
  }
  _face(p, ang, dt) { p.heading += wrapA(ang - p.heading) * Math.min(1, dt * 5); }

  // ---------------------------------------------------------------- per-ped update
  _updatePed(p, dt, pl, plSpeed, plVx, plVz) {
    let dxp = p.x - pl.x, dzp = p.z - pl.z, dPl = Math.hypot(dxp, dzp), here = this.game.player.place === p.place;
    const R = this._remF;
    if (R && p.place === 'world') {
      // multiplayer: our walkers react to whichever player is nearest (the others see them through the sync)
      for (let i = 0; i < R.length; i++) {
        const q = R[i], ex = p.x - q.x, ez = p.z - q.z, d = Math.hypot(ex, ez);
        if (d < dPl || !here) { dxp = ex; dzp = ez; dPl = d; here = true; pl = q; plSpeed = q.speed; plVx = Math.sin(q.h) * q.speed; plVz = Math.cos(q.h) * q.speed; }
      }
    }
    const ch = p.character;
    // reactions to the player
    if (dPl < 7 && !p.down && here) {
      if (plSpeed > 3.5 || dPl < 2.5) ch.headTurn(clampA(wrapA(Math.atan2(-dxp, -dzp) - p.heading), 1.2)); else ch.headTurn(0);
      // pressed by a player (a body the player cannot walk into: systems/_ped_solid.js): a step aside of their own, at a
      // human pace; run into at a jog they stagger. (It was: anyone within 0.7 m of the player put straight out to 0.7 m.)
      {
        const own = pl === this.game.player.pos;
        let vn = 0, ps = plSpeed;
        if (own) { vn = p.pressV; if (vn > 0) ps = Math.max(p.pressS, plSpeed); }
        else if (dPl < R_REMOTE + 0.4 && plSpeed > 0.2 && dPl > 1e-3) vn = -(plVx * dxp + plVz * dzp) / dPl;      // (another player: by how they are coming on)
        if (vn > 0.2 && dPl > 1e-3 && dPl < 1.5) this.solid.pressed(p, dxp / dPl, dzp / dPl, vn, ps, own ? this.game.player.heading : Math.atan2(plVx, plVz), own ? this.game.player : null, dt);
        else if (p.pressT > 0) p.pressT = Math.max(0, p.pressT - dt);
      }
      if (plSpeed > 4 && dPl < 4.5 && p.state === 'walk' && p.dodgeT <= 0) {
        const closing = -(plVx * dxp + plVz * dzp) / (dPl * plSpeed);
        if (closing < -0.5) {   // player heading at us
          const side = (plVx * dzp - plVz * dxp) > 0 ? 1 : -1;
          for (const s of [side, -side]) {
            const lt = p.latBase + s * 1.7, cx = p.x + p.px * (lt - p.lat), cz = p.z + p.pz * (lt - p.lat);
            if (!this.wet(cx, cz) && this.game.worldCollider.isFree(cx, cz, 0.3)) { p.latT = lt; p.dodgeT = 2.2; break; }
          }
          if (p.sayCd <= 0 && Math.random() < 0.5) this._say(p, pick(LINES.react), 2, 8);
        }
      }
    } else if (dPl < 12) ch.headTurn(0);
    p.pressV = 0; if (p.yieldT > 0) p.yieldT -= dt;
    if (p.dodgeT > 0) { p.dodgeT -= dt; if (p.dodgeT <= 0) p.latT = p.latBase; }
    if (p.bumpT > 0) p.bumpT -= dt;
    if (p.hopT > 0) this.solid.hop(p, dt);      // hopping clear of a car / staggered by a runner / a step aside for a player: a quick step, not into the river or a wall
    p.sayCd -= dt;
    // an outside controller (control(ped, fn)): police chases, taxi fares, bus passengers. Returning false hands back.
    if (p.ctl) {
      let keep = false;
      try { keep = p.ctl(p, dt) !== false; } catch (e) { console.warn('[pedestrians] controller', e); }
      if (!keep && p.active) { p.ctl = null; p.down = false; this._resume(p); }
      if (p.active && p.dog && p.place === 'world') this._updateDog(p, dt);      // (their dog goes with them - to the shop door, where it is tied up)
      return;
    }

    switch (p.state) {
      case 'walk': {
        if (p.lat !== p.latT) { const dl = p.latT - p.lat, st = 2.5 * dt; p.lat = Math.abs(dl) < st ? p.latT : p.lat + Math.sign(dl) * st; p.tx = this.graph.X[p.b] + p.px * p.lat; p.tz = this.graph.Z[p.b] + p.pz * p.lat; }
        // tie the dog walker's pace to the dog
        let v = p.vmax;
        if (p.dog && (p.dogState === 'squat' || p.dogState === 'mark' || p.dogState === 'bark') && !(p.place === 'world' && this.road(p.x, p.z, 1))) v = 0;
        // (the grown-up waits for a child who has dropped behind - never in the middle of the road)
        if (p.waitT > 0) { p.waitT -= dt; if (!(p.place === 'world' && this.road(p.x, p.z, 0.5))) v = Math.min(v, p.waitT > 0.25 ? 0 : 0.5); }
        // at the kerb: look both ways (motion pass). Off the carriageway with the next metre on it: wait while anything is
        // coming that would get there before we are across (re-checked 5 times a second; after 20 s, go and let it stop)
        if (v > 0 && p.place === 'world') {
          const ddx = p.tx - p.x, ddz = p.tz - p.z, dd = Math.hypot(ddx, ddz) || 1;
          if ((p.roadT -= dt) <= 0) { p.roadT = 0.15; p.roadA = !this.road(p.x, p.z) && this.road(p.x + ddx / dd * 1.1, p.z + ddz / dd * 1.1); }     // (5-7 times a second)
          if (p.roadA) {
            if ((p.kerbChk -= dt) <= 0) {
              p.kerbChk = 0.2; this._kerbBlock = false;
              p.kerbOk = this._roadClear(p, p.tx, p.tz) || (p.kerbT > 20 && !this._kerbBlock);
              // the way over blocked by stopped traffic for ages: go another way
              if (!p.kerbOk && this._kerbBlock && p.kerbT > 15) { p.kerbT = 0; const t = p.a; p.a = p.b; p.b = t; this._edgeTarget(p); p.kerbOk = true; }
            }
            if (!p.kerbOk) { v = 0; p.kerbT += dt; this._face(p, Math.atan2(ddx, ddz), dt); }
          } else { p.kerbT = 0; p.kerbChk = 0; }
        }
        const rem = v > 0 ? this._moveTo(p, p.tx, p.tz, v, dt) : (p.speed = 0, 1);
        if (rem < 0.35) { p.stallD = 1e9; p.stallT = 0; this._arrive(p); }
        else if (v > 0) {
          // getting no nearer (something stands on the node: a taxi on the rank, a parked car): take the next edge instead
          if (rem < p.stallD - 0.05) { p.stallD = rem; p.stallT = 0; }
          else if ((p.stallT += dt) > 2.5) { p.stallD = 1e9; p.stallT = 0; this._arrive(p); }
        }
        break;
      }
      case 'follow': {
        const L = p.leader, mustBeWith = p.child && needsAdult(p.role);
        if (!L || !L.active) { if (mustBeWith) { if (!this._adopt(p)) this._deactivate(p); } else this._resume(p); break; }
        const h = L.heading, fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h);
        let tx = L.x + lx * p.ox - fx * p.oz, tz = L.z + lz * p.ox - fz * p.oz;
        // single file behind the leader (each at its own distance) where the slot beside is behind a wall or out in the road
        const bk = 0.7 + p.oz * 0.8, bx = L.x - fx * bk + lx * p.ox * 0.3, bz = L.z - fz * bk + lz * p.ox * 0.3;
        // (where the road is, re-checked 5 times a second: bit 1 me, 2 the leader, 4 my slot, 8 the single-file spot;
        // 16: a bench, a bin, a bus shelter stands in my slot - the leader's line is clear of them, the place beside it may not be)
        if (p.place === 'world' && (p.roadT -= dt) <= 0) { p.roadT = 0.2; p.fRoad = (this.road(p.x, p.z) ? 1 : 0) | (this.road(L.x, L.z) ? 2 : 0) | (this.road(tx, tz) ? 4 : 0) | (this.road(bx, bz) ? 8 : 0) | (this.lanes.furniture(tx, tz, 0.45) ? 16 : 0); }
        const fr = p.place === 'world' ? p.fRoad : 0;
        if ((fr & 3) === 1) { if (fr & 8) { tx = L.x; tz = L.z; } else { tx = bx; tz = bz; } p.slotT = 1.5; }      // (off the road)
        else if (this.wet(tx, tz) || (p.place === 'world' && ((fr & 6) === 4 || (fr & 16) !== 0 || ((this.frame + p.poolIdx) % 8 === 0 && this.game.worldCollider.raycast(L.x, L.z, tx, tz) !== null)))) { tx = bx; tz = bz; p.slotT = 1.5; }
        else if (p.slotT > 0) { p.slotT -= dt; tx = bx; tz = bz; }      // (stay in single file a moment)
        p.tx = tx; p.tz = tz;      // (so _separate rounds an obstacle towards the slot, not a stale walk target)
        const d = Math.hypot(tx - p.x, tz - p.z);
        const lStill = L.state !== 'walk' && L.state !== 'follow';
        let fv = Math.min(d * 2.5, L.vmax * 1.5 + (mustBeWith ? 1.2 : 0.4));
        if (fv > 1.3 && d > 0.15) {
          // hurrying to catch up: not through one of their own party who is just in front (two of a group running for
          // the same gap used to brush shoulders - tools/audit_motion.mjs ped-ped)
          const ux = (tx - p.x) / d, uz = (tz - p.z) / d, Ls = this.list;
          for (let i = 0; i < Ls.length; i++) { const q = Ls[i]; if (q === p || !q.active || q.leader !== L) continue; const ex = q.x - p.x, ez = q.z - p.z; if (Math.abs(ex) < 0.75 && Math.abs(ez) < 0.75 && ex * ux + ez * uz > 0.05 && ex * ex + ez * ez < 0.5) { fv = Math.min(fv, Math.max(0.5, (q.speed || 0) * 0.85)); break; } }
        }
        if (d > 0.15) this._moveTo(p, tx, tz, fv, dt); else p.speed = 0;
        if (mustBeWith) {
          // never out of their adult's reach: the adult waits when they drop behind; if something has parted them all the
          // same (a wall between, a crowd) they are brought back to the adult's side
          const dl = Math.hypot(L.x - p.x, L.z - p.z);
          if (dl > 3.2) L.waitT = 0.6;
          if (dl > ADULT_RANGE - 2.5) { const q = this._tmpP; q.x = L.x - fx * 0.5 + lx * 0.3; q.z = L.z - fz * 0.5 + lz * 0.3; if (this.wet(q.x, q.z) || !this.game.worldCollider.isFree(q.x, q.z, 0.2)) { q.x = L.x; q.z = L.z; } p.x = q.x; p.z = q.z; p.gx = 1e9; this.kidStats.broughtBack++; }
        } else if (d > 25) { this._resume(p); break; }
        if (p.speed < 0.2) this._face(p, lStill ? Math.atan2(L.x - p.x, L.z - p.z) : h, dt);
        const want = lStill && p.speed < 0.3 && !p.drunk && !p.child && !p.handSide ? 'talk' : p.basePose;
        if (ch.pose !== want && !p.down) ch.setPose(want);
        break;
      }
      case 'pause': case 'chat': {
        p.speed = 0; p.timer -= dt;
        if (p.state === 'chat' && p.partner) this._face(p, Math.atan2(p.partner.x - p.x, p.partner.z - p.z), dt);
        if (p.dog && p.dogState === 'follow' && Math.random() < dt * 0.3) { p.dogState = 'sniff'; p.dogT = rand(2, 4); }
        if (p.timer <= 0) { if (p.partner) { p.partner.partner = null; p.partner = null; } ch.setPose(p.basePose); p.state = 'walk'; }
        break;
      }
      case 'toBench': {
        const rem = this._moveTo(p, p.tx, p.tz, p.vmax * 0.8, dt);
        if (rem < 0.25) { p.heading = wrapA(p.heading + Math.PI); ch.setPose('sit'); p.state = 'sit'; p.timer = rand(15, 45); p.speed = 0; p.stallD = 1e9; p.stallT = 0; }
        // (no nearer for three seconds - a bus at its stop between them and the bench: the bench is given up. The walker
        //  used to stand against the bus for good, and the bus, with somebody at its corner, never pulled away.)
        else if (rem < p.stallD - 0.05) { p.stallD = rem; p.stallT = 0; }
        else if ((p.stallT += dt) > 3) { p.stallD = 1e9; p.stallT = 0; if (p.bench) { p.bench.busy = false; p.bench = null; } p.state = 'fromBench'; p.tx = this.graph.X[p.a]; p.tz = this.graph.Z[p.a]; }
        break;
      }
      case 'sit': {
        p.speed = 0; p.timer -= dt;
        if (p.timer <= 0) { ch.setPose(p.basePose); p.state = 'fromBench'; p.tx = this.graph.X[p.a]; p.tz = this.graph.Z[p.a]; if (p.bench) { p.bench.busy = false; p.bench = null; } }
        break;
      }
      case 'fromBench': {
        const rem = this._moveTo(p, p.tx, p.tz, p.vmax, dt);
        if (rem < 0.35) { p.state = 'walk'; this._edgeTarget(p); }
        break;
      }
      case 'down': {
        p.speed = 0;
        if (p.vx || p.vz) {
          // (in steps of a quarter of a metre at most: thrown by a vehicle they can leave at 12 m/s, and no wall is to be stepped over)
          const q = this._tmpP, c = this._colOf(p), ns = Math.max(1, Math.min(4, Math.ceil(Math.hypot(p.vx, p.vz) * dt / 0.25)));
          for (let si = 0; si < ns; si++) {
            q.x = p.x + p.vx * dt / ns; q.z = p.z + p.vz * dt / ns;
            if (c && c.resolve(q, 0.3) && ns > 1) { p.vx *= 0.6; p.vz *= 0.6; }      // (into a wall at speed: most of it is gone)
            if (p.place !== 'world' || !this.wet(q.x, q.z)) { p.x = q.x; p.z = q.z; } else { p.vx = p.vz = 0; break; }
          }
          // sliding to rest on the pavement (a tumble: a steady scrub; knocked over: an ease)
          if (p.slideDec) { const sp = Math.hypot(p.vx, p.vz), k = Math.max(0, sp - p.slideDec * dt) / (sp || 1); p.vx *= k; p.vz *= k; }
          else { const k = Math.max(0, 1 - dt * 4); p.vx *= k; p.vz *= k; }
          if (Math.abs(p.vx) + Math.abs(p.vz) < 0.05 || (ch.onGround === false && ch.pose !== 'fall')) p.vx = p.vz = 0;
        }
        if (p.fistT > 0 && ch.pt >= p.fistT && ch.pose !== 'fall') { p.fistT = 0; this._say(p, pick(LINES.fist), 2.5, 5); }
        if (!ch.isDown) { p.down = false; p.slideDec = 0; this._resume(p); }
        break;
      }
      case 'post': case 'static': {
        p.speed = 0;
        // stepped aside for a player: back to the post once they have gone
        if (p.stepped && p.static && !(p.hopT > 0) && (Math.abs(p.x - p.homeX) > 0.06 || Math.abs(p.z - p.homeZ) > 0.06) && Math.hypot(pl.x - p.homeX, pl.z - p.homeZ) > 1.6) { p.state = 'return'; break; }
        if (p.sid || p.det) this._detLine(p);
        else if (dPl < 6 && p.sayCd <= 0 && Math.random() < dt * SPEECH.idlePerS && p.lines) this._say(p, walkerLine(p.lines, null, this._now()), 3, 25);
        break;
      }
      case 'return': {
        const rem = this._moveTo(p, p.homeX, p.homeZ, 1.2, dt);
        if (rem < (p.stepped ? 0.03 : 0.3)) {      // (stepped aside for a player: right back on the spot)
          p.heading = p.homeH; ch.setPose(p.basePose); p.stepped = false; p.speed = 0;
          p.state = p.role === 'porter' ? 'post' : p.wander ? 'wpause' : 'static'; p.timer = rand(2, 5);
        }
        break;
      }
      case 'wpause': {
        p.speed = 0; p.timer -= dt;
        if (p.timer <= 0) {
          const col = this._colOf(p);
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * p.wander.radius;
            const tx = p.homeX + Math.sin(a) * r, tz = p.homeZ + Math.cos(a) * r;
            if (col && col.raycast(p.x, p.z, tx, tz) !== null) continue;
            if (p.place === 'world' && this._wetLine(p.x, p.z, tx, tz)) continue;
            p.tx = tx; p.tz = tz; p.state = 'wwalk'; if (ch.pose !== 'stand' && ch.pose !== 'drunk') ch.setPose(p.drunk ? 'drunk' : 'stand');
            break;
          }
          if (p.state === 'wpause') p.timer = 1;
        }
        if (dPl < 5 && p.sayCd <= 0 && Math.random() < dt * SPEECH.idlePerS && p.lines) this._say(p, walkerLine(p.lines, null, this._now()), 3, 25);
        break;
      }
      case 'wwalk': {
        const rem = this._moveTo(p, p.tx, p.tz, p.wander.speed || 1.0, dt);
        if (rem < 0.25 || (p.speed < 0.01 && rem > 0.25)) { p.state = 'wpause'; p.timer = rand(2, 7); ch.setPose(p.basePose); }
        break;
      }
    }
    if (p.dog) this._updateDog(p, dt);
  }

  /** the dog of walker p. On the lead it trots beside or ahead (the keen ones pull), noses the ground, cocks a leg at a
   *  lamp post or a tree, barks at another dog now and then; in a park, well away from any road, it is let off (the lead
   *  is put away) and ranges about its owner, running; tied up outside a shop while its owner is inside (p.dogTie: the
   *  doorways below) it sits and waits. It never goes into water or - off the lead - near a road, and nothing can hit
   *  it (this.animals -> _ped_protect.js). A proxy's dog (p.remote) takes its state from the owner's flags. */
  _updateDog(p, dt) {
    if (p.remote && p.tiedProxy) {
      // somebody else's dog, tied up outside a shop: it sits where it was left (its owner, inside, is not drawn)
      const d0 = p.dog; p.dogX = p.x; p.dogZ = p.z; p.dogH = p.heading; d0.setPose('sit'); d0.group.position.set(p.x, p.y, p.z); d0.group.rotation.y = p.heading; d0.update(dt, 0);
      if (p.leash.visible) p.leash.visible = false; if (p.character.group.visible) p.character.group.visible = false; if (p.blob && p.blob.mesh) p.blob.mesh.visible = false;
      return;
    }
    const d = p.dog, h = p.heading, tie = p.dogTie, inRoom = p.place !== 'world';
    p.dogT -= dt; p.messT -= dt; p.dogBarkT -= dt; p.dogMarkT -= dt;
    const keen = d.excite || 0.5, ahead = 0.8 + keen * 1.0;
    let tx = p.x + Math.cos(h) * 0.75 + Math.sin(h) * ahead, tz = p.z - Math.sin(h) * 0.75 + Math.cos(h) * ahead, run = 0, face = null;
    if (tie) { tx = tie.x; tz = tie.z; }
    else if (p.remote) {
      // a proxy's dog: its state comes from the owner (flags); off the lead it ranges here as it does there
      if (p.dogState !== 'follow' && !p.dogLoose) { tx = p.dogX; tz = p.dogZ; }
    } else if (p.dogState === 'squat') {
      tx = p.dogX; tz = p.dogZ;
      if (p.dogT <= 0) {
        this._addMess(p.dogX - Math.sin(p.dogH) * 0.3, p.dogZ - Math.cos(p.dogH) * 0.3);
        p.dogState = 'follow'; p.messT = rand(60, 150);
        if (p.sayCd <= 0 && Math.random() < 0.7) this._say(p, pick(LINES.dogmess), 3, 10);
      }
    } else if (p.dogState === 'sniff') {
      tx = p.dogX + Math.sin(this.game.elapsed || 0) * 0.02; tz = p.dogZ;
      if (p.dogT <= 0) p.dogState = 'follow';
    } else if (p.dogState === 'mark') {
      tx = p.dmX; tz = p.dmZ; face = p.dmH;
      if (p.dogT <= 0) p.dogState = 'follow';
    } else if (p.dogState === 'bark') {
      tx = p.dogX; tz = p.dogZ; face = p.dmH;
      if (p.dogT <= 0) p.dogState = 'follow';
    } else {
      if (p.dogT <= 0) { p.dogState = 'sniff'; p.dogT = rand(1.5, 3.5); }
      const zn = this.zone(p.x, p.z);
      if (p.messT <= 0 && zn & (Z_UPARKS | Z_PARK) && !this.wet(p.dogX, p.dogZ)) { p.dogState = 'squat'; p.dogT = 3.5; p.messT = 999; }
      else if (p.dogMarkT <= 0 && !p.dogLoose && p.state === 'walk') {
        // a lamp post, a tree, a bollard within reach of the lead and off the carriageway: a leg is cocked at it
        p.dogMarkT = 7;
        const col = this.game.worldCollider; let best = null, bd = 2.3;
        if (col && col._near) col._near(p.x - 2.3, p.z - 2.3, p.x + 2.3, p.z + 2.3, (q) => { if (q.seg || !(q.tag === 'lamp' || q.tag === 'tree' || q.tag === 'street') || !(q.r < 0.5)) return; const dd = Math.hypot(q.x - p.x, q.z - p.z); if (dd < bd) { bd = dd; best = q; } });
        if (best) {
          const ux = (p.dogX - best.x) / (Math.hypot(p.dogX - best.x, p.dogZ - best.z) || 1), uz = (p.dogZ - best.z) / (Math.hypot(p.dogX - best.x, p.dogZ - best.z) || 1), mx = best.x + ux * (best.r + 0.3), mz = best.z + uz * (best.r + 0.3);
          if (!this.road(mx, mz) && !this.wet(mx, mz)) { p.dogState = 'mark'; p.dogT = 3.2; p.dmX = mx; p.dmZ = mz; p.dmH = Math.atan2(-uz, ux); p.dogMarkT = rand(35, 90); }
        }
      } else if (p.dogBarkT <= 0) {
        // another dog near: a bark or two at it (and a word from the owner)
        p.dogBarkT = 4;
        const A = this.animals;
        for (let i = 0; i < A.length; i++) {
          const a = A[i]; if (a.o === p || a.kind !== 'dog') continue;
          const ex = a.o[a.kx] - p.dogX, ez = a.o[a.kz] - p.dogZ, dd = Math.hypot(ex, ez);
          if (dd > 9 || dd < 0.8) continue;
          p.dogState = 'bark'; p.dogT = rand(1.2, 2.2); p.dmH = Math.atan2(ex, ez); p.dogBarkT = rand(30, 80);
          bark(this.game.audio, p.dogX, p.y, p.dogZ, d.height, 2 + (Math.random() < 0.4 ? 1 : 0));
          if (p.sayCd <= 0 && Math.random() < 0.5) this._say(p, pick(LINES.dogbark), 2.5, 12);
          break;
        }
        if (p.dogState === 'follow') {
          // …or ducks: by Worcester's lake or the pond in the Parks, at the water's edge, a bark at them
          const g = this.game, wg = g.worcesterGrounds, pk = g.parks; let dd = Infinity;
          try { if (wg && wg.nearestDuck) dd = wg.nearestDuck(p.dogX, p.dogZ); if (!(dd < 10) && pk && pk.nearestDuck) dd = Math.min(dd, pk.nearestDuck(p.dogX, p.dogZ)); } catch { dd = Infinity; }
          if (dd < 10) {
            p.dogState = 'bark'; p.dogT = rand(1.4, 2.4); p.dmH = p.dogH; p.dogBarkT = rand(25, 60); this.kidStats.duckBarks = (this.kidStats.duckBarks || 0) + 1;
            bark(g.audio, p.dogX, p.y, p.dogZ, d.height, 3);
            if (p.sayCd <= 0 && Math.random() < 0.6) this._say(p, LINES.dogbark[4], 2.5, 12);
          }
        }
      }
      // let off in a park, well away from the roads; back on the lead before leaving it
      if ((p.looseT = (p.looseT || 0) - dt) <= 0) { p.looseT = 1; const park = !!(zn & (Z_UPARKS | Z_PARK)) && !this.road(p.x, p.z, 14) && !inRoom; if (park && !p.dogLoose) { p.dogLoose = 1; p.drT = 0; } else if (!park && p.dogLoose) p.dogLoose = 2; }
    }
    if (p.dogLoose && !tie) {
      if (p.dogLoose === 2) { if (Math.hypot(p.dogX - p.x, p.dogZ - p.z) < 2.2) p.dogLoose = 0; run = 4.2; }       // called back: to heel, then the lead goes on
      else if (p.dogState === 'follow' || p.remote) {
        // ranging: a point somewhere round the owner, run to, nosed at, and another (each dog its own, by its seed and the clock)
        if ((p.drT -= dt) <= 0 || p.drX === undefined) {
          p.drT = rand(2.5, 6); let ok = false;
          for (let k = 0; k < 5 && !ok; k++) { const a = Math.random() * TAU, r = 3 + Math.random() * 7, x = p.x + Math.sin(a) * r + Math.sin(h) * 3, z = p.z + Math.cos(a) * r + Math.cos(h) * 3; if (!this.wet(x, z) && !this.road(x, z, 6) && this.game.worldCollider.raycast(p.dogX, p.dogZ, x, z) === null && !this._wetLine(p.dogX, p.dogZ, x, z)) { p.drX = x; p.drZ = z; ok = true; } }
          if (!ok) { p.drX = p.x; p.drZ = p.z; }
        }
        tx = p.drX; tz = p.drZ; run = 3.2 + keen * 2.2;
        if (Math.hypot(p.dogX - p.x, p.dogZ - p.z) > 16) { tx = p.x; tz = p.z; }
      }
    }
    if (!tie && this.wet(tx, tz)) { tx = p.x; tz = p.z; }
    // the lead: never more than 2.6 m from the owner (tied: from the ring)
    if (!p.dogLoose && !tie) { const ox = p.dogX - p.x, oz = p.dogZ - p.z, od = Math.hypot(ox, oz); if (od > 2.6) { tx = p.x + (ox / od) * 2.2; tz = p.z + (oz / od) * 2.2; } }
    const dx = tx - p.dogX, dz = tz - p.dogZ, dd = Math.hypot(dx, dz);
    let sp = 0;
    if (dd > 0.12 && p.dogState !== 'squat') {
      sp = Math.min(dd * 3, run || Math.max(p.speed * 1.4, 1.5));
      const nx = p.dogX + (dx / dd) * sp * dt, nz = p.dogZ + (dz / dd) * sp * dt;
      if (!this.wet(nx, nz)) { p.dogX = nx; p.dogZ = nz; } else sp = 0;
      p.dogH += wrapA(Math.atan2(dx, dz) - p.dogH) * Math.min(1, dt * 8);
    } else if (face !== null) p.dogH += wrapA(face - p.dogH) * Math.min(1, dt * 6);
    const still = sp < 0.3;
    d.setPose(tie ? (p.dogT % 14 < 8 ? 'sit' : 'lie') : p.dogState === 'squat' ? 'squat' : p.dogState === 'mark' && still ? 'mark' : p.dogState === 'bark' ? 'bark' : p.dogState === 'sniff' && still ? 'sniff' : !p.dogLoose && (p.state === 'sit' || p.state === 'chat') ? 'sit' : 'stand');
    if (tie && p.dogT < -200) p.dogT = 0;
    // (the dog watches its owner when it has nothing else to do; a tied one watches the door)
    if (d.look) { const wx = tie ? tie.dx : p.x, wz = tie ? tie.dz : p.z, yaw = wrapA(Math.atan2(wx - p.dogX, wz - p.dogZ) - p.dogH); d.look(still && p.dogState === 'follow' ? Math.max(-1.1, Math.min(1.1, yaw)) : 0, 0); }
    const gy = tie ? tie.y : p.y;
    d.group.position.set(p.dogX, gy, p.dogZ); d.group.rotation.y = p.dogH;
    if (p.anim || tie) d.update(dt, sp);
    // the lead: the owner's left hand -> the collar; off the lead it is put away; tied, from the ring by the door
    const L = p.leash, show = !p.dogLoose || !!tie;
    if (L.visible !== show) L.visible = show;
    if (show) {
      const a = L.geometry.attributes.position.array, s = p.character.dims.s;
      if (tie) { a[0] = tie.rx; a[1] = tie.y + 0.3; a[2] = tie.rz; }
      else { const hx = Math.cos(h) * 0.24 + Math.sin(h) * 0.32, hz = -Math.sin(h) * 0.24 + Math.cos(h) * 0.32; a[0] = p.x + hx; a[1] = p.y + 0.95 * s * (p.state === 'sit' ? 0.62 : 1); a[2] = p.z + hz; }
      const c = d.collar, ch = Math.cos(p.dogH), sh = Math.sin(p.dogH);
      a[3] = p.dogX + sh * c.z; a[4] = gy + c.y + (d.body ? d.body.position.y : 0); a[5] = p.dogZ + ch * c.z;
      L.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- scripted NPCs: the same for everyone (shared clock + stable id)
  /** A scripted wanderer's position is a function of the shared clock: leg k (period P) goes from target k-1 to target k,
   *  after a pause; the targets are hashed from its stable id and k, and only ever checked against the walls from home. */
  _detWander(p, dt, pp) {
    this.solid.clock(p, dt, pp);      // (a step aside for our player: an offset from the clock's place, which wears off)
    const W = p.wander, now = (this.game.time ? this.game.time.now() : Date.now()) / 1000;
    const P = Math.max(7, (2 * W.radius) / W.speed + 4), ph = hh(p.sid, 1, 2) * P;
    const k = Math.floor((now + ph) / P), t0 = k * P - ph;
    if (p.wk !== k) {
      if (p.wk === k - 1) { p.wpx = p.wtx; p.wpz = p.wtz; } else { const a = this._wTarget(p, k - 1); p.wpx = a[0]; p.wpz = a[1]; }
      const b = this._wTarget(p, k); p.wtx = b[0]; p.wtz = b[1]; p.wk = k;
      p.wpause = 1.5 + hh(p.sid, k, 3) * 2.5;
    }
    const dx = p.wtx - p.wpx, dz = p.wtz - p.wpz, L = Math.hypot(dx, dz), tw = now - t0 - p.wpause;
    const f = L < 0.05 || tw <= 0 ? (tw <= 0 ? 0 : 1) : Math.min(1, (tw * W.speed) / L);
    const nx = p.wpx + dx * f + p.offX, nz = p.wpz + dz * f + p.offZ;
    const moved = Math.hypot(nx - p.x, nz - p.z);
    // first frame / after a knock: glide back on to the timeline rather than jump
    if (moved > 0.5 && p.state !== 'wwalk' && p.state !== 'wpause') { this._moveTo(p, nx, nz, 1.4, dt); return; }
    if (moved > 0.5) { this._moveTo(p, nx, nz, Math.max(W.speed * 1.5, 1.2), dt); }
    else { p.speed = dt > 0 ? moved / dt : 0; p.x = nx; p.z = nz; if (moved > 1e-3) p.heading += wrapA(Math.atan2(dx, dz) - p.heading) * Math.min(1, dt * 7); }
    const walking = f > 0 && f < 1 && L > 0.05;
    const want = walking ? (p.drunk ? 'drunk' : 'stand') : p.basePose;
    if (p.character.pose !== want && !p.down) p.character.setPose(want);
    p.state = walking ? 'wwalk' : 'wpause';
    this._detLine(p);
  }
  _wTarget(p, k) {
    const W = p.wander, col = p.place === 'world' ? this.game.worldCollider : this.game.collider;      // (left as it was: what two players agree on today — tools/smoke_mp_rooms.mjs — must not shift with _colOf)
    for (let i = 0; i < 6; i++) {
      const a = hh(p.sid, k, 10 + i) * TAU, r = Math.sqrt(hh(p.sid, k, 20 + i)) * W.radius;
      const tx = p.homeX + Math.sin(a) * r, tz = p.homeZ + Math.cos(a) * r;
      if (col && col.raycast(p.homeX, p.homeZ, tx, tz) !== null) continue;
      if (p.place === 'world' && this._wetLine(p.homeX, p.homeZ, tx, tz)) continue;
      return [tx, tz];
    }
    return [p.homeX, p.homeZ];
  }
  /** Idle lines for scripted / porter NPCs, decided by the shared clock and the NPC's id: everyone near hears the same one. */
  _detLine(p) {
    if (!p.lines || !p.lines.length || p.down) return;
    const now = this.game.time ? this.game.time.now() : Date.now(), id = p.sid || p.lookSeed || 1;
    const s = Math.floor(now / 6000 + hh(id, 0, 5));
    if (s === p.lineS) return;
    p.lineS = s;
    const P = SPEECH.idleSlot;
    if (hh(id, s, 6) > P || !this._anyPlayerNear(p, 6)) return;
    // (its lines in a shuffled order, by how many of its slots have spoken: the same for everyone, nothing twice running)
    const text = epochLine(p.lines, s, spokenBefore(s, (q) => hh(id, q, 6) <= P), id);
    note(text, now / 1000); p.character.say(text, 3);
  }
  _anyPlayerNear(p, r) {
    const g = this.game, pl = g.player;
    if (pl.place === p.place && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < r) return true;
    const others = g.net && g.net.connected ? g.net.others : null;
    if (others) for (const o of others.values()) if (o.place === p.place && Math.hypot(o.tx - p.x, o.tz - p.z) < r) return true;
    return false;
  }
  /** distance to the nearest player (multiplayer: any player in the world; else us) */
  _pd(x, z, pp) { const S = this._S; return S ? (this.game.player.place === 'world' ? Math.min(Math.hypot(x - pp.x, z - pp.z), S.core.nearestD(x, z)) : S.core.nearestD(x, z)) : Math.hypot(x - pp.x, z - pp.z); }
  /** ambient walkers (ours + proxies) within r of (x,z) */
  _countNear(x, z, r) {
    let n = 0; const r2 = r * r, L = this.list;
    for (let i = 0; i < L.length; i++) { const p = L[i]; if (p.active && !p.child && !p.scripted && !p.det && p.place === 'world' && (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < r2) n++; }
    return n;
  }

  /** the remark of somebody a player has walked into (not every time: the usual pause between lines) */
  _bumpSay(p, sp) { if (p.sayCd <= 0 && sp > 2) this._say(p, pick(LINES.react), 2, 6); }
  _say(p, text, secs, cd) { if (!p.character || p.remote || !text) return; note(text, this._now()); p.character.say(text, secs); p.sayCd = cd + Math.random() * cd; }
  /** seconds on the shared clock (what was heard when: _street_lines.js MEMORY) */
  _now() { const t = this.game.time; return (t ? t.now() : Date.now()) / 1000; }

  // ---------------------------------------------------------------- frame
  update(dt) {
    const g = this.game, pl = g.player;
    // In a walk-in room (core/interiors.js) the street is still there beyond the glass: the walkers outside carry on,
    // streamed and steered round the player's TRUE world position (pl.worldPos; pl.pos is in the room's own coordinates).
    const cur = g.interiors && g.interiors.current, walkIn = !!(cur && cur.sl && pl.place === cur.id && pl.worldPos);
    const pp = walkIn ? pl.worldPos : pl.pos;
    this.frame++;
    this._hour = g.time ? g.time.hour : 12;
    NOW_MS = g.time && g.time.now ? g.time.now() : 0;
    if ((this._kidT -= dt) <= 0) { this._kidT = 0.5; this._kidWatch(pp); }
    if (!this._tmpP) this._tmpP = { x: 0, z: 0 };
    const cam = g.camera;
    if (cam) { cam.getWorldDirection(this._fwd); }
    // player velocity (for dodging)
    const jump = Math.hypot(pp.x - this._last.x, pp.z - this._last.z);
    const plVx = dt > 0 && jump < 20 ? (pp.x - this._last.x) / dt : 0, plVz = dt > 0 && jump < 20 ? (pp.z - this._last.z) / dt : 0;
    const plSpeed = Math.hypot(plVx, plVz);
    this._last.copy(pp);
    { const v = this._pv || (this._pv = { x: 0, z: 0, s: 0 }); v.x = plVx; v.z = plVz; v.s = plSpeed; }
    this._sight(pl, pp, walkIn);
    const inWorld = pl.place === 'world' || walkIn;
    if (inWorld && jump > 60) this.burst = 1.5;
    if (this.obstacles.length && this.frame % 30 === 0 && g.time) {
      const now = g.time.now();
      for (let i = this.obstacles.length - 1; i >= 0; i--) { const u = this.obstacles[i].until; if (u !== null && u !== undefined && now > u) this.obstacles.splice(i, 1); }
    }

    // multiplayer: someone else is in the world (null when alone: everything below is exactly the solo behaviour)
    const S = this._mp();
    if (!this._netHooked && g.net) this._netHook();
    if (S && !this.protect._remoteWrap) this._protectRemotes();
    this._remF = S && S.core.remotes.length ? S.core.remotes : null;
    this._S = S;
    if (inWorld || (S && S.core.foci.length)) {
      const A = this.amb;
      // night-life density around the player (for night-time head counts)
      if ((this._nightT -= dt) <= 0) {
        this._nightT = 2; let n = 0, t = 0;
        for (let dx = -120; dx <= 120; dx += 20) for (let dz = -120; dz <= 120; dz += 20) { if (dx * dx + dz * dz > 14400) continue; t++; if (this.zone(pp.x + dx, pp.z + dz) & Z_NIGHT) n++; }
        this.nightFrac = t ? n / t : 0;
        // people who don't belong at this hour (tourists at 2am, clubbers at noon) quietly leave once out of sight
        for (let i = 0; i < A.length; i++) {
          const p = A[i];
          if (!p.active || p.leader || p.anim || p.ctl || p.role === 'porter') continue;
          if (this._pd(p.x, p.z, pp) < 50) continue;
          if (roleWeights(this.zone(p.x, p.z), this._hour, this.weights)[p.role] > 0) continue;
          if (!this._unseenOrFar(p.x, p.z)) continue;      // (really out of sight: not just 50 m down a straight street)
          this._deactivate(p); break;
        }
      }
      // despawn far ambient peds (multiplayer: far from every player) — DESPAWN_PER_FRAME a frame: after a long jump (a
      // door, a teleport) the whole old crowd used to be disposed in one frame (~1 ms a character); beyond DESPAWN they
      // are hidden anyway, so the rest go in the next frames
      for (let i = 0, n = 0; i < this.pool.length && n < DESPAWN_PER_FRAME; i++) {
        const p = this.pool[i];
        if (p.active && p.place === 'world' && (p.det || !S ? Math.hypot(p.x - pp.x, p.z - pp.z) : this._pd(p.x, p.z, pp)) > DESPAWN) { this._deactivate(p); n++; }
      }
      // spawn: alone, around us; in multiplayer, around each player whose surroundings we own (one focus per frame)
      const F = S ? S.core.foci[this.frame % Math.max(1, S.core.foci.length)] || null : null;
      // (busy-streets pass: a few more walkers by day in the centre's shopping streets on the medium / high tiers; the far
      // crowd beyond them is systems/crowd.js)
      const boost = this._boost(F || pp);
      if (S) this._grow((POOL + boost + KID_EXTRA) * Math.min(3, Math.max(1, S.core.foci.length)));
      else this._grow(POOL + boost + KID_EXTRA);
      // (fewer people out in the rain: game.weather.crowd, smooth, 0.4..1; the surplus goes by the usual out-of-sight drop
      // below, one every half second, never in view. No weather - headless tests - exactly as before.)
      const wx = this.game.weather, target = (wx && wx.crowd < 1 ? targetCount(this._hour, this.nightFrac) * Math.max(0.4, wx.crowd) : targetCount(this._hour, this.nightFrac)) + boost;
      const active = F ? this._countNear(F.x, F.z, 125) : this._activeCount();
      if (S && !F) { /* indoors and nobody to look after */ }
      // (a burst — just arrived somewhere new — makes BURST_PER_FRAME people a frame (was three: a character costs 4–7 ms
      // to build, and three of them plus the porters of every gate in range used to make one 40–75 ms frame on arriving
      // at St Giles'); the burst lasts a little longer for it. Counted, not timed: the same frames for the same steps.)
      else if (this._queue.length) {
        const tb = SPAWN_MS > 0 && g.quality && g.quality.level === 'ultra' ? SPAWN_MS : 0, t0 = tb ? performance.now() : 0; let cut = 0;
        for (let k = this.burst > 0 ? BURST_PER_FRAME : 1; k > 0 && this._queue.length; k--) { this._spawnFollower(this._queue.shift()); if (tb && k > 1 && performance.now() - t0 > tb) { cut = k - 1; break; } }
        if (this.burst > 0) this.burst -= dt * (BURST_PER_FRAME - cut) / 3;
      } else if (this.burst > 0 && (!F || F.me)) {
        const tb = SPAWN_MS > 0 && g.quality && g.quality.level === 'ultra' ? SPAWN_MS : 0, t0 = tb ? performance.now() : 0; let cut = 0;
        for (let k = 0; k < BURST_PER_FRAME && (F ? this._countNear(F.x, F.z, 125) : this._activeCount()) < target && !this._queue.length; k++) { this._trySpawn(8, this._hour, F); if (tb && k < BURST_PER_FRAME - 1 && performance.now() - t0 > tb) { cut = BURST_PER_FRAME - 1 - k; break; } }
        this.burst -= dt * (BURST_PER_FRAME - cut) / 3;
      } else if (active < target && (this._spawnT -= dt) <= 0) {
        this._trySpawn(SPAWN_MIN_BEHIND, this._hour, F);
        this._spawnT = active < target * 0.6 ? 0.05 : 0.25;
        if (S) this._spawnT /= Math.max(1, S.core.foci.length);
      } else if (active > target + 2 && this.frame % 30 === 0) {
        // too many for the time of day: quietly drop one that's out of sight
        for (let i = 0; i < A.length; i++) { const p = A[i]; if (p.active && !p.leader && !p.ctl && this._pd(p.x, p.z, pp) > 60 && this._unseenOrFar(p.x, p.z)) { this._deactivate(p); break; } }
      }
      // porters at college gates (day and evening)
      if (inWorld && (this._porterT -= dt) <= 0) {
        this._porterT = 1;
        const onDuty = this._hour >= 6.5 && this._hour < 23.5;
        for (const gt of this.porterGates) {
          const d = Math.hypot(gt.x - pp.x, gt.z - pp.z);
          if (gt.ped) { if (!onDuty && this._unseenOrFar(gt.x, gt.z)) this._deactivate(gt.ped); continue; }
          // (taken on while the gate is too far off to be drawn whole - he fades in with the distance - or out of sight;
          //  on arriving somewhere, wherever he is: he fades in with the street's people)
          if (!onDuty || d > SPAWN_FAR || (d < FADE_FAR && !(this.burst > 0 && d >= 30) && !this._unseen(gt.x, gt.z))) continue;
          let taken = false;   // a place module already put a scripted porter / NPC here
          for (const q of this.list) if (q.scripted && q.active && q.place === 'world' && Math.hypot(q.x - gt.x, q.z - gt.z) < 10) { taken = true; break; }
          if (!taken) { this._spawnPorter(gt); if (gt.ped) { this._porterT = 0.05; break; } }   // (one a frame: the rest a frame or two later)
        }
      }
      // chat pairs
      if ((this._chatT -= dt) <= 0) {
        this._chatT = 0.5;
        for (let i = 0; i < A.length; i++) {
          const a = A[i];
          if (!a.active || a.state !== 'walk' || a.dog || a.role === 'jogger' || this._isGroup(a)) continue;
          for (let j = i + 1; j < A.length; j++) {
            const b = A[j];
            if (!b.active || b.state !== 'walk' || b.dog || b.role === 'jogger' || this._isGroup(b)) continue;
            if (Math.abs(a.x - b.x) > 2.4 || Math.abs(a.z - b.z) > 2.4 || Math.random() > 0.3) continue;
            if (a.place === 'world' && (this.road(a.x, a.z, 1.5) || this.road(b.x, b.z, 1.5))) continue;      // (not in the middle of the road)
            const t = rand(6, 14);
            a.state = b.state = 'chat'; a.timer = b.timer = t; a.partner = b; b.partner = a;
            if (!a.drunk) a.character.setPose('talk'); if (!b.drunk) b.character.setPose('talk');
            break;
          }
        }
      }
      // ambient chatter near the player
      if ((this._sayT -= dt) <= 0) {
        const night = this._hour >= 22 || this._hour < 4;
        this._sayT = night ? rand(SPEECH.tickNight[0], SPEECH.tickNight[1]) : rand(SPEECH.tick[0], SPEECH.tick[1]);
        let best = null, n = 0;
        for (const p of this.list) {
          if (!p.active || p.place !== 'world' || p.down || p.sayCd > 0 || !p.lines) continue;
          if (S && (p.remote || p.scripted || p.det)) continue;          // multiplayer: owners speak for their own walkers (mirrored); scripted lines are clock-driven
          const d = S ? this._pd(p.x, p.z, pp) : Math.hypot(p.x - pp.x, p.z - pp.z);
          if (d > 22) continue;
          if (Math.random() * ++n < 1) best = p;
        }
        // one such opportunity in about six is taken (SPEECH.every): a fifth of the chatter there used to be. The walker passed
        // over pauses as if it had spoken, so who is free to speak, or to yelp at the player, is as it always was
        if (best) { if ((this._sayGap = (this._sayGap || nextGap()) - 1) <= 0) this._say(best, walkerLine(best.lines, contextOf(g, this.zone(best.x, best.z)), this._now()), 3.5, 20); else best.sayCd = 20 + Math.random() * 20; }
      }
    }
    if (this.doorways.length && (this._dwT -= dt) <= 0) { this._dwT = 0.5; this._doorTick(0.5, pp, inWorld, S); }
    this._animN = 0; this.animals.length = 0;
    const FR = g.friends && g.friends.npcs && g.friends.npcs.length ? g.friends.npcs : null;
    // per-ped updates
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (!p.active) continue;
      if (p.visit && p.place !== 'world') { this._visitRoom(p, dt, pl); if (p.active && p.dog && p.dogTie) { this._updateDog(p, dt); this._animal(p, 'dogX', 'dogZ', 0.22, 'dog'); } continue; }      // (in a shop: doorways, below; the dog tied up outside)
      // (who is kept alive: everyone in the player's place; the street while the player is in a walk-in room; the people
      //  of a walk-in room that is shown — seen through its windows and doorway. `pq` = the player as that person can
      //  know them: in their own place's coordinates, or nowhere near)
      const mine = p.place === pl.place;
      if (!mine && !(walkIn && p.place === 'world') && !(p.place !== 'world' && this._roomShown(p.place))) continue;
      const pq = mine ? pl.pos : p.place === 'world' ? pp : FAR_AWAY, here = mine || p.place === 'world';
      const x0 = p.x, z0 = p.z;
      if (p.remote) { if (p.dog) { this._updateDog(p, dt); this._animal(p, 'dogX', 'dogZ', 0.22, 'dog'); } }          // a proxy: crowdsync has put it where its owner says
      else if (p.cm && p.state === 'crowd' && !p.down && !p.ctl) this.solid.standWalk(p, dt, pq);      // (a far-crowd figure's stand-in)
      else if (p.scripted && p.wander && p.sid && !p.down && !p.ctl && (p.state === 'wpause' || p.state === 'wwalk')) this._detWander(p, dt, pq);
      else this._updatePed(p, dt, pq, here ? plSpeed : 0, here ? plVx : 0, here ? plVz : 0);
      if (!p.active) continue;
      if (!p.remote && p.place === 'world' && !p.down && !p.static && !p.det && !(p.scripted && p.wander && p.sid) && p.state !== 'sit' && p.state !== 'post' && p.state !== 'down' && ((this.frame + i) & 1) === 0 && this._near(p, 150)) this._separate(p, dt * 2);      // (every other frame)
      // nobody ends their own step inside a player (ours here; in multiplayer the others as we know them)
      if (!p.remote && !p.down) {
        if (mine && p.place === pl.place && !pl.vehicle && !pl.frozen) this.solid.clearOf(p, pl.pos, R_PLAYER, x0, z0);      // (not a player sat somewhere, in a conversation or in a vehicle: the bench beside them is still a seat)
        const RM = this._remF; if (RM && p.place === 'world') for (let k = 0; k < RM.length; k++) { const q = RM[k]; if (!q.veh && Math.abs(q.x - p.x) < 1 && Math.abs(q.z - p.z) < 1) this.solid.clearOf(p, q, R_REMOTE, x0, z0); }
        // (nor inside one of the friends — places/friends.js: they keep to their timetable, or tag along with a player,
        //  and the walkers used to go straight through them)
        if (FR && p.place === 'world' && (p.x !== x0 || p.z !== z0)) for (let k = 0; k < FR.length; k++) { const n = FR[k]; if (n.shown && !n.rm && Math.abs(n.pos.x - p.x) < 1 && Math.abs(n.pos.z - p.z) < 1 && Math.abs(n.pos.y - p.y) < 1.2) this.solid.clearOf(p, n.pos, R_REMOTE, x0, z0); }
      }
      // feet on the drawn surface (pavement, kerb, path, steps): resampled every 0.15 m walked (or 1.5 s, for things that
      // change under a standing figure), then eased, so stepping up a kerb is a small quick rise and never a pop
      {
        const mx = p.x - p.gx, mz = p.z - p.gz;
        if (p.gpl !== pl.place) { p.gpl = pl.place; p.gx = p.x; p.gz = p.z; p.y = p.gy = this._gh(p); }      // the player has just arrived here: no easing
        else if (mx * mx + mz * mz > 0.0225 || (p.yT -= dt) <= 0) { p.yT = 1.5; p.gx = p.x; p.gz = p.z; p.gy = this._gh(p); }
        const dy = p.gy - p.y;
        if (dy !== 0) p.y = Math.abs(dy) < 0.002 || Math.abs(dy) > 0.7 ? p.gy : p.y + dy * Math.min(1, dt * 14);
      }
      // occasional wall resolve for off-graph movers near the player
      const dPl = Math.hypot(p.x - pq.x, p.z - pq.z);
      if (dPl < 30 && !p.remote && (this.frame + i) % 6 === 0 && p.state !== 'walk' && p.state !== 'sit' && p.state !== 'post' && p.state !== 'static' && p.speed > 0) {
        const col = p.place === 'world' ? g.worldCollider : mine ? g.collider : null;
        if (col) {
          const q = this._tmpP; q.x = p.x; q.z = p.z; col.resolve(q, 0.28);
          if (p.place !== 'world' || !this.wet(q.x, q.z)) { p.x = q.x; p.z = q.z; }
        }
      }
      this._sync(p);
      if (p.dog && p.place === 'world') this._animal(p, 'dogX', 'dogZ', 0.22, 'dog');
      if (p.kit) {
        // the pushchair, at arm's length in front of the parent (hidden with them)
        const k = p.kit, fx = Math.sin(p.heading), fz = Math.cos(p.heading);
        k.position.set(p.x + fx * 0.74, p.y, p.z + fz * 0.74); if (k.rotation.y !== p.heading) k.rotation.y = p.heading;
      }
      // animation LOD: skip far peds and those behind the camera
      let anim = dPl < ANIM_FAR;
      if (anim && cam && dPl > 8) {
        const cx = p.x - cam.position.x, cz = p.z - cam.position.z, cl = Math.hypot(cx, cz) || 1;
        if ((this._fwd.x * cx + this._fwd.z * cz) / cl < -0.35) anim = false;
      }
      p.anim = anim;
      // drawn whole within FADE_FAR of the player, thinning to nothing at SHOW_FAR (so nobody pops in or out at the edge of
      // what is drawn); somebody made where they might be seen comes in over FADE_IN_S; the dog and the pushchair with them
      this._show(p, dPl, dt);
      // (beyond 30 m the limbs are posed at half rate, alternate walkers on alternate frames: no one can tell, and it pays
      // for the motion pass's look-before-you-step and keep-your-distance above)
      if (p.character.isDown || (anim && dPl < 30)) { p.character.update(dt + (p.animDt || 0), p.speed); p.animDt = 0; }
      else if (anim) { if (((this.frame + i) & 1) === 0) { p.character.update(dt + (p.animDt || 0), p.speed); p.animDt = 0; } else p.animDt = (p.animDt || 0) + dt; }
      else if (p.character.lodTick) p.character.lodTick();     // far/behind: still swap to the 1-draw-call impostor
    }
    // the park and college scenes (dogs off the lead, cats, tortoises, children at play: systems/_ped_scenes.js) add
    // their animals; then nobody protected is left in the way of anything on wheels
    if (this.scenes) this.scenes.update(dt, pp, inWorld);
    this.protect.update(dt);
  }
  /** an animal about this frame, for _ped_protect.js and the traffic (o[kx], o[kz]: where it is; r: its size) */
  _animal(o, kx, kz, r, kind) {
    let a = this._animPool[this._animN]; if (!a) this._animPool[this._animN] = a = { o: null, kx: 'x', kz: 'z', r: 0.2, kind: 'dog' };
    this._animN++; a.o = o; a.kx = kx; a.kz = kz; a.r = r; a.kind = kind || 'dog'; a.x = o[kx]; a.z = o[kz]; this.animals.push(a); return a;
  }
  /** twice a second: the children's rules, enforced whatever else has happened. Out of hours -> taken home (the whole
   *  family or party, removed); in Frewin Court, or anywhere but the open street -> removed, and counted (the tests
   *  require those counts to stay 0: nothing should ever get that far). */
  _kidWatch(pp) {
    const h = this._hour, L = this.list, K = this.kidStats;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (!p.active || p.remote || p.scripted || !(p.child || GUARD_ROLES[p.role])) continue;
      const teen = p.role === 'teen';
      let go = false;
      if (p.place !== 'world' || p.visit) { if (p.child) { K.indoors++; go = true; } }
      else if (p.child && noGo(p.x, p.z)) { K.noGo++; go = true; }
      else if (teen ? !teenMayBeOut(h, NOW_MS) : !mayBeOut(h)) go = true;
      else if ((teen ? !schoolRun(h, NOW_MS) : h >= CHILD_TO) && this._pd(p.x, p.z, pp) > 38 && this._unseenOrFar(p.x, p.z)) go = true;      // (time to go home: once nobody is near, and nobody is looking - the hard limit above takes them wherever they are)
      if (go) { this._sendHome(p); K.sentHome++; }
    }
  }
  /** remove a family / a school party / a group of pupils: its leader and everyone following */
  _sendHome(p) {
    const root = p.leader && p.leader.active ? p.leader : p;
    for (const q of this.list) if (q.active && !q.remote && q !== root && q.leader === root) { q.leader = null; this._deactivate(q); }
    if (root.active && !root.remote) this._deactivate(root); else if (p.active) this._deactivate(p);
  }


  // ---------------------------------------------------------------- doorways: walkers go into and come out of walk-in rooms
  // A doorway is the street door of a walk-in room (core/interiors.js "seamless": portal o.portal of room o.placeId).
  // While that room is SHOWN (so its real door is there) and open (o.hours()), every so often one walker passing on the
  // pavement turns off it, walks up to the door — which opens for them as it does for anyone (core/_doors.js: by where
  // people are and which way they are going) — waits clear of the leaf until the way is open, goes in, walks o.inside
  // (waypoints in the room's coordinates, each leg checked against the room's own walls), stands a while and comes out
  // the same way, a walker of the street again. A room that comes into view may already have somebody in it (who then
  // comes out). Inside, the walker is in the room's scene and coordinates (p.place = the room's id), is not sent to other
  // players (they see it go in at the door and, later, somebody come out), and is dropped if the room is hidden.
  // Cost: nothing but one test of a short list twice a second; nothing at all with no doorway registered.
  //   o: placeId, portal (index, default 0), hours: () => boolean, inside: [[x, z]…], cap (most inside at once, default 2),
  //      every (mean seconds between people going in while people are passing, default 28), dwell [min, max] seconds,
  //      x, z (optional: the point on the pavement they turn off at, world; default 1.5 m out from the door)
  addDoorway(o) {
    const dw = { placeId: o.placeId, portal: o.portal | 0, hours: typeof o.hours === 'function' ? o.hours : null, inside: o.inside || null, cap: o.cap ?? 2, every: o.every ?? 28, dwell: o.dwell || [14, 45],
      at: o.x !== undefined && o.z !== undefined ? [o.x, o.z] : null, n: 0, next: 4 + Math.random() * 10, def: null, P: null, A: null, path: null, live: false, bad: false, stats: { in: 0, out: 0 } };
    this.doorways.push(dw);
    return dw;
  }
  _dwResolve(dw) {
    const I = this.game.interiors, d = I && I.get ? I.get(dw.placeId) : null, S = d && d.sl; if (!S || !S.portals) return false;
    const P = S.portals[dw.portal]; if (!P || P.off || !(P.w > 0)) { dw.bad = true; return false; }
    dw.def = d; dw.P = P;
    dw.uA = P.depth + 1.5;
    dw.A = dw.at || S.toWorld(P.at[0] + P.dx * dw.uA, P.at[1] + P.dz * dw.uA, [0, 0]);
    if (dw.at) { const l = S.toLocal(dw.at[0], dw.at[1], [0, 0]); dw.uA = Math.max(P.depth + 0.8, (l[0] - P.at[0]) * P.dx + (l[1] - P.at[1]) * P.dz); }
    return true;
  }
  /** the way in, once the room is built: the door's plane and where to stand clear of its leaf on either side; the legs
   *  inside, each checked against the room's walls (cut short at the first that is not clear) */
  _dwPath(dw) {
    const d = dw.def, P = dw.P, D = P.door || null, col = d.collider;
    let uD = P.depth * 0.5, wOut = 0.75, wIn = 0.75;
    if (D) {
      uD = (D.pos[0] - P.at[0]) * P.dx + (D.pos[1] - P.at[1]) * P.dz;
      if (D.kind === 'hinged') {
        // (a leaf that opens towards you is waited for outside its arc; one you push, at arm's length)
        // (clear of the arc: on the doorway's axis, further from the hinge than the leaf is wide + a body; and no further
        //  than a locked door still answers someone inside it — places/_walkin_city.js cityDoor, 1.6 m)
        const o = D.o, sw = o.swing || 0, nOut = Math.cos(o.dir) * P.dx - Math.sin(o.dir) * P.dz, clear = Math.min(1.55, Math.sqrt((o.w + 0.4) * (o.w + 0.4) - o.w * o.w / 4) + 0.05);
        wOut = sw && sw * nOut > 0 ? clear : 0.85; wIn = sw && sw * nOut < 0 ? clear : 0.85; if (!sw) { wOut = wIn = 0.9; }
      } else { wOut = 0.9; wIn = 0.9; }
    }
    // (uX: where the street ends and the room begins for the eye — the plane the doorway is punched on: the shell's face,
    //  or the back of a recessed shop lobby; a walker changes scene there)
    dw.uX = P.depth + Math.min(0, P.proud ?? 0);
    dw.uD = uD; dw.uOut = Math.max(uD + wOut, dw.uX + 0.25); dw.uIn = uD - wIn;
    if (dw.uA < dw.uOut + 0.2) dw.uA = dw.uOut + 0.2;
    // the first point inside: on the doorway's axis, clear of the leaf's swing
    const at = (u) => [P.at[0] + P.dx * u, P.at[1] + P.dz * u];
    let u0 = Math.min(-1.1, dw.uIn - 0.25);
    const free = (a, b) => !col || col.raycast(a[0], a[1], b[0], b[1]) === null;
    const a0 = at(Math.min(-0.25, uD - 0.2));
    while (u0 < -0.5 && !free(a0, at(u0 - 0.3))) u0 += 0.25;
    if (!free(a0, at(u0))) { dw.bad = true; return; }
    dw.uIn = Math.max(dw.uIn, u0 + 0.05);
    const path = [at(u0)];
    for (const q of dw.inside || []) { const a = path[path.length - 1]; if (!free(a, q) || (col && col.isFree && !col.isFree(q[0], q[1], 0.3))) break; path.push([q[0], q[1]]); }
    if (path.length === 1) { const q = at(u0 - 1.6); if (free(path[0], at(u0 - 1.95))) path.push(q); }      // (no way given: a few steps straight in)
    dw.path = path;
  }
  _dwOpen(dw) { if (dw.P.door && dw.P.door.locked) return false; if (!dw.hours) return true; try { return !!dw.hours(); } catch { return false; } }
  _doorTick(dt, pp, inWorld, S) {
    const DW = this.doorways, g = this.game;
    for (let k = 0; k < DW.length; k++) {
      const dw = DW[k];
      if (dw.bad || (!dw.def && !this._dwResolve(dw))) continue;
      const d = dw.def, sl = d.sl;
      if (!sl || !sl.shown || !d.built || !d.scene || Math.abs(dw.A[0] - pp.x) + Math.abs(dw.A[1] - pp.z) > 80) { dw.live = false; continue; }
      if (!dw.path) { this._dwPath(dw); if (dw.bad || !dw.path) continue; }
      const first = !dw.live; dw.live = true;
      if (!inWorld || !this._dwOpen(dw)) continue;
      // multiplayer: a walker is sent in by whoever owns it (and the others are told at the door: 'doorin' below).
      // Somebody already inside when the room first comes into view is the SAME somebody for every player: who (if
      // anyone) and until when is a function of the door and the shared clock (slots as long as the longest stay) —
      // every client puts them in for itself; only the copy of the player who looks after this street walks on down
      // the pavement afterwards, the others' go at the door as that one comes out of it.
      if (!this._dwNet && g.net && g.net.on) { this._dwNet = true; try { g.net.on('doorin', (d) => this._doorIn(d)); } catch { /* solo */ } }
      if (first) {
        const near = Math.hypot(dw.A[0] - pp.x, dw.A[1] - pp.z);
        if (near > 14 && dw.n < dw.cap) {
          const now = (g.time ? g.time.now() : Date.now()) / 1000, len = Math.max(20, dw.dwell[1]), k = Math.floor(now / len), dk = strHash('door|' + dw.placeId);
          const left = (k + 0.45 + 0.55 * hh(dk, k, 2)) * len - now;
          if (hh(dk, k, 1) < 0.6 && left > 4) this._seedVisitor(dw, ((hh(dk, k, 3) * 1e9) | 0) || 1, left, !!S && !S.core.spawnOk(dw.A[0], dw.A[1]));
        }
        continue;
      }
      if (dw.n >= dw.cap || (dw.next -= dt) > 0) continue;
      const p = this._dwCandidate(dw);
      if (!p) { dw.next = 1.5; continue; }
      dw.next = dw.every * (0.5 + Math.random());
      p.visit = { dw, ph: 0, t: 0, i: 0, w: 0, dwell: 0 }; dw.n++;
      p.state = 'ctl'; p.ctl = this._visitCtl; p.stallT = 0;
    }
  }
  /** how far out from doorway dw's wall face the world point (x, z) is (m along the doorway's axis: the door stands at dw.uD) */
  _dwU(dw, x, z) { const P = dw.P, l = dw.def.sl.toLocal(x, z, this._dwL || (this._dwL = [0, 0])); return (l[0] - P.at[0]) * P.dx + (l[1] - P.at[1]) * P.dz; }
  /**
   * May a walker be MOVED from where it stands to (x1, z1) — a step aside for a player, a stagger, a hop clear of a car,
   * being kept clear of a player (systems/_ped_solid.js) — as far as the street doors go? The collider is open at a
   * doorway (the leaf is the door's own business: _axis walks its visitors through it when it is open), so such a move
   * must be told: never across the plane of a door that is not open, and never across the plane where the street ends
   * and the room begins (a walker changes scene there, on its own walk, nowhere else). Through its OWN open door a
   * visitor may step. Beside the doorway the walls already say no; a move that crosses the plane clear of the opening
   * (along a front that bends) is the street's business.
   */
  _doorFree(p, x1, z1) {
    const D = this.doorways;
    for (let i = 0; i < D.length; i++) {
      const dw = D[i]; if (dw.uD === undefined || !dw.def || !dw.P) continue;
      const S = dw.def.sl, P = dw.P, inRoom = p.place === dw.placeId; if (!S) continue;
      if (!inRoom && (p.place !== 'world' || !dw.A || Math.abs(dw.A[0] - p.x) > 8 || Math.abs(dw.A[1] - p.z) > 8)) continue;
      let ax = p.x, az = p.z, bx = x1, bz = z1;
      if (!inRoom) { const l = this._dwL || (this._dwL = [0, 0]); S.toLocal(p.x, p.z, l); ax = l[0]; az = l[1]; S.toLocal(x1, z1, l); bx = l[0]; bz = l[1]; }
      const u0 = (ax - P.at[0]) * P.dx + (az - P.at[1]) * P.dz, u1 = (bx - P.at[0]) * P.dx + (bz - P.at[1]) * P.dz;
      const t0 = (ax - P.at[0]) * P.tx + (az - P.at[1]) * P.tz, t1 = (bx - P.at[0]) * P.tx + (bz - P.at[1]) * P.tz, hw = P.w / 2 + 0.3;
      for (let k = 0; k < 2; k++) {
        const up = k ? dw.uX : dw.uD; if (up === undefined || (u0 - up) * (u1 - up) >= 0) continue;
        if (Math.abs(t0 + (t1 - t0) * ((u0 - up) / (u0 - u1))) > hw) continue;      // (clear of the opening)
        if (k === 0 && P.open && p.visit && p.visit.dw === dw) continue;            // (its own door, open)
        return false;
      }
    }
    return true;
  }
  /** an ordinary walker passing the door, on its side of the road, with a clear walk to it */
  _dwCandidate(dw) {
    const A = this.amb, ax = dw.A[0], az = dw.A[1], col = this.game.worldCollider;
    for (let i = 0; i < A.length; i++) {
      const p = A[i];
      if (!p.active || p.remote || p.place !== 'world' || p.state !== 'walk' || p.ctl || p.leader || (p.dog && (p.dogLoose || p.dogState !== 'follow' || this.road(p.dogX, p.dogZ))) || p.down || p.drunk || p.visit) continue;
      if (p.role === 'jogger' || p.role === 'porter' || p.role === 'police' || p.role === 'builder' || p.role === 'subfusc' || p.child || GUARD_ROLES[p.role]) continue;      // (no child goes in at any door, nor anyone with one)
      const dx = ax - p.x, dz = az - p.z, d = Math.hypot(dx, dz);
      if (d > 11 || d < 0.8) continue;
      if (this.road(p.x + dx * 0.33, p.z + dz * 0.33) || this.road(p.x + dx * 0.66, p.z + dz * 0.66) || this.road(ax, az)) continue;
      if (col.raycast(p.x, p.z, ax, az) !== null || this._isGroup(p)) continue;
      // (…and in front of the door: out on the street side of the door's plane by a body's reach. Someone round the corner
      //  of a corner shop, or along a front that bends, is BEHIND that plane with a clear walk to the turn-off point, and
      //  walked across the line of the shut door on the way to it — beside the door, not through it; not theirs to take)
      { const S = dw.def.sl, P = dw.P, l = S.toLocal(p.x, p.z, this._dwL || (this._dwL = [0, 0])); if ((l[0] - P.at[0]) * P.dx + (l[1] - P.at[1]) * P.dz < dw.uD + 0.35) continue; }
      return p;
    }
    return null;
  }
  /** somebody already inside when the room comes into view (they come out in their own time) */
  _seedVisitor(dw, sd = newSeed(), dwell = 3 + Math.random() * dw.dwell[1] * 0.6, guest = false) {
    const p = this._free(); if (!p) return null;
    const d = dw.def, path = dw.path, slot = this._dwSlot(dw, p), e0 = this._dwStand(path, slot, dw), e = [e0[0], e0[1]], role = this._hour >= 21 || this._hour < 5 ? 'townie' : 'shopper';
    this._activate(p, role, lookFor(role, sd), e[0], e[1], hh(sd, 5, 91) * TAU, d.scene, 0, sd);
    p.place = dw.placeId; p.state = 'ctl'; p.ctl = this._visitCtl; p.character.noLod = true;
    p.visit = { dw, ph: 3, t: 0, i: path.length - 1, w: 0, dwell, guest, slot }; dw.n++;
    p.y = p.gy = this._roomY(dw, p.x, p.z); this._sync(p);
    this.doorStats.seeded++;
    return p;
  }
  /** Where a visitor stands in the shop. Everyone used to walk to the END of the doorway's path and stand there: two or
   *  three shoppers on one spot, inside each other, for as long as they stayed (the worst class of the 2026-11 audit).
   *  Each now takes the lowest free place (_dwSlot) and stands that many steps of 0.62 m back from the end along the
   *  last leg of the path — and to alternate sides of it once the leg is used up. */
  _dwSlot(dw, p) { let used = 0; for (const q of this.list) { const V = q.visit; if (q !== p && q.active && V && V.dw === dw && (V.ph === 2 || V.ph === 3)) used |= 1 << (V.slot | 0); } let k = 0; while (k < 12 && (used >> k) & 1) k++; return k; }
  _dwStand(path, slot, dw) {
    const n = path.length, b = path[n - 1]; if (!slot || n < 2) return b;
    const a = path[n - 2], ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez); if (L < 0.2) return b;
    // (never nearer the door than 1.6 m along the leg — somebody standing in a hinged door's swing holds it half open —
    //  and never in a shelf: a place the room's collider does not leave free is not taken, they stand at the end as before)
    const room = Math.max(0, L - (n === 2 ? 1.6 : 0.3)), back = Math.min(slot * 0.62, room), over = Math.ceil((slot * 0.62 - back) / 0.62 - 1e-6), side = over > 0 ? (over % 2 ? 0.55 : -0.55) * Math.ceil(over / 2) : 0;
    const q = this._dwQ || (this._dwQ = [0, 0]);
    q[0] = b[0] - (ex / L) * back + (ez / L) * side; q[1] = b[1] - (ez / L) * back - (ex / L) * side;
    const c = dw && dw.def && dw.def.collider;
    if (c && c.isFree && (!c.isFree(q[0], q[1], 0.25) || c.raycast(b[0], b[1], q[0], q[1]) !== null)) return b;
    return q;
  }
  _roomY(dw, x, z) { const d = dw.def; let y = dw.P.y || 0; if (d.ground) { try { const g = d.ground(x, z); if (g === g && Number.isFinite(g)) y = g; } catch { /* the doorway's own floor */ } } return y; }
  /** the owner of a tied dog is no longer inside (out again, or gone): the stand-in the other players saw goes */
  _tieOver(p) { const T = p.tieStand; if (T) { if (T.nid && this.sync) this.sync.core.removed(T); p.tieStand = null; } }
  _visitEnd(p) { const V = p.visit; if (V) { V.dw.n = Math.max(0, V.dw.n - 1); p.visit = null; } p.vx = p.vz = 0; if (p.character) p.character.noLod = false; if (p.dogTie && p.place === 'world') { p.dogTie = null; this._tieOver(p); } }      // (out again: the dog is untied)
  /** through the doorway along its axis towards u = uT (u: metres out from the room's wall face). Waits clear of the door
   *  until the way is open; changes frame (street <-> room) at the plane the doorway is punched on. -> 1 there, 0 walking, -1 waiting */
  _axis(p, dw, uT, dt) {
    const d = dw.def, S = d.sl, P = dw.P, inRoom = p.place !== 'world', l = this._dwL || (this._dwL = [0, 0]);
    if (inRoom) { l[0] = p.x; l[1] = p.z; } else S.toLocal(p.x, p.z, l);
    const rx = l[0] - P.at[0], rz = l[1] - P.at[1], u = rx * P.dx + rz * P.dz, lat = rx * P.tx + rz * P.tz, inward = uT < u;
    // (a player is pressing on them in the doorway, where two cannot pass: they have stepped back — systems/_ped_solid.js —
    //  and wait a moment for the player to come through, instead of walking straight back into them)
    if (p.hopT > 0 || p.yieldT > 0) { p.speed = 0; return 0; }
    let tgt = uT, wait = false;
    if (!P.open) {      // (the door is not yet wide enough to walk through: no nearer than clear of its leaf)
      // (…and someone shoved or jostled in past that line while they waited — still on their own side of the door's
      //  plane, in the frame they came in — steps back out to it: they used to walk on, through the shut leaf)
      if (inward && (u >= dw.uOut - 0.03 || (!inRoom && u > dw.uD))) { tgt = Math.max(uT, dw.uOut); wait = Math.abs(u - dw.uOut) < 0.06; }
      else if (!inward && (u <= dw.uIn + 0.03 || (inRoom && u < dw.uD))) { tgt = Math.min(uT, dw.uIn); wait = Math.abs(dw.uIn - u) < 0.06; }
    }
    // which way they are going, for the door (core/interiors.js _people reads vx, vz in the frame the walker is in)
    const sg = inward ? -1 : 1, ax = P.dx * sg, az = P.dz * sg;
    if (inRoom) { p.vx = ax; p.vz = az; } else { p.vx = ax * S.c + az * S.s; p.vz = -ax * S.s + az * S.c; }
    const hLocal = Math.atan2(ax, az);
    if (wait && Math.abs(lat) < 0.08) { p.speed = 0; p.heading += wrapA(hLocal + (inRoom ? 0 : S.rot) - p.heading) * Math.min(1, dt * 6); return -1; }
    const tx = P.at[0] + P.dx * tgt, tz = P.at[1] + P.dz * tgt, ex = tx - l[0], ez = tz - l[1], dist = Math.hypot(ex, ez);
    if (dist < 0.06) { p.speed = 0; return tgt === uT ? 1 : -1; }
    const v = Math.min(p.vmax, 1.35), step = Math.min(dist, v * dt), nx = l[0] + ex / dist * step, nz = l[1] + ez / dist * step;
    const nu = (nx - P.at[0]) * P.dx + (nz - P.at[1]) * P.dz, want = Math.atan2(ex, ez);
    if (!inRoom && nu <= dw.uX - 0.02) { this._toRoom(p, dw, nx, nz); p.heading += wrapA(want - p.heading) * Math.min(1, dt * 7); }
    else if (inRoom && nu >= dw.uX) { this._toStreet(p, dw, nx, nz); p.heading += wrapA(want + S.rot - p.heading) * Math.min(1, dt * 7); }
    else if (inRoom) { p.x = nx; p.z = nz; p.heading += wrapA(want - p.heading) * Math.min(1, dt * 7); }
    else { S.toWorld(nx, nz, l); p.x = l[0]; p.z = l[1]; p.heading += wrapA(want + S.rot - p.heading) * Math.min(1, dt * 7); }
    p.speed = dt > 0 ? step / dt : 0;
    return dist - step < 0.06 && tgt === uT ? 1 : 0;
  }
  _toRoom(p, dw, lx, lz) {
    const d = dw.def, S = d.sl;
    if (p.nid && this.sync) this.sync.core.removed(p);      // (other players: it has gone in at the door)
    // …and they are told who went in where, so that each puts the same person inside (_doorIn): the same look, the same
    // length of stay (from the look's seed), walking the same way in from the door
    { const net = this.game.net; if (net && net.connected && net.send && !p.remote && !(p.visit && p.visit.guest)) { try { net.send('doorin', { k: dw.placeId, r: NET_ROLES.indexOf(p.role), lk: p.lookKind, s: p.lookSeed, h: p.lookHour }); } catch { /* not connected */ } } }
    p.x = lx; p.z = lz; p.heading -= S.rot; p.place = dw.placeId; p.scene = d.scene; d.scene.add(p.character.group);
    p.y = p.gy = this._roomY(dw, lx, lz); p.gx = lx; p.gz = lz; p.character.noLod = true;
    p.character.headTurn(0);
    this.doorStats.in++; dw.stats.in++;
  }
  /** multiplayer: someone else's walker has gone in at a door (their 'doorin'): the same person, ours to draw while inside */
  _doorIn(m) {
    if (!m || typeof m.k !== 'string') return;
    const dw = this.doorways.find((q) => q.placeId === m.k); if (!dw || !dw.live || !dw.path || !dw.def || !dw.def.scene) return;
    const p = this._free(); if (!p) return;
    const role = NET_ROLES[m.r] || 'shopper', path = dw.path, e = path[0], sd = (m.s >>> 0) || 1;
    this._activate(p, role, lookOf(m.lk, role, sd, m.h), e[0], e[1], Math.atan2(-dw.P.dx, -dw.P.dz), dw.def.scene, m.lk, sd);
    p.lookHour = m.h; p.place = dw.placeId; p.state = 'ctl'; p.ctl = this._visitCtl; p.character.noLod = true;
    p.visit = { dw, ph: 2, t: 0, i: 1, w: 0, dwell: 0, guest: true }; dw.n++;
    p.y = p.gy = this._roomY(dw, p.x, p.z); this._sync(p);
    this.doorStats.guests = (this.doorStats.guests || 0) + 1;
  }
  _toStreet(p, dw, lx, lz) {
    const d = dw.def, S = d.sl, w = S.toWorld(lx, lz, this._dwL);
    p.x = w[0]; p.z = w[1]; p.heading += S.rot; p.place = 'world'; p.scene = this.game.worldScene; p.scene.add(p.character.group);
    p.y = p.gy = this._gh(p); p.gx = p.x; p.gz = p.z; p.gpl = null; p.freeB = 0; p.character.noLod = false;
    this.doorStats.out++; dw.stats.out++;
  }
  /** a visiting walker while it is in the street (its controller): to the door, in; and, come out again, on to the pavement */
  _visitWorld(p, dt) {
    const V = p.visit; if (!V) return false;
    if (p.down) { this._visitEnd(p); p.ctl = null; p.state = 'down'; return true; }      // (knocked: the fall is the walk state machine's)
    const dw = V.dw, S = dw.def.sl;
    V.t += dt;
    if (!S || !S.shown || p.place !== 'world') { this._visitEnd(p); return false; }
    if (V.ph === 0) {
      // (called in from in front of the door — _dwCandidate — but the walk to the turn-off point is the street's own,
      //  round whatever stands on the pavement: one who has slid along a shop front to BEHIND the plane of the door,
      //  beside it, would walk back across the line of the shut door to reach the point. Not theirs any more: they walk on.)
      if (dw.uD !== undefined && this._dwU(dw, p.x, p.z) < dw.uD + 0.2) { this.doorStats.gaveUp++; this._visitEnd(p); return false; }
      if (this._moveTo(p, dw.A[0], dw.A[1], p.vmax, dt) < 0.3) {
        V.ph = 1; V.t = 0;
        // the dog is tied up by the door (the lead to the wall beside it) and told to wait
        if (p.dog && !p.dogTie) {
          // (out on the pavement beside the way to the door - as far out as the walkers turn off it, clear of any bay
          // window or step - the lead looped to the foot of the shop front behind it)
          const P = dw.P, S2 = dw.def.sl, uo = Math.max(1.0, dw.uA - 0.1), w0 = S2.toWorld(P.at[0] + P.tx * 1.25 + P.dx * (uo - 0.55), P.at[1] + P.tz * 1.25 + P.dz * (uo - 0.55), [0, 0]), w1 = S2.toWorld(P.at[0] + P.tx * 1.25 + P.dx * uo, P.at[1] + P.tz * 1.25 + P.dz * uo, [0, 0]);
          let sx = w1[0], sz = w1[1];
          if (this.wet(sx, sz) || this.road(sx, sz) || !this.game.worldCollider.isFree(sx, sz, 0.15)) { sx = p.dogX; sz = p.dogZ; }
          p.dogTie = { x: sx, z: sz, rx: w0[0], rz: w0[1], y: p.y, dx: dw.A[0], dz: dw.A[1] }; p.dogState = 'follow'; p.dogLoose = 0; this.kidStats.tied++;
          if (p.sayCd <= 0 || Math.random() < 0.6) this._say(p, pick(LINES.dogtie), 2.5, 10);
        }
      }
      else if (V.t > 14 || !this._dwOpen(dw)) { this.doorStats.gaveUp++; this._visitEnd(p); return false; }
      return true;
    }
    if (V.ph === 1) {
      // (shut in their face — closing time, or the door will not open: they give it up)
      if (!this._dwOpen(dw) || V.w > 6) { this.doorStats.gaveUp++; this._visitEnd(p); return false; }
      const r = this._axis(p, dw, dw.path ? Math.min(-0.6, (dw.path[0][0] - dw.P.at[0]) * dw.P.dx + (dw.path[0][1] - dw.P.at[1]) * dw.P.dz) : -1.1, dt);
      V.w = r < 0 ? V.w + dt : 0;
      if (p.place !== 'world') { V.t = 0; }      // (now the room's: _visitRoom from the next frame)
      return true;
    }
    // ph 5: out of the door, to the pavement, and away
    const r = this._axis(p, dw, dw.uA, dt);
    if (r > 0 || V.t > 12) { this._visitEnd(p); return false; }
    return true;
  }
  /** …and while it is in the room (room coordinates; the room's own scene) */
  _visitRoom(p, dt, pl) {
    const V = p.visit, dw = V.dw, d = dw.def, S = d.sl, g = this.game;
    if (!S || !S.shown || !d.scene || !dw.path) { this.doorStats.dropped++; this._deactivate(p); return; }
    const path = dw.path, ch = p.character, vx0 = p.x, vz0 = p.z;
    V.t += dt; p.speed = 0;
    if (p.yieldT > 0) p.yieldT -= dt;
    const walk = (q) => {
      if (p.hopT > 0 || p.yieldT > 0) return false;      // (stepped out of a player's way: a moment's pause before going on)
      const ex = q[0] - p.x, ez = q[1] - p.z, dist = Math.hypot(ex, ez); if (dist < 0.08) return true;
      const step = Math.min(dist, Math.min(p.vmax, 1.15) * dt); p.x += ex / dist * step; p.z += ez / dist * step; p.speed = dt > 0 ? step / dt : 0;
      p.heading += wrapA(Math.atan2(ex, ez) - p.heading) * Math.min(1, dt * 7); return dist - step < 0.08;
    };
    if (V.ph === 1) { const u0 = (path[0][0] - dw.P.at[0]) * dw.P.dx + (path[0][1] - dw.P.at[1]) * dw.P.dz; if (this._axis(p, dw, u0, dt) > 0) { V.ph = 2; V.i = 1; V.slot = this._dwSlot(dw, p); p.vx = p.vz = 0; } }
    else if (V.ph === 2) {
      // (how long they stay, and whether on the phone: from their look's seed — the same for every player who has them)
      if (V.i >= path.length) { const sd = p.lookSeed || 1; V.ph = 3; V.t = 0; V.dwell = dw.dwell[0] + hh(sd, 3, 91) * (dw.dwell[1] - dw.dwell[0]); if (hh(sd, 4, 91) < 0.3) ch.setPose('phone'); }
      else if (walk(V.i === path.length - 1 ? this._dwStand(path, V.slot | 0, dw) : path[V.i])) V.i++;
    } else if (V.ph === 3) {
      // (closing time: everybody out)
      if (V.t > V.dwell || (dw.hours && V.t > 2 && !this._dwHours(dw))) { V.ph = 4; V.i = path.length - 2; ch.setPose(p.basePose); }
    } else if (V.ph === 4) {
      if (V.i < 0) { V.ph = 5; V.t = 0; V.w = 0; }
      else if (walk(path[V.i])) V.i--;
    } else {
      const r = this._axis(p, dw, dw.uA, dt);
      // (the door will not open — or the way is blocked — for a long time: gone, out of sight of the street)
      V.w = r < 0 ? V.w + dt : 0; if (V.w > 20) { this.doorStats.dropped++; this._deactivate(p); return; }
      if (p.place === 'world' && V.guest) { this._visitEnd(p); this._deactivate(p); return; }      // (another player's walker, or a shared somebody not ours to walk on: its owner's comes out of the door here)
      if (p.place === 'world') { V.t = 0; this._sync(p); return; }      // (out: the street's walker again — _visitWorld takes it on to the pavement)
    }
    // the local player in the room: out of their way
    // (a body the player cannot walk into: pressed, a step aside; and its own step never ends inside the player)
    if (pl.place === p.place) {
      const ex = p.x - pl.pos.x, ez = p.z - pl.pos.z, dd = Math.hypot(ex, ez);
      if (p.pressV > 0.2 && dd > 1e-3 && dd < 1.5) this.solid.pressed(p, ex / dd, ez / dd, p.pressV, p.pressS, pl.heading, pl, dt); else if (p.pressT > 0) p.pressT = Math.max(0, p.pressT - dt);
      if (p.hopT > 0) this.solid.hop(p, dt);
      const cut = this.solid.clearOf(p, pl.pos, R_PLAYER, vx0, vz0);
      // (the player is standing where they meant to stand: they stop where they are, rather than keep walking at the player)
      if (V.ph === 2 && V.i === path.length - 1) { V.blk = cut || p.hopT > 0 || p.yieldT > 0 ? (V.blk || 0) + dt : 0; if (V.blk > 0.6) { V.blk = 0; V.i = path.length; } }
    }
    p.pressV = 0; if (p.bumpT > 0) p.bumpT -= dt;
    const gy = this._roomY(dw, p.x, p.z), dy = gy - p.y;
    p.y = Math.abs(dy) < 0.002 || Math.abs(dy) > 0.7 ? gy : p.y + dy * Math.min(1, dt * 14);
    this._sync(p);
    ch.group.visible = true;
    ch.update(dt, p.speed);
  }
  _dwHours(dw) { try { return !dw.hours || !!dw.hours(); } catch { return true; } }

  // ---------------------------------------------------------------- public API
  /**
   * Hit by something moving at (vx, vz) (a vehicle; the police's shove). By the speed: under HOP_V they hop clear with a
   * shout (returns 'dodge'); up to TUMBLE_V knocked over ('fall', a short slide); faster, thrown up and over the bonnet
   * ('tumble': a roll, a slide to rest, lying dazed, sitting up, dusting off and shaking a fist). Returns true / false.
   * mass (kg; 0 = not given): what struck them, when it is a vehicle (systems/vehicles.js). Then (vx, vz) is the blow at
   * the contact and they get the share of it a body of that mass can give (systems/_collide.js personShare: a bus all of
   * it, a bicycle and its rider a little over half), which is what the three bands above go by, and they are thrown at
   * THROW_K of that speed (to THROW_MAX), sliding to rest at SLIDE_DEC: how far they go grows with how hard they were
   * hit. Without a mass (a shove, a fist, the tussle) everything is as it was.
   */
  knock(p, vx = 0, vz = 0, from = null, mass = 0) {
    if (!p || !p.active || !p.character || p.knockable === false || p.child || this._hasKids(p)) return false;      // (a child is never knocked over, by anything, nor the adult whose hand it holds or who pushes its pushchair: _ped_protect.js keeps vehicles off them)
    if (p.remote) { p = this.own(p); if (!p) return false; }        // someone else's walker: ours now (everyone sees the fall)
    const now = this.game.elapsed || performance.now() / 1000;
    if (p.down && now - p.knockT < 1.5) return false;
    const rvx = vx, rvz = vz, veh = mass > 0 && Number.isFinite(mass);
    if (veh) { const sh = personShare(mass); vx *= sh; vz *= sh; }
    const v0 = Math.hypot(vx, vz);
    if (v0 < HOP_V) {
      if (p.down || p.state === 'sit' || p.hopT > 0 || (p.bumpT > 0 && p.bumpT > 1.0)) return false;
      // hop clear, sideways off the vehicle's line (whichever side is open), with a shout
      const ux = v0 > 0.05 ? vx / v0 : Math.sin(p.heading), uz = v0 > 0.05 ? vz / v0 : Math.cos(p.heading);
      const col = p.place === 'world' ? this.game.worldCollider : this.game.collider;
      let side = ((p.sid || p.lookSeed || 0) & 1) ? 1 : -1;
      for (const s of [side, -side]) { const cx = p.x + uz * s * 1.2, cz = p.z - ux * s * 1.2; if ((p.place !== 'world' || !this.wet(cx, cz)) && (!col || col.isFree(cx, cz, 0.28))) { side = s; break; } }
      p.hopVx = uz * side * 3.2 + ux * 0.8; p.hopVz = -ux * side * 3.2 + uz * 0.8; p.hopT = 0.38; p.bumpT = 1.4;
      p.heading = Math.atan2(-vx, -vz);
      p.character.setPose('stumble');
      if (p.sayCd <= 0 || Math.random() < 0.5) this._say(p, pick(LINES.dodge), 2, 5);
      return 'dodge';
    }
    p.knockT = now;
    if (p.bench) { p.bench.busy = false; p.bench = null; }
    if (p.partner) { const q = p.partner; q.partner = null; p.partner = null; if (q.state === 'chat') { q.character.setPose(q.basePose); q.state = 'walk'; } }
    const v = v0, big = v >= TUMBLE_V;
    if (v > 0.1) p.heading = Math.atan2(-vx, -vz);
    // thrown at a share of the speed (a lot more of it when bowled over at speed), scrubbing to rest on the ground
    // (struck by a vehicle: at THROW_K of what the blow gave them, whatever the band - a harder hit throws them further)
    const k = veh ? Math.min(THROW_K, THROW_MAX / Math.max(v, 1e-3)) : big ? Math.min(0.6, 6.5 / v) : Math.min(1, 3.5 / Math.max(v, 1e-3)) * 0.35;
    p.vx = vx * k * (v > 0.1 ? 1 : 0); p.vz = vz * k * (v > 0.1 ? 1 : 0);
    p.slideDec = big ? (veh ? SLIDE_DEC : 4.5) : 0; p.hopT = 0;
    p.state = 'down'; p.down = true; p.speed = 0;
    p.character.setPose('stand'); p.character.setPose(big ? 'tumble' : 'fall');
    p.fistT = big ? TUMBLE.tumble.brush : 0;
    const line = from && typeof from.l === 'string' ? from.l.slice(0, 90) : pick(LINES.knock);
    this._say(p, line, 2.5, 4);
    if (p.dog) { p.dogState = 'follow'; }
    // multiplayer: a scripted NPC (a friend, a shopkeeper at a door, a porter) is not in the crowd sync — every player has
    // their own copy, placed by the shared clock — so the others are told, and play the same fall (_netKnock)
    if (!from && p.sid && (p.scripted || p.det)) {
      const net = this.game.net;
      if (net && net.connected && net.send) { try { net.send('pknock', { s: p.sid, pl: p.place, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, vx: Math.round(rvx * 100) / 100, vz: Math.round(rvz * 100) / 100, m: veh ? Math.round(mass) : 0, l: line }); } catch { /* not connected */ } }
    }
    return true;
  }
  /** multiplayer: another player's vehicle knocked a scripted NPC over on their screen ('pknock'): the same fall here.
   *  Goes through knock(), so everything it refuses is refused here as well, whatever the message says: children, the
   *  adults with them, the unknockable. */
  _netKnock(d) {
    if (!d || typeof d !== 'object') return false;
    const sid = d.s, vx = +d.vx, vz = +d.vz, x = +d.x, z = +d.z;
    if (!sid || !Number.isFinite(vx) || !Number.isFinite(vz) || Math.hypot(vx, vz) > 60) return false;
    let p = null;
    for (const q of this.list) if (q.active && q.sid === sid && (q.scripted || q.det) && !q.remote && (d.pl === undefined || q.place === d.pl)) { p = q; break; }
    if (!p || p.child || this._hasKids(p) || p.knockable === false || p.down) return false;
    if (Math.hypot(vx, vz) < HOP_V) return false;                 // (a hop aside is each player's own)
    const m = +d.m > 0 && +d.m < 1e5 ? +d.m : 0;                  // (the mass of what hit them: the same throw here as there)
    const ox = p.x, oz = p.z;
    // where the hitter saw them (the two copies are within a step of each other: the same clock moves both)
    if (Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x - p.x, z - p.z) < 6) { p.x = x; p.z = z; }
    const res = this.knock(p, vx, vz, { l: d.l }, m);
    if (res !== true) { p.x = ox; p.z = oz; return false; }
    return true;
  }
  _netHook() {
    const net = this.game.net;
    if (this._netHooked || !net || !net.on) return;
    this._netHooked = true;
    net.on('pknock', (d, o) => { if (o) { try { this._netKnock(d); } catch (e) { console.warn('[pedestrians] pknock', e); } } });
  }
  /** multiplayer: other players' cars as this client draws them (systems/vehicles.js remoteBodies) are vehicles to the
   *  protection too — children and animals we simulate step out of their way and are never left inside one (added to
   *  what _ped_protect.js gathers; its own rules are untouched). */
  _protectRemotes() {
    const PR = this.protect; if (!PR || PR._remoteWrap) return;
    PR._remoteWrap = true;
    const gv = PR.gatherVehicles.bind(PR), game = this.game, refs = [];
    PR.gatherVehicles = () => {
      gv();
      if (!PR._n) return PR._nv;
      const VS = game.vehicles && game.vehicles._sys, R = VS && VS.remoteBodies;
      if (!R || !R.length) return PR._nv;
      for (let i = 0, k = 0; i < R.length; i++) {
        const q = R[i], T = q.on ? PROTECT_TYPES[q.type] : null; if (!T) continue;
        const c = PR._car(), fx = Math.sin(q.h), fz = Math.cos(q.h), ref = refs[k] || (refs[k] = { x: 0, z: 0, vx: 0, vz: 0, speed: 0 }); k++;
        ref.x = q.x; ref.z = q.z;        // (if there is nowhere for them to go _ped_protect moves "the vehicle": this stand-in, not somebody else's car)
        c.x = q.x; c.z = q.z; c.fx = fx; c.fz = fz; c.hl = T.L / 2; c.hw = T.W / 2; c.vx = q.vx; c.vz = q.vz; c.ref = ref; c.ai = false;
      }
      return PR._nv;
    };
  }

  nearest(x, z, r = 3) {
    const place = this.game.player.place;
    let best = null, bd = r * r;
    for (const p of this.list) {
      if (!p.active || p.place !== place) continue;
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 < bd) { bd = d2; best = p; }
    }
    return best;
  }

  near(x, z, r, out = []) {
    out.length = 0;
    const place = this.game.player.place, r2 = r * r;
    for (const p of this.list) if (p.active && p.place === place && (p.x - x) ** 2 + (p.z - z) ** 2 < r2) out.push(p);
    return out;
  }

  spawnAt(x, z, look, opts = {}) {
    const g = this.game, place = opts.place || 'world';
    let scene = opts.scene || null;
    if (!scene && place === 'world') scene = g.worldScene;
    if (!scene && g.interiors && g.interiors.get) { const d = g.interiors.get(place); if (d && d.scene) scene = d.scene; }
    if (!scene) throw new Error('pedestrians.spawnAt: opts.scene required for place ' + place);
    const p = this._record();
    p.scripted = true; p.place = place;
    // a stable id from where it stands (+ label, + how many before it there): its look (if none given), wander and idle
    // lines are derived from it and the shared clock, so a scripted NPC is the same for every player
    const key = `${place}|${Math.round(x * 10)}|${Math.round(z * 10)}|${opts.label || ''}`;
    let nth = 1; for (const q of this.list) if (q.active && q.skey === key) nth++;
    const sid = strHash(key + '#' + nth);
    this._activate(p, opts.role || 'townie', look || randomLook(sid), x, z, opts.heading || 0, scene);
    p.sid = sid; p.skey = key;
    p.homeX = x; p.homeZ = z; p.homeH = opts.heading || 0;
    p.basePose = opts.pose || 'stand'; p.character.setPose(p.basePose); p.character.blend = 1;
    p.drunk = p.basePose === 'drunk';
    p.wander = opts.wander ? { radius: opts.wander.radius || 3, speed: opts.wander.speed || 1.0 } : null;
    p.static = !p.wander;
    p.state = p.wander ? 'wpause' : 'static'; p.timer = rand(1, 4);
    p.lines = opts.lines || null; p.knockable = opts.knockable !== false && !p.child;
    p.pause = 0; p.benchP = 0;
    if (opts.label) { p.label = opts.label; p.character.setLabel(opts.label); }
    if (opts.dog) this._addDog(p);
    this._sync(p); this._showNew(p);
    this.list.push(p);
    return p;
  }

  /**
   * Hand an NPC over to the ambient crowd (e.g. a driver the player has just turfed out of their car): takes a free pool
   * slot (or retires the farthest walker), starts them sprawled on the ground (`fall`, pushed by vx/vz), and once they are
   * up they walk off along the pavement graph and are recycled like anyone else. Returns the ped, or null.
   */
  adopt(x, z, look, opts = {}) {
    let p = this._free();
    if (!p) {
      p = this._retireFar(x, z, 25);
      if (!p) return null;
    }
    // opts.lookSeed / lookKind (see lookOf): how the look was made, so multiplayer only sends the seed
    let lk = -1, ls = 0;
    if (!look) { ls = opts.lookSeed ?? newSeed(); lk = opts.lookKind ?? 1; look = lookOf(lk, opts.role || 'townie', ls); }
    else if (opts.lookSeed !== undefined) { ls = opts.lookSeed; lk = opts.lookKind ?? 1; }
    this._activate(p, opts.role || 'townie', look, x, z, opts.heading || 0, null, lk, ls);
    p.drunk = false; p.basePose = 'stand';
    p.vx = opts.vx || 0; p.vz = opts.vz || 0;
    p.sayCd = 6;
    if (opts.standing) { p.down = false; p.ctl = null; this._resume(p); if (p.active) this._sync(p); return p.active ? p : null; }  // e.g. passengers stepping off a bus
    p.state = 'down'; p.down = true; p.knockT = this.game.elapsed || performance.now() / 1000;
    p.slideDec = opts.tumble ? 4.5 : 0; p.fistT = opts.tumble ? TUMBLE[opts.tumble].brush : 0; p.hopT = 0;
    p.character.setPose(opts.tumble && TUMBLE[opts.tumble] ? opts.tumble : 'fall', { forward: !!opts.forward });
    this._sync(p);
    return p;
  }

  /** free a pool record by retiring the ambient walker farthest from (x,z) (at least minD away) */
  _retireFar(x, z, minD) {
    let far = null, fd = minD;
    const A = this.amb;
    for (let i = 0; i < A.length; i++) { const q = A[i]; if (!q.active || q.leader || q.ctl) continue; const d = Math.hypot(q.x - x, q.z - z); if (d > fd) { fd = d; far = q; } }
    if (!far) return null;
    this._deactivate(far);
    return far;
  }

  /** Multiplayer: make sure we own ped p (a proxy of someone else's walker is claimed, pinned) before acting on it.
   *  Returns the ped to use from now on (a proxy turns into another record), or null if that is impossible. */
  own(p) {
    if (!p || !p.active) return null;
    if (!p.remote) return p;
    const S = this.sync || this.game.crowdsync;
    return S ? S.claimNow('p', p, true) : null;
  }

  // ---------------------------------------------------------------- multiplayer provider (systems/crowdsync.js)
  // record: [id, gen, x, z, h, speed, pose, flags, (full:) role, lookKind, lookSeed, lookHour, leader id]
  // flags: 1 drunk, 2 down, 4 pinned (under an outside controller), 8 leashed dog, 16/32 dog sniff/squat
  _netProvider() {
    const self = this;
    const DOGS = ['follow', 'sniff', 'squat'];
    const transfer = (from, to) => {
      // move the drawn parts (character, dog, lead, blob) from one record to another: no re-creation, no pop
      for (const k of ['character', 'look', 'dog', 'leash', 'blob', 'role', 'lookKind', 'lookSeed', 'lookHour', 'x', 'z', 'y', 'gy', 'gx', 'gz', 'heading', 'drunk', 'basePose',
        'dogX', 'dogZ', 'dogH', 'dogState', 'speed', 'scene', 'lines', 'label', 'gpl', 'kit', 'child', 'handSide', 'dogLoose', 'ox', 'oz']) to[k] = from[k];
      from.character = null; from.dog = null; from.leash = null; from.blob = null; from.kit = null;
    };
    return {
      // (a dog tied up outside a shop while its owner is inside: the owner has left the street's sync - they went in at
      // the door - so the dog is sent as a stand-in of its own at the tie point: for the others an owner nobody can see
      // (flag 512) whose dog sits there, the same dog by the same seed, until the owner comes out)
      each(fn) {
        const L = self.list;
        for (let i = 0; i < L.length; i++) {
          const p = L[i];
          if (p.active && !p.remote && !p.scripted && !p.det && p.place === 'world' && p.lookKind >= 0) fn(p);
          else if (p.active && !p.remote && p.dogTie && p.dog && p.place !== 'world' && p.lookKind >= 0) { const T = p.tieStand || (p.tieStand = { standFor: p, x: p.dogTie.x, z: p.dogTie.z, heading: p.dogH, speed: 0, nid: 0, ngen: 0, npin: false, nsent: 0, nclaim: 0 }); T.x = p.dogX; T.z = p.dogZ; T.heading = p.dogH; fn(T); }
        }
      },
      syncable(p) { if (p.standFor) { const o = p.standFor; return o.active && !!o.dogTie && o.place !== 'world' && o.tieStand === p; } return p.active && !p.remote && p.place === 'world' && p.lookKind >= 0; },
      encode(p, full) {
        if (p.standFor) { const o = p.standFor; return full ? [POSE_I.stand ?? 0, 8 | 512, NET_ROLES.indexOf(o.role), o.lookKind, o.lookSeed, o.lookHour, 0] : [POSE_I.stand ?? 0, 8 | 512]; }
        const ch = p.character, pose = POSE_I[ch ? ch.pose : 'stand'] ?? 0;
        let fl = (p.drunk ? 1 : 0) | (p.down ? 2 : 0) | (p.ctl || p.npin || p.down ? 4 : 0) | (p.dog ? 8 : 0);
        if (p.dog) fl |= (p.dogState === 'sniff' ? 16 : p.dogState === 'squat' ? 32 : 0) | (p.dogLoose ? 64 : 0) | (p.dogState === 'bark' ? 128 : p.dogState === 'mark' ? 256 : 0);
        if (!full) return [pose, fl];
        const Ld = p.leader && p.leader.active ? p.leader : null, ld = Ld ? (Ld.remote ? Ld.pid : Ld.nid) || 0 : 0;
        return [pose, fl, NET_ROLES.indexOf(p.role), p.lookKind, p.lookSeed, p.lookHour, ld];
      },
      create(id, r) {
        if (r.length < 13) return null;
        const role = NET_ROLES[r[8]] || 'townie';
        const p = self._record();
        self._activate(p, role, lookOf(r[9], role, r[10], r[11]), r[2] / 10, r[3] / 10, r[4] / 100, self.game.worldScene, r[9], r[10]);
        p.remote = true; p.state = 'remote'; p.place = 'world'; p.lookHour = r[11]; p.nfollow = !!r[12]; p.npin = !!(r[7] & 4); p.pid = id; p.nlead = r[12] | 0;
        p.lines = null; p.fin = 0;      // (somebody else's walker, first heard of now: it fades in - their owner made it out of THEIR sight, not ours)
        self._showNew(p);
        if (r[7] & 8) self._addDog(p);
        this.update(p, r);
        self.list.push(p);
        return p;
      },
      update(p, r) {
        const fl = r[7] | 0, pose = POSES[r[6]] || 'stand';
        p.drunk = !!(fl & 1); p.basePose = p.drunk ? 'drunk' : 'stand'; p.down = !!(fl & 2); p.npin = !!(fl & 4);
        if (p.dog) { p.dogState = fl & 128 ? 'bark' : fl & 256 ? 'mark' : DOGS[(fl >> 4) & 3] || 'follow'; p.dogLoose = fl & 64 ? 1 : 0; if (p.dogState === 'mark') { p.dmX = p.dogX; p.dmZ = p.dogZ; } }
        if (r.length >= 13) { p.nfollow = !!r[12]; p.nlead = r[12] | 0; }
        p.tiedProxy = !!(fl & 512);
        if (p.character && p.character.pose !== pose) p.character.setPose(pose);
      },
      pose(p, x, z, h, sp) { p.x = x; p.z = z; p.heading = h; p.speed = sp; },
      destroy(p) { self._deactivate(p); const i = self.list.indexOf(p); if (i >= 0) self.list.splice(i, 1); },
      claim(p, forced) {
        if (p.tiedProxy) return null;                    // (a tied dog's stand-in: nobody's to walk off with)
        let f = self._free();
        if (!f && self.amb.length < POOL * 3) { self._grow(self.amb.length + 1); f = self._free(); }      // (surplus walkers drift off and are not replaced)
        if (!f && forced) f = self._retireFar(p.x, p.z, 25);
        if (!f) return null;
        const pose = p.character ? p.character.pose : 'stand', down = p.down;
        // the walk-graph edge it stands on. A paused or seated walker sets off again along p.a -> p.b / p.tx,tz, and the
        // record it moves into still holds whatever its last occupant had (-1 and 0,0 if never used): without this it
        // walked off in a straight line to that stale target and then onto node -1, i.e. to NaN, vanishing for good
        // (2026-11-22: out to 120 m, as _resume does: a walker standing far from any pavement node - the middle of a wide
        // junction, a car park - could not be claimed, so another player's car passed through it)
        let n0 = self.nearestNode(p.x, p.z, 30); if (n0 < 0) n0 = self.nearestNode(p.x, p.z, 120);
        if (n0 < 0 && !down) return null;                 // nowhere to walk from here: leave it a proxy
        transfer(p, f);
        if (n0 >= 0) { const G = self.graph, s0 = G.start[n0]; f.a = G.start[n0 + 1] > s0 ? G.nbr[s0] : n0; f.b = n0; f.lat = f.latT = 0; self._edgeTarget(f); }      // (as _resume)
        const i = self.list.indexOf(p); if (i >= 0) self.list.splice(i, 1);
        p.active = false;
        // carry on from what it was doing
        f.active = true; f.remote = false; f.scripted = false; f.place = 'world'; f.ctl = null; f.leader = null; f.partner = null; f.bench = null;
        const R = ROLES[f.role] || ROLES.townie;
        f.vmax = f.speed > 0.3 ? f.speed : rand(R.spd[0], R.spd[1]); f.pause = R.pause || 0; f.benchP = R.bench || 0; f.lines = LINES[R.lines] || LINES.townie;
        f.child = isChildRole(f.role); f.knockable = !f.child; f.waitT = 0; f.asideT = 0; f.dogTie = null; if (f.child) f.lines = CHILD_LINES[f.role] || null;

        f.sayCd = rand(4, 20); f.lat = f.latBase = f.latT = 0; f.dodgeT = 0; f.knockT = 0; f.timer = 0; f.porterGate = null; f.det = false; f.sid = 0;
        self._wrapSay(f);
        if (f.dog) { f.dogT = rand(2, 6); f.messT = rand(40, 90); }
        if (down) { f.state = 'down'; f.down = true; f.vx = f.vz = 0; }
        else if (pose === 'sit') { const bn = self._benchNear(f.x, f.z, 1.5); if (bn) { bn.busy = true; f.bench = bn; } f.state = 'sit'; f.timer = rand(5, 20); f.speed = 0; const t = f.a; f.a = f.b; f.b = t; }      // (gets up towards the nearest node, f.a)
        else if (pose === 'talk' || pose === 'phone' || pose === 'photo' || pose === 'wave') { f.state = 'pause'; f.timer = rand(2, 5); f.speed = 0; }
        else { f.down = false; self._resume(f); }
        // a child now ours: with its adult (ours or still someone else's - it follows either), or not here at all
        if (f.active && f.child && needsAdult(f.role)) { const ox = f.ox, oz = f.oz; if (!self._adopt(f)) { self._deactivate(f); return null; } f.ox = ox; f.oz = oz; return f; }
        // a follower whose leader is (now) ours walks with it again
        if (f.active && p.nfollow && f.state === 'walk') {
          const L = self.list;
          for (let k = 0; k < L.length; k++) {
            const q = L[k];
            if (q === f || !q.active || q.remote || q.leader || Math.hypot(q.x - f.x, q.z - f.z) > 3 || q.role !== f.role) continue;
            const h = q.heading, dx = f.x - q.x, dz = f.z - q.z;
            f.leader = q; f.ox = dx * Math.cos(h) - dz * Math.sin(h); f.oz = -(dx * Math.sin(h) + dz * Math.cos(h)); f.state = 'follow';
            break;
          }
        }
        return f.active ? f : null;
      },
      release(p) {
        const r = self._record();
        transfer(p, r);
        r.active = true; r.remote = true; r.state = 'remote'; r.place = 'world'; r.scripted = false; r.lines = null;
        { const Ld = p.leader && p.leader.active ? p.leader : null; r.pid = p.nid | 0; r.nlead = Ld ? (Ld.remote ? Ld.pid : Ld.nid) || 0 : 0; r.down = !!p.down; }      // (who it is, and whose child, as a proxy: _hasKids)
        self._wrapSay(r);
        self.list.push(r);
        p.nid = 0;
        p.character = null;
        self._deactivate(p);
        return r;
      },
      kill(p) { p.nid = 0; self._deactivate(p); },
      say(p, text, secs) { if (p.character) { note(text, self._now()); p.character.say(text, secs); } },
    };
  }

  remove(p) {
    if (!p) return;
    if (p.scripted) {
      const i = this.list.indexOf(p);
      this._deactivate(p);
      if (i >= 0) this.list.splice(i, 1);
    } else this._deactivate(p);
  }

  stats() {
    return { ms: this.installMs, nodes: this.graph.count, edges: this.graph.edges, benches: this.benches.length, porterGates: this.porterGates.length,
      active: this.list.filter((p) => p.active).length };
  }

  _api() {
    const self = this;
    return {
      get list() { return self.list; },
      knock: (p, vx, vz, mass) => self.knock(p, vx, vz, null, mass),
      nearest: (x, z, r) => self.nearest(x, z, r),
      near: (x, z, r, out) => self.near(x, z, r, out),
      spawnAt: (x, z, look, opts) => self.spawnAt(x, z, look, opts),
      /** may somebody be put at, or taken from, (x, z) without any player seeing it happen? (out of the camera's picture, a
       *  building in the way, or too far off to be drawn yet) - for systems that bring people on and off the street */
      unseen: (x, z) => self._unseenOrFar(x, z),
      /** make a walker of ours (spawnAt's) come in over half a second instead of at once */
      fadeIn: (p) => { if (p && p.active) p.fin = 0; },
      remove: (p) => self.remove(p),
      adopt: (x, z, look, opts) => self.adopt(x, z, look, opts),
      /** multiplayer: a ped you are about to act on (control, board, remove) may be someone else's proxy (ped.remote): this
       *  claims it (pinned) and returns the record to use, or null. Solo / already ours: returns ped unchanged. */
      own: (p) => self.own(p),
      /** hand a ped to an outside controller: fn(ped, dt) runs instead of the walk state machine each frame (move ped.x/z/heading,
       *  set ped.speed for the animation, ped.character.setPose); return false (or call control(ped, null)) to hand it back */
      control: (p, fn) => { if (!p || !p.active || p.remote || (fn && (p.child || p.cm || self._hasKids(p)))) return false; p.ctl = fn || null; if (fn) { p.state = 'ctl'; if (p.bench) { p.bench.busy = false; p.bench = null; } if (p.partner) { p.partner.partner = null; p.partner = null; } } else { p.down = false; self._resume(p); } return true; },
      /** move a ped towards (tx,tz) at v m/s this frame (water/obstacle aware), for controllers; returns the distance left */
      moveTo: (p, tx, tz, v, dt) => self._moveTo(p, tx, tz, v, dt),
      get messes() { return self.messes; },
      zone: (x, z) => self.zone(x, z),
      stats: () => self.stats(),
      get graph() { return self.graph; },
      route: (ax, az, bx, bz) => self.route(ax, az, bx, bz),
      addObstacle: (o) => self.addObstacle(o),
      removeObstacle: (o) => self.removeObstacle(o),
      get obstacles() { return self.obstacles; },
      addDoorway: (o) => self.addDoorway(o),
      /** is this walker a child? (families, school parties, pupils in uniform: systems/_ped_child.js.) Anything that picks
       *  people for play that is not for children — fights, the club and its queue, flirting, fares, arrests, being
       *  carried — must skip those for whom this is true. knock() and control() refuse them already. */
      isChild: (p) => !!(p && p.child),
      /** is this walker looking after children (a parent, a teacher)? Leave them be too. */
      isGuardian: (p) => !!(p && GUARD_ROLES[p.role]),
      /** animals about this frame: [{ o, kx, kz, r }] (position o[kx], o[kz]) — dogs on leads, and whatever
       *  systems/_ped_scenes.js has out (dogs off the lead, cats, tortoises). Nothing may hit one: protect. */
      get animals() { return self.animals; },
      /** systems/_ped_protect.js: speedCap(vehicle, vx, vz), blocks(agent), resolve() */
      get protect() { return self.protect; },
      /** systems/_ped_solid.js: people as bodies the player on foot cannot walk into (stats, stand-ins) */
      get solid() { return self.solid; },
      get kidStats() { return self.kidStats; },
      get scenes() { return self.scenes; },
      get doorways() { return self.doorways; },
      get doorStats() { return self.doorStats; },
      _sys: self,
    };
  }
}

const _gi = new Int32Array(256), _cp = { x: 0, z: 0 };
function clampA(a, m) { return a < -m ? -m : a > m ? m : a; }

export default {
  id: 'pedestrians',
  install(game) {
    const sys = new Pedestrians(game);
    game.pedestrians = sys.api;
    // loading screen (game.warmups, world/prewarm.js): the dog lead's line drawn once out of sight — its program used to
    // link (~35 ms) on the frame the session's first dog walker turned up
    // and a plain (unskinned) mesh in the character material — what a dog, or a walker far enough off to be drawn as an
    // impostor, is drawn with: a program (and a shadow-depth variant) of its own, which the start door's warm renders only
    // met if a dog or a distant walker happened to be in view of the door just then (smoke_prewarm: one run in a few).
    // Put at the warm view's spot under the ground for every warm render of a door (world/prewarm.js extras).
    const warmFigure = () => {
      const PW = game.prewarm; if (!PW || !PW.extras || sys._warmFig) return;
      const g = new THREE.BoxGeometry(0.05, 0.05, 0.05); g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.5), 3));
      const m = (sys._warmFig = new THREE.Mesh(g, characterMaterial)); m.name = 'pedestrians:warm-figure'; m.castShadow = true; m.frustumCulled = false;
      PW.extras.push({ o: m, pre: (x, y, z) => { m.position.set(x, y - 2, z); m.updateMatrixWorld(true); return null; } });
    };
    (game.warmups || (game.warmups = [])).push({ id: 'pedestrians', fn: () => {
      warmFigure();
      const W = game.world; if (!W || !W.warmDraw) return null;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const p = W.warmDraw(new THREE.Line(geo, sys.leashMat), { prio: 2, id: 'pedestrians' });
      // (the fading figure's programs - characters.js fadeMaterial: a far walker's one-mesh stand-in, and a skinned one for
      //  somebody who fades in near by - so the first person to fade does not link a program on that frame)
      try {
        const fm = fadeMaterial(0.5), bg = new THREE.BoxGeometry(0.05, 0.05, 0.05); bg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(bg.attributes.position.count * 3).fill(0.5), 3));
        W.warmDraw(new THREE.Mesh(bg, fm), { prio: 1, id: 'pedestrians' });
        const wc = createCharacter(randomLook(7)); wc.setFade(0.5); wc.group.name = 'pedestrians:warm-fade';
        const q = W.warmDraw(wc.group, { prio: 1, id: 'pedestrians' }); if (q) q.then(() => { try { wc.dispose(); bg.dispose(); } catch (e) { /* */ } });
      } catch (e) { /* no renderer */ }
      return p ? p.then((ok) => { geo.dispose(); return ok; }) : (geo.dispose(), null);
    } });
    return { id: 'pedestrians', update: (dt) => sys.update(dt) };
  },
};
