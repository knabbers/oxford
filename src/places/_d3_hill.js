// Headington Hill, c. 2013 — Headington Hill Hall, the Morrells' footbridge over Headington Road and Headington Hill
// Park (districts pass 3; places/headington_hill.js is the module, this file holds it). See docs/research/districts3.md.
//
//   preMap   the hall's mapped outline (w20302777, drawn by the generic renderer as a glass block) is skipped and rebuilt
//            here; the footbridge's mapped path (w20796823) is taken off the map, so the world no longer draws a
//            ground-level railing across Headington Road; an avenue of limes along the park's longest path
//   install  (all in the shared batch-4 atlas draw, _b4_kit.js — no new static draw call)
//            · Headington Hill Hall (John Thomas for James Morrell, 1856-58): pale yellow brick with stone dressings, an
//              ashlar centre bay and a channelled stone porte-cochere on the entrance front, architraved sashes, a
//              cornice with pierced parapet panels, a tiled mansard with dormers and tall ashlar stacks, the lower
//              service wing; a Doric colonnade on the garden front
//            · the footbridge (W. Wilkinson, 1872): two spans on rusticated stone piers, a cast-iron walk and railings,
//              steps up at each end
//            · the park's gates on Headington Road: stone piers, open iron gates, the name board
//            · the open-air theatre on the lawn below the hall: a stage and its flats; chairs and an audience in the
//              evenings (shared clock)
//   do       usher at the open-air Shakespeare: before curtain-up, hand a programme to everyone on the chairs (£3)
//   sights   for the passport (game.headingtonHill.sights)
// Test hooks: game.headingtonHill = { sights, stats(), usher }       tools/smoke_districts3.mjs
import * as THREE from 'three';
import { shared, addSite, RB, frame, h01, DAY_MS } from './_b4_kit.js';
import { faces, faceFrame, offCarriage, offBuildings, pip, centroid } from './_eo_kit.js';
import { obbOf } from './_jer_build.js';
import { boardPost, signAt, lampStandard } from './_d2_kit.js';
import { D3OFF, railRun, lerp2 } from './_d3_kit.js';
import { planter, plantAlong, plantIn } from './_se_trees.js';
import { EASTPASS } from '../world/terrain.js';
import { nearSet, TOURIST_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';
import { hash2 } from '../world/util.js';

// the world picks a mapped tree's species from a hash of its position (_ccm_map.js): a lime is a broad crown, hash < 0.5
const broadAt = (x, z) => { let best = [x, z], bd = Infinity; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const nx = Math.round(x * 10 + i) / 10, nz = Math.round(z * 10 + j) / 10, d = i * i + j * j; if (hash2(Math.round(nx * 10), Math.round(nz * 10)) < 0.5 && d < bd) { bd = d; best = [nx, nz]; } } return best; };

export const IDS = { hall: 'w20302777', bridge: 'w20796823', road: 'w2987926', park: 'w25849166', hallPark: 'w479570981', gateA: [1726.3, 231.4], gateB: [1866.5, 175.4] };
export const BRIDGE = { a: [2087.3, 76.0], b: [2074.0, 52.0], deck: 5.8 };
export const sights = [
  { id: 'd3-hhhall', name: 'Headington Hill Hall', x: 1990, z: -27, blurb: 'The Morrell family\'s Italianate mansion of 1856-58 by John Thomas, the brewers\' house on the hill: pale yellow brick, a stone porte-cochere and a tiled mansard. Oxford Brookes\' since 1992.' },
  { id: 'd3-hhbridge', name: 'The Headington Hill footbridge', x: 2081, z: 64, blurb: 'W. Wilkinson\'s footbridge of 1872 on rusticated stone piers, built so the Morrells could cross from the Hall\'s grounds to their park on the other side without meeting the traffic.' },
  { id: 'd3-hhpark', name: 'Headington Hill Park', x: 1800, z: 63, blurb: 'The Hall\'s grounds, laid out in the 1850s by the curator of the Botanic Garden and a public park since the city bought it in 1953: an avenue of limes, specimen trees and summer theatre on the lawn.' },
];
/** pure: the evening show (shared clock): chairs from SHOW.h0, curtain-up at SHOW.up, over at SHOW.h1; usher before curtain-up */
export const SHOW = { h0: 18.5, up: 19.5, h1: 22, fee: 3, secs: 150 };
const inShow = (h) => h >= SHOW.h0 && h < SHOW.h1;

export default {
  id: 'headington_hill',
  preMap(game) {
    if (D3OFF()) return;
    try {
      const m = game.map; if (!m || m._d3Hill) return;
      game.overrides.skip.add(IDS.hall);
      const i = m.roads.findIndex((r) => r.id === IDS.bridge); if (i >= 0) m.roads.splice(i, 1);
      // the lime avenue: both sides of the park's longest mapped path, every 11 m, clear of roads, paths and buildings
      const park = m.areas.find((a) => a.id === IDS.park), avenue = [];
      if (park) {
        let bestR = null, bestL = 0;
        const inner = (a, b) => { const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2; return pip(x, z, park.poly) && offCarriage(m, x, z, 12); };   // (not the Headington Road pavement)
        for (const r of m.roads) { if (!/^(footway|path|track)$/.test(r.kind) || r.pts.some((p) => Math.abs(p[0] - 1800) > 300)) continue; let L = 0; for (let k = 0; k < r.pts.length - 1; k++) { const a = r.pts[k], b = r.pts[k + 1]; if (inner(a, b)) L += Math.hypot(b[0] - a[0], b[1] - a[1]); } if (L > bestL) { bestL = L; bestR = r; } }
        if (bestR) {
          const pts = bestR.pts; let acc = 0;
          for (let k = 0; k < pts.length - 1; k++) {
            const a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
            if (!inner(a, b) || avenue.length >= 48) { acc += L; continue; }
            for (let s = (11 - acc % 11) % 11; s < L; s += 11) {
              for (const sd of [-1, 1]) {
                const x = a[0] + ux * s - uz * sd * 5, z = a[1] + uz * s + ux * sd * 5;
                if (!pip(x, z, park.poly) || !offBuildings(m, x, z, 3) || !offCarriage(m, x, z, 3) || m.trees.some((t) => Math.abs(t[0] - x) < 4 && Math.abs(t[1] - z) < 4)) continue;
                const [tx, tz] = broadAt(x, z), t = [tx, tz, 15 + h01(x | 0, z | 0) * 4]; m.trees.push(t); avenue.push(t);
              }
            }
            acc += L;
          }
        }
      }
      // photo comparison east (2026-11): Headington Road climbs between wooded banks, Marston Road runs under trees, a
      // lime avenue leads to St Clement's church and the park is an arboretum (places/_se_trees.js; positions a GUESS)
      const planted = { road: 0, marston: 0, church: 0, park: 0 };
      if (EASTPASS) try {
        const P = planter(m, [1560, 2420, -200, 340]);
        const clear = (x, z) => Math.hypot(x - IDS.gateA[0], z - IDS.gateA[1]) > 9 && Math.hypot(x - IDS.gateB[0], z - IDS.gateB[1]) > 9 && Math.hypot(x - BRIDGE.a[0], z - BRIDGE.a[1]) > 11 && Math.hypot(x - BRIDGE.b[0], z - BRIDGE.b[1]) > 11;
        const HR = [[1690, 268], [1818, 207], [1983, 124], [2166, 13], [2227, -26], [2338, -64], [2381, -82]];
        planted.road = plantAlong(P, HR, [-19.5, -12.5, 12.5, 19.5], 8, 13, 23, 11, { where: clear, skip: 0.1 });
        planted.marston = plantAlong(P, [[1600, 268], [1637, 177], [1669, -10], [1676, -180]], [-17, -11, 11.5], 9, 12, 21, 23, { skip: 0.12 });
        planted.church = plantAlong(P, [[1588, 266], [1546, 224]], [-3.6, 3.6], 7, 14, 18, 31, { jitter: 0.3, gap: 3, species: () => 'broad' });
        if (park) planted.park = plantIn(P, park.poly, 17, 0.36, 11, 22, 41, { where: clear, gap: 7 });
      } catch (e) { console.error('[headington_hill] trees', e); }
      Object.defineProperty(m, '_d3Hill', { value: { avenue, planted }, enumerable: false });
    } catch (e) { console.error('[headington_hill] preMap', e); }
  },

  install(game) {
    if (D3OFF()) return null;
    const K = shared(game), me = K.join('headington_hill'), map = game.map, col = game.worldCollider;
    const S = { err: false, hall: null, bridge: null, gates: 0, stage: null, chairs: [] };
    try {
      // ---------------------------------------------------------------- Headington Hill Hall
      const hb = map.buildings.find((b) => b.id === IDS.hall);
      if (hb) {
        const Bq = [0, 1, 2].map((q) => { const B = new RB(); S.hall = hall(B, hb.poly, q); return B; });
        addSite(K, 'd3:hall', [S.hall.c[0], 8, S.hall.c[1]], 32, [150, 340, 900], Bq);
        col.addPolygon(hb.poly);
        if (S.hall.porch) { const p = S.hall.porch; col.addBox(p.x, p.z, p.d, p.w, p.r); }
      }
      // ---------------------------------------------------------------- the footbridge over Headington Road
      {
        const { a, b, deck } = BRIDGE, L0 = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L0, uz = (b[1] - a[1]) / L0, nx = -uz, nz = ux;
        // the carriageway and its pavements along the bridge line (s from a), then the walk's ends and the piers
        let r0 = null, r1 = null; for (let s = -12; s <= L0 + 12; s += 0.25) { const x = a[0] + ux * s, z = a[1] + uz * s; if (!offCarriage(map, x, z, 3.0)) { if (r0 === null) r0 = s; r1 = s; } }
        if (r0 !== null) {
          const sA = Math.min(0, r0 - 1.0), sB = Math.max(L0, r1 + 1.0), sMid = (sB - r1 > 4) ? r1 + 1.0 : r0 - 1.0;
          const piers = [sA, sMid, sB].map((s) => ({ s, p: [a[0] + ux * s, a[1] + uz * s] }));
          const Bq = [new RB(), new RB(), new RB()], hw = 1.25, L = sB - sA;
          for (let q = 0; q < 3; q++) {
            const B = Bq[q];
            B.push(frame(a[0] + ux * sA, 0, a[1] + uz * sA, ux, uz));      // local x along the walk from its a end, local z across
            // rusticated stone piers: banded blocks, a cap, the walk's bearing
            for (const { s: s1 } of piers) {
              const s = s1 - sA, pw = 1.5, pd = hw * 2 + 0.7;
              for (let k = 0; k < (q ? 1 : 6); k++) { const y0 = q ? 0 : k * (deck - 0.95) / 6, y1 = q ? deck - 0.95 : (k + 1) * (deck - 0.95) / 6; B.box(k % 2 ? 'stone' : 'bridge', s, (y0 + y1) / 2, 0, pw - (k % 2 ? 0.06 : 0), y1 - y0, pd - (k % 2 ? 0.06 : 0), 0, { top: false }); }
              B.box('dress', s, deck - 0.85, 0, pw + 0.2, 0.2, pd + 0.2, 0, { bottom: true });
            }
            // (photo comparison east, 2026-11) the stone piers that stand up through the railings over each support and at
            // both ends of the walk: a panelled die, a moulded cap and a ball finial (the 2017 photograph from the deck)
            if (q < 2 && EASTPASS) for (const s1 of piers.map((p) => Math.min(L - 0.4, Math.max(0.4, p.s - sA)))) for (const sd of [-1, 1]) {
              const z = sd * (hw + 0.18), y0 = deck - 0.75;
              B.box('stone', s1, y0 + 1.25, z, 0.74, 2.5, 0.6, 0, { top: false }); B.box('dress', s1, y0 + 2.6, z, 0.96, 0.2, 0.82, 0, { bottom: true });
              B.cyl('dress', s1, y0 + 2.7, z, 0.14, 0.22, 8, false, 0.2);
              if (q === 0) { B.cyl('dress', s1, y0 + 2.92, z, 0.31, 0.24, 8, false, 0.14); B.cyl('dress', s1, y0 + 3.16, z, 0.1, 0.26, 8, true, 0.31); }
              else B.cyl('dress', s1, y0 + 2.92, z, 0.2, 0.46, 6, true, 0.26);
            }
            // the cast-iron walk: plate girders on both edges (dark green paint, lattice panels), the deck between
            for (const sd of [-1, 1]) {
              B.poly('latticeDk', [[0, deck - 0.75, sd * hw], [L, deck - 0.75, sd * hw], [L, deck + 0.12, sd * hw], [0, deck + 0.12, sd * hw]], [0, 0, sd], [[0, 0], [L, 0], [L, 1], [0, 1]]);
              B.poly('bridgeGreen', [[0, deck - 0.75, sd * (hw - 0.12)], [L, deck - 0.75, sd * (hw - 0.12)], [L, deck + 0.12, sd * (hw - 0.12)], [0, deck + 0.12, sd * (hw - 0.12)]], [0, 0, -sd]);
              B.box('bridgeGreen', L / 2, deck + 0.16, sd * (hw - 0.06), L, 0.08, 0.2, 0, { bottom: true });
            }
            B.poly('deck', [[0, deck, -hw + 0.12], [L, deck, -hw + 0.12], [L, deck, hw - 0.12], [0, deck, hw - 0.12]], [0, 1, 0]);
            B.poly('bridgeGreen', [[0, deck - 0.75, -hw], [L, deck - 0.75, -hw], [L, deck - 0.75, hw], [0, deck - 0.75, hw]], [0, -1, 0]);
            B.pop();
            const A2 = [a[0] + ux * sA, a[1] + uz * sA], C2 = [a[0] + ux * sB, a[1] + uz * sB];
            for (const sd of [-1, 1]) railRun(B, [A2[0] + nx * sd * (hw - 0.06), A2[1] + nz * sd * (hw - 0.06)], [C2[0] + nx * sd * (hw - 0.06), C2[1] + nz * sd * (hw - 0.06)], deck + 0.2, 1.0, q, 'bridgeGreen', 0.14);
            // the steps down at both ends, away from the road: stone flights with side walls
            for (const [e, s0] of [[-1, sA], [1, sB]]) {
              const run = 9.6, n = 30, rise = deck / n;
              B.push(frame(a[0] + ux * s0, 0, a[1] + uz * s0, ux * e, uz * e));   // local x outward along the axis
              if (q === 0) for (let k = 0; k < n; k++) B.box('bridgeDk', 0.4 + (k + 0.5) * run / n, deck - rise * (k + 0.5), 0, run / n, rise, hw * 2 - 0.3, 0, { top: true });
              else B.poly('bridgeDk', [[0.4, deck, -hw + 0.15], [0.4 + run, 0.02, -hw + 0.15], [0.4 + run, 0.02, hw - 0.15], [0.4, deck, hw - 0.15]], [0.5, 1, 0]);
              B.poly('bridgeDk', [[0.0, deck, -hw + 0.15], [0.4, deck, -hw + 0.15], [0.4, deck, hw - 0.15], [0.0, deck, hw - 0.15]], [0, 1, 0]);
              for (const sd of [-1, 1]) B.poly('stone', [[0.0, 0, sd * hw], [0.4 + run, 0, sd * hw], [0.4 + run, 0.9, sd * hw], [0.4, deck + 0.9, sd * hw], [0.0, deck + 0.9, sd * hw]], [0, 0, sd]);
              for (const sd of [-1, 1]) B.poly('stone', [[0.0, deck, sd * (hw - 0.15)], [0.4 + run, 0, sd * (hw - 0.15)], [0.4 + run, 0.9, sd * (hw - 0.15)], [0.4, deck + 0.9, sd * (hw - 0.15)], [0.0, deck + 0.9, sd * (hw - 0.15)]], [0, 0, -sd]);
              for (const sd of [-1, 1]) { const len = Math.hypot(run, deck); B.poly('dress', [[0.4, deck + 0.9, sd * (hw - 0.15)], [0.4 + run, 0.9, sd * (hw - 0.15)], [0.4 + run, 0.9, sd * hw], [0.4, deck + 0.9, sd * hw]], [0, 1, 0], [[0, 0], [len, 0], [len, 0.15], [0, 0.15]]); }
              B.pop();
            }
          }
          const m = [a[0] + ux * (sA + sB) / 2, a[1] + uz * (sA + sB) / 2];
          addSite(K, 'd3:hhbridge', [m[0], deck / 2, m[1]], L / 2 + 12, [140, 320, 800], Bq);
          // ---- walkable: the collider's standable tops (core/collision.js topAt, as car roofs and low walls use)
          //   piers: solid from the ground, their caps a floor from above
          //   steps: a grid of small standable circles per tread (solid from the ground beside the flight), stone side walls;
          //          a passage up the middle of each flight is on while you are on it, so the next tread up never blocks
          //          you and you walk up and down the steps
          //   deck: standable circles and the two railings, on only while you are up there (they would otherwise wall
          //         off the road underneath); everything 'low', so traffic ignores it
          const P2 = (s, t) => [a[0] + ux * s + nx * t, a[1] + uz * s + nz * t], R0 = Math.atan2(ux, uz), run = 9.6, n = 30, rise = deck / n;
          for (const { p } of piers) col.addBox(p[0], p[1], hw * 2 + 0.7, 1.5, R0, { top: deck - 0.75 });
          const deckShapes = [], flights = [], own = new Set();
          for (let s = sA - 0.2; s <= sB + 0.2; s += 0.5) for (const t of [-0.8, -0.4, 0, 0.4, 0.8]) { const [x, z] = P2(s, t); deckShapes.push(col.addCircle(x, z, 0.3, { top: deck, low: true, floor: true })); }
          for (const sd of [-1, 1]) deckShapes.push(...col.addPolyline([P2(sA - 0.4, sd * (hw - 0.06)), P2(sB + 0.4, sd * (hw - 0.06))], { tag: 'railing', low: true }));
          for (const sh of deckShapes) sh.on = false;
          for (const [e, s0] of [[-1, sA], [1, sB]]) {
            for (let k = 0; k < n; k++) { const s = s0 + e * (0.4 + (k + 0.5) * run / n), top = deck - rise * k; for (const t of [-0.8, -0.4, 0, 0.4, 0.8]) { const [x, z] = P2(s, t); col.addCircle(x, z, 0.1, { top, low: true }); } }
            for (const sd of [-1, 1]) for (const w of col.addPolyline([P2(s0 + e * 0.3, sd * (hw - 0.15)), P2(s0 + e * (0.4 + run), sd * (hw - 0.15))], { tag: 'wall' })) own.add(w);
            const b0 = P2(s0 + e * (0.4 + run + 0.4), 0), t0 = P2(s0 - e * 0.6, 0);
            const pass = col.addPassage(b0[0], b0[1], t0[0], t0[1], 1.5); pass.on = false;
            flights.push({ pass, s0, e });
          }
          for (const sh of deckShapes) own.add(sh);
          S.walk = { deckShapes, flights, P2, sA, sB, run, deck, ux, uz, a, hw, own, under: null, off: [] };
          S.bridge = { piers: piers.map((q) => q.p), r0, r1, sA, sB, deck, stairs: [[a[0] + ux * (sA - 5.2), a[1] + uz * (sA - 5.2)], [a[0] + ux * (sB + 5.2), a[1] + uz * (sB + 5.2)]] };
          // nothing of the world's under the walk: no street lamp head coming up through the girders, no tree
          try { const Q = (s, t) => [a[0] + ux * s + nx * t, a[1] + uz * s + nz * t]; game.world.clearArea([Q(sA - 11, -2), Q(sB + 11, -2), Q(sB + 11, 2), Q(sA - 11, 2)], { trees: true, lamps: true, furniture: false }); } catch { /* */ }
        }
      }
      // ---------------------------------------------------------------- the park gates on Headington Road
      {
        const Bg = [new RB(), new RB(), new RB()], park = map.areas.find((a) => a.id === IDS.park);
        const [pcx, pcz] = park ? centroid(park.poly) : [1800, 60];
        for (const [gx0, gz0] of [IDS.gateA, IDS.gateB]) {
          let gx = gx0, gz = gz0;
          // the way in: towards the park's middle; the piers either side of the opening
          // the way in: along the mapped drive / path through the gate if there is one, else towards the park's middle
          let ix = pcx - gx, iz = pcz - gz, half = 1.7, bd = 3;
          for (const r of map.roads) { if (!/^(service|footway|path)$/.test(r.kind)) continue; for (let i = 0; i < r.pts.length - 1; i++) { const p = r.pts[i], q2 = r.pts[i + 1], d = segD(gx0, gz0, p, q2); if (d < bd && !(r.kind === 'footway' && Math.abs((q2[0] - p[0]) * (pcx - gx) + (q2[1] - p[1]) * (pcz - gz)) / (Math.hypot(q2[0] - p[0], q2[1] - p[1]) * Math.hypot(pcx - gx, pcz - gz)) < 0.5)) { bd = d; ix = q2[0] - p[0]; iz = q2[1] - p[1]; if (ix * (pcx - gx) + iz * (pcz - gz) < 0) { ix = -ix; iz = -iz; } half = (r.w || 2.2) / 2 + 0.7; } } }
          { const l = Math.hypot(ix, iz); ix /= l; iz /= l; }
          const ax = -iz, az = ix;
          // the mapped gate node can sit on the pavement's edge: step in along the way until both piers stand clear
          const clear = (x, z) => offCarriage(map, x, z, 0.4) && offBuildings(map, x, z, 0.4);
          let ps = null; for (let k = 0; k <= 12 && !ps; k++) for (const lat of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) { if (ps) break; const cx = gx0 + ix * k + ax * lat, cz = gz0 + iz * k + az * lat, two = [-1, 1].map((sd) => [cx + ax * sd * half, cz + az * sd * half]); if (two.every(([x, z]) => clear(x, z))) { ps = two; gx = cx; gz = cz; } }
          if (!ps) continue;
          for (let q = 0; q < 3; q++) {
            const B = Bg[q];
            for (const [x, z] of ps) {
              B.box('bridge', x, 1.15, z, 0.7, 2.3, 0.7, Math.atan2(ix, iz), { top: false });
              B.box('dress', x, 2.38, z, 0.86, 0.16, 0.86, Math.atan2(ix, iz), { bottom: true });
              if (q < 2) B.lathe('dress', x, z, [[0.2, 2.46], [0.24, 2.58], [0.24, 2.66], [0.14, 2.78], [0.0, 2.8]], { seg: q ? 6 : 10 });
            }
            // the gates stand open inwards against the piers
            if (q < 2) for (const [sd, [x, z]] of [[-1, ps[0]], [1, ps[1]]]) {
              const open = [x + ix * (half - 0.2), z + iz * (half - 0.2)], hinge = [x + ix * 0.4, z + iz * 0.4];
              const gk = EASTPASS ? 'boatBlue' : 'iron', gh = EASTPASS ? 2.3 : 1.6;     // (photo comparison east: tall dark-blue gates, a lantern on each pier)
              railRun(B, hinge, open, 0.05, gh, q, gk, 0.13);
              B.beam(gk, [hinge[0], 0, hinge[1]], [hinge[0], gh + 0.1, hinge[1]], 0.06); B.beam(gk, [open[0], 0.05, open[1]], [open[0], gh + 0.1, open[1]], 0.05);
              if (EASTPASS) { B.beam('iron', [x, 2.8, z], [x, 3.25, z], 0.035); B.box('bulb', x, 3.45, z, 0.26, 0.36, 0.26, 0); B.box('iron', x, 3.67, z, 0.34, 0.08, 0.34, 0); }
              void sd;
            }
          }
          // the name board just inside, to one side of the way
          const bx = gx + ix * 3 + ax * (half + 1.6), bz = gz + iz * 3 + az * (half + 1.6);
          if (offCarriage(map, bx, bz, 1) && offBuildings(map, bx, bz, 1)) { boardPost(Bg[0], bx, bz, -ix, -iz, 'sign_hhPark', 2.2, 1.5, 0); boardPost(Bg[1], bx, bz, -ix, -iz, 'sign_hhPark', 2.2, 1.5, 1); col.addCircle(bx, bz, 0.3); }
          for (const [x, z] of ps) col.addBox(x, z, 0.7, 0.7, Math.atan2(ix, iz));
          S.gates++;
        }
        if (S.gates) addSite(K, 'd3:hhgates', [(IDS.gateA[0] + IDS.gateB[0]) / 2, 1.2, (IDS.gateA[1] + IDS.gateB[1]) / 2], 80, [90, 200, 420], Bg);
      }
      // ---------------------------------------------------------------- the open-air theatre on the lawn below the hall
      {
        const lawn = map.areas.find((a) => a.id === IDS.hallPark);
        let st = null;
        if (lawn) {
          const [lx, lz] = centroid(lawn.poly);
          const segs = []; for (const r of map.roads) if (/^(footway|path|steps|service)$/.test(r.kind)) for (let i = 0; i < r.pts.length - 1; i++) { const p = r.pts[i], q2 = r.pts[i + 1]; if (Math.min(p[0], q2[0]) < lx + 70 && Math.max(p[0], q2[0]) > lx - 70 && Math.min(p[1], q2[1]) < lz + 70 && Math.max(p[1], q2[1]) > lz - 70) segs.push([p, q2]); }
          const trees = map.trees.filter((t) => Math.abs(t[0] - lx) < 70 && Math.abs(t[1] - lz) < 70);
          const near = { buildings: map.buildings.filter((b) => !b.part && Math.abs(b.c[0] - lx) < 110 && Math.abs(b.c[1] - lz) < 110), roads: map.roads.filter((r) => r.pts.some((p) => Math.abs(p[0] - lx) < 130 && Math.abs(p[1] - lz) < 130)) };
          const ok = (x, z) => pip(x, z, lawn.poly) && !segs.some(([p, q2]) => segD(x, z, p, q2) < 2.4) && !trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < 3) && offBuildings(near, x, z, 3) && offCarriage(near, x, z, 3) && !col.isWater(x, z);
          let bd = Infinity;
          for (let x = lx - 40; x <= lx + 40; x += 2) for (let z = lz - 40; z <= lz + 40; z += 2) {
            // the stage and the seats in front of it (towards +z, down the lawn), all on clear grass
            if (![[0, 0], [4, 0], [-4, 0], [0, 6], [5, 9], [-5, 9], [0, 12], [5, 12], [-5, 12], [0, -3]].every(([dx, dz]) => ok(x + dx, z + dz))) continue;
            const d = Math.hypot(x - lx, z - lz); if (d < bd) { bd = d; st = [x, z]; }
          }
        }
        if (st) {
          const [sx, sz] = st, Bs = [new RB(), new RB(), new RB()], Bc = [new RB(), new RB()];
          for (let q = 0; q < 3; q++) {
            const B = Bs[q];
            // the stage faces +z: a timber platform, steps, painted flats behind, two lamp stands
            // a black-skirted timber deck, boards on top, two treads at one corner
            B.box('dark', sx, 0.3, sz, 8.0, 0.6, 4.6, 0, { top: false });
            B.poly('planks', [[sx - 4, 0.6, sz - 2.3], [sx + 4, 0.6, sz - 2.3], [sx + 4, 0.6, sz + 2.3], [sx - 4, 0.6, sz + 2.3]], [0, 1, 0]);
            if (q < 2) for (let k = 0; k < 2; k++) B.box('planks', sx + 3.2, 0.1 + k * 0.2, sz + 2.6 + (1 - k) * 0.3, 1.2, 0.2 * (k + 1), 0.3, 0);
            // the painted flats on a timber frame (the back of the canvas is plain), braced behind
            B.unit('flats', [[sx - 3.6, 0.6], [sx + 3.6, 0.6], [sx + 3.6, 4.4], [sx - 3.6, 4.4]], sz - 1.95, [0, 0]);
            B.poly('canvas', [[sx + 3.6, 0.6, sz - 2.05], [sx - 3.6, 0.6, sz - 2.05], [sx - 3.6, 4.4, sz - 2.05], [sx + 3.6, 4.4, sz - 2.05]], [0, 0, -1]);
            for (const e of [-3.7, 0, 3.7]) { B.box('oak', sx + e, 2.5, sz - 2.0, 0.12, 3.9, 0.14, 0); if (q < 2) B.beam('oak', [sx + e, 3.6, sz - 2.07], [sx + e, 0.6, sz - 3.4 + 1.2], 0.08); }
            B.box('oak', sx, 4.5, sz - 2.0, 7.6, 0.14, 0.14, 0);
            // the wings: cloth in folds either side, angled in; a pelmet on a truss over the front
            for (const e of [-1, 1]) { const x0 = sx + e * 3.8, x1 = sx + e * 4.3; for (const sd of [1, -1]) B.poly('folds', [[x0, 0.6, sz - 1.8], [x1, 0.6, sz - 0.4], [x1, 4.3, sz - 0.4], [x0, 4.3, sz - 1.8]], [-e * 0.9 * sd, 0, 0.35 * sd], [[0, 0], [1.5, 0], [1.5, 1], [0, 1]]); }
            for (const e of [-4.4, 4.4]) B.beam('iron', [sx + e, 0, sz + 2.1], [sx + e, 4.9, sz + 2.1], 0.09);
            B.beam('iron', [sx - 4.4, 4.9, sz + 2.1], [sx + 4.4, 4.9, sz + 2.1], 0.12);
            if (q < 2) for (const sd of [1, -1]) B.poly('folds', [[sx - 4.3, 4.2, sz + 2.1 + sd * 0.08], [sx + 4.3, 4.2, sz + 2.1 + sd * 0.08], [sx + 4.3, 4.85, sz + 2.1 + sd * 0.08], [sx - 4.3, 4.85, sz + 2.1 + sd * 0.08]], [0, 0, sd], [[0, 0], [8.6, 0], [8.6, 1], [0, 1]]);
            for (const e of [-5.0, 5.0]) lampStandard(B, sx + e, 0, sz + 2.0, 3.6, q, e > 0 ? 21 : 26);
          }
          // the chairs: three rows of five folding chairs, out only in the evenings
          for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {
            const x = sx - 4 + k * 2.0 + (r % 2) * 0.5, z = sz + 7 + r * 2.0;
            for (let q = 0; q < 2; q++) { const B = Bc[q]; B.box('chairGreen', x, 0.45, z, 0.48, 0.05, 0.45, 0); B.box('chairGreen', x, 0.75, z + 0.22, 0.48, 0.5, 0.04, 0); if (q === 0) for (const [dx, dz] of [[-0.21, -0.2], [0.21, -0.2], [-0.21, 0.2], [0.21, 0.2]]) B.beam('iron', [x + dx, 0, z + dz], [x + dx, 0.45, z + dz], 0.025); }
            S.chairs.push([x, z]);
          }
          // the board by the lawn: tonight's play
          const bx = sx + 6.5, bz = sz + 4;
          for (let q = 0; q < 2; q++) boardPost(Bs[q], bx, bz, 0, 1, 'sign_play', 2.6, 1.3, q);
          addSite(K, 'd3:stage', [sx, 2, sz], 8, [100, 240, 480], Bs);
          addSite(K, 'd3:chairs', [sx, 0.5, sz + 9], 7, [80, 160, 0.01], [Bc[0], Bc[1], null], { need: () => inShow(game.time.hour), farArea: 99 });
          col.addBox(sx, sz, 4.6, 8.0, 0); col.addBox(sx, sz - 2.1, 0.12, 7.6, 0); col.addCircle(bx, bz, 0.3);
          S.stage = { x: sx, z: sz, board: [bx, bz] };
        }
      }
      K.boxes.push([1700, 2120, -70, 250]);
    } catch (e) { console.error('[headington_hill] build', e); } finally { K.joined(me); }

    // ---------------------------------------------------------------- the audience (evenings, near only)
    let audience = null;
    const seated = S.chairs.filter((_, i) => h01(i, 71) < 0.6).slice(0, 7);
    try {
      if (S.stage && seated.length) audience = nearSet(game, { c: [S.stage.x, S.stage.z], r: 80, h0: SHOW.h0 + 0.25, h1: SHOW.h1, people: seated.map(([x, z], i) => ({ x, z: z - 0.05, h: Math.PI, look: randomLook('d3-audience-' + i, { outfit: i % 3 ? 'casual' : 'tweed' }), pose: 'sit', lines: i === 0 ? TOURIST_LINES : null })) });
    } catch (e) { console.warn('[headington_hill] people', e); }

    // ---------------------------------------------------------------- usher: programmes to everyone on the chairs
    const U = { on: null, done: 0 };
    const flags = () => game.state.flags || (game.state.flags = {});
    if (S.stage && seated.length) {
      game.interact.add({ pos: S.stage.board, radius: 2.4, label: () => { const h = game.time.hour; return U.on ? 'Programmes: keep going!' : h >= SHOW.h0 + 0.25 && h < SHOW.up ? 'Help usher (hand out programmes)' : h >= SHOW.up && h < SHOW.h1 ? 'The play has started. Shh.' : 'Open-air Shakespeare: tonight at 7.30'; }, enabled: () => !U.on, onUse: () => {
        const h = game.time.hour;
        if (!(h >= SHOW.h0 + 0.25 && h < SHOW.up)) { game.ui.toast(h >= SHOW.up && h < SHOW.h1 ? 'Someone in a ruff glares at you from the stage. The play has started.' : 'Open-air Shakespeare on the lawn, every evening at 7.30. Ushers wanted from about 6.45.', 4.5); return; }
        if (flags().usherDay === Math.floor(game.time.now() / DAY_MS)) { game.ui.toast('"You did the programmes already, darling. Go and sit down."', 3.5); return; }
        U.on = { t0: game.time.now(), left: seated.map((_, i) => i) };
        game.ui.toast(`A frazzled stage manager hands you a stack of programmes. "One each, ${seated.length} people, before curtain-up. Go go go."`, 5);
      } });
      seated.forEach(([x, z], i) => game.interact.add({ pos: [x, z - 0.9], radius: 1.6, label: 'Hand over a programme', enabled: () => !!U.on && U.on.left.includes(i), onUse: () => {
        const st = U.on; st.left = st.left.filter((k) => k !== i);
        if (!st.left.length) { U.on = null; U.done++; game.pay(SHOW.fee); const fl = flags(); fl.usherDay = Math.floor(game.time.now() / DAY_MS); fl.usher = (fl.usher || 0) + 1; try { game.save(); } catch { /* */ } game.ui.toast(`Every seat has a programme. The stage manager presses £${SHOW.fee} and a slightly squashed choc ice on you. "Exit, pursued by applause."`, 6); }
        else game.ui.toast(['"Ooh, lovely."', '"Is it the one with the bear?"', '"Thank you, dear."', '"Do you know how long the first half is?"'][i % 4] + ` (${st.left.length} to go)`, 2.5);
      } }));
      U.tick = () => { if (!U.on) return; const h = game.time.hour; if (h >= SHOW.up || (game.time.now() - U.on.t0) / 1000 > SHOW.secs) { U.on = null; game.ui.toast('The house lights (a man with a torch) go down. The rest will have to share.', 4.5); } };
    }

    game.headingtonHill = {
      sights, walk: S.walk, usher: { state: () => U.on, done: () => U.done, seated: () => seated },
      stats() { return { hall: !!S.hall, porch: !!(S.hall && S.hall.porch), bridge: S.bridge, gates: S.gates, stage: S.stage, chairs: S.chairs.length, avenue: ((map._d3Hill || {}).avenue || []).length, people: audience ? audience.count() : 0 }; },
    };
    // the footbridge's walkable shapes follow the player (see the bridge above)
    // the collider's shapes (not the bridge's own, none with a top) that cross the walk's strip, end to end
    const underDeck = (Wk) => {
      const out = [], A = Wk.P2(Wk.sA - 0.6, 0), C = Wk.P2(Wk.sB + 0.6, 0), m = Wk.hw + 0.6, s0 = Wk.sA - 0.6, s1 = Wk.sB + 0.6;
      const st = (x, z) => { const dx = x - Wk.a[0], dz = z - Wk.a[1]; return [dx * Wk.ux + dz * Wk.uz, -dx * Wk.uz + dz * Wk.ux]; };
      const inR = ([q, t], e = 0) => q > s0 - e && q < s1 + e && Math.abs(t) < m + e;
      game.worldCollider._near(Math.min(A[0], C[0]) - m, Math.min(A[1], C[1]) - m, Math.max(A[0], C[0]) + m, Math.max(A[1], C[1]) + m, (q) => {
        if (Wk.own.has(q) || q.top !== undefined) return;
        if (!q.seg) { if (inR(st(q.x, q.z), q.r)) out.push(q); return; }
        // (a wall segment: the part of it within the strip's width, then whether that part overlaps the strip's length)
        const [sa, ta] = st(q.x1, q.z1), [sb, tb] = st(q.x2, q.z2);
        let lo = 0, hi = 1;
        if (Math.abs(tb - ta) < 1e-9) { if (Math.abs(ta) >= m) return; } else { const u1 = (-m - ta) / (tb - ta), u2 = (m - ta) / (tb - ta); lo = Math.max(0, Math.min(u1, u2)); hi = Math.min(1, Math.max(u1, u2)); if (lo > hi) return; }
        const p1 = sa + (sb - sa) * lo, p2 = sa + (sb - sa) * hi;
        if (Math.max(Math.min(p1, p2), s0) < Math.min(Math.max(p1, p2), s1)) out.push(q);
      });
      return out;
    };
    const walkTick = () => {
      const Wk = S.walk; if (!Wk) return;
      const p = game.player, out = p.place === 'world', dx = p.pos.x - Wk.a[0], dz = p.pos.z - Wk.a[1], s = dx * Wk.ux + dz * Wk.uz, t = -dx * Wk.uz + dz * Wk.ux;
      const near = out && s > Wk.sA - 14 && s < Wk.sB + 14 && Math.abs(t) < 6, feet = near ? p.pos.y - (game.groundHeight ? game.groundHeight(p.pos.x, p.pos.z) : 0) : 0;
      const up = near && feet > 1.0;
      if (up !== Wk.up) {
        Wk.up = up; for (const sh of Wk.deckShapes) sh.on = up;
        // the world's walls and fences that run under the walk (the stone walls along Headington Road) have no top: up
        // on the deck they pushed you sideways off it (and down you fell, halfway across). Off while you are up there
        // (found the first time: every module's colliders exist by then), back on when you come down.
        if (up) { if (!Wk.under) Wk.under = underDeck(Wk); Wk.off = Wk.under.filter((q) => q.on); for (const q of Wk.off) q.on = false; }
        else { for (const q of Wk.off) q.on = true; Wk.off = []; }
      }
      for (const f of Wk.flights) { const ls = (s - f.s0) * f.e, on = near && Math.abs(t) < 1.2 && ((ls > -0.8 && ls < Wk.run + 1.2) || feet > 0.1); if (on !== f.pass.on) f.pass.on = on; }
    };
    return { update() { try { K.tick(me); if (audience) audience.tick(); if (U.tick) U.tick(); walkTick(); } catch (e) { if (!S.err) { S.err = true; console.error('[headington_hill]', e); } } } };
  },
};

function segD(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); }

/**
 * Headington Hill Hall on its mapped outline. K (Historic England 1047044): pale yellow brick with stone dressings, an
 * ashlar centre bay to the entrance front, a channelled stone porte-cochere with round arches and a Doric entablature,
 * architraved sashes, a parapet with pierced shaped openings, a tiled mansard with segmental dormers and tall ashlar
 * stacks, a lower recessed two-storey service wing to the right; a Doric colonnade on the garden front.
 * G: which face is which (entrance east, garden south, the wing the map's northern tail), every height and bay.
 */
function hall(B, poly, q) {
  const main = poly.filter((p) => p[1] > -22), wing = poly.filter((p) => p[1] < -18);
  const OM = obbOf(main), OW = obbOf(wing), eaves = 10.4, wEaves = 7.6;
  const inMain = (x, z) => { const dx = x - OM.c[0], dz = z - OM.c[1]; return Math.abs(dx * OM.ux + dz * OM.uz) < OM.L + 0.6 && Math.abs(-dx * OM.uz + dz * OM.ux) < OM.W + 0.6; };
  let porch = null, garden = null;
  for (const f of faces(poly)) {
    const main1 = inMain(f.a[0], f.a[1]) && inMain(f.b[0], f.b[1]), H = main1 ? eaves : wEaves, yo = ((f.i | 0) % 3) * 0.011;   // (bands of neighbouring faces never share a plane)
    B.push(faceFrame(f));
    B.poly(q ? 'buffBrickDk' : 'buffBrick', [[-f.L / 2, 0, 0], [f.L / 2, 0, 0], [f.L / 2, H, 0], [-f.L / 2, H, 0]], [0, 0, 1], [[0, 0], [f.L, 0], [f.L, H], [0, H]]);
    // a plinth, the first-floor band and the cornice (stone)
    if (q < 2) { B.box('dress', 0, 0.35 + yo, 0.04, f.L + 0.08, 0.7, 0.08, 0, { bottom: false }); B.box('dress', 0, 4.9 + yo, 0.05, f.L + 0.1, 0.22, 0.1, 0, { bottom: true }); }
    B.box('dress', 0, H + 0.2 + yo, 0.15, f.L + 0.3, 0.4, 0.3, 0, { bottom: true });
    // windows: architraved sashes in bays of ~3.4 m, two storeys (an attic in the mansard)
    if (q < 2 && f.L > 2.6) {
      const n = Math.max(1, Math.floor(f.L / 3.4)), bw = f.L / n;
      for (let k = 0; k < n; k++) {
        const x = -f.L / 2 + bw * (k + 0.5);
        for (const [y0, y1, j] of [[1.3, 3.9, 0], [5.6, 8.0, 1]]) {
          if (!main1 && j === 1 && y1 > wEaves - 0.6) continue;
          B.unit('sash', [[x - 0.62, y0], [x + 0.62, y0], [x + 0.62, y1], [x - 0.62, y1]], 0.03, [(k * 7 + j * 3 + (f.i | 0) * 11) % 40 + 5, 0]);
          if (q === 0) { B.box('dress', x, y1 + 0.18, 0.07, 1.6, 0.26, 0.14, 0, { bottom: true }); B.box('dress', x, y0 - 0.08, 0.08, 1.5, 0.12, 0.16, 0, { bottom: true }); for (const sx of [-0.72, 0.72]) B.box('dress', x + sx, (y0 + y1) / 2, 0.05, 0.16, y1 - y0, 0.1, 0); }
        }
      }
    }
    // the pierced parapet panels over the main block's cornice
    if (main1 && q < 2) { B.poly('pierced', [[-f.L / 2 + 0.2, H + 0.4, 0.12], [f.L / 2 - 0.2, H + 0.4, 0.12], [f.L / 2 - 0.2, H + 1.15, 0.12], [-f.L / 2 + 0.2, H + 1.15, 0.12]], [0, 0, 1], [[0, 0], [f.L - 0.4, 0], [f.L - 0.4, 1], [0, 1]]); B.poly('dress', [[f.L / 2 - 0.2, H + 0.4, -0.08], [-f.L / 2 + 0.2, H + 0.4, -0.08], [-f.L / 2 + 0.2, H + 1.15, -0.08], [f.L / 2 - 0.2, H + 1.15, -0.08]], [0, 0, -1]); B.box('dress', 0, H + 1.2, 0.02, f.L - 0.3, 0.1, 0.32, 0, { bottom: false }); }
    B.pop();
    if (main1 && f.L > 15) { if (f.nx > 0.7) porch = f; if (f.nz > 0.7) garden = f; }
  }
  // the roofs: the main block's tiled mansard (steep lower slope, low top), the wing's hipped slate
  const roof = (O, y0, h1, inset, key, top) => {
    const { c, ux, uz } = O, L = O.L + 0.15, W = O.W + 0.15, nx = -uz, nz = ux;
    const P = (s, t, y) => [c[0] + ux * s + nx * t, y, c[1] + uz * s + nz * t];
    const lo = [P(-L, -W, y0), P(L, -W, y0), P(L, W, y0), P(-L, W, y0)], hi = [P(-L + inset, -W + inset, y0 + h1), P(L - inset, -W + inset, y0 + h1), P(L - inset, W - inset, y0 + h1), P(-L + inset, W - inset, y0 + h1)];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, mx = (lo[i][0] + lo[j][0]) / 2 - c[0], mz = (lo[i][2] + lo[j][2]) / 2 - c[1]; B.poly(key, [lo[i], lo[j], hi[j], hi[i]], [mx, inset * 0.6, mz]); }
    if (top) B.poly(top, hi, [0, 1, 0]);
    return { P, L, W, hi };
  };
  const R = roof(OM, eaves + 0.4, 3.0, 1.5, 'mansard', null);
  const R2 = roof({ ...OM, L: OM.L - 1.5, W: OM.W - 1.5 }, eaves + 3.4, 0.8, Math.min(OM.L, OM.W) - 1.6, 'slate', 'lead');
  void R2;
  roof(OW, wEaves + 0.4, 2.2, Math.min(OW.W, 3.2), 'slate', 'lead');
  // segmental dormers in the mansard (q < 2) and the tall ashlar stacks
  if (q < 2) {
    const { c, ux, uz } = OM, nx = -uz, nz = ux;
    // the four sides: [along x, along z, half-length, outward x, outward z, distance out]
    for (const [ax, az, half, ox, oz, dist] of [[ux, uz, OM.L, nx, nz, OM.W], [ux, uz, OM.L, -nx, -nz, OM.W], [nx, nz, OM.W, ux, uz, OM.L], [nx, nz, OM.W, -ux, -uz, OM.L]]) {
      const n = Math.max(1, Math.floor(half * 2 / 4.2));
      for (let k = 0; k < n; k++) {
        const s = -half + (k + 0.5) * (half * 2 / n), d = dist + 0.15 - 0.75, x = c[0] + ax * s + ox * d, z = c[1] + az * s + oz * d, y = eaves + 0.4 + 0.75;
        B.push(frame(x, y, z, oz, -ox));                                // local +z = outward
        B.box('dress', 0, 0.75, -0.2, 1.4, 1.5, 0.9, 0, { top: false });
        B.unit('sash', [[-0.45, 0.15], [0.45, 0.15], [0.45, 1.35], [-0.45, 1.35]], 0.272, [(k * 5 + 31) % 40 + 5, 0]);
        for (let i = 0; i < 6; i++) { const a0 = Math.PI * i / 6, a1 = Math.PI * (i + 1) / 6; B.poly('dress', [[0, 1.5, 0.25], [Math.cos(a0) * 0.7, 1.5 + Math.sin(a0) * 0.3, 0.25], [Math.cos(a1) * 0.7, 1.5 + Math.sin(a1) * 0.3, 0.25]], [0, 0, 1]); B.poly('mansard', [[Math.cos(a0) * 0.7, 1.5 + Math.sin(a0) * 0.3, 0.25], [Math.cos(a1) * 0.7, 1.5 + Math.sin(a1) * 0.3, 0.25], [Math.cos(a1) * 0.7, 1.5 + Math.sin(a1) * 0.3, -0.65], [Math.cos(a0) * 0.7, 1.5 + Math.sin(a0) * 0.3, -0.65]], [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]); }
        B.pop();
      }
    }
  }
  { const { c, ux, uz } = OM, nx = -uz, nz = ux;
    for (const [s, t] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) { const x = c[0] + ux * s * OM.L + nx * t * OM.W, z = c[1] + uz * s * OM.L + nz * t * OM.W; B.box('stone', x, eaves + 3.5, z, 1.0, 3.6, 2.2, Math.atan2(ux, uz), { top: true }); if (q < 2) B.box('dress', x, eaves + 5.35, z, 1.2, 0.2, 2.4, Math.atan2(ux, uz), { bottom: true }); if (q === 0) for (const o of [-0.6, 0, 0.6]) B.cyl('pot', x + ux * o, eaves + 5.45, z + uz * o, 0.14, 0.5, 6, true); } }
  // the entrance front: ashlar centre bay and the porte-cochere
  let out = null;
  if (porch) {
    const f = porch, w = 6.4, d = 4.6, hh = 5.2;
    B.push(faceFrame(f));
    B.poly('stone', [[-w / 2 - 0.6, 0.71, 0.06], [w / 2 + 0.6, 0.71, 0.06], [w / 2 + 0.6, eaves, 0.06], [-w / 2 - 0.6, eaves, 0.06]], [0, 0, 1], [[0, 0.71], [w + 1.2, 0.71], [w + 1.2, eaves], [0, eaves]]);
    // four channelled piers and arch screens on the three open sides, a Doric entablature, a pierced parapet
    for (const [px, pz] of [[-w / 2, 0.6], [w / 2, 0.6], [-w / 2, d], [w / 2, d]]) for (let k = 0; k < (q ? 1 : 5); k++) { const y0 = q ? 0 : k * hh / 5, y1 = q ? hh : (k + 1) * hh / 5; B.box(k % 2 ? 'stone' : 'bridge', px, (y0 + y1) / 2, pz, 1.0 - (k % 2) * 0.05, y1 - y0, 1.0 - (k % 2) * 0.05, 0, { top: k === 4 || q > 0 }); }
    if (q < 2) {
      for (const [ox, oz, ax, az, span] of [[0, d, 1, 0, w - 1.0], [-w / 2, (d + 0.6) / 2, 0, -1, d - 1.6], [w / 2, (d + 0.6) / 2, 0, 1, d - 1.6]]) {
        // the screen over each arch: spandrel strips between the semicircle and the entablature, both faces
        B.push(frame(ox, 0, oz, ax, az));
        const r = span / 2, ys = hh - 0.3 - r, N = q ? 6 : 10;
        for (let i = 0; i < N; i++) { const a0 = Math.PI * i / N, a1 = Math.PI * (i + 1) / N, x0 = Math.cos(a0) * r, x1 = Math.cos(a1) * r, y0 = ys + Math.sin(a0) * r, y1 = ys + Math.sin(a1) * r;
          for (const sd of [-1, 1]) B.poly('stone', [[x0, y0, sd * 0.12], [x1, y1, sd * 0.12], [x1, hh, sd * 0.12], [x0, hh, sd * 0.12]], [0, 0, sd]);
          B.poly('stone', [[x0, y0, -0.12], [x1, y1, -0.12], [x1, y1, 0.12], [x0, y0, 0.12]], [0, -1, 0]); }
        B.box('dress', 0, ys + r + 0.12, 0.14, 0.36, 0.5, 0.06, 0);
        B.pop();
      }
    }
    B.box('dress', 0, hh + 0.35, (d + 0.6) / 2, w + 1.3, 0.7, d + 0.8, 0, { bottom: true });
    if (q < 2) { B.poly('pierced', [[-w / 2 - 0.5, hh + 0.7, d + 0.5], [w / 2 + 0.5, hh + 0.7, d + 0.5], [w / 2 + 0.5, hh + 1.4, d + 0.5], [-w / 2 - 0.5, hh + 1.4, d + 0.5]], [0, 0, 1], [[0, 0], [w + 1, 0], [w + 1, 1], [0, 1]]); B.box('dress', 0, hh + 1.45, d + 0.45, w + 1.2, 0.1, 0.3, 0); }
    if (q < 2) B.unit('doorOak', [[-0.9, 0.72], [0.9, 0.72], [0.9, 3.8], [-0.9, 3.8]], 0.075, [0, 0]);
    // steps up to the door
    B.box('dress', 0, 0.35, 0.3 + 1.2, w - 0.8, 0.7, 2.4, 0, { bottom: false });
    B.pop();
    out = { x: f.mx + f.nx * (d + 0.6) / 2, z: f.mz + f.nz * (d + 0.6) / 2, w: w + 1.0, d: d + 0.6, r: Math.atan2(f.ux, f.uz) };
  }
  // the garden front's Doric colonnade with a pierced balustrade over it
  if (garden && q < 2) {
    const f = garden, n = Math.max(4, Math.round((f.L - 2) / 3.0)), sp = (f.L - 2) / n, dd = 2.4;
    B.push(faceFrame(f));
    for (let k = 0; k <= n; k++) { const x = -f.L / 2 + 1 + k * sp; B.cyl('dress', x, 0.62, dd, 0.26, 3.18, q ? 6 : 10, false, 0.22); B.box('dress', x, 0.46, dd, 0.7, 0.32, 0.7, 0); B.box('dress', x, 3.92, dd, 0.66, 0.24, 0.66, 0); }
    B.box('dress', 0, 4.25, dd / 2 + 0.1, f.L - 1.4, 0.45, dd + 0.6, 0, { bottom: true });
    B.poly('pierced', [[-f.L / 2 + 0.75, 4.48, dd + 0.38], [f.L / 2 - 0.75, 4.48, dd + 0.38], [f.L / 2 - 0.75, 5.1, dd + 0.38], [-f.L / 2 + 0.75, 5.1, dd + 0.38]], [0, 0, 1], [[0, 0], [f.L - 1.5, 0], [f.L - 1.5, 1], [0, 1]]);
    B.box('dress', 0, 0.15, dd / 2 + 0.1, f.L - 1.0, 0.3, dd + 1.0, 0, { bottom: false });
    B.pop();
  }
  return { c: centroid(poly), porch: out };
}
export { THREE };
