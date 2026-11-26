// Tesco and Sainsbury's in central Oxford, c. 2013. Four branches that existed then, built on the real OSM buildings:
//   Tesco Metro, Magdalen Street (former Borders; ground floor + basement via the "Tescalator")   w113822723
//   Sainsbury's Local, 7 Magdalen Street (just south of it)                                       w113822723
//   Tesco Express, 75 St Aldate's (entrance on Speedwell Street)                                   r21191996
//   Sainsbury's, Westgate Centre (side-alley entrance off Church Lane)                             w177643979
// Branches that opened after 2013 (St Aldate's/Carfax Sainsbury's Local 2017, Park End St 2019, Walton St 2023) are
// skipped and their generic map signs hidden. Research notes: docs/research/venues.md §4 + the module report.
// Files: _shop_data.js (catalogue, prices, hours, basket + scan rules — smoke-tested), _shop_layouts.js (floor plans),
// _shop_interior.js (interior kit), _shop_exterior.js (shopfronts), _shop_tex.js (canvas art), _shop_mesh.js, _shop_ui.js.
// Test hooks: game.supermarkets.{enter(id), take(productId), basketInfo(), sco / scoStart(i) / scoPress(), forceStall(),
//   till(), steal(), openInventory(), eat(i), stats(), population(), view(...)}.
import * as THREE from 'three';
import { BRANCHES, POST_2013, PRODUCTS, Basket, weekday, isOpen, isBanned, ban, reducedCount, REDUCED_ITEMS, reducedPrice, productName, money, isFood, DAY_MS } from './_shop_data.js';
import { LAYOUTS, groundFor, slLayout, ESC } from './_shop_layouts.js';
import { buildInterior, productAtlas, LIFT } from './_shop_interior.js';
import { makeLift } from './_maths_lift.js';
import { buildExterior, exteriorDoors, edgeFrame, frontPanes } from './_shop_exterior.js';
import { SEAMLESS } from '../core/interiors.js';
import { planWalkin, streetDoor, cityDoor, glazing, warmLater } from './_walkin_city.js';
import { BRAND } from './_shop_tex.js';
import { createHud, openSco, openInventory } from './_shop_ui.js';
import { randomLook } from '../core/characters.js';
import { Mesher } from './_shop_mesh.js';

const PI = Math.PI;
const IDP = 'shop_';
// Walk-in shops (core/interiors.js "seamless"; plan and fit: _walkin_city.js; the floor plans: _shop_layouts.js slLayout).
// Each shop is in place behind its mapped frontage: the automatic doors are real (they open for whoever walks up, and
// stay shut out of hours or if you are barred), the shopfront's panes that are in front of the sales floor are real
// glass, and walking out with an unpaid basket is the theft (there is no "Leave" prompt).
// WALK: where the smoke test walks to inside each (a clear spot in an aisle, and the way round the fixtures to it).
const WALK = {
  tesco_magdalen: { mid: [0.9, -16], route: [[0, -3.6]] },
  sainsburys_magdalen: { mid: [-1.8, -12], route: [[1, -2.8], [-1.8, -5]] },
  tesco_staldates: { mid: [4.0, -7], route: [] },
  sainsburys_westgate: { mid: [-6, -17], route: [[-9.6, -6], [-9.6, -11], [-6, -12]] },
};
/** the walk-in plan of branch b behind its frontage on outline `poly` (null: stay on the door prompt) */
export function planShop(game, b, poly, open) {
  if (!SEAMLESS || !poly) return null;
  const L = slLayout(b.id), rm = L.rooms[0], E = edgeFrame(b.front.a, b.front.b, poly), f = E.heading;
  const sgn = E.dx * Math.cos(f) - E.dz * Math.sin(f) >= 0 ? 1 : -1, fx = rm.front.x, dw = b.front.doorW || rm.front.w;
  const xOf = (t) => fx + sgn * (t - b.front.door);
  // the frontage's panes that stand wholly in front of the sales floor become real windows (joined where they touch)
  const inside = frontPanes(b.front, E).panes.map(([u0, u1]) => ({ t: [u0, u1], x: [xOf(u0), xOf(u1)].sort((p, q) => p - q) })).filter((q) => q.x[0] >= rm.x0 + 0.2 && q.x[1] <= rm.x1 - 0.2).sort((p, q) => p.x[0] - q.x[0]);
  const spans = [];
  for (const q of inside) { const l = spans[spans.length - 1]; if (l && Math.abs(l.x[1] - q.x[0]) < 0.02) { l.x[1] = q.x[1]; l.t = [Math.min(l.t[0], q.t[0]), Math.max(l.t[1], q.t[1])]; l.n++; } else spans.push({ x: [...q.x], t: [...q.t], n: 1 }); }
  const from = { x0: rm.x0 - 0.3, x1: rm.x1 + 0.3, z0: rm.z0 - 0.3, z1: rm.z1 + 0.8, y0: rm.y - 0.5, y1: rm.y + rm.h + 0.5 };      // (seen from the ground floor only)
  const rects = L.rooms.filter((r) => r.y > -1).map((r) => [r.x0, r.z0, r.x1, r.z1]);
  if (L.escalator) rects.push([ESC.x0, ESC.zBot, ESC.x1, ESC.zTop]);
  const plan = planWalkin(game, {
    id: IDP + b.id, building: b.building, door: { pos: E.P(b.front.door, 1.0), facing: f }, wall: 0.3,
    portal: { at: [fx, rm.z1 + 0.1], out: 0, w: dw, h: 2.4, from }, rects,
    windows: spans.map((q) => ({ at: [(q.x[0] + q.x[1]) / 2, rm.z1], out: 0, w: q.x[1] - q.x[0] - 0.1, y0: 0.45, y1: 2.7, from, maxDepth: 0.8, bars: q.n - 1, frame: 0.07 })),
    hours: { open, testOpen: 14, testShut: 3.5 }, ...(WALK[b.id] || {}),
  });
  if (!plan.poly || !plan.fit.ok) return null;
  plan.L = L; plan.E = E;
  plan.wins = plan.seamless.openings.map((o) => [o.at[0] - o.w / 2 - 0.05, o.at[0] + o.w / 2 + 0.05]);
  plan.holes = spans.filter((q) => plan.seamless.openings.some((o) => Math.abs(o.at[0] - (q.x[0] + q.x[1]) / 2) < 0.01)).map((q) => q.t);
  return plan;
}
const STAFF_LINES = {
  tesco: ['Every little helps!', 'Can I help you find anything?', 'Meal deals are in the fridge by the door.', 'Mind the escalator, it has moods.'],
  sainsburys: ['Can I help you find anything?', 'Meal deals are just there on the left.', 'Live well for less!', 'Do you need a hand?'],
};
const GUARD_LINES = ['Afternoon.', 'All right?', "Bags are fine, mate, you're all good.", 'Have a good one.'];
const SHOPPER_LINES = ['Where do they keep the hummus?', 'Is this the meal deal one?', 'They never have the good sandwiches after one.', 'Ooh, two for one.', "Have you seen the price of halloumi?", 'I only came in for milk.'];
const CIRCLER_LINES = ['Wait for it… they always mark it down again at eight.', 'Is that 10p? That is 10p.', "Don't make eye contact with the stacker.", 'Dibs on the sushi.', 'Dinner sorted. Sort of.'];
const QUEUE_LINES = ['Why is there only one till open?', 'This queue goes back to the yoghurts.', 'Should have used the self-checkout.', 'Come on…'];

export default {
  id: 'supermarkets',
  preMap(game) {
    // our own shopfronts replace the generic map signs; post-2013 branches get no sign at all
    for (const b of Object.values(BRANCHES)) game.overrides.skip.add(b.poi);
    for (const p of POST_2013) game.overrides.skip.add(p.poi);
  },
  install(game) {
    const st = game.state;
    if (typeof st.energy !== 'number') st.energy = 100;
    if (!Array.isArray(st.inventory)) st.inventory = [];
    if (!st.shopBans) st.shopBans = {};
    const S = (game.supermarkets = { branches: BRANCHES, stores: {}, basket: null, current: null, sco: null, chase: null, post2013: POST_2013 });
    const now = () => game.time.now(), hour = () => game.time.hour, wd = () => weekday(now());
    const dayIdx = () => Math.floor(now() / DAY_MS);
    const openNow = (b) => isOpen(b, wd(), hour());
    const audio = game.audio;
    const beep = () => { try { audio.tone(1950, 0.08, { type: 'square', gain: 0.06 }); } catch { /* audio not started */ } };
    const buzz = () => { try { audio.tone(190, 0.28, { type: 'sawtooth', gain: 0.07 }); } catch { /* */ } };
    const alarm = () => { try { for (let i = 0; i < 6; i++) audio.tone(i % 2 ? 880 : 1180, 0.22, { type: 'square', gain: 0.07, when: i * 0.24 }); } catch { /* */ } };
    const say = (text) => { try { if (window.speechSynthesis && !navigator.webdriver) { const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; u.pitch = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch { /* optional */ } game.ui.toast('🔊 "' + text + '"', 3); };
    const hud = createHud();
    let _liftMats = null;
    const liftMats = () => _liftMats || (_liftMats = (() => {
      const steel = new THREE.MeshLambertMaterial({ color: 0xb4bcc4, name: 'shop:lift-steel' }), dark = new THREE.MeshLambertMaterial({ color: 0x3a3e44, name: 'shop:lift-dark' });
      return { wall: steel, leaf: steel, floor: dark, rail: dark, frame: dark, light: new THREE.MeshBasicMaterial({ color: 0xf4f8ff, name: 'shop:lift-light' }) };
    })());

    // ---------------------------------------------------------------------------------------------- exteriors
    const stores = [];
    for (const b of Object.values(BRANCHES)) {
      try {
        const bd = game.map.buildings.find((x) => x.id === b.building);
        let plan = null;
        try { plan = planShop(game, b, bd ? bd.poly : null, () => !lockReason(b)); } catch (e) { console.error('[supermarkets] plan', b.id, e); }
        const ex = buildExterior(game, b, bd ? bd.poly : null, plan ? { holes: plan.holes } : null);
        stores.push(ex); S.stores[b.id] = { branch: b, ext: ex, npcs: [], queue: [], reducedTaken: {}, id: IDP + b.id, plan };
      } catch (e) { console.error('[supermarkets] exterior failed', b.id, e); }
    }
    const extDoors = exteriorDoors(game, stores.filter((s) => s.door && !s.sl));      // (a walk-in shop's doors are the room's own)
    // Westgate: the covered Church Lane passage ran through where the shopfront is drawn — close it behind the glass
    const wg = S.stores.sainsburys_westgate;
    if (wg && wg.ext.door) {
      const E = wg.ext.door.E, [ax, az] = E.P(0, 0.05), [bx, bz] = E.P(E.L, 0.05);
      for (const p of game.worldCollider.passages || []) {
        const d = Math.min(Math.hypot(p.x1 - E.a[0], p.z1 - E.a[1]), Math.hypot(p.x2 - E.a[0], p.z2 - E.a[1]), Math.hypot(p.x1 - E.b[0], p.z1 - E.b[1]), Math.hypot(p.x2 - E.b[0], p.z2 - E.b[1]));
        if (d < 3.5) p.on = false;
      }
      game.worldCollider.addSegment(ax, az, bx, bz, { tag: 'building' });
    }
    // clear stray street furniture from the doorways
    for (const s of stores) if (s.door) { try { const [x, z] = s.door.E.P(s.door.t, 0.8), r = 1.2; game.world.clearArea([[x - r, z - r], [x + r, z - r], [x + r, z + r], [x - r, z + r]], { trees: false, lamps: false }); } catch { /* optional */ } }
    // cash machines in the wall: one free £10 a day (student account)
    const atmUse = () => {
      const f = st.flags || (st.flags = {});
      if (f.shopAtmDay === dayIdx()) { buzz(); game.ui.toast('"Daily withdrawal limit reached." It is a student account.', 3.5); return; }
      f.shopAtmDay = dayIdx(); game.pay(10); beep(); game.ui.toast('You withdraw £10. Somewhere, your overdraft sighs.', 3.5);
    };
    for (const s of stores) if (s.atm) game.interact.add({ pos: s.atm, radius: 1.3, label: 'Use the cash machine', onUse: atmUse });

    // ---------------------------------------------------------------------------------------------- people helpers
    const spawn = (rec, x, z, look, opts = {}) => {
      if (!game.pedestrians) return null;
      try {
        const p = game.pedestrians.spawnAt(x, z, look, { place: rec.id, scene: rec.scene, knockable: false, ...opts });
        p.y = rec.ground(x, z); return p;
      } catch (e) { console.error('[supermarkets] spawn', e); return null; }
    };
    const staffLook = (b, seed) => ({ ...randomLook('shop-' + b.id + seed, { outfit: 'shopworker' }), uniform: b.brand === 'tesco' ? BRAND.tesco.uniform : (seed % 3 === 2 ? 0x6a1a2a : BRAND.sainsburys.uniform), prop: null, hat: null, backpack: null, scarf: null });
    const guardLook = (seed) => ({ ...randomLook('guard' + seed, { outfit: 'smart' }), jacket: 0x16181b, jacketLen: 'waist', shirt: 0xf4f4f4, neck: 'tie', neckColor: 0x111111, bottom: 0x16181b, legs: 'trousers', hat: null, glasses: false, prop: null, backpack: null, scarf: null, hivis: undefined });
    const shopperLook = (seed, prop = null) => ({ ...randomLook(seed, { outfit: 'casual' }), prop, hat: null });
    // basket carried by NPCs / the player (shared geometry + material, 1 draw call each)
    const basketGeo = new THREE.BoxGeometry(0.42, 0.2, 0.3).translate(0, -0.1, 0);
    const basketMats = { tesco: new THREE.MeshStandardMaterial({ color: BRAND.tesco.basket, roughness: 0.6 }), sainsburys: new THREE.MeshStandardMaterial({ color: BRAND.sainsburys.basket, roughness: 0.6 }) };
    const attachBasket = (ch, brand) => { const m = new THREE.Mesh(basketGeo, basketMats[brand]); m.position.set(0, -0.12, 0.05); m.name = 'shop-basket'; ch.anchors.handR.add(m); return m; };
    const setState = (p, x, z, speed, dt, face) => {   // custom-driven NPC (the pedestrian system leaves unknown states alone)
      p.state = 'shop';
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, speed * dt); p.x += (dx / d) * step; p.z += (dz / d) * step; p.speed = step / Math.max(dt, 1e-4);
        const want = Math.atan2(dx, dz); let a = want - p.heading; a = Math.atan2(Math.sin(a), Math.cos(a)); p.heading += a * Math.min(1, dt * 8);
      } else {
        p.speed = 0;
        if (face !== undefined) { let a = face - p.heading; a = Math.atan2(Math.sin(a), Math.cos(a)); p.heading += a * Math.min(1, dt * 5); }
      }
      return d;
    };

    // ---------------------------------------------------------------------------------------------- basket / buying
    // What other players see of our shopping (core/_mp_actions.js: a record per player, sent when it changes):
    //   'basket' [brand letter, product ids]   the basket in our hand with what is in it (while we are in the shop)
    //   'shelf'  [[branch, bay, n], ...]       the packs we have taken off shelves today (bought, or still in the basket)
    // A bay's shelves show everybody's: R.setTaken(bay, ours + theirs) (_shop_interior.js).
    const NA = game.net && game.net.actions ? game.net.actions : null;
    const BR = Object.keys(BRANCHES), mine = []; let mineDay = -1, shelfRev = 1;
    /** the goods standing in a basket (one small mesh on the shop's own goods atlas; the last 8 things put in) */
    const fillBasket = (m, brand, ids) => {
      const old = m.getObjectByName('shop-goods'); if (old) { old.removeFromParent(); old.geometry.dispose(); }
      m.userData.goods = ids.slice();
      if (!ids.length) return;
      const pa = productAtlas(brand), M = new Mesher(), n = Math.min(ids.length, 8);
      for (let i = 0; i < n; i++) {
        const id = ids[ids.length - n + i], p = PRODUCTS[id], t = pa.A.uv.get(id); if (!p || !t) continue;
        const x = -0.15 + (i % 4) * 0.1, z = i < 4 ? 0.07 : -0.07;
        if (p.shape === 'bottle' || p.shape === 'tin') { const h = Math.min(p.h, 0.3); M.cyl(x, Math.max(-0.19, 0.05 - h), z, Math.min(p.w / 2, 0.045), h, 6, { uv: t }); }
        else { let h = p.h, d = p.d; if (h < d) { h = p.d; d = p.h; } M.box(x, Math.max(-0.19, 0.05 - h), z, Math.min(p.w, 0.2), h, Math.min(d, 0.1), ((i * 7) % 5 - 2) * 0.12, { uv: t, uvFront: t, color: 0xffffff }); }      // (a flat pack stands on its long edge: it shows over the rim)
      }
      if (M.empty) return;
      const g = new THREE.Mesh(M.geometry(), pa.mat); g.name = 'shop-goods'; m.add(g);
    };
    const shelves = (rec) => {
      const R = rec.R; rec.shelfR = R; rec.shelfRev = shelfRev; if (!R || !R.setTaken) return;
      const b = BR.indexOf(rec.branch.id), n = new Map(), add = (q) => { if (Array.isArray(q) && q[0] === b && q[2] > 0) n.set(q[1], (n.get(q[1]) || 0) + q[2]); };
      mine.forEach(add); if (NA) NA.each('shelf', (v) => { if (Array.isArray(v)) v.forEach(add); });
      for (let i = 0; i < R.bays.length; i++) { const k = n.get(i) || 0; if ((R.bays[i].taken || 0) !== k) R.setTaken(i, k); }
    };
    const shelvesIfChanged = (rec) => { if (rec.shelfR !== rec.R || rec.shelfRev !== shelfRev) shelves(rec); };
    /** a pack leaves bay bi of this shop (d = +1) or goes back on it (-1) */
    const offShelf = (rec, bi, d) => {
      if (!(bi >= 0)) return;
      if (mineDay !== dayIdx()) { mineDay = dayIdx(); mine.length = 0; }      // (restocked overnight)
      const b = BR.indexOf(rec.branch.id); let e = mine.find((q) => q[0] === b && q[1] === bi);
      if (!e) { if (d < 0) return; mine.push(e = [b, bi, 0]); if (mine.length > 24) mine.shift(); }
      e[2] = Math.max(0, e[2] + d); if (!e[2]) mine.splice(mine.indexOf(e), 1);
      if (NA) NA.set('shelf', mine.length ? mine : null);
      shelfRev++; shelves(rec);
    };
    const bayOf = (rec, id) => {      // the nearest bay of that product with packs of its own on show
      const R = rec.R, p = game.player.pos; let best = -1, bd = 1e9; if (!R) return -1;
      for (let i = 0; i < R.bays.length; i++) { const q = R.bays[i]; if (q.id !== id || !q.slots || !q.slots.length) continue; const d = Math.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.y - p.y) * 4; if (d < bd) { bd = d; best = i; } }
      return best;
    };
    let playerBasket = null;
    /** our basket, to us and to everyone else: call after anything is put in or taken out */
    const tell = () => {
      const on = !!(S.current && S.basket && S.basket.count), ids = on ? S.basket.items.map((i) => i.id) : [];
      if (playerBasket && on) fillBasket(playerBasket, S.current.branch.brand, ids);
      if (NA) NA.set('basket', on ? [S.current.branch.brand[0], ids.slice(-8)] : null);
    };
    if (NA) {
      NA.kind('basket', {
        apply(o, v) {
          this.remove(o); if (!Array.isArray(v) || !Array.isArray(v[1])) return;
          const brand = v[0] === 's' ? 'sainsburys' : 'tesco';
          o._shopBasket = attachBasket(o.character, brand); fillBasket(o._shopBasket, brand, v[1].filter((id) => PRODUCTS[id]).slice(0, 8));
        },
        remove(o) { const m = o._shopBasket; if (!m) return; o._shopBasket = null; const g = m.getObjectByName('shop-goods'); if (g) g.geometry.dispose(); m.removeFromParent(); },
      });
      NA.kind('shelf', { apply() { shelfRev++; }, remove() { shelfRev++; } });
    }
    const showBasket = (on) => {
      const ch = game.player.character;
      if (on && S.current) {
        if (!playerBasket || playerBasket.parent !== ch.anchors.handR) { if (playerBasket) playerBasket.removeFromParent(); playerBasket = attachBasket(ch, S.current.branch.brand); }
      } else if (playerBasket) { playerBasket.removeFromParent(); playerBasket = null; }
    };
    const take = (id, price, reduced = false, bi = -1) => {
      const rec = S.current; if (!rec || !S.basket) return null;
      if (!S.basket.count) game.ui.toast('You grab a basket.', 2);
      const it = S.basket.add(id, price ?? PRODUCTS[id].price, reduced);
      if (it && !reduced) { it.bay = bi >= 0 ? bi : bayOf(rec, id); offShelf(rec, it.bay, 1); }
      showBasket(true); tell();
      game.ui.toast(`${productName(id, rec.branch.brand)} — ${money(it.price)}`, 2);
      return it;
    };
    S.take = (id) => take(id);
    /** put the i-th thing in the basket (default: the last) back on its shelf */
    const putBack = (i) => {
      const rec = S.current, bk = S.basket; if (!rec || !bk || !bk.count) return null;
      const it = bk.remove(i === undefined ? bk.count - 1 : i); if (!it) return null;
      offShelf(rec, it.bay, -1); if (!bk.count) showBasket(false); tell();
      return it;
    };
    S.putBack = (i) => { const it = putBack(i); return it ? it.id : null; };
    S.shelfTaken = (branchId) => { const rec = branchId ? S.stores[branchId] : S.current, out = {}; if (rec && rec.R) { shelvesIfChanged(rec); rec.R.bays.forEach((q, i) => { if (q.taken) out[i] = q.taken; }); } return out; };
    S.bayOf = (id) => (S.current ? bayOf(S.current, id) : -1);
    S.basketInfo = () => S.basket && { items: S.basket.items.map((i) => i.id), subtotal: S.basket.subtotal, total: S.basket.total, mealDeals: S.basket.mealDeals() };
    const toInventory = (items, brand, paid) => {
      for (const it of items) st.inventory.push({ id: it.id, name: productName(it.id, brand), brand, paid });
      while (st.inventory.length > 40) st.inventory.shift();
    };
    let bagPending = null, bagT = 0, bagProp = null, prevProp = null;
    /** Pay for the basket. Returns {ok, msg}. */
    const pay = () => {
      const rec = S.current, bk = S.basket; if (!rec || !bk) return { ok: false, msg: '' };
      const total = bk.total;
      if (!game.pay(-total)) return { ok: false, msg: `Card declined — you have ${money(st.money)}. Put something back (Esc).` };
      const md = bk.mealDeals();
      toInventory(bk.items, rec.branch.brand, true);
      game.ui.toast(`Paid ${money(total)}${md.n ? ` (meal deal saved ${money(md.saving)})` : ''}. Thanks for shopping at ${rec.branch.short}!`, 4);
      bagPending = rec.branch.brand; bk.clear(); showBasket(false); tell(); game.save();
      return { ok: true, msg: '' };
    };
    const alcoholCheck = () => {
      const rec = S.current, removed = S.basket.enforceAlcohol(rec.branch, hour());
      if (removed.length) { for (const it of removed) offShelf(rec, it.bay, -1); tell(); }      // (back on the shelf)
      if (removed.length) return { removed: true, msg: `Alcohol can't be sold between 11pm and 6am — ${removed.length} item(s) removed.` };
      return { removed: false, msg: 'Think 25: the assistant checks your Bod card. "Worcester? Fancy." Approved.' };
    };

    // ---------------------------------------------------------------------------------------------- self-checkout
    const startSco = (rec, sco) => {
      if (!S.basket.count) { game.ui.toast('Your basket is empty.'); return null; }
      const pa = productAtlas(rec.branch.brand).A;
      const asst = rec.npcs.find((n) => n.kind === 'assistant');
      const ctl = openSco(game, {
        basket: S.basket, brand: rec.branch.brand, atlasCanvas: pa.c, uv: (id) => pa.uv.get(id), beep, buzz, say,
        onStall: () => { if (asst) { asst.target = [sco.x + Math.cos(sco.h) * 0.9, sco.z - Math.sin(sco.h) * 0.9]; asst.ped.character.say('I\'ll be right there…', 2.5); } },
        onResume: () => { if (asst) { asst.ped.character.say('There you go.', 2); asst.target = null; } },
        pay, alcoholCheck,
      });
      S.sco = ctl; return ctl;
    };
    S.scoStart = (i = 0) => { const rec = S.current; if (!rec) return 'not in a shop'; return startSco(rec, rec.R.scos[i]) ? 'ok' : 'empty'; };
    S.scoPress = () => S.sco && S.sco.press();
    S.forceStall = () => { const s = S.sco?.s; if (!s || s.state !== 'scan') return false; s.state = 'stall'; s.stallT = s.assistDelay; s.msg = 'Unexpected item in the bagging area.'; buzz(); say('Unexpected item in the bagging area.'); return true; };
    S.scoState = () => S.sco && { state: S.sco.s.state, idx: S.sco.s.idx, n: S.sco.s.items.length, x: S.sco.s.x };
    S.scoAutoScan = () => { const s = S.sco?.s; if (!s || s.state !== 'scan') return null; s.x = 0; s.wob = 0; s.y = 0; return S.sco.press(); };

    // ---------------------------------------------------------------------------------------------- staffed till + queue
    const tillCheckout = async (rec) => {
      const b = rec.branch, bk = S.basket;
      if (!bk || !bk.count) { game.ui.toast('Your basket is empty.'); return false; }
      const lines = [b.brand === 'tesco' ? 'Hiya! Have you got a Clubcard?' : 'Hello! Have you got a Nectar card?'];
      const removed = bk.enforceAlcohol(b, hour());
      if (removed.length) { for (const it of removed) offShelf(rec, it.bay, -1); tell(); }
      if (removed.length) lines.push("Sorry, I can't sell alcohol after eleven. I'll pop that back for you.");
      else if (bk.hasAlcohol()) lines.push("We're a Think 25 store — have you got any ID?", { who: 'You', text: '(You show your Bod card.)' }, 'Worcester? Very nice. Thanks.');
      const md = bk.mealDeals();
      if (md.n) lines.push(md.n > 1 ? `That's ${md.n} meal deals.` : "Oh, that's a meal deal.");
      lines.push('Do you need a bag? They\'re free.', `That's ${money(bk.total)}, please.`);
      game.player.frozen++;
      try { await game.ui.dialog(rec.cashierName || 'Cashier', lines); } finally { game.player.frozen--; }
      const r = pay(); if (!r.ok) { buzz(); game.ui.toast(r.msg || 'Payment failed.', 4); return false; }
      beep(); return true;
    };
    S.till = () => (S.current ? tillCheckout(S.current) : Promise.resolve(false));
    const slotsOf = (rec) => { const t = rec.R.tills.find((q) => !q.closed); return t ? [[t.cust[0], t.cust[1]], ...rec.L.queue] : []; };
    const joinQueue = (rec) => {
      if (!S.basket.count) { game.ui.toast('Pick something up first.'); return; }
      const slots = slotsOf(rec), pq = (rec.pq = { idx: Math.min(rec.queue.length, slots.length - 1) });
      game.ui.toast(`You join the queue. ${rec.queue.length} ahead of you.`, 3);
      game.beginActivity({
        name: 'shop-queue', pointer: 'locked', hint: 'Queueing for the till',
        update(dt) {
          const p = game.player, [tx, tz] = slots[pq.idx], d = Math.hypot(tx - p.pos.x, tz - p.pos.z);
          if (d > 0.15) { p.heading = Math.atan2(tx - p.pos.x, tz - p.pos.z); p.speed = Math.min(1.3, d * 3); }
          if (pq.idx === 0 && d < 0.3) { game.endActivity(); tillCheckout(rec); }
        },
        onEnd() { rec.pq = null; },
      });
    };

    // ---------------------------------------------------------------------------------------------- theft
    const steal = (rec, walkedOut = false) => {
      const b = rec.branch, items = S.basket.items.slice();
      alarm();
      const g = rec.npcs.find((n) => n.kind === 'guard'); if (g) g.ped.character.say('Oi! You haven\'t paid for that!', 3);
      toInventory(items, b.brand, false); S.basket.clear(); showBasket(false); tell();
      ban(st, b.id, now()); game.save();
      S.chase = { branch: b, ext: S.stores[b.id].ext, t: 0, ped: null, phase: 'wait' };
      game.ui.toast(`The alarm goes off! You leg it with ${items.length} item(s). You're barred from ${b.short} for a day.`, 5);
      if (!walkedOut) { rec.stealing = true; try { game.interiors.exit(); } finally { rec.stealing = false; } }
    };
    S.steal = () => { if (!S.current) return 'not in a shop'; if (!S.basket.count) take('crisps'); steal(S.current); return 'ok'; };
    const leave = (rec) => { if (S.basket && S.basket.count) steal(rec); else game.interiors.exit(); };

    // ---------------------------------------------------------------------------------------------- population
    const clearNpcs = (rec, keep) => { for (let i = rec.npcs.length - 1; i >= 0; i--) { const n = rec.npcs[i]; if (keep && keep(n)) continue; game.pedestrians && game.pedestrians.remove(n.ped); rec.npcs.splice(i, 1); } rec.queue = rec.npcs.filter((n) => n.kind === 'queue'); };
    const band = (h) => (h < 7 ? 'night' : h < 11.5 ? 'morning' : h < 14 ? 'lunch' : h < 17 ? 'afternoon' : h < 18 ? 'evening' : h < 21 ? 'late' : 'night');
    const populate = (rec, force) => {
      if (!rec.R || !game.pedestrians) return;
      const b = rec.branch, L = rec.L, h = hour(), bd = band(h), open = openNow(b), day = dayIdx();
      const sig = `${bd}|${open}|${day}|${rec.queueTarget}`;
      if (!force && sig === rec.popSig) return;
      rec.popSig = sig;
      clearNpcs(rec, (n) => n.kind === 'leaver');
      let seed = day * 31 + (b.id.length * 7);
      const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      const add = (kind, p, extra = {}) => { if (p) rec.npcs.push({ kind, ped: p, ...extra }); return p; };
      // staff
      if (open || h >= 21 || h < 7) add('guard', spawn(rec, L.guard[0], L.guard[1], guardLook(day % 4), { heading: L.guard[2], lines: GUARD_LINES, role: 'security' }), { home: [L.guard[0], L.guard[1], L.guard[2]] });
      if (open) {
        let k = 0;
        for (const t of rec.R.tills) if (!t.closed) { const p = add('cashier', spawn(rec, t.cashier[0], t.cashier[1], staffLook(b, day + k++), { heading: t.cashier[2], lines: ['Next, please!', 'Can I help who\'s next?', 'Lovely, thanks.'], role: 'cashier' })); if (p) p.character.setPose('stand'); }
        if (rec.R.scos.length) add('assistant', spawn(rec, L.assistant[0], L.assistant[1], staffLook(b, day + 7), { heading: L.assistant[2], lines: STAFF_LINES[b.brand], role: 'staff' }), { home: [L.assistant[0], L.assistant[1], L.assistant[2]] });
        // shoppers
        const nShop = { morning: 2, lunch: 3, afternoon: 2, evening: 3, late: 2, night: 1 }[bd];
        for (let i = 0; i < nShop && i < L.shoppers.length; i++) {
          const sp = L.shoppers[(i + day) % L.shoppers.length];
          // (they browse on the shared clock, steered here — tickNpcs — against the shop's own fixtures, so they do it the same seen from the street)
          const p = add('shopper', spawn(rec, sp[0], sp[1], shopperLook('shopper' + day + i + b.id), { heading: r() * 6.28, lines: SHOPPER_LINES }), { home: sp, seed: (day * 131 + i * 17 + b.id.length * 7) | 0 });
          if (p) attachBasket(p.character, b.brand);
        }
        // the queue (snakes down an aisle at lunchtime)
        const target = rec.queueTarget = { morning: 1, lunch: 6, afternoon: 2, evening: 4, late: 2, night: 1 }[bd];
        const slots = slotsOf(rec);
        // WHO is in the queue is the same for every player whenever they came in: the queue this band of the day began
        // with, then every serve (8 s slots) and arrival (10 s slots) of the shared clock since, replayed here — the same
        // rules as tickNpcs keeps to from now on. (It used to start again from the band's first queue for each player as
        // they arrived, so two players in the shop had different people at the tills.)
        const cap = Math.min(target, slots.length - 1), who = []; for (let i = 0; i < cap; i++) who.push('q' + day + i + b.id + bd);
        { const t1 = now(), hAt = (t) => (((t % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS * 24, pinned = game.time.pinned !== null && game.time.pinned !== undefined;
          let t0 = t1; if (!pinned) for (let k = 0; k < 400 && band(hAt(t0 - 10000)) === bd && Math.floor((t0 - 10000) / DAY_MS) === day; k++) t0 -= 10000;
          t0 = Math.ceil(t0 / 10000) * 10000 - 10000;      // (the band's own first instant, whenever this client looked)
          for (let sk = Math.floor(t0 / 8000) + 1, ak = Math.floor(t0 / 10000) + 1; ;) {
            const ts = sk * 8000, ta = ak * 10000; if (Math.min(ts, ta) > t1) break;
            if (ts <= ta) { who.shift(); sk++; } else { if (who.length < cap) who.push('qa' + ak + b.id); ak++; }
          }
          rec.serveK = Math.floor(t1 / 8000); rec.arriveK = Math.floor(t1 / 10000); }
        for (let i = 0; i < who.length; i++) {
          const p = add('queue', spawn(rec, slots[i][0], slots[i][1], shopperLook(who[i]), { heading: 0, lines: QUEUE_LINES }));
          if (p) attachBasket(p.character, b.brand);
        }
        // yellow-sticker circlers
        if (h >= 17.5 && h < 23 && L.yellow) for (let i = 0; i < 2; i++) add('circler', spawn(rec, L.yellow[0] + (i ? 1 : -1), L.yellow[1], { ...shopperLook('yc' + day + i, null), backpack: [0x2a3a5a, 0x5a2a2a][i] }, { lines: CIRCLER_LINES }), { a: i * PI });
      }
      else rec.queueTarget = 0;      // (shut: nobody joins a queue)
      // shelf-stackers at night
      if (h >= 21 || h < 7) for (const s of L.stackers) add('stacker', spawn(rec, s[0], s[1], staffLook(b, day + 11 + s[0] | 0), { heading: s[2], pose: 'crouch', lines: ['Mind your back.', 'Night shift, innit.', 'Delivery came late again.'] }));
      rec.queue = rec.npcs.filter((n) => n.kind === 'queue');
      for (const n of rec.npcs) n.ped.character.noLod = true;      // (few, near, and seen through glass from another frame of reference: never the far impostor)
      if (rec.cage) rec.cage.visible = h >= 21 || h < 7;
      rec.serveT = 6; rec.arriveT = 8;
    };
    // a shopper's browsing: every 9 s (shared clock) a new spot within reach of their aisle that they can walk straight to
    const hsh = (a, k) => { let t = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((k | 0) + 1, 0x85ebca6b)) >>> 0; t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d) >>> 0; t ^= t >>> 12; return (t >>> 0) / 4294967296; };
    const browse = (rec, n, dt) => {
      const P = 9, k = Math.floor(game.time.now() / 1000 / P + hsh(n.seed, 3)), col = rec.col, H = n.home;
      if (n.wk !== k) {
        n.wk = k; n.wt = n.wt || [H[0], H[1]]; let tx = H[0], tz = H[1];
        for (let i = 0; i < 8; i++) {
          const a = hsh(n.seed, k * 16 + i) * 6.2832, r = Math.sqrt(hsh(n.seed, k * 16 + i + 8)) * H[2], x = H[0] + Math.sin(a) * r, z = H[1] + Math.cos(a) * r;
          if (col && (col.raycast(H[0], H[1], x, z) !== null || (col.isFree && !col.isFree(x, z, 0.38)))) continue;
          tx = x; tz = z; break;
        }
        n.wt[0] = tx; n.wt[1] = tz;
      }
      setState(n.ped, n.wt[0], n.wt[1], 0.8, dt);
    };
    S.population = () => { const rec = S.current; return rec ? rec.npcs.map((n) => ({ kind: n.kind, x: +n.ped.x.toFixed(1), z: +n.ped.z.toFixed(1), vis: n.ped.character.group.visible })) : []; };
    S.refresh = () => { if (S.current) { S.current.popSig = ''; populate(S.current, true); } return S.population(); };

    const _camL = [0, 0];
    const tickNpcs = (rec, dt, street = false) => {
      const b = rec.branch, slots = slotsOf(rec), cam = game.camera.position;
      // (seen from the street: the camera in the shop's own coordinates)
      let camX = cam.x, camZ = cam.z; if (street && rec.def && rec.def.sl) { rec.def.sl.toLocal(cam.x, cam.z, _camL); camX = _camL[0]; camZ = _camL[1]; }
      // queue: everyone shuffles to their slot; the front one gets served
      const q = rec.queue;
      for (let i = 0; i < q.length; i++) {
        const n = q[i], [tx, tz] = slots[Math.min(i, slots.length - 1)], [fx, fz] = i ? slots[i - 1] : (rec.R.tills.find((t) => !t.closed)?.cashier || [tx, tz - 1]);
        setState(n.ped, tx, tz, 1.0, dt, Math.atan2(fx - tx, fz - tz));
      }
      // served / arriving on shared 8 s / 10 s slots (looks seeded by the slot), so every player sees the same queue;
      // the local player's own turn in the queue (rec.pq) keeps its faster local timer
      const sk = Math.floor(game.time.now() / 8000), ak = Math.floor(game.time.now() / 10000);
      let serve = false;
      if (rec.pq) { rec.serveT -= dt * 2.6; if (rec.serveT <= 0) { rec.serveT = 6 + Math.random() * 4; serve = true; } }
      else if (sk !== rec.serveK) { serve = rec.serveK !== undefined; rec.serveK = sk; }
      if (serve) {
        const front = q[0];
        if (front && Math.hypot(front.ped.x - slots[0][0], front.ped.z - slots[0][1]) < 0.4) {
          game.pedestrians.remove(front.ped); rec.npcs.splice(rec.npcs.indexOf(front), 1); q.shift();
          if (rec.pq) rec.pq.idx = Math.max(0, rec.pq.idx - 1);
          const look = shopperLook('lv' + sk + b.id, b.brand === 'tesco' ? 'bag-tesco' : 'bag-sainsburys'), lv = spawn(rec, slots[0][0], slots[0][1], look, {});
          if (lv) { lv.character.noLod = true; rec.npcs.push({ kind: 'leaver', ped: lv, look, leg: 0 }); }
        }
      }
      if (ak !== rec.arriveK) {
        const first = rec.arriveK === undefined; rec.arriveK = ak;
        if (!first && !rec.pq && openNow(b) && q.length < (rec.queueTarget || 0) && q.length < slots.length - 1) {
          const s = slots[q.length], p = spawn(rec, s[0], s[1], shopperLook('qa' + ak + b.id), { lines: QUEUE_LINES });
          if (p) { attachBasket(p.character, b.brand); const n = { kind: 'queue', ped: p }; rec.npcs.push(n); q.push(n); }
        }
      }
      for (let i = rec.npcs.length - 1; i >= 0; i--) {
        const n = rec.npcs[i], p = n.ped;
        if (n.kind === 'leaver') {
          // to the doors, and (walk-in) out through them on to the pavement, where they become one of the street's walkers
          const ex = rec.L.exit, S0 = rec.sl && rec.def && rec.def.sl;
          if (!n.leg) { if (setState(p, ex[0], ex[1] + 0.3, 1.25, dt) < 0.4) { if (S0) n.leg = 1; else { game.pedestrians.remove(p); rec.npcs.splice(i, 1); } } }
          else if (setState(p, ex[0], 0.95, 1.25, dt) < 0.25) {
            const w = S0.toWorld(p.x, p.z, _camL), solo = !(game.net && game.net.connected && game.net.others && game.net.others.size);      // (one walker, not one per player who saw them leave)
            game.pedestrians.remove(p); rec.npcs.splice(i, 1);
            if (solo && game.pedestrians.adopt) { try { game.pedestrians.adopt(w[0], w[1], n.look, { standing: true, heading: S0.rot }); S.walkedOut = (S.walkedOut || 0) + 1; } catch { /* the street is full */ } }
          }
        }
        else if (n.kind === 'circler') {
          n.a = (n.a0 ?? (n.a0 = n.a)) + (game.time.now() % 3600000) / 1000 * 0.45; const cx = rec.L.yellow[0], cz = rec.L.yellow[1];     // (shared clock)
          setState(p, cx + Math.cos(n.a) * 1.1, cz + Math.sin(n.a) * 0.9, 0.7, dt);
        } else if (n.kind === 'assistant') {
          const t = n.target || n.home; setState(p, t[0], t[1], 1.6, dt, n.target ? undefined : n.home[2]);
        } else if (n.kind === 'shopper') browse(rec, n, dt);
      }
      // visibility: only the nearest few people on this floor are drawn (draw-call budget)
      if (!((rec.visT -= dt) > 0)) {
        rec.visT = 0.25;
        const py = street ? 0 : game.player.pos.y, arr = rec.visArr || (rec.visArr = []), far = street ? 1300 : 400;
        arr.length = 0;
        for (const n of rec.npcs) { const p = n.ped; const sameFloor = Math.abs((p.y || 0) - py) < 2.5; const d = (p.x - camX) ** 2 + (p.z - camZ) ** 2; n.d2 = sameFloor ? d : 1e9; arr.push(n); }
        arr.sort((a, c) => a.d2 - c.d2);
        for (let i = 0; i < arr.length; i++) arr[i].vis = i < 6 && arr[i].d2 < far;
      }
      // (…and only while the room itself is being drawn through an opening: core/_roomview.js REAL / BLEND, not its far picture)
      const ops = street && rec.def && rec.def.sl && rec.def.sl.ops; let live = true;
      if (ops) { live = false; for (let i = 0; i < ops.length; i++) if (ops[i].kind === 2 || ops[i].kind === 5) { live = true; break; } }
      for (const n of rec.npcs) {
        const ch = n.ped.character; ch.group.visible = !!n.vis;
        // (from the street the pedestrian system does not animate a room's people: the ones on show are posed here)
        if (street && live && n.vis && n.ped.active) { n.ped.y = rec.ground(n.ped.x, n.ped.z); ch.group.position.set(n.ped.x, n.ped.y, n.ped.z); ch.group.rotation.y = n.ped.heading; ch.update(dt, n.ped.speed || 0); }
      }
    };

    // ---------------------------------------------------------------------------------------------- interiors
    for (const b of Object.values(BRANCHES)) {
      const rec = S.stores[b.id]; if (!rec || !rec.ext.doorPos) continue;
      const plan = rec.plan, L = (rec.L = plan ? plan.L : LAYOUTS[b.id]);
      rec.ground = groundFor(b.id);
      const def = rec.def = game.interiors.register({
        id: rec.id, name: b.name, background: 0x0e1012, ambient: 0.62,
        doors: [{ pos: rec.ext.doorPos, facing: rec.ext.doorFacing, label: `Go into ${b.short}`, locked: () => lockReason(b) }],
        seamless: plan ? plan.seamless : null,
        *build(ctx) {      // (in pieces: core/interiors.js `*build`)
          rec.scene = ctx.scene;
          const sl = (rec.sl = !!(ctx.seamless && plan));
          const R = (rec.R = yield* buildInterior(ctx.scene, ctx.collider, b, L, game.world, sl ? { wins: plan.wins, lift: !!ctx.addDoor } : null));
          rec.col = ctx.collider;
          yield;
          if (sl) {
            ctx.scene.add(glazing(plan.seamless.openings, {}));
            rec.door = cityDoor(ctx, plan, { kind: 'slide', open: () => !lockReason(b), rangeOut: 2.6, rangeIn: 1.5, setBack: 0.18 });      // (the inside sensor is short: the guard stands by the door)
            // the one "closed" notice is the card on the door's own leaf (it moves with the door): made a readable size
            if (rec.door && rec.door.sign) rec.door.sign.scale.set(1, 2.6, 2.6);
            R.setDeep(true, false);      // (all of the ground floor's goods whenever the shop is shown: nothing pops in as you walk up; one draw)
          }
          // the lift (Tesco Magdalen Street): a real car between the ground floor and the lower floor — you walk in, the
          // doors shut, it carries you, the doors open (places/_maths_lift.js). The lower floor is laid out beyond the
          // ground floor in plan, so the car travels in plan as well (`shift`), shut.
          rec.lift = null;
          if (sl && R.lifts.length === 2 && R.lifts.every((q) => q.real)) {
            try {
              const up = R.lifts.find((q) => q.y > -1), dn = R.lifts.find((q) => q !== up), sh = up.shaft, LM = liftMats();
              rec.lift = makeLift(ctx, game, { place: ctx.id, axis: 'x', x0: sh.x0, x1: sh.x1, z0: sh.z0, z1: sh.z1, levels: [dn.y, up.y], ends: ['x1', 'x1'], doorW: LIFT.doorW, doorH: LIFT.doorH, start: 1, carH: 2.3,
                shift: [dn.shaft.x0 - sh.x0, dn.shaft.z0 - sh.z0], time: 7, mats: LM });
            } catch (e) { console.error('[supermarkets] lift', e); rec.lift = null; }
          }
          if (b.id === 'tesco_magdalen') { const lift = rec.lift, g0 = rec.ground; ctx.setGround(lift ? (x, z) => { const y = lift.ground(x, z); return y === null ? g0(x, z) : y; } : g0); }
          for (const o of ctx.scene.children) if (o.isHemisphereLight) { o.intensity = 0.55; o.color.setHex(0xf4f8ff); o.groundColor.setHex(0x8a8f96); }
          // the lights by opening hours: shut = the night lights only (the stackers work by them)
          rec.lamps = []; for (const o of ctx.scene.children) if (o.isLight) rec.lamps.push([o, o.intensity]);
          rec.lit = null;
          // night-shift roll cages
          const cg = new THREE.Group();
          for (const s of L.stackers) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x8a929a, wireframe: true })); m.position.set(s[0] - Math.sin(s[2]) * 0.9, (s[3] || 0) + 0.8, s[1] - Math.cos(s[2]) * 0.9); cg.add(m); }
          cg.visible = false; ctx.scene.add(cg); rec.cage = cg;
          const I = (o) => game.interact.add({ place: ctx.id, ...o });
          for (const bay of R.bays) I({ pos: [bay.x, bay.y, bay.z], radius: 0.9, label: () => `Take ${productName(bay.id, b.brand)} (${money(PRODUCTS[bay.id].price)})`, onUse: () => take(bay.id, undefined, false, R.bays.indexOf(bay)), enabled: () => !game.activity });
          if (R.reduced) {
            const rr = R.reduced, left = () => reducedCount(hour(), rr.slots.length) - (rec.reducedTaken[dayIdx()] || 0);
            const pick = () => REDUCED_ITEMS[((rec.reducedTaken[dayIdx()] || 0) + dayIdx()) % REDUCED_ITEMS.length];
            I({ pos: [rr.x, rr.y, rr.z], radius: 1.0, enabled: () => left() > 0,
              label: () => `Grab a yellow-sticker ${productName(pick(), b.brand).replace(/^(Tesco|Sainsbury's) /, '')} (${money(reducedPrice(pick(), hour()))}, was ${money(PRODUCTS[pick()].price)})`,
              onUse: () => { const id = pick(); rec.reducedTaken[dayIdx()] = (rec.reducedTaken[dayIdx()] || 0) + 1; take(id, reducedPrice(id, hour()), true); const c = rec.npcs.find((n) => n.kind === 'circler'); if (c) c.ped.character.say('Noooo, that was mine!', 2.5); } });
            I({ pos: [rr.x, rr.y, rr.z], radius: 1.0, enabled: () => left() <= 0, label: () => (hour() < 16 ? 'Reduced to clear — nothing yet (comes out late afternoon)' : 'Reduced to clear — picked clean'), onUse: () => {} });
          }
          const openTill = R.tills.find((t) => !t.closed);
          if (openTill) {
            I({ pos: [openTill.cust[0], openTill.y, openTill.cust[1]], radius: 1.0, enabled: () => !rec.queue.length && !!S.basket?.count, label: () => `Pay at the till (${money(S.basket.total)})`, onUse: () => tillCheckout(rec) });
            I({ pos: () => { const s = slotsOf(rec)[Math.min(rec.queue.length, slotsOf(rec).length - 1)]; return new THREE.Vector3(s[0], 0, s[1]); }, radius: 1.3, enabled: () => rec.queue.length > 0 && !!S.basket?.count && !rec.pq, label: () => `Join the queue for the till (${rec.queue.length} ahead)`, onUse: () => joinQueue(rec) });
          }
          for (const t of R.tills) if (t.closed) I({ pos: [t.cust[0], t.y, t.cust[1]], radius: 0.9, label: 'This till is closed', onUse: () => game.ui.toast('"Sorry, this till\'s closed." There is always one closed.', 3) });
          R.scos.forEach((s) => I({ pos: [s.x, s.y, s.z], radius: 0.75, enabled: () => !!S.basket?.count, label: () => `Use the self-checkout (${S.basket.count} items)`, onUse: () => startSco(rec, s) }));
          for (const lf of R.lifts) if (!rec.lift) I({ pos: [lf.x, lf.y, lf.z], radius: 1.3, label: lf.to ? 'Take the lift down to the lower floor' : 'Take the lift up to the ground floor', onUse: () => game.ui.fade(() => { const t = R.lifts.find((q) => q !== lf); game.player.teleport(t.x + 0.4, t.z, t.h); }) });
          if (R.atm) I({ pos: [R.atm.x, R.atm.y, R.atm.z], radius: 1.1, label: 'Use the cash machine', onUse: atmUse });
                    if (!sl) I({ pos: [L.exit[0], 0, L.exit[1]], radius: 1.4, label: () => (S.basket?.count ? 'Leave — without paying!' : 'Leave'), onUse: () => leave(rec) });
          return { spawn: L.spawn, heading: PI };
        },
        onEnter() {
          S.current = rec; S.basket = new Basket(b.brand); rec.visT = 0; rec.closedWarned = false;
          // (a walk-in shop already has its people: they were seen from the street)
          if (!rec.sl || !rec.npcs.length || rec.npcs.some((n) => !n.ped.active)) { rec.popSig = ''; populate(rec, true); } else populate(rec);
          if (rec.sl && rec.R) rec.R.setDeep(true, true);
          if (rec.ext.farPanes) rec.ext.farPanes.visible = false;      // (inside: the real glass looks out on the street)
          if (!openNow(b)) game.ui.toast('The shutters are coming down — please make your way to the checkouts.', 4);
        },
        // shown from the street: the goods deep in the shop are drawn only from near the door, the lower floor never
        updateShown(dt) {
          const R = rec.R, S0 = def.sl; if (!R || !S0 || !rec.sl) return;
          dt = Math.max(0, Math.min(0.1, dt || 0));
          if (rec.lift) rec.lift.update(dt);
          shelvesIfChanged(rec);
          R.setDeep(true, false);
          R.update(dt, 1e6, 1e6, 0, openNow(b), game.time.daylight); lamps(rec);
          // its people are there whenever it is shown (shoppers, the cashier, the queue, the guard; the stackers at night)
          if (rec.npcs.some((n) => !n.ped.active)) { clearNpcs(rec); rec.popSig = ''; rec.popT = 0; }
          if ((rec.popT = (rec.popT || 0) - dt) <= 0) { rec.popT = 5; populate(rec); }
          tickNpcs(rec, dt, true);
          if (R.reduced?.set) R.reduced.set(reducedCount(hour(), R.reduced.slots.length) - (rec.reducedTaken[dayIdx()] || 0));
          if (rec.cage) { const h = hour(); rec.cage.visible = h >= 21 || h < 7; }
        },
        onExit() {
          // walked out through the doors with goods in the basket: that is the theft
          if (rec.sl && S.basket && S.basket.count && !rec.stealing) steal(rec, true);
          if (game.activity && /^shop-/.test(game.activity.name)) game.endActivity();
          showBasket(false); S.current = null; tell(); hud.update(null, b.brand, false);
          if (!rec.sl) clearNpcs(rec); else rec.visT = 0;      // (a walk-in shop keeps its people while it is shown: outdoors loop)
        },
        update(dt) {
          dt = Math.max(0, Math.min(0.1, dt || 0));
          const R = rec.R; if (!R) return;
          const p = game.player, h = hour();
          if (rec.lift) rec.lift.update(dt);
          shelvesIfChanged(rec);
          R.update(dt, p.pos.x, p.pos.z, p.pos.y, openNow(b), game.time.daylight); lamps(rec);
          if (R.reduced?.set) R.reduced.set(reducedCount(h, R.reduced.slots.length) - (rec.reducedTaken[dayIdx()] || 0));
          // the escalator: west lane down, east lane up (out of order now and then — then they're just stairs)
          if (R.escalator && !game.activity) {
            const E = R.escalator, broken = dayIdx() % 11 === 4;
            if (p.pos.x > E.x0 && p.pos.x < E.x1 && p.pos.z < E.zTop + 0.2 && p.pos.z > E.zBot - 0.2) {
              if (broken) { if (!rec.escWarned) { rec.escWarned = true; game.ui.toast('The Tescalator is out of order today. Again. It\'s stairs now.', 3.5); } }
              else p.pos.z += (p.pos.x < E.mid ? -1 : 1) * E.speed * dt;
            }
          }
          if (!openNow(b) && !rec.closedWarned) { rec.closedWarned = true; game.ui.toast('"Attention customers: the store is now closed."', 4); }
          if ((rec.popT = (rec.popT || 0) - dt) <= 0) { rec.popT = 5; populate(rec); }
          tickNpcs(rec, dt);
          hud.update(S.basket, b.brand, true);
          if (S.basket?.count) { showBasket(true); if (playerBasket && !playerBasket.userData.goods) tell(); }      // (a new figure's basket: its goods again)
        },
      });
    }
    // built on the loading screen (the sign and goods atlases are painted on canvases: not a job for a frame in the street)
    for (const rec of Object.values(S.stores)) if (rec.plan) {
      // the street's walkers shop here too: in at the automatic doors, a while in the first aisle, out again
      if (rec.def && rec.def.sl) streetDoor(game, rec.plan, { hours: () => openNow(rec.branch), cap: 3, every: 22 });
      warmLater(game, rec.id, { heavy: true });
      (game.warmups || (game.warmups = [])).push({ id: 'shop-tex:' + rec.id, fn: () => { const d = game.interiors.get(rec.id), R = game.renderer; if (!d || !d.scene || !R || !R.initTexture) return; d.scene.traverse((o) => { const m = o.material; if (m && m.map && m.map.image) { try { R.initTexture(m.map); } catch { /* */ } } }); } });
    }
    // shut: the main lights are off (a quarter of the light is left on for the night shift), on again at opening time
    function lamps(rec) {
      const lit = openNow(rec.branch); if (!rec.lamps) return;
      const k = lit ? 1 : 0.24, flick = rec.R.lights && rec.R.lights[0];
      for (const q of rec.lamps) { if (q[0] === flick) { if (!lit) q[0].intensity = q[1] * k; } else if (rec.lit !== lit) q[0].intensity = q[1] * k; }
      rec.lit = lit;
    }
    function lockReason(b) {
      if (isBanned(st, b.id, now())) return `Security spots you: "You're barred, mate. Come back tomorrow."`;
      if (!openNow(b)) return `${b.short} is closed. ${b.hoursText}.`;
      return false;
    }
    S.enter = async (id) => { const rec = S.stores[id]; if (!rec) return 'no such branch'; const why = lockReason(rec.branch); if (why) { game.ui.toast(why); return why; } await game.interiors.enter(rec.id, { pos: rec.ext.doorPos, facing: rec.ext.doorFacing, from: 'world' }); return 'ok'; };

    // ---------------------------------------------------------------------------------------------- inventory (I)
    const use = (i) => {
      const it = st.inventory[i]; if (!it) return '';
      const p = PRODUCTS[it.id];
      if (p?.alcohol) { st.inventory.splice(i, 1); game.player.drunk = Math.min(1, (game.player.drunk || 0) + p.alcohol); game.save(); return `You drink the ${it.name.replace(/^(Tesco|Sainsbury's) /, '')}. The world wobbles slightly.`; }
      if (isFood(it.id)) {
        st.inventory.splice(i, 1); st.energy = Math.min(100, (st.energy ?? 100) + p.energy); game.save();
        const quip = it.id === 'noodles' ? ' (dry, straight from the packet — a true fresher)' : it.id === 'pizza' ? ' (frozen. Bold.)' : it.id === 'beans' ? ' (cold, from the tin)' : '';
        return `You eat the ${it.name.replace(/^(Tesco Everyday Value|Tesco|Sainsbury's basics|Sainsbury's) /, '')}${quip}. Energy ${Math.round(st.energy)}.`;
      }
      if (it.id === 'bigissue') return 'You read The Big Issue cover to cover. Good interview this week.';
      if (it.id === 'paper') return 'You skim the paper. Nothing about Oxford, for once.';
      return "You can't eat that.";
    };
    S.eat = (i = 0) => use(i);
    S.inventory = () => st.inventory.slice();
    S.openInventory = () => { if (game.activity || game.ui.inDialog) return false; openInventory(game, { items: () => st.inventory, energy: () => st.energy ?? 100, use }); return true; };
    game.input.onKey((code) => { if (code === 'KeyI' && !game.activity && !game.ui.inDialog && !game.input.typing) S.openInventory(); });

    // ---------------------------------------------------------------------------------------------- Big Issue seller (Magdalen St)
    const tm = S.stores.tesco_magdalen?.ext;
    let seller = null;
    if (tm?.bigIssue) game.interact.add({ pos: [tm.bigIssue[0], tm.bigIssue[1]], radius: 1.6, enabled: () => !!seller, label: 'Buy The Big Issue (£2.50)', onUse: () => {
      if (!game.pay(-2.5)) { game.ui.toast("You haven't got £2.50."); return; }
      st.inventory.push({ id: 'bigissue', name: 'The Big Issue', brand: '', paid: true }); game.save(); seller && seller.character.say('Cheers! Have a lovely day.', 3); game.ui.toast('You buy The Big Issue.', 2.5);
    } });

    // ---------------------------------------------------------------------------------------------- outdoors loop
    S.stats = () => { const i = game.renderer.info.render; let lights = 0; game.scene.traverse((o) => { if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight) lights++; }); return { calls: i.calls, tris: i.triangles, lights, place: game.player.place, interior: S.current?.R?.stats || null, ext: stores.map((s) => ({ id: s.branch.id, tris: s.tris })) }; };
    S.view = (x, y, z, tx, ty, tz, fov = 60) => game.beginActivity({ name: 'shop-view', pointer: 'free', camera(dt, cam) { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); }, onEnd() { game.camera.fov = 60; game.camera.updateProjectionMatrix(); } });
    let closedT = 0;
    S.debugClosed = () => ({ closedT, wd: wd(), h: hour(), stores: stores.map((s) => [s.branch.id, openNow(s.branch), s.closedMesh.visible]) });
    return {
      update(dt) {
        dt = Math.max(0, Math.min(0.1, dt || 0)); if (closedT > 2) closedT = 0;
        const p = game.player, world = p.place === 'world';
        if (world) {
          extDoors.update(dt, p.pos.x, p.pos.z, (s) => openNow(s.branch) && !isBanned(st, s.branch.id, now()));
          for (const s of stores) s.group.visible = Math.abs(p.pos.x - s.door.x) + Math.abs(p.pos.z - s.door.z) < 400;
          // a walk-in shop's painted panes stand in for its real windows until the room (or its far picture, fully faded in) is there
          for (const rec of Object.values(S.stores)) {
            const fp = rec.ext.farPanes; if (!fp) continue;
            const S0 = rec.def && rec.def.sl, ops = S0 && S0.shown ? S0.ops : null; let there = !!(S0 && S0.shown && !S0.ops);
            if (ops) for (let i = 0; i < ops.length; i++) { const k = ops[i].kind; if (k && (k !== 1 || ops[i].a >= 0.999)) { there = true; break; } }
            if (fp.visible === there) fp.visible = !there;
          }
          if ((closedT -= dt) <= 0) {
            closedT = 2; for (const s of stores) s.closedMesh.visible = !s.sl && !openNow(s.branch);      // (a walk-in shop's notice is the card on its door)
            // a walk-in shop that is no longer shown lets its people go
            for (const rec of Object.values(S.stores)) if (rec.sl && rec.npcs.length && S.current !== rec && !(rec.def && rec.def.sl && rec.def.sl.shown)) { clearNpcs(rec); rec.popSig = ''; rec.popT = 0; }
          }
          // Big Issue seller outside Tesco Magdalen St during the day
          if (tm?.bigIssue && game.pedestrians) {
            const d = Math.hypot(p.pos.x - tm.bigIssue[0], p.pos.z - tm.bigIssue[1]), h = hour(), PD = game.pedestrians, want = d < 152 && ((h >= 8 && h < 18) || (!!seller && d < 145 && !!PD.unseen && !PD.unseen(tm.bigIssue[0], tm.bigIssue[1])));      // (there before he can be seen - the walkers fade in with the distance; he packs up when nobody is looking)
            if (want && !seller) seller = game.pedestrians.spawnAt(tm.bigIssue[0], tm.bigIssue[1], { ...randomLook('bigissue-vendor', { outfit: 'casual' }), hivis: 0xd01818, hat: 'beanie', hatColor: 0x2a2a2a, prop: 'book', backpack: null }, { heading: tm.bigIssue[2], lines: ['Big Issue!', 'Big Issue, help the homeless!', 'Latest edition, Big Issue!', 'Have a lovely day!'], label: null, role: 'vendor' });
            else if (!want && seller) { game.pedestrians.remove(seller); seller = null; }
          }
          // carrying the shopping home
          if (bagPending) {
            const prop = bagPending === 'tesco' ? 'bag-tesco' : 'bag-sainsburys';
            prevProp = p.look.prop === 'bag-tesco' || p.look.prop === 'bag-sainsburys' ? prevProp : (p.look.prop ?? null);
            try { p.setLook({ ...p.look, prop }); bagProp = prop; bagT = 150; } catch (e) { console.error(e); }
            bagPending = null;
          }
          if (bagProp && (bagT -= dt) <= 0) { if (p.look.prop === bagProp) { try { p.setLook({ ...p.look, prop: prevProp }); } catch { /* */ } } bagProp = null; }
          // the security guard gives chase to the door and a bit beyond (no contact)
          const C = S.chase;
          if (C) {
            if (!C.ped && game.pedestrians) { const [x, z] = C.ext.door.E.P(C.ext.door.t, 0.8); C.home = [x, z]; C.ped = game.pedestrians.spawnAt(x, z, guardLook(dayIdx() % 4), { heading: C.ext.doorFacing, knockable: false, role: 'security' }); C.ped.character.say('Oi! Come back here!', 3); C.phase = 'run'; }
            if (C.ped) {
              C.t += dt;
              if (C.phase === 'run') {
                const d = setState(C.ped, p.pos.x, p.pos.z, 4.6, dt);
                if (d < 1.4 || C.t > 6) { C.phase = 'back'; C.ped.character.say(d < 1.4 ? "You're barred! Don't come back!" : "...and don't come back!", 3); }
              } else if (setState(C.ped, C.home[0], C.home[1], 1.4, dt) < 0.4) { game.pedestrians.remove(C.ped); S.chase = null; }
            }
          }
        }
      },
    };
  },
};
