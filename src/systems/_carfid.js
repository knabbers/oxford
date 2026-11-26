// Car fidelity (2026-11; underscore: not auto-loaded - systems/vehicles_fid.js is the system): real glass, a cabin and
// people inside every car, taxi, van and bus near the camera.  `?carfid=0` (node: GTO_CARFID=0) turns the pass off.
//
// How it is drawn (the budget is draw calls: a detailed vehicle must not cost one more than a painted one):
//  - a vehicle near the camera gets a SLOT. Its body mesh keeps its one draw, but its geometry becomes the slot's own
//    buffer: the "open" bake of the body (_vehiclemeshes.js carCabin: no painted glass, a lining, dashboard, wheel,
//    seats ...), plus - for a bus - the saloon it is ridden in (_bus_interior.js, the same geometry), plus the people
//    in it (the characters' own baked seated bodies, cut off below the seat), all in the body's material (MATS.car;
//    cabin and people are flagged matte). Slots and their buffers are pooled; attaching is a copy, never an allocation.
//  - ALL the glass of ALL detailed vehicles is ONE blended draw: the panes (the very faces the painted bake has, same
//    atlas tiles) are written in world space into one dynamic buffer each frame. Each vehicle's panes carry a fade
//    0..1: 0 = tinted, see-through, a little reflective glass; 1 = exactly the painted glass. A vehicle is handed over
//    at fade 1 (far end of the range, or over a third of a second when the cap moves on), so nothing pops.
//  - parked cars (instanced, thousands) get a stand-in body (one draw each, hence their own small cap) while the
//    instance is hidden; they are empty inside.
// Who is inside: occSpec(seed, type) - a pure function of what every multiplayer peer knows of the vehicle (its
// crowdsync id and colour), so everyone sees the same driver; nothing new on the wire.
// Also here, for every AI car whether detailed or not (flags of the body's own draw): indicators before turns and
// when pulling in / out, bus doors that slide open at stops, wipers in the rain, lamps at dusk and in heavy rain; and
// for the detailed ones a little roll and nod.
import * as THREE from 'three';
import { TYPES, MATS, FLAG, WIPE, ATLAS, ENV, WHITE, openGeometry, parkedPlate, glassTemplate, seatsOf, styleOf } from './_vehiclemeshes.js';
import { interiorGeometry, paxJobs, figure } from './_bus_interior.js';
import { addSkySheen } from '../world/materials.js';
import { bakeCharacterGeometry, randomLook } from '../core/characters.js';

/** the pass on? (`?carfid=0` in the page, GTO_CARFID=0 in node) */
export function carfidOn() {
  try { if (typeof process !== 'undefined' && process.env && process.env.GTO_CARFID !== undefined) return !/^(0|false|off|no)$/i.test(process.env.GTO_CARFID); } catch { /* */ }
  try { const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || ''); if (q.has('carfid')) return !/^(0|false|off|no)$/i.test(q.get('carfid') || ''); } catch { /* */ }
  return true;
}
/** per graphics tier: moving / occupied vehicles are detailed within `range` m (at most `cap`), parked cars within
 *  `pRange` (at most `pCap`: each is one more draw call) */
export const FID_TIERS = {
  low: { range: 32, cap: 8, pRange: 12, pCap: 2, band: 9 },
  medium: { range: 48, cap: 20, pRange: 17, pCap: 4, band: 11 },
  high: { range: 62, cap: 28, pRange: 22, pCap: 6, band: 12 },
};
const GLASS_VERTS = 20000, FADE_S = 0.32, REEVAL = 0.2, CAR_VERTS = 9000, BUS_VERTS = 46000;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (a, b) => { let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca77)) >>> 0; h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; return (h ^ (h >>> 16)) >>> 0; };

// ---------------------------------------------------------------- who is inside
const OK_OUTFIT = new Set(['casual', 'tweed', 'smart']);
/** the sixteen people who drive Oxford's cars: randomLook(seed) of each (adults in ordinary clothes); a driver turfed
 *  out of a car is the same person (traffic.handOver uses a.drvSeed) */
export const DRIVER_SEEDS = (() => {
  const out = [];
  for (let s = 9100; out.length < 16 && s < 9700; s++) { const L = randomLook(s); if (OK_OUTFIT.has(L.outfit) && (!L.hat || L.hat === 'cap' || L.hat === 'beanie' || L.hat === 'flatcap') && !L.backpack) out.push(s); }
  return out;
})();
export const BUS_DRIVER_SEED = 4242;         // (_bus_interior.js: the driver the passengers see from inside)
/** Who is in a vehicle: indices into DRIVER_SEEDS, -1 = nobody. Pure: the same for every peer who knows (seed, type). */
export function occSpec(seed, type) {
  const h = hash(seed, 77), n = DRIVER_SEEDS.length, drv = h % n, r1 = ((h >>> 8) & 255) / 255, r2 = ((h >>> 16) & 255) / 255;
  let pf = -1, pr = -1;
  if (type === 'taxi') { if (r2 < 0.55) pr = (drv + 3 + ((h >>> 24) % 9)) % n; }          // a fare in the back (hired: the roof light is off)
  else if (type === 'van') { if (r1 < 0.35) pf = (drv + 5) % n; }
  else if (type !== 'bus') { if (r1 < 0.28) pf = (drv + 1 + ((h >>> 20) & 7)) % n; if (r2 < 0.1) pr = (drv + 7) % n; }
  return { drv, pf, pr };
}
/** the seed of an AI vehicle's occupants: its crowdsync id where it has one (the same on every peer), and its colour */
export function agentSeed(a) { return hash((a.nid || a.sid || a.uid || 0) | 0, (a.rig && a.rig.color) | 0); }
/** lamps on? night, dusk and dawn, heavy rain */
let _on;
export function lampsWanted(game, night) {
  if (_on === undefined) _on = carfidOn();
  if (!_on) return !!night;
  const t = game.time, w = game.weather;
  return !!night || !!(t && t.daylight !== undefined && t.daylight < 0.3) || !!(w && w.rain > 0.55);
}

// ---------------------------------------------------------------- baked people (plain arrays, cut off below the seat)
const FIG = new Map(), QUEUE = [];
function toFigure(g, crop, head) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, Cc = g.attributes.color.array, I = g.index ? g.index.array : null, nt = (I ? I.length : P.length / 3) / 3;
  const keep = [];
  let maxY = -9;
  for (let t = 0; t < nt; t++) {
    const a = I ? I[t * 3] : t * 3, b = I ? I[t * 3 + 1] : t * 3 + 1, c = I ? I[t * 3 + 2] : t * 3 + 2;
    const ya = P[a * 3 + 1], yb = P[b * 3 + 1], yc = P[c * 3 + 1];
    if (ya < crop && yb < crop && yc < crop) continue;
    keep.push(a, b, c); maxY = Math.max(maxY, ya, yb, yc);
  }
  const n = keep.length, f = { n, pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), col: new Float32Array(n * 3), w: null, piv: [0, 0, 0] };
  for (let i = 0; i < n; i++) { const v = keep[i] * 3; f.pos[i * 3] = P[v]; f.pos[i * 3 + 1] = P[v + 1]; f.pos[i * 3 + 2] = P[v + 2]; f.nor[i * 3] = N[v]; f.nor[i * 3 + 1] = N[v + 1]; f.nor[i * 3 + 2] = N[v + 2]; f.col[i * 3] = Cc[v]; f.col[i * 3 + 1] = Cc[v + 1]; f.col[i * 3 + 2] = Cc[v + 2]; }
  if (head) {
    // the head and neck turn a little with the steering (MATS.car mode 2.6..3.4): a weight per vertex, 0 at the collar
    const neck = maxY - 0.27; let sz = 0, k = 0;
    f.w = new Float32Array(n);
    for (let i = 0; i < n; i++) { const y = f.pos[i * 3 + 1]; f.w[i] = smooth(neck - 0.02, neck + 0.07, y); if (y > neck + 0.05) { sz += f.pos[i * 3 + 2]; k++; } }
    f.piv = [0, neck, k ? sz / k : 0];
  }
  return f;
}
/** the figure for a key, or null while it is still to be baked (queued: one a frame, a body is a few ms) */
function fig(key, make, crop, head, own) {
  const f = FIG.get(key);
  if (f) return f.n >= 0 ? f : null;
  FIG.set(key, { n: -1 }); QUEUE.push({ key, make, crop, head, own });
  return null;
}
function bakeOne() {
  const j = QUEUE.shift(); if (!j) return false;
  try { const g = j.make(); FIG.set(j.key, toFigure(g, j.crop, j.head)); if (j.own) g.dispose(); } catch (e) { console.warn('[carfid] figure', j.key, e); FIG.set(j.key, { n: 0, pos: new Float32Array(0), nor: new Float32Array(0), col: new Float32Array(0), w: null, piv: [0, 0, 0] }); }
  return true;
}
const carLook = (i) => { const L = i === 'pol' ? randomLook(77, { outfit: 'police' }) : randomLook(DRIVER_SEEDS[i]); delete L.prop; delete L.backpack; if (i === 'pol') delete L.hat; return L; };
const carFig = (i, pose) => fig('c:' + pose + ':' + i, () => bakeCharacterGeometry(carLook(i), pose, 14), 0.44, pose === 'drive', true);
const busFig = (j) => fig('b:' + j.key, () => figure(j.key, j.look, j.pose), j.pose === 'drive' ? 0.3 : 0.5, false, false);      // (passengers: from the seat cushion up - the windows start above it)

// the saloon of a bus as the street sees it: the interior the player rides in (same geometry), without its own door
// leaves (the body has them), lit like the painted windows were (saloon glow), matte
const _lite = new Map(), RAIL = new THREE.Color(0xf0c000);       // (_bus_interior.js COL.rail: the yellow poles and grab rails)
function busLite(style, lean) {
  const key = style === 'bus1' ? 'bus1' : 'bus', ck = key + (lean ? ':lean' : '');
  let L = _lite.get(ck);
  if (L) return L;
  const g = interiorGeometry(key), A = g.attributes, n0 = A.position.count, keep = [], C0 = A.color.array;
  for (let t = 0; t < n0; t += 3) {
    const w = A.aWheel.array; if (w[t * 4 + 3] > 0.5 && Math.abs(w[t * 4 + 1]) > 50) continue;
    // (the low tier leaves the poles and grab rails out: thin, 30 % of the saloon's triangles)
    if (lean && Math.abs(C0[t * 3] - RAIL.r) < 0.01 && Math.abs(C0[t * 3 + 1] - RAIL.g) < 0.01 && Math.abs(C0[t * 3 + 2] - RAIL.b) < 0.01) continue;
    keep.push(t, t + 1, t + 2);
  }
  const n = keep.length;
  L = { n, pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), col: new Float32Array(n * 3), uv: new Float32Array(n * 2), gl: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const v = keep[i];
    for (let k = 0; k < 3; k++) { L.pos[i * 3 + k] = A.position.array[v * 3 + k]; L.nor[i * 3 + k] = A.normal.array[v * 3 + k]; L.col[i * 3 + k] = A.color.array[v * 3 + k]; }
    L.uv[i * 2] = A.uv.array[v * 2]; L.uv[i * 2 + 1] = A.uv.array[v * 2 + 1];
    const gw = Math.round(A.aGlow.array[v]); L.gl[i] = (gw === 9 ? 7 : gw) + 0.25;
  }
  _lite.set(ck, L);
  return L;
}

// ---------------------------------------------------------------- the glass material (one draw for every pane)
let _glassMat = null;
const GLASS_U = { tint: { value: new THREE.Color(0x0d1318) }, near: { value: 0.4 } };
function glassMaterial() {
  if (_glassMat) return _glassMat;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: ATLAS, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.36, metalness: 0.22 });
  if (ENV) { m.envMap = ENV; m.envMapIntensity = 0.55; }
  m.name = 'vehicle-glass'; m.forceSinglePass = true;          // (one draw, not three's back-then-front pair: the panes are thin and all one tint)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlassTint = GLASS_U.tint; sh.uniforms.uGlassNear = GLASS_U.near;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLit;\nvarying float vLit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvLit = aLit;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLit;\nuniform vec3 uGlassTint;\nuniform float uGlassNear;\nfloat gFade;')
      // vColor.a = the pane's fade: 0 tinted see-through glass ... 1 the painted glass of the far bake. Negative: a
      // figure painted on the glass of a far bus (fades out as the real people behind the glass fade in)
      .replace('#include <color_fragment>', `#include <color_fragment>
	gFade = abs( vColor.a );
	if ( vColor.a >= 0.0 ) { diffuseColor.rgb = mix( uGlassTint, diffuseColor.rgb, gFade ); diffuseColor.a = mix( uGlassNear, 1.0, gFade ); }
	else diffuseColor.a = gFade;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix( 0.1, roughnessFactor, gFade );')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	totalEmissiveRadiance += diffuseColor.rgb * vLit * 1.7 * gFade;
	if ( vColor.a >= 0.0 ) {
		float gFr = 1.0 - abs( dot( normalize( normal ), normalize( vViewPosition ) ) ); gFr = gFr * gFr * gFr;
		float gA = min( 1.0, diffuseColor.a + gFr * 0.5 );
		if ( ! gl_FrontFacing ) gA *= 0.4;
		diffuseColor.a = mix( gA, 1.0, gFade );
	}`);
  };
  m.customProgramCacheKey = () => 'vehGlass';
  addSkySheen(m, 0.42);
  return (_glassMat = m);
}

// ---------------------------------------------------------------- a slot: one detailed vehicle
class Slot {
  constructor() {
    this.kind = null; this.ref = null; this.rig = null; this.type = ''; this.fade = 1; this.leaving = false; this.d = 0; this.want = false;
    this.geo = null; this.cap = 0; this.key = ''; this.code = -1; this.occ = []; this.tplD = null; this.x = 0; this.z = 0;
    this.stand = null; this.mesh = null; this.orig = null; this.hook = null; this.boarded = false; this.paxOn = false;
    // the shadow map gets the shell only (the first castN vertices), not the cabin and the people inside it
    this.n = 0; this.castN = 0;
    this.preShadow = () => { if (this.geo) this.geo.setDrawRange(0, this.castN); };
    this.postShadow = () => { if (this.geo) this.geo.setDrawRange(0, this.n); };
  }
  ensure(n, min) {
    if (this.cap >= n) return false;
    // (sized for the kind of vehicle - a car with three people, a full double-decker - so a slot is not regrown as it is handed on)
    const cap = Math.ceil(Math.max(n * 1.12, min) / 1024) * 1024, old = this.geo, g = new THREE.BufferGeometry();
    for (const [k, sz] of [['position', 3], ['normal', 3], ['color', 3], ['uv', 2], ['aWheel', 4], ['aGlow', 1]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(cap * sz), sz).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
    this.geo = g; this.cap = cap;
    if (old) old.dispose();
    return true;
  }
}

export class CarFid {
  constructor(game) {
    this.game = game; this.on = carfidOn();
    this.slots = []; this.free = []; this.t = 0; this.evalT = 0; this.tierName = ''; this.tier = FID_TIERS.low;
    this.stats = { attaches: 0, builds: 0, grows: 0, slotsMade: 0, standsMade: 0, glassVerts: 0, bakes: 0, overflow: 0 };
    this._cands = []; this._pc = []; this._nc = 0; this._npc = 0; this._ghost = { t: -9, x: 0, z: 0, type: '', fade: 1 };
    this._seats = new Map(); this._m = new THREE.Matrix4(); this._wipeT = 0; this.raining = false;
    if (!this.on) return;
    // the one glass draw (kept out of the scene while empty; world/prewarm.js draws it once on the loading screen)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GLASS_VERTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(GLASS_VERTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(GLASS_VERTS * 2), 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(GLASS_VERTS * 4).fill(1), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aLit', new THREE.BufferAttribute(new Float32Array(GLASS_VERTS), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mesh = this.glass = new THREE.Mesh(g, glassMaterial());
    mesh.name = 'vehicle:glass'; mesh.frustumCulled = false; mesh.receiveShadow = false; mesh.renderOrder = 1; mesh.userData.owner = 'vehicles_fid';
    mesh.castShadow = this._lvl() !== 'low';
    const G = g.attributes;
    (game.warmups || (game.warmups = [])).push({ id: 'carfid', fn: () => {
      const PW = game.prewarm;
      if (PW && PW.extras) PW.extras.push({ o: mesh, pre: (x, y, z) => {
        if (mesh.parent && g.drawRange.count) return null;
        const n = g.drawRange.count, P = G.position.array;
        for (let i = 0; i < 9; i++) P[i] = (i % 3 === 0 ? x : i % 3 === 1 ? y - 3 : z) + (i === 3 || i === 7 ? 0.01 : 0);
        G.position.needsUpdate = true; g.setDrawRange(0, 3);
        return () => { g.setDrawRange(0, n); };
      } });
      // the people who drive (and ride in) cars, baked on the loading screen instead of in play
      for (let i = 0; i < DRIVER_SEEDS.length; i++) { carFig(i, 'drive'); carFig(i, 'sit'); }
      carFig('pol', 'drive'); carFig('pol', 'sit');
      while (bakeOne()) this.stats.bakes++;
      return null;
    } });
  }
  _lvl() { const q = this.game.quality; return (q && q.level) || 'low'; }
  _seatsOf(type, hex) { const k = type + ':' + styleOf(type, hex); let s = this._seats.get(k); if (!s) this._seats.set(k, (s = seatsOf(type, hex))); return s; }

  // ------------------------------------------------------------ per frame
  /** tools: everything back to the painted version at once (true), or carry on (false) - for before / after in one session */
  pause(on) {
    this.paused = !!on;
    if (!on) return;
    for (let i = this.slots.length - 1; i >= 0; i--) this._release(this.slots[i], i);
    const m = this.glass; if (m && m.parent) { m.geometry.setDrawRange(0, 0); m.removeFromParent(); }
  }
  update(dt) {
    if (!this.on || this.paused) return;
    const g = this.game;
    this.t += dt;
    const lvl = this._lvl();
    if (lvl !== this.tierName) { this.tierName = lvl; this.tier = FID_TIERS[lvl] || FID_TIERS.low; this.glass.castShadow = lvl !== 'low'; }
    if (QUEUE.length && ((this._bq = (this._bq || 0) + 1) & 1)) { bakeOne(); this.stats.bakes++; }
    const cam = g.camera ? g.camera.position : g.player.pos;
    const out = g.player.place === 'world';
    this._weather(dt);
    this._agents(dt, cam);
    // hosts that have gone (taken, released, removed): free their slots now, remembering where (a parked car promoted
    // to a live one, an AI car replaced by the player's: the new host carries the fade on, no blink)
    let dead = false;
    for (let i = this.slots.length - 1; i >= 0; i--) { const s = this.slots[i]; if (!this._alive(s)) { const G = this._ghost; G.t = this.t; G.x = s.x; G.z = s.z; G.type = s.type; G.fade = s.fade; this._release(s, i); dead = true; } }
    if (dead || (this.evalT -= dt) <= 0) { this.evalT = REEVAL; this._assign(cam, out); }
    this._slots(dt, cam);
    this._glass(cam);
  }

  _weather(dt) {
    const w = this.game.weather, rain = !!(w && w.rain > 0.12);
    this.raining = rain;
    if (rain) { this._wipeT += dt * (w.rain > 0.5 ? 1.5 : 1.0); const u = this._wipeT % 1; WIPE.value = 1.42 * (u < 0.5 ? smooth(0, 0.5, u) : 1 - smooth(0.5, 1, u)); }
    else if (WIPE.value !== 0) WIPE.value = 0;
    const m = _glassMat; if (m && m.envMapIntensity !== MATS.car.envMapIntensity) m.envMapIntensity = MATS.car.envMapIntensity;
  }

  /** visual state of an AI vehicle (kept on the agent: `a.vis`) */
  _vis(a) {
    let v = a.vis;
    const seed = agentSeed(a);
    if (!v) v = a.vis = { seed: -1, spec: null, ind: 0, indT: 0, door: 0, roll: 0, pitch: 0, ps: 0, hired: false };
    if (v.seed !== seed) { v.seed = seed; v.spec = occSpec(seed, a.type); a.drvSeed = a.type === 'bus' ? BUS_DRIVER_SEED : DRIVER_SEEDS[v.spec.drv]; v.ps = a.speed; }
    return v;
  }

  /** every AI car: indicators, doors, wipers, the hired cab's light (flags of its own draw: no cost) */
  _agents(dt, cam) {
    const g = this.game, tr = g.traffic, V = g.vehicles;
    const blink = ((g.time && g.time.now ? g.time.now() : this.t * 1000) % 760) < 400;
    if (tr && tr.list) for (let i = 0; i < tr.list.length; i++) {
      const a = tr.list[i];
      if (a.kind !== 'car' || !a.active) continue;
      const rig = a.rig, v = this._vis(a), l = a.lane;
      // ---- indicators: a turn coming at the end of this lane, a move across (round something, into / out of a stop)
      let want = 0;
      if (l && !a.shove) {
        const n = a.next, toEnd = l.len - a.s;
        if (n && toEnd < Math.max(18, a.speed * 3.2)) {
          if (n.e === l.e) want = -1;                                                   // turning round in the road
          else if (l.edx * n.sdx + l.edz * n.sdz < 0.82) want = l.edz * n.sdx - l.edx * n.sdz > 0 ? 1 : -1;
        }
        if (!want) {
          const d = a.offT + a.passOff - a.off;
          if (a.type === 'bus' && a.dwell > 0) want = a.dwell < 1.3 ? -1 : 1;                // at the stop; about to pull out
          else if (Math.abs(d) > 0.4 && a.speed > 0.4) want = d > 0 ? 1 : -1;
        }
      }
      if (want) { v.ind = want; v.indT = 0.9; }
      else if (v.ind) { if (Math.abs(a.steer) > 0.1 && Math.sign(a.steer) === v.ind && a.speed > 0.5) v.indT = Math.max(v.indT, 0.4); if ((v.indT -= dt) <= 0) v.ind = 0; }
      rig.setFlag(FLAG.indL, v.ind > 0 && blink); rig.setFlag(FLAG.indR, v.ind < 0 && blink);
      rig.setFlag(FLAG.wipe, this.raining && (!!l || a.held));
      // ---- a cab with a fare aboard has its roof light off
      if (a.type === 'taxi') { v.hired = v.spec.pr >= 0 && !!l && !a.rank; if (rig.setSign) rig.setSign(!v.hired); }
      // ---- bus doors
      if (a.type === 'bus' && rig.setDoor) {
        const t = a.dwell > 0 && Math.abs(a.speed) < 0.3 ? 1 : 0;
        if (v.door !== t) { v.door = clamp(v.door + Math.sign(t - v.door) * dt * 2.2, 0, 1); }
        rig.setDoor(v.door);
      }
    }
    if (V && V.list) for (let i = 0; i < V.list.length; i++) {
      const v = V.list[i];
      if (v.kind !== 'car' || !v.rig || !v.rig.setFlag) continue;
      v.rig.setFlag(FLAG.wipe, this.raining && !!v.driver);
      if (v.type === 'bus' && v.rig.setDoor) {
        const t = v.driver === 'player' && v.atStop && Math.abs(v.speed) < 0.3 ? 1 : 0, d0 = v.doorK || 0;
        if (d0 !== t) v.doorK = clamp(d0 + Math.sign(t - d0) * dt * 2.2, 0, 1);
        v.rig.setDoor(v.doorK || 0);
      }
    }
  }

  // ------------------------------------------------------------ which vehicles get a slot
  _alive(s) {
    const g = this.game, r = s.ref;
    if (s.kind === 'ai') return r.active && r.rig === s.rig && s.rig.group.visible;
    if (s.kind === 'live') return !!r.mesh.parent && r.rig === s.rig && !r.static;
    if (s.kind === 'park') return !r.taken && !!r.pool && r._ig === r.pool.gen;
    if (s.kind === 'ghost') return r.ghost === s.orig && !!s.orig.parent && !!(g.net && g.net.others && g.net.others.get(r.id) === r);
    return false;
  }
  _cand(list, n, kind, ref, d, x, z) { let c = list[n]; if (!c) list[n] = c = { kind: '', ref: null, d: 0, x: 0, z: 0 }; c.kind = kind; c.ref = ref; c.d = d; c.x = x; c.z = z; }
  _assign(cam, out) {
    const g = this.game, T = this.tier, tr = g.traffic, V = g.vehicles, C = this._cands, PC = this._pc;
    let n = 0, np = 0;
    const R = T.range + 1.5, cx = cam.x, cz = cam.z;
    let fx = 0, fz = 0;
    if (g.camera && g.camera.matrixWorld) { const e = g.camera.matrixWorld.elements; fx = -e[8]; fz = -e[10]; }
    const score = (x, z, idle) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); return d > R ? -1 : d + (idle ? 14 : 0) + (dx * fx + dz * fz < -3 ? 10 : 0) * (d > 14 ? 1 : 0); };
    if (out) {
      if (tr && tr.list) for (let i = 0; i < tr.list.length; i++) { const a = tr.list[i]; if (a.kind !== 'car' || !a.active || !a.rig.group.visible) continue; const sc = score(a.x, a.z, false); if (sc >= 0) this._cand(C, n++, 'ai', a, sc, a.x, a.z); }
      if (V && V.list) for (let i = 0; i < V.list.length; i++) { const v = V.list[i]; if (v.kind !== 'car' || v.static || !v.rig || !v.rig.regeo || !v.mesh.parent) continue; const sc = score(v.x, v.z, !v.driver); if (sc >= 0) this._cand(C, n++, 'live', v, sc, v.x, v.z); }
      if (g.net && g.net.others && g.net.others.size) for (const o of g.net.others.values()) { const T2 = TYPES[o.veh]; if (!T2 || T2.kind !== 'car' || !o.ghost || !o.ghost.parent || o.place !== 'world') continue; const sc = score(o.x, o.z, false); if (sc >= 0) this._cand(C, n++, 'ghost', o, sc, o.x, o.z); }
      const pools = V && V.pools;
      if (pools && T.pCap > 0) for (const t of PARK_TYPES) {
        const pl = pools.get(t); if (!pl || !pl.shown) continue;
        const pr = T.pRange + 1.5, self = this;
        pl.grid.each(cx, cz, pr, (s) => { if (s.taken || s._ig !== pl.gen) return; const d = Math.hypot(s.x - cx, s.z - cz); if (d < pr) self._cand(PC, np++, 'park', s, d, s.x, s.z); });
      }
    }
    this._nc = n; this._npc = np;
    sortN(C, n); sortN(PC, np);
    for (const s of this.slots) s.want = false;
    let used = 0, usedP = 0;
    const wantN = Math.min(n, T.cap), wantP = Math.min(np, T.pCap);
    for (let i = 0; i < wantN; i++) { const s = C[i].ref._fid; if (s && s.ref === C[i].ref) { s.want = true; used++; } }
    for (let i = 0; i < wantP; i++) { const s = PC[i].ref._fid; if (s && s.ref === PC[i].ref) { s.want = true; usedP++; } }
    let live = 0, liveP = 0;
    for (const s of this.slots) { if (s.kind === 'park') liveP++; else live++; s.leaving = !s.want; }
    // new ones, nearest first, while the cap has room (those leaving still hold theirs until faded out); a few a tick
    let budget = 3;
    for (let i = 0; i < wantN && budget > 0 && live < T.cap; i++) { const c = C[i]; if (c.ref._fid) continue; if (this._attach(c)) { live++; budget--; } }
    for (let i = 0; i < wantP && budget > 0 && liveP < T.pCap; i++) { const c = PC[i]; if (c.ref._fid) continue; if (this._attach(c)) { liveP++; budget--; } }
    for (let i = 0; i < n; i++) C[i].ref = null;
    for (let i = 0; i < np; i++) PC[i].ref = null;
  }

  /** what is inside a rig host right now, as one number (changes -> the slot's buffer is rebuilt) */
  _code(s) {
    const r = s.ref, g = this.game;
    if (s.kind === 'ai') {
      const v = this._vis(r);
      if (s.type === 'bus') { const br = g.busride; return br && br.bus === r ? 4999999 : 5000000 + (r.pax | 0) * 8 + (r.paxSeed | 0); }
      return 1 + v.spec.drv + 32 * (v.spec.pf + 1) + 1024 * ((s.type === 'taxi' && !v.hired ? -1 : v.spec.pr) + 1);
    }
    if (s.kind === 'live') {
      if (s.type === 'bus') return r.pax > 0 ? 6000000 + Math.min(14, r.pax | 0) * 8 + (r.paxSeed | 0) : 0;
      if (r.driver === 'ai' && r.livery === 'police') return 900001 + (hash(r.id | 0, 5) & 1);
      return 0;
    }
    return 0;
  }
  /** the people of a code, placed: fills s.occ with { f, x, y, z, glow }; false while a body is still to be baked */
  _people(s, code) {
    const O = s.occ; O.length = 0;
    if (!code || code === 4999999) return true;
    let ok = true;
    const add = (f, p, glow) => { if (!f) ok = false; else if (f.n) O.push({ f, x: p[0], y: p[1], z: p[2], glow }); };
    if (code >= 5000000) {
      const live = code >= 6000000, k = code - (live ? 6000000 : 5000000), st = s.rig.style || 'bus';
      // (low tier: the driver and the first five passengers of the layout - a person is ~1100 triangles)
      let np = 0; const few = this.tierName === 'low';
      for (const j of paxJobs(st, k >> 3, k & 7, !live)) { if (few && j.seat >= 0 && ++np > 5) continue; add(busFig(j), [j.x, j.y, j.z], 9); }
    } else {
      const S = this._seatsOf(s.type, s.rig.color);
      if (code >= 900001) { add(carFig('pol', 'drive'), S.d, 0); if (code & 1) add(carFig('pol', 'sit'), S.p, 0); }
      else {
        const drv = (code - 1) & 31, pf = ((code - 1) >> 5 & 31) - 1, pr = ((code - 1) >> 10) - 1;
        add(carFig(drv, 'drive'), S.d, 0);
        if (pf >= 0 && S.p) add(carFig(pf, 'sit'), S.p, 0);
        if (pr >= 0 && S.rear.length) add(carFig(pr, 'sit'), S.rear[0], 0);
      }
    }
    return ok;
  }

  _attach(c) {
    const g = this.game, ref = c.ref;
    let s = null;
    if (c.kind === 'ai' || c.kind === 'live') {
      const rig = ref.rig, type = ref.type;
      // (the people must be baked first: a slot is only taken once it can be filled - nobody pops into a seat later)
      const probe = this._probe || (this._probe = new Slot());
      probe.kind = c.kind; probe.ref = ref; probe.rig = rig; probe.type = type;
      const code = this._code(probe), ready = this._people(probe, code);
      probe.ref = null; probe.rig = null; probe.occ.length = 0;
      if (!ready) return false;
      s = this._take(type === 'bus'); s.kind = c.kind; s.ref = ref; s.rig = rig; s.type = type; s.code = -1; s.key = '';
      s.hook = s.hook || ((r, base) => this._geoFor(s, r, base));
      rig.geoHook = s.hook; rig.regeo();
      rig.body.onBeforeShadow = s.preShadow; rig.body.onAfterShadow = s.postShadow;
    } else if (c.kind === 'park') {
      s = this._take(false, true); s.kind = 'park'; s.ref = ref; s.type = ref.type; s.rig = null;
      let m = s.stand;
      if (!m) {
        m = s.stand = new THREE.InstancedMesh(openGeometry(ref.type, ref.color ?? 0xffffff, null, null, parkedPlate(ref.type), true), MATS.car, 1);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3); m.matrixAutoUpdate = false; m.name = 'vehicle:stand-in'; m.userData.owner = 'vehicles_fid';
        this.stats.standsMade++;
      }
      m.geometry = openGeometry(ref.type, ref.color ?? 0xffffff, null, null, parkedPlate(ref.type), true); m.boundingSphere = null;   // (true: the type's base body, as the parked instances are)
      m.matrix.fromArray(ref.m); m.matrixWorld.copy(m.matrix); m.matrixWorldNeedsUpdate = true; m.castShadow = !!ref.pool.rest.castShadow; m.visible = true;
      if (!m.parent) g.worldScene.add(m);
      ref._fid = s; ref.pool.patch(ref);
    } else {
      const grp = ref.ghost, mesh = grp.children[0]; if (!mesh || !mesh.isMesh) return false;
      s = this._take(); s.kind = 'ghost'; s.ref = ref; s.type = ref.veh; s.rig = null; s.orig = grp; s.mesh = mesh; s.tplD = mesh.geometry;
      mesh.geometry = openGeometry(ref.veh, Number.isFinite(ref.vcol) ? ref.vcol : TYPES[ref.veh].colors[0]);
    }
    ref._fid = s; s.fade = 1; s.leaving = false; s.want = true; s.x = c.x; s.z = c.z; s.d = c.d;
    const G = this._ghost;
    if (this.t - G.t < 0.6 && G.type === s.type && Math.abs(G.x - c.x) + Math.abs(G.z - c.z) < 3) { s.fade = G.fade; G.t = -9; }
    this.slots.push(s); this.stats.attaches++;
    return true;
  }
  /** a free slot that suits: one that already has a stand-in for a parked car; one whose buffer is a bus's (five
   *  times a car's) for a bus; else any; else a new one */
  _take(big = false, park = false) {
    const fr = this.free;
    let best = -1, bs = -1;
    for (let i = 0; i < fr.length; i++) {
      const q = fr[i], sc = park ? (q.stand ? 4 : q.cap ? 0 : 2) : (q.stand ? 0 : 1) + ((q.cap >= BUS_VERTS) === big ? 2 : !q.cap ? 1.5 : big ? 1 : 0);
      if (sc > bs) { bs = sc; best = i; }
    }
    // (a bus is not given a car's slot to regrow while few bus-sized buffers exist: a handful of big ones, the rest small)
    if (best >= 0 && big && bs < 2 && (this.bigMade || 0) < 4) best = -1;
    if (best >= 0) { const q = fr[best]; fr[best] = fr[fr.length - 1]; fr.pop(); return q; }
    if (big) this.bigMade = (this.bigMade || 0) + 1;
    this.stats.slotsMade++; return new Slot();
  }
  _release(s, i) {
    const ref = s.ref;
    if (s.kind === 'ai' || s.kind === 'live') {
      const rig = s.rig;
      if (rig.geoHook === s.hook) { rig.geoHook = null; try { rig.regeo(); } catch { /* */ } }
      if (rig.body.onBeforeShadow === s.preShadow) { delete rig.body.onBeforeShadow; delete rig.body.onAfterShadow; }
      if (s.paxOn) this._pax(s, false);
      if (s.kind === 'ai' && rig.group) { if (!(this.game.busride && this.game.busride.bus === ref)) { rig.group.rotation.x = 0; rig.group.rotation.z = 0; } }
    } else if (s.kind === 'park') {
      if (s.stand) s.stand.visible = false;
      if (ref._fid === s) { ref._fid = null; if (ref.pool) ref.pool.patch(ref); }
    } else if (s.kind === 'ghost') { if (s.mesh && s.tplD) s.mesh.geometry = s.tplD; s.mesh = null; s.orig = null; s.tplD = null; }
    if (ref && ref._fid === s) ref._fid = null;
    s.kind = null; s.ref = null; s.rig = null; s.occ.length = 0; s.code = -1; s.key = '';
    if (i === undefined) i = this.slots.indexOf(s);
    if (i >= 0) { this.slots[i] = this.slots[this.slots.length - 1]; this.slots.pop(); }
    this.free.push(s);
  }

  /** the painted figures on a far bus's glass (systems/jobs.js rig.paxMesh, busride's 'bus-rider'): not while the real ones show */
  _pax(s, hide) {
    const rig = s.rig, pm = rig.paxMesh;
    s.paxOn = hide;
    if (hide) { if (pm && pm.visible) pm.visible = false; }
    else if (pm) { if (s.kind === 'ai' && s.ref) s.ref._paxShown = -1; else pm.visible = this._lvl() !== 'low' && !!(pm.geometry && pm.geometry.attributes.position && pm.geometry.attributes.position.count); }
    const ch = rig.group.children;
    for (let i = 0; i < ch.length; i++) if (ch[i].name === 'bus-rider') ch[i].visible = !hide && !rig.inside;
  }

  /** geoHook of a rig with a slot: the slot's buffer (rebuilt when the colour, the blind or the people changed) */
  _geoFor(s, rig, base) {
    if (rig.inside || s.rig !== rig) return null;         // the local camera is inside this bus: busride's own interior
    const code = s.code < 0 ? this._code(s) : s.code;
    const key = rig.color + '|' + rig.blind + '|' + code;
    if (key !== s.key) { s.key = key; s.code = code; this._people(s, code); this._build(s, rig, code); }
    return s.geo;
  }
  _build(s, rig, code) {
    const type = s.type, bus = type === 'bus';
    const base = openGeometry(type, rig.color, rig.livery, bus ? rig.blind : null), B = base.attributes, nb = B.position.count;
    const L = bus && code !== 4999999 ? busLite(rig.style, this.tierName === 'low') : null;
    let n = nb + (L ? L.n : 0);
    for (const o of s.occ) n += o.f.n;
    if (s.ensure(n, bus ? BUS_VERTS : CAR_VERTS)) this.stats.grows++;
    const A = s.geo.attributes, P = A.position.array, N = A.normal.array, Cc = A.color.array, U = A.uv.array, W = A.aWheel.array, Gl = A.aGlow.array;
    P.set(B.position.array, 0); N.set(B.normal.array, 0); Cc.set(B.color.array, 0); U.set(B.uv.array, 0); W.set(B.aWheel.array, 0); Gl.set(B.aGlow.array, 0);
    let o = nb;
    if (L) { P.set(L.pos, o * 3); N.set(L.nor, o * 3); Cc.set(L.col, o * 3); U.set(L.uv, o * 2); W.fill(0, o * 4, (o + L.n) * 4); Gl.set(L.gl, o); o += L.n; }
    for (const q of s.occ) {
      const f = q.f, m = f.n, gw = q.glow + 0.25;
      N.set(f.nor, o * 3); Cc.set(f.col, o * 3);
      for (let i = 0; i < m; i++) {
        const k = o + i;
        P[k * 3] = f.pos[i * 3] + q.x; P[k * 3 + 1] = f.pos[i * 3 + 1] + q.y; P[k * 3 + 2] = f.pos[i * 3 + 2] + q.z;
        U[k * 2] = WHITE[0]; U[k * 2 + 1] = WHITE[1]; Gl[k] = gw;
        const w = f.w ? f.w[i] : 0;
        if (w > 0.01) { W[k * 4] = f.piv[0] + q.x; W[k * 4 + 1] = f.piv[1] + q.y; W[k * 4 + 2] = f.piv[2] + q.z; W[k * 4 + 3] = 2.6 + 0.8 * w; } else { W[k * 4] = W[k * 4 + 1] = W[k * 4 + 2] = W[k * 4 + 3] = 0; }
      }
      o += m;
    }
    for (const k of ['position', 'normal', 'color', 'uv', 'aWheel', 'aGlow']) { const a = A[k]; a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true; }
    s.geo.setDrawRange(0, n); s.n = n; s.castN = Math.min(n, base.userData.castN ?? nb);
    const bs = base.boundingSphere; if (bs) { s.geo.boundingSphere.center.copy(bs.center); s.geo.boundingSphere.radius = bs.radius + 0.4; }
    s.geo.userData.style = base.userData.style;
    this.stats.builds++;
  }

  // ------------------------------------------------------------ per slot, per frame
  _slots(dt, cam) {
    const T = this.tier, g = this.game;
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i], r = s.ref, park = s.kind === 'park';
      const x = park ? r.x : s.kind === 'ghost' ? r.x : r.x, z = r.z;
      s.x = x; s.z = z;
      const d = Math.hypot(x - cam.x, z - cam.z); s.d = d;
      const range = park ? T.pRange : T.range, band = park ? 4.5 : T.band;
      const tgt = s.leaving ? 1 : smooth(range - band, range - 1, d);
      const step = dt / FADE_S;
      s.fade = s.fade < tgt ? Math.min(tgt, s.fade + step) : Math.max(tgt, s.fade - step);
      if (s.leaving && s.fade >= 0.999) { this._release(s, i); continue; }
      if (park) continue;
      if (s.kind === 'ghost') continue;
      const rig = s.rig, bus = s.type === 'bus';
      // the people aboard changed (a fare got in, the passengers of a bus, the driver turfed out): rebuild
      const code = this._code(s);
      if (code !== s.code) {
        const probe = this._probe || (this._probe = new Slot());
        probe.kind = s.kind; probe.ref = r; probe.rig = rig; probe.type = s.type;
        const ready = this._people(probe, code); probe.ref = null; probe.rig = null; probe.occ.length = 0;
        if (ready) { s.code = code; s.key = ''; rig.regeo(); }
      }
      if (bus && !rig.inside) this._pax(s, true);
      // a little roll out of the bend and nod under the brakes (AI cars; the player's car has its own springs)
      if (s.kind === 'ai' && !r.shove && (r.lane || r.remote) && !(g.busride && g.busride.bus === r)) {
        const v = r.vis, m = rig.group, Tt = TYPES[s.type];
        if (v && dt > 0) {
          const acc = clamp((r.speed - v.ps) / dt, -8, 5); v.ps = r.speed;
          const k = bus ? 0.55 : 1;
          v.pitch += (clamp(-acc * 0.0055, -0.014, 0.032) * k - v.pitch) * Math.min(1, dt * 5);
          v.roll += (clamp(r.speed * (r.yaw || 0) * 0.011, -0.045, 0.045) * k - v.roll) * Math.min(1, dt * 4);
          if (m.rotation.x !== v.pitch || m.rotation.z !== v.roll) { m.rotation.x = v.pitch; m.rotation.z = v.roll; }
          m.position.y += Math.abs(v.roll) * (Tt.W * 0.5 - 0.12) + Math.abs(v.pitch) * Tt.wb * 0.5;
        }
      }
    }
  }

  // ------------------------------------------------------------ the glass: every pane of every slot, one buffer
  _glass(cam) {
    const mesh = this.glass, geo = mesh.geometry, A = geo.attributes, P = A.position.array, N = A.normal.array, U = A.uv.array, Cc = A.color.array, Li = A.aLit.array;
    let o = 0;
    const g = this.game, e = g.camera && g.camera.matrixWorld ? g.camera.matrixWorld.elements : null, fx = e ? -e[8] : 0, fz = e ? -e[10] : 0;
    for (let si = 0; si < this.slots.length; si++) {
      const s = this.slots[si], r = s.ref;
      // (well behind the camera: nothing of it is drawn)
      if (e && s.d > 9 && (s.x - cam.x) * fx + (s.z - cam.z) * fz < -9) continue;
      let M, tpl, lit = 0, door = 0, hex;
      if (s.kind === 'park') { M = r.m; hex = r.color ?? 0; tpl = glassTemplate(s.type, TYPES[s.type].colors[0], null, false); }
      else if (s.kind === 'ghost') { s.mesh.updateWorldMatrix(true, false); M = s.mesh.matrixWorld.elements; tpl = glassTemplate(s.type, Number.isFinite(r.vcol) ? r.vcol : TYPES[s.type].colors[0], null, false); }
      else { const rig = s.rig; rig.group.updateMatrixWorld(); M = rig.body.matrixWorld.elements; tpl = glassTemplate(s.type, rig.color, rig.livery, !!rig.driverIn); lit = rig.lightsOn ? 1 : 0; door = rig.doorOpen ? rig.doorOpen() : 0; }
      const n = tpl.n;
      if (o + n > GLASS_VERTS) { this.stats.overflow++; break; }
      const f = s.fade, tp = tpl.pos, tn = tpl.nor, tu = tpl.uv, tl = tpl.lit, ts = tpl.slide;
      const m0 = M[0], m1 = M[1], m2 = M[2], m4 = M[4], m5 = M[5], m6 = M[6], m8 = M[8], m9 = M[9], m10 = M[10], m12 = M[12], m13 = M[13], m14 = M[14];
      for (let i = 0; i < n; i++) {
        const x = tp[i * 3], y = tp[i * 3 + 1], z = tp[i * 3 + 2] + ts[i] * door, k = o + i;
        P[k * 3] = m0 * x + m4 * y + m8 * z + m12; P[k * 3 + 1] = m1 * x + m5 * y + m9 * z + m13; P[k * 3 + 2] = m2 * x + m6 * y + m10 * z + m14;
        const a = tn[i * 3], b = tn[i * 3 + 1], c = tn[i * 3 + 2];
        N[k * 3] = m0 * a + m4 * b + m8 * c; N[k * 3 + 1] = m1 * a + m5 * b + m9 * c; N[k * 3 + 2] = m2 * a + m6 * b + m10 * c;
        U[k * 2] = tu[i * 2]; U[k * 2 + 1] = tu[i * 2 + 1];
        Cc[k * 4] = Cc[k * 4 + 1] = Cc[k * 4 + 2] = 1; Cc[k * 4 + 3] = f; Li[k] = tl[i] * lit;
      }
      o += n;
      // the figures painted on a far bus's glass fade out as the people inside fade in
      if (s.type === 'bus' && s.paxOn && f > 0.02 && this.tierName !== 'low') {
        const pm = s.rig.paxMesh, pg = pm && pm.geometry, pa = pg && pg.attributes.position;
        if (pa && pa.count && o + pa.count <= GLASS_VERTS) {
          const pp = pa.array, pc = pg.attributes.color.array, pn = pa.count;
          for (let i = 0; i < pn; i++) {
            const x = pp[i * 3], y = pp[i * 3 + 1], z = pp[i * 3 + 2], k = o + i;
            P[k * 3] = m0 * x + m4 * y + m8 * z + m12; P[k * 3 + 1] = m1 * x + m5 * y + m9 * z + m13; P[k * 3 + 2] = m2 * x + m6 * y + m10 * z + m14;
            const sx = x > 0 ? 1 : -1;
            N[k * 3] = m0 * sx; N[k * 3 + 1] = m1 * sx; N[k * 3 + 2] = m2 * sx;
            U[k * 2] = WHITE[0]; U[k * 2 + 1] = WHITE[1];
            Cc[k * 4] = pc[i * 3]; Cc[k * 4 + 1] = pc[i * 3 + 1]; Cc[k * 4 + 2] = pc[i * 3 + 2]; Cc[k * 4 + 3] = -Math.max(0.004, f); Li[k] = 0;
          }
          o += pn;
        }
      }
    }
    this.stats.glassVerts = o;
    if (o) {
      for (const k of ['position', 'normal', 'uv', 'color', 'aLit']) { const a = A[k]; a.clearUpdateRanges(); a.addUpdateRange(0, o * a.itemSize); a.needsUpdate = true; }
      geo.setDrawRange(0, o);
      if (!mesh.parent) this.game.worldScene.add(mesh);
    } else if (mesh.parent) { geo.setDrawRange(0, 0); mesh.removeFromParent(); }
  }

  // ------------------------------------------------------------ for tests and tools
  /** [{ kind, type, d, fade, people, x, z, ref }] of the detailed vehicles */
  list() { return this.slots.map((s) => ({ kind: s.kind, type: s.type, d: s.d, fade: s.fade, people: s.occ.length, x: s.x, z: s.z, ref: s.ref, leaving: s.leaving })); }
  slotOf(ref) { const s = ref && ref._fid; return s && s.ref === ref ? s : null; }
  /** the people in a detailed vehicle: [{ x, y, z (vehicle frame, feet origin), n (triangles x 3) }] */
  peopleOf(ref) { const s = this.slotOf(ref); return s ? s.occ.map((o) => ({ x: o.x, y: o.y, z: o.z, n: o.f.n })) : null; }
  pending() { return QUEUE.length; }
}
const PARK_TYPES = ['car_hatch', 'car_saloon', 'taxi', 'van'];
function sortN(a, n) { for (let i = 1; i < n; i++) { const c = a[i]; let j = i - 1; while (j >= 0 && a[j].d > c.d) { a[j + 1] = a[j]; j--; } a[j + 1] = c; } }
