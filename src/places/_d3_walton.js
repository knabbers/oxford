// Walton Well and Aristotle Lane, c. 2013 — the two ways from Jericho and North Oxford to Port Meadow (districts pass 3;
// places/walton_well.js is the module, this file holds it). See docs/research/districts3.md.
//
//   install  (all in the shared batch-4 atlas draw, _b4_kit.js — no new static draw call)
//            · the Walton Well drinking fountain (1885, Portland stone, Baroque: a shell niche, ball finials, the
//              inscription) on the corner where Walton Well Road meets Longworth and Southmoor Roads
//            · the canal bridges on Walton Well Road and Aristotle Lane and the Castle Mill Stream bridge: brick
//              parapets with stone copings and end piers over the world's plain stone ones
//            · narrowboats moored on the towpath side of the canal by Walton Well bridge
//            · Aristotle Lane Recreation Ground: goals, a playground (swings, slide, roundabout) in its railing, benches,
//              the board at the gate
//   do       kingfisher watch from either canal bridge: lean on the parapet and wait; everyone sees the same bird at
//            the same moment (shared clock); £1 for the first sighting of the game day
//   sights   for the passport (game.waltonWell.sights)
// Test hooks: game.waltonWell = { sights, stats(), king }       tools/smoke_districts3.mjs
import * as THREE from 'three';
import { shared, addSite, RB, frame, bench, h01, DAY_MS } from './_b4_kit.js';
import { offCarriage, offBuildings, pip } from './_eo_kit.js';
import { narrowboat } from './_jer_build.js';
import { boardPost, signAt } from './_d2_kit.js';
import { D3OFF, parapetSkin, ownMesh, kingfisherBatch, cumOf, along } from './_d3_kit.js';
import { nearSet, BOATER_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';

export const IDS = { fountain: 'n1435646651', wwCanal: 'w37255124', wwStream: 'w37901068', aristotle: 'w22814919', canalS: 'w3220558', canalN: 'w3220550', rec: 'w26423827' };
export const sights = [
  { id: 'd3-waltonwell', name: 'The Walton Well drinking fountain', x: -685, z: -799, blurb: 'A Portland stone fountain of 1885 in the Baroque manner, with a shell niche and ball finials, given by a former mayor on the site of the old Walton Well spring. It has not run for years.' },
  { id: 'd3-wwbridge', name: 'Walton Well bridge', x: -750, z: -802, blurb: 'Walton Well Road humps over the Oxford Canal and then the Castle Mill Stream on its way to Port Meadow. Narrowboats moor along the towpath below; kingfishers, if you are patient.' },
  { id: 'd3-aristotle', name: 'Aristotle Lane bridge', x: -679, z: -1392, blurb: 'The lane from North Oxford crosses the canal here on its way to the recreation ground and the footbridge over the railway to Port Meadow.' },
  { id: 'd3-recground', name: 'Aristotle Lane Recreation Ground', x: -736, z: -1278, blurb: 'A long strip of grass between the canal and the railway: kickabouts, a playground, dog walkers and the allotments\' bonfire smoke.' },
];
/** pure: the kingfisher flights (shared clock). One window every KING.win ms; most windows have a flight at one bridge. */
export const KING = { win: 25000, p: 0.8, dur: 2600, prize: 1, wait: 90 };
export function kingFlight(tMs) {
  const k = Math.floor(tMs / KING.win);
  if (h01(k, 41) > KING.p) return null;
  const t0 = k * KING.win + Math.floor(h01(k, 42) * (KING.win - KING.dur - 500)), bridge = h01(k, 43) < 0.5 ? 0 : 1, dir = h01(k, 44) < 0.5 ? 1 : -1;
  return { t0, t1: t0 + KING.dur, bridge, dir };
}

export default {
  id: 'walton_well',
  install(game) {
    if (D3OFF()) return null;
    const K = shared(game), me = K.join('walton_well'), map = game.map, col = game.worldCollider;
    const S = { err: false, fountain: null, bridges: [], boats: [], rec: null, kingSpots: [], goals: 0, play: 0, benches: 0 };
    const wet = (x, z) => col.isWater(x, z);
    try {
      // ---------------------------------------------------------------- the drinking fountain
      {
        const p = map.pois.find((q) => q.id === IDS.fountain);
        if (p) {
          // the nearest spot on the pavement clear of the carriageways and the houses
          let fs = null, bd = Infinity;
          for (let dx = -8; dx <= 8; dx += 0.5) for (let dz = -8; dz <= 8; dz += 0.5) {
            const x = p.p[0] + dx, z = p.p[1] + dz, d = Math.hypot(dx, dz);
            if (d < bd && offCarriage(map, x, z, 1.1) && offBuildings(map, x, z, 1.4) && !wet(x, z)) { bd = d; fs = [x, z]; }
          }
          if (fs) {
            // face the nearest road: the niche looks out over the junction
            const rd = map.roads.filter((r) => /Walton Well Road|Longworth Road|Southmoor Road/.test(r.name || ''));
            let nr = null, nd = Infinity;
            for (const r of rd) for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((fs[0] - a[0]) * dx + (fs[1] - a[1]) * dz) / L2)), x = a[0] + dx * t, z = a[1] + dz * t, d = Math.hypot(fs[0] - x, fs[1] - z); if (d < nd) { nd = d; nr = [x, z]; } }
            const fx = nr ? (nr[0] - fs[0]) / (nd || 1) : 0, fz = nr ? (nr[1] - fs[1]) / (nd || 1) : 1;
            const Bq = [0, 1, 2].map((q) => { const B = new RB(); fountain(B, fs[0], fs[1], fx, fz, q); return B; });
            addSite(K, 'd3:fountain', [fs[0], 1.6, fs[1]], 2.5, [80, 200, 420], Bq);
            col.addBox(fs[0], fs[1], 1.0, 1.4, Math.atan2(fz, -fx));
            S.fountain = { x: fs[0], z: fs[1], fx, fz, moved: bd };
          }
        }
      }
      // ---------------------------------------------------------------- the bridges: brick parapets over the stone ones
      for (const id of [IDS.wwCanal, IDS.wwStream, IDS.aristotle]) {
        const br = map.roads.find((r) => r.id === id); if (!br) continue;
        const pw = br.pw !== undefined ? br.pw : 2.4, off = (br.w || 6.5) / 2 + (pw || 0.3) + 0.25;
        const Bq = [0, 1, 2].map((q) => { const B = new RB(); parapetSkin(B, br.pts, off, q, q ? 'brickDk' : 'brick', 'dress'); return B; });
        const a = br.pts[0], b = br.pts[br.pts.length - 1], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        addSite(K, 'd3:bridge:' + id, [m[0], 0.8, m[1]], L / 2 + 2, [90, 220, 420], Bq);
        for (const sd of [-1, 1]) for (const p of [a, b]) { const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; col.addCircle(p[0] - uz * sd * off, p[1] + ux * sd * off, 0.45); }
        S.bridges.push({ id, m, a, b, off });
      }
      // ---------------------------------------------------------------- narrowboats below Walton Well bridge
      {
        const wl = map.waterlines.find((w) => w.id === IDS.canalS);
        const wb = S.bridges.find((q) => q.id === IDS.wwCanal);
        if (wl && wb) {
          const pts = wl.pts, cum = cumOf(pts), Lw = cum[cum.length - 1];
          // the distance along the canal of the bridge
          let sb = 0, bd = Infinity; for (let s = 0; s < Lw; s += 2) { const p = along(pts, cum, s), d = Math.hypot(p.x - wb.m[0], p.z - wb.m[1]); if (d < bd) { bd = d; sb = s; } }
          const B = [new RB(), new RB(), new RB()];
          for (const sd of [1, -1]) {
            if (S.boats.length) break;
            let s = sb + 14, k = 0;
            while (s < sb + 170 && S.boats.length < 5) {
              const Lb = [17.6, 20, 18.5, 16.8, 21][(k + 1) % 5], p = along(pts, cum, s + Lb / 2), off = sd * 2.9;
              const ok = [-Lb / 2 + 1, 0, Lb / 2 - 1].every((o) => { const qq = along(pts, cum, s + Lb / 2 + o); return [off - 1.1, off, off + 1.1].every((d) => wet(qq.x + qq.nx * d, qq.z + qq.nz * d)); });
              if (ok) { const x = p.x + p.nx * off, z = p.z + p.nz * off, h = Math.atan2(p.ux, p.uz) + (k % 2 ? Math.PI : 0); for (let q = 0; q < 3; q++) narrowboat(B[q], x, z, h, Lb, k + 2, q); S.boats.push({ x, z, h, L: Lb }); col.addBox(x, z, 2.1, Lb, h); }
              s += Lb + 3 + (k % 2); k++;
            }
          }
          if (S.boats.length) { const c = S.boats[Math.floor(S.boats.length / 2)]; addSite(K, 'd3:wwboats', [c.x, 1, c.z], 70, [80, 220, 480], B); }
        }
      }
      // ---------------------------------------------------------------- Aristotle Lane Recreation Ground
      {
        const ar = map.areas.find((a) => a.id === IDS.rec);
        if (ar) {
          const poly = ar.poly, ok = (x, z, m = 1.5) => pip(x, z, poly) && !wet(x, z) && offBuildings(map, x, z, m) && offCarriage(map, x, z, m) && [[m, 0], [-m, 0], [0, m], [0, -m]].every(([dx, dz]) => pip(x + dx, z + dz, poly) && !wet(x + dx, z + dz));
          const B0 = new RB(), B1 = new RB();
          // the playground: in the south end by Aristotle Lane, a 16 x 12 railed square
          let pg = null; for (let z = -1368; z < -1300 && !pg; z += 2) for (let x = -780; x < -700 && !pg; x += 2) if ([[0, 0], [8, 6], [-8, 6], [8, -6], [-8, -6]].every(([dx, dz]) => ok(x + dx, z + dz, 1.0))) pg = [x, z];
          if (pg) {
            const [px, pz] = pg;
            for (const [B, q] of [[B0, 0], [B1, 1]]) {
              // railing (green), gate gap on the south side
              const c = [[px - 8, pz - 6], [px + 8, pz - 6], [px + 8, pz + 6], [px - 8, pz + 6]];
              for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; if (i === 2) { B.beam('green', [a[0], 1.0, a[1]], [a[0] - 6, 1.0, a[1]], 0.04); B.beam('green', [b[0] + 6, 1.0, b[1]], [b[0], 1.0, b[1]], 0.04); } else B.beam('green', [a[0], 1.0, a[1]], [b[0], 1.0, b[1]], 0.04); if (q === 0) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / 0.5); for (let k = 0; k <= n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; if (i === 2 && Math.abs(x - px) < 2) continue; B.beam('green', [x, 0, z], [x, 1.02, z], 0.025); } } }
              // swings: an A-frame, a top bar, two seats on chains
              const sx = px - 4, sz = pz - 2;
              for (const e of [-1.6, 1.6]) { B.beam('slide', [sx + e, 0, sz - 0.9], [sx + e, 2.3, sz], 0.07); B.beam('slide', [sx + e, 0, sz + 0.9], [sx + e, 2.3, sz], 0.07); }
              B.beam('iron', [sx - 1.6, 2.3, sz], [sx + 1.6, 2.3, sz], 0.08);
              for (const e of [-0.7, 0.7]) { if (q === 0) { B.beam('iron', [sx + e - 0.2, 2.3, sz], [sx + e - 0.2, 0.5, sz], 0.015); B.beam('iron', [sx + e + 0.2, 2.3, sz], [sx + e + 0.2, 0.5, sz], 0.015); } B.box('rubber', sx + e, 0.48, sz, 0.48, 0.04, 0.2, 0); }
              // the slide: a ladder, a platform, the chute
              const lx = px + 4, lz = pz + 1;
              B.box('slide', lx, 1.5, lz, 1.0, 0.08, 1.0, 0); for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) B.beam('iron', [lx + dx, 0, lz + dz], [lx + dx, 2.4, lz + dz], 0.05);
              B.beam('iron', [lx - 0.45, 2.4, lz - 0.45], [lx + 0.45, 2.4, lz - 0.45], 0.04); B.beam('iron', [lx - 0.45, 2.4, lz + 0.45], [lx + 0.45, 2.4, lz + 0.45], 0.04);
              B.poly('slide', [[lx - 0.3, 1.55, lz + 0.5], [lx + 0.3, 1.55, lz + 0.5], [lx + 0.3, 0.3, lz + 3.4], [lx - 0.3, 0.3, lz + 3.4]], [0, 1, 0.4]);
              for (const sd of [-1, 1]) B.beam('slide', [lx + sd * 0.32, 1.7, lz + 0.5], [lx + sd * 0.32, 0.45, lz + 3.4], 0.04);
              if (q === 0) for (let k = 0; k < 5; k++) B.beam('iron', [lx - 0.3, 0.3 + k * 0.3, lz - 0.5 - 0.0], [lx + 0.3, 0.3 + k * 0.3, lz - 0.5], 0.03);
              // the roundabout
              B.cyl('slide', px, 0.2, pz + 3.2, 1.3, 0.1, q ? 8 : 14, true); B.cyl('iron', px, 0.3, pz + 3.2, 0.06, 0.8, 6, true);
              if (q === 0) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; B.beam('iron', [px, 1.0, pz + 3.2], [px + Math.sin(a) * 1.1, 0.9, pz + 3.2 + Math.cos(a) * 1.1], 0.03); B.beam('iron', [px + Math.sin(a) * 1.1, 0.3, pz + 3.2 + Math.cos(a) * 1.1], [px + Math.sin(a) * 1.1, 0.9, pz + 3.2 + Math.cos(a) * 1.1], 0.03); }
              // benches by the gate, the board
              bench(B, px - 3, pz + 7.6, 0); bench(B, px + 3, pz + 7.6, 0);
            }
            if (ok(px, pz + 9.5, 0.6)) { boardPost(B0, px + 6.5, pz + 8.5, 0, 1, 'sign_recGround', 2.6, 1.4, 0); boardPost(B1, px + 6.5, pz + 8.5, 0, 1, 'sign_recGround', 2.6, 1.4, 1); col.addCircle(px + 6.5, pz + 8.5, 0.3); }
            col.addBox(px - 4, pz - 2, 2.2, 3.4, 0); col.addBox(px + 4, pz + 1, 1.0, 1.0, 0); col.addCircle(px, pz + 3.2, 1.3);
            for (const e of [-3, 3]) col.addBox(px + e, pz + 7.6, 0.5, 1.7, Math.PI / 2);
            S.play = 1; S.benches = 2; S.playAt = pg;
          }
          // two pairs of goals up the field
          let goals = 0;
          for (const [z0, z1] of [[-1310, -1240]]) {
            let gx = null; for (let x = -760; x < -700 && gx === null; x += 2) if (ok(x, z0, 3) && ok(x, z1, 3)) gx = x;
            if (gx === null) continue;
            for (const [gz, sgn] of [[z0, 1], [z1, -1]]) for (const [B, q] of [[B0, 0], [B1, 1]]) {
              B.beam('goal', [gx - 2.5, 0, gz], [gx - 2.5, 2.0, gz], 0.08); B.beam('goal', [gx + 2.5, 0, gz], [gx + 2.5, 2.0, gz], 0.08); B.beam('goal', [gx - 2.5, 2.0, gz], [gx + 2.5, 2.0, gz], 0.08);
              if (q === 0) { B.beam('goal', [gx - 2.5, 2.0, gz], [gx - 2.5, 0, gz + sgn * -1.4], 0.03); B.beam('goal', [gx + 2.5, 2.0, gz], [gx + 2.5, 0, gz + sgn * -1.4], 0.03); B.beam('goal', [gx - 2.5, 0.02, gz + sgn * -1.4], [gx + 2.5, 0.02, gz + sgn * -1.4], 0.03); }
              if (q === 0) { goals++; col.addCircle(gx - 2.5, gz, 0.12); col.addCircle(gx + 2.5, gz, 0.12); }
            }
          }
          S.goals = goals;
          const c = S.playAt || [-736, -1278];
          addSite(K, 'd3:rec', [c[0], 1, c[1] + 30], 70, [80, 180, 0.01], [B0, B1, null], { farArea: 99 });
          S.rec = true;
        }
      }
      K.boxes.push([-800, -660, -1420, -760]);
    } catch (e) { console.error('[walton_well] build', e); } finally { K.joined(me); }

    // ---------------------------------------------------------------- people: a parent at the playground, a boater
    let parent = null, boater = null;
    try {
      if (S.playAt) { const [px, pz] = S.playAt; parent = nearSet(game, { c: [px, pz], r: 70, h0: 9, h1: 18.5, people: [{ x: px - 1.5, z: pz + 6.6, h: Math.PI, look: randomLook('d3-rec-parent', { outfit: 'casual' }), pose: 'stand', lines: BOATER_LINES }, { x: px + 2.6, z: pz - 1.0, h: 0.4, look: randomLook('d3-rec-parent2', { outfit: 'tweed' }), pose: 'phone', lines: null }] }); }
      if (S.boats.length) { const b = S.boats[0]; let at = null; for (let d = 1.6; d < 7 && !at; d += 0.4) for (const sd of [1, -1]) { const x = b.x + Math.cos(b.h) * sd * d, z = b.z - Math.sin(b.h) * sd * d; if (!at && !col.isWater(x, z) && offCarriage(map, x, z, 1) && offBuildings(map, x, z, 0.6)) at = [x, z]; } if (at) boater = nearSet(game, { c: at, r: 60, h0: 9, h1: 18, people: [{ x: at[0], z: at[1], h: Math.atan2(b.x - at[0], b.z - at[1]), look: randomLook('d3-ww-boater', { outfit: 'tweed' }), pose: 'stand', lines: BOATER_LINES, label: 'Boater' }] }); }
    } catch (e) { console.warn('[walton_well] people', e); }

    // ---------------------------------------------------------------- the kingfisher
    const Kf = { watch: null, seen: 0, mesh: null, paths: [] };
    for (const id of [IDS.wwCanal, IDS.aristotle]) {
      const br = S.bridges.find((q) => q.id === id), wl = map.waterlines.find((w) => w.id === (id === IDS.aristotle ? IDS.canalN : IDS.canalS));
      if (!br || !wl) { Kf.paths.push(null); continue; }
      const pts = wl.pts, cum = cumOf(pts), Lw = cum[cum.length - 1]; let sb = 0, bd = Infinity;
      for (let s = 0; s < Lw; s += 1) { const p = along(pts, cum, s), d = Math.hypot(p.x - br.m[0], p.z - br.m[1]); if (d < bd) { bd = d; sb = s; } }
      Kf.paths.push({ pts, cum, s0: Math.max(0, sb - 22), s1: Math.min(Lw, sb + 22) });
      // where to stand: on the bridge's pavement by the parapet, both sides
      const ux = (br.b[0] - br.a[0]), uz = (br.b[1] - br.a[1]), L = Math.hypot(ux, uz);
      for (const sd of [-1, 1]) S.kingSpots.push({ x: br.m[0] - (uz / L) * sd * (br.off - 1.0), z: br.m[1] + (ux / L) * sd * (br.off - 1.0), bridge: Kf.paths.length - 1 });
    }
    const flags = () => game.state.flags || (game.state.flags = {});
    for (const sp of S.kingSpots) game.interact.add({ pos: [sp.x, sp.z], radius: 2.2, label: () => (Kf.watch ? 'Keep watching the water...' : 'Watch for a kingfisher'), enabled: () => !Kf.watch, onUse: () => {
      Kf.watch = { t0: game.time.now(), bridge: sp.bridge, x: sp.x, z: sp.z };
      game.ui.toast('You lean on the parapet and watch the canal. Quietly. Kingfishers are a flash of blue, low over the water.', 5);
    } });
    Kf.tick = () => {
      const now = game.time.now(), f = kingFlight(now), p = game.player;
      // the bird (only drawn near its bridge, only while it flies)
      let show = false;
      if (f && now >= f.t0 && now < f.t1 && Kf.paths[f.bridge]) {
        const P = Kf.paths[f.bridge], near = p.place === 'world' && S.kingSpots.some((s) => s.bridge === f.bridge && Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 120);
        if (near) {
          if (!Kf.mesh) Kf.mesh = ownMesh(game, kingfisherBatch(), 'd3x:kingfisher');
          const t = (now - f.t0) / KING.dur, s = f.dir > 0 ? P.s0 + (P.s1 - P.s0) * t : P.s1 - (P.s1 - P.s0) * t, q = along(P.pts, P.cum, s);
          Kf.mesh.position.set(q.x + q.nx * 0.6, 0.45 + Math.sin(t * 9) * 0.05, q.z + q.nz * 0.6); Kf.mesh.rotation.y = Math.atan2(q.ux * f.dir, q.uz * f.dir); Kf.mesh.updateMatrix(); Kf.mesh.updateMatrixWorld();
          show = true;
        }
      }
      if (Kf.mesh) Kf.mesh.visible = show;
      // the watch
      const W = Kf.watch; if (!W) return;
      if (p.place !== 'world' || Math.hypot(p.pos.x - W.x, p.pos.z - W.z) > 7) { Kf.watch = null; game.ui.toast('You give up on the kingfisher. It was probably watching you.', 3.5); return; }
      if (f && f.bridge === W.bridge && now >= f.t0 && now - f.t0 < 1500 && f.t0 >= W.t0) {
        Kf.watch = null; Kf.seen++;
        const day = Math.floor(now / DAY_MS), fl = flags();
        if (fl.kingDay !== day) { fl.kingDay = day; fl.kingfishers = (fl.kingfishers || 0) + 1; game.pay(KING.prize); try { game.save(); } catch { /* */ } game.ui.toast(`THERE! A flash of electric blue, low along the water and under the bridge. A kingfisher. The boater on the towpath nods: worth £${KING.prize} of anyone's morning.`, 6); }
        else game.ui.toast('Another kingfisher! Or the same one, showing off.', 4);
        return;
      }
      if ((now - W.t0) / 1000 > KING.wait) { Kf.watch = null; game.ui.toast('Nothing but a moorhen, who looks at you as if YOU are the strange one. Try again later.', 4.5); }
    };

    game.waltonWell = {
      sights, king: { flight: kingFlight, watching: () => Kf.watch, seen: () => Kf.seen, spots: S.kingSpots },
      stats() { return { fountain: S.fountain, bridges: S.bridges.length, boats: S.boats.length, boatList: S.boats, play: S.play, goals: S.goals, benches: S.benches, rec: !!S.rec, kingSpots: S.kingSpots.length, people: (parent ? parent.count() : 0) + (boater ? boater.count() : 0) }; },
    };
    return { update() { try { K.tick(me); if (parent) parent.tick(); if (boater) boater.tick(); Kf.tick(); } catch (e) { if (!S.err) { S.err = true; console.error('[walton_well]', e); } } } };
  },
};

/**
 * The Walton Well fountain at (x, z), its front facing (fx, fz). K: Portland stone, 1885, Baroque, shell motifs, ball
 * finials, the inscription. G: every dimension and the arrangement (a pier with a shell-headed niche over a basin, a
 * cornice and a segmental top with a ball finial; side scrolls; a low dog trough), the inscription's place.
 */
function fountain(B, x, z, fx, fz, q) {
  B.push(frame(x, 0, z, fz, -fx));                 // local x across the front, local +z = the front
  const st = q ? 'portlandDk' : 'portland';
  // a stepped base, the pier, the cornice
  B.box('portlandDk', 0, 0.1, 0, 1.7, 0.2, 1.2, 0);
  B.box(st, 0, 0.32, 0, 1.5, 0.24, 1.05, 0);
  B.box(st, 0, 1.3, -0.05, 1.2, 1.72, 0.8, 0, { top: false });
  B.box(st, 0, 2.27, -0.05, 1.42, 0.22, 1.0, 0, { bottom: true });
  // the top: a block with a segmental pediment face, a ball finial on a pedestal, small balls at the corners
  B.box(st, 0, 2.6, -0.05, 1.0, 0.44, 0.7, 0);
  if (q < 2) {
    const n = 8; for (let i = 0; i < n; i++) { const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n; B.poly(st, [[0, 2.82, 0.31], [Math.cos(a0) * 0.5, 2.82 + Math.sin(a0) * 0.28, 0.31], [Math.cos(a1) * 0.5, 2.82 + Math.sin(a1) * 0.28, 0.31]], [0, 0, 1]); }
    B.lathe(st, 0, -0.05, [[0.2, 2.82], [0.16, 2.95], [0.12, 3.0], [0.2, 3.12], [0.22, 3.22], [0.18, 3.34], [0.08, 3.42], [0.0, 3.44]], { seg: q ? 8 : 12 });
    for (const sx of [-0.62, 0.62]) for (const sz of [0.38, -0.48]) B.lathe(st, sx, sz, [[0.08, 2.38], [0.1, 2.46], [0.07, 2.56], [0.0, 2.58]], { seg: 8 });
  } else B.box(st, 0, 3.1, -0.05, 0.36, 0.6, 0.36, 0);
  // the niche: a dark recess with a shell head, the spout and the basin
  if (q < 2) {
    B.box('shade', 0, 1.25, 0.36, 0.56, 0.9, 0.02, 0);
    const n = 9; for (let i = 0; i < n; i++) { const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n, r = 0.28; B.poly(i % 2 ? st : 'portlandDk', [[0, 1.7, 0.37], [Math.cos(a0) * r, 1.7 + Math.sin(a0) * r, 0.37], [Math.cos(a1) * r, 1.7 + Math.sin(a1) * r, 0.37]], [0, 0, 1]); }
    B.lathe('brass', 0, 0.42, [[0.03, 1.3], [0.03, 1.38], [0.0, 1.4]], { seg: 6 });
    B.lathe(st, 0, 0.55, [[0.0, 0.62], [0.28, 0.66], [0.34, 0.84], [0.3, 0.86], [0.0, 0.8]], { seg: q ? 8 : 12, a0: -Math.PI / 2, a1: Math.PI / 2 });
    // side scrolls
    for (const sx of [-1, 1]) B.lathe(st, sx * 0.68, -0.05, [[0.0, 0.44], [0.12, 0.46], [0.16, 0.7], [0.1, 1.0], [0.0, 1.06]], { seg: 6 });
    // the inscription band over the niche and the date
    signAt(B, 'sign_well', -0.56, 0.56, 2.04, 2.16, 0.36);
    B.push(frame(0, 0, -0.465, -1, 0)); signAt(B, 'sign_well', -0.56, 0.56, 2.04, 2.16, 0.0); B.pop();
    // the dog trough at the foot
    B.box(st, 0, 0.2, 0.75, 0.9, 0.2, 0.36, 0); B.box('shade', 0, 0.305, 0.75, 0.74, 0.01, 0.22, 0);
  }
  B.pop();
}
export { THREE };
