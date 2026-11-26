// South Park fireworks night — pure rules (no DOM, no three): when it is on, the evening's programme, and the display
// itself as a list of shells. Everything is a function of the shared clock (game.time.now()) and the game day, so every
// player sees and hears the same show at the same moment. Tested by tools/smoke_southpark.mjs.
//
// THE CLOCK. The length of a game day is set in core/time.js, and the game has no
// calendar. The display is held on one game night in seven — game day mod 7 === WEEKDAY (the same day counter the
// friends' week uses: floor(now / DAY_MS)). The evening, in REAL seconds after the gates open at 19:30 game time
// (the start is on the game clock; the programme keeps its real length whatever the length of a game hour):
//
//     0 s   19:30  gates open, stewards out, funfair lit, the crowd starts to gather (full after ~40 s)
//    30 s          the bonfire is lit (takes ~12 s to catch)
//    45 s          the display: 360 real seconds (a real one runs 6-8 minutes; it is played in real time, not
//                  squeezed to the game clock — a good part of the game night —
//                  and anyone who sees the first bursts from Carfax has time to get there for the finale)
//   405 s          display over; the crowd drifts away, the fire burns down
//   465 s          funfair lights out
//   480 s          everything is gone again
import { DAY_MS, HOUR_MS, HOUR_S } from '../core/time.js'; export { DAY_MS, HOUR_MS };
export const WEEKDAY = 5;
export const T = { gatesHour: 19.5, bonfire: 30, display: 45, displayLen: 360, crowdGo: 410, fairOff: 465, end: 480 };
export const G = 9.8;

// particles: hard cap of the ring buffer / detail of a burst / crowd cut-outs / flash+smoke quads / smoke on every n-th shell / closest two booms / staff
export const TIER = {
  // (crowd, staff: WHO IS THERE — the same on every tier, systems/_busy.js; the rest is the detail of the fireworks)
  low: { cap: 1024, frac: 0.42, crowd: 800, puffs: 48, smokeEvery: 2, boomGap: 0.2, staff: 12 },
  medium: { cap: 2048, frac: 0.95, crowd: 800, puffs: 96, smokeEvery: 1, boomGap: 0.12, staff: 12 },
  high: { cap: 4096, frac: 1.5, crowd: 800, puffs: 128, smokeEvery: 1, boomGap: 0.08, staff: 12 },
};
export const FAR_FRAC = 0.4;      // detail of a burst for a viewer beyond the event's near range (only the display is drawn there)
export const LOOKAHEAD = 0.3;     // seconds before its launch that a shell's particles are written

// Where things are (world metres). The lower, western half of the park holds the fair, the fire and the crowd; the
// shells are fired from the fenced-off middle of the slope, ~150 m beyond the front of the crowd.
export const SITE = {
  park: 'w23945602',
  centre: [1905, 420],
  launch: [2215, 452], launchHalf: 26,        // mortar line runs north-south: launch[1] ± launchHalf
  bonfire: [1905, 452], bonfireR: 19,         // safety ring radius
  fair: [1748, 452],
  crowd: [[1928, 398], [2068, 398], [2068, 512], [1928, 512]],   // the main viewing field (faces east)
  gates: [[1676, 502, 2.5], [1739, 258, 0.62], [2462, 432, -2.68]],   // x, z, heading INTO the park (Morrell Ave, Headington Rd, Warneford Lane)
};

export const mod = (a, n) => ((a % n) + n) % n;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** deterministic rng (mulberry32) */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (a, b = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };

export function isFireworksDay(day) { return mod(day, 7) === WEEKDAY; }
/** "19:45": the game-clock time `sec` real seconds after the gates open (for notices) */
export const clockAt = (sec) => { const m = Math.round((T.gatesHour + sec / HOUR_S) * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
/** shared ms at which the gates open on game day `day` */
export function gatesMs(day) { return day * DAY_MS + T.gatesHour * HOUR_MS; }
/** the next fireworks day on or after `day` */
export function nextFireworksDay(day) { return day + mod(WEEKDAY - mod(day, 7), 7); }

/**
 * Where the evening stands at shared time nowMs -> out {day, today (is today a fireworks day), upcoming (gates still to
 * open today), active, t (seconds since the gates opened; -1 when not active), showDay}.
 * The evening runs past midnight, so yesterday's show is checked too.
 */
export function programme(nowMs, out = {}) {
  const d = Math.floor(nowMs / DAY_MS);
  out.day = d; out.today = isFireworksDay(d); out.active = false; out.t = -1; out.showDay = null;
  for (let c = d; c >= d - 1; c--) {
    if (!isFireworksDay(c)) continue;
    const t = (nowMs - gatesMs(c)) / 1000;
    if (t >= 0 && t < T.end) { out.active = true; out.t = t; out.showDay = c; break; }
  }
  out.upcoming = out.today && nowMs < gatesMs(d);
  return out;
}
/** what is going on t seconds after the gates opened -> out {crowd 0..1, fair 0|1, fire 0..1, tau (display seconds, may be <0 or >len), display bool, phase} */
export function levels(t, out = {}) {
  const on = t >= 0 && t < T.end;
  out.crowd = on ? smooth(0, 40, t) * (1 - 0.92 * smooth(T.crowdGo, T.end - 6, t)) : 0;
  out.fair = on && t < T.fairOff ? 1 : 0;
  out.fire = on ? smooth(T.bonfire, T.bonfire + 12, t) * (1 - 0.8 * smooth(T.display + T.displayLen, T.end, t)) : 0;
  out.tau = t - T.display;
  out.display = on && out.tau >= -1 && out.tau < T.displayLen + 8;
  out.phase = !on ? 'off' : t < T.bonfire ? 'gates' : t < T.display ? 'bonfire' : out.tau < T.displayLen ? 'display' : 'after';
  return out;
}

// ------------------------------------------------------------------------------------------------ the display
export const COLOURS = {
  red: [1.0, 0.16, 0.1], green: [0.2, 1.0, 0.32], blue: [0.28, 0.45, 1.0], gold: [1.0, 0.7, 0.24], silver: [0.92, 0.95, 1.0],
  purple: [0.74, 0.3, 1.0], orange: [1.0, 0.44, 0.1], pink: [1.0, 0.38, 0.68], cyan: [0.3, 0.92, 1.0], white: [1.0, 0.97, 0.9],
};
const BRIGHT = ['red', 'green', 'blue', 'purple', 'orange', 'pink', 'cyan', 'gold', 'silver'];
// type -> [particles at full detail, burst speed m/s (scaled by shell size), star life s, drag, gravity scale]
export const TYPES = {
  peony: { n: 84, v: 74, life: 2.2, k: 1.55, g: 0.4 },
  chrys: { n: 96, v: 78, life: 2.8, k: 1.3, g: 0.36 },
  ring: { n: 56, v: 70, life: 2.1, k: 1.6, g: 0.36 },
  willow: { n: 100, v: 46, life: 4.6, k: 0.85, g: 0.6 },
  crackle: { n: 96, v: 66, life: 2.4, k: 1.7, g: 0.4 },
  strobe: { n: 64, v: 44, life: 3.6, k: 1.9, g: 0.3 },
  palm: { n: 66, v: 72, life: 3.0, k: 1.1, g: 0.6 },
  comet: { n: 0, v: 0, life: 0, k: 0, g: 0 },          // a rising tail with no burst (ground fans)
};
export const RISE_K = 0.16;        // drag of a rising shell
/** position of a body launched at o with velocity v after tau seconds (drag k, gravity scale g) — the SAME closed form
 * the vertex shader uses (_sp_fx.js), so JS can place the burst where the shader draws the shell arriving */
export function posAt(ox, oy, oz, vx, vy, vz, k, g, tau, out) {
  const E = (1 - Math.exp(-k * tau)) / k;
  out[0] = ox + vx * E; out[1] = oy + vy * E - (G * g * (tau - E)) / k; out[2] = oz + vz * E;
  return out;
}
/** launch speed that carries a shell to height H after `rise` seconds */
export function riseSpeed(H, rise, k = RISE_K) { const E = (1 - Math.exp(-k * rise)) / k; return (H + (G * (rise - E)) / k) / E; }

/**
 * The display of game day `day`: shells sorted by launch time (seconds from the start of the display).
 * shell = {i, t0, rise, tb (burst time), lx, lz (launch point, world), vx, vy, vz, bx, by, bz (burst point), type,
 *          col [r,g,b], col2, size (0.6..1.6), seed, boom (0..1 loudness), whistle, ooh}
 * The programme is the same shape every week (opening salvo, colour, rings, willows, crackle, build, finale); the
 * choice of colours, positions and timing inside each act is drawn from the day.
 */
export function buildShow(day) {
  const R = rng((day * 7919 + 1013) >>> 0), shells = [];
  const pick = (arr) => arr[Math.floor(R() * arr.length) % arr.length];
  const P = [0, 0, 0];
  const add = (t0, type, o = {}) => {
    const size = o.size ?? 0.85 + R() * 0.5, rise = o.rise ?? 2.1 + R() * 0.9 + (size - 1) * 0.5;
    const H = o.h ?? (86 + R() * 84) * (0.75 + size * 0.3);
    const lx = SITE.launch[0] + (R() - 0.5) * 6, lz = SITE.launch[1] + (o.at ?? (R() * 2 - 1)) * SITE.launchHalf;
    const lean = o.lean ?? (R() - 0.5) * 0.62, leanX = (R() - 0.5) * 0.14;   // shells fan out along the line: bursts spread ~±70 m across the sky
    const vy = riseSpeed(H, rise), vz = vy * lean, vx = vy * leanX;
    posAt(lx, 0.6, lz, vx, vy, vz, RISE_K, 1, rise, P);
    const cn = o.col || pick(BRIGHT), c2 = o.col2 || (R() < 0.35 ? pick(BRIGHT) : cn);
    shells.push({ i: 0, t0, rise, tb: t0 + rise, lx, lz, vx, vy, vz, bx: P[0], by: P[1], bz: P[2], type, col: COLOURS[cn], col2: COLOURS[c2], colName: cn,
      size, seed: Math.floor(R() * 1e9), boom: type === 'comet' ? 0 : clamp(0.45 + (size - 0.8) * 0.7 + (type === 'willow' ? 0.15 : 0), 0.3, 1), whistle: !!o.whistle, ooh: !!o.ooh });
  };
  // 1. opening salvo (0-12 s): five big shells walking down the line, then a pair
  for (let j = 0; j < 5; j++) add(0.4 + j * 1.15, j % 2 ? 'peony' : 'chrys', { size: 1.25, at: -0.8 + j * 0.4, col: ['gold', 'red', 'silver', 'green', 'gold'][j], ooh: j === 4 });
  add(7.6, 'crackle', { size: 1.35, at: -0.3, col: 'gold' }); add(7.9, 'crackle', { size: 1.35, at: 0.3, col: 'silver', ooh: true });
  // 2. colour (12-70 s): peonies and chrysanthemums
  for (let t = 12; t < 70; t += 1.25 + R() * 0.9) { add(t, R() < 0.55 ? 'peony' : 'chrys', { whistle: R() < 0.12 }); if (R() < 0.22) add(t + 0.25, 'peony', { size: 0.75, h: 62 + R() * 20 }); }
  // 3. rings and palms (70-130 s), comet fans from the ground between them
  for (let t = 70; t < 130; t += 1.2 + R() * 0.8) {
    const r = R();
    add(t, r < 0.5 ? 'ring' : r < 0.8 ? 'palm' : 'peony', { ooh: R() < 0.1 });
    if (r < 0.5 && R() < 0.5) add(t + 0.05, 'ring', { size: 0.7 });
  }
  for (const t of [78, 96, 114]) for (let j = 0; j < 7; j++) add(t + j * 0.09, 'comet', { at: -0.9 + j * 0.3, lean: (j - 3) * 0.085, h: 46, rise: 1.9, col: 'gold' });
  // 4. willows (130-190 s): slow, gold, drooping almost to the trees
  for (let t = 130; t < 190; t += 1.9 + R() * 0.9) { add(t, 'willow', { col: R() < 0.75 ? 'gold' : 'silver', size: 1.1 + R() * 0.4, h: 120 + R() * 40, ooh: R() < 0.3 }); if (R() < 0.3) add(t + 0.6, 'strobe', { col: 'silver', size: 0.9 }); }
  // 5. crackle and strobe (190-250 s)
  for (let t = 190; t < 250; t += 1.05 + R() * 0.7) add(t, R() < 0.62 ? 'crackle' : R() < 0.5 ? 'strobe' : 'peony', { whistle: R() < 0.18 });
  for (const t of [205, 232]) for (let j = 0; j < 7; j++) add(t + j * 0.09, 'comet', { at: 0.9 - j * 0.3, lean: (3 - j) * 0.085, h: 50, rise: 2.0, col: 'silver' });
  // 6. the build (250-320 s): everything, faster and faster
  for (let t = 250; t < 320;) { add(t, pick(['peony', 'chrys', 'ring', 'palm', 'crackle', 'willow', 'peony', 'chrys']), { ooh: R() < 0.06 }); t += 1.15 - 0.5 * ((t - 250) / 70) + R() * 0.45; }
  // 7. the finale (320-352 s): a barrage, low colour under high gold and silver, then three enormous willows
  for (let t = 320; t < 351.5;) {
    const hi = R() < 0.45;
    add(t, hi ? pick(['chrys', 'crackle', 'willow']) : pick(['peony', 'peony', 'ring', 'strobe']), { size: hi ? 1.2 + R() * 0.3 : 0.7 + R() * 0.3, h: hi ? 125 + R() * 45 : 55 + R() * 35, col: hi ? pick(['gold', 'silver', 'gold', 'white']) : undefined, rise: hi ? 2.6 : 1.7 });
    t += 0.2 + R() * 0.16;
  }
  for (let j = 0; j < 3; j++) add(350.6 + j * 0.5, 'willow', { size: 1.6, h: 165, at: -0.7 + j * 0.7, col: 'gold', rise: 3.0, ooh: j === 2 });
  shells.sort((a, b) => a.t0 - b.t0);
  shells.forEach((s, i) => { s.i = i; });
  return shells;
}

/** particles a shell writes at detail `frac`: part 0 = the rising head + tail (written at launch), part 1 = the stars
 * (+ crackle; written when it bursts), null = both — see emitShell */
export function shellCount(s, frac, part = null) {
  const T_ = TYPES[s.type], tail = Math.max(2, Math.round((s.type === 'comet' ? 9 : 6) * Math.max(frac, 0.4)));
  const rise = 1 + tail;
  if (s.type === 'comet') return part === 1 ? 0 : rise;
  const stars = Math.max(10, Math.round(T_.n * frac * (0.75 + 0.25 * s.size))), st = starLayout(s.type, stars).total;
  return part === 0 ? rise : part === 1 ? st : rise + st;
}
function starLayout(type, stars) {
  if (type === 'chrys') { const rays = Math.max(6, Math.round(stars / 3)); return { rays, sub: 3, extra: 0, total: rays * 3 }; }
  if (type === 'palm') { const rays = clamp(Math.round(stars / 7), 5, 10); return { rays, sub: 7, extra: 0, total: rays * 7 }; }
  if (type === 'crackle') { const rays = Math.round(stars * 0.6), extra = stars - rays; return { rays, sub: 1, extra, total: stars }; }
  return { rays: stars, sub: 1, extra: 0, total: stars };
}
// star kinds understood by the shader (aMisc.y): 0 steady fade, 1 twinkles late (crackle), 2 strobe, 3 glitter (willow), 4 tail (quick fade), 5 head
export const KIND = { fade: 0, twinkle: 1, strobe: 2, glitter: 3, tail: 4, head: 5 };

/**
 * Write the particles of shell s through put(ox,oy,oz, vx,vy,vz, t0,life,k,g, r,g,b, size, kind, seed).
 * part 0 = the shell climbing and the sparks it sheds (write these when it is launched), part 1 = the stars of the
 * burst (write these when it bursts — a particle only takes a slot of the ring buffer while it is in the air),
 * null = both. Deterministic in (s.seed, frac, part). Returns the number written (= shellCount(s, frac, part)).
 */
export function emitShell(s, frac, put, part = null) {
  const T_ = TYPES[s.type], P = [0, 0, 0];
  let n = 0;
  const gold = COLOURS.gold, comet = s.type === 'comet', hc = comet ? s.col : COLOURS.white;
  if (part !== 1) {
    const R = rng(s.seed);
    put(s.lx, 0.6, s.lz, s.vx, s.vy, s.vz, s.t0, s.rise, RISE_K, 1, hc[0], hc[1], hc[2], comet ? 2.6 : 1.3, KIND.head, R()); n++;
    const tail = Math.max(2, Math.round((comet ? 9 : 6) * Math.max(frac, 0.4)));
    for (let j = 0; j < tail; j++) {
      const tj = ((j + 0.5 + (R() - 0.5) * 0.6) / tail) * s.rise * (comet ? 0.96 : 0.9);
      posAt(s.lx, 0.6, s.lz, s.vx, s.vy, s.vz, RISE_K, 1, tj, P);
      const tc = comet ? s.col : gold;
      put(P[0], P[1], P[2], (R() - 0.5) * 1.6, -1.5 - R() * 2, (R() - 0.5) * 1.6, s.t0 + tj, (comet ? 1.1 : 0.55) + R() * 0.4, 1.5, 0.5, tc[0], tc[1], tc[2], comet ? 1.6 : 0.9, KIND.tail, R()); n++;
    }
  }
  if (comet || part === 0) return n;
  const R = rng((s.seed ^ 0x5bd1e995) >>> 0);
  const stars = Math.max(10, Math.round(T_.n * frac * (0.75 + 0.25 * s.size))), L = starLayout(s.type, stars);
  const sp = T_.v * (0.7 + 0.3 * s.size), c = s.col, c2 = s.col2;
  // ring: stars on a circle in a tilted plane
  const tilt = R() * Math.PI, spin = R() * Math.PI * 2, ct = Math.cos(tilt), st = Math.sin(tilt);
  const ga = Math.PI * (3 - Math.sqrt(5)), ph0 = R() * 6.283;
  for (let j = 0; j < L.rays; j++) {
    let dx, dy, dz;
    if (s.type === 'ring') {
      const a = (j / L.rays) * Math.PI * 2 + spin, x = Math.cos(a), z = Math.sin(a);
      dx = x; dy = z * st; dz = z * ct;
    } else {
      // Fibonacci sphere with a little jitter: an even shell of stars
      const y = 1 - ((j + 0.5) / L.rays) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), a = j * ga + ph0;
      dx = Math.cos(a) * r + (R() - 0.5) * 0.12; dy = y + (R() - 0.5) * 0.12; dz = Math.sin(a) * r + (R() - 0.5) * 0.12;
      if (s.type === 'palm') dy = Math.abs(dy) * 0.6 + 0.35;                 // fronds go up and out
    }
    const v0 = sp * (s.type === 'ring' ? 1 : 0.9 + R() * 0.14), life = T_.life * (0.82 + R() * 0.3);
    if (L.sub === 1) {
      const pistil = s.type === 'peony' && c2 !== c && j % 4 === 0, cc = pistil ? c2 : c, vv = pistil ? v0 * 0.45 : v0;
      const kind = s.type === 'crackle' ? KIND.twinkle : s.type === 'strobe' ? KIND.strobe : s.type === 'willow' ? KIND.glitter : KIND.fade;
      put(s.bx, s.by, s.bz, dx * vv, dy * vv, dz * vv, s.tb, life, T_.k, T_.g, cc[0], cc[1], cc[2], (s.type === 'willow' ? 2.3 : 2.8) * (0.8 + 0.25 * s.size), kind, R()); n++;
    } else {
      // a ray drawn as a short run of stars, each a little slower, smaller and shorter-lived than the one in front
      for (let q = 0; q < L.sub; q++) {
        const f = q / L.sub, vv = v0 * (1 - f * (s.type === 'palm' ? 0.55 : 0.2)), cc = s.type === 'palm' && q > 1 ? gold : q === 0 ? c : c2 === c ? c : c2;
        put(s.bx, s.by, s.bz, dx * vv, dy * vv, dz * vv, s.tb, life * (1 - f * 0.3), T_.k, T_.g, cc[0], cc[1], cc[2], 2.8 * (1 - f * 0.45) * (0.8 + 0.25 * s.size), s.type === 'palm' ? KIND.glitter : KIND.fade, R()); n++;
      }
    }
  }
  // crackle: late white pops where the stars have got to
  for (let j = 0; j < L.extra; j++) {
    const y = 1 - ((j + 0.5) / L.extra) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), a = j * ga * 1.7 + ph0, v0 = sp * (0.55 + R() * 0.45);
    const dt = 0.9 + R() * 0.9;
    posAt(s.bx, s.by, s.bz, Math.cos(a) * r * v0, y * v0, Math.sin(a) * r * v0, T_.k, T_.g, dt, P);
    put(P[0], P[1], P[2], (R() - 0.5) * 3, (R() - 0.5) * 3, (R() - 0.5) * 3, s.tb + dt, 0.22 + R() * 0.3, 2, 0.4, 1, 0.95, 0.8, 2.2, KIND.strobe, R()); n++;
  }
  return n;
}

/** light the display throws at display time tau: sum of recent bursts (colour * loudness * quick decay) -> out [r,g,b].
 * `from` = index to start scanning at (shells are sorted; pass the value returned last time). Returns the new index. */
export function glowAt(shells, tau, from, out) {
  out[0] = out[1] = out[2] = 0;
  let i = Math.max(0, from | 0);
  while (i < shells.length && shells[i].tb < tau - 2.2) i++;
  for (let j = i; j < shells.length; j++) {
    const s = shells[j]; if (s.t0 > tau) break;
    if (s.type === 'comet' || s.tb > tau) continue;
    const a = tau - s.tb, w = (Math.exp(-a * 3.4) + (s.type === 'willow' ? 0.25 * Math.exp(-a * 0.9) : 0.08 * Math.exp(-a * 1.2))) * (0.5 + 0.5 * s.size);
    out[0] += s.col[0] * w; out[1] += s.col[1] * w; out[2] += s.col[2] * w;
  }
  return i;
}
/** seconds for sound to arrive from d metres */
export const soundDelay = (d) => d / 343;

/**
 * Sound events of the display that ARRIVE at a listener `dist` metres from the launch site in the window
 * [tau0, tau1) of display time -> calls cb(kind, tArrive, shell) with kind 'launch' | 'boom' | 'crackle' | 'whistle' | 'ooh'.
 * 'ooh' (the crowd) is delayed by distCrowd instead. Pure: the same listener position gives the same events.
 */
export function soundEvents(shells, tau0, tau1, dist, distCrowd, cb) {
  const d = soundDelay(dist), dc = soundDelay(distCrowd);
  for (let j = 0; j < shells.length; j++) {
    const s = shells[j];
    if (s.t0 + d > tau1 + 6) break;
    if (s.tb + 2.6 + d < tau0 && s.tb + 2.6 + dc < tau0) continue;
    const tl = s.t0 + d; if (tl >= tau0 && tl < tau1) { cb('launch', tl, s); if (s.whistle) cb('whistle', tl, s); }
    if (s.type === 'comet') continue;
    const t = s.tb + d; if (t >= tau0 && t < tau1) cb('boom', t, s);
    if (s.type === 'crackle') { const tc = s.tb + 1.0 + d; if (tc >= tau0 && tc < tau1) cb('crackle', tc, s); }
    if (s.ooh) { const to = s.tb + 0.5 + dc; if (to >= tau0 && to < tau1) cb('ooh', to, s); }
  }
}

// ------------------------------------------------------------------------------------------------ the crowd
/**
 * Deterministic standing places for the crowd: `n` spots [x, z, cell 0..7, scale, phase, warm] — the viewing field in
 * loose rows facing the display, and a ring round the bonfire. ok(x, z) rejects spots (trees, paths…). The list is
 * ordered so that the first k of it is an even sample of the whole (the crowd fills in everywhere at once).
 */
export function crowdSpots(n, ok = () => true) {
  const out = [], [c0, c1, c2] = SITE.crowd, x0 = c0[0], x1 = c1[0], z0 = c0[1], z1 = c2[1];
  const [bx, bz] = SITE.bonfire;
  const cand = [];
  // rows across the field (north-south lines), denser towards the front (east)
  let row = 0;
  for (let x = x1 - 1; x > x0; x -= 1.5 + row * 0.035, row++) {
    const keep = 0.92 - 0.5 * ((x1 - x) / (x1 - x0));
    for (let z = z0 + 1; z < z1; z += 0.95) {
      const h = hash(Math.round(x * 31), Math.round(z * 17));
      if (h > keep) continue;
      // aisles every ~22 m so that the field can be walked through
      if (mod(z - z0, 22) < 2.6 || mod(x1 - x, 30) > 27.2) continue;
      cand.push([x + (hash(row, z) - 0.5) * 0.9, z + (hash(z, row) - 0.5) * 0.5]);
    }
  }
  // round the fire, behind the safety ring
  for (let ring = 0; ring < 4; ring++) {
    const r = SITE.bonfireR + 2.2 + ring * 1.45, m = Math.floor((2 * Math.PI * r) / 0.95);
    for (let j = 0; j < m; j++) {
      if (hash(ring * 97 + 5, j) > 0.72 - ring * 0.12) continue;
      const a = (j / m) * Math.PI * 2 + ring * 0.37;
      cand.push([bx + Math.cos(a) * r, bz + Math.sin(a) * r]);
    }
  }
  // even order: sort by a hash of position
  cand.sort((p, q) => hash(p[0] * 3.1, p[1] * 7.3) - hash(q[0] * 3.1, q[1] * 7.3));
  for (const [x, z] of cand) {
    if (out.length >= n) break;
    if (!ok(x, z)) continue;
    const d = Math.hypot(x - bx, z - bz), h = hash(x * 5.3, z * 9.1);
    out.push([x, z, Math.floor(h * 8) % 8, 0.9 + hash(z, x) * 0.2, hash(x, z * 3.3), clamp(1.25 - d / 55, 0, 1)]);
  }
  return out;
}
