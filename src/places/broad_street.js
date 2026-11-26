// Broad Street details, c. 2013 — see docs/research/north_west_and_broad.md (sources; known vs guessed).
//
//   Blackwell's ("Haldane & Crewe" under ?invented=1; _bs_shop.js)  the big academic bookshop on the north side of Broad Street, on the
//          mapped building w29390262: a dark-blue shopfront with gilt lettering and window displays, an enterable
//          ground floor, and down the stairs the Basement Room — a huge low room of shelving under the college garden
//          next door, sections signed overhead. Job: the bookseller at the till has a customer after a title (one per
//          shared 6-minute slot); find it in the right section downstairs and bring it up for a tip.
//   The Turf Tavern ("The Bastion" under ?invented=1; _bs_pub.js)  the old tavern hidden at the end of St Helen's Passage under the city
//          wall (the mapped pub w97822057 whose yard, lanterns and sign radcliffe_square.js already builds): an
//          enterable low-beamed bar (drinks; the yard-of-ale challenge) and the walled beer garden along the city wall
//          with braziers that glow after dark.
// Exterior meshes are a few merged draws shown only within ~150 m; interiors are built on entry. No Math.random, no
// network traffic (the bookshop request and the barman's lines run on the shared clock).
//
// Test hooks: game.broadStreet = { sights, stats(), shop, pub, debugEnter(id), debugExit(), request() }
import * as THREE from 'three';
import { SHOP, GF, frontGeometry, buildGround, buildBasement, requestFor, groundPlanSpec } from './_bs_shop.js';
import { SEAMLESS } from '../core/interiors.js';
import { PUB, BAR, buildGarden, buildBar, barPlanSpec } from './_bs_pub.js';
import { planWalkin, streetDoor, dressOpenings, roomCrowd, hoursOpen } from './_walkin_city.js';
import { inventedNames } from '../core/features.js';
import { randomLook } from '../core/characters.js';
import { dayOf } from '../core/time.js';

export const sights = [
  { id: 'haldane-crewe', name: SHOP.name + ', booksellers', x: 309.4, z: 46, blurb: 'The great academic bookshop on Broad Street: it looks small from the street and goes on for ever inside.' },
  { id: 'basement-room', name: SHOP.room, x: 305, z: 22, blurb: 'A vast low room of shelving dug out under the college garden next door: miles of books, every subject signed overhead.' },
  { id: 'bastion-garden', name: PUB.name + '\'s beer garden', x: 498, z: 44, blurb: 'A walled garden squeezed between the old tavern and the medieval city wall, braziers lit on cold nights.' },
];
const NEAR = 110, NEAR_GARDEN = 55;     // the walled garden is seen only from the passage and the yard
const ID = { ground: 'bs_books', basement: 'bs_basement', bar: 'bs_bastion' };
const DRINKS = { pint: { name: 'a pint of bitter', price: 3.2, drunk: 0.12 }, cider: { name: 'a mulled cider', price: 3.5, drunk: 0.1 }, soft: { name: 'a lime and soda', price: 1.5, drunk: -0.02 } };
const BAR_LINES = ['Mind your head on the beams.', 'Garden\'s out the back, by the wall. Braziers are lit.', 'The yard? Six pounds. We have a mop.', 'Been a pub here since before the colleges noticed.', 'Last orders when I say so.'];
const SELLER_LINES = ['Can I help you find anything?', SHOP.room + ' is down the stairs on the left.', 'We close when the last reader is found.'];

export default {
  id: 'broad_street',
  preMap(game) {
    try {
      // the bookshop's mapped building: a pale rendered three-storey front over the new shopfront
      game.overrides.style.set(SHOP.id, { wall: 'render', roof: 'slate', color: '#e7dcc4', storeys: 3, ground: 'renderBlank', ivy: false });
      // the shop's map points (its name and the café inside) are not drawn: the world would paint them as fascia
      // signs and cut generic shop units into the front; this module builds its own front (SHOP.name on the fascia)
      for (const id of ['n297888434', 'n9269617682', 'n6721041761', 'n840486605']) game.overrides.skip.add(id);
      const b = game.map && game.map.buildings.find((q) => q.id === SHOP.id);
      if (b && b.tags && b.tags.building === 'retail') b.tags = { ...b.tags, building: 'commercial' };
      // the old tavern's painted fascia (drawn by the world from the building's name): its map name (Turf Tavern), or
      // the invented one under ?invented=1
      const t = game.map && game.map.buildings.find((q) => q.id === 'w97822057');
      if (t && t.tags && inventedNames()) { const { brand, operator, ...rest } = t.tags; void brand; void operator; t.tags = { ...rest, name: PUB.name }; }
    } catch (e) { console.error('[broad_street] preMap', e); }
  },

  install(game) {
    const W = game.world, scene = game.worldScene, col = game.worldCollider;
    const S = { err: false, job: null, have: null, yard: null };
    const root = new THREE.Group(); root.name = 'bs:root';
    let front = null, garden = null;
    // (walk-in: the shop in place in its mapped building, the basement room down a real stair — _bs_shop.js GF)
    let shopPlan = null;
    // opening hours (GUESS for 2013: 9:00 - 18:30 every day; the pub 11:00 - 23:00): shut = the door locked with a "Closed" card, the lights low, nobody in
    const shopOpen = () => hoursOpen(game.time.hour, 9, 18.5), pubOpen = () => hoursOpen(game.time.hour, 11, 23);
    try { shopPlan = planWalkin(game, { id: ID.ground, building: SHOP.id, door: { pos: SHOP.door, facing: SHOP.facing }, hours: { open: shopOpen, testShut: 3.5 }, ...groundPlanSpec() }); } catch (e) { console.error('[broad_street] shop plan', e); }
    if (shopPlan) streetDoor(game, shopPlan, { every: 30 });      // (the street's walkers go in and out of the shop)
    const shopWalkin = !!(SEAMLESS && shopPlan && shopPlan.fit.ok && game.interiors && game.interiors.sl);
    W.bsWalkin = shopWalkin;
    try { front = frontGeometry(W); for (const m of front.meshes) root.add(m); } catch (e) { console.error('[broad_street] shopfront', e); }
    try {
      garden = buildGarden(W);
      for (const m of garden.meshes) root.add(m);
      for (const [x, z, r] of garden.colliders) col.addCircle(x, z, r);
      // the wall lanterns and the festoons' middles light the garden after dark (the world's pooled lamp lights + pools)
      if (W.addLampGlow) for (const [x, y, z] of garden.lamps) { try { if (y > 2) W.addLampGlow(x, y, z); } catch { /* */ } }
    } catch (e) { console.error('[broad_street] garden', e); }
    root.traverse((m) => { if (m.isMesh) { m.matrixAutoUpdate = false; m.updateMatrix(); } });
    W.addStatic ? W.addStatic(root) : scene.add(root);
    const groups = [];
    for (const m of root.children) { m.geometry.computeBoundingSphere(); const c = m.geometry.boundingSphere.center; groups.push({ m, x: c.x, z: c.z, r: m.geometry.boundingSphere.radius, near: /garden|fire/.test(m.name) ? NEAR_GARDEN : NEAR }); }

    const say = (t, s = 3.5) => { try { game.ui.toast(t, s); } catch { /* */ } };
    // ---- the people of the two rooms (there whenever the room is shown: seen from the street / the yard; the same for every player)
    const day = () => dayOf(game.time.now());
    const person = (seed, outfit, extra) => ({ ...randomLook(seed, { outfit }), hat: null, backpack: null, ...extra });
    // (from outside the crowd system neither shows nor poses a room's people: do it here; `floor` = only those on the street's level)
    const showCrowd = (C, dt, inside) => { for (const p of C.npcs) { const ch = p.character, on = inside || !(p.y < -1); if (ch.group.visible !== on) ch.group.visible = on; if (on && !inside) { ch.group.position.set(p.x, p.y || 0, p.z); ch.update(dt, 0); } } };
    // the lights of a room by its hours: collected when it is built, a fifth left on when shut
    const lampsOf = (scene) => scene.children.filter((o) => o.isLight).map((o) => [o, o.intensity]);
    const setLamps = (L, on) => { if (!L || L.on === on) return; L.on = on; for (const [o, i] of L) o.intensity = i * (on ? 1 : 0.2); };
    let shopLamps = null, barLamps = null, barDoor = null;
    const shopCrowd = roomCrowd(game, ID.ground, {
      cap: 10, signature: () => `${shopOpen()}|${game.time.hour >= 12 && game.time.hour < 17}|${day()}`,
      populate(spawn) {
        if (!shopOpen() || !shopWalkin) return;
        const d = day(), busy = game.time.hour >= 12 && game.time.hour < 17, B = GF.base;
        const P = (x, z, h, seed, outfit, extra, opts) => { const p = spawn(x, z, person(seed, outfit, extra), { heading: h, ...opts }); if (p) p.character.noLod = true; return p; };
        P(5.0, 6.85, Math.PI, 'bw-seller-' + (d % 3), 'tweed', { prop: null }, { lines: SELLER_LINES, role: 'bookseller' });      // behind the till
        // browsers: at the tables of new books, along the wall cases, at the far shelves (seen down the shop from the door)
        const spots = [[1.05, 3.8, Math.PI / 2], [-2.6, -8.15, Math.PI], [-3.0, 4.05, 0], [6.25, -2.0, Math.PI / 2], [-6.25, 2.4, -Math.PI / 2], [1.1, -0.6, Math.PI / 2]];
        for (let i = 0; i < (busy ? 6 : 3); i++) { const q = spots[(i + d) % spots.length]; P(q[0], q[1], q[2], 'bw-browser-' + d + '-' + i, i % 3 === 1 ? 'tweed' : 'casual', { prop: i % 2 ? 'book' : null }); }
        // down in the basement room: at the stacks (never seen from the street)
        for (const [i, q] of [[-6, -7.15], [9.5, 2.85], [-11, 7.85]].entries()) { if (i && !busy) break; const p = P(q[0] + B[0], q[1] + B[2], Math.PI, 'bw-stacks-' + d + '-' + i, 'casual', { prop: 'book' }); if (p) { p.y = B[1]; p.character.group.position.y = B[1]; } }
      },
    });
    const barCrowd = roomCrowd(game, ID.bar, {
      cap: 9, signature: () => `${pubOpen()}|${game.time.hour >= 17}|${day()}`,
      populate(spawn) {
        if (!pubOpen() || !(barPlan && barPlan.fit.ok)) return;
        const d = day(), eve = game.time.hour >= 17, D2 = BAR.D / 2;
        const P = (x, z, h, seed, outfit, extra, opts) => { const p = spawn(x, z, person(seed, outfit, extra), { heading: h, ...opts }); if (p) p.character.noLod = true; return p; };
        P(-5.35, -0.4, Math.PI / 2, 'turf-bar-' + (d % 2), 'barstaff', { prop: null }, { lines: BAR_LINES, role: 'barstaff' });      // behind the counter
        // drinkers: two at the bar, one on each settle, a pair standing at the round table, one by the fire
        const spots = [[-3.75, -1.3, -Math.PI / 2, 'stand', 'pint'], [-1.9, D2 - 0.42, Math.PI, 'sit', 'pint'], [1.0, -1.4, Math.PI, 'stand', 'pint'], [-3.75, 0.7, Math.PI * 0.8, 'talk', null], [1.3, D2 - 0.42, Math.PI, 'sit', null], [0.2, -2.5, Math.PI / 3, 'talk', 'pint'], [5.1, 1.0, Math.PI / 2, 'stand', 'pint'], [-1.2, D2 - 0.42, Math.PI, 'sit', 'pint']];
        for (let i = 0; i < (eve ? 8 : 3); i++) { const q = spots[i]; P(q[0], q[1], q[2], 'turf-' + d + '-' + i, i % 4 === 3 ? 'tweed' : 'casual', { prop: q[4] }, { pose: q[3] }); }
      },
    });
    const slotLine = (lines, k) => lines[(((k * 2654435761) >>> 0) >>> 5) % lines.length];

    // ---------------------------------------------------------------- the bookshop
    let groundDims = null, baseDims = null;
    game.interiors.register({
      id: ID.ground, name: SHOP.name + ', booksellers', background: 0x1a1612, ambient: 0.6,
      doors: [{ pos: front ? front.door.pos : SHOP.door, facing: SHOP.facing, label: 'Go into ' + SHOP.name }],
      seamless: shopWalkin ? shopPlan.seamless : null,
      build(ctx) {
        const r = buildGround(ctx, W, shopPlan); groundDims = r;
        if (r.basement) {      // (walk-in: the basement room is down the stair in this same room; its sections at their place under the shop)
          baseDims = r.basement;
          for (const sec of r.basement.sections) game.interact.add({ place: ctx.id, pos: [sec.x + r.base[0], r.base[1], sec.z + r.base[2]], radius: 1.6, label: () => (S.job && !S.have ? 'Look in ' + sec.name + ' for "' + S.job[0] + '"' : 'Browse ' + sec.name), onUse: () => browse(sec) });
        }
        ctx.addExit(r.exit[0], r.exit[1], 'Out to Broad Street');
        game.interact.add({ place: ctx.id, pos: r.till, radius: 1.8, label: () => (S.have ? 'Hand over "' + S.have[0] + '"' : S.job ? 'The customer is waiting for "' + S.job[0] + '"' : 'Ask the bookseller'), onUse: () => sellerUse() });
        if (shopWalkin) shopLamps = lampsOf(ctx.scene);
        return { spawn: r.spawn, heading: r.heading };
      },
      onEnter() { say(SHOP.name + ': four floors of books upstairs, and ' + SHOP.room.replace(/^The /, 'the ') + ' below.', 4); },
      update(dt) { if (!shopWalkin) return; setLamps(shopLamps, shopOpen()); shopCrowd.tick(dt); showCrowd(shopCrowd, dt, true); },
      updateShown(dt) { if (!shopWalkin) return; setLamps(shopLamps, shopOpen()); shopCrowd.tick(dt); showCrowd(shopCrowd, dt, false); },
    });
    // (walk-in: the basement room is part of the shop's own room, down the real stair — there is no way into a separate
    //  'bs_basement' place, so it is only registered on the old door-prompt path, ?seamless=0)
    if (!shopWalkin) game.interiors.register({
      id: ID.basement, name: SHOP.room, background: 0x15140f, ambient: 0.7,
      doors: [{ pos: [4, -18 / 2 + 0.9], from: ID.ground, facing: 0, label: 'Down to ' + SHOP.room.replace(/^The /, 'the ') }],
      build(ctx) {
        const r = buildBasement(ctx, W); baseDims = r;
        ctx.addExit(r.stairsUp[0], r.stairsUp[1], 'Back upstairs');
        for (const sec of r.sections) {
          game.interact.add({ place: ctx.id, pos: [sec.x, sec.z], radius: 1.6, label: () => (S.job && !S.have ? 'Look in ' + sec.name + ' for "' + S.job[0] + '"' : 'Browse ' + sec.name), onUse: () => browse(sec) });
        }
        return { spawn: r.spawn, heading: r.heading };
      },
      onEnter() { say(SHOP.room + ': shelves as far as you can see, under a ceiling you could touch.', 4); },
    });
    function sellerUse() {
      const k = game.time.slot(6);
      if (S.have) { const t = S.have; S.have = null; S.job = null; game.pay(4); game.ui.objective(null); say(`"${t[0]}" — perfect. The customer gives you a £4 tip.`, 4); return; }
      if (S.job) { say(`They want "${S.job[0]}". Try ${S.job[1]} in ${SHOP.room.replace(/^The /, 'the ')}.`, 4); return; }
      if (S.doneSlot === k) { say(slotLine(SELLER_LINES, k), 3); return; }
      S.job = requestFor(k); S.doneSlot = k;
      game.ui.objective(`Find "${S.job[0]}" in ${SHOP.room.replace(/^The /, 'the ')}`);
      say(`"A customer's after ${S.job[0]}. Could you fetch it from downstairs? I can't leave the till."`, 5);
    }
    function browse(sec) {
      if (S.job && !S.have) {
        if (sec.name === S.job[1]) { S.have = S.job; game.ui.objective(`Take "${S.have[0]}" up to the till`); say(`Found it: "${S.have[0]}", second shelf from the top.`, 4); }
        else say(`Not in ${sec.name}. Somewhere in this room, though.`, 2.5);
        return;
      }
      say(`${sec.name}: ${2 + ((sec.name.length * 7) % 9)},000 titles. You read a spine or two.`, 2.5);
    }

    // ---------------------------------------------------------------- the pub
    // (walk-in: the room in place inside the mapped pub, its door on the yard — _bs_pub.js BAR)
    let barPlan = null;
    try { barPlan = planWalkin(game, { id: ID.bar, building: 'w97822057', door: PUB.door, hours: { open: pubOpen, testShut: 3.5 }, ...barPlanSpec() }); } catch (e) { console.error('[broad_street] bar plan', e); }
    if (barPlan) streetDoor(game, barPlan, { every: 40, dwell: [25, 70] });
    const barWalkin = !!(barPlan && barPlan.fit.ok);
    game.interiors.register({
      id: ID.bar, name: PUB.name, background: 0x120c08, ambient: 0.42,
      doors: [{ pos: PUB.door.pos, facing: PUB.door.facing, label: 'Duck into ' + PUB.name }],
      seamless: barPlan && barPlan.fit.ok ? barPlan.seamless : null,
      build(ctx) {
        const r = buildBar(ctx, W, S.yardRecord ? S.yardRecord.toFixed(1) + ' seconds (you)' : null, barPlan);
        ctx.addExit(r.exit[0], r.exit[1], 'Out to the yard');
        game.interact.add({ place: ctx.id, pos: r.bar, radius: 1.8, label: () => 'Buy a drink (pint £3.20 · mulled cider £3.50 · lime and soda £1.50)', onUse: () => buyRound() });
        game.interact.add({ place: ctx.id, pos: r.yard, radius: 1.5, label: 'Try the yard of ale (£6)', onUse: () => yardOfAle() });
        if (ctx.seamless && barWalkin) { barLamps = lampsOf(ctx.scene); barDoor = r.door || null; if (barDoor && barDoor.sign) barDoor.sign.scale.setScalar(1e-3); }
        return { spawn: r.spawn, heading: r.heading };
      },
      onEnter() { say(slotLine(BAR_LINES, game.time.slot(0.2)), 3.5); },
      update(dt) { if (!barLamps) return; setLamps(barLamps, pubOpen()); barCard(); barCrowd.tick(dt); showCrowd(barCrowd, dt, true); },
      updateShown(dt) { if (!barLamps) return; setLamps(barLamps, pubOpen()); barCard(); barCrowd.tick(dt); showCrowd(barCrowd, dt, false); },
    });
    // the "Closed" card of the yard door: there (full size) only while the pub is shut; the leaf's picture in the world's pass is told to follow
    function barCard() {
      const D = barDoor; if (!D || !D.sign) return;
      const on = !pubOpen(); if (D._card === on) return; D._card = on;
      D.sign.scale.setScalar(on ? 1.6 : 1e-3); D.sign.updateMatrixWorld(true);
      const d = game.interiors.get(ID.bar); if (d && d.sl) d.sl.proxyDirty = true;
    }
    // the outside of the yard door (the painted sash of that bay is blanked: world/walkin_bays.js): an oak frame under a timber lintel, a worn step
    // …and the garden windows: sashes like the painted ones beside them (they stand ON the painted sashes' glass: the painted box frame and sill stay)
    if (barPlan && barPlan.fit.ok) dressOpenings(game, ID.bar, [{ p: 0, frame: { w: 0.07, color: 0x2a1d12 }, lintel: { h: 0.16, over: 0.14, color: 0x2e2116, proud: 0.045 }, step: { h: 0.06, proj: 0.3, over: 0.1 }, fill: 0x33241a },
      { o: barPlan.seamless.openings.map((q, i) => i), frame: { w: 0.045, color: 0xd9d4c6 }, bars: [3, 4], barW: 0.024, meeting: 0.5 }]);
    function buyRound() {
      const h = game.time.hour, kind = (h >= 18 || h < 2) ? (S.lastDrink === 'pint' ? 'cider' : 'pint') : (S.lastDrink === 'soft' ? 'pint' : 'soft');
      const d = DRINKS[kind];
      if ((game.state.money ?? 0) < d.price) { say('You count your change. Not enough.', 3); return; }
      game.pay(-d.price); S.lastDrink = kind;
      const p = game.player; p.drunk = Math.max(0, Math.min(1, (p.drunk || 0) + d.drunk));
      say(`You buy ${d.name} and stand under the beams with it. Mind your head.`, 3.5);
    }
    // the yard of ale: mash E for 11 seconds; 34 gulps finishes it (bloodless: you just get wet)
    function yardOfAle() {
      if (S.yard) return;
      if ((game.state.money ?? 0) < 6) { say('The yard is £6. You have not got £6.', 3); return; }
      game.pay(-6);
      const Y = (S.yard = { t: 0, gulps: 0, need: 34, limit: 11 });
      const hud = () => game.ui.objective(`Yard of ale: ${Math.min(Y.need, Y.gulps)}/${Y.need} gulps · ${Math.max(0, Y.limit - Y.t).toFixed(1)} s — mash E!`);
      hud();
      game.beginActivity({
        name: 'yard', hint: 'Mash E to drink. Esc to give up.',
        update(dt) { Y.t += dt; hud(); if (Y.gulps >= Y.need || Y.t >= Y.limit) game.endActivity(); },
        onKey(code) { if (code === 'KeyE') Y.gulps++; },
        onEnd() {
          game.ui.objective(null);
          const p = game.player;
          if (Y.gulps >= Y.need) { const tt = Math.max(1, Y.t); if (!S.yardRecord || tt < S.yardRecord) S.yardRecord = tt; p.drunk = Math.min(1, (p.drunk || 0) + 0.35); say(`Down in ${tt.toFixed(1)} seconds! The bar cheers. You feel the yard in your knees.`, 5); }
          else { p.drunk = Math.min(1, (p.drunk || 0) + 0.15); say('The air bubble arrives all at once. You wear most of the yard. The barman hands you the mop.', 5); }
          S.yard = null;
        },
      });
    }

    // ---------------------------------------------------------------- per frame: show near, flicker the braziers
    function tick(dt) {
      const out = game.player.place === 'world', c = game.camera.position, air = !!(W && W.aerial);
      for (const g of groups) { const on = out && Math.hypot(g.x - c.x, g.z - c.z) - g.r < (air ? 0 : g.near); if (g.m.visible !== on) g.m.visible = on; }
      if (garden && garden.fire && garden.fire.visible) {
        const t = game.time.now() / 1000, lit = W.night == null ? 1 : Math.max(0.35, Math.min(1, 0.35 + W.night));
        garden.fire.material.opacity = lit * (0.7 + 0.2 * Math.sin(t * 9.1) + 0.1 * Math.sin(t * 23.7));
        garden.fire.scale.y = 1; // static matrix: opacity carries the flicker
      }
    }
    game.broadStreet = {
      sights, shop: SHOP, pub: PUB, front, garden, state: S, walkin: { shop: shopWalkin, shopPlan, barPlan },
      request: () => requestFor(game.time.slot(6)),
      dims: () => ({ ground: groundDims, basement: baseDims }),
      debugEnter(id) { const d = game.interiors.get(ID[id] || id); return d ? game.interiors.enter(d.id, d.doors[0]) : null; },
      debugExit() { if (game.player.place !== 'world' && game.interiors.current) return game.interiors.exit(); return null; },
      sellerUse, browse, yardOfAle, buyRound,
      stats() { let draws = 0, tris = 0; root.traverse((m) => { if (m.isMesh && m.visible) { draws++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return { draws, tris: Math.round(tris) }; },
    };
    tick(0);
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[broad_street]', e); } } } };
  },
};
