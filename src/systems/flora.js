// Flora pass (2026-11): small plants everywhere there is soft ground — herbaceous borders, wildflowers, meadow
// buttercups, bluebells under the trees, reeds and waterlilies, weeds in the pits of street trees and at the foot of
// walls. Where each one stands is _flora_plan.js (pure, hashed from the shared map: the same for every player); how it
// is drawn is _flora_draw.js. This file keeps ONE instanced draw ('flora:plants') filled with the plants near the
// camera: the 16 m cells round it are planned a cell a frame as it moves (never more, except just after a teleport or
// a door), and the buffer is refilled, nearest cells first, when the camera has moved 3 m. Plants have no collision.
//   quality   low: a third of the plants, drawn to 0.62 of the range, at most 1500; medium: 0.62 / 0.8 / 3600;
//             high: all / 1 / 7500 (ultra 9000). game.quality.dist scales the range as it does every other distance.
//   switch    ?flora=0 (node GTO_FLORA=0): nothing is planned, nothing is added to the scene.
//   API       game.flora = { on, mesh, count, flowers {n, a: Float32Array [x, yTop, z, kind]}, stats(), planAt(x, z, r) -> plants,
//             cellAt(x, z), habitatAt(x, z), settle(x, z), KINDS }
// Insects (systems/insects.js) work the flowers listed in game.flora.flowers. Test: tools/smoke_flora.mjs.
import * as THREE from 'three';
import { createFloraPlan, CELL, KINDS, RANGE } from './_flora_plan.js';
import { floraGeometry, floraMaterial } from './_flora_draw.js';

export const FLORA = !((typeof location !== 'undefined' && location && /[?&]flora=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_FLORA === '0'));
/** per tier: [share of the plants, range scale, most plants drawn] */
export const FLORA_TIERS = { low: [0.34, 0.62, 1500], medium: [0.62, 0.8, 3600], high: [1, 1, 7500], ultra: [1, 1.1, 9000] };
const CAP = 9000, MOVE = 3, FLOWERS = 640, FLOWER_R = 36;

export default {
  id: 'flora',
  install(game) {
    if (!FLORA) { game.flora = { on: false, count: 0, flowers: { n: 0, a: new Float32Array(4) }, stats: () => ({ on: false }) }; return null; }
    const world = game.world, scene = game.worldScene;
    const geo = floraGeometry(CAP), mat = floraMaterial(world.uniforms && world.uniforms.time);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'flora:plants'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    const aPos = geo.attributes.aPos, aFx = geo.attributes.aFx, P = aPos.array, F = aFx.array;
    const MU = mat.userData.uniforms;

    let plan = null;
    const getPlan = () => {
      if (plan) return plan;
      // every drawn tree (the near sets hold each once; bushes are not ringed)
      const trees = [];
      for (const s of (world.vegetation && world.vegetation.sets) || []) {
        if (s.name === 'trees:far') continue;
        const bush = /bush/.test(s.name) ? 1 : 0;
        for (let i = 0; i < s.n; i++) trees.push([s.xz[i * 2], s.xz[i * 2 + 1], s.mat[i * 16 + 5], bush]);
      }
      trees.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      plan = createFloraPlan({ map: game.map, skip: game.overrides.skip, groundHeight: world.groundHeight, collider: game.worldCollider, buildingGrid: world.buildingGrid, baseGreen: world.baseGreen || null, trees });
      return plan;
    };

    // cell offsets round the camera's cell, nearest first, out to the furthest any tier draws
    const RMAX = Math.ceil((RANGE[2] * 1.1 + CELL) / CELL), spiral = [];
    for (let i = -RMAX; i <= RMAX; i++) for (let j = -RMAX; j <= RMAX; j++) spiral.push([i, j, Math.hypot(i, j)]);
    spiral.sort((a, b) => a[2] - b[2]);
    const SI = Int16Array.from(spiral.flatMap((s) => [s[0], s[1]])), SD = Float32Array.from(spiral.map((s) => s[2] * CELL));

    const flowers = { n: 0, a: new Float32Array(FLOWERS * 4) }, HIST = new Int32Array(32);
    const st = { count: 0, pull: 1, refills: 0, planned: 0, pending: 0, lastRefillMs: 0, worstPlanMs: 0, tier: '', density: 0, rangeK: 0 };
    let lx = 1e9, lz = 1e9, dirty = true, pending = true, lastKey = '', n = 0, shown = true;
    const tierOf = () => { const q = game.quality; return (q && FLORA_TIERS[q.level]) || FLORA_TIERS.medium; };
    const empty = () => { P[0] = P[1] = P[2] = P[3] = 0; F[0] = F[1] = F[2] = F[3] = 0; geo.instanceCount = 1; n = 0; st.count = 0; flowers.n = 0; aPos.needsUpdate = true; aFx.needsUpdate = true; };
    empty();

    function refill(cx, cz) {
      const t0 = performance.now(), pl = getPlan(), T = tierOf(), dens = T[0], rk = T[1] * ((game.quality && game.quality.dist) || 1), cap = Math.min(CAP, T[2]);
      const ci = Math.floor(cx / CELL), cj = Math.floor(cz / CELL), reach = RANGE[2] * rk + CELL * 1.5;
      const r0 = (RANGE[0] * rk + MOVE) ** 2, r1 = (RANGE[1] * rk + MOVE) ** 2, r2 = (RANGE[2] * rk + MOVE) ** 2;
      // pass 1: how many plants at each share of their range. Where a garden holds more than the tier draws, every range
      // is pulled in by the same factor (so the furthest still shrink to nothing: no hard edge at the cap, no popping)
      HIST.fill(0);
      for (let s = 0; s < SD.length && SD[s] <= reach; s++) {
        const i = ci + SI[s * 2], j = cj + SI[s * 2 + 1];
        if (!pl.has(i, j)) continue;
        const c = pl.cell(i, j), d = c.d, rank = c.rank;
        for (let q = 0; q < c.n; q++) {
          if (rank[q] >= dens) continue;
          const o = q * 8, dx = d[o] - cx, dz = d[o + 2] - cz, d2 = dx * dx + dz * dz, rc = d[o + 7], lim = rc === 0 ? r0 : rc === 1 ? r1 : r2;
          if (d2 <= lim) HIST[Math.min(31, (Math.sqrt(d2 / lim) * 32) | 0)]++;
        }
      }
      let pull = 1; { let acc = 0; for (let b = 0; b < 32; b++) { acc += HIST[b]; if (acc > cap * 0.97) { pull = Math.max(0.2, b / 32); break; } } }
      st.pull = pull;
      let k = 0, fn = 0; const FA = flowers.a, fr2 = FLOWER_R * FLOWER_R, p2 = pull * pull;
      for (let s = 0; s < SD.length && SD[s] <= reach && k < cap; s++) {
        const i = ci + SI[s * 2], j = cj + SI[s * 2 + 1];
        if (!pl.has(i, j)) continue;
        const c = pl.cell(i, j), d = c.d, rank = c.rank;
        for (let q = 0; q < c.n && k < cap; q++) {
          if (rank[q] >= dens) continue;
          const o = q * 8, dx = d[o] - cx, dz = d[o + 2] - cz, d2 = dx * dx + dz * dz, rc = d[o + 7];
          if (d2 > (rc === 0 ? r0 : rc === 1 ? r1 : r2) * p2) continue;
          const w = k * 4;
          P[w] = d[o]; P[w + 1] = d[o + 1]; P[w + 2] = d[o + 2]; P[w + 3] = d[o + 3];
          F[w] = d[o + 4]; F[w + 1] = d[o + 5]; F[w + 2] = d[o + 6]; F[w + 3] = RANGE[rc] * rk * pull;
          k++;
          if (d2 < fr2 && fn < FLOWERS) { const K = KINDS[c.kind[q]]; if (K.nectar || K.water) { const f = fn * 4; FA[f] = d[o]; FA[f + 1] = d[o + 1] + (K.flat ? 0.03 : d[o + 5] * 0.86); FA[f + 2] = d[o + 2]; FA[f + 3] = c.kind[q]; fn++; } }
        }
      }
      if (k === 0) empty();
      else {
        n = k; geo.instanceCount = k; st.count = k; flowers.n = fn;
        aPos.clearUpdateRanges(); aPos.addUpdateRange(0, k * 4); aPos.needsUpdate = true;
        aFx.clearUpdateRanges(); aFx.addUpdateRange(0, k * 4); aFx.needsUpdate = true;
      }
      lx = cx; lz = cz; dirty = false; st.refills++; st.lastRefillMs = performance.now() - t0; st.density = dens; st.rangeK = rk;
    }
    /** plan the cells still missing round (cx, cz), nearest first, for at most `budget` ms (always at least one) -> cells left */
    function planSome(cx, cz, budget) {
      const pl = getPlan(), T = tierOf(), rk = T[1] * ((game.quality && game.quality.dist) || 1), reach = RANGE[2] * rk + CELL * 1.5;
      const ci = Math.floor(cx / CELL), cj = Math.floor(cz / CELL), t0 = performance.now();
      let left = 0, done = 0;
      for (let s = 0; s < SD.length && SD[s] <= reach; s++) {
        const i = ci + SI[s * 2], j = cj + SI[s * 2 + 1];
        if (pl.has(i, j)) continue;
        if (done && performance.now() - t0 >= budget) { left++; continue; }
        const t1 = performance.now(), c = pl.cell(i, j), ms = performance.now() - t1;
        if (ms > st.worstPlanMs) st.worstPlanMs = ms;
        done++; st.planned++; if (c.n) dirty = true;
        // near the camera a missing cell is a visible hole: keep going (a teleport, a door, the first frame)
        if (SD[s] < 28) budget = Math.max(budget, 7);
      }
      st.pending = left;
      if (pl.cache.size > 5200) pl.trim(cx, cz, 420);
      return left;
    }

    game.flora = {
      on: true, mesh, flowers, KINDS,
      get count() { return n; },
      get plan() { return getPlan(); },
      stats: () => ({ on: true, ...st, cells: plan ? plan.cache.size : 0, planMs: plan ? +plan.stats.ms.toFixed(1) : 0, flowers: flowers.n }),
      /** every planned plant within r m of (x, z), all tiers' worth: [{x, y, z, kind, w, h, rank}] (tests, the placement audit) */
      planAt(x, z, r = 30) {
        const pl = getPlan(), out = [];
        for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
          const c = pl.cell(i, j);
          for (let q = 0; q < c.n; q++) { const o = q * 8; if (Math.hypot(c.d[o] - x, c.d[o + 2] - z) <= r) out.push({ x: c.d[o], y: c.d[o + 1], z: c.d[o + 2], kind: KINDS[c.kind[q]].name, w: c.d[o + 4], h: c.d[o + 5], rank: c.rank[q] }); }
        }
        return out;
      },
      cellAt: (x, z) => getPlan().cell(Math.floor(x / CELL), Math.floor(z / CELL)),
      habitatAt: (x, z) => getPlan().habitatAt(x, z),
      /** plan everything in reach of (x, z) and fill the buffer now (probes, screenshots, a warm-up) */
      settle(x, z) { while (planSome(x, z, 1e9) > 0) { /* */ } refill(x, z); return n; },
    };

    return {
      update() {
        // (the mesh is never hidden: indoors the world scene is not drawn at all, and the loading screen's warm-up must
        // find it drawn like everything else. High in a glider it is simply emptied.)
        if (game.scene !== scene) return;
        const out = !(world.aerial && game.camera.position.y > 60);
        if (out !== shown) { shown = out; if (!out) empty(); else dirty = true; }
        if (!out) return;
        const c = game.camera.position, q = game.quality, key = q ? q.level + q.dist : '';
        if (key !== lastKey) { lastKey = key; dirty = true; pending = true; st.tier = q ? q.level : ''; }
        const dx = c.x - lx, dz = c.z - lz, moved = dx * dx + dz * dz > MOVE * MOVE;
        if (moved) pending = true;
        if (pending) pending = planSome(c.x, c.z, 0.6) > 0;
        if (dirty || moved) refill(c.x, c.z);
        const w = game.weather;
        MU.uFWind.value = w && w.wind ? Math.min(2.4, 0.45 + (w.wind.speed || 0) * 0.14) : 1;
        const p = game.player;
        if (p && p.pos && !p.vehicle) MU.uFPush.value.set(p.pos.x, p.pos.z, 0, 1); else MU.uFPush.value.w = 0;
      },
    };
  },
};
