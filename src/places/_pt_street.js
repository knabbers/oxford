// Purple Turtle — everyone outside: two bouncers, the queue (grows 22:30–00:30, shuffles forward one admission at a time),
// smokers, the kebab van and its customers, people leaving in ones, twos and groups, couples going home together (out
// of the door hand in hand or arm in arm, a quick peck under the lantern, cheesy chips from the van, the walk to a college
// lodge or house door, the fumble for a key or Bod card, in, door shut — nothing more), and night-street vignettes
// (singers, a traffic cone, a friend being carried). Everything that matters is derived from the shared clock, so two
// players watching the door see the same people leave together.
import * as THREE from 'three';
import * as Lg from './_pt_logic.js';
import { SPEECH, ambientLine } from '../systems/_street_lines.js';
import { ALLEY, VAN, resolveDestinations, buildRoute, alleyPoints, STREET_ENDS, vignettesForNight } from './_pt_routes.js';
import { clubLook, staffLook, bouncerLook, makeChar, freeChar, earpiece, chipsBox, trafficCone, couplePose, holdTweak, kissTweak, chipsTweak, fumbleTweak, carryTweak, smokeHand,
  QUEUE_LINES, BOUNCER_LINES, STREET_LINES } from './_pt_chars.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const VIS = 115, ANIM = 65, MAX_VIS = 22;
const DOOR_COLS = [0x1a2a1a, 0x1a1a2a, 0x2a1a12, 0x101010, 0x3a1010];

export function createStreet(game, ext, audio) {
  const scene = game.worldScene, P = ALLEY.P;
  const actors = new Map();          // key -> actor {key, ch, x, z, h, speed, pose, alive, kind, lines, ...}
  const doors = new Map();           // dest index -> {g, open}
  const S = { doorOpen: 0, extra: [], forcedQueue: null, playerJoin: null, routeCache: new Map(), rctx: null, lastF: null, sayT: 2, fixedT: 0, fixedSig: '', t: 0, night: null, events: [], vign: [] };
  const rank = [], tmp = {}, tmp2 = {}, cam = new THREE.Vector3(), wp = new THREE.Vector3();
  const doorPt = P(ALLEY.door[0], ALLEY.door[1]), inPt = P(ALLEY.doorIn[0], ALLEY.doorIn[1]);

  // ------------------------------------------------------------------ routing context (pedestrian graph)
  function rctx() {
    if (S.rctx) return S.rctx;
    const G = game.pedestrians && game.pedestrians.graph;
    if (!G) return { G: null, dests: [], alleyNode: -1, vanNode: -1 };
    const ap = alleyPoints(), aEnd = ap[ap.length - 1], vs = VAN.spot(0);
    const alleyNode = Lg.nearestGraphNode(G, aEnd[0], aEnd[1], 25), vanNode = Lg.nearestGraphNode(G, vs[0], vs[1], 25);
    const col = game.worldCollider, blocked = (a, b, c, d) => col.raycast(a, b, c, d) !== null;
    let dests = [];
    try { dests = resolveDestinations(game.map, G, blocked, alleyNode); } catch (e) { console.warn('[purple_turtle] destinations', e); }
    S.rctx = { G, dests, alleyNode, vanNode };
    return S.rctx;
  }
  // at most one new route a frame (a graph search each; nightfall used to build a dozen at once): an event whose route
  // is not built yet waits a frame (its walkers come out one frame late; positions are from the clock, so nothing drifts)
  let routeFrame = -1;
  function routeFor(ev, wait) {
    const c = rctx(), key = `${c.dests.length ? ev.dest % c.dests.length : 0}|${ev.chips ? 1 : 0}|${ev.kiss ? 1 : 0}|${(ev.speed || 1.1).toFixed(2)}|${ev.couple ? 1 : 0}`;
    let r = S.routeCache.get(key);
    if (!r) { if (wait && routeFrame === S.frame) return null; routeFrame = S.frame; r = buildRoute(c, ev); S.routeCache.set(key, r); }
    return r;
  }
  function vignetteRoute(v) {
    const key = 'v' + v.a + '-' + v.b; let r = S.routeCache.get(key);
    if (!r) {
      const c = rctx(), A = STREET_ENDS[v.a], B = STREET_ENDS[v.b];
      let pts = [A, B];
      if (c.G) { const a = Lg.nearestGraphNode(c.G, A[0], A[1], 30), b = Lg.nearestGraphNode(c.G, B[0], B[1], 30), p = Lg.graphPath(c.G, a, b); if (p && p.length > 1) pts = p.map((i) => [c.G.X[i], c.G.Z[i]]); }
      const cum = Lg.cumLen(pts); r = { pts, cum, tl: Lg.makeTimeline(cum[cum.length - 1], [], v.speed) }; S.routeCache.set(key, r);
    }
    return r;
  }

  // ------------------------------------------------------------------ actors
  // at most 3 new characters per frame (arriving at a busy Frewin Court used to build ~20 in one 50 ms frame);
  // callers skip an actor for a frame when actor() returns null
  let madeFrame = -1, made = 0;
  function actor(key, lookFn, init) {
    let a = actors.get(key);
    if (!a) {
      if (madeFrame !== S.frame) { madeFrame = S.frame; made = 0; }
      if (made >= 3) return null;
      made++;
      a = { key, ch: makeChar(lookFn(), scene), x: init.x, z: init.z, h: init.h || 0, speed: 0, pose: null, kind: init.kind || '', lines: init.lines || null, seen: 0, said: {} };
      if (init.setup) init.setup(a);
      actors.set(key, a);
    }
    a.alive = S.frame;
    return a;
  }
  function drop(a) { freeChar(a.ch); actors.delete(a.key); }
  function setPose(a, p) { if (a.ch.pose !== p && !(p === 'stand' && (a.ch.pose === 'holding-hands' || a.ch.pose === 'arm-in-arm') && a.keepCouple)) a.ch.setPose(p); }
  function walkTo(a, tx, tz, v, dt) {
    const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    if (d < 0.04) { a.speed = 0; return 0; }
    const st = Math.min(d, v * dt); a.x += (dx / d) * st; a.z += (dz / d) * st; a.speed = dt > 0 ? st / dt : 0;
    a.h += wrapA(Math.atan2(dx, dz) - a.h) * Math.min(1, dt * 8);
    return d - st;
  }
  function face(a, h, dt) { a.h += wrapA(h - a.h) * Math.min(1, dt * 5); }

  // ------------------------------------------------------------------ fixed people: bouncers, smokers, van, a friend being looked after
  function fixedSpecs(st) {
    const out = [];
    if (st.open) {
      out.push({ key: 'b0', look: () => bouncerLook(11), x: P(0.62, -0.45), h: ALLEY.hOut + 0.5, pose: 'stand', lines: BOUNCER_LINES, setup: (a) => earpiece(a.ch), bouncer: true });
      out.push({ key: 'b1', look: () => bouncerLook(24), x: P(2.98, -0.45), h: ALLEY.hOut - 0.5, pose: 'stand', lines: BOUNCER_LINES, setup: (a) => earpiece(a.ch), bouncer: true });
      const ns = st.density > 0.6 ? 3 : st.density > 0.12 ? 2 : 0;
      const spots = [[-1.7, -0.55, 0], [-2.5, -1.35, 1], [-3.25, -0.6, 2]];
      for (let i = 0; i < ns; i++) { const [u, v] = spots[i], p = P(u, v), c = P(-2.5, -0.85);
        out.push({ key: `sm${st.night}:${i}`, look: () => clubLook(Lg.hash('smoke', st.night, i) * 1e9 | 0, st.state), x: p, h: Math.atan2(c[0] - p[0], c[1] - p[1]), pose: i === 1 ? 'talk' : 'stand', lines: QUEUE_LINES, smoker: i !== 1 }); }
      if (st.nh > 3.4 && Lg.hash('lookedafter', st.night) < 0.5) {
        const p = P(-4.3, -1.85), q = P(-3.65, -1.45);
        out.push({ key: `la${st.night}:0`, look: () => clubLook(Lg.hash('la0', st.night) * 1e9 | 0, 0.9, { prop: 'bottle' }), x: p, h: ALLEY.hOut + Math.PI, pose: 'sitground', lines: ['I love you guys.', "I'm FINE.", 'Is it morning?'] });
        out.push({ key: `la${st.night}:1`, look: () => clubLook(Lg.hash('la1', st.night) * 1e9 | 0, 0.7), x: q, h: Math.atan2(p[0] - q[0], p[1] - q[1]), pose: 'crouch', lines: ['Drink some water, babe.', "We're getting you home.", 'Deep breaths. Good.'] });
      }
    }
    if (st.vanOpen) {
      out.push({ key: 'vendor', look: () => staffLook(777, { top: 0xf0f0f0, topStyle: 'tee' }), x: VAN.vendor, h: VAN.vendorH, pose: 'talk', lines: ['Chilli sauce?', 'Cheesy chips, two fifty.', 'Next!', 'Salt and vinegar?'] });
      const nv = st.open ? (st.density > 0.5 ? 2 : 1) : st.nh > 5.4 && st.nh < 7 ? 2 : 0;
      for (let i = 0; i < nv; i++) out.push({ key: `vq${st.night}:${i}`, look: () => clubLook(Lg.hash('vanq', st.night, i) * 1e9 | 0, Math.min(1, st.state + 0.1)), x: VAN.spot(i + 1), h: VAN.face, pose: i ? 'drunk' : 'stand', lines: STREET_LINES.leave });
    }
    return out;
  }

  // ------------------------------------------------------------------ the queue
  function queueTick(dt, st, T) {
    const Q = S.forcedQueue !== null ? S.forcedQueue : Lg.queueLen(st.hour);
    const f = Math.floor(T / Lg.ADMIT_MS), first = S.lastF === null || !S.lastQd;
    const Qd = st.nearClub && st.open ? Q : 0;
    const qy = ALLEY.queue;
    const slotOf = (id) => id - f + (S.playerJoin !== null && id >= S.playerJoin ? 1 : 0);
    for (let id = f; id < f + Qd; id++) {
      const key = 'q' + id, i = slotOf(id), sp = P(qy.u0 + i * qy.du, qy.v + ((id * 7) % 3 - 1) * 0.08);
      const fresh = !actors.has(key);
      const a = actor(key, () => clubLook(Lg.hash('queue', id) * 1e9 | 0, Math.min(0.45, st.state), { prop: Lg.hash('qp', id) < 0.3 ? 'phone' : null }),
        { x: first ? sp[0] : P(qy.u0 + (Q + 4) * qy.du, qy.v)[0], z: first ? sp[1] : P(qy.u0 + (Q + 4) * qy.du, qy.v)[1], h: ALLEY.hU + Math.PI, kind: 'queue', lines: QUEUE_LINES });
      if (!a) continue;
      if (fresh && first) { a.x = sp[0]; a.z = sp[1]; }
      a.qState = 'wait';
      const rem = walkTo(a, sp[0], sp[1], 1.1, dt);
      if (rem < 0.05) { face(a, ALLEY.hU + Math.PI + (id % 2 ? 0.5 : -0.3), dt); setPose(a, Lg.hash('qpose', id) < 0.35 ? 'talk' : 'stand'); } else setPose(a, 'stand');
    }
    // the ones let in: to the bouncers, through the door, gone
    for (const a of actors.values()) {
      if (a.kind !== 'queue') continue;
      const id = +a.key.slice(1);
      if (id >= f) continue;
      a.alive = S.frame;
      if (!a.qState || a.qState === 'wait') a.qState = 'door';
      if (a.qState === 'door') { const r = walkTo(a, doorPt[0], doorPt[1], 1.2, dt); setPose(a, 'stand'); if (r < 0.1) { a.qState = 'in'; S.doorPulse = 1.6; } }
      else if (a.qState === 'in') { const r = walkTo(a, inPt[0], inPt[1], 1.0, dt); if (r < 0.1) { a.dead = true; } }
    }
    S.lastF = f; S.lastQd = Qd; S.queue = { Q: Qd, f };
  }

  // ------------------------------------------------------------------ leavers + couples
  function memberLook(ev, i, st) { return clubLook(ev.seeds[i], Math.min(1, st.state + 0.15), null); }
  function eventTick(ev, T, st, dt, plx, plz) {
    const r = routeFor(ev, true), t = (T - ev.t) / 1000;
    if (!r) return true;
    if (t < 0 || t > r.tl.T + 3.5) return false;
    const o = Lg.evalTimeline(r.tl, t, tmp);
    Lg.pointAt(r.pts, r.cum, o.s, tmp2);
    const cx = tmp2.x, cz = tmp2.z, hh = tmp2.h;
    if (Math.hypot(cx - plx, cz - plz) > VIS + 10) { for (let i = 0; i < ev.seeds.length; i++) { const a = actors.get(ev.id + ':' + i); if (a) a.dead = true; } return true; }
    if (t < 3 || o.s < 3.5) S.doorPulse = Math.max(S.doorPulse, 0.6);
    const lx = Math.cos(hh), lz = -Math.sin(hh);             // the walker's left
    const n = ev.seeds.length, done = o.done;
    for (let i = 0; i < n; i++) {
      const key = ev.id + ':' + i;
      const a = actor(key, () => memberLook(ev, i, st), { x: cx, z: cz, h: hh, kind: 'leaver', lines: ev.couple ? STREET_LINES.couple : STREET_LINES.leave });
      if (!a) continue;
      a.ev = ev; a.idx = i;
      let x = cx, z = cz, h = hh, sp = o.tag === 'walk' ? ev.speed || 1.1 : 0, pose = 'stand', tweak = null;
      // single file through the doorway and at the far door
      const lag = i * 0.7, single = o.s < 3.4 || o.s > r.sDoor - 0.9;
      if (single || !ev.couple) {
        if (single) { Lg.pointAt(r.pts, r.cum, Math.max(0, o.s - lag), tmp2); x = tmp2.x; z = tmp2.z; h = tmp2.h; }
        else { const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.62, back = i % 2 ? 0.35 : 0; Lg.pointAt(r.pts, r.cum, Math.max(0, o.s - back), tmp2); x = tmp2.x + lx * off; z = tmp2.z + lz * off; h = tmp2.h; }
        pose = !ev.couple && Lg.hash('drunkpose', ev.id, i) < 0.4 ? 'drunk' : 'stand';
      } else {
        const side = i === 0 ? -1 : 1, off = i === 0 ? 0.27 : -0.27;
        x = cx + lx * off; z = cz + lz * off;
        if (o.tag === 'kiss') {
          const w = sm(0.12, 0.32, o.phase) * (1 - sm(0.72, 0.92, o.phase)), d = 0.27 - 0.06 * w;
          x = cx + lx * (i === 0 ? d : -d); z = cz + lz * (i === 0 ? d : -d);
          h = hh + (i === 0 ? -1 : 1) * Math.PI / 2 * sm(0, 0.15, o.phase) * (1 - sm(0.9, 1, o.phase));
          tweak = (c) => kissTweak(c, w);
          if (i === 0 && o.phase > 0.95 && !a.said.k) { a.said.k = 1; a.ch.say(Lg.hash('kl', ev.id) < 0.5 ? 'Walk you home?' : 'Cheesy chips?', 2.5); }
        } else if (o.tag === 'chips') {
          const vs = VAN.spot(0); x = vs[0] + (i ? lx * 0.6 : 0); z = vs[1] + (i ? lz * 0.6 : 0); h = VAN.face;
          if (i === 0 && o.phase > 0.75 && !a.chips) { a.chips = chipsBox(); a.chips.rotation.x = Math.PI / 2; a.chips.position.set(0, 0.03, -0.06); a.ch.anchors.handL.add(a.chips); }
        } else if (o.tag === 'fumble') {
          const D = r.dest; if (D) { const lat = [D.out[1], -D.out[0]]; x = D.door[0] + D.out[0] * 0.55 + (i ? lat[0] * 0.55 : 0); z = D.door[1] + D.out[1] * 0.55 + (i ? lat[1] * 0.55 : 0); h = Math.atan2(-D.out[0], -D.out[1]); }
          if (i === 0) { tweak = (c) => fumbleTweak(c, S.t, o.phase); if (o.phase > 0.1 && !a.said.f) { a.said.f = 1; a.ch.say('Where is my Bod card...', 2); } if (o.phase > 0.62 && !a.said.g) { a.said.g = 1; a.ch.say('Got it!', 1.5); } }
          else pose = 'talk';
        } else { a.keepCouple = true; pose = 'couple'; tweak = null; void side; }
        if (pose === 'couple') { const handled = couplePose(a.ch, ev.hold, i === 0 ? -1 : 1); pose = null; if (!handled) tweak = (c) => holdTweak(c, i === 0 ? -1 : 1, ev.hold); }
        if (a.chips && o.tag !== 'fumble') { const prev = tweak; tweak = (c) => { if (prev) prev(c); chipsTweak(c, S.t, false); }; }
        if (i === 1 && o.tag === 'walk' && actors.get(ev.id + ':0')?.chips) { const prev = tweak; tweak = (c) => { if (prev) prev(c); const b = c.bones, s2 = Math.max(0, Math.sin(S.t * 1.1)); b.armR.rotation.x = -0.3 - 0.4 * s2; b.foreR.rotation.x = -0.6 - 1.1 * s2; }; }
      }
      if (pose) { a.keepCouple = false; setPose(a, pose); }
      const dx = x - a.x, dz = z - a.z; a.speed = o.tag === 'walk' || single ? Math.min(2.5, Math.hypot(dx, dz) / Math.max(dt, 1e-3)) : 0;
      if (o.tag !== 'walk' && !single) a.speed = 0;
      a.x = x; a.z = z; a.h += wrapA(h - a.h) * Math.min(1, dt * 8); a.tweak = tweak;
      // vanish through the door
      const myS = single ? o.s - lag : o.s;
      a.hidden = done || myS > r.sDoor + 0.2;
      if (a.chips && a.hidden) { a.chips.removeFromParent(); a.chips = null; }
    }
    // the destination door
    const D = r.dest;
    if (D && !D.noLeaf && Math.hypot(D.door[0] - plx, D.door[1] - plz) < VIS) {
      const di = rctx().dests.indexOf(D);
      let d = doors.get(di);
      if (!d) { d = makeDoor(D, di); doors.set(di, d); }
      d.alive = S.frame;
      const tF = r.tl.segs.find((g) => g.tag === 'fumble'), tOpen = tF ? tF.t0 + (tF.t1 - tF.t0) * 0.8 : r.tl.T - 2;
      const want = t > tOpen && t < r.tl.T + 1.2 ? 1 : 0;
      d.open = Math.max(d.open * (want ? 1 : 0), want ? Math.min(1, d.open + dt * 1.2) : Math.max(0, d.open - dt * 0.9));
      if (want && !d.knock && t > tOpen) { d.knock = true; if (Math.hypot(D.door[0] - plx, D.door[1] - plz) < 25) audio.door(); }
      if (!want) d.knock = false;
    }
    return true;
  }
  function makeDoor(D, i) {
    const lat = [D.out[1], -D.out[0]], g = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.06).translate(0.5, 1.05, 0), new THREE.MeshStandardMaterial({ color: DOOR_COLS[i % DOOR_COLS.length], roughness: 0.6 }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.8, roughness: 0.3 })); knob.position.set(0.88, 1.0, 0.05);
    leaf.add(knob); g.add(leaf);
    const hx = D.door[0] + lat[0] * 0.5 + D.out[0] * 0.04, hz = D.door[1] + lat[1] * 0.5 + D.out[1] * 0.04;
    g.position.set(hx, 0, hz);
    const d = [-lat[0], -lat[1]], ry = Math.atan2(-d[1], d[0]);
    // which way is "into the building" for this hinge
    const tip = (a) => [Math.cos(a), -Math.sin(a)], into = [-D.out[0], -D.out[1]];
    const sgn = tip(ry + 0.6)[0] * into[0] + tip(ry + 0.6)[1] * into[1] > 0 ? 1 : -1;
    g.rotation.y = ry; scene.add(g);
    return { g, leaf, ry, sgn, open: 0, alive: 0 };
  }

  // ------------------------------------------------------------------ vignettes
  function vignetteTick(v, T, st, dt, plx, plz) {
    const r = vignetteRoute(v), t = (T - v.t) / 1000;
    if (t < 0 || t > r.tl.T) return false;
    const o = Lg.evalTimeline(r.tl, t, tmp); Lg.pointAt(r.pts, r.cum, o.s, tmp2);
    if (Math.hypot(tmp2.x - plx, tmp2.z - plz) > VIS) { for (let i = 0; i < v.seeds.length; i++) { const a = actors.get(v.id + ':' + i); if (a) a.dead = true; } return true; }
    const hh = tmp2.h, lx = Math.cos(hh), lz = -Math.sin(hh);
    for (let i = 0; i < v.seeds.length; i++) {
      const a = actor(v.id + ':' + i, () => clubLook(v.seeds[i], 0.9), { x: tmp2.x, z: tmp2.z, h: hh, kind: 'vignette', lines: STREET_LINES[v.kind],
        setup: (b) => { if (v.kind === 'cone') { const c = trafficCone(); c.position.y = -0.04; b.ch.anchors.headTop.add(c); } } });
      if (!a) continue;
      let x = tmp2.x, z = tmp2.z, y = 0, tw = null, pose = 'stand', h = hh;
      if (v.kind === 'singers') { const off = (i - 1) * 0.6; x += lx * off; z += lz * off; pose = i === 1 ? 'drunk' : 'stand'; }
      else if (v.kind === 'carry') {
        const back = i === 0 ? 0 : i === 1 ? 0.12 : 1.75; Lg.pointAt(r.pts, r.cum, Math.max(0, o.s - back), tmp); x = tmp.x; z = tmp.z; h = tmp.h;
        if (i === 1) { y = 0.95; a.carried = true; } else tw = (c) => carryTweak(c, i === 0);
      } else if (v.kind === 'cone') pose = 'drunk';
      setPose(a, pose);
      const dx = x - a.x, dz = z - a.z; a.speed = a.carried ? 0 : Math.min(2.5, Math.hypot(dx, dz) / Math.max(dt, 1e-3));
      a.x = x; a.z = z; a.y = y; a.h = h; a.tweak = tw; a.hidden = false;
      if (a.carried) { a.ch.group.rotation.order = 'YXZ'; a.lie = true; }
    }
    return true;
  }

  // ------------------------------------------------------------------ per frame
  S.frame = 0;
  S.update = (dt, st) => {
    S.frame++; S.t += dt;
    const T = st.T, pl = game.player.worldPos || game.player.pos, plx = pl.x, plz = pl.z;
    cam.copy(game.camera.position);
    // fixed people (every second)
    { const now = performance.now(); if (!S.fixedAt || now - S.fixedAt > 1000 || (st.nearClub && !(S.fixed && S.fixed.length) && now - S.fixedAt > 150)) { S.fixedAt = now; S.fixed = st.nearClub ? fixedSpecs(st) : []; } }
    for (const f of S.fixed || []) {
      const a = actor(f.key, f.look, { x: f.x[0], z: f.x[1], h: f.h, kind: 'fixed', lines: f.lines, setup: f.setup });
      if (!a) continue;
      a.hidden = false; a.speed = 0; a.tweak = f.smoker ? (c) => smokeHand(c, S.t + (f.key.length * 1.7)) : null; a.smoker = f.smoker;
      if (f.bouncer) { const dx = plx - a.x, dz = plz - a.z, d = Math.hypot(dx, dz); face(a, d < 4 && game.player.place === 'world' ? Math.atan2(dx, dz) : f.h, dt); } else a.h = f.h;
      setPose(a, f.pose);
    }
    // queue
    queueTick(dt, st, T);
    // leavers: this night's schedule + forced ones
    const n = Lg.nightIndex(T);
    if (S.night !== n) { S.night = n; S.events = Lg.leaversForNight(n, Math.max(1, rctx().dests.length)); S.vign = vignettesForNight(n, Lg.nightStart(n) + 1.5 * Lg.HOUR_MS, 4.6 * Lg.HOUR_MS); }
    if (st.active && !S.onlyForced) {
      for (const ev of S.events) { if (ev.t > T) break; if (T - ev.t < 900000) eventTick(ev, T, st, dt, plx, plz); }
      for (const v of S.vign) { if (v.t > T) break; vignetteTick(v, T, st, dt, plx, plz); }
    }
    for (let i = S.extra.length - 1; i >= 0; i--) if (!eventTick(S.extra[i], T, st, dt, plx, plz) && T > S.extra[i].t) { S.extra.splice(i, 1); }
    // retire actors nobody asked for this frame
    for (const a of actors.values()) if (a.dead || a.alive !== S.frame) drop(a);
    for (const [k, d] of doors) {
      if (d.alive !== S.frame && d.open <= 0.01) { d.g.removeFromParent(); d.leaf.geometry.dispose(); doors.delete(k); continue; }
      if (d.alive !== S.frame) d.open = Math.max(0, d.open - dt);
      d.g.rotation.y = d.ry + d.sgn * 1.35 * sm(0, 1, d.open);
    }
    // the club doors: open when someone goes through
    S.doorPulse = Math.max(0, (S.doorPulse || 0) - dt);
    const want = S.doorPulse > 0 ? 1 : 0;
    S.doorOpen += (want - S.doorOpen) * Math.min(1, dt * 3);
    // sync meshes, LOD, cigarettes
    const cigP = ext.cigs.geometry.attributes.position; let ci = 0;
    // draw budget: only the nearest MAX_VIS people (11 draw calls each); re-ranked a few times a second
    if (S.frame % 8 === 0) {
      rank.length = 0; for (const a of actors.values()) { a.cd = Math.hypot(a.x - cam.x, a.z - cam.z); if (!a.hidden && a.cd < VIS) rank.push(a); }
      rank.sort((p, q) => p.cd - q.cd); for (const a of actors.values()) a.ranked = false; for (let i = 0; i < rank.length && i < MAX_VIS; i++) rank[i].ranked = true;
    }
    for (const a of actors.values()) {
      const g = a.ch.group, d = Math.hypot(a.x - cam.x, a.z - cam.z);
      const vis = !a.hidden && d < VIS && game.player.place === 'world' && (a.ranked || d < 12);
      g.visible = vis;
      if (!vis) continue;
      g.position.set(a.x, a.y || 0, a.z);
      if (a.lie) g.rotation.set(-Math.PI / 2, a.h, 0); else g.rotation.y = a.h;
      if (d < ANIM || a.ch.blend < 1) { a.ch.update(dt, a.speed); if (a.tweak) a.tweak(a.ch); } else if (a.ch.lodTick) a.ch.lodTick();
      if (a.smoker && ci < 4) { a.ch.anchors.handR.getWorldPosition(wp); cigP.setXYZ(ci++, wp.x, wp.y, wp.z); }
    }
    for (; ci < 4; ci++) cigP.setXYZ(ci, 0, -50, 0);
    cigP.needsUpdate = true;
    // chatter
    if ((S.sayT -= dt) <= 0) {
      S.sayT = SPEECH.clubQueue[0] + Math.random() * (SPEECH.clubQueue[1] - SPEECH.clubQueue[0]);   // (a fifth as often as it was: 2-4.5 s)
      let best = null, k = 0;
      for (const a of actors.values()) { if (!a.lines || !a.ch.group.visible || a.ch.saying) continue; if (Math.hypot(a.x - plx, a.z - plz) > 16) continue; if (Math.random() * ++k < 1) best = a; }
      if (best) best.ch.say(ambientLine(best.lines, null, null, game.time.now() / 1000), 3);   // (not the line just heard, nor one from the last few minutes while there are others)
    }
  };
  /** force a couple out of the door now. opts: {dest, chips, hold, skip (seconds into their walk), seeds} */
  S.coupleNow = (T, opts = {}) => {
    const c = rctx(), nD = Math.max(1, c.dests.length);
    const k = S.extra.length + Math.floor(Math.random() * 1e6);
    const ev = { id: 'force' + k, t: T - (opts.skip || 0) * 1000, kind: 'couple', n: -1, seeds: opts.seeds || [Math.floor(Math.random() * 1e9), Math.floor(Math.random() * 1e9)], couple: true,
      dest: opts.dest !== undefined ? opts.dest % nD : Math.floor(Math.random() * nD), chips: opts.chips !== undefined ? !!opts.chips : true, kiss: true, speed: 1.1, hold: opts.hold || 'hand' };
    S.extra.push(ev);
    const r = routeFor(ev);
    return { id: ev.id, dest: r.dest ? r.dest.name : '(away up Cornmarket)', walk: Math.round(r.cum[r.cum.length - 1]), stops: r.tl.segs.filter((g) => g.tag !== 'walk').map((g) => `${g.tag}@${g.t0.toFixed(1)}s`), T: r.tl.T };
  };
  /** where a forced couple is now */
  S.where = (id) => { for (const a of actors.values()) if (a.ev && a.ev.id === id) return { x: +a.x.toFixed(1), z: +a.z.toFixed(1), h: a.h, hidden: !!a.hidden }; return null; };
  /** the routing context (pedestrian graph, destinations, the alley and van nodes) and a destination's door, for a
   *  player walking someone home (_pt_walkhome.js): want 0..1 = shut / open; call every frame it should be there */
  S.ctx = () => rctx();
  S.useDoor = (D, want, dt) => {
    const di = rctx().dests.indexOf(D); if (di < 0 || D.noLeaf) return null;
    let d = doors.get(di); if (!d) { d = makeDoor(D, di); doors.set(di, d); }
    d.alive = S.frame + 1;
    if (want && !d.knock) { d.knock = true; audio.door(); } if (!want) d.knock = false;
    d.open = want ? Math.min(1, d.open + dt * 1.2) : Math.max(0, d.open - dt * 0.9);
    return d;
  };
  S.slotPos = (i) => { const q = ALLEY.queue; return P(q.u0 + i * q.du, q.v); };
  S.list = () => [...actors.values()].map((a) => ({ key: a.key, kind: a.kind, x: +a.x.toFixed(1), z: +a.z.toFixed(1), pose: a.ch.pose, vis: a.ch.group.visible }));
  S.destinations = () => rctx().dests.map((d) => ({ name: d.name, door: d.door.map((v) => +v.toFixed(2)), out: d.out.map((v) => +v.toFixed(3)) }));
  S.routeOf = (ev) => routeFor(ev);
  /** the loading screen's share (game.warmups, world/prewarm.js): the destinations (a graph search and raycasts per
   *  college door, ~200 ms on the first night frame otherwise) and tonight's routes */
  S.warm = (T) => { const c = rctx(); const n = Lg.nightIndex(T); for (const ev of Lg.leaversForNight(n, Math.max(1, c.dests.length))) routeFor(ev); return S.routeCache.size; };
  S.clear = () => { for (const a of [...actors.values()]) drop(a); };
  return S;
}
