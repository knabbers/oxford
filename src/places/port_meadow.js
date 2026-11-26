// Port Meadow, c. 2013 — see docs/research/north_west_and_broad.md (sources; what is known and what is guessed).
//
//   preMap   one map box west of the original map (_pm_site.js: a compressed meadow in the strip of base ground that
//            was already drawn beyond the map's west edge). Nothing else of the map changes, so nothing is added to the
//            world's always-drawn tiles: the river, paths, fences, bridge and trees are this module's own meshes.
//   install  the Thames along the west side (swimmable: its water goes into the collider, so systems/swim.js offers
//            "Dive in" at the bank and "Jump off the bridge" on the footbridge); the Walton Well Road car park, field
//            gate, kissing gate and notice board; the white pebble path to a Medley-style iron footbridge; the Thames
//            Path; willows; free-roaming horses and cattle (_ccm_herd.js on the shared clock, _pm_beasts.js one
//            instanced draw per kind); two flocks of geese and ducks on the river; shallow winter flooding on about
//            one game day in four (_pm_site.js floodLevel, shared clock); the Sheriff's stock check (count the
//            animals for a reward); geese that hiss at you.
// Drawn / updated only while the camera is near (river out to 900 m, 3 km from the air).
//
// Test hooks: game.portMeadow = { sights, stats(), herd, animals(tMs), flood(tMs), census, view(kind) }   tools/smoke_portmeadow.mjs
import { NORTH } from './_north_kit.js';
import * as THREE from 'three';
import { dressMap, MEADOW, BOX, GATE, BOARD, BRIDGE, RIVER, SIGHTS, floodLevel, gooseAt, duckAt, GEESE, DUCKS, SURF_Y, pointInPoly, inFlood } from './_pm_site.js';
import { build as buildDress } from './_pm_dress.js';
import { buildGround, buildBackdrop } from './_pm_ground.js';
import { makeHerd, cowState, hourOf } from './_ccm_herd.js';
import { horseGeometry, cattleGeometry, createRigMesh, createBirdMesh, HORSE_COATS, CATTLE_COATS } from './_pm_beasts.js';

export const sights = SIGHTS.map((s) => ({ ...s }));
// grazing groups (separate fields of the one common: the herd rules keep each group to its own patch, so a walk between
// two grazing spots is never longer than a slow amble — the real herds drift over the whole meadow, a guess)
export const GROUPS = [
  { kind: 'horse', n: 6, poly: [[-1120, -880], [-960, -880], [-960, -1090], [-1120, -1090]] },
  { kind: 'cow', n: 5, poly: [[-1125, -1110], [-925, -1110], [-925, -1300], [-1125, -1300]] },
  { kind: 'horse', n: 6, poly: [[-1130, -1320], [-925, -1320], [-925, -1520], [-1130, -1520]] },
  { kind: 'cow', n: 5, poly: [[-1130, -1540], [-925, -1540], [-925, -1780], [-1130, -1780]] },
];
export const HERD = { horses: GROUPS.filter((g) => g.kind === 'horse').reduce((s, g) => s + g.n, 0), cattle: GROUPS.filter((g) => g.kind === 'cow').reduce((s, g) => s + g.n, 0) };
const D = { river: 700, riverAir: 3000, dress: 260, trees: 260, beasts: 210, birds: 160, flood: 500, backdrop: 420 };
const BB = [BOX.minX, BOX.maxX, BOX.minZ, BOX.maxZ];
const distBB = (b, x, z) => Math.hypot(Math.max(b[0] - x, 0, x - b[1]), Math.max(b[2] - z, 0, z - b[3]));

/** Castle Mill (Roger Dudman Way, 2012-13): the lettered Blocks D-L along the railway, [id, height m] */
export const CASTLE_MILL = [['w307735596', 13], ['w307735597', 15.5], ['w307735598', 13.5], ['w307735599', 15.5], ['w307735601', 15], ['w307735602', 15], ['w307735603', 13]];

export default {
  id: 'port_meadow',
  preMap(game) {
    try { dressMap(game.map); } catch (e) { console.error('[port_meadow] preMap', e); }
    // photo comparison item 18 ("port_meadow"): the Castle Mill graduate flats on Roger Dudman Way (2012-13), the
    // white and grey blocks on the meadow's eastern skyline that date the view, were drawn as red-brick blocks. White
    // render, flat (shallow metal) roofs, five storeys on the tallest. Heights are a GUESS (4-5 storeys).
    try {
      const ov = game.overrides;
      // (photo comparison north, item 9: the roofs are shallow pitched grey standing-seam metal, not flat, and the render is off-white)
      for (const [id, h] of CASTLE_MILL) { if (!ov.style.has(id)) ov.style.set(id, NORTH ? { wall: 'render', roof: 'lead', shape: 'gabled', tint: [1.06, 1.05, 1.0], up: 'renderSash', ground: 'renderSash', ivy: false } : { wall: 'render', roof: 'flat', tint: [1.1, 1.1, 1.08], ivy: false }); if (!ov.heights.has(id)) ov.heights.set(id, h); }
    } catch (e) { console.error('[port_meadow] castle mill', e); }
  },

  install(game) {
    const W = game.world, scene = game.worldScene, col = game.worldCollider;
    const S = { err: false, on: {}, floodOn: false, census: null, hiss: 0, hissAt: null };
    const root = new THREE.Group(); root.name = 'pm:root';
    let dress = null;
    try {
      dress = buildDress(game);
      for (const m of dress.meshes) root.add(m);
      for (const t of dress.trees) root.add(t);
      const C = dress.colliders;
      if (C.water) col.addWaterLine(C.water[0], C.water[1]);
      for (const p of C.walk) col.addWalkable(p);
      for (const s of C.segs) col.addSegment(...s);
      for (const [x, z, r] of C.circles) col.addCircle(x, z, r);
    } catch (e) { console.error('[port_meadow] dressing', e); }
    // the grass's own detail (tussocks, thistles, buttercups, mud, worn margins), the flood's wet margin, the backdrop
    let ground = null, backdrop = null;
    try {
      ground = buildGround(game);
      for (const m of ground.meshes) { root.add(m); if (dress) dress.meshes.push(m); }
      if (ground.wet) root.add(ground.wet);
      backdrop = buildBackdrop(game); if (backdrop) root.add(backdrop);
    } catch (e) { console.error('[port_meadow] ground', e); }
    root.traverse((m) => { if (m.isMesh && !m.isInstancedMesh) { m.matrixAutoUpdate = false; m.updateMatrix(); } });
    // each static mesh's own ground rectangle, for its distance test
    root.traverse((m) => { if (!m.isMesh) return; const b = new THREE.Box3(); if (m.isInstancedMesh) { m.computeBoundingBox(); b.copy(m.boundingBox); } else { m.geometry.computeBoundingBox(); b.copy(m.geometry.boundingBox); } m.userData.bb = [b.min.x, b.max.x, b.min.z, b.max.z]; });
    scene.add(root);

    // ---- the animals: one herd object, a field per grazing group; slot[i] = the animal's instance in its kind's mesh
    const herd = makeHerd(GROUPS.map((g) => ({ poly: g.poly, n: g.n })));
    const kindOf = (c) => GROUPS[c.field].kind, slot = []; { const k = { horse: 0, cow: 0 }; for (const c of herd.cows) slot.push(k[kindOf(c)]++); }
    let horses = null, cattle = null, geese = null, ducks = null;
    try {
      horses = createRigMesh('pm:horses', horseGeometry(), HERD.horses, 1.35);
      cattle = createRigMesh('pm:cattle', cattleGeometry(), HERD.cattle, 1.05);
      herd.cows.forEach((c, i) => {
        const k = Math.floor(c.seed * 997);
        if (kindOf(c) === 'horse') horses.setCoat(slot[i], HORSE_COATS[k % HORSE_COATS.length], c.seed, false, 0.82 + 0.22 * ((c.seed * 31) % 1));
        else cattle.setCoat(slot[i], CATTLE_COATS[k % CATTLE_COATS.length], c.seed, k % 4 === 1, 0.92 + 0.12 * ((c.seed * 17) % 1));
      });
      scene.add(horses.mesh, cattle.mesh);
      geese = createBirdMesh('pm:geese', 'goose', GEESE.flocks * GEESE.per);
      ducks = createBirdMesh('pm:ducks', 'duck', DUCKS);
      scene.add(geese.mesh, ducks.mesh);
    } catch (e) { console.error('[port_meadow] animals', e); }
    const hourAt = (ms) => (game.time && game.time.pinned != null ? game.time.pinned : hourOf(ms));
    const st = {}, gs = {}, hb = [0, 0, 0, 0], gb = [0, 0, 0, 0];
    const animalPos = [];        // [x, z] of every horse then every cow (for the census)
    function updateBeasts(now) {
      hb[0] = hb[2] = Infinity; hb[1] = hb[3] = -Infinity;
      horses.uniforms.uBeastTime.value = cattle.uniforms.uBeastTime.value = (now % 3600000) / 1000;
      herd.cows.forEach((c, i) => {
        cowState(herd, c, now, st, hourAt);
        const horse = kindOf(c) === 'horse', m = horse ? horses : cattle;
        // horses doze standing up (a horse in the open rarely lies down for long): the herd's lying runs are a rest
        m.set(slot[i], st.x, 0.01, st.z, st.h, st.walk, st.graze, horse ? 0 : st.lie, st.phase);
        animalPos[i] = animalPos[i] || [0, 0]; animalPos[i][0] = st.x; animalPos[i][1] = st.z;
        hb[0] = Math.min(hb[0], st.x); hb[1] = Math.max(hb[1], st.x); hb[2] = Math.min(hb[2], st.z); hb[3] = Math.max(hb[3], st.z);
      });
      horses.commit(); cattle.commit();
    }
    // geese: the flock's spot on the shared clock + a local "hiss" that turns the nearest ones on the player
    function updateBirds(now, px, pz) {
      gb[0] = gb[2] = Infinity; gb[1] = gb[3] = -Infinity;
      let n = 0;
      for (let f = 0; f < GEESE.flocks; f++) for (let i = 0; i < GEESE.per; i++, n++) {
        gooseAt(f, i, now, gs);
        let h = gs.h, x = gs.x, z = gs.z, pitch = gs.graze > 0.5 ? 0.55 : 0;
        const dx = px - x, dz = pz - z, d = Math.hypot(dx, dz);
        if (S.hiss > 0 && d < 9) { const k = Math.min(1, S.hiss) * Math.min(1.6, (9 - d) * 0.35); x += (dx / (d || 1)) * k; z += (dz / (d || 1)) * k; h = Math.atan2(dx, dz); pitch = -0.25; }
        geese.set(n, x, 0.0, z, h, pitch);
        gb[0] = Math.min(gb[0], x); gb[1] = Math.max(gb[1], x); gb[2] = Math.min(gb[2], z); gb[3] = Math.max(gb[3], z);
      }
      geese.commit();
      for (let i = 0; i < DUCKS; i++) { duckAt(i, now, gs); ducks.set(i, gs.x, SURF_Y - 0.12, gs.z, gs.h, 0); }
      ducks.commit();
    }

    // ---- the gate: climb it (the kissing gate beside it is the way through)
    try {
      for (const side of [-1, 1]) {
        game.interact.add({
          pos: [GATE.x, GATE.z + side * 0.9], radius: 1.2, label: 'Climb the gate',
          onUse: () => { const p = game.player; if (p.vehicle) return; p.teleport(GATE.x, GATE.z - side * 1.1, side > 0 ? Math.PI : 0); },
        });
      }
    } catch (e) { console.warn('[port_meadow] gate', e); }

    // ---- the Sheriff's stock check: count every horse and cow (walk within 7 m of each) for a reward
    const census = {
      active: false, seen: new Set(), reward: 15,
      start() { this.active = true; this.seen.clear(); game.ui.toast('The commoners\' stock check: walk up to every horse and every cow on the meadow so they can be counted. Back to the board when done.', 7); this.show(); },
      show() { const h = [...this.seen].filter((i) => kindOf(herd.cows[i]) === 'horse').length, c = this.seen.size - h; game.ui.objective(`Stock check: horses ${h}/${HERD.horses} · cattle ${c}/${HERD.cattle}`); },
      done() { return this.seen.size >= HERD.horses + HERD.cattle; },
      finish() {
        if (!this.done()) { game.ui.toast(`Not yet: ${HERD.horses + HERD.cattle - this.seen.size} still to count. (Press E again here to give up.)`, 4); this.giveUpArmed = true; return; }
        this.active = false; game.ui.objective(null); game.pay(this.reward);
        game.ui.toast(`All ${HERD.horses} horses and ${HERD.cattle} cattle present and correct. The commoners' clerk gives you £${this.reward}.`, 6);
      },
    };
    try {
      game.interact.add({
        pos: [BOARD[0], BOARD[1] - 1.2], radius: 2.0,
        label: () => (census.active ? (census.done() ? 'Report the count (£' + census.reward + ')' : 'Report the stock check') : 'Read the notice board / help with the stock check'),
        onUse: () => {
          if (!census.active) { census.start(); return; }
          if (!census.done() && census.giveUpArmed) { census.active = false; census.giveUpArmed = false; game.ui.objective(null); game.ui.toast('You give up counting. The horses do not mind.', 3); return; }
          census.finish();
        },
      });
    } catch (e) { console.warn('[port_meadow] board', e); }

    // ---- per frame
    let bt = 0, birdT = 0, wasIn = false;
    const setOn = (m, on) => { if (m && m.visible !== on) m.visible = on; };
    function tick(dt) {
      const pl = game.player, out = pl.place === 'world', cam = game.camera.position, now = game.time.now();
      const air = !!(W && W.aerial);
      const d = out ? distBB(BB, cam.x, cam.z) : Infinity;
      if (dress) {
        const dm = (m) => (out ? distBB(m.userData.bb, cam.x, cam.z) : Infinity);
        setOn(dress.river, dm(dress.river) < (air ? D.riverAir : D.river));
        for (const m of dress.meshes) if (m !== dress.river && m !== dress.flood) setOn(m, dm(m) < D.dress);
        if (backdrop) setOn(backdrop, dm(backdrop) < D.backdrop);
        for (const t of dress.trees) setOn(t, dm(t) < D.trees);
        const lv = S.forceFlood != null ? S.forceFlood : floodLevel(now); S.flood = lv;
        setOn(dress.flood, lv > 0.15 && d < (air ? D.riverAir : D.flood));
        if (ground && ground.wet) setOn(ground.wet, dress.flood.visible && d < D.dress);
      }
      if (horses) {
        if (d < D.beasts + 300) {
          const dh = distBB(hb, cam.x, cam.z);
          bt -= dt; if (bt <= 0 || (S.on.beasts && dh < 90)) { bt = 0.25; updateBeasts(now); }
          const want = distBB(hb, cam.x, cam.z) < D.beasts;
          if (want !== S.on.beasts) { S.on.beasts = want; horses.mesh.visible = cattle.mesh.visible = want; if (want) updateBeasts(now); }
        } else if (S.on.beasts) { S.on.beasts = false; horses.mesh.visible = cattle.mesh.visible = false; }
      }
      if (geese) {
        const want = d < D.birds + 60 && (distBB(gb, cam.x, cam.z) < D.birds || !S.on.birds);
        if (want) { birdT -= dt; if (birdT <= 0 || S.hiss > 0 || d < 40) { birdT = 0.2; updateBirds(now, pl.pos.x, pl.pos.z); } }
        const vis = want && distBB(gb, cam.x, cam.z) < D.birds;
        if (vis !== !!S.on.birds) { S.on.birds = vis; geese.mesh.visible = vis; }
        setOn(ducks.mesh, d < D.birds && out);
      }
      // geese hiss at a player who walks into the flock (local; a honk and a toast, the nearest ones come at you)
      if (out && geese && S.on.birds) {
        S.hiss = Math.max(0, S.hiss - dt);
        if (S.hiss <= 0 && distBB(gb, pl.pos.x, pl.pos.z) < 1 && (S.hissCool = (S.hissCool || 0) - dt) <= 0) {
          S.hiss = 3.5; S.hissCool = 20;
          try { game.ui.toast('A goose lowers its neck and hisses at you. Then another one does.', 3.5); } catch { /* */ }
          try { const a = game.audio; if (a && a.ctx) { a.noise(0.5, { gain: 0.08, freq: 3200, q: 0.8 }); a.tone(520, 0.22, { type: 'sawtooth', gain: 0.05, when: 0.5 }); a.tone(470, 0.25, { type: 'sawtooth', gain: 0.05, when: 0.8 }); } } catch { /* */ }
        }
      }
      if (census.active && S.on.beasts) {
        let changed = false;
        for (let i = 0; i < animalPos.length; i++) { if (census.seen.has(i)) continue; const p = animalPos[i]; if (p && Math.hypot(p[0] - pl.pos.x, p[1] - pl.pos.z) < 7) { census.seen.add(i); changed = true; } }
        if (changed) { census.show(); if (census.done()) game.ui.toast('That\'s the lot. Report to the notice board by the gate.', 4); }
      }
      // wading: a toast the first time you walk into the floods
      const inF = out && S.flood > 0.15 && inFlood(pl.pos.x, pl.pos.z) && !pl.vehicle;
      if (inF && !wasIn) { try { game.ui.toast('The meadow is flooded. Your shoes fill with Thames.', 3); } catch { /* */ } }
      wasIn = inF;
    }

    game.portMeadow = {
      sights, herd, census, dress, ground: () => ground, backdrop: () => backdrop,
      animals: (tMs = game.time.now()) => herd.cows.map((c) => ({ ...cowState(herd, c, tMs, {}, hourAt), kind: kindOf(c) })),
      flood: (tMs = game.time.now()) => floodLevel(tMs),
      /** screenshots / tests: hold the flood at a level (null = follow the shared clock) */
      forceFlood(v) { S.forceFlood = v; },
      inMeadow: (x, z) => pointInPoly(x, z, MEADOW),
      /** viewpoint d m from the horses (kind 0) / cattle (1), looking at them from heading `from` (screenshots) */
      view(kind = 0, d = 14, from = 0.6) {
        const cs = this.animals().filter((a) => a.kind === (kind ? 'cow' : 'horse')); if (!cs.length) return null;
        let best = cs[0], bn = -1; for (const c of cs) { const n = cs.filter((o) => Math.hypot(o.x - c.x, o.z - c.z) < 20).length; if (n > bn) { bn = n; best = c; } }
        return { x: best.x - Math.sin(from) * d, z: best.z - Math.cos(from) * d, h: from };
      },
      stats() {
        let draws = 0, tris = 0;
        const names = []; const count = (m) => { if (!m || !m.visible) return; draws++; names.push(m.name); const g = m.geometry; tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (m.isInstancedMesh ? m.count : 1); };
        root.traverse((m) => { if (m.isMesh && m !== root) count(m); });
        for (const m of [horses, cattle, geese, ducks]) if (m) count(m.mesh);
        return { draws, names, tris: Math.round(tris), beasts: !!S.on.beasts, birds: !!S.on.birds, flood: S.flood || 0, floodOn: !!(dress && dress.flood.visible), trees: dress ? dress.treeList.length : 0, horseTris: horses ? horses.tris : 0, cowTris: cattle ? cattle.tris : 0 };
      },
      update: (dt) => tick(dt),
    };
    tick(0);
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[port_meadow]', e); } } } };
  },
};
