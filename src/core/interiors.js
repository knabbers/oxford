// Enterable buildings. Each interior is its own THREE.Scene + Collider, built lazily.
//
// SEAMLESS (walk-in) interiors — the one way rooms are entered (docs/ARCHITECTURE.md "Walk-in interiors"):
// a room registered with `seamless: {...}` sits at its true place in the world. You walk through its real doorway (no
// prompt, no fade, no teleport): the room keeps its own scene, lights, collider and LOCAL coordinates (so everything a
// place module does inside is unchanged), and this file keeps the two frames registered:
//   * a rigid transform local <-> world from the first portal (its local threshold point + outward heading  <->  the
//     same point and heading in the world);
//   * crossing a portal's threshold switches player.place and re-expresses position / heading / velocity / camera yaw in
//     the other frame in the same frame of the game (the picture does not change: see render below);
//   * render: outdoors, every shown room near you is drawn after the world with the same camera expressed in its frame,
//     sharing the depth buffer, through "punched" openings in the building shell (its doorway and windows: a quad that
//     resets depth on the shell's face, so the generic building needs no modelled holes); indoors, the world is drawn
//     first with the camera expressed in world coordinates (only when a declared opening is on screen, scissored to
//     them), then the room over it — so a window is real glass onto the live world: weather, hour, people, traffic;
//   * rooms are built when you come within BUILD_R of them, compiled off the frame, shown within SHOW_R;
//   * doors (core/_doors.js): ctx.addDoor() gives a hinged leaf or an automatic sliding pair that people open by
//     walking at it (or E), driven by the positions of the player, other players and pedestrians.
// player.place is still the room's id while inside (ambience, music, weather on the player, the HUD all key on it), and
// player.worldPos is kept at the true world position.
import * as THREE from 'three';
import { Collider } from './collision.js';
import { deoverlapSteps } from './_deoverlap.js';
import { makeDoor } from './_doors.js';
import * as RV from './_roomview.js';

const qp_ = (k) => { try { return new URLSearchParams(globalThis.location ? globalThis.location.search : '').get(k); } catch { return null; } }, env_ = (k) => (typeof process !== 'undefined' && process.env ? process.env[k] : undefined);
const BUILD_R = 75, SHOW_R = 50, HIDE_R = 60;
// a room's people drawn for real in its impostor, at most. low / medium: the few nearest (each is a draw call or more);
// high / ultra: everyone in the room within sight (the numbers are only a guard) — nobody is left out for cost there
const PEOPLE_CAP = { low: 2, medium: 4, high: 40, ultra: 80 };
const RESIDENT = { low: 8, medium: 12, high: 20, ultra: 30 };      // rooms kept on the graphics card at once, by tier
// LIGHT rooms (`seamless.light: true`): the small one-room premises of a shopping street, dozens within sight at once.
// They are counted apart from the big rooms (a street of shops must not push a college hall off the graphics card, nor
// wait behind one), each holds a small picture (core/_roomview.js FACE_L / ATLAS_L: about a sixth of a big room's), is
// built later (within 14 m beyond where it is shown) and its picture is taken three steps a frame.
const NO_LIGHTPAD = qp_('lightpad') !== '1';      // (OFF until its cost per pixel is measured: ?lightpad=1 turns the padding of room lights on)
const NO_PRESENT = qp_('present') !== '1';        // (OFF until measured: ?present=1 draws a room's frame through world/_surf_present.js)
// Warm-up draws inside the passes that are drawn anyway (the top tier's one-pass post chain, world/post.js inPass):
// a room's first draws used to be two render passes of their own every frame a room near by was being drawn up — one
// pixel on the canvas, one pixel in the post chain's multisampled target — and each pass on those big targets costs
// 2-3 ms on a Radeon Pro 460 whatever is drawn (measured: +2.2 ms a frame for the one in the target, +3.0 for the one
// on the canvas). Now the target's half is drawn at the end of the world's pass (afterWorld) and the canvas's half
// after the composite (afterComposite), both through a viewport that lies off the picture, so they write no pixel.
// `?warmpass=0`: as before (A/B).
const NO_WARMPASS = qp_('warmpass') === '0' || env_('GTO_WARMPASS') === '0';
// Rooms kept on the graphics card behind you (the top tier). A room used to be taken off the card — geometry, its own
// textures, its far pictures — once it was 22 m (a shop) or 45 m (a big room) beyond where it is built, and drawn up
// again, a few meshes and a picture face a frame, on every return: running the High twice warmed every shop twice,
// and coming back to Worcester sent 137 MB of pictures up again. Now, on the top tier, a room stays until the rooms
// on the card hold more than KEEP_MB (450) of pictures (a shop's is at most 5.6 MB with its mipmaps, a big room's at most
// 45 MB) or the tier's count of rooms is passed; then the farthest that is not shown goes, one a frame. A kept room
// that has been out of sight longer than a picture lasts (IMP_REFRESH), the light having changed meanwhile (night
// coming or going, or half an hour of the day), has its pictures taken again, in place, as the player comes back
// within range and before it is shown. `?roomkeep=0`: as before (A/B); `?roomkeep=<MB>`: the budget.
const KEEP_Q = qp_('roomkeep') ?? env_('GTO_ROOMKEEP') ?? null, NO_KEEP = KEEP_Q === '0', KEEP_MB = KEEP_Q && +KEEP_Q > 0 ? +KEEP_Q : 450;
const NO_REVEAL = qp_('reveal') === '0' || env_('GTO_REVEAL') === '0';      // (a measuring switch: shut doorways as before P.reveal)
const RESIDENT_LIGHT = { low: 10, medium: 16, high: 28, ultra: 40 };
const LAZY_R = 110;            // m: a lazily registered room is registered for real when the player is this near (registerLazy)
const qp = (k) => { try { return new URLSearchParams(globalThis.location ? globalThis.location.search : '').get(k); } catch { return null; } };
const env = (k) => (typeof process !== 'undefined' && process.env ? process.env[k] : undefined);
export const SEAMLESS = !(qp('seamless') === '0' || env('GTO_SEAMLESS') === '0');
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

const _w2 = [0, 0], _l2 = [0, 0], _l3 = [0, 0], _pt = { x: 0, z: 0 };
const _clip = new Float64Array(24);
const TEXKEYS = ['map', 'normalMap', 'emissiveMap', 'alphaMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'lightMap', 'bumpMap'];
const WARM = 2;                // camera layer of the warm-up draws
const IMP_REFRESH = 40;        // s: a shown room's impostor is taken again this often (its lights follow the hour)

/**
 * Split a room's merged static meshes by zone (boxes in room coordinates: `seamless.zones`), so that the frustum — and
 * the narrowed frustum through a window or a doorway — culls whole parts of a building instead of drawing every
 * building-wide mesh. Each piece stays a child of the original mesh (whose own geometry becomes the first piece), so a
 * module that kept the mesh still hides / shows all of it.
 */
function* splitByZones(scene, zones) {      // (a generator: left after every mesh it has cut up — _buildStep)
  const nz = zones.length, zoneOf = (x, y, z) => { for (let i = 0; i < nz; i++) { const b = zones[i]; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= (b.y0 ?? -1e9) && y <= (b.y1 ?? 1e9)) return i; } return nz; };
  const list = []; let made = 0;
  for (const o of scene.children) if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.geometry && !Array.isArray(o.material) && !o.children.length && !o.userData.noSplit) list.push(o);
  for (const m of list) {
    const g = m.geometry, pos = g.attributes.position; if (!pos || (g.groups && g.groups.length > 1) || Object.keys(g.morphAttributes || {}).length) continue;
    let plain = true; for (const k in g.attributes) { const a = g.attributes[k]; if (a.isInterleavedBufferAttribute || !a.array) plain = false; } if (!plain) continue;
    const idx = g.index ? g.index.array : null, nT = Math.floor((idx ? idx.length : pos.count) / 3); if (nT < 16) continue;
    m.updateMatrix(); const e = m.matrix.elements, P = pos.array, zt = new Uint8Array(nT), cnt = new Array(nz + 1).fill(0);
    for (let t = 0; t < nT; t++) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 3; k++) { const i = (idx ? idx[t * 3 + k] : t * 3 + k) * 3; x += P[i]; y += P[i + 1]; z += P[i + 2]; }
      x /= 3; y /= 3; z /= 3;
      const zi = zoneOf(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      zt[t] = zi; cnt[zi]++;
    }
    if (cnt.filter((c) => c > 0).length < 2) continue;
    let first = true;
    for (let zi = 0; zi <= nz; zi++) {
      if (!cnt[zi]) continue;
      const ng = new THREE.BufferGeometry(), nv = cnt[zi] * 3;
      for (const k in g.attributes) {
        const a = g.attributes[k], n = a.itemSize, arr = new a.array.constructor(nv * n); let o = 0;
        for (let t = 0; t < nT; t++) if (zt[t] === zi) for (let q = 0; q < 3; q++) { const i = (idx ? idx[t * 3 + q] : t * 3 + q) * n; for (let c = 0; c < n; c++) arr[o++] = a.array[i + c]; }
        ng.setAttribute(k, new THREE.BufferAttribute(arr, n, a.normalized));
      }
      ng.computeBoundingBox(); ng.computeBoundingSphere();
      if (first) { first = false; m.geometry = ng; }
      else { const c = new THREE.Mesh(ng, m.material); c.name = m.name; c.castShadow = m.castShadow; c.receiveShadow = m.receiveShadow; c.renderOrder = m.renderOrder; c.frustumCulled = m.frustumCulled; c.layers.mask = m.layers.mask; c.matrixAutoUpdate = false; c.userData.zonePiece = true; m.add(c); made++; }
    }
    g.dispose();
    yield made;
  }
  return made;
}
export class Interiors {
  constructor(game) {
    this.game = game; this.defs = new Map(); this.current = null;
    this.sl = [];                               // seamless defs
    this.camW = null; this.camL = null;         // the frame's camera in world / room coordinates (render)
    this.stats = { crossings: 0, fades: 0, worldPass: 0, roomPass: 0, leafPass: 0, built: 0, warmDraws: 0, cubeFaces: 0, freed: 0 };
    this._pp = []; this._ppl = []; this._envD = { audio: null, gain: 1, useKey: false }; this._rect = { x0: 0, y0: 0, x1: 0, y1: 0, full: false }; this._size = new THREE.Vector2(); this._vp = new THREE.Vector4(); this._sc = new THREE.Vector4(); this._crop = new THREE.Matrix4(); this._pe = new Float64Array(16); this._b = [0, 0, 0, 0]; this._pc = [0, 0, 0];
    // game.eye: the true world position of the eye (== camera.position outdoors; in a walk-in room the camera is in the
    // room's coordinates) — what the outdoor systems stream, cull and light around. Fresh at every read.
    const eye = new THREE.Vector3(), w3 = [0, 0];
    Object.defineProperty(game, 'eye', { configurable: true, get: () => {
      const cam = game.camera, cur = this.current; if (!cam) return eye;
      if (cur && cur.sl && game.player && game.player.place === cur.id && game.world) { const S = cur.sl, w = S.toWorld(cam.position.x, cam.position.z, w3); eye.set(w[0], cam.position.y + S.base(), w[1]); } else eye.copy(cam.position);
      return eye;
    } });
  }

  /**
   * register({
   *   id, name,
   *   doors: [{ pos:[x,z], facing: radians, label?, from?: 'world'|interiorId, locked?: () => string|false }],
   *        pos    = where the door is outside; facing = heading pointing OUT of the building (0 = south/+z, PI/2 = east/+x)
   *        locked = return a reason string to refuse entry (shown as a toast), or false
   *   build(ctx) -> { spawn:[x,z], heading?: radians }      called once. A heavy room may make it a generator
   *        (`*build(ctx) { …; yield; …; return { spawn } }`): it is then run a piece a frame, left at each `yield`
   *        ctx.scene     THREE.Scene to add meshes/lights to (a soft default ambient light is already there)
   *        ctx.collider  Collider for this room: add walls, furniture
   *        ctx.addExit(x, z, label?)   put a "leave" door inside
   *        ctx.setGround((x,z) => y)   optional floor height function (stairs, raked seating)
   *        ctx.id        the interior id (use as `place` for game.interact.add)
   *   onEnter?(), onExit?(), update?(dt)   update runs only while the local player is inside
   *   background?: hex colour, ambient?: 0..1
   * })
   */
  register(def) {
    const d = { doors: [], ...def, built: false, scene: null, collider: null, ground: null, spawn: [0, 0], heading: 0, doorList: [], colliders: [] };
    this.defs.set(d.id, d);
    if (def.seamless && SEAMLESS) { try { this._seamless(d); } catch (e) { console.error('[interiors] seamless', d.id, e && e.stack || e); d.sl = null; } } else d.sl = null;
    for (const door of d.doors) {
      if (d.sl && ((door.from || 'world') === 'world' || (d.sl.linkIds && d.sl.linkIds.has(door.from)))) { door.from = door.from || 'world'; continue; }      // a real doorway (from the street, or from the room it opens off): no prompt
      door.from = door.from || 'world';
      this.game.interact.add({
        place: door.from, pos: door.pos, radius: door.radius || 1.8,
        label: door.label || `Enter ${d.name}`,
        onUse: () => this.enter(d.id, door),
      });
    }
    return d;
  }

  /**
   * A room that costs nothing until the player is near: registerLazy({ id, pos: [x, z] (world: about where its door is),
   * r?: metres (default 110), make() }) — make() is called once, when the player first comes within r of pos (one room
   * a frame, the nearest first), or when something asks for the room by id (get / warm / enterNow), and must register
   * the room (register({ id, … })) or return its definition for that; it may also decide there is no room (return
   * nothing). Until then there is no plan, no opening punched in the building, no collider passage, nothing looked at
   * each frame but one distance. For streets of small premises (places/cornmarket_shops.js).
   */
  registerLazy(o) { const e = { id: o.id, x: o.pos[0], z: o.pos[1], r: o.r || LAZY_R, make: o.make, done: false }; (this.lazy || (this.lazy = [])).push(e); (this.lazyById || (this.lazyById = new Map())).set(e.id, e); this.lazyLeft = (this.lazyLeft || 0) + 1; return e; }
  _realize(e) {
    if (e.done) return this.defs.get(e.id) || null; e.done = true; this.lazyLeft--;
    try { const d = e.make(); if (d && d.id && !this.defs.has(d.id)) this.register(d); } catch (err) { console.warn('[interiors] lazy room', e.id, err); }
    this.stats.realized = (this.stats.realized || 0) + 1;
    return this.defs.get(e.id) || null;
  }
  /** every lazily registered room registered now (tools) */
  realizeAll() { if (this.lazy) for (const e of this.lazy) this._realize(e); }
  _lazyTick(wx, wz) {
    const L = this.lazy; if (!L || !(this.lazyLeft > 0)) return;
    let best = null, bd = 1e9;
    for (let i = 0; i < L.length; i++) { const e = L[i]; if (e.done) continue; const q = Math.abs(e.x - wx) + Math.abs(e.z - wz); if (q < e.r * 1.4 && q < bd) { const h = Math.hypot(e.x - wx, e.z - wz); if (h < e.r && h < bd) { bd = h; best = e; } } }
    if (best) this._realize(best);
  }
  get(id) { const d = this.defs.get(id); if (d || !this.lazyById) return d; const e = this.lazyById.get(id); return e && !e.done ? this._realize(e) : d; }
  /** build a room ahead of need (loading-screen warm-ups): its module's build() — the one part that cannot be spread
   *  over frames — now; the rest (the z-fighting pass, zones, its far view: _buildStep) a few ms a frame when the player
   *  first comes within range of it. (It used to be all of it, here: 0.3–0.6 s of z-fighting pass per big room on the
   *  loading screen, 2.5 s in all.) A room that is not walk-in is built whole — and every room where `lazyWarm` is not
   *  set (main.js sets it for the game; the headless tools build whole rooms with it). */
  warm(id) { const d = this.get(id); if (d && !d.built) { try { if (d.sl && this.lazyWarm) { if (!d._bs) do this._buildStep(d, 0); while (!d.built && d._bs && d._bs.stage === 0); } else this._build(d); } catch (e) { console.warn('[interiors] warm', id, e); } } return d; }

  /** build room d now, all of it (a room entered by a tool hook, a loading-screen warm-up, a room another opens off) */
  _build(d) { for (let i = 0; i < 1e6 && !this._buildStep(d, Infinity); i++); }
  /**
   * One frame's share of building room d (ms: the time it may take beyond its first piece of work) -> true once built.
   * A room used to be built in one frame — its module's build(), the z-fighting pass over everything it drew, the split
   * by zones, the fence, its far view: 130 ms measured for the Examination Schools, on the frame the player came within
   * range. Now: the module's build() in one frame (it is the module's own code and cannot be cut), the z-fighting pass
   * a few ms a frame after it (core/_deoverlap.js is a generator), then the zones and the fence, then the view. The room
   * is not `built` — not drawn, not walked into, nobody placed in it — until the last of them.
   */
  _buildStep(d, ms = 5) {
    if (d.built) return true;
    const now = () => performance.now(), B = d._bs || (d._bs = { stage: 0, it: null, t: {} }), t0 = now();
    if (B.stage === 0) {
      // (a module whose build is a GENERATOR — `*build(ctx) { …; yield; … }` — is built a piece a frame: every `yield`
      //  is a place it may be left until the next frame; B.t.steps: what each piece took, ms)
      if (!B.begun) { B.begun = true; B.gen = this._buildA(d); }
      if (B.gen) for (;;) {
        const a = now(), r = B.gen.next(); (B.t.steps || (B.t.steps = [])).push(Math.round((now() - a) * 10) / 10);
        if (r.done) { this._buildEnd(d, r.value); B.gen = null; break; }
        if (now() - t0 > ms) { B.t.build = (B.t.build || 0) + now() - t0; return false; }
      }
      B.t.build = (B.t.build || 0) + now() - t0; B.stage = 1; if (ms !== Infinity) return false;
    }
    if (B.stage === 1) {
      // z-fighting: sink the larger of any two coplanar overlapping surfaces 1.5 mm (once, when the room is built)
      try {
        if (!B.it) B.it = deoverlapSteps(d.scene);
        for (;;) { const r = B.it.next(); if (r.done) { d.deoverlap = r.value; break; } if (now() - t0 > ms) { B.t.deo = (B.t.deo || 0) + now() - t0; return false; } }
      } catch (e) { console.warn('[interiors] deoverlap', d.id, e); }
      B.t.deo = (B.t.deo || 0) + now() - t0; B.it = null; B.stage = 2; if (ms !== Infinity) return false;
    }
    if (B.stage === 2) {
      // (the split by zones: a mesh at a time — 80 ms in one frame for the Ashmolean's four floors)
      const a = now();
      if (d.sl && d.sl.zones && !B.zdone) {
        try { if (!B.zit) B.zit = splitByZones(d.scene, d.sl.zones); for (;;) { const r = B.zit.next(); if (r.done) { d.zonePieces = r.value; break; } if (now() - t0 > ms) { B.t.fence = (B.t.fence || 0) + now() - a; return false; } } }
        catch (e) { console.warn('[interiors] zones', d.id, e); }
        B.zdone = true; B.zit = null;
      }
      this._buildB(d); B.t.fence = (B.t.fence || 0) + now() - a; B.stage = 3; if (ms !== Infinity) return false;
    }
    const a = now();
    d.built = true; d._bs = null;
    if (d.sl) this._seamlessBuilt(d);
    B.t.view = now() - a; d.buildMs = B.t;
    return true;
  }
  _buildA(d) {
    d.scene = new THREE.Scene();
    if (d.sl) d.scene.userData.terrainRoom = d.sl.terrain;      // (world/terrain.js ROOM PASSES)
    d.scene.background = new THREE.Color(d.background ?? 0x0c0c10);
    d.scene.add(new THREE.AmbientLight(0xffffff, d.ambient ?? 0.55));
    d.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x443a30, 0.5));
    d.collider = new Collider(); d.colliders = [d.collider];
    const game = this.game;
    const ctx = {
      id: d.id, scene: d.scene, collider: d.collider, game, seamless: d.sl,
      // (a walk-in room has no "Leave" prompt: its way out is its doorway)
      addExit: (x, z, label) => (d.sl ? null : game.interact.add({ place: d.id, pos: [x, z], radius: 1.6, label: label || 'Leave', onUse: () => this.exit() })),
      setGround: (fn) => { d.ground = fn; },
      /** another collider for this room (an upper storey over a lower one); choose between them with setCollider */
      newCollider: () => { const c = new Collider(); d.colliders.push(c); return c; },
      /** fn(player) -> the Collider in force (multi-storey rooms: by the height of the player's feet) */
      setCollider: (fn) => { d.pickCollider = fn; },
      /** a real door (core/_doors.js makeDoor options) + block: [x0, z0, x1, z1] the closed leaf's line in the collider(s),
       *  colliders: which (default all), portal: index of the seamless portal it closes (its passages follow the door) */
      addDoor: (o) => this._addDoor(d, o),
      /** the colliders portal i is a way through (default: all of the room's) — a multi-storey building's door is in one storey's wall */
      portalColliders: (i, cols) => { (d.portalCols || (d.portalCols = []))[i] = cols; },
    };
    const r = d.build(ctx);
    if (r && typeof r.next === 'function' && typeof r[Symbol.iterator] === 'function') return r;      // (a generator: _buildStep runs it)
    this._buildEnd(d, r); return null;
  }
  _buildEnd(d, r) { r = r || {}; d.spawn = r.spawn || [0, 0]; d.heading = r.heading || 0; }
  _buildB(d) {
    // Safety net: a room's way out is its exit prompt, never a gap in its walls. Fence the footprint of everything the
    // room drew (15 cm outside it), so an open doorway in an outer wall cannot be walked through into the black beyond.
    try {
      const box = new THREE.Box3(), b = new THREE.Box3();
      d.scene.updateMatrixWorld(true);
      d.scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        if (isFinite(b.min.x) && isFinite(b.max.x) && b.max.x - b.min.x < 400 && b.max.z - b.min.z < 400) box.union(b);
      });
      d.box = box;
      const m = 0.15, x0 = box.min.x - m, x1 = box.max.x + m, z0 = box.min.z - m, z1 = box.max.z + m;
      if (isFinite(x0) && isFinite(x1) && d.spawn[0] > x0 && d.spawn[0] < x1 && d.spawn[1] > z0 && d.spawn[1] < z1) {
        d.collider.addSegment(x0, z0, x1, z0); d.collider.addSegment(x1, z0, x1, z1); d.collider.addSegment(x1, z1, x0, z1); d.collider.addSegment(x0, z1, x0, z0);
      }
    } catch (e) { /* the room still works without the fence */ }
  }

  // ================================================================ seamless
  _seamless(d) {
    const S = (d.sl = { openings: [], lift: 0.04, ...d.seamless });
    // a doorway FROM ANOTHER WALK-IN ROOM (portal.off = its id; offAt / offOut / offY = this doorway's threshold point,
    // outward heading and floor height in THAT room's coordinates): no hole in the building's shell, no way through the
    // world's walls — the way through is in that room's walls, and that room is what is seen through it
    for (const q of S.portals) if (q.off) {
      const A = this.defs.get(q.off); if (!A || !A.sl) throw new Error('portal off "' + q.off + '": that room must be a walk-in room registered first');
      q.fromDef = A; q.punch = false;
      if (!q.world && q.offAt) { const w = A.sl.toWorld(q.offAt[0], q.offAt[1]); q.world = [w[0], w[1], (q.offOut ?? 0) + A.sl.rot]; }
      (S.linkIds || (S.linkIds = new Set())).add(A.id); (A.sl.linkIds || (A.sl.linkIds = new Set())).add(d.id);
    }
    const p0 = S.portals[0], W = p0.world;
    S.rot = W[2] - p0.out; S.c = Math.cos(S.rot); S.s = Math.sin(S.rot); S.ox = p0.at[0]; S.oz = p0.at[1]; S.wx = W[0]; S.wz = W[1]; S.y0 = p0.y || 0;
    S.baseY = S.baseY ?? null; S.shown = false; S.ready = false; S.warm = null;
    S.toWorld = (x, z, out = [0, 0]) => { const dx = x - S.ox, dz = z - S.oz; out[0] = S.wx + dx * S.c + dz * S.s; out[1] = S.wz - dx * S.s + dz * S.c; return out; };
    S.toLocal = (x, z, out = [0, 0]) => { const dx = x - S.wx, dz = z - S.wz; out[0] = S.ox + dx * S.c - dz * S.s; out[1] = S.oz + dx * S.s + dz * S.c; return out; };
    S.base = p0.fromDef && S.baseY === null ? () => p0.fromDef.sl.base() + (p0.offY || 0) - S.y0
      : () => { if (S.baseY === null) { const w = this.game.world; S.baseY = (w && w.groundHeight ? w.groundHeight(S.wx, S.wz) : 0) + S.lift - S.y0; } return S.baseY; };
    S.matrix = (out) => out.compose(_v.set(0, 0, 0), _q.setFromAxisAngle(_v2.set(0, 1, 0), S.rot), _s.set(1, 1, 1)).setPosition(S.wx - (S.ox * S.c + S.oz * S.s), S.base(), S.wz - (-S.ox * S.s + S.oz * S.c));
    // (the drawn ground, world/terrain.js ROOM PASSES: the room is one body standing on ONE plane, worked out there from the
    //  surveyed ground at its doorways to the world - the main one first; a room entered from another stands on that
    //  room's. Its scene carries this - _buildA)
    S.terrain = { toWorld: S.toWorld, root: p0.fromDef ? p0.fromDef.sl.terrain : null, doors: () => S.portals.filter((q) => !q.off && !q.fromDef).map((q) => { const w = q.world || S.toWorld(q.at[0], q.at[1]); return [q.at[0], q.at[1], w[0], w[1]]; }) };
    // every portal: its world passage through the building's wall (off while its door is shut)
    const wc = this.game.worldCollider;
    for (const p of S.portals) {
      p.w = p.w || 1.1; p.h = p.h || 2.1; p.y = p.y || 0; p.depth = p.depth ?? 0.3;
      p.dx = Math.sin(p.out); p.dz = Math.cos(p.out); p.tx = Math.cos(p.out); p.tz = -Math.sin(p.out);
      const a = S.toWorld(p.at[0] - p.dx * 0.75, p.at[1] - p.dz * 0.75), b = S.toWorld(p.at[0] + p.dx * (p.depth + 0.9), p.at[1] + p.dz * (p.depth + 0.9));
      p.passages = wc && wc.addPassage && !p.off ? [wc.addPassage(a[0], a[1], b[0], b[1], p.w)] : [];
      // Where a body changes frame: at the plane the doorway is PUNCHED on (where the room starts to be drawn), not
      // always the wall face. A doorway punched inside its threshold (proud < 0: the Cellar Bar's, at the leaf 0.4 m in)
      // used to hand its people to the room 0.3 m BEFORE that plane, and keep them in the room's frame half a metre
      // outside it on the way out: seen from outside, someone standing in the doorway was drawn only where the punched
      // rectangle was — a head, or a slice of them, the rest cut off. cin: metres inside the wall face at which you are
      // the room's; cout: outward of the wall face at which you are the world's again (0.1 m of hysteresis between).
      { const k = p.depth + (p.proud ?? 0.03); p.cin = k < 0 ? -k + 0.05 : 0.1; p.cout = k < 0 ? k + 0.05 : 0.1; }
      p.open = true;
    }
    for (const o of S.openings) { o.dx = Math.sin(o.out); o.dz = Math.cos(o.out); o.tx = Math.cos(o.out); o.tz = -Math.sin(o.out); o.depth = o.depth ?? 0.3; }
    const c = S.toWorld(...(S.center || p0.at)); S.cx = c[0]; S.cz = c[1];
    // bounds: the boxes (room coordinates) that are the inside of the room — which room a world point / the camera is in
    S.bounds = S.bounds || null; S.reach = 30;
    if (S.bounds) for (const b of S.bounds) for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1]) { const w = S.toWorld(x, z, _w2); S.reach = Math.max(S.reach, Math.abs(w[0] - S.cx) + Math.abs(w[1] - S.cz) + 4); }
    S.light = !!S.light; if (S.light && !S.showR) S.showR = 46;      // (a small room is not punched beyond 46 m: core/_roomview.js FAR1)
    S.compiled = false; S.warmQ = null; S.warmI = 0; S.punchPending = true; S.doorPhase = this.sl.length;
    // (showR: the distance it is shown within, default 50; centers: more points to measure it from — a long building)
    S.centersW = S.centers ? S.centers.map((q) => S.toWorld(q[0], q[1]).slice()) : null;
    // (Manhattan distance from a world point to the nearest of the room's centres: who counts as near it)
    S.md = (x, z) => { let m = Math.abs(x - S.cx) + Math.abs(z - S.cz); const C = S.centersW; if (C) for (let i = 0; i < C.length; i++) { const q = Math.abs(x - C[i][0]) + Math.abs(z - C[i][1]); if (q < m) m = q; } return m; };
    // A room BELOW the ground (seamless.groundCut: its footprint, [{ x0, x1, z0, z1 }] in room coordinates, one convex
    // box): the world's ground runs on under its building, level with the paving outside — and an eye in the cellar that
    // is above that level (the third-person camera; anyone on the lobby's steps) looked out of the doorway DOWN through
    // it: the stairwell outside was covered by a sheet of paving that came and went as the eye rose and fell across
    // ground level. While the camera is in such a room the world's ground is not drawn inside the footprint (four
    // clipping planes on the ground's materials for that one pass: renderFrame).
    if (S.groundCut && S.groundCut.length) {
      const b = S.groundCut[0], P = [];
      for (const [x, z, nx, nz] of [[b.x0, 0, -1, 0], [b.x1, 0, 1, 0], [0, b.z0, 0, -1], [0, b.z1, 0, 1]]) {
        // (the plane through this side, its normal OUT of the box, in world coordinates: three clips the negative side, and — clipIntersection — only where every plane does: inside the box)
        const w = S.toWorld(nx ? x : (b.x0 + b.x1) / 2, nz ? z : (b.z0 + b.z1) / 2), wnx = nx * S.c + nz * S.s, wnz = -nx * S.s + nz * S.c;
        P.push(new THREE.Plane(new THREE.Vector3(wnx, 0, wnz), -(wnx * w[0] + wnz * w[1])));
      }
      S.cutPlanes = P;
    }
    RV.setupOps(S);
    this.sl.push(d);
    RV.buildPunch(this, d);
  }
  _hasStencil() { try { const gl = this.game.renderer.getContext(); return !!gl.getContextAttributes().stencil; } catch { return false; } }
  _seamlessBuilt(d) {
    const S = d.sl, g = this.game, R = g.renderer;
    d.bg = d.scene.background && d.scene.background.isColor ? d.scene.background.clone() : new THREE.Color(0x0b0a08);
    d.scene.background = null;
    for (const p of S.portals) {
      const a = [p.at[0] - p.dx * 0.9, p.at[1] - p.dz * 0.9], b = [p.at[0] + p.dx * (p.depth + 0.75), p.at[1] + p.dz * (p.depth + 0.75)];
      for (const c of (d.portalCols && d.portalCols[S.portals.indexOf(p)]) || d.colliders) p.passages.push(c.addPassage(a[0], a[1], b[0], b[1], p.w));
      if (p.fromDef) {      // (the room it opens off must be built: its walls take the passage)
        try {
          const A = p.fromDef; if (!A.built) this._build(A);
          const wa = S.toWorld(a[0], a[1]), wb = S.toWorld(b[0], b[1]), la = A.sl.toLocal(wa[0], wa[1]), lb = A.sl.toLocal(wb[0], wb[1]);
          for (const c of p.offColliders || A.colliders) p.passages.push(c.addPassage(la[0], la[1], lb[0], lb[1], p.w));
        } catch (e) { console.warn('[interiors] portal off', p.off, e); }
      }
      for (const q of p.passages) q.on = p.open;
    }
    this.stats.built++;
    // Fewer kinds of lighting: three makes a separate shader program of every LIT material for every combination of
    // light counts it is drawn under, and the rooms had seventeen (1, 2, 3, 4, 5, 6 or 7 point lights …) — the people's
    // material alone 33 programs, each a link the first time someone is seen in such a room. A room's point lights are
    // made up to 2, 5 or 7 with lights of no brightness (nothing is lit differently; a light of intensity 0 is a few
    // instructions a pixel), which leaves twelve. ?lightpad=1: on (off by default until measured).
    if (!NO_LIGHTPAD && !this.noLightPad && R && R.capabilities && R.capabilities.isWebGL2) { try { let n = 0;      /* (only where there is something to draw with: the headless tools count a room's real lights) */
       d.scene.traverse((o) => { if (o.isPointLight && o.visible) n++; }); const to = n === 0 ? 0 : n <= 2 ? 2 : n <= 5 ? 5 : n <= 7 ? 7 : n; for (let i = n; i < to; i++) { const l = new THREE.PointLight(0x000000, 0, 1); l.name = 'pad'; l.userData.pad = true; d.scene.add(l); } d.lightPad = to - n; } catch { /* as built */ } }
    // lights are on every camera layer this file draws with (door leaves alone; the warm-up draws)
    d.scene.traverse((o) => { if (o.isLight) o.layers.enable(WARM); });
    try {
      const PR = R && R.properties;
      if (PR && PR.get) d.scene.traverse((o) => { const m = o.material; if (!m || Array.isArray(m) || o.name === 'character') return; for (const k of TEXKEYS) { const t = m[k]; if (!t || !t.isTexture || t.isRenderTargetTexture) continue; const own = t.userData.room; if (own === undefined) t.userData.room = PR.get(t).__webglInit ? '*' : d.id; else if (own !== d.id) t.userData.room = '*'; } });
    } catch { /* nothing is freed that is not marked */ }
    try { g._ceilingPrep && g._ceilingPrep(d.scene); } catch { /* the camera falls back to its own rays */ }
    // how it is seen from outside: impostor cube maps, door-leaf proxies in the world's pass, the caps of its openings
    try { RV.builtView(this, d); } catch (e) { console.warn('[interiors] view', d.id, e); }
    // programs compiled off the frame (the room's, and a person's as this room's lights light them), then every mesh is
    // drawn once into one pixel, a few a frame (_warmStep: the GPU pipeline and the uploads happen at a first draw, and
    // must not happen at the door); shown once that is done
    const done = () => { S.compiled = true; };
    try {
      // (with core/_lazylink.js on, the first draws themselves make the programs, at the pace the GPU process makes
      //  them, and are never waited for: compiling the whole room at once here only queues seconds of work in front of
      //  the frames that follow)
      if (R && R.linkWait && R.linkWait.on) done();
      else if (R && R.compileAsync && g.camera) {
        // (a program is made for the target it is drawn into: the screen when the camera is in the room; the post pass's
        //  own target when the room is seen from outdoors on a tier that has one; the room's impostor atlas)
        const ch = g.player && g.player.character && g.player.character.group, jobs = [], prt = R.getRenderTarget ? R.getRenderTarget() : null;
        const vis = []; if (ch) ch.traverse((o) => { vis.push(o, o.visible); o.visible = true; });
        try {
          for (const tg of [null, this._postTarget(), S.atlas || null]) {
            if (tg === undefined || (tg === null && jobs.length)) continue;
            if (R.setRenderTarget) R.setRenderTarget(tg);
            jobs.push(R.compileAsync(d.scene, g.camera, d.scene));
            if (ch && tg !== S.atlas) jobs.push(R.compileAsync(ch, g.camera, d.scene));
          }
        } finally { if (R.setRenderTarget) R.setRenderTarget(prt); for (let i = 0; i < vis.length; i += 2) vis[i].visible = vis[i + 1]; }
        // (what this room adds to the world's pass and its own view meshes: compiled off the frame too)
        const wt = this._postTarget(); if (wt) R.setRenderTarget(wt);
        try {
        if (S.wm && S.wm.length && g.worldScene) { const tmp = new THREE.Group(); for (const m of [...S.wm, S.mBlend, S.cap, ...(S.proxies || []).map((e) => e.mesh)]) if (m) { const q = new THREE.Mesh(m.geometry, m.material); q.frustumCulled = false; tmp.add(q); } jobs.push(R.compileAsync(tmp, g.camera, g.worldScene)); }
        if (S.proxyRoot && S.proxyRoot.children.length && g.worldScene) jobs.push(R.compileAsync(S.proxyRoot, g.camera, g.worldScene));
        } finally { if (wt) R.setRenderTarget(prt); }
        Promise.all(jobs).then(done, done); setTimeout(done, 6000);
      } else done();
    } catch { done(); }
  }
  /** the post pass's scene target on a tier that has one (world/post.js: outdoors the rooms are drawn into it), else null */
  _postTarget() { const g = this.game, P = g.postRender && g.world && g.world.post; try { return (P && P.target && P.target()) || null; } catch { return null; } }
  /** one step of a built room's first draws (all = the rest at once); S.ready when there is nothing left */
  // ph: 0 = both draws now (canvas, then the post target); 1 = the post target's half, inside the world's pass
  // (afterWorld); 2 = the canvas's half of that same step, after the composite (afterComposite), which finishes it
  _warmStep(d, all, ph = 0) {
    const S = d.sl, g = this.game, R = g.renderer;
    if (!S.warmQ) { S.warmQ = []; d.scene.traverse((o) => { if ((o.isMesh || o.isLine || o.isPoints) && o.material && o.name !== 'character' && !o.userData.view) S.warmQ.push(o); }); S.warmI = 0; S.warmMats = new Set(); S.warmChar = false; }
    if (!R || !R.render || !R.setViewport || !R.getViewport || !R.setScissor || !R.getPixelRatio) { S.ready = true; return; }
    const Q = S.warmQ, slice = this._slice || (this._slice = []); slice.length = 0;
    // (a material never drawn may cost the driver a pipeline: one such a step; ones already drawn, up to four)
    let fresh = 0, i0 = S.warmI, char0 = S.warmChar, newMats = null;
    const W2 = ph === 2 ? this._warmCv : null; let charStep = false;
    if (W2) { for (let i = W2.i0; i < W2.i1; i++) slice.push(Q[i]); i0 = W2.i0; char0 = W2.char0; newMats = W2.newMats; }
    else while (S.warmI < Q.length && (all || (slice.length < 4 && fresh < 1))) { const o = Q[S.warmI]; const isNew = !S.warmMats.has(o.material); if (isNew && fresh >= 1 && !all) break; S.warmI++; if (isNew) { fresh++; S.warmMats.add(o.material); (newMats || (newMats = [])).push(o.material); } slice.push(o); }
    let chGrp = null, chPar = null, chVis = null;
    if (W2 ? W2.charStep : S.warmI >= Q.length && !S.warmChar) {      // last: a person in this room's light
      S.warmChar = true; charStep = true; chGrp = g.player && g.player.character && g.player.character.group;
      // (every form a person is drawn in — skinned, in segments, the far stand-in — each is a program of its own under
      //  this room's lights, and the room's people will be in whichever their distance asks for)
      if (chGrp) { chVis = this._chVis || (this._chVis = []); chVis.length = 0; chGrp.traverse((o) => { chVis.push(o, o.visible); o.visible = true; if (o.isMesh) slice.push(o); }); }
      if (chGrp && chGrp.parent !== d.scene) { chPar = chGrp.parent; d.scene.add(chGrp); }
    }
    if (slice.length) {
      const cam = this.camWarm || (this.camWarm = new THREE.PerspectiveCamera(60, 1, 0.1, 200)); cam.layers.set(WARM);
      const fc = this._sliceFC || (this._sliceFC = []); fc.length = 0;
      for (const o of slice) { fc.push(o.frustumCulled); o.frustumCulled = false; o.layers.enable(WARM); }
      const pr = R.getPixelRatio() || 1, vp = R.getViewport(this._vp), sc = R.getScissor ? R.getScissor(this._sc) : null, st = R.getScissorTest ? R.getScissorTest() : false, ac = R.autoClear, ex = R.toneMappingExposure, rt = R.getRenderTarget ? R.getRenderTarget() : null;
      // (a draw whose program is still linking is left out, never waited for — core/_lazylink.js — and the step is
      //  taken again next frame; the room you are standing in is drawn now whatever it costs)
      const LL = R.linkWait || null, sk0 = LL ? LL.skipped : 0, lazy = !!LL && LL.on && !all && (S.warmTries || 0) < 600; if (lazy) LL.force++;      // (600 frames running with nothing got through: then it is waited for after all)
      try {
        if (ph === 1) { R.autoClear = false; R.toneMappingExposure = 1; this._warmInTarget(R, d.scene, cam, true); this.stats.warmDraws += slice.length; }      // (the bound target IS the post target, mid-pass)
        else if (ph === 2) { R.setViewport(-4 / pr, -4 / pr, 1.01 / pr, 1.01 / pr); R.setScissor(0, 0, 1.01 / pr, 1.01 / pr); R.setScissorTest(true); R.autoClear = false; R.toneMappingExposure = 1; R.render(d.scene, cam); }      // (the canvas, in the composite's pass: a viewport off the picture)
        else {
        if (rt && R.setRenderTarget) R.setRenderTarget(null);
        R.setViewport(0, 0, 1.01 / pr, 1.01 / pr); R.setScissor(0, 0, 1.01 / pr, 1.01 / pr); R.setScissorTest(true); R.autoClear = false; R.toneMappingExposure = 1;
        R.render(d.scene, cam); this.stats.warmDraws += slice.length;
        this._warmInTarget(R, d.scene, cam);      // (and as it is drawn from outdoors on a tier with a post pass)
        }
      } catch (e) { if (!this._warmErr) console.warn('[interiors] warm draw', d.id, e); this._warmErr = true; S.warmI = Q.length; }
      finally {
        if (lazy) LL.force--;
        const skip = lazy && LL.skipped > sk0;
        if (ph === 1) this._warmCv = { d, i0, i1: S.warmI, char0, charStep, newMats, skip };      // (finished by its second half)
        else if (lazy || W2) { if (skip || (W2 && W2.skip)) { S.warmTries = (S.warmTries || 0) + 1; S.warmI = Math.min(S.warmI, i0); S.warmChar = char0; if (newMats) for (const m of newMats) S.warmMats.delete(m); } else S.warmTries = 0; }
        R.autoClear = ac; R.toneMappingExposure = ex; R.setViewport(vp); if (sc) R.setScissor(sc); R.setScissorTest(st); if (rt && R.setRenderTarget) R.setRenderTarget(rt);
        for (let i = 0; i < slice.length; i++) { slice[i].frustumCulled = fc[i]; slice[i].layers.disable(WARM); }
        if (chPar) chPar.add(chGrp);
        if (chVis) for (let i = 0; i < chVis.length; i += 2) chVis[i].visible = chVis[i + 1];
      }
    }
    if (ph === 1 && slice.length) return;
    if (S.warmI >= Q.length && S.warmChar) { S.ready = true; S.warmQ = null; S.warmMats = null; }
  }
  /** may this frame's warm-up draws go inside the passes drawn anyway? (outdoors, the world drawn through a one-pass post chain) */
  _deferOK() { const g = this.game, P = g.world && g.world.post; return !NO_WARMPASS && !this.noWarmPass && !this.current && g.scene === g.worldScene && !!g.postRender && !!P && !!P.inPass && P.inPass() && g.running === true; }
  /** after the post chain's composite onto the canvas (world/post.js), the canvas still bound: the canvas halves of this frame's warm-up draws */
  afterComposite(R) {
    if (R.getRenderTarget && R.getRenderTarget() !== null) return;
    const W = this._warmCv;
    if (W) { const S = W.d.sl; if (W.d.scene && S.warmQ && !S.ready) { this._warmStep(W.d, false, 2); this.stats.warmInPass = (this.stats.warmInPass || 0) + 1; } this._warmCv = null; }
    const V = this._wwCv;
    if (V) { this._wwCv = null; const S = V.d.sl; if (S.wwPending && V.d.scene) { const ok = RV.warmWorld(this, V.d, 2) && V.ok; if (ok || ++S.wwTries > 600) { S.wwPending = false; S.impDone = true; } } }
  }
  /** a warm-up draw of `scene` with `cam` into one pixel of the post pass's scene target (nothing where there is none) */
  _warmInTarget(R, scene, cam, off = false) {
    const T = this._postTarget(); if (!T || !R.setRenderTarget) return false;
    const vp = this._wvp || (this._wvp = new THREE.Vector4()), sc = this._wsc || (this._wsc = new THREE.Vector4()), stt = T.scissorTest, prev = R.getRenderTarget();
    vp.copy(T.viewport); sc.copy(T.scissor);
    try { if (off) T.viewport.set(-4, -4, 1, 1); else T.viewport.set(0, 0, 1, 1); T.scissor.set(0, 0, 1, 1); T.scissorTest = true; R.setRenderTarget(T); R.render(scene, cam); }      // (off: a viewport off the picture — the draw is made, no pixel is written)
    finally { T.viewport.copy(vp); T.scissor.copy(sc); T.scissorTest = stt; R.setRenderTarget(prev); }
    return true;
  }
  _addDoor(d, o) {
    const D = makeDoor(o); D.def = d;
    d.scene.add(D.group);
    const cols = o.colliders || d.colliders, blocks = [];
    if (D.kind === 'hinged') {
      // the leaf itself is the obstacle: a wall segment from the hinge to the latch edge that turns with the door (so a
      // door pulled towards you is walked round, not through), indexed over the whole of its swing
      D.leafSegs = [];
      for (const c of cols) { const sgm = { seg: true, x1: o.at[0], z1: o.at[1], x2: o.at[0] + Math.sin(o.dir) * o.w, z2: o.at[1] + Math.cos(o.dir) * o.w, tag: 'door', low: false, on: true, m: 0 }; c._insert(sgm, o.at[0] - o.w - 0.1, o.at[1] - o.w - 0.1, o.at[0] + o.w + 0.1, o.at[1] + o.w + 0.1); c.hasDoors = true; D.leafSegs.push(sgm); }
    } else if (o.block) for (const c of cols) blocks.push(c.addSegment(o.block[0], o.block[1], o.block[2], o.block[3]));
    const P = d.sl && o.portal !== undefined ? d.sl.portals[o.portal] : null;
    if (P) { P.door = D; (P.doors || (P.doors = [])).push(D); D.portalRef = P; P.open = false; for (const q of P.passages) q.on = false; }
    // A hinged leaf on a doorway from the street holds the LOCAL PLAYER in the world too: with the doorway shut the
    // building's wall used to hold a walker at its outer face — 0.6 m from the leaf, the handle beyond the arm — so the
    // recess from the shell face in to the leaf is opened to someone who is at the door (P.reveal: a passage of its own;
    // P.passages — the way THROUGH — stay off while the door is shut) and the leaf itself stops them (_updateSeamless:
    // D.worldSeg, the leaf as it turns, and D.worldBar, the line of the shut leaf, in world coordinates — not shapes of
    // the world's collider, where another module's 'door'-tagged wall may stand in a passage and must stay passable).
    const wc = this.game.worldCollider, S = d.sl;
    if (P && S && !NO_REVEAL && D.kind === 'hinged' && !P.off && P.passages.length && wc && wc.addPassage && Math.abs((P.y || 0) - S.y0) < 0.6) {
      const h = S.toWorld(o.at[0], o.at[1]), t = S.toWorld(o.at[0] + Math.sin(o.dir) * o.w, o.at[1] + Math.cos(o.dir) * o.w);
      D.worldSeg = { x1: h[0], z1: h[1], x2: t[0], z2: t[1], on: false, wide: false };
      // (the shut line 4 cm outside the leaf: a body is held 0.36 m from a leaf — core/_doors.js BODY — and a walker's
      //  radius is 0.32; it stays shut to a body until the door is wide enough to pass, as the wall did: nobody
      //  shoulders through a leaf that has only begun to open, or between a pair of leaves)
      const k = 0.04, bh = S.toWorld(o.at[0] + P.dx * k, o.at[1] + P.dz * k), bt = S.toWorld(o.at[0] + Math.sin(o.dir) * o.w + P.dx * k, o.at[1] + Math.cos(o.dir) * o.w + P.dz * k);
      D.worldBar = { x1: bh[0], z1: bh[1], x2: bt[0], z2: bt[1], on: false };
      if (!P.reveal) { const q = P.passages[0]; P.reveal = wc.addPassage(q.x1, q.z1, q.x2, q.z2, q.r * 2); P.reveal.on = false; }
    }
    // (glazed: the world / the room shows through it even when it is shut)
    D.glazed = o.glazed ?? (D.kind === 'slide' || o.style === 'glass' || !!o.vision);
    D.onPass((open) => { for (const b of blocks) b.on = !open; if (P) P.open = open; });
    D.blocks = blocks;
    D.sync = () => { if (D.leafSegs) { const a = o.dir + D.th, x = o.at[0] + Math.sin(a) * o.w, z = o.at[1] + Math.cos(a) * o.w; const wide = Math.abs(D.th) > 1.2; for (const q of D.leafSegs) { q.x2 = x; q.z2 = z; q.wide = wide; } const ws = D.worldSeg; if (ws) { const w = S.toWorld(x, z, _w2); ws.x2 = w[0]; ws.z2 = w[1]; ws.wide = wide; } } };
    d.doorList.push(D);
    return D;
  }
  /** everyone near a room's doors, in the room's coordinates: the local player, other players, pedestrians */
  _people(d, out) {
    out.length = 0;
    const g = this.game, p = g.player, S = d.sl, here = p.place === d.id;
    const by = S ? S.base() : 0;
    const push = (x, z, vx, vz, world, extra, y) => {
      let e = this._pp[out.length]; if (!e) this._pp.push((e = { x: 0, z: 0, y: null, vx: 0, vz: 0, ix: 0, iz: 0, ch: null, me: false, map: null, shove: null }));
      if (world) { const dx = x - S.wx, dz = z - S.wz; e.x = S.ox + dx * S.c - dz * S.s; e.z = S.oz + dx * S.s + dz * S.c; e.vx = vx * S.c - vz * S.s; e.vz = vx * S.s + vz * S.c; } else { e.x = x; e.z = z; e.vx = vx; e.vz = vz; }
      e.y = y === undefined || y === null || !Number.isFinite(y) ? null : world ? y - by : y;      // feet, room coordinates (null: unknown — every storey's doors answer)
      e.ch = extra ? extra.ch : null; e.me = !!(extra && extra.me); e.map = extra && extra.map || null; e.shove = extra && extra.shove || null;
      // (the local player: the way they are trying to go — pressed against a shut door they have no velocity for it to read)
      if (e.me) { const inp = g.input, go = inp && (inp.moveX || inp.moveY) && !p.vehicle ? 1.2 : 0, h = p.heading - (world ? S.rot : 0); e.ix = Math.sin(h) * go; e.iz = Math.cos(h) * go; } else { e.ix = 0; e.iz = 0; }
      out.push(e);
    };
    if (this._meL) this._meL.ch = p.character; if (S && S.meW) S.meW.ch = p.character;
    if (here) push(p.pos.x, p.pos.z, p.vx || 0, p.vz || 0, false, this._meL || (this._meL = { ch: p.character, me: true, shove: this._shoveL || (this._shoveL = (ax, az) => { _pt.x = p.pos.x + ax; _pt.z = p.pos.z + az; g.collider.resolve(_pt, p.radius || 0.32); const l = Math.hypot(ax, az) || 1, got = ((_pt.x - p.pos.x) * ax + (_pt.z - p.pos.z) * az) / l; p.pos.x = _pt.x; p.pos.z = _pt.z; const vn = (p.vx * ax + p.vz * az) / l; if (vn < 0) { p.vx -= vn * ax / l; p.vz -= vn * az / l; } return got; }) }), p.pos.y);
    else if (S && p.place === 'world' && !p.vehicle && S.md(p.pos.x, p.pos.z) < 90) push(p.pos.x, p.pos.z, p.vx || 0, p.vz || 0, true, S.meW || (S.meW = { ch: p.character, me: true, shove: S.shoveW || (S.shoveW = (ax, az) => { const wx = ax * S.c + az * S.s, wz = -ax * S.s + az * S.c; _pt.x = p.pos.x + wx; _pt.z = p.pos.z + wz; g.collider.resolve(_pt, p.radius || 0.32); const l = Math.hypot(wx, wz) || 1, got = ((_pt.x - p.pos.x) * wx + (_pt.z - p.pos.z) * wz) / l; p.pos.x = _pt.x; p.pos.z = _pt.z; const vn = (p.vx * wx + p.vz * wz) / l; if (vn < 0) { p.vx -= vn * wx / l; p.vz -= vn * wz / l; } return got; }), map: S.mapOut || (S.mapOut = (x, y, z) => { const q = S._mq || (S._mq = [0, 0, 0]), w = S.toWorld(x, z, S._mw || (S._mw = [0, 0])); q[0] = w[0]; q[1] = y + S.base(); q[2] = w[1]; return q; }) }), p.pos.y);
    else if (S && S.linkIds && S.linkIds.has(p.place) && !p.vehicle) this._linkedMe(d, push, out);      // (…or in the room on the other side of one of its room-to-room doorways)
    const N = g.net && g.net.others;
    if (N && N.size) for (const o of N.values()) {
      if (!o.seen) continue;
      const sp = o.speed || 0, vx = Math.sin(o.h || 0) * sp, vz = Math.cos(o.h || 0) * sp;
      if (o.place === d.id) push(o.x, o.z, vx, vz, false, null, o.y); else if (S && o.place === 'world' && S.md(o.x, o.z) < 60) push(o.x, o.z, vx, vz, true, null, o.y);
    }
    const L = g.pedestrians && g.pedestrians.list;
    if (L) for (let i = 0; i < L.length; i++) {
      const q = L[i]; if (!q || q.active === false) continue;
      const sp = q.speed || 0, h = q.heading ?? q.h ?? 0, vx = q.vx ?? Math.sin(h) * sp, vz = q.vz ?? Math.cos(h) * sp;
      if (q.place === d.id) push(q.x, q.z, vx, vz, false, null, q.y); else if (S && (q.place === 'world' || !q.place) && S.md(q.x, q.z) < 60) push(q.x, q.z, vx, vz, true, null, q.y);
    }
    // the friends (places/friends.js: they walk the college on their own graph), in world coordinates
    const FN = S && g.friends && g.friends.npcs;
    if (FN) for (const q of (Array.isArray(FN) ? FN : Object.values(FN))) { if (!q || q.hidden || q.x === undefined || S.md(q.x, q.z) > 60) continue; const sp = q.animSpeed || 0, h = q.h || 0; push(q.x, q.z, Math.sin(h) * sp, Math.cos(h) * sp, true, null, q.y); }
    // people a module moves itself: game.walkers = [() => iterable of { x, z, vx?, vz?, speed?, heading?, hidden?, place? }]
    // (place = a room's id: its coordinates; else world coordinates)
    if (g.walkers) for (const fn of g.walkers) { let it = null; try { it = fn(); } catch { it = null; } if (it) for (const q of it) {
      if (!q || q.hidden) continue;
      const sp = q.speed ?? q.animSpeed ?? 0, h = q.heading ?? q.h ?? 0, vx = q.vx ?? Math.sin(h) * sp, vz = q.vz ?? Math.cos(h) * sp;
      if (q.place === d.id) push(q.x, q.z, vx, vz, false, null, q.y); else if (S && (!q.place || q.place === 'world') && S.md(q.x, q.z) < 60) push(q.x, q.z, vx, vz, true, null, q.y);
    } }
    return out;
  }
  /** is the room-frame point (x, y, z) inside room d: one of its declared bounds boxes, or one of its doorways (out to
   *  `ext` m beyond the shell face: someone on the threshold is already the room's; the camera a little sooner).
   *  null when the room declares no bounds (unknown). */
  _inRoom(d, x, y, z, ext = 0.05) {
    const S = d.sl, B = S.bounds; if (!B) return null;
    for (let i = 0; i < B.length; i++) { const b = B[i]; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= (b.y0 ?? -1e9) - 0.4 && y <= (b.y1 ?? 1e9) + 0.2) return true; }
    for (const P of S.portals) { const rx = x - P.at[0], rz = z - P.at[1], out = rx * P.dx + rz * P.dz; if (out > -0.6 && out < P.depth + ext && Math.abs(rx * P.tx + rz * P.tz) < P.w / 2 - 0.02 && y > P.y - 0.4 && y < P.y + P.h + 0.9) return true; }
    return false;
  }
  /** the circle (world x, z, radius) no rain falls in while the player is in a walk-in room: about the box of the room
   *  they are standing in (systems/weather.js), or null */
  dryZone() {
    const d = this.current, S = d && d.sl, p = this.game.player; if (!S || p.place !== d.id) return null;
    let b = null;
    if (S.bounds) for (const q of S.bounds) if (p.pos.x >= q.x0 - 0.5 && p.pos.x <= q.x1 + 0.5 && p.pos.z >= q.z0 - 0.5 && p.pos.z <= q.z1 + 0.5 && p.pos.y >= (q.y0 ?? -1e9) - 0.5 && p.pos.y <= (q.y1 ?? 1e9)) { b = q; break; }
    const z = this._dry || (this._dry = [0, 0, 0]);
    if (!b && d.box && isFinite(d.box.min.x)) { const w = S.toWorld((d.box.min.x + d.box.max.x) / 2, (d.box.min.z + d.box.max.z) / 2, _w2); z[0] = w[0]; z[1] = w[1]; z[2] = Math.min(40, Math.hypot(d.box.max.x - d.box.min.x, d.box.max.z - d.box.min.z) * 0.5 * 0.9); return z; }
    if (!b) { z[0] = p.worldPos.x; z[1] = p.worldPos.z; z[2] = 3.2; return z; }
    const w = S.toWorld((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, _w2); z[0] = w[0]; z[1] = w[1]; z[2] = Math.hypot(b.x1 - b.x0, b.z1 - b.z0) * 0.5 * 0.92; return z;
  }
  /** the walk-in room (with declared `seamless.bounds`) that the WORLD point is inside, or null */
  roomAt(wx, wy, wz) {
    for (let i = 0; i < this.sl.length; i++) {
      const d = this.sl[i], S = d.sl; if (!S.bounds || S.md(wx, wz) > S.reach) continue;
      const l = S.toLocal(wx, wz, _l3); if (this._inRoom(d, l[0], wy - S.base(), l[1]) === true) return d;
    }
    return null;
  }
  /**
   * Put a character's group at a WORLD position: in the world scene, or — when the point is inside a walk-in room that
   * is built — in that room's scene at its own coordinates (lit by the room, seen through its windows and doors from
   * outside, and by whoever is in it). heading is a world heading. Returns the room's def, or null.
   * For people a module moves itself in world coordinates (the friends, a house's students): call it every frame they move.
   */
  place(group, wx, wy, wz, heading) {
    const d = this.roomAt(wx, wy, wz);
    if (d && d.built && d.scene) {
      const S = d.sl, l = S.toLocal(wx, wz, _l3);
      if (group.parent !== d.scene) d.scene.add(group);
      group.position.set(l[0], wy - S.base(), l[1]); if (heading !== undefined) group.rotation.y = heading - S.rot;
      return d;
    }
    const ws = this.game.worldScene;
    if (group.parent !== ws) ws.add(group);
    group.position.set(wx, wy, wz); if (heading !== undefined) group.rotation.y = heading;
    return null;
  }
  /**
   * The follow camera's ray (from the player to where the camera wants to be, in the coordinates of the place the player
   * is in) against the walls of the OTHER side of a doorway: the world's when the player is in a walk-in room, the
   * room's when the player is outside one with the camera still inside it. -> nearest t in 0..1, or null.
   */
  camRay(x1, z1, x2, z2) {
    const g = this.game, p = g.player, cur = this.current, o = this._rayO || (this._rayO = { passages: true });
    if (cur && cur.sl && p.place === cur.id) { const S = cur.sl, a = S.toWorld(x1, z1, _w2), b = S.toWorld(x2, z2, _l3); return g.worldCollider.raycast(a[0], a[1], b[0], b[1], o); }
    let best = null;
    if (p.place === 'world') for (let i = 0; i < this.sl.length; i++) {
      const d = this.sl[i], S = d.sl; if (!S.shown || !S.camCol) continue;
      const a = S.toLocal(x1, z1, _w2), b = S.toLocal(x2, z2, _l3), t = S.camCol.raycast(a[0], a[1], b[0], b[1], o);
      if (t !== null && (best === null || t < best)) best = t;
    }
    return best;
  }
  /**
   * The highest the follow camera may be at (x, z) (coordinates of the place the player is in; y its wanted height), or
   * null: under the lintel while it passes through a doorway (rising again with distance from the wall, so nothing
   * steps), and — the player outside, the camera still in the room behind them — under that room's ceiling.
   */
  camCeil(x, y, z) {
    const g = this.game, p = g.player, cur = this.current && this.current.sl && p.place === this.current.id ? this.current : null;
    let lim = null;
    const one = (d, lx, ly, lz, off) => {
      const S = d.sl;
      for (const P of S.portals) {
        const rx = lx - P.at[0], rz = lz - P.at[1], out = rx * P.dx + rz * P.dz; if (Math.abs(rx * P.tx + rz * P.tz) > P.w / 2 + 0.6 || out < -4 || out > P.depth + 4) continue;
        const away = out < -0.35 ? -0.35 - out : out > P.depth + 0.35 ? out - P.depth - 0.35 : 0, h = P.y + P.h - 0.14 + away * 0.9 + off;
        if (lim === null || h < lim) lim = h;
      }
      if (!cur && S.bounds) for (const b of S.bounds) if (b.y1 !== undefined && lx >= b.x0 && lx <= b.x1 && lz >= b.z0 && lz <= b.z1 && ly >= (b.y0 ?? -1e9) - 0.4 && ly <= b.y1 + 1.6) { const h = b.y1 - 0.14 + off; if (lim === null || h < lim) lim = h; }
    };
    if (cur) one(cur, x, y, z, 0);
    else if (p.place === 'world') for (let i = 0; i < this.sl.length; i++) {
      const d = this.sl[i], S = d.sl; if (!S.shown || S.md(x, z) > S.reach + 6) continue;
      const l = S.toLocal(x, z, _l3), by = S.base(); one(d, l[0], y - by, l[1], by);
    }
    return lim;
  }
  /** true while an open doorway of a shown walk-in room is within r metres of the local player (the follow camera lets its rays through doorways then) */
  get portalNear() { return this._portalNear > 0; }
  /** local player through a portal: into room d (dir > 0) or out to the world (dir < 0); same frame, no fade */
  _cross(d, dir, via) {
    // (via: the room on the other side of a room-to-room doorway being left by, else the world)
    const g = this.game, p = g.player, ox = p.pos.x, oz = p.pos.z;
    const from = this.current && this.current.sl && p.place === this.current.id ? this.current : null, to = dir > 0 ? d : via || null;
    let rot = 0;
    if (from) {      // out of the room being left: the player in world coordinates
      from.onExit && from.onExit();
      const F = from.sl, w = F.toWorld(p.pos.x, p.pos.z), vx = p.vx, vz = p.vz;
      p.pos.set(w[0], p.pos.y + F.base(), w[1]); p.heading += F.rot; g.cameraYaw += F.rot; p.vx = vx * F.c + vz * F.s; p.vz = -vx * F.s + vz * F.c; rot += F.rot;
    }
    g._blendT = 0;
    if (to) {
      const T = to.sl, by = T.base(), l = T.toLocal(p.pos.x, p.pos.z), y = p.pos.y - by, vx = p.vx, vz = p.vz;
      this.current = to; to._via = null;
      p.pos.set(l[0], y, l[1]); p.heading -= T.rot; g.cameraYaw -= T.rot; p.vx = vx * T.c - vz * T.s; p.vz = vx * T.s + vz * T.c; rot -= T.rot;
      g.setPlace(to.id, to.scene, to.pickCollider ? to.pickCollider(p) || to.collider : to.collider, to.ground);
      T.toWorld(p.pos.x, p.pos.z, _w2); p.worldPos.set(_w2[0], p.pos.y + by, _w2[1]);
    } else { this.current = null; g.setPlace('world', g.worldScene, g.worldCollider, null); }
    try { p.character.carried && p.character.carried(ox, oz, p.pos.x, p.pos.z, rot); } catch { /* */ }
    p.syncMesh();
    if (to) { to.onEnter && to.onEnter(); try { g.ui.area(to.name); } catch { /* headless */ } }
    this.stats.crossings++;
  }
  /** keep the player (a circle, in world coordinates) off the segment s: out along the shortest way, no speed left into it */
  _pushOff(p, s) {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1; let t = ((p.pos.x - s.x1) * dx + (p.pos.z - s.z1) * dz) / (dx * dx + dz * dz || 1); t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ox = p.pos.x - (s.x1 + dx * t), oz = p.pos.z - (s.z1 + dz * t), d = Math.hypot(ox, oz), r = p.radius || 0.32; if (d >= r || d < 1e-5) return;
    const k = (r - d) / d; p.pos.x += ox * k; p.pos.z += oz * k;
    const vn = ((p.vx || 0) * ox + (p.vz || 0) * oz) / d; if (vn < 0) { p.vx -= vn * ox / d; p.vz -= vn * oz / d; }
  }
  _updateSeamless(dt) {
    const g = this.game, p = g.player, cur = this.current;
    const inS = cur && cur.sl ? cur : null;
    // the player's true world position (worldPos) while in a walk-in room
    if (inS) { const S = inS.sl; S.toWorld(p.pos.x, p.pos.z, _w2); p.worldPos.set(_w2[0], p.pos.y + S.base(), _w2[1]); }
    // the walls the follow camera's rays are tried against from OUTSIDE this room (camRay): those of the storey the
    // player is on in it, kept while they are in it — however they came to be in it. (It was set only on walking in
    // through a doorway: the room the game starts in, or one entered by a hook, had none, and on the way out of it the
    // camera went through its walls into the building.)
    if (inS && p.place === inS.id && g.collider && g.collider !== g.worldCollider) inS.sl.camCol = g.collider;
    const wx = p.place === 'world' ? p.pos.x : p.worldPos.x, wz = p.place === 'world' ? p.pos.z : p.worldPos.z;
    this._tickN = (this._tickN || 0) + 1;
    let built = false, warmed = false, cubed = false, shownAny = false, resident = 0, far = null, farD = 0, residentL = 0, farL = null, farLD = 0; this._portalNear = 0;
    const keep = !NO_KEEP && !this.noKeep && !!g.quality && g.quality.level === 'ultra'; let keptMB = 0, keptFar = null, keptFarD = 0;      // (KEEP_MB)
    // (warm-up draws left for the frame's own passes that no frame took — nothing was drawn, a test stepping the game:
    //  the first half is taken now the old way, a half-done step is taken again)
    if (this._warmCv) { const W = this._warmCv, S2 = W.d.sl; this._warmCv = null; if (S2.warmQ) { S2.warmI = Math.min(S2.warmI, W.i0); S2.warmChar = W.char0; if (W.newMats && S2.warmMats) for (const m of W.newMats) S2.warmMats.delete(m); } }
    this._wwCv = null;
    if (this._warmPend) { const q = this._warmPend; this._warmPend = null; if (q.built && q.scene && q.sl.gpu && !q.sl.ready && q.sl.compiled && q !== cur) { this._warmStep(q, false); warmed = true; } }
    if (this.lazy && (this._tickN & 3) === 0) this._lazyTick(wx, wz);
    this._soft = !(this._stencil ?? (this._stencil = this._hasStencil())) || (!!g.postRender && !g.postRender.stencil);      // (stencil path on the screen and in the post pass's own target, world/post.js; the one-pass version only where there is no stencil buffer)
    const cap = RESIDENT[(g.quality && g.quality.level) || 'medium'] || 12, capL = this.lightCap || RESIDENT_LIGHT[(g.quality && g.quality.level) || 'medium'] || 16;
    for (const d of this.sl) {
      const S = d.sl; let dist = Math.hypot(wx - S.cx, wz - S.cz);
      if (S.centersW) for (const c of S.centersW) { const q = Math.hypot(wx - c[0], wz - c[1]); if (q < dist) dist = q; }
      const showR = S.showR || SHOW_R, buildR = showR + (S.light ? 14 : BUILD_R - SHOW_R);
      const linked = !!cur && cur !== d && !!S.linkIds && S.linkIds.has(cur.id) && p.place === cur.id;      // (the player is in a room this one opens off, or that opens off this one)
      // first draws, one room a frame (the room you are standing in: all of it now — it is being drawn anyway); then its
      // impostor's cube maps, a face a frame (and again every so often while it is shown: its lights follow the hour)
      if (d.built && !S.ready && S.compiled && d.scene) {
        if (d === cur) { S.gpu = true; this._warmStep(d, true); }
        else if (!warmed && (dist < buildR + 20 || linked)) {
          // (no more rooms on the graphics card than the tier's cap: a farther one that is not shown makes way, else this one waits)
          let ok = S.gpu || (S.light ? (this._resL || 0) < capL : (this._resN || 0) < cap);
          const fr = S.light ? this._resFarL : this._resFar, frD = S.light ? this._resFarLD : this._resFarD;
          // (light rooms: the farthest of them makes way even while it is shown — on a street of shops every one in range
          //  is shown, and the shop the player is standing at must not be the one left out)
          if (!ok && fr && frD > dist + 10 && fr.sl.gpu && (S.light || !fr.sl.shown)) { this._freeGpu(fr); if (S.light) this._resFarL = null; else this._resFar = null; ok = true; }
          if (ok) { S.gpu = true; warmed = true; if (this._deferOK()) this._warmPend = d; else this._warmStep(d, false); }
        }
      }
      else if (d.built && S.ready && S.impOK && d !== cur && !cubed && (!S.impDone || S.impBusy) && dist < buildR + 20) { cubed = true; RV.impStep(this, d); if (S.light) for (let k = 0; k < 2 && (!S.impDone || S.impBusy) && !S.wwPending && !S.impTries; k++) RV.impStep(this, d); }
      if (!d.built && (dist < buildR || linked) && !built && (g.frame > 30 || dist < 25)) { built = true; try { this._buildStep(d); } catch (e) { console.warn('[interiors] build', d.id, e); d.built = true; d._bs = null; d.sl.ready = false; } }
      if (S.punchPending && g.world && g.world.groundHeight) { S.punchPending = false; RV.placeWorldMeshes(S); }
      // (a room first APPEARS once its far pictures are taken — S.impDone — so that it never arrives in pieces. One that
      //  is already shown without them stays shown, and is drawn itself meanwhile — core/_roomview.js classify: no
      //  picture, the room. Pictures are only taken of a room the player is not in, so the room the game starts in — or
      //  one entered by a hook — has none on the first walk out of it, and it used to be switched off the frame after
      //  the threshold was crossed: nothing of it drawn with the camera still inside it — the outdoors seen through the
      //  back of the building's walls — and its doorway shut again in the world's wall on the player standing in it,
      //  who was shoved back inside the building, until the pictures were done: seconds, behind the other rooms' own.)
      const show = d.built && S.ready && !!d.scene && !S.punchPending && (d === cur || linked || (!this.hideRooms && (S.impDone || !S.impOK || S.shown) && dist < (S.shown ? showR + (HIDE_R - SHOW_R) : showR)));      // (hideRooms: a measuring switch, tools/probe_walkin.mjs)
      if (show !== S.shown) { S.shown = show; if (show) S.softKey = null; else RV.hideView(this, d); }
      if (show) shownAny = true;
      for (const P of S.portals) { const on = show && P.open && !(p.vehicle && p.place === 'world'); for (const q of P.passages) q.on = on; if (P.reveal) {
        // (the world's collider is flat: a leaf is only in it while the player is on the door's own level — a doorway a
        //  storey above a basement's way in, the Union's over the Purple Turtle's steps, must not bar the way below it)
        // …and the recess is opened by someone who is AT the door — walking at it, its latch asked for (core/_doors.js),
        // or the leaf moving — and stays open while they stand in it. A door that is locked, or that somebody only
        // brushes past along the wall (or passes in another doorway's passage: the Purple Turtle's steps run by the
        // Union's door), is the wall it always was.
        const lvl = show && Math.abs((p.place === 'world' ? p.pos.y : p.worldPos.y) - (S.base() + P.y)) < 1.4;
        let lv = false;
        if (lvl) {
          let eng = false; for (const D of P.doors) if (!D.locked && (D._meT > 0 || D.th !== 0 || D.target !== 0)) eng = true;
          const q = P.reveal, ex = q.x2 - q.x1, ez = q.z2 - q.z1, t = Math.max(0, Math.min(1, ((wx - q.x1) * ex + (wz - q.z1) * ez) / (ex * ex + ez * ez || 1))), near = Math.hypot(wx - q.x1 - ex * t, wz - q.z1 - ez * t) < q.r;
          lv = eng || (q.on && near);
        }
        P.reveal.on = lv && !(p.vehicle && p.place === 'world'); for (const D of P.doors) if (D.worldSeg) { D.worldSeg.on = lv; D.worldBar.on = lv && !P.open; if (lv && p.place === 'world' && !p.vehicle) { if (D.worldBar.on) this._pushOff(p, D.worldBar); if (!D.worldSeg.wide) this._pushOff(p, D.worldSeg); } } } }      // (on foot only: a doorway is not a way in for a bike)
      if (d.built && S.gpu) { if (S.light) { residentL++; if (d !== cur && dist > farLD && !(show && d.visitors && d.visitors() > 0)) { farLD = dist; farL = d; } }   /* (def.visitors(): street walkers on their way in or out by its door — a shown room is not taken away under them) */ else { resident++; if (!show && d !== cur && dist > farD) { farD = dist; far = d; } } }
      if (S.gpu && S.atlas) keptMB += S.atlas.width * S.atlas.height * 5.34e-6;      // (RGBA8 with its mipmaps, MB)
      if (!show) {
        if (d.built && S.gpu && d !== cur && dist > buildR + (S.light ? 22 : 45)) { if (!keep) this._freeGpu(d); else if (dist > keptFarD) { keptFarD = dist; keptFar = d; } }
        // (a kept room coming back into range: its pictures are of the hour it was last seen at)
        // …so they are taken again, in place, before it is shown — if the light has changed since: dusk or dawn has moved on, or half an hour has passed)
        if (keep && S.gpu && d !== cur) {
          const nt = (g.world && g.world.night) || 0, hr = g.time && g.time.hour !== undefined ? g.time.hour : 12;
          if (!S.hidT) { S.hidNight = nt; S.hidHour = hr; }
          S.hidT = (S.hidT || 0) + dt;
          if (S.hidT > IMP_REFRESH && dist < buildR + 20 && S.impOK && S.impDone && !S.impBusy && S.ready) {
            const dh = Math.abs(hr - S.hidHour);
            if (Math.abs(nt - S.hidNight) > 0.02 || Math.min(dh, 24 - dh) > 0.5) { S.impBusy = true; S.impFace = 0; S.hidT = 0; this.stats.keptRefresh = (this.stats.keptRefresh || 0) + 1; }
          }
        }
        continue;
      }
      S.hidT = 0;
      if (S.impOK && S.impDone && d !== cur && !S.impBusy) { S.impAge += dt; if (S.impAge > IMP_REFRESH && S.impSeen) { S.impBusy = true; S.impSeen = false; } }
      for (const P of S.portals) if (P.open) { const w = S.toWorld(P.at[0], P.at[1], _w2); if (Math.abs(w[0] - wx) + Math.abs(w[1] - wz) < 9) this._portalNear++; }
      // doors, by where people are
      // (a room whose doors are all at rest with the player not near any of them: looked at every sixth frame — it is
      //  other people who would be opening them, and a tenth of a second late is nothing)
      if (d.doorList.length) S.doorDt = (S.doorDt || 0) + dt;
      if (d.doorList.length && !(S.doorIdle && d !== cur && (this._tickN + S.doorPhase) % 6)) {
        const ddt = Math.min(0.1, S.doorDt);
        const people = this._people(d, this._ppl), a = g.audio, sw = S.toWorld(d.doorList[0].pos[0], d.doorList[0].pos[1], _w2);
        const envD = this._envD; envD.audio = a; envD.useKey = false;
        let busy = false;
        for (const D of d.doorList) {
          S.toWorld(D.pos[0], D.pos[1], sw); const dd = Math.hypot(sw[0] - wx, sw[1] - wz);
          if (dd > 32 && D.th === 0 && !D.slide && D.target === 0) continue;
          envD.gain = Math.max(0, 1 - dd / 12);
          D.update(ddt, people, envD); D.sync();
          if (dd < 9 || D.th !== 0 || D.slide || D.target !== 0 || D.want > 0) busy = true;
        }
        // (somebody else within a few steps of one of its doors: every frame from now)
        if (!busy) for (let i = 0; i < people.length && !busy; i++) { const q = people[i]; for (const D of d.doorList) if (Math.abs(q.x - D.pos[0]) + Math.abs(q.z - D.pos[1]) < 5) { busy = true; break; } }
        S.doorIdle = !busy; S.doorDt = 0;
      }
      RV.syncProxies(S);
      // every third of a second: who is in the room (drawn for real in its impostor: core/_roomview.js PIMP), and whether
      // its lights have changed (lamps on at dusk, a room lit for a dinner): its pictures are then taken again
      if ((this._tickN + S.doorPhase) % 20 === 0 && d.scene) {
        const L = S.people || (S.people = []); L.length = 0;
        for (const o of d.scene.children) if (o.name === 'character') L.push(o);      // (which of them are drawn is settled each frame: afterWorld)
        S.peopleN = L.length;
        if (!S.lights || (this._tickN + S.doorPhase) % 400 === 0) { const A = S.lights || (S.lights = []); A.length = 0; d.scene.traverse((o) => { if (o.isLight) A.push(o); }); }
        let sig = 0; for (const o of S.lights) if (o.visible) sig += o.intensity * (o.isAmbientLight || o.isHemisphereLight ? 3 : 1);
        if (S.proxies) for (const e of S.proxies) if (e.src.visible) sig += 0.37;
        if (S.sig === undefined) S.sig = sig;
        else if (Math.abs(sig - S.sig) > 0.03 * Math.max(1, S.sig) && S.impDone && !S.impBusy && d !== cur) { S.sig = sig; this.refreshView(d.id); }
      }
      if (d !== cur && d.updateShown) { try { d.updateShown(dt); } catch (e) { if (!d._usErr) console.warn('[interiors] updateShown', d.id, e); d._usErr = true; } }
      // crossing in
      if (!cur && p.place === 'world' && !p.vehicle && !p.swim) {
        const l = S.toLocal(p.pos.x, p.pos.z, _l2), ly = p.pos.y - S.base();
        for (const P of S.portals) {
          if (!P.open) continue;
          const rx = l[0] - P.at[0], rz = l[1] - P.at[1], inn = -(rx * P.dx + rz * P.dz), lat = rx * P.tx + rz * P.tz;
          if (inn > P.cin && inn < 1.6 && Math.abs(lat) < P.w / 2 + 0.05 && Math.abs(ly - P.y) < 1.4) { this._cross(d, 1); return; }      // (on foot, at the door's own level)
        }
      } else if (linked) {      // …or from the room this one opens off
        const w = p.worldPos, l = S.toLocal(w.x, w.z, _l2), ly = w.y - S.base();
        for (const P of S.portals) {
          if (!P.open || P.off !== cur.id) continue;
          const rx = l[0] - P.at[0], rz = l[1] - P.at[1], inn = -(rx * P.dx + rz * P.dz), lat = rx * P.tx + rz * P.tz;
          if (inn > P.cin && inn < 1.6 && Math.abs(lat) < P.w / 2 + 0.05 && Math.abs(ly - P.y) < 1.4) { this._cross(d, 1); return; }
        }
      }
    }
    this._shownAny = shownAny;
    if (keep) { this.stats.keptMB = Math.round(keptMB); if (keptMB > KEEP_MB && keptFar) this._freeGpu(keptFar); }
    this._resN = resident; this._resFar = far; this._resFarD = farD; this._resL = residentL; this._resFarL = farL; this._resFarLD = farLD;
    // crossing out
    if (inS && p.place === inS.id) {
      const S = inS.sl;
      for (const P of S.portals) {
        const rx = p.pos.x - P.at[0], rz = p.pos.z - P.at[1], out = rx * P.dx + rz * P.dz, lat = rx * P.tx + rz * P.tz;
        if (out > P.cout && out < 2.5 && Math.abs(lat) < P.w / 2 + 0.3 && Math.abs(p.pos.y - P.y) < 1.4) { this._cross(inS, -1, P.fromDef || null); return; }
      }
    }
  }
  /** doors of a room that is not walk-in (or all rooms when seamless is off): only while you are in it */
  _updateDoorsLegacy(dt) {
    const d = this.current; if (!d || d.sl || !d.doorList.length) return;
    const people = this._people(d, this._ppl), envD = this._envD; envD.audio = this.game.audio; envD.useKey = false; envD.gain = 1;
    for (const D of d.doorList) { D.update(dt, people, envD); D.sync(); }
  }

  // ---------------------------------------------------------------- render
  /**
   * What of room d's openings is on screen for camera cam (in the room's frame) -> this._rect (NDC bounds; .full = a
   * window or an open / glazed doorway is among them, not only shut solid doors), or null.
   * front: the camera is outside (openings that face it); else inside (openings it could be seen from: `from`; nothing of
   * the world shows through a shut solid door).
   * Each opening is the box through the wall (its hole on the room's wall face out to the shell's face), clipped against
   * the eye plane: a window beside or behind the eye no longer counts as the whole screen.
   */
  _openingsOn(d, cam, front = false) {
    const S = d.sl, r = this._rect; let x0 = 1, y0 = 1, x1 = -1, y1 = -1, any = false, full = false;
    this._proj(cam);
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    const test = (o, w, ya, yb, door) => {
      const rx = cx - o.at[0], rz = cz - o.at[1], side = rx * o.dx + rz * o.dz;
      if (rx * rx + rz * rz > 3600) return;
      const shut = !!door && !door.glazed && door.open < 0.004;
      let ext = 0;
      if (front) {
        if (side < 0.02) return;                                   // seen from outside: only openings that face the eye
        if (door && door.kind === 'hinged' && !shut) ext = door.o.w;      // (a leaf that swings outwards)
      } else {
        if (shut || o.opaque) return;      // (opaque: true — an opening with nothing of the world to see through it)
        if (o.from && (cx < o.from.x0 || cx > o.from.x1 || cz < o.from.z0 || cz > o.from.z1 || cy < (o.from.y0 ?? -1e9) || cy > (o.from.y1 ?? 1e9))) return;
      }
      if (!this._boxRect(o, w, ya, yb, ext)) return;
      const b = this._b; any = true; if (!shut) full = true;
      if (b[0] < x0) x0 = b[0]; if (b[1] < y0) y0 = b[1]; if (b[2] > x1) x1 = b[2]; if (b[3] > y1) y1 = b[3];
    };
    for (const o of S.openings) test(o, o.w, o.y0, o.y1, null);
    for (const P of S.portals) if (!P.off) test(P, P.w + 0.2, P.y, P.y + P.h + 0.1, P.door || null);
    if (!any) return null;
    r.x0 = Math.max(-1, x0); r.y0 = Math.max(-1, y0); r.x1 = Math.min(1, x1); r.y1 = Math.min(1, y1); r.full = full; return r;
  }
  /** set the projection the next _boxRect calls use: camera cam (in the room's coordinates) */
  _proj(cam) { _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); const e = _m.elements, P = this._pe; for (let i = 0; i < 16; i++) P[i] = e[i]; }
  /** the screen bounds (NDC, in this._b) of the box through the wall at opening o (its hole of width w, ya..yb, on the
   *  room's wall face, out to the shell's face + ext), cut at the eye plane; false when none of it is in view */
  _boxRect(o, w, ya, yb, ext) {
    const e = this._pe, C = _clip, EPS = 0.02;
    const ax = o.at[0] - o.tx * w / 2, az = o.at[1] - o.tz * w / 2, bx = o.at[0] + o.tx * w / 2, bz = o.at[1] + o.tz * w / 2;
    const k = (o.depth || 0) + 0.05 + ext, ox = o.dx * k, oz = o.dz * k;
    let inF = 0;
    for (let i = 0; i < 8; i++) {
      const X = (i & 1 ? bx : ax) + (i & 4 ? ox : 0), Y = i & 2 ? yb : ya, Z = (i & 1 ? bz : az) + (i & 4 ? oz : 0);
      C[i * 3] = e[0] * X + e[4] * Y + e[8] * Z + e[12]; C[i * 3 + 1] = e[1] * X + e[5] * Y + e[9] * Z + e[13]; const W = (C[i * 3 + 2] = e[3] * X + e[7] * Y + e[11] * Z + e[15]);
      if (W > EPS) inF++;
    }
    if (!inF) return false;
    let mx0 = 1e9, my0 = 1e9, mx1 = -1e9, my1 = -1e9, nx, ny;
    if (inF === 8) for (let i = 0; i < 8; i++) { nx = C[i * 3] / C[i * 3 + 2]; ny = C[i * 3 + 1] / C[i * 3 + 2]; if (nx < mx0) mx0 = nx; if (nx > mx1) mx1 = nx; if (ny < my0) my0 = ny; if (ny > my1) my1 = ny; }
    else for (let i = 0; i < 8; i++) for (let b = 1; b < 8; b <<= 1) {      // the 12 edges, each cut at the eye plane
      if (i & b) continue; const j = i | b, Wa = C[i * 3 + 2], Wb = C[j * 3 + 2];
      if (Wa <= EPS && Wb <= EPS) continue;
      if (Wa > EPS) { nx = C[i * 3] / Wa; ny = C[i * 3 + 1] / Wa; if (nx < mx0) mx0 = nx; if (nx > mx1) mx1 = nx; if (ny < my0) my0 = ny; if (ny > my1) my1 = ny; }
      if (Wb > EPS) { nx = C[j * 3] / Wb; ny = C[j * 3 + 1] / Wb; if (nx < mx0) mx0 = nx; if (nx > mx1) mx1 = nx; if (ny < my0) my0 = ny; if (ny > my1) my1 = ny; }
      if ((Wa > EPS) !== (Wb > EPS)) { const t = (EPS - Wa) / (Wb - Wa); nx = (C[i * 3] + (C[j * 3] - C[i * 3]) * t) / EPS; ny = (C[i * 3 + 1] + (C[j * 3 + 1] - C[i * 3 + 1]) * t) / EPS; if (nx < mx0) mx0 = nx; if (nx > mx1) mx1 = nx; if (ny < my0) my0 = ny; if (ny > my1) my1 = ny; }
    }
    if (mx1 < -1 || mx0 > 1 || my1 < -1 || my0 > 1) return false;
    const B = this._b; B[0] = mx0; B[1] = my0; B[2] = mx1; B[3] = my1; return true;
  }
  _xformCam(src, dst, mat) {
    dst.projectionMatrix.copy(src.projectionMatrix); dst.projectionMatrixInverse.copy(src.projectionMatrixInverse);
    dst.near = src.near; dst.far = src.far; dst.fov = src.fov; dst.aspect = src.aspect; dst.zoom = src.zoom;
    src.updateMatrixWorld(); _m2.multiplyMatrices(mat, src.matrixWorld); _m2.decompose(dst.position, dst.quaternion, dst.scale); dst.updateMatrixWorld(true);
    return dst;
  }
  /**
   * Narrow camera `cam` (a scratch camera of this file's) and the viewport to the part of the screen `rect` (NDC, + pad
   * pixels): the same picture over those pixels from a frustum that is only as wide as they are — so three's own culling
   * drops everything that is not behind that window / doorway. Returns 1 (narrowed: call _cropEnd after the render),
   * 0 (left as it was: nearly the whole screen, or a renderer that cannot) or -1 (nothing to draw).
   */
  _cropBegin(R, cam, rect, pad) {
    if (this.noCrop || !R.getDrawingBufferSize || !R.getViewport || !R.setViewport || !R.setScissor || !R.getPixelRatio) return 0;
    const rt = R.getRenderTarget ? R.getRenderTarget() : null;
    let W, H, pr = 1;
    if (rt) { W = rt.width; H = rt.height; } else { const sz = R.getDrawingBufferSize(this._size); W = sz.x; H = sz.y; pr = R.getPixelRatio() || 1; }
    if (!(W > 0 && H > 0)) return 0;
    const X0 = Math.max(0, Math.floor((rect.x0 * 0.5 + 0.5) * W) - pad), X1 = Math.min(W, Math.ceil((rect.x1 * 0.5 + 0.5) * W) + pad);
    const Y0 = Math.max(0, Math.floor((rect.y0 * 0.5 + 0.5) * H) - pad), Y1 = Math.min(H, Math.ceil((rect.y1 * 0.5 + 0.5) * H) + pad);
    if (X1 - X0 < 1 || Y1 - Y0 < 1) return -1;
    if ((X1 - X0) * (Y1 - Y0) > 0.85 * W * H) return 0;
    // (whole device pixels, so the narrowed picture lands on exactly the pixels the whole one would have)
    const nx0 = 2 * X0 / W - 1, nx1 = 2 * X1 / W - 1, ny0 = 2 * Y0 / H - 1, ny1 = 2 * Y1 / H - 1, sx = 2 / (nx1 - nx0), sy = 2 / (ny1 - ny0);
    this._crop.set(sx, 0, 0, -(nx1 + nx0) / (nx1 - nx0), 0, sy, 0, -(ny1 + ny0) / (ny1 - ny0), 0, 0, 1, 0, 0, 0, 0, 1);
    cam.projectionMatrix.premultiply(this._crop); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    if (rt) {      // (a target carries its own viewport and scissor: set there, and bound again so they take)
      this._vp.copy(rt.viewport); this._sc.copy(rt.scissor); this._rst = rt.scissorTest; this._cropRT = rt;
      rt.viewport.set(X0, Y0, X1 - X0, Y1 - Y0); rt.scissor.set(X0, Y0, X1 - X0, Y1 - Y0); rt.scissorTest = true; R.setRenderTarget(rt);
      return 1;
    }
    this._cropRT = null;
    R.getViewport(this._vp); if (R.getScissor) R.getScissor(this._sc);
    const k = 0.01;
    R.setViewport((X0 + k) / pr, (Y0 + k) / pr, (X1 - X0 + k) / pr, (Y1 - Y0 + k) / pr); R.setScissor((X0 + k) / pr, (Y0 + k) / pr, (X1 - X0 + k) / pr, (Y1 - Y0 + k) / pr); R.setScissorTest(true);
    return 1;
  }
  _cropEnd(R) {
    const rt = this._cropRT;
    if (rt) { rt.viewport.copy(this._vp); rt.scissor.copy(this._sc); rt.scissorTest = this._rst; this._cropRT = null; R.setRenderTarget(rt); return; }
    R.setViewport(this._vp); if (R.getScissor) R.setScissor(this._sc); R.setScissorTest(false);
  }
  /** a scratch copy of camera src (same pose and lens), for a narrowed pass */
  _copyCam(src, dst) {
    dst.projectionMatrix.copy(src.projectionMatrix); dst.projectionMatrixInverse.copy(src.projectionMatrixInverse);
    dst.near = src.near; dst.far = src.far; dst.fov = src.fov; dst.aspect = src.aspect; dst.zoom = src.zoom; dst.layers.mask = src.layers.mask;
    src.updateMatrixWorld(); dst.position.copy(src.position); dst.quaternion.copy(src.quaternion); dst.scale.copy(src.scale); dst.updateMatrixWorld(true);
    return dst;
  }
  /**
   * Draw the frame when the CAMERA is inside a walk-in room, or the player is (returns true); else return false and let
   * the game draw the world as usual — it then calls afterWorld() (plain path) or world/post.js does (post path) to add
   * the rooms near by. `cam` is the game's camera, in the coordinates of the place the player is in.
   *   camera inside room D: the world through D's openings that are on screen (narrowed to them), depth cleared, D over
   *     it. The player may be in D, or just outside its door with the camera still following through the doorway.
   *   camera outside, player inside: the world as from outdoors, then the rooms through their openings (afterWorld) —
   *     the player is seen through the doorway they have just walked in by.
   */
  renderFrame(R, cam, drawWorld) {
    const g = this.game, cur = this.current && this.current.sl && g.scene === this.current.scene ? this.current : null;
    if (!g.worldScene || (!cur && !this._shownAny)) return false;
    cam.updateMatrixWorld();
    let camW = cam;
    if (cur) camW = this._xformCam(cam, this.camW || (this.camW = new THREE.PerspectiveCamera()), cur.sl.matrix(_m));
    // which room is the camera in?
    let din = null, camL = null;
    let curIn = cur ? this._inRoom(cur, cam.position.x, cam.position.y, cam.position.z, 0.22) : false;
    if (cur && curIn === null) {      // (no bounds declared: inside unless the camera is out through a doorway)
      curIn = true;
      for (const P of cur.sl.portals) { const rx = cam.position.x - P.at[0], rz = cam.position.z - P.at[1]; if (rx * P.dx + rz * P.dz > P.depth * 0.5 && Math.abs(rx * P.tx + rz * P.tz) < P.w / 2 + 2.5 && cam.position.y > P.y - 0.5 && cam.position.y < P.y + P.h + 1.2) curIn = false; }
    }
    if (curIn) { din = cur; camL = cam; }
    else for (let i = 0; i < this.sl.length && !din; i++) {
      const d = this.sl[i], S = d.sl; if (!S.shown || !d.scene || d === cur) continue;
      const wx = camW.position.x, wz = camW.position.z; if (S.md(wx, wz) > S.reach) continue;
      const l = S.toLocal(wx, wz, _l3); if (this._inRoom(d, l[0], camW.position.y - S.base(), l[1], 0.22) === true) { din = d; camL = this._xformCam(camW, this.camL || (this.camL = new THREE.PerspectiveCamera()), _m.copy(S.matrix(_m)).invert()); }
    }
    // how each shown room is seen this frame (core/_roomview.js): the room itself through the openings near by, its
    // impostor through the rest; from inside a room, or from a vehicle, impostors only
    { const only = !!din || !!g.player.vehicle, wx = camW.position.x, wz = camW.position.z;
      for (let i = 0; i < this.sl.length; i++) {
        const d = this.sl[i], S = d.sl; if (!S.shown || !d.scene || !S.mwi) continue;
        if (d === din) { RV.classify(this, d, camL, 2); continue; }
        if (S.md(wx, wz) > S.reach + 2 * RV.FAR1) { if (!S.away) { S.away = true; RV.hideView(this, d); } continue; }
        S.away = false;
        RV.classify(this, d, this._xformCam(camW, this.camO || (this.camO = new THREE.PerspectiveCamera()), S.mwi), only ? 1 : 0);
      } }
    if (!din && !cur) return false;
    const was = g.scene, ex = R.toneMappingExposure;
    R.setRenderTarget && R.setRenderTarget(null);
    if (!din) {      // the player is in a room, the camera is still outdoors
      g.scene = g.worldScene; this._inWorldPass = true; this._camOut = true;
      try { drawWorld(camW); } finally { g.scene = was; this._inWorldPass = false; this._camOut = false; }
      this.stats.worldPass++;
      return true;
    }
    const d = din, rect = this._openingsOn(d, camL, false);
    const cc = this._cc || (this._cc = new THREE.Color()), ca = R.getClearAlpha ? R.getClearAlpha() : 1; if (R.getClearColor) R.getClearColor(cc);
    // (world/_surf_present.js, top tier: the room's whole frame — the world through its openings, the rooms beyond its
    //  doorways, the room — is drawn into the presenter's target and put on the screen by its one sharpening pass; PT is
    //  that target, null = straight to the screen as on every other tier. ?present=1 turns it on; interiors.noPresent: off.)
    const RP = !this.noPresent && !NO_PRESENT && g.world && g.world.roomPresent, pres = RP && RP.on && RP.on() && R.setRenderTarget ? RP : null;
    let PT = null;
    R.setScissorTest && R.setScissorTest(false); R.setClearColor(d.bg, 1);
    if (pres) { try { pres.begin(R); PT = pres.target(); } catch (e) { PT = null; R.setRenderTarget(null); } }
    if (!PT) R.clear(true, true, true);
    if (rect) {
      // (the world at its own exposure — world/sky.js — the room at 1, as rooms always are)
      const camC = this._copyCam(camW, this.camC || (this.camC = new THREE.PerspectiveCamera()));
      const crop = g.postRender ? 0 : this._cropBegin(R, camC, rect, 2);
      if (crop >= 0) {
        g.scene = g.worldScene; this._inWorldPass = true;
        if (g.outExposure > 0) R.toneMappingExposure = g.outExposure;
        // (the sun's shadow map, a whole extra drawing of the street: seen through a window it is redrawn every third
        //  frame — the shadows of things that move are a twentieth of a second late out there)
        const SM = R.shadowMap, smA = SM && SM.autoUpdate === true && !this.noShadowSkip; this._swN = (this._swN || 0) + 1;
        if (smA && this._swN % 3) { SM.autoUpdate = false; SM.needsUpdate = false; }
        const cut = d.sl.cutPlanes && !this.noGroundCut ? this._groundCut(R, d.sl.cutPlanes) : null;
        try { drawWorld(camC); } finally { if (cut) this._groundCut(R, null, cut); if (smA) SM.autoUpdate = true; g.scene = was; this._inWorldPass = false; R.toneMappingExposure = ex; if (crop > 0) this._cropEnd(R); }
        this.stats.worldPass++;
        R.setRenderTarget && R.setRenderTarget(PT);
        // (in the presenter's target nothing is tone-mapped yet — its pass does that at the room's exposure, 1 — so the
        //  world's picture is brought to its own exposure here: one quad over what was drawn)
        if (PT && g.outExposure > 0 && Math.abs(g.outExposure - 1) > 0.01) { try { RV.scaleTarget(this, R, g.outExposure); } catch (e) { /* the world a little dark through the windows */ } }
        R.clearDepth();
      }
    }
    this._links(R, d, camL, camW);
    // (the caps of its openings first — depth only: through a hole in its walls the room does not draw its own far parts
    //  over the world)
    const ac = R.autoClear, cap = d.sl.cap; R.autoClear = false; if (cap) cap.visible = !this.noCap;
    try { R.render(d.scene, camL); } finally { R.autoClear = ac; if (cap) cap.visible = false; if (PT) { try { pres.end(R); this.stats.presented = (this.stats.presented || 0) + 1; } catch (e) { R.setRenderTarget(null); } } }
    if (R.getClearColor) R.setClearColor(cc, ca);
    this.stats.roomPass++;
    return true;
  }
  /** the world's ground materials take clipping planes for one pass (planes), and are put back (planes null, tok = what the first call returned) */
  _groundCut(R, planes, tok) {
    if (!planes) { for (const m of tok.mats) { m.clippingPlanes = null; m.clipIntersection = false; } R.localClippingEnabled = tok.lc; return null; }
    const g = this.game;
    // (the ground's materials: of every mesh in the world named '…ground' — looked for again every few seconds, the ground is streamed)
    if (!this._gm || (g.frame || 0) - this._gmF > 150) { const set = new Set(); g.worldScene.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material) && /(^|:)ground$/.test(o.name)) set.add(o.material); }); this._gm = [...set]; this._gmF = g.frame || 0; }
    const tok2 = { mats: this._gm, lc: R.localClippingEnabled };
    for (const m of this._gm) { m.clippingPlanes = planes; m.clipIntersection = true; }
    R.localClippingEnabled = true;
    return tok2;
  }
  /** after the world has been drawn (into whatever target is bound) with camera cam (world coordinates): the walk-in
   *  rooms whose REAL openings are on screen (renderFrame has settled which), each over only the part of the screen
   *  those openings take, frustum narrowed to it. Door leaves on doorways to the world are the world pass's proxies. */
  afterWorld(R, cam) {
    const g0 = this.game;
    if (this._inWorldPass && !this._camOut) return;      // (the camera is inside a room: renderFrame draws that room itself)
    // (this frame's warm-up draws, the post target's half: inside the world's pass — NO_WARMPASS)
    if (this._warmPend || this._wwPend) {
      const T = R.getRenderTarget ? R.getRenderTarget() : null;
      if (T && T === this._postTarget() && this._deferOK()) {
        const q = this._warmPend, w = this._wwPend; this._warmPend = null; this._wwPend = null;
        if (q && q.built && q.scene && q.sl.gpu && !q.sl.ready) this._warmStep(q, false, 1);
        if (w && w.scene && w.sl.wwPending) this._wwCv = { d: w, ok: RV.warmWorld(this, w, 1) };
      }
    }
    for (let i = 0; i < this.sl.length; i++) {
      const d = this.sl[i], S = d.sl; if (!S.shown || !d.scene || !S.hasReal || !S.mwi) continue;
      const camL = this._xformCam(cam, this.camL || (this.camL = new THREE.PerspectiveCamera()), S.mwi);
      camL.layers.mask = cam.layers.mask;
      const ac = R.autoClear, ex = R.toneMappingExposure, plain = !R.getRenderTarget || R.getRenderTarget() === null;
      const crop = this._cropBegin(R, camL, S.rr, 8);
      if (crop < 0) continue;
      R.autoClear = false; if (plain) R.toneMappingExposure = 1;
      // (into the post pass's target: the room's pixels brought to exposure 1 after it — core/_roomview.js `expose`)
      const me = S.mExp, xk = !plain && !this._soft && !this.noExpose && ex > 0 && Math.abs(ex - 1) > 0.01; if (me && xk) { me.material.uniforms.uK.value = 1 / ex; me.material.uniformsNeedUpdate = true; me.visible = true; }
      RV.showLeaves(S, false);
      try { R.render(d.scene, camL); } finally { if (me) me.visible = false; RV.showLeaves(S, true); R.autoClear = ac; R.toneMappingExposure = ex; if (crop > 0) this._cropEnd(R); }
      this.stats.roomPass++;
    }
    // the people of rooms seen as impostors: the real characters, lit by their room's lights, in the punched openings —
    // a pass over a short list (the room's lights, its people nearest the eye, the tiles that go over them), not its scene
    for (let i = 0; i < this.sl.length; i++) {
      const d = this.sl[i], S = d.sl; if (!S.shown || !S.hasPeople || !S.pOn || !S.people || !S.people.length || !S.lights || !S.mwi || !S.mTile) continue;
      const camL = this._xformCam(cam, this.camL || (this.camL = new THREE.PerspectiveCamera()), S.mwi);
      camL.layers.mask = cam.layers.mask;
      const pp = this._ppl3 || (this._ppl3 = (() => { const o = new THREE.Object3D(); o.matrixWorldAutoUpdate = false; o.matrixAutoUpdate = false; return o; })()), C = pp.children; C.length = 0;
      for (let k = 0; k < S.lights.length; k++) C.push(S.lights[k]);
      let n = 0;
      // (the few nearest the eye: each is a draw call or more, a tenth of a millisecond apiece on the target machine)
      const cap = PEOPLE_CAP[(g0.quality && g0.quality.level) || 'medium'] || 4, near = this._pnear || (this._pnear = []), far2 = cap > 8 ? 8100 : 1600; near.length = 0;      // (within 40 m of the eye; 90 m on high / ultra)
      for (let k = 0; k < S.people.length; k++) { const q = S.people[k]; if (!q.visible || q.parent !== d.scene) continue; const dx = q.position.x - camL.position.x, dz = q.position.z - camL.position.z, e = dx * dx + dz * dz; if (e > far2) continue; q._pd = e; let j = near.length; if (j < cap) near.push(q); else if (e < near[j - 1]._pd) near[j - 1] = q; else continue; for (j = near.length - 1; j > 0 && near[j]._pd < near[j - 1]._pd; j--) { const t = near[j]; near[j] = near[j - 1]; near[j - 1] = t; } }
      for (let k = 0; k < near.length; k++) { near[k].updateMatrixWorld(true); C.push(near[k]); n++; }
      if (!n) { C.length = 0; continue; }
      C.push(S.mTile);
      const ac = R.autoClear, ex = R.toneMappingExposure, plain = !R.getRenderTarget || R.getRenderTarget() === null, tv = S.mTile.visible;
      const crop = this._cropBegin(R, camL, S.pr, 8);
      if (crop < 0) { C.length = 0; continue; }
      R.autoClear = false; if (plain) R.toneMappingExposure = 1; S.mTile.visible = true;
      // (into the post pass's target the people are lit at 1 / exposure, as their room's picture behind them is painted)
      const lk = !plain && !this.noExpose && ex > 0 && Math.abs(ex - 1) > 0.01 ? 1 / ex : 1, LI = S.lights; if (lk !== 1) for (let k = 0; k < LI.length; k++) LI[k].intensity *= lk;
      pp.userData.terrainRoom = S.terrain;      // (the room's people, drawn apart from its scene: at the room's one height too)
      try { R.render(pp, camL); } finally { if (lk !== 1) for (let k = 0; k < LI.length; k++) LI[k].intensity /= lk; S.mTile.visible = tv; R.autoClear = ac; R.toneMappingExposure = ex; C.length = 0; if (crop > 0) this._cropEnd(R); }
      this.stats.peoplePass = (this.stats.peoplePass || 0) + 1;
    }
  }
  /** the rooms on the other side of room d's room-to-room doorways, each drawn through its doorway (its own scene and
   *  lights; the frame's camera in its coordinates; over only the doorway's part of the screen) before d itself */
  _links(R, d, camL, camW) {
    const S = d.sl; if (!S.linkIds) return;
    for (const id of S.linkIds) {
      const e = this.defs.get(id), E = e && e.sl; if (!E || !E.shown || !e.scene || !E.mwi) continue;
      const camE = this._xformCam(camW, this.camE || (this.camE = new THREE.PerspectiveCamera()), E.mwi);
      let any = false, x0 = 1, y0 = 1, x1 = -1, y1 = -1; const b = this._b;
      this._proj(camE);
      for (const P of E.portals) if (P.off === d.id && this._boxRect(P, P.w + 0.2, P.y, P.y + P.h + 0.1, 0)) { any = true; if (b[0] < x0) x0 = b[0]; if (b[1] < y0) y0 = b[1]; if (b[2] > x1) x1 = b[2]; if (b[3] > y1) y1 = b[3]; }
      this._proj(camL);
      for (const P of S.portals) if (P.off === id && this._boxRect(P, P.w + 0.2, P.y, P.y + P.h + 0.1, 0)) { any = true; if (b[0] < x0) x0 = b[0]; if (b[1] < y0) y0 = b[1]; if (b[2] > x1) x1 = b[2]; if (b[3] > y1) y1 = b[3]; }
      if (!any) continue;
      // every doorway between the two shut by a solid door: nothing of the other room is seen — only the leaf itself, if
      // the door is the other room's (a door of this room's is drawn with this room)
      let solid = true, leaf = false;
      for (const P of E.portals) if (P.off === d.id) { const D = P.door; if (D && !D.glazed && D.open < 0.004) leaf = true; else solid = false; }
      for (const P of S.portals) if (P.off === id) { const D = P.door; if (!(D && !D.glazed && D.open < 0.004)) solid = false; }
      if (solid && !leaf) continue;
      const r = this._lrect || (this._lrect = { x0: 0, y0: 0, x1: 0, y1: 0 }); r.x0 = Math.max(-1, x0); r.y0 = Math.max(-1, y0); r.x1 = Math.min(1, x1); r.y1 = Math.min(1, y1);
      if (solid) { for (const P of E.portals) if (P.off === d.id && P.door) { const L = P.door._lm || (P.door._lm = []); if (!L.length) P.door.group.traverse((o) => { if (o.isMesh) L.push(o); }); for (let i = 0; i < L.length; i++) L[i].layers.enable(WARM); } camE.layers.set(WARM); }
      else camE.layers.mask = camL.layers.mask;
      const crop = this._cropBegin(R, camE, r, 4);
      if (crop >= 0) {
        const ac = R.autoClear; R.autoClear = false;
        try { R.render(e.scene, camE); } finally { R.autoClear = ac; if (crop > 0) this._cropEnd(R); }
        if (solid) this.stats.leafPass++; else this.stats.roomPass++;
        this.stats.linkPass = (this.stats.linkPass || 0) + 1;
      }
      if (solid) for (const P of E.portals) if (P.off === d.id && P.door && P.door._lm) for (let i = 0; i < P.door._lm.length; i++) P.door._lm[i].layers.disable(WARM);
    }
  }
  /** the local player, in room A on the other side of one of room d's room-to-room doorways, as a person at d's doors:
   *  where they are, how they move and the way they are trying to go in d's coordinates; their hand and their giving
   *  way to the leaf in A's, where their body is */
  _linkedMe(d, push, out) {
    const g = this.game, p = g.player, S = d.sl, A = this.defs.get(p.place), F = A && A.sl; if (!F) return;
    let X = S.meL;
    if (!X || X.from !== A) X = S.meL = { from: A, ch: p.character, me: true,
      shove: (ax, az) => { const q = g.player, wx = ax * S.c + az * S.s, wz = -ax * S.s + az * S.c, lx = wx * F.c - wz * F.s, lz = wx * F.s + wz * F.c; _pt.x = q.pos.x + lx; _pt.z = q.pos.z + lz; g.collider.resolve(_pt, q.radius || 0.32); const l = Math.hypot(lx, lz) || 1, got = ((_pt.x - q.pos.x) * lx + (_pt.z - q.pos.z) * lz) / l; q.pos.x = _pt.x; q.pos.z = _pt.z; const vn = (q.vx * lx + q.vz * lz) / l; if (vn < 0) { q.vx -= vn * lx / l; q.vz -= vn * lz / l; } return got; },
      map: (x, y, z) => { const q = S._mq || (S._mq = [0, 0, 0]), w = S.toWorld(x, z, S._mw || (S._mw = [0, 0])), l = F.toLocal(w[0], w[1], S._ml || (S._ml = [0, 0])); q[0] = l[0]; q[1] = y + S.base() - F.base(); q[2] = l[1]; return q; } };
    X.ch = p.character;
    const vx = p.vx || 0, vz = p.vz || 0;
    push(p.worldPos.x, p.worldPos.z, vx * F.c + vz * F.s, -vx * F.s + vz * F.c, true, X, p.worldPos.y);
    const e = out[out.length - 1], inp = g.input, go = inp && (inp.moveX || inp.moveY) ? 1.2 : 0, h = p.heading + F.rot - S.rot; e.ix = Math.sin(h) * go; e.iz = Math.cos(h) * go;
  }
  /** take a room's far pictures again (its impostor: core/_roomview.js) — a module calls it when it has changed how the
   *  room looks from outside (lights, shutters, what stands in a window); the core calls it when the room's lights change */
  refreshView(id) { const d = this.defs.get(id), S = d && d.sl; if (S && S.impOK && S.impDone && !S.impBusy) { S.impBusy = true; S.impFace = 0; } }
  /** take room d off the graphics card (it is far away): its geometry, the textures only it uses and its impostor's cube
   *  maps. The room stays built — its scene, collider and its module's state are untouched — and is drawn up again, a
   *  few meshes a frame, when the player next comes within range. */
  _freeGpu(d) {
    const S = d.sl, R = this.game.renderer; if (!S || !d.scene) return;
    S.gpu = false; S.ready = false; S.warmQ = null; S.warmI = 0; S.warmTries = 0; S.shown = false;
    try {
      RV.hideView(this, d);
      if (S.atlas) RV.disposeAtlas(S.atlas);      // (its depth texture is shared with the other rooms' atlases: core/_roomview.js)
      S.impDone = false; S.impFace = 0; S.impBusy = false; S.wwPending = false; S.impTries = 0;
      const walk = (o) => {
        if (o.name === 'character') return;
        if (o.geometry && o.geometry.dispose && !o.isSkinnedMesh && !o.geometry.userData.shared) o.geometry.dispose();      // (shared: one geometry in many rooms — a street's shops fitted from one template)
        // (never a texture that could not go up again: a block-compressed one whose bytes were let go at upload — a world
        //  atlas that this room's shell happened to be the first to show, tagged as the room's own at its build)
        const m = o.material; if (m && !Array.isArray(m)) for (const k of TEXKEYS) { const t = m[k]; if (t && t.isTexture && t.userData && t.userData.room === d.id && !((t.isCompressedTexture || t.isCompressedArrayTexture) && t.mipmaps && t.mipmaps[0] && !t.mipmaps[0].data)) t.dispose(); }
        for (const c of o.children) walk(c);
      };
      walk(d.scene);
    } catch (e) { console.warn('[interiors] free', d.id, e); }
    this.stats.freed++;
  }

  async enter(id, door) {
    const d = this.defs.get(id), g = this.game;
    if (!d) return;
    if (d.sl) { this.enterNow(id, door); return; }      // (walk-in rooms have no fade: this is the test / tool hook)
    this.stats.fades++;
    const why = door?.locked && door.locked();
    if (why) { g.ui.toast(why); return; }
    await g.ui.fade(() => this._switchIn(d, door));
    g.ui.area(d.name);
  }
  _switchIn(d, door, at) {
    const g = this.game;
    if (!d.built) this._build(d);
    if (this.current?.onExit) this.current.onExit();
    d._via = door || d._via || d.doors[0];
    d._viaPrev = { place: g.player.place, pos: g.player.pos.clone(), heading: g.player.heading };
    this.current = d;
    g.setPlace(d.id, d.scene, d.collider, d.ground);
    g.player.teleport(at ? at[0] : d.spawn[0], at ? at[1] : d.spawn[1], at && at[2] !== undefined ? at[2] : d.heading);
    d.onEnter && d.onEnter();
  }
  /** Synchronous entry with no fade (the start position: the game boots inside a room). at = [x, z, heading?] in the
   *  room instead of its spawn. The exit then leaves by d.doors[0] (or `door`). */
  enterNow(id, door, at) {
    const d = this.get(id);
    if (!d) return null;
    this._switchIn(d, door, at);
    this.game.ui.area(d.name);
    return d;
  }
  /** Synchronous exit with no fade (test hooks that teleport to world coordinates). */
  leaveNow() { if (this.current) this._switchOut(); }

  async exit() {
    const d = this.current;
    if (!d) return;
    if (d.sl) { this._switchOut(); return; }
    this.stats.fades++;
    await this.game.ui.fade(() => this._switchOut());
  }
  _switchOut() {
    const d = this.current, g = this.game;
    d.onExit && d.onExit();
    const door = d._via;
    if (d.sl && d.sl.portals[0].fromDef) {
      const S = d.sl, P = S.portals[0], A = P.fromDef; if (!A.built) this._build(A);
      const w = S.toWorld(P.at[0] + P.dx * (P.depth + 1.3), P.at[1] + P.dz * (P.depth + 1.3)), l = A.sl.toLocal(w[0], w[1]);
      this.current = A; g.setPlace(A.id, A.scene, A.collider, A.ground); g.player.teleport(l[0], l[1], P.out + S.rot - A.sl.rot); A.onEnter && A.onEnter();
      return;
    }
    const from = door?.from || 'world';
    if (from === 'world') { this.current = null; g.setPlace('world', g.worldScene, g.worldCollider, null); }
    else { const o = this.defs.get(from); this.current = o; g.setPlace(o.id, o.scene, o.collider, o.ground); o.onEnter && o.onEnter(); }
    if (d.sl && from === 'world') {      // a walk-in room left by a tool hook: outside its first doorway
      const S = d.sl, P = S.portals[0], w = S.toWorld(P.at[0] + P.dx * (P.depth + 1.3), P.at[1] + P.dz * (P.depth + 1.3));
      g.player.teleport(w[0], w[1], P.out + S.rot);
    } else if (door) {
      const f = door.facing || 0;
      g.player.teleport(door.pos[0] + Math.sin(f) * 1.4, door.pos[1] + Math.cos(f) * 1.4, f);
    } else g.player.teleport(d._viaPrev.pos.x, d._viaPrev.pos.z, d._viaPrev.heading);
  }

  update(dt) {
    dt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
    const g = this.game;
    { const c0 = this.current; if (c0 && c0.pickCollider && g.player.place === c0.id) { const c = c0.pickCollider(g.player); if (c && g.collider !== c) g.collider = c; } }
    if (this.sl.length) { try { this._updateSeamless(dt); } catch (e) { if (!this._slErr) console.error('[interiors] seamless', e); this._slErr = true; } }
    this._updateDoorsLegacy(dt);
    if (this.current?.update) this.current.update(dt);
  }
}
