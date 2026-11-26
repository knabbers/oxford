// Pure (DOM-free, three-free) rules for the wanted level: heat values, star thresholds, decay, fines, the response per
// star level and graphics tier, and the "busted" timer. Used by systems/police.js; covered by tools/smoke_police.mjs.

/** Heat at which each star level starts (index = stars). Heat is capped at MAX_HEAT. */
export const LEVELS = [0, 10, 35, 75, 125, 185];
export const MAX_HEAT = 230;

/**
 * Heat per offence (one-off) or per second (`…PerS`, continuous while it lasts). Witness rule: an offence only counts if
 * someone could plausibly have seen it: a pedestrian, a driver or the police within WITNESS_R m. Police witnesses ×1.5.
 */
export const HEAT = {
  take: { car_hatch: 14, car_saloon: 14, taxi: 16, van: 14, bus: 40, bike: 6 },   // taking a vehicle from its driver
  knockCar: 18, knockBike: 5,             // hitting a pedestrian (they tumble and get up)
  hitVehicle: 7, hitPolice: 24,           // shunting a car (+ impact m/s × 0.5); a police car: much worse
  hitFurniture: 2,                        // walls, bollards, parked cars at > 5 m/s
  pavementPerS: 4,                        // car/van/bus wheels on the pavement or a pedestrian street
  quadPerS: 9, quadBikePerS: 1.2,         // in a college quad (car / bike)
  cricketPerS: 12, cricketBikePerS: 4,    // on the University Parks cricket square
  parksCyclePerS: 0.35, parksCycleCap: 12, // cycling in University Parks (no-cycling signs): tiny, never past 1 star
  speedingNearPolice: 5,                  // > 17 m/s within 35 m of police, once per 10 s
  tussle: 6,                              // wrestling a car's owner for it
};
export const WITNESS_R = 40;
/** Offences the Proctors care about (university discipline rather than the police). */
export const UNIV = new Set(['take_bike', 'knock_bike', 'quad_bike', 'cricket_bike', 'parks_cycle', 'cricket', 'quad']);

export function levelFor(heat) {
  let l = 0;
  for (let i = 1; i < LEVELS.length; i++) if (heat >= LEVELS[i]) l = i;
  return l;
}

/** Decay per second out of police sight (after GRACE s): base, ×CHANGED after changing vehicle unseen, ×INDOORS inside. */
export const DECAY = { grace: 3, base: 2.5, changed: 2.5, indoors: 4, changedFor: 25 };

export class Wanted {
  constructor() { this.reset(); }
  reset() { this.heat = 0; this.univ = 0; this.unseenT = 0; this.changedT = 0; this.peak = 0; this.parks = 0; this.last = null; }
  get level() { return levelFor(this.heat); }
  /** fraction of the current heat that came from university offences (Proctors at low levels) */
  get univFrac() { return this.heat > 0 ? Math.min(1, this.univ / this.heat) : 0; }
  /**
   * Add heat for offence `src` (a key of HEAT-ish names, used for the UNIV check). `seen`: 0 nobody saw, 1 witness, 1.5 police.
   * Returns the heat actually added.
   */
  add(src, amount, seen = 1) {
    if (!(amount > 0) || !(seen > 0)) return 0;
    let a = amount * seen;
    if (src === 'parks_cycle') {
      // never more than parksCycleCap from this source, and it never pushes the total past the cap on its own
      a = Math.min(a, Math.max(0, HEAT.parksCycleCap - this.parks), Math.max(0, HEAT.parksCycleCap - this.heat));
      this.parks += a;
    }
    if (a <= 0) return 0;
    const before = this.heat;
    this.heat = Math.min(MAX_HEAT, this.heat + a);
    const added = this.heat - before;
    if (UNIV.has(src)) this.univ += added;
    this.peak = Math.max(this.peak, this.level);
    this.last = src;
    return added;
  }
  /** Vehicle changed while unseen: decay faster for a while. */
  changedVehicle() { if (this.heat > 0) this.changedT = DECAY.changedFor; }
  /** o = {inSight, indoors}. Returns the level after the tick. */
  tick(dt, o = {}) {
    if (this.changedT > 0) this.changedT = Math.max(0, this.changedT - dt);
    if (this.heat <= 0) { this.heat = 0; this.univ = 0; this.parks = 0; this.unseenT = 0; this.peak = 0; return 0; }
    if (o.inSight && !o.indoors) { this.unseenT = 0; return this.level; }
    this.unseenT += dt;
    if (this.unseenT < DECAY.grace && !o.indoors) return this.level;
    let r = DECAY.base;
    if (this.changedT > 0) r *= DECAY.changed;
    if (o.indoors) r *= DECAY.indoors;
    const k = Math.max(0, this.heat - r * dt) / this.heat;
    this.heat *= k; this.univ *= k; this.parks *= k;
    if (this.heat < 0.05) this.reset();
    return this.level;
  }
}

/** Fine on being busted, 2013-ish pounds. The Proctors charge a flat university fine. The early game is forgiving and the
 *  stakes rise with the stars (2026-11 play pass: a new player's first mistake used to cost £40 of a £20 wallet): the first
 *  time a save is nicked at one or two stars it is a caution (£0; pass `priors` = busts so far), one and two stars are
 *  small fines, three and up are what they always were. */
export const FINES = [0, 15, 45, 160, 260, 400];
export const PROCTORS_FINE = 25;
export function fineFor(level, proctors = false, priors = Infinity) {
  const l = Math.max(0, Math.min(5, level | 0));
  if (priors === 0 && l <= 2) return 0;
  return proctors ? PROCTORS_FINE : FINES[l];
}
/** Busted by the Proctors rather than the police: low level and mostly university offences. */
export function isProctors(level, univFrac) { return level <= 1 && univFrac >= 0.5; }
/** What you actually pay: never more than you have (game.pay never goes below £0); `gentle` (the police at one or two
 *  stars): never more than half of what you have either, so a small mistake cannot empty the wallet. */
export function charge(money, fine, gentle = false) {
  const cap = gentle ? Math.floor(Math.max(0, money) * 50) / 100 : money;
  return Math.max(0, Math.min(cap, fine));
}

/**
 * Police response per star level and tier. foot = officers on foot (level 1: a PCSO/constable walks over, or a bike
 * officer), cars = pursuing patrol cars, vans, roadblock = cars per road block (0 = none), blocks = road blocks at once, heli.
 */
export const RESPONSE = {
  low: [null, { foot: 1, bike: 0.3 }, { cars: 1 }, { cars: 2 }, { cars: 2, vans: 1, roadblock: 1, blocks: 1 }, { cars: 2, vans: 1, roadblock: 1, blocks: 1, heli: 1 }],
  medium: [null, { foot: 1, bike: 0.35 }, { cars: 1 }, { cars: 2 }, { cars: 2, vans: 1, roadblock: 2, blocks: 1 }, { cars: 2, vans: 1, roadblock: 1, blocks: 1, heli: 1 }],
  high: [null, { foot: 1, bike: 0.4 }, { cars: 1, foot: 1 }, { cars: 2, foot: 1 }, { cars: 3, vans: 1, roadblock: 2, blocks: 1 }, { cars: 3, vans: 1, roadblock: 2, blocks: 2, heli: 1 }],
};
export function response(level, tier = 'medium') {
  const T = RESPONSE[tier] || RESPONSE.medium, r = T[Math.max(0, Math.min(5, level | 0))] || {};
  return { foot: r.foot || 0, bike: r.bike || 0, cars: r.cars || 0, vans: r.vans || 0, roadblock: r.roadblock || 0, blocks: r.blocks || 0, heli: r.heli || 0 };
}

/** Busted when stopped with police close for bustTime(level) s; the timer drains at BUST.drain/s otherwise. One star
 *  gives you longer (time1): a PCSO used to nick a new player in a just-taken cab while they were still reading the keys. */
export const BUST = { time: 3, time1: 5.5, drain: 1.5, stopV: 0.8, footR: 2.3, carR: 3.6 };
export const bustTime = (level) => (level <= 1 ? BUST.time1 : BUST.time);
export function bustTick(t, dt, stopped, near) {
  if (stopped && near) return t + dt;
  return Math.max(0, t - BUST.drain * dt);
}
