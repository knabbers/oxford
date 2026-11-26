// Birds — PURE logic (no DOM, no three): the species, how each flaps, and the birds of the sky.
// Everything in the sky is a function of the shared map and the shared clock (seconds), so every player sees the same
// flocks in the same places and nothing is sent. systems/birds.js draws them; tools/smoke_birds.mjs tests this file.
//
//   SPECIES / SP            sizes (m), speeds (m/s), wing beat, colours [underparts, mantle + wings, wing tips, head,
//                           bill, tail, legs (the bill's when left out)]; shapes are one low-poly bird stretched by these numbers (_birds_geo.js)
//   flap(sp, t, ph, mode)   wing angles for a moment: cruise (beats, with glides for the species that glide), burst
//                           (take-off / landing) or soar (wings held out, the odd lazy beat)
//   activity(part, h, wx)   0..1: how many are about, by hour and weather (roosting at night, fewer in rain)
//   new Sky(map, opts)      the flocks: .flocks, .relief (roof and tree tops), .trip(f, t, env), .bound(f, t, o),
//                           .eval(f, i, t, o) -> member i's position at shared-clock second t
// Flock kinds:
//   cross   a party flying from one place to another: gulls right across the map from beyond one edge to beyond another
//           ('edge'), crows / jackdaws / wood pigeons / starlings from one tree or roof to another ('roost': they rise
//           out of it and drop into it), geese in a V and ducks low and fast along a river ('river')
//   wheel   a flock of town pigeons (or jackdaws) off a roof, two to four circuits over the streets and back down
//   soar    red kites and buzzards, a few gulls, turning slowly on held wings and drifting; always there by day, they
//           come down to the trees as the light or the weather goes (continuous, so nothing pops)
//   hawk    swifts / swallows hunting high up in fine warm weather
// (As it falls through the threshold the party comes down to the roofs and trees, and is gone only there.)
// A trip is flown when activity() NOW (the hour and the shared weather: the same number for every player) is above a
// threshold hashed from (flock, trip number); as it falls through the threshold the party sinks towards the roofs and
// dwindles away over a few seconds (dusk, the start of rain). The game's day is short (core/time.js) and a gull takes seven
// of them to cross the map, so "decided when it sets off" would leave the night sky full of the afternoon's gulls.

export const BIRDS_ON = !((typeof location !== 'undefined' && location && /[?&]birds=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_BIRDS === '0'));
export const EPOCH = 1.7e9;                       // seconds taken off the shared clock before any trigonometry
const TAU = Math.PI * 2;
export const hashU = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const sstep = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** d/dx of sstep(a, b, x) */
const dstep = (a, b, x) => { const t = (x - a) / (b - a); return t <= 0 || t >= 1 ? 0 : 6 * t * (1 - t) / (b - a); };

// ------------------------------------------------------------------------------------------------ species
// len: bill to tail (m) · hs: half the wing span (m) · v: cruising speed (m/s) · f: wing beats a second · amp: beat
// (rad) · glide: share of the time on held wings · dih: how the held wing is carried (rad above level) · neck / tail /
// fork / girth / chord / sweep / leg: shape, in body lengths · flush: how near (m) you get before it goes
const S = (name, len, hs, v, f, amp, glide, dih, shape, flush, gait, col) => ({ name, len, hs, v, f, amp, glide, dih, neck: shape[0], tail: shape[1], fork: shape[2], girth: shape[3], chord: shape[4], sweep: shape[5], leg: shape[6], flush, gait, col });
export const SPECIES = [
  //                                                        neck  tail  fork girth chord sweep leg
  S('pigeon', 0.33, 0.33, 15, 6.0, 0.85, 0.06, 0.38, [0.02, 1.0, 0, 1.15, 1.0, 0.1, 0.13], 2.2, 'walk', [0x8a93a0, 0x7d8794, 0x33373d, 0x56606c, 0xb0504a, 0x494f58]),
  S('pigeon_dark', 0.33, 0.33, 15, 6.0, 0.85, 0.06, 0.38, [0.02, 1.0, 0, 1.15, 1.0, 0.1, 0.13], 2.2, 'walk', [0x4f545c, 0x474c54, 0x24272b, 0x3a4744, 0xb0504a, 0x2c2f34]),
  S('pigeon_pied', 0.33, 0.33, 15, 6.0, 0.85, 0.06, 0.38, [0.02, 1.0, 0, 1.15, 1.0, 0.1, 0.13], 2.2, 'walk', [0xd6d6d0, 0xc9c9c4, 0x6a6d72, 0x9a9da0, 0xb0504a, 0xbdbdb8]),
  S('woodpigeon', 0.41, 0.38, 16, 5.2, 0.8, 0.05, 0.35, [0.03, 1.15, 0, 1.2, 1.05, 0.08, 0.12], 3.5, 'walk', [0xa08e92, 0x7f8791, 0x2f3237, 0x76808c, 0xc46a5a, 0x3a3d42]),
  S('gull', 0.37, 0.5, 11, 3.1, 0.6, 0.35, 0.1, [0.04, 0.8, 0, 1.0, 0.75, 0.22, 0.2], 3.2, 'walk', [0xf2f2ee, 0xc3c9cf, 0x1c1c1e, 0xf0f0ec, 0xb23a2e, 0xf2f2ee]),
  S('big_gull', 0.58, 0.7, 12, 2.6, 0.55, 0.45, 0.1, [0.05, 0.8, 0, 1.05, 0.8, 0.2, 0.2], 3.4, 'walk', [0xf2f2ee, 0x7d858d, 0x151517, 0xf2f2ee, 0xe0b83a, 0xf2f2ee, 0xd8a8a0]),
  S('red_kite', 0.63, 0.87, 9.5, 2.0, 0.5, 1, 0.04, [0.02, 1.7, 0.5, 0.9, 0.95, 0.3, 0.12], 6, 'walk', [0x9a4a22, 0x5c3a24, 0x15120f, 0xc9c2b4, 0xd8b23a, 0xb85a24]),
  S('buzzard', 0.54, 0.6, 10, 2.4, 0.5, 1, 0.2, [0.02, 1.0, 0, 1.1, 1.4, 0.05, 0.12], 6, 'walk', [0x8a745c, 0x5a4330, 0x2a2018, 0x5a4330, 0xd8b23a, 0x8a6a48]),
  S('crow', 0.47, 0.47, 12, 3.3, 0.7, 0.05, 0.12, [0.03, 1.1, 0, 1.05, 1.25, 0.05, 0.2], 3.5, 'walk', [0x16171a, 0x17181c, 0x0e0e10, 0x151619, 0x1a1a1c, 0x121316]),
  S('jackdaw', 0.34, 0.34, 13, 4.4, 0.75, 0.12, 0.15, [0.02, 1.0, 0, 1.05, 1.15, 0.08, 0.2], 3.0, 'walk', [0x202126, 0x1a1b1f, 0x101013, 0x5c6066, 0x1a1a1c, 0x141518]),
  S('starling', 0.21, 0.19, 17, 8.5, 0.8, 0.3, 0.05, [0.01, 0.6, 0, 1.1, 1.1, 0.25, 0.2], 3.0, 'walk', [0x22272a, 0x2c2822, 0x15130f, 0x1e2226, 0xc8a83a, 0x191a1c, 0x9a5a48]),
  S('swift', 0.17, 0.21, 14, 8.0, 0.55, 0.5, 0.0, [0.0, 0.9, 0.4, 0.8, 0.5, 0.75, 0.05], 3.0, 'hop', [0x2a2622, 0x2a2622, 0x1c1916, 0x38322c, 0x1a1a1a, 0x24201c]),
  S('canada_goose', 0.95, 0.85, 16, 3.2, 0.6, 0, 0.1, [0.32, 0.6, 0, 1.25, 1.0, 0.1, 0.2], 2.8, 'waddle', [0xb8a890, 0x6f5d48, 0x2a241d, 0x17171a, 0x1c1c1e, 0x1c1c1e]),
  S('greylag', 0.82, 0.8, 16, 3.3, 0.6, 0, 0.1, [0.28, 0.6, 0, 1.25, 1.0, 0.1, 0.2], 2.8, 'waddle', [0xa89e90, 0x8a8076, 0x3a3632, 0x8a7f70, 0xe08a3a, 0xe8e6e0]),
  S('mallard', 0.56, 0.44, 18, 7.0, 0.6, 0, 0.1, [0.14, 0.6, 0, 1.25, 0.8, 0.2, 0.1], 2.4, 'waddle', [0xb4b2ac, 0x77706a, 0x34302c, 0x1f5a3a, 0xd8b02a, 0x1c1c1c, 0xe0782a]),
  S('mallard_hen', 0.52, 0.42, 18, 7.0, 0.6, 0, 0.1, [0.14, 0.6, 0, 1.25, 0.8, 0.2, 0.1], 2.4, 'waddle', [0x9a7c58, 0x6f5a42, 0x3a3026, 0x8f7655, 0xc8842a, 0x9a8262, 0xe0782a]),
  S('blackbird', 0.25, 0.18, 11, 7.5, 0.8, 0.15, 0.1, [0.01, 1.3, 0, 1.05, 1.2, 0.05, 0.22], 3.0, 'hop', [0x141414, 0x121212, 0x0c0c0c, 0x131313, 0xe8a21a, 0x101010, 0x3a2c1e]),
  S('blackbird_hen', 0.25, 0.18, 11, 7.5, 0.8, 0.15, 0.1, [0.01, 1.3, 0, 1.05, 1.2, 0.05, 0.22], 3.0, 'hop', [0x6a5440, 0x4a3a2c, 0x35291f, 0x4f3f30, 0x8a6a3a, 0x3d3026, 0x3a2c1e]),
  S('robin', 0.14, 0.105, 9, 9.0, 0.8, 0.1, 0.1, [0.0, 1.0, 0, 1.3, 1.2, 0.05, 0.26], 2.2, 'hop', [0xd0d0c4, 0x7a6248, 0x5a4a36, 0xcf6a2a, 0x4a3a2c, 0x6a563e]),
  S('sparrow', 0.15, 0.115, 10, 9.0, 0.8, 0.12, 0.1, [0.0, 1.0, 0, 1.25, 1.2, 0.05, 0.2], 2.8, 'hop', [0xb8ad9c, 0x7a5a38, 0x4a3826, 0x6a6058, 0x3a3430, 0x5a4632]),
  S('magpie', 0.45, 0.28, 11, 5.5, 0.8, 0.15, 0.1, [0.02, 2.3, 0, 1.05, 1.3, 0.0, 0.2], 3.5, 'hop', [0xf0f0ec, 0x15171c, 0xe8e8e4, 0x101114, 0x151515, 0x13202a]),
];
export const SP = {}; SPECIES.forEach((s, i) => { s.i = i; SP[s.name] = i; });
/** who may sit on water */
export const WATER_BIRD = new Set([SP.mallard, SP.mallard_hen, SP.canada_goose, SP.greylag, SP.gull, SP.big_gull]);
/** how high the body's centre is carried above its feet when it stands (m) */
export const standH = (s) => (0.07 * s.girth + s.leg) * s.len;

// ------------------------------------------------------------------------------------------------ wings
export const FLAP = { cruise: 0, burst: 1, soar: 2 };
const _f = { a: 0, b: 0 };
/** wing angles (rad above level) of the inner and outer wing: -> {a, b} (one shared object) */
export function flap(s, t, ph, mode) {
  if (mode === 2) {
    const w = sstep(0.93, 0.985, Math.sin(t * 0.23 + ph * 1.3)), q = Math.sin(TAU * s.f * t + ph);
    _f.a = s.dih + 0.035 * Math.sin(t * 0.8 + ph) + w * s.amp * 0.7 * q; _f.b = _f.a + 0.06 + w * s.amp * 0.4 * Math.sin(TAU * s.f * t + ph - 1);
    return _f;
  }
  const f = mode === 1 ? s.f * 1.3 : s.f, amp = mode === 1 ? Math.min(1.15, s.amp * 1.3) : s.amp, p = TAU * f * t + ph;
  let k = 0;
  if (s.glide > 0 && mode === 0) k = sstep(-0.15, 0.15, Math.sin(t * (0.8 + 0.5 * ((ph * 0.37) % 1)) + ph * 1.7) - (1 - 2 * s.glide));
  _f.a = (1 - k) * (0.1 + amp * Math.sin(p)) + k * s.dih;
  _f.b = _f.a + (1 - k) * amp * 0.55 * Math.sin(p - 1.0) + k * 0.05;
  return _f;
}

// ------------------------------------------------------------------------------------------------ who is about
const bump = (h, a, b, w) => sstep(a, a + w, h) * (1 - sstep(b - w, b, h));
/** 0..1: the share of a kind of flock that is out at hour h (0-24) in weather wx {rain 0..1, fog 0..1, tempC, cloud 0..1} */
export function activity(part, h, wx) {
  const light = sstep(5.3, 6.6, h) * (1 - sstep(19.6, 20.9, h));
  if (light <= 0) return 0;
  const rain = wx ? clamp((wx.rain || 0) * 2.5, 0, 1) : 0, fog = wx ? clamp(wx.fog || 0, 0, 1) : 0, wet = (1 - 0.78 * rain) * (1 - 0.5 * fog);
  switch (part) {
    case 'dawndusk': return light * wet * (0.16 + 0.84 * Math.max(bump(h, 5.4, 9, 1), bump(h, 16.2, 20.6, 1)));          // geese to and from the meadow
    case 'dusk': return light * wet * (0.3 + 0.7 * bump(h, 15, 20.4, 1.2));                                             // starlings gathering
    case 'soar': return sstep(7.2, 9.2, h) * (1 - sstep(17.6, 19.6, h)) * (1 - rain) * (1 - 0.8 * fog);                    // needs the day's air
    case 'fine': return light * (rain > 0.02 ? 0 : 1) * (1 - fog) * sstep(11.5, 14, wx && wx.tempC !== undefined ? wx.tempC : 15) * (1 - 0.6 * sstep(0.7, 1, wx ? wx.cloud || 0 : 0));   // swifts: warm, dry
    default: return light * wet;
  }
}

// ------------------------------------------------------------------------------------------------ roof and tree tops
/** LV[0] = the relief envelope R at (x, z) (through a typed array: a function that returns a double makes garbage) */
const LV = new Float64Array(1);
function low(R, x, z) {
  if (x < R.x0 || x > R.x1 || z < R.z0 || z > R.z1) { LV[0] = 10; return; }
  const nx = R.nx, d = R.dil, fx = (x - R.x0) / R.cell - 0.5, fz = (z - R.z0) / R.cell - 0.5;
  let i0 = Math.floor(fx), k0 = Math.floor(fz); if (i0 < 0) i0 = 0; else if (i0 > nx - 2) i0 = nx - 2; if (k0 < 0) k0 = 0; else if (k0 > R.nz - 2) k0 = R.nz - 2;
  let u = fx - i0, w = fz - k0; if (u < 0) u = 0; else if (u > 1) u = 1; if (w < 0) w = 0; else if (w > 1) w = 1;
  const o = k0 * nx + i0;
  LV[0] = (d[o] * (1 - u) + d[o + 1] * u) * (1 - w) + (d[o + nx] * (1 - u) + d[o + nx + 1] * u) * w;
}
/** A grid of how high things stand (buildings, trees): raw (the tallest thing in a cell) and a smooth envelope over it
 *  (the tallest of the cells around, bilinear) that a low-flying bird keeps above. */
export function makeRelief(box, cell = 16) {
  const nx = Math.ceil((box.maxX - box.minX) / cell) + 1, nz = Math.ceil((box.maxZ - box.minZ) / cell) + 1;
  const raw = new Float32Array(nx * nz); let dil = raw;
  const ix = (x) => clamp(Math.floor((x - box.minX) / cell), 0, nx - 1), iz = (z) => clamp(Math.floor((z - box.minZ) / cell), 0, nz - 1);
  return {
    box, cell, nx, nz, raw,
    put(x0, z0, x1, z1, h) { for (let k = iz(z0); k <= iz(z1); k++) for (let i = ix(x0); i <= ix(x1); i++) if (raw[k * nx + i] < h) raw[k * nx + i] = h; },
    finish() {
      dil = new Float32Array(nx * nz);
      for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
        let m = 0;
        for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) { const a = i + di, b = k + dk; if (a >= 0 && b >= 0 && a < nx && b < nz && raw[b * nx + a] > m) m = raw[b * nx + a]; }
        dil[k * nx + i] = m;
      }
      this.dil = dil; this.x0 = box.minX; this.z0 = box.minZ; this.x1 = box.maxX; this.z1 = box.maxZ;
    },
    /** the tallest thing in the cell of (x, z) */
    rawAt(x, z) { return x < box.minX || x > box.maxX || z < box.minZ || z > box.maxZ ? 0 : raw[iz(z) * nx + ix(x)]; },
    /** the smooth envelope at (x, z): never below anything within a cell of it (10 m of hedgerow trees beyond the map) */
    at(x, z) { low(this, x, z); return LV[0]; },
  };
}

// ------------------------------------------------------------------------------------------------ rivers to fly along
const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
/** the rivers and the canal as long smooth lines, each run on straight from both ends until it is `out` m beyond the box */
export function riverRoutes(map, box, out = 350, max = 6) {
  const pcs = (map.waterlines || []).filter((w) => !w.tunnel && (w.kind === 'river' || w.kind === 'canal') && w.pts && w.pts.length > 1).map((w) => ({ pts: w.pts, L: plen(w.pts), used: false }));
  pcs.sort((a, b) => b.L - a.L);
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 3, chains = [];
  for (const p of pcs) {
    if (p.used) continue; p.used = true;
    let line = p.pts.slice(), grew = true;
    while (grew) {
      grew = false;
      for (const q of pcs) {
        if (q.used) continue;
        const a = q.pts[0], b = q.pts[q.pts.length - 1], h = line[0], t = line[line.length - 1];
        if (near(t, a)) line = line.concat(q.pts.slice(1)); else if (near(t, b)) line = line.concat(q.pts.slice(0, -1).reverse());
        else if (near(h, b)) line = q.pts.slice(0, -1).concat(line); else if (near(h, a)) line = q.pts.slice(1).reverse().concat(line); else continue;
        q.used = true; grew = true; break;
      }
    }
    if (plen(line) >= 800) chains.push(line);
  }
  chains.sort((a, b) => plen(b) - plen(a));
  const inside = (x, z) => x > box.minX - out && x < box.maxX + out && z > box.minZ - out && z < box.maxZ + out;
  return chains.slice(0, max).map((line) => {
    // run on from each end, straight, until well outside
    const ext = (pts) => { const n = pts.length, a = pts[Math.max(0, n - 4)], b = pts[n - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l; let x = b[0], z = b[1], k = 0; while (inside(x, z) && k++ < 80) { x += dx * 60; z += dz * 60; pts.push([x, z]); } };
    let pts = line.slice(); ext(pts); pts.reverse(); ext(pts);
    // even 50 m steps, then corners cut twice
    const L = plen(pts), rs = []; let i = 0, acc = 0;
    for (let s = 0; s <= L; s += 50) {
      while (i < pts.length - 2 && acc + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) < s) { acc += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); i++; }
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) || 1, u = clamp((s - acc) / l, 0, 1);
      rs.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]);
    }
    pts = rs;
    for (let pass = 0; pass < 2; pass++) { const o = [pts[0]]; for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(pts[pts.length - 1]); pts = o; }
    const n = pts.length, X = new Float32Array(n), Z = new Float32Array(n), Sx = new Float32Array(n);
    for (let k = 0; k < n; k++) { X[k] = pts[k][0]; Z[k] = pts[k][1]; if (k) Sx[k] = Sx[k - 1] + Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1]); }
    return { X, Z, S: Sx, n, len: Sx[n - 1] };
  });
}
const _rp = { x: 0, z: 0, dx: 0, dz: 1 };
function routeAt(R, s) {
  let lo = 0, hi = R.n - 2;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (R.S[mid] <= s) lo = mid; else hi = mid - 1; }
  const l = (R.S[lo + 1] - R.S[lo]) || 1, u = clamp((s - R.S[lo]) / l, 0, 1);
  // (the direction is blended over the joint, so a party does not kink at a vertex)
  let dx = (R.X[lo + 1] - R.X[lo]) / l, dz = (R.Z[lo + 1] - R.Z[lo]) / l;
  const j = u > 0.5 ? lo + 1 : lo - 1;
  if (j >= 0 && j < R.n - 1) { const l2 = (R.S[j + 1] - R.S[j]) || 1, w = Math.abs(u - 0.5); dx = dx * (0.5 + (0.5 - w)) + ((R.X[j + 1] - R.X[j]) / l2) * w; dz = dz * (0.5 + (0.5 - w)) + ((R.Z[j + 1] - R.Z[j]) / l2) * w; }
  _rp.x = R.X[lo] + (R.X[lo + 1] - R.X[lo]) * u; _rp.z = R.Z[lo] + (R.Z[lo + 1] - R.Z[lo]) * u; _rp.dx = dx; _rp.dz = dz;
  return _rp;
}

// ------------------------------------------------------------------------------------------------ the sky
export const KIND = { cross: 0, wheel: 1, soar: 2, hawk: 3 };
const CENTRE = { minX: -170, maxX: 720, minZ: -240, maxZ: 650 };       // world/index.js zoneAt 'centre'
const MEADOW = { minX: -1190, maxX: -886, minZ: -1835, maxZ: -660 };   // places/port_meadow.js

export class Sky {
  /**
   * map: the game's map (after every preMap). opts.heightOf(b) -> a building's top (m), opts.boxes: the playable boxes
   * (default map.boxes). Deterministic: the same map gives the same flocks on every client.
   */
  constructor(map, opts = {}) {
    const b = map.bounds, boxes = opts.boxes || map.boxes || [b];
    const box = { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
    for (const q of boxes) { box.minX = Math.min(box.minX, q.minX); box.maxX = Math.max(box.maxX, q.maxX); box.minZ = Math.min(box.minZ, q.minZ); box.maxZ = Math.max(box.maxZ, q.maxZ); }
    this.box = box;
    this.ext = { minX: box.minX - 260, maxX: box.maxX + 260, minZ: box.minZ - 260, maxZ: box.maxZ + 260 };
    // ---- how high the town stands
    const heightOf = opts.heightOf || ((bd) => bd.h || 8);
    const R = (this.relief = makeRelief({ minX: box.minX - 60, maxX: box.maxX + 60, minZ: box.minZ - 60, maxZ: box.maxZ + 60 }, 16));
    const roosts = [];
    for (const bd of map.buildings || []) {
      if (!bd.poly || bd.poly.length < 3) continue;
      const h = heightOf(bd); if (!(h > 0.5)) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of bd.poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
      R.put(x0, z0, x1, z1, h + 1.5);
      if (!bd.part && h >= 7 && h <= 24 && bd.c && (x1 - x0) * (z1 - z0) > 60) roosts.push(bd.c[0], bd.c[1], h + 1);
    }
    for (const t of map.trees || []) { const h = t[2] || 10; R.put(t[0] - 3, t[1] - 3, t[0] + 3, t[1] + 3, h); if (h >= 9) roosts.push(t[0], t[1], h * 0.85); }
    R.finish();
    // roosts in 200 m cells
    this.roosts = roosts; this.rcell = new Map();
    for (let i = 0; i < roosts.length; i += 3) { const k = Math.floor(roosts[i] / 200) * 4096 + Math.floor(roosts[i + 1] / 200); let a = this.rcell.get(k); if (!a) this.rcell.set(k, (a = [])); a.push(i); }
    this.routes = riverRoutes(map, box);
    this.flocks = [];
    this._make(map, boxes, opts);
    this._w = [0, 0]; this._e = { x: 0, z: 0, y: 0 };
  }

  /** a roost near (x, z): hashed among those in its 200 m cell (or a neighbour); -> index into this.roosts or -1 */
  _roost(x, z, u) {
    const cx = Math.floor(x / 200), cz = Math.floor(z / 200);
    for (let ring = 0; ring <= 2; ring++) for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      const a = this.rcell.get((cx + dx) * 4096 + cz + dz);
      if (a && a.length) return a[Math.min(a.length - 1, Math.floor(u * a.length))];
    }
    return -1;
  }

  _make(map, boxes, opts) {
    const r = rng(0xb12d5), box = this.box, F = this.flocks;
    const inBoxes = (x, z) => boxes.some((q) => x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ);
    const inC = (x, z) => x > CENTRE.minX && x < CENTRE.maxX && z > CENTRE.minZ && z < CENTRE.maxZ;
    const any = () => { for (let k = 0; k < 40; k++) { const x = box.minX + r() * (box.maxX - box.minX), z = box.minZ + r() * (box.maxZ - box.minZ); if (inBoxes(x, z)) return [x, z]; } return [0, 0]; };
    const centre = () => [CENTRE.minX + r() * (CENTRE.maxX - CENTRE.minX), CENTRE.minZ + r() * (CENTRE.maxZ - CENTRE.minZ)];
    const outer = () => { for (let k = 0; k < 40; k++) { const x = box.minX - 200 + r() * (box.maxX - box.minX + 400), z = box.minZ - 200 + r() * (box.maxZ - box.minZ + 400); if (!(x > CENTRE.minX - 150 && x < CENTRE.maxX + 150 && z > CENTRE.minZ - 150 && z < CENTRE.maxZ + 150)) return [x, z]; } return [box.maxX, box.minZ]; };
    const meadow = () => [MEADOW.minX + 40 + r() * (MEADOW.maxX - MEADOW.minX - 80), MEADOW.minZ + 100 + r() * (MEADOW.maxZ - MEADOW.minZ - 200)];
    const hasMeadow = boxes.some((q) => q.minX < MEADOW.maxX - 50 && q.maxX <= MEADOW.maxX + 20);
    const airfield = boxes.length > 2 && boxes[2] && !(boxes[2].minX < MEADOW.maxX) ? [(boxes[2].minX + boxes[2].maxX) / 2, (boxes[2].minZ + boxes[2].maxZ) / 2] : null;
    /** one flock. o: {kind, end, part, n, sp: () => species index, home, T, alt: [lo, hi], spread, form, route} */
    const add = (cat, j, N, o) => {
      const n = o.n, f = {
        k: F.length, cat, kind: KIND[o.kind], end: o.end || '', part: o.part || 'day', n, hx: o.home[0], hz: o.home[1], T: o.T, off: r() * o.T,
        alt0: o.alt[0], alt1: o.alt[1], spread: o.spread || 6, route: o.route || null, ord: (j + r()) / N, sp: new Uint8Array(n), mo: new Float32Array(n * 4), gate: 0.08 + 0.6 * r(),
        // the trip in hand (filled by trip())
        tn: NaN, tOn: false, out: 0, tg: 0.5, tt: 0, ax: 0, az: 0, bx: 0, bz: 0, dx: 0, dz: 1, len: 0, v: 10, alt: 0, ya: 0, yb: 0, dur: 0, ma: 0, mk: 0, mp: 0, cx: 0, cz: 0, rad: 40, th0: 0, dir: 1, climb: 100, hRate: 0, c1x: 0, c1z: 0, aloft: 0,
      };
      let big = 0;
      for (let i = 0; i < n; i++) {
        f.sp[i] = o.sp(i); const s = SPECIES[f.sp[i]]; big = Math.max(big, s.len);
        if (o.form === 'v') { const rank = Math.ceil(i / 2), side = i & 1 ? 1 : -1; f.mo[i * 4] = rank * s.len * 1.9; f.mo[i * 4 + 1] = side * rank * s.hs * 1.9; f.mo[i * 4 + 2] = (r() - 0.5) * 0.5; }
        else if (o.kind === 'soar') { f.mo[i * 4] = r() * TAU; f.mo[i * 4 + 1] = 26 + r() * 26; f.mo[i * 4 + 2] = r(); }             // (angle, radius, height share)
        else { f.mo[i * 4] = r() * f.spread * 1.6; f.mo[i * 4 + 1] = (r() - 0.5) * f.spread; f.mo[i * 4 + 2] = (r() - 0.5) * Math.min(5, f.spread * 0.5); }
        f.mo[i * 4 + 3] = r() * TAU;
      }
      f.v0 = SPECIES[f.sp[0]].v; f.big = big;
      F.push(f);
    };
    const pig = () => { const u = r(); return u < 0.66 ? SP.pigeon : u < 0.88 ? SP.pigeon_dark : SP.pigeon_pied; };
    const gull = () => (r() < 0.72 ? SP.gull : SP.big_gull);
    // ---- town pigeons wheeling over the streets (most over the centre), a couple of flocks of jackdaws
    let N = 18;
    for (let j = 0; j < N; j++) {
      const jd = j === 4 || j === 9, home = j < 12 ? centre() : any();
      add('wheel', j, N, { kind: 'wheel', n: jd ? 5 + Math.floor(r() * 4) : 8 + Math.floor(r() * 9), sp: jd ? () => SP.jackdaw : pig, home, T: 130 + r() * 50, alt: [12, 30], spread: jd ? 9 : 7 });
    }
    // ---- gulls: parties right across the map, edge to edge
    N = 28;
    for (let j = 0; j < N; j++) add('gulls', j, N, { kind: 'cross', end: 'edge', n: 1 + Math.floor(r() * 5), sp: gull, home: [0, 0], T: 560, alt: [24, 75], spread: 14 });
    // ---- tree to tree, roof to roof: crows, jackdaws, wood pigeons, magpies, gulls; starlings at speed
    N = 50;
    for (let j = 0; j < N; j++) {
      const u = r(), home = r() < 0.32 ? centre() : any();
      const o = u < 0.3 ? [SP.crow, 1 + Math.floor(r() * 3), [22, 50]] : u < 0.48 ? [SP.jackdaw, 3 + Math.floor(r() * 5), [22, 45]] : u < 0.68 ? [SP.woodpigeon, 1 + Math.floor(r() * 3), [20, 45]] : u < 0.78 ? [SP.magpie, 1 + Math.floor(r() * 2), [14, 24]] : [SP.gull, 2 + Math.floor(r() * 4), [28, 60]];
      add('local', j, N, { kind: 'cross', end: 'roost', n: o[1], sp: () => o[0], home, T: 75 + r() * 45, alt: o[2], spread: 8 });
    }
    N = 4;
    for (let j = 0; j < N; j++) add('starlings', j, N, { kind: 'cross', end: 'roost', part: 'dusk', n: 12 + Math.floor(r() * 10), sp: () => SP.starling, home: j === 0 && hasMeadow ? meadow() : j === 1 ? centre() : any(), T: 100 + r() * 40, alt: [25, 55], spread: 9 });
    // ---- along the rivers: skeins of geese at dawn and dusk, ducks low and fast
    if (this.routes.length) {
      N = 5;
      for (let j = 0; j < N; j++) { const g = r() < 0.6 ? SP.canada_goose : SP.greylag; add('geese', j, N, { kind: 'cross', end: 'river', part: 'dawndusk', n: 7 + Math.floor(r() * 7), sp: () => g, home: [0, 0], T: 330 + r() * 90, alt: [35, 85], form: 'v', route: this.routes[j % this.routes.length] }); }
      N = 7;
      for (let j = 0; j < N; j++) add('ducks', j, N, { kind: 'cross', end: 'river', n: 2 + Math.floor(r() * 3), sp: (i) => (i & 1 ? SP.mallard_hen : SP.mallard), home: [0, 0], T: 300 + r() * 80, alt: [10, 26], spread: 4, route: this.routes[j % this.routes.length] });
    }
    // ---- soaring: red kites (and a buzzard or two) over the meadow, the airfield and the outskirts; gulls turning high
    N = 10;
    for (let j = 0; j < N; j++) {
      const home = j < 2 && hasMeadow ? meadow() : j === 2 && airfield ? airfield : outer(), bz = j > 3 && r() < 0.25;
      add('kites', j, N, { kind: 'soar', part: 'soar', n: bz ? 1 : 1 + Math.floor(r() * 2), sp: () => (bz ? SP.buzzard : SP.red_kite), home, T: 280 + r() * 120, alt: j % 3 === 2 ? [140 + r() * 60, 300 + r() * 150] : [35 + r() * 25, 90 + r() * 80] });     // (every third pair works the height the gliders fly at)
    }
    N = 18;
    for (let j = 0; j < N; j++) add('highgulls', j, N, { kind: 'soar', part: 'soar', n: 3 + Math.floor(r() * 4), sp: gull, home: any(), T: 300 + r() * 100, alt: [130 + r() * 90, 300 + r() * 180] });
    // ---- high skeins: geese in a V crossing the whole map at the height a glider flies
    N = 9;
    for (let j = 0; j < N; j++) { const g = r() < 0.6 ? SP.canada_goose : SP.greylag; add('highgeese', j, N, { kind: 'cross', end: 'edge', n: 7 + Math.floor(r() * 6), sp: () => g, home: [0, 0], T: 560, alt: [150, 420], form: 'v' }); }
    // ---- swifts / swallows hawking for insects high over the roofs in fine warm weather
    N = 6;
    for (let j = 0; j < N; j++) add('swifts', j, N, { kind: 'hawk', part: 'fine', n: 4 + Math.floor(r() * 4), sp: () => SP.swift, home: j < 3 ? centre() : any(), T: 600, alt: [38 + r() * 20, 80 + r() * 50], spread: 45 });
  }

  /** soarers' drifting centre: the n-th waypoint of flock f */
  _way(f, n, o) { o[0] = f.hx + (hashU(f.k * 7 + 1, n) - 0.5) * 760; o[1] = f.hz + (hashU(f.k * 7 + 2, n) - 0.5) * 760; return o; }

  /** Bring flock f's trip up to shared-clock second t. env.now[part]: activity() now for each kind of flock. -> in the air? */
  trip(f, t, env) {
    const q = (t - EPOCH + f.off) / f.T, n = Math.floor(q);
    f.tt = (q - n) * f.T; f._t = t;
    if (f.kind === KIND.soar || f.kind === KIND.hawk) {
      // (continuous: up as the day's activity passes this flock's own threshold, down again as it falls)
      f.aloft = sstep(f.gate * 0.6, f.gate * 0.6 + 0.3, env.now ? env.now[f.part] || 0 : 1);
      f.tOn = f.aloft > 0.003;
      if (n !== f.tn) { f.tn = n; const w = this._w; this._way(f, n, w); f.ax = w[0]; f.az = w[1]; this._way(f, n + 1, w); f.bx = w[0]; f.bz = w[1]; f.dir = hashU(f.k, 77) < 0.5 ? 1 : -1; }
      const u = f.tt / f.T, e = u * u * (3 - 2 * u);
      f.cx = f.ax + (f.bx - f.ax) * e; f.cz = f.az + (f.bz - f.az) * e;
      return f.tOn;
    }
    if (n === f.tn) { f.out = sstep(f.tg - 0.1, f.tg + 0.1, env.now ? env.now[f.part] || 0 : 1); return (f.tOn = f.out > 0.002); }
    f.tn = n;
    const r = rng((Math.imul(f.k + 1, 2654435761) ^ Math.imul(n, 40503)) >>> 0);
    f.tg = 0.1 + 0.8 * r(); f.out = sstep(f.tg - 0.1, f.tg + 0.1, env.now ? env.now[f.part] || 0 : 1); f.tOn = f.out > 0.002;
    f.v = f.v0 * (0.92 + 0.16 * r()); f.alt = f.alt0 + r() * (f.alt1 - f.alt0);
    f.ma = 0; f.mk = 0.012; f.mp = r() * TAU; f.hRate = 0;
    if (f.kind === KIND.wheel) {
      const ri = this._roost(f.hx + (r() - 0.5) * 120, f.hz + (r() - 0.5) * 120, r());
      const rx = ri >= 0 ? this.roosts[ri] : f.hx, rz = ri >= 0 ? this.roosts[ri + 1] : f.hz; f.ya = this.relief.at(rx, rz) + 1;
      f.rad = 34 + r() * 36; f.dir = r() < 0.5 ? 1 : -1;
      const a0 = r() * TAU; f.cx = rx + f.rad * Math.cos(a0); f.cz = rz + f.rad * Math.sin(a0); f.th0 = a0 + Math.PI;
      let c = 2 + Math.floor(r() * 3); while (c > 1 && (c * TAU * f.rad) / f.v > f.T * 0.8) c--;
      f.dur = (c * TAU * f.rad) / f.v; f.alt += f.ya; f.hRate = -f.dir * f.v / f.rad;
      return f.tOn;
    }
    // cross
    if (f.end === 'river') {
      const R = f.route; f.dir = r() < 0.5 ? 1 : -1; f.len = R.len; f.ma = 5; f.mk = 0.02;
    } else if (f.end === 'edge') {
      const E = this.ext, w = E.maxX - E.minX, h = E.maxZ - E.minZ, per = 2 * (w + h);
      const at = (p, o) => { p = ((p % per) + per) % per; if (p < w) { o[0] = E.minX + p; o[1] = E.minZ; } else if (p < w + h) { o[0] = E.maxX; o[1] = E.minZ + p - w; } else if (p < 2 * w + h) { o[0] = E.maxX - (p - w - h); o[1] = E.maxZ; } else { o[0] = E.minX; o[1] = E.maxZ - (p - 2 * w - h); } return o; };
      const pa = r() * per, o = this._w; at(pa, o); f.ax = o[0]; f.az = o[1]; at(pa + per * (0.3 + 0.4 * r()), o); f.bx = o[0]; f.bz = o[1];
      if (Math.hypot(f.bx - f.ax, f.bz - f.az) < 900) { at(pa + per * 0.5, o); f.bx = o[0]; f.bz = o[1]; }
      f.ma = 22; f.mk = 0.011; f.ya = f.yb = f.alt;
    } else {
      // roost to roost
      const i0 = this._roost(f.hx + (r() - 0.5) * 300, f.hz + (r() - 0.5) * 300, r());
      f.ax = i0 >= 0 ? this.roosts[i0] : f.hx; f.az = i0 >= 0 ? this.roosts[i0 + 1] : f.hz;
      let i1 = -1;
      for (let k = 0; k < 4 && i1 < 0; k++) { const a = r() * TAU, d = 320 + r() * 520, j = this._roost(f.ax + Math.cos(a) * d, f.az + Math.sin(a) * d, r()); if (j >= 0 && j !== i0 && Math.hypot(this.roosts[j] - f.ax, this.roosts[j + 1] - f.az) > 180) i1 = j; }
      if (i1 >= 0) { f.bx = this.roosts[i1]; f.bz = this.roosts[i1 + 1]; } else { const a = r() * TAU; f.bx = f.ax + Math.cos(a) * 420; f.bz = f.az + Math.sin(a) * 420; }
      f.ya = this.relief.at(f.ax, f.az) + 1; f.yb = this.relief.at(f.bx, f.bz) + 1;
      f.ma = 9; f.mk = 0.02;
    }
    if (f.end !== 'river') { f.len = Math.hypot(f.bx - f.ax, f.bz - f.az) || 1; f.dx = (f.bx - f.ax) / f.len; f.dz = (f.bz - f.az) / f.len; }
    f.climb = Math.min(140, f.len * 0.3); f.dur = (f.len + f.spread * 2 + 20) / f.v;
    if (f.dur > f.T * 0.97) f.v = (f.len + f.spread * 2 + 20) / (f.T * 0.97), f.dur = f.T * 0.97;
    return f.tOn;
  }

  /** where flock f is as a whole (after trip()): o.x, o.z, o.r (a circle that holds every member), o.y (roughly); false when down */
  bound(f, t, o) {
    if (!f.tOn) return false;
    if (f.kind === KIND.soar) { o.x = f.cx; o.z = f.cz; o.r = 60; o.y = f.alt0 + (f.alt1 - f.alt0) * 0.5; return true; }
    if (f.kind === KIND.hawk) { o.x = f.hx; o.z = f.hz; o.r = f.spread * 1.6; o.y = f.alt0; return true; }
    if (f.tt > f.dur + 4) return false;
    if (f.kind === KIND.wheel) { o.x = f.cx; o.z = f.cz; o.r = f.rad + f.spread + 4; o.y = f.alt; return true; }
    const s = clamp(f.v * f.tt, 0, f.len);
    if (f.route) { const p = routeAt(f.route, f.dir > 0 ? s : f.len - s); o.x = p.x; o.z = p.z; }
    else { o.x = f.ax + f.dx * s; o.z = f.az + f.dz * s; }
    o.r = f.spread * 2 + f.ma + (f.n > 6 ? f.n * 1.5 : 0) + 12; o.y = f.alt;
    return true;
  }

  /**
   * Member i of flock f at shared-clock second t (after trip(f, t, env) for that moment): o.x, o.y, o.z, its velocity
   * o.vx, o.vy, o.vz (m/s), its rate of turn o.h (rad/s: heading = atan2(vx, vz)) and o.k (0..1: how much of it is
   * there — it shrinks into its roost / out of sight); -> false when it is not in the air. Allocation-free.
   */
  eval(f, i, t, o) {
    if (!f.tOn) return false;
    const k = f.kind;
    return k === 0 ? this._cross(f, i, t - EPOCH, o) : k === 1 ? this._wheel(f, i, t - EPOCH, o) : k === 2 ? this._soar(f, i, t - EPOCH, o) : this._hawk(f, i, t - EPOCH, o);
  }
  _soar(f, i, te, o) {
    const m = i * 4, mo = f.mo, ph = mo[m + 3];
    const sp = SPECIES[f.sp[i]], rad = mo[m + 1], w = f.dir * sp.v / rad, a = mo[m] + w * te, ca = Math.cos(a), sa = Math.sin(a);
    o.x = f.cx + ca * rad; o.z = f.cz + sa * rad;
    low(this.relief, o.x, o.z);
    const hi = f.alt0 + (f.alt1 - f.alt0) * (0.5 + 0.5 * Math.sin(te * 0.011 + ph)) * (0.55 + 0.45 * mo[m + 2]), lo = LV[0] + 3, al = f.aloft;
    o.y = lo + ((hi > lo + 20 ? hi : lo + 20) - lo) * al + Math.sin(te * 0.21 + ph) * 3 * al;
    o.vx = -sa * rad * w; o.vz = ca * rad * w; o.vy = 0;
    o.k = al >= 0.12 ? 1 : al <= 0 ? 0 : (al / 0.12) * (al / 0.12) * (3 - 2 * al / 0.12); o.h = -w; return o.k > 0;
  }
  _hawk(f, i, te, o) {
    const ph = f.mo[i * 4 + 3], A = f.spread, w = 0.26 + 0.1 * ((ph * 3.1) % 1), q = te * w, q1 = q + ph, q2 = 2.3 * q + ph * 2.1, q3 = 0.83 * q + ph * 1.7, q4 = 1.9 * q + ph, q5 = 0.61 * q + ph * 2.3;
    const s1 = Math.sin(q1), s2 = Math.sin(q2), s3 = Math.sin(q3), s4 = Math.sin(q4), c4 = Math.cos(q4), al = f.aloft;
    o.x = f.hx + A * (s1 + 0.42 * s2); o.z = f.hz + A * (s3 + 0.42 * c4);
    low(this.relief, o.x, o.z);
    const lo = LV[0] + 6, hi = f.alt0 + (f.alt1 - f.alt0) * (0.5 + 0.5 * Math.sin(q5));
    o.y = lo + ((hi > lo ? hi : lo) - lo) * al;
    o.vx = A * w * (Math.cos(q1) + 0.966 * Math.cos(q2)); o.vz = A * w * (0.83 * Math.cos(q3) - 0.798 * s4); o.vy = (f.alt1 - f.alt0) * 0.305 * w * Math.cos(q5) * al;
    const ax = -A * w * w * (s1 + 2.2218 * s2), az = -A * w * w * (0.6889 * s3 + 1.5162 * c4);
    o.h = (ax * o.vz - az * o.vx) / (o.vx * o.vx + o.vz * o.vz + 0.5);
    o.k = al >= 0.2 ? 1 : al <= 0 ? 0 : al * 5; return o.k > 0;
  }
  _wheel(f, i, te, o) {
    const m = i * 4, mo = f.mo, ph = mo[m + 3], tm = f.tt - mo[m] / f.v;
    if (tm <= 0 || tm >= f.dur) return false;
    const a = f.th0 + f.dir * (f.v * tm) / f.rad, rad = f.rad + mo[m + 1] + 1.5 * Math.sin(te * 0.7 + ph), ca = Math.cos(a), sa = Math.sin(a);
    o.x = f.cx + ca * rad; o.z = f.cz + sa * rad;
    low(this.relief, o.x, o.z);
    const e1 = sstep(0, 6, tm), e2 = sstep(0, 7, f.dur - tm), e = e1 * e2;
    let y = f.ya + (f.alt - f.ya) * e + (mo[m + 2] + 2.5 * Math.sin(a * 1.3 + f.mp) + 0.6 * Math.sin(te * 0.9 + ph)) * e;
    const lo = LV[0] + 1 + 2 * (e > 0.4 ? 1 : e * 2.5); if (y < lo) y = lo;
    if (f.out < 1) { y = lo + (y - lo) * f.out; }
    o.y = y;
    o.vx = -sa * f.dir * f.v; o.vz = ca * f.dir * f.v; o.vy = (f.alt - f.ya) * (dstep(0, 6, tm) * e2 - e1 * dstep(0, 7, f.dur - tm));
    o.k = sstep(0, 1.3, tm) * sstep(0, 1.3, f.dur - tm) * (f.out < 0.22 ? sstep(0, 0.22, f.out) : 1); o.h = f.hRate; return true;
  }
  _cross(f, i, te, o) {
    const m = i * 4, mo = f.mo, ph = mo[m + 3], s = f.v * f.tt - mo[m];
    if (s <= 0 || s >= f.len) return false;
    let bx, bz, dx, dz;
    if (f.route) { const p = routeAt(f.route, f.dir > 0 ? s : f.len - s); bx = p.x; bz = p.z; dx = p.dx * f.dir; dz = p.dz * f.dir; }
    else { bx = f.ax + f.dx * s; bz = f.az + f.dz * s; dx = f.dx; dz = f.dz; }
    const mq = s * f.mk + f.mp, ms = Math.sin(mq), lat = mo[m + 1] + f.ma * ms + (f.route && f.n > 6 ? 0 : 1.1 * Math.sin(te * 0.6 + ph)), dl = f.ma * f.mk * Math.cos(mq);
    o.x = bx + dz * lat; o.z = bz - dx * lat;
    o.vx = f.v * (dx + dz * dl); o.vz = f.v * (dz - dx * dl); o.vy = 0; o.h = -f.v * f.ma * f.mk * f.mk * ms;
    low(this.relief, o.x, o.z);
    let y, lo;
    if (f.end === 'roost') {
      const e1 = sstep(0, f.climb, s), e2 = sstep(0, f.climb, f.len - s), e = e1 * e2, y0 = s < f.len * 0.5 ? f.ya : f.yb;
      y = y0 + (f.alt - y0) * e + (mo[m + 2] + 2 * Math.sin(s * 0.017 + f.mp)) * e;
      lo = LV[0] + 1 + 3 * (e > 0.3333 ? 1 : e * 3);
      o.vy = f.v * (f.alt - y0) * (dstep(0, f.climb, s) * e2 - e1 * dstep(0, f.climb, f.len - s));
      o.k = sstep(0, 14, s) * sstep(0, 14, f.len - s);
    } else {
      y = f.alt + mo[m + 2] + 3 * Math.sin(s * 0.013 + f.mp) + 0.5 * Math.sin(te * 0.8 + ph);
      lo = LV[0] + 6;
      o.k = sstep(0, 40, s) * sstep(0, 40, f.len - s);
    }
    if (y < lo) y = lo;
    // (the day's activity has fallen past this party — dusk, rain: it comes down to the roofs and trees, and only there is gone)
    if (f.out < 1) { lo = LV[0] + 1; y = lo + (y - lo) * f.out; if (f.out < 0.22) o.k *= sstep(0, 0.22, f.out); }
    o.y = y;
    return true;
  }
}
