// Children and animals cannot be hit (2026-11-21). Nothing in the game may knock a child or an animal over, run into
// one, or stand on one — not the traffic, not a parked car shunted along, not the player's own car or bike driven
// straight at them on purpose. Three layers, each sufficient for the cases it sees, the last one absolute:
//   1. they get out of the way: anything on wheels whose path will sweep over them in the next second or so makes them
//      step smartly aside (to whichever side has free ground), before it arrives        — Protect.update, every frame
//   2. the vehicle is held back: speedCap(v) is the fastest a vehicle may go towards a protected body ahead of it and
//      still stop short (firm braking, as if the driver had seen them); systems/vehicles.js applies it to whatever the
//      player drives, systems/traffic.js stops its own for anyone in the road anyway and never moves a body into one
//      (blocks())                                                                        — before the vehicle moves
//   3. the last word: after everything has moved, a protected body that is nevertheless inside a vehicle's outline is
//      put outside it, on free dry ground (resolve()); if there is none, the vehicle is the one that is moved back.
// pedestrians.knock() refuses them, so there is no fall to play even if something called it.
// No three.js here: positions and footprints only (tools/smoke_children.mjs runs it without a world).
import { TYPES } from './_vehiclemeshes.js';

const BRAKE = 11;          // m/s^2 the cap assumes (a hard stop with the wheels still turning)
const MARGIN = 0.75;       // m: a vehicle is brought to rest this far short of them
const SKIN = 0.06;         // m: clear of the bodywork after resolve()

export class Protect {
  /** peds: the Pedestrians system (list, animals, wet(), game) */
  constructor(game, peds) {
    this.game = game; this.peds = peds;
    this.list = [];            // this frame's protected bodies: { o, kx, kz, r, child }
    this.veh = [];             // this frame's vehicle footprints: { x, z, fx, fz, hl, hw, vx, vz, ref, ai }
    this.stats = { aside: 0, pushed: 0, vehicleMoved: 0, capped: 0 };
    this._n = 0; this._nv = 0;
  }
  _body() { const L = this.list; if (this._n >= L.length) L.push({ o: null, kx: 'x', kz: 'z', r: 0.25, child: false }); return L[this._n++]; }
  _car() { const V = this.veh; if (this._nv >= V.length) V.push({ x: 0, z: 0, fx: 0, fz: 1, hl: 2, hw: 0.9, vx: 0, vz: 0, ref: null, ai: false }); return V[this._nv++]; }
  /** who is protected this frame: every child in the world and every animal registered with pedestrians.animals */
  gather() {
    const P = this.peds, L = P.list; this._n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; if (!p.active || p.place !== 'world') continue;
      // every child; and the adult who has children with them (hand in hand, at their side, in the pushchair), and the
      // pushchair itself: a car that cannot touch the child cannot bowl over the parent holding its hand either
      if (p.child || (P._hasKids && P._hasKids(p))) { const b = this._body(); b.o = p; b.kx = 'x'; b.kz = 'z'; b.r = p.child ? 0.24 : 0.3; b.child = true; }
      if (p.kit) { const b = this._body(); b.o = p.kit.position; b.kx = 'x'; b.kz = 'z'; b.r = 0.42; b.child = false; }
    }
    const A = P.animals;
    for (let i = 0; i < A.length; i++) { const a = A[i], b = this._body(); b.o = a.o; b.kx = a.kx; b.kz = a.kz; b.r = a.r; b.child = false; }
    return this._n;
  }
  /** every vehicle near a protected body: the traffic, the live vehicles (driven, abandoned, shunted), other players' */
  gatherVehicles() {
    const g = this.game; this._nv = 0;
    if (!this._n) return 0;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < this._n; i++) { const b = this.list[i], x = b.o[b.kx], z = b.o[b.kz]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    x0 -= 40; x1 += 40; z0 -= 40; z1 += 40;
    const tl = g.traffic && g.traffic.list;
    if (tl) for (let i = 0; i < tl.length; i++) {
      const a = tl[i]; if (!a.active || a.x < x0 || a.x > x1 || a.z < z0 || a.z > z1) continue;
      const T = TYPES[a.type]; if (!T) continue;
      const c = this._car(), fx = Math.sin(a.heading), fz = Math.cos(a.heading), sh = a.shove;
      c.x = a.x; c.z = a.z; c.fx = fx; c.fz = fz; c.hl = T.L / 2; c.hw = (a.type === 'bus' ? Math.max(T.W, 2.63) : a.type === 'taxi' ? Math.max(T.W, 1.9) : T.W) / 2;
      c.vx = sh ? sh.vx : fx * a.speed; c.vz = sh ? sh.vz : fz * a.speed; c.ref = a; c.ai = true;
    }
    const vl = g.vehicles && g.vehicles.list;
    if (vl) for (let i = 0; i < vl.length; i++) {
      const v = vl[i]; if (v.kind === 'punt' || v.x < x0 || v.x > x1 || v.z < z0 || v.z > z1) continue;
      const T = TYPES[v.type]; if (!T) continue;
      const c = this._car(), fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      c.x = v.x; c.z = v.z; c.fx = fx; c.fz = fz; c.hl = T.L / 2; c.hw = Math.max(T.W / 2, v.kind === 'bike' ? 0.3 : 0);
      if (v.kind === 'car' && Number.isFinite(v.vx)) { c.vx = v.vx; c.vz = v.vz; } else { c.vx = fx * (v.speed || 0); c.vz = fz * (v.speed || 0); }
      if (v.fallen && Number.isFinite(v.slideVx)) { c.vx = v.slideVx; c.vz = v.slideVz; }
      c.ref = v; c.ai = false;
    }
    return this._nv;
  }
  _free(x, z, r) {
    const P = this.peds, col = this.game.worldCollider;
    if (P.wet && P.wet(x, z)) return false;
    if (col && col.isWet && col.isWet(x, z)) return false;
    return !col || !col.isFree || col.isFree(x, z, r);
  }
  /** is (x, z, r) inside any vehicle's outline (other than `skip`)? */
  _inAny(x, z, r, skip) {
    for (let j = 0; j < this._nv; j++) { const c = this.veh[j]; if (c === skip) continue; const dx = x - c.x, dz = z - c.z, f = dx * c.fx + dz * c.fz, l = dx * c.fz - dz * c.fx; if (Math.abs(f) < c.hl + r && Math.abs(l) < c.hw + r) return true; }
    return false;
  }
  /** layers 1 and 3 for this frame (called by pedestrians.update once everyone has walked) */
  update(dt) {
    if (!this.gather()) { this._nv = 0; return; }
    this.gatherVehicles();
    if (!this._nv) return;
    for (let i = 0; i < this._n; i++) {
      const b = this.list[i], o = b.o; let x = o[b.kx], z = o[b.kz];
      for (let j = 0; j < this._nv; j++) {
        const c = this.veh[j], sp = Math.hypot(c.vx, c.vz);
        if (sp < 0.6) continue;
        // in the frame of its travel: ahead of its leading edge and inside the strip it will sweep
        const ux = c.vx / sp, uz = c.vz / sp, dx = x - c.x, dz = z - c.z, f = dx * ux + dz * uz, l = dx * uz - dz * ux;
        const al = Math.abs(ux * c.fx + uz * c.fz), lead = c.hl * al + c.hw * (1 - al), half = c.hw * al + c.hl * Math.sqrt(Math.max(0, 1 - al * al)) + b.r + 0.45;
        const ahead = f - lead - b.r;
        if (ahead < -lead * 1.6 || ahead > sp * 1.15 + 1.2 || Math.abs(l) > half) continue;
        // step aside, away from its line, to the side they are already on (or whichever is free), as fast as it takes
        const need = half - Math.abs(l) + 0.15, v = Math.min(6, Math.max(2.4, need / Math.max(0.12, ahead / sp))), st = Math.min(need, v * dt);
        let side = l >= 0 ? 1 : -1, moved = false;
        for (let k = 0; k < 2 && !moved; k++, side = -side) {
          const nx = x + uz * side * st, nz = z - ux * side * st;
          if (this._free(nx, nz, b.r) && !this._inAny(nx, nz, b.r, c)) { x = nx; z = nz; moved = true; if (b.child) { o.asideT = 0.5; o.asideH = Math.atan2(uz * side, -ux * side); } else if (o.onAside) o.onAside(uz * side, -ux * side); }
          if (k === 0 && Math.abs(l) > 0.25) break;      // (clearly on one side: do not cross in front of it to reach the other)
        }
        if (moved) this.stats.aside++;
      }
      o[b.kx] = x; o[b.kz] = z;
    }
    this.resolve(true);
  }
  /** layer 3: nobody protected is left inside a vehicle's outline. `fresh` false: gather the vehicles again first (they
   *  have moved since update(): systems/vehicles.js calls resolve() at the end of its own frame). */
  resolve(fresh) {
    if (!this._n) return 0;
    if (!fresh) this.gatherVehicles();
    let n = 0;
    for (let i = 0; i < this._n; i++) {
      const b = this.list[i], o = b.o; if (b.child ? !o.active : o.gone === true) continue;
      for (let pass = 0; pass < 2; pass++) {
        let hit = false; const x = o[b.kx], z = o[b.kz];
        for (let j = 0; j < this._nv && !hit; j++) {
          const c = this.veh[j], dx = x - c.x, dz = z - c.z, f = dx * c.fx + dz * c.fz, l = dx * c.fz - dz * c.fx, r = b.r + SKIN;
          const pf = c.hl + r - Math.abs(f), pl = c.hw + r - Math.abs(l);
          if (pf <= 0 || pl <= 0) continue;
          hit = true; n++;
          // out by the nearest side, then the other side, then either end: the first that is free, dry ground clear of
          // every other vehicle
          const sl = l >= 0 ? 1 : -1, sf = f >= 0 ? 1 : -1;
          const tries = pl <= pf ? [[0, sl * pl], [sf * pf, 0], [0, -sl * (2 * (c.hw + r) - pl)], [-sf * (2 * (c.hl + r) - pf), 0]] : [[sf * pf, 0], [0, sl * pl], [0, -sl * (2 * (c.hw + r) - pl)], [-sf * (2 * (c.hl + r) - pf), 0]];
          let done = false;
          for (let k = 0; k < tries.length && !done; k++) {
            const mf = tries[k][0], ml = tries[k][1], nx = x + c.fx * mf + c.fz * ml, nz = z + c.fz * mf - c.fx * ml;
            if (this._free(nx, nz, b.r * 0.8) && !this._inAny(nx, nz, b.r, c)) { o[b.kx] = nx; o[b.kz] = nz; done = true; this.stats.pushed++; }
          }
          if (!done) {
            // nowhere for them to go (a wall behind, water beside): the vehicle is put back off them instead, and stopped
            const v = c.ref, back = pf + 0.02;
            v.x -= c.fx * sf * back; v.z -= c.fz * sf * back; c.x = v.x; c.z = v.z;
            if (c.ai) { v.speed = 0; v.acc = 0; if (v.shove) { v.shove.vx = 0; v.shove.vz = 0; } } else { v.vx = 0; v.vz = 0; v.speed = 0; if (v.slideVx !== undefined) { v.slideVx = 0; v.slideVz = 0; } }
            this.stats.vehicleMoved++;
          }
        }
        if (!hit) break;
      }
    }
    return n;
  }
  /**
   * Layer 2: the fastest (m/s, along its present direction of travel) vehicle v — a systems/vehicles.js live vehicle —
   * may be going this frame and still stop MARGIN short of every protected body in its path. Infinity: nobody there.
   * (vx, vz): its velocity. Cheap: a handful of bodies, and only when one is within 45 m.
   */
  speedCap(v, vx, vz) {
    if (!this._n) return Infinity;
    const sp = Math.hypot(vx, vz); if (sp < 0.3) return Infinity;
    const T = TYPES[v.type]; if (!T) return Infinity;
    const ux = vx / sp, uz = vz / sp, fx = Math.sin(v.heading), fz = Math.cos(v.heading), al = Math.abs(ux * fx + uz * fz), hl = T.L / 2, hw = Math.max(T.W / 2, 0.3);
    const lead = hl * al + hw * (1 - al), half0 = hw * al + hl * Math.sqrt(Math.max(0, 1 - al * al));
    let cap = Infinity;
    for (let i = 0; i < this._n; i++) {
      const b = this.list[i], o = b.o, dx = o[b.kx] - v.x, dz = o[b.kz] - v.z;
      if (Math.abs(dx) > 45 || Math.abs(dz) > 45) continue;
      const f = dx * ux + dz * uz, l = dx * uz - dz * ux, gap = f - lead - b.r;
      if (gap < -(lead + b.r) || Math.abs(l) > half0 + b.r + 0.3 + Math.max(0, gap) * 0.06) continue;
      const c = gap <= MARGIN ? 0 : Math.sqrt(2 * BRAKE * (gap - MARGIN));
      if (c < cap) cap = c;
    }
    if (cap < sp) this.stats.capped++;
    return cap;
  }
  /** layer 2 for the traffic: would agent a's outline at its present pose be on a protected body? (mx, mz: the move just made; traffic.js cancels it) */
  blocks(a, mx, mz) {
    if (!this._n) return false;
    const T = TYPES[a.type]; if (!T) return false;
    const fx = Math.sin(a.heading), fz = Math.cos(a.heading), hl = T.L / 2 + 0.12, hw = (a.type === 'bus' ? 2.63 : T.W) / 2 + 0.12;
    for (let i = 0; i < this._n; i++) {
      const b = this.list[i], o = b.o, dx = o[b.kx] - a.x, dz = o[b.kz] - a.z;
      if (Math.abs(dx) > 9 || Math.abs(dz) > 9) continue;
      if (dx * mx + dz * mz > 0 && Math.abs(dx * fx + dz * fz) < hl + b.r && Math.abs(dx * fz - dz * fx) < hw + b.r) return true;      // (only a move TOWARDS them: one beside a standing car does not hold it there)
    }
    return false;
  }
  /** for tests: the deepest any protected body is inside any vehicle's outline right now (m; <= 0: clear) */
  worst() {
    this.gather(); this.gatherVehicles();
    let w = -Infinity;
    for (let i = 0; i < this._n; i++) { const b = this.list[i], x = b.o[b.kx], z = b.o[b.kz];
      for (let j = 0; j < this._nv; j++) { const c = this.veh[j], dx = x - c.x, dz = z - c.z, d = Math.min(c.hl + b.r - Math.abs(dx * c.fx + dz * c.fz), c.hw + b.r - Math.abs(dx * c.fz - dz * c.fx)); if (d > w) w = d; } }
    return w;
  }
}
