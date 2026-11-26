// The local player: on-foot movement, jumping, ground following. Vehicles take over when player.vehicle is set.
// On foot the body has momentum (2026-11 physics pass): a velocity that is steered towards what the keys ask for with
// limited acceleration (quick to start, a short slide when stopping from a sprint, wider turns at speed), walls take the
// velocity into them away (a sprint straight into one is a stumble), and knocks come from outside:
//   stumble(dir, strength)   a lurch back off something run into (dir = the way to be thrown: radians heading or {x, z};
//                            strength 0..1, >= 0.8 knocks you over). Called by the props system for bollards / bins too.
//   knockDown(vx, vz, opts)  bowled over (by a vehicle; opts.forward: thrown forwards, over the handlebars): a short
//                            tumble, slide to rest, back on your feet in ~1.9 s. Bloodless; there is no health.
// Feet stand on the drawn ground, on the top of anything the collider marks standable (low walls: Collider.topAt) and on
// vehicle bodies (game.vehicles.supportAt: bonnets, roofs, moving or not — you ride along on one that drives off).
import * as THREE from 'three';
import { createCharacter, randomLook } from './characters.js';
import { TUMBLE, STUMBLE_DUR } from './_tumble_pose.js';

const WALK = 2.6, RUN = 6.2, RADIUS = 0.32, GRAVITY = 20, JUMP = 6.2;
// momentum (m/s^2): speeding up, braking against the keys, turning (less at a sprint), stopping (sliding from a sprint)
const ACC = 15, BRAKE = 24, TURN = 30, TURN_RUN = 15, STOP = 20, STOP_RUN = 9.5, AIR = 3, DOWN_SLIDE = 7;
const STEP_UP = 0.62;            // highest floor you walk up onto (kerbs, steps); a bigger rise is a wall or needs a jump
const MANTLE = 0.3;              // airborne within this of a top you are moving onto: you scramble up
export const SPAWN = { x: -212, z: 9, heading: -Math.PI / 2 }; // Walton Street, outside Worcester College lodge
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const _sup = { o: null, top: -1, kind: '' };

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
    this.worldPos = this.pos.clone();     // last outdoor position (for the map while indoors)
    this.heading = SPAWN.heading;         // forward = (sin h, 0, cos h)
    this.speed = 0; this.vy = 0; this.onGround = true;
    this.vx = 0; this.vz = 0;             // on-foot velocity (m/s, world)
    this.place = 'world';
    this.frozen = 0;                      // >0: no movement input (dialogue, minigame). Use ++ / --
    this.vehicle = null;                  // set by the vehicles system while riding/driving
    this.pose = 'stand';                  // broadcast to other players
    this.name = 'Fresher';
    this.look = randomLook();
    this.character = createCharacter(this.look); this.character.noLod = true;
    this.radius = RADIUS;
    this.drunk = 0;                       // 0..1, wobbles movement + camera (set by bars)
    this.downT = 0;                       // > 0: knocked down, no control (seconds until back on your feet)
    this.stumbleT = 0; this._stumbleCd = 0;
    this.support = null;                  // the vehicle body being stood on (carried with it)
    this._supX = 0; this._supZ = 0; this._supH = 0;
    this._sq = 0; this._sqv = 0;          // landing squash (spring)
    this._spd = 0; this.sliding = false;
  }

  setLook(look) {
    const parent = this.character.group.parent;
    parent && parent.remove(this.character.group);
    this.character.dispose();
    this.look = look; this.character = createCharacter(look); this.character.noLod = true;
    parent && parent.add(this.character.group);
  }

  teleport(x, z, heading) {
    this.pos.set(x, this.game.groundHeight(x, z), z);
    if (heading !== undefined) { this.heading = heading; this.game.cameraYaw = heading; }
    this.vy = 0; this.speed = 0; this.vx = this.vz = 0; this.support = null; this.onGround = true;
    if (this.downT > 0 || this.stumbleT > 0) { this.downT = 0; this.stumbleT = 0; this.pose = 'stand'; }
    this.syncMesh();
  }

  syncMesh() {
    const g = this.character.group;
    g.position.copy(this.pos); g.rotation.y = this.heading;
    if (this.place === 'world') this.worldPos.copy(this.pos);
  }

  /** knocked down and not yet back on your feet */
  get down() { return this.downT > 0; }

  /** Lurch back off something run into. dir: heading (radians) or {x, z} to be thrown towards; strength 0..1. */
  stumble(dir, strength = 0.5) {
    if (this.vehicle || this.swim || this.downT > 0 || this.frozen) return false;       // (not during scripted moves)
    let dx, dz;
    if (typeof dir === 'number') { dx = Math.sin(dir); dz = Math.cos(dir); } else { dx = dir.x || 0; dz = dir.z || 0; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
    const s = clamp(strength, 0, 1);
    if (s >= 0.8) return this.knockDown(dx * (3 + 4 * s), dz * (3 + 4 * s));
    if (this.stumbleT > 0.15) return false;
    const k = 0.8 + 2.6 * s;
    this.vx = dx * k; this.vz = dz * k;
    this.stumbleT = 0.25 + 0.4 * s; this._stumbleCd = 0.9;
    this.pose = 'stumble';
    try { this.character.setPose('stand'); this.character.setPose('stumble'); } catch { /* */ }
    if (this.game.shake) this.game.shake(0.12 + 0.3 * s);
    return true;
  }

  /** Bowled over: (vx, vz) = the shove (m/s, world), e.g. the velocity of the car that hit you. opts.forward: thrown forwards.
   *  opts.hit: struck by a vehicle — (vx, vz) is already what the blow gave us (its mass allowed for, systems/_collide.js):
   *  thrown at 0.8 of it, up to 11 m/s, so a harder hit throws further (else, as before, never faster than 6 m/s). */
  knockDown(vx, vz, opts = {}) {
    if (this.vehicle || this.swim || (this.frozen && !opts.force)) return false;      // (not during scripted moves: taking a car…)
    if (this.downT > 0 && TUMBLE[this.pose] && TUMBLE[this.pose].up - this.downT < 0.5) return false;    // (already going over)
    const sp = Math.hypot(vx, vz), fwd = !!opts.forward;
    if (sp > 0.1) this.heading = fwd ? Math.atan2(vx, vz) : Math.atan2(-vx, -vz);
    const k = opts.hit ? Math.min(0.8, 11 / Math.max(sp, 1e-3)) : Math.min(0.75, 6 / Math.max(sp, 1e-3));
    this.vx = vx * k; this.vz = vz * k;
    this.vy = Math.min(4.2, 1.5 + sp * 0.22); this.onGround = false; this.support = null;
    this.pose = fwd ? 'knockedf' : 'knocked';
    this.downT = TUMBLE[this.pose].up; this.stumbleT = 0;
    try { this.character.setPose('stand'); this.character.setPose(this.pose); } catch { /* */ }
    if (this.game.shake) this.game.shake(Math.min(1, 0.35 + sp * 0.06));
    return true;
  }

  /** debug: fall over backwards as if clipped by a car at `speed` m/s */
  debugTumble(speed = 8, forward = false) { const h = this.heading + (forward ? 0 : Math.PI); return this.knockDown(Math.sin(h) * speed, Math.cos(h) * speed, { forward }); }

  update(dt) {
    const game = this.game, inp = game.input;
    this.character.setPose(this.pose);
    if ((this.vehicle || this.swim) && (this._sq || this.character.group.scale.y !== 1)) { this._sq = this._sqv = 0; this.character.group.scale.set(1, 1, 1); }
    if (this.vehicle) { this.vx = this.vz = 0; this.support = null; this.downT = 0; this.stumbleT = 0; this.syncMesh(); this.character.update(dt, Math.abs(this.vehicle.speed || 0)); return; }
    if (this.swim) { this.vx = this.vz = 0; this.support = null; this.downT = 0; this.swim(dt); this.character.setPose(this.pose); this.syncMesh(); this.character.update(dt, this.speed); return; }      // in the water: systems/swim.js moves us
    // hanging from a ledge / pulling up over it (core/_climb.js places the body; CL is null until a place has floors above the ground)
    const CL = game.climb || null;
    if (CL && CL.hang && CL.hold(this, dt, inp)) { this.character.setPose(this.pose); this.syncMesh(); this.character.update(dt, 0); return; }
    // somebody else set our speed (entering / leaving things, scripted moves): take it as the speed of the body
    if (this.speed !== this._spd) {
      const sp = Math.hypot(this.vx, this.vz);
      if (this.speed <= 0.01) this.vx = this.vz = 0;
      else if (sp > 1e-3) { this.vx *= this.speed / sp; this.vz *= this.speed / sp; }
    }
    // ride along on whatever we are standing on (a car that drives off, a bus roof)
    if (this.support) {
      const o = this.support, h = o.heading ?? o.h ?? 0, dh = h - this._supH;
      if (Math.abs(o.x - this._supX) + Math.abs(o.z - this._supZ) < 3 && Math.abs(dh) < 1) {
        const rx = this.pos.x - this._supX, rz = this.pos.z - this._supZ, c = Math.cos(dh), s = Math.sin(dh), px = this.pos.x, pz = this.pos.z;
        this.pos.x = o.x + rx * c + rz * s; this.pos.z = o.z - rx * s + rz * c; this.heading += dh;
        this.character.carried(px, pz, this.pos.x, this.pos.z, dh);        // (the planted feet ride along too: no walking on the spot on a moving roof)
      }
    }
    const frozen = this.frozen || (game.activity && !game.activity.walk);      // (activity.walk: one played on your feet — first-person pool)
    if (this.downT > 0) {
      this.downT -= dt;
      if (this.downT <= 0) { this.downT = 0; if (TUMBLE[this.pose]) this.pose = 'stand'; }
    }
    if (this.stumbleT > 0) { this.stumbleT -= dt; if (this.stumbleT <= 0 && this.pose === 'stumble') this.pose = 'stand'; }
    if (this._stumbleCd > 0) this._stumbleCd -= dt;
    // (the stumble pose's own timer ends it too, so it never sticks)
    if (this.pose === 'stumble' && this.character.pose !== 'stumble' && this.stumbleT <= 0) this.pose = 'stand';
    const control = !frozen && this.downT <= 0 && this.stumbleT <= 0;
    let mx = 0, my = 0;
    if (control) { mx = inp.moveX; my = inp.moveY; }
    const moving = mx !== 0 || my !== 0;
    let tvx = 0, tvz = 0, yaw = this.heading;
    if (moving) {
      // direction relative to camera: forward = camera look dir, right = +90deg clockwise seen from above
      yaw = game.cameraYaw + Math.atan2(-mx, my);
      if (this.drunk > 0) yaw += Math.sin(performance.now() / 600) * 0.5 * this.drunk;
      const ts = inp.run ? RUN : WALK;
      tvx = Math.sin(yaw) * ts; tvz = Math.cos(yaw) * ts;
    }
    // ---- momentum
    let vx = this.vx, vz = this.vz;
    const sp0 = Math.hypot(vx, vz);
    if (frozen && this.downT <= 0) { vx = vz = 0; }
    else if (this.onGround) {
      if (moving) {
        // steer the velocity towards the wanted one: along it (speed up / brake), across it (turn: harder at a sprint)
        const dvx = tvx - vx, dvz = tvz - vz;
        if (sp0 < 0.4) { const d = Math.hypot(dvx, dvz), m = ACC * dt; if (d > m) { vx += dvx / d * m; vz += dvz / d * m; } else { vx = tvx; vz = tvz; } }
        else {
          const ux = vx / sp0, uz = vz / sp0, al = dvx * ux + dvz * uz, px = dvx - al * ux, pz = dvz - al * uz, pl = Math.hypot(px, pz);
          const am = (al > 0 ? ACC : BRAKE) * dt, tm = (TURN + (TURN_RUN - TURN) * clamp((sp0 - WALK) / (RUN - WALK), 0, 1)) * dt;
          const a = clamp(al, -am, am); vx += ux * a; vz += uz * a;
          if (pl > 1e-5) { const t = Math.min(pl, tm); vx += px / pl * t; vz += pz / pl * t; }
        }
      } else if (sp0 > 1e-4) {
        // let go: a quick stop from a walk, a short slide from a sprint, a long one sprawled on the ground
        const dec = this.downT > 0 ? DOWN_SLIDE : this.stumbleT > 0 ? 7 : sp0 > WALK + 1 ? STOP_RUN : STOP;
        const n = Math.max(0, sp0 - dec * dt) / sp0; vx *= n; vz *= n;
      }
    } else if (moving && control) {
      // a little air control
      const dvx = tvx - vx, dvz = tvz - vz, d = Math.hypot(dvx, dvz), m = AIR * dt;
      if (d > m) { vx += dvx / d * m; vz += dvz / d * m; }
    }
    // ---- move (sub-stepped when flung), walls take away the velocity into them; people are bodies too (game.solid:
    // systems/_ped_solid.js — put outside them, the speed into them lost; other players only ease us out)
    const sp = Math.hypot(vx, vz);
    const SB = game.solid && game.solid.begin(this) ? game.solid : null;
    this.sliding = this.onGround && !moving && sp > WALK + 0.6 && this.downT <= 0;
    if (CL) CL.open(this);      // (walls whose tops the feet are above are not walls to this move)
    if (sp > 0.02) {
      const n = Math.max(1, Math.ceil(sp * dt / 0.22));
      const feet = this.pos.y - game.groundHeight(this.pos.x, this.pos.z);
      for (let i = 0; i < n; i++) {
        const nx = this.pos.x + vx * dt / n, nz = this.pos.z + vz * dt / n;
        const p = _P; p.x = nx; p.z = nz;
        _RO.y = !this.onGround ? Math.max(0, feet) + MANTLE : feet > 0.05 ? feet : undefined;      // (over low walls / onto bonnets)
        game.collider.resolve(p, RADIUS, _RO);
        if (this.onGround && !this.support && game.collider.isWet(p.x, p.z)) {
          // don't walk into water (a jump may carry you over it, or in: systems/swim.js): try sliding along each axis
          if (!game.collider.isWet(p.x, this.pos.z)) p.z = this.pos.z;
          else if (!game.collider.isWet(this.pos.x, p.z)) p.x = this.pos.x;
          else { p.x = this.pos.x; p.z = this.pos.z; }
        }
        const ox = p.x - nx, oz = p.z - nz, ol = Math.hypot(ox, oz);
        const body = SB !== null && SB.step(this, p, this.pos.x, this.pos.z, vx, vz, dt / n, _RO, tvx, tvz);
        this.pos.x = p.x; this.pos.z = p.z;
        if (body) { const bn = vx * SB.nx + vz * SB.nz; if (bn < 0) { vx -= bn * SB.nx; vz -= bn * SB.nz; } }
        if (ol > 1e-4) {
          const ux = ox / ol, uz = oz / ol, vn = vx * ux + vz * uz;
          if (vn < 0) {
            vx -= vn * ux; vz -= vn * uz;
            // sprinting square into a wall: bounce off it in a stumble (the kerb-height shapes are not walls here)
            if (-vn > 4.4 && control && this._stumbleCd <= 0 && game.collider === game.worldCollider) { this.vx = vx; this.vz = vz; this.stumble({ x: ux, z: uz }, clamp((-vn - 3.6) / 3.5, 0.3, 0.7)); vx = this.vx; vz = this.vz; }
          }
        }
      }
    }
    else if (SB !== null) {
      // standing still: another player stands in us (eased apart); the townspeople never move a standing player
      const p = _P; p.x = this.pos.x; p.z = this.pos.z; _RO.y = undefined;
      SB.step(this, p, p.x, p.z, 0, 0, dt, _RO, 0, 0, true);
      this.pos.x = p.x; this.pos.z = p.z;
    }
    if (CL) CL.close();
    this.vx = vx; this.vz = vz;
    this.speed = frozen && this.downT <= 0 ? Math.max(0, this.speed - 10 * dt) : Math.hypot(vx, vz); this._spd = this.speed;
    // ---- facing: the way we are going (slower to swing round at a sprint), or the keys when barely moving
    // (first-person view, G: the body faces the way you look, moving or not, so what you see looking down is your own front)
    const fpv = !!game.firstPerson;
    if (control && (moving || fpv)) {
      const want = fpv ? game.cameraYaw : this.speed > 0.8 && !this.sliding ? Math.atan2(vx, vz) : yaw;
      let d = want - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      const rate = 14 - 7 * clamp(this.speed / RUN, 0, 1);
      this.heading += d * Math.min(1, dt * rate);
    }
    // ---- vertical: the drawn ground, low wall tops, vehicle bodies
    let ground = game.groundHeight(this.pos.x, this.pos.z);
    const feetUp = this.pos.y - ground;
    let reach = this.onGround ? STEP_UP : this.vy < 2.5 ? MANTLE : 0.05;
    if (!this.onGround && this.vy > 0 && this.vy < 4) reach = MANTLE;
    const wt = game.collider.topAt ? game.collider.topAt(this.pos.x, this.pos.z, RADIUS * 0.8, feetUp, reach) : -1;
    if (wt > 0) ground += wt;
    if (CL) { const dk = CL.floorAt(this, reach); if (dk > ground) ground = dk; else CL.cur = null; }      // roofs, beams, wall heads (core/_climb.js)
    let sup = null;
    const V = game.vehicles;
    if (V && V.supportAt && this.place === 'world') {
      const top = V.supportAt(this.pos.x, this.pos.z, this.pos.y, reach, _sup);
      if (_sup.o && top > ground) { ground = top; sup = _sup.o; }      // (supportAt returns -1 for "no car": not a floor for ground below -1 m — the Cellar Bar's stairwell)
    }
    if (this.onGround && control && inp.hit('Space')) { if (this.pos.y < ground) this.pos.y = ground; this.vy = JUMP; this.onGround = false; this._sqv -= 2.2; }      // (from the floor itself: running up a slope the body trails a little under it, and the jump was lost)
    if (!this.onGround) {
      this.vy -= GRAVITY * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        // landing: squash by how hard (a drop off a bus roof lands in a stumble)
        const hit = -this.vy;
        this.pos.y = ground; this.vy = 0; this.onGround = true;
        this._sqv += clamp(hit * 0.35, 0, 4);
        if (hit > 11 && this.downT <= 0) this.stumble(this.heading + Math.PI, clamp((hit - 9) / 8, 0.3, 0.75));
      }
    } else if (ground < this.pos.y - 0.6) { this.onGround = false; this.vy = 0; }   // walked off a ledge (or a car roof)
    else this.pos.y += (ground - this.pos.y) * Math.min(1, dt * 18);    // steps / slopes
    // carried by the body we stand on
    if (sup && this.onGround && this.pos.y - ground < 0.08) {
      if (this.support !== sup) this.support = sup;
      this._supX = sup.x; this._supZ = sup.z; this._supH = sup.heading ?? sup.h ?? 0;
    } else this.support = null;
    if (CL) CL.post(this, dt);      // catching a ledge, the long drop, sliding (core/_climb.js)
    // ---- landing squash spring (scale of the figure: 1 - sq tall, 1 + sq/2 wide; a jump stretches it first)
    this._sqv += (-120 * this._sq - 14 * this._sqv) * dt; this._sq = clamp(this._sq + this._sqv * dt, -0.12, 0.22);
    if (Math.abs(this._sq) < 1e-4 && Math.abs(this._sqv) < 1e-3) { this._sq = 0; this._sqv = 0; }
    this.syncMesh();
    const g = this.character.group, q = this._sq;
    if (q !== 0 || g.scale.y !== 1) g.scale.set(1 + q * 0.5, 1 - q, 1 + q * 0.5);
    // a sprint stopped short: feet planted, leaning back into the slide
    g.rotation.x = this.sliding ? -0.12 * clamp((this.speed - WALK) / 3, 0, 1) : 0;
    this.character.skid = this.sliding || this.downT > 0 || this.stumbleT > 0;      // sliding on purpose: the feet go with the body instead of stepping
    this.character.update(dt, this.downT > 0 || this.stumbleT > 0 ? 0 : this.sliding ? this.speed * 0.25 : this.speed);
  }
}
const _P = { x: 0, z: 0 }, _RO = { y: undefined };
export { STUMBLE_DUR };
