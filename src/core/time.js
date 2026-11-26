// Shared game clock. One game day = 48 real minutes (1 game hour per 2 real minutes), derived from server time so
// every player sees the same time of day. ?time=22.5 in the URL pins the hour locally (for testing).
//
// THE LENGTH OF A GAME HOUR IS SET HERE AND NOWHERE ELSE. Everything that converts between real time and game time
// (an hour of the day, a day index, a schedule in game hours, "N real seconds is how many game hours") imports these
// constants or helpers; tools/smoke_clock.mjs fails if a file under public/src defines its own hour or day length.
// This module has no dependencies and touches no browser object at load, so pure logic modules and node tests import it.
/** real milliseconds in one game hour */
export const HOUR_MS = 120000;
/** real milliseconds in one game day */
export const DAY_MS = 24 * HOUR_MS;
/** real seconds in one game hour (schedules in game hours <-> scenes choreographed in real seconds) */
export const HOUR_S = HOUR_MS / 1000;
/** real milliseconds in one game minute */
export const MINUTE_MS = HOUR_MS / 60;
/** game day index of a shared-clock time (ms) */
export const dayOf = (ms) => Math.floor(ms / DAY_MS);
/** game hour of the day, 0..24, of a shared-clock time (ms) */
export const hourOf = (ms) => (((ms % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS;
/** game hours since the epoch (day * 24 + hour) of a shared-clock time (ms) */
export const hoursOf = (ms) => ms / HOUR_MS;
/** shared-clock ms of game hour `hour` on game day `day` */
export const msOfHour = (day, hour) => day * DAY_MS + hour * HOUR_MS;
/** real ms that n game hours / n game minutes take */
export const gameHours = (n) => n * HOUR_MS;
export const gameMinutes = (n) => n * MINUTE_MS;
/** game hours that pass in s real seconds (the length, in the day's timetable, of a scene played in real time) */
export const hoursOfSeconds = (s) => s / HOUR_S;

/**
 * A save made under another hour length (saves from before `clockHourMs` existed: one real minute an hour) numbers the
 * game days differently. Day (and club-night) indices kept in it — "done today" flags, the day a ticket was bought, the
 * last practice day of the piano streak — are renumbered to the day of this clock that holds the same real moment, so
 * nothing is stuck "done" for years and no streak is lost. Returns true if it changed anything. (core/game.js, on load.)
 */
export function migrateSavedClock(state, nowMs = Date.now()) {
  const from = +state.clockHourMs || 60000;
  state.clockHourMs = HOUR_MS;
  if (from === HOUR_MS) return false;
  const k = from / HOUR_MS, old = nowMs / (24 * from);
  // (a day index of the old numbering: an integer within about a real year before now — no other saved number is near it)
  const fix = (o, key) => { const v = o[key]; if (Number.isInteger(v) && v > old - 30000 && v < old + 3) o[key] = Math.floor(v * k); };
  for (const key in state.flags || {}) fix(state.flags, key);
  if (state.music) fix(state.music, 'lastDay');
  for (const key of ['ptSweet', 'ptLove']) if (state[key] && typeof state[key] === 'object') fix(state[key], 'night');
  return true;
}

export class GameTime {
  constructor() {
    this.offset = 0; // serverNow - Date.now()
    const q = new URLSearchParams(location.search).get('time');
    this.pinned = q !== null && q !== '' && !isNaN(+q) ? +q : null;
  }
  sync(serverNow) { this.offset = serverNow - Date.now(); }
  /** Milliseconds, shared by all clients. Use for anything that must agree between players. REAL time: never scaled. */
  now() { return Date.now() + this.offset; }
  /** 0..24 float */
  get hour() { return this.pinned !== null ? this.pinned : hourOf(this.now()); }
  /** game day index (shared) */
  get day() { return dayOf(this.now()); }
  /** Dark outside: 20:30 - 05:30 */
  get isNight() { const h = this.hour; return h >= 20.5 || h < 5.5; }
  /** 0 at night, 1 in full day, smooth through dawn (5-7) and dusk (19-21). */
  get daylight() {
    const h = this.hour, s = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    return h < 12 ? s(5, 7, h) : 1 - s(19, 21, h);
  }
  /** Index of the current n-minute REAL-time slot (shared). Handy for "half the time" events. Not game time: for the
   *  game day use dayOf(now()) / .day. */
  slot(minutes) { return Math.floor(this.now() / (minutes * 60000)); }
}
