// Purple Turtle — pure rules (no DOM, no three.js): opening hours, crowd density, the door policy, the drinks and the
// college-shots menu, the deterministic schedule of people leaving (and couples going home together), walking timelines,
// the dance rhythm minigame and table football. Covered by tools/smoke_pt.mjs.

import { HOUR_MS, DAY_MS } from '../core/time.js'; export { HOUR_MS, DAY_MS };   // the length of a game hour is set in core/time.js
export const OPEN_H = 21.5, CLOSE_H = 3.0, LAST_ENTRY_H = 2.5, FREE_UNTIL_H = 22.5, ENTRY_FEE = 3;
export const NIGHT_LEN = 24 - OPEN_H + CLOSE_H;    // 5.5 game hours

// ------------------------------------------------------------------------------------------------ hashing
export function hash(...v) {
  let h = 2166136261 >>> 0;
  for (const x of v) {
    const s = typeof x === 'number' ? Math.round(x * 1000) : String(x);
    const str = String(s);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x9e; h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export function rng(seed) {
  let a = Math.floor(hash(seed) * 4294967296) >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
function pw(h, pts) {   // piecewise-linear over [[x,y],...]
  if (h <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (h <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return lerp(y0, y1, (h - x0) / (x1 - x0)); }
  return pts[pts.length - 1][1];
}

// ------------------------------------------------------------------------------------------------ the clock
/** game hours since doors opened at 21:30 (0..24) */
export function nightHours(h) { return (((h - OPEN_H) % 24) + 24) % 24; }
export function isOpen(h) { return nightHours(h) < NIGHT_LEN; }
export function hourOf(now) { return ((((now % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS) * 24; }
export function nightIndex(now) { return Math.floor((now - OPEN_H * HOUR_MS) / DAY_MS); }
export function nightStart(n) { return n * DAY_MS + OPEN_H * HOUR_MS; }
/** "23:30" */
export function clockStr(h) { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.floor((h - H) * 60); return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; }

/** how full the club is, 0..1: empty at 21:30, rammed 23:30-01:30, thinning to closing */
export function density(h) {
  if (!isOpen(h)) return 0;
  return pw(nightHours(h), [[0, 0.04], [0.5, 0.12], [1, 0.3], [1.5, 0.55], [2, 1], [4, 1], [4.5, 0.75], [5, 0.5], [5.5, 0.3]]);
}
/** people in the queue outside: a few early, grows 22:30-00:30, gone after last entry */
export function queueLen(h) {
  if (!isOpen(h)) return 0;
  const n = nightHours(h);
  if (n >= LAST_ENTRY_H + 24 - OPEN_H) return 0;
  return Math.round(pw(n, [[0, 0], [0.5, 1], [1, 4], [2, 8], [3, 12], [3.5, 9], [4, 4], [4.5, 2], [5, 0]]));
}
/** how dishevelled the clubwear is: 0 at opening .. 1 by closing (passed to randomLook as `state`) */
export function lookState(h) { return isOpen(h) ? clamp(nightHours(h) / NIGHT_LEN, 0, 1) : 0.6; }
/** seconds between admissions at the door */
export const ADMIT_MS = 5500;

// ------------------------------------------------------------------------------------------------ the door
/**
 * What the bouncers say. opts: {hour, drunk 0..1, stamped (this night), money}
 * -> {ok, lines:[...], fee, reason}
 */
export function doorCheck({ hour, drunk = 0, stamped = false, money = 99 }) {
  if (!isOpen(hour)) return { ok: false, reason: 'closed', fee: 0, lines: ["We're shut, mate. Doors at half nine."] };
  const n = nightHours(hour);
  if (stamped) {
    if (drunk > 0.85) return { ok: false, reason: 'drunk', fee: 0, lines: ['Stamp or no stamp — not tonight, mate. Get some water.'] };
    return { ok: true, reason: 'stamp', fee: 0, lines: ["Stamp? Go on then."] };
  }
  if (n >= LAST_ENTRY_H + 24 - OPEN_H) return { ok: false, reason: 'late', fee: 0, lines: ['Last entry was half two, mate. Not tonight.'] };
  if (drunk > 0.65) return { ok: false, reason: 'drunk', fee: 0, lines: ['Have you had a few?', 'Not tonight mate.'] };
  const fee = n < FREE_UNTIL_H - OPEN_H ? 0 : ENTRY_FEE;
  if (fee > money) return { ok: false, reason: 'money', fee, lines: ['ID please.', `It's £${fee} on the door. Cash machine's on Cornmarket.`] };
  return { ok: true, reason: 'ok', fee, lines: ['ID please.', 'Bod card?', fee ? `Three quid, ta. Left hand for the stamp.` : 'Free before half ten. Left hand — stamp.'] };
}

// ------------------------------------------------------------------------------------------------ drinks
// Drunkenness steps match places/worcester_bar.js (pint +0.12, Sting +0.20, soft −0.02); that module also owns the
// global sober-up rate, so nothing here decays `drunk` (sitting down / water sober you a little extra).
export const DRINKS = {
  pint: { name: 'a pint of lager', price: 2.5, drunk: 0.12, liquid: 0xd8901e, kind: 'pint' },
  cider: { name: 'a cider and black', price: 2.6, drunk: 0.12, liquid: 0x8a2a4a, kind: 'pint' },
  snakebite: { name: 'a snakebite and black', price: 2.8, drunk: 0.15, liquid: 0x6a1f3a, kind: 'pint' },
  vodka: { name: 'a vodka lemonade', price: 2.0, drunk: 0.12, liquid: 0xe9eef8, kind: 'glass' },
  gin: { name: 'a gin and tonic', price: 2.5, drunk: 0.12, liquid: 0xdff0ea, kind: 'glass' },
  rum: { name: 'a rum and cola', price: 2.5, drunk: 0.12, liquid: 0x2a1408, kind: 'glass' },
  alcopop: { name: 'a blue alcopop', price: 2.2, drunk: 0.09, liquid: 0x2a9ae8, kind: 'glass' },
  jager: { name: 'a jägerbomb', price: 2.5, drunk: 0.18, liquid: 0x3a1e0e, kind: 'glass' },
  cocktail: { name: 'a pint of cocktail', price: 5.0, drunk: 0.2, liquid: 0xe0406a, kind: 'pint' },
  shot: { name: 'a shot', price: 1.5, drunk: 0.1, liquid: 0x2a8ad0, kind: 'shot' },
  water: { name: 'a cup of tap water', price: 0, drunk: -0.04, liquid: 0xdde8f0, kind: 'glass' },
};
export const SIT_SOBER_PER_S = 0.002;          // extra sobering while sitting on a sofa

/**
 * One shot per college (the 38 colleges of 2013). The Turtle really did sell "a different shot for each Oxford college"
 * (Cherwell, 8 Sep 2016) but NO source lists the names or recipes: every name and recipe below is INVENTED, each a nod to
 * something the college is known for.
 */
export const SHOTS = [
  ['All Souls', 'The Fellowship', 'Sloe gin. You have to sit an exam to order it.', 0x5a1030],
  ['Balliol', 'Balliol Blue', 'Vodka and blue curaçao.', 0x1f5fd0],
  ['Brasenose', 'The Brazen Nose', 'Cinnamon schnapps, knocked back like the door-knocker.', 0xc8862a],
  ['Christ Church', 'The House', 'Butterscotch schnapps, served with a raised eyebrow.', 0xd9a441],
  ['Corpus Christi', 'Tortoise Race', 'Sour apple. Drink it slowly.', 0x7ccf3a],
  ['Exeter', "Rector's Fireball", 'Cinnamon whisky.', 0xa8341c],
  ['Green Templeton', 'The Observatory', 'Herbal green liqueur, star-gazing optional.', 0x3f8f4a],
  ['Harris Manchester', 'Mature Student', 'Tawny port. Sensible.', 0x6a1f1a],
  ['Hertford', 'Bridge of Sighs', 'Layered blue curaçao and cream liqueur.', 0x7ab0e0],
  ['Jesus', 'Welsh Dragon', 'Red sambuca.', 0xc0182a],
  ['Keble', 'Keble Brick', 'Grenadine and peach schnapps in stripes, like the walls.', 0xc5503a],
  ['Kellogg', 'Night School', 'Coffee liqueur.', 0x3a2414],
  ['Lady Margaret Hall', 'The LMH Trek', 'Jäger and energy drink — for the walk home.', 0x4a2a14],
  ['Linacre', 'Linacre Lime', 'Lime vodka.', 0x9fd84a],
  ['Lincoln', 'Deep Hall', 'Dark rum.', 0x7a3a12],
  ['Magdalen', 'Deer Park', 'Jägermeister. There is a stag on the bottle.', 0x3a1e0e],
  ['Mansfield', 'Mansfield Mint', 'Peppermint schnapps.', 0x60e0b0],
  ['Merton', 'Time Ceremony', 'Layered backwards: the cream goes in last.', 0xd06070],
  ['New College', 'New College Old', 'Whisky. The college dates from 1379.', 0xc08a30],
  ['Nuffield', 'Nuffield Spire', 'Gin and elderflower.', 0xe8f0d0],
  ['Oriel', 'Head of the River', 'Blue raspberry vodka.', 0x3a7ae8],
  ['Pembroke', 'One Shot to Rule Them All', 'Gold schnapps (Tolkien was a fellow).', 0xe0c040],
  ["Queen's", "Boar's Head", 'Spiced rum.', 0x9a5a22],
  ["St Anne's", "Anne's Espresso", 'Espresso vodka.', 0x2a1a10],
  ["St Antony's", 'The Cold War', 'Vodka, straight from the freezer.', 0xeaf2f6],
  ["St Catherine's", 'Catz Concrete', 'Cream liqueur, grey and modernist.', 0xcab8a0],
  ['St Cross', 'The Crossover', 'Half rum, half vodka.', 0xd8c8a0],
  ['St Edmund Hall', 'Teddy Hall Tackle', 'Tequila. Rugby rules.', 0xf0e0a0],
  ["St Hilda's", "Hilda's Punt", 'Melon liqueur.', 0x6ad060],
  ["St Hugh's", 'The Long Walk', 'Limoncello — it is a long way up the Banbury Road.', 0xf0e040],
  ["St John's", 'The Endowment', 'Schnapps with gold flakes, naturally.', 0xf0d060],
  ["St Peter's", "Peter's Pocket", 'Sour cherry.', 0xa01830],
  ['Somerville', 'Somerville Sour', 'Amaretto sour.', 0xd89040],
  ['Trinity', 'Keep Off The Lawn', 'Apple schnapps.', 0x8ad040],
  ['University College', 'The Shelley Memorial', 'Pear drop.', 0xd0e070],
  ['Wadham', 'Wadham Rainbow', 'Layered rainbow, in honour of the Queer Bop.', 0xd060c0],
  ['Wolfson', 'Wolfson Harbour', 'Blue gin.', 0x5aa0d0],
  ['Worcester', 'The Lake', 'Blue curaçao and lemonade. A tiny rubber duck if you are lucky.', 0x2a8ad0],
].map(([college, name, recipe, color]) => ({ college, name, recipe, color }));
export const COLLEGES = SHOTS.map((s) => s.college);
export function shotFor(college) { return SHOTS.find((s) => s.college.toLowerCase() === String(college || '').toLowerCase()) || null; }
/** "Sorting Hat" lucky dip (the Turtle also sold Harry Potter-themed shots): a college shot picked by the hat */
export function sortingHat(seed) { return SHOTS[Math.floor(hash('hat', seed) * SHOTS.length)]; }

// ------------------------------------------------------------------------------------------------ leaving the club
export const LEAVE_SLOT_MS = 6000;
/**
 * Everyone who leaves through the door during night n, deterministic from the shared clock.
 * nDest = number of walk-home destinations. -> [{id, t (ms), h (hour), kind, n, seeds[], couple, dest, chips, kiss, speed}]
 * kind: 'single' | 'pair' (friends) | 'group' (3-4) | 'couple' (two people going home together).
 */
export function leaversForNight(n, nDest = 12) {
  const out = [], t0 = nightStart(n), slots = Math.ceil((NIGHT_LEN * HOUR_MS) / LEAVE_SLOT_MS);
  const push = (k, t, closing) => {
    const r = rng(`pt-leave|${n}|${k}`), nh = (t - t0) / HOUR_MS;
    let p = pw(nh, [[0, 0.01], [0.75, 0.03], [1.5, 0.07], [2.5, 0.13], [3.5, 0.2], [4.5, 0.26], [5.5, 0.3]]);
    if (closing) p = 1;
    if (r() > p) return;
    const late = nh >= 3.5;                     // after 01:00
    const pc = closing ? 0.4 : late ? 0.42 : nh >= 2.5 ? 0.22 : 0.12;
    const x = r();
    const kind = x < pc ? 'couple' : x < pc + 0.25 ? 'pair' : x < pc + 0.45 ? 'group' : 'single';
    const size = kind === 'single' ? 1 : kind === 'group' ? 3 + (r() < 0.4 ? 1 : 0) : 2;
    const seeds = []; for (let i = 0; i < size; i++) seeds.push(Math.floor(r() * 1e9));
    const couple = kind === 'couple';
    const tt = Math.round(t + r() * (closing ? 1500 : LEAVE_SLOT_MS * 0.8));
    out.push({ id: `${n}:${k}`, t: tt, h: (OPEN_H + (tt - t0) / HOUR_MS) % 24, kind, n, seeds, couple, dest: Math.floor(r() * nDest),
      chips: couple && r() < 0.55, kiss: couple, speed: couple ? 1.05 + r() * 0.15 : 1.0 + r() * 0.3, hold: couple ? (r() < 0.5 ? 'arm' : 'hand') : null });
  };
  for (let k = 0; k < slots; k++) push(k, t0 + k * LEAVE_SLOT_MS, false);
  // closing time: lights up, everyone out over a minute and a half
  for (let k = 0; k < 10; k++) push(1000 + k, t0 + NIGHT_LEN * HOUR_MS + k * 2500, true);
  out.sort((a, b) => a.t - b.t);
  return out;
}

// ------------------------------------------------------------------------------------------------ walking timelines
/**
 * A walk along a polyline with stops. cum = cumulative lengths of the path; stops = [{s, dur, tag}] (sorted by s);
 * -> {segs:[{t0,t1,s0,s1,tag}], T}
 */
export function makeTimeline(total, stops, speed) {
  const segs = []; let t = 0, s = 0;
  for (const st of stops) {
    const ss = clamp(st.s, s, total);
    if (ss > s) { const d = (ss - s) / speed; segs.push({ t0: t, t1: t + d, s0: s, s1: ss, tag: 'walk' }); t += d; s = ss; }
    segs.push({ t0: t, t1: t + st.dur, s0: s, s1: s, tag: st.tag }); t += st.dur;
  }
  if (total > s) { const d = (total - s) / speed; segs.push({ t0: t, t1: t + d, s0: s, s1: total, tag: 'walk' }); t += d; }
  return { segs, T: t };
}
/** -> {s, tag, phase 0..1 (within the current segment), done} written into `out` */
export function evalTimeline(tl, t, out = {}) {
  if (t >= tl.T) { const l = tl.segs[tl.segs.length - 1]; out.s = l ? l.s1 : 0; out.tag = 'done'; out.phase = 1; out.done = true; return out; }
  out.done = false;
  for (const g of tl.segs) {
    if (t < g.t1 || g === tl.segs[tl.segs.length - 1]) {
      const ph = g.t1 > g.t0 ? clamp((t - g.t0) / (g.t1 - g.t0), 0, 1) : 1;
      out.s = lerp(g.s0, g.s1, ph); out.tag = g.tag; out.phase = ph; return out;
    }
  }
  return out;
}
/** point on a polyline at arc length s: pts [[x,z]..], cum [..] -> writes {x, z, h} (h = heading of travel) */
export function pointAt(pts, cum, s, out = {}) {
  const n = pts.length;
  if (n === 1 || s <= 0) { out.x = pts[0][0]; out.z = pts[0][1]; out.h = n > 1 ? Math.atan2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) : 0; return out; }
  let i = 1; while (i < n - 1 && cum[i] < s) i++;
  const a = pts[i - 1], b = pts[i], L = cum[i] - cum[i - 1], f = L > 0 ? clamp((s - cum[i - 1]) / L, 0, 1) : 1;
  out.x = a[0] + (b[0] - a[0]) * f; out.z = a[1] + (b[1] - a[1]) * f; out.h = Math.atan2(b[0] - a[0], b[1] - a[1]);
  return out;
}
export function cumLen(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }

/** A* over the pedestrian graph {X, Z, start, nbr, count}. -> array of node indices or null */
export function graphPath(G, a, b, maxExpand = 60000) {
  if (a < 0 || b < 0) return null;
  if (a === b) return [a];
  const N = G.count, g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [], hx = G.X[b], hz = G.Z[b];
  const hf = (i) => Math.hypot(G.X[i] - hx, G.Z[i] - hz);
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  g[a] = 0; push(a, hf(a)); let exp = 0;
  while (heap.length) {
    const [, u] = pop(); if (closed[u]) continue; closed[u] = 1;
    if (u === b) break;
    if (++exp > maxExpand) return null;
    for (let e = G.start[u]; e < G.start[u + 1]; e++) {
      const v = G.nbr[e]; if (closed[v]) continue;
      const d = g[u] + Math.hypot(G.X[v] - G.X[u], G.Z[v] - G.Z[u]);
      if (d < g[v]) { g[v] = d; prev[v] = u; push(v, d + hf(v)); }
    }
  }
  if (!closed[b]) return null;
  const out = []; for (let v = b; v >= 0; v = prev[v]) { out.push(v); if (v === a) break; }
  return out.reverse();
}
export function nearestGraphNode(G, x, z, r = 30) {
  let best = -1, bd = r * r;
  for (let i = 0; i < G.count; i++) { const dx = G.X[i] - x, dz = G.Z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
  return best;
}

// ------------------------------------------------------------------------------------------------ dance minigame
export const DANCE_DIRS = ['left', 'down', 'up', 'right'];
export const DANCE_WIN = { perfect: 0.075, good: 0.16 };
/**
 * Rhythm game on the beat of the current track. Prompts land on beats (every beat once warmed up, some off-beat
 * eighths later on). Times are in seconds on the music clock.
 */
export class DanceGame {
  constructor({ bpm = 124, start = 0, seed = 1, length = 64, drunk = 0 } = {}) {
    this.bpm = bpm; this.spb = 60 / bpm; this.start = start; this.drunk = drunk;
    this.notes = []; const r = rng('dance|' + seed);
    for (let b = 4; b < length; b++) {
      const every = b < 16 ? 2 : 1;
      if (b % every) continue;
      this.notes.push({ t: start + b * this.spb, dir: DANCE_DIRS[Math.floor(r() * 4)], hit: null });
      if (b >= 32 && r() < 0.25) this.notes.push({ t: start + (b + 0.5) * this.spb, dir: DANCE_DIRS[Math.floor(r() * 4)], hit: null });
    }
    this.score = 0; this.streak = 0; this.best = 0; this.perfect = 0; this.good = 0; this.miss = 0; this.next = 0;
    this.end = start + length * this.spb + 1;
  }
  get mult() { return 1 + Math.min(3, Math.floor(this.streak / 8)); }
  _miss(n) { n.hit = 'miss'; this.miss++; this.streak = 0; }
  /** advance the clock: notes that slid past the window are misses. returns number of new misses */
  update(t) {
    let m = 0;
    while (this.next < this.notes.length && this.notes[this.next].t < t - DANCE_WIN.good) { const n = this.notes[this.next++]; if (!n.hit) { this._miss(n); m++; } }
    return m;
  }
  /** a key press at time t. -> 'perfect' | 'good' | 'miss' | null (nothing near) */
  press(dir, t) {
    this.update(t);
    let best = null, bd = Infinity;
    for (let i = this.next; i < this.notes.length; i++) {
      const n = this.notes[i]; if (n.t > t + DANCE_WIN.good * 1.5) break;
      if (n.hit) continue;
      const d = Math.abs(n.t - t); if (d < bd) { bd = d; best = n; }
    }
    if (!best || bd > DANCE_WIN.good * 1.5) return null;
    if (best.dir !== dir || bd > DANCE_WIN.good) { this._miss(best); return 'miss'; }
    const q = bd <= DANCE_WIN.perfect ? 'perfect' : 'good';
    best.hit = q;
    if (q === 'perfect') this.perfect++; else this.good++;
    this.streak++; this.best = Math.max(this.best, this.streak);
    this.score += (q === 'perfect' ? 100 : 50) * this.mult;
    return q;
  }
  done(t) { return t >= this.end; }
  /** visual wobble (beats) of a prompt for the drunk-o-meter */
  wobble(t, i) { return this.drunk > 0.2 ? Math.sin(t * 3.1 + i * 1.7) * 0.35 * this.drunk : 0; }
  /** an onlooker circle forms on a good streak */
  get crowdDraw() { return this.streak >= 8; }
}
/** Legend points earned from a finished dance */
export function legendGain(g) {
  const acc = g.notes.length ? (g.perfect + g.good * 0.6) / g.notes.length : 0;
  return (g.best >= 16 ? 1 : 0) + (g.best >= 32 ? 1 : 0) + (acc > 0.85 ? 1 : 0);
}

// ------------------------------------------------------------------------------------------------ table football
// Top-down, table units: x ∈ [-1,1] (your goal at x=-1), y ∈ [-0.6,0.6]. Two rods a side: keeper (1 man) and attack (3 men).
export const FOOS = { W: 1, H: 0.6, goal: 0.2, ball: 0.035, man: 0.045, rods: { you: [-0.8, 0.25], them: [0.8, -0.25] }, men: [[0], [-0.3, 0, 0.3]], travel: [0.5, 0.26], toWin: 5 };
export function foosNew(seed = 1) {
  const r = rng('foos|' + seed);
  return { bx: 0, by: 0, vx: (r() < 0.5 ? -1 : 1) * 0.5, vy: (r() - 0.5) * 0.6, you: 0, them: 0, yRod: 0, tRod: 0, yKick: 0, tKick: 0, score: [0, 0], serve: 0.8, over: false, r, aiLag: 0 };
}
/** input: {aim: target rod offset (-1..1), kick: bool}. dt in seconds. returns 'you' | 'them' | null on a goal */
export function foosStep(s, dt, input = {}) {
  if (s.over) return null;
  const F = FOOS;
  if (s.serve > 0) { s.serve -= dt; if (s.serve > 0) return null; }
  // rods
  const aim = clamp(input.aim || 0, -1, 1);
  s.yRod += clamp(aim - s.yRod, -6 * dt, 6 * dt);
  if (input.kick && s.yKick <= 0) s.yKick = 0.25;
  s.yKick = Math.max(0, s.yKick - dt); s.tKick = Math.max(0, s.tKick - dt);
  // opponent: tracks the ball with a lag, kicks when it's near its men
  s.aiLag -= dt;
  if (s.aiLag <= 0) { s.aiLag = 0.12; s.aiTarget = clamp(s.by / F.travel[1] * 0.9 + (s.r() - 0.5) * 0.3, -1, 1); }
  s.tRod += clamp((s.aiTarget || 0) - s.tRod, -4 * dt, 4 * dt);
  // ball
  const sub = 4; let goal = null;
  for (let k = 0; k < sub && !goal; k++) {
    const h = dt / sub;
    s.bx += s.vx * h; s.by += s.vy * h;
    const fr = Math.pow(0.6, h); s.vx *= fr; s.vy *= fr;
    if (s.by > F.H - F.ball) { s.by = F.H - F.ball; s.vy = -Math.abs(s.vy) * 0.85; }
    if (s.by < -F.H + F.ball) { s.by = -F.H + F.ball; s.vy = Math.abs(s.vy) * 0.85; }
    if (Math.abs(s.bx) > F.W - F.ball) {
      if (Math.abs(s.by) < F.goal) { goal = s.bx < 0 ? 'them' : 'you'; break; }
      s.bx = Math.sign(s.bx) * (F.W - F.ball); s.vx = -s.vx * 0.85;
    }
    // men
    for (const side of ['you', 'them']) {
      const rods = F.rods[side], off = side === 'you' ? s.yRod : s.tRod, kick = side === 'you' ? s.yKick : s.tKick, dirx = side === 'you' ? 1 : -1;
      for (let ri = 0; ri < 2; ri++) {
        const rx = rods[ri];
        for (const m of F.men[ri]) {
          const my = m + off * F.travel[ri], dx = s.bx - rx, dy = s.by - my, d = Math.hypot(dx, dy), R = F.ball + F.man;
          if (d < R && d > 1e-6) {
            const nx = dx / d, ny = dy / d; s.bx = rx + nx * R; s.by = my + ny * R;
            const vn = s.vx * nx + s.vy * ny; if (vn < 0) { s.vx -= 1.8 * vn * nx; s.vy -= 1.8 * vn * ny; }
            if (kick > 0) { s.vx = dirx * (1.6 + 0.6 * kick * 4); s.vy += ny * 0.6; }
            else if (side === 'them' && s.tKick <= 0 && Math.sign(dx) === dirx) { s.tKick = 0.25; s.vx = dirx * (1.3 + s.r() * 0.6); s.vy += (s.r() - 0.5) * 0.9; }
          }
        }
      }
    }
  }
  // stuck ball: nudge it
  if (!goal && Math.hypot(s.vx, s.vy) < 0.03) { s.vx += (s.r() - 0.5) * 0.4; s.vy += (s.r() - 0.5) * 0.4; }
  if (goal) {
    if (goal === 'you') s.score[0]++; else s.score[1]++;
    s.bx = 0; s.by = 0; s.vx = (goal === 'you' ? -1 : 1) * 0.5; s.vy = (s.r() - 0.5) * 0.6; s.serve = 1.0;
    if (s.score[0] >= FOOS.toWin || s.score[1] >= FOOS.toWin) s.over = true;
  }
  return goal;
}
