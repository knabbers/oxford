// Walk-in shops on the painted shopping streets — THE PILOT: one shop, on Cornmarket.
//   22 Cornmarket Street (OSM w311136293: a plot 6.9 m wide on the street and 35 m deep): the stationer and newsagent
//   that traded there in 2013 (the map has the premises under their 2025 name, with a toy concession that came later:
//   places/cowley_road.js ERA_2013 puts the 2013 name back on the fascia — painted text in the board's two colours,
//   world/buildings.js — and preMap here drops the concession's sign). Shown as "Quire & Quill" under ?invented=1.
// The room is places/_street_shop_kit.js (template 'stationer') behind the building's own painted shopfront: its door
// on the painted door, its window on the painted glass. Open 8:30 - 18:30; a "Closed" card on the door out of hours.
// People: someone at the till and a browser or two whenever it is shown; the street's walkers come in and go out
// (systems/pedestrians.js addDoorway). Nothing is sold yet: [E] at the till is a line of chat.
// Test: tools/smoke_walkin_city.mjs walks it with every other city room (game.walkin.list).
import { planWalkin, streetDoor, roomCrowd, hoursOpen, warmLater, facadeBays, inPoly } from './_walkin_city.js';
import { buildStreetShop, shopPlanSpec, templateFor, fitStats } from './_street_shop_kit.js';
import { SEAMLESS } from '../core/interiors.js';
import { randomLook } from '../core/characters.js';
import { tn, inventedNames } from '../core/features.js';
import { dayOf } from '../core/time.js';

const SHOP = { id: 'street_shop_22cornmarket', building: 'w311136293', poi: 'n3320076101', later: ['n14091991563'], w: 5.4, d: 8, h: 3.05, template: 'stationer', open: 8.5, shut: 18.5 };
const NAME = () => tn('WHSmith', 'Quire & Quill');
// ---- THE BATCH: Cornmarket Street's other premises, each a LIGHT walk-in room (core/interiors.js `seamless.light`,
// registered lazily: nothing is planned, punched or built until the player is within 110 m) behind its own painted
// shopfront, fitted from a template (places/_street_shop_kit.js). One row per premises, keyed by the map's point of
// interest: [poi, template, [opens, shuts]]. What each was c. 2013 — the name on the fascia — is places/cowley_road.js
// ERA_2013 (researched from the per-building pages of oxfordhistory.org.uk/cornmarket; guesses are marked there).
const H_SHOP = [9, 18], H_CAFE = [7, 19], H_FOOD = [10, 23], H_BANK = [9.5, 16.5];
export const UNITS = [
  ['n13987621040', 'bank', H_BANK], ['n13090106587', 'chemist', H_SHOP], ['n3321532732', 'jeweller', H_SHOP], ['n471723339', 'takeaway', H_FOOD], ['n3321532700', 'bookshop', H_SHOP],
  ['n13395473058', 'gift', H_SHOP], ['n3321533074', 'phone', H_SHOP], ['n8625460100', 'clothes', H_SHOP], ['n2957831731', 'bank', H_SHOP], ['n3321533066', 'phone', H_SHOP],
  ['n3321532748', 'phone', H_SHOP], ['n2957831732', 'cafe', H_CAFE], ['n597707582', 'takeaway', H_FOOD], ['n308768763', 'records', H_SHOP], ['n3321533091', 'records', H_SHOP],
  ['n3321533064', 'phone', H_SHOP], ['n3321532710', 'gift', H_SHOP], ['n3321532664', 'shoes', H_SHOP], ['n10967596405', 'chemist', H_SHOP], ['n11667092323', 'clothes', H_SHOP],
  ['n12281936765', 'clothes', H_SHOP], ['n13017355332', 'clothes', H_SHOP], ['n13017345224', 'phone', H_SHOP], ['n12688536338', 'phone', H_SHOP], ['n471723341', 'jeweller', H_SHOP],
  ['n3320076026', 'cafe', H_CAFE], ['n10777670607', 'takeaway', H_FOOD], ['n10967522805', 'phone', H_SHOP], ['n3320076073', 'clothes', H_SHOP], ['n3321532720', 'clothes', H_SHOP],
  ['n3320076072', 'cafe', H_CAFE], ['n323182876', 'bank', H_BANK],      // (not Lloyds Bank at no. 1: its mapped shop unit is 3.1 m wide, no room fits)
  // ---- THE HIGH (c. 2013 names: ERA_2013; from the per-building pages of oxfordhistory.org.uk/high). North side, west to east:
  ['n3320076046', 'clothes', H_SHOP], ['n12154041256', 'bank', H_SHOP], ['n3320076024', 'clothes', H_SHOP], 
  ['n12942179735', 'cafe', H_FOOD], ['n3320076086', 'cafe', H_CAFE], ['n3320076059', 'gift', H_SHOP], ['n12569164285', 'gift', H_SHOP], ['n3320076080', 'shoes', H_SHOP],
  ['n3320076063', 'phone', H_SHOP], ['n3320076075', 'jeweller', H_SHOP], ['n3320076089', 'gift', H_SHOP], ['n3320076039', 'barber', H_SHOP], ['n324606222', 'cafe', H_CAFE],
  ['n3320076057', 'cafe', H_CAFE], ['n3320076061', 'bank', H_SHOP], ['n3320076078', 'clothes', H_SHOP], ['n3320076031', 'shoes', H_SHOP], ['n3320076042', 'stationer', H_CAFE],
  ['n3320076090', 'cafe', H_CAFE], ['n3320076053', 'chemist', H_SHOP], ['n3320076021', 'barber', H_SHOP], ['n3320076087', 'cafe', H_CAFE], ['n3320076009', 'bank', H_SHOP],
  // (no room fits their mapped unit: Tim's Newsagent n3320076094, Coast n12669775358, Patisserie Valerie n522986710, Pens Plus n3320076067; Queen Street: Crabtree & Evelyn n11018524096, Jones Bootmaker n12663570400)
  // (not yet: Pia at no. 16 — n12154041254 — and Fellows at 137 — n12160443437: the walk test cannot get in at the one, and the other's door leaf brushes the walker)
  // …south side, west to east:
  ['n9502199061', 'clothes', H_SHOP], ['n12154108363', 'gift', H_SHOP], ['n12942179734', 'bank', H_BANK],
  ['n12953854625', 'clothes', H_SHOP], ['n2612902271', 'clothes', H_SHOP], ['n3320076091', 'gift', H_SHOP], ['n11203152887', 'gift', H_SHOP], ['n3320076020', 'clothes', H_SHOP],
  ['n1426375437', 'cafe', H_FOOD], ['n3320076070', 'phone', H_SHOP], ['n840488830', 'gift', H_SHOP], ['n324606225', 'cafe', H_CAFE],
  ['n3320076043', 'gift', H_SHOP], ['n643775481', 'cafe', H_CAFE],
  // ---- QUEEN STREET (its only source has no 2013 column: every name there but Santander is a likely or a guess — ERA_2013). North side, then south:
  ['n3321532348', 'jeweller', H_SHOP], ['n12647539356', 'gift', H_SHOP], ['n12647539355', 'clothes', H_SHOP], ['n3321532668', 'gift', H_SHOP], ['n3321532678', 'phone', H_SHOP],
  ['n3321533087', 'clothes', H_SHOP], ['n3321532719', 'clothes', H_SHOP], ['n3321532733', 'clothes', H_SHOP], 
  ['n1625434216', 'clothes', H_SHOP], ['n12405785274', 'clothes', H_SHOP], ['n8621332581', 'clothes', H_SHOP], ['n1492515919', 'clothes', H_SHOP], ['n3321533061', 'phone', H_SHOP],
  ['n8634455556', 'jeweller', H_SHOP], ['n13374233843', 'bank', H_BANK],
];
// Premises of 2013 that the map has no point for today: a point is put on the map (preMap) just inside the painted shop
// door that stands where the street numbers put them, so the fascia takes the name and the unit becomes a room like the
// rest. [id, [x, z], name, kind, template, hours]. The OCCUPIERS are sourced (oxfordhistory.org.uk/cornmarket: Boots
// 8-10, Orange / EE 41-42, Gap and H. Samuel 52, Barclays 53-54, Phones 4U 56, McDonald's 57); WHICH painted door each
// is, is a guess from the order of the numbers along the street.
export const EXTRA = [
  ['x_cm_boots', [144, 271], tn('Boots', 'Wellington Chemist'), 'shop:chemist', 'chemist', H_SHOP],
  ['x_cm_ee', [92, 183], tn('EE', 'Double E Mobile'), 'shop:mobile_phone', 'phone', H_SHOP],
  ['x_cm_gap', [106, 225], tn('Gap', 'The Gap Year'), 'shop:clothes', 'clothes', H_SHOP],
  ['x_cm_hsamuel', [107, 229], tn('H. Samuel', 'Samuel & Hart'), 'shop:jewelry', 'jeweller', H_SHOP],
  ['x_cm_phones4u', [112, 244], tn('Phones 4U', 'Phones For You'), 'shop:mobile_phone', 'phone', H_SHOP],
  ['x_cm_mcdonalds', [115, 250], tn("McDonald's", 'Golden Fries'), 'fast_food', 'takeaway', H_FOOD],
];
const LINES = {
  shop: ['"Do you need a bag?"', '"Just say if you need a hand."', '"We shut at six."'], cafe: ['"Eat in or take away?"', '"Anything else?"', '"It\'ll be a couple of minutes."'],
  bank: ['"Next, please."', '"Paying in? Slips are on the desk."'],
};
const SIZES = [[5.4, 8], [5.4, 6.5], [4.6, 7], [4.6, 5.5], [3.8, 6], [3.8, 5], [3.2, 4.6]];
const TILL_LINES = ['"Do you want a bag?"', '"Stamps are at the Post Office, love. St Aldate\'s."', '"Any chocolate for a pound with that?"', '"The Oxford Mail\'s by the door."'];

export default {
  id: 'cornmarket_shops',
  preMap(game) {
    try {
      const m = game.map; if (!m || !m.pois) return;
      // (the 2013 name on the fascia: places/cowley_road.js ERA_2013, with the other premises put back to their 2013
      //  names; under ?invented=1 this premises' invented name is ours)
      const p = m.pois.find((q) => q.id === SHOP.poi);
      if (p && inventedNames()) { p.name = NAME(); delete p.brand; p.kind = 'shop:stationery'; }
      for (const id of SHOP.later) game.overrides.skip.add(id);
      for (const [id, pos, name, kind] of EXTRA) if (!m.pois.some((q) => q.id === id)) m.pois.push({ id, p: pos, kind, name });
    } catch (e) { console.error('[cornmarket_shops] preMap', e); }
  },
  install(game) {
    if (!SEAMLESS) return {};
    const b = game.map.buildings.find((q) => q.id === SHOP.building); if (!b || !b.poly) return {};
    // the street front: the outline's edge nearest Cornmarket (the plot's west end)
    const road = (game.map.roads || []).filter((r) => r.name === 'Cornmarket Street').flatMap((r) => r.pts || []);
    let best = null;
    for (let i = 0, j = b.poly.length - 1; i < b.poly.length; j = i++) {
      const a = b.poly[j], c = b.poly[i], mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 4) continue;
      let dr = 1e9; for (const q of road) dr = Math.min(dr, Math.hypot(q[0] - mx, q[1] - mz));
      if (!best || dr < best.dr) best = { dr, mx, mz, a, c, L };
    }
    if (!best) return {};
    // outward normal: away from the middle of the plot
    let nx = (best.c[1] - best.a[1]) / best.L, nz = -(best.c[0] - best.a[0]) / best.L;
    { let cx = 0, cz = 0; for (const p of b.poly) { cx += p[0]; cz += p[1]; } cx /= b.poly.length; cz /= b.poly.length; if ((best.mx - cx) * nx + (best.mz - cz) * nz < 0) { nx = -nx; nz = -nz; } }
    const facing = Math.atan2(nx, nz), door = [best.mx + nx * 1.0, best.mz + nz * 1.0];
    const open = () => hoursOpen(game.time.hour, SHOP.open, SHOP.shut);
    let plan = null;
    try { plan = planWalkin(game, { id: SHOP.id, building: SHOP.building, door: { pos: door, facing }, hours: { open, testShut: 3.5 }, ...shopPlanSpec(SHOP.w, SHOP.d) }); } catch (e) { console.warn('[cornmarket_shops] plan', e); }
    const walkin = !!(plan && plan.poly && plan.fit.ok);
    if (walkin) plan.seamless.light = true;      // (a light room: core/interiors.js)
    if (!walkin) { console.warn('[cornmarket_shops] the shop does not fit its building', plan && plan.fit); return {}; }
    streetDoor(game, plan, { every: 24, dwell: [15, 50], cap: 3 });
    let R = null;
    const look = (seed, extra) => ({ ...randomLook(seed, { outfit: 'casual' }), hat: null, backpack: null, prop: null, ...extra });
    const crowd = roomCrowd(game, SHOP.id, {
      cap: 4, signature: () => `${open()}|${game.time.hour >= 12}|${dayOf(game.time.now())}`,
      populate(spawn) {
        if (!open() || !R) return;
        const day = dayOf(game.time.now()), P = (q, lk, opts) => { const p = spawn(q[0], q[1], lk, { heading: q[2], ...opts }); if (p) p.character.noLod = true; return p; };
        P(R.clerk, look('cornmarket22-till-' + (day % 3), { outfit: 'shopworker' }), { role: 'clerk', lines: TILL_LINES.map((t) => t.replace(/"/g, '')) });
        for (let i = 0; i < (game.time.hour >= 12 ? 2 : 1) && i < R.browse.length; i++) P(R.browse[(i + day) % R.browse.length], look('cornmarket22-browser-' + day + '-' + i, { backpack: i ? 0x2a3a5a : null }));
      },
    });
    const lamps = (on) => { if (!R || R.lit === on) return; R.lit = on; for (const [l, i] of R.lights) l.intensity = i * (on ? 1 : 0.22); R.panels.color.setHex(on ? 0xf4f6ff : 0x2a2c30); };
    const people = (dt, inside) => { lamps(open()); crowd.tick(dt); for (const p of crowd.npcs) { const ch = p.character; if (!ch.group.visible) ch.group.visible = true; if (!inside) ch.update(dt, 0); } };
    game.interiors.register({
      id: SHOP.id, name: NAME(), background: 0x14151a, ambient: 0.62,
      seamless: plan.seamless,
      doors: [{ pos: door, facing, label: 'Go into ' + NAME(), locked: () => (open() ? false : NAME() + ' is shut (open 8:30 - 18:30).') }],
      update(dt) { people(dt, true); }, updateShown(dt) { people(dt, false); },
      build(ctx) {
        R = buildStreetShop(ctx, game, plan, { w: SHOP.w, d: SHOP.d, h: SHOP.h, template: SHOP.template, seed: 22 });
        game.interact.add({ place: ctx.id, pos: [R.till[0], 0, R.till[2]], radius: 1.3, enabled: () => open(), label: 'Say hello at the till', onUse: () => game.ui.toast(TILL_LINES[Math.floor(game.time.now() / 7000) % TILL_LINES.length], 4) });
        return { spawn: R.spawn, heading: R.heading };
      },
    });
    warmLater(game, SHOP.id);
    const api = (game.cornmarketShops = { plan, shop: SHOP, get room() { return R; }, units: [], skipped: [], fitStats });
    try { batch(game, api); } catch (e) { console.error('[cornmarket_shops] batch', e); }
    return {};
  },
};

// ------------------------------------------------------------------------------------------------ the batch
const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };
/** every painted shop door (world/buildings.js: a 'shop' front's recessed door bay) of the mapped buildings within `r` m of (x, z) */
function shopDoors(game, B) { const bays = facadeBays(game, B.id); return bays ? bays.filter((q) => q.door && !q.covered && q.kind === 'shop') : []; }
function buildingOf(game, p) {
  let best = null, bd = 10;
  for (const b of game.map.buildings) {
    if (!b.poly || b.part || (b.c && Math.abs(b.c[0] - p[0]) + Math.abs(b.c[1] - p[1]) > 120)) continue;
    if (inPoly(b.poly, p[0], p[1])) return b;
    for (let i = 0, j = b.poly.length - 1; i < b.poly.length; j = i++) { const a = b.poly[j], c = b.poly[i], ex = c[0] - a[0], ez = c[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / (ex * ex + ez * ez || 1))), q = Math.hypot(p[0] - a[0] - ex * t, p[1] - a[1] - ez * t); if (q < bd) { bd = q; best = b; } }
  }
  return best;
}
/** one unit: { id, name, kind, template, hours, b (building), bay (its painted door) } -> registered lazily */
function addUnit(game, api, U) {
  // (the room is centred on the shop UNIT — its painted door and the glass beside it — and its doorway is moved along
  //  the wall onto the painted door: planWalkin snapBay)
  const I = game.interiors, bay = U.bay, facing = Math.atan2(bay.nx, bay.nz), door = [U.cx + bay.nx * 1.0, U.cz + bay.nz * 1.0];
  U.door = door; U.state = 'lazy';
  I.registerLazy({ id: U.id, pos: door, make() {
    // (planned now, the largest size that fits its building and leaves its neighbours' doors alone)
    const open = () => hoursOpen(game.time.hour, U.hours[0], U.hours[1]);
    let plan = null;
    for (const [w, d] of SIZES) {
      if (w > U.maxW + 0.01) continue;
      // (a room narrower than its unit is moved along the wall until the painted door is in its front, 0.8 m clear of the corner)
      const lat = (bay.x - U.cx) * bay.ux + (bay.z - U.cz) * bay.uz, sh = Math.sign(lat) * Math.max(0, Math.abs(lat) - (w / 2 - 0.8)), pos = [door[0] + bay.ux * sh, door[1] + bay.uz * sh];
      let q = null; try { q = planWalkin(game, { id: U.id, building: U.b.id, door: { pos, facing }, hours: { open, testShut: 3.5 }, ...shopPlanSpec(w, d, { snap: Math.max(1, U.uw / 2 + 0.2) }) }); } catch { q = null; }
      if (q && !q.doorBay) q = null;      // (its doorway must be on the painted door)
      if (q && q.poly && q.fit.ok) { plan = q; U.w = w; U.d = d; break; }
    }
    if (!plan) { U.state = 'no fit'; const W = game.walkin; if (W && W.byId.has(U.id)) { const k = W.list.indexOf(W.byId.get(U.id)); if (k >= 0) W.list.splice(k, 1); W.byId.delete(U.id); } return null; }
    plan.seamless.light = true; U.plan = plan; U.state = 'registered';
    const dw = streetDoor(game, plan, { every: 45, dwell: [15, 50], cap: 2 });
    let R = null;
    const look = (seed, extra) => ({ ...randomLook(seed, { outfit: 'casual' }), hat: null, backpack: null, prop: null, ...extra });
    const lines = (/cafe|takeaway/.test(U.template) ? LINES.cafe : U.template === 'bank' ? LINES.bank : LINES.shop);
    const crowd = roomCrowd(game, U.id, {
      cap: 3, signature: () => `${open()}|${dayOf(game.time.now())}`,
      populate(spawn) {
        if (!open() || !R) return;
        const day = dayOf(game.time.now()), P = (q, lk, opts) => { const p = spawn(q[0], q[1], lk, { heading: q[2], ...opts }); if (p) p.character.noLod = true; return p; };
        P(R.clerk, look(U.id + '-till-' + (day % 3), { outfit: 'shopworker' }), { role: 'clerk', lines: lines.map((t) => t.replace(/"/g, '')) });
        if (R.browse.length && (hash(U.id) + day) % 3) P(R.browse[(hash(U.id) + day) % R.browse.length], look(U.id + '-browser-' + day));
      },
    });
    const lamps = (on) => { if (!R || R.lit === on) return; R.lit = on; for (const [l, i] of R.lights) l.intensity = i * (on ? 1 : 0.22); R.panels.color.setHex(on ? 0xf4f6ff : 0x2a2c30); };
    const people = (dt, inside) => { lamps(open()); crowd.tick(dt); for (const p of crowd.npcs) { const ch = p.character; if (!ch.group.visible) ch.group.visible = true; if (!inside) ch.update(dt, 0); } };
    return {
      id: U.id, name: U.name, background: 0x14151a, ambient: 0.62, seamless: plan.seamless, visitors: () => (dw && dw.n) || 0,
      doors: [{ pos: door, facing, label: 'Go into ' + U.name }],
      update(dt) { people(dt, true); }, updateShown(dt) { people(dt, false); },
      build(ctx) {
        R = U.room = buildStreetShop(ctx, game, plan, { w: U.w, d: U.d, h: 3.05, template: U.template, seed: hash(U.id) % 97 });
        game.interact.add({ place: ctx.id, pos: [R.till[0], 0, R.till[2]], radius: 1.3, enabled: () => open(), label: 'Say hello at the till', onUse: () => game.ui.toast(lines[Math.floor(game.time.now() / 7000) % lines.length], 4) });
        U.state = 'built';
        return { spawn: R.spawn, heading: R.heading };
      },
    };
  } });
  api.units.push(U);
  return U;
}
/** the shop unit a painted door belongs to (world/buildings.js: a shop front is P.units equal units along its wall): its middle on the shell face and its width */
function unitOf(bay) {
  const n = Math.max(1, bay.units | 0), uw = bay.len / n, un = Math.max(0, Math.min(n - 1, Math.floor(bay.sm / uw))), c = (un + 0.5) * uw;
  return { un, uw, cx: bay.ox + bay.ux * c, cz: bay.oz + bay.uz * c, maxW: Math.min(5.4, uw - 0.3) };
}
function batch(game, api) {
  const map = game.map, taken = new Set([SHOP.building + ':']);      // (door bays in use, by building and place)
  const own = new Set((game.walkin ? game.walkin.list : []).map((P) => P.building && P.building.id).filter(Boolean));      // (buildings another module's room is in)
  const key = (b, q) => b.id + ':' + Math.round(q.x) + ',' + Math.round(q.z);
  for (const [poi, template, hours] of [...UNITS, ...EXTRA.map((e) => [e[0], e[4], e[5]])]) {
    const p = map.pois.find((q) => q.id === poi); if (!p || game.overrides.skip.has(poi)) { api.skipped.push([poi, 'not on the map']); continue; }
    const b = buildingOf(game, p.p); if (!b) { api.skipped.push([poi, p.name, 'no building']); continue; }
    if (own.has(b.id)) { api.skipped.push([poi, p.name, 'its building has a room of another module (' + b.id + ')']); continue; }
    const doors = shopDoors(game, b).filter((q) => !taken.has(key(b, q)));
    let bay = null, bd = 1e9; for (const q of doors) { const d = Math.hypot(q.x - p.p[0], q.z - p.p[1]); if (d < bd) { bd = d; bay = q; } }
    if (!bay || bd > 16) { api.skipped.push([poi, p.name, 'no painted shop door on its building (' + b.id + ')']); continue; }
    taken.add(key(b, bay));
    addUnit(game, api, { id: 'street_shop_' + poi, poi, name: p.name || 'Shop', kind: p.kind, template, hours, b, bay, ...unitOf(bay) });
  }
  /**
   * THE TEST of the light-room mechanism (tools/probe_street_shops.mjs; never called by the game): every painted shop
   * door within `r` m of the three shopping streets that is not already a room's, up to n, as a light walk-in room
   * fitted by its premises' kind (or by a hash). -> the number added.
   */
  api.synthetic = (n = 60, r = 26, streets = ['Cornmarket Street', 'Queen Street', 'High Street']) => {
    const pts = (map.roads || []).filter((q) => streets.includes(q.name)).flatMap((q) => q.pts || []), near = (x, z) => { let m = 1e9; for (const q of pts) m = Math.min(m, Math.abs(q[0] - x) + Math.abs(q[1] - z)); return m; };
    const T = ['stationer', 'bookshop', 'clothes', 'phone', 'chemist', 'cafe', 'bank', 'takeaway', 'gift', 'records', 'shoes', 'jeweller'], cand = [];
    for (const b of map.buildings) { if (!b.poly || !b.c || near(b.c[0], b.c[1]) > r + 30 || own.has(b.id)) continue; const D = shopDoors(game, b); for (const q of D) if (!taken.has(key(b, q)) && near(q.x, q.z) < r) cand.push({ b, q, D, d: Math.hypot(q.x - 117, q.z - 193) }); }
    cand.sort((a, c) => a.d - c.d);
    let k = 0;
    for (const c of cand) { if (k >= n) break; taken.add(key(c.b, c.q)); const id = 'street_shop_x_' + c.b.id + '_' + Math.round(c.q.x) + '_' + Math.round(c.q.z); addUnit(game, api, { id, name: 'Shop', kind: 'shop', template: T[hash(id) % T.length], hours: H_SHOP, b: c.b, bay: c.q, ...unitOf(c.q), synthetic: true }); k++; }
    return k;
  };
}
