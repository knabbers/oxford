// Riding a bus as a passenger: the pure part (no THREE, no DOM; tools/smoke_bus_ride.mjs tests it in node).
// The inside of the bus is laid out here once, in the bus's own frame (the vehicle kit's: origin on the road under the
// middle of the bus, +z = the front, +x = the NEARSIDE / kerb side, where the door is), and everything else reads it:
// the interior mesh (_bus_interior.js), the walk from the door to a seat, where the camera sits, where the other
// passengers sit and which window a rider is seen at from the street.
// The hull these fit inside is _vehiclemeshes.js buildBus: 10.6 x 2.52 m; double-decker glass 1.02-1.96 and 2.58-3.52 m,
// single-decker 1.0-2.2 m; door on the nearside at z 3.5..4.66; front axle z 2.65, rear -2.95; driver at (-0.75, 4.35).

export const FARE = 2;                       // a c. 2013 Oxford city single, near enough
export const BUS = { hw: 1.26, hl: 5.3, wall: 1.2, aisle: 0.31, seatW: 0.43, pitch: 0.8 };
export const DOOR = { z0: 3.5, z1: 4.66, zc: 4.08 };
export const AXLES = [2.65, -2.95];

/** The deck dimensions of a body style: 'bus' (double-decker) or 'bus1' (single).
 *  Headroom 1.82 m downstairs, 1.74 m upstairs (2026-11-23; the upper deck was 1.82 too). GUESS from the usual
 *  figures for a 4.3-4.4 m low-floor double-decker (lower saloon about 1.8 m, upper about 1.7-1.75 m): not measured. */
export function decks(style) {
  const dd = style !== 'bus1';
  return dd
    ? { dd, floor: [0.26, 2.14], ceil: [2.08, 3.88], sill: [1.02, 2.58], head: [1.96, 3.52], glassZ: [[-4.45, 3.42, 4.8], [-4.95, 5.12, 5.12]] }
    : { dd, floor: [0.26], ceil: [2.6], sill: [1.0], head: [2.2], glassZ: [[-4.45, 3.42, 4.8]] };
}
/** The staircase of the double-decker: a straight flight on the offside, right behind the cab, over the offside front
 *  wheel, RISING REARWARDS (2026-11-23; it used to climb forwards). GUESS after the common Alexander Dennis Enviro400 /
 *  Wright Gemini layout (the type Oxford ran c. 2013): you step off the vestibule onto a landing at the foot (zFoot..zEnd,
 *  against the cab partition), climb n risers towards the back and come out at the head of the stairs (zTop) facing the
 *  rear, the stairwell behind you screened from the upper aisle; the front seats upstairs are over the cab.
 *  z0: the back of the enclosure on the lower deck (the offside seats start behind it). Tread k (1..n-1) is the strip
 *  [zFoot - tread*k, zFoot - tread*(k-1)] at yLand + rise*k; the n-th riser is the upper floor's edge at zTop. */
export const STAIR = { x0: -1.2, x1: -0.42, xc: -0.81, z0: 1.28, zTop: 1.48, zFoot: 2.8, zEnd: 3.5, tread: 0.22, n: 7, yLand: 0.54, zIn: 3.15, zAisle: 1.1 };
const stairUp = (D) => [[-0.3, D.floor[0], STAIR.zIn], [STAIR.xc, STAIR.yLand, STAIR.zIn], [STAIR.xc, STAIR.yLand, STAIR.zFoot + 0.02], [STAIR.xc, D.floor[1], STAIR.zTop - 0.05], [STAIR.xc + 0.2, D.floor[1], STAIR.zAisle], [0, D.floor[1], STAIR.zAisle]];
/** the height of the stair tread under (x, z), or null off the stairs (x < x1, z0..zEnd is the enclosure) */
export function stairAt(style, x, z) {
  if (style === 'bus1' || x >= STAIR.x1 || z <= STAIR.zTop || z >= STAIR.zEnd + 0.02) return null;
  if (z >= STAIR.zFoot) return STAIR.yLand;
  const D = decks(style), rise = (D.floor[1] - STAIR.yLand) / STAIR.n, k = Math.min(STAIR.n - 1, Math.floor((STAIR.zFoot - z) / STAIR.tread) + 1);
  return STAIR.yLand + rise * k;
}

/**
 * Every seat: { i, x, y (the floor under it), z (where the hips are), deck, win (a window seat), side (+1 nearside,
 * -1 offside, 0 the middle of a back bench), bench, front (the upstairs front row) }. The index i is what goes on the
 * wire, so the order never changes: lower deck front to back, then the upper deck.
 */
const _layouts = {};
export function seatLayout(style) {
  const key = style === 'bus1' ? 'bus1' : 'bus';
  if (_layouts[key]) return _layouts[key];
  const D = decks(key), out = [], ax = BUS.aisle + BUS.seatW / 2, wx = ax + BUS.seatW;
  const add = (x, z, deck, win, side, extra) => out.push(Object.assign({ i: out.length, x, y: D.floor[deck], z, deck, win, side, bench: false, front: false, edge: BUS.aisle }, extra));
  const rows = (zs, deck, side, both) => { for (const z of zs) { if (both) add(side * wx, z, deck, true, side); add(side * ax, z, deck, false, side); } };
  // the upstairs front row sits a hand in from the wall: its window seat looks out through the front window, not at its frame
  const frontRow = (side) => { const e = BUS.aisle - 0.115; add(side * (e + BUS.seatW * 1.5), 4.3, 1, true, side, { front: true, edge: e }); add(side * (e + BUS.seatW * 0.5), 4.3, 1, false, side, { front: true, edge: e }); };
  // lower deck: pairs each side; over the back wheels the box takes the window seat
  rows([1.55, 0.75, -0.05, -0.85, -1.65], 0, 1, true);
  rows([-2.45, -3.25], 0, 1, false);
  rows(D.dd ? [0.75, -0.05, -0.85, -1.65] : [1.55, 0.75, -0.05, -0.85, -1.65], 0, -1, true);
  rows([-2.45, -3.25], 0, -1, false);
  for (const x of [0.86, 0.43, 0, -0.43, -0.86]) add(x, -4.02, 0, Math.abs(x) > 0.8, Math.sign(x), { bench: true });
  if (D.dd) {
    frontRow(1);
    rows([3.5, 2.7, 1.9, 1.1, 0.3, -0.5, -1.3, -2.1, -2.9, -3.7], 1, 1, true);
    frontRow(-1);
    rows([0.3, -0.5, -1.3, -2.1, -2.9, -3.7], 1, -1, true);
    for (const x of [0.86, 0.43, 0, -0.43, -0.86]) add(x, -4.5, 1, Math.abs(x) > 0.8, Math.sign(x), { bench: true });
  }
  return (_layouts[key] = out);
}

/** The seats the AI passengers of a bus are in: `pax` = _vehiclemeshes.busPaxLayout(n, seed) (who is drawn at which
 *  window from outside) -> [{ seat, top, skin, hair }], each in the free window seat nearest their window. */
export function paxSeats(style, pax) {
  const S = seatLayout(style), taken = new Set(), out = [];
  for (const q of pax) {
    if (q.deck && style === 'bus1') continue;
    let best = null, bd = Infinity;
    for (const s of S) {
      if (!s.win || s.deck !== q.deck || s.side !== q.sx || taken.has(s.i)) continue;
      const d = Math.abs(s.z - q.z); if (d < bd) { bd = d; best = s; }
    }
    if (!best) continue;
    taken.add(best.i); out.push({ seat: best.i, top: q.top, skin: q.skin, hair: q.hair });
  }
  return out;
}

/** The seat a new passenger is shown to: a free window seat on the lower deck, kerb side first, about the middle. */
export function defaultSeat(style, taken) {
  const S = seatLayout(style); let best = -1, bs = -Infinity;
  for (const s of S) {
    if (taken && taken.has(s.i)) continue;
    const sc = (s.deck === 0 ? 10 : 0) + (s.win ? 5 : 0) + (s.side > 0 ? 2 : 0) - (s.bench ? 3 : 0) - Math.abs(s.z - 0.2) * 0.6;
    if (sc > bs) { bs = sc; best = s.i; }
  }
  return best;
}
/** The next seat to try when the player asks for another (Q): one round of every seat, the upstairs front window seats
 *  first on a double-decker, then the other window seats, then the rest. first: the first time of asking (start at the
 *  top of the round, wherever you were shown to); after that, the one after yours. Skips taken ones; -1 = nowhere else. */
export function nextSeat(style, cur, taken, first = false) {
  const S = seatLayout(style);
  const rank = (s) => (s.front && s.win ? 0 : s.win && !s.bench ? 1 : 2);
  const order = S.slice().sort((a, b) => rank(a) - rank(b) || a.deck - b.deck || b.side - a.side || b.z - a.z).map((s) => s.i);
  const at = first ? -1 : order.indexOf(cur);
  for (let k = 1; k <= order.length; k++) { const i = order[(at + k + order.length) % order.length]; if (i !== cur && !(taken && taken.has(i))) return i; }
  return -1;
}

// ---------------------------------------------------------------- ways through the bus (bus frame, [x, y, z] of the feet)
// Nothing in the game walks these any more (2026-11-23: you walk on yourself); they are the waypoints a test's walker
// steers through with the ordinary keys (tools/_busbot.mjs), and they say how the inside is meant to be got round.
const KERB_X = BUS.hw + 0.8;
/** from the pavement by the door, up the step, into the aisle by the driver */
export function pathIn(style) {
  const y = decks(style).floor[0];
  return [[KERB_X, 0, DOOR.zc], [0.85, y, DOOR.zc], [0.1, y, 3.55], [0, y, 3.3]];
}
/** from the aisle by the driver (or from `from` = { deck, z }, standing in the aisle) to the aisle spot beside a seat
 *  (seatReach): [..., the reach point]. Up or down the stairs on the way if it is on the other deck. */
export function pathToSeat(style, seat, from) {
  const D = decks(style), s = seatLayout(style)[seat], y0 = D.floor[0], pts = [];
  const deck0 = from ? from.deck : 0;
  let az = from ? from.z : 3.3;
  if (deck0 !== s.deck) {
    if (s.deck === 1) {                                  // up the stairs
      if (Math.abs(az - STAIR.zIn) > 0.05) pts.push([0, y0, STAIR.zIn]);
      pts.push(...stairUp(D));
      az = STAIR.zAisle;
    } else {                                             // and down them
      if (Math.abs(az - STAIR.zAisle) > 0.05) pts.push([0, D.floor[1], STAIR.zAisle]);
      pts.push(...stairUp(D).reverse().slice(1));
      az = STAIR.zIn;
    }
  }
  const r = seatReach(style, seat);
  if (Math.abs(az - r[1]) > 0.02) pts.push([0, s.y, s.front ? Math.min(r[1], 3.7) : r[1]]);
  pts.push([r[0], s.y, r[1]]);
  return pts;
}
/** from the aisle beside a seat to the pavement by the door */
export function pathOut(style, seat) {
  const D = decks(style), s = seatLayout(style)[seat], y0 = D.floor[0], r = seatReach(style, seat), pts = [[r[0], s.y, r[1]], [0, s.y, s.front ? 3.7 : r[1]]];
  if (s.deck === 1) pts.push([0, D.floor[1], STAIR.zAisle], ...stairUp(D).reverse().slice(1));
  pts.push([0.1, y0, 3.5], [0.8, y0, DOOR.zc], [KERB_X, 0, DOOR.zc]);
  return pts;
}
/** where a seat's occupant is seen from the street: the figure on the glass (busRiderFigure's q) */
export function windowOf(style, seat, look) {
  const s = seatLayout(style)[seat];
  const side = s.side || 1;
  return { sx: side, z: s.z + 0.05, deck: s.deck, top: (look && look.top) ?? 0x3a3a3a, skin: (look && look.skin) ?? 0xe0b090, hair: (look && look.hair) ?? 0x2a1b10 };
}

// ---------------------------------------------------------------- walking about inside (2026-11-23)
// The player walks on and about the bus with the ordinary controls, in the bus's own frame (systems/busride.js runs the
// real Player there): these are the walls and floors of that frame. Every wall is a segment [x1, z1, x2, z2] for a
// core/collision.js Collider; the walker is a 0.32 m circle. Seats are solid blocks from the wall to their aisle edge
// (|x| = SEAT_EDGE: a little in from the cushions' own 0.31 m, so the 0.8 m aisle passes a 0.64 m wide walker); you sit
// down from the aisle beside one.
export const SEAT_EDGE = 0.4;
/** the doorway: where you are "at the door" (the driver waits, the doors will not close on you) and where the bus's
 *  frame begins and ends on the pavement side: in at |x| < IN_X, out past OUT_X (or along the side past the door) */
export const DOORWAY = { x0: 0.72, inX: BUS.hw + 0.52, outX: BUS.hw + 0.6, z0: DOOR.z0, z1: DOOR.z1, side: 0.35 };      // (side: how far along the bus past the door frame you go before you are off it: more than in, so the edge does not flicker)
const rect = (out, x0, x1, z0, z1) => { out.push([x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]); };
/**
 * The walls of each deck, in the bus frame: { decks: [[seg...], [seg...]], leaves: [[x, z0, z1], [x, z0, z1]] } (the two
 * door leaves: closed they run z0..z1 at x; systems/busride.js shortens them as they slide open).
 */
const _walls = {};
export function walls(style) {
  const key = style === 'bus1' ? 'bus1' : 'bus';
  if (_walls[key]) return _walls[key];
  const D = decks(key), dd = D.dd, W = BUS.wall, E = SEAT_EDGE, out = [];
  // ---- lower deck
  const L = [];
  L.push([-W, -4.45, -W, 5.2], [-W, 5.2, W, 5.2], [W, 5.2, W, DOOR.z1], [W, DOOR.z0, W, -4.45], [W, -4.45, -W, -4.45]);       // the shell, the doorway open
  L.push([-W, STAIR.zEnd + 0.02, -0.25, STAIR.zEnd + 0.02], [-0.25, STAIR.zEnd + 0.02, -0.25, 4.88], [-0.25, 4.88, W, 4.88]);  // the cab partition and door, the shelf under the windscreen
  for (const sx of dd ? [1] : [1, -1]) { const a = sx * 0.42, b = sx * W; L.push([a, 2.08, a, 3.22], [a, 2.08, b, 2.08], [a, 3.22, b, 3.22]); }   // the luggage pen(s) over the front wheel(s)
  rect(L, E, W, -3.46, 1.88);                                    // nearside seats (and those over the back wheel box)
  rect(L, -W, -E, -3.46, dd ? 1.08 : 1.88);                      // offside seats
  L.push([-W, -3.69, W, -3.69]);                                 // the back seat's front
  if (dd) L.push([-W, STAIR.z0, STAIR.x1, STAIR.z0], [STAIR.x1, STAIR.z0, STAIR.x1, STAIR.zFoot]);   // the stair enclosure: its back, its side along the aisle (open over the landing)
  out.push(L);
  // ---- upper deck
  if (dd) {
    const U = [];
    U.push([-W, -4.98, -W, 5.15], [-W, 5.15, W, 5.15], [W, 5.15, W, -4.98], [W, -4.98, -W, -4.98]);
    U.push([STAIR.x1, STAIR.zTop, STAIR.x1, STAIR.zEnd], [-W, STAIR.zEnd, STAIR.x1, STAIR.zEnd]);    // the screen round the stairwell (open at its head)
    rect(U, E, W, -3.91, 3.83); rect(U, 0.2, W, 4.09, 5.15); rect(U, -W, -0.2, 4.09, 5.15); rect(U, -W, -E, -3.91, 0.63);
    U.push([-W, -4.17, W, -4.17]);
    out.push(U);
  }
  return (_walls[key] = { decks: out, leaves: [[W + 0.03, DOOR.z0, DOOR.zc], [W + 0.03, DOOR.zc, DOOR.z1]] });
}
/** inside the shell (true) or out on the pavement by the door (false) */
export const insideHull = (x, z) => Math.abs(x) < BUS.hw && Math.abs(z) < BUS.hl;
/** The floor under (x, z) for feet at y, in the bus frame: the stair tread, else the deck the feet are on (the highest
 *  floor no more than a step above them). null outside the shell (the pavement: the caller's world ground). */
export function floorAt(style, x, z, y) {
  if (!insideHull(x, z)) return null;
  const s = stairAt(style, x, z); if (s !== null) return s;
  const D = decks(style);
  return D.dd && y > 1.2 ? D.floor[1] : D.floor[0];
}
/** the deck feet at local height y are on (0 / 1) */
export const deckOf = (style, y) => (style !== 'bus1' && y > 1.2 ? 1 : 0);
/** the ceiling over (x, z) for feet at y (the upper one over the stairwell), or null outside */
export function ceilAt(style, x, z, y) {
  if (!insideHull(x, z)) return null;
  const D = decks(style);
  if (!D.dd) return D.ceil[0];
  if (y > 1.2 || (x < STAIR.x1 + 0.05 && z > STAIR.z0 - 0.1 && z < STAIR.zEnd)) return D.ceil[1];
  return D.ceil[0];
}
/** where you stand in the aisle to sit down in a seat (and get up to): [x, z] */
export function seatReach(style, i) {
  const s = seatLayout(style)[i];
  if (s.bench) return [0, s.z + 0.65];
  return s.front ? [0, s.z - 0.55] : [s.side * 0.05, s.z + 0.12];
}
/**
 * The seat a walker at (x, y, z) looking along local heading h (and down at pitch, rad) can sit down in: a free one whose
 * aisle spot is within reach (0.95 m), the nearest, and of a pair the one looked at - level, the window seat; down at
 * the nearer one, the aisle seat. -1 if none.
 */
export function seatToSit(style, x, y, z, h, taken, pitch = 0) {
  const S = seatLayout(style), dk = deckOf(style, y), fx = Math.sin(h), fz = Math.cos(h);
  const lookD = pitch > 0.05 ? 1.2 / Math.tan(Math.min(1.5, pitch)) : 3;       // (the eye 1.2 m over the cushions: where the view meets them)
  let best = -1, bs = Infinity;
  for (const s of S) {
    if (s.deck !== dk || (taken && taken.has(s.i))) continue;
    const r = seatReach(style, s.i), d = Math.hypot(r[0] - x, r[1] - z);
    if (d > 0.95) continue;
    const dx = s.x - x, dz = s.z - z, l = Math.hypot(dx, dz) || 1, look = (dx * fx + dz * fz) / l;
    const sc = d + 0.5 * (1 - look) + 0.5 * Math.min(1, Math.abs(l - lookD)) - (s.win ? 0.01 : 0);
    if (sc < bs) { bs = sc; best = s.i; }
  }
  return best;
}
/** the bell pushes a standing passenger can reach: [x, y, z] (on the poles every other row, by the doors, the stairs) */
const _bells = {};
export function bellPushes(style) {
  const key = style === 'bus1' ? 'bus1' : 'bus';
  if (_bells[key]) return _bells[key];
  const out = [], seen = new Set();
  for (const s of seatLayout(key)) {
    if (s.bench) continue;
    const rk = s.deck + ':' + s.side + ':' + s.z;
    if (seen.has(rk)) continue; seen.add(rk);
    if (Math.round((s.z + 6) / BUS.pitch) % 2 === 0) out.push([s.side * (s.edge + 0.02), s.y + 1.38, s.z - 0.17]);
  }
  out.push([0.55, 0.26 + 1.38, DOOR.z0 - 0.04], [-0.22, 0.26 + 1.38, DOOR.z1 + 0.1]);
  return (_bells[key] = out);
}

/** Walk a path: st = { i (segment), u (m along it) } advanced by `step` m; writes out = { x, y, z, h (heading in the
 *  bus frame), done }. A stretch that climbs counts its slope, so stairs are not run up. */
export function walkPath(pts, st, step, out) {
  let i = st.i | 0, u = st.u || 0;
  for (let guard = 0; guard < 40; guard++) {
    if (i >= pts.length - 1) { const p = pts[pts.length - 1]; out.x = p[0]; out.y = p[1]; out.z = p[2]; out.done = true; st.i = i; st.u = 0; return out; }
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-6;
    if (u + step < L) {
      u += step; const t = u / L;
      out.x = a[0] + (b[0] - a[0]) * t; out.y = a[1] + (b[1] - a[1]) * t; out.z = a[2] + (b[2] - a[2]) * t;
      if (Math.hypot(b[0] - a[0], b[2] - a[2]) > 0.05) out.h = Math.atan2(b[0] - a[0], b[2] - a[2]);
      out.done = false; st.i = i; st.u = u; return out;
    }
    step -= L - u; u = 0; i++;
  }
  out.done = true; return out;
}

/** Bus frame <-> world on the flat (heading h: forward = (sin h, cos h); +x of the bus frame is its left). */
export function toWorld(bx, bz, h, lx, lz, out) {
  const s = Math.sin(h), c = Math.cos(h);
  out.x = bx + c * lx + s * lz; out.z = bz - s * lx + c * lz; return out;
}
export function toLocal(bx, bz, h, wx, wz, out) {
  const s = Math.sin(h), c = Math.cos(h), dx = wx - bx, dz = wz - bz;
  out.x = c * dx - s * dz; out.z = s * dx + c * dz; return out;
}

/** What the fare is said to be for: the route on the blind. */
export function fareLine(num, dest, paid) {
  const where = dest ? `Single towards ${dest}` : 'Single';
  return paid ? `${where}${num ? ' on the ' + num : ''}: £${FARE.toFixed(2)}` : where;
}
export const LINES = {
  skint: ['“Not got it? Go on, sit down, I never saw you.”', '“Short, are we? On you get. Pay me double next year.”', '“Put your pennies away, love. Mind the step.”'],
  wanted: ['The driver looks at you, looks at the blue lights, and keeps the doors shut.', '“Not with that lot after you.” The doors stay shut.'],
  full: ['“Full up. There’s another one behind.”'],
  taken: ['“Well, that’s a first.” Everybody gets off, grumbling.', 'The passengers get off, tutting. Somebody says they will be writing to the paper.'],
  crash: ['A bump. Somebody tuts. “I shall be late for my tutorial.”', 'A jolt. Nobody is hurt; several people sigh.'],
  terminus: ['“This bus terminates here. All change, please.”', '“End of the line. All change.”'],
  bell: ['Ding.'],
  thanks: ['“Thank you, driver!”', '“Cheers, drive.”', '“Thanks!”'],
};
