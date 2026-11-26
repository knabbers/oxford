// Knock-down poses for core/characters.js (underscore: a helper of that file). DOM-free, allocation-free.
// Comic and bloodless: nobody is hurt. Each pose is a self-contained timeline driven by the pose timer, so a watcher
// that only knows the pose NAME (multiplayer state, the pedestrians' sync) plays exactly the same tumble.
//   'tumble'   hit by a vehicle at speed: flung back (arms up), one and a quarter backward rolls, sprawled on the back,
//              dazed (head lolling), sits up, gets up, dusts off, shakes a fist. ~6 s. (pedestrians)
//   'tumblef'  the same thrown FORWARD (a cyclist over the handlebars): dive, three-quarter forward roll, on the back...
//   'knocked'  / 'knockedf'  the player's short versions (control comes back as they stand, ~1.9 s)
//   'stumble'  a lurch back off something run into (a wall, a bollard, somebody): arms windmill, ~0.75 s
// The group (feet origin) is moved by the caller (sliding to rest); these only shape the body about it.
// Indices are those of characters.js' pose vector (checked against NP by the caller).
const P_RY = 1, P_RZ = 2, R_X = 3, R_Z = 5, SP_X = 9, SP_Z = 11, HD_X = 12, HD_Y = 13, HD_Z = 14,
  AL_F = 15, AL_A = 16, EL_L = 18, AR_F = 19, AR_A = 20, EL_R = 22,
  LL_F = 23, LL_A = 24, KN_L = 26, LR_F = 27, LR_A = 28, KN_R = 30, FT_L = 31, FT_R = 32;
export const TUMBLE_NP = 33;
const TAU = Math.PI * 2, HP = Math.PI / 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** timelines (seconds from the hit): end of the throw, of the roll, of lying there, of sitting up, of standing up, of the
 *  dust-off, of the fist; dir -1 = backwards; turn = how far the body rolls (rad, signed by dir) */
export const TUMBLE = {
  tumble: { dir: -1, turn: TAU + HP, air: 0.3, roll: 1.0, lie: 2.7, sit: 3.35, up: 4.15, brush: 5.15, fist: 6.05, lift: 0.55 },
  tumblef: { dir: 1, turn: TAU - HP, air: 0.3, roll: 1.0, lie: 2.7, sit: 3.35, up: 4.15, brush: 5.15, fist: 6.05, lift: 0.4 },
  knocked: { dir: -1, turn: TAU + HP, air: 0.26, roll: 0.88, lie: 1.12, sit: 1.12, up: 1.82, brush: 1.82, fist: 1.82, lift: 0.25 },
  knockedf: { dir: 1, turn: TAU - HP, air: 0.26, roll: 0.88, lie: 1.12, sit: 1.12, up: 1.82, brush: 1.82, fist: 1.82, lift: 0.2 },
};
for (const k of Object.keys(TUMBLE)) TUMBLE[k].dur = TUMBLE[k].fist + 0.05;
export const STUMBLE_DUR = 0.75;
/** is the character still on the ground (not yet standing) at pose time pt? */
export function tumbleDown(name, pt) { const T = TUMBLE[name]; return !!T && pt < T.up; }

const _a = new Float32Array(TUMBLE_NP), _b = new Float32Array(TUMBLE_NP);
function mix(o, a, b, w) { for (let i = 0; i < TUMBLE_NP; i++) o[i] = a[i] + (b[i] - a[i]) * w; }

/** thrown and rolling (pt < T.roll): flung limbs, then a tucked ball rolling over about its centre on the ground */
function rolling(c, T, pt, o, plant) {
  const D = c.dims, s = D.s, dir = T.dir;
  o.fill(0);
  const fl = 1 - sm(T.air * 0.55, T.air + 0.12, pt), tk = sm(T.air * 0.5, T.air + 0.1, pt) * (1 - sm(T.roll - 0.2, T.roll, pt));
  // arms flung up and out on the hit, legs kicked; then tucked
  o[AL_F] = o[AR_F] = 2.4 * fl + 1.0 * tk; o[AL_A] = o[AR_A] = 0.5 * fl + 0.25 * tk + 0.08; o[EL_L] = o[EL_R] = 0.4 * fl + 1.7 * tk + 0.1;
  o[LL_F] = 0.6 * fl * (dir < 0 ? 1 : 0.2) + 2.1 * tk; o[LR_F] = 0.3 * fl + 2.1 * tk; o[KN_L] = o[KN_R] = 0.4 * fl + 2.35 * tk + 0.03;
  o[LL_A] = 0.25 * fl + 0.1; o[LR_A] = 0.18 * fl + 0.1;
  o[SP_X] = -0.35 * fl * (dir < 0 ? 1 : -0.6) + 0.85 * tk; o[HD_X] = -0.4 * fl * (dir < 0 ? 1 : -0.3) + 0.6 * tk; o[HD_Y] = 0.3 * fl;
  plant(c, o, 0);
  // body angle: the throw tips it a radian, the roll carries it on round to sprawled-on-the-back
  const th0 = 1.0, th = dir * (th0 * sm(0, T.air, pt) + (T.turn - th0) * sm(T.air, T.roll, pt));
  // roll the (partly) tucked body about the centre of a ball of radius rb so it stays on the ground (as 'roll' does);
  // thrown: lifted (onto the bonnet and off it) in an arc
  const rb = (0.42 + 0.35 * fl) * s, cy = rb - o[P_RY], cz = 0.12 * s * dir, cs = Math.cos(th), sn = Math.sin(th);
  o[R_X] = wrap(th); o[P_RY] = rb - (cy * cs - cz * sn) + T.lift * Math.sin(Math.PI * clamp(pt / (T.air * 1.7), 0, 1));
  o[P_RZ] = cz - (cy * sn + cz * cs);
  o[R_Z] = 0.25 * fl * Math.sin(pt * 9);
  o[SP_Z] = 0.2 * Math.sin(th);
}

/** sprawled on the back, dazed: head lolling, a hand twitching up, legs splayed */
function lying(c, T, pt, o) {
  const D = c.dims, s = D.s, t = c.t, k = c.k;
  o.fill(0);
  o[R_X] = -HP; o[P_RY] = 0.12 * s;
  const daze = sm(T.roll, T.roll + 0.4, pt);
  o[AL_F] = 0.4; o[AR_F] = 0.3 + 0.5 * daze * Math.max(0, Math.sin(t * 2.3 + k)); o[AL_A] = 1.25; o[AR_A] = 1.05;
  o[EL_L] = 0.6; o[EL_R] = 0.5 + 0.6 * daze * Math.max(0, Math.sin(t * 2.3 + k));
  o[LL_F] = 0.35; o[LR_F] = 0.1; o[KN_L] = 0.6; o[KN_R] = 0.15; o[LL_A] = 0.28; o[LR_A] = 0.22;
  o[FT_L] = o[FT_R] = 0.6;
  o[HD_Y] = daze * (0.45 * Math.sin(t * 2.1 + k) + 0.15 * Math.sin(t * 5.3)); o[HD_X] = -0.15; o[HD_Z] = 0.15 * daze * Math.sin(t * 1.7);
  o[SP_X] = 0.05;
}

/**
 * One of the knock-down poses into o at pose time pt. sub(name, out, ptOverride) computes a stock pose of characters.js
 * ('sitground', 'crouch', 'stand', 'brushoff') into out; plant(c, o, extra) puts the lower foot on the ground.
 */
export function tumblePose(c, name, o, pt, sub, plant) {
  if (name === 'stumble') { stumble(c, o, pt, sub, plant); return; }
  const T = TUMBLE[name] || TUMBLE.tumble, X = 0.22;
  if (pt < T.roll) { rolling(c, T, pt, o, plant); return; }
  if (pt < T.lie) {
    lying(c, T, pt, o);
    if (pt < T.roll + X) { rolling(c, T, T.roll - 1e-4, _a, plant); mix(_b, _a, o, sm(T.roll, T.roll + X, pt)); o.set(_b); }
    return;
  }
  if (pt < T.sit) {
    // sit up: from the back to sitting on the ground, a hand to the head
    lying(c, T, pt, _a); sub('sitground', _b, pt);
    const w = sm(T.lie, T.sit, pt);
    mix(o, _a, _b, w);
    o[AR_F] += 1.6 * w * (1 - w) * 4 * 0.5; o[EL_R] += 1.2 * w;
    o[HD_Y] *= 1 - w;
    return;
  }
  if (pt < T.up) {
    // get up: sitting -> crouched -> standing (quick for the player's short versions, which go straight from the back)
    const u = (pt - T.sit) / (T.up - T.sit);
    if (u < 0.5) {
      if (T.sit === T.lie) lying(c, T, pt, _a); else sub('sitground', _a, pt);
      sub('crouch', _b, pt); mix(o, _a, _b, sm(0, 0.5, u));
    } else { sub('crouch', _a, pt); sub('stand', _b, pt); mix(o, _a, _b, sm(0.5, 1, u)); }
    o[AL_F] = o[AL_F] * 0.6 + 0.3; o[AR_F] = o[AR_F] * 0.6 + 0.3;
    return;
  }
  if (pt < T.brush) {
    // dust yourself down (the stock 'brushoff', from its own start)
    sub('brushoff', o, pt - T.up);
    if (pt < T.up + X) { sub('stand', _a, pt); mix(_b, _a, o, sm(T.up, T.up + X, pt)); o.set(_b); }
    return;
  }
  // and shake a fist at the driver
  sub('stand', o, pt);
  const w = sm(T.brush, T.brush + 0.25, pt) * (1 - sm(T.fist - 0.2, T.fist, pt)), t = c.t;
  o[AR_F] += (2.25 - o[AR_F]) * w; o[AR_A] += (0.32 - o[AR_A]) * w; o[EL_R] += (1.55 + 0.4 * Math.sin(t * 15) - o[EL_R]) * w;
  o[AL_F] += (0.25 - o[AL_F]) * w; o[AL_A] += (0.5 - o[AL_A]) * w; o[EL_L] += (1.9 - o[EL_L]) * w;     // other hand on the hip
  o[HD_X] -= 0.18 * w; o[SP_X] -= 0.06 * w; o[HD_Y] += 0.1 * w * Math.sin(t * 7);
  if (pt < T.brush + X && T.brush > T.up) { sub('brushoff', _a, pt - T.up); mix(_b, _a, o, sm(T.brush, T.brush + X, pt)); o.set(_b); }
}

/** recoil off something: thrown back a little, arms windmilling, a quick step to catch yourself */
function stumble(c, o, pt, sub, plant) {
  sub('stand', o, pt);
  const t = pt, w = sm(0, 0.08, t) * (1 - sm(STUMBLE_DUR - 0.25, STUMBLE_DUR, t)), ph = t * 15;
  o[SP_X] -= 0.35 * w; o[HD_X] -= 0.25 * w;
  o[AL_F] += w * (1.4 + 1.0 * Math.sin(ph)); o[AR_F] += w * (1.4 + 1.0 * Math.sin(ph + 2.2)); o[AL_A] += 0.5 * w; o[AR_A] += 0.5 * w;
  o[EL_L] += 0.4 * w; o[EL_R] += 0.4 * w;
  o[LL_F] -= 0.35 * w; o[KN_L] += 0.15 * w; o[LR_F] += 0.5 * w * sm(0.05, 0.25, t); o[KN_R] += 0.6 * w * sm(0.05, 0.25, t) * (1 - sm(0.3, 0.5, t));
  plant(c, o, 0);
  o[R_X] = -0.12 * w; o[P_RZ] = -0.06 * w * c.dims.s;
}
