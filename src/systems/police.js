// Police and the wanted level (0-5 stars), GTA style but comic, British and bloodless: no guns, no tasers, no injuries.
// Heat comes from offences someone could plausibly have seen (systems/_police_logic.js has every number); it decays out
// of police sight (faster after changing vehicle unseen, much faster indoors). Response by level: a PCSO / bike officer
// walks over (the Proctors' bulldog for university offences), patrol cars with blue lights and a two-tone siren, two cars
// boxing you in, a van and road blocks at the junctions ahead, a helicopter with a searchlight. Stopped next to an officer
// or a police car for 3 s: Busted (fine, vehicle confiscated, released outside St Aldate's police station - or a stern word
// from the Proctors). Also: drivers you turf out sometimes chase you and try to take their car back (mash F).
// game.police = { level, heat, wanted, add(src, amount), setLevel(n), units, bust(), debugChase(level, opts), debugRoadblock(),
//                 stats(), config, station, proctors } - see docs/VEHICLES_API.md "Police".
// Multiplayer: the wanted level is per player; stars + the units chasing you are broadcast as a tiny 'police' event
// (4 Hz, ~4 numbers per unit) and drawn on the other clients as static ghosts, with stars over your name and the siren.
import * as THREE from 'three';
import { createCharacter, randomLook } from '../core/characters.js';
import { pointInPoly } from '../core/collision.js';
import { TYPES, makeLive, makeGhost, heliGeo, MATS, POLICE_COLORS, vehFade, vehFadeMaterial } from './_vehiclemeshes.js';
import { Wanted, HEAT, WITNESS_R, LEVELS, response, fineFor, isProctors, charge, BUST, bustTick, bustTime } from './_police_logic.js';

// St Aldate's police station (1938 building, east side of St Aldate's opposite the end of Speedwell Street; the map's
// bus stops "Police Station" are outside it). Release point: the east pavement in front of OSM r4180398.
export const STATION = { name: "St Aldate's police station", x: 252.3, z: 742, h: -Math.PI / 2, building: 'r4180398',
  source: 'map bus stops "Police Station" + "opposite the junction with Speedwell Street" (oxfordhistory.org.uk); building id is a best match' };
// The Proctors' Office (University Offices, Wellington Square, c. 2013) - GUESS for the exact door: we release you on the
// pavement nearest the building.
export const PROCTORS = { name: "the Proctors' Office, Wellington Square", x: -124.7, z: -357, source: 'University Offices, map w50593343 (door position guessed)' };
// University Parks cricket square (centre and axis as drawn by places/_parks_dress.js; 24 m x 22 m)
const CRICKET = { x: 379.6, z: -786.3, r: 12.5 };
const COLLEGE_RE = /College|Hall$|Christ Church$|Blackfriars|Campion Hall|St Antony|Cohen Quad|St Stephen's House|Wycliffe Hall|Regent's Park/;
const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'primary_link', 'secondary_link', 'tertiary_link', 'trunk', 'road']);
const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const pick = (a) => a[(Math.random() * a.length) | 0];
const POLICE_WHITE = POLICE_COLORS.white;
const OFFICER_KINDS = ['police', 'pcso', 'bulldog'];
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;     // (as core/net.js: when a message arrived)
const FADE_S = 0.6;          // s: a unit that must come or go where it can be seen fades over this (_fadeUnit)
const KNOCK_V = 2.6;          // m/s: a vehicle going at least this fast into an officer on foot knocks them over (pedestrians' HOP_V)
/** an officer's look from its kind and seed (the same on every client) */
function officerLook(kind, seed) {
  let look;
  if (kind === 'bulldog') look = Object.assign(randomLook(seed, { outfit: 'porter' }), { prop: undefined });
  else { look = randomLook(seed, { outfit: 'police' }); if (kind === 'pcso') { look.hat = 'cap'; look.hatColor = 0x15182a; } }
  if (look.prop === undefined) delete look.prop;
  return look;
}

// said from the bank to a suspect who has taken to the water (officers do not follow you in)
const RIVER_LINES = ['Out of the river, please!', "We can wait. We've brought a flask.", "I'm not coming in after you. These are new boots.", "You'll have to get out some time!",
  'That water is filthy, you know.', 'Swim to the bank. Slowly.'];
const LINES = {
  pcso: ['Excuse me! A quick word?', 'Hold on there, please.', "Now then, what's all this?", 'Stop right there, please!'],
  bulldog: ["Ahem. The Proctors would like a word.", 'Name and college, please.', 'One moment, if you please. University business.', 'Stop! In the name of the Proctors!'],
  constable: ['Oi! Stop! Police!', 'Pull over!', 'Stay where you are!', "You're nicked! Probably!", 'Stop! STOP! Oh, come on...'],
  chaseOwner: ['Come back here!', 'THIEF!', "That's MY car!", 'Stop! STOP!', 'Somebody stop them!', "I've got a dash cam, you know!"],
  chaseCyclist: ['Oi! My bike!', 'Come back with my bike!', 'THIEF! Bike thief!', "That's got my D-lock key on it!", "I've got a tute!"],
  giveUp: ['Fine! Keep it! I hope you get a parking ticket!', "I'm too old for this.", "I'm telling the Oxford Mail!", '...I needed the exercise anyway.'],
  won: ['Ow! Fine! FINE!', "I'm reporting you!", 'You have not heard the last of this!'],
  roadblock: ['End of the road, sunshine.', "We've got you surrounded. Mostly.", 'Turn the engine off, please.'],
  knocked: ['Oof! Right. That is assaulting an officer.', 'My hat!', 'Ow. That is going in my notebook.', "You'll be hearing about that!", 'Officer down! Sort of.'],
};

export default {
  id: 'police',
  install(game) {
    const P = new Police(game);
    game.police = P.api;
    return { id: 'police', update: (dt) => P.update(dt) };
  },
};

class Police {
  constructor(game) {
    this.game = game;
    this.wanted = new Wanted();
    this.units = [];               // {kind:'foot'|'car'|'block'|'heli', ...}
    this.charPool = { police: [], pcso: [], bulldog: [] };
    this.t = 0; this.level = 0; this.bustT = 0; this.busy = false; this.inSight = false;
    this._sightT = 0; this._manageT = 0; this._offT = 0; this._witT = 0; this._wit = 0; this._netT = 0; this._speedT = 0;
    this._indoorT = 0; this._hitT = new Map(); this.owners = []; this.tussle = null; this.fallT = 0;
    this.remote = new Map();       // other player id -> {s, units:[{k, x, z, h, tx, tz, th, mesh}]}
    this.config = { enabled: true, chaseChance: 0.4, chaseChanceBike: 0.7, freezeHeat: false, noBust: false };   // freezeHeat / noBust: test & perf hooks (no decay / never busted)
    this._tmp = []; this._P = { x: 0, z: 0 };
    this._buildZones(game.map);
    this._ui();
    this.api = this._api();
    this._netHooks();
  }

  // ------------------------------------------------------------ map-derived zones (no edits to places/world needed)
  _buildZones(map) {
    const bb = (poly) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } return { x0, x1, z0, z1 }; };
    this.colleges = (map.sites || []).filter((s) => (s.kind === 'university' || s.kind === 'college') && COLLEGE_RE.test(s.name || '')).map((s) => ({ name: s.name, poly: s.poly, ...bb(s.poly) }));
    this.parks = (map.areas || []).filter((a) => a.name === 'University Parks').map((a) => ({ poly: a.poly, holes: a.holes, ...bb(a.poly) }));
    this.parking = (map.areas || []).filter((a) => a.kind === 'parking' || a.kind === 'bridge').map((a) => ({ poly: a.poly, ...bb(a.poly) }));
  }
  _inList(list, x, z) {
    for (const s of list) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && pointInPoly(x, z, s.poly)) return s;
    return null;
  }
  /** on a carriageway (or a car park): fine for a car. Pedestrian streets, pavements, grass, quads: not. */
  onCarriageway(x, z) {
    const rg = this.game.world && this.game.world.roadGrid;
    if (!rg) return true;
    let on = false;
    rg.queryRadius(x, z, 12, (s) => {
      if (on || !DRIVE.has(s.kind)) return;
      const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1e-6, t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / L2, 0, 1);
      if (Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) < (s.w || 6) / 2 + 0.45) on = true;
    });
    return on || !!this._inList(this.parking, x, z);
  }
  /** what (if anything) the player is doing wrong right now with their vehicle: [src, heatPerSecond] */
  _offence(v) {
    const x = v.x, z = v.z, sp = Math.abs(v.speed || 0);
    if (v.kind === 'car') {
      if (sp < 1) return null;
      if (Math.hypot(x - CRICKET.x, z - CRICKET.z) < CRICKET.r + 1) return ['cricket', HEAT.cricketPerS];
      if (this.onCarriageway(x, z)) return null;
      if (this._inList(this.colleges, x, z)) return ['quad', HEAT.quadPerS];
      return ['pavement', HEAT.pavementPerS];
    }
    if (v.kind === 'bike') {
      if (sp < 1.5) return null;
      if (Math.hypot(x - CRICKET.x, z - CRICKET.z) < CRICKET.r) return ['cricket_bike', HEAT.cricketBikePerS];
      if (this._inList(this.parks, x, z)) return ['parks_cycle', HEAT.parksCyclePerS];
      if (!this.onCarriageway(x, z) && this._inList(this.colleges, x, z)) return ['quad_bike', HEAT.quadBikePerS];
    }
    return null;
  }

  // ------------------------------------------------------------ witnesses / sight
  /** 0 nobody could have seen (x,z), 1 a pedestrian or driver within 40 m, 1.5 the police did. `except` = the victim. */
  witnesses(x, z, except = null) {
    const g = this.game, R2 = WITNESS_R * WITNESS_R;
    for (const u of this.units) { const ux = u.kind === 'car' ? u.v.x : u.x, uz = u.kind === 'car' ? u.v.z : u.z; if (u.kind !== 'heli' && (ux - x) ** 2 + (uz - z) ** 2 < R2) return 1.5; if (u.kind === 'heli' && (ux - x) ** 2 + (uz - z) ** 2 < 150 * 150) return 1.5; }
    let seen = 0;
    const peds = g.pedestrians;
    if (peds && peds.near) {
      const out = peds.near(x, z, WITNESS_R, this._tmp);
      for (const p of out) { if (p === except || p.down) continue; if (p.role === 'police') return 1.5; seen = 1; }
    }
    if (!seen && g.traffic) for (const a of g.traffic.list) if (a.active && (a.x - x) ** 2 + (a.z - z) ** 2 < R2) { seen = 1; break; }
    return seen;
  }
  _computeSight() {
    const g = this.game, p = g.player;
    if (p.place !== 'world') return false;
    const col = g.worldCollider, px = p.pos.x, pz = p.pos.z;
    for (const u of this.units) {
      if (u.state === 'leave') continue;
      if (u.kind === 'heli') { if (Math.hypot(u.x - px, u.z - pz) < 170) return true; continue; }
      const ux = u.kind === 'car' ? u.v.x : u.x, uz = u.kind === 'car' ? u.v.z : u.z, d = Math.hypot(ux - px, uz - pz);
      const R = u.kind === 'car' ? 75 : u.kind === 'block' ? 70 : 45;
      if (d < 6 || (d < R && col.raycast(ux, uz, px, pz) === null)) return true;
    }
    if (this.wanted.heat > 0 && g.pedestrians) {
      for (const q of g.pedestrians.near(px, pz, 25, this._tmp)) if (q.role === 'police' && col.raycast(q.x, q.z, px, pz) === null) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ hooks into vehicles (installed after us)
  _hook() {
    const V = this.game.vehicles;
    if (this._hooked || !V || !V.on) return;
    this._hooked = true;
    V.on('take', (d) => this._onTake(d));
    // other players' police cars and road blocks (drawn here from their 'police' messages) are solid here too
    if (V.addBodies) V.addBodies((add) => this._remoteBodies(add));
    V.on('knock', (d) => this._onKnock(d));
    V.on('impact', (d) => this._onImpact(d));
    V.on('enter', (d) => { if (this.wanted.heat > 0 && !this.inSight && d.v && !d.v.policeUnit) { this.wanted.changedVehicle(); this._toast('New wheels. They are looking for a different vehicle now.', 3); } });
  }
  _heat(src, amount, x, z, except) {
    if (!this.config.enabled || this.busy) return 0;
    const seen = this.witnesses(x, z, except);
    const before = this.wanted.level, added = this.wanted.add(src, amount, seen);
    if (added > 0) this.lastOffence = { src, amount: added, seen };
    if (this.wanted.level > before) this._levelUp(before, this.wanted.level);
    return added;
  }
  _onTake({ v, info }) {
    if (!info) return;
    const bike = info.kind === 'bike';
    this._heat(bike ? 'take_bike' : 'take', bike ? HEAT.take.bike : HEAT.take[info.type] || 14, info.x, info.z, info.driver);
    // the owner might come after you
    const rec = info.driver;
    if (rec && !rec.fallback && Math.random() < (bike ? this.config.chaseChanceBike : this.config.chaseChance)) this.owners.push({ rec, v, bike, t: 0, sx: info.x, sz: info.z, started: false, sayT: 0, wait: 0 });
  }
  _onKnock({ v, ped, shunted }) {
    const V = this.game.vehicles;
    if (!V || v !== V.current || !ped) return;
    if (shunted) return;          // (a patrol car shoved your parked car into them: their doing, not yours)
    this._heat(v.kind === 'bike' ? 'knock_bike' : 'knock', v.kind === 'bike' ? HEAT.knockBike : HEAT.knockCar, ped.x, ped.z, ped);
  }
  _onImpact({ v, impact, what, other, shunted, own, pushed }) {
    const V = this.game.vehicles; if (!V) return;
    const cur = V.current;
    // (shunted: the vehicles' own collision impulse already spun / shoved both cars; the old random spin is only a fallback)
    if (v.policeUnit && other === cur && impact > 4) { if (!shunted) V.spin(cur, (Math.random() < 0.5 ? -1 : 1) * Math.min(2, impact * 0.12)); return; }
    if (v !== cur) return;
    // (rammed while standing still - a patrol car closing in, AI traffic shunting into you: the contact is resolved from
    // both sides, so your car "hits" it too; you are only charged for what you drove into. Before 2026-11 a parked player
    // being boxed in by the patrol cars climbed from 3 stars to 5 and was busted at 5: tools/smoke_police.mjs)
    if (other && own !== undefined && own < 1.5) return;
    if (pushed) return;          // (shoved by someone else's car in the last 2 s into whatever it hit: not your driving either)
    const key = other || what, last = this._hitT.get(key) || -9;
    if (this.t - last < 1.2) return;
    this._hitT.set(key, this.t);
    if (this._hitT.size > 40) this._hitT.clear();
    if (what === 'vehicle' && other && other.policeUnit) {
      if (!shunted) V.spin(other, (Math.random() < 0.5 ? -1 : 1) * Math.min(3, impact * 0.32));
      this._heat('hit_police', HEAT.hitPolice + impact * 0.5, v.x, v.z);
    } else if ((what === 'vehicle' || what === 'traffic') && v.kind !== 'bike') {   // (a bicycle clattering into a car is the rider's own problem: they come off; no star for it, 2026-11)
      if (what === 'vehicle' && other && !other.static && !shunted) V.spin(other, (Math.random() < 0.5 ? -1 : 1) * Math.min(2.5, impact * 0.25));
      this._heat('hit_vehicle', HEAT.hitVehicle + impact * 0.5, v.x, v.z);
    } else if (impact > 5) this._heat('furniture', HEAT.hitFurniture, v.x, v.z);
  }
  _levelUp(from, to) {
    if (to >= 2 && from < 2) this._toast(to >= 3 ? 'Blues and twos! The police are after you.' : 'A patrol car has been called. Lose them, or pull over.', 3.5);
    else if (to === 1 && from === 0) this._toast(this.wanted.univFrac >= 0.5 ? 'Someone has reported you to the Proctors.' : 'Somebody saw that. A PCSO is on the way.', 3);
    else if (to === 4) this._toast('Road blocks ahead!', 2.5);
    else if (to === 5) this._toast('Is that... the helicopter? Over a stolen car?', 3);
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, p = g.player;
    if (!dt || dt <= 0) return;
    this.t += dt;
    this._hook();
    const inWorld = p.place === 'world';
    // continuous offences + speeding past the police
    if ((this._offT -= dt) <= 0) {
      this._offT = 0.25;
      const v = p.vehicle;
      if (inWorld && v && !v.playerSeat && !this.busy) {      // (playerSeat: a passenger in another player's car, systems/passenger.js: the driver's offences are the driver's)
        let off = this._offence(v);
        // a wheel on the kerb is not a crime: pavement driving only counts after 1.5 s of it (2026-11 play pass: clipping a
        // pavement in a narrow street for 2.5 s used to be a star on its own)
        if (off && off[0] === 'pavement') { this._paveT = (this._paveT || 0) + 0.25; if (this._paveT <= 1.5) off = null; } else this._paveT = 0;
        if (off) {
          if ((this._witT -= 0.25) <= 0) { this._witT = 0.5; this._wit = this.witnesses(v.x, v.z); }
          const before = this.wanted.level;
          this.wanted.add(off[0], off[1] * 0.25, this._wit);
          if (this.wanted.level > before) this._levelUp(before, this.wanted.level);
          this.lastOffence = { src: off[0], amount: off[1] * 0.25, seen: this._wit };
        }
        if (Math.abs(v.speed || 0) > 17 && this.t - this._speedT > 10 && this._policeNear(v.x, v.z, 35)) { this._speedT = this.t; this._heat('speeding', HEAT.speedingNearPolice, v.x, v.z); }
      }
    }
    // sight + decay
    if ((this._sightT -= dt) <= 0) { this._sightT = 0.25; this.inSight = this._computeSight(); }
    this._indoorT = inWorld ? 0 : this._indoorT + dt;
    const lvl = this.config.freezeHeat ? this.wanted.level : this.wanted.tick(dt, { inSight: this.inSight, indoors: !inWorld });
    if (lvl !== this.level) { const was = this.level; this.level = lvl; if (lvl === 0 && was > 0) this._toast(this.wanted.peak >= 2 || was >= 2 ? 'You lost them. Wanted level cleared.' : 'They have lost interest.', 2.5); this._sendNet(true); }
    // units
    if ((this._manageT -= dt) <= 0) { this._manageT = 0.5; this._manage(); }
    for (let i = this.units.length - 1; i >= 0; i--) this._unitUpdate(this.units[i], dt, i);
    this._knockOfficers();
    if (this._dropped && this._dropped.length && this._dropped[0].t < this.t) this._dropped.shift().g.removeFromParent();
    // busted?
    if (!this.busy && inWorld && this.level > 0 && !this.config.noBust && !p.swim) {      // (nobody is nicked in the river: they wait on the bank, systems/swim.js)
      const near = this._bustNear(), v = p.vehicle;
      const stopped = v ? Math.abs(v.speed || 0) < BUST.stopV : p.speed < 0.6;
      this.bustT = bustTick(this.bustT, dt, stopped && !this.tussle, near);
      if (this.bustT >= bustTime(this.level)) this.bust();
    } else this.bustT = 0;
    // owners chasing after their vehicle, the tussle
    if (this.owners.length) this._owners(dt);
    if (this.tussle) this._tussle(dt);
    if (this.fallT > 0) this._fall(dt);
    // sirens, rotor, HUD, multiplayer
    this._audio(dt);
    this._hud();
    this._remoteUpdate(dt);
    if ((this._netT -= dt) <= 0) { this._netT = this._netFast ? 0.15 : 0.25; this._sendNet(false); }      // (_netFast: a car of ours is moving, see _sendNet)
  }
  _policeNear(x, z, r) {
    for (const u of this.units) { const ux = u.kind === 'car' ? u.v.x : u.x, uz = u.kind === 'car' ? u.v.z : u.z; if (Math.hypot(ux - x, uz - z) < r) return true; }
    const peds = this.game.pedestrians;
    if (peds) for (const q of peds.near(x, z, r, this._tmp)) if (q.role === 'police') return true;
    return false;
  }
  _bustNear() {
    const g = this.game, p = g.player, pv = p.vehicle, V = g.vehicles;
    for (const u of this.units) {
      if (u.state === 'leave' || u.down) continue;
      if (u.kind === 'foot') {
        if (pv && pv.type) { if (V && V._sys.bodyDist(pv, u.x, u.z) < BUST.footR) return true; }      // (a seat with no vehicle type of its own - a passenger's - is measured from the player, below)
        else if (Math.hypot(u.x - p.pos.x, u.z - p.pos.z) < BUST.footR) return true;
      } else if (u.kind === 'car' || u.kind === 'block') {
        const cars = u.kind === 'car' ? [u.v] : u.cars;
        for (const c of cars) {
          if (!c || !V) continue;
          if (pv) {
            const T = TYPES[pv.type], hl = Math.max(0, T.L / 2 - T.W / 2), fx = Math.sin(pv.heading), fz = Math.cos(pv.heading);
            for (let k = -1; k <= 1; k++) if (V._sys.bodyDist(c, pv.x + fx * hl * k, pv.z + fz * hl * k) - T.W / 2 < BUST.carR) return true;
          } else if (V._sys.bodyDist(c, p.pos.x, p.pos.z) < BUST.carR) return true;
        }
      }
    }
    return false;
  }

  // ------------------------------------------------------------ unit management
  _tier() { const q = this.game.quality; return (q && q.level) || (this.game.traffic && this.game.traffic.tier) || 'medium'; }
  _count(kind, sub) { let n = 0; for (const u of this.units) if (u.kind === kind && u.state !== 'leave' && (!sub || u.sub === sub)) n++; return n; }
  _manage() {
    const g = this.game, p = g.player;
    if (p.place !== 'world') {
      // they lose you inside: units hang about for a bit, then leave
      if (this._indoorT > 8) for (const u of this.units) u.state = 'leave';
      return;
    }
    const want = this.busy ? response(0) : response(this.level, this._tier());
    // too many of something: send the extras home
    const trim = (kind, sub, n) => { let k = 0; for (const u of this.units) if (u.kind === kind && u.state !== 'leave' && (!sub || u.sub === sub)) { if (++k > n) u.state = 'leave'; } };
    trim('foot', null, want.foot); trim('car', 'car', want.cars); trim('car', 'van', want.vans); trim('block', null, want.roadblock ? want.blocks : 0); trim('heli', null, want.heli);
    if (this.busy || !this.config.enabled) return;
    // one new unit per tick, most important first
    if (this._count('car', 'car') < want.cars) { this._spawnCar('car'); return; }
    if (this._count('foot') < want.foot) { this._spawnFoot(); return; }
    if (this._count('car', 'van') < want.vans) { this._spawnCar('van'); return; }
    if (want.heli && this._count('heli') < want.heli) { this._spawnHeli(); return; }
    if (want.roadblock && this._count('block') < want.blocks && this.t - (this._blockT || -99) > 6) { this._blockT = this.t; this._spawnBlock(want.roadblock, false); }
  }

  // ---- officers on foot (and on bicycles)
  _officerChar(kind) {
    const pool = this.charPool[kind];
    if (pool.length) { const ch = pool.pop(); return ch; }
    const seed = (Math.random() * 1e9) | 0;
    const ch = createCharacter(officerLook(kind, seed)); ch._kind = kind; ch._seed = seed;     // (the seed is what multiplayer sends)
    return ch;
  }
  _releaseChar(ch) {
    if (!ch) return;
    ch.group.removeFromParent(); ch.say(null);
    ch.setFade(1); ch.group.visible = true;      // (one that faded out: whole again for the pool)
    if (ch.group.parent) ch.group.parent.remove(ch.group);
    const pool = this.charPool[ch._kind] || this.charPool.police;
    if (pool.length < 6) pool.push(ch); else ch.dispose();
  }
  /** Is (x, z) in front of the camera with nothing between it and the player? (debugChase `near`: units you can see) */
  _inView(x, z) {
    const g = this.game, p = g.player, cam = g.camera, fwd = this._fwd || (this._fwd = new THREE.Vector3());
    if (!cam) return true;
    cam.getWorldDirection(fwd);
    const dx = x - p.pos.x, dz = z - p.pos.z, dd = Math.hypot(dx, dz) || 1, fl = Math.hypot(fwd.x, fwd.z) || 1;
    return (fwd.x * dx + fwd.z * dz) / (dd * fl) > 0.72 && g.worldCollider.raycast(p.pos.x, p.pos.z, x, z) === null;
  }
  /** Could no player see somebody (or a car) at (x, z) now? The walkers' test (pedestrians._unseen): out of the camera's
   *  picture by a margin, or a building between it and both the camera and the player. (2026-11-26: the police arrive
   *  from out of sight. It used to be "behind the player, or any wall segment in the way" - a railing, a parked car's
   *  box - and, failing that, anywhere.) */
  _hid(x, z) {
    const g = this.game, PS = g.pedestrians && g.pedestrians._sys;
    if (PS && PS._vw && PS._unseen) return PS._unseen(x, z);
    return g.worldCollider.raycast(g.player.pos.x, g.player.pos.z, x, z) !== null;
  }
  /** A unit that has to come or go where it can be seen after all (the last resorts in _spawnCar, _spawnFoot,
   *  _spawnBlock; a unit whose time is up in plain view: _unitUpdate) fades in / out over FADE_S, as the walkers and the
   *  traffic do. Called only while one is fading. */
  _fadeUnit(u, dt) {
    let a = 1;
    if (u.fin < 1) { u.fin = Math.min(1, u.fin + dt / FADE_S); a = u.fin; }
    if (u.fout > 0) { u.fout = Math.min(1, u.fout + dt / FADE_S); a *= 1 - u.fout; }
    const rig = (r) => { const on = vehFade(r, a) > 0; if (r.group.visible !== on) r.group.visible = on; };
    const man = (ch) => { ch.setFade(a); ch.group.visible = a > 0.03; };
    if (u.kind === 'foot') { man(u.ch); if (u.bike) rig(u.bike); }
    else if (u.kind === 'car') rig(u.v.rig);
    else if (u.kind === 'block') { for (const c of u.cars) rig(c.rig); for (const ch of u.officers) man(ch); }
    else if (u.kind === 'heli' && this._heliMesh) { this._heliMesh.material = vehFadeMaterial(MATS.body, a); this._heliMesh.visible = a > 0.03; }
  }
  _spawnPoint(minD, maxD, visible = false) {
    // a pavement node out of sight (_hid); `visible` true: the opposite, in plain view ahead; 'any': wherever
    const g = this.game, p = g.player, peds = g.pedestrians, col = g.worldCollider, cam = g.camera;
    const nn = peds && peds._sys && peds._sys.nearestNode ? (x, z) => peds._sys.nearestNode(x, z, 18) : null, G = peds && peds.graph;
    const fwd = this._fwd || (this._fwd = new THREE.Vector3());
    if (cam) cam.getWorldDirection(fwd);
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * TAU, d = minD + Math.random() * (maxD - minD);
      let x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d;
      if (nn && G) { const n = nn(x, z); if (n < 0) continue; x = G.X[n]; z = G.Z[n]; }
      if (col.isWet(x, z) || !col.isFree(x, z, 0.35)) continue;
      const dx = x - p.pos.x, dz = z - p.pos.z, dd = Math.hypot(dx, dz) || 1;
      if (visible === 'any') return [x, z];
      if (visible) { if (k > 15 || this._inView(x, z)) return [x, z]; continue; }
      if (this._hid(x, z)) return [x, z];
    }
    return null;
  }
  _spawnFoot(near = false) {
    const g = this.game, p = g.player, univ = this.level <= 1 && this.wanted.univFrac >= 0.5;
    const R = response(this.level, this._tier());
    // (out of sight: round a corner or out of the picture, 30-55 m off, else further; only when that has failed for
    //  three seconds - every pavement near by is in the picture - at the far edge of what is drawn, fading in)
    let sp = near ? this._spawnPoint(12, 22, true) : this._spawnPoint(30, 55) || this._spawnPoint(55, 105), fin = 1;
    if (!sp && !near && (this._footMiss = (this._footMiss || 0) + 1) >= 6) { sp = this._spawnPoint(105, 140, 'any'); fin = 0; }
    if (!sp) return null;
    this._footMiss = 0;
    const bike = !univ && Math.random() < R.bike;
    const kind = univ ? 'bulldog' : this.level <= 1 ? 'pcso' : 'police';
    const ch = this._officerChar(kind);
    const u = { kind: 'foot', sub: bike ? 'bike' : 'foot', ch, x: sp[0], z: sp[1], h: Math.atan2(p.pos.x - sp[0], p.pos.z - sp[1]), speed: 0, path: null, pathI: 0, pathT: 0, state: 'chase', sayT: 1 + Math.random() * 2, bike: null, kindLines: univ ? 'bulldog' : this.level <= 1 ? 'pcso' : 'constable', life: 0,
      y: g.groundHeight(sp[0], sp[1]), gy: 0, gx: sp[0], gz: sp[1], lean: 0, fin, fout: 0 };
    u.gy = u.y;
    if (bike) {
      u.bike = makeLive('bike_road', 0x121212); u.bike.group.add(ch.group); ch.group.position.set(0, 0, -0.08); ch.setPose('cycle');
      g.worldScene.add(u.bike.group);
    } else { ch.setPose('stand'); g.worldScene.add(ch.group); }
    { const grp = u.bike ? u.bike.group : ch.group; grp.position.set(u.x, u.y, u.z); grp.rotation.y = u.h; }      // (where it is from its first frame, not at the origin)
    if (fin < 1) this._fadeUnit(u, 0);
    this.units.push(u);
    return u;
  }
  _footMove(u, dt) {
    const g = this.game, p = g.player, col = g.worldCollider;
    const tx = p.pos.x, tz = p.pos.z, d = Math.hypot(tx - u.x, tz - u.z);
    let vt;
    if (u.state === 'leave') vt = 1.4;
    else if (u.sub === 'bike') vt = d > 6 ? 6.5 : 1.5;
    else if (this.level <= 1) vt = d > 18 ? 3.2 : 1.6;     // "walks over"
    else vt = d > 2 ? 5.4 : 1;
    let ax = tx, az = tz;
    if (u.state === 'leave') { ax = u.x + (u.x - tx); az = u.z + (u.z - tz); }
    else if (d > 4 && col.raycast(u.x, u.z, tx, tz) !== null) {
      // round the corner: follow a pavement route, refreshed every 2.5 s
      if ((u.pathT -= dt) <= 0) { u.pathT = 2.5; u.path = g.pedestrians && g.pedestrians.route ? g.pedestrians.route(u.x, u.z, tx, tz) : null; u.pathI = 0; }
      if (u.path && u.path.length) {
        while (u.pathI < u.path.length - 1 && Math.hypot(u.path[u.pathI][0] - u.x, u.path[u.pathI][1] - u.z) < 1.5) u.pathI++;
        ax = u.path[u.pathI][0]; az = u.path[u.pathI][1];
      }
    } else u.path = null;
    const stopR = u.sub === 'bike' ? 1.6 : 1.1;
    const dx = ax - u.x, dz = az - u.z, dd = Math.hypot(dx, dz);
    if (u.state !== 'leave' && d < stopR) vt = 0;
    u.speed += (vt - u.speed) * Math.min(1, dt * (u.sub === 'bike' ? 2 : 6));
    if (dd > 1e-3 && u.speed > 0.01) {
      const P = this._P, dh = wrap(Math.atan2(dx, dz) - u.h);
      if (u.sub === 'bike') {
        // a bicycle goes where it points: turn towards the target at a rate the speed allows (a ~1.3-5 m circle), ride along the heading
        const rate = clamp(u.speed / 2.2, 1.2, 2.4) * dt;
        u.h = wrap(u.h + clamp(dh * Math.min(1, dt * 5), -rate, rate));
        P.x = u.x + Math.sin(u.h) * u.speed * dt; P.z = u.z + Math.cos(u.h) * u.speed * dt;
      } else {
        P.x = u.x + (dx / dd) * u.speed * dt; P.z = u.z + (dz / dd) * u.speed * dt;
        u.h = wrap(u.h + clamp(dh * Math.min(1, dt * 8), -6 * dt, 6 * dt));          // on foot: turn quickly, never snap
      }
      col.resolve(P, u.sub === 'bike' ? 0.4 : 0.3);
      if (!col.isWet(P.x, P.z)) { u.x = P.x; u.z = P.z; }
    } else if (d > 0.1) { const dh = wrap(Math.atan2(tx - u.x, tz - u.z) - u.h); u.h = wrap(u.h + clamp(dh * Math.min(1, dt * 5), -4 * dt, 4 * dt)); }
  }

  // ---- patrol cars and vans
  _spawnCar(sub, near = false) {
    const g = this.game, p = g.player, V = g.vehicles, tr = g.traffic;
    if (!V || !tr || !tr.spawnPoint) return null;
    let nearSp = null;
    if (near) for (let k = 0; k < 14 && !nearSp; k++) { const q = tr.spawnPoint(p.pos.x, p.pos.z, { minD: 16, maxD: 48 }); if (q && this._inView(q.x, q.z) && !this.units.some((u) => u.v && Math.hypot(u.v.x - q.x, u.v.z - q.z) < 9)) nearSp = q; }   // in plain view ahead, if any lane is
    // (out of sight - traffic.spawnPoint's `hidden` is the walkers' test now: out of the picture or a building in the way,
    //  at any distance - so a car comes round a corner or from behind. Only when no such lane has been found for three
    //  seconds: from 200 m off down the road, fading in.)
    let sp = near ? nearSp || tr.spawnPoint(p.pos.x, p.pos.z, { minD: 28, maxD: 60 }) || tr.spawnPoint(p.pos.x, p.pos.z, { minD: 18, maxD: 120 })
      : tr.spawnPoint(p.pos.x, p.pos.z, { minD: 80, maxD: 170, hidden: true }) || tr.spawnPoint(p.pos.x, p.pos.z, { minD: 70, maxD: 220, hidden: true }), fin = 1;
    if (!sp && !near && (this._carMiss = (this._carMiss || 0) + 1) >= 6) { sp = tr.spawnPoint(p.pos.x, p.pos.z, { minD: 200, maxD: 262 }); fin = 0; }
    if (!sp) return null;
    this._carMiss = 0;
    const type = sub === 'van' ? 'van' : 'car_saloon';
    const v = V.spawn(type, sp.x, sp.z, sp.heading, { color: POLICE_WHITE, livery: 'police', driver: true });
    v.driver = 'ai'; v.parked = false; v.passBikes = true;
    v.vx = Math.sin(sp.heading) * 7; v.vz = Math.cos(sp.heading) * 7; v.speed = 7;
    // at night: just the additive headlight beam (lamps stay baked into the body: 1 draw instead of 2 per car)
    if (v.rig.beam) v.rig.beam.visible = !!(g.time && g.time.isNight);
    const nCars = this._count('car');
    const u = { kind: 'car', sub, v, role: sub === 'car' && nCars % 2 === 1 ? 'block' : 'chase', path: null, pathI: 0, pathT: 0, stuckT: 0, revT: 0, state: 'chase', ph: Math.random(), life: 0, lostT: 0, fin, fout: 0 };
    if (fin < 1) this._fadeUnit(u, 0);
    v.policeUnit = u; v.pid = this._uid = (this._uid || 0) + 1;      // (pid: what other players' clients call this car)
    this.units.push(u);
    return u;
  }
  _carTarget(u, out) {
    const p = this.game.player, pv = p.vehicle;
    const px = pv ? pv.x : p.pos.x, pz = pv ? pv.z : p.pos.z, ph = pv ? pv.heading : p.heading, sp = pv ? Math.abs(pv.speed || 0) : p.speed;
    if (u.state === 'leave') { out.x = u.v.x + Math.sin(u.v.heading) * 40; out.z = u.v.z + Math.cos(u.v.heading) * 40; return; }
    if (u.role === 'block') {
      // box in: get ahead of the player (or alongside when they are slow)
      const ahead = sp > 4 ? 10 + sp * 0.9 : 3;
      out.x = px + Math.sin(ph) * ahead + Math.cos(ph) * (sp > 4 ? 0 : 3.2); out.z = pz + Math.cos(ph) * ahead - Math.sin(ph) * (sp > 4 ? 0 : 3.2);
    } else {
      const back = sp > 4 ? -4 : -(TYPES[pv ? pv.type : 'car_hatch'].L / 2 + 3.5) * (pv ? 1 : 0.3);
      out.x = px + Math.sin(ph) * back; out.z = pz + Math.cos(ph) * back;
    }
  }
  _carDrive(u, dt) {
    const g = this.game, V = g.vehicles, tr = g.traffic, v = u.v, col = g.worldCollider, p = g.player;
    const T = this._tgt || (this._tgt = { x: 0, z: 0 });
    this._carTarget(u, T);
    const d = Math.hypot(T.x - v.x, T.z - v.z);
    const pv = p.vehicle, px = pv ? pv.x : p.pos.x, pz = pv ? pv.z : p.pos.z, dP = Math.hypot(px - v.x, pz - v.z);
    // route over the road graph when the target is round a corner
    let ax = T.x, az = T.z;
    if (d > 22 && (u.state === 'leave' || col.raycast(v.x, v.z, T.x, T.z) !== null)) {
      if ((u.pathT -= dt) <= 0 || !u.path) {
        u.pathT = 1.5; u.path = tr && tr.route ? tr.route(v.x, v.z, T.x, T.z) : null; u.pathI = 0;
        if (u.path && u.path.length < 2) u.path.push([T.x, T.z]);        // same junction at both ends: via it
        if (u.path && carrot(u.path, v.x, v.z, 0, 0, _C) >= 0 && Math.hypot(_C.x - v.x, _C.z - v.z) > 6) {
          // mid-way along a long road (its junction nodes far away): join the route via our own lane, not straight across
          const nl = tr.nearestLane ? tr.nearestLane(v.x, v.z, 30, v.heading) : null;
          u.path.unshift(nl ? [nl.x, nl.z] : [v.x, v.z]);
        }
        // join the route at the point nearest the car (its first node may be behind us)
        if (u.path) u.pathI = Math.max(0, nearestSegEnd(u.path, v.x, v.z) - 1);
      }
      if (u.path && u.path.length > 1) {
        // carrot: the point 8 m further along the route than where we are nearest to it
        u.pathI = carrot(u.path, v.x, v.z, 8, u.pathI, _C);
        ax = _C.x; az = _C.z;
      }
    } else u.path = null;
    let want = Math.atan2(ax - v.x, az - v.z);
    // feelers: if the way to the carrot is walled off within 7 m, swing to the nearest clear direction (10 Hz, ≤ 7 rays)
    if ((u.feelT = (u.feelT || 0) - dt) <= 0) {
      u.feelT = 0.1; u.avoid = 0;
      const look = Math.min(7, Math.hypot(ax - v.x, az - v.z));
      if (look > 2 && col.raycast(v.x, v.z, v.x + Math.sin(want) * look, v.z + Math.cos(want) * look) !== null) {
        for (const o of FEELERS) { const a2 = want + o; if (col.raycast(v.x, v.z, v.x + Math.sin(a2) * look, v.z + Math.cos(a2) * look) === null) { u.avoid = o; break; } }
      }
    }
    want += u.avoid || 0;
    const dh = wrap(want - v.heading);
    let vt = clamp(Math.hypot(ax - v.x, az - v.z) * 0.7 + (d > 30 ? 8 : 0), 0, u.sub === 'van' ? 16 : 19);
    if (Math.abs(dh) > 0.7) vt = Math.min(vt, 7);
    if (Math.abs(dh) > 1.6) vt = Math.min(vt, 4);
    const pstop = pv ? Math.abs(pv.speed || 0) < 1.5 : p.speed < 1.5;
    if (u.state !== 'leave' && pstop && dP < 9) vt = 0;                           // parked up next to you
    let steer = clamp(-dh * 1.6, -1, 1), throttle = 0, brake = false;
    if (v.speed < vt - 0.5) throttle = clamp((vt - v.speed) / 4, 0.35, 1);
    else if (v.speed > vt + 1.2) brake = true;
    // stuck against something: back up with the wheel the other way
    if (u.revT > 0) { u.revT -= dt; throttle = 0; brake = true; steer = -steer; }
    else if (throttle > 0 && Math.abs(v.speed) < 0.6) { if ((u.stuckT += dt) > 1.3) { u.stuckT = 0; u.revT = 1.1; u.unstick = (u.unstick || 0) + 1; if (u.unstick >= 2) u.passT = 3; } }
    else { u.stuckT = 0; if (Math.abs(v.speed) > 4) u.unstick = 0; }
    if (brake && v.speed < 0.2 && u.revT <= 0) brake = false;
    if (u.passT > 0) u.passT -= dt;
    v.passTraffic = u.passT > 0;          // wedged in by traffic: squeeze through for a moment
    V.drive(v, { throttle, brake, steer }, dt);
    // blue lights + pulling-over traffic ahead
    if (v.rig.setBeacon) v.rig.setBeacon(Math.floor((this.t + u.ph) * 4) % 2);
    if ((u.yT = (u.yT || 0) - dt) <= 0) { u.yT = 0.5; if (tr && tr.yieldTo) tr.yieldTo(v.x, v.z, v.heading, 34); }
    // hopelessly lost or stuck: quietly reappear somewhere sensible out of sight
    // (seen: in the picture with no building in the way - it was "within 140 m with no wall segment between", so a car
    //  150 m down a straight road, or behind a railing, was moved or taken away in plain view)
    const seen = dP < 300 && !this._hid(v.x, v.z);
    if (u.state !== 'leave' && ((dP > 230 && !seen) || (u.unstick > 4 && !seen))) {
      const sp = tr.spawnPoint(p.pos.x, p.pos.z, { minD: 80, maxD: 150, hidden: true });
      if (sp) { v.x = sp.x; v.z = sp.z; v.heading = sp.heading; v.vx = Math.sin(sp.heading) * 8; v.vz = Math.cos(sp.heading) * 8; v.speed = 8; u.path = null; u.unstick = 0; }
    }
    return seen;
  }

  // ---- road blocks at junctions ahead
  _spawnBlock(n, force) {
    const g = this.game, p = g.player, V = g.vehicles, tr = g.traffic, col = g.worldCollider;
    if (!V || !tr || !tr.graph) return null;
    const pv = p.vehicle, ph = pv ? pv.heading : p.heading, fx = Math.sin(ph), fz = Math.cos(ph);
    let best = null, bd = Infinity, bestHid = true;
    for (const nd of tr.graph.nodes) {
      if (nd.out.length < 3) continue;
      const dx = nd.x - p.pos.x, dz = nd.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < (force ? 25 : 60) || d > (force ? 175 : 280)) continue;
      if ((dx * fx + dz * fz) / d < 0.72) continue;
      // (2026-11-26: a block is set up only where no player can see the junction - a building in the way, _hid - or, with
      //  no such junction ahead, from 200 m off down the road, where it fades in (six pixels of car). On 2026-11-24 it was
      //  "a building in the way within 145 m, else in plain view to 175 m"; before that 100 m and any wall segment.)
      const hid = force || this._hid(nd.x, nd.z);
      if (!hid && d < 200) continue;
      const s = d - (dx * fx + dz * fz) * 0.3 + (hid ? 0 : 40);
      if (s < bd) { bd = s; best = nd; bestHid = hid; }
    }
    if (!best) return null;
    // across the road the player will arrive on: perpendicular to the approach
    let ax = best.x - p.pos.x, az = best.z - p.pos.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
    // use the lane into the junction that best matches the approach direction
    for (const e of best.adj || []) {
      const n = e.xs.length, fromA = e.a === best;
      const ex = fromA ? e.xs[0] - e.xs[1] : e.xs[n - 1] - e.xs[n - 2], ez = fromA ? e.zs[0] - e.zs[1] : e.zs[n - 1] - e.zs[n - 2], el = Math.hypot(ex, ez) || 1;
      if ((ex * ax + ez * az) / el > 0.8) { ax = ex / el; az = ez / el; break; }
    }
    const cx = best.x - ax * 9, cz = best.z - az * 9, across = Math.atan2(az, -ax);
    // (hidden means where the block itself stands - its cars either side of the road and its officer, 9 m short of the
    //  junction - not just the junction: one car used to show round the corner of the building that hid the node. A
    //  block that would show nearer than 200 m is not set up; the next try is in six seconds.)
    if (!force && bestHid) {
      for (let i = 0; i < n && bestHid; i++) { const o = n === 1 ? 0 : (i - 0.5) * 4.6; if (!this._hid(cx + az * o, cz - ax * o)) bestHid = false; }
      if (bestHid && !this._hid(cx - ax * 3.2, cz - az * 3.2)) bestHid = false;
      if (!bestHid && Math.hypot(cx - p.pos.x, cz - p.pos.z) < 200) return null;
    }
    const u = { kind: 'block', cars: [], officers: [], x: cx, z: cz, h: across, state: 'chase', life: 0, ph: Math.random(), fin: bestHid ? 1 : 0, fout: 0 };
    for (let i = 0; i < n; i++) {
      const o = n === 1 ? 0 : (i - 0.5) * 4.6, px = cx + az * o, pz = cz - ax * o;
      if (col.isWet(px, pz)) continue;
      const v = V.spawn('car_saloon', px, pz, across + (i ? 0.25 : -0.25), { color: POLICE_WHITE, livery: 'police', driver: true });
      v.driver = 'ai'; v.parked = false; v.policeUnit = u; v.pid = this._uid = (this._uid || 0) + 1;
      v.rig.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });     // parked across the road: no lights, no shadow pass
      u.cars.push(v);
    }
    if (!u.cars.length) return null;
    const ch = this._officerChar('police');
    const ox = cx - ax * 3.2, oz = cz - az * 3.2;
    ch.group.position.set(ox, g.groundHeight(ox, oz), oz); ch.group.rotation.y = Math.atan2(-ax, -az); ch.setPose('stand');
    g.worldScene.add(ch.group);
    u.officers.push(ch); u.ox = ox; u.oz = oz;
    u.bx = best.x; u.bz = best.z;
    if (u.fin < 1) this._fadeUnit(u, 0);
    this.units.push(u);
    return u;
  }

  // ---- the helicopter
  _spawnHeli() {
    const g = this.game, p = g.player;
    if (!this._heliMesh) {
      this._heliMesh = new THREE.Mesh(heliGeo(0), MATS.body); this._heliMesh.name = 'police-heli'; this._heliMesh.castShadow = false;
      // searchlight: an additive ground disc (vertex-coloured radial falloff) + a faint cone at night
      const disc = new THREE.CircleGeometry(4.2, 24), cols = new Float32Array(disc.attributes.position.count * 3);
      for (let i = 0; i < disc.attributes.position.count; i++) { const x = disc.attributes.position.getX(i), y = disc.attributes.position.getY(i), k = Math.max(0, 1 - Math.hypot(x, y) / 4.2); for (let c = 0; c < 3; c++) cols[i * 3 + c] = k * (c === 2 ? 0.85 : 0.95); }
      disc.setAttribute('color', new THREE.BufferAttribute(cols, 3)); disc.rotateX(-Math.PI / 2);
      this._discMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -24 });
      this._decal = new THREE.Mesh(disc, this._discMat); this._decal.name = 'heli-searchlight'; this._decal.renderOrder = 3;
      const cone = new THREE.CylinderGeometry(0.3, 4.2, 1, 16, 1, true); cone.translate(0, -0.5, 0);
      this._coneMat = new THREE.MeshBasicMaterial({ color: 0x8a8f9a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      this._cone = new THREE.Mesh(cone, this._coneMat); this._cone.name = 'heli-beam';
    }
    // (it comes in from behind the camera - it used to appear in the sky 160 m off in any direction)
    let a = Math.random() * TAU;
    { const cam = g.camera, fwd = this._fwd || (this._fwd = new THREE.Vector3()); if (cam) { cam.getWorldDirection(fwd); if (Math.hypot(fwd.x, fwd.z) > 0.2) a = Math.atan2(-fwd.x, -fwd.z) + (Math.random() - 0.5) * 1.6; } }
    this._heliMesh.material = MATS.body; this._heliMesh.visible = true;
    const u = { kind: 'heli', x: p.pos.x + Math.sin(a) * 160, z: p.pos.z + Math.cos(a) * 160, y: 60, h: 0, lx: p.pos.x, lz: p.pos.z, ang: a, state: 'chase', life: 0 };
    g.worldScene.add(this._heliMesh, this._decal, this._cone);
    this.units.push(u);
    return u;
  }
  _heliUpdate(u, dt) {
    const g = this.game, p = g.player, night = !!(g.time && g.time.isNight);
    u.ang += dt * 0.25;
    const gx = u.state === 'leave' ? u.x + Math.sin(u.h) * 40 : p.pos.x + Math.sin(u.ang) * 22, gz = u.state === 'leave' ? u.z + Math.cos(u.h) * 40 : p.pos.z + Math.cos(u.ang) * 22;
    const k = u.pin ? 0 : Math.min(1, dt * 0.6);      // u.pin: test hook (screenshots) holds it in place
    const ox = u.x, oz = u.z;
    u.x += (gx - u.x) * k; u.z += (gz - u.z) * k; if (!u.pin) u.y += clamp((u.state === 'leave' ? 90 : 52) - u.y, -dt * 4, dt * 4);
    if (Math.hypot(u.x - ox, u.z - oz) > 0.01) u.h += wrap(Math.atan2(u.x - ox, u.z - oz) - u.h) * Math.min(1, dt * 1.5);
    const m = this._heliMesh;
    m.position.set(u.x, u.y, u.z); m.rotation.set(0.08, u.h, Math.sin(this.t * 0.7) * 0.04, 'YXZ');
    m.geometry = heliGeo(Math.floor(this.t * 28));
    // the searchlight lags behind you
    u.lx += (p.pos.x - u.lx) * Math.min(1, dt * 1.8); u.lz += (p.pos.z - u.lz) * Math.min(1, dt * 1.8);
    this._decal.position.set(u.lx, 0.2, u.lz);
    const day = g.time ? g.time.daylight : 1;
    this._discMat.color.setScalar(u.state === 'leave' ? 0 : 0.25 + (1 - day) * 0.9);
    this._decal.visible = u.state !== 'leave';
    this._cone.visible = night && u.state !== 'leave';
    if (this._cone.visible) {
      const dx = u.lx - u.x, dz = u.lz - u.z, dy = 0.2 - (u.y - 1.2), L = Math.hypot(dx, dy, dz);
      this._cone.position.set(u.x, u.y - 1.2, u.z); this._cone.scale.set(1, L, 1);
      this._cone.quaternion.setFromUnitVectors(_DOWN, _V.set(dx / L, dy / L, dz / L));
    }
    return Math.hypot(u.x - p.pos.x, u.z - p.pos.z);
  }

  // ---- per unit
  _unitUpdate(u, dt, i) {
    const g = this.game, p = g.player, V = g.vehicles, col = g.worldCollider;
    u.life += dt;
    let gone = false, hard = false;
    if (u.kind === 'foot') {
      if (u.down) this._downMove(u, dt); else this._footMove(u, dt);
      const grp = u.bike ? u.bike.group : u.ch.group;
      // boots / tyres on the drawn surface: resampled every 0.15 m, eased (a kerb is a small rise, not a pop)
      { const mx = u.x - u.gx, mz = u.z - u.gz; if (mx * mx + mz * mz > 0.0225) { u.gx = u.x; u.gz = u.z; const h = g.groundHeight(u.x, u.z); if (h === h) u.gy = h; } u.y += (u.gy - u.y) * Math.min(1, dt * 14); }
      const h0 = grp.rotation.y;
      grp.position.set(u.x, u.y, u.z); grp.rotation.y = u.h;
      if (u.bike && dt > 0) { u.lean += (clamp(-Math.atan((u.speed * wrap(u.h - h0) / dt) / 9.81), -0.4, 0.4) - u.lean) * Math.min(1, dt * 5); grp.rotation.z = u.lean; }   // leans into its turns
      if (u.bike) { const r = u.bike, R = TYPES.bike_road.R; u.wa = ((u.wa || 0) + u.speed / R * dt) % TAU; r.wheelF.rotation.x = u.wa; r.wheelR.rotation.x = u.wa; r.crank.rotation.x = u.wa * 0.38; }
      const d = Math.hypot(u.x - p.pos.x, u.z - p.pos.z);
      if (d < 80 || u.down) u.ch.update(dt, u.bike ? 0 : u.speed); else u.ch.lodTick();
      if (!u.down && u.state !== 'leave' && (u.sayT -= dt) <= 0 && d < 30) { u.sayT = 4 + Math.random() * 4; u.ch.say(pick(p.swim ? RIVER_LINES : LINES[u.kindLines]), 2.6); }
      // (sent home: gone once out of sight - it was "90 m off, or any wall segment in the way from 45 m")
      if (u.state === 'leave') { u.leaveT = (u.leaveT || 0) + dt; if (d > 45 && (d > 150 || u.leaveT > 45 || this._hid(u.x, u.z))) gone = true; }
      if (u.state !== 'leave' && d > 160) gone = true;
    } else if (u.kind === 'car') {
      if (!V || V.list.indexOf(u.v) < 0) gone = hard = true;
      else {
        const seen = this._carDrive(u, dt);
        if (u.state === 'leave') { u.lostT += dt; if ((!seen && u.lostT > 1) || u.lostT > 25) gone = true; }
      }
    } else if (u.kind === 'block') {
      for (const c of u.cars) { if (V && V.list.indexOf(c) >= 0) { V.drive(c, { throttle: 0, hand: true }, dt); if (c.rig.setBeacon) c.rig.setBeacon(Math.floor((this.t + u.ph) * 4) % 2); } }
      const d = Math.hypot(u.x - p.pos.x, u.z - p.pos.z);
      for (const ch of u.officers) { if (d < 80) { if (!ch.isDown) ch.group.rotation.y = Math.atan2(p.pos.x - ch.group.position.x, p.pos.z - ch.group.position.z); ch.update(dt, 0); } else ch.lodTick(); }
      if (d < 22 && !u.said && u.officers[0]) { u.said = true; u.officers[0].say(pick(LINES.roadblock), 3); }
      // passed it, or it's no longer needed: remove when nobody's looking
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading), behind = ((u.x - p.pos.x) * fx + (u.z - p.pos.z) * fz) < -40;
      if ((u.state === 'leave' || behind || d > 230 || u.life > 70) && (d > 280 || u.life > 110 || this._hid(u.x, u.z))) gone = true;
    } else if (u.kind === 'heli') {
      const d = this._heliUpdate(u, dt);
      if (u.state === 'leave' && (d > 260 || u.life > 120)) gone = true;
      if (u.state === 'leave' && !u.leftAt) { u.leftAt = this.t; u.h = Math.atan2(u.x - p.pos.x, u.z - p.pos.z); }
    }
    // (nobody is taken away before the eyes: a unit whose time is up where it can be seen fades out first - _fadeUnit)
    if (u.fout > 0) gone = hard || u.fout >= 1;
    else if (gone && !hard) {
      const ux = u.v ? u.v.x : u.x, uz = u.v ? u.v.z : u.z;
      if (u.kind === 'heli' || (Math.hypot(ux - p.pos.x, uz - p.pos.z) < 300 && !this._hid(ux, uz))) { u.fout = 1e-4; gone = false; }
    }
    if (!gone && (u.fin < 1 || u.fout > 0)) this._fadeUnit(u, dt);
    if (gone) this._removeUnit(u, i);
  }
  // ---- officers on foot can be knocked over (they were not: a car went straight through them, and through other
  // players' officers). Whoever drives into one decides it, as for walkers: our own unit goes over here and the pose goes
  // out with the unit ('police' message); another player's officer is knocked on their client ('polknock').
  /** One of OUR officers bowled over by something going at (vx, vz): bloodless — over, sits up, says so, comes after you again. */
  _knockUnit(u, vx, vz) {
    if (!u || u.kind !== 'foot' || !u.ch || u.down) return false;
    const v = Math.hypot(vx, vz); if (!(v >= KNOCK_V) || v > 80) return false;
    const g = this.game;
    if (u.bike) {
      // off the bicycle: it is left lying where it fell, they carry on on foot
      const b = u.bike; b.group.remove(u.ch.group); b.group.rotation.z = 1.35;
      (this._dropped || (this._dropped = [])).push({ g: b.group, t: this.t + 14 });
      u.bike = null; u.sub = 'foot'; u.lean = 0;
      u.ch.group.position.set(u.x, u.y, u.z); u.ch.group.rotation.set(0, u.h, 0); g.worldScene.add(u.ch.group);
    }
    const big = v >= 7, k = big ? Math.min(0.6, 6.5 / v) : Math.min(1, 3.5 / v) * 0.35;      // (as pedestrians.knock)
    u.h = Math.atan2(-vx, -vz); u.kvx = vx * k; u.kvz = vz * k; u.kdec = big ? 4.5 : 0;
    u.speed = 0; u.path = null; u.down = true;
    u.ch.setPose('stand'); u.ch.setPose(big ? 'tumble' : 'fall');
    u.ch.say(pick(LINES.knocked), 2.5);
    this._sendNet(true);
    return true;
  }
  /** A road block's officer (ours) bowled over where they stand: the pose goes out with the block ('police' message). */
  _knockBlockOfficer(ch, vx, vz) {
    const v = Math.hypot(vx, vz);
    if (!ch || ch.isDown || !(v >= KNOCK_V) || v > 80) return false;
    ch.group.rotation.y = Math.atan2(-vx, -vz); ch.setPose('stand'); ch.setPose(v >= 7 ? 'tumble' : 'fall'); ch.say(pick(LINES.knocked), 2.5);
    this._sendNet(true);
    return true;
  }
  _downMove(u, dt) {
    const col = this.game.worldCollider;
    u.speed = 0;
    if (u.kvx || u.kvz) {
      const P = this._P; P.x = u.x + u.kvx * dt; P.z = u.z + u.kvz * dt; col.resolve(P, 0.3);
      if (!col.isWet(P.x, P.z)) { u.x = P.x; u.z = P.z; } else u.kvx = u.kvz = 0;
      if (u.kdec) { const sp = Math.hypot(u.kvx, u.kvz), k = Math.max(0, sp - u.kdec * dt) / (sp || 1); u.kvx *= k; u.kvz *= k; }
      else { const k = Math.max(0, 1 - dt * 4); u.kvx *= k; u.kvz *= k; }
      if (Math.abs(u.kvx) + Math.abs(u.kvz) < 0.05) u.kvx = u.kvz = 0;
    }
    if (!u.ch.isDown) { u.down = false; u.kvx = u.kvz = 0; u.sayT = 0.6; this._sendNet(true); }
  }
  /** The vehicle we are driving, into an officer on foot: one of ours, a road block's, or another player's (their ghost here). */
  _knockOfficers() {
    const g = this.game, V = g.vehicles, v = V && V.current;
    if (!v || !V._sys || v.kind === 'punt' || g.player.place !== 'world') return;
    const car = v.kind === 'car', sp0 = v.speed || 0;
    const vx = car && Number.isFinite(v.vx) ? v.vx : Math.sin(v.heading) * sp0, vz = car && Number.isFinite(v.vz) ? v.vz : Math.cos(v.heading) * sp0, sp = Math.hypot(vx, vz);
    if (sp < KNOCK_V) return;
    const reach = car ? 0.35 : 0.5;
    const hit = (x, z) => Math.abs(x - v.x) < 8 && Math.abs(z - v.z) < 8 && (x - v.x) * vx + (z - v.z) * vz > 0 && V._sys.bodyDist(v, x, z) < reach;
    let n = 0, hx = 0, hz = 0;
    for (const u of this.units) {
      if (u.kind === 'foot') { if (!u.down && hit(u.x, u.z) && this._knockUnit(u, vx, vz)) { n++; hx = u.x; hz = u.z; } }
      else if (u.kind === 'block') for (const ch of u.officers) {
        const q = ch.group.position;
        if (ch.isDown || !hit(q.x, q.z)) continue;
        this._knockBlockOfficer(ch, vx, vz);
        n++; hx = q.x; hz = q.z;
      }
    }
    const net = g.net;
    if (net && net.connected) for (const [id, r] of this.remote) for (const q of r.units) {
      if (q.k !== 3 || !q.ch || q.dn || q.ch.isDown || (q.hitT && this.t - q.hitT < 1.5) || !hit(q.x, q.z)) continue;
      q.hitT = this.t;
      // (shown at once on our own screen for an officer on foot; their owner's next message carries the fall for everyone)
      if (!(q.sub & 1)) { q.h = q.th = Math.atan2(-vx, -vz); q.ch.setPose('stand'); q.ch.setPose(sp >= 7 ? 'tumble' : 'fall'); }
      try { net.send('polknock', { o: id, seed: q.seed | 0, x: r1(q.x), z: r1(q.z), vx: r2(vx), vz: r2(vz) }); } catch { /* not connected */ }
      n++; hx = q.x; hz = q.z;
    }
    if (!n) return;
    // (the car is checked a little, the bicycle a lot — as when it hits anybody)
    if (car) { v.vx *= 0.93; v.vz *= 0.93; } else if (Number.isFinite(v.speed)) v.speed *= 0.4;
    // (an officer saw it: the officer. Charged as knocking anybody over is, and always witnessed)
    if (this.config.enabled && !this.busy) {
      const src = car ? 'knock' : 'knock_bike', before = this.wanted.level, added = this.wanted.add(src, car ? HEAT.knockCar : HEAT.knockBike, 1.5);
      if (added > 0) this.lastOffence = { src, amount: added, seen: 1.5 };
      if (this.wanted.level > before) this._levelUp(before, this.wanted.level);
    }
    void hx; void hz;
  }
  _removeUnit(u, i = this.units.indexOf(u)) {
    const V = this.game.vehicles;
    if (u.kind === 'foot') { if (u.bike) { u.bike.group.remove(u.ch.group); u.bike.group.removeFromParent(); } this._releaseChar(u.ch); }
    else if (u.kind === 'car') { if (V) V.remove(u.v); }
    else if (u.kind === 'block') { for (const c of u.cars) if (V) V.remove(c); for (const ch of u.officers) this._releaseChar(ch); }
    else if (u.kind === 'heli') { this._heliMesh.removeFromParent(); this._decal.removeFromParent(); this._cone.removeFromParent(); }
    if (i >= 0) this.units.splice(i, 1);
  }
  clearUnits() { for (let i = this.units.length - 1; i >= 0; i--) this._removeUnit(this.units[i], i); }

  // ------------------------------------------------------------ busted
  async bust() {
    const g = this.game, p = g.player, V = g.vehicles;
    if (this.busy) return null;
    this.busy = true; this.bustT = 0;
    const level = Math.max(1, this.level), proctors = isProctors(level, this.wanted.univFrac);
    const priors = (g.state.police && g.state.police.busted) || 0, caution = priors === 0 && level <= 2;
    const fine = fineFor(level, proctors, priors), paid = charge(g.state.money || 0, fine, !proctors && level <= 2);
    const veh = p.vehicle, vname = veh ? (veh.livery ? 'police car' : (TYPES[veh.type] || {}).name || 'vehicle') : null;
    if (this.tussle) this._endTussle(false, true);
    p.frozen++;
    this._toast(proctors ? 'Caught by the Proctors!' : 'BUSTED!', 2.5);
    this._bustFlash = 1.6;
    const done = { level, proctors, fine, paid, vehicle: vname, caution };
    const run = () => {
      if (V && V.current) { const v = V.current; V.exit(true); V.remove(v); }
      this.clearUnits();
      for (const o of this.owners) if (o.rec && o.rec.ctl && g.pedestrians) g.pedestrians.control(o.rec, null);
      this.owners.length = 0;
      this.wanted.reset(); this.level = 0;
      const R = proctors ? this._proctorsSpot() : [STATION.x, STATION.z];
      p.teleport(R[0], R[1], proctors ? p.heading : STATION.h);
      if (paid > 0) g.pay(-paid);
      const st = g.state.police || (g.state.police = { busted: 0, fines: 0, proctors: 0 });
      st.busted++; st.fines = Math.round((st.fines + paid) * 100) / 100; if (proctors) st.proctors++;
      try { g.save && g.save(); } catch { /* */ }
      this._sendNet(true);
    };
    try { if (g.ui && g.ui.fade) await g.ui.fade(run); else run(); } catch (e) { console.warn('[police] bust', e); run(); }
    p.frozen = Math.max(0, p.frozen - 1);
    const money = `£${paid.toFixed(2)}`;
    const lines = proctors ? [
      { who: 'The Junior Proctor', text: 'You are, I take it, a member of this University?' },
      { who: 'The Junior Proctor', text: this._proctorCharge() },
      { who: 'The Junior Proctor', text: caution ? 'The statutes are quite clear. As this is your first appearance before me, I shall merely take your name.' : `The statutes are quite clear. You are fined ${money}${paid < fine ? ' (all you have on you)' : ''}.` },
      { who: 'The Junior Proctor', text: 'And should you appear before me again, you will do so in sub fusc. Good day.' },
    ] : [
      { who: 'Custody Sergeant', text: `Right then. ${level >= 3 ? 'Busy day, was it?' : 'Name?'}` },
      { who: 'Custody Sergeant', text: vname ? `We'll be keeping the ${vname}. It's evidence now.` : 'You can collect your dignity at the front desk.' },
      { who: 'Custody Sergeant', text: caution ? 'First time in? I\'ll put it down as a caution. No fine. This once.' : `That's a ${money} fine${paid < fine ? (level <= 2 ? ' (I\'ve left you your bus fare)' : ' (we took what you had)') : ''}. ${level >= 4 ? 'And a very long form.' : ''}`.trim() },
      { who: 'Custody Sergeant', text: 'Off you pop. And stay out of trouble.' },
    ];
    this.lastBust = done;
    try { if (g.ui && g.ui.dialog && !this.skipDialog) await g.ui.dialog(lines[0].who, lines); } catch { /* */ }
    this.busy = false;
    return done;
  }
  _proctorCharge() {
    const s = this.wanted.last || this.lastOffence?.src;
    return { parks_cycle: 'Cycling in the University Parks. There are SIGNS.', cricket_bike: 'You rode a bicycle across the cricket square. The groundsman is in tears.',
      cricket: 'You drove on the cricket square. I have no words. The groundsman has several.', quad_bike: 'Cycling in a college quad. On the grass, I am told.',
      quad: 'A motor vehicle. In a quad.', take_bike: 'Appropriating another member\'s bicycle.', knock_bike: 'Knocking over pedestrians with a bicycle. Twice, the porter says.' }[s]
      || 'Conduct unbecoming a member of the University.';
  }
  _proctorsSpot() {
    const g = this.game, peds = g.pedestrians;
    try { if (peds && peds._sys && peds._sys.nearestNode) { const n = peds._sys.nearestNode(PROCTORS.x, PROCTORS.z, 60); if (n >= 0) return [peds.graph.X[n], peds.graph.Z[n]]; } } catch { /* */ }
    return [-161.8, -259.9];
  }

  // ------------------------------------------------------------ owners chasing you (item 2) and the tussle
  _owners(dt) {
    const peds = this.game.pedestrians;
    for (let i = this.owners.length - 1; i >= 0; i--) {
      const o = this.owners[i], r = o.rec;
      if (!r || r.active === false || !peds || !peds.control) { this.owners.splice(i, 1); continue; }
      if (!o.started) {
        o.wait += dt;
        if (o.wait > 12) { this.owners.splice(i, 1); continue; }
        if (r.down || (r.character && r.character.pose === 'fall')) continue;
        o.started = true; o.t = 0; o.sx = r.x; o.sz = r.z;
        peds.control(r, (ped, dt2) => this._ownerCtl(o, ped, dt2));
        continue;
      }
      if (!r.ctl) this.owners.splice(i, 1);
    }
  }
  _ownerCtl(o, ped, dt) {
    const g = this.game, V = g.vehicles, p = g.player, peds = g.pedestrians, col = g.worldCollider;
    if (this.tussle && this.tussle.o === o) { ped.speed = 0; return true; }
    const v = o.v, alive = V && V.list.indexOf(v) >= 0;
    if (!alive || this.busy) { ped.character.say(pick(LINES.giveUp), 3); return false; }
    o.t += dt;
    const T = TYPES[v.type], fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    // aim for the driver's door (right-hand side; either side of a bike)
    const side = o.bike ? 0.8 : -(T.W / 2 + 0.6), dz0 = o.bike ? 0 : (T.seat ? T.seat.z : 0);
    const tx = v.x + fx * dz0 + fz * side, tz = v.z + fz * dz0 - fx * side;
    const d = Math.hypot(tx - ped.x, tz - ped.z), run = o.bike ? 5.8 : 5.4;
    if (o.t > 12 || Math.hypot(ped.x - o.sx, ped.z - o.sz) > 40) { ped.character.say(pick(LINES.giveUp), 3.2); return false; }
    if ((o.sayT -= dt) <= 0 && Math.hypot(ped.x - p.pos.x, ped.z - p.pos.z) < 35) { o.sayT = 2.6 + Math.random() * 1.5; ped.character.say(pick(o.bike ? LINES.chaseCyclist : LINES.chaseOwner), 2.2); }
    if (d > 1.2) {
      peds.moveTo(ped, tx, tz, run, dt);
      const P = this._P; P.x = ped.x; P.z = ped.z; col.resolve(P, 0.3); ped.x = P.x; ped.z = P.z;
      if (ped.character.pose !== 'stand') ped.character.setPose('stand');
      return true;
    }
    ped.speed = 0;
    const inIt = V.current === v, stopped = Math.abs(v.speed || 0) < 0.6;
    if (inIt && stopped && !this.tussle && !this.busy && !g.activity) { this._startTussle(o, ped); return true; }
    if (!inIt && !V.current && Math.abs(v.speed || 0) < 0.6 && v.driver === null && !this.taking()) {
      // abandoned: they simply get back in and drive off
      this._reclaim(o, ped, v, false);
      return false;
    }
    return true;
  }
  taking() { const V = this.game.vehicles; return !!(V && V.taking); }
  _startTussle(o, ped) {
    const g = this.game, p = g.player;
    this.tussle = { o, ped, v: o.v, grip: 0.55, t: 0, sayT: 0 };
    p.frozen++;
    ped.character.say(o.bike ? 'Get OFF my bike!' : 'Get OUT of my car!', 2.5);
    this._toast('They are trying to pull you out! Mash F to hold on!', 2.5);
  }
  _tussle(dt) {
    const g = this.game, tu = this.tussle, ped = tu.ped, inp = g.input;
    if (!ped.active || this.busy) { this._endTussle(true, true); return; }
    tu.t += dt;
    tu.grip -= (tu.o.bike ? 0.3 : 0.34) * dt;
    if (inp.hit('KeyF')) { tu.grip += 0.085; inp.pressed.delete('KeyF'); }
    tu.grip = Math.min(1, tu.grip);
    if ((tu.sayT -= dt) <= 0) { tu.sayT = 1.2; ped.character.setPose(ped.character.pose === 'talk' ? 'stand' : 'talk'); }
    // keep them at the door, facing in
    const v = tu.v; ped.heading = Math.atan2(v.x - ped.x, v.z - ped.z);
    if (tu.grip <= 0) this._endTussle(false);
    else if (tu.t > 3.4 && tu.grip > 0.12) this._endTussle(true);
  }
  _endTussle(won, silent = false) {
    const g = this.game, tu = this.tussle, p = g.player, peds = g.pedestrians;
    if (!tu) return;
    this.tussle = null;
    p.frozen = Math.max(0, p.frozen - 1);
    const ped = tu.ped;
    if (won) {
      if (ped.active) {
        ped.ctl = null;
        const dx = ped.x - tu.v.x, dz = ped.z - tu.v.z, d = Math.hypot(dx, dz) || 1;
        if (peds && peds.knock) peds.knock(ped, dx / d * 3, dz / d * 3);
        if (!silent) ped.character.say(pick(LINES.won), 3);
      }
      if (!silent) { this._toast('You held on. They bounce off, outraged.', 2.5); this._heat('tussle', HEAT.tussle, tu.v.x, tu.v.z, ped); }
      return;
    }
    this._reclaim(tu.o, ped, tu.v, true);
  }
  _reclaim(o, ped, v, pulledOut) {
    const g = this.game, V = g.vehicles, tr = g.traffic, peds = g.pedestrians, p = g.player;
    const name = (TYPES[v.type] || {}).name || 'vehicle';
    if (pulledOut && V.current === v) {
      V.exit(true);
      p.frozen++; this.fallT = 1.6; this._fallH = p.heading;
      try { p.character.setPose('fall'); } catch { /* */ }
    }
    const a = tr && tr.spawnAgentAt ? tr.spawnAgentAt(v.type, v.x, v.z, v.heading, v.color) : null;
    if (a || !tr) {
      V.remove(v);
      if (ped.active && peds) { ped.ctl = null; peds.remove(ped); }
    }
    if (pulledOut) this._toast(`They haul you out and drive off in their ${name}. Fair enough, really.`, 3);
    else this._toast(`The owner got their ${name} back.`, 2.5);
    this.reclaimed = (this.reclaimed || 0) + 1;
  }
  _fall(dt) {
    const p = this.game.player, grp = p.character.group;
    this.fallT -= dt;
    const k = clamp(1 - this.fallT / 1.6, 0, 1), a = k < 0.25 ? (k / 0.25) * 1.45 : k < 0.75 ? 1.45 : 1.45 * (1 - (k - 0.75) / 0.25);
    grp.rotation.order = 'YXZ'; grp.rotation.set(-a, p.heading, 0);
    if (this.fallT <= 0) { this.fallT = 0; grp.rotation.set(0, p.heading, 0); p.frozen = Math.max(0, p.frozen - 1); try { p.character.setPose('stand'); } catch { /* */ } }
  }

  // ------------------------------------------------------------ audio: two-tone siren + rotor
  _audio(dt) {
    const a = this.game.audio, p = this.game.player;
    if (!a || !a.ctx) return;
    let sir = 0, rot = 0;
    const px = p.pos.x, pz = p.pos.z, inside = p.place !== 'world';
    for (const u of this.units) {
      if (u.state === 'leave') continue;
      if (u.kind === 'car') sir = Math.max(sir, 1 - Math.hypot(u.v.x - px, u.v.z - pz) / 190);
      else if (u.kind === 'heli') rot = Math.max(rot, 1 - Math.hypot(u.x - px, u.z - pz) / 320);
    }
    for (const r of this.remote.values()) for (const q of r.units) {
      if (q.k === 0 || q.k === 1) sir = Math.max(sir, 1 - Math.hypot(q.x - px, q.z - pz) / 190);
      else if (q.k === 2) rot = Math.max(rot, 1 - Math.hypot(q.x - px, q.z - pz) / 320);
    }
    if (inside) { sir *= 0.25; rot *= 0.25; }
    const ctx = a.ctx, t = ctx.currentTime;
    if (sir > 0 && !this._siren) {
      try {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
        o.type = 'square'; f.type = 'lowpass'; f.frequency.value = 1500; gn.gain.value = 0;
        o.connect(f); f.connect(gn);
        // (spatial sound: the siren is AT the nearest police car — core/audio.js spatial(), direction only, the level below has the distance in it; kept until the siren stops)
        const sp = a.spatial ? a.spatial([px, pz], { dist: false, keep: true, cls: 'vehicle' }) : null; if (sp) gn.connect(sp);
        const pn = sp || (a.panTo ? a.panTo(gn, 0.001) : (gn.connect(a.master), null)); o.start();   // pn: the siren's place (or a stereo panner)
        this._siren = { o, gn, pn };
      } catch { this._siren = null; }
    }
    if (this._siren) {
      // UK two-tone: alternating ~0.55 s notes
      this._siren.o.frequency.setTargetAtTime(Math.floor(this.t / 0.55) % 2 ? 525 : 700, t, 0.012);
      this._siren.gn.gain.setTargetAtTime(Math.max(0, sir) * 0.045, t, 0.1);
      if (this._siren.pn && a.place && sir > 0) {             // pan towards the nearest siren
        let bd = 1e9, bx = px, bz = pz;
        for (const u of this.units) if (u.kind === 'car' && u.state !== 'leave') { const d = Math.hypot(u.v.x - px, u.v.z - pz); if (d < bd) { bd = d; bx = u.v.x; bz = u.v.z; } }
        for (const r of this.remote.values()) for (const q of r.units) if (q.k === 0 || q.k === 1) { const d = Math.hypot(q.x - px, q.z - pz); if (d < bd) { bd = d; bx = q.x; bz = q.z; } }
        if (this._siren.pn.set) this._siren.pn.set(bx, 1.4, bz); else if (this._siren.pn.pan) this._siren.pn.pan.setTargetAtTime(a.place(bx, bz, 190).pan, t, 0.15);
      }
      if (sir <= 0 && (this._sirOff = (this._sirOff || 0) + dt) > 2) { try { this._siren.o.stop(t + 0.3); } catch { /* */ } { const pn = this._siren.pn; if (pn && pn.free) setTimeout(() => pn.free(), 600); } this._siren = null; this._sirOff = 0; }
      else if (sir > 0) this._sirOff = 0;
    }
    if (rot > 0 && !this._rotor) {
      try {
        const len = ctx.sampleRate | 0, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
        const am = ctx.createGain(); am.gain.value = 0.5;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 17; const lg = ctx.createGain(); lg.gain.value = 0.5;
        lfo.connect(lg); lg.connect(am.gain);
        const gn = ctx.createGain(); gn.gain.value = 0;
        src.connect(f); f.connect(am); am.connect(gn); gn.connect(a.master); src.start(); lfo.start();
        this._rotor = { src, lfo, gn };
      } catch { this._rotor = null; }
    }
    if (this._rotor) {
      this._rotor.gn.gain.setTargetAtTime(Math.max(0, rot) * 0.22, t, 0.2);
      if (rot <= 0 && (this._rotOff = (this._rotOff || 0) + dt) > 3) { try { this._rotor.src.stop(t + 0.5); this._rotor.lfo.stop(t + 0.5); } catch { /* */ } this._rotor = null; this._rotOff = 0; }
      else if (rot > 0) this._rotOff = 0;
    }
  }

  // ------------------------------------------------------------ HUD
  _ui() {
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc || !doc.getElementById) return;
    let el = doc.getElementById('wanted');
    if (!el || !el.style) return;
    if (!el.parentNode && doc.getElementById('hud') && doc.getElementById('hud').appendChild) doc.getElementById('hud').appendChild(el);
    this.el = el; this._stars = -1; this._flash = null;
    try {
      el.innerHTML = '<span class="stars"></span><div class="bust"></div><div class="tussle"><b>F</b> <i></i></div>';
      this.elStars = el.querySelector ? el.querySelector('.stars') : null;
      this.elBust = el.querySelector ? el.querySelector('.bust') : null;
      this.elTussle = el.querySelector ? el.querySelector('.tussle') : null;
      this.elGrip = this.elTussle && this.elTussle.querySelector ? this.elTussle.querySelector('i') : null;
    } catch { /* headless */ }
  }
  _hud() {
    if (!this.elStars) return;
    const n = this.level, flash = n > 0 && !this.inSight;
    if (n !== this._stars) {
      this._stars = n;
      let h = ''; for (let i = 1; i <= 5; i++) h += `<b class="${i <= n ? 'on' : ''}">★</b>`;
      this.elStars.innerHTML = h;
      this.el.classList.toggle('wanted', n > 0);
    }
    if (flash !== this._flash) { this._flash = flash; this.el.classList.toggle('unseen', flash); }
    const bt = this.busy ? 0 : this.bustT;
    const btxt = bt > 0.05 ? `${this.wanted.univFrac >= 0.5 && n <= 1 ? 'Proctors' : 'Police'}: stay put and you're busted… ${Math.max(0, bustTime(n) - bt).toFixed(1)}` : '';
    if (btxt !== this._btxt) { this._btxt = btxt; this.elBust.textContent = btxt; this.elBust.style.display = btxt ? 'block' : 'none'; }
    const tg = this.tussle ? Math.round(this.tussle.grip * 100) : -1;
    if (tg !== this._tg) { this._tg = tg; this.elTussle.style.display = tg >= 0 ? 'block' : 'none'; if (this.elGrip) this.elGrip.style.width = Math.max(0, tg) + '%'; }
  }
  _toast(t, s) { try { this.game.ui.toast(t, s); } catch { /* */ } }

  // ------------------------------------------------------------ multiplayer
  _netHooks() {
    const net = this.game.net;
    if (!net || !net.on) return;
    // another player drove into one of OUR officers (they saw its ghost): it goes over here, and so for everybody
    net.on('polknock', (d, o) => {
      if (!o || !d || d.o !== net.id) return;
      const vx = +d.vx, vz = +d.vz, x = +d.x, z = +d.z;
      if (!Number.isFinite(vx) || !Number.isFinite(vz)) return;
      for (const u of this.units) {
        if (u.kind !== 'foot' || !u.ch || u.down || (u.ch._seed | 0) !== (d.seed | 0)) continue;
        if (o.place !== 'world' || Math.hypot(o.tx - u.x, o.tz - u.z) > 15) return;          // (only by somebody who is actually there)
        if (this._knockUnit(u, vx, vz) && Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x - u.x, z - u.z) < 5) { u.x = x; u.z = z; }
        return;
      }
      // ... or into an officer standing at one of our road blocks
      for (const u of this.units) {
        if (u.kind !== 'block') continue;
        for (const ch of u.officers) {
          if ((ch._seed | 0) !== (d.seed | 0)) continue;
          const q = ch.group.position;
          if (o.place !== 'world' || Math.hypot(o.tx - q.x, o.tz - q.z) > 15) return;
          this._knockBlockOfficer(ch, vx, vz);
          return;
        }
      }
    });
    // another player drove into one of OUR cars (they have a solid copy of it, systems/vehicles.js addBodies): what the
    // blow does to it is applied here, where the car is driven, and goes out to everybody with its next positions
    net.on('polhit', (d, o) => {
      if (!o || !d || d.o !== net.id) return;
      const V = this.game.vehicles; if (!V || !V.shunt) return;
      const dvx = +d.dvx, dvz = +d.dvz, dw = +d.dw || 0, imp = +d.imp || 0;
      if (!Number.isFinite(dvx) || !Number.isFinite(dvz)) return;
      for (const u of this.units) {
        const cars = u.kind === 'car' ? [u.v] : u.kind === 'block' ? u.cars : null;
        if (!cars) continue;
        for (const v of cars) {
          if (!v || v.pid !== d.i) continue;
          if (o.place !== 'world' || Math.hypot(o.tx - v.x, o.tz - v.z) > 15) return;          // (only by somebody who is actually there)
          // (their car, as we draw it, has just hit ours here as well: that blow has been dealt)
          if (v._rbId === o.id && V._sys && V._sys.t - v._rbT < 0.4) return;
          if (V.shunt(v, dvx, dvz, clamp(dw, -3, 3), imp, o.id)) { u.stuckT = 0; this.lastShunt = { pid: v.pid, by: o.id, dvx, dvz, imp }; this._sendNet(true); }
          return;
        }
      }
    });
    net.on('police', (d, o) => {
      if (!o || !d) return;
      let r = this.remote.get(o.id);
      if (!r) { r = { s: 0, units: [], o }; this.remote.set(o.id, r); }
      const s = clamp(d.s | 0, 0, 5);
      if (s !== r.s || !r.labelled) { r.s = s; r.labelled = true; try { o.character.setLabel(o.name + (s ? ' ' + '★'.repeat(s) : '')); } catch { /* */ } o.stars = s; }
      const list = Array.isArray(d.u) ? d.u.slice(0, 24) : [];
      // how old the message already is (d.t: the sender's shared clock; absent = 0): a car is drawn where it is NOW
      const tm = this.game.time, now = clock();
      const lat = Number.isFinite(d.t) && tm && tm.now ? clamp((tm.now() - d.t) / 1000, 0, 0.25) : 0;
      // the same unit keeps its ghost wherever it is in the list: a car by its id (8th field), an officer by their look;
      // meshes are (re)built only for a unit not seen before
      const old = r.units, next = [];
      for (let i = 0; i < list.length; i++) {
        const tu = list[i]; if (!Array.isArray(tu)) continue;
        const k = tu[0], x = +tu[1] || 0, z = +tu[2] || 0, h = +tu[3] || 0;
        if (k !== 0 && k !== 1 && k !== 2 && k !== 3) continue;
        const car = k === 0 || k === 1, sub = car ? 0 : tu[4], seed = car ? 0 : tu[5], dn = tu[6];
        const key = k === 3 ? 's' + seed + ':' + sub : car ? 'c' + k + ':' + (tu[7] !== undefined ? tu[7] : 'i' + i) : 'h' + i;
        const j = old.findIndex((e) => e && e.key === key);
        let q = j >= 0 ? old[j] : null;
        if (q) old[j] = null;
        else {
          q = { key, k, x, z, h, tx: x, tz: z, th: h, sub, seed, ch: null, sp: 0, mesh: null, id: car ? tu[7] : undefined, vx: 0, vz: 0, w: 0, ex: 0, ez: 0, eh: 0, rt: now, blk: k === 3 && tu[7] === 1 };
          q.mesh = k === 3 ? this._footGhost(q) : this._ghost(k);
          if (car && q.id !== undefined) q.hit = (v, body, dvx, dvz, dw, own, imp) => this._ghostHit(o.id, q, v, dvx, dvz, dw, own, imp);
        }
        if (car) {
          // dead reckoning from the velocity sent with it (5th-7th fields); what is on screen is carried over, the
          // difference fading in a fraction of a second (no lunge, and no lag behind a car at speed)
          const vx = +tu[4] || 0, vz = +tu[5] || 0, w = +tu[6] || 0, nx = x + vx * lat, nz = z + vz * lat, nh = h + w * lat;
          this._dr(q, now);
          q.ex = q.x - nx; q.ez = q.z - nz; q.eh = wrap(q.h - nh);
          if (Math.hypot(q.ex, q.ez) > 8) q.ex = q.ez = q.eh = 0;
          q.tx = nx; q.tz = nz; q.th = nh; q.vx = vx; q.vz = vz; q.w = w; q.rt = now;
          this._dr(q, now);
        } else { q.tx = x; q.tz = z; q.th = h; }
        // an officer on foot knocked over (7th field: 1 a fall, 2 a tumble): the same fall here, once
        if (k === 3 && q.ch) { const d2 = dn === 1 || dn === 2 ? dn : 0; if (d2 && !q.dn && !q.ch.isDown) { q.h = q.th; q.ch.setPose('stand'); q.ch.setPose(d2 === 2 ? 'tumble' : 'fall'); } q.dn = d2; }
        next.push(q);
      }
      for (const q of old) if (q) this._dropGhost(q);
      r.units = next;
    });
  }
  /** where another player's car is now: its last reported place run on at its reported velocity (for at most half a
   *  second), plus what is left of the difference to where we had it when that report came (fades at 9 /s) */
  _dr(q, now) {
    const a = Math.max(0, now - q.rt), age = Math.min(0.5, a), e = Math.exp(-a * 9);
    q.x = q.tx + q.vx * age + q.ex * e; q.z = q.tz + q.vz * age + q.ez * e; q.h = q.th + q.w * age + q.eh * e;
  }
  /** (systems/vehicles.js addBodies, every frame before anything of ours moves) those cars as bodies: our car and bike
   *  hit them, we cannot walk through them, children and animals are kept out from under them */
  _remoteBodies(add) {
    if (!this.remote.size) return;
    const g = this.game, others = g.net && g.net.others;
    if (!others || g.player.place !== 'world') return;
    const now = clock();
    for (const [id, r] of this.remote) {
      const o = others.get(id);
      if (!o || o.place !== 'world') continue;
      for (const q of r.units) {
        if (q.k !== 0 && q.k !== 1) continue;
        this._dr(q, now);
        add(q, q.k === 1 ? 'van' : 'car_saloon', q.x, q.z, q.sy || 0, q.h, q.vx, q.vz, q.w);
      }
    }
  }
  /** OUR car drove into another player's police car (its solid copy here). Their client drives it: it is told what the
   *  blow does to it ('polhit', as 'polknock' for an officer). Only what we drove into it ourselves — a car of theirs
   *  that ran into us deals its own blow on their client. And ramming the police is an offence whoever they were after. */
  _ghostHit(owner, q, v, dvx, dvz, dw, own, imp) {
    const g = this.game, V = g.vehicles, net = g.net;
    if (!V || v !== V.current || !(own >= 1.5) || !net || !net.connected) return;
    if (q.hitT !== undefined && this.t - q.hitT < 0.25) return;
    const first = q.hitT === undefined || this.t - q.hitT > 1.2;
    q.hitT = this.t;
    try { net.send('polhit', { o: owner, i: q.id, dvx: r2(dvx), dvz: r2(dvz), dw: r2(dw), imp: r1(imp), x: r1(q.x), z: r1(q.z) }); } catch { /* not connected */ }
    if (first && imp > 2.5) this._heat('hit_police', HEAT.hitPolice + imp * 0.5, v.x, v.z);
  }
  /** another player's officer on foot or on a bike (kind 3): the same person (look from kind + seed) on every client */
  _footGhost(q) {
    const kind = OFFICER_KINDS[(q.sub >> 1) % 3] || 'police';
    try {
      q.ch = createCharacter(officerLook(kind, q.seed | 0));
      if (q.sub & 1) { q.bike = makeLive('bike_road', 0x121212); q.bike.group.add(q.ch.group); q.ch.group.position.set(0, 0, -0.08); q.ch.setPose('cycle'); return q.bike.group; }
      q.ch.setPose('stand'); return q.ch.group;
    } catch (e) { q.ch = null; return null; }
  }
  _dropGhost(q) {
    if (!q) return;
    if (q.mesh) q.mesh.removeFromParent();
    if (q.ch) { try { q.ch.dispose(); } catch { /* */ } q.ch = null; }
  }
  _ghost(k) {
    if (k === 2) { const m = new THREE.Mesh(heliGeo(0), MATS.body); m.name = 'remote-heli'; return m; }
    const m = makeGhost(k === 1 ? 'van' : 'car_saloon', POLICE_WHITE, 'police'); m.name = 'remote-police';
    return m;
  }
  _remoteUpdate(dt) {
    if (!this.remote.size) return;
    const g = this.game, others = g.net && g.net.others, now = clock();
    for (const [id, r] of this.remote) {
      const o = others && others.get(id);
      if (!o) { for (const q of r.units) this._dropGhost(q); this.remote.delete(id); continue; }
      const here = o.place === g.player.place && g.player.place === 'world';
      for (const q of r.units) {
        const k = Math.min(1, dt * 6), ox = q.x, oz = q.z;
        if (q.k === 0 || q.k === 1) this._dr(q, now);
        else { q.x += (q.tx - q.x) * k; q.z += (q.tz - q.z) * k; q.h += wrap(q.th - q.h) * k; }
        if (q.ch && here) { const v = dt > 0 ? Math.hypot(q.x - ox, q.z - oz) / dt : 0; q.sp += (v - q.sp) * Math.min(1, dt * 4); q.ch.update(dt, q.sub & 1 ? 0 : q.sp); }
        if (!q.mesh) continue;
        if (here && q.mesh.parent !== g.worldScene) g.worldScene.add(q.mesh);
        else if (!here && q.mesh.parent) q.mesh.removeFromParent();
        if (q.k !== 2) { const mx = q.x - (q.gx || 0), mz = q.z - (q.gz || 0); if (q.gy === undefined || mx * mx + mz * mz > 0.09) { q.gx = q.x; q.gz = q.z; const h = g.groundHeight(q.x, q.z); q.gy = h === h ? h : 0; if (q.sy === undefined) q.sy = q.gy; } q.sy += (q.gy - q.sy) * Math.min(1, dt * 14); }
        q.mesh.position.set(q.x, q.k === 2 ? 52 : q.sy, q.z); q.mesh.rotation.y = q.h;
        if (q.k === 2) q.mesh.geometry = heliGeo(Math.floor(this.t * 28));
      }
    }
  }
  _sendNet(force) {
    const net = this.game.net;
    if (!net || !net.connected) return;
    // every unit of ours, for everybody in the room (so also for whoever joins in the middle of it: this goes out 4-7
    // times a second for as long as there is anything). A car: [0 car | 1 van, x, z, heading, vx, vz, yaw rate, id];
    // a road block's cars are cars; an officer: [3, x, z, heading, kind * 2 + on a bike, look seed, 0 | 1 fall | 2 tumble,
    // 1 if standing at a road block]; the helicopter: [2, x, z, heading]. t: when, on the shared clock.
    const u = [];
    let fast = false;
    const car = (k, c) => { const w = (c.yr || 0) + (c.spin || 0); if (Math.abs(c.vx || 0) + Math.abs(c.vz || 0) > 0.5 || Math.abs(w) > 0.2) fast = true; u.push([k, r2(c.x), r2(c.z), r2(c.heading), r1(c.vx || 0), r1(c.vz || 0), r2(w), c.pid | 0]); };
    for (const x of this.units) {
      if (x.kind === 'car') car(x.sub === 'van' ? 1 : 0, x.v);
      else if (x.kind === 'block') {
        for (const c of x.cars) car(0, c);
        for (const ch of x.officers) { const q = ch.group.position; u.push([3, r1(q.x), r1(q.z), r2(ch.group.rotation.y), Math.max(0, OFFICER_KINDS.indexOf(ch._kind)) * 2, ch._seed | 0, ch.isDown ? (ch.pose === 'tumble' ? 2 : 1) : 0, 1]); }
      }
      else if (x.kind === 'heli') u.push([2, r1(x.x), r1(x.z), r2(x.h)]);
      else if (x.kind === 'foot' && x.ch) u.push([3, r1(x.x), r1(x.z), r2(x.h), OFFICER_KINDS.indexOf(x.ch._kind) * 2 + (x.sub === 'bike' ? 1 : 0), x.ch._seed | 0, x.down ? (x.ch.pose === 'tumble' ? 2 : 1) : 0]);
      if (u.length >= 20) break;
    }
    this._netFast = fast;
    const quiet = !this.level && !u.length;
    if (quiet && this._wasQuiet && !force) return;
    this._wasQuiet = quiet;
    const tm = this.game.time;
    net.send('police', { s: this.level, u, t: tm && tm.now ? Math.round(tm.now()) : undefined });
  }

  // ------------------------------------------------------------ API + test hooks
  _api() {
    const self = this;
    return {
      get level() { return self.wanted.level; },
      get heat() { return self.wanted.heat; },
      get inSight() { return self.inSight; },
      get units() { return self.units; },
      get busy() { return self.busy; },
      get bustT() { return self.bustT; },
      get tussle() { return self.tussle; },
      get owners() { return self.owners; },
      get lastBust() { return self.lastBust; },
      get lastOffence() { return self.lastOffence; },
      wanted: self.wanted, config: self.config, station: STATION, proctors: PROCTORS,
      /** add heat as if an offence `src` was witnessed (seen: 0/1/1.5, default 1) */
      add: (src, amount, seen = 1) => { const b = self.wanted.level; const r = self.wanted.add(src, amount, seen); self.level = self.wanted.level; if (self.level > b) self._levelUp(b, self.level); return r; },
      /** jump straight to n stars (test hook) */
      setLevel: (n) => { self.wanted.reset(); if (n > 0) self.wanted.add('debug', LEVELS[Math.min(5, n)] + 4, 1); self.level = self.wanted.level; self.inSight = true; self.wanted.unseenT = 0; return self.level; },
      clear: () => { self.wanted.reset(); self.level = 0; self.clearUnits(); },
      bust: () => self.bust(),
      witnesses: (x, z) => self.witnesses(x, z),
      onCarriageway: (x, z) => self.onCarriageway(x, z),
      offenceAt: (kind, x, z, speed = 5) => self._offence({ kind, x, z, speed }),
      /** test hook: n stars with the units spawned close by straight away (`near`) */
      debugChase(level, opts = {}) {
        this.setLevel(level);
        self.clearUnits();
        const R = response(level, self._tier());
        const out = [];
        for (let i = 0; i < R.cars; i++) out.push(self._spawnCar('car', opts.near !== false));
        for (let i = 0; i < R.vans; i++) out.push(self._spawnCar('van', opts.near !== false));
        for (let i = 0; i < R.foot; i++) out.push(self._spawnFoot(opts.near !== false));
        if (R.heli) out.push(self._spawnHeli());
        if (R.roadblock && opts.block !== false) out.push(self._spawnBlock(R.roadblock, true));
        self._manageT = 2;
        return out.filter(Boolean).map((u) => u.kind + (u.sub ? ':' + u.sub : ''));
      },
      debugRoadblock: (n = 2) => { const u = self._spawnBlock(n, true); return u ? { x: +u.x.toFixed(1), z: +u.z.toFixed(1), cars: u.cars.length } : null; },
      debugTussle: () => { const V = self.game.vehicles, v = V && V.current; if (!v) return false; const ped = self.game.pedestrians.adopt(v.x - 2, v.z, null, { standing: true }); if (!ped) return false; const o = { rec: ped, v, bike: v.kind === 'bike', t: 0, sx: ped.x, sz: ped.z, started: true, sayT: 0, wait: 0 }; self.owners.push(o); self.game.pedestrians.control(ped, (pp, dt) => self._ownerCtl(o, pp, dt)); self._startTussle(o, ped); return true; },
      stats: () => ({ level: self.level, heat: +self.wanted.heat.toFixed(1), univ: +self.wanted.univFrac.toFixed(2), inSight: self.inSight, units: self.units.map((u) => u.kind + (u.sub ? ':' + u.sub : '') + (u.state === 'leave' ? '(leaving)' : '')),
        bustT: +self.bustT.toFixed(2), owners: self.owners.length, tussle: !!self.tussle, state: self.game.state.police || null }),
      _sys: self,
    };
  }
}

/** Pure-pursuit carrot: nearest point on path P to (x,z) (searching segments near index i0), then `look` m further along.
 *  Writes out.x/z, returns the nearest segment index (pass back as i0 next frame). */
function carrot(P, x, z, look, i0, out) {
  let bd = Infinity, bi = 0, bt = 0;
  const lo = Math.max(0, i0 - 3), hi = look === 0 ? P.length - 1 : Math.min(P.length - 1, i0 + 14);
  for (let i = lo; i < hi; i++) {
    const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, L2 = dx * dx + dz * dz || 1e-6;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), d = (x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2;
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  let i = bi, px = P[i][0] + (P[i + 1][0] - P[i][0]) * bt, pz = P[i][1] + (P[i + 1][1] - P[i][1]) * bt, left = look;
  while (left > 0 && i < P.length - 1) {
    const qx = P[i + 1][0], qz = P[i + 1][1], L = Math.hypot(qx - px, qz - pz);
    if (L >= left) { px += (qx - px) / L * left; pz += (qz - pz) / L * left; left = 0; break; }
    left -= L; px = qx; pz = qz; i++;
  }
  out.x = px; out.z = pz;
  return bi;
}
const _C = { x: 0, z: 0 }, FEELERS = [0.45, -0.45, 0.9, -0.9, 1.4, -1.4];
/** index of the end point of the path segment nearest (x,z) */
function nearestSegEnd(P, x, z) {
  let bd = Infinity, bi = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, L2 = dx * dx + dz * dz || 1e-6;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), d = (x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2;
    if (d < bd) { bd = d; bi = i + 1; }
  }
  return Math.min(bi, P.length - 1);
}
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const _V = new THREE.Vector3(), _DOWN = new THREE.Vector3(0, -1, 0);
