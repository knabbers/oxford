// The river steamer "Grandpont Belle" (systems/steamer.js): its timetable, route and deck, as pure functions of the
// shared clock (no Math.random, nothing on the wire) — every player sees her at the same place, and a passenger on one
// client is simply standing on a deck that every other client draws in the same spot.
//
// Route (G: an invented service, c. 2013, of the kind the river steamer firms ran from Folly Bridge): the berth by the Ferryman's
// terrace below Folly Bridge -> down the Isis past Christ Church Meadow and the mouth of the Cherwell -> alongside the
// third boathouse's landing stage on Boathouses Walk. She goes down bow first, winds (turns round) in midstream off the
// boathouses, comes back up bow first, winds again in the wide reach below the terrace and goes astern the last 40 m
// into her berth, bow downstream, ready for the next trip.
//
// Local frame of the boat: u along (+ = bow), w across (+ = port, i.e. left looking forward), y up from the waterline.
// World from local: x = X + sin(h) u + cos(h) w,  z = Z + cos(h) u - sin(h) w  (heading h: forward = (sin h, cos h)).

import { tn } from '../core/features.js';
export const HULL = { L: 21, B: 4.4 };
const hl = HULL.L / 2, hb = HULL.B / 2;
// deck layout (the moving steamer's mesh in steamer.js is built with the same numbers)
export const DECK = {
  main: 0.95, top: 3.05,
  c0: -hl + 3.4, c1: hl - 3.6,           // the saloon (its roof is the top deck)
  cw: hb - 0.85,                         // half width of the saloon: 0.85 m side decks
  wh: [hl - 3.5, hl - 1.9, (hb - 0.85) * 0.8],   // wheelhouse forward (buildSteamer: c1 + 0.9 +- 0.8): u0, u1, half width
  stair: [-hl + 1.0, -hl + 3.4, 0.5],    // companion stair at the stern, centreline: u0 (foot), u1 (head), half width
  funnel: [-1.6, 0, 0.36],              // u, w, r on the top deck ((c0 + c1) / 2 - 1.5)
  canopy: 5.25,
};
export const STOPS = { A: 'Folly Bridge', B: 'the college boathouses' };

// waypoints of the centre line (map x, z). A = the berth by the terrace; W = the winding hole; Bm = midstream off the
// boathouses; B = alongside the stage of the third boathouse (walk coords s 72, o -9.45: _b4_boathouses.js `at`)
const S2 = Math.SQRT1_2;
const walkAt = (s, o) => [629 + S2 * s + S2 * o, 1225 + S2 * s - S2 * o];     // = _b4_boathouses.js at(s, o)
export const A = [284.5, 972.23], W = [310.2, 995.2];
export const B = walkAt(72, -9.45);
export const BM = walkAt(70, -24.2);
const WP = [A, [298.34, 980.27], W, [322, 1001.5], [341, 1016], [362, 1035], [376, 1045.5], [404, 1067], [434, 1091], [468, 1122], [503, 1154], [536, 1176],
  [569, 1201], [598, 1229], walkAt(46, -24.4), BM];

// ---------------------------------------------------------------- the smooth path (Catmull-Rom through the waypoints)
function buildPath(wp) {
  const P = [];
  const n = wp.length;
  const get = (i) => wp[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), steps = Math.max(2, Math.ceil(L / 2));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      P.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  P.push(wp[n - 1].slice());
  const cum = new Float64Array(P.length);
  for (let i = 1; i < P.length; i++) cum[i] = cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  return { P, cum, L: cum[P.length - 1] };
}
export const PATH = buildPath(WP);
/** arc length of W along the path */
export const SW = (() => { let best = 0, bd = 1e9; PATH.P.forEach((p, i) => { const d = Math.hypot(p[0] - W[0], p[1] - W[1]); if (d < bd) { bd = d; best = PATH.cum[i]; } }); return best; })();

/** point and heading at arc length s (out = {x, z, h}); the heading is the tangent over +-3 m (smooth) */
export function along(s, out) {
  const { P, cum, L } = PATH;
  s = s < 0 ? 0 : s > L ? L : s;
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
  out.x = P[lo][0] + (P[hi][0] - P[lo][0]) * t; out.z = P[lo][1] + (P[hi][1] - P[lo][1]) * t;
  const a = pt(Math.max(0, s - 3)), b = pt(Math.min(L, s + 3));
  out.h = Math.atan2(b[0] - a[0], b[1] - a[1]);
  return out;
}
function pt(s) {
  const { P, cum } = PATH;
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
  _pt[0] = P[lo][0] + (P[hi][0] - P[lo][0]) * t; _pt[1] = P[lo][1] + (P[hi][1] - P[lo][1]) * t;
  return _pt === _ptA ? (_pt = _ptB, _ptA) : (_pt = _ptA, _ptB);
}
const _ptA = [0, 0], _ptB = [0, 0]; let _pt = _ptA;

// ---------------------------------------------------------------- the timetable
const VMAX = 3.0, ACC = 0.12, ASTERN = 1.1;     // m/s, m/s^2 (a laden steamer: ~10.8 km/h on the river)
/** time (s) to cover distance d from rest to rest with a trapezoid speed profile; and the distance done at time t */
function runTime(d, v = VMAX, a = ACC) { const ta = v / a, da = v * ta; return d >= da ? 2 * ta + (d - da) / v : 2 * Math.sqrt(d / a); }
function runDist(t, d, v = VMAX, a = ACC) {
  const T = runTime(d, v, a), ta = Math.min(v / a, T / 2), vp = a * ta;
  if (t <= 0) return 0; if (t >= T) return d;
  if (t < ta) return 0.5 * a * t * t;
  if (t < T - ta) return 0.5 * a * ta * ta + vp * (t - ta);
  const r = T - t; return d - 0.5 * a * r * r;
}
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const hB = Math.PI / 4;                     // the berth at the boathouses: along the walk, bow downstream
export const PHASES = (() => {
  const L = PATH.L, d = [];
  d.push({ k: 'dockA', T: 80 });
  d.push({ k: 'down', T: runTime(L) });
  d.push({ k: 'inB', T: 32 });              // midstream -> alongside the stage (sideways, the bow swung onto the berth)
  d.push({ k: 'dockB', T: 60 });
  d.push({ k: 'outB', T: 28 });             // off the stage again
  d.push({ k: 'windB', T: 55 });            // turn round in midstream
  d.push({ k: 'up', T: runTime(L - SW) });  // back up to the winding hole below the terrace
  d.push({ k: 'windA', T: 55 });
  d.push({ k: 'astern', T: runTime(SW, ASTERN, 0.1) });
  let t = 0; for (const p of d) { p.t0 = t; t += p.T; }
  return d;
})();
export const CYCLE = PHASES.reduce((a, p) => a + p.T, 0);   // seconds
export const OFFSET_MS = 41000;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpA = (a, b, t) => a + wrapA(b - a) * t;
const _a = { x: 0, z: 0, h: 0 };

/**
 * Where the Belle is at shared time tMs: out = {x, z, h, phase, docked ('A'|'B'|null), left (s left in this phase),
 * speed (m/s along her heading, + ahead), cycleT (s into the cycle), trip (0..1 along the down / up run)}.
 */
export function steamerAt(tMs, out = {}) {
  let t = ((tMs + OFFSET_MS) / 1000) % CYCLE; if (t < 0) t += CYCLE;
  let ph = PHASES[0];
  for (let i = PHASES.length - 1; i >= 0; i--) if (t >= PHASES[i].t0) { ph = PHASES[i]; break; }
  const lt = t - ph.t0, f = lt / ph.T, L = PATH.L;
  out.phase = ph.k; out.left = ph.T - lt; out.cycleT = t; out.docked = null; out.speed = 0; out.trip = 0;
  switch (ph.k) {
    case 'dockA': along(0, _a); out.x = _a.x; out.z = _a.z; out.h = _a.h; out.docked = 'A'; break;
    case 'down': {
      const s = runDist(lt, L); along(s, _a); out.x = _a.x; out.z = _a.z; out.h = _a.h; out.trip = s / L;
      out.speed = (runDist(lt + 0.25, L) - runDist(lt - 0.25, L)) / 0.5; break;
    }
    case 'inB': case 'outB': {
      along(L, _a); const k = smooth(ph.k === 'inB' ? f : 1 - f);
      out.x = _a.x + (B[0] - _a.x) * k; out.z = _a.z + (B[1] - _a.z) * k; out.h = lerpA(_a.h, hB, k); break;
    }
    case 'dockB': out.x = B[0]; out.z = B[1]; out.h = hB; out.docked = 'B'; break;
    case 'windB': { along(L, _a); out.x = _a.x; out.z = _a.z; out.h = _a.h + Math.PI * smooth(f); break; }      // (turns to port)
    case 'up': {
      const d = L - SW, s = L - runDist(lt, d); along(s, _a); out.x = _a.x; out.z = _a.z; out.h = wrapA(_a.h + Math.PI); out.trip = (L - s) / d;
      out.speed = (runDist(lt + 0.25, d) - runDist(lt - 0.25, d)) / 0.5; break;
    }
    case 'windA': { along(SW, _a); out.x = _a.x; out.z = _a.z; out.h = _a.h + Math.PI - Math.PI * smooth(f); break; }
    case 'astern': {
      const s = SW - runDist(lt, SW, ASTERN, 0.1); along(s, _a); out.x = _a.x; out.z = _a.z; out.h = _a.h;
      out.speed = -(runDist(lt + 0.25, SW, ASTERN, 0.1) - runDist(lt - 0.25, SW, ASTERN, 0.1)) / 0.5; break;
    }
  }
  out.h = wrapA(out.h);
  return out;
}

/** seconds until she next leaves stop 'A' | 'B' (0 while she is leaving), and how long the run to the other stop takes */
export function nextDeparture(tMs, stop) {
  let t = ((tMs + OFFSET_MS) / 1000) % CYCLE; if (t < 0) t += CYCLE;
  const dep = PHASES.find((p) => p.k === (stop === 'A' ? 'down' : 'outB')).t0;
  let wait = dep - t; if (wait < 0) wait += CYCLE;
  return wait;
}
export const RUN_SECS = { AB: PHASES[1].T + PHASES[2].T, BA: PHASES[4].T + PHASES[5].T + PHASES[6].T + PHASES[7].T + PHASES[8].T };

// ---------------------------------------------------------------- the deck
export const toLocal = (X, Z, h, x, z, out) => { const s = Math.sin(h), c = Math.cos(h), dx = x - X, dz = z - Z; out.u = dx * s + dz * c; out.w = dx * c - dz * s; return out; };
export const toWorld = (X, Z, h, u, w, out) => { const s = Math.sin(h), c = Math.cos(h); out.x = X + s * u + c * w; out.z = Z + c * u - s * w; return out; };

/** half width of the walkable main deck at u (inside the rails; the bow narrows to its stem), or -1 off the hull */
function mainHalf(u) {
  if (u < -hl + 0.35 || u > hl - 0.5) return -1;
  const rw = hb - 0.1;
  if (u > hl - 2.6) return rw * (hl - 0.5 - u) / 2.1;
  if (u < -hl + 1.2) return rw * 0.75;
  return rw;
}
/**
 * The deck heights under a local point for a body of radius r: calls fn(top) for each surface there (main deck, the
 * stair, the top deck). Pure, no allocation.
 */
export function surfacesAt(u, w, r, fn) {
  const D = DECK, aw = Math.abs(w);
  const mh = mainHalf(u);
  if (mh > 0 && aw <= mh - r * 0.5) {
    const r2 = r * 0.5;      // (a shoulder may brush the saloon's side: the side decks are narrow, as on the real boats)
    const inCabin = u > D.c0 - r2 && u < D.c1 + r2 && aw < D.cw + r2;
    const inWh = u > D.wh[0] - r2 && u < D.wh[1] + r2 && aw < D.wh[2] + r2;
    const onStair = u >= D.stair[0] && u <= D.stair[1] && aw <= D.stair[2];
    if (!inCabin && !inWh && !onStair) fn(D.main);
  }
  if (u >= D.stair[0] - 0.3 && u <= D.stair[1] + 0.2 && aw <= D.stair[2]) {
    const k = Math.max(0, Math.min(1, (u - D.stair[0]) / (D.stair[1] - D.stair[0])));
    fn(D.main + (D.top - D.main) * k);
  }
  if (u >= D.c0 && u <= D.c1 - r && aw <= D.cw - r * 0.6) {
    const f = D.funnel;
    if (Math.hypot(u - f[0], w - f[1]) > f[2] + r) fn(D.top);
  }
}
/** the highest deck surface under (u, w) that is no more than `reach` above feet height y (relative), else -1 */
export function deckTop(u, w, y, reach, r = 0.32) {
  _best = -1; _lim = y + reach;
  surfacesAt(u, w, r, _take);
  return _best;
}
let _best = -1, _lim = 0;
const _take = (t) => { if (t <= _lim && t > _best) _best = t; };
/** is (u, w) somewhere a passenger whose feet are at y (relative) can stand (a surface within 0.7 m)? */
export function standable(u, w, y, r = 0.32) {
  _ok = false; _y = y;
  surfacesAt(u, w, r, _chk);
  return _ok;
}
let _ok = false, _y = 0;
const _chk = (t) => { if (Math.abs(t - _y) < 0.75) _ok = true; };
/** inside the hull's outline at all (the deck footprint) */
export const inHull = (u, w) => { const m = mainHalf(u); return m > 0 && Math.abs(w) <= hb; };

/** the gangway: the deck end (local) and the shore end (world) at each stop */
export const GANG = {
  A: { deck: [-4.6, -(hb - 0.42)], shore: [278.4, 972.6], shoreH: 0.22 },
  B: { deck: [2.0, hb - 0.42], shore: null, shoreH: 0.2 },
};
// the stage of the boathouse she lies alongside: a point on it opposite her gangway
{
  const s = Math.sin(hB), c = Math.cos(hB), u = GANG.B.deck[0], w = hb + 1.4;
  GANG.B.shore = [B[0] + s * u + c * w, B[1] + c * u - s * w];
}
/** the shore end of the gangway at stop A from the berth pose (it is fixed: the berth never moves) */
{
  const p = { x: 0, z: 0 }; along(0, _a); toWorld(_a.x, _a.z, _a.h, GANG.A.deck[0], -(hb + 1.5), p); GANG.A.shore = [p.x, p.z];
}

/** a few things to look at on the way (s along the path), said once each way as she passes */
export const SIGHTS_ALONG = [
  { s: 40, down: 'The terrace waves you off. Somebody on Folly Bridge is thinking about jumping.', up: tn('Folly Bridge ahead, and the Head of the River\'s terrace. Nearly home.', 'Folly Bridge ahead, and the Ferryman\'s terrace. Nearly home.') },
  { s: 150, down: 'Christ Church Meadow on your left: cows, a long gravel walk, and Merton\'s tower over the trees.', up: 'The meadow on your right now. The cows have not moved.' },
  { s: 330, down: 'The Cherwell comes in on the left, under the trees. Punts that went the wrong way come out of it backwards.', up: 'The mouth of the Cherwell. A punt is going round in circles.' },
  { s: 470, down: 'The college boathouses, one after another: flags, balconies, eights on the racks.', up: 'Leaving the boathouses. A coach on a bike shouts at a crew.' },
];
