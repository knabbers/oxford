// Swimming poses for core/characters.js (underscore: a helper of that file). DOM-free, allocation-free.
//   'swim'  at the surface: treading water when still, breaststroke (head up) at a swim, front crawl when fast.
//           The character group's origin is the WATER LINE under the swimmer's chest; the body hangs below it.
//   'dive'  under water / in the air on the way in: breaststroke with a long glide about the body's centre, pitched by
//           c.swimPitch (radians, + = nose up; set by systems/swim.js) and streamlined by c.swimStretch (0..1: arms locked
//           overhead, legs together — the dive off a bank or a bridge).
// Parameter indices are those of characters.js' pose vector (checked against NP by the caller).
const P_RY = 1, P_RZ = 2, R_X = 3, R_Y = 4, SP_X = 9, SP_Y = 10, HD_X = 12, HD_Y = 13,
  AL_F = 15, AL_A = 16, EL_L = 18, AR_F = 19, AR_A = 20, EL_R = 22,
  LL_F = 23, LL_A = 24, KN_L = 26, LR_F = 27, LR_A = 28, KN_R = 30, FT_L = 31, FT_R = 32;
export const SWIM_NP = 33;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const _a = new Float32Array(SWIM_NP), _b = new Float32Array(SWIM_NP);

function zero(o) { o.fill(0); o[AL_A] = o[AR_A] = 0.08; o[EL_L] = o[EL_R] = 0.15; o[KN_L] = o[KN_R] = 0.03; }
/** lie the rig at angle th from upright (π/2 = flat, face down) with the point `hPivot` up the body at (y, z) */
function lay(o, th, hPivot, y, z) { o[R_X] = th; o[P_RY] = y - hPivot * Math.cos(th); o[P_RZ] = z - hPivot * Math.sin(th); }

function tread(c, o) {
  const D = c.dims, t = c.t, k = c.k;
  zero(o);
  const bob = Math.sin(t * 2.1 + k);
  lay(o, 0.1, D.neckY, 0.015 + 0.022 * bob, 0);
  const sc = Math.sin(t * 3.0 + k), sc2 = Math.cos(t * 3.0 + k);
  o[AL_A] = 1.12 + 0.1 * sc2; o[AR_A] = 1.12 - 0.1 * sc2; o[AL_F] = 0.5 + 0.3 * sc; o[AR_F] = 0.5 - 0.3 * sc; o[EL_L] = 0.55 - 0.25 * sc; o[EL_R] = 0.55 + 0.25 * sc;
  const e = t * 4.2 + k;
  o[LL_F] = 0.55 + 0.3 * Math.sin(e); o[KN_L] = 1.0 + 0.35 * Math.cos(e); o[LL_A] = 0.3;
  o[LR_F] = 0.55 - 0.3 * Math.sin(e); o[KN_R] = 1.0 - 0.35 * Math.cos(e); o[LR_A] = 0.3;
  o[FT_L] = o[FT_R] = 0.5;
  o[HD_X] = -0.12; o[HD_Y] = 0.35 * Math.sin(t * 0.4 + k) * Math.sin(t * 0.23 + k * 3); o[SP_X] = 0.03 * bob;
}

/** breaststroke limbs for stroke phase u (0 = start of the pull … 0.7–1 glide); reach = arm angle in the glide */
function frog(o, u, reach) {
  const a = sm(0, 0.3, u), b = sm(0.3, 0.48, u), s = sm(0.48, 0.7, u);
  const F = reach - (reach - 1.5) * a - 0.4 * b + (reach - 1.1) * s, A = 0.05 + 0.95 * a - 1.15 * b + 0.2 * s, E = 0.05 + 0.85 * a + 1.2 * b - 2.05 * s;
  o[AL_F] = o[AR_F] = F; o[AL_A] = o[AR_A] = A; o[EL_L] = o[EL_R] = E;
  const d = sm(0.26, 0.5, u), kk = sm(0.5, 0.64, u), q = sm(0.64, 0.82, u);
  o[LL_F] = o[LR_F] = 0.8 * (d - kk); o[KN_L] = o[KN_R] = 0.03 + 1.9 * (d - kk);
  o[LL_A] = o[LR_A] = 0.05 + 0.3 * d + 0.12 * kk - 0.42 * q;
  o[FT_L] = o[FT_R] = 0.85 - 1.3 * d + 1.3 * q;
  return a * (1 - s);      // 0..1: how far into the pull (the head rises on it)
}

function breast(c, o, u) {
  const D = c.dims;
  zero(o);
  const lift = frog(o, u, 2.4);          // (the trunk slopes up to the head: the arms reach along the surface, not up out of it)
  lay(o, 1.24 - 0.12 * lift, D.neckY - 0.06 * D.s, -0.075 + 0.07 * lift, 0.42 * D.s);
  o[SP_X] = -0.2 - 0.14 * lift; o[HD_X] = -0.72 - 0.1 * lift;
}

function crawl(c, o, u) {
  const D = c.dims;
  zero(o);
  for (let side = 0; side < 2; side++) {
    const v = (u + side * 0.5) % 1, F = Math.PI - TAU * v;
    const under = v < 0.5 ? Math.sin(Math.PI * v * 2) : 0, over = v >= 0.5 ? Math.sin(Math.PI * (v - 0.5) * 2) : 0;
    o[side ? AR_F : AL_F] = F; o[side ? EL_R : EL_L] = 0.1 + 0.55 * under + 1.35 * over; o[side ? AR_A : AL_A] = 0.06 + 0.3 * over;
  }
  const roll = -0.34 * Math.sin(TAU * u);
  lay(o, 1.43, D.neckY - 0.06 * D.s, -0.07, 0.42 * D.s);
  o[R_Y] = roll; o[SP_Y] = roll * 0.35;
  const br = sm(0.52, 0.66, u) * (1 - sm(0.84, 0.97, u));       // a breath to the left as the left arm recovers
  o[HD_X] = -0.5 + 0.2 * br; o[HD_Y] = 0.95 * br - roll * 0.4; o[SP_X] = -0.1;
  const f = TAU * 3 * u, s = Math.sin(f);
  o[LL_F] = 0.05 + 0.24 * s; o[LR_F] = 0.05 - 0.24 * s; o[KN_L] = 0.12 + 0.3 * Math.max(0, -s); o[KN_R] = 0.12 + 0.3 * Math.max(0, s);
  o[LL_A] = o[LR_A] = 0.04; o[FT_L] = o[FT_R] = 0.85;
}

function under(c, o, u) {
  const D = c.dims, t = c.t, k = c.k;
  zero(o);
  const st = clamp(c.swimStretch || 0, 0, 1), m = sm(0.15, 0.7, c.speed) * (1 - st);
  frog(o, u, 2.95);
  if (m < 1) {
    // hovering / streamlined: blend the stroke out
    const hov = (1 - m) * (1 - st), sc = Math.sin(t * 2.2 + k);
    for (const i of [AL_F, AR_F, AL_A, AR_A, EL_L, EL_R, LL_F, LR_F, KN_L, KN_R, LL_A, LR_A, FT_L, FT_R]) o[i] *= m;
    o[AL_F] += hov * (1.25 + 0.25 * sc) + st * 3.0; o[AR_F] += hov * (1.25 - 0.25 * sc) + st * 3.0;
    o[AL_A] += hov * (0.95 - 0.15 * sc) + st * -0.1; o[AR_A] += hov * (0.95 + 0.15 * sc) + st * -0.1; o[EL_L] += hov * 0.5 + st * 0.05; o[EL_R] += hov * 0.5 + st * 0.05;
    o[LL_F] += hov * (0.3 + 0.2 * sc); o[LR_F] += hov * (0.3 - 0.2 * sc); o[KN_L] += hov * (0.55 - 0.2 * sc) + st * 0.03; o[KN_R] += hov * (0.55 + 0.2 * sc) + st * 0.03;
    o[LL_A] += hov * 0.15 + st * 0.03; o[LR_A] += hov * 0.15 + st * 0.03; o[FT_L] += (1 - m) * 0.8; o[FT_R] += (1 - m) * 0.8;
  }
  const pitch = clamp(c.swimPitch || 0, -1.45, 1.45), hov = (1 - m) * (1 - st);
  lay(o, Math.PI / 2 - pitch - 0.45 * hov, 1.02 * D.s, 0, 0);
  o[HD_X] = -0.5 * (1 - st) - 0.1; o[SP_X] = -0.06 * (1 - st);
}

/**
 * Fill pose vector o for 'swim' / 'dive'. c: the Character (reads dims, t, k, speed, swimPitch, swimStretch; keeps its
 * stroke phase in c._swPh). Returns nothing.
 */
export function swimPose(c, name, o) {
  // the stroke phase advances with the character's own clock (computePose has no dt; baking calls it with t frozen)
  const dt = clamp(c.t - (c._swT === undefined ? c.t : c._swT), 0, 0.1); c._swT = c.t;
  const sp = c.speed;
  if (c._swPh === undefined) c._swPh = 0.75;
  if (name === 'dive') {
    c._swPh = (c._swPh + dt * (0.42 + 0.14 * sp) * (sp > 0.15 ? 1 : 0)) % 1;
    under(c, o, c._swPh);
    return;
  }
  const mv = sm(0.2, 0.75, sp), cr = sm(1.85, 2.3, sp);
  c._swPh = (c._swPh + dt * (0.55 + 0.1 * sp + 0.22 * cr) * (sp > 0.15 ? 1 : 0)) % 1;
  if (mv <= 0) { tread(c, o); return; }
  if (cr >= 1) crawl(c, o, c._swPh);
  else {
    breast(c, o, c._swPh);
    if (cr > 0) { crawl(c, _b, c._swPh); for (let i = 0; i < SWIM_NP; i++) o[i] += (_b[i] - o[i]) * cr; }
  }
  if (mv < 1) { tread(c, _a); for (let i = 0; i < SWIM_NP; i++) o[i] = _a[i] + (o[i] - _a[i]) * mv; }
}
