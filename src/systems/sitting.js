// Sit down on any bench (fidelity pass, 2026-11). Every bench the world already has is a seat: the 470-odd mapped
// benches and the picnic tables (world/furniture.js InstanceSets), and the benches the streetscape puts on shopping
// pavements and pedestrian streets — nothing is hand-placed here. [E] "Sit down" within reach of one; you sit on the end
// nearer to you (the other end if somebody is on that one), facing the way the bench faces, and the ordinary camera
// keeps working, so you can look up and down the street. Any movement key, Space, E or F gets you up again where you
// stood (in front of the bench when that spot has been taken). Being knocked off it by a car gets you up the hard way.
//   rule       a bench is offered only where it still stands (not one that has been knocked flying: systems/props.js),
//              and only if its seat is outside every building footprint, off the carriageway and dry
//   multiplayer nothing new: the seat is a position and the pose 'sit' is already in the player state, so the others
//              see you sitting on the bench they also have; a seat another player is on is not offered
//   walkers    the pedestrians' own bench list marks the bench busy while you are on it (they pick another)
//   off        ?sit=0 (node: GTO_SIT=0)
//   cost       one 5 Hz lookup in an 8 m grid while on foot outdoors (~1 µs a frame); no draw, no mesh, no listener
// game.sitting = { ready, benches, seated, near, sit(bench?), stand(), stats() }      test: tools/smoke_fidelity.mjs
import * as THREE from 'three';
import { fidOn } from './_fid.js';
import { TUMBLE } from '../core/_tumble_pose.js';

const CELL = 8, REACH = 1.9;
const GETUP = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyF']);
// seats in the bench's own frame: [x along the bench, z out of it, turn of the sitter relative to the bench]
const SEATS = { bench: [[-0.45, 0.03, 0], [0.45, 0.03, 0]], sbench: [[-0.42, 0.03, 0], [0.42, 0.03, 0]], picnic: [[-0.45, 0.55, Math.PI], [0.45, 0.55, Math.PI], [-0.45, -0.55, 0], [0.45, -0.55, 0]] };

/** pure: world position and facing of seat k of a bench record {x, z, h, kind} -> out [x, z, heading] */
export function seatAt(b, k, out = [0, 0, 0]) {
  const s = SEATS[b.kind][k], c = Math.cos(b.h), sn = Math.sin(b.h);
  out[0] = b.x + s[0] * c + s[1] * sn; out[1] = b.z - s[0] * sn + s[1] * c; out[2] = b.h + s[2];
  return out;
}
export const seatCount = (b) => SEATS[b.kind].length;

export default {
  id: 'sitting',
  install(game) {
    if (!fidOn('sit')) { game.sitting = { ready: false, off: true, benches: [], seated: false, near: null, sit: () => false, stand() {}, stats: () => ({ off: true, benches: 0 }) }; return null; }
    const grid = new Map(), benches = [], tmp = [0, 0, 0], V = new THREE.Vector3();
    let ready = false, cur = null, S = null, scanT = 0, dropped = 0, sits = 0;
    const key = (x, z) => Math.floor(x / CELL) * 65536 + Math.floor(z / CELL);
    const vsys = () => game.vehicles && game.vehicles._sys;
    const seatOk = (x, z) => {
      const vs = vsys(), col = game.worldCollider;
      if (vs && vs.inBuilding && vs.inBuilding(x, z)) return false;
      if (vs && vs.onCarriage && vs.onCarriage(x, z, 0.15)) return false;
      if (col && col.isWet && col.isWet(x, z)) return false;
      return true;
    };
    const add = (b) => {
      // a bench is a seat only if every place on it is one (see the rule above)
      for (let k = 0; k < seatCount(b); k++) { seatAt(b, k, tmp); if (!seatOk(tmp[0], tmp[1])) { dropped++; return; } }
      b.id = benches.length; benches.push(b);
      const kk = key(b.x, b.z); let l = grid.get(kk); if (!l) grid.set(kk, (l = [])); l.push(b);
    };
    const build = () => {
      const F = game.world && game.world.furniture, st = game.streetscape;
      if (!F || !F.sets || (st && st.stats && !st.stats().ready)) return false;
      for (const [name, kind] of [['bench', 'bench'], ['picnic', 'picnic']]) {
        const set = F.sets[name]; if (!set) continue;
        for (let i = 0; i < set.n; i++) {
          const x = set.xz[i * 2], z = set.xz[i * 2 + 1]; if (!(Math.abs(x) < 1e7)) continue;
          add({ x, z, y: set.mat[i * 16 + 13], h: Math.atan2(set.mat[i * 16 + 8], set.mat[i * 16 + 10]), kind, set, i, it: null });
        }
      }
      if (st && st.items) for (const it of st.items) if (it.k === 'bench' && !it.gone) add({ x: it.x, z: it.z, y: it.y || 0, h: it.h || 0, kind: 'sbench', set: null, i: -1, it });
      return true;
    };
    /** is the bench still where it was (not knocked over / cleared)? */
    const stands = (b) => (b.set ? Math.abs(b.set.xz[b.i * 2] - b.x) < 0.05 && Math.abs(b.set.xz[b.i * 2 + 1] - b.z) < 0.05 : !b.it.gone && !b.it.taken);
    const nearest = (x, z, r) => {
      let best = null, bd = r * r;
      for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const l = grid.get(cx * 65536 + cz); if (!l) continue;
        for (const b of l) { const d = (b.x - x) ** 2 + (b.z - z) ** 2; if (d < bd && stands(b)) { bd = d; best = b; } }
      }
      return best;
    };
    const taken = (x, z) => {
      for (const o of game.net.others.values()) if (o.place === 'world' && (o.x - x) ** 2 + (o.z - z) ** 2 < 0.2) return true;
      const peds = game.pedestrians;
      if (peds && peds.near) for (const p of peds.near(x, z, 0.5, [])) if (p.active !== false && p.state === 'sit') return true;
      return false;
    };
    const pickSeat = (b, px, pz) => {
      let best = -1, bd = 1e9;
      for (let k = 0; k < seatCount(b); k++) { seatAt(b, k, tmp); if (taken(tmp[0], tmp[1])) continue; const d = (tmp[0] - px) ** 2 + (tmp[1] - pz) ** 2; if (d < bd) { bd = d; best = k; } }
      return best;
    };
    const pedBench = (b, busy) => {
      const L = game.pedestrians && game.pedestrians._sys && game.pedestrians._sys.benches; if (!L) return null;
      if (!busy) { if (S && S.pb) S.pb.busy = false; return null; }
      for (const q of L) if (Math.abs(q.x - b.x) < 0.7 && Math.abs(q.z - b.z) < 0.7) { if (q.busy) return null; q.busy = true; return q; }
      return null;
    };
    function stand(knocked) {
      const s = S; if (!s) return;
      pedBench(s.b, false); S = null;
      const P = game.player;
      if (knocked) return;                         // (thrown off it: the tumble has the body now)
      P.pose = 'stand';
      const col = game.worldCollider, fx = Math.sin(s.h), fz = Math.cos(s.h);
      let x = s.back.x, z = s.back.z;
      if (col && col.isFree && (!col.isFree(x, z, 0.3) || (s.b.x - x) ** 2 + (s.b.z - z) ** 2 > 9)) { x = s.x + fx * 0.75; z = s.z + fz * 0.75; }
      P.pos.set(x, game.groundHeight(x, z), z); P.vx = P.vz = 0; P.speed = 0;
      if (P.syncMesh) P.syncMesh();
    }
    function sit(b) {
      const P = game.player; b = b || cur;
      if (!b || S || P.vehicle || P.swim || P.place !== 'world' || game.activity || !stands(b)) return false;
      const k = pickSeat(b, P.pos.x, P.pos.z); if (k < 0) return false;
      seatAt(b, k, tmp);
      S = { b, k, x: tmp[0], z: tmp[1], y: b.y, h: tmp[2], back: { x: P.pos.x, z: P.pos.z }, pb: null };
      S.pb = pedBench(b, true);
      P.pose = 'sit'; P.pos.set(S.x, S.y, S.z); P.heading = S.h; P.vx = P.vz = 0; P.speed = 0;
      if (P.syncMesh) P.syncMesh();
      sits++;
      game.beginActivity({ name: 'sit', pointer: 'locked', onKey(code) { if (GETUP.has(code)) game.endActivity(); }, onEnd() { stand(false); } });
      try { const fl = game.state.flags || (game.state.flags = {}); if ((fl.sitTip | 0) < 2) { fl.sitTip = (fl.sitTip | 0) + 1; game.ui.toast('Any movement key to get up.', 3); } } catch { /* */ }
      return true;
    }
    // a place's own seat at the same spot keeps its prompt (the curiosities' benches, the Botanic Garden's, the Memorial steps)
    const ownSeat = (px, pz) => {
      for (const it of game.interact.items) {
        if (it === mine || it.place !== 'world' || typeof it.label !== 'string' || !/^Sit\b/.test(it.label) || !it.pos || typeof it.pos === 'function') continue;
        if ((it.pos.x - px) ** 2 + (it.pos.z - pz) ** 2 < it.radius * it.radius && (!it.enabled || it.enabled())) return true;
      }
      return false;
    };
    const mine = game.interact.add({ pos: () => (cur ? V.set(cur.x, cur.y, cur.z) : null), radius: REACH, label: 'Sit down', enabled: () => !!cur && !S, onUse: () => sit(cur) });
    game.sitting = { get ready() { return ready; }, benches, get seated() { return !!S; }, get near() { return cur; }, get seat() { return S; }, sit, stand: () => { if (S && game.activity && game.activity.name === 'sit') game.endActivity(); }, seatAt, seatCount, nearest, stands,
      stats: () => ({ ready, benches: benches.length, dropped, sits, seated: !!S }) };
    return {
      id: 'sitting',
      update(dt) {
        if (!ready) { ready = build(); if (!ready) return; }
        const P = game.player;
        if (S) {
          // (the body belongs to whatever knocked it; a bench that has gone from under us; a place change)
          if (TUMBLE[P.pose] || P.pose !== 'sit' || P.place !== 'world' || !stands(S.b)) {
            const knocked = P.pose !== 'sit';
            const a = game.activity; stand(knocked);
            if (a && a.name === 'sit') { a.onEnd = null; game.endActivity(); }
            return;
          }
          if (!game.activity || game.activity.name !== 'sit') { stand(false); return; }
          P.pos.set(S.x, S.y, S.z); P.heading = S.h; P.vx = P.vz = 0;
          if (P.syncMesh) P.syncMesh();
          return;
        }
        if ((scanT -= dt) > 0) return;
        scanT = 0.2;
        cur = P.place === 'world' && !P.vehicle && !P.swim && !game.activity ? nearest(P.pos.x, P.pos.z, REACH) : null;
        if (cur && ownSeat(P.pos.x, P.pos.z)) cur = null;
      },
    };
  },
};
