// The gliding club's airfield — layout constants and the map dressing (pure: no three.js). Shared by
// systems/gliding.js (launch point, winch, homes of the two gliders) and places/gliding_club.js (draws the props).
//
// FICTIONAL PLACEMENT (see docs/research/gliding.md). The nearest real club, the Oxford Gliding Club, flies from RAF
// Weston-on-the-Green, ~13 km north of the centre — far off this map. The game puts a compressed, invented airfield in
// the empty corner north of the East Oxford extension (x 1378…2894, z −1548…−276: inside the map's bounding rectangle,
// outside both data boxes), up a short hedged lane that carries on north from the top of Marston Road. It is ~2.5 km
// from Carfax, so a winch launch puts you within glide of the whole city. The corner becomes a third map box (so the
// player, the minimap / big map, the collider and the pedestrians' bounds all treat it as map); the old boxes and every
// old element of map.json are untouched — the lane, fields, hedges, trees and buildings are appended in preMap.

export const SITE = {
  name: 'Gliding Club',
  box: { minX: 1378.2, maxX: 2894.2, minZ: -1548, maxZ: -266.4 },     // maxZ overlaps the East box by 10 m: an open seam
  lane: [[1676, -294], [1679, -360], [1687, -430], [1700, -500], [1712, -566]],
  gate: [1712, -572],
  field: [[1440, -570], [2860, -570], [2860, -1500], [1440, -1500]],   // hedged boundary (open ring)
  runway: [[1500, -735], [2700, -735], [2700, -785], [1500, -785]],     // the mown strip the launches run along
  carPark: [[1680, -578], [1790, -578], [1790, -628], [1680, -628]],
  clubhouse: [[1612, -580], [1636, -580], [1636, -590], [1612, -590]],
  hangar: [[1800, -580], [1842, -580], [1842, -612], [1800, -612]],
  track: [[1712, -572], [1706, -640], [1680, -700], [1660, -738]],
  launchBus: [1598, -724, Math.PI / 2],      // the launch-point caravan / old bus: x, z, heading
  windsock: [1668, -718],
  winch: [2590, -760],                        // two-drum winch truck at the far (east) end, 950 m from the launch line
  homes: [
    { x: 1640, z: -748, h: Math.PI / 2 },     // glider 0 (red trim)
    { x: 1622, z: -772, h: Math.PI / 2 },     // glider 1 (blue trim)
  ],
  trailers: 6,
};
SITE.centre = [(SITE.field[0][0] + SITE.field[1][0]) / 2, (SITE.field[0][1] + SITE.field[2][1]) / 2];

/** deterministic hash -> [0,1) (no Math.random: everyone sees the same field) */
export function h01(n) { let h = Math.imul((n | 0) ^ 0x5bd1e995, 0x27d4eb2d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }

export const inBox = (x, z, b = SITE.box) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
export const inField = (x, z) => x > SITE.field[0][0] && x < SITE.field[1][0] && z < SITE.field[0][1] && z > SITE.field[2][1];

/**
 * The map dressing (pure, deterministic). Returns {box, roads, areas, barriers, trees, buildings, styles}; appended to
 * game.map in preMap so the world draws, collides and maps them like OSM data. Ids are 'gc*' (never OSM ids).
 */
export function airfieldDressing() {
  const F = SITE.field, gx = SITE.gate[0];
  const roads = [
    { id: 'gc_lane', kind: 'service', w: 5.5, pts: SITE.lane.map((p) => p.slice()), name: 'Airfield Lane', surface: 'asphalt' },
    { id: 'gc_track', kind: 'track', w: 3.2, pts: SITE.track.map((p) => p.slice()), surface: 'gravel' },
  ];
  const areas = [
    { id: 'gc_field', kind: 'grass', poly: F.map((p) => p.slice()) },
    // two mown strips 18 m wide (one per launch line), rougher grass between and round them
    { id: 'gc_runway', kind: 'pitch', sport: 'gliding', surface: 'grass', poly: [[1500, -739], [2700, -739], [2700, -757], [1500, -757]] },
    { id: 'gc_runway2', kind: 'pitch', sport: 'gliding', surface: 'grass', poly: [[1500, -763], [2700, -763], [2700, -781], [1500, -781]] },
    { id: 'gc_carpark', kind: 'parking', surface: 'gravel', poly: SITE.carPark.map((p) => p.slice()) },
  ];
  // farmland round the field: four meadows
  const B = SITE.box;
  areas.push(
    { id: 'gc_farm_w', kind: 'meadow', poly: [[B.minX + 2, -560], [1430, -560], [1430, -1520], [B.minX + 2, -1520]] },
    { id: 'gc_farm_n', kind: 'meadow', poly: [[1430, -1510], [2880, -1510], [2880, -1545], [1430, -1545]] },
    { id: 'gc_farm_e', kind: 'meadow', poly: [[2870, -560], [2890, -560], [2890, -1510], [2870, -1510]] },
    { id: 'gc_farm_s', kind: 'meadow', poly: [[1730, -290], [2880, -290], [2880, -560], [1730, -560]] },
  );
  // hedges: the field boundary with a gap at the gate, both sides of the lane, a farm hedge or two
  const gap = 5;
  const barriers = [
    { id: 'gc_hedge_s1', kind: 'hedge', h: 1.9, pts: [[F[0][0], F[0][1]], [gx - gap, F[0][1]]] },
    { id: 'gc_hedge_s2', kind: 'hedge', h: 1.9, pts: [[gx + gap, F[1][1]], [F[1][0], F[1][1]]] },
    { id: 'gc_hedge_e', kind: 'hedge', h: 1.9, pts: [[F[1][0], F[1][1]], [F[2][0], F[2][1]]] },
    { id: 'gc_hedge_n', kind: 'hedge', h: 1.9, pts: [[F[2][0], F[2][1]], [F[3][0], F[3][1]]] },
    { id: 'gc_hedge_w', kind: 'hedge', h: 1.9, pts: [[F[3][0], F[3][1]], [F[0][0], F[0][1]]] },
  ];
  const off = (pts, d) => pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / l) * d, p[1] + (dx / l) * d];
  });
  const laneIn = SITE.lane.slice(1, -1).concat([[SITE.lane[SITE.lane.length - 1][0], SITE.lane[SITE.lane.length - 1][1] + 4]]);
  barriers.push({ id: 'gc_hedge_lane_w', kind: 'hedge', h: 1.8, pts: off([SITE.lane[0].map((v, i) => v + (i ? -12 : 0)), ...laneIn], -4.6) });
  barriers.push({ id: 'gc_hedge_lane_e', kind: 'hedge', h: 1.8, pts: off([SITE.lane[0].map((v, i) => v + (i ? -12 : 0)), ...laneIn], 4.6) });
  barriers.push({ id: 'gc_hedge_farm', kind: 'hedge', h: 1.7, pts: [[1730, -566], [1730, -300]] });
  // hedgerow trees (oak / ash): every ~45 m along the boundary hedge, about half the slots filled; a copse by the hangar
  const trees = [];
  let n = 0;
  const along = (a, b, step, chance, hMin, hMax) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = step / 2; s < L; s += step) {
      n++;
      if (h01(n * 7 + 1) > chance) continue;
      const t = s / L, j = (h01(n * 7 + 2) - 0.5) * 3;
      trees.push([+(a[0] + (b[0] - a[0]) * t + j).toFixed(1), +(a[1] + (b[1] - a[1]) * t + j).toFixed(1), +(hMin + (hMax - hMin) * h01(n * 7 + 3)).toFixed(1)]);
    }
  };
  for (let i = 0; i < 4; i++) {
    const a = F[i], b = F[(i + 1) % 4];
    along(a, b, 46, 0.5, 9, 17);
  }
  along([1650, -300], [1690, -560], 30, 0.6, 8, 14);
  for (let i = 0; i < 9; i++) trees.push([+(1870 + h01(900 + i) * 40).toFixed(1), +(-585 - h01(950 + i) * 25).toFixed(1), +(10 + h01(990 + i) * 7).toFixed(1)]);
  // keep trees off the gate, the lane and the runway approaches
  const clear = (t) => Math.hypot(t[0] - gx, t[1] - SITE.gate[1]) > 14 && !(t[0] > 1650 && t[0] < 1730 && t[1] > -575 && t[1] < -280);
  const poly = (p, h, tags) => ({ h, poly: p.map((q) => q.slice()), c: [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length], tags });
  const buildings = [
    { id: 'gc_hangar', ...poly(SITE.hangar, 8.5, { building: 'hangar', 'roof:shape': 'gabled', 'building:material': 'metal' }) },
    { id: 'gc_clubhouse', ...poly(SITE.clubhouse, 3.6, { building: 'yes', 'roof:shape': 'flat', name: 'Clubhouse' }) },
  ];
  const styles = new Map([
    ['gc_hangar', { wall: 'concrete', roof: 'flat', color: '#9aa39b', ground: 'garageDoor', up: 'darkMetal' }],
    ['gc_clubhouse', { wall: 'timber', roof: 'flat', color: '#c9c2a6' }],
  ]);
  return { box: { ...SITE.box }, roads, areas, barriers, trees: trees.filter(clear), buildings, styles };
}

/** Append the dressing to a map (idempotent). Returns the dressing. */
export function dressMap(map, overrides) {
  if (map._gliding) return map._gliding;
  const d = airfieldDressing();
  if (map.boxes) map.boxes.push(d.box);
  map.roads.push(...d.roads); map.areas.push(...d.areas); map.barriers.push(...d.barriers);
  map.trees.push(...d.trees); map.buildings.push(...d.buildings);
  if (overrides && overrides.style) for (const [k, v] of d.styles) if (!overrides.style.has(k)) overrides.style.set(k, v);
  map.sites = map.sites || [];
  map.sites.push({ id: 'gc_site', name: SITE.name, kind: 'airfield', poly: SITE.field.map((p) => p.slice()), c: SITE.centre.slice() });
  Object.defineProperty(map, '_gliding', { value: d, enumerable: false });
  return d;
}
