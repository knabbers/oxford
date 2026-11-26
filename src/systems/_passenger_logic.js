// Riding in a vehicle another PLAYER is driving (systems/passenger.js): the rules, pure and DOM-free
// (tools/smoke_passenger.mjs tests them).
// Frames: a vehicle's own frame is +z forward, +x LEFT (as systems/vehicles.js RIDER), y up from the ground under it;
// a seat is [x, y, z, yaw?] = where a seated character's feet origin goes and which way they face (yaw 0 = forward).
// On the wire a passenger says only "I am riding player <id> in seat <n>": the optional element s[9] of the ordinary
// player state (core/net.js `ride`), as [-id, n]. The bus passengers of systems/busride.js use the same element with
// the (positive) crowdsync id of an AI bus, so a negative first number is a player and neither system sees the other's.

export const BOARD_MAX = 2.5;     // m/s: the driver's speed below which someone on foot may get in
export const LEAVE_MAX = 1.5;     // m/s: ... and a passenger may get out
export const REACH = { car: 1.5, punt: 3.4 };      // m from the body's centre line capsule (as the driver's own reach)

/** [-driver id, seat] for the wire */
export function encodeRide(driver, seat) { return [-(driver | 0), seat | 0]; }
/** the wire's ride element -> { driver, seat } when it names a player's vehicle, else null (an AI bus, nothing) */
export function decodeRide(r) {
  if (!Array.isArray(r) || r.length !== 2 || !(r[0] < 0) || !Number.isInteger(r[0]) || !Number.isInteger(r[1]) || r[1] < 0) return null;
  return { driver: -r[0], seat: r[1] };
}

/** Where a seat is in the world. car: { x, y, z, h } (the vehicle's origin and heading) -> out { x, y, z, h } */
export function seatWorld(car, seat, out) {
  const fx = Math.sin(car.h), fz = Math.cos(car.h);
  out.x = car.x + fx * seat[2] + fz * seat[0];
  out.z = car.z + fz * seat[2] - fx * seat[0];
  out.y = car.y + seat[1];
  out.h = car.h + (seat[3] || 0);
  return out;
}
/** A driver reports the position of their own seat (rider = [x, y, z] in the vehicle's frame): the vehicle's origin. */
export function carFromRider(px, py, pz, h, rider, out) {
  const fx = Math.sin(h), fz = Math.cos(h);
  out.x = px - fx * rider[2] - fz * rider[0];
  out.z = pz - fz * rider[2] + fx * rider[0];
  out.y = py - rider[1];
  out.h = h;
  return out;
}
/** metres from (x, z) to a vehicle body L long, W wide at (cx, cz) heading h (its centre-line capsule, as vehicles.bodyDist) */
export function bodyDist(cx, cz, h, L, W, x, z) {
  const fx = Math.sin(h), fz = Math.cos(h), half = Math.max(0, L / 2 - W / 2);
  let u = (x - cx) * fx + (z - cz) * fz; u = u < -half ? -half : u > half ? half : u;
  return Math.hypot(x - (cx + fx * u), z - (cz + fz * u)) - W / 2;
}

/** The seat a newcomer is offered: the first free one in the order given (front passenger, then the back seats);
 *  -1 = full. order: seat indices, best first. taken: Set of seat indices. */
export function pickSeat(order, taken) {
  for (const i of order) if (!taken || !taken.has(i)) return i;
  return -1;
}
/** Two people asked for the same seat in the same instant: the lower player id keeps it, the other moves on.
 *  claims: [{ id, seat }] of everyone else riding the same vehicle. -> my seat (unchanged, another, or -1 = out) */
export function settleSeat(myId, mySeat, claims, order) {
  let clash = false; const taken = new Set();
  for (const c of claims) { taken.add(c.seat); if (c.seat === mySeat && c.id < myId) clash = true; }
  if (!clash) return mySeat;
  return pickSeat(order, taken);
}

/** Where to try stepping out, best first: [along, left] metres from the vehicle's origin. The kerb side (the left: we
 *  drive on the left) first, level with the seat and a step either way; then the other side; then the ends.
 *  T: { L, W }; seat: the seat got out of; doorZ: where the door is along the body (a bus), else the seat's own z. */
export function exitTries(T, seat, doorZ = null) {
  const hw = T.W / 2, z0 = doorZ === null ? seat[2] : doorZ, out = [];
  for (const s of [1, -1]) for (const d of [hw + 0.55, hw + 1.1]) for (const u of [z0, z0 - 0.9, z0 + 0.9]) out.push([u, s * d]);
  out.push([-(T.L / 2 + 0.8), 0], [T.L / 2 + 0.8, 0]);
  return out;
}

/** When none of exitTries() is clear (hard against a building line, railings on the kerb, cars parked both sides, a
 *  narrow lane): everywhere else round the body, in rings 0.55 m apart out to `reach` metres from its sides, nearest
 *  to the kerb-side door first (the offside counted a step further). [along, left] metres from the vehicle's origin. */
export function exitSweep(T, seat, doorZ = null, reach = 6) {
  const hw = T.W / 2, hb = Math.max(0, T.L / 2 - hw), z0 = doorZ === null ? seat[2] : doorZ, out = [];
  for (let r = 0.55; r <= reach + 1e-6; r += 0.55) {
    const R = hw + r, ns = Math.max(1, Math.ceil(2 * hb / 0.6)), nc = Math.max(3, Math.ceil(Math.PI * R / 0.6));
    for (let i = 0; i < ns; i++) { const u = -hb + 2 * hb * (i + 0.5) / ns; out.push([u, R], [u, -R]); }
    for (let i = 0; i <= nc; i++) { const a = Math.PI * i / nc, s = Math.sin(a) * R, c = Math.cos(a) * R; out.push([hb + s, c], [-hb - s, c]); }
  }
  const cost = (q) => Math.hypot(q[0] - z0, q[1] - hw) + (q[1] < 0 ? 0.6 : 0);
  return out.sort((a, b) => cost(a) - cost(b));
}

/** The driver has stopped being a driver. Did they simply get out beside the car (the passenger may slide across), or
 *  are they gone (left the room, through a door, teleported): put the passenger on the pavement?
 *  d: { present, inWorld, dist (m from where the car was) } */
export function driverGone(d) { return !d.present || !d.inWorld || !(d.dist < 14); }
