// Pelican crossings that work (fidelity pass, 2026-11). The streetscape already stands a signal pole with a yellow
// push-button box at each kerb of every signal-controlled pedestrian crossing the map has (crossing=traffic_signals:
// ~50 crossings, ~100 poles). Now the button does something:
//   [E] Press the button   at either pole: WAIT lights on the box; 2.5 s later the traffic's lights go amber, then
//                          red, and the traffic STOPS at the stop lines — AI cars, buses, vans and cyclists, whoever
//                          simulates them; the green man shows on the far pole and the crossing bleeps; then flashing
//                          amber and a flashing green man (a pelican), then green again. A crossing that has just run
//                          will not run again for 5 s. Nothing stops YOU driving through a red light.
//   rule       the cycle is a pure function of the moment it was called (phaseAt): everything drawn, heard and stopped
//              follows from one number per crossing
//   multiplayer nothing new on the wire. Pressing puts the presser's pose to 'talk' (an existing pose: hand out to the
//              box) for 0.6 s; every client that sees a player in that pose within reach of a pole calls that crossing
//              itself, on the next whole second of the shared clock, so the cycles agree to within a second (usually
//              exactly). Whoever owns a vehicle stops it: the stop lines are pedestrians.addObstacle circles, which
//              traffic.js already stops short of on every client
//   drawn      the poles are the streetscape's (their lenses are always-lit vertices), so the changed lamps are a small
//              overlay: ONE unlit draw of a few quads over the lenses of crossings that are mid-cycle, in the scene only
//              then (idle crossings cost nothing and look exactly as before)
//   off        ?crossings=0 (node: GTO_CROSSINGS=0)
//   cost       idle: a 5 Hz nearest-pole lookup on foot + a pose test per other player. Mid-cycle: ≤ 60 quads rewritten
//              when a lamp changes, one bleep four times a second while the green man shows
// game.crossings = { ready, list, phaseAt(c, ms), press(c, ms?), near, stats() }     test: tools/smoke_fidelity.mjs
import * as THREE from 'three';
import { fidOn } from './_fid.js';

export const TIMES = { wait: 2500, amber: 1500, flash: 2500, lock: 5000, stopLead: 600 };
const STOP = 3.4, REACH = 1.5, SEE = 110, MAXQ = 240, PRESS_POSE = 'talk', PRESS_S = 0.6;
const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
/** pure: how long the traffic is held at red on a carriageway of half width hw (ms) */
export const redMs = (hw) => Math.round(6000 + 700 * Math.max(2, Math.min(7, hw)));
/** pure: the whole cycle from the call to green again (ms) */
export const cycleMs = (hw) => TIMES.wait + TIMES.amber + redMs(hw) + TIMES.flash;
/**
 * pure: where a crossing called at t0 (shared ms; null = never) is at time ms.
 * -> { name: 'idle' | 'wait' | 'amber' | 'red' | 'flash', stop (traffic must be held), man (green man showing), blink }
 */
export function phaseAt(t0, hw, ms, out = {}) {
  out.name = 'idle'; out.stop = false; out.man = false; out.blink = false; out.u = 0;
  if (t0 === null || t0 === undefined) return out;
  let t = ms - t0; if (t < 0 || t >= cycleMs(hw)) return out;
  if (t < TIMES.wait) { out.name = 'wait'; return out; }
  t -= TIMES.wait;
  if (t < TIMES.amber) { out.name = 'amber'; out.stop = t >= TIMES.stopLead; return out; }
  t -= TIMES.amber;
  const R = redMs(hw);
  if (t < R) { out.name = 'red'; out.stop = true; out.man = true; out.u = t / R; return out; }
  t -= R; out.name = 'flash'; out.blink = Math.floor(t / 250) % 2 === 0; out.man = out.blink;
  return out;
}
/** pure: the moment a call made at ms takes effect (the next whole second of the shared clock, 0.4 s ahead at least) */
export const callTime = (ms) => Math.ceil((ms + 400) / 1000) * 1000;
/** pure: may a crossing last called at t0 be called at ms? */
export const callable = (t0, hw, ms) => t0 === null || t0 === undefined || ms >= t0 + cycleMs(hw) + TIMES.lock;

/** pure: the stop-line circles of a crossing {cx, cz, dx, dz, hw, oneway} -> [[x, z, r], ...] */
export function stopCircles(c) {
  const out = [], lx = c.dz, lz = -c.dx;          // the left of the direction of travel d (keep left)
  const row = (sx, sz, a, b) => { for (let t = a; t <= b + 1e-6; t += 1.15) out.push([sx + lx * t, sz + lz * t, 0.55]); };
  if (c.oneway) row(c.cx - c.dx * STOP * c.oneway, c.cz - c.dz * STOP * c.oneway, -c.hw + 0.6, c.hw - 0.6);
  else { row(c.cx - c.dx * STOP, c.cz - c.dz * STOP, 0.6, Math.max(0.6, c.hw - 0.5)); row(c.cx + c.dx * STOP, c.cz + c.dz * STOP, -Math.max(0.6, c.hw - 0.5), -0.6); }
  return out;
}

export default {
  id: 'crossings',
  install(game) {
    if (!fidOn('crossings')) { game.crossings = { off: true, ready: false, list: [], near: null, phaseAt: () => ({ name: 'idle' }), press: () => false, stats: () => ({ off: true, crossings: 0, poles: 0 }) }; return null; }
    const list = [], poles = [], V = new THREE.Vector3(), ph = {};
    let ready = false, cur = null, scanT = 0, pressT = 0, presses = 0, heard = 0, beepT = 0, key = '', inScene = false, held = 0, prevPose = 'stand';
    // ---- the lamp overlay
    const pos = new Float32Array(MAXQ * 12), col = new Float32Array(MAXQ * 12), idx = new Uint16Array(MAXQ * 6);
    for (let q = 0; q < MAXQ; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, mat); mesh.name = 'fidelity:crossingLamps'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    (game.warmups || (game.warmups = [])).push({ id: 'crossings', fn: () => { const PW = game.prewarm; if (PW && PW.extras) PW.extras.push({ o: mesh, pre: (x, y, z) => { const n = geo.drawRange.count; if (!n) { for (let i = 0; i < 12; i++) pos[i] = i % 3 === 0 ? x : i % 3 === 1 ? y - 3 : z; geo.attributes.position.needsUpdate = true; geo.setDrawRange(0, 6); } return () => { geo.setDrawRange(0, n); }; } }); return null; } });
    let nq = 0;
    /** a quad in a pole's frame: centre (lx, ly, lz), w x h, facing local +z (face 0) or +x (face 1) */
    const quad = (p, lx, ly, lz, w, h, face, r, g, b) => {
      if (nq >= MAXQ) return;
      const c = Math.cos(p.h), s = Math.sin(p.h), o = nq * 12, hw = w / 2, hh = h / 2;
      for (let k = 0; k < 4; k++) {
        const u = k === 0 || k === 3 ? -hw : hw, v = k < 2 ? -hh : hh, x = face ? lx : lx + u, z = face ? lz - u : lz;
        pos[o + k * 3] = p.x + x * c + z * s; pos[o + k * 3 + 1] = p.y + ly + v; pos[o + k * 3 + 2] = p.z - x * s + z * c;
        col[o + k * 3] = r; col[o + k * 3 + 1] = g; col[o + k * 3 + 2] = b;
      }
      nq++;
    };
    const lamps = (p, f) => {
      const X = 0.259, Zm = 0.1415;
      if (f.name === 'wait' || f.name === 'amber') {                                                                        // WAIT on the box: front and both sides
        quad(p, 0, 1.17, Zm + 0.001, 0.1, 0.034, 0, 1.0, 0.72, 0.25);
        quad(p, 0.0765, 1.17, 0.09, 0.07, 0.034, 1, 1.0, 0.72, 0.25); quad(p, -0.0765, 1.17, 0.09, 0.07, 0.034, 1, 1.0, 0.72, 0.25);
      }
      if (f.name === 'wait') return;
      quad(p, X, 2.065, 0, 0.17, 0.17, 1, 0.012, 0.03, 0.016);                                                              // the green lens out
      if (f.name === 'red') quad(p, X, 2.605, 0, 0.15, 0.15, 1, 1.0, 0.1, 0.06);
      else if (f.name === 'amber' || f.blink) quad(p, X, 2.335, 0, 0.15, 0.15, 1, 1.0, 0.62, 0.05);
      if (f.name === 'red' || f.name === 'flash') {
        quad(p, 0, 3.1, Zm, 0.22, 0.22, 0, 0.012, 0.014, 0.012);                                                            // the red man out
        if (f.man) { const G = [0.15, 1.0, 0.4], z = Zm + 0.002;                                                            // the green man, walking
          quad(p, 0.004, 3.172, z, 0.034, 0.034, 0, ...G); quad(p, 0, 3.118, z, 0.046, 0.064, 0, ...G);
          quad(p, -0.026, 3.05, z, 0.02, 0.07, 0, ...G); quad(p, 0.028, 3.05, z, 0.02, 0.07, 0, ...G);
          quad(p, 0.04, 3.126, z, 0.016, 0.046, 0, ...G); quad(p, -0.04, 3.132, z, 0.016, 0.04, 0, ...G); }
      }
    };
    function build() {
      const st = game.streetscape; if (!st || !st.items || (st.stats && !st.stats().ready)) return false;
      const map = game.map, segs = [];
      for (const r of map.roads) if (DRIVE.has(r.kind) && r.pts && !game.overrides.skip.has(r.id)) for (let i = 1; i < r.pts.length; i++) segs.push([r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1], r]);
      const sig = st.items.filter((it) => it.k === 'pedSig' && !it.gone);
      for (const p of map.pois) {
        if (p.kind !== 'crossing' || p.crossing !== 'traffic_signals' || game.overrides.skip.has(p.id)) continue;
        let best = null;
        for (const s of segs) {
          if (Math.min(s[0], s[2]) - 9 > p.p[0] || Math.max(s[0], s[2]) + 9 < p.p[0] || Math.min(s[1], s[3]) - 9 > p.p[1] || Math.max(s[1], s[3]) + 9 < p.p[1]) continue;
          const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1; let t = ((p.p[0] - s[0]) * dx + (p.p[1] - s[1]) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const d = Math.hypot(p.p[0] - s[0] - dx * t, p.p[1] - s[1] - dz * t);
          if (d <= 8 && (!best || d < best.d)) best = { d, s, t };
        }
        if (!best) continue;
        const s = best.s, r = s[4], L = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1, dx = (s[2] - s[0]) / L, dz = (s[3] - s[1]) / L;
        const cx = s[0] + (s[2] - s[0]) * best.t, cz = s[1] + (s[3] - s[1]) * best.t, hw = (r.w || 6.5) / 2;
        const mine = sig.filter((it) => !it._cx && Math.hypot(it.x - cx, it.z - cz) < hw + 5);
        if (!mine.length) continue;
        const ow = r.oneway === true || r.oneway === 'yes' || r.oneway === 1 ? 1 : r.oneway === '-1' || r.oneway === -1 ? -1 : 0;
        const c = { id: p.id, n: list.length, cx, cz, dx, dz, hw, oneway: ow, road: r.name || '', t0: null, poles: [], obsFor: null, circles: null };
        for (const it of mine) { it._cx = c; const pole = { x: it.x, y: it.y || 0, z: it.z, h: it.h, it, c }; c.poles.push(pole); poles.push(pole); }
        c.circles = stopCircles(c);
        list.push(c);
      }
      return true;
    }
    const nearPole = (x, z, r) => { let best = null, bd = r * r; for (const p of poles) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd && !p.it.gone && !p.it.taken) { bd = d; best = p; } } return best; };
    /** call crossing c at (shared) time ms; false while it is running or locked out */
    function press(c, ms = game.time.now()) {
      if (!c || !callable(c.t0, c.hw, ms)) return false;
      c.t0 = callTime(ms); c.obsFor = null;
      return true;
    }
    function localPress() {
      const P = game.player, p = cur; if (!p || P.vehicle || game.activity) return;
      if (!press(p.c, game.time.now())) return;
      presses++;
      P.heading = Math.atan2(p.x - P.pos.x, p.z - P.pos.z); prevPose = P.pose === PRESS_POSE ? 'stand' : P.pose; P.pose = PRESS_POSE; pressT = PRESS_S;
      try { const A = game.audio; if (A && A.ctx && A.tone) A.tone(1900, 0.03, { type: 'square', gain: 0.05 }); } catch { /* */ }
    }
    const mine = game.interact.add({ pos: () => (cur ? V.set(cur.x, cur.y, cur.z) : null), radius: REACH, label: 'Press the button', enabled: () => !!cur && callable(cur.c.t0, cur.c.hw, game.time.now()), onUse: localPress });
    game.crossings = { get ready() { return ready; }, list, poles, get near() { return cur; }, phaseAt: (c, ms = game.time.now()) => phaseAt(c.t0, c.hw, ms, {}), press, stopCircles, cycleMs, callTime, get mesh() { return mesh; }, _item: mine,
      stats: () => ({ ready, crossings: list.length, poles: poles.length, presses, heard, held, quads: nq, inScene, draws: inScene ? 1 : 0, running: list.filter((c) => phaseAt(c.t0, c.hw, game.time.now(), ph).name !== 'idle').length }) };
    return {
      id: 'crossings',
      update(dt) {
        if (!ready) { ready = build(); if (!ready) return; }
        const P = game.player, now = game.time.now(), out = P.place === 'world';
        if (pressT > 0) { pressT -= dt; if (pressT <= 0 && P.pose === PRESS_POSE) P.pose = prevPose; }
        // ---- another player pressing (their pose says so): call it here too
        if (game.net && game.net.others.size) for (const o of game.net.others.values()) {
          if (o.pose !== PRESS_POSE || o.place !== 'world') { o._xp = false; continue; }
          if (o._xp) continue; o._xp = true;
          const p = nearPole(o.x, o.z, REACH + 0.6); if (p && press(p.c, now - 250)) heard++;
        }
        if ((scanT -= dt) <= 0) { scanT = 0.2; cur = out && !P.vehicle && !P.swim && !game.activity ? nearPole(P.pos.x, P.pos.z, REACH) : null; }
        // ---- crossings mid-cycle: hold the traffic, light the lamps, bleep
        let k = '', any = false, bleep = null;
        nq = 0;
        for (const c of list) {
          if (c.t0 === null) continue;
          const f = phaseAt(c.t0, c.hw, now, ph);
          if (f.name === 'idle') { if (now > c.t0 + cycleMs(c.hw) + TIMES.lock) { c.t0 = null; c.obsFor = null; } continue; }
          if (f.stop && c.obsFor !== c.t0 && game.pedestrians && game.pedestrians.addObstacle) {
            c.obsFor = c.t0; held++;
            const until = c.t0 + TIMES.wait + TIMES.amber + redMs(c.hw);
            for (const q of c.circles) game.pedestrians.addObstacle({ x: q[0], z: q[1], r: q[2], until });
          }
          const d2 = (c.cx - P.pos.x) ** 2 + (c.cz - P.pos.z) ** 2;
          if (!out || d2 > SEE * SEE) continue;
          any = true; k += c.n + f.name[0] + (f.blink ? 1 : 0) + ',';
          for (const p of c.poles) if (!p.it.gone && !p.it.taken) lamps(p, f);
          if (f.name === 'red' && d2 < 30 * 30 && (!bleep || d2 < bleep.d2)) bleep = { c, d2 };
        }
        if (k !== key) {
          key = k;
          geo.setDrawRange(0, nq * 6); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
          if (any && nq && !inScene) { game.worldScene.add(mesh); inScene = true; } else if ((!any || !nq) && inScene) { game.worldScene.remove(mesh); inScene = false; }
        }
        if (bleep && (beepT -= dt) <= 0) {
          beepT = 0.25;
          try { const A = game.audio; if (A && A.ctx && A.tone) { const pl = A.place ? A.place(bleep.c.cx, bleep.c.cz, 30) : { pan: 0, gain: 1 }; if (pl.gain > 0.02) A.tone(2450, 0.07, { type: 'square', gain: 0.035 * pl.gain, pan: pl.pan }); } } catch { /* */ }
        }
      },
    };
  },
};
