// Crashes, knocks and scrapes (2026-11-23, "add better crash sounds"): what a vehicle sounds like when it hits something,
// made of layers the way a real one is heard, all synthesised from the shared noise buffers (core/audio.js) — no files.
//
//   the vehicle's own body   thump    a low body blow (a sine falling in pitch + low-passed noise: the energy under 150 Hz)
//                            crack    the bumper's plastic giving (a sharp bright tick, a second one a moment later)
//                            crumple  sheet metal folding: a dozen-odd short bursts of narrow-band noise, front-loaded,
//                                     through a filter that jumps about, over the panel's own resonance (noise, not tones)
//                            glass    a hard hit: the burst of a lamp or window going (energy above 4 kHz), then tinkles
//                            debris   the bits coming down afterwards: a few small knocks over a second or so
//                            rattle   a bicycle: the frame's clank, the chain and mudguards jangling, sometimes the bell
//   what was hit             a building or a stone wall: a duller, heavier thump and a little grit; a bollard / post /
//                            railing: an iron or steel clang (a railing: two or three bars, a moment apart); a hedge: a
//                            rustle, twigs snapping (the car's own layers much softer); a fence: wood cracking; a tree:
//                            a dead thump and leaves; another car: a second crumple; a person: a soft body thump only
//                            (bloodless and comic — no crunch, no glass, no splat); the river bank: earth and grass
//   scrape                   a glancing contact along a wall (or a bicycle sliding on its side): one persistent loop,
//                            band-passed noise with a gritty wobble, fed by the contact every frame and fading by
//                            itself the moment the contact stops
//
// Every hit is its own mixture: the timings, pitches, the number of bursts and which layers come in are drawn afresh
// (seeded: two players hear the same crash), so no two are alike. All of it scales with the impact speed.
// It is AT the place it happens (core/audio.js spatial, class 'vehicle', tagged as on the map so it is right from inside
// a walk-in room too; a wall between: audio.occluder), on the "Vehicles and effects" volume.
// A pile-up is not a machine gun: CrashLimiter lets through about six a second (four at once), merges a hit into a
// louder one that has just started near it, and never has more than five crashes sounding at once.
// Multiplayer: the hits of the vehicle you drive go out as one small relay event ('cx'); other players hear them at
// your car (unless they were in the same crash and heard it themselves a moment ago).
//
// Pure parts (no audio) are exported for tools/smoke_ambience.mjs: materialOf, crashPlan, CrashLimiter, encodeCrash /
// decodeCrash. The audio graph is CrashSound.

/** the collider's tag of what was hit (core/mapcollision.js, systems/streetscape.js, the places) -> a material */
const TAG_MAT = {
  building: 'masonry', wall: 'stone', city_wall: 'stone', retaining_wall: 'stone', parapet: 'stone', pier: 'stone', planter: 'stone', pillar: 'stone', pil: 'stone', fountain: 'stone', stage: 'wood',
  fence: 'fence', gate: 'fence', kissing_gate: 'fence', table: 'fence', furniture: 'fence', net: 'hedge', rope: 'hedge',
  hedge: 'hedge', tree: 'tree', leaf: 'hedge',
  railing: 'railing', guard_rail: 'railing', grille: 'railing', scaffold: 'railing',
  lamp: 'post', post: 'post', sign: 'post', street: 'iron', bin: 'bin',
  car: 'car', vehicle: 'car', van: 'car',
};
export const MATS = ['masonry', 'stone', 'fence', 'hedge', 'tree', 'railing', 'post', 'iron', 'bin', 'car', 'bus', 'bike', 'person', 'cyclist', 'bank', 'punt', 'bikefall', 'wood', 'cone', 'glass'];
export function materialOf(tag) { return TAG_MAT[tag] || (tag ? 'stone' : 'masonry'); }

/** a little xorshift: one hit's dice (seeded, so every player hears the same crash) */
export function dice(seed) { let s = (seed >>> 0) || 0x9e3779b9; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/**
 * What one hit is made of: mat (MATS), speed (m/s, the closing speed), striker ('car' | 'bus' | 'bike' | 'foot' |
 * 'prop': a knocked thing landing — only its own material),
 * r = dice() -> { s (0..1 how hard), layers: [{ k, at (s after the hit), g (0..1), ... }], dur (s until it is over) }.
 * Pure: the smoke test reads it.
 */
export function crashPlan(mat, speed, striker = 'car', r = Math.random) {
  const s = clamp((speed - 1.2) / 13, 0, 1), L = [], bike = striker === 'bike', foot = striker === 'foot' || striker === 'prop', big = striker === 'bus';
  const add = (k, at, g, o) => { if (g > 0.004) L.push({ k, at, g: Math.min(1.2, g), ...o }); };
  // how much of the vehicle's own crumpling a hit draws out of it: soft things (a hedge, a person) hardly any
  const soft = mat === 'hedge' ? 0.35 : mat === 'person' || mat === 'cyclist' ? 0.25 : mat === 'bank' ? 0.5 : mat === 'bin' || mat === 'bike' || mat === 'bikefall' ? 0.6 : 1;
  const lv = 0.18 + 0.82 * Math.pow(s, 0.75);
  if (mat === 'punt') { add('wood', 0, 0.5 * lv, { f: 260 + r() * 80, n: 2 }); add('slap', 0.02, 0.4 * lv); return done(s, L); }
  if (mat === 'bikefall') { add('rattle', 0, 0.55, { n: 6 + Math.floor(r() * 4), bell: r() < 0.15 }); add('thump', 0.01, 0.12, { f: 120 }); return done(s, L); }
  if (!bike && !foot) {
    add('thump', 0, lv * (big ? 1.1 : 0.95) * (0.5 + 0.5 * soft), { f: (big ? 48 : 62) * (0.9 + 0.2 * r()), dec: 0.16 + 0.22 * s });
    if (s > 0.06 && soft > 0.3) add('crack', 0.003 + r() * 0.01, (0.25 + 0.6 * s) * soft, { f: 1700 + r() * 1500, two: r() < 0.65 });
    if (s > 0.22 && soft > 0.3) add('crumple', 0.006 + r() * 0.012, (0.15 + 0.85 * (s - 0.22) / 0.78) * soft, { n: 6 + Math.floor(s * 14 + r() * 5), dur: 0.12 + 0.35 * s, lo: 700, hi: 3600 });
    if (s > 0.55 && soft > 0.5 && r() < 0.35 + s * 0.6) add('glass', 0.012 + r() * 0.02, 0.35 + 0.6 * (s - 0.55) / 0.45, { n: 8 + Math.floor(s * 12) });
    if (s > 0.38 && soft > 0.3) add('debris', 0.22 + r() * 0.15, 0.2 + 0.35 * s, { n: 2 + Math.floor(s * 5 + r() * 2), glassy: s > 0.7 });
  } else if (bike) {
    add('rattle', 0, 0.3 + 0.7 * lv, { n: 5 + Math.floor(s * 8 + r() * 3), bell: r() < 0.12 });
    add('thump', 0.005, 0.35 * lv, { f: 95 + r() * 25, dec: 0.12 });
  }
  switch (mat) {
    case 'masonry': case 'stone': add('thump', 0.002, lv * 0.35, { f: 44 + r() * 10, dec: 0.12 }); if (s > 0.3) add('grit', 0.02, 0.4 * s); break;
    case 'railing': { const n = 1 + Math.floor(r() * 3); for (let i = 0; i < n; i++) add('clang', i * (0.012 + r() * 0.03), lv * (0.55 - i * 0.12), { f: 430 + r() * 300, dec: 0.35 + 0.3 * s }); break; }
    case 'post': add('clang', 0.002, lv * 0.75, { f: 260 + r() * 140, dec: 0.6 + 0.6 * s }); break;
    case 'iron': add('clang', 0.002, lv * 0.7, { f: 170 + r() * 90, dec: 0.25 + 0.2 * s, dull: true }); break;
    case 'bin': add('bin', 0.002, lv * 0.8, { f: 105 + r() * 40 }); break;
    case 'fence': case 'wood': add('wood', 0.002, lv * 0.7, { f: 520 + r() * 500, n: 2 + Math.floor(r() * 2), splinter: s > 0.25 }); break;
    case 'hedge': add('rustle', 0, 0.35 + 0.6 * lv, { dur: 0.35 + 0.45 * s, snaps: 1 + Math.floor(s * 5 + r() * 2) }); break;
    case 'tree': add('thump', 0.002, lv * 0.6, { f: 40 + r() * 12, dec: 0.2 }); add('rustle', 0.04, 0.3 + 0.4 * lv, { dur: 0.6 + 0.6 * s, snaps: Math.floor(s * 3), high: true }); break;
    case 'car': case 'bus':
      if (!bike) { if (s > 0.15) add('crumple', 0.01 + r() * 0.02, (0.2 + 0.7 * s) * 0.8, { n: 5 + Math.floor(s * 10 + r() * 4), dur: 0.1 + 0.3 * s, lo: 500, hi: 3000 }); add('thump', 0.004, lv * 0.5, { f: (mat === 'bus' ? 45 : 58) * (0.9 + 0.2 * r()), dec: 0.15 }); }
      else add('panel', 0.003, lv * 0.6, { f: 300 + r() * 120 });
      break;
    case 'bike': add('rattle', 0.004, 0.35 + 0.6 * lv, { n: 6 + Math.floor(s * 8), bell: r() < 0.2 }); break;
    case 'cone': add('thump', 0, 0.25 * lv, { f: 110 + r() * 30, dec: 0.08 }); add('bin', 0.002, 0.3 * lv, { f: 190 + r() * 60, nolid: true }); break;
    case 'glass': add('glass', 0.002, 0.3 + 0.6 * lv, { n: 6 + Math.floor(s * 10) }); break;
    case 'person': case 'cyclist':
      add('body', 0.004, 0.35 + 0.55 * lv, {});
      if (!bike && !foot) add('panel', 0.002, 0.25 + 0.4 * lv, { f: 230 + r() * 90 });      // the bonnet's dull "thunk"
      if (mat === 'cyclist') add('rattle', 0.03, 0.35 + 0.5 * lv, { n: 6 + Math.floor(s * 6), bell: r() < 0.25 });
      break;
    case 'bank': add('thump', 0.002, lv * 0.5, { f: 40, dec: 0.18 }); add('rustle', 0.01, 0.25 + 0.3 * lv, { dur: 0.3, snaps: 0 }); break;
    default: break;
  }
  return done(s, L);
}
function done(s, L) {
  let dur = 0.3; for (const l of L) { const e = l.at + (l.k === 'glass' ? 1.5 : l.k === 'debris' ? 1.6 : l.k === 'clang' ? (l.dec || 0.5) * 1.5 : l.k === 'rustle' ? (l.dur || 0.5) + 0.2 : l.k === 'rattle' ? 0.9 : 0.5); if (e > dur) dur = e; }
  return { s, layers: L, dur };
}

/**
 * The rate limit. admit(t, x, z, level, remote) -> the gain to play it at (0 = not at all). Tokens: `rate` a second,
 * `burst` at most. A hit within `mergeT` s and `mergeR` m of one that has just been played and is at least as loud is
 * already heard (two cars in one collision report it twice; so do the peers of a multiplayer crash, over a longer
 * window). No more than `max` sounding at once.
 */
export class CrashLimiter {
  constructor({ rate = 6, burst = 4, mergeT = 0.14, mergeR = 6, remoteT = 0.6, remoteR = 9, max = 5 } = {}) {
    this.rate = rate; this.burst = burst; this.tokens = burst; this.t = -1; this.mergeT = mergeT; this.mergeR = mergeR; this.remoteT = remoteT; this.remoteR = remoteR; this.max = max;
    this.recent = []; this.ends = []; this.dropped = 0; this.merged = 0; this.played = 0;
  }
  admit(t, x, z, level, remote = false, dur = 1) {
    if (this.t >= 0) this.tokens = Math.min(this.burst, this.tokens + (t - this.t) * this.rate);
    this.t = t;
    const R = this.recent, wT = remote ? this.remoteT : this.mergeT, wR = remote ? this.remoteR : this.mergeR;
    for (let i = R.length - 1; i >= 0; i--) { const q = R[i]; if (t - q.t > Math.max(this.remoteT, this.mergeT)) { R.splice(i, 1); continue; } if (t - q.t <= wT && Math.hypot(q.x - x, q.z - z) <= wR && q.level >= level * 0.8) { this.merged++; return 0; } }
    const E = this.ends; for (let i = E.length - 1; i >= 0; i--) if (E[i] <= t) E.splice(i, 1);
    if (E.length >= this.max || this.tokens < 1) { this.dropped++; return 0; }
    this.tokens -= 1; R.push({ t, x, z, level }); E.push(t + dur); this.played++;
    return 1;
  }
}

/** the relay event: [x, y, z (dm), material index, speed (dm/s), seed, striker 0 car / 1 bus / 2 bike] */
export const CRASH = 'cx';
const STRIKERS = ['car', 'bus', 'bike', 'foot'];
export function encodeCrash(c) { return [Math.round(c.x * 10), Math.round(c.y * 10), Math.round(c.z * 10), Math.max(0, MATS.indexOf(c.mat)), Math.round(clamp(c.speed, 0, 60) * 10), c.seed >>> 0, Math.max(0, STRIKERS.indexOf(c.striker))]; }
export function decodeCrash(a) {
  if (!Array.isArray(a) || a.length !== 7) return null;
  for (const v of a) if (!Number.isFinite(v)) return null;
  if (a[3] < 0 || a[3] >= MATS.length || a[4] < 0 || a[4] > 600 || a[6] < 0 || a[6] >= STRIKERS.length) return null;
  return { x: a[0] / 10, y: a[1] / 10, z: a[2] / 10, mat: MATS[a[3] | 0], speed: a[4] / 10, seed: a[5] >>> 0, striker: STRIKERS[a[6] | 0] };
}

// ------------------------------------------------------------------------------------------------ the audio graph
// level at the panner's reference distance (6 m, class 'vehicle'), before the effects bus and the 0.6 master
const BASE = 0.55;

export class CrashSound {
  /** game: for audio, the network and the player's place (any of them may be missing: then that part does nothing) */
  constructor(game, audio = null) {
    this.game = game; this.audio = audio || (game && game.audio) || null; this.lim = new CrashLimiter(); this.scr = null; this.P = { x: 0, y: 0, z: 0, place: 'world' };
    this.stats = { hits: 0, remote: 0, sent: 0, scrapes: 0 }; this._sendT = -1;
    const net = game && game.net;
    if (net && net.on) { try { net.on(CRASH, (d) => { const c = decodeCrash(d); if (c) { this.stats.remote++; this.hit(c.mat, c.speed, c.x, c.y, c.z, { striker: c.striker, seed: c.seed, remote: true }); } }); } catch { /* */ } }
    const A = this.audio; if (A && A.reports && game) A.reports.crashes = () => ({ ...this.stats, played: this.lim.played, merged: this.lim.merged, dropped: this.lim.dropped, scraping: !!(this.scr && this.scr.on) });
    if (A && A.onPoison) A.onPoison(() => this._dropScrape());
  }
  get ctx() { const A = this.audio; return A && A.ctx && A.noiseBuf ? A.ctx : null; }

  /**
   * A hit: mat (MATS, or a collider tag: materialOf), speed m/s, where (world metres; y = height of the contact).
   * opts: striker ('car' | 'bus' | 'bike' | 'foot'), seed, remote (came over the network), send (tell the other
   * players: the vehicle you drive), gain (x). -> true if it was played.
   */
  hit(mat, speed, x, y, z, opts = {}) {
    const c = this.ctx, A = this.audio; if (!c || !(isFinite(x) && isFinite(z) && isFinite(speed)) || speed <= 0) return false;
    if (!MATS.includes(mat)) mat = materialOf(mat);
    if (!isFinite(y)) y = 0.5;
    const seed = opts.seed !== undefined ? opts.seed >>> 0 : (Math.random() * 4294967296) >>> 0, striker = opts.striker || 'car';
    const plan = crashPlan(mat, speed, striker, dice(seed));
    if (!plan.layers.length) return false;
    // (the network gets it whether or not we hear it ourselves: a peer may be nearer)
    if (opts.send && !opts.remote) this._send(mat, speed, x, y, z, seed, striker, c.currentTime);
    const lx = A._lx, lz = A._lz, d = Math.hypot(x - lx, z - lz);
    if (d > 170) return false;
    const lvl = (0.2 + plan.s) * (opts.gain ?? 1);
    if (!this.lim.admit(c.currentTime, x, z, lvl, !!opts.remote, plan.dur)) return false;
    this.stats.hits++;
    try { return this._play(plan, x, y, z, dice(seed ^ 0x5bd1e995), opts.gain ?? 1); } catch (e) { if (A._bad) A._bad('crash: ' + (e && e.message)); return false; }
  }
  _send(mat, speed, x, y, z, seed, striker, t) {
    const net = this.game && this.game.net; if (!net || !net.connected || !net.send || speed < 2.5) return;
    if (t - this._sendT < 0.12) return; this._sendT = t;
    try { net.send(CRASH, encodeCrash({ x, y, z, mat, speed, seed, striker })); this.stats.sent++; } catch { /* */ }
  }
  /** where the sound goes: a place on the map, muffled from inside a room, a wall between asked of audio.occluder */
  _at(x, y, z, dur) {
    const A = this.audio, P = { x, y, z, place: 'world' };
    const h = A.spatial ? A.spatial(P, { cls: 'vehicle', occlusion: true, ttl: dur + 0.5 }) : null;
    if (!h) return { node: A.master, free() {} };
    const here = !A.framePlace || A.framePlace === 'world';
    if (here && A.occluder && !A.occlusion) { let k = 0; try { k = A.occluder(x, z) ? 0.65 : 0; } catch { k = 0; } if (k) h.occlude(k); }
    return { node: h.in || h, free: () => h.free() };
  }
  _play(plan, x, y, z, r, gain) {
    const c = this.ctx, A = this.audio, t0 = c.currentTime + 0.005, out = c.createGain(); out.gain.value = BASE * gain;
    const sp = this._at(x, y, z, plan.dur); out.connect(sp.node);
    let last = t0;
    const end = (src, t) => { if (t > last) last = t; src.stop(t + 0.03); };
    for (const l of plan.layers) {
      const t = t0 + l.at, g = l.g;
      switch (l.k) {
        case 'thump': this._thump(out, t, g, l.f || 60, l.dec || 0.2, r, end); break;
        case 'crack': this._crack(out, t, g, l.f || 2200, r, end); if (l.two) this._crack(out, t + 0.018 + r() * 0.05, g * (0.35 + 0.3 * r()), (l.f || 2200) * (0.8 + 0.4 * r()), r, end); break;
        case 'crumple': this._crumple(out, t, g, l.n, l.dur, l.lo, l.hi, r, end); break;
        case 'glass': this._glass(out, t, g, l.n, r, end); break;
        case 'debris': this._debris(out, t, g, l.n, l.glassy, r, end); break;
        case 'grit': this._burst(out, t, 0.22 + r() * 0.15, 'highpass', 3400, 0.6, g * 0.3, 0.02, end); break;
        case 'clang': this._clang(out, t, g, l.f, l.dec, l.dull, r, end); break;
        case 'bin': this._bin(out, t, g, l.f, r, end, !!l.nolid); break;
        case 'wood': this._wood(out, t, g, l.f, l.n, l.splinter, r, end); break;
        case 'rustle': this._rustle(out, t, g, l.dur, l.snaps, l.high, r, end); break;
        case 'rattle': this._rattle(out, t, g, l.n, l.bell, r, end); break;
        case 'body': this._body(out, t, g, r, end); break;
        case 'panel': this._panel(out, t, g, l.f, r, end); break;
        case 'slap': this._burst(out, t, 0.18, 'lowpass', 900, 0.6, g * 0.5, 0.004, end); this._burst(out, t + 0.03, 0.22, 'bandpass', 2600, 0.7, g * 0.2, 0.01, end); break;
        default: break;
      }
    }
    const tail = Math.max(0.05, last - c.currentTime + 0.1);
    setTimeoutSafe(() => { try { out.disconnect(); } catch { /* */ } sp.free(); }, tail * 1000 + 200, this.audio);
    return true;
  }

  // ---- the pieces (each a few nodes, freed when its source ends)
  _src(dest, filter) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(); s.buffer = this.audio.noiseBuf; s.loop = true; g.gain.value = 0;
    if (filter) { s.connect(filter); filter.connect(g); } else s.connect(g);
    g.connect(dest); s.onended = () => { try { g.disconnect(); if (filter) filter.disconnect(); } catch { /* */ } };
    return { s, g };
  }
  _filt(type, f, q) { const F = this.ctx.createBiquadFilter(); F.type = type; F.frequency.value = f; F.Q.value = q; return F; }
  /** a burst of filtered noise: attack a, exponential decay over dur */
  _burst(dest, t, dur, type, f, q, g, a, end) {
    const { s, g: G } = this._src(dest, this._filt(type, f, q));
    G.gain.setValueAtTime(0, t); G.gain.linearRampToValueAtTime(g, t + a); G.gain.exponentialRampToValueAtTime(Math.max(1e-5, g * 0.001), t + dur); G.gain.linearRampToValueAtTime(0, t + dur + 0.01);
    s.start(t, Math.random() * 2); end(s, t + dur + 0.02);
  }
  _osc(dest, t, type, f, g, a, dec, f2 = 0) {
    const c = this.ctx, o = c.createOscillator(), G = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dec * 0.8);
    G.gain.value = 0; G.gain.setValueAtTime(0, t); G.gain.linearRampToValueAtTime(g, t + a); G.gain.exponentialRampToValueAtTime(Math.max(1e-5, g * 0.001), t + dec); G.gain.linearRampToValueAtTime(0, t + dec + 0.01);
    o.connect(G); G.connect(dest); o.start(t); o.onended = () => { try { G.disconnect(); } catch { /* */ } };
    return o;
  }
  _thump(dest, t, g, f, dec, r, end) {
    const ff = f * (0.8 + 0.4 * r()), dd = dec * (0.75 + 0.5 * r());
    end(this._osc(dest, t, 'sine', ff * 1.5, g * 0.24, 0.003, dd, ff * (0.6 + 0.2 * r())), t + dd + 0.02);
    this._burst(dest, t, dd * 0.7, 'lowpass', 170 + r() * 90, 0.9, g * 0.5, 0.002, end);
    this._burst(dest, t, 0.08 + r() * 0.06, 'bandpass', 250 + r() * 200, 1.4, g * 3.0, 0.0015, end);      // (the body's boom, where a small loudspeaker can carry it)
    this._burst(dest, t, 0.05 + r() * 0.04, 'bandpass', 500 + r() * 300, 1.4, g * 1.5, 0.001, end);
  }
  _crack(dest, t, g, f, r, end) {
    this._burst(dest, t, 0.03 + r() * 0.02, 'highpass', f, 0.8, g * 0.9, 0.0008, end);
    this._burst(dest, t, 0.05 + r() * 0.03, 'bandpass', 800 + r() * 700, 7, g * 1.1, 0.001, end);
  }
  /** sheet metal folding: one noise source through a narrow filter that jumps, under a gain of many short blips */
  _crumple(dest, t, g, n, dur, lo, hi, r, end) {
    // two strands (the lower and the upper half of the band), each a run of blips that never overlap one another
    const mid = (lo + hi) / 2, m = Math.max(2, Math.ceil(n / 2));
    for (const [a0, a1, off] of [[lo, mid * 1.15, 0], [mid * 0.85, hi, 0.004 + r() * 0.01]]) {
      const F = this._filt('bandpass', a0 + (a1 - a0) * r(), 5 + r() * 4), { s, g: G } = this._src(dest, F);
      let u = t + off; G.gain.setValueAtTime(0, u);
      for (let i = 0; i < m; i++) {
        const k = i / m, w = Math.pow(1 - k, 1.4), a = 0.002 + r() * 0.003, d = 0.012 + r() * 0.03;
        F.frequency.setValueAtTime(a0 + (a1 - a0) * Math.pow(r(), 1.3), u);
        G.gain.setValueAtTime(0.0002, u); G.gain.linearRampToValueAtTime(g * 1.7 * (0.35 + 0.65 * w) * (0.6 + 0.6 * r()), u + a); G.gain.exponentialRampToValueAtTime(0.0002, u + a + d);
        u += Math.max(a + d + 0.001, (dur / m) * (0.3 + 1.4 * r()) * (0.5 + k));
      }
      G.gain.linearRampToValueAtTime(0, u + 0.01);
      s.start(t, Math.random() * 2); end(s, u + 0.03);
    }
    // the panel's own ring under it: two narrow noise resonances (noise, not tones: a dent does not sing a note)
    for (const m of [1, 2.3 + r() * 0.4]) this._burst(dest, t, 0.12 + 0.18 * r(), 'bandpass', (380 + r() * 260) * m, 22 + r() * 14, g * 1.1, 0.002, end);
  }
  _glass(dest, t, g, n, r, end) {
    this._burst(dest, t, 0.08 + r() * 0.05, 'highpass', 4200 + r() * 1500, 0.7, g * 0.7, 0.001, end);      // the pane going
    this._burst(dest, t + 0.005, 0.25 + r() * 0.15, 'bandpass', 6500 + r() * 2000, 1.2, g * 0.25, 0.004, end);
    // the pieces landing: tinkles, dense at first and thinning out, with a few late ones
    let u = t + 0.03;
    for (let i = 0; i < n; i++) {
      const f = 3200 + r() * 6200, d = 0.02 + r() * 0.07, gg = g * 0.16 * (0.4 + 0.6 * r()) * (i < n * 0.6 ? 1 : 0.6);
      end(this._osc(dest, u, 'sine', f, gg, 0.0008, d), u + d + 0.02);
      if (r() < 0.5) end(this._osc(dest, u, 'sine', f * (2.4 + r() * 0.6), gg * 0.5, 0.0008, d * 0.6), u + d);
      u += (0.015 + r() * 0.06) * (1 + i / n * 3);
    }
  }
  _debris(dest, t, g, n, glassy, r, end) {
    let u = t;
    for (let i = 0; i < n; i++) {
      const gg = g * (1 - i / (n + 1)) * (0.5 + 0.5 * r());
      if (glassy && r() < 0.35) end(this._osc(dest, u, 'sine', 3500 + r() * 4000, gg * 0.12, 0.001, 0.05), u + 0.07);
      else this._burst(dest, u, 0.025 + r() * 0.04, 'bandpass', 700 + r() * 2200, 2.5 + r() * 3, gg * 0.45, 0.001, end);
      u += 0.08 + r() * 0.35;
    }
  }
  /** a tube or a cast post struck: inharmonic partials (a tube's 1 : 2.76 : 5.40 : 8.93), quickly gone if dull */
  _clang(dest, t, g, f, dec, dull, r, end) {
    const P = dull ? [[1, 1, 1], [2.76, 0.4, 0.5], [5.4, 0.15, 0.3]] : [[1, 1, 1], [2.76, 0.6, 0.7], [5.4, 0.35, 0.45], [8.93, 0.18, 0.3]];
    for (const [m, k, dk] of P) { const ff = f * m * (0.985 + 0.03 * r()); end(this._osc(dest, t, 'sine', ff, g * 0.22 * k, 0.001, dec * dk), t + dec * dk + 0.02); }
    this._burst(dest, t, 0.02, 'bandpass', 2500 + r() * 1200, 1.5, g * 0.6, 0.0006, end);
    this._burst(dest, t, 0.08, 'lowpass', 300, 0.8, g * 0.4, 0.002, end);
  }
  /** a wheelie bin: a hollow plastic boom, the lid slapping */
  _bin(dest, t, g, f, r, end, nolid = false) {
    this._burst(dest, t, 0.18, 'bandpass', f * 2, 3, g * 0.9, 0.002, end);
    this._burst(dest, t, 0.06, 'bandpass', 700 + r() * 400, 2, g * 0.6, 0.001, end);      // the plastic's knock
    end(this._osc(dest, t, 'sine', f * 1.2, g * 0.25, 0.002, 0.14, f * 0.9), t + 0.16);
    if (nolid) return;
    const lid = t + 0.12 + r() * 0.12; this._burst(dest, lid, 0.05, 'bandpass', 1100 + r() * 600, 2.5, g * 0.8, 0.001, end); this._burst(dest, lid + 0.07 + r() * 0.05, 0.04, 'bandpass', 1300 + r() * 500, 2.5, g * 0.45, 0.001, end);
  }
  _wood(dest, t, g, f, n, splinter, r, end) {
    let u = t; for (let i = 0; i < n; i++) { this._burst(dest, u, 0.05 + r() * 0.04, 'bandpass', f * (0.8 + 0.4 * r()), 3 + r() * 2, g * (i ? 0.5 : 0.9), 0.0015, end); u += 0.03 + r() * 0.06; }
    this._burst(dest, t, 0.09, 'lowpass', 260, 0.8, g * 0.5, 0.002, end);
    if (splinter) { let w = t + 0.01; for (let i = 0; i < 6; i++) { this._burst(dest, w, 0.015 + r() * 0.02, 'highpass', 2400 + r() * 2500, 0.7, g * 0.3 * (1 - i / 7), 0.0008, end); w += 0.01 + r() * 0.04; } }
  }
  /** branches and leaves: grainy high noise, a soft swoosh, twigs snapping */
  _rustle(dest, t, g, dur, snaps, high, r, end) {
    const F = this._filt('bandpass', high ? 4200 : 3000, 0.7), { s, g: G } = this._src(dest, F);
    G.gain.setValueAtTime(0, t);
    const n = Math.floor(dur * 60); for (let i = 0; i < n; i++) { const k = i / n, env = Math.sin(Math.min(1, k * 5) * Math.PI / 2) * Math.pow(1 - k, 1.3); G.gain.linearRampToValueAtTime(g * 0.4 * env * (0.25 + 0.75 * r()), t + (i + 1) * (dur / n)); }
    G.gain.linearRampToValueAtTime(0, t + dur + 0.02); s.start(t, Math.random() * 2); end(s, t + dur + 0.04);
    this._burst(dest, t, dur * 0.6, 'lowpass', 700, 0.6, g * 0.3, 0.02, end);
    let u = t + 0.01; for (let i = 0; i < snaps; i++) { this._burst(dest, u, 0.012 + r() * 0.015, 'highpass', 1800 + r() * 2200, 0.8, g * 0.4, 0.0006, end); u += 0.03 + r() * (dur / Math.max(1, snaps)); }
  }
  /** a bicycle: the frame's clank, then the chain and the mudguards jangling; once in a while the bell catches */
  _rattle(dest, t, g, n, bell, r, end) {
    this._clang(dest, t, g * 0.55, 700 + r() * 350, 0.12, false, r, end);
    let u = t + 0.01; for (let i = 0; i < n; i++) { this._burst(dest, u, 0.008 + r() * 0.012, 'bandpass', 2600 + r() * 3800, 9 + r() * 6, g * 0.55 * (1 - i / (n + 2)), 0.0005, end); u += 0.02 + r() * 0.05 * (1 + i / n); }
    if (bell) { const tb = t + 0.05 + r() * 0.1; end(this._osc(dest, tb, 'sine', 2350, g * 0.05, 0.001, 0.5), tb + 0.52); end(this._osc(dest, tb, 'sine', 2350 * 2.76, g * 0.015, 0.001, 0.25), tb + 0.27); }
  }
  /** somebody bumped (a comic tumble, not an injury): a soft cloth-and-body thump */
  _body(dest, t, g, r, end) {
    this._burst(dest, t, 0.13, 'lowpass', 300 + r() * 80, 0.8, g * 0.4, 0.003, end);
    this._burst(dest, t, 0.1, 'bandpass', 320 + r() * 160, 1.6, g * 2.4, 0.003, end);
    end(this._osc(dest, t, 'sine', 100 + r() * 20, g * 0.2, 0.004, 0.12, 70), t + 0.14);
    this._burst(dest, t + 0.005, 0.12, 'bandpass', 1200 + r() * 500, 0.7, g * 0.35, 0.02, end);      // the coat
  }
  /** a car's panel struck flat (a bonnet, a door): a dull thunk, no crunch */
  _panel(dest, t, g, f, r, end) {
    this._burst(dest, t, 0.09, 'bandpass', f, 2, g * 1.3, 0.0015, end);
    this._burst(dest, t, 0.16, 'bandpass', f * (2.1 + r() * 0.3), 16, g * 0.6, 0.002, end);
    this._burst(dest, t, 0.1, 'lowpass', 180, 0.8, g * 0.4, 0.002, end);
  }

  /**
   * Scraping along something, called every frame the contact goes on: level 0..1, where, mat ('stone' a car's flank
   * on a wall, 'metal' on railings, 'tarmac' a bicycle on its side). One persistent loop (made the first time), its
   * level set here and falling by itself 0.12 s after the last call; unhooked after three seconds of silence.
   */
  scrape(level, x, y, z, mat = 'stone') {
    const c = this.ctx, A = this.audio; if (!c || !(isFinite(x) && isFinite(z) && isFinite(level))) return;
    if (level <= 0.01 && !(this.scr && this.scr.on)) return;
    if (!this.scr) {
      try {
        const S = { on: false, h: null, P: { x, y, z, place: 'world' } };
        S.s = c.createBufferSource(); S.s.buffer = A.noiseBuf; S.s.loop = true;
        S.f = this._filt('bandpass', 2200, 1.0); S.g = c.createGain(); S.g.gain.value = 0;
        S.b = c.createBufferSource(); S.b.buffer = A.brownBuf || A.noiseBuf; S.b.loop = true;
        S.bf = this._filt('lowpass', 320, 0.9); S.bg = c.createGain(); S.bg.gain.value = 0;
        S.out = c.createGain(); S.out.gain.value = 1;
        S.s.connect(S.f); S.f.connect(S.g); S.g.connect(S.out); S.b.connect(S.bf); S.bf.connect(S.bg); S.bg.connect(S.out);
        S.s.start(); S.b.start();
        this.scr = S;
      } catch { this.scr = null; return; }
    }
    const S = this.scr, t = c.currentTime, k = clamp(level, 0, 1);
    S.P.x = x; S.P.y = isFinite(y) ? y : 0.4; S.P.z = z;
    if (!S.h) { S.h = A.spatial ? A.spatial(() => S.P, { cls: 'vehicle', occlusion: true, keep: true }) : null; try { S.out.connect(S.h ? S.h.in || S.h : A.master); } catch { /* */ } }
    if (!S.on) this.stats.scrapes++;
    S.on = true; S.last = t;
    const hz = mat === 'tarmac' ? 3200 : mat === 'metal' ? 2600 : mat === 'hedge' ? 3800 : 1700, wob = 0.65 + 0.7 * Math.random();      // (a gritty wobble: the contact is never even)
    S.f.frequency.setTargetAtTime(hz * (0.85 + 0.3 * Math.random()) * (0.8 + 0.4 * k), t, 0.03);
    for (const [G, v] of [[S.g.gain, BASE * (mat === 'hedge' ? 0.3 : 0.42) * k * wob], [S.bg.gain, BASE * (mat === 'tarmac' || mat === 'hedge' ? 0.08 : 0.22) * k * (0.8 + 0.4 * Math.random())]]) { G.cancelScheduledValues(t); G.setTargetAtTime(v, t, 0.025); G.setTargetAtTime(0, t + 0.12, 0.06); }
    if (!S.timer) S.timer = setTimeoutSafe(() => this._idle(), 1000, A);
  }
  _idle() {
    const S = this.scr; if (!S) return; S.timer = null; const c = this.ctx; if (!c) return;
    if (c.currentTime - S.last > 3) { this._dropScrape(); return; }
    if (c.currentTime - S.last > 0.3) S.on = false;
    S.timer = setTimeoutSafe(() => this._idle(), 1000, this.audio);
  }
  _dropScrape() { const S = this.scr; if (!S) return; this.scr = null; for (const n of [S.s, S.b]) { try { n.stop(); } catch { /* */ } } for (const n of [S.s, S.f, S.g, S.b, S.bf, S.bg, S.out]) { try { n.disconnect(); } catch { /* */ } } if (S.h) { try { S.h.free(); } catch { /* */ } } }
}

/** a timer that also works under an OfflineAudioContext in the tools (no timers there: the nodes are left to the render) */
function setTimeoutSafe(fn, ms, audio) { if (audio && audio.offline) return null; try { const h = setTimeout(fn, ms); if (h && h.unref) h.unref(); return h; } catch { return null; } }
