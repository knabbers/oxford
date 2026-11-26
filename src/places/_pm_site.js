// Port Meadow — layout and the pure rules (no three.js, no DOM): used by places/port_meadow.js, _pm_*.js and
// tools/smoke_portmeadow.mjs. See docs/research/north_west_and_broad.md for what is known and what is guessed.
//
// COMPRESSED GEOGRAPHY (flagged guess). The real meadow is ~2.5 km long and up to ~1 km wide, from the Walton Well Road
// entrance (south-east corner) up to Wolvercote; the map data stops at x = -896, just west of the railway bridge at
// the end of Walton Well Road. The base ground is already drawn 300 m beyond the map's bounds, so the meadow is put in
// that strip: a new map box x -1190…-886, z -1835…-660 (300 m × 1.2 km), appended in preMap like the gliding club's.
// The Thames runs down its west side (shifted east from its real line ~400 m further west), from the mapped junction
// with the Castle Mill Stream (-1144.6, -669.5) northwards. map.bounds is NOT changed (every raster keeps its origin):
// outside the bounds the pedestrians' wet mask is empty and groundHeight is the base ground (0), which is right here —
// the meadow is flat and nothing walks in it but the animals and players.
export const BOX = { minX: -1190, maxX: -886, minZ: -1835, maxZ: -660 };
export const SURF_Y = 0.035;        // water line (world.Y.water)

// the river centre line, south to north, and its width (m). The upper Thames here is ~30-40 m wide.
export const RIVER = {
  w: 32,
  pts: [[-1146, -666], [-1153, -720], [-1157, -790], [-1151, -860], [-1160, -960], [-1153, -1070], [-1164, -1190], [-1156, -1320],
    [-1166, -1450], [-1158, -1590], [-1167, -1720], [-1162, -1860]],
};
// the meadow (grazed common) as one open ring: river bank (west), the Castle Mill Stream (south), the railway fence (east)
export const MEADOW = [[-1130, -800], [-1050, -742], [-985, -790], [-952, -800], [-950, -872], [-911, -874], [-911, -1822],
  [-1143, -1822], [-1144, -1450], [-1141, -1200], [-1131, -960], [-1129, -860]];
// Walton Well Road: the mapped road ends at (-899.1, -841) at the west end of the railway over-bridge
export const ROAD_END = [-899.1, -841];
export const CAR_PARK = [[-946, -842], [-904, -842], [-904, -862], [-946, -862]];
export const GATE = { x: -924, z: -866, w: 3.4 };            // the field gate (and a kissing gate beside it)
export const FENCE = [[-906, -1825], [-906, -866], [-948, -866], [-948, -800]];   // post-and-rail along the railway, round the car park
// the "white pebble path" from the gate towards the river and the footbridge, then the Thames Path north along the bank
export const PATH = [[-924, -868], [-962, -880], [-1012, -866], [-1066, -838], [-1108, -812], [-1135, -796]];
export const BRIDGE = { z: -796, x0: -1182, x1: -1131, w: 2.4, arch: 3.2 };   // Medley-style bowstring footbridge (deck flat)
export const BOARD = [-930, -872];                             // the notice board inside the gate
// low ground near the river that floods first (open rings)
export const FLOODS = [
  [[-1132, -880], [-1080, -900], [-1050, -980], [-1070, -1060], [-1130, -1080], [-1136, -980]],
  [[-1140, -1230], [-1090, -1215], [-1040, -1280], [-1030, -1380], [-1080, -1440], [-1142, -1420]],
  [[-1144, -1560], [-1100, -1550], [-1060, -1610], [-1090, -1700], [-1145, -1700]],
];

import { HOUR_MS, DAY_MS } from '../core/time.js'; export { HOUR_MS, DAY_MS };
/** integer hash -> [0,1) */
export function h01(a, b = 0) {
  let h = Math.imul((a | 0) ^ 0x6c8e9cf5, 0x85ebca6b) ^ Math.imul((b | 0) + 0x3c6ef372, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const gameDay = (ms) => Math.floor(ms / DAY_MS);
/**
 * Flooding on the shared clock: about one game day in four the low ground by the river is under shallow water. The
 * level comes up over the first game hours of the day and goes down over the last ones (0..1). Same for everyone.
 */
export function floodLevel(ms) {
  const d = gameDay(ms);
  if (h01(d, 41) >= 0.27) return 0;
  const hr = (ms - d * DAY_MS) / HOUR_MS;
  const up = Math.min(1, hr / 3), down = Math.min(1, (24 - hr) / 3);
  return Math.max(0, Math.min(up, down)) * (0.7 + 0.3 * h01(d, 43));
}

export function pointInPoly(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < ((P[j][0] - P[i][0]) * (z - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; }
function dseg(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - ax - dx * t, z - az - dz * t); }
export function distToLine(x, z, P) { let d = Infinity; for (let i = 0; i < P.length - 1; i++) d = Math.min(d, dseg(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1])); return d; }
/** is (x, z) in the river (within its half width of the centre line, inside the box's z range) */
export const inRiver = (x, z) => distToLine(x, z, RIVER.pts) < RIVER.w / 2;
/** river centre x at z (linear between points) */
export function riverX(z) {
  const P = RIVER.pts;
  for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if ((z <= a[1] && z >= b[1]) || (z >= a[1] && z <= b[1])) { const t = (z - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * t; } }
  return P[P.length - 1][0];
}
export const inFlood = (x, z) => FLOODS.some((F) => pointInPoly(x, z, F));

/** preMap: add the box (idempotent). Nothing else of the map changes: everything else is drawn by the module. */
export function dressMap(map) {
  if (map._portMeadow) return map._portMeadow;
  const box = { ...BOX };
  if (map.boxes) map.boxes.push(box);
  map.sites = map.sites || [];
  map.sites.push({ id: 'pm_site', name: 'Port Meadow', kind: 'common', poly: MEADOW.map((p) => p.slice()), c: [-1030, -1300] });
  Object.defineProperty(map, '_portMeadow', { value: { box }, enumerable: false });
  return map._portMeadow;
}

// ---------------------------------------------------------------- geese and ducks (pure functions of the shared clock)
/** two flocks of geese: centre wanders between anchors every 5 minutes; each goose has a hashed spot round it */
export const GEESE = { flocks: 2, per: 13 };
const GOOSE_ANCHORS = [[[-1040, -900], [-1090, -1010], [-1020, -1100], [-980, -960]], [[-1060, -1400], [-1110, -1520], [-1010, -1600], [-990, -1450]]];
const sm = (t) => t * t * (3 - 2 * t);
export function gooseAt(f, i, ms, out = {}) {
  const A = GOOSE_ANCHORS[f], B = 300000, k = Math.floor(ms / B), t = ms / B - k, e = sm(Math.min(1, Math.max(0, (t - 0.1) / 0.5)));
  const a = A[((k % 4) + 4) % 4], b = A[(((k + 1) % 4) + 4) % 4];
  const cx = a[0] + (b[0] - a[0]) * e, cz = a[1] + (b[1] - a[1]) * e;
  const r = 2 + 9 * Math.sqrt(h01(f * 100 + i, 7)), th = 6.2831853 * h01(f * 100 + i, 9) + 0.3 * Math.sin(ms / 23000 + i);
  const walking = e > 0.02 && e < 0.98;
  out.x = cx + Math.cos(th) * r; out.z = cz + Math.sin(th) * r;
  out.h = walking ? Math.atan2(b[0] - a[0], b[1] - a[1]) : 6.2831853 * h01(f * 100 + i, Math.floor(ms / 20000)) ;
  out.graze = walking ? 0 : (Math.sin(ms / 1700 + i * 1.3) > 0 ? 1 : 0.3);
  out.walk = walking ? 1 : 0;
  return out;
}
/** ducks paddling along the river: each drifts up and down a stretch of the east half of the channel */
export const DUCKS = 9;
export function duckAt(i, ms, out = {}) {
  const z0 = -800 - 1000 * h01(i, 3), span = 40 + 60 * h01(i, 5), per = 90000 + 60000 * h01(i, 6);
  const s = Math.sin((ms / per) * 6.2831853 + i), z = z0 + span * s;
  const off = (RIVER.w / 2 - 3) * (0.2 + 0.7 * h01(i, 8)) * (h01(i, 10) < 0.6 ? 1 : -1);
  out.x = riverX(z) + off; out.z = z; out.h = Math.cos((ms / per) * 6.2831853 + i) > 0 ? Math.PI : 0;
  return out;
}

export const SIGHTS = [
  { id: 'port-meadow', name: 'Port Meadow', x: -1030, z: -1100, blurb: 'Common grazing by the Thames, never ploughed: the freemen\'s right to graze here is in the Domesday Book.' },
  { id: 'walton-well-gate', name: 'Walton Well gate', x: GATE.x, z: GATE.z, blurb: 'The way in from Jericho: over the railway, through the gate, on to the white pebble path.' },
  { id: 'medley-footbridge', name: 'The footbridge at Medley', x: (BRIDGE.x0 + BRIDGE.x1) / 2, z: BRIDGE.z, blurb: 'A white iron bowstring bridge over the Thames, like the one at Medley (1865).' },
  { id: 'thames-port-meadow', name: 'The Thames at Port Meadow', x: -1150, z: -1300, blurb: 'The upper Thames, the Isis to rowers: swimmers, sailing dinghies and geese.' },
];
