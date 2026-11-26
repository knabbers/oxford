// Miguel's chicken dippers in the Earl Building kitchen (first floor, end of the corridor; owned by places/friends.js).
// Everything is a function of the session time t (seconds since start, from the SHARED clock via _friends_logic.js), so
// every client in the kitchen sees the same moment: freezer drawer → the offer, bag in hand → dippers shaken onto the
// tray → oven (door, light, timer, fan, sizzle, steam) → waiting at the breakfast bar with his phone while Lorenzo gets
// the drinks → a peek through the door → mitts on, tray out → plates, fish slice, ketchup → carried to the table →
// eating with their hands (pick, dip, bite, chew) → washing up.
// _friends_logic.js says WHERE everyone is (TRACKS), what their hands are doing (ACTS / EAT) and the state of every prop
// (propsAt); this file turns that into arm reaches (a two-bone IK layered on the character's pose after update()),
// props that follow the hand anchors, the freezer / oven doors, steam and synthesised sound cues.
// Interior actors are separate characters from the outdoor friends (same people; friends.js hides the outdoor ones
// while they are "in the Earl kitchen").
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCharacter } from '../core/characters.js';
import { lookFor } from './_people.js';
import { K, KIT, TABLE_PLATES } from './_worcint_earl_plan.js';
import { DUR_S, OFFER_T, REPLY_T, SCENE_LINES, CUES, SPOT, EAT_S, lineText, actorAt, actAt, eatAt, propsAt, dipperOnTable, SCOOP_U } from './_friends_logic.js';

export const EARL_ID = 'worcint_earl';
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const ROLES = ['miguel', 'lorenzo', 'guest'];

function labelTex(draw, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function bagTex() {
  return labelTex((g, w, h) => {
    g.fillStyle = '#e8641c'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23a'; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = '#ffffff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('CHICKEN', w / 2, 34); g.fillText('DIPPERS', w / 2, 60);
    g.fillStyle = '#c87a24'; for (const [x, y] of [[34, 112], [64, 104], [94, 114], [50, 132], [82, 134]]) { g.beginPath(); g.ellipse(x, y, 16, 10, 0.3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#7a2a0a'; g.font = '13px sans-serif'; g.fillText('oven bake 18–20 min', w / 2, 86);
  }, 128, 160);
}
function gloveTex() { return labelTex((g, w, h) => { g.fillStyle = '#c8282c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2ece0'; for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) g.fillRect(x, y, 8, 8); }, 64, 64); }
function steamTex() { return labelTex((g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }, 32, 32); }

// ------------------------------------------------------------------------------------------------ synth audio
class KitchenAudio {
  constructor(game) { this.game = game; this.ctx = null; this.beepT = 0; this.alarmT = 0; }
  _init() {
    const a = this.game.audio; if (!a || !a.ctx) return false;
    if (this.ctx) return true;
    const ctx = (this.ctx = a.ctx);
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(a.master);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.buf = buf;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    // extractor fan: low rumble + a faint motor tone
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    this.fan = ctx.createGain(); this.fan.gain.value = 0; src.connect(lp); lp.connect(this.fan); this.fan.connect(this.out);
    const hum = ctx.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 98; const hg = ctx.createGain(); hg.gain.value = 0.18; hum.connect(hg); hg.connect(this.fan); hum.start();
    // sizzle: band-limited hiss whose level crackles (randomised every frame)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 5200; bp.gain.value = 6;
    this.siz = ctx.createGain(); this.siz.gain.value = 0; src.connect(hp); hp.connect(bp); bp.connect(this.siz); this.siz.connect(this.out);
    src.start();
    return true;
  }
  beep(f, dur, gain) {
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.setValueAtTime(gain, t + dur - 0.01); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  /** level 0..1 by distance; st = propsAt() state; alarm = smoke alarm sounding */
  update(dt, level, st, alarm) {
    if (!this._init()) return;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(level * 0.55, t, 0.2);
    this.fan.gain.setTargetAtTime(st ? st.fan * 0.16 : 0, t, 0.4);
    const s = st ? st.sizzle : 0;
    this.siz.gain.setTargetAtTime(s * (0.025 + Math.random() * 0.05), t, 0.015);
    if (level < 0.02) return;
    if (st && st.beep) { if ((this.beepT -= dt) <= 0) { this.beepT = 0.55; this.beep(2730, 0.14, 0.05); } } else this.beepT = 0;
    if (alarm) { if ((this.alarmT -= dt) <= 0) { this.alarmT = 0.5; this.beep(3150, 0.32, 0.07); } } else this.alarmT = 0;
  }
  /** one-shot cues (door clunks, tray, squirt, tap…) through the same distance-scaled output */
  cue(name) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const burst = (dur, f, q, gain, type = 'bandpass', when = 0) => {
      const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.buf; src.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      g.gain.setValueAtTime(0, t + when); g.gain.linearRampToValueAtTime(gain, t + when + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + when + dur);
      src.connect(fl); fl.connect(g); g.connect(this.out); src.start(t + when, Math.random()); src.stop(t + when + dur + 0.05);
    };
    switch (name) {
      case 'fridge': burst(0.12, 300, 1.2, 0.5); burst(0.3, 900, 0.6, 0.08, 'bandpass', 0.05); break;      // seal letting go
      case 'fridgeShut': burst(0.14, 160, 1.5, 0.7); break;
      case 'ovenOpen': burst(0.1, 420, 2, 0.5); burst(0.22, 1400, 3, 0.12, 'bandpass', 0.06); break;       // catch + hinge spring
      case 'ovenShut': burst(0.16, 180, 1.2, 0.9); burst(0.08, 2400, 4, 0.1, 'bandpass', 0.02); break;
      case 'traySlide': burst(0.28, 3200, 6, 0.16); break;
      case 'trayDown': burst(0.09, 2100, 8, 0.4); burst(0.2, 5200, 10, 0.12, 'bandpass', 0.01); break;
      case 'rattle': for (let i = 0; i < 5; i++) burst(0.05, 700 + Math.random() * 900, 2, 0.22, 'bandpass', i * 0.09 + Math.random() * 0.04); break;
      case 'clink': burst(0.06, 4200, 14, 0.2); break;
      case 'plate': burst(0.07, 1300, 6, 0.35); burst(0.12, 3800, 12, 0.1, 'bandpass', 0.01); break;
      case 'glass': burst(0.05, 5200, 16, 0.2); break;
      case 'squirt': burst(0.32, 520, 1.4, 0.3); burst(0.18, 180, 2, 0.25, 'bandpass', 0.1); break;
      case 'tap': burst(2.0, 3600, 0.7, 0.07, 'highpass'); break;
      case 'beep': this.beep(2730, 0.12, 0.05); break;
    }
  }
  silence() { if (this.ctx) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15); }
}

// ------------------------------------------------------------------------------------------------ helpers
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _hp = new THREE.Vector3();
/**
 * Two-bone reach, layered on the pose after ch.update(): turns the shoulder and elbow of `side` (+1 left, −1 right) so
 * the hand anchor arrives at the world point (x, y, z), blended in by weight w. Allocation-free.
 */
let _tgt = null;      // { L: [x, y, z, w], R: […] } of the actor whose gestures are being solved (DippersScene._xfade reads it)
export const REACH_DBG = { on: false, log: [] };      // test hook (tools/smoke_friends.mjs): full-weight reach targets of the frame
export function reach(ch, side, x, y, z, w = 1) {
  const B = ch.bones; if (!B || w <= 0) return;
  if (REACH_DBG.on && w > 0.985) REACH_DBG.log.push([ch, side, x, y, z]);
  if (_tgt) { const r = side > 0 ? _tgt.L : _tgt.R; r[0] = x; r[1] = y; r[2] = z; r[3] = w; }
  const arm = side > 0 ? B.armL : B.armR, fore = side > 0 ? B.foreL : B.foreR, D = ch.dims, UA = D.UA, L2 = D.FA + 0.06;
  B.torso.updateWorldMatrix(true, false);                                     // (the caller may have leaned / turned the body since update())
  _v.set(x, y, z); B.torso.worldToLocal(_v); _v.sub(arm.position);            // target from the shoulder, in the torso's frame
  let d = _v.length(); if (d < 1e-4) return;
  const dmax = (UA + L2) * 0.985, dmin = Math.abs(UA - L2) + 0.04;
  if (d > dmax) { _v.multiplyScalar(dmax / d); d = dmax; } else if (d < dmin) { _v.multiplyScalar(dmin / d); d = dmin; }
  const px = _v.x / d, py = _v.y / d, pz = _v.z / d;
  const al = Math.acos(clamp((UA * UA + d * d - L2 * L2) / (2 * UA * d), -1, 1));
  let wx = side * 0.5, wy = -1, wz = -0.45;                                   // elbow hint: down, out and a little back
  const dt = wx * px + wy * py + wz * pz; wx -= dt * px; wy -= dt * py; wz -= dt * pz;
  const wl = Math.hypot(wx, wy, wz) || 1, ca = Math.cos(al), sa = Math.sin(al) / wl;
  const ux = ca * px + sa * wx, uy = ca * py + sa * wy, uz = ca * pz + sa * wz;   // upper-arm direction
  const A = Math.asin(clamp(side * ux, -1, 1)), F = Math.atan2(uz, -uy), sA = side * A;
  // the target in the upper arm's own frame → elbow bend and forearm twist
  const cF = Math.cos(F), sF = Math.sin(F), y1 = _v.y * cF - _v.z * sF, z1 = _v.y * sF + _v.z * cF;
  const cA = Math.cos(sA), sn = Math.sin(sA), hx = _v.x * cA + y1 * sn, hy = -_v.x * sn + y1 * cA + UA;
  const ty = Math.atan2(hx, z1), el = Math.atan2(Math.hypot(hx, z1), -hy);
  arm.rotation.x = lerp(arm.rotation.x, -F, w); arm.rotation.y = lerp(arm.rotation.y, 0, w); arm.rotation.z = lerp(arm.rotation.z, sA, w);
  fore.rotation.x = lerp(fore.rotation.x, -el, w); fore.rotation.y = lerp(fore.rotation.y, ty, w);
}
/** actor-local point (lx = to the actor's left, y up, lz forward) at pose a → world, in out */
function local(a, h, lx, y, lz, out) { const c = Math.cos(h), s = Math.sin(h); return out.set(a.x + lx * c + lz * s, y, a.z - lx * s + lz * c); }
const ease = (u) => u * u * (3 - 2 * u);
/** 0→1→0 over u with a plateau: in by `a`, out from `b` */
const hump = (u, a = 0.3, b = 0.7) => sm(0, a, u) * (1 - sm(b, 1, u));
const _sh = new THREE.Vector3();
/** metres by which a world point is beyond the comfortable reach of the arm on `side` (≤ 0: within reach); needs a current torso matrix */
function shortfall(ch, side, p) {
  const B = ch.bones, D = ch.dims;
  _sh.copy((side > 0 ? B.armL : B.armR).position).applyMatrix4(B.torso.matrixWorld);
  return Math.hypot(p.x - _sh.x, p.y - _sh.y, p.z - _sh.z) - (D.UA + D.FA + 0.06) * 0.97;
}
/** turn the shoulders towards the work (yawK) and bend at the waist just far enough that the targets R / L (world points or null) are within reach */
function settle(ch, R, wR, L, wL, yawK = 0.6) {
  const B = ch.bones, w = Math.max(R ? wR : 0, L ? wL : 0); if (!B || w <= 0) return;
  if (yawK) {
    const n = (R ? wR : 0) + (L ? wL : 0), g = ch.group, h = g.rotation.y;
    const dx = ((R ? R.x * wR : 0) + (L ? L.x * wL : 0)) / n - g.position.x, dz = ((R ? R.z * wR : 0) + (L ? L.z * wL : 0)) / n - g.position.z;
    const f = dx * Math.sin(h) + dz * Math.cos(h), l = dx * Math.cos(h) - dz * Math.sin(h);
    if (f > 0.12) { const yaw = clamp(Math.atan2(l, f) * yawK, -0.6, 0.6) * w; B.torso.rotation.y += yaw; B.head.rotation.y -= yaw * 0.7; }
  }
  let tot = 0;
  for (let it = 0; it < 6 && tot < 1.0; it++) {
    B.torso.updateWorldMatrix(true, false);
    const sf = Math.max(R ? shortfall(ch, -1, R) * wR : -1, L ? shortfall(ch, 1, L) * wL : -1);
    if (sf <= 0.001) break;
    const add = Math.min(1.0 - tot, sf * 2.4 + 0.01), hip = add * 0.42; tot += add;      // part at the waist, part hinging at the hips (the legs stay put)
    B.torso.rotation.x += add - hip; B.pelvis.rotation.x += hip; B.thighL.rotation.x -= hip; B.thighR.rotation.x -= hip; B.head.rotation.x -= add * 0.55;
  }
}
/** settle the body, then put the hands on their targets (weights 0..1) */
function hands(ch, R, wR, L, wL, yawK) {
  settle(ch, R, wR, L, wL, yawK);
  if (R && wR > 0) reach(ch, -1, R.x, R.y, R.z, wR);
  if (L && wL > 0) reach(ch, 1, L.x, L.y, L.z, wL);
}
// the baking tray: half its length (hands hold it this far either side of centre), its place on the oven shelf, and how
// far short of that it is let go (it glides the rest: the 'traySlide' cue)
const TRAY_HALF = 0.18, OVEN_TRAY_X = K.oven.x - 0.25, OVEN_TRAY_Y = 0.378, OVEN_PUSH = 0.045;
const GLIDE = 0.2;
function xget(B, o) {
  const a = B.armL.rotation, b = B.foreL.rotation, c = B.armR.rotation, d = B.foreR.rotation;
  o[0] = a.x; o[1] = a.y; o[2] = a.z; o[3] = b.x; o[4] = b.y; o[5] = c.x; o[6] = c.y; o[7] = c.z; o[8] = d.x; o[9] = d.y;
  o[10] = B.torso.rotation.x; o[11] = B.torso.rotation.y; o[12] = B.head.rotation.x; o[13] = B.rig.position.x; o[14] = B.rig.position.z;
  o[15] = B.pelvis.rotation.x; o[16] = B.thighL.rotation.x; o[17] = B.thighR.rotation.x;
}
function xset(B, o) {
  B.armL.rotation.set(o[0], o[1], o[2]); B.foreL.rotation.x = o[3]; B.foreL.rotation.y = o[4]; B.armR.rotation.set(o[5], o[6], o[7]); B.foreR.rotation.x = o[8]; B.foreR.rotation.y = o[9];
  B.torso.rotation.x = o[10]; B.torso.rotation.y = o[11]; B.head.rotation.x = o[12]; B.rig.position.x = o[13]; B.rig.position.z = o[14];
  B.pelvis.rotation.x = o[15]; B.thighL.rotation.x = o[16]; B.thighR.rotation.x = o[17];
}
const XFADE = 0.18;      // s: arms cross-fade from one gesture into the next instead of snapping

// ------------------------------------------------------------------------------------------------ scene
const WY = K.worktopY, TY = K.table.y + 0.02;
// the freezer is drawn and reached for in a frame in which it faces +z (K.freezerC), turned by K.freezerRot about the
// room's origin to where the cabinet really stands (plan: the tall fridge-freezer on the window wall)
const FZ = K.freezerC || K.freezer, FZ_Y0 = 0.1, FZ_Y1 = 0.85, FZ_W = FZ.x1 - FZ.x0 - 0.02;
const FZ_ROT = K.freezerRot || 0, FZ_C = Math.cos(FZ_ROT), FZ_S = Math.sin(FZ_ROT);
const fzX = (x, z) => x * FZ_C + z * FZ_S, fzZ = (x, z) => -x * FZ_S + z * FZ_C;
export class DippersScene {
  /** opts: { people, voices, taken(id), me() -> roster id the local player is playing (or null), startLocal() } */
  constructor(game, opts) {
    this.game = game; this.o = opts;
    this.root = null; this.attached = null;
    this.actors = {}; this.cur = null; this.prevT = -1; this.prevKey = null;
    this.st = {}; this.a = { visible: false, x: 0, z: 0, h: 0, pose: 'stand', speed: 0, seg: -1 };
    this.act = { name: null, u: 0, t0: 0, t1: 0 }; this.eat = { k: -1, u: 0, done: 0 };
    this.audio = new KitchenAudio(game);
    this.ate = null; this.greeted = null; this.lastSpeaker = null; this.reactT = 0;
    this.tmpV = new THREE.Vector3(); this.tmpV2 = new THREE.Vector3(); this.tR = new THREE.Vector3(); this.tL = new THREE.Vector3();
    this.steamClock = 0; this.clock = 0;
    this.trayHold = { on: false, grip: 0.06, w: 1, rest: new THREE.Vector3() };      // set by Miguel's gestures, read by _props
    this._xc = new Float32Array(18); this._pt = -9; this._cont = false;
    this._interactions();
    // (the kitchen's real door opens for the actors as it does for anyone: core/interiors.js reads game.walkers)
    this._walk = [];
    (game.walkers || (game.walkers = [])).push(() => { const w = this._walk; w.length = 0; if (this.game.player.place !== EARL_ID) return w; for (const r of ROLES) { const A = this.actors[r]; if (A && A.vis) w.push({ x: A.x, z: A.z, heading: A.h, speed: A.pose === 'stand' ? 1.2 : 0, place: EARL_ID }); } return w; });
  }

  // ---- interactions (registered once; enabled only while they make sense)
  _interactions() {
    const game = this.game, ia = game.interact;
    ia.add({ place: EARL_ID, pos: [K.table.x, K.table.z], radius: 1.9, label: 'Have a chicken dipper',
      enabled: () => !!this.cur && dipperOnTable(this.cur.t) && this.ate !== this.cur.key && this.cookPresent(),
      onUse: () => {
        this.ate = this.cur.key;
        const st = game.state; st.energy = clamp((Number.isFinite(st.energy) ? st.energy : 70) + 8, 0, 100); try { game.save && game.save(); } catch (e) { /* */ }
        game.ui.toast(`Golden, crispy, slightly too hot. Energy ${Math.round(st.energy)}/100.`, 3.5);
        const m = this.actors.miguel; if (m && m.ch.group.visible) this.sayOut('miguel', 'Go on, take one! There’s plenty.', 3);
      } });
    ia.add({ place: EARL_ID, pos: [K.ovenStand[0], K.ovenStand[1]], radius: 1.4, label: 'Cook chicken dippers',
      enabled: () => this.o.me() === 'miguel' && !(this.cur && this.cur.local),
      onUse: () => { this.o.startLocal(); game.ui.toast('Freezer, tray, oven. Twenty minutes (ish). Lorenzo will be here in a second.', 4); } });
    // (both halves of "…chhhhickin deepers? O Miguel!" are Miguel's line — DIPPERS_LINES.reply.who — so there is no
    //  player-Lorenzo reply prompt; Lorenzo answers without words: looks up at Miguel and waves, see update())
  }

  /** is someone actually cooking? (Miguel the NPC, or the local player as Miguel in a local session) */
  cookPresent() { return !!this.cur && (this.cur.local || !this.o.taken('miguel')); }

  // ---- build (once the Earl interior exists)
  _build(scene) {
    const root = (this.root = new THREE.Group()); root.name = 'friends:dippers';
    const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
    const m = (this.m = {
      bag: std({ map: bagTex(), roughness: 0.4 }), tray: std({ color: 0x3a3c40, metalness: 0.5, roughness: 0.45 }),
      raw: std({ color: 0xe6d0a4, roughness: 0.8 }), cooked: std({ color: 0xcf8a2e, roughness: 0.75 }),
      plate: std({ color: 0xf8f8f4, roughness: 0.3 }), ketchup: std({ color: 0xb01818, roughness: 0.35 }), cap: std({ color: 0xf4f4f0, roughness: 0.4 }),
      glove: std({ map: gloveTex(), roughness: 0.95, side: THREE.DoubleSide }), white: std({ color: 0xf4f4f2, roughness: 0.4 }), dark: std({ color: 0x1c2026, roughness: 0.6 }),
      frost: std({ color: 0xdfeaf2, roughness: 0.3, transparent: true, opacity: 0.8 }), steel: std({ color: 0xb8bcc2, metalness: 0.6, roughness: 0.35 }),
      glass: std({ color: 0xdcecf2, roughness: 0.1, transparent: true, opacity: 0.38 }), water: std({ color: 0xf0a030, roughness: 0.2, transparent: true, opacity: 0.8 }),
      screen: std({ color: 0x0c0c10, roughness: 0.3, emissive: 0x7ab0e8, emissiveIntensity: 0.9 }),
    });
    const add = (o, p = root) => { p.add(o); return o; };
    const box = (w, h, d, mat, x = 0, y = 0, z = 0, p = root) => { const o = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), p); o.position.set(x, y, z); return o; };
    // freezer: the lower door on its hinge (west edge), with the drawers behind it (the room draws the cabinet)
    const fzRoot = add(new THREE.Group()); fzRoot.rotation.y = FZ_ROT;
    const fz = (this.fz = add(new THREE.Group(), fzRoot)); fz.position.set(FZ.x0 + 0.01, FZ_Y0, FZ.z1 + 0.018);
    const fdoor = new THREE.BoxGeometry(FZ_W, FZ_Y1 - FZ_Y0, 0.03); fdoor.translate(FZ_W / 2, (FZ_Y1 - FZ_Y0) / 2, 0.015);
    add(new THREE.Mesh(fdoor, m.white), fz); box(0.025, 0.3, 0.025, m.steel, FZ_W - 0.06, 0.5, 0.045, fz);
    const drawers = [new THREE.BoxGeometry(FZ_W, FZ_Y1 - FZ_Y0, 0.004)];
    drawers[0].translate(FZ.x0 + 0.01 + FZ_W / 2, (FZ_Y0 + FZ_Y1) / 2, FZ.z1 + 0.004);
    box(FZ_W, FZ_Y1 - FZ_Y0, 0.004, m.dark, FZ.x0 + 0.01 + FZ_W / 2, (FZ_Y0 + FZ_Y1) / 2, FZ.z1 + 0.003, fzRoot);
    for (let i = 0; i < 3; i++) box(FZ_W - 0.05, 0.2, 0.012, m.frost, FZ.x0 + 0.01 + FZ_W / 2, FZ_Y0 + 0.13 + i * 0.245, FZ.z1 + 0.011, fzRoot);
    this.drawer = box(FZ_W - 0.05, 0.2, 0.3, m.frost, FZ.x0 + 0.01 + FZ_W / 2, FZ_Y0 + 0.13 + 0.245, FZ.z1 - 0.14, fzRoot);   // the middle drawer slides out
    this.bag = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.27, 0.045), m.bag)); this.bag.rotation.order = 'YXZ';
    // tray (base + rim merged) with 14 dippers
    const parts = [new THREE.BoxGeometry(0.4, 0.008, 0.3)];
    for (const [x, z, w, d] of [[0, 0.146, 0.4, 0.008], [0, -0.146, 0.4, 0.008], [0.196, 0, 0.008, 0.3], [-0.196, 0, 0.008, 0.3]]) { const g = new THREE.BoxGeometry(w, 0.022, d); g.translate(x, 0.011, z); parts.push(g); }
    this.tray = add(new THREE.Group());
    add(new THREE.Mesh(mergeGeometries(parts), m.tray), this.tray);
    // a dipper: a flattened, slightly lumpy nugget
    const dip = new THREE.SphereGeometry(1, 7, 5); { const pa = dip.attributes.position; for (let i = 0; i < pa.count; i++) { const k = 1 + 0.12 * Math.sin(i * 12.9898) * Math.cos(i * 4.1); pa.setXYZ(i, pa.getX(i) * k, pa.getY(i), pa.getZ(i) * k); } dip.computeVertexNormals(); }
    this.M4 = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.V = new THREE.Vector3(); this.Sc = new THREE.Vector3(0.04, 0.013, 0.027); this.Y = new THREE.Vector3(0, 1, 0);
    const M4 = this.M4, Q = this.Q, V = this.V, Sc = this.Sc, Y = this.Y;
    this.trayDips = add(new THREE.InstancedMesh(dip, m.raw, 14), this.tray);
    this.traySlot = (i, out) => out.set(-0.15 + (i % 7) * 0.05 + 0.008 * Math.sin(i * 5.1), 0.016, (i < 7 ? -0.065 : 0.065) + 0.012 * Math.sin(i * 3.3));
    for (let i = 0; i < 14; i++) { this.traySlot(i, V); Q.setFromAxisAngle(Y, 0.5 * Math.sin(i * 2.3)); this.trayDips.setMatrixAt(i, M4.compose(V, Q, Sc)); }
    // two plates, 7 dippers each, a dollop of ketchup
    const plateG = new THREE.CylinderGeometry(0.12, 0.09, 0.014, 20), dollopG = new THREE.SphereGeometry(1, 10, 6);
    this.plates = [0, 1].map(() => {
      const g = add(new THREE.Group());
      add(new THREE.Mesh(plateG, m.plate), g).position.y = 0.007;
      const ins = add(new THREE.InstancedMesh(dip, m.cooked, 7), g);
      for (let i = 0; i < 7; i++) { const a = i * 0.9; V.set(Math.cos(a) * (0.03 + 0.012 * i), 0.02 + (i > 4 ? 0.012 : 0), Math.sin(a) * (0.03 + 0.012 * i) - 0.015); Q.setFromAxisAngle(Y, a * 1.7); ins.setMatrixAt(i, M4.compose(V, Q, Sc)); }
      const dl = add(new THREE.Mesh(dollopG, m.ketchup), g); dl.position.set(0.06, 0.016, 0.05);
      return { g, ins, dl };
    });
    // loose dippers in people's fingers (Miguel, Lorenzo, the guest)
    this.loose = [0, 1, 2].map(() => { const d = add(new THREE.Mesh(dip, m.cooked)); d.rotation.order = 'YXZ'; d.visible = false; return d; });
    // ketchup bottle (body + cap) with its squirt, oven mitts, fish slice, glasses, phone
    this.ketchup = add(new THREE.Group()); this.ketchup.rotation.order = 'YXZ';
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.17, 12), m.ketchup), this.ketchup).position.y = 0.085;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, 0.04, 10), m.cap), this.ketchup).position.y = 0.19;
    this.squirt = add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 1, 5), m.ketchup)); this.squirt.visible = false;
    // an oven mitt in the hand anchor's frame (fingers along −y, thumb forward): padded pocket, thumb, cuff over the wrist
    const pocket = new THREE.SphereGeometry(1, 10, 7); pocket.scale(0.036, 0.094, 0.062); pocket.translate(0, -0.03, 0.008);
    const thumb = new THREE.SphereGeometry(1, 7, 5); thumb.scale(0.022, 0.044, 0.024); thumb.rotateX(0.75); thumb.translate(0, -0.012, 0.064);
    const cuff = new THREE.CylinderGeometry(0.052, 0.046, 0.07, 10, 1, true); cuff.scale(0.82, 1, 1.05); cuff.translate(0, 0.078, 0.004);
    const gl = mergeGeometries([pocket, thumb, cuff]);
    this.mitts = [0, 1].map(() => add(new THREE.Mesh(gl, m.glove)));
    this.glove = this.mitts[0];
    this.spatula = add(new THREE.Group()); box(0.012, 0.012, 0.2, m.dark, 0, 0, -0.1, this.spatula); box(0.07, 0.004, 0.09, m.steel, 0, -0.004, 0.045, this.spatula);
    const glassG = new THREE.CylinderGeometry(0.034, 0.028, 0.12, 12, 1, true), waterG = new THREE.CylinderGeometry(0.031, 0.027, 1, 12);
    this.glasses = [0, 1].map(() => { const g = add(new THREE.Group()); const c = add(new THREE.Mesh(glassG, m.glass), g); c.position.y = 0.06; c.material.side = THREE.DoubleSide; const w = add(new THREE.Mesh(waterG, m.water), g); return { g, w }; });
    this.phone = add(new THREE.Group()); box(0.066, 0.008, 0.13, m.dark, 0, 0, 0, this.phone); box(0.058, 0.002, 0.11, m.screen, 0, 0.005, 0, this.phone); this.phone.rotation.order = 'YXZ';
    // steam wisps (oven vent, then the hot tray)
    const sm2 = new THREE.SpriteMaterial({ map: steamTex(), transparent: true, depthWrite: false, opacity: 0 });
    this.steam = []; for (let i = 0; i < 7; i++) { const s = add(new THREE.Sprite(sm2.clone())); s.visible = false; this.steam.push(s); }
    root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    scene.add(root); this.attached = scene;
  }
  _actor(role, id) {
    let A = this.actors[role];
    if (A && A.id === id) return A;
    if (A) { this.attached.remove(A.ch.group); A.ch.dispose(); }
    const P = this.o.people[id];
    const ch = createCharacter(lookFor(id)); ch.setLabel(P.label); ch.group.visible = false; ch.lookAtPlayer = false;      // (the scene directs their heads)
    this.attached.add(ch.group);
    A = this.actors[role] = { role, id, ch, h: 0, x: 0, z: 0, vis: false, act: null, u: 0, pose: 'stand', gk: '', xL: 0, xR: 0, lastT: -9, fr: new Float32Array(18), last: new Float32Array(18), tg: { L: [0, 0, 0, 0], R: [0, 0, 0, 0] }, pg: { L: [0, 0, 0, 0, 0, 0, 0], R: [0, 0, 0, 0, 0, 0, 0] } };
    return A;
  }

  // ---- speech
  say(role, text, secs, priority) {
    const A = this.actors[role]; if (!A || !A.ch.group.visible) return false;
    A.ch.say(text, Math.max(secs, ((this.o.voices && this.o.voices.duration && this.o.voices.duration(A.id, text)) || 0) + 0.6));
    this.lastSpeaker = role;
    const p = this.game.player.pos, g = A.ch.group.position;
    this.o.voices && this.o.voices.say(A.id, text, Math.hypot(p.x - g.x, p.z - g.z), priority, { pos: g, ch: A.ch });
    return true;
  }
  /** a line one player set off (walking in, taking a dipper): said here, and told to the other players (opts.tell: friends.js sends it; they call say()) */
  sayOut(role, text, secs) { if (this.say(role, text, secs, true) && this.o.tell) this.o.tell(role, text, secs); }
  sayPlayer(id, text, secs) { const c = this.game.player.character; if (c) c.say(text, secs); this.o.voices && this.o.voices.say(id, text, 0, true); }

  /** cur = { t, s (session or null), key, local } or null; called every frame by friends.js */
  update(dt, cur) {
    const game = this.game, inEarl = game.player.place === EARL_ID;
    this.cur = cur;
    if (!inEarl) { this.audio.silence(); this.prevT = -1; return; }
    const def = game.interiors.get(EARL_ID); if (!def || !def.scene) return;
    if (this.attached !== def.scene) { try { this._build(def.scene); } catch (e) { console.warn('[friends] dippers build', e); this.attached = def.scene; return; } }
    if (!this.root) return;
    const R = game.worcint && game.worcint.rooms && game.worcint.rooms.earl && game.worcint.rooms.earl.R;
    const me = this.o.me();
    const t = cur ? cur.t : -1, s = cur ? cur.s : null;
    const cooking = !!cur && this.cookPresent();
    const st = cooking ? propsAt(t, this.st, s) : null;
    this.clock += dt;
    this._cont = !!cur && Math.abs(t - this._pt) < 0.25; this._pt = t;
    // ---- actors
    const pl = game.player.pos;
    // Lorenzo's wordless reply runs for 2.6 s from REPLY_T (a function of the shared session time, like everything here)
    this.reactT = cooking && t >= REPLY_T && t < REPLY_T + 2.6 ? REPLY_T + 2.6 - t : 0;
    for (const role of ROLES) {
      const id = role === 'guest' ? (s && s.guest) : role;
      if (!id) { if (this.actors[role]) { this.actors[role].ch.group.visible = false; this.actors[role].vis = false; } continue; }
      const A = this._actor(role, id), ch = A.ch, g = ch.group;
      const ta = role === 'lorenzo' && cur && cur.lorenzoSeated ? Math.max(t, 4.4) : t;
      const a = cur ? actorAt(role, ta, this.a, s && s.alarm) : null;
      // Miguel only appears when he is the one cooking (not when a player is Miguel)
      const vis = !!a && a.visible && !this.o.taken(id) && (role !== 'miguel' || !cur.local);
      g.visible = vis; A.vis = vis;
      if (!vis) continue;
      g.position.set(a.x, 0, a.z);
      let h = a.h;
      if (role === 'miguel' && a.pose === 'talk' && me === 'lorenzo') h = Math.atan2(pl.x - a.x, pl.z - a.z);   // the offer goes to the player-Lorenzo
      let dh = h - g.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      g.rotation.y += dh * Math.min(1, dt * 6.5);
      if (ch.pose !== a.pose && !(ch.pose === 'wave' && ch.poseDur)) ch.setPose(a.pose);
      A.x = a.x; A.z = a.z; A.h = g.rotation.y; A.pose = a.pose;
      // seated people look at whoever spoke last
      let yaw = 0;
      const S = this.lastSpeaker && this.actors[this.lastSpeaker];
      if (a.pose === 'sit' && S && S !== A && S.ch.group.visible) { const sp = S.ch.group.position, w = Math.atan2(sp.x - a.x, sp.z - a.z) - g.rotation.y; yaw = clamp(Math.atan2(Math.sin(w), Math.cos(w)), -1.2, 1.2); }
      // Lorenzo's non-verbal answer to the offer: looks up at Miguel, grins and waves (seated, so the wave is layered on)
      const react = role === 'lorenzo' && this.reactT > 0 && me !== 'lorenzo';
      if (react) { const M = this.actors.miguel; if (M && M.ch.group.visible) { const mp = M.ch.group.position, w = Math.atan2(mp.x - a.x, mp.z - a.z) - g.rotation.y; yaw = clamp(Math.atan2(Math.sin(w), Math.cos(w)), -1.2, 1.2); } }
      const ac = actAt(role, ta, s, this.act); A.act = ac.name; A.u = ac.u;
      if (role === 'miguel' && ac.name === 'what') { const L = this.actors.lorenzo; if (L && L.vis) { const w = Math.atan2(L.x - a.x, L.z - a.z) - g.rotation.y; yaw = clamp(Math.atan2(Math.sin(w), Math.cos(w)), -1.2, 1.2); } }
      ch.headTurn(yaw);
      ch.mouth = 0;
      ch.update(dt, a.speed);
      g.updateMatrixWorld(true);
      if (react && ch.bones) {
        const B = ch.bones, k = Math.min(1, this.reactT / 0.4, (2.6 - this.reactT) / 0.3 + 0.0001), wv = Math.sin(this.reactT * 9);
        B.armR.rotation.set(-0.25 * k + B.armR.rotation.x * (1 - k), 0, -2.45 * k + B.armR.rotation.z * (1 - k));
        B.foreR.rotation.set(-(0.55 + 0.45 * wv) * k + B.foreR.rotation.x * (1 - k), 1.4 * k, 0);
        B.head.rotation.x -= 0.22 * k;                // chin up: looking up at Miguel
      } else if (cooking) { _tgt = A.tg; this._gesture(role, A, ta, st); }
      _tgt = null; this._xfade(A, dt, ta, react ? 'react' : cooking ? (A.act || '') + (a.pose === 'sit' && st.plates === 'table' ? '+eat' : '') : '');
    }

    // ---- lines + sound cues (fire when t passes them; never replayed after a jump)
    if (cur) {
      if (cur.key !== this.prevKey || t < this.prevT || t - this.prevT > 3) { this.prevT = cur.debug ? t - 0.5 : t; this.prevKey = cur.key; }
      for (const L of SCENE_LINES) {
        if (!(L[0] > this.prevT && L[0] <= t)) continue;
        if (!cooking) continue;
        const text = lineText(L, s); if (!text) continue;
        const secs = cur.debug ? 40 : L[3], pri = L[0] === OFFER_T || L[0] === REPLY_T || L[5] === 'pri';
        if (L[1] === 'miguel' && cur.local && me === 'miguel') this.sayPlayer('miguel', text, secs);
        else this.say(L[1], text, secs, pri);
      }
      if (cooking && !cur.debug) for (const c of CUES) if (c[0] > this.prevT && c[0] <= t) this.audio.cue(c[1]);
      if (!cooking && this.prevT < 20 && t >= 20) this.say('lorenzo', 'Miguel? Are we cooking or not?', 3, false);
      // greet the player once per session when they come into the kitchen
      if (cooking && this.greeted !== cur.key && (K.inKitchen ? K.inKitchen(pl.x, pl.z) : pl.x < KIT.x1) && me !== 'miguel') {
        this.greeted = cur.key;
        const nm = game.player.name || 'you';
        if (t > 21.5 && t < 46) this.sayOut('miguel', `Olá ${nm}! Dippers are in the oven. Stick around.`, 3.5);
        else if (t >= 66.6 && t < 100) this.sayOut('miguel', `${nm}! Have a chicken dipper, there’s loads.`, 3.5);
      }
      this.prevT = t;
    }
    // ---- props
    this._props(dt, st, R, t);
    // ---- audio: level by distance to the oven
    const d = Math.hypot(pl.x - K.ovenStand[0], pl.z - K.ovenStand[1]);
    const alarm = !!(st && s && s.alarm && t >= 49.5 && t < 55);
    this.audio.update(dt, clamp(1 - (d - 2) / 14, 0, 1), st, alarm);
  }

  // ---- gestures: arm reaches / small body tweaks layered on the pose (see ACTS in _friends_logic.js)
  // Order matters: body tweaks (lean, twist) first, then hands() — it turns and bends the torso as far as the targets
  // need and only then solves the arms, so a hand ends ON its target instead of a lean's worth away from it.
  _gesture(role, A, t, st) {
    const ch = A.ch, B = ch.bones; if (!B) return;
    const G = A.act, u = A.u, h = A.h, R = this.tR, L = this.tL, c = this.clock;
    const fx = Math.sin(h), fz = Math.cos(h);                                    // forward; left = (fz, −fx)
    const lean = (x) => { B.torso.rotation.x += x; B.head.rotation.x -= x * 0.5; };
    const RH = (w = 1) => hands(ch, R, w, null, 0), LH = (w = 1) => hands(ch, null, 0, L, w), both = (wR = 1, wL = wR) => hands(ch, R, wR, L, wL);
    const pair = (lx, y, lz, gap) => { local(A, h, lx - gap, y, lz, R); local(A, h, lx + gap, y, lz, L); };      // both hands, actor-local
    const mix = (v, x, y, z, k) => v.set(lerp(v.x, x, k), lerp(v.y, y, k), lerp(v.z, z, k));
    // eating at the table (Miguel, Lorenzo): right hand plate → ketchup → mouth, chewing between bites; left hand rests on the table
    if (A.pose === 'sit' && (role === 'miguel' || role === 'lorenzo') && st.plates === 'table') {
      const P = TABLE_PLATES[role === 'miguel' ? 0 : 1], e = eatAt(role, t, this.eat), d = this.loose[role === 'miguel' ? 0 : 1];
      const insp = G === 'inspect';
      if (G === 'what') { const k = hump(u, 0.15, 0.8); pair(0, TY + 0.22, 0.34, 0.3); both(k); B.head.rotation.z += 0.12 * k * Math.sin(u * 14); ch.mouth = 0; d.visible = false; return; }      // "row?!": hands out, shakes his head
      if (G === 'carryPlates') { const k = 1 - sm(104.85, 105.3, t); local(A, h, -0.21, 1.0, 0.3, R); mix(R, P[0] - fx * 0.07, TY + 0.012, P[1] - fz * 0.07, k); local(A, h, 0.17, TY + 0.04, 0.34, L); both(1, 0.85); d.visible = false; return; }      // clearing up: a hand to his plate
      if (G === 'ketchupDown') {      // the bottle off his plate (it rode there) and into the middle of the table
        const q = SPOT.tableKetchup, k = ease(clamp((u - 0.25) / 0.55, 0, 1));
        R.set(lerp(P[0], q[0], k) - fx * 0.02, TY + 0.1 + 0.014 * (1 - k) + 0.05 * Math.sin(Math.PI * k), lerp(P[1] - 0.05, q[1], k) - fz * 0.02);
        local(A, h, 0.17, TY + 0.04, 0.34, L); both(1, 0.85); d.visible = false; return;
      }
      local(A, h, 0.17, TY + 0.04, 0.34, L);
      if (e.k >= 0 || insp) {
        const px = P[0], py = TY + 0.05, pz = P[1], kx = P[0] + 0.06, kz = P[1] + 0.05, v = e.u;
        // 0–.14 reach the plate · .14–.28 dip · .28–.4 up to the mouth · .4–.46 bite · .46–.66 chew (hand low) · .66–.74 back up · .74–.8 bite · .8–1 chew
        let vis = v > 0.12, half = v > 0.44, gone = v > 0.78, chew = 0;
        const aim = () => {
          B.head.getWorldPosition(_hp); const mx = _hp.x + fx * 0.13, my = _hp.y + ch.dims.headC - 0.075, mz = _hp.z + fz * 0.13;
          if (insp) { const k = hump(u, 0.2, 0.9); R.set(lerp(px, mx + fx * 0.16, k), lerp(py, my + 0.06, k), lerp(pz, mz + fz * 0.16, k)); }
          else if (v < 0.14) { local(A, h, -0.2, TY + 0.1, 0.3, R); mix(R, px, py, pz, ease(v / 0.14)); }
          else if (v < 0.28) { const k = ease((v - 0.14) / 0.14); R.set(lerp(px, kx, k), py + 0.05 * Math.sin(Math.PI * k), lerp(pz, kz, k)); }
          else if (v < 0.46) { R.set(kx, py, kz); mix(R, mx, my, mz, ease(Math.min(1, (v - 0.28) / 0.12))); }
          else if (v < 0.66) { local(A, h, -0.16, TY + 0.14, 0.32, R); const k = 1 - ease(Math.min(1, (v - 0.46) / 0.06)); mix(R, mx, my, mz, k); }
          else if (v < 0.8) { local(A, h, -0.16, TY + 0.14, 0.32, R); mix(R, mx, my, mz, ease(Math.min(1, (v - 0.66) / 0.08))); }
          else { local(A, h, -0.2, TY + 0.06, 0.3, R); const k = 1 - ease(Math.min(1, (v - 0.8) / 0.08)); mix(R, mx, my, mz, k); }
        };
        if (insp) { const k = hump(u, 0.2, 0.9); vis = true; half = false; gone = false; B.head.rotation.x += 0.12 * k; B.head.rotation.z += 0.16 * k * Math.sin(u * 9); }
        else if (v >= 0.46 && (v < 0.66 || v >= 0.8)) chew = 1;
        if (v > 0.3 && v < 0.46 && !insp) B.head.rotation.x += 0.1;
        aim(); settle(ch, R, 1, L, 0.85); aim();                                  // (the mouth moves with the lean: aim again once the torso has settled)
        reach(ch, -1, R.x, R.y, R.z, 1); reach(ch, 1, L.x, L.y, L.z, 0.85);
        if (!insp && ((v > 0.4 && v < 0.46) || (v > 0.74 && v < 0.8))) ch.mouth = 1;                    // the bite
        else if (chew && !ch.saying) ch.mouth = 0.25 + 0.3 * Math.abs(Math.sin(c * 7.5));               // chewing
        d.visible = vis && !gone; if (d.visible) { ch.anchors.handR.getWorldPosition(_w); d.position.set(_w.x + fx * 0.03, _w.y - 0.012, _w.z + fz * 0.03); d.rotation.set(0.5, h + 0.4, 0); d.scale.set(half ? 0.024 : 0.04, 0.013, 0.027); }
      } else { d.visible = false; local(A, h, -0.2, TY + 0.05, 0.3, R); both(0.85); }
      return;
    }
    if (role === 'guest') {
      const d = this.loose[2], P = TABLE_PLATES[1];
      // leans right across the table to Lorenzo's plate: slides forward on the chair, folds at the waist, arm out
      const across = (k) => { B.rig.position.x += fx * 0.2 * k; B.rig.position.z += fz * 0.2 * k; lean(0.3 * k); };
      const pick = (v) => { const dx = A.x - P[0], dz = A.z - P[1], l = Math.hypot(dx, dz) || 1; v.set(P[0] + dx / l * 0.07, TY + 0.055, P[1] + dz / l * 0.07); };   // the dipper nearest him
      if (G === 'sniff') { B.head.rotation.x -= 0.25 * hump(u); }
      else if (G === 'pinch') { const k = ease(Math.min(1, u / 0.85)); across(k); local(A, h, -0.2, TY + 0.1, 0.3, R); pick(L); mix(R, L.x, L.y, L.z, k); RH(); }
      else if (G === 'pinchEat') {
        const k = sm(0, 0.3, u); across(1 - k);
        B.head.getWorldPosition(_hp); pick(R); mix(R, _hp.x + fx * 0.13, _hp.y + ch.dims.headC - 0.075, _hp.z + fz * 0.13, k);
        RH(1 - sm(0.8, 1, u));
        if (u > 0.3 && u < 0.4) ch.mouth = 1; else if (u > 0.4 && !ch.saying) ch.mouth = 0.25 + 0.3 * Math.abs(Math.sin(c * 7.5));
        d.visible = u < 0.36; if (d.visible) { ch.anchors.handR.getWorldPosition(_w); d.position.set(_w.x, _w.y - 0.012, _w.z); d.rotation.set(0.5, h, 0); d.scale.copy(this.Sc); }
        return;
      }
      d.visible = false;
      return;
    }
    if (!G) return;
    if (role === 'lorenzo') {
      switch (G) {
        case 'hover': { const k = hump(u, 0.12, 0.9); lean(0.16 * k * (0.6 + 0.4 * Math.sin(c * 0.9))); B.head.rotation.x += 0.12 * k; pair(0, 0.98, 0.02, 0.22); hands(ch, R, k, L, k, 0); break; }   // hands on hips, craning to see
        case 'glassTake': {      // a glass in each hand off the drainer (they are in his hands from u = 1/3)
          const q = SPOT.drainer, k = ease(Math.min(1, u / 0.3)), up = sm(0.45, 1, u);
          pair(0, 1.0, 0.3, 0.13);
          mix(R, lerp(q[0][0] - fx * 0.03, R.x, up), lerp(WY + 0.075, R.y, up), lerp(q[0][1] - fz * 0.03, R.z, up), k);
          mix(L, lerp(q[1][0] - fx * 0.03, L.x, up), lerp(WY + 0.075, L.y, up), lerp(q[1][1] - fz * 0.03, L.z, up), k);
          both(); break;
        }
        case 'fill': {           // one glass under the tap, then the other
          const q = SPOT.tap, s2 = sm(0.42, 0.58, u), a = sm(0, 0.15, u);
          pair(0, 1.0, 0.3, 0.13);
          // (his left is −fx along z: the sink may be on either wall)
          mix(R, q[0] - fx * 0.03, WY + 0.15, q[1] + fx * 0.15 * s2, a);
          mix(L, q[0] - fx * 0.03, WY + 0.15, q[1] - fx * 0.15 * (1 - s2), a);
          both(); break;
        }
        case 'carryGlasses': pair(0, 1.0, 0.3, 0.13); both(); break;
        case 'setGlasses': {     // Miguel's glass down (right hand), then his own
          const q = SPOT.glasses, kR = ease(clamp(u / 0.42, 0, 1)), kL = ease(clamp((u - 0.36) / 0.4, 0, 1));
          pair(0, 1.0, 0.3, 0.13);
          mix(R, q[0][0] - fx * 0.03, TY + 0.065, q[0][1] - fz * 0.03, kR); mix(L, q[1][0] - fx * 0.03, TY + 0.065, q[1][1] - fz * 0.03, kL);
          both(1 - sm(0.5, 0.75, u), 1 - sm(0.82, 1, u)); break;
        }
      }
      return;
    }
    // ---- Miguel
    const fzA = st.freezer * 1.3, fr = FZ_W - 0.06, fhx = FZ.x0 + 0.01 + fr * Math.cos(fzA) - 0.07 * Math.sin(fzA), fhz = FZ.z1 + 0.018 + fr * Math.sin(fzA) + 0.07 * Math.cos(fzA);
    const ovY = K.oven.y0 + (K.oven.y1 - K.oven.y0 - 0.04) * Math.cos(st.door * 1.5), ovX = K.oven.x + 0.05 + (K.oven.y1 - K.oven.y0 - 0.04) * Math.sin(st.door * 1.5);
    // the tray: carried by its near corners / sides; the tray itself hangs off the LEFT hand (see _props), `grip` forward of it
    const T = this.trayHold; T.on = false;
    const carryY = t < 30 ? lerp(1.0, 0.6, sm(17.7, 18.4, t)) : lerp(0.6, 1.0, sm(51.15, 51.6, t));
    const trayAt = (x, y, z, k) => { mix(R, x + 0.15, y + 0.02, z - TRAY_HALF, k); mix(L, x + 0.15, y + 0.02, z + TRAY_HALF, k); };      // hands on the near corners of the tray lying at (x, y, z) in the units' frame (he faces west)
    const hold = (grip, w = 1, rest = null) => { T.on = true; T.grip = grip; T.w = w; if (rest) T.rest.set(rest[0], rest[1], rest[2]); };
    const ovenRest = [OVEN_TRAY_X, OVEN_TRAY_Y, K.oven.z], hobRest = [SPOT.tray[0], WY + 0.012, SPOT.tray[1]], sideRest = [SPOT.traySide[0], WY + 0.012, SPOT.traySide[1]];
    switch (G) {
      case 'fzOpen': L.set(fzX(fhx, fhz), FZ_Y0 + 0.5, fzZ(fhx, fhz)); LH(sm(0, 0.2, u)); break;
      case 'fzReach': { const k = hump(u, 0.35, 0.6); L.set(fzX(fhx, fhz), FZ_Y0 + 0.5, fzZ(fhx, fhz)); { const rz = lerp(FZ.z1 + 0.25, FZ.z1 - 0.08, k); R.set(fzX(FZ.x0 + 0.3, rz), FZ_Y0 + 0.42, fzZ(FZ.x0 + 0.3, rz)); } both(); break; }
      case 'fzClose': L.set(fzX(fhx, fhz), FZ_Y0 + 0.5, fzZ(fhx, fhz)); local(A, h, -0.2, 0.72, 0.3, R); both(1, 1 - sm(0.75, 1, u)); break;
      case 'holdBag': {
        const off = sm(7.8, 8.4, t) * (1 - sm(10.6, 11.4, t)), walk = sm(12.0, 12.4, t);     // held up and waggled at Lorenzo during the offer
        local(A, h, -0.2 + 0.04 * off, lerp(lerp(1.02, 1.36 + 0.03 * Math.sin(c * 9), off), 0.95, walk), lerp(0.32, 0.22, walk), R); RH(); break;
      }
      case 'shake': { const q = SPOT.tray, j = 0.03 * Math.sin(c * 21), k = sm(0, 0.1, u); B.head.rotation.x += 0.2 * k; R.set(q[0] + 0.02, WY + 0.34 + j, q[1] - 0.09); L.set(q[0] + 0.02, WY + 0.3 - j, q[1] + 0.09); both(k); break; }
      case 'bagDown': {          // left hand drops the bag beside the hob; the right is already going for the tray
        const q = SPOT.bag, k = ease(Math.min(1, u / 0.72));
        L.set(SPOT.tray[0] + 0.02, WY + 0.3, SPOT.tray[1] + 0.09); mix(L, q[0] + 0.12, WY + 0.12, q[1] - 0.04, k);
        R.set(SPOT.tray[0] + 0.02, WY + 0.34, SPOT.tray[1] - 0.09); mix(R, hobRest[0] + 0.15, hobRest[1] + 0.02, hobRest[2] - TRAY_HALF, ease(Math.min(1, u / 0.8)));
        both(); break;
      }
      case 'carryTray': {
        if (t < 30) {            // off the hob, a step back, down to the oven
          const pick = sm(0.12, 0.72, u);
          pair(0, carryY + 0.02, 0.3, TRAY_HALF); trayAt(hobRest[0], hobRest[1], hobRest[2], 1 - pick);
          hold(lerp(0.15, 0.06, pick), sm(0.02, 0.14, u), hobRest);
        } else {                 // out of the oven (mitts on), up, across to the worktop
          const pull = sm(0, 0.22, u);
          pair(0, carryY + 0.02, 0.3, TRAY_HALF); trayAt(ovenRest[0] + 0.05, ovenRest[1], ovenRest[2], 1 - pull);
          hold(lerp(0.15, 0.06, sm(0.1, 0.3, u)));
        }
        both(); break;
      }
      case 'ovOpen':
        R.set(ovX, ovY, K.oven.z - 0.12);
        if (t < 30) { local(A, h, TRAY_HALF, carryY + 0.02, 0.3, L); hold(0.06); both(); }      // the tray balanced on the left hand while the right opens the door
        else { local(A, h, 0.16, 0.5, 0.26, L); hands(ch, R, 1, L, 1, 0); }                    // (left hand on his knee)
        break;
      case 'trayIn': {           // both hands slide it onto the shelf; it is let go at the 'traySlide' cue and glides home
        const k = ease(clamp((u - 0.08) / 0.5, 0, 1)), o2 = 1 - sm(0.66, 0.92, u);
        pair(0, carryY + 0.02, 0.3, TRAY_HALF); trayAt(OVEN_TRAY_X + OVEN_PUSH, OVEN_TRAY_Y, K.oven.z, k);
        hold(lerp(0.06, 0.15, sm(0, 0.3, u))); both(o2); break;
      }
      case 'ovClose': R.set(ovX, ovY, K.oven.z - 0.12); RH(1 - sm(0.8, 1, u)); break;
      case 'trayGrab': {         // mitted hands in to the tray's near corners, then the first few cm out
        const k = ease(Math.min(1, u / 0.7));
        pair(0, 0.62, 0.3, TRAY_HALF); trayAt(ovenRest[0] + 0.05 * sm(0.875, 1, u), ovenRest[1], ovenRest[2], k);
        hold(0.15, 1, ovenRest); both(); break;
      }
      case 'trayDown': {         // down beside the plates; hands away once it has landed (the 'trayDown' cue)
        const k = ease(Math.min(1, u / 0.72));
        pair(0, 1.02, 0.3, TRAY_HALF); trayAt(sideRest[0], sideRest[1], sideRest[2], k);
        hold(lerp(0.06, 0.15, k)); both(1 - sm(0.76, 1, u)); break;
      }
      case 'timer': { const q = SPOT.timer, k = hump(u, 0.35, 0.7); R.set(q[0] + 0.02, q[1], q[2]); RH(k); break; }
      case 'phone': { const k = hump(u, 0.08, 0.93); B.head.rotation.x += 0.3 * k; B.head.rotation.y *= 1 - k; local(A, h, -0.1, 1.24, 0.3, R); R.y += 0.004 * Math.sin(c * 6); hands(ch, R, k, null, 0, 0); break; }
      case 'peek': { const k = hump(u, 0.2, 0.85); B.torso.rotation.x += 0.18 * k; B.head.rotation.x += 0.1 * k; B.head.rotation.z += 0.12 * k * Math.sin(u * 7); pair(0, 0.5, 0.26, 0.16); both(k); break; }      // hands on his knees
      case 'wait': { const k = hump(u, 0.15, 0.85); local(A, h, 0.1, 1.12, 0.2, R); local(A, h, -0.1, 1.08, 0.2, L); hands(ch, R, k, L, k, 0); break; }      // arms folded
      case 'mittsOn': {          // a hand into each mitt where they lie by the hob, then a tug to seat them
        const q = SPOT.mitts, k = ease(Math.min(1, u / 0.3)), k2 = sm(0.5, 0.7, u), o2 = 1 - sm(0.9, 1, u);
        pair(0, 1.1, 0.3, 0.07);
        mix(R, lerp(q[0] + 0.03, R.x, k2), lerp(WY + 0.07, R.y, k2), lerp(q[1], R.z, k2), 1); mix(L, lerp(q[0] + 0.06, L.x, k2), lerp(WY + 0.12, L.y, k2), lerp(q[1] + 0.05, L.z, k2), 1);
        both(k * o2); break;
      }
      case 'mittsOff': {         // both mitts off onto the worktop in front of him
        const q = SPOT.mittsAfter, k = hump(u, 0.4, 0.7);
        R.set(q[0] + 0.02, WY + 0.075, q[1] - 0.02); L.set(q[0] + 0.05, WY + 0.125, q[1] + 0.05); both(k); break;
      }
      case 'cupboard': {         // two plates down from the wall cupboard
        const q = SPOT.cupboard, k = sm(0, 0.36, u), dn = sm(0.42, 0.78, u), p = SPOT.plates;
        R.set(lerp(q[0] + 0.25, p[0][0] + 0.07, dn), lerp(lerp(1.1, q[1], k), WY + 0.02, dn), lerp(q[2], p[0][1], dn));
        L.set(lerp(q[0] + 0.25, p[1][0] + 0.07, dn), lerp(lerp(1.1, q[1], k), WY + 0.02, dn), lerp(q[2] + 0.2, p[1][1], dn));
        mix(R, SPOT.spatula[0] + 0.06, WY + 0.045, SPOT.spatula[1], sm(0.82, 1, u));      // …and on to the fish slice
        both(); break;
      }
      case 'scoop': {            // four passes of the fish slice (its blade is ~10 cm beyond the hand): tray → plate → back
        const n = u < SCOOP_U[1] ? 0 : u < SCOOP_U[2] ? 1 : u < SCOOP_U[3] ? 2 : 3, v = (u - SCOOP_U[n]) / (SCOOP_U[n + 1] - SCOOP_U[n]), S = SPOT.traySide, P = SPOT.plates[n % 2], Q = n ? SPOT.plates[(n - 1) % 2] : SPOT.spatula, k = sm(0.36, 0.7, v), k0 = sm(0, 0.27, v);
        B.head.rotation.x += 0.2;
        R.set(lerp(Q[0] + (n ? 0.105 : 0.06), S[0] + 0.115, k0), WY + 0.05 + 0.07 * Math.sin(Math.PI * k0), lerp(Q[1], S[1] - 0.13, k0));      // from the last plate (or where the slice lay) to the tray
        mix(R, P[0] + 0.105, WY + 0.05 + 0.09 * Math.sin(Math.PI * k), P[1], k);                                                             // a load across to the plate
        if (n === 3) mix(R, SPOT.spatula[0] + 0.06, WY + 0.045, SPOT.spatula[1], sm(0.8, 1, v));                                               // …and the slice goes back down
        hands(ch, R, 1, null, 0, 1); break;
      }
      case 'ketchup': {          // bottle up, a squeeze over each plate, then stood on his own plate for the walk to the table
        const K0 = SPOT.ketchup, P = SPOT.plates, a = sm(0.1, 0.28, u), b = sm(0.58, 0.66, u), back = sm(0.9, 0.99, u);
        const bx = lerp(lerp(lerp(K0[0], P[0][0] + 0.06, a), P[1][0] + 0.06, b), P[0][0], back), bz = lerp(lerp(lerp(K0[1], P[0][1] + 0.05, a), P[1][1] + 0.05, b), P[0][1] - 0.05, back);
        B.head.rotation.x += 0.18;
        R.set(bx - fx * 0.02, WY + lerp(0.1, 0.24, a * (1 - back)) + 0.014 * back, bz - fz * 0.02); RH(); break;
      }
      case 'carryPlates': {      // his own plate in the right hand, Lorenzo's in the left
        pair(0, 1.0, 0.3, 0.21);
        if (t < 80) { const p = SPOT.plates, k = 1 - sm(60.4, 60.7, t); mix(R, p[0][0] - fx * 0.07, WY + 0.012, p[0][1] - fz * 0.07, k); mix(L, p[1][0] - fx * 0.07, WY + 0.012, p[1][1] - fz * 0.07, k); both(); }      // picked up off the worktop
        else { const P = TABLE_PLATES[0], k = 1 - sm(104.85, 105.3, t); mix(R, P[0] - fx * 0.07, TY + 0.012, P[1] - fz * 0.07, k); RH(); }      // clearing up: the two plates stacked in one hand (see _props)
        break;
      }
      case 'setPlates': {        // Lorenzo's plate down (left hand), then his own
        const P = TABLE_PLATES, k1 = ease(clamp(u / 0.4, 0, 1)), k0 = ease(clamp((u - 0.4) / 0.42, 0, 1));
        pair(0, 1.0, 0.3, 0.21);
        mix(L, P[1][0] - fx * 0.07, TY + 0.012, P[1][1] - fz * 0.07, k1); mix(R, P[0][0] - fx * 0.07, TY + 0.012, P[0][1] - fz * 0.07, k0);
        both(1 - sm(0.9, 1, u), 1 - sm(0.5, 0.75, u)); break;
      }
    }
  }

  /** when a hand's target jumps (a new gesture), cross-fade that arm — and the torso's lean — from last frame's pose instead of snapping */
  _xfade(A, dt, t, key) {
    const B = A.ch.bones; if (!B) return;
    const c = this._xc, f = A.fr, l = A.last, cont = Math.abs(t - A.lastT) < 0.25;
    const changed = key !== A.gk; A.gk = key; A.lastT = t;
    for (let sd = 0; sd < 2; sd++) {
      const a = sd ? A.tg.R : A.tg.L, p = sd ? A.pg.R : A.pg.L;
      const jump = changed && (Math.abs(a[3] - p[3]) > 0.35 || (a[3] > 0.5 && Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2]) > 0.06));
      if (jump && cont) { const o = sd ? 5 : 0; for (let i = o; i < o + 5; i++) f[i] = l[i]; if (A.xL <= 0 && A.xR <= 0) for (let i = 10; i < 18; i++) f[i] = l[i]; if (sd) A.xR = XFADE; else A.xL = XFADE; }
      p[0] = a[0]; p[1] = a[1]; p[2] = a[2]; p[3] = a[3]; a[3] = 0;
    }
    if (!cont) A.xL = A.xR = 0;
    xget(B, c);
    if (A.xL > 0 || A.xR > 0) {
      const kL = A.xL > 0 ? ease(1 - A.xL / XFADE) : 1, kR = A.xR > 0 ? ease(1 - A.xR / XFADE) : 1, kB = Math.min(kL, kR);
      for (let i = 0; i < 5; i++) c[i] = lerp(f[i], c[i], kL);
      for (let i = 5; i < 10; i++) c[i] = lerp(f[i], c[i], kR);
      for (let i = 10; i < 18; i++) c[i] = lerp(f[i], c[i], kB);
      xset(B, c);
      // the arm that is not fading keeps its hand on its target while the torso eases over
      if (A.xL <= 0 && A.pg.L[3] > 0.9) { const q = A.pg.L; reach(A.ch, 1, q[0], q[1], q[2], 1); }
      if (A.xR <= 0 && A.pg.R[3] > 0.9) { const q = A.pg.R; reach(A.ch, -1, q[0], q[1], q[2], 1); }
      A.xL -= dt; A.xR -= dt; xget(B, c);
    }
    l.set(c);
  }
  /** ease a prop from where it was drawn to its new place when its state flips (hand ↔ worktop…), instead of a jump */
  _glide(o, mode, dt) {
    const d = o.userData;
    if (!d.gp) { d.gp = new THREE.Vector3().copy(o.position); d.go = new THREE.Vector3(); d.gt = 0; d.gm = mode; }
    if (mode !== d.gm) { d.gm = mode; d.go.copy(d.gp).sub(o.position); d.gt = this._cont && o.visible && d.go.lengthSq() < 0.5 ? GLIDE : 0; }
    if (d.gt > 0) { o.position.addScaledVector(d.go, ease(d.gt / GLIDE)); d.gt -= dt; }
    d.gp.copy(o.position);
  }
  _holder() {
    const m = this.actors.miguel;
    if (m && m.ch.group.visible) return m.ch;
    if (this.cur && this.cur.local) return this.game.player.character;
    return null;
  }
  /** put obj at a character's hand (world space: obj stays upright, turned to the character's heading) */
  _atHand(obj, side, dy, fwd, ch = this._holder(), lat = 0) {
    if (!ch) { obj.visible = false; return false; }
    const an = ch.anchors && (side === 'L' ? ch.anchors.handL : ch.anchors.handR); if (!an) { obj.visible = false; return false; }
    an.getWorldPosition(this.tmpV);
    const h = ch.group.rotation.y;
    obj.position.set(this.tmpV.x + Math.sin(h) * fwd + Math.cos(h) * lat, this.tmpV.y + dy, this.tmpV.z + Math.cos(h) * fwd - Math.sin(h) * lat);
    obj.rotation.set(0, h, 0); obj.visible = true;
    return true;
  }
  /** midpoint of a character's two hands → this.tmpV2 */
  _mid(ch) { ch.anchors.handL.getWorldPosition(this.tmpV2); ch.anchors.handR.getWorldPosition(this.tmpV); return this.tmpV2.add(this.tmpV).multiplyScalar(0.5); }
  _props(dt, st, R, t) {
    const off = !st, M = this._holder(), mA = this.actors.miguel, G = !off && mA && mA.vis ? mA.act : null, c = this.clock;
    // oven door / light / timer on the room's own meshes
    if (R && R.oven) {
      R.oven.pivot.rotation.z = off ? 0 : -st.door * Math.PI / 2 * 0.95;
      const on = !off && st.light ? 1 : 0, fl = on ? 0.92 + 0.08 * Math.sin(c * 17) * Math.sin(c * 5.3) : 0;      // the element's glow wavers a little
      R.oven.glass.emissiveIntensity = fl * 0.75; R.oven.glow.emissiveIntensity = fl * (1.6 + 1.2 * (off ? 0 : st.door));
      let txt = '';
      if (!off && st.timer !== null) txt = st.timer < 0 ? '' : `${Math.floor(st.timer / 60)}:${String(st.timer % 60).padStart(2, '0')}`;
      else { const h = this.game.time.hour; txt = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; }
      R.oven.setTimer(txt);
    }
    // freezer door + drawer
    const fo = off ? 0 : st.freezer;
    this.fz.rotation.y = -fo * 1.3; this.drawer.position.z = FZ.z1 - 0.14 + 0.2 * (off ? 0 : sm(5.5, 6.0, t) * (1 - sm(6.5, 6.9, t)));
    // bag: in the right hand (both hands over the tray while shaking), then on the worktop
    const bag = this.bag;
    if (off || st.bag === 'none') bag.visible = false;
    else if (st.bag === 'hand' && M) {
      if (st.shake) { const p = this._mid(M); bag.position.set(p.x - 0.03, p.y + 0.05, p.z); bag.rotation.set(0, Math.PI / 2, 2.2 + 0.16 * Math.sin(c * 21)); bag.visible = true; }
      else { this._atHand(bag, G === 'bagDown' ? 'L' : 'R', -0.1, 0.03, M); bag.rotation.set(0.15, M.group.rotation.y, 0); }
    } else { bag.visible = true; bag.position.set(SPOT.bag[0], WY + 0.024, SPOT.bag[1]); bag.rotation.set(-Math.PI / 2, 0.5, 0); }
    // tray
    const tray = this.tray, TH = this.trayHold; tray.visible = true;
    if (off || st.tray === 'hob') { tray.position.set(SPOT.tray[0], WY + 0.012, SPOT.tray[1]); tray.rotation.set(0, Math.PI / 2, 0); }
    else if (st.tray === 'hand' && M && mA && mA.vis && TH.on) {      // hangs off Miguel's left hand, `grip` ahead of it (his gestures keep the right hand on the other side)
      M.anchors.handL.getWorldPosition(this.tmpV); const h = M.group.rotation.y, fx = Math.sin(h), fz = Math.cos(h), v = this.tmpV;
      tray.position.set(v.x - fz * TRAY_HALF + fx * TH.grip, v.y - 0.02, v.z + fx * TRAY_HALF + fz * TH.grip);
      if (TH.w < 1) tray.position.lerpVectors(TH.rest, tray.position, TH.w);
      tray.rotation.set(0, h + Math.PI, 0);
    }
    else if (st.tray === 'hand' && M) { const p = this._mid(M), h = M.group.rotation.y; tray.position.set(p.x + Math.sin(h) * 0.02, p.y - 0.02, p.z + Math.cos(h) * 0.02); tray.rotation.set(0, h, 0); }
    else if (st.tray === 'oven') { tray.position.set(OVEN_TRAY_X + OVEN_PUSH * (1 - sm(19.3, 19.48, t)), OVEN_TRAY_Y, K.oven.z); tray.rotation.set(0, Math.PI / 2, 0); }      // (let go a few cm short: it glides home)
    else { tray.position.set(SPOT.traySide[0], WY + 0.012, SPOT.traySide[1]); tray.rotation.set(0, Math.PI / 2, 0); }
    this._glide(tray, off ? 'off' : st.tray, dt); this._glide(bag, off ? 'off' : st.bag + (st.shake ? 's' : G === 'bagDown' ? 'd' : ''), dt);
    this.trayDips.count = off ? 0 : st.trayN;
    if (!off) {
      this.m.raw.color.setHex(0xe6d0a4).lerp(this.m.cooked.color, st.cook);
      if (st.shake && st.trayN > 0) {       // the newest dipper is still tumbling out of the bag
        const i = st.trayN - 1, k = clamp(((t - 14.4) / 0.165) % 1, 0, 1), V = this.V;
        this.traySlot(i, V); V.y += 0.24 * (1 - k) * (1 - k); this.Q.setFromAxisAngle(this.Y, 0.5 * Math.sin(i * 2.3) + (1 - k) * 4);
        this.trayDips.setMatrixAt(i, this.M4.compose(V, this.Q, this.Sc)); this.trayDips.instanceMatrix.needsUpdate = true; this._tumble = i;
      } else if (this._tumble !== undefined && this._tumble >= 0) { const i = this._tumble, V = this.V; this.traySlot(i, V); this.Q.setFromAxisAngle(this.Y, 0.5 * Math.sin(i * 2.3)); this.trayDips.setMatrixAt(i, this.M4.compose(V, this.Q, this.Sc)); this.trayDips.instanceMatrix.needsUpdate = true; this._tumble = -1; }
    }
    // plates (each in a hand while carried; Lorenzo's goes down first)
    for (let i = 0; i < 2; i++) {
      const P = this.plates[i];
      if (off || st.plates === 'none') { P.g.visible = false; continue; }
      const down = st.plates === 'table' || (st.plates === 'hands' && t < 100 && i === 1 && st.plate1Down);
      if (st.plates === 'hands' && !down && M && i === 1 && t > 100) {      // clearing up: Lorenzo's plate is slid across and stacked on Miguel's
        const P0 = this.plates[0].g, k = sm(104.8, 105.25, t); P.g.visible = true;
        P.g.position.set(lerp(TABLE_PLATES[1][0], P0.position.x, k), lerp(TY, P0.position.y + 0.016, k), lerp(TABLE_PLATES[1][1], P0.position.z, k)); P.g.rotation.set(0, 0, 0);
      }
      else if (st.plates === 'hands' && !down && M) this._atHand(P.g, i ? 'L' : 'R', -0.01, 0.07, M);
      else if (st.plates === 'hands' && !down) { P.g.visible = false; continue; }
      else { P.g.visible = true; const q = st.plates === 'counter' ? SPOT.plates[i] : TABLE_PLATES[i]; P.g.position.set(q[0], st.plates === 'counter' ? WY : TY, q[1]); P.g.rotation.set(0, 0, 0); }
      this._glide(P.g, st.plates + (down ? 'd' : ''), dt);
      P.ins.count = i ? st.plateN1 : st.plateN0;
      const dl = i ? st.dollop1 : st.dollop0; P.dl.visible = dl > 0.02; P.dl.scale.set(0.028 * dl, 0.012 * dl, 0.024 * dl);
    }
    // ketchup: on the worktop, squeezed upside down over each plate, riding on Miguel's plate, then on the table
    const kt = this.ketchup; kt.visible = true; this.squirt.visible = false;
    if (off || st.ketchup === 'counter') { kt.position.set(SPOT.ketchup[0], WY, SPOT.ketchup[1]); kt.rotation.set(0, 0, 0); }
    else if (st.ketchup === 'hand' && M) {
      const sq = t < 61 ? sm(58.55, 58.8, t) * (1 - sm(60.0, 60.15, t)) : 0;
      this._atHand(kt, 'R', lerp(-0.1, 0.1, sq), 0.02, M); kt.rotation.set(0, M.group.rotation.y, Math.PI * 0.92 * sq);
      const pi = t > 59.4 ? 1 : 0, on = (t > 58.8 && t < 59.3) || (t > 59.5 && t < 60.0);
      if (on) { const q = SPOT.plates[pi], y0 = kt.position.y - 0.2, y1 = WY + 0.02; this.squirt.visible = true; this.squirt.position.set(q[0] + 0.06, (y0 + y1) / 2, q[1] + 0.05); this.squirt.scale.set(1, Math.max(0.01, y0 - y1), 1); kt.position.x = q[0] + 0.06; kt.position.z = q[1] + 0.05; }
    } else if (st.ketchup === 'plate') { const P = this.plates[0].g; kt.position.set(P.position.x - Math.sin(P.rotation.y) * 0.05, P.position.y + 0.014, P.position.z - Math.cos(P.rotation.y) * 0.05); kt.rotation.set(0, 0, 0); kt.visible = P.visible; }
    else { kt.position.set(SPOT.tableKetchup[0], TY, SPOT.tableKetchup[1]); kt.rotation.set(0, 0, 0); }
    this._glide(kt, off ? 'off' : st.ketchup, dt);
    // oven mitts: beside the hob, one on each hand, then dropped by the plates
    for (let i = 0; i < 2; i++) {
      const mt = this.mitts[i];
      const an = !off && st.glove === 'hand' && M && M.anchors ? (i ? M.anchors.handL : M.anchors.handR) : null;
      if (an) { an.getWorldPosition(mt.position); an.getWorldQuaternion(mt.quaternion); mt.visible = true; }      // worn: follows the hand and the forearm's angle
      else { const hook = off || st.glove === 'hook', q = hook ? SPOT.mitts : SPOT.mittsAfter; mt.visible = true; mt.position.set(q[0] + i * 0.03, WY + 0.036 + i * 0.05, q[1] + i * (hook ? 0.05 : 0.01)); mt.rotation.set(0, hook ? (i ? 0.25 : 0.62) : (i ? -0.12 : 0.08), Math.PI / 2 + i * 0.25); }      // lying flat, one half on the other
      this._glide(mt, off ? 'off' : st.glove, dt);
    }
    // fish slice
    const sp = this.spatula;
    if (!off && st.spatula === 'hand' && M) { this._atHand(sp, 'R', -0.03, 0.06, M); }
    else { sp.visible = true; sp.position.set(SPOT.spatula[0], WY + 0.012, SPOT.spatula[1]); sp.rotation.set(0, -Math.PI / 2, 0); }
    this._glide(sp, off ? 'off' : st.spatula, dt);
    // glasses of squash: drainer → Lorenzo's hands (filled at the tap) → table
    const LZ = this.actors.lorenzo, lz = LZ && LZ.vis ? LZ.ch : null;
    for (let i = 0; i < 2; i++) {
      const gs = this.glasses[i], lvl = off ? 0 : st.glasses === 'drainer' ? 0 : st.glasses === 'hands' ? st.water : 1;
      const set = !off && (st.glasses === 'table' || (st.glasses === 'hands' && i === 0 && st.glass0Down));
      if (!off && st.glasses === 'hands' && lz && !set) this._atHand(gs.g, i ? 'L' : 'R', -0.06, 0.03, lz);
      else if (set) { gs.g.visible = true; gs.g.position.set(SPOT.glasses[i][0], TY, SPOT.glasses[i][1]); }
      else { gs.g.visible = true; gs.g.position.set(SPOT.drainer[i][0], WY + 0.012, SPOT.drainer[i][1]); }
      this._glide(gs.g, off ? 'off' : st.glasses + (set ? 'd' : ''), dt);
      gs.g.rotation.set(0, 0, 0); gs.w.visible = lvl > 0.03; gs.w.scale.y = Math.max(0.01, 0.1 * lvl); gs.w.position.y = 0.004 + 0.05 * lvl;
    }
    // phone
    if (!off && st.phone && M && G === 'phone') { this._atHand(this.phone, 'R', 0.0, 0.05, M); this.phone.rotation.set(-0.9, M.group.rotation.y, 0); }
    else this.phone.visible = false;
    if (off) for (const d of this.loose) d.visible = false;
    else { if (!mA || !mA.vis || st.plates !== 'table') this.loose[0].visible = false; if (!lz || st.plates !== 'table') this.loose[1].visible = false; const g = this.actors.guest; if (!g || !g.vis) this.loose[2].visible = false; }
    // steam: wisps from the oven vent at the back of the hob while it cooks, a burst when the door opens, then off the hot tray
    const lv = off ? 0 : st.steam, lt = off ? 0 : st.steamTray;
    this.steamClock += dt;
    for (let i = 0; i < this.steam.length; i++) {
      const s2 = this.steam[i], hot = i >= 3 ? lt : 0, lvl = i < 3 ? lv : hot;
      if (lvl <= 0.01) { s2.visible = false; continue; }
      const p = (this.steamClock * 0.32 + i / this.steam.length * 2.3) % 1;
      s2.visible = true;
      if (i < 3) s2.position.set(K.hob[0] - 0.12 + Math.sin(i * 2.1 + this.steamClock) * 0.05, WY + 0.06 + p * 0.6, K.hob[1] + Math.cos(i * 1.7 + this.steamClock * 0.8) * 0.07);
      else s2.position.set(tray.position.x + Math.sin(i * 2.1 + this.steamClock) * 0.07, tray.position.y + 0.04 + p * 0.5, tray.position.z + Math.cos(i * 1.7 + this.steamClock * 0.8) * 0.1);
      const sc = 0.1 + p * 0.25; s2.scale.set(sc, sc, sc);
      s2.material.opacity = lvl * Math.sin(Math.PI * p) * 0.42;
    }
  }
}
export { DUR_S };
