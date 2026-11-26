// Wet feet (fidelity pass, 2026-11): the ground's water is something you tread in.
//   puddles     the ground shader draws standing water in the hollows of a noise field (world/materials.js, filled by
//               game.weather.puddle for hours after rain). _fid.js puddleAt() is the same field in JS, so a foot that
//               comes down IN A DRAWN PUDDLE throws a small splash (and makes the sound), and a bicycle or car wheel
//               going through one at speed throws spray out to both sides — yours, the other players', the traffic's
//   footprints  soles wet from a puddle leave a dozen darkening prints that fade as they dry; climbing out of the river
//               leaves a longer dripping trail; in lying snow, and on frosted grass, every step leaves a print. On
//               ground that is itself wet with rain a wet print does not show
//   whose       the local player and every other player near (their steps are derived from the positions the player
//               state already carries): nothing sent, and the puddles are where every client draws them
//   drawn       prints: ONE instanced draw (two small rounded fans a print, multiply blend, ≤ 160), in the scene only while
//               a print exists. Splashes and spray: the pass's shared puff draw (_fid.js)
//   off         ?wetfeet=0 (node: GTO_WETFEET=0)
//   cost        dry, no snow or frost, nobody just out of the water: two comparisons a frame. Otherwise one noise lookup
//               per footfall and per wheel sample (≤ 12 a frame near traffic), prints recoloured at 4 Hz
// game.wetfeet = { prints, splashes, puddleAt, debugStep(x, z, h), stats() }       test: tools/smoke_fidelity.mjs
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fidOn, fidPuffs, puddleAt } from './_fid.js';

const MAXP = 160, STEP = 0.74, RANGE = 60, CAR_RANGE = 32, DARK = 0.52;
const K_SPLASH = [0.84, 0.88, 0.93, 0.62, 0.09, 0.26, 0.55, 0, 0.6, 9], K_SPRAY = [0.8, 0.85, 0.9, 0.42, 0.14, 0.55, 0.65, 0, 0.9, 6];

function printGeometry() {
  // a sole and a heel: two flat fans (rounded, the sole wider at the ball), 20 triangles a print
  const fan = (cx, cz, rx, rz, n, taper) => {
    const p = [], idx = []; p.push(cx, 0, cz);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); p.push(cx + c * rx * (1 + taper * s), 0, cz + s * rz); }
    for (let i = 0; i < n; i++) idx.push(0, 1 + ((i + 1) % n), 1 + i);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  return mergeGeometries([fan(0, 0.055, 0.045, 0.085, 12, 0.18), fan(0, -0.095, 0.034, 0.04, 8, 0)], false);
}

export default {
  id: 'wetfeet',
  install(game) {
    if (!fidOn('wetfeet')) { game.wetfeet = { off: true, prints: 0, splashes: 0, puddleAt, stats: () => ({ off: true, prints: 0, splashes: 0 }) }; return null; }
    const P = fidPuffs(game);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.MultiplyBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(printGeometry(), mat, MAXP);
    mesh.name = 'fidelity:footprints'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.count = MAXP; mesh.renderOrder = 2;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), C = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAXP; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, C.setRGB(1, 1, 1)); }
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const born = new Float64Array(MAXP), life = new Float32Array(MAXP), str = new Float32Array(MAXP);
    let next = 0, alive = 0, inScene = false, colT = 0, splashes = 0, sprays = 0, made = 0, carT = 0;
    // loading screen: the print draw warmed out of sight (it is not in the scene until the first print)
    (game.warmups || (game.warmups = [])).push({ id: 'wetfeet', fn: () => { const PW = game.prewarm; if (PW && PW.extras) PW.extras.push({ o: mesh, pre: (x, y, z) => { M.makeTranslation(x, y - 3, z); mesh.setMatrixAt(0, M); mesh.instanceMatrix.needsUpdate = true; return () => { mesh.setMatrixAt(0, ZERO); mesh.instanceMatrix.needsUpdate = true; }; } }); return null; } });

    const hard = (x, z) => { try { return !game.vehicles || !game.vehicles.gripAt || game.vehicles.gripAt(x, z) > 0.7; } catch { return true; } };
    function addPrint(x, z, h, s, secs) {
      if (!(s > 0.04)) return;
      const i = next; next = (next + 1) % MAXP;
      born[i] = game.time.now(); life[i] = secs; str[i] = Math.min(1, s);
      E.set(0, h, 0); Q.setFromEuler(E); V.set(x, game.world.groundHeight(x, z) + 0.016, z); M.compose(V, Q, S1);
      mesh.setMatrixAt(i, M); mesh.setColorAt(i, C.setScalar(1 - DARK * str[i]));
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      made++; alive = Math.max(alive, 1);
      if (!inScene) { game.worldScene.add(mesh); inScene = true; }
    }
    function splash(x, z, amount, local) {
      const y = game.world.groundHeight(x, z) + 0.03;
      for (let i = 0; i < 8; i++) P.emit(K_SPLASH, x, y, z, 0, 1.3 + amount, 0, 0.9);
      splashes++;
      const A = game.audio;
      if (A && A.ctx && A.noise) { try { const pl = local ? null : A.place && A.place(x, z, 22); if (local || (pl && pl.gain > 0.02)) A.noise(0.13, { gain: local ? 0.09 : 0.09 * pl.gain, freq: 1700, q: 0.7, pan: pl ? pl.pan : 0 }); } catch { /* */ } }
    }
    /** a walker's tracker: {x, z} last footfall, side, wet soles (prints left), swum */
    const mk = () => ({ x: NaN, z: NaN, side: 1, wet: 0, wetMax: 1, swum: false });
    const me = mk(), others = new Map();
    function foot(t, x, z, h, onFoot, swimming, local, env) {
      if (swimming) { t.swum = true; t.x = NaN; return; }
      if (t.swum) { t.swum = false; t.wet = t.wetMax = 26; }
      if (!onFoot) { t.x = NaN; return; }
      if (t.x !== t.x) { t.x = x; t.z = z; return; }
      const d = Math.hypot(x - t.x, z - t.z);
      if (d > 3) { t.x = x; t.z = z; return; }             // (teleported, came out of a door)
      if (d < STEP) return;
      t.x = x; t.z = z; t.side = -t.side;
      const fx = x + Math.cos(h) * 0.1 * t.side, fz = z - Math.sin(h) * 0.1 * t.side, hd = hard(fx, fz);
      if (env.pud > 0.05 && hd && puddleAt(fx, fz, env.pud) > 0.45) { splash(fx, fz, Math.min(1, d * 0.4), local); t.wet = t.wetMax = 13; return; }
      if (env.snow > 0.2) { addPrint(fx, fz, h, env.snow * (hd ? 0.55 : 1), 150); return; }
      if (env.frost > 0.3 && !hd) { addPrint(fx, fz, h, env.frost * 0.75, 110); return; }
      if (t.wet > 0) { addPrint(fx, fz, h, (t.wet / t.wetMax) * (1 - Math.min(1, env.wet * 1.6)), 45); t.wet--; }
    }
    function wheels(x, z, h, speed, half, pud) {
      if (speed < 3 || puddleAt(x, z, pud) < 0.4 || !hard(x, z) || (game.worldCollider.isWater && game.worldCollider.isWater(x, z))) return;
      const fx = Math.sin(h), fz = Math.cos(h), y = game.world.groundHeight(x, z) + 0.06, out = Math.min(4.5, 0.8 + speed * 0.22), n = half > 1 ? 3 : 1;
      for (let i = 0; i < n; i++) for (const s of [1, -1]) P.emit(K_SPRAY, x + fz * s * Math.min(0.8, half * 0.4), y, z - fx * s * Math.min(0.8, half * 0.4), fz * s * out + fx * speed * 0.2, 1.2 + speed * 0.08, -fx * s * out + fz * speed * 0.2, 0.6);
      sprays++;
    }
    const env = { pud: 0, wet: 0, snow: 0, frost: 0 };
    game.wetfeet = { get prints() { return alive; }, get splashes() { return splashes; }, get mesh() { return mesh; }, puddleAt, me,
      /** test hook: one footfall of a walker at (x, z) heading h with the weather's ground as it is, or forced:
       *  { pud, wet, snow, frost } the ground, soles = wet prints left on the walker */
      debugStep(x, z, h = 0, force) { const t = mk(); t.x = x - Math.sin(h) * STEP * 1.01; t.z = z - Math.cos(h) * STEP * 1.01; if (force && force.soles) t.wet = t.wetMax = force.soles; foot(t, x, z, h, true, false, false, { ...env, ...(force || {}) }); return { prints: alive, splashes }; },
      stats: () => ({ prints: alive, made, splashes, sprays, inScene, draws: inScene ? 1 : 0 }) };
    return {
      id: 'wetfeet',
      update(dt) {
        P.step(dt, 'wetfeet');
        const W = game.weather, pl = game.player, U = game.world && game.world.uniforms && game.world.uniforms.wetv ? game.world.uniforms.wetv.value : null;
        env.pud = W ? W.puddle || 0 : 0; env.wet = W ? W.wet || 0 : 0; env.snow = U ? U.y : 0; env.frost = U ? U.z : 0;
        const out = pl.place === 'world';
        const live = env.pud > 0.05 || env.snow > 0.2 || env.frost > 0.3;
        // ---- prints fade (4 Hz), the draw leaves the scene with the last one
        if (inScene && (colT -= dt) <= 0) {
          colT = 0.25; const now = game.time.now(); let n = 0;
          for (let i = 0; i < MAXP; i++) {
            if (!(life[i] > 0)) continue;
            const u = (now - born[i]) / 1000 / life[i];
            if (u >= 1 || u < 0) { life[i] = 0; mesh.setMatrixAt(i, ZERO); mesh.instanceMatrix.needsUpdate = true; continue; }
            n++; mesh.setColorAt(i, C.setScalar(1 - DARK * str[i] * Math.pow(1 - u, 1.5)));
          }
          mesh.instanceColor.needsUpdate = true; alive = n;
          if (!n) { game.worldScene.remove(mesh); inScene = false; }
        }
        if (!out) { me.x = NaN; return; }
        const swim = !!pl.swim;
        if (!live && !swim && !me.swum && me.wet <= 0 && !others.size) { me.x = NaN; if (!(game.net && game.net.others.size)) return; }
        // ---- the local player
        foot(me, pl.pos.x, pl.pos.z, pl.heading, !pl.vehicle && pl.onGround !== false && !swim && (pl.pose === 'stand' || pl.pose === 'drunk'), swim, true, env);
        const v = pl.vehicle;
        // ---- the other players (their trackers go when they do)
        if (game.net) {
          for (const o of game.net.others.values()) {
            if (o.place !== 'world' || (o.x - pl.pos.x) ** 2 + (o.z - pl.pos.z) ** 2 > RANGE * RANGE) { others.delete(o.id); continue; }
            let t = others.get(o.id); if (!t) others.set(o.id, (t = mk()));
            const sw = o.pose === 'swim' || o.pose === 'dive';
            foot(t, o.x, o.z, o.h, !o.veh && (o.pose === 'stand' || o.pose === 'drunk'), sw, false, env);
          }
          if (others.size > game.net.others.size) for (const id of others.keys()) if (!game.net.others.has(id)) others.delete(id);
        }
        // ---- wheels through puddles: yours, the other players', the traffic's
        if (env.pud > 0.05 && (carT -= dt) <= 0) {
          carT = 0.1;
          if (v && v.type && v.heading !== undefined && v.type !== 'rowboat' && v.type !== 'punt') wheels(pl.pos.x, pl.pos.z, v.heading, Math.abs(v.speed || 0), v.half || 1, env.pud);
          if (game.net) for (const o of game.net.others.values()) if (o.veh && o.place === 'world' && o.veh !== 'punt' && o.veh !== 'rowboat' && (o.x - pl.pos.x) ** 2 + (o.z - pl.pos.z) ** 2 < CAR_RANGE * CAR_RANGE) wheels(o.x, o.z, o.h, o.speed || 0, 1, env.pud);
          const L = game.traffic && game.traffic.list;
          if (L) for (const a of L) { if (!a.active || a.speed < 3) continue; const dx = a.x - pl.pos.x, dz = a.z - pl.pos.z; if (dx * dx + dz * dz < CAR_RANGE * CAR_RANGE) wheels(a.x, a.z, a.heading, a.speed, a.half || 1, env.pud); }
        }
      },
    };
  },
};
