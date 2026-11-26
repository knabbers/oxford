// Glider flight model — pure (no three.js, no DOM): unit-testable in node (tools/smoke_gliding.mjs).
//
// A rigid body with a real aerodynamic polar, forgiving handling and gentle limits:
//   * forces: lift from a lift curve with a stall break (CL rises ~5.6/rad to CLmax ≈ 1.29 at ~10°, then falls towards
//     a flat-plate curve), drag = CD0 + k·CL² (induced, cut by ground effect) + post-stall drag + sideslip drag +
//     airbrakes, a sideforce against slip, gravity, the winch cable when hooked on, wheel / skid contact on the ground.
//     The numbers give the ASK 21's published polar: best glide ≈ 34 : 1 at ≈ 90 km/h, minimum sink ≈ 0.64 m/s at
//     ≈ 68 km/h, stall ≈ 65 km/h (solo, 470 kg).
//   * moments are written as angular accelerations scaled by dynamic pressure (control authority grows with airspeed):
//     the elevator commands an angle of attack about the trimmed one (static stability: hands off, the glider settles
//     at the trim speed — default best glide) with pitch damping and a little phugoid damping; ailerons command a roll
//     rate that grows with airspeed, with roll damping, dihedral (roll away from slip) and light adverse yaw; the fin
//     weathercocks into the relative wind; an auto-rudder keeps turns coordinated (manual rudder adds on top).
//   * forgiving layers for a keyboard (each one is something a pilot's hands do without thinking; each gives way to
//     the stick): the turn assist; the trim follows the airbrakes (they steepen the glide at the same speed); a
//     speed-change damper (C.phugoid) so a dive or a zoom let go of settles in two swings instead of a minute of
//     switchback; hands off it never pulls more than HANDS_G by itself; and with the airbrakes out, low and slow,
//     back stick flies a flare (see step)
//   * the air it meets is felt through a short lag (GUST_TAU: a 17 m wing does not meet a gust all at once), so the edge
//     of a thermal or the lift off a roof is a surge, never a step
//   * the main wheel is sprung and damped (WHEEL): a touchdown is taken up over a few centimetres instead of the sink
//     rate vanishing in one step; at rest it sits at wheelH exactly
//   * every step keeps the pose it started from (px..pq): renderPose(s, a, out) gives the pose a fraction a of a step on,
//     so the picture moves evenly whatever the frame rate (the caller steps at a fixed rate and draws in between)
//   * stall: past the critical angle the nose drops by itself, the wing buffets, a wing may drop (towards the slip);
//     let the stick go forward and it flies again. No spin model.
// Frames: world x east, y up, z south. Body axes: X = left wing, Y = up, Z = nose (right-handed: X × Y = Z).
// Rates: p roll (+ = right wing down), q pitch (+ = nose up), r yaw (+ = nose right).
// Units SI. Everything is allocation-free per step.

export const GLIDER = {
  mass: 470,             // kg (ASK 21 empty 360 kg + one pilot and parachute; 600 kg max)
  S: 17.95,              // wing area m²
  span: 17.0,            // m
  AR: 16.1,
  CLa: 5.6,              // lift slope /rad (3D wing)
  a0: -0.052,            // zero-lift angle of attack (rad, ≈ −3°: cambered section)
  CLmax: 1.29,           // → stall ≈ 18 m/s (65 km/h) at 470 kg
  CD0: 0.00987,          // parasitic (fitted with k to L/D 34 at 25 m/s)
  k: 0.02192,            // induced factor 1/(π e AR), e ≈ 0.90
  abCD: 0.072,           // full airbrakes: extra drag (glide ≈ 7 : 1 at 100 km/h)
  abCL: 0.12,            // ...and lost lift
  rho: 1.225,
  wheelH: 0.62,          // CG height above the ground when sitting on the main wheel
  vne: 77.8,             // 280 km/h
};
const G = 9.81;
export const D2R = Math.PI / 180;
export const HANDS_G = 2.6;                  // the most the glider pulls by itself, hands off (g)
export const GUST_TAU = 0.22;                // s: how quickly the glider feels a change in the air
// main wheel: static sag 8 cm (so the spring rate is m g / sag), damping ratio ~0.7, the damper fully in by 6 cm of
// travel (a tyre first), 32 cm of travel before the fuselage is on the ground. REST_ROLL: the bank it sits at when
// slow or stopped, one wing tip on the grass (the parked gliders are drawn at the same angle).
export const WHEEL = { sag: 0.08, zeta: 0.7, soft: 0.06, travel: 0.32 };
export const REST_ROLL = 8.2 * D2R;
const QREF = 0.5 * 1.225 * 25 * 25;          // dynamic pressure at 90 km/h: the reference for control authority
const VREF = 25;

export const CTRL = {
  pitchUp: 9.5 * D2R,     // full back stick: +α above trim (enough to stall)
  pitchDown: 8 * D2R,     // full forward stick
  Ka: 44, Dq: 7.5,        // α restoring stiffness / pitch damping
  rollRate: 32 * D2R,     // full-aileron steady roll rate at 90 km/h (≈ 45°→45° reversal in ~3 s; ASK 21 ~4 s)
  Lp: 4.2,                // roll damping (1/s at VREF)
  Lb: 1.4,                // dihedral: roll per rad of slip
  Nb: 3.2,                // weathercock
  Nr: 2.6,                // yaw damping
  Nda: 0.45,              // adverse yaw from aileron (rad/s² at full aileron, QREF)
  Kr: 1.6,                // rudder authority
  autoRudder: 2.4,        // auto-rudder gain on slip (+ aileron feed-forward)
  phugoid: 1.4,           // speed-change pitch damping (rad of α per unit relative speed change; up to ±5°). A pilot damps the
                          // long speed / height swing without thinking; hands off on keys the glider has to (at 0.35 / ±1.5° a
                          // dive let go of porpoised between 30 and 155 km/h for a minute; now it is over in two swings)
};

export const stallSpeed = (mass = GLIDER.mass) => Math.sqrt((2 * mass * G) / (GLIDER.rho * GLIDER.S * GLIDER.CLmax));
/** α (rad) that gives level-glide lift at airspeed v */
export function alphaFor(v, mass = GLIDER.mass) {
  const cl = (mass * G) / (0.5 * GLIDER.rho * v * v * GLIDER.S);
  return GLIDER.a0 + cl / GLIDER.CLa;
}
const sstep = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
export const ALPHA_STALL = GLIDER.a0 + GLIDER.CLmax / GLIDER.CLa;

/** lift coefficient with the stall break (both signs); out.s = how stalled (0..1). Past the critical angle the lift
 *  falls away gently (to ~0.7 CLmax ten degrees on), then towards a flat plate — a mush rather than a cliff. */
export function liftCoef(a, ab = 0, out = null) {
  // (airbrakes spoil lift at every angle: the same critical angle, a lower CLmax — the curve stays continuous there)
  const cm = GLIDER.CLmax - ab * GLIDER.abCL, as = GLIDER.a0 + GLIDER.CLmax / GLIDER.CLa, an = -10 * D2R;
  const lin = GLIDER.CLa * (a - GLIDER.a0) - ab * GLIDER.abCL;
  let cl = lin, s = 0;
  if (a > as) {
    const post = cm * (1 - 0.3 * sstep(as, as + 10 * D2R, a)), flat = 1.05 * Math.sin(2 * a);
    cl = post + (flat - post) * sstep(as + 12 * D2R, as + 30 * D2R, a);
    s = sstep(as - 0.4 * D2R, as + 3 * D2R, a);
  } else if (a < an) {
    const cn = GLIDER.CLa * (an - GLIDER.a0), post = cn * (1 - 0.3 * sstep(-an, -an + 10 * D2R, -a)), flat = 1.05 * Math.sin(2 * a);
    cl = post + (flat - post) * sstep(-an + 12 * D2R, -an + 30 * D2R, -a);
    s = sstep(-an - 0.4 * D2R, -an + 3 * D2R, -a);
  } else if (a > as - 0.4 * D2R) s = sstep(as - 0.4 * D2R, as + 3 * D2R, a);
  if (out) out.s = s;
  return cl;
}
/** steady-glide polar point at airspeed v (no wind, wings level): {sink m/s, ld, alpha} — analytic check of the model */
export function polarPoint(v, ab = 0, mass = GLIDER.mass) {
  // solve for α giving lift = W cosγ with drag-determined γ (iterate: γ small)
  let gam = 0.03;
  let a = 0, cl = 0, cd = 0;
  for (let i = 0; i < 30; i++) {
    const want = (mass * G * Math.cos(gam)) / (0.5 * GLIDER.rho * v * v * GLIDER.S);
    // invert the linear part (unstalled)
    a = GLIDER.a0 + (want + ab * GLIDER.abCL) / GLIDER.CLa;
    cl = want;
    cd = GLIDER.CD0 + GLIDER.k * cl * cl + ab * GLIDER.abCD;
    gam = Math.atan(cd / cl);
  }
  return { sink: v * Math.sin(gam), ld: cl / cd, alpha: a };
}

// ---------------------------------------------------------------- small quaternion / vector helpers (in place)
export function qRotate(q, x, y, z, out) {           // v' = q v q*
  const w = q[0], qx = q[1], qy = q[2], qz = q[3];
  const ix = w * x + qy * z - qz * y, iy = w * y + qz * x - qx * z, iz = w * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
  out[0] = ix * w + iw * -qx + iy * -qz - iz * -qy;
  out[1] = iy * w + iw * -qy + iz * -qx - ix * -qz;
  out[2] = iz * w + iw * -qz + ix * -qy - iy * -qx;
  return out;
}
export function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l; return q; }
/** quaternion from heading (yaw, game convention: forward = (sin h, 0, cos h)), pitch (+ nose up), roll (+ right wing down) */
export function qFromHPR(h, pitch, roll, q = [1, 0, 0, 0]) {
  // q = Ry(h) * Rx(-pitch) * Rz(roll)   (body Z = nose; rotation about −X raises the nose; about +Z rolls right)
  const cy = Math.cos(h / 2), sy = Math.sin(h / 2), cx = Math.cos(-pitch / 2), sx = Math.sin(-pitch / 2), cz = Math.cos(roll / 2), sz = Math.sin(roll / 2);
  // Ry*Rx
  const aw = cy * cx, ax = cy * sx, ay = sy * cx, az = -sy * sx;
  // (Ry*Rx)*Rz
  q[0] = aw * cz - az * sz; q[1] = ax * cz + ay * sz; q[2] = ay * cz - ax * sz; q[3] = az * cz + aw * sz;
  return q;
}
const _f = [0, 0, 0], _u = [0, 0, 0], _l = [0, 0, 0];
/** heading / pitch / roll of a body quaternion (pitch + nose up, roll + right wing down) */
export function hprOf(q, out = { h: 0, pitch: 0, roll: 0 }) {
  qRotate(q, 0, 0, 1, _f); qRotate(q, 0, 1, 0, _u); qRotate(q, 1, 0, 0, _l);
  out.h = Math.atan2(_f[0], _f[2]);
  out.pitch = Math.asin(Math.max(-1, Math.min(1, _f[1])));
  // roll: the left wing's height relative to the horizon (right wing down = left wing up = +)
  out.roll = Math.atan2(_l[1], _u[1]);
  return out;
}

// ---------------------------------------------------------------- the glider
/**
 * A new glider state. h = heading. Sitting on its wheel at (x, ground, z) unless y given.
 */
export function newGlider(x, z, h, opts = {}) {
  const s = {
    x, y: (opts.y ?? (opts.ground || 0) + GLIDER.wheelH), z, vx: 0, vy: 0, vz: 0,
    q: qFromHPR(h, opts.pitch ?? 0.02, opts.roll ?? 0), p: 0, qr: 0, r: 0,
    onGround: opts.y === undefined, mass: opts.mass ?? GLIDER.mass,
    trimV: 25, ab: 0, abCmd: 0,
    // outputs (refreshed every step)
    V: 0, alpha: 0, beta: 0, stall: 0, buffet: 0, nz: 1, gAgl: 0, te: 0, vario: 0, climb: 0, vlp: 0, h, pitch: 0, roll: 0,
    fx: 0, fy: 0, fz: 0, cable: null, ev: 0,
    wx: 0, wy: 0, wz: 0, wInit: false,                    // the air as felt (lagged)
    px: 0, py: 0, pz: 0, pq: [1, 0, 0, 0],                // the pose one step ago (renderPose)
  };
  if (opts.speed) { const v = opts.speed; s.vx = Math.sin(h) * v; s.vz = Math.cos(h) * v; s.onGround = false; s.vlp = v; }
  if (opts.pitch !== undefined || opts.roll !== undefined) s.q = qFromHPR(h, opts.pitch ?? 0, opts.roll ?? 0);
  hprOf(s.q, s);
  syncPose(s);
  // (started in flight: the step before was a step back along the velocity, so the first frames move evenly too)
  s.px -= s.vx / 120; s.pz -= s.vz / 120;
  return s;
}
/** after moving a glider by hand (a teleport, lining up on the launch line): no interpolation from where it was */
export function syncPose(s) {
  s.px = s.x; s.py = s.y; s.pz = s.z;
  const a = s.pq || (s.pq = [1, 0, 0, 0]), q = s.q; a[0] = q[0]; a[1] = q[1]; a[2] = q[2]; a[3] = q[3];
  s.wInit = false;
  return s;
}
/** the pose a fraction a (0..1) of a step after the previous one: out = {x, y, z, q[4], h, pitch, roll} */
export function renderPose(s, a, out) {
  const b = a < 0 ? 0 : a > 1 ? 1 : a;
  out.x = s.px + (s.x - s.px) * b; out.y = s.py + (s.y - s.py) * b; out.z = s.pz + (s.z - s.pz) * b;
  const q = out.q || (out.q = [1, 0, 0, 0]), p = s.pq, c = s.q;
  const sg = p[0] * c[0] + p[1] * c[1] + p[2] * c[2] + p[3] * c[3] < 0 ? -1 : 1;
  q[0] = p[0] + (sg * c[0] - p[0]) * b; q[1] = p[1] + (sg * c[1] - p[1]) * b; q[2] = p[2] + (sg * c[2] - p[2]) * b; q[3] = p[3] + (sg * c[3] - p[3]) * b;
  qNorm(q);
  hprOf(q, out);
  return out;
}

export const EV = { TOUCH: 1, LIFTOFF: 2, RELEASE: 4, STALL: 8, CRASH_GROUND: 16, BOUNCE: 32, OVERSPEED: 64 };

const _F = [0, 0, 0], _U = [0, 0, 0], _L = [0, 0, 0], _st = { s: 0 };
/**
 * Advance one step (call at a fixed small dt, e.g. 1/120 s).
 *  c   controls: {pitch -1..1 (+ = pull/nose up), roll -1..1 (+ = right), yaw -1..1 (+ = right rudder), ab 0..1, brake 0..1, autoRudder bool}
 *  env {wind(x, y, z, out[3]) -> fills air velocity (m/s, incl. vertical lift), ground(x, z) -> height, cable? {x, y, z, tension fn} }
 * Returns event bits (EV).
 */
export function step(s, c, dt, env) {
  let ev = 0;
  const g = GLIDER, m = s.mass;
  const wind = env.windOut || (env.windOut = [0, 0, 0]);
  env.wind(s.x, s.y, s.z, wind);
  // the pose this step starts from (for drawing between steps)
  s.px = s.x; s.py = s.y; s.pz = s.z; { const a = s.pq, b = s.q; a[0] = b[0]; a[1] = b[1]; a[2] = b[2]; a[3] = b[3]; }
  // the air as the glider feels it: a first-order lag (exact for any dt)
  const first = !s.wInit;
  if (first) { s.wInit = true; s.wx = wind[0]; s.wy = wind[1]; s.wz = wind[2]; }
  else { const kw = 1 - Math.exp(-dt / GUST_TAU); s.wx += (wind[0] - s.wx) * kw; s.wy += (wind[1] - s.wy) * kw; s.wz += (wind[2] - s.wz) * kw; }
  wind[0] = s.wx; wind[1] = s.wy; wind[2] = s.wz;
  // body axes in the world
  qRotate(s.q, 0, 0, 1, _F); qRotate(s.q, 0, 1, 0, _U); qRotate(s.q, 1, 0, 0, _L);
  const ax = s.vx - wind[0], ay = s.vy - wind[1], az = s.vz - wind[2];
  const V = Math.hypot(ax, ay, az) || 1e-6;
  if (first) s.vlp = V;                      // (the damper's idea of "the speed lately" starts at the airspeed it really has, wind and all)
  const vF = ax * _F[0] + ay * _F[1] + az * _F[2], vU = ax * _U[0] + ay * _U[1] + az * _U[2], vL = ax * _L[0] + ay * _L[1] + az * _L[2];
  const alpha = Math.atan2(-vU, Math.max(0.5, vF)), beta = Math.asin(Math.max(-1, Math.min(1, -vL / V)));   // β + = air moving to the right (nose left of track)
  // airbrakes move at a finite rate (≈ 1.2 s full travel)
  s.ab += Math.max(-dt / 1.2, Math.min(dt / 1.2, (c.ab || 0) - s.ab));
  const ab = s.ab;
  const qd = 0.5 * g.rho * V * V, sq = Math.min(6, qd / QREF), vr = V / VREF;
  // ground effect (induced drag only): φ = (16h/b)² / (1 + (16h/b)²)
  const gh = env.ground(s.x, s.z), agl = Math.max(0.05, s.y - gh - 0.4);
  const ge = (16 * agl / g.span) ** 2, phi = ge / (1 + ge);
  const CL = liftCoef(alpha, ab, _st), stalled = _st.s;
  const CD = g.CD0 + g.k * CL * CL * phi + 0.9 * stalled * Math.sin(alpha) ** 2 + ab * g.abCD + 0.35 * beta * beta;
  const CY = -0.55 * beta;
  const Lm = qd * g.S * CL, Dm = qd * g.S * CD, Ym = qd * g.S * CY;
  // lift ⟂ air velocity in the plane of symmetry: direction = (right × v̂a) = (−L) × v̂a = v̂a × L
  let lx = (ay * _L[2] - az * _L[1]) / V, ly = (az * _L[0] - ax * _L[2]) / V, lz = (ax * _L[1] - ay * _L[0]) / V;
  const ll = Math.hypot(lx, ly, lz) || 1; lx /= ll; ly /= ll; lz /= ll;
  let Fx = Lm * lx - Dm * ax / V - Ym * _L[0];          // sideforce along −L (= right) for Y>0
  let Fy = Lm * ly - Dm * ay / V - Ym * _L[1] - m * G;
  let Fz = Lm * lz - Dm * az / V - Ym * _L[2];
  // ---- the winch cable (hooked at the CG): tension along the cable towards the winch
  if (s.cable && env.cable) {
    const C = env.cable, dx = C.x - s.x, dy = C.y - s.y, dz = C.z - s.z, d = Math.hypot(dx, dy, dz) || 1;
    const T = C.tension(s, V, d);
    Fx += (T * dx) / d; Fy += (T * dy) / d; Fz += (T * dz) / d;
    s.cableT = T;
    // back-release: when the cable pulls more than ~70° below the horizon, or the glider is near overhead
    const below = Math.atan2(-dy, Math.hypot(dx, dz));
    s.cableAngle = below;
    // ... or the pilot has turned off the line and is flying AWAY from the winch (the hook backs off when the cable
    // pulls from behind). Without this a glider steered round during the launch stayed on the cable for good: flown
    // like a kite, sinking, "On the winch" on the HUD and no release (2026-11 play pass).
    const away = !s.onGround && s.y - C.y > 40 && s.vx * dx + s.vz * dz < 0;
    if (below > 63 * D2R || d < 60 || c.release || away) { s.cable = null; ev |= EV.RELEASE; s.cableT = 0; }
  } else s.cableT = 0;
  // ---- ground contact (main wheel under the CG, skid / tail wheel keep the attitude near level)
  let wasGround = s.onGround;
  const wheelY = gh + g.wheelH, freeY = wheelY + WHEEL.sag;      // at rest / the tyre just touching
  if (s.y < freeY) {
    if (!wasGround) {
      ev |= EV.TOUCH;
      s.touchVy = s.vy; s.touchV = V;
    }
    s.onGround = true;
    // the sprung wheel: spring on the travel, a damper that comes in over the first 3 cm (no step in the force as the
    // tyre touches), never pulling the glider down
    const comp = freeY - s.y, kS = (m * G) / WHEEL.sag, cD = 2 * WHEEL.zeta * Math.sqrt(kS * m) * Math.min(1, comp / WHEEL.soft);
    const N = Math.max(0, kS * comp - cD * s.vy);              // what the wheel carries
    Fy += N;
    // rolling resistance + wheel brake along the track, strong side friction (the wheel will not slide sideways)
    const sp = Math.hypot(s.vx, s.vz);
    if (sp > 0.02) {
      const hx = _F[0], hz = _F[2], hl = Math.hypot(hx, hz) || 1, fx = hx / hl, fz = hz / hl;
      const along = s.vx * fx + s.vz * fz, sx = s.vx - along * fx, sz = s.vz - along * fz;
      const mu = 0.04 + 0.55 * (c.brake || 0) + (sp < 6 ? 0.06 : 0);     // grass: the wing tip drags when slow
      const fr = Math.min(mu * N, (m * Math.abs(along)) / dt);
      Fx -= Math.sign(along) * fr * fx; Fz -= Math.sign(along) * fr * fz;
      const side = Math.min(1.2 * N + 2000, (m * Math.hypot(sx, sz)) / dt), sl = Math.hypot(sx, sz) || 1;
      Fx -= (side * sx) / sl; Fz -= (side * sz) / sl;
    } else if (!s.cable) { s.vx = 0; s.vz = 0; Fx = 0; Fz = 0; }
  } else {
    if (wasGround && s.y > freeY + 0.03) { s.onGround = false; ev |= EV.LIFTOFF; }
    if (s.y > freeY + 0.03) s.onGround = false;
  }
  // ---- integrate translation
  s.vx += (Fx / m) * dt; s.vy += (Fy / m) * dt; s.vz += (Fz / m) * dt;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
  // the end of the wheel's travel: the fuselage is on the ground (far harder than any landing the game lets you walk away from)
  if (s.y < freeY - WHEEL.travel) { s.y = freeY - WHEEL.travel; if (s.vy < 0) s.vy = 0; }
  s.fx = Fx; s.fy = Fy; s.fz = Fz;
  // load factor: lift along the body up axis / weight
  s.nz = (Lm * (lx * _U[0] + ly * _U[1] + lz * _U[2])) / (m * G);

  // ---- moments → angular accelerations (body rates)
  const C = CTRL;
  // elevator: commanded α about the trimmed one; the phugoid damper adds α when speed rises (high-pass of airspeed)
  s.vlp += (V - s.vlp) * Math.min(1, dt * 0.35);
  const aTrim = alphaFor(Math.max(16, s.trimV), m);
  const pc = c.pitch || 0;
  // (it is the hands-off glider's damper: it gives way as the stick is moved, so full back stick still stalls it)
  // (c.assist 0 = raw: no damper, no airbrake trim, no flare, no g cap, no turn assist; the stick is the stick)
  const AS = c.assist ?? 1;
  const phg = AS * (1 - Math.min(1, Math.abs(pc))) * Math.max(-5 * D2R, Math.min(5 * D2R, C.phugoid * (V - s.vlp) / Math.max(10, s.vlp)));
  // (the trim follows the airbrakes: the lift they spoil is made up with angle of attack, so opening them steepens the
  // glide at the SAME speed instead of dropping the glider until it has dived for more — a pilot does this with the
  // stick without thinking; on keys nobody can)
  // the round-out (forgiving, for digital keys; c.flareAssist 0 = off): with the airbrakes out, low and slow, back stick
  // flies a flare instead of a zoom — it has its say only while the glider is sinking faster than a rate that shrinks
  // with the height left (0.25 m/s + 0.4 per metre: ~3.5 m/s at 8 m, 0.5 m/s at the grass), and it cannot quite reach
  // the stalling angle. So S held from anywhere on short final rounds out when the ground arrives and holds off, where
  // full back stick used to balloon, stall and drop it in. Brakes shut, or above ~110 km/h or ~20 m, the stick is the stick.
  const aglF = s.y - gh - g.wheelH;
  const fa = (c.flareAssist ?? AS) * (s.onGround ? 0 : ab * (1 - sstep(12, 20, aglF)) * (1 - sstep(25, 31, V)));
  const vT = -(0.25 + 0.4 * Math.max(0, aglF));
  const up = pc > 0 ? pc * C.pitchUp * (1 - fa * sstep(vT - 0.5, vT + 0.5, s.vy)) : pc * C.pitchDown;
  // hands off, the glider never pulls more than HANDS_G by itself: let go at 160 km/h trimmed for 90 and a fixed trim
  // angle would be 3.5 g, a zoom to the stall and a minute of switchback — instead it eases out of the dive (the stick
  // adds on top of this as it always did)
  let aOff = aTrim + phg + AS * (ab * GLIDER.abCL) / GLIDER.CLa;
  const aG = GLIDER.a0 + ((HANDS_G * m * G) / (qd * g.S) + ab * GLIDER.abCL) / GLIDER.CLa;
  if (AS && aOff > aG) aOff += (aG - aOff) * (1 - Math.min(1, Math.abs(pc)));     // (it too gives way to the stick, either way)
  let aCmd = aOff + up;
  // turn assist (forgiving, for digital keys): most of the extra angle of attack a banked turn needs (n = 1/cos φ) is
  // added for you, so a hands-off turn holds its speed instead of winding into a spiral dive. c.turnAssist 0 = off.
  const ta = c.turnAssist ?? AS, cphi = Math.max(0.5, Math.cos(s.roll));
  if (ta && !s.onGround) aCmd += ta * (1 / cphi - 1) * (aTrim - GLIDER.a0);
  aCmd = Math.min(aCmd, ALPHA_STALL + (3.5 - 5 * fa) * D2R);
  const auth = sq;                                     // elevator & stability authority ∝ dynamic pressure
  let qdot = auth * C.Ka * (aCmd - alpha) - Math.sqrt(sq) * C.Dq * s.qr;
  // stalled: the nose drops by itself (CG ahead of the wing's centre of pressure, elevator less effective)
  qdot -= auth * C.Ka * stalled * 5 * D2R;
  // aileron / dihedral / roll damping; a stalled wing drops (towards the slip, else the right)
  const rc = c.roll || 0;
  let pdot = sq * C.Lp * C.rollRate * rc * (1 - 0.6 * stalled) - vr * C.Lp * s.p - sq * C.Lb * beta * 2.0;
  pdot += sq * stalled * Math.max(-1, Math.min(1, (beta + 0.004) / 0.02)) * 1.6 * (0.5 + 0.5 * Math.sin(s.x * 0.1 + s.z * 0.07));   // (towards the slip, eased through zero: no flick from one wing to the other)
  // rudder: manual + auto (slip feedback and adverse-yaw feed-forward)
  let rud = c.yaw || 0;
  if (c.autoRudder !== false && !s.onGround) rud += Math.max(-1, Math.min(1, C.autoRudder * beta * 6 + rc * C.Nda / C.Kr * 0.9));
  rud = Math.max(-1.3, Math.min(1.3, rud));
  // weathercock: β > 0 (air from the right, nose left of track) → nose right (+r); adverse yaw opposes the aileron
  let rdot = sq * C.Kr * rud + sq * C.Nb * beta - vr * C.Nr * s.r - sq * C.Nda * rc;
  if (s.onGround) {
    // on the wheel: the skid / tail wheel hold the pitch between nose-down −2° and tail-down +7°, the wing tip limits
    // the bank to a little over REST_ROLL (it rests on the grass when slow: the glider sits with one wing down)
    const sp = Math.hypot(s.vx, s.vz);
    const pt = s.pitch, rl = s.roll;
    // soft stops: the nose skid below −2°, the tail wheel above +7° (a stiff spring and a damper, no kick)
    if (pt < -2 * D2R) { if (qdot < 0) qdot = 0; qdot += (-2 * D2R - pt) * 90 - 12 * Math.min(0, s.qr); if (s.qr < 0) s.qr *= 0.6; }
    if (pt > 7 * D2R) { if (qdot > 0) qdot = 0; qdot -= (pt - 7 * D2R) * 90 + 12 * Math.max(0, s.qr); if (s.qr > 0) s.qr *= 0.6; }
    qdot -= 3 * s.qr;
    if (sp < 9 && Math.abs(pc) < 0.2 && !s.cable) qdot += ((1.5 * D2R - pt) * 20 - 4 * s.qr) * (1 - sp / 9);   // rests on the main wheel + tail
    // (the wing goes down gradually as the ailerons lose their grip, 9 → 4 m/s: no lurch at a threshold)
    const lim = REST_ROLL + 0.4 * D2R, down = 1 - sstep(4, 9, sp);
    const wantRoll = Math.abs(rl) > lim ? Math.sign(rl) * lim : rl + ((rl >= 0 ? REST_ROLL : -REST_ROLL) - rl) * down;
    pdot += (wantRoll - rl) * (20 + 40 * (Math.abs(rl) > lim ? 1 : down)) - 8 * s.p * (Math.abs(rl) > lim ? 1 : down);
    // yaw on the ground: the wheel steers with the rudder a little when rolling, damping
    rdot += -6 * s.r;
  }
  s.qr += qdot * dt; s.p += pdot * dt; s.r += rdot * dt;
  // ---- integrate attitude: q̇ = ½ q ⊗ ω (ω in body axes: X = left, Y = up, Z = nose → ωX = −q, ωY = −r, ωZ = p)
  const wx = -s.qr, wy = -s.r, wz = s.p;
  const q = s.q, qw = q[0], qx = q[1], qy = q[2], qz = q[3], h = 0.5 * dt;
  q[0] = qw + h * (-qx * wx - qy * wy - qz * wz);
  q[1] = qx + h * (qw * wx + qy * wz - qz * wy);
  q[2] = qy + h * (qw * wy + qz * wx - qx * wz);
  q[3] = qz + h * (qw * wz + qx * wy - qy * wx);
  qNorm(q);
  // ---- outputs
  hprOf(q, s);
  s.V = V; s.alpha = alpha; s.beta = beta; s.stall = stalled;
  s.buffet = sstep(ALPHA_STALL - 1.8 * D2R, ALPHA_STALL + 1 * D2R, alpha);
  if (stalled > 0.5 && !s._stalled) ev |= EV.STALL;
  s._stalled = stalled > 0.5;
  s.agl = s.y - gh - g.wheelH;
  // total-energy variometer (climb + rate of change of kinetic energy, in m/s), lagged ~1 s like a real one
  const te = s.vy + (V * (V - (s.vPrev ?? V))) / (G * dt);
  s.vPrev = V;
  s.te += (te - s.te) * Math.min(1, dt * 1.2);
  s.climb += (s.vy - s.climb) * Math.min(1, dt * 2);
  if (V > g.vne) ev |= EV.OVERSPEED;
  s.ev = ev;
  return ev;
}

/**
 * Winch launch tension law: a winch driver keeps the airspeed near 100-110 km/h — full power while the glider is
 * slow on the ground run, easing off as the speed builds, and backing off near the top of the launch.
 */
export function winchTension(target = 29, max = 9200) {
  let integ = 0;
  return (s, V, d) => {
    const err = target - V;
    integ = Math.max(-2000, Math.min(4000, integ + err * 25 * (1 / 120)));
    const base = s.onGround ? max * 0.85 : s.mass * G * 1.15;
    // near the top (cable steep) the driver eases the power off so the glider can level and back-release
    const top = 1 - 0.55 * sstep(48 * D2R, 62 * D2R, s.cableAngle || 0);
    return Math.max(0, Math.min(max, (base + err * 900 + integ) * top));
  };
}

/**
 * Winch launch pilot assist (the climb is flown for you unless you fight it): ground run level, rotate gently after
 * lift-off, a full climb attitude (~40°) by 6–8 s, easing the attitude off near the top so the hook backs off.
 * Returns the stick (pitch) to apply, given the player's own input pc.
 */
export function winchAssist(s, t, pc) {
  if (s.onGround) return Math.max(pc, -0.2) * 0.5 + (s.V > 18 ? 0.15 : 0);
  const steep = sstep(40 * D2R, 60 * D2R, s.cableAngle || 0);   // over the top: lower the nose so the hook backs off
  const want = Math.min(42, 6 + (t - (s.liftT || t)) * 9) * D2R * (1 - 0.85 * steep);
  const p = Math.max(-1, Math.min(1, (want - s.pitch) * 3.2 - s.qr * 0.8));
  return Math.max(-1, Math.min(1, p + pc * 0.7));
}
