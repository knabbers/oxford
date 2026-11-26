// Procedural low-poly people (and dogs) for Grand Theft Oxford.
//
//   createCharacter(look) -> Character { group, look, update(dt, speedMps), setPose(name, opts?), setLabel(text|null),
//                                        say(text, secs?), headTurn(yaw), dispose(), pose, dims, anchors, bones, ... }
//   randomLook(seed, {outfit?}) -> plain JSON-serialisable look (deterministic from the seed)
//   createDog(opts) -> Dog { group, update(dt, speed), setPose('stand'|'sit'|'squat'|'sniff'), collar, dispose() }
//
// A character is 11 segments (pelvis, torso, head, 2x upper arm, 2x forearm+hand, 2x thigh, 2x shin; + a 12th for a
// skirt, dress or long coat, which swings with the thighs) drawn as ONE skinned mesh with ONE shared vertex-coloured
// material: the segments are its bones, with four small extra ones (eyelids, jaw, two ankles). Limbs and the neck are
// blended across the joints. The body surfaces (torso, hips, skull, hair, hands, shoes) come from _body_geo.js and are
// shared by the standard outfits and the clubbing wardrobe (look.club; _wardrobe_club.js data, _wardrobe_geo.js
// garments). Segment geometries are cached by their parameters and ref-counted. Two detail tiers: the lean build
// everyone gets, and an opt-in rich one near the camera (see richAllowed).
// Origin at the feet, facing +z. See docs/CHARACTERS_API.md.
import * as THREE from 'three';
import { clubLook, resolveClub, clubLookAt, clubState, CLUB_DRESSES, CLUB_TOPS, CLUB_BOTTOMS, CLUB_SHOES, CLUB_ACC, CLUB_THEMES, CLUB_ANIMALS } from './_wardrobe_club.js';
import { makeClubBuilders } from './_wardrobe_geo.js';
import { makeBody } from './_body_geo.js';
import { swimPose, SWIM_NP } from './_swim_pose.js';
import { tumblePose, tumbleDown, TUMBLE, TUMBLE_NP, STUMBLE_DUR } from './_tumble_pose.js';
import { gaitAdvance, gaitCarry, gaitTargets, gaitSolve, GAIT_NP } from './_gait.js';
export { clubLookAt, clubState, CLUB_DRESSES, CLUB_TOPS, CLUB_BOTTOMS, CLUB_SHOES, CLUB_ACC, CLUB_THEMES, CLUB_ANIMALS };

// ------------------------------------------------------------------------------------------------ shared material
export const characterMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
characterMaterial.name = 'character';
/** Soft rim light so people separate from the background (colour/strength set each frame by the world: sky tint). */
export const characterRim = { value: new THREE.Color(0.32, 0.36, 0.42) };
characterMaterial.onBeforeCompile = (sh) => {
  sh.uniforms.uRim = characterRim;
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\t{ float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0); totalEmissiveRadiance += uRim * diffuseColor.rgb * rimF * rimF * rimF; }');
};
characterMaterial.customProgramCacheKey = () => 'charRim';

// Fading a figure in or out (2026-11-24: nobody pops into or out of being). The one shared material has no opacity of
// its own to give one figure, so a fading figure is drawn with one of FADE_STEPS - 1 copies of it that throw away a
// share of its pixels in a fixed screen pattern (no blending: depth, shadows and the post chain are untouched, and one
// program serves every step). Only a figure that is fading wears one; the rest keep `characterMaterial` and cost
// nothing more. fadeMaterial(a) -> the material for alpha a (characterMaterial itself at a >= 1).
export const FADE_STEPS = 8;
const _fadeMats = [];
export function fadeLevel(a) { return a >= 1 ? FADE_STEPS : a <= 0 ? 0 : Math.min(FADE_STEPS - 1, Math.max(1, Math.round(a * FADE_STEPS))); }
export function fadeMaterial(a) {
  const l = fadeLevel(a);
  if (l >= FADE_STEPS) return characterMaterial;
  let m = _fadeMats[l];
  if (!m) {
    m = _fadeMats[l] = characterMaterial.clone(); m.name = 'character:fade' + l;
    const u = { value: l / FADE_STEPS };
    m.onBeforeCompile = (sh) => {
      characterMaterial.onBeforeCompile(sh);
      sh.uniforms.uFadeA = u;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uFadeA;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\t{ float fdN = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))); if (fdN >= uFadeA) discard; }');
    };
    m.customProgramCacheKey = () => 'charRimFade';
  }
  return m;
}
/** the figure-material meshes directly under `root` (a dog, a pushchair) drawn at alpha a; returns the step it is at */
export function fadeMeshes(root, a, was) {
  const l = fadeLevel(a); if (l === was) return l;
  const m = fadeMaterial(a), ch = root.children;
  for (let i = 0; i < ch.length; i++) { const c = ch[i]; if (c.isMesh && (c.material === characterMaterial || _fadeMats.indexOf(c.material) > 0)) c.material = m; if (c.children.length) fadeMeshes(c, a, -1); }
  return l;
}

/** Name tags over heads: off unless the page was opened with ?names (speech bubbles are not affected). */
export const characterTags = { on: false };
/** Spoken lines: core/voice.js sets hook(ch, text, secs) -> { voiced, dur, p } | null. When a line is voiced (a rendered
 *  clip is about to play) no bubble is drawn: the jaw moves for the clip's length. Otherwise (voices off, audio not
 *  started or blocked, no clip) the bubble shows as before, and also late if the clip then fails to load. */
export const characterSpeech = { hook: null };
try { characterTags.on = new URLSearchParams(location.search).has('names'); } catch { /* node */ }

/** Optionally tell characters which camera to measure label distances from (defaults to window.game.camera). */
let _camera = null;
export function setCharacterCamera(cam) { _camera = cam; }
function activeCamera() {
  if (_camera) return _camera;
  const g = typeof window !== 'undefined' ? window.game : null;
  return g && g.camera ? g.camera : null;
}

// ------------------------------------------------------------------------------------------------ deterministic RNG
function hashSeed(seed) {
  if (typeof seed === 'string') { let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const n = Math.floor(Math.abs(+seed || 0) * 1000) % 4294967296;
  return (Math.imul(n ^ (n >>> 16), 2246822507) ^ 0x9e3779b9) >>> 0;
}
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------------------------------------ palettes
const SKINS = [0xf6d7c3, 0xf1c9a5, 0xe8b996, 0xd9a47a, 0xc68c5e, 0xa5714a, 0x8a5a3a, 0x6b4630, 0x4f3322];
const HAIRS = [0x1a120c, 0x2a1b10, 0x3b2616, 0x5a3a1e, 0x8a5a2a, 0xa8642a, 0xc9a45a, 0xe0c890, 0x111111, 0x7a2a12];
const GREYS = [0x8a8a86, 0xb8b8b0, 0xd8d8d0, 0xeeeeea];
const TOPS = [0x1f2a44, 0x7a2233, 0x2f5b3a, 0x6a6a6a, 0xd8d0c0, 0xc8a032, 0x1a1a1a, 0x2a7a7a, 0xa83232, 0xeeeeea, 0xd88aa0, 0x5a3a7a, 0x7aa8d0, 0xd8743a, 0x3a5fa8, 0x8a8a5a];
const BOTTOMS = [0x2a3a5a, 0x1e2636, 0x1a1a1c, 0x55585e, 0xb09a72, 0x5a5a3a, 0x3a4a6a, 0x6a5040];
const COATS = [0x1c2436, 0x18181a, 0xb08a5a, 0x3e4230, 0x4a4c50, 0x7a2626, 0x2a3a2a, 0x5a4636, 0x283850];
const SHOES = [0x1a1a1a, 0x3a2a1a, 0xeeeeee, 0x5a3a22, 0x2a2a3a, 0x8a8a8a];
const SCARVES = [[0x1a2a5a, 0xc8a030], [0x7a1a2a, 0x1a1a1a], [0x1a4a2a, 0xe0e0e0], [0xa01a1a, 0xf0f0f0], [0x2a2a6a, 0xa0c0e0],
  [0x5a1a5a, 0xe0c040], [0x101010, 0xe0e0e0], [0x8a1a1a, 0x1a3a7a], [0x2a5a2a, 0xc0a020]];
const HAIR_STYLES = ['short', 'short', 'long', 'bun', 'curly', 'ponytail', 'buzz', 'bob', 'quiff', 'afro', 'bald', 'grey-wild'];

export const OUTFITS = ['casual', 'subfusc', 'gown', 'tweed', 'porter', 'barstaff', 'chef', 'shopworker', 'clubbing', 'rower',
  'cyclist', 'tourist', 'police', 'builder', 'firefighter', 'jogger', 'smart'];
export const HAIRSTYLES = ['short', 'long', 'bun', 'bald', 'curly', 'ponytail', 'grey-wild', 'afro', 'buzz', 'bob', 'quiff',
  'straight', 'big', 'curls', 'topknot', 'pigtails', 'sidepart'];
/** look.hairCut: an optional refinement of hairStyle (older clients ignore it and draw hairStyle) */
export const HAIRCUTS = ['fringe', 'sidepart', 'tousled', 'messy', 'receding', 'wavy', 'shoulder'];
const FEM_HAIR = { long: 1, bun: 1, ponytail: 1, bob: 1, straight: 1, big: 1, curls: 1, topknot: 1, pigtails: 1 };
export const HATS = ['mortarboard', 'bowler', 'hardhat', 'helmet', 'beanie', 'cap', 'chef', 'custodian', 'fire', 'flatcap', 'sunhat', 'headband',
  'cowboy', 'cone', 'laurel', 'tie-band', 'hood'];
export const PROPS = ['pint', 'book', 'clipboard', 'camera', 'pizza-box', 'cue', 'mallet', 'phone', 'bag-tesco', 'bag-sainsburys',
  'bag-waitrose', 'bag', 'coffee', 'kebab', 'umbrella', 'bottle', 'dart', 'kebab-box', 'chips', 'cone', 'heels', 'clutch'];
export const POSES = ['stand', 'sit', 'cycle', 'drive', 'punt', 'dance', 'drunk', 'lecture', 'write', 'crouch', 'throw', 'lean', 'fall',
  'wave', 'talk', 'phone', 'photo', 'sitground', 'vault', 'precision', 'climb', 'hang', 'balance', 'roll', 'clap', 'brushoff',
  'holding-hands', 'arm-in-arm', 'stagger-carry', 'swim', 'dive',
  // (appended: indices above are on the wire) knocked down by a vehicle / tripped (core/_tumble_pose.js)
  'tumble', 'tumblef', 'knocked', 'knockedf', 'stumble',
  // (appended 2026-11-22) riding a child's scooter: both hands on the bar, one foot on the deck, the other pushing off now and then
  'scoot'];

/**
 * Deterministic random look. Same seed -> same look on every client. opts.outfit forces an outfit.
 * Returned object is plain data (numbers/strings/booleans/arrays) so it can be sent as JSON.
 */
export function randomLook(seed = Math.random() * 1e9, opts = {}) {
  const rnd = mulberry(hashSeed(seed));
  const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
  const chance = (p) => rnd() < p;
  const outfit = opts.outfit || (chance(0.82) ? 'casual' : pick(['gown', 'tweed', 'tourist', 'smart', 'jogger']));
  const older = outfit === 'tweed' ? chance(0.8) : outfit === 'porter' ? chance(0.6) : chance(0.15);
  const L = {
    seed: hashSeed(seed) % 1000000, outfit,
    skin: pick(SKINS),
    hair: older && chance(0.7) ? pick(GREYS) : pick(HAIRS),
    hairStyle: pick(HAIR_STYLES),
    height: Math.round((1.6 + (rnd() + rnd() + rnd()) / 3 * 0.32) * 100) / 100,
    build: Math.round((0.86 + rnd() * 0.32) * 100) / 100,
    shoes: pick(SHOES),
  };
  if (L.hairStyle === 'grey-wild') L.hair = pick(GREYS);
  if (older && chance(0.3)) L.hairStyle = pick(['bald', 'short', 'grey-wild']);
  if (chance(older ? 0.4 : 0.14)) L.beard = pick(['full', 'stubble', 'goatee', 'moustache', 'full']);
  if (chance(older ? 0.55 : 0.22)) L.glasses = true;
  const skirt = chance(0.22);
  switch (outfit) {
    case 'casual': case 'gown': {
      L.top = pick(TOPS); L.topStyle = pick(['tee', 'shirt', 'jumper', 'hoodie', 'jumper', 'polo']);
      L.bottom = pick(BOTTOMS);
      if (skirt) { L.skirt = pick(['mini', 'knee', 'knee', 'long']); L.skirtColor = pick(BOTTOMS.concat(TOPS)); if (chance(0.6)) L.tights = pick([0x1a1a1a, 0x2a2a2a, 0x3a2a2a]); }
      if (chance(0.55)) { L.jacket = pick(COATS); L.jacketLen = pick(['waist', 'hip', 'hip', 'long']); }
      if (chance(0.25)) L.scarf = pick(SCARVES);
      if (chance(0.2)) L.backpack = pick([0x1a1a1a, 0x2a3a6a, 0x6a2a2a, 0x3a5a3a, 0x8a6a3a]);
      if (chance(0.12)) { L.hat = pick(['beanie', 'cap', 'beanie']); L.hatColor = pick(TOPS); }
      L.shoeStyle = pick(['trainer', 'trainer', 'shoe', 'boot']);
      if (outfit === 'gown') L.gown = chance(0.75) ? 'commoner' : 'scholar';
      break;
    }
    case 'smart': L.top = pick([0xe8eef4, 0xf2f2ee, 0xc8d8e8]); L.topStyle = 'shirt'; L.jacket = pick([0x1c2436, 0x2a2a2e, 0x3a3a40]); L.bottom = L.jacket;
      L.neck = 'tie'; L.neckColor = pick([0x7a1a2a, 0x1a2a6a, 0x3a3a3a, 0x1a4a2a]); L.shoeStyle = 'shoe'; L.shoes = 0x1a1a1a;
      if (skirt) { L.skirt = 'knee'; L.skirtColor = L.jacket; L.tights = 0x2a2420; } if (chance(0.3)) { L.jacketLen = 'long'; L.jacket = pick(COATS); }
      break;
    case 'subfusc': L.neck = chance(0.6) ? 'bow-white' : 'ribbon-black'; if (skirt) { L.skirt = 'knee'; L.tights = 0x1a1a1a; }
      if (chance(0.3)) L.hat = 'mortarboard'; if (chance(0.5)) L.gown = chance(0.7) ? 'commoner' : 'scholar';
      if (chance(0.25)) L.carnation = pick([0xffffff, 0xf0a0b0, 0xc01030]);
      break;
    case 'tweed': L.jacket = pick([0x6b5a3e, 0x5a5030, 0x7a6a4a, 0x4a4a3a]); L.bottom = pick([0x8a6a3a, 0x5a5a3a, 0x7a3a2a, 0x6a5a40]);
      L.top = pick([0xc8d4e0, 0xe8e0d0, 0xd0c8b0]); L.neck = chance(0.5) ? 'tie' : null; L.neckColor = pick([0x7a2a2a, 0x2a4a2a, 0x6a5a2a]);
      L.shoes = pick([0x5a3a22, 0x3a2a1a]); if (chance(0.2)) { L.hat = 'flatcap'; } if (chance(0.3)) L.scarf = pick(SCARVES);
      if (skirt) { L.skirt = 'long'; L.skirtColor = pick([0x6a5a40, 0x4a3a2a]); L.tights = 0x3a2a22; }
      break;
    case 'porter': if (chance(0.85)) L.hat = 'bowler'; L.neckColor = pick([0x1c2a4a, 0x5a1a2a, 0x1a3a2a]); break;
    case 'barstaff': L.top = pick([0x1a1a1a, 0x1a1a1a, 0x3a1a2a, 0xeeeeea]); L.topStyle = pick(['tee', 'shirt']); L.bottom = pick([0x1a1a1c, 0x1e2636]); break;
    case 'chef': break;
    case 'shopworker': L.uniform = pick([0x1f4e9a, 0xf06c00, 0x2a6a3a, 0x8a1a2a, 0x1a1a1a]); L.bottom = 0x1a1a1c; break;
    case 'clubbing':     // the clubbing wardrobe (core/_wardrobe_club.js): fills L.club; opts.skimpy/theme/range/state/hour bias it
      clubLook(rnd, L, opts);
      delete L.shoes;
      break;
    case 'rower': L.top = pick([0x1a2a5a, 0x7a1a2a, 0x1a4a2a, 0x1a1a1a, 0x5a1a5a]); L.lycra = pick([0x1a2a5a, 0x7a1a2a, 0x1a4a2a, 0x1a1a1a, 0xe0e0e0]);
      L.shoeStyle = 'trainer'; L.shoes = pick([0xeeeeee, 0x1a1a1a]); if (chance(0.3)) { L.hat = 'beanie'; L.hatColor = L.top; } break;
    case 'cyclist': L.hat = 'helmet'; L.hatColor = pick([0x1a1a1a, 0xe8e8e8, 0x2050c0, 0xc02020]); L.bottom = pick([0x1a1a1c, 0x1e2636]);
      L.shoeStyle = 'trainer'; if (chance(0.4)) L.backpack = pick([0x1a1a1a, 0xd8f030]); break;
    case 'tourist': L.top = pick([0xd02020, 0xf0d020, 0x20a0c0, 0xf08020, 0x40a040, 0xe0e0e0, 0xe060a0]); L.topStyle = pick(['tee', 'polo', 'hoodie']);
      L.bottom = pick([0xb09a72, 0x2a3a5a, 0x5a5a3a, 0x8a8a8a]); L.legs = chance(0.3) ? 'shorts' : 'trousers'; L.shoeStyle = 'trainer'; L.shoes = pick([0xeeeeee, 0x8a8a8a, 0x3a3a3a]);
      L.backpack = pick([0x1a1a1a, 0xc02020, 0x2a5a9a, 0x3a6a3a]); L.camera = chance(0.6);
      if (chance(0.5)) { L.hat = pick(['sunhat', 'cap']); L.hatColor = pick([0xe8e0c8, 0x2a3a5a, 0xc02020, 0xeeeeee]); }
      if (chance(0.4)) { L.jacket = pick([0xd02020, 0x2050a0, 0xf0d020, 0x3a3a3a]); L.jacketLen = 'waist'; }
      break;
    case 'police': L.hat = chance(0.6) ? 'custodian' : 'cap'; L.hatColor = 0x121418; if (skirt) { L.skirt = 'knee'; L.skirtColor = 0x15171c; L.tights = 0x1a1a1a; } break;
    case 'builder': L.hat = 'hardhat'; L.hatColor = pick([0xf0c020, 0xeeeeee, 0xe86a10, 0x2a6ad0]); L.top = pick([0x6a6a6a, 0x2a2a3a, 0x3a4a6a]);
      L.bottom = pick([0x2a3a5a, 0x3a3a30, 0x55585e]); L.hivis = pick([0xd8f030, 0xf07010]); L.shoeStyle = 'boot'; L.shoes = pick([0x8a5a2a, 0x2a2a2a]); break;
    case 'firefighter': L.hat = 'fire'; L.hatColor = pick([0xf0d020, 0xeeeeee]); break;
    case 'jogger': L.top = pick([0xe02060, 0x20a0e0, 0x1a1a1a, 0xf0f020, 0xeeeeee, 0x30c060, 0xf06020]); L.topStyle = 'tee'; L.sleeves = chance(0.5) ? 'short' : 'long';
      L.bottom = pick([0x1a1a1c, 0x2a2a3a]); L.legs = chance(0.5) ? 'shorts' : 'trousers'; L.shoeStyle = 'trainer'; L.shoes = pick([0xeeeeee, 0xf04060, 0x3060f0, 0x1a1a1a]);
      if (chance(0.3)) { L.hat = 'headband'; L.hatColor = pick([0xeeeeee, 0x1a1a1a, 0xe02060]); }
      if (L.hairStyle === 'long' || L.hairStyle === 'bob') L.hairStyle = 'ponytail';
      break;
  }
  if (L.beard && L.skirt) { delete L.skirt; delete L.skirtColor; delete L.tights; }      // (dropped after the draws, so the rest of the look is unchanged)
  if (opts.prop) L.prop = opts.prop;
  return L;
}

// Every garment family of the clubbing wardrobe once: [range, club overrides | theme]. Used by wardrobeLineup().
const LINEUP = [
  ['womens', { dress: 'bodycon' }], ['womens', { dress: 'colourblock' }], ['womens', { dress: 'sequin' }], ['womens', { dress: 'skater' }],
  ['womens', { dress: 'bandage' }], ['womens', { dress: 'backless' }], ['womens', { dress: 'cutout' }], ['womens', { dress: 'cami' }],
  ['womens', { dress: 'playsuit' }], ['womens', { top: 'bralette', bottom: 'hotpants', legs: 'bare' }], ['womens', { top: 'bralette', bottom: 'disco' }],
  ['womens', { top: 'crop', bottom: 'disco' }], ['womens', { top: 'peplum', bottom: 'mini' }], ['womens', { top: 'bodysuit', bottom: 'skater' }],
  ['womens', { top: 'bandeau', bottom: 'mini' }], ['womens', { top: 'crop', bottom: 'leather' }], ['womens', { top: 'cami', bottom: 'hotpants', legs: 'tights' }],
  ['mens', { top: 'shirt', sleeves: 'rolled', pattern: null }], ['mens', { top: 'shirt', pattern: 'check' }], ['mens', { top: 'shirt', pattern: 'floral' }],
  ['mens', { top: 'shirt', tucked: true, pattern: null, c: { main: 0xa8c8e8, bottom: 0xa83a32 }, bottom: 'chinos' }], ['mens', { top: 'polo', bottom: 'chinos' }],
  ['mens', { top: 'vneck', bottom: 'skinny' }], ['mens', { top: 'scoop', bottom: 'jeans' }], ['mens', { top: 'shirt', open: 4, tucked: false, pattern: null }],
  ['womens', 'bop-toga'], ['mens', 'bop-toga'], ['womens', 'bop-neon'], ['mens', 'bop-neon'], ['womens', 'bop-school'], ['mens', 'bop-school'],
  ['womens', 'bop-onesie'], ['mens', 'bop-onesie'], ['mens', 'bop-superhero'], ['womens', 'bop-superhero'], ['mens', 'bop-cowboy'], ['womens', 'bop-cowboy'],
  ['mens', 'black-tie'], ['womens', 'black-tie'], ['mens', 'stash'], ['womens', 'stash'],
];
const LINEUP_COL = { bodycon: 0xc0182a, colourblock: 0x1d3fb0, sequin: 0xc8a850, skater: 0x0e6a4a, bandage: 0x111113, backless: 0xd81f78, cutout: 0x111113,
  cami: 0x8fdcc4, playsuit: 0xf07a6a, bralette: 0x111113, crop: 0xeeeeea, peplum: 0xc0182a, bodysuit: 0x111113, bandeau: 0xd81f78, cami2: 0xeeeeea };

/**
 * A line-up of clubbing looks covering every garment family once (41 looks; then random ones if opts.n is larger).
 * opts: {n, state, seed, start}. Plain looks: pass them to createCharacter / game.pedestrians.spawnAt.
 */
export function wardrobeLineup(opts = {}) {
  const n = opts.n ?? LINEUP.length, seed0 = opts.seed ?? 1, out = [];
  for (let j = 0; j < n; j++) {
    const i = (opts.start || 0) + j, sd = seed0 * 1000 + i;
    const st = opts.state !== undefined ? { state: opts.state } : {};
    if (i >= LINEUP.length) { out.push(randomLook(sd, { outfit: 'clubbing', ...st })); continue; }
    const [range, spec] = LINEUP[i];
    if (typeof spec === 'string') { out.push(randomLook(sd, { outfit: 'clubbing', range, theme: spec, ...st })); continue; }
    const L = randomLook(sd, { outfit: 'clubbing', range, theme: 'none', skimpy: 0, ...st });
    const C = L.club;
    delete C.dress; delete C.top; delete C.bottom; delete C.pattern; delete C.neck; delete C.sleeves; delete C.hem;
    Object.assign(C, JSON.parse(JSON.stringify(spec)), { c: { ...C.c, ...(spec.c || {}) } });
    const key = spec.dress || (spec.top === 'cami' ? 'cami2' : spec.top);
    if (LINEUP_COL[key] !== undefined && !(spec.c && spec.c.main)) C.c.main = LINEUP_COL[key];
    if (spec.dress === 'colourblock') C.c.alt = 0x111113;
    if (C.pattern === null) delete C.pattern;
    if (spec.pattern === 'check') { C.c.main = 0xeef2f6; C.c.alt = 0x3a5a9a; }
    if (spec.pattern === 'floral') { C.c.main = 0x1c2a48; C.c.alt = 0xf0a0b0; }
    if (spec.bottom === 'disco' || spec.bottom === 'leather') C.c.bottom = 0x111113;
    if (spec.bottom === 'hotpants') C.c.bottom = 0x3a5684;
    if ((spec.bottom === 'mini' || spec.bottom === 'skater') && C.c.bottom === C.c.main) C.c.bottom = C.c.main === 0x111113 ? 0xeeeeea : 0x111113;
    if (spec.bottom === 'chinos' && !(spec.c && spec.c.bottom)) C.c.bottom = 0xc8a040;
    out.push(L);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ look resolution
const HOLD = { pint: 'front', book: 'front', clipboard: 'front', camera: 'front', 'pizza-box': 'front', cue: 'front', phone: 'front',
  coffee: 'front', kebab: 'front', bottle: 'front', dart: 'front', mallet: 'down', 'bag-tesco': 'down', 'bag-sainsburys': 'down',
  'bag-waitrose': 'down', bag: 'down', umbrella: 'down', 'kebab-box': 'front', chips: 'front', cone: 'down', heels: 'down', clutch: 'down' };

function resolve(L) {
  L = L || {};
  const o = OUTFITS.includes(L.outfit) ? L.outfit : 'casual';
  const R = {
    outfit: o, seed: (L.seed >>> 0) || 0,
    skin: 0xe8b996, hair: 0x3b2616, hairStyle: 'short', beard: null, glasses: false, hat: null, hatColor: null, prop: null,
    height: 1.75, build: 1,
    top: 0x3a5fa8, topStyle: 'tee', sleeves: null, pattern: false, bottom: 0x2a3a5a, legs: 'trousers', skirt: null, skirtColor: null, dress: false,
    tights: null, shoes: 0x2a2a2a, shoeStyle: 'shoe', jacket: null, jacketLen: 'waist', patches: null, tweed: false, shirt: null,
    neck: null, neckColor: 0x1a1a1a, gown: null, hivis: null, apron: null, badge: null, backpack: null, camera: false, scarf: null,
    stripes: null, checks: false, lycra: null, carnation: null, chefJacket: false, chequer: false, uniform: null,
    glassesColor: null, collar: null, tartan: null, heelH: 0, club: null, figure: null, hairCut: null,
    smile: null, faceW: null,      // optional face refinements (look.smile 0..1 broad grin, look.faceW ~1..1.2 broader lower face)
    child: null,                   // look.child true: a child (systems/_ped_child.js) - may be shorter and slighter than any adult, with a child's head-to-body proportion (makeDims)
  };
  switch (o) {
    case 'subfusc': R.jacket = 0x15161a; R.bottom = 0x15161a; R.top = 0xf2f2ee; R.topStyle = 'shirt'; R.shirt = 0xf2f2ee; R.neck = 'bow-white';
      R.gown = 'commoner'; R.shoes = 0x111111; R.shoeStyle = 'shoe'; R.hatColor = 0x101012; break;
    case 'tweed': R.jacket = 0x6b5a3e; R.tweed = true; R.patches = 0x4a3424; R.top = 0xc8d4e0; R.topStyle = 'shirt'; R.shirt = 0xc8d4e0;
      R.bottom = 0x8a6a3a; R.checks = false; R.shoes = 0x5a3a22; R.jacketLen = 'hip'; R.hatColor = 0x6b5a3e; break;
    case 'porter': R.jacket = 0x1c1f26; R.bottom = 0x1c1f26; R.top = 0xf0f0ec; R.topStyle = 'shirt'; R.shirt = 0xf0f0ec; R.neck = 'tie'; R.neckColor = 0x1c2a4a;
      R.shoes = 0x111111; R.hatColor = 0x111111; R.jacketLen = 'hip'; break;
    case 'barstaff': R.top = 0x1a1a1a; R.bottom = 0x1a1a1c; R.apron = 0x121212; R.shoes = 0x111111; R.sleeves = 'short'; break;
    case 'chef': R.top = 0xf2f2f0; R.chefJacket = true; R.bottom = 0x4a4a4a; R.checks = true; R.apron = 0xf6f6f4; R.hat = 'chef'; R.hatColor = 0xf8f8f8;
      R.shoes = 0x111111; R.sleeves = 'long'; break;
    case 'shopworker': R.topStyle = 'polo'; R.top = L.uniform !== undefined ? L.uniform : 0x1f4e9a; R.badge = 0xf4f4f4; R.bottom = 0x1a1a1c; R.shoes = 0x111111; break;
    case 'clubbing': R.shoeStyle = 'shoe'; break;
    case 'rower': R.lycra = 0x1a2a5a; R.top = 0x1a2a5a; R.topStyle = 'splash'; R.legs = 'shorts'; R.shoeStyle = 'trainer'; R.shoes = 0xeeeeee; R.sleeves = 'long'; break;
    case 'cyclist': R.hivis = 0xd8f030; R.top = 0xd8f030; R.topStyle = 'jacket'; R.bottom = 0x1a1a1c; R.legs = 'trousers'; R.shoeStyle = 'trainer'; R.hat = 'helmet'; R.hatColor = 0x1a1a1a; break;
    case 'tourist': R.backpack = 0x2a5a9a; R.shoeStyle = 'trainer'; R.shoes = 0xeeeeee; break;
    case 'police': R.top = 0xf2f2f2; R.topStyle = 'shirt'; R.sleeves = 'short'; R.hivis = 0xd8f030; R.chequer = true; R.bottom = 0x15171c; R.shoes = 0x0e0e0e;
      R.shoeStyle = 'boot'; R.hat = 'custodian'; R.hatColor = 0x121418; break;
    case 'builder': R.top = 0x6a6a6a; R.hivis = 0xd8f030; R.bottom = 0x2a3a5a; R.shoeStyle = 'boot'; R.shoes = 0x8a5a2a; R.hat = 'hardhat'; R.hatColor = 0xf0c020; R.sleeves = 'short'; break;
    case 'firefighter': R.top = 0x1a1e2a; R.topStyle = 'jacket'; R.bottom = 0x1a1e2a; R.stripes = [0xd8f030, 0xc8c8c8]; R.shoeStyle = 'boot'; R.shoes = 0x0e0e0e;
      R.hat = 'fire'; R.hatColor = 0xf0d020; R.sleeves = 'long'; break;
    case 'jogger': R.topStyle = 'tee'; R.shoeStyle = 'trainer'; R.shoes = 0xeeeeee; R.bottom = 0x1a1a1c; break;
    case 'smart': R.topStyle = 'shirt'; R.top = 0xe8eef4; R.jacket = 0x1c2436; R.bottom = 0x1c2436; R.neck = 'tie'; R.neckColor = 0x7a1a2a; R.shoes = 0x111111; break;
  }
  // explicit look fields override outfit defaults
  for (const k in L) if (k !== 'outfit' && k !== 'seed' && k in R && L[k] !== undefined && L[k] !== null) R[k] = L[k];
  if (o === 'gown' && !R.gown) R.gown = 'commoner';
  if (L.gown === true) R.gown = 'commoner';
  if (R.beard === true) R.beard = 'full';
  if (R.hat === true) R.hat = 'cap';
  if (R.dress && !R.skirt) R.skirt = 'knee';
  if (R.skirt === true) R.skirt = 'knee';
  if (R.skirt && R.skirtColor === null) R.skirtColor = R.dress ? R.top : R.bottom;
  if (R.skirt) R.legs = R.tights !== null ? 'tights' : 'bare';
  else if (R.legs === 'bare') R.legs = 'shorts';
  if (R.sleeves === null) R.sleeves = R.topStyle === 'tee' || R.topStyle === 'polo' ? 'short' : R.topStyle === 'crop' || R.topStyle === 'vest' ? 'none' : 'long';
  if (R.jacket !== null && R.shirt === null) R.shirt = R.topStyle === 'shirt' ? R.top : R.top;
  if (R.jacket !== null) R.sleeves = 'long';
  if (R.hatColor === null) R.hatColor = { hardhat: 0xf0c020, helmet: 0x1a1a1a, chef: 0xf8f8f8, fire: 0xf0d020, mortarboard: 0x101012, bowler: 0x111111, custodian: 0x121418 }[R.hat] ?? 0x2a2a3a;
  R.child = R.child === true;
  R.height = Math.max(R.child ? 0.8 : 1.45, Math.min(2.05, +R.height || 1.75));
  R.build = Math.max(R.child ? 0.5 : 0.75, Math.min(1.35, +R.build || 1));
  R.club = null; R.heelH = 0;                                            // derived only (never copied from the look)
  if (o === 'clubbing' && L.club && typeof L.club === 'object') {      // the clubbing wardrobe: garments come from look.club
    const C = (R.club = resolveClub(L.club, R.seed, L));
    R.heelH = C.heelH;
    if ((L.prop === undefined || L.prop === null) && C.carryR) R.prop = C.carryR;
    if ((L.hat === undefined || L.hat === null) && C.hat) { R.hat = C.hat; R.hatColor = L.hatColor ?? C.hatColor; }
    if (R.hairStyle === 'bald' && C.range === 'womens') R.hairStyle = 'long';
  }
  R.hold = R.prop ? HOLD[R.prop] || 'front' : null;
  // body shape: explicit look.figure ('m' | 'f'), else from the wardrobe range / beard / skirt / hairstyle
  if (R.figure !== 'm' && R.figure !== 'f') R.figure = R.club ? (R.club.range === 'womens' ? 'f' : 'm') : R.beard ? 'm' : R.skirt ? 'f' : FEM_HAIR[R.hairStyle] ? 'f' : 'm';
  if (typeof R.hairCut !== 'string' || !B.STY[R.hairCut]) R.hairCut = null;
  R.smile = R.smile === null ? null : Math.max(0, Math.min(1, +R.smile || 0)) || null;
  R.faceW = R.faceW === null ? null : Math.max(0.9, Math.min(1.25, +R.faceW || 1));
  if (R.faceW === 1) R.faceW = null;
  return R;
}

/** blue, mid-to-dark trousers are drawn as jeans */
function isDenim(c) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return b > 60 && b > r * 1.3 && b > g * 1.08 && r < 110; }
function makeDims(R) {
  const s = R.height / 1.75, b = R.build;
  const heelH = R.heelH || 0, ankle = 0.075 * s + heelH, L2 = 0.43 * s, L1 = 0.44 * s;
  const hipY = ankle + L1 + L2, waist = 0.07 * s, torsoH = 0.47 * s;
  // (a child - look.child, systems/_ped_child.js - is not a scaled-down adult: the head is large for the body, by the real
  // growth figures - about 5 heads tall at two, 6 at six, 7 at ten, 7.6 grown - and the shoulders narrow with the body)
  const hk = R.child ? Math.min(0.92 + 0.08 * s, 0.52 + 0.48 * s) : 0.92 + 0.08 * s;
  const headR = 0.12 * hk, headC = 0.13 * s - 1.06 * 0.008 * hk, neckOff = 0.015 * s;      // (a larger head on a shorter neck: the top of the head is where it was)
  const neckY = hipY + waist + torsoH + neckOff;
  const top = neckY + headC + headR * 1.06;
  const L = L1 + L2;
  const cycle = { bbY: 0.3, bbZ: 0.2, crank: 0.17 };
  cycle.saddle = cycle.bbY - cycle.crank + Math.sqrt(Math.max(0.1, (0.96 * L) ** 2 - cycle.bbZ ** 2));
  return {
    s, b, ankle, heelH, L1, L2, hipY, waist, torsoH, neckOff, headR, headC, neckY, top, height: top,
    hipX: 0.085 * b, shX: (R.figure === 'f' ? 0.148 : 0.163) * b + (R.child ? 0.03 * Math.min(1, s) : 0.03), shY: 0.415 * s, UA: 0.29 * s, FA: 0.25 * s,
    seat: 0.45 + 0.075 * b,        // hip-joint height in 'sit' / 'write' (chair seat surface at 0.45 m)
    driveSeat: 0.55,               // hip-joint height in 'drive' (feet then rest ~at the origin, pedals ahead)
    groundSeat: 0.11 + 0.02 * b,   // hip-joint height in 'sitground'
    cycle,
  };
}

// ------------------------------------------------------------------------------------------------ geometry builder
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(), _p3 = new THREE.Vector3(), _s3 = new THREE.Vector3();
const _col = new THREE.Color();

// Build context of the segment being built (set by Character.mk before a builder runs; builders and GB.limb read it):
// hi = near-camera detail tier, kind = segment family ('arm' 'fore' 'thigh' 'shin' 'head' 'torso' …), L = segment length
// (the far joint is at y = -L), s = height scale, fig = 'm' | 'f' (body shape).
export const CTX = { hi: false, kind: '', L: 0, s: 1, fig: 'm', part: '' };      // part: 'leg' / 'foot' = which half of a shin builder's output to keep
// vertex tags (GB.tag while adding): how mergeSkin binds a vertex. RIGID = its own segment; SOFT = limb/neck/waist skin,
// blended across the joint; LID / JAW = the eyelid and jaw bones of the head; FOOT = the shoe: a shin builder's FOOT
// vertices become the separate foot segment (it turns on the ankle), the rest stays with the shin.
export const T_RIGID = 0, T_SOFT = 1, T_LID = 2, T_JAW = 3, T_FOOT = 4;
const SOFT_KINDS = { arm: 1, fore: 1, thigh: 1, shin: 1, head: 1 };
const bump = (u, c, w) => { const d = (u - c) / w; return d <= -1 || d >= 1 ? 0 : (1 - d * d) * (1 - d * d); };
/** limb profile at u (0 = near joint … 1 = far joint) → radius multiplier; LZ = forward offset (× s) */
let LZ = 0;
function limbProf(kind, u) {
  LZ = 0;
  switch (kind) {
    case 'thigh': LZ = 0.008 * bump(u, 0.35, 0.5); return 1 + 0.05 * bump(u, 0.2, 0.45) - 0.03 * bump(u, 0.82, 0.25) + 0.04 * bump(u, 1.0, 0.12);
    case 'shin': LZ = -0.014 * bump(u, 0.27, 0.32) + 0.004 * bump(u, 0.0, 0.15); return 1 + 0.13 * bump(u, 0.27, 0.33) - 0.1 * bump(u, 0.86, 0.3);
    case 'arm': LZ = 0.004 * bump(u, 0.4, 0.4); return 1 + 0.1 * bump(u, 0.12, 0.3) + 0.07 * bump(u, 0.45, 0.35) - 0.03 * bump(u, 0.85, 0.2);
    case 'fore': return 1 + 0.12 * bump(u, 0.17, 0.3) - 0.1 * bump(u, 0.95, 0.35);
  }
  return 1;
}

/** cloth shading baked into a limb tube's vertex colours: 1 = cloth (a lit front, a shaded back, a darker hem),
 *  2 = denim (as cloth, with the wash worn pale down the front of the thigh and over the knee) */
function limbTone(tone, j, n, kind, u, last) {
  let f = j === 0 ? 1.06 : j * 2 === n ? 0.88 : 0.97;
  if (tone === 2) {
    if (j === 0) f = 1 + 0.3 * (kind === 'thigh' ? sm(0.05, 0.8, u) : kind === 'shin' ? sm(0.45, 0, u) : 0.3);
    else if (j * 2 === n) f = 0.86; else f = 0.94 + (j % 2) * 0.05;
  }
  return last ? f * 0.86 : f;
}
class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.t = []; this.tag = 0; }
  /** add a primitive geometry (centred at its own origin) transformed by position/rotation/scale, with a flat colour */
  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, jitter = 0) {
    _eu.set(rx, ry, rz); _q.setFromEuler(_eu); _m4.compose(_p3.set(x, y, z), _q, _s3.set(sx, sy, sz));
    geo.applyMatrix4(_m4);
    const pa = geo.attributes.position.array, na = geo.attributes.normal.array, base = this.p.length / 3;
    _col.setHex(color); const r = _col.r, g = _col.g, b = _col.b, tg = this.tag;
    for (let k = 0; k < pa.length; k += 3) {
      this.p.push(pa[k], pa[k + 1], pa[k + 2]); this.n.push(na[k], na[k + 1], na[k + 2]); this.t.push(tg);
      let f = 1;
      if (jitter) { const h = Math.sin(pa[k] * 127.1 + pa[k + 1] * 311.7 + pa[k + 2] * 74.7) * 43758.5453; f = 1 + jitter * ((h - Math.floor(h)) * 2 - 1); }
      this.c.push(r * f, g * f, b * f);
    }
    if (geo.index) { const ia = geo.index.array; for (let k = 0; k < ia.length; k++) this.i.push(base + ia[k]); }
    else for (let k = 0; k < pa.length / 3; k++) this.i.push(base + k);
    geo.dispose();
    return this;
  }
  /** one vertex (position, normal, linear colour r g b); returns its index */
  vert(x, y, z, nx, ny, nz, r, g, b) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b); this.t.push(this.tag); return this.p.length / 3 - 1; }
  /** flat convex piece: pts [[x, y, z], …] counter-clockwise seen from its normal (nx, ny, nz) */
  poly(pts, color, nx = 0, ny = 0, nz = 1) {
    _col.setHex(color); const i0 = this.p.length / 3;
    for (const q of pts) this.vert(q[0], q[1], q[2], nx, ny, nz, _col.r, _col.g, _col.b);
    for (let k = 1; k < pts.length - 1; k++) this.i.push(i0, i0 + k, i0 + k + 1);
    return this;
  }
  box(w, h, d, color, x, y, z, rx, ry, rz, jit) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz, 1, 1, 1, jit); }
  /** tapered box: bottom w0 x d0 at y0, top w1 x d1 at y0+h; top shifted by shz in z */
  tbox(w0, d0, w1, d1, h, color, x, y0, z, rx = 0, ry = 0, rz = 0, shz = 0, jit = 0) {
    return this.add(taperBox(w0, d0, w1, d1, h, shz), color, x, y0, z, rx, ry, rz, 1, 1, 1, jit);
  }
  /** limb tube from y0 (top, radius r0) down to y0-h (radius r1) about the segment axis. In a limb segment it follows the
   *  limb's profile (calf, forearm…), gets rings where the joints bend and is tagged SOFT so mergeSkin blends it there. */
  limb(r0, r1, h, color, x, y0, z, seg = 7, jit = 0, tone = 0) {
    const hi = CTX.hi, kind = CTX.kind, soft = SOFT_KINDS[kind] === 1, L = CTX.L || 1, s = CTX.s || 1;
    const n = hi ? 10 : 6, ys = _ys; ys.length = 0; ys.push(y0, y0 - h);
    if (soft && kind !== 'head') {
      const hj = (kind === 'thigh' || kind === 'shin' ? 0.055 : 0.04) * s, jy = kind === 'arm' || kind === 'thigh' ? -L : 0;
      const lo = y0 - h + 0.006, up = y0 - 0.006;
      const put = (y) => { if (y > lo && y < up) ys.push(y); };
      put(jy + hj); put(jy - hj);
      if (hi) { put(jy); put(jy + hj * 0.5); put(jy - hj * 0.5); const step = 0.075 * s; for (let y = -step; y > -L + hj; y -= step) put(y); }
    } else if (soft && hi) { const m = y0 - h / 2; ys.push(m); }
    ys.sort((a, b) => b - a);
    let w = 1;
    for (let k = 1; k < ys.length; k++) {
      if (ys[w - 1] - ys[k] > 0.011) ys[w++] = ys[k];
      else if (k === ys.length - 1) { if (w > 1) ys[w - 1] = ys[k]; else ys[w++] = ys[k]; }
    }
    ys.length = w;
    _col.setHex(color); const cr = _col.r, cg = _col.g, cb = _col.b, tg = this.tag;
    if (soft) this.tag = T_SOFT;
    const base = this.p.length / 3, m = ys.length;
    for (let k = 0; k < m; k++) {
      const y = ys[k], t = h > 0 ? (y0 - y) / h : 0, pf = soft ? limbProf(kind, clamp(-y / L, 0, 1)) : 1, r = (r0 + (r1 - r0) * t) * pf, zc = z + LZ * s;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * TAU, sx = Math.sin(a), cz = Math.cos(a), px = x + r * sx, pz = zc + r * cz;
        let f = 1;
        if (jit) { const hh = Math.sin(px * 127.1 + y * 311.7 + pz * 74.7) * 43758.5453; f = 1 + jit * ((hh - Math.floor(hh)) * 2 - 1); }
        if (tone) f *= limbTone(tone, j, n, kind, clamp(-y / L, 0, 1), k === m - 1);
        this.vert(px, y, pz, sx, 0, cz, cr * f, cg * f, cb * f);
      }
    }
    LZ = 0;
    for (let k = 0; k < m - 1; k++) for (let j = 0; j < n; j++) {
      const a = base + k * n + j, b = base + k * n + (j + 1) % n, c = a + n, d = b + n;
      this.i.push(a, c, b, b, c, d);
    }
    // caps (flat-shaded fans): hems, cuffs and limb ends
    // (lean tier: only where an end shows — a hem or cuff part-way down a limb, the top of the thigh at the hip)
    const endHidden = soft && (kind === 'head' || y0 - h <= -L + 0.021);
    for (let e = hi || kind === 'thigh' ? 0 : 1; e < (hi || !endHidden ? 2 : 1); e++) {
      const k = e ? m - 1 : 0, ny = e ? -1 : 1, c0 = this.p.length / 3, row = (base + k * n) * 3;
      let cx = 0, cz2 = 0; for (let j = 0; j < n; j++) { cx += this.p[row + j * 3]; cz2 += this.p[row + j * 3 + 2]; }
      this.vert(cx / n, ys[k], cz2 / n, 0, ny, 0, cr, cg, cb);
      for (let j = 0; j < n; j++) this.vert(this.p[row + j * 3], ys[k], this.p[row + j * 3 + 2], 0, ny, 0, cr, cg, cb);
      for (let j = 0; j < n; j++) { const a = c0 + 1 + j, b = c0 + 1 + (j + 1) % n; if (e) this.i.push(c0, b, a); else this.i.push(c0, a, b); }
    }
    this.tag = tg;
    return this;
  }
  cyl(r0, r1, h, seg, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sz = 1, open = false) { return this.add(new THREE.CylinderGeometry(r0, r1, h, seg, 1, open), color, x, y, z, rx, ry, rz, sx, 1, sz); }
  sph(r, ws, hs, color, x, y, z, sx = 1, sy = 1, sz = 1, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl), color, x, y, z, rx, ry, rz, sx, sy, sz);
  }
  ico(r, color, x, y, z, sx = 1, sy = 1, sz = 1) { return this.add(new THREE.IcosahedronGeometry(r, 0), color, x, y, z, 0, 0, 0, sx, sy, sz); }
  build() {
    if (CTX.part) this._split(CTX.part === 'foot', CTX.L);
    const g = new THREE.BufferGeometry(), nv = this.p.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    const tg = new Uint8Array(nv); for (let k = 0; k < nv && k < this.t.length; k++) tg[k] = this.t[k];
    g.setAttribute('tag', new THREE.BufferAttribute(tg, 1));
    g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
  /** keep only the FOOT-tagged triangles (foot = true: moved into the ankle's frame, L below the knee) or only the others */
  _split(foot, L) {
    const P = [], N = [], C = [], T = [], I = [], map = new Int32Array(this.p.length / 3).fill(-1), t = this.t;
    for (let k = 0; k < this.i.length; k += 3) {
      const a = this.i[k], b = this.i[k + 1], c = this.i[k + 2];
      if ((t[a] === T_FOOT) !== foot) continue;
      for (const v of [a, b, c]) {
        if (map[v] < 0) { map[v] = P.length / 3; P.push(this.p[v * 3], this.p[v * 3 + 1] + (foot ? L : 0), this.p[v * 3 + 2]); N.push(this.n[v * 3], this.n[v * 3 + 1], this.n[v * 3 + 2]); C.push(this.c[v * 3], this.c[v * 3 + 1], this.c[v * 3 + 2]); T.push(foot ? 0 : t[v]); }
        I.push(map[v]);
      }
    }
    this.p = P; this.n = N; this.c = C; this.t = T; this.i = I;
  }
}
const _ys = [];

function taperBox(w0, d0, w1, d1, h, shz) {
  const a = w0 / 2, b = d0 / 2, c = w1 / 2, d = d1 / 2;
  const v = [[-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b], [-c, h, -d + shz], [c, h, -d + shz], [c, h, d + shz], [-c, h, d + shz]];
  const faces = [[0, 1, 2, 3], [7, 6, 5, 4], [3, 2, 6, 7], [1, 0, 4, 5], [2, 1, 5, 6], [0, 3, 7, 4]];
  const pos = [];
  for (const f of faces) {
    const q = f.map((i) => v[i]);
    pos.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------------------------------------ geometry cache
const geoCache = new Map();   // key -> {geo, refs}
const idleGeo = new Map();    // key -> true (refs === 0), insertion-ordered for eviction
const IDLE_MAX = 400;
function acquire(key, build) {
  let e = geoCache.get(key);
  if (!e) { e = { geo: build(), refs: 0 }; geoCache.set(key, e); }
  if (e.refs === 0) idleGeo.delete(key);
  e.refs++;
  return e.geo;
}
function release(key) {
  const e = geoCache.get(key);
  if (!e) return;
  if (--e.refs > 0) return;
  // merged skins and impostor bakes are big and cheap to rebuild from the cached segments: free them at once
  if (key.startsWith('imp:') || key.startsWith('skin:')) { e.geo.dispose(); geoCache.delete(key); return; }
  e.refs = 0; idleGeo.set(key, true);
  if (idleGeo.size > IDLE_MAX) {
    const old = idleGeo.keys().next().value; idleGeo.delete(old);
    const oe = geoCache.get(old); if (oe) { oe.geo.dispose(); geoCache.delete(old); }
  }
}
/** Stats for debugging: number of cached segment geometries. */
export function characterCacheStats() { return { cached: geoCache.size, idle: idleGeo.size }; }

const mix = (a, b, t) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
};
const shade = (c, f) => mix(c, f > 1 ? 0xffffff : 0x000000, f > 1 ? f - 1 : 1 - f);

// shared body surfaces (torso / hips / skull / hair / hands / shoes): see _body_geo.js
const B = makeBody({ THREE, CTX, shade, mix, TAGS: { SOFT: T_SOFT, LID: T_LID, JAW: T_JAW, FOOT: T_FOOT } });

// ------------------------------------------------------------------------------------------------ segment builders
// Each builder receives a small params object; its JSON is the cache key, so builders must only read from it.

/** a flat patch lying on the hips: corners [angle, y × s] (clockwise seen from outside), `off` metres proud */
function hipPatch(g, p, pts, off, col) {
  const i0 = g.p.length / 3; _col.setHex(col);
  for (const [ph, y] of pts) {
    const h = B.hipAt(p, y), sn = Math.sin(ph), cs = Math.cos(ph);
    g.vert((h[0] + off) * Math.sign(sn) * Math.pow(Math.abs(sn), 0.72), y * p.s, h[2] + (h[1] + off) * Math.sign(cs) * Math.pow(Math.abs(cs), 0.72), sn, 0, cs, _col.r, _col.g, _col.b);
  }
  for (let i = 1; i < pts.length - 1; i++) g.i.push(i0, i0 + i + 1, i0 + i);
}
function hemBand(g, p, y0, y1, grow, col, flare = 0) {      // open band round the hips (shirt / jumper / jacket hem), y × s
  const n = CTX.hi ? 14 : 8, P = [[], []];
  for (let r = 0; r < 2; r++) {
    const y = r ? y0 : y1, h = B.hipAt(p, y), gr = grow + (r ? 0 : flare);
    for (let c = 0; c < n; c++) { const ph = (c / n) * TAU; P[r].push([(h[0] + gr) * Math.sign(Math.sin(ph)) * Math.pow(Math.abs(Math.sin(ph)), 0.72), y * p.s, h[2] + (h[1] + gr) * Math.sign(Math.cos(ph)) * Math.pow(Math.abs(Math.cos(ph)), 0.72)]); }
  }
  B.surfV(g, P, typeof col === 'function' ? (r, c) => col(c, r) : (r) => (r ? col : shade(col, 0.84)), { wrap: true, double: CTX.hi ? 0.6 : 0 });      // (the lower edge is shaded: it stands off the hips)
}
const PI_ = Math.PI;
const UNTUCKED = { tee: 1, jumper: 1, hoodie: 1, polo: 1, shirt: 1, vest: 1, splash: 1, jacket: 1 };
function buildPelvis(p) {
  const { s, b } = p, g = new GB();
  const legCol = p.lycra ?? p.bottom, jit = p.checks ? 0.25 : 0;
  const baseCol = p.skirt ? p.skirtColor : legCol;
  B.pelvis(g, p, jit ? (r, c) => shade(baseCol, 1 + jit * (B.hash(r, c) - 0.5)) : () => baseCol);
  if (!p.skirt && !p.lycra && !p.chef) { if (p.hem === null || CTX.hi) hemBand(g, p, 0.092, 0.062, 0.004, 0x1e1a16); if (p.hem === null && p.jacket === null) hipPatch(g, p, [[-0.13, 0.064], [-0.13, 0.09], [0.13, 0.09], [0.13, 0.064]], 0.008, 0xb8b4a6); }       // belt + buckle
  if (!p.skirt && !p.lycra && !p.chef && p.apron === null) {      // pockets: two patch pockets behind, the slanted openings in front
    const pc = shade(legCol, p.denim ? 1.22 : 0.8);
    if (p.jacket === null || p.jacketLen === 'waist') for (const sx of [1, -1]) hipPatch(g, p, sx > 0 ? [[PI_ - 0.75, 0.045], [PI_ - 0.2, 0.045], [PI_ - 0.22, -0.035], [PI_ - 0.48, -0.05], [PI_ - 0.72, -0.035]] : [[-PI_ + 0.2, 0.045], [-PI_ + 0.75, 0.045], [-PI_ + 0.72, -0.035], [-PI_ + 0.48, -0.05], [-PI_ + 0.22, -0.035]], 0.004, pc);
    if (p.hem === null) for (const sx of [1, -1]) hipPatch(g, p, sx > 0 ? [[0.62, 0.058], [0.7, 0.058], [1.18, 0.0], [1.16, -0.012]] : [[-0.7, 0.058], [-0.62, 0.058], [-1.16, -0.012], [-1.18, 0.0]], 0.004, shade(legCol, 0.68));
  }
  if (p.hem !== null && p.jacket === null && !p.skirt) hemBand(g, p, 0.1, p.crop ? 0.1 : 0.035, 0.007, p.rib ? (c, r) => shade(p.hem, (r ? 1 : 0.8) * (c % 2 ? 0.86 : 1.02)) : p.hem, 0.003);                 // untucked top
  if (p.jacket !== null) hemBand(g, p, 0.1, p.jacketLen === 'waist' ? 0.03 : -0.085, 0.012, p.jacket, p.jacketLen === 'waist' ? 0.002 : 0.012);
  if (p.apron !== null) g.box(0.3 * b, (p.chef ? 0.52 : 0.42) * s, 0.012, p.apron, 0, 0.09 * s - (p.chef ? 0.26 : 0.21) * s, B.hipAt(p, 0)[1] + 0.016);
  return g.build();
}

function buildTorso(p) {
  const { s, b } = p, g = new GB(), hi = CTX.hi;
  const crop = p.topStyle === 'crop', vest = p.topStyle === 'vest';
  const main = p.jacket ?? (p.hivisJacket ? p.hivis : p.top);
  const jit = p.tweed ? 0.2 : p.checks ? 0.18 : 0;
  const shirtC = p.shirt ?? p.top, collared = p.topStyle === 'shirt' || p.topStyle === 'polo';
  const tied = p.neck !== null || p.scarf;
  const H = Math.PI / 2;
  const vAt = (Y) => (Y > 0.19 ? 0.05 + (Y - 0.19) * 1.5 : -1);      // half-angle of a jacket's V opening
  const cell = (Y, ph, ri, ci) => {
    const a = Math.abs(ph), front = a < H, lat = Math.abs(Math.sin(ph));
    // skin: neck opening, armholes, midriff
    if (crop && Y < 0.22) return p.skin;
    if (p.sleeves === 'none' && p.jacket === null && ((lat > 0.9 && Y > 0.34) || (Y > 0.432 && Math.pow(lat, 0.74) > 0.72 && Y < 0.47))) return p.skin;
    if (p.jacket !== null) {
      const vh = vAt(Y);
      if (front && a < vh) return collared || p.shirt !== null ? (Y > 0.455 && a < 0.2 && !tied ? p.skin : shirtC) : (Y > 0.45 - 0.02 * (1 - a) ? p.skin : shirtC);
    } else if (collared) { if (!tied && front && a < 0.5 && Y > 0.44 + 0.05 * (a / 0.42)) return p.skin; }
    else if (vest || p.dressTop) { if (front ? Y > 0.385 + 0.09 * (a / H) ** 2 : Y > 0.44) return p.skin; }
    else if (Y < 0.485 && (front ? Y > 0.466 + 0.01 * (a / H) ** 2 : Y > 0.478)) return p.skin;
    let c = main;
    if (p.jacket === null) {
      if (p.collar !== undefined && !collared && front && Y > 0.37 + 0.11 * (a / 0.36) && a < 0.36) return p.collar;       // shirt showing in a V-neck
      if (p.tartan !== undefined && ((ri % 4) === 1 || (ci % 3) === 1)) c = (ri % 4) === 1 && (ci % 3) === 1 ? shade(p.tartan, 0.7) : mix(main, p.tartan, 0.75);
      if (p.pattern) { const h = B.hash(Math.floor(Y / 0.07), Math.floor((ph + 4) / 0.5), 5); c = h > 0.66 ? shade(main, 1.35) : h < 0.3 ? shade(main, 0.6) : main; }
    }
    if (p.hivis !== null && !p.hivisJacket && Y < 0.445 && !(front && a < 0.1 + (Y - 0.3) * 2.2 && Y > 0.3)) c = p.hivis;
    if (jit) B.api.G = 1 + jit * (B.hash(ri, ci, 3) * 2 - 1);
    return c;
  };
  B.torsoCells(g, p, cell);
  const fz = (Y, x = 0) => B.frontZ(p, Y, x), bz = (Y, x = 0) => B.backZ(p, Y, x);
  if (p.hivis !== null) { B.torsoRing(g, p, 0.095, 0.125, 0.004, () => 0xc8c8c8); B.torsoRing(g, p, 0.275, 0.305, 0.004, () => 0xc8c8c8); }
  if (p.chequer) for (let i = 0; i < 8; i++) g.box(0.036 * b, 0.04 * s, 0.008, i % 2 ? 0xf4f4f4 : 0x2040a0, (i - 3.5) * 0.036 * b, 0.19 * s, fz(0.19, (i - 3.5) * 0.036 * b) + 0.004, 0, (i - 3.5) * 0.12);
  if (p.stripes) { B.torsoRing(g, p, 0.06, 0.095, 0.003, () => p.stripes[0]); B.torsoRing(g, p, 0.33, 0.365, 0.003, () => p.stripes[0]); }
  if (p.topStyle === 'splash') B.torsoRing(g, p, 0.29, 0.315, 0.002, () => 0xe8e8e8);
  if (p.topStyle === 'hoodie' && p.jacket === null) {
    g.sph(0.1, hi ? 8 : 6, hi ? 5 : 3, shade(main, 0.88), 0, 0.445 * s, bz(0.44) - 0.012, 1.15 * b, 0.6, 0.55);             // hood bunched at the back
    for (const sx of [1, -1]) g.box(0.006, 0.11 * s, 0.006, 0xe8e8e8, sx * 0.03, 0.375 * s, fz(0.38, 0.03) + 0.004, 0.06);
    g.box(0.18 * b, 0.075 * s, 0.008, shade(main, 0.86), 0, 0.11 * s, fz(0.11) + 0.002);                                   // kangaroo pocket
  }
  if (collared || p.jacket !== null || p.collar !== undefined) {
    const sc = p.jacket !== null || collared ? shirtC : p.collar;
    // collar: band behind the neck, sides, points lying on the chest
    g.cyl(0.058 * b, 0.064 * b, 0.03 * s, hi ? 10 : 6, sc, 0, 0.488 * s, 0.002, 0.14, 0, 0, 1.08, 0.95, true);
    for (const sx of [1, -1]) g.box(0.05, 0.03, 0.008, sc, sx * 0.036 * b, 0.462 * s, fz(0.462, 0.036) + 0.008, -0.75, 0, sx * (tied ? 0.45 : 0.75));
    if (p.jacket !== null) {
      for (const sx of [1, -1]) g.tbox(0.012, 0.008, 0.05 * b, 0.008, 0.21 * s, shade(p.jacket, 1.22), sx * 0.062 * b, 0.235 * s, fz(0.34, 0.07 * b) + 0.003, 0.05, 0, sx * -0.2);     // lapels
      for (const Y of [0.13, 0.06]) g.cyl(0.009, 0.009, 0.006, 6, 0x1a1a1a, 0.006, Y * s, fz(Y) + 0.004, H);
    } else if (collared && p.topStyle === 'shirt') {
      const YP = [0.02, 0.1, 0.18, 0.26, 0.33, 0.385, 0.43], pk = shade(main, 0.9), bt = mix(shade(main, 0.6), 0xf4f0e6, 0.45);                  // placket + buttons
      for (let i = 0; i < 6; i++) g.poly([[-0.011, YP[i] * s, fz(YP[i]) + 0.0035], [0.011, YP[i] * s, fz(YP[i]) + 0.0035], [0.011, YP[i + 1] * s, fz(YP[i + 1]) + 0.0035], [-0.011, YP[i + 1] * s, fz(YP[i + 1]) + 0.0035]], pk);
      for (let Y = 0.07; Y < 0.42; Y += hi ? 0.085 : 0.11) { const z = fz(Y) + 0.0055, y = Y * s; g.poly([[-0.0055, y, z], [0, y - 0.0055, z], [0.0055, y, z], [0, y + 0.0055, z]], bt); }
    } else if (p.topStyle === 'polo') { g.box(0.028, 0.1 * s, 0.004, shade(main, 0.9), 0, 0.395 * s, fz(0.39) + 0.002); g.box(0.008, 0.008, 0.004, 0xeeeeea, 0, 0.41 * s, fz(0.41) + 0.005); }
  }
  if (p.topStyle === 'jumper' && p.jacket === null && hi) g.cyl(0.058 * b, 0.066 * b, 0.014, 10, shade(main, 0.9), 0, 0.474 * s, 0.006, 0.12, 0, 0, 1.12, 0.92, true);   // ribbed neck
  if (p.chefJacket) for (let i = 0; i < 4; i++) for (const sx of [1, -1]) g.cyl(0.009, 0.009, 0.008, 6, 0xcfcfcf, sx * 0.06 * b, (0.12 + i * 0.08) * s, fz(0.12 + i * 0.08, 0.06 * b) + 0.004, H);
  // neckwear
  if (p.neck === 'bow-white' || p.neck === 'bow-black') {
    const c = p.neck === 'bow-white' ? 0xfafafa : 0x101010, z = fz(0.44) + 0.012;
    g.tbox(0.005, 0.02, 0.03, 0.02, 0.045, c, 0.022, 0.44 * s, z, 0, 0, Math.PI / 2);
    g.tbox(0.005, 0.02, 0.03, 0.02, 0.045, c, -0.022, 0.44 * s, z, 0, 0, -Math.PI / 2);
    g.box(0.016, 0.018, 0.02, c, 0, 0.44 * s, z + 0.002);
  } else if (p.neck === 'ribbon-black') {
    const z = fz(0.44) + 0.01;
    g.box(0.06, 0.012, 0.012, 0x0c0c0c, 0, 0.447 * s, z); g.box(0.012, 0.05, 0.008, 0x0c0c0c, 0.012, 0.42 * s, z, 0, 0, 0.2); g.box(0.012, 0.05, 0.008, 0x0c0c0c, -0.012, 0.42 * s, z, 0, 0, -0.2);
  } else if (p.neck === 'tie') {
    const y0 = 0.2, y1 = 0.435, z0 = fz(y0) + 0.004, z1 = fz(y1) + 0.006, len = Math.hypot((y1 - y0) * s, z1 - z0);
    g.tbox(0.05, 0.008, 0.03, 0.008, len, p.neckColor, 0, y0 * s, z0, Math.atan2(z1 - z0, (y1 - y0) * s));
    g.box(0.032, 0.026, 0.014, shade(p.neckColor, 0.9), 0, 0.447 * s, fz(0.447) + 0.008);
  }
  if (p.carnation !== null) g.ico(0.018, p.carnation, 0.085 * b, 0.4 * s, fz(0.4, 0.085 * b) + 0.008);
  if (p.chequer) { g.box(0.07, 0.04, 0.012, 0x1a1a1a, 0.075 * b, 0.36 * s, fz(0.36, 0.075 * b) + 0.006); g.box(0.04, 0.05, 0.02, 0x1a1a1a, -0.085 * b, 0.36 * s, fz(0.36, 0.085 * b) + 0.008); }
  if (p.apron !== null && !p.chefJacket) { g.box(0.2 * b, 0.2 * s, 0.008, p.apron, 0, 0.17 * s, fz(0.17, 0.07) + 0.012, -0.03); for (const sx of [1, -1]) g.box(0.012, 0.2 * s, 0.006, p.apron, sx * 0.07 * b, 0.37 * s, fz(0.37, 0.07) + 0.006, -0.12, 0, sx * 0.12); }
  if (p.apron !== null && p.chefJacket) g.box(0.24 * b, 0.12 * s, 0.008, p.apron, 0, 0.06 * s, fz(0.06, 0.08) + 0.014);
  if (p.badge !== null) { g.box(0.06, 0.03, 0.006, p.badge, 0.085 * b, 0.34 * s, fz(0.34, 0.085 * b) + 0.004, 0, 0.3); g.box(0.04, 0.006, 0.004, 0x333333, 0.085 * b, 0.34 * s, fz(0.34, 0.085 * b) + 0.008, 0, 0.3); }
  // scarf: wrapped round the neck, one end hanging with stripes and a fringe
  if (p.scarf) {
    const [c1, c2] = p.scarf, n = hi ? 12 : 8, P = [];
    for (const [y, r, dz] of hi ? [[0.452, 0.088, 0.004], [0.468, 0.098, 0.006], [0.5, 0.098, 0.004], [0.525, 0.082, 0]] : [[0.452, 0.09, 0.004], [0.488, 0.1, 0.006], [0.525, 0.082, 0]]) { const row = []; for (let c = 0; c < n; c++) { const ph = (c / n) * TAU; row.push([r * b * Math.sin(ph), y * s, dz + r * b * 0.86 * Math.cos(ph)]); } P.push(row); }
    B.surfV(g, P, (r, c) => (c % 2 ? c2 : c1), { wrap: true });
    for (let i = 0; i < 5; i++) { const Y = 0.415 - i * 0.052; g.box(0.066, 0.054 * s, 0.012, i % 2 ? c2 : c1, 0.05 * b, Y * s, fz(Y, 0.05 * b) + 0.008, 0.04, 0, 0.05); }
    g.box(0.066, 0.012, 0.013, 0xe8e0c8, 0.05 * b, 0.178 * s, fz(0.18, 0.05 * b) + 0.008);
  }
  // academic gown: yoke over the shoulders, back panel (angled away from the legs), front facings, streamers
  if (p.gown) {
    const GW = 0x0c0c0e, len = p.gown === 'scholar' ? 0.95 * s : 0.62 * s, hw = B.halfW(p, 0.42);
    g.box(hw * 2 + 0.03, 0.045 * s, 0.2 * b, GW, 0, 0.452 * s, -0.004);
    const back = taperBox(0.5 * b, 0.022, hw * 2, 0.022, len, 0); back.translate(0, -len, 0);
    g.add(back, GW, 0, 0.47 * s, bz(0.44) - 0.018, 0.16);
    for (let i = -2; i <= 2; i++) g.box(0.012, len * 0.9, 0.006, 0x18181c, i * 0.075 * b, 0.47 * s - len * 0.5, bz(0.44) - 0.032 - len * 0.5 * Math.sin(0.16), 0.16);   // pleats
    for (const sx of [1, -1]) {
      const fr = taperBox(0.07 * b, 0.02, 0.06 * b, 0.02, len * 0.9, 0); fr.translate(0, -len * 0.9, 0);
      g.add(fr, GW, sx * (hw - 0.05), 0.47 * s, fz(0.4, hw - 0.05) + 0.014, -0.05, 0, sx * 0.05);
      if (p.gown === 'commoner') g.box(0.03, 0.55 * s, 0.008, GW, sx * 0.09 * b, 0.2 * s, bz(0.3) - 0.04, -0.1);
    }
  }
  if (p.backpack !== null) {
    const bp = p.backpack, z0 = bz(0.3) - (p.gown ? 0.03 : 0), hw = B.halfW(p, 0.42);
    if (hi) g.sph(0.1, 8, 6, bp, 0, 0.25 * s, z0 - 0.055, 1.35 * b, 1.85 * s, 0.72); else g.tbox(0.25 * b, 0.13, 0.21 * b, 0.09, 0.36 * s, bp, 0, 0.07 * s, z0 - 0.06);
    g.box(0.19 * b, 0.11 * s, 0.03, shade(bp, 0.8), 0, 0.17 * s, z0 - 0.125);
    g.box(0.1, 0.012, 0.012, shade(bp, 0.55), 0, 0.33 * s, z0 - 0.125);
    for (const sx of [1, -1]) {
      g.box(0.034, 0.03, 0.2 * b, shade(bp, 0.62), sx * (hw - 0.07), 0.462 * s, -0.004);
      g.box(0.034, 0.3 * s, 0.01, shade(bp, 0.62), sx * (hw - 0.07), 0.31 * s, fz(0.31, hw - 0.07) + 0.005, -0.03);
    }
  }
  if (p.camera) {
    const z = fz(0.27) + 0.03;
    g.box(0.11, 0.075, 0.06, 0x161616, 0, 0.27 * s, z); g.box(0.112, 0.014, 0.062, 0xc4c4c8, 0, 0.27 * s + 0.042, z);
    g.cyl(0.024, 0.026, 0.04, 8, 0x2a2a2a, 0, 0.27 * s, z + 0.045, H); g.cyl(0.018, 0.018, 0.006, 8, 0x5a7aa8, 0, 0.27 * s, z + 0.067, H);
    g.box(0.012, 0.2 * s, 0.01, 0x111111, 0.05, 0.37 * s, fz(0.37, 0.05) + 0.008, -0.05, 0, 0.25); g.box(0.012, 0.2 * s, 0.01, 0x111111, -0.05, 0.37 * s, fz(0.37, 0.05) + 0.008, -0.05, 0, -0.25);
  }
  return g.build();
}

function buildHead(p) {
  const g = new GB(), R = p.headR, hc = p.headC;
  const Hd = B.head(g, p), ey = Hd.ey, ez = Hd.ez;
  B.hair(g, p, Hd.F);
  // glasses
  if (p.glasses) {        // frames as flat pieces: a rim with the lens laid on it, a bridge, arms back to the ears ('rimless': lens and a top wire)
    const rimless = p.glasses === 'rimless', fc = p.gc ?? (rimless ? 0xb0b0b0 : 0x1a1a1a), k = R / 0.112, gx = Hd.ex, w = 0.0215 * k, h = 0.0155 * k, z = ez + 0.012 * k, t = rimless ? 0.0012 : 0.0034 * k;
    const rect = (x0, y0, x1, y1, zz, col) => g.poly([[x0, y0, zz], [x1, y0, zz], [x1, y1, zz], [x0, y1, zz]], col);
    for (const sx of [1, -1]) {
      const cx = sx * gx;
      if (rimless) rect(cx - w, ey + h - 0.001, cx + w, ey + h + t, z, fc); else rect(cx - w - t, ey - h - t, cx + w + t, ey + h + t, z, fc);
      g.poly([[cx - w, ey - h * 0.8, z + 0.0008], [cx - w * 0.8, ey - h, z + 0.0008], [cx + w * 0.8, ey - h, z + 0.0008], [cx + w, ey - h * 0.8, z + 0.0008], [cx + w, ey + h, z + 0.0008], [cx - w, ey + h, z + 0.0008]], rimless ? 0xc4d6dc : 0xa8c4d0);
      const ax = sx * (gx + w + t), ay = ey + h * 0.45, zb = -R * 0.12, ah = rimless ? 0.0012 : 0.0028;
      const arm = [[ax, ay - ah, z], [ax, ay + ah, z], [sx * R * 0.9, ay + ah + 0.004, zb], [sx * R * 0.9, ay - ah + 0.004, zb]];
      g.poly(sx > 0 ? arm.reverse() : arm, fc, sx, 0, 0.2);
    }
    rect(-(gx - w), ey + h * 0.25, gx - w, ey + h * 0.25 + (rimless ? 0.0014 : 0.0032) * k, z, fc);
  }
  // hats
  const top = hc + R * 1.06, hcl = p.hatColor;
  switch (p.hat) {
    case 'mortarboard':
      g.sph(R * 1.1, 10, 4, hcl, 0, hc + 0.01, 0, 0.95, 1, 1, 0, Math.PI * 2, 0, Math.PI * 0.42, -0.15);
      g.box(0.3, 0.014, 0.3, hcl, 0, top + 0.012, -0.01, -0.12, Math.PI / 4);
      g.box(0.014, 0.014, 0.014, hcl, 0, top + 0.024, -0.01);
      g.box(0.008, 0.1, 0.008, 0x101010, 0.13, top - 0.04, 0.02); break;
    case 'bowler':
      g.sph(R * 1.08, 10, 6, hcl, 0, hc + 0.035, -0.005, 0.95, 1.0, 1.0, 0, Math.PI * 2, 0, Math.PI * 0.52);
      g.cyl(0.165, 0.165, 0.012, 12, hcl, 0, hc + 0.035, -0.005, 0, 0, 0, 0.95, 1.05);
      g.cyl(R * 1.03, R * 1.03, 0.02, 12, 0x2a2a2a, 0, hc + 0.048, -0.005, 0, 0, 0, 0.92, 1.0); break;
    case 'hardhat': case 'fire':
      g.sph(R * 1.16, 10, 6, hcl, 0, hc + 0.02, -0.004, 0.95, 1.0, 1.05, 0, Math.PI * 2, 0, Math.PI * 0.52);
      g.box(0.04, 0.02, 0.26, shade(hcl, 0.9), 0, top + 0.02, -0.004);
      g.cyl(R * 1.2, R * 1.32, 0.018, 12, hcl, 0, hc + 0.02, p.hat === 'fire' ? -0.02 : 0.02, 0, 0, 0, 0.95, 1.1);
      if (p.hat === 'fire') g.box(0.17, 0.04, 0.02, 0xc8c8c8, 0, hc + 0.05, R * 1.08); break;
    case 'helmet':
      g.sph(R * 1.2, 10, 6, hcl, 0, hc + 0.015, -0.02, 0.92, 0.85, 1.15, 0, Math.PI * 2, 0, Math.PI * 0.52, -0.1);
      for (let i = -1; i <= 1; i++) g.box(0.02, 0.012, 0.2, 0x1a1a1a, i * 0.045, top + 0.002, -0.02); break;
    case 'beanie':
      g.sph(R * 1.1, 10, 5, hcl, 0, hc + 0.01, -0.006, 0.95, 1.1, 1, 0, Math.PI * 2, 0, Math.PI * 0.5, -0.2);
      g.cyl(R * 1.04, R * 1.04, 0.045, 12, shade(hcl, 0.85), 0, hc + 0.025, -0.012, -0.2, 0, 0, 0.95, 1.0); break;
    case 'cap': case 'flatcap': {
      const flat = p.hat === 'flatcap';
      g.sph(R * 1.08, 10, 5, hcl, 0, hc + 0.01, -0.006, 0.95, flat ? 0.7 : 1, 1, 0, Math.PI * 2, 0, Math.PI * 0.5, flat ? 0.15 : -0.1);
      g.box(0.16, 0.012, flat ? 0.07 : 0.1, shade(hcl, 0.9), 0, hc + (flat ? 0.05 : 0.04), R * 0.95 + (flat ? 0.01 : 0.04), flat ? 0.2 : 0.08);
      if (p.outfit === 'police') g.box(0.2, 0.03, 0.2, 0xe8e8e8, 0, hc + 0.045, 0, 0, 0, 0, 0); break;
    }
    case 'chef':
      g.cyl(0.105, 0.1, 0.17, 10, hcl, 0, top + 0.06, -0.005);
      g.sph(0.12, 10, 5, hcl, 0, top + 0.15, -0.005, 1, 0.6, 1); break;
    case 'custodian':
      g.sph(R * 1.18, 10, 7, hcl, 0, hc + 0.0, -0.005, 0.95, 1.6, 1.08, 0, Math.PI * 2, 0, Math.PI * 0.55);
      g.cyl(R * 1.18, R * 1.3, 0.02, 12, hcl, 0, hc - 0.005, -0.005, 0, 0, 0, 0.95, 1.08);
      g.box(0.04, 0.05, 0.012, 0xd8d8d8, 0, hc + 0.07, R * 1.06, -0.25);
      g.sph(0.018, 6, 4, 0xb8b8b8, 0, top + 0.08, -0.005); break;
    case 'sunhat':
      g.cyl(R * 0.98, R * 1.06, 0.08, 12, hcl, 0, hc + 0.075, -0.005);
      g.cyl(R * 1.6, R * 1.65, 0.012, 14, hcl, 0, hc + 0.035, -0.005, 0.05); break;
    case 'headband': g.cyl(R * 0.98, R * 0.98, 0.03, 12, hcl, 0, hc + 0.05, 0, -0.15, 0, 0, 0.94, 1.0); break;
  }
  CB.headExtras(g, p, R, hc, ey, ez);      // clubbing-wardrobe hair, hats and face (no-op for the original options)
  return g.build();
}

function buildUpperArm(p) {
  const { s, b } = p, g = new GB(), L = p.UA, f = p.fig === 'f' ? 0.88 : 1, k = b * f;
  const sleeveCol = p.sleeveCol, bare = p.sleeves === 'none';
  if (CTX.hi) g.sph(0.058 * k, 9, 6, bare ? p.skin : sleeveCol, 0, -0.012, 0, 1, 1.12, 1.05);            // deltoid
  else g.limb(0.036 * k, (bare ? 0.05 : 0.056) * k, 0.028, bare ? p.skin : sleeveCol, 0, 0.03, 0);
  if (bare) g.limb(0.049 * k, 0.041 * k, L + 0.01, p.skin, 0, 0.005, 0);
  else if (p.sleeves === 'short') { g.limb(0.056 * k, 0.053 * k, L * 0.5, sleeveCol, 0, 0.005, 0); g.limb(0.0465 * k, 0.041 * k, L * 0.55 + 0.01, p.skin, 0, -L * 0.45, 0); }
  else g.limb(0.058 * k, 0.051 * k, L + 0.01, sleeveCol, 0, 0.005, 0, 7, p.jit, 1);
  if (p.stripes) g.limb(0.057 * k, 0.057 * k, 0.03, p.stripes, 0, -L * 0.55, 0);
  if (p.gown === 'scholar') { const sl = taperBox(0.012, 0.1, 0.012, 0.18, 0.4 * s, 0); sl.translate(0, -0.4 * s, 0); g.add(sl, 0x0c0c0e, p.side * 0.05, 0.02, -0.04, 0, 0, p.side * 0.1); }
  return g.build();
}

function buildForeArm(p) {
  const { s, b } = p, g = new GB(), L = p.FA, f = p.fig === 'f' ? 0.88 : 1, k = b * f;
  const longSl = p.sleeves === 'long';
  B.jointBall(g, (longSl ? 0.0455 : 0.04) * k, longSl ? p.sleeveCol : p.skin);
  g.limb(longSl ? 0.051 * k : 0.042 * k, longSl ? 0.044 * k : 0.034 * k, L, longSl ? p.sleeveCol : p.skin, 0, 0.01, 0, 7, longSl ? p.jit : 0, longSl ? 1 : 0);
  if (longSl && p.cuff !== null) g.limb(0.041 * k, 0.04 * k, 0.022, p.cuff, 0, -L + 0.008, 0);
  else if (longSl) g.limb(0.046 * k, 0.046 * k, 0.014, shade(p.sleeveCol, 0.86), 0, -L + 0.016, 0);                  // knitted / stitched cuff
  if (p.patches !== null) g.box(0.06 * b, 0.08 * s, 0.02, p.patches, 0, -0.05 * s, -0.04 * b, 0.05);
  if (p.stripes) g.limb(0.05 * k, 0.05 * k, 0.03, p.stripes, 0, -L * 0.6, 0);
  const hy = -L - 0.005;
  B.hand(g, p, hy, p.side, B.gripOf(p.prop));
  if (p.prop) addProp(g, p.prop, hy - 0.06, p.side, p.seed);
  return g.build();
}

// Props live in the forearm frame. 'front'-held props assume the elbow is bent ~90 degrees (local +z = world up,
// local -y = world forward); 'down'-held props hang along local -y.
function addProp(g, prop, y, side, seed, lc) {
  const gr = B.gripOf(prop), X = side * -(gr ? B.gripX(gr) : 0.012), PI2 = Math.PI / 2;      // (a gripped prop lies against the palm, the fingers round it)
  switch (prop) {
    case 'kebab-box':      // open polystyrene clamshell: doner, salad, chilli sauce
      g.box(0.15, 0.13, 0.05, 0xf4f2ea, X, y - 0.06, 0.06); g.box(0.15, 0.012, 0.13, 0xf4f2ea, X, y - 0.0, 0.14, -0.35);
      g.box(0.12, 0.1, 0.02, 0xa8602a, X, y - 0.06, 0.09); g.box(0.05, 0.04, 0.012, 0x4a9a3a, X + 0.03, y - 0.05, 0.1); g.box(0.04, 0.03, 0.012, 0xc02020, X - 0.03, y - 0.08, 0.1); break;
    case 'chips':          // cheesy chips in a paper tray, wooden fork
      g.box(0.13, 0.17, 0.035, 0xf2efe6, X, y - 0.07, 0.05); g.box(0.12, 0.15, 0.03, 0xe8b830, X, y - 0.07, 0.07, 0, 0, 0, 0.3);
      g.box(0.008, 0.1, 0.004, 0xd8b880, X + 0.03, y - 0.1, 0.1, 0.5); break;
    case 'cone':           // a traffic cone, carried home as a trophy
      g.cyl(0.1, 0.02, 0.42, 10, 0xf06a10, X, y - 0.23, 0.02); g.cyl(0.068, 0.044, 0.05, 10, 0xf4f4f4, X, y - 0.2, 0.02, 0, 0, 0, 1, 1, true);
      g.box(0.24, 0.03, 0.24, 0x202020, X, y - 0.45, 0.02); break;
    case 'heels': {        // a pair of heels dangling from the fingers by their straps
      const c = lc && lc.shoes !== undefined ? lc.shoes : 0x111111;
      for (const dz of [-0.025, 0.025]) {
        g.box(0.045, 0.17, 0.03, c, X, y - 0.11, dz, 0, 0, dz * 4); g.box(0.012, 0.012, 0.09, c, X, y - 0.04, dz - 0.03, 0.9, 0, 0);
        g.box(0.035, 0.06, 0.012, 0xd8c0a8, X, y - 0.08, dz + 0.016, 0, 0, dz * 4);
      }
      break;
    }
    case 'clutch': {       // envelope clutch held in the hand
      const c = lc && lc.bag !== undefined ? lc.bag : 0x111111, t = lc && lc.trim !== undefined ? lc.trim : 0xd8b850;
      g.box(0.035, 0.115, 0.2, c, X, y - 0.02, 0.03); g.box(0.038, 0.02, 0.03, t, X, y + 0.02, 0.05); break;
    }
    case 'pint': {
      const stout = seed % 3 === 0;
      g.cyl(0.04, 0.034, 0.15, 9, stout ? 0x2a1608 : 0xd08a20, X, y - 0.01, 0.03, PI2);
      g.cyl(0.041, 0.041, 0.025, 9, 0xf2ead2, X, y - 0.01, 0.115, PI2); break;
    }
    case 'book': { const cov = [0x7a1a1a, 0x1a3a6a, 0x2a5a2a, 0x3a2a1a][seed % 4]; g.box(0.04, 0.16, 0.22, cov, X, y - 0.04, 0.03); g.box(0.034, 0.15, 0.205, 0xf2eee0, X, y - 0.04, 0.032); break; }
    case 'clipboard': g.box(0.23, 0.31, 0.012, 0x8a5a2a, X, y - 0.12, 0.04, -0.9); g.box(0.2, 0.26, 0.004, 0xf6f6f6, X, y - 0.125, 0.05, -0.9); g.box(0.07, 0.03, 0.02, 0xb8b8b8, X, y - 0.0, 0.03, -0.9); break;
    case 'camera':        // (silver top plate + lens glass so it reads as a camera, not a black box at the hip)
      g.box(0.12, 0.07, 0.08, 0x161616, X, y - 0.03, 0.02); g.box(0.122, 0.072, 0.014, 0xc4c4c8, X, y - 0.03, 0.066);
      g.cyl(0.026, 0.028, 0.05, 8, 0x2a2a2a, X, y - 0.08, 0.02); g.cyl(0.019, 0.019, 0.006, 8, 0x5a7aa8, X, y - 0.106, 0.02); break;
    case 'pizza-box': g.box(0.34, 0.34, 0.05, 0xc8a066, X + side * -0.08, y - 0.12, 0.05); g.box(0.2, 0.08, 0.004, 0xc02020, X + side * -0.08, y - 0.12, 0.077); break;
    case 'cue': g.cyl(0.006, 0.013, 1.45, 6, 0xc8a060, X, y, -0.27, PI2); g.cyl(0.0135, 0.014, 0.35, 6, 0x2a1a10, X, y, -0.9, PI2); g.cyl(0.007, 0.007, 0.012, 6, 0x3a6ad0, X, y, 0.46, PI2); break;
    case 'mallet': g.cyl(0.014, 0.014, 0.85, 6, 0x8a6a3a, X, y - 0.42, 0.01); g.cyl(0.045, 0.045, 0.24, 8, 0x6a4a2a, X, y - 0.86, 0.01, PI2); g.cyl(0.046, 0.046, 0.03, 8, 0x2040a0, X, y - 0.86, 0.06, PI2); break;
    case 'phone': g.box(0.072, 0.145, 0.012, 0x141414, X, y - 0.05, 0.035); g.box(0.064, 0.13, 0.002, 0x6ab0e0, X, y - 0.05, 0.042); break;
    case 'bag-tesco': case 'bag-sainsburys': case 'bag-waitrose': case 'bag': {
      const c = { 'bag-tesco': 0xf4f4f4, 'bag-sainsburys': 0xf06c00, 'bag-waitrose': 0x4a7a3a, bag: 0xd8c8a0 }[prop];
      const band = { 'bag-tesco': 0x1f4e9a, 'bag-sainsburys': 0xffffff, 'bag-waitrose': 0xe8f0e0, bag: 0x8a6a3a }[prop];
      g.box(0.012, 0.12, 0.012, c, X, y - 0.04, 0.04); g.box(0.012, 0.12, 0.012, c, X, y - 0.04, -0.04);
      g.tbox(0.13, 0.26, 0.11, 0.24, 0.3, c, X, y - 0.42, 0);
      g.box(0.135, 0.06, 0.25, band, X, y - 0.28, 0);
      g.ico(0.07, [0x4a8a2a, 0xe8c040, 0xc02020][seed % 3], X, y - 0.12, 0.02); break;
    }
    case 'coffee': g.cyl(0.04, 0.03, 0.11, 9, 0xf4f0e8, X, y - 0.01, 0.02, PI2); g.cyl(0.042, 0.042, 0.012, 9, 0x4a2a1a, X, y - 0.01, 0.08, PI2); g.cyl(0.041, 0.035, 0.03, 9, 0x8a5a3a, X, y - 0.01, 0.0, PI2); break;
    case 'kebab': g.cyl(0.05, 0.02, 0.18, 7, 0xf4f0e8, X, y - 0.01, 0.06, PI2); g.ico(0.04, 0xa8602a, X, y - 0.01, 0.15); break;
    case 'bottle': g.cyl(0.03, 0.03, 0.17, 8, 0x1a5a2a, X, y - 0.01, 0.04, PI2); g.cyl(0.01, 0.026, 0.08, 8, 0x1a5a2a, X, y - 0.01, 0.16, PI2); break;
    case 'umbrella': g.cyl(0.012, 0.012, 0.85, 6, 0x111111, X, y - 0.43, 0.0); g.cyl(0.05, 0.015, 0.55, 8, 0x1a1a3a, X, y - 0.55, 0.0); g.box(0.012, 0.012, 0.08, 0x3a2a1a, X, y + 0.0, 0.03); break;
    case 'dart': g.cyl(0.004, 0.004, 0.14, 4, 0xc8c8c8, X, y - 0.04, 0.03, 0.3); g.box(0.002, 0.04, 0.03, 0xc02020, X, y + 0.02, 0.02, 0.3); break;
  }
}

// clubbing-wardrobe builders (garments modelled on the same body: see _wardrobe_geo.js)
const CB = makeClubBuilders({ THREE, GB, shade, mix, addProp, taperBox, B, CTX, T_FOOT });

function buildThigh(p) {
  const { b } = p, g = new GB(), L = p.L1, f = p.fig === 'f';
  const col = p.legs === 'bare' ? p.skin : p.legs === 'tights' ? mix(p.tights, p.skin, 0.25) : p.legCol;
  if (CTX.hi) g.sph(0.082 * b, 8, 5, p.legs === 'shorts' || p.legs === 'trousers' ? p.legCol : col, 0, 0, -0.004, 1, 0.9, 1.05);      // hip / seat
  const tr = p.legs === 'trousers' && !p.lycra ? 0.006 : 0;      // cloth hangs clear of the leg
  g.limb(((f ? 0.087 : 0.085) + tr) * b, ((f ? 0.06 : 0.063) + tr * 1.3) * b, L + 0.045, col, 0, 0.03, 0, 7, p.jit, p.tone);
  if (p.legs === 'shorts' && !p.lycra) { g.limb(0.0655 * b, 0.061 * b, L * 0.32 + 0.012, p.skin, 0, -L * 0.7, 0); g.limb(0.073 * b, 0.074 * b, 0.014, shade(p.legCol, 0.85), 0, -L * 0.7 + 0.014, 0); }
  return g.build();
}

function buildShin(p) {
  const { s, b } = p, g = new GB(), L = p.L2, f = p.fig === 'f';
  const covered = p.legs === 'trousers' && !p.lycra;
  const col = p.legs === 'tights' ? mix(p.tights, p.skin, 0.25) : covered ? p.legCol : p.skin;
  const r0 = (covered ? 0.069 : f ? 0.059 : 0.062) * b, r1 = (covered ? 0.058 : f ? 0.038 : 0.042) * b;
  B.jointBall(g, r0 * 0.98, covered || p.legs === 'tights' ? col : p.legs === 'shorts' && p.lycra ? p.legCol : col);
  g.limb(r0, r1, L + 0.03, col, 0, 0.03, 0, 7, covered ? p.jit : 0, covered ? p.tone : 0);
  if (covered && CTX.hi) g.limb(r1 + 0.003, r1 + 0.004, 0.02, shade(col, 0.86), 0, -L + 0.02, 0);                                   // trouser hem, breaking on the shoe
  if (p.lycra && p.legs === 'shorts') g.limb(0.064 * b, 0.06 * b, 0.07, p.legCol, 0, 0.012, 0);
  if (!covered && p.legs !== 'tights' && p.shoeStyle !== 'heel' && p.shoeStyle !== 'barefoot') g.limb(0.046 * b, 0.045 * b, 0.075, 0xf2f2f2, 0, -L + 0.065, 0);      // socks
  // shoe: sole on the ground at y = -L - ankle (turns on the ankle bone)
  const gy = -L - p.ankle, sc = p.shoes, w = 0.05 * b;
  switch (p.shoeStyle) {
    case 'trainer': B.shoeForm(g, { last: 'trainer', col: sc, sole: sc === 0xeeeeee ? 0xcfcfcf : 0xf2f2f2, w, toe: shade(sc, 0.88), top: shade(sc, 0.8) }, gy); break;
    case 'boot':
      B.shoeForm(g, { last: 'boot', col: sc, sole: 0x1a1a1a, w: w * 1.04, toe: shade(sc, 0.9) }, gy);
      g.limb(0.054 * b, 0.056 * b, 0.13, sc, 0, gy + 0.21, 0); break;
    case 'heel': {       // a court shoe on a slim heel, the instep bare
      B.shoeForm(g, { last: 'court', col: sc, sole: shade(sc, 0.6), w: w * 0.92, foot: p.legs === 'tights' ? col : p.skin, lift: 0.03 * s }, gy);
      const T0 = g.tag; g.tag = T_FOOT; g.tbox(0.014, 0.014, 0.03, 0.034, 0.032 * s, shade(sc, 0.85), 0, gy, -0.052 * s); g.tag = T0; break;
    }
    case 'barefoot': B.shoeForm(g, { last: 'bare', col: p.skin, w, toe: shade(p.skin, 0.95) }, gy); break;      // bare feet in skin tone (no shoe)
    default: B.shoeForm(g, { last: 'shoe', col: sc, sole: shade(sc, 0.5), w, toe: shade(sc, 0.92) }, gy);
  }
  return g.build();
}

// ------------------------------------------------------------------------------------------------ pose params
const P_RX = 0, P_RY = 1, P_RZ = 2, R_X = 3, R_Y = 4, R_Z = 5, PV_X = 6, PV_Y = 7, PV_Z = 8, SP_X = 9, SP_Y = 10, SP_Z = 11,
  HD_X = 12, HD_Y = 13, HD_Z = 14, AL_F = 15, AL_A = 16, AL_T = 17, EL_L = 18, AR_F = 19, AR_A = 20, AR_T = 21, EL_R = 22,
  LL_F = 23, LL_A = 24, LL_T = 25, KN_L = 26, LR_F = 27, LR_A = 28, LR_T = 29, KN_R = 30, FT_L = 31, FT_R = 32, NP = 33;

if (NP !== GAIT_NP) console.error('[characters] _gait.js pose indices are out of date');
const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const q2 = (x) => Math.round(x * 2) / 2;

function rest(o) {
  o.fill(0);
  o[AL_A] = o[AR_A] = 0.08; o[EL_L] = o[EL_R] = 0.15; o[KN_L] = o[KN_R] = 0.03;
}

/**
 * Rig height that puts the lower foot exactly on the ground (+ extra): per foot the lowest point of the sole — heel or
 * toe under the foot's net pitch, the sole's edge under the leg's roll — below the hip, with the pelvis / rig roll.
 * Call it after the leg, foot (FT_*), pelvis and rig-roll parameters are set.
 */
function plant(c, o, extra) {
  const D = c.dims, a = D.ankle, zt = 0.206 * D.s, zh = -0.082 * D.s, hw = 0.05 * D.b, px = o[PV_X], roll = o[PV_Z] + o[R_Z];
  let best = -1e9;
  for (let side = 0; side < 2; side++) {
    const F = o[side ? LR_F : LL_F], K = o[side ? KN_R : KN_L], sg = side ? -1 : 1;
    const th = px - F + K + o[side ? FT_R : FT_L], sn = Math.sin(th);
    const rho = sg * o[side ? LR_A : LL_A] + roll;
    const depth = (D.L1 * Math.cos(px - F) + D.L2 * Math.cos(px - F + K) + a * Math.cos(th) + (sn > 0 ? zt : zh) * sn) * Math.cos(rho) + hw * Math.abs(Math.sin(rho));
    const need = depth - sg * D.hipX * (Math.sin(o[PV_Z]) + Math.sin(o[R_Z]));
    if (need > best) best = need;
  }
  o[P_RY] = (best + extra) / Math.cos(o[R_Z]) - D.hipY;
  c._pl = extra;
}

function idleUpper(c, o, amt = 1) {
  const t = c.t, k = c.k;
  const br = Math.sin(t * 1.8 + k);
  o[SP_X] += 0.012 * br * amt;
  o[AL_A] += 0.012 * br * amt; o[AR_A] += 0.012 * br * amt;
  o[HD_Y] += amt * 0.4 * Math.sin(t * 0.21 + k) * Math.sin(t * 0.13 + k * 3);
  o[HD_X] += amt * 0.06 * Math.sin(t * 0.17 + k * 2);
}

/** keep the feet flat on the ground for the leg angles in o (amt 0..1); the foot bones hang off the shins */
function flatFeet(o, amt = 1) {
  o[FT_L] = clamp((o[LL_F] - o[KN_L] - o[PV_X] - o[R_X]) * amt, -1.0, 1.0);
  o[FT_R] = clamp((o[LR_F] - o[KN_R] - o[PV_X] - o[R_X]) * amt, -1.0, 1.0);
}

/**
 * The walk / run / idle of the upper body (arms against the legs, pelvis and spine turning with the stride, breathing
 * and the weight drifting from foot to foot when standing) for c.phase and c.speed. The LEGS, the feet and the height
 * of the pelvis are core/_gait.js (planted feet, solved exactly): c._lk = 1 asks computePose to solve them once the
 * pose has finished with the rig and the pelvis; a pose that only borrows the walk calls walkLegs() itself.
 */
function gait(c, o) {
  const sp = c.speed, m = sm(0.05, 0.9, sp), r = sm(2.0, 2.9, sp / Math.sqrt(c.dims.s)), im = 1 - m;
  const ph = c.phase, s = Math.sin(ph), cp = Math.cos(ph), t = c.t, k = c.k;
  const br = Math.sin(t * 1.55 + k), sh = Math.sin(t * 0.29 + k * 2), sh2 = Math.sin(t * 0.11 + k);
  const wsh = 0.5 + 0.5 * sh * (0.75 + 0.25 * sh2);             // idle: weight drifts from one leg to the other
  // arms swing against the legs (the left leg is forward while sin(phase) > 0), elbows giving on the forward swing
  const aA = (0.3 + 0.44 * r) * m;
  o[AL_F] = -aA * s + 0.12 * r * m + 0.03 * m; o[AR_F] = aA * s + 0.12 * r * m + 0.03 * m;
  o[AL_A] = o[AR_A] = 0.08 + 0.06 * r + 0.014 * br * im;
  const el = 0.16 + (0.14 + 1.2 * r) * m;
  o[EL_L] = el + (0.14 + 0.1 * r) * m * Math.max(0, -s) + 0.04 * im * sh; o[EL_R] = el + (0.14 + 0.1 * r) * m * Math.max(0, s) - 0.04 * im * sh;
  // pelvis: turns with the stride, drops on the swinging side, and the body rides over the standing foot
  const sway = -cp * m * (1 - 0.5 * r), idleSw = (wsh - 0.5) * 2 * im;
  o[PV_Y] = -0.1 * s * m; o[PV_Z] = 0.05 * sway + 0.045 * idleSw;
  o[P_RX] = 0.016 * sway + 0.028 * idleSw;
  // spine counter-rotates and leans into the walk; breathing when standing; the head stays level and looks ahead
  o[SP_X] = (0.035 + 0.16 * r) * m + 0.016 * br * im + 0.012 * Math.sin(2 * ph) * m; o[SP_Y] = 0.17 * s * m; o[SP_Z] = -o[PV_Z] * 0.85;
  o[HD_X] = -o[SP_X] * 0.7 + im * 0.05 * Math.sin(t * 0.17 + k * 2);
  o[HD_Y] = -(o[SP_Y] + o[PV_Y]) * 0.9 + im * 0.4 * Math.sin(t * 0.21 + k) * Math.sin(t * 0.13 + k * 3);
  o[HD_Z] = -(o[PV_Z] + o[SP_Z]) + 0.02 * idleSw;
  c._lk = 1;
}
/** the legs of the walk, now, as a pure function of phase and speed (for poses that go on to bend them their own way) */
function walkLegs(c, o) { gaitTargets(c, false); gaitSolve(c, o, 0); c._lk = 0; }

function holdProp(c, o) {
  const R = c.spec;
  if (c.leftHand === 'lead') { o[AL_F] = 0.38 + 0.25 * (o[AL_F] - 0.0) * 0.2; o[EL_L] = 0.55; o[AL_A] = 0.12; }
  // (2026-11-22, families: systems/pedestrians.js) c.reach +1 / -1: the left / right hand held out to someone beside
  // them, the arm raised c.reachUp radians from hanging (a child reaching up to a grown-up's hand: ~2; the grown-up's
  // hand held a little out and down to it: ~0.3). c.pushing: both hands forward on a handle (a pushchair).
  if (c.pushing) { o[AL_F] = o[AR_F] = 0.62; o[EL_L] = o[EL_R] = 0.5; o[AL_A] = o[AR_A] = 0.04; o[AL_T] = o[AR_T] = 0; return; }
  if (c.reach > 0) { o[AL_A] = c.reachUp || 0.3; o[AL_F] = 0.05 + o[AL_F] * 0.08; o[EL_L] = 0.1; o[AL_T] = 0; }
  else if (c.reach < 0) { o[AR_A] = c.reachUp || 0.3; o[AR_F] = 0.05 + o[AR_F] * 0.08; o[EL_R] = 0.1; o[AR_T] = 0; if (R.hold) return; }
  if (!R.hold) return;
  if (R.hold === 'down') { o[AR_F] *= 0.5; o[EL_R] = 0.1; o[AR_A] = 0.15; return; }
  const swing = o[AR_F];
  o[AR_F] = 0.2 + swing * 0.15; o[EL_R] = 1.42; o[AR_A] = 0.06;
  if (R.prop === 'phone') {
    const up = c.phoneUp;
    o[AR_F] = lerp(o[AR_F], 0.5, up); o[EL_R] = lerp(o[EL_R], 1.95, up); o[AR_A] = lerp(o[AR_A], -0.22, up);
    o[HD_X] += 0.5 * up; o[HD_Y] *= 1 - up;
  }
}

function computePose(c, name, o) {
  const D = c.dims, t = c.t, pt = c.pt, k = c.k;
  rest(o); c._pl = NaN; c._lk = 0;
  { const X = c._fx; X[0] = X[1] = X[2] = X[3] = 0; }
  switch (name) {
    case 'sit': case 'write': {
      o[P_RY] = D.seat - D.hipY;
      o[LL_F] = o[LR_F] = 1.52; o[KN_L] = o[KN_R] = 1.52; o[LL_A] = 0.08; o[LR_A] = 0.08;
      if (name === 'sit') {
        idleUpper(c, o);
        o[SP_X] -= 0.06; o[AL_F] = o[AR_F] = 0.5; o[EL_L] = o[EL_R] = 0.8; o[AL_A] = o[AR_A] = 0.12;
        const cross = Math.sin(k * 7) > 0.3;
        if (c._sitKnee) { o[KN_L] = o[KN_R] = c._sitKnee; }
        if (cross) { o[LL_A] = -0.12; o[LL_F] = 1.7; o[KN_L] = 1.3; }
        holdProp(c, o);
      } else {
        if (c._sitKnee) { o[KN_L] = o[KN_R] = c._sitKnee; }
        o[SP_X] = 0.38; o[HD_X] = 0.35;
        const look = sm(0, 0.4, ((t + k * 3) % 9) - 7.2) * (1 - sm(0, 0.4, ((t + k * 3) % 9) - 8.5));
        o[HD_X] -= 0.45 * look;
        o[AL_F] = 0.95; o[EL_L] = 1.3; o[AL_A] = -0.08;
        o[AR_F] = 0.9 + 0.03 * Math.sin(t * 2.3 + k); o[EL_R] = 1.2 + 0.06 * Math.sin(t * 9) * (1 - look); o[AR_A] = -0.06 + 0.05 * Math.sin(t * 1.7);
      }
      break;
    }
    case 'sitground': {
      o[P_RY] = D.groundSeat - D.hipY;
      o[LL_F] = 1.45; o[LR_F] = 1.25; o[KN_L] = 0.25; o[KN_R] = 1.0; o[LL_A] = 0.12; o[LR_A] = 0.1;
      o[SP_X] = -0.22; idleUpper(c, o);
      o[AL_F] = o[AR_F] = -0.55; o[AL_A] = o[AR_A] = 0.22; o[EL_L] = o[EL_R] = 0.08;
      break;
    }
    case 'drive': {
      o[P_RY] = D.driveSeat - D.hipY;
      o[LL_F] = o[LR_F] = 1.3; o[KN_L] = o[KN_R] = 0.95; o[LL_A] = o[LR_A] = 0.1;
      o[SP_X] = -0.14; o[HD_X] = 0.1; idleUpper(c, o, 0.3);
      const st = c.steer;
      o[AL_F] = 1.12 + st * 0.15; o[AR_F] = 1.12 - st * 0.15; o[AL_A] = o[AR_A] = -0.06; o[EL_L] = o[EL_R] = 0.55;
      o[SP_Y] = st * 0.05; o[HD_Y] += st * 0.2;
      break;
    }
    case 'cycle': {
      const cy = D.cycle;
      o[P_RY] = cy.saddle - D.hipY;
      for (let side = 0; side < 2; side++) {
        const a = c.crank + side * Math.PI;
        const dz = cy.bbZ + cy.crank * Math.sin(a), dy = cy.bbY + cy.crank * Math.cos(a) + 0.06 - cy.saddle;
        ik(D.L1, D.L2, dz, dy, c);
        o[side ? LR_F : LL_F] = c._ikF; o[side ? KN_R : KN_L] = c._ikK;
      }
      o[LL_A] = o[LR_A] = 0.06;
      o[SP_X] = 0.3 + 0.08 * sm(3, 8, c.speed); o[HD_X] = -0.3;
      const st = c.steer;
      o[AL_F] = 0.62 + st * 0.12; o[AR_F] = 0.62 - st * 0.12; o[AL_A] = o[AR_A] = 0.02; o[EL_L] = o[EL_R] = 0.75;
      o[SP_Y] = st * 0.06 + 0.03 * Math.sin(c.crank) * sm(0.5, 3, c.speed); o[HD_Y] = st * 0.15;
      break;
    }
    case 'punt': {
      const T = 4.2, u = ((pt + k) % T) / T;
      c.puntPhase = u;
      const up = sm(0, 0.38, u), push = sm(0.4, 0.82, u), rec = sm(0.85, 1, u);
      const arm = lerp(lerp(0.9, 2.65, up), 0.65, push) * (1 - rec) + 0.9 * rec;
      const lean = 0.35 * Math.sin(Math.PI * clamp((u - 0.4) / 0.5, 0, 1));
      o[LL_F] = 0.28; o[KN_L] = 0.2 + lean * 0.5; o[LR_F] = -0.22; o[KN_R] = 0.06 + lean * 0.3; o[LL_A] = 0.1; o[LR_A] = 0.12;
      o[SP_X] = lean + 0.05; o[SP_Y] = -0.28; o[HD_Y] = 0.2; o[HD_X] = -lean * 0.4;
      o[AR_F] = arm; o[AL_F] = arm - 0.15; o[AR_A] = 0.02; o[AL_A] = -0.38; o[EL_R] = 0.7 - 0.3 * up * (1 - push); o[EL_L] = 0.55;
      plant(c, o, 0);
      break;
    }
    case 'dance': {
      const bt = t * 2.07 * TAU, v = c.variant % 6;
      let extra = 0;
      if (v === 0) {
        const bnc = 0.5 + 0.5 * Math.sin(2 * bt);
        o[LL_A] = o[LR_A] = 0.12; o[KN_L] = o[KN_R] = 0.15 + 0.25 * bnc; o[LL_F] = o[LR_F] = 0.1 + 0.12 * bnc;
        o[AR_A] = 0.3; o[AR_F] = 2.5 + 0.25 * Math.sin(bt); o[EL_R] = 0.35 + 0.45 * Math.max(0, Math.sin(bt));
        o[AL_F] = 0.6; o[EL_L] = 1.6; o[HD_X] = 0.15 * Math.sin(2 * bt); o[SP_X] = 0.08 * bnc;
      } else if (v === 1) {
        const sw = Math.sin(bt / 2);
        o[P_RX] = 0.07 * sw; o[PV_Z] = 0.12 * sw; o[SP_Z] = -0.15 * sw; o[HD_Z] = 0.08 * sw;
        o[AL_A] = 0.7 + 0.25 * sw; o[AR_A] = 0.7 - 0.25 * sw; o[EL_L] = o[EL_R] = 1.1; o[AL_F] = o[AR_F] = 0.4;
        o[KN_L] = 0.1 + 0.3 * Math.max(0, sw); o[KN_R] = 0.1 + 0.3 * Math.max(0, -sw); o[LL_F] = 0.15 * Math.max(0, sw); o[LR_F] = 0.15 * Math.max(0, -sw);
      } else if (v === 2) {
        const tw = Math.sin(bt);
        o[PV_Y] = 0.45 * tw; o[SP_Y] = -0.65 * tw; o[HD_Y] = 0.15 * tw; o[KN_L] = o[KN_R] = 0.5; o[LL_F] = o[LR_F] = 0.3; o[SP_X] = 0.15;
        o[AL_F] = o[AR_F] = 0.9; o[AL_A] = o[AR_A] = 0.5; o[EL_L] = o[EL_R] = 1.4;
      } else if (v === 3) {
        const s2 = Math.sin(2 * bt);
        o[AL_A] = 2.5 + 0.25 * Math.sin(bt); o[AR_A] = 2.5 - 0.25 * Math.sin(bt); o[AL_F] = o[AR_F] = 0.4;
        o[EL_L] = 0.3 + 0.3 * Math.max(0, s2); o[EL_R] = 0.3 + 0.3 * Math.max(0, -s2);
        o[KN_L] = o[KN_R] = 0.15 + 0.3 * Math.max(0, -s2); extra = 0.06 * Math.max(0, s2); o[HD_X] = -0.2;
      } else if (v === 4) {
        const a = q2(Math.sin(bt)), b = q2(Math.sin(bt / 2));
        o[SP_Y] = 0.4 * b; o[EL_L] = o[EL_R] = 1.57; o[AL_F] = 0.5 + 0.6 * a; o[AR_F] = 0.5 - 0.6 * a;
        o[HD_Y] = 0.5 * q2(Math.sin(bt / 2 + 1)); o[LL_F] = 0.22 * Math.max(0, b); o[KN_L] = 0.3 * Math.max(0, b); o[LR_F] = 0.22 * Math.max(0, -b); o[KN_R] = 0.3 * Math.max(0, -b);
      } else {
        const step = Math.floor((bt / Math.PI) % 6);
        o[AL_A] = 2.2; o[AL_F] = 0.7; o[EL_L] = 2.4;
        o[AR_F] = 1.45; o[AR_A] = -0.5 + step * 0.22; o[EL_R] = 0.1; o[SP_Y] = -0.2 + step * 0.08; o[HD_Y] = -0.3 + step * 0.12;
        o[KN_L] = o[KN_R] = 0.15 + 0.15 * Math.max(0, Math.sin(2 * bt));
      }
      plant(c, o, extra);
      break;
    }
    case 'holding-hands': case 'arm-in-arm': {     // walking with a partner on c.partnerSide (+1 = their left)
      gait(c, o); holdProp(c, o);
      const sd = c.partnerSide >= 0 ? 1 : -1, look = Math.max(0, Math.sin(t * 0.37 + k)) ** 3;
      if (name === 'holding-hands') {   // inner hand out to the side at hip height, little swing
        const sw = 0.03 * Math.sin(c.phase) * sm(0.05, 0.9, c.speed);
        if (sd > 0) { o[AL_F] = 0.1 + sw; o[AL_A] = 0.24; o[EL_L] = 0.28; o[AL_T] = -0.3; }
        else { o[AR_F] = 0.1 - sw; o[AR_A] = 0.24; o[EL_R] = 0.28; o[AR_T] = -0.3; }
      } else {                          // arm-in-arm: inner elbow crooked out toward the partner, forearm across the front
        if (sd > 0) { o[AL_F] = 0.28; o[AL_A] = 0.3; o[EL_L] = 1.35; o[AL_T] = 0.55; }
        else { o[AR_F] = 0.28; o[AR_A] = 0.3; o[EL_R] = 1.35; o[AR_T] = 0.55; }
        o[SP_Z] -= sd * 0.05; o[HD_Z] -= sd * 0.08;
      }
      o[HD_Y] = o[HD_Y] * 0.5 + sd * 0.55 * look;
      break;
    }
    case 'drunk': case 'stagger-carry': {
      gait(c, o);
      const w = 0.6 + 0.4 * Math.sin(t * 0.31 + k);
      o[R_Z] += (0.1 * Math.sin(t * 0.9 + k) + 0.05 * Math.sin(t * 2.3 + 1)) * w;
      o[R_Y] += 0.2 * Math.sin(t * 0.6 + k);
      o[P_RX] += 0.07 * Math.sin(t * 0.7 + k);
      o[SP_Z] += 0.12 * Math.sin(t * 1.3); o[SP_X] += 0.06 + 0.05 * Math.sin(t * 0.8);
      o[HD_Z] = 0.22 * Math.sin(t * 1.1 + k); o[HD_X] += 0.18 + 0.1 * Math.sin(t * 0.8);
      o[AL_A] += 0.25 + 0.2 * Math.sin(t * 1.7); o[AR_A] += 0.25 + 0.2 * Math.sin(t * 1.9 + 2);
      o[EL_L] += 0.2; o[EL_R] += 0.2;
      if (Math.sin(t * 0.23 + k * 5) > 0.85) { o[AR_A] += 1.2; o[AR_F] += 0.6; }     // occasional flail
      holdProp(c, o);
      if (name === 'stagger-carry') {   // shoes (or whatever) dangling from the left hand, right arm out for balance
        o[AL_F] = 0.12 + 0.25 * Math.sin(c.phase) * sm(0.05, 0.9, c.speed); o[EL_L] = 0.12; o[AL_A] = 0.16;
        if (!c.spec.hold) { o[AR_A] = 0.55 + 0.25 * Math.sin(t * 1.3 + k); o[EL_R] = 0.4; o[AR_F] = 0.25; }
      }
      break;      // (unsteady above the hips; the feet are planted by the walk)
    }
    case 'lecture': {
      const T = 14, x = (pt + k * 2) % T;
      const turn = sm(7, 8, x) * (1 - sm(11, 12.5, x));
      gait(c, o);
      o[R_Y] = Math.PI * 0.92 * turn;
      const n1 = Math.sin(t * 1.3 + k) * 0.6 + Math.sin(t * 2.1 + k * 1.7) * 0.4, n2 = Math.sin(t * 1.7 + k * 2) * 0.6 + Math.sin(t * 0.9) * 0.4;
      const talk = 1 - sm(6.5, 7, x) * (1 - sm(12.5, 13, x));
      o[AR_F] = lerp(2.05 + 0.08 * Math.sin(t * 7), 0.45 + 0.35 * n1, talk); o[EL_R] = lerp(0.7 + 0.15 * Math.cos(t * 7), 1.0 + 0.5 * n2, talk);
      o[AR_A] = lerp(0.15, 0.25 + 0.15 * n2, talk);
      o[AL_F] = 0.35 + 0.3 * n2 * talk; o[EL_L] = 0.9 + 0.5 * n1 * talk; o[AL_A] = 0.2;
      o[HD_Y] = 0.5 * Math.sin(t * 0.4) * talk; o[HD_X] = -0.1 * (1 - talk);
      const point = sm(12.5, 13, x) * (1 - sm(13.6, 14, x));
      o[AR_A] = lerp(o[AR_A], 1.3, point); o[AR_F] = lerp(o[AR_F], -0.3, point); o[EL_R] = lerp(o[EL_R], 0.15, point);
      o[SP_Y] -= 0.3 * point; o[HD_Y] -= 0.7 * point;
      break;
    }
    case 'crouch': {
      o[LL_F] = o[LR_F] = 1.95; o[KN_L] = o[KN_R] = 2.3; o[LL_A] = o[LR_A] = 0.25;
      plant(c, o, 0);
      o[P_RZ] = -(D.L1 * Math.sin(1.95) + D.L2 * Math.sin(1.95 - 2.3)) * 0.9;
      o[SP_X] = 0.55; o[HD_X] = 0.45 + 0.05 * Math.sin(t * 7);
      o[AR_F] = 1.2 + 0.12 * Math.max(0, Math.sin(t * 7)); o[EL_R] = 0.15; o[AR_A] = -0.05 + 0.15 * Math.sin(t * 0.7);
      o[AL_F] = 0.85; o[EL_L] = 0.9; o[AL_A] = 0.15;
      break;
    }
    case 'throw': {
      const T = 3, x = (pt % T);
      o[R_Y] = 0.45; o[HD_Y] = -0.45; o[SP_Y] = -0.05;
      o[LL_F] = -0.1; o[LR_F] = 0.18; o[KN_L] = 0.06; o[KN_R] = 0.04; o[LL_A] = 0.1; o[LR_A] = 0.08;
      let el = 1.35 + 0.04 * Math.sin(x * 5);
      if (x > 1.6) el = lerp(el, 2.0, sm(1.6, 1.85, x));
      if (x > 1.85) el = lerp(2.0, 0.2, sm(1.85, 2.0, x));
      if (x > 2.6) el = lerp(0.2, 1.35, sm(2.6, 3.0, x));
      c.throwPhase = x / T;
      o[AR_F] = 1.45 + (x > 1.85 && x < 2.6 ? 0.15 : 0); o[AR_A] = -0.12; o[EL_R] = el;
      o[AL_A] = 0.2; o[EL_L] = 0.3;
      plant(c, o, 0);
      break;
    }
    case 'lean': {
      o[SP_X] = 0.32; o[P_RZ] = -0.1;
      o[LL_F] = 0.08; o[LL_A] = -0.12; o[KN_L] = 0.2; o[LR_A] = 0.05;
      if (c.spec.prop === 'cue') { o[AL_F] = o[AR_F] = 0.5; o[AL_A] = o[AR_A] = -0.28; o[EL_L] = o[EL_R] = 1.0; o[SP_X] = 0.12; }
      else {
        o[AL_F] = 0.55; o[EL_L] = 1.45; o[AR_F] = 0.55; o[EL_R] = 1.45; o[AL_A] = o[AR_A] = 0.1;
        if (c.spec.prop) {
          const x = (pt + k) % 8, sip = sm(5, 5.6, x) * (1 - sm(6.6, 7.2, x));
          o[AR_F] = lerp(0.55, 0.4, sip); o[EL_R] = lerp(1.45, 2.35, sip); o[HD_X] = -0.25 * sip;
        }
      }
      idleUpper(c, o, 0.5);
      plant(c, o, 0);
      break;
    }
    case 'fall': {
      const dir = c.fallDir;
      const down = sm(0, 0.45, pt), up = sm(3.0, 4.2, pt), lie = down * (1 - up);
      o[R_X] = dir * 1.5 * lie; o[P_RY] = 0.12 * lie;
      const fl = Math.sin(Math.PI * clamp(pt / 0.5, 0, 1));
      o[AL_F] = o[AR_F] = 0.3 + 1.8 * fl * (1 - up); o[AL_A] = o[AR_A] = 0.2 + 1.1 * lie;
      o[EL_L] = o[EL_R] = 0.3 + 0.4 * fl;
      const tw = lie * 0.05 * Math.sin(t * 9) * (pt > 1 && pt < 1.6 ? 1 : 0);
      o[HD_Y] = 0.5 * lie + tw; o[HD_X] = -0.2 * lie * dir;
      o[LL_A] = 0.1 + 0.15 * lie; o[LR_A] = 0.1 + 0.1 * lie; o[KN_L] = 0.5 * lie; o[LL_F] = 0.4 * lie;
      const gu = Math.sin(Math.PI * up);
      o[KN_L] += 1.4 * gu; o[KN_R] += 1.4 * gu; o[LL_F] += 1.0 * gu; o[LR_F] += 1.0 * gu; o[SP_X] += 0.6 * gu * -dir;
      const lieY = 0.12 * lie; plant(c, o, 0); o[P_RY] = o[P_RY] * (1 - lie) + lieY;
      break;
    }
    case 'wave': {
      gait(c, o);
      idleUpper(c, o, 0.3);
      o[AR_A] = 2.45; o[AR_F] = 0.25; o[AR_T] = 1.4; o[EL_R] = 0.55 + 0.45 * Math.sin(t * 9);
      o[HD_X] -= 0.08;
      break;
    }
    case 'talk': {
      gait(c, o);
      const n1 = Math.sin(t * 1.3 + k) * 0.6 + Math.sin(t * 2.3 + k * 1.7) * 0.4, n2 = Math.sin(t * 1.1 + k * 2) * 0.6 + Math.sin(t * 2.9) * 0.4;
      o[AR_F] = 0.35 + 0.3 * n1; o[EL_R] = 0.9 + 0.6 * n2; o[AR_A] = 0.15 + 0.1 * n2;
      o[AL_F] = 0.15 + 0.15 * n2; o[EL_L] = 0.5 + 0.3 * n1;
      o[HD_X] += 0.06 * Math.sin(t * 2.5) + 0.04 * n2; o[HD_Y] *= 0.4; o[SP_Y] += 0.08 * n1;
      holdProp(c, o);
      break;
    }
    case 'phone': {
      gait(c, o);
      o[AR_F] = 0.4; o[AR_A] = 0.65; o[EL_R] = 2.5; o[AR_T] = -0.5; o[HD_Z] = 0.12;
      o[AL_F] = 0.15 + 0.15 * Math.sin(t * 0.9); o[EL_L] = 0.6;
      break;
    }
    case 'photo': {
      gait(c, o);
      o[AL_F] = o[AR_F] = 1.25; o[AL_A] = o[AR_A] = -0.28; o[EL_L] = o[EL_R] = 1.75; o[HD_X] = -0.05; o[HD_Y] = 0;
      break;
    }
    // ---- parkour & bystander poses. Action poses read c.act (0..1, driven by the caller, who also moves the
    // group: these poses only shape the body); with c.act < 0 they loop on the pose timer.
    case 'vault': {      // speed vault over a waist-high rail, left hand on it: 0 take-off .3 hand plant .5 over .75 land 1 run out
      const u = act(c, 1.2);
      const ld = sm(0, 0.18, u) * (1 - sm(0.2, 0.32, u)), ov = sm(0.18, 0.35, u) * (1 - sm(0.6, 0.78, u)), la = sm(0.6, 0.75, u) * (1 - sm(0.85, 1, u));
      const run = 1 - sm(0.05, 0.25, u) + sm(0.88, 1, u);
      gait(c, o); walkLegs(c, o);
      for (let i = 0; i < NP; i++) o[i] *= Math.min(1, run);
      o[KN_L] += 0.7 * ld; o[KN_R] += 0.7 * ld; o[LL_F] += 0.5 * ld; o[SP_X] += 0.35 * ld; o[AL_F] += -0.5 * ld; o[AR_F] += -0.5 * ld;
      o[R_Z] = -0.6 * ov; o[SP_Z] = -0.25 * ov; o[HD_Z] = 0.45 * ov;
      o[LL_F] += 1.35 * ov; o[LR_F] += 1.25 * ov; o[KN_L] += 1.3 * ov; o[KN_R] += 1.0 * ov; o[LL_A] -= 0.45 * ov; o[LR_A] += 0.65 * ov;
      o[AL_F] += 0.3 * ov; o[AL_A] -= 0.15 * ov; o[EL_L] += 0.02 * ov;
      o[AR_F] += 0.9 * ov; o[AR_A] += 0.75 * ov; o[EL_R] += 0.45 * ov;
      o[LL_F] += 0.45 * la; o[LR_F] += 0.1 * la; o[KN_L] += 0.5 * la; o[KN_R] += 0.7 * la; o[SP_X] += 0.25 * la; o[AL_F] += 0.7 * la; o[AR_F] += 0.6 * la;
      o[AL_A] += 0.4 * la; o[AR_A] += 0.4 * la;
      const P = o[P_RY]; plant(c, o, 0); o[P_RY] = lerp(o[P_RY], P, ov);
      break;
    }
    case 'precision': {  // standing jump to land on a small target: 0 load .25 take-off .65 land 1 stand
      const u = act(c, 1.6);
      const ld = sm(0, 0.18, u) * (1 - sm(0.2, 0.28, u)), f = sm(0.2, 0.3, u) * (1 - sm(0.58, 0.68, u)), la = sm(0.58, 0.68, u) * (1 - sm(0.82, 1, u));
      o[LL_F] = o[LR_F] = 1.1 * ld + 1.0 * f + 1.45 * la; o[KN_L] = o[KN_R] = 1.6 * ld + 1.5 * f + 2.0 * la;
      o[LL_A] = o[LR_A] = 0.06 + 0.08 * la;
      o[SP_X] = 0.55 * ld + 0.1 * f + 0.6 * la; o[HD_X] = -0.45 * (ld + la) - 0.1 * f;
      o[AL_F] = o[AR_F] = -0.8 * ld + 2.4 * f + 1.15 * la; o[EL_L] = o[EL_R] = 0.15 + 0.3 * la; o[AL_A] = o[AR_A] = 0.12 + 0.1 * f;
      const flex = o[LL_F];
      plant(c, o, 0);
      o[P_RZ] = -(D.L1 * Math.sin(flex) + D.L2 * Math.sin(flex - o[KN_L])) * 0.75 * (1 - f);
      o[P_RY] *= 1 - f;
      break;
    }
    case 'climb': {      // climb-up onto a wall the character faces: 0 kick up .25 hang .5 pull .75 mantle 1 stand on top
      const u = act(c, 2.2);
      const kick = 1 - sm(0.12, 0.25, u), hang = sm(0.1, 0.25, u) * (1 - sm(0.45, 0.6, u)), pull = sm(0.4, 0.55, u) * (1 - sm(0.68, 0.8, u)),
        man = sm(0.62, 0.75, u) * (1 - sm(0.88, 1, u));
      const st = Math.sin(u * 30);
      o[LL_F] = kick * (0.9 + 0.5 * st) + hang * 0.35 + pull * 0.7 + man * 1.85; o[KN_L] = kick * (1.1 + 0.4 * st) + hang * 0.5 + pull * 1.0 + man * 2.25;
      o[LR_F] = kick * (0.9 - 0.5 * st) + hang * 0.3 + pull * 0.5 + man * 0.25; o[KN_R] = kick * (1.1 - 0.4 * st) + hang * 0.45 + pull * 0.9 + man * 0.5;
      o[AL_F] = o[AR_F] = kick * (2.4 + 0.3 * u) + hang * 2.95 + pull * 1.3 + man * -0.1; o[EL_L] = o[EL_R] = kick * 0.3 + hang * 0.1 + pull * 1.9 + man * 0.25;
      o[AL_A] = o[AR_A] = 0.12 + 0.12 * pull + 0.2 * man;
      o[SP_X] = 0.15 * kick + 0.05 * hang + 0.3 * pull + 0.55 * man; o[HD_X] = -0.35 * (hang + kick) - 0.1 * pull;
      o[P_RZ] = -0.12 * (hang + pull);
      break;
    }
    case 'hang': {       // hanging from a ledge at arm's length (hands ~ dims.top + 0.5*s above the feet origin)
      const sw = Math.sin(t * 2.2 + k);
      o[AL_F] = o[AR_F] = 2.98; o[EL_L] = o[EL_R] = 0.08 + 0.05 * sw; o[AL_A] = o[AR_A] = 0.18;
      o[LL_F] = 0.25 + 0.1 * sw; o[LR_F] = 0.15 - 0.1 * sw; o[KN_L] = 0.45; o[KN_R] = 0.35; o[HD_X] = -0.3; o[SP_X] = 0.04 * sw;
      o[P_RZ] = -0.1;
      break;
    }
    case 'scoot': {      // a kick scooter: leaning to the bar, the left foot on the deck, the right pushing every stroke
      const u = (t * 0.75 + k) % 1, push = u < 0.45 ? Math.sin((u / 0.45) * Math.PI) : 0;
      o[SP_X] = 0.16; o[HD_X] = -0.1; o[AL_F] = o[AR_F] = 0.7; o[EL_L] = o[EL_R] = 0.3; o[AL_A] = o[AR_A] = 0.12;
      o[LL_F] = 0.14; o[KN_L] = 0.22 + 0.1 * push; o[LR_F] = 0.1 - 0.55 * push; o[KN_R] = 0.12 + 0.45 * push * (u > 0.25 ? 1 : 0.4); o[LR_A] = 0.06;
      break;
    }
    case 'balance': {    // walking along a wall top: arms out, careful steps, small corrections
      gait(c, o);
      const w = Math.sin(t * 1.9 + k) * 0.6 + Math.sin(t * 3.7) * 0.4;
      o[AL_A] = 1.35 + 0.25 * w; o[AR_A] = 1.35 - 0.25 * w; o[AL_F] = o[AR_F] = 0.15; o[EL_L] = o[EL_R] = 0.25;
      o[R_Z] += 0.05 * w; o[SP_Z] -= 0.08 * w; o[HD_X] += 0.3;
      break;
    }
    case 'roll': {       // parkour forward roll: 0 reach .15 tuck & roll over the shoulder .75 come up 1 run
      const u = act(c, 1.1);
      const tk = sm(0, 0.15, u) * (1 - sm(0.72, 0.9, u)), th = TAU * sm(0.12, 0.75, u);
      o[LL_F] = o[LR_F] = 2.1 * tk; o[KN_L] = o[KN_R] = 2.35 * tk; o[LL_A] = o[LR_A] = 0.1;
      o[SP_X] = 0.85 * tk; o[HD_X] = 0.6 * tk; o[SP_Z] = 0.2 * Math.sin(th);
      o[AL_F] = o[AR_F] = 1.0 * tk; o[EL_L] = o[EL_R] = 1.7 * tk; o[AL_A] = o[AR_A] = 0.25 * tk;
      plant(c, o, 0);
      // roll the tucked body about the centre of the ball (radius rb, centre rig-local (cy, cz)) so it stays on the ground
      const rb = 0.42 * D.s, cy = rb - o[P_RY], cz = 0.12 * D.s, cs = Math.cos(th), sn = Math.sin(th);
      o[R_X] = th % TAU; o[P_RY] = rb - (cy * cs - cz * sn); o[P_RZ] = cz - (cy * sn + cz * cs);
      break;
    }
    case 'swim': case 'dive': {   // in the river (core/_swim_pose.js): group origin = the water line / the body's centre
      if (NP === SWIM_NP) swimPose(c, name, o); else gait(c, o);
      c._lk = 0;
      break;
    }
    case 'tumble': case 'tumblef': case 'knocked': case 'knockedf': case 'stumble': {   // knock-downs (core/_tumble_pose.js)
      if (NP === TUMBLE_NP) tumblePose(c, name, o, pt, c._sub || (c._sub = (n, out, p) => { const s = c.pt; c.pt = p; computePose(c, n, out); c.pt = s; }), plant);
      else gait(c, o);
      c._lk = 0;
      break;
    }
    case 'clap': {
      gait(c, o);
      const cl = Math.abs(Math.sin(t * 13));
      o[AL_F] = o[AR_F] = 0.95; o[EL_L] = o[EL_R] = 1.35; o[AL_A] = o[AR_A] = -0.12 + 0.2 * cl; o[HD_X] -= 0.05;
      break;
    }
    case 'brushoff': {   // dusting yourself down after a tumble
      gait(c, o); walkLegs(c, o);
      const a = Math.sin(t * 9), u2 = (pt % 3) / 3, low = 1 - sm(0.55, 0.7, u2);
      o[SP_X] = 0.45 * low + 0.05; o[HD_X] = 0.35 * low;
      o[AL_F] = 0.35 * low + 0.7 * (1 - low) + 0.2 * a * low; o[AR_F] = 0.35 * low + 0.7 * (1 - low) - 0.2 * a * low;
      o[EL_L] = 0.3 * low + 1.3 * (1 - low); o[EL_R] = 0.3 * low + 1.3 * (1 - low) + 0.3 * Math.max(0, -a) * (1 - low);
      o[AL_A] = o[AR_A] = -0.1 + 0.25 * (1 - low);
      o[KN_L] = o[KN_R] = 0.3 * low; o[LL_F] = o[LR_F] = 0.15 * low; plant(c, o, 0);
      break;
    }
    default: {   // 'stand' and anything unknown: idle / walk / run
      gait(c, o);
      holdProp(c, o);
      // an open umbrella (systems/umbrellas.js draws it; c.brolly +1 = in the right hand, -1 = the left): the hand is
      // held up in front of that shoulder, the grip at chest height, and does not swing; the other arm swings less
      if (c.brolly) {
        const lean = 0.5 * (o[SP_Y] + o[PV_Y]);         // (the shoulders turn with the stride: the grip stays put over the walk)
        if (c.brolly > 0) { o[AR_F] = -0.25 - lean; o[EL_R] = 2.04; o[AR_A] = 0.1; o[AR_T] = 0; o[AL_F] *= 0.6; }
        else { o[AL_F] = -0.25 + lean; o[EL_L] = 2.04; o[AL_A] = 0.1; o[AL_T] = 0; o[AR_F] *= 0.6; }
        o[SP_Y] *= 0.6; o[HD_Y] *= 0.6;
      }
      if (c.punchT >= 0) punchArms(c, o);      // (a punch thrown over the walk: systems/punch.js)
    }
  }
  // the walking legs (core/_gait.js): planted feet, solved for the rig and pelvis this pose ended up with
  if (c._lk === 1) { gaitTargets(c, c._live === true); gaitSolve(c, o, name === 'balance' ? 0.012 : 0); }
  if (FLAT_POSES[name] === 1) { flatFeet(o, 1); if (c._pl === c._pl) plant(c, o, c._pl); }      // (re-planted now the feet are flat)
  else if (name === 'precision') flatFeet(o, 1 - sm(0.2, 0.3, act(c, 1.6)) * (1 - sm(0.58, 0.68, act(c, 1.6))));
  if (c._turn) o[HD_Y] += c._turn;
}
const FLAT_POSES = { sit: 1, write: 1, drive: 1, cycle: 1, punt: 1, dance: 1, crouch: 1, throw: 1, lean: 1, brushoff: 1 };

/** A punch over the arms of the walking / standing poses (character.punch(side), systems/punch.js): a guard, the fist
 *  drawn back (0-0.11 s), thrown straight out at shoulder height with the shoulders turning into it (0.11-0.17 s),
 *  pulled back (to 0.38 s) and the arms handed back to the walk by PUNCH_DUR. side +1 the right hand, -1 the left. The
 *  legs are the walk's own, so it can be thrown on the move. */
export const PUNCH_DUR = 0.46;
function punchArms(c, o) {
  const t = c.punchT, s = c.punchS;
  const env = sm(0, 0.07, t) * (1 - sm(0.3, PUNCH_DUR, t));
  const wind = sm(0, 0.11, t) * (1 - sm(0.11, 0.17, t)), hit = sm(0.11, 0.17, t) * (1 - sm(0.24, 0.38, t));
  const F = 0.6 - 0.75 * wind + 0.95 * hit, E = 2.1 + 0.2 * wind - 2.0 * hit, A = 0.1 + 0.12 * wind - 0.2 * hit;     // striking arm: guard -> drawn back -> out
  const sF = s > 0 ? AR_F : AL_F, sE = s > 0 ? EL_R : EL_L, sA = s > 0 ? AR_A : AL_A, sT = s > 0 ? AR_T : AL_T;
  const gF = s > 0 ? AL_F : AR_F, gE = s > 0 ? EL_L : EL_R, gA = s > 0 ? AL_A : AR_A;
  o[sF] = lerp(o[sF], F, env); o[sE] = lerp(o[sE], E, env); o[sA] = lerp(o[sA], A, env); o[sT] = lerp(o[sT], 0, env);
  o[gF] = lerp(o[gF], 0.7, env); o[gE] = lerp(o[gE], 2.05, env); o[gA] = lerp(o[gA], 0.12, env);      // the other fist up by the chin
  const tw = (-0.25 * wind + 0.45 * hit) * s * env;      // (+SP_Y brings the right shoulder forward)
  o[SP_Y] += tw; o[HD_Y] -= tw * 0.8; o[PV_Y] += tw * 0.25; o[SP_X] += 0.1 * hit * env;
}

/** knee bend for 'sit' when the leg (with heels) is longer than the seat height: shins angled forward, heels resting on the floor; 0 = not needed */
function sitKneeFor(D) {
  const F = 1.52, kneeY = D.seat - D.L1 * Math.cos(F), yl = -(D.L2 + D.ankle), zl = D.heelH > 0.005 ? -0.035 : -0.06;   // heel tip: lowest once the shin leans forward
  if (kneeY + yl + 0.005 >= 0) return 0;          // fits: keep the standard 90-degree knees
  let lo = 0, hi = 1.2;
  for (let i = 0; i < 24; i++) { const th = (lo + hi) / 2; if (kneeY + yl * Math.cos(th) + zl * Math.sin(th) < 0.004) lo = th; else hi = th; }
  return F - (lo + hi) / 2;
}

function act(c, T) { return c.act >= 0 ? clamp(c.act, 0, 1) : (c.pt % T) / T; }

function ik(L1, L2, dz, dy, c) {
  let d = Math.hypot(dz, dy);
  d = clamp(d, Math.abs(L1 - L2) + 0.02, (L1 + L2) * 0.999);
  const a = Math.atan2(dz, -dy);
  const alpha = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  c._ikF = a + alpha;
  c._ikK = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
}

// ------------------------------------------------------------------------------------------------ text sprites
function makeCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function textSprite(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true, fog: false });      // (depth-tested: no name tags through walls)
  const sp = new THREE.Sprite(mat);
  sp.renderOrder = 999; sp.center.set(0.5, 0); sp.frustumCulled = false;
  return sp;
}

// ------------------------------------------------------------------------------------------------ distance LOD
// Beyond LOD_FAR from the camera a character is drawn as ONE merged mesh of its own segments ("impostor") baked in
// the current pose (two stride frames while walking), cached per look + pose + frame and shared between characters
// with the same look. 11-12 draw calls -> 1, no per-frame pose maths. Back to the articulated rig inside LOD_NEAR.
// Segment meshes are hidden through layers (not .visible) so props attached to the hands by modules stay visible.
export const LOD_FAR = 36, LOD_NEAR = 31;
export const characterLod = { enabled: true, detail: 'auto' };   // enabled false: always articulated (perf comparisons); detail 'hi' | 'lo' pins the near tier (tests, showcases)
// Detail tiers of the articulated mesh. Everyone normally gets the lean build (no more triangles than the old blocky
// figures). Only when the rich tier is allowed (see richAllowed) does a character within HI_NEAR of the camera (back
// out beyond HI_FAR) swap to a richer build of the same segments (rounder limbs, modelled hands, eyes, hair).
export const HI_NEAR = 8, HI_FAR = 10;
/** game.quality.dist (1 … 0.5, the adaptive governor's detail-distance scalar): the impostor and shadow distances follow it */
const LOD_FLOOR = 18;      // …but a character never becomes an impostor closer than this
function lodScale() {
  const g = typeof window !== 'undefined' ? window.game : null, q = g && g.quality, d = q ? q.dist : 1;
  return d > 0 && d < 1 ? (d < 0.5 ? 0.5 : d) : 1;
}
/** how far the articulated figure is kept before the one-mesh stand-in, by graphics tier: LOD_FAR as it was on low and
 *  medium; further on high (45 m) and ultra (61 m) — the 36 m had been set to hold 60 fps on the 2016 laptop */
function lodTier() {
  const g = typeof window !== 'undefined' ? window.game : null, l = g && g.quality && g.quality.level;
  return l === 'ultra' ? 1.7 : l === 'high' ? 1.25 : 1;
}
/** the rich near tier: on the 'high' and 'ultra' graphics tiers (it had been 'ultra' only, to hold 60 fps on the 2016
 *  laptop — no longer the target), or with game.quality.tier.richCharacters */
function richAllowed() {
  const g = typeof window !== 'undefined' ? window.game : null, q = g && g.quality;
  return !!q && (q.level === 'ultra' || q.level === 'high' || !!(q.tier && q.tier.richCharacters));
}
const KIND = { pelvis: 'pelvis', torso: 'torso', head: 'head', armL: 'arm', armR: 'arm', foreL: 'fore', foreR: 'fore', thighL: 'thigh', thighR: 'thigh', shinL: 'shin', shinR: 'shin', skirt: 'skirt', footL: 'shin', footR: 'shin' };
function buildSeg(name, fn, params, D, hi) {
  const kind = KIND[name] || '';
  CTX.hi = hi; CTX.kind = kind; CTX.s = D.s; CTX.fig = params.fig || 'm';
  CTX.L = kind === 'arm' ? D.UA : kind === 'fore' ? D.FA : kind === 'thigh' ? D.L1 : kind === 'shin' ? D.L2 : 1;
  CTX.part = name === 'footL' || name === 'footR' ? 'foot' : kind === 'shin' ? 'leg' : '';
  try { return fn(params); } finally { CTX.kind = ''; CTX.hi = false; CTX.part = ''; }
}
const HIDE_LAYER = 30;
const SEG_IDS = new Map();      // full segment-key string -> small id (keeps impostor cache keys short)
const _inv = new THREE.Matrix4(), _mm = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _bv = new THREE.Vector3();
let _bakeWin = -1, _bakeN = 0;
function bakeBudget() {          // at most 4 bakes per frame (or per 10 ms without a game): spawn bursts never make a long frame
  const g = typeof window !== 'undefined' ? window.game : null;
  const t = g && Number.isFinite(g.frame) ? g.frame : Math.floor(performance.now() / 10);
  if (t !== _bakeWin) { _bakeWin = t; _bakeN = 0; }
  return _bakeN++ < 4;
}
/** impostor bake: the skinned geometry posed on the CPU (same blend as the shader), in the character group's space */
const _bm = [];
// RIG_PRUNE (main-thread pass, 2026-11-23). A character is ONE drawn thing (its skinned mesh) and some twenty bones,
// and three walks every visible object of the scene twice a frame to fill its draw lists (the picture's, the sun
// shadow's): with a street's people that was a thousand objects looked at and passed over, twice, every frame. While
// nothing but bones hangs under the rig it is hidden (`rig.visible = false`) - three then never enters it - and
// `rig._gtoMx = 1` keeps its matrices up all the same (core/_fastmatrix.js: the skeleton needs them). The moment
// anything is added anywhere under the rig (a pint in a hand, a hat: `anchors.handR.add(mesh)`, `head.add(...)`) the
// rig is shown again, and when the last such thing is removed it is hidden again: every bone's add / remove says so.
// `?rigprune=0`: off.
let RIG_PRUNE = true;
try { if (typeof location !== 'undefined' && /[?&]rigprune=0(&|$)/.test(location.search)) RIG_PRUNE = false; } catch (e) { /* no location */ }
const _O3add = THREE.Object3D.prototype.add, _O3remove = THREE.Object3D.prototype.remove;
const _rigStack = [];
function rigAdd(...a) { _O3add.apply(this, a); const c = this._rigCh; if (c) c.rig.visible = true; return this; }
function rigRemove(...a) { _O3remove.apply(this, a); const c = this._rigCh; if (c) c._rigSync(); return this; }

function bakeMerged(group, skin, g) {
  group.updateMatrixWorld(true);
  _inv.copy(group.matrixWorld).invert();
  const sk = skin.skeleton, nb = sk.bones.length;
  while (_bm.length < nb) _bm.push(new THREE.Matrix4());
  for (let b = 0; b < nb; b++) _bm[b].multiplyMatrices(_inv, sk.bones[b].matrixWorld).multiply(sk.boneInverses[b]);
  const pa = g.attributes.position.array, na = g.attributes.normal.array, SI = g.attributes.skinIndex.array, SW = g.attributes.skinWeight.array, nv = pa.length / 3;
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3);
  for (let k = 0; k < nv; k++) {
    const x = pa[k * 3], y = pa[k * 3 + 1], z = pa[k * 3 + 2], nx = na[k * 3], ny = na[k * 3 + 1], nz = na[k * 3 + 2];
    let ox = 0, oy = 0, oz = 0, mx = 0, my = 0, mz = 0;
    for (let j = 0; j < 2; j++) {
      const w = SW[k * 4 + j]; if (!w) continue;
      const e = _bm[SI[k * 4 + j]].elements;
      ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      mx += w * (e[0] * nx + e[4] * ny + e[8] * nz); my += w * (e[1] * nx + e[5] * ny + e[9] * nz); mz += w * (e[2] * nx + e[6] * ny + e[10] * nz);
    }
    const l = Math.hypot(mx, my, mz) || 1;
    P[k * 3] = ox; P[k * 3 + 1] = oy; P[k * 3 + 2] = oz; N[k * 3] = mx / l; N[k * 3 + 1] = my / l; N[k * 3 + 2] = mz / l;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(g.attributes.color.array, 3));     // (typed arrays shared with the skin, separate GL buffers)
  geo.setIndex(new THREE.BufferAttribute(g.index.array, 1));
  geo.computeBoundingSphere();
  return geo;
}

// One SkinnedMesh per character: the segment geometries concatenated in the rest pose (every joint at zero rotation, so
// a segment's frame is a pure translation of the rig's), with the segment meshes themselves as the skeleton's bones
// (bone inverse = minus the segment's rest origin, so a vertex bound 100 % to its segment lands at
// segment.matrixWorld × local position, as before). Vertices tagged SOFT (limb tubes, neck) are blended across the
// elbow / knee / neck with the neighbouring segment; LID / JAW / FOOT vertices go to the small extra bones (blink,
// talking mouth, ankle). The segment meshes stay in the hierarchy (poses, anchors, props attached by modules) but sit
// on HIDE_LAYER, so a character costs one draw call (+ one shadow). Shared per look through the geometry cache.
// SEG order: pelvis torso head armL armR foreL foreR thighL thighR shinL shinR [skirt] footL footR; the lid and jaw bones follow.
const TOE_OUT = 0.11, TOE_COS = Math.cos(TOE_OUT), TOE_SIN = Math.sin(TOE_OUT), FOOT_CURVE = 0.011;      // each foot turned out ~6 degrees; the toe drawn 11 mm in
const SOFT_REL = [null, null, [1, 'neck'], [5, 'far'], [6, 'far'], [3, 'near'], [4, 'near'], [9, 'far'], [10, 'far'], [7, 'near'], [8, 'near']];
function mergeSkin(geos, origins, D, nSeg) {
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3);
  const SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4);
  const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const s = D.s, hE = 0.04 * s, hK = 0.055 * s;
  let vo = 0, io = 0;
  geos.forEach((g, b) => {
    const cnt = g.attributes.position.count, ia = g.index.array, pa = g.attributes.position.array, tg = g.attributes.tag ? g.attributes.tag.array : null;
    const O = origins[b], rel = SOFT_REL[b] || null, leg = b >= 7 && b <= 10, hj = leg ? hK : hE, Lseg = b === 3 || b === 4 ? D.UA : D.L1;
    N.set(g.attributes.normal.array, vo * 3); C.set(g.attributes.color.array, vo * 3);
    // the feet (the last two segments: left, right) are built once, straight and symmetric: each is turned out about its
    // ankle and its forepart curved in towards the big toe, like a shoe's last
    const ft = b === nSeg - 2 ? 1 : b === nSeg - 1 ? -1 : 0;
    for (let k = 0; k < cnt; k++) {
      const v = vo + k, y = pa[k * 3 + 1], t = tg ? tg[k] : 0;
      if (ft) {
        const x0 = pa[k * 3], z0 = pa[k * 3 + 2], u = clamp(z0 / (0.2 * s), 0, 1), x = x0 - ft * FOOT_CURVE * s * u * u, n0 = N[v * 3], n2 = N[v * 3 + 2];
        P[v * 3] = x * TOE_COS + z0 * TOE_SIN * ft + O.x; P[v * 3 + 1] = y + O.y; P[v * 3 + 2] = z0 * TOE_COS - x * TOE_SIN * ft + O.z;
        N[v * 3] = n0 * TOE_COS + n2 * TOE_SIN * ft; N[v * 3 + 2] = n2 * TOE_COS - n0 * TOE_SIN * ft;
      } else { P[v * 3] = pa[k * 3] + O.x; P[v * 3 + 1] = y + O.y; P[v * 3 + 2] = pa[k * 3 + 2] + O.z; }
      let b0 = b, b1 = 0, w1 = 0;
      if (t === T_SOFT && rel) {
        b1 = rel[0];
        if (rel[1] === 'far') w1 = sm(-Lseg + hj, -Lseg - hj, y);          // towards the child across the far joint
        else if (rel[1] === 'near') w1 = sm(-hj, hj, y);                   // towards the parent across the near joint
        else w1 = sm(0.055 * s, -0.012 * s, y);                            // neck: the base stays with the torso
      } else if (t === T_LID) b0 = nSeg;
      else if (t === T_JAW) b0 = nSeg + 1;
      SI[v * 4] = b0; SW[v * 4] = 1 - w1; SI[v * 4 + 1] = b1; SW[v * 4 + 1] = w1;
    }
    for (let k = 0; k < ia.length; k++) I[io + k] = ia[k] + vo;
    vo += cnt; io += ia.length;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  geo.setIndex(new THREE.BufferAttribute(I, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.7);
  return geo;
}
// face rig: the lid bone scales the (closed) eyelids up to a thin line; the jaw bone drops the lower lip and chin
const LID_OPEN = 0.14, JAW_DROP = 0.011;
function facePivots(D, fig) { return B.facePivots(D.headR, D.headC, fig); }
const SHADOW_NEAR = 20;          // characters further than this from the camera don't cast shadows
const _ident = new THREE.Matrix4();

// ------------------------------------------------------------------------------------------------ Character
const LABEL_FAR = 22, BUBBLE_FAR = 30, TAG_CAP = 2.6, TAG_FADE0 = 0.75, TAG_FADE1 = 1.5;      // inside TAG_CAP m tags stop growing on screen; they fade out between TAG_FADE1 and TAG_FADE0

class Character {
  constructor(look) {
    this.look = look;
    const R = (this.spec = resolve(look));
    const D = (this.dims = makeDims(R));
    this.group = new THREE.Group(); this.group.name = 'character';
    this.rig = new THREE.Group(); this.rig.rotation.order = 'YXZ'; this.group.add(this.rig);
    this._keys = [];
    const q = (x) => Math.round(x * 1000) / 1000;
    const s = q(D.s), b = q(D.b);
    const sleeveCol = R.jacket ?? (R.hivis !== null && R.topStyle === 'jacket' ? R.hivis : R.top);
    const jit = R.tweed || R.checks ? 0.2 : 0;
    const legCol = R.lycra ?? R.bottom;
    const variant = (R.seed >>> 0) || (hashSeed(JSON.stringify(look || {})) % 100000);
    // who this person sounds like (core/voice.js crowdSpeaker): same look → same voice on every client
    this.voiceHint = { fig: R.figure, older: GREYS.includes(R.hair) || R.hairStyle === 'grey-wild' || R.hairStyle === 'bald', seed: variant };
    this._defs = {};
    const mk = (name, fn, params) => {
      const key = name + JSON.stringify(params);
      const m = new THREE.Mesh(acquire(key, () => buildSeg(name, fn, params, D, false)), characterMaterial);
      this._keys.push(key); m.name = name; this._defs[name] = [fn, params];
      return m;
    };
    const fig = R.figure, fv = variant % 5;
    const torsoP = { s, b, fig, skin: R.skin, top: R.top, topStyle: R.topStyle, sleeves: R.sleeves, jacket: R.jacket, tweed: R.tweed, checks: R.checks && !R.chefJacket, pattern: !!R.pattern,
      shirt: R.shirt, neck: R.neck, neckColor: R.neckColor, hivis: R.hivis, hivisJacket: R.topStyle === 'jacket' && R.hivis !== null, chequer: R.chequer,
      stripes: R.stripes, apron: R.apron, chefJacket: R.chefJacket, badge: R.badge, scarf: R.scarf, gown: R.gown, backpack: R.backpack, camera: !!R.camera,
      carnation: R.carnation, dressTop: !!R.dress, collar: R.collar ?? undefined, tartan: R.tartan ?? undefined };
    const longCoat = R.jacket !== null && R.jacketLen === 'long';
    const tucked = R.jacket !== null || R.neck === 'tie' || R.outfit === 'police' || R.outfit === 'smart' || R.chefJacket || R.lycra !== null || !!R.dress;
    if (!R.club) this.pelvis = mk('pelvis', buildPelvis, { s, b, fig, bottom: R.bottom, lycra: R.lycra, skirt: R.skirt, skirtColor: R.skirtColor, jacket: R.jacket,
      jacketLen: longCoat ? 'waist' : R.jacketLen, apron: R.apron, chef: R.chefJacket, checks: R.checks, denim: isDenim(R.bottom) || undefined, rib: R.topStyle === 'jumper' || R.topStyle === 'hoodie' || undefined, hem: tucked ? null : R.hivis !== null && R.topStyle !== 'jacket' ? R.top : (R.hivis !== null ? R.hivis : R.top), crop: R.topStyle === 'crop' });
    if (!R.club) this.torso = mk('torso', buildTorso, torsoP);
    const C = R.club, cc = C ? C.c : null;
    this.head = mk('head', buildHead, { s, b, fig, fv, cover: !(R.hairStyle === 'bald' || R.hairStyle === 'grey-wild' || R.hairStyle === 'buzz') && R.hat !== 'hood', skin: R.skin, hair: R.hair, hairStyle: R.hairStyle, hairCut: R.hairCut ?? undefined, beard: R.beard, glasses: R.glasses === 'rimless' ? 'rimless' : !!R.glasses,
      gc: R.glassesColor ?? undefined, hat: R.hat,
      hatColor: R.hatColor, outfit: R.outfit, headR: q(D.headR), headC: q(D.headC), brow: q(((variant % 7) - 3) * 0.05),
      smile: R.smile ?? undefined, faceW: R.faceW ?? undefined,
      ...(C ? { lip: cc.lip ?? undefined, smudge: C.smudge || undefined, paint: C.paint ? cc.trim : undefined, paint2: C.paint ? cc.alt : undefined,
        hoops: C.hoops || undefined, messy: C.messy || undefined, ears: C.dress === 'onesie' ? C.animal : undefined, seed: C.messy ? variant % 97 : undefined } : {}) });
    const armP = (side) => ({ s, b, fig, side, skin: R.skin, sleeves: R.sleeves, sleeveCol, jit, UA: q(D.UA), stripes: R.stripes ? R.stripes[0] : null, gown: R.gown });
    const foreP = (side, prop) => ({ s, b, fig, side, skin: R.skin, sleeves: R.sleeves, sleeveCol, jit, FA: q(D.FA), cuff: R.jacket !== null ? R.shirt : null,
      patches: R.patches, stripes: R.stripes ? R.stripes[0] : null, prop, seed: variant % 12 });
    const legP = { s, b, fig, tone: R.legs === 'trousers' && !R.lycra ? (isDenim(legCol) ? 2 : 1) : 0, skin: R.skin, legs: R.legs, legCol, tights: R.tights, lycra: R.lycra !== null, jit, L1: q(D.L1), L2: q(D.L2), ankle: q(D.ankle), shoes: R.shoes, shoeStyle: R.shoeStyle };
    this.skirt = null;
    if (R.club) this._buildClub(R, D, mk, s, b, q, variant);
    else {
      this.armL = mk('armL', buildUpperArm, armP(1)); this.armR = mk('armR', buildUpperArm, armP(-1));
      this.foreL = mk('foreL', buildForeArm, foreP(1, null)); this.foreR = mk('foreR', buildForeArm, foreP(-1, R.prop));
      this.thighL = mk('thighL', buildThigh, legP); this.thighR = mk('thighR', buildThigh, legP);
      this.shinL = mk('shinL', buildShin, legP); this.shinR = mk('shinR', buildShin, legP);
      // skirts and long coats are their own segment: they swing with the thighs instead of being cut by them
      if (R.skirt || longCoat) {
        const coat = longCoat && !(R.skirt === 'long');
        const sp = coat ? { s, b, fig, kind: 'coat', hem: 0.6, flare: 0.25, col: R.jacket, alt: R.jacket, pattern: null }
          : { s, b, fig, kind: R.skirt === 'mini' ? 'bodycon' : R.skirt === 'long' ? 'maxi' : 'skater', hem: R.skirt === 'mini' ? 0.27 : R.skirt === 'long' ? 0.8 : 0.47, flare: R.skirt === 'mini' ? 0.1 : R.skirt === 'long' ? 0.3 : 0.45, col: R.skirtColor, alt: R.skirtColor, pattern: null };
        this._mkSkirt(mk, sp, D);
      }
    }
    // hierarchy
    this.pelvis.position.y = D.hipY; this.rig.add(this.pelvis);
    if (this.skirt) { this.pelvis.add(this.skirt); this.skirt.castShadow = true; }
    this.torso.position.y = D.waist; this.pelvis.add(this.torso);
    this.head.position.y = D.torsoH + D.neckOff; this.torso.add(this.head);
    this.armL.position.set(D.shX, D.shY, 0); this.armR.position.set(-D.shX, D.shY, 0); this.torso.add(this.armL, this.armR);
    this.foreL.position.y = -D.UA; this.foreR.position.y = -D.UA; this.armL.add(this.foreL); this.armR.add(this.foreR);
    this.foreL.rotation.order = this.foreR.rotation.order = 'YXZ';
    this.thighL.position.set(D.hipX, 0, 0); this.thighR.position.set(-D.hipX, 0, 0); this.pelvis.add(this.thighL, this.thighR);
    this.shinL.position.y = -D.L1; this.shinR.position.y = -D.L1; this.thighL.add(this.shinL); this.thighR.add(this.shinR);
    for (const m of [this.pelvis, this.torso, this.head, this.shinL, this.shinR]) m.castShadow = true;
    this._segs = [this.pelvis, this.torso, this.head, this.armL, this.armR, this.foreL, this.foreR, this.thighL, this.thighR, this.shinL, this.shinR];
    if (this.skirt) this._segs.push(this.skirt);
    // the feet: the shoe half of each shin builder's output, on the ankle
    this.footL = this._footL = mk('footL', this._defs.shinL[0], this._defs.shinL[1]); this.footR = this._footR = mk('footR', this._defs.shinR[0], this._defs.shinR[1]);
    this.footL.position.y = -D.L2; this.footR.position.y = -D.L2; this.shinL.add(this.footL); this.shinR.add(this.footR);
    this._segs.push(this.footL, this.footR);
    this._segKey = this._keys.join('|');
    {
      // small extra bones: eyelids + jaw (children of the head)
      const lid = (this._lid = new THREE.Object3D()), jaw = (this._jaw = new THREE.Object3D());
      const FP = facePivots(D, R.figure);
      lid.position.set(0, FP.lidY, 0); jaw.position.set(0, FP.jawY, FP.jawZ); this._jawY = FP.jawY; this.head.add(lid, jaw);
      lid.scale.y = LID_OPEN;
      const bones = this._segs.concat([lid, jaw]);
      this._origins = bones.map((o) => { const v = new THREE.Vector3(); for (let n = o; n && n !== this.rig; n = n.parent) v.add(n.position); return v; });
      this._hi = false;
      const geo = (this._geoLo = this._skinGeo(false));
      const sk = (this._skin = new THREE.SkinnedMesh(geo, characterMaterial));
      sk.name = 'skin'; sk.frustumCulled = true; sk.castShadow = true;
      sk.bind(new THREE.Skeleton(bones, this._origins.map((v) => new THREE.Matrix4().makeTranslation(-v.x, -v.y, -v.z))), _ident);
      sk.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.7);
      this.group.add(sk);
      for (const m of this._segs) { m.layers.set(HIDE_LAYER); m.castShadow = false; }
      this._shadow = true;
    }
    this._fadeL = FADE_STEPS; this.lod = 0; this.noLod = false; this._imp = null; this._impKey = null; this._impKeys = new Set(); this._impPose = '';
    // anchors for attaching things
    const handL = new THREE.Object3D(), handR = new THREE.Object3D(), headTop = new THREE.Object3D();
    handL.position.y = -D.FA - 0.06; handR.position.y = -D.FA - 0.06; headTop.position.y = D.headC + D.headR;
    this.foreL.add(handL); this.foreR.add(handR); this.head.add(headTop);
    this.anchors = { handL, handR, headTop };
    this._rigInit();      // (the bones leave the draw lists while nothing drawn hangs on them: RIG_PRUNE above)
    this.bones = { rig: this.rig, pelvis: this.pelvis, torso: this.torso, head: this.head, armL: this.armL, foreL: this.foreL, armR: this.armR,
      foreR: this.foreR, thighL: this.thighL, shinL: this.shinL, thighR: this.thighR, shinR: this.shinR };
    // animation state
    this.pose = 'stand'; this.basePose = 'stand'; this.poseDur = 0; this.fallDir = -1;
    this.t = 0; this.pt = 0; this.speed = 0; this.phase = 0; this.crank = 0; this.steer = 0;
    this.k = (variant % 997) * 0.731; this.variant = variant;
    this.phoneUp = 0; this.puntPhase = 0; this.throwPhase = 0; this.leftHand = null; this.reach = 0; this.reachUp = 0; this.pushing = false;
    this.partnerSide = 1;   // 'holding-hands' / 'arm-in-arm': partner on the character's left (+1) or right (-1)
    this._sitKnee = R.club ? sitKneeFor(D) : 0;     // clubbing looks: heels (and long legs) sit with shins angled forward
    this.act = -1;    // 0..1 progress of a one-shot action pose (vault/precision/climb/roll), set by the caller; < 0 = loop on a timer
    this._turn = 0; this._turnT = 0; this._ikF = 0; this._ikK = 0;
    this._g = null; this._lk = 0; this._fromLk = 0; this._live = false; this._fx = new Float32Array(4);      // walking legs (core/_gait.js)
    this.skid = false;      // set by the caller while the figure slides on purpose (a sprint stopped short): the feet go with the body
    this.brolly = 0;        // +1 / -1 while an open umbrella is held up in the right / left hand (systems/umbrellas.js)
    this.punchT = -1; this.punchS = 1;      // a punch being thrown (punch(side)): seconds into it, < 0 none; +1 right hand / -1 left
    this.mouth = 0;     // 0..1 extra mouth opening set by the caller (chewing, singing); talking opens it by itself
    this.eyes = 1;      // 1 open … 0 shut (the caller can hold them shut; blinking is automatic)
    this.lookAtPlayer = true;   // while a speech bubble is up and no headTurn() is set, glance at the player if they are near
    this._look = 0; this._jawM = 0;
    this.cur = new Float32Array(NP); this.from = new Float32Array(NP); this.tgt = new Float32Array(NP); this.blend = 1;
    this.label = null; this._labelCanvas = null; this.bubble = null; this._bubbleCanvas = null; this._bubbleT = 0; this._labelText = null;
    computePose(this, 'stand', this.cur); this._apply(this.cur);
  }

  /** Change pose. opts: {duration} auto-revert after secs; {forward:true} for 'fall' = fall on the face. */
  setPose(name, opts) {
    name = name || 'stand';
    if (name === this.pose && !opts && name !== 'fall') return;
    const kd = TUMBLE[name] ? TUMBLE[name].dur : name === 'stumble' ? STUMBLE_DUR : 0;      // knock-downs: one-shot timelines
    const transient = name === 'fall' || kd > 0 || (opts && opts.duration);
    if (!this.poseDur) this.basePose = this.pose === 'fall' || TUMBLE[this.pose] || this.pose === 'stumble' ? 'stand' : this.pose;
    if (!transient) this.basePose = name;
    this.from.set(this.cur); this.blend = 0; this.pt = 0; this._fromLk = this._lk;
    this.pose = name; this.group.userData.pose = name;
    this.poseDur = opts && opts.duration ? opts.duration : name === 'fall' ? 4.4 : kd;
    if (name === 'fall') this.fallDir = opts && opts.forward ? 1 : -1;
    if (opts && opts.side !== undefined) this.partnerSide = opts.side === 'right' || opts.side === -1 ? -1 : 1;
  }

  /** True while knocked over (lying or getting up). */
  get isDown() { return this.pose === 'fall' || (TUMBLE[this.pose] !== undefined && this.poseDur > 0); }
  /** knocked down and not yet back on their feet (the brush-off and the fist come after) */
  get onGround() { return this.pose === 'fall' ? this.pt < 4.0 : tumbleDown(this.pose, this.pt); }

  /** Carried by what the figure stands on (a deck, a car roof), from (ox, oz) to (nx, nz) and turned dh: the planted feet go too. */
  carried(ox, oz, nx, nz, dh) { gaitCarry(this, ox, oz, nx, nz, dh || 0); }

  /** Throw a punch with the right (side > 0) or left hand over the standing / walking poses (PUNCH_DUR s; systems/punch.js). */
  punch(side = 1) { this.punchT = 0; this.punchS = side < 0 ? -1 : 1; }

  /** Turn the head toward a yaw (radians, relative to body; + = to the character's left). 0 to look ahead. */
  headTurn(yaw) { this._turnT = clamp(yaw || 0, -1.3, 1.3); }

  update(dt, speed = 0) {
    dt = dt > 0 ? Math.min(dt, 0.1) : 0;
    const back = speed < 0;
    speed = Math.abs(speed) || 0;
    this.t += dt; this.pt += dt;
    if (this.punchT >= 0 && (this.punchT += dt) > PUNCH_DUR) this.punchT = -1;
    // walking poses: the stride follows the distance the group has really been moved since the last update (core/_gait.js:
    // planted feet), whatever speed the caller says; other poses (and a figure walking on the spot) keep the given speed
    const gs = gaitAdvance(this, dt, back ? -speed : speed);
    if (gs >= 0) this.speed = gs;
    else {
      this.speed += (speed - this.speed) * Math.min(1, dt * 10);
      if (this._lk) { const D = this.dims, cyc = lerp(1.55, 2.75, sm(1, 6, this.speed)) * D.s; this.phase = (this.phase + dt * TAU * this.speed / cyc) % TAU; }
    }
    const sp = this.speed;
    this.crank = (this.crank + dt * (gs >= 0 ? speed : sp) * 1.2) % TAU;
    if (this.lodTick() === 1) {      // far: no pose maths, just pick the baked frame
      if (this._g) this._g.reset = true;      // (the stride goes on following the distance; the feet are re-seated on it when the figure is articulated again)
      if (this.poseDur && this.pt >= this.poseDur) { const b = this.basePose; this.poseDur = 0; this.pose = '__'; this.setPose(b); this.blend = 1; }
      this._showImp(this._impFrame());
      if (this.label || this.bubble) this._updateSprites(dt); else if (this._bubbleT > 0) this._bubbleT -= dt;
      return;
    }
    if (this.spec.prop === 'phone') {
      const want = Math.sin(this.t * 0.13 + this.k) > -0.3 ? 1 : 0;
      this.phoneUp += (want - this.phoneUp) * Math.min(1, dt * 3);
    }
    // head: the caller's headTurn(), else — while speaking — a glance at the player if they are close and in front
    this._turn += ((this._turnT !== 0 || this._bubbleT <= 0 || !this.lookAtPlayer ? this._turnT : this._lookYaw()) - this._turn) * Math.min(1, dt * 5);
    if (this.poseDur && this.pt >= this.poseDur) { const b = this.basePose; this.poseDur = 0; this.pose = '__'; this.setPose(b); }
    const o = this.blend < 1 ? this.tgt : this.cur;
    this._live = true; computePose(this, this.pose, o); this._live = false;
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 0.26);
      const w = sm(0, 1, this.blend), f = this.from, c = this.cur;
      for (let i = 0; i < NP; i++) c[i] = f[i] + (o[i] - f[i]) * w;
      if (this._lk === 1 && this._fromLk === 1) gaitSolve(this, c, this.pose === 'balance' ? 0.012 : 0);      // one walking pose to another: the feet stay planted through the blend
    }
    this._apply(this.cur);
    this._face(dt);
    if (this.label || this.bubble) this._updateSprites(dt); else if (this._bubbleT > 0) this._bubbleT -= dt;
  }

  /** Draw the figure at alpha a (1 = as ever, the shared material; below that a dithered copy: fadeMaterial above).
   *  Cheap to call every frame: nothing happens unless the step changes. group.userData.fade says what it is drawn at. */
  setFade(a) {
    const l = fadeLevel(a);
    if (l === this._fadeL) return;
    this._fadeL = l; this.group.userData.fade = l / FADE_STEPS;
    if (!this._skin || this._skin.material.name.indexOf('character') !== 0) return;      // (a figure given a material of its own: left alone)
    const m = fadeMaterial(l / FADE_STEPS);
    this._skin.material = m; if (this._imp) this._imp.material = m;
  }
  /** Distance LOD switch (cheap; also call it on frames where update() is skipped). Returns the LOD level 0/1. */
  /** RIG_PRUNE: mark the rig's own nodes, watch their add / remove, and hide the rig if only bones hang under it */
  _rigInit() {
    if (!RIG_PRUNE) return;
    let own = true;
    this.rig._gtoMx = 1;
    this.rig.traverse((o) => {
      o._rigNode = true; o._rigCh = this; o.add = rigAdd; o.remove = rigRemove;
      if ((o.isMesh || o.isLine || o.isPoints || o.isSprite || o.isLight) && (o.layers.mask & 1) !== 0) own = false;      // (a bone that is itself drawn)
    });
    this._rigOwn = own; this._rigSync();
  }
  _rigSync() {
    let extra = !this._rigOwn;
    if (!extra) { const st = _rigStack; st.length = 0; st.push(this.rig); while (st.length && !extra) { const ch = st.pop().children; for (let i = 0; i < ch.length; i++) { if (ch[i]._rigNode !== true) { extra = true; break; } st.push(ch[i]); } } st.length = 0; }
    this.rig.visible = extra;
  }
  lodTick() {
    const cam = activeCamera();
    let d2 = -1;
    if (cam) { const e = this.group.matrixWorld.elements, cp = cam.position, dx = e[12] - cp.x, dz = e[14] - cp.z; d2 = dx * dx + dz * dz; }
    const det = characterLod.detail;
    const wantHi = det === 'hi' ? true : det === 'lo' || !richAllowed() ? false : d2 < 0 ? this._hi : d2 < (this._hi ? HI_FAR * HI_FAR : HI_NEAR * HI_NEAR);
    if (wantHi !== this._hi && this.lod === 0) this._setDetail(wantHi);
    if (this.noLod || !characterLod.enabled) {
      if (!this._shadow) { this._shadow = true; this._skin.castShadow = true; }
      if (this.lod) { this._setLod(0); computePose(this, this.pose, this.cur); this._apply(this.cur); }
      return 0;
    }
    if (!cam) return this.lod;
    const qd = lodScale(), far = Math.max(LOD_FLOOR, LOD_FAR * qd * lodTier()), shN = Math.max(10, SHADOW_NEAR * qd);
    const sh = d2 < shN * shN;
    if (sh !== this._shadow) { this._shadow = sh; this._skin.castShadow = sh; }
    if (this.lod === 0) {
      // stay articulated while knocked over or blending between poses
      if (d2 > far * far && !this.isDown && this.blend >= 1 && this._showImp(this._impFrame())) this._setLod(1);
    } else if (d2 < (far - (LOD_FAR - LOD_NEAR)) * (far - (LOD_FAR - LOD_NEAR)) || this.isDown) {
      this._setLod(0);
      computePose(this, this.pose, this.cur); this._apply(this.cur);
    }
    return this.lod;
  }

  /** the merged skin geometry of a detail tier (cached per look; the rich tier is built on demand from the same builders) */
  _skinGeo(hi) {
    const key = 'skin:' + (hi ? 'H:' : '') + this._segKey;
    if (this._keys.indexOf(key) >= 0) return geoCache.get(key).geo;
    const geo = acquire(key, () => {
      const D = this.dims, nSeg = this._segs.length;
      if (!hi) return mergeSkin(this._segs.map((m) => m.geometry), this._origins, D, nSeg);
      const tmp = this._segs.map((m) => buildSeg(m.name, this._defs[m.name][0], this._defs[m.name][1], D, true));
      const g = mergeSkin(tmp, this._origins, D, nSeg);
      for (const t of tmp) t.dispose();
      return g;
    });
    this._keys.push(key);
    return geo;
  }
  _setDetail(hi) {
    const key = 'skin:' + (hi ? 'H:' : '') + this._segKey;
    if (hi && !geoCache.has(key) && !bakeBudget()) return;      // build at most a few per frame
    this._skin.geometry = this._skinGeo(hi); this._hi = hi;
  }

  /** 'S' still, or stride frame 'A'/'B' (walk 'w' / run 'r') from the gait phase. */
  _impFrame() {
    if (this.speed < 0.4) return 'S';
    return (this.phase < Math.PI ? 'A' : 'B') + (this.speed > 3 ? 'r' : 'w');
  }

  /** Show the impostor for (pose, frame), baking it if needed. Returns false if over this frame's bake budget. */
  _showImp(frame) {
    const phone = this.phoneUp > 0.5;
    if (this._impKey && this._impPose === this.pose && this._impFr === frame && this._impLH === this.leftHand && this._impPh === phone) return true;
    let sid = SEG_IDS.get(this._segKey);
    if (sid === undefined) { sid = SEG_IDS.size; SEG_IDS.set(this._segKey, sid); }
    const key = 'imp:' + sid + '#' + this.pose + '#' + frame + '#' + (this.leftHand || '') + (phone ? 'p' : '');
    if (key === this._impKey) { this._impPose = this.pose; this._impFr = frame; this._impLH = this.leftHand; this._impPh = phone; return true; }
    if (!this._impKeys.has(key)) {
      if (!geoCache.has(key) && !bakeBudget()) return !!this._imp;
      acquire(key, () => {
        const ph = this.phase, spd = this.speed, keepCur = this.lod === 0;
        if (frame !== 'S') { this.phase = frame[0] === 'A' ? Math.PI * 0.5 : Math.PI * 1.5; this.speed = frame[1] === 'r' ? 4.5 : 1.3; } else this.speed = 0;
        const o = this.tgt;
        computePose(this, this.pose, o); this._apply(o);
        const geo = bakeMerged(this.group, this._skin, this._geoLo);
        this.phase = ph; this.speed = spd;
        if (keepCur) this._apply(this.cur);
        return geo;
      });
      this._impKeys.add(key);
    }
    const geo = geoCache.get(key).geo;
    if (!this._imp) {
      this._imp = new THREE.Mesh(geo, this._fadeL < FADE_STEPS ? fadeMaterial(this._fadeL / FADE_STEPS) : characterMaterial); this._imp.name = 'impostor';
      this._imp.castShadow = false; this._imp.visible = this.lod === 1; this.group.add(this._imp);
    } else this._imp.geometry = geo;
    this._impKey = key; this._impPose = this.pose; this._impFr = frame; this._impLH = this.leftHand; this._impPh = phone;
    return true;
  }

  _setLod(l) {
    this.lod = l; this.group.userData.lod = l;
    this._skin.visible = l === 0;
    if (this._imp) this._imp.visible = l === 1;
    // keep the cache bounded: drop impostor frames this character no longer shows (shared ones live on in the cache)
    if (!l && this._impKeys.size > 6) { for (const k of this._impKeys) release(k); this._impKeys.clear(); this._impKey = null; this._impPose = ''; if (this._imp) { this._imp.removeFromParent(); this._imp = null; } }
  }

  /** Build the clubbing-wardrobe segments (look.outfit 'clubbing' with look.club): same mesh names/bones + an optional skirt. */
  _buildClub(R, D, mk, s, b, q, variant) {
    const C = R.club, cc = C.c, skin = R.skin;
    const legCol = C.legs === 'tights' ? mix(cc.tights, skin, 0.2) : C.legs === 'sheer' ? mix(0x2a1e1a, skin, 0.5) : skin;
    const onesie = C.dress === 'onesie', limbCol = onesie && C.animal === 'panda' ? 0x141414 : onesie ? cc.main : null;
    const pat = C.pattern;
    const shirtLike = ['shirt', 'dinner', 'rugby', 'polo', 'tee', 'vneck', 'scoop', 'vest'].includes(C.top);
    const tails = !C.tucked && shirtLike ? { hem: C.top === 'shirt' || C.top === 'dinner' ? 'shirt' : 'straight', main: cc.main, alt: cc.alt, pattern: pat } : null;
    const fig = R.figure;
    this.torso = mk('torso', CB.torso, { s, b, fig, skin, seed: variant % 97, neck: C.neck, back: C.back, cut: C.cut, sleeves: C.sleeves, topHem: C.topHem, waist: C.waist,
      bottom: C.skirt && !C.dress ? C.skirt.col : cc.bottom, main: cc.main, alt: cc.alt, pattern: pat, open: C.open, tucked: C.tucked, jacket: C.jacket,
      straps: C.straps, peplum: C.peplum, knot: C.knot, bow: C.bow, tie: C.tie === 'neck' ? 'neck' : null, tieCol: cc.tie, loose: C.state > 0.4,
      cape: C.cape, capeCol: cc.trim, logo: C.logo, hero: C.hero, bag: C.bag, trim: cc.trim, necklace: C.necklace, glow: C.glow, glowCol: cc.trim,
      animal: onesie ? C.animal : undefined, dress: C.dress, collar: C.top === 'rugby' ? 0xf4f4f0 : undefined });
    const pcol = onesie || C.dress ? cc.main : C.skirt ? C.skirt.col : cc.bottom;
    const tailCol = { tiger: cc.main, cow: 0xf2f2f0, leopard: cc.main, dino: cc.main, pikachu: 0x6a3a1a }[onesie ? C.animal : ''] ?? null;
    this.pelvis = mk('pelvis', CB.pelvis, { s, b, fig, col: pcol, jean: C.jean, belt: C.belt ? 0x2a1e14 : null, tails, bag: C.bag === 'chain-bag' ? cc.bag : null, trim: cc.trim, tail: tailCol });
    const sleeveCol = C.jacket ? 0x111114 : limbCol ?? cc.main;
    const sPat = C.jacket ? null : pat === 'check' || pat === 'hoops' || pat === 'sequin' || pat === 'floral' ? pat : null;
    const shoulder = (side) => (C.sleeves !== 'none' ? sleeveCol : C.neck === 'oneshoulder' && side === 1 ? cc.main : skin);
    const armP = (side) => ({ s, b, fig, side, skin, sleeves: C.sleeves, col: sleeveCol, alt: cc.alt, pattern: sPat, shoulder: shoulder(side), UA: q(D.UA) });
    const left = [];
    if (C.bag === 'clutch') left.push('clutch');
    if (C.carryL === 'heels') left.push('heels');
    const wb = C.wristband ? [0xff2fb0, 0xfff01f, 0x39ff14, 0x00e5ff][variant % 4] : null;
    const foreP = (side, prop) => ({ s, b, fig, side, skin, sleeves: C.sleeves, col: sleeveCol, alt: cc.alt, pattern: sPat, cuff: C.jacket ? 0xf6f6f2 : null, FA: q(D.FA),
      prop, seed: variant % 12, watch: side === 1 && C.watch, wristband: side === -1 ? wb : null, glow: C.glow ? cc.alt : null,
      left: side === 1 && left.length ? left : undefined, lc: side === 1 && left.length ? { shoes: cc.shoes, bag: cc.bag, trim: cc.trim } : undefined });
    this.armL = mk('armL', CB.upperArm, armP(1)); this.armR = mk('armR', CB.upperArm, armP(-1));
    this.foreL = mk('foreL', CB.foreArm, foreP(1, null)); this.foreR = mk('foreR', CB.foreArm, foreP(-1, R.prop));
    const garment = limbCol ?? (C.dress === 'playsuit' ? cc.main : cc.bottom);
    const legBase = { s, b, fig, skin, legCol, garment, loose: C.loose, jean: C.jean, sheen: C.sheen };
    const thighP = { ...legBase, cover: C.thigh, L1: q(D.L1) };
    const shinP = { ...legBase, cover: C.shin, L2: q(D.L2), ankle: q(D.ankle), heelH: q(D.heelH), shoes: C.shoes, shoeCol: cc.shoes, socks: C.socks,
      legwarmers: C.legwarmers ? cc.trim : null };
    this.thighL = mk('thighL', CB.thigh, thighP); this.thighR = mk('thighR', CB.thigh, thighP);
    this.shinL = mk('shinL', CB.shin, shinP); this.shinR = mk('shinR', CB.shin, shinP);
    if (C.skirt) this._mkSkirt(mk, { s, b, fig: R.figure, kind: C.skirt.kind, hem: q(C.skirt.hem), flare: C.skirt.flare, col: C.skirt.col, alt: cc.alt,
      pattern: C.dress && (pat === 'sequin' || pat === 'block' || pat === 'bandage' || pat === 'floral') ? pat : null }, D);
  }
  _mkSkirt(mk, sp, D) {
    this.skirt = mk('skirt', CB.skirt, sp);
    const d = CB.skirtDims(sp), Hm = -d.hem;
    // hem extent needed to clear a thigh swung by angle a: the thigh's front surface at hem depth (capped at the knee)
    this._sk = { H: Math.min(Hm, D.L1 + 0.08), rz: d.rz1, rx: d.rx1, lenK: Math.min(1, (D.L1 * 1.05) / Hm), maxZ: Hm > 0.5 ? 1.5 : 1.7 };
  }

  _apply(o) {
    // head.visible = false (first-person views) hides the head's part of the skinned mesh too
    const hs = this.head.visible ? 1 : 1e-4;
    if (this.head.scale.x !== hs) this.head.scale.setScalar(hs);
    this.rig.position.set(o[P_RX], o[P_RY], o[P_RZ]); this.rig.rotation.set(o[R_X], o[R_Y], o[R_Z]);
    const sk = this.skirt;
    if (sk) {       // the skirt follows the mean thigh angle and opens out with the stride / straddle
      const K = this._sk, D = this.dims, lf = o[LL_F], rf = o[LR_F], avg = (lf + rf) * 0.5, half = Math.min(1.2, Math.abs(lf - rf) * 0.5);
      sk.rotation.set(-avg, 0, 0);
      const needZ = 0.075 * D.b + K.H * Math.sin(half) + 0.012;
      sk.scale.z = Math.min(K.maxZ, Math.max(1, needZ / K.rz));
      const ab = Math.min(1, Math.max(0, o[LL_A], o[LR_A]));
      const needX = D.hipX + 0.078 * D.b + K.H * Math.sin(ab) + 0.01;
      sk.scale.x = Math.min(1.7, Math.max(1, needX / K.rx));
      sk.scale.y = 1 - (1 - K.lenK) * sm(0.5, 1.4, Math.abs(avg));
    }
    this.pelvis.rotation.set(o[PV_X], o[PV_Y], o[PV_Z]);
    this.torso.rotation.set(o[SP_X], o[SP_Y], o[SP_Z]);
    this.head.rotation.set(o[HD_X], o[HD_Y], o[HD_Z]);
    this.armL.rotation.set(-o[AL_F], 0, o[AL_A]); this.foreL.rotation.set(-o[EL_L], -o[AL_T], 0);
    this.armR.rotation.set(-o[AR_F], 0, -o[AR_A]); this.foreR.rotation.set(-o[EL_R], o[AR_T], 0);
    this.thighL.rotation.set(-o[LL_F], o[LL_T], o[LL_A]); this.shinL.rotation.x = o[KN_L];
    this.thighR.rotation.set(-o[LR_F], -o[LR_T], -o[LR_A]); this.shinR.rotation.x = o[KN_R];
    const fx = this._fx;         // (the feet's yaw and roll on the shins: the walking legs keep a planted sole square on the ground)
    this._footL.rotation.set(o[FT_L], fx[0], fx[1]); this._footR.rotation.set(o[FT_R], fx[2], fx[3]);
  }

  /** yaw (relative to the body) towards the local player when they are within 8 m and not behind; 0 otherwise */
  _lookYaw() {
    const g = typeof window !== 'undefined' ? window.game : null, pl = g && g.player;
    if (!pl || !pl.pos || pl.character === this) return 0;
    const e = this.group.matrixWorld.elements, dx = pl.pos.x - e[12], dz = pl.pos.z - e[14], d2 = dx * dx + dz * dz;
    if (d2 < 0.16 || d2 > 64) return 0;
    let yaw = Math.atan2(dx, dz) - Math.atan2(e[8], e[10]);
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    return Math.abs(yaw) > 1.9 ? 0 : clamp(yaw * 0.85, -1.1, 1.1);
  }

  /** eyelids (blink, sleepy when drunk) and jaw (talking while a bubble is up, or the caller's .mouth) */
  _face(dt) {
    const t = this.t, k = this.k;
    const bp = (t * 0.26 + k * 0.137) % 1, b2 = (t * 0.26 + k * 0.137 + 0.045) % 1;
    let shut = bp < 0.034 ? 1 - Math.abs(bp / 0.017 - 1) : 0;
    if (b2 < 0.03 && Math.sin(k * 5.1 + Math.floor(t * 0.26)) > 0.55) shut = Math.max(shut, 1 - Math.abs(b2 / 0.015 - 1));   // now and then a double blink
    if (this.pose === 'drunk' || this.pose === 'stagger-carry') shut = Math.max(shut, 0.45);
    shut = Math.max(shut, 1 - this.eyes);
    this._lid.scale.y = LID_OPEN + (1 - LID_OPEN) * shut;
    let m = this.mouth;
    if (this._bubbleT > 0) m = Math.max(m, 0.2 + 0.8 * Math.abs(Math.sin(t * 10.3 + k)) * (0.55 + 0.45 * Math.sin(t * 3.7 + k * 2)));
    this._jawM += (m - this._jawM) * Math.min(1, dt * 22);
    this._jaw.position.y = this._jawY - JAW_DROP * this._jawM; this._jaw.rotation.x = 0.12 * this._jawM;
  }

  _updateSprites(dt) {
    const cam = activeCamera();
    let d = 10;
    if (cam) {
      const e = this.group.matrixWorld.elements, cp = cam.position;
      d = Math.hypot(e[12] - cp.x, e[13] + this.dims.top * 0.9 - cp.y, e[14] - cp.z);      // (to the head, where the tag is)
    }
    const f = Math.max(1, Math.pow(Math.max(d, 1) / 7, 0.65)) * Math.min(1, Math.max(d, 0.2) / TAG_CAP), op = clamp((d - TAG_FADE0) / (TAG_FADE1 - TAG_FADE0), 0, 1);
    const yOff = this.dims.top + this.cur[P_RY] * (this.isDown ? 0 : 1);
    if (this.label) {
      const L = this.label;
      L.visible = characterTags.on && d < LABEL_FAR && op > 0.01; L.material.opacity = op;
      L.scale.set(L.userData.aspect * 0.26 * f, 0.26 * f, 1);
      L.position.y = yOff + 0.22;
    }
    this._bubbleT -= dt;
    if (this.bubble) {
      const B = this.bubble;
      if (this._bubbleT <= 0 || !this._bubbleOn) B.visible = false;
      else {
        B.visible = d < BUBBLE_FAR && op > 0.01; B.material.opacity = op;
        const h = 0.5 * f * B.userData.lines;
        B.scale.set(B.userData.aspect * h, h, 1);
        B.position.y = yOff + (this.label && this.label.visible ? 0.3 + 0.26 * f : 0.2);
      }
    }
  }

  /** Floating name tag; null removes it. */
  setLabel(text) {
    if (text === null || text === undefined || text === '') {
      if (this.label) { this.label.removeFromParent(); this.label.material.map.dispose(); this.label.material.dispose(); this.label = null; }
      this._labelText = null; return;
    }
    text = String(text).slice(0, 32);
    if (text === this._labelText) return;
    this._labelText = text;
    const cv = this._labelCanvas || (this._labelCanvas = makeCanvas(256, 64));
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 34px sans-serif';
    const tw = Math.min(244, (ctx.measureText(text).width || text.length * 18) + 24);
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(10,14,24,0.62)'; roundRect(ctx, (256 - tw) / 2, 6, tw, 52, 14); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 33, 236);
    if (!this.label) { this.label = textSprite(cv); this.label.userData.aspect = 4; this.group.add(this.label); }
    else this.label.material.map.needsUpdate = true;
    this.label.position.y = this.dims.top + 0.22;
    this._updateSprites(0);
  }

  /** Say a line: spoken with its rendered voice clip when there is one and voices are on (characterSpeech.hook), else
   *  a speech bubble above the head for `secs` seconds (default scales with length). Either way `saying` is true and the
   *  jaw moves while it lasts. this.voiceAs: a speaker id ('porter', 'lorenzo', ...), false = never voiced. */
  say(text, secs) {
    const tok = (this._sayTok = (this._sayTok || 0) + 1);
    if (!text) { if (this.bubble) this.bubble.visible = false; this._bubbleT = 0; this._bubbleOn = false; const H0 = characterSpeech.hook; if (H0 && H0.stop) H0.stop(this); return; }
    text = String(text);
    secs = secs || clamp(1.6 + text.length * 0.07, 2, 6);
    const H = characterSpeech.hook;
    let r = null;
    if (H && this.voiceAs !== false) { try { r = H(this, text, secs); } catch (e) { r = null; } }
    if (r && r.voiced) {
      if (this.bubble) this.bubble.visible = false;
      this._bubbleOn = false; this._bubbleT = Math.max(0.4, (r.dur || 0) + 0.15);
      // the clip failed after all (load / decode error, cut off before it started): show the bubble instead
      if (r.p && r.p.then) r.p.then((res) => { if (res && !res.played && this._sayTok === tok && this.group) this._bubble(text, secs); }, () => { /* */ });
      return;
    }
    this._bubble(text, secs);
  }
  /** draw the speech bubble (the fallback when a line is not voiced) */
  _bubble(text, secs) {
    text = String(text).slice(0, 120);
    const cv = this._bubbleCanvas || (this._bubbleCanvas = makeCanvas(512, 200));
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 30px sans-serif';
    // word wrap to <= 3 lines of ~440px
    const words = text.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      const tryL = line ? line + ' ' + w : w;
      if ((ctx.measureText(tryL).width || tryL.length * 15) > 440 && line) { lines.push(line); line = w; } else line = tryL;
    }
    if (line) lines.push(line);
    if (lines.length > 3) { lines.length = 3; lines[2] += '…'; }
    let wmax = 0; for (const l of lines) wmax = Math.max(wmax, ctx.measureText(l).width || l.length * 15);
    const bw = Math.min(496, wmax + 40), bh = lines.length * 38 + 24;
    ctx.clearRect(0, 0, 512, 200);
    const x0 = (512 - bw) / 2, y0 = 200 - bh - 26;
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    roundRect(ctx, x0, y0, bw, bh, 18); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(240, y0 + bh - 2); ctx.lineTo(256, 196); ctx.lineTo(272, y0 + bh - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 256, y0 + 12 + 19 + i * 38));
    if (!this.bubble) { this.bubble = textSprite(cv); this.group.add(this.bubble); }
    else this.bubble.material.map.needsUpdate = true;
    this.bubble.userData.aspect = 512 / 200; this.bubble.userData.lines = 1.15;
    this.bubble.visible = true; this._bubbleT = secs; this._bubbleOn = true;
    this._updateSprites(0);
  }

  get saying() { return this._bubbleT > 0; }

  dispose() {
    for (const k of this._keys) release(k);
    this._keys.length = 0;
    if (this._impKeys) { for (const k of this._impKeys) release(k); this._impKeys.clear(); }
    if (this._imp) { this._imp.removeFromParent(); this._imp = null; }
    if (this._skin) { this._skin.skeleton.dispose(); this._skin.removeFromParent(); }
    this.setLabel(null);
    if (this.bubble) { this.bubble.removeFromParent(); this.bubble.material.map.dispose(); this.bubble.material.dispose(); this.bubble = null; }
    this._labelCanvas = this._bubbleCanvas = null;
  }
}

/** Build a character from a look (see randomLook / docs/CHARACTERS_API.md). */
export function createCharacter(look = randomLook()) {
  return new Character(look || randomLook());
}

/** Resolve a look to the full spec the builder uses (handy for debugging / UIs). */
export function resolveLook(look) { return resolve(look); }
/**
 * A static, posed copy of a look's (lean) body as ONE plain BufferGeometry (position / normal / colour, origin at the
 * feet, facing +z): draw it with `characterMaterial`, merge it or instance it. For crowds that are not live characters
 * (a seated lecture audience, a stand full of spectators) so they get the same face, hair and clothes as everyone else.
 * The caller owns the geometry (dispose it when done).
 */
export function bakeCharacterGeometry(look, pose = 'sit', frames = 20) {
  const ch = new Character(look || randomLook());
  ch.noLod = true; ch.setPose(pose); ch.blend = 1;
  for (let i = 0; i < frames; i++) ch.update(1 / 30, 0);
  ch._lid.scale.y = LID_OPEN; ch._jaw.position.y = ch._jawY; ch._jaw.rotation.x = 0;
  const g = ch._skin.geometry, geo = bakeMerged(ch.group, ch._skin, g);
  geo.setAttribute('color', new THREE.BufferAttribute(g.attributes.color.array.slice(), 3));
  geo.setIndex(new THREE.BufferAttribute(g.index.array.slice(), 1));
  ch.dispose();
  return geo;
}

// ------------------------------------------------------------------------------------------------ dogs
const BREEDS = {
  lab: { c: 0xd8b070, c2: 0xd8b070, len: 0.62, h: 0.3, w: 0.22, ear: 'flop', tail: 0.3 },
  blacklab: { c: 0x1e1a18, c2: 0x1e1a18, len: 0.62, h: 0.3, w: 0.22, ear: 'flop', tail: 0.3 },
  spaniel: { c: 0x6a3a1e, c2: 0xeeeae0, len: 0.5, h: 0.3, w: 0.19, ear: 'long', tail: 0.18 },
  dachshund: { c: 0x7a3a1a, c2: 0x7a3a1a, len: 0.55, h: 0.16, w: 0.15, ear: 'flop', tail: 0.22 },
  terrier: { c: 0xe8e4dc, c2: 0xb08050, len: 0.38, h: 0.22, w: 0.15, ear: 'prick', tail: 0.14 },
  collie: { c: 0x1a1a1a, c2: 0xf0f0f0, len: 0.58, h: 0.29, w: 0.2, ear: 'prick', tail: 0.35 },
  pug: { c: 0xd8b888, c2: 0x2a2420, len: 0.34, h: 0.18, w: 0.18, ear: 'flop', tail: 0.08 },
};
export const DOG_BREEDS = Object.keys(BREEDS);

function buildDogBody(p) {
  const B = BREEDS[p.breed], s = p.size, g = new GB();
  const L = B.len * s, W = B.w * s, H = 0.2 * s * (B.h > 0.2 ? 1 : 0.8);
  g.box(W, H, L, B.c, 0, 0, 0);
  g.box(W * 0.9, H * 0.7, L * 0.35, B.c2, 0, -H * 0.18, L * 0.3);                 // chest
  g.box(W * 1.02, 0.03 * s, 0.05 * s, 0xc02020, 0, H * 0.25, L * 0.48);           // collar
  g.box(0.012, 0.03, 0.012, 0xd8c040, 0, H * 0.05, L * 0.5 + 0.02);               // tag
  return g.build();
}
function buildDogHead(p) {
  const B = BREEDS[p.breed], s = p.size, g = new GB();
  const hs = 0.15 * s * (p.breed === 'pug' ? 1.1 : 1);
  g.box(hs, hs, hs * 1.05, B.c, 0, 0, 0);
  const snout = p.breed === 'pug' ? 0.03 : 0.1 * s;
  g.box(hs * 0.6, hs * 0.5, snout, B.c2 === B.c ? shade(B.c, 0.9) : B.c2, 0, -hs * 0.18, hs * 0.5 + snout / 2);
  g.box(0.03 * s, 0.025 * s, 0.02, 0x111111, 0, -hs * 0.05, hs * 0.5 + snout);
  for (const sx of [1, -1]) {
    g.box(0.02 * s, 0.02 * s, 0.01, 0x111111, sx * hs * 0.25, hs * 0.15, hs * 0.53);
    if (B.ear === 'prick') g.tbox(0.05 * s, 0.03 * s, 0.01, 0.01, 0.07 * s, B.c, sx * hs * 0.3, hs * 0.5, -hs * 0.1);
    else g.box(0.03 * s, (B.ear === 'long' ? 0.13 : 0.08) * s, 0.06 * s, shade(B.c, 0.85), sx * hs * 0.55, hs * 0.05 - (B.ear === 'long' ? 0.05 : 0.02) * s, -hs * 0.05);
  }
  return g.build();
}
function buildDogLeg(p) {
  const B = BREEDS[p.breed], s = p.size, g = new GB(), lh = B.h * s;
  g.box(0.055 * s, lh, 0.06 * s, B.c, 0, -lh / 2, 0);
  g.box(0.06 * s, 0.03 * s, 0.08 * s, shade(B.c2, 0.95), 0, -lh + 0.015 * s, 0.012);
  return g.build();
}
function buildDogTail(p) {
  const B = BREEDS[p.breed], s = p.size, g = new GB();
  g.add(new THREE.CylinderGeometry(0.02 * s, 0.012 * s, B.tail * s, 5), B.c2 === 0xf0f0f0 ? 0xf0f0f0 : B.c, 0, B.tail * s / 2, 0);
  return g.build();
}

class Dog {
  constructor(opts = {}) {
    const rnd = mulberry(hashSeed(opts.seed ?? Math.random() * 1e9));
    this.breed = BREEDS[opts.breed] ? opts.breed : DOG_BREEDS[Math.floor(rnd() * DOG_BREEDS.length)];
    this.size = Math.round((opts.size || 0.9 + rnd() * 0.25) * 100) / 100;
    const B = BREEDS[this.breed], s = this.size, p = { breed: this.breed, size: this.size };
    this._keys = [];
    const mk = (name, fn) => { const key = 'dog' + name + JSON.stringify(p); this._keys.push(key); const m = new THREE.Mesh(acquire(key, () => fn(p)), characterMaterial); m.name = name; return m; };
    this.group = new THREE.Group(); this.group.name = 'dog';
    this.legH = B.h * s; const L = B.len * s, W = B.w * s, H = 0.2 * s * (B.h > 0.2 ? 1 : 0.8);
    this.H = H; this.body = mk('body', buildDogBody); this.body.position.y = this.legH + H * 0.3; this.body.castShadow = true;
    this.head = mk('head', buildDogHead); this.head.position.set(0, H * 0.85, L * 0.5 + 0.04 * s); this.body.add(this.head);
    this.tail = mk('tail', buildDogTail); this.tail.position.set(0, H * 0.35, -L * 0.5); this.body.add(this.tail);
    this.legs = [];
    for (let i = 0; i < 4; i++) {
      const leg = mk('leg', buildDogLeg);
      leg.position.set((i % 2 ? -1 : 1) * W * 0.32, -H * 0.3, (i < 2 ? 1 : -1) * L * 0.36);
      this.body.add(leg); this.legs.push(leg);
    }
    this.group.add(this.body);
    this.collar = new THREE.Vector3(0, this.body.position.y + H * 0.3, L * 0.5);   // leash attachment (group-local)
    this.pose = 'stand'; this.t = rnd() * 10; this.phase = 0; this.speed = 0; this.excite = 0.5;
    this._gx = NaN; this._gz = NaN; this._moved = 0;      // (the trot follows the group's real movement: update())
  }
  setPose(name) { this.pose = name || 'stand'; }
  update(dt, speed = 0) {
    dt = dt > 0 ? Math.min(dt, 0.1) : 0;
    this.t += dt;
    // the trot follows the ground really covered (the group's own movement; the given speed only until it has ever
    // moved), one cycle per 4 x leg x swing so a leg sweeping back keeps pace with the ground under it (2026-11 foot-slide pass)
    const gp = this.group.position; let d = 0;
    if (this._gx === this._gx) { d = Math.hypot(gp.x - this._gx, gp.z - this._gz); if (d > 0.06 + 12 * dt) d = 0; }
    this._gx = gp.x; this._gz = gp.z;
    if (d > 0) this._moved += d;
    const real = this._moved > 0.2;
    this.speed += ((real ? (dt > 0 ? d / dt : this.speed) : Math.abs(speed)) - this.speed) * Math.min(1, dt * 8);
    const sp = this.speed, m = sm(0.05, 0.6, sp), s = this.size, amp = 0.55 * m;
    this.phase = (this.phase + TAU * (real ? d : dt * sp) / (4 * this.legH * Math.max(0.12, amp))) % TAU;
    const sw = Math.asin(Math.sin(this.phase)) * (2 / Math.PI) * amp;      // (a triangle wave: the same speed all through the sweep)
    const sit = this.pose === 'sit' ? 1 : 0, squat = this.pose === 'squat' ? 1 : 0, sniff = this.pose === 'sniff' ? 1 : 0;
    this.legs[0].rotation.x = sw; this.legs[3].rotation.x = sw;
    this.legs[1].rotation.x = -sw; this.legs[2].rotation.x = -sw;
    const pitch = -0.45 * sit - 0.25 * squat + 0.18 * sniff;
    this.body.rotation.x += (pitch - this.body.rotation.x) * Math.min(1, dt * 6);
    const drop = (0.06 * sit + 0.09 * squat) * s;
    this.body.position.y = this.legH * (1 - 0.25 * (sit + squat)) + this.H * 0.3 - drop + Math.abs(Math.cos(this.phase)) * 0.015 * m;
    if (sit || squat) { this.legs[2].rotation.x = this.legs[3].rotation.x = -1.0; this.legs[0].rotation.x = this.legs[1].rotation.x = 0.35 * sit; }
    this.head.rotation.x = sniff ? 0.6 + 0.1 * Math.sin(this.t * 7) : -0.15 * sit;
    this.head.rotation.y = 0.3 * Math.sin(this.t * 0.7) * (1 - m);
    this.tail.rotation.x = squat ? -0.3 : -0.7 + 0.1 * m;
    this.tail.rotation.z = Math.sin(this.t * (10 + 6 * this.excite)) * (0.3 + 0.4 * this.excite);
  }
  dispose() { for (const k of this._keys) release(k); this._keys.length = 0; }
}

/** createDog({seed?, breed?, size?}) -> Dog { group, update(dt, speed), setPose('stand'|'sit'|'squat'|'sniff'), collar, dispose() } */
export function createDog(opts) { return new Dog(opts); }
