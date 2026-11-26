// Ambient traffic: a lane graph from the map's driveable roads, AI vehicles and cyclists near the player (numbers per
// game.quality tier: TIERS), buses that pull in at the map's bus stops, taxis waiting at the ranks. The player can take
// any of them (vehicles.js runs the enter sequence; handOver() here turfs the driver out into the crowd).
// Britain: everybody keeps LEFT. AI is cosmetic/per-client. Exposes game.traffic = { list, graph, config, ... }.
// Each entry of `list` has {kind:'car'|'bike', type, x, z, heading, speed, half, radius, active} so vehicles.js can collide.
// Motion (2026-11 smoothing pass): the lane graph only says WHERE to go. Every agent is a kinematic bicycle (rear axle
// follows the heading, heading turns at speed * tan(steer) / wheelbase) whose front wheel is pointed, through a short lag,
// at a look-ahead point on a continuous path: the kept-left lane line, carried round each junction through the corner
// point where the two lane lines meet (_junc) and on into the next two lanes. So the heading always comes from the
// motion, corners are rounded, the rear of a bus tracks inside its front, lateral moves (bus stops, pulling over for blue
// lights) are steered, and speed is capped by lateral acceleration. Bikes lean by atan(v * yawRate / g), low-passed.
import { createCharacter, randomLook } from '../core/characters.js';
import { TYPES, makeLive, vehFade } from './_vehiclemeshes.js';
import { lampsWanted } from './_carfid.js';
import { WaterIndex } from './_vehicleutil.js';
import { MotionGrid, K_CAR, K_BUS, K_BIKE, K_PVEH, K_LIVE, K_PED, K_PLAYER, K_REMOTE, BUS_NAMES } from './_motion.js';
import { busyOn, busyTier, popTiered, BUS_SPOTS } from './_busy.js';
const BUSY = busyOn(), PARK_GRID = 600, PARK_GRID_LOW = 320;
// Nothing on wheels pops into or out of being (2026-11-26; tools/smoke_popin.mjs, as for the people on 2026-11-24).
// A vehicle is drawn whole within V_WHOLE m of the player and thins out to nothing at V_GONE (a dithered fade:
// _vehiclemeshes.js vehFade; a car at 225 m is six pixels tall, a cyclist at 165 m ten), so one made in plain view
// is made beyond V_GONE - not there to be seen yet - and drives into the picture; nearer than that only where no
// player can see the spot (out of the camera's picture, or a building in the way). They are let go beyond V_GONE
// too: at V_LET, or as soon as they are out of the camera's picture out there (solo). Whatever still has to come or
// go where it can be seen (another player's vehicle arriving by the network, one that gives up in a jam in plain
// view) fades over V_FADE_S instead. Cars were made in plain view from 190 m and let go at 270, cyclists from 140
// and at 240, all at once: 4 to 13 a minute seen driving down a long street.
// The numbers near the player are as they were (measured: tools/smoke_popin.mjs prints the agents within 120 m and
// by 30 m ring): the ring a vehicle is made in in plain view is as wide as it was and further out (car 227-266 m, was
// 190-230; cyclist 167-196, was 140-170), and no place in the numbers is spent for long on one that is neither drawn
// nor ahead (V_LET_HID).
const V_WHOLE = { car: 198, bike: 145 }, V_GONE = { car: 225, bike: 165 }, V_LET = { car: 272, bike: 200 }, V_LET_HID = { car: 250, bike: 168 }, V_FADE_S = 0.6;

const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'primary_link', 'secondary_link', 'tertiary_link']);
const MAIN = new Set(['primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link', 'tertiary_link']);
const SPEED = { primary: 12, primary_link: 9, secondary: 11, secondary_link: 9, tertiary: 10, tertiary_link: 8, unclassified: 8.9, residential: 8.9 };
// AI numbers per graphics tier (low = the pre-2026 numbers). Taxis waiting at ranks count towards maxCars.
// (2026-11-21: the SAME on every tier — _busy.js "WHO IS THERE does not depend on the graphics tier": in multiplayer the
// traffic is made by whoever looks after the street, so per-tier numbers made its density depend on whose laptop that
// was. A weaker tier draws the same vehicles plainer: systems/_carfid.js. ?poptier=1: the old per-tier numbers, to measure.)
const OLD_TIERS = popTiered();
const TRAFFIC = { maxCars: 20, maxCarsNight: 11, maxBikes: 14, maxBikesNight: 6, maxBuses: 4, rankTaxis: 4 };
export const TIERS = {
  low: OLD_TIERS ? { maxCars: 12, maxCarsNight: 6, maxBikes: 10, maxBikesNight: 4, maxBuses: 2, rankTaxis: 2 } : { ...TRAFFIC },
  medium: OLD_TIERS ? { maxCars: 16, maxCarsNight: 9, maxBikes: 12, maxBikesNight: 5, maxBuses: 3, rankTaxis: 3 } : { ...TRAFFIC },
  high: { ...TRAFFIC },
};
// (busy-streets pass: one more bus on medium / high, only near the High, St Aldate's and the station: _busy.js BUS_SPOTS)
if (busyOn()) for (const k of ['low', 'medium', 'high']) TIERS[k].maxBuses += busyTier(k).buses;
// Taxi ranks c. 2013. St Giles' and Gloucester Green are OSM amenity=taxi nodes (long-standing ranks); the station rank is
// a guess at the forecourt service road. `road` = the OSM way the queue lines up along (in its drawn direction).
export const RANKS = [
  { name: "St Giles'", p: [44.3, -92.4], road: 'w132734583', source: 'OSM amenity=taxi (central reservation)' },
  { name: 'Gloucester Green (St George\'s Place)', p: [-90.7, 137.9], road: 'w5131920', source: 'OSM amenity=taxi' },
  { name: 'Oxford station forecourt', p: [-632.6, 182], road: 'w28263933', source: 'GUESS: forecourt service road' },
  { name: 'Cowley Road (by the music venue)', p: [1746, 874], road: 'w2898399', source: 'GUESS: kerbside outside the Cowley Road venue, for the late crowd' },
];
// what the turfed-out driver shouts (comic, indignant, bloodless)
const SHOUTS = {
  car_hatch: ["Oi! That's my Astra!", "My Fiesta! I've only just had it valeted!", "I'm calling the Proctors!", 'Unbelievable. In broad daylight!'],
  car_saloon: ["Oi! That's my Mondeo!", "That's a company car, that is!", "Right. I'm writing to the Oxford Mail!", "I'm calling the Proctors!"],
  taxi: ["Oi! I've got a fare at the station!", "The meter's still running, you know!", "That's my livelihood, that is!", "You don't even know the Botley Road!"],
  van: ["Oi! Me tools are in there!", "I've got a job in Headington at two!", "That's not even my van!", "I'm calling the Proctors!"],
  bus: ["Oi! I've got a timetable to keep!", "You need a PSV licence for that!", "Who's going to take the fares?!", "Ladies and gentlemen, the service is... terminated."],
  bike: ["Oi! That's my bike!", "I've got a tute in five minutes!", "I'm calling the Proctors!", "That bike's older than you are!", "Rude! I had right of way!"],
};
// a cyclist knocked off by a car (bloodless: they sit up, dust off and shout)
const KNOCKED = ["My spokes!", "Oi! I was in the cycle lane!", "That's going on the cycling forum!", "Look where you're going!", "I'm writing to the Oxford Mail!", "Do you know who my tutor is?!"];
const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export default {
  id: 'traffic',
  install(game) {
    const T = new Traffic(game);
    game.traffic = T.api;
    // (the fading vehicles' programs - _vehiclemeshes.js vehFade - so the first one to fade does not link a program that frame)
    (game.warmups || (game.warmups = [])).push({ id: 'traffic-fade', fn: () => {
      const W = game.world; if (!W || !W.warmDraw) return null;
      try {
        const c = makeLive('car_hatch', TYPES.car_hatch.colors[0], { driver: true }), b = makeLive('bike_road', TYPES.bike_road.colors[0]);
        b.setLights(true); vehFade(c, 0.5); vehFade(b, 0.5); c.group.name = b.group.name = 'traffic:warm-fade';
        W.warmDraw(c.group, { prio: 1, id: 'traffic' }); return W.warmDraw(b.group, { prio: 1, id: 'traffic' });
      } catch (e) { return null; }
    } });
    return { id: 'traffic', update: (dt) => T.update(dt) };
  },
};

class Traffic {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.pool = new Map();          // type -> [rig]
    this.config = Object.assign({ enabled: true }, TIERS.low);
    this._tier = 'low'; this._tierT = 0;
    this.t = 0; this._spawnT = 0; this._seed = 12345; this._rankT = 0; this._uid = 0;
    this._ghost = false; this._ghostF = -1; this._ghostN = 0;     // (junction-box sweeps being driven: see _sweep)
    this.grid = new MotionGrid(); this._gi = new Int32Array(256); this._hitRef = null;      // the shared neighbour index (systems/_motion.js) + a scratch list
    this.sync = null; this.netProvider = this._netProvider();      // multiplayer (systems/crowdsync.js)
    this.water = new WaterIndex(game.worldCollider);
    this._build(game.map);
    this._buildStops(game.map);
    this._buildRanks(game.map);
    this.shouts = []; this.ejected = []; this.taken = 0;
    this._last = { x: 1e9, z: 1e9 }; this._jumped = true;
    // build rigs / bake colour variants a little at a time so spawning never hitches
    this.warm = [];
    const n = { bike_roadster: 4, bike_road: 3, bike_mtb: 3, car_hatch: 4, car_saloon: 4, taxi: 5, van: 2, bus: 2 };
    for (const t of Object.keys(n)) { for (let i = 0; i < n[t]; i++) this.warm.push([t, null]); for (const c of TYPES[t].trafficColors || TYPES[t].colors) this.warm.push([t, c]); }
    this.warm.reverse();
    const self = this;
    this.api = {
      list: this.list, graph: { nodes: this.nodes, edges: this.edges, lanes: this.lanes }, config: this.config, tiers: TIERS, ranks: this.ranks,
      busStops: this.stops,
      lanePos: (l, s, o, out) => this.lanePos(l, s, o, out),
      get tier() { return self._tier; },
      get taken() { return self.taken; },
      /** nearest AI vehicle the player (on foot at x,z) can take: slow enough and its body within reach. */
      nearestTakeable: (x, z, reach) => this.nearestTakeable(x, z, reach),
      /** brake and hold still (the player is opening the door) / let it go again */
      hold: (a) => {
        if (a && a.active && a.remote) { const S = this.game.crowdsync; if (!S || !S.claimNow('c', a, true)) return false; }   // someone else's car: ours first
        if (a && a.active) { a.held = true; return true; } return false;
      },
      unhold: (a) => { if (a) a.held = false; },
      /** remove the AI vehicle (its rig goes back to the pool) and turf the driver out; returns the ejected ped/record */
      handOver: (a, opts) => this.handOver(a, opts),
      /** physics (systems/vehicles.js): shunted by a car — slide with (vx, vz) m/s and spin w rad/s, the driver brakes, waits,
       *  then carries on along its lane (someone else's agent is claimed first; false if it cannot be) */
      shove: (a, vx, vz, w) => this.shove(a, vx, vz, w),
      /** physics: a cyclist hit by a car going (vx, vz): the rider tumbles off (a ped), the agent leaves the traffic; returns
       *  {type, x, z, heading, color, driver} for the bike left in the road, or null */
      knockOff: (a, vx, vz) => this.knockOff(a, vx, vz),
      nearBusStop: (x, z, r) => this.nearBusStop(x, z, r),
      /** a lane spot for spawning a vehicle around (px,pz): {x, z, heading, lane, s} or null. opts {minD, maxD, hidden, bus} */
      spawnPoint: (px, pz, opts) => this.spawnPoint(px, pz, opts),
      /** shortest drive over the road graph (either direction, police ignore one-way): [[x,z], ...] or null */
      route: (ax, az, bx, bz) => this.route(ax, az, bx, bz),
      /** nearest lane point to (x,z) within maxD, preferring lanes pointing along heading (if given): {lane, s, x, z, d} or null */
      nearestLane: (x, z, maxD, heading) => this.nearestLane(x, z, maxD, heading),
      /** put an AI vehicle of `type` (colour optional) on the lane nearest (x,z) heading roughly `heading`; returns the agent */
      spawnAgentAt: (type, x, z, heading, color) => this.spawnAgentAt(type, x, z, heading, color),
      /** the next n bus stops along the bus streets from (x,z) heading h: [{id, name, x, z, dist (m along the route)}] */
      busRoute: (x, z, h, n) => this.busRoute(x, z, h, n),
      /** blue lights behind: agents within r m ahead of (x,z) travelling along `heading` pull over to the kerb and crawl for ~4 s */
      yieldTo: (x, z, heading, r) => this.yieldTo(x, z, heading, r),
      /** close every road edge with a point where test(x, z) is true to AI traffic (an event in the street): nothing spawns on
       *  it or turns into it, AI vehicles on it are let go. Returns a handle for openRoads(). Same call on every client. */
      closeRoads: (test) => this.closeRoads(test),
      openRoads: (h) => this.openRoads(h),
      setTier: (lvl) => this._setTier(lvl),
      /** the shared neighbour index of everything moving outdoors, rebuilt once a frame (systems/_motion.js) */
      get grid() { return self.grid; },
      stats: () => this.stats(),
      _sys: this,
    };
    console.log(`[traffic] lane graph: ${this.nodes.length} nodes, ${this.edges.length} edges (${this.bollarded} closed to motors by bollards), ${this.lanes.length} lanes, ${this.spawnN} spawn points, ${this.stops.length} bus stops on ${this.stopLanes} lanes, ranks ${this.ranks.map((r) => r.name + ' ' + r.slots.length).join(', ')}`);
  }

  rand() { this._seed = (this._seed * 16807) % 2147483647; return this._seed / 2147483647; }

  // ------------------------------------------------------------ graph
  _build(map) {
    const roads = map.roads.filter((r) => DRIVE.has(r.kind) && r.access !== 'no' && r.access !== 'private' && r.motor_vehicle !== 'no' && r.motor_vehicle !== 'private' && r.pts.length >= 2);
    const key = (p) => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10);
    const use = new Map();
    for (const r of roads) r.pts.forEach((p, i) => { const k = key(p); use.set(k, (use.get(k) || 0) + (i === 0 || i === r.pts.length - 1 ? 2 : 1)); });
    const nodes = (this.nodes = []), nodeMap = new Map(), edges = (this.edges = []), lanes = (this.lanes = []);
    const node = (p) => { const k = key(p); let n = nodeMap.get(k); if (!n) { n = { id: nodes.length, x: p[0], z: p[1], out: [], inl: [], box: undefined, bxF: -1, bxA: [], bxR: [] }; nodeMap.set(k, n); nodes.push(n); } return n; };
    for (const r of roads) {
      let start = 0;
      for (let i = 1; i < r.pts.length; i++) {
        if (i < r.pts.length - 1 && (use.get(key(r.pts[i])) || 0) < 2) continue;
        const pts = r.pts.slice(start, i + 1);
        start = i;
        this._edge(r, pts, node(pts[0]), node(pts[pts.length - 1]));
      }
    }
    for (const e of edges) {
      const ow = e.road.oneway;
      if (ow !== '-1') { const l = { e, dir: 1, from: e.a, to: e.b, id: lanes.length }; lanes.push(l); e.a.out.push(l); e.lanes.push(l); }
      if (ow !== 'yes' && ow !== 'true' && ow !== '1') { const l = { e, dir: -1, from: e.b, to: e.a, id: lanes.length }; lanes.push(l); e.b.out.push(l); e.lanes.push(l); }
    }
    for (const l of lanes) l.to.inl.push(l);
    for (const l of lanes) {
      const e = l.e, n = e.xs.length;
      // travel directions at the start and end of the lane
      const sx = e.xs[1] - e.xs[0], sz = e.zs[1] - e.zs[0], sl = Math.hypot(sx, sz) || 1;
      const ex = e.xs[n - 1] - e.xs[n - 2], ez = e.zs[n - 1] - e.zs[n - 2], el = Math.hypot(ex, ez) || 1;
      if (l.dir > 0) { l.sdx = sx / sl; l.sdz = sz / sl; l.edx = ex / el; l.edz = ez / el; }
      else { l.sdx = -ex / el; l.sdz = -ez / el; l.edx = -sx / sl; l.edz = -sz / sl; }
      l.len = e.len; l.main = e.main; l.bus = e.bus; l.vmax = e.vmax;
      l.off = e.oneway ? 0 : e.w >= 8 ? e.w / 4 : Math.min(0.95, e.w * 0.15);   // keep left
      l.bikeOff = Math.max(l.off + 0.6, e.w / 2 - 1.1);
    }
    // room actually free either side of the centre line (2026-11 motion pass): mapped widths are defaults (residential
    // 6.5 m) and buildings / walls often stand inside them (Magpie Lane, Turl Street). Measured once from the collider's
    // solid segments (rays across the road every 1.5 m); lanes too narrow for a car / a bus are left to the bikes, and the
    // kept-left lines are pulled in to clear the walls (per agent radius: clampOff)
    this._freeWidths();
    for (const l of lanes) { l.qF = -1; l.qS = 0; l.qA = null; l.arcK = null; l.run = null; l.rd = 0; l.wetBike = false; }     // (per-frame queue tail + who, corner cache, single-track run: declared here, same shape)
    this._laneRoom();
    // mapped bollards / barriers standing in a carriageway close it to motor traffic (Turl Street, Magpie Lane, East
    // Avenue...): cyclists ride through, cars and buses route round
    this.bollarded = 0;
    for (const g of map.gates || []) {
      if (!/^(bollard|block|cycle_barrier|lift_gate|gate|swing_gate|chain)$/.test(g.kind)) continue;
      if (g.kind !== 'bollard' && g.kind !== 'block' && g.kind !== 'cycle_barrier' && (g.access === 'yes' || g.motor_vehicle === 'yes' || !g.access)) continue;      // (an open gateway is not a closure)
      if (g.motor_vehicle === 'yes' || g.access === 'yes') continue;
      const gx = g.p[0], gz = g.p[1];
      for (const e of edges) {
        if (e.closedMotor) continue;
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (let i = 0; i < e.xs.length; i++) { x0 = Math.min(x0, e.xs[i]); x1 = Math.max(x1, e.xs[i]); z0 = Math.min(z0, e.zs[i]); z1 = Math.max(z1, e.zs[i]); }
        const hw = e.w / 2 + 0.3; if (gx < x0 - hw || gx > x1 + hw || gz < z0 - hw || gz > z1 + hw) continue;
        for (let i = 0; i < e.xs.length - 1; i++) {
          const ax = e.xs[i], az = e.zs[i], dx = e.xs[i + 1] - ax, dz = e.zs[i + 1] - az, L2 = dx * dx + dz * dz;
          const t = clamp(L2 ? ((gx - ax) * dx + (gz - az) * dz) / L2 : 0, 0, 1);
          if (Math.hypot(gx - ax - dx * t, gz - az - dz * t) < hw) { e.closedMotor = true; for (const l of e.lanes) { l.noCar = true; l.noBus = true; } this.bollarded++; break; }
        }
      }
    }
    for (const e of edges) { if (e.closedMotor === undefined) e.closedMotor = false; if (e.narrow === undefined) e.narrow = false; if (e.closed === undefined) e.closed = 0; e.run = null; }
    this._runs();
    this._deadRuns(); this._deadEnds();
    // where the kerbside line would be in the water (rivers mapped wider than their bridges) ride on the car line
    for (const l of lanes) {
      let near = false;
      for (let s = 0; s <= l.len + 2 && !near; s += 3) { this.lanePos(l, Math.min(s, l.len), l.bikeOff, _o); near = this.water.isWater(_o.x, _o.z) || this.water.isWater(_o.x + 3, _o.z) || this.water.isWater(_o.x - 3, _o.z) || this.water.isWater(_o.x, _o.z + 3) || this.water.isWater(_o.x, _o.z - 3); }
      if (near) for (let s = 0; s <= l.len; s += 0.3) {
        this.lanePos(l, Math.min(s, l.len), l.bikeOff, _o);
        if (this.water.isWet(_o.x, _o.z)) { l.bikeOff = l.off; l.wetBike = true; break; }
      }
    }
    // spawn points every ~30 m along lanes, bucketed in a 50 m grid
    this.sgrid = new Map(); this.spawnN = 0;
    for (const l of lanes) {
      if (l.len < 14) continue;
      for (let s = 7; s < l.len - 6; s += 30) {
        this.lanePos(l, s, l.off, _o);
        const k = Math.floor(_o.x / 50) * 65536 + Math.floor(_o.z / 50);
        let a = this.sgrid.get(k); if (!a) this.sgrid.set(k, (a = [])); a.push({ l, s }); this.spawnN++;
      }
    }
    this._near = []; this._nearAt = { x: 1e9, z: 1e9 };
  }

  _freeWidths() {
    const col = this.game.worldCollider;
    for (const e of this.edges) {
      const cap = e.w / 2 + 0.2, n = e.xs.length;
      let fl = cap, fr = cap;
      if (e.road.tunnel || e.road.covered) { e.freeL = fl; e.freeR = fr; continue; }
      const s0 = e.len > 8 ? 2 : e.len * 0.25, s1 = e.len - s0;
      for (let s = s0; s <= s1 + 1e-6; s += Math.max(0.75, Math.min(1.5, (s1 - s0) / 2 || 1.5))) {
        // point and unit left normal at arc length s
        let i = 0; while (i < n - 2 && e.cum[i + 1] < s) i++;
        const sl = e.cum[i + 1] - e.cum[i] || 1e-6, t = (s - e.cum[i]) / sl, x = e.xs[i] + (e.xs[i + 1] - e.xs[i]) * t, z = e.zs[i] + (e.zs[i + 1] - e.zs[i]) * t;
        const dx = (e.xs[i + 1] - e.xs[i]) / sl, dz = (e.zs[i + 1] - e.zs[i]) / sl, nx = dz, nz = -dx, L = cap + 0.6;
        const tl = col.raycast(x, z, x + nx * L, z + nz * L), tr = col.raycast(x, z, x - nx * L, z - nz * L);
        if (tl !== null) fl = Math.min(fl, tl * L); if (tr !== null) fr = Math.min(fr, tr * L);
        if (s1 - s0 < 1e-6) break;
      }
      e.freeL = fl; e.freeR = fr;
    }
    for (const l of this.lanes) { l.freeL = l.dir > 0 ? l.e.freeL : l.e.freeR; l.freeR = l.dir > 0 ? l.e.freeR : l.e.freeL; }
  }
  /** each lane's kept-left / cycle lines and whether a car / a bus fits, from the free widths (at build, and again when
   *  vehicles.js has parked the kerbside rows: parkedRoom) */
  _laneRoom() {
    for (const l of this.lanes) {
      const e = l.e;
      l.freeL = l.dir > 0 ? e.freeL : e.freeR; l.freeR = l.dir > 0 ? e.freeR : e.freeL;
      l.off = e.oneway ? 0 : e.w >= 8 ? e.w / 4 : Math.min(0.95, e.w * 0.15);   // keep left
      l.bikeOff = Math.max(l.off + 0.6, e.w / 2 - 1.1);
      l.off = Math.min(l.off, Math.max(0, l.freeL - 1.05));
      // (a parked row on the kerb side: the line moves out past the middle, as far as the other side's room allows)
      if (e.parkedN && l.freeL < 1.05) l.off = Math.max(l.freeL - 1.05, Math.min(0, -(l.freeR - 1.05)), (l.freeL - l.freeR) / 2);
      l.bikeOff = Math.min(l.bikeOff, l.freeL - 0.55);
      if (l.wetBike) l.bikeOff = l.off;
      l.noCar = l.freeL + l.freeR < 2.35 || e.w < 3 || !!e.closedMotor; l.noBus = l.freeL + l.freeR < 3.0 || !!e.closedMotor;
      e.narrow = !e.oneway && l.freeL + l.freeR < 4.7;          // two-way but no room for two cars side by side: one at a time
    }
  }
  /** a single-track run that is a dead end for motor traffic (Blue Boar Street: Bear Lane beyond is bollarded) is not
   *  driven into: a car would have to turn round at the end, into whoever followed it in (l.deadRun: going this way
   *  along the run leads to it) */
  _deadRuns() {
    for (const l of this.lanes) l.deadRun = false;
    for (const R of this.runs) for (const d of [1, -1]) {
      let dead = false;
      for (const e of R.edges) for (const l of e.lanes) if (l.rd === d && !(l.to.out.some((o) => o.e !== l.e && !o.noCar && o.run !== R) || l.to.out.some((o) => o.e !== l.e && o.run === R))) dead = true;
      if (dead) for (const e of R.edges) for (const l of e.lanes) if (l.rd === d) l.deadRun = true;
    }
  }
  /**
   * The street parking (busy-streets pass, 2026-11): vehicles.js lays its kerbside rows, echelon bays and centre bays
   * after we are built, so each edge's free width is narrowed here by the parked cars standing on it (their corners
   * across the edge: the inner edge of a row, less 15 cm, 40 cm for bays), and the lanes, single-track runs and bus stop lines are
   * worked out again. A street parked down one side becomes one-at-a-time where two cars no longer pass; one parked
   * across the middle (Broad Street's centre bays) is closed to motor traffic and cyclists. Deterministic (a function of
   * the map). cars: [{type, x, z, h, road?}] (road: the way it is parked along, when known)
   */
  parkedRoom(cars) {
    if (!cars || !cars.length) return 0;
    const C = 24, grid = new Map(), key = (cx, cz) => cx * 65536 + cz;
    for (const e of this.edges) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < e.xs.length; i++) { x0 = Math.min(x0, e.xs[i]); x1 = Math.max(x1, e.xs[i]); z0 = Math.min(z0, e.zs[i]); z1 = Math.max(z1, e.zs[i]); }
      const m = e.w / 2 + 4;
      for (let cx = Math.floor((x0 - m) / C); cx <= Math.floor((x1 + m) / C); cx++) for (let cz = Math.floor((z0 - m) / C); cz <= Math.floor((z1 + m) / C); cz++) { let a = grid.get(key(cx, cz)); if (!a) grid.set(key(cx, cz), (a = [])); a.push(e); }
    }
    const P = [[0, 0], [0, 0], [0, 0], [0, 0]], seen = new Set();
    let touched = 0, blocked = 0;
    for (const q of cars) {
      const T = TYPES[q.type]; if (!T) continue;
      const fx = Math.sin(q.h), fz = Math.cos(q.h), hl = T.L / 2, hw = T.W / 2;
      for (let k = 0; k < 4; k++) { const u = k < 2 ? hl : -hl, v = k % 2 ? hw : -hw; P[k][0] = q.x + fx * u + fz * v; P[k][1] = q.z + fz * u - fx * v; }
      seen.clear();
      for (const e of grid.get(key(Math.floor(q.x / C), Math.floor(q.z / C))) || []) {
        if (seen.has(e)) continue; seen.add(e);
        if (e.road.tunnel || e.road.covered || (q.road && q.road !== e.road.id)) continue;     // (only the street it is parked on)
        // the car's middle: on this edge (not past either end of it) and within its drawn width
        const c = this._project(e, q.x, q.z);
        if (c.s < 0.3 || c.s > e.len - 0.3 || Math.abs(c.lat) > e.w / 2 + 0.6) continue;
        // (the corners across the edge's normal where the car stands: projecting each corner on a curving street bent
        // a straight car's ends across the middle line)
        const cl = c.lat, nx = c.nx, nz = c.nz;
        let lo = Infinity, hi = -Infinity;
        for (let k = 0; k < 4; k++) { const l = cl + (P[k][0] - q.x) * nx + (P[k][1] - q.z) * nz; lo = Math.min(lo, l); hi = Math.max(hi, l); }
        if (e.free0 === undefined) e.free0 = e.freeL + e.freeR;
        const mg = q.bay ? 0.4 : 0.15;          // (echelon / centre bays: a nose sticking out on a bend, a door opened)
        if (lo > 0) e.freeL = Math.min(e.freeL, lo - mg);
        else if (hi < 0) e.freeR = Math.min(e.freeR, -hi - mg);
        else { e.freeL = Math.min(e.freeL, -0.1); e.freeR = Math.min(e.freeR, -0.1); }
        if (!e.parkedN) touched++;
        e.parkedN = (e.parkedN || 0) + 1;
      }
    }
    // a carriageway with no room left for anything (parked across the middle): closed to everyone (cyclists too)
    for (const e of this.edges) if (e.parkedN && e.freeL + e.freeR < 1.2 && e.free0 >= 1.2 && !e.parkClosed) { e.parkClosed = true; blocked++; }
    this._laneRoom();
    for (const e of this.edges) e.run = null;
    for (const l of this.lanes) { l.run = null; l.rd = 0; }
    this._runs(); this._deadRuns(); this._deadEnds();
    for (const l of this.lanes) if (l.stops) l.stopOff = l.e.oneway ? Math.max(0, l.e.w / 2 - 1.5) : Math.max(l.off, l.e.w / 2 - 1.45);
    this.parked = { edges: touched, closed: blocked, cars: cars.length };
    return touched;
  }
  /** arc length s, signed distance lat (left of the drawn direction +) of (x, z) from edge e's nearest point, and that
   *  segment's left normal (nx, nz) */
  _project(e, x, z) {
    let bd = Infinity, bs = 0, bl = 0;
    for (let i = 0; i < e.xs.length - 1; i++) {
      const ax = e.xs[i], az = e.zs[i], dx = e.xs[i + 1] - ax, dz = e.zs[i + 1] - az, L = Math.hypot(dx, dz) || 1e-6;
      const tr = ((x - ax) * dx + (z - az) * dz) / (L * L), t = clamp(tr, 0, 1), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
      if (d < bd) {
        bd = d; bl = (x - ax) * (dz / L) + (z - az) * (-dx / L); _pj.nx = dz / L; _pj.nz = -dx / L;
        bs = e.cum[i] + tr * L;      // (unclamped at the two ends: a point past the end of the edge reads s < 0 / s > len)
        if (i > 0 && tr < 0) bs = e.cum[i]; if (i < e.xs.length - 2 && tr > 1) bs = e.cum[i + 1];
      }
    }
    _pj.s = bs; _pj.lat = bl;
    return _pj;
  }
  /** the kept-left line of agent a on lane l: the cycle line, the car line, or (a bus on a narrow two-way street) its own,
   *  nearer the kerb, so two big vehicles passing do not need the middle of the road */
  laneOff(a, l) {
    if (a.kind === 'bike') return l.bikeOff;
    if (a.type === 'bus' && !l.e.oneway && l.e.w < 8) return Math.max(l.off, Math.min(l.freeL, l.e.w / 2) - a.radius - 0.45);
    return l.off;
  }
  /** a lateral offset (travel-left +) agent a can hold on lane l without its side in a wall */
  clampOff(a, l, off) {
    const hi = l.freeL - a.radius - 0.12, lo = -(l.freeR - a.radius - 0.12);
    return lo > hi ? (lo + hi) / 2 : off < lo ? lo : off > hi ? hi : off;
  }

  // ------------------------------------------------------------ junction boxes and single-track runs (2026-11 gridlock pass)
  // The corridor rules (_scan) keep each vehicle off whatever is in front of it, but at a junction that is too late: two
  // that both start a turn meet in the middle (a bus swinging round the Carfax bend into the queue coming the other way,
  // each in the other's corridor, a queue behind each: neither can back off). So, as a traffic engineer would: a vehicle
  // only enters the conflict area of a junction once it is free of every movement that crosses its own (turn
  // reservations), waits at the stop line where its path first comes near the other's, and the longest waiter goes next
  // (no starvation, a fixed tie-break, so every cycle has exactly one agent allowed to go). A two-way street too narrow to
  // pass in is one-way-at-a-time from end to end (a run), counting cyclists where a car and a bike cannot pass either.
  /**
   * Dead ends for motor traffic (2026-11-21, "the city moves at this density"): a lane is dead when going on from its end
   * there is no way a car may take (see choose: no U-turn, nothing closed / too narrow / parked across / a one-at-a-time
   * dead run / a short stub) that is not itself dead — a cul-de-sac, or a pocket cut off by a stretch no car fits through
   * (Turl Street: its middle is too narrow between the walls, so each end is a pocket), or by a road closed for an event.
   * Cars are not sent into one and are not made in one: each used to drive to the end and turn round at walking pace
   * into whoever had followed it in, and with the same number of cars on every graphics tier the queues behind those
   * turn-rounds were the largest single loss of speed in the centre (tools/audit_motion.mjs --why: Turl Street alone
   * 0.5 m/s off the mean car). A road that leaves the map (a main road, or any road ending near the map's edge) is a way
   * out, not a dead end. Worked out again when the parked rows or a closure change the streets.
   */
  _deadEnds() {
    const L = this.lanes, B = this.game.map && this.game.map.bounds, M = 100;
    const ok = (l, o) => !(o.e === l.e && o.dir === -l.dir) && !o.e.closed && !o.e.parkClosed && !o.noCar && !(o.deadRun && o.run !== l.run) && !(o.len < 30 && stubEnd(o));
    const wayOut = (l) => { const n = l.to; return MAIN.has(l.e.kind) || (!!B && (n.x < B.minX + M || n.x > B.maxX - M || n.z < B.minZ + M || n.z > B.maxZ - M)); };
    for (const l of L) { l.dead = false; l._exit = wayOut(l) && !l.e.closed && !l.e.parkClosed; }
    let changed = true, pass = 0, n = 0;
    while (changed && pass++ < 600) {
      changed = false;
      for (const l of L) {
        if (l.dead) continue;
        const out = l.to.out; let live = false, any = false;
        for (let i = 0; i < out.length && !live; i++) { const o = out[i]; if (!ok(l, o)) continue; any = true; if (!o.dead) live = true; }
        if (!live && !(l._exit && !any)) { l.dead = true; changed = true; n++; }
      }
    }
    this.deadLanes = n;
    return n;
  }
  /** single-track runs: consecutive narrow two-way edges joined at nodes where nothing else meets; R.F = the narrowest free
   *  width along it; each lane knows its run and which way along it it goes (l.rd = +-1) */
  _runs() {
    this.runs = [];
    const cand = (e) => !e.oneway && !e.closedMotor && e.lanes.length === 2 && e.lanes[0].freeL + e.lanes[0].freeR < RUN_F;
    const edgesAt = (n) => { const s = new Set(); for (const l of n.out) s.add(l.e); for (const l of n.inl) s.add(l.e); return s; };
    for (const e0 of this.edges) {
      if (e0.run || !cand(e0)) continue;
      const R = { id: this.runs.length, F: Infinity, Fp: false, edges: [], occF: -1, np: 0, nm: 0, rp: 0, rm: 0, ap: null, am: null, clF: -1, clD: 0, clR: 0, clW: 0, clA: null };
      this.runs.push(R);
      const stack = [[e0, 1]]; e0.run = R;              // (orientation +1: the way e0 is drawn)
      while (stack.length) {
        const [e, o] = stack.pop();
        R.edges.push(e); R.F = Math.min(R.F, e.lanes[0].freeL + e.lanes[0].freeR);
        for (const l of e.lanes) { l.run = R; l.rd = l.dir * o; }
        for (const [n, atEnd] of [[e.a, false], [e.b, true]]) {
          if (e.a === e.b) continue;
          const es = edgesAt(n); if (es.size !== 2) continue;
          const eOut = atEnd ? o : -o;                    // +1: going the run's way leaves e through n
          for (const f of es) if (f !== e && !f.run && cand(f)) { f.run = R; stack.push([f, (f.a === n ? 1 : -1) * eOut]); }
        }
      }
    }
  }
  /** the junction box of node n (built the first time someone comes near): its movements (lane in -> lane out, no U-turn);
   *  which pairs conflict is worked out per pair and vehicle class on first use (_pair). null: fewer than two movements */
  _box(n) {
    if (n.box !== undefined) return n.box;
    const mv = [];
    for (const i of n.inl) for (const o of n.out) if (o.e !== i.e) mv.push({ i, o, k: mv.length, p: [null, null, null] });
    if (mv.length < 2) return (n.box = null);
    const M = mv.length, idx = new Map();
    for (const m of mv) idx.set(m.i.id * 65536 + m.o.id, m.k);
    // (yellow box: how far into a lane out the junction reaches: half the widest road meeting here, and a margin)
    let w = 0; for (const l of n.out) w = Math.max(w, l.e.w); for (const l of n.inl) w = Math.max(w, l.e.w);
    return (n.box = { mv, M, idx, clear: w / 2 + 1.5, pc: new Uint8Array(M * M * 9).fill(255), pe: new Float32Array(M * M * 9), px: new Float32Array(M * M * 9) });
  }
  /** the swept footprint of movement m for vehicle class c (0 cyclist, 1 car: a van, the longest; 2 bus): a vehicle of
   *  that class driven through it alone by _drive itself (no traffic, no stops), its drawn box sampled every 0.5 m from
   *  BOXL + its length + 4 m before the node to BOXL + its length after: [x, z, sin h, cos h, s, edge id * 2 + lined up]
   *  (s: where its middle is along the movement, 0 at the node, negative before). So the conflicts are those of the paths really driven: a bus swinging its nose over the
   *  crown of the Carfax bend, a van coming out of a 3 m lane wide across the road it turns into. Deterministic (the
   *  random stream is put back); allocation only here, once per movement and class; at most GHOSTS a frame */
  _sweep(m, c) {
    if (m.p[c]) return m.p[c];
    if (this._ghostF !== this._frame) { this._ghostF = this._frame; this._ghostN = 0; }
    if (this._ghostN >= GHOSTS) return null;
    this._ghostN++;
    const type = GHOST[c], T = TYPES[type], i = m.i, o = m.o, seed = this._seed, uid = this._uid;
    // (the window grows with the vehicle: a bus's nose is still swinging 20 m on)
    const ext = BOXL + 2 * (T.L / 2) + 4, s0 = Math.max(0, i.len - ext), off = this.clampOff(PROXY[c], i, this.laneOff(PROXY[c], i));
    this.lanePos(i, s0, off, _q);
    const a = this._agent(type, null, i, s0, off, _q.x, _q.z, Math.atan2(_q.dx, _q.dz));
    this._seed = seed; this._uid = uid;
    a.next = o; a.next2 = null; a.speed = Math.min(T.kind === 'bike' ? a.pref : i.vmax * a.pref, 7);
    const out = [], end = Math.min(o.len, BOXL + T.L), clear = i.to.box ? i.to.box.clear : 5;
    let lx = 1e9, lz = 1e9;
    this._ghost = true;
    try {
      for (let k = 0; k < 900 && a.lane; k++) {
        this._drive(a, 1 / 20, GHOST_WP, null);
        if (a.bye || (a.lane !== i && a.lane !== o)) break;
        if (Math.abs(a.x - lx) + Math.abs(a.z - lz) > 0.5) {
          // (and whether it is lined up with its lane there: two vehicles lined up in the two lanes of one street are
          // passing each other - the corridor's and the runs' business, not the junction's)
          lx = a.x; lz = a.z; this.lanePos(a.lane, a.s, 0, _q2);
          const sr = a.lane === o ? a.s : a.s - i.len, al = Math.abs(sr) > clear + a.half && Math.sin(a.heading) * _q2.dx + Math.cos(a.heading) * _q2.dz > 0.993;
          out.push(a.x, a.z, Math.sin(a.heading), Math.cos(a.heading), a.lane === o ? a.s : a.s - i.len, (a.lane === o ? o.e.id : i.e.id) * 2 + (al ? 1 : 0));
        }
        if (a.lane === o && a.s > end) break;
      }
    } finally { this._ghost = false; }
    return (m.p[c] = { S: Float64Array.from(out), n: out.length / 6, hl: a.dl, hw: a.dw, front: a.half + a.radius });
  }
  /** pair (movement a, class ca) x (movement b, class cb) of box B: index k (-1: a sweep is over this frame's budget, try
   *  again next frame). B.pc[k] = 1 when their sweeps come within 0.35 m of each other; then B.pe[k] = how far before the
   *  node b's front must stay (its first pose near any of a's), B.px[k] = how far into its lane out a's middle must be
   *  before b may go (its last pose near any of b's) */
  _pair(B, a, b, ca, cb) {
    const k = ((a * B.M + b) * 3 + ca) * 3 + cb;
    if (B.pc[k] !== 255) return k;
    const ma = B.mv[a], mb = B.mv[b];
    let hit = 0, entry = 0, exit = -1e9;
    if (ma.i !== mb.i) {            // (following on the same lane in: the corridor rule's business)
      const P = this._sweep(ma, ca), Q = this._sweep(mb, cb);
      if (!P || !Q) return -1;
      const PS = P.S, QS = Q.S, reach = P.hl + P.hw + Q.hl + Q.hw + 0.35;
      // (stop lines with 2 m to spare: the vehicle really there is never quite where its ghost was)
      for (let j = 0; j < Q.n && !hit; j++) for (let q = 0; q < P.n; q++) if (nearBox(PS, q, P, QS, j, Q, reach)) { hit = 1; entry = 2 - QS[j * 6 + 4] - Q.front; break; }
      if (hit) {
        for (let q = P.n - 1; q >= 0 && exit === -1e9; q--) for (let j = 0; j < Q.n; j++) if (nearBox(PS, q, P, QS, j, Q, reach)) { exit = PS[q * 6 + 4] + 1; break; }
        if (ma.o === mb.o) exit = Math.min(exit, 2 * P.front + 1);      // merging into the same lane: once the first is in it, the next may follow
      }
    }
    B.pc[k] = hit; B.pe[k] = entry; B.px[k] = exit;
    return k;
  }

  _edge(road, pts, a, b) {
    const n = pts.length, xs = new Float64Array(n), zs = new Float64Array(n), cum = new Float64Array(n), nx = new Float64Array(n), nz = new Float64Array(n);
    for (let i = 0; i < n; i++) { xs[i] = pts[i][0]; zs[i] = pts[i][1]; if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]); }
    const len = cum[n - 1];
    if (len < 0.05) return;
    // left normals, mitred at the vertices
    const sn = [];
    for (let i = 0; i < n - 1; i++) { const dx = xs[i + 1] - xs[i], dz = zs[i + 1] - zs[i], l = Math.hypot(dx, dz) || 1; sn.push([dz / l, -dx / l]); }
    for (let i = 0; i < n; i++) {
      const p = sn[Math.max(0, i - 1)], q = sn[Math.min(n - 2, i)];
      let mx = p[0] + q[0], mz = p[1] + q[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      const k = 1 / Math.max(0.6, mx * q[0] + mz * q[1]);
      nx[i] = mx * k; nz[i] = mz * k;
    }
    const ow = road.oneway === 'yes' || road.oneway === 'true' || road.oneway === '1' || road.oneway === '-1';
    const e = { id: this.edges.length, road, kind: road.kind, name: road.name || '', w: road.w || 6.5, xs, zs, cum, nx, nz, len, a, b, lanes: [],
      main: MAIN.has(road.kind), bus: MAIN.has(road.kind) || BUS_NAMES.has(road.name), vmax: SPEED[road.kind] || 8.9, oneway: ow, bridge: !!road.bridge };
    this.edges.push(e);
  }

  /** Bus stops (map pois kind 'bus_stop') projected onto the bus lanes whose kerb (travel-left) side they are on. */
  _buildStops(map) {
    this.stops = []; this.stopLanes = 0;
    const grid = new Map();
    for (const p of map.pois) {
      if (p.kind !== 'bus_stop') continue;
      const st = { id: this.stops.length, x: p.p[0], z: p.p[1], name: p.name || '' };
      this.stops.push(st);
      const k = Math.floor(st.x / 40) * 65536 + Math.floor(st.z / 40);
      let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(st);
    }
    this._stopGrid = grid;
    // (only lanes on the bus network: putting buses on every street with a mapped stop served 14 more stops but sent them
    // round corners whose furniture they sweep - tools/audit_placement.mjs "sweep")
    for (const l of this.lanes) {
      if (!l.bus || l.noBus || l.e.closedMotor) continue;
      const e = l.e, found = [];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < e.xs.length; i++) { x0 = Math.min(x0, e.xs[i]); x1 = Math.max(x1, e.xs[i]); z0 = Math.min(z0, e.zs[i]); z1 = Math.max(z1, e.zs[i]); }
      const reach = e.w / 2 + 7;
      for (let cx = Math.floor((x0 - reach) / 40); cx <= Math.floor((x1 + reach) / 40); cx++) for (let cz = Math.floor((z0 - reach) / 40); cz <= Math.floor((z1 + reach) / 40); cz++) {
        const a = grid.get(cx * 65536 + cz); if (!a) continue;
        for (const st of a) {
          // nearest point on the edge polyline: arc length u and signed distance d (left normal of the drawn direction)
          let bd = Infinity, bu = 0, bs = 0;
          for (let i = 0; i < e.xs.length - 1; i++) {
            const ax = e.xs[i], az = e.zs[i], dx = e.xs[i + 1] - ax, dz = e.zs[i + 1] - az, L = Math.hypot(dx, dz) || 1e-6;
            const t = clamp(((st.x - ax) * dx + (st.z - az) * dz) / (L * L), 0, 1), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(st.x - qx, st.z - qz);
            if (d < bd) { bd = d; bu = e.cum[i] + t * L; bs = ((st.x - qx) * (dz / L) + (st.z - qz) * (-dx / L)) >= 0 ? 1 : -1; }
          }
          if (bd > reach || bs * l.dir < 0 && !e.oneway) continue;                    // the other carriageway's stop
          const s = l.dir > 0 ? bu : e.len - bu;
          if (s < 4 || s > l.len - 2) continue;
          found.push({ s, id: st.id });
        }
      }
      if (found.length) { found.sort((p, q) => p.s - q.s); l.stops = found; this.stopLanes++; if (!l.bus) { this.stopStreets = (this.stopStreets || 0) + 1; for (const m of e.lanes) m.bus = true; e.bus = true; } }
      l.stopOff = e.oneway ? Math.max(0, e.w / 2 - 1.5) : Math.max(l.off, e.w / 2 - 1.45);
    }
  }
  nearBusStop(x, z, r = 8) {
    let best = null, bd = r;
    const cx = Math.floor(x / 40), cz = Math.floor(z / 40);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this._stopGrid.get((cx + i) * 65536 + (cz + j)); if (!a) continue;
      for (const st of a) { const d = Math.hypot(st.x - x, st.z - z); if (d < bd) { bd = d; best = st; } }
    }
    return best;
  }

  /** Taxi rank slots: queued back from the rank point along its road, each checked clear of walls and water. */
  _buildRanks(map) {
    const col = this.game.worldCollider;
    this.ranks = [];
    for (const R of RANKS) {
      const road = map.roads.find((r) => r.id === R.road);
      const rk = { name: R.name, source: R.source, x: R.p[0], z: R.p[1], slots: [] };
      this.ranks.push(rk);
      if (!road) continue;
      // direction of the road at the rank point
      let bd = Infinity, dx = 0, dz = 1;
      for (let i = 0; i < road.pts.length - 1; i++) {
        const a = road.pts[i], b = road.pts[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1e-6;
        const t = clamp(((R.p[0] - a[0]) * ex + (R.p[1] - a[1]) * ez) / (L * L), 0, 1), d = Math.hypot(R.p[0] - a[0] - ex * t, R.p[1] - a[1] - ez * t);
        if (d < bd) { bd = d; dx = ex / L; dz = ez / L; }
      }
      const h = Math.atan2(dx, dz);
      // (a guessed rank stands at the kerb, clear of the running lane: the queue is shifted to the side of the road it is on)
      let sx = 0, sz = 0;
      if (/GUESS/.test(R.source)) {
        const w = road.w || 6.5, nx = dz, nz = -dx;
        let bd2 = Infinity, cx = R.p[0], cz = R.p[1];
        for (let i = 0; i < road.pts.length - 1; i++) {
          const a = road.pts[i], b = road.pts[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1e-6;
          const t = clamp(((R.p[0] - a[0]) * ex + (R.p[1] - a[1]) * ez) / (L * L), 0, 1), qx = a[0] + ex * t, qz = a[1] + ez * t, d2 = (qx - R.p[0]) ** 2 + (qz - R.p[1]) ** 2;
          if (d2 < bd2) { bd2 = d2; cx = qx; cz = qz; }
        }
        const sd = ((R.p[0] - cx) * nx + (R.p[1] - cz) * nz) >= 0 ? 1 : -1, want = w / 2 - TYPES.taxi.W / 2 - 0.15;
        sx = cx + nx * sd * want - R.p[0]; sz = cz + nz * sd * want - R.p[1];
      }
      for (let i = 0, k = 0; i < 7 && rk.slots.length < 4; i++) {
        const x = R.p[0] + sx - dx * 5.6 * i, z = R.p[1] + sz - dz * 5.6 * i;
        let ok = !this.water.isWet(x, z);
        for (const o of [-1.7, 0, 1.7]) if (ok && !col.isFree(x + dx * o, z + dz * o, 0.85)) ok = false;
        if (ok && rk.slots.length && col.raycast(rk.slots[rk.slots.length - 1].x, rk.slots[rk.slots.length - 1].z, x, z) !== null) ok = false;
        if (ok) rk.slots.push({ x, z, h, i: k++, agent: null });
      }
    }
  }

  /** Position on a lane at distance s, offset to the travel-left by `off`. Writes {x,z,dx,dz,i} into out. */
  lanePos(l, s, off, out) {
    const e = l.e, cum = e.cum, n = cum.length;
    let u = l.dir > 0 ? s : e.len - s; u = u < 0 ? 0 : u > e.len ? e.len : u;
    let lo = 0, hi = n - 2;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= u) lo = mid; else hi = mid - 1; }
    const i = lo, sl = cum[i + 1] - cum[i] || 1e-6, t = (u - cum[i]) / sl;
    const dx = (e.xs[i + 1] - e.xs[i]) / sl, dz = (e.zs[i + 1] - e.zs[i]) / sl;
    const nx = e.nx[i] + (e.nx[i + 1] - e.nx[i]) * t, nz = e.nz[i] + (e.nz[i + 1] - e.nz[i]) * t;
    out.x = e.xs[i] + (e.xs[i + 1] - e.xs[i]) * t + nx * off * l.dir;
    out.z = e.zs[i] + (e.zs[i + 1] - e.zs[i]) * t + nz * off * l.dir;
    out.dx = dx * l.dir; out.dz = dz * l.dir; out.i = i;
    // distance to the next vertex in travel direction + turn angle there (for slowing on bends)
    if (l.dir > 0) { out.toV = cum[i + 1] - u; out.vi = i + 1; } else { out.toV = u - cum[i]; out.vi = i; }
    return out;
  }
  /** Turn angle (radians) at vertex vi of an edge for travel in lane direction. */
  bend(l, vi) {
    const e = l.e, n = e.xs.length;
    if (vi <= 0 || vi >= n - 1) return 0;
    const ax = e.xs[vi] - e.xs[vi - 1], az = e.zs[vi] - e.zs[vi - 1], bx = e.xs[vi + 1] - e.xs[vi], bz = e.zs[vi + 1] - e.zs[vi];
    const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
    return Math.acos(clamp((ax * bx + az * bz) / (la * lb), -1, 1));
  }

  /** lanePos, carried on in a straight line before the start (s < 0) and beyond the end (s > len) of the lane. */
  lanePosX(l, s, off, out) {
    this.lanePos(l, s, off, out);
    if (s > l.len) { const d = s - l.len; out.x += out.dx * d; out.z += out.dz * d; }
    else if (s < 0) { out.x += out.dx * s; out.z += out.dz * s; }
    return out;
  }
  /**
   * The corner between lane l (ridden at offset `off`) and the lane n that follows it. J.u = where the two lane lines meet,
   * as a distance beyond the end of l (negative: before the node, a left turn); J.w = the same point as a distance along n;
   * J.b = the offset to take on n (carried over when going more or less straight on, n's own keep-left offset after a real
   * turn). The corner is rounded by an arc of radius J.r tangent to both lines, J.t metres either side of the corner point
   * (J.t = 0: no arc), centre (ox, oz), start spoke (vx, vz), swept angle J.th (+ = clockwise from above = a right turn).
   * The radius suits the vehicle, shrunk to fit short lanes and, turning left, the room inside the corner. Cached per agent.
   */
  _junc(a, J, l, off, n) {
    if (J.l === l && J.n === n && Math.abs(J.o - off) < 0.06) return J;     // (an offset still easing over by a few cm: same corner)
    J.l = l; J.n = n; J.o = off; J.u = 0; J.w = 0; J.t = 0; J.r = 0; J.th = 0;
    const def = this.laneOff(a, n);
    const cr = l.edx * n.sdz - l.edz * n.sdx, dot = l.edx * n.sdx + l.edz * n.sdz;
    J.b = this.clampOff(a, n, dot > 0 && Math.abs(cr) < 0.5 ? Math.min(off, Math.max(def, n.e.w / 2 - a.radius - 0.25)) : def);     // (never into the next street's walls)
    if (n.e === l.e) {
      // dead end: turn round in the road, in a circle that fits between the kept-left side and the far kerb, started early
      // enough that the nose never swings past the end of the road (the canal at Upper Fisher Row)
      const lo = a.kind === 'bike' ? 0.7 : 0.8, nose = a.half + a.radius + 0.4;
      let R = Math.max(lo, Math.min(4, (l.e.w / 2 + off - a.radius - 0.3) / 2));
      for (let k = 0; k < 4; k++) {
        // ... and stays out of the water where a river is mapped over the edge of the road: tighten until it does
        J.u = -Math.min(l.len * 0.9, R + nose);
        this.lanePosX(l, l.len + J.u + R, off - 2 * R - a.radius * 0.5, _q); let wet = this.water.isWet(_q.x, _q.z);
        this.lanePosX(l, l.len + J.u + R + nose, off - R, _q); wet = wet || this.water.isWet(_q.x, _q.z);
        if (!wet || R <= lo) break;
        R = Math.max(lo, R * 0.6);
      }
      a.uR = R; J.w = -J.u;
      return J;
    }
    if (Math.abs(cr) <= 0.05) return J;
    this.lanePos(l, l.len, off, _q); const ax = _q.x, az = _q.z;
    this.lanePos(n, 0, J.b, _q);
    const rx = _q.x - ax, rz = _q.z - az;
    // (a very sharp turn would put the corner point far beyond the junction: never further than the lanes are apart)
    const far = Math.max(Math.abs(off), Math.abs(J.b)) * 1.3 + 0.6;
    const u0 = (rx * n.sdz - rz * n.sdx) / cr, w0 = (rx * l.edz - rz * l.edx) / cr;
    J.u = clamp(u0, -Math.min(far, l.len * 0.9), far);
    J.w = clamp(w0, -far, Math.min(far, n.len * 0.9));
    if (Math.abs(J.u - u0) > 0.3 || Math.abs(J.w - w0) > 0.3) return J;        // a hairpin: no corner point worth the name, so no arc either
    const th = Math.atan2(cr, dot), half = Math.abs(th) / 2, tn = Math.tan(half);
    if (half < 0.06 || half > 1.45) return J;
    let r = a.kind === 'bike' ? 3.2 : a.type === 'bus' ? 9 : a.wb * 2.1;
    // left turn: the kerb is inside the corner, and the middle of a long vehicle tracks inside its front wheels by ~wb^2 / 8r
    if (th < 0) r = Math.min(r, Math.max(0.3, Math.max(0.2, Math.min(Math.min(l.e.w / 2, l.freeL) - Math.abs(off), Math.min(n.e.w / 2, n.freeL) - Math.abs(J.b)) - a.radius) + 1 - (a.wb * a.wb) / (8 * r)) / (1 - Math.cos(half)));
    let t = Math.min(r * tn, 0.45 * (l.len + Math.min(0, J.u)), 0.45 * (n.len - Math.max(0, J.w)), 9);
    const sg = th < 0 ? -1 : 1, cx = ax + l.edx * J.u, cz = az + l.edz * J.u;       // corner point
    // (how far the arc had to be tightened to clear the corner is worked out once per lane pair and vehicle class)
    const col = this.game.worldCollider, rr = a.radius * 0.85, ck = n.id * 4 + (a.kind === 'bike' ? 0 : a.type === 'bus' ? 2 : 1);
    const cache = l.arcK || (l.arcK = new Map()), known = cache.get(ck);
    if (known !== undefined) t *= known;
    for (let k = 0; k < 4; k++) {
      // an arc much tighter than the vehicle can turn is no help (it would circle it): leave the corner sharp; the steering
      // rounds it at a creep with the lock opened (see `tight` in _drive)
      if (t < 0.4 || t / tn < (a.kind === 'bike' ? 1 : a.type === 'bus' ? 4 : a.wb * 0.8)) { J.t = 0; return J; }
      J.t = t; J.r = r = t / tn; J.th = th;
      J.vx = sg * r * l.edz; J.vz = -sg * r * l.edx;                               // from the centre to where the arc leaves lane l
      J.ox = cx - l.edx * t - J.vx; J.oz = cz - l.edz * t - J.vz;
      // (a wide arc cuts the inside of the corner: where that would take us through a building corner, a lamp or a wall,
      // round it tighter, nearer the corner point, which lies on the two kept-left lines)
      if (known !== undefined) break;
      let free = true;
      for (let f = 0.25; f < 0.8 && free; f += 0.25) { this._arc(J, f, _q); _q2.x = _q.x; _q2.z = _q.z; free = !col.resolve(_q2, rr); }
      if (free) { cache.set(ck, Math.pow(0.6, k)); break; }
      t *= 0.6;
      if (k === 3) cache.set(ck, 0);
    }
    return J;
  }
  /** Point at fraction f (0..1) of a corner arc (and the direction of travel there). */
  _arc(J, f, out) {
    const al = J.th * f, c = Math.cos(al), sn = Math.sin(al);
    out.x = J.ox + J.vx * c - J.vz * sn; out.z = J.oz + J.vx * sn + J.vz * c;
    const sg = J.th < 0 ? -1 : 1, il = sg / J.r;
    out.dx = -(J.vx * sn + J.vz * c) * il; out.dz = (J.vx * c - J.vz * sn) * il;
    return out;
  }
  /** How far round a corner arc (0..1, unclamped) the point (x, z) is. */
  _arcF(J, x, z) {
    const px = x - J.ox, pz = z - J.oz;
    return Math.atan2(J.vx * pz - J.vz * px, J.vx * px + J.vz * pz) / J.th;
  }
  /** The point `d` metres further along the agent's path than its own lane position: round the corner it is in, along
   *  this lane, round the next corner, the next lane, the corner after that. */
  _pathPoint(a, d, out) {
    const l = a.lane, n = a.next, P = a.j0;
    let s = a.s + d;
    if (P.t > 0 && s < P.w + P.t) return this._arc(P, (P.t + s - P.w) / (2 * P.t), out);          // still coming out of the last corner
    if (!n || n.e === l.e) return this.lanePosX(l, s, a.off, out);          // dead end: run straight to the end, then turn round
    const J = this._junc(a, a.j1, l, a.off, n), end = l.len + J.u;
    if (s <= end - J.t) return this.lanePosX(l, s, a.off, out);
    if (s < end + J.t) return this._arc(J, (s - end + J.t) / (2 * J.t), out);
    s = J.w + (s - end);
    const m = a.next2;
    if (!m || m.e === n.e) return this.lanePosX(n, s, J.b, out);
    const K = this._junc(a, a.j2, n, J.b, m), end2 = n.len + K.u;
    if (s <= end2 - K.t) return this.lanePosX(n, s, J.b, out);
    if (s < end2 + K.t) return this._arc(K, (s - end2 + K.t) / (2 * K.t), out);
    return this.lanePosX(m, K.w + (s - end2), K.b, out);
  }

  choose(l, agent) {
    const node = l.to, opts = node.out;
    let total = 0, nOK = 0;
    const busOnly = agent.type === 'bus' && opts.some((o) => o.bus && o.e !== l.e);
    for (const o of opts) {
      o._w = 0;
      if (o.e === l.e && o.dir === -l.dir) continue;          // no U-turns unless it's a dead end
      if (o.e.closed || o.e.parkClosed) continue;             // closed for an event (closeRoads), or parked across (parkedRoom)
      if (busOnly && !o.bus) continue;
      if (agent.kind === 'car' && (o.noCar || (agent.type === 'bus' && o.noBus))) continue;      // no room between the walls
      if (agent.kind === 'car' && o.deadRun && o.run !== l.run) continue;                       // (a dead end with room for one)
      if (agent.kind === 'car' && o.dead && !l.dead) continue;                                  // (no way through for a car: _deadEnds)
      // not into a short dead-end stub (a mapped driveway or turning head): there is no room to turn round in it
      // (2026-11-21: "nothing on from its end but back the way it came" - the test used to be "at most one lane out of its
      // end", which is also every short link INTO a one-way street: 17 of them - George Street into Magdalen Street, links
      // on St Giles', Hythe Bridge Street, Worcester Street, Parks Road, Cowley Road - were never taken, and everything
      // that reached the east end of George Street turned round in the junction)
      if (o.len < (agent.kind === 'car' ? 30 : 8) && stubEnd(o)) continue;
      const c = l.edx * o.sdx + l.edz * o.sdz;                // 1 = straight on
      let w = 0.25 + Math.max(0, c) * 2.5;
      if (o.main && agent.kind === 'car') w *= 1.8;
      if (o.e.kind === 'residential' && agent.kind === 'car') w *= 0.6;
      o._w = w; total += w; nOK++;
    }
    if (!nOK) {
      // dead end: turn round if we can
      for (const o of opts) if (o.e === l.e && o.dir === -l.dir) return o;
      return null;
    }
    let r = this.rand() * total;
    for (const o of opts) { if (o._w <= 0) continue; r -= o._w; if (r <= 0) return o; }
    for (const o of opts) if (o._w > 0) return o;
    return null;
  }

  // ------------------------------------------------------------ agents
  _rig(type) {
    const p = this.pool.get(type);
    if (p && p.length) {
      const rig = p.pop();
      if (rig.reroll && rig.rider) {
        // its rider was turfed off and walked away as a pedestrian: a new person rides it now
        rig.reroll = false;
        this._rider(rig, Math.floor(this.rand() * 1e9));
      }
      if (rig.rider) rig.rider.group.visible = true;
      return rig;
    }
    return this._newRig(type);
  }
  _newRig(type) {
    const T = TYPES[type];
    const rig = makeLive(type, T.colors[0], { driver: T.kind === 'car' });
    if (T.kind === 'bike') this._rider(rig, Math.floor(this.rand() * 1e9));
    this.game.worldScene.add(rig.group);
    // pooled rigs live for the session: one blob each (hidden rigs are skipped)
    try { const w = this.game.world; if (w && w.blobShadow) w.blobShadow(rig.group, T.W * 0.55 + 0.1, { stretch: T.L / T.W * 0.85 }); } catch (e) { /* optional */ }
    return rig;
  }
  /** (re)seat a cyclist on a bike rig: randomLook(seed), remembered as rig.riderSeed (multiplayer sends only the seed) */
  _rider(rig, seed) {
    try {
      if (rig.rider) { rig.rider.group.removeFromParent(); rig.rider.dispose(); rig.rider = null; }
      const ch = createCharacter(randomLook(seed)); ch.setPose('cycle'); ch.group.position.set(0, 0, -0.1);
      rig.group.add(ch.group); rig.rider = ch; rig.riderSeed = seed;
    } catch (e) { console.warn('[traffic] rider', e); }
  }
  closeRoads(test) {
    const hit = [];
    for (const e of this.edges) {
      let inside = false;
      for (let i = 0; i < e.xs.length && !inside; i++) inside = test(e.xs[i], e.zs[i]) || (i > 0 && test((e.xs[i] + e.xs[i - 1]) / 2, (e.zs[i] + e.zs[i - 1]) / 2));
      if (inside) { e.closed = (e.closed || 0) + 1; hit.push(e); }
    }
    if (hit.length) this._deadEnds();      // (the streets that now lead only to the closure)
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i]; if (a.remote || !a.lane) continue;
      if (a.lane.e.closed) { if (!a.held) this._release(a); }
      else if ((a.next && a.next.e.closed) || (a.next2 && a.next2.e.closed)) { a.next = this.choose(a.lane, a); a.next2 = undefined; }
    }
    return { edges: hit };
  }
  openRoads(h) { if (h && h.edges) { for (const e of h.edges) e.closed = Math.max(0, (e.closed || 0) - 1); h.edges = null; this._deadEnds(); } }
  _release(a) {
    if (a.nid && this.sync) this.sync.core.removed(a);
    if (a.slot) { a.slot.agent = null; a.slot = null; }
    a.held = false;
    a.rig.group.visible = false; vehFade(a.rig, 1);      // (back in the pool whole)
    let p = this.pool.get(a.type); if (!p) this.pool.set(a.type, (p = []));
    p.push(a.rig);
    a.active = false;
    const i = this.list.indexOf(a);
    if (i >= 0) { this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
  }

  _pickType(kind, night, forceBus) {
    if (forceBus && kind === 'car') return 'bus';
    if (kind === 'bike') { const u = this.rand(); return u < 0.5 ? 'bike_roadster' : u < 0.78 ? 'bike_road' : 'bike_mtb'; }
    const u = this.rand();
    let buses = 0; for (const a of this.list) if (a.type === 'bus') buses++;
    if (night) return u < 0.5 ? 'taxi' : u < 0.7 ? 'car_hatch' : u < 0.88 ? 'car_saloon' : u < 0.95 || buses >= Math.max(1, (this._maxBus ?? this.config.maxBuses) >> 1) ? 'van' : 'bus';
    return u < 0.31 ? 'car_hatch' : u < 0.56 ? 'car_saloon' : u < 0.74 ? 'taxi' : u < 0.86 || buses >= (this._maxBus ?? this.config.maxBuses) ? 'van' : 'bus';
  }

  /** would a new vehicle of this type at (x, z, h) stand on (or within 15 cm of) a parked / live vehicle in the grid? (A bus
   *  spawned on Magdalen Street with its mirror 10 cm into a kerbside saloon - the bays are laid for a van passing - and,
   *  the backstop only refusing what goes deeper, drove the whole length of it: the last bus-parked contacts.) */
  _spawnBlocked(type, x, z, h) {
    const G = this.grid; if (!G || !G.n) return false;
    const T = TYPES[type], dl = T.L / 2, dw = (type === 'taxi' ? Math.max(T.W, 1.9) : type === 'bus' ? Math.max(T.W, 2.63) : T.W) / 2;
    const I = this._gw || (this._gw = new Int32Array(64)), e = dl + dw + 4;
    const n = G.gatherBox(x - e, z - e, x + e, z + e, I);
    for (let j = 0; j < n; j++) {
      const i = I[j], k = G.K[i]; if (k !== K_LIVE && k !== K_PVEH && !(k === K_REMOTE && G.HALF[i] > 0)) continue;
      if (obb(x, z, h, dl, dw, G.X[i], G.Z[i], Math.atan2(G.FX[i], G.FZ[i]), G.HALF[i] + G.R[i], G.R[i]) > -0.15) return true;
    }
    return false;
  }
  _trySpawn(kind, px, pz, night, forceBus = false) {
    const type = this._pickType(kind, night, forceBus);
    const near = type === 'bus' && this._nearBus.length ? this._nearBus : this._near;
    if (!near.length) return false;
    // (in plain view only from beyond where it is drawn at all - V_GONE, 2026-11-26; 190 m a car and 140 m a cyclist
    //  on 2026-11-24, 130 and 90 before: tools/smoke_popin.mjs)
    const minD = kind === 'car' ? 70 : 40, maxD = V_LET[kind] - (kind === 'car' ? 6 : 4), seen = V_GONE[kind] + 2;
    const T = TYPES[type];
    for (let k = 0; k < (type === 'bus' ? 10 : 6); k++) {
      const c = near[Math.floor(this.rand() * near.length)];
      const l = c.l;
      if (type === 'bus' && !l.bus) continue;
      if (l.e.closed || l.e.parkClosed || (kind === 'car' && (l.noCar || l.deadRun || l.dead || (type === 'bus' && l.noBus)))) continue;
      if (l.run && l.run.occF === this._frame && (l.rd > 0 ? l.run.nm : l.run.np) > 0 && !passOK(T.W / 2 + 0.1, l.rd > 0 ? l.run.rm : l.run.rp, l.run.F)) continue;   // (someone coming down a street with room for one)
      if (kind === 'bike' && l.main && l.e.w >= 10 && this.rand() < 0.5) continue;
      const off = kind === 'bike' ? l.bikeOff : type === 'bus' && !l.e.oneway && l.e.w < 8 ? Math.max(l.off, Math.min(l.freeL, l.e.w / 2) - TYPES.bus.W / 2 - 0.5) : l.off;
      this.lanePos(l, c.s, off, _o);
      const d = Math.hypot(_o.x - px, _o.z - pz);
      if (d < minD || d > maxD) continue;
      // out of sight: far enough; or, from the old distances (130 m a car, 90 m a cyclist), where no player can see the
      // spot - out of the camera's picture or a building in the way (pedestrians._unseen); nearer than those, only
      // with a BUILDING between it and the player whichever way the camera looks (any wall segment used to count: a
      // railing, a parked car's box, a low wall)
      if (d < seen) {
        const PS = this.game.pedestrians && this.game.pedestrians._sys, col = this.game.worldCollider;
        if (PS && PS._vw ? !(PS._unseen(_o.x, _o.z) && (d >= (kind === 'car' ? 130 : 90) || col.sightBlocked(px, pz, _o.x, _o.z))) : col.raycast(px, pz, _o.x, _o.z) === null) continue;
      }
      // (... and beyond that only in the camera's picture: one made out there to the side or behind would be let go
      //  again at once - update's rule for those no longer drawn - and the try wasted)
      else if (!this._S && d > V_LET_HID[kind] && this._hidAt(_o.x, _o.z)) continue;
      // multiplayer: only where we are the owner-to-be, and not under anyone's nose
      const S = this._S;
      if (S && (!S.core.spawnOk(_o.x, _o.z) || S.core.nearestD(_o.x, _o.z) < minD)) continue;
      let clash = false;
      for (const a of this.list) if (Math.abs(a.x - _o.x) < 14 && Math.abs(a.z - _o.z) < 14) { clash = true; break; }
      if (clash || this.water.isWet(_o.x, _o.z) || this._spawnBlocked(type, _o.x, _o.z, Math.atan2(_o.dx, _o.dz))) continue;
      const rig = this._rig(type);
      { const cols = T.trafficColors || T.colors; rig.setColor(cols[Math.floor(this.rand() * cols.length)]); }   // incl. the other body styles (estate, city car, minicab, single-decker)
      rig.setLights(night);
      rig.group.visible = true;
      const a = this._agent(type, rig, l, c.s, off, _o.x, _o.z, Math.atan2(_o.dx, _o.dz));
      a.next = this.choose(l, a);
      a.speed = Math.min(kind === 'bike' ? a.pref : l.vmax * a.pref, 6);
      this.list.push(a);
      this._place(a, 0);
      if (S) a.fin = this._hidNow(a) ? 1 : 0;      // (made round another player: where WE can see it, it fades in)
      this._show(a, 0);
      return true;
    }
    return false;
  }

  _agent(type, rig, l, s, off, x, z, heading) {
    const T = TYPES[type], kind = T.kind;
    return {
      ai: true, kind, type, rig, lane: l, prevLane: null, next: null, s, off, offT: off, speed: 0, x, z, heading,
      half: Math.max(0, T.L / 2 - T.W / 2), radius: T.W / 2 + (kind === 'bike' ? 0.1 : 0.05), active: true, blockT: 0, honkT: 0, pedT: this.rand() * 0.3,
      pedBlock: 0, ghostT: 0, wheelA: 0, crankA: 0, lean: 0, pref: kind === 'bike' ? 4.2 + this.rand() * 2 : type === 'bus' ? 8.5 : 0.85 + this.rand() * 0.2,
      held: false, hail: false, honkDelay: 0, dwell: 0, stopId: -1, lastStop: -1, decided: -1, rank: null, slot: null, wasHeld: false,
      // kinematics: front-wheel angle (+ = heading increasing), yaw rate, eased acceleration, ground height (resampled every 0.3 m, smoothed)
      steer: 0, yaw: 0, acc: 0, tightD: 0, lostT: 0, uR: 2, pv: (T.wb || 2.6) / 2, wb: T.wb || 2.6, y: 0, gy: 0, gx: 1e9, gz: 1e9, next2: undefined, uturn: false, stray: 0,
      j0: newJ(), j1: newJ(), j2: newJ(),               // corner geometry: the one being left, the next, the one after (see _junc)
      // motion pass: extra lateral offset (going round / squeezing), its subject, lateral move held (timer, side), predictions
      // ignored (timer), backing off (timer, cooldown), a stable number (ties at junctions)
      passOff: 0, passRef: null, passK: 0, latT: 0, latS: 0, predOffT: 0, revT: 0, revDone: 0, revTouch: false, holdT: 0, standT: 0, rerouted: 0, intrT: 0, ignoreRef: null, uid: ++this._uid,
      // a walker standing in the carriageway in front of us (who, where they stood, seconds there): see _obstacles
      pwRef: null, pwX: 0, pwZ: 0, pwT: 0,
      // (declared up front, every agent the same shape: the hot loops stay monomorphic)
      pathT: 0, pathL: null, p1x: 0, p1z: 0, p2x: 0, p2z: 0, scanM: null, bye: false, why: null, whyPred: false, yieldT: 0, preYieldOff: 0, shove: null, remote: false, rankP: false,
      nid: 0, ngen: 0, nsent: 0, nclaim: 0, npin: false, animDt: 0, slept: 0,
      fin: 1, fout: 0,                               // (drawing: fading in over V_FADE_S from 0; fading out before it is let go - _show)
      vis: null, sid: 0, drvSeed: 0,                 // (systems/_carfid.js: what is seen of it - who is inside, indicators, doors; the proxy's crowdsync id; the driver's look)
      // junction box: the node approached (registered each frame), the movement, committed to it, seconds waited at its stop
      // line; the box being cleared; the single-track run committed to (and which way), seconds waited at its mouth; what
      // the box / run / keep-clear rule is waiting for (tools/audit_motion.mjs)
      intrRef: null, stillT: 0, lpX: 0, lpZ: 0, bxN: null, bxM: -1, bxL: null, bxX: null, bxC: false, bxW: 0, bxS: 0, bxPN: null, bxPM: -1, runC: null, runD: 0, runW: 0, whyM: null,
      dl: T.L / 2, dw: (type === 'taxi' ? Math.max(T.W, 1.9) : type === 'bus' ? Math.max(T.W, 2.63) : T.W) / 2,     // (half length / width as drawn: the cab's arches, the bus's mirrors)
    };
  }

  _refreshNear(px, pz) {
    const near = this._near; near.length = 0;
    const nb = this._nearBus || (this._nearBus = []); nb.length = 0;
    const cx = Math.floor(px / 50), cz = Math.floor(pz / 50);
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) { const a = this.sgrid.get((cx + i) * 65536 + (cz + j)); if (a) for (const c of a) { near.push(c); if (c.l.bus) nb.push(c); } }
    this._nearAt.x = px; this._nearAt.z = pz;
  }

  _setTier(lvl) {
    if (!TIERS[lvl]) lvl = 'low';
    this._tier = lvl;
    const t = TIERS[lvl];
    for (const k in t) this.config[k] = t[k];
  }

  // ------------------------------------------------------------ taxi ranks
  _ranks(wp, night, cars, maxC) {
    const col = this.game.worldCollider;
    for (const rk of this.ranks) {
      const d = Math.hypot(rk.x - wp.x, rk.z - wp.z);
      if (d > 240) continue;
      // (busy-streets pass: the station rank is the busy one: its whole queue, behind which vehicles.js parks more cabs)
      const want = Math.min(rk.slots.length, this.config.rankTaxis + (night ? 1 : 0) + (BUSY && /station/i.test(rk.name) ? busyTier(this._tier).rankExtra : 0));
      for (let i = 0; i < want && cars < maxC; i++) {
        const sl = rk.slots[i];
        if (sl.agent) continue;
        if (sl.ok === undefined) {
          // checked once, on first use (the street furniture is installed after us): the whole car clear of lamps, bins, walls
          const fx = Math.sin(sl.h), fz = Math.cos(sl.h); sl.ok = true;
          for (const o of [-1.6, 0, 1.6]) if (!col.isFree(sl.x + fx * o, sl.z + fz * o, 0.95)) sl.ok = false;
        }
        if (!sl.ok) continue;
        const ds = Math.hypot(sl.x - wp.x, sl.z - wp.z);
        // never pop into plain view (except straight after a teleport, when nobody is looking): from beyond where a car
        // is drawn at all, or where no player can see the slot (it was any wall in the way within 130 m, and in plain
        // view from there: a rank filled up cab by cab as it was driven at)
        if (!this._jumped && (ds < 70 || (ds < V_GONE.car && !this._hidAt(sl.x, sl.z)))) continue;
        if (this._S && (!this._S.core.spawnOk(sl.x, sl.z) || this._S.core.nearestD(sl.x, sl.z) < 70 || this._rankProxy(sl))) continue;
        const rig = this._rig('taxi');
        const T = TYPES.taxi;
        rig.setColor(T.colors[Math.floor(this.rand() * T.colors.length)]);
        rig.setLights(night); rig.group.visible = true;
        const a = this._agent('taxi', rig, null, 0, 0, sl.x, sl.z, sl.h);
        a.rank = rk; a.slot = sl; sl.agent = a;
        this.list.push(a); cars++;
        a.y = a.gy = this.game.groundHeight(sl.x, sl.z);
        rig.group.position.set(sl.x, a.y, sl.z); rig.group.rotation.set(0, sl.h, 0);
        if (!this._jumped && !this._hidNow(a)) a.fin = 0;      // (multiplayer: a rank filled for another player, in our view)
        this._show(a, 0);
      }
    }
    return cars;
  }

  // ------------------------------------------------------------ taking vehicles
  nearestTakeable(x, z, reach = 1.5) {
    let best = null, bd = Infinity;
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      if (!a.active || Math.abs(a.x - x) > 9 || Math.abs(a.z - z) > 9) continue;
      if (Math.abs(a.speed) > (a.kind === 'bike' ? 4.5 : 4)) continue;
      const fx = Math.sin(a.heading), fz = Math.cos(a.heading);
      let u = (x - a.x) * fx + (z - a.z) * fz; u = clamp(u, -a.half, a.half);
      const d = Math.hypot(x - a.x - fx * u, z - a.z - fz * u) - a.radius;
      if (d < (a.kind === 'bike' ? Math.min(reach, 1.3) : reach) && d < bd) { bd = d; best = a; }
    }
    return best;
  }

  // ------------------------------------------------------------ physics (systems/vehicles.js hits AI traffic)
  shove(a, vx, vz, w = 0) {
    if (!a || !a.active || a.kind !== 'car') return false;
    if (a.remote) { const S = this.game.crowdsync; if (!S || !S.claimNow('c', a, true)) return false; }      // someone else's: ours first
    const sp = Math.hypot(vx, vz);
    if (!(sp === sp) || !(w === w)) return false;
    const k = sp > 14 ? 14 / sp : 1;
    if (!a.shove) a.shove = { vx: 0, vz: 0, w: 0, rest: 0, t: 0 };
    const S = a.shove; S.vx = vx * k; S.vz = vz * k; S.w = clamp(w, -3.5, 3.5); S.rest = 0; S.t = 0;
    a.held = false; a.hail = false;
    return true;
  }
  /** a shunted AI car: slides to a halt with its driver on the brakes (and against the walls), sits there, then drives on */
  _shoved(a, dt, wp) {
    const S = a.shove;
    S.t += dt;
    if (S.rest > 0) {
      S.rest -= dt;
      if (S.rest <= 0) {
        a.shove = null; a.speed = 0; a.acc = 0; a.lostT = 0; a.stray = Math.max(a.stray, 2); a.steer = 0; a.yaw = 0;
        if (Math.random() < 0.6) this._honk(a, wp);
        if (!a.lane) return;
        // back onto its lane where it now is (it may have been knocked across the road)
        const nl = this.nearestLane(a.x, a.z, 12, a.heading);
        if (nl && nl.lane !== a.lane && Math.sin(nl.heading) * Math.sin(a.heading) + Math.cos(nl.heading) * Math.cos(a.heading) > 0.3) {
          const l = nl.lane; a.lane = l; a.s = nl.s; a.off = a.offT = l.off; a.next = this.choose(l, a); a.next2 = undefined; a.j0.l = null; a.j1.l = null; a.j2.l = null; a.uturn = false;
        }
      }
      this._unwedge(a);
      this._place(a, dt); return;
    }
    const fx = Math.sin(a.heading), fz = Math.cos(a.heading), lx = fz, lz = -fx;
    let vf = S.vx * fx + S.vz * fz, vl = S.vx * lx + S.vz * lz;
    const d1 = 7 * dt, d2 = 9 * dt;
    vf = Math.abs(vf) <= d1 ? 0 : vf - Math.sign(vf) * d1; vl = Math.abs(vl) <= d2 ? 0 : vl - Math.sign(vl) * d2;
    S.vx = fx * vf + lx * vl; S.vz = fz * vf + lz * vl;
    S.w = Math.abs(S.w) <= 3 * dt ? 0 : S.w - Math.sign(S.w) * 3 * dt;
    const ox = a.x, oz = a.z, oh = a.heading;
    a.x += S.vx * dt; a.z += S.vz * dt; a.heading = wrap(a.heading + S.w * dt);
    // walls (the car's capsule as three circles) and the river: stop at them
    const col = this.game.worldCollider, P = _sp, nfx = Math.sin(a.heading), nfz = Math.cos(a.heading);
    let best = 0, px = 0, pz = 0;
    for (let i = -1; i <= 1; i++) {
      const cx = a.x + nfx * a.half * i, cz = a.z + nfz * a.half * i; P.x = cx; P.z = cz;
      col.resolve(P, a.radius, _SO);
      const dx = P.x - cx, dz = P.z - cz, q = dx * dx + dz * dz; if (q > best) { best = q; px = dx; pz = dz; }
    }
    if (best > 1e-8) { a.x += px; a.z += pz; const d = Math.sqrt(best), ux = px / d, uz = pz / d, vn = S.vx * ux + S.vz * uz; if (vn < 0) { S.vx -= vn * ux * 1.15; S.vz -= vn * uz * 1.15; } }
    if (this.water.isWet(a.x, a.z)) { a.x = ox; a.z = oz; S.vx = S.vz = 0; S.w = 0; }
    // other bodies (parked kerbside cars, live vehicles, other traffic) are solid too: the slide stops against them, never
    // into them (2026-11: a car shunted sideways slid 85 cm into the parked row and sat there wedged between two parked
    // cars, every move deeper into one of them cancelled, no room to back off - "shoved, stops, waits" never drove on).
    // (first without the spin; then not at all. The backstop's rule: never deeper into any box than it already was.)
    if (this._intrudes(a, ox, oz, oh)) {
      a.heading = oh; S.w = 0;
      if (this._intrudes(a, ox, oz, oh)) { a.x = ox; a.z = oz; S.vx = S.vz = 0; }
    }
    this._unwedge(a);
    a.speed = vf; a.yaw = S.w; a.steer *= Math.max(0, 1 - dt * 4);
    if (Math.hypot(S.vx, S.vz) < 0.12 && Math.abs(S.w) < 0.05) { S.vx = S.vz = S.w = 0; a.speed = 0; S.rest = 1.4 + 1.6 * (((Math.abs(a.x * 7.3 + a.z * 3.1) * 100) | 0) % 100) / 100; }      // (not this.rand(): a shunt must not reshuffle the spawns)
    this._place(a, dt);
  }
  /** a shunted car pressed into something that does not move (a parked car, a stationary live one) by the car shoving
   *  it (vehicles.js splits the overlap positionally and cannot see the parked row behind): pushed straight back out of
   *  it, onto free ground only. Without this it was left wedged 30-85 cm into the parked cars ahead and behind, every move
   *  deeper into one of them cancelled, no room to back off: it never drove on. */
  _unwedge(a) {
    const G = this.grid; if (!G) return;
    const I = this._gw || (this._gw = new Int32Array(64)), e = a.dl + a.dw + 3.5;
    const n = G.gatherBox(a.x - e, a.z - e, a.x + e, a.z + e, I);
    const ox = a.x, oz = a.z;
    for (let j = 0; j < n; j++) {
      const i = I[j]; if (G.K[i] !== K_LIVE || Math.abs(G.V[i]) > 0.3) continue;
      const d = obb(a.x, a.z, a.heading, a.dl, a.dw, G.X[i], G.Z[i], Math.atan2(G.FX[i], G.FZ[i]), G.HALF[i] + G.R[i], G.R[i], _ua);
      if (d > 0.005) { a.x += _ua.x * (d + 0.005); a.z += _ua.z * (d + 0.005); }
    }
    if (a.x === ox && a.z === oz) return;
    const col = this.game.worldCollider, fx = Math.sin(a.heading), fz = Math.cos(a.heading);
    let ok = !this.water.isWet(a.x, a.z);
    for (let i = -1; i <= 1 && ok; i++) ok = col.isFree(a.x + fx * a.half * i, a.z + fz * a.half * i, a.radius * 0.9);
    if (!ok) { a.x = ox; a.z = oz; }
  }
  knockOff(a, vx, vz) {
    if (!a || !a.active || a.kind !== 'bike') return null;
    if (a.remote) { const S = this.game.crowdsync; if (!S || !S.claimNow('c', a, true)) return null; }
    return this.handOver(a, { knock: { vx, vz } });
  }

  /** The player has the door open: the AI vehicle leaves the traffic system and its driver is turfed out. */
  handOver(a, opts = {}) {
    if (!a || !a.active) return null;
    const g = this.game, T = TYPES[a.type], fx = Math.sin(a.heading), fz = Math.cos(a.heading), lx = fz, lz = -fx;
    let look, ex, ez, vx, vz, lookSeed, lookKind = 1;
    const kn = opts.knock || null;
    if (a.kind === 'bike') {
      // shoved off sideways, away from the player (knocked off by a car: thrown along its way)
      const side = opts.fromLeft ? -1 : 1;
      lookSeed = a.rig.rider && a.rig.riderSeed !== undefined ? a.rig.riderSeed : Math.floor(this.rand() * 1e9);
      look = a.rig.rider ? a.rig.rider.look : randomLook(lookSeed);
      ex = a.x + lx * side * 0.75; ez = a.z + lz * side * 0.75; vx = lx * side * 2.4; vz = lz * side * 2.4;
      if (kn) { ex = a.x; ez = a.z; vx = kn.vx * 0.55 + fx * a.speed * 0.4; vz = kn.vz * 0.55 + fz * a.speed * 0.4; }
      if (a.rig.rider) a.rig.rider.group.visible = false;
      a.rig.reroll = true;
    } else {
      // out of the driver's (right-hand) door: local -x is the right side
      const sz = T.seat.z - 0.5, sx = -(T.W / 2 + 1.05);
      ex = a.x + fx * sz + lx * sx; ez = a.z + fz * sz + lz * sx; vx = -lx * 2.0 - fx * 0.4; vz = -lz * 2.0 - fz * 0.4;
      let seed = Math.floor(this.rand() * 1e9);
      if (a.drvSeed) seed = a.drvSeed;                 // (the person who was seen at the wheel: systems/_carfid.js)
      look = a.type === 'bus' ? Object.assign(randomLook(seed), { topStyle: 'shirt', top: 0xb9cde3, sleeves: 'short', bottom: 0x23262d, jacket: undefined, hivis: 0xd9ec2a })
        : randomLook(seed);
      lookSeed = seed; lookKind = a.type === 'bus' ? 2 : 1;          // (pedestrians.js lookOf: the same recipe)
    }
    if (this.water.isWet(ex, ez)) { ex = a.x; ez = a.z; vx = vz = 0; }
    const heading = kn ? Math.atan2(vx, vz) : Math.atan2(a.x - ex, a.z - ez);
    let ped = null;
    try { if (g.pedestrians && g.pedestrians.adopt) ped = g.pedestrians.adopt(ex, ez, look, { heading, vx, vz, lookSeed, lookKind, tumble: kn ? 'tumblef' : null }); } catch (e) { console.warn('[traffic] adopt', e); ped = null; }
    let rec = ped;
    if (!ped) rec = this._ejectFallback(ex, ez, heading, look, vx, vz);
    const lines = kn ? KNOCKED : SHOUTS[a.kind === 'bike' ? 'bike' : a.type] || SHOUTS.bike;
    const text = lines[Math.floor(this.rand() * lines.length)];
    this.shouts.push({ rec, t: 4.5, text, x: ex, z: ez });          // once they are back on their feet
    // the cars stuck behind lean on the horn
    for (const o of this.list) {
      if (o === a || o.kind !== 'car' || !o.active) continue;
      const rx = a.x - o.x, rz = a.z - o.z, f = rx * Math.sin(o.heading) + rz * Math.cos(o.heading), l2 = Math.abs(rx * Math.cos(o.heading) - rz * Math.sin(o.heading));
      if (f > 0 && f < 40 && l2 < 3.2) o.honkDelay = 0.6 + this.rand() * 1.4;
    }
    if (!kn) this.taken++;
    const info = { type: a.type, kind: a.kind, x: a.x, z: a.z, heading: a.heading, speed: a.speed, color: a.rig.color, rank: a.rank ? a.rank.name : null, driver: rec, text,
      pax: a.pax || 0 };
    this._release(a);
    return info;
  }

  /** No pedestrian system (headless tests): a tiny "ejected driver" list that gets up, walks off and is removed. */
  _ejectFallback(x, z, heading, look, vx, vz) {
    let ch = null;
    try {
      ch = createCharacter(look); ch.setPose('fall');
      ch.group.position.set(x, this.game.groundHeight(x, z), z); ch.group.rotation.y = heading;
      this.game.worldScene.add(ch.group);
    } catch (e) { ch = null; }
    const r = { character: ch, x, z, heading, vx, vz, t: 0, active: true, fallback: true };
    this.ejected.push(r);
    return r;
  }
  _updateEjected(dt, wp) {
    for (let i = this.ejected.length - 1; i >= 0; i--) {
      const r = this.ejected[i];
      r.t += dt;
      if (r.t < 4.4) { r.x += r.vx * dt; r.z += r.vz * dt; const k = Math.max(0, 1 - dt * 4); r.vx *= k; r.vz *= k; }
      else { r.x -= Math.sin(r.heading) * 1.3 * dt; r.z -= Math.cos(r.heading) * 1.3 * dt; }    // walk off, away from the car
      if (r.character) {
        if (r.t >= 4.4 && r.character.pose === 'fall') r.character.setPose('stand');
        r.character.group.position.set(r.x, this.game.groundHeight(r.x, r.z), r.z);
        r.character.group.rotation.y = r.t >= 4.4 ? r.heading + Math.PI : r.heading;
        r.character.update(dt, r.t >= 4.4 ? 1.3 : 0);
      }
      if (r.t > 16 || Math.hypot(r.x - wp.x, r.z - wp.z) > 60) {
        if (r.character) { r.character.group.removeFromParent(); r.character.dispose(); }
        r.active = false; this.ejected.splice(i, 1);
      }
    }
  }
  _updateShouts(dt, wp) {
    for (let i = this.shouts.length - 1; i >= 0; i--) {
      const s = this.shouts[i];
      if ((s.t -= dt) > 0) continue;
      this.shouts.splice(i, 1);
      const ch = s.rec && s.rec.active !== false ? s.rec.character : null;
      if (!ch) continue;
      try { ch.say(s.text, 3.6); } catch { /* ignore */ }
      this.lastShout = s.text;
      // (the square-wave "indignant blip" that went with the shout is gone, 2026-11-23: the driver's own voice is the sound)
    }
  }

  // ------------------------------------------------------------ hooks for other systems (police, jobs)
  _nodeGrid() {
    if (this._ng) return this._ng;
    const g = new Map();
    for (const n of this.nodes) { const k = Math.floor(n.x / 50) * 65536 + Math.floor(n.z / 50); let a = g.get(k); if (!a) g.set(k, (a = [])); a.push(n); }
    for (const n of this.nodes) n.adj = [];
    for (const e of this.edges) { e.a.adj.push(e); if (e.b !== e.a) e.b.adj.push(e); }
    const eg = new Map();
    for (const e of this.edges) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < e.xs.length; i++) { x0 = Math.min(x0, e.xs[i]); x1 = Math.max(x1, e.xs[i]); z0 = Math.min(z0, e.zs[i]); z1 = Math.max(z1, e.zs[i]); }
      for (let cx = Math.floor(x0 / 40); cx <= Math.floor(x1 / 40); cx++) for (let cz = Math.floor(z0 / 40); cz <= Math.floor(z1 / 40); cz++) {
        const k = cx * 65536 + cz; let a = eg.get(k); if (!a) eg.set(k, (a = [])); a.push(e);
      }
    }
    this._eg = eg;
    const N = this.nodes.length;
    this._as = { g: new Float64Array(N), f: new Float64Array(N), prev: new Int32Array(N), pe: new Array(N), mark: new Int32Array(N), gen: 0, heap: [] };
    return (this._ng = g);
  }
  nearestNode(x, z, maxD = 120) {
    const g = this._nodeGrid(); let best = null, bd = maxD;
    const r = Math.ceil(maxD / 50), cx = Math.floor(x / 50), cz = Math.floor(z / 50);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const a = g.get((cx + i) * 65536 + cz + j); if (!a) continue;
      for (const n of a) { if (!n.adj.length) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
    }
    return best;
  }
  nearestLane(x, z, maxD = 30, heading) {
    this._nodeGrid();
    let best = null, bd = Infinity;
    const r = Math.ceil(maxD / 40), cx = Math.floor(x / 40), cz = Math.floor(z / 40), seen = this._seenE || (this._seenE = new Set());
    seen.clear();
    const hx = heading === undefined ? 0 : Math.sin(heading), hz = heading === undefined ? 0 : Math.cos(heading);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const a = this._eg.get((cx + i) * 65536 + cz + j); if (!a) continue;
      for (const e of a) {
        if (seen.has(e)) continue; seen.add(e);
        for (let k = 0; k < e.xs.length - 1; k++) {
          const ax = e.xs[k], az = e.zs[k], dx = e.xs[k + 1] - ax, dz = e.zs[k + 1] - az, L = Math.hypot(dx, dz) || 1e-6;
          const t = clamp(((x - ax) * dx + (z - az) * dz) / (L * L), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
          if (d > maxD) continue;
          for (const l of e.lanes) {
            const al = (dx * hx + dz * hz) / L * l.dir;           // alignment with the wanted heading
            const score = d + (heading === undefined ? 0 : (1 - al) * 6);
            if (score < bd) { bd = score; const u = e.cum[k] + t * L; best = { lane: l, s: l.dir > 0 ? u : e.len - u, d }; }
          }
        }
      }
    }
    if (best) { this.lanePos(best.lane, best.s, best.lane.off, _o); best.x = _o.x; best.z = _o.z; best.heading = Math.atan2(_o.dx, _o.dz); }
    return best;
  }
  route(ax, az, bx, bz) {
    const A = this.nearestNode(ax, az), B = this.nearestNode(bx, bz);
    if (!A || !B) return null;
    const S = this._as, heap = S.heap, gen = ++S.gen;
    heap.length = 0;
    S.mark[A.id] = gen; S.g[A.id] = 0; S.prev[A.id] = -1; S.f[A.id] = Math.hypot(A.x - B.x, A.z - B.z);
    heap.push(A.id);
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && S.f[heap[l]] < S.f[heap[m]]) m = l; if (r < heap.length && S.f[heap[r]] < S.f[heap[m]]) m = r; if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } }
      return top;
    };
    const push = (id) => { heap.push(id); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (S.f[heap[p]] <= S.f[heap[i]]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } };
    let found = false, it = 0;
    while (heap.length && it++ < 6000) {
      const u = pop();
      if (u === B.id) { found = true; break; }
      if (S.mark[u] === -gen) continue;
      const nu = this.nodes[u], gu = S.g[u]; S.mark[u] = -gen;
      for (const e of nu.adj) {
        const o = e.a === nu ? e.b : e.a, ng = gu + e.len;
        if (S.mark[o.id] === -gen) continue;
        if (S.mark[o.id] !== gen || ng < S.g[o.id]) { S.mark[o.id] = gen; S.g[o.id] = ng; S.prev[o.id] = u; S.pe[o.id] = e; S.f[o.id] = ng + Math.hypot(o.x - B.x, o.z - B.z); push(o.id); }
      }
    }
    if (!found) return null;
    const ids = []; for (let u = B.id; u !== -1; u = S.prev[u]) ids.push(u);
    ids.reverse();
    const pts = [[A.x, A.z]];
    for (let i = 1; i < ids.length; i++) {
      const e = S.pe[ids[i]], fwd = e.a.id === ids[i - 1], n = e.xs.length;
      for (let k = 1; k < n; k++) { const q = fwd ? k : n - 1 - k; pts.push([e.xs[q], e.zs[q]]); }
    }
    return pts;
  }
  spawnPoint(px, pz, opts = {}) {
    const minD = opts.minD ?? 80, maxD = opts.maxD ?? 170, col = this.game.worldCollider;
    if (Math.hypot(px - this._nearAt.x, pz - this._nearAt.z) > 25) this._refreshNear(px, pz);
    const near = opts.bus && this._nearBus.length ? this._nearBus : this._near;
    for (let k = 0; k < 24 && near.length; k++) {
      const c = near[Math.floor(this.rand() * near.length)], l = c.l;
      this.lanePos(l, c.s, l.off, _o);
      const d = Math.hypot(_o.x - px, _o.z - pz);
      if (d < minD || d > maxD || this.water.isWet(_o.x, _o.z)) continue;
      // (hidden: where no player can see the spot now - out of the camera's picture or a building in the way, _hidAt,
      //  at any distance. It was "any wall segment in the way within 140 m, anywhere beyond": the police arrived in view.)
      if (opts.hidden && !this._hidAt(_o.x, _o.z)) continue;
      let clash = false;
      for (const a of this.list) if (Math.abs(a.x - _o.x) < 9 && Math.abs(a.z - _o.z) < 9) { clash = true; break; }
      if (clash) continue;
      return { x: _o.x, z: _o.z, heading: Math.atan2(_o.dx, _o.dz), lane: l, s: c.s };
    }
    return null;
  }
  spawnAgentAt(type, x, z, heading, color) {
    const T = TYPES[type]; if (!T || T.kind === 'punt') return null;
    const nl = this.nearestLane(x, z, 25, heading);
    if (!nl) return null;
    const l = nl.lane, off = T.kind === 'bike' ? l.bikeOff : l.off;
    this.lanePos(l, nl.s, off, _o);
    const rig = this._rig(type);
    rig.setColor(color ?? T.colors[Math.floor(this.rand() * T.colors.length)]);
    rig.setLights(!!(this.game.time && this.game.time.isNight)); rig.group.visible = true;
    const a = this._agent(type, rig, l, nl.s, off, x, z, heading);
    a.next = this.choose(l, a);
    this.list.push(a);
    this._place(a, 0);
    this._show(a, 0);
    return a;
  }
  busRoute(x, z, h, n = 7) {
    const st = this.nearestLane(x, z, 25, h);
    if (!st) return [];
    let l = st.lane, s0 = st.s, dist = 0, out = [], guard = 0;
    if (!l.bus) { const alt = this._busLaneNear(x, z, h); if (alt) { l = alt.lane; s0 = alt.s; } }
    const used = new Set();
    let px = x, pz = z;
    while (out.length < n && guard++ < 400 && dist < 6000) {
      if (l.stops) for (const q of l.stops) {
        if (q.s <= s0 + 1 || used.has(q.id)) continue;
        const S = this.stops[q.id];
        const nm = S.name || this._roadName(S.x, S.z);
        if (Math.hypot(S.x - px, S.z - pz) < 90 || Math.hypot(S.x - x, S.z - z) < 60 || (out.length && out[out.length - 1].name === nm)) { used.add(q.id); continue; }    // same stop cluster / same name
        used.add(q.id); px = S.x; pz = S.z;
        out.push({ id: S.id, name: nm, x: S.x, z: S.z, dist: Math.round(dist + q.s - s0) });
        if (out.length >= n) break;
      }
      dist += l.len - s0; s0 = 0;
      // carry on along the bus streets: straightest bus lane, no U-turns
      let best = null, bs = -Infinity;
      for (const o of l.to.out) {
        if (o.e === l.e) continue;
        const sc = (o.bus ? 2 : 0) + (l.edx * o.sdx + l.edz * o.sdz) + (o.stops ? 0.4 : 0);
        if (sc > bs) { bs = sc; best = o; }
      }
      if (!best) break;
      l = best;
    }
    return out;
  }
  yieldTo(x, z, heading, r = 30) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    let n = 0;
    for (const a of this.list) {
      if (!a.lane || a.held) continue;
      const rx = a.x - x, rz = a.z - z, f = rx * fx + rz * fz;
      if (f < -4 || f > r || Math.abs(rx * fz - rz * fx) > 9) continue;
      if (Math.sin(a.heading) * fx + Math.cos(a.heading) * fz < 0.3) continue;      // oncoming traffic carries on
      if (!(a.yieldT > 0)) a.preYieldOff = a.offT;
      a.yieldT = 4; n++;
    }
    return n;
  }
  _busLaneNear(x, z, h) {
    let best = null;
    for (const r of [25, 45]) { const q = this.nearestLane(x, z, r, h); if (q && q.lane.bus) { best = q; break; } }
    return best;
  }
  _roadName(x, z) {
    const q = this.nearestLane(x, z, 30);
    return q && q.lane.e.name ? q.lane.e.name : 'Unnamed stop';
  }

  // ------------------------------------------------------------ multiplayer (systems/crowdsync.js)
  /** game.crowdsync when someone else is in the world with us (also kept as this._S for the frame), else null */
  _mp() { const s = this.sync || (this.sync = this.game.crowdsync || null); return (this._S = s && s.active ? s : null); }
  _rankProxy(sl) { for (const a of this.list) if (a.remote && Math.abs(a.x - sl.x) < 3 && Math.abs(a.z - sl.z) < 3) return true; return false; }
  // record: [id, gen, x, z, h, speed, flags, (full:) type, colour, rider seed, pax, pax seed]; flags 1 waiting at a rank, 2 held
  _netProvider() {
    const self = this, TY = ['bike_roadster', 'bike_road', 'bike_mtb', 'car_hatch', 'car_saloon', 'taxi', 'van', 'bus'];
    return {
      each(fn) { const L = self.list; for (let i = 0; i < L.length; i++) if (!L[i].remote && L[i].active) fn(L[i]); },
      syncable(a) { return a.active && !a.remote; },
      encode(a, full) {
        const fl = (a.rank ? 1 : 0) | (a.held ? 2 : 0);
        if (!full) return [fl];
        return [fl, TY.indexOf(a.type), a.rig.color | 0, a.rig.riderSeed ?? -1, a.pax ?? -1, a.paxSeed ?? 0];
      },
      create(id, r) {
        if (r.length < 12) return null;
        const type = TY[r[7]]; if (!type) return null;
        const rig = self._rig(type), T = TYPES[type];
        rig.setColor(r[8]);
        if (T.kind === 'bike' && r[9] >= 0 && rig.riderSeed !== r[9]) self._rider(rig, r[9]);
        if (rig.rider) rig.rider.group.visible = true;
        rig.setLights(!!(self.game.time && self.game.time.isNight)); rig.group.visible = true;
        const a = self._agent(type, rig, null, 0, 0, r[2] / 10, r[3] / 10, r[4] / 100);
        a.remote = true; a.speed = r[5] / 10; a.sid = id | 0;
        if (r[10] >= 0) { a.pax = r[10]; a.paxSeed = r[11]; a._paxShown = -1; }
        self.list.push(a);
        self._place(a, 0);
        a.fin = self._hidNow(a) ? 1 : 0;      // (somebody else's, arriving by the network where we can see it: it fades in)
        self._show(a, 0);
        return a;
      },
      update(a, r) {
        a.held = !!(r[6] & 2); a.rankP = !!(r[6] & 1);
        if (r.length >= 12 && r[10] >= 0 && (a.pax !== r[10] || a.paxSeed !== r[11])) { a.pax = r[10]; a.paxSeed = r[11]; a._paxShown = -1; }   // bus passengers (systems/jobs.js draws them)
      },
      pose(a, x, z, h, sp, dt) {
        if (dt > 0) { let dh = h - a.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); a.yaw += (dh / dt - a.yaw) * Math.min(1, dt * 6); }
        a.x = x; a.z = z; a.heading = h; a.speed = sp;
        a.steer = clamp(Math.atan(a.yaw * a.wb / Math.max(0.5, sp)), -0.6, 0.6);
      },
      destroy(a) { self._release(a); },
      claim(a, forced) {
        // a lane to carry on along (a taxi waiting at a rank takes its slot back)
        if (a.rankP) {
          for (const rk of self.ranks) for (const sl of rk.slots) if (!sl.agent && Math.abs(sl.x - a.x) < 3 && Math.abs(sl.z - a.z) < 3) { a.rank = rk; a.slot = sl; sl.agent = a; }
        }
        if (!a.rank) {
          let nl = self.nearestLane(a.x, a.z, 10, a.heading);
          if (!nl || Math.sin(nl.heading) * Math.sin(a.heading) + Math.cos(nl.heading) * Math.cos(a.heading) <= 0.3) nl = self.nearestLane(a.x, a.z, 25, a.heading);   // (mid-junction: any lane; it steers back on)
          if (nl) {
            const l = nl.lane; a.lane = l; a.s = nl.s; a.off = a.offT = self.laneOff(a, l); a.next = self.choose(l, a); a.next2 = undefined;
          } else if (!forced) return null;
        }
        a.remote = false; a.yaw = 0; a.steer = 0;
        return a;
      },
      release(a) {
        if (a.slot) { a.slot.agent = null; a.slot = null; }
        a.remote = true; a.lane = null; a.rank = null; a.held = false;
        return a;
      },
      kill(a) { self._release(a); },
      say() {},
    };
  }

  stats() {
    let cars = 0, bikes = 0, buses = 0, taxis = 0, rank = 0;
    for (const a of this.list) { if (a.kind === 'car') cars++; else bikes++; if (a.type === 'bus') buses++; if (a.type === 'taxi') taxis++; if (a.rank) rank++; }
    return { tier: this._tier, cars, bikes, buses, taxis, rank, taken: this.taken, config: Object.assign({}, this.config) };
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, p = g.player;
    if (!dt || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const wp = p.place === 'world' ? p.pos : p.worldPos, night = !!(g.time && g.time.isNight);
    if ((this._tierT -= dt) <= 0) { this._tierT = 1; const lvl = (g.quality && g.quality.level) || 'low'; if (lvl !== this._tier) this._setTier(lvl); }
    if (Math.hypot(wp.x - this._last.x, wp.z - this._last.z) > 60) { this._jumped = true; this._rankT = 0; }
    this._last.x = wp.x; this._last.z = wp.z;
    if (Math.hypot(wp.x - this._nearAt.x, wp.z - this._nearAt.z) > 25) this._refreshNear(wp.x, wp.z);
    // spawn / despawn
    // multiplayer (someone else in the world): spawn round each player whose surroundings we own, one per tick; keep an
    // agent while ANY player is near; proxies of other clients' agents (a.remote) count towards the numbers but are
    // looked after by systems/crowdsync.js
    const S = this._mp();
    const F = S ? S.core.foci[(this._fi = (this._fi || 0) + 1) % Math.max(1, S.core.foci.length)] || null : null;
    const fx = F ? F.x : wp.x, fz = F ? F.z : wp.z;
    let cars = 0, bikes = 0, buses = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      if (S && Math.abs(a.x - fx) + Math.abs(a.z - fz) > (a.kind === 'car' ? 330 : 230)) continue;     // counts are per focus
      if (a.remote) { if (a.kind === 'car') cars++; else bikes++; if (a.type === 'bus') buses++; continue; }
      const d = S ? Math.min(Math.hypot(a.x - wp.x, a.z - wp.z), S.core.nearestD(a.x, a.z)) : Math.hypot(a.x - wp.x, a.z - wp.z);
      // (let go beyond V_LET; and, further off than V_LET_HID - where it has not been drawn for a while - as soon as it
      //  is not in the camera's picture either (each asked every eighth frame): one out there to the side or behind is
      //  only a place in the numbers, and the next is made where the player is looking - the ring ahead, or a hidden
      //  spot near by. Without this a tenth fewer were within 120 m of the player; with it from V_GONE on, a fifth
      //  more cars within 210 m, and jams: V_LET_HID is set where the numbers within 120 m are what they were -
      //  measured, tools/smoke_popin.mjs "agents by 30 m ring".
      //  Solo only: with other players about, their client makes the vehicles ahead of them and ours must not take
      //  them away by our own camera. One that is leaving in view - a.bye - fades out first, below.)
      if (!a.held && (d > V_LET[a.kind] || (!a.lane && !a.rank && !a.bye) || (!S && d > V_LET_HID[a.kind] && !a.rank && ((this._frame + a.uid) & 7) === 0 && this._hid(a)))) { this._release(a); continue; }
      if (a.kind === 'car') cars++; else bikes++;
      if (a.type === 'bus') buses++;
    }
    if (S) for (let i = this.list.length - 1; i >= 0; i--) {
      // (agents far from the focus were skipped above: release the ones nobody is near)
      const a = this.list[i];
      if (a.remote || a.held || Math.abs(a.x - fx) + Math.abs(a.z - fz) <= (a.kind === 'car' ? 330 : 230)) continue;
      if (Math.min(Math.hypot(a.x - wp.x, a.z - wp.z), S.core.nearestD(a.x, a.z)) > V_LET[a.kind] || (!a.lane && !a.rank && !a.bye)) this._release(a);
    }
    // (the day's numbers come in over the early morning and go out over the evening - 05:30 to 07:30, 19:00 to 20:30 -
    // instead of all at once at first light: at six the roads have the night's traffic and a little more, as they do)
    const hr = g.time && typeof g.time.hour === 'number' ? g.time.hour : 12, dk = night ? 0 : sstep(5.5, 7.5, hr) * (1 - sstep(19, 20.5, hr));
    const C = this.config, maxC = C.enabled ? Math.round(C.maxCarsNight + (C.maxCars - C.maxCarsNight) * dk) : 0;
    const maxB = C.enabled ? Math.round(C.maxBikesNight + (C.maxBikes - C.maxBikesNight) * dk) : 0;
    // if we're over budget (night fell) let the farthest ones go when out of sight
    if (cars > maxC || bikes > maxB) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const a = this.list[i];
        if (a.held || a.remote || (a.kind === 'car' ? cars <= maxC : bikes <= maxB)) continue;
        if (S && S.core.nearestRemoteD(a.x, a.z) < 130) continue;      // in view of someone else
        const d = Math.hypot(a.x - wp.x, a.z - wp.z);
        // (it was 120 m in plain view, or any wall in the way from 50 m: the evening's traffic thinned out before the
        //  eyes. Now: no longer drawn, or - from 70 m, as near as one is ever made - out of the picture or behind a building)
        if (d > V_GONE[a.kind] || (d > 70 && this._hid(a))) { this._release(a); if (a.kind === 'car') cars--; else bikes--; }
      }
    }
    if ((this._rankT -= dt) <= 0) { this._rankT = 1; if (maxC > 0 && (!S || F)) cars = this._ranks(F || wp, night, cars, maxC); }
    this._jumped = false;
    if ((this._spawnT -= dt) <= 0 && (!S || F)) {
      this._spawnT = S ? 0.2 / Math.max(1, S.core.foci.length) : 0.2;
      if (F && Math.hypot(fx - this._nearAt.x, fz - this._nearAt.z) > 25) this._refreshNear(fx, fz);
      // on the bus streets make sure there is a bus about
      // (busy-streets pass: by day near the High, St Aldate's and the station forecourt, one more bus on the medium / high
      // tiers and a better chance of one: BUS_SPOTS)
      // (TIERS' maxBuses includes that extra one: away from BUS_SPOTS, and at night, one fewer)
      const bx = BUSY ? busyTier(this._tier).buses : 0, spot = bx && !night && BUS_SPOTS.some((s) => Math.hypot(fx - s[0], fz - s[1]) < s[2]);
      let maxBus = this.config.maxBuses - (spot ? 0 : bx), pBus = buses === 0 ? 0.45 : night ? 0.04 : 0.12;
      if (spot) pBus = Math.min(0.6, pBus * 2);
      this._maxBus = maxBus;
      const wantBus = buses < maxBus && this._nearBus && this._nearBus.length > 8 && this.rand() < pBus;
      if (cars < maxC) this._trySpawn('car', fx, fz, night, wantBus);
      else if (bikes < maxB) this._trySpawn('bike', fx, fz, night);
    }
    if (this.shouts.length) this._updateShouts(dt, wp);
    if (this.ejected.length) this._updateEjected(dt, wp);
    if (this.warm.length) {
      const [type, c] = this.warm.pop();
      if (c === null) { const rig = this._newRig(type); rig.group.visible = false; if (!this.pool.has(type)) this.pool.set(type, []); this.pool.get(type).push(rig); }
      else { const p = this.pool.get(type); if (p && p.length) { const r = p[p.length - 1]; const old = r.color; r.setColor(c); r.setColor(old); } }
    }
    if ((this._lightT = (this._lightT || 0) - dt) <= 0) { this._lightT = 1; const lamps = lampsWanted(g, night); for (const a of this.list) a.rig.setLights(a.kind === 'car' ? lamps : night); }      // (cars: dusk and heavy rain too)
    // drive
    const L = this.list;
    this._buildGrid(p);
    let bye = false;
    // (out of sight - over 120 m from the player, solo - every other frame with both frames' time, staggered by number: the
    // same rules at 15 Hz where nobody can see; in multiplayer someone else may be watching, so never)
    const solo = !this._S, fr = this._frame;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      this._show(a, dt);      // (how much of it is drawn: every frame, also on the frames a far one is not driven)
      if (solo && a.lane && !a.remote && !a.shove) {
        const dx = a.x - wp.x, dz = a.z - wp.z;
        if (dx * dx + dz * dz > 14400) { if (((fr + a.uid) & 1) === 1) { a.slept += dt; continue; } this._drive(a, dt + a.slept, wp, p); a.slept = 0; if (a.bye) bye = true; continue; }
      }
      if (a.slept) { this._drive(a, dt + a.slept, wp, p); a.slept = 0; } else this._drive(a, dt, wp, p);
      if (a.bye) bye = true;
    }
    // (one that gives up - stuck in a jam, lost, at the end of the map's roads - goes at once only where we cannot see
    //  it; in view it fades out over V_FADE_S first: _show)
    if (bye) for (let i = L.length - 1; i >= 0; i--) {
      const a = L[i]; if (!a.bye) continue;
      if (a.fout === 0 && !a.remote && !this._hidNow(a)) { a.fout = 1e-4; continue; }
      if (a.fout > 0 && a.fout < 1) continue;
      a.bye = false; this._release(a);
    }
    // nobody walks through traffic
    if (!p.vehicle && p.place === 'world') for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (Math.abs(a.x - p.pos.x) >= 8 || Math.abs(a.z - p.pos.z) >= 8) continue;
      if (a.kind === 'car' && p.pos.y - (a.y || 0) > 0.6) continue;          // standing on it (game.vehicles.supportAt)
      if (p.pos.y - (a.y || 0) > 2.4) continue;          // above it: a cyclist going under the Headington Hill footbridge used to shove you off the deck
      const bx = p.pos.x, bz = p.pos.z;
      if (pushCapsule(p.pos, 0.32, a.x, a.z, a.heading, a.half, a.radius)) {
        g.worldCollider.resolve(p.pos, 0.32);                                  // (shoved, but never into a wall)
        const sh = a.shove, vx = sh ? sh.vx : Math.sin(a.heading) * a.speed, vz = sh ? sh.vz : Math.cos(a.heading) * a.speed, sp = Math.hypot(vx, vz);
        const px = p.pos.x - bx, pz = p.pos.z - bz, pl = Math.hypot(px, pz) || 1;
        if (sp > 2.6 && p.knockDown && !p.down) p.knockDown(vx * 0.9 + px / pl * 1.5, vz * 0.9 + pz / pl * 1.5, { hit: true });      // (hit: thrown by the speed of it, core/player.js)
        else if (sp > 1.2 && p.stumble && !p.down) p.stumble({ x: px / pl, z: pz / pl }, Math.min(0.5, sp * 0.15));
      }
    }
  }

  _drive(a, dt, wp, p) {
    if (a.remote) { this._place(a, dt); return; }        // someone else's agent: crowdsync has put it where its owner says
    if (a.shove) { this._shoved(a, dt, wp); return; }      // shunted by a car (systems/vehicles.js): sliding, then a pause
    if (a.honkDelay > 0 && (a.honkDelay -= dt) <= 0) { a.honkDelay = 0; this._honk(a, wp); }
    if (!a.lane) return;                          // waiting at a taxi rank: parked, engine ticking over
    const g = this.game; let l = a.lane;
    const fx = Math.sin(a.heading), fz = Math.cos(a.heading), lx = fz, lz = -fx;
    // desired speed
    let vt = a.kind === 'bike' ? a.pref : a.type === 'bus' ? Math.min(a.pref, l.vmax) : l.vmax * a.pref;
    if (a.type === 'bus' && l.stops && !this._ghost) vt = this._busStop(a, l, vt, dt, wp);
    if (a.yieldT > 0) {
      // pulled over for a police car: hug the kerb and crawl
      a.yieldT -= dt; vt = Math.min(vt, 1.2);
      a.offT = Math.max(l.off, l.e.w / 2 - a.radius - 0.25);
      if (a.yieldT <= 0) { a.yieldT = 0; a.offT = this.laneOff(a, l); }
    }
    if (a.next && a.next2 === undefined) a.next2 = this.choose(a.next, a);
    // lateral offset (pulling in at a stop, hugging the kerb for blue lights, going round something stopped, squeezing past
    // oncoming traffic): eased, and slower when crawling, so it is steered; held while something is alongside on that side;
    // never further over than the walls allow (clampOff)
    this._ease(a, l, dt);
    this.lanePosX(l, a.s, a.off, _o);
    const lpx = _o.x, lpz = _o.z, ldx = _o.dx, ldz = _o.dz, toV = _o.toV;          // our point on the lane line, its direction, the distance to the next vertex (reused below)
    // bends inside the edge
    const bend = this.bend(l, _o.vi);
    if (bend > 0.25) vt = Math.min(vt, Math.sqrt(cornerV(bend, a) ** 2 + 2 * 2.5 * _o.toV));
    // radius of the tightest corner being turned or about to be (a real lock cannot always make it: see the steering below)
    let tight = a.j0.t > 0 ? a.j0.r : a.tightD > 0 ? 2.2 : 1e9;
    if (a.tightD > 0) a.tightD -= a.speed * dt;
    if (bend > 0.7 && _o.toV < 5) tight = Math.min(tight, 2.6);
    // junction at the end of the lane
    if (a.next) {
      const c = l.edx * a.next.sdx + l.edz * a.next.sdz, ang = Math.acos(clamp(c, -1, 1));
      let vc = a.next.e === l.e ? Math.min(a.kind === 'bike' ? 2.4 : 1.8, a.uR * 1.2) : cornerV(ang, a);          // turning round at a dead end: walking pace
      const J = a.j1;
      if (J.l === l && J.n === a.next && J.t > 0) vc = Math.min(vc, Math.sqrt(LAT(a) * J.r) * 0.95);                 // what the corner arc allows
      else if (ang > 0.6 && a.next.e !== l.e) vc = Math.min(vc, a.kind === 'bike' ? 2.6 : 2.4);                    // no room for an arc: creep round
      const toArc = l.len + J.u - J.t - a.s;
      if (J.l === l && J.n === a.next && toArc < a.wb / 2 + 6) tight = Math.min(tight, J.t > 0 ? J.r : ang > 0.6 && a.next.e !== l.e ? 2.2 : 1e9);
      vt = Math.min(vt, Math.sqrt(vc * vc + 2 * 2.5 * Math.max(0, toArc)));
      // ... and for the corner after that, when the next lane is a short one (junctions are often several short links)
      const n = a.next, m = a.next2;
      if (m && n.len < 45 && m.e !== n.e && J.l === l && J.n === n) {
        const c2 = n.edx * m.sdx + n.edz * m.sdz;
        if (c2 < 0.94) {
          const K = this._junc(a, a.j2, n, J.b, m);
          let v2 = cornerV(Math.acos(clamp(c2, -1, 1)), a);
          if (K.t > 0) v2 = Math.min(v2, Math.sqrt(LAT(a) * K.r) * 0.95); else if (c2 < 0.82) v2 = Math.min(v2, a.kind === 'bike' ? 2.6 : 2.4);
          vt = Math.min(vt, Math.sqrt(v2 * v2 + 2 * 2.5 * Math.max(0, l.len + J.u - a.s + n.len - J.w + K.u - K.t)));
        }
      }
    }
    if (a.next && !this._ghost) vt = this._mouth(a, l, vt, dt);
    if (a.uturn) {
      // turning round in the road (see _junc), at walking pace
      vt = Math.min(vt, a.kind === 'bike' ? 2.4 : 1.8, a.uR * 1.2);
    }
    // no faster than the bend being steered allows (lateral acceleration)
    {
      const kap = Math.abs(Math.tan(a.steer)) / a.wb;
      if (kap > 0.004) vt = Math.min(vt, Math.max(1.5, Math.sqrt(LAT(a) / kap)));
    }
    if (!this._ghost) { vt = this._obstacles(a, l, dt, wp, p, fx, fz, lx, lz, vt); if (a.bye) return; }
    // accelerate (eased in from rest and into the cruising speed) / brake
    const acc = a.kind === 'bike' ? 1.6 : a.type === 'bus' ? 1.3 : 2.4, brk = a.held || a.hail ? (a.kind === 'bike' ? 6 : 9) : a.kind === 'bike' ? 4 : 6.5;
    if (a.speed < vt) {
      a.acc += (acc * Math.min(1, (vt - a.speed) * 1.2 + 0.12) - a.acc) * Math.min(1, dt * 3.5);
      a.speed = Math.min(vt, a.speed + a.acc * dt);
    } else { a.acc = 0; a.speed = Math.max(vt, a.speed - brk * dt); }

    // ---- steer: point the front wheel (through a short lag) at the path a little way ahead of the front axle
    const kind = a.kind, bus = a.type === 'bus', wb = a.wb, hw = wb / 2, sp = a.speed;
    const Ld = kind === 'bike' ? clamp(1.3 + 0.38 * sp, 1.8, 4.2) : bus ? clamp(3.2 + 0.5 * sp, 4, 8) : clamp(1.7 + 0.5 * sp, 2.6, 7);
    this._pathPoint(a, hw + Ld, _t);
    let de = wrap(Math.atan2(_t.x - (a.x + fx * hw), _t.z - (a.z + fz * hw)) - a.heading);
    // (pure pursuit from the front axle cuts the inside of every curve - a bus by 2 m where a street curves over several
    // short stretches, as St Aldate's into the High at Carfax: its middle on the crown of the road, face to face with the
    // oncoming queue. So the middle of the vehicle is held to the path too: a cross-track term, as a driver swings the
    // front out so the body follows the lane. Not while turning round or backing.)
    if (!a.uturn && sp > 0.3 && kind !== 'bike') {
      // (the path where we are: off the corner arcs it is the lane point worked out above - no second lanePos)
      const P0 = a.j0, J1 = a.j1, offArc = !(P0.t > 0 && a.s < P0.w + P0.t) && !(J1.t > 0 && J1.l === l && a.s > l.len + J1.u - J1.t);
      let px, pz, pdx, pdz;
      if (offArc) { px = lpx; pz = lpz; pdx = ldx; pdz = ldz; } else { this._pathPoint(a, 0, _t); px = _t.x; pz = _t.z; pdx = _t.dx; pdz = _t.dz; }
      const e = (a.x - px) * pdz - (a.z - pz) * pdx;       // + = left of the path
      if (e > 0.15 || e < -0.15) de -= Math.atan((bus ? 2.4 : 1.6) * (e - (e > 0 ? 0.15 : -0.15)) / (sp + 1));
    }
    // lock: a real one, opened up for the turn-round at a dead end and for an agent that has strayed off its line
    // (and never more than the speed allows: v^2 * curvature stays under ~0.4 g, so a corner taken too fast runs wide, not round)
    let dmax = kind === 'bike' ? 0.95 : bus ? 0.8 : 0.62;
    if (a.uturn) dmax = Math.max(dmax, Math.atan(wb / a.uR));
    else if (a.stray > 1.5) dmax = Math.max(dmax, Math.atan(wb / (kind === 'bike' ? 1.1 : 2.6)));
    else if (tight < 1e9) dmax = Math.max(dmax, Math.atan(wb / Math.max(1.3, tight * 0.85)));       // a corner tighter than the lock: cheat the lock, not the kerb
    dmax = Math.min(dmax, Math.atan((bus ? 2.6 : 4.2) * wb / (sp * sp + 0.5)), Math.atan((bus ? 0.7 : kind === 'bike' ? 1.5 : 1.3) * wb / (sp + 0.05)));     // ... nor spin faster than ~75 deg/s (bus 40)
    de = clamp(de, -dmax, dmax);
    if (sp < 0) de = 0;                               // backing off: straight back
    // turning round: always to the right, across the road (we keep left), whatever way the road bends at its end
    if (a.uturn && fx * ldx + fz * ldz < 0.2) de = -dmax;
    {
      // a lag, then a rate limit that tightens with speed (bounded yaw acceleration): no twitching at 30 mph
      const want = (de - a.steer) * (1 - Math.exp(-dt / (kind === 'bike' ? 0.13 : bus ? 0.3 : 0.2)));
      const rate = Math.min(kind === 'bike' ? 3 : bus ? 0.9 : 1.6, ((kind === 'bike' ? 5 : bus ? 1.6 : 3) * wb) / Math.max(1, sp)) * dt;
      a.steer += a.uturn ? clamp(want, -rate * 3, rate * 3) : clamp(want, -rate, rate);      // (hand over hand when turning round)
    }
    // ---- move: the rear axle runs along the heading, the heading turns with the front wheel
    const step = sp * dt, yaw = (sp * Math.tan(a.steer)) / wb;
    // (turning round at a dead end the pivot moves to the middle of the vehicle: no car could do it, but it stays in the road)
    // (eased both ways, so the middle of the vehicle never changes velocity in a step)
    a.pv += ((a.uturn || (a.next && a.next.e === l.e && a.j1.l === l && l.len + a.j1.u - a.s < 5) ? 0 : hw) - a.pv) * Math.min(1, dt * 2.5);
    const pv = a.pv, rx = a.x - fx * pv + fx * step, rz = a.z - fz * pv + fz * step, ox = a.x, oz = a.z, oh = a.heading;
    a.heading = wrap(a.heading + yaw * dt); a.yaw = yaw;
    let nfx = Math.sin(a.heading), nfz = Math.cos(a.heading);
    a.x = rx + nfx * pv; a.z = rz + nfz * pv;
    // the last word: never move a body (as drawn, an oriented box) further into another vehicle's. Whatever the rules
    // above missed (a corner swept wide, someone else's lane change), the move is not made and we stand.
    if (step !== 0 && !this._ghost && this._intrudes(a, ox, oz, oh)) {
      // (first try the same step straight on: it is usually the swing of the turn that touches)
      a.heading = oh; a.x = ox + fx * step; a.z = oz + fz * step;
      if (this._intrudes(a, ox, oz, oh)) { a.x = ox; a.z = oz; a.speed = 0; a.acc = 0; a.intrT += dt; a.why = a.intrRef = this._hitRef; }
      else if (Math.abs(a.x - ox) + Math.abs(a.z - oz) < Math.abs(step) * 0.5) { a.intrT += dt; a.intrRef = this._hitRef; }    // (let through, but hardly moving: still blocked)
      else if (Math.abs(step) > 0.004) a.intrT = 0;
      a.yaw = 0; a.steer *= 0.5; nfx = fx; nfz = fz;
    } else if (Math.abs(step) > 0.004 || !(a.intrT > 0)) a.intrT = 0;     // (not by the first creep of a restart: it touched again a frame later, and the "touching" remedies never fired)
    // (children and animals: never a move on to one, whatever the rules above have made of them - systems/_ped_protect.js)
    if (step !== 0 && this._prot && this._prot.blocks(a, a.x - ox, a.z - oz)) { a.x = ox; a.z = oz; a.heading = oh; a.speed = 0; a.acc = 0; a.yaw = 0; nfx = fx; nfz = fz; }
    // (2026-11: a move cancelled by the backstop counts as being held up - the stuck timer rises and the usual remedies
    // fire. It used to reset itself each frame: one left touching a cyclist after a shunt sat there for ever.)
    // ---- where that puts us along the path (never backwards): round the corner being left, along the lane, into the next corner
    {
      const P = a.j0, n = a.next;
      let s = a.s + step, onArc = false;
      if (P.t > 0) {
        if (a.s >= P.w + P.t) P.t = 0;
        else { const f = this._arcF(P, a.x, a.z); if (f > 0.25 && f < 1) { s = P.w - P.t + 2 * P.t * f; onArc = true; } }
      }
      if (!onArc) {
        s = a.s + (a.x - lpx) * ldx + (a.z - lpz) * ldz;            // one Newton step from where we were on the line: exact on a straight
        if (bend > 0.3 && toV < 6 && s < a.s + toV && a.s >= 0 && a.s <= l.len) {
          // a sharp bend inside the edge, cut on the inside: our projection onto this stretch never reaches the vertex, so
          // once we are past it along the next stretch and pointing more its way, carry on from there
          this.lanePos(l, a.s + toV + 0.02, a.off, _o);
          const p2 = (a.x - _o.x) * _o.dx + (a.z - _o.z) * _o.dz;
          if (p2 > 0 && nfx * _o.dx + nfz * _o.dz > nfx * ldx + nfz * ldz) s = a.s + toV + 0.02 + p2;
        }
        if (n && n.e !== l.e) {
          const J = this._junc(a, a.j1, l, a.off, n), end = l.len + J.u;
          if (J.t > 0 && s > end - J.t) { const f = this._arcF(J, a.x, a.z); if (f > 0 && f < 0.9) s = end - J.t + 2 * J.t * f; }
        }
      }
      if (s > a.s) { if (s > a.s + step * 0.2) a.lostT = 0; a.s = Math.min(s, a.s + step + 1.5); }
      // moving but getting nowhere along the lane (should not happen: a safety net against circling a point for ever):
      // open the lock, and if that does not help and nobody is near, bow out
      if (sp > 1 && (a.lostT += dt) > 4) { a.stray = Math.max(a.stray, 2); if (a.lostT > 10 && Math.abs(a.x - wp.x) + Math.abs(a.z - wp.z) > 90) { a.lane = null; a.bye = true; return; } }
      // strayed off the line (spawned off it, shoved, a turn too tight for the lock): note it, so the lock opens up until back
      // on line. Not while rounding a corner arc, which leaves the straight lane line on purpose.
      const lat = Math.abs((a.x - lpx) * ldz - (a.z - lpz) * ldx);
      if (lat < 0.7) a.stray = 0;
      else if (lat > 2.2 && sp > 0.5 && !onArc && !(n && a.j1.t > 0 && a.j1.l === l && a.s > l.len + a.j1.u - a.j1.t)) a.stray += dt;
      if (a.uturn && nfx * ldx + nfz * ldz > 0.96 && lat < 1.2) a.uturn = false;         // round, and back on our side of the road
    }
    let guard = 0;
    while (guard++ < 4) {
      const n = a.next;
      if (!n) { if (a.s >= l.len) { a.lane = null; a.bye = true; return; } break; }
      const J = this._junc(a, a.j1, l, a.off, n), end = l.len + J.u;
      let ns = J.w + (a.s - end), go = a.s >= end;
      if (!go && end - a.s < 6 && n.e !== l.e && l.edx * n.sdx + l.edz * n.sdz < 0.94) {
        // cutting the corner (no arc here, or we are well inside it): once past the start of the new lane (the end of the arc)
        // and pointing more its way than the old one's
        this.lanePosX(n, J.w, J.b, _o);
        const sn = (a.x - _o.x) * _o.dx + (a.z - _o.z) * _o.dz;
        if (sn > J.t && nfx * n.sdx + nfz * n.sdz > nfx * l.edx + nfz * l.edz) { go = true; ns = J.w + sn; }
      }
      if (!go) break;
      a.uturn = n.e === l.e;
      a.tightD = J.t === 0 && !a.uturn && l.edx * n.sdx + l.edz * n.sdz < 0.8 ? 6 : 0;      // a sharp corner with no room for an arc: keep the lock open through it
      // (the junction box turned through is held until the tail is clear of it)
      if (a.bxN === l.to && a.bxN.box && a.bxN.box.mv[a.bxM].o === n) { a.bxPN = a.bxN; a.bxPM = a.bxM; this._reg(a.bxPN, a, 2, this._frame); }
      a.bxN = null; a.bxC = false; a.bxW = 0;
      a.prevLane = l; a.lane = l = n; a.next = a.next2 || null; a.next2 = undefined;
      a.s = ns; a.off = J.b; a.offT = this.laneOff(a, l);
      // the corner just turned becomes the one being left; the one after becomes the next
      const t0 = a.j0; a.j0 = J; a.j1 = a.j2; a.j2 = t0; t0.l = null;
      if (a.j1.l !== l || a.j1.o !== a.off) a.j1.l = null;
      if (a.next && a.next2 === undefined) a.next2 = this.choose(a.next, a);
    }
    if (!this._ghost) this._place(a, dt);
  }

  // ------------------------------------------------------------ the shared neighbour grid + the obstacle rules
  _buildGrid(p) {
    const G = this.grid, g = this.game; G.clear();
    const L = this.list;
    const fr = (this._frame = (this._frame || 0) + 1);
    // wet / icy roads (systems/weather.js, game.weather.grip 1 dry .. ~0.6 snow): corners and bends taken a little slower
    // (lateral acceleration scales with the grip), so the traffic eases off rather than slides. No weather: exactly 1.
    _wetK = g.weather && g.weather.grip < 1 ? Math.max(0.5, g.weather.grip) : 1;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (!a.active) continue;
      if (a.lane && Math.abs(a.speed) < 1.5) {
        // the tail of the queue on each lane (keep-clear rule in _drive): the smallest distance along it of a slow vehicle
        const l = a.lane, q = a.s - a.half - a.radius;
        if (l.qF !== fr) { l.qF = fr; l.qS = q; l.qA = a; } else if (q < l.qS) { l.qS = q; l.qA = a; }
      }
      if (a.lane && !a.remote) this._register(a, fr);
      const sh = a.shove, v = sh ? sh.vx * Math.sin(a.heading) + sh.vz * Math.cos(a.heading) : a.speed;
      G.add(a, a.type === 'bus' ? K_BUS : a.kind === 'bike' ? K_BIKE : K_CAR, a.x, a.z, a.heading, a.half, a.radius, v);
    }
    const V = g.vehicles, vl = V && V.list;
    if (vl) for (let i = 0; i < vl.length; i++) {
      const v = vl[i]; if (v.kind === 'punt') continue;
      const T = TYPES[v.type]; if (!T) continue;
      const mine = v === p.vehicle || v.driver === 'player';
      if (mine && p.place !== 'world') continue;
      const sp = Number.isFinite(v.vx) ? v.vx * Math.sin(v.heading) + v.vz * Math.cos(v.heading) : (v.speed || 0);
      G.add(v, mine ? K_PVEH : K_LIVE, v.x, v.z, v.heading, Math.max(0, T.L / 2 - T.W / 2), T.W / 2 + 0.05, sp);
    }
    // parked cars (static slots) near the player: obstacles to stop short of / go round, and solid for _intrudes
    // (only the kerbside ones: car-park rows are off the road; the list is refreshed when the player has moved 25 m)
    if (V && V._sys && V._sys.pools) {
      const S = V._sys, K = this._kerb || (this._kerb = { x: 1e9, z: 1e9, list: [] });
      if (Math.abs(p.pos.x - K.x) + Math.abs(p.pos.z - K.z) > 25 || fr % 150 === 0) {
        K.x = p.pos.x; K.z = p.pos.z; K.list.length = 0;
        this._pkFn = this._pkFn || ((q) => { if (q.kerb) this._kerb.list.push(q); });
        if (!this._carPools) { this._carPools = []; for (const pl of S.pools.values()) { const T = TYPES[pl.type]; if (T && T.kind === 'car') this._carPools.push(pl); } }
        // (busy-streets pass: the kerbs are lined now - a few thousand cars - so the nearest PARK_GRID within 230 m: the
        // neighbour index holds 1024 footprints, and the walkers and the player are added after these)
        const lowT = OLD_TIERS && this._tier === 'low', cap = lowT ? PARK_GRID_LOW : PARK_GRID;      // (the same parked cars are known to the traffic on every tier)
        for (let i = 0; i < this._carPools.length; i++) this._carPools[i].grid.each(p.pos.x, p.pos.z, BUSY ? (lowT ? 170 : 230) : 300, this._pkFn);
        if (K.list.length > cap) {
          const px = p.pos.x, pz = p.pos.z;
          for (const q of K.list) q._kd = (q.x - px) * (q.x - px) + (q.z - pz) * (q.z - pz);
          K.list.sort((a, b) => a._kd - b._kd); K.list.length = cap;
        }
      }
      for (let i = 0; i < K.list.length; i++) {
        const q = K.list[i]; if (q.taken) continue;
        const T = TYPES[q.type]; G.add(q, K_LIVE, q.x, q.z, q.h, Math.max(0, T.L / 2 - T.W / 2), T.W / 2, 0);
      }
    }
    // knocked street furniture lying about (systems/props.js): a fallen lamp column, a bin on its side, a bench in the road
    // are obstacles like any other (stopped short of, gone round when there is room)
    const PL = g.props && g.props.live;
    if (PL && PL.length) for (let i = 0; i < PL.length; i++) {
      const q = PL[i], K = q.K, b = q.body;
      if (q.ball || !K || K.mass < 8 || !b || q.parent) continue;
      const x = b.p[0], z = b.p[2]; if (Math.abs(x - p.pos.x) > 220 || Math.abs(z - p.pos.z) > 220) continue;
      const up = Math.abs(b.upY) > 0.7, r = K.shape === 'sphere' ? K.r || 0.3 : K.shape === 'box' ? (up ? Math.max(K.h[0], K.h[2]) : Math.max(K.h[0], K.h[1], K.h[2])) : up ? Math.max(K.r0 || 0.2, K.r1 || 0.2) : Math.min(2.6, (K.y1 - K.y0) / 2);
      if (r === r) G.add(q, K_LIVE, x, z, 0, 0, Math.max(0.25, r), 0);
    }
    // people, with whether they are out on a carriageway (worked out once here, not per vehicle looking at them)
    const PS = g.pedestrians && g.pedestrians._sys, road = PS && PS.road ? PS : null, peds = g.pedestrians && g.pedestrians.list;
    if (peds) for (let i = 0; i < peds.length; i++) {
      const q = peds[i]; if (!q.active || q.place !== 'world') continue;
      const k = G.add(q, K_PED, q.x, q.z, q.heading, 0, q.child ? 0.42 : 0.28, q.down ? 0 : q.speed || 0);      // (a wider berth for a child)
      if (k >= 0 && road) {
        // (re-tested only once the walker has moved 0.3 m)
        if (Math.abs(q.x - q.rdX) + Math.abs(q.z - q.rdZ) > 0.3) { q.rdX = q.x; q.rdZ = q.z; q.rdV = road.road(q.x, q.z); }
        G.ROAD[k] = q.rdV ? 1 : 0;
      }
    }
    // animals (dogs on and off the lead, cats, a tortoise: game.pedestrians.animals): stopped for and gone round as people are
    const AN = g.pedestrians && g.pedestrians.animals; this._prot = (g.pedestrians && g.pedestrians.protect) || null;
    if (AN) for (let i = 0; i < AN.length; i++) { const q = AN[i]; if (Math.abs(q.x - p.pos.x) > 220 || Math.abs(q.z - p.pos.z) > 220) continue; const k = G.add(q, K_PED, q.x, q.z, 0, 0, q.r + 0.1, 0); if (k >= 0 && road) G.ROAD[k] = road.road(q.x, q.z) ? 1 : 0; }
    if (p.place === 'world' && !p.vehicle) { const k = G.add(p, K_PLAYER, p.pos.x, p.pos.z, p.heading, 0, 0.32, p.speed || 0); if (k >= 0 && road) G.ROAD[k] = road.road(p.pos.x, p.pos.z) ? 1 : 0; }
    const R = this._S ? this._S.core.remotes : null;
    if (R) for (let i = 0; i < R.length; i++) {
      const q = R[i], T = q.veh && TYPES[q.veh] && TYPES[q.veh].kind !== 'punt' ? TYPES[q.veh] : null;
      G.add(q, K_REMOTE, q.x, q.z, q.h, T ? Math.max(0, T.L / 2 - T.W / 2) : 0, T ? T.W / 2 + 0.1 : 0.4, q.speed || 0);
    }
  }
  /** junction boxes and single-track runs (see _runs): who is at which this frame */
  _register(a, fr) {
    const l = a.lane;
    // the box being cleared (the junction just turned through): until the tail is BOXL m into the lane out
    if (a.bxPN) { const m = a.bxPN.box.mv[a.bxPM]; if (l !== m.o || a.s - a.half - a.radius > BOXL) a.bxPN = null; else this._reg(a.bxPN, a, 2, fr); }
    // the box ahead: from BOXL m (plus braking) before the node
    const nx = a.next, n = l.to;
    if (nx && nx.e !== l.e && l.len - a.s - 3 * (a.half + a.radius) < BOXL + 6 + a.speed * a.speed / 5) {
      if (a.bxN === n && a.bxL === l && a.bxX === nx) this._reg(n, a, a.bxC ? 1 : 0, fr);       // (same movement as last frame)
      else {
        const B = n.box === undefined ? this._box(n) : n.box, k = B ? B.idx.get(l.id * 65536 + nx.id) : undefined;
        if (k !== undefined) { a.bxN = n; a.bxM = k; a.bxC = false; a.bxW = 0; a.bxL = l; a.bxX = nx; this._reg(n, a, 0, fr); }
        else a.bxN = null;
      }
    } else a.bxN = null;
    // single-track run: in it, or committed to entering it; the one that has waited longest at a mouth claims the next turn
    const R = l.run;
    if (R) this._occ(R, a, l.rd, fr);
    if (a.runC) { if (a.runC === R || !nx || nx.run !== a.runC) a.runC = null; else this._occ(a.runC, a, a.runD, fr); }
    if (a.runW > 5 && nx && nx.run && nx.run !== R) { const Q = nx.run; if (Q.clF !== fr || a.runW > Q.clW) { Q.clF = fr; Q.clW = a.runW; Q.clD = nx.rd; Q.clR = a.radius; Q.clA = a; } }
  }
  /** a run's free width with the kerbside parked cars along it (static bays: vehicles.js lays them after we are installed,
   *  so this is worked out the first time anyone comes to the run): a street wide enough to pass in is not, with a row of
   *  parked cars down one side (Turl Street) */
  _runParked(R) {
    R.Fp = true;
    const V = this.game.vehicles && this.game.vehicles._sys, pools = V && V.pools; if (!pools) return;
    const cars = []; for (const pl of pools.values()) { const T = TYPES[pl.type]; if (T && T.kind === 'car' && pl.grid) cars.push(pl); }
    for (const e of R.edges) {
      const l = e.lanes[0].dir > 0 ? e.lanes[0] : e.lanes[1];
      for (let s = 1; s < e.len - 1; s += 2) {
        this.lanePos(l, s, 0, _q2);
        const px = _q2.x, pz = _q2.z, nx = _q2.dz, nz = -_q2.dx;          // (left of the drawn direction)
        let fl = e.freeL, fr = e.freeR;
        for (const pl of cars) pl.grid.each(px, pz, 5, (q) => {
          if (!q.kerb) return;
          const T = TYPES[q.type], dx = q.x - px, dz = q.z - pz, along = Math.abs(dx * _q2.dx + dz * _q2.dz), lat = dx * nx + dz * nz;
          if (along > T.L / 2 + 0.5) return;
          const inner = Math.abs(lat) - T.W / 2;
          if (lat > 0) fl = Math.min(fl, inner); else fr = Math.min(fr, inner);
        });
        if (fl + fr < R.F) R.F = fl + fr;
      }
    }
  }
  _reg(n, a, role, fr) { if (n.bxF !== fr) { n.bxF = fr; n.bxA.length = 0; n.bxR.length = 0; } n.bxA.push(a); n.bxR.push(role); }
  _occ(R, a, d, fr) {
    if (R.occF !== fr) { R.occF = fr; R.np = R.nm = 0; R.rp = R.rm = 0; R.ap = R.am = null; }
    if (d > 0) { R.np++; if (a.radius > R.rp) R.rp = a.radius; R.ap = a; } else { R.nm++; if (a.radius > R.rm) R.rm = a.radius; R.am = a; }
  }
  /**
   * What is in agent a's way (see the comment in _drive). Returns the scratch _scanR: gap (m to stop short of the nearest
   * thing in the corridor, minus the standstill margin), cap (a speed cap while going round / squeezing), byPlayer / byHeld,
   * pred (the nearest is only predicted to cross), face (the nearest is coming the other way or across, and stopped too:
   * backing off may help). Sets a.passOff (the lateral move round something) and a.latT / latS (lateral move held).
   */
  _scan(a, l, fx, fz, lx, lz, look, dt, p) {
    const G = this.grid, R = _scanR, I = this._gi, bike = a.kind === 'bike', ar = a.radius, front = a.half + ar;
    R.gap = Infinity; R.ref = null; R.refAI = false; R.refPed = false; R.cap = Infinity;
    // (a walker who has stood in front of us for a while - waiting for us, or stood against our nose - is something to go
    // round, slowly and wide, like anything else standing still; see _obstacles)
    const pwo = a.pwT > 5 ? a.pwRef : null; R.byPlayer = false; R.byHeld = false; R.pred = false; R.face = false;
    let bi = -1, bl0 = 0, bl1 = 0, bf1 = 0, bdot = 1;
    // the path ahead as two lateral offsets from the straight-ahead line (so the corridor bends with the road / the turn)
    // (worked out every fourth frame, staggered, as world points: the path does not change much in 0.1 s)
    if (a.pathT === 0 || (this._frame + a.uid) % 4 === 0 || a.pathL !== l) {
      a.pathL = l;
      this._pathPoint(a, Math.max(4, look * 0.45), _q); a.p1x = _q.x; a.p1z = _q.z;
      this._pathPoint(a, look + front, _q); a.p2x = _q.x; a.p2z = _q.z; a.pathT = 1;
    }
    const y1 = (a.p1x - a.x) * lx + (a.p1z - a.z) * lz, x1 = Math.max(1, (a.p1x - a.x) * fx + (a.p1z - a.z) * fz);
    const y2 = (a.p2x - a.x) * lx + (a.p2z - a.z) * lz, x2 = Math.max(x1 + 1, (a.p2x - a.x) * fx + (a.p2z - a.z) * fz);
    // lateral move still to make (pulling in / out, going round): the corridor is widened that way
    const dl = this.clampOff(a, l, a.offT + a.passOff) - a.off;
    // candidates: the cells under the corridor (from just behind us to the end of the look-ahead, bent ends included),
    // widened by the largest footprint (a bus: 6.6 m) and the lateral move
    const ex = a.x + fx * (look + front), ez = a.z + fz * (look + front), bx = a.x - fx * front, bz = a.z - fz * front, wm = 6 + 0.35 * look + Math.abs(dl);      // (crossing traffic is seen coming from the side)
    const n = G.gatherBox(Math.min(bx, ex, a.p2x) - wm, Math.min(bz, ez, a.p2z) - wm, Math.max(bx, ex, a.p2x) + wm, Math.max(bz, ez, a.p2z) + wm, I);
    const pred = !(a.predOffT > 0), PM = this.game.pedestrians && this.game.pedestrians._sys && this.game.pedestrians._sys.road ? this.game.pedestrians._sys : null;
    for (let j = 0; j < n; j++) {
      const i = I[j], o = G.ref[i]; if (o === a || o === a.ignoreRef) continue;
      const k = G.K[i], person = k === K_PED || k === K_PLAYER || (k === K_REMOTE && G.HALF[i] === 0), ov = G.V[i];
      if (person && G.ROAD[i] === 0 && (ov < 0.6 || !pred)) continue;          // (standing / strolling on the pavement: not our business)
      const ofx = G.FX[i], ofz = G.FZ[i], oh = G.HALF[i], or = G.R[i];
      const dx = G.X[i] - a.x, dz = G.Z[i] - a.z, fc = dx * fx + dz * fz;
      // people count only on the carriageway (or about to step on to it, see the prediction): a corner being turned
      // sweeps over the pavement where people stand and wait for us to pass
      const onRoad = G.ROAD[i] === 1;
      // its segment's ends in our frame, laterally relative to the path (the corridor bends with the road): exact extents,
      // and the stretch of it that is inside the corridor band (a bus at an angle is not a 13 m wide box)
      const dot = ofx * fx + ofz * fz, sl = ofx * lx + ofz * lz, lr = dx * lx + dz * lz;
      const e1f = fc - dot * oh, e2f = fc + dot * oh;
      const e1l = lr - sl * oh - pathY(e1f, x1, y1, x2, y2), e2l = lr + sl * oh - pathY(e2f, x1, y1, x2, y2);
      let fMin = (e1f < e2f ? e1f : e2f) - or, fMax = (e1f < e2f ? e2f : e1f) + or;
      if (fMax < -front || fMin > look + front) continue;
      const lMin = (e1l < e2l ? e1l : e2l) - or, lMax = (e1l < e2l ? e2l : e1l) + or;
      const m = person ? 0.45 : k === K_LIVE && ov === 0 ? 0.08 : bike || k === K_BIKE ? 0.25 : 0.3;      // (parked: kerbside, a hand's width is enough)
      const cL = ar + m + (dl > 0 ? dl : 0), cR = -ar - m + (dl < 0 ? dl : 0);
      const inBand = onRoad && bandT(e1l, e2l, cR - or, cL + or, _bt);
      if (inBand) { const fa = e1f + (e2f - e1f) * _bt.t0, fb = e1f + (e2f - e1f) * _bt.t1; fMin = (fa < fb ? fa : fb) - or; fMax = (fa < fb ? fb : fa) + or; }
      if (inBand && fMax > -front && fMin < look + front) {
        if (fMin < front - 0.05) {
          // alongside (or already touching): in the way of the lateral move only -> hold the move; overlapping our
          // straight-on footprint and ahead of our middle -> stop; otherwise it is behind us (its rules, not ours)
          if (!bandT(e1l, e2l, -ar - or - 0.05, ar + or + 0.05, _bt)) { if (fMax > -front) { a.latT = 0.3; a.latS = lMin >= 0 ? 1 : -1; } continue; }
          // (a stationary car - parked, abandoned, the player's - right in front of us is still something to go round: it
          // is remembered as the obstacle, so the going-round below can plan past it)
          if (fc > 0.2 && !person) { if (0 < R.gap) { R.gap = 0; R.ref = o; R.refAI = k <= K_BIKE; R.refPed = false; R.byHeld = k <= K_BIKE && o.held; R.byPlayer = k === K_PVEH || k === K_REMOTE; R.face = dot < 0.5; R.pred = false; bi = (k === K_LIVE || k === K_PVEH) && Math.abs(ov) < 0.3 && dot > 0.3 ? i : -1; if (bi >= 0) { bl0 = lMin; bl1 = lMax; bf1 = fMax; bdot = dot; } } }
          else if (person && fc > -0.2 && -1 < R.gap) { R.gap = -1; R.ref = o; R.refAI = false; R.refPed = k === K_PED; R.byPlayer = k === K_PLAYER || k === K_REMOTE; R.pred = false; bi = o === pwo ? i : -1; if (bi >= 0) { bl0 = lMin; bl1 = lMax; bf1 = fMax; bdot = 1; } }
          continue;
        }
        if (dot < -0.6 && !person && fMin > front + 0.5) {
          // oncoming, only clipping our corridor on the right: if moving over to the left clears it (both of us do: see the
          // squeeze below), creep past instead of stopping nose to nose for ever
          // (only a shallow clip, and only with the room on our left really free: a cyclist or a parked car there and we
          // could not move over, the two would meet corner to corner, each with a queue behind it)
          const room = l.freeL - ar - 0.12 - a.off;
          // (a cyclist is narrow enough to slip by along the kerb whatever the clip)
          if (lMax + ar + m < room && (bike || (lMax < 0.7 && this._bandClear(a, n, fx, fz, lx, lz, ar + 0.05, lMax + 2 * ar + m + 0.3, fMin + 2, fMin + 2, i)))) { if (R.cap > 2.5) R.cap = 2.5; continue; }
        }
        // (a bus pulls up well short of a vehicle left standing in its lane: it needs the length to swing out round it -
        // stopped a metre behind, with the queue closed up at its tail, it could neither turn nor back off)
        let gap = fMin - front - (person ? 1.6 : bike ? 0.7 : k === K_BIKE ? 1.0 : a.type === 'bus' && k === K_LIVE && ov === 0 ? 5 : 1.2);
        if (dot < -0.3 && ov > 0.5) gap -= ov * 1.2;            // coming at us: allow for it closing
        if (gap < R.gap) {
          R.gap = gap; R.ref = o; R.refAI = k <= K_BIKE; R.refPed = k === K_PED; R.byHeld = k <= K_BIKE && o.held; R.byPlayer = k === K_PVEH || k === K_PLAYER || k === K_REMOTE; R.pred = false; R.face = dot < 0.5 && (Math.abs(ov) < 0.4);
          bi = person && o !== pwo ? -1 : i; bl0 = lMin; bl1 = lMax; bf1 = fMax; bdot = o === pwo ? 1 : dot;
        }
        continue;
      }
      // not in the corridor now: will it cross it before we are past? (crossing traffic, merges, people stepping out)
      if (!pred || Math.abs(ov) < 0.6) continue;
      const vl = ov * (ofx * lx + ofz * lz), vf = ov * dot;
      let tIn, tOut;
      if (lMin >= cL && vl < -0.15) { tIn = (lMin - cL) / -vl; tOut = (lMax - cR) / -vl; }
      else if (lMax <= cR && vl > 0.15) { tIn = (cR - lMax) / vl; tOut = (cL - lMin) / vl; }
      else continue;
      if (tIn > 4) continue;
      const fIn = fMin + vf * tIn;
      if (fIn > look + front || fIn + (fMax - fMin) < front) continue;         // crosses beyond our look-ahead, or behind our nose
      if (person && !onRoad && PM && !PM.road(G.X[i] + ofx * ov * (tIn + 0.4), G.Z[i] + ofz * ov * (tIn + 0.4))) continue;   // (walking along the pavement)
      const va = Math.max(a.speed, 0.8), tA = Math.max(0, fIn - front) / va, tB = (fIn + (fMax - fMin) + front) / va;
      if (!(tIn < tB + 0.4 && tOut > tA - 0.4)) continue;
      // who goes first: whoever gets there first; the player / live vehicles / people as good as always; ties by road, then number
      let yieldMe;
      if (k === K_CAR || k === K_BUS || k === K_BIKE) yieldMe = tIn + 0.3 < tA || (Math.abs(tIn - tA) <= 0.3 && this._prioLower(a, o));
      else yieldMe = person ? tIn < tA + 0.6 : true;
      if (!yieldMe) continue;
      const gap = fIn - front - (person ? 1.2 : 1.0);
      if (gap < R.gap) { R.gap = gap; R.ref = o; R.refAI = k <= K_BIKE; R.refPed = false; R.byPlayer = k === K_PVEH || k === K_PLAYER || k === K_REMOTE; R.byHeld = false; R.pred = true; R.face = false; bi = -1; }
    }
    // ---- going round
    const was = a.passRef;
    let pass = 0;
    if (bi >= 0 && !R.pred && R.gap < 6 + a.speed) {
      const o = G.ref[bi], k = G.K[bi], ov = G.V[bi];
      // (a walker who has stood in our way for a while: gone round with a wide berth, at walking pace - ov is no guide, a
      // walker stood against a bumper still "walks" into it)
      const pw = o === pwo, pm = pw ? 0.4 : 0;
      const slow = pw || Math.abs(ov) < 0.4 || (k === K_BIKE && !bike && ov < a.pref * l.vmax * 0.6 && ov < 6.5);
      if (bdot > 0.3 && slow) {
        const base = this.clampOff(a, l, a.offT), room = l.freeL - ar - 0.12;
        // (2026-11-21: a vehicle left standing in the lane - parked out, abandoned - is steered round from as far off as
        // it is seen, not from a standstill behind it: stopping a car's length short and then swinging out put the
        // corner against its bumper, and with a queue behind (no backing off) each took a minute to scrape by)
        const early = k === K_LIVE && ov === 0 && a.type !== 'bus' && !pw;
        // (2026-11-24: stood for three seconds at something parked - shunted against a row of parked cars and left
        // beside it, the next car of the row a few centimetres nearer the lane than the one we are at - the rest of the row
        // does not close the way round: the band looked at began 5 cm beyond the flank of the one car, so a neighbour
        // standing 6 cm further out "was in it", no way round was ever found, and with a queue closed up behind (no
        // backing off either) the car stood there for good - tools/smoke_physics.mjs "shoved, stops, waits and carries
        // on" on the clock of 2026-11-24 14:00. The line driven keeps 0.35 / 0.4 m off the flank; stationary parked
        // bodies up to 0.2 m further out than it still leave a hand's width, which is what the corridor asks of them.)
        const rowTol = k === K_LIVE && ov === 0 && a.blockT > 3 ? 0.2 : 0;
        // a cyclist filters up the kerb side of anything stopped, when it fits; otherwise (and for motor traffic) round the
        // right of it, with the other side clear well beyond it
        if (bike && (pw || Math.abs(ov) < 0.6) && a.off + bl1 + ar + 0.3 + pm <= room && this._bandClear(a, n, fx, fz, lx, lz, bl1 + 0.05, bl1 + 2 * ar + 0.55 + pm, bf1 + 2, bf1 + 2, bi)) {
          pass = a.off + bl1 + ar + 0.3 + pm - base; a.passK = 1;
        } else if ((a.type !== 'bus' || ((k === K_LIVE || k === K_PVEH) && Math.abs(ov) < 0.3 && a.blockT > 6)) && (a.blockT > 1.2 || (k === K_BIKE && !bike) || early) && l.len - a.s > bf1 + (k === K_BIKE ? 22 + 4 * Math.max(4, a.speed) : 8) && (pw || k === K_LIVE || k === K_PVEH || (k === K_BIKE && !bike && (ov > 1.5 || ((!o.why || !o.why.lane) && !o.whyM))) || (k <= K_BIKE && ((k === K_BUS && o.dwell > 0) || o.shove || o.held || o.hail || !o.lane || (o.blockT > 6 && !o.why && !o.whyM))))) {
          // (2026-11-21: a bus too goes round a vehicle left standing in its lane - parked, abandoned, the player's - once it
          // has waited six seconds and the other side is clear, as its driver would: with five buses about instead of
          // four, one sat behind a car left on St Giles' with the whole street queued behind it. Never round traffic.)
          // (round a bus at its stop, a cyclist, a broken-down / shunted / abandoned car, someone stuck; never a queue at a
          // junction, nor a cyclist stopped in one (one stopped by something parked is gone round, with it); a moving cyclist only with the whole manoeuvre before the end of this
          // lane - no bend or junction ahead to bring someone the other way into it unseen: the Carfax bend - while
          // something standing still is gone round wherever the far side is clear, or the queue behind it never ends)
          const y = a.off + bl0 - ar - 0.4 - pm, lo = -(l.freeR - ar - 0.12);
          // (the other side clear far enough for someone coming at 10 m/s while we go by, and - when it takes us over to the
          // other half of a two-way road - a gap beyond it to pull back into: never left out on the wrong side, nose to nose
          // with the oncoming queue; past a row of parked cars on our own side there is none, and no need. Buses wait.)
          // (a bus keeps its wheels on the carriageway as drawn, a mirror's width over the line at most: the room between the walls may include the pavement)
          if (y >= lo && (a.type !== 'bus' || -y <= l.e.w / 2 - ar + 0.6) && this._bandClear(a, n, fx, fz, lx, lz, bl0 - 2 * ar - 0.8 - pm, bl0 - 0.05, bf1 + 6, bf1 + (k === K_BIKE && ov > 0.6 ? 30 + 6 * Math.max(4, a.speed) : 20 + 4 * Math.max(4, a.speed)), bi, undefined, -rowTol)
            && (l.e.oneway || y - ar > 0.1 || this._bandClear(a, n, fx, fz, lx, lz, -ar, ar, bf1 + 2 * front + 4, 0, bi))) { pass = y - base; a.passK = 2; }
        }
        // (something standing still - parked, abandoned, left askew by a shunt - with no way round on the right: round its
        // left if that side has room, as a cyclist filters; a queue is never gone round)
        if (!pass && !bike && (a.blockT > 1.2 || early) && (pw || ((k === K_LIVE || k === K_PVEH || (k <= K_BIKE && (o.shove || o.held || !o.lane))) && Math.abs(ov) < 0.4))
          && a.off + bl1 + ar + 0.35 + pm <= room && (a.type !== 'bus' || a.off + bl1 + ar + 0.35 + pm <= l.e.w / 2 - ar + 0.6) && this._bandClear(a, n, fx, fz, lx, lz, bl1 + 0.05, bl1 + 2 * ar + 0.4 + pm, bf1 + 3, bf1 + 3, bi, 0, rowTol)) {    // (only what is ahead of our middle: we go forwards round it)
          pass = a.off + bl1 + ar + 0.35 + pm - base; a.passK = 3;
        }
        if (pass) { a.passRef = o; R.gap = Infinity; R.face = false; R.cap = pw ? 1.6 : a.passK === 1 ? 3.2 : Math.abs(ov) < 0.4 ? 5 : R.cap; }
      }
    }
    if (!pass && was) {
      // still alongside / just ahead of the thing we are going round: keep the line until clear of it
      let still = false;
      for (let j = 0; j < n && !still; j++) {
        const i = I[j]; if (G.ref[i] !== was) continue;
        const dx = G.X[i] - a.x, dz = G.Z[i] - a.z, fc = dx * fx + dz * fz, ext = Math.abs(G.FX[i] * fx + G.FZ[i] * fz) * G.HALF[i] + G.R[i];
        if (fc + ext > -front - 0.8) still = true;
      }
      if (still) pass = a.passOff; else a.passRef = null;
    }
    // ---- squeezing left for oncoming traffic on a narrow street (both do the same)
    if (!pass) {
      let need = 0;
      for (let j = 0; j < n; j++) {
        const i = I[j], o = G.ref[i]; if (o === a) continue;
        const k = G.K[i]; if (k === K_PED || k === K_PLAYER) continue;
        const dot = G.FX[i] * fx + G.FZ[i] * fz; if (dot > -0.6) continue;
        const dx = G.X[i] - a.x, dz = G.Z[i] - a.z, fc = dx * fx + dz * fz;
        if (fc < -front || fc > 30) continue;
        const lMax = dx * lx + dz * lz + Math.abs(G.FX[i] * lx + G.FZ[i] * lz) * G.HALF[i] + G.R[i];
        const want = lMax + ar + 0.3;
        if (want > need) need = want;
      }
      if (need > 0) pass = Math.min(need + (a.off - this.clampOff(a, l, a.offT)), l.freeL - ar - 0.12 - this.clampOff(a, l, a.offT));
      if (pass < 0) pass = 0;
      // (only into room that is free: never in beside a bus at its stop or a parked car)
      if (pass > 0 && !this._bandClear(a, n, fx, fz, lx, lz, ar + 0.05, ar + 0.35 + need, 15, 15, -1)) pass = 0;
    }
    // (in 0.2 m steps, rounded away from the lane line: the offset settles instead of creeping every frame)
    a.passOff = pass === 0 ? 0 : pass > 0 ? Math.ceil(pass * 5) / 5 : Math.floor(pass * 5) / 5;
    return R;
  }
  /** does agent a's box at its new pose overlap a vehicle's box (an AI agent's live pose, a live / parked car) more than at
   *  the old pose (ox, oz, oh)? People are left to their own side-stepping (and every vehicle stops for them). */
  _intrudes(a, ox, oz, oh) {
    const G = this.grid, I = this._gk || (this._gk = new Int32Array(64)), hl = a.dl, hw = a.dw, e = hl + hw + 6.7;
    const n = G.gatherBox(a.x - e, a.z - e, a.x + e, a.z + e, I);
    for (let j = 0; j < n; j++) {
      const i = I[j], k = G.K[i]; if (k === K_PED || k === K_PLAYER || (k === K_REMOTE && G.HALF[i] === 0)) continue;
      const o = G.ref[i]; if (o === a) continue;
      let x, z, h, ohl, ohw;
      if (k <= K_BIKE) { x = o.x; z = o.z; h = o.heading; ohl = o.dl; ohw = o.dw; }                       // (its pose now: it may have moved this frame)
      else { x = G.X[i]; z = G.Z[i]; h = Math.atan2(G.FX[i], G.FZ[i]); ohl = G.HALF[i] + G.R[i]; ohw = G.R[i]; }
      if (Math.abs(x - a.x) > hl + hw + ohl + ohw || Math.abs(z - a.z) > hl + hw + ohl + ohw) continue;
      const dn = obb(a.x, a.z, a.heading, hl, hw, x, z, h, ohl, ohw);
      if (!(dn > 0.01)) continue;          // (no contact deeper than a centimetre now: the old pose need not be looked at)
      // (no new contact deeper than a centimetre, and never deeper than it already was: one that was shoved into a
      // touch may slide along or ease off, never press further in, not even a hair a frame)
      // (a hair a frame on top of the old depth lets one left touching another - after a shunt - ease its way out of it;
      // but only up to 2.5 cm: unbounded, that hair let two stood side by side creep 3-4 cm into each other over ten
      // seconds - the last vehicle-vehicle contacts at Carfax)
      const od = obb(ox, oz, oh, hl, hw, x, z, h, ohl, ohw);
      if (dn > 0.01 && dn > Math.max(0.01, od) + (od < 0.025 ? 1e-4 : 0)) { this._hitRef = o; return true; }
    }
    return false;
  }
  /** slide agent a straight away from body o (anything with x, z) by up to 0.5 m/s, if that is onto free ground and into
   *  nobody (the backstop's rule: never deeper into any box) */
  _separate(a, o, dt) {
    const dx = a.x - o.x, dz = a.z - o.z, d = Math.hypot(dx, dz); if (!(d > 1e-3)) return;
    const st = Math.min(0.03, 0.5 * dt), ox = a.x, oz = a.z;
    a.x += dx / d * st; a.z += dz / d * st;
    const col = this.game.worldCollider, fx = Math.sin(a.heading), fz = Math.cos(a.heading);
    let ok = !this.water.isWet(a.x, a.z) && !this._intrudes(a, ox, oz, a.heading);
    for (let i = -1; i <= 1 && ok; i++) ok = col.isFree(a.x + fx * a.half * i, a.z + fz * a.half * i, a.radius * 0.9);
    if (!ok) { a.x = ox; a.z = oz; }
  }
  /** is the band [l0, l1] (lateral, travel-left +) clear from just behind us to fAhead m ahead (fOnc m for oncoming things)?
   *  row: for stationary parked / abandoned bodies only, the band's l0 edge (row > 0) or l1 edge (row < 0) is moved in by
   *  that much - the rest of the row that the thing being gone round stands in (see the going round in _scan). */
  _bandClear(a, n, fx, fz, lx, lz, l0, l1, fAhead, fOnc, skip, back, row = 0) {
    const G = this.grid, I = this._gi, front = a.half + a.radius, behind = back === undefined ? front + 2 : back;
    for (let j = 0; j < n; j++) {
      const i = I[j]; if (i === skip || G.ref[i] === a) continue;
      if ((G.K[i] === K_PED || G.K[i] === K_PLAYER) && G.ROAD[i] === 0) continue;      // (people on the pavement: not in the way)
      const dx = G.X[i] - a.x, dz = G.Z[i] - a.z, fc = dx * fx + dz * fz, dot = G.FX[i] * fx + G.FZ[i] * fz;
      const ef = Math.abs(dot) * G.HALF[i] + G.R[i], el = Math.abs(G.FX[i] * lx + G.FZ[i] * lz) * G.HALF[i] + G.R[i], lc = dx * lx + dz * lz;
      if (row !== 0 && G.K[i] === K_LIVE && G.V[i] === 0) { if (row > 0 ? lc + el < l0 + row : lc - el > l1 + row) continue; }
      else if (lc + el < l0 || lc - el > l1) continue;
      if (fc + ef < -behind) continue;
      if (fc - ef > (dot < -0.3 ? fOnc : fAhead)) continue;
      return false;
    }
    // oncoming things beyond the gathered box (a long overtake looks further)
    if (fOnc > 30) {
      const cx = a.x + fx * fOnc * 0.6, cz = a.z + fz * fOnc * 0.6, m = G.gather(cx, cz, fOnc * 0.45, this._gj || (this._gj = new Int32Array(128)));
      for (let j = 0; j < m; j++) {
        const i = this._gj[j]; if (i === skip || G.ref[i] === a) continue;
        const dot = G.FX[i] * fx + G.FZ[i] * fz; if (dot > -0.3) continue;
        const dx = G.X[i] - a.x, dz = G.Z[i] - a.z, fc = dx * fx + dz * fz, lc = dx * lx + dz * lz, el = G.R[i] + G.HALF[i] * 0.5;
        if (fc > 0 && fc < fOnc && lc + el >= l0 && lc - el <= l1) return false;
      }
    }
    return true;
  }
  _prioLower(a, o) {
    const am = a.lane && a.lane.main, om = o.lane && o.lane.main;
    if (am !== om) return !am;
    return a.uid > (o.uid || 0);
  }
  /** held up against something that is not in a queue (a parked / shunted / stationary car), touching it or stood still
   *  at it: every move cancelled by the backstop, or wanting to go and getting nowhere. (What it is stuck at may be only
   *  what the backstop hit - a.intrRef: going round, the corridor ahead is clear and a.why is null, but the nose cannot
   *  swing out past the corner it is touching.) */
  _touching(a) {
    if (a.intrT > 1) return true;
    const w = a.why || a.intrRef;
    return a.stillT > 3 && !!w && !w.lane;
  }
  /** room to back off ~3 m? */
  _clearBehind(a, fx, fz, lx, lz) {
    // (never while turning round, nor when not lined up with the lane: straight back would leave the road)
    if (a.uturn || !a.lane) return false;
    this.lanePos(a.lane, a.s, a.off, _q2);
    // (touching something - left askew by a shunt against it - it may back away at an angle: walls, water and whatever
    // is behind are still checked, and the backstop never lets the reverse press further into anything)
    // (a reverse already under way keeps the kind it started as: moving, it is no longer "still")
    const touch = a.revT > 0 ? a.revTouch : this._touching(a);
    if (fx * _q2.dx + fz * _q2.dz < (touch ? 0.3 : 0.7) || Math.hypot(a.x - _q2.x, a.z - _q2.z) > (touch ? 6 : 2)) return false;     // (shoved into a parking bay it may be 4-5 m off its line: still in the street)
    const G = this.grid, I = this._gi, front = a.half + a.radius, room = touch ? 2 : 3.5;     // (the touching back-off is 1.4 s, ~1 m)
    const n = G.gather(a.x - fx * (front + 2), a.z - fz * (front + 2), 4, I);
    for (let j = 0; j < n; j++) {
      const i = I[j]; if (G.ref[i] === a) continue;
      // (its real extents along our axes: a parked car in the next bay back, beside our tail, used to count as right
      // behind us - its whole length taken as its width - and nobody parked beside a row could ever back off)
      const dx = G.X[i] - a.x, dz = G.Z[i] - a.z, fc = dx * fx + dz * fz, lc = dx * lx + dz * lz;
      const ef = Math.abs(G.FX[i] * fx + G.FZ[i] * fz) * G.HALF[i] + G.R[i], el = Math.abs(G.FX[i] * lx + G.FZ[i] * lz) * G.HALF[i] + G.R[i];
      if (fc < 0 && fc + ef > -front - room && Math.abs(lc) < a.radius + el + 0.2) return false;
    }
    const col = this.game.worldCollider, bx = a.x - fx * (front + 1.5), bz = a.z - fz * (front + 1.5);
    return col.raycast(a.x, a.z, bx, bz) === null && !this.water.isWet(bx, bz);
  }
  /** out of our camera's picture, or a building in the way (the walkers' test: pedestrians._unseenMe) */
  _hid(a) { const PS = this.game.pedestrians && this.game.pedestrians._sys; return !PS || !PS._vw || PS._unseenMe(a.x, a.z); }
  /** could no player see a car that came to stand at (x, z) now? (the walkers' test; any player's) */
  _hidAt(x, z) { const PS = this.game.pedestrians && this.game.pedestrians._sys; return PS && PS._vw ? PS._unseen(x, z) : this.game.worldCollider.raycast(this._last.x, this._last.z, x, z) !== null; }
  /** is agent a not there to be seen on OUR screen now: beyond where its kind is drawn at all, or _hid */
  _hidNow(a) { const dx = a.x - this._last.x, dz = a.z - this._last.z, g = V_GONE[a.kind]; return dx * dx + dz * dz >= g * g || this._hid(a); }
  /** How much of agent a is drawn (once a frame each; dt = 0: just made): whole within V_WHOLE m of the player, thinning
   *  to nothing at V_GONE (hidden there: no draw, no blob); fading in (a.fin) or out (a.fout) over V_FADE_S on top.
   *  Cost: a squared distance and two compares for a vehicle that is whole; a material is swapped only when the step
   *  of the dither changes (_vehiclemeshes.js vehFade). */
  _show(a, dt) {
    const k = a.kind, dx = a.x - this._last.x, dz = a.z - this._last.z, d2 = dx * dx + dz * dz, w = V_WHOLE[k];
    let al = 1;
    if (d2 > w * w) { const g = V_GONE[k], d = Math.sqrt(d2); al = d >= g ? 0 : (g - d) / (g - w); }
    if (a.fin < 1) { a.fin = Math.min(1, a.fin + dt / V_FADE_S); if (a.fin < al) al = a.fin; }
    if (a.fout > 0) { a.fout = Math.min(1, a.fout + dt / V_FADE_S); al *= 1 - a.fout; }
    if (al >= 1 && a.rig.fadeL === 8) return;
    const m = a.rig.group, on = vehFade(a.rig, al) > 0;
    if (m.visible !== on) m.visible = on;
  }
  /** nobody can see agent a (any player): far, or round a corner */
  _unseen(a, wp) {
    const d = Math.hypot(a.x - wp.x, a.z - wp.z);
    if (this._S && this._S.core.nearestRemoteD(a.x, a.z) < 130) return false;
    // (as it was - a jam must be able to clear - and also out of the camera's picture: pedestrians._unseenMe. 110 m off
    //  down a straight road still counts as far enough: a vehicle that gives up there in view fades out - update's
    //  a.bye pass, 2026-11-26.)
    const PS = this.game.pedestrians && this.game.pedestrians._sys;
    return d > 110 || (d > 35 && (this.game.worldCollider.raycast(wp.x, wp.z, a.x, a.z) !== null || (!!PS && !!PS._vw && !PS._vw.all && PS._unseenMe(a.x, a.z))));
  }

  /** _drive's look ahead and what comes of it (see the comment inside): returns the speed cap; sets a.bye when the agent
   *  has given up where nobody can see. (Kept out of _drive so that stays small enough for the JIT to inline its helpers.) */
  _obstacles(a, l, dt, wp, p, fx, fz, lx, lz, vt) {
    const g = this.game;
    // obstacles (2026-11 motion pass). Everything that moves outdoors is in one grid (this.grid, built once a frame in
    // update(), true footprints): other traffic of every kind, live vehicles (the player's, abandoned, shunted, police),
    // walkers, the player, other players. One rule set for all of it (_scan): keep a speed-dependent gap to whatever is in
    // the swept corridor ahead (following the path round bends), whatever way it points; give way to anything that will
    // cross the corridor first (junctions, merges, people stepping out); go round something stopped only when there is
    // room (cyclists filter up the kerb side; overtaking on the right only with the other side clear); squeeze left for
    // oncoming traffic on narrow streets. Nothing is ever driven through: see the stuck handling below.
    const look = 5 + a.speed * 1.7 + a.half;
    // (10 looks a second are plenty: alone, with a metre or more to spare, beyond 15 m of the player or standing still, two
    // frames in three reuse the last look, its gap shortened by the distance driven since)
    let R;
    const pdx = a.x - wp.x, pdz = a.z - wp.z, M = a.scanM || (a.scanM = { gap: Infinity, cap: Infinity, ref: null, refAI: false, refPed: false, byPlayer: false, byHeld: false, pred: false, face: false });
    const pd2 = pdx * pdx + pdz * pdz, skip = this._S || M.gap <= 1 ? false : pd2 > 225 || a.speed < 0.5 ? (this._frame + a.uid) % 3 !== 0 : false;
    if (skip) { R = M; R.gap -= a.speed * dt; }
    else {
      R = this._scan(a, l, fx, fz, lx, lz, look, dt, p);
      M.gap = R.gap; M.cap = R.cap; M.ref = R.ref; M.refAI = R.refAI; M.refPed = R.refPed; M.byPlayer = R.byPlayer; M.byHeld = R.byHeld; M.pred = R.pred; M.face = R.face;
    }
    a.why = R.ref || (a.intrT > 0.2 ? a.intrRef : null); a.whyPred = R.pred;      // (what stopped it last: tools/audit_motion.mjs; touching counts)
    // a walker standing in the carriageway in front of us: how long they have stood about there (from 5 s _scan goes round
    // them; while going round they stay the one being gone round). Without this a walker stood against the nose of a
    // stopped cyclist - and stepping into the gap each time it backed off - held it and the queue behind for minutes.
    if (R.refPed && !R.pred && a.speed < 0.5) {
      const q = R.ref;
      if (a.pwRef !== q || Math.abs(q.x - a.pwX) + Math.abs(q.z - a.pwZ) > 1.5) { a.pwRef = q; a.pwX = q.x; a.pwZ = q.z; a.pwT = 0; } else a.pwT += dt;
    } else if (a.pwRef && a.passRef !== a.pwRef && (R.ref !== a.pwRef || a.speed >= 0.5)) { a.pwRef = null; a.pwT = 0; }
    let gapMin = R.gap, byPlayer = R.byPlayer, byHeld = R.byHeld;
    a.hail = false;
    {
      const pv = p.vehicle;
      if (p.place === 'world' && !pv) {
        // hailed: the player alongside the driver's door (right-hand side; either side of a bike) and facing it or running with it
        const rx = p.pos.x - a.x, rz = p.pos.z - a.z, fd = rx * fx + rz * fz, ld = rx * lx + rz * lz;
        if (fd > -a.half - (a.kind === 'bike' ? 1.2 : 1.6) && fd < a.half + 2.2) {
          const side = a.kind === 'bike' ? Math.abs(ld) : -ld, far = a.kind === 'bike' ? a.radius + 1.0 : a.radius + 1.7;
          if (side > a.radius - 0.3 && side < far && a.speed < 11) {
            const ph = p.heading, facing = (-rx * Math.sin(ph) - rz * Math.cos(ph)) / (Math.hypot(rx, rz) || 1);
            if (facing > 0.3 || p.speed > 4) { a.hail = true; byPlayer = true; }
          }
        }
      }
      // obstacles registered with game.pedestrians.addObstacle (fire engines, taped-off pavement…): stop short of them
      const obs = g.pedestrians && g.pedestrians.obstacles;
      if (obs) for (let i = 0; i < obs.length; i++) {
        const o = obs[i], qx = o.x - a.x, qz = o.z - a.z;
        if (Math.abs(qx) > look + o.r + 4 || Math.abs(qz) > look + o.r + 4) continue;
        const f2 = qx * fx + qz * fz; if (f2 <= -o.r * 0.5 || f2 > look + o.r) continue;
        const l2 = qx * lx + qz * lz;
        if (Math.abs(l2) < a.radius + o.r + 0.3) { const gap = f2 - o.r - a.half - a.radius - 1.0; if (gap < gapMin) gapMin = gap; }
      }
    }
    if (gapMin < Infinity) vt = Math.min(vt, Math.max(0, gapMin) * (a.kind === 'bike' ? 1.2 : 0.75));
    if (R.cap < vt) vt = R.cap;
    if (a.hail || a.held) vt = 0;
    // a bus stood in a jam with its doors open for anyone who would rather walk (systems/busride.js sets a.standT each
    // frame): it does not shuffle back and forth behind what holds it up; it goes when the road ahead has cleared
    const stand = a.standT > 0 && gapMin < 6; if (a.standT > 0) a.standT -= dt;
    if (byHeld) byPlayer = true;
    // stuck: honk at the player; between AI, after a while stop trusting predictions (somebody has to go first), back off
    // a little if face to face, and only where nobody can see give up (the agent leaves the traffic)
    // (left touching another body - after a shunt, a spawn, someone parking into it - and getting nowhere: the two come
    // apart. Each frame a few cm straight away from it, only onto free ground and never deeper into anything; then the
    // corridor rules can see it ahead and go round it, or wait for it, like anything else)
    if (a.intrT > 1 && a.intrRef && !a.held && !a.hail) this._separate(a, a.intrRef, dt);
    // (wanting to go but not getting anywhere - every move cancelled by the backstop, touching something - is held up too)
    if (Math.abs(a.x - a.lpX) + Math.abs(a.z - a.lpZ) < 0.15) a.stillT += dt; else { a.stillT = 0; a.lpX = a.x; a.lpZ = a.z; }     // (creeping a cm a second is not getting anywhere either)
    if ((vt < 0.3 || a.intrT > 0.5 || (a.stillT > 2 && !a.held && !a.hail)) && a.speed < 0.4 && !(a.revT > 0)) {
      a.blockT += dt;
      if (byPlayer && !a.held && !a.hail && a.blockT > (p.vehicle || byHeld ? 2 : 3.5) && this.t - a.honkT > 5) { a.honkT = this.t; this._honk(a, wp); }
      // (touching something that is not in a queue - a parked / shunted car - the remedies are weighed from 3 s, not 5)
      const touching = !byPlayer && !R.byPlayer && this._touching(a);
      if (!byPlayer && a.dwell <= 0 && a.blockT > (touching ? 3 : 5) && (this._frame + a.uid) % 10 === 0) {       // (the remedies are weighed 3 times a second)
        if (R.pred) a.predOffT = 3;
        if (a.blockT > 7 && this.t - a.honkT > 6) { a.honkT = this.t; if (a.blockT < 12) this._honk(a, wp); }
        // (face to face: the lower-priority one backs off; if it cannot - a queue behind it - the other one does, later)
        // (touching something and getting nowhere: back away sooner, whoever has priority)
        if (a.blockT > (touching ? 3 : 8) && (R.face || touching) && !(a.revDone > 0) && (touching || !R.refAI || R.ref.why !== a || this._prioLower(a, R.ref) || a.blockT > 16) && this._clearBehind(a, fx, fz, lx, lz)) { a.revT = touching ? 1.4 : 2.2; a.revDone = touching ? 8 : 14; a.revTouch = touching; }
        // waiting at the end of the lane for ages: try another way out of the junction
        if (a.blockT > 12 && !(a.rerouted > 0) && a.next && l.len - a.s < 15) {
          a.rerouted = 20;
          for (let k = 0; k < 3; k++) { const o = this.choose(l, a); if (o && o !== a.next) { a.next = o; a.next2 = undefined; break; } }
        }
        // two holding each other up for ages: the lower-priority one stops looking at the other (the box check still keeps
        // them apart) and edges by if there is any room at all
        if (a.blockT > 18 && R.refAI && R.ref.why === a && this._prioLower(a, R.ref)) a.ignoreRef = R.ref;
        if (a.blockT > 25 && this._unseen(a, wp)) { a.lane = null; a.bye = true; return vt; }
      }
    } else if (!(a.revT > 0)) { a.blockT = Math.max(0, a.blockT - dt); if (a.blockT === 0) a.ignoreRef = null; }
    if (a.predOffT > 0) a.predOffT -= dt;
    if (a.revDone > 0) a.revDone -= dt;
    if (a.rerouted > 0) a.rerouted -= dt;
    if (a.revT > 0) {
      // backing off a couple of metres (face to face in a narrow street, nose into a crossing car): slowly, straight back
      a.revT -= dt; vt = -1.1;
      if (!this._clearBehind(a, fx, fz, lx, lz)) { a.revT = 0; vt = 0; }
      if (a.revT <= 0) { a.blockT = 0; vt = 0; a.holdT = a.revTouch ? 0.5 : 4; }     // (backed off a stationary thing: nobody to let through)
    } else if (a.holdT > 0) { a.holdT -= dt; vt = Math.min(vt, 0); }        // backed off: give the other a moment to come through
    if (stand) { a.revT = 0; vt = 0; }
    return vt;
  }
  /** at the mouth of the next street: keep the junction clear (yellow box), wait for the junction box (turn reservations),
   *  and give way down a single-track run (see _runs). a.whyM: what it waits for. */
  _mouth(a, l, vt, dt) {
    a.whyM = null;
    const nx = a.next, fr = this._frame, front = a.half + a.radius, fs = a.s + front, slow = a.speed < 0.5;
    let exitFull = false;
    // (room for the whole vehicle beyond the end of the junction's conflict area, not just beyond the mouth of the lane)
    const clearX = a.bxN && a.bxN.box && nx.e !== l.e ? Math.max(0, Math.min(nx.len - front * 2, a.bxN.box.clear)) : 0;
    if (nx.qF === fr && nx.e !== l.e && nx.qS < clearX + a.half * 2 + a.radius * 2 + (a.kind === 'bike' ? 0.8 : 2) && l.len - a.s < 25) {
      // keep the junction clear: the lane we are turning into is queued back to within our length of its mouth -> wait
      // before the junction, so the crossing traffic can still go (no box gridlock at Carfax)
      const J = a.j1, stop = (J.l === l && J.n === nx ? l.len + J.u - J.t : l.len) - Math.max(2.5, l.e.w * 0.25);
      // (already past the line: in the box - carry on as far as the queue lets us, never stand in the mouth for it)
      exitFull = fs < stop + 0.5;
      if (exitFull) { vt = Math.min(vt, Math.max(0, stop - fs) * 0.75); a.whyM = nx.qA; }
    }
    let held = exitFull;
    // a single-track run ahead: committed to it when nobody is coming the other way who cannot be passed (and nobody on
    // the other side has waited longer at its far mouth); else wait short of its mouth, room for whoever comes out to turn
    const R = nx.run;
    if (R && !R.Fp) this._runParked(R);
    if (R && R !== l.run && a.runC !== R && nx.e !== l.e) {
      const J = a.j1, stop = (J.l === l && J.n === nx ? l.len + J.u - J.t : l.len) - Math.max(3, l.e.w / 2 + 2.5), gap = stop - fs;
      if (gap < a.speed * a.speed / 6 + 6) {
        const d = nx.rd, on = R.occF !== fr ? 0 : d > 0 ? R.nm : R.np, orr = d > 0 ? R.rm : R.rp;
        let blk = null;
        if (on > 0 && !passOK(a.radius, orr, R.F)) blk = d > 0 ? R.am : R.ap;
        else if (R.clF === fr && R.clD !== d && R.clA !== a && !(a.runW > R.clW) && !passOK(a.radius, R.clR, R.F)) blk = R.clA;
        if (blk && gap > -1) { vt = Math.min(vt, Math.sqrt(6 * Math.max(0, gap - 0.3))); a.whyM = blk; if (slow) a.runW += dt; held = true; }
        else { a.runC = R; a.runD = d; a.runW = 0; this._occ(R, a, d, fr); }
      }
    }
    // the junction box: committed to it once nothing whose path crosses ours is in it (or waiting inside its conflict
    // area, or has waited longer than us); until then, short of the point where our path first comes near theirs
    if (a.bxN && !a.bxC) {
      const n = a.bxN, B = n.box, mb = a.bxM, cb = clsOf(a);
      let stopS = Infinity, block = null;
      if (n.bxF === fr) for (let j = 0; j < n.bxA.length; j++) {
        const X = n.bxA[j]; if (X === a || !X.active || !X.lane) continue;
        const r = n.bxR[j];
        if (r !== 2 && X.bxN !== n) continue;                          // (turned through since: its clearing entry counts)
        const ma = r === 2 ? X.bxPM : X.bxM, k = this._pair(B, ma, mb, clsOf(X), cb);
        if (k < 0) { if (fs < l.len - BOXL) { stopS = Math.min(stopS, l.len - BOXL); block = X; } continue; }   // (not worked out yet: next frame)
        if (!B.pc[k]) continue;
        const entry = B.pe[k];
        const myStop = l.len - entry, meIn = fs > myStop + 0.3;          // (already inside the conflict area: never stop there)
        if (r === 2) { if (meIn || X.s > B.px[k]) continue; }
        else if (r === 1) { if (meIn) continue; }
        else {
          // waiting, not committed: in the way if it is already inside the conflict area (both inside: the lower number
          // goes), or if it started waiting before us (its turn next). (By when it started, not how long so far: that
          // grows during the frame, and two would each see the other as the longer waiter, frame after frame.)
          const k2 = this._pair(B, mb, ma, cb, clsOf(X)), xIn = k2 >= 0 && B.pc[k2] === 1 && X.s + X.half + X.radius > X.lane.len - B.pe[k2] + 0.3;
          if (xIn) { if (meIn && a.uid < X.uid) continue; }
          else if (meIn || !(X.bxW > 4 && (!(a.bxW > 0) || X.bxS < a.bxS || (X.bxS === a.bxS && X.uid < a.uid)))) continue;
        }
        if (myStop < stopS) { stopS = myStop; block = X; }
      }
      if (block) { vt = Math.min(vt, Math.sqrt(6 * Math.max(0, stopS - fs - 0.4))); a.whyM = block; if (slow) { if (!(a.bxW > 0)) a.bxS = this.t; a.bxW += dt; } }
      else if (!held && fs > l.len - BOXL - a.speed * a.speed / 6 - 1.5) {
        // (in queue order: not while someone ahead of us in this lane has not gone yet - a commitment stuck behind it would
        // hold the box for nothing, and it may be letting someone else go first)
        let first = true;
        for (let j = 0; j < n.bxA.length && first; j++) { const X = n.bxA[j]; if (X !== a && n.bxR[j] === 0 && X.lane === l && X.s > a.s && X.bxN === n) first = false; }
        if (first) { a.bxC = true; a.bxW = 0; this._reg(n, a, 1, fr); }
      }
    }
    // (committed, then the way out filled or the run ahead is taken: not yet at the node -> give the box back)
    if (held && a.bxC && fs < l.len - 0.5) a.bxC = false;
    return vt;
  }
  /** ease the lateral offset towards its target (see the comment inside) */
  _ease(a, l, dt) {
    if (a.latT > 0) a.latT -= dt;
    {
      const tgt = this.clampOff(a, l, a.offT + a.passOff);
      if (a.off !== tgt && !(a.latT > 0 && Math.abs(tgt - a.off) > 0.05 && Math.sign(tgt - a.off) === a.latS)) {
        const d = tgt - a.off, st = Math.min(0.9, 0.15 + 0.12 * a.speed) * dt, q = clamp(d * Math.min(1, dt * 2.5), -st, st);
        a.off = Math.abs(d) < 0.004 ? tgt : a.off + q;
      }
    }
  }

  /** Put the rig where the agent is: ground height (resampled every 0.3 m, smoothed), lean, wheels, rider. dt = 0: snap. */
  _place(a, dt) {
    const g = this.game, m = a.rig.group;
    const gdx = a.x - a.gx, gdz = a.z - a.gz;
    if (!dt || gdx * gdx + gdz * gdz > 0.09) { a.gx = a.x; a.gz = a.z; const h = g.groundHeight(a.x, a.z); a.gy = h === h ? h : 0; }
    a.y = dt ? a.y + (a.gy - a.y) * Math.min(1, dt * 14) : a.gy;
    m.position.set(a.x, a.y, a.z);
    if (m.rotation.y !== a.heading) m.rotation.y = a.heading;    // (an Euler write recomputes the quaternion: not for a car standing in a queue)
    if (a.rig.drive) a.rig.drive(a.speed, clamp(a.steer, -0.6, 0.6), dt, !!a.lane);   // wheels roll and steer, brake lamps
    if (a.kind === 'bike') {
      if (!dt) { a.lean = 0; m.rotation.z = 0; return; }
      // lean into the turn: atan(v * yawRate / g), low-passed
      a.lean += (clamp(-Math.atan((a.speed * a.yaw) / 9.81), -0.45, 0.45) - a.lean) * Math.min(1, dt * 5);
      if (m.rotation.z !== a.lean) m.rotation.z = a.lean;
      const R = TYPES[a.type].R;
      a.wheelA = (a.wheelA + a.speed / R * dt) % TAU; a.crankA = (a.crankA + a.speed / R * dt * 0.38) % TAU;
      const r = a.rig, pp = g.player.pos;
      if (r.setFar) { const c = (g.camera || g.player).position || pp, cdx = a.x - c.x, cdz = a.z - c.z, d2 = cdx * cdx + cdz * cdz; r.setFar(r.isFar ? d2 > 31 * 31 : d2 > 36 * 36); }
      r.wheelF.rotation.x = a.wheelA; r.wheelR.rotation.x = a.wheelA; r.crank.rotation.x = a.crankA;
      r.steer.rotation.y = clamp(a.steer, -0.6, 0.6);
      if (r.rider) {
        // (the rider posed every frame within 30 m, at half rate out to 80 m, alternate bikes on alternate frames)
        const ddx = a.x - pp.x, ddz = a.z - pp.z, d2 = ddx * ddx + ddz * ddz;
        if (d2 < 900 || (d2 < 6400 && ((this._frame + a.uid) & 1) === 0)) { r.rider.update(dt + a.animDt, 0); a.animDt = 0; }
        else if (d2 < 6400) a.animDt += dt; else { r.rider.lodTick(); a.animDt = 0; }
      }
    }
  }

  /** Buses pull in at the stops on their lane (most of them), wait a few seconds, then pull out again. */
  _busStop(a, l, vt, dt, wp) {
    if (a.dwell > 0) {
      a.dwell -= dt;
      if (a.dwell <= 0) { a.lastStop = a.stopId; a.offT = this.laneOff(a, l); this._busSound(a, wp, 'bell'); }
      return 0;
    }
    let target = this.laneOff(a, l);
    for (const st of l.stops) {
      if (st.id === a.lastStop) continue;
      const ds = st.s - a.s;
      if (ds < -1) continue;
      if (ds > 45) break;
      // the stop it has just served, or another pole of it (the map has several to a stop: five "Queens Lane" in 60 m):
      // not again. (Nothing is remembered here: `lastStop` and `decided` hold one stop each, and with two poles in view
      // they used to take turns forgetting the one just served - one bus in five pulled in twice at the same pole.)
      if (a.stopId >= 0) { if (st.id === a.stopId) continue; const P = this.stops[a.stopId], Q = this.stops[st.id]; if (P && Q && P.name && P.name === Q.name && Math.abs(P.x - Q.x) + Math.abs(P.z - Q.z) < 120) continue; }
      if (a.decided !== st.id) { a.decided = st.id; if (this.rand() < 0.25 && !a.reqStop) { a.lastStop = st.id; continue; } }   // nobody waiting: sail past (a.reqStop: the bell has been rung / someone is at the stop, systems/busride.js)
      target = l.stopOff;
      vt = Math.min(vt, Math.sqrt(2 * 1.3 * Math.max(0, ds - 0.4)) + 0.25);
      if (ds < 1.3 && a.speed < 0.7) { a.dwell = 3.5 + this.rand() * 3; a.stopId = st.id; a.reqStop = false; this._busSound(a, wp, 'doors'); vt = 0; }
      break;
    }
    a.offT = target;
    return vt;
  }
  _busSound(a, wp, what) {
    const au = this.game.audio;
    if (!au || !au.ctx || Math.hypot(a.x - wp.x, a.z - wp.z) > 45) return;
    const pos = [a.x, a.z], cls = 'vehicle';      // (spatial sound: from the bus, falling off with distance — core/audio.js; the gains are for a bus 6 m off)
    if (what === 'doors') { au.noise(0.55, { gain: 0.14, freq: 2600, q: 0.5, pos, cls }); au.tone(150, 0.12, { type: 'square', gain: 0.06, when: 0.5, pos, cls }); }
    else { au.tone(1310, 0.35, { gain: 0.1, pos, cls }); au.tone(1310, 0.35, { gain: 0.1, when: 0.22, pos, cls }); au.noise(0.45, { gain: 0.1, freq: 2400, q: 0.5, when: 0.3, pos, cls }); }
  }

  _honk(a, wp) {
    const au = this.game.audio;
    if (!au || !au.ctx || Math.hypot(a.x - wp.x, a.z - wp.z) > 60) return;
    const pos = [a.x, a.z], cls = 'vehicle';      // (spatial sound: from the vehicle, falling off with distance — core/audio.js; the gains are for one 6 m off)
    if (a.kind === 'bike') { au.tone(2350, 0.6, { gain: 0.14, pos, cls }); au.tone(2350, 0.6, { gain: 0.14, when: 0.17, pos, cls }); return; }
    const f = a.type === 'bus' ? 220 : a.type === 'taxi' ? 370 : 400;
    au.tone(f, 0.35, { type: 'square', gain: 0.1, pos, cls }); au.tone(f * 1.26, 0.35, { type: 'square', gain: 0.07, pos, cls });
    au.tone(f, 0.25, { type: 'square', gain: 0.1, when: 0.45, pos, cls });
  }
}

/** comfortable lateral acceleration (m/s^2) */
/** lateral offset of the path ahead at forward distance f (piecewise linear through (0,0), (x1,y1), (x2,y2)) */
function pathY(f, x1, y1, x2, y2) { return f <= 0 ? 0 : f < x1 ? y1 * f / x1 : f < x2 ? y1 + (y2 - y1) * (f - x1) / (x2 - x1) : y2; }
/** the parameter range [t0, t1] of the segment (lateral l1 -> l2) inside the band [b0, b1]: false if none */
function bandT(l1, l2, b0, b1, out) {
  const d = l2 - l1;
  if (d > -1e-6 && d < 1e-6) { if (l1 < b0 || l1 > b1) return false; out.t0 = 0; out.t1 = 1; return true; }
  let ta = (b0 - l1) / d, tb = (b1 - l1) / d; if (ta > tb) { const t = ta; ta = tb; tb = t; }
  out.t0 = ta < 0 ? 0 : ta; out.t1 = tb > 1 ? 1 : tb;
  return out.t0 <= out.t1;
}
const _bt = { t0: 0, t1: 1 };
/** penetration of two oriented boxes (centre, heading, half length, half width) along their best separating axis; <= 0 apart */
function obb(ax, az, ah, ahl, ahw, bx, bz, bh, bhl, bhw, ax_) {
  const af = Math.sin(ah), ag = Math.cos(ah), bf = Math.sin(bh), bg = Math.cos(bh), dx = bx - ax, dz = bz - az;
  let best = Infinity;
  for (let k = 0; k < 4; k++) {
    const ux = k === 0 ? af : k === 1 ? ag : k === 2 ? bf : bg, uz = k === 0 ? ag : k === 1 ? -af : k === 2 ? bg : -bf;
    const p = dx * ux + dz * uz;
    const o = ahl * Math.abs(af * ux + ag * uz) + ahw * Math.abs(ag * ux - af * uz) + bhl * Math.abs(bf * ux + bg * uz) + bhw * Math.abs(bg * ux - bf * uz) - Math.abs(p);
    if (o < best) { best = o; if (ax_) { ax_.x = p > 0 ? -ux : ux; ax_.z = p > 0 ? -uz : uz; } if (best <= 0) return best; }
  }
  return best;
}
let _wetK = 1;      // road grip from the weather (set once a frame in _buildGrid)
function LAT(a) { return (a.type === 'bus' ? 1.5 : a.kind === 'bike' ? 2.6 : 2.8) * _wetK; }
function cornerV(ang, a) {
  // ~90 degrees -> ~4.5 m/s for cars, ~3.5 for buses; gentle bends barely matter
  const base = a.kind === 'bike' ? 3.2 : a.type === 'bus' ? 3.2 : 4.2;
  const v = base + Math.max(0, 1 - ang / (Math.PI / 2)) * 9;
  return _wetK === 1 ? v : v * Math.sqrt(_wetK);
}
// junction boxes / runs: per vehicle class (0 cyclist, 1 car, 2 bus) a stand-in for laneOff / clampOff, the half width of the
// body and the extra a turn sweeps (scaled by the turn angle); how far back from a node its box reaches (m)
const PROXY = [{ kind: 'bike', type: 'bike', radius: 0.425 }, { kind: 'car', type: 'car', radius: 0.95 }, { kind: 'car', type: 'bus', radius: 1.31 }];
const BOXL = 14, GHOST = ['bike_road', 'van', 'bus'], GHOSTS = 3, GHOST_WP = { x: 1e7, z: 1e7 };
/** two sampled poses (boxes: centre, sin / cos of heading, half length / width) within 0.35 m of each other */
function nearBox(PS, q, P, QS, j, Q, reach) {
  const ax = PS[q * 6], az = PS[q * 6 + 1], dx = QS[j * 6] - ax, dz = QS[j * 6 + 1] - az;
  if (dx > reach || dx < -reach || dz > reach || dz < -reach) return false;
  const ea = PS[q * 6 + 5], eb = QS[j * 6 + 5];
  if (ea === eb && (ea & 1)) return false;               // (both lined up in the lanes of one street: passing, not crossing)
  const af = PS[q * 6 + 2], ag = PS[q * 6 + 3], bf = QS[j * 6 + 2], bg = QS[j * 6 + 3], ahl = P.hl, ahw = P.hw, bhl = Q.hl, bhw = Q.hw;
  for (let k = 0; k < 4; k++) {
    const ux = k === 0 ? af : k === 1 ? ag : k === 2 ? bf : bg, uz = k === 0 ? ag : k === 1 ? -af : k === 2 ? bg : -bf;
    const o = ahl * Math.abs(af * ux + ag * uz) + ahw * Math.abs(ag * ux - af * uz) + bhl * Math.abs(bf * ux + bg * uz) + bhw * Math.abs(bg * ux - bf * uz) - Math.abs(dx * ux + dz * uz);
    if (o < -0.35) return false;
  }
  return true;
}
/** single-track runs: streets narrower than this (free width, m) are candidates; two vehicles of radii ra, rb pass when */
/** nothing leads on from the end of lane o but its own opposite lane (or nothing at all) */
function stubEnd(o) { const out = o.to.out; for (let i = 0; i < out.length; i++) if (!(out[i].e === o.e && out[i].dir === -o.dir)) return false; return true; }
const sstep = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
const RUN_F = 6.2;
function passOK(ra, rb, F) { return F >= 2 * (ra + rb) + 0.95; }
function clsOf(a) { return a.kind === 'bike' ? 0 : a.type === 'bus' ? 2 : 1; }
/** distance between segments (ax,az)-(bx,bz) and (cx,cz)-(dx,dz) */
function segSeg(ax, az, bx, bz, cx, cz, dx, dz) {
  const ux = bx - ax, uz = bz - az, vx = dx - cx, vz = dz - cz, den = ux * vz - uz * vx;
  if (den > 1e-9 || den < -1e-9) {
    const t = ((cx - ax) * vz - (cz - az) * vx) / den, u = ((cx - ax) * uz - (cz - az) * ux) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(ptSeg(ax, az, cx, cz, dx, dz), ptSeg(bx, bz, cx, cz, dx, dz), ptSeg(cx, cz, ax, az, bx, bz), ptSeg(dx, dz, ax, az, bx, bz));
}
function ptSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
function newJ() { return { l: null, n: null, o: 0, u: 0, w: 0, b: 0, t: 0, r: 0, th: 0, ox: 0, oz: 0, vx: 0, vz: 0 }; }
const _ua = { x: 0, z: 0 }, _sp = { x: 0, z: 0 }, _SO = { ignoreLow: true, ignorePassages: true };
const _q2 = { x: 0, z: 0 }, _pj = { s: 0, lat: 0, nx: 0, nz: 0 };
const _scanR = { gap: Infinity, ref: null, refAI: false, refPed: false, cap: Infinity, byPlayer: false, byHeld: false, pred: false, face: false };
const _o = { x: 0, z: 0, dx: 0, dz: 1, i: 0, toV: 0, vi: 0 }, _q = { x: 0, z: 0, dx: 0, dz: 1, i: 0, toV: 0, vi: 0 }, _t = { x: 0, z: 0, dx: 0, dz: 1, i: 0, toV: 0, vi: 0 };
function pushCapsule(P, r, x, z, h, half, rad) {
  const fx = Math.sin(h), fz = Math.cos(h);
  let u = (P.x - x) * fx + (P.z - z) * fz; u = u < -half ? -half : u > half ? half : u;
  const dx = P.x - (x + fx * u), dz = P.z - (z + fz * u), R = r + rad, d2 = dx * dx + dz * dz;
  if (d2 >= R * R) return false;
  const d = Math.sqrt(d2) || 1e-5;
  P.x += (dx / d) * (R - d); P.z += (dz / d) * (R - d);
  return true;
}

