// Go: a friend of the user's, a Japanese man, sitting on the toilet in the en-suite of Matt's room in the courtyard
// house behind 7 Beaumont Street (places/worcester_beaumont.js). The user's words: "there is a japanese man sitting on
// the toilet saying 'every time I drink alcool, I become diarrhea' ... he should also say 'horest' sometimes. this guy
// is called 'go'." Nothing else is known or claimed about him: his looks are a neutral GUESS (there is no photograph),
// and he says only those two lines (_wbmt_plan.js GO_LINES; spoken with his own rendered voice, speaker 'go',
// docs/VOICES.md). The depiction is comic and modest: seated, a long grey hoodie, dark shorts, his jeans round his
// ankles; he never leaves the seat.
//   createGo(game, scene) -> { ch, group, said, state, update(dt, who, env), talk(), speak(key), play(kind) }
// `who` = the local player's position in the ROOM's coordinates when they are in the house ({x, y, z}), else null.
// `env` = { lit: is the bathroom light on, door: how far its door stands open (rad) }.
// What he does, besides his two lines (all of it silent):
//   · head bowed over his knees; lifts it and looks at whoever is in the room;
//   · left alone he fidgets: looks at his phone for a while, shifts his weight, heaves a sigh (S.idle);
//   · the light switched off: both hands go up; switched on again: "Horest." (the one thing he has to say about it);
//   · the door pushed wide and left so, with you outside: he leans and flaps a hand at it until it swings back.
import * as THREE from 'three';
import { createCharacter } from '../core/characters.js';
import { GO, GO_LINES, BK } from './_wbmt_plan.js';

/** a neutral guess: a man in his early twenties, short black hair with a fringe, a grey hoodie */
export const GO_LOOK = { seed: 20131, outfit: 'casual', figure: 'm', skin: 0xf4dac2, hair: 0x0e0e11, hairStyle: 'short', hairCut: 'fringe', height: 1.72, build: 0.95,
  top: 0x8d9299, topStyle: 'hoodie', sleeves: 'long', bottom: 0x2b3350, legs: 'shorts', shoes: 0xe9e9e4, shoeStyle: 'trainer' };
export const GO_IDLES = ['phone', 'shift', 'sigh', 'phone', 'sigh', 'shift'];
const DUR = { phone: 7.5, shift: 2.6, sigh: 3.2, dark: 2.2, door: 2.6 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (k) => k * k * (3 - 2 * k);
/** 0 -> 1 -> 0 over an action of length d, with soft ends of e seconds */
const env01 = (t, d, e = 0.45) => ease(clamp(Math.min(t, d - t) / e, 0, 1));
const toward = (bone, ax, target, w) => { if (bone) bone.rotation[ax] += (target - bone.rotation[ax]) * w; };

export function createGo(game, scene) {
  const ch = createCharacter({ ...GO_LOOK });
  ch.voiceAs = 'go'; ch.lookAtPlayer = false;
  const heading = Math.atan2(GO.face[0], -GO.face[1]);                // (front frame [ds, dt] -> the room's x, z = s, -t)
  const seatY = BK.F1 + GO.seat - (ch.dims && ch.dims.seat ? ch.dims.seat : 0.45);
  ch.group.position.set(GO.s, seatY, -GO.t); ch.group.rotation.y = heading;
  ch.setPose('sit');
  try { ch.setLabel('Go'); } catch { /* headless */ }
  // his jeans, round his ankles (a heap of cloth on the floor in front of the pan: his own small mesh, he never moves)
  { const floor = BK.F1 - seatY, L1 = (ch.dims && ch.dims.L1) || 0.43, mat = new THREE.MeshStandardMaterial({ color: 0x3b4a6b, roughness: 0.95 });
    const g = new THREE.Group(); g.name = 'go:jeans';
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.13, 9, 1, true), mat); m.position.set(sx * 0.1, floor + 0.075, L1 - 0.03); g.add(m); }
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.16), mat); mid.position.set(0, floor + 0.045, L1 - 0.03); g.add(mid);
    g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    ch.group.add(g); }
  // his phone: in his right hand while he looks at it
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.011, 0.128), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.35, emissive: 0x9fb4d8, emissiveIntensity: 0.25 }));
  phone.name = 'go:phone'; phone.visible = false; phone.castShadow = false;
  { const hand = ch.anchors && ch.anchors.handR; if (hand) { hand.add(phone); phone.position.set(0, -0.03, 0.045); phone.rotation.x = -0.5; } else { ch.group.add(phone); phone.position.set(-0.14, GO.seat + 0.42, 0.34); } }
  scene.add(ch.group);

  const S = { near: false, cool: 0, n: 0, talks: 0, after: 0, look: 0, bow: 0.34, idle: null, idleT: 0, next: 6, idles: 0, lit: true, litSaid: 0, doorT: 0, doorDone: false, reacts: [] };
  const said = [];
  const speak = (key) => { const text = GO_LINES[key]; if (!text) return null; said.push(text); try { ch.say(text, key === 'main' ? 4.2 : 1.8); } catch (e) { /* headless */ } return text; };
  /** the player presses E: mostly "Horest.", every third time the whole confession again */
  const talk = () => { S.talks++; S.after = 0; stop(); return speak(S.talks % 3 === 0 ? 'main' : 'horest'); };
  const stop = () => { S.idle = null; S.idleT = 0; phone.visible = false; };
  /** start an action now: 'phone' | 'shift' | 'sigh' (idles) | 'dark' | 'door' (reactions) */
  const play = (kind) => { if (!DUR[kind]) return false; S.idle = kind; S.idleT = 0; phone.visible = kind === 'phone'; if (kind === 'dark' || kind === 'door') S.reacts.push(kind); return true; };

  function update(dt, who, env = null) {
    let d = 99, yaw = 0;
    const here = !!who && who.y > BK.F1 - 0.6 && -who.z < BK.HN;                  // somebody in his room (north of the landing's wall)
    if (here) {
      const dx = who.x - ch.group.position.x, dz = who.z - ch.group.position.z; d = Math.hypot(dx, dz);
      yaw = Math.atan2(dx, dz) - heading; yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    }
    // at the bathroom's door, or in: he says his line (he has looked up before that, as you cross the room)
    const near = here && who.x < GO.near[0] && -who.z > GO.near[1];
    if (S.cool > 0) S.cool -= dt;
    if (near && !S.near && S.cool <= 0) {
      S.n++; S.cool = GO.again; stop(); speak('main');
      S.after = S.n % 2 === 1 ? 5.4 : 0;                              // every other visit he adds "Horest." a moment later
    }
    if (S.after > 0) { S.after -= dt; if (S.after <= 0 && near) speak('horest'); }
    S.near = near;
    // ---- the light, the door
    if (env) {
      if (env.lit !== undefined && env.lit !== S.lit) {
        S.lit = env.lit;
        if (!S.lit) play('dark');
        else if (here && S.litSaid <= 0) { stop(); speak('horest'); S.litSaid = 8; }
      }
      const wide = Math.abs(env.door || 0) > 1.15, outside = here && who.x > BK.pod.s1 + 0.1;
      if (wide && outside) { S.doorT += dt; if (S.doorT > 0.6 && !S.doorDone && !ch.saying) { S.doorDone = true; play('door'); } } else { S.doorT = 0; if (!wide) S.doorDone = false; }
    }
    if (S.litSaid > 0) S.litSaid -= dt;
    // ---- left to himself he fidgets (not while he is talking to you)
    if (!S.idle && !near && !ch.saying) { S.next -= dt; if (S.next <= 0) { play(GO_IDLES[S.idles % GO_IDLES.length]); S.idles++; S.next = 7 + (S.idles * 37 % 9); } }
    let k = 0; const A = S.idle;
    if (A) { S.idleT += dt; if (S.idleT >= DUR[A] || (near && (A === 'phone' || A === 'shift' || A === 'sigh') && S.idleT > 0.3 && ch.saying)) stop(); else k = env01(S.idleT, DUR[A]); }
    // ---- the head: bowed over his knees when nobody is there, lifted and turned to whoever comes in
    const aware = here && d < GO.aware, onPhone = A === 'phone' ? k : 0;
    S.look += ((aware && !onPhone ? clamp(yaw, -1.1, 1.1) : A === 'door' ? clamp(-0.5, -1.1, 1.1) * k : 0) - S.look) * Math.min(1, dt * 5);
    S.bow += ((aware && !onPhone ? -0.06 : 0.34) - S.bow) * Math.min(1, dt * 4);
    try { ch.headTurn(S.look); } catch { /* */ }
    ch.update(dt, 0);
    const Bn = ch.bones; if (!Bn) return;
    if (Bn.head) Bn.head.rotation.x += S.bow;
    if (Bn.torso) Bn.torso.rotation.x += 0.16 + S.bow * 0.3;          // leaning forward, forearms on his thighs
    if (!A || k <= 0) return;
    const t = S.idleT;
    if (A === 'phone') {                                              // the right hand comes up with the phone; he peers down at it
      toward(Bn.armR, 'x', -0.72, k); toward(Bn.armR, 'z', 0.12, k); toward(Bn.foreR, 'x', -1.55, k); toward(Bn.foreR, 'y', 0.35, k);
      if (Bn.head) { Bn.head.rotation.x += 0.2 * k; Bn.head.rotation.y += -0.16 * k; }
      if (Bn.foreR && t > 1.2) Bn.foreR.rotation.z += Math.sin(t * 6.5) * 0.03 * k;      // a thumb at work
    } else if (A === 'shift') {                                       // from one side to the other and back
      const w = Math.sin((t / DUR.shift) * Math.PI * 2) * 0.11 * k;
      if (Bn.torso) Bn.torso.rotation.z += w; if (Bn.pelvis) Bn.pelvis.rotation.z += w * 0.5; if (Bn.head) Bn.head.rotation.z -= w * 0.7;
    } else if (A === 'sigh') {                                        // sits up, head back, and sinks again
      const up = Math.sin(clamp(t / DUR.sigh, 0, 1) * Math.PI);
      if (Bn.torso) Bn.torso.rotation.x -= 0.3 * up; if (Bn.head) Bn.head.rotation.x -= (S.bow + 0.28) * up;
      try { ch.mouth = 0.35 * Math.max(0, Math.sin(clamp((t - 1.2) / 1.4, 0, 1) * Math.PI)); } catch { /* */ }
    } else if (A === 'dark') {                                        // who turned the light off: both hands up
      const flap = Math.sin(t * 11) * 0.12 * k;
      toward(Bn.armL, 'x', -2.2, k); toward(Bn.armR, 'x', -2.2, k); toward(Bn.armL, 'z', 0.55 + flap, k); toward(Bn.armR, 'z', -0.55 - flap, k);
      toward(Bn.foreL, 'x', -0.5, k); toward(Bn.foreR, 'x', -0.5, k);
      if (Bn.head) Bn.head.rotation.x -= (S.bow + 0.2) * k;
    } else if (A === 'door') {                                        // the door: leans and flaps a hand at it
      toward(Bn.armL, 'x', -1.35, k); toward(Bn.armL, 'z', 0.25, k); toward(Bn.foreL, 'x', -0.25 + Math.sin(t * 9) * 0.3, k);
      if (Bn.torso) Bn.torso.rotation.x += 0.14 * k;
    }
  }
  return { ch, group: ch.group, said, state: S, update, talk, speak, play, phone, heading, seatY };
}
