// The weather over Oxford — pure and deterministic (no three.js, no DOM, no Math.random): ONE weather for the whole
// world, a function of the shared clock alone, so every player sees the same sky and the gliding air model
// (_glide_air.js, which reads its wind, cloud base and sunshine from here) agrees with what walkers see.
//
// THE CLOCK. The length of a game day is set in core/time.js and the game has no calendar. The climate is Michaelmas
// term's: the season drifts smoothly from early October (s = 0) to early December (s = 1) and back over a 56-game-day
// "term" (8 weeks, ~22 real hours) — a cosine, so it never jumps. Oxford normals (Radcliffe Observatory 1991–2020):
//   Oct  max 15.1 °C  min 8.0  73 mm  10.9 rain days (>= 1 mm)  110 h sun        Dec  max 8.2  min 2.6  66 mm  12.2 days  58 h
//   Nov  max 10.9     min 4.9  72 mm  11.3 days                   71 h sun        air frost: ~1 night in Oct, ~4 Nov, ~8 Dec
// Rain falls on roughly a third of days, mostly light; the game is tuned a little sunnier than the real thing (fine
// spells are the most common state) so that it stays inviting. Times below are GAME hours (HOUR_MS of the shared clock each).
//
// Ingredients (all smooth functions of time, so nothing flickers and the state changes only by blending):
//   synoptic  a slow "pressure" p(t) (two value-noise octaves, knots every 20 and 70 game hours, Catmull-Rom): high =
//             settled (anticyclone: clear / fair-weather cumulus, light winds, mist on autumn mornings, frost late in
//             term, the odd grey "anticyclonic gloom" day), low = cyclonic (fronts, rain, wind), between = showery westerlies
//   fronts    one candidate per 10-game-hour slot, likelier when p is low: high cloud thickening and lowering over
//             ~6 h, then 1.5–4.5 h of steady rain (lighter at first), a brief heavy burst at the cold front, the wind
//             veering and gusting, then clearing to showers and big cumulus for a few hours behind it
//   showers   one candidate per game hour, in showery and post-frontal air, likelier in the afternoon: 15–40 game
//             minutes, light to heavy; the heaviest early-season ones may thunder
//   fog       radiation fog / mist on calm, settled mornings (commoner in Oct–Nov), forming ~02:00–04:00, thickest by
//             the river and the meadows (the system scales it by place), burning off ~09:00–11:30
//   wind      a vector on knots every 3 game hours (linear between them, so its integral — the drift of clouds and of
//             thermals — is exact): the day's direction (prevailing south-westerly, as _glide_air always had), a speed
//             by regime, gusts at fronts, a veer behind them
//   temp      the season's normals, a diurnal swing damped by cloud, anomalies by regime, cooling in rain
// CONTINUITY (tools/smoke_weather_continuity.mjs): every number in a sample is a continuous function of time — no
// output steps when a front, a shower or a fog "begins", when midnight passes or when one rain source overtakes
// another (the kind of rain is a weighted mean of every source's, not the strongest one's). Only `name`, the label
// classify() derives for the HUD and for consumers that want a word, changes in steps.
// Output: sample(tMs) -> a reused object {cu, st, rain, ..., name}; see `blank()` for every field.

import { HOUR_MS, DAY_MS, MINUTE_MS } from '../core/time.js'; export { HOUR_MS, DAY_MS };
const TERM = 56, TAU = Math.PI * 2;

export const STATES = ['clear', 'cumulus', 'broken', 'overcast', 'drizzle', 'rain', 'shower', 'mist', 'fog', 'blustery', 'thunder', 'snow', 'frost'];
export const LABEL = {
  clear: 'clear', cumulus: 'fair-weather cumulus', broken: 'broken cloud', overcast: 'overcast', drizzle: 'drizzle', rain: 'rain',
  shower: 'heavy shower', mist: 'mist', fog: 'fog', blustery: 'blustery', thunder: 'thunder', snow: 'light snow', frost: 'frost',
};

/** deterministic hash of up to three ints -> [0, 1) (same mixer as _glide_air.hash3) */
export function hash3(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** a bump: 0 below a, up to 1 by b, holds to c, back to 0 by d */
const trap = (a, b, c, d, x) => sstep(a, b, x) * (1 - sstep(c, d, x));

/** game day index and hour of a shared-clock time */
export const dayOf = (tMs) => Math.floor(tMs / DAY_MS);
export const hourOf = (tMs) => ((tMs % DAY_MS) + DAY_MS) % DAY_MS / HOUR_MS;
/** the time the weather is read at: the shared clock's day with the (possibly ?time= pinned) hour */
export const compose = (nowMs, hour) => dayOf(nowMs) * DAY_MS + hour * HOUR_MS;

/** season 0 (early October) .. 1 (early December), smooth and cyclic over the 56-game-day term */
export function season(day) { return 0.5 - 0.5 * Math.cos((TAU * day) / TERM); }

/** smooth 1-D value noise: Catmull-Rom through hashed knots every `period` units (x in those units), -1..1 */
function vnoise(x, seed) {
  const i = Math.floor(x), f = x - i;
  const p0 = hash3(i - 1, seed) * 2 - 1, p1 = hash3(i, seed) * 2 - 1, p2 = hash3(i + 1, seed) * 2 - 1, p3 = hash3(i + 2, seed) * 2 - 1;
  const v = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  return clamp(v, -1, 1);
}

/** synoptic "pressure" -1 (deep low) .. 1 (strong high) at game-hour th (hours since the epoch) */
export function pressure(th) { return clamp(0.62 * vnoise(th / 20, 101) + 0.55 * vnoise(th / 70, 103) + 0.12, -1, 1); }
/** regime weights {S settled, M mixed / showery, C cyclonic} (sum 1) */
function regime(p, out) {
  out.S = sstep(0.02, 0.42, p); out.C = sstep(-0.12, -0.55, p); out.M = Math.max(0, 1 - out.S - out.C);
  return out;
}

// ------------------------------------------------------------------------------------------------ fronts
const FSLOT = 10;   // game hours
/** the front of slot k, or null: {tf (game h), lead, D (rain h), I (0..1 intensity), cold (burst), thunder} */
const _fronts = new Map();
function front(k) {
  let f = _fronts.get(k);
  if (f !== undefined) return f;
  const mid = (k + 0.5) * FSLOT, R = regime(pressure(mid), {});
  const pr = 0.035 + 0.45 * R.C + 0.1 * R.M;
  f = null;
  if (hash3(k, 201) < pr) {
    const s = season(Math.floor(mid / 24));
    f = { tf: k * FSLOT + FSLOT * hash3(k, 202), lead: 4.5 + 3 * hash3(k, 203), D: 1.5 + 3 * hash3(k, 204), I: 0.28 + 0.42 * hash3(k, 205), cold: 0.25 + 0.6 * hash3(k, 206) };
    f.thunder = hash3(k, 207) < 0.03 * (1 - 0.6 * s) ? 1 : 0;
  }
  if (_fronts.size > 400) _fronts.clear();
  _fronts.set(k, f);
  return f;
}

// ------------------------------------------------------------------------------------------------ showers
/** the shower of game-hour slot j, or null: {t0, t1 (game h), I peak, thunder} */
const _showers = new Map();
function shower(j) {
  let s = _showers.get(j);
  if (s !== undefined) return s;
  s = null;
  const mid = j + 0.5, R = regime(pressure(mid), {}), hr = ((mid % 24) + 24) % 24, sea = season(Math.floor(mid / 24));
  // convective: afternoon peak, some at night in unsettled air; post-frontal air is the showeriest
  const diur = 0.45 + 0.9 * trap(10, 13, 17, 20, hr);
  let post = 0;
  for (let k = Math.floor((mid - 12) / FSLOT); k <= Math.floor(mid / FSLOT); k++) { const f = front(k); if (f) { const rel = mid - f.tf; post = Math.max(post, trap(f.D + 0.6, f.D + 1.6, f.D + 4, f.D + 9, rel)); } }
  const p = (R.M * 0.05 + R.C * 0.02 + post * 0.25) * diur * (1 - 0.25 * sea);
  if (hash3(j, 301) < p) {
    const a = hash3(j, 302), d = 0.25 + 0.42 * hash3(j, 303), I = 0.25 + 0.75 * Math.pow(hash3(j, 304), 1.6);
    s = { t0: j + a * 0.7, t1: j + a * 0.7 + d, I, thunder: I > 0.85 && hash3(j, 305) < 0.2 * (1 - 0.7 * sea) ? 1 : 0 };
  }
  if (_showers.size > 400) _showers.clear();
  _showers.set(j, s);
  return s;
}

// ------------------------------------------------------------------------------------------------ fog
/** the fog of game day d's morning: {on 0/1, thick 0..1, t0 (onset h), t1 (burn-off start h), lift (stratus after)} */
const _fogs = new Map();
function fogDay(d) {
  let f = _fogs.get(d);
  if (f !== undefined) return f;
  const th = d * 24 + 4, R = regime(pressure(th), {}), sea = season(d);
  // radiation fog needs a calm clear night: settled air; Oct–Nov are the foggy months
  const pr = (0.05 + 0.55 * R.S) * (0.75 + 0.45 * Math.sin(Math.PI * clamp(sea * 1.3, 0, 1)));
  f = { on: hash3(d, 401) < pr ? 1 : 0, thick: hash3(d, 402), t0: 1.2 + 2.6 * hash3(d, 403), t1: 8.6 + 1.3 * hash3(d, 404) + 0.9 * sea, lift: hash3(d, 405) < 0.35 ? 1 : 0 };
  if (_fogs.size > 200) _fogs.clear();
  _fogs.set(d, f);
  return f;
}

// ------------------------------------------------------------------------------------------------ wind
const KNOT = 3 * HOUR_MS;
/** the day's base wind: direction FROM (deg), as _glide_air.dayWeather always had it (prevailing south-westerly) */
function dayWind(day) {
  const h1 = hash3(day, 11), h2 = hash3(day, 23), h3 = hash3(day, 37);
  return { fromDeg: h1 < 0.75 ? 160 + h2 * 130 : h2 * 360, h3 };
}
const _knots = new Map();
/** wind at knot k (real time k * 3 game hours): [vx, vz] m/s at 300 m, the way the air moves (world x east, z south) */
function knot(k) {
  let v = _knots.get(k);
  if (v) return v;
  const tMs = k * KNOT, th = tMs / HOUR_MS, day = Math.floor(th / 24), W = dayWind(day), R = regime(pressure(th), {});
  let gust = 0, veer = 0;
  for (let j = Math.floor((th - 16) / FSLOT); j <= Math.floor((th + 8) / FSLOT); j++) {
    const f = front(j); if (!f) continue;
    const rel = th - f.tf;
    gust = Math.max(gust, Math.exp(-(((rel - f.D) / 2.2) ** 2)) * (0.6 + f.cold), 0.5 * trap(-3, -1, f.D, f.D + 4, rel));
    veer = Math.max(veer, sstep(f.D - 0.5, f.D + 1.5, rel) * (1 - sstep(f.D + 6, f.D + 14, rel)));
  }
  const speed = lerp(lerp(2.2 + 4.2 * W.h3, 1.3 + 2.6 * W.h3, R.S), 5.5 + 5 * W.h3, R.C) + 4.5 * gust + 0.8 * vnoise(th / 5, 501);
  const fromDeg = W.fromDeg + 32 * veer + 10 * vnoise(th / 7, 503);
  const dir = (fromDeg * Math.PI) / 180 + Math.PI;                 // blows TO; bearing b -> world (sin b, -cos b)
  v = [Math.sin(dir) * Math.max(0.6, speed), -Math.cos(dir) * Math.max(0.6, speed)];
  if (_knots.size > 3000) _knots.clear();
  _knots.set(k, v);
  return v;
}
/** wind (m/s at 300 m) at shared-clock time tMs -> out [vx, vz] */
export function windAt(tMs, out = [0, 0]) {
  const k = Math.floor(tMs / KNOT), f = tMs / KNOT - k, a = knot(k), b = knot(k + 1);
  out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f;
  return out;
}
// the integral of the wind (m) from the start of a 32-game-day block: prefix sums per block, built once
const BLOCK = 32 * 8, _blocks = new Map();
function blockSums(b) {
  let s = _blocks.get(b);
  if (s) return s;
  s = new Float64Array((BLOCK + 1) * 2);
  const dt = KNOT / 1000;
  for (let i = 0; i < BLOCK; i++) { const a = knot(b * BLOCK + i), c = knot(b * BLOCK + i + 1); s[(i + 1) * 2] = s[i * 2] + (a[0] + c[0]) * 0.5 * dt; s[(i + 1) * 2 + 1] = s[i * 2 + 1] + (a[1] + c[1]) * 0.5 * dt; }
  if (_blocks.size > 6) _blocks.clear();
  _blocks.set(b, s);
  return s;
}
/** the distance (m) the air at 300 m has moved since the start of its block -> out [x, z, block]; exact for the piecewise-linear wind */
export function drift(tMs, out = [0, 0, 0]) {
  const kAll = tMs / KNOT, k = Math.floor(kAll), b = Math.floor(k / BLOCK), i = k - b * BLOCK, f = kAll - k, s = blockSums(b);
  const a = knot(k), c = knot(k + 1), dt = KNOT / 1000;
  // ∫ over the part of the knot interval: a f + (c - a) f² / 2
  out[0] = s[i * 2] + (a[0] * f + (c[0] - a[0]) * f * f * 0.5) * dt;
  out[1] = s[i * 2 + 1] + (a[1] * f + (c[1] - a[1]) * f * f * 0.5) * dt;
  out[2] = b;
  return out;
}
/** displacement (m) of the air between t0 and t1 -> out [dx, dz] (thermals drifting with the wind) */
export function driftBetween(t0Ms, t1Ms, out = [0, 0]) {
  const A = drift(t0Ms, _dA), B = drift(t1Ms, _dB);
  if (A[2] === B[2]) { out[0] = B[0] - A[0]; out[1] = B[1] - A[1]; return out; }
  // across a block boundary (once every ~13 real hours): integrate the knots directly
  out[0] = 0; out[1] = 0;
  const w = _wA; let t = t0Ms;
  while (t < t1Ms) { const n = Math.min(t1Ms, (Math.floor(t / KNOT) + 1) * KNOT); windAt((t + n) * 0.5, w); out[0] += w[0] * (n - t) / 1000; out[1] += w[1] * (n - t) / 1000; t = n; }
  return out;
}
const _dA = [0, 0, 0], _dB = [0, 0, 0], _wA = [0, 0];

// ------------------------------------------------------------------------------------------------ the sample
/** thermal strength by game hour (as _glide_air.diurnal) */
export function diurnal(hour) { return sstep(9.8, 13, hour) * (1 - sstep(16, 19.5, hour)); }
/** convective cumulus base (m) for an hour and sunshine 0..1 (as _glide_air.cloudBase; UK summer ~900–1500 m) */
export function convBase(hour, sky) { return 1100 * (0.8 + 0.25 * sky) + 450 * diurnal(hour); }

export function blank() {
  return {
    t: 0, day: 0, hour: 0, season: 0, p: 0, S: 0, M: 0, C: 0,
    cu: 0,         // cumulus layer amount 0..1 (fraction of sky)
    cuBase: 1100,  // its base (m)
    st: 0,         // stratiform deck opacity 0..1 (altostratus .. overcast)
    stBase: 3000,  // deck base (m)
    rain: 0,       // precipitation intensity 0..1 (0.08 drizzle, 0.3 light rain, 0.6 moderate, 1 heavy)
    drizzle: 0,    // 0..1 how much of it is drizzle (fine drops)
    shower: 0,     // 0..1 how much of it is a convective shower
    drop: 1,       // drop size (mm): ~0.4 drizzle, ~1.3 steady rain, 2.5+ a heavy shower (defined when dry too)
    showery: 0,    // 0..1 showers about (now, lately or soon): rain shafts under the cumulus in the distance
    dark: 0,       // storm darkness of the cloud 0..1
    fog: 0,        // radiation fog 0..1 (0.3 mist, 0.7+ fog) — before the system scales it by place
    thunder: 0,    // thunder activity 0..1
    snow: 0,       // fraction of the precipitation falling as snow
    frost: 0,      // ground frost 0..1
    windX: 0, windZ: 0, wind: 0, dir: 0, fromDeg: 0, gust: 0,   // wind at 300 m (m/s), dir = the way it blows (rad)
    surface: 0,    // wind speed near the ground (m/s)
    tempC: 10,
    cover: 0,      // total cloud cover 0..1
    sky: 1,        // sunshine reaching the ground 0..1 (thermal strength factor)
    name: 'clear',
  };
}

const _R = {}, _w = [0, 0];
/**
 * The weather at shared-clock time tMs (use compose(now, hour) for a pinned hour) -> out (reused).
 * opts.noFog / noRain skip the parts nobody needs (the wetness history only needs the rain).
 */
export function sample(tMs, out = blank()) {
  const th = tMs / HOUR_MS, day = Math.floor(th / 24), hr = th - day * 24, sea = season(th / 24);   // (a fractional day: the season never steps)
  const p = pressure(th), R = regime(p, _R);
  out.t = tMs; out.day = day; out.hour = hr; out.season = sea; out.p = p; out.S = R.S; out.M = R.M; out.C = R.C;
  const cuD = trap(9.3, 12.5, 16.3, 19.2, hr);              // fair-weather cumulus grow through the late morning, flatten out by evening
  const nA = 0.5 + 0.5 * vnoise(th / 4.5, 601), nB = 0.5 + 0.5 * vnoise(th / 11, 603), nG = 0.5 + 0.5 * vnoise(th / 16, 605);
  // ---- base cloud by regime
  let cu = R.S * cuD * 0.45 * sstep(0.3, 0.9, nA) + R.M * (0.18 + 0.32 * nA + 0.25 * cuD) + R.C * (0.15 + 0.15 * nA);
  cu *= 1 - 0.25 * sea;
  let st = R.M * 0.6 * sstep(0.5, 0.85, nB) + R.C * (0.45 + 0.5 * nB);
  let stBase = lerp(2600, 1300, nB);
  // anticyclonic gloom: a grey, dry stratocumulus sheet on some settled days (commoner late in term)
  const gloom = R.S * sstep(0.55, 0.78, nG) * (0.65 + 0.35 * sea);
  st = Math.max(st, gloom * 0.95); if (gloom > 0.3) stBase = lerp(stBase, 750 + 250 * nA, sstep(0.3, 0.7, gloom));
  let rain = 0.1 * sstep(0.9, 1, nG) * gloom * sstep(0.88, 1, nB), dark = 0, thunder = 0;
  // the kind of rain (fine or coarse, frontal or convective): the mean over every source, weighted by its intensity
  // cubed — so the heaviest source decides, and nothing steps when another overtakes it
  let kW = rain * rain * rain, kDz = kW, kSh = 0, showery = 0;
  let gust = 0, post = 0, tAnom = 0;
  // ---- fronts
  // (every front whose influence reaches th: the deck starts <= 7.5 h before it, the cooling behind ends <= 24.5 h after)
  for (let k = Math.floor((th - 26) / FSLOT); k <= Math.floor((th + 9) / FSLOT); k++) {
    const f = front(k); if (!f) continue;
    const rel = th - f.tf, D = f.D;
    const deck = sstep(-f.lead, -f.lead * 0.3, rel) * (1 - sstep(D + 0.2, D + 1.8, rel));
    if (deck > 0) {
      st = Math.max(st, deck);
      // the deck lowers as the front comes: cirrostratus/altostratus at 4–5 km, nimbostratus ~500 m in the rain
      const b = lerp(4600, 520, sstep(-f.lead, 0, rel));
      stBase = lerp(stBase, b, sstep(0, 0.6, deck));
    }
    let r = f.I * sstep(-1.3, 0.2, rel) * (1 - sstep(D - 0.35, D + 0.12, rel)) * lerp(0.45, 1, sstep(-1, 0.8, rel));
    const burst = f.I * f.cold * 1.1 * Math.exp(-(((rel - D + 0.3) / 0.22) ** 2));
    { const rb = r + burst, w = rb * rb * rb; if (rb > rain) rain = rb; kW += w; kDz += w * lerp(0.6, 0.15, sstep(-0.6, 0.6, rel)); kSh += w * burst / Math.max(0.01, rb); }
    dark = Math.max(dark, 0.5 * r + 0.8 * burst);
    thunder = Math.max(thunder, f.thunder * sstep(0.15, 0.5, burst));
    gust = Math.max(gust, Math.exp(-(((rel - D) / 2.2) ** 2)) * (0.6 + f.cold));
    const pf = trap(D, D + 1, D + 4, D + 9, rel);
    post = Math.max(post, pf);
    tAnom += 1.4 * trap(-2, 0, D - 0.5, D + 0.5, rel) - 1.8 * sstep(D, D + 2, rel) * (1 - sstep(D + 8, D + 20, rel));
  }
  cu = Math.max(cu, post * (0.3 + 0.3 * cuD + 0.15 * nA));
  st *= 1 - 0.6 * sstep(0.5, 1, post);
  // ---- fog: today's morning (and the evening mist before it); a foggy morning is stable air — no showers in it
  let fogRaw = 0;
  const calm = 1 - sstep(4, 8, lerp(2, 9, R.C));
  {
    const f = fogDay(day), fn = fogDay(day + 1);
    if (f.on) {
      // from midnight the evening's mist (below) lies there; the fog thickens from t0 and burns off from t1
      const amt = lerp(0.3, 1, f.thick), off = 1 - sstep(f.t1, f.t1 + 1.6, hr);
      fogRaw = Math.max(amt * sstep(f.t0, f.t0 + 1.6, hr), 0.22 * amt) * off;
      if (f.lift && f.thick > 0.5) { const lf = trap(f.t1 + 0.5, f.t1 + 1.6, f.t1 + 3, f.t1 + 4.5, hr); st = Math.max(st, 0.9 * lf); stBase = lerp(stBase, Math.min(stBase, 350 + 300 * sstep(f.t1, f.t1 + 4, hr)), sstep(0, 0.4, lf)); }
    }
    if (fn.on) fogRaw = Math.max(fogRaw, 0.22 * lerp(0.3, 1, fn.thick) * sstep(20.5, 23.5, hr));
    fogRaw *= calm;
  }
  // ---- showers
  const noShw = 1 - sstep(0.03, 0.25, fogRaw);
  for (let j = Math.floor(th - 1.8); j <= Math.floor(th + 0.5); j++) {
    const s = shower(j); if (!s) continue;
    const env = trap(s.t0 - 0.45, s.t0, s.t1, s.t1 + 0.35, th) * noShw;   // the cloud builds before the rain and leaves after it
    if (env <= 0) continue;
    const rr = noShw * s.I * trap(s.t0, s.t0 + 0.2, s.t1 - 0.12, s.t1 + 0.06, th) * (0.75 + 0.25 * Math.sin(Math.PI * clamp((th - s.t0) / (s.t1 - s.t0), 0, 1)));
    cu += env * (0.25 + 0.3 * s.I); st = Math.max(st, env * 0.35 * s.I);
    dark = Math.max(dark, env * (0.2 + 0.7 * s.I));
    { const w = rr * rr * rr; if (rr > rain) rain = rr; kW += w; kSh += w; }
    thunder = Math.max(thunder, s.thunder * env);
  }
  // showers about: this hour's, the last two hours' and the next's (their rain shafts hang under the cumulus), and the
  // showery air behind a front
  for (let j = Math.floor(th - 3.0); j <= Math.floor(th + 1.6); j++) { const s = shower(j); if (s) showery = Math.max(showery, noShw * (0.45 + 0.55 * s.I) * trap(s.t0 - 1.3, s.t0 - 0.4, s.t1 + 0.4, s.t1 + 1.6, th)); }
  showery = Math.max(showery, 0.5 * post * noShw);
  let drizzle = (kDz + 2.5e-7) / (kW + 5e-7), shw = kSh / (kW + 5e-7);
  // special mornings and evenings: May Morning dawn (game day mod 7 == 2, 04:30–09:00) and the South Park fireworks
  // (day mod 7 == 5, 19:00–02:30) are kept dry — the crowds came for them
  const dm = ((day % 7) + 7) % 7;
  if (dm === 2) { const k = trap(3.8, 4.5, 9, 9.6, hr); rain *= 1 - k; dark *= 1 - k; thunder *= 1 - k; }
  { const ev = dm === 5 ? sstep(18.5, 19.2, hr) : dm === 6 ? 1 - sstep(2.3, 3.0, hr) : 0; rain *= 1 - 0.85 * ev; thunder *= 1 - ev; }
  const fog = fogRaw * (1 - sstep(0.02, 0.4, rain));
  cu *= 1 - sstep(0.3, 0.8, fog);
  // ---- wind
  windAt(tMs, _w);
  out.windX = _w[0]; out.windZ = _w[1];
  const ws = Math.hypot(_w[0], _w[1]);
  out.wind = ws; out.dir = Math.atan2(_w[0], -_w[1]);
  out.fromDeg = ((((out.dir - Math.PI) * 180) / Math.PI) % 360 + 360) % 360;
  out.gust = clamp(gust * 0.8 + sstep(6, 11, ws) * 0.6, 0, 1);
  out.surface = ws * 0.55 * (1 + 0.25 * out.gust);
  // ---- temperature
  const tmax = lerp(15.1, 8.0, sea), tmin = lerp(8.0, 2.4, sea), mean = (tmax + tmin) / 2;
  const opac = clamp(Math.max(st, cu * 0.55), 0, 1);
  const dshape = hr >= 6.5 && hr < 14.5 ? 0.5 - 0.5 * Math.cos((Math.PI * (hr - 6.5)) / 8) : 0.5 + 0.5 * Math.cos((Math.PI * (((hr - 14.5) + 24) % 24)) / 16);
  const amp = (tmax - tmin) * (1.15 - 0.65 * opac);
  const clearNight = (1 - opac) * (1 - dshape);
  let tc = mean + amp * (dshape - 0.5) + 2.2 * vnoise(th / 30, 701) + 0.9 * R.C - 1.0 * R.S * sea * clearNight - 0.8 * clearNight * sea + tAnom - 1.2 * sstep(0.05, 0.5, rain);
  out.tempC = tc;
  out.frost = sstep(1.2, -0.8, tc) * (1 - sstep(0.1, 0.3, rain)) * trap(-1, 1, 9.0, 10.5, hr);
  out.snow = sstep(1.0, -0.3, tc);     // (the share of whatever falls that falls as snow: defined when dry too)
  // ---- assemble
  cu = clamp(cu, 0, 0.92); st = clamp(st, 0, 1); rain = clamp(rain, 0, 1); dark = clamp(dark + 0.25 * st * sstep(0.1, 0.5, rain), 0, 1);
  const sky = (1 - 0.92 * st) * (1 - sstep(0.03, 0.18, rain)) * (1 - 0.8 * fog) * (1 - 0.35 * sstep(0.6, 0.9, cu));
  out.cu = cu; out.st = st; out.stBase = stBase; out.rain = rain; out.drizzle = clamp(drizzle + 0.6 * (1 - sstep(0.07, 0.17, rain)), 0, 1); out.shower = clamp(shw, 0, 1);
  out.drop = 0.35 + 0.95 * (1 - out.drizzle) + 1.3 * out.shower * sstep(0.2, 0.9, rain); out.showery = clamp(showery, 0, 1);
  out.dark = dark; out.fog = clamp(fog, 0, 1); out.thunder = clamp(thunder, 0, 1);
  out.sky = clamp(sky, 0, 1);
  out.cover = clamp(1 - (1 - cu) * (1 - st), 0, 1);
  // cumulus base: the convective formula, lower late in term; ragged scud low under rain
  out.cuBase = lerp(convBase(hr, out.sky) * (1 - 0.18 * sea), 420 + 200 * nA, sstep(0.1, 0.5, rain + 0.5 * dark));
  out.stBase = lerp(out.stBase, Math.min(out.stBase, lerp(1400, 480, sstep(0.1, 0.6, rain))), sstep(0.03, 0.3, rain));
  out.name = classify(out);
  return out;
}

/** the state name for a sample (priority order: the most striking thing about it) */
export function classify(s) {
  if (s.thunder > 0.45 && s.rain > 0.2) return 'thunder';
  if (s.rain > 0.05 && s.snow > 0.5) return 'snow';
  if (s.shower > 0.5 && s.rain > 0.5) return 'shower';
  if (s.rain >= 0.18) return 'rain';
  if (s.rain >= 0.03) return 'drizzle';
  if (s.fog >= 0.62) return 'fog';
  if (s.fog >= 0.28) return 'mist';
  if (s.frost > 0.5 && s.st < 0.6) return 'frost';
  if (s.wind > 9.5 && s.surface > 5.8) return 'blustery';
  if (s.st >= 0.65 || s.cover >= 0.86) return 'overcast';
  if (s.cover >= 0.55) return 'broken';
  if (s.cu >= 0.1) return 'cumulus';
  return 'clear';
}

/** rain intensity at the 0.2-game-hour grid point k (cached: the wetness history costs one sample per 0.2 game hours) */
const _rs = blank(), _rg = new Map(), WSTEP = 0.2 * HOUR_MS;
function rainGrid(k) {
  let r = _rg.get(k);
  if (r === undefined) { r = sample(k * WSTEP, _rs).rain; if (_rg.size > 3000) _rg.clear(); _rg.set(k, r); }
  return r;
}
export function rainAt(tMs) { return sample(tMs, _rs).rain; }
/**
 * How wet the streets are at tMs, 0..1: the rain now and on the 0.2-game-hour grid over the last ~3 game hours,
 * drying out over ~1.3 h (slower in the cold and at night), plus a little dampness from fog and frost. Pure.
 */
export function wetness(tMs, now = null) {
  const s = now || sample(tMs, blank());
  const dryT = 1.1 + 0.6 * s.season + 0.6 * (1 - trap(6.5, 7.5, 18.5, 19.5, s.hour));
  const f = (r) => Math.min(1, r * 3.2 + 0.25 * sstep(0, 0.08, r));
  let w = f(s.rain);
  const g = Math.floor(tMs / WSTEP);
  for (let k = 0; k <= 14; k++) {
    const r = rainGrid(g - k); if (r <= 0) continue;
    const dtH = (tMs - (g - k) * WSTEP) / HOUR_MS;
    w = Math.max(w, f(r) * Math.exp(-dtH / dryT) * (1 - sstep(2.3, 2.8, dtH)));     // (tapered: the oldest sample fades out, it does not drop out)
  }
  return clamp(Math.max(w, 0.3 * s.fog, 0.25 * s.frost), 0, 1);
}
/**
 * The water standing in the puddles at tMs, 0..1: the rain of the last ~8 game hours added up (the 0.2-game-hour grid;
 * the current interval counts by the part of it that has passed), draining and evaporating over ~2.5 h — so puddles
 * fill as the rain goes on, outlast the wet sheen on the road by hours and shrink slowly. Pure and continuous.
 */
export function puddles(tMs, season = 0.5) {
  const g = Math.floor(tMs / WSTEP), tau = 2.2 + 0.9 * season;
  let sum = 0;
  for (let k = 0; k <= 40; k++) {
    const r = rainGrid(g - k); if (r <= 0) continue;
    const dtH = (tMs - (g - k) * WSTEP) / HOUR_MS;
    sum += r * 0.2 * (k === 0 ? dtH / 0.2 : 1) * Math.exp(-dtH / tau) * (1 - sstep(7.2, 8.0, dtH));
  }
  return 1 - Math.exp(-4.5 * sum);
}
/**
 * The rainbow's chance at tMs, 0..1: rain that was falling a quarter of a game hour ago and has moved off, with the sun
 * out now (the sky draws the bow opposite the sun, only while the sun is under 42 degrees). Pure and continuous.
 */
export function bowAt(tMs, now = null) {
  const s = now || sample(tMs, blank());
  const was = Math.max(sample(tMs - 0.14 * HOUR_MS, _rs).rain, sample(tMs - 0.3 * HOUR_MS, _rs).rain);
  return sstep(0.12, 0.45, was) * (1 - sstep(0.02, 0.2, s.rain)) * sstep(0.3, 0.7, s.sky) * (1 - s.fog);
}

// ------------------------------------------------------------------------------------------------ presets (force)
/** a forced state as a target sample (merged over the natural one by the system; see systems/weather.js) */
export const PRESETS = {
  clear: { cu: 0, st: 0, rain: 0, fog: 0, dark: 0, thunder: 0, snow: 0, frost: 0 },
  cumulus: { cu: 0.32, st: 0, rain: 0, fog: 0, dark: 0, thunder: 0, snow: 0, frost: 0 },
  broken: { cu: 0.62, st: 0.25, stBase: 2800, rain: 0, fog: 0, dark: 0.05, thunder: 0, snow: 0, frost: 0 },
  overcast: { cu: 0.1, st: 0.97, stBase: 800, rain: 0, fog: 0, dark: 0.15, thunder: 0, snow: 0, frost: 0 },
  drizzle: { cu: 0.2, st: 1, stBase: 520, rain: 0.08, drizzle: 1, shower: 0, drop: 0.4, fog: 0.1, dark: 0.3, thunder: 0, snow: 0, frost: 0 },
  rain: { cu: 0.4, st: 1, stBase: 520, rain: 0.55, drizzle: 0, shower: 0, drop: 1.3, fog: 0, dark: 0.55, thunder: 0, snow: 0, frost: 0 },
  shower: { cu: 0.85, st: 0.75, stBase: 1800, rain: 1, drizzle: 0, shower: 1, showery: 1, drop: 2.6, fog: 0, dark: 0.85, thunder: 0, snow: 0, frost: 0 },
  thunder: { cu: 0.85, st: 0.7, stBase: 1500, rain: 0.9, drizzle: 0, shower: 1, showery: 1, drop: 2.6, fog: 0, dark: 0.95, thunder: 1, snow: 0, frost: 0 },
  mist: { cu: 0, st: 0.1, rain: 0, fog: 0.45, dark: 0, thunder: 0, snow: 0, frost: 0 },
  fog: { cu: 0, st: 0.2, rain: 0, fog: 0.9, dark: 0, thunder: 0, snow: 0, frost: 0 },
  blustery: { cu: 0.5, st: 0.1, rain: 0, fog: 0, dark: 0.05, thunder: 0, snow: 0, frost: 0, wind: 12, gust: 1 },
  snow: { cu: 0.2, st: 1, stBase: 700, rain: 0.35, drizzle: 0, shower: 0, fog: 0.1, dark: 0.25, thunder: 0, snow: 1, frost: 0.6, tempC: 0.5 },
  frost: { cu: 0, st: 0, rain: 0, fog: 0.15, dark: 0, thunder: 0, snow: 0, frost: 1, tempC: -1.5 },
};

/**
 * Statistics over a run of game days (tests, tuning): fractions of time per state (daylight hours 08–18 and all
 * hours), the share of days with measurable rain, frost and fog mornings.
 */
export function stats(day0, days, stepMin = 6) {
  const s = blank(), all = {}, light = {};
  for (const k of STATES) { all[k] = 0; light[k] = 0; }
  let nAll = 0, nLight = 0, rainDays = 0, fogDays = 0, frostDays = 0, thunderDays = 0, snowDays = 0, wetH = 0, tMin = 99, tMax = -99, tSum = 0;
  for (let d = day0; d < day0 + days; d++) {
    let mm = 0, fogM = 0, frostM = 0, th = 0, sn = 0;
    for (let m = 0; m < 1440; m += stepMin) {
      sample(d * DAY_MS + m * MINUTE_MS, s);   // m = game minutes into the day
      const h = m / 60;
      all[s.name]++; nAll++;
      if (h >= 8 && h < 18) { light[s.name]++; nLight++; }
      mm += s.rain * 4 * (stepMin / 60);        // ~4 mm/h at intensity 1 (heavy shower ~8+), drizzle ~0.3 mm/h
      if (s.rain > 0.03) wetH += stepMin / 60;
      if (h < 11 && s.fog > 0.28) fogM = 1;
      if (s.frost > 0.5) frostM = 1;
      if (s.name === 'thunder') th = 1;
      if (s.name === 'snow') sn = 1;
      tMin = Math.min(tMin, s.tempC); tMax = Math.max(tMax, s.tempC); tSum += s.tempC;
    }
    if (mm >= 1) rainDays++;
    fogDays += fogM; frostDays += frostM; thunderDays += th; snowDays += sn;
  }
  for (const k of STATES) { all[k] /= nAll; light[k] /= nLight; }
  return { all, light, rainDays: rainDays / days, fogDays: fogDays / days, frostDays: frostDays / days, thunderDays: thunderDays / days, snowDays: snowDays / days, wetFrac: wetH / (days * 24), tMin, tMax, tMean: tSum / nAll };
}
