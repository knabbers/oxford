// Pool: pure table physics, English 8-ball pub rules and a fallible bar-regular AI. No three.js / DOM (tested in Node by
// tools/smoke_bar.mjs and tools/smoke_bar_games.mjs).
// Table frame: metres, origin at the centre of the playing surface, x along the length (baulk end at -x), y across
// (+y is the shooter's RIGHT when looking along +x: the table frame is the world's x / z seen from above).
//
// The model (per ball: velocity v, spin w = (wx, wy) about the horizontal axes and wz about the vertical):
//  * the cloth acts at the contact point, whose slip is u = (vx - R wy, vy + R wx). While it slips the ball SLIDES:
//    friction MU_SLIDE g against the slip (so a stunned ball skids, a ball struck low comes back, one struck high runs
//    on); the slip dies at 7/2 the rate and the ball then ROLLS, losing MU_ROLL g. Side spin wz decays by itself.
//  * ball on ball: an impulse along the line of centres only (no throw), restitution E_BALL, real masses (the white is
//    1 7/8", the colours 2"); the spins are untouched, so the object ball leaves skidding and the white keeps its top or
//    back spin: follow, stun and screw come out of the model, nothing is special-cased.
//  * cushions: the rail noses are segments, the pocket jaws are round knuckles (circles). Normal restitution falls a
//    little with speed; side spin grips the rubber (Coulomb, MU_CUSH) and bends the rebound; the roll into the cushion
//    is lost, so a ball comes off a rail skidding and at about 0.6 of its speed once it rolls again.
//  * pockets: a ball drops when its centre is over the hole (a circle behind the jaws). Nothing else pots a ball, so a
//    ball can rattle in the jaws and stay up.
//  * a fixed step of 1/960 s (8 mm at break speed, a third of a radius): advance() banks frame time and never drops
//    any, so the same shot gives the same table at any frame rate.

export const TABLE = { L: 1.83, W: 0.915 };              // 7 ft pub table: 6 ft x 3 ft playing surface
export const BALL_R = 0.0254, CUE_R = 0.0238;            // 2" reds / yellows / black, 1 7/8" white (UK coin-op tables)
export const BAULK_X = -TABLE.L / 2 + TABLE.L / 5;        // baulk line, one fifth of the way up
export const D_R = TABLE.W / 6;                           // radius of the D
export const BLACK_X = TABLE.L / 4;                       // the black spot: midway between the centre and the top cushion
export const G = 9.81;
export const MU_SLIDE = 0.2, MU_ROLL = 0.015, MU_SPIN = 0.044, MU_CUSH = 0.2;
export const E_BALL = 0.95;
export const E_CUSH_MAX = 0.88, E_CUSH_MIN = 0.55, E_CUSH_FALL = 0.035;   // e = max - fall * (speed into the rail)
export const MAX_SPEED = 8.0;                              // m/s: a hard pub break
export const DT = 1 / 960;
const STOP = 0.004, SLIP_EPS = 0.002, SPIN_STOP = 0.3;
const L2 = TABLE.L / 2, W2 = TABLE.W / 2;

// ---- cushions & pockets ----------------------------------------------------------------------------------------------
export const CORNER_GAP = 0.060;   // each rail stops this far short of the corner: the mouth is 85 mm across the fall
export const MID_GAP = 0.050;      // half the middle pocket's mouth (100 mm)
export const JAW_R = 0.024, MID_JAW_R = 0.020;   // radius of the rounded jaws
/** Rail noses: the ball centre stays `r` away from each segment. {x1,y1,x2,y2, nx,ny (into the table)} */
export const SEGMENTS = [];
/** Rounded pocket jaws: circles the ball bounces off. {x, y, r, pocket} */
export const JAWS = [];
/** Pockets: {x, y (centre of the hole), r (a ball whose centre is within r drops), ax, ay (unit axis into the pocket),
 *  mx, my (centre of the mouth, on the line of the noses), kind} */
export const POCKETS = [];
(function buildTable() {
  const seg = (x1, y1, x2, y2, nx, ny) => SEGMENTS.push({ x1, y1, x2, y2, nx, ny });
  for (const sy of [-1, 1]) {
    seg(-L2 + CORNER_GAP, sy * W2, -MID_GAP, sy * W2, 0, -sy);
    seg(MID_GAP, sy * W2, L2 - CORNER_GAP, sy * W2, 0, -sy);
  }
  for (const sx of [-1, 1]) seg(sx * L2, -W2 + CORNER_GAP, sx * L2, W2 - CORNER_GAP, -sx, 0);
  for (const sy of [-1, 1]) {
    const k = POCKETS.length;
    POCKETS.push({ x: 0, y: sy * (W2 + 0.030), r: 0.047, ax: 0, ay: sy, mx: 0, my: sy * W2, kind: 'middle' });
    for (const sx of [-1, 1]) JAWS.push({ x: sx * MID_GAP, y: sy * (W2 + MID_JAW_R), r: MID_JAW_R, pocket: k });
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const k = POCKETS.length, a = Math.SQRT1_2;
    POCKETS.push({ x: sx * (L2 + 0.010), y: sy * (W2 + 0.010), r: 0.043, ax: sx * a, ay: sy * a, mx: sx * (L2 - CORNER_GAP / 2), my: sy * (W2 - CORNER_GAP / 2), kind: 'corner' });
    JAWS.push({ x: sx * (L2 - CORNER_GAP), y: sy * (W2 + JAW_R), r: JAW_R, pocket: k });
    JAWS.push({ x: sx * (L2 + JAW_R), y: sy * (W2 - CORNER_GAP), r: JAW_R, pocket: k });
  }
})();
/** Where to send a ball so that it drops into pocket p (the centre of the mouth, a touch inside). */
export function pocketTarget(p) { return { x: p.mx + p.ax * 0.012, y: p.my + p.ay * 0.012 }; }

// ---- balls -----------------------------------------------------------------------------------------------------------
// kinds: 'cue' | 'red' | 'yellow' | 'black'. m is the mass relative to a 2" ball.
export function makeBall(id, kind, x, y) {
  const r = kind === 'cue' ? CUE_R : BALL_R;
  return { id, kind, x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, r, m: (r / BALL_R) ** 3, potted: false, pocket: -1 };
}
/** English 8-ball rack: the black on its spot, the apex towards baulk. rng optional (tiny gaps, as a real rack has). */
export function rack(rng = null) {
  const balls = [makeBall(0, 'cue', BAULK_X - 0.09, 0.06)];
  const rows = [['R'], ['Y', 'R'], ['R', 'K', 'Y'], ['Y', 'R', 'Y', 'R'], ['R', 'Y', 'Y', 'R', 'Y']];
  const d = BALL_R * 2 + 0.0004, dx = d * Math.sqrt(3) / 2, x0 = BLACK_X - 2 * dx;
  let id = 1;
  rows.forEach((row, i) => row.forEach((c, j) => {
    const jit = rng ? (rng() - 0.5) * 0.0004 : 0;
    balls.push(makeBall(id++, c === 'R' ? 'red' : c === 'Y' ? 'yellow' : 'black', x0 + i * dx + jit, (j - (row.length - 1) / 2) * d + jit));
  }));
  return balls;
}

/** Kinetic energy, translational + rotational, in units of a 2" ball's mass (J/kg). Tests: it never rises. */
export function energy(balls) {
  let e = 0;
  for (const b of balls) if (!b.potted) e += b.m * (0.5 * (b.vx * b.vx + b.vy * b.vy) + 0.2 * b.r * b.r * (b.wx * b.wx + b.wy * b.wy + b.wz * b.wz));
  return e;
}
export function moving(balls) {
  for (const b of balls) if (!b.potted && (b.vx !== 0 || b.vy !== 0 || b.wx !== 0 || b.wy !== 0 || b.wz !== 0)) return true;
  return false;
}
/** 'still' | 'slide' | 'roll' | 'spin' (turning on the spot) */
export function motionOf(b) {
  if (b.vx === 0 && b.vy === 0 && b.wx === 0 && b.wy === 0) return b.wz === 0 ? 'still' : 'spin';
  return Math.hypot(b.vx - b.r * b.wy, b.vy + b.r * b.wx) > SLIP_EPS ? 'slide' : 'roll';
}

export function newEvents() { return { first: -1, potted: [], hits: [], cushions: 0, rails: new Set(), escapes: 0, lastCushion: 0, cush: [], jaws: 0, firstT: -1, t: 0 }; }

function integrate(b, dt) {
  const R = b.r;
  if (b.vx !== 0 || b.vy !== 0 || b.wx !== 0 || b.wy !== 0) {
    const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, us = Math.hypot(ux, uy);
    if (us > SLIP_EPS) {
      // sliding: friction against the slip, on the velocity and (5/2R times) on the spin
      let j = MU_SLIDE * G * dt; if (j * 3.5 > us) j = us / 3.5;
      const fx = -ux / us * j, fy = -uy / us * j;
      b.vx += fx; b.vy += fy; b.wx += 2.5 * fy / R; b.wy -= 2.5 * fx / R;
    } else {
      const s = Math.hypot(b.vx, b.vy), ns = s - MU_ROLL * G * dt;
      if (ns < STOP) { b.vx = b.vy = b.wx = b.wy = 0; } else { const k = ns / s; b.vx *= k; b.vy *= k; b.wx *= k; b.wy *= k; }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
  }
  if (b.wz !== 0) {
    const d = 2.5 * MU_SPIN * G / R * dt;
    b.wz = Math.abs(b.wz) <= d || (b.vx === 0 && b.vy === 0 && Math.abs(b.wz) < SPIN_STOP) ? 0 : b.wz - Math.sign(b.wz) * d;
  }
}

/** rebound off a cushion nose or a jaw whose normal (into the table) is (nx, ny) */
function bounce(b, nx, ny, ev, jaw) {
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;
  const R = b.r, e = Math.max(E_CUSH_MIN, E_CUSH_MAX - E_CUSH_FALL * -vn);
  const tx = -ny, ty = nx;
  // side spin against the rubber: slip of the contact point along the rail
  const s = b.vx * tx + b.vy * ty - R * b.wz, lim = MU_CUSH * (1 + e) * -vn;
  let J = -s / 3.5; if (J > lim) J = lim; else if (J < -lim) J = -lim;
  b.vx += J * tx - (1 + e) * vn * nx; b.vy += J * ty - (1 + e) * vn * ny;
  b.wz -= 2.5 * J / R;
  // the roll into the rail is lost in the rubber (q = R (wy, -wx) is the velocity the spin would roll at)
  const qx = R * b.wy, qy = -R * b.wx, qn = qx * nx + qy * ny;
  b.wy = (qx - qn * nx) / R; b.wx = -(qy - qn * ny) / R;
  if (ev) { ev.cushions++; ev.rails.add(b.id); ev.lastCushion = -vn; if (jaw) ev.jaws++; if (ev.cush.length < 48) ev.cush.push({ id: b.id, speed: -vn, jaw: !!jaw, t: ev.t }); }
}

/**
 * Advance the table by one fixed step. `ev` collects what happened, for the rules and the sound:
 * first (id of the first ball the white touched), potted [ids], hits [{a, b, speed, t}], cushions, rails (ids that
 * touched a cushion), cush [{id, speed, jaw, t}], jaws, lastCushion, escapes (never expected), t (seconds so far).
 */
export function step(balls, ev, dt = DT) {
  if (ev) ev.t += dt;
  const n = balls.length;
  for (let i = 0; i < n; i++) { const b = balls[i]; if (!b.potted) integrate(b, dt); }
  // ball on ball
  for (let i = 0; i < n; i++) {
    const a = balls[i]; if (a.potted) continue;
    for (let j = i + 1; j < n; j++) {
      const b = balls[j]; if (b.potted) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      const over = (rr - d) / 2 + 1e-7;                      // separate (positions only: no energy is added)
      a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv >= 0) continue;
      const jimp = -(1 + E_BALL) * rv / (1 / a.m + 1 / b.m);
      a.vx -= jimp / a.m * nx; a.vy -= jimp / a.m * ny; b.vx += jimp / b.m * nx; b.vy += jimp / b.m * ny;
      if (ev) {
        if (ev.first < 0) { if (a.kind === 'cue') { ev.first = b.id; ev.firstT = ev.t; } else if (b.kind === 'cue') { ev.first = a.id; ev.firstT = ev.t; } }
        if (ev.hits.length < 96) ev.hits.push({ a: a.id, b: b.id, speed: -rv, t: ev.t });
      }
    }
  }
  // pockets, cushions, jaws
  for (let i = 0; i < n; i++) {
    const b = balls[i]; if (b.potted) continue;
    const ax = Math.abs(b.x), ay = Math.abs(b.y);
    if (ax < L2 - b.r - 0.001 && ay < W2 - b.r - 0.001) continue;          // clear of every rail
    let pk = -1;
    for (let k = 0; k < POCKETS.length; k++) { const p = POCKETS[k], qx = b.x - p.x, qy = b.y - p.y; if (qx * qx + qy * qy < p.r * p.r) { pk = k; break; } }
    if (pk < 0 && (ax > L2 + 0.02 || ay > W2 + 0.02)) {                    // deep behind the noses: it is in a pocket
      let bd = Infinity; for (let k = 0; k < POCKETS.length; k++) { const p = POCKETS[k], q = Math.hypot(b.x - p.x, b.y - p.y); if (q < bd) { bd = q; pk = k; } }
      if (bd > 0.09) { if (ev) ev.escapes++; }
    }
    if (pk >= 0) { b.potted = true; b.pocket = pk; b.vx = b.vy = b.wx = b.wy = b.wz = 0; if (ev) ev.potted.push(b.id); continue; }
    for (let k = 0; k < SEGMENTS.length; k++) {
      const s = SEGMENTS[k], ex = s.x2 - s.x1, ey = s.y2 - s.y1;
      const t = ((b.x - s.x1) * ex + (b.y - s.y1) * ey) / (ex * ex + ey * ey);
      if (t < 0 || t > 1) continue;                                         // past the end: the jaw's circle takes it
      const dist = (b.x - s.x1) * s.nx + (b.y - s.y1) * s.ny;
      if (dist >= b.r) continue;
      b.x += s.nx * (b.r - dist + 1e-6); b.y += s.ny * (b.r - dist + 1e-6);
      bounce(b, s.nx, s.ny, ev, false);
    }
    for (let k = 0; k < JAWS.length; k++) {
      const c = JAWS[k], dx = b.x - c.x, dy = b.y - c.y, rr = b.r + c.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      b.x = c.x + nx * (rr + 1e-6); b.y = c.y + ny * (rr + 1e-6);
      bounce(b, nx, ny, ev, true);
    }
  }
}

/** Cue-ball speed for a stroke of power 0..1 (soft shots get most of the travel). */
export function speedFor(power) { const p = Math.max(0, Math.min(1, power)); return MAX_SPEED * Math.max(0.012, Math.pow(p, 1.35)); }
export function powerFor(speed) { return Math.pow(Math.max(0, Math.min(1, speed / MAX_SPEED)), 1 / 1.35); }
/**
 * Strike the white. angle: radians in the table frame; power 0..1; spin {top: -1..1 (back .. top), side: -1..1 (left ..
 * right, as the shooter sees it)}: where the tip meets the ball, out to half a radius from the centre. Centre ball
 * leaves it skidding (stun); +0.8 top is natural roll.
 */
export function strike(balls, angle, power, spin = null) {
  const cue = balls[0].kind === 'cue' ? balls[0] : balls.find((b) => b.kind === 'cue');
  const v = speedFor(power), dx = Math.cos(angle), dy = Math.sin(angle);
  const top = spin ? Math.max(-1, Math.min(1, spin.top || 0)) : 0, side = spin ? Math.max(-1, Math.min(1, spin.side || 0)) : 0;
  cue.vx = dx * v; cue.vy = dy * v;
  const q = 1.25 * top * v;                               // the speed the spin would roll at: (5/2) (offset / R) v
  cue.wy = q * dx / cue.r; cue.wx = -q * dy / cue.r;
  cue.wz = -1.25 * side * v / cue.r;
  return v;
}

/** Run a whole shot to rest. */
export function simulate(balls, maxT = 40) {
  const ev = newEvents(); let t = 0;
  while (moving(balls) && t < maxT) { step(balls, ev); t += DT; }
  if (t >= maxT) for (const b of balls) { b.vx = b.vy = b.wx = b.wy = b.wz = 0; }
  ev.time = t;
  return ev;
}
/** A shot in progress that frames feed with their own dt: {balls, ev, acc, t, steps}. */
export function newSim(balls) { return { balls, ev: newEvents(), acc: 0, t: 0, steps: 0 }; }
/** Bank `dt` of frame time and run every whole fixed step in it (none is ever dropped). -> still moving? */
export function advance(sim, dt, maxSteps = 4000) {
  sim.acc += Math.max(0, dt);
  let n = 0;
  while (sim.acc >= DT && n < maxSteps) {
    if (!moving(sim.balls)) { sim.acc = 0; return false; }
    step(sim.balls, sim.ev); sim.acc -= DT; sim.t += DT; sim.steps++; n++;
  }
  return moving(sim.balls);
}

/** Is (x,y) a legal resting place for the white (on the cloth, not touching another ball)? */
export function placeOk(balls, x, y, baulkOnly = true) {
  const r = CUE_R;
  if (Math.abs(x) > L2 - r || Math.abs(y) > W2 - r) return false;
  if (baulkOnly && x > BAULK_X) return false;
  for (const b of balls) if (!b.potted && b.kind !== 'cue' && Math.hypot(b.x - x, b.y - y) < r + b.r + 0.002) return false;
  return true;
}

// ---- rules -----------------------------------------------------------------------------------------------------------
// Pub rules as played in a college bar (stated in the on-screen panel):
//  * Player 0 breaks from baulk. The table stays open after the break; the black on the break is a re-rack.
//  * Open table: the first legal pot of a red or a yellow gives that player that colour.
//  * Fouls: in-off (the white potted), hitting nothing, first contact with the other colour or (before your colour is
//    cleared) the black, potting one of theirs. Penalty: the opponent has TWO VISITS; after an in-off the white is
//    played from baulk.
//  * The black is "on" once all seven of your colour are down. Potting it legally wins; potting it any other way —
//    early, with a foul, or going in-off on the black — loses the frame.
export class PoolGame {
  constructor(names = ['You', 'Opponent'], rng = null) { this.names = names; this.rng = rng; this.reracks = 0; this.reset(); }
  reset() {
    this.balls = rack(this.rng); this.turn = 0; this.groups = [null, null]; this.visits = 1; this.breakShot = true;
    this.winner = -1; this.ballInHand = true; this.message = ''; this.lastFoul = null; this.shots = 0;
  }
  ball(id) { return this.balls[id]; }
  cue() { return this.balls[0]; }
  left(kind) { let n = 0; for (const b of this.balls) if (b.kind === kind && !b.potted) n++; return n; }
  /** Colour the current player must hit first: 'red'|'yellow'|'black'|'open' */
  target(p = this.turn) { const g = this.groups[p]; if (!g) return 'open'; return this.left(g) === 0 ? 'black' : g; }
  /** Evaluate a finished shot. ev from step()/simulate(). -> {foul, cont, win, lose, assigned, rerack, potted[kinds]} */
  resolve(ev) {
    const p = this.turn, o = 1 - p, B = this.balls, tgt = this.target(p), groupBefore = this.groups[p];
    const pots = ev.potted.map((id) => B[id]);
    const cuePotted = pots.some((b) => b.kind === 'cue');
    const blackPotted = pots.some((b) => b.kind === 'black');
    const first = ev.first >= 0 ? B[ev.first] : null;
    let foul = null;
    if (cuePotted) foul = 'In-off';
    else if (!first) foul = 'Missed everything';
    else if (tgt === 'open' && first.kind === 'black' && !this.breakShot) foul = 'Hit the black first';
    else if (tgt !== 'open' && tgt !== 'black' && first.kind !== tgt) foul = first.kind === 'black' ? 'Hit the black first' : `Hit a ${first.kind} first`;
    else if (tgt === 'black' && first.kind !== 'black') foul = 'Must hit the black';
    if (!foul && groupBefore) {
      const opp = groupBefore === 'red' ? 'yellow' : 'red';
      if (pots.some((b) => b.kind === opp)) foul = `Potted a ${opp}`;
    }
    this.shots++;
    const out = { foul, cont: false, win: false, lose: false, assigned: null, rerack: false, potted: pots.map((b) => b.kind) };
    if (blackPotted) {
      if (this.breakShot) { out.rerack = true; const t = this.turn; this.reracks++; this.reset(); this.turn = t; this.message = 'Black on the break: re-rack'; return out; }
      if (tgt === 'black' && !foul) { this.winner = p; out.win = true; this.message = `${this.names[p]} pots the black and wins the frame`; return out; }
      this.winner = o; out.lose = true;
      this.message = foul ? `${this.names[p]} fouls on the black (${foul}) — ${this.names[o]} wins the frame` : `${this.names[p]} potted the black early — ${this.names[o]} wins the frame`;
      return out;
    }
    if (!foul && !groupBefore && !this.breakShot) {
      const firstCol = pots.find((b) => b.kind === 'red' || b.kind === 'yellow');
      if (firstCol) { this.groups[p] = firstCol.kind; this.groups[o] = firstCol.kind === 'red' ? 'yellow' : 'red'; out.assigned = firstCol.kind; }
    }
    const g = this.groups[p];
    const potOwn = pots.some((b) => b.kind !== 'cue' && (this.breakShot || !groupBefore ? b.kind !== 'black' : b.kind === g));
    this.breakShot = false;
    if (cuePotted) { const c = this.cue(); c.potted = false; c.pocket = -1; c.vx = c.vy = c.wx = c.wy = c.wz = 0; }
    if (foul) {
      this.lastFoul = foul; this.turn = o; this.visits = 2; this.ballInHand = cuePotted;
      if (cuePotted) { const c = this.cue(); c.x = BAULK_X - 0.15; c.y = 0; for (let k = 0; k < 40 && !placeOk(B, c.x, c.y); k++) c.y = ((k % 2 ? 1 : -1) * (k + 1) * 0.02); }
      this.message = `Foul: ${foul}. ${this.names[o]} has two visits`;
      return out;
    }
    this.ballInHand = false;
    if (potOwn) { out.cont = true; this.message = out.assigned ? `${this.names[p]} is on the ${out.assigned}s` : `${this.names[p]} pots`; return out; }
    this.visits--;
    if (this.visits > 0) { out.cont = true; this.message = `${this.names[p]}: second visit`; return out; }
    this.turn = o; this.visits = 1; this.message = `${this.names[o]} to play`;
    return out;
  }
  /** everything a watcher needs (positions to 0.1 mm) */
  snapshot() {
    return { b: this.balls.map((b) => [Math.round(b.x * 1e4), Math.round(b.y * 1e4), b.potted ? 1 + b.pocket : 0]), turn: this.turn, groups: this.groups, visits: this.visits,
      bih: this.ballInHand, brk: this.breakShot, win: this.winner, msg: this.message, shots: this.shots, names: this.names };
  }
  apply(s) {
    s.b.forEach((q, i) => { const b = this.balls[i]; if (!b) return; b.x = q[0] / 1e4; b.y = q[1] / 1e4; b.potted = q[2] > 0; b.pocket = q[2] > 0 ? q[2] - 1 : -1; b.vx = b.vy = b.wx = b.wy = b.wz = 0; });
    this.turn = s.turn; this.groups = s.groups.slice(); this.visits = s.visits; this.ballInHand = !!s.bih; this.breakShot = !!s.brk; this.winner = s.win; this.message = s.msg || ''; this.shots = s.shots || 0;
    if (s.names) this.names = s.names.slice();
    return this;
  }
}

// ---- AI --------------------------------------------------------------------------------------------------------------
function segDist(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + ex * t), py - (ay + ey * t));
}
function pathClear(balls, ax, ay, bx, by, ignore, rad) {
  for (const b of balls) if (!b.potted && !ignore.includes(b.id) && segDist(b.x, b.y, ax, ay, bx, by) < rad + b.r) return false;
  return true;
}
function clampAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
function legalFirst(tgt, kind) { return tgt === 'open' ? kind === 'red' || kind === 'yellow' : kind === tgt; }
const A_ROLL = MU_ROLL * G;

/** Every pot the player on turn could try from (cx, cy), best first: [{ball, pocket, angle, power, score, cut}] */
export function pots(game, cx, cy) {
  const B = game.balls, tgt = game.target(), out = [];
  for (const b of B) {
    if (b.potted || b.kind === 'cue' || !legalFirst(tgt, b.kind)) continue;
    for (let k = 0; k < POCKETS.length; k++) {
      const P = POCKETS[k], pt = pocketTarget(P);
      const px = pt.x - b.x, py = pt.y - b.y, d2 = Math.hypot(px, py);
      if (d2 < 1e-4) continue;
      const ux = px / d2, uy = py / d2;
      const into = ux * P.ax + uy * P.ay;                     // how squarely the ball meets the mouth
      if (into < (P.kind === 'middle' ? 0.5 : 0.62)) continue;
      const gx = b.x - ux * (b.r + CUE_R), gy = b.y - uy * (b.r + CUE_R);   // where the white must be at contact
      const dx = gx - cx, dy = gy - cy, d1 = Math.hypot(dx, dy);
      if (d1 < 1e-3) continue;
      const cut = Math.acos(Math.max(-1, Math.min(1, (dx * ux + dy * uy) / d1)));
      if (cut > 1.2) continue;                                // thinner than ~70 degrees: nobody in a bar takes it on
      if (!pathClear(B, cx, cy, gx, gy, [0, b.id], CUE_R)) continue;
      if (!pathClear(B, b.x, b.y, pt.x, pt.y, [b.id, 0], b.r)) continue;
      const score = Math.cos(cut) * 2.2 - d1 * 0.5 - d2 * 0.8 - (1 - into) * 1.5 - (P.kind === 'middle' ? 0.2 : 0);
      // pace: the object ball should reach the pocket still rolling at ~0.6 m/s. It leaves skidding (keeps 5/7 once it
      // rolls); the white, struck with natural roll, arrives rolling.
      const vRoll = Math.sqrt(0.36 + 2 * A_ROLL * d2), vObj = vRoll * 1.4;
      const vArr = vObj / (Math.max(0.3, Math.cos(cut)) * (1 + E_BALL) / (1 + 1 / 0.8226));
      const v0 = Math.sqrt(vArr * vArr + 2 * A_ROLL * d1);
      out.push({ ball: b.id, pocket: k, angle: Math.atan2(dy, dx), power: Math.min(1, Math.max(0.1, powerFor(v0))), score, cut });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
export function bestPot(game, cx, cy) { return pots(game, cx, cy)[0] || null; }

/**
 * Choose a shot for the player on turn. skill = {aimSigma (rad), powerSigma (fraction), nerve? (0..1: how often the
 * easiest pot is passed over for the second choice)}; rng () => [0,1).
 * -> {angle, power, top, side, place?: {x, y}, kind: 'break'|'pot'|'safety'|'hopeful', target?, pocket?}
 */
export function aiShot(game, skill, rng) {
  const B = game.balls, cue = game.cue();
  let place = null;
  if (game.ballInHand) place = bestPlacement(game);
  const cx = place ? place.x : cue.x, cy = place ? place.y : cue.y;
  const g = (s) => { let u = 0; while (u < 1e-12) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()) * s; };
  if (game.breakShot) {
    const apex = B[1];
    return { angle: Math.atan2(apex.y - cy, apex.x - cx) + g(skill.aimSigma * 0.5), power: 0.9 + 0.08 * rng(), top: 0.3, side: 0, place, kind: 'break' };
  }
  const list = pots(game, cx, cy);
  if (list.length) {
    // a bar regular: usually the easy one, now and then the one he fancies; harder shots are missed more
    const pick = list.length > 1 && rng() < (skill.nerve ?? 0.15) && list[1].score > list[0].score - 0.8 ? list[1] : list[0];
    const hard = 1 + pick.cut * 0.9 + Math.max(0, -pick.score) * 0.25;
    const a = pick.angle + g(skill.aimSigma * hard);
    const pw = Math.max(0.08, Math.min(1, pick.power * (1 + g(skill.powerSigma)) + 0.02));
    return { angle: clampAngle(a), power: pw, top: 0.8, side: 0, place, kind: 'pot', target: pick.ball, pocket: pick.pocket };
  }
  // nothing on: roll up to the nearest legal ball
  const tgt = game.target();
  let near = null, nd = Infinity;
  for (const b of B) {
    if (b.potted || b.kind === 'cue' || !legalFirst(tgt, b.kind)) continue;
    if (!pathClear(B, cx, cy, b.x, b.y, [0, b.id], CUE_R)) continue;
    const d = Math.hypot(b.x - cx, b.y - cy); if (d < nd) { nd = d; near = b; }
  }
  if (near) {
    const v = Math.sqrt(0.5 + 2 * A_ROLL * nd);
    return { angle: clampAngle(Math.atan2(near.y - cy, near.x - cx) + g(skill.aimSigma * 0.6)), power: powerFor(v), top: 0.8, side: 0, place, kind: 'safety', target: near.id };
  }
  // snookered: at it anyway, with some pace, and hope
  for (const b of B) if (!b.potted && b.kind !== 'cue' && legalFirst(tgt, b.kind)) {
    return { angle: clampAngle(Math.atan2(b.y - cy, b.x - cx) + g(0.05)), power: 0.45, top: 0.5, side: 0, place, kind: 'hopeful', target: b.id };
  }
  return { angle: rng() * Math.PI * 2 - Math.PI, power: 0.35, top: 0.5, side: 0, place, kind: 'hopeful' };
}

function bestPlacement(game) {
  let best = null;
  for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 7; iy++) {
    const x = -L2 + 0.06 + ix * ((BAULK_X - (-L2 + 0.06)) / 3) - 0.001, y = -W2 + 0.07 + iy * ((TABLE.W - 0.14) / 6);
    if (!placeOk(game.balls, x, y)) continue;
    const p = bestPot(game, x, y);
    const s = p ? p.score : -10;
    if (!best || s > best.s) best = { x, y, s };
  }
  return best ? { x: best.x, y: best.y } : { x: BAULK_X - 0.1, y: 0 };
}

/**
 * Where the white first meets a ball when sent from (cx, cy) along `angle` (ignoring cushions): {x, y, ball, dist} or
 * null. The table shows this as a faint ring when the player has the ghost switched on.
 */
export function firstContact(balls, cx, cy, angle) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = null;
  for (const b of balls) {
    if (b.potted || b.kind === 'cue') continue;
    const ox = b.x - cx, oy = b.y - cy, t = ox * dx + oy * dy, rr = b.r + CUE_R, d2 = ox * ox + oy * oy - t * t;
    if (t > 0 && d2 < rr * rr) { const tt = t - Math.sqrt(rr * rr - d2); if (!best || tt < best.dist) best = { x: cx + dx * tt, y: cy + dy * tt, ball: b.id, dist: tt }; }
  }
  return best;
}
