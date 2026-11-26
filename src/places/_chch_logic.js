// Christ Church — pure rules (no THREE, no DOM): visitor hours and fee, the Hall's hours and dinner, Great Tom's 101
// strokes on the shared clock, the tour group's walk, the lawn rule. Used by christ_church.js and
// tools/smoke_southeast.mjs. Facts and guesses: docs/research/christ_church_botanic_magdalen.md §1.
import { HOUR_MS, DAY_MS, HOUR_S } from '../core/time.js'; export { HOUR_MS, DAY_MS };
export const FEE = 8;                // visitor ticket, £ (2013 not confirmed; £7 in 2017, £8 in 2018)
export const DINNER_PRICE = 6;       // a seat in Hall at dinner (game price)
export const LAWN_FINE = 5, MERCURY_FINE = 10;
export const TOM = { hour: 21 + 5 / 60, strokes: 101, gapS: 2.2, ambient: 7 };   // the ambience system already strikes the first 7
export const dayOf = (ms) => Math.floor(ms / DAY_MS);
export const hourOf = (ms) => (((ms % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS;
/** game day of week, 0 = Sunday (arbitrary but shared) */
export const dowOf = (ms) => ((dayOf(ms) % 7) + 7) % 7;

/** open to paying visitors (Mon-Sat 09:30-17:00, Sun 14:00-17:00; guessed for 2013) */
export function visitorsOpen(hour, dow) { return hour >= (dow === 0 ? 14 : 9.5) && hour < 17; }
/** the Hall is shut to visitors over lunch (12-14) and from 17:00 */
export function hallVisitors(hour, dow) { return visitorsOpen(hour, dow) && !(hour >= 12 && hour < 14); }
/** dinner in Hall (two sittings in practice; one window here) */
export function dinnerTime(hour) { return hour >= 18.25 && hour < 20; }
/** lunch in Hall (members only) */
export function lunchTime(hour) { return hour >= 12 && hour < 13.75; }
/** the cathedral: open with the college; Evensong (free) 18:00-18:45 */
export function evensong(hour) { return hour >= 18 && hour < 18.75; }
export function cathedralOpen(hour, dow) { return visitorsOpen(hour, dow) || evensong(hour) || (dow === 0 && hour >= 10 && hour < 12.5); }
/** the game hour of the last stroke (the strokes are 2.2 real seconds apart: 101 of them run for 222 s of the game clock, core/time.js) */
export const TOM_END = (TOM.hour + (TOM.strokes * TOM.gapS) / HOUR_S) % 24;
/** Tom Gate is shut to the public from the last stroke till 06:00 (the lodge still lets you OUT) */
export function gateShut(hour) { return TOM_END < 6 ? hour >= TOM_END && hour < 6 : hour >= TOM_END || hour < 6; }   // (the last stroke may fall before or after midnight)

/** Great Tom at shared time ms: {ringing, k (strokes struck so far, 0..101), next (ms of the next stroke), t0 (ms of stroke 0)} */
export function tomAt(ms) {
  const day = dayOf(ms), t0 = day * DAY_MS + TOM.hour * HOUR_MS, gap = TOM.gapS * 1000;
  let base = t0;
  if (ms < t0) base = t0 - DAY_MS;                    // before 21:05 today: yesterday's run (long over)
  const since = ms - base, k = Math.floor(since / gap) + 1;
  if (k > TOM.strokes) return { ringing: false, k: TOM.strokes, next: base + DAY_MS, t0: base + DAY_MS };
  return { ringing: true, k: Math.max(0, k), next: base + k * gap, t0: base };
}
/** the strokes due in (ms0, ms1]: [{k, at}] (k is 1-based: the k-th stroke) */
export function strokesBetween(ms0, ms1) {
  const out = [], gap = TOM.gapS * 1000;
  if (!(ms1 > ms0) || ms1 - ms0 > 5000) return out;    // a jump (pinned clock / sync), not time passing
  for (const base of [dayOf(ms1) * DAY_MS + TOM.hour * HOUR_MS, (dayOf(ms1) - 1) * DAY_MS + TOM.hour * HOUR_MS]) {
    const k0 = Math.max(0, Math.ceil((ms0 - base) / gap)), k1 = Math.min(TOM.strokes - 1, Math.floor((ms1 - base) / gap));
    for (let k = k0; k <= k1; k++) { const at = base + k * gap; if (at > ms0 && at <= ms1) out.push({ k: k + 1, at }); }
  }
  return out;
}

/** the tour group: a 7-minute (real) cycle; walks in through Tom Gate, round the terrace to the Hall stair, lingers,
 *  back out. ROUTE in world metres; returns {x, z, h, active} for member i (0 = the guide) at shared ms. */
export const TOUR = {
  cycle: 420000, speed: 0.9, members: 7, start: 10000,
  route: [[224.0, 512.0], [225.6, 528.6], [228.6, 530.8], [238.0, 530.4], [246.6, 530.2], [250.5, 538.0], [252.0, 562.0], [300.0, 559.6], [323.6, 559.0], [325.8, 556.0]],
};
function routeLen(R) { let L = 0; for (let i = 1; i < R.length; i++) L += Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]); return L; }
export const TOUR_LEN = routeLen(TOUR.route);
function along(R, s, out) {
  for (let i = 1; i < R.length; i++) {
    const a = R[i - 1], b = R[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= l || i === R.length - 1) { const t = Math.max(0, Math.min(1, s / l)); out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t; out.h = Math.atan2(b[0] - a[0], b[1] - a[1]); return out; }
    s -= l;
  }
  return out;
}
/** state of tour member i at shared ms (deterministic). Out of the cycle's active window: active = false. */
export function tourAt(i, ms, out = {}) {
  const c = ((ms % TOUR.cycle) + TOUR.cycle) % TOUR.cycle - TOUR.start, walk = TOUR_LEN / TOUR.speed * 1000, linger = 30000;
  const lag = i === 0 ? 0 : 1.2 + (i % 3) * 0.9 + Math.floor(i / 3) * 1.1;                 // metres behind the guide
  const side = i === 0 ? 0 : ((i % 2) * 2 - 1) * (0.5 + 0.35 * (i % 3));
  out.active = c >= 0 && c < walk * 2 + linger;
  if (!out.active) { out.x = TOUR.route[0][0]; out.z = TOUR.route[0][1]; out.h = 0; out.moving = false; return out; }
  let s, back = false;
  if (c < walk) s = (c / 1000) * TOUR.speed - lag;
  else if (c < walk + linger) s = TOUR_LEN - lag;
  else { back = true; s = TOUR_LEN - ((c - walk - linger) / 1000) * TOUR.speed - lag; }
  s = Math.max(0, Math.min(TOUR_LEN, s));
  along(TOUR.route, s, out);
  out.x += Math.cos(out.h) * side; out.z -= Math.sin(out.h) * side;    // the same side of the route both ways
  if (back) out.h += Math.PI;
  out.moving = c < walk || back;
  if (back && s <= 0) out.active = false;
  return out;
}

/** the lawn rule: is the player "on the grass" (lawn, not on a path, by day)? */
export function lawnOffence(onLawn, onPath, hour) { return onLawn && !onPath && hour >= 7 && hour < 22.5; }
