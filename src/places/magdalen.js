// Magdalen College, c. 2013 — docs/research/christ_church_botanic_magdalen.md §3 (known vs guessed).
//
//   preMap   the Cloister ring (OSM r182657) skipped and rebuilt (_magd_cloister.js); the New Building restyled (Palladian,
//            1733: three storeys over an arcaded ground floor, pale ashlar, slate); the Grove's fences made estate
//            railings. Magdalen Tower and the High Street are NOT touched (May Morning stands on them).
//   install  the cloister walk with its arcade, buttresses and 22 "hieroglyphics", wisteria; the outdoor stone pulpit in
//            St John's Quad; the Grove's fallow deer (_magd_deer.js drawing, _ccm_herd.js behaviour on the shared
//            clock: everyone sees the same herd); snake's-head fritillaries along Addison's Walk (medium / high, near).
//   game     the porters' lodge: open to visitors 13:00-18:00 for £5 (turned round otherwise); feed the deer at the
//            Grove railings (they come up, nibble, then bolt — a local, cosmetic reaction); preach from the outdoor
//            pulpit (tourists may throw coins); walk the whole of Addison's Walk for a small reward.
// Cost: one batch for the cloister + pulpit (shared world materials) plus the world-styled upper storey; ONE instanced
// draw for the herd (drawn within ~200 m of it); the flowers only near the walk, never on low.
// Test hooks: game.magdalen = { stats(), sights, state, deer(tMs), viewDeer(d), feed(), setForce(f) }
import * as THREE from 'three';
import { randomLook } from '../core/characters.js';
import { Batch, seMats, buildMeshes, prism, lathe, pointInPoly, distToPoly, hh, distCull } from './_chch_kit.js';
import { build as buildCloister, CLOISTER, cloisterRing } from './_magd_cloister.js';
import { createDeerMesh } from './_magd_deer.js';
import { lodSwap, lodScale, shadowProxy } from './_se_fine.js';
import { makeHerd, cowState, hourOf, DAY_MS } from './_ccm_herd.js';

export const IDS = { cloister: 'r182657', newBuilding: 'w38255269', grove: 'r12631154', groveWoods: ['w935399599', 'w935399601'], railings: ['w935388237', 'w935388239'], addison: 'w3354166' };
export const FEE = 5, HOURS = { open: 13, close: 18 };
export const isOpen = (h) => h >= HOURS.open && h < HOURS.close;
export const DEER = 40;                      // ~40 in the Parks & Gardens record; ~60 later
// the herd keeps to the southern half of the Grove, in sight of the New Building (the northern meadow is a guess-free
// "elsewhere": anchors are drawn south of it)
export const GROVE_NORTH = [[730, -60], [1040, -60], [1040, 70], [730, 70]];
export const PULPIT = { x: 893.6, z: 321.3, h: Math.atan2(-0.869, -0.492) };
const LODGE = { a: [854, 332], n: [0.66, -0.75], gate: [869, 333], out: [866.0, 338.6], inside: 10.5 };
const ALIAS = { stoneWarm: 'stone', iron: 'stone', leafDark: 'leaf', flowerPink: 'flowerPurple' };
export const sights = [
  { id: 'magd-tower', name: 'Magdalen Tower', x: 905.5, z: 362.5, blurb: 'The Great Tower (1492-1509), 44 m: the choir sings from its top at dawn on May Morning.' },
  { id: 'magd-cloister', name: 'The Cloister', x: 936, z: 314, blurb: 'William Orchard\'s cloister of 1474-80, with 22 carved "hieroglyphics" (1508-09) perched on its buttresses.' },
  { id: 'magd-pulpit', name: 'The outdoor pulpit', x: PULPIT.x, z: PULPIT.z, blurb: 'A stone pulpit in St John\'s Quad: a sermon is preached from it on the Sunday nearest St John the Baptist\'s day.' },
  { id: 'magd-new-building', name: 'The New Building', x: 975, z: 226, blurb: 'A long Palladian range of 1733 over an open arcade, all that was built of a planned grand quad.' },
  { id: 'magd-grove', name: 'The Grove deer park', x: 900, z: 120, blurb: 'Fallow deer have grazed the Grove since the early 1700s.' },
  { id: 'magd-addison', name: 'Addison\'s Walk', x: 1180, z: 70, blurb: 'Just under a mile round the water meadow between the arms of the Cherwell; snake\'s-head fritillaries in spring.' },
];

export default {
  id: 'magdalen',
  preMap(game) {
    try {
      const ov = game.overrides, map = game.map;
      ov.skip.add(IDS.cloister);
      if (!ov.style.has(IDS.newBuilding)) ov.style.set(IDS.newBuilding, { wall: 'stone', roof: 'slate', tint: [1.05, 1.02, 0.95], ground: 'stoneArchDoor', door: 'stoneArchDoor', up: 'stoneSash', storeys: 4, ivy: false });
      if (!ov.heights.has(IDS.newBuilding)) ov.heights.set(IDS.newBuilding, 14.5);
      for (const b of map.barriers) if (IDS.railings.includes(b.id)) { b.kind = 'railing'; b.h = 1.5; b.material = 'metal'; }
    } catch (e) { console.error('[magdalen] preMap', e); }
  },

  install(game) {
    const W = game.world, scene = game.worldScene, map = game.map, peds = game.pedestrians, ui = game.ui, P = game.player, col = game.worldCollider;
    const mats = seMats(W);
    const S = { err: false, ticketDay: -1, outside: null, preachDay: -1, walk: { day: -1, seen: new Set(), done: -1 }, feed: null, force: null, deerOn: false, t: 0, flowersOn: false };
    const flags = game.state.flags || (game.state.flags = {});
    if (flags.magdTicket != null) S.ticketDay = flags.magdTicket;
    const now = () => game.time.now(), hour = () => (S.force === 'open' ? 15 : game.time.hour), day = () => Math.floor(now() / DAY_MS);
    const meshes = [];
    // ================================================================ the cloister + the outdoor pulpit
    let cl = null;
    try {
      cl = buildCloister({ world: W, mats, parent: scene, map, alias: ALIAS });
      if (cl) { meshes.push(...cl.meshes); for (const [x1, z1, x2, z2] of cl.colliders) col.addSegment(x1, z1, x2, z2, { tag: 'wall' }); for (const [a, b] of cl.passages) col.addPassage(a[0], a[1], b[0], b[1], 2.4); }
    } catch (e) { console.error('[magdalen] cloister', e); }
    try {
      const B = new Batch(), { x, z, h } = PULPIT, c = Math.cos(h), s = Math.sin(h);
      const T = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      const [px, pz] = T(0, 0);
      lathe(B, 'stone', px, pz, [[0.15, 1.2], [0.5, 2.1], [0.75, 2.4], [0.75, 3.4], [0.8, 3.5], [0, 3.5]], 8, 0);   // corbelled tub
      lathe(B, 'stone', px, pz, [[0.95, 5.6], [1.05, 5.75], [0.6, 6.3], [0, 6.6]], 8, 0);                          // sounding board (guess)
      for (let k = 0; k < 6; k++) { const [sx, sz] = T(-1.1 + k * 0.42, -1.0 + k * 0.12); B.box('stone', sx, 0.2 + k * 0.4, sz, 0.45, 0.4 + k * 0.8, 0.5, h); }   // stair up from the quad (guess)
      meshes.push(...buildMeshes(B, mats, scene, 'magd:pulpit:', { mono: W }));
      col.addCircle(px, pz, 0.6);
    } catch (e) { console.error('[magdalen] pulpit', e); }

    // ================================================================ the porters' lodge (visitors)
    const insideLodge = (x, zz) => (x - LODGE.a[0]) * LODGE.n[0] + (zz - LODGE.a[1]) * LODGE.n[1];
    game.interact.add({ pos: LODGE.out, radius: 2.4, label: () => (S.ticketDay === day() ? 'Magdalen visitor ticket: valid today' : `Pay to visit Magdalen (£${FEE})`), enabled: () => isOpen(hour()) || S.ticketDay === day(),
      onUse: () => { if (S.ticketDay === day()) { ui.toast('You\'re all paid up. The deer are through the cloister and out the back.'); return; } if (!game.pay(-FEE)) { ui.toast(`It\'s £${FEE}.`); return; } S.ticketDay = day(); flags.magdTicket = day(); game.save(); ui.toast('Ticket bought. Cloister, deer park and Addison\'s Walk await.', 4); } });
    function lodgeTick() {
      if (P.place !== 'world' || P.vehicle || (game.swim && game.swim.active)) { S.outside = null; return; }
      const x = P.pos.x, z = P.pos.z;
      if (Math.min(Math.hypot(x - LODGE.gate[0], z - LODGE.gate[1]), Math.hypot(x - 858, z - 328)) > 9) { S.outside = null; return; }
      const d = insideLodge(x, z);
      if (d < LODGE.inside - 2) { S.outside = { x, z }; return; }
      if (d < LODGE.inside || !S.outside) return;
      S.outside = null;
      if (S.force === 'open' || (isOpen(hour()) && S.ticketDay === day())) return;
      P.teleport(LODGE.out[0], LODGE.out[1], Math.atan2(-LODGE.n[0], -LODGE.n[1]));
      ui.toast(isOpen(hour()) ? 'The porter: "Visitors pay at the lodge window, please."' : 'The porter: "College is closed to visitors. One till six."', 3.5);
    }
    // ================================================================ the pulpit: preach
    game.interact.add({ pos: [PULPIT.x - Math.sin(PULPIT.h) * -1.4, PULPIT.z - Math.cos(PULPIT.h) * -1.4], radius: 2.2, label: 'Climb into the outdoor pulpit and preach',
      onUse: () => {
        const back = { x: P.pos.x, z: P.pos.z, h: P.heading }; let t = 0, paid = false;
        const SERMONS = ['"Dearly beloved, consider the lilies of the Botanic Garden..."', '"On the subject of essays handed in late..."', '"And lo, the porter said unto them: keep off the grass."', '"Brethren, the deer are watching. Always watching."'];
        const line = SERMONS[Math.floor(hh(day(), Math.floor(now() / 60000)) * SERMONS.length)];
        game.beginActivity({ name: 'pulpit', hint: 'Preaching. (Esc to step down)', update(dt) {
          t += dt;
          if (t > 0.5 && t - dt <= 0.5) ui.toast(line, 4);
          if (t > 5 && !paid && S.preachDay !== day()) { paid = true; S.preachDay = day(); const coins = hour() >= 9 && hour() < 19 ? 2 : 0; if (coins) { game.pay(coins); ui.toast(`A passing tourist, moved, tosses you £${coins}.`, 3.5); } else ui.toast('Nobody is listening. A pigeon nods.', 3.5); }
        }, onEnd() { P.teleport(back.x, back.z, back.h); } });
      } });

    // ================================================================ the Grove's fallow deer
    const grove = map.areas.find((a) => a.id === IDS.grove);
    const woods = IDS.groveWoods.map((id) => map.areas.find((a) => a.id === id)).filter(Boolean).map((a) => a.poly);
    let herd = null, deer = null;
    const st = {};
    if (grove) {
      herd = makeHerd([{ poly: grove.poly, holes: woods.concat([GROVE_NORTH]), n: DEER }]);
      try {
        deer = createDeerMesh(herd.cows.length);
        herd.cows.forEach((c, i) => { const k = hh(i, 41); deer.setCoat(i, k < 0.62 ? 0 : k < 0.8 ? 1 : k < 0.9 ? 2 : k < 0.97 ? 3 : 4, hh(i, 43) < 0.3, c.seed, 0.92 + 0.16 * hh(i, 47)); });
        scene.add(deer.mesh);
      } catch (e) { console.error('[magdalen] deer', e); deer = null; }
    }
    const hourAt = (ms) => (game.time && game.time.pinned != null ? game.time.pinned : hourOf(ms));
    let gbb = null; if (grove) { gbb = [Infinity, -Infinity, Infinity, -Infinity]; for (const [x, z] of grove.poly) { gbb[0] = Math.min(gbb[0], x); gbb[1] = Math.max(gbb[1], x); gbb[2] = Math.min(gbb[2], z); gbb[3] = Math.max(gbb[3], z); } }
    const distGrove = (x, z) => (gbb ? Math.hypot(Math.max(gbb[0] - x, 0, x - gbb[1]), Math.max(gbb[2] - z, 0, z - gbb[3])) : Infinity);
    // feeding: a local reaction layered on the shared herd: the nearest few come to the railing, nibble, then bolt
    const railLines = map.barriers.filter((b) => IDS.railings.includes(b.id)).map((b) => b.pts);
    const nearestOnRail = (x, z) => { let best = null, bd = Infinity; for (const pts of railLines) for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = l2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; best = [px, pz, d]; } } return best; };
    const feedOverride = (i, base, tMs, out) => {
      const F = S.feed; if (!F) return false; const k = F.ids.indexOf(i); if (k < 0) return false;
      const t = (tMs - F.t0) / 1000, tgt = F.spots[k], bolt = F.bolt[k];
      const ease = (a) => a * a * (3 - 2 * a);
      if (t < F.boltAt) {
        const d0 = Math.hypot(tgt[0] - F.from[k][0], tgt[1] - F.from[k][1]), dur = Math.max(2, d0 / (d0 > 30 ? 3.2 : 1.4)), e = Math.min(1, t / dur);
        out.x = F.from[k][0] + (tgt[0] - F.from[k][0]) * ease(e); out.z = F.from[k][1] + (tgt[1] - F.from[k][1]) * ease(e);
        out.h = e < 1 ? Math.atan2(tgt[0] - F.from[k][0], tgt[1] - F.from[k][1]) : Math.atan2(F.px - out.x, F.pz - out.z);
        out.walk = e < 1 ? (d0 > 30 ? 1.5 : 1) : 0; out.graze = e < 1 ? 0 : 0.45; out.lie = 0; out.phase = t * (d0 > 30 ? 12 : 7.5); return true;
      }
      const tb = t - F.boltAt, e = Math.min(1, tb / 2.6);
      if (tb < 2.6) { out.x = tgt[0] + (bolt[0] - tgt[0]) * ease(e); out.z = tgt[1] + (bolt[1] - tgt[1]) * ease(e); out.h = Math.atan2(bolt[0] - tgt[0], bolt[1] - tgt[1]); out.walk = 1.6; out.graze = 0; out.lie = 0; out.phase = tb * 14; return true; }
      const back = Math.min(1, (tb - 2.6) / 9); if (back >= 1) return false;
      out.x = bolt[0] + (base.x - bolt[0]) * ease(back); out.z = bolt[1] + (base.z - bolt[1]) * ease(back); out.h = Math.atan2(base.x - bolt[0], base.z - bolt[1]); out.walk = back < 1 ? 1 : 0; out.graze = 0; out.lie = 0; out.phase = tb * 7; return true;
    };
    const tmp = {};
    function deerAt(i, tMs, out = {}) { const c = herd.cows[i]; cowState(herd, c, tMs, out, hourAt); if (feedOverride(i, { x: out.x, z: out.z }, tMs, tmp)) Object.assign(out, tmp); return out; }
    // (Two deer whose walks cross used to be drawn through each other. Where two would stand within 0.85 m, each is
    //  drawn half the shortfall away from the other — one that is lying down is left where it lies and the other steps
    //  round it. Worked out from the shared clock's positions, in a fixed order: every player sees the same herd.)
    const dS = [];
    function updateDeer() {
      const t = now(), n = herd.cows.length; deer.uniforms.uDeerTime.value = (t % 3600000) / 1000;
      for (let i = 0; i < n; i++) { const s = dS[i] || (dS[i] = {}); deerAt(i, t, s); s.ox = 0; s.oz = 0; }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = dS[i], b = dS[j]; let ex = a.x - b.x, ez = a.z - b.z; const d2 = ex * ex + ez * ez; if (d2 >= 0.7225) continue;
        const d = Math.sqrt(d2), sh = 0.85 - d; if (d < 0.02) { ex = Math.cos(i * 2.4); ez = Math.sin(i * 2.4); } else { ex /= d; ez /= d; }
        const la = a.lie > 0.5, lb = b.lie > 0.5, ka = la ? 0 : lb ? 1 : 0.5, kb = 1 - ka;
        a.ox += ex * sh * ka; a.oz += ez * sh * ka; b.ox -= ex * sh * kb; b.oz -= ez * sh * kb;
      }
      for (let i = 0; i < n; i++) { const s = dS[i], x = s.x + s.ox, z = s.z + s.oz; deer.set(i, x, W.groundHeight ? W.groundHeight(x, z) : 0.01, z, s.h, s.walk, s.graze, s.lie, s.phase); }
      deer.commit();
    }
    function feed() {
      if (!herd) return false;
      const r = nearestOnRail(P.pos.x, P.pos.z); if (!r || r[2] > 2.6) { ui.toast('Find a spot by the Grove railings.'); return false; }
      const t = now(), cand = herd.cows.map((c, i) => { const s = cowState(herd, c, t, {}, hourAt); return { i, d: Math.hypot(s.x - r[0], s.z - r[1]), s }; }).filter((q) => q.d < 130 && q.s.lie < 0.5).sort((a, b) => a.d - b.d).slice(0, 3);
      if (!cand.length) { ui.toast('The deer are all lying down in the far corner. Try later.'); return false; }
      // the side of the railing the deer are on: towards the Grove's interior
      const gx = (gbb[0] + gbb[1]) / 2, gz = (gbb[2] + gbb[3]) / 2; let nx = gx - r[0], nz = gz - r[1]; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const far = Math.max(...cand.map((q) => q.d)), arrive = Math.max(2, (far - 1) / (far > 30 ? 3.2 : 1.4));
      S.feed = { t0: t, boltAt: arrive + 4 + hh(day(), cand[0].i) * 2.5, px: P.pos.x, pz: P.pos.z, ids: cand.map((q) => q.i), from: cand.map((q) => [q.s.x, q.s.z]),
        spots: cand.map((q, k) => [r[0] + nx * 1.1 + (k - 1) * -nz * 1.0, r[1] + nz * 1.1 + (k - 1) * nx * 1.0]),
        bolt: cand.map((q, k) => [r[0] + nx * (24 + k * 4) + (k - 1) * -nz * 6, r[1] + nz * (24 + k * 4) + (k - 1) * nx * 6]) };
      ui.toast('You hold out a handful of grass. Heads come up...', 3);
      return true;
    }
    if (railLines.length) game.interact.add({ pos: () => { const r = nearestOnRail(P.pos.x, P.pos.z); return r ? new THREE.Vector3(r[0], 0, r[1]) : new THREE.Vector3(1e6, 0, 1e6); }, radius: 2.6, label: 'Hold out a handful of grass to the deer', enabled: () => !S.feed && P.place === 'world' && !!herd && distGrove(P.pos.x, P.pos.z) < 30, onUse: () => feed() });

    // ================================================================ Addison's Walk: the loop, and fritillaries in the meadow
    const walk = map.roads.find((r) => r.id === IDS.addison);
    const checkpoints = []; if (walk) { let acc = 0; for (let i = 1; i < walk.pts.length; i++) { const a = walk.pts[i - 1], b = walk.pts[i]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc > 140) { checkpoints.push(b); acc = 0; } } }
    let flowers = null; const FL = { medium: 900, high: 1600, ultra: 1600 }, level = () => (game.quality && game.quality.level) || 'medium';
    if (walk && FL[level()]) {
      try {
        const g = new THREE.ConeGeometry(0.035, 0.07, 5); g.rotateX(Math.PI); g.translate(0, 0.2, 0);
        const stem = new THREE.CylinderGeometry(0.004, 0.004, 0.2, 3); stem.translate(0, 0.1, 0);
        const merged = new THREE.BufferGeometry(); { const a = g.toNonIndexed(), b = stem.toNonIndexed(); const pos = new Float32Array(a.attributes.position.count * 3 + b.attributes.position.count * 3); pos.set(a.attributes.position.array, 0); pos.set(b.attributes.position.array, a.attributes.position.array.length); merged.setAttribute('position', new THREE.BufferAttribute(pos, 3)); merged.computeVertexNormals(); }
        flowers = new THREE.InstancedMesh(merged, new THREE.MeshLambertMaterial({ color: 0xffffff }), FL[level()]);
        flowers.name = 'magd:fritillaries'; flowers.castShadow = false; flowers.frustumCulled = false; flowers.visible = false; flowers.count = 0;
        scene.add(flowers);
      } catch (e) { console.warn('[magdalen] fritillaries', e); flowers = null; }
    }
    const loop = walk ? walk.pts : null;
    const M = new THREE.Matrix4(), cPurple = new THREE.Color(0x7a3a78), cWhite = new THREE.Color(0xf2eef0); let flLast = [1e9, 1e9];
    function refillFlowers(cx, cz) {
      // a 2 m grid of candidate spots round the camera, inside the meadow (the walk's loop), 3+ m off the path
      let n = 0; const R = 26, max = flowers.count = 0;
      void max;
      for (let gx = Math.floor((cx - R) / 2); gx <= Math.floor((cx + R) / 2) && n < flowers.instanceMatrix.count; gx++) for (let gz = Math.floor((cz - R) / 2); gz <= Math.floor((cz + R) / 2) && n < flowers.instanceMatrix.count; gz++) {
        for (let k = 0; k < 2 && n < flowers.instanceMatrix.count; k++) {
          const x = gx * 2 + hh(gx, gz, k) * 2, z = gz * 2 + hh(gz, gx, k + 7) * 2;
          if (Math.hypot(x - cx, z - cz) > R || hh(gx, gz, 99 + k) > 0.55) continue;
          if (!pointInPoly(x, z, loop) || distToPoly(x, z, loop) < 3 || (col.isWet && col.isWet(x, z))) continue;
          M.makeRotationY(hh(gx, gz, k + 3) * 6.28); M.setPosition(x, 0.01, z); flowers.setMatrixAt(n, M); flowers.setColorAt(n, hh(gx, gz, k + 5) < 0.75 ? cPurple : cWhite); n++;
        }
      }
      flowers.count = n; flowers.instanceMatrix.needsUpdate = true; if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    }

    // ================================================================ per-frame
    let near = false, nearT = 0;
    // the cloister's walk, arcade and figures and the pulpit from near only; the upper storey (world style) always
    const LOD = [cl && cl.lod].filter(Boolean).map((l) => shadowProxy(W, l));   // the far mesh casts the shadow
    const CULL = [{ meshes: meshes.filter((m) => m.name.startsWith('magd:pulpit')), c: [PULPIT.x, PULPIT.z], r: 200, on: true }];
    function tick(dt) {
      const pl = P, outdoors = pl.place === 'world', cam = game.camera.position;
      distCull(CULL, cam, outdoors);
      lodSwap(LOD, cam, outdoors, null, lodScale(game));
      nearT -= dt;
      if (nearT <= 0) {
        nearT = 0.5;
        near = outdoors && Math.hypot(pl.pos.x - 900, pl.pos.z - 300) < 200;
        // Addison's Walk checkpoints
        if (outdoors && checkpoints.length) {
          if (S.walk.day !== day()) { S.walk.day = day(); S.walk.seen.clear(); }
          checkpoints.forEach((p, i) => { if (Math.hypot(pl.pos.x - p[0], pl.pos.z - p[1]) < 8) S.walk.seen.add(i); });
          if (S.walk.seen.size === checkpoints.length && S.walk.done !== day()) { S.walk.done = day(); game.pay(2); ui.toast('You walked the whole of Addison\'s Walk — just under a mile. Lewis and Tolkien talked here late into a September night in 1931. (+£2)', 5); }
        }
      }
      if (near) lodgeTick();
      if (deer) {
        const d = outdoors ? distGrove(cam.x, cam.z) : Infinity, want = d < (S.deerOn ? 215 : 200);
        if (want !== S.deerOn) { S.deerOn = want; deer.mesh.visible = want; if (want) updateDeer(); }
        if (S.deerOn) { S.t -= dt; if (S.t <= 0 || d < 90 || S.feed) { S.t = 0.25; updateDeer(); } }
        if (S.feed && (now() - S.feed.t0) / 1000 > S.feed.boltAt + 12) S.feed = null;
        if (S.feed && Math.hypot(P.pos.x - S.feed.px, P.pos.z - S.feed.pz) > 2.5 && (now() - S.feed.t0) / 1000 < S.feed.boltAt) { S.feed.boltAt = (now() - S.feed.t0) / 1000; ui.toast('You moved — the deer bolt!', 2.5); }
      }
      if (flowers) {
        const inRange = outdoors && loop && distToPoly(cam.x, cam.z, loop) < 40 && pointInPoly(cam.x, cam.z, loop) || (outdoors && loop && distToPoly(cam.x, cam.z, loop) < 20);
        if (inRange !== flowers.visible) flowers.visible = inRange;
        if (inRange && Math.hypot(cam.x - flLast[0], cam.z - flLast[1]) > 5) { flLast = [cam.x, cam.z]; refillFlowers(cam.x, cam.z); }
      }
    }
    game.magdalen = {
      sights, state: S, herd, cloister: cl, checkpoints,
      deer: (tMs = now()) => (herd ? herd.cows.map((c, i) => ({ ...deerAt(i, tMs, {}) })) : []),
      viewDeer(d = 14) { const ds = this.deer(); if (!ds.length) return null; let x = 0, z = 0; for (const q of ds) { x += q.x / ds.length; z += q.z / ds.length; } return { x: x - 0.6 * d, z: z - 0.8 * d, h: Math.atan2(0.6, 0.8) }; },
      feed: () => feed(),
      setForce(f) { S.force = f; return f; },
      stats() { let draws = 0, tris = 0; const count = (m) => { if (!m || !m.visible) return; m.traverse((o) => { if (o.isMesh && o.visible) { draws++; const g = o.geometry; tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1); } }); }; for (const m of meshes) count(m); if (deer) count(deer.mesh); if (flowers) count(flowers); return { draws, tris: Math.round(tris), deerOn: S.deerOn, deer: herd ? herd.cows.length : 0, deerTris: deer ? deer.tris : 0, figures: cl ? cl.figures.length : 0, flowers: flowers && flowers.visible ? flowers.count : 0, near }; },
      update: (dt) => tick(dt),
    };
    tick(0);
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[magdalen]', e); } } } };
  },
};

// ---------------------------------------------------------------- checks for tools/smoke_southeast.mjs
export async function pureChecks(ok, { map, at }) {
  const R = cloisterRing(map); ok(!!R && R.garth.length === 4, 'the cloister ring and its garth from the map');
  const grove = map.areas.find((a) => a.id === IDS.grove), woods = IDS.groveWoods.map((id) => map.areas.find((a) => a.id === id).poly);
  const mk = () => makeHerd([{ poly: grove.poly, holes: woods.concat([GROVE_NORTH]), n: DEER }]);
  const A = mk(), Bh = mk(); let same = true, inside = true, jump = 0; const prev = [];
  for (let t = at(6); t < at(6) + 2 * 3600e3; t += 500) A.cows.forEach((c, i) => {
    const a = cowState(A, c, t, {}), b = cowState(Bh, Bh.cows[i], t, {});
    if (a.x !== b.x || a.z !== b.z || a.h !== b.h) same = false;
    // (a deer WALKING from one spot to the next goes straight, and clips a notch of the Grove's boundary by a metre or two
    //  now and then — in about a third of all two-hour windows, whatever the clock; it never stands or lies outside)
    if ((!pointInPoly(a.x, a.z, grove.poly) && !(a.moving && distToPoly(a.x, a.z, grove.poly) < 3)) || (!a.moving && woods.some((w) => pointInPoly(a.x, a.z, w)))) inside = false;
    if (prev[i]) jump = Math.max(jump, Math.hypot(a.x - prev[i].x, a.z - prev[i].z) / 0.5); prev[i] = a;
  });
  ok(same && inside && jump < 7, `the deer (a dash now and then; same ${same}, inside ${inside}): the same for everyone, inside the Grove, never resting in the woods, no jumps (${jump.toFixed(2)} m/s), ${DEER} head`);
  ok(isOpen(14) && !isOpen(11) && !isOpen(19), 'Magdalen visitor hours (13:00-18:00)');
  void CLOISTER;
}
export async function installedChecks(ok, { game, place, run, walkable, at, setNow, interacts }) {
  const api = game.magdalen; if (!api) { ok(false, 'game.magdalen'); return; }
  ok(api.sights.length >= 5 && api.sights.every((s) => Number.isFinite(s.x) && s.blurb), 'Magdalen sights');
  ok(game.overrides.skip.has(IDS.cloister) && api.cloister && api.cloister.figures.length === 22, `the cloister rebuilt, ${api.cloister ? api.cloister.figures.length : 0} hieroglyphics`);
  ok(!game.overrides.skip.has('w77881357'), 'Magdalen Tower untouched (May Morning)');
  // the cloister walk: in from St John's Quad by Founder's Tower, round, out to the New Building lawn
  ok(walkable(896, 313, 912.5, 321.5), 'from St John\'s Quad into the cloister walk');
  ok(walkable(938.5, 286.5, 946, 274), 'from the north walk through to the New Building lawn');
  { const g = api.cloister.garth, cx = g.reduce((s, p) => s + p[0], 0) / 4, cz = g.reduce((s, p) => s + p[1], 0) / 4; const a = g[0], b = g[1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; ok(walkable(mx + (mx - cx) * 0.06, mz + (mz - cz) * 0.06, mx + (cx - mx) * 0.2, mz + (cz - mz) * 0.2), 'from the walk onto the garth through the doorway'); }
  // visitors at the lodge
  setNow(at(11, 11)); place(866, 338.6); run(0.6);
  const walkIn = (x0, z0, x1, z1, n = 20) => { for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; game.player.pos.set(x, 0, z); run(0.1); if (Math.hypot(game.player.pos.x - x, game.player.pos.z - z) > 0.5) break; } return [game.player.pos.x, game.player.pos.z]; };
  let p = walkIn(866, 338.6, 876, 327.5); ok(p[1] > 335, 'at 11:00 the porter turns visitors round');
  setNow(at(14, 11)); game.state.money = 20; place(866, 338.6); run(0.3);
  const k = interacts.find((i) => typeof i.label === 'function' && /visit Magdalen/.test(i.label())); ok(!!k, 'the lodge window'); k.onUse(); ok(game.state.money === 15, 'paid £5');
  p = walkIn(866, 338.6, 876, 327.5); ok(p[1] < 329, 'with a ticket: into St John\'s Quad');
  // deer: drawn near, fed, bolt, not drawn far away
  const v = api.viewDeer(20); place(v.x, v.z, v.x + Math.sin(v.h) * 10, v.z + Math.cos(v.h) * 10); run(0.6);
  ok(api.stats().deerOn, `deer drawn near the Grove (${api.stats().deer} deer, ${api.stats().deerTris} triangles each)`);
  const FX = 921.0, FZ = 230.0;      // by the railing (919.5, 230.0) on the New Building lawn side
  place(FX, FZ); run(0.3);
  const fed = api.feed(); ok(fed, 'feeding at the railings');
  const near = () => api.deer().map((q) => Math.hypot(q.x - FX, q.z - FZ)).sort((a, b) => a - b)[0];
  const d0 = near(), F = api.state.feed;
  for (let i = 0; i < 400 && F && (game.time.now() - F.t0) / 1000 < F.boltAt - 0.5; i++) { game.player.pos.set(FX, 0, FZ); run(0.25, 0.25); }
  const d1 = near(); ok(d1 < Math.min(d0, 4.5), `the deer come up to the railing (${d0.toFixed(1)} -> ${d1.toFixed(1)} m)`);
  for (let i = 0; i < 16; i++) { game.player.pos.set(FX, 0, FZ); run(0.25, 0.25); }
  const d2 = near(); ok(d2 > d1 + 5, `then bolt (${d2.toFixed(1)} m)`);
  place(-205, 9); run(1); ok(!api.stats().deerOn, 'from Worcester: no deer drawn');
}
