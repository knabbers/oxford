// Player-usable vehicles: bicycles (lots - this is Oxford), cars/taxis/vans/buses, and punts on the Cherwell and Thames.
// Parked vehicles are static instanced "slots" (nearest-N pooling); entering one promotes it to a live vehicle.
// API on game.vehicles - see docs/VEHICLES_API.md.
import * as THREE from 'three';
import { lampsWanted } from './_carfid.js';
import { pointInPoly } from '../core/collision.js';
import { createCharacter, randomLook } from '../core/characters.js';
import { TYPES, BIKE_TYPES, MATS, PUNT, staticParts, makeLive, makeGhost, makeDoor, doorInfo, setEnvLight, PARK_EYE, vehFade, VFADE_STEPS } from './_vehiclemeshes.js';
import { WaterIndex } from './_vehicleutil.js';
import { VehicleSound } from './_vehicle_audio.js';
import { CrashSound, materialOf } from './_crash_audio.js';
import { drip } from './_object_audio.js';
import { PHYS, setDims, contact, impulse, Surface, spring, topAt, PED_MASS } from './_vehphys.js';
import { restitution, personShare, strikerLoss, glance, felt, PED_R, E_WALL, E_BODY, BIKE_OFF, BIKE_NUDGE } from './_collide.js';
import { SkidMarks, Puffs, Debris, PUFF } from './_vehfx.js';
import { BUS_NAMES } from './_motion.js';
import { busyOn, busyTier, popTiered, PARK_NAMED, NO_PARK, ECHELON, CENTRE_BAYS } from './_busy.js';
import { barrierGap, BARRIER_HALF, SANITY } from './_clearance.js';
import { terrainAfloat } from '../world/terrain.js';
setDims(TYPES);
const BUSY = busyOn();
// parked pools per car type (busy-streets pass: the kerbs are lined, so more instances are near at once; the number
// actually shown per tier is capped by PARK_SHOW)
const PARK_MAX = BUSY ? { car_hatch: 110, car_saloon: 100, van: 44, taxi: 40 } : { car_hatch: 36, car_saloon: 36, van: 36, taxi: 36 };
// (perf audit 2026-11: low 0.45 -> 0.3 and no parked-car shadows on low — the nearest ~40 cars within 130 m instead of
// ~60, and the shadow pass without ~130 cars: -0.15 to -0.3 ms GPU on the Radeon Pro 460 in a parked-up Jericho street)
// (2026-11-21: every parked car on every tier — _busy.js "WHO IS THERE does not depend on the graphics tier"; low still
// draws them without shadows. ?poptier=1: the old shares, to measure.)
// Nothing parked pops in at the edge of its pool (2026-11-26; tools/smoke_popin.mjs: 10 to 320 a minute seen, rows of
// bicycles at 60 m and of cars at 130 m): an instance is whole within radius - PARK_FADE.<kind> m of the player and thins
// out to nothing AT the radius (a dither in MATS.parked: _vehiclemeshes.js), so nothing is drawn further out than it
// was. The instances are gathered PARK_M m beyond that - they are picked again only every PARK_STEP m the player
// moves - and those cost vertices only.
const PARK_FADE = { bike: 14, car: 24, bus: 35, punt: 35 }, PARK_M = 9, PARK_STEP = 4;
const PARK_SHOW = popTiered() ? { low: 0.3, medium: 0.75, high: 1, ultra: 1 } : { low: 1, medium: 1, high: 1, ultra: 1 };

const SIM_R = 150;                   // nothing beyond this is updated
const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _near = [];
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const CARRIAGE_K = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash2 = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// Rider placement relative to the vehicle origin (local: +z forward, +x left). y = height of the character's feet origin.
// player.pos is the RIDER position (so remote players' characters land on the seat; createMesh() is offset to match).
const RIDER = {
  bike_roadster: { x: 0, y: 0, z: -0.12 }, bike_road: { x: 0, y: 0, z: -0.08 }, bike_mtb: { x: 0, y: 0, z: -0.1 },
  punt: { x: 0.08, y: PUNT.floorY, z: PUNT.standZ },
};
for (const t of Object.keys(TYPES)) if (TYPES[t].kind === 'car') RIDER[t] = { x: TYPES[t].seat.x, y: TYPES[t].seat.y - 0.45, z: TYPES[t].seat.z };
const POSE = { bike: 'cycle', car: 'drive', punt: 'punt' };
// taking a vehicle from its driver (AI traffic): on-foot prompt and the HUD toast naming what you now have
const TAKE_PROMPT = { car_hatch: 'Take the car', car_saloon: 'Take the car', taxi: 'Take the cab', van: 'Take the van', bus: 'Commandeer the bus',
  bike_roadster: 'Grab the bike', bike_road: 'Grab the bike', bike_mtb: 'Grab the bike' };
const TAKE_NAME = { car_hatch: 'Hatchback', car_saloon: 'Saloon', taxi: 'Black cab', van: 'White van', bus: 'Oxford double-decker',
  bike_roadster: 'Sit-up-and-beg bicycle', bike_road: 'Road bike', bike_mtb: 'Battered mountain bike' };
const BUS_STOP_LINES = ['Ding ding! Fares, please.', 'Nobody gets on. They have seen who is driving.', 'A pensioner waves you on: "I\'ll wait for a proper one."',
  'Doors open. A tourist asks if this goes to Blenheim.'];

// ---------------------------------------------------------------- spatial grid of parked slots
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  k(cx, cz) { return cx * 65536 + cz; }
  add(o) {
    const k = this.k(Math.floor(o.x / this.cell), Math.floor(o.z / this.cell));
    let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(o); o._gk = k;
  }
  remove(o) { const a = this.map.get(o._gk); if (a) { const i = a.indexOf(o); if (i >= 0) a.splice(i, 1); } }
  each(x, z, r, fn) {
    const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const a = this.map.get(this.k(cx, cz)); if (a) for (let i = 0; i < a.length; i++) fn(a[i]); }
  }
}

// ---------------------------------------------------------------- instanced pool of parked slots of one type
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p3 = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _col = new THREE.Color();
class Pool {
  constructor(scene, type, max, radius, shadows) {
    const parts = staticParts(type);
    this.type = type; this.max = max; this.radius = radius; this.slots = []; this.grid = new Grid(32); this.cand = [];
    this.band = type === 'punt' ? PARK_FADE.punt : type === 'bus' ? PARK_FADE.bus : radius <= 70 ? PARK_FADE.bike : PARK_FADE.car;
    // (the pool's own geometry: the type's attributes, shared, and one of its own - aPark, the far edge's fade per instance)
    const geo = new THREE.BufferGeometry(), src = parts.all;
    for (const k in src.attributes) geo.setAttribute(k, src.attributes[k]);
    geo.setIndex(src.index); for (const gr of src.groups) geo.addGroup(gr.start, gr.count, gr.materialIndex);
    if (!src.boundingSphere) src.computeBoundingSphere();
    geo.boundingSphere = src.boundingSphere.clone(); if (src.boundingBox) geo.boundingBox = src.boundingBox.clone();
    this.park = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2); this.park.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPark', this.park);
    // graphics pass 2: rest + tinted parts in one InstancedMesh (MATS.parked masks the instance colour per vertex)
    this.rest = new THREE.InstancedMesh(geo, MATS.parked, max);
    /** how much of instance i (standing at x, z) is drawn now: what the shader works out (tools/_popin_probe.mjs) */
    this.rest.userData.fadeOf = (i, x, z) => { const A = this.park.array, w = A[i * 2], g = A[i * 2 + 1], e = PARK_EYE.value; return g > 0 ? Math.min(1, Math.max(0, (g - Math.hypot(x - e.x, z - e.y)) / Math.max(g - w, 0.01))) : 1; };
    this.tint = null;
    for (const m of [this.rest]) {
      m.count = 0; m.castShadow = shadows; m.receiveShadow = false; m.name = 'parked:' + type;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (type === 'punt') terrainAfloat(m);     // (terrain: boats ride on the water's own level: beside a bank, under a bridge)
      scene.add(m);
    }
    this.rest.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.dirty = true;
  }
  add(s) {
    _e.set(s.pitch || 0, s.h, s.lean || 0, 'YXZ'); _q.setFromEuler(_e); _p3.set(s.x, s.y || 0, s.z);
    _m4.compose(_p3, _q, _one); s.m = new Float32Array(16); _m4.toArray(s.m);
    _col.setHex(s.color ?? 0xffffff); s.cr = _col.r; s.cg = _col.g; s.cb = _col.b;
    this.slots.push(s); this.grid.add(s); s.pool = this; this.dirty = true;
  }
  remove(s) { this.grid.remove(s); const i = this.slots.indexOf(s); if (i >= 0) this.slots.splice(i, 1); s.pool = null; this.dirty = true; }
  refresh(px, pz) {
    const R = this.radius + PARK_M, c = this.cand, r2 = R * R;
    c.length = 0;
    this.grid.each(px, pz, R, (s) => { if (s.taken) return; const dx = s.x - px, dz = s.z - pz, d = dx * dx + dz * dz; if (d < r2) { s._d = d; c.push(s); } });
    const cap = Math.min(this.max, this.cap || this.max);
    if (c.length > cap) c.sort(byD);
    const n = Math.min(cap, c.length), A = this.rest.instanceMatrix.array, CC = this.rest.instanceColor.array;
    // (the far edge: gone at the radius - or, with more standing near than the pool can draw, at the farthest one it
    //  does draw less the margin - and whole `band` m short of that)
    const gone = c.length > cap ? Math.min(this.radius, Math.sqrt(c[n - 1]._d) - PARK_M) : this.radius, whole = gone - Math.min(this.band, gone * 0.3), PK = this.park.array;
    for (let i = 0; i < n; i++) { PK[i * 2] = whole; PK[i * 2 + 1] = gone; }
    this.park.needsUpdate = true;
    const gen = this.gen = (this.gen || 0) + 1;
    for (let i = 0; i < n; i++) {
      const s = c[i], o = i * 16;
      if (!s._gnd) groundSlot(s);          // stand on the drawn surface (pavement, path, road): sampled once, when first shown
      s._ig = gen; s._ii = i;              // (which instance it is this refresh: systems/_carfid.js hides the one it draws in detail)
      if (s._fid) { for (let j = 0; j < 16; j++) A[o + j] = 0; A[o + 12] = s.m[12]; A[o + 13] = -500; A[o + 14] = s.m[14]; }
      else for (let j = 0; j < 16; j++) A[o + j] = s.m[j];
      CC[i * 3] = s.cr; CC[i * 3 + 1] = s.cg; CC[i * 3 + 2] = s.cb;
    }
    for (const m of [this.rest, this.tint]) {
      if (!m) continue;
      m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      if (n) m.computeBoundingSphere();
      m.visible = n > 0;
    }
    this.dirty = false; this.shown = n;
  }
}
/** (car-fidelity pass) rewrite one shown slot's instance: collapsed out of sight while a detailed stand-in is drawn for it (s._fid) */
Pool.prototype.patch = function (s) {
  if (s._ig !== this.gen || !(s._ii < this.rest.count)) return;
  const A = this.rest.instanceMatrix.array, o = s._ii * 16;
  if (s._fid) { for (let j = 0; j < 16; j++) A[o + j] = 0; A[o + 12] = s.m[12]; A[o + 13] = -500; A[o + 14] = s.m[14]; }
  else for (let j = 0; j < 16; j++) A[o + j] = s.m[j];
  this.rest.instanceMatrix.needsUpdate = true;
};
const byD = (a, b) => a._d - b._d;
/**
 * Parked things stand on the surface that is drawn there (game.world.groundHeight: road 0.04, path 0.045, raised
 * pavement 0.13 ...), not on y = 0. Sampled lazily (place modules may still be wrapping groundHeight while the slots are
 * being made) and only once per slot. A bicycle takes the higher of its two wheel contact points.
 */
let _groundFn = null;
function groundSlot(s) {
  s._gnd = true;
  if (!_groundFn || s.kind === 'punt' || s.y) return;
  let h = _groundFn(s.x, s.z);
  if (s.kind === 'bike') { const T = TYPES[s.type], fx = Math.sin(s.h) * T.wb * 0.5, fz = Math.cos(s.h) * T.wb * 0.5; h = Math.max(_groundFn(s.x + fx, s.z + fz), _groundFn(s.x - fx, s.z - fz)); }
  if (!(h === h) || Math.abs(h) < 1e-4) return;
  s.y = h; s.m[13] = h;
}

// ---------------------------------------------------------------- the system
export default {
  id: 'vehicles',
  install(game) {
    const V = new Vehicles(game);
    game.vehicles = V.api;
    return { id: 'vehicles', update: (dt) => V.update(dt) };
  },
};

class Vehicles {
  constructor(game) {
    this.game = game;
    this.scene = game.worldScene;
    this.col = game.worldCollider;
    _groundFn = (x, z) => (game.world && game.world.groundHeight ? game.world.groundHeight(x, z) : 0);
    this.map = game.map;
    this.live = [];
    this.pools = new Map();
    this.cur = null;               // the vehicle the player is in
    this.t = 0; this.nextId = 1;
    this.cand = null;              // nearest enterable (live vehicle or slot)
    this.fallT = 0; this.lastPed = null; this.lastPedT = 0;
    this.config = { mudChance: 0.06, mudGrace: 25, maxLiveParked: 24 };
    this._ev = new Map();          // event hooks (on/off/_emit): take, knock, impact, enter, exit, busStop
    this.waterY = game.world && (game.world.waterY ?? game.world.waterLevel);
    if (typeof this.waterY !== 'number') this.waterY = 0;
    this.lastRefresh = { x: 1e9, z: 1e9, t: -10 }; this._pending = [];
    this.placed = { bikes: 0, stands: 0, cars: 0, punts: [], worcester: [] };
    this._mkPools();
    this.widx = new WaterIndex(this.col);
    // physics pass (2026-11): ground grip raster, pooled skid marks / puffs / debris (one draw each, hidden when empty)
    { const t1 = (typeof performance !== 'undefined' ? performance : Date).now(); this.surface = new Surface(this.map); this.surfaceMs = (typeof performance !== 'undefined' ? performance : Date).now() - t1; }
    this.skids = new SkidMarks(this.scene); this.puffs = new Puffs(this.scene);
    this.crashSnd = new CrashSound(game);      // crashes, knocks and scrapes, heard where they happen (systems/_crash_audio.js); hears other players' too
    this.debris = new Debris(this.scene, (x, z) => (_groundFn ? _groundFn(x, z) : 0));
    this.remoteBodies = [];        // other players' driven cars this frame (see _remotes)
    this._bodySrc = [];            // fn(add): other bodies owned by other players' clients (their police cars: systems/police.js, see addBodies)
    this._rk = 0; this._addBody = (ref, type, x, z, y, h, vx, vz, w) => this._addRemoteBody(ref, type, x, z, y, h, vx, vz, w);
    this._pred = new Map();        // other player id -> a tumble shown ahead of their own word for it (see _poseRemote)
    this._indexBuildings();
    this._indexRoads();
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    this._placeBikes();
    this._placeCars();
    this._placePunts();
    this._npcPunts();
    this.installMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    console.log(`[vehicles] parked: ${this.placed.bikes} bikes on ${this.placed.stands} stands, ${this.placed.cars} cars, ${this.placed.punts.reduce((a, p) => a + p.n, 0)} punts (${this.installMs.toFixed(0)} ms)`);
    for (const p of this.placed.punts) console.log(`[vehicles]   punts @ ${p.name}: ${p.n} moored around (${p.x.toFixed(1)}, ${p.z.toFixed(1)})${p.note ? ' - ' + p.note : ''}`);
    this._ui();
    this.api = this._api();
  }

  // ------------------------------------------------------------ setup helpers
  _mkPools() {
    const S = this.scene;
    // parked bikes and stands within 60 m (were 85: a bike is a few pixels beyond that; perf pass)
    for (const t of BIKE_TYPES) this.pools.set(t, new Pool(S, t, 110, 60, false));
    this.pools.set('stand', new Pool(S, 'stand', 160, 60, false));
    for (const t of ['car_hatch', 'car_saloon', 'taxi', 'van']) this.pools.set(t, new Pool(S, t, PARK_MAX[t], 130, true));   // 190 m before the perf pass
    this.pools.set('bus', new Pool(S, 'bus', 4, 250, true));
    this.pools.set('punt', new Pool(S, 'punt', 40, 320, false));
  }

  /** in the drink: water and not on a bridge */
  wet(x, z) { return this.isW(x, z) && !this.col.onBridge(x, z); }
  isW(x, z) { return this.widx.isWater(x, z); }

  _indexBuildings() {
    this.bgrid = new Grid(32);
    for (const b of this.map.buildings) {
      if (b.part || (b.minH || 0) > 2.5 || b.tags.building === 'roof') continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of b.poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      const e = { b, x0, x1, z0, z1, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
      // insert into every cell it overlaps
      for (let cx = Math.floor(x0 / 32); cx <= Math.floor(x1 / 32); cx++) for (let cz = Math.floor(z0 / 32); cz <= Math.floor(z1 / 32); cz++) {
        const k = this.bgrid.k(cx, cz); let a = this.bgrid.map.get(k); if (!a) this.bgrid.map.set(k, (a = [])); a.push(e);
      }
    }
  }
  inBuilding(x, z) {
    const a = this.bgrid.map.get(this.bgrid.k(Math.floor(x / 32), Math.floor(z / 32)));
    if (a) for (const e of a) if (x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1 && pointInPoly(x, z, e.b.poly)) {
      let hole = false; for (const h of e.b.holes || []) if (pointInPoly(x, z, h)) { hole = true; break; }
      if (!hole) return true;
    }
    return false;
  }
  /** Dry, unobstructed, outside buildings. */
  okSpot(x, z, r) { return !this.wet(x, z) && !this.inBuilding(x, z) && this.col.isFree(x, z, r); }
  /** is a circle (x, z, r) on a drawn carriageway (the streets the traffic and the player drive: the map's drivable roads at
   *  their drawn width, service roads 3.5 m and wider)? Bike stands and parked bikes are never put there (2026-11: rows of
   *  stands laid out from a bicycle_parking node at the kerb ran out into the road; the placement audit never saw them) */
  onCarriage(x, z, r) {
    const R = r + 8;
    for (let cx = Math.floor((x - R) / 20); cx <= Math.floor((x + R) / 20); cx++)
      for (let cz = Math.floor((z - R) / 20); cz <= Math.floor((z + R) / 20); cz++) {
        const l = this.rgrid.get(cx * 65536 + cz); if (!l) continue;
        for (const i of l) {
          const s = this.roadSegs[i], k = s.r.kind;
          if (!CARRIAGE_K.has(k) && !(k === 'service' && (s.r.w || 0) >= 3.5)) continue;
          if ((s.r.tunnel && s.r.tunnel !== 'building_passage') || s.r.covered || (s.r.layer && +s.r.layer < 0 && !s.r.bridge)) continue;
          const dx = s.x2 - s.x1, dz = s.z2 - s.z1, l2 = dx * dx + dz * dz || 1;
          const t = clamp(((x - s.x1) * dx + (z - s.z1) * dz) / l2, 0, 1);
          if (Math.hypot(x - s.x1 - dx * t, z - s.z1 - dz * t) < (s.r.w || 6.5) / 2 + r) return true;
        }
      }
    return false;
  }
  /** would a car parked here stand across a line the walkers cross the road on (game.pedestrians' graph: an edge whose
   *  middle is in the carriageway)? 2026-11: one did on St Giles', every walker crossing there wedged against it in the
   *  road, and the cyclist going round it stopped for them, with the whole street queued behind */
  _onWalkCrossing(type, x, z, h) {
    if (this._walkX === undefined) {
      this._walkX = null;
      const PS = this.game.pedestrians && this.game.pedestrians._sys, G = PS && PS.graph;
      if (G && PS.road) {
        const grid = new Map(); let n = 0;
        for (let i = 0; i < G.count; i++) for (let k = G.start[i]; k < G.start[i + 1]; k++) {
          const j = G.nbr[k]; if (j <= i) continue;
          const ax = G.X[i], az = G.Z[i], bx = G.X[j], bz = G.Z[j];
          if (!PS.road((ax + bx) / 2, (az + bz) / 2)) continue;
          const sg = [ax, az, bx, bz]; n++;
          for (let cx = Math.floor(Math.min(ax, bx) / 20); cx <= Math.floor(Math.max(ax, bx) / 20); cx++) for (let cz = Math.floor(Math.min(az, bz) / 20); cz <= Math.floor(Math.max(az, bz) / 20); cz++) { const kk = cx * 65536 + cz; let a = grid.get(kk); if (!a) grid.set(kk, (a = [])); a.push(sg); }
        }
        this._walkX = grid; this.placed.walkCrossings = n;
      }
    }
    if (!this._walkX) return false;
    const T = TYPES[type], fx = Math.sin(h), fz = Math.cos(h), hl = T.L / 2 + 0.7, hw = T.W / 2 + 0.7;
    for (let cx = Math.floor((x - 4) / 20); cx <= Math.floor((x + 4) / 20); cx++) for (let cz = Math.floor((z - 4) / 20); cz <= Math.floor((z + 4) / 20); cz++) {
      const a = this._walkX.get(cx * 65536 + cz); if (!a) continue;
      for (const sg of a) {
        const L = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]), n = Math.max(1, Math.ceil(L / 0.4));
        for (let k = 0; k <= n; k++) {
          const px = sg[0] + (sg[2] - sg[0]) * k / n - x, pz = sg[1] + (sg[3] - sg[1]) * k / n - z;
          if (Math.abs(px * fx + pz * fz) < hl && Math.abs(px * fz - pz * fx) < hw) return true;
        }
      }
    }
    return false;
  }
  /** a spot for a bike stand / a parked bike: okSpot, and off the carriageway */
  standOk(x, z, r) { return this.okSpot(x, z, r) && !this.onCarriage(x, z, 0.55); }     // (the whole tube, whichever way it points)
  /** Spiral search for an ok spot near (x,z). */
  findSpot(x, z, r, maxR = 12, from = null, test = null) {
    const okAt = test || ((px, pz, pr) => this.okSpot(px, pz, pr));
    if (okAt(x, z, r) && (!from || this.col.raycast(from[0], from[1], x, z) === null)) return [x, z];
    for (let rad = 0.6; rad <= maxR; rad += 0.6) {
      const n = Math.max(6, Math.round(rad * 5));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad;
        if (okAt(px, pz, r) && (!from || this.col.raycast(from[0], from[1], px, pz) === null)) return [px, pz];
      }
    }
    return null;
  }

  _indexRoads() {
    // segment grid over ALL roads/paths (for aligning bike stands and parked cars)
    const segs = []; this.roadSegs = segs; this.rgrid = new Map();
    for (const r of this.map.roads) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1], idx = segs.length;
        segs.push({ r, x1: a[0], z1: a[1], x2: b[0], z2: b[1] });
        for (let cx = Math.floor(Math.min(a[0], b[0]) / 20); cx <= Math.floor(Math.max(a[0], b[0]) / 20); cx++)
          for (let cz = Math.floor(Math.min(a[1], b[1]) / 20); cz <= Math.floor(Math.max(a[1], b[1]) / 20); cz++) {
            const k = cx * 65536 + cz; let l = this.rgrid.get(k); if (!l) this.rgrid.set(k, (l = [])); l.push(idx);
          }
      }
    }
  }
  /** Nearest road segment to (x,z) within maxD, optionally filtered by kind. Returns {d, dx, dz, px, pz, r} or null. */
  nearestRoad(x, z, maxD, kindFilter) {
    let best = null, bd = maxD;
    for (let cx = Math.floor((x - maxD) / 20); cx <= Math.floor((x + maxD) / 20); cx++)
      for (let cz = Math.floor((z - maxD) / 20); cz <= Math.floor((z + maxD) / 20); cz++) {
        const l = this.rgrid.get(cx * 65536 + cz); if (!l) continue;
        for (const i of l) {
          const s = this.roadSegs[i]; if (kindFilter && !kindFilter(s.r)) continue;
          const dx = s.x2 - s.x1, dz = s.z2 - s.z1, l2 = dx * dx + dz * dz || 1;
          const t = clamp(((x - s.x1) * dx + (z - s.z1) * dz) / l2, 0, 1), px = s.x1 + dx * t, pz = s.z1 + dz * t, d = Math.hypot(x - px, z - pz);
          if (d < bd) { bd = d; const L = Math.sqrt(l2); best = { d, dx: dx / L, dz: dz / L, px, pz, r: s.r }; }
        }
      }
    return best;
  }

  _slot(type, x, z, h, extra) {
    const T = TYPES[type];
    const s = Object.assign({ static: true, parked: true, type, kind: T ? T.kind : 'stand', x, z, h, heading: h, y: 0, lean: 0, color: T ? T.colors[0] : 0x777777, taken: false }, extra);
    this.pools.get(type).add(s);
    return s;
  }

  // ------------------------------------------------------------ bicycles
  _bikeType(r) { const u = r(); return u < 0.45 ? 'bike_roadster' : u < 0.7 ? 'bike_road' : 'bike_mtb'; }
  _addBike(r, x, z, h, lean = 0, type = null) {
    type = type || this._bikeType(r);
    const cols = TYPES[type].colors;
    // bikes must be dry and outside buildings at both wheels
    const fx = Math.sin(h) * 0.55, fz = Math.cos(h) * 0.55;
    if (this.wet(x, z) || this.inBuilding(x + fx, z + fz) || this.inBuilding(x - fx, z - fz) || this.inBuilding(x, z)) return null;
    if (this.onCarriage(x + fx, z + fz, 0.2) || this.onCarriage(x - fx, z - fz, 0.2)) return null;     // (both wheels off the road)
    if (SANITY && !this._bikeFits(x, z, h)) return null;
    this.placed.bikes++;
    return this._slot(type, x, z, h, { color: cols[Math.floor(r() * cols.length)], lean });
  }

  /** the rest of what a parked bike needs (2026-11 sanity check: bikes stood inside hedges, with a wheel in a wall or
   *  half up a kerb): the whole machine, tyre tip to tyre tip, clear of buildings, of the DRAWN thickness of walls and
   *  hedges (_clearance.js) and of anything solid in the collider (trunks, posts, walls a place module built), and both
   *  wheels on one level. Used when a bike is placed and again by _pruneBikes once every place module is installed. */
  _bikeFits(x, z, h) {
    const sx = Math.sin(h), sz = Math.cos(h), col = this.col;
    for (const u of [-0.85, -0.45, 0, 0.45, 0.85]) {
      const px = x + sx * u, pz = z + sz * u;
      if (this.inBuilding(px, pz) || barrierGap(col, px, pz, 0.5) < 0.08 || !col.isFree(px, pz, 0.1)) return false;
    }
    if (_groundFn && Math.abs(_groundFn(x + sx * 0.55, z + sz * 0.55) - _groundFn(x - sx * 0.55, z - sz * 0.55)) > 0.07) return false;
    return true;
  }

  /** First frame, once the place modules are installed and the streetscape has laid its items: a parked bike or one of
   *  our own stands that something now stands in or through (a module's wall or portico, a lamp post, a bin, a bench, a
   *  parked car), or whose stand a module cleared away (world.clearArea), goes. The same for every player. */
  _pruneBikes() {
    const W = this.game.world, SS = this.game.streetscape, col = this.col;
    const obst = new Map(), put = (x, z, r) => { const k = Math.floor(x / 8) * 65536 + Math.floor(z / 8); let a = obst.get(k); if (!a) obst.set(k, (a = [])); a.push(x, z, r); };
    if (SS && SS.all) for (const it of SS.all) if (!it.gone && it.k !== 'bike' && it.k !== 'basket') put(it.x, it.z, it.type ? 0.13 : it.r || (it.box ? Math.min(it.box[0], it.box[1]) / 2 : 0.1));
    const FR = { bench: 0.3, bin: 0.25, postBox: 0.28, busStop: 0.06, shelter: 0.75, phone: 0.5, signal: 0.1, bollard: 0.1, belisha: 0.06, picnic: 0.8 };
    if (W && W.furniture) for (const [k, st] of Object.entries(W.furniture.sets)) { const rr = FR[k]; if (rr) for (let i = 0; i < st.n; i++) { const x = st.xz[i * 2], z = st.xz[i * 2 + 1]; if (Math.abs(x) < 1e8) put(x, z, rr); } }
    // (and the trunks of the drawn trees: the planes the world plants on St Giles' and the like have no collider)
    const far = W && W.vegetation && W.vegetation.sets && W.vegetation.sets.find((q) => q.name === 'trees:far');
    if (far) for (let i = 0; i < far.n; i++) { const x = far.xz[i * 2], z = far.xz[i * 2 + 1]; if (!(Math.abs(x) < 1e8)) continue; const m = far.mat, sx = Math.hypot(m[i * 16], m[i * 16 + 1], m[i * 16 + 2]), yaw = Math.atan2(m[i * 16 + 8], m[i * 16 + 10]); if (Math.round(yaw / 0.9 + 2.5) !== 5) put(x, z, Math.max(0.15, sx * 0.02)); }     // (species 5 = a bush)
    const hit = (x, z, r) => {
      for (let cx = Math.floor((x - 2) / 8); cx <= Math.floor((x + 2) / 8); cx++) for (let cz = Math.floor((z - 2) / 8); cz <= Math.floor((z + 2) / 8); cz++) {
        const a = obst.get(cx * 65536 + cz); if (a) for (let i = 0; i < a.length; i += 3) if (Math.hypot(a[i] - x, a[i + 1] - z) < a[i + 2] + r) return true;
      }
      return false;
    };
    const live = new Set(); for (const q of (W && W.bikeStands) || []) live.add(q);
    let n = 0;
    this.pools.forEach((pl) => {
      const stand = pl.type === 'stand'; if (!stand && !/^bike_/.test(pl.type)) return;
      for (let i = pl.slots.length - 1; i >= 0; i--) {
        const s = pl.slots[i]; if (s.taken) continue;
        const sx = Math.sin(s.h), sz = Math.cos(s.h), half = stand ? 0.38 : 0.85;
        let bad = (s.stand && !live.has(s.stand)) || (!stand && !this._bikeFits(s.x, s.z, s.h));
        for (const u of [-1, -0.5, 0, 0.5, 1]) { if (bad) break; const px = s.x + sx * u * half, pz = s.z + sz * u * half; if (hit(px, pz, 0.08) || (stand && (!col.isFree(px, pz, 0.05) || barrierGap(col, px, pz, 0.5) < 0.03))) bad = true; }
        if (bad) { pl.remove(s); n++; }
      }
    });
    this.placed.prunedBikes = n; this._prunedBikes = true;
  }

  _placeBikes() {
    const r = rng(1906), col = this.col;
    // 1) the bike parks: the world's rows of Sheffield stands (world/furniture.js: ONE layout, kept clear of walls,
    // hedges, kerbs and the road there) with bikes either side
    const WS = SANITY && this.game.world && this.game.world.bikeStands;
    if (WS) {
      let poi = null, occ = 0.6;
      for (const q of WS) {
        if (q.poi !== poi) { poi = q.poi; occ = 0.35 + r() * 0.55; }
        const ax = Math.cos(q.heading), az = -Math.sin(q.heading);       // along the row (across the bikes)
        this.placed.stands++;
        for (const side of [-1, 1]) {
          if (r() > occ) continue;
          const s = this._addBike(r, q.x + ax * side * 0.3, q.z + az * side * 0.3, q.heading + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.08);
          if (s) s.stand = q;
        }
      }
    }
    // (no world rows - a test rig without the world's furniture, or ?sanity=0: lay the rows out here, as before)
    else for (const p of this.map.pois) {
      if (p.kind !== 'bicycle_parking') continue;
      const [px, pz] = p.p;
      const cap = clamp(parseInt(p.capacity, 10) || 6, 2, 60);
      const rows = cap > 28 ? 2 : 1, stands = clamp(Math.ceil(cap / 2 / rows), 1, 14);
      const road = this.nearestRoad(px, pz, 25);
      let ax, az;  // row direction
      if (road) { ax = road.dx; az = road.dz; } else { const a = r() * TAU; ax = Math.cos(a); az = Math.sin(a); }
      const nx = -az, nz = ax, occ = 0.35 + r() * 0.55;
      const bh = Math.atan2(nx, nz);                 // bikes perpendicular to the row
      for (let row = 0; row < rows; row++) {
        const ro = (row - (rows - 1) / 2) * 2.6;
        for (let j = 0; j < stands; j++) {
          const u = (j - (stands - 1) / 2) * 0.95;
          const sx = px + ax * u + nx * ro, sz = pz + az * u + nz * ro;
          if (!this.standOk(sx, sz, 0.2)) continue;
          this._slot('stand', sx, sz, bh, { color: 0x888888 }); this.placed.stands++;
          for (const side of [-1, 1]) {
            if (r() > occ) continue;
            this._addBike(r, sx + ax * side * 0.3, sz + az * side * 0.3, bh + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.08);
          }
        }
      }
    }
    // 2) bikes chained to railings / fences / college walls along central streets
    const streets = new Set(['Broad Street', 'Turl Street', 'Catte Street', 'Parks Road', "St Giles'", 'Holywell Street', 'Merton Street', 'Beaumont Street',
      'Walton Street', 'Pembroke Street', 'Blue Boar Street', 'Ship Street', 'Magdalen Street', 'Keble Road', 'Banbury Road', 'Woodstock Road',
      'Worcester Street', 'New Inn Hall Street', 'St Michael\'s Street', 'Longwall Street', 'Queen\'s Lane', 'New College Lane', 'Mansfield Road',
      'South Parks Road', 'Little Clarendon Street', 'Wellington Square', 'Pusey Street', 'St John Street', 'Brewer Street', 'Rose Lane', 'Alfred Street']);
    let railCount = 0; const RAY = { hit: {} };
    for (const road of this.map.roads) {
      if (!road.name || !streets.has(road.name) || road.bridge || road.tunnel) continue;
      const boost = road.name === 'Broad Street' ? 0.85 : 0.45, rid = strHash(road.id);
      let s = 0;
      for (let i = 0; i < road.pts.length - 1 && railCount < 420; i++) {
        const [x1, z1] = road.pts[i], [x2, z2] = road.pts[i + 1];
        const L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.5) continue;
        const dx = (x2 - x1) / L, dz = (z2 - z1) / L, lx = dz, lz = -dx;
        for (let u = 0.5; u < L; u += 1.05, s += 1.05) {
          for (const side of [1, -1]) {
            const bin = Math.floor(s / 10);
            if (hash2(rid + side, bin) > boost || r() > 0.7) continue;
            const kx = x1 + dx * u + lx * side * (road.w / 2 + 0.8), kz = z1 + dz * u + lz * side * (road.w / 2 + 0.8);
            const reach = 4.5, ex = kx + lx * side * reach, ez = kz + lz * side * reach;
            const t = col.raycast(kx, kz, ex, ez, RAY);
            // (leant against the DRAWN face of what the ray met: a hedge is 0.45 m of leaves either side of its line)
            const face = (SANITY && RAY.hit.s && BARRIER_HALF[RAY.hit.s.tag]) || 0;
            if (t === null || t * reach - face < 0.6) continue;
            const d = t * reach - face - (SANITY ? 0.34 : 0.32), bx = kx + lx * side * d, bz = kz + lz * side * d;
            if (!col.isFree(bx, bz, 0.18)) continue;
            const h = Math.atan2(dx, dz) + (r() < 0.5 ? Math.PI : 0);
            // lean towards the wall: wall is on the bike's local +x (left) if (lx*side) . left(h) > 0
            const leftX = Math.cos(h), leftZ = -Math.sin(h), wallLeft = lx * side * leftX + lz * side * leftZ > 0;
            if (this._addBike(r, bx, bz, h, wallLeft ? -0.14 : 0.14)) railCount++;
          }
        }
      }
    }
    this.placed.railBikes = railCount;
    // 3) Worcester College: guaranteed bikes outside the lodge on Walton Street and inside by the Worcester Place gate
    const wor = this.placed.worcester;
    for (let i = 0; i < 7; i++) {
      const z = 3.8 + i * 0.95 + (i >= 3 ? 3.6 : 0);       // skip the lodge gateway around z = 8.6
      const t = col.raycast(-215.5, z, -229, z, RAY);
      let x = t !== null ? -215.5 - t * 13.5 + (SANITY ? 0.3 + ((RAY.hit.s && BARRIER_HALF[RAY.hit.s.tag]) || 0) : 0.34) : -221.5;
      const sp = this.okSpot(x, z, 0.15) ? [x, z] : this.findSpot(-214, z, 0.2, 4);
      if (!sp) continue;
      const s = this._addBike(r, sp[0], sp[1], (i % 2 ? Math.PI : 0) + 0.06, t !== null ? (i % 2 ? 0.13 : -0.13) : 0, i < 3 ? 'bike_roadster' : null);
      if (s) wor.push([+sp[0].toFixed(1), +sp[1].toFixed(1)]);
    }
    // and a short row of stands on the forecourt itself, around (-214, 14)
    const fore = this.findSpot(-214, 14, 0.9, 6);
    if (fore) {
      const road = this.nearestRoad(fore[0], fore[1], 30, (r) => r.name === 'Walton Street' || r.name === 'Beaumont Street');
      const ax = road ? road.dx : 0, az = road ? road.dz : 1, h = Math.atan2(-az, ax);
      for (let i = 0; i < 3; i++) {
        const u = (i - 1) * 0.95, x = fore[0] + ax * u, z = fore[1] + az * u;
        if (!this.standOk(x, z, 0.2)) continue;
        this._slot('stand', x, z, h, { color: 0x888888 }); this.placed.stands++;
        for (const sd of [-1, 1]) { const s = this._addBike(r, x + ax * sd * 0.3, z + az * sd * 0.3, h + (sd > 0 ? Math.PI : 0)); if (s) wor.push([+s.x.toFixed(1), +s.z.toFixed(1)]); }
      }
    }
    const back = this.findSpot(-300, -138, 0.9, 14, null, (x, z, r) => this.okSpot(x, z, r) && !this.onCarriage(x, z, 1.4));     // (a row off the road, by the gate)
    if (back) {
      const road = this.nearestRoad(back[0], back[1], 30);
      const ax = road ? road.dx : 1, az = road ? road.dz : 0, h = Math.atan2(-az, ax);
      for (let i = 0; i < 6; i++) {
        const u = (i - 2.5) * 0.8, x = back[0] + ax * u, z = back[1] + az * u;
        // (a spot off the lane itself: Worcester Place is a service road)
        const bikeOk = (px, pz, pr) => this.okSpot(px, pz, pr) && !this.onCarriage(px, pz, 0.3);
        const sp = bikeOk(x, z, 0.2) ? [x, z] : this.findSpot(x, z, 0.2, 4, null, bikeOk);
        if (!sp) continue;
        if (i % 2 === 0 && this.standOk(sp[0] + ax * 0.3, sp[1] + az * 0.3, 0.2)) { this._slot('stand', sp[0] + ax * 0.3, sp[1] + az * 0.3, h, { color: 0x888888 }); this.placed.stands++; }
        const s = this._addBike(r, sp[0], sp[1], h + (i % 3 === 0 ? Math.PI : 0), 0);
        if (s) wor.push([+sp[0].toFixed(1), +sp[1].toFixed(1)]);
      }
    }
  }

  // ------------------------------------------------------------ parked cars
  _carType(r) { const u = r(); return u < 0.42 ? 'car_hatch' : u < 0.74 ? 'car_saloon' : u < 0.9 ? 'van' : 'taxi'; }
  _carFits(type, x, z, h, r = null, boxClash = false) {
    const T = TYPES[type], fx = Math.sin(h), fz = Math.cos(h), off = T.L / 2 - T.W / 2;
    for (const o of [-off, 0, off]) {
      const px = x + fx * o, pz = z + fz * o;
      if (this.isW(px, pz) || this.col.onBridge(px, pz) || this.inBuilding(px, pz) || !this.col.isFree(px, pz, T.W / 2)) return false;
    }
    let clash = false;
    // (boxClash: the real footprints, 25 cm apart - echelon and centre bays stand side by side, closer than their lengths)
    if (boxClash) this.pools.forEach((p) => { if (!clash && TYPES[p.type] && TYPES[p.type].kind === 'car') p.grid.each(x, z, 7, (s) => { if (!clash && boxGap(T, x, z, h, TYPES[s.type], s.x, s.z, s.h) < 0.25) clash = true; }); });
    else this.pools.forEach((p) => { if (!clash && TYPES[p.type] && TYPES[p.type].kind === 'car') p.grid.each(x, z, 7, (s) => { if (Math.hypot(s.x - x, s.z - z) < (T.L + TYPES[s.type].L) / 2 + 0.4) clash = true; }); });
    return !clash;
  }
  /**
   * Highway Code spots a parked car may not stand on (2026-11 motion / placement pass): within 10 m of a junction (the
   * side road's mouth: half its width + 5 m beyond the node), on the zig-zags of a zebra / by signals (11.5 m / 8 m along
   * the road from the crossing, 4 m for an unmarked one), across a gate, entrance or drive, across a mapped path. Returns
   * ok(type, x, z, h). Built once (grids of points / segments); pure geometry on the map.
   */
  _keepClear() {
    const map = this.map, DRV = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
    const nk = (p) => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10), use = new Map();
    for (const r of map.roads) {
      if (!DRV.has(r.kind) || !r.pts || r.pts.length < 2) continue;
      r.pts.forEach((p, i) => { const k = nk(p); let n = use.get(k); if (!n) use.set(k, (n = { x: p[0], z: p[1], deg: 0, w: 0 })); n.deg += i === 0 || i === r.pts.length - 1 ? 1 : 2; n.w = Math.max(n.w, r.w || 6.5); });
    }
    const pts = [], add = (o) => pts.push(o);
    for (const n of use.values()) if (n.deg >= 3) add({ x: n.x, z: n.z, r: n.w / 2 + 5, t: 'j' });
    for (const p of map.pois) {
      if (p.kind !== 'crossing' && p.kind !== 'traffic_signals') continue;
      add({ x: p.p[0], z: p.p[1], r: p.crossing === 'zebra' || p.crossing === 'marked' ? 11.5 : p.kind === 'traffic_signals' ? 8 : 4, t: 'c' });
    }
    for (const g of map.gates) if (g.kind !== 'bollard') add({ x: g.p[0], z: g.p[1], r: 1.6, t: 'g' });
    if (BUSY) {
      // (busy-streets pass) a bus stop's cage (13 m either way along the road) and the taxi ranks' queues
      for (const p of map.pois) if (p.kind === 'bus_stop') add({ x: p.p[0], z: p.p[1], r: 13, t: 'c' });
      const TR = this.game.traffic && this.game.traffic.ranks;
      if (TR) for (const rk of TR) { add({ x: rk.x, z: rk.z, r: 4, t: 'g' }); for (const sl of rk.slots) add({ x: sl.x, z: sl.z, r: 3.4, t: 'g' }); }
    }
    const grid = new Map(), C = 16, key = (cx, cz) => cx * 65536 + cz;
    for (const o of pts) for (let cx = Math.floor((o.x - o.r - 3) / C); cx <= Math.floor((o.x + o.r + 3) / C); cx++) for (let cz = Math.floor((o.z - o.r - 3) / C); cz <= Math.floor((o.z + o.r + 3) / C); cz++) { let a = grid.get(key(cx, cz)); if (!a) grid.set(key(cx, cz), (a = [])); a.push(o); }
    const segs = new Map();
    for (const r of map.roads) {
      if (!['footway', 'path', 'cycleway', 'service', 'bridleway', 'track', 'steps', 'pedestrian'].includes(r.kind) || !r.pts) continue;
      if (r.footway === 'crossing') continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1], q = [a[0], a[1], b[0], b[1], (r.w || 2) / 2];
        for (let cx = Math.floor((Math.min(a[0], b[0]) - 3) / C); cx <= Math.floor((Math.max(a[0], b[0]) + 3) / C); cx++) for (let cz = Math.floor((Math.min(a[1], b[1]) - 3) / C); cz <= Math.floor((Math.max(a[1], b[1]) + 3) / C); cz++) { let l = segs.get(key(cx, cz)); if (!l) segs.set(key(cx, cz), (l = [])); l.push(q); }
      }
    }
    return (type, x, z, h) => {
      const T = TYPES[type], hd = T.L / 2, fx = Math.sin(h), fz = Math.cos(h), k = key(Math.floor(x / C), Math.floor(z / C));
      for (const o of grid.get(k) || []) {
        if (o.t === 'c') { const along = Math.abs((o.x - x) * fx + (o.z - z) * fz), d = Math.hypot(o.x - x, o.z - z); if (d < 14 && along < o.r + hd) return false; }
        else if (Math.hypot(o.x - x, o.z - z) - hd < o.r) return false;
      }
      // a path or drive running under the car's footprint (sampled along its length)
      for (const q of segs.get(k) || []) for (const u of [-hd + 0.4, 0, hd - 0.4]) {
        const px = x + fx * u, pz = z + fz * u, dx = q[2] - q[0], dz = q[3] - q[1], l2 = dx * dx + dz * dz;
        let t = l2 ? ((px - q[0]) * dx + (pz - q[1]) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (Math.hypot(px - q[0] - dx * t, pz - q[1] - dz * t) < q[4] + T.W / 2 - 0.3) return false;
      }
      return true;
    };
  }
  _addCar(type, x, z, h, color) {
    const T = TYPES[type];
    const segs = this.col.addBox(x, z, T.W, T.L, h, { tag: 'car', low: true, top: standTop(type) });
    this.placed.cars++;
    return this._slot(type, x, z, h, { color, segs });
  }
  /**
   * Where a car of this type parks beside the kerb for a street candidate [cx, cz, h, rnd, nx, nz, roadW, oneway] (centre
   * line point + the unit normal towards its kerb): its whole footprint on the carriageway as drawn
   * (world.groundHeight: road 0.04, pavement 0.13 behind a short kerb ramp), nudged in from the kerb if a corner would
   * be on the ramp; null where it cannot fit or would stand in the lane the AI traffic drives along (traffic.js keeps
   * left: lane centre w/4 from the middle on roads >= 8 m, ~0.95 m on narrower two-way streets, the middle if one-way).
   */
  _kerbside(type, c) {
    const T = TYPES[type], w = c[6], nx = c[4], nz = c[5], h = c[2], fx = Math.sin(h), fz = Math.cos(h);
    // (on the bus streets, a bus as drawn - mirrors, 1.32 m - rather than a van: a bus on Magdalen Street ran its mirror 10 cm
    // into a saloon parked in a bay laid for vans)
    const lane = (c[7] ? 0 : w >= 8 ? w / 4 : Math.min(0.95, w * 0.15)) + (c[8] ? 1.32 : 1.05) + 0.1;      // outer edge of a passing AI car (traffic.js: van radius 1.05) + 10 cm
    const gh = this.game.world && this.game.world.groundHeight ? (x, z) => this.game.world.groundHeight(x, z) : null;
    for (let off = w / 2 - T.W / 2 - 0.1, n = 0; n < 4; n++, off -= 0.15) {
      if (off - T.W / 2 < lane) return null;
      const x = c[0] + nx * off, z = c[1] + nz * off;
      let ok = true;
      if (gh) for (const u of [-1, 0, 1]) { const hh = gh(x + fx * u * (T.L / 2 - 0.1) + nx * T.W / 2, z + fz * u * (T.L / 2 - 0.1) + nz * T.W / 2); if (hh > 0.09) { ok = false; break; } }
      if (ok) return this._straddles(type, x, z, h) ? null : [x, z];
    }
    return null;
  }
  /** Would a parked car here stand half on something raised (a kerb, a pavement, a path edge)? Corners vs the drawn surface. */
  _straddles(type, x, z, h) {
    const w = this.game.world; if (!w || !w.groundHeight) return false;
    const T = TYPES[type], fx = Math.sin(h), fz = Math.cos(h), hl = T.L / 2 - 0.1, hw = T.W / 2;
    let lo = w.groundHeight(x, z), hi = lo;
    for (const u of [-1, 1]) for (const s of [-1, 1]) { const g = w.groundHeight(x + fx * u * hl + fz * s * hw, z + fz * u * hl - fx * s * hw); if (g < lo) lo = g; if (g > hi) hi = g; }
    return hi - lo > 0.05;
  }
  _placeCars() {
    const r = rng(1555), cand = [];
    let street = 0;
    if (BUSY) { street = this._parkStreets(this._keepClear()); this.placed.streetCars = street; }
    // kerbside on residential / unclassified streets: the whole car stands in the carriageway, against the kerb (never
    // half up on the pavement), and only where that leaves the running lane clear; see _kerbside()
    // (the busy-streets pass replaces this with _parkStreets; ?busy=0 keeps it)
    if (!BUSY) for (const road of this.map.roads) {
      if ((road.kind !== 'residential' && road.kind !== 'unclassified') || road.bridge || road.tunnel || road.covered) continue;
      if (road.access === 'private' || road.access === 'no' || road.w > 8.5 || road.w < 5) continue;
      let s = 0; const total = road.pts.reduce((a, p, i) => i ? a + Math.hypot(p[0] - road.pts[i - 1][0], p[1] - road.pts[i - 1][1]) : 0, 0);
      for (let i = 0; i < road.pts.length - 1; i++) {
        const [x1, z1] = road.pts[i], [x2, z2] = road.pts[i + 1];
        const L = Math.hypot(x2 - x1, z2 - z1); if (L < 1) { s += L; continue; }
        const dx = (x2 - x1) / L, dz = (z2 - z1) / L, lx = dz, lz = -dx;
        const ow = road.oneway === 'yes' || road.oneway === '-1' || road.oneway === 'true' || road.oneway === '1', tdir = road.oneway === '-1' ? -1 : 1;
        for (let u = 3; u < L - 3; u += 6.2) {
          const sa = s + u;
          if (sa < 11 || sa > total - 11) continue;
          // one-way streets: only along the right-hand kerb, facing the way the traffic goes (AI cyclists ride along the left one)
          for (const side of [1, -1]) { const park = r() < 0.5, q = r(); if (park && (!ow || side === -tdir)) cand.push([x1 + dx * u, z1 + dz * u, ow ? Math.atan2(dx * tdir, dz * tdir) : Math.atan2(dx * side, dz * side), q, lx * side, lz * side, road.w, ow, BUS_NAMES.has(road.name)]); }
        }
        s += L;
      }
    }
    cand.sort((a, b) => a[3] - b[3]);
    const keep = this._keepClear();
    for (const c of cand) {
      if (street >= 600) break;
      const type = this._carType(r), at = this._kerbside(type, c);
      if (!at || !this._carFits(type, at[0], at[1], c[2]) || !keep(type, at[0], at[1], c[2]) || this._onWalkCrossing(type, at[0], at[1], c[2])) continue;
      const cols = TYPES[type].colors;
      const sl = this._addCar(type, at[0], at[1], c[2], cols[Math.floor(r() * cols.length)]); if (sl) sl.kerb = true; street++;
    }
    // car parks: rows aligned to the longest edge
    let lots = 0;
    for (const a of this.map.areas) {
      if (a.kind !== 'parking' || lots >= 380) continue;
      const P = a.poly; let best = 0, ax = 1, az = 0, area = 0;
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
        area += p[0] * q[1] - q[0] * p[1];
        if (l > best) { best = l; ax = (q[0] - p[0]) / l; az = (q[1] - p[1]) / l; }
      }
      if (Math.abs(area) / 2 < 140) continue;
      const nx = -az, nz = ax;
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const [x, z] of P) { const u = x * ax + z * az, v = x * nx + z * nz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      let n = 0;
      for (let v = v0 + 3; v < v1 - 2.4 && n < 40; v += 6.4) {
        const flip = Math.round((v - v0) / 6.4) % 2;
        for (let u = u0 + 1.6; u < u1 - 1.3 && n < 40; u += 2.6) {
          if (r() > 0.55) continue;
          const x = ax * u + nx * v, z = az * u + nz * v;
          if (!pointInPoly(x, z, P) || !pointInPoly(x + nx * 2.4, z + nz * 2.4, P) || !pointInPoly(x - nx * 2.4, z - nz * 2.4, P)) continue;
          const h = Math.atan2(nx, nz) + (flip ? Math.PI : 0), type = this._carType(r);
          if (type === 'taxi' && r() < 0.7) continue;
          if (!this._carFits(type, x, z, h) || this._straddles(type, x, z, h) || !keep(type, x, z, h)) continue;      // (not half up a kerb at the edge of the car park, nor across its path / entrance)
          const cols = TYPES[type].colors;
          this._addCar(type, x, z, h, cols[Math.floor(r() * cols.length)]); n++; lots++;
        }
      }
    }
    this.placed.streetCars = street; this.placed.lotCars = lots;
    if (BUSY) {
      this._rankQueues();
      // the lanes, runs and bus stop lines of the streets we have just parked along (systems/traffic.js parkedRoom)
      const TS = this.game.traffic && this.game.traffic._sys, kerb = [];
      this.pools.forEach((p) => { if (TYPES[p.type] && TYPES[p.type].kind === 'car') for (const s of p.slots) if (s.kerb) kerb.push(s); });
      if (TS && TS.parkedRoom) { try { TS.parkedRoom(kerb); } catch (e) { console.warn('[vehicles] parkedRoom', e); } }
    }
  }

  /**
   * Busy-streets pass (2026-11; photo comparison item 1): the kerbs of the streets where people really park are lined.
   *  - kerbside rows on residential / unclassified streets (Jericho, North Oxford, East Oxford, the Cowley Road side
   *    streets, Headington) and on PARK_NAMED (Beaumont Street, Walton Street); not on NO_PARK, not on a street closed to
   *    motors by bollards. Both kerbs where two cars still pass between the rows (two buses on a bus street), one kerb
   *    (the side by a hash of the way) where one lane is left, none narrower. Cars stand in the carriageway against the
   *    kerb (never half on the pavement), nose to tail with gaps, facing the way the traffic on that side goes;
   *  - St Giles': echelon bays along both outer kerbs (ECHELON), saloons and hatchbacks at 30-35 degrees;
   *  - Broad Street: the painted centre bays, two rows nose to nose (CENTRE_BAYS).
   * Never within 10 m of a junction, on a crossing's zig-zags, by a bus stop or a rank, across a drive, gate or path, or on
   * a walkers' crossing line (_keepClear, _onWalkCrossing). Deterministic (seeded per way): the same for every player.
   * traffic.parkedRoom then narrows the lanes to what is left. Returns the number placed.
   */
  _parkStreets(keep) {
    const TS = this.game.traffic && this.game.traffic._sys, closed = new Set();
    // (the room the traffic measured between the walls, per way: where buildings stand inside the mapped width, a parked
    // row would leave no lane at all)
    const room = new Map();
    if (TS) for (const e of TS.edges) { if (e.closedMotor) closed.add(e.road.id); const f = e.freeL + e.freeR - 0.4; room.set(e.road.id, Math.min(room.get(e.road.id) ?? Infinity, f)); }
    const gh = this.game.world && this.game.world.groundHeight ? (x, z) => this.game.world.groundHeight(x, z) : null;
    const echEdges = TS ? TS.edges.filter((e) => e.road.name === ECHELON.name && e.oneway) : [];
    const echOk = (x, z) => {
      let best = null, bd = Infinity;
      for (const e of echEdges) { const c = TS._project(e, x, z); if (c.s > 0 && c.s < e.len && Math.abs(c.lat) < bd) { bd = Math.abs(c.lat); best = e; } }
      if (!best || bd > 6) return false;
      if (best._straight === undefined) {
        const n = best.xs.length, ax = best.xs[0], az = best.zs[0], bx = best.xs[n - 1], bz = best.zs[n - 1], L = Math.hypot(bx - ax, bz - az) || 1;
        let dev = 0; for (let i = 1; i < n - 1; i++) dev = Math.max(dev, Math.abs((best.xs[i] - ax) * (bz - az) / L - (best.zs[i] - az) * (bx - ax) / L));
        let bend = 1; for (let i = 1; i < n - 1; i++) { const ux = best.xs[i] - best.xs[i - 1], uz = best.zs[i] - best.zs[i - 1], vx = best.xs[i + 1] - best.xs[i], vz = best.zs[i + 1] - best.zs[i]; bend = Math.min(bend, (ux * vx + uz * vz) / ((Math.hypot(ux, uz) * Math.hypot(vx, vz)) || 1)); }
        best._straight = dev < 0.6 && bend > 0.996;
      }
      return best._straight;
    };
    const kerbType = (u) => (u < 0.44 ? 'car_hatch' : u < 0.8 ? 'car_saloon' : u < 0.965 ? 'van' : 'taxi');
    const colour = (r, type) => { const c = TYPES[type].colors; return c[Math.floor(r() * c.length)]; };
    const isOw = (road) => road.oneway === 'yes' || road.oneway === '-1' || road.oneway === 'true' || road.oneway === '1';
    let n = 0, nEch = 0, nBay = 0;
    const stats = (this.placed.parkStats = { roads: 0, both: 0, one: 0 });
    const cumOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };
    // a whole car on the carriageway at the kerb: nudged in (up to 45 cm) while a kerb-side corner is on the kerb ramp
    const atKerb = (type, P, nx, nz, h, w) => {
      const T = TYPES[type], fx = Math.sin(h), fz = Math.cos(h);
      for (let off = w / 2 - T.W / 2 - 0.12, k = 0; k < 4; k++, off -= 0.15) {
        const x = P.x + nx * off, z = P.z + nz * off;
        let ok = true;
        if (gh) for (const u of [-1, 0, 1]) { const hh = gh(x + fx * u * (T.L / 2 - 0.1) + nx * T.W / 2, z + fz * u * (T.L / 2 - 0.1) + nz * T.W / 2); if (hh > 0.09) { ok = false; break; } }
        if (ok) return off - T.W / 2 < w / 2 - lim ? null : this._straddles(type, x, z, h) ? null : [x, z];      // (never into the lane left free)
      }
      return null;
    };
    let lim = 2.12;
    const place = (type, x, z, h, r, box, extra) => {
      if (!this._carFits(type, x, z, h, null, box) || !keep(type, x, z, h) || this._onWalkCrossing(type, x, z, h)) return false;
      const sl = this._addCar(type, x, z, h, colour(r, type)); sl.kerb = true; sl.road = curRoad; if (extra) Object.assign(sl, extra);
      return true;
    };

    let curRoad = '';
    for (const road of this.map.roads) {
      if (!road.pts || road.pts.length < 2 || road.bridge || road.tunnel || road.covered || (road.layer && +road.layer !== 0)) continue;
      curRoad = road.id;
      if (road.access === 'private' || road.access === 'no' || closed.has(road.id)) continue;
      const r = rng(strHash(road.id) ^ 0x5bd1e995), pts = road.pts, cum = cumOf(pts), total = cum[cum.length - 1], w0 = road.w || 6.5;
      // ---- Broad Street's centre bays
      if (road.id === CENTRE_BAYS.road) {
        for (let d = CENTRE_BAYS.from + CENTRE_BAYS.step / 2; d < total - CENTRE_BAYS.from; d += CENTRE_BAYS.step) {
          const P = polyAt(pts, cum, d, _pa), nx = P.dz, nz = -P.dx;
          for (const side of [1, -1]) {
            if (r() > 0.86) continue;
            const type = r() < 0.5 ? 'car_hatch' : 'car_saloon';
            // (nose in towards the middle line, its tail 20 cm in from the bay's outer end)
            const T = TYPES[type], c = side * (CENTRE_BAYS.depth - T.L / 2 - 0.2);
            if (place(type, P.x + nx * c, P.z + nz * c, Math.atan2(-nx * side, -nz * side), r, true, { bay: 'centre' })) { n++; nBay++; }
          }
        }
        continue;
      }
      // ---- St Giles': echelon bays along the outer (travel-left) kerb of each one-way carriageway
      if (road.name === ECHELON.name) {
        if (!isOw(road) || road.kind !== 'primary' || ECHELON.skip.has(road.id)) continue;
        const tdir = road.oneway === '-1' ? -1 : 1;
        for (let s = 6 + r() * 2; s < total - 6;) {
          const P = polyAt(pts, cum, s, _pa);
          if (P.z < ECHELON.minZ || P.z > ECHELON.maxZ) { s += 3; continue; }
          { const A = polyAt(pts, cum, s - 3, _pb), ax = A.dx, az = A.dz, Bq = polyAt(pts, cum, s + 3, _pb); if (ax * Bq.dx + az * Bq.dz < 0.985) { s += 1.5; continue; } }     // (straight kerbs only)
          // (and only along a lane-graph edge that is straight end to end: the traffic narrows a whole edge to its parked
          // rows, and on a bend cyclists need the kerb side to filter past something stopped)
          if (TS && !echOk(P.x, P.z)) { s += 3; continue; }
          const tx = P.dx * tdir, tz = P.dz * tdir, nx = tz, nz = -tx;                // travel direction, its left (the kerb)
          const type = r() < 0.48 ? 'car_hatch' : r() < 0.93 ? 'car_saloon' : 'taxi', T = TYPES[type];
          const th = ECHELON.deg[type] * Math.PI / 180, depth = T.L * Math.sin(th) + T.W * Math.cos(th);
          const step = (Math.max(T.W, 1.8) + 0.42) / Math.sin(th);
          if (r() > 0.88) { s += step; continue; }
          const hx = Math.cos(th) * tx + Math.sin(th) * nx, hz = Math.cos(th) * tz + Math.sin(th) * nz, h = Math.atan2(hx, hz);
          let ok = false;
          for (let k = 0; k < 3 && !ok; k++) {
            const lat = w0 / 2 - 0.15 - depth / 2 - k * 0.15, x = P.x + nx * lat, z = P.z + nz * lat;
            if (gh) { let up = false; for (const u of [-1, 1]) for (const v of [-1, 1]) { const g = gh(x + Math.sin(h) * u * (T.L / 2 - 0.1) + Math.cos(h) * v * T.W / 2, z + Math.cos(h) * u * (T.L / 2 - 0.1) - Math.sin(h) * v * T.W / 2); if (g > 0.09) up = true; } if (up) continue; }
            ok = place(type, x, z, h, r, true, { bay: 'echelon' });
          }
          if (ok) { n++; nEch++; s += step; } else s += 1.2;
        }
        continue;
      }
      // ---- kerbside rows
      const named = PARK_NAMED.has(road.name);
      if (!named && road.kind !== 'residential' && road.kind !== 'unclassified') continue;
      if (NO_PARK.has(road.name) || w0 < 4.5 || total < 14) continue;
      const ow = isOw(road), tdir = road.oneway === '-1' ? -1 : 1, bus = BUS_NAMES.has(road.name), STRIP = (lim = 2.12), w = Math.min(w0, room.get(road.id) ?? w0);
      // what must stay free between the rows: two buses passing on a bus street, two cars on a two-way street, one lane
      const pass = bus ? 5.6 : 4.75, lane = bus ? 3.1 : named ? 3.0 : 2.45;     // (2.45: a terraced street's one lane between a parked row and the far kerb)
      let sides;
      if (ow) sides = w - 2 * STRIP >= lane + 0.4 ? [1, -1] : w - STRIP >= lane ? [-tdir] : null;            // (one kerb: the right-hand one; AI cyclists ride along the left)
      else sides = w - 2 * STRIP >= pass ? [1, -1] : w - STRIP >= (bus ? pass : lane) ? [hash2(strHash(road.id), 7) < 0.5 ? 1 : -1] : null;
      if (!sides) continue;
      stats.roads++; if (sides.length === 2) stats.both++; else stats.one++;
      const occ = named ? 0.9 : 0.8;
      // (a street left one lane wide: its mouths kept two-lane for 16 m, room to wait aside for whoever comes out)
      const end = !ow && sides.length === 1 ? 16 : 4;
      // (one row on a two-way street: cars only, no vans or cabs, tight to the kerb - a 6.5 m street then still has room
      // for two cars to pass, and the traffic does not have to take it in turns)
      const slim = !ow && sides.length === 1;
      if (slim) lim = 1.95;
      for (const side of sides) {
        for (let s = end + r() * 4; s < total - end;) {
          const u = r(), type = slim ? (u < 0.52 ? 'car_hatch' : 'car_saloon') : kerbType(u), T = TYPES[type];
          const sc = s + T.L / 2; if (sc + T.L / 2 > total - end) break;
          if (r() > occ) { s += 4.5 + r() * 3; continue; }
          // (not across a bend: a straight car laid on a curving kerb sticks out into the lane at one end)
          { const A = polyAt(pts, cum, sc - T.L / 2 - 0.5, _pb), ax = A.dx, az = A.dz, Bq = polyAt(pts, cum, sc + T.L / 2 + 0.5, _pb); if (ax * Bq.dx + az * Bq.dz < 0.97) { s += 1.5; continue; } }
          const P = polyAt(pts, cum, sc, _pa), nx = P.dz * side, nz = -P.dx * side;          // (towards this kerb)
          const h = ow ? Math.atan2(P.dx * tdir, P.dz * tdir) : Math.atan2(P.dx * side, P.dz * side);
          const at = atKerb(type, P, nx, nz, h, w0);
          if (at && place(type, at[0], at[1], h, r, false)) { n++; s = sc + T.L / 2 + 0.55 + r() * 0.9; } else s += 1.5;
        }
      }
    }
    this.placed.echelon = nEch; this.placed.centreBays = nBay;
    return n;
  }

  /** First frame (every place module is installed by then, the streetscape has laid its items): a street or car-park
   *  car that a module has since built a wall, a railing or a prop through, or a lamp / bin / sign stands in, is taken away (the same for every player: the same modules). */
  _pruneLate() {
    this._pruned = true;
    const col = this.col; let n = 0;
    // the streetscape's items (lamps, bins, signs: laid on its first frame) by 8 m cell
    const its = new Map(), SS = this.game.streetscape;
    if (SS && SS.items) for (const it of SS.items) { if (it.gone) continue; const k = Math.floor(it.x / 8) * 65536 + Math.floor(it.z / 8); let a = its.get(k); if (!a) its.set(k, (a = [])); a.push(it); }
    this.pools.forEach((pl) => {
      const T0 = TYPES[pl.type]; if (!T0 || T0.kind !== 'car') return;
      for (let i = pl.slots.length - 1; i >= 0; i--) {
        const s = pl.slots[i]; if (!s.segs || s.taken) continue;
        const T = TYPES[s.type], fx = Math.sin(s.h), fz = Math.cos(s.h), hl = T.L / 2 - 0.06, hw = T.W / 2 - 0.06, R = T.L / 2 + 1;
        // (any other solid segment - not a parked car's own box - with a point inside the footprint, or a solid circle)
        const inBox = (x, z, m = 0) => { const dx = x - s.x, dz = z - s.z; return Math.abs(dx * fx + dz * fz) < hl + m && Math.abs(dx * fz - dz * fx) < hw + m; };
        let bad = false;
        for (let cx = Math.floor((s.x - R) / 8); cx <= Math.floor((s.x + R) / 8) && !bad; cx++) for (let cz = Math.floor((s.z - R) / 8); cz <= Math.floor((s.z + R) / 8) && !bad; cz++) {
          for (const it of its.get(cx * 65536 + cz) || []) if (inBox(it.x, it.z, 0.3)) { bad = true; break; }
          if (bad) break;
          const a = col.grid.get(cx * 73856093 ^ cz * 19349663); if (!a) continue;
          for (const g of a) {
            if (!g.on || g.tag === 'car') continue;
            if (!g.seg) { if (g.r < 1.5 && inBox(g.x, g.z, g.r)) { bad = true; break; } continue; }
            const L = Math.hypot(g.x2 - g.x1, g.z2 - g.z1), k = Math.max(2, Math.ceil(L / 0.15));
            if (Math.min(Math.hypot(g.x1 - s.x, g.z1 - s.z), Math.hypot(g.x2 - s.x, g.z2 - s.z)) > L + R) continue;
            for (let j = 0; j <= k; j++) if (inBox(g.x1 + (g.x2 - g.x1) * j / k, g.z1 + (g.z2 - g.z1) * j / k)) { bad = true; break; }
            if (bad) break;
          }
        }
        if (bad) {
          pl.remove(s); n++;
          // (its box out of the collider's cells altogether, not just switched off)
          for (const g of s.segs) {
            g.on = false;
            for (let cx = Math.floor(Math.min(g.x1, g.x2) / 8); cx <= Math.floor(Math.max(g.x1, g.x2) / 8); cx++) for (let cz = Math.floor(Math.min(g.z1, g.z2) / 8); cz <= Math.floor(Math.max(g.z1, g.z2) / 8); cz++) {
              const a = col.grid.get(cx * 73856093 ^ cz * 19349663), i = a ? a.indexOf(g) : -1; if (i >= 0) a.splice(i, 1);
            }
          }
        }
      }
    });
    this.placed.pruned = n;
  }

  /** the station rank in 2013 was a long queue of cabs: parked (static) taxis queued behind the live rank slots */
  _rankQueues() {
    const TR = this.game.traffic && this.game.traffic.ranks; if (!TR) return;
    const r = rng(2013); let n = 0;
    for (const rk of TR) {
      if (!/station/i.test(rk.name) || rk.slots.length < 2) continue;
      const a = rk.slots[rk.slots.length - 2], b = rk.slots[rk.slots.length - 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      for (let i = 1; i <= 4; i++) {
        const x = b.x + dx / L * 5.6 * i, z = b.z + dz / L * 5.6 * i;
        if (this.wet(x, z) || !this._carFits('taxi', x, z, b.h, null, true) || this.col.raycast(b.x, b.z, x, z) !== null) break;
        const sl = this._addCar('taxi', x, z, b.h, TYPES.taxi.colors[Math.floor(r() * 3)]); sl.rankQueue = rk.name; n++;
      }
    }
    this.placed.rankQueue = n;
  }

  // ------------------------------------------------------------ punts
  puntOK(x, z, h, margin = 0) {
    const c = this.col, fx = Math.sin(h), fz = Math.cos(h), lx = fz, lz = -fx;
    const hl = PUNT.L / 2 + margin, hw = PUNT.W / 2 + margin;
    for (let i = -1; i <= 1; i++) {
      const u = i * hl;
      for (let j = -1; j <= 1; j += (i === 0 ? 2 : 1)) {
        const px = x + fx * u + lx * hw * j, pz = z + fz * u + lz * hw * j;
        if (!this.isW(px, pz)) return false;
      }
    }
    for (let q = -1; q <= 1; q += 2) for (let j = -1; j <= 1; j += 2) if (!this.isW(x + fx * q * hl * 0.5 + lx * hw * j, z + fz * q * hl * 0.5 + lz * hw * j)) return false;
    // bank walls: anything solid between the middle and either end that is on dry land (parapets over water don't count)
    for (let q = -1; q <= 1; q += 2) {
      const ex = x + fx * q * hl, ez = z + fz * q * hl, t = c.raycast(x, z, ex, ez);
      if (t !== null && !this.isW(x + (ex - x) * t, z + (ez - z) * t)) return false;
    }
    return true;
  }
  _rivers() {
    if (this._riv) return this._riv;
    return (this._riv = this.map.waterlines.filter((w) => !w.tunnel && (w.kind === 'river' || w.kind === 'canal') && w.w >= 8));
  }
  /** Nearest river centreline point: {w, i (segment), t, x, z, dx, dz, d, s (arc length)} */
  nearestRiver(x, z, maxD = 80) {
    let best = null, bd = maxD;
    for (const w of this._rivers()) {
      let acc = 0;
      for (let i = 0; i < w.pts.length - 1; i++) {
        const a = w.pts[i], b = w.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-6;
        const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (L * L), 0, 1), px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
        if (d < bd) { bd = d; best = { w, i, t, x: px, z: pz, dx: dx / L, dz: dz / L, d, s: acc + t * L }; }
        acc += L;
      }
    }
    return best;
  }
  nearestRiverOn(w, x, z) {
    let best = null, bd = Infinity, acc = 0;
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i], b = w.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-6;
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (L * L), 0, 1), px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; best = { w, i, t, x: px, z: pz, dx: dx / L, dz: dz / L, d, s: acc + t * L }; }
      acc += L;
    }
    return best;
  }
  /** Point + tangent at arc length s along a waterline. */
  alongRiver(w, s, out) {
    let acc = 0;
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i], b = w.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (s <= acc + L || i === w.pts.length - 2) {
        const t = clamp((s - acc) / (L || 1), 0, 1);
        out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t; out.dx = (b[0] - a[0]) / (L || 1); out.dz = (b[1] - a[1]) / (L || 1);
        out.ok = s >= 0 && s <= acc + L + 1e-6; return out;
      }
      acc += L;
    }
    out.ok = false; return out;
  }
  _placePunts() {
    const find = (pred, fx, fz) => { const p = this.map.pois.find(pred); return p ? p.p : [fx, fz]; };
    const sites = [
      { name: 'Magdalen Bridge Boathouse (Cherwell)', p: find((p) => p.kind === 'boat_rental' && /magdalen/i.test(p.name || ''), 942.4, 399.8), n: 12 },
      { name: 'Cherwell punt rollers, University Parks', p: find((p) => p.kind === 'slipway' && /punt rollers/i.test(p.name || ''), 969.2, -596.5), n: 6 },
      { name: 'Folly Bridge (Thames)', p: find((p) => p.kind === 'boat_rental' && /salter/i.test(p.name || ''), 265.6, 989.6), n: 8 },
    ];
    const r = rng(1555 + 7), out = {};
    this.moorings = [];
    for (const site of sites) {
      const [sx, sz] = site.p;
      const rec = { name: site.name, n: 0, x: sx, z: sz, note: '' };
      this.placed.punts.push(rec);
      // every river/canal centreline passing within 45 m of the site, nearest first
      const lines = [];
      for (const w of this._rivers()) { const q = this.nearestRiverOn(w, sx, sz); if (q && q.d < 45) lines.push(q); }
      lines.sort((p, q) => p.d - q.d);
      if (!lines.length) { const q = this.nearestRiver(sx, sz, 150); if (q) lines.push(q); }
      if (!lines.length) { rec.note = 'no river found nearby!'; continue; }
      const placed = [];
      let cx = 0, cz = 0;
      for (const nr of lines) {
        const hw = nr.w.w / 2;
        const side = ((sx - nr.x) * nr.dz - (sz - nr.z) * nr.dx) >= 0 ? 1 : -1;  // left-normal (dz,-dx) side towards the site
        for (let k = 0; k < 30 && placed.length < site.n; k++) {
          const kk = k % 2 ? -Math.ceil(k / 2) : k / 2, s = nr.s + kk * 7.7;
          if (Math.abs(kk * 7.7) > 70) break;
          this.alongRiver(nr.w, s, out); if (!out.ok) continue;
          const lx = out.dz * side, lz = -out.dx * side;
          // the real bank: march out from the centreline towards the site until we leave the water
          let bank = 0;
          while (bank < 40 && this.isW(out.x + lx * (bank + 0.25), out.z + lz * (bank + 0.25))) bank += 0.25;
          if (bank < 2) continue;
          for (const [li, lane] of [[0, bank - 0.72], [1, bank - 1.78]]) {
            if (placed.length >= site.n) break;
            const h = Math.atan2(out.dx, out.dz) + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.04;
            let ok = false, px = 0, pz = 0;
            for (let nudge = 0; nudge < 5 && !ok; nudge += 0.3) {
              px = out.x + lx * (lane - nudge); pz = out.z + lz * (lane - nudge);
              if (this.col.onBridge(px, pz) || this.col.onBridge(px + out.dx * 3.7, pz + out.dz * 3.7) || this.col.onBridge(px - out.dx * 3.7, pz - out.dz * 3.7)) break;
              // room to manoeuvre: the punt must also fit 2 m further along either way
              ok = this.puntOK(px, pz, h, 0.15) && (this.puntOK(px + out.dx * 2, pz + out.dz * 2, h) || this.puntOK(px - out.dx * 2, pz - out.dz * 2, h)) && !placed.some((q) => {
                const ddx = q[0] - px, ddz = q[1] - pz;
                const fx = Math.sin(q[2]), fz = Math.cos(q[2]), along = Math.abs(ddx * fx + ddz * fz), lat = Math.abs(ddx * fz - ddz * fx);
                return along < PUNT.L + 0.2 && lat < PUNT.W + 0.1;
              });
            }
            if (!ok) continue;
            // must be boardable from a dry, open bit of bank (outer row: step across the inner one)
            const land = this.findSpot(px + lx * 1.6, pz + lz * 1.6, 0.33, 3.5);
            if (!land) continue;
            const tmp = { type: 'punt', x: px, z: pz, h, heading: h };
            if (this.bodyDist(tmp, land[0], land[1]) > (li === 0 ? 2.3 : 3.3)) continue;
            placed.push([px, pz, h]); cx += px; cz += pz;
            const cols = TYPES.punt.colors;
            const slot = this._slot('punt', px, pz, h, { y: this.waterY, color: cols[Math.floor(r() * cols.length)], mooring: site.name });
            this.moorings.push(slot);
          }
        }
        if (placed.length >= site.n) break;
      }
      rec.n = placed.length;
      if (placed.length) { rec.x = cx / placed.length; rec.z = cz / placed.length; }
      if (placed.length < site.n) rec.note = `only ${placed.length}/${site.n} fitted`;
      rec.spots = placed.map((q) => [+q[0].toFixed(1), +q[1].toFixed(1)]);
    }
  }

  // NPC punts with tourists drifting up and down near the boathouses (cheap: 3 boats, only animated within range)
  _npcPunts() {
    this.npcs = [];
    const r = rng(77);
    const defs = [[942.4, 399.8, 1], [969.2, -596.5, -1], [265.6, 989.6, 1]];
    for (const [x, z, dir] of defs) {
      const nr = this.nearestRiver(x, z, 120);
      if (!nr) continue;
      const rig = makeLive('punt', TYPES.punt.colors[Math.floor(r() * 5)]);
      rig.group.visible = false; this.scene.add(rig.group);
      const npc = { rig, w: nr.w, s: nr.s + dir * 40, s0: nr.s - 160, s1: nr.s + 160, dir, lat: -2.2, x: nr.x, z: nr.z, h: 0, speed: 0, stroke: newStroke(), chars: null, ph: r() * 10 };
      this.npcs.push(npc);
    }
    {
      for (const n of this.npcs) {
        try {
          const L = randomLook, mk = createCharacter;
          const punter = mk(L(Math.floor(r() * 1e9))); punter.setPose('punt');
          const a = mk(L(Math.floor(r() * 1e9))); a.setPose('sit');
          const b = mk(L(Math.floor(r() * 1e9))); b.setPose('sit');
          punter.group.position.set(RIDER.punt.x, RIDER.punt.y, RIDER.punt.z);
          a.group.position.set(0, -0.02, 1.2); a.group.rotation.y = Math.PI;
          b.group.position.set(0, -0.02, -0.6);
          n.rig.group.add(punter.group, a.group, b.group);
          n.chars = [punter, a, b];
        } catch (e) { console.warn('[vehicles] npc punt chars', e); }
      }
    }
  }

  // ------------------------------------------------------------ UI
  _ui() {
    const g = this.game;
    // On-foot "[F] Ride bike" prompt goes through game.interact (so it shares the normal prompt), but only when no
    // other interactable is in range. In-vehicle prompts (mud!) use our own element because interact hides its prompt.
    this.item = g.interact && g.interact.add({
      key: 'F', radius: 50,
      pos: () => this._candPos,
      label: () => (this.cand ? (this.cand.ai ? TAKE_PROMPT[this.cand.type] : (TYPES[this.cand.type] || {}).prompt) || 'Ride' : ''),
      enabled: () => !!this.cand && !this.cur && !this.taking && !this._otherItemNear(),
      onUse: () => { if (this.cand && !this.cur && !this.taking) this.enter(this.cand); },
    });
    this._candPos = new THREE.Vector3();
    try {
      const host = (g.ui && g.ui.el && g.ui.el.prompt && g.ui.el.prompt.parentNode) || document.body;
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:50%;bottom:24%;transform:translateX(-50%);font-size:18px;background:rgba(0,0,0,.6);' +
        'padding:8px 16px;border-radius:6px;display:none;white-space:nowrap;pointer-events:none;color:#fff';
      host.appendChild(el);
      this.vprompt = el; this._vpText = null;
    } catch { this.vprompt = null; }
  }
  _otherItemNear() {
    const g = this.game, p = g.player;
    for (const it of g.interact.items) {
      if (it === this.item || it.place !== p.place) continue;
      if (it.enabled && !it.enabled()) continue;
      const q = typeof it.pos === 'function' ? it.pos() : it.pos;
      if (q && Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < it.radius && Math.abs((q.y || 0) - p.pos.y) < 3) return true;
    }
    return false;
  }
  _prompt(text, key = 'E') {
    const t = text ? key + '|' + text : null;
    if (t === this._vpText || !this.vprompt) return;
    this._vpText = t;
    if (!text) { this.vprompt.style.display = 'none'; return; }
    this.vprompt.innerHTML = `<b style="display:inline-block;background:#f3e7b3;color:#111;border-radius:4px;padding:0 7px;margin-right:8px">${key}</b>${text}`;
    this.vprompt.style.display = 'block';
  }
  _toast(t, s) { try { this.game.ui.toast(t, s); } catch { /* ignore */ } }

  // ------------------------------------------------------------ live vehicles
  spawn(type, x, z, heading = 0, opts = {}) {
    const T = TYPES[type];
    if (!T) throw new Error('unknown vehicle type ' + type);
    const rig = makeLive(type, opts.color ?? T.colors[0], { livery: opts.livery || null, driver: !!opts.driver });
    const v = {
      id: this.nextId++, type, kind: T.kind, name: T.name, x, z, y: T.kind === 'punt' ? this.waterY : this.game.groundHeight(x, z), heading,
      speed: 0, vx: 0, vz: 0, vl: 0, w: 0, steer: 0, lean: 0, pitch: 0, camDist: T.camDist, rig, mesh: rig.group, color: rig.color,
      driver: null, parked: true, static: false, fallen: false, wheelA: 0, crankA: 0, ph: Math.random() * 10, lastUse: this.t,
      stroke: T.kind === 'punt' ? newStroke() : null, segs: null, spin: 0, livery: opts.livery || null,
      gp: 0, gr: 0,                 // pitch / roll of the ground under the wheels (kerbs), smoothed
    };
    if (T.kind === 'car') initBody(v);
    if (T.kind !== 'punt') this._ground(v, 0);
    if (T.kind === 'punt') terrainAfloat(v.mesh);
    this.scene.add(v.mesh);
    try { const w = this.game.world; if (w && w.blobShadow && T.kind !== 'punt') v.blob = w.blobShadow(v.mesh, T.W * 0.55 + 0.1, { stretch: T.L / T.W * 0.85 }); } catch (e) { v.blob = null; }
    this._pose(v);
    this.live.push(v);
    this._capLive();
    return v;
  }
  remove(v) {
    if (!v) return;
    if (v.static) { if (v.segs) for (const s of v.segs) s.on = false; v.taken = true; if (v.pool) v.pool.remove(v); return; }
    if (v === this.cur) this.exit(true);
    v.mesh.removeFromParent();
    if (v.blob) { v.blob.remove(); v.blob = null; }
    const i = this.live.indexOf(v); if (i >= 0) this.live.splice(i, 1);
  }
  promote(s) {
    if (!s || !s.static) return s;
    if (s.segs) for (const sg of s.segs) sg.on = false;
    s.taken = true; if (s.pool) s.pool.remove(s);
    const v = this.spawn(s.type, s.x, s.z, s.h, { color: s.color });
    v.mooring = s.mooring || null;
    return v;
  }
  /** too many abandoned live vehicles -> turn the farthest back into static parked slots */
  _capLive() {
    let idle = 0;
    for (const v of this.live) if (!v.driver) idle++;
    while (idle > this.config.maxLiveParked) {
      const p = this.game.player.pos; let far = null, fd = -1;
      for (const v of this.live) { if (v.driver || v === this.cur || v.remote) continue; const d = (v.x - p.x) ** 2 + (v.z - p.z) ** 2; if (d > fd) { fd = d; far = v; } }      // (v.remote: another player's, see systems/crowdsync.js)
      if (!far) break;
      this._demote(far); idle--;
    }
  }
  _demote(v) {
    v.mesh.removeFromParent();
    const i = this.live.indexOf(v); if (i >= 0) this.live.splice(i, 1);
    const T = TYPES[v.type];
    const extra = { color: v.color, y: v.kind === 'punt' ? this.waterY : 0 };       // (0 = stand on the drawn surface, see groundSlot)
    if (v.kind === 'car') extra.segs = this.col.addBox(v.x, v.z, T.W, T.L, v.heading, { tag: 'car', low: true, top: standTop(v.type) });
    const sl = this._slot(v.type, v.x, v.z, v.heading, extra);
    if (sl) sl.kerb = true;            // (left wherever it was abandoned: traffic.js treats it as an obstacle)
  }

  /**
   * Debug staging (tools/gfx_shots.mjs phys-* views, or from the console): sets up one physics moment at the player and
   * runs the whole game synchronously (game.update(1/60)) until `t` seconds after the event. Returns a short report.
   *   'shunt'      the player's hatchback into the back of the nearest parked car with room behind it, at 50 km/h
   *   'tumble'     a car (nobody at the wheel) at 45 km/h through a pedestrian; the camera beside the road
   *   'handbrake'  a saloon at 55 km/h: full lock and the handbrake   'lockup' stamping on the brakes at 70 km/h
   *   'bike'       a road bike into the wall ahead at a sprint          'knocked' the player clipped by a car
   *   'roof'       the player standing on a parked car's roof            'roll'    a van cornering hard
   */
  debugStage(kind, t = 0.4) {
    const g = this.game, p = g.player, step = (n, fn) => { for (let i = 0; i < n; i++) { if (fn && fn(i) === false) return i; g.update(1 / 60); } return n; };
    if (this.cur) this.exit(true);
    p.character.group.visible = true;
    const x0 = p.pos.x, z0 = p.pos.z, h0 = p.heading, fx = Math.sin(h0), fz = Math.cos(h0), lx = fz, lz = -fx;
    const tr = g.traffic;
    if (tr && tr._sys) for (const a of [...tr.list]) if (Math.hypot(a.x - x0, a.z - z0) < 60 && !a.remote) tr._sys._release(a);
    const n = Math.round(t * 60);
    const look = (x, z, tx, tz, back = 0) => { const hh = Math.atan2(tx - x, tz - z); p.teleport(x - Math.sin(hh) * back, z - Math.cos(hh) * back, hh); p.character.group.visible = false; };
    if (kind === 'shunt') {
      let slot = null, bd = 260;
      this.pools.forEach((pl) => { if (!TYPES[pl.type] || TYPES[pl.type].kind !== 'car' || pl.type === 'bus') return; pl.grid.each(x0, z0, 260, (s) => {
        if (s.taken) return; const d = Math.hypot(s.x - x0, s.z - z0); if (d > bd) return;
        const sx = Math.sin(s.h), sz = Math.cos(s.h); if (this.okSpot(s.x - sx * 11, s.z - sz * 11, 1.0) && this.col.raycast(s.x - sx * 11, s.z - sz * 11, s.x, s.z) === null) { bd = d; slot = s; } }); });
      if (!slot) return 'no parked car with room behind it';
      const sx = Math.sin(slot.h), sz = Math.cos(slot.h), car = this.spawn('car_hatch', slot.x - sx * 10.5 + sz * 0.35, slot.z - sz * 10.5 - sx * 0.35, slot.h, { color: 0x8a1c1c });
      p.teleport(car.x, car.z, slot.h); this.enter(car);
      car.vx = sx * 13.9; car.vz = sz * 13.9; car.speed = 13.9;
      let hitF = -1; step(240, (i) => { if (hitF < 0 && this.live.some((o) => o.home && o.shuntT !== undefined)) hitF = i; if (hitF >= 0 && i - hitF >= n) return false; });
      return `shunt at (${slot.x.toFixed(1)}, ${slot.z.toFixed(1)}) ${slot.type}: ${hitF >= 0 ? 'hit' : 'missed'}`;
    }
    if (kind === 'tumble' || kind === 'knocked') {
      const peds = g.pedestrians;
      const tx = x0 + fx * 4, tz = z0 + fz * 4;
      let ped = null;
      if (kind === 'tumble') { ped = peds && peds.spawnAt ? peds.spawnAt(tx, tz, null, { heading: h0 + Math.PI / 2 }) : null; look(tx + lx * 6, tz + lz * 6, tx, tz, 0); p.teleport(tx + lx * 6.5 - fx * 1.5, tz + lz * 6.5 - fz * 1.5, Math.atan2(tx - (tx + lx * 6.5), tz - (tz + lz * 6.5))); p.character.group.visible = false; }
      else { p.teleport(tx, tz, h0 + Math.PI / 2); }
      const car = this.spawn('car_saloon', tx - fx * 14, tz - fz * 14, h0, { color: 0x1e2a4a });
      car.driver = 'ai'; car.vx = fx * 12.5; car.vz = fz * 12.5; car.speed = 12.5;
      let hitF = -1;
      step(300, (i) => { this.drive(car, { throttle: 0.3 }, 1 / 60); const hit = kind === 'tumble' ? ped && ped.down : p.down; if (hitF < 0 && hit) hitF = i; if (hitF >= 0 && i - hitF >= n) return false; });
      car.driver = null; car.parked = true;
      if (kind === 'knocked') { const hh = Math.atan2(car.x - p.pos.x, car.z - p.pos.z); g.cameraYaw = hh + 1.2; }
      return `${kind}: ${hitF >= 0 ? 'hit after ' + (hitF / 60).toFixed(2) + ' s' : 'missed'}`;
    }
    if (kind === 'handbrake' || kind === 'lockup' || kind === 'roll') {
      const type = kind === 'roll' ? 'van' : 'car_saloon', car = this.spawn(type, x0, z0, h0, { color: 0x6d7177 });
      p.teleport(x0, z0, h0); this.enter(car);
      const v0 = kind === 'lockup' ? 19.5 : kind === 'roll' ? 12 : 15;
      car.vx = fx * v0; car.vz = fz * v0; car.speed = v0;
      const inp = g.input, keys = kind === 'lockup' ? ['KeyS'] : kind === 'roll' ? ['KeyW', 'KeyA'] : ['KeyW', 'KeyA', 'Space'];
      const k0 = new Set(inp.keys || []);
      if (inp.keys) { inp.keys.clear(); for (const k of keys) inp.keys.add(k); }
      step(Math.max(1, n));
      if (inp.keys) { inp.keys.clear(); for (const k of k0) inp.keys.add(k); }
      g.cameraYaw = car.heading + (kind === 'roll' ? 2.2 : 0.9);
      return `${kind}: speed ${car.speed.toFixed(1)} slip ${(car.vl || 0).toFixed(1)} pitch ${(car.pitch * 57.3).toFixed(1)} roll ${(car.lean * 57.3).toFixed(1)} deg, skid quads ${this.skids.used}`;
    }
    if (kind === 'bike') {
      const b = this.spawn('bike_road', x0, z0, h0); p.teleport(x0, z0, h0); this.enter(b);
      b.speed = 11;
      const inp = g.input; if (inp.keys) { inp.keys.clear(); inp.keys.add('KeyW'); inp.keys.add('ShiftLeft'); }
      let off = -1; step(600, (i) => { if (off < 0 && !p.vehicle) off = i; if (off >= 0 && i - off >= n) return false; });
      if (inp.keys) inp.keys.clear();
      g.cameraYaw = p.heading + 2.4;
      return `bike: ${off >= 0 ? 'thrown off' : 'still riding'}`;
    }
    if (kind === 'roof') {
      const car = this.spawn('taxi', x0 + fx * 3, z0 + fz * 3, h0 + Math.PI / 2);
      p.teleport(car.x, car.z, h0); p.pos.y = car.y + topAt('taxi', 0) + 0.05; p.onGround = false; p.vy = 0;
      step(Math.max(30, n));
      return `roof: feet at ${p.pos.y.toFixed(2)} m`;
    }
    return 'unknown stage ' + kind;
  }

  /** Highest standable vehicle top (bonnet / roof: _vehphys.topAt) over (x, z) that feet at height y can reach. */
  supportAt(x, z, y, reach, out) {
    let best = -1; if (out) out.o = null;
    const test = (type, bx, bz, bh, by, o) => {
      const T = TYPES[type]; if (!T || T.kind !== 'car') return;
      const fx = Math.sin(bh), fz = Math.cos(bh), dx = x - bx, dz = z - bz, u = dx * fx + dz * fz, w = dx * fz - dz * fx;
      if (Math.abs(u) > T.L / 2 - 0.05 || Math.abs(w) > T.W / 2 - 0.02) return;
      const tp = topAt(type, u); if (tp < 0) return;
      const top = (by || 0) + tp;
      if (top > y + reach || top <= best) return;
      best = top; if (out) out.o = o;
    };
    for (let i = 0; i < this.live.length; i++) { const v = this.live[i]; if (v.kind === 'car' && v !== this.cur && Math.abs(v.x - x) < 7 && Math.abs(v.z - z) < 7) test(v.type, v.x, v.z, v.heading, v.y, v); }
    const tl = this.game.traffic && this.game.traffic.list;
    if (tl) for (let i = 0; i < tl.length; i++) { const a = tl[i]; if (a && a.active !== false && a.kind === 'car' && Math.abs(a.x - x) < 7 && Math.abs(a.z - z) < 7) test(a.type, a.x, a.z, a.heading, a.y, a); }
    this.pools.forEach((pl) => {
      if (pl.type === 'stand' || pl.type === 'punt' || TYPES[pl.type].kind !== 'car') return;
      pl.grid.each(x, z, 6, (s) => { if (!s.taken && Math.abs(s.x - x) < 7 && Math.abs(s.z - z) < 7) test(s.type, s.x, s.z, s.h, s.y, s); });
    });
    return best;
  }

  /** distance from (x,z) to a vehicle's body (segment along its length) */
  bodyDist(v, x, z) {
    const T = TYPES[v.type], h = v.heading ?? v.h, fx = Math.sin(h), fz = Math.cos(h), half = Math.max(0, T.L / 2 - T.W / 2);
    let u = (x - v.x) * fx + (z - v.z) * fz; u = clamp(u, -half, half);
    return Math.hypot(x - (v.x + fx * u), z - (v.z + fz * u)) - T.W / 2;
  }
  nearest(x, z, r = 3, filter = null) {
    let best = null, bd = r;
    for (const v of this.live) {
      if (v === this.cur || v.driver) continue;
      if (Math.abs(v.x - x) > r + 6 || Math.abs(v.z - z) > r + 6) continue;
      const d = this.bodyDist(v, x, z); if (d < bd && (!filter || filter(v))) { bd = d; best = v; }
    }
    this.pools.forEach((p) => {
      if (p.type === 'stand') return;
      p.grid.each(x, z, r + 6, (s) => { if (s.taken) return; const d = this.bodyDist(s, x, z); if (d < bd && (!filter || filter(s))) { bd = d; best = s; } });
    });
    return best;
  }

  enter(v) {
    const g = this.game, p = g.player;
    if (!v || this.cur || p.place !== 'world') return null;
    if (p.down) return null;                             // (lying in the road: get up first)
    if (v.ai) { this._startTake(v); return null; }      // AI traffic: turf the driver out first (enter sequence)
    if (v.static) v = this.promote(v);
    if (v.driver) return null;
    v.home = null; v.slideVx = v.slideVz = 0;          // yours now: not put back in its bay
    this.cur = v; v.driver = 'player'; v.parked = false; v.lastUse = this.t;
    if (v.fallen) { v.fallen = false; v.lean = 0; }
    v.speed = 0; v.vx = v.vz = 0; v.vl = 0; v.w = 0; v.steer = 0;
    if (v.kind === 'car') { if (!v.pitchS) initBody(v); v.yr = 0; v.spin = 0; v.heaveS.v -= 0.35; v.rollS.v += 0.12; }    // (the body dips as you get in)
    if (v.kind === 'punt') { v.stroke = newStroke(); v.mudGrace = this.config.mudGrace; rockKick(v, 0.28, -0.12); splash(this.game.audio, 0.04); }   // (she rocks as you step aboard)
    p.vehicle = v;
    p.pose = POSE[v.kind];
    try { p.character.setPose(p.pose); } catch { /* ignore */ }
    p.speed = 0;
    this._syncPlayer(v);
    this._lpx = p.pos.x; this._lpz = p.pos.z;
    if (v.kind === 'car') this._engine(true, v);
    this.cand = null;
    this._emit('enter', { v });
    if (v.kind === 'punt' && !this.game.state?.flags?.puntTip) {
      this._toast('Hold W to pole, A/D to trail the pole and steer, S to check her. Oxford style: you stand in the well, till first.', 6);
      try { this.game.state.flags.puntTip = true; } catch { /* ignore */ }
    }
    // the first bike and the first car of a save: the keys, once (the view follows by itself: core/_chasecam.js)
    const fl = this.game.state && this.game.state.flags;
    if (fl && v.kind === 'bike' && !fl.bikeTip) { fl.bikeTip = true; this._toast('W to pedal, Shift to sprint, A / D to steer, S to brake, Space rings the bell. The view follows the bike; the mouse looks about.', 7); }
    if (fl && v.kind === 'car' && !fl.carTip) { fl.carTip = true; this._toast('W / S to drive and brake (S again reverses), A / D to steer, Space is the handbrake, H the horn, F gets out.', 7); }
    return v;
  }
  exit(force = false) {
    const g = this.game, p = g.player, v = this.cur;
    if (!v) return false;
    if (!force && v.kind === 'car' && Math.abs(v.speed) > 4) { this._toast('Slow down before you get out!', 2); return false; }
    const spot = this._exitSpot(v);
    if (v.underB && (spot || force)) { v.underB = false; this._archShade(false); }      // (nicked or thrown out under a bridge: the arch's shade must not stay on the screen)
    if (!spot && !force) {
      this._toast(v.kind === 'punt' ? "You're mid-river: punt to the bank first." : 'No room to get out here.', 2.5);
      return false;
    }
    this.cur = null; v.driver = null; v.parked = true; v.lastUse = this.t;
    p.vehicle = null; p.pose = 'stand';
    try { p.character.setPose('stand'); } catch { /* ignore */ }
    const grp = p.character.group; grp.rotation.x = 0; grp.rotation.z = 0;
    if (spot) { p.pos.set(spot[0], g.groundHeight(spot[0], spot[1]), spot[1]); }
    else { p.pos.y = g.groundHeight(p.pos.x, p.pos.z); }
    p.speed = 0; p.vy = 0; p.onGround = true;
    if (p.syncMesh) p.syncMesh();
    this._lpx = p.pos.x; this._lpz = p.pos.z;
    this._engine(false, v.kind === 'car' ? v : null);
    if (v.kind === 'punt') { v.stroke = newStroke(); this._prompt(null); }
    if (v.kind === 'bike') { v.speed = 0; v.lean = 0; v.steer = 0; this._pose(v); }
    if (v.kind === 'car' && v.heaveS) { v.heaveS.v += 0.25; v.rollS.v -= 0.1; }     // (and rises as you get out)
    if (v.kind === 'punt') rockKick(v, -0.22, 0.08);
    if (v.rig.setLights) v.rig.setLights(false);
    this._capLive();
    this._emit('exit', { v });
    return true;
  }
  _exitSpot(v) {
    const T = TYPES[v.type], h = v.heading, fx = Math.sin(h), fz = Math.cos(h), lx = fz, lz = -fx;
    const tries = [];
    if (v.kind === 'bike') { for (const d of [0.75, -0.75, 1.3, -1.3]) tries.push([0, d]); tries.push([-1.2, 0], [1.4, 0]); }
    else if (v.kind === 'car') {
      const sz = T.seat.z;
      for (const d of [-(T.W / 2 + 0.55), T.W / 2 + 0.55, -(T.W / 2 + 1.1), T.W / 2 + 1.1]) tries.push([sz, d]);
      tries.push([-(T.L / 2 + 0.8), 0], [T.L / 2 + 0.8, 0]);
    } else {
      for (const u of [PUNT.standZ, -1.5, 0, 1.5, 3, PUNT.standZ - 1]) for (const d of [1.4, -1.4, 2.2, -2.2, 3.0, -3.0, 3.8, -3.8]) tries.push([u, d]);
    }
    for (const [u, d] of tries) {
      const x = v.x + fx * u + lx * d, z = v.z + fz * u + lz * d;
      // (the line of sight starts inside the collision body - a bike's centre, a car's end circles - not at the spot itself:
      // the spot ahead of a bike crashed into a fence or hedge was checked with a zero-length ray and could be beyond it)
      const hb = v.kind === 'bike' ? 0 : Math.max(0, T.L / 2 - T.W / 2), uo = v.kind === 'punt' ? u : clamp(u, -hb, hb);
      const ox = v.x + fx * uo, oz = v.z + fz * uo;
      if (this.okSpot(x, z, 0.33) && this.col.raycast(ox, oz, x, z) === null) return [x, z];
    }
    if (v.kind !== 'punt') return this.findSpot(v.x, v.z, 0.33, 4, [v.x, v.z]);
    return null;
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;
    if (!dt || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    this._dt = dt;
    this.skids.update(); this.puffs.update(dt); this.debris.update(dt);
    this._remotes(dt);
    if (!this._poser && g.net && g.net.posers) { this._poser = (o, dt2, grp) => this._poseRemote(o, dt2, grp); g.net.posers.push(this._poser); }
    if (this._pred.size) for (const id of this._pred.keys()) if (!g.net || !g.net.others.has(id)) this._pred.delete(id);
    // someone else teleported the player / took them indoors while riding -> abandon the vehicle where it is
    if (this.cur && (p.place !== 'world' || p.vehicle !== this.cur || Math.hypot(p.pos.x - this._lpx, p.pos.z - this._lpz) > 4)) {
      const v = this.cur; this.cur = null; v.driver = null; v.parked = true;
      if (p.vehicle === v) p.vehicle = null;
      if (p.pose === POSE[v.kind]) { p.pose = 'stand'; try { p.character.setPose('stand'); } catch { /* ignore */ } }
      p.character.group.rotation.x = 0; p.character.group.rotation.z = 0;
      this._engine(false); this._prompt(null);
    }
    // parked pools follow the player (outdoors position)
    const wp = p.place === 'world' ? p.pos : p.worldPos;
    const lr = this.lastRefresh;
    if (SANITY && !this._prunedBikes) { const SS = g.streetscape; if (!SS || (SS.items && SS.items.length) || (this._bikeWait = (this._bikeWait || 0) + 1) > 120) this._pruneBikes(); }
    if (BUSY && !this._pruned) { const SS = g.streetscape; if (!SS || (SS.items && SS.items.length) || (this._pruneWait = (this._pruneWait || 0) + 1) > 120) this._pruneLate(); }
    if (BUSY && (this._capT = (this._capT || 0) - dt) <= 0) {
      // (how many parked cars of each type are drawn round the player follows the graphics tier)
      this._capT = 1;
      const k = PARK_SHOW[(g.quality && g.quality.level) || 'low'] || PARK_SHOW.low;
      const sh = ((g.quality && g.quality.level) || 'low') !== 'low';     // (low: no shadows from the parked rows, as from its street furniture)
      for (const t of ['car_hatch', 'car_saloon', 'taxi', 'van']) { const pl = this.pools.get(t), c = Math.max(12, Math.round(PARK_MAX[t] * k)); if (pl.cap !== c) { pl.cap = c; pl.dirty = true; } if (pl.rest.castShadow !== sh) pl.rest.castShadow = sh; }
    }
    PARK_EYE.value.set(wp.x, wp.z);      // (the pools' far edges fade by the distance from here: MATS.parked)
    if (!this._pending.length && (Math.hypot(wp.x - lr.x, wp.z - lr.z) > PARK_STEP || this._poolsDirty())) {
      this.pools.forEach((pl) => this._pending.push(pl));
      lr.x = wp.x; lr.z = wp.z; lr.t = this.t;
    }
    // (three pools a frame - it was one, and every 6 m: the set drawn must not lag the edge's fade by more than PARK_M)
    for (let k = 0; k < 3 && this._pending.length; k++) this._pending.pop().refresh(wp.x, wp.z);
    const night = !!(g.time && g.time.isNight);
    setEnvLight(g.time && g.time.daylight !== undefined ? g.time.daylight : night ? 0 : 1);   // sky reflections on paint and glass fade with the light
    if (p.place !== 'world') { if (this.taking) this._abortTake(); this.cand = null; this._prompt(null); return; }

    const ctl = !p.frozen && !g.activity && !(g.ui && g.ui.inDialog) && !g.input.typing;
    if (this.taking) {
      this._takeUpdate(dt);
    } else if (this.cur) {
      const v = this.cur;
      this._guard(v);
      if (v.kind === 'bike') this._bike(v, dt, ctl);
      else if (v.kind === 'car') this._car(v, dt, ctl);
      else this._punt(v, dt, ctl);
      if (this.cur === v) {
        v.rig.setLights && v.rig.setLights((v.kind === 'car' ? lampsWanted(g, night) : night) && v.kind !== 'punt');
        this._syncPlayer(v);
        if (ctl && g.input.hit('KeyF')) { g.input.pressed.delete('KeyF'); this.exit(); }
      }
    } else {
      this._onFoot(dt, ctl);
    }
    // idle live vehicles: coast to a halt, bob, fall-over animation; nothing beyond SIM_R
    for (let i = this.live.length - 1; i >= 0; i--) {
      const v = this.live[i];
      if (v.kind === 'car' && v.steamT > 0) this._steam(v, dt);
      if (v === this.cur || v.driver === 'ai') continue;      // 'ai': driven through drive() by another system (police)
      const dx = v.x - wp.x, dz = v.z - wp.z, d2 = dx * dx + dz * dz;
      // a parked car shunted out of its bay goes back once it has stopped and nobody is about (solo: in multiplayer the
      // others were told the bay is empty, so it stays where it ended up)
      // (2026-11-26: and only where it cannot be seen to jump back - 240 m off, or both it and its bay out of the camera's
      //  picture or behind a building, the walkers' test; it was "75 m from the player", in view or not)
      if (v.home && !v.driver && !v.remote && this.t - v.shuntT > 30 && d2 > 75 * 75 && !(this.game.crowdsync && this.game.crowdsync.active) && Math.abs(v.vx) + Math.abs(v.vz) < 0.01 && (d2 > 240 * 240 || (this._hid(v.x, v.z) && this._hid(v.home.x, v.home.z)))) { this._restore(v); continue; }
      if (d2 > SIM_R * SIM_R) continue;
      if (v.kind === 'car' && (v.vx || v.vz)) this._guard(v);
      this._idle(v, dt);
    }
    this._npcUpdate(dt, wp, night);
    // (children and animals: after everything on wheels has moved, none is left inside a vehicle's outline)
    { const PR = g.pedestrians && g.pedestrians.protect; if (PR) PR.resolve(false); }
    this._lpx = p.pos.x; this._lpz = p.pos.z;
  }
  /** out of our camera's picture, or a building in the way (pedestrians._unseenMe; with no walkers' system: not hidden) */
  _hid(x, z) { const PS = this.game.pedestrians && this.game.pedestrians._sys; return !!PS && !!PS._vw && PS._unseenMe(x, z); }
  _poolsDirty() { let d = false; this.pools.forEach((p) => { if (p.dirty) d = true; }); return d; }

  _onFoot(dt, ctl) {
    const g = this.game, p = g.player;
    // riding in a seat of another player's vehicle (systems/passenger.js): its body does not push us out of our own
    // seat, and nothing else is offered to get into (the in-seat prompt is that system's)
    if (p.vehicle && p.vehicle.playerSeat) { this.cand = null; return; }
    // walk into live vehicles: push the player out of car bodies (not while standing on one, or scrambling up onto it);
    // one coming at you with any speed bowls you over (punts don't matter: they're on water)
    for (let i = 0; i < this.live.length; i++) {
      const v = this.live[i];
      if (v.kind !== 'car') continue;
      if (Math.abs(v.x - p.pos.x) > 8 || Math.abs(v.z - p.pos.z) > 8) continue;
      if (onTop(v.type, v.x, v.z, v.heading, v.y, p.pos)) continue;
      const bx = p.pos.x, bz = p.pos.z;
      if (pushCapsule(p.pos, 0.32, v.x, v.z, v.heading, TYPES[v.type])) this._hitPlayer(v.vx, v.vz, p.pos.x - bx, p.pos.z - bz, v, v.type, (v.yr || 0) + (v.spin || 0), v.x, v.z);
    }
    // other players' cars: the same (our body, our call: their reported velocity bowls us over)
    for (let i = 0; i < this.remoteBodies.length; i++) {
      const q = this.remoteBodies[i];
      if (!q.on || Math.abs(q.x - p.pos.x) > 8 || Math.abs(q.z - p.pos.z) > 8) continue;
      if (onTop(q.type, q.x, q.z, q.h, q.y, p.pos)) continue;
      const bx = p.pos.x, bz = p.pos.z;
      if (pushCapsule(p.pos, 0.32, q.x, q.z, q.h, TYPES[q.type])) this._hitPlayer(q.vx, q.vz, p.pos.x - bx, p.pos.z - bz, null, q.type, q.w || 0, q.x, q.z);
    }
    // ... and their bicycles (not bodies anything else collides with: straight from what core/net.js shows, at the speed
    // they report): ridden into at any pace we go over, as when the traffic's cyclists ride into us — not ridden through
    { const net = g.net;
      if (net && net.others && net.others.size && p.place === 'world' && !p.down) for (const o of net.others.values()) {
        const T = TYPES[o.veh];
        if (!T || T.kind !== 'bike' || !o.seen || o.place !== 'world' || !(o.speed > 1.1) || Math.abs(o.x - p.pos.x) > 4 || Math.abs(o.z - p.pos.z) > 4 || Math.abs((o.y || 0) - p.pos.y) > 1.5) continue;
        const bx = p.pos.x, bz = p.pos.z;
        if (pushCapsuleRaw(p.pos, 0.32, o.x, o.z, o.h, Math.max(0, T.L / 2 - T.W / 2), T.W / 2 + 0.1)) this._hitPlayer(Math.sin(o.h) * o.speed, Math.cos(o.h) * o.speed, p.pos.x - bx, p.pos.z - bz, null, o.veh, 0, o.x, o.z);
      }
    }
    // nearest enterable thing
    this.cand = null;
    if (ctl && p.place === 'world' && !p.down) {
      const reach = (s) => { const k = TYPES[s.type].kind; return this.bodyDist(s, p.pos.x, p.pos.z) < (k === 'bike' ? 1.6 : k === 'car' ? 1.4 : 3.4); };
      let c = this.nearest(p.pos.x, p.pos.z, 3.5, reach);
      // moving / waiting AI traffic can be taken from its driver
      const tr = g.traffic, a = tr && tr.nearestTakeable ? tr.nearestTakeable(p.pos.x, p.pos.z, 1.5) : null;
      if (a && (!c || this.bodyDist(a, p.pos.x, p.pos.z) < this.bodyDist(c, p.pos.x, p.pos.z))) c = a;
      if (c) {
        this.cand = c;
        const T = TYPES[c.type], h = c.heading ?? c.h, fx = Math.sin(h), fz = Math.cos(h), half = Math.max(0, T.L / 2 - T.W / 2);
        const u = clamp((p.pos.x - c.x) * fx + (p.pos.z - c.z) * fz, -half, half);
        this._candPos.set(c.x + fx * u, p.pos.y, c.z + fz * u);
        if (g.input.hit('KeyF')) { g.input.pressed.delete('KeyF'); this.enter(c); }
      }
    }
    this._prompt(null);
  }
  /**
   * The player on foot was pushed out of a vehicle body (push = how far we were shoved): a body of type `type` moving at
   * (vx, vz) and turning at w about (cx, cz). What it does goes by the blow, not by the vehicle's speed alone
   * (systems/_collide.js): the closing speed along the push — its bodywork where it met us, a swinging tail included,
   * against our own going — plus what friction drags along as it slides past, times the share a body of that mass can
   * give (a bus all of it, a bicycle a little over half). Over 2.6 m/s of that: bowled over and thrown that way, further
   * the harder it was; over 1.1: a stagger; less: only shoved aside. A flank brushing past no longer bowls anyone over.
   * The vehicle (ours to move: v) loses what a person costs it.
   */
  _hitPlayer(vx, vz, px, pz, v, type, w = 0, cx = 0, cz = 0) {
    const p = this.game.player;
    this.col.resolve(p.pos, 0.32, p.pos.y - this.game.groundHeight(p.pos.x, p.pos.z) > 0.05 ? { y: p.pos.y - this.game.groundHeight(p.pos.x, p.pos.z) } : OPT_NONE);    // (shoved, but never into a wall)
    if (p.down || !p.knockDown) return;
    const pl = Math.hypot(px, pz) || 1, nx = px / pl, nz = pz / pl;
    const B = blowOnFoot(vx, vz, w, cx, cz, p.pos.x, p.pos.z, nx, nz, p.vx || 0, p.vz || 0, type), eff = B.eff;
    if (eff > 2.6) {
      // bowled over: thrown the way the blow went and out from the body (bloodless; up again in ~2 s)
      p.knockDown(B.tx + nx * 1.2, B.tz + nz * 1.2, { hit: true });
      if (v && !v.static && v.kind === 'car') { const loss = strikerLoss(B.m, B.vn); v.vx -= nx * loss; v.vz -= nz * loss; }
      this._thud(eff, 0, v, 'person');
      this._emit('knock', { v, ped: null, player: true, speed: eff });
    } else if (eff > 1.1 && p.stumble) p.stumble({ x: nx, z: nz }, Math.min(0.6, eff * 0.18));
  }

  _idle(v, dt) {
    if (v.kind === 'punt') {
      // drift to a halt, gently, staying on the water
      const pp = this.game.player.pos;
      if (Math.abs(v.x - pp.x) + Math.abs(v.z - pp.z) < 80) this._current(v, dt); else v.cx = v.cz = 0;
      if (Math.abs(v.speed) > 0.01 || Math.abs(v.w) > 0.001 || v.cx || v.cz) {
        v.speed *= Math.exp(-0.35 * dt); v.w *= Math.exp(-1.5 * dt);
        this._puntMove(v, dt);
      }
      this._puntBob(v);
      if (v.stroke.phase !== 'idle' || v.stroke.stuck) { v.stroke = newStroke(); }
      this._pole(v, dt);
      return;
    }
    if (v.kind === 'bike' && (v.slideVx || v.slideVz)) {
      // knocked over: skidding along on its side, sparks off the pedals and the bars
      const sp = Math.hypot(v.slideVx, v.slideVz), k = Math.max(0, sp - 5.5 * dt) / (sp || 1);
      v.slideVx *= k; v.slideVz *= k;
      const P = _P; P.x = v.x + v.slideVx * dt; P.z = v.z + v.slideVz * dt;
      if (this.col.resolve(P, 0.35)) { v.slideVx *= 0.5; v.slideVz *= 0.5; }
      if (!this.wet(P.x, P.z)) { v.x = P.x; v.z = P.z; } else v.slideVx = v.slideVz = 0;
      v.heading = wrap(v.heading + (v.lean > 0 ? 1 : -1) * sp * 0.25 * dt);
      if (sp > 1.2 && this._nearCam(v) && Math.random() < dt * 30) this.puffs.emit(PUFF.spark, v.x, v.y + 0.08, v.z, v.slideVx * 0.5, 1.2, v.slideVz * 0.5, 1.2);
      if (sp > 1.2 && this._nearCam(v)) this.crashSnd.scrape(Math.min(1, sp / 6), v.x, (v.y || 0) + 0.1, v.z, 'tarmac');      // (metal on the road: one loop, fed every frame it slides)
      if (sp < 0.05) v.slideVx = v.slideVz = 0;
      this._ground(v, dt);
    }
    if (v.kind === 'bike' && Math.abs(v.speed) > 0.05) {
      // riderless bike rolls on a little then topples
      v.speed *= Math.exp(-2.5 * dt);
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const P = _P; P.x = v.x + fx * v.speed * dt; P.z = v.z + fz * v.speed * dt;
      this.col.resolve(P, 0.35);
      if (!this.wet(P.x, P.z)) { v.x = P.x; v.z = P.z; }
      this._ground(v, dt);
      if (Math.abs(v.speed) < 0.6 && !v.fallen) v.fallen = true;
    }
    if (v.kind === 'bike' && v.fallen) v.lean += ((v.lean >= 0 ? 1.35 : -1.35) - v.lean) * Math.min(1, dt * 5);
    if (v.kind === 'car') {
      if (!v.pitchS) initBody(v);
      if (v.spin) this._spinStep(v, dt);
      if (Math.abs(v.vx) > 0.02 || Math.abs(v.vz) > 0.02) {
        // nobody at the wheel (in gear, handbrake on): the tyres scrub it to a halt, harder sideways than along
        const fx = Math.sin(v.heading), fz = Math.cos(v.heading), lx = fz, lz = -fx;
        this._grip(v, dt);
        const gg = (v.gripF + v.gripR) * 0.5;
        let vf = v.vx * fx + v.vz * fz, vl = v.vx * lx + v.vz * lz;
        const d1 = 5.5 * gg * dt, d2 = 8 * gg * dt;
        vf = Math.abs(vf) <= d1 ? 0 : vf - Math.sign(vf) * d1; vl = Math.abs(vl) <= d2 ? 0 : vl - Math.sign(vl) * d2;
        v.vx = fx * vf + lx * vl; v.vz = fz * vf + lz * vl; v.speed = vf;
        v.locked = Math.abs(vf) > 1.5;
        if (this._nearCam(v)) { v.spinW = 0; v.under = 0; v.thr0 = 0; this._tyres(v, dt, vf, vl, false, gg); }
        this._hitWhat = null; this._hitOther = null; this._hitImp = 0; this._hitOwn = 0;
        const imp = this._carMove(v, dt);
        if (imp > 3 && this._nearCam(v)) { this._thud(imp, 0, v); if (this._hitFelt > 3.5) this._hurt(v, this._hitFelt); }
        // (a car shunted out of its bay, or left rolling, bowls people over as a driven one does: it used to slide through them)
        if (Math.abs(v.vx) + Math.abs(v.vz) > 2.2) this._knock(v, 0, 2, fx, fz);
        if (imp > 2.5) this._emit('impact', { v, impact: imp, what: this._hitWhat || 'wall', other: this._hitOther || null, shunted: !!this._shunted, own: this._hitOther ? this._hitOwn : imp, pushed: v.shuntT !== undefined && this.t - v.shuntT < 2 });
        if (Math.abs(v.vx) + Math.abs(v.vz) < 0.03 && !v.spin) { v.vx = v.vz = 0; v.speed = 0; }
        this._ground(v, dt);
      }
      // the body settles on its springs after a shunt (and the wheels stop turning)
      const P = PHYS[v.type];
      if (Math.abs(v.pitchS.x) + Math.abs(v.pitchS.v) + Math.abs(v.rollS.x) + Math.abs(v.rollS.v) + Math.abs(v.heaveS.x) + Math.abs(v.heaveS.v) > 2e-4) {
        spring(v.pitchS, 0, P.fP, P.zP, dt); spring(v.rollS, 0, P.fR, P.zR, dt); spring(v.heaveS, 0, P.fH, P.zH, dt);
        v.pitch = clamp(v.pitchS.x, -0.12, 0.12); v.lean = clamp(v.rollS.x, -0.15, 0.15);
      } else if (v.pitch || v.lean) { v.pitch = 0; v.lean = 0; v.pitchS.x = v.rollS.x = v.heaveS.x = 0; }
    }
    this._pose(v);
  }

  _syncPlayer(v) {
    const p = this.game.player, R = RIDER[v.type], h = v.heading, fx = Math.sin(h), fz = Math.cos(h);
    p.heading = h;
    p.pos.x = v.x + fx * R.z + fz * R.x;
    p.pos.z = v.z + fz * R.z - fx * R.x;
    p.pos.y = v.y + R.y;
    p.speed = Math.abs(v.speed);
    const grp = p.character.group;
    if (v.kind === 'bike') {
      // rider rolls (and pitches, over a kerb) with the bike about its ground contact line
      grp.position.set(p.pos.x, v.y - R.z * v.gp, p.pos.z);
      grp.rotation.order = 'YXZ'; grp.rotation.set(v.gp, h, v.lean);
    } else if (v.kind === 'punt') {
      grp.position.set(p.pos.x, v.mesh.position.y + R.y, p.pos.z);
      grp.rotation.order = 'YXZ'; grp.rotation.set(v.mesh.rotation.x, h, v.mesh.rotation.z);
    } else {
      grp.position.set(p.pos.x, p.pos.y, p.pos.z);
      grp.rotation.order = 'YXZ'; grp.rotation.set(0, h, 0);
    }
    if (p.place === 'world') p.worldPos.copy(p.pos);
  }

  _pose(v) {
    const m = v.mesh;
    m.position.set(v.x, v.kind === 'punt' ? m.position.y || this.waterY : v.y, v.z);
    m.rotation.y = v.heading;
    if (v.kind === 'bike') {
      m.rotation.x = v.gp; m.rotation.z = v.lean;
      const r = v.rig;
      r.steer.rotation.y = v.steer * 1.4;
      r.wheelF.rotation.x = v.wheelA; r.wheelR.rotation.x = v.wheelA;
      r.crank.rotation.x = v.crankA;
    } else if (v.kind === 'car') {
      // body roll / dive turn the whole body, wheels and all, about the ground under its middle: lift it by what the low
      // corner would otherwise sink, so no tyre is ever below the road
      const T = TYPES[v.type];
      m.position.y = v.y + (v.heaveS ? v.heaveS.x : 0) + Math.abs(v.lean) * (T.W * 0.5 - 0.12) + Math.abs(v.pitch) * T.wb * 0.5;
      m.rotation.x = v.pitch + v.gp; m.rotation.z = v.lean + v.gr;
      // wheels roll and steer, brake lamps (all in the body's one draw: _vehiclemeshes.js MATS.car); once per frame per car
      if (v.rig.drive && v._dft !== this.t) { v.rig.drive(v.speed, v.steer, v._dft === undefined ? 0 : this._dt || 0, !!v.driver); v._dft = this.t; }
    }
  }

  // ------------------------------------------------------------ taking a vehicle from its driver (AI traffic)
  // F next to a slow/stopped AI car, taxi, van, bus or cyclist: the AI brakes and holds (traffic.hold), the player walks to
  // the driver's door (right-hand side) as it swings open, the driver is turfed out (traffic.handOver -> pedestrians.adopt),
  // a live vehicle of the same type/colour replaces the AI rig, the player slides in, the door shuts. ~0.9 s (bikes 0.6 s).
  _startTake(a) {
    const g = this.game, p = g.player, tr = g.traffic, T = TYPES[a.type];
    if (!T || this.cur || this.taking || p.place !== 'world' || !tr || !tr.hold(a)) return false;
    const bike = T.kind === 'bike';
    const tk = this.taking = { a, v: null, t: 0, type: a.type, bike, sx: p.pos.x, sz: p.pos.z, sy: p.pos.y, sh: p.heading, door: null, dinfo: null,
      fromLeft: false, handT: bike ? 0.28 : 0.4, endT: bike ? 0.62 : 0.92, posed: false };
    if (bike) {
      const lx = Math.cos(a.heading), lz = -Math.sin(a.heading);
      tk.fromLeft = (p.pos.x - a.x) * lx + (p.pos.z - a.z) * lz > 0;
    } else {
      try { tk.door = makeDoor(a.type, a.rig.color); tk.dinfo = doorInfo(a.type); tk.door.position.set(tk.dinfo.x, 0, tk.dinfo.z); a.rig.group.add(tk.door); } catch (e) { tk.door = null; }
      click(g.audio);
    }
    p.frozen++; p.speed = 0; this.cand = null; this._prompt(null);
    return true;
  }
  _takeUpdate(dt) {
    const g = this.game, p = g.player, tr = g.traffic, tk = this.taking;
    if (p.place !== 'world' || Math.hypot(p.pos.x - this._lpx, p.pos.z - this._lpz) > 4 || (!tk.v && (!tk.a.active || !tk.a.held))) { this._abortTake(); return; }
    tk.t += dt;
    const host = tk.v || tk.a, T = TYPES[tk.type], h = host.heading, fx = Math.sin(h), fz = Math.cos(h), lx = fz, lz = -fx;
    const dxl = tk.bike ? (tk.fromLeft ? 0.72 : -0.72) : -(T.W / 2 + 0.5), dzl = tk.bike ? -0.15 : T.seat.z - 0.2;
    const doorX = host.x + fx * dzl + lx * dxl, doorZ = host.z + fz * dzl + lz * dxl;
    const R = RIDER[tk.type], seatX = host.x + fx * R.z + lx * R.x, seatZ = host.z + fz * R.z + lz * R.x, gy = g.groundHeight(doorX, doorZ);
    const grp = p.character.group;
    if (!tk.v && tk.t >= tk.handT) {
      // the door is open: out you get
      const info = tr.handOver(tk.a, { fromLeft: tk.fromLeft });
      if (!info) { this._abortTake(); return; }
      const v = this.spawn(tk.type, info.x, info.z, info.heading, { color: info.color });
      v.driver = 'taking'; v.parked = false; v.stolen = true;
      if (v.kind === 'car') { v.vx = Math.sin(info.heading) * info.speed; v.vz = Math.cos(info.heading) * info.speed; v.speed = info.speed; }
      else v.speed = 0;
      if (tk.type === 'taxi' && v.rig.setSign) v.rig.setSign(false);    // the TAXI light goes off: not for hire
      if (tk.type === 'bus' && v.rig.setBlind && tk.a.blindI !== undefined) v.rig.setBlind(tk.a.blindI);   // still shows its route (jobs.js)
      if (tk.door) { tk.door.removeFromParent(); v.mesh.add(tk.door); }
      if (tk.bike) this._thud(2, 0, null, 'bikefall');
      tk.v = v; tk.a = null; this.lastTake = info;
      return;
    }
    let x, z, y, hd;
    if (!tk.v) {
      const k = smooth(tk.t / tk.handT);
      x = tk.sx + (doorX - tk.sx) * k; z = tk.sz + (doorZ - tk.sz) * k; y = tk.sy + (gy - tk.sy) * k;
      hd = tk.bike ? h : Math.atan2(seatX - doorX, seatZ - doorZ);
      p.speed = 2.4;
    } else {
      const k = smooth((tk.t - tk.handT) / (tk.endT - tk.handT));
      x = doorX + (seatX - doorX) * k; z = doorZ + (seatZ - doorZ) * k; y = gy + (host.y + R.y - gy) * k;
      hd = tk.bike ? h : Math.atan2(seatX - doorX, seatZ - doorZ) + wrap(h - Math.atan2(seatX - doorX, seatZ - doorZ)) * k;
      if (!tk.posed && k > 0.3) { tk.posed = true; p.pose = POSE[TYPES[tk.type].kind]; try { p.character.setPose(p.pose); } catch { /* ignore */ } }
      p.speed = 0;
    }
    if (tk.door) {
      const open = tk.v ? 1 - smooth((tk.t - (tk.endT - 0.24)) / 0.2) : smooth((tk.t - 0.05) / 0.26);
      tk.door.rotation.y = 1.15 * open;
    }
    p.pos.set(x, y, z); p.heading = hd;
    grp.position.set(x, y, z); grp.rotation.order = 'YXZ'; grp.rotation.set(0, hd, 0);
    if (tk.t >= tk.endT) this._finishTake();
  }
  _finishTake() {
    const g = this.game, p = g.player, tk = this.taking, v = tk.v;
    if (tk.door) { tk.door.removeFromParent(); tk.door = null; }
    this.taking = null;
    p.frozen = Math.max(0, p.frozen - 1);
    v.driver = null;
    if (!tk.bike) slam(g.audio);
    this.enter(v);
    const st = g.state || (g.state = {});
    st.vehiclesTaken = (st.vehiclesTaken || 0) + 1;
    try { if (g.save) g.save(); } catch { /* ignore */ }
    this._toast(`${TAKE_NAME[v.type] || v.name}  ·  vehicles taken: ${st.vehiclesTaken}`, 2.8);
    this._emit('take', { v, info: this.lastTake });
  }
  _abortTake() {
    const g = this.game, p = g.player, tk = this.taking;
    if (!tk) return;
    this.taking = null;
    if (tk.door) { tk.door.removeFromParent(); tk.door = null; }
    if (tk.a && g.traffic) g.traffic.unhold(tk.a);
    if (tk.v) { tk.v.driver = null; tk.v.parked = true; }
    p.frozen = Math.max(0, p.frozen - 1);
    if (p.pose !== 'stand') { p.pose = 'stand'; try { p.character.setPose('stand'); } catch { /* ignore */ } }
  }
  /** Player driving a bus, stopped at a bus stop: doors and the bell (once per stop). */
  _playerBusStop(v) {
    const tr = this.game.traffic;
    if (!tr || !tr.nearBusStop) return;
    if (Math.abs(v.speed) < 0.3) {
      if (v.atStop) return;
      const st = tr.nearBusStop(v.x + Math.sin(v.heading) * 3, v.z + Math.cos(v.heading) * 3, 9);
      if (!st || st.id === v.lastStopId) return;
      v.atStop = true; v.lastStopId = st.id;
      busDoors(this.game.audio);
      // a listener (systems/jobs.js: passengers, the bus-route job) returning true replaces the default toast
      if (!this._emit('busStop', { v, stop: st })) this._toast((st.name ? st.name + ': ' : '') + BUS_STOP_LINES[Math.floor(Math.random() * BUS_STOP_LINES.length)], 3);
    } else if (Math.abs(v.speed) > 2) v.atStop = false;
  }

  // ------------------------------------------------------------ bicycle
  _bike(v, dt, ctl) {
    const g = this.game, inp = g.input, T = TYPES[v.type];
    const W = ctl && (inp.down('KeyW') || inp.down('ArrowUp')), S = ctl && (inp.down('KeyS') || inp.down('ArrowDown'));
    const sprint = ctl && inp.run, steerIn = ctl ? inp.moveX : 0;
    const top = sprint ? 12 : 9;
    // wet / snowy roads (game.weather.grip): the brakes and the cornering limit shrink with the grip (no weather: exactly 1)
    const wg = g.weather && g.weather.grip < 1 ? Math.max(0.4, g.weather.grip) : 1;
    if (W) {
      if (v.speed < 0) v.speed = Math.min(0, v.speed + 6 * dt);
      else if (v.speed < top) v.speed = Math.min(top, v.speed + ((sprint ? 3.4 : 2.4) * (1 - 0.55 * v.speed / top) + (sprint ? 2.6 : 1.9) * Math.max(0, 1 - v.speed / 4.2)) * dt);   // + a stamp on the pedals from rest (0 -> 4 m/s in ~1.1 s, not ~1.9; top speeds unchanged)
      else v.speed -= 1.2 * dt;
    } else if (S) {
      if (v.speed > 0.05) v.speed = Math.max(0, v.speed - 7 * wg * dt); else v.speed = Math.max(-1.2, v.speed - 2 * dt);
    } else {
      const d = (0.22 + 0.0055 * v.speed * v.speed) * dt;
      v.speed = Math.abs(v.speed) <= d ? 0 : v.speed - Math.sign(v.speed) * d;
    }
    // lean-steer: A = left (+heading)
    const maxSteer = 0.6 / (1 + Math.abs(v.speed) * 0.3);
    v.steer += (-steerIn * maxSteer - v.steer) * Math.min(1, dt * 7);
    let yaw = (v.speed * Math.tan(v.steer)) / T.wb;
    // (on a slippery road no tighter than ~0.75 g times the grip: the bike runs wide instead; dry, unchanged)
    if (wg < 1) { const aL = Math.abs(v.speed * yaw), aMax = 7.4 * wg; if (aL > aMax) yaw *= aMax / aL; }
    v.heading = wrap(v.heading + yaw * dt);
    // lean into the turn (atan(v * yaw / g)); balancing at a crawl the bike wobbles (and the bars with it)
    const slow = clamp(1 - Math.abs(v.speed) / 1.8, 0, 1) * (Math.abs(v.speed) > 0.15 ? 1 : 0);
    v.wob = (v.wob || 0) + dt * (5.5 + 2 * Math.sin(this.t * 0.7));
    const wob = slow * (0.075 * Math.sin(v.wob) + 0.03 * Math.sin(v.wob * 2.3 + 1));
    const leanT = clamp(-Math.atan((v.speed * yaw) / 9.81), -0.65, 0.65) + (Math.abs(v.speed) < 0.3 ? -0.04 : 0) + wob;
    v.lean += (leanT - v.lean) * Math.min(1, dt * 6);
    v.steer += slow * 0.06 * Math.cos(v.wob) * dt * 6;
    // pedalling + wheels
    const R = T.R;
    v.wheelA = (v.wheelA + (v.speed / R) * dt) % TAU;
    if (W || (sprint && v.speed > 0.5)) v.crankA = (v.crankA + (v.speed / R) * dt * 0.38 * (sprint ? 1.2 : 1)) % TAU;
    if (g.props) g.props.vehicleContact(v, dt);   // [props] knock what the bike is about to hit; may slow v.speed (systems/props.js)
    // move with sub-steps so walls can't be tunnelled through
    const dist = v.speed * dt, n = Math.max(1, Math.ceil(Math.abs(dist) / 0.25)), fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let crash = 0, hitA = null;
    const bx0 = v.x, bz0 = v.z;
    this._strk = 0;
    for (let i = 0; i < n; i++) {
      const imp = this._stepCircle(v, fx * dist / n, fz * dist / n, T.radius, false);
      if (imp > crash) crash = imp;
      if (this._hitWhat === 'traffic' && this._hitOther && this._hitOther.kind === 'bike') hitA = this._hitOther;
    }
    // run into by something (a car, a van, a bus, another bicycle coming at us, whether we were moving or not): thrown
    // off the way it was going at any real speed; below that shoved along with a wobble (systems/_collide.js)
    if (this._strk > BIKE_NUDGE) {
      const sk = this._strk, sh = this._strkM / (this._strkM + PHYS[v.type].m);
      if (sk > BIKE_OFF) { this._crash(v, sk, this._strkVx * sh, this._strkVz * sh); return; }
      const al = (this._strkVx * fx + this._strkVz * fz) * sh;
      if (al > 0) v.speed = Math.max(v.speed, al); else v.speed = Math.min(v.speed, al);
      if (this.t - (v._nudT === undefined ? -9 : v._nudT) > 0.7) { v._nudT = this.t; v.wob += 1.5; this._thud(sk, 0, v, 'bike'); if (g.shake) g.shake(0.1 + sk * 0.05); }
    }
    // a cyclist of the traffic ridden into hard: they come off as well (and we lose most of our speed to them)
    if (hitA && this._bikeIntoCyclist(v, hitA, fx, fz)) crash = Math.max(crash, 0.01);
    if (crash > 0) {
      if (crash > 2.5) this._emit('impact', { v, impact: crash, what: this._hitWhat || 'wall', other: this._hitOther || null });
      if (crash > 4.6) { this._crash(v, crash); return; }
      if (crash > 1.8 && this._nearCam(v)) this._thud(crash, 0, v);      // (a knock that does not throw you off: the bike rattles)
      v.speed *= Math.max(0, 1 - crash / Math.max(1, Math.abs(v.speed)) * 0.9);
      // a glancing brush with a wall, hedge or kerb line turns the front wheel along it (the bike follows the way it
      // actually went) instead of leaving it pointing into the wall and grinding to a halt
      const mx = v.x - bx0, mz = v.z - bz0, md = Math.hypot(mx, mz);
      if (v.speed > 1 && md > Math.abs(dist) * 0.35) {
        const e = wrap(Math.atan2(mx, mz) - v.heading);
        if (Math.abs(e) < 1.0) v.heading = wrap(v.heading + e * Math.min(1, dt * 9));
      }
    }
    this._ground(v, dt);
    // bell
    if (ctl && inp.hit('Space')) { bell(g.audio); this._clearWay(v, 11); }
    this._engineUpdate(v, W || sprint);   // tyre hum + freewheel tick
    this._knock(v, T.radius + 0.35, 2.6, fx, fz);
    if (this.cur === v) this._knockPlayers(v, fx, fz);
    this._pose(v);
  }
  /** our bicycle into one of the traffic's cyclists, closing fast enough: they are knocked off (systems/traffic.js knockOff) */
  _bikeIntoCyclist(v, a, fx, fz) {
    if (!a || a.active === false || a.kind !== 'bike') return false;
    const avx = Math.sin(a.heading) * (a.speed || 0), avz = Math.cos(a.heading) * (a.speed || 0), vx = fx * v.speed, vz = fz * v.speed;
    const rel = Math.hypot(vx - avx, vz - avz);
    if (rel < BIKE_OFF + 0.6) return false;
    if (!this._unseat(v, a, vx, vz, avx, avz, rel)) return false;
    v.speed *= 1 - Math.min(0.9, strikerLoss(PHYS[v.type].m, 1, PHYS[a.type].m));
    return true;
  }
  /**
   * Vehicle v, going at (vx, vz), knocks an AI cyclist (going at avx, avz) off: the rider tumbles (traffic.knockOff ->
   * pedestrians.adopt) with as much of our speed as a body of our mass gives one of theirs, the bicycle is left skidding
   * on its side. Returns the hand-over record, or null (somebody else's and not ours to knock; no such agent).
   */
  _unseat(v, a, vx, vz, avx, avz, rel) {
    const tr = this.game.traffic; if (!tr || !tr.knockOff) return null;
    const M = PHYS[v.type].m, ma = (PHYS[a.type] || PHYS.bike_roadster).m, sh = Math.min(1, 1.4 * M / (M + ma));
    const info = tr.knockOff(a, vx * sh, vz * sh);
    if (!info) return null;
    const b = this.spawn(info.type, info.x, info.z, info.heading, { color: info.color });
    b.fallen = true; b.lean = (Math.random() < 0.5 ? -1 : 1) * 0.3; b.slideVx = vx * 0.55 * sh + avx * 0.3; b.slideVz = vz * 0.55 * sh + avz * 0.3; b.speed = 0;
    if (this._nearCam(v)) this._thud(rel, 0, v, 'cyclist');
    if (v === this.cur && this.game.shake) this.game.shake(Math.min(0.5, 0.08 + rel * 0.02 * (v.kind === 'bike' ? 2 : 1)));
    this._emit('knock', { v, ped: info.driver || null, speed: rel, cyclist: true });
    return info;
  }

  /**
   * Children and animals cannot be run into (systems/_ped_protect.js): a vehicle heading at one is held back, hard, to
   * the speed from which it stops short of them — as if the brakes had been stood on — whoever is driving and whatever
   * keys are down; at arm's length from them it does not move towards them at all. (They step aside as well, and
   * nothing can knock them over: pedestrians.knock.) The car's velocity (vx, vz) or the bike's speed is cut, nothing else.
   */
  _guard(v) {
    const PR = this.game.pedestrians && this.game.pedestrians.protect; if (!PR || !PR.speedCap) return;
    if (v.kind === 'car') {
      if (!Number.isFinite(v.vx)) return;
      const sp = Math.hypot(v.vx, v.vz); if (sp < 0.3) return;
      const cap = PR.speedCap(v, v.vx, v.vz);
      if (cap < sp) { const k = cap / sp; v.vx *= k; v.vz *= k; if (Number.isFinite(v.speed)) v.speed *= k; if (Number.isFinite(v.vl)) v.vl *= k; v.guardT = this.t; }
    } else if (v.kind === 'bike') {
      const sp = v.speed || 0; if (Math.abs(sp) < 0.3) return;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading), cap = PR.speedCap(v, fx * sp, fz * sp);
      if (cap < Math.abs(sp)) { v.speed = Math.sign(sp) * cap; v.guardT = this.t; }
    }
  }

  /** The bell / the horn: walkers in the way ahead (within `reach` m, in the vehicle's path) hop clear, as they do for
   *  anything about to run into them (pedestrians.knock below its hop speed: a side-step and a remark, nobody falls).
   *  Scripted crowds (knockable: false) and anyone already down are left alone by knock itself. */
  _clearWay(v, reach) {
    const P = this.game.pedestrians; if (!P || !P.near || !P.knock) return 0;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading), half = TYPES[v.type].W / 2 + 0.9;
    let n = 0;
    for (const p of P.near(v.x + fx * reach * 0.5, v.z + fz * reach * 0.5, reach * 0.5 + 1.5, _near)) {
      const dx = p.x - v.x, dz = p.z - v.z, along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
      if (along < 0.8 || along > reach || lat > half + along * 0.06) continue;
      if (P.knock(p, fx * 1.5, fz * 1.5) === 'dodge') n++;
    }
    return n;
  }

  /** Move a single circle (bikes); returns impact speed into whatever it hit (0 = clear). */
  _stepCircle(v, dx, dz, radius, ignoreLow) {
    const c = this.col, P = _P;
    this._hitWhat = null; this._hitOther = null; this._hitOvx = 0; this._hitOvz = 0;
    const ox = v.x, oz = v.z;
    P.x = ox + dx; P.z = oz + dz;
    let hit = c.resolve(P, radius, ignoreLow ? OPT_LOW : OPT_NONE);
    if (hit) this._wallMat = materialOf(c.lastHit && c.lastHit.tag);
    hit = this._pushDynamic(P, radius, v, false) || hit;
    if (this.wet(P.x, P.z)) {
      // blocked at the bank: slide along an axis if possible
      if (!this.wet(P.x, oz)) P.z = oz; else if (!this.wet(ox, P.z)) P.x = ox; else { P.x = ox; P.z = oz; }
      hit = true; this._wallMat = 'bank';
    }
    v.x = P.x; v.z = P.z;
    if (!hit) return 0;
    const mx = P.x - ox, mz = P.z - oz, want = Math.hypot(dx, dz) || 1e-6;
    // impact = how much of the intended motion was cancelled, scaled to speed
    const along = (mx * dx + mz * dz) / want;
    // (against something that is itself moving it is the CLOSING speed that counts: riding into the back of a car going
    //  the same way is a tap, into one coming the other way it is both speeds)
    const rec = (this._hitOvx * dx + this._hitOvz * dz) / want;
    return Math.max(0, (want - along) / want) * Math.max(0, Math.abs(v.speed) - rec);
  }
  /** (bicycles) pushed (dx, dz) out of a body of `type` that is going at (ovx, ovz): how fast it was coming AT us */
  _struck(dx, dz, ovx, ovz, type) {
    this._hitOvx = ovx; this._hitOvz = ovz;
    const d = Math.hypot(dx, dz); if (d < 1e-6) return;
    const vn = (ovx * dx + ovz * dz) / d;
    if (vn > this._strk) {
      const sp = Math.hypot(ovx, ovz), k = sp > 25 ? 25 / sp : 1;      // (another player's car as we draw it can jump: never a launch)
      this._strk = Math.min(vn, 25); this._strkVx = ovx * k; this._strkVz = ovz * k; this._strkM = (PHYS[type] || PHYS.car_hatch).m;
    }
  }

  /** Push circle P out of live vehicles, traffic and (for cars) parked cars. */
  _pushDynamic(P, r, self, parkedCars) {
    let hit = false;
    const bike = self.kind === 'bike';
    for (let i = 0; i < this.live.length; i++) {
      const o = this.live[i];
      if (o === self || o.kind === 'punt' || (o.kind === 'bike' && self.kind === 'car')) continue;
      if (Math.abs(o.x - P.x) > 12 || Math.abs(o.z - P.z) > 12) continue;
      const bx = P.x, bz = P.z;
      if (pushCapsule(P, r, o.x, o.z, o.heading, TYPES[o.type])) {
        hit = true; this._hitWhat = 'vehicle'; this._hitOther = o;
        if (bike && o.kind === 'car') this._struck(P.x - bx, P.z - bz, o.vx || 0, o.vz || 0, o.type);
      }
    }
    const tl = this.game.traffic && this.game.traffic.list;
    // self.passTraffic / self.passBikes: AI-driven cars squeezing through (police with blue lights) ignore AI traffic / cyclists
    if (tl && !self.passTraffic) for (let i = 0; i < tl.length; i++) {
      const o = tl[i];
      if (!o || o.active === false || Math.abs(o.x - P.x) > 12 || Math.abs(o.z - P.z) > 12) continue;
      if (self.passBikes && o.kind === 'bike') continue;
      const bx = P.x, bz = P.z;
      if (pushCapsuleRaw(P, r, o.x, o.z, o.heading, o.half || 0, o.radius || 0.8)) {
        hit = true; this._hitWhat = 'traffic'; this._hitOther = o;
        if (bike) { const sh = o.shove, sp = o.speed || 0; this._struck(P.x - bx, P.z - bz, sh ? sh.vx : Math.sin(o.heading) * sp, sh ? sh.vz : Math.cos(o.heading) * sp, o.type); }
      }
    }
    // another player's car, and their police cars (addBodies): as solid to a bicycle as our own are — and one driven
    // into us throws us off, on our machine (each peer owns its own body)
    if (bike) for (let i = 0; i < this.remoteBodies.length; i++) {
      const q = this.remoteBodies[i];
      if (!q.on || Math.abs(q.x - P.x) > 12 || Math.abs(q.z - P.z) > 12) continue;
      const bx = P.x, bz = P.z;
      if (pushCapsule(P, r, q.x, q.z, q.h, TYPES[q.type])) { hit = true; this._hitWhat = 'remote'; this._hitOther = null; this._struck(P.x - bx, P.z - bz, q.vx || 0, q.vz || 0, q.type); }
    }
    if (parkedCars) {
      this.pools.forEach((pl) => {
        if (pl.type === 'stand' || pl.type === 'punt' || TYPES[pl.type].kind !== 'car') return;
        pl.grid.each(P.x, P.z, 7, (s) => { if (!s.taken && pushCapsule(P, r, s.x, s.z, s.h, TYPES[s.type])) { hit = true; this._hitWhat = 'parked'; this._hitOther = s; } });
      });
    }
    return hit;
  }

  /** Hit something hard on a bike: the rider goes over the bars and tumbles clear, the bike skids on along on its side. */
  _crash(v, impact, tvx, tvz) {
    const g = this.game, p = g.player, struck = tvx !== undefined;      // (struck: something ran into US, and (tvx, tvz) is what it gave us)
    this._thud(impact, 0, v, struck ? 'car' : null);
    this._toast(struck ? ['Knocked off your bike!', 'Off you come. Mind the traffic.', 'The bigger vehicle wins.'][Math.floor(Math.random() * 3)]
      : ['You went over the handlebars!', 'Splat. The wall wins.', 'Comedy dismount: 10/10.', 'Ouch. Mind the stonework.'][Math.floor(Math.random() * 4)], 2.5);
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading), sp = Math.max(Math.abs(v.speed), impact);
    v.fallen = true; v.lean = (Math.random() < 0.5 ? -1 : 1) * 0.25;
    if (struck) {
      // (the bicycle goes the way it was sent, on its side, sparking)
      const ts = Math.hypot(tvx, tvz), k = ts > 12 ? 12 / ts : 1;
      v.slideVx = tvx * k * 0.9; v.slideVz = tvz * k * 0.9;
    } else {
      // (it glances off what it hit and skids away at an angle, on its side, sparking)
      const ga = (Math.random() < 0.5 ? -1 : 1) * (1.0 + Math.random() * 0.5), gs = Math.abs(v.speed) * 0.4;
      v.slideVx = (fx * Math.cos(ga) + fz * Math.sin(ga)) * gs; v.slideVz = (fz * Math.cos(ga) - fx * Math.sin(ga)) * gs;
    }
    v.speed = 0;
    this.exit(true);
    v.driver = null;
    if (p.knockDown) {
      // thrown forwards; what it hit takes most of that (a tumble against the wall, not through it) - or, run into, the
      // way the thing that hit us was going
      if (struck) p.knockDown(tvx, tvz, { hit: true });
      else p.knockDown(fx * clamp(sp * 0.7, 3.5, 8), fz * clamp(sp * 0.7, 3.5, 8), { forward: true });
    } else { try { p.character.setPose('fall', { forward: true }); } catch { /* ignore */ } }
    if (g.shake) g.shake(Math.min(1, 0.3 + impact * 0.06));
    this.crashes = (this.crashes || 0) + 1;
  }

  /**
   * Vehicle v against the people on foot round it (2026-11-26; systems/_collide.js has the numbers). The whole body, not
   * a circle at the nose: its capsule against each walker within reach — the front, the flanks, the tail of a car that is
   * sliding or spinning. What a walker gets is the blow at the contact: the closing speed along the normal there (the
   * body's surface, its turning included, against the walker's own walking), plus what friction drags along as it slides
   * past. So a square hit throws them the way the car is going; one clipped by a corner goes off to the side with less.
   * pedestrians.knock(ped, blow, mass) decides by what a body of that mass can give them: hop clear with a shout,
   * knocked over, thrown over the bonnet — and how far. The vehicle loses (1 + e) m / (M + m) of the closing speed along
   * that normal: a bus hardly anything, a hatchback a twelfth, a bicycle most of it (and over 6.5 m/s its rider comes
   * off). Children, the adults with them and animals are never touched: knock() refuses them (and _guard has already
   * held the vehicle back). Up to three people a frame; anybody once per 1.5 s. (r: no longer used.)
   */
  _knock(v, r, minSpeed, fx, fz) {
    const peds = this.game.pedestrians;
    if (!peds || !peds.knock || !(peds.near || peds.nearest)) return;
    const car = v.kind === 'car', vx = car ? v.vx : fx * v.speed, vz = car ? v.vz : fz * v.speed, sp = Math.hypot(vx, vz);
    if (!(sp >= minSpeed)) return;
    const T = TYPES[v.type], rad = car ? T.W / 2 : 0.22, half = Math.max(0, T.L / 2 - (car ? rad : 0.3)), reach = rad + PED_R + 0.3;
    const w = car ? (v.yr || 0) + (v.spin || 0) : 0, M = PHYS[v.type].m, vmin = Math.min(minSpeed, 1);
    let L = _near;
    if (peds.near) L = peds.near(v.x, v.z, half + reach + 0.1, _near);
    else {
      // (a pedestrians system with only the old contract — nearest(x, z, r): whoever is nearest the leading end)
      const e = (vx * fx + vz * fz < 0 ? -1 : 1) * half, q = peds.nearest(v.x + fx * e, v.z + fz * e, reach + 0.1);
      _near.length = 0; if (q) _near.push(q);
    }
    let n = 0;
    for (let i = 0; i < L.length && n < 3; i++) {
      const p = L[i];
      if (p.child || this.t - (p._vkT === undefined ? -9 : p._vkT) < 1.5) continue;
      const dx = p.x - v.x, dz = p.z - v.z, u = clamp(dx * fx + dz * fz, -half, half);
      const ox = dx - fx * u, oz = dz - fz * u, d = Math.hypot(ox, oz);
      if (d > reach) continue;
      const nx = d > 1e-3 ? ox / d : vx / sp, nz = d > 1e-3 ? oz / d : vz / sp;
      const rx = fx * u + nx * rad, rz = fz * u + nz * rad, ps = p.speed || 0;
      const cvx = vx + w * rz - (ps ? Math.sin(p.heading) * ps : 0), cvz = vz - w * rx - (ps ? Math.cos(p.heading) * ps : 0), vn = cvx * nx + cvz * nz;
      if (!(vn >= vmin)) continue;                       // (going away from them, or only passing)
      const G = glance(vn, cvx * nz - cvz * nx, _GL);
      // pedestrians.knock decides by the blow: hop clear with a shout (slow), knocked over, thrown over the bonnet (fast)
      let res = true;
      try { res = peds.knock(p, nx * G.n + nz * G.t, nz * G.n - nx * G.t, M); } catch (e) { console.warn(e); res = false; }
      if (res === false) continue;
      p._vkT = this.t;
      if (res === 'dodge') continue;
      n++;
      const loss = strikerLoss(M, vn);
      // (shunted: pushed into them by someone else's car in the last 2 s - systems/police.js does not charge you for that)
      this._emit('knock', { v, ped: p, speed: vn, shunted: v.shuntT !== undefined && this.t - v.shuntT < 2 });
      this._thud(vn, 0, v, 'person');
      if (v === this.cur && this.game.shake) this.game.shake(Math.min(0.5, 0.06 + loss * 0.2 + vn * 0.008));      // (by what it cost us: a bus driver hardly feels it)
      if (car) { v.vx -= nx * loss; v.vz -= nz * loss; if (v.heaveS) v.heaveS.v -= Math.min(0.4, vn * 0.03); }
      else {
        const s = v.speed < 0 ? -1 : 1;
        v.speed = s * Math.max(0, Math.abs(v.speed) - loss * Math.max(0.5, Math.abs(nx * fx + nz * fz)));
        if (vn > 6.5) { this._crash(v, vn); return; }
      }
    }
  }
  /**
   * The vehicle WE drive against other players on foot or on bicycles (they are not bodies here: core/net.js draws
   * them). Each peer owns its own body, so the fall is theirs to decide — their machine sees our car run into them and
   * bowls them over (_onFoot / _hitPlayer, _bike / _struck) — and what it costs us is ours: the same loss of speed, thud
   * and shake as for a walker, from the same contact as we draw it. Nothing is sent. Not passengers, not the seated.
   */
  _knockPlayers(v, fx, fz) {
    const net = this.game.net; if (!net || !net.others || !net.others.size) return;
    const car = v.kind === 'car', vx = car ? v.vx : fx * v.speed, vz = car ? v.vz : fz * v.speed, sp = Math.hypot(vx, vz);
    if (sp < 2.8) return;
    const T = TYPES[v.type], rad = car ? T.W / 2 : 0.22, half = Math.max(0, T.L / 2 - (car ? rad : 0.3));
    const w = car ? (v.yr || 0) + (v.spin || 0) : 0, M = PHYS[v.type].m;
    for (const o of net.others.values()) {
      if (!o.seen || o.place !== 'world' || o.ride || Math.abs(o.x - v.x) > 9 || Math.abs(o.z - v.z) > 9 || Math.abs((o.y || 0) - (v.y || 0)) > 1.8) continue;
      const To = o.veh ? TYPES[o.veh] : null;
      if (o.veh ? !To || To.kind !== 'bike' : o.pose === 'sit' || o.pose === 'swim' || TUMBLE_POSES.has(o.pose)) continue;      // (in a car: a body, _bodies; seated; already going over)
      if (this.t - (o._vkT === undefined ? -9 : o._vkT) < 1.5) continue;
      const dx = o.x - v.x, dz = o.z - v.z, u = clamp(dx * fx + dz * fz, -half, half);
      const ox = dx - fx * u, oz = dz - fz * u, d = Math.hypot(ox, oz);
      if (d > rad + (To ? 0.4 : PED_R) + 0.12) continue;
      const nx = d > 1e-3 ? ox / d : vx / sp, nz = d > 1e-3 ? oz / d : vz / sp;
      const rx = fx * u + nx * rad, rz = fz * u + nz * rad, os = Math.abs(o.speed || 0);
      const vn = (vx + w * rz - Math.sin(o.h) * os) * nx + (vz - w * rx - Math.cos(o.h) * os) * nz;
      if (!(vn >= 2.8)) continue;
      o._vkT = this.t;
      const loss = strikerLoss(M, vn, To ? PHYS[o.veh].m : PED_MASS);
      this._emit('knock', { v, ped: null, player: true, remote: o.id, speed: vn });
      this._thud(vn, 0, v, To ? 'cyclist' : 'person');
      if (this.game.shake) this.game.shake(Math.min(0.5, 0.06 + loss * 0.2 + vn * 0.008));
      if (car) { v.vx -= nx * loss; v.vz -= nz * loss; if (v.heaveS) v.heaveS.v -= Math.min(0.4, vn * 0.03); }
      else {
        const s = v.speed < 0 ? -1 : 1;
        v.speed = s * Math.max(0, Math.abs(v.speed) - loss * Math.max(0.5, Math.abs(nx * fx + nz * fz)));
        if (vn > 6.5) { this._crash(v, vn); return; }
      }
    }
  }

  // ------------------------------------------------------------ car
  _car(v, dt, ctl) {
    const g = this.game, inp = g.input, T = TYPES[v.type];
    const W = ctl && (inp.down('KeyW') || inp.down('ArrowUp')), S = ctl && (inp.down('KeyS') || inp.down('ArrowDown'));
    const hand = ctl && inp.down('Space'), steerIn = ctl ? inp.moveX : 0;
    this._carPhys(v, dt, W ? 1 : 0, S, hand, steerIn);
    if (ctl && inp.hit('KeyH')) { horn(g.audio, v.type); this._clearWay(v, 16); }
    if (v.type === 'bus') this._playerBusStop(v);
    this._knock(v, T.W / 2 + 0.35, KNOCK_MIN, Math.sin(v.heading), Math.cos(v.heading));
    this._knockPlayers(v, Math.sin(v.heading), Math.cos(v.heading));
    this._engineUpdate(v, W || (S && v.speed < 0.3), S);      // (S at rest or going backwards is the accelerator in reverse)
    this._pose(v);
  }
  /** Rotational kick from a shunt ("ramming just spins cars"): heading turns at v.spin rad/s, decaying. */
  _spinStep(v, dt) {
    v.spin = clamp(v.spin, -SPIN_MAX, SPIN_MAX);
    v.heading = wrap(v.heading + v.spin * dt);
    v.spin *= Math.exp(-2.4 * dt);
    if (Math.abs(v.spin) < 0.03) v.spin = 0;
  }
  /** Grip factor (systems/_vehphys.js Surface) under the front and rear axles: the player's car every frame, others 4x a second. */
  _grip(v, dt) {
    if (v !== this.cur && (v.gT = (v.gT || 0) - dt) > 0) return;
    v.gT = 0.25;
    const T = TYPES[v.type], g = this.game, fx = Math.sin(v.heading), fz = Math.cos(v.heading), hw = T.wb * 0.5;
    const ax = v.x + fx * hw, az = v.z + fz * hw, bx = v.x - fx * hw, bz = v.z - fz * hw;
    v.gripF = this.surface.grip(ax, az, g.groundHeight(ax, az));
    v.gripR = this.surface.grip(bx, bz, g.groundHeight(bx, bz));
  }
  /**
   * The car model shared by the player and AI-driven live cars (drive()): thr 0..1 throttle, brake (bool, brakes then
   * reverses), hand (handbrake), steerIn -1..1 (moveX convention: +1 = right). Moves, collides, rolls/pitches.
   * Arcade-realistic (2026-11 physics pass, tuning per type in _vehphys.js PHYS):
   *  - yaw: the kinematic bicycle (speed * tan(steer) / wheelbase), capped by what the front tyres can give on this surface
   *    (too fast for the corner = it runs wide, understeer), followed with a lag (yawK: hatch darty, bus ponderous)
   *  - sideways slip is pulled back to zero by the tyres, up to their grip (the handbrake lets the rear go: the tail swings)
   *  - throttle limited by traction (wheelspin on grass, a chirp on launch); brakes lock from speed (less steering, marks)
   *  - pitch / roll / heave on per-type springs from the accelerations; kerbs bump the body (see _ground)
   */
  _carPhys(v, dt, thr, S, hand, steerIn) {
    const g = this.game, T = TYPES[v.type], P = PHYS[v.type], W = thr > 0, me = v === this.cur, ai = v.driver === 'ai';
    if (!v.pitchS) initBody(v);
    this._grip(v, dt);
    // wet / snowy roads (systems/weather.js: game.weather.grip, 0.85 wet, ~0.6 snow) for anyone but the AI drivers, who ease
    // off for it instead (traffic.js LAT / cornerV); no weather (headless tests): exactly 1
    const wg = !ai && g.weather && g.weather.grip < 1 ? Math.max(0.4, g.weather.grip) : 1;
    const sf = v.gripF * wg, sr = v.gripR * wg, surf = (sf + sr) * 0.5;
    // steering: the lock shrinks with speed, the wheel is wound on at the type's own rate
    const sp = Math.abs(v.speed), lock = P.lock / (1 + sp * P.steerK);
    v.steer += (-steerIn * lock - v.steer) * Math.min(1, dt * P.steerRate);
    // yaw
    let fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const vf0 = v.vx * fx + v.vz * fz;
    let yawK = vf0 * Math.tan(v.steer) / T.wb;
    if (v.locked) yawK *= P.lockSteer;
    const gF = P.grip * sf * (ai ? 1.3 : 1), cap = hand ? gF * 1.8 : gF, aDem = Math.abs(vf0 * yawK);
    v.under = 0;
    if (aDem > cap && Math.abs(vf0) > 1) {
      // (a little more than the grip, for feel, but never more than the rear can hold: it runs wide, it does not spin)
      let aOk = cap + (aDem - cap) * 0.12;
      if (!hand) aOk = Math.min(aOk, P.gripR * sr * (ai ? 1.3 : 1) * 0.9);
      v.under = 1 - aOk / aDem; yawK *= aOk / aDem;
    }
    if (hand && Math.abs(vf0) > 2) yawK *= 1.5;
    v.yr += (yawK - v.yr) * Math.min(1, dt * P.yawK);
    v.heading = wrap(v.heading + v.yr * dt);
    if (v.spin) this._spinStep(v, dt);
    // velocity in the (new) car frame
    fx = Math.sin(v.heading); fz = Math.cos(v.heading);
    const lx = fz, lz = -fx;
    let vf = v.vx * fx + v.vz * fz, vl = v.vx * lx + v.vz * lz;
    const vfIn = vf;
    // ---- along the car: throttle (traction-limited), brakes (lock-up), handbrake, rolling drag (more on grass)
    const trac = P.grip * surf;
    v.spinW = 0; v.locked = false;
    if (W) {
      v.brakeT = 0;
      if (vf < -0.3) vf = Math.min(0, vf + 12 * dt);
      else {
        let a = P.acc * thr * (1 - Math.max(0, vf) / P.top);
        const avail = trac * 0.6;                                   // (what the driven axle can put down)
        if (!(v.thr0 > 0) && vf < 0.5 && thr > 0.9 && me && v.type !== 'bus' && v.type !== 'van') v.launchT = 0.3;      // flooring it from rest: a chirp
        if (a > avail) { v.spinW = Math.min(1, (a - avail) / a + 0.25); a = avail; }
        if (v.launchT > 0) { v.launchT -= dt; v.spinW = Math.max(v.spinW, 0.55); a *= 0.9; }
        vf += a * dt;
      }
    } else if (S) {
      if (vf > 0.3) {
        v.brakeT += dt;
        // stamping on it from speed locks the wheels (no ABS): a little less stopping, much less steering, black lines
        v.locked = (vf > P.lockV && v.brakeT > 0.12) || P.brake > trac;
        vf = Math.max(0, vf - (v.locked ? trac * 0.8 : P.brake) * dt);
      } else { v.brakeT = 0; vf = Math.max(-6, vf - 3.5 * dt); }
    } else v.brakeT = 0;
    v.thr0 = W ? thr : 0;
    if (hand) { const d = Math.min(4.5, trac * 0.45) * dt; vf = Math.abs(vf) < d ? 0 : vf - Math.sign(vf) * d; }
    if (!W && !S) { const d = (0.5 + 0.0012 * vf * vf) * dt * (surf < 0.7 ? 2.5 : 1); vf = Math.abs(vf) < d ? 0 : vf - Math.sign(vf) * d; }
    else if (surf < 0.7 && W) vf -= 0.6 * (1 - surf) * Math.sign(vf) * dt;
    // ---- across: the tyres pull the sideways slip back to zero, up to their grip (handbrake: the rear lets go)
    const gR = (hand ? P.hand : P.gripR) * sr * (ai ? 1.3 : 1);
    const nvl = vl + clamp(-vl * 22, -gR, gR) * dt;
    vl = vl !== 0 && (vl > 0) !== (nvl > 0) ? 0 : nvl;
    v.vx = fx * vf + lx * vl; v.vz = fz * vf + lz * vl; v.speed = vf; v.vl = vl;
    // ---- the body on its springs: pitch from the longitudinal acceleration, roll from the lateral
    spring(v.pitchS, clamp(-(vf - vfIn) / dt * P.pitch, -0.075, 0.075), P.fP, P.zP, dt);
    spring(v.rollS, clamp(-vf * v.yr * P.roll, -0.11, 0.11), P.fR, P.zR, dt);
    // ---- tyres: marks, smoke, squeal (only near the camera)
    if (me || this._nearCam(v)) this._tyres(v, dt, vf, vl, hand, surf);
    this._hitWhat = null; this._hitOther = null; this._hitImp = 0; this._hitOwn = 0;
    if (g.props) g.props.vehicleContact(v, dt);   // [props] knock what the car is about to hit; may slow v.vx/v.vz (systems/props.js)
    const imp = this._carMove(v, dt);
    if (imp > 3) { if (me || this._nearCam(v)) this._thud(imp, 0, v); }
    if (me && this._scrK > 2) this.crashSnd.scrape(Math.min(1, (this._scrK - 2) / 10), this._scrX, (v.y || 0) + 0.45, this._scrZ, this._scrM === 'railing' || this._scrM === 'post' || this._scrM === 'iron' ? 'metal' : this._scrM === 'hedge' || this._scrM === 'tree' ? 'hedge' : 'stone');      // (a glancing contact along a wall: systems/_crash_audio.js)
    if (imp > 2.5) this._emit('impact', { v, impact: imp, what: this._hitWhat || 'wall', other: this._hitOther || null, shunted: !!this._shunted, own: this._hitOther ? this._hitOwn : imp, pushed: v.shuntT !== undefined && this.t - v.shuntT < 2 });
    // (how hard it was on THIS car — its own change of speed, systems/_collide.js felt(): a bus that runs into a hatchback
    //  hardly feels it, the hatchback does; a wall is the whole closing speed. Below a real jolt: only a nudge of the camera)
    { const f = this._hitFelt; if (f > 3.5) this._hurt(v, f); else if (me && f > 1.2 && g.shake) g.shake(f * 0.045); }
    v.pitch = clamp(v.pitchS.x, -0.12, 0.12); v.lean = clamp(v.rollS.x, -0.15, 0.15);
    this._ground(v, dt);
    return imp;
  }
  /** Skid marks under the tyres that slide (sideways, locked, spinning, handbrake), smoke / dust off them, the squeal. */
  _tyres(v, dt, vf, vl, hand, surf) {
    const T = TYPES[v.type], g = this.game;
    const slide = Math.abs(vl) > 1.6 ? Math.min(1, (Math.abs(vl) - 1.6) / 4) : 0;
    const hb = hand && Math.abs(vf) > 3 ? 0.75 : 0, lock = v.locked && Math.abs(vf) > 2 ? 0.9 : 0;
    const spinW = v.spinW > 0.2 && v.thr0 > 0 ? v.spinW : 0, under = v.under > 0.12 ? Math.min(1, v.under * 2) : 0;
    const fwd = v.type === 'car_hatch';                    // (front-wheel drive; the others are driven at the back)
    const rear = Math.max(slide, hb, lock, fwd ? 0 : spinW), front = Math.max(lock, under * 0.6, slide > 0.6 ? slide * 0.5 : 0, fwd ? spinW : 0);
    const k = Math.max(rear, front);
    if (k <= 0) return;
    const grass = surf < 0.7;
    if (!v.sk) v.sk = [SkidMarks.emitter(), SkidMarks.emitter(), SkidMarks.emitter(), SkidMarks.emitter()];
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading), tw = T.W * 0.5 - 0.17, hw = T.wb * 0.5, w = v.type === 'bus' ? 0.32 : 0.2;
    const smoky = spinW > 0.3 || slide > 0.45 || hb > 0 || lock > 0;
    for (let i = 0; i < 4; i++) {
      const a = i < 2 ? front : rear; if (a <= 0) continue;
      const u = i < 2 ? hw : -hw, s = i % 2 ? -tw : tw, x = v.x + fx * u + fz * s, z = v.z + fz * u - fx * s;
      this.skids.mark(v.sk[i], x, g.groundHeight(x, z), z, w, a * (grass ? 0.45 : 1));
      if (smoky && Math.random() < dt * 18 * a) this.puffs.emit(grass ? PUFF.dust : PUFF.smoke, x, v.y + 0.15, z, -v.vx * 0.08, 0.3, -v.vz * 0.08, 0.4);
    }
    if (!grass && this.t - (this._skidT || 0) > 0.09) { this._skidT = this.t; skid(g.audio, 2 + k * 6, v); }
  }
  /** A hard hit: camera shake (the player's car), a jolt of the body, damage -> steam, bits flying off. */
  _hurt(v, imp) {
    const g = this.game, me = v === this.cur;
    if (!v.pitchS) initBody(v);
    v.dmg = Math.min(1, (v.dmg || 0) + imp * imp / 700);
    if (me && g.shake) g.shake(Math.min(1.2, 0.1 + imp / 13));
    const T = TYPES[v.type], fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    // which end took it: a dip and a nod of the body that way
    const u = (this._hitX - v.x) * fx + (this._hitZ - v.z) * fz, side = (this._hitX - v.x) * fz - (this._hitZ - v.z) * fx;
    v.heaveS.v -= Math.min(1.0, imp * 0.05);
    v.pitchS.v += Math.sign(u || 1) * Math.min(0.9, imp * 0.045);
    v.rollS.v += Math.sign(side || 1) * Math.min(0.6, imp * 0.025);
    if (imp > 7 && v.type !== 'bus') v.steamT = Math.max(v.steamT || 0, 8 + imp * 1.2);
    if (imp > 9 && (me || this._nearCam(v)) && this.t - (v._debT || -9) > 0.8) {
      v._debT = this.t;
      const n = imp > 15 ? 3 : imp > 12 ? 2 : 1, vx = v.vx * 0.5, vz = v.vz * 0.5;
      for (let i = 0; i < n; i++) {
        const hub = i === 1 || (i === 0 && imp > 12 && Math.random() < 0.5);
        const wx = hub ? v.x + fx * Math.sign(u || 1) * T.wb * 0.5 + fz * Math.sign(side || 1) * T.W * 0.5 : this._hitX, wz = hub ? v.z + fz * Math.sign(u || 1) * T.wb * 0.5 - fx * Math.sign(side || 1) * T.W * 0.5 : this._hitZ;
        this._bit(hub ? 'hubcap' : i === 2 ? 'glass' : 'bumper', wx, v.y + 0.35, wz, vx + (Math.random() - 0.5) * 3 + this._hitNX * 2, 2 + Math.random() * 2.5, vz + (Math.random() - 0.5) * 3 + this._hitNZ * 2, v.color);
      }
    }
  }
  /** a bit falls off: systems/props.js makes it a real loose body when it offers that, else our cheap debris pool */
  _bit(kind, x, y, z, vx, vy, vz, hex) {
    const P = this.game.props;
    if (P && typeof P.spawnLoose === 'function') { try { if (P.spawnLoose({ kind, x, y, z, vx, vy, vz, color: hex })) return; } catch { /* */ } }
    this.debris.spawn(kind, x, y, z, vx, vy, vz, hex);
  }
  /**
   * Stand a live vehicle on the drawn surface (game.groundHeight): a bike on its two wheel contact points, the player's
   * car on its four (so it climbs a kerb a wheel at a time, pitching and rolling a little), other cars on their middle.
   * A car's body rides on a heave spring: the wheels follow the ground, the body lags (a kerb is a bump and a little
   * bounce; a hard hit jolts it). dt = 0 snaps (spawn). 1-4 height lookups, no allocation.
   */
  _ground(v, dt) {
    const g = this.game, T = TYPES[v.type], fx = Math.sin(v.heading), fz = Math.cos(v.heading), hw = T.wb * 0.5;
    let y, gp = 0, gr = 0;
    if (v.kind === 'bike') {
      const hf = g.groundHeight(v.x + fx * hw, v.z + fz * hw), hr = g.groundHeight(v.x - fx * hw, v.z - fz * hw);
      y = (hf + hr) * 0.5; gp = -Math.atan2(hf - hr, T.wb);
    } else if (v === this.cur) {
      const tw = T.W * 0.5 - 0.15, lx = fz * tw, lz = -fx * tw;
      const fl = g.groundHeight(v.x + fx * hw + lx, v.z + fz * hw + lz), fr = g.groundHeight(v.x + fx * hw - lx, v.z + fz * hw - lz);
      const rl = g.groundHeight(v.x - fx * hw + lx, v.z - fz * hw + lz), rr = g.groundHeight(v.x - fx * hw - lx, v.z - fz * hw - lz);
      y = (fl + fr + rl + rr) * 0.25; gp = -Math.atan2((fl + fr - rl - rr) * 0.5, T.wb); gr = Math.atan2((fl + rl - fr - rr) * 0.5, tw * 2);      // local +x is the left side
    } else y = g.groundHeight(v.x, v.z);
    if (!(y === y)) return;
    if (!dt) { v.y = y; v.gp = gp; v.gr = gr; v.yg = y; return; }
    const k2 = Math.min(1, dt * 10);
    if (v.kind === 'car' && v.heaveS) {
      const P = PHYS[v.type];
      if (v === this.cur) {
        // wheels on the ground at once, the body left behind on its springs
        const dy = y - (v.yg ?? y); v.yg = y;
        if (Math.abs(dy) < 0.35 && dy !== 0) {
          v.heaveS.x -= dy * 0.75;
          if (dy > 0.04 && Math.abs(v.speed) > 5) { v.vx *= 0.985; v.vz *= 0.985; if (g.shake) g.shake(0.08 + Math.min(0.15, Math.abs(v.speed) * 0.008)); }    // a kerb strike
        }
        v.y = y;
      } else v.y += (y - v.y) * Math.min(1, dt * 16);
      spring(v.heaveS, 0, P.fH, P.zH, dt); v.heaveS.x = clamp(v.heaveS.x, -0.14, 0.1);
    } else v.y += (y - v.y) * Math.min(1, dt * 16);
    v.gp += (gp - v.gp) * k2; v.gr += (gr - v.gr) * k2;
  }
  _nearCam(v) { const p = this.game.player.pos; return Math.abs(v.x - p.x) < 40 && Math.abs(v.z - p.z) < 40; }
  /** AI-driven live car (v.driver === 'ai', e.g. a police car): one step of the same car model with given controls. */
  drive(v, c, dt) {
    if (!v || v.kind !== 'car' || !(dt > 0)) return 0;
    dt = Math.min(dt, 0.05);
    const imp = this._carPhys(v, dt, clamp(c.throttle || 0, 0, 1), !!c.brake, !!c.hand, clamp(c.steer || 0, -1, 1));
    const T = TYPES[v.type];
    this._knock(v, T.W / 2 + 0.35, KNOCK_MIN, Math.sin(v.heading), Math.cos(v.heading));
    this._pose(v);
    return imp;
  }
  _emit(kind, d) {
    const a = this._ev.get(kind); if (!a) return false;
    let r = false;
    for (const fn of a) { try { if (fn(d)) r = true; } catch (e) { console.warn('[vehicles] ' + kind + ' hook', e); } }
    return r;
  }

  /**
   * Integrate a car's velocity with sub-steps: 2-5 body circles against the static world (walls: an impulse against an
   * immovable body at the contact, so a corner clipped turns the car), then capsule contacts with every other body
   * (_bodies: momentum exchange). Returns the impact (closing speed, m/s) of the worst hit.
   */
  _carMove(v, dt) {
    const T = TYPES[v.type], c = this.col, P = _P;
    if (!v.pitchS) initBody(v);
    const n = Math.max(1, Math.ceil(Math.hypot(v.vx, v.vz) * dt / 0.22));
    const r = T.W / 2, half = T.L / 2 - r, nc = Math.max(2, Math.ceil(half * 2 / (T.W * 0.85)) + 1);
    let impact = 0;
    this._shunted = false; this._scrK = 0; this._wallMat = null; this._hitFelt = 0;
    for (let s = 0; s < n; s++) {
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const nx = v.x + v.vx * dt / n, nz = v.z + v.vz * dt / n;
      let px = 0, pz = 0, wet = false, best = 0, bo = 0, bs = null;
      for (let i = 0; i < nc; i++) {
        const o = -half + (2 * half * i) / (nc - 1), cx = nx + fx * o, cz = nz + fz * o;
        P.x = cx; P.z = cz;
        c.resolve(P, r, OPT_CAR);
        const dx = P.x - cx, dz = P.z - cz, d2 = dx * dx + dz * dz;
        if (d2 > best) { best = d2; px = dx; pz = dz; bo = o; bs = c.lastHit; }
        if (this.wet(cx + fx * (i === 0 ? -r : i === nc - 1 ? r : 0), cz + fz * (i === 0 ? -r : i === nc - 1 ? r : 0)) || this.wet(cx, cz)) wet = true;
      }
      if (wet) {
        // can't drive into the river: stop dead at the bank
        const sp = Math.hypot(v.vx, v.vz); if (sp > impact) { impact = sp; this._hitAt(v.x + fx * half, v.z + fz * half, -fx, -fz); this._wallMat = 'bank'; }
        if (sp > this._hitFelt) this._hitFelt = sp;
        v.vx *= -0.15; v.vz *= -0.15; v.speed = v.vx * fx + v.vz * fz;
        break;
      }
      v.x = nx + px; v.z = nz + pz;
      if (best > 1e-8) {
        // a wall: impulse against an immovable body at the contact point
        const d = Math.sqrt(best), ux = px / d, uz = pz / d, A = bodyOf(v, _BA), w0 = A.w;
        const hx = v.x + fx * bo - ux * r, hz = v.z + fz * bo - uz * r;
        // (the bounce goes by the speed: springy at a nudge, next to none in a crash - systems/_collide.js restitution)
        const R = impulse(A, _FIXED, hx, hz, ux, uz, restitution(-(A.vx * ux + A.vz * uz), E_WALL), 0.3);
        if (R.vn < 0) {
          applyBody(v, A, w0);
          if (-R.vn > this._hitFelt) this._hitFelt = -R.vn;
          if (-R.vn > impact) { impact = -R.vn; this._hitAt(hx, hz, ux, uz); this._wallMat = materialOf(bs && bs.tag); }
        }
        // sliding along it: how fast the flank goes past the wall (the scrape, systems/_crash_audio.js)
        const vt = Math.abs(v.vx * uz - v.vz * ux);
        if (vt > this._scrK) { this._scrK = vt; this._scrX = hx; this._scrZ = hz; this._scrM = materialOf(bs && bs.tag); }
      }
      const di = this._bodies(v);
      if (di > impact) impact = di;
    }
    v.speed = v.vx * Math.sin(v.heading) + v.vz * Math.cos(v.heading);
    return impact;
  }
  _hitAt(x, z, nx, nz) { this._hitX = x; this._hitZ = z; this._hitNX = nx; this._hitNZ = nz; }

  /**
   * Car v against every other body near it: live vehicles (incl. other players' parked ones, claimed first), AI traffic
   * (shoved: traffic.shove), parked cars (woken into live ones when the hit is worth it, restored to their bay later) and
   * other players' driven cars (their reported velocity counts; only we move: see docs/ARCHITECTURE.md "Vehicle physics").
   * Capsule contacts, overlap split by mass, then a rigid-body impulse with restitution and friction (_vehphys.impulse).
   * Riderless bikes are knocked flying; AI cyclists are knocked off (traffic.knockOff). Returns the worst closing speed.
   */
  _bodies(v) {
    const g = this.game, T = TYPES[v.type], hv = T.L / 2 - T.W / 2, rv = T.W / 2;
    let worst = 0;
    const L = this.live;
    for (let i = 0; i < L.length; i++) {
      const o = L[i];
      if (o === v || o.kind === 'punt' || o === this._skipBody) continue;
      if (Math.abs(o.x - v.x) > 14 || Math.abs(o.z - v.z) > 14) continue;
      const To = TYPES[o.type];
      if (o.kind === 'bike') {
        if (o.driver || v.passBikes) continue;            // (a ridden bike is pushed out of us by its own step)
        if (!contact(v.x, v.z, v.heading, hv, rv, o.x, o.z, o.heading, Math.max(0, To.L / 2 - 0.2), 0.25)) continue;
        if (!o.slideVx && Math.hypot(v.vx, v.vz) > 1.5) {
          // a bicycle left standing in the road: sent skidding on its side
          if (o.remote) { const cs = g.crowdsync; if (!(cs && cs.claimNow && cs.claimNow('v', o, true))) continue; }
          o.fallen = true; o.lean = o.lean || 0.25; o.slideVx = v.vx * 0.8; o.slideVz = v.vz * 0.8; o.speed = 0;
          v.vx *= 0.98; v.vz *= 0.98;
          if (this._nearCam(v)) this._thud(Math.hypot(v.vx, v.vz), 0, v, 'bike');
        }
        continue;
      }
      const C = contact(v.x, v.z, v.heading, hv, rv, o.x, o.z, o.heading, To.L / 2 - To.W / 2, To.W / 2);
      if (!C) continue;
      const B = bodyOf(o, _BB);
      if (o.remote) { const cs = g.crowdsync; if (!(cs && cs.claimNow && cs.claimNow('v', o, true))) B.ghost = true; }
      const imp = this._pair(v, o, B, C, 'vehicle');
      if (imp > worst) worst = imp;
    }
    // AI traffic
    const tr = g.traffic, tl = tr && tr.list;
    if (tl && !v.passTraffic) for (let i = 0; i < tl.length; i++) {
      const a = tl[i];
      if (!a || a.active === false || Math.abs(a.x - v.x) > 14 || Math.abs(a.z - v.z) > 14) continue;
      if (v.passBikes && a.kind === 'bike') continue;
      const C = contact(v.x, v.z, v.heading, hv, rv, a.x, a.z, a.heading, a.half || 0, a.radius || 0.8);
      if (!C) continue;
      const afx = Math.sin(a.heading), afz = Math.cos(a.heading), sh = a.shove;
      const avx = sh ? sh.vx : afx * a.speed, avz = sh ? sh.vz : afz * a.speed;
      if (a.kind === 'bike') {
        // a cyclist: knocked off if we are going at them with any speed; else nudged out of the way
        const rel = Math.hypot(v.vx - avx, v.vz - avz);
        v.x += C.nx * C.depth * 0.85; v.z += C.nz * C.depth * 0.85;
        if (rel > 2.2 && tr.knockOff) {
          const cnx = C.nx, cnz = C.nz, ccx = C.cx, ccz = C.cz;
          const info = this._unseat(v, a, v.vx, v.vz, avx, avz, rel);
          if (info) {
            // (what a rider and bicycle cost us: as a person does, by the masses - systems/_collide.js)
            const k = 1 - strikerLoss(PHYS[v.type].m, 1, (PHYS[a.type] || PHYS.bike_roadster).m); v.vx *= k; v.vz *= k;
            if (rel > worst) { worst = rel; this._hitWhat = 'traffic'; this._hitOther = a; this._hitAt(ccx, ccz, cnx, cnz); }
          }
        }
        continue;
      }
      if (a.remote) { const cs = g.crowdsync; if (!(cs && cs.claimNow && cs.claimNow('c', a, true))) { const B = remoteish(a, avx, avz, _BB); B.ghost = true; const imp = this._pair(v, null, B, C, 'traffic'); if (imp > worst) worst = imp; continue; } }
      const B = remoteish(a, avx, avz, _BB);
      const imp = this._pair(v, a, B, C, 'traffic');
      if (imp > worst) worst = imp;
      if (B.vn < -0.4 && tr.shove) tr.shove(a, B.vx, B.vz, B.w);       // (B.vn: closing speed of this contact)
    }
    // parked cars: brushed past, they are solid; hit properly, they wake up as live cars and are shunted
    const cand = this._parkedNear(v);
    for (let i = 0; i < cand.length; i++) {
      const s = cand[i], Ts = TYPES[s.type];
      if (s.taken) continue;
      const C = contact(v.x, v.z, v.heading, hv, rv, s.x, s.z, s.h, Ts.L / 2 - Ts.W / 2, Ts.W / 2);
      if (!C) continue;
      // how hard: closing speed of our contact point, and what share of it the parked car would take
      const A = bodyOf(v, _BA), rx = C.cx - v.x, rz = C.cz - v.z;
      const vn = (A.vx + A.w * rz) * C.nx + (A.vz - A.w * rx) * C.nz, mA = A.m, mB = PHYS[s.type].m;
      if (-vn * 1.2 * mA / (mA + mB) > 0.55) {
        const nx = C.nx, nz = C.nz, depth = C.depth, cx = C.cx, cz = C.cz;
        const o = this.promote(s);
        if (o && !o.static) {
          o.home = { x: s.x, z: s.z, h: s.h }; o.shuntT = this.t; o.parked = true;
          _C2.nx = nx; _C2.nz = nz; _C2.depth = depth; _C2.cx = cx; _C2.cz = cz;
          const imp = this._pair(v, o, bodyOf(o, _BB), _C2, 'parked');
          if (imp > worst) worst = imp;
          continue;
        }
      }
      const B = _BB; B.fixed = true; B.ghost = false; B.x = s.x; B.z = s.z;
      const imp = this._pair(v, s, B, C, 'parked');
      if (imp > worst) worst = imp;
    }
    // other players' cars (their client owns them): their velocity counts, only we move
    const R = this.remoteBodies;
    for (let i = 0; i < R.length; i++) {
      const q = R[i];
      if (!q.on || Math.abs(q.x - v.x) > 14 || Math.abs(q.z - v.z) > 14) continue;
      const Tq = TYPES[q.type];
      const C = contact(v.x, v.z, v.heading, hv, rv, q.x, q.z, q.h, Tq.L / 2 - Tq.W / 2, Tq.W / 2);
      if (!C) continue;
      // (a car that was just shunted by what that player's client reported — an AI police car of ours they drove into,
      // systems/police.js 'polhit' — is only kept out of their car for a moment: the blow has been dealt once already)
      if (!q.ref && v._rbSkipId === q.id && this.t < v._rbSkipT) { v.x += C.nx * C.depth; v.z += C.nz * C.depth; continue; }
      const B = _BB; B.x = q.x; B.z = q.z; B.vx = q.vx; B.vz = q.vz; B.w = q.w; B.m = PHYS[q.type].m; B.I = PHYS[q.type].I; B.ghost = true; B.fixed = false;
      const ivx = v.vx, ivz = v.vz, cnx = C.nx, cnz = C.nz, rbx = C.cx - q.x, rbz = C.cz - q.z;
      const imp = this._pair(v, null, B, C, 'remote');
      if (imp > worst) worst = imp;
      if (imp > 0) {
        if (!q.ref) { v._rbT = this.t; v._rbId = q.id; }
        else if (q.ref.hit) {
          // what the same blow does to the body we hit (equal and opposite impulse on its mass): its owner applies it
          const mA = PHYS[v.type].m, Jx = (v.vx - ivx) * mA, Jz = (v.vz - ivz) * mA, IB = B.I > 0 ? B.I : 1;
          try { q.ref.hit(v, q, -Jx / B.m, -Jz / B.m, -(Jx * rbz - Jz * rbx) / IB, -(ivx * cnx + ivz * cnz), imp); } catch (e) { /* the source's business */ }
        }
      }
    }
    return worst;
  }
  /** parked cars within ~12 m of v (gathered once a frame per moving car, re-gathered if it has gone 3 m) */
  _parkedNear(v) {
    const c = v._pc || (v._pc = []);
    if (v._pcT === this.t && Math.abs(v._pcX - v.x) + Math.abs(v._pcZ - v.z) < 3) return c;
    v._pcT = this.t; v._pcX = v.x; v._pcZ = v.z; c.length = 0;
    this.pools.forEach((pl) => {
      if (pl.type === 'stand' || pl.type === 'punt' || TYPES[pl.type].kind !== 'car') return;
      pl.grid.each(v.x, v.z, 8, (s) => { if (!s.taken && Math.abs(s.x - v.x) < 12 && Math.abs(s.z - v.z) < 12) c.push(s); });
    });
    return c;
  }
  /**
   * One contact between car v and body B (o: the live vehicle / traffic agent / slot behind B, or null). Splits the
   * overlap by mass (all of it ours when B cannot move), applies the impulse to both (not to a ghost / fixed B), wakes
   * and settles o, records the hit. Returns the closing speed (0 if already separating). B.vn is set for the caller.
   */
  _pair(v, o, B, C, what) {
    const A = bodyOf(v, _BA), w0 = A.w, bw0 = B.w || 0;
    const still = B.ghost || B.fixed, kA = still ? 1 : B.m / (A.m + B.m), kB = 1 - kA;
    v.x += C.nx * C.depth * kA; v.z += C.nz * C.depth * kA; A.x = v.x; A.z = v.z;
    if (o && kB > 0) { o.x -= C.nx * C.depth * kB; o.z -= C.nz * C.depth * kB; B.x = o.x; B.z = o.z; }
    const cx = C.cx, cz = C.cz, nx = C.nx, nz = C.nz, own = -(A.vx * nx + A.vz * nz);     // (how fast v itself was driving into it)
    // (the bounce goes by the closing speed: a nudge springs back, a crash folds - systems/_collide.js restitution)
    const mB = B.fixed ? 0 : B.m, e = restitution(-((A.vx - (B.fixed ? 0 : B.vx || 0)) * nx + (A.vz - (B.fixed ? 0 : B.vz || 0)) * nz), B.fixed ? E_WALL : E_BODY);
    const R = impulse(A, B, cx, cz, nx, nz, e, 0.45, 22);
    B.vn = R.vn;
    if (R.vn >= 0) return 0;
    applyBody(v, A, w0);
    this._hitAt(cx, cz, nx, nz);
    const imp = -R.vn, fA = felt(imp, A.m, mB);
    if (fA > this._hitFelt) this._hitFelt = fA;
    if (o && !still && o.kind === 'car' && !o.ai) {
      o.vx = B.vx; o.vz = B.vz; o.spin = clamp((o.spin || 0) + (B.w - bw0), -SPIN_MAX, SPIN_MAX); o.shuntT = this.t;
      this._settle(o);
      // (how hard it was on the car that was hit: its own share - it was the hitter's, the wrong way round, so that a bus
      //  driven into a hatchback left the hatchback unmarked and a hatchback into a bus damaged the bus)
      const fB = felt(imp, B.m, A.m);
      if (fB > 3.5) this._hurt(o, fB);
    }
    if (!still) this._shunted = true;
    if (imp > (this._hitImp || 0)) { this._hitImp = imp; this._hitWhat = what; this._hitOther = o; this._hitOwn = own; }
    return imp;
  }
  /** a car shoved by another: pushed back out of the walls it was shoved into (no velocity into them) */
  _settle(o) {
    const T = TYPES[o.type], r = T.W / 2, half = T.L / 2 - r, fx = Math.sin(o.heading), fz = Math.cos(o.heading), P = _P;
    let best = 0, px = 0, pz = 0;
    for (const u of [-half, 0, half]) {
      const cx = o.x + fx * u, cz = o.z + fz * u; P.x = cx; P.z = cz;
      this.col.resolve(P, r, OPT_CAR);
      const dx = P.x - cx, dz = P.z - cz, d2 = dx * dx + dz * dz;
      if (d2 > best) { best = d2; px = dx; pz = dz; }
    }
    if (best > 1e-8) {
      o.x += px; o.z += pz;
      const d = Math.sqrt(best), ux = px / d, uz = pz / d, vn = o.vx * ux + o.vz * uz;
      if (vn < 0) { o.vx -= vn * ux * 1.1; o.vz -= vn * uz * 1.1; }
    }
  }
  /** A parked car shunted out of its bay, nobody about any more: back in its bay as a parked slot. */
  _restore(v) {
    const h = v.home; v.home = null;
    v.mesh.removeFromParent();
    if (v.blob) { v.blob.remove(); v.blob = null; }
    const i = this.live.indexOf(v); if (i >= 0) this.live.splice(i, 1);
    const T = TYPES[v.type];
    const segs = this.col.addBox(h.x, h.z, T.W, T.L, h.h, { tag: 'car', low: true, top: standTop(v.type) });
    this._slot(v.type, h.x, h.z, h.h, { color: v.color, segs, y: 0 });
    this.restored = (this.restored || 0) + 1;
  }

  // ------------------------------------------------------------ punt
  _punt(v, dt, ctl) {
    const g = this.game, inp = g.input, st = v.stroke;
    const W = ctl && (inp.down('KeyW') || inp.down('ArrowUp')), S = ctl && (inp.down('KeyS') || inp.down('ArrowDown'));
    const steerIn = ctl ? inp.moveX : 0;
    v.mudGrace = (v.mudGrace || 0) - dt;
    // stroke state machine: idle -> plant -> push -> recover -> idle (hold W to keep poling)
    st.t += dt;
    if (st.phase === 'idle' && (W || (ctl && inp.hit('KeyW')))) { st.phase = 'plant'; st.t = 0; }
    else if (st.phase === 'plant' && st.t >= 0.38) {
      st.phase = 'push'; st.t = 0; splash(g.audio, 0.08);
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      st.bx = v.x + fx * -2.2 + fz * 0.5; st.bz = v.z + fz * -2.2 - fx * 0.5;   // pole planted on the river bed (world-fixed)
    } else if (st.phase === 'push') {
      v.speed += 1.75 * (1 - v.speed / 3.2) * dt;
      if (st.t >= 0.9) {
        if (v.mudGrace <= 0 && Math.random() < this.config.mudChance) {
          st.phase = 'stuck'; st.t = 0; v.mudGrace = this.config.mudGrace;
          this._toast('The pole is stuck in the mud!', 2.5);
        } else { st.phase = 'recover'; st.t = 0; }
      }
    } else if (st.phase === 'recover' && st.t >= 0.8) { st.phase = 'idle'; st.t = 0; }
    else if (st.phase === 'stuck') {
      this._prompt('Wrench the pole free!', 'E');
      if (ctl && inp.hit('KeyE')) {
        inp.pressed.delete('KeyE'); st.phase = 'recover'; st.t = 0; this._prompt(null);
        this._toast('You wrench the pole free with a satisfying schlurp.', 2.5); splash(g.audio, 0.05);
      } else if (st.t > 2.6) { this._prompt(null); this._fallIn(v); return; }
    }
    // drag; trailing the pole steers and slows
    const trailing = steerIn !== 0 && st.phase !== 'push' && st.phase !== 'plant';
    v.speed -= (0.18 * v.speed + 0.04 * v.speed * Math.abs(v.speed) + (trailing ? 0.16 * v.speed : 0)) * dt;
    if (S) { const d = 0.9 * dt; v.speed = v.speed > d ? v.speed - d : Math.max(-0.4, v.speed - d * 0.4); }
    const wT = -steerIn * (0.1 + 0.3 * Math.min(Math.abs(v.speed), 2)) * (st.phase === 'stuck' ? 0.3 : 1);
    v.w += (wT - v.w) * Math.min(1, dt * 1.3);
    v.trail = (v.trail || 0) + ((trailing ? steerIn : 0) - (v.trail || 0)) * Math.min(1, dt * 3);
    this._current(v, dt);
    this._puntMove(v, dt);
    this._puntBob(v);
    this._pole(v, dt);
  }
  _puntMove(v, dt) {
    // lateral drift decays fast (flat bottom, but it does skid a bit); hull must stay entirely on water
    const n = Math.max(1, Math.ceil(Math.abs(v.speed) * dt / 0.2));
    for (let i = 0; i < n; i++) {
      const h1 = wrap(v.heading + v.w * dt / n);
      v.vl = (v.vl || 0) * Math.exp(-2.5 * dt / n);
      const fx = Math.sin(h1), fz = Math.cos(h1), lx = fz, lz = -fx;
      const nx = v.x + (fx * v.speed + lx * v.vl + (v.cx || 0)) * dt / n, nz = v.z + (fz * v.speed + lz * v.vl + (v.cz || 0)) * dt / n;
      if (this.puntOK(nx, nz, h1)) { v.x = nx; v.z = nz; v.heading = h1; continue; }
      if (this.puntOK(nx, nz, v.heading)) { v.x = nx; v.z = nz; v.w *= -0.3; continue; }
      // glancing blow: the bank shoves the hull sideways and it scrapes along
      let slid = false;
      for (let k = 0; k < 6 && !slid; k++) {
        const d = (k % 2 ? -1 : 1) * (0.03 + 0.04 * (k >> 1));
        for (const hh of [h1, v.heading]) {
          const sx = nx + lx * d, sz = nz + lz * d;
          if (this.puntOK(sx, sz, hh)) { v.x = sx; v.z = sz; v.heading = hh; v.speed *= 0.97; slid = true; break; }
        }
      }
      if (slid) continue;
      if (this.puntOK(v.x, v.z, h1)) { v.heading = h1; }
      // bump off the bank: lose most speed, bounce back a touch, glance off with a little spin
      if (Math.abs(v.speed) > 0.35) { this._thud(1.5 + Math.abs(v.speed) * 4, 0, v, 'punt'); rockKick(v, (Math.random() - 0.5) * 0.3 * Math.min(1, Math.abs(v.speed)), -0.1 * Math.sign(v.speed) * Math.min(1, Math.abs(v.speed))); }
      v.speed *= -0.25; v.vl *= -0.3; v.w = -v.w * 0.3 + (Math.random() - 0.5) * 0.05;
      v.cx = v.cz = 0; v.curT = 3;            // (pinned against the bank by the stream: it eases off for a bit)
      break;
    }
  }
  _puntBob(v) {
    const m = v.mesh, t = this.t + v.ph, near = v === this.cur, dt = this._dt || 0.016;
    // rocking from somebody stepping aboard / off, a bump on the bank: lightly damped springs (a punt is flat but tippy)
    let rr = 0, rp = 0;
    if (v.rkR) { rr = spring(v.rkR, 0, 0.75, 0.09, dt); rp = spring(v.rkP, 0, 1.1, 0.14, dt); if (Math.abs(v.rkR.x) + Math.abs(v.rkR.v) + Math.abs(v.rkP.x) + Math.abs(v.rkP.v) < 1e-4) { v.rkR.x = v.rkR.v = v.rkP.x = v.rkP.v = 0; } }
    m.position.set(v.x, this.waterY + Math.sin(t * 1.7) * 0.012 - Math.abs(rr) * 0.15, v.z);
    // under a bridge: the world is flat (the deck is drawn at road level, the river a few cm below it), so a punt passing
    // "under" one stood on the carriageway with the traffic driving through it. While its middle is under a deck the hull
    // (and the punter, who is placed from the hull) is put out of sight below; it comes out the other side.
    if (near || this._nearCam(v)) {
      const under = this.col.onBridge(v.x, v.z);
      if (under) m.position.y -= 30;
      if (near && under !== !!v.underB) { v.underB = under; if (under) this._toast('Under the bridge. Mind your head.', 2.5); this._archShade(under); }
    }
    m.rotation.order = 'YXZ';
    m.rotation.set(Math.sin(t * 1.25) * 0.006 - (near ? 0.012 : 0) + rp, v.heading, Math.sin(t * 1.05) * 0.01 + v.w * 0.04 + rr);
  }
  /** Under a bridge in your punt (2026-11 play pass): the screen closes in to the dark of the arch with the daylight at
   *  the far end, a drip echoes, and the water funnelled between the piers carries you through in a few seconds
   *  (_current) — it used to be twenty seconds of looking at the road with no punt in sight. One DOM element, made on
   *  first use; nothing is drawn in the 3D scene and no bridge is rebuilt. */
  _archShade(on) {
    if (typeof document === 'undefined') return;
    let el = this._archEl;
    if (!el) {
      if (!on) return;
      el = this._archEl = document.createElement('div');
      el.id = 'arch-shade';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;transition:opacity .45s;' +
        'background:radial-gradient(ellipse 42% 54% at 50% 58%, rgba(8,10,12,0) 0%, rgba(8,10,12,.4) 55%, rgba(6,7,9,.9) 100%)';
      document.body.appendChild(el);
    }
    el.style.opacity = on ? '1' : '0';
    if (on) { const a = this.game.audio; try { if (a && a.ctx) for (const [w, f, k] of [[0.5, 1900, 1], [1.4, 1500, 0.8], [2.3, 2100, 0.7]]) drip(a, w + Math.random() * 0.2, f * (0.9 + 0.2 * Math.random()), k); } catch { /* */ } }      // (drips off the arch into the water: a plop, not a ping)
  }
  /** the river's flow where a punt is: ~0.12 m/s (Cherwell) / 0.25 (Thames) down the centreline (OSM draws rivers
   *  downstream), resampled every second, fading out near the bank (slack water); writes v.cx / v.cz */
  _current(v, dt) {
    if ((v.curT = (v.curT || 0) - dt) > 0) return;
    v.curT = 1;
    const nr = this.nearestRiver(v.x, v.z, 60);
    if (!nr) { v.cx = v.cz = 0; return; }
    const sp = /thames|isis/i.test(nr.w.name || '') ? 0.25 : 0.12, slack = clamp(1 - nr.d / Math.max(2, nr.w.w * 0.5), 0.2, 1);
    v.cx = nr.dx * sp * slack; v.cz = nr.dz * sp * slack;
    // between the piers of a bridge the water runs fast, the way the punt is pointing: you are out the other side in a
    // few seconds (see _archShade); resampled quickly so the push stops as soon as you are clear
    if (v === this.cur && this.col.onBridge(v.x, v.z)) { const d = v.speed < -0.2 ? -1 : 1; v.cx += Math.sin(v.heading) * 2.6 * d; v.cz += Math.cos(v.heading) * 2.6 * d; v.curT = 0.25; }
  }
  /** Animate the pole for a punt (player or NPC) from its stroke state. */
  _pole(v, dt) {
    const st = v.stroke, pole = v.rig.pole, B = _B;
    if (!v.driver && !v.npc) { pole.position.set(-0.28, 0.4, -2.2); pole.quaternion.copy(POLE_REST_Q); return; }
    const H = PUNT.hands, fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const k = st.t;
    if (st.phase === 'plant') {
      const e = smooth(k / 0.38);
      B.set(0.45 + 0.05 * e, 0.25 - 1.65 * e, -2.35 + 0.15 * e);
    } else if (st.phase === 'push' || st.phase === 'stuck') {
      // pole bottom is fixed on the river bed: convert world -> boat-local
      const dx = st.bx - v.x, dz = st.bz - v.z;
      B.set(dx * fz - dz * fx, -1.4, dx * fx + dz * fz);
      if (B.z < -5.2) B.z = -5.2;
      st.lz = B.z; st.lx = B.x;
    } else if (st.phase === 'recover') {
      const e = smooth(k / 0.8);
      B.set((st.lx ?? 0.5) + (0.45 - (st.lx ?? 0.5)) * e, -1.4 + 1.65 * e, (st.lz ?? -3) + (-2.35 - (st.lz ?? -3)) * e);
    } else {
      const tr = v.trail || 0;
      B.set(0.45 + tr * 0.55, 0.25 - Math.abs(tr) * 0.7, -2.35 - Math.abs(tr) * 2.0);
    }
    pole.position.copy(B);
    _D.set(H[0] - B.x, H[1] - B.y, H[2] - B.z).normalize();
    pole.quaternion.setFromUnitVectors(_UP, _D);
  }
  _fallIn(v) {
    const g = this.game, p = g.player;
    splash(g.audio, 0.35);
    this._toast('You clung to the pole as the punt drifted away... and fell in! Soggy.', 4);
    if (g.swim && g.swim.enter) {      // systems/swim.js: you are now swimming beside the punt (F climbs back in, E at a bank climbs out)
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      let sx = p.pos.x, sz = p.pos.z;
      for (const d of [1.4, -1.4]) { const x = p.pos.x + fz * d, z = p.pos.z - fx * d; if (this.isW(x, z)) { sx = x; sz = z; break; } }
      v.stroke = newStroke(); this.cur = null; v.driver = null; v.parked = true;
      p.vehicle = null; p.pose = 'stand'; p.character.group.rotation.set(0, p.heading, 0);
      p.pos.set(sx, this.waterY, sz); this._lpx = sx; this._lpz = sz;
      if (g.swim.enter({ power: 1 })) { this.fellIn = (this.fellIn || 0) + 1; this._emit('exit', { v }); return; }
    }
    // find the nearest bit of dry bank
    let spot = null;
    for (let rad = 2; rad <= 40 && !spot; rad += 1.5) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU, x = v.x + Math.cos(a) * rad, z = v.z + Math.sin(a) * rad;
        if (this.okSpot(x, z, 0.35)) { spot = [x, z]; break; }
      }
    }
    v.stroke = newStroke();
    this.cur = null; v.driver = null; v.parked = true;
    p.vehicle = null; p.pose = 'stand';
    try { p.character.setPose('stand'); } catch { /* ignore */ }
    p.character.group.rotation.set(0, p.heading, 0);
    const place = () => {
      const s = spot || [v.x, v.z];
      p.pos.set(s[0], g.groundHeight(s[0], s[1]), s[1]); p.speed = 0; p.vy = 0;
      if (p.syncMesh) p.syncMesh();
      this._lpx = p.pos.x; this._lpz = p.pos.z;
    };
    p.frozen++;
    const done = () => { p.frozen = Math.max(0, p.frozen - 1); };
    if (g.ui && g.ui.fade) { const pr = g.ui.fade(place); if (pr && pr.then) pr.then(done, done); else done(); }
    else { place(); done(); }
    this.fellIn = (this.fellIn || 0) + 1;
  }

  // ------------------------------------------------------------ NPC punts
  _npcUpdate(dt, wp, night) {
    if (!this.npcs) return;
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - wp.x, n.z - wp.z);
      const vis = d < 220;
      n.rig.group.visible = vis;
      if (!vis) continue;
      // (the far edge: thinning out over the last 25 m - boat and people - instead of appearing whole at 220 m)
      { const al = d > 195 ? (220 - d) / 25 : 1; if (al < 1 || n.rig.fadeL !== VFADE_STEPS) { vehFade(n.rig, Math.max(al, 0.07)); if (n.chars) for (const c of n.chars) c.setFade(Math.max(al, 0.07)); } }
      // drift along the river, turning round at the ends of the beat
      const st = n.stroke; st.t += dt;
      if (st.phase === 'idle' && Math.abs(n.speed) < 1.2) { st.phase = 'plant'; st.t = 0; }
      else if (st.phase === 'plant' && st.t > 0.45) { st.phase = 'push'; st.t = 0; st.bx = n.x - Math.sin(n.h) * 2.2; st.bz = n.z - Math.cos(n.h) * 2.2; }
      else if (st.phase === 'push') { n.speed += 0.9 * dt; if (st.t > 1.0) { st.phase = 'recover'; st.t = 0; } }
      else if (st.phase === 'recover' && st.t > 0.9) { st.phase = 'idle'; st.t = 0; }
      n.speed -= 0.3 * n.speed * dt;
      n.s += n.dir * n.speed * dt;
      if (n.s > n.s1 || n.s < n.s0) { n.dir = -n.dir; n.s = clamp(n.s, n.s0, n.s1); n.speed = 0.2; }
      this.alongRiver(n.w, n.s, _A);
      const lx = _A.dz, lz = -_A.dx;
      let lat = n.lat * n.dir;
      let x = _A.x + lx * lat, z = _A.z + lz * lat, h = Math.atan2(_A.dx * n.dir, _A.dz * n.dir);
      if ((n.chk = (n.chk || 0) - dt) <= 0) { n.chk = 0.5; n.latOK = this.puntOK(x, z, h); }
      if (!n.latOK) { x = _A.x; z = _A.z; }
      n.h += wrap(h - n.h) * Math.min(1, dt * 0.8);
      n.x += (x - n.x) * Math.min(1, dt * 2); n.z += (z - n.z) * Math.min(1, dt * 2);
      const m = n.rig.group, t = this.t + n.ph;
      m.position.set(n.x, this.waterY + Math.sin(t * 1.7) * 0.012, n.z);
      m.rotation.order = 'YXZ'; m.rotation.set(Math.sin(t * 1.2) * 0.006 - 0.01, n.h, Math.sin(t) * 0.01);
      const fake = _NPCV; fake.x = n.x; fake.z = n.z; fake.heading = n.h; fake.stroke = st; fake.rig = n.rig; fake.npc = true; fake.trail = 0; fake.driver = null;
      this._pole(fake, dt);
      if (n.chars) { if (d < 90) for (const ch of n.chars) ch.update(dt, 0); else for (const ch of n.chars) ch.lodTick(); }
    }
  }

  // ------------------------------------------------------------ crash after-effects, other players' cars
  /** a car that took a hard hit steams from under the bonnet for a while (black smoke when badly bent) */
  _steam(v, dt) {
    v.steamT -= dt;
    if (!this._nearCam(v) || Math.random() > dt * (v.dmg > 0.7 ? 14 : 8)) return;
    const T = TYPES[v.type], fx = Math.sin(v.heading), fz = Math.cos(v.heading), u = T.L / 2 - 0.55;
    this.puffs.emit(v.dmg > 0.7 && Math.random() < 0.5 ? PUFF.black : PUFF.steam, v.x + fx * u, v.y + 0.95, v.z + fz * u, v.vx * 0.6, 0.6, v.vz * 0.6, 0.25);
  }
  /**
   * Our vehicle into another player on foot. Whether they fall is their client's call (_onFoot -> _hitPlayer there), and
   * we only hear of it with their next state — a quarter of a second in which their figure stood inside our bonnet. So
   * we show it at once: the short tumble, thrown clear along our way, and never inside our vehicle's outline. Drawing
   * only (core/net.js calls this for each player it has just placed, net.posers): as soon as their own state shows the
   * fall the figure eases onto where THEY say they are; if 0.6 s pass without it (their client saw no hit) it is put back.
   */
  _poseRemote(o, dt, grp) {
    const v = this.cur, id = o.id;
    let pr = this._pred.get(id);
    if (!pr && !v) return;
    const fallen = TUMBLE_POSES.has(o.pose) || o.pose === 'fall';
    const T = v ? TYPES[v.type] : null, solid = !!T && (T.kind === 'car' || T.kind === 'bike');
    const half = solid ? Math.max(0, T.L / 2 - T.W / 2) : 0, rad = solid ? T.W / 2 + (T.kind === 'bike' ? 0.1 : 0) : 0;
    const P = _PP;
    if (!pr) {
      if (!solid || o.veh || o.ride || o.pose === 'sit' || o.place !== 'world' || this.game.player.place !== 'world') return;
      if (Math.abs(o.x - v.x) > 9 || Math.abs(o.z - v.z) > 9) return;
      const dy = (o.y || 0) - (v.y || 0);
      if (!fallen && (dy > 0.5 || dy < -0.8)) return;          // (standing on it, or on another level)
      const car = T.kind === 'car', sp0 = v.speed || 0;
      const vx = car && Number.isFinite(v.vx) ? v.vx : Math.sin(v.heading) * sp0, vz = car && Number.isFinite(v.vz) ? v.vz : Math.cos(v.heading) * sp0, sp = Math.hypot(vx, vz);
      const last = this._predT && this._predT.get(id);
      P.x = o.x; P.z = o.z;
      if (fallen || sp <= 2.6 || (last !== undefined && this.t - last < 1.5)) {
        // no blow to show (as _hitPlayer: slower than this nobody is bowled over; or they are down already): the figure
        // is just never drawn inside our vehicle — their own client holds them out of it too, we hear of it a moment later
        if (pushCapsuleRaw(P, 0.32, v.x, v.z, v.heading, half, rad)) { grp.position.x = P.x; grp.position.z = P.z; }
        return;
      }
      // inside our outline now, or will be before the next frame is drawn
      const look = Math.min(0.05, dt || 0);
      if (!pushCapsuleRaw(P, 0.32, v.x, v.z, v.heading, half, rad) && !pushCapsuleRaw(P, 0.32, v.x + vx * look, v.z + vz * look, v.heading, half, rad)) return;
      // (the throw their own client gives for this blow — _hitPlayer there, Player.knockDown {hit}: the same sums here)
      const px = P.x - o.x, pz = P.z - o.z, pl = Math.hypot(px, pz) || 1, os = Math.abs(o.speed || 0);
      const B = blowOnFoot(vx, vz, car ? (v.yr || 0) + (v.spin || 0) : 0, v.x, v.z, o.x, o.z, px / pl, pz / pl, Math.sin(o.h) * os, Math.cos(o.h) * os, v.type);
      if (!(B.eff > 2.6)) { grp.position.x = P.x; grp.position.z = P.z; return; }      // (a brush, a nudge: held out of our outline, nobody goes over)
      const kx = B.tx + px / pl * 1.2, kz = B.tz + pz / pl * 1.2, ks = Math.hypot(kx, kz), k = Math.min(0.8, 11 / Math.max(ks, 1e-3));
      pr = { x: P.x, z: P.z, vx: kx * k, vz: kz * k, h: Math.atan2(-kx, -kz), t: 0, seen: false, w: 1 };
      this._pred.set(id, pr); (this._predT || (this._predT = new Map())).set(id, this.t);
      try { o.character.setPose('stand'); o.character.setPose('knocked'); } catch { /* */ }
    }
    pr.t += dt;
    if (!pr.seen && fallen) pr.seen = true;
    if (!pr.seen && (pr.t > 0.6 || o.place !== 'world' || o.veh)) {
      // their client decided there was no hit: back to what they are doing
      this._pred.delete(id);
      try { o.character.setPose(o.pose); } catch { /* */ }
      return;
    }
    // the predicted slide (Player's own: 7 m/s² on the ground), out of the walls
    const sp = Math.hypot(pr.vx, pr.vz);
    if (sp > 0.01) { const n = Math.max(0, sp - 7 * dt) / sp; pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.vx *= n; pr.vz *= n; P.x = pr.x; P.z = pr.z; this.col.resolve(P, 0.32, OPT_NONE); pr.x = P.x; pr.z = P.z; }
    // once they say so themselves: over to their own position in a third of a second
    if (pr.seen) pr.w = Math.max(0, pr.w - dt * 3);
    P.x = o.x + (pr.x - o.x) * pr.w; P.z = o.z + (pr.z - o.z) * pr.w;
    if (solid && pushCapsuleRaw(P, 0.32, v.x, v.z, v.heading, half, rad) && !pr.seen) { pr.x = P.x; pr.z = P.z; }
    grp.position.x = P.x; grp.position.z = P.z;
    if (!pr.seen) grp.rotation.y = pr.h;
    if (pr.seen && pr.w <= 0) this._pred.delete(id);
  }
  /**
   * Other players' driven cars this frame, from what core/net.js draws (interpolated rider position -> body centre,
   * velocity from the motion, smoothed): bodies our car / our player collide with, and their skids, from the same
   * state everybody already sends (nothing extra on the wire).
   */
  _remotes(dt) {
    const net = this.game.net, R = this.remoteBodies, me = this.game.player;
    for (let i = 0; i < R.length; i++) R[i].on = false;
    if (!net || !net.others || !net.others.size || me.place !== 'world') return;
    let k = 0;
    for (const o of net.others.values()) {
      const T = TYPES[o.veh];
      if (!T || T.kind !== 'car' || o.place !== 'world' || !o.seen) continue;
      let q = R[k]; if (!q) R.push(q = { on: false, id: -1, x: 0, z: 0, y: 0, h: 0, vx: 0, vz: 0, w: 0, type: '', sk: null, t: 0 });
      k++;
      const Rd = RIDER[o.veh], h = o.h, fx = Math.sin(h), fz = Math.cos(h);
      const x = o.x - fx * Rd.z - fz * Rd.x, z = o.z - fz * Rd.z + fx * Rd.x;
      if (q.id !== o.id || q.type !== o.veh || Math.abs(x - q.x) + Math.abs(z - q.z) > 8) { q.id = o.id; q.type = o.veh; q.vx = q.vz = q.w = 0; q.x = x; q.z = z; q.h = h; }
      const a = Math.min(1, dt * 8), ivx = (x - q.x) / dt, ivz = (z - q.z) / dt;
      let dh = h - q.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      q.vx += (ivx - q.vx) * a; q.vz += (ivz - q.vz) * a; q.w += (dh / dt - q.w) * a;
      q.x = x; q.z = z; q.h = h; q.y = o.y - Rd.y; q.on = true; q.ref = null;
      // their skids: sliding sideways, or braking hard
      const vl = q.vx * fz - q.vz * fx, vf = q.vx * fx + q.vz * fz, dec = q.vf0 !== undefined ? (q.vf0 - vf) / dt : 0;
      q.vf0 = vf;
      if ((Math.abs(vl) > 2.2 || (dec > 8 && vf > 3)) && this._nearCam(q)) {
        if (!q.sk) q.sk = [SkidMarks.emitter(), SkidMarks.emitter()];
        const tw = T.W * 0.5 - 0.17, hw = T.wb * 0.5;
        for (let j = 0; j < 2; j++) { const s = j ? -tw : tw, wx = x - fx * hw + fz * s, wz = z - fz * hw - fx * s; this.skids.mark(q.sk[j], wx, this.game.groundHeight(wx, wz), wz, 0.2, Math.min(1, Math.abs(vl) / 5 + 0.3)); }
      }
    }
    // ... and the cars other systems show for other players' clients (their police cars and road blocks, systems/police.js)
    this._rk = k;
    for (let i = 0; i < this._bodySrc.length; i++) { try { this._bodySrc[i](this._addBody); } catch (e) { if (!this._bodySrcErr) { this._bodySrcErr = true; console.warn('[vehicles] remote bodies', e); } } }
  }
  /** One more body owned by another player's client this frame (called by an addBodies source, from _remotes): solid to
   *  our car, our bike and us on foot, and a vehicle to the child / animal protection, exactly as another player's own car
   *  is. ref: the source's record of it; ref.hit(v, q, dvx, dvz, dw, own, imp), if there, is told when OUR car v runs into
   *  it — what the hit would have done to it (its change of velocity and spin), for its owner to apply. */
  _addRemoteBody(ref, type, x, z, y, h, vx, vz, w) {
    const T = TYPES[type];
    if (!T || T.kind !== 'car' || !Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(h)) return null;
    const R = this.remoteBodies; let q = R[this._rk];
    if (!q) R.push(q = { on: false, id: -1, x: 0, z: 0, y: 0, h: 0, vx: 0, vz: 0, w: 0, type: '', sk: null, t: 0 });
    this._rk++;
    q.id = -1; q.ref = ref || null; q.type = type; q.x = x; q.z = z; q.y = y || 0; q.h = h; q.vx = vx || 0; q.vz = vz || 0; q.w = w || 0; q.vf0 = undefined; q.on = true;
    return q;
  }

  // ------------------------------------------------------------ audio
  // engine / road / freewheel sound of the vehicle being driven: one persistent graph (systems/_vehicle_audio.js)
  _engine(on, v = null) {
    if (!this._snd) this._snd = new VehicleSound(this.game.audio);
    const k = v && v.kind === 'car' ? (v.type === 'bus' || v.type === 'van' ? v.type : 'car') : null;
    if (v && k && isFinite(v.x) && isFinite(v.z)) { try { this._snd.door(on ? 'shut' : 'open', v.x, v.z, k); } catch { /* */ } }      // (in: the door shuts behind you; out: the latch)
    if (!on) this._snd.stop();
  }
  _engineUpdate(v, throttle, braking = false) {
    if (v !== this.cur) return;
    if (!this._snd) this._snd = new VehicleSound(this.game.audio);
    this._snd.update(v.kind === 'bike' ? 'bike' : v, v.speed, !!throttle, v, !!braking && v.speed > 0.5);
  }
  /**
   * A hit, heard where it happened (systems/_crash_audio.js): impact = closing speed m/s; v = the vehicle that hit (its
   * place and the kind of body that makes the noise; null: the player on foot); what = a material (_crash_audio MATS)
   * or null for what this frame's contact recorded (another vehicle, or the tag of the wall). The vehicle you drive
   * tells the other players. (freq: no longer used.)
   */
  _thud(impact, freq = 0, v = this.cur, what = null) {
    const S = this.crashSnd; if (!S || !(impact > 0)) return;
    const p = this.game.player, at = v && isFinite(v.x) && isFinite(v.z) ? v : p && p.pos; if (!at) return;
    const near = this._hitX !== undefined && Math.abs(this._hitX - at.x) + Math.abs(this._hitZ - at.z) < 6;      // (the contact point, when this frame's is this vehicle's)
    const x = what === null && near ? this._hitX : at.x, z = what === null && near ? this._hitZ : at.z, y = (isFinite(at.y) ? at.y : 0) + (v ? 0.5 : 0.8);
    const striker = !v ? 'foot' : v.kind === 'bike' ? 'bike' : v.type === 'bus' ? 'bus' : 'car';
    try { S.hit(what || this._matOf(), impact, x, y, z, { striker, send: !!v && v === this.cur }); } catch (e) { /* the sound's business */ }
  }
  /** what this frame's contact was with, as a material for the crash sound */
  _matOf() {
    const w = this._hitWhat, o = this._hitOther;
    if (w === 'vehicle' || w === 'traffic' || w === 'parked' || w === 'remote') return o && o.kind === 'bike' ? 'bike' : o && o.type === 'bus' ? 'bus' : 'car';
    return this._wallMat || 'masonry';
  }

  // ------------------------------------------------------------ public API
  _api() {
    const self = this;
    return {
      types: TYPES,
      get list() { return self.live; },
      get current() { return self.cur; },
      get config() { return self.config; },
      get moorings() { return self.moorings; },
      get placed() { return self.placed; },
      spawn: (type, x, z, heading, opts) => self.spawn(type, x, z, heading, opts),
      remove: (v) => self.remove(v),
      promote: (s) => self.promote(s),
      nearest: (x, z, r, filter) => self.nearest(x, z, r, filter),
      enter: (v) => self.enter(v),
      /** take an AI traffic agent (game.traffic.list entry) from its driver: starts the ~0.9 s enter sequence */
      take: (a) => self._startTake(a),
      get taking() { return self.taking; },
      get lastTake() { return self.lastTake; },
      exit: (force) => self.exit(force),
      /** event hooks: on(kind, fn(d)) -> unsubscribe. Kinds: 'take' {v, info} · 'knock' {v, ped, speed} · 'impact' {v, impact, what:
       *  'wall'|'vehicle'|'traffic'|'parked', other} (any live car incl. AI-driven, impact > 2.5 m/s) · 'enter' {v} · 'exit' {v} ·
       *  'busStop' {v, stop} (return true to replace the default toast) */
      on: (kind, fn) => { let a = self._ev.get(kind); if (!a) self._ev.set(kind, (a = [])); a.push(fn); return () => { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; },
      /** drive an AI-controlled live car (set v.driver = 'ai' first): c = {throttle 0..1, brake, hand, steer -1..1 (+1 right)} */
      drive: (v, c, dt) => self.drive(v, c, dt),
      /** shunt: make a live car spin (rad/s, decays in ~1 s) */
      spin: (v, rate) => { if (v && v.kind === 'car' && !v.static) v.spin = (v.spin || 0) + rate; },
      /** shunt a live car as a blow reported from elsewhere would (another player's client drove into our AI car, which
       *  it only has a copy of): velocity change (m/s) and spin change (rad/s), settled out of the walls, damage as a hit of
       *  `imp` m/s; from: that player's id (their own car, as we draw it, does not deal the same blow again for 0.4 s) */
      shunt: (v, dvx, dvz, dw = 0, imp = 0, from = null) => {
        if (!v || v.kind !== 'car' || v.static || self.live.indexOf(v) < 0) return false;
        if (![dvx, dvz, dw].every(Number.isFinite)) return false;
        const d = Math.hypot(dvx, dvz), k = d > 22 ? 22 / d : 1;
        v.vx = (v.vx || 0) + dvx * k; v.vz = (v.vz || 0) + dvz * k; v.spin = clamp((v.spin || 0) + dw, -SPIN_MAX, SPIN_MAX); v.shuntT = self.t;
        v.speed = v.vx * Math.sin(v.heading) + v.vz * Math.cos(v.heading);
        if (from !== null) { v._rbSkipId = from; v._rbSkipT = self.t + 0.4; }
        self._settle(v);
        if (imp > 3.5) { self._hitAt(v.x, v.z, 0, 0); self._hurt(v, Math.min(imp, 22) * 0.5); }
        return true;
      },
      /** fn(add) is called every frame to add bodies other players' clients own (add(ref, type, x, z, y, h, vx, vz, w),
       *  see _addRemoteBody): systems/police.js gives other players' police cars and road blocks */
      addBodies: (fn) => { if (typeof fn === 'function' && self._bodySrc.indexOf(fn) < 0) self._bodySrc.push(fn); },
      createMesh: (type, color, livery) => {
        // remote players broadcast the RIDER position; offset the vehicle so their character sits in the right place.
        // color (optional, sent by newer clients) = the body colour of the remote player's vehicle
        const t = TYPES[type] ? type : 'bike_roadster', R = RIDER[t], grp = new THREE.Group();
        const m = makeGhost(t, Number.isFinite(color) ? color : undefined, livery); m.position.set(-R.x, -R.y, -R.z); grp.add(m);
        grp.name = 'remote-vehicle:' + t;
        return grp;
      },
      isOnWater: (x, z, h) => self.puntOK(x, z, h),
      /** physics (2026-11): per-type tuning table, ground grip at a point (0.4..1), the standable top of any vehicle body
       *  under (x, z) within `reach` above feet height y (-1 if none; out.o = the body, for riding along on it) */
      phys: PHYS,
      gripAt: (x, z) => self.surface.grip(x, z, self.game.groundHeight(x, z)),
      supportAt: (x, z, y, reach, out) => self.supportAt(x, z, y, reach, out),
      /** debug: shove a car (live, or the nearest parked one) at (vx, vz) m/s with a spin, e.g. from the console:
       *  game.vehicles.debugShunt(null, 6, 0, 1.5) shunts the nearest car */
      debugShunt: (v, vx = 5, vz = 0, spin = 0) => {
        const p = self.game.player.pos;
        if (!v) v = self.nearest(p.x, p.z, 25, (o) => TYPES[o.type].kind === 'car');
        if (!v) return null;
        if (v.static) { const s = v; v = self.promote(s); if (v) { v.home = { x: s.x, z: s.z, h: s.h }; v.shuntT = self.t; } }
        if (!v || v.kind !== 'car') return null;
        v.vx = vx; v.vz = vz; v.spin = spin; return v;
      },
      /** debug: knock the player down as if hit by a car at `speed` (see Player.knockDown) */
      debugKnockPlayer: (speed = 9) => self.game.player.debugTumble && self.game.player.debugTumble(speed),
      /** debug / screenshots (tools/gfx_shots.mjs phys-*): stage a physics moment near the player and simulate to `t` s after it */
      debugStage: (kind, t) => self.debugStage(kind, t),
      fxStats: () => ({ skids: self.skids.used, skidTotal: self.skids.total || 0, puffs: self.puffs.alive, debris: self.debris.active, restored: self.restored || 0, surfaceMs: self.surfaceMs }),
      pools: self.pools,
      _sys: self,
    };
  }
}

// ---------------------------------------------------------------- helpers (allocation-free)
const _P = { x: 0, z: 0 }, _A = { x: 0, z: 0, dx: 0, dz: 0, ok: false }, _NPCV = { x: 0, z: 0, heading: 0 };
const _PP = { x: 0, z: 0 }, TUMBLE_POSES = new Set(['tumble', 'tumblef', 'knocked', 'knockedf']);      // (_poseRemote)
const _B = new THREE.Vector3(), _D = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
const POLE_REST_Q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.02, 1).normalize());
const OPT_LOW = { ignoreLow: true }, OPT_CAR = { ignoreLow: true, ignorePassages: true }, OPT_NONE = {};
// ---- physics helpers (2026-11 pass; the maths is in _vehphys.js)
const KNOCK_MIN = 1.0, SPIN_MAX = 3.5, _GL = { n: 0, t: 0 }, _BL = { tx: 0, tz: 0, eff: 0, vn: 0, m: 0 };
/**
 * The blow a vehicle body gives somebody on foot it is pushing out of itself along (nx, nz): the body (of `type`) goes
 * at (vx, vz) and turns at w about (cx, cz); they stand at (x, z) and are going at (pvx, pvz). The closing speed along
 * the push — the bodywork where it met them, a swinging tail included, against their own going — plus what friction
 * drags along as it slides past, times the share a body of that mass can give (systems/_collide.js). -> _BL {tx, tz
 * (what it gives them, m/s), eff (its size), vn (the closing speed), m (the body's mass)}; eff 0: no blow (the body is
 * standing or creeping and they walked into it, or it is going away). Used for our own player (_hitPlayer) and to show
 * another player's fall at once (_poseRemote): the same sums on both machines.
 */
function blowOnFoot(vx, vz, w, cx, cz, x, z, nx, nz, pvx, pvz, type) {
  const B = _BL, rx = w ? x - cx : 0, rz = w ? z - cz : 0, bx = vx + w * rz, bz = vz - w * rx;
  B.tx = 0; B.tz = 0; B.eff = 0; B.vn = 0; B.m = PHYS[type] ? PHYS[type].m : PHYS.car_hatch.m;
  if (Math.hypot(bx, bz) < 1.1) return B;
  const cvx = bx - pvx, cvz = bz - pvz, vn = cvx * nx + cvz * nz;
  if (!(vn > 0)) return B;
  const sh = personShare(B.m), G = glance(vn, cvx * nz - cvz * nx, _GL);
  B.tx = (nx * G.n + nz * G.t) * sh; B.tz = (nz * G.n - nx * G.t) * sh; B.eff = Math.hypot(B.tx, B.tz); B.vn = vn;
  return B;
}
const mkBody = () => ({ x: 0, z: 0, vx: 0, vz: 0, w: 0, m: 1, I: 1, ghost: false, fixed: false, vn: 0 });
const _BA = mkBody(), _BB = mkBody(), _FIXED = Object.assign(mkBody(), { fixed: true }), _C2 = { nx: 0, nz: 0, depth: 0, cx: 0, cz: 0 };
/** per-car physics state: suspension springs (pitch / roll / heave), yaw rate, grip, brake / launch timers, damage */
function initBody(v) {
  v.pitchS = { x: v.pitch || 0, v: 0 }; v.rollS = { x: v.lean || 0, v: 0 }; v.heaveS = { x: 0, v: 0 };
  v.yr = 0; v.gripF = v.gripR = 1; v.gT = 0; v.brakeT = 0; v.launchT = 0; v.thr0 = 0; v.dmg = v.dmg || 0; v.steamT = 0; v.spinW = 0; v.under = 0; v.locked = false;
}
function bodyOf(v, out) { const P = PHYS[v.type]; out.x = v.x; out.z = v.z; out.vx = v.vx || 0; out.vz = v.vz || 0; out.w = (v.yr || 0) + (v.spin || 0); out.m = P.m; out.I = P.I; out.ghost = false; out.fixed = false; out.vn = 0; return out; }
function applyBody(v, A, w0) { v.vx = A.vx; v.vz = A.vz; v.spin = clamp((v.spin || 0) + (A.w - w0), -SPIN_MAX, SPIN_MAX); }
/** an AI traffic agent as a body (it has no velocity vector of its own: heading * speed, or its shove) */
function remoteish(a, vx, vz, out) { const P = PHYS[a.type]; out.x = a.x; out.z = a.z; out.vx = vx; out.vz = vz; out.w = a.shove ? a.shove.w : a.yaw || 0; out.m = P.m; out.I = P.I; out.ghost = false; out.fixed = false; out.vn = 0; return out; }
/** height (above the bay) a parked car's collision box can be passed over at: its lowest standable top */
function standTop(type) { const P = PHYS[type]; return P && P.bonnet ? P.bonnet[2] : P && P.roof ? P.roof[2] : 0; }
/** separating-axis gap (m, negative = overlap) between two car footprints (type, centre, heading) */
function boxGap(A, ax, az, ah, B, bx, bz, bh) {
  const ca = [Math.sin(ah), Math.cos(ah)], cb = [Math.sin(bh), Math.cos(bh)], dx = bx - ax, dz = bz - az;
  const axes = [ca, [ca[1], -ca[0]], cb, [cb[1], -cb[0]]];
  let gap = -Infinity;
  for (const [ux, uz] of axes) {
    const ra = Math.abs(ux * ca[0] + uz * ca[1]) * A.L / 2 + Math.abs(ux * ca[1] - uz * ca[0]) * A.W / 2;
    const rb = Math.abs(ux * cb[0] + uz * cb[1]) * B.L / 2 + Math.abs(ux * cb[1] - uz * cb[0]) * B.W / 2;
    gap = Math.max(gap, Math.abs(dx * ux + dz * uz) - ra - rb);
  }
  return gap;
}
/** point and unit direction at arc length s along a polyline (cum: running lengths) */
function polyAt(pts, cum, s, out) {
  let i = 0; while (i < pts.length - 2 && cum[i + 1] < s) i++;
  const L = cum[i + 1] - cum[i] || 1e-6, t = clamp((s - cum[i]) / L, 0, 1), a = pts[i], b = pts[i + 1];
  out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t; out.dx = (b[0] - a[0]) / L; out.dz = (b[1] - a[1]) / L;
  return out;
}
const _pa = { x: 0, z: 0, dx: 0, dz: 1 }, _pb = { x: 0, z: 0, dx: 0, dz: 1 };
/** is the player (pos) standing on / scrambling onto this vehicle body (so it must not push them off sideways)? */
function onTop(type, x, z, h, y, pos) {
  const u = (pos.x - x) * Math.sin(h) + (pos.z - z) * Math.cos(h), tp = topAt(type, clamp(u, -TYPES[type].L / 2, TYPES[type].L / 2));
  return tp > 0 && pos.y - (y || 0) >= tp - 0.35;
}
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function newStroke() { return { phase: 'idle', t: 0, bx: 0, bz: 0, lx: 0.5, lz: -2.35 }; }
/** set a punt rocking: roll / pitch velocity kicks (rad/s) */
function rockKick(v, r, p) { if (!v.rkR) { v.rkR = { x: 0, v: 0 }; v.rkP = { x: 0, v: 0 }; } v.rkR.v += r; v.rkP.v += p; }

/** Push circle P (radius r) out of a vehicle-shaped capsule. */
function pushCapsule(P, r, x, z, h, T) { return pushCapsuleRaw(P, r, x, z, h, Math.max(0, T.L / 2 - T.W / 2), T.W / 2); }
function pushCapsuleRaw(P, r, x, z, h, half, rad) {
  const fx = Math.sin(h), fz = Math.cos(h);
  let u = (P.x - x) * fx + (P.z - z) * fz; u = u < -half ? -half : u > half ? half : u;
  const qx = x + fx * u, qz = z + fz * u, dx = P.x - qx, dz = P.z - qz, R = r + rad, d2 = dx * dx + dz * dz;
  if (d2 >= R * R) return false;
  const d = Math.sqrt(d2);
  if (d < 1e-5) { P.x += fz * R; P.z -= fx * R; return true; }
  P.x += (dx / d) * (R - d); P.z += (dz / d) * (R - d);
  return true;
}

function bell(a) {
  if (!a || !a.ctx) return;
  for (const w of [0, 0.16]) { a.tone(2350, 0.7, { type: 'sine', gain: 0.12, when: w }); a.tone(2350 * 2.76, 0.35, { type: 'sine', gain: 0.035, when: w }); a.tone(2350 * 5.4, 0.15, { type: 'sine', gain: 0.015, when: w }); }
}
function horn(a, type) {
  if (!a || !a.ctx) return;
  const f = type === 'bus' ? 220 : type === 'van' ? 330 : type === 'taxi' ? 370 : 410;
  a.tone(f, 0.45, { type: 'square', gain: 0.07 }); a.tone(f * 1.26, 0.45, { type: 'square', gain: 0.05 });
}
function click(a) { if (a && a.ctx) { a.noise(0.025, { gain: 0.07, freq: 2600, q: 4 }); a.noise(0.05, { gain: 0.05, freq: 1100, q: 2, when: 0.02 }); } }      // (a door handle pulled: the catch letting go — noise only, no beep)
function slam(a) { if (a && a.ctx) { a.noise(0.16, { gain: 0.28, freq: 210, type: 'lowpass', q: 0.8 }); a.tone(85, 0.12, { type: 'sine', gain: 0.12 }); } }
function busDoors(a) {
  if (!a || !a.ctx) return;
  a.noise(0.6, { gain: 0.07, freq: 2600, q: 0.5 });                          // pssssht
  a.tone(1310, 0.35, { gain: 0.05, when: 0.65 }); a.tone(1310, 0.35, { gain: 0.05, when: 0.87 });   // ding ding
}
function skid(a, k, v = null) { if (a && a.ctx) { const pos = v && isFinite(v.x) && isFinite(v.z) ? [v.x, v.z] : undefined; a.noise(0.12, { gain: Math.min(0.12, 0.03 + k * 0.01), freq: 2400 + Math.random() * 600, q: 6, pos, cls: pos ? 'vehicle' : undefined }); } }
function splash(a, gain) { if (a && a.ctx) { a.noise(0.35, { gain, freq: 700, type: 'lowpass', q: 0.5 }); a.noise(0.2, { gain: gain * 0.5, freq: 3000, q: 1, when: 0.03 }); } }
export { bell, horn };
