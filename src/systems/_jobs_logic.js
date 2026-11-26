// Pure rules for the taxi and bus-route jobs (no DOM, no three): fares, tips, timetable, punctuality, route summary.
// Used by systems/jobs.js; covered by tools/smoke_jobs.mjs. Money in 2013-ish pounds.

const r2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------- taxi
/** Hackney-carriage-style meter (approximating Oxford's 2013 tariff): flag fall, per km, per minute waiting; night ×1.5. */
export const TAXI = { flag: 3, perKm: 2.6, perWaitMin: 0.3, nightMul: 1.5, routeCap: 1.6, collision: 1, minKm: 0.35, maxKm: 1.9 };
export const isNightTariff = (hour) => hour >= 22 || hour < 6;
/** driven/straight in metres, waitS = seconds crawling (< 2 m/s). The metered distance is capped at routeCap × straight. */
export function taxiFare({ driven, straight, waitS = 0, hour = 12 }) {
  const km = Math.min(driven, straight * TAXI.routeCap) / 1000;
  const f = TAXI.flag + TAXI.perKm * Math.max(0, km) + TAXI.perWaitMin * Math.max(0, waitS) / 60;
  return r2(f * (isNightTariff(hour) ? TAXI.nightMul : 1));
}
/** 1 = silky, 0 = terrifying: each harsh event (skid, emergency stop, kerb strike) costs 18 %. */
export const smoothness = (harsh) => clamp(1 - 0.18 * harsh, 0, 1);
/** Expected time for a trip of `straight` metres (seconds). */
export const expectedTime = (straight) => (straight * 1.4) / 8 + 20;
/** Tip: up to 25 % of the fare for smooth driving, scaled by speed of arrival; drunk fares tip erratically (rnd 0..1). */
export function taxiTip({ fare, smooth, expectedS, actualS, drunk = false, rnd = 0.5 }) {
  const pace = clamp(expectedS / Math.max(1, actualS), 0.4, 1.3);
  let t = fare * 0.25 * smooth * pace;
  if (drunk) t *= 0.3 + rnd * 1.9;
  return r2(Math.max(0, t));
}
/** What you are paid: fare + tip − £1 per collision, never below £0. (2026-11 play pass: flag £3 + £2.60/km and £1 a bump;
 *  it was £2.50 + £1.70 and £2, so a one-kilometre fare with two bumps paid about a pound against £25 for a bus route.) */
export function taxiPay(fare, tip, collisions) { return r2(Math.max(0, fare + tip - TAXI.collision * collisions)); }

// ---------------------------------------------------------------- bus route
export const BUS = { fare: 2.0, onTime: 1.5, bitLate: 0.5, speed: 6.5, dwell: 18, grace: 15, early: 40, late: 45 };
/** Due times (seconds after the start) for stops with cumulative route distance `dist` (m). */
export function timetable(stops, start = 0) {
  return stops.map((s, i) => Math.round(start + s.dist / BUS.speed + BUS.dwell * i + BUS.grace));
}
/** 'early' | 'on time' | 'late' | 'very late' for arriving at `arrive` when due at `due` (seconds). */
export function punctuality(arrive, due) {
  const d = arrive - due;
  if (d < -BUS.early) return 'early';
  if (d <= 0) return 'on time';
  if (d <= BUS.late) return 'late';
  return 'very late';
}
export const BONUS = { early: 0, 'on time': BUS.onTime, late: BUS.bitLate, 'very late': 0, missed: 0 };
/** legs: [{name, due, arrive|null, status ('start' = the first stop: fares only), board, alight}] → totals. Fares are £2.00 per boarding passenger. */
export function routeSummary(legs) {
  let pax = 0, fares = 0, bonus = 0, onTime = 0, missed = 0, n = 0;
  for (const l of legs) {
    pax += l.board || 0; fares += (l.board || 0) * BUS.fare;
    if (l.status === 'start') continue;           // boarding at the first stop: fares only
    n++;
    bonus += BONUS[l.status] || 0;
    if (l.status === 'on time') onTime++;
    if (l.status === 'missed') missed++;
  }
  const perfect = n > 0 && onTime === n;
  if (perfect) bonus += 5;            // the whole route to the minute
  return { stops: n, pax, fares: r2(fares), bonus: r2(bonus), total: r2(fares + bonus), onTime, missed, perfect };
}
/** Generic route number from a seed (no operator names). */
export function routeNumber(seed) {
  const n = (Math.abs(seed | 0) % 19) + 1, L = ['', '', 'A', 'B', 'X', ''][Math.abs(seed >> 5) % 6];
  return String(n) + L;
}

// ---------------------------------------------------------------- where is it? (in words: there is no map and no arrow)
/** The way to a point (dx, dz) from a vehicle heading `heading` (0 = +z, as everywhere), as a passenger would say it:
 *  'straight ahead', 'ahead on the left', 'on your right', 'behind you on the left', 'behind you'. */
export function whereWords(dx, dz, heading) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const a = Math.atan2(dx * fz - dz * fx, dx * fx + dz * fz) * 180 / Math.PI;   // + = to the left (left is (cos h, -sin h))
  const side = a > 0 ? 'left' : 'right', m = Math.abs(a);
  if (m < 14) return 'straight ahead';
  if (m < 62) return 'ahead on the ' + side;
  if (m < 118) return 'on your ' + side;
  if (m < 160) return 'behind you on the ' + side;
  return 'behind you';
}
/** 'Park End Street' -> itself; distances as a driver reads them: 40 m, 350 m, 1.2 km (rounded so the HUD does not flicker). */
export function distWords(d) { return d >= 1000 ? (d / 1000).toFixed(1) + ' km' : d >= 100 ? Math.round(d / 10) * 10 + ' m' : Math.round(d / 5) * 5 + ' m'; }
