// Darts: pure rules, board geometry, checkout table, AI. No three.js / DOM, so tools/smoke_bar.mjs can test it in Node.
// Board coordinates are millimetres in the board plane: x to the right, y up, origin at the bull.

export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]; // clockwise from the top
export const R = { bull: 6.35, outerBull: 15.9, trebleIn: 99, trebleOut: 107, doubleIn: 162, doubleOut: 170, board: 225.5 };
export const BOARD_HEIGHT = 1.73, OCHE = 2.37; // metres: bull above the floor, board face to the throw line

/** Score of a dart landing at (x, y) mm. -> {n, mult, score, label, isDouble}  (n = segment number, 25 for the bull, 0 miss) */
export function scoreAt(x, y, out = {}) {
  const r = Math.hypot(x, y);
  out.n = 0; out.mult = 0; out.score = 0; out.isDouble = false;
  if (r <= R.bull) { out.n = 25; out.mult = 2; out.score = 50; out.isDouble = true; out.label = 'BULL'; return out; }
  if (r <= R.outerBull) { out.n = 25; out.mult = 1; out.score = 25; out.label = '25'; return out; }
  if (r > R.doubleOut) { out.label = 'MISS'; return out; }
  out.n = segmentAt(x, y);
  out.mult = r >= R.doubleIn ? 2 : r >= R.trebleIn && r <= R.trebleOut ? 3 : 1;
  out.score = out.n * out.mult; out.isDouble = out.mult === 2;
  out.label = (out.mult === 3 ? 'T' : out.mult === 2 ? 'D' : '') + out.n;
  return out;
}

/** Segment number under (x, y) ignoring rings. Angle clockwise from straight up; 20 spans -9..+9 degrees. */
export function segmentAt(x, y) {
  let a = (Math.atan2(x, y) * 180) / Math.PI; // clockwise from +y
  a = (((a + 9) % 360) + 360) % 360;
  return ORDER[Math.min(19, Math.floor(a / 18))];
}

/** Centre (mm) of the bed for a target like {n:20, mult:3}. Singles aim at the fat outer single. */
export function targetPoint(t, out = {}) {
  if (t.n === 25) { out.x = 0; out.y = 0; return out; }
  const i = ORDER.indexOf(t.n), a = (i * 18 * Math.PI) / 180;
  const r = t.mult === 3 ? 103 : t.mult === 2 ? 166 : t.inner ? 57 : 134;
  out.x = Math.sin(a) * r; out.y = Math.cos(a) * r; return out;
}

// ------------------------------------------------------------------------------------------------- checkouts
// Standard checkout routes for 61..170 (the commonly printed chart). 'B' = bull (50), '25' = outer bull.
const CHART = {
  170: 'T20 T20 B', 167: 'T20 T19 B', 164: 'T20 T18 B', 161: 'T20 T17 B', 160: 'T20 T20 D20', 158: 'T20 T20 D19',
  157: 'T20 T19 D20', 156: 'T20 T20 D18', 155: 'T20 T19 D19', 154: 'T20 T18 D20', 153: 'T20 T19 D18', 152: 'T20 T20 D16',
  151: 'T20 T17 D20', 150: 'T20 T18 D18', 149: 'T20 T19 D16', 148: 'T20 T16 D20', 147: 'T20 T17 D18', 146: 'T20 T18 D16',
  145: 'T20 T15 D20', 144: 'T20 T20 D12', 143: 'T20 T17 D16', 142: 'T20 T14 D20', 141: 'T20 T19 D12', 140: 'T20 T20 D10',
  139: 'T20 T13 D20', 138: 'T20 T18 D12', 137: 'T20 T19 D10', 136: 'T20 T20 D8', 135: 'T20 T17 D12', 134: 'T20 T14 D16',
  133: 'T20 T19 D8', 132: 'T20 T16 D12', 131: 'T20 T13 D16', 130: 'T20 T20 D5', 129: 'T19 T16 D12', 128: 'T18 T14 D16',
  127: 'T20 T17 D8', 126: 'T19 T19 D6', 125: '25 T20 D20', 124: 'T20 T16 D8', 123: 'T19 T16 D9', 122: 'T18 T20 D4',
  121: 'T20 T11 D14', 120: 'T20 20 D20', 119: 'T19 T12 D13', 118: 'T20 18 D20', 117: 'T20 17 D20', 116: 'T20 16 D20',
  115: 'T20 15 D20', 114: 'T20 14 D20', 113: 'T20 13 D20', 112: 'T20 12 D20', 111: 'T20 19 D16', 110: 'T20 B',
  109: 'T20 9 D20', 108: 'T20 16 D16', 107: 'T19 B', 106: 'T20 10 D18', 105: 'T20 13 D16', 104: 'T18 B', 103: 'T19 10 D18',
  102: 'T20 10 D16', 101: 'T17 B', 100: 'T20 D20', 99: 'T19 10 D16', 98: 'T20 D19', 97: 'T19 D20', 96: 'T20 D18',
  95: 'T19 D19', 94: 'T18 D20', 93: 'T19 D18', 92: 'T20 D16', 91: 'T17 D20', 90: 'T20 D15', 89: 'T19 D16', 88: 'T16 D20',
  87: 'T17 D18', 86: 'T18 D16', 85: 'T15 D20', 84: 'T20 D12', 83: 'T17 D16', 82: 'B D16', 81: 'T19 D12', 80: 'T20 D10',
  79: 'T19 D11', 78: 'T18 D12', 77: 'T19 D10', 76: 'T20 D8', 75: 'T17 D12', 74: 'T14 D16', 73: 'T19 D8', 72: 'T16 D12',
  71: 'T13 D16', 70: 'T18 D8', 69: 'T19 D6', 68: 'T20 D4', 67: 'T17 D8', 66: 'T10 D18', 65: 'T19 D4', 64: 'T16 D8',
  63: 'T13 D12', 62: 'T10 D16', 61: 'T15 D8',
};
// Below 61: one dart at a single that leaves a favourite double (D20, D16, D8, D4 ...), or the double itself.
const LOW_SETUP = { 60: 20, 59: 19, 58: 18, 57: 17, 56: 16, 55: 15, 54: 14, 53: 13, 52: 12, 51: 11, 49: 17, 48: 16, 47: 15, 46: 6,
  45: 13, 44: 12, 43: 3, 42: 10, 41: 9, 39: 7, 37: 5, 35: 3, 33: 1, 31: 15, 29: 13, 27: 11, 25: 9, 23: 7, 21: 5, 19: 3, 17: 1,
  15: 7, 13: 5, 11: 3, 9: 1, 7: 3, 5: 1, 3: 1 };
export const BOGEYS = [169, 168, 166, 165, 163, 162, 159];

export function parseThrow(s) {
  if (s === 'B' || s === 'BULL') return { n: 25, mult: 2, score: 50, label: 'BULL' };
  if (s === '25') return { n: 25, mult: 1, score: 25, label: '25' };
  const m = /^([TD]?)(\d+)$/.exec(s), mult = m[1] === 'T' ? 3 : m[1] === 'D' ? 2 : 1, n = +m[2];
  return { n, mult, score: n * mult, label: s };
}

/** Full standard route for a remaining score (array of strings), or null if there is no 3-dart double finish. */
export function checkoutRoute(rem) {
  if (rem > 170 || rem < 2 || BOGEYS.includes(rem)) return null;
  if (CHART[rem]) return CHART[rem].split(' ');
  if (rem === 50) return ['B'];
  if (rem <= 40 && rem % 2 === 0) return ['D' + rem / 2];
  const s = LOW_SETUP[rem];
  if (s) return [String(s), 'D' + (rem - s) / 2];
  return null;
}

/** Best route using at most `darts` darts, or null. Falls back to a 2-dart route when the chart route needs 3. */
export function checkoutFor(rem, darts = 3) {
  const r = checkoutRoute(rem);
  if (r && r.length <= darts) return r;
  if (darts >= 1 && (rem === 50 || (rem <= 40 && rem % 2 === 0))) return [rem === 50 ? 'B' : 'D' + rem / 2];
  if (darts >= 2 && rem <= 110) {
    // two darts: first dart any single/treble/bull, finishing on the most-liked double
    for (const d of FAV_DOUBLES) {
      const left = rem - (d === 25 ? 50 : d * 2);
      const first = singleFor(left);
      if (first) return [first, d === 25 ? 'B' : 'D' + d];
    }
  }
  return null;
}
const FAV_DOUBLES = [20, 16, 18, 12, 10, 8, 19, 17, 14, 15, 13, 11, 9, 6, 4, 7, 5, 3, 2, 1, 25];
function singleFor(v) {
  if (v <= 0) return null;
  if (v <= 20) return String(v);
  if (v === 25) return '25';
  if (v === 50) return 'B';
  for (let n = 20; n >= 1; n--) if (n * 3 === v) return 'T' + n;
  for (let n = 20; n >= 1; n--) if (n * 2 === v) return 'D' + n;
  return null;
}
export function checkoutHint(rem, darts = 3) { const r = checkoutFor(rem, darts); return r ? r.join(' ') : null; }

// ------------------------------------------------------------------------------------------------- 501 match
/** 501 double-out leg between two players. */
export class X01 {
  constructor(names, start = 501) {
    this.names = names; this.start = start; this.scores = names.map(() => start);
    this.turn = 0; this.dartsThisVisit = 0; this.visitStart = start; this.visit = []; this.lastVisit = names.map(() => null);
    this.dartsThrown = names.map(() => 0); this.pointsScored = names.map(() => 0);
    this.winner = -1; this.history = [];
  }
  get remaining() { return this.scores[this.turn]; }
  get dartsLeft() { return 3 - this.dartsThisVisit; }
  /** Apply one dart. -> {bust, checkout, visitOver, total(visit so far), result} */
  throwDart(res) {
    if (this.winner >= 0) return { visitOver: true, bust: false, checkout: false, total: 0 };
    const p = this.turn;
    if (this.dartsThisVisit === 0) { this.visitStart = this.scores[p]; this.visit = []; }
    this.visit.push(res); this.dartsThisVisit++; this.dartsThrown[p]++;
    const left = this.scores[p] - res.score;
    let bust = false, checkout = false;
    if (left < 0 || left === 1 || (left === 0 && !res.isDouble)) bust = true;
    else if (left === 0) checkout = true;
    const total = this.visitStart - (bust ? this.visitStart : left);
    let visitOver = false;
    if (bust) { this.scores[p] = this.visitStart; visitOver = true; }
    else { this.scores[p] = left; if (checkout) { this.winner = p; visitOver = true; } else if (this.dartsThisVisit >= 3) visitOver = true; }
    const visitTotal = bust ? 0 : this.visitStart - this.scores[p];
    if (visitOver) {
      this.pointsScored[p] += visitTotal;
      this.lastVisit[p] = { total: visitTotal, bust, darts: this.visit.map((v) => v.label) };
      this.history.push({ p, total: visitTotal, bust, darts: this.visit.map((v) => v.label) });
      this.dartsThisVisit = 0;
      if (this.winner < 0) this.turn = (this.turn + 1) % this.names.length;
    }
    return { bust, checkout, visitOver, total: visitTotal, result: res, visitDarts: this.visit.slice() };
  }
  average(p) { return this.dartsThrown[p] ? (this.pointsScored[p] / this.dartsThrown[p]) * 3 : 0; }
}

/** Round the Clock practice: hit 1..20 in order (any bed of the number), then the bull. */
export class RoundClock {
  constructor() { this.target = 1; this.darts = 0; this.done = false; }
  get label() { return this.done ? 'Done' : this.target === 25 ? 'Bull' : String(this.target); }
  throwDart(res) {
    if (this.done) return { hit: false };
    this.darts++;
    const hit = res.n === this.target;
    if (hit) { if (this.target === 20) this.target = 25; else if (this.target === 25) this.done = true; else this.target++; }
    return { hit };
  }
}

// ------------------------------------------------------------------------------------------------- AI
/** Gaussian sample (Box–Muller) using rng() in [0,1). */
export function gauss(rng) { let u = 0; while (u < 1e-12) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }

/** What should a sensible player aim at with `rem` left and `dartsLeft` darts in this visit? -> {n, mult, label} */
export function aiChooseTarget(rem, dartsLeft, opts = {}) {
  const route = rem <= 170 ? checkoutFor(rem, dartsLeft) : null;
  if (route) return parseThrow(route[0]);
  const main = parseThrow(opts.blocked ? 'T19' : 'T20');
  if (rem > 230) return main;
  // No finish with the darts left: pick the bed that leaves the best finish for the next visit.
  let best = main, bestV = -Infinity;
  for (const c of SETUP_CANDIDATES) {
    const v = leaveValue(rem - c.score) + c.score * 0.02 - (c.mult === 3 ? 4 : 0) - (c.n === 25 ? 6 : 0);
    if (v > bestV) { bestV = v; best = c; }
  }
  return best;
}
const SETUP_CANDIDATES = [];
for (let n = 1; n <= 20; n++) SETUP_CANDIDATES.push(parseThrow(String(n)), parseThrow('T' + n));
SETUP_CANDIDATES.push(parseThrow('25'));
const FAV_LEAVES = { 40: 30, 32: 29, 36: 27, 24: 25, 20: 24, 16: 24, 50: 10, 8: 18, 12: 18, 28: 17, 30: 15, 38: 15, 34: 14 };
/** How nice is it to be left on `l` at the start of a visit? */
export function leaveValue(l) {
  if (l < 2) return -1000;
  if (FAV_LEAVES[l]) return 100 + FAV_LEAVES[l];
  if (l <= 40 && l % 2 === 0) return 100;
  const r = checkoutRoute(l);
  if (r) return 80 - r.length * 10 - l * 0.05;
  return 20 - l * 0.1;
}

/**
 * Throw one AI dart. skill = {sigma (mm, scoring), dblSigma? (mm, at doubles), bias?: {x,y} mm}.
 * Returns {aim:{x,y}, x, y, target}.
 */
export function aiThrow(rem, dartsLeft, skill, rng, opts = {}) {
  const target = aiChooseTarget(rem, dartsLeft, opts);
  const aim = targetPoint(target);
  const s = (target.mult === 2 || target.n === 25) && skill.dblSigma ? skill.dblSigma : skill.sigma;
  const sx = s * (skill.aspect ? 1 / Math.sqrt(skill.aspect) : 1), sy = s * (skill.aspect ? Math.sqrt(skill.aspect) : 1);
  const x = aim.x + gauss(rng) * sx + (skill.bias ? skill.bias.x : 0), y = aim.y + gauss(rng) * sy + (skill.bias ? skill.bias.y : 0);
  return { aim, x, y, target };
}

/** Deterministic little PRNG (mulberry32) so multiplayer/AI tests are reproducible. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Plays a whole AI-vs-AI leg (for tests / simulated averages). Returns {winner, darts, history}. */
export function simulateLeg(skillA, skillB, seed = 1, maxDarts = 600) {
  const rng = makeRng(seed), m = new X01(['A', 'B']), sk = [skillA, skillB], tmp = {};
  let n = 0;
  while (m.winner < 0 && n < maxDarts) {
    const t = aiThrow(m.remaining, m.dartsLeft, sk[m.turn], rng);
    const res = { ...scoreAt(t.x, t.y, tmp) };
    m.throwDart(res); n++;
  }
  return { winner: m.winner, darts: n, match: m };
}

// ------------------------------------------------------------------------------------------------- caller
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function numberWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  const h = Math.floor(n / 100), r = n % 100;
  return ONES[h] + ' hundred' + (r ? ' and ' + numberWords(r) : '');
}
/** Caller's line for a visit total (British style: "One hundred and EIGHTY!"). */
export function callVisit(total, bust) {
  if (bust) return 'No score!';
  if (total === 0) return 'No score.';
  if (total === 180) return 'One hundred and EIGHTY!';
  const w = numberWords(total);
  return w.charAt(0).toUpperCase() + w.slice(1) + (total >= 100 ? '!' : '.');
}

// ------------------------------------------------------------------------------------------------- the throw
// A steel-tip dart is a projectile: it leaves the hand at about 6.4 m/s (23 km/h), a little upwards, and drops ~0.45 m
// from the top of its arc to the board 2 m on. Board mm as above; D = metres from the release point to the board face.
export const THROW = { v0: 6.4, g: 9.81, reach: 0.34, relX: 45, relY: -75 };   // the hand lets go `reach` m ahead of the oche, right of and below the eye line
/** Launch for a dart that should land on (tx, ty) mm when thrown at speed v from (rx, ry) mm, D metres out (the low arc).
 *  -> {el (rad, elevation), yaw (rad, + to the board's right), Dh (m along the ground)} */
export function launchFor(tx, ty, D = OCHE - THROW.reach, v = THROW.v0, rx = THROW.relX, ry = THROW.relY, out = {}) {
  const lat = (tx - rx) / 1000, h = (ty - ry) / 1000, Dh = Math.hypot(D, lat), g = THROW.g, v2 = v * v;
  const disc = v2 * v2 - g * (g * Dh * Dh + 2 * h * v2);
  out.el = disc <= 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (g * Dh));
  out.yaw = Math.atan2(lat, D); out.Dh = Dh;
  return out;
}
/** Where a dart launched at (el, yaw) with speed v meets the board plane: -> {x, y (mm), t (s), pitch (rad: the dart's
 *  nose angle at the board, negative = pointing down), vImpact (m/s)} */
export function flightHit(el, yaw, v, D = OCHE - THROW.reach, rx = THROW.relX, ry = THROW.relY, out = {}) {
  const g = THROW.g, vh = v * Math.cos(el), vy = v * Math.sin(el), vd = vh * Math.cos(yaw), vl = vh * Math.sin(yaw);
  const t = D / vd;
  out.x = rx + vl * t * 1000; out.y = ry + (vy * t - 0.5 * g * t * t) * 1000; out.t = t;
  out.pitch = Math.atan2(vy - g * t, vh); out.vImpact = Math.hypot(vh, vy - g * t);
  return out;
}
/** Position (metres, relative to the release point: d towards the board, y up, l to the right) at time t of that flight. */
export function flightAt(el, yaw, v, t, out = {}) {
  const vh = v * Math.cos(el);
  out.d = vh * Math.cos(yaw) * t; out.l = vh * Math.sin(yaw) * t; out.y = v * Math.sin(el) * t - 0.5 * THROW.g * t * t;
  out.pitch = Math.atan2(v * Math.sin(el) - THROW.g * t, vh);
  return out;
}
/** Distance (mm) from (x, y) to the nearest wire of the spider (rings and the twenty radial wires). */
export function wireDistance(x, y) {
  const r = Math.hypot(x, y);
  let d = Infinity;
  for (const w of [R.bull, R.outerBull, R.trebleIn, R.trebleOut, R.doubleIn, R.doubleOut]) d = Math.min(d, Math.abs(r - w));
  if (r > R.outerBull && r < R.doubleOut) {
    let a = (Math.atan2(x, y) * 180) / Math.PI; a = (((a + 9) % 18) + 18) % 18;        // degrees past the last radial wire
    const da = Math.min(a, 18 - a) * Math.PI / 180;
    d = Math.min(d, r * Math.sin(da));
  }
  return d;
}
/** Does a dart landing here hit a wire and fall out? Wires are ~1 mm of steel: a point within 0.4 mm of one glances
 *  off it a little under half the time (about 1 dart in 45 over the whole board). rng01 in [0, 1). */
export const WIRE_BAND = 0.4;
export function bouncesOut(x, y, rng01) { return wireDistance(x, y) < WIRE_BAND && Math.hypot(x, y) <= R.doubleOut + WIRE_BAND && rng01 < 0.45; }
/** The hand's sway (mm) at time t: slow breathing plus tremor; amp scales it. Pure, so tests can time a release. */
export function sway(t, amp = 1, out = {}) {
  out.x = amp * (5.2 * Math.sin(t * 2.1 + 0.4) + 2.6 * Math.sin(t * 4.7 + 1.9) + 1.1 * Math.sin(t * 11.3));
  out.y = amp * (4.4 * Math.sin(t * 1.55 + 2.2) + 2.4 * Math.sin(t * 3.9 + 0.3) + 1.0 * Math.sin(t * 9.7 + 1.1));
  return out;
}
/** Chalkboard rows for a leg: per player, [{scored, left, bust}] in visit order (real subtraction from the start). */
export function chalkRows(match) {
  const rows = match.names.map(() => []), left = match.names.map(() => match.start);
  for (const h of match.history) { left[h.p] -= h.total; rows[h.p].push({ scored: h.total, left: left[h.p], bust: !!h.bust }); }
  return rows;
}
