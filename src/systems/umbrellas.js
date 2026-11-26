// Open umbrellas in the rain (2026-11 play pass): when game.weather.umbrellas says so, a share of the walkers near the
// player put one up. ONE instanced draw (canopy + shaft, per-instance colour, no shadow, <= 40 instances), not in the
// scene at all while it is dry; nothing is added to any character (their looks, pooled rigs and the wire format are
// untouched). Who carries one is a function of the walker's own look seed (the same people for every player) and of how
// hard it is raining: drizzle brings out a few, a downpour nearly everybody who has one.
// The players have one too (fidelity pass: `playerUp`, ?brolly=0 / GTO_BROLLY=0 off): see the scan below.
// game.umbrellas = { count, shown, players, playerUp(u, onFoot, pose, speed), stats() }.  Test: tools/smoke_weather.mjs (umbrellas section).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fidOn } from './_fid.js';

const MAX = 40, RANGE = 70;
// players' umbrellas (fidelity pass): up from this much of game.weather.umbrellas (steady rain, not drizzle), down at a run
const PLAYER_RAIN = 0.5, PLAYER_RUN = 4.4;
const BROLLY = fidOn('brolly');
/** pure: has a player in this state got an umbrella up at rain level u? (on foot = no vehicle, not swimming) */
export const playerUp = (u, onFoot, pose, speed) => BROLLY && u >= PLAYER_RAIN && !!onFoot && pose === 'stand' && speed < PLAYER_RUN;
const COLORS = [0x15161c, 0x15161c, 0x15161c, 0x1c2440, 0x5a1620, 0x1f4a36, 0xd9d2c0, 0xb8282e, 0x2a5f9a, 0xe0b020, 0x4a2a5a];
/** pure: does the walker with this seed put an umbrella up at rain level u (0..1)? ~62 % own one. */
export function carries(seed, u) {
  const h = (Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 8) / 16777216;       // 0..1, fixed per walker
  return h < 0.62 * Math.min(1, u * 1.15);
}
export const colourOf = (seed) => COLORS[(Math.imul(seed | 0, 0x27d4eb2d) >>> 9) % COLORS.length];

function geometry() {
  // canopy: a shallow 8-gore cone with a scalloped rim, a ferrule on top, a shaft and a crook handle; origin = the grip
  const canopy = new THREE.ConeGeometry(0.56, 0.2, 8, 1, true); canopy.translate(0, 0.86, 0);
  const tip = new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4); tip.translate(0, 0.99, 0);
  const shaft = new THREE.CylinderGeometry(0.009, 0.009, 0.9, 5); shaft.translate(0, 0.41, 0);
  const grip = new THREE.CylinderGeometry(0.018, 0.018, 0.11, 5); grip.translate(0, -0.02, 0);
  const parts = [canopy, tip, shaft, grip].map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; });
  // vertex colour: canopy white (takes the instance colour), the hardware dark
  parts.forEach((g, i) => { const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(i === 0 ? 1 : 0.16); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); });
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  return g;
}

export default {
  id: 'umbrellas',
  install(game) {
    let mesh = null, inScene = false, scanT = 0, shown = 0, checked = 0, players = 0;
    const meRec = {};
    const who = [], tmp = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), C = new THREE.Color();
    const build = () => {
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      mesh = new THREE.InstancedMesh(geometry(), mat, MAX);
      mesh.name = 'weather:umbrellas'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, C.set(0x15161c)); mesh.setMatrixAt(0, M.identity());
    };
    build();          // built up front (not in the scene) so world/prewarm.js can draw it once before Play: no hitch when the rain starts
    const api = game.umbrellas = { get count() { return shown; }, get shown() { return inScene; }, get mesh() { return mesh; }, carries, playerUp, get players() { return players; }, stats: () => ({ shown, inScene, checked, players, draws: inScene ? 1 : 0 }) };
    return {
      id: 'umbrellas',
      update(dt) {
        const W = game.weather, peds = game.pedestrians, pl = game.player;
        const u = W && pl.place === 'world' ? W.umbrellas || 0 : 0;
        if (u < 0.04 || !peds || !peds.near) {
          if (inScene) { game.worldScene.remove(mesh); inScene = false; shown = 0; players = 0; for (const p of who) if (p.character) p.character.brolly = 0; who.length = 0; }
          return;
        }
        if (!inScene) { game.worldScene.add(mesh); inScene = true; scanT = 0; }
        // who has one up: re-chosen four times a second from the walkers near the player
        if ((scanT -= dt) <= 0) {
          scanT = 0.25; for (const p of who) if (p.character) p.character.brolly = 0;
          who.length = 0; checked = 0; players = 0;
          const wp = pl.worldPos || pl.pos;
          for (const p of peds.near(wp.x, wp.z, RANGE, tmp)) {
            if (who.length >= MAX) break;
            if (!p.active || p.down || p.dog || !p.character || p.role === 'jogger' || p.role === 'rower' || p.role === 'police' || p.role === 'porter') continue;
            const ch = p.character; if (!ch.group || !ch.group.visible) continue;
            const pose = ch.pose; if (pose && pose !== 'walk' && pose !== 'stand' && pose !== 'run' && pose !== 'idle') continue;      // not while waving a cab down, sitting, dancing, tumbling
            checked++;
            const seed = p.lookSeed || p.sid || p.poolIdx || 0;
            if (!carries(seed, u)) continue;
            who.push(p);
            ch.brolly = ch.spec && ch.spec.hold ? -1 : 1;        // (core/characters.js holds that arm up: the right, or the left when the right hand has something in it)
            mesh.setColorAt(who.length - 1, C.set(colourOf(seed)));
          }
          // the players' own (fidelity pass, 2026-11; ?brolly=0 off): once it is properly raining, a player on foot at a
          // walk has one up; it comes down to run, ride, drive or swim. A rule on what the player state already carries
          // (on foot, pose, speed) and the shared weather, so every client draws the same umbrellas: nothing sent.
          if (BROLLY && u >= PLAYER_RAIN) {
            const add = (rec, ch, id, speed) => {
              if (who.length >= MAX || !ch || !ch.group || ch.group.visible === false) return;
              rec.active = true; rec.down = false; rec.character = ch; rec.speed = speed; rec.isPlayer = true;
              who.push(rec); players++;
              ch.brolly = ch.spec && ch.spec.hold ? -1 : 1;
              mesh.setColorAt(who.length - 1, C.set(colourOf((id | 0) * 7919 + 13)));
            };
            if (!pl.vehicle && !pl.swim && pl.pose === 'stand' && pl.onGround !== false && pl.speed < PLAYER_RUN) add(meRec, pl.character, (game.net && game.net.id) || 1, pl.speed);
            if (game.net) for (const o of game.net.others.values()) {
              if (o.place !== 'world' || o.veh || o.pose !== 'stand' || o.speed >= PLAYER_RUN || (o.x - wp.x) ** 2 + (o.z - wp.z) ** 2 > RANGE * RANGE) continue;
              add(o._brolly || (o._brolly = {}), o.character, o.id, o.speed);
            }
          }
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
        let n = 0;
        for (const p of who) {
          if (!p.active || p.down || !p.character) continue;
          const ch = p.character, g = ch.group, h = g.rotation.y, fx = Math.sin(h), fz = Math.cos(h);
          { const pose = ch.pose; if (pose && pose !== 'walk' && pose !== 'stand' && pose !== 'run' && pose !== 'idle') { ch.brolly = 0; continue; } }       // (started waving, sat down, was knocked over since the last scan)
          // the grip in the hand held up in front of the shoulder (core/characters.js, c.brolly: +1 right, -1 left; by the
          // figure's own height), the canopy over the head, leaning a touch into the walk and the wind
          const sd = ch.brolly < 0 ? -1 : 1, s = ch.dims ? ch.dims.s : 1, lift = ch.rig ? ch.rig.position.y : 0;
          P.set(g.position.x - fz * 0.19 * sd + fx * 0.2 * s, g.position.y + 1.2 * s + lift, g.position.z + fx * 0.19 * sd + fz * 0.2 * s);
          E.set(0.1 + 0.05 * Math.min(2, p.speed || 0), h, 0.13 * sd);
          Q.setFromEuler(E);
          M.compose(P, Q, S); mesh.setMatrixAt(n++, M);
        }
        mesh.count = n; shown = n;
        mesh.instanceMatrix.needsUpdate = true;
        void api;
      },
    };
  },
};
