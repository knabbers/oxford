// Shared roster of real people who appear in the game (the user's friends and tutors), as stylised low-poly figures.
// `from` / `locale` (user-confirmed): Miguel Portuguese, Lorenzo Italian, Kotaro Japanese, Aiken and Matt English,
// Taskeen Indian, Andre Romanian, Chris British; Dina and James not stated (left unset). `locale` picks the friend's speech voice (_friends_voice.js).
// Friends are only ever shown by first name. Looks are matched by eye from reference photos (hair, skin tone, glasses,
// facial hair, build, height, typical clothes); no photo data is used. Heights marked `est` are estimates.
// `hairCut` / `figure` are optional refinements read by newer builds of core/characters.js (older ones ignore them).
// Used by places/friends.js (NPCs), main.js ("Play as" picker) and, later, the bar / Maths Institute modules.
//
//   import { PEOPLE, FRIEND_IDS, lookFor } from './_people.js';
//   lookFor('matt')  -> a fresh plain-JSON look (safe to mutate / send over the network); look.friend = 'matt'

export const PEOPLE = {
  matt: {
    name: 'Matt', label: 'Matt', kind: 'friend', from: 'England', locale: 'en-GB', heightEst: false,
    // very tall and slim, light-brown tousled hair, fair skin; royal-blue tee, dark trousers
    look: { seed: 196001, outfit: 'casual', height: 1.96, build: 0.92, skin: 0xf2cdb0, hair: 0x7a5636, hairStyle: 'quiff', hairCut: 'tousled', figure: 'm',
      top: 0x24378e, topStyle: 'tee', bottom: 0x1c2232, shoes: 0x2a2a2e, shoeStyle: 'trainer' },
  },
  miguel: {
    name: 'Miguel', label: 'Miguel', kind: 'friend', from: 'Portugal', locale: 'pt-PT', heightEst: false,
    // close-cropped dark hair, short dark full beard; chambray shirt, dark trousers
    look: { seed: 180002, outfit: 'casual', height: 1.80, build: 1.0, skin: 0xf0c8a6, hair: 0x33210f, hairStyle: 'buzz', beard: 'full',
      top: 0x8ea6bd, topStyle: 'shirt', bottom: 0x2a2a30, shoes: 0x3a2a1a, shoeStyle: 'shoe' },
  },
  aiken: {
    name: 'Aiken', label: 'Aiken', kind: 'friend', from: 'England', locale: 'en-GB', heightEst: false,
    // short black-brown hair with a fringe, red beanie; light-blue tee, jeans, red trainers
    look: { seed: 170003, outfit: 'casual', height: 1.70, build: 0.9, skin: 0xebc6a2, hair: 0x1e1610, hairStyle: 'short', hat: 'beanie',
      hatColor: 0xa8203a, top: 0x3e6fc0, topStyle: 'tee', bottom: 0x34466a, shoes: 0xb03030, shoeStyle: 'trainer' },
  },
  taskeen: {
    name: 'Taskeen', label: 'Taskeen', kind: 'friend', from: 'India', locale: 'en-IN', heightEst: false,
    // long dark wavy hair, black rectangular glasses; grey knit jumper, dark jeans, black boots
    look: { seed: 170004, outfit: 'casual', height: 1.70, build: 0.9, skin: 0xb27c56, hair: 0x15100d, hairStyle: 'long', hairCut: 'wavy', figure: 'f', glasses: true,
      top: 0x8c8e94, topStyle: 'jumper', bottom: 0x262a36, shoes: 0x161616, shoeStyle: 'boot' },
  },
  lorenzo: {
    name: 'Lorenzo', label: 'Lorenzo', kind: 'friend', from: 'Italy', locale: 'it-IT', heightEst: true,
    // dark-brown short hair, stubble; white polo under a navy cardigan, black trousers
    look: { seed: 180005, outfit: 'casual', height: 1.65, build: 0.95, skin: 0xeec7a6, hair: 0x2e1e14, hairStyle: 'short', beard: 'stubble',
      top: 0xf2f2ee, topStyle: 'polo', jacket: 0x1a1f2c, jacketLen: 'hip', bottom: 0x17171b, shoes: 0x161616, shoeStyle: 'shoe' },
  },
  dina: {
    name: 'Dina', label: 'Dina', kind: 'friend', heightEst: true,
    // long dark-auburn hair, glasses; white short-sleeved blouse with a black ribbon, black skirt and tights
    look: { seed: 163006, outfit: 'casual', height: 1.63, build: 0.98, skin: 0xeac2a2, hair: 0x5c1c1a, hairStyle: 'long', figure: 'f', glasses: true,
      top: 0xf4f4f2, topStyle: 'shirt', sleeves: 'short', neck: 'ribbon-black', skirt: 'knee', skirtColor: 0x18181c, tights: 0x1a1a1a,
      shoes: 0x141414, shoeStyle: 'shoe' },
  },
  james: {
    name: 'James', label: 'James', kind: 'friend', heightEst: false,
    // straight black shoulder-length hair, tortoiseshell glasses; red tartan flannel shirt, striped scarf, black backpack
    look: { seed: 175007, outfit: 'casual', height: 1.85, build: 0.88, skin: 0xeac39c, hair: 0x0e0c0c, hairStyle: 'long', hairCut: 'shoulder', figure: 'm', glasses: true,
      glassesColor: 0x6a3a1c, top: 0xb2262c, topStyle: 'shirt', tartan: 0x2a2a3a, scarf: [0xf0ece0, 0xe07058], backpack: 0x1a1a1a,
      bottom: 0x2a2e3a, shoes: 0x2a2a2a, shoeStyle: 'trainer' },
  },
  kotaro: {
    name: 'Kotaro', label: 'Kotaro', kind: 'friend', from: 'Japan', locale: 'ja-JP', heightEst: false,
    // messy black hair, thin rimless glasses; white tee, maroon chinos, trainers (he does parkour)
    look: { seed: 170008, outfit: 'casual', height: 1.80, build: 0.9, skin: 0xe4b88e, hair: 0x14100c, hairStyle: 'short', hairCut: 'messy', figure: 'm', glasses: 'rimless',
      glassesColor: 0xb8b8b8, top: 0xf2f2f0, topStyle: 'tee', bottom: 0x74282e, shoes: 0x2a2a2e, shoeStyle: 'trainer' },
  },
  // Andre and Computer Science Chris (user's friends): around the Computer Science department (Wolfson Building, Parks
  // Road / Keble Road) by Keble — places/keble_pair.js, schedule and lines in _keble_pair_logic.js. Andre is from Romania,
  // Chris is British (user). Andre: quite short and plump, thick-set, a very wide smile, brown medium-length hair (user);
  // height and clothes are estimates / choices. `smile` / `faceW` are optional face refinements (core/characters.js).
  andre: {
    name: 'Andre', label: 'Andre', kind: 'friend', from: 'Romania', locale: 'ro-RO', heightEst: true,
    look: { seed: 160007, outfit: 'casual', height: 1.58, build: 1.35, skin: 0xefc6a4, hair: 0x5a3a22, hairStyle: 'long', hairCut: 'shoulder', figure: 'm',
      smile: 1, faceW: 1.2, top: 0x4c5a48, topStyle: 'hoodie', bottom: 0x2f4466, shoes: 0x3a3a3e, shoeStyle: 'trainer' },
  },
  // Chris ("Computer Science Chris", user): medium height, skinny, long brown hair (shoulder length or a bit longer),
  // always barefoot (user). Clothes are a plain choice: grey tee, dark jeans.
  chris: {
    name: 'Computer Science Chris', label: 'Computer Science Chris', kind: 'friend', from: 'United Kingdom', locale: 'en-GB', heightEst: true,
    look: { seed: 176010, outfit: 'casual', height: 1.76, build: 0.8, skin: 0xf0cbae, hair: 0x6a4428, hairStyle: 'long', figure: 'm',
      top: 0x8a8d92, topStyle: 'tee', bottom: 0x252b3a, shoes: 0xf0cbae, shoeStyle: 'barefoot' },
  },
  // from South Korea (user). voiced: his catchphrases (_friends_logic.js YANG_LINES) are spoken with pre-rendered clips.
  yang: {
    name: 'Prof. Yang', label: 'Prof. Yang', kind: 'prof', from: 'South Korea', locale: 'ko-KR', voiced: true, heightEst: true,
    // short black hair, thin rimless glasses; taupe V-neck jumper over a pale-blue shirt, dark trousers; carries a book
    look: { seed: 172009, outfit: 'casual', height: 1.72, build: 0.88, skin: 0xe2b890, hair: 0x16120e, hairStyle: 'short', glasses: 'rimless',
      glassesColor: 0xa0a0a0, top: 0x766a60, topStyle: 'jumper', collar: 0xb8cce6, bottom: 0x2a2a30, shoes: 0x1a1a1a, shoeStyle: 'shoe', prop: 'book' },
  },
  goldsmith: {
    name: 'Prof. Goldsmith', label: 'Prof. Goldsmith', kind: 'prof', heightEst: true,
    // bald crown with long white hair at the sides, long white beard; dark navy shirt, dark trousers; carries papers
    look: { seed: 175010, outfit: 'casual', height: 1.75, build: 1.05, skin: 0xf0c8b0, hair: 0xe6e4de, hairStyle: 'grey-wild', beard: 'long',
      top: 0x2c3344, topStyle: 'shirt', bottom: 0x26262c, shoes: 0x2a1e16, shoeStyle: 'shoe', prop: 'clipboard' },
  },
  earl: {
    name: 'Dr Earl', label: 'Dr Earl', kind: 'tutor', heightEst: true,
    // short greying light-brown hair, rimless glasses, sturdy build; lilac shirt with rolled sleeves, dark trousers
    look: { seed: 178011, outfit: 'casual', height: 1.78, build: 1.2, skin: 0xf2c8aa, hair: 0x8c7c68, hairStyle: 'short', glasses: 'rimless',
      glassesColor: 0xb0b0b0, top: 0xdcd2ec, topStyle: 'shirt', sleeves: 'short', bottom: 0x1c1c22, shoes: 0x141414, shoeStyle: 'shoe', prop: 'book' },
  },
};

/** Friends the player can choose to play as (in picker order). */
export const FRIEND_IDS = ['matt', 'miguel', 'aiken', 'taskeen', 'lorenzo', 'dina', 'james', 'kotaro', 'andre', 'chris'];

/** A fresh copy of someone's look, tagged with `friend: id` so other clients can tell who a player is playing. */
export function lookFor(id) {
  const P = PEOPLE[id];
  if (!P) return null;
  const L = JSON.parse(JSON.stringify(P.look));
  L.friend = id;
  return L;
}

/** id of the roster person a look / name belongs to, or null. */
export function personOf(look, name) {
  if (look && typeof look.friend === 'string' && PEOPLE[look.friend]) return look.friend;
  if (typeof name === 'string') {
    const n = name.trim().toLowerCase();
    for (const id of FRIEND_IDS) if (PEOPLE[id].name.toLowerCase() === n) return id;
  }
  return null;
}
