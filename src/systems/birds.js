// Birds: in the sky over the whole map, and now and then a few that fly in and land near you.
//   _birds_logic.js   pure: the species, the wing beat, who is about by hour and weather, and the flocks of the sky
//                     (functions of the shared map and the shared clock: every player sees the same flocks, nothing sent)
//   _birds_geo.js     ONE low-poly bird, one material, ONE instanced draw for every bird (species and pose in the
//                     vertex shader); no shadow, no blending, nothing allocated a frame
//   _birds_place.js   where a bird may land: open ground, water (water birds), wall and hedge tops, bench backs,
//                     flat-roof edges, each as drawn — never inside a building / hedge / wall, never on a carriageway
// In the sky (Sky): town pigeons wheeling off the roofs of the centre, gulls crossing from edge to edge, crows /
// jackdaws / wood pigeons / magpies from tree to tree, starlings at speed (more towards dusk), skeins of geese along the
// rivers at dawn and dusk, ducks low and fast along them, red kites (and a buzzard) turning slowly over Port Meadow, the
// airfield and the outskirts, gulls turning high up, swifts in fine warm weather. Fewer in rain, none at night (the
// soarers come down to the trees as the light goes). They keep above the roofs and the trees (a height grid), and are
// laid out over the whole map, so from a glider there are birds below and beside you; near a glider they sheer off
// (they pass 40 m or more off; nothing is ever hit). Far birds are drawn larger than life — never less than 10 px of
// wing span in a 720-line picture, 24 px from the air — and beyond 40 m their wings are turned towards the eye and,
// seen from below, darkened to a silhouette: a level bird is otherwise an edge-on hairline nobody can see.
// Landing near you (Landers; local to each player, they answer to what is near THEM): every so often a small party
// suited to the place (pigeons in town, blackbirds / a robin / sparrows / a magpie in green space, mallards, geese and
// gulls by water) flies in, lands on spots _birds_place.js allows, walks, hops and pecks about, and goes up in a burst
// when you, another player, a walker or a vehicle comes within a couple of metres — or by itself after a minute or so.
// Tiers: low / medium / high draw at most 48 / 110 / 160 sky birds within 420 / 560 / 700 m (wider from the air) from
// 70 % / 80 % / all of the flocks, and land at most 5 / 9 / 14. ?birds=0 (node GTO_BIRDS=0): nothing is built.
// game.birds = { stats(), sys, sky, spots, layer, species, debug: { spawn(opts), flush(), clear(), settle() } }
import * as THREE from 'three';
import { BIRDS_ON, SPECIES, SP, WATER_BIRD, standH, flap, FLAP, activity, Sky, KIND, EPOCH, sstep } from './_birds_logic.js';
import { BirdLayer, MAX_BIRDS } from './_birds_geo.js';
import { Spots } from './_birds_place.js';
import { buildGrid, sampleGrid } from './_amb_logic.js';

export const BIRD_TIERS = {
  low: { share: 0.7, members: 0.7, sky: 48, R: 420, ground: 5, groups: 1 },
  medium: { share: 0.8, members: 0.85, sky: 110, R: 560, ground: 9, groups: 1 },
  high: { share: 1, members: 1, sky: 160, R: 700, ground: 14, groups: 2 },
};
BIRD_TIERS.ultra = BIRD_TIERS.high;
const PARTS = ['day', 'dusk', 'dawndusk', 'soar', 'fine'];
const FLOOR_GROUND = 10, FLOOR_AIR = 24;      // least wing span on the screen, px of a 720-line picture: from the street / from the air
const FACE = 0.8;                            // how far a distant bird's wings are turned to face the eye
const AVOID = 70, PUSH = 42;                 // a glider within AVOID m moves a bird up to PUSH m out of its way
const MAXG = 14;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const isNum = (v) => v === v;
const _fw = new THREE.Vector3();
const FINE = { rain: 0, fog: 0, tempC: 15, cloud: 0.3 };

// ================================================================================================ the landing birds
const ST = { free: 0, in: 1, land: 2, out: 3 };
const FAN_OUT = [0, 0.55, -0.55, 1.1, -1.1, 1.7, -1.7, 2.4, -2.4, 3.14], FAN_IN = [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2, 3.14];
class Landers {
  constructor(sys) {
    this.sys = sys; this.list = [];
    for (let i = 0; i < MAXG; i++) this.list.push({ st: 0, sp: 0, grp: 0, x: 0, y: 0, z: 0, h: 0, t: 0, dur: 1, P: new Float32Array(12), kind: '', sy: 0, act: 0, actT: 0, tx: 0, tz: 0, ph: 0, delay: 0, leave: 0, fold: 0, peck: 0, k: 1, hx: 0, hz: 0, afloat: false, th: 0, skip: null });
    this.wait = 7; this.grp = 0; this.scanT = 0; this.landed = 0; this.flying = 0; this.spawned = 0; this.flushed = 0;
    this._o = { x: 0, y: 0, z: 0, h: 0, kind: '' }; this._env = {}; this._q = [0, 0, 0]; this._d = [0, 0, 0];
  }
  clear() { for (const b of this.list) b.st = 0; this.landed = this.flying = 0; }
  count() { let n = 0; for (const b of this.list) if (b.st) n++; return n; }
  groups() { let m = 0, n = 0; for (const b of this.list) if (b.st && !(m & (1 << (b.grp & 31)))) { m |= 1 << (b.grp & 31); n++; } return n; }

  // ---- a cubic through the air, its tangent, and whether it is clear of buildings
  _bez(P, u, o) { const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u; o[0] = a * P[0] + b * P[3] + c * P[6] + d * P[9]; o[1] = a * P[1] + b * P[4] + c * P[7] + d * P[10]; o[2] = a * P[2] + b * P[5] + c * P[8] + d * P[11]; return o; }
  _tan(P, u, o) { const v = 1 - u, a = 3 * v * v, b = 6 * v * u, c = 3 * u * u; o[0] = a * (P[3] - P[0]) + b * (P[6] - P[3]) + c * (P[9] - P[6]); o[1] = a * (P[4] - P[1]) + b * (P[7] - P[4]) + c * (P[10] - P[7]); o[2] = a * (P[5] - P[2]) + b * (P[8] - P[5]) + c * (P[11] - P[8]); return o; }
  _clear(P, from, to) { const S = this.sys.spots, q = this._q; for (let k = 0; k <= 48; k++) { const u = from + (to - from) * k / 48; this._bez(P, u, q); if (!S.airClear(q[0], q[1], q[2], this._skip)) return false; } return true; }
  _len(P) { return 0.88 * (Math.hypot(P[3] - P[0], P[4] - P[1], P[5] - P[2]) + Math.hypot(P[6] - P[3], P[7] - P[4], P[8] - P[5]) + Math.hypot(P[9] - P[6], P[10] - P[7], P[11] - P[8])); }

  /** the way in to a spot from direction (ex, ez): level, then steeply down onto it. -> clear of buildings? */
  _pathIn(b, sx, sy, sz, ex, ez, D) {
    this._skip = b.skip;
    const P = b.P, R = this.sys.sky.relief, x0 = sx + ex * D, z0 = sz + ez * D, y0 = Math.max(sy + 9, R.at(x0, z0) + 4);
    P[0] = x0; P[1] = y0; P[2] = z0; P[3] = x0 - ex * D * 0.4; P[4] = y0 - 0.5; P[5] = z0 - ez * D * 0.4;
    P[6] = sx + ex * 3.2; P[7] = sy + 2.4; P[8] = sz + ez * 3.2; P[9] = sx; P[10] = sy; P[11] = sz;
    return this._clear(P, 0, 0.97);
  }
  /** the way out from where it stands, towards (ex, ez): straight up off the ground, then away over the roofs */
  _pathOut(b, ex, ez, D) {
    this._skip = b.skip;
    const P = b.P, R = this.sys.sky.relief, x1 = b.x + ex * D, z1 = b.z + ez * D, y1 = Math.max(b.y + 13, R.at(x1, z1) + 6);
    P[0] = b.x; P[1] = b.y; P[2] = b.z; P[3] = b.x + ex * 1.6; P[4] = b.y + 4.5; P[5] = b.z + ez * 1.6;
    P[6] = x1 - ex * D * 0.45; P[7] = y1 - 1; P[8] = z1 - ez * D * 0.45; P[9] = x1; P[10] = y1; P[11] = z1;
    return this._clear(P, 0.03, 1);
  }

  /** send bird b up and away from (tx, tz) */
  _flush(b, tx, tz) {
    const rnd = Math.random;
    let ax = b.x - tx, az = b.z - tz; const l = Math.hypot(ax, az);
    if (l < 0.05) { const a = rnd() * 6.2832; ax = Math.cos(a); az = Math.sin(a); } else { ax /= l; az /= l; }
    const a0 = Math.atan2(az, ax) + (rnd() - 0.5) * 0.7, D = 46 + rnd() * 26 + SPECIES[b.sp].len * 20;
    let ok = false;
    for (const da of FAN_OUT) { if (this._pathOut(b, Math.cos(a0 + da), Math.sin(a0 + da), D)) { ok = true; break; } }
    if (!ok) {
      // hemmed in (a yard, a lane): straight up over whatever stands round it, then off over the roofs; failing that, straight up
      const P = b.P, R = this.sys.sky.relief, top = Math.max(b.y + 12, R.at(b.x, b.z) + 5);
      for (const da of FAN_OUT) {
        const ex = Math.cos(a0 + da), ez = Math.sin(a0 + da), x1 = b.x + ex * 34, z1 = b.z + ez * 34, y1 = Math.max(top + 3, R.at(x1, z1) + 6, R.at(b.x + ex * 17, b.z + ez * 17) + 6);
        P[0] = b.x; P[1] = b.y; P[2] = b.z; P[3] = b.x; P[4] = b.y + (top - b.y) * 0.7; P[5] = b.z; P[6] = b.x + ex * 3; P[7] = y1; P[8] = b.z + ez * 3; P[9] = x1; P[10] = y1; P[11] = z1;
        if (this._clear(P, 0.03, 1)) { ok = true; break; }
      }
      if (!ok) { P[0] = P[3] = P[6] = P[9] = b.x; P[2] = P[5] = P[8] = P[11] = b.z; P[1] = b.y; P[4] = b.y + 4; P[7] = top; P[10] = top + 6; }
    }
    const sp = SPECIES[b.sp];
    b.st = ST.out; b.t = 0; b.dur = Math.max(2.6, this._len(b.P) / (sp.v * 0.8)); b.peck = 0; this.flushed++;
  }

  /** flying in to land: the party for this spot. opts: {species: name, kind, n} (debug). -> how many set off */
  spawn(opts = {}) {
    const S = this.sys, g = S.game, P = S.spots, p = g.player, rnd = Math.random, tier = S.tier;
    if (!P.build()) return 0;
    const fp = footOf(p), px = fp.x, pz = fp.z, E = sampleGrid(S.grid(), px, pz, this._env);
    g.camera.getWorldDirection(_fw); const fl = Math.hypot(_fw.x, _fw.z) || 1, fx = _fw.x / fl, fz = _fw.z / fl;
    // ---- who, by the place
    let who, n, kinds;
    const u = rnd(), meadow = px < -886;
    const nearWater = E.water > 0.55 || (opts.kind === 'water');
    if (opts.species) { who = [SP[opts.species]]; n = opts.n || 3; kinds = [opts.kind || (WATER_BIRD.has(who[0]) && nearWater ? 'water' : 'ground')]; }
    else if (meadow) { if (u < 0.4) { who = [rnd() < 0.5 ? SP.canada_goose : SP.greylag]; n = 3 + Math.floor(rnd() * 3); } else if (u < 0.65) { who = [SP.gull]; n = 2 + Math.floor(rnd() * 3); } else if (u < 0.85) { who = [SP.starling]; n = 5; } else { who = [SP.crow]; n = 2; } kinds = ['ground']; }
    else if (nearWater && u < 0.62) {
      if (u < 0.36) { who = [SP.mallard, SP.mallard_hen]; n = 2 + Math.floor(rnd() * 3); kinds = rnd() < 0.6 ? ['water', 'ground'] : ['ground', 'water']; }
      else if (u < 0.5) { who = [rnd() < 0.55 ? SP.canada_goose : SP.greylag]; n = 2 + Math.floor(rnd() * 2); kinds = E.green > 0.3 && rnd() < 0.6 ? ['ground', 'water'] : ['water', 'ground']; }
      else { who = [SP.gull]; n = 1 + Math.floor(rnd() * 3); kinds = rnd() < 0.4 ? ['water', 'wall', 'ground'] : ['wall', 'ground', 'roof']; }
    } else if (E.green > 0.4) {
      if (u < 0.24) { who = [SP.blackbird, SP.blackbird_hen]; n = 1 + Math.floor(rnd() * 2); kinds = ['ground']; }
      else if (u < 0.38) { who = [SP.robin]; n = 1; kinds = ['wall', 'bench', 'hedge', 'ground']; }
      else if (u < 0.6) { who = [SP.sparrow]; n = 3 + Math.floor(rnd() * 3); kinds = rnd() < 0.5 ? ['hedge', 'ground'] : ['ground']; }
      else if (u < 0.76) { who = [SP.woodpigeon]; n = 1 + Math.floor(rnd() * 2); kinds = ['ground']; }
      else if (u < 0.88) { who = [SP.magpie]; n = 1 + Math.floor(rnd() * 2); kinds = ['ground', 'wall']; }
      else { who = [rnd() < 0.5 ? SP.crow : SP.jackdaw]; n = 2 + Math.floor(rnd() * 2); kinds = ['ground']; }
    } else {
      if (u < 0.72) { who = [SP.pigeon, SP.pigeon, SP.pigeon_dark, SP.pigeon, SP.pigeon_pied, SP.pigeon_dark]; n = 3 + Math.floor(rnd() * 4); kinds = ['ground']; }
      else if (u < 0.82) { who = [SP.jackdaw]; n = 2 + Math.floor(rnd() * 2); kinds = ['roof', 'ground']; }
      else if (u < 0.9) { who = [SP.gull]; n = 1 + Math.floor(rnd() * 2); kinds = ['roof', 'wall', 'ground']; }
      else if (u < 0.96) { who = [SP.sparrow]; n = 3 + Math.floor(rnd() * 2); kinds = ['ground', 'hedge', 'wall']; }
      else { who = [SP.pigeon, SP.pigeon_dark]; n = 2 + Math.floor(rnd() * 2); kinds = ['roof', 'wall', 'bench', 'ground']; }
    }
    n = Math.min(n, tier.ground - this.count()); if (n <= 0) return 0;
    const lead = SPECIES[who[0]], keep = lead.flush + 3.5;
    // ---- where: a first spot ahead of the camera, then the rest of the party round it
    const o = this._o, grp = ++this.grp; let cx = 0, cz = 0, found = false, kind0 = kinds[0];
    for (let k = 0; k < 6 && !found; k++) {
      const a = (rnd() - 0.5) * 2.3, d = 7.5 + rnd() * 13, ca = Math.cos(a), sa = Math.sin(a), tx = px + (fx * ca - fz * sa) * d, tz = pz + (fz * ca + fx * sa) * d;
      for (const kd of kinds) { if (this._find(kd, tx, tz, kd === 'ground' ? 3 : kd === 'water' ? 14 : 12, o, px, pz) && Math.hypot(o.x - px, o.z - pz) > keep && !this._taken(o.x, o.z, 0.5) && !this._busy(o.x, o.z)) { found = true; kind0 = o.kind; cx = o.x; cz = o.z; break; } }
    }
    if (!found) return 0;
    const ea = rnd() * 6.2832; let made = 0;
    for (let i = 0; i < n; i++) {
      const b = this.list.find((q) => !q.st); if (!b) break;
      if (i > 0) {
        // (the others: mostly the same sort of place close by; a pigeon or two on something higher)
        let ok = false; const alt = i > 2 && rnd() < 0.3 && kinds.length > 1 ? kinds[1 + Math.floor(rnd() * (kinds.length - 1))] : kind0 === 'hedge' ? 'hedge' : kind0;
        for (let k = 0; k < 4 && !ok; k++) ok = this._find(k < 2 ? alt : kind0 === 'water' ? 'water' : 'ground', cx, cz, alt === 'ground' || alt === 'water' ? 2.2 + i * 0.5 : 7, o, px, pz) && Math.hypot(o.x - px, o.z - pz) > keep && !this._taken(o.x, o.z, SPECIES[who[i % who.length]].len * 1.5 + 0.15);
        if (!ok) continue;
      }
      const sp = who[i % who.length], s = SPECIES[sp];
      b.sp = sp; b.kind = o.kind; b.afloat = o.kind === 'water'; b.skip = o.kind === 'roof' ? o.ref : null;
      b.sy = o.y; const cy = b.afloat ? o.y + 0.03 * s.len : o.y + standH(s);
      // a way in that clears the roofs: the party's own direction first
      let ok = false;
      for (const da of FAN_IN) { const a = ea + da + (rnd() - 0.5) * 0.3; if (this._pathIn(b, o.x, cy, o.z, Math.cos(a), Math.sin(a), 30 + rnd() * 12)) { ok = true; break; } }
      if (!ok) continue;
      b.st = ST.in; b.grp = grp; b.t = 0; b.delay = i * (0.25 + rnd() * 0.5); b.dur = Math.max(2.4, this._len(b.P) / (s.v * 0.62));
      b.x = b.P[0]; b.y = b.P[1]; b.z = b.P[2]; b.h = o.h; b.hx = o.x; b.hz = o.z; b.th = o.h;
      b.ph = rnd() * 6.2832; b.fold = 0; b.peck = 0; b.k = 0; b.act = 0; b.actT = 0.5 + rnd(); b.leave = 45 + rnd() * 60;
      made++;
    }
    if (made) this.spawned++;
    return made;
  }
  _find(kind, x, z, R, o, px, pz) {
    const P = this.sys.spots, rnd = Math.random;
    switch (kind) {
      case 'water': return P.findWater(x, z, R, rnd, o);
      case 'wall': return P.findWall(x, z, R, rnd, o, false, px, pz);
      case 'hedge': return P.findWall(x, z, R, rnd, o, true, px, pz);
      case 'bench': return P.findBench(x, z, R, rnd, o);
      case 'roof': return P.findRoof(x, z, Math.max(R, 16), rnd, o);
      default: return P.findGround(x, z, R, rnd, o);
    }
  }
  /** a walker or another player standing about within a few metres of (x, z)? (a party would only go straight up again) */
  _busy(x, z) {
    const g = this.sys.game, PD = g.pedestrians && g.pedestrians.list, N = g.net && g.net.others;
    if (PD) for (let i = 0; i < PD.length; i++) { const q = PD[i]; if (q.active !== false && q.place === 'world' && Math.abs(q.x - x) < 4.5 && Math.abs(q.z - z) < 4.5) return true; }
    if (N && N.size) for (const o of N.values()) if (o.place === 'world' && Math.abs(o.x - x) < 6 && Math.abs(o.z - z) < 6) return true;
    return false;
  }
  _taken(x, z, r) { for (const b of this.list) if (b.st && Math.hypot(b.hx - x, b.hz - z) < r) return true; return false; }

  _near(b, s, x, y, z, speed, extra) {
    const r = s.flush + extra + Math.min(4, Math.abs(speed || 0) * 0.3), dx = b.x - x, dz = b.z - z, dy = b.y - y;
    if (dx * dx + dz * dz + dy * dy * 0.6 < r * r) { this._tx = x; this._tz = z; return true; }
    return false;
  }
  /** is anything that moves within the bird's distance (+ a bit for its speed)? you, every frame; other players, walkers, traffic and
   *  moving vehicles when `full` (five times a second) -> where it is in this._tx / _tz */
  _threat(b, full) {
    const g = this.sys.game, p = g.player, s = SPECIES[b.sp];
    if (p.place === 'world' && this._near(b, s, p.pos.x, p.pos.y + 0.6, p.pos.z, p.speed, p.vehicle ? 1.2 : 0)) return true;
    if (!full) return false;
    const N = g.net && g.net.others;
    if (N && N.size) for (const o of N.values()) if (o.place === 'world' && this._near(b, s, o.x, (o.y || 0) + 0.6, o.z, o.speed, 0)) return true;
    const PD = g.pedestrians && g.pedestrians.list;
    if (PD) for (let i = 0; i < PD.length; i++) { const q = PD[i]; if (q.active !== false && q.place === 'world' && Math.abs(q.x - b.x) < 8 && this._near(b, s, q.x, b.y, q.z, q.speed || 1.2, -0.5)) return true; }
    const T = g.traffic && g.traffic.list;
    if (T) for (let i = 0; i < T.length; i++) { const q = T[i]; if (Math.abs(q.x - b.x) < 14 && this._near(b, s, q.x, b.y, q.z, q.speed, 1.2)) return true; }
    const V = g.vehicles && g.vehicles.list;
    if (V) for (let i = 0; i < V.length; i++) { const q = V[i]; if (q.x !== undefined && Math.abs(q.x - b.x) < 14 && Math.abs(q.speed || 0) > 0.5 && this._near(b, s, q.x, b.y, q.z, q.speed, 1.2)) return true; }
    return false;
  }

  update(dt, te, act) {
    const S = this.sys, g = S.game, p = g.player, L = S.layer, P = S.spots, rnd = Math.random, q = this._q, d = this._d;
    // ---- a new party now and then
    const GL = g.gliding, flying = GL && GL.active;
    if (act > 0.04 && !flying && Math.abs(p.speed || 0) < 7) {
      this.wait -= dt * Math.max(0.2, act);
      if (this.wait <= 0) {
        if (this.groups() < S.tier.groups && this.count() < S.tier.ground - 1) { const m = this.spawn(); this.wait = m ? 16 + rnd() * 26 : 2.5 + rnd() * 2; } else this.wait = 5;
      }
    }
    const full = (this.scanT -= dt) <= 0; if (full) this.scanT = 0.2;
    let landed = 0, fly = 0;
    for (const b of this.list) {
      if (!b.st) continue;
      const s = SPECIES[b.sp];
      if (b.st === ST.in) {
        if (b.delay > 0) { b.delay -= dt; continue; }
        b.t += dt; const tau = Math.min(1, b.t / b.dur), u = tau * (1.7 - 0.7 * tau);
        this._bez(b.P, u, q); this._tan(b.P, Math.min(u, 0.985), d);
        b.x = q[0]; b.y = q[1]; b.z = q[2];
        const hd = Math.hypot(d[0], d[2]), flare = sstep(0.72, 1, tau);
        b.h = Math.atan2(d[0], d[2]);
        const f = flap(s, te, b.ph, tau > 0.6 ? FLAP.burst : FLAP.cruise);
        L.put(b.sp, b.x, b.y, b.z, b.h, clamp(Math.atan2(d[1], hd), -0.9, 0.5) * (1 - flare) + flare * 0.55, 0, s.len * sstep(0, 0.18, tau), f.a + flare * 0.25, f.b + flare * 0.3, flare > 0.9 ? (flare - 0.9) * 5 : 0, 0, 2);
        fly++;
        if (tau >= 1) {
          // (something came to stand there meanwhile: don't settle, go round)
          b.st = ST.land; b.t = 0; b.fold = 0.5; b.x = b.hx; b.z = b.hz; b.y = b.P[10];
          if (this._threat(b, true)) this._flush(b, this._tx, this._tz);
        }
        continue;
      }
      if (b.st === ST.out) {
        if (b.delay > 0) { b.delay -= dt; this._stand(b, s, L, te); landed++; continue; }
        b.t += dt; const tau = Math.min(1, b.t / b.dur), u = Math.pow(tau, 1.35);
        this._bez(b.P, u, q); this._tan(b.P, Math.max(0.02, u), d);
        b.x = q[0]; b.y = q[1]; b.z = q[2]; b.h = Math.atan2(d[0], d[2]);
        const hd = Math.hypot(d[0], d[2]), f = flap(s, te, b.ph, tau < 0.5 ? FLAP.burst : FLAP.cruise);
        L.put(b.sp, b.x, b.y, b.z, b.h, clamp(Math.atan2(d[1], hd), -0.3, 1.1), 0, s.len * (1 - sstep(0.72, 1, tau)), f.a, f.b, Math.max(0, 1 - b.t * 7), 0, 2);
        fly++;
        if (tau >= 1) b.st = 0;
        continue;
      }
      // ---- on the ground / a perch / the water
      b.t += dt; b.fold = Math.min(1, b.fold + dt * 4);
      const fp = footOf(p), dx = b.x - fp.x, dz = b.z - fp.z;
      if (dx * dx + dz * dz > 95 * 95) { b.st = 0; continue; }
      if (this._threat(b, full)) {
        // the whole party goes, a beat apart
        const tx = this._tx, tz = this._tz;
        for (const c of this.list) if (c !== b && c.st === ST.land && c.grp === b.grp && Math.hypot(c.x - b.x, c.z - b.z) < 7) { this._flush(c, tx, tz); if (c.st === ST.out) c.delay = 0.06 + rnd() * 0.45; }
        this._flush(b, tx, tz);
        if (b.st === ST.out) { this._stand(b, s, L, te); landed++; }
        continue;
      }
      if (b.t > b.leave || act < 0.03) { const a = rnd() * 6.2832; this._flush(b, b.x + Math.cos(a), b.z + Math.sin(a)); if (b.st === ST.out) { this._stand(b, s, L, te); landed++; } continue; }
      // what it is doing
      if ((b.actT -= dt) <= 0) {
        const r = rnd();
        if (b.afloat) { b.act = 1; b.actT = 2 + rnd() * 4; b.th = b.h + (rnd() - 0.5) * 1.6; }
        else if (b.kind !== 'ground') { b.act = r < 0.5 ? 3 : 0; b.actT = 0.8 + rnd() * 2.5; if (b.act === 3) b.th = b.h + (rnd() - 0.5) * 1.8; }
        else if (r < 0.45) {
          // a few steps to somewhere close, if the way is open
          const a = rnd() * 6.2832, dd = 0.4 + rnd() * 1.3, tx = b.hx + Math.cos(a) * dd, tz = b.hz + Math.sin(a) * dd;
          if (isNum(P.ground(tx, tz, true)) && isNum(P.ground((tx + b.x) / 2, (tz + b.z) / 2, true)) && !this._clash(b, tx, tz)) { b.act = 1; b.tx = tx; b.tz = tz; b.actT = 6; b.th = Math.atan2(tx - b.x, tz - b.z); }
          else { b.act = 0; b.actT = 0.4; }
        } else if (r < 0.8) { b.act = 2; b.actT = 0.7 + rnd() * 1.8; }
        else { b.act = 3; b.actT = 0.6 + rnd() * 1.5; b.th = b.h + (rnd() - 0.5) * 2.2; }
      }
      b.peck = 0;
      const dh = wrap(b.th - b.h); b.h += clamp(dh, -dt * 5, dt * 5);
      if (b.afloat) {
        const v = 0.22, nx = b.x + Math.sin(b.h) * v * dt, nz = b.z + Math.cos(b.h) * v * dt;
        if (P.water(b.x + Math.sin(b.h) * 1.2, b.z + Math.cos(b.h) * 1.2)) { b.x = nx; b.z = nz; } else b.th = b.h + 1.2;
      } else if (b.act === 1) {
        const ddx = b.tx - b.x, ddz = b.tz - b.z, dl = Math.hypot(ddx, ddz), hop = s.gait === 'hop', v = (hop ? 0.55 : s.gait === 'waddle' ? 0.28 : 0.34) * (hop ? Math.max(0, Math.sin(te * 9 + b.ph)) * 1.6 : 1);
        if (dl < 0.06 || Math.abs(dh) > 2) { if (dl < 0.06) { b.act = 0; b.actT = 0.2 + rnd() * 0.8; } }
        else if (v > 0 && !P.col.isFree(b.x + ddx / dl * 0.12, b.z + ddz / dl * 0.12, 0.26)) { b.act = 0; b.actT = 0.3; }      // (something in the way after all: stay)
        else { const st = Math.min(dl, v * dt); b.x += ddx / dl * st; b.z += ddz / dl * st; b.sy = g.world && g.world.groundHeight ? g.world.groundHeight(b.x, b.z) : b.sy; }
      } else if (b.act === 2) b.peck = Math.max(0, Math.sin(te * 13 + b.ph)) * 0.9;
      this._stand(b, s, L, te); landed++;
    }
    this.landed = landed; this.flying = fly;
  }
  _clash(b, x, z) { for (const c of this.list) if (c !== b && c.st === ST.land && Math.hypot(c.x - x, c.z - z) < 0.3 + SPECIES[c.sp].len) return true; return false; }
  /** draw bird b where it stands (or floats) */
  _stand(b, s, L, te) {
    if (b.afloat) { b.y = b.sy + 0.03 * s.len + Math.sin(te * 1.7 + b.ph) * 0.006; L.put(b.sp, b.x, b.y, b.z, b.h, 0.03, 0, s.len, 0, 0, b.fold >= 1 ? 2 : b.fold, 0, 1); return; }
    const hop = s.gait === 'hop' && b.act === 1 ? Math.max(0, Math.sin(te * 9 + b.ph)) * 0.035 : 0, bob = s.gait === 'walk' && b.act === 1 ? Math.sin(te * 11 + b.ph) * 0.05 : 0;
    b.y = b.sy + standH(s) + hop;
    L.put(b.sp, b.x, b.y, b.z, b.h, (s.gait === 'hop' ? 0.3 : s.gait === 'waddle' ? 0.12 : 0.16) + bob - b.peck * 0.35, 0, s.len, 0, 0, b.fold, b.peck, 1);
  }
}

// ================================================================================================ the system
class Birds {
  constructor(game) {
    this.game = game;
    const ov = game.overrides || {}, LM = (game.world && game.world.landmarks) || {};
    const heightOf = (b) => (ov.heights && ov.heights.get(b.id)) ?? (LM[b.id] && LM[b.id].h) ?? b.h ?? 8;
    const t0 = performance.now();
    this.sky = new Sky(game.map, { heightOf, boxes: game.map.boxes });
    this.spots = new Spots(game, heightOf);
    this.layer = new BirdLayer(game.worldScene, MAX_BIRDS);
    this.land = new Landers(this);
    this.buildMs = performance.now() - t0;
    this.tier = BIRD_TIERS.low; this.cpu = 0; this.cpuN = 0; this.cpuSum = 0; this.skyN = 0; this.aloft = 0;
    this.env = { now: { day: 1, dusk: 1, dawndusk: 1, soar: 1, fine: 1 } };
    this.haz = new Float32Array(12); this.hazN = 0;
    this._p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 1, k: 0, h: 0 }; this._b = { x: 0, y: 0, z: 0, r: 0 }; this._wx = { rain: 0, fog: 0, tempC: 15, cloud: 0 };
    // loading screen: the late placement data, and the bird's program drawn once out of sight
    (game.warmups || (game.warmups = [])).push({ id: 'birds', fn: () => {
      try { this.spots.build(); } catch (e) { console.error('[birds] spots', e); }
      const PW = game.prewarm;
      if (PW && PW.extras && !this._warm) {
        const w = (this._warm = new THREE.InstancedMesh(this.layer.geo, this.layer.mat, 1)); w.name = 'birds:warm'; w.frustumCulled = false; w.setMatrixAt(0, new THREE.Matrix4());
        PW.extras.push({ o: w, pre: (x, y, z) => { w.position.set(x, y - 3, z); w.updateMatrixWorld(true); return null; } });
      }
      return null;
    } });
  }
  grid() { const A = this.game.ambience; return (A && A.grid) || this._grid || (this._grid = buildGrid(this.game.map)); }
  /** how many of each kind of flock are out now: the hour and the weather (shared by every player unless a state is forced here) */
  _now(t) {
    const W = this.game.weather, o = this._wx, h = this.game.time ? this.game.time.hour : 12;
    if (W) { o.rain = W.rain || 0; o.fog = W.fog || 0; o.tempC = W.tempC; o.cloud = W.cloud || 0; }
    for (const k of PARTS) this.env.now[k] = activity(k, h, W ? o : FINE);
  }
  /** gliders in the air (ours and other players'), and anyone under a parachute: birds keep clear of them */
  _hazards() {
    const g = this.game, GL = g.gliding, H = this.haz; let n = 0;
    if (GL) {
      const G = GL.gliders;
      if (G) for (let i = 0; i < G.length && n < 3; i++) { const v = G[i] && G[i].vis && G[i].vis.group; if (v && v.parent && v.position.y > 6) { H[n * 3] = v.position.x; H[n * 3 + 1] = v.position.y; H[n * 3 + 2] = v.position.z; n++; } }
      if (GL.active && GL.airborne && n < 4) { const p = g.player.pos; H[n * 3] = p.x; H[n * 3 + 1] = p.y; H[n * 3 + 2] = p.z; n++; }
    }
    this.hazN = n;
  }

  update(dt) {
    const g = this.game, p = g.player, L = this.layer;
    // (in a walk-in room — core/interiors.js — the world is still seen through its windows: the birds carry on)
    const walkIn = !!(g.interiors && g.interiors.current && g.interiors.current.sl && p.place === g.interiors.current.id);
    if (!walkIn && (p.place !== 'world' || g.scene !== g.worldScene)) { if (L.mesh.visible || this.land.landed || this.land.flying) { L.hide(); this.land.clear(); } this.skyN = 0; return; }
    const t0 = performance.now();
    const q = g.quality, tier = (this.tier = BIRD_TIERS[(q && q.level) || 'low'] || BIRD_TIERS.low), dq = q && q.dist > 0 && q.dist < 1 ? Math.max(0.6, q.dist) : 1;
    const t = (g.time && g.time.now ? g.time.now() : Date.now()) / 1000, te = t - EPOCH;
    this._now(t);
    this._hazards();
    L.begin();
    this._sky(t, te, tier, dq);
    this.skyN = L.c;
    try { this.land.update(dt, te, this.env.now.day); } catch (e) { if (!this._err) { this._err = true; console.error('[birds] landing', e); } this.land.clear(); }
    L.end();
    const ms = performance.now() - t0; this.cpu += (ms - this.cpu) * 0.05; this.cpuSum += ms; this.cpuN++;
  }

  _sky(t, te, tier, dq) {
    const g = this.game, L = this.layer, S = this.sky, cam = g.camera, eye = g.eye || cam.position, cx = eye.x, cy = eye.y, cz = eye.z;
    const R = tier.R * dq * (1 + 0.6 * clamp((cy - 30) / 220, 0, 1)), R2 = R * R;
    cam.getWorldDirection(_fw); const fx = _fw.x, fy = _fw.y, fz = _fw.z;
    const P = this._p, B = this._b, H = this.haz, hn = this.hazN, env = this.env, F = S.flocks;
    // (from the air the floor is higher still: against roofs and fields a bird has to be a dozen pixels to be seen at all)
    const air = clamp((cy - 30) / 120, 0, 1), PX = (FLOOR_GROUND + (FLOOR_AIR - FLOOR_GROUND) * air) / 623;      // (623 px a metre at 1 m: a 720-line picture, 60 degrees)
    let n = 0, aloft = 0;
    for (let k = 0; k < F.length; k++) {
      const f = F[k];
      if (f.ord > tier.share || !S.trip(f, t, env) || !S.bound(f, t, B)) continue;
      aloft++;
      const bx = B.x - cx, bz = B.z - cz, br = R + B.r;
      if (bx * bx + bz * bz > br * br) continue;
      const nm = Math.max(1, Math.ceil(f.n * tier.members)), soar = f.kind === KIND.soar;
      for (let i = 0; i < nm; i++) {
        if (n >= tier.sky) break;
        if (!S.eval(f, i, t, P)) continue;
        let x = P.x, y = P.y, z = P.z; const kk = P.k, hr = P.h;
        const dx = x - cx, dy = y - cy, dz = z - cz, d2 = dx * dx + dz * dz;
        if (d2 > R2 || dx * fx + dy * fy + dz * fz < -12) continue;
        const hd = Math.sqrt(P.vx * P.vx + P.vz * P.vz), h = Math.atan2(P.vx, P.vz);
        const sp = SPECIES[f.sp[i]], ph = f.mo[i * 4 + 3];
        const roll = clamp(-hd * hr * 0.1, -0.95, 0.95) + 0.06 * Math.sin(te * 1.3 + ph);
        // a glider near: out of its way
        for (let j = 0; j < hn; j++) {
          const ax = x - H[j * 3], ay = y - H[j * 3 + 1], az = z - H[j * 3 + 2], d = Math.hypot(ax, ay, az);
          if (d < AVOID) { const u = 1 - d / AVOID, push = u * u * PUSH; if (d > 0.5) { x += ax / d * push; y += ay / d * push; z += az / d * push; } else y += push; }
        }
        if (hn) {
          // (not down into the roofs: where that leaves it still near, it goes round instead)
          const low = S.relief.at(x, z) + 3; if (y < low) y = low;
          for (let j = 0; j < hn; j++) {
            const ax = x - H[j * 3], az = z - H[j * 3 + 2];
            if (Math.hypot(ax, y - H[j * 3 + 1], az) < 38) { const al = Math.hypot(ax, az); if (al > 0.5) { x = H[j * 3] + ax / al * 41; z = H[j * 3 + 2] + az / al * 41; } else { x = H[j * 3] + Math.cos(h) * 41; z = H[j * 3 + 2] - Math.sin(h) * 41; } }
          }
        }
        // far ones a little larger than life (a flapping speck, not a shimmer), fading out by size at the edge of the range
        // far ones larger than life: never less than PX of wing span on the screen (a flapping bird, not a shimmer)
        const ex = cx - x, ey = cy - y, ez = cz - z, dist = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
        const need = PX * dist / (2 * sp.hs), boost = need > 1 ? (need > 40 ? 40 : need) : 1, size = sp.len * boost * kk * (1 - sstep(0.88, 1, Math.sqrt(d2) / R));
        if (size < 0.01) continue;
        const fl = flap(sp, te, ph, soar ? FLAP.soar : FLAP.cruise);
        // its axes: forward along its flight, banked by its turn...
        const vl = Math.sqrt(hd * hd + P.vy * P.vy) || 1, cp = hd / vl, spi = clamp(P.vy / vl, -0.55, 0.55), fhx = hd > 0.01 ? P.vx / hd : 0, fhz = hd > 0.01 ? P.vz / hd : 1;
        const fx2 = fhx * cp, fy2 = spi, fz2 = fhz * cp, l0x = fhz, l0z = -fhx;                       // forward; level left = up x forward
        const u0x = -fy2 * fhx, u0y = cp, u0z = -fy2 * fhz;   // up0 = forward x left (for a level left)
        const cr = Math.cos(roll), sr = Math.sin(roll);
        let ux = -l0x * sr + u0x * cr, uy = u0y * cr, uz = -l0z * sr + u0z * cr;
        // ...and, far off, tipped towards the eye: seen level a bird is an edge-on hairline, so beyond 40 m its wings are
        // turned (up to 80 % by 140 m) to show their plan — the shape that reads as a bird
        const w = FACE * sstep(40, 140, dist);
        let dark = 0;
        if (w > 0) {
          const cxn = ex / dist, cyn = ey / dist, czn = ez / dist, cf = cxn * fx2 + cyn * fy2 + czn * fz2;
          let tx = cxn - cf * fx2, ty = cyn - cf * fy2, tz = czn - cf * fz2; const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
          if (tl > 0.15) {
            tx /= tl; ty /= tl; tz /= tl;
            if (tx * ux + ty * uy + tz * uz < 0) { tx = -tx; ty = -ty; tz = -tz; }       // (its belly when you are under it, its back when over)
            ux += (tx - ux) * w; uy += (ty - uy) * w; uz += (tz - uz) * w;
          }
          dark = w * sstep(0.02, 0.3, -cyn) * 1.1;                                       // (against the sky from below: a dark shape)
        }
        // left = up x forward, up again = forward x left (orthonormal)
        let lx = uy * fz2 - uz * fy2, ly = uz * fx2 - ux * fz2, lz = ux * fy2 - uy * fx2; const ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1; lx /= ll; ly /= ll; lz /= ll;
        ux = fy2 * lz - fz2 * ly; uy = fz2 * lx - fx2 * lz; uz = fx2 * ly - fy2 * lx;
        L.putAxes(f.sp[i], x, y, z, lx, ly, lz, ux, uy, uz, fx2, fy2, fz2, size, fl.a, fl.b, dark > 1 ? 1 : dark, 0);
        n++;
      }
    }
    this.aloft = aloft;
  }

  stats() {
    const L = this.layer, T = this.tier;
    return { on: true, drawn: L.mesh.visible ? L.c : 0, sky: this.skyN, landed: this.land.landed, landing: this.land.flying, flocks: this.sky.flocks.length, aloft: this.aloft, parties: this.land.spawned, flushed: this.land.flushed,
      draws: L.mesh.visible ? 1 : 0, triangles: (L.mesh.visible ? L.c : 0) * L.triangles, maxSky: T.sky, maxGround: T.ground, cpuUs: +(this.cpu * 1000).toFixed(1), buildMs: +this.buildMs.toFixed(1), spotsReady: this.spots.ready };
  }
}

/** where the player is in the world (in a walk-in room: its true world position) */
const footOf = (p) => (p.place === 'world' || !p.worldPos ? p.pos : p.worldPos);
export default {
  id: 'birds',
  install(game) {
    if (!BIRDS_ON) { game.birds = { stats: () => ({ on: false, drawn: 0, sky: 0, landed: 0, landing: 0, flocks: 0, draws: 0 }) }; return null; }
    const B = new Birds(game);
    game.birds = {
      sys: B, sky: B.sky, spots: B.spots, layer: B.layer, species: SPECIES, tiers: BIRD_TIERS,
      stats: () => B.stats(),
      debug: {
        /** a party flies in now: {species: 'pigeon', kind: 'ground'|'water'|'wall'|'hedge'|'bench'|'roof', n} -> how many */
        spawn: (opts) => { let m = 0; for (let k = 0; k < 12 && !m; k++) m = B.land.spawn(opts || {}); return m; },
        /** every landing bird is down on its spot at once (screenshots, tests) */
        settle: () => { let n = 0; for (const b of B.land.list) if (b.st === ST.in) { b.delay = 0; b.t = b.dur; n++; } return n; },
        flush: () => { let n = 0; for (const b of B.land.list) if (b.st === ST.land) { B.land._flush(b, game.player.pos.x, game.player.pos.z); n++; } return n; },
        clear: () => B.land.clear(),
        get list() { return B.land.list; },
      },
    };
    return { id: 'birds', update: (dt) => B.update(dt) };
  },
};
