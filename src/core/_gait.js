// Walking legs for core/characters.js (underscore: a helper of that file). DOM-free, allocation-free once warm.
// The point of it: a foot that is on the ground STAYS where it is on the ground. (2026-11 foot-slide pass; the audit is
// tools/audit_footslide.mjs, the thresholds tools/smoke_footslide.mjs.)
//
// How: the stride is driven by the distance the figure has actually been moved (the displacement of its group in its
// parent's frame between two updates: whoever moves it, at whatever speed, however it eases, shoves or interpolates it),
// never by time x a nominal speed. A stride's length and the share of it a foot spends on the ground come from the
// leg length and the speed (longer strides and a quicker cadence when faster; a flight phase at a run). When a foot
// comes down it is PLANTED at a point of the ground (in the parent's frame, so a deck that carries the figure carries
// the foot) and stays there until the phase lifts it: heel first, flat, then rolling up onto the toe, each about a point
// of the sole that does not move. The swinging foot travels from where it left the ground to where it will land. The
// legs are then solved exactly (two bones, with the hip's abduction and twist: the plant may be to the side of or
// turned against the body) from wherever the pelvis is, and the pelvis rides at the height both legs can reach (so
// it dips at double support and rises over the standing leg by itself).
//   standing still        both feet rest; a foot left in the air lands, a foot left far from under the hip (or twisted)
//                         takes one closing step; a body nudged about while "idle" sways over planted feet and steps
//                         when one is out of comfortable reach
//   turning on the spot   the planted foot keeps its heading (thigh twist) and the feet step round
//   shoved / side-steps   it is all displacement: the feet land along the way the body is really going
//   low-rate animation    (walkers posed every other frame, or not at all behind the camera) the phase still follows
//                         the distance; after a long gap the feet are re-seated on the stride for that phase
//   no real movement      a figure that is told a speed but has never been moved (a preview, a treadmill, a parent
//                         that carries it) walks on the spot at that speed, as before: the "canonical" stride, a pure
//                         function of phase and speed, which is also what impostor frames are baked from
// Conventions (characters.js): group origin at the feet, facing +z, the figure's left is +x; phase 0..2 pi with the
// left foot's stance centred on pi (left leg forward while sin(phase) > 0, as the arm swing assumes).
// Indices are those of characters.js' pose vector (checked against NP by the caller).
const P_RX = 0, P_RY = 1, P_RZ = 2, R_X = 3, R_Y = 4, R_Z = 5, PV_X = 6, PV_Y = 7, PV_Z = 8,
  LL_F = 23, LL_A = 24, LL_T = 25, KN_L = 26, LR_F = 27, LR_A = 28, LR_T = 29, KN_R = 30, FT_L = 31, FT_R = 32;
export const GAIT_NP = 33;
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => (a > PI ? a - TAU * Math.ceil((a - PI) / TAU) : a < -PI ? a + TAU * Math.ceil((-PI - a) / TAU) : a);

const EXT = 0.9965;          // how straight a standing / reaching leg gets (the knee keeps ~9 degrees)
const TOE_OUT = 0.07;
const TURN_CYCLE = 1.7;      // radians of turning on the spot per full cycle (two steps)
const TWIST = 0.55;          // a planted foot turned further than this against the body swivels on its ball
const TH_MAX = 1.1;          // the most a heel rises before the toe leaves the ground
const HOP = 0.2;             // seconds off the ground in the hop of a spin on the spot
const LAND = 0.88;           // share of a swing after which the foot is over its landing spot and only comes down

// the stride for a speed: scratch, refilled by tune()
const Q = { S: 1, C: 0.5, beta: 0.6, r: 0, go: 0, fr: 0.33, lift: 0.04, ths: 0.2, tho: 0.3, wd: 0.08, D: null, v: -1, tf: 0, tl: 0 };
const ST = Math.sin(TOE_OUT), CT = Math.cos(TOE_OUT), S_TM = Math.sin(TH_MAX), C_TM = Math.cos(TH_MAX);
/**
 * Stride for a figure of leg scale ls moving at v m/s in the body-frame direction (tf forward, tl to its left; unit).
 * S: metres per full cycle; C: metres the body travels over one planted foot; beta = C / S (share of the cycle a foot
 * is down: > 0.5 walking = double support, < 0.5 running = flight).
 */
function tune(D, v, tf, tl) {
  if (D === Q.D && v === Q.v && tf === Q.tf && tl === Q.tl) return;       // (the same figure and movement as last asked: once per update)
  Q.D = D; Q.v = v; Q.tf = tf; Q.tl = tl;
  const ls = D.s, vn = v / Math.sqrt(ls), w = vn > 2.6 ? 2.6 : vn;
  const r = sm(2.0, 2.9, vn);
  const walkS = 0.5 + 0.78 * w - 0.07 * w * w, runS = 1.0 + 0.44 * vn;
  // backing and side-stepping take shorter steps
  const bf = tf >= 0 ? tf : 0.7 * tf, kd = Math.sqrt(bf * bf + 0.3 * tl * tl);
  const S = ls * (walkS + (runS - walkS) * r) * (kd < 0.5 ? 0.5 : kd);
  // ground covered over one planted foot: 60 % of a walking stride, as far as a leg reaches; a runner's foot is down for less
  // (0.3 s at a jog, 0.17 s at a sprint)
  const cw = Math.min(0.6 * S, ls * (0.86 + 0.12 * sm(1.4, 2.2, vn))), cr = ls * Math.min(0.95, 0.58 + 0.076 * vn);
  const C = cw + (cr - cw) * r;
  Q.S = S; Q.C = C; Q.beta = C / S; Q.r = r;
  Q.go = sm(0.06, 0.35, v);
  Q.fr = 0.34 - 0.04 * r;
  Q.lift = ls * (0.05 + 0.02 * Q.go + 0.2 * r);
  Q.ths = (0.2 - 0.14 * r) * Q.go; Q.tho = (0.3 + 0.3 * r) * Q.go;
  Q.wd = D.hipX * (1 - 0.4 * r) + 0.004;
}

// a foot (lx, lz, lw: where it was last put while in the air): on = planted at (px, pz) heading pw [the ankle's point on the ground with the sole flat; parent's frame],
// ap = its sole pitch as last solved; in the air: left the ground at cycle position uL from ankle pose s*, pre = already
// over its landing spot (px, pz, pw); pu = cycle position at the last update; err = how far from rest when standing
const mkFoot = () => ({ on: false, pre: false, force: false, hop: false, lx: 0, lz: 0, lw: 0, px: 0, pz: 0, pw: 0, ps: 0, pc: 1, my: NaN, ms: 0, mc: 1, ap: 0, sx: 0, sy: 0, sz: 0, sw: 0, sp: 0, uL: 0.6, pu: 0, err: 0 });
const mkState = () => ({ has: false, live: false, reset: true, tread: false, moved: false, rest: false, acc: 0, treadT: 0, stillT: 0, dwell: 0, hopT: 0, x: 0, z: 0, h: 0, gy: 0,
  vf: 0, vl: 0, v: 0, wz: 0, tf: 1, tl: 0, hk: NaN, sh: 0, ch: 1, F: [mkFoot(), mkFoot()] });

// ankle pose for a sole whose flat-on-the-ground ankle point is (Px, Pz), heading yaw (sine sy, cosine cy), pitched th (+ = toe down, on
// the toe; - = toe up, on the heel): the pivot point of the sole stays where it is. Result in _a (x, y above ground, z).
const _a = { x: 0, y: 0, z: 0 };
let _tk = 0, _ts = 0, _tc = 1;       // the last pitch asked for and its sine and cosine (a steady walk asks for the same ones over and over)
function ankleSC(D, Px, Pz, sy, cy, th) {
  const a = D.ankle;
  if (th === 0) { _a.x = Px; _a.y = a; _a.z = Pz; return; }
  if (th !== _tk) { _tk = th; _ts = Math.sin(th); _tc = Math.cos(th); }
  const zp = (th > 0 ? 0.206 : -0.082) * D.s, off = zp - zp * _tc + a * _ts;
  _a.y = a * _tc + zp * _ts; _a.x = Px + sy * off; _a.z = Pz + cy * off;
}
/** sole pitch through a stance (w 0..1): toe up at heel strike, flat, the heel starting to rise (the rest of the heel
 *  rise is whatever the leg needs to reach: gaitSolve) */
function pitchAt(w) {
  if (w < 0.16) { const t = 1 - w / 0.16; return -Q.ths * t * t; }
  if (w > 0.6) { const t = (w - 0.6) * 2.5; return Q.tho * t * t; }
  return 0;
}
/** where foot k (0 left, 1 right) lands now, `into` of a stance already gone and `rem` metres of travel still to come: _l (x, z, yaw) in the parent's frame */
const _l = { x: 0, z: 0, w: 0, s: 0, c: 1 };
const _m = new Float64Array(5);
function landing(g, k, into, rem) {
  const sg = k ? -1 : 1, lead = clamp(g.wz * 0.22, -0.4, 0.4) * (1 - Q.go * 0.6), s0 = g.sh, c0 = g.ch;
  let sn = s0, cs = c0;
  if (lead !== 0) { const l2 = lead * lead, cl = 1 - l2 * (0.5 - l2 / 24), sl = lead * (1 - l2 * (1 / 6 - l2 / 120)); sn = s0 * cl + c0 * sl; cs = c0 * cl - s0 * sl; }      // (|lead| <= 0.4: the series is exact to 1e-6)
  const along = (Q.fr - into) * Q.C * Q.go + rem;
  const dx = s0 * g.tf + c0 * g.tl, dz = c0 * g.tf - s0 * g.tl;        // the way the body is going (parent frame)
  _l.x = g.x + cs * sg * Q.wd + dx * along; _l.z = g.z - sn * sg * Q.wd + dz * along; _l.w = g.h + lead + sg * TOE_OUT;
  _l.s = sn * CT + sg * cs * ST; _l.c = cs * CT - sg * sn * ST;        // sine and cosine of that heading
}
/** height of a swinging foot above its line (t 0..1): up quickly, over the ground until it is above its landing spot
 *  (never skimming it while still travelling), then straight down */
const B_LAND = Math.sin(PI * Math.sqrt(LAND));
function swingUp(t) {
  if (t >= LAND) { const h = Q.lift * B_LAND; return (h > 0.028 ? h : 0.028) * (1 - t) / (1 - LAND); }
  const h = Q.lift * Math.sin(PI * Math.sqrt(t));
  return t > 0.3 && h < 0.028 ? 0.028 : h;
}
const cyc = (phase, k, beta) => { let u = (phase - PI + PI * beta) / TAU + (k ? 0.5 : 0); u -= Math.floor(u); return u; };
const liftPhase = (k, beta) => (k ? PI * beta : PI + PI * beta) + 1e-3;
function liftFoot(D, f, u) {
  ankleSC(D, f.px, f.pz, f.ps, f.pc, f.ap);
  f.on = false; f.pre = false; f.force = false; f.hop = false; f.sx = f.lx = _a.x; f.sy = _a.y; f.sz = f.lz = _a.z; f.sw = f.lw = f.pw; f.sp = f.ap; f.uL = u > 0.93 ? 0.93 : u;
}

/** targets of the solve, in the GROUP's frame, per foot: 0 x, 1 z, 2 yaw, 3 pitch, 4 y, 5 weight of its reach on the
 *  pelvis height, 6 planted (x, z = the sole's flat ankle point, y unused) or not (x, y, z = the ankle); planted: 7, 8
 *  the sine and cosine of the yaw */
const T = new Float64Array(18);
let T_g = null;

/**
 * Once per Character.update(), before the pose: follow the group's real movement, advance the phase by the distance,
 * plant and lift the feet. `passed` is the speed the caller gave (only used when the figure has never really moved).
 * Returns the speed the walk should be styled for (measured, or the passed one on a treadmill), or -1 when the gait is
 * not in charge (not a walking pose, or the first update).
 */
export function gaitAdvance(c, dt, passed) {
  let g = c._g; if (!g) g = c._g = mkState();
  if (!c._lk) { g.has = false; g.live = false; return -1; }
  const grp = c.group, P = grp.position, gx = P.x, gz = P.z, gy = grp.rotation.y, gh = gy + c.cur[R_Y];
  if (!(dt > 0) && g.has) return g.live ? g.v : -1;            // a frame of no time (paused): nothing has moved
  if (gh !== g.hk) { g.hk = gh; g.sh = Math.sin(gh); g.ch = Math.cos(gh); }
  if (!g.has || !(dt > 0)) { g.x = gx; g.z = gz; g.h = gh; g.gy = gy; g.has = true; g.reset = true; g.vf = g.vl = g.v = g.wz = 0; g.stillT = 0; g.dwell = 0; g.rest = false; g.live = false; return -1; }
  let dx = gx - g.x, dz = gz - g.z, dh = wrap(gh - g.h);
  const ox = g.x, oz = g.z;
  g.x = gx; g.z = gz; g.h = gh; g.gy = gy;
  let d2 = dx * dx + dz * dz;
  const far = 0.06 + 10 * dt;          // faster than anybody runs: put somewhere else, not a stride
  if (d2 > far * far || dh > 2.6 || dh < -2.6) { g.reset = true; dx = dz = d2 = 0; dh = 0; }
  const F0 = g.F[0], F1 = g.F[1], D = c.dims;
  const inv = 1 / dt, sn = g.sh, cs = g.ch, kk = Math.min(1, dt * 10);
  g.vf += ((dx * sn + dz * cs) * inv - g.vf) * kk; g.vl += ((dx * cs - dz * sn) * inv - g.vl) * kk; g.wz += (dh * inv - g.wz) * kk;
  if (c.skid && !g.reset) { carry(g, ox, oz, gx, gz, dh); dx = dz = d2 = 0; dh = 0; }      // sliding on purpose: the feet go with the body (the speed is still followed, for the stride it comes out of the slide with)
  const dist = Math.sqrt(d2);
  const v = (g.v = Math.sqrt(g.vf * g.vf + g.vl * g.vl));
  if (v > 0.03) { g.tf = g.vf / v; g.tl = g.vl / v; }
  // told a speed but never moved: walk on the spot at that speed
  if (!g.moved) {
    g.acc += dist; if (g.acc > 0.25) g.moved = true;
    const ap = passed < 0 ? -passed : passed;
    if (ap > 0.3 && dist * inv < 0.05) g.treadT += dt; else g.treadT = 0;
    if (g.treadT > 0.2) {
      tune(D, ap, 1, 0);
      // (a negative speed: stepping backwards on the spot, shorter steps)
      c.phase = (((c.phase + TAU * (passed < 0 ? -1.25 * ap : ap) * dt / Q.S) % TAU) + TAU) % TAU; g.live = false; g.reset = true;
      if (!g.tread) { g.tread = true; c.group.userData.tread = true; }
      return ap;
    }
  }
  if (g.tread) { g.tread = false; c.group.userData.tread = false; }
  tune(D, v, g.tf, g.tl);
  const beta = Q.beta;
  let dph = TAU * dist / Q.S;
  const adh = dh < 0 ? -dh : dh;
  const spin = adh * inv > 4.5;       // spun round faster than anyone steps: a hop, both feet off the ground and down again facing the new way
  if (adh > 0 && v < 1 && !spin) dph += TAU * adh / TURN_CYCLE * (1 - sm(0.3, 1, v));
  let phase = c.phase;
  if (dist > 0.6 * Q.C || dph > 2.2) g.reset = true;             // a long gap between updates: re-seat the feet on the stride
  if (g.reset) { c.phase = (phase + dph) % TAU; g.live = true; g.rest = false; g.hopT = 0; return v; }       // (seated by gaitTargets)
  if (spin && beta > 0.5) {
    // both feet leave the ground where they are and come down together under the hips, facing the new way, a moment
    // after the spin is over
    for (let k = 0; k < 2; k++) { const f = g.F[k]; if (f.on || !f.hop) { if (f.on) liftFoot(D, f, 0); else { f.sx = f.lx; f.sz = f.lz; f.sw = f.lw; f.sy = D.ankle + 0.03; f.sp = 0; f.pre = false; } f.hop = true; } }
    g.hopT = HOP; g.rest = false;
  }
  if (g.hopT > 0) {
    g.hopT -= dt; g.stillT = 0;
    if (g.hopT > 0) { c.phase = (phase + dph) % TAU; g.live = true; return v; }
    // landed: both feet down, the phase at a moment of the stride when both are
    phase = PI * beta - 0.3;
    for (let k = 0; k < 2; k++) { const f = g.F[k]; if (!f.pre) { f.px = f.lx; f.pz = f.lz; f.pw = f.lw; f.ps = Math.sin(f.pw); f.pc = Math.cos(f.pw); } f.on = true; f.hop = false; f.pre = false; f.force = false; f.err = 0; f.ap = 0; f.pu = cyc(phase, k, beta); }
    c.phase = phase; g.live = true; return v;
  }
  const both = F0.on && F1.on;
  if (dist * inv < 0.06 && adh * inv < 0.25) {
    // standing: a foot in the air lands; then a foot left out from under the hip (or twisted) takes a closing step
    g.stillT += dt;
    if (g.stillT > 0.08) {
      if (!both) { dph += Math.min(0.5, dt * TAU * (1 - beta) / 0.3); g.dwell = 0; }
      else if ((g.dwell += dt) > 0.16 && g.stillT > 0.3) {
        if (F0.err > 1 || F1.err > 1) phase = liftPhase(F1.err > F0.err ? 1 : 0, beta); else g.rest = true;
      }
    }
  } else {
    g.stillT = 0;
    // setting off from rest: the foot that is behind (the right, if neither) leaves the ground at once
    if (g.rest && both && dist * inv > 0.12) { const b0 = F0.px * dx + F0.pz * dz, b1 = F1.px * dx + F1.pz * dz; phase = liftPhase(b0 < b1 - 0.01 ? 0 : 1, beta); }
    if (dist * inv > 0.12) g.rest = false;
  }
  phase = (phase + dph) % TAU; c.phase = phase;
  for (let k = 0; k < 2; k++) {
    const f = g.F[k], u = cyc(phase, k, beta);
    if (f.on) {
      // lifted when its share of the cycle is over; or early when out of reach (the stride was planned for another
      // speed, the body was pulled away) and the other foot is down, or this is a run
      if (u >= beta || (f.force && (g.F[1 - k].on || beta < 0.5))) liftFoot(D, f, u);
      else if (f.force) { c.phase = phase = (phase + dt * TAU * 2) % TAU; f.force = false; }
    } else if (u < f.pu - 0.25) {
      // down where it has come to (it has been over its landing spot since the end of the swing; if the swing was cut
      // short, by a spin or a long frame, it lands where it is rather than jumping to where it should have been)
      if (!f.pre) { f.px = f.lx; f.pz = f.lz; f.pw = f.lw; f.ps = Math.sin(f.pw); f.pc = Math.cos(f.pw); }
      f.on = true; f.pre = false; f.force = false; f.err = 0; f.ap = pitchAt(u / beta);
    }
    f.pu = u;
  }
  g.live = true;
  return v;
}
function carry(g, ox, oz, nx, nz, dh) {
  const cs = Math.cos(dh), sn = Math.sin(dh);
  for (let k = 0; k < 2; k++) {
    const f = g.F[k];
    let rx = f.px - ox, rz = f.pz - oz; f.px = nx + rx * cs + rz * sn; f.pz = nz - rx * sn + rz * cs; f.pw += dh;
    if (dh) { f.ps = Math.sin(f.pw); f.pc = Math.cos(f.pw); }
    rx = f.sx - ox; rz = f.sz - oz; f.sx = nx + rx * cs + rz * sn; f.sz = nz - rx * sn + rz * cs; f.sw += dh;
    rx = f.lx - ox; rz = f.lz - oz; f.lx = nx + rx * cs + rz * sn; f.lz = nz - rx * sn + rz * cs; f.lw += dh;
  }
}

/** the feet go with a body that is carried (standing on something that moves): from (ox, oz) to (nx, nz), turned dh */
export function gaitCarry(c, ox, oz, nx, nz, dh) {
  const g = c._g; if (!g || !g.has) return;
  carry(g, ox, oz, nx, nz, dh);
  g.x += nx - ox; g.z += nz - oz; g.h += dh; g.gy += dh;
}

/**
 * Where the two feet should be (into T, in the group's frame). live: from the planted / swinging feet of
 * gaitAdvance(); otherwise the canonical stride for (c.phase, c.speed).
 */
export function gaitTargets(c, live) {
  const D = c.dims, g = c._g;
  if (live && g && g.live) {
    tune(D, g.v, g.tf, g.tl);
    const beta = Q.beta, phase = c.phase, sc = c.group.scale.x || 1, same = g.gy === g.h;
    const sn = same ? g.sh : Math.sin(g.gy), cs = same ? g.ch : Math.cos(g.gy), gx = g.x, gz = g.z, zb = 0.13 * D.s;
    if (g.reset) {
      // seat the feet on the canonical stride for this phase, in the parent's frame
      g.reset = false;
      const s0 = g.sh, c0 = g.ch;
      for (let k = 0; k < 2; k++) {
        const f = g.F[k], u = cyc(phase, k, beta), sg = k ? -1 : 1;
        f.pu = u; f.pre = false; f.force = false; f.hop = false; f.err = 0;
        if (u < beta) { landing(g, k, u / beta, 0); f.on = true; f.px = _l.x; f.pz = _l.z; f.pw = _l.w; f.ps = _l.s; f.pc = _l.c; f.ap = pitchAt(u / beta); }
        else {
          // mid-swing: as if it had just left the ground where the canonical swing is at this moment
          const t = (u - beta) / (1 - beta), e = t * t * (3 - 2 * t), z0 = (Q.fr - 1) * Q.C * Q.go, z1 = Q.fr * Q.C * Q.go, lz = z0 + (z1 - z0) * e, lx = sg * Q.wd;
          f.on = false; f.uL = u > 0.93 ? 0.93 : u;
          f.sx = f.lx = gx + c0 * lx + s0 * lz; f.sz = f.lz = gz - s0 * lx + c0 * lz; f.sw = f.lw = g.h + sg * TOE_OUT; f.sp = Q.tho * (1 - t); f.sy = D.ankle;
        }
      }
    }
    for (let k = 0; k < 2; k++) {
      const f = g.F[k], u = cyc(phase, k, beta), sg = k ? -1 : 1, i = k * 9;
      let wx, wz, ww;
      if (f.on) {
        // turned too far against the body (a quick turn on the spot): the foot swivels on its ball, where it stands
        const rel = wrap(f.pw - g.h - sg * TOE_OUT);
        if (rel > TWIST || rel < -TWIST) {
          const bx = f.px + f.ps * zb, bz = f.pz + f.pc * zb;
          f.pw -= rel > 0 ? rel - TWIST : rel + TWIST; f.ps = Math.sin(f.pw); f.pc = Math.cos(f.pw); f.px = bx - f.ps * zb; f.pz = bz - f.pc * zb;
        }
        wx = f.px; wz = f.pz; ww = f.pw;
        T[i + 3] = pitchAt(u < beta ? u / beta : 1); T[i + 4] = 0; T[i + 5] = 1; T[i + 6] = 1;
      } else {
        const uL = f.uL, hop = f.hop; let t = hop ? 1 - g.hopT / HOP : (u - uL) / (1 - uL); t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (!f.pre) {
          if (hop) landing(g, k, Q.fr, 0); else landing(g, k, 0, (1 - u) * Q.S * Q.go);
          f.px = _l.x; f.pz = _l.z; f.pw = _l.w; f.ps = _l.s; f.pc = _l.c;
          if (t >= LAND || (!hop && t > 0.45 && g.stillT > 0)) f.pre = true;         // over its spot (or the body has just stopped: the step lands where it was going): from here it only comes down
        }
        ankleSC(D, f.px, f.pz, f.ps, f.pc, -Q.ths);
        let e = t / LAND; e = e >= 1 ? 1 : e * e * (3 - 2 * e);
        wx = f.sx + (_a.x - f.sx) * e; wz = f.sz + (_a.z - f.sz) * e; ww = f.sw + wrap(f.pw - f.sw) * e;
        f.lx = wx; f.lz = wz; f.lw = ww;
        T[i + 3] = f.sp + (-Q.ths - f.sp) * sm(0, 0.7, t); T[i + 4] = (f.sy + (_a.y - f.sy) * e + swingUp(t)) / sc;
        T[i + 5] = sm(0.7, 1, t); T[i + 6] = 0;
      }
      const rx = wx - gx, rz = wz - gz, lx = (rx * cs - rz * sn) / sc, lz = (rx * sn + rz * cs) / sc;
      const yl = wrap(ww - g.gy);
      T[i] = lx; T[i + 1] = lz; T[i + 2] = yl;
      if (f.on) { if (yl !== f.my) { f.my = yl; f.ms = Math.sin(yl); f.mc = Math.cos(yl); } T[i + 7] = f.ms; T[i + 8] = f.mc; }
      if (f.on) {       // how far from rest (standing): > 1 = worth a closing step
        const ex = lx - sg * Q.wd, tw = T[i + 2] - sg * TOE_OUT - (g.h - g.gy);
        f.err = Math.max(Math.sqrt(ex * ex + lz * lz) / (0.1 * D.s), Math.abs(wrap(tw)) / 0.3);
      }
    }
    T_g = g;
    return;
  }
  // canonical: a pure function of phase and speed (impostor frames, previews, treadmills, poses that only borrow the walk)
  tune(D, c.speed, 1, 0);
  const beta = Q.beta, phase = c.phase;
  for (let k = 0; k < 2; k++) {
    const u = cyc(phase, k, beta), sg = k ? -1 : 1, i = k * 9, lx = sg * Q.wd, yaw = sg * TOE_OUT;
    const z0 = (Q.fr - 1) * Q.C * Q.go, z1 = Q.fr * Q.C * Q.go;
    T[i + 2] = yaw;
    if (u < beta) {
      const w = u / beta;
      T[i] = lx; T[i + 1] = z1 + (z0 - z1) * w; T[i + 3] = pitchAt(w); T[i + 4] = 0; T[i + 5] = 1; T[i + 6] = 1; T[i + 7] = sg * ST; T[i + 8] = CT;
    } else {
      const t = (u - beta) / (1 - beta);
      let e = t / LAND; e = e >= 1 ? 1 : e * e * (3 - 2 * e);
      const th0 = Q.tho + 0.35 * Q.go;
      ankleSC(D, lx, z0, sg * ST, CT, th0); const x0 = _a.x, y0 = _a.y, za = _a.z;
      ankleSC(D, lx, z1, sg * ST, CT, -Q.ths);
      T[i] = x0 + (_a.x - x0) * e; T[i + 4] = y0 + (_a.y - y0) * e + swingUp(t); T[i + 1] = za + (_a.z - za) * e;
      T[i + 3] = th0 + (-Q.ths - th0) * sm(0, 0.7, t); T[i + 5] = sm(0.7, 1, t); T[i + 6] = 0;
    }
  }
  T_g = null;
}

/**
 * Solve the pelvis height and both legs of pose vector o for the targets of the last gaitTargets(): exact for whatever
 * rig offset / rotation and pelvis rotation o holds. `drop`: extra crouch (m). Writes P_RY, the leg and foot parameters.
 * The heel of a planted foot the hip has gone past rises as far as the leg needs to reach (about the toe, which stays
 * where it is); the pelvis only comes down for a leg that cannot reach even so. `again`: its own second go (a foot was
 * lifted in the first).
 */
export function gaitSolve(c, o, drop, again) {
  const D = c.dims, L1 = D.L1, L2 = D.L2, L = L1 + L2, hipX = D.hipX, g = T_g, ds = D.s, an = D.ankle;
  const ry = o[R_Y], rx = o[R_X], rz = o[R_Z], px = o[PV_X], py = o[PV_Y], pz = o[PV_Z];
  const sry = ry ? Math.sin(ry) : 0, cry = ry ? Math.cos(ry) : 1, srx = rx ? Math.sin(rx) : 0, crx = rx ? Math.cos(rx) : 1, srz = rz ? Math.sin(rz) : 0, crz = rz ? Math.cos(rz) : 1;
  const spx = px ? Math.sin(px) : 0, cpx = px ? Math.cos(px) : 1, spy = py ? Math.sin(py) : 0, cpy = py ? Math.cos(py) : 1, spz = pz ? Math.sin(pz) : 0, cpz = pz ? Math.cos(pz) : 1;
  // the hip joints in the group's frame with P_RY = 0: rig * (pelvis origin + pelvis rotation * (+-hipX, 0, 0))
  // pelvis rotation (XYZ) of the x axis: Rx(px) Ry(py) Rz(pz) (1,0,0)
  let ex = cpy * cpz, ey = spz, ez = -spy * cpz;                  // Ry * Rz * x  = (cy cz, sz, -sy cz)
  if (px) { const y = ey * cpx - ez * spx, z = ey * spx + ez * cpx; ey = y; ez = z; }
  // rig rotation (YXZ): Ry(ry) Rx(rx) Rz(rz) applied to the pelvis origin and to the hip offset
  let bx = 0, by = D.hipY, bz = 0, hx = ex * hipX, hy = ey * hipX, hz = ez * hipX;
  if (rz) { let a = bx * crz - by * srz, b = bx * srz + by * crz; bx = a; by = b; a = hx * crz - hy * srz; b = hx * srz + hy * crz; hx = a; hy = b; }
  if (rx) { let a = by * crx - bz * srx, b = by * srx + bz * crx; by = a; bz = b; a = hy * crx - hz * srx; b = hy * srx + hz * crx; hy = a; hz = b; }
  if (ry) { let a = bx * cry + bz * sry, b = -bx * sry + bz * cry; bx = a; bz = b; a = hx * cry + hz * sry; b = -hx * sry + hz * cry; hx = a; hz = b; }
  bx += o[P_RX]; bz += o[P_RZ];
  // pelvis height: standing height less the crouch of a run, no higher than either leg can reach
  const r = Q.r, zt = 0.206 * ds, rho = Math.sqrt(zt * zt + an * an);
  const fl = r > 0 ? 0.05 * ds * r * Math.max(0, -Math.cos(2 * c.phase)) : 0;
  const reach = EXT * L, r2 = reach * reach, yn = -(1 - EXT) * L - ds * (0.012 * Q.go + 0.045 * r) - (drop || 0) + fl;
  let y = yn;
  for (let k = 0; k < 2; k++) {
    const i = k * 9, sg = k ? -1 : 1, Hx = bx + sg * hx, Hz = bz + sg * hz, H0 = by + sg * hy;
    let ax = T[i], az = T[i + 1], ay = T[i + 4];
    if (T[i + 6] === 1) {
      // planted: the ankle for the sole's pitch, about the heel or the toe (as ankleAt)
      const th = T[i + 3], sy = T[i + 7], cy = T[i + 8];
      // the hip is past the ankle: reach is judged with the heel as high as it goes
      if (th >= 0 && (Hx - ax) * sy + (Hz - az) * cy > 0) { const off = zt - zt * C_TM + an * S_TM; ay = an * C_TM + zt * S_TM; ax += sy * off; az += cy * off; }
      else if (th === 0) ay = an;
      else { if (th !== _tk) { _tk = th; _ts = Math.sin(th); _tc = Math.cos(th); } const zp = (th > 0 ? 0.206 : -0.082) * ds, off = zp - zp * _tc + an * _ts; ay = an * _tc + zp * _ts; ax += sy * off; az += cy * off; }
    }
    const ddx = Hx - ax, ddz = Hz - az;
    let h2 = ddx * ddx + ddz * ddz;
    if (h2 > 0.52 * r2) { if (g && g.F[k].on) g.F[k].force = true; if (h2 > 0.72 * r2) h2 = 0.72 * r2; }
    let lim = ay + Math.sqrt(r2 - h2) - H0;
    const w = T[i + 5];
    if (w < 1) lim = yn + (lim - yn) * w + (1 - w) * 0.2;       // a swinging foot only pulls the pelvis down as it lands
    if (lim < y) y = lim;
  }
  o[P_RY] = y;
  for (let k = 0; k < 2; k++) {
    const i = k * 9, sg = k ? -1 : 1;
    let x = T[i], z = T[i + 1], yy = T[i + 4], th = T[i + 3], s2 = 0, c2 = 1, got = false;
    if (T[i + 6] === 1) {
      const sy = T[i + 7], cy = T[i + 8], Hx = bx + sg * hx, Hz = bz + sg * hz, Hy = by + sg * hy + y;
      if (th >= 0) {
        // heel rise: as far as the leg needs, about the toe. Ankle = toe + rho (-cos psi dir + sin psi up), psi = th + psi0
        const tx = x + sy * zt, tz = z + cy * zt, q = (Hx - tx) * sy + (Hz - tz) * cy;
        const fx = Hx - x, fz = Hz - z, fy = Hy - an;
        if (fx * sy + fz * cy > 0 && fx * fx + fy * fy + fz * fz > r2) {
          const dx = Hx - tx, dz = Hz - tz, D2 = dx * dx + dz * dz + Hy * Hy, m = (D2 + rho * rho - r2) / (2 * rho), R = Math.sqrt(q * q + Hy * Hy);
          const need = (m >= R ? PI / 2 : Math.asin(m / R)) + Math.atan2(q, Hy) - Math.atan2(an, zt);
          if (need > th) th = need > TH_MAX ? TH_MAX : need;
        }
      }
      if (g) g.F[k].ap = th;
      got = true;
      if (th === 0) yy = an;
      else { if (th !== _tk) { _tk = th; _ts = Math.sin(th); _tc = Math.cos(th); } s2 = _ts; c2 = _tc; const zp = (th > 0 ? 0.206 : -0.082) * ds, off = zp - zp * c2 + an * s2; yy = an * c2 + zp * s2; x += sy * off; z += cy * off; }
    }
    // the ankle in the pelvis' frame, relative to the hip joint (mirrored for the right leg)
    x -= o[P_RX]; yy -= y; z -= o[P_RZ];
    if (ry) { const a = x * cry - z * sry, b = x * sry + z * cry; x = a; z = b; }
    if (rx) { const a = yy * crx + z * srx, b = -yy * srx + z * crx; yy = a; z = b; }
    if (rz) { const a = x * crz + yy * srz, b = -x * srz + yy * crz; x = a; yy = b; }
    yy -= D.hipY;
    if (px) { const a = yy * cpx + z * spx, b = -yy * spx + z * cpx; yy = a; z = b; }
    if (py) { const a = x * cpy - z * spy, b = x * spy + z * cpy; x = a; z = b; }
    if (pz) { const a = x * cpz + yy * spz, b = -x * spz + yy * cpz; x = a; yy = b; }
    x = (x - sg * hipX) * sg;
    let d = Math.sqrt(x * x + yy * yy + z * z);
    const dmax = L * 0.9995, dmin = Math.abs(L1 - L2) + 0.05;
    if (d > dmax) { const s = dmax / d; x *= s; yy *= s; z *= s; d = dmax; } else if (d < dmin) { const s = dmin / (d || 1); x *= s; yy *= s; z *= s; d = dmin; }
    let ck = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1), K = PI - Math.acos(ck), cK = -ck, sK = Math.sqrt(1 - ck * ck);
    let vy = -L1 - L2 * cK, vz = -L2 * sK;
    // thigh: twisted the way the foot points (as far as a hip turns), splayed and swung to put the ankle on its target
    const tw = clamp(wrap((T[i + 2] - ry - py) * sg), -0.75, 0.75), st = Math.sin(tw), ct = Math.cos(tw);
    let sA = (vz * st - x) / (vy * ct);
    if (sA > 0.85 || sA < -0.85) {
      // The foot is further out to the side than a hip splays: a runner has turned hard over a planted foot (a jogger
      // at a corner, or going round somebody). The leg cannot put the ankle there; it used to keep its length and
      // swing down instead, and the sole went under the ground (7 cm at a jog, 18 at a sprint) until the foot was
      // lifted a frame or more later. Now a planted foot leaves the ground at once (when the other is down, or at a
      // run: as for a foot out of reach, gaitAdvance), and the frame is solved again with it in the air ...
      if (g && !again && T[i + 6] === 1 && g.F[k].on && (g.F[1 - k].on || Q.beta < 0.5)) {
        liftFoot(D, g.F[k], cyc(c.phase, k, Q.beta)); gaitTargets(c, true);
        return gaitSolve(c, o, drop, true);
      }
      // ... and a leg that still cannot splay far enough (in the air, or the only foot down at a walk) bends its knee
      // until the ankle is at the height and the distance fore and aft that were asked for: it falls short sideways
      // only, never downwards.
      sA = sA > 0 ? 0.85 : -0.85;
      // (the leg's length for that: the root of  d^2 = xa(d)^2 + yy^2 + z^2, xa = how far out the splayed leg of length d
      //  comes; between the distance in the fore-and-aft plane alone and the length asked for; found by halving)
      const m2 = yy * yy + z * z;
      let lo = Math.sqrt(m2), hi = d; if (lo < dmin) lo = dmin;
      for (let it = 0; it < 14; it++) {
        d = it === 13 ? hi : (lo + hi) * 0.5;       // (ends on the long side: the ankle a hair high, never low)
        ck = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1); K = PI - Math.acos(ck); cK = -ck; sK = Math.sqrt(1 - ck * ck); vy = -L1 - L2 * cK; vz = -L2 * sK;
        if (it === 13) break;
        const xa = vz * st - sA * vy * ct;
        if (xa * xa + m2 > d * d) lo = d; else hi = d;
      }
    }
    const A = Math.asin(sA), cA = Math.sqrt(1 - sA * sA);
    // swing: the angle (about x) from where the ankle is to where the leg so far would put it
    const wy = vy * cA, wz = vy * sA * st + vz * ct, cr = yy * wz - z * wy, dt2 = yy * wy + z * wz, F = Math.atan2(cr, dt2);
    // the foot: the sole must not turn, rock or roll on the ground, so its three angles on the shin are exactly those
    // that leave it heading T[i + 2] and pitched th in the group's frame, whatever the rig, pelvis and leg are doing:
    // foot = (rig * pelvis * thigh * knee)^-1 * Ry(heading) Rx(th), column by column (mirrored for the right leg)
    let fa, fb = 0, fc = 0;
    if (T[i + 6] === 1 || tw > 0.12 || tw < -0.12 || sA > 0.14 || sA < -0.14 || rz || rx) {
      let s1, c1;
      if (got) { s1 = T[i + 7] * sg; c1 = T[i + 8]; } else { const yw = T[i + 2] * sg; s1 = Math.sin(yw); c1 = Math.cos(yw); if (th !== 0) { s2 = Math.sin(th); c2 = Math.cos(th); } }
      const nF = 1 / (Math.sqrt(cr * cr + dt2 * dt2) || 1), sF = cr * nF, cF = dt2 * nF;
      const sqy = sry * sg, sqz = srz * sg, tpy = spy * sg, tpz = spz * sg;
      for (let j = 0; j < 3; j++) {
        // column j of Ry(yw) Rx(th)
        let vx0 = j === 0 ? c1 : j === 1 ? s1 * s2 : s1 * c2, vy0 = j === 0 ? 0 : j === 1 ? c2 : -s2, vz0 = j === 0 ? -s1 : j === 1 ? c1 * s2 : c1 * c2;
        if (ry) { const a = vx0 * cry - vz0 * sqy, b = vx0 * sqy + vz0 * cry; vx0 = a; vz0 = b; }
        if (rx) { const a = vy0 * crx + vz0 * srx, b = -vy0 * srx + vz0 * crx; vy0 = a; vz0 = b; }
        if (rz) { const a = vx0 * crz + vy0 * sqz, b = -vx0 * sqz + vy0 * crz; vx0 = a; vy0 = b; }
        if (px) { const a = vy0 * cpx + vz0 * spx, b = -vy0 * spx + vz0 * cpx; vy0 = a; vz0 = b; }
        if (py) { const a = vx0 * cpy - vz0 * tpy, b = vx0 * tpy + vz0 * cpy; vx0 = a; vz0 = b; }
        if (pz) { const a = vx0 * cpz + vy0 * tpz, b = -vx0 * tpz + vy0 * cpz; vx0 = a; vy0 = b; }
        // thigh^-1 = Rz(-A) Ry(-tw) Rx(F), then the knee^-1 = Rx(-K)
        { const a = vy0 * cF - vz0 * sF, b = vy0 * sF + vz0 * cF; vy0 = a; vz0 = b; }
        { const a = vx0 * ct - vz0 * st, b = vx0 * st + vz0 * ct; vx0 = a; vz0 = b; }
        { const a = vx0 * cA + vy0 * sA, b = -vx0 * sA + vy0 * cA; vx0 = a; vy0 = b; }
        { const a = vy0 * cK + vz0 * sK, b = -vy0 * sK + vz0 * cK; vy0 = a; vz0 = b; }
        if (j === 0) _m[0] = vx0; else if (j === 1) _m[1] = vx0; else { _m[2] = vx0; _m[3] = vy0; _m[4] = vz0; }
      }
      // Euler XYZ of that matrix: m02 = sin b, a = atan2(-m12, m22), c = atan2(-m01, m00)
      fa = Math.atan2(-_m[3], _m[4]); fb = Math.asin(_m[2] > 1 ? 1 : _m[2] < -1 ? -1 : _m[2]); fc = Math.atan2(-_m[1], _m[0]);
    } else fa = th + F - K - px;         // (a foot in the air on a leg that is square to the body: the plain pitch will do)
    const X = c._fx;
    if (k) { o[LR_F] = F; o[LR_A] = A; o[LR_T] = tw; o[KN_R] = K; o[FT_R] = fa; X[2] = -fb; X[3] = -fc; } else { o[LL_F] = F; o[LL_A] = A; o[LL_T] = tw; o[KN_L] = K; o[FT_L] = fa; X[0] = fb; X[1] = fc; }
  }
  c._pl = NaN;
}
