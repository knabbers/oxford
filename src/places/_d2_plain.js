// Magdalen Bridge, The Plain and St Clement's, c. 2013 (districts pass 2; places/the_plain.js is the module, this file
// holds it). See docs/research/districts2.md (sources, known vs guessed).
//
//   preMap   under ?invented=1 (core/features.js) invented names for the two St Clement's pubs this pass fronts (the
//            rest of the street is renamed by world/tradenames.js and cowley_road.js); by default the map's real names
//   install  (all in the shared batch-4 atlas draw, _b4_kit.js — no new draw call)
//            · Magdalen Bridge: a balustrade skin over the world's solid parapets (balusters both faces, coping,
//              pedestals) and six cast-iron lamp standards on the pedestals, lit at night (the deck and road untouched)
//            · the punt station at the bridge's north-west end: a timber landing stage on the bank by the boathouse,
//              stone steps down from the bridge pavement, mooring posts, a hire board (the hire punts themselves are
//              systems/vehicles.js's, already moored here)
//            · The Plain: black guard railings on the pavement corners round the Victoria Fountain (rebuilt by
//              east_oxford.js), a row of bikes
//            · St Clement's: two pub fronts (the Half Moon, the Old Black Horse), hanging signs and lanterns; the shop units the Cowley
//              Road pass does not already dress get shutters by night and boards / crates by day
//            · Magdalen College School's field edge off Cowley Place: a sight screen, the heavy roller, a boundary rope
//   do       Pooh-sticks off Magdalen Bridge: drop a stick from the upstream parapet, cross to the downstream one and
//            see whether it comes out first (deterministic; £1 when it wins)
//   sights   for the passport (game.thePlain.sights)
// Test hooks: game.thePlain = { sights, stats(), pooh, bridge }       tools/smoke_districts2.mjs
import * as THREE from 'three';
import { shared, addSite, RB, b4Pack, geoOf, h01, bike, stand } from './_b4_kit.js';
import { mergeFaces, buildingById, buildingAt, streetFaces, roadDist, offCarriage, offBuildings, pip } from './_eo_kit.js';
import { shopDress } from './_eo_build.js';
import { lampStandard, balustrade, pubFront, boardPost, cumOf, along, riverBench } from './_d2_kit.js';
import { PUBS } from './_d2_cells.js';
import { nearSet, DRINK_LINES, BOATER_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';
import { inventedNames } from '../core/features.js';

export const IDS = { bridge: 'w39380970', pubA: 'w988834883', pubB: 'w123658649', boathouse: 'w993452213', field: 'w3662793' };   // School Field (the map's park on the island between the arms of the Cherwell)
// the landing stage: the bank by the boathouse (the mapped water's edge runs (940, 392) - (945, 403))
export const SCREEN = [985, 520];   // aim: the field's corner nearest The Plain
export const STAGE = { a: [941.2, 393.2], b: [944.4, 402.6], w: 2.2 };
/** ?nod2 in the URL: this pass is not installed (before / after screenshots on the live server) */
export const D2OFF = () => { try { return /[?&]nod2\b/.test((globalThis.location && globalThis.location.search) || '') || !!(globalThis.process && globalThis.process.env && globalThis.process.env.GTO_NOD2); } catch { return false; } };
export const sights = [
  { id: 'd2-magbridge', name: 'Magdalen Bridge', x: 988, z: 454, blurb: 'John Gwynn\'s stone bridge of 1772-90 over the two arms of the Cherwell, with its balustrade and lamps. Students jump off it on May Morning; the river is shallower than it looks.' },
  { id: 'd2-punts', name: 'The punt station', x: 943, z: 398, blurb: 'Punts for hire by the hour at the foot of Magdalen Bridge, below the tower: the Cherwell up past the Botanic Garden, Addison\'s Walk and the Parks.' },
  { id: 'd2-fountain', name: 'The Jubilee fountain at The Plain', x: 1073, z: 523, blurb: 'Built in 1899 for Queen Victoria\'s Diamond Jubilee on the site of the old toll house at The Plain, where the roads from Cowley, Iffley and Headington meet.' },
  { id: 'd2-stclements', name: 'St Clement\'s', x: 1165, z: 515, blurb: 'The old suburb over the bridge, outside the city walls: little shops, pubs and terraces. Its medieval church stood on The Plain until 1829.' },
  { id: 'd2-mcsfield', name: 'Magdalen College School field', x: 850, z: 667, blurb: 'The school\'s playing field on the island between the arms of the Cherwell, cricket in summer, the river all round.' },
];
const night = (game) => () => { const h = game.time.hour; return h >= 21.5 || h < 7; };
const best = (b, d, reach = 12) => { if (!b) return null; const fs = mergeFaces(streetFaces(b.poly, d, reach)); fs.sort((a, c) => c.L - a.L); return fs[0] || null; };

export const POOH = { wait: [7, 11], window: 7, prize: 1 };
/** pure: the race of a stick dropped at time t (ms): {secs to come out, win} */
export function poohRace(t) { const k = Math.floor(t / 1000); return { secs: POOH.wait[0] + h01(k, 77) * (POOH.wait[1] - POOH.wait[0]), win: h01(k, 78) < 0.55 }; }

export default {
  id: 'the_plain',
  preMap(game) {
    if (D2OFF()) return;
    try {
      const m = game.map; if (!m || m._d2Plain) return;
      Object.defineProperty(m, '_d2Plain', { value: true, enumerable: false });
      if (inventedNames()) for (const [id, name] of [[IDS.pubA, PUBS.plainA], [IDS.pubB, PUBS.plainB]]) { const b = m.buildings.find((q) => q.id === id); if (b && b.tags) { b.tags.name = name; delete b.tags.brand; delete b.tags.operator; delete b.tags.tourism; } }
    } catch (e) { console.error('[the_plain] preMap', e); }
  },

  install(game) {
    if (D2OFF()) return null;
    const K = shared(game), me = K.join('the_plain'), map = game.map, col = game.worldCollider, W = game.world;
    const S = { err: false, railAt: [], shops: 0, lamps: [], railings: 0, bikes: 0, pubs: 0, ped: [], bridge: null, stage: null };
    try {
      // ---------------------------------------------------------------- Magdalen Bridge: balustrade + lamps
      const br = map.roads.find((r) => r.id === IDS.bridge);
      if (br) {
        const pw = br.pw !== undefined ? br.pw : 2.2, off = (br.w || 8) / 2 + (pw || 0.3) + 0.25, pts = br.pts, cum = cumOf(pts), L = cum[cum.length - 1];
        S.bridge = { off, L, pts };
        const Bq = [new RB(), new RB(), new RB()];
        for (const side of [1, -1]) for (let q = 0; q < 3; q++) {
          const ped = balustrade(Bq[q], pts, side * off, 0.45, 1.05, q, { ped: 7.6 });
          if (q === 0) S.ped.push(...ped.map((p) => ({ ...p, side })));
        }
        // lamp standards on every fourth pedestal, staggered across the bridge
        const lamps = S.ped.filter((p, i) => { const k = Math.round(p.s / 7.6); return k > 0 && k % 4 === (p.side > 0 ? 1 : 3) && p.s < L - 2; });
        for (const p of lamps) {
          for (let q = 0; q < 3; q++) lampStandard(Bq[q], p.x, 1.37, p.z, 3.3, q, S.lamps.length * 5);
          S.lamps.push([p.x, p.z]);
          try { W.addLampGlow(p.x, 1.37 + 3.3 + 0.28, p.z); } catch { /* */ }
          col.addCircle(p.x, p.z, 0.3, { tag: 'lamp' });
        }
        const mid = along(pts, cum, L / 2);
        addSite(K, 'd2:bridge', [mid.x, 2, mid.z], L / 2 + 4, [90, 260, 700], Bq);
        // ---------------------------------------------------------------- Pooh-sticks spot: over water on both sides
        let best = null;
        for (let s = 6; s < L - 6; s += 2) { const p = along(pts, cum, s), up = -1; const ux = p.x + p.nx * up * (off + 2), uz = p.z + p.nz * up * (off + 2), dx = p.x - p.nx * up * (off + 2), dz = p.z - p.nz * up * (off + 2); if (col.isWater(ux, uz) && col.isWater(dx, dz)) { best = { s, p }; if (s > 12) break; } }
        if (best) {
          const p = best.p, inner = off - 0.75;
          S.pooh = { up: [p.x - p.nx * inner, p.z - p.nz * inner], down: [p.x + p.nx * inner, p.z + p.nz * inner], water: [p.x + p.nx * (off + 3), p.z + p.nz * (off + 3)], flow: [p.nx, p.nz] };
        }
      }
      // ---------------------------------------------------------------- the punt station
      {
        const { a, b, w } = STAGE, dx = b[0] - a[0], dz = b[1] - a[1], Ls = Math.hypot(dx, dz), ux = dx / Ls, uz = dz / Ls;
        let nx = uz, nz = -ux; if (!col.isWater(a[0] + nx * 3 + ux * Ls / 2, a[1] + nz * 3 + uz * Ls / 2)) { nx = -nx; nz = -nz; }   // n points at the water
        const B0 = new RB(), B1 = new RB();
        for (const [B, q] of [[B0, 0], [B1, 1]]) {
          // deck: boards on joists at pavement height, its water edge on the bank line, inland by w
          const P = (s, t, y) => [a[0] + ux * s + nx * t, y, a[1] + uz * s + nz * t], Y = 0.14;
          B.poly('deck', [P(0, -w, Y), P(Ls, -w, Y), P(Ls, -0.6, Y), P(0, -0.6, Y)], [0, 1, 0], [[0, 0], [Ls, 0], [Ls, w - 0.6], [0, w - 0.6]]);
          // stone river stairs down to the punts along the water edge (two treads, the last one awash)
          for (let k = 0; k < 2; k++) { const t0 = -0.6 + k * 0.33, y = Y - (k + 1) * 0.05, [bx, , bz] = P(Ls / 2, t0 + 0.165, 0); B.box('dress', bx, y / 2, bz, Ls, y, 0.33, Math.atan2(nx, nz), { bottom: false }); }
          B.poly('oak', [P(0, -w, 0.0), P(0, -0.6, 0.0), P(0, -0.6, Y), P(0, -w, Y)], [-ux, 0, -uz]);
          B.poly('oak', [P(Ls, -0.6, 0.0), P(Ls, -w, 0.0), P(Ls, -w, Y), P(Ls, -0.6, Y)], [ux, 0, uz]);
          // mooring posts at the water's edge
          for (let s = 0.6; s < Ls; s += 2.6) { const [x, , z] = P(s, 0.25, 0); B.cyl('oak', x, -0.3, z, 0.11, 1.3, q ? 5 : 8, true); }
          // an iron rail along the landward side and the ends
          for (const [s0, t0, s1, t1, k0] of [[0, -w, Ls, -w, 0], [0, -w, 0, -0.7, 1], [Ls, -w, Ls, -0.7, 1]]) { B.beam('iron', P(s0, t0, 1.05), P(s1, t1, 1.05), 0.035); const n = Math.max(1, Math.round(Math.hypot(s1 - s0, t1 - t0) / 1.6)); for (let k = k0; k <= n; k++) B.beam('iron', P(s0 + (s1 - s0) * k / n, t0 + (t1 - t0) * k / n, Y), P(s0 + (s1 - s0) * k / n, t0 + (t1 - t0) * k / n, 1.07), 0.03); }
          // the hire board and a life ring post
          if (q === 0) { const [x, , z] = P(Ls * 0.35, -w - 0.4, 0); boardPost(B, x, z, -nx, -nz, 'sign_punts', 2.6, 1.6, q); const [rx, , rz] = P(Ls * 0.8, -w + 0.2, 0); B.box('red', rx, 1.2, rz, 0.5, 0.5, 0.06, Math.atan2(nx, nz)); B.box('oak', rx, 0.7, rz - 0.04, 0.08, 1.4, 0.08, 0); }
        }
        const c = [a[0] + ux * Ls / 2, a[1] + uz * Ls / 2];
        addSite(K, 'd2:punts', [c[0], 1, c[1]], 8, [70, 160, 0.01], [B0, B1, null]);
        S.stage = { c, ux, uz, nx, nz, L: Ls };
        // a bench looking at the river and the tower
        const Bb = new RB(); riverBench(Bb, c[0] - nx * (w + 1.6) - ux * 2, c[1] - nz * (w + 1.6) - uz * 2, nx, nz);
        if (offBuildings(map, c[0] - nx * (w + 1.6) - ux * 2, c[1] - nz * (w + 1.6) - uz * 2, 0.6)) addSite(K, 'd2:puntbench', [c[0], 0.5, c[1]], 4, [60, 120, 0.01], [Bb, null, null], { farArea: 99 });
      }
      // ---------------------------------------------------------------- The Plain: guard railings, bikes
      {
        const Br = [new RB(), new RB()], ctr = [1073, 523];
        const plain = map.roads.filter((r) => /^(The Plain|St Clements Street|Iffley Road|Cowley Road|High Street)$/.test(r.name || '') && !r.bridge);
        const xings = map.pois.filter((p) => /crossing|traffic_signals/.test(p.kind) && Math.hypot(p.p[0] - ctr[0], p.p[1] - ctr[1]) < 70).map((p) => p.p);
        for (const r of plain) {
          const pw = r.pw !== undefined ? r.pw : 2.4; if (!pw || pw < 1.6) continue;
          const cum = cumOf(r.pts), L = cum[cum.length - 1];
          for (const side of [1, -1]) for (let s = 1; s < L - 1; s += 2.0) {
            const p = along(r.pts, cum, s), d = side * ((r.w || 8) / 2 + 0.42), x = p.x + p.nx * d, z = p.z + p.nz * d;
            const dc = Math.hypot(x - ctr[0], z - ctr[1]); if (dc < 14 || dc > 34) continue;
            const x2 = x + p.ux * 2, z2 = z + p.uz * 2;
            if (xings.some((c) => Math.hypot(c[0] - x, c[1] - z) < 5 || Math.hypot(c[0] - x2, c[1] - z2) < 5)) continue;
            if (!offCarriage(map, x, z, 0.15) || !offCarriage(map, x2, z2, 0.15) || !offBuildings(map, x, z, 0.8) || S.railAt.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.6 || Math.hypot(px - x2, pz - z2) < 1.6)) continue;
            S.railAt.push([x, z], [x2, z2]);
            for (let q = 0; q < 2; q++) {
              const B = Br[q];
              B.beam('iron', [x, 1.0, z], [x2, 1.0, z2], 0.04); B.beam('iron', [x, 0.25, z], [x2, 0.25, z2], 0.03);
              B.beam('iron', [x, 0, z], [x, 1.04, z], 0.05);
              if (q === 0) for (let k = 1; k < 8; k++) { const t = k / 8; B.beam('iron', [x + (x2 - x) * t, 0.25, z + (z2 - z) * t], [x + (x2 - x) * t, 1.0, z + (z2 - z) * t], 0.015); }
            }
            S.railings++;
          }
        }
        addSite(K, 'd2:plain', [ctr[0], 1, ctr[1]], 36, [80, 170, 0.01], [Br[0], Br[1], null], { farArea: 99 });
      }
      // ---------------------------------------------------------------- St Clement's: pub fronts, shop dressing
      {
        const dSC = roadDist(map, ['St Clements Street', 'The Plain']);
        const night1 = night(game);
        for (const [id, key, paint] of [[IDS.pubA, 'sign_plainPubA', 'boatGreen'], [IDS.pubB, 'sign_plainPubB', 'boatOx']]) {
          const b = buildingById(map, id), f = best(b, dSC); if (!f) continue;
          addSite(K, 'd2:pub:' + id, [f.mx, 3, f.mz], 8, [80, 180, 320], [0, 1, 2].map((q) => { const B = new RB(); pubFront(B, f, q, key, paint); return B; }));
          S.pubs++; (S.pubFaces || (S.pubFaces = [])).push(f);
        }
        // the units the Cowley Road pass already dresses (its renamed businesses' buildings) are left alone
        const done = new Set([IDS.pubA, IDS.pubB]);
        for (const r of map._eoRenamed || []) { if (!r.id.startsWith('n')) done.add(r.id); else { const p = map.pois.find((q) => q.id === r.id), b = p && buildingAt(map, p.p[0], p.p[1]); if (b) done.add(b.id); } }
        const BIZ = /^(shop:|pub$|bar$|cafe$|restaurant$|fast_food$)/, cand = [];
        for (const b of map.buildings) {
          if (b.part || !b.tags || b.c[0] < 1085 || b.c[0] > 1420 || dSC(b.c[0], b.c[1]) > 18) continue;
          const t = b.tags, kind = t.shop ? 'shop:' + t.shop : t.amenity && BIZ.test(t.amenity) ? t.amenity : (t.building === 'retail' || t.building === 'commercial') ? 'shop:other' : null;
          if (kind && t.shop !== 'vacant') cand.push([b, kind]);
        }
        for (const p of map.pois) { if (p.p[0] < 1085 || p.p[0] > 1420 || !BIZ.test(p.kind) || /vacant/.test(p.kind) || dSC(p.p[0], p.p[1]) > 22) continue; const b = buildingAt(map, p.p[0], p.p[1]); if (b) cand.push([b, p.kind]); }
        const cells = new Map();
        for (const [b, kind] of cand) {
          if (done.has(b.id)) continue; done.add(b.id);
          const f = best(b, dSC); if (!f) continue;
          const key = Math.floor(f.mx / 160) + ',' + Math.floor(f.mz / 160);
          let c = cells.get(key); if (!c) cells.set(key, (c = { n: [new RB(), new RB(), new RB()], d: [new RB(), new RB()], x: 0, z: 0, k: 0 }));
          const sd = (parseInt(b.id.replace(/\D/g, ''), 10) % 983) / 983;
          for (let q = 0; q < 3; q++) shopDress(c.n[q], q < 2 ? c.d[q] : new RB(), f, kind, sd, q, map);
          c.x += f.mx; c.z += f.mz; c.k++; S.shops++;
        }
        // bikes along the St Clement's pavement by the pubs
        for (const f of S.pubFaces || []) {
          const B0 = new RB(), B1 = new RB();
          for (const [B, q] of [[B0, 0], [B1, 1]]) for (let k = 0; k < 3; k++) {
            const o = -f.L / 2 - 1.2 - k * 0.95, x = f.mx + f.ux * o + f.nx * 1.0, z = f.mz + f.uz * o + f.nz * 1.0;
            if (!offCarriage(map, x, z, 0.6) || !offBuildings(map, x, z, 0.5)) continue;
            const h = Math.atan2(f.nx, f.nz); stand(B, x, z, h); if (k !== 1) bike(B, x + f.ux * 0.3, z + f.uz * 0.3, h + (k ? Math.PI : 0), ['navy', 'red', 'boatGreen'][k], q);
            if (q === 0) S.bikes++;
          }
          addSite(K, 'd2:bikes:' + f.mx.toFixed(0), [f.mx, 0.5, f.mz], 8, [60, 130, 0.01], [B0, B1, null], { farArea: 99 });
        }
        for (const [key, c] of cells) {
          const cx = c.x / c.k, cz = c.z / c.k;
          addSite(K, 'd2:scn:' + key, [cx, 2, cz], 110, [70, 150, 260], c.n, { need: night1 });
          addSite(K, 'd2:scd:' + key, [cx, 1, cz], 110, [60, 130, 0.01], [c.d[0], c.d[1], null], { need: () => !night1(), farArea: 99 });
        }
      }
      // ---------------------------------------------------------------- MCS field edge: sight screen, roller, rope
      {
        const fa = map.areas.find((a) => a.id === IDS.field);
        if (fa) {
                    let cx = 0, cz = 0; for (const p of fa.poly) { cx += p[0] / fa.poly.length; cz += p[1] / fa.poly.length; }
          // the screen near the field's north-east corner (towards The Plain), on dry ground clear of buildings, facing the field
          let sp = null;
          for (let x = 740; x < 980; x += 4) for (let z = 525; z < 805; z += 4) {
            if (!pip(x, z, fa.poly) || col.isWater(x, z) || !offBuildings(map, x, z, 15)) continue;
            let ok = true; for (const [ox, oz] of [[10, 0], [-10, 0], [0, 10], [0, -10], [7, 7], [-7, -7], [7, -7], [-7, 7]]) if (col.isWater(x + ox, z + oz) || !pip(x + ox, z + oz, fa.poly)) { ok = false; break; }
            if (ok && (!sp || Math.hypot(x - SCREEN[0], z - SCREEN[1]) < Math.hypot(sp[0] - SCREEN[0], sp[1] - SCREEN[1]))) sp = [x, z];
          }
          if (!sp) throw new Error('no dry spot on the school field');
          const [sx, sz] = sp, hx = Math.atan2(cx - sx, cz - sz);
          const B0 = new RB(), B1 = new RB();
          for (const [B, q] of [[B0, 0], [B1, 1]]) {
            // the sight screen: white boards on a timber frame on wheels
            B.box('screen', sx, 2.4, sz, 6.0, 3.6, 0.12, hx, { bottom: true });
            for (const o of [-2.6, 0, 2.6]) { const ox = Math.cos(hx) * o, oz = -Math.sin(hx) * o; B.box('oak', sx + ox - Math.sin(hx) * 0.4, 0.3, sz + oz - Math.cos(hx) * 0.4, 0.12, 0.6, 1.0, hx); if (q === 0) B.cyl('rubber', sx + ox - Math.sin(hx) * 0.7, 0, sz + oz - Math.cos(hx) * 0.7, 0.18, 0.12, 6, true); }
            // the heavy roller beside it
            const rx = sx + Math.cos(hx) * 5, rz = sz - Math.sin(hx) * 5;
            B.push(new THREE.Matrix4().makeTranslation(rx, 0.45, rz).multiply(new THREE.Matrix4().makeRotationY(hx)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)));
            B.cyl('green', 0, -0.8, 0, 0.45, 1.6, q ? 8 : 12, true); B.pop();
            B.beam('green', [rx, 0.45, rz], [rx + Math.sin(hx) * 1.8, 0.9, rz + Math.cos(hx) * 1.8], 0.05);
            // a boundary rope on short white posts in an arc round the square
            const R = 46; let prev = null;
            for (let k = -6; k <= 6; k++) {
              const t = hx + k * 0.09, bx = sx + Math.sin(hx) * R - Math.sin(t) * R, bz = sz + Math.cos(hx) * R - Math.cos(t) * R;
              B.cyl('white', bx, 0, bz, 0.04, 0.5, 4, true); if (prev) B.beam('rope', [prev[0], 0.42, prev[1]], [bx, 0.42, bz], 0.02); prev = [bx, bz];
            }
            for (const o of [-6, 6]) riverBench(B, sx + Math.cos(hx) * o - Math.sin(hx) * 2.5, sz - Math.sin(hx) * o - Math.cos(hx) * 2.5, Math.sin(hx), Math.cos(hx));
          }
          addSite(K, 'd2:mcs', [sx, 2, sz], 30, [90, 220, 0.01], [B0, B1, null], { farArea: 99 });
          col.addBox(sx, sz, 0.5, 6.0, hx + Math.PI / 2);
          S.mcs = [sx, sz, hx];
        }
      }
      // (no shadow box: the bridge and The Plain are in two budget views; the b4 draw casts no shadow there)
    } catch (e) { console.error('[the_plain] build', e); } finally { K.joined(me); }

    // ---------------------------------------------------------------- people (only near; existing voiced lines)
    let drinkers = null, hirer = null;
    try {
      const f = (S.pubFaces || [])[0];
      if (f) drinkers = nearSet(game, { c: [f.mx, f.mz], r: 70, h0: 17, h1: 23, people: [0, 1, 2].map((i) => { const o = -1.2 + i * 1.2, x = f.mx + f.ux * o + f.nx * 1.3, z = f.mz + f.uz * o + f.nz * 1.3; return { x, z, h: Math.atan2(-f.ux, -f.uz) + (i - 1) * 0.9, look: randomLook('d2-plain-drinker-' + i, { outfit: i % 2 ? 'casual' : 'tweed' }), pose: i === 1 ? 'talk' : 'stand', lines: i === 0 ? DRINK_LINES : null }; }) });
      if (S.stage) { const { c, nx, nz } = S.stage; hirer = nearSet(game, { c, r: 60, h0: 9.5, h1: 18.5, people: [{ x: c[0] - nx * 1.2, z: c[1] - nz * 1.2, h: Math.atan2(-nx, -nz), look: randomLook('d2-punt-hirer', { outfit: 'casual' }), pose: 'stand', lines: BOATER_LINES, label: 'Punt hire' }] }); }
    } catch (e) { console.warn('[the_plain] people', e); }

    // ---------------------------------------------------------------- Pooh-sticks
    const P = { state: null, wins: 0, races: 0, mesh: null };
    const pooh = S.pooh;
    if (pooh) {
      const stickMesh = () => {
        if (P.mesh) return P.mesh;
        const B = new RB(); B.beam('oak', [-0.25, 0.02, 0], [0.25, 0.04, 0.02], 0.03); B.beam('oak', [0.05, 0.03, 0.01], [0.16, 0.05, 0.1], 0.015);
        const m = new THREE.Mesh(geoOf(B, b4Pack(W)), K.pack.atlas); m.name = 'd2x:poohstick'; m.frustumCulled = false; m.visible = false; m.castShadow = false;
        game.worldScene.add(m); return (P.mesh = m);
      };
      game.interact.add({ pos: pooh.up, radius: 2.2, label: () => (P.state ? 'Your stick is somewhere under the bridge...' : 'Drop a stick (Pooh-sticks)'), enabled: () => !P.state, onUse: () => {
        const now = game.time.now(), r = poohRace(now);
        P.state = { t0: now, ...r, seen: false }; P.races++;
        game.ui.toast('You drop a stick off the upstream side. Now run across and watch for it!', 4);
      } });
      game.interact.add({ pos: pooh.down, radius: 2.6, label: 'Watch for your stick', enabled: () => !!P.state && !P.state.seen, onUse: () => { game.ui.toast('Any second now...', 2); } });
      P.tick = () => {
        const st = P.state; if (!st) { if (P.mesh) P.mesh.visible = false; return; }
        const t = (game.time.now() - st.t0) / 1000, p = game.player;
        if (t >= st.secs && !st.seen) {
          st.seen = true;
          const there = p.place === 'world' && Math.hypot(p.pos.x - pooh.down[0], p.pos.z - pooh.down[1]) < 4.5;
          if (!there) game.ui.toast('Your stick has come out the other side of Magdalen Bridge. You were not there to see it.', 4);
          else if (st.win) { P.wins++; game.pay(POOH.prize); try { const fl = game.state.flags || (game.state.flags = {}); fl.poohsticks = (fl.poohsticks || 0) + 1; game.save(); } catch { /* */ } game.ui.toast(`There it is, first out, ahead of a leaf and a crisp packet. You win Pooh-sticks (£${POOH.prize}).`, 5); }
          else game.ui.toast('A twig comes out first. Then a leaf. Then yours, sideways. The Cherwell is a hard judge.', 5);
        }
        const m = stickMesh();
        if (t >= st.secs && t < st.secs + POOH.window) { const d = (t - st.secs) * 0.45; m.position.set(pooh.water[0] + pooh.flow[0] * d, 0.04, pooh.water[1] + pooh.flow[1] * d); m.rotation.y = t * 0.3; m.updateMatrix(); m.updateMatrixWorld(); m.visible = p.place === 'world'; }
        else m.visible = false;
        if (t > st.secs + POOH.window) P.state = null;
      };
    }

    game.thePlain = {
      sights, bridge: S.bridge, screen: S.mcs ? S.mcs.slice(0, 2) : null, pooh: { spot: pooh || null, race: poohRace, state: () => P.state, wins: () => P.wins, races: () => P.races },
      stats() { return { lamps: S.lamps.length, railings: S.railings, shops: S.shops, pubs: S.pubs, bikes: S.bikes, stage: !!S.stage, mcs: !!S.mcs, people: (drinkers ? drinkers.count() : 0) + (hirer ? hirer.count() : 0), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^d2:(bridge|punts|plain|pub|sc|mcs|bikes|puntbench)/.test(k)).map(([k, v]) => [k, v.tris])) }; },
    };
    return { update() { try { K.tick(me); if (drinkers) drinkers.tick(); if (hirer) hirer.tick(); if (P.tick) P.tick(); } catch (e) { if (!S.err) { S.err = true; console.error('[the_plain]', e); } } } };
  },
};
