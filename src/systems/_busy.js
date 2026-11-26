// Busy streets (2026-11, photo comparison item 1: "the city is empty"): shared switches and tables for the parked-car
// rows (vehicles.js), the lanes they narrow (traffic.js), the extra buses and rank taxis (traffic.js), the busier
// daytime pavements of the centre (pedestrians.js) and the far crowd (crowd.js).
// `?busy=0` in the page (GTO_BUSY=0 in node tools) turns the whole pass off for before / after comparisons: parking is
// then as before (kerbside rows only where they left the old lane clear, car parks), no far crowd, no extra walkers,
// buses or taxis.

/** the pass on? read at call time (node tools set GTO_BUSY before importing) */
export function busyOn() {
  try { if (typeof process !== 'undefined' && process.env && process.env.GTO_BUSY !== undefined) return !/^(0|false|off|no)$/i.test(process.env.GTO_BUSY); } catch { /* */ }
  try { const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || ''); if (q.has('busy')) return !/^(0|false|off|no)$/i.test(q.get('busy') || ''); } catch { /* */ }
  return true;
}

// ------------------------------------------------------------------------------------------------ parking (c. 2013)
/** streets beyond the residential / unclassified default where cars really park along the kerb */
export const PARK_NAMED = new Set(['Beaumont Street', 'Walton Street']);
/** no kerbside parking: pedestrianised, double yellow lines all along, or a lane too old and narrow for it */
export const NO_PARK = new Set(['Cornmarket Street', 'Queen Street', 'High Street', "St Aldate's", 'Radcliffe Square', 'Catte Street', 'New College Lane',
  'Brasenose Lane', 'Magpie Lane', 'Blue Boar Street', 'Bear Lane', 'Market Street', 'New Inn Hall Street', "St Michael's Street", 'George Street',
  'Magdalen Street', 'Cornmarket', 'Turl Street', 'Ship Street', 'Queen\'s Lane', 'Merton Street', 'Oriel Square', 'Pembroke Street', 'Gloucester Green',
  'Broad Street', 'Park Town', 'Little Clarendon Street', 'Magdalen Street East']);   // (Park Town: its crescents' ways overlap, a row on one stood in the other's lane)
/** St Giles': echelon bays along both outer kerbs (the carriageways' travel-left sides), north of the Martyrs' Memorial */
// (not along w48343301, the west carriageway from the Martyrs' end to Pusey Street: the traffic narrows a whole lane-graph
// edge to its parked row, and there cyclists must be able to filter up the kerb side past a car left in the lane -
// tools/audit_motion.mjs "parked-car-in-lane" had six bikes queued behind one for minutes)
export const ECHELON = { name: "St Giles'", minZ: -470, maxZ: -40, skip: new Set(['w48343301']), deg: { car_hatch: 35, car_saloon: 30, taxi: 30 } };
/** Broad Street: two rows of pay-and-display bays down the middle of the wide eastern half (painted by world/roads.js) */
export const CENTRE_BAYS = { road: 'w282027362', from: 6, step: 2.5, depth: 4.9 };

// ------------------------------------------------------------------------------------------------ the centre's pavements
/** the pedestrian core: streets whose daytime pavements are crowded (weight = relative density) */
export const CORE_STREETS = {
  'Cornmarket Street': 14, 'Queen Street': 9, 'Broad Street': 2.4, 'High Street': 2.2, 'Market Street': 2.2, 'Carfax': 3, 'George Street': 1.6,
  'Magdalen Street': 1.6, 'Turl Street': 1.2, "St Aldate's": 1.4, 'New Inn Hall Street': 1, 'Ship Street': 0.8, 'Golden Cross': 2, 'Covered Market': 2,
  "St Ebbe's Street": 1, 'Westgate': 1.2, 'Bonn Square': 2, 'Catte Street': 1, 'Radcliffe Square': 1.4, 'Magdalen Street East': 1,
};
/** the pedestrian streets the crowd fills end to end (people per metre of street at the high tier) */
export const STREET_WALK = { 'Cornmarket Street': 0.95, 'Queen Street': 0.65 };
/** the High is only "the core" near Carfax (as far east as the Turl / Queen's), x in game metres */
export const HIGH_MAX_X = 420;
/** rough bounding box of the core (game metres): a cheap first test */
export const CORE_BOX = { minX: -40, maxX: 440, minZ: 20, maxZ: 470 };

/** daytime busyness of the centre's streets by hour (0..1): empty at night, a lunchtime peak, shops shut by 18:30 */
export function busyHour(h) {
  const s = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  if (h < 6) return 0.02;
  const morning = s(7, 10.5, h), lunch = 0.25 * Math.exp(-((h - 13) * (h - 13)) / 2.5), evening = 1 - s(17.5, 21, h);
  return Math.max(0.02, Math.min(1, morning * evening * 0.8 + lunch * morning * evening + 0.04));
}

/**
 * WHO IS THERE does not depend on the graphics tier (2026-11-21): the number of walkers, cars, bikes, buses, taxis and
 * parked cars is the same on every tier — what used to be the 'high' numbers. In multiplayer the street's crowd and
 * traffic are made by whoever looks after that street and sent to the others, so with per-tier numbers the density
 * depended on whose laptop was in charge. A weaker tier may only make them PLAINER (cheaper figures and vehicles, no
 * shadows, a shorter distance at which they are drawn): never fewer, never elsewhere.
 * `?poptier=1` (GTO_POPTIER=1 in node tools) puts the old per-tier numbers back, for before / after measurements only.
 */
export function popTiered() {
  try { if (typeof process !== 'undefined' && process.env && process.env.GTO_POPTIER !== undefined) return /^(1|true|on|yes)$/i.test(process.env.GTO_POPTIER); } catch { /* */ }
  try { const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || ''); if (q.has('poptier')) return /^(1|true|on|yes)$/i.test(q.get('poptier') || ''); } catch { /* */ }
  return false;
}
const OLD = popTiered();
/** the population (every tier): extra ambient walkers in the core by day and how near the camera they may be made (out
 *  of its view), the far crowd's members, the extra bus near the bus streets, the extra cabs on the station rank */
export const POPULATION = { crowd: 760, near: 14, nearMin: 22, buses: 1, rankExtra: 4 };
/** per graphics tier — how it is DRAWN only: the far crowd's reach and where it fades (m: gone inside, whole 2.5 m
 *  further out: crowd.js FADE_W; low: cut there, no fading draw) */
export const BUSY_TIERS = OLD ? {
  low: { crowd: 130, crowdR: 140, fade: 14, noFade: true, near: 0, nearMin: 45, buses: 0, rankExtra: 2 },
  medium: { crowd: 440, crowdR: 200, fade: 8, near: 10, nearMin: 26, buses: 1, rankExtra: 3 },
  high: { crowd: 760, crowdR: 240, fade: 7, near: 14, nearMin: 22, buses: 1, rankExtra: 4 },
} : {
  low: { ...POPULATION, crowdR: 140, fade: 14, noFade: true },
  medium: { ...POPULATION, crowdR: 200, fade: 8 },
  high: { ...POPULATION, crowdR: 240, fade: 7 },
};
export const busyTier = (lvl) => BUSY_TIERS[lvl] || (lvl === 'ultra' ? BUSY_TIERS.high : BUSY_TIERS.low);

/** where a bus about is more likely (the High, St Aldate's, the station forecourt): [x, z, radius] */
export const BUS_SPOTS = [[300, 300, 260], [230, 500, 220], [-640, 190, 260]];
