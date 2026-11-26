// Purple Turtle — shared character helpers: club looks (always via randomLook(seed, {outfit:'clubbing', state}) so the
// clubbing wardrobe in core/characters.js is picked up as it evolves), small props (cheesy chips, a traffic cone, an
// earpiece), and the bone tweaks applied after Character.update() for poses the library may not have yet
// (holding hands, arm in arm, a peck, a conga, asleep on a sofa).
import * as THREE from 'three';
import { createCharacter, randomLook, POSES } from '../core/characters.js';

export const CLUB_LINES = ['WHAT COLLEGE ARE YOU AT?', "Essay due at nine. It's fine. It's FINE.", "Don't look — that's my TUTOR at the bar!", 'Erg at six tomorrow. Worth it.',
  'Collections are a social construct.', 'Is this a bop? It feels like a bop.', 'Jägerbomb? JÄGERBOMB.', "I can't move my feet. Sticky floor.", 'Which college shot are you having?',
  "Keble's shot is the best, fight me.", 'I came out for ONE drink.', "My Bod card's in my gown pocket.", 'This is my SONG!', 'Mind your head!', "It's like a sauna in here.",
  'Battels are going to be brutal.', 'Union card — free entry!', 'PPE. Obviously.', "I'm a medic, I'm basically sober.", 'Cheesy chips after?', 'Torpids crew social!',
  'Is that the Proctors?! No, just a bouncer.', 'I left my essay in the Rad Cam.', "Everyone's from Wadham tonight.", 'Who has the cloakroom ticket?', 'I have a nine a.m. tute. Help.'];
export const GOSSIP_LINES = ['Did you SEE who she was dancing with?!', "He's in my tutorial group!", 'Is anyone actually in there?', 'I love your dress!', 'Has anyone got a hairband?',
  "Three people have asked me what college I'm at.", 'He rowed in the Boat Race. Apparently.', 'She asked a question at the Union debate. Iconic.', 'Is my eyeliner OK?', 'Queue is SO long.'];
export const QUEUE_LINES = ['How long is this queue?', 'Free before half ten!', "I'm freezing.", 'Should have brought a coat.', 'I can hear the bass from here!', 'Have you got your Bod card?',
  'College shots, here we come.', 'Union card! Union card!', 'Pre-drinks went on a bit.'];
export const BOUNCER_LINES = ['ID please.', 'Bod card?', 'Stamp on the left hand.', 'No drinks past the rope.', 'Keep it down, folks.', 'In you go.', 'Night, guys — get home safe.'];
export const STAFF_LINES = ['What can I get you?', 'College shots are on the board.', 'Jägerbomb, two fifty.', 'Last orders at half two!', 'Bod card for the tab?'];
export const DJ_LINES = ['Make some noise for Teddy Hall!', "This one's for the rowers!", "Hands up if you've got a nine a.m.!", 'Worcester in the house!', 'Any finalists in tonight?'];
export const CLOSE_LINES = ['Have you got homes to go to?', 'Come on, drink up!', "Lights are on, party's over!", "Haven't you got essays to write?", 'Up the stairs, folks!'];
export const STREET_LINES = { singers: ['♪ Na na na naaa, na na na naaa ♪', '♪ Ohhh-oh-oh-OHHH ♪', '♪ Cheesy chips, cheesy chips! ♪', '♪ Here we go, here we go, here we go! ♪', 'Sing it! SING IT!'],
  cone: ["It's a hat now.", "I'm returning it. To someone.", 'Traffic management!', 'Cone of shame? Cone of FAME.'], carry: ['One, two, three, LIFT!', "I'm FINE. Put me down.", 'Mind his head!', 'Nearly at the lodge...'],
  couple: ['Walk you home?', 'Cheesy chips?', 'Shhh, the porter!', 'Where is my Bod card...', 'Got it!'], leave: ['Night!', 'Best night ever.', 'Where are we?', 'Hassan\'s? No — the van!', "I've got a nine a.m.", 'Taxi! TAXI!'] };

/** a club-goer's look. state 0..1 = how far through the night (dishevelment), passed through to the wardrobe */
export function clubLook(seed, state = 0, extra = null) {
  let L;
  try { L = randomLook(seed, { outfit: 'clubbing', state }); } catch { L = randomLook(seed, { outfit: 'clubbing' }); }
  if (extra) Object.assign(L, extra);
  return L;
}
export function staffLook(seed, extra = null) { const L = randomLook(seed, { outfit: 'barstaff' }); L.prop = null; if (extra) Object.assign(L, extra); return L; }
export function bouncerLook(seed) {
  const L = randomLook(seed, { outfit: 'smart' });
  Object.assign(L, { jacket: 0x111114, jacketLen: 'long', top: 0x101012, topStyle: 'shirt', shirt: 0x101012, neck: null, bottom: 0x121214, shoes: 0x0c0c0c, shoeStyle: 'boot',
    hat: null, glasses: false, backpack: null, scarf: null, prop: null, height: 1.88 + (seed % 7) * 0.02, build: 1.25, hairStyle: ['buzz', 'bald', 'short'][seed % 3], skirt: false, dress: false });
  return L;
}
/** does the character library have a pose by this name (checked at runtime: the API may grow) */
export const hasPose = (n) => Array.isArray(POSES) && POSES.includes(n);
/** walking together: the library's partner poses ('holding-hands' / 'arm-in-arm', opts.side) when present, else a
 *  bone tweak after update. Returns true if the pose handles it (no tweak needed). Call every frame; cheap. */
export function couplePose(ch, mode, side) {
  const name = mode === 'arm' ? 'arm-in-arm' : 'holding-hands';
  if (!hasPose(name)) { if (ch.pose !== 'stand') ch.setPose('stand'); return false; }
  if (ch.pose !== name || ch.partnerSide !== side) ch.setPose(name, { side });
  return true;
}

export function makeChar(look, parent) { const ch = createCharacter(look); parent.add(ch.group); return ch; }
export function freeChar(ch) { if (!ch) return; ch.group.removeFromParent(); ch.dispose(); }

// ------------------------------------------------------------------ props (shared geometry/material)
let chipsProto = null, coneProto = null, earProto = null;
export function chipsBox() {
  if (!chipsProto) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.11).translate(0, 0.03, 0), new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.8 }));
    const chips = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.09).translate(0, 0.07, 0), new THREE.MeshStandardMaterial({ color: 0xe8c040, roughness: 0.9 }));
    g.add(box, chips); chipsProto = g;
  }
  return chipsProto.clone();
}
export function trafficCone() {
  if (!coneProto) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 12).translate(0, 0.21, 0), new THREE.MeshStandardMaterial({ color: 0xf06010, roughness: 0.6 })));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.07, 12).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 })));
    coneProto = g;
  }
  return coneProto.clone();
}
export function earpiece(ch) {
  if (!earProto) {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), m));
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4).translate(0, -0.1, -0.02), m); coil.rotation.x = 0.25; g.add(coil);
    earProto = g;
  }
  const e = earProto.clone(), top = ch.anchors.headTop.position.y;
  e.position.set(-0.105 * (ch.dims?.s || 1), top * 0.62, -0.01); ch.bones.head.add(e);
  return e;
}

// ------------------------------------------------------------------ bone tweaks (call AFTER ch.update)
/** side: +1 = partner is on this character's left (+x), −1 = on the right. mode 'hand' | 'arm' */
export function holdTweak(ch, side, mode) {
  const b = ch.bones, arm = side > 0 ? b.armL : b.armR, fore = side > 0 ? b.foreL : b.foreR;
  if (mode === 'arm') { arm.rotation.set(-0.3, 0, side * 0.28); fore.rotation.x = -1.25; fore.rotation.y = side * -0.5; }
  else { arm.rotation.set(-0.12, 0, side * 0.2); fore.rotation.x = -0.15; }
}
/** a brief peck: w 0..1 lean in */
export function kissTweak(ch, w) { const b = ch.bones; b.head.rotation.x += 0.32 * w; b.torso.rotation.x += 0.1 * w; }
/** hands on the shoulders of the person in front */
export function congaTweak(ch) { const b = ch.bones; b.armL.rotation.set(-1.25, 0, 0.12); b.armR.rotation.set(-1.25, 0, -0.12); b.foreL.rotation.x = -0.25; b.foreR.rotation.x = -0.25; }
/** asleep sitting up on a sofa */
export function sleepTweak(ch, t) { const b = ch.bones; b.head.rotation.x += 0.55 + Math.sin(t * 0.7) * 0.03; b.head.rotation.z += 0.35; b.torso.rotation.z += 0.12; }
/** holding a box of chips in front (left hand), now and then a chip to the mouth (right) */
export function chipsTweak(ch, t, eat) {
  const b = ch.bones; b.armL.rotation.set(-0.35, 0, 0.12); b.foreL.rotation.x = -1.3;
  if (eat) { const s = Math.max(0, Math.sin(t * 1.3)); b.armR.rotation.x = -0.4 - 0.3 * s; b.foreR.rotation.x = -0.8 - 1.0 * s; }
}
/** fumbling for a key / Bod card at a door */
export function fumbleTweak(ch, t, phase) {
  const b = ch.bones;
  if (phase < 0.55) { b.armR.rotation.set(0.15, 0, -0.1); b.foreR.rotation.x = -0.6 + Math.sin(t * 9) * 0.15; b.head.rotation.x += 0.35; }
  else { b.armR.rotation.set(-1.0, 0, -0.05); b.foreR.rotation.x = -0.3 + Math.sin(t * 6) * 0.08; }
}
/** carrying a friend: arms forward (back carrier) / down and back (front carrier) */
export function carryTweak(ch, front) { const b = ch.bones; if (front) { b.armL.rotation.set(0.35, 0, 0.15); b.armR.rotation.set(0.35, 0, -0.15); } else { b.armL.rotation.set(-1.1, 0, 0.1); b.armR.rotation.set(-1.1, 0, -0.1); b.foreL.rotation.x = -0.3; b.foreR.rotation.x = -0.3; } }
export function smokeHand(ch, t) { const b = ch.bones, s = Math.max(0, Math.sin(t * 0.5)) ** 4; b.armR.rotation.x = -0.25 - 0.3 * s; b.foreR.rotation.x = -1.2 - 0.9 * s; }

// ------------------------------------------------------------------ a night out (_pt_social.js, _pt_scrap.js, _pt_walkhome.js)
/** a dance step layered on the dance loop: dir 'left' | 'right' | 'up' (arms up) | 'down' (a dip) | 'bounce'; w 0..1; wob = a wobble when it went wrong */
export function moveTweak(ch, dir, w, wob = 0) {
  const b = ch.bones;
  if (dir === 'left' || dir === 'right') { const s = dir === 'left' ? 1 : -1; b.torso.rotation.z += -0.16 * s * w; b.pelvis.rotation.z += 0.1 * s * w; (s > 0 ? b.armL : b.armR).rotation.z += s * 0.55 * w; b.head.rotation.z += 0.1 * s * w; }
  else if (dir === 'up') { for (const [a, f, s] of [[b.armL, b.foreL, 1], [b.armR, b.foreR, -1]]) { a.rotation.x += (-2.75 - a.rotation.x) * w; a.rotation.z += (s * 0.22 - a.rotation.z) * w; f.rotation.x += (-0.25 - f.rotation.x) * w; } b.head.rotation.x -= 0.12 * w; }
  else if (dir === 'down') { b.thighL.rotation.x -= 0.5 * w; b.thighR.rotation.x -= 0.5 * w; b.shinL.rotation.x += 0.9 * w; b.shinR.rotation.x += 0.9 * w; b.rig.position.y -= 0.09 * w * (ch.dims?.s || 1); b.torso.rotation.x += 0.16 * w; }
  else { b.rig.position.y += 0.03 * w; }
  if (wob) { b.torso.rotation.z += wob; b.head.rotation.z -= wob * 0.6; }
}
/** behind the bar, pouring: head down, both hands at the taps */
export function pourTweak(ch) { const b = ch.bones; b.head.rotation.x += 0.3; b.armL.rotation.set(-0.5, 0, 0.1); b.armR.rotation.set(-0.7, 0, -0.1); b.foreL.rotation.x = -0.9; b.foreR.rotation.x = -0.7; }
/** a scrap (bloodless): rearing back, the shove itself, forearms up, off balance, a clinch */
export function windupTweak(ch, w) { const b = ch.bones; b.armR.rotation.set(0.75 * w, 0, -0.35 * w); b.foreR.rotation.x = -1.5 * w; b.torso.rotation.y += -0.35 * w; b.torso.rotation.x -= 0.08 * w; }
export function shoveTweak(ch, w) { const b = ch.bones; b.armL.rotation.set(-1.35 * w, 0, 0.1); b.armR.rotation.set(-1.45 * w, 0, -0.1); b.foreL.rotation.x = -0.25; b.foreR.rotation.x = -0.15; b.torso.rotation.x += 0.22 * w; }
export function blockTweak(ch) { const b = ch.bones; b.armL.rotation.set(-0.95, 0, -0.25); b.armR.rotation.set(-0.95, 0, 0.25); b.foreL.rotation.x = -1.95; b.foreR.rotation.x = -1.95; b.head.rotation.x += 0.18; b.torso.rotation.x += 0.08; }
export function staggerTweak(ch, t) { const b = ch.bones, s = Math.sin(t * 13); b.torso.rotation.x -= 0.3; b.torso.rotation.z += 0.14 * s; b.armL.rotation.z = 0.9 + 0.2 * s; b.armR.rotation.z = -0.9 + 0.2 * s; b.armL.rotation.x = -0.3; b.armR.rotation.x = -0.3; b.head.rotation.x -= 0.15; }
export function clinchTweak(ch, t) { const b = ch.bones, s = Math.sin(t * 17); b.armL.rotation.set(-1.25, 0, -0.2); b.armR.rotation.set(-1.25, 0, 0.2); b.foreL.rotation.x = -0.6 + 0.2 * s; b.foreR.rotation.x = -0.6 - 0.2 * s; b.torso.rotation.x += 0.3; b.torso.rotation.z += 0.07 * s; }
/** a bouncer's hand on your shoulder / being steered out */
export function escortTweak(ch, side = 1) { const b = ch.bones, a = side > 0 ? b.armL : b.armR, f = side > 0 ? b.foreL : b.foreR; a.rotation.set(-1.1, 0, side * 0.5); f.rotation.x = -0.5; }
export function palmsTweak(ch) { const b = ch.bones; b.armL.rotation.set(-0.7, 0, 0.5); b.armR.rotation.set(-0.7, 0, -0.5); b.foreL.rotation.x = -1.3; b.foreR.rotation.x = -1.3; }
/** a kiss on the cheek: w 0..1; side = which way the head tips (+1 to their left) */
export function cheekTweak(ch, w, side = 1) { const b = ch.bones; b.head.rotation.x += 0.2 * w; b.head.rotation.z += 0.22 * side * w; b.head.rotation.y += 0.3 * side * w; b.torso.rotation.x += 0.12 * w; }
/** a spring in the step for someone walking home happy: t seconds, speed m/s */
export function springTweak(ch, t, speed, k = 1) { if (speed < 0.5) return; const b = ch.bones, s = Math.abs(Math.sin(t * 5.2)); b.rig.position.y += 0.035 * s * k; b.head.rotation.x -= 0.07 * k; b.armL.rotation.x *= 1 + 0.35 * k; b.armR.rotation.x *= 1 + 0.35 * k; b.torso.rotation.x -= 0.04 * k; }
export const WAVE_LINES = ['Night!', 'Text me!'];
