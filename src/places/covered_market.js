// The Covered Market, c. 2013 — see docs/research/city_centre_west.md.
//   preMap    the generic 10 m block over the market (w3663178) is skipped; its walls stay solid; the avenues (covered
//             footways inside it) are closed to the ambient walkers; the High Street frontage houses (Nos. 10–16, Gwynn's
//             1774 front) are restyled as one Georgian stone range
//   install   the roofscape (flat roofs, a glazed lantern over every avenue and cross way), the four passages from the High
//             with their boards and gates, the Market Street front with its four doors (_cw_market.js) — all in the
//             shared one-draw LOD (_cw_kit.js); the interior (_cw_market_in.js) is built the first time anyone walks in:
//             four avenues of stalls under timber roofs — butcher, game dealer with pheasants on the rail, greengrocer,
//             a cake shop window, hot cookies, pies, florist, cobbler, café, cheese, fish, hats (real stall names; invented under ?invented=1) — and
//             things to buy that go in the inventory (I) and can be eaten (the supermarkets' PRODUCTS table).
// Opening hours 08:00–17:30 (game clock). Stallholders are scripted NPCs (shared-clock lines). No Math.random, no network.
// Test hooks: game.market = { sights, stats(), debugEnter(door), debugExit(), buy(id) }      tools/smoke_citywest.mjs
import * as THREE from 'three';
import { PRODUCTS } from './_shop_data.js';
import { shared, addLevels, farCopy, cwSigns, signsMesh, signsTick } from './_cw_kit.js';
import * as M from './_cw_market.js';
import { buildInterior, WARES, STALL_LINES } from './_cw_market_in.js';
import { planWalkin, streetDoor, cityDoor, warmLater, cityDoorMats, dressOpenings, archLining, roomCrowd } from './_walkin_city.js';

// Walk-in (core/interiors.js "seamless"): the interior is built in world coordinates, so the room's frame is the
// identity; the nine real entrances are its portals — the four passages from the High (at the market's back wall, where
// the gates are), the four doors on Market Street, and Golden Cross. Gates: a sliding pair of framed iron gates in each
// entrance (core/_doors.js 'slide'), locked with a "Closed" card out of hours.
// STAND_OPEN: the gates stand open all day (no motion as you walk up) instead of parting as people come near. Off until
// tools/smoke_walkin_city.mjs knows about doors that stand open (it expects a door to be shut when nobody is near).
const STAND_OPEN = false;
const GATE_W = { south: 2.0, north: 2.8, golden: 2.4 };
/** the nine entrances as portals: [{ at, out, w, h, kind, av }] — pure (map → the same for every player) */
export function marketPortals(map) {
  const body = M.body(map); if (!body) return null;
  let A = 0; for (let i = 0; i < body.length; i++) { const p = body[i], q = body[(i + 1) % body.length]; A += p[0] * q[1] - q[0] * p[1]; }
  // nearest point of the body's outline to a point, and the outward normal there
  const onWall = (pt) => { let best = null; for (let i = 0; i < body.length; i++) { const a = body[i], b = body[(i + 1) % body.length], ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez); if (L < 0.5) continue; const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * ex + (pt[1] - a[1]) * ez) / (L * L))), x = a[0] + ex * t, z = a[1] + ez * t, e = Math.hypot(pt[0] - x, pt[1] - z); if (!best || e < best.e) best = { e, at: [x, z], n: A > 0 ? [ez / L, -ex / L] : [-ez / L, ex / L] }; } return best; };
  const out = [];
  for (const av of M.AVENUES) { const [a, b] = av.back, ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez); let n = [ez / L, -ex / L]; if (n[1] < 0) n = [-n[0], -n[1]]; out.push({ at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], out: Math.atan2(n[0], n[1]), w: Math.min(GATE_W.south, L - 0.2), h: 2.55, kind: 'south', av: av.n }); }
  for (const av of M.AVENUES) { const w = onWall(av.e); out.push({ at: w.at, out: Math.atan2(w.n[0], w.n[1]), w: GATE_W.north, h: 3.05, kind: 'north', av: av.n }); }
  { const g = M.GOLDEN, d = [g.inside[0] - g.door[0], g.inside[1] - g.door[1]], l = Math.hypot(d[0], d[1]), w = onWall([g.inside[0] - d[0] / l * 2.1, g.inside[1] - d[1] / l * 2.1]); out.push({ at: w.at, out: Math.atan2(w.n[0], w.n[1]), w: GATE_W.golden, h: 2.9, kind: 'golden', av: 0 }); }
  return out;
}

export const OPEN = [8, 17.5], PLACE = 'cw_market';
export const isOpen = (hour) => hour >= OPEN[0] && hour < OPEN[1];

export default {
  id: 'covered_market',
  preMap(game) {
    try {
      const ov = game.overrides, map = game.map;
      // the generic block stays (hidden inside the hand-built shell) so its neighbours' party walls stay hidden: see
      // _cw_market.js hiddenBlock()
      const blk = map.buildings.find((q) => q.id === M.ID);
      if (blk && !blk.cwOrig) {
        const ring = M.hiddenBlock(map);
        blk.cwOrig = blk.poly; blk.poly = ring; blk.part = true; blk.tags = { building: 'yes' };
        ov.heights.set(M.ID, 5.6);
        ov.style.set(M.ID, { wall: 'render', roof: 'flat', shape: 'flat', color: '#d9d0bd', up: 'renderBlank', first: 'renderBlank', top: 'renderBlank', ground: 'renderBlank', door: 'renderBlank', ivy: false });
      } else if (!blk) ov.skip.add(M.ID);
      for (const id of M.FRONT_IDS) { ov.style.set(id, { wall: 'stone', roof: 'slate', color: '#efe3c8', up: 'stoneSash', ground: 'shopA', storeys: 3 }); ov.heights.set(id, 11.4); }
      for (const ch of M.chainsOf(map)) game.worldCollider.addPolyline(ch);
      // the avenues inside are not pavements any more: keep the ambient walkers out of the (solid) market
      const b = map.buildings.find((q) => q.id === M.ID), body = M.body(map);
      if (b && body) for (const r of map.roads) {
        if (!r.pts || !(r.kind === 'footway' || r.kind === 'corridor')) continue;
        const inside = r.pts.filter((p) => pipXZ(p, body)).length;
        if (inside >= Math.max(1, r.pts.length - 1) || (/^Avenue [1-4]$/.test(r.name || '') && inside > 0)) r.access = 'no';
      }
    } catch (e) { console.error('[covered_market] preMap', e); }
  },
  install(game) {
    const W = game.world, map = game.map, S = shared(game), st = { err: false, built: null, bought: 0 };
    const sights = [];
    S.site('market', [190, 262, 190, 316], 45);     // the flat roofs throw little shadow worth a draw from up Cornmarket
    const sg = cwSigns(W);
    const ext = M.buildExterior(S.P, map, (n) => sg.uv(n));
    if (ext) addLevels(S, 'market', ext.near, farCopy(ext.near, 0.6), ext.far, [60, 190, 390], 40);
    const signs = ext ? signsMesh(ext.signs, W, 'market') : null; if (signs) W.addStatic(signs);
    // the products, for the inventory (I eats food: energy > 0)
    for (const w of Object.values(WARES)) if (!PRODUCTS[w.id]) PRODUCTS[w.id] = { name: w.name, cat: 'market', price: w.price, energy: w.energy, shape: 'box', w: 0.12, h: 0.1, d: 0.1, col: '#c8a070', src: 'cw' };
    // doors: the four passages from the High, the four on Market Street, Golden Cross
    const doors = [];
    for (const av of M.AVENUES) { const d = M.southDoor(av); doors.push({ pos: d.pos, facing: d.facing, inside: d.inside, label: `Go into the Covered Market (Avenue ${av.n})`, out: 'Out to the High Street' }); }
    for (const av of M.AVENUES) { const d = M.northDoor(av); doors.push({ pos: d.pos, facing: d.facing, inside: d.inside, label: `Go into the Covered Market (Avenue ${av.n})`, out: 'Out to Market Street' }); }
    doors.push({ pos: M.GOLDEN.door, facing: M.GOLDEN.facing, inside: M.GOLDEN.inside, label: 'Go into the Covered Market (from Golden Cross)', out: 'Out to Golden Cross' });
    for (const d of doors) d.locked = () => (st.debugFree || isOpen(game.time.hour) ? false : 'The Covered Market is shut. Open 8:00 till 5:30.');
    // ---- walk-in plan: identity frame (the first portal's room point IS its world point), no outline to snap to (the
    // shell is hand-built on the market's own outline, which is also the room's wall: the fit is exact by construction —
    // tools/smoke_citywest.mjs checks the walls against the outline). `rects` = a square of floor 2.2 m inside each entrance.
    let plan = null;
    try {
      const PT = marketPortals(map), WALL = 0.02;
      if (PT) {
        const p0 = PT[0], f0 = p0.out, body = M.body(map);
        const blk = map.buildings.find((q) => q.id === M.ID), outline = (blk && blk.cwOrig) || body;      // the market's mapped outline (the generic block's own ring is shrunk: hiddenBlock)
        const c1 = M.AVENUES[0];
        plan = planWalkin(game, {
          id: PLACE, building: outline, snap: false, wall: WALL,
          door: { pos: [p0.at[0] + Math.sin(f0) * WALL, p0.at[1] + Math.cos(f0) * WALL], facing: f0 },
          portal: { at: p0.at, out: p0.out, w: p0.w, h: p0.h },
          more: PT.slice(1).map((q) => ({ at: q.at, out: q.out, w: q.w, h: q.h, depth: WALL })),
          rects: PT.map((q) => { const x = q.at[0] - Math.sin(q.out) * 2.2, z = q.at[1] - Math.cos(q.out) * 2.2; return [x - 0.3, z - 0.3, x + 0.3, z + 0.3]; }),
          center: [(c1.s[0] + M.AVENUES[3].e[0]) / 2, (c1.s[1] + M.AVENUES[3].e[1]) / 2],
          mid: [c1.s[0] + (c1.e[0] - c1.s[0]) * 0.25, c1.s[1] + (c1.e[1] - c1.s[1]) * 0.25],
          hours: { open: () => st.debugFree || isOpen(game.time.hour), testOpen: 12, testShut: 21 },
        });
        plan.portalKinds = PT;
        // the street's walkers go in and out at every gate (a few steps inside, then out again)
        PT.forEach((q, i) => streetDoor(game, plan, { portal: i, inside: [], cap: 2, every: 26, dwell: [8, 25] }));
      }
    } catch (e) { console.error('[covered_market] walk-in plan', e); plan = null; }
    // the arched head of each entrance (segmental: rise in metres), by portal
    const ARCHES = plan ? plan.portalKinds.map((q) => ({ kind: q.kind, rise: q.kind === 'south' ? 0.28 : q.kind === 'north' ? 0.42 : 0.38 })) : [];
    const def = game.interiors.register({
      id: PLACE, name: 'The Covered Market', background: 0x1a1612, ambient: 0.5, doors,
      seamless: plan && plan.fit.ok ? plan.seamless : null,
      *build(ctx) {      // (in pieces: core/interiors.js `*build`)
        const r = yield* buildInterior(ctx, W, S.P, map);
        yield;
        st.built = r.stats; st.counters = r.counters;
        if (ctx.seamless) {
          // the gates: a framed iron pair in every entrance (green, as the market's ironwork), no glass
          const DM = cityDoorMats(), gate = DM.cwGate || (DM.cwGate = new THREE.MeshLambertMaterial({ color: 0x1f3a2a, name: 'wc:market-gate' }));
          st.gates = ctx.seamless.portals.map((pt, i) => {
            const D = cityDoor(ctx, plan, { portal: i, kind: 'slide', open: plan.hours.open, rangeOut: 6.5, rangeIn: 5.5, hold: 2.5, setBack: -0.08 });      // (8 cm inside the wall face: slid open, the leaves are behind the wall from the street, against it inside)
            if (!D) return null;
            D.group.traverse((o) => { if (!o.isMesh) return; if (o.material === DM.glass) o.visible = false; else if (o.material === DM.frame) o.material = gate; });
            // concertina gates: each leaf folds up against its own jamb as it opens (it never slides past the jamb, where
            // it would be seen standing in front of the wall from the street)
            if (D.leaves && D.leaves.length === 2) { const hw = pt.w / 2; D._place = () => { const k = 1 - 0.86 * Math.min(1, D.slide / (hw - 0.06)); D.leaves[0].scale.z = D.leaves[1].scale.z = k; D.leaves[0].position.z = -hw * (1 - k); D.leaves[1].position.z = hw * (1 - k); }; D._place(); }
            if (STAND_OPEN) { const u = D.update; D.update = (dt, pp, env) => { let on = false; try { on = plan.hours.open(); } catch { on = false; } if (on) D.want = Math.max(D.want, 1); u(dt, pp, env); }; }
            return D;
          });
        }
        if (ctx.seamless) { try { const lin = archLining(game.interiors.get(PLACE), ARCHES.map((a, i) => ({ p: i, head: 'segment', rise: a.rise })), { color: 0xe9e1cf }); if (lin) ctx.scene.add(lin); } catch (e) { console.warn('[covered_market] arch lining', e); } }
        if (!ctx.seamless) for (const d of doors) game.interact.add({ place: PLACE, pos: d.inside, radius: 1.5, label: d.out, onUse: () => { def._via = d; game.interiors.exit(); } });
        for (const c of r.counters) {
          const w = WARES[c.id]; if (!w) continue;
          game.interact.add({ place: PLACE, pos: c.pos, radius: 1.4, label: `Buy ${w.name} (£${w.price.toFixed(2)})`, onUse: () => buy(c.id, c) });
        }
        // (the stallholders and the shoppers: `crowd` below — there whenever the market is shown and open)
        const d0 = doors[0];
        return { spawn: d0.inside, heading: d0.facing + Math.PI };
      },
      // seen from the street (you are outside, an entrance is in view): only the people near enough to be made out are
      // drawn — the market holds ~70 and every one is several draws
      updateShown(dt) { crowd.tick(dt); showPeople(26); },
      update(dt) { crowd.tick(dt); if (def.sl) showPeople(45); },
      onEnter() {
        // (walked in through a gate: you are where you are; a tool's enter(…, door) puts you inside that door)
        const d = def.sl ? def._via : def._via || doors[0];
        if (d && d.inside) game.player.teleport(d.inside[0], d.inside[1], d.facing + Math.PI);
        if (!def.sl) st.debugFree = false;
        try { game.ui.toast('The Covered Market: since 1774. Mind the florist\'s buckets.', 4); } catch { /* */ }
      },
    });
    // The market is 115 m long: no single point is near all nine entrances. The core measures "near this room" (shown,
    // built, who can work a door, the camera's lintel) from the nearest of the room's centres — here a point every 12 m
    // down each avenue (world coordinates, as M.AVENUES is).
    if (def && def.sl) {
      const C = [];
      for (const av of M.AVENUES) { const L = Math.hypot(av.e[0] - av.s[0], av.e[1] - av.s[1]), n = Math.max(1, Math.ceil(L / 12)); for (let k = 0; k <= n; k++) C.push([av.s[0] + (av.e[0] - av.s[0]) * k / n, av.s[1] + (av.e[1] - av.s[1]) * k / n]); }
      def.sl.centersW = C;
    }
    // ---- the people of the market, there whenever it is SHOWN and open (seen down the avenues from Market Street, the
    // High Street passages and Golden Cross): a stallholder behind every counter (scripted lines), nine
    // shoppers down every avenue — some browsing at a stall front, some strolling — and two on each cross way. Placed
    // by rule (no random): every player sees the same people. After hours the market is empty.
    const crowd = roomCrowd(game, PLACE, {
      cap: 90, every: 2, signature: () => (st.debugFree || isOpen(game.time.hour) ? 'open' : 'shut'),
      populate(spawn) {
        if (!(st.debugFree || isOpen(game.time.hour))) return;
        for (const c of st.counters || []) { if (!WARES[c.id]) continue; c.ped = spawn(c.keeper[0], c.keeper[1], null, { heading: c.heading, label: null, lines: STALL_LINES[c.id], static: false }); }
        for (const [k, av] of M.AVENUES.entries()) {
          const dx = av.e[0] - av.s[0], dz = av.e[1] - av.s[1], L = Math.hypot(dx, dz), px = -dz / L, pz = dx / L;
          for (let j = 0; j < 9; j++) {
            // (seven down the avenue, and two just inside the Market Street gate so that every entrance shows people)
            const t = j < 7 ? 0.07 + 0.125 * j + 0.03 * (k % 2) : 0.9 + 0.045 * (j - 7), side = (j + k) % 2 ? 1 : -1, browse = (j + k) % 3 === 0, off = browse ? side * (j > 0 && j < 7 ? 0.55 : 0.95) : side * 0.35;      // (browsing: facing a stall from the avenue, clear of the crates a greengrocer piles out in front — at 0.95 some stood in them; those nearest either end of an avenue stay at 0.95, out of the line of its automatic door, which they would hold open)
            const x = av.s[0] + dx * t + px * off, z = av.s[1] + dz * t + pz * off;
            const head = browse ? Math.atan2(px * side, pz * side) : Math.atan2(dx, dz) + (j % 2 ? Math.PI : 0);
            spawn(x, z, null, { heading: head, static: false, wander: browse ? undefined : { radius: 6, speed: 0.7 } });
          }
        }
        for (const [k, c] of M.CROSS.entries()) for (let j = 0; j < 2; j++) { const t = 0.3 + 0.4 * j, x = c.a[0] + (c.b[0] - c.a[0]) * t, z = c.a[1] + (c.b[1] - c.a[1]) * t + (k ? 0.4 : -0.4); spawn(x, z, null, { heading: j ? 1.4 : -1.7, static: false, wander: { radius: 4, speed: 0.7 } }); }
      },
    });
    const people = crowd.npcs;
    // ---- the outside of the nine entrances (world scene; _walkin_city.js dressOpenings): each is ONE arched market
    // entrance — a segmental head in the wall's stucco over the iron gates, a green-painted architrave and keystone
    // (GUESS: the real entrances' exact dressing), the gates behind.
    try {
      if (def && def.sl) {
        const GR = 0x1d4a30, ST = 0xe9e1cf;
        dressOpenings(game, PLACE, ARCHES.map((a, i) => ({ p: i, head: 'segment', rise: a.rise, wall: a.wall ?? ST, fill: false,
          surround: { w: a.kind === 'south' ? 0.1 : 0.14, color: GR, proud: 0.07 }, keystone: a.kind === 'south' ? false : 0xd8cfb8,
          ...(a.kind === 'golden' ? { step: { h: 0.06, proj: 0.3, over: 0.2, color: 0xa9a294 } } : {}) })));
      }
    } catch (e) { console.error('[covered_market] entrances', e); }
    function showPeople(r) {
      const pl = game.player, w = pl.place === 'world' ? pl.pos : pl.place === PLACE ? pl.pos : pl.worldPos;      // (the room's frame is the world's)
      for (const p of people) { const g = p && p.character && p.character.group; if (!g) continue; const on = Math.hypot(p.x - w.x, p.z - w.z) < r; if (g.visible !== on) g.visible = on; }
    }
    try { warmLater(game, PLACE, { heavy: true }); } catch { /* */ }
    function buy(id, c) {
      const w = WARES[id]; if (!w) return false;
      if (!game.pay(-w.price)) { game.ui.toast(`£${w.price.toFixed(2)}? You're short.`, 3); return false; }
      const inv = Array.isArray(game.state.inventory) ? game.state.inventory : (game.state.inventory = []);
      inv.push({ id: w.id, name: w.name, brand: '', paid: true }); while (inv.length > 40) inv.shift();
      game.save(); st.bought++;
      try { if (c && c.ped && c.ped.character && c.ped.character.say) c.ped.character.say(w.say, 3.5); } catch { /* */ }
      try { game.ui.toast(`You buy: ${w.name}.${w.energy ? ' (I to eat it)' : ''}`, 3); } catch { /* */ }
      return true;
    }
    const c0 = M.AVENUES[1];
    sights.push(
      { id: 'covered-market', name: 'The Covered Market', x: (c0.s[0] + c0.e[0]) / 2, z: (c0.s[1] + c0.e[1]) / 2, blurb: 'Opened in 1774 to get the butchers off the streets: four avenues of stalls under timber roofs between the High and Market Street.' },
      { id: 'covered-market-high', name: 'The Covered Market\'s High Street front', x: 236, z: 306, blurb: 'John Gwynn\'s frontage of 1774, Nos. 10–16 High Street, with the avenues coming out between the shops.' },
      { id: 'covered-market-game', name: 'The game dealer\'s rail', x: c0.s[0], z: c0.s[1] - 20, blurb: 'Pheasants and mallard hung by the neck over the counter, as they have been for two centuries.' },
      { id: 'covered-market-cakes', name: 'The cake shop window', x: c0.s[0], z: c0.s[1] - 40, blurb: 'Celebration cakes in the window: tiers, sugar roses, a fortieth for somebody.' },
    );
    function tick(dt) {
      S.tick('covered_market');
      signsTick(signs, game.camera, 28);
      void dt;
    }
    game.market = {
      sights, doors, buy, isOpen, plan: () => plan, gates: () => st.gates || null,
      debugEnter(i = 0) { st.debugFree = true; return game.interiors.enter(PLACE, doors[i]); },
      debugExit() { if (game.player.place === PLACE) { return game.interiors.exit(); } return null; },
      stats() { return { lod: S.stats.market, interior: st.built, bought: st.bought, counters: st.counters ? st.counters.map((c) => c.id) : null }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!st.err) { st.err = true; console.error('[covered_market]', e); } } } };
  },
};

function pipXZ(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) c = !c; } return c; }

