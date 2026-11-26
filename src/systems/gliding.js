// Gliding: two club two-seaters at the airfield up Airfield Lane (places/gliding_club.js draws the field; the layout is
// systems/_glide_site.js), a winch launch, free flight anywhere over (and beyond) Oxford, thermals, crashes that go up in
// a ball of flame (nobody is hurt), bailing out by parachute, and multiplayer: the pilot's client flies its glider.
//
//   _glide_physics.js  the flight model (pure)          _glide_air.js   wind + thermals (pure, shared clock)
//   _glide_net.js      the wire format + ownership       _glide_site.js  airfield layout + map dressing
//   _glide_model.js    the glider mesh                   _glide_fx.js    explosion, parachute, cable, clouds, birds, countryside
//   _glide_hud.js      instruments + vario audio
//
// Controls (in the glider): W / S or ↑ / ↓ pitch (S pulls the nose up), A / D or ← / → ailerons: raw by default, the stick
// rolls it and it stays where you leave it, with no damper, flare, trim or g help (B turns the assisted mode on: hold
// to bank to 45°, let go to level, and the forgiving layers in _glide_physics.js), Q / E rudder (turns are coordinated for you; rudder adds on top), Space airbrakes (and the wheel
// brake on the ground), Z / X trim slower / faster, C cockpit / chase camera, mouse to look round, L winch launch (at
// the launch point), R release the cable, J bail out (then J opens the parachute early; it opens by itself low down),
// F get in / out on the ground.
//
// Time: the flight is stepped at a fixed 120 Hz (STEP) whatever the frame rate, the keys are read and eased inside the
// step, the air is asked for at the step's own moment on the shared clock, and what is drawn (glider, pilot, camera,
// shadow, cable, what is sent to other players) is the pose BETWEEN the last two steps (G.rp, PH.renderPose) — so the
// picture moves evenly at 30, 60 or 144 frames a second and through a dropped frame, and the same keys fly the same
// flight on every machine (tools/smoke_glide_model.mjs).
// Under the parachute: A / D turn, W / S drift faster / slower, Space flare just before landing.
//
// game.gliding = { gliders, air, local, enter(k), exit(), launch(), bail(), stats(), debug… } (see the bottom).
// Cost: nothing is built until somebody goes near the airfield or flies; then the meshes for gliders within ~3 km of the
// camera. Aerial rendering (world.setAerial) only while the LOCAL player is in the air.
import * as THREE from 'three';
import * as PH from './_glide_physics.js';
import { Air, diurnal, cloudBase, makeRelief } from './_glide_air.js';
import { SITE, inBox, inField, dressMap } from './_glide_site.js';
import { build as buildModel, pose as poseModel, DIM, linkEnv } from './_glide_model.js';
import { Boom, Chute, Cable, Clouds, Birds, Country, CityLights, GroundShadow, setBodyMaterial } from './_glide_fx.js';
import { Hud, Vario, AirNoise } from './_glide_hud.js';
import * as NET from './_glide_net.js';

const { MODE } = NET;
const TRIMS = [0xc8202a, 0x1f5fd0], NAMES = ['red', 'blue'];
const STEP = 1 / 120, MAX_STEPS = 16, D2R = Math.PI / 180, TAU = Math.PI * 2;
const BANK = 45 * D2R;            // the bank a held A / D asks for
const CAM_IN = 1.5, CAM_OUT = 1.7, CAM_CUT = 80;     // s to ease the view over from / back to walking; further than CAM_CUT m it cuts
const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10);
const FX_PARTS = ['boom', 'chute', 'cables', 'clouds', 'birds', 'country', 'rchutes', 'lights', 'shadows'];
const AIR_WARM_R = 600;           // m from the field's edge: the world's aerial warm-up starts inside this (or when a flight begins)
const distToField = (x, z) => { const f = SITE.field, x0 = Math.min(f[0][0], f[2][0]), x1 = Math.max(f[0][0], f[1][0]), z0 = Math.min(f[0][1], f[2][1]), z1 = Math.max(f[0][1], f[2][1]); return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)); };
const NEAR_SITE = 1800;          // m from the airfield centre: inside this the parked gliders are in the scene
const WRECK_MS = 25000, DITCH_MS = 40000, LANDOUT_MS = 240000, FIELD_MS = 45000;
const PROBES = [[0, 0, 0], [0, 0, 3.0], [8.3, 0.4, 0.3], [-8.3, 0.4, 0.3], [0, 1.2, -4.8]];   // CG, nose, wing tips, fin top (glider axes)
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const KEYHELP = 'GLIDER\n W / S  (↑ ↓)   pitch — S pulls the nose up\n A / D  (← →)   ailerons: roll the glider, it stays where you leave it\n Q / E          rudder  ·  B assisted flying on / off\n Space          airbrakes (wheel brake on the ground)\n Z / X          trim slower / faster\n L launch on the winch  ·  R release the cable\n J bail out  ·  C cockpit / chase view  ·  F get out (stopped)\n Landing: Space all the way down, hold S from tree-top height';
const CRASH_LINES = ['Well, that went up nicely.', 'You walk away singed, and the glider does not.', 'Note to self: buildings do not move.', 'Somewhere a CFI is filling in a very long form.', 'Your eyebrows will grow back. Probably.'];
const PED_LINES = ['Blimey!', 'Was that a glider?!', 'Someone call the fire brigade!', 'Did you see that?', 'Good heavens!', 'Not again...'];

// ---------------------------------------------------------------- 3D obstacles: building footprints + heights, map trees
class Obstacles {
  constructor(game) {
    const map = game.map, ov = game.overrides, LM = (game.world && game.world.landmarks) || {};
    this.C = 32; this.cells = new Map(); this.tcells = new Map(); this.maxH = 0; this.all = [];
    const special = { w4884600: 42, w27582068: 24, w60903337: 30, w87344211: 30 };      // custom silhouettes (dome, cupola, tower) — approximate
    for (const b of map.buildings) {
      if (b.hasParts && !b.part) { /* outline: its parts carry the volumes; keep it too at its own height as a floor */ }
      const top = (ov.heights && ov.heights.get(b.id)) ?? special[b.id] ?? (LM[b.id] && LM[b.id].h) ?? b.h ?? 8;
      if (!(top > 0.5)) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of b.poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      const r = { poly: b.poly, top: top + (b.tags && /gabled|hipped|pyramidal|dome|cone|onion/.test(b.tags['roof:shape'] || '') ? 1.5 : 0), bot: b.minH || 0, x0, x1, z0, z1, id: b.id };
      this.maxH = Math.max(this.maxH, r.top); this.all.push(r);
      for (let i = Math.floor(x0 / this.C); i <= Math.floor(x1 / this.C); i++) for (let j = Math.floor(z0 / this.C); j <= Math.floor(z1 / this.C); j++) {
        const k = i * 100003 + j; let a = this.cells.get(k); if (!a) this.cells.set(k, (a = [])); a.push(r);
      }
    }
    for (const t of map.trees) {
      const h = t[2] || 10, R = Math.max(1.5, h * 0.28), k = Math.floor(t[0] / this.C) * 100003 + Math.floor(t[1] / this.C);
      let a = this.tcells.get(k); if (!a) this.tcells.set(k, (a = [])); a.push(t[0], t[1], h, R);
    }
    // the Martyrs' Memorial (a node, not a footprint): a thin spike
    this.spikes = [];
    const mm = (map.pois || []).find((p) => p.id === 'n16252895'); if (mm) this.spikes.push([mm.p[0], mm.p[1], 22, 1.6]);
  }
  /** the smoothed height of the town for the air's roof lift (_glide_air.js makeRelief): every building filled on a 3 m lattice (scan lines) */
  relief(bounds) {
    const all = this.all, xs = [];
    return makeRelief(bounds, (put) => {
      for (const r of all) {
        if (r.bot > 3) continue;
        const h = Math.min(r.top, 45), P = r.poly, n = P.length;
        for (let z = Math.ceil(r.z0 / 3) * 3; z <= r.z1; z += 3) {
          xs.length = 0;
          for (let i = 0, j = n - 1; i < n; j = i++) { const zi = P[i][1], zj = P[j][1]; if ((zi > z) !== (zj > z)) xs.push(P[i][0] + ((z - zi) / (zj - zi)) * (P[j][0] - P[i][0])); }
          xs.sort((a, b) => a - b);
          for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] / 3) * 3; x <= xs[k + 1]; x += 3) put(x, z, h);
        }
      }
    });
  }
  /** what (x, y, z) is inside: 'building' | 'tree' | null; the building record in .hit */
  at(x, y, z) {
    if (y > this.maxH + 2 && y > 40) return null;
    const k = Math.floor(x / this.C) * 100003 + Math.floor(z / this.C);
    const a = this.cells.get(k);
    if (a) for (const r of a) {
      if (y > r.top || y < r.bot - 0.5 || x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      if (pip(x, z, r.poly)) { this.hit = r; return 'building'; }
    }
    if (y < 30) {
      const t = this.tcells.get(k);
      if (t) for (let i = 0; i < t.length; i += 4) {
        const dx = x - t[i], dz = z - t[i + 1], R = t[i + 3];
        if (y < t[i + 2] && y > 0.4 && dx * dx + dz * dz < R * R * (y > t[i + 2] * 0.35 ? 1 : 0.12)) { this.hit = null; return 'tree'; }
      }
      for (const s of this.spikes) if (y < s[2] && Math.hypot(x - s[0], z - s[1]) < s[3]) return 'building';
    }
    return null;
  }
  /** top of a building at (x, z), or null */
  roofAt(x, z) {
    const a = this.cells.get(Math.floor(x / this.C) * 100003 + Math.floor(z / this.C)); let best = null;
    if (a) for (const r of a) { if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1 || r.bot > 2.5) continue; if (pip(x, z, r.poly) && (best === null || r.top > best.top)) best = r; }
    return best;
  }
}
function pip(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; }
  return c;
}

// ---------------------------------------------------------------- the system
class Gliding {
  constructor(game) {
    this.game = game;
    this.t = 0; this.myId = 0;
    this.heat = (x, z) => this._heat(x, z);
    this.air = new Air(this.heat);
    this.G = SITE.homes.map((home, k) => ({ k, home, trim: TRIMS[k], name: NAMES[k], rec: NET.newRecord(k, home), track: new NET.Track(), rs: { q: [1, 0, 0, 0] }, rp: { x: home.x, y: 0, z: home.z, q: [1, 0, 0, 0], h: home.h, pitch: 0, roll: 0 }, vis: null, sim: null, flags: 0, lastGl: -1e9, cable: null, ctl: { ail: 0, elev: 0, rud: 0 } }));
    // ctl: what the flight model is given. pitch / roll / yaw are the stick and pedals; pv, rv, yv their rates and bank,
    // bv the bank asked for and its rate (all eased inside the fixed step: _controls)
    this.L = { phase: null, g: null, cam: 'chase', direct: true, ctl: { pitch: 0, roll: 0, yaw: 0, ab: 0, brake: 0, pv: 0, rv: 0, yv: 0, bank: 0, bv: 0 }, jump: null, thrown: null, still: 0, crashT: 0 };
    this._airT = null;               // the shared-clock moment (ms) of the step being simulated (null: now)
    this.env = { wind: (x, y, z, o) => this.air.at(x, y, z, this._airT ?? this.game.time.now(), this.game.time.hour, o), ground: (x, z) => this._ground(x, z), cable: null };
    this._acc = 0; this._netT = 0; this._known = new Set(); this.stats = { steps: 0, sent: 0, bytes: 0, booms: 0, ditches: 0, bails: 0, landings: 0, launches: 0, crashes: 0 };
    this.hud = new Hud(); this.vario = new Vario(game.audio); this.whoosh = new AirNoise(game.audio);
    // the camera: yaw / el / roll / dist / lift / fov are eased values; blend 1→0 eases the view over from wherever it was
    // (in*: that pose, relative to what is followed), out 1→0 eases it back to the walking camera (out*: where it was)
    this.camS = { yaw: 0, el: 0.1, roll: 0, dist: 15, lift: 0, fov: 60, init: false, oy: 0, op: 0, idle: 0, shake: 0, mode: '', live: false,
      blend: 0, blendT: CAM_IN, inP: new THREE.Vector3(), inQ: new THREE.Quaternion(), out: 0, outP: new THREE.Vector3(), outQ: new THREE.Quaternion(), lastP: new THREE.Vector3(), lastQ: new THREE.Quaternion() };
    this._v3 = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._qb = new THREE.Quaternion(); this._m4 = new THREE.Matrix4();
    this.veh = { type: null, kind: 'glider', name: 'Glider', speed: 0, camDist: 3, x: 0, z: 0, heading: 0 };      // player.vehicle while seated (type null: no ghost for watchers, other systems ignore it)
    this.chuteVeh = { type: null, kind: 'chute', name: 'Parachute', speed: 0, camDist: 2, x: 0, z: 0, heading: 0 };
    this.fx = null; this.idle = true;
    this.clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;   // local seconds (tests replace it)
    this._tmpA = [0, 0, 0];
  }

  // ------------------------------------------------------------ helpers
  /**
   * The building volumes and trees (built once, on getting in, so there is no hitch in the air). The air's relief for
   * roof lift is filled from them a couple of frames later (its own frame: the two together were a long one), while the
   * glider is still sitting on the grass.
   */
  _obs() {
    if (!this.obs) { this.obs = new Obstacles(this.game); this._reliefIn = 3; }
    return this.obs;
  }
  _ground(x, z) { const w = this.game.world; return w && w.groundHeight ? w.groundHeight(x, z) : 0; }
  _heat(x, z) {
    const g = this.game, col = g.worldCollider;
    if (col && col.isWater(x, z)) return 0.1;
    if (inBox(x, z)) return 0.8;
    const B = g.map && g.map.bounds;
    if (B && (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ)) return 0.72;     // open farmland round the map
    const zone = g.world && g.world.zoneAt ? g.world.zoneAt(x, z) : 'mid';
    return zone === 'centre' ? 1.15 : zone === 'east' || zone === 'jericho' || zone === 'south' ? 0.95 : zone === 'mid' ? 0.9 : zone === 'north' ? 0.82 : 0.72;
  }
  /** both glider models (built once, together, so their materials can be compiled before either is drawn) */
  _models() {
    const w = this.game.world;
    if (!this._linked) { this._linked = true; linkEnv(w && w.uniforms); }
    for (const G of this.G) if (!G.vis) { G.vis = buildModel({ trim: G.trim, number: String(G.k + 1) }); G.vis.group.name = 'glider:' + G.k; }
  }
  /** one part of the effects (built a part a frame by the warm-up, or all at once by _fxInit) */
  _fxPart(k) {
    const P = this._fxB || (this._fxB = {});
    if (P[k]) return;
    const g = this.game, s = g.worldScene, b = g.map.bounds, w = g.world || {};
    this._models();
    if (!this._bodySet) { this._bodySet = true; setBodyMaterial(this.G[0].vis.parts.body.material); }   // the parachute, birds and drogue share the glider's program
    switch (k) {
      case 'boom': P.boom = new Boom(s); break;
      case 'chute': P.chute = new Chute(); break;
      case 'cables': P.cables = [new Cable(s), new Cable(s)]; break;
      case 'clouds': P.clouds = new Clouds(s); break;
      case 'birds': P.birds = new Birds(s); break;
      case 'country': P.country = new Country(s, { minX: b.minX - 280, maxX: b.maxX + 280, minZ: b.minZ - 280, maxZ: b.maxZ + 280 }, 3400, w.uniforms && w.uniforms.air); break;
      case 'rchutes': P.rchutes = [new Chute(), new Chute()]; break;
      case 'lights': P.lights = new CityLights(s, w.lampPositions); break;
      case 'shadows': P.shadows = [new GroundShadow(s), new GroundShadow(s)]; break;
    }
  }
  _fxInit() {
    if (this.fx) return this.fx;
    for (const k of FX_PARTS) this._fxPart(k);
    this.fx = this._fxB;
    return this.fx;
  }
  /**
   * Compile every gliding material (and the world's aerial variants) ahead of use, without stalling a frame where the
   * driver compiles in parallel: started when anyone comes near the airfield or a flight begins. Nothing of ours is
   * drawn until it has finished (a glider turns up a moment late rather than freezing the screen). -> Promise | null
   * With a renderer that can (world.prepare) it is spread over frames, one step each (_warmStep from update): the two
   * models, each effect, each big texture upload, then the compile + first draw of the lot (world.prepare: on a Mac the
   * GPU pipeline is only built at a program's first draw) — no step more than a few ms of the main thread.
   */
  _warm() {
    if (this._warmP !== undefined) return this._warmP;
    const g = this.game, w = g.world, r = g.renderer;
    this.stats.warmStart = this.clock();
    if (w && w.prepare && r && r.compileAsync) {
      // (the loading screen has done the models, the effects and their first draws — _warmLoad: only the world's aerial
      // variants are left)
      // (...if it got that far: a start with no loading-screen room — ?spawn=street — never runs the queue, and the
      // promise would stay pending for good; then everything is done here, as when the budget dropped it)
      this._warmQ = this._loadP && this._loadDone ? ['aerial'] : ['model0', 'model1', ...FX_PARTS, 'standins', 'textures', 'prepare'];
      this._warmP = new Promise((res) => { this._warmRes = res; });
      return this._warmP;
    }
    // (no renderer to compile with — tests: everything now)
    this._fxInit();
    const grp = this._standIns(), ps = [];
    const p1 = w && w.compileAsync ? w.compileAsync(grp) : null; if (p1 && p1.then) ps.push(p1);
    const p2 = w && w.warmAerial ? w.warmAerial() : null; if (p2 && p2.then) ps.push(p2);
    if (!ps.length) { this.ready = true; this._warmP = null; this.stats.warmMs = 0; return null; }
    this._warmP = Promise.all(ps).catch(() => null).then(() => { this.ready = true; this.stats.warmMs = Math.round((this.clock() - this.stats.warmStart) * 1000); });
    return this._warmP;
  }
  /**
   * The loading screen's share (game.warmups, world/prewarm.js): both models, every effect, the big texture uploads and
   * the first draw of every gliding material out of sight (world.warmDraw) — arriving near the field used to do these a
   * step a frame (Country's 2048² fields texture alone ~18 ms) with the programs linking and their GPU pipelines built
   * on the first draws in play. -> Promise | null
   */
  _warmLoad() {
    const g = this.game, w = g.world, r = g.renderer;
    if (this._loadP !== undefined || this._warmP !== undefined || !w || !w.warmDraw || !r || !r.compileAsync) return null;
    this._models(); this._fxInit(); this._sleep();
    const grp = this._standIns(), seen = new Set();
    for (const o of grp.userData.objs) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m && m.map && !seen.has(m.map)) { seen.add(m.map); try { r.initTexture(m.map); } catch { /* */ } } }
    // (dropped by the loading screen's time budget — resolved false: the warm-up near the field does it all, as before)
    const p = w.warmDraw(grp, { prio: 0, id: 'gliding' });
    this._loadP = p ? p.then((ok) => { this._loadDone = true; if (!ok) this._loadP = null; return ok; }) : null;
    return p;
  }
  /** throwaway stand-ins of everything gliding draws, in a detached group (same geometry, material, kind and shadow flags: the same program variants) */
  _standIns() {
    const fx = this._fxInit(), objs = [];
    for (const G of this.G) G.vis.group.traverse((o) => { if (o.isMesh) objs.push(o); });
    for (const k of ['boom', 'chute', 'clouds', 'birds', 'country', 'lights']) objs.push(...fx[k].objects());
    objs.push(...fx.cables[0].objects(), ...fx.shadows[0].objects());
    const grp = new THREE.Group();
    for (const o of objs) {
      const m = o.isLineSegments ? new THREE.LineSegments(o.geometry, o.material) : o.isLine ? new THREE.Line(o.geometry, o.material) : o.isPoints ? new THREE.Points(o.geometry, o.material) : new THREE.Mesh(o.geometry, o.material);
      m.receiveShadow = o.receiveShadow; m.castShadow = o.castShadow; m.frustumCulled = false; m.customDepthMaterial = o.customDepthMaterial; grp.add(m);
    }
    grp.userData.objs = objs;
    return grp;
  }
  /** one warm-up step (a frame) */
  _warmStep() {
    const Q = this._warmQ; if (!Q || !Q.length) return;
    const g = this.game, w = g.world, r = g.renderer, k = Q[0], a = this.clock() * 1000;
    let what = k;
    if (k === 'model0' || k === 'model1') {
      const w2 = this.game.world;
      if (!this._linked) { this._linked = true; linkEnv(w2 && w2.uniforms); }
      const G = this.G[k === 'model0' ? 0 : 1];
      if (!G.vis) { G.vis = buildModel({ trim: G.trim, number: String(G.k + 1) }); G.vis.group.name = 'glider:' + G.k; }
      Q.shift();
    } else if (FX_PARTS.includes(k)) { this._fxPart(k); Q.shift(); }
    else if (k === 'standins') { this._fxInit(); this._grp = this._standIns(); this._texs = []; const seen = new Set(); for (const o of this._grp.userData.objs) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m && m.map && !seen.has(m.map)) { seen.add(m.map); this._texs.push(m.map); } } Q.shift(); }
    else if (k === 'textures') {
      // the big textures go up to the GPU one a frame (the 2048² countryside would otherwise upload on the first aerial frame)
      const t = this._texs.shift();
      if (t && r.initTexture) { try { r.initTexture(t); } catch { /* */ } what = 'texture ' + (t.name || (t.image && t.image.width + 'x' + t.image.height)); }
      if (!this._texs.length) Q.shift();
    } else if (k === 'aerial') {
      // (the world's aerial variants and the walk that draws every material nobody has drawn from the ground — 150-odd
      // first draws, ~280 MB of uploads — wait until someone is near the field itself or about to fly: see update)
      Q.shift();
      Promise.resolve(this._loadP).catch(() => null).then(() => { this.ready = true; this.stats.warmMs = Math.round((this.clock() - this.stats.warmStart) * 1000); this._warmRes(); });
    } else if (k === 'prepare') {
      Q.shift();
      // (the world's aerial variants: _airWarm in update, once near the field itself)
      const ps = [], p1 = w.prepare(this._grp);
      if (p1 && p1.then) ps.push(p1);
      this._grp = null;
      Promise.all(ps).catch(() => null).then(() => { this.ready = true; this.stats.warmMs = Math.round((this.clock() - this.stats.warmStart) * 1000); this._warmRes(); });
    }
    if (w && w.warmStat) w.warmStat('gliding ' + what, this.clock() * 1000 - a);
  }
  _now() { return this.game.time.now(); }
  _me() { return (this.game.net && this.game.net.id) || 0; }
  _send(kind, data) { const n = this.game.net; if (n && n.connected) { n.send(kind, data); this.stats.sent++; this.stats.bytes += JSON.stringify(data).length + 24; } }
  _writeRec(G, patch) {
    // every write is a new generation (so it beats anything older whoever wrote that); a claim and an update that
    // cross in the post carry the same generation and the lower player id wins (see _glide_net.js)
    Object.assign(G.rec, patch, { gen: patch.gen ?? G.rec.gen + 1, by: this._me(), at: this._now() });
    this._send('gr', NET.recMsg(G.rec));
  }
  _toast(t, s = 3) { const u = this.game.ui; if (u && u.toast) u.toast(t, s); }
  _audio() { const a = this.game.audio; return a && a.ctx ? a : null; }

  /** where the cockpit (front seat) of glider G is, for the F prompt */
  cockpitPos(G, out) {
    const r = G.rec, fx = Math.sin(r.h), fz = Math.cos(r.h);
    out.set(r.x + fx * DIM.seatFront[2], this._ground(r.x, r.z), r.z + fz * DIM.seatFront[2]);
    return out;
  }
  canBoard(G) {
    const p = this.game.player, r = G.rec;
    return !this.L.phase && !p.vehicle && !p.swim && p.place === 'world' && !r.pilot && (r.mode === MODE.HOME || r.mode === MODE.GROUND);
  }
  /** a friend is sitting in it on the ground: you can ride in the back seat */
  canRide(G) {
    const p = this.game.player, r = G.rec, me = this._me();
    return !this.L.phase && !p.vehicle && !p.swim && p.place === 'world' && me > 0 && r.pilot > 0 && r.pilot !== me && !r.pax && (r.mode === MODE.HOME || r.mode === MODE.GROUND);
  }

  // ------------------------------------------------------------ install-time wiring
  wire() {
    const g = this.game;
    if (g.interact) {
      for (const G of this.G) {
        const pos = new THREE.Vector3();
        const who = () => { const o = g.net && g.net.others && g.net.others.get(G.rec.pilot); return o ? o.name : 'a friend'; };
        G.item = g.interact.add({ key: 'F', radius: 3.4, pos: () => this.cockpitPos(G, pos), label: () => (this.canBoard(G) ? `Fly the ${G.name} glider` : `Ride in the back with ${who()}`), enabled: () => this.canBoard(G) || this.canRide(G), onUse: () => (this.canBoard(G) ? this.enter(G.k) : this.ride(G.k)) });
      }
    }
    if (g.net && g.net.on) {
      g.net.on('gr', (d, o) => this._onRec(d, o));
      g.net.on('gl', (d, o) => this._onFly(d, o));
      g.net.on('ge', (d, o) => this._onEvent(d, o));
    }
    if (g.input && g.input.onKey) g.input.onKey((code) => this._key(code));
  }
  _hookCamera() {
    if (this._camHooked) return;
    this._camHooked = true;
    const prev = this.game.cameraHook, g = this.game, C = this.camS;
    this.game.cameraHook = (dt, cam) => {
      if (this._camera(dt, cam)) { C.live = true; C.lastP.copy(cam.position); C.lastQ.copy(cam.quaternion); return true; }
      if (C.live) { C.live = false; C.init = false; C.out = 1; C.outP.copy(C.lastP); C.outQ.copy(C.lastQ); }
      if (!(C.out > 0)) return prev ? prev(dt, cam) : false;
      // just handed back (landed and got out, came down under the parachute, picked oneself up): whoever has the view
      // now places it, and it is eased there from where the glider's camera left it — no cut
      let placed = prev ? prev(dt, cam) : false;
      if (!placed && g._followCamera && !(g.activity && g.activity.camera)) { g._followCamera(dt); placed = true; }
      if (!placed || cam.position.distanceTo(C.outP) > CAM_CUT) { C.out = 0; return placed; }
      C.out = Math.max(0, C.out - dt / CAM_OUT);
      const u = smoother(C.out);
      cam.position.lerp(C.outP, u); cam.quaternion.slerp(C.outQ, u);
      return true;
    };
  }

  // ------------------------------------------------------------ getting in / out
  enter(k) {
    const g = this.game, p = g.player, G = this.G[k];
    if (!G || !this.canBoard(G)) return false;
    this._hookCamera();
    this._obs();          // (built once, before the launch, so there is no hitch later)
    const me = this._me();
    this._writeRec(G, { gen: G.rec.gen + 1, pilot: me || -1, mode: G.rec.mode === MODE.HOME ? MODE.HOME : MODE.GROUND });
    const gh = this._ground(G.rec.x, G.rec.z);
    // (sitting exactly as the parked glider is drawn: one wing on the grass — getting in moves nothing)
    G.sim = PH.newGlider(G.rec.x, G.rec.z, G.rec.h, { ground: gh, pitch: 0.026, roll: this._parkRoll(G) });
    G.sim.onGround = true; G.sim.y = gh + PH.GLIDER.wheelH; PH.syncPose(G.sim);
    G.sim.trimV = 25;
    this.L.phase = 'seated'; this.L.g = G; this.L.still = 0; this.L.t = 0;
    const c = this.L.ctl; c.pitch = c.roll = c.yaw = c.ab = c.brake = 0;
    p.vehicle = this.veh; p.pose = 'drive'; p.speed = 0; p.frozen++; this._froze = true;
    try { p.character.setPose('drive'); } catch { /* */ }
    if (g.police && g.police.level > 0 && g.police.clear) { g.police.clear(); this._toast("The police can't follow you where you're going.", 3); }
    this.hud.show(true); this.hud.keys(KEYHELP, 9);
    this.camS.init = false;
    this._toast(this._atLaunch(G) ? `In the ${G.name} glider. L to launch on the winch.` : `In the ${G.name} glider.`, 4);
    return true;
  }
  /** the back seat of a friend's glider: their client flies it, we ride along on their flight state */
  ride(k) {
    const g = this.game, p = g.player, G = this.G[k];
    if (!G || !this.canRide(G)) return false;
    this._hookCamera();
    this._obs();
    this._writeRec(G, { gen: G.rec.gen + 1, pax: this._me() });
    this.L.phase = 'pax'; this.L.g = G; this.L.t = 0;
    p.vehicle = this.veh; p.pose = 'drive'; p.speed = 0; p.frozen++; this._froze = true;
    try { p.character.setPose('drive'); } catch { /* */ }
    if (g.police && g.police.level > 0 && g.police.clear) g.police.clear();
    this.hud.show(true); this.camS.init = false;
    const o = g.net.others.get(G.rec.pilot);
    this._toast(`In the back seat. ${o ? o.name : 'Your friend'} has the controls. J bails out, C changes the view.`, 4);
    return true;
  }
  /** leave the back seat (on the ground) */
  _unride(note) {
    const g = this.game, p = g.player, G = this.L.g; if (!G) return;
    const r = G.rec, P = this._tmpA;
    if (r.pax === this._me()) this._writeRec(G, { pax: 0 });
    const x = (G.rs && G.rs.x) ?? r.x, z = (G.rs && G.rs.z) ?? r.z, h = r.h;
    this._release();
    PH.qRotate(PH.qFromHPR(h, 0, 0, this._qh2 || (this._qh2 = [1, 0, 0, 0])), -1.6, 0, 0.5, P);
    p.pos.set(x + P[0], this._ground(x + P[0], z + P[2]), z + P[2]); p.heading = h; p.syncMesh && p.syncMesh();
    if (note) this._toast(note, 3);
  }
  /** which wing a parked glider rests on: the one it came to rest on, else by its number */
  _parkRoll(G) { const r = G.rec.r; return (Math.abs(r) > 0.02 ? Math.sign(r) : G.k ? -1 : 1) * PH.REST_ROLL; }
  _atLaunch(G) { const s = G.sim || G.rec; return Math.hypot(s.x - G.home.x, s.z - G.home.z) < 40; }
  /** leave the glider on the ground (stopped) */
  exit(force = false) {
    const g = this.game, p = g.player, L = this.L, G = L.g;
    if (!G || !G.sim) return false;
    const s = G.sim;
    if (!force && (!s.onGround || Math.hypot(s.vx, s.vz) > 1)) { this._toast('Stop first.', 1.5); return false; }
    // step out beside the cockpit on the left (+x side), wherever there is room
    const lx = Math.cos(s.h), lz = -Math.sin(s.h);
    let ox = s.x + lx * 1.4 + Math.sin(s.h) * 1.5, oz = s.z + lz * 1.4 + Math.cos(s.h) * 1.5;
    const col = g.worldCollider;
    for (const d of [1.4, -1.4, 2.4, -2.4]) { const x = s.x + lx * d + Math.sin(s.h) * 1.5, z = s.z + lz * d + Math.cos(s.h) * 1.5; if (!col || col.isFree(x, z, 0.35)) { ox = x; oz = z; break; } }
    const wet = col && col.isWet(s.x, s.z);
    const home = this._atLaunch(G) && inField(s.x, s.z);
    this._writeRec(G, { pilot: 0, pax: 0, mode: home ? MODE.HOME : wet ? MODE.DITCHED : MODE.GROUND, x: home ? G.home.x : s.x, y: s.y, z: home ? G.home.z : s.z, h: home ? G.home.h : s.h, p: s.pitch, r: s.roll });
    G.sim = null;
    this._release();
    p.pos.set(ox, this._ground(ox, oz), oz); p.heading = s.h; p.syncMesh && p.syncMesh();
    if (!inMap(g, ox, oz)) { this._retrieve(G, true); }
    return true;
  }
  /** back to normal on foot (or whatever the caller does next) */
  _release(pose = 'stand') {
    const g = this.game, p = g.player, L = this.L;
    if (this._froze) { p.frozen = Math.max(0, p.frozen - 1); this._froze = false; }
    if (p.vehicle === this.veh || p.vehicle === this.chuteVeh) p.vehicle = null;
    p.pose = pose; try { p.character.setPose(pose); } catch { /* */ }
    const grp = p.character.group; grp.rotation.set(0, p.heading, 0); grp.visible = true;
    p.vy = 0; p.onGround = true; p.speed = 0;
    L.phase = null; L.g = null; L.jump = null;
    this.hud.show(false); this.vario.stop(); this.whoosh.update(0, 0, false);
    this.env.cable = null;
    if (g.world && g.world.setAerial) g.world.setAerial(false);
    // (the lens is left as it is: the walking camera eases it back to its own, core/game.js _followCamera)
    const cam = g.camera; cam.near = 0.15; cam.far = 2600; cam.updateProjectionMatrix();
  }
  /** [E] call for a retrieve: you and the glider back at the launch point (a fade) */
  _retrieve(G, auto = false) {
    const g = this.game, p = g.player;
    // you ride back with the crew only when fast travel is on (core/features.js) or you landed beyond the map
    const ride = auto || !!(g.features && g.features.fastTravel);
    const go = () => {
      this._writeRec(G, { pilot: 0, mode: MODE.HOME, x: G.home.x, z: G.home.z, h: G.home.h, p: 0, r: 0, y: 0 });
      if (!ride) { this._toast('The retrieve crew turn up, de-rig the glider and trailer it back to the club. You make your own way.', 5); return; }
      const x = G.home.x - 6, z = G.home.z - 5;
      p.teleport ? p.teleport(x, z, G.home.h) : p.pos.set(x, 0, z);
      this._toast(auto ? 'You landed out beyond the map. The retrieve crew drive you and the glider back to the club.' : 'The retrieve crew turn up with the trailer and drive you back to the club.', 5);
    };
    if (!ride) { go(); return; }
    if (g.ui && g.ui.fade) g.ui.fade(go); else go();
  }

  // ------------------------------------------------------------ keys
  _key(code) {
    const g = this.game, L = this.L;
    if (!L.phase || g.input.typing || g.activity || (g.ui && g.ui.inDialog)) return;
    const G = L.g, s = G && G.sim;
    if (['KeyC', 'KeyZ', 'KeyX', 'KeyL', 'KeyR', 'KeyJ', 'KeyF', 'KeyE', 'KeyH', 'KeyB'].includes(code)) g.input.pressed.delete(code);   // ours: nobody else acts on it this frame
    if (code === 'KeyC') { L.cam = L.cam === 'chase' ? 'cockpit' : 'chase'; this.camS.init = false; }
    if (code === 'KeyB' && s) { L.direct = !L.direct; this._toast(L.direct ? 'Raw controls: the stick is the stick, no help.' : 'Assisted: hold A / D to turn, let go to level the wings; flare and trim help.', 3.5); }
    if (L.phase === 'pax') {
      if (code === 'KeyJ' && G.rs && G.rs.y - this._ground(G.rs.x, G.rs.z) > 8) this._paxBail();
      else if (code === 'KeyF' && (G.rec.mode === MODE.HOME || G.rec.mode === MODE.GROUND || ((G.flags & NET.FLAG.WHEEL) && (G.remoteV || 0) < 1.5))) this._unride();
      return;
    }
    if (!s) { if (L.phase === 'chute' && code === 'KeyJ' && L.jump && L.jump.open === 0 && L.jump.t > 0.8) L.jump.opening = true; return; }
    if (code === 'KeyZ') s.trimV = clamp(s.trimV - 1.5, 18.5, 50);
    else if (code === 'KeyX') s.trimV = clamp(s.trimV + 1.5, 18.5, 50);
    else if (code === 'KeyL' && L.phase === 'seated') this.launch();
    else if (code === 'KeyR' && s.cable) { this._wantRelease = true; }
    else if (code === 'KeyJ' && (L.phase === 'fly' || L.phase === 'winch') && !s.onGround) this.bail();
    else if (code === 'KeyF' && (L.phase === 'seated' || L.phase === 'landed')) this.exit();
    else if (code === 'KeyE' && L.phase === 'landed' && !inField(s.x, s.z)) { const GG = G; if (this.exit(true)) this._retrieve(GG); }
    else if (code === 'KeyH') this.hud.keys(KEYHELP, 8);
  }

  launch() {
    const L = this.L, G = L.g, s = G && G.sim;
    if (!s || L.phase !== 'seated') return false;
    if (!this._atLaunch(G)) { this._toast('There is no winch here. F to get out — E to call for a retrieve.', 3.5); return false; }
    // line up on the launch heading
    s.x = G.home.x; s.z = G.home.z; s.q = PH.qFromHPR(G.home.h, s.pitch, s.roll); s.vx = s.vz = 0; PH.hprOf(s.q, s); PH.syncPose(s);   // (the wing comes up as the ground run gathers speed)
    s.cable = true; s.liftT = 0; this._wantRelease = false;
    const W = SITE.winch;
    this.env.cable = { x: W[0], y: 1.6, z: W[1] + (G.k ? 6 : -6), tension: PH.winchTension() };
    L.phase = 'winch'; L.t = 0;
    this._writeRec(G, { mode: MODE.LAUNCH });
    this.stats.launches++;
    this._toast('All out! The winch takes up the slack...', 2.5);
    const a = this._audio(); if (a) a.noise(2.5, { gain: 0.05, freq: 300, type: 'lowpass', q: 0.7 });
    if (this.game.world && this.game.world.setAerial) this.game.world.setAerial(true);
    return true;
  }

  _paxBail() {
    const g = this.game, p = g.player, L = this.L, G = L.g, R = G.rs;
    PH.hprOf(R.q, this._hpr || (this._hpr = {}));
    const h = this._hpr.h, V = G.remoteV || 25, lx = Math.cos(h), lz = -Math.sin(h);
    this._writeRec(G, { pax: 0 });
    this.stats.bails++;
    L.jump = { x: R.x + lx * 1.2, y: R.y + 0.3, z: R.z + lz * 1.2, vx: Math.sin(h) * V + lx * 2, vy: 1.5, vz: Math.cos(h) * V + lz * 2, h, t: 0, open: 0, opening: false, flare: 0, flareCd: 0, sw: 0, swv: 0 };
    L.phase = 'chute'; L.g = null;
    this.hud.show(false); this.vario.stop(); this.whoosh.update(0, 0, false);
    p.vehicle = this.chuteVeh; p.pose = 'balance';
    this._toast('Out of the back seat! J opens the parachute.', 3);
    this.camS.init = false;
  }
  bail() {
    const g = this.game, p = g.player, L = this.L, G = L.g, s = G.sim;
    if (!s || s.onGround) return false;
    this.stats.bails++;
    // the glider flies on by itself (we keep simulating it: it is ours until it comes down)
    G.adrift = { t: 0 };
    s.cable = null; this.env.cable = null;
    this._writeRec(G, { pilot: 0, mode: MODE.ADRIFT });
    // out over the side: the glider's velocity, a shove to the left
    const lx = Math.cos(s.h), lz = -Math.sin(s.h);
    L.jump = { x: s.x + lx * 1.2, y: s.y + 0.3, z: s.z + lz * 1.2, vx: s.vx + lx * 2, vy: s.vy + 1.5, vz: s.vz + lz * 2, h: s.h, t: 0, open: 0, opening: false, flare: 0, flareCd: 0, sw: 0, swv: 0 };
    L.phase = 'chute'; L.g = null;
    this.hud.show(false); this.vario.stop(); this.whoosh.update(0, 0, false);
    p.vehicle = this.chuteVeh; p.pose = 'balance'; try { p.character.setPose('balance'); } catch { /* */ }
    this._toast('Canopy off, out you go! J opens the parachute (it opens by itself lower down).', 4);
    this.camS.init = false;
    const a = this._audio(); if (a) a.noise(0.5, { gain: 0.12, freq: 1200, q: 0.5 });
    return true;
  }

  // ------------------------------------------------------------ network
  _onRec(d, o) {
    const k = d && d.k; const G = this.G[k]; if (!G) return;
    const r = NET.cleanRecord(d, k);
    if (!NET.wins(r, G.rec)) return;
    const mine = this.L.g === G && G.sim && !G.adrift;
    G.rec = r;
    if (mine && r.pilot !== this._me()) {
      // somebody else got in first (same generation, lower id) — or took over
      const name = (o && o.name) || 'Someone';
      G.sim = null; this._release();
      this._toast(`${name} got to the ${G.name} glider first.`, 3);
    }
    if (G.adrift && r.by !== this._me()) { G.adrift = null; G.sim = null; }
    if (this.L.phase === 'pax' && this.L.g === G) {
      if (r.pax !== this._me()) { this._release(); this._toast('Someone else is in the back seat.', 3); }
      else if (!r.pilot && (r.mode === MODE.HOME || r.mode === MODE.GROUND)) this._unride('The pilot got out, so do you.');
    }
  }
  _onFly(d, o) {
    const s = NET.decodeFly(d, this._dec || (this._dec = {})); if (!s) return;
    const G = this.G[s.k]; if (!G || (G.sim && this.L.g === G) || (G.sim && G.adrift)) return;
    if (s.gen < G.rec.gen) return;
    if (G.rec.mode !== s.mode && (s.mode === MODE.FLYING || s.mode === MODE.ADRIFT || s.mode === MODE.LAUNCH)) { G.rec.mode = s.mode; G.rec.gen = s.gen; if (s.mode !== MODE.ADRIFT) G.rec.pilot = o ? o.id : G.rec.pilot; }
    const q = PH.qFromHPR(s.h, s.pitch, s.roll, this._qtmp || (this._qtmp = [1, 0, 0, 0]));
    // when it was true: the sender's stamp (shared clock) moved onto our clock by a delay that is fixed at the first
    // message and then only creeps (to follow the two clocks drifting apart) — the samples are spaced exactly as they
    // were flown however unevenly the messages arrive; a millisecond of wobble here would be centimetres of glider
    // (no stamp: the moment it arrived, as before)
    let at = this.clock();
    if (s.t >= 0) {
      const off = at - s.t / 1000;
      if (!(Math.abs(off - G.tOff) < 1.5) || at - G.lastGl > 1.5) G.tOff = off; else G.tOff += (off - G.tOff) * 0.002;
      at = s.t / 1000 + G.tOff;
    }
    G.track.push(at, s, q);
    G.flags = s.flags; G.lastGl = this.clock(); G.remoteV = s.V; G.remoteAb = s.ab;
    G.rec.x = s.x; G.rec.y = s.y; G.rec.z = s.z; G.rec.h = s.h; G.rec.p = s.pitch; G.rec.r = s.roll;
  }
  _onEvent(d, o) {
    if (!d) return;
    const G = this.G[d.k];
    if (d.e === 'boom') this._explode(+d.x, +d.y, +d.z, G, false, d.s | 0);
    else if (d.e === 'splash') this._splash(+d.x, +d.z, 1);
    // riding in the back of it: you go too
    const L = this.L;
    if (G && L.phase === 'pax' && L.g === G) {
      const x = +d.x, y = +d.y, z = +d.z, h = G.rec.h, V = G.remoteV || 20;
      if (d.e === 'boom') this._throw(x, y, z, Math.sin(h) * V, 0, Math.cos(h) * V, h, y - this._ground(x, z), d.s | 0);
      else if (d.e === 'splash') {
        const p = this.game.player; this._release(); p.pos.set(x - Math.cos(h) * 1.5, 0.04, z + Math.sin(h) * 1.5);
        const sw = this.game.swim; if (sw && sw.enter && this.game.worldCollider.isWater(p.pos.x, p.pos.z)) sw.enter({ power: 1 });
        this._toast('Ditched! Out of the back seat and swimming.', 3);
      }
    }
    void o;
  }
  _netUpdate(dt) {
    const n = this.game.net; if (!n || !n.connected) return;
    // late joiners: re-send the records we wrote (and those whose writer has gone, if we are the lowest id here)
    if (n.others.size !== this._known.size || [...n.others.keys()].some((id) => !this._known.has(id))) {
      const fresh = [...n.others.keys()].filter((id) => !this._known.has(id));
      this._known = new Set(n.others.keys());
      if (fresh.length) {
        const me = this._me(), ids = [me, ...n.others.keys()], lowest = Math.min(...ids);
        for (const G of this.G) {
          const r = G.rec, gone = r.by && r.by !== me && !n.others.has(r.by);
          if ((r.by === me || (gone && me === lowest)) && (r.gen || r.mode !== MODE.HOME)) this._send('gr', NET.recMsg(r));
        }
      }
    }
    // a pilot who left mid-flight: their glider is gone (back home, locally)
    for (const G of this.G) {
      const r = G.rec;
      if (r.pilot > 0 && r.pilot !== this._me() && !n.others.has(r.pilot)) { r.pilot = 0; if (r.mode !== MODE.HOME && r.mode !== MODE.GROUND) { r.mode = MODE.HOME; r.x = G.home.x; r.z = G.home.z; r.h = G.home.h; } }
    }
    // 10 Hz flight state for every glider we simulate in the air
    if ((this._netT -= dt) > 0) return;
    this._netT = 0.1;
    for (const G of this.G) {
      const s = G.sim; if (!s) continue;
      const mode = G.adrift ? MODE.ADRIFT : this.L.phase === 'winch' ? MODE.LAUNCH : this.L.phase === 'fly' || this.L.phase === 'landed' ? MODE.FLYING : null;
      if (mode === null) continue;
      const flags = (s.cable ? NET.FLAG.CABLE : 0) | (s.buffet > 0.5 ? NET.FLAG.BUFFET : 0) | (s.onGround ? NET.FLAG.WHEEL : 0);
      // the pose as drawn this frame (between two steps: exactly one step behind the clock), stamped with that moment
      const R = G.rp, o = this._glOut || (this._glOut = { x: 0, y: 0, z: 0, h: 0, pitch: 0, roll: 0, V: 0, ab: 0 });
      o.x = R.x; o.y = R.y; o.z = R.z; o.h = R.h; o.pitch = R.pitch; o.roll = R.roll; o.V = s.V; o.ab = s.ab;
      this._send('gl', NET.encodeFly(G.k, G.rec.gen, mode, o, flags, this._now() - STEP * 1000));
    }
  }

  // ------------------------------------------------------------ crash / ditch / land
  _explode(x, y, z, G, local, seed = 1) {
    const fx = this._fxInit(), cam = this.game.camera.position, d = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
    if (d > 4000) return;
    fx.boom.start(x, y, z, 1, this._ground(x, z), seed, G ? G.trim : 0xc8202a);
    this.stats.booms++;
    // a bang delayed by the distance (sound at 340 m/s), quieter far away; a little camera shake nearby
    const a = this._audio();
    if (a) {
      const when = d / 340, k = clamp(1 - d / 2500, 0.05, 1);
      a.noise(1.6, { gain: 0.55 * k, freq: 180, type: 'lowpass', q: 0.6, when });
      a.tone(48, 1.2, { type: 'sine', gain: 0.35 * k, when });
      a.noise(0.5, { gain: 0.25 * k, freq: 2200, q: 0.5, when: when + 0.02 });
    }
    this.camS.shake = Math.max(this.camS.shake, clamp(1.4 - d / 300, 0, 1.4));
    // people nearby exclaim (nobody is hurt)
    const peds = this.game.pedestrians;
    if (peds && peds.near) {
      try {
        const list = peds.near(x, z, 70, this._pedTmp || (this._pedTmp = []));
        let n = 0;
        for (const q of list) { if (n >= 3) break; const ch = q.character; if (ch && ch.say) { ch.say(PED_LINES[(seed + n * 3) % PED_LINES.length], 3); n++; } }
      } catch { /* */ }
    }
    void local;
  }
  _splash(x, z, power) {
    const sw = this.game.swim;
    if (sw && sw.fx && sw.fx.splash) { try { sw.fx.splash(x, z, power); } catch { /* */ } }
    const a = this._audio(); if (a) a.noise(0.9, { gain: 0.3 * power, freq: 700, type: 'lowpass', q: 0.5 });
  }
  /** the local glider hits something */
  _crash(G, what) {
    const g = this.game, p = g.player, s = G.sim, L = this.L;
    const seed = Math.floor(this._now() / 1000) % 1000 + G.k * 7;
    this.stats.crashes++;
    this.stats.lastCrash = { what, x: Math.round(s.x), z: Math.round(s.z), agl: +s.agl.toFixed(1), V: +s.V.toFixed(1), vy: +s.vy.toFixed(1), pitch: +(s.pitch / D2R).toFixed(0), roll: +(s.roll / D2R).toFixed(0), touchVy: s.touchVy };
    this._explode(s.x, s.y, s.z, G, true, seed);
    this._send('ge', { k: G.k, e: 'boom', x: +s.x.toFixed(1), y: +s.y.toFixed(1), z: +s.z.toFixed(1), s: seed });
    this._writeRec(G, { pilot: 0, pax: 0, mode: MODE.WRECK, x: s.x, y: s.y, z: s.z, h: s.h, p: 0, r: 0 });
    const wasLocal = L.g === G && !G.adrift;
    const vx = s.vx, vy = s.vy, vz = s.vz, x = s.x, y = s.y, z = s.z, h = s.h, agl = s.agl;
    G.sim = null; G.adrift = null;
    if (!wasLocal) return;
    this._throw(x, y, z, vx, vy, vz, h, agl, seed);
    this.hud.show(false); this.vario.stop(); this.whoosh.update(0, 0, false);
    this.camS.init = false;
    void what;
  }
  /** the local player thrown clear of an explosion at (x, y, z): the parachute high up, a comic tumble low down */
  _throw(x, y, z, vx, vy, vz, h, agl, seed) {
    const g = this.game, p = g.player, L = this.L;
    const line = CRASH_LINES[seed % CRASH_LINES.length];
    if (this.fx) this.fx.boom.smoulder(60);                // singed: wisps of smoke off the pilot for a minute
    // the pilot is thrown clear: high up the parachute opens by itself; low down a comic tumble onto the grass
    if (agl > 70) {
      L.jump = { x, y: y + 2, z, vx: -vx * 0.1, vy: 6, vz: -vz * 0.1, h, t: 1, open: 0, opening: true, flare: 0, flareCd: 0, sw: 0, swv: 0 };
      L.phase = 'chute'; L.g = null; p.vehicle = this.chuteVeh; p.pose = 'balance';
      this._toast(`${line} The parachute pops open.`, 4);
    } else {
      // thrown back and up out of the fireball, land at a free spot nearby
      const col = g.worldCollider, back = Math.atan2(-vx, -vz);
      let tx = x, tz = z;
      for (let r = 10; r < 60; r += 4) {
        let ok = false;
        for (let i = 0; i < 12; i++) {
          const a = back + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5, xx = x + Math.sin(a) * r, zz = z + Math.cos(a) * r;
          if ((!col || (col.isFree(xx, zz, 0.4) && !col.isWet(xx, zz))) && inMap(g, xx, zz) && !(this.obs && this.obs.roofAt(xx, zz))) { tx = xx; tz = zz; ok = true; break; }
        }
        if (ok) break;
      }
      L.thrown = { t: 0, T: 1.3, x0: x, y0: Math.max(y, this._ground(x, z) + 1), z0: z, x1: tx, z1: tz, y1: this._ground(tx, tz) };
      L.phase = 'thrown'; L.g = null;
      p.vehicle = this.chuteVeh; p.pose = 'fall';
      try { p.character.setPose('fall', { forward: true }); } catch { /* */ }
      this._toast(line, 4);
    }
    this.hud.show(false); this.vario.stop(); this.whoosh.update(0, 0, false);
    this.camS.init = false;
    void vy;
  }
  _ditch(G) {
    const g = this.game, p = g.player, s = G.sim, L = this.L;
    this.stats.ditches++;
    this._splash(s.x, s.z, 1.2);
    this._send('ge', { k: G.k, e: 'splash', x: +s.x.toFixed(1), y: 0, z: +s.z.toFixed(1) });
    this._writeRec(G, { pilot: 0, pax: 0, mode: MODE.DITCHED, x: s.x, y: 0, z: s.z, h: s.h, p: -0.08, r: 0.12 });
    const wasLocal = L.g === G && !G.adrift;
    G.sim = null; G.adrift = null;
    if (!wasLocal) return;
    const x = s.x, z = s.z;
    this._release('stand');
    p.pos.set(x + Math.cos(s.h) * 1.5, 0.04, z - Math.sin(s.h) * 1.5);
    const sw = g.swim;
    if (sw && sw.enter && g.worldCollider.isWater(p.pos.x, p.pos.z) && sw.enter({ power: 1 })) this._toast('Ditched! The glider settles into the river and you swim for it.', 4);
    else { p.pos.set(x, 0, z); this._toast('Ditched! Soggy, but alive.', 3); }
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, p = g.player, L = this.L;
    this.t += dt;
    if (!g.map || !g.world) return;
    const cam = g.camera.position, tMs = this._now();
    this._airT = null;
    // anything to do at all? (in town, on the ground, nobody flying: a few comparisons and out)
    const sc = SITE.centre, dSite = Math.hypot(cam.x - sc[0], cam.z - sc[1]);
    let busy = !!L.phase || dSite < NEAR_SITE;
    for (const G of this.G) if (G.sim || G.rec.mode !== MODE.HOME || G.lastGl > this.clock() - 3) busy = true;
    if (this.fx && (this.fx.boom.active)) busy = true;
    if (g.net && g.net.others) for (const o of g.net.others.values()) if (o.pose === 'hang' || o.pose === 'balance') { busy = true; break; }
    if (!busy) { this._netUpdate(dt); if (!this.idle) this._sleep(); return; }
    this.idle = false;
    if (this._reliefIn && --this._reliefIn === 0) { try { this.air.relief = this.obs.relief(g.map.bounds); } catch (e) { console.error('[gliding] relief', e); } }
    this._hookCamera();
    if (!this.ready) { this._warm(); this._warmStep(); }
    else if (!this._airW && (L.phase || distToField(cam.x, cam.z) < AIR_WARM_R)) {
      // the aerial warm-up (world.warmAerial: first draws paced a GPU fence apart, a few MB of uploads a frame) once the
      // player is near the field itself or a flight begins, not from 1.8 km out (University Parks)
      this._airW = true; const w = g.world; if (w && w.warmAerial) w.warmAerial();
    }
    // records that time out on the shared clock (everyone computes the same)
    for (const G of this.G) {
      const r = G.rec; if (r.pilot || G.sim) continue;
      const age = tMs - (r.at || 0);
      const back = (r.mode === MODE.WRECK && age > WRECK_MS) || (r.mode === MODE.DITCHED && age > DITCH_MS) || (r.mode === MODE.GROUND && age > (inField(r.x, r.z) ? FIELD_MS : LANDOUT_MS)) || ((r.mode === MODE.FLYING || r.mode === MODE.ADRIFT || r.mode === MODE.LAUNCH) && G.lastGl < this.clock() - 6 && age > 6000);
      if (back) { r.mode = MODE.HOME; r.x = G.home.x; r.z = G.home.z; r.h = G.home.h; r.p = 0; r.r = 0; r.y = 0; }
    }
    // ---- simulate (local pilot + adrift gliders we own), then tell the others (the pose just worked out)
    this._simulate(dt);
    this._airT = null;
    this._netUpdate(dt);
    // ---- parachute / thrown pilot
    if (L.phase === 'chute') this._chute(dt);
    else if (L.phase === 'thrown') this._thrownUpdate(dt);
    // ---- the player in the cockpit
    if (L.g && L.g.sim) this._seat(L.g);
    // ---- visuals (once everything they draw with is compiled)
    if (this.ready) this._visuals(dt, cam, dSite);
    else for (const G of this.G) if (G.vis && G.vis.group.parent) G.vis.group.removeFromParent();
    if (this.fx && this.fx.boom.wisps) { const pp = p.pos; this.fx.boom.wispAt(pp.x, pp.y + 1.62, pp.z); }
    if (L.phase === 'pax' && L.g) this._paxSeat(L.g, dt);
    // ---- aerial rendering + camera planes while the local player is up there
    const up = L.phase === 'fly' || L.phase === 'winch' || L.phase === 'chute' || (L.phase === 'pax' && cam.y > 15);
    if (g.world.setAerial) g.world.setAerial(up || ((L.phase === 'seated' || L.phase === 'landed') && cam.y > 30));
    // ---- HUD + vario
    const G = L.g;
    if (G && G.sim) {
      const s = G.sim, W = this.air.weather;
      if ((this._hudT = (this._hudT || 0) - dt) <= 0) { this._hudT = 1 / 15; this.hud.draw(s, { wind: { dir: W.dir, speed: W.speed }, heading: s.h, cable: !!s.cable, alt: s.agl }); }
      this.hud.prompt(this._promptText(G));
      this.vario.update(dt, s.te, !s.onGround);
      this.whoosh.update(s.V, s.ab, s.V > 3, L.cam === 'cockpit');
      this.veh.x = G.rp.x; this.veh.z = G.rp.z; this.veh.heading = G.rp.h; this.veh.speed = 0;
    }
  }
  _sleep() {
    this.idle = true;
    const fx = this.fx;
    if (fx) { fx.clouds.hide(); fx.birds.update([], 0, null, false); fx.country.update(this.game.camera.position, false); fx.cables.forEach((c) => c.hide()); fx.lights.update(0, false); fx.shadows.forEach((q) => q.hide()); }
    const w = this.game.world; if (w && w.uniforms && w.uniforms.air) w.uniforms.air.value.z = 0;
    for (const G of this.G) if (G.vis && G.vis.group.parent) G.vis.group.removeFromParent();
  }
  _promptText(G) {
    const L = this.L, s = G.sim;
    if (L.phase === 'seated') return this._atLaunch(G) ? '[L] Winch launch   ·   [F] Get out   ·   [H] Controls' : '[F] Get out';
    if (L.phase === 'winch') return s.cable ? (s.onGround ? 'Ground run…' : 'On the winch: the climb is flown for you — [R] release') : '';
    if (L.phase === 'landed') return inField(s.x, s.z) ? '[F] Get out' : '[F] Get out   ·   [E] Call for a retrieve';
    if (s.stall > 0.5) return 'STALL — ease the stick forward (W)';
    if (s.V > PH.GLIDER.vne * 0.92) return 'Too fast! Ease back, airbrakes out';
    return '';
  }

  /**
   * The keys → the stick, inside the fixed step (dt = STEP). Each axis follows its key through a critically damped
   * spring, so nothing kinks when a key goes down or comes up. Roll: A / D ask for a bank (45°, eased) and the ailerons
   * are worked to reach and hold it, at whatever roll rate the glider has at this airspeed; hands off asks for wings
   * level. L.direct: the keys are the ailerons themselves.
   */
  _controls(dt, s) {
    const g = this.game, inp = g.input, c = this.L.ctl, ok = !g.input.typing && !g.activity && !(g.ui && g.ui.inDialog);
    const d = (k) => ok && inp.down(k);
    const tp = (d('KeyS') || d('ArrowDown') ? 1 : 0) - (d('KeyW') || d('ArrowUp') ? 1 : 0);
    const tr = (d('KeyD') || d('ArrowRight') ? 1 : 0) - (d('KeyA') || d('ArrowLeft') ? 1 : 0);
    const ty = (d('KeyE') ? 1 : 0) - (d('KeyQ') && !inp.down('ShiftLeft') && !inp.down('ShiftRight') ? 1 : 0);
    let w = tp !== 0 ? 7.5 : 9.5;                       // back to centre a little quicker than out
    c.pv += ((tp - c.pitch) * w * w - 2 * w * c.pv) * dt; c.pitch += c.pv * dt;
    w = 9; c.yv += ((ty - c.yaw) * w * w - 2 * w * c.yv) * dt; c.yaw += c.yv * dt;
    if (this.L.direct) {
      w = tr !== 0 ? 8 : 10; c.rv += ((tr - c.roll) * w * w - 2 * w * c.rv) * dt; c.roll += c.rv * dt;
      c.bank = s.roll; c.bv = 0;
    } else {
      w = 3.4; const want = s.onGround ? 0 : tr * BANK;
      c.bv += ((want - c.bank) * w * w - 2 * w * c.bv) * dt; c.bank += c.bv * dt;
      // a pilot's hands: aileron towards the bank asked for, eased off as the roll rate builds
      c.roll = clamp(3.2 * (c.bank - s.roll) - 0.55 * s.p, -1, 1);
    }
    c.ab = d('Space') ? 1 : 0; c.brake = s.onGround && d('Space') ? 1 : 0;
    return c;
  }

  _simulate(dt) {
    const L = this.L, now = this._now();
    for (const G of this.G) {
      const s = G.sim; if (!s) continue;
      const mine = L.g === G && !G.adrift;
      if (mine && L.phase === 'seated') { // sitting on the grass: no simulation needed
        const c = L.ctl; c.pitch = c.roll = c.yaw = c.ab = c.pv = c.rv = c.yv = c.bank = c.bv = 0; c.brake = 1;
        G._acc = 0; s.V = 0; s.te = 0; PH.syncPose(s); PH.renderPose(s, 1, G.rp); continue;
      }
      let c = null;
      if (!mine) {
        // adrift: hands off; a slow wing drop winds it into a spiral (an abandoned glider rarely lands itself)
        c = this._adC || (this._adC = { pitch: 0, roll: 0, yaw: 0, ab: 0, brake: 0, autoRudder: true, turnAssist: 0 });
      }
      // whole steps of the time that has passed; what is left over (acc) is how far between the last two steps the
      // picture is. A frame longer than MAX_STEPS steps slows time rather than leaving a debt to be run off later.
      let acc = Math.min((G._acc || 0) + dt, STEP * MAX_STEPS), ev = 0;
      const ctl = this._stepC || (this._stepC = {});
      while (acc >= STEP - 1e-9) {                       // (1e-9: thirty 1/30 s frames are exactly 120 steps, whatever the rounding)
        acc = Math.max(0, acc - STEP);
        this._airT = now - acc * 1000;
        if (mine) c = this._controls(STEP, s);
        else { G.adrift.t += STEP; c.roll = G.adrift.t > 2.5 ? 0.12 : 0; c.pitch = 0; }
        ctl.pitch = c.pitch; ctl.roll = c.roll; ctl.yaw = c.yaw; ctl.ab = c.ab; ctl.brake = c.brake; ctl.autoRudder = c.autoRudder; ctl.turnAssist = c.turnAssist; ctl.assist = mine && L.direct ? 0 : 1; ctl.release = false;
        if (mine && s.cable) { if (!s.onGround && !s.liftT) s.liftT = L.t; ctl.pitch = PH.winchAssist(s, L.t, c.pitch); ctl.release = this._wantRelease; ctl.turnAssist = 0.5; }
        ev |= PH.step(s, ctl, STEP, this.env);
        if (mine) L.t += STEP;
        this.stats.steps++;
        if (ev & PH.EV.RELEASE) { this._wantRelease = false; this.env.cable = mine ? null : this.env.cable; }
        const hit = this._collide(G, s, ev);
        if (hit) { G._acc = 0; this._airT = null; return; }
        ev &= ~(PH.EV.TOUCH);
      }
      G._acc = acc;
      if (!G.sim) continue;
      PH.renderPose(s, acc / STEP, G.rp);
      if (mine) {
        if (ev & PH.EV.RELEASE) { L.phase = 'fly'; this._writeRec(G, { mode: MODE.FLYING }); this._toast(`Released at ${Math.round(s.agl * 3.28)} ft. Find a thermal: circle where the vario beeps.`, 4); G.cableDrop = { t: 0, x: s.x, y: s.y, z: s.z }; const a = this._audio(); if (a) a.tone(900, 0.06, { type: 'square', gain: 0.05 }); }
        if (L.phase === 'winch' && !s.cable && !(ev & PH.EV.RELEASE)) L.phase = 'fly';
        // landed: stopped on the ground
        if (L.phase === 'fly' && s.onGround) { const sp = Math.hypot(s.vx, s.vz); L.still = sp < 0.6 ? L.still + dt : 0; if (L.still > 1.2) { L.phase = 'landed'; this.stats.landings++; this._writeRec(G, { mode: MODE.GROUND, x: s.x, z: s.z, h: s.h }); this._toast(inField(s.x, s.z) ? 'Nice landing.' : 'Landed out! F to get out, E to call for a retrieve.', 3.5); } }
        else if (L.phase === 'landed' && !s.onGround) { L.phase = 'fly'; this._writeRec(G, { mode: MODE.FLYING }); }
        if (G.cableDrop) { G.cableDrop.t += dt; if (G.cableDrop.t > 25) G.cableDrop = null; }
      }
    }
    this._airT = null;
  }
  /** collisions of glider G: buildings / trees / hard ground / water / walls. True if the glider is gone. */
  _collide(G, s, ev) {
    const g = this.game, col = g.worldCollider;
    this._obs();
    const O = this.obs;
    // water: on (or skimming) the surface over a river or lake -> ditch, never an explosion
    if (s.agl < 0.9 && col.isWet(s.x, s.z)) { this._ditch(G); return true; }
    // touchdown too hard / too fast / nose-in / wing-in
    if (ev & PH.EV.TOUCH) {
      const hard = s.touchVy < -4.8 || s.touchV > 46 || s.pitch < -14 * D2R || Math.abs(s.roll) > 28 * D2R;
      if (hard) { this._crash(G, 'hard landing'); return true; }
      if (s.touchVy < -2.2 && this.L.g === G && !G.adrift) {
        // a firm arrival: the wheel takes it, the camera thumps, the instructor would have said something
        this.camS.shake = Math.max(this.camS.shake, clamp(-s.touchVy / 9, 0.2, 0.5));
        const a = this._audio(); if (a) a.noise(0.25, { gain: 0.16, freq: 140, type: 'lowpass', q: 0.7 });
        if (!(this._firmT > this.t - 6)) { this._firmT = this.t; this._toast(s.touchVy < -3.4 ? 'Crump. That was an arrival, not a landing — round out sooner.' : 'A firm one. Ease the stick back just before the wheel touches.', 3); }
      }
    }
    if (!s.onGround && s.agl < 0.2 && (s.vy < -6 || Math.abs(s.roll) > 50 * D2R)) { this._crash(G, 'ground'); return true; }
    // buildings / trees: the nose, both wing tips and the fin
    const q = s.q, P = this._tmpA;
    for (const [bx, by, bz] of PROBES) {
      PH.qRotate(q, bx, by, bz, P);
      const x = s.x + P[0], y = s.y + P[1], z = s.z + P[2];
      const hit = O.at(x, y, z);
      if (hit) { this._crash(G, hit); return true; }
      if (y < this._ground(x, z) - 0.05 && (bx !== 0 || bz !== 0)) {
        if (s.onGround && Math.abs(bx) > 1 && s.V < 22) continue;           // a wing tip on the grass during the ground run
        if (!s.onGround && s.V > 14 && Math.abs(bx) > 1) { this._crash(G, 'ground'); return true; }
      }
    }
    // low down: walls, hedges, fences and buildings the footprints do not know (place modules) — the 2D collider
    if (s.agl < 2.2 && col) {
      const p = this._pp || (this._pp = { x: 0, z: 0 }); p.x = s.x; p.z = s.z;
      const bounds = col.bounds; col.bounds = null;
      const hitWall = col.resolve(p, 0.9, { ignoreLow: s.agl > 0.6 });
      col.bounds = bounds;
      if (hitWall) {
        const sp = Math.hypot(s.vx, s.vz);
        if (sp > 15) { this._crash(G, 'wall'); return true; }
        // a slow bump: stop against it
        s.x = p.x; s.z = p.z; s.vx *= -0.1; s.vz *= -0.1;
        if (sp > 3) this._toast('Into the hedge. Embarrassing, but nothing broken.', 2.5);
      }
    }
    // mid-air with the other glider (remote position)
    for (const H of this.G) {
      if (H === G || !H.vis) continue;
      const v = H.vis.group.position; if (!H.vis.group.parent) continue;
      if (Math.abs(v.x - s.x) < 6 && Math.abs(v.z - s.z) < 6 && Math.abs(v.y - s.y) < 2.5 && !(H.rec.mode === MODE.HOME || H.rec.mode === MODE.GROUND) && !s.onGround) { this._crash(G, 'glider'); return true; }
    }
    return false;
  }

  // ------------------------------------------------------------ riding in the back
  _paxSeat(G, dt) {
    const g = this.game, p = g.player, R = G.rs, P = this._tmpA;
    if (!R || !R.q) return;
    const r = G.rec, flying = r.mode === MODE.FLYING || r.mode === MODE.LAUNCH || r.mode === MODE.ADRIFT;
    let x = R.x, y = R.y, z = R.z, q = R.q;
    if (!flying || G.lastGl < this.clock() - 1) { x = r.x; z = r.z; y = this._ground(x, z) + DIM.wheelH; q = PH.qFromHPR(r.h, 0.026, 0, this._qp || (this._qp = [1, 0, 0, 0])); }
    this._paxQ = q; this._paxP = [x, y, z];
    PH.qRotate(q, DIM.seatRear[0], DIM.seatRear[1] - 0.45, DIM.seatRear[2], P);
    p.pos.set(x + P[0], y + P[1], z + P[2]); p.worldPos.copy(p.pos);
    PH.hprOf(q, this._hpr || (this._hpr = {})); p.heading = this._hpr.h;
    const grp = p.character.group; grp.position.copy(p.pos); grp.quaternion.set(q[1], q[2], q[3], q[0]); grp.visible = this.L.cam !== 'cockpit';
    // instruments from the pilot's flight state (a little lag: what the rear-seat panel would show)
    const H = this._paxH || (this._paxH = { V: 0, agl: 0, te: 0, beta: 0, ab: 0, trimV: 25, stall: 0, buffet: 0, y0: y });
    const climb = dt > 0 ? (y - H.y0) / dt : 0; H.y0 = y;
    H.te += (climb - H.te) * Math.min(1, dt * 1.2); H.V = G.remoteV || 0; H.agl = y - this._ground(x, z) - DIM.wheelH; H.ab = G.remoteAb || 0;
    H.buffet = G.flags & NET.FLAG.BUFFET ? 1 : 0;
    if ((this._hudT = (this._hudT || 0) - dt) <= 0) { this._hudT = 1 / 15; this.hud.draw(H, { alt: H.agl, cable: !!(G.flags & NET.FLAG.CABLE) }); }
    const ground = r.mode === MODE.HOME || r.mode === MODE.GROUND || ((G.flags & NET.FLAG.WHEEL) && H.V < 1.5);
    this.hud.prompt(ground ? '[F] Get out   ·   [C] View' : '[J] Bail out   ·   [C] View');
    this.vario.update(dt, H.te, flying && H.agl > 1);
    this.whoosh.update(H.V, H.ab, flying, this.L.cam === 'cockpit');
  }

  // ------------------------------------------------------------ the pilot in the cockpit
  _seat(G) {
    const p = this.game.player, s = G.rp, P = this._tmpA;
    PH.qRotate(s.q, DIM.seatFront[0], DIM.seatFront[1] - 0.45, DIM.seatFront[2], P);
    p.pos.set(s.x + P[0], s.y + P[1], s.z + P[2]); p.heading = s.h; p.worldPos.copy(p.pos);
    const grp = p.character.group;
    grp.position.copy(p.pos);
    this._q.set(s.q[1], s.q[2], s.q[3], s.q[0]); grp.quaternion.copy(this._q);
    grp.visible = this.L.cam !== 'cockpit';
  }

  // ------------------------------------------------------------ parachute
  _chute(dt) {
    const g = this.game, p = g.player, L = this.L, J = L.jump, inp = g.input;
    J.t += dt;
    const gy = this._ground(J.x, J.z), O = this._obs();
    const roof = O.roofAt(J.x, J.z), floor = roof && roof.top > gy ? roof.top : gy;
    const agl = J.y - floor;
    if (!J.opening && J.open === 0 && (agl < 230 || J.t > 9)) J.opening = true;
    if (J.opening && J.open < 1) J.open = Math.min(1, J.open + dt / 2.2);
    const ok = !inp.typing;
    const turn = ((ok && (inp.down('KeyD') || inp.down('ArrowRight'))) ? -1 : 0) + ((ok && (inp.down('KeyA') || inp.down('ArrowLeft'))) ? 1 : 0);
    const fwd = ((ok && (inp.down('KeyW') || inp.down('ArrowUp'))) ? 1 : 0) - ((ok && (inp.down('KeyS') || inp.down('ArrowDown'))) ? 1 : 0);
    const w = this.env.wind(J.x, J.y, J.z, this._tmpA);
    if (J.open < 0.3) {
      // freefall (belly to earth): drag to ~50 m/s terminal, a little steering
      const vrx = J.vx - w[0], vry = J.vy, vrz = J.vz - w[2], v = Math.hypot(vrx, vry, vrz) || 1, k = 9.81 / 2500;
      J.vx -= k * v * vrx * dt; J.vy += (-9.81 - k * v * vry) * dt; J.vz -= k * v * vrz * dt;
      J.h += turn * 1.4 * dt;
      J.vx += Math.sin(J.h) * fwd * 3 * dt; J.vz += Math.cos(J.h) * fwd * 3 * dt;
    } else {
      // under the canopy: ~4.5 m/s down (round emergency canopy), drifting with the wind, steerable, flare to land
      J.h += turn * 0.7 * dt;
      if (ok && inp.hit('Space') && J.flareCd <= 0) { J.flare = 1.4; J.flareCd = 4; }
      J.flare = Math.max(0, J.flare - dt); J.flareCd -= dt;
      const drift = 1.6 + fwd * 1.2, sink = (J.flare > 0 ? 1.8 : 4.6) + 6 * (1 - J.open);
      const tx = w[0] + Math.sin(J.h) * drift, tz = w[2] + Math.cos(J.h) * drift;
      const k = Math.min(1, dt * 2.2);
      J.vx += (tx - J.vx) * k; J.vz += (tz - J.vz) * k; J.vy += (-sink - J.vy) * Math.min(1, dt * 3);
      // pendulum swing after opening / in turns
      J.swv += (-J.sw * 6 - J.swv * 1.6 + turn * 1.2) * dt; J.sw += J.swv * dt;
    }
    J.x += J.vx * dt; J.y += J.vy * dt; J.z += J.vz * dt;
    // hit a building on the way down (side): slide down its wall
    const hb = O.at(J.x, J.y - 1, J.z);
    if (hb === 'building' && !(roof && J.y > roof.top - 1)) { J.vx *= -0.3; J.vz *= -0.3; }
    p.pos.set(J.x, J.y - 1.6, J.z); p.heading = J.h; p.worldPos.copy(p.pos);
    p.pose = J.open > 0.3 ? 'hang' : 'balance';
    try { p.character.setPose(p.pose); } catch { /* */ }
    const grp = p.character.group; grp.position.copy(p.pos); grp.rotation.set(J.open > 0.3 ? J.sw * 0.6 : 1.2, J.h, 0, 'YXZ'); grp.visible = true;
    const fx = this._fxInit();
    if (!fx.chute.group.parent && this.ready) g.worldScene.add(fx.chute.group);
    fx.chute.set(J.open, J.x, J.y, J.z, J.h, J.sw * 0.6, 0, J.flare > 0 ? 1 : 0, this.t);
    this.vario.stop();
    // landing
    const col = g.worldCollider;
    if (J.y - 1.6 <= floor + 0.02) {
      const wet = !roof && col && col.isWet(J.x, J.z);
      const hard = J.vy < -6.5;
      fx.chute.group.removeFromParent();
      grp.rotation.set(0, J.h, 0);
      if (wet) {
        this._release('stand'); p.pos.set(J.x, 0.04, J.z);
        const sw = g.swim; if (sw && sw.enter && sw.enter({ power: 0.8 })) this._toast('Splashdown! Out of the harness and swimming.', 3.5);
        return;
      }
      if (roof && roof.top > gy + 2) {
        // on a roof: you can't walk about up there — slither down to the street
        const spot = this._streetNear(J.x, J.z, roof);
        this._release('stand');
        p.pos.set(spot[0], this._ground(spot[0], spot[1]), spot[1]); p.syncMesh && p.syncMesh();
        this._toast('You land on a roof... and slither down the drainpipe to the street.', 4);
        if (g.ui && g.ui.fade) g.ui.fade(() => {});
        return;
      }
      this._release(hard ? 'fall' : 'stand');
      p.pos.set(J.x, gy, J.z); p.syncMesh && p.syncMesh();
      if (!inMap(g, J.x, J.z)) { this._toast('You land in a farmer\'s field miles out. A kind tractor driver gives you a lift back.', 5); const x = SITE.homes[0].x - 10, z = SITE.homes[0].z - 10; if (g.ui && g.ui.fade) g.ui.fade(() => p.teleport(x, z, 0)); else p.teleport(x, z, 0); return; }
      this._toast(hard ? 'Thump! A heavy landing — roll, and up you get.' : 'Feet together, knees bent... textbook parachute landing.', 3);
    }
  }
  _streetNear(x, z, roof) {
    const col = this.game.worldCollider;
    for (let r = 4; r < 120; r += 3) for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, xx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r;
      if (roof && pip(xx, zz, roof.poly)) continue;
      if (this.obs.roofAt(xx, zz)) continue;
      if (!col || (col.isFree(xx, zz, 0.4) && !col.isWet(xx, zz))) return [xx, zz];
    }
    return [x + 20, z];
  }
  _thrownUpdate(dt) {
    const g = this.game, p = g.player, L = this.L, T = L.thrown;
    T.t += dt;
    const u = Math.min(1, T.t / T.T), x = T.x0 + (T.x1 - T.x0) * u, z = T.z0 + (T.z1 - T.z0) * u;
    const y = T.y0 + (T.y1 - T.y0) * u + 9 * u * (1 - u) * 1.6;
    p.pos.set(x, y, z); p.worldPos.copy(p.pos);
    const grp = p.character.group; grp.position.copy(p.pos); grp.rotation.set(u * TAU * 1.5, p.heading, 0, 'YXZ'); grp.visible = true;
    if (u >= 1) {
      this._release('fall');
      try { p.character.setPose('fall', { forward: false }); } catch { /* */ }
      p.pos.set(T.x1, T.y1, T.z1); p.syncMesh && p.syncMesh();
    }
  }

  // ------------------------------------------------------------ visuals
  _visuals(dt, cam, dSite) {
    const g = this.game, fx = this._fxInit(), nowS = this.clock();
    const tMs = this._now(), hour = g.time.hour, hide = this._hide || (this._hide = new Set());
    hide.clear();
    for (const G of this.G) {
      const r = G.rec;
      // where is it, and how is it sitting?
      let x, y, z, qq = null, flying = false, ab = 0, V = 0, ctl = G.ctl;
      if (G.sim) {
        const s = G.sim, R = G.rp; x = R.x; y = R.y; z = R.z; qq = R.q; flying = !s.onGround || this.L.phase === 'winch'; ab = s.ab; V = s.V;
        const c = this.L.g === G ? this.L.ctl : null;
        // (the wing bends with the load, eased, and trembles in the buffet before the stall)
        G.flex = (G.flex || 0) + (((s.nz || 1) - 1) - (G.flex || 0)) * (1 - Math.exp(-dt * 9));
        ctl.ail = c ? c.roll : 0; ctl.elev = c ? c.pitch : 0; ctl.rud = c ? c.yaw : 0; G.buf = (G.buf || 0) + (s.buffet - (G.buf || 0)) * (1 - Math.exp(-dt * 5)); ctl.flex = G.flex + 0.3 * G.buf * Math.sin(this.t * 29);
        ctl.V = s.V; ctl.alt = s.agl; ctl.te = s.te; ctl.beta = s.beta; ctl.t = this.t;     // the dials and the yaw string
      } else if ((r.mode === MODE.FLYING || r.mode === MODE.ADRIFT || r.mode === MODE.LAUNCH) && G.track.sample(nowS - NET.DELAY, G.rs)) {
        x = G.rs.x; y = G.rs.y; z = G.rs.z; qq = G.rs.q; flying = true; ab = G.rs.ab; V = G.rs.V;
        ctl.ail = 0; ctl.elev = 0; ctl.rud = 0; ctl.flex = 0.1; ctl.V = G.rs.V || 0; ctl.alt = y; ctl.te = 0; ctl.beta = 0; ctl.t = this.t;
      } else {
        x = r.x; z = r.z;
        const gy = this._ground(x, z);
        if (r.mode === MODE.WRECK) { if (G.vis && G.vis.group.parent) G.vis.group.removeFromParent(); continue; }
        if (r.mode === MODE.DITCHED) { y = 0.15; qq = PH.qFromHPR(r.h, -0.08, 0.12, this._qd || (this._qd = [1, 0, 0, 0])); }
        else { y = gy + DIM.wheelH; qq = PH.qFromHPR(r.h, 0.026, r.mode === MODE.HOME || r.mode === MODE.GROUND ? this._parkRoll(G) : 0, this._qh || (this._qh = [1, 0, 0, 0])); }
        ctl.ail = ctl.elev = ctl.rud = ctl.flex = 0; ctl.V = 0; ctl.alt = 0; ctl.te = 0; ctl.beta = 0; ctl.t = this.t;
      }
      const d = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
      const want = d < 3200 && (flying || dSite < NEAR_SITE || d < 1500);
      // a soft contact shadow under it on (or just above) the grass, by day
      const gyS = this._ground(x, z), aglS = y - gyS - DIM.wheelH, sh = fx.shadows[G.k];
      if (want && aglS < 7 && d < 400 && r.mode !== MODE.DITCHED) { PH.hprOf(qq, this._hprS || (this._hprS = {})); sh.set(x, gyS, z, this._hprS.h, Math.max(0, aglS), 1 - g.world.night); } else sh.hide();
      if (!want) { if (G.vis && G.vis.group.parent) G.vis.group.removeFromParent(); continue; }
      if (!G.vis) this._models();
      const grp = G.vis.group;
      if (!grp.parent) g.worldScene.add(grp);
      grp.position.set(x, y, z); grp.quaternion.set(qq[1], qq[2], qq[3], qq[0]);
      ctl.ab = ab; ctl.lod = d > 180 ? 1 : 0; ctl.cockpit = this.L.g === G && this.L.cam === 'cockpit' && (this.L.phase !== 'pax' || !!G.rs);
      poseModel(G.vis.parts, ctl);
      // seated figures for other people's gliders; the local pilot is their own character
      const iPilot = this.L.g === G && this.L.phase !== 'pax', me = this._me(), sitting = r.mode !== MODE.ADRIFT && r.mode !== MODE.WRECK && r.mode !== MODE.DITCHED;
      G.vis.parts.dummyFront.visible = !iPilot && r.pilot > 0 && sitting;
      G.vis.parts.dummyRear.visible = r.pax > 0 && r.pax !== me && sitting;
      if (r.pax > 0 && sitting) hide.add(r.pax);
      if (r.pilot > 0 && (r.mode === MODE.FLYING || r.mode === MODE.LAUNCH || r.mode === MODE.HOME || r.mode === MODE.GROUND)) hide.add(r.pilot);
      // the winch cable
      const cab = fx.cables[G.k], hooked = G.sim ? !!G.sim.cable : !!(G.flags & NET.FLAG.CABLE) && r.mode === MODE.LAUNCH;
      if (hooked) {
        const W = SITE.winch, P = this._tmpA; PH.qRotate(qq, 0, -0.45, 1.2, P);
        cab.set(W[0], 1.6, W[1] + (G.k ? 6 : -6), x + P[0], y + P[1], z + P[2], 0, false);
        G.wasHooked = true;
      } else if (G.wasHooked) {
        // released: the cable end drops under its little drogue chute while the winch reels it in
        G.cd = G.cd || { t: 0, x, y, z }; G.cd.t += dt;
        const W = SITE.winch, u = Math.min(1, G.cd.t / 18), ex = G.cd.x + (W[0] - G.cd.x) * u, ez = G.cd.z + (W[1] + (G.k ? 6 : -6) - G.cd.z) * u, ey = Math.max(1, G.cd.y - G.cd.t * 6);
        cab.set(W[0], 1.6, W[1] + (G.k ? 6 : -6), ex, ey, ez, 0.6, true);
        if (u >= 1) { G.wasHooked = false; G.cd = null; cab.hide(); }
      } else cab.hide();
      void V;
    }
    // other players sitting in a glider: their own character is hidden (the glider carries a seated figure)
    if (g.net && g.net.others) for (const o of g.net.others.values()) if (o.character) { const v = !hide.has(o.id); if (o.character.group.visible !== v) o.character.group.visible = v; }
    // remote parachutists (pose 'hang' up in the air): a canopy over them, from the ordinary player state
    let rc = 0;
    if (g.net && g.net.others) for (const o of g.net.others.values()) {
      if (rc >= fx.rchutes.length || o.place !== 'world' || o.pose !== 'hang') continue;
      if (o.y < this._ground(o.x, o.z) + 0.8) continue;
      const ch = fx.rchutes[rc++];
      if (!ch.group.parent) g.worldScene.add(ch.group);
      ch.set(1, o.x, o.y + 1.6, o.z, o.h, 0, 0);
    }
    for (let i = rc; i < fx.rchutes.length; i++) if (fx.rchutes[i].group.parent) fx.rchutes[i].group.removeFromParent();
    // explosion (its smoke leans with the wind)
    const W = this.air.weather; fx.boom.wind[0] = Math.sin(W.dir) * W.speed * 0.8; fx.boom.wind[1] = -Math.cos(W.dir) * W.speed * 0.8;
    fx.boom.update(dt, g.camera);
    // cumulus + birds over the thermals near the camera (by day, when anyone could see them: flying or at the field)
    const L = this.L, up = !!L.phase || cam.y > 25, dn = diurnal(hour) * this.air.weather.sky, wu = g.world.uniforms;
    if (up && dn > 0.05) {
      if ((this._cloudT = (this._cloudT || 0) - dt) <= 0) { this._cloudT = 1.0; this._near = this.air.near(cam.x, cam.z, 5200, tMs, hour, this._nearList || (this._nearList = [])); }
      // lit side: white warmed by the sun's colour; shade: the horizon sky, darker (blue-grey bases)
      const E = this._cenv || (this._cenv = { sun: new THREE.Vector3(), lit: new THREE.Color(), shade: new THREE.Color(), fade: 1 });
      if (wu) { E.sun.copy(wu.sunDir.value); E.lit.setRGB(1, 1, 1).lerp(wu.sunColor.value, 0.3); E.shade.copy(wu.skyHor.value).multiplyScalar(0.72); }
      E.fade = sstep(0.05, 0.25, dn);
      fx.clouds.update(this._near || [], true, cam, E);
      fx.birds.update(this._near || [], tMs / 1000, cam, true);
    } else { fx.clouds.update([], false); fx.birds.update([], 0, cam, false); }
    // cloud shadows drifting over the city and the fields (the world's aerial material variants and the countryside)
    if (wu && wu.air) { const wx = Math.sin(W.dir) * W.speed, wz = -Math.cos(W.dir) * W.speed, tt = this.t % 20000; wu.air.value.set(-wx * tt * 0.0013, -wz * tt * 0.0013, g.world.aerial && !g.weather ? 0.4 * dn : 0); }   // with the weather system the cloud shadows are its (every material, the same field as the sky's cumulus)
    // the street lamps as points of light from the air at night
    fx.lights.update(g.world.night, !!g.world.aerial);
    // the countryside beyond the map: while flying, or while standing in the airfield (whose north hedge looks out on it)
    fx.country.update(cam, !!L.phase || cam.y > 25 || inBox(cam.x, cam.z));
  }

  // ------------------------------------------------------------ camera
  /**
   * The glider's camera (and the parachute's, and the tumble's). Everything it follows is the drawn pose; every eased
   * value uses 1 − exp(−k·dt), so it behaves the same at any frame rate. Taking the view over (getting in, a new
   * state, C) eases from wherever the camera was, relative to what is followed; handing it back is eased by the hook.
   */
  _camera(dt, cam) {
    const L = this.L, C = this.camS, g = this.game;
    let tx, ty, tz, h, pitch = 0, roll = 0, dist, height, look = 5, q = null, V = 0, mode;
    if (L.g && L.g.sim) {
      const R = L.g.rp; tx = R.x; ty = R.y; tz = R.z; h = R.h; pitch = R.pitch; roll = R.roll; q = R.q; V = L.g.sim.V;
      dist = 15; height = 3.2; mode = 'g';
    } else if (L.phase === 'pax' && this._paxQ) {
      q = this._paxQ; tx = this._paxP[0]; ty = this._paxP[1]; tz = this._paxP[2];
      PH.hprOf(q, this._hpr2 || (this._hpr2 = {})); h = this._hpr2.h; pitch = this._hpr2.pitch; roll = this._hpr2.roll; V = L.g ? L.g.remoteV || 0 : 0;
      dist = 15; height = 3.2; mode = 'g';
    } else if (L.phase === 'chute' && L.jump) {
      // falling: on the jumper; under the canopy: further back and looking up a little, so the canopy is in the picture
      const J = L.jump, o = sstep(0.2, 0.8, J.open); tx = J.x; ty = J.y - 1 + 3.2 * o; tz = J.z; h = J.h; dist = 9 + 5 * o; height = 2.5 - 1.5 * o; look = 0; mode = 'c';
    }
    else if (L.phase === 'thrown') { const p = g.player; tx = p.pos.x; ty = p.pos.y + 1; tz = p.pos.z; h = p.heading; dist = 10; height = 4; look = 0; mode = 't'; }
    else return false;
    const cockpit = L.cam === 'cockpit' && !!q;
    mode += cockpit ? 'k' : 'c';
    // a new shot (first frame, another state, C): ease over from where the camera is now, carried along with the target
    if (!C.init || C.mode !== mode) {
      const far = cam.position.distanceToSquared(this._v3.set(tx, ty, tz)) > CAM_CUT * CAM_CUT;
      C.blend = far ? 0 : 1; C.blendT = C.live ? 0.6 : CAM_IN;
      C.inP.copy(cam.position).sub(this._v3); C.inQ.copy(cam.quaternion);
      C.yaw = h; C.el = 0.1 + pitch * 0.25; C.roll = roll * 0.25; C.lift = 0; C.dist = dist * (this._zoom || 1); C.fov = cam.fov; C.out = 0;
      C.init = true; C.mode = mode;
    }
    const inp = g.input;
    // mouse look: offsets that ease back behind the glider when the mouse is left alone
    if (inp.locked && (inp.mouseDX || inp.mouseDY)) { C.oy -= inp.mouseDX * 0.0028; C.op = clamp(C.op + inp.mouseDY * 0.0022, -0.6, 1.2); C.idle = 0; }
    else { C.idle += dt; if (C.idle > 2.2 && !cockpit) { const k = Math.exp(-dt * 1.8); C.oy *= k; C.op *= k; } }
    if (inp.wheel) this._zoom = clamp((this._zoom || 1) * (1 + inp.wheel * 0.1), 0.6, 3);
    dist *= this._zoom || 1;
    const shake = C.shake > 0 ? C.shake : 0; C.shake = Math.max(0, C.shake - dt * 1.2);
    // (the pre-stall buffet: a slow tremble; a bang nearby: a short sharp shake)
    C.buf = (C.buf || 0) + ((L.g && L.g.sim ? L.g.sim.buffet : 0) - (C.buf || 0)) * (1 - Math.exp(-dt * 5));
    const buf = C.buf;
    const jx = Math.sin(this.t * 19) * 0.03 * buf + Math.sin(this.t * 37) * 0.4 * shake, jy = Math.sin(this.t * 23 + 1) * 0.025 * buf + Math.sin(this.t * 41 + 1) * 0.35 * shake;
    // the lens opens a little with airspeed (60° at best glide, +8° flat out), eased
    const fovT = (cockpit ? 72 : 60) + clamp((V - 24) * 0.22, 0, 8) * (cockpit ? 0.5 : 1);
    C.fov += (fovT - C.fov) * (1 - Math.exp(-dt * 1.8));
    const near = cockpit ? 0.2 : 1;
    if (Math.abs(cam.fov - C.fov) > 0.02 || cam.near !== near || cam.far !== 6000) { cam.fov = C.fov; cam.near = near; cam.far = 6000; cam.updateProjectionMatrix(); }
    if (cockpit) {
      // eye in the front seat, the world tilts with the glider
      const P = this._tmpA, E = L.phase === 'pax' ? [0, 0.72, 0.45] : DIM.eyeFront; PH.qRotate(q, E[0], E[1], E[2], P);
      cam.position.set(tx + P[0], ty + P[1], tz + P[2]);
      this._q.set(q[1], q[2], q[3], q[0]);
      // three's camera looks down −z; the glider's nose is +z: turn round, then the mouse offsets
      this._qb.setFromEuler((this._eu || (this._eu = new THREE.Euler())).set(-C.op * 0.8 + jy * 0.05, Math.PI + C.oy, jx * 0.03, 'YXZ'));
      cam.quaternion.copy(this._q).multiply(this._qb);
      C.yaw = h;
    } else {
      // chase: behind the glider's heading (lagged), a little above, rolling a quarter as much as the glider
      C.yaw += wrapA(h - C.yaw) * (1 - Math.exp(-dt * 2.6));
      C.roll += (roll * 0.25 - C.roll) * (1 - Math.exp(-dt * 3));
      C.el += (0.1 + pitch * 0.25 - C.el) * (1 - Math.exp(-dt * 3.5));
      const yaw = C.yaw + C.oy, el = clamp(C.el + C.op, -0.5, 1.35), ce = Math.cos(el), se = Math.sin(el);
      const dx = -Math.sin(yaw) * ce, dz = -Math.cos(yaw) * ce;
      // buildings: the camera may ride over a roof only when the glider itself is up at roof height (then it really is
      // above the building); flying lower, between buildings, it closes in instead of sitting inside one
      let want = dist, need = 0;
      const O = this.obs;
      if (O && ty < O.maxH + 25) {
        for (let k = 0; k < 6; k++) {
          const d = dist * (1 - k * 0.16), x = tx + dx * d, z = tz + dz * d, y = ty + height + se * d;
          const roof = y < O.maxH + 2 ? O.roofAt(x, z) : null;
          if (!roof || y > roof.top + 1.5) { want = d; break; }
          if (ty + height > roof.top - 1) { want = d; need = roof.top + 1.5 - y; break; }
          want = dist * 0.2;
        }
      }
      // closes in at once-ish, eases back out; the lift (over a roof, off the ground) likewise
      C.dist += (want - C.dist) * (1 - Math.exp(-dt * (want < C.dist ? 9 : 1.6)));
      const d = Math.min(C.dist, dist * 1.001), cx = tx + dx * d, cz = tz + dz * d, raw = ty + height + se * d, gy = this._ground(cx, cz);
      need = Math.max(need, gy + 1.2 - raw, 0);
      C.lift += (need - C.lift) * (1 - Math.exp(-dt * (need > C.lift ? 9 : 2)));
      cam.position.set(cx + jx, Math.max(raw + C.lift, gy + 0.5) + jy, cz);
      cam.lookAt(tx + Math.sin(h) * look, ty + 0.8, tz + Math.cos(h) * look);
      cam.rotateZ(-C.roll);                                   // the horizon tilts a little with the bank (not the full roll: no nausea)
    }
    if (C.blend > 0) {
      C.blend = Math.max(0, C.blend - dt / C.blendT);
      const u = smoother(C.blend);
      cam.position.lerp(this._v3.set(tx, ty, tz).add(C.inP), u); cam.quaternion.slerp(C.inQ, u);
    }
    return true;
  }

  // ------------------------------------------------------------ debug / test hooks
  debugFly(k, x, y, z, h, speed = 25) {
    const G = this.G[k], L = this.L, p = this.game.player;
    // (debug: whatever state things were left in — under a parachute, the glider ditched or adrift — start clean)
    if (L.phase && L.g !== G) { if (L.g && L.g.sim) { L.g.sim.onGround = true; L.g.sim.vx = L.g.sim.vz = 0; this.exit(true); } else this._release(); }
    if (L.g !== G && (G.rec.pilot || (G.rec.mode !== MODE.HOME && G.rec.mode !== MODE.GROUND))) { G.sim = null; G.adrift = null; Object.assign(G.rec, { mode: MODE.HOME, pilot: 0, pax: 0, x: G.home.x, z: G.home.z, h: G.home.h }); }
    if (p.swim && this.game.swim && this.game.swim.climbOut) { try { this.game.swim.climbOut(); } catch { /* */ } }
    if (!this.enter(k) && this.L.g !== G) return false;
    const s = G.sim; Object.assign(s, PH.newGlider(x, z, h, { y, speed }));
    // (speed is AIRspeed: started with the wind it is in, and trimmed for it — no zoom or dive to begin with)
    { const w = this.env.wind(x, y, z, this._tmpA); s.vx += w[0]; s.vy += w[1]; s.vz += w[2]; PH.syncPose(s); s.px -= s.vx * STEP; s.py -= s.vy * STEP; s.pz -= s.vz * STEP; s.vlp = speed; }
    s.trimV = clamp(speed, 18.5, 50); this.L.phase = 'fly'; this._writeRec(G, { mode: MODE.FLYING });
    return s;
  }
}
const inMap = (g, x, z) => { const B = g.worldCollider && g.worldCollider.bounds; if (!B) return true; const bs = B.boxes || [B]; return bs.some((q) => x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ); };

export default {
  id: 'gliding',
  preMap(game) {
    // the airfield is ordinary map data appended to the map (drawn, collided, culled and mapped by the world): the lane,
    // the field, hedges, hedgerow trees, the hangar and clubhouse — and a third map box so the player may walk there
    try { dressMap(game.map, game.overrides); } catch (e) { console.error('[gliding] preMap', e); }
  },
  install(game) {
    const S = new Gliding(game);
    S.wire();
    (game.warmups || (game.warmups = [])).push({ id: 'gliding', fn: () => S._warmLoad() });
    game.gliding = {
      sys: S, air: S.air, site: SITE, physics: PH,
      get gliders() { return S.G; },
      get local() { return S.L; },
      // for the music and anything else that wants to know (read-only): active = the local player is in a glider, under
      // the parachute or being thrown clear; airborne = off the ground; speed = airspeed m/s (0 on foot); climb = m/s
      get active() { return !!S.L.phase; },
      get airborne() { const L = S.L, s = L.g && L.g.sim; return L.phase === 'chute' || L.phase === 'thrown' || (!!s && !s.onGround) || (L.phase === 'pax' && !!L.g && !(L.g.flags & NET.FLAG.WHEEL) && L.g.rec.mode !== MODE.HOME && L.g.rec.mode !== MODE.GROUND); },
      get speed() { const L = S.L, s = L.g && L.g.sim; return s ? s.V : L.phase === 'pax' && L.g ? L.g.remoteV || 0 : L.jump ? Math.hypot(L.jump.vx, L.jump.vy, L.jump.vz) : 0; },
      get climb() { const L = S.L, s = L.g && L.g.sim; return s ? s.climb : L.jump ? L.jump.vy : 0; },
      enter: (k) => S.enter(k), ride: (k) => S.ride(k), exit: (f) => S.exit(f), launch: () => S.launch(), bail: () => S.bail(),
      stats: () => ({ ...S.stats, idle: S.idle, phase: S.L.phase, records: S.G.map((G) => ({ ...G.rec })) }),
      debugFly: (...a) => S.debugFly(...a),
      /** compile everything gliding draws (and the world's aerial variants) now -> Promise (resolved when ready) */
      warm: () => Promise.resolve(S._warm()),
      get ready() { return !!S.ready; },
    };
    if (game.ui && game.ui.addBlip) game.ui.addBlip(SITE.clubhouse[0][0] + 12, SITE.clubhouse[0][1] - 5, '#9fe0ff', 'Gliding Club');
    return { id: 'gliding', update: (dt) => S.update(dt) };
  },
};
