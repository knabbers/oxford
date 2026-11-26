// Ambience rules — PURE (no DOM, no three, no audio): what you should hear where and when. systems/ambience.js feeds
// the results to _amb_synth.js; tools/smoke_audio.mjs tests them against the real map.
//   buildGrid(map)                      16 m raster of the map: green space, water, main roads, shopping streets, trees
//   sampleGrid(G, x, z, out)            smoothed 0..1 fields around a point
//   outdoorMix(env, out)                layer gains + bird / bell / people event rates for a place and an hour
//   placeProfile(place, st, out)        the same for an interior
//   bellEvents(h0, h1, x, z)            which tower strikes when the clock passes an hour (and Great Tom at 21:05)
//   farBells(h0, h1, x, z, near)        the other towers of the town striking the same hour, each a little off the others
//   ringing(day, hour)                  the tower whose ringers are at practice (or ringing for Sunday service), or null
//   changeRow(n, bells, out)            row n of the plain hunt they ring (shared clock: every player hears the same row)
//   occluded(G, x0, z0, x1, z1)         0..1: how much building stands between two points (the 16 m raster: cheap, coarse)
//   sourcesOf(mix)                      names of everything audible in a mix (for tests and the audition page)
// Units: layer amounts are 0..1 (a little over on a wild day); rates are events a second near the listener.
export const TOWERS = {
  carfax: { p: [129, 335], hz: 392, name: 'Carfax Tower' },
  mary: { p: [423, 250], hz: 330, name: 'St Mary the Virgin' },
  tom: { p: [238, 530], hz: 233, name: 'Great Tom, Christ Church' },      // Great Tom sounds a (flat) A — low and slow
};
// The other clocks of the town (GUESSED positions to within a street, pitches and manners invented: no two Oxford
// clocks agree, which is the point). lag: seconds after the true hour that the first stroke falls; gap: seconds a stroke.
export const TOWERS_FAR = {
  tomHour: { p: [238, 530], hz: 233, gap: 2.3, lag: 3.5, name: 'Great Tom (the hour)' },
  magdalen: { p: [905.6, 362.5], hz: 294, gap: 1.65, lag: 7.5, name: 'Magdalen Tower' },
  merton: { p: [545, 385], hz: 262, gap: 1.5, lag: 1.0, name: 'Merton Chapel', chime: [1.5, 1.335, 1.189, 0.891, 1.189, 1.335, 1.5, 1.189] },   // its own chime before the hour (GUESS: the notes are invented, the having of one is not)
  newcoll: { p: [560, 70], hz: 311, gap: 1.45, lag: 12.5, name: 'New College bell tower' },
  northgate: { p: [150, 190], hz: 415, gap: 1.2, lag: 5.0, name: 'St Michael at the North Gate' },
  allsaints: { p: [340, 280], hz: 440, gap: 1.15, lag: 9.0, name: 'All Saints (Lincoln College library)' },
  giles: { p: [60, -480], hz: 349, gap: 1.35, lag: 15.0, name: "St Giles'" },
  barnabas: { p: [-390, -400], hz: 370, gap: 1.3, lag: 10.5, name: 'St Barnabas, Jericho' },
};
// towers with a ring of bells and a band: practice night (GUESS: weekday index from the shared day) and Sunday morning
const RINGERS = [['giles', 1], ['magdalen', 4]];      // (two evenings in seven)
import { HOUR_S } from '../core/time.js';             // real seconds in a game hour
const GREEN = { park: 1, garden: 1, grass: 0.8, meadow: 1, wood: 1, scrub: 1, pitch: 0.7, flowerbed: 1 };
const ROADV = { primary: 255, primary_link: 255, secondary: 230, tertiary: 180, unclassified: 70, residential: 55 };

function inPoly(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function buildGrid(map, cell = 16) {
  const b = map.bounds, nx = Math.ceil((b.maxX - b.minX) / cell) + 1, nz = Math.ceil((b.maxZ - b.minZ) / cell) + 1, N = nx * nz;
  const G = { cell, nx, nz, minX: b.minX, minZ: b.minZ, green: new Uint8Array(N), water: new Uint8Array(N), road: new Uint8Array(N), shop: new Uint8Array(N), tree: new Uint8Array(N), built: new Uint8Array(N) };
  const ix = (x) => Math.max(0, Math.min(nx - 1, Math.floor((x - b.minX) / cell))), iz = (z) => Math.max(0, Math.min(nz - 1, Math.floor((z - b.minZ) / cell)));
  for (const a of map.areas || []) {
    const g = GREEN[a.kind], w = a.kind === 'water';
    if (!g && !w) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of a.poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    const f = w ? G.water : G.green, v = w ? 255 : Math.round(g * 255);
    for (let k = iz(z0); k <= iz(z1); k++) for (let i = ix(x0); i <= ix(x1); i++) {
      const cx = b.minX + (i + 0.5) * cell, cz = b.minZ + (k + 0.5) * cell;
      if (inPoly(cx, cz, a.poly)) { const j = k * nx + i; if (f[j] < v) f[j] = v; }
    }
    if (x1 - x0 < cell || z1 - z0 < cell) { const j = iz((z0 + z1) / 2) * nx + ix((x0 + x1) / 2); if (f[j] < v * 0.5) f[j] = v * 0.5; }   // a pond smaller than a cell
  }
  // buildings: the share of each cell that is roofed (what stands between you and a sound, and what keeps the wind off)
  for (const bd of map.buildings || []) {
    const P = bd.poly; if (!P || P.length < 3) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    if (x1 - x0 < cell * 1.5 && z1 - z0 < cell * 1.5) {      // a house: its area, into the cell its middle is in
      let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += P[j][0] * P[i][1] - P[i][0] * P[j][1];
      const j = iz((z0 + z1) / 2) * nx + ix((x0 + x1) / 2); G.built[j] = Math.min(255, G.built[j] + Math.round((Math.abs(a) / 2 / (cell * cell)) * 255));
      continue;
    }
    for (let k = iz(z0); k <= iz(z1); k++) for (let i = ix(x0); i <= ix(x1); i++) {
      let n = 0; const bx = b.minX + i * cell, bz = b.minZ + k * cell;
      for (let q = 0; q < 4; q++) if (inPoly(bx + (0.25 + 0.5 * (q & 1)) * cell, bz + (0.25 + 0.5 * (q >> 1)) * cell, P)) n++;
      if (n) { const j = k * nx + i; G.built[j] = Math.min(255, G.built[j] + n * 64); }
    }
  }
  const stamp = (f, pts, v) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (cell * 0.5)));
      for (let k = 0; k <= n; k++) { const j = iz(az + ((bz - az) * k) / n) * nx + ix(ax + ((bx - ax) * k) / n); if (f[j] < v) f[j] = v; }
    }
  };
  for (const r of map.roads || []) {
    if (r.tunnel) continue;
    if (ROADV[r.kind]) stamp(G.road, r.pts, ROADV[r.kind]);
    else if (r.kind === 'pedestrian') stamp(G.shop, r.pts, 255);
  }
  for (const w of map.waterlines || []) if (!w.tunnel && (w.kind === 'river' || w.kind === 'canal' || (w.w || 0) >= 3)) stamp(G.water, w.pts, 255);
  for (const t of map.trees || []) { const j = iz(t[1]) * nx + ix(t[0]); if (G.tree[j] < 250) G.tree[j] += 1; }
  return G;
}
/** → out {green, water, road, shop, trees, built, open} each 0..1, smoothed over the neighbouring cells; open = how
 *  exposed the spot is to the wind (a meadow 1, a bridge most of 1, a street or a quad nearly 0); (wdx, wdz) / (rdx, rdz)
 *  = unit vectors towards the water / the main road that is heard (0, 0 when there is none) */
export function sampleGrid(G, x, z, out = {}) {
  const c = G.cell, fx = (x - G.minX) / c, fz = (z - G.minZ) / c, i0 = Math.floor(fx), k0 = Math.floor(fz);
  let green = 0, gw = 0, water = 0, road = 0, shop = 0, trees = 0, built = 0, bw = 0, wx = 0, wz = 0, rx = 0, rz = 0;
  const B = G.built;
  for (let dk = -4; dk <= 4; dk++) for (let di = -4; di <= 4; di++) {
    const i = i0 + di, k = k0 + dk;
    if (i < 0 || k < 0 || i >= G.nx || k >= G.nz) continue;
    const j = k * G.nx + i, d = Math.hypot((i + 0.5 - fx) * c, (k + 0.5 - fz) * c);
    if (d < 30) { const w = 1 - d / 30; green += (G.green[j] / 255) * w; gw += w; }
    if (B && d < 44) { const w = 1 - d / 44; built += (B[j] / 255) * w; bw += w; }
    if (G.water[j]) { const v = (G.water[j] / 255) * Math.max(0, 1 - Math.max(0, d - 6) / 34); if (v > water) water = v; if (d > 1) { wx += ((i + 0.5 - fx) * c / d) * v; wz += ((k + 0.5 - fz) * c / d) * v; } }
    if (G.road[j]) { const v = (G.road[j] / 255) * Math.max(0, 1 - Math.max(0, d - 6) / 60); if (v > road) road = v; if (d > 1) { rx += ((i + 0.5 - fx) * c / d) * v; rz += ((k + 0.5 - fz) * c / d) * v; } }
    if (G.shop[j]) { const v = (G.shop[j] / 255) * Math.max(0, 1 - Math.max(0, d - 8) / 34); if (v > shop) shop = v; }
    if (G.tree[j] && d < 45) trees += G.tree[j] * (1 - d / 45);
  }
  out.green = gw ? Math.min(1, green / gw) : 0; out.water = water; out.road = road; out.shop = shop;
  out.trees = Math.min(1, trees / 6 + out.green * 0.5);
  out.built = bw ? Math.min(1, built / bw) : 0;
  out.open = Math.max(0, 1 - 3 * out.built) * (1 - 0.3 * Math.min(1, trees / 6));
  let m = Math.hypot(wx, wz); out.wdx = m > 0.3 ? wx / m : 0; out.wdz = m > 0.3 ? wz / m : 0;
  m = Math.hypot(rx, rz); out.rdx = m > 0.3 ? rx / m : 0; out.rdz = m > 0.3 ? rz / m : 0;
  return out;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const bump = (h, a, peak, b) => (h <= a || h >= b ? 0 : h < peak ? (h - a) / (peak - a) : (b - h) / (b - peak));
/** how busy the roads are by the hour: rush hours 1, small hours nearly nothing */
export function trafficByHour(h) {
  if (h < 5) return 0.1; if (h < 7) return 0.1 + 0.4 * (h - 5) / 2; if (h < 9.5) return 1; if (h < 16) return 0.75;
  if (h < 18.5) return 1; if (h < 22) return 1 - 0.55 * (h - 18.5) / 3.5; return 0.45 - 0.35 * (h - 22) / 2;
}
export const LAYERS = ['air', 'wind', 'moan', 'traffic', 'crowd', 'water', 'room', 'hum', 'vent'];
export const BIRDS = ['songbird', 'blackbird', 'robin', 'pigeon', 'owl', 'duck', 'wren', 'tit', 'sparrow', 'crow', 'jackdaw', 'magpie', 'gull', 'goose', 'moorhen', 'chink', 'kewick', 'redwing'];
export const EVENTS = [...BIRDS, 'bikebell', 'reveller', 'siren', 'drip', 'page', 'cough', 'creak', 'cutlery', 'beep', 'chalk', 'distantStep', 'glass', 'steam', 'pen'];
const INDOOR = new Set(['page', 'cough', 'creak', 'cutlery', 'beep', 'chalk', 'distantStep', 'glass', 'steam', 'pen']);
export const isIndoorEvent = (k) => INDOOR.has(k);
function zero(out) {
  for (const k of LAYERS) out[k] = 0;
  if (!out.rates) out.rates = {};
  for (const k of EVENTS) out.rates[k] = 0;
  out.tick = false; out.roomCut = 400; out.leak = 1; out.rev = 'dry'; out.send = 0; out.wall = 16000; out.walla = null;
  return out;
}
/** how hard the leaves are worked by a wind of w m/s near the ground: 1 in an ordinary breeze (3 m/s), a breath in a calm */
export const leafWind = (w) => Math.min(1.6, Math.max(0.15, 0.1 + 0.3 * w));
/** the wind itself in open country: nothing under a metre a second, a steady moan from 6, a buffeting at 10 */
export const openWind = (w) => { const k = (w - 1) / 7; return k <= 0 ? 0 : Math.min(1.25, Math.pow(k, 1.3)); };
/**
 * env: {green, water, road, shop, trees, built, open (0..1), hour, daylight (0..1), peds (people within 30 m), cars (moving
 * vehicles within 60 m), cx, cz (distance from Carfax matters for revellers)} and, when the weather is known,
 * {wind (m/s near the ground, default 3: an ordinary breeze), season (0 early October .. 1 early December, default 0.3),
 * wet (0..1 how wet everything is), rain (0..1 falling now)}. Layer gains are 0..1 "amounts"; rates are events/s.
 */
export function outdoorMix(env, out = {}) {
  zero(out);
  const h = env.hour, day = env.daylight ?? 1, night = 1 - day, g = env.green, tr = env.trees, w = env.water, bl = env.built || 0;
  const wind = env.wind ?? 3, sea = env.season ?? 0.3, open = env.open ?? Math.max(0, g - 0.5 * tr);
  const tf = trafficByHour(h);
  out.air = 0.3 + 0.25 * tf * (1 - 0.6 * g);                                   // the city's far-off hush; thinner in a garden, at night
  out.wind = (0.15 * (0.1 + 0.9 * open) + 0.65 * tr * (0.2 + 0.8 * open)) * leafWind(wind) * (1 - 0.35 * sea);   // leaves (thinner as they come down through the term; less where the place is shut in)
  out.moan = open * open * openWind(wind);                                            // the wind itself, where nothing keeps it off
  out.traffic = clamp01(env.road * tf + Math.min(0.35, (env.cars || 0) * 0.07));          // the road by the hour + the cars actually passing
  out.crowd = clamp01((Math.max(0, (env.peds || 0) - 2) / 14) * (0.55 + 0.45 * env.shop));   // two people are not a crowd
  out.water = w * (1 + 0.5 * openWind(wind));                                  // lapping; a chop when it blows
  const dawn = bump(h, 4.3, 5.6, 7.5), dusk = bump(h, 18.6, 20.2, 21.3), roost = bump(h, 19.3, 20.4, 21.2);
  const song = 1 - 0.4 * sea;                                                  // autumn: most song falls away; the robin's does not
  const R = out.rates;
  R.songbird = (g * (0.5 * dawn + 0.17 * day) + tr * 0.03 * day) * song;
  R.blackbird = g * (0.13 * dawn + 0.11 * dusk + 0.012 * day);
  R.robin = g * (0.06 * dawn + 0.05 * dusk + 0.02 * day) * (1 + 0.5 * sea) + tr * 0.006 * night;   // robins sing under street lamps
  R.pigeon = (g * 0.035 + 0.006) * day * (1 - dawn * 0.5);
  R.owl = g * (night > 0.9 ? 0.012 : 0);
  R.kewick = g * tr * (night > 0.9 ? 0.006 : 0);                               // the hen tawny answering
  R.duck = w > 0.3 ? w * g * day * 0.05 : 0;
  R.moorhen = w > 0.3 ? w * (0.02 * day + 0.006 * night) : 0;
  R.goose = w > 0.3 ? w * g * day * 0.008 * (1 + 2 * Math.max(dawn, dusk)) : 0;   // (the skeins overhead are heard from where they are: ambience.js)
  R.wren = (g * (0.05 * dawn + 0.012 * day) + tr * 0.004 * day) * song;
  R.tit = g * (0.06 * dawn + 0.02 * day) * song;
  R.sparrow = Math.min(1, 2.5 * bl) * tr * (1 - g * 0.6) * 0.03 * day;         // hedges and eaves by houses
  R.crow = (g * 0.012 + 0.003) * day * (1 + dawn);
  R.jackdaw = (bl * 0.012 + 0.002) * day + (bl * 0.03 + g * 0.01) * roost * day;   // round the towers; noisy going to roost
  R.magpie = g * tr * 0.012 * day;
  R.gull = (w * 0.012 + env.shop * 0.006 + 0.002) * day * (1 + dawn);
  R.chink = g * tr * (0.12 * roost * Math.min(1, day * 3) + 0.006 * day);       // blackbirds chinking as the light goes
  R.redwing = night > 0.9 && sea > 0.05 && sea < 0.85 ? 0.007 : 0;             // migrants passing over in the dark, October and November
  R.bikebell = (env.road * 0.5 + env.shop) * day * 0.012;
  const late = h >= 22.5 || h < 3.2, dc = Math.hypot((env.cx ?? 0) - TOWERS.carfax.p[0], (env.cz ?? 0) - TOWERS.carfax.p[1]);
  R.reveller = late ? 0.022 * clamp01(1 - (dc - 250) / 450) : 0;
  R.siren = (bl > 0.08 || env.road > 0.2 ? 0.0016 + 0.002 * env.road : 0.0004) * (0.35 + 0.65 * tf);      // somewhere across town, every several minutes
  const wet = env.wet || 0, rain = env.rain || 0;
  R.drip = wet > 0.15 ? clamp01((wet - 0.15) * 1.5) * (1 - clamp01(rain * 6)) * (0.1 + 0.5 * tr + 0.3 * Math.min(1, bl * 2)) : 0;   // after the rain
  return out;
}
const PUB = /\b(arms|inn|tavern|pub|bar|head|horse|bear|crown)\b/i;
/**
 * st: {hour, people (NPCs in the room), meal ('lunch'|'dinner'|'formal'|null), service (bool), name (the room's name:
 * a room with no entry of its own is placed by what it is called)}.
 * -> layer amounts + rates as outdoors, and: leak (how much of the street comes through the walls and shut windows),
 * wall (Hz: how dull it arrives), rev ('dry' | 'room' | 'hall' | 'stone': the room's reverberation) and send (0..1).
 */
export function placeProfile(place, st = {}, out = {}) {
  zero(out);
  const R = out.rates, n = st.people || 0, name = st.name || '', h = st.hour ?? 12;
  const eve = clamp01((h - 17) / 3) * (h < 23.5 ? 1 : 0);
  out.leak = 0.08; out.room = 0.25; out.roomCut = 350; out.rev = 'room'; out.send = 0.25; out.wall = 520;
  const library = () => { out.room = 0.22; out.roomCut = 240; R.page = 0.09; R.cough = 0.012; R.creak = 0.012; R.pen = 0.03; out.leak = 0.03; out.send = 0.3; };
  const museum = () => { out.room = 0.35; out.roomCut = 420; out.crowd = clamp01(0.04 + n / 40); R.distantStep = 0.08; R.creak = 0.01; R.cough = 0.01; out.leak = 0.05; out.rev = 'stone'; out.send = 0.55; };
  const pub = () => { out.room = 0.22; out.roomCut = 260; out.crowd = clamp01((0.14 + n / 14) * (0.6 + 0.4 * eve)); R.glass = 0.1 + 0.1 * eve; R.creak = 0.02; out.leak = 0.06; out.send = 0.25; };
  const shop = () => { out.room = 0.2; R.creak = 0.02; R.beep = 0.03; out.crowd = clamp01(n / 30); out.leak = 0.12; };
  if (place === 'worcint_chapel') { out.room = 0.32; out.roomCut = 260; R.creak = 0.012; out.leak = 0.04; out.rev = 'stone'; out.send = 0.9; out.wall = 380; }
  else if (place === 'worcint_hall') {
    out.room = 0.35; out.roomCut = 300; out.rev = 'hall'; out.send = 0.7;
    if (st.meal) { out.crowd = clamp01(0.25 + n / 16); R.cutlery = 0.25 + Math.min(1.2, n * 0.07); R.creak = 0.02; if (st.meal === 'formal') R.glass = 0.12; }
  } else if (place === 'worcint_library') library();
  else if (place === 'worcint_lodge') { out.room = 0.2; out.tick = true; R.page = 0.02; out.leak = 0.2; out.wall = 900; }
  else if (place === 'worcint_pidge') { out.room = 0.16; R.page = 0.03; R.creak = 0.008; R.distantStep = 0.015; out.leak = 0.14; out.wall = 800; }
  else if (place === 'worcint_memorial') { out.room = 0.18; out.tick = true; out.leak = 0.05; out.send = 0.35; }
  else if (place === 'worcint_stair5') { out.room = 0.16; R.creak = 0.03; R.distantStep = 0.03; out.leak = 0.1; out.rev = 'hall'; out.send = 0.3; }
  else if (place === 'worcint_earl') { out.room = 0.2; out.hum = 0.25; out.vent = 0.4; out.leak = 0.1; }                    // fridges and the extractor
  else if (place === 'worcester_bar') { out.room = 0.2; out.roomCut = 220; out.leak = 0; out.send = 0.3; }          // murmur + jukebox: _bar_audio.js
  else if (place === 'purple_turtle') { out.room = 0; out.leak = 0; out.send = 0; out.rev = 'dry'; }                // _pt_audio.js
  else if (place.startsWith('shop_')) { out.room = 0.4; out.roomCut = 900; out.hum = 0.6; out.vent = 0.3; out.crowd = clamp01(0.08 + n / 30); R.beep = 0.18; out.leak = 0.12; out.send = 0.2; }
  else if (place === 'maths_institute') { out.room = 0.35; out.roomCut = 500; out.vent = 0.2; out.crowd = clamp01(n / 30); R.distantStep = 0.06; out.leak = 0.06; out.rev = 'hall'; out.send = 0.45; }
  else if (place === 'maths_lecture') { out.room = 0.3; out.roomCut = 320; R.chalk = 0.3; R.cough = 0.02; R.creak = 0.02; R.page = 0.05; R.pen = 0.08; out.leak = 0; out.send = 0.3; }
  else if (place === 'music_faculty') { out.room = 0.18; out.roomCut = 300; R.distantStep = 0.02; out.leak = 0.06; }   // practising: _music_synth.js
  else if (place === 'randolph_lobby') { out.room = 0.25; out.tick = true; out.crowd = 0.06; out.leak = 0.12; }
  else if (place === 'mus_ash' || place === 'mus_nhm') museum();
  else if (place === 'mus_pitt') { museum(); out.roomCut = 300; out.rev = 'hall'; out.send = 0.45; R.creak = 0.03; }   // dark, wooden, close-packed
  else if (place === 'rad_reading') { library(); out.rev = 'stone'; out.send = 0.45; }
  else if (place === 'rad_divinity') { out.room = 0.3; out.roomCut = 260; R.distantStep = 0.03; out.leak = 0.05; out.rev = 'stone'; out.send = 0.8; }
  else if (place === 'rad_tower') { out.room = 0; out.leak = 0.9; out.wall = 16000; out.rev = 'dry'; out.send = 0; }       // the gallery of St Mary's tower: out of doors
  else if (place === 'b6_exam_schools') { out.room = 0.3; out.roomCut = 300; R.pen = 0.25; R.cough = 0.03; R.creak = 0.03; R.page = 0.06; out.tick = true; out.leak = 0.04; out.rev = 'hall'; out.send = 0.5; }
  else if (place === 'bs_books') { shop(); out.room = 0.22; R.page = 0.06; R.creak = 0.03; R.beep = 0.02; }                 // old boards, pages
  else if (place === 'bs_basement') { library(); out.room = 0.28; out.roomCut = 300; out.vent = 0.2; out.rev = 'hall'; out.send = 0.3; R.pen = 0; out.crowd = clamp01(n / 40); }
  else if (place === 'bs_bastion') pub();
  else if (place === 'cw_market') { out.room = 0.3; out.roomCut = 500; out.crowd = clamp01(0.22 + n / 25); R.glass = 0.03; R.beep = 0.04; R.steam = 0.03; R.distantStep = 0.1; out.leak = 0.2; out.wall = 1200; out.rev = 'hall'; out.send = 0.45; }
  else if (place === 'hooke_room' || place === 'hooke_upper') { out.room = 0.3; out.roomCut = 450; out.vent = 0.4; out.hum = 0.15; R.distantStep = 0.03; out.leak = 0.05; out.rev = 'hall'; out.send = 0.3; }
  else if (place === 'pizza_artisan') { out.room = 0.2; out.vent = 0.5; out.hum = 0.2; out.leak = 0.2; out.wall = 1500; }
  else if (place === 'eo_records') { shop(); R.page = 0.05; R.beep = 0.01; }                                                // sleeves flipped through
  else if (place === 'worcester_beaumont7') { out.room = 0.14; R.creak = 0.015; out.leak = 0.14; out.send = 0.2; }
  else if (place.startsWith('street_shop_')) shop();
  else if (/museum|gallery/i.test(name)) museum();
  else if (/library|reading/i.test(name)) library();
  else if (/chapel|church|cathedral|divinity/i.test(name)) { out.room = 0.3; out.roomCut = 260; R.creak = 0.012; out.leak = 0.04; out.rev = 'stone'; out.send = 0.85; }
  else if (/chamber|schools|\bhall\b|theatre/i.test(name)) { out.room = 0.3; out.roomCut = 300; R.creak = 0.02; R.cough = 0.01; out.rev = 'hall'; out.send = 0.5; }
  else if (PUB.test(name)) pub();
  else if (/market/i.test(name)) { out.room = 0.3; out.crowd = clamp01(0.2 + n / 25); out.rev = 'hall'; out.send = 0.4; out.leak = 0.2; }
  // what the people in the room sound like (which recordings of people talking: ambience.js WALLA), when there are any
  out.walla = out.crowd <= 0.02 ? null
    : place === 'bs_bastion' || (PUB.test(name) && !/museum|library|chapel|market/i.test(name)) ? 'pub'
      : place === 'worcint_hall' ? 'dining'
        : place === 'cw_market' || /market/i.test(name) ? 'market'
          : place === 'randolph_lobby' || /caf[eé]|coffee|tea room/i.test(name) ? 'cafe' : 'room';
  return out;
}
/**
 * Bells due when the game clock moves from hour h0 to h1 (floats, may wrap past 24): → [{tower, strokes, hour}].
 * On the hour the nearer of Carfax and St Mary's strikes it, 07:00–23:00 (a game hour is a minute or two, so the
 * quarters are left out — they would never stop). 21:05: Great Tom (a token few of his 101).
 */
export function bellEvents(h0, h1, x = 0, z = 0) {
  const out = [];
  if (h1 < h0) h1 += 24;
  if (h1 - h0 > 0.5) return out;                            // a jump (pinned / synced clock), not time passing
  const n = Math.floor(h1);
  if (n > h0 && n <= h1) {
    const hr = n % 24;
    if (hr >= 7 && hr <= 23) {
      const dc = Math.hypot(x - TOWERS.carfax.p[0], z - TOWERS.carfax.p[1]), dm = Math.hypot(x - TOWERS.mary.p[0], z - TOWERS.mary.p[1]);
      out.push({ tower: dm < dc ? 'mary' : 'carfax', strokes: hr % 12 || 12, hour: hr });
    }
  }
  const tom = 21 + 5 / 60;
  for (const t of [tom, tom + 24]) if (t > h0 && t <= h1) out.push({ tower: 'tom', strokes: 7, hour: 21 });
  return out;
}
/**
 * The rest of the town striking the same hour: every other tower within earshot (1.5 km), each starting `delay`
 * seconds from now (its own clock's error + the time the sound takes to arrive), at most `max` of them, nearest first.
 * near = the tower bellEvents() already gave (not repeated). → [{tower, T (its record), strokes, delay, dist}]
 */
export function farBells(h0, h1, x = 0, z = 0, near = null, max = 4) {
  const out = [];
  if (h1 < h0) h1 += 24;
  if (h1 - h0 > 0.5) return out;
  const n = Math.floor(h1); if (!(n > h0 && n <= h1)) return out;
  const hr = n % 24; if (hr < 7 || hr > 23) return out;
  const add = (id, T, lag, gap) => { const d = Math.hypot(x - T.p[0], z - T.p[1]); if (d < 1500) out.push({ tower: id, T, strokes: hr % 12 || 12, delay: lag + d / 343, dist: d, gap }); };
  for (const id in TOWERS_FAR) { const T = TOWERS_FAR[id]; add(id, T, T.lag, T.gap); }
  if (near === 'carfax') add('mary', TOWERS.mary, 6.2, 1.25); else if (near === 'mary') add('carfax', TOWERS.carfax, 2.6, 1.25);
  out.sort((a, b) => a.dist - b.dist); out.length = Math.min(out.length, max);
  return out;
}
/** The band at practice (weekday evenings from 19:30, one tower a night) or ringing for Sunday service (from 09:45). → tower id | null */
export function ringing(day, hour) {
  const wd = ((day % 7) + 7) % 7;
  if (wd === 6 && hour >= 9.75 && hour < 9.75 + 35 / HOUR_S) return 'mary';                      // (thirty-five real seconds of it)
  if (hour >= 19.5 && hour < 19.5 + 40 / HOUR_S) for (const [id, d] of RINGERS) if (d === wd) return id;      // (forty real seconds of it)
  return null;
}
/** Row n (0, 1, 2 …) of plain hunt on `bells` bells: out[i] = the bell (0 = treble) that strikes i-th. Rounds for the first 6 rows of every 6 + 6 x bells. */
export function changeRow(n, bells, out) {
  const per = 6 + 6 * bells, k = ((n % per) + per) % per, m = k < 6 ? 0 : (k - 5) % (2 * bells);      // six rows of rounds, then three courses, which end in rounds
  for (let b = 0; b < bells; b++) {
    // plain hunt: bell b's place after m changes (odd bells hunt up first, even bells down), reflecting off the front and the back
    let pos = b;
    for (let i = 0; i < m; i++) { if (i % 2 === 0) { if (pos % 2 === 0 && pos + 1 < bells) pos++; else if (pos % 2 === 1) pos--; } else { if (pos % 2 === 1 && pos + 1 < bells) pos++; else if (pos % 2 === 0 && pos > 0) pos--; } }
    out[pos] = b;
  }
  return out;
}
/** 0..1: how much building stands on the line between two points (sampled on the 16 m raster, at most 10 samples) */
export function occluded(G, x0, z0, x1, z1) {
  const B = G && G.built; if (!B) return 0;
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.min(10, Math.max(1, Math.floor(d / G.cell)));
  let s = 0;
  for (let i = 1; i <= n; i++) {
    const t = (i - 0.5) / n, ix = Math.floor((x0 + (x1 - x0) * t - G.minX) / G.cell), iz = Math.floor((z0 + (z1 - z0) * t - G.minZ) / G.cell);
    if (ix >= 0 && iz >= 0 && ix < G.nx && iz < G.nz) s += B[iz * G.nx + ix] / 255;
  }
  return Math.min(1, s / Math.min(n, 3));
}
/** everything audible in a mix: layer names above a whisper + event names with a non-zero rate (+ 'tick') */
export function sourcesOf(mix) {
  const s = [];
  for (const k of LAYERS) if (mix[k] > 0.05) s.push(k);
  if (mix.rates) for (const k of EVENTS) if (mix.rates[k] > 0.0005) s.push(k);
  if (mix.tick) s.push('tick');
  return s;
}

// ------------------------------------------------------------------------------------------------ the shared clock
// Two players standing together must hear the same bell, the same gull, the same train: nothing that both should hear
// is drawn from a local dice or from when a client happened to look. Everything below is a pure function of the SHARED
// clock (seconds: game.time.now() / 1000) and of where the listener is.
/** 0..1 from three integers (the same on every client) */
export function hash01(a, b, c = 0) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/**
 * The occurrences of event `id` (any integer) in the shared-time window [t0, t1): the clock is cut into one-second
 * slots; in slot k the event happens (at a moment inside the slot fixed by the hash) when hash(id, k) < rate. So a
 * rate of 0.05 is one in twenty seconds on average, and two clients with the same rate get the same seconds.
 * -> the number found; out[3j] = when (shared s), out[3j + 1], out[3j + 2] = two more 0..1 numbers for the event to use.
 */
export function due(id, rate, t0, t1, out) {
  let n = 0;
  if (!(rate > 0) || !(t1 > t0)) return 0;
  for (let k = Math.floor(t0); k < t1 && n < 8; k++) {
    const when = k + hash01(id, k, 1); if (when < t0 || when >= t1) continue;
    if (hash01(id, k, 2) < rate) { out[n * 3] = when; out[n * 3 + 1] = hash01(id, k, 3); out[n * 3 + 2] = hash01(id, k, 4); n++; }
  }
  return n;
}
/** a dice that every client throws the same: seed it (an integer), then call it. One generator, re-seeded per event. */
let _seed = 1;
export const seeded = (s) => { _seed = (s | 0) || 1; return srand; };
export function srand() { _seed = (_seed + 0x6d2b79f5) | 0; let t = _seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
/**
 * Every bell stroke of the hour that falls in the shared-time window [t0, t1), for a listener at (x, z). A game hour
 * is HOUR_S real seconds (core/time.js), so hours begin at multiples of HOUR_S of the shared clock. Stateless: a client that joins, wakes, or
 * walks into earshot mid-strike hears the strokes that are left, and no client can miss the hour by not looking at
 * the right moment. The nearer of Carfax / St Mary's strikes on the hour; the other towers each a few seconds off
 * (TOWERS_FAR lag) plus the time the sound takes; Merton's chime first; Great Tom's token seven at 21:05
 * (strokes are real seconds apart whatever the length of the hour).
 * cb(tower id, T (its record), when (shared s), hz, kind: 0 a stroke | 1 a chime note, dist (m), near (bool))
 */
export function hourStrokes(t0, t1, x, z, cb, max = 4) {
  for (let hs = Math.floor(t0 / HOUR_S) - 1; hs * HOUR_S < t1; hs++) {
    const start = hs * HOUR_S, hr = ((hs % 24) + 24) % 24;
    if (hr === 21) for (let i = 0; i < 7; i++) { const w = start + 5 * HOUR_S / 60 + i * 2.2; if (w >= t0 && w < t1) cb('tom', TOWERS.tom, w, TOWERS.tom.hz, 0, Math.hypot(x - TOWERS.tom.p[0], z - TOWERS.tom.p[1]), true, 0); }
    if (hr < 7 || hr > 23) continue;
    if (start + 45 < t0) continue;                                        // (every tower has finished by then)
    const n = hr % 12 || 12, dc = Math.hypot(x - TOWERS.carfax.p[0], z - TOWERS.carfax.p[1]), dm = Math.hypot(x - TOWERS.mary.p[0], z - TOWERS.mary.p[1]);
    const near = dm < dc ? 'mary' : 'carfax', NT = TOWERS[near];
    for (let i = 0; i < n; i++) { const w = start + 0.15 + i * 1.25; if (w >= t0 && w < t1) cb(near, NT, w, NT.hz, 0, Math.min(dc, dm), true, i); }
    if (!GREAT_HOURS.has(hr)) continue;                                   // (the rest of the town joins in four times a day: a game hour is short)
    // the others, nearest first, at most `max`
    let cnt = 0; const pick = _pick; pick.length = 0;
    for (const id in TOWERS_FAR) { const T = TOWERS_FAR[id], d = Math.hypot(x - T.p[0], z - T.p[1]); if (d < 1500) pick.push(id, d); }
    { const id = near === 'carfax' ? 'mary' : 'carfax', d = Math.max(dc, dm); if (d < 1500) pick.push(id, d); }
    for (let pass = 0; pass < max && cnt < max; pass++) {
      let bi = -1, bd = 1e9; for (let i = 0; i < pick.length; i += 2) if (pick[i + 1] < bd) { bd = pick[i + 1]; bi = i; }
      if (bi < 0) break;
      const id = pick[bi], T = TOWERS_FAR[id] || TOWERS[id], lag = TOWERS_FAR[id] ? T.lag : id === 'mary' ? 6.2 : 2.6, gap = T.gap || 1.25; pick[bi + 1] = 1e9; cnt++;
      let w0 = start + lag + bd / 343;
      if (T.chime) { for (let j = 0; j < T.chime.length; j++) { const w = w0 + j * 0.62 + (j >= 4 ? 0.5 : 0); if (w >= t0 && w < t1) cb(id, T, w, T.hz * 2 * T.chime[j], 1, bd, false); } w0 += T.chime.length * 0.62 + 1.9; }
      for (let i = 0; i < n; i++) { const w = w0 + i * gap; if (w >= t0 && w < t1) cb(id, T, w, T.hz, 0, bd, false, i); }
    }
  }
}
const _pick = [];
export const GREAT_HOURS = new Set([9, 12, 18, 21]);
/** how loud a tower's bell is d metres off, 0..1: under the tower a bell, across the town a distant one (it was nearly as loud at 700 m as at 100) */
export const bellLevel = (d) => 1 / (1 + Math.pow(Math.max(0, d) / 110, 1.4));
/** how much of stroke i (0-based) of an hour is heard: the first four in full, three more fading, then no more (twelve strokes is fifteen real seconds of a short game hour) */
export const strokeFade = (i) => (i < 4 ? 1 : Math.max(0, 1 - (i - 3) / 4));
/**
 * The stretch of the shared clock a client's tick must schedule: from where its last tick stopped (S.t) to a little
 * ahead of now (ts, shared seconds; win = seconds since its last tick). -> S.a0, S.a1. Every client covers every
 * second once whatever its frame rate (it looks 1.2 s ahead, so a hiccup of a second loses nothing; a stall of more than 3 s is not
 * caught up: those seconds are gone for that client).
 */
export function sharedWindow(S, ts, win) { const a1 = ts + 0.05 + Math.max(1.2, win); S.a0 = Math.min(a1, Math.max(S.t || 0, a1 - 3, ts + 0.03)); S.a1 = a1; S.t = a1; return S; }
