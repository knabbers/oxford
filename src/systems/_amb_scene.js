// Where the fixed sounds of the town are — PURE (no DOM, no three, no audio). systems/ambience.js asks this for what
// is near the listener; _amb_synth.js makes the sound.
//   buildScene(map)                       the emitters (weirs, fountains, pubs, cafés, clubs, flagpoles) and the trees
//                                         (a 48 m hash: a bird sings from a real tree)
//   nearest(S, x, z, hour, out, n)        the n emitters that would be loudest here and now -> out[i] = {e, d, g}
//   pickTree(S, x, z, r0, r1, rnd, out)   a tree between r0 and r1 metres away -> out[0], out[1] (false: none there)
// Positions: map points of interest (the game's map of c. 2013), plus a few by hand (GUESSED to a few metres).
// range = metres at which it is no longer heard; ref = metres at which it is at half level.
export const KINDS = {
  weir: { range: 190, ref: 26 },
  lock: { range: 45, ref: 6 },
  fountain: { range: 34, ref: 5 },
  pub: { range: 17, ref: 4 },
  cafe: { range: 10, ref: 3 },
  club: { range: 46, ref: 8 },
  flag: { range: 32, ref: 8 },
  yard: { range: 42, ref: 9 },          // people at tables in the open: a pub's courtyard
  kids: { range: 130, ref: 28 },        // a playground
  market: { range: 70, ref: 14 },       // an open-air market on its days
  idle: { range: 140, ref: 20 },        // diesel units standing at the platforms
  coach: { range: 75, ref: 11 },        // coaches standing with their engines running
};
// by hand: Osney weir and lock (places/_d2_osney.js), Mercury in Tom Quad (places/_chch_tomquad.js), the weir and punt
// rollers at the foot of the Parks and the Castle Mill Stream sluice (GUESSED positions, snapped to the mapped water)
const BY_HAND = [
  { kind: 'weir', x: -856, z: 606, name: 'Osney weir' },
  { kind: 'lock', x: -822, z: 640, name: 'Osney Lock' },
  { kind: 'fountain', x: 284.2, z: 526.8, name: 'Mercury' },
  { kind: 'weir', x: 760, z: -560, name: 'the Parks weir and rollers', snap: 160, level: 0.6 },
  { kind: 'lock', x: -250, z: 345, name: 'Castle Mill Stream sluice', snap: 60, level: 1.4 },
  { kind: 'yard', x: 478, z: 22, name: 'the Turf Tavern courtyard' },                      // (GUESS to a few metres: by its sign in Bath Place)
  { kind: 'idle', x: -716, z: 181, name: 'Oxford station, the platforms' },               // places/_cw_station.js L(60, -3)
  { kind: 'coach', x: -171, z: 105, name: 'Gloucester Green coach station' },             // the mapped bays
  { kind: 'market', x: -128, z: 108, name: 'Gloucester Green market' },                   // (GUESS: the square east of the bays; Wednesdays and Saturdays here)
];
// Things that happen at a place now and then (ambience.js fires them from there). voice = a method of the synthesiser;
// rate = a second at its busiest; h = [from, to] hours; range / ref as above. cond: 'dry' no rain, 'light' daylight,
// 'rut' the fallow rut (the first two thirds of the term), 'match' Wednesday and Saturday afternoons, 'service' evensong days.
// Positions from the place modules; what is heard there is from general knowledge of Oxford, and marked GUESS where it is one.
export const SITES = [
  { voice: 'tannoy', x: -705, z: 186, range: 150, ref: 25, rate: 0.022, h: [5.8, 23.5], name: 'the station PA (indistinct)' },
  { voice: 'oars', x: 505, z: 1180, range: 170, ref: 30, rate: 0.022, h: [6.3, 18.5], cond: 'light', name: 'crews on the Isis by the boathouses' },
  { voice: 'oars', x: 253, z: 962, range: 120, ref: 25, rate: 0.012, h: [6.3, 18.5], cond: 'light', name: 'a crew going under Folly Bridge' },
  { voice: 'pole', x: 932, z: 396, range: 60, ref: 12, rate: 0.03, h: [10, 18.5], cond: 'dry', name: 'punts at Magdalen Bridge' },
  { voice: 'moo', x: -1030, z: -1100, range: 520, ref: 90, rate: 0.016, h: [5.5, 21], name: 'the cattle on Port Meadow' },
  { voice: 'whinny', x: -1060, z: -1250, range: 420, ref: 70, rate: 0.008, h: [6, 20], name: 'the horses on Port Meadow' },
  { voice: 'moo', x: 560, z: 770, range: 300, ref: 60, rate: 0.009, h: [6, 20], name: 'the longhorns in Christ Church Meadow' },
  { voice: 'crow', x: 600, z: 690, range: 260, ref: 50, rate: 0.03, h: [6, 19.5], cond: 'light', name: 'rooks in the Meadow elms (GUESS)' },
  { voice: 'deer', x: 900, z: 120, range: 190, ref: 40, rate: 0.014, h: [16, 32], cond: 'rut', name: 'the fallow bucks groaning in Magdalen Grove (October, November)' },
  { voice: 'practice', x: 270, z: 695, range: 55, ref: 9, rate: 0.045, h: [9, 21.5], name: 'someone practising in the Faculty of Music' },
  { voice: 'practice', x: -318, z: 34, range: 40, ref: 8, rate: 0.02, h: [10, 21], name: 'a practice room in Worcester (GUESSED position)' },
  { voice: 'organ', x: -302, z: -12, range: 60, ref: 10, rate: 0.008, h: [14, 17.6], service: 0.06, name: 'the organ in Worcester chapel' },
  { voice: 'organ', x: 918, z: 330, range: 70, ref: 12, rate: 0.006, h: [14, 17.6], service: 0.05, name: 'the organ in Magdalen chapel' },
  { voice: 'organ', x: 592, z: 92, range: 70, ref: 12, rate: 0.006, h: [14, 17.6], service: 0.05, name: 'the organ in New College chapel' },
  { voice: 'organ', x: 332, z: 562, range: 80, ref: 14, rate: 0.006, h: [14, 17.6], service: 0.05, name: 'the organ in the cathedral' },
  { voice: 'organ', x: 548, z: 388, range: 60, ref: 10, rate: 0.005, h: [14, 17.6], service: 0.05, name: 'the organ in Merton chapel' },
];
const PT = [100, 225];                 // the Purple Turtle has its own sound through its own wall (places/_pt_audio.js)
const CELL = 48;

/** how busy a place of this kind is at this hour, 0..1 */
export function hours(kind, h, day = 0) {
  const tri = (a, p, b) => (h <= a || h >= b ? 0 : h < p ? (h - a) / (p - a) : (b - h) / (b - p));
  if (kind === 'pub') return h >= 11 && h < 23.6 ? 0.35 + 0.65 * Math.max(tri(11.5, 13, 14.5) * 0.6, tri(16.5, 21, 23.7)) : 0;
  if (kind === 'cafe') return h >= 7.8 && h < 18 ? 0.5 + 0.5 * Math.max(tri(7.8, 9, 11), tri(11.5, 13, 15)) : 0;
  if (kind === 'club') return h >= 22.3 || h < 2.9 ? 1 : 0;
  if (kind === 'yard') return h >= 11 && h < 23.3 ? 0.4 + 0.6 * Math.max(tri(11.5, 13, 14.5) * 0.7, tri(16.5, 20.5, 23.3)) : 0;
  if (kind === 'kids') return h >= 8.6 && h < 17.2 ? 0.35 + 0.65 * Math.max(tri(10, 10.6, 11.2), tri(12, 12.7, 13.4), tri(15.2, 16, 17)) : 0;
  if (kind === 'market') { const wd = (((day | 0) % 7) + 7) % 7; return (wd === 2 || wd === 5) && h >= 9 && h < 16.5 ? 0.6 + 0.4 * tri(9.5, 12.5, 16) : 0; }
  if (kind === 'idle') return h >= 5.5 || h < 0.5 ? 0.8 : 0;
  if (kind === 'coach') return h >= 5.5 && h < 23.8 ? 0.8 : 0.25;
  return 1;
}

export function buildScene(map) {
  const b = map.bounds, nx = Math.ceil((b.maxX - b.minX) / CELL) + 1, nz = Math.ceil((b.maxZ - b.minZ) / CELL) + 1;
  const S = { cell: CELL, nx, nz, minX: b.minX, minZ: b.minZ, em: [], trees: map.trees || [], tcell: new Array(nx * nz), _pick: new Int32Array(96) };
  const ci = (x, z) => { const i = Math.floor((x - b.minX) / CELL), k = Math.floor((z - b.minZ) / CELL); return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : k * nx + i; };
  S.ci = ci;
  S.trees.forEach((t, i) => { const j = ci(t[0], t[1]); if (j >= 0) (S.tcell[j] || (S.tcell[j] = [])).push(i); });
  const add = (kind, x, z, name, level = 1) => S.em.push({ kind, x, z, name: name || '', level, K: KINDS[kind], id: S.em.length });
  for (const p of map.pois || []) {
    const k = p.kind, x = p.p[0], z = p.p[1];
    if (k === 'fountain') { if (Math.hypot(x - 284.2, z - 526.8) > 25) add('fountain', x, z, p.name, 0.8); }
    else if (k === 'pub' || k === 'bar') add('pub', x, z, p.name, k === 'bar' ? 0.8 : 1);
    else if (k === 'nightclub' || k === 'music_venue') { if (Math.hypot(x - PT[0], z - PT[1]) > 70) add('club', x, z, p.name); }
    else if (k === 'cafe') add('cafe', x, z, p.name);
    else if (k === 'flagpole') add('flag', x, z, p.name);
    else if (k === 'playground') add('kids', x, z, p.name);
  }
  // by hand; `snap`: moved onto the nearest mapped river / stream within that many metres (dropped when there is none)
  for (const e of BY_HAND) {
    let x = e.x, z = e.z;
    if (e.snap) {
      let best = e.snap;
      for (const w of map.waterlines || []) { if (w.tunnel || (w.kind !== 'river' && w.kind !== 'stream' && w.kind !== 'canal')) continue; for (const q of w.pts) { const d = Math.hypot(q[0] - e.x, q[1] - e.z); if (d < best) { best = d; x = q[0]; z = q[1]; } } }
      if (best >= e.snap) continue;
    }
    add(e.kind, x, z, e.name, e.level || 1);
  }
  // the things that happen at places, and a shout from the bigger pitches on match afternoons
  S.sites = SITES.slice();
  for (const a of map.areas || []) {
    if (a.kind !== 'pitch') continue;
    let ar = 0, cx = 0, cz = 0; const P = a.poly; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { ar += P[j][0] * P[i][1] - P[i][0] * P[j][1]; cx += P[i][0]; cz += P[i][1]; }
    if (Math.abs(ar) / 2 > 3500) S.sites.push({ voice: 'cheer', x: cx / P.length, z: cz / P.length, range: 260, ref: 45, rate: 0.02, h: [13.8, 16.6], cond: 'match', name: 'a match on a college pitch' });
  }
  return S;
}
/**
 * The emitters heard at (x, z) at `hour`, loudest first: out[i] = {e, d (m), g (0..1: its level here)} for i < the
 * count returned (at most n; out's records are reused). Nothing is allocated.
 */
export function nearest(S, x, z, hour, out, n = 3, skip = null, day = 0) {
  let c = 0;
  for (let i = 0; i < S.em.length; i++) {
    const e = S.em[i], K = e.K, dx = e.x - x, dz = e.z - z;
    if (dx > K.range || dx < -K.range || dz > K.range || dz < -K.range || e.kind === skip) continue;
    const d = Math.hypot(dx, dz); if (d >= K.range) continue;
    const hk = hours(e.kind, hour, day); if (hk <= 0) continue;
    const g = e.level * hk * (K.ref / (K.ref + d)) * Math.min(1, (1 - d / K.range) * 3);
    let j;
    if (c < n) j = c++; else if (g > out[n - 1].g) j = n - 1; else continue;
    const o = out[j]; o.e = e; o.d = d; o.g = g;
    while (j > 0 && out[j - 1].g < g) { out[j] = out[j - 1]; out[j - 1] = o; j--; }
  }
  for (let i = c; i < out.length; i++) { out[i].e = null; out[i].g = 0; }
  return c;
}
/** a tree between r0 and r1 metres from (x, z), any of them equally: out[0] = x, out[1] = z, out[2] = height -> true; none there -> false */
export function pickTree(S, x, z, r0, r1, rnd, out) {
  const P = S._pick, c = S.cell, i0 = Math.floor((x - r1 - S.minX) / c), i1 = Math.floor((x + r1 - S.minX) / c), k0 = Math.floor((z - r1 - S.minZ) / c), k1 = Math.floor((z + r1 - S.minZ) / c);
  let n = 0, seen = 0;
  for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
    if (i < 0 || k < 0 || i >= S.nx || k >= S.nz) continue;
    const L = S.tcell[k * S.nx + i]; if (!L) continue;
    for (let q = 0; q < L.length; q++) {
      const t = S.trees[L[q]], d = Math.hypot(t[0] - x, t[1] - z); if (d < r0 || d > r1) continue;
      seen++;
      if (n < P.length) P[n++] = L[q]; else { const j = Math.floor(rnd() * seen); if (j < P.length) P[j] = L[q]; }      // (reservoir: any tree equally)
    }
  }
  if (!n) return false;
  const t = S.trees[P[Math.floor(rnd() * n) % n]]; out[0] = t[0]; out[1] = t[1]; out[2] = t[2] || 8;
  return true;
}
