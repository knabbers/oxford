// A real lift (the Mathematical Institute's; written so that any walk-in room can use it — Tesco's wants the same).
// No prompt, no fade, no teleport: a car stands at a landing with its door open; you walk in, the door slides shut,
// the car — and you with it — travels to the other landing with a hum, the door there slides open, you walk out. Standing
// at the door of the landing the car is NOT at brings it. The camera is never cut: the player's height simply follows
// the car's floor.
//
//   const lift = makeLift(ctx, game, {
//     place,                        the room's id
//     x0, x1, z0, z1,               the inside of the shaft in room coordinates (the car fills it)
//     axis: 'z' | 'x',              the way the shaft runs: its doors are in its two ends on that axis (default 'z')
//     levels: [yLow, yHigh],        floor heights of the two landings
//     ends: ['z0', 'z1'],           which end of the shaft the door of level 0 / level 1 is in (a through car: one each end;
//                                   the same end twice for an ordinary car; 'x0' / 'x1' with axis 'x')
//     doorW, doorH, start: 0 | 1,   the landing doors' clear opening; the level the car starts at
//     colliders: [[…], […]],        the collider(s) each landing's door blocks (default: all the room's)
//     mats: { wall, floor, light, rail, leaf, frame },   time: seconds a journey takes (default 5.2)
//     shift: [dx, dz],              (optional) where level 0's landing is in plan relative to level 1's, for a room whose
//                                   lower floor is not drawn under its upper one (Tesco: the basement is laid out beyond
//                                   the ground floor): x0…z1 are then the shaft at level 1, the car travels in plan as
//                                   well as in height — shut, so nobody sees it do so — and its passengers are kept in it
//   });
//   ctx.setGround((x, z) => lift.ground(x, z) ?? theRoomsOwnGround(x, z));      // inside the shaft the floor is the car's
//   lift.update(dt)                 every frame the room is shown (the room's update AND updateShown)
//   lift.state                      { level, to, y, phase: 'idle' | 'closing' | 'moving', rides, riding }
// The caller draws the shaft and keeps its walls in the collider, with the wall across each landing door left OUT of the
// collider (the door's own block is that piece of wall: on whenever the door is not open). What this file adds: the two
// landing doors (ctx.addDoor, kind 'slide': the room's ordinary automatic pair, here only allowed to answer while the
// car is at their landing), the car, the travel, the sounds.
// Tried: axis 'z', a through car, no shift (tools/smoke_maths.mjs rides it three times). NOT yet tried in a room: axis
// 'x' and `shift`.
// Limits: the car is moved by the local player only (another player's lift is theirs: you see them walk into a shut door).
import * as THREE from 'three';
import { Batch } from './_maths_geo.js';

const NONE = [];

export function makeLift(ctx, game, o) {
  // inside this file: a = across the shaft, b = along it (the axis its doors are on)
  const AX = o.axis === 'x', a0 = AX ? o.z0 : o.x0, a1 = AX ? o.z1 : o.x1, b0 = AX ? o.x0 : o.z0, b1 = AX ? o.x1 : o.z1;
  const { levels } = o, ca = (a0 + a1) / 2, W = o.doorW || 1.2, H = o.doorH || 2.1, T = o.time || 5.2, CH = o.carH || 2.3;
  const ends = o.ends || (AX ? ['x0', 'x1'] : ['z0', 'z1']), M = o.mats || {};
  const SH = o.shift || [0, 0], sa = AX ? SH[1] : SH[0], sb = AX ? SH[0] : SH[1], moves = !!(sa || sb), offA = (k) => (k === 0 ? sa : 0), offB = (k) => (k === 0 ? sb : 0);
  const s0 = o.start ?? 1;
  const st = { level: s0, to: s0, y: levels[s0], oa: offA(s0), ob: offB(s0), phase: 'idle', t: 0, callT: 0, armed: true, rides: 0, riding: false, humAt: 0, near: false };
  // ---------------------------------------------------------------- the car: floor, ceiling with a light panel, two side walls, a rail
  const car = new THREE.Group(); car.name = 'lift-car';
  {
    const B = new Batch(), e = 0.03, aa = a0 + e, ab = a1 - e, ba = b0 + 0.06, bb = b1 - 0.06, bm = (ba + bb) / 2;
    const box = (k, p, y0, q, r, y1, s, opt) => (AX ? B.aabb(k, q, y0, p, s, y1, r, opt) : B.aabb(k, p, y0, q, r, y1, s, opt));      // (a, y, b) corners
    box('floor', aa, 0, ba, ab, 0.02, bb);
    box('wall', aa, CH, ba, ab, CH + 0.04, bb, { bottom: true });
    box('light', ca - 0.45, CH - 0.012, bm - 0.5, ca + 0.45, CH - 0.002, bm + 0.5, { bottom: true });
    box('wall', aa, 0, ba, aa + 0.02, CH, bb); box('wall', ab - 0.02, 0, ba, ab, CH, bb);
    for (const a of [aa + 0.07, ab - 0.07]) box('rail', a - 0.018, 0.93, ba + 0.25, a + 0.018, 0.965, bb - 0.25, { bottom: true });
    // the returns either side of each opening, and the head over it
    for (const b of [ba, bb]) { box('wall', aa, 0, b - 0.01, ca - W / 2 - 0.02, CH, b + 0.01); box('wall', ca + W / 2 + 0.02, 0, b - 0.01, ab, CH, b + 0.01); box('wall', ca - W / 2 - 0.02, H, b - 0.01, ca + W / 2 + 0.02, CH, b + 0.01); }
    // the indicator over each door, inside: a dark strip (its lamp, below, runs along it with the car's height)
    for (const [b, sg] of [[ba, 1], [bb, -1]]) box('rail', ca - 0.32, H + 0.05, b + sg * 0.011, ca + 0.32, H + 0.13, b + sg * 0.02, { bottom: true });
    for (const m of B.build({ wall: M.wall, floor: M.floor || M.wall, light: M.light || M.wall, rail: M.rail || M.wall, default: M.wall }, car)) { m.name = 'lift-car:' + m.name; m.castShadow = false; m.receiveShadow = false; }
    const lamp = new THREE.PointLight(0xfff4e4, 5, 5, 1.6); lamp.position.set(AX ? bm : ca, CH - 0.3, AX ? ca : bm); car.add(lamp);
  }
  // the car's own doors: a pair at each end, shut except at the landing the car stands at (they part with that landing's
  // door); and the indicator lamps
  const leafG = new THREE.BoxGeometry(AX ? 0.03 : W / 2, H, AX ? W / 2 : 0.03); leafG.translate(0, H / 2, 0);
  const dotG = new THREE.BoxGeometry(AX ? 0.012 : 0.07, 0.05, AX ? 0.07 : 0.012);
  const carLeaves = [0, 1].map((e) => [-1, 1].map((sg) => { const m = new THREE.Mesh(leafG, M.leaf || M.wall), b = e ? b1 - 0.085 : b0 + 0.085; m.name = 'lift-car:leaf'; m.userData.a = ca + sg * W / 4; m.userData.sg = sg; if (AX) m.position.set(b, 0, m.userData.a); else m.position.set(m.userData.a, 0, b); m.castShadow = false; car.add(m); return m; }));
  const dots = [0, 1].map((e) => { const m = new THREE.Mesh(dotG, M.light || M.wall), b = e ? b1 - 0.085 : b0 + 0.085; m.name = 'lift-car:lamp'; if (AX) m.position.set(b, H + 0.09, ca); else m.position.set(ca, H + 0.09, b); car.add(m); return m; });
  const slid = [-1, -1]; let dotY = NaN;
  const dress = () => {
    for (let e = 0; e < 2; e++) {
      const s = st.phase !== 'moving' && /1$/.test(ends[st.level]) === !!e ? doors[st.level].slide : 0;
      if (s !== slid[e]) { slid[e] = s; for (const m of carLeaves[e]) { const a = m.userData.a + m.userData.sg * s; if (AX) m.position.z = a; else m.position.x = a; } }
    }
    if (st.y !== dotY) { dotY = st.y; const a = ca - 0.27 + 0.54 * (st.y - levels[0]) / ((levels[1] - levels[0]) || 1); for (const m of dots) { if (AX) m.position.z = a; else m.position.x = a; } }
  };
  const place = () => car.position.set(AX ? st.ob : st.oa, st.y, AX ? st.oa : st.ob);
  place(); ctx.scene.add(car);
  // ---------------------------------------------------------------- the landing doors
  const doors = [0, 1].map((k) => {
    const far = /1$/.test(ends[k]), b = (far ? b1 : b0) + offB(k), bi = far ? b - 0.035 : b + 0.035, a = ca + offA(k);      // (the leaves on the shaft side of the wall: they slide away behind it)
    // (dir: the leaves slide across the shaft; the door's normal n = (cos dir, -sin dir) points out on to the landing)
    const dir = AX ? (far ? 0 : Math.PI) : far ? -Math.PI / 2 : Math.PI / 2;
    const D = ctx.addDoor({ kind: 'slide', style: 'steel', kick: false, closerBox: false, glazed: false, at: AX ? [bi, a] : [a, bi], y: levels[k], w: W, h: H, dir,
      mats: { leaf: M.leaf || M.wall, handle: M.frame || M.wall, frame: M.frame || M.wall }, rangeOut: o.rangeOut ?? 1.9, rangeIn: 2.4, hold: 0.9,
      block: AX ? [b, a - W / 2, b, a + W / 2] : [a - W / 2, b, a + W / 2, b], colliders: o.colliders ? o.colliders[k] : undefined });
    const upd = D.update;
    D.allowed = false;
    D.update = (dt, people, env) => upd(dt, D.allowed ? people : NONE, env);
    return D;
  });
  const audio = () => { const a = game.audio; return a && a.ctx ? a : null; };
  const hum = (dur) => { const a = audio(); if (!a || !st.near) return; try { const pos = car.position; a.tone(58, dur, { type: 'sawtooth', gain: 0.02, attack: 0.5, pos }); a.tone(116.6, dur, { type: 'triangle', gain: 0.02, attack: 0.6, pos }); a.noise(dur, { gain: 0.026, freq: 170, q: 0.7, attack: 0.5, pos }); } catch { /* */ } };      // (spatial sound: from the car — core/audio.js)
  const ding = () => { const a = audio(); if (!a || !st.near) return; try { const pos = car.position; a.tone(1318.5, 0.55, { type: 'sine', gain: 0.05, pos }); a.tone(1046.5, 0.8, { type: 'sine', gain: 0.05, when: 0.2, pos }); a.noise(0.12, { gain: 0.05, freq: 240, q: 1.2, pos }); } catch { /* */ } };
  /** is someone of ours standing at landing k's door (outside the shaft, within reach, on that floor)? (pa, pb: across / along) */
  const atLanding = (k, pa, py, pb) => { const far = /1$/.test(ends[k]), d = far ? pb - b1 - offB(k) : b0 + offB(k) - pb; return d > 0 && d < 1.7 && Math.abs(pa - ca - offA(k)) < W / 2 + 0.45 && Math.abs(py - levels[k]) < 0.6; };

  function update(dt) {
    const p = game.player, here = p.place === o.place, py = p.pos.y, pa = AX ? p.pos.z : p.pos.x, pb = AX ? p.pos.x : p.pos.z, ra = pa - st.oa, rb = pb - st.ob;      // (ra, rb: in the car's own plan)
    const inShaft = here && ra > a0 && ra < a1 && rb > b0 && rb < b1 && py > st.y - 0.7 && py < st.y + CH;
    // (aboard: in the car and clear of the door that is open — standing against the far end is as far in as one can get)
    const aboard = inShaft && (/1$/.test(ends[st.level]) ? rb < b1 - 0.34 : rb > b0 + 0.34);
    st.near = here && Math.abs(ra - ca) + Math.abs(rb - (b0 + b1) / 2) < 16;
    if (st.phase === 'idle') {
      if (aboard) { st.callT = 0; if (st.armed && (st.t += dt) > 0.7) { st.phase = 'closing'; st.to = 1 - st.level; st.t = 0; } }
      else {
        st.t = 0; if (!inShaft) st.armed = true;
        const other = 1 - st.level;
        if (here && !inShaft && atLanding(other, pa, py, pb)) { if ((st.callT += dt) > 0.35) { st.phase = 'closing'; st.to = other; st.callT = 0; } } else st.callT = 0;
      }
    } else if (st.phase === 'closing') {
      if (inShaft && !aboard) { st.phase = 'idle'; st.to = st.level; st.t = 0; }      // (someone in the doorway: it opens again)
      else { const D = doors[st.level]; if (!D.passable && D.slide < 0.012) { st.phase = 'moving'; st.t = 0; st.riding = inShaft; st.humAt = 0; if (st.riding) st.rides++; } }
    } else {
      st.t += dt;
      if (st.t >= st.humAt) { hum(Math.min(2.4, T - st.humAt) + 0.5); st.humAt += 2.2; }
      const u = Math.min(1, st.t / T), s = u * u * u * (u * (6 * u - 15) + 10), from = st.level;      // (eased at both ends: no start or stop in the knees)
      st.y = levels[from] + (levels[st.to] - levels[from]) * s;
      if (moves) { st.oa = offA(from) + (offA(st.to) - offA(from)) * s; st.ob = offB(from) + (offB(st.to) - offB(from)) * s; }
      if (u >= 1) { st.y = levels[st.to]; st.oa = offA(st.to); st.ob = offB(st.to); st.level = st.to; st.phase = 'idle'; st.t = 0; st.armed = false; st.callT = 0; ding(); }
      if (moves) place(); else car.position.y = st.y;
      if (st.riding && here && ra > a0 && ra < a1 && rb > b0 && rb < b1) {
        p.pos.y = st.y; p.vy = 0; p.onGround = true;
        if (moves) {      // (carried in plan too, and kept inside the car: no wall of the room travels with it)
          const r = 0.33, na = st.oa + Math.max(a0 + r, Math.min(a1 - r, ra)), nb = st.ob + Math.max(b0 + r, Math.min(b1 - r, rb));
          if (AX) { p.pos.z = na; p.pos.x = nb; } else { p.pos.x = na; p.pos.z = nb; }
          p.character.group.position.x = p.pos.x; p.character.group.position.z = p.pos.z;
        }
        p.character.group.position.y = st.y; if (u >= 1) st.riding = false;
      }
    }
    doors[0].allowed = st.phase === 'idle' && st.level === 0; doors[1].allowed = st.phase === 'idle' && st.level === 1;
    dress();
  }
  const inside = (x, z, m) => { const a = (AX ? z : x) - st.oa, b = (AX ? x : z) - st.ob; return a > a0 - m && a < a1 + m && b > b0 - m && b < b1 + m; };
  return {
    car, doors, state: st, update,
    /** the car's floor, if (x, z) is in the shaft (where the car is now); else null */
    ground(x, z) { return inside(x, z, 0.01) ? st.y : null; },
    inShaft: (x, z) => inside(x, z, 0),
  };
}
