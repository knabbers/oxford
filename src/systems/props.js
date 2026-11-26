// Dynamic props: street furniture that reacts when you run, ride or drive into it.
//
// Everything stays exactly as it was (the streetscape's two merged draws, the world's batched furniture) until
// something hits an item. Then that item is hidden in place (streetscape.takeItem: its vertices collapse, its collider
// goes off; world furniture: the instance is moved out of range) and a body of the same look is simulated by the
// small rigid-body solver in _props_physics.js and drawn by one merged CPU-transformed mesh per material
// (_props_fx.js: 'props:street' uses the streetscape's own material and atlas, 'props:furn' the world furniture
// material) plus one Points draw for sparks, litter, leaves and splashes — all invisible when nothing is knocked.
// Items come back quietly when nobody is within 120 m and they are out of view (or after 5 minutes on the shared
// clock), lamps light again.
//
// Per type (_props_kinds.js): bins, wheelie bins (they roll on their wheels; the lid flaps open with gravity; litter
// spills), A-boards, cones, caddies, recycling boxes, chained bikes, estate boards, benches, grit bins go flying;
// bollards fold over above a threshold; lamp columns, sign posts, crossing signals, Belisha beacons, bus-stop poles
// and pay machines are solid below a momentum threshold and shear at the foot above it (the lamp flickers and goes
// out, sparks; the vehicle loses only part of its speed); post boxes, phone boxes, shelters, cabinets never move.
// Footballs in University Parks and South Park: walk into one to dribble, [E] to kick.
//
// Hooks: game.props = { vehicleContact(v, dt) (called by systems/vehicles.js before it moves a car / bike: knocks
// what the vehicle is about to hit and takes the momentum it loses off v), on(kind, fn) ('playerBump' {strength,
// dx, dz, kind} — the player sprinted into something; 'bikeHit' {v, severity, kind}; 'knock' {id, kind, x, z, by}),
// stats(), debugKnock(kindOrId, speed?), debugCrash(opts), restoreAll(), pause }
// Multiplayer: one 'pk' relay event per knock (_props_net.js), replayed by every peer.   Test: tools/smoke_props.mjs
import * as THREE from 'three';
import { PhysWorld, Body, energy } from './_props_physics.js';
import { KINDS, VMASS, splitProtos, bodySpec, breaks, hashi } from './_props_kinds.js';
import { DynMesh, Particles } from './_props_fx.js';
import { PropSound } from './_props_audio.js';
import { KNOCK, encodeKnock, decodeKnock } from './_props_net.js';
import { TYPES } from './_vehiclemeshes.js';

const MAX_AWAKE = 48, MAX_LIVE = 110, RESTORE_R = 120, RESTORE_AGE = 25e3, FORCE_AGE = 300e3;
const OPT_LOW = { ignoreLow: true }, OPT_NONE = {};
const FURN = ['bench', 'bin', 'picnic', 'bollard', 'signal', 'belisha', 'busStop', 'postBox', 'phone', 'shelter', 'lampPost'];
const FID = 2e6, BID = 3e6;
const LITTER = [[0.92, 0.9, 0.86], [0.85, 0.12, 0.1], [0.15, 0.3, 0.75], [0.75, 0.76, 0.78], [0.9, 0.78, 0.2], [0.55, 0.38, 0.2], [0.2, 0.5, 0.2]];
const BALL_SPOTS = [[330, -690], [342, -702], [560, -880], [2150, 560], [2165, 548]];

export default {
  id: 'props',
  install(game) {
    if (!game.world || !game.worldScene) return;
    if (typeof location !== 'undefined' && /[?&]props=0/.test(location.search || '')) return;   // ?props=0: off
    const s = new Props(game);
    game.props = s.api;
    return s;
  },
};

class Props {
  constructor(game) {
    this.game = game; this.id = 'props';
    this.W = game.world; this.ready = false; this.paused = false;
    this.live = []; this.byId = new Map(); this.ev = new Map(); this.balls = [];
    this.timer = 0; this.kickT = 0; this.ballT = 0; this.heatT = 0;
    this.sent = 0; this.recv = 0; this.knocks = 0; this.bytes = 0;
    this.kickPos = new THREE.Vector3(0, -1000, 0); this.kickTarget = null;
    this.wcache = new Map();
    this.Yw = (this.W.Y && this.W.Y.water) || 0.035;
    const col = () => game.worldCollider;
    this.phys = new PhysWorld({
      ground: (x, z) => this.W.groundHeight(x, z),
      water: (x, z) => this.waterAt(x, z),
      wall: (P, r, low) => { const c = col(); return c ? c.resolve(P, r, low ? OPT_LOW : OPT_NONE) : false; },
      impact: (b, sp, kind, x, y, z, o) => this.onImpact(b, sp, kind, x, y, z, o),
      splash: (b, sp, x, y, z) => this.onSplash(b, sp, x, y, z),
    });
    this.phys.wakeHook = (b) => this.onWake(b);
    this.fx = new Particles(700);
    game.worldScene.add(this.fx.mesh);
    this.sound = new PropSound(game.audio, (x, z) => (this.W && this.W.groundHeight ? this.W.groundHeight(x, z) : NaN));
    this.split = splitProtos();
    this.fprotos = new Map();
    this._v = [0, 0, 0];
    if (game.net && game.net.on) game.net.on(KNOCK, (d, o) => { try { this.onNet(d, o); } catch (e) { console.warn('[props] net', e); } });
    if (game.interact) game.interact.add({ pos: () => this.kickPos, radius: 1.7, label: () => this.kickLabel || 'Kick it', onUse: () => this.kick(), enabled: () => !!this.kickTarget });
    const self = this;
    this.api = {
      vehicleContact: (v, dt) => { try { return self.vehicleContact(v, dt); } catch (e) { if (!self._vcErr) { self._vcErr = true; console.warn('[props] vehicleContact', e); } return 0; } },
      on: (kind, fn) => { if (!self.ev.has(kind)) self.ev.set(kind, []); self.ev.get(kind).push(fn); return () => { const a = self.ev.get(kind); const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; },
      stats: () => self.stats(),
      debugKnock: (what, speed = 8, opts = {}) => self.debugKnock(what, speed, opts),
      debugCrash: (opts = {}) => self.debugCrash(opts),
      restoreAll: () => { for (const P of self.live.slice()) if (!P.ball) self.restore(P); self.fx.clear(); self.paused = false; if (self.ghost) { self.ghost.removeFromParent(); self.ghost = null; } return self.live.length; },
      debugView: (kind, x0, z0, opts) => self.debugView(kind, x0, z0, opts), get view() { return self.view; },
      near: (x, z, r) => { const out = []; self.near(x, z, r, (c) => { out.push({ id: c.id, k: c.k, cls: c.K.cls, x: +c.x.toFixed(2), z: +c.z.toFixed(2) }); }); return out; },
      encode: encodeKnock, decode: decodeKnock, applyKnock: (k) => self.applyKnock(k, false),
      get pause() { return self.paused; }, set pause(v) { self.paused = !!v; },
      get live() { return self.live; }, get phys() { return self.phys; }, energy,
      get ready() { return self.ready; },
    };
  }

  // ---------------------------------------------------------------- setup (first frame the streetscape is built)
  tryInit() {
    const g = this.game, ss = g.streetscape;
    if (ss && !ss.ready) return;
    this.ss = ss || null;
    const mat = ss && ss.material;
    this.smesh = mat ? new DynMesh(mat, { name: 'props:street', fx: true, depth: ss.depthMaterial, shadow: true }) : null;
    if (this.smesh) g.worldScene.add(this.smesh.mesh);
    const F = this.W.furniture;
    let fmat = null;
    if (F && F.sets) for (const k of FURN) { const s = F.sets[k]; if (s && s.meshes && s.meshes[0]) { fmat = s.meshes[0].material; break; } }
    this.fmesh = new DynMesh(fmat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), { name: 'props:furn', fx: false, shadow: true });
    g.worldScene.add(this.fmesh.mesh);
    // world furniture index (16 m cells) + colliders for the ones that had none
    this.fcells = new Map(); this.fitems = [];
    const C = g.worldCollider;
    if (F && F.sets) FURN.forEach((k, si) => {
      const set = F.sets[k], K = KINDS['f.' + k]; if (!set || !K) return;
      for (let i = 0; i < set.n; i++) {
        const x = set.xz[i * 2], z = set.xz[i * 2 + 1]; if (!(Math.abs(x) < 1e7)) continue;
        const m = set.mat, o = i * 16, h = Math.atan2(m[o + 8], m[o]), y = m[o + 13];
        const fi = { id: FID + si * 1e5 + i, k: 'f.' + k, set, i, x, z, y, h, K, col: null, hidden: false };
        if (C && K.col) {
          if (K.col.r) fi.col = C.addCircle(x, z, K.col.r, { tag: 'street' });
          else if (K.col.box) fi.col = C.addBox(x, z, K.col.box[0], K.col.box[1], h, { tag: 'street', low: K.cls === 'free' });
          else if (K.col.shelter) { const cs = Math.cos(h), sn = Math.sin(h), P = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs], a = P(-1.55, -0.7), b = P(1.55, -0.7), c = P(-1.55, 0.6); fi.col = [C.addSegment(a[0], a[1], b[0], b[1], { tag: 'street' }), C.addSegment(a[0], a[1], c[0], c[1], { tag: 'street' }), C.addCircle(P(1.55, 0.6)[0], P(1.55, 0.6)[1], 0.06, { tag: 'street' })]; }
        }
        this.fitems.push(fi);
        const key = Math.floor(x / 16) * 65536 + Math.floor(z / 16); let a = this.fcells.get(key); if (!a) this.fcells.set(key, (a = [])); a.push(fi);
      }
    });
    // trees (leaves shake down when a car hits one; a fast car whirls up the fallen leaves under street trees)
    this.tcells = new Map();
    for (const t of g.map.trees || []) { const key = Math.floor(t[0] / 16) * 65536 + Math.floor(t[1] / 16); let a = this.tcells.get(key); if (!a) this.tcells.set(key, (a = [])); a.push({ x: t[0], z: t[1], s: t[2] || 10, cool: -1e9 }); }
    // footballs
    BALL_SPOTS.forEach(([x, z], n) => {
      if (!this.onGrass(x, z)) return;
      const b = { id: BID + n, k: 'ball', K: KINDS.ball, x, z, home: [x, z], P: null };
      this.balls.push(b);
    });
    this.ready = true;
  }
  onGrass(x, z) {
    const map = this.game.map, U = this.W.util; if (!U) return true;
    for (const a of map.areas) if ((a.kind === 'park' || a.kind === 'grass' || a.kind === 'pitch' || a.kind === 'meadow') && U.pointInPoly(x, z, a.poly)) { let hole = false; for (const h of a.holes || []) if (U.pointInPoly(x, z, h)) hole = true; if (!hole) return true; }
    return false;
  }
  waterAt(x, z) {
    const key = Math.floor(x) * 100003 + Math.floor(z);
    let w = this.wcache.get(key);
    if (w === undefined) { const c = this.game.worldCollider; w = c && c.isWet(x, z) ? 1 : 0; if (this.wcache.size > 6000) this.wcache.clear(); this.wcache.set(key, w); }
    return w ? this.Yw : null;
  }
  emit(kind, d) { const a = this.ev.get(kind); if (!a) return; for (const fn of a) { try { fn(d); } catch (e) { console.warn('[props] ' + kind, e); } } }

  // ---------------------------------------------------------------- candidates near a point
  /** fn(cand) for every knockable item within r of (x, z): cand {src, id, k, K, x, y, z, h, ri, it|fi} (one reused object) */
  near(x, z, r, fn) {
    const c = this._cand || (this._cand = {});
    if (this.ss) this.ss.itemsNear(x, z, r, (it, i) => {
      const K = KINDS[it.k]; if (!K) return;
      c.src = 's'; c.id = i; c.k = it.k; c.K = K; c.x = it.x; c.y = it.y || 0; c.z = it.z; c.h = it.h || 0; c.it = it; c.fi = null;
      c.ri = it.r || radiusOf(K); c.lowCol = !it.r || !!it.low;
      return fn(c);
    });
    if (this.fcells) for (let i = Math.floor((x - r) / 16); i <= Math.floor((x + r) / 16); i++) for (let j = Math.floor((z - r) / 16); j <= Math.floor((z + r) / 16); j++) {
      const a = this.fcells.get(i * 65536 + j); if (!a) continue;
      for (const fi of a) {
        if (fi.hidden) continue; const dx = fi.x - x, dz = fi.z - z; if (dx * dx + dz * dz > r * r) continue;
        c.src = 'f'; c.id = fi.id; c.k = fi.k; c.K = fi.K; c.x = fi.x; c.y = fi.y; c.z = fi.z; c.h = fi.h; c.it = null; c.fi = fi;
        c.ri = fi.K.col && fi.K.col.r ? fi.K.col.r : radiusOf(fi.K); c.lowCol = !fi.col || fi.K.cls === 'free';
        if (fn(c)) return;
      }
    }
  }
  candById(id) {
    let out = null;
    if (id < FID) { const it = this.ss && this.ss.item(id); if (!it || it.gone || it.taken) return null; const K = KINDS[it.k]; if (!K) return null; out = { src: 's', id, k: it.k, K, x: it.x, y: it.y || 0, z: it.z, h: it.h || 0, it, fi: null, ri: it.r || radiusOf(K) }; }
    else if (id < BID) { const fi = this.fitems && this.fitems.find((f) => f.id === id); if (!fi || fi.hidden) return null; out = { src: 'f', id, k: fi.k, K: fi.K, x: fi.x, y: fi.y, z: fi.z, h: fi.h, it: null, fi, ri: radiusOf(fi.K) }; }
    return out;
  }

  // ---------------------------------------------------------------- spawning / restoring bodies
  furnProto(fi) {
    let p = this.fprotos.get(fi.k); if (p) return p;
    const g = fi.set.bands[0].meshes[0].geometry, pos = g.attributes.position, nor = g.attributes.normal, col = g.attributes.color, n = pos.count;
    const idx = g.index ? g.index.array : Uint32Array.from({ length: n }, (_, i) => i);
    p = { pos: Float32Array.from(pos.array), nor: nor ? Float32Array.from(nor.array) : new Float32Array(n * 3), col: col ? Float32Array.from(col.array) : new Float32Array(n * 3).fill(0.5), uv: null, fx: null, idx, nv: n, ni: idx.length };
    this.fprotos.set(fi.k, p); return p;
  }
  ballProto() {
    if (this._ballP) return this._ballP;
    const g = new THREE.IcosahedronGeometry(0.11, 1).toNonIndexed(); g.computeVertexNormals();
    const pos = g.attributes.position.array, n = pos.length / 3, col = new Float32Array(n * 3);
    const dirs = []; { const t = (1 + Math.sqrt(5)) / 2; for (const [a, b] of [[-1, t], [1, t], [-1, -t], [1, -t]]) dirs.push([a, b, 0], [0, a, b], [b, 0, a]); }
    for (let f = 0; f < n; f += 3) {
      const cx = (pos[f * 3] + pos[f * 3 + 3] + pos[f * 3 + 6]) / 3, cy = (pos[f * 3 + 1] + pos[f * 3 + 4] + pos[f * 3 + 7]) / 3, cz = (pos[f * 3 + 2] + pos[f * 3 + 5] + pos[f * 3 + 8]) / 3, l = Math.hypot(cx, cy, cz);
      let dark = false; for (const d of dirs) { const dl = Math.hypot(...d); if ((cx * d[0] + cy * d[1] + cz * d[2]) / (l * dl) > 0.93) dark = true; }
      for (let k = 0; k < 3; k++) { const o = (f + k) * 3, c = dark ? 0.06 : 0.92; col[o] = c; col[o + 1] = c; col[o + 2] = c; }
    }
    const P = { pos: new Float32Array(pos), nor: new Float32Array(g.attributes.normal.array), col, uv: null, fx: null, idx: Uint32Array.from({ length: n }, (_, i) => i), nv: n, ni: n };
    for (let i = 0; i < n; i++) P.pos[i * 3 + 1] += 0.11;     // origin on the ground like the other items
    g.dispose();
    return (this._ballP = P);
  }

  spawn(c) {
    const ex = this.byId.get(c.id); if (ex) return ex;
    if (c.src === 's') { if (!this.ss || !this.ss.takeItem(c.id)) return null; }
    else if (c.src === 'f') { const fi = c.fi; fi.hidden = true; fi.sx = fi.set.xz[fi.i * 2]; fi.sz = fi.set.xz[fi.i * 2 + 1]; fi.set.xz[fi.i * 2] = 1e9; fi.set.xz[fi.i * 2 + 1] = 1e9; if (fi.col) for (const s of [].concat(fi.col)) s.on = false; this.refreshFurn(); }
    const K = c.K, b = new Body({ ...bodySpec(K), id: c.id }), com = K.com || [0, 0, 0], cs = Math.cos(c.h), sn = Math.sin(c.h);
    b.setPose(c.x + com[0] * cs + com[2] * sn, c.y + com[1], c.z - com[0] * sn + com[2] * cs, c.h);
    const s = hashi(c.id, 7); b.drift = [Math.cos(s * 6.28) * 0.25, Math.sin(s * 6.28) * 0.25];
    let pieces, mesh, hinge = null;
    if (c.src === 's') {
      const sp = this.split[c.k];
      if (sp) { pieces = [{ proto: sp.body }, { proto: sp.lid }]; if (K.lid === 'hinge') { hinge = { p: K.hinge, a: 0, w: 0 }; pieces[1].hinge = hinge; } }
      else pieces = [{ proto: this.ss.protoFor(c.it) }];
      mesh = this.smesh;
    } else if (c.src === 'f') { pieces = [{ proto: this.furnProto(c.fi) }]; mesh = this.fmesh; }
    else { pieces = [{ proto: this.ballProto() }]; mesh = this.fmesh; }
    const it = c.it, entry = { body: b, pieces, com, roll: it ? it.roll || 0 : 0, tint: it ? it.tint || null : null, on: it && it.on !== undefined ? it.on : 0, glow: 1, dirty: true };
    if (mesh) mesh.add(entry);
    const P = { id: c.id, src: c.src, k: c.k, K, body: b, entry, it: c.it, fi: c.fi, home: [c.x, c.z], t0: this.now(), hinge, lidOff: false, spilled: false, flick: 0, ball: c.src === 'b', kin: null };
    b.user = P;
    this.phys.add(b); this.live.push(P); this.byId.set(c.id, P);
    this.limits(P);
    return P;
  }
  limits(newest) {
    let awake = 0; for (const P of this.live) if (P.body.awake) awake++;
    if (awake > MAX_AWAKE) { const a = this.live.filter((P) => P.body.awake && P !== newest).sort((p, q) => p.t0 - q.t0); for (let i = 0; i < awake - MAX_AWAKE && i < a.length; i++) a[i].body.sleep(); }
    let n = this.live.filter((P) => !P.ball && !P.parent).length;
    if (n > MAX_LIVE) { const a = this.live.filter((P) => !P.ball && !P.parent && P !== newest).sort((p, q) => p.t0 - q.t0); for (let i = 0; i < n - MAX_LIVE && i < a.length; i++) this.restore(a[i]); }
  }
  refreshFurn() { const F = this.W.furniture, c = this.game.camera.position; if (F && F.refresh) F.refresh(c.x, c.z, true); }
  restore(P) {
    if (!this.byId.has(P.id) && !P.parent) return;
    this.phys.remove(P.body);
    if (P.entry.dm) P.entry.dm.remove(P.entry);
    const i = this.live.indexOf(P); if (i >= 0) this.live.splice(i, 1);
    this.byId.delete(P.id);
    if (P.lidP) { this.restore(P.lidP); P.lidP = null; }
    if (P.src === 's' && this.ss) this.ss.restoreItem(P.id);
    else if (P.src === 'f') { const fi = P.fi; fi.hidden = false; fi.set.xz[fi.i * 2] = fi.sx; fi.set.xz[fi.i * 2 + 1] = fi.sz; if (fi.col) for (const s of [].concat(fi.col)) s.on = true; this.refreshFurn(); }
    else if (P.ball) { const B = this.balls.find((q) => q.P === P); if (B) B.P = null; }
  }
  now() { const t = this.game.time; return t && t.now ? t.now() : Date.now(); }

  // ---------------------------------------------------------------- knocking
  /**
   * Knock candidate c: impulse J (world, N·s) at world point (px, py, pz). by: 'car'|'bike'|'foot'|'net'|'debug'.
   * Sends the event unless it came from the network. -> the prop record
   */
  knock(c, jx, jy, jz, px, py, pz, by, flags = 0, t = null) {
    const K = c.K, x0 = c.x, y0 = c.y, z0 = c.z, k = c.k, id = c.id;
    if (by !== 'net') {
      // the originator applies exactly what it sends (cm/s, cm), so every peer replays identical numbers
      const q = (x) => Math.round(x * 100) / 100, m = K.mass;
      jx = q(jx / m) * m; jy = q(jy / m) * m; jz = q(jz / m) * m; px = x0 + q(px - x0); py = y0 + q(py - y0); pz = z0 + q(pz - z0);
      if (t === null) t = Math.round(this.now());
    }
    let P;
    if (K.cls === 'bend' && !(flags & 4)) P = this.bend(c, jx, jz);
    else {
      P = this.spawn(c); if (!P) return null;
      if (t !== null) P.t0 = t;
      P.body.applyImpulse(jx, jy, jz, px, py, pz);
      if (K.cls === 'anchored') this.sheared(P, px, py, pz);
      const dv = Math.hypot(jx, jy, jz) / K.mass;
      if (K.lid === 'pop' && dv > 3.2) this.popLid(P, jx / K.mass, jz / K.mass);
    }
    if (!P) return null;
    { try { this.sound.knock(K.mat, Math.hypot(jx, jy, jz) / K.mass, x0, z0, by); } catch { /* */ } }      // (the blow itself: systems/_props_audio.js)
    this.knocks++;
    this.emit('knock', { id, kind: k, x: x0, z: z0, by });
    if (by !== 'net') {
      this.heat(K, x0, z0, by);
      this.send({ id, t: P.t0, dv: [jx / K.mass, jy / K.mass, jz / K.mass], c: [px - x0, py - y0, pz - z0], flags: (K.cls === 'bend' ? 1 : 0) | (K.cls === 'anchored' ? 4 : 0) });
    }
    return P;
  }
  bend(c, jx, jz) {
    // fold over at the foot, away from the hit, and stay bent
    const P = this.spawn(c); if (!P) return null;
    const l = Math.hypot(jx, jz) || 1;
    P.kin = { ax: -jz / l, az: jx / l, a: 0, target: 1.0 + hashi(c.id, 3) * 0.35, base: [c.x, c.y, c.z], h: c.h };
    P.body.kin = true; P.body.awake = false;
    this.sound.impact(c.K.mat, 6, c.x, c.z);
    this.sparks(c.x, c.y + 0.3, c.z, 5, c.id);
    return P;
  }
  sheared(P, px, py, pz) {
    const b = P.body;
    this.sound.shear(px, pz);
    this.sparks(P.home[0], b.p[1] - (P.K.com ? P.K.com[1] : 0) + 0.15, P.home[1], 14, P.id);
    if (P.K.lamp) { P.flick = 1.6; }
  }
  popLid(P, dvx, dvz) {
    if (P.lidOff || !this.smesh) return;
    const sp = this.split[P.k]; if (!sp) return;
    P.lidOff = true;
    P.entry.pieces = [P.entry.pieces[0]]; this.smesh.dirtyLayout = true;
    const K = KINDS.lid, b = new Body({ ...bodySpec(K), id: P.id + 0.5 }), B = P.body, top = (P.k === 'binC' ? 0.92 : 0.86) - (P.K.com[1]);
    const t = B.rot(0, top + 0.04, 0, [0, 0, 0]);
    b.setPose(B.p[0] + t[0], B.p[1] + t[1], B.p[2] + t[2], P.it ? P.it.h || 0 : 0);
    const s = hashi(P.id | 0, Math.floor(P.t0), 5);
    b.v[0] = B.v[0] + dvx * 0.4 + (s - 0.5) * 1.5; b.v[1] = B.v[1] + 2.5 + s * 1.5; b.v[2] = B.v[2] + dvz * 0.4 + (0.5 - s) * 1.5;
    b.w[0] = (s - 0.5) * 14; b.w[2] = (0.3 - s) * 10;
    const entry = { body: b, pieces: [{ proto: sp.lid }], com: [0, (P.k === 'binC' ? 0.92 : 0.86) + 0.04, 0], roll: 0, tint: null, on: 0, glow: 1, dirty: true };
    this.smesh.add(entry);
    const L = { id: -1, src: 'lid', k: 'lid', K, body: b, entry, home: P.home, t0: P.t0, parent: P };
    b.user = L; this.phys.add(b); this.live.push(L); P.lidP = L;
  }

  /** what a vehicle is about to hit this frame: knock it (the collider then lets the vehicle through) and take the momentum the vehicle loses */
  vehicleContact(v, dt) {
    if (!this.ready || !v || this.game.scene !== this.game.worldScene || !(dt > 0)) return 0;
    const T = TYPES[v.type]; if (!T || v.kind === 'punt') return 0;
    const car = v.kind === 'car', fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let vx = car ? v.vx : fx * v.speed, vz = car ? v.vz : fz * v.speed;
    const sp = Math.hypot(vx, vz); if (sp < 0.4) return 0;
    const mc = VMASS[v.type] || 1200, r = car ? T.W / 2 : 0.35, half = car ? T.L / 2 - r : 0.5;
    const cx = v.x + vx * dt, cz = v.z + vz * dt, ax = cx - fx * half, az = cz - fz * half, bx = cx + fx * half, bz = cz + fz * half;
    const hitY = (v.y || 0) + (v.type === 'bus' ? 0.75 : car ? 0.5 : 0.55), by = this.game.player.vehicle === v ? (car ? 'car' : 'bike') : 'ai';
    let lost = 0;
    const seg = (x, z) => { const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1; let t = ((x - ax) * ex + (z - az) * ez) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; this._sx = ax + ex * t; this._sz = az + ez * t; return Math.hypot(x - this._sx, z - this._sz); };
    const hits = this._hits || (this._hits = []); hits.length = 0;
    this.near(cx, cz, half + r + 1.6, (c) => {
      const d = seg(c.x, c.z); if (d > r + c.ri + 0.05 || d < 1e-4) return;
      const nx = (c.x - this._sx) / d, nz = (c.z - this._sz) / d, vn = vx * nx + vz * nz;
      if (vn < 0.3) return;
      hits.push({ ...c, nx, nz, vn, pen: r + c.ri - d });
    });
    const n0 = this.live.length;
    for (const c of hits) {
      const K = c.K;
      if (K.cls === 'solid') { if (K.block && car) lost += this.blockCar(v, c.nx, c.nz, c.vn, c.pen, c.x, c.z); continue; }
      if (!breaks(K, mc, c.vn)) { if (c.lowCol && K.cls !== 'free' && car && c.vn > 1) lost += this.blockCar(v, c.nx, c.nz, c.vn, c.pen, c.x, c.z); continue; }
      const top = topOf(K), py = Math.min(c.y + top * 0.8, Math.max(c.y + 0.1, hitY)), px = c.x - c.nx * c.ri, pz = c.z - c.nz * c.ri;
      let j;
      if (K.cls === 'bend') j = c.vn * Math.min(K.mass, mc) * 0.5;
      else {
        // impulse of a (1+e) collision against the prop's effective mass at the contact point
        const tb = this._tb || (this._tb = new Map()); let tmp = tb.get(K); if (!tmp) tb.set(K, (tmp = new Body({ ...bodySpec(K) })));
        const com = K.com || [0, 0, 0], cs = Math.cos(c.h), sn = Math.sin(c.h);
        tmp.setPose(c.x + com[0] * cs + com[2] * sn, c.y + com[1], c.z - com[0] * sn + com[2] * cs, c.h);
        const k = tmp.kAlong(px - tmp.p[0], py - tmp.p[1], pz - tmp.p[2], c.nx, 0, c.nz);
        j = (1.3 * c.vn) / (k + 1 / mc);
      }
      const lift = K.cls === 'free' ? 0.18 + (car && T.L > 4 ? 0.06 : 0) : 0.05;
      this.knock(c, c.nx * j, j * lift, c.nz * j, px, py, pz, by);
      let dv = j / mc + (K.cls !== 'free' ? (K.breakP * 0.35) / mc : 0);
      dv = Math.min(dv, c.vn * 0.92);
      lost += this.slow(v, c.nx, c.nz, dv, fx, fz);
      vx = car ? v.vx : fx * v.speed; vz = car ? v.vz : fz * v.speed;
      if (!car && K.mass > 6) this.emit('bikeHit', { v, severity: Math.min(1, dv / Math.max(1, sp) + K.mass / 200), kind: c.k, speed: sp });
    }
    // bodies already loose: the vehicle shoves them
    for (let li = 0; li < n0 && li < this.live.length; li++) {
      const P = this.live[li], b = P.body; if (b.kin) continue;      // (not what was knocked just now: its impulse is in)
      if (Math.abs(b.p[0] - cx) > half + r + b.br + 1 || Math.abs(b.p[2] - cz) > half + r + b.br + 1) continue;
      if (b.p[1] - b.br > (v.y || 0) + (v.type === 'bus' ? 4 : car ? 1.5 : 1.3)) continue;
      for (const pr of b.probes) {
        const w = b.rot(pr[0], pr[1], pr[2], this._v), wx = b.p[0] + w[0], wy = b.p[1] + w[1], wz = b.p[2] + w[2];
        const d = seg(wx, wz), pen = r + pr[3] - d; if (pen <= 0 || d < 1e-4) continue;
        const nx = (wx - this._sx) / d, nz = (wz - this._sz) / d;
        const rx = wx - nx * pr[3] - b.p[0], ry = wy - b.p[1], rz = wz - nz * pr[3] - b.p[2];
        const bvn = (b.v[0] + b.w[1] * rz - b.w[2] * ry) * nx + (b.v[2] + b.w[0] * ry - b.w[1] * rx) * nz;
        const rel = vx * nx + vz * nz - bvn;
        if (rel > 0.05) {
          const k = b.kAlong(rx, ry, rz, nx, 0, nz), j = (1.25 * rel) / (k + 1 / mc);
          b.applyImpulse(nx * j, j * (P.ball ? 0.25 : 0.08), nz * j, b.p[0] + rx, b.p[1] + ry, b.p[2] + rz);
          lost += this.slow(v, nx, nz, Math.min(rel, j / mc), fx, fz);
          if (P.ball && rel > 2) this.sendBall(P, nx * j / b.m, j * 0.25 / b.m, nz * j / b.m);
        }
        b.p[0] += nx * pen * 0.9; b.p[2] += nz * pen * 0.9; b.wake();
        break;
      }
    }
    // trees: a hit shakes leaves down; a fast car whirls up the fallen ones under street trees
    if (this.tcells) for (let i = Math.floor((cx - half - 4) / 16); i <= Math.floor((cx + half + 4) / 16); i++) for (let j = Math.floor((cz - half - 4) / 16); j <= Math.floor((cz + half + 4) / 16); j++) {
      const a = this.tcells.get(i * 65536 + j); if (!a) continue;
      for (const t of a) {
        const d = seg(t.x, t.z), tn = this.fx.alive < 500 ? this.game.elapsed || 0 : 0; if (!tn || tn - t.cool < 3) continue;
        if (d < r + 0.42 && sp > 2.5) { t.cool = tn; this.leaves(t.x, (this.W.groundHeight(t.x, t.z) || 0) + Math.min(9, t.s * 0.55), t.z, Math.min(40, 10 + sp * 3), 2.2, t.x * 3 + t.z); this.sound.thud(t.x, t.z, sp); }
        else if (car && d < r + 2.8 && sp > 9 && this.game.player.vehicle === v) { t.cool = tn; this.leaves(t.x + (this._sx - t.x) * 0.5, (this.W.groundHeight(t.x, t.z) || 0) + 0.15, t.z + (this._sz - t.z) * 0.5, 6, 0.6, t.x + t.z * 7, vx * 0.3, vz * 0.3); }
      }
    }
    return lost;
  }
  /** take dv off the vehicle along -n (car: its velocity; bike: its speed) -> dv applied */
  slow(v, nx, nz, dv, fx, fz) {
    if (!(dv > 0)) return 0;
    if (v.kind === 'car') { v.vx -= nx * dv; v.vz -= nz * dv; v.speed = v.vx * fx + v.vz * fz; }
    else { const along = nx * fx + nz * fz, s = Math.sign(v.speed) || 1; v.speed -= s * dv * Math.max(0.3, Math.abs(along)); if (Math.sign(v.speed) !== s) v.speed = 0; }
    return dv;
  }
  /** something the car's collider ignores (low) but that holds: stop the car as a wall would */
  blockCar(v, nx, nz, vn, pen, x, z) {
    v.vx -= 1.3 * vn * nx; v.vz -= 1.3 * vn * nz; v.vx *= 0.88; v.vz *= 0.88;
    v.x -= nx * Math.max(0, pen); v.z -= nz * Math.max(0, pen);
    v.speed = v.vx * Math.sin(v.heading) + v.vz * Math.cos(v.heading);
    if (vn > 1.5) this.sound.thud(x, z, vn);
    return vn;
  }

  // ---------------------------------------------------------------- the player on foot
  footContact(dt) {
    const g = this.game, p = g.player;
    if (p.vehicle || p.swim || p.place !== 'world' || g.activity) return;
    const sp = p.speed || 0; if (sp < 0.5) return;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading), pr = p.radius || 0.32, pos = p.pos;
    const hits = this._fh || (this._fh = []); hits.length = 0;
    this.near(pos.x, pos.z, 1.6, (c) => {
      const K = c.K; if (K.cls !== 'free') return;
      if (!(K.walk || (K.sprint && sp > 4.6))) return;
      if (Math.abs((c.y || 0) - pos.y) > 1.2) return;
      const dx = c.x - pos.x, dz = c.z - pos.z, d = Math.hypot(dx, dz); if (d > pr + c.ri + 0.12 || d < 1e-4) return;
      const nx = dx / d, nz = dz / d, vn = (fx * nx + fz * nz) * sp; if (vn < 0.45) return;
      hits.push({ ...c, nx, nz, vn });
    });
    for (const c of hits) {
      const K = c.K, run = sp > 4.6, top = topOf(K), py = c.y + Math.min(top * 0.75, 0.75), px = c.x - c.nx * c.ri, pz = c.z - c.nz * c.ri;
      const b = new Body({ ...bodySpec(K) }), com = K.com || [0, 0, 0];
      b.setPose(c.x, c.y + com[1], c.z, c.h);
      const k = b.kAlong(px - b.p[0], py - b.p[1], pz - b.p[2], c.nx, 0, c.nz);
      const vrel = c.vn * (run ? 1.05 : 0.6), j = (1.2 * vrel) / (k + 1 / 75);
      this.knock(c, c.nx * j, j * 0.1, c.nz * j, px, py, pz, 'foot');
      if (run && K.mass > 6) {
        const strength = Math.min(1, K.mass / 30);
        p.speed *= 1 - 0.5 * strength;
        this.emit('playerBump', { strength, dx: c.nx, dz: c.nz, kind: c.k });
        if (typeof p.stumble === 'function') { try { p.stumble(strength, c.nx, c.nz); } catch { /* the stumble animation is someone else's */ } }
      }
    }
    // loose props: walk into them and they get shoved
    for (const P of this.live) {
      const b = P.body; if (b.kin || Math.abs(b.p[0] - pos.x) > 2.5 || Math.abs(b.p[2] - pos.z) > 2.5 || b.p[1] - b.br > pos.y + 1.4) continue;
      for (const q of b.probes) {
        const w = b.rot(q[0], q[1], q[2], this._v), wx = b.p[0] + w[0], wy = b.p[1] + w[1], wz = b.p[2] + w[2];
        if (wy - q[3] > pos.y + 1.5) continue;
        const dx = wx - pos.x, dz = wz - pos.z, d = Math.hypot(dx, dz), pen = pr + q[3] - d; if (pen <= 0 || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, rel = (fx * nx + fz * nz) * sp - (b.v[0] * nx + b.v[2] * nz);
        if (rel > 0.1) {
          const rx = wx - nx * q[3] - b.p[0], ry = Math.min(wy, pos.y + 0.5) - b.p[1], rz = wz - nz * q[3] - b.p[2];
          const k = b.kAlong(rx, ry, rz, nx, 0, nz), j = (1.1 * rel * (P.ball ? 1.15 : 0.7)) / (k + 1 / 75);
          b.applyImpulse(nx * j, P.ball ? j * 0.15 : 0, nz * j, b.p[0] + rx, b.p[1] + ry, b.p[2] + rz);
          if (P.ball && rel > 1) this.sendBall(P, nx * j / b.m, (P.ball ? j * 0.15 : 0) / b.m, nz * j / b.m);
        }
        b.p[0] += nx * pen * 0.8; b.p[2] += nz * pen * 0.8; b.wake();
        break;
      }
    }
  }
  /** [E] kick: the nearest light thing in front of you */
  findKick() {
    const p = this.game.player; this.kickTarget = null; this.kickPos.set(0, -1000, 0);
    if (p.vehicle || p.swim || p.place !== 'world') return;
    let best = null, bd = 1.7;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const score = (x, z) => { const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz); return d - (d > 0.01 ? (dx * fx + dz * fz) / d * 0.4 : 0); };
    for (const P of this.live) { if (P.body.kin || P.K.mass > 30) continue; const s = score(P.body.p[0], P.body.p[2]); if (s < bd && Math.abs(P.body.p[1] - p.pos.y) < 1.5) { bd = s; best = { P }; } }
    this.near(p.pos.x, p.pos.z, 2, (c) => { if (c.K.cls !== 'free' || c.K.mass > 30) return; const s = score(c.x, c.z); if (s < bd) { bd = s; best = { c: { ...c } }; } });
    if (!best) return;
    this.kickTarget = best;
    const P = best.P, x = P ? P.body.p[0] : best.c.x, z = P ? P.body.p[2] : best.c.z;
    this.kickPos.set(x, p.pos.y, z);
    const k = P ? P.k : best.c.k;
    this.kickLabel = k === 'ball' ? 'Kick the ball' : /bin|wheelie/.test(k) ? 'Kick the bin' : k === 'cone' ? 'Kick the cone' : 'Kick it';
  }
  kick() {
    const T = this.kickTarget, p = this.game.player; if (!T) return;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const K = T.P ? T.P.K : T.c.K, sp = K.mass < 1 ? 11 : 6 / Math.sqrt(Math.max(1, K.mass / 4));
    const m = K.mass, jx = fx * sp * m, jz = fz * sp * m, jy = (K.mass < 1 ? 0.35 : 0.25) * sp * m;
    if (T.P) {
      const b = T.P.body; b.applyImpulse(jx, jy, jz, b.p[0] - fx * 0.05, b.p[1] - (K.mass < 1 ? 0.03 : 0), b.p[2] - fz * 0.05);
      this.sound.impact(K.mat, 5, b.p[0], b.p[2]);
      if (T.P.ball) this.sendBall(T.P, jx / m, jy / m, jz / m);
      else this.send({ id: T.P.id, t: this.now(), dv: [jx / m, jy / m, jz / m], c: [0, 0.3, 0], flags: 0 });
    } else {
      const c = T.c; this.knock(c, jx, jy, jz, c.x - fx * c.ri, c.y + Math.min(0.35, topOf(K) * 0.4), c.z - fz * c.ri, 'foot');
      this.sound.impact(K.mat, 5, c.x, c.z);
    }
    this.kickTarget = null;
  }

  // ---------------------------------------------------------------- footballs
  ballsUpdate() {
    const g = this.game, p = g.player.pos;
    for (const B of this.balls) {
      const x = B.P ? B.P.body.p[0] : B.x, z = B.P ? B.P.body.p[2] : B.z, d = Math.hypot(x - p.x, z - p.z);
      if (!B.P && d < 45 && g.player.place === 'world') {
        const c = { src: 'b', id: B.id, k: 'ball', K: B.K, x: B.x, y: this.W.groundHeight(B.x, B.z), z: B.z, h: 0, it: null, fi: null, ri: 0.11 };
        B.P = this.spawn(c); if (B.P) B.P.body.sleep();
      } else if (B.P && d > 60 && !B.P.body.awake) {
        B.x = B.P.body.p[0]; B.z = B.P.body.p[2];
        if (Math.hypot(B.x - B.home[0], B.z - B.home[1]) > 80 || B.P.body.wet) { B.x = B.home[0]; B.z = B.home[1]; }
        this.restore(B.P); B.P = null;
      }
    }
  }
  sendBall(P, dvx, dvy, dvz) {
    const b = P.body;
    if (this.now() - (P.lastSend || 0) < 150) return;
    P.lastSend = this.now();
    this.send({ id: P.id, t: P.lastSend, dv: [dvx, dvy, dvz], c: [0, 0, 0], flags: 2, at: [b.p[0], b.p[1], b.p[2]] });
  }

  // ---------------------------------------------------------------- network
  send(k) {
    const net = this.game.net; if (!net || !net.send || !net.others || !net.others.size) return;
    const a = encodeKnock(k); net.send(KNOCK, a); this.sent++; this.bytes += JSON.stringify(a).length;
  }
  onNet(d) { const k = decodeKnock(d); if (!k) return; this.recv++; this.applyKnock(k, true); }
  /** replay a knock event (from the network, or a test): the same impulse at the same point on our copy of the prop */
  applyKnock(k, fromNet = true) {
    if (!this.ready) return false;
    const by = fromNet ? 'net' : 'debug';
    if (k.flags & 2) {
      const B = this.balls.find((q) => q.id === k.id); if (!B) return false;
      if (!B.P) { if (k.at) { B.x = k.at[0]; B.z = k.at[2]; } B.P = this.spawn({ src: 'b', id: B.id, k: 'ball', K: B.K, x: B.x, y: this.W.groundHeight(B.x, B.z), z: B.z, h: 0, ri: 0.11 }); }
      const b = B.P.body;
      if (k.at && Math.hypot(b.p[0] - k.at[0], b.p[2] - k.at[2]) > 1) { b.p[0] = k.at[0]; b.p[1] = k.at[1]; b.p[2] = k.at[2]; }
      b.v[0] = 0; b.v[1] = 0; b.v[2] = 0; b.applyImpulse(k.dv[0] * b.m, k.dv[1] * b.m, k.dv[2] * b.m, b.p[0], b.p[1], b.p[2]);
      return true;
    }
    const P0 = this.byId.get(k.id);
    if (P0) { if (!P0.body.kin) { const m = P0.K.mass, b = P0.body; b.applyImpulse(k.dv[0] * m, k.dv[1] * m, k.dv[2] * m, b.p[0], b.p[1], b.p[2]); } return true; }
    const c = this.candById(k.id); if (!c) return false;
    const m = c.K.mass;
    return !!this.knock(c, k.dv[0] * m, k.dv[1] * m, k.dv[2] * m, c.x + k.c[0], c.y + k.c[1], c.z + k.c[2], by, k.flags, k.t);
  }

  // ---------------------------------------------------------------- police (optional): vandalism the police saw
  heat(K, x, z, by) {
    const pol = this.game.police; if (!pol || !K.heat || by === 'net' || by === 'ai' || by === 'debug') return;
    if (K.heat < 1 && by === 'foot') return;
    const t = this.game.elapsed || 0; if (t - this.heatT < 0.8 && K.heat < 2) return;
    try { const seen = pol.witnesses(x, z); if (seen >= 1.5) { this.heatT = t; pol.add('vandalism', K.heat, seen); } } catch { /* police optional */ }
  }

  // ---------------------------------------------------------------- solver callbacks / effects
  onWake(b) { const P = b.user; if (P) P.entry.dirty = true; }
  onImpact(b, sp, kind, x, y, z) {
    const P = b.user; if (!P) return;
    this.sound.impact(P.K.mat, sp, x, z);
    if (P.K.lamp && sp > 2.2) { this.sparks(x, y + 0.05, z, Math.min(12, 3 + sp * 1.2), P.id + Math.floor(sp * 7)); if (!P.glassGone) { P.glassGone = true; this.sound.glass(x, z, 1); this.bits(x, y + 0.1, z, 7, P.id, [0.9, 0.85, 0.7], 2); } }
    if (P.K.glassy && sp > 2.5 && !P.glassGone) { P.glassGone = true; this.sound.glass(x, z, 0.8); }
    if (P.hinge && sp > 1.2) P.hinge.w += (hashi(P.id, Math.floor(b.age * 10), 9) - 0.3) * sp * 2.5;
    if (P.K.lid === 'pop' && sp > 5.5 && !P.lidOff) this.popLid(P, 0, 0);
  }
  onSplash(b, sp, x, y, z) {
    this.sound.splash(x, z, sp);
    const n = Math.min(26, 8 + sp * 4), seed = Math.floor(x * 13 + z * 7);
    for (let i = 0; i < n; i++) { const a = hashi(seed, i, 1) * 6.283, s = 0.8 + hashi(seed, i, 2) * 1.6; this.fx.emit(x, y + 0.05, z, Math.cos(a) * s, 2 + hashi(seed, i, 3) * 2.5 * Math.min(1.5, sp / 4), Math.sin(a) * s, 1.2, 0.78, 0.85, 0.9, 3); }
  }
  sparks(x, y, z, n, seed) {
    for (let i = 0; i < n; i++) {
      const a = hashi(seed | 0, i, 11) * 6.283, s = 1.5 + hashi(seed | 0, i, 12) * 3;
      this.fx.emit(x, y, z, Math.cos(a) * s, 1 + hashi(seed | 0, i, 13) * 3.5, Math.sin(a) * s, 0.35 + hashi(seed | 0, i, 14) * 0.4, 1, 0.78 + hashi(seed | 0, i, 15) * 0.2, 0.35, 0);
    }
  }
  bits(x, y, z, n, seed, col, speed = 1.5, vx = 0, vz = 0) {
    for (let i = 0; i < n; i++) {
      const a = hashi(seed | 0, i, 21) * 6.283, s = speed * (0.3 + hashi(seed | 0, i, 22));
      const c = col || LITTER[Math.floor(hashi(seed | 0, i, 23) * LITTER.length)];
      this.fx.emit(x, y, z, vx + Math.cos(a) * s, 0.8 + hashi(seed | 0, i, 24) * 1.8, vz + Math.sin(a) * s, 40 + hashi(seed | 0, i, 25) * 20, c[0], c[1], c[2], 1);
    }
  }
  leaves(x, y, z, n, spread, seed, vx = 0, vz = 0) {
    for (let i = 0; i < n; i++) {
      const a = hashi(seed | 0, i, 31) * 6.283, r = hashi(seed | 0, i, 32) * spread, k = hashi(seed | 0, i, 33);
      const c = k < 0.4 ? [0.42, 0.36, 0.12] : k < 0.7 ? [0.55, 0.38, 0.12] : [0.3, 0.42, 0.14];
      this.fx.emit(x + Math.cos(a) * r, y + (hashi(seed | 0, i, 34) - 0.5) * 1.5, z + Math.sin(a) * r, vx + Math.cos(a) * 0.4, vx || vz ? 1.5 + k : -0.2, vz + Math.sin(a) * 0.4, 7 + k * 5, c[0], c[1], c[2], 2);
    }
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.game;
    if (!this.ready) { try { this.tryInit(); } catch (e) { console.error('[props] init', e); this.ready = false; this.dead = true; } if (!this.ready) return; }
    if (g.scene !== g.worldScene) return;
    this.sound.tick(dt);
    this.footContact(dt);
    if ((this.kickT -= dt) <= 0) { this.kickT = 0.15; this.findKick(); }
    if (this.balls.length && (this.ballT -= dt) <= 0) { this.ballT = 0.5; this.ballsUpdate(); }
    if (!this.live.length) { this.fx.update(dt, this.W.groundHeight); if (this.smesh && this.smesh.dirtyLayout) this.smesh.flush(); if (this.fmesh.dirtyLayout) this.fmesh.flush(); return; }
    if (!this.paused) this.phys.step(dt);
    let slide = 0, sx = 0, sz = 0;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const P = this.live[i], b = P.body;
      if (b.dead) { if (P.ball) { const B = this.balls.find((q) => q.P === P); if (B) { B.x = B.home[0]; B.z = B.home[1]; } } this.restore(P); continue; }
      if (P.kin) { if (!this.paused) this.kinStep(P, dt); continue; }
      if (P.flick > 0 && !this.paused) {
        P.flick -= dt;
        const on = P.flick > 0 && hashi(P.id, Math.floor((g.elapsed || 0) * 22), 41) > 0.45 - P.flick * 0.25;
        const glow = P.flick > 0 ? (on ? 1 : 0.05) : 0;
        if (glow !== P.entry.glow) { P.entry.glow = glow; P.entry.dirty = true; }
        if (P.flick <= 0 && this.ss) this.ss.lampDark(P.id, true);
      }
      if (!b.awake) continue;
      P.entry.dirty = true;
      if (P.hinge && !this.paused) this.hingeStep(P, dt);
      if (P.K.litter && !P.spilled && b.upY < 0.35) {
        P.spilled = true; const top = topOf(P.K) - (P.K.com ? P.K.com[1] : 0), m = b.rot(0, top, 0, this._v);
        this.bits(b.p[0] + m[0], b.p[1] + m[1], b.p[2] + m[2], P.K.litter, P.id + Math.floor(P.t0 % 1e6), P.K.glassy ? null : null, 1.6, b.v[0] * 0.5, b.v[2] * 0.5);
        if (P.K.glassy) this.sound.glass(b.p[0], b.p[2], 0.6);
      }
      if (b.ground && b.slide > slide) { slide = b.slide; sx = b.p[0]; sz = b.p[2]; }
    }
    this.sound.scrape(this.paused ? 0 : Math.max(0, slide - 0.4) / 4, sx, sz, dt);
    if (!this.paused) this.fx.update(dt, this.W.groundHeight);
    if (this.smesh) this.smesh.flush();
    this.fmesh.flush();
    if ((this.timer -= dt) <= 0) { this.timer = 1; this.restoreCheck(); }
  }
  hingeStep(P, dt) {
    const H = P.hinge, R = P.body.R, gy = -R[4], gz = -R[5];
    H.w += 28 * (gy * Math.cos(H.a) - gz * Math.sin(H.a) + 0.04) * dt; H.w *= Math.exp(-2.5 * dt);
    H.a += H.w * dt;
    if (H.a < 0) { H.a = 0; H.w = -H.w * 0.3; if (Math.abs(H.w) > 1.5) this.sound.impact('plastic', 1.5, P.body.p[0], P.body.p[2]); }
    if (H.a > 2.3) { H.a = 2.3; H.w = -H.w * 0.3; }
  }
  kinStep(P, dt) {
    const k = P.kin; if (k.a >= k.target) return;
    k.a = Math.min(k.target, k.a + dt * 6);
    const b = P.body, h = k.h, s = Math.sin(k.a / 2), cq = Math.cos(k.a / 2);
    const qa = [k.ax * s, 0, k.az * s, cq], qy = [0, Math.sin(h / 2), 0, Math.cos(h / 2)];
    b.q[0] = qa[3] * qy[0] + qa[0] * qy[3] + qa[1] * qy[2] - qa[2] * qy[1];
    b.q[1] = qa[3] * qy[1] - qa[0] * qy[2] + qa[1] * qy[3] + qa[2] * qy[0];
    b.q[2] = qa[3] * qy[2] + qa[0] * qy[1] - qa[1] * qy[0] + qa[2] * qy[3];
    b.q[3] = qa[3] * qy[3] - qa[0] * qy[0] - qa[1] * qy[1] - qa[2] * qy[2];
    const R = b.R; quat(b.q, R);
    const com = P.K.com || [0, 0, 0];      // the yaw is already in R: the centre of mass sits at R·com above the foot
    b.p[0] = k.base[0] + R[0] * com[0] + R[1] * com[1] + R[2] * com[2]; b.p[1] = k.base[1] + R[3] * com[0] + R[4] * com[1] + R[5] * com[2]; b.p[2] = k.base[2] + R[6] * com[0] + R[7] * com[1] + R[8] * com[2];
    P.entry.dirty = true;
  }
  restoreCheck() {
    const g = this.game, now = this.now(), cam = g.camera;
    if (!this.live.length) return;
    cam.updateMatrixWorld();
    const fr = this._fr || (this._fr = new THREE.Frustum()), pm = this._pm || (this._pm = new THREE.Matrix4()), sph = this._sph || (this._sph = new THREE.Sphere());
    pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
    const players = [[g.player.pos.x, g.player.pos.z]];
    if (g.net && g.net.others) for (const o of g.net.others.values()) if (o.place === 'world') players.push([o.x, o.z]);
    for (const P of this.live.slice()) {
      if (P.ball || P.parent) continue;
      const age = now - P.t0, b = P.body;
      if (age > FORCE_AGE) { this.restore(P); continue; }
      if (age < RESTORE_AGE || b.awake) continue;
      let near = false;
      for (const [x, z] of players) if (Math.hypot(x - b.p[0], z - b.p[2]) < RESTORE_R || Math.hypot(x - P.home[0], z - P.home[1]) < RESTORE_R) { near = true; break; }
      if (near) continue;
      sph.center.set(b.p[0], b.p[1], b.p[2]); sph.radius = b.br + 1;
      if (fr.intersectsSphere(sph)) continue;
      sph.center.set(P.home[0], b.p[1], P.home[1]); sph.radius = 6;
      if (fr.intersectsSphere(sph)) continue;
      this.restore(P);
    }
    // the last knocked thing went back while nobody was near: its litter goes too
    if (this.fx.alive && !this.live.some((P) => !P.ball && !P.parent)) this.fx.clear();
  }

  // ---------------------------------------------------------------- debug / tests
  /** knock the nearest item of a kind (or by id) to the player as a hatchback at `speed` m/s from the player's side would */
  debugKnock(what, speed = 8, opts = {}) {
    if (!this.ready) this.tryInit();
    const p = this.game.player.pos; let c = null;
    if (typeof what === 'number') c = this.candById(what);
    else { let bd = opts.r || 60; this.near(p.x, p.z, opts.r || 60, (q) => { if (what && !(q.k === what || q.k.startsWith(what) || q.k === 'f.' + what)) return; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; c = { ...q }; } }); }
    if (!c) return null;
    let nx = c.x - p.x, nz = c.z - p.z; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const v = { kind: 'car', type: opts.type || 'car_hatch', heading: Math.atan2(nx, nz), vx: nx * speed, vz: nz * speed, speed, y: c.y };
    const T = TYPES[v.type], back = T.L / 2 + c.ri + 0.02 - speed / 60;
    v.x = c.x - nx * back; v.z = c.z - nz * back;
    const lost = this.vehicleContact(v, 1 / 60);
    const P = this.byId.get(c.id);
    return { id: c.id, k: c.k, cls: c.K.cls, knocked: !!P, lost: +lost.toFixed(2), after: +Math.hypot(v.vx, v.vz).toFixed(2), x: c.x, z: c.z };
  }
  /**
   * Drive a phantom vehicle straight through the street: {x, z, h, speed, type, secs, freezeAt} — every frame calls
   * vehicleContact and moves it (no static collider). Synchronous; freezeAt pauses the props (for a screenshot).
   */
  debugCrash(o = {}) {
    if (!this.ready) this.tryInit();
    const type = o.type || 'car_hatch', T = TYPES[type], sp = o.speed ?? 12, h = o.h ?? this.game.player.heading;
    const v = { kind: T.kind, type, x: o.x ?? this.game.player.pos.x, z: o.z ?? this.game.player.pos.z, y: 0, heading: h, vx: Math.sin(h) * sp, vz: Math.cos(h) * sp, speed: sp };
    const log = []; const dt = 1 / 60, n = Math.round((o.secs ?? 1.5) / dt), knocks0 = this.knocks;
    if (this.ghost) { this.ghost.removeFromParent(); this.ghost = null; }
    if (o.show && this.game.vehicles && this.game.vehicles.createMesh) { try { this.ghost = this.game.vehicles.createMesh(type); this.game.worldScene.add(this.ghost); } catch { this.ghost = null; } }
    this.paused = false;
    for (let i = 0; i < n; i++) {
      this.vehicleContact(v, dt);
      v.x += v.vx * dt; v.z += v.vz * dt; v.y = this.W.groundHeight(v.x, v.z);
      if (this.ghost) { this.ghost.position.set(v.x, v.y, v.z); this.ghost.rotation.y = Math.atan2(v.vx, v.vz) || v.heading; }
      this.update(dt);
      if (i % 10 === 0) log.push(+Math.hypot(v.vx, v.vz).toFixed(2));
      if (o.freezeAt !== undefined && i * dt >= o.freezeAt) { this.paused = true; break; }
    }
    return { knocked: this.knocks - knocks0, speeds: log, end: [+v.x.toFixed(1), +v.z.toFixed(1)], awake: this.phys.awakeCount(), live: this.live.length };
  }
  /**
   * Screenshot helper: the nearest `kind` to (x0, z0) -> {x, z, h} for game.perf.goto (a spot 7 m out on the road side
   * looking back at it) and remembers a crash through it along the street for debugCrash(this.view.crash).
   */
  debugView(kind, x0, z0, opts = {}) {
    if (!this.ready) this.tryInit();
    const cands = [];
    this.near(x0, z0, opts.r || 2500, (q) => { if (!(q.k === kind || q.k.startsWith(kind)) || (q.it && q.it.nday !== undefined)) return; cands.push({ ...q, d: Math.hypot(q.x - x0, q.z - z0) }); });
    cands.sort((p, q) => p.d - q.d);
    const start = opts.run ?? 14, sp = opts.speed ?? 12, lane = opts.lane ?? 0.2;
    // the first target (and direction along the street) whose run-up is clear of everything but its own kind
    let c = null, side = 1;
    for (const q of cands.slice(0, 60)) {
      for (const sd of [1, -1]) {
        const rx = Math.sin(q.h), rz = Math.cos(q.h), ax = rz, az = -rx;
        let clear = true;
        for (let d = 2; d <= start + 2 && clear; d += 1.5) {
          const px = q.x - ax * d * sd + rx * lane, pz = q.z - az * d * sd + rz * lane;
          this.near(px, pz, 2.2, (o) => { if (!(o.k === kind || o.k.startsWith(kind))) clear = false; });
          const C = this.game.worldCollider; if (C && !C.isFree(px, pz, 0.9)) clear = false;
        }
        if (clear) { c = q; side = sd; break; }
      }
      if (c) break;
    }
    if (!c) return null;
    const rx = Math.sin(c.h), rz = Math.cos(c.h), ax = rz, az = -rx;     // towards the road / along the street
    const out = opts.out ?? 7, back = opts.back ?? 3;
    const x = c.x + rx * out - ax * back * side, z = c.z + rz * out - az * back * side;
    this.view = { id: c.id, k: c.k, crash: { x: c.x - ax * start * side + rx * lane, z: c.z - az * start * side + rz * lane, h: Math.atan2(ax * side, az * side), speed: sp, type: opts.type || 'car_hatch', secs: opts.secs ?? 3, freezeAt: opts.freezeAt, show: true } };
    return { x, z, h: Math.atan2(c.x - x, c.z - z) };
  }
  stats() {
    let awake = 0, kin = 0; for (const P of this.live) { if (P.body.kin) kin++; else if (P.body.awake) awake++; }
    const draws = (this.smesh && this.smesh.mesh.visible ? 1 : 0) + (this.fmesh && this.fmesh.mesh.visible ? 1 : 0) + (this.fx.mesh.visible ? 1 : 0);
    return { ready: this.ready, live: this.live.length, awake, bent: kin, sleeping: this.live.length - awake - kin, particles: this.fx.alive, draws, knocks: this.knocks, sent: this.sent, recv: this.recv, bytesSent: this.bytes, balls: this.balls.length, furniture: this.fitems ? this.fitems.length : 0, steps: this.phys.steps };
  }
}

function radiusOf(K) {
  if (K.shape === 'cyl') return Math.max(K.r0, K.r1);
  if (K.shape === 'sphere') return K.r;
  if (K.shape === 'box') return (K.h[0] + K.h[2]) / 2;
  return 0.3;
}
function topOf(K) { return K.shape === 'cyl' ? K.y1 : K.shape === 'sphere' ? 2 * K.r : K.shape === 'box' ? K.c[1] + K.h[1] : 1; }
function quat(q, R) {
  const x = q[0], y = q[1], z = q[2], w = q[3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  R[0] = 1 - (yy + zz); R[1] = xy - wz; R[2] = xz + wy; R[3] = xy + wz; R[4] = 1 - (xx + zz); R[5] = yz - wx; R[6] = xz - wy; R[7] = yz + wx; R[8] = 1 - (xx + yy);
}
