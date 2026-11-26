// Osney and the Botley Road, c. 2013 — Osney Lock and weir, Osney Bridge, the railway bridge, Osney Island's terraces
// and riverside pub, and the Thames Path north to Port Meadow and south to Folly Bridge (districts pass 2;
// places/osney.js is the module, this file holds it). See docs/research/districts2.md (sources, known vs guessed).
//
//   preMap   Osney Island's terraces restyled (red brick, slate: overrides.style); the riverside pub on South Street
//            gets an invented name; the hydro-electric house by the weir (2015, after this game's year) is skipped
//   install  (all in the shared batch-4 atlas draw — no new draw call)
//            · Osney Lock: copings and bollards along the chamber, the two pairs of mitre gates with their walkways,
//              black-and-white balance beams over the banks, the lock board; the lock-keeper's hut by it
//            · the weir beside it: a concrete sill under the footbridge and broken white water below it
//            · Osney Bridge (1888): cast-iron railing over the parapets, end pilasters, four lamps, the low-headroom board
//            · the railway bridge over the Botley Road west of the station: brick abutments, steel girders, embankment
//            · the pub's front and its riverside terrace (tables, parasols, festoon lights)
//            · narrowboats moored along East Street and below the lock; benches, Thames Path boards and open gates
//              along the towpath both ways
//   do       work the lock: walk the balance beams in order to see a boat through (90 s, £3 from the boater)
//   sights   for the passport (game.osney.sights)
// Test hooks: game.osney = { sights, stats(), lock, work }       tools/smoke_districts2.mjs
import { NORTH } from './_north_kit.js';
import { shared, addSite, RB, frame, bulb, festoon, h01 } from './_b4_kit.js';
import { mergeFaces, buildingById, streetFaces, roadDist, offCarriage, offBuildings, faceFrame } from './_eo_kit.js';
import { narrowboat, obbOf } from './_jer_build.js';
import { pubFront, boardPost, cumOf, along, riverBench, picnicTable, parasol, fieldGate, lampStandard, signAt } from './_d2_kit.js';
import { PUBS } from './_d2_cells.js';
import { nearSet, DRINK_LINES, BOATER_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';
import { tn, inventedNames } from '../core/features.js';

export const IDS = { lock: 'w369908986', hut: 'w1422536276', pub: 'w503807293', hydro: 'w961889997', bridge: 'w658171409', weirPath: 'w32111189', eastSt: 'w613348346', below: 'w112790176' };
export const PATHS = { north: ['w588722986', 'w1319284510', 'w386959147'], south: ['w24844169', 'w30509268', 'w3064662'] };
export const RAIL = { s: 135, t0: -11.5, t1: 9.5, top: 5.4, under: 4.6 };   // station frame (_cw_station.js): where the line crosses the Botley Road
export const ISLAND = ['East Street', 'South Street', 'North Street', 'Bridge Street', 'West Street'];
/** ?nod2 in the URL: this pass is not installed (before / after screenshots on the live server) */
export const D2OFF = () => { try { return /[?&]nod2\b/.test((globalThis.location && globalThis.location.search) || '') || !!(globalThis.process && globalThis.process.env && globalThis.process.env.GTO_NOD2); } catch { return false; } };
export const sights = [
  { id: 'd2-osneylock', name: 'Osney Lock', x: -822, z: 640, blurb: 'A pound lock of 1790 on a site where Osney Abbey had a weir in the Middle Ages; the keeper still works the gates by hand-pushed balance beams.' },
  { id: 'd2-weir', name: 'Osney weir', x: -856, z: 606, blurb: 'The weir beside the lock, where the Thames spills down into Osney Pool. Listen to it from the footbridge.' },
  { id: 'd2-osneybridge', name: 'Osney Bridge', x: -870, z: 272, blurb: 'The Botley Road\'s cast-iron bridge of 1888 over the Thames, the lowest on the navigable river: 7 ft 6 in for boats underneath.' },
  { id: 'd2-railbridge', name: 'The Botley Road railway bridge', x: -695, z: 256, blurb: 'The low railway bridge west of the station, where the Botley Road dips under the line and tall lorries get a fright.' },
  { id: 'd2-osneypub', name: PUBS.osney, x: -873, z: 512, blurb: tn('Osney Island\'s riverside pub (the Waterman\'s Arms until 2010), its terrace on the bank with the boats moored along East Street.', 'Osney Island\'s riverside pub, its terrace on the bank with the boats moored along East Street. (An invented name for the real pub here.)') },
  { id: 'd2-thamespath', name: 'The Thames Path', x: -862, z: 200, blurb: 'The towpath along the Thames: north past Osney to Port Meadow, south past the lock to Folly Bridge, the whole way on a bike.' },
];
const best = (b, d, reach = 12) => { if (!b) return null; const fs = mergeFaces(streetFaces(b.poly, d, reach)); fs.sort((a, c) => c.L - a.L); return fs[0] || null; };

/** pure: the steps of working the lock (the balance beam ends are numbered 0-3: lower west, lower east, upper west, upper east) */
export const WORK = { secs: 90, fee: 3, steps: [[0, 'Close the bottom gates: lean on the downstream balance beam'], [1, 'and the other bottom gate'], [2, 'Now the top gates: push the upstream beam open (the chamber has filled)'], [3, 'and the last one. In she comes.']] };

export default {
  id: 'osney',
  preMap(game) {
    if (D2OFF()) return;
    try {
      const m = game.map; if (!m || m._d2Osney) return;
      const dI = roadDist(m, ISLAND), isl = [];
      for (const b of m.buildings) {
        if (b.part || b.c[0] > -840 || b.c[1] < 280 || b.c[1] > 560 || dI(b.c[0], b.c[1]) > 22) continue;
        const t = b.tags || {}, bt = t.building || 'yes'; if (!/^(house|terrace|yes|residential|semidetached_house|detached)$/.test(bt) || t.amenity || t.shop || t.name) continue;
        game.overrides.style.set(b.id, { wall: 'brick', tint: h01(b.c[0] | 0, b.c[1] | 0) < 0.3 ? [1.36, 1.18, 0.86] : [1.02, 0.8, 0.72], roof: 'slate', shape: 'gabled', up: 'brickSash', ground: 'brickSash', door: 'brickDoor', storeys: 2, ivy: false });
        isl.push(b.id);
      }
      const p = inventedNames() && m.buildings.find((b) => b.id === IDS.pub); if (p && p.tags) { p.tags.name = PUBS.osney; delete p.tags.brand; delete p.tags.operator; }
      const hut = m.buildings.find((b) => b.id === IDS.hut); if (hut) game.overrides.style.set(hut.id, { wall: 'render', tint: [1.08, 1.06, 1.0], roof: 'slate', shape: 'hipped', up: 'renderSash', ground: 'renderSash', door: 'renderDoor', storeys: 1, ivy: false });
      game.overrides.skip.add(IDS.hydro);
      // photo comparison north, item 5: Osney Bridge is narrow (K: about 7 m between the kerbs). The mapped road was drawn
      // 10 m wide, which put the mapped parapet walls and the two footway bridges' railings inside the carriageway.
      // The bridge span is narrowed to fit; the world's parapets (dressed by install) stand where the mapped walls
      // were, so those walls and the footways' own railings are not drawn (the footways stay walkable).
      if (NORTH) {
        const br = m.roads.find((r) => r.id === IDS.bridge); if (br) { br.w = 7.4; br.pw = 2.4; }
        for (const id of ['w1197833812', 'w1197833813', 'w78454770', 'w117822423']) game.overrides.skip.add(id);
      }
      Object.defineProperty(m, '_d2Osney', { value: { island: isl }, enumerable: false });
    } catch (e) { console.error('[osney] preMap', e); }
  },

  install(game) {
    if (D2OFF()) return null;
    const K = shared(game), me = K.join('osney'), map = game.map, col = game.worldCollider, W = game.world;
    const S = { err: false, boats: [], benches: 0, boards: 0, gates: 0, lamps: 0, lock: null, pubF: null, rail: null };
    try {
      // ---------------------------------------------------------------- Osney Lock
      const la = map.areas.find((a) => a.id === IDS.lock);
      if (la) {
        const O = obbOf(la.poly); let { ux, uz } = O; const L = O.L, Wd = O.W, c = O.c;
        if (uz < 0) { ux = -ux; uz = -uz; }                     // u runs downstream (south)
        const nx = -uz, nz = ux, Bq = [new RB(), new RB(), new RB()];
        const P = (s, t) => [c[0] + ux * s + nx * t, c[1] + uz * s + nz * t];
        const beams = [];
        for (let q = 0; q < 3; q++) {
          const B = Bq[q];
          B.push(frame(c[0], 0, c[1], ux, uz));                   // local x downstream, local z across (= n)
          for (const sd of [-1, 1]) {
            // the coping along the chamber side, a white edge, bollards
            B.box('dress', 0, 0.12, sd * (Wd + 0.4), L * 2 + 1.2, 0.24, 0.8, 0, { bottom: false });
            if (q < 2) B.box('lockWhite', 0, 0.245, sd * (Wd + 0.06), L * 2 + 1.0, 0.01, 0.12, 0, { bottom: false });
            if (q === 0) for (let s = -L + 3; s < L - 2; s += 6) B.cyl('lockBlack', s, 0.24, sd * (Wd + 0.5), 0.13, 0.5, 8, true, 0.11);
            // the chamber wall face down to the water
            B.poly('rubbleDk', [[-L, -0.7, sd * Wd], [L, -0.7, sd * Wd], [L, -0.01, sd * Wd], [-L, -0.01, sd * Wd]], [0, 0, -sd]);
          }
          // the gates: a mitre pair at each end, leaves pointing upstream, walkway and handrail, balance beams over the banks
          for (const [e, up] of [[-1, true], [1, false]]) {
            const gx = e * (L - 0.5), mitre = 0.32;
            for (const sd of [-1, 1]) {
              const hx = gx, hz = sd * Wd, tx = gx - mitre * Wd, tz = 0; void up;
              const ang = Math.atan2(tz - hz, tx - hx), len = Math.hypot(tx - hx, tz - hz);
              B.box('tar', (hx + tx) / 2, 0.15, (hz + tz) / 2, len, 1.7, 0.32, -ang + 0, { bottom: false });
              if (q < 2) { B.box('oak', (hx + tx) / 2, 1.04, (hz + tz) / 2, len, 0.06, 0.5, -ang, { bottom: true }); B.beam('lockWhite', [hx, 1.95, hz], [tx, 1.95, tz], 0.04); for (let k = 0; k <= (sd > 0 ? 2 : 3); k++) { const t = k / 3; B.beam('lockWhite', [hx + (tx - hx) * t, 1.05, hz + (tz - hz) * t], [hx + (tx - hx) * t, 1.97, hz + (tz - hz) * t], 0.035); } }
              // balance beam: from the hinge back over the bank, away from the chamber end
              const bx0 = hx, bz0 = hz + sd * 0.3, bx1 = hx - e * 4.6, bz1 = hz + sd * 1.6;
              B.box('lockWhite', (bx0 + bx1) / 2, 1.0, (bz0 + bz1) / 2, Math.hypot(bx1 - bx0, bz1 - bz0), 0.28, 0.28, -Math.atan2(bz1 - bz0, bx1 - bx0));
              B.box('lockBlack', bx1 - (bx1 - bx0) * 0.07, 1.0, bz1 - (bz1 - bz0) * 0.07, Math.hypot(bx1 - bx0, bz1 - bz0) * 0.14 + 0.02, 0.33, 0.34, -Math.atan2(bz1 - bz0, bx1 - bx0));
              if (q === 0) beams.push([c[0] + ux * bx1 + nx * bz1, c[1] + uz * bx1 + nz * bz1, e, sd]);
            }
          }
          B.pop();
        }
        // the lock board on the hut side and a life ring
        const hutB = buildingById(map, IDS.hut), side = hutB ? Math.sign((hutB.c[0] - c[0]) * nx + (hutB.c[1] - c[1]) * nz) || 1 : 1;
        { const [bx, bz] = P(-L * 0.2, side * (Wd + 2.2)); boardPost(Bq[0], bx, bz, -nx * side, -nz * side, 'sign_lock', 1.8, 1.6, 0); boardPost(Bq[1], bx, bz, -nx * side, -nz * side, 'sign_lock', 1.8, 1.6, 1); col.addCircle(bx, bz, 0.3); }
        { const [rx, rz] = P(L * 0.25, side * (Wd + 1.4)); for (let q = 0; q < 2; q++) { Bq[q].box('oak', rx, 0.7, rz, 0.1, 1.4, 0.1, 0); Bq[q].box('red', rx, 1.15, rz, 0.55, 0.55, 0.07, Math.atan2(nx, nz)); } }
        // flower tubs by the hut
        if (hutB) for (let k = 0; k < 3; k++) { const [fx, fz] = P(-L * 0.4 + k * 2.4, side * (Wd + 3.4)); if (offBuildings(map, fx, fz, 0.5)) { Bq[0].cyl('pot', fx, 0, fz, 0.35, 0.45, 8, true); Bq[0].cyl('foliage', fx, 0.45, fz, 0.32, 0.3, 8, true, 0.12); } }
        addSite(K, 'd2:lock', [c[0], 1, c[1]], L + 6, [110, 260, 600], Bq);
        S.lock = { c, ux, uz, nx, nz, L, W: Wd, beams };
        for (const [x, z] of beams) col.addCircle(x, z, 0.25);
      }
      // ---------------------------------------------------------------- the weir
      {
        const wp = map.roads.find((r) => r.id === IDS.weirPath);
        if (wp) {
          const a = wp.pts[0], b = wp.pts[wp.pts.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
          let nx = -uz, nz = ux;                                          // downstream: away from the main river (west)
          if (nx > 0) { nx = -nx; nz = -nz; }
          const B0 = new RB(), B1 = new RB();
          for (const [B, q] of [[B0, 0], [B1, 1]]) {
            const E = 0.8, P = (s, t, y) => [a[0] + ux * s + nx * t, y, a[1] + uz * s + nz * t];
            // the sill: a concrete crest under the footbridge
            B.poly('concrete', [P(-E, -0.6, 0.18), P(L + E, -0.6, 0.18), P(L + E, 0.6, 0.18), P(-E, 0.6, 0.18)], [0, 1, 0]);
            B.poly('concrete', [P(-E, 0.6, 0.18), P(L + E, 0.6, 0.18), P(L + E, 0.6, 0.0), P(-E, 0.6, 0.0)], [nx, 0, nz]);
            // the fall and the white water below: a sloping sheet, then a churned apron fading out
            B.poly('foam', [P(-E, 0.6, 0.17), P(L + E, 0.6, 0.17), P(L + E, 2.2, 0.06), P(-E, 2.2, 0.06)], [nx * 0.3, 1, nz * 0.3], [[0, 0], [(L + 2 * E) / 2, 0], [(L + 2 * E) / 2, 0.8], [0, 0.8]]);
            B.poly('foam', [P(-E, 2.2, 0.06), P(L + E, 2.2, 0.06), P(L + E + 1, 7.5, 0.045), P(-E - 1, 7.5, 0.045)], [0, 1, 0], [[0, 0.8], [(L + 2 * E) / 2, 0.8], [(L + 2 * E + 2) / 2, 3.4], [0, 3.4]]);
            if (q === 0) for (let s = 0; s <= L; s += L / 4) { const [x, , z] = P(s, -0.2, 0); B.box('iron', x, 0.75, z, 0.12, 1.5, 0.3, Math.atan2(nx, nz)); }
          }
          addSite(K, 'd2:weir', [(a[0] + b[0]) / 2, 0.5, (a[1] + b[1]) / 2], L / 2 + 8, [90, 220, 0.01], [B0, B1, null], { farArea: 99 });
          S.weir = { a, b, nx, nz };
        }
      }
      // ---------------------------------------------------------------- Osney Bridge: iron railing, pilasters, lamps, board
      {
        const br = map.roads.find((r) => r.id === IDS.bridge);
        if (br) {
          const pw = br.pw !== undefined ? br.pw : 2.6, off = (br.w || 10) / 2 + (pw || 0.3) + 0.25, pts = br.pts, cum = cumOf(pts), L = cum[cum.length - 1];
          const Bq = [new RB(), new RB(), new RB()];
          for (const sd of [1, -1]) {
            const p0 = along(pts, cum, 0), p1 = along(pts, cum, L), at = (s, d) => { const p = along(pts, cum, s); return [p.x + p.nx * d, p.z + p.nz * d]; };
            for (let q = 0; q < 3; q++) {
              const B = Bq[q], A = at(0.6, sd * off), C = at(L - 0.6, sd * off);
              // a cast-iron railing on the parapet head: rails, close balusters, a lozenge band (q 0), iron fascia on the outer face
              B.beam('ironBlue', [A[0], 1.55, A[1]], [C[0], 1.55, C[1]], 0.07);
              B.beam('ironBlue', [A[0], 1.12, A[1]], [C[0], 1.12, C[1]], 0.06);
              const n = Math.round((L - 1.2) / (q ? 0.7 : 0.34));
              if (q < 2) for (let k = 0; k <= n; k++) { const t = k / n, x = A[0] + (C[0] - A[0]) * t, z = A[1] + (C[1] - A[1]) * t; B.beam('ironBlue', [x, 1.1, z], [x, 1.56, z], 0.025); }
              if (q === 0) for (let k = 0; k < n; k += 2) { const t0 = k / n, t1 = Math.min(1, (k + 2) / n), x0 = A[0] + (C[0] - A[0]) * t0, z0 = A[1] + (C[1] - A[1]) * t0, x1 = A[0] + (C[0] - A[0]) * t1, z1 = A[1] + (C[1] - A[1]) * t1; B.beam('ironBlue', [x0, 1.33, z0], [(x0 + x1) / 2, 1.45, (z0 + z1) / 2], 0.02); B.beam('ironBlue', [(x0 + x1) / 2, 1.45, (z0 + z1) / 2], [x1, 1.33, z1], 0.02); }
              const O1 = at(0.6, sd * (off + 0.245)), O2 = at(L - 0.6, sd * (off + 0.245));
              B.poly('ironBlue', [[O1[0], -0.55, O1[1]], [O2[0], -0.55, O2[1]], [O2[0], 0.95, O2[1]], [O1[0], 0.95, O1[1]]], [p0.nx * sd, 0, p0.nz * sd]);
              // end pilasters with caps; lamps on the four corners
              for (const s of [0.3, L - 0.3]) { const [x, z] = at(s, sd * off); B.box('stone', x, 0.85, z, 0.75, 1.7, 0.75, Math.atan2(p0.ux, p0.uz)); B.box('dress', x, 1.75, z, 0.9, 0.12, 0.9, Math.atan2(p0.ux, p0.uz)); lampStandard(B, x, 1.81, z, 3.0, q, 11 + (s > 1 ? 4 : 0) + (sd > 0 ? 2 : 0)); if (q === 0) { try { W.addLampGlow(x, 1.81 + 3.0 + 0.28, z); } catch { /* */ } col.addCircle(x, z, 0.45); S.lamps++; } }
              // the low-headroom board on the outer face, over the middle of the span
              const [mx, mz] = at(L / 2, sd * (off + 0.27)), wv = 3.2;
              const ux2 = p0.nz * sd, uz2 = -p0.nx * sd;
              B.push(frame(mx, 0, mz, ux2, uz2)); B.box('dark', 0, 0.55, 0.02, wv + 0.1, wv / 8 + 0.1, 0.04, 0); signAt(B, 'sign_lowBridge', -wv / 2, wv / 2, 0.55 - wv / 16, 0.55 + wv / 16, 0.045); B.pop();
            }
            void p1;
          }
          const m = along(pts, cum, L / 2);
          addSite(K, 'd2:osneybridge', [m.x, 1.5, m.z], L / 2 + 3, [100, 230, 420], Bq);
          S.bridge = { off, L };
        }
      }
      // ---------------------------------------------------------------- the railway bridge over the Botley Road
      {
        const O = [-719.3, 123.0], U = [0.178, 0.984], N = [0.984, -0.178], LS = (s, t) => [O[0] + U[0] * s + N[0] * t, O[1] + U[1] * s + N[1] * t];
        const road = map.roads.filter((r) => r.name === 'Botley Road');
        const [rx, rz] = LS(RAIL.s, 0);
        let half = 0; for (const r of road) for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; if (Math.min(a[0], b[0]) <= rx && Math.max(a[0], b[0]) >= rx) half = Math.max(half, (r.w || 10) / 2 + (r.pw !== undefined ? r.pw : 2.6) + 0.6); }
        if (half) {
          const Bq = [new RB(), new RB(), new RB()], top = RAIL.top, und = RAIL.under, t0 = RAIL.t0, t1 = RAIL.t1;
          for (let q = 0; q < 3; q++) {
            const B = Bq[q];
            B.push(frame(rx, 0, rz, N[0], N[1]));              // local x across the tracks (east), local z = U (south, across the road)
            // abutments along both edges of the road (blue engineering brick, stone coping), the deck between
            for (const sd of [-1, 1]) {
              const zz = sd * (half + 1.6);
              B.box('blueBrick', (t0 + t1) / 2, top / 2, zz, t1 - t0, top, 1.6, 0, { top: false });
              B.box('dress', (t0 + t1) / 2, top + 0.1, zz, t1 - t0 + 0.4, 0.2, 1.8, 0, { bottom: true });
              // wing walls angled back
              for (const e of [t0, t1]) B.box('blueBrick', e + Math.sign(e) * 0.4, top / 2, zz + sd * 3, 0.8, top, 6, 0, { top: true });
            }
            // steel deck: two deep plate girders at the edges, the soffit, ballast and rails on top
            for (const e of [t0 + 0.3, t1 - 0.3]) { B.box('ironBlue', e, (und + top + 0.9) / 2, 0, 0.5, top + 0.9 - und, half * 2 + 4.8, 0, { bottom: true }); if (q < 2) for (let z = -half - 1.8; z <= half + 1.8; z += 1.4) B.box('ironBlue', e + Math.sign(e) * 0.27, (und + top + 0.9) / 2, z, 0.06, top + 0.9 - und - 0.1, 0.14, 0); }
            B.poly('ironBlue', [[t0 + 0.55, und + 0.06, -half - 2.4], [t1 - 0.55, und + 0.06, -half - 2.4], [t1 - 0.55, und + 0.06, half + 2.4], [t0 + 0.55, und + 0.06, half + 2.4]], [0, -1, 0]);
            B.poly('gravel2', [[t0 + 0.6, top, -half - 2.4], [t1 - 0.6, top, -half - 2.4], [t1 - 0.6, top, half + 2.4], [t0 + 0.6, top, half + 2.4]], [0, 1, 0]);
            if (q < 2) for (const tr of [-8.3, -3.3, 1.7, 6.3]) for (const g of [-0.72, 0.72]) B.box('iron', tr + g, top + 0.08, 0, 0.08, 0.14, half * 2 + 4.8, 0);
            B.pop();
            // the embankment beyond each abutment: a grassy slope down to the ground (north towards the platforms, south)
            for (const sd of [-1, 1]) {
              const z0 = sd * (half + 2.4), z1 = sd * (half + 2.4 + (sd > 0 ? 16 : 24));
              const Pp = (t, z, y) => { const x = rx + N[0] * t + -U[0] * z, zz = rz + N[1] * t + -U[1] * z; return [x, y, zz]; };
              B.poly('grass', [Pp(t0, z0, top), Pp(t1, z0, top), Pp(t1, z1, 0.02), Pp(t0, z1, 0.02)], [0, 1, 0]);
              for (const e of [t0, t1]) B.poly('grass', [Pp(e, z0, top), Pp(e, z1, 0.02), Pp(e + Math.sign(e) * 4, z1, 0.02), Pp(e + Math.sign(e) * 4, z0, 0.02)], [Math.sign(e) * N[0], 1, Math.sign(e) * N[1]]);
            }
          }
          addSite(K, 'd2:railbridge', [rx, 3, rz], 24, [120, 300, 700], Bq);
          // collision: the abutments and wing walls (the road passes under)
          for (const sd of [-1, 1]) { const zz = sd * (half + 1.6), x = rx + N[0] * ((t0 + t1) / 2) - U[0] * zz, z = rz + N[1] * ((t0 + t1) / 2) - U[1] * zz; col.addBox(x, z, 1.6, t1 - t0, Math.atan2(N[0], N[1])); }
          for (const sd of [-1, 1]) { const z0 = sd * (half + 2.4), z1 = sd * (half + 2.4 + (sd > 0 ? 16 : 24)), Pq = (t, z) => [rx + N[0] * t - U[0] * z, rz + N[1] * t - U[1] * z]; col.addPolygon([Pq(t0 - 1, z0), Pq(t1 + 1, z0), Pq(t1 + 1, z1), Pq(t0 - 1, z1)]); }
          // no street lamp or tree under the deck (a lamp head would come up through the girders)
          { const Pq = (t, z) => [rx + N[0] * t + U[0] * z, rz + N[1] * t + U[1] * z]; try { W.clearArea([Pq(t0 - 1, -half - 2.6), Pq(t1 + 1, -half - 2.6), Pq(t1 + 1, half + 2.6), Pq(t0 - 1, half + 2.6)], { trees: true, lamps: true, furniture: false }); } catch { /* */ } }
          S.rail = { x: rx, z: rz, half };
        }
      }
      // ---------------------------------------------------------------- the pub and its riverside terrace
      {
        const dI = roadDist(map, ['East Street', 'South Street']), pb = buildingById(map, IDS.pub), f = best(pb, dI, 12);
        if (f) {
          S.pubF = f;
          const Bq = [0, 1, 2].map((q) => { const B = new RB(); pubFront(B, f, q, 'sign_osneyPub', 'navy', { maxL: 10 }); return B; });
          // the terrace: on the bank across East Street, between the road and the water
          const est = map.roads.find((r) => r.name === 'East Street' && r.pts.length > 3);
          const spots = [];
          if (est) {
            const cum = cumOf(est.pts), Le = cum[cum.length - 1];
            for (let s = 0; s < Math.min(Le, 60); s += 2.4) {
              const p = along(est.pts, cum, s); if (Math.hypot(p.x - f.mx, p.z - f.mz) > 34) continue;
              for (const sd of [1, -1]) { const x = p.x + p.nx * sd * 6.4, z = p.z + p.nz * sd * 6.4; if (col.isWater(x + p.nx * sd * 4, z + p.nz * sd * 4) && !col.isWater(x, z) && offCarriage(map, x, z, 1.2) && offBuildings(map, x, z, 1.0)) spots.push({ x, z, ux: p.ux, uz: p.uz, nx: p.nx * sd, nz: p.nz * sd }); }
            }
          }
          const used = spots.filter((_, i) => i % 2 === 0).slice(0, 5);
          for (let q = 0; q < 2; q++) used.forEach((sp, i) => { picnicTable(Bq[q], sp.x, sp.z, sp.ux, sp.uz); if (i % 2 === 0) parasol(Bq[q], sp.x + sp.ux * 0.0, sp.z + sp.uz * 0.0, i % 4 ? 'parasol' : 'awnGreen', q); });
          if (used.length > 1) { const a = used[0], b = used[used.length - 1]; for (const sp of [a, b]) for (let q = 0; q < 2; q++) Bq[q].cyl('oak', sp.x + sp.nx * 1.4, 0, sp.z + sp.nz * 1.4, 0.06, 2.8, 5, true); festoon(Bq[0], [a.x + a.nx * 1.4, 2.75, a.z + a.nz * 1.4], [b.x + b.nx * 1.4, 2.75, b.z + b.nz * 1.4], 12, 0.35, 20); for (const sp of [a, b]) col.addCircle(sp.x + sp.nx * 1.4, sp.z + sp.nz * 1.4, 0.15); }
          for (const sp of used) col.addBox(sp.x, sp.z, 1.6, 1.8, Math.atan2(sp.ux, sp.uz));
          S.terrace = used;
          addSite(K, 'd2:osneypub', [f.mx, 2, f.mz], 30, [90, 200, 360], Bq);
        }
      }
      // ---------------------------------------------------------------- moored narrowboats
      const moor = (wid, z0, z1, off, n, k0) => {
        const wl = map.waterlines.find((w) => w.id === wid); if (!wl) return [];
        const pts = wl.pts, cum = cumOf(pts), Lw = cum[cum.length - 1], out = [];
        const B = [new RB(), new RB(), new RB()];
        let s = 0; while (s < Lw && !(along(pts, cum, s).z > z0)) s += 2;
        for (let k = 0; out.length < n && s < Lw; k++) {
          const Lb = [18.5, 20, 16.8, 19.2, 17.6, 21][(k + k0) % 6], p = along(pts, cum, s + Lb / 2); if (p.z > z1) break;
          const x = p.x + p.nx * off, z = p.z + p.nz * off, h = Math.atan2(p.ux, p.uz) + (k % 2 ? Math.PI : 0);
          const ok = [-Lb / 2 + 1, 0, Lb / 2 - 1].every((o) => { const qq = along(pts, cum, s + Lb / 2 + o); return col.isWater(qq.x + qq.nx * off + qq.nx * 1.1 * Math.sign(off), qq.z + qq.nz * off + qq.nz * 1.1 * Math.sign(off)) && col.isWater(qq.x + qq.nx * off, qq.z + qq.nz * off); });
          if (ok) { for (let q = 0; q < 3; q++) narrowboat(B[q], x, z, h, Lb, k + k0, q); out.push({ x, z, h, L: Lb }); col.addBox(x, z, 2.1, Lb, h); }
          s += Lb + 3 + (k % 3);
        }
        if (out.length) { const c = out[Math.floor(out.length / 2)]; addSite(K, 'd2:boats:' + wid, [c.x, 1, c.z], 70, [80, 220, 500], B); }
        return out;
      };
      // along East Street (the island bank: the west side of the river line) and below the lock
      const wlE = map.waterlines.find((w) => w.id === IDS.eastSt);
      if (wlE) { const p = along(wlE.pts, cumOf(wlE.pts), 200); const sgn = p.nx < 0 ? 1 : -1; S.boats.push(...moor(IDS.eastSt, 330, 500, sgn * 4.6, 6, 0)); }
      const wlB = map.waterlines.find((w) => w.id === IDS.below);
      if (wlB) { const p = along(wlB.pts, cumOf(wlB.pts), 60); const sgn = p.nz > 0 ? 1 : -1; S.boats.push(...moor(IDS.below, 715, 900, sgn * 4.6, 4, 2)); }
      // ---------------------------------------------------------------- the Thames Path: benches, boards, open gates
      {
        const cells = new Map();
        const cell = (x, z) => { const k = Math.floor(x / 250) + ',' + Math.floor(z / 250); let c = cells.get(k); if (!c) cells.set(k, (c = { B: [new RB(), new RB()], x: 0, z: 0, n: 0 })); c.x += x; c.z += z; c.n++; return c; };
        const water = (x, z) => col.isWater(x, z);
        let k = 0;
        for (const [dir, ids] of Object.entries(PATHS)) for (const id of ids) {
          const r = map.roads.find((q) => q.id === id); if (!r) continue;
          const cum = cumOf(r.pts), L = cum[cum.length - 1], hw = (r.w || 2.4) / 2;
          for (let s = 25; s < L - 10; s += 70) {
            const p = along(r.pts, cum, s);
            // the river side: whichever side has water within 12 m
            let sd = 0; for (const d of [4, 7, 10, 13, 16, 20]) { if (water(p.x + p.nx * d, p.z + p.nz * d)) { sd = 1; break; } if (water(p.x - p.nx * d, p.z - p.nz * d)) { sd = -1; break; } }
            if (!sd) continue;
            const bx = p.x + p.nx * sd * (hw + 1.0), bz = p.z + p.nz * sd * (hw + 1.0);
            if (water(bx, bz) || water(bx + p.nx * sd * 0.8, bz + p.nz * sd * 0.8) || !offBuildings(map, bx, bz, 1.0) || !offCarriage(map, bx, bz, 1.0)) continue;
            const c = cell(bx, bz), kind = k % 3;
            for (let q = 0; q < 2; q++) {
              if (kind === 1) { const gx = p.x - p.nx * sd * (hw + 0.6), gz = p.z - p.nz * sd * (hw + 0.6); if (!water(gx, gz) && offBuildings(map, gx, gz, 1) && offCarriage(map, gx, gz, 1)) { fieldGate(c.B[q], gx, gz, -p.nx * sd, -p.nz * sd, 3.0, 1.35); if (q === 0) { S.gates++; col.addCircle(gx, gz, 0.15); } } }
              if (kind === 2) { boardPost(c.B[q], bx, bz, -p.ux, -p.uz, 'sign_tpath', 2.2, 1.5, q); if (q === 0) { S.boards++; col.addCircle(bx, bz, 0.2); } }
              else { riverBench(c.B[q], bx, bz, p.nx * sd, p.nz * sd); if (q === 0) { S.benches++; col.addBox(bx, bz, 0.5, 1.8, Math.atan2(p.ux, p.uz)); } }
            }
            k++;
          }
          void dir;
        }
        for (const [key, c] of cells) addSite(K, 'd2:tpath:' + key, [c.x / c.n, 0.6, c.z / c.n], 180, [70, 150, 0.01], [c.B[0], c.B[1], null], { farArea: 99 });
      }
      K.boxes.push([-900, -650, 150, 720]);
    } catch (e) { console.error('[osney] build', e); } finally { K.joined(me); }

    // ---------------------------------------------------------------- people near the lock and on the terrace
    let keeper = null, terrace = null;
    try {
      if (S.lock) { const { c, nx, nz, W: Wd } = S.lock; keeper = nearSet(game, { c, r: 70, h0: 9, h1: 18.5, people: [{ x: c[0] + nx * (Wd + 1.6), z: c[1] + nz * (Wd + 1.6), h: Math.atan2(-nx, -nz), look: randomLook('d2-lockkeeper', { outfit: 'tweed' }), pose: 'stand', lines: BOATER_LINES, label: 'Lock-keeper' }] }); }
      if (S.terrace && S.terrace.length) { const t = S.terrace; terrace = nearSet(game, { c: [t[0].x, t[0].z], r: 70, h0: 12, h1: 22.5, people: t.slice(0, 3).map((sp, i) => ({ x: sp.x + sp.uz * 0.9, z: sp.z - sp.ux * 0.9, h: Math.atan2(-sp.uz, sp.ux), look: randomLook('d2-osney-drinker-' + i, { outfit: i % 2 ? 'casual' : 'tweed' }), pose: 'stand', lines: i === 0 ? DRINK_LINES : null })) }); }
    } catch (e) { console.warn('[osney] people', e); }

    // ---------------------------------------------------------------- work the lock
    const Wk = { on: null, done: 0 };
    if (S.lock && S.lock.beams.length === 4) {
      const beams = S.lock.beams;
      const order = [beams.findIndex((b) => b[2] > 0 && b[3] < 0), beams.findIndex((b) => b[2] > 0 && b[3] > 0), beams.findIndex((b) => b[2] < 0 && b[3] < 0), beams.findIndex((b) => b[2] < 0 && b[3] > 0)];
      game.interact.add({ pos: [S.lock.c[0] + S.lock.nx * (S.lock.W + 2.4), S.lock.c[1] + S.lock.nz * (S.lock.W + 2.4)], radius: 2.4, label: () => (Wk.on ? 'Keep going - the boat is waiting' : 'Help a boat through the lock'), enabled: () => !Wk.on, onUse: () => {
        Wk.on = { t0: game.time.now(), step: 0 };
        game.ui.toast('A narrowboat is waiting below the lock. ' + WORK.steps[0][1] + '.', 5);
      } });
      order.forEach((bi, k) => { const b = beams[bi]; if (!b) return; game.interact.add({ pos: [b[0], b[1]], radius: 1.8, label: () => (Wk.on && Wk.on.step === k ? 'Push the balance beam' : 'Balance beam'), enabled: () => !!Wk.on && Wk.on.step === k, onUse: () => {
        const st = Wk.on; st.step++;
        if (st.step >= 4) { Wk.on = null; Wk.done++; game.pay(WORK.fee); try { const fl = game.state.flags || (game.state.flags = {}); fl.osneyLock = (fl.osneyLock || 0) + 1; game.save(); } catch { /* */ } game.ui.toast(`Through she goes. The boater hands you £${WORK.fee} and a slightly bent flapjack.`, 5); }
        else game.ui.toast(WORK.steps[st.step][1] + '.', 4);
      } }); });
      Wk.tick = () => { if (Wk.on && (game.time.now() - Wk.on.t0) / 1000 > WORK.secs) { Wk.on = null; game.ui.toast('The lock-keeper sighs and finishes the job himself. "Takes practice."', 4.5); } };
    }

    game.osney = {
      sights, lock: S.lock, work: { state: () => Wk.on, done: () => Wk.done, steps: WORK.steps },
      stats() { return { island: ((map._d2Osney || {}).island || []).length, boats: S.boats.length, benches: S.benches, boards: S.boards, gates: S.gates, lamps: S.lamps, terrace: (S.terrace || []).length, rail: !!S.rail, weir: !!S.weir, lock: !!S.lock, people: (keeper ? keeper.count() : 0) + (terrace ? terrace.count() : 0), boatList: S.boats, tris: Object.fromEntries(Object.entries(K.sites).filter(([kk]) => /^d2:(lock|weir|osney|rail|boats|tpath)/.test(kk)).map(([kk, v]) => [kk, v.tris])) }; },
    };
    return { update() { try { K.tick(me); if (keeper) keeper.tick(); if (terrace) terrace.tick(); if (Wk.tick) Wk.tick(); } catch (e) { if (!S.err) { S.err = true; console.error('[osney]', e); } } } };
  },
};
export { faceFrame, bulb };
