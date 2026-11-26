// Background music rules — PURE (no DOM, no three, no audio). systems/soundtrack.js plays recorded tracks by mood
// (_soundtrack_player.js); tools/smoke_soundtrack.mjs tests this file in node.
//   MOODS                          the moods (ids and what they stand for)
//   playlistsFor(manifest, seed)   recorded tracks: a Playlist per mood (shuffled, never the same track twice running)
//   GAP                            seconds of real silence between one recorded track and the next
//   moodFor(s, prev)               which mood belongs to a place: s = {place, college, green, water, shop, zone(x,z), x, z}
//   Director                       dwell + crossfade weights (no flapping at a border)
//   duckTarget(s, out)             how far the music backs off for what is going on (speech, a chase, a minigame …)
//   Ducker                         falls quickly, holds, comes back slowly
/** which tracks belong to which mood is in public/audio/music/manifest.json; `still` and `silent` never have any */
export const MOODS = {
  cloister: { name: 'College quads and cloisters' },
  town: { name: 'The centre and the shopping streets' },
  green: { name: 'Rivers, the canal, meadows and parks' },
  lanes: { name: 'Jericho, Cowley Road and East Oxford' },
  open: { name: 'Headington and the outskirts' },
  still: { name: 'Indoors: nothing' },
  silent: { name: 'Places with music of their own' },
};
export const MOOD_IDS = Object.keys(MOODS);

// ------------------------------------------------------------------------------------------------ which mood where
/** rooms that play music of their own (jukebox, DJ, practice pianos) or are pubs / bars: the explorer music stays out */
const OWN_MUSIC = new Set(['purple_turtle', 'worcester_bar', 'music_faculty']);
const PUBLIKE = /(^|_)(pub|bar|nightclub|tavern|inn|turtle|records)(_|$)/;
export function interiorMood(place) { return OWN_MUSIC.has(place) || PUBLIKE.test(place) ? 'silent' : 'still'; }

/** the mood of one of world/index.js's zones (world.zoneAt): the only "map" used is the game's own */
export function zoneMood(zone, x, z) {
  if (zone === 'centre') return 'town';
  if (zone === 'jericho') return 'lanes';
  if (zone === 'east') return z >= 380 ? 'lanes' : 'open';      // St Clement's, Cowley Road, Iffley Road | Headington Road and Hill, Marston
  return 'open';                                                // North Oxford, Osney and the station, Grandpont, the rest
}
const ZONE_MOODS = new Set(['town', 'lanes', 'open']);
/**
 * s: {place, college (standing inside a college's grounds: the HUD banner's site), green, water, shop (0..1, the
 * ambience raster), zone(x, z) → zone name, x, z}. prev = the current mood: borders are sticky (a threshold has to be
 * well passed, and a zone has to hold 30 m all round you before it takes over from another zone).
 */
export function moodFor(s, prev = null) {
  if (s.place && s.place !== 'world') return interiorMood(s.place);
  if (s.college) return 'cloister';
  const g = Math.max(s.green || 0, (s.water || 0) * 1.15);
  if (g > (prev === 'green' ? 0.4 : 0.6)) return 'green';
  if ((s.shop || 0) > (prev === 'town' ? 0.3 : 0.55)) return 'town';
  const zf = s.zone || (() => 'mid'), here = zoneMood(zf(s.x, s.z), s.x, s.z);
  if (here === prev || !ZONE_MOODS.has(prev)) return here;
  const R = 30;
  for (const [dx, dz] of [[R, 0], [-R, 0], [0, R], [0, -R]]) if (zoneMood(zf(s.x + dx, s.z + dz), s.x + dx, s.z + dz) !== here) return prev;
  return here;
}

/** dwell (a candidate has to last) + linear crossfade weights; a door is immediate and fades faster */
export class Director {
  constructor({ dwell = 3, fade = 8, doorFade = 4 } = {}) {
    this.dwell = dwell; this.fade = fade; this.doorFade = doorFade;
    this.cur = null; this.cand = null; this.candT = 0; this.rate = 1 / fade; this.switches = 0;
    this.w = {}; for (const id of MOOD_IDS) this.w[id] = 0;
  }
  /** cand: mood id for where the player is now; door: the place itself changed (no dwell) */
  update(dt, cand, door = false) {
    if (this.cur === null) { this.cur = cand; this.w[cand] = 1; this.cand = cand; return this.cur; }
    if (cand !== this.cand) { this.cand = cand; this.candT = 0; } else this.candT += dt;
    if (cand !== this.cur && (door || this.candT >= this.dwell)) { this.cur = cand; this.switches++; this.rate = 1 / (door ? this.doorFade : this.fade); }
    const step = dt * this.rate;
    for (const id of MOOD_IDS) { const w = this.w[id]; this.w[id] = id === this.cur ? Math.min(1, w + step) : Math.max(0, w - step); }
    return this.cur;
  }
}

// ------------------------------------------------------------------------------------------------ backing off
/**
 * s: {speech, dialog, activity, police (wanted level), diegetic (other music is playing), show (fireworks / May Morning
 * near), crash (camera shake 0..1.5), frozen, carSpeed (m/s, 0 on foot or a bike)}
 * → out {event: 0..1, hold: seconds to stay down after it ends, speech: 0..1, drive: 0..1, why: [...]}
 */
export function duckTarget(s, out = {}) {
  let ev = 1, hold = 0; const why = (out.why = out.why || []); why.length = 0;
  const hit = (v, h, name) => { why.push(name); if (v < ev) ev = v; if (h > hold) hold = h; };
  if (s.police > 0) hit(0, 6, 'police');
  if (s.activity) hit(0, 3, 'activity');
  if (s.diegetic) hit(0, 5, 'music');
  if (s.show) hit(0, 8, 'show');
  if ((s.crash || 0) >= 0.45) hit(0.12, 5, 'crash');
  if (s.dialog) hit(0.3, 1.5, 'dialog');
  else if (s.frozen) hit(0.5, 1, 'frozen');
  out.event = ev; out.hold = hold;
  out.speech = s.speech ? 0.45 : 1; if (s.speech) why.push('speech');
  const v = s.carSpeed || 0;
  out.drive = v <= 12 ? 1 : v >= 26 ? 0.25 : 1 - 0.75 * (v - 12) / 14; if (v > 12) why.push('driving');
  return out;
}
/** down with time constant `down` (s), held `hold` s after the cause ends, then back up linearly over `up` s */
export class Ducker {
  constructor({ down = 0.6, up = 7 } = {}) { this.g = 1; this.hold = 0; this.down = down; this.up = up; }
  update(dt, target, hold = 0) {
    if (target < this.g - 1e-4) { this.g += (target - this.g) * (1 - Math.exp(-dt / this.down)); if (this.g - target < 0.004) this.g = target; this.hold = Math.max(this.hold, hold); }
    else if (target <= this.g + 1e-4) this.hold = Math.max(this.hold, hold);        // still held down
    else if (this.hold > 0) this.hold -= dt;
    else this.g = Math.min(target, this.g + dt / this.up);
    return this.g;
  }
}

export function rng(seed) { let s = (seed >>> 0) || 0x9e3779b9; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const hashStr = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };

// ------------------------------------------------------------------------------------------------ recorded tracks
export const GAP = [20, 60];
/** One mood's tracks in a shuffled order that is reshuffled each time round; the same track never plays twice running. */
export class Playlist {
  constructor(tracks, seed = 1, key = '') {
    this.tracks = tracks.slice(); this.rnd = rng((seed ^ hashStr('tracks:' + key)) >>> 0 || 1);
    for (let i = 0; i < 8; i++) this.rnd();
    this.bag = []; this.last = null;
  }
  get size() { return this.tracks.length; }
  /** → the next track, or null when the mood has none */
  next() {
    const T = this.tracks;
    if (!T.length) return null;
    if (!this.bag.length) {
      const b = (this.bag = T.slice());
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)), x = b[i]; b[i] = b[j]; b[j] = x; }
      if (b.length > 1 && b[0] === this.last) { const j = 1 + Math.floor(this.rnd() * (b.length - 1)), x = b[0]; b[0] = b[j]; b[j] = x; }
    }
    return (this.last = this.bag.shift());
  }
  /** a track that would not load is left out from now on */
  drop(id) { this.tracks = this.tracks.filter((t) => t.id !== id); this.bag = this.bag.filter((t) => t.id !== id); }
  gap() { return GAP[0] + this.rnd() * (GAP[1] - GAP[0]); }
}
/** manifest = {tracks: [{id, file, duration, moods: [...]}, …]} (public/audio/music/manifest.json) → {mood: Playlist} or null when there is nothing usable */
export function playlistsFor(manifest, seed = 1) {
  const by = {}; let n = 0;
  for (const t of (manifest && Array.isArray(manifest.tracks) ? manifest.tracks : [])) {
    if (!t || typeof t.id !== 'string' || typeof t.file !== 'string' || !/^[\w.-]+\.(mp3|ogg)$/.test(t.file) || !(t.duration > 1) || !Array.isArray(t.moods)) continue;
    for (const m of t.moods) if (MOODS[m] && m !== 'still' && m !== 'silent') { (by[m] || (by[m] = [])).push(t); n++; }      // never indoors
  }
  if (!n) return null;
  const out = {}; for (const m of Object.keys(by)) out[m] = new Playlist(by[m], seed, m);
  return out;
}
