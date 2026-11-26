// Leaves coming down (fidelity pass, 2026-11). The game's term runs from early October to early December, so the trees
// are shedding all through it: near any broadleaved tree a leaf lets go every so often, see-saws down on the wind and
// lies where it lands for a few seconds. More in a wind, a flurry in a gust, most in October and November and few by
// December (the weather model's season).
//   rule        every tree the world plants (world/vegetation.js 'trees:far' holds them all), not conifers or shrubs,
//               5 m or taller, within 32 m of the player. One chance per tree per 1.5 s slot of the SHARED clock,
//               p = 0.06 × (1 + 0.55 × surface wind m/s) × (1.25 − season), one leaf or a flurry of up to four in a
//               strong wind; each leaf's whole flight (where in the crown
//               it starts, sway, spin, the wind that carries it) is a function of (tree, slot), so every player near
//               sees the same leaf fall the same way. A leaf that would come down inside a building or on water is
//               not shed at all
//   drawn       ONE instanced draw of a two-triangle leaf (double-sided Lambert, colour per leaf), ≤ 72 leaves, in the
//               scene only while one is in the air or on the ground
//   off         ?leaves=0 (node: GTO_LEAVES=0)
//   cost        one pass over the ≤ ~60 trees near every 1.5 s; per frame ≤ 72 matrices (~8 µs); nothing indoors
// game.leaves = { trees, count, live (the leaves in the air or lying), leafOf(...), leafAt(leaf, ms, groundY, out), shedAt(x, z, slot), stats() }          test: tools/smoke_fidelity.mjs
import * as THREE from 'three';
import { fidOn, h01 } from './_fid.js';

const MAX = 72, RANGE = 32, CELL = 24, SLOT_MS = 1500, REST = 9;
const COLS = [0xc9a227, 0xd9b53a, 0xb5651d, 0x8a5a2b, 0xa8501c, 0xc77b1e, 0x9a7b2f, 0x7a4a22];

/** pure: the chance a tree sheds in one slot */
export const shedChance = (windMs, season) => 0.06 * (1 + 0.55 * Math.max(0, windMs || 0)) * Math.max(0.15, 1.25 - (season || 0));
/** pure: how many leaves come down together when tree i sheds in slot k (a flurry of up to four in a strong wind) */
export const flurry = (i, k, windMs) => 1 + Math.floor(h01(i, k, 13) * (1 + 3 * Math.min(1, (windMs || 0) / 9)) * 0.999);
/** pure: leaf j of the ones tree i (at x, z, height h) sheds in slot k, or null. wind = [vx, vz] m/s near the ground. */
export function leafOf(i, x, z, h, k, wind, season, j = 0) {
  const ws = Math.hypot(wind[0], wind[1]);
  if (h01(i, k, 1) >= shedChance(ws, season) || j >= flurry(i, k, ws)) return null;
  // carried by the air among the houses: a fraction of the open wind, never more than 0.7 m/s (it comes down within a
  // few metres of its tree, in sight of whoever is walking under it)
  const dk = Math.min(0.1, 0.7 / Math.max(0.01, ws));
  const q = j * 20, a = h01(i, k, 2 + q) * Math.PI * 2, r = Math.min(4.5, h * 0.28) * Math.sqrt(h01(i, k, 3 + q));
  return {
    // (from the lower crown: a leaf let go 20 m up is hidden by the canopy for most of its fall)
    t0: (k + h01(i, k, 4 + q)) * SLOT_MS, x0: x + Math.cos(a) * r, z0: z + Math.sin(a) * r, y0: Math.min(h * 0.6, 10) * (0.55 + 0.45 * h01(i, k, 5 + q)),
    fall: 0.75 + 0.45 * h01(i, k, 6 + q), amp: 0.22 + 0.3 * h01(i, k, 7 + q), w: 6 + 5 * h01(i, k, 8 + q), ph: 6.28 * h01(i, k, 9 + q),
    vx: wind[0] * dk, vz: wind[1] * dk, col: COLS[(h01(i, k, 10 + q) * COLS.length) | 0], sc: 0.8 + 0.6 * h01(i, k, 11 + q),
  };
}
/** pure: where leaf L is at shared time ms over ground at height gy -> out {x, y, z, down (s on the ground, < 0 in the air)} */
export function leafAt(L, ms, gy, out) {
  const t = Math.max(0, (ms - L.t0) / 1000), T = Math.max(0.1, (L.y0 - gy - 0.02) / L.fall), u = Math.min(t, T), s = Math.sin(u * L.w * 0.5 + L.ph);
  out.x = L.x0 + L.vx * u + Math.cos(L.ph) * L.amp * s; out.z = L.z0 + L.vz * u + Math.sin(L.ph) * L.amp * s;
  out.y = Math.max(gy + 0.02, L.y0 - L.fall * u - 0.06 * (1 - s * s)); out.down = t - T; out.u = u;
  return out;
}

export default {
  id: 'leaves',
  install(game) {
    if (!fidOn('leaves')) { game.leaves = { off: true, trees: 0, count: 0, stats: () => ({ off: true, trees: 0, count: 0 }) }; return null; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.11, 0.07, 0, -0.015, 0, 0, 0.11, -0.07, 0, -0.015], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(g, mat, MAX);
    mesh.name = 'fidelity:leaves'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), o = { x: 0, y: 0, z: 0, down: 0, u: 0 };
    mesh.setMatrixAt(0, M.identity()); mesh.setColorAt(0, C.set(COLS[0]));
    (game.warmups || (game.warmups = [])).push({ id: 'leaves', fn: () => { const PW = game.prewarm; if (PW && PW.extras) PW.extras.push({ o: mesh, pre: (x, y, z) => { const n = mesh.count; M.makeTranslation(x, y - 3, z); mesh.setMatrixAt(0, M); mesh.instanceMatrix.needsUpdate = true; mesh.count = Math.max(1, n); return () => { mesh.count = n; }; } }); return null; } });
    let trees = null, grid = null, slot = -1, inScene = false, shed = 0, refused = 0;
    const live = [], wv = [0, 0];
    const build = () => {
      const veg = game.world && game.world.vegetation, sets = veg && veg.sets; if (!sets) return false;
      const far = sets.find((s) => s.name === 'trees:far'); if (!far) return false;
      const no = new Set(); for (const s of sets) if (s.name === 'trees:conifer' || s.name === 'trees:bush' || s.name === 'trees:column') for (let i = 0; i < s.n; i++) no.add(Math.round(s.xz[i * 2] * 4) * 100003 + Math.round(s.xz[i * 2 + 1] * 4));
      trees = []; grid = new Map();
      for (let i = 0; i < far.n; i++) {
        const x = far.xz[i * 2], z = far.xz[i * 2 + 1], h = far.mat[i * 16 + 5];
        if (!(Math.abs(x) < 1e7) || !(h >= 5) || no.has(Math.round(x * 4) * 100003 + Math.round(z * 4))) continue;
        const t = { i, x, z, h }; trees.push(t);
        const k = Math.floor(x / CELL) * 65536 + Math.floor(z / CELL); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(t);
      }
      return true;
    };
    const lands = (L) => {
      const T = (L.y0 - 0.02) / L.fall, x = L.x0 + L.vx * T, z = L.z0 + L.vz * T, vs = game.vehicles && game.vehicles._sys, col = game.worldCollider;
      if (vs && vs.inBuilding && (vs.inBuilding(x, z) || vs.inBuilding(L.x0, L.z0) || vs.inBuilding((x + L.x0) / 2, (z + L.z0) / 2))) return false;
      if (col && col.isWater && col.isWater(x, z)) return false;
      return true;
    };
    const windNow = () => { const W = game.weather, w = W && W.wind; if (!w) { wv[0] = wv[1] = 0; return wv; } const s = (w.speed || 0) * (1 + 0.6 * (w.gust || 0)); wv[0] = Math.sin(w.dir || 0) * s; wv[1] = -Math.cos(w.dir || 0) * s; return wv; };
    /** the leaves the trees round (x, z) shed in slot k (the same list on every client) */
    const shedAt = (x, z, k, out, wind, season) => {
      const w = wind || windNow(), sea = season !== undefined ? season : game.weather && game.weather.season !== undefined ? game.weather.season : 0.5;
      for (let cx = Math.floor((x - RANGE) / CELL); cx <= Math.floor((x + RANGE) / CELL); cx++) for (let cz = Math.floor((z - RANGE) / CELL); cz <= Math.floor((z + RANGE) / CELL); cz++) {
        const l = grid.get(cx * 65536 + cz); if (!l) continue;
        for (const t of l) {
          if ((t.x - x) ** 2 + (t.z - z) ** 2 > RANGE * RANGE) continue;
          for (let j = 0; j < 4; j++) {
            const L = leafOf(t.i, t.x, t.z, t.h, k, w, sea, j); if (!L) break;
            if (!lands(L)) { refused++; continue; }
            L.gy = game.world.groundHeight(L.x0 + L.vx * ((L.y0 - 0.02) / L.fall), L.z0 + L.vz * ((L.y0 - 0.02) / L.fall));
            out.push(L);
          }
        }
      }
      return out;
    };
    game.leaves = { get trees() { return trees ? trees.length : 0; }, get count() { return live.length; }, get mesh() { return mesh; }, live, leafOf, leafAt, shedChance, flurry, max: MAX, shedAt: (x, z, k, wind, season) => (trees || build() ? shedAt(x, z, k, [], wind, season) : []),
      stats: () => ({ trees: trees ? trees.length : 0, live: live.length, shed, refused, inScene, draws: inScene ? 1 : 0 }) };
    return {
      id: 'leaves',
      update() {
        const pl = game.player;
        if (pl.place !== 'world') { if (inScene) { game.worldScene.remove(mesh); inScene = false; live.length = 0; mesh.count = 0; } return; }
        if (!trees && !build()) return;
        const now = game.time.now(), k = Math.floor(now / SLOT_MS);
        if (k !== slot) {
          slot = k;
          const n0 = live.length; shedAt(pl.pos.x, pl.pos.z, k, live);
          if (live.length > MAX) live.length = MAX;
          shed += live.length - n0;
        }
        if (!live.length) { if (inScene) { game.worldScene.remove(mesh); inScene = false; mesh.count = 0; } return; }
        let n = 0;
        for (let i = 0; i < live.length; i++) {
          const L = live[i];
          if (now < L.t0) { live[n++] = L; continue; }
          leafAt(L, now, L.gy, o);
          if (o.down > REST) continue;
          live[n++] = L;
          const j = n - 1, fl = o.down < 0 ? 1 : 0, sh = o.down > REST - 1 ? Math.max(0, REST - o.down) : 1;
          E.set(fl * Math.sin(o.u * L.w + L.ph) * 1.1, L.ph + o.u * 1.7 * fl, fl * Math.cos(o.u * L.w * 0.7 + L.ph) * 0.9); Q.setFromEuler(E);
          V.set(o.x, o.y, o.z); S.setScalar(L.sc * sh); M.compose(V, Q, S);
          mesh.setMatrixAt(j, M); mesh.setColorAt(j, C.set(L.col));
        }
        live.length = n;
        // (leaves not yet let go hold a slot in `live` but must not be drawn where the last one was)
        for (let i = 0; i < n; i++) if (now < live[i].t0) { mesh.setMatrixAt(i, M.makeScale(0, 0, 0)); }
        mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        if (n && !inScene) { game.worldScene.add(mesh); inScene = true; }
      },
    };
  },
};
