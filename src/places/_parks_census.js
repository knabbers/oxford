// Pure logic for "The Parks Census" (owned by places/university_parks.js): the day's dog messes, Dr Sufrin's survey
// route and tally (all derived from the shared game day, so every player sees the same count), and the research
// assistant mission rules. No DOM, no three.js — covered by tools/smoke_parks.mjs.

import { HOUR_S } from '../core/time.js';
export const DAY_SECONDS = 24 * HOUR_S;          // real seconds in one game day (core/time.js)
export const SURVEY = { start: 9.0, end: 17.5 }; // game hours Dr Sufrin is out with his clipboard
export const QUADRAT_SIZE = 70;                   // metres, square sampling frame
// candidate quadrat centres on open lawn inside the Parks (one is chosen per day)
export const QUADRATS = [[735, -645], [630, -690], [480, -795], [390, -870], [525, -900], [600, -810]];
export const SIZES = ['small', 'medium', 'large'];

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const quadratFor = (day) => { const r = mulberry(day * 7919 + 13); return QUADRATS[Math.floor(r() * QUADRATS.length)]; };
export const inQuadrat = (q, x, z) => Math.abs(x - q[0]) <= QUADRAT_SIZE / 2 && Math.abs(z - q[1]) <= QUADRAT_SIZE / 2;

/**
 * The day's messes: some inside today's quadrat (Dr Sufrin's sample) and some scattered about the Parks.
 * ok(x, z) -> true if a point is valid grass (inside the Parks, not water/building/wood). Deterministic in `day`.
 * -> [{id, x, z, born (game hour), size 0..2, inQ}]
 */
export function dailyMesses(day, ok, { inside = 16, outside = 22, bounds = { minX: 10, maxX: 853, minZ: -1131, maxZ: -487 } } = {}) {
  const r = mulberry(day * 104729 + 7), q = quadratFor(day), out = [];
  const place = (inQ) => {
    for (let k = 0; k < 60; k++) {
      const x = inQ ? q[0] + (r() - 0.5) * (QUADRAT_SIZE - 4) : bounds.minX + r() * (bounds.maxX - bounds.minX);
      const z = inQ ? q[1] + (r() - 0.5) * (QUADRAT_SIZE - 4) : bounds.minZ + r() * (bounds.maxZ - bounds.minZ);
      if (!ok(x, z)) continue;
      if (out.some((m) => (m.x - x) ** 2 + (m.z - z) ** 2 < 4)) continue;
      return [x, z];
    }
    return null;
  };
  for (let i = 0; i < inside + outside; i++) {
    const inQ = i < inside, p = place(inQ);
    const born = 7.75 + r() * 9.0, size = Math.min(2, Math.floor(r() * r() * 3.2));
    if (!p) continue;
    out.push({ id: `d${day}-${i}`, x: Math.round(p[0] * 10) / 10, z: Math.round(p[1] * 10) / 10, born: Math.round(born * 100) / 100, size, inQ: inQuadrat(q, p[0], p[1]) });
  }
  return out;
}

/** freshness of a mess at game hour h: 'fresh' within 1.5 game hours of being left, else 'old' */
export const freshness = (m, h) => (h - m.born < 1.5 ? 'fresh' : 'old');

/**
 * Dr Sufrin's day, simulated once from the day's messes: walks (0.75 m/s) to the nearest uncounted mess that exists,
 * crouches and counts it, mutters, and when nothing is left peers at the grass at a quiet spot.
 * Times are in real seconds from the start of the game day (hour * HOUR_S). -> { segs: [{t0, t1, kind:'walk'|'crouch'|'peer', x0,z0,x1,z1, mess?}], counts: [{t, id}], total }
 */
export function surveyPlan(day, messes, { speed = 0.75, crouch = 7, peer = 14 } = {}) {
  const q = quadratFor(day), r = mulberry(day * 31337 + 1);
  const mine = messes.filter((m) => m.inQ);
  const segs = [], counts = [];
  let t = SURVEY.start * HOUR_S, x = q[0] - QUADRAT_SIZE / 2 - 4, z = q[1];   // arrives at the west edge of the frame
  const end = SURVEY.end * HOUR_S, left = new Set(mine.map((m) => m.id));
  const walk = (x1, z1) => { const d = Math.hypot(x1 - x, z1 - z), dt = Math.max(1, d / speed); segs.push({ t0: t, t1: t + dt, kind: 'walk', x0: x, z0: z, x1, z1 }); t += dt; x = x1; z = z1; };
  let guard = 0;
  while (t < end - 30 && guard++ < 500) {
    let best = null, bd = Infinity;
    for (const m of mine) if (left.has(m.id) && m.born * HOUR_S <= t) { const d = Math.hypot(m.x - x, m.z - z); if (d < bd) { bd = d; best = m; } }
    if (best) {
      // stop just short of it (west side), crouch, count
      walk(best.x - 0.55, best.z + 0.15);
      segs.push({ t0: t, t1: t + crouch, kind: 'crouch', x0: x, z0: z, x1: x, z1: z, mess: best.id });
      t += crouch; counts.push({ t, id: best.id }); left.delete(best.id);
    } else {
      // peer at the grass somewhere in the frame
      walk(q[0] + (r() - 0.5) * (QUADRAT_SIZE - 10), q[1] + (r() - 0.5) * (QUADRAT_SIZE - 10));
      segs.push({ t0: t, t1: t + peer, kind: 'peer', x0: x, z0: z, x1: x, z1: z });
      t += peer;
    }
  }
  return { segs, counts, total: counts.length, quadrat: q };
}

/** where he is at second-of-day s -> {x, z, kind, mess, heading, moving} or null outside survey hours */
export function sufrinAt(plan, s) {
  const S = plan.segs;
  if (!S.length || s < S[0].t0 || s >= S[S.length - 1].t1) return null;
  let lo = 0, hi = S.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (S[mid].t0 <= s) lo = mid; else hi = mid - 1; }
  const g = S[lo], k = g.t1 > g.t0 ? Math.min(1, (s - g.t0) / (g.t1 - g.t0)) : 1;
  const dx = g.x1 - g.x0, dz = g.z1 - g.z0;
  return { x: g.x0 + dx * k, z: g.z0 + dz * k, kind: g.kind, mess: g.mess || null, heading: g.kind === 'walk' && (dx || dz) ? Math.atan2(dx, dz) : null, moving: g.kind === 'walk', seg: lo };
}
/** ids he has counted by second-of-day s */
export function countedBy(plan, s) { const out = new Set(); for (const c of plan.counts) { if (c.t > s) break; out.add(c.id); } return out; }
/** the figure he quotes: today's tally so far, and yesterday's total (deterministic from the day) */
export const tallyAt = (plan, s) => countedBy(plan, s).size;

// --------------------------------------------------------------------------------------------- the mission
export const MISSION = { basic: { target: 6, time: 180, pay: 5 }, classify: { target: 5, time: 210, pay: 9 } };

/**
 * Research-assistant run. Messes are passed in on each call (shared daily ones + local fresh ones), so the rules don't
 * depend on rendering. time = seconds (any monotonic clock).
 */
export class Census {
  constructor(variant = 'basic', t0 = 0) {
    const M = MISSION[variant]; this.variant = variant; this.target = M.target; this.limit = M.time; this.pay = M.pay;
    this.t0 = t0; this.logged = new Set(); this.score = 0; this.steps = 0; this.misclass = 0; this.state = 'running'; this.lastStep = -99; this.trodden = new Set();
  }
  timeLeft(t) { return Math.max(0, this.limit - (t - this.t0)); }
  /** can `m` be recorded? -> null if ok, else a reason string */
  why(m, counted) {
    if (this.state !== 'running') return 'The survey is over.';
    if (!m.inQ) return 'outside';
    if (this.trodden.has(m.id)) return 'trodden';
    if (this.logged.has(m.id)) return 'logged';
    if (counted.has(m.id)) return 'counted';
    return null;
  }
  /** record mess m. guess = {size, fresh} for the classify variant; truth = {size, fresh}. -> {ok, reason?, delta} */
  record(m, counted, t, guess = null, truth = null) {
    if (this.tick(t) !== 'running') return { ok: false, reason: 'over', delta: 0 };
    const why = this.why(m, counted);
    if (why) return { ok: false, reason: why, delta: 0 };
    this.logged.add(m.id);
    let delta = 1;
    if (this.variant === 'classify') {
      if (!guess || !truth || guess.size !== truth.size || guess.fresh !== truth.fresh) { delta = -0.5; this.misclass++; }
    }
    this.score = Math.max(0, this.score + delta);
    if (this.score >= this.target) this.state = 'won';
    return { ok: true, delta };
  }
  /** the player stood at (x,z): any mess within r underfoot? -> the mess trodden in, or null */
  step(x, z, messes, t, r = 0.28) {
    if (this.state !== 'running' || t - this.lastStep < 2.5) return null;
    for (const m of messes) {
      if (this.trodden.has(m.id)) continue;
      if ((m.x - x) ** 2 + (m.z - z) ** 2 < r * r) {
        this.trodden.add(m.id); this.steps++; this.lastStep = t;
        this.score = Math.max(0, this.score - 1);
        return m;
      }
    }
    return null;
  }
  tick(t) { if (this.state === 'running' && t - this.t0 >= this.limit) this.state = 'lost'; return this.state; }
  /** payment on reporting back */
  payout() { if (this.state !== 'won') return Math.round(this.score * 0.5 * 100) / 100; return this.pay + Math.max(0, 2 - this.steps) + (this.variant === 'classify' && !this.misclass ? 3 : 0); }
}

/** league table on a plain object (game.state.parks): keeps the best 8 runs */
export function addToLeague(st, entry) {
  st.league = st.league || [];
  st.league.push(entry);
  st.league.sort((a, b) => b.score - a.score || a.steps - b.steps || a.day - b.day);
  st.league.length = Math.min(st.league.length, 8);
  st.runs = (st.runs || 0) + 1; st.total = (st.total || 0) + Math.floor(entry.score);
  return st.league.indexOf(entry);
}

// Dr Sufrin's remarks (dry; formal methods: he wrote an early Z handbook at Oxford's Programming Research Group and
// built the JAPE proof editor; CSP is his research area). All affectionate.
export const MUTTER = [
  'The fourteenth. Index thirteen, naturally.', 'Let Mess == [ x, y : ℝ; t : Time ]. Nothing more is required.',
  'Precondition: dog. Postcondition: mess. Invariant: nobody has a bag.', 'A fencepost error is the occupational hazard of the tally mark.',
  'Random sample. Well — pseudo-random. Seeded with the date.', 'ΔPark, ΞDog. The dog changes the Park. The Park does not change the dog.',
  'Mode: Labrador. As predicted.', 'Not a deposit. A conker. Unlogged.', 'A tally mark is not a proof. But it is evidence.',
  'The bins are provided. Observably provided.', 'Walker and dog synchronise on the event "stop". Then they do not.',
  'If JAPE could prove this lawn clean, I should be delighted.', 'Note: one specimen, sub-category "regrettable".',
  'The specification says "under control". The implementation differs.',
];
export const AT_MESS = ['Hm.', 'There we are.', 'Another.', 'One more for the ledger.', 'Fresh. Noted.', 'Counted.', 'Mark.'];
export const AT_WALKER = ['Good morning.', 'Do you have a bag?', 'Splendid animal. Remarkable output.', 'Don\'t mind me. Purely observational.', 'Carry on — as you were.'];
export const WALKER_SHEEPISH = ['Oh! I was just about to pick that up.', "Sorry — got a bag, got a bag!", 'He never does that normally.', "It's not mine. I mean — it is. Sorry.", '*hurriedly bags it*'];
