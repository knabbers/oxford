// Supermarkets (Tesco / Sainsbury's, central Oxford c. 2013): pure data + rules. No DOM, no three.js, so
// tools/smoke_supermarkets.mjs can test it headless.
//   PRODUCTS      catalogue (c. 2013 prices; `src` says whether a price is sourced or estimated)
//   BRANCHES      the four branches that existed in 2013 (hours, world positions of their frontages)
//   Basket        running total, meal-deal pricing, alcohol rules
//   hours / bans  isOpen(), weekday(), alcoholAllowed()
//   createScan()  the self-checkout minigame state machine (wobbling item vs scanner, "unexpected item" stalls)

import { DAY_MS } from '../core/time.js'; export { DAY_MS };           // one game day
export const MEAL_DEAL_PRICE = 3.0;             // Tesco: £3 from 2012 to 2022 (press, see report); Sainsbury's: also £3 (estimated)
export const ALCOHOL_FROM = 6, ALCOHOL_UNTIL = 23;  // no alcohol sales 23:00-06:00

// role: meal-deal slot (main | snack | drink). energy: restored when eaten (game.state.energy, 0..100).
// shape: box | bottle | tin | bag | tray | bunch | pack.  w,h,d in metres (on-shelf size).  col: pack colour.
// src: 's' = price from a source (see report), 'e' = estimate for 2013.
export const PRODUCTS = {
  // ---- meal deal (chilled, by the door)
  sandwich_cb:  { name: 'Chicken & bacon sandwich', cat: 'mealdeal', role: 'main', price: 2.60, energy: 30, shape: 'tray', w: 0.13, h: 0.13, d: 0.07, col: '#d9c7a0', src: 'e' },
  sandwich_egg: { name: 'Egg & cress sandwich', cat: 'mealdeal', role: 'main', price: 1.80, energy: 25, shape: 'tray', w: 0.13, h: 0.13, d: 0.07, col: '#f0e2a0', src: 'e' },
  wrap:         { name: 'Chicken Caesar wrap', cat: 'mealdeal', role: 'main', price: 2.75, energy: 30, shape: 'tray', w: 0.09, h: 0.17, d: 0.07, col: '#e8d0a8', src: 'e' },
  pasta_pot:    { name: 'Tomato pasta salad', cat: 'mealdeal', role: 'main', price: 2.20, energy: 28, shape: 'tin', w: 0.11, h: 0.08, d: 0.11, col: '#e05a30', src: 'e' },
  crisps:       { name: 'Ready salted crisps', cat: 'snacks', role: 'snack', price: 0.55, energy: 8, shape: 'bag', w: 0.13, h: 0.18, d: 0.05, col: '#d02020', src: 'e' },
  choc:         { name: 'Milk chocolate bar', cat: 'snacks', role: 'snack', price: 0.60, energy: 10, shape: 'box', w: 0.16, h: 0.07, d: 0.02, col: '#5a2a14', src: 'e' },
  fruit_pot:    { name: 'Fruit pot', cat: 'mealdeal', role: 'snack', price: 1.00, energy: 8, shape: 'tin', w: 0.09, h: 0.09, d: 0.09, col: '#f0a020', src: 'e' },
  cola:         { name: 'Cola 500ml', cat: 'drinks', role: 'drink', price: 1.15, energy: 5, shape: 'bottle', w: 0.065, h: 0.22, d: 0.065, col: '#a01818', liquid: '#2a0c06', src: 'e' },
  water:        { name: 'Still water 500ml', cat: 'drinks', role: 'drink', price: 0.55, energy: 2, shape: 'bottle', w: 0.065, h: 0.22, d: 0.065, col: '#60a8e0', liquid: '#cfe6f5', src: 'e' },
  oj:           { name: 'Orange juice 330ml', cat: 'drinks', role: 'drink', price: 1.10, energy: 6, shape: 'bottle', w: 0.06, h: 0.18, d: 0.06, col: '#f08a10', liquid: '#f0a020', src: 'e' },
  // ---- the user's list (+ staples)
  milk:         { name: 'Semi-skimmed milk, 1 pint', cat: 'dairy', price: 0.49, energy: 6, shape: 'bottle', w: 0.08, h: 0.19, d: 0.08, col: '#20a040', liquid: '#f6f6f2', src: 'e' },
  cheese:       { name: 'Mature cheddar 400g', cat: 'dairy', price: 2.50, energy: 25, shape: 'box', w: 0.14, h: 0.05, d: 0.09, col: '#6a2a8a', src: 'e' },
  yoghurt:      { name: 'Strawberry yoghurts 4pk', cat: 'dairy', price: 1.00, energy: 10, shape: 'box', w: 0.15, h: 0.08, d: 0.1, col: '#e870a0', src: 'e' },
  bananas:      { name: 'Bananas (loose, each)', cat: 'produce', price: 0.18, energy: 10, shape: 'bunch', w: 0.22, h: 0.06, d: 0.12, col: '#f2d23a', src: 'e' },
  apples:       { name: 'Apples 6pk', cat: 'produce', price: 1.50, energy: 12, shape: 'box', w: 0.2, h: 0.08, d: 0.14, col: '#c02828', src: 'e' },
  bread:        { name: 'Value white bread 800g', cat: 'bakery', price: 0.47, energy: 15, shape: 'box', w: 0.12, h: 0.12, d: 0.28, col: '#f4f0e6', src: 'e' },
  croissants:   { name: 'All-butter croissants 4pk', cat: 'bakery', price: 1.00, energy: 14, shape: 'bag', w: 0.2, h: 0.1, d: 0.14, col: '#d8a050', src: 'e' },
  doughnuts:    { name: 'Jam doughnuts 5pk', cat: 'bakery', price: 0.80, energy: 14, shape: 'bag', w: 0.22, h: 0.09, d: 0.14, col: '#e0b070', src: 'e' },
  noodles:      { name: 'Value instant noodles', cat: 'dry', price: 0.20, energy: 18, shape: 'bag', w: 0.11, h: 0.13, d: 0.04, col: '#f0f0f0', src: 'e' },
  beans:        { name: 'Baked beans 420g', cat: 'dry', price: 0.32, energy: 15, shape: 'tin', w: 0.075, h: 0.11, d: 0.075, col: '#2a6ac0', src: 'e' },
  pasta:        { name: 'Fusilli pasta 500g', cat: 'dry', price: 0.40, energy: 12, shape: 'bag', w: 0.12, h: 0.2, d: 0.06, col: '#e8c860', src: 'e' },
  cereal:       { name: 'Corn flakes 500g', cat: 'dry', price: 1.29, energy: 12, shape: 'box', w: 0.2, h: 0.28, d: 0.07, col: '#e8b020', src: 'e' },
  tea:          { name: 'Tea bags 80s', cat: 'dry', price: 1.60, energy: 2, shape: 'box', w: 0.14, h: 0.12, d: 0.1, col: '#1a5a2a', src: 'e' },
  jaffa:        { name: 'Jaffa Cakes 12pk', cat: 'snacks', price: 1.00, energy: 15, shape: 'box', w: 0.2, h: 0.05, d: 0.07, col: '#1a3a8a', src: 'e', real: true },
  biscuits:     { name: 'Chocolate digestives', cat: 'snacks', price: 0.89, energy: 14, shape: 'tin', w: 0.075, h: 0.2, d: 0.075, col: '#7a3a1a', src: 'e' },
  pizza:        { name: 'Stonebaked margherita pizza', cat: 'frozen', price: 1.50, energy: 35, shape: 'box', w: 0.27, h: 0.04, d: 0.27, col: '#c03020', src: 'e' },
  peas:         { name: 'Garden peas 1kg', cat: 'frozen', price: 1.00, energy: 8, shape: 'bag', w: 0.2, h: 0.28, d: 0.05, col: '#2a9a3a', src: 'e' },
  icecream:     { name: 'Vanilla ice cream 2L', cat: 'frozen', price: 1.50, energy: 15, shape: 'box', w: 0.2, h: 0.12, d: 0.14, col: '#f2e6c0', src: 'e' },
  lager:        { name: 'Lager 4 x 440ml', cat: 'alcohol', price: 4.00, energy: 0, shape: 'box', w: 0.27, h: 0.16, d: 0.14, col: '#c0a020', src: 'e', alcohol: 0.18 },
  wine:         { name: 'Red wine 75cl', cat: 'alcohol', price: 4.99, energy: 0, shape: 'bottle', w: 0.075, h: 0.3, d: 0.075, col: '#3a0a14', liquid: '#3a0a14', src: 'e', alcohol: 0.25 },
  vodka:        { name: 'Vodka 70cl', cat: 'alcohol', price: 10.50, energy: 0, shape: 'bottle', w: 0.08, h: 0.28, d: 0.08, col: '#e8eef0', liquid: '#f4f8fa', src: 'e', alcohol: 0.4 },
  cider:        { name: 'Cider 2 litres', cat: 'alcohol', price: 2.50, energy: 0, shape: 'bottle', w: 0.1, h: 0.32, d: 0.1, col: '#c08a20', liquid: '#d09a30', src: 'e', alcohol: 0.22 },
  loo_roll:     { name: 'Toilet tissue 4 rolls', cat: 'household', price: 1.80, energy: 0, shape: 'bag', w: 0.22, h: 0.22, d: 0.11, col: '#f4f4f8', src: 'e' },
  washup:       { name: 'Washing-up liquid', cat: 'household', price: 0.75, energy: 0, shape: 'bottle', w: 0.07, h: 0.24, d: 0.05, col: '#30b040', liquid: '#30b040', src: 'e' },
  paper:        { name: 'Newspaper', cat: 'news', price: 1.20, energy: 0, shape: 'box', w: 0.3, h: 0.4, d: 0.02, col: '#e8e6dc', src: 'e' },
  bigissue:     { name: 'The Big Issue', cat: 'none', price: 2.50, energy: 0, shape: 'box', w: 0.21, h: 0.28, d: 0.01, col: '#d01818', src: 'e' },
};
export const CATEGORIES = {
  mealdeal: { label: 'Meal Deal', items: ['sandwich_cb', 'sandwich_egg', 'wrap', 'pasta_pot', 'fruit_pot'] },
  drinks: { label: 'Soft Drinks', items: ['cola', 'water', 'oj'] },
  snacks: { label: 'Crisps & Snacks', items: ['crisps', 'choc', 'jaffa', 'biscuits'] },
  dairy: { label: 'Milk & Dairy', items: ['milk', 'cheese', 'yoghurt'] },
  produce: { label: 'Fruit & Veg', items: ['bananas', 'apples'] },
  bakery: { label: 'Bakery', items: ['bread', 'croissants', 'doughnuts'] },
  dry: { label: 'Pasta, Tins & Noodles', items: ['noodles', 'beans', 'pasta', 'cereal', 'tea'] },
  frozen: { label: 'Frozen', items: ['pizza', 'peas', 'icecream'] },
  alcohol: { label: 'Beer, Wine & Spirits', items: ['lager', 'wine', 'cider', 'vodka'] },
  household: { label: 'Household', items: ['loo_roll', 'washup'] },
  news: { label: 'Newspapers', items: ['paper'] },
};
/** Own-brand naming per brand (2013: Tesco "Everyday Value" since 2012, Sainsbury's "basics"). */
export function productName(id, brand) {
  const p = PRODUCTS[id]; if (!p) return id;
  if (p.real) return p.name;
  const own = brand === 'tesco' ? 'Tesco' : "Sainsbury's";
  if (/^Value /.test(p.name)) return (brand === 'tesco' ? 'Tesco Everyday Value ' : "Sainsbury's basics ") + p.name.slice(6).replace(/^./, (c) => c.toLowerCase());
  if (p.cat === 'news' || p.cat === 'none') return p.name;
  return own + ' ' + p.name.replace(/^./, (c) => c.toLowerCase());
}
export const isFood = (id) => (PRODUCTS[id]?.energy || 0) > 0;

// ------------------------------------------------------------------------------------------------ branches
// hours: [open, close] per weekday Mon..Sun (close 24 = midnight).  world: frontage on the OSM building.
const H = (ms, sun) => [ms, ms, ms, ms, ms, ms, sun];
export const BRANCHES = {
  tesco_magdalen: {
    id: 'tesco_magdalen', brand: 'tesco', fmt: 'metro', name: 'Tesco Metro, Magdalen Street', short: 'Tesco Metro',
    poi: 'n312915804', building: 'w113822723', alcohol: true,
    hours: H([7, 24], [11, 17]), hoursText: 'Mon–Sat 7am–midnight · Sun 11am–5pm',
    // west side of Magdalen St: wall (56.5,53.1)->(64.0,78.4), outward normal faces east onto the street
    front: { a: [56.5, 53.1], b: [64.0, 78.4], t0: 0.25, t1: 12.2, door: 6.2, doorW: 2.2, atm: 0.95 },
  },
  sainsburys_magdalen: {
    id: 'sainsburys_magdalen', brand: 'sainsburys', fmt: 'local', name: "Sainsbury's Local, Magdalen Street", short: "Sainsbury's Local",
    poi: 'n312915805', building: 'w113822723', alcohol: true,
    hours: H([7, 23], [7, 23]), hoursText: 'Open 7 days 7am–11pm',
    front: { a: [56.5, 53.1], b: [64.0, 78.4], t0: 19.6, t1: 26.25, door: 22.0, doorW: 1.8, atm: 25.55 },
  },
  tesco_staldates: {
    id: 'tesco_staldates', brand: 'tesco', fmt: 'express', name: "Tesco Express, St Aldate's", short: 'Tesco Express',
    poi: 'n848252264', building: 'r21191996', alcohol: false,     // licence refused June 2010 (Cherwell); later status unknown
    hours: H([6, 23], [6, 23]), hoursText: 'Open 7 days 6am–11pm',
    // entrance on Speedwell Street (AccessAble): wall (220.6,707.0)->(201.8,708.4), faces south
    front: { a: [220.6, 707.0], b: [201.8, 708.4], t0: 0.2, t1: 12.5, door: 3.4, doorW: 1.8, canopy: true, forecourt: 4.0 },
    side: { a: [227.7, 700.3], b: [226.6, 685.9], t0: 0.3, t1: 13.5 },   // windows + fascia on St Aldate's (guess)
  },
  sainsburys_westgate: {
    id: 'sainsburys_westgate', brand: 'sainsburys', fmt: 'super', name: "Sainsbury's, Westgate Centre", short: "Sainsbury's",
    poi: 'n1925168632', building: 'w177643979', alcohol: true,
    hours: H([7, 20], [11, 17]), hoursText: 'Mon–Sat 7am–8pm · Sun 11am–5pm',
    // the side-alley entrance off Church Lane, facing east
    front: { a: [-22.4, 484.6], b: [-21.8, 490.1], t0: 0.0, t1: 5.5, door: 2.75, doorW: 2.2, trolleys: true, flip: true },
  },
};
/** OSM ids of branches that did NOT exist in 2013 (their generic map signs are hidden). */
export const POST_2013 = [
  { poi: 'n3321532353', name: "Sainsbury's Local, 117-119 St Aldate's (Carfax Quarter)", opened: 'c. Aug 2017' },
  { poi: 'n6991654581', name: "Sainsbury's Local, Park End Street", opened: '21 Nov 2019' },
  { poi: 'n12061976082', name: "Sainsbury's Local, 67C Walton Street", opened: 'c. 2023 (OSM start_date)' },
];

// ------------------------------------------------------------------------------------------------ time
/** 0 = Monday … 6 = Sunday, derived from the shared clock so every player agrees. */
export function weekday(nowMs) { return ((Math.floor(nowMs / DAY_MS) + 3) % 7 + 7) % 7; }
export function isOpen(branch, wd, hour) { const [o, c] = branch.hours[wd]; return hour >= o && hour < c; }
export function alcoholAllowed(branch, hour) { return !!branch.alcohol && hour >= ALCOHOL_FROM && hour < ALCOHOL_UNTIL; }
export function isBanned(state, branchId, nowMs) { const t = state?.shopBans?.[branchId]; return !!t && nowMs < t; }
export function ban(state, branchId, nowMs) { state.shopBans = state.shopBans || {}; state.shopBans[branchId] = nowMs + DAY_MS; return state.shopBans[branchId]; }
/** How many reduced (yellow sticker) packs are out at this hour: none before 16:00, filling up to 22:00. */
export function reducedCount(hour, max = 18) { if (hour < 16) return 0; return Math.round(max * Math.min(1, (hour - 16) / 6)); }
export const REDUCED_ITEMS = ['sandwich_cb', 'wrap', 'pasta_pot', 'croissants', 'doughnuts', 'yoghurt', 'cheese'];
export function reducedPrice(id, hour) { const p = PRODUCTS[id].price, f = hour >= 20 ? 0.25 : hour >= 18 ? 0.5 : 0.75; return Math.max(0.05, Math.round(p * f * 100) / 100); }

// ------------------------------------------------------------------------------------------------ basket
export class Basket {
  constructor(brand = 'tesco') { this.brand = brand; this.items = []; }
  add(id, price = PRODUCTS[id].price, reduced = false) { if (!PRODUCTS[id]) return null; const it = { id, price, reduced }; this.items.push(it); return it; }
  remove(i) { return this.items.splice(i, 1)[0]; }
  clear() { this.items.length = 0; }
  get count() { return this.items.length; }
  get subtotal() { return round2(this.items.reduce((s, it) => s + it.price, 0)); }
  /** Meal deals: one main + one snack + one drink for £3; picks the dearest of each to maximise the saving. Reduced items don't count. */
  mealDeals() {
    const pool = { main: [], snack: [], drink: [] };
    for (const it of this.items) { const r = PRODUCTS[it.id].role; if (r && !it.reduced) pool[r].push(it.price); }
    for (const k in pool) pool[k].sort((a, b) => b - a);
    const n = Math.min(pool.main.length, pool.snack.length, pool.drink.length);
    let saving = 0;
    for (let i = 0; i < n; i++) saving += Math.max(0, pool.main[i] + pool.snack[i] + pool.drink[i] - MEAL_DEAL_PRICE);
    return { n, saving: round2(saving) };
  }
  get total() { return round2(this.subtotal - this.mealDeals().saving); }
  hasAlcohol() { return this.items.some((it) => PRODUCTS[it.id].alcohol); }
  /** Remove items the till won't sell now; returns the removed ones. */
  enforceAlcohol(branch, hour) {
    if (alcoholAllowed(branch, hour)) return [];
    const out = this.items.filter((it) => PRODUCTS[it.id].alcohol);
    this.items = this.items.filter((it) => !PRODUCTS[it.id].alcohol);
    return out;
  }
  lines() { return this.items.map((it) => ({ name: productName(it.id, this.brand), price: it.price, reduced: it.reduced })); }
}
export const round2 = (x) => Math.round(x * 100) / 100;
export const money = (x) => (x < 1 && x > 0 ? Math.round(x * 100) + 'p' : '£' + x.toFixed(2));

// ------------------------------------------------------------------------------------------------ self-checkout
/**
 * Scan minigame. Each item drifts and wobbles past the scanner window (x in [-1,1] screen units; scanner at |x| < win).
 * press() scans if the barcode is over the glass. After a successful scan there is a chance of an
 * "Unexpected item in the bagging area" stall that lasts until the assistant arrives (assistDelay seconds).
 */
export function createScan(items, { rng = Math.random, win = 0.16, stallChance = 0.22, maxStalls = 2, assistDelay = 3.5 } = {}) {
  return {
    items: items.slice(), idx: 0, scanned: [], t: 0, x: -1.1, y: 0, phase: rng() * 6.28, speed: 0.55 + rng() * 0.25,
    win, stallChance, maxStalls, assistDelay, stalls: 0, state: items.length ? 'scan' : 'pay', stallT: 0, misses: 0, rng, msg: '',
  };
}
export function scanStep(s, dt) {
  s.t += dt;
  if (s.state === 'stall') { s.stallT -= dt; if (s.stallT <= 0) { s.state = s.idx >= s.items.length ? 'pay' : 'scan'; s.msg = 'Approval granted. Please continue scanning.'; } return s; }
  if (s.state !== 'scan') return s;
  s.x += s.speed * dt * (s.dir || 1);
  if (s.x > 1.15) s.dir = -1; else if (s.x < -1.15) s.dir = 1;
  s.y = Math.sin(s.t * 3.1 + s.phase) * 0.35;
  s.wob = Math.sin(s.t * 7.3 + s.phase) * 0.12;
  return s;
}
/** The barcode position includes the wobble; returns 'beep' | 'miss' | 'stall' | null. */
export function scanPress(s) {
  if (s.state !== 'scan') return null;
  const bx = s.x + (s.wob || 0);
  if (Math.abs(bx) > s.win || Math.abs(s.y) > 0.3) { s.misses++; s.msg = 'Please scan your item.'; return 'miss'; }
  s.scanned.push(s.items[s.idx]); s.idx++;
  s.x = -1.1; s.dir = 1; s.phase = s.rng() * 6.28; s.speed = 0.55 + s.rng() * 0.25 + Math.min(0.3, s.idx * 0.04);
  if (s.stalls < s.maxStalls && s.rng() < s.stallChance) {
    s.stalls++; s.state = 'stall'; s.stallT = s.assistDelay; s.msg = 'Unexpected item in the bagging area.'; return 'stall';
  }
  s.msg = '';
  if (s.idx >= s.items.length) s.state = 'pay';
  return 'beep';
}
