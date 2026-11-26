// Museums: pure rules (no DOM, no three) shared by natural_history_museum.js and ashmolean.js; covered by
// tools/smoke_museums.mjs. Opening hours, the museum trail, the attendants' patience, the Alfred Jewel alarm, and the
// multi-storey floor model used by every museum interior (Floors).

/** opening hours (game hour, 0-24) c. 2013 — every day (the real Monday hours are ignored, see docs/research/museums.md) */
export const HOURS = {
  mus_nhm: { open: 10, close: 17, name: 'the Museum of Natural History' },
  mus_pitt: { open: 10, close: 16.5, name: 'the Pitt Rivers Museum' },
  mus_ash: { open: 10, close: 17, name: 'the Ashmolean' },
};
export const isOpen = (id, hour) => { const h = HOURS[id]; return !!h && hour >= h.open && hour < h.close; };
const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
export const hoursText = (id) => { const h = HOURS[id]; return `${hm(h.open)}–${hm(h.close)}`; };
/** the notice on a locked door */
export function closedNotice(id, hour) {
  const h = HOURS[id];
  if (!h) return 'Closed.';
  const when = hour < h.open ? `Opens at ${hm(h.open)}.` : `Closed. Open daily ${hoursText(id)}.`;
  return `A notice on the door: "${when} Please do not lean on the doorbell, it is also an exhibit."`;
}

// ------------------------------------------------------------------------------------------------ the museum trail
/** six named exhibits across the three museums; find them all, then hand the leaflet in at any front desk */
export const TRAIL = [
  { id: 'dodo', museum: 'mus_nhm', name: 'The Oxford Dodo', clue: 'A bird that missed the boat. Central aisle, Natural History.' },
  { id: 'trex', museum: 'mus_nhm', name: 'Tyrannosaurus rex', clue: 'Rearing up by the front door, Natural History. Do not feed.' },
  { id: 'totem', museum: 'mus_pitt', name: 'The Haida house post', clue: 'Eleven metres of carved cedar at the far end of the Pitt Rivers.' },
  { id: 'witch', museum: 'mus_pitt', name: 'Witch in a bottle', clue: 'Pitt Rivers, upper gallery. Do NOT open it.' },
  { id: 'jewel', museum: 'mus_ash', name: 'The Alfred Jewel', clue: 'Ashmolean, second floor, England 400–1600. Look, do not take.' },
  { id: 'shrine', museum: 'mus_ash', name: 'The Shrine of Taharqa', clue: 'A whole temple in a room. Ashmolean, ground floor, Egypt: beyond the statues.' },
];
export const TRAIL_PRIZE = 10;
/** trail state lives in game.state.flags.musTrail = { has: bool, found: [ids], done: bool } */
export function trailState(flags) {
  const t = flags.musTrail || (flags.musTrail = { has: false, found: [], done: false });
  if (!Array.isArray(t.found)) t.found = [];
  return t;
}
/** -> 'no-leaflet' | 'already' | 'found' | 'complete' (the last find) */
export function trailFind(flags, id) {
  const t = trailState(flags);
  if (!TRAIL.some((e) => e.id === id)) return 'unknown';
  if (!t.has || t.done) return t.done ? 'already' : 'no-leaflet';
  if (t.found.includes(id)) return 'already';
  t.found.push(id);
  return t.found.length >= TRAIL.length ? 'complete' : 'found';
}
/** hand the leaflet in: -> prize (0 if not complete / already paid) */
export function trailClaim(flags) {
  const t = trailState(flags);
  if (t.done || !t.has || t.found.length < TRAIL.length) return 0;
  t.done = true;
  return TRAIL_PRIZE;
}

// ------------------------------------------------------------------------------------------------ attendants
/** "Please don't touch": each touch within WINDOW s adds to the attendant's suspicion; at FOLLOW they follow you */
export const PATIENCE = { cooldown: 2.5, window: 60, follow: 3, followFor: 30 };
export const TOUCH_LINES = ['Please don\'t touch the exhibits.', 'Hands off, please.', 'It\'s older than you. Considerably.', 'Please don\'t lean on the cases.', 'Sir. Madam. Whichever. Please.'];
export const FOLLOW_LINES = ['I\'m keeping an eye on you.', 'Just browsing, are we?', 'I\'ll walk round with you, shall I.', 'Lovely. Now, the exit is that way.'];
export class Patience {
  constructor() { this.t = 0; this.touches = []; this.last = -1e9; this.followUntil = -1; this.n = 0; }
  /** a touch at time t (s); -> null (too soon) | {line, follow:bool} */
  touch(t) {
    if (t - this.last < PATIENCE.cooldown) return null;
    this.last = t;
    this.touches = this.touches.filter((x) => t - x < PATIENCE.window);
    this.touches.push(t);
    const follow = this.touches.length >= PATIENCE.follow;
    if (follow) this.followUntil = t + PATIENCE.followFor;
    const line = follow ? FOLLOW_LINES[this.n % FOLLOW_LINES.length] : TOUCH_LINES[this.n % TOUCH_LINES.length];
    this.n++;
    return { line, follow };
  }
  following(t) { return t < this.followUntil; }
}

// ------------------------------------------------------------------------------------------------ the Alfred Jewel
/** heat added to reach (at least) two stars, never more: police LEVELS[2] = 35, [3] = 75 */
export function alarmHeat(heat) { return Math.max(0, 42 - (heat || 0)); }

// ------------------------------------------------------------------------------------------------ floors
/**
 * A multi-storey interior on a 2D collider: the floor you are on is state. `levels` = floor heights. A ramp (a stair
 * flight) is a rectangle x0..x1, z0..z1 rising along `axis` ('x'|'z') from `lo` (the coordinate of its bottom end) to
 * the other end, from level b to b+1; it is walkable from both floors and switches the floor at its middle. Floor
 * areas above the ground (`area(k, rect)`) say where floor k exists (stand-alone use: groundAt); collider segments are
 * registered per floor set and switched on only while you are on one of their floors.
 */
export class Floors {
  constructor(levels) { this.levels = levels; this.cur = 0; this.ramps = []; this.segs = []; this.areas = levels.map(() => []); this.onChange = null; }
  ramp(r) { const R = { axis: 'z', ...r }; R.len = R.axis === 'z' ? R.z1 - R.z0 : R.x1 - R.x0; R.up = R.axis === 'z' ? (R.lo === R.z0 ? 1 : -1) : (R.lo === R.x0 ? 1 : -1); this.ramps.push(R); return R; }
  area(k, rect) { this.areas[k].push(rect); }
  /** t in 0..1 along ramp R at (x, z), or -1 outside it */
  rampT(R, x, z) {
    if (x < R.x0 || x > R.x1 || z < R.z0 || z > R.z1) return -1;
    const c = R.axis === 'z' ? z : x, a = R.axis === 'z' ? R.z0 : R.x0;
    const f = (c - a) / R.len;
    return R.up > 0 ? f : 1 - f;
  }
  /** floor height under (x, z) for the current floor */
  ground(x, z) {
    const k = this.cur, L = this.levels;
    for (const R of this.ramps) if (R.b === k || R.b === k - 1) { const t = this.rampT(R, x, z); if (t >= 0) return L[R.b] + (L[R.b + 1] - L[R.b]) * t; }
    return L[k];
  }
  /** where floor k is (for NPCs / tests): true if k = 0 or inside one of its areas */
  hasFloor(k, x, z) { if (k === 0) return true; return this.areas[k].some((r) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]); }
  /** call every frame with the player's position: crossing the middle of a flight changes floor */
  update(x, z) {
    const k = this.cur;
    for (const R of this.ramps) {
      if (R.b !== k && R.b !== k - 1) continue;
      const t = this.rampT(R, x, z); if (t < 0) continue;
      if (R.b === k && t > 0.5) return this.set(k + 1);
      if (R.b === k - 1 && t < 0.5) return this.set(k - 1);
    }
    return k;
  }
  set(k) {
    k = Math.max(0, Math.min(this.levels.length - 1, k | 0));
    if (k !== this.cur) { this.cur = k; this.apply(); if (this.onChange) this.onChange(k); }
    return k;
  }
  /** register collider shapes (one shape or an array) as walls on the floors in `ks` (array of floor indices) */
  walls(ks, shapes) { const arr = Array.isArray(shapes) ? shapes : [shapes]; for (const s of arr) { if (!s) continue; this.segs.push({ ks, s }); s.on = ks.includes(this.cur); } return arr; }
  apply() { for (const e of this.segs) e.s.on = e.ks.includes(this.cur); }
  /** the floor a point at height y is on (nearest level at or below y + 0.8) */
  floorFor(y) { let k = 0; for (let i = 0; i < this.levels.length; i++) if (this.levels[i] <= y + 0.8) k = i; return k; }
}

/** deterministic hash -> [0,1) of a string (no Math.random anywhere in the museum modules) */
export function hstr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return (h >>> 0) / 4294967296; }
/** seeded rng (mulberry32) */
export function srng(seed) { let a = (Math.floor(seed * 4294967296) ^ 0x9e3779b9) >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
