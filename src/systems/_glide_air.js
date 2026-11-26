// The air over Oxford — pure and deterministic (no three.js, no Math.random): the same wind and the same thermals for
// every player, from the shared clock (game.time.now(), ms) and position alone. Two friends circle the same thermal.
//
//   weather   ONE source for everybody: _weather_model.js (pure, shared clock) gives the wind (a vector on 3-game-hour
//             knots: the day's prevailing direction, a speed by regime, gusts and a veer at fronts), the sunshine
//             reaching the ground (thermals weaken under overcast and stop in rain or fog) and the cloud base — the
//             same day the walkers see (systems/weather.js reads the same model)
//   wind      the model's wind, weaker near the ground (log profile), plus smooth gusts (a few incommensurate sines of
//             time and position)
//   thermals  one candidate per 640 m cell per "generation" (each cell's thermals live ~5–7 real minutes, staggered),
//             placed at the hottest of three hashed spots (dark roofs and car parks of the city centre beat parks and
//             meadows; water kills them), strength by the time of day (none before ~10:00 or after ~19:30, best
//             13:00–16:00) and by the sunshine now, with a sink ring round each core. The column drifts with the
//             integral of the wind (exact, so it does not jump when the wind changes), leans downwind with height and
//             stops at cloud base, where a cumulus sits on top of it.
//   sink      gentle general sink between thermals by day
//   roofs     Oxford is flat, so there is no ridge to soar — but the wind does have to climb over the town. Given a relief
//             grid (makeRelief: the smoothed height of the buildings, filled once by the game) the air follows it: rising
//             on the windward side of a big building or a block of roofs, sinking in its lee, by wind speed × the slope
//             of the relief along the wind, dying away over a few tens of metres above the roofs. It needs wind, not sun
//             (so it is there at night and in rain, when the thermals are not). No wave.
// All in metres, m/s, real seconds; hour = game hour 0..24.

import { sample as wxSample, blank as wxBlank, windAt, driftBetween, compose, hourOf, LABEL, diurnal as wxDiurnal, convBase } from './_weather_model.js';

import { DAY_MS } from '../core/time.js';
export const AIR = { cell: 640, life: 360, base: 1100 };
const TAU = Math.PI * 2;
export const ROOF = { cell: 12, reach: 18, gain: 0.85, clear: 3, scale: 24, top: 150, cap: 0.7 };

/**
 * A relief grid for roof lift over `bounds` {minX, maxX, minZ, maxZ}. fill(put) is called once: put(x, z, h) for every
 * sample point that is on a building h high (sample on a ~3 m lattice; each grid cell takes the MEAN height over its
 * area, so a terrace is a low plateau and a college range a ridge). The grid is then blurred twice (the air does not
 * turn square corners). -> {h(x, z) bilinear height, max}
 */
export function makeRelief(bounds, fill, sub = 3) {
  const C = ROOF.cell, x0 = Math.floor(bounds.minX / C) * C - 4 * C, z0 = Math.floor(bounds.minZ / C) * C - 4 * C;
  const nx = Math.ceil((bounds.maxX - x0) / C) + 5, nz = Math.ceil((bounds.maxZ - z0) / C) + 5;
  let H = new Float32Array(nx * nz), max = 0;
  const per = (C / sub) * (C / sub);                       // samples a full cell holds
  fill((x, z, h) => { const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C); if (i >= 0 && j >= 0 && i < nx && j < nz) H[j * nx + i] += h / per; });
  for (let pass = 0; pass < 2; pass++) {
    const B = new Float32Array(nx * nz);
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const o = j * nx + i;
      B[o] = (H[o] * 4 + (H[o - 1] + H[o + 1] + H[o - nx] + H[o + nx]) * 2 + H[o - nx - 1] + H[o - nx + 1] + H[o + nx - 1] + H[o + nx + 1]) / 16;
    }
    H = B;
  }
  for (let i = 0; i < H.length; i++) if (H[i] > max) max = H[i];
  const h = (x, z) => {
    const fx = (x - x0) / C - 0.5, fz = (z - z0) / C - 0.5, i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= nx - 1 || j >= nz - 1) return 0;
    const u = fx - i, v = fz - j, o = j * nx + i;
    return (H[o] * (1 - u) + H[o + 1] * u) * (1 - v) + (H[o + nx] * (1 - u) + H[o + nx + 1] * u) * v;
  };
  return { h, max, sub, cell: C };
}

/** deterministic hash of up to three ints -> [0, 1) */
export function hash3(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const sstep = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };

/**
 * The weather now from the shared clock (and the game hour, if pinned): {day, dir (rad, the way the wind blows TO),
 * speed (m/s at 300 m), from / fromDeg (where it comes from), sky 0 dull .. 1 sunny (sunshine reaching the ground:
 * thermal strength), base (cumulus base, m), state, name}. Same for every player.
 */
export function dayWeather(nowMs, hour = hourOf(nowMs), out = null) {
  const s = wxSample(compose(nowMs, hour), out && out._s ? out._s : wxBlank());
  const o = out || {};
  o._s = s; o.day = Math.floor(nowMs / DAY_MS);
  // the wind is read on the shared clock itself (its integral moves the thermals), the sky at the (pinned) hour
  const w = windAt(nowMs, o._w || (o._w = [0, 0]));
  o.speed = Math.hypot(w[0], w[1]); o.dir = Math.atan2(w[0], -w[1]); o.from = o.dir - Math.PI;
  o.fromDeg = (((o.from * 180) / Math.PI) % 360 + 360) % 360;
  o.sky = s.sky; o.base = s.cuBase; o.state = s.name; o.name = LABEL[s.name] || s.name; o.rain = s.rain;
  return o;
}

/** thermal strength factor by game hour: 0 before 10:00, peak 13:00–16:00, gone by 19:30 */
export const diurnal = wxDiurnal;

/** cloud base (m) for the hour/day: rises through the afternoon (UK summer ~900–1500 m) — the model's convective base */
export const cloudBase = convBase;

/**
 * Air: wind + thermals + sink. heat(x, z) -> 0..1.2 surface heating (supplied by the game: city roofs high, water 0).
 * air.at(x, y, z, tMs, hour, out[3]) writes the air velocity (m/s) at that point.
 */
export class Air {
  constructor(heat = () => 0.7) {
    this.heat = heat;
    this.relief = null;              // makeRelief(...) from the game: roof lift (none without it)
    this._cells = new Map();         // key -> {gen, th}
    this.weather = dayWeather(0, 12); this._wq = NaN; this._wh = NaN;
    this._drift = [0, 0];
    this.list = [];                  // thermals near the last query centre (for clouds / birds / tests): refreshed by near()
  }
  /** the weather (cached per 250 ms of shared clock and per hour value: a pure function of both) */
  _weather(tMs, hour) {
    const q = Math.floor(tMs / 250);
    if (q !== this._wq || hour !== this._wh) { this._wq = q; this._wh = hour; dayWeather(q * 250, hour, this.weather); }
    return this.weather;
  }
  /** the thermal of cell (i, j) at real time t (s), or null. Cached per generation. */
  thermal(i, j, tS, hour) {
    const L = AIR.life, ph = hash3(i, j, 5) * L, gen = Math.floor((tS + ph) / L);
    const k = (i + 4096) * 8192 + (j + 4096);
    let c = this._cells.get(k);
    if (!c || c.gen !== gen) {
      // pick the hottest of three hashed spots in the cell
      let bx = 0, bz = 0, bh = -1;
      for (let n = 0; n < 3; n++) {
        const x = (i + 0.12 + 0.76 * hash3(i, j, gen * 7 + n * 2 + 1)) * AIR.cell, z = (j + 0.12 + 0.76 * hash3(i, j, gen * 7 + n * 2 + 2)) * AIR.cell;
        const h = this.heat(x, z);
        if (h > bh) { bh = h; bx = x; bz = z; }
      }
      const r = hash3(i, j, gen * 13 + 9);
      const exists = r < 0.25 + 0.65 * Math.min(1, bh);       // hot ground almost always has one
      c = { gen, t0: gen * L - ph, x: bx, z: bz, heat: bh, R: 70 + 90 * hash3(i, j, gen * 3 + 4), W0: exists ? (1.2 + 2.6 * hash3(i, j, gen * 5 + 6)) * Math.min(1.15, bh) : 0, i, j };
      if (this._cells.size > 600) this._cells.clear();
      this._cells.set(k, c);
    }
    if (!c.W0) return null;
    const w = this._weather(tS * 1000, hour), age = (tS - c.t0) / AIR.life;          // 0..1 through its life
    const life = sstep(0, 0.15, age) * (1 - sstep(0.72, 1, age));
    const W = c.W0 * life * diurnal(hour) * w.sky;
    if (W < 0.004) return null;
    c.W = W; c.age = age;
    // the column drifts downwind with the air (so a glider circling in it, drifting too, stays in it — and the cumulus
    // on top drifts with it), from the spot where it broke away
    const d = driftBetween(c.t0 * 1000, tS * 1000, this._drift);
    c.dx = d[0]; c.dz = d[1];
    return c;
  }
  /**
   * Air velocity at (x, y, z): out = [wx, wy, wz]. tMs shared clock (ms), hour game hour.
   */
  at(x, y, z, tMs, hour, out) {
    const w = this._weather(tMs, hour), tS = tMs / 1000;
    // ---- wind: log profile from 0.3 m roughness, normalised at 300 m, a little stronger above
    const prof = y <= 0.5 ? 0.25 : Math.min(1.25, Math.max(0.25, Math.log((y + 0.5) / 0.3) / Math.log(300 / 0.3)));
    let ws = w.speed * prof;
    // gusts: smooth, deterministic, ±25 % plus a little direction wander; stronger low down (mechanical turbulence)
    const g1 = Math.sin(tS * 0.37 + x * 0.0041 + w.day) + 0.6 * Math.sin(tS * 0.91 + z * 0.0063 + w.day * 1.7) + 0.35 * Math.sin(tS * 2.3 + (x + z) * 0.011);
    ws *= 1 + 0.12 * g1 * (1 + 0.8 * (1 - prof));
    const dw = 0.08 * Math.sin(tS * 0.23 + w.day * 3.1) + 0.05 * Math.sin(tS * 0.71 + x * 0.002);
    const dir = w.dir + dw;
    // compass → world: a bearing b points (sin b, 0, −cos b)
    out[0] = Math.sin(dir) * ws; out[2] = -Math.cos(dir) * ws;
    // ---- vertical: thermals and general sink
    const hour01 = hour, dn = diurnal(hour01) * w.sky, cb = w.base;
    let vy = -0.35 * dn;
    if (dn > 0.01 && y < cb + 50) {
      const C = AIR.cell;
      // the column leans downwind: the core at height y has drifted by wind × y / (bubble rise ≈ 2.5 m/s)
      const lean = Math.min(400, y / 2.5);
      const ux = Math.sin(w.dir), uz = -Math.cos(w.dir), lx = ux * w.speed * lean * 0.6, lz = uz * w.speed * lean * 0.6;
      const vf = sstep(0, 90, y) * (1 - sstep(cb * 0.9, cb + 30, y));
      // a thermal seen here broke away from a source upwind: between (x, z) − lean and that minus a whole life of drift
      const D = w.speed * AIR.life, ax = x - lx, az = z - lz, bx = ax - ux * D, bz = az - uz * D;
      const i0 = Math.floor((Math.min(ax, bx) - 480) / C), i1 = Math.floor((Math.max(ax, bx) + 480) / C);
      const j0 = Math.floor((Math.min(az, bz) - 480) / C), j1 = Math.floor((Math.max(az, bz) + 480) / C);
      for (let cj = j0; cj <= j1; cj++) for (let ci = i0; ci <= i1; ci++) {
        // skip cells far from the swept segment (the box of a diagonal wind is mostly empty)
        const mx = (ci + 0.5) * C - ax, mz = (cj + 0.5) * C - az, t = Math.max(0, Math.min(D, -(mx * ux + mz * uz)));
        if (Math.hypot(mx + ux * t, mz + uz * t) > C * 0.75 + 480) continue;
        const T = this.thermal(ci, cj, tS, hour01); if (!T) continue;
        const dx = x - (T.x + T.dx + lx), dz = z - (T.z + T.dz + lz), R = T.R * (0.6 + 0.4 * sstep(0, 300, y)), u2 = (dx * dx + dz * dz) / (R * R);
        if (u2 > 9) continue;
        const u = Math.sqrt(u2), ring = (u - 1.7) / 0.45;
        vy += T.W * vf * (Math.exp(-u2 / 1.3) - 0.12 * Math.exp(-ring * ring)) + 0.35 * dn * sstep(0, 0.5, T.W) * Math.exp(-u2 * 0.5);   // core + ring sink; the general sink is cancelled near it (fading in and out with the thermal: no step as one is born or dies)
      }
    }
    // ---- roofs: the wind climbing over the town (see the header)
    const Rf = this.relief;
    if (Rf && y < ROOF.top && ws > 0.3) {
      const hx = Math.sin(dir), hz = -Math.cos(dir), d = ROOF.reach, here = Rf.h(x, z);
      const over = y - here - ROOF.clear;
      if (over < ROOF.scale * 5) {
        const slope = (Rf.h(x + hx * d, z + hz * d) - Rf.h(x - hx * d, z - hz * d)) / (2 * d);
        const lim = ROOF.cap * ws, wr = ROOF.gain * ws * slope * (over > 0 ? Math.exp(-over / ROOF.scale) : 1) * (1 - sstep(ROOF.top * 0.7, ROOF.top, y));
        vy += wr > lim ? lim : wr < -lim ? -lim : wr;
      }
    }
    out[1] = vy;
    return out;
  }
  /** thermals within r of (x, z) now: [{x, z, R, W, top}] — for the cumulus / bird dressing and the tests (reuses arrays) */
  near(x, z, r, tMs, hour, list = this.list) {
    list.length = 0;
    const w = this._weather(tMs, hour), tS = tMs / 1000, C = AIR.cell, n = Math.ceil(r / C);
    const ci = Math.floor(x / C), cj = Math.floor(z / C), cb = w.base;
    const lean = Math.min(400, cb / 2.5), lx = Math.sin(w.dir) * w.speed * lean * 0.6, lz = -Math.cos(w.dir) * w.speed * lean * 0.6;
    for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
      const T = this.thermal(ci + di, cj + dj, tS, hour); if (!T) continue;
      if (Math.hypot(T.x + T.dx - x, T.z + T.dz - z) > r) continue;
      list.push({ x: T.x + T.dx, z: T.z + T.dz, R: T.R, W: T.W, age: T.age, top: cb, cx: T.x + T.dx + lx, cz: T.z + T.dz + lz, id: (T.i + 4096) * 8192 + T.j + 4096 + T.gen * 1e8 });
    }
    return list;
  }
}
