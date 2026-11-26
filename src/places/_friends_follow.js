// Friends tagging along with a player (friends.js, keble_pair.js). No DOM / three: the rules are pure functions (covered
// by tools/smoke_friends.mjs), the runtime (FollowCrew) only reads `game`.
//
// What happens: a friend who is free (standing about or strolling, nothing booked for a while) notices a player near them
// and now and then falls in with them: walks beside or just behind — WALKS: never faster than the player's own walking pace, so a player who runs, sprints or
// cycles off leaves them behind, and once they are GIVE_R m back (or out of sight round a corner) for GIVE_S seconds they
// give up with their leaving line and go back to their day —, stops when they stop,
// goes through doors after them, sits on the bench they sit on, and after a while — or when their own day calls — says
// so and walks back to wherever their routine has them. Nothing is asked of the player and nothing is shown on screen.
//
// Multiplayer: the player who is followed OWNS the follow. Their client decides the start (a roll that is a pure function
// of the shared slot clock, the friend and the player: rollOf; when two players stand by the same friend, `winner` names
// the one whose roll counts in that slot, the same on both clients) and the end, and tells the others with the
// 'friendFollow' event: the whole list of who is with them, again every HEARTBEAT_MS (a client that joins late, or missed
// one, has it within seconds; a leader who vanishes is forgotten after HB_DEAD_MS). Two claims on one friend: the earlier
// start wins, then the lower player id (FollowBook.claim) — on every client. No positions are sent: each client walks
// the follower itself from the leader's position as it already has it (the leader's own trail of footsteps: Trail), so
// the two agree to within a step.
export function hash01(n) { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); }
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const strHash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003; return h; };
export const pidNum = (p) => (typeof p === 'number' ? p : strHash(String(p)));

// ------------------------------------------------------------------------------------------------ rules (pure)
/** how readily each person falls in with you (0 = never: the tutors). GUESS: nothing is known of who is the keenest;
 *  Miguel (always inviting people to hal) and Lorenzo are put highest. */
export const SOCIABLE = { miguel: 0.9, lorenzo: 0.8, matt: 0.75, aiken: 0.7, taskeen: 0.6, james: 0.6, dina: 0.55, kotaro: 0.5, andre: 0.6, chris: 0.6,
  yang: 0, goldsmith: 0, earl: 0 };
export const SLOT_S = 5;                 // one chance per friend per shared slot of this many real seconds
export const NOTICE_R = 9;               // m: a friend notices a player this near
export const MAX_GROUP = 3;              // tag-alongs per player
export const BASE_P = 0.1;               // per slot, for someone with sociability 1 standing free with a player strolling by
import { HOUR_S } from '../core/time.js';
export const MIN_FREE_H = 60 / HOUR_S, FULL_FREE_H = 150 / HOUR_S;       // free time ahead (60 and 150 real seconds, as game hours): none below, full above
export const COOL_S = 90, COOL_FULL_S = 240;            // after they left you: nothing for COOL_S, back to normal by COOL_FULL_S
export const HEARTBEAT_MS = 3000, HB_DEAD_MS = 11000;
export const LOSE_S = 5;                 // stuck, or the leader gone from where they can be followed, for this long: lost
// As fast as a tag-along ever goes: the player's own walking pace (core/player.js WALK = 2.6 m/s — the pace of a player who
// is not holding run), so that a player who walks is kept up with and one who runs is not chased. Their own strolling
// pace is 1.3 m/s; they are DRAWN with a walking stride at any speed (GAIT_MAX: the gait's run blend starts above it).
export const WALK_MAX = 2.6, GAIT_MAX = 2.0;
// Giving up: further than GIVE_R behind — or out of sight of the player (a wall between, outdoors) and more than SIGHT_R
// away — for GIVE_S seconds. Decided by the followed player's client from where its own player is, and sent ('behind').
export const GIVE_R = 13, SIGHT_R = 6, GIVE_S = 3;

/** free time ahead (game hours until the next thing they are booked for) -> 0..1 */
export const freeFactor = (h) => (!(h >= MIN_FREE_H) ? 0 : clamp(0.35 + 0.65 * (h - MIN_FREE_H) / (FULL_FREE_H - MIN_FREE_H), 0, 1));
/** time of day -> 0..1 (nobody sets off with you after half past midnight or before eight) */
export const hourFactor = (hour) => (hour >= 0.5 && hour < 8 ? 0 : hour < 9 ? 0.6 : hour >= 23.5 || hour < 0.5 ? 0.4 : 1);
/** what the player is doing: m = { speed, lingerS (standing near them), vehicle, wanted, swim, down } */
export function moveFactor(m) {
  if (m.vehicle || m.wanted || m.swim || m.down) return 0;
  const v = m.speed || 0;
  if (v > 5) return 0.1;                                  // sprinting past
  if (v > 3.2) return 0.45;
  if (v < 0.4) return 1 + 0.8 * clamp((m.lingerS || 0) / 10, 0, 1);      // stopped by them: up to 1.8 after ten seconds
  return v < 2.2 ? 1.15 : 0.9;                            // strolling past / walking briskly
}
/** another friend already with the player: a second joins a little more readily (small groups form), a third less, no fourth */
export const groupFactor = (k) => (k >= MAX_GROUP ? 0 : k === 0 ? 1 : k === 1 ? 1.25 : 0.6);
/** seconds since they last left this player (Infinity = never); a quick parting (lost / bike) is forgotten sooner */
export function coolFactor(s, why, linger = 0) {
  // (left behind by a player who ran off: forgiven a little sooner if the player comes straight back and stops by them)
  const k = why === 'lost' || why === 'bike' || why === 'wave' ? 0.5 : why === 'behind' && linger >= 4 ? 0.6 : 1;
  return !(s >= COOL_S * k) ? 0 : clamp((s - COOL_S * k) / ((COOL_FULL_S - COOL_S) * k), 0.15, 1);
}
/** Places a player may be heading for that a friend would gladly go to too: [x, z] is filled in by the caller where it
 *  is not known here. hours [from, to) on a 0..30 clock (26 = 02:00). */
export const DESTS = [
  { id: 'bar', at: [-229.54, 29.78], hours: [19, 24.5], k: 1.7, r: 400 },          // the college bar, in the evening
  { id: 'hal', at: [-247.0, 22.6], hours: [11.5, 13.6], k: 1.7, r: 400 },        // Hall at lunch
  { id: 'hal', at: [-247.0, 22.6], hours: [17.5, 19.6], k: 1.7, r: 400 },        // … and at dinner
  { id: 'turtle', at: null, hours: [21.5, 26.5], k: 1.5, r: 900 },               // the Purple Turtle at night (at: from the game)
  { id: 'parks', at: [430, -730], hours: [12, 18], k: 1.4, r: 1400, sunny: true },      // the Parks on a fine afternoon
];
/** is the player walking towards one of DESTS at this hour? c = { x, z, hx, hz (unit velocity, or 0), speed, hour, sunny, at: {id: [x, z]} } -> factor >= 1 */
export function destFactor(c) {
  if (!(c.speed > 0.5) || !(c.hx || c.hz)) return 1;
  let best = 1;
  const h30 = c.hour < 6 ? c.hour + 24 : c.hour;
  for (const D of DESTS) {
    const at = D.at || (c.at && c.at[D.id]); if (!at) continue;
    if (!(h30 >= D.hours[0] && h30 < D.hours[1])) continue;
    if (D.sunny && !c.sunny) continue;
    const dx = at[0] - c.x, dz = at[1] - c.z, d = Math.hypot(dx, dz);
    if (d < 6 || d > D.r) continue;
    if ((dx * c.hx + dz * c.hz) / d > 0.82 && D.k > best) best = D.k;
  }
  return best;
}
/**
 * The chance (per slot) that friend c.id falls in with the player. c = { id, hFree, hour, walking (the friend is on their
 * way somewhere), speed, lingerS, vehicle, wanted, swim, down, group (already with the player), coolS, coolWhy,
 * x, z, hx, hz, sunny, at, talk (0, or how many times in a row the player has just talked to them) }.
 * After a talk the roll is a different one: mostly the person's sociability, so a player who wants company gets it.
 */
export function joinChance(c) {
  const soc = SOCIABLE[c.id] ?? 0; if (soc <= 0) return 0;
  const base = freeFactor(c.hFree) * hourFactor(c.hour) * groupFactor(c.group || 0);
  if (base <= 0) return 0;
  if (c.vehicle || c.wanted || c.swim || c.down) return 0;
  if (c.talk) return clamp((0.3 + 0.6 * soc + (c.talk > 1 ? 0.3 : 0)) * base * (c.coolS < 30 ? 0.3 : 1), 0, 0.97);
  return clamp(BASE_P * soc * base * moveFactor(c) * coolFactor(c.coolS ?? Infinity, c.coolWhy, c.lingerS || 0) * destFactor(c) * (c.walking ? 0.6 : 1), 0, 0.6);
}
/** the roll for (slot, friend, player): 0..1, the same on every client */
export function rollOf(slot, fid, pid, salt = 0) { return hash01((slot % 100003) * 0.7131 + strHash(fid) * 0.01937 + (pidNum(pid) % 9973) * 1.3171 + salt * 9.173); }
/** of the players near a friend in a slot, the one whose roll counts (deterministic: every client names the same one) */
export function winner(slot, fid, pids) {
  let best = null, bu = 2;
  for (const p of pids) { const u = rollOf(slot, fid, p, 1); if (u < bu || (u === bu && pidNum(p) < pidNum(best))) { bu = u; best = p; } }
  return best;
}
/** how long they stay before they have had enough (real seconds): ~1.5–5 min, longer for the sociable */
export function stayFor(fid, t0) { const soc = SOCIABLE[fid] ?? 0.5; return 75 + 240 * (0.35 + 0.65 * soc) * hash01(strHash(fid) * 0.377 + (Math.floor(t0 / 1000) % 86400) * 0.0131); }
/**
 * Why a tag-along leaves now, or null. c = { hCommit (game hours until their next booking), needS (seconds they need to
 * walk back to where their routine has them), boredIn (s), vehicle: null | { kind, stolen, speed }, ride (bus passenger),
 * swim, wanted, far (m from home), range, hour, late (hour they turn in; may be > 24), dist (to the player), awayS (s they have been too far behind / out of sight), lostS, waitS, patience }.
 *   'behind' the player has gone off faster than they walk
 *   'routine' their day calls · 'bored' · 'car' (a car you took) · 'bike' · 'wave' (bus / punt / glider / water / your own car)
 *   'trouble' (the police want you) · 'far' · 'late' · 'lost' · 'wait' (you were indoors too long)
 */
export function leaveWhy(c) {
  if (c.hCommit !== undefined && c.hCommit * HOUR_S <= (c.needS || 0) + 15) return 'routine';
  const v = c.vehicle;
  if (v) {
    if (v.kind === 'bike') { if ((c.fastS || 0) > 3 || c.dist > GIVE_R) return 'bike'; }
    else if (v.kind === 'car' && v.stolen) return 'car';
    else return 'wave';
  }
  if (c.ride || c.swim) return 'wave';
  if (c.wanted) return 'trouble';
  if (c.far > c.range) return 'far';
  { const h = c.hour < 6 ? c.hour + 24 : c.hour; if (h >= (c.late ?? 25)) return 'late'; }
  if ((c.awayS || 0) >= GIVE_S) return 'behind';
  if ((c.lostS || 0) > LOSE_S) return 'lost';
  if ((c.waitS || 0) > (c.patience || 60)) return 'wait';
  if (c.boredIn <= 0) return 'bored';
  return null;
}

// ------------------------------------------------------------------------------------------------ who is with whom
/** The shared record: friend id -> { p (player id), t0 (shared clock ms the follow began), hb (local ms last heard) }. */
export class FollowBook {
  constructor() { this.by = new Map(); this.left = new Map(); this.events = []; }
  leaderOf(fid) { const c = this.by.get(fid); return c ? c.p : null; }
  /** the friends with player pid, in the order they joined (their places beside the player) */
  followersOf(pid) { const o = []; for (const [f, c] of this.by) if (c.p === pid) o.push([f, c.t0]); o.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)); return o.map((q) => q[0]); }
  count(pid) { let n = 0; for (const c of this.by.values()) if (c.p === pid) n++; return n; }
  /** pid says fid is with them since t0. The earlier start wins, then the lower player id. -> true if the claim stands */
  claim(fid, pid, t0, now) {
    const c = this.by.get(fid);
    if (c && c.p !== pid && (c.t0 < t0 || (c.t0 === t0 && pidNum(c.p) < pidNum(pid)))) return false;
    if (c && c.p === pid) { c.hb = now; c.t0 = Math.min(c.t0, t0); return true; }
    this.by.set(fid, { p: pid, t0, hb: now });
    return true;
  }
  drop(fid, pid, why, now) { const c = this.by.get(fid); if (!c || (pid !== undefined && pid !== null && c.p !== pid)) return false; this.by.delete(fid); this.left.set(fid + '|' + c.p, { t: now, why: why || '' }); return true; }
  /** seconds since fid last left pid, and why */
  since(fid, pid, now) { const q = this.left.get(fid + '|' + pid); return q ? { s: (now - q.t) / 1000, why: q.why } : { s: Infinity, why: '' }; }
  /** the list a leader sends: [[fid, t0], …] */
  listOf(pid) { const o = []; for (const [f, c] of this.by) if (c.p === pid) o.push([f, c.t0]); return o; }
  /** a 'friendFollow' message from player `from`: { f: [[fid, t0], …], j?: fid (just joined), e?: [fid, why] (just left) } */
  onMsg(d, from, now) {
    if (!d || from === undefined || from === null || !Array.isArray(d.f)) return;
    const said = new Set();
    for (const q of d.f.slice(0, 8)) {
      if (!Array.isArray(q) || typeof q[0] !== 'string' || !Number.isFinite(q[1])) continue;
      said.add(q[0]);
      const had = this.leaderOf(q[0]);
      if (this.claim(q[0], from, q[1], now) && had !== from) this.events.push({ k: 'join', fid: q[0], p: from, say: d.j === q[0], r: Number.isFinite(d.r) ? d.r : undefined });
    }
    for (const [f, c] of [...this.by]) if (c.p === from && !said.has(f)) {
      const why = Array.isArray(d.e) && d.e[0] === f ? String(d.e[1] || '') : '';
      this.drop(f, from, why, now); this.events.push({ k: 'leave', fid: f, p: from, why, r: Array.isArray(d.e) && d.e[0] === f && Number.isFinite(d.e[2]) ? d.e[2] : undefined });
    }
  }
  /** forget leaders who have gone quiet (not `me`: our own are ours to end) or left the room */
  expire(now, me, alive) {
    for (const [f, c] of [...this.by]) if (c.p !== me && (now - c.hb > HB_DEAD_MS || (alive && !alive(c.p)))) { this.drop(f, c.p, 'gone', now); this.events.push({ k: 'leave', fid: f, p: c.p, why: 'gone' }); }
  }
  /** our own id changed (solo -> a room): carry our claims over */
  rename(a, b) { for (const c of this.by.values()) if (c.p === a) c.p = b; for (const [k, v] of [...this.left]) if (k.endsWith('|' + a)) { this.left.delete(k); this.left.set(k.slice(0, -String(a).length) + b, v); } }
}

// ------------------------------------------------------------------------------------------------ the leader's trail
/** Where the leader has walked: crumbs every STEP m with the arc length so far, the height and the room (id | null). */
export const TRAIL_STEP = 0.45, TRAIL_MAX = 420;
export class Trail {
  constructor() { this.x = []; this.z = []; this.y = []; this.s = []; this.rm = []; this.epoch = 0; }
  get n() { return this.x.length; }
  get s0() { return this.s.length ? this.s[0] : 0; }
  get s1() { return this.s.length ? this.s[this.s.length - 1] : 0; }
  reset(x, z, y, rm) { const s = this.s1; this.x = [x]; this.z = [z]; this.y = [y]; this.s = [s]; this.rm = [rm || null]; this.epoch++; }
  push(x, z, y, rm) {
    const n = this.n; if (!n) { this.reset(x, z, y, rm); return; }
    const d = Math.hypot(x - this.x[n - 1], z - this.z[n - 1]);
    if (d < TRAIL_STEP && (rm || null) === this.rm[n - 1]) return;
    this.x.push(x); this.z.push(z); this.y.push(y); this.s.push(this.s[n - 1] + d); this.rm.push(rm || null);
    if (this.n > TRAIL_MAX) { this.x.shift(); this.z.shift(); this.y.shift(); this.s.shift(); this.rm.shift(); }
  }
  /** index i of the crumb with s[i] <= s < s[i+1] */
  idx(s) { const S = this.s; let a = 0, b = S.length - 1; if (s <= S[0]) return 0; if (s >= S[b]) return Math.max(0, b - 1); while (b - a > 1) { const m = (a + b) >> 1; if (S[m] <= s) a = m; else b = m; } return a; }
  /** the point at arc length s -> out { x, z, y, rm, h } */
  at(s, out) {
    const n = this.n; if (n === 1) { out.x = this.x[0]; out.z = this.z[0]; out.y = this.y[0]; out.rm = this.rm[0]; return out; }
    const i = this.idx(s), l = this.s[i + 1] - this.s[i], u = l > 1e-6 ? clamp((s - this.s[i]) / l, 0, 1) : 1;
    out.x = lerp(this.x[i], this.x[i + 1], u); out.z = lerp(this.z[i], this.z[i + 1], u); out.y = lerp(this.y[i], this.y[i + 1], u);
    out.rm = u > 0.5 ? this.rm[i + 1] : this.rm[i];
    if (l > 1e-6) out.h = Math.atan2(this.x[i + 1] - this.x[i], this.z[i + 1] - this.z[i]);
    return out;
  }
}

// ------------------------------------------------------------------------------------------------ walking with them
// places beside the leader: [to the right, ahead] m while walking; a loose knot when standing
const SIDE = [[0.78, -0.3], [-0.82, -0.5], [0.12, -1.4]];
const GAP = [0.95, 1.6, 2.25];           // m behind along the trail (indoors, through doors, round corners)
const _a = { x: 0, z: 0, y: 0, rm: null, h: 0 }, _p = { x: 0, z: 0 };
/**
 * One step of a tag-along. f = { x, z, y, h, v, mode ('free' | 'join' | 'trail' | 'hold'), s, s0, ep, stuck, room, wait }
 * L = { x, z, y, h (facing), mh (the way they are moving), speed, room (id | null), trail, here (false: indoors somewhere
 * we cannot go, or out of sight) }, slot 0..2, env = {
 *   clear(x0, z0, x1, z1) -> true when the WORLD's walls leave the straight line free,  resolve(p {x, z}) pushes a circle
 *   out of the world's walls,  wet(x, z),  gate(room, x0, z0, x1, z1) -> false when a door that is not open yet is in the
 *   way of that step,  ban(room) -> true for a room they will not go into,  others: [{x, z}] (the other tag-alongs) }
 * Writes f; f.want = 'door' while he is held at a shut door (walking at it), f.wait = true while he waits outside.
 */
export function stepFollower(f, L, slot, dt, env) {
  const T = L.trail, jog = f.vmax || WALK_MAX;          // (a walk, indoors and out: nobody runs after anybody)
  f.want = null; f.wait = false;
  if (f.ep !== T.epoch) { f.ep = T.epoch; f.mode = 'free'; f.s = T.s1; }           // the leader jumped (a teleport): start again from where we are
  const dL = Math.hypot(L.x - f.x, L.z - f.z);
  const outside = !L.room && !f.room;
  // ---- which way of walking
  if (!L.here) f.mode = 'hold';
  else if (f.mode === 'hold') f.mode = 'free';
  if (f.mode === 'free' && !(outside && env.clear(f.x, f.z, L.x, L.z))) {
    // lost the straight line (a corner, a door): pick the leader's trail up at the newest crumb we can walk straight to
    let pick = -1;
    if (!f.room) for (let i = T.n - 1, k = 0; i >= 0 && k < 90; i--, k++) { if (T.rm[i]) continue; if (env.clear(f.x, f.z, T.x[i], T.z[i])) { pick = i; break; } }
    if (pick < 0) { let bd = 49; for (let i = T.n - 1; i >= 0; i--) { const d2 = (T.x[i] - f.x) ** 2 + (T.z[i] - f.z) ** 2; if (d2 < bd && (T.rm[i] || null) === (f.room || null)) { bd = d2; pick = i; } } }
    if (pick >= 0) { f.mode = 'join'; f.s0 = T.s[pick]; } else f.mode = 'hold';
  } else if ((f.mode === 'trail' || f.mode === 'join') && outside && dL < 14 && env.clear(f.x, f.z, L.x, L.z)) {
    if (f.mode === 'join' || !T.at(f.s, _a).rm) f.mode = 'free';
  }
  let tx = f.x, tz = f.z, want = 0, face = null;
  if (f.mode === 'free') {
    const moving = L.speed > 0.35, mh = L.mh, fx = Math.sin(mh), fz = Math.cos(mh), rx = -fz, rz = fx, o = SIDE[slot % SIDE.length];
    let gx = L.x + rx * o[0] + fx * o[1], gz = L.z + rz * o[0] + fz * o[1];
    if (!env.clear(L.x, L.z, gx, gz) || env.wet(gx, gz)) { gx = L.x - fx * GAP[slot % 3]; gz = L.z - fz * GAP[slot % 3]; if (!env.clear(L.x, L.z, gx, gz) || env.wet(gx, gz)) { gx = L.x; gz = L.z; } }
    const dG = Math.hypot(gx - f.x, gz - f.z);
    if (moving) { tx = gx; tz = gz; want = dG < 0.12 ? L.speed : L.speed + clamp((dG - 0.35) * 1.4, -L.speed * 0.6, 2.2); }
    else if (dL > 2.1 || (dL > 1.25 && dG > 1.1 && f.v > 0.2)) { tx = gx; tz = gz; want = clamp(dG * 1.5, 0.7, 2.4); }       // they have stopped: come up and stop too
    else if (dL < 0.62) { tx = f.x - (L.x - f.x); tz = f.z - (L.z - f.z); want = 0.6; }                                     // too close: half a step back
    // standing with them: look at what they are looking at
    if (!moving && want === 0) face = Math.atan2(L.x + Math.sin(L.h) * 4 - f.x, L.z + Math.cos(L.h) * 4 - f.z);
  } else if (f.mode === 'join') {
    T.at(f.s0, _a); tx = _a.x; tz = _a.z;
    const d = Math.hypot(tx - f.x, tz - f.z);
    if (f.s0 < T.s0) f.mode = 'hold';
    else if (d < 0.04) { f.mode = 'trail'; f.s = f.s0; f.x = tx; f.z = tz; f.yt = _a.y; f.room = _a.rm; return dL; }      // (on it: along it from the next step, so no step is ever longer than a walker's)       // (on the trail, to the centimetre: no hop onto it)
    else want = clamp(Math.max(L.speed, 1.3) + (dL - 2) * 0.5, Math.min(1.2, jog), jog);
  }
  if (f.mode === 'trail') {
    if (f.s < T.s0) f.mode = 'hold';
    else {
      const sL = T.s1 + Math.hypot(L.x - T.x[T.n - 1], L.z - T.z[T.n - 1]);
      let goal = sL - GAP[slot % 3];
      // a room they will not go into: as far as its door, and wait there
      if (env.ban) for (let i = T.idx(f.s); i < T.n; i++) if (T.rm[i] && env.ban(T.rm[i])) { const lim = T.s[i] - 2.2; if (lim < goal) { goal = lim; f.wait = true; } break; }
      const ds = goal - f.s;
      const v = ds > 0.12 ? clamp(L.speed + ds * 1.3, Math.min(0.6, jog), jog) : 0;
      f.v += clamp(v - f.v, -7 * dt, 4.5 * dt);
      let ns = Math.min(Math.max(f.s, goal), f.s + Math.max(0, f.v) * dt);
      T.at(ns, _a);
      if (ns > f.s && env.gate && !env.gate(_a.rm || f.room, f.x, f.z, _a.x, _a.z)) { ns = f.s; T.at(ns, _a); f.v = 0; f.want = 'door'; }
      const mx = _a.x - f.x, mz = _a.z - f.z;
      if (mx * mx + mz * mz > 1e-8) f.h = Math.atan2(mx, mz); else if (ds <= 0.12 && L.speed < 0.35) f.h = Math.atan2(L.x + Math.sin(L.h) * 4 - f.x, L.z + Math.cos(L.h) * 4 - f.z);
      f.x = _a.x; f.z = _a.z; f.yt = _a.y; f.room = _a.rm; f.s = ns;
      f.stuck = f.want === 'door' ? (f.stuck || 0) + dt : 0;
      return dL;
    }
  }
  if (f.mode === 'hold') { f.v = Math.max(0, f.v - 6 * dt); f.stuck = 0; return dL; }
  // ---- free steering (outdoors): towards (tx, tz) at `want`, never into a wall, the water or each other
  want = Math.min(want, jog);
  f.v += clamp(want - f.v, -7 * dt, 4.5 * dt);
  const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
  if (f.v > 0.02 && d > 0.02) {
    const st = Math.min(d, f.v * dt);
    _p.x = f.x + (dx / d) * st; _p.z = f.z + (dz / d) * st;
    const last = f.mode === 'join' && d < 0.4;          // (the last step onto the trail: straight to it)
    if (env.others && !last) for (const o of env.others) { const ex = _p.x - o.x, ez = _p.z - o.z, e = Math.hypot(ex, ez); if (e < 0.6 && e > 1e-4) { _p.x += (ex / e) * (0.6 - e) * 0.5; _p.z += (ez / e) * (0.6 - e) * 0.5; } }
    if (!last) env.resolve(_p);
    if (env.wet(_p.x, _p.z)) { _p.x = f.x; _p.z = f.z; }
    let moved = Math.hypot(_p.x - f.x, _p.z - f.z);
    // (pushed out of a wall he was walking close along — the leader's trail runs nearer walls than his own shoulders do: eased out, never a hop)
    { const cap = jog * dt; if (moved > cap) { _p.x = f.x + (_p.x - f.x) * cap / moved; _p.z = f.z + (_p.z - f.z) * cap / moved; moved = cap; } }
    if (moved > 1e-5) { if (moved > st * 0.3) f.h = Math.atan2(_p.x - f.x, _p.z - f.z); }
    f.stuck = moved < st * 0.25 && d > 1.5 ? (f.stuck || 0) + dt : 0;
    if (moved < st * 0.5) f.v = Math.min(f.v, moved / Math.max(dt, 1e-3) + 0.3);
    f.x = _p.x; f.z = _p.z;
  } else { f.stuck = 0; if (face !== null) f.h = face; }
  f.room = null; f.yt = NaN;
  return dL;
}

// ------------------------------------------------------------------------------------------------ runtime
const NET_KIND = 'friendFollow';
/** the one FollowBook of a game (both crews — Worcester and Keble — share it, and one message carries them all) */
export function bookOf(game) {
  if (game._followBook) return game._followBook;
  const B = (game._followBook = new FollowBook());
  B.crews = []; B.me = null; B.hbT = 0;
  if (game.net && game.net.on) game.net.on(NET_KIND, (d, o) => { if (o) B.onMsg(d, o.id, Date.now()); });
  B.send = (extra) => { const n = game.net; if (n && n.connected) n.send(NET_KIND, { f: B.listOf(B.me), ...extra }); B.hbT = Date.now() + HEARTBEAT_MS; };
  return B;
}
const _w = [0, 0], _l = [0, 0], LOW = { ignoreLow: false };

/**
 * The tag-alongs of one module. opt = {
 *   npcs: [{ id, … }]                the people (plain records; this class keeps its own state by id)
 *   home: [x, z], range (m)          how far from home they will go
 *   avail(n) -> null | { hFree, walking }   free to fall in now? (shown, not in a scene, nothing booked for hFree game hours)
 *   commit(n) -> game hours until their next booking (while with a player)
 *   at(n) -> { x, z }                where the friend is drawn now (world)
 *   say(n, kind, why)                'join' | 'leave' (why: leaveWhy's reason) — a line or a wave; on every client
 *   late(n) -> hour (0..30) they turn in,  enters(n, roomId) -> false for a room they stay outside of
 *   back(n, x, z, R) -> [[x, z], …]  the way from (x, z) back to where the routine has them (R = { x, z, hidden })
 *   pair: (id) -> [ids]              people who only come together (Andre and Chris)
 * }
 * Per frame: update(dt, hour, T) once, then for each person step(n, dt, R) -> null (the routine has them) or
 * { x, z, y (world height indoors, NaN = the ground), h, v, room (id | null), pose, door, mode: 'follow' | 'return' }.
 */
export class FollowCrew {
  constructor(game, opt) {
    this.game = game; this.opt = opt; this.book = bookOf(game); this.book.crews.push(this);
    this.ids = new Set(opt.npcs.map((n) => n.id)); this.byId = new Map(opt.npcs.map((n) => [n.id, n]));
    this.sims = new Map();        // fid -> follower state (while with someone)
    this.rets = new Map();        // fid -> the walk back
    this.leaders = new Map();     // pid -> { x, z, y, h, mh, speed, room, trail, here, … }
    this.meta = new Map();        // fid -> { until, lostS, waitS, fastS, talkN, talkT, slot, linger } (our own decisions)
    this.out = { x: 0, z: 0, y: NaN, h: 0, v: 0, room: null, pose: 'stand', door: false, mode: 'follow' };
    this.checkT = 0; this.off = false; this.dbgForce = null;
    this.env = {
      clear: (x0, z0, x1, z1) => { const c = game.worldCollider; return !c || c.raycast(x0, z0, x1, z1, LOW) === null; },      // (a low wall or a fence is in the way too)
      resolve: (p) => { const c = game.worldCollider; if (c) c.resolve(p, 0.3); },
      wet: (x, z) => { const c = game.worldCollider; return !!(c && c.isWet && c.isWet(x, z)); },
      gate: (room, x0, z0, x1, z1) => this._gate(room, x0, z0, x1, z1),
      ban: null, others: null,
    };
  }
  get me() { const n = this.game.net; return n && n.connected && n.id ? n.id : 'solo'; }
  following(id) { return this.book.leaderOf(id); }
  mode(id) { return this.book.leaderOf(id) !== null ? 'follow' : this.rets.has(id) ? 'return' : null; }
  _meta(id) { let m = this.meta.get(id); if (!m) this.meta.set(id, (m = { until: 0, lostS: 0, awayS: 0, waitS: 0, fastS: 0, talkN: 0, talkT: -1e12, slot: undefined, linger: 0 })); return m; }

  /** a door of walk-in room `room` that is not open yet in the way of the step (x0, z0) -> (x1, z1) (world)? -> may he step */
  _gate(room, x0, z0, x1, z1) {
    const I = this.game.interiors, d = room && I && I.get ? I.get(room) : null;
    if (!d || !d.sl || !d.doorList || !d.doorList.length) return true;
    const S = d.sl, a = S.toLocal(x0, z0, _w), ax = a[0], az = a[1], b = S.toLocal(x1, z1, _l), bx = b[0], bz = b[1];
    for (const D of d.doorList) {
      const o = D.o; if (!o || !o.at || D.passable) continue;
      const w = o.w || 0.9, dx = Math.sin(o.dir || 0), dz = Math.cos(o.dir || 0), cx = D.pos ? D.pos[0] : o.at[0] + dx * w * (D.kind === 'hinged' ? 0.5 : 0), cz = D.pos ? D.pos[1] : o.at[1] + dz * w * (D.kind === 'hinged' ? 0.5 : 0);
      const al = (bx - cx) * dx + (bz - cz) * dz; if (Math.abs(al) > w / 2 + 0.35) continue;
      const o0 = (ax - cx) * -dz + (az - cz) * dx, o1 = (bx - cx) * -dz + (bz - cz) * dx;
      // (held 0.85 m short of the leaf's plane, on the side he is on; a step away from it is always free)
      if (Math.abs(o1) < 0.85 && Math.abs(o1) < Math.abs(o0) + 1e-6 || o0 * o1 < 0) return false;
    }
    return true;
  }

  /** where player pid is, in world coordinates -> the leader record (kept between frames: speed, the trail) */
  _leader(pid, dt) {
    const g = this.game, I = g.interiors;
    let L = this.leaders.get(pid);
    if (!L) this.leaders.set(pid, (L = { pid, x: 0, z: 0, y: 0, h: 0, mh: 0, speed: 0, room: null, place: 'world', here: false, pose: 'stand', trail: new Trail(), seen: false, frame: -1, veh: null }));
    if (L.frame === this.frame) return L;
    L.frame = this.frame;
    let x = 0, z = 0, y = 0, h = 0, place = 'nowhere', room = null, ok = false, pose = 'stand', veh = null;
    if (pid === this.me) {
      const p = g.player, cur = I && I.current, S = cur && cur.sl && p.place === cur.id && p.worldPos ? cur.sl : null;
      place = p.place; h = p.heading; pose = p.pose; veh = p.vehicle ? p.vehicle.kind || 'car' : null;
      if (S) { x = p.worldPos.x; y = p.worldPos.y; z = p.worldPos.z; room = cur.id; ok = true; } else if (place === 'world') { x = p.pos.x; y = p.pos.y; z = p.pos.z; ok = true; }
    } else {
      const o = g.net && g.net.others ? g.net.others.get(pid) : null;
      if (o && o.seen) {
        place = o.place; h = o.h; pose = o.pose; veh = o.veh || null;
        if (place === 'world') { x = o.x; y = o.y; z = o.z; ok = true; }
        else { const d = I && I.get ? I.get(place) : null; if (d && d.sl && d.sl.toWorld) { const w = d.sl.toWorld(o.x, o.z, _w); x = w[0]; z = w[1]; y = o.y + d.sl.base(); room = place; ok = true; } }
      }
    }
    L.place = place; L.pose = pose; L.veh = veh;
    if (!ok) { L.here = false; L.speed = 0; return L; }
    const d = L.seen ? Math.hypot(x - L.x, z - L.z) : 0, jump = !L.seen || !L.here || d > Math.max(4, 14 * dt);
    if (jump) { L.trail.reset(x, z, y, room); L.speed = 0; if (!L.seen) L.mh = h; }
    else {
      const v = dt > 1e-4 ? d / dt : 0; L.speed += (v - L.speed) * Math.min(1, dt * 8);
      if (v > 0.4 && d > 1e-4) { const a = Math.atan2(x - L.x, z - L.z); let e = a - L.mh; e = Math.atan2(Math.sin(e), Math.cos(e)); L.mh += e * Math.min(1, dt * 6); }
      L.trail.push(x, z, y, room);
    }
    L.x = x; L.y = y; L.z = z; L.h = h; L.room = room; L.here = true; L.seen = true;
    return L;
  }
  _players(x, z, r) {
    const g = this.game, out = [], p = g.player;
    if (p.place === 'world' && Math.hypot(p.pos.x - x, p.pos.z - z) < r) out.push(this.me);
    if (g.net && g.net.others) for (const o of g.net.others.values()) if (o.seen && o.place === 'world' && Math.hypot(o.x - x, o.z - z) < r) out.push(o.id);
    return out;
  }
  _newSim(n) { const a = this.opt.at(n); return { x: a.x, z: a.z, y: NaN, yt: NaN, h: n.h || 0, v: 0, vmax: WALK_MAX, mode: 'free', s: 0, s0: 0, ep: -1, stuck: 0, room: null, own: [], wait: false, want: null, sit: null }; }

  /** our own roll for one friend in this slot (or after a talk) */
  _ctx(n, a, hour, talk) {
    const g = this.game, p = g.player, m = this._meta(n.id), now = Date.now(), me = this.me, pos = this.opt.at(n);
    const sp = p.speed || 0, since = this.book.since(n.id, me, now);
    const at = {}; { const d = g.interiors && g.interiors.get ? g.interiors.get('purple_turtle') : null; if (d && d.sl && Number.isFinite(d.sl.wx)) at.turtle = [d.sl.wx, d.sl.wz]; }
    const W = g.weather;
    return { id: n.id, hFree: a.hFree, hour, walking: !!a.walking, speed: sp, lingerS: m.linger, vehicle: !!p.vehicle || !!p.ride, wanted: !!(g.police && g.police.level > 0), swim: !!p.swim, down: p.downT > 0,
      group: this.book.count(me), coolS: since.s, coolWhy: since.why, x: pos.x, z: pos.z, hx: sp > 0.5 ? (p.vx || 0) / sp : 0, hz: sp > 0.5 ? (p.vz || 0) / sp : 0,
      sunny: !!(W && (W.rain || 0) < 0.05 && (W.cloud ?? 0) < 0.6), at, talk: talk || 0 };
  }
  _join(n, pid, t0, say) {
    const now = Date.now(), B = this.book;
    const ids = this.opt.pair ? this.opt.pair(n.id) : [n.id];
    for (const id of ids) { if (!B.claim(id, pid, t0, now)) return false; }
    for (const id of ids) { this.rets.delete(id); if (!this.sims.has(id)) this.sims.set(id, this._newSim(this.byId.get(id))); const m = this._meta(id); m.until = this.game.time.now() + stayFor(id, t0) * 1000; m.lostS = m.awayS = m.waitS = m.fastS = 0; }
    const r = Math.floor(t0 / 1000) % 100000;          // (which words: sent with the news, so every client says the same)
    if (pid === this.me) B.send({ j: n.id, r });
    if (say) this.opt.say(n, 'join', '', r);
    return true;
  }
  _leave(n, why) {
    const B = this.book, me = this.me, now = Date.now();
    const ids = this.opt.pair ? this.opt.pair(n.id) : [n.id];
    for (const id of ids) B.drop(id, me, why, now);
    const r = Math.floor(now / 1000) % 100000;
    B.send({ e: [n.id, why, r] });
    this._ended(n, why, true, r);
  }
  _ended(n, why, say, r) {
    const ids = this.opt.pair ? this.opt.pair(n.id) : [n.id];
    for (const id of ids) { const f = this.sims.get(id); if (f) { this.sims.delete(id); this.rets.set(id, { f, t: 0, path: null, i: 0, calcT: 0, phase: 'out' }); } }
    if (say && why !== 'gone' && why !== 'taken' && why !== 'lost' && why !== 'wait') this.opt.say(n, 'leave', why, r);
  }
  /** the player has just finished talking to n: they may well come along */
  onTalk(n) {
    if (this.off || !this.ids.has(n.id)) return;
    const g = this.game, m = this._meta(n.id), now = g.time.now(), me = this.me, who = this.book.leaderOf(n.id);
    if (who === me) { m.until += 30000; return; }               // talking to someone who is with you keeps them a little longer
    if (who !== null) return;
    m.talkN = now - m.talkT < 60000 ? m.talkN + 1 : 1; m.talkT = now;
    const a = this.opt.avail(n, true); if (!a) return;
    // (two players talking to the same friend in the same second: one of them, the same on both clients)
    const pos = this.opt.at(n), sec = Math.floor(now / 1000), near = this._players(pos.x, pos.z, 3.5);
    if (near.length > 1 && winner(sec, n.id, near) !== me) return;
    if (rollOf(sec, n.id, me, 2) < joinChance(this._ctx(n, a, this.hour, m.talkN))) this._join(n, me, now, true);
  }

  /** once a frame: messages, our own decisions (joins, leavings), the heartbeat */
  update(dt, hour, T) {
    const g = this.game, B = this.book, me = this.me, now = g.time.now(), wall = Date.now();
    this.frame = (this.frame || 0) + 1; this.hour = hour; this.T = T;
    if (B.me !== me) { if (B.me !== null) B.rename(B.me, me); B.me = me; }
    if (B.crews[0] === this) { B.expire(wall, me, (pid) => !!(g.net && g.net.others && g.net.others.has(pid))); if (wall >= B.hbT && (B.count(me) || B.sentAny)) { B.sentAny = B.count(me) > 0; B.send(); } }
    // what the others told us
    for (let i = B.events.length - 1; i >= 0; i--) {
      const ev = B.events[i]; if (!this.ids.has(ev.fid)) continue;
      B.events.splice(i, 1);
      const n = this.byId.get(ev.fid);
      if (ev.k === 'join') { this.rets.delete(ev.fid); if (!this.sims.has(ev.fid)) this.sims.set(ev.fid, this._newSim(n)); if (ev.say) this.opt.say(n, 'join', '', ev.r); }
      else if (this.sims.has(ev.fid)) this._ended(n, ev.why, !(this.opt.pair && this.opt.pair(ev.fid)[0] !== ev.fid), ev.r);
    }
    // (a claim of ours that lost to an earlier one: the book already has the other leader; our sim simply carries on with them)
    if (this.off) { for (const n of this.opt.npcs) if (B.leaderOf(n.id) === me) this._leave(n, 'gone'); return; }
    const p = g.player;
    // ---- our own tag-alongs: is it time one of them went?
    if ((this.checkT -= dt) <= 0) {
      this.checkT = 0.4;
      for (const n of this.opt.npcs) {
        if (B.leaderOf(n.id) !== me) continue;
        if (this.opt.pair && this.opt.pair(n.id)[0] !== n.id) continue;
        const f = this.sims.get(n.id), m = this._meta(n.id), L = this._leader(me, dt); if (!f) continue;
        if (n.taken) { this._leave(n, 'taken'); continue; }
        const v = p.vehicle, dist = L.here ? Math.hypot(L.x - f.x, L.z - f.z) : 0;
        m.lostS = f.mode === 'hold' && L.here && dist > 6 || (f.stuck || 0) > 6 ? m.lostS + 0.4 : 0;
        // the player has pulled away: too far behind, or (outdoors) out of sight round a corner
        const sight = !L.here || L.room || f.room || dist <= SIGHT_R || this.env.clear(f.x, f.z, L.x, L.z);
        m.awayS = L.here && (dist > GIVE_R || !sight) ? m.awayS + 0.4 : 0;
        m.waitS = !L.here || f.wait ? m.waitS + 0.4 : 0;
        m.fastS = v && Math.abs(v.speed || 0) > 3.8 ? m.fastS + 0.4 : 0;
        const R = this.opt.routine ? this.opt.routine(n) : null, needS = R ? Math.hypot(R.x - f.x, R.z - f.z) / 1.6 : 0;
        const why = leaveWhy({ hCommit: this.opt.commit(n), needS, boredIn: (m.until - now) / 1000, vehicle: v ? { kind: v.kind || 'car', stolen: !!v.stolen, speed: Math.abs(v.speed || 0) } : null,
          ride: !!p.ride, swim: !!p.swim, wanted: !!(g.police && g.police.level > 0), far: Math.hypot(f.x - this.opt.home[0], f.z - this.opt.home[1]), range: this.opt.range,
          hour, late: this.opt.late ? this.opt.late(n) : 25, dist, awayS: m.awayS, lostS: m.lostS, waitS: m.waitS, fastS: m.fastS, patience: 45 + 40 * (SOCIABLE[n.id] || 0.5) });
        if (why) this._leave(n, why);
      }
    }
    // ---- a friend near us who is free: one roll per shared slot
    for (let i = 0; i < this.opt.npcs.length; i++) {
      const n = this.opt.npcs[i], m = this._meta(n.id);
      if (this.opt.pair && this.opt.pair(n.id)[0] !== n.id) continue;
      if (B.leaderOf(n.id) !== null || this.rets.has(n.id)) { m.linger = 0; continue; }
      const pos = this.opt.at(n), d = p.place === 'world' ? Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) : Infinity;
      if (!(d < NOTICE_R)) { m.linger = 0; m.slot = undefined; continue; }
      m.linger = (p.speed || 0) < 0.5 ? m.linger + dt : Math.max(0, m.linger - dt * 2);
      const slot = Math.floor(now / (SLOT_S * 1000) + hash01(strHash(n.id) * 0.731));
      if (slot === m.slot) continue;
      const first = m.slot === undefined; m.slot = slot;
      if (first && !this.dbgForce) continue;                       // (the slot we walked up in: wait for the next boundary)
      const a = this.opt.avail(n); if (!a) continue;
      if (winner(slot, n.id, this._players(pos.x, pos.z, NOTICE_R)) !== me) continue;
      const pr = this.dbgForce !== null && this.dbgForce !== undefined ? this.dbgForce : joinChance(this._ctx(n, a, hour, 0));
      if (rollOf(slot, n.id, me) < pr) this._join(n, me, now, true);
    }
  }

  /** per person, per frame, after the routine has placed them: R = { x, z, hidden, seen (can the local player see them) } */
  step(n, dt, R) {
    const id = n.id, pid = this.book.leaderOf(id), out = this.out;
    if (pid !== null) {
      let f = this.sims.get(id); if (!f) this.sims.set(id, (f = this._newSim(n)));
      const L = this._leader(pid, dt), fl = this.book.followersOf(pid), slot = Math.max(0, fl.indexOf(id));
      // (first seen by this client long after it began, or the leader has come from far away: beside them, no walk across the map)
      if (L.here && f.mode !== 'trail' && !R.seen && Math.hypot(L.x - f.x, L.z - f.z) > 60) { f.x = L.x - Math.sin(L.mh) * (1 + slot); f.z = L.z - Math.cos(L.mh) * (1 + slot); f.ep = -1; f.room = null; }
      const env = this.env;
      env.ban = this.opt.enters ? (room) => !this.opt.enters(n, room) : null;
      env.others = []; for (const q of fl) if (q !== id) { const o = this.sims.get(q); if (o) env.others.push(o); }
      // sitting where they sit: the next free seat of their bench
      const seat = this._seat(L, slot);
      if (seat && !f.room) {
        const d = Math.hypot(seat[0] - f.x, seat[1] - f.z);
        if (d < 0.25 || f.sit) { f.sit = seat; f.x = seat[0]; f.z = seat[1]; f.h = seat[2]; f.v = 0; f.stuck = 0; }
        else { const st = Math.min(d, 1.3 * dt); f.x += (seat[0] - f.x) / d * st; f.z += (seat[1] - f.z) / d * st; f.h = Math.atan2(seat[0] - f.x, seat[1] - f.z); f.v = 1.3; }
      } else {
        if (f.sit) { f.x += Math.sin(f.sit[2]) * 0.55; f.z += Math.cos(f.sit[2]) * 0.55; f.sit = null; }
        if (L.here && L.veh && !String(L.veh).startsWith('bike')) { f.v = Math.max(0, f.v - 6 * dt); }      // in a car / on a bus: they stay where they are
        else stepFollower(f, L, slot, dt, env);
      }
      // his own steps: all of them indoors, and the last 15 m before a door (the way back out, and up out of a stairwell)
      { const own = f.own, k = own.length;
        if (!k || Math.hypot(own[k - 1][0] - f.x, own[k - 1][1] - f.z) > 0.5 || (own[k - 1][3] || null) !== (f.room || null)) { own.push([f.x, f.z, f.room ? f.yt : NaN, f.room || null]); if (own.length > 400) own.shift(); }
        if (!f.room && own.length > 30 && !own.some((q) => q[3])) own.splice(0, own.length - 30); }
      out.x = f.x; out.z = f.z; out.y = f.room ? f.yt : NaN; out.h = f.h; out.v = f.want === 'door' ? 0.5 : f.v; out.room = f.room; out.door = f.want === 'door'; out.mode = 'follow';
      out.pose = f.sit ? 'sit' : (!L.here || f.wait) && f.v < 0.05 ? 'phone' : 'stand';
      return out;
    }
    if (this.sims.has(id)) this._ended(n, 'gone', false);       // (the record went without a message: the leader left the room)
    const r = this.rets.get(id); if (!r) return null;
    const f = r.f; r.t += dt;
    const done = () => { this.rets.delete(id); return null; };
    if (!R.seen || r.t > 300 || n.taken) return done();
    const V = (this.opt.walk ? this.opt.walk(n) : n.speed || 1.3) * 1.25;       // (the walk back: a brisk walk of their own)
    if (f.sit) { f.x += Math.sin(f.sit[2]) * 0.55; f.z += Math.cos(f.sit[2]) * 0.55; f.sit = null; }
    out.pose = 'stand'; out.door = false; out.mode = 'return'; out.room = null; out.y = NaN;
    if (r.phase === 'out') {
      // out of the room the way he came in, door by door, and on back along his own steps until there is a way from where
      // he stands to where his day has him (opt.back -> null: none yet — down a stairwell, behind a wall)
      const own = f.own;
      if (!f.room && (r.calcT -= dt) <= 0) { r.calcT = 0.3; const pth = this.opt.back(n, f.x, f.z, R); if (pth || !own.length) { r.path = pth || [[R.x, R.z]]; r.i = 0; r.calcT = 1.5; r.phase = 'path'; } }
      if (r.phase === 'out') {
        let q = own[own.length - 1];
        while (q && Math.hypot(q[0] - f.x, q[1] - f.z) < 0.05) { own.pop(); q = own[own.length - 1]; }
        if (!q) { if (f.room) { r.phase = 'path'; f.room = null; } f.v = 0; }
        else {
          const dx = q[0] - f.x, dz = q[1] - f.z, d = Math.hypot(dx, dz), st = Math.min(d, V * dt), nx = f.x + dx / d * st, nz = f.z + dz / d * st;
          if (this._gate(q[3] || f.room, f.x, f.z, nx, nz)) { f.x = nx; f.z = nz; f.v = V; if (st >= d - 1e-6) { f.room = q[3]; if (Number.isFinite(q[2])) f.yt = q[2]; } } else { f.v = 0; out.door = true; }
          f.h = Math.atan2(dx, dz);
        }
        out.x = f.x; out.z = f.z; out.h = f.h; out.v = out.door ? 0.5 : f.v; out.room = f.room; out.y = f.room ? f.yt : NaN;
        return out;
      }
    }
    // the walk back to where the routine has them (it may be moving: looked at again every 1.5 s)
    const dR = Math.hypot(R.x - f.x, R.z - f.z);
    if (dR < 0.25) return done();
    if (!r.path || (r.calcT -= dt) <= 0) {
      const e = r.path && r.path[r.path.length - 1];
      if (!r.path || Math.hypot(e[0] - R.x, e[1] - R.z) > 2.5) { r.path = this.opt.back(n, f.x, f.z, R) || [[R.x, R.z]]; r.i = 0; }
      else { e[0] = R.x; e[1] = R.z; }
      r.calcT = 1.5;
    }
    let left = V * dt;
    while (left > 1e-6 && r.i < r.path.length) {
      const q = r.path[r.i], dx = q[0] - f.x, dz = q[1] - f.z, d = Math.hypot(dx, dz);
      if (d < 1e-4) { r.i++; continue; }
      const st = Math.min(d, left); f.x += dx / d * st; f.z += dz / d * st; left -= st; f.h = Math.atan2(dx, dz);
      if (st >= d - 1e-6) r.i++;
    }
    f.v = V;
    if (r.i >= r.path.length) return done();
    out.x = f.x; out.z = f.z; out.h = f.h; out.v = V;
    return out;
  }
  /** the seat beside the leader on the bench they are sitting on (systems/sitting.js: the same benches on every client) -> [x, z, h] | null */
  _seat(L, slot) {
    if (!L.here || L.room || L.pose !== 'sit' || L.speed > 0.3) return null;
    const S = this.game.sitting, B = S && S.benches; if (!B || !this.opt.seatAt) return null;
    if (!L.bench || Math.hypot(L.bench.x - L.x, L.bench.z - L.z) > 1.6) { L.bench = null; let bd = 1.6; for (const b of B) { const d = Math.abs(b.x - L.x) + Math.abs(b.z - L.z); if (d < bd) { bd = d; L.bench = b; } } }
    const b = L.bench; if (!b) return null;
    const n = this.opt.seatCount(b), free = [], q = [0, 0, 0];
    let mine = -1, md = 1e9;
    for (let k = 0; k < n; k++) { this.opt.seatAt(b, k, q); const d = Math.hypot(q[0] - L.x, q[1] - L.z); if (d < md) { md = d; mine = k; } }
    for (let k = 0; k < n; k++) if (k !== mine) free.push(k);
    if (slot >= free.length) return null;
    return this.opt.seatAt(b, free[slot], [0, 0, 0]);
  }
  /** test hooks */
  debugJoin(id) { const n = this.byId.get(id); return !!n && this._join(n, this.me, this.game.time.now(), true); }
  debugLeave(id, why = 'bored') { const n = this.byId.get(id); if (!n || this.book.leaderOf(id) !== this.me) return false; this._leave(n, why); return true; }
  state(id) { const f = this.sims.get(id) || (this.rets.get(id) || {}).f, m = this.meta.get(id); return f ? { mode: this.mode(id), walk: f.mode, x: f.x, z: f.z, room: f.room, v: f.v, wait: f.wait, sit: !!f.sit, leftIn: m ? (m.until - this.game.time.now()) / 1000 : null } : null; }
}
