// What a collision does to each side, as numbers (underscore: a helper of systems/vehicles.js, pedestrians.js and
// core/player.js). Pure, DOM-free, allocation-free; tools/smoke_collide.mjs tests it without a world.
//
// The bodies' own impulses (car against car, car against wall) are systems/_vehphys.js impulse(); this file is the rest
// of the model, kept in one place so that every caller agrees:
//   restitution(vn, R)   how much of the closing speed comes back. Bumpers and tyres are springy at a nudge, bodywork
//                        folds at speed: e falls from R.lo (a touch) to R.hi (a crash) with the closing speed.
//   personShare(m)       somebody struck by a body of mass m ends up going at this share of its closing speed (the
//                        common velocity of the two: a bus 0.99, a hatchback 0.94, a bicycle and its rider 0.56).
//   strikerLoss(m, vn, mp)  the speed the striker loses along the contact normal, (1 + E_PERSON) mp / (m + mp) of the
//                        closing speed: a bus hardly notices a walker, a cyclist is all but stopped by one.
//   throwSpeed(v)        how fast somebody bowled over leaves, from the speed the blow gave them (THROW_K of it, never
//                        more than THROW_MAX: comic, bloodless — they slide, sit up and walk on).
//   glance(vn, vt, out)  the blow from a body that is also sliding past: the push along the normal plus what friction
//                        drags along with it (Coulomb: never more than MU_BODY of the normal part) -> out.n, out.t
//   felt(imp, mA, mB)    how hard a closing speed `imp` is on body A against a body of mass mB (0 / Infinity: a wall):
//                        its own change of speed without the bounce. Two equal cars head-on at 10 m/s each feel 10, a
//                        bus running into a hatchback at 10 feels 0.9, the hatchback 9.1. Shake and damage go by this.
import { PED_MASS } from './_vehphys.js';

export { PED_MASS };
/** a walker's body radius as the vehicles see it (m) */
export const PED_R = 0.26;
/** people are a little bouncy against a car (arcade: it is what makes a knock felt at the wheel) */
export const E_PERSON = 0.4;
/** restitution ranges: lo at a touch, hi in a crash */
export const E_WALL = { lo: 0.3, hi: 0.1, v: 5 }, E_BODY = { lo: 0.34, hi: 0.12, v: 5 };
/** thrown at THROW_K of the speed the blow gives, at most THROW_MAX m/s; sliding to rest at SLIDE_DEC m/s^2 */
export const THROW_K = 0.8, THROW_MAX = 12, SLIDE_DEC = 7;
/** friction between a body sliding past and what it touches (a person, a rider) */
export const MU_BODY = 0.6, GLANCE = 0.35;
/** a rider is thrown from the saddle when something closes on the bicycle faster than this (m/s); nudged below it */
export const BIKE_OFF = 3.2, BIKE_NUDGE = 1.2;

export function restitution(vn, R = E_BODY) {
  const k = (vn > 0 ? vn : 0) / R.v;
  return R.hi + (R.lo - R.hi) / (1 + k * k);
}
export function personShare(m) { return m > 0 && m < Infinity ? m / (m + PED_MASS) : 1; }
export function strikerLoss(m, vn, mp = PED_MASS) { return vn > 0 && m > 0 ? (1 + E_PERSON) * mp / (m + mp) * vn : 0; }
export function throwSpeed(v) { return Math.min(THROW_MAX, THROW_K * v); }
export function glance(vn, vt, out) {
  const lim = MU_BODY * (vn > 0 ? vn : 0), t = vt * GLANCE;
  out.n = vn; out.t = t > lim ? lim : t < -lim ? -lim : t;
  return out;
}
export function felt(imp, mA, mB) { return !(mB > 0) || mB === Infinity ? imp : imp * mB / (mA + mB); }
