// Real doors for walk-in ("seamless") interiors: a hinged leaf that swings on its hinge with weight, and an automatic
// sliding pair. No fade, no teleport, no network message: a door's motion is a function of where people are (the local
// player, other players, pedestrians), so every client that can see the door sees the same thing.
//
//   const door = makeDoor({ kind: 'hinged' | 'slide', at: [x, z], y, w, h, dir, ... })     (see the option list below)
//   door.group            THREE.Group to add to the room's scene (hinged: at the hinge; slide: at the opening's centre)
//   door.update(dt, people, env)   people: [{ x, z, vx, vz, ch?, me? }] in the door's frame; env: { audio, gain, useKey }
//   door.passable         true once the way is clear to walk through; door.open 0..1
//   door.onPass(fn)       fn(passable) called when it flips (the interiors system toggles collider segments / passages)
//   door.use(sideSign?)   ask it to open (the [E] path); door.pos = [x, z] of the middle of the doorway
//
// Hinged doors. `dir` = heading along the CLOSED leaf from the hinge to the latch edge (forward = (sin, cos)); the leaf
// turns by theta about the hinge: theta > 0 swings it to the side of the normal n = (cos dir, -sin dir).
//   swing: +1 | -1   the side the door is hung to open on (it only ever opens that way: you push it or pull it)
//          0         a two-way door: it opens away from whoever uses it
//   closer: true     a fire door: shuts itself behind you;  false: an old door that stays where it was left (ajar)
//   heavy:  true     college oak: slower, more settle;  false: a light modern door
//   trigger          'walk' (default): walking at the door within reach opens it (so does E);  'key': E only
// The leaf never sweeps through a person: it holds short of anyone in its arc (a two-way door then opens the other way).
// Motion is a damped spring on the angle (eased, a little overshoot and settle, bounded by the stops), with a latch
// click as it leaves the frame and a soft thud as it meets it again.
// The hand: the local player's hand goes to the handle as they walk up, the latch only gives once the hand is on it
// (or after a beat, if they stand where they cannot reach), and the arm stays on the handle through the first part of
// the swing — pushed ahead of you, or drawn back with you as the leaf comes round — before it lets go.
// Two characters of door: `style: 'oak', heavy: true` (college oak: six raised panels, a turned knob on a rose and an
// escutcheon, slow to start and slow to stop, an iron latch, a creak, a deep shut) and `style: 'fire'` (a flat veneered
// leaf, lever handles on backplates, a kick plate, a closer box at its head; quick, a light click, the closer's hiss and
// a soft landing: a closer checks the leaf over the last of its swing, it does not slam).
import * as THREE from 'three';
import { hingeCreak, slideMotor, shopBell } from './_door_sounds.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const OPEN = 1.5;            // rad: fully open (a little short of square to the wall)
const PASS = 0.95;           // rad: wide enough to walk through
const REACH = 1.45, REACH_PULL = 2.45;          // m from the middle of the doorway at which walking at it opens it
const ARM = 0.7;             // m (in plan) from a person to the handle at which their hand is on it
const ARM_FAR = 0.84;        // …with the arm out straight (someone a wall will not let any nearer)
const REACH_TOL = 0.03;      // m: the hand counts as on the handle when the arm at full stretch is this near it (it was 0.12 while a shut doorway's wall held the walker 0.6 m off the leaf: core/interiors.js P.reveal lets them up to it now)
const LET_GO = 0.045;        // m: the hand lets go of a moving leaf's handle once the arm at full stretch falls this far short of it
const HAND_FOLLOW = 0.8;     // rad: the hand stays on the handle until the leaf has swung this far
const BODY = 0.36;           // m kept between the leaf and a person
const V_LIGHT = 3.8, V_OAK = 3.2, V_HEAVY = 2.6;      // rad/s: the fastest a leaf opens (a fire door; a light oak door; heavy college oak)
// a person on another storey (feet more than 1.4 m from the door's floor) is nothing to this door; no height known: they count
const offStorey = (p, y) => y !== undefined && p.y !== undefined && p.y !== null && Math.abs(p.y - y) > 1.4;

// two-bone reach (after _friends_dippers.js): puts the hand of `side` (+1 left, -1 right) at a point in the scene's frame.
// Returns how far short of the point the hand is left with the arm out straight (0: it is on it), or undefined.
const _v = new THREE.Vector3();
export function reachHand(ch, side, x, y, z, w = 1) {
  const B = ch && ch.bones; if (!B || !ch.dims || w <= 0) return;
  const arm = side > 0 ? B.armL : B.armR, fore = side > 0 ? B.foreL : B.foreR, D = ch.dims, UA = D.UA, L2 = D.FA + 0.06;
  if (!arm || !fore || !UA) return;
  B.torso.updateWorldMatrix(true, false);
  _v.set(x, y, z); B.torso.worldToLocal(_v); _v.sub(arm.position);
  let d = _v.length(); if (d < 1e-4) return;
  const dmax = (UA + L2) * 0.985, dmin = Math.abs(UA - L2) + 0.04, short = d > dmax ? d - dmax : 0;
  if (d > dmax) { _v.multiplyScalar(dmax / d); d = dmax; } else if (d < dmin) { _v.multiplyScalar(dmin / d); d = dmin; }
  const px = _v.x / d, py = _v.y / d, pz = _v.z / d;
  const al = Math.acos(clamp((UA * UA + d * d - L2 * L2) / (2 * UA * d), -1, 1));
  let wx = side * 0.5, wy = -1, wz = -0.45;
  const dt = wx * px + wy * py + wz * pz; wx -= dt * px; wy -= dt * py; wz -= dt * pz;
  const wl = Math.hypot(wx, wy, wz) || 1, ca = Math.cos(al), sa = Math.sin(al) / wl;
  const ux = ca * px + sa * wx, uy = ca * py + sa * wy, uz = ca * pz + sa * wz;
  const A = Math.asin(clamp(side * ux, -1, 1)), F = Math.atan2(uz, -uy), sA = side * A;
  const cF = Math.cos(F), sF = Math.sin(F), y1 = _v.y * cF - _v.z * sF, z1 = _v.y * sF + _v.z * cF;
  const cA = Math.cos(sA), sn = Math.sin(sA), hx = _v.x * cA + y1 * sn, hy = -_v.x * sn + y1 * cA + UA;
  const ty = Math.atan2(hx, z1), el = Math.atan2(Math.hypot(hx, z1), -hy);
  arm.rotation.x = lerp(arm.rotation.x, -F, w); arm.rotation.y = lerp(arm.rotation.y, 0, w); arm.rotation.z = lerp(arm.rotation.z, sA, w);
  fore.rotation.x = lerp(fore.rotation.x, -el, w); fore.rotation.y = lerp(fore.rotation.y, ty, w);
  return short;
}

/** how far short of the point the hand of `side` would be left with the arm out straight (0: within reach); moves nothing */
export function reachShort(ch, side, x, y, z) {
  const B = ch && ch.bones, D = ch && ch.dims; if (!B || !D || !D.UA) return 9;
  const arm = side > 0 ? B.armL : B.armR; if (!arm) return 9;
  B.torso.updateWorldMatrix(true, false);
  _v.set(x, y, z); B.torso.worldToLocal(_v); _v.sub(arm.position);
  const d = _v.length(), dmax = (D.UA + D.FA + 0.06) * 0.985;
  return d > dmax ? d - dmax : 0;
}

/** pure: one step of a hinged door's angle. s = { th, om }; target angle tg; limits [lo, hi]; returns s (mutated). */
export function stepHinge(s, tg, dt, heavy, lo = -OPEN, hi = OPEN, check = false, vmax = 0) {
  let w = heavy ? 5.2 : 9.5, z = heavy ? 0.82 : 0.72;       // natural frequency (rad/s), damping ratio (< 1: it settles past the mark)
  if (check && tg < s.th) { w *= s.th < 0.3 ? 0.5 : 0.72; z = 1.0; }      // a closer: a steady sweep, then checked over the last of it (no slam)
  let n = Math.max(1, Math.ceil(dt / 0.012)); const h = dt / n;
  while (n--) { s.om += (w * w * (tg - s.th) - 2 * z * w * s.om) * h; if (vmax && s.om > vmax) s.om = vmax; s.th += s.om * h; if (s.th < lo) { s.th = lo; if (s.om < 0) s.om *= -0.25; } else if (s.th > hi) { s.th = hi; if (s.om > 0) s.om *= -0.25; } }
  return s;
}
/** pure: the largest |angle| (on side sg) the leaf of width w may take without touching anyone; people in the hinge frame */
export function arcLimit(people, hx, hz, dir, w, sg, from, y) {
  let lim = OPEN + 0.2;
  const dx = Math.sin(dir), dz = Math.cos(dir), nx = Math.cos(dir) * sg, nz = -Math.sin(dir) * sg;
  for (const p of people) {
    if (offStorey(p, y)) continue;
    const rx = p.x - hx, rz = p.z - hz, r = Math.hypot(rx, rz);
    if (r > w + BODY - 0.02 || r < 0.05) continue;
    const a = Math.atan2(rx * nx + rz * nz, rx * dx + rz * dz);      // angle of the person from the closed leaf, towards the swing side
    if (a < -0.05) continue;                                         // on the other side of the wall
    const m = Math.asin(clamp(BODY / Math.max(r, BODY), 0, 1));
    if (a <= from + 1e-3) continue;                                  // behind the leaf (pushing it, or following it through): not in its way
    lim = Math.min(lim, Math.max(from, a - m));
  }
  return lim;
}

/** pure: while closing from angle `from`, the angle the leaf must stay above so as not to shut on anyone standing in its arc (0 = clear) */
export function arcFloor(people, hx, hz, dir, w, sg, from, y) {
  let lo = 0;
  const dx = Math.sin(dir), dz = Math.cos(dir), nx = Math.cos(dir) * sg, nz = -Math.sin(dir) * sg;
  for (const p of people) {
    if (offStorey(p, y)) continue;
    const rx = p.x - hx, rz = p.z - hz, r = Math.hypot(rx, rz);
    if (r > w + BODY || r < 0.05) continue;
    const a = Math.atan2(rx * nx + rz * nz, rx * dx + rz * dz);
    const m = Math.asin(clamp(BODY / Math.max(r, BODY), 0, 1));
    if (a < -m || a - m >= from) continue;                           // the other side of the wall / beyond the open leaf
    lo = Math.max(lo, Math.min(from, a + m));
  }
  return lo;
}

function leafGeo(o, mats) {
  // leaf along +z from the hinge, thickness along x; returns [{ geo, mat }]
  const parts = new Map();
  const add = (mat, w, h, t, z, y, x = 0) => { if (!mat) return; const g = new THREE.BoxGeometry(t, h, w); g.translate(x, y, z); let a = parts.get(mat); if (!a) parts.set(mat, (a = [])); a.push(g); };
  const W = o.w, H = o.h, T = o.thick || (o.style === 'oak' ? 0.06 : 0.045);
  if (o.style === 'glass') {
    // aluminium-framed glazed leaf
    const f = 0.07;
    add(mats.frame, W, f, T, W / 2, f / 2); add(mats.frame, W, f, T, W / 2, H - f / 2); add(mats.frame, f, H, T, f / 2, H / 2); add(mats.frame, f, H, T, W - f / 2, H / 2);
    add(mats.frame, W, 0.09, T, W / 2, 1.0);
    add(mats.glass, W - 2 * f, H - 2 * f, 0.012, W / 2, H / 2);
  } else {
    const vp = o.vision;      // vision panel [z0, z1, y0, y1] on the leaf, or null
    if (vp) {
      add(mats.leaf, vp[0], H, T, vp[0] / 2, H / 2); add(mats.leaf, W - vp[1], H, T, (W + vp[1]) / 2, H / 2);
      add(mats.leaf, vp[1] - vp[0], vp[2], T, (vp[0] + vp[1]) / 2, vp[2] / 2); add(mats.leaf, vp[1] - vp[0], H - vp[3], T, (vp[0] + vp[1]) / 2, (H + vp[3]) / 2);
      add(mats.glass, vp[1] - vp[0], vp[3] - vp[2], 0.01, (vp[0] + vp[1]) / 2, (vp[2] + vp[3]) / 2);
    } else add(mats.leaf, W, H, T, W / 2, H / 2);
    if (o.style === 'oak') {
      // six raised panels (two small over two tall over two middling), each a field proud of a sunk margin
      const st = Math.min(0.13, W * 0.14), mid = W / 2, rows = [[0.2, 0.74], [0.86, H - 0.52], [H - 0.41, H - 0.13]];
      for (const [y0, y1] of rows) if (y1 - y0 > 0.12) for (const [z0, z1] of [[st, mid - 0.045], [mid + 0.045, W - st]]) for (const sx of [-1, 1]) {
        add(mats.leaf, z1 - z0, y1 - y0, 0.008, (z0 + z1) / 2, (y0 + y1) / 2, sx * (T / 2 + 0.003));
        if (z1 - z0 > 0.16 && y1 - y0 > 0.2) add(mats.leaf, z1 - z0 - 0.09, y1 - y0 - 0.09, 0.012, (z0 + z1) / 2, (y0 + y1) / 2, sx * (T / 2 + 0.011));
      }
    }
    if (o.kick !== false && o.style !== 'oak') for (const sx of [-1, 1]) add(mats.handle, W - 0.04, 0.2, 0.003, W / 2, 0.11, sx * (T / 2 + 0.002));
    // a fire door's overhead closer: the box at the head of the leaf, hinge side, on the face it is pulled from
    if (o.style !== 'oak' && o.closer !== false && o.closerBox !== false) { const sx = (o.swing || 1) > 0 ? 1 : -1; add(mats.handle, 0.24, 0.055, 0.05, 0.2, H - 0.07, sx * (T / 2 + 0.026)); add(mats.handle, 0.3, 0.016, 0.016, 0.42, H - 0.045, sx * (T / 2 + 0.06)); }
    if (o.plate) for (const sx of o.plateSides || [-1, 1]) add(mats.plate || mats.handle, 0.16, 0.1, 0.004, W / 2, 1.55, sx * (T / 2 + 0.003));
  }
  // handles both sides (lever on a rose; a ring for oak), near the latch edge
  const hz = W - 0.09, hy = o.handleY || 1.0;
  if (!o.noHandle) for (const sx of [-1, 1]) {
    add(mats.handle, 0.05, 0.05, 0.012, hz, hy, sx * (T / 2 + 0.006));
    if (o.style === 'oak') {      // a turned knob on its rose, and an escutcheon under it
      add(mats.handle, 0.07, 0.07, 0.006, hz, hy, sx * (T / 2 + 0.008)); add(mats.handle, 0.026, 0.026, 0.04, hz, hy, sx * (T / 2 + 0.03));
      add(mats.handle, 0.062, 0.062, 0.03, hz, hy, sx * (T / 2 + 0.058)); add(mats.handle, 0.044, 0.088, 0.03, hz, hy, sx * (T / 2 + 0.058)); add(mats.handle, 0.088, 0.044, 0.03, hz, hy, sx * (T / 2 + 0.058));
      add(mats.handle, 0.03, 0.07, 0.004, hz, hy - 0.16, sx * (T / 2 + 0.006));
    } else {
      add(mats.handle, 0.045, 0.2, 0.004, hz, hy - 0.03, sx * (T / 2 + 0.004));      // (a lever on its backplate)
      add(mats.handle, 0.018, 0.018, 0.05, hz, hy, sx * (T / 2 + 0.03)); add(mats.handle, 0.12, 0.018, 0.018, hz - 0.055, hy, sx * (T / 2 + 0.05)); }
  }
  return parts;
}
function mergeBoxes(list) {
  // minimal merge of BoxGeometries (position / normal / uv, non-indexed)
  let n = 0; const ni = list.map((g) => g.toNonIndexed()); for (const g of ni) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const g of ni) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
  for (const g of list) g.dispose();
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  return out;
}

/**
 * o: kind, at [x, z], y (floor), w, h, dir, and
 *   hinged: swing (+1 | -1 | 0), closer (default true), heavy, trigger ('walk' | 'key'), rest (rad it is left ajar at when closer is false)
 *   slide:  range (m either side of the middle at which it opens; default 2.6; rangeOut / rangeIn: the side of the normal
 *           n = (cos dir, -sin dir) / the other side), hold (s it stays open once clear)
 *   style 'fire' | 'oak' | 'glass', mats { leaf, handle, glass, frame, plate }, vision [z0, z1, y0, y1], plate, thick
 *   bell: true — a shopkeeper's bell on a spring over the door, rung by the leaf as it opens. Only for a shop that
 *         really has one (an old independent shop); nothing sets it by default.
 */
export function makeDoor(o) {
  const hinged = o.kind !== 'slide';
  const D = {
    kind: hinged ? 'hinged' : 'slide', o, group: new THREE.Group(), th: 0, om: 0, open: 0, passable: false, target: 0, side: o.swing || 1, want: 0, clearT: 0, latchT: 0, _cb: [], _lat: false, _hand: 0, _creak: 0, stats: { opens: 0, held: 0, handOn: 0, handMin: 9 },
    pos: hinged ? [o.at[0] + Math.sin(o.dir) * o.w / 2, o.at[1] + Math.cos(o.dir) * o.w / 2] : [o.at[0], o.at[1]],
    onPass(fn) { this._cb.push(fn); }, use(sg) { this.want = 1.2; this._byUse = true; if (sg && !o.swing) this._useSide = sg; },
  };
  D.group.name = 'door'; D.group.position.set(o.at[0], o.y || 0, o.at[1]);
  const mk = (parent, opts) => { for (const [mat, geos] of leafGeo(opts, o.mats || {})) { const m = new THREE.Mesh(mergeBoxes(geos), mat); m.castShadow = false; m.receiveShadow = false; parent.add(m); } };
  if (hinged) { D.group.rotation.y = o.dir; mk(D.group, o); }
  else {
    D.group.rotation.y = o.dir;      // leaves slide along the group's ±z
    D.leaves = [-1, 1].map((sg) => { const g = new THREE.Group(); mk(g, { ...o, w: o.w / 2, style: o.style || 'glass', noHandle: true }); if (sg < 0) { g.rotation.y = Math.PI; } D.group.add(g); return g; });
    D.slide = 0; D.sv = 0;
    D._place = () => { const s = D.slide; D.leaves[0].position.z = -s; D.leaves[1].position.z = s; };
    D._place();
  }
  const dx = Math.sin(o.dir), dz = Math.cos(o.dir), nx = Math.cos(o.dir), nz = -Math.sin(o.dir), mx = D.pos[0], mz = D.pos[1];
  const fy = o.y || 0;
  // where the hand goes: the handle AS DRAWN (leafGeo) — an oak door's knob stands at w - 0.09 along the leaf, its face
  // 9 cm off the leaf's middle plane; a lever's grip is the middle of its arm, w - 0.145 along and 7 cm off. (It used to
  // be w - 0.14 and 7.5 cm for both: the hand closed on the air 5 cm beside an oak knob.)
  const TH = o.thick || (o.style === 'oak' ? 0.06 : 0.045), HR = o.style === 'oak' ? o.w - 0.09 : o.w - 0.145, HS = TH / 2 + (o.style === 'oak' ? 0.075 : 0.062);
  D.handle = { r: HR, s: HS };
  const setPass = (p) => { if (p !== D.passable) { D.passable = p; for (const f of D._cb) f(p); } };
  const sound = (env, kind) => {
    const a = env && env.audio, g = env ? env.gain : 0; if (!a || !a.ctx || !(g > 0.02)) return;
    try {
      const oak = o.style === 'oak' || o.heavy;
      if (kind === 'latch') {
        // oak: an iron latch lifted (a low clack, then the tongue leaving the keep); a fire door: the lever's light click
        if (oak) { a.noise(0.05, { gain: 0.2 * g, freq: 1150, q: 3.5 }); a.noise(0.07, { gain: 0.13 * g, freq: 520, q: 2.5, when: 0.045 }); a.noise(0.03, { gain: 0.06 * g, freq: 3200, q: 6, when: 0.02 }); }
        else { a.noise(0.03, { gain: 0.14 * g, freq: 2900, q: 6 }); a.noise(0.04, { gain: 0.07 * g, freq: 1300, q: 3, when: 0.028 }); }
        if (o.bell) shopBell(a, g);
      } else if (kind === 'creak') {
        // old hinges under a heavy leaf (2026-11-23: it was two steady tones a fifth apart — a musical "bing" on every
        // college door): the stick-slip of a dry pin, a rasp whose rate wanders, heard through the wood's resonance;
        // not every time, and never the same twice
        if (Math.random() < 0.6) hingeCreak(a, g);
      } else if (kind === 'closer') {
        a.noise(0.7, { gain: 0.022 * g, freq: 1700, q: 0.6, attack: 0.25, type: 'lowpass' });      // the closer's hiss as it brings the leaf home
      } else if (kind === 'shut') {
        if (oak) { a.noise(0.22, { gain: 0.34 * g, freq: 105, q: 1.1 }); a.noise(0.09, { gain: 0.16 * g, freq: 420, q: 1.6, when: 0.01 }); a.noise(0.05, { gain: 0.12 * g, freq: 1250, q: 4, when: 0.05 }); }
        else { a.noise(0.09, { gain: 0.13 * g, freq: 260, q: 1.2 }); a.noise(0.025, { gain: 0.09 * g, freq: 2700, q: 7, when: 0.03 }); }
      }
      else if (kind === 'slide') slideMotor(a, g);      // (it had a 96 Hz tone under the hiss: now the operator's motor, the leaves on their runners and the seal)
    } catch { /* audio not running */ }
  };
  D.update = (dt, people, env) => {
    if (!(dt > 0)) dt = 0;
    if (!hinged) {
      // automatic sliding pair: anyone near, either side
      const R = o.range || 2.6; let near = false;
      for (const p of people) { if (offStorey(p, fy)) continue; const rx = p.x - mx, rz = p.z - mz, off = rx * nx + rz * nz; if (Math.abs(rx * dx + rz * dz) < o.w / 2 + 0.7 && (off > 0 ? off < (o.rangeOut ?? R) : -off < (o.rangeIn ?? R))) { near = true; break; } }
      if (near || D.want > 0) D.clearT = o.hold ?? 1.1; else D.clearT -= dt;
      D.want = Math.max(0, D.want - dt);
      const tg = D.clearT > 0 ? o.w / 2 - 0.06 : 0, prev = D.target; D.target = tg;
      if (tg !== prev) { sound(env, 'slide'); if (tg) D.stats.opens++; }
      // critically damped, eased both ends
      const w = 5.5; let n = Math.max(1, Math.ceil(dt / 0.012)); const h = dt / n;
      while (n--) { D.sv += (w * w * (tg - D.slide) - 2 * w * D.sv) * h; D.slide = clamp(D.slide + D.sv * h, 0, o.w / 2 - 0.06); }
      D.open = D.slide / (o.w / 2 - 0.06); D._place();
      setPass(D.slide * 2 > 0.82);
      return;
    }
    // ---- hinged
    const key = env && env.useKey, oak = o.style === 'oak' || !!o.heavy;
    const wasShut = Math.abs(D.th) < 0.02 && D.target === 0;
    // at rest = shut, or left ajar (an old door with no closer) too narrow to walk through: it takes a hand to move it on
    const atRest = wasShut || (D.target > 0 && D.target < OPEN && D.clearT <= 0 && Math.abs(D.th) < PASS - 0.1 && Math.abs(Math.abs(D.th) - D.target) < 0.05 && Math.abs(D.om) < 0.2);
    let asked = D.want > 0, askSide = D._useSide || 0, me = null, meAsk = false, others = !!D._byUse;      // (others: someone other than the local player's walk asked — another person, or use())
    for (const p of people) {
      if (offStorey(p, fy)) continue;
      const rx = p.x - mx, rz = p.z - mz, along = rx * dx + rz * dz, off = rx * nx + rz * nz, dist = Math.hypot(rx, rz);
      if (p.me) me = p;
      // (a door that opens towards you is asked for sooner, so the leaf has swung past before you reach its arc)
      const pull = !!o.swing && off * o.swing > 0, sgn = off < 0 ? -1 : 1;
      // walking at it: velocity towards the plane of the door (the local player: or the way they are trying to go — held
      // against a shut leaf they have no velocity left)
      let vn = -(p.vx * nx + p.vz * nz) * sgn;
      if (p.me && (p.ix || p.iz)) { const vi = -(p.ix * nx + p.iz * nz) * sgn; if (vi > vn) vn = vi; }
      // (the local player at a run is noticed from further off: the arm needs the time to come up. The latch still waits for the hand.)
      const ld = p.me && vn > 2.6 ? Math.min(1.1, (vn - 2.6) * 0.3) : 0;
      if (dist > (pull ? REACH_PULL : REACH) + ld || Math.abs(along) > o.w / 2 + 0.35) continue;
      if ((o.trigger !== 'key' && vn > 0.35) || (p.me && key && dist < REACH)) { asked = true; askSide = off > 0 ? -1 : 1; D.want = Math.max(D.want, 0.25); if (p.me) { meAsk = true; D._lead = ld; } else others = true; }
      // someone in the doorway: it stays open
      if (!atRest && Math.abs(off) < 0.85 && Math.abs(along) < o.w / 2 + 0.1 && Math.abs(D.th) > 0.5) { asked = true; D.want = Math.max(D.want, 0.3); }
    }
    D.want = Math.max(0, D.want - dt);
    if (meAsk) D._meT = 0.3; else if (D._meT > 0) D._meT -= dt;
    const mine = !!me && D._meT > 0;                                // (the local player is at this door, or was a moment ago)
    // the handle as it is now: near the latch edge of the leaf, on the face the local player is on
    let hx = 0, hz = 0, hd = 9, q = null, short = 9;
    const hy = (o.y || 0) + (o.handleY || 1.0);
    const handle = () => {
      const la = o.dir + D.th, lx = Math.sin(la), lz = Math.cos(la), lnx = Math.cos(la), lnz = -Math.sin(la), hr = HR;
      const sd = ((me.x - o.at[0]) * lnx + (me.z - o.at[1]) * lnz) > 0 ? HS : -HS;
      hx = o.at[0] + lx * hr + lnx * sd; hz = o.at[1] + lz * hr + lnz * sd; hd = Math.hypot(hx - me.x, hz - me.z);
      // …and where that is in the frame the person's character is drawn in
      if (me.ch) { q = me.map ? me.map(hx, hy, hz) : (D._q || (D._q = [0, 0, 0])); if (!me.map) { q[0] = hx; q[1] = hy; q[2] = hz; } }
    };
    if (me) handle();
    // which hand it is nearer, and how far short of it that arm would fall (0: the hand can be on it)
    if (me && me.ch) {
      const g = me.ch.group, fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y), lat = (q[0] - g.position.x) * fz - (q[2] - g.position.z) * fx;
      if (D._hand < 0.05 || D._handSide === undefined) D._handSide = lat > 0 ? 1 : -1;      // (the same hand all the way through)
      if (hd < ARM_FAR + 0.2) short = reachShort(me.ch, D._handSide, q[0], q[1], q[2]);
    }
    let started = false;
    if (asked && atRest && !D._unl) {
      // The latch gives to a hand. The local player: once their hand is on the handle — until then the leaf is a shut
      // door and holds them, at a walk or at a run. Standing where the handle cannot be reached (a deep reveal,
      // something in the way; no hand to reach with): after a beat. Someone who is not the local player: after a beat.
      // (on it = the arm really reaches it, or will within the frame or two the latch takes — reachShort; held off by a
      //  deep reveal, or come at from the hinge side, with the handle beyond the arm: at full stretch — ARM_FAR — once
      //  they can come no nearer)
      const can = mine && !!me.ch, coming = can && hd < (D._hd0 ?? 9) - 0.4 * dt, on = can && D._hand > 0.8 && ((hd < ARM && short <= REACH_TOL) || (hd < ARM_FAR && !coming));
      if (!on && (others || !coming)) D.latchT += dt;
      D._held = on;
      // (how far short of the handle the arm was when it took it: someone a wall, a table or the leaf itself will not let
      //  any nearer has their hand as near as it will go, and keeps it there until the handle moves AWAY from that)
      if (on) D._short0 = short < 9 ? short : 0;
      if (on || (others ? D.latchT > 0.12 : hd < 1.05 ? D.latchT > 0.4 : D.latchT > 1.1)) { D._unl = true; started = true; } else asked = false;
      if (!asked && (mine || others)) { D.want = Math.max(D.want, 0.05); D._reach = mine; }
    }
    D._hd0 = hd;
    if (asked) {
      D.clearT = o.hold ?? 0.9;
      if (Math.abs(D.th) < 0.06) {                                   // choosing the way it opens (only from shut)
        let sg = o.swing || askSide || D.side || 1;
        if (!o.swing && arcLimit(people, o.at[0], o.at[1], o.dir, o.w, sg, 0, fy) < 0.5 && arcLimit(people, o.at[0], o.at[1], o.dir, o.w, -sg, 0, fy) > 0.9) sg = -sg;
        D.side = sg;
      }
      if (atRest) started = true;
      D.target = OPEN;
    } else if (D.clearT > 0) { D.clearT -= dt; if (D.clearT <= 0) D.target = o.closer === false ? (o.rest ?? 0.55) : 0; }
    if (started && D.target > 0) { if (wasShut) { sound(env, 'latch'); D.stats.opens++; } D._creak = oak ? 0.12 : -1; D._th0 = Math.abs(D.th); }
    if (D._creak >= 0 && D.target > 0) { D._creak -= dt; if (D._creak < 0) sound(env, 'creak'); }
    // a door pulled open towards the local player: they wait at the edge of its arc until the leaf has swung past (eased
    // back out of it if they were standing in it), instead of walking into a door that then cannot open
    if (me && me.shove && o.swing && D.target >= OPEN && Math.abs(D.th) < PASS + 0.25) {
      const rx = me.x - o.at[0], rz = me.z - o.at[1], r = Math.hypot(rx, rz) || 1, al = rx * dx + rz * dz, off = (rx * nx + rz * nz) * o.swing, R = o.w + BODY + 0.05, need = R - r;
      if (off > 0.02 && need > 0 && Math.atan2(off, al) > Math.abs(D.th) - 0.05) {
        // out of the arc the short way: straight out from the hinge, or straight back from the doorway — and the other
        // of the two when a wall or a table is in the way of the first (a door in the corner of a room)
        const needN = Math.sqrt(Math.max(0, R * R - al * al)) - off;
        if (!(D._shvT > 0)) D._shv = needN < need + 0.25 ? 1 : 0;
        const back = D._shv === 1, k = Math.min(back ? needN : need, 3.2 * dt), ux = back ? nx * o.swing : rx / r, uz = back ? nz * o.swing : rz / r;
        const got = me.shove(ux * k, uz * k), mv = got === undefined ? k : got;
        me.x += ux * mv; me.z += uz * mv; D.stats.waited = (D.stats.waited || 0) + 1;
        if (mv < 0.4 * k) { D._shv = back ? 0 : 1; D._shvT = 0.5; } else if (D._shvT > 0) D._shvT -= dt;
      }
    }
    // never through a person: hold short of anyone in the arc (opening), wait for them to clear (closing)
    const a = Math.abs(D.th), sg = D.side;
    let tg = D.target;
    const lim = arcLimit(people, o.at[0], o.at[1], o.dir, o.w, sg, a, fy);
    if (tg > a && lim < tg) {
      tg = Math.max(a, lim); D.stats.held++;
    }
    else if (tg < a) { const fl = arcFloor(people, o.at[0], o.at[1], o.dir, o.w, sg, a, fy); if (fl > tg) { tg = fl; D.stats.held++; } }
    const s = D._s || (D._s = { th: 0, om: 0 }); s.th = a; s.om = D.om * sg;
    if (tg < a - 0.3 && !D._hiss && o.closer !== false && !oak) { D._hiss = true; sound(env, 'closer'); }
    // (the leaf has weight: it gathers way no faster than this, so whoever opened it is on it — and held by it — until it
    //  has swung far enough to let a body by; an oak door slower than a fire door)
    stepHinge(s, tg, dt, !!o.heavy, 0, Math.min(OPEN + 0.12, Math.max(lim, a)), o.closer !== false && D.target === 0, o.heavy ? V_HEAVY : o.style === 'oak' ? V_OAK : V_LIGHT);
    const was = a; D.th = s.th * sg; D.om = s.om * sg;
    if (s.th <= 0.012 && tg === 0 && D.target === 0 && (was > 0 || D._unl)) { D.th = 0; D.om = 0; D._unl = false; D._hiss = false; D.latchT = 0; if (was > 0.03) sound(env, 'shut'); }
    // (come to rest — shut, or left ajar — with nobody at it: the latch is home again, the next person needs a hand to it)
    if (!asked && D.want <= 0 && (D.th === 0 ? D.target === 0 : D.target > 0 && D.target < OPEN && D.clearT <= 0 && Math.abs(Math.abs(D.th) - D.target) < 0.05 && Math.abs(D.om) < 0.2)) { D.latchT = 0; D._unl = false; D._reach = false; D._byUse = false; D._held = false; }
    D.open = clamp(Math.abs(D.th) / OPEN, 0, 1);
    D.group.rotation.y = o.dir + D.th;
    setPass(Math.abs(D.th) > PASS);
    // The hand (the local player's character: the only one whose bones this runs after). It goes out to the handle as
    // they come up to a door at rest (sooner at a run), is on it while the latch gives, and stays on it — the arm
    // following the leaf — until the leaf has swung HAND_FOLLOW or the handle has gone out of reach; then it lets go, eased.
    const L = 1.15 + (D._lead || 0);
    // (the handle where the leaf is NOW, after this frame's swing — at 2.6 rad/s the knob moves 7 cm a frame, and a hand
    //  put where it was a frame ago trails it by that much)
    if (me && D.th !== D._thH) { handle(); if (me.ch && hd < ARM_FAR + 0.2) short = reachShort(me.ch, D._handSide, q[0], q[1], q[2]); else short = 9; }
    D._thH = D.th;
    // (not in the frame the latch gives: the hand was ON the handle for that — a fire door's leaf is 7 cm off in its first
    //  thirtieth of a second, further than a held body's arm can follow)
    if (!started && D._held && D._unl && (Math.abs(D.th) >= Math.max(HAND_FOLLOW, (D._th0 || 0) + 0.45) || hd >= ARM + 0.16 || short > LET_GO + (D._short0 || 0) || D.target < OPEN)) D._held = false;
    const reaching = !!me && !!me.ch && hd < L && (D._held || (D._reach && !D._unl));
    if (D._unl) D._reach = false;
    const near = hd < 0.8 ? 1 : hd > L ? 0 : (L - hd) / (L - 0.8);
    // (on the handle: all the way there — a hand at 0.6 of the way is 10 cm off it)
    D._hand += ((reaching ? (D._held ? 1 : near) : 0) - D._hand) * Math.min(1, dt * (reaching ? (D._held || hd < 0.8 ? 30 : 16) : 6));
    D.handAt = null;
    if (q && D._hand > 0.02) {
      reachHand(me.ch, D._handSide, q[0], q[1], q[2], D._hand);
      (D._hat || (D._hat = [0, 0]))[0] = hx; D._hat[1] = hz; D.handAt = D._hat;
      if (D._held && D._hand > 0.55) D.stats.handOn++;
    }
  };
  return D;
}
export const DOOR = { OPEN, PASS, REACH, BODY };
