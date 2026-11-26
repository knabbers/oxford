// People are solid to a player on foot (2026-11-22). Before this the player's movement tested walls only: the one thing
// between the player and a townsperson was a rule in pedestrians.js that put any walker within 0.7 m of the player
// straight out to 0.7 m (a crate, shoved; the player never slowed), skipped for other players' walkers, for the
// clock-driven wanderers and undone by controllers — and the far crowd (crowd.js) had no bodies at all.
//
// Now every person is a circle the player cannot enter (core/player.js calls begin() once a frame and step() for every
// sub-step of the move, after the walls):
//   the player   is put outside the circle and loses the speed into it (walks round, as round a bollard); the walls
//                have the last word, and squeezed between somebody and a wall the player stays put rather than shake.
//   a walker     who is pressed takes a step aside of their own, at a human pace (pressed(): to the side they are
//                already on, on free dry ground, never off the pavement into the road), and carries on; run into at a
//                sprint they stagger and the runner stumbles off them, as before. Someone standing at a post (a
//                shopkeeper, a porter) holds their ground for a moment first, and goes back when the player has gone.
//   a child      is never moved by a player: the player is stopped, the child stays (its own steps are all that
//                move it). A pushchair and a dog likewise. Seated people stay seated.
//   somebody whose place is not ours to change (another player's walker; anyone already down) is simply solid.
//   another player   a SOFT circle: each client eases its own player out of the other's drawn body at SOFT_V at most, so
//                two players cannot stand in each other, and one who blocks a doorway is pushed through slowly — nobody
//                can be shut in. Nothing is sent: each moves only its own player.
// Nobody walks into a player either (clearOf(): a walker's own step is cut short at the player's circle and bent round
// it), so a crowd flows round someone standing still.
//
// Stand-ins: a figure of the far crowd that comes within HAND_IN of the player on foot is handed over to a real walker
// of the same colours and height (standIn(); crowd.js stops drawing it), who keeps to the figure's own line and pace by
// the shared clock, with a body and a side-step, and is handed back beyond HAND_OUT. The same person at the same place
// on every client, nothing sent. At most STAND_INS at a time.
// Cost (the same on every tier): begin() is one pass over the people's records (place + box test), a handful of bodies
// kept; step() tests those. Nothing is allocated per frame.
import { randomLook } from '../core/characters.js';
import { GUARD_ROLES } from './_ped_child.js';

export const R_PLAYER = 0.32, R_ADULT = 0.26, R_CHILD = 0.2, R_PRAM = 0.36, R_DOG = 0.18, R_REMOTE = 0.3;
export const STAND_INS = 20, HAND_IN = 5, HAND_OUT = 6.5;
const NEAR = 2.6;                 // m: bodies within this of the player are kept for the frame
const SOFT_V = 1.6;               // m/s: how fast two players are eased apart
const STEP_V = 1.5, STEP_BACK = 0.5, STEP_T = 0.32;      // a step aside: m/s across, m/s away, seconds
const HOLD_S = 0.35;              // somebody at a post is pressed this long before giving way
const MAXB = 48;
// poses somebody standing may step aside in (seated, leaning, writing at a desk: they stay)
const UPRIGHT = new Set(['stand', 'talk', 'phone', 'photo', 'drunk', 'wave', 'clap', 'lecture', 'holding-hands', 'arm-in-arm']);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Solid {
  /** sys: the Pedestrians system */
  constructor(game, sys) {
    this.game = game; this.sys = sys;
    this.n = 0; this.bo = new Array(MAXB).fill(null); this.bk = new Uint8Array(MAXB); this.br = new Float32Array(MAXB);
    this.nx = 0; this.nz = 0; this.vn = 0;
    this.stats = { contacts: 0, held: 0, steps: 0, staggers: 0, handed: 0, back: 0, waited: 0, noRoom: 0, allOut: 0 };      // (the last three: frames a stand-in was refused — one was made a moment ago / something stands there / all are out)
    this.stand = []; this._standT = 0; this._q = { x: 0, z: 0 };
    this._P = null;
    this._remote = (o) => {
      const P = this._P; if (!o.seen || o.veh || o.place !== P.place || this.n >= MAXB) return;
      if (Math.abs(o.x - P.pos.x) > NEAR || Math.abs(o.z - P.pos.z) > NEAR || Math.abs(o.y - P.pos.y) > 1.25) return;
      this.bo[this.n] = o; this.bk[this.n] = 3; this.br[this.n++] = R_REMOTE;
    };
  }
  _add(o, k, r) { if (this.n < MAXB) { this.bo[this.n] = o; this.bk[this.n] = k; this.br[this.n++] = r; } }

  /** once a frame, before the player moves: who is within reach (people, pushchairs, dogs, other players) */
  begin(P) {
    for (let i = 0; i < this.n; i++) this.bo[i] = null;
    this.n = 0;
    // (not in a vehicle or the water; not while placed by something else — a conversation, a seat, a game played standing
    // at a table, a scripted move — nor while tumbling: the player is then where that put them)
    const act = this.game.activity;
    if (P.vehicle || P.swim || P.frozen || P.downT > 0 || (act && !act.walk)) return 0;
    const sys = this.sys, L = sys.list, place = P.place, x = P.pos.x, y = P.pos.y, z = P.pos.z;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; if (!p.active || p.place !== place) continue;
      const dx = p.x - x, dz = p.z - z;
      if (dx > NEAR + 1 || dx < -NEAR - 1 || dz > NEAR + 1 || dz < -NEAR - 1) continue;
      if (Math.abs(p.y - y) > 1.25 || p.tiedProxy || p.solid === false) continue;      // (another storey; up on a roof above them)
      const g = p.character && p.character.group; if (!g || (g.visible === false && !p.veil)) continue;
      if (!p.down && dx < NEAR && dx > -NEAR && dz < NEAR && dz > -NEAR) this._add(p, 0, p.child ? R_CHILD : R_ADULT);
      if (p.kit && p.kit.visible !== false) { const k = p.kit.position; if (Math.abs(k.x - x) < NEAR && Math.abs(k.z - z) < NEAR) this._add(p, 1, R_PRAM); }
    }
    if (place === 'world') { const A = sys.animals; for (let i = 0; i < A.length; i++) { const a = A[i]; if (a.kind !== 'dog') continue; if (Math.abs(a.o[a.kx] - x) < NEAR && Math.abs(a.o[a.kz] - z) < NEAR) this._add(a, 2, R_DOG); } }
    const net = this.game.net;
    if (net && net.connected && net.others && net.others.size) { this._P = P; net.others.forEach(this._remote); }
    return this.n;
  }

  /**
   * One sub-step of the player's move: p = where the walls leave it, (x0, z0) where it was, (vx, vz) its velocity,
   * dt the sub-step's time, RO the wall options of this step, (wx, wz) the velocity the keys ask for (somebody is
   * PRESSED by a player who keeps walking at them — the keys — not only by the speed left after they were stopped,
   * which is a frame's worth of acceleration and so depended on the frame rate). still: the player is not moving —
   * only another player eases them out (a crowd never carries a standing player off the pavement). Moves p out of everybody; true when somebody solid was
   * touched: (this.nx, this.nz) is then the way out of the one pressed hardest, for the caller to take the speed into
   * them away.
   */
  step(P, p, x0, z0, vx, vz, dt, RO, wx = 0, wz = 0, still = false) {
    if (!this.n) return false;
    const col = this.game.collider, sp = Math.hypot(vx, vz);
    let any = false; this.vn = -1;
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (let i = 0; i < this.n; i++) {
        const o = this.bo[i], k = this.bk[i];
        let bx, bz;
        if (k === 1) { bx = o.kit.position.x; bz = o.kit.position.z; } else if (k === 2) { bx = o.o[o.kx]; bz = o.o[o.kz]; } else { bx = o.x; bz = o.z; }
        const D = R_PLAYER + this.br[i], dx = p.x - bx, dz = p.z - bz, d2 = dx * dx + dz * dz;
        if (d2 >= D * D) continue;
        let d = Math.sqrt(d2), ux, uz;
        if (d > 1e-3) { ux = dx / d; uz = dz / d; }
        else { const ex = x0 - bx, ez = z0 - bz, el = Math.hypot(ex, ez); d = 0; if (el > 1e-3) { ux = ex / el; uz = ez / el; } else { ux = Math.cos(P.heading); uz = -Math.sin(P.heading); } }
        if (k === 3) {
          // another player: eased apart, never stopped
          if (pass === 0) { const push = Math.min(D - d, SOFT_V * dt); p.x += ux * push; p.z += uz * push; moved = true; }
          continue;
        }
        // (standing still: the townspeople do not move the player — whoever has been jostled into them clears off, clearOf())
        if (still) continue;
        p.x += ux * (D - d); p.z += uz * (D - d); moved = true;
        if (pass === 0) {
          const vn = -(vx * ux + vz * uz), wn = -(wx * ux + wz * uz), pr = Math.max(vn, Math.min(wn, 1));
          if (vn > this.vn) { this.vn = vn; this.nx = ux; this.nz = uz; }
          if (k === 0 && pr > 0.2 && pr > o.pressV) { o.pressV = pr; o.pressS = sp; }
          any = true;
        }
      }
      if (!moved) break;
      col.resolve(p, R_PLAYER, RO);
      if (P.onGround && !P.support && col.isWet(p.x, p.z)) { p.x = x0; p.z = z0; }
    }
    if (any) {
      this.stats.contacts++;
      // between somebody and a wall: where we stood, if that was no worse
      const w1 = this._worst(p.x, p.z);
      if (w1 > 0.03 && this._worst(x0, z0) <= w1) { p.x = x0; p.z = z0; this.stats.held++; }
    }
    return any;
  }
  /** how far inside the nearest solid body (x, z) is (<= 0: clear) */
  _worst(x, z) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const o = this.bo[i], k = this.bk[i]; if (k === 3) continue;
      let bx, bz;
      if (k === 1) { bx = o.kit.position.x; bz = o.kit.position.z; } else if (k === 2) { bx = o.o[o.kx]; bz = o.o[o.kz]; } else { bx = o.x; bz = o.z; }
      const e = R_PLAYER + this.br[i] - Math.hypot(x - bx, z - bz); if (e > w) w = e;
    }
    return w;
  }

  /**
   * Somebody a player is pressing against (ux, uz: from the player to them; vn: how fast the player is coming on; sp:
   * the player's speed; ph: the player's heading; me: our own Player, or null for another player's).
   */
  pressed(p, ux, uz, vn, sp, ph, me, dt) {
    const sys = this.sys;
    if (p.child || p.down || p.remote || p.state === 'sit') return;
    sys._bumpSay(p, sp);
    if (p.hopT > 0) return;
    const kids = GUARD_ROLES[p.role] ? sys._hasKids(p) : false;
    // run into at a jog or more: they stagger a step back (and the runner stumbles off them: Player.stumble)
    if (sp > 3.4 && vn > 1.5 && (p.knockable !== false || p.cm) && !p.scripted && !kids && !(p.bumpT > 0)) {
      p.bumpT = 1.2; p.hopVx = ux * 1.7; p.hopVz = uz * 1.7; p.hopT = 0.3; p.hopSoft = true;
      p.character.setPose('stumble'); this.stats.staggers++;
      if (me && me.stumble) me.stumble({ x: -ux, z: -uz }, Math.min(0.55, 0.15 + (sp - 3.4) * 0.12));
      return;
    }
    if (p.scripted && !UPRIGHT.has(p.basePose)) return;          // (at a desk, on a stool, leaning on the bar)
    p.pressT += dt;
    // (somebody at their post — a shopkeeper at the till, a porter, anyone with a name — holds their ground a moment first;
    //  a customer stood in the aisle steps aside at once, as a walker does)
    if ((p.static || p.state === 'post' || p.state === 'static') && (p.label || p.role === 'clerk' || p.role === 'porter' || p.state === 'post') && p.pressT < HOLD_S) return;
    // a step aside: the side of the player's line they are already on, else the other, else straight back
    const fx = Math.sin(ph), fz = Math.cos(ph), cr = fx * uz - fz * ux;
    let side = Math.abs(cr) > 0.05 ? (cr > 0 ? 1 : -1) : (((p.lookSeed || p.sid || p.poolIdx || 0) & 1) ? 1 : -1);
    const col = sys._colOf(p), world = p.place === 'world', onRoad = world && sys.road(p.x, p.z);
    const free = (x, z) => (!col || col.isFree(x, z, 0.26)) && (!world || (!sys.wet(x, z) && (onRoad || !sys.road(x, z)))) && sys._doorFree(p, x, z);      // (…nor through a door: a leaf that is not open is a wall to them)
    let tx = 0, tz = 0, ok = false;
    for (let k = 0; k < 2 && !ok; k++, side = -side) { tx = -uz * side; tz = ux * side; ok = free(p.x + tx * 0.55 + ux * 0.15, p.z + tz * 0.55 + uz * 0.15); }
    if (ok) { p.hopVx = tx * STEP_V + ux * STEP_BACK; p.hopVz = tz * STEP_V + uz * STEP_BACK; }
    else if (free(p.x + ux * 0.5, p.z + uz * 0.5)) { p.hopVx = ux * STEP_V; p.hopVz = uz * STEP_V; }
    else return;                                                  // (nowhere to go: the player goes round)
    p.hopT = STEP_T; p.hopSoft = true; p.pressT = 0; this.stats.steps++;
    if (p.visit) p.yieldT = 0.9;                                  // (on their way into or out of a shop: a pause before they go on — pedestrians.js _axis, _visitRoom)
    if (p.static) p.stepped = true;                               // (back to the post afterwards: pedestrians.js 'static')
  }

  /** the step aside / the stagger / the hop clear of a car, one frame of it: never into a wall or the water; a step
   *  taken for a player never off the pavement into the road */
  hop(p, dt) {
    const sys = this.sys, q = this._q;
    p.hopT -= dt;
    q.x = p.x + p.hopVx * dt; q.z = p.z + p.hopVz * dt;
    const col = sys._colOf(p);
    if (col) col.resolve(q, 0.28);
    if (p.place === 'world') {
      if (sys.wet(q.x, q.z)) { if (p.hopT <= 0) p.hopSoft = false; return; }
      if (p.hopSoft && !sys.road(p.x, p.z) && sys.road(q.x, q.z)) { p.hopT = 0; p.hopSoft = false; return; }
    }
    if (!sys._doorFree(p, q.x, q.z)) { if (p.hopT <= 0) p.hopSoft = false; return; }      // (not through a street door: pedestrians.js _doorFree)
    if (p.clock) { p.offX += q.x - p.x; p.offZ += q.z - p.z; }
    p.x = q.x; p.z = q.z;
    if (p.hopT <= 0) p.hopSoft = false;
  }

  /**
   * Nobody ends their own step inside a player: p stood at (x0, z0) before this frame's move; c = the player ({x, z}),
   * r its radius. The step is cut short at the circle and bent round it towards where p is going; a child's is only
   * ever cut by as much as it moved (a player never moves a child).
   */
  clearOf(p, c, r, x0, z0) {
    const D = r + (p.child ? R_CHILD : R_ADULT), dx = p.x - c.x, dz = p.z - c.z, d2 = dx * dx + dz * dz;
    if (d2 >= D * D) return false;
    const sys = this.sys, mv = Math.hypot(p.x - x0, p.z - z0), d = Math.sqrt(d2);
    let ux, uz;
    if (d > 1e-3) { ux = dx / d; uz = dz / d; } else { ux = Math.sin(p.heading + Math.PI); uz = Math.cos(p.heading + Math.PI); }
    // (a child who is standing — jostled into the player by a brother or a passer-by, not walking there — is put back
    //  exactly where it stood: sliding it out along the player's side let it drift a hand's breadth from its place,
    //  frame after frame, while the player leant on it. A child's walk is bent round the player as anyone's is.)
    if (p.child && !(p.speed > 0.2)) { if (mv > 0 && Math.hypot(x0 - c.x, z0 - c.z) >= d) { p.x = x0; p.z = z0; return true; } return false; }
    const out = Math.min(D - d, p.child ? mv : mv + 0.012);
    if (out <= 0) return false;
    const q = this._q; q.x = p.x + ux * out; q.z = p.z + uz * out;
    // round them, towards where it is going
    if (mv > 1e-4 && p.speed > 0.2 && p.state !== 'static' && p.state !== 'post') {
      const gx = (p.clock ? p.cx : p.tx) - p.x, gz = (p.clock ? p.cz : p.tz) - p.z, sg = gx * -uz + gz * ux >= 0 ? 1 : -1, t = Math.min(mv, out) * 0.9;
      q.x += -uz * sg * t; q.z += ux * sg * t;
    }
    const col = sys._colOf(p);
    if (col) col.resolve(q, 0.26);
    if (p.place === 'world' && (sys.wet(q.x, q.z) || (!sys.road(p.x, p.z) && sys.road(q.x, q.z)))) { q.x = x0; q.z = z0; }
    // (a wall behind: back where it stood, if that is no nearer the player)
    if (Math.hypot(q.x - c.x, q.z - c.z) < d - 1e-4) { if (Math.hypot(x0 - c.x, z0 - c.z) >= d) { q.x = x0; q.z = z0; } else return false; }
    // (not through a street door — the bend round the player, or the step back, may not carry them across a leaf that
    //  is not open: straight out instead; failing that, where they stood; failing that, they stay)
    if (!sys._doorFree(p, q.x, q.z)) {
      q.x = p.x + ux * out; q.z = p.z + uz * out;
      if (col) col.resolve(q, 0.26);
      if (!sys._doorFree(p, q.x, q.z)) { if (Math.hypot(x0 - c.x, z0 - c.z) >= d && sys._doorFree(p, x0, z0)) { q.x = x0; q.z = z0; } else return false; }
    }
    if (p.clock) { p.offX += q.x - p.x; p.offZ += q.z - p.z; }
    if (p.static && mv < 1e-4) p.stepped = true;
    p.x = q.x; p.z = q.z;
    return true;
  }

  /** a clock-driven person's frame (a scripted wanderer, a stand-in): pressed by our player -> a step aside, kept as an
   *  offset from where the clock has them, which wears off once the player is out of the way */
  clock(p, dt, pl) {
    p.clock = true;
    const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz), me = this.game.player;
    if (p.pressV > 0.2 && d > 1e-3 && d < 1.5 && !p.down) this.pressed(p, dx / d, dz / d, p.pressV, p.pressS, me.heading, me, dt);
    else if (p.pressT > 0) p.pressT = Math.max(0, p.pressT - dt);
    p.pressV = 0;
    if (p.bumpT > 0) p.bumpT -= dt;
    if (p.hopT > 0) this.hop(p, dt);
    else if ((p.offX || p.offZ) && d > 1.3) {
      const l = Math.hypot(p.offX, p.offZ), k = Math.max(0, l - 0.7 * dt) / (l || 1);
      p.offX *= k; p.offZ *= k; if (l < 0.01) { p.offX = 0; p.offZ = 0; }
    }
  }

  // ---------------------------------------------------------------- stand-ins for the far crowd
  /** the look of far-crowd member m as a real walker: its colours and height (the rest from its number) */
  lookOf(m) {
    const L = randomLook(0x51ed + m.k * 7919, { outfit: 'casual' }), h = m.hex;
    if (h) { L.top = h[0]; L.bottom = h[1]; L.skin = h[2]; L.hair = h[3]; }
    L.height = Math.round(1.72 * m.ht * 100) / 100;
    delete L.jacket; delete L.jacketLen; delete L.scarf; delete L.hat; delete L.hatColor; delete L.backpack; delete L.gown; delete L.skirt; delete L.skirtColor; delete L.tights;
    return L;
  }
  /** Far-crowd member m, now at (x, z) facing (hx, hz), is within reach of the player: a real walker in its place, or
   *  null (all STAND_INS out, or one was made a moment ago: a character takes a few ms to build, so one every 0.12 s —
   *  one a frame when `urgent`: the figure is nearly at the player, who is running at it). */
  standIn(m, x, z, hx, hz, urgent) {
    const sys = this.sys, now = this.game.elapsed || 0;
    if (now < this._standT - (urgent ? 0.1 : 0)) { this.stats.waited++; return null; }
    if (!sys.game.worldCollider.isFree(x, z, 0.2)) { this.stats.noRoom++; return null; }
    let p = null;
    for (let i = 0; i < this.stand.length; i++) if (!this.stand[i].active) { p = this.stand[i]; break; }
    if (!p) { if (this.stand.length >= STAND_INS) { this.stats.allOut++; return null; } p = sys._record(); this.stand.push(p); sys.list.push(p); }
    this._standT = now + 0.12;
    sys._activate(p, 'townie', this.lookOf(m), x, z, Math.atan2(hx, hz));
    p.det = true; p.cm = m; p.clock = true; p.state = 'crowd'; p.drunk = false; p.basePose = 'stand'; p.character.setPose('stand');
    p.vmax = m.speed || 1.2; p.cx = x; p.cz = z; p.chx = hx; p.chz = hz; p.cF = sys.frame; p.offX = 0; p.offZ = 0; p.veil = false; p.pressV = 0; p.pressT = 0;
    p.sayCd = 4 + Math.random() * 16;
    this.stats.handed++;
    return p;
  }
  /** back to the far crowd's figure */
  standOut(p) { if (p && p.active && p.cm) { p.cm = null; p.clock = false; p.veil = false; this.sys._deactivate(p); this.stats.back++; } }
  /** a stand-in's frame: on its figure's line and at its pace by the shared clock (crowd.js writes cx, cz, chx, chz each frame) */
  standWalk(p, dt, pl) {
    const sys = this.sys;
    if (sys.frame - p.cF > 20) { this.standOut(p); return; }      // (the crowd has stopped: indoors, the hour, out of its reach)
    this.clock(p, dt, pl);
    const tx = p.cx + p.offX, tz = p.cz + p.offZ, d = Math.hypot(tx - p.x, tz - p.z);
    if (d > 0.5) sys._moveTo(p, tx, tz, Math.max(p.vmax * 1.6, 1.4), dt);
    else {
      p.x = tx; p.z = tz; p.speed = dt > 0 ? Math.min(2.2, d / dt) : 0;
      p.heading += wrapA(Math.atan2(p.chx, p.chz) - p.heading) * Math.min(1, dt * 7);
    }
    if (p.character.pose !== 'stand' && p.character.pose !== 'stumble') p.character.setPose('stand');
  }
}
