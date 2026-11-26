// University of Oxford Botanic Garden, c. 2013 — docs/research/christ_church_botanic_magdalen.md §2 (known vs guessed).
//
//   preMap   the walled garden's ashlar walls as map barriers with gaps at the gates, the order beds as flowerbeds, the
//            Danby Gateway and the glasshouses skipped (hand-built here) — _bot_map.js.
//   install  the Danby Gateway (_bot_danby.js); the glasshouse range, the Conservatory, the pond and fountain, Bobart's
//            yew, Tolkien's black pine and its bench (_bot_glass.js); the ticket desk at the gate; a botanist.
//   game     a ticket (£4.50) at the Danby Gateway, 09:00-17:00 (turned round without one); at closing time a gardener
//            shows everyone out through the gateway (nobody is ever locked in: nothing physically shuts); the
//            botanist's errand: find today's rare plant (one of eight, chosen by the game day, the same for everyone)
//            and report back for a reward; sit on the bench under Tolkien's pine.
// Cost: two merged batches of shared world materials (the gateway; the glasshouses + garden pieces); the botanist only
// exists near; nothing updates beyond a cheap distance test far away.
// Test hooks: game.botanic = { stats(), sights, state, errand(), setForce(f) }    tools/smoke_southeast.mjs
import { randomLook } from '../core/characters.js';
import { seMats, pointInPoly, hh, distCull } from './_chch_kit.js';
import { preMapGarden, F, WALL, IDS, HOURS, FEE, isOpen, inWalled, wallRuns, familyBeds, wallRing as wallRingW } from './_bot_map.js';
import { build as buildDanby } from './_bot_danby.js';
import { lodSwap, lodScale, shadowProxy } from './_se_fine.js';
import { DAY_MS } from '../core/time.js';
import { build as buildGlass, housePlan, POND, YEW, PINE, BENCH, CONSERVATORY, GARDEN_AIR } from './_bot_glass.js';

const ALIAS = { stonePale: 'stone', iron: 'lead', shadow: 'win', leafDark: 'leaf', cactus: 'leaf', padGreen: 'leaf', bark: 'darkWood', soil: 'darkWood', sand: 'paving', flowerWhite: 'flowerPink', flowerPurple: 'flowerPink' };
export const REWARD = 6;
export const TARGETS = [
  { key: 'amorphophallus', name: 'the titan arum', where: 'Palm House', line: 'Smells like a dead badger. Magnificent!' },
  { key: 'victoria', name: 'the giant Amazon waterlily', where: 'Lily House', line: 'The pads hold a small child. Please do not test that.' },
  { key: 'welwitschia', name: 'the welwitschia', where: 'Arid House', line: 'Two leaves, a thousand years. Relatable.' },
  { key: 'flytrap', name: 'the Venus flytrap', where: 'Insectivorous House', line: 'Did you feed it? Tell me you didn\'t feed it.' },
  { key: 'treefern', name: 'the tree fern', where: 'Fernery', line: 'Older than the dinosaurs. The family, not the fern.' },
  { key: 'edelweiss', name: 'the edelweiss', where: 'Alpine House', line: 'Small and white, clean and bright. Yes, I know.' },
  { key: 'mandrake', name: 'the mandrake', where: 'the medicinal beds', line: 'You didn\'t pull it up? Good. Very good.' },
  { key: 'yew', name: 'Bobart\'s yew', where: 'by the south wall', line: 'Planted in 1645. It has seen things.' },
];
/** today's target (the same for every player): index into TARGETS */
export const targetOf = (day) => Math.floor(hh(day, 1621) * TARGETS.length);
export const sights = [
  { id: 'bot-danby', name: 'The Danby Gateway', x: 877.5, z: 399.7, blurb: 'Nicholas Stone\'s gateway of 1632-33: a rusticated arch, statues of Charles I and Charles II, and the Earl of Danby, who paid for the garden in 1621.' },
  { id: 'bot-walled', name: 'The Walled Garden', x: 849, z: 446, blurb: 'Britain\'s oldest botanic garden (1621), its walls of 1623 round long family beds, with a fountain pond in the middle.' },
  { id: 'bot-yew', name: 'Bobart\'s yew', x: YEW[0], z: YEW[1], blurb: 'Planted in 1645 by Jacob Bobart the Elder, the garden\'s first keeper — the oldest tree in the garden.' },
  { id: 'bot-glasshouses', name: 'The Glasshouses', x: 906, z: 478, blurb: 'A range along the Cherwell: palms, a tank of giant waterlilies, cacti, flytraps, ferns and alpines.' },
  { id: 'bot-lily', name: 'The Lily House', x: 911, z: 465, blurb: 'Its tank of 1851 is the oldest part of the range; the Amazon waterlily\'s pads grow to a metre and more.' },
  { id: 'bot-pine', name: 'Tolkien\'s pine', x: PINE[0], z: PINE[1], blurb: 'The black pine by the river that Tolkien is said to have loved. (It came down in 2014.)' },
  { id: 'bot-lower', name: 'The Lower Garden', x: 840, z: 530, blurb: 'The herbaceous border (1946), the rock garden and the lawn down to the Cherwell, with a view of Magdalen Bridge.' },
];
/** v of every glasshouse door that opens straight through the east wall (gaps in it) */
export function doorGaps(map) { return housePlan(map).map((h) => F.toL(h.door.x, h.door.z)).filter(([u]) => Math.abs(u - WALL.u1) < 3).map(([, v]) => +v.toFixed(2)); }
const KIOSK = F.toW(3.2, -5.6), OUT = F.toW(0, -8.5), BOTANIST = F.toW(-6, 50);

export default {
  id: 'botanic_garden',
  preMap(game) { try { preMapGarden(game, doorGaps(game.map)); } catch (e) { console.error('[botanic_garden] preMap', e); } },

  install(game) {
    const W = game.world, scene = game.worldScene, map = game.map, peds = game.pedestrians, ui = game.ui, P = game.player, col = game.worldCollider;
    const mats = seMats(W);
    const S = { err: false, ticketDay: -1, warned: -1, shownOut: -1, closeT: 0, errand: null, found: false, doneDay: -1, outside: null, force: null };
    const flags = game.state.flags || (game.state.flags = {});
    if (flags.botTicket != null) S.ticketDay = flags.botTicket;
    if (flags.botErrandDone != null) S.doneDay = flags.botErrandDone;
    const now = () => game.time.now(), hour = () => (S.force === 'open' ? 12 : S.force === 'closed' ? 19 : game.time.hour), day = () => Math.floor(now() / DAY_MS);
    const site = (map.sites || []).find((s) => s.id === IDS.site), inSite = (x, z) => (site ? pointInPoly(x, z, site.poly) : inWalled(x, z)) || inWalled(x, z);
    const meshes = [];
    let danby = null, glass = null;
    try {
      danby = buildDanby({ mats, parent: scene, alias: ALIAS, world: W }); meshes.push(...danby.meshes);
      for (const [x, z, w, d, rot] of danby.colliders) col.addBox(x, z, w, d, rot);
      const [x1, z1, x2, z2, w] = danby.passage; col.addPassage(x1, z1, x2, z2, w);
    } catch (e) { console.error('[botanic_garden] Danby Gateway', e); }
    try {
      glass = buildGlass({ mats, parent: scene, map, alias: ALIAS, world: W }); meshes.push(...glass.meshes);
      for (const [x1, z1, x2, z2] of glass.colliders.segs) col.addSegment(x1, z1, x2, z2, { tag: 'wall' });
      for (const [x, z, r] of glass.colliders.circles) col.addCircle(x, z, r);
      for (const [x, z, w, d, rot] of glass.colliders.box || []) col.addBox(x, z, w, d, rot, { low: true });
    } catch (e) { console.error('[botanic_garden] glasshouses', e); }
    try { W.clearArea(wallRingW(), { trees: false, furniture: false, lamps: true }); } catch { /* optional */ }
    // no city trees growing through the glass
    if (glass) for (const h of glass.houses) { const r = h.rect, hl = r.L / 2 + 3.5, hw = r.W / 2 + 3.5; try { W.clearArea([[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([a, b]) => [r.c[0] + r.ax[0] * a - r.ax[1] * b, r.c[1] + r.ax[1] * a + r.ax[0] * b]), { trees: true, furniture: true, lamps: true }); } catch { /* optional */ } }
    try { const K = CONSERVATORY; W.clearArea([[K.u0 - 1, K.v0], [K.u1 + 1, K.v0], [K.u1 + 1, K.v1 + 1], [K.u0 - 1, K.v1 + 1]].map(([u, v]) => F.toW(u, v)), { trees: true, furniture: true, lamps: true }); } catch { /* optional */ }

    // ================================================================ tickets, closing time
    game.interact.add({ pos: KIOSK, radius: 2.4, label: () => (S.ticketDay === day() ? 'Botanic Garden ticket: valid today' : `Buy a Botanic Garden ticket (£${FEE.toFixed(2)})`),
      enabled: () => isOpen(hour()) || S.ticketDay === day(),
      onUse: () => {
        if (S.ticketDay === day()) { ui.toast('Your ticket is good for today. Mind the cacti.'); return; }
        if (hour() >= HOURS.lastEntry) { ui.toast('Last entry was at a quarter past four, I\'m afraid.'); return; }
        if (!game.pay(-FEE)) { ui.toast(`A ticket is £${FEE.toFixed(2)}.`); return; }
        S.ticketDay = day(); flags.botTicket = day(); game.save(); ui.toast('Ticket bought. The glasshouses are down by the river.', 4);
      } });
    function gateTick() {
      if (P.place !== 'world' || P.vehicle || (game.swim && game.swim.active)) { S.outside = null; return; }
      const [u, v] = F.toL(P.pos.x, P.pos.z);
      if (Math.abs(u) > 9 || v < -12 || v > 9) { S.outside = null; return; }
      if (v < -3.6) { S.outside = { u, v }; return; }
      if (v < 3.8 || !S.outside) return;
      S.outside = null;
      if (S.force === 'open') return;
      if (isOpen(hour()) && S.ticketDay === day()) return;
      P.teleport(OUT[0], OUT[1], F.heading(0, -1));
      ui.toast(!isOpen(hour()) ? 'The Botanic Garden is closed. Open 9 till 5.' : 'Tickets at the gate, please — just there on the right.', 3.5);
    }
    function closingTick(dt) {
      const h = hour(), inside = P.place === 'world' && !(game.swim && game.swim.active) && inSite(P.pos.x, P.pos.z);
      if (!inside) { S.closeT = 0; return; }
      if (h >= HOURS.warn && h < HOURS.close && S.warned !== day()) { S.warned = day(); ui.toast('A bell: the garden closes at five. Please make your way to the Danby Gateway.', 4); }
      if (!isOpen(h)) {
        S.closeT += dt;
        if (S.closeT > 6 && !P.vehicle) {
          S.closeT = 0; S.shownOut = day();
          const go = () => { P.teleport(OUT[0], OUT[1], F.heading(0, -1)); };
          if (ui.fade) ui.fade(go); else go();
          ui.toast('A gardener walks you out through the Danby Gateway. "We open at nine!"', 4);
        }
      }
    }

    // ================================================================ the botanist's errand
    let botanist = null;
    const errandActive = () => S.errand && S.errand.day === day();
    const target = () => TARGETS[targetOf(day())];
    game.interact.add({ pos: BOTANIST, radius: 2.4, enabled: () => !!botanist,
      label: () => (S.doneDay === day() ? 'Talk to the botanist' : errandActive() ? (S.found ? 'Tell the botanist what you found' : 'Ask the botanist again') : 'Talk to the botanist (an errand)'),
      onUse: () => {
        const t = target();
        if (S.doneDay === day()) { say('Thank you again! Come back tomorrow, something else will be flowering.'); return; }
        if (errandActive() && S.found) {
          S.doneDay = day(); flags.botErrandDone = day(); S.errand = null; S.found = false; game.pay(REWARD); game.save(); ui.objective(null);
          say(`${t.line} Here — £${REWARD} for your trouble.`); ui.toast(`Errand done: +£${REWARD}`, 3); return;
        }
        if (errandActive()) { say(`It\'s ${t.name}, in ${t.where}. Go and look properly!`); return; }
        S.errand = { day: day(), key: t.key }; S.found = false;
        say(`I need someone to check on ${t.name} — it should be in ${t.where}. Look for it and come back!`);
        ui.objective(`Botanist's errand: find ${t.name} (${t.where}) and report back.`);
      } });
    const say = (text) => { ui.toast(text, 4.5); if (botanist && peds && peds.say) peds.say(botanist, text, 4); };
    const plants = glass ? glass.plants : {};
    for (const T of TARGETS) {
      const pos = plants[T.key]; if (!pos) continue;
      game.interact.add({ pos, radius: 2.2, label: `Examine ${T.name}`, enabled: () => errandActive() && !S.found && S.errand.key === T.key,
        onUse: () => { S.found = true; ui.toast(`Found ${T.name}! Back to the botanist by the pond.`, 3.5); ui.objective(`Report back to the botanist by the pond.`); } });
    }
    // the bench under Tolkien's pine
    game.interact.add({ pos: BENCH, radius: 1.8, label: 'Sit on the bench under the black pine', onUse: () => {
      const back = { x: P.pos.x, z: P.pos.z, h: P.heading }; P.pose = 'sit'; let t = 0;
      game.beginActivity({ name: 'bench', hint: 'Sitting by the Cherwell. (Esc to get up)', update(dt) { t += dt; if (t > 1 && t - dt <= 1) ui.toast('The punts slide past. Tolkien is said to have loved this tree.', 4.5); }, onEnd() { P.pose = 'stand'; P.teleport(back.x, back.z, back.h); } });
    } });

    // ================================================================ per-frame
    let near = false, nearT = 0;
    const LOD = [danby && danby.lod, ...(glass && glass.lods ? glass.lods : [])].filter(Boolean).map((l) => shadowProxy(W, l));   // the far mesh casts the shadow
    const CULL = [{ meshes: glass ? glass.meshes.filter((m) => !/:(near|far)$/.test(m.name)) : [], c: [870, 470], r: 330, on: true, air: GARDEN_AIR, W }];   // (from a glider: with the garden's far mesh)
    function tick(dt) {
      distCull(CULL, game.camera.position, P.place === 'world');
      lodSwap(LOD, game.camera.position, P.place === 'world', null, lodScale(game));
      nearT -= dt;
      if (nearT <= 0) {
        nearT = 0.5;
        const d = Math.hypot(P.pos.x - 860, P.pos.z - 455), want = P.place === 'world' && d < 160;
        if (want !== near) near = want;
        const wantBot = near && isOpen(hour());
        if (wantBot && !botanist && peds) { try { botanist = peds.spawnAt(BOTANIST[0], BOTANIST[1], { ...randomLook('bot-botanist', { outfit: 'tweed' }), hat: 'sunhat' }, { heading: 0, label: null, knockable: false, lines: ['Have you seen the Lily House? Have you?', 'Don\'t lick the cacti.', 'Latin names, please. We\'re not animals.'] }); } catch (e) { console.warn('[botanic_garden] botanist', e); } }
        else if (!wantBot && botanist) { try { peds.remove(botanist); } catch { /* */ } botanist = null; }
      }
      if (near) { gateTick(); closingTick(dt); }
    }
    game.botanic = {
      sights, state: S, danby, glass, frame: F,
      errand: () => ({ day: day(), target: target(), active: errandActive(), found: S.found, done: S.doneDay === day() }),
      setForce(f) { S.force = f; return f; },
      stats() { let draws = 0, tris = 0; for (const m of meshes) { if (!m.visible) continue; draws++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } return { draws, tris: Math.round(tris), near, botanist: !!botanist, houses: glass ? glass.houses.length : 0, report: map._botReport || null }; },
      update: (dt) => tick(dt),
    };
    tick(0);
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[botanic_garden]', e); } } } };
  },
};

// ---------------------------------------------------------------- checks for tools/smoke_southeast.mjs
export async function pureChecks(ok, { map }) {
  const runs = wallRuns(doorGaps(map));
  ok(runs.length >= 7 && JSON.stringify(runs) === JSON.stringify(wallRuns(doorGaps(map))), `walled garden: ${runs.length} wall runs, deterministic (${doorGaps(map).length} glasshouse doors through the east wall)`);
  // the gaps: the Danby gateway, two east doors, the south gate, the south-east door
  const ring = []; for (const r of runs) ring.push(...r);
  const gapAt = (u, v) => runs.every((r) => { const [a, b] = r.map(([x, z]) => F.toL(x, z)); const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = l2 ? ((u - a[0]) * dx + (v - a[1]) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(u - a[0] - dx * t, v - a[1] - dz * t) > 1.0; });
  ok(gapAt(0, 0) && gapAt(54.2, 13.5) && gapAt(54.2, 54) && gapAt(-2.5, 105.5), 'gaps in the walls at the Danby Gateway, the east doors and the south gate');
  ok(!gapAt(-59.5, 50) && !gapAt(20, 0), 'the west wall (Rose Lane) and the High Street wall are solid');
  const beds = familyBeds(map); ok(beds.length > 20, `order beds in the quarters: ${beds.length}`);
  const hp = housePlan(map); ok(hp.length === 6 && hp.every((h) => h.rect.L > 3 && h.rect.W > 2), `six glasshouses on their mapped footprints: ${hp.map((h) => h.name + ' ' + h.rect.L.toFixed(1) + 'x' + h.rect.W.toFixed(1)).join(', ')}`);
  ok(hp.every((h) => F.toL(h.door.out[0], h.door.out[1])[0] < F.toL(h.rect.c[0], h.rect.c[1])[0]), 'every glasshouse door opens towards the walled garden');
  ok(isOpen(10) && !isOpen(8.5) && !isOpen(17.2), 'opening hours 09:00-17:00');
  const ts = new Set(); for (let d = 0; d < 60; d++) ts.add(targetOf(d)); ok(ts.size >= 6 && targetOf(12345) === targetOf(12345), `the errand's plant changes by the day (${ts.size} different in 60 days)`);
}
export async function installedChecks(ok, { game, place, run, walkable, at, setNow, interacts }) {
  const api = game.botanic; if (!api) { ok(false, 'game.botanic'); return; }
  ok(api.sights.length >= 6 && api.sights.every((s) => Number.isFinite(s.x) && s.blurb), 'Botanic Garden sights');
  ok(api.stats().houses === 6, 'six glasshouses built');
  const [ox, oz] = F.toW(0, -8), [ix, iz] = F.toW(0, 8);
  ok(walkable(ox, oz, ix, iz), 'through the Danby Gateway into the walled garden');
  { const [a, b] = F.toW(20, -3), [c, d] = F.toW(20, 3); ok(!walkable(a, b, c, d), 'the High Street wall is solid'); }
  for (const h of api.glass.houses) { const [cx, cz] = h.rect.c, dx = cx - h.door.x, dz = cz - h.door.z, dl = Math.hypot(dx, dz); const tx = h.door.x + dx / dl * 1.0, tz = h.door.z + dz / dl * 1.0; const w = walkable(h.door.out[0], h.door.out[1], tx, tz); if (!w && process.env.DBG) { const segs = []; game.worldCollider._near(Math.min(h.door.out[0], tx) - 1, Math.min(h.door.out[1], tz) - 1, Math.max(h.door.out[0], tx) + 1, Math.max(h.door.out[1], tz) + 1, (q) => segs.push(q.seg ? [q.x1, q.z1, q.x2, q.z2, q.tag].join(',') : ['c', q.x, q.z, q.r].join(','))); console.log('dbg', h.name, h.door, tx, tz, segs.slice(0, 12)); } ok(w, `into the ${h.name} through its door`); }
  { const [a, b] = F.toW(50, 13.5), [c, d] = F.toW(60, 13.5); ok(walkable(a, b, c, d), 'out of the east door towards the glasshouses'); }
  // tickets and closing time
  setNow(at(10, 9)); game.state.money = 20; place(ox, oz); run(0.6);
  const walkIn = (x0, z0, x1, z1, n = 24) => { for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; game.player.pos.set(x, 0, z); run(0.1); if (Math.hypot(game.player.pos.x - x, game.player.pos.z - z) > 0.5) break; } return F.toL(game.player.pos.x, game.player.pos.z); };
  let [, v] = walkIn(ox, oz, ix, iz); ok(v < 0, `no ticket: turned round at the Danby Gateway (v ${v.toFixed(1)})`);
  const k = interacts.find((i) => typeof i.label === 'function' && /Botanic Garden ticket/.test(i.label())); ok(!!k, 'the ticket desk'); k.onUse();
  ok(game.state.money === 20 - FEE, 'ticket paid');
  [, v] = walkIn(ox, oz, ix, iz); ok(v > 6, 'with a ticket: into the garden');
  // the errand
  place(...BOTANIST); run(0.6);
  ok(api.stats().botanist, 'the botanist is in the garden by day');
  const bt = interacts.find((i) => typeof i.label === 'function' && /botanist/.test(i.label())); bt.onUse();
  const e = api.errand(); ok(e.active && !!e.target, `errand: find ${e.target.name}`);
  const spot = interacts.find((i) => i.label === `Examine ${e.target.name}`); ok(!!spot && spot.enabled(), 'the plant can be examined');
  spot.onUse(); const m0 = game.state.money; bt.onUse(); ok(game.state.money === m0 + REWARD && api.errand().done, `reported back: +£${REWARD}`);
  // closing time: inside at 17:10 -> shown out, never stuck
  setNow(at(17.15, 9)); const [gx, gz] = F.toW(-30, 70); place(gx, gz); run(8);
  const [, v2] = F.toL(game.player.pos.x, game.player.pos.z); ok(v2 < -5, `after closing, the gardener walks you out (v ${v2.toFixed(1)})`);
  ok(!inWalled(game.player.pos.x, game.player.pos.z), 'and you are outside the walls');
  // river bank still open from the lower garden (swimming)
  {
    // nothing this module adds stands within 3 m of the Cherwell (banks stay open for swimming)
    const river = game.map.waterlines.filter((w) => /Cherwell/.test(w.name || '')).map((w) => w.pts);
    const dRiver = (x, z) => { let d = Infinity; for (const P of river) for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = l2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); d = Math.min(d, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)); } return d; };
    let worst = Infinity; const C2 = api.glass.colliders; for (const [x1, z1, x2, z2] of C2.segs) worst = Math.min(worst, dRiver(x1, z1), dRiver(x2, z2)); for (const [x, z] of C2.circles) worst = Math.min(worst, dRiver(x, z));
    for (const b of game.map.barriers) if (b.id.startsWith('bot-wall')) for (const [x, z] of b.pts) worst = Math.min(worst, dRiver(x, z));
    ok(worst > 3 + 7, `the garden's walls and glasshouses keep clear of the Cherwell (nearest ${worst.toFixed(1)} m from the centre line)`);
  }
  place(-205, 9); run(1); ok(!api.stats().botanist && !api.stats().near, 'from Worcester: no botanist');
  void WALL; void CONSERVATORY; void POND;
}
