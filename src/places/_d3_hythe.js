// The station end, c. 2013: Isis Lock and its white iron bridge, the Rewley Road swing bridge (rusting, left open),
// the Oxford Canal's end at Hythe Bridge Street with its moored boats, Hythe Bridge, the riverside pub on the Castle Mill
// Stream, the club on Hythe Bridge Street, Frideswide Square before its 2015 rebuild and a late-night van (districts
// pass 3; places/hythe_bridge.js is the module, this file holds it). See docs/research/districts3.md.
//
//   preMap   under ?invented=1 invented names for the riverside pub and the club (the rest of the street keeps
//            world/tradenames.js's); by default the map's real ones (the Oxford Retreat, the Bridge)
//   install  (all in the shared batch-4 atlas draw, _b4_kit.js — no new static draw call)
//            · Isis Lock: copings, brick chamber faces, a single top gate and a mitre pair below, white balance beams,
//              the lock board; the white cast-iron footbridge over the Castle Mill Stream below it
//            · the Rewley Road swing bridge (1851) as it stood in 2013: open, rusting, on its turntable, fenced
//            · the canal's end: narrowboats moored along the towpath, the end-of-navigation board, benches
//            · Hythe Bridge: a cast-iron railing over the world's parapets, iron fascias, end pillars
//            · the pub's front and its terrace on the Castle Mill Stream (tables, parasols, festoon lights)
//            · the club front on Hythe Bridge Street (lit name, rope posts at night)
//            · Frideswide Square: guard railings on the pavement corners (the pre-2015 junction), a late-night van
//   do       Gerald: a lost green bicycle with a basket, somewhere new every game day (shared clock); find it, £2
//   sights   for the passport (game.hytheBridge.sights)
// Test hooks: game.hytheBridge = { sights, stats(), gerald }       tools/smoke_districts3.mjs
import { NORTH } from './_north_kit.js';
import { shared, addSite, RB, frame, festoon, bulb, glowCard, h01, DAY_MS } from './_b4_kit.js';
import { mergeFaces, buildingById, streetFaces, roadDist, offCarriage, offBuildings, faceFrame } from './_eo_kit.js';
import { narrowboat, obbOf } from './_jer_build.js';
import { pubFront, boardPost, riverBench, picnicTable, parasol, signAt } from './_d2_kit.js';
import { D3OFF, railRun, ownMesh, geraldBatch, cumOf, along, lerp2, nearMap } from './_d3_kit.js';
import { NAMES_D3 } from './_d3_cells.js';
import { nearSet, DRINK_LINES, BOATER_LINES, QUEUE_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';
import { tn, inventedNames } from '../core/features.js';

export const IDS = { lockLine: 'w37255018', isisBridge: 'w37200230', swing: 'w265408737', canal: 'w3220559', hythe: 'w14815077', littleHythe: 'w38770662', pub: 'w954506078', pubPoi: 'n322850714', clubPoi: 'n6641341395', square: 'w524132987' };
export const SQUARE = [-556, 238];
export const sights = [
  { id: 'd3-isislock', name: 'Isis Lock', x: -638, z: -110, blurb: 'The lock of 1795-97 that joins the Oxford Canal to the Thames by the Castle Mill Stream; narrowed in 1844. Boaters call it Louse Lock. The white iron bridge carries the towpath over the stream below it.' },
  { id: 'd3-swingbridge', name: 'The Rewley Road swing bridge', x: -725, z: -73, blurb: 'Robert Stephenson\'s railway swing bridge of 1851 over the Sheepwash Channel, left open and rusting since the line closed in 1984. A scheduled monument; nobody has swung it for years.' },
  { id: 'd3-canalend', name: 'The end of the Oxford Canal', x: -350, z: 120, blurb: 'Where the Oxford Canal stops, just short of Hythe Bridge Street; the old basin beyond was filled in and built over. Narrowboats moor nose to tail along the towpath.' },
  { id: 'd3-hythebridge', name: 'Hythe Bridge', x: -347, z: 166, blurb: 'The iron bridge of 1861 over the Castle Mill Stream, on the way in from the station; the street is named after the hithe, the old wharf, that stood by it.' },
  { id: 'd3-pub', name: NAMES_D3.pub, x: -362, z: 187, blurb: tn('The pub on the bank of the Castle Mill Stream by Hythe Bridge, its terrace over the water.', 'The pub on the bank of the Castle Mill Stream by Hythe Bridge, its terrace over the water. (An invented name for the real pub here.)') },
  { id: 'd3-frideswide', name: 'Frideswide Square', x: SQUARE[0], z: SQUARE[1], blurb: 'Station Junction, as everyone called it: traffic lights, railings, buses and a great many bicycles, with the Said Business School\'s tower above. The coal wharf and the marmalade factory were on Park End Street.' },
];
/** a wheel (octagonal disc, axle across local z) centred (x, y, z), radius r, width w */
function wheel(B, x, y, z, r, w) {
  const P = (k, zz) => [x + Math.cos((k / 8) * Math.PI * 2) * r, y + Math.sin((k / 8) * Math.PI * 2) * r, zz];
  for (const sd of [-1, 1]) B.poly('rubber', [0, 1, 2, 3, 4, 5, 6, 7].map((k) => P(k, z + sd * w / 2)), [0, 0, sd]);
  for (let k = 0; k < 8; k++) { const m = ((k + 0.5) / 8) * Math.PI * 2; B.poly('rubber', [P(k, z - w / 2), P(k + 1, z - w / 2), P(k + 1, z + w / 2), P(k, z + w / 2)], [Math.cos(m), Math.sin(m), 0]); }
}
const best = (b, d, reach = 12) => { if (!b) return null; const fs = mergeFaces(streetFaces(b.poly, d, reach)); fs.sort((a, c) => c.L - a.L); return fs[0] || null; };
const night = (game) => () => { const h = game.time.hour; return h >= 21 || h < 3; };

/** pure: Gerald's spot today (index into spots), a function of the game day */
export const geraldSpot = (tMs, n) => Math.floor(h01(Math.floor(tMs / DAY_MS), 913) * n) % n;
export const GERALD = { reward: 2, r: 2.4 };

export default {
  id: 'hythe_bridge',
  preMap(game) {
    if (D3OFF()) return;
    try {
      const m = game.map; if (!m || m._d3Hythe) return;
      Object.defineProperty(m, '_d3Hythe', { value: true, enumerable: false });
      if (NORTH) game.overrides.skip.add(IDS.isisBridge);                        // the roving bridge is drawn (humped) by install; still walkable (map collision)
      if (inventedNames()) for (const [id, name] of [[IDS.pubPoi, NAMES_D3.pub], [IDS.clubPoi, NAMES_D3.club]]) { const p = m.pois.find((q) => q.id === id); if (p) { p.name = name; if (p.tags) { p.tags.name = name; delete p.tags.brand; } } }
    } catch (e) { console.error('[hythe_bridge] preMap', e); }
  },

  install(game) {
    if (D3OFF()) return null;
    const K = shared(game), me = K.join('hythe_bridge'), map = game.map, col = game.worldCollider, W = game.world;
    const S = { err: false, boats: [], railings: 0, benches: 0, spots: [], lock: null, swing: null, pubF: null, clubF: null, van: null, terrace: [] };
    const wet = (x, z) => col.isWater(x, z);
    try {
      // ---------------------------------------------------------------- Isis Lock
      if (!K.pack.cells.has('nwPaver')) K.pack.cells.set('nwPaver', { ...K.pack.cells.get('brick'), tint: [0.58, 0.74, 0.8] });   // worn brown brick paving
      const ll = map.waterlines.find((w) => w.id === IDS.lockLine);
      if (ll) {
        const a = ll.pts[0], b = ll.pts[ll.pts.length - 1], L0 = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / L0, uz = (b[1] - a[1]) / L0, nx = -uz, nz = ux, c = lerp2(a, b, 0.5), hl = Math.min(12, L0 / 2 - 1), cw = 1.2;
        const P = (s, t) => [c[0] + ux * s + nx * t, c[1] + uz * s + nz * t];
        // how far the water reaches either side of the chamber's line (the wall top fills it)
        const reach = (sd) => { let t = cw; while (t < 7 && wet(...P(0, sd * (t + 0.25)))) t += 0.25; return t + 0.3; };
        const R = { 1: reach(1), [-1]: reach(-1) };
        const Bq = [new RB(), new RB(), new RB()], beams = [];
        for (let q = 0; q < 3; q++) {
          const B = Bq[q];
          B.push(frame(c[0], 0, c[1], ux, uz));                         // local x along the lock (towards the stream), z across
          for (const sd of [-1, 1]) {
            const r = R[sd];
            // the lock wall: a stone-capped brick top from the chamber edge to the bank, brick face down into the water
            // (north pass: the lock sides are brick paving behind a stone coping, not a pale deck)
            if (NORTH && r - cw > 0.9) { B.box('dress', 0, 0.06, sd * (cw + 0.25), hl * 2 + 1.4, 0.24, 0.5, 0, { bottom: false }); B.box('nwPaver', 0, 0.05, sd * (cw + 0.5 + (r - cw - 0.5) / 2), hl * 2 + 1.4, 0.22, r - cw - 0.5, 0, { bottom: false }); }
            else B.box('dress', 0, 0.06, sd * (cw + (r - cw) / 2), hl * 2 + 1.4, 0.24, r - cw, 0, { bottom: false });
            if (q < 2) B.box('lockWhite', 0, 0.185, sd * (cw + 0.07), hl * 2 + 1.2, 0.01, 0.12, 0, { bottom: false });
            B.poly('brickDk', [[-hl - 0.7, -0.8, sd * cw], [hl + 0.7, -0.8, sd * cw], [hl + 0.7, -0.06, sd * cw], [-hl - 0.7, -0.06, sd * cw]], [0, 0, -sd]);
            if (q === 0) for (let s = -hl + 2; s < hl - 1; s += 5) B.cyl('lockBlack', s, 0.18, sd * (cw + 0.45), 0.12, 0.42, 8, true, 0.1);
          }
          // the top gate (one leaf, at the canal end) and the bottom pair (towards the stream); walkways, white rails
          const gate = (x0, z0, x1, z1) => { const ang = Math.atan2(z1 - z0, x1 - x0), len = Math.hypot(x1 - x0, z1 - z0); B.box('tar', (x0 + x1) / 2, -0.05, (z0 + z1) / 2, len, 1.5, 0.3, -ang, { bottom: false }); if (q < 2) { B.box('oak', (x0 + x1) / 2, 0.72, (z0 + z1) / 2, len, 0.06, 0.45, -ang, { bottom: true }); B.beam('lockWhite', [x0, 1.6, z0], [x1, 1.6, z1], 0.04); B.beam('lockWhite', [x0, 0.75, z0], [x0, 1.62, z0], 0.035); B.beam('lockWhite', [x1, 0.75, z1], [x1, 1.62, z1], 0.035); } };
          gate(-hl, -cw, -hl, cw);
          for (const sd of [-1, 1]) gate(hl, sd * cw, hl - 0.38 * cw, 0);
          // balance beams over the walls: the top gate's on the towpath side, the bottom pair one each side
          for (const [gx, sd, e] of [[-hl, 1, -1], [hl, -1, 1], [hl, 1, 1]]) {
            const bx0 = gx, bz0 = sd * (cw + 0.3), bx1 = gx - e * 4.2, bz1 = sd * (cw + 1.3);
            B.box('lockWhite', (bx0 + bx1) / 2, 0.95, (bz0 + bz1) / 2, Math.hypot(bx1 - bx0, bz1 - bz0), 0.26, 0.26, -Math.atan2(bz1 - bz0, bx1 - bx0));
            B.box('lockBlack', bx1 - (bx1 - bx0) * 0.07, 0.95, bz1 - (bz1 - bz0) * 0.07, Math.hypot(bx1 - bx0, bz1 - bz0) * 0.14, 0.3, 0.31, -Math.atan2(bz1 - bz0, bx1 - bx0));
            if (q === 0) beams.push(P(bx1, bz1));
          }
          B.pop();
        }
        // the lock board on the bank and a life ring
        const sd0 = R[1] < R[-1] ? 1 : -1, [bx, bz] = P(-hl * 0.3, sd0 * (R[sd0] + 1.3));
        if (!wet(bx, bz) && offBuildings(map, bx, bz, 0.5)) { boardPost(Bq[0], bx, bz, -nx * sd0, -nz * sd0, 'sign_isis', 1.6, 1.5, 0); boardPost(Bq[1], bx, bz, -nx * sd0, -nz * sd0, 'sign_isis', 1.6, 1.5, 1); col.addCircle(bx, bz, 0.3); }
        addSite(K, 'd3:isislock', [c[0], 0.6, c[1]], hl + 6, [100, 240, 520], Bq);
        // the wall tops over the water are solid (they are not swum through); the chamber stays open water
        for (const sd of [-1, 1]) { const r = R[sd], [x, z] = P(0, sd * (cw + (r - cw) / 2)); if (r - cw > 0.6) col.addBox(x, z, r - cw, hl * 2 + 1.4, Math.atan2(ux, uz)); }
        for (const p of beams) col.addCircle(p[0], p[1], 0.2);
        S.lock = { c, ux, uz, hl, R, beams };
        // the willows on the lock walls would bury it: none on the walls, the towpath beside them or the ends (from the
        // towpath the lock's gates and beams used to be a glimpse through hanging willow)
        try { W.clearArea([P(-hl - 8, -R[-1] - 7), P(hl + 8, -R[-1] - 7), P(hl + 8, R[1] + 7), P(-hl - 8, R[1] + 7)], { trees: true, lamps: false, furniture: false }); } catch { /* */ }
      }
      // ---------------------------------------------------------------- the iron roving bridge below the lock
      // (photo comparison north, item 1: Bridge 243, a high cast-iron arch on brick abutments, black with white edges,
      // steep ramps up to it. The mapped way is skipped in preMap and drawn here; the deck is a real hump you walk
      // over: world.groundHeight is wrapped along the strip. Rise, ramp length and paint are a GUESS from photographs.)
      if (NORTH) {
        const r = map.roads.find((q) => q.id === IDS.isisBridge);
        if (r) {
          const A = r.pts[0], C = r.pts[r.pts.length - 1], L = Math.hypot(C[0] - A[0], C[1] - A[1]), ux = (C[0] - A[0]) / L, uz = (C[1] - A[1]) / L, nx = -uz, nz = ux, hw = (r.w || 2.4) / 2, off = hw + 0.14;
          const EXT = 2.2, H = 2.7, LL = L + EXT * 2;
          const hump = (s) => { const t = (s + EXT) / LL; return t <= 0 || t >= 1 ? 0 : H * 0.5 * (1 - Math.cos(t * Math.PI * 2)); };
          // where the water is under the centre line: the abutment faces stand on its banks
          let s1 = L * 0.24, s2 = L * 0.76;
          { let a = null, b = null; for (let s = 0; s <= L; s += 0.25) if (wet(A[0] + ux * s, A[1] + uz * s)) { if (a === null) a = s; b = s; } if (a !== null && b - a > 3) { s1 = Math.max(1.5, a - 0.3); s2 = Math.min(L - 1.5, b + 0.3); } }
          const P3 = (s, t, y) => [A[0] + ux * s + nx * t, y, A[1] + uz * s + nz * t], sm = (s1 + s2) / 2, half = (s2 - s1) / 2;
          const soffit = (s) => { const k = (s - sm) / half; return (hump(sm) - 0.34) - (hump(sm) - 0.34 - 0.15) * k * k; };   // the arch's underside: a parabola from the springings
          const R0 = Math.atan2(ux, uz);
          if (!K.pack.cells.has('nwDarkBrick')) K.pack.cells.set('nwDarkBrick', { ...K.pack.cells.get('brick'), tint: [0.4, 0.46, 0.5] });   // dark purple-brown engineering brick (the brick cell is red: green and blue raised to dull it)
          const Bq = [new RB(), new RB(), new RB()];
          for (let q = 0; q < 3; q++) {
            const B = Bq[q], N = q === 0 ? 28 : q === 1 ? 14 : 8;
            // the deck: planks over the hump (and the soffit of the span, seen from the water)
            for (let k = 0; k < N; k++) {
              const sa = -EXT + (k / N) * LL, sb = -EXT + ((k + 1) / N) * LL, ya = hump(sa) + 0.03, yb = hump(sb) + 0.03;
              B.poly((sa + sb) / 2 > s1 && (sa + sb) / 2 < s2 ? 'planks' : 'brick', [P3(sa, -hw, ya), P3(sb, -hw, yb), P3(sb, hw, yb), P3(sa, hw, ya)], [0, 1, 0], [[sa, 0], [sb, 0], [sb, hw * 2], [sa, hw * 2]]);
              if (q < 2 && sb > s1 && sa < s2) B.poly('lockBlack', [P3(sa, -hw, ya - 0.16), P3(sb, -hw, yb - 0.16), P3(sb, hw, yb - 0.16), P3(sa, hw, ya - 0.16)], [0, -1, 0]);
            }
            for (const sd of [-1, 1]) {
              const t = sd * off, out = [nx * sd, 0, nz * sd];
              // the ramps: brick walls from the ground up to a parapet 1.05 m over the deck, a stone coping
              for (const [e0, e1] of [[-EXT, s1], [s2, L + EXT]]) {
                const n = q === 0 ? 6 : 3;
                for (let k = 0; k < n; k++) {
                  const sa = e0 + ((e1 - e0) * k) / n, sb = e0 + ((e1 - e0) * (k + 1)) / n, ya = hump(sa) + 1.05, yb = hump(sb) + 1.05;
                  for (const [tt, o] of [[t + sd * 0.17, 1], [t - sd * 0.17, -1]]) B.poly('nwDarkBrick', [P3(sa, tt, -0.6), P3(sb, tt, -0.6), P3(sb, tt, yb), P3(sa, tt, ya)], [out[0] * o, 0, out[2] * o], [[sa, -0.6], [sb, -0.6], [sb, yb], [sa, ya]]);
                  B.poly('dress', [P3(sa, t - sd * 0.22, ya), P3(sb, t - sd * 0.22, yb), P3(sb, t + sd * 0.22, yb), P3(sa, t + sd * 0.22, ya)], [0, 1, 0]);
                }
              }
              // brick piers at the abutments and at the foot of each ramp
              for (const [s, top] of [[s1, hump(s1) + 1.45], [s2, hump(s2) + 1.45], [-EXT, 1.2], [L + EXT, 1.2]]) {
                const p = P3(s, t, 0); B.box('nwDarkBrick', p[0], (top - 0.6) / 2, p[2], 0.62, top + 0.6, 0.62, R0, { bottom: false });
                if (q < 2) B.box('dress', p[0], top + 0.06, p[2], 0.74, 0.12, 0.74, R0, { bottom: true });
              }
              // the span: the arched plate rib (black) between soffit and deck, white-edged, and the lattice railing over it
              const n = q === 0 ? 14 : q === 1 ? 8 : 4;
              for (let k = 0; k < n; k++) {
                const sa = s1 + ((s2 - s1) * k) / n, sb = s1 + ((s2 - s1) * (k + 1)) / n, da = hump(sa), db = hump(sb), ua = Math.min(soffit(sa), da - 0.2), ub = Math.min(soffit(sb), db - 0.2);
                for (const o of [1, -1]) {
                  if (o < 0 && q > 0) continue;
                  B.poly('lockBlack', [P3(sa, t, ua), P3(sb, t, ub), P3(sb, t, db + 0.06), P3(sa, t, da + 0.06)], [out[0] * o, 0, out[2] * o]);
                  B.poly('latticeDk', [P3(sa, t, da + 0.06), P3(sb, t, db + 0.06), P3(sb, t, db + 1.08), P3(sa, t, da + 1.08)], [out[0] * o, 0, out[2] * o], [[sa, 0], [sb, 0], [sb, 1], [sa, 1]]);
                }
                if (q < 2) {
                  B.beam('lockWhite', P3(sa, t + sd * 0.03, ua + 0.03), P3(sb, t + sd * 0.03, ub + 0.03), 0.07);
                  B.beam('lockWhite', P3(sa, t + sd * 0.03, da + 0.05), P3(sb, t + sd * 0.03, db + 0.05), 0.06);
                  B.beam('lockBlack', P3(sa, t, da + 1.1), P3(sb, t, db + 1.1), 0.07);
                }
              }
            }
            // the abutment faces across the stream (brick, under the deck) and the ramps' ends
            for (const [s, e] of [[s1, 1], [s2, -1]]) B.poly('nwDarkBrick', [P3(s, -off, -0.8), P3(s, off, -0.8), P3(s, off, hump(s)), P3(s, -off, hump(s))], [ux * e, 0, uz * e]);
          }
          addSite(K, 'd3:isisbridge', [(A[0] + C[0]) / 2, 1.4, (A[1] + C[1]) / 2], LL / 2 + 2, [110, 260, 520], Bq);
          for (const sd of [-1, 1]) {
            for (const s of [-EXT, s1, s2, L + EXT]) { const p = P3(s, sd * off, 0); col.addCircle(p[0], p[2], 0.34); }
            const a = P3(-EXT, sd * off, 0), b = P3(L + EXT, sd * off, 0); col.addPolyline([[a[0], a[2]], [b[0], b[2]]], { tag: 'railing', low: true });
          }
          // walkable: the drawn ground rises over the hump (the player, walkers and bikes all read world.groundHeight)
          { const prev = W.groundHeight, x0 = A[0], z0 = A[1], lim = hw + 0.3;
            W.groundHeight = (x, z) => { const dx = x - x0, dz = z - z0, s = dx * ux + dz * uz; if (s > -EXT && s < L + EXT && Math.abs(dx * nx + dz * nz) < lim) return prev(x, z) + hump(s); return prev(x, z); }; }
          S.isisBridge = { A, C, H, hump };
          try { const e = 4, w = 7; W.clearArea([[A[0] - ux * e - nx * w, A[1] - uz * e - nz * w], [C[0] + ux * e - nx * w, C[1] + uz * e - nz * w], [C[0] + ux * e + nx * w, C[1] + uz * e + nz * w], [A[0] - ux * e + nx * w, A[1] - uz * e + nz * w]], { trees: true, lamps: true, furniture: true }); } catch { /* */ }
        }
      } else   // ?north=0: the low white bridge as it was
      {
        const r = map.roads.find((q) => q.id === IDS.isisBridge);
        if (r) {
          const A = r.pts[0], C = r.pts[r.pts.length - 1], L = Math.hypot(C[0] - A[0], C[1] - A[1]), ux = (C[0] - A[0]) / L, uz = (C[1] - A[1]) / L, nx = -uz, nz = ux, off = (r.w || 2.4) / 2 + 0.28;
          const hump = (t) => Math.sin(t * Math.PI) * 0.45;
          const Bq = [new RB(), new RB(), new RB()];
          for (let q = 0; q < 3; q++) {
            const B = Bq[q];
            for (const sd of [-1, 1]) {
              const a = [A[0] + nx * sd * off, A[1] + nz * sd * off], b = [C[0] + nx * sd * off, C[1] + nz * sd * off];
              railRun(B, a, b, 0.12, 1.05, q, 'whiteIron', 0.2, hump);
              // the arched side rib (lattice face) under the railing: from the banks down to the springings and up to the crown
              const n = q ? 6 : 12, F = (t, y) => { const p = lerp2(a, b, t); return [p[0], y, p[1]]; };
              for (let k = 0; k < n; k++) {
                const t0 = k / n, t1 = (k + 1) / n, yb0 = -0.55 + Math.sin(t0 * Math.PI) * 0.5, yb1 = -0.55 + Math.sin(t1 * Math.PI) * 0.5;
                B.poly('lattice', [F(t0, yb0), F(t1, yb1), F(t1, 0.14 + hump(t1) * 0.25), F(t0, 0.14 + hump(t0) * 0.25)], [nx * sd, 0, nz * sd], [[t0 * L, 0], [t1 * L, 0], [t1 * L, 1], [t0 * L, 1]]);
              }
              // stone pillars at each end
              for (const p of [a, b]) { B.box('dress', p[0], 0.55, p[1], 0.5, 1.4, 0.5, Math.atan2(ux, uz)); if (q < 2) B.box('dress', p[0], 1.3, p[1], 0.62, 0.1, 0.62, Math.atan2(ux, uz), { bottom: true }); }
            }
          }
          addSite(K, 'd3:isisbridge', [(A[0] + C[0]) / 2, 0.6, (A[1] + C[1]) / 2], L / 2 + 2, [90, 220, 480], Bq);
          for (const sd of [-1, 1]) for (const p of [A, C]) col.addCircle(p[0] + nx * sd * off, p[1] + nz * sd * off, 0.3);
          S.isisBridge = { A, C };
          try { const e = 4, w = 7; W.clearArea([[A[0] - ux * e - nx * w, A[1] - uz * e - nz * w], [C[0] + ux * e - nx * w, C[1] + uz * e - nz * w], [C[0] + ux * e + nx * w, C[1] + uz * e + nz * w], [A[0] - ux * e + nx * w, A[1] - uz * e + nz * w]], { trees: true, lamps: false, furniture: false }); } catch { /* */ }
        }
      }
      // ---------------------------------------------------------------- the Rewley Road swing bridge, open and rusting
      {
        const ar = map.areas.find((a) => a.id === IDS.swing);
        if (ar) {
          const O = obbOf(ar.poly), { c, ux, uz } = O, L = O.L, Wd = Math.max(1.9, O.W), nx = -uz, nz = ux;
          const Bq = [new RB(), new RB(), new RB()], piv = -L * 0.32;
          // levels (m above the ground): the masonry pier and its roller race, the girders' bottom flange, the deck
          const yP = 0.95, yB = 1.25, yD = 1.55;
          for (let q = 0; q < 3; q++) {
            const B = Bq[q];
            B.push(frame(c[0], 0, c[1], ux, uz));
            // the turntable: a round stone pier, a cast-iron roller race and its rollers, the centre pivot under the span
            B.cyl('stone', piv, 0, 0, Wd + 0.7, yP - 0.12, q ? 10 : 18, true);
            if (q < 2) B.cyl('dress', piv, yP - 0.12, 0, Wd + 0.85, 0.12, q ? 10 : 18, true);
            B.cyl('rustDk', piv, yP + 0.01, 0, Wd + 0.15, 0.15, q ? 10 : 18, true);
            if (q === 0) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; B.cyl('iron', piv + Math.cos(a) * (Wd - 0.1), yP + 0.17, Math.sin(a) * (Wd - 0.1), 0.16, yB - yP - 0.19, 6, true); }
            B.cyl('rust', piv, yP + 0.17, 0, 0.55, yB - yP - 0.19, 8, true);
            // the tail's rest: a stone block under the landward end
            B.box('stone', -L + 1.1, yP / 2, 0, 1.6, yP, Wd * 2 + 0.6, 0, { bottom: false });
            if (q < 2) B.box('dress', -L + 1.1, yP + 0.05, 0, 1.75, 0.1, Wd * 2 + 0.75, 0, { bottom: false });
            // two deep plate girders standing above the deck (a through-girder span): deepest over the turntable,
            // tapering to the tail and the nose; top and bottom flanges, vertical stiffeners down both faces
            for (const sd of [-1, 1]) {
              const zz = sd * (Wd - 0.15), prof = [[-L, 1.5], [piv - 2.5, 2.6], [piv + 2.5, 2.6], [L, 1.55]];
              const hAt = (x) => { for (let k = 0; k < prof.length - 1; k++) { const [x0, h0] = prof[k], [x1, h1] = prof[k + 1]; if (x <= x1) return h0 + (h1 - h0) * (x - x0) / (x1 - x0 || 1); } return prof[prof.length - 1][1]; };
              for (let k = 0; k < prof.length - 1; k++) {
                const [x0, h0] = prof[k], [x1, h1] = prof[k + 1];
                B.poly('rust', [[x0, yB, zz + sd * 0.12], [x1, yB, zz + sd * 0.12], [x1, yB + h1, zz + sd * 0.12], [x0, yB + h0, zz + sd * 0.12]], [0, 0, sd], [[x0, 0], [x1, 0], [x1, h1], [x0, h0]]);
                B.poly('rustDk', [[x0, yB, zz - sd * 0.12], [x1, yB, zz - sd * 0.12], [x1, yB + h1, zz - sd * 0.12], [x0, yB + h0, zz - sd * 0.12]], [0, 0, -sd], [[x0, 0], [x1, 0], [x1, h1], [x0, h0]]);
                // the top flange: a plate wider than the web, along the girder's top edge
                const tl = Math.hypot(x1 - x0, h1 - h0);
                B.poly('rustDk', [[x0, yB + h0 + 0.07, zz - sd * 0.3], [x1, yB + h1 + 0.07, zz - sd * 0.3], [x1, yB + h1 + 0.07, zz + sd * 0.3], [x0, yB + h0 + 0.07, zz + sd * 0.3]], [0, 1, 0], [[0, 0], [tl, 0], [tl, 0.6], [0, 0.6]]);
                for (const s2 of [-1, 1]) B.poly('rustDk', [[x0, yB + h0, zz + s2 * 0.3], [x1, yB + h1, zz + s2 * 0.3], [x1, yB + h1 + 0.07, zz + s2 * 0.3], [x0, yB + h0 + 0.07, zz + s2 * 0.3]], [0, 0, s2]);
              }
              // the bottom flange
              B.box('rustDk', 0, yB + 0.04, zz, L * 2, 0.08, 0.6, 0, {});
              // the stiffeners (T-ribs every 1.2 m, both faces) and the girder's ends
              if (q < 2) for (let x = -L + 0.6; x < L - 0.3; x += q ? 2.4 : 1.2) { const h = hAt(x); for (const f of [1, -1]) B.box('rustDk', x, yB + h / 2, zz + f * 0.17, 0.1, h, 0.1, 0, { top: false, bottom: false }); }
              for (const x of [-L, L]) B.poly('rustDk', [[x, yB, zz - sd * 0.12], [x, yB, zz + sd * 0.12], [x, yB + hAt(x), zz + sd * 0.12], [x, yB + hAt(x), zz - sd * 0.12]], [Math.sign(x), 0, 0]);
            }
            // between the girders: cross girders under a timber deck, sleepers, the two rails (left in place) and ballast
            if (q < 2) for (let x = -L + 0.9; x < L - 0.5; x += q ? 3.6 : 1.8) B.box('rustDk', x, (yB + yD) / 2, 0, 0.28, yD - yB, Wd * 2 - 0.5, 0, { top: false });
            B.poly('rustDk', [[-L, yB, -Wd + 0.27], [L, yB, -Wd + 0.27], [L, yB, Wd - 0.27], [-L, yB, Wd - 0.27]], [0, -1, 0]);
            B.poly('deck', [[-L, yD, -Wd + 0.27], [L, yD, -Wd + 0.27], [L, yD, Wd - 0.27], [-L, yD, Wd - 0.27]], [0, 1, 0], [[0, 0], [L * 2, 0], [L * 2, Wd * 2], [0, Wd * 2]]);
            if (q < 2) {
              for (let x = -L + 0.5; x < L - 0.3; x += q ? 1.6 : 0.65) B.box('tar', x, yD + 0.06, 0, 0.24, 0.12, 2.5, 0, { bottom: false });
              for (const g of [-0.72, 0.72]) { B.box('lamp', 0, yD + 0.2, g, L * 2 - 0.3, 0.16, 0.07, 0, { bottom: false }); if (q === 0) B.box('concrete', 0, yD + 0.285, g, L * 2 - 0.3, 0.012, 0.075, 0, { bottom: false }); }
            }
            // weeds and buddleia on the old deck, in the corners and along the girders
            if (q === 0) for (let k = 0; k < 14; k++) { const x = -L + 0.8 + k * (L * 2 - 1.6) / 13, zz = (h01(k, 5) - 0.5) * (Wd * 2 - 1.2); B.cyl('foliage', x, yD + 0.1, zz, 0.16 + h01(k, 6) * 0.22, 0.25 + h01(k, 7) * 0.5, 6, true, 0.06); }
            B.pop();
            // a rusty danger board on a post at the landward end
            if (q < 2) { const [bx, bz] = [c[0] - ux * (L + 1.2) - nx * (Wd + 0.8), c[1] - uz * (L + 1.2) - nz * (Wd + 0.8)]; if (!wet(bx, bz)) boardPost(B, bx, bz, -ux, -uz, 'sign_swing', 2.0, 1.4, q); }
          }
          addSite(K, 'd3:swing', [c[0], 1.8, c[1]], L + 3, [100, 240, 520], Bq);
          col.addBox(c[0], c[1], Wd * 2, L * 2, Math.atan2(ux, uz));
          S.swing = { c, L, W: Wd };
          try { const Q = (s1, t1) => [c[0] + ux * s1 + nx * t1, c[1] + uz * s1 + nz * t1]; W.clearArea([Q(-L - 2, -Wd - 2), Q(L + 2, -Wd - 2), Q(L + 2, Wd + 2), Q(-L - 2, Wd + 2)], { trees: true, lamps: false, furniture: false }); } catch { /* */ }
        }
      }
      // ---------------------------------------------------------------- the canal's end: moored boats, board, benches
      {
        const wl = map.waterlines.find((w) => w.id === IDS.canal);
        if (wl) {
          const pts = wl.pts, cum = cumOf(pts), Lw = cum[cum.length - 1];
          // the towpath side: whichever side the mapped footway (w3234996) runs
          const tp = map.roads.find((r) => r.id === 'w3234996');
          const p0 = along(pts, cum, Lw - 120); let sd = 1;
          if (tp) { let dPlus = Infinity, dMinus = Infinity; for (const q of tp.pts) { dPlus = Math.min(dPlus, Math.hypot(q[0] - (p0.x + p0.nx * 8), q[1] - (p0.z + p0.nz * 8))); dMinus = Math.min(dMinus, Math.hypot(q[0] - (p0.x - p0.nx * 8), q[1] - (p0.z - p0.nz * 8))); } sd = dPlus < dMinus ? 1 : -1; }
          const B = [new RB(), new RB(), new RB()], off = sd * 2.9;
          let s = Lw - 230, k = 0;
          while (s < Lw - 14 && S.boats.length < 7) {
            const Lb = [18.5, 20, 16.8, 19.2, 17.6, 21][(k + 3) % 6], p = along(pts, cum, s + Lb / 2);
            const x = p.x + p.nx * off, z = p.z + p.nz * off, h = Math.atan2(p.ux, p.uz) + (k % 2 ? Math.PI : 0);
            const ok = [-Lb / 2 + 1, 0, Lb / 2 - 1].every((o) => { const qq = along(pts, cum, s + Lb / 2 + o); return wet(qq.x + qq.nx * off, qq.z + qq.nz * off) && wet(qq.x + qq.nx * (off + sd * 1.1), qq.z + qq.nz * (off + sd * 1.1)) && wet(qq.x + qq.nx * (off - sd * 1.1), qq.z + qq.nz * (off - sd * 1.1)) && offCarriage(map, qq.x + qq.nx * off, qq.z + qq.nz * off, 1.2); });
            if (ok) { for (let q = 0; q < 3; q++) narrowboat(B[q], x, z, h, Lb, k + 5, q); S.boats.push({ x, z, h, L: Lb }); col.addBox(x, z, 2.1, Lb, h); }
            s += Lb + 2.5 + (k % 3); k++;
          }
          if (S.boats.length) { const cc = S.boats[Math.floor(S.boats.length / 2)]; addSite(K, 'd3:boats', [cc.x, 1, cc.z], 90, [90, 230, 500], B); }
          // the end-of-navigation board and two benches on the towpath
          const Bb = [new RB(), new RB()];
          let pe = null, ex = 0, ez = 0;
          for (const ds of [6, 10, 14, 18, 24, 30]) for (const d of [6.2, 7.5, 9]) { if (pe) break; const p = along(pts, cum, Lw - ds), x = p.x + p.nx * sd * d, z = p.z + p.nz * sd * d; if (!wet(x, z) && !wet(x - p.nx * sd * 1.2, z - p.nz * sd * 1.2) && offCarriage(map, x, z, 1) && offBuildings(map, x, z, 0.6)) { pe = p; ex = x; ez = z; } }
          if (pe) { for (let q = 0; q < 2; q++) boardPost(Bb[q], ex, ez, -pe.nx * sd, -pe.nz * sd, 'sign_canalEnd', 2.6, 1.4, q); col.addCircle(ex, ez, 0.3); S.endBoard = [ex, ez]; }
          for (const ds of [40, 110]) {
            const p = along(pts, cum, Lw - ds), x = p.x + p.nx * sd * 6.6, z = p.z + p.nz * sd * 6.6;
            if (wet(x, z) || !offBuildings(map, x, z, 1) || !offCarriage(map, x, z, 1)) continue;
            for (let q = 0; q < 2; q++) riverBench(Bb[q], x, z, -p.nx * sd, -p.nz * sd); col.addBox(x, z, 0.5, 1.8, Math.atan2(p.ux, p.uz)); S.benches++;
          }
          const pm = along(pts, cum, Lw - 60);
          addSite(K, 'd3:canalend', [pm.x, 0.8, pm.z], 70, [70, 160, 0.01], [Bb[0], Bb[1], null], { farArea: 99 });
          S.canal = { pts, cum, Lw, sd };
        }
      }
      // ---------------------------------------------------------------- Hythe Bridge (and Little Hythe Bridge): iron railings
      for (const id of [IDS.hythe, IDS.littleHythe]) {
        const br = map.roads.find((r) => r.id === id); if (!br) continue;
        const pw = br.pw !== undefined ? br.pw : 2.4, off = (br.w || 10) / 2 + (pw || 0.3) + 0.25, pts = br.pts, cum = cumOf(pts), L = cum[cum.length - 1];
        const Bq = [new RB(), new RB(), new RB()];
        for (const sd of [1, -1]) {
          const at = (s, d) => { const p = along(pts, cum, s); return [p.x + p.nx * d, p.z + p.nz * d]; };
          const p0 = along(pts, cum, 0);
          for (let q = 0; q < 3; q++) {
            const B = Bq[q], A = at(0.5, sd * off), C = at(L - 0.5, sd * off);
            railRun(B, A, C, 1.05, 0.55, q, 'iron', 0.14);
            const O1 = at(0.5, sd * (off + 0.245)), O2 = at(L - 0.5, sd * (off + 0.245));
            B.poly('iron', [[O1[0], -0.5, O1[1]], [O2[0], -0.5, O2[1]], [O2[0], 0.98, O2[1]], [O1[0], 0.98, O1[1]]], [p0.nx * sd, 0, p0.nz * sd]);
            for (const s of [0.25, L - 0.25]) { const [x, z] = at(s, sd * off); B.box('stone', x, 0.85, z, 0.7, 1.7, 0.7, Math.atan2(p0.ux, p0.uz)); if (q < 2) B.box('dress', x, 1.75, z, 0.84, 0.1, 0.84, Math.atan2(p0.ux, p0.uz), { bottom: true }); }
          }
        }
        const m = along(pts, cum, L / 2);
        addSite(K, 'd3:hythe:' + id, [m.x, 1.2, m.z], L / 2 + 2, [90, 220, 420], Bq);
        S.railings++;
      }
      // ---------------------------------------------------------------- the pub on the Castle Mill Stream and its terrace
      {
        const dH = roadDist(map, ['Hythe Bridge Street']), pb = buildingById(map, IDS.pub), f = best(pb, dH, 14);
        if (f) {
          S.pubF = f;
          const Bq = [0, 1, 2].map((q) => { const B = new RB(); pubFront(B, f, q, 'sign_pubD3', 'navy', { maxL: 9 }); return B; });
          // terrace spots: dry ground within a few metres of the stream, round the pub, off the road and the buildings
          const spots = [], nm = nearMap(map, pb.c[0], pb.c[1], 30);
          for (let x = pb.c[0] - 26; x <= pb.c[0] + 26; x += 2.2) for (let z = pb.c[1] - 26; z <= pb.c[1] + 26; z += 2.2) {
            if (wet(x, z) || !offCarriage(nm, x, z, 2.5) || !offBuildings(nm, x, z, 1.4)) continue;
            let near = false; for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (wet(x + dx, z + dz)) near = true;
            if (!near || wet(x + 1.2, z) || wet(x - 1.2, z) || wet(x, z + 1.2) || wet(x, z - 1.2)) continue;
            if (spots.some((p) => Math.hypot(p.x - x, p.z - z) < 3.4)) continue;
            spots.push({ x, z });
          }
          spots.sort((a, b) => Math.hypot(a.x - pb.c[0], a.z - pb.c[1]) - Math.hypot(b.x - pb.c[0], b.z - pb.c[1]));
          const used = spots.slice(0, 5);
          for (let q = 0; q < 2; q++) used.forEach((sp, i) => { picnicTable(Bq[q], sp.x, sp.z, 1, 0); if (i % 2 === 0) parasol(Bq[q], sp.x, sp.z, i % 4 ? 'parasol' : 'awnBlue', q); });
          if (used.length > 1) { const a = used[0], b = used[used.length - 1]; for (const sp of [a, b]) for (let q = 0; q < 2; q++) Bq[q].cyl('oak', sp.x + 1.3, 0, sp.z, 0.06, 2.8, 5, true); festoon(Bq[0], [a.x + 1.3, 2.75, a.z], [b.x + 1.3, 2.75, b.z], 12, 0.35, 30); for (const sp of [a, b]) col.addCircle(sp.x + 1.3, sp.z, 0.15); }
          for (const sp of used) col.addBox(sp.x, sp.z, 1.8, 1.6, Math.PI / 2);
          S.terrace = used;
          addSite(K, 'd3:pub', [f.mx, 2, f.mz], 30, [90, 200, 360], Bq);
        }
      }
      // ---------------------------------------------------------------- the club on Hythe Bridge Street
      {
        const p = map.pois.find((q) => q.id === IDS.clubPoi), dH = roadDist(map, ['Hythe Bridge Street', 'Park End Street']);
        let b = null; if (p) for (const q of map.buildings) { if (q.part || Math.abs(q.c[0] - p.p[0]) > 40 || Math.abs(q.c[1] - p.p[1]) > 40) continue; const fs = streetFaces(q.poly, dH, 14); if (fs.length && (!b || Math.hypot(q.c[0] - p.p[0], q.c[1] - p.p[1]) < Math.hypot(b.c[0] - p.p[0], b.c[1] - p.p[1]))) b = q; }
        const f = best(b, dH, 14);
        if (f) {
          S.clubF = f;
          const L = Math.min(f.L, 9), Bn = [new RB(), new RB(), new RB()], Bd = [new RB(), new RB()];
          for (let q = 0; q < 3; q++) {
            const B = Bn[q]; B.push(faceFrame(f));
            B.box('dark', 0, 1.6, 0.05, L, 3.2, 0.1, 0, { top: true });
            B.box('dark', 0, 3.55, 0.12, Math.min(L - 0.4, 6.4) + 0.2, 0.8, 0.12, 0, { bottom: true });
            signAt(B, 'sign_club', -Math.min(L - 0.4, 6.4) / 2, Math.min(L - 0.4, 6.4) / 2, 3.2, 3.9, 0.185);
            // (the open doorway lit from inside at night: the black front read as a hole in the street; a glow strip
            // under the name board too)
            if (q < 2) { glowCard(B, [-0.75, 0.04, 0.125], [0.75, 0.04, 0.125], [0.75, 2.42, 0.125], [-0.75, 2.42, 0.125], 17); glowCard(B, [-Math.min(L - 0.4, 6.4) / 2, 3.12, 0.2], [Math.min(L - 0.4, 6.4) / 2, 3.12, 0.2], [Math.min(L - 0.4, 6.4) / 2, 3.18, 0.2], [-Math.min(L - 0.4, 6.4) / 2, 3.18, 0.2], 17); }
            if (q < 2) { B.unit('door', [[-0.7, 0.02], [0.7, 0.02], [0.7, 2.4], [-0.7, 2.4]], 0.11, [0, 0]); for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) bulb(B, sx * (Math.min(L - 0.4, 6.4) / 2 + 0.25), 3.15 + k * 0.25, 0.2, 0.05, k + (sx > 0 ? 9 : 3)); }
            B.pop();
          }
          // rope posts and a red rope at night, by day nothing
          for (let q = 0; q < 2; q++) { const B = Bd[q]; B.push(faceFrame(f)); for (let k = 0; k < 4; k++) { const x = -3.4 + k * 1.3; B.cyl('brass', x, 0, 1.4, 0.04, 0.95, 6, true); B.cyl('brass', x, 0, 1.4, 0.16, 0.05, 8, true); if (k) B.beam('red', [x - 1.3, 0.85, 1.4], [x, 0.85, 1.4], 0.04); } B.pop(); }
          addSite(K, 'd3:club', [f.mx, 2, f.mz], 8, [80, 180, 320], Bn);
          addSite(K, 'd3:clubrope', [f.mx, 0.5, f.mz], 6, [60, 120, 0.01], [Bd[0], Bd[1], null], { need: night(game), farArea: 99 });
        }
      }
      // ---------------------------------------------------------------- Frideswide Square: guard railings; the van
      {
        const Br = [new RB(), new RB()], ctr = SQUARE, railAt = [];
        const rs = map.roads.filter((r) => /^(Frideswide Square|Park End Street|Hythe Bridge Street|Botley Road|Becket Street|Hollybush Row)$/.test(r.name || '') && !r.bridge);
        const stops = map.pois.filter((p) => /crossing|traffic_signals|bus_stop/.test(p.kind) && Math.hypot(p.p[0] - ctr[0], p.p[1] - ctr[1]) < 90).map((p) => p.p);
        for (const r of rs) {
          const pw = r.pw !== undefined ? r.pw : 2.4; if (!pw || pw < 1.6) continue;
          const cum = cumOf(r.pts), L = cum[cum.length - 1];
          for (const side of [1, -1]) for (let s = 1; s < L - 1; s += 2.0) {
            const p = along(r.pts, cum, s), d = side * ((r.w || 8) / 2 + 0.42), x = p.x + p.nx * d, z = p.z + p.nz * d;
            const dc = Math.hypot(x - ctr[0], z - ctr[1]); if (dc < 16 || dc > 62 || x < -622) continue;
            const x2 = x + p.ux * 2, z2 = z + p.uz * 2;
            if (stops.some((c) => Math.hypot(c[0] - x, c[1] - z) < 6 || Math.hypot(c[0] - x2, c[1] - z2) < 6)) continue;
            if (!offCarriage(map, x, z, 0.15) || !offCarriage(map, x2, z2, 0.15) || !offBuildings(map, x, z, 0.8) || !offBuildings(map, x2, z2, 0.8) || railAt.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.6 || Math.hypot(px - x2, pz - z2) < 1.6)) continue;
            railAt.push([x, z], [x2, z2]);
            for (let q = 0; q < 2; q++) {
              const B = Br[q];
              B.beam('iron', [x, 1.0, z], [x2, 1.0, z2], 0.04); B.beam('iron', [x, 0.25, z], [x2, 0.25, z2], 0.03); B.beam('iron', [x, 0, z], [x, 1.04, z], 0.05);
              if (q === 0) for (let k = 1; k < 8; k++) { const t = k / 8; B.beam('iron', [x + (x2 - x) * t, 0.25, z + (z2 - z) * t], [x + (x2 - x) * t, 1.0, z + (z2 - z) * t], 0.015); }
            }
            S.railings++;
          }
        }
        addSite(K, 'd3:square', [ctr[0], 1, ctr[1]], 62, [80, 170, 0.01], [Br[0], Br[1], null], { farArea: 99 });
        S.railAt = railAt;
        // the late-night van: on the paved square, clear of the roads, the railings and the buildings
        const sq = map.areas.find((a) => a.id === IDS.square);
        if (sq) {
          let vs = null; const nv = nearMap(map, -550, 262, 60);
          for (let x = -600; x <= -500 && !vs; x += 2) for (let z = 250; z <= 275 && !vs; z += 1.5) {
            const ok = [[0, 0], [2.6, 0], [-2.6, 0], [0, 1.4], [0, -1.4], [2.6, 1.4], [-2.6, -1.4], [2.6, -1.4], [-2.6, 1.4]].every(([dx, dz]) => offCarriage(nv, x + dx, z + dz, 0.6) && offBuildings(nv, x + dx, z + dz, 1.0) && !railAt.some(([px, pz]) => Math.hypot(px - x - dx, pz - z - dz) < 1.2));
            if (ok) vs = [x, z];
          }
          if (vs) {
            const [vx, vz] = vs, Bv = [new RB(), new RB(), new RB()];
            for (let q = 0; q < 3; q++) {
              const B = Bv[q];
              B.push(frame(vx, 0, vz, 1, 0));                 // local x along the van (east), +z = the serving side (south)
              B.box('vanWhite', 0, 1.45, 0, 4.8, 2.1, 2.0, 0, { bottom: true });
              B.box('vanRed', 0, 0.42, 0, 4.8, 0.3, 2.02, 0);
              B.box('vanWhite', 2.7, 1.05, 0, 0.9, 1.3, 1.9, 0);
              if (q < 2) for (const [x, z] of [[-1.6, 1], [1.6, 1], [-1.6, -1], [1.6, -1]]) wheel(B, x, 0.34, z * 0.92, 0.34, 0.22);
              // the serving hatch: a lit panel, the counter flap, the name board over it
              glowCard(B, [-1.5, 1.2, 1.015], [0.9, 1.2, 1.015], [0.9, 2.15, 1.015], [-1.5, 2.15, 1.015], 33);
              B.box('vanRed', -0.3, 1.16, 1.2, 2.5, 0.06, 0.4, 0, { bottom: true });
              B.box('dark', -0.3, 2.42, 1.02, 3.6, 0.36, 0.04, 0);
              signAt(B, 'sign_van', -2.1, 1.5, 2.26, 2.58, 1.045);
              B.pop();
            }
            addSite(K, 'd3:van', [vx, 1.4, vz], 4, [80, 180, 300], Bv, { need: night(game) });
            S.van = vs;
          }
        }
      }
      K.boxes.push([-760, -320, -140, 300]);
    } catch (e) { console.error('[hythe_bridge] build', e); } finally { K.joined(me); }

    // ---------------------------------------------------------------- people: pub terrace, club queue, a boater
    let drinkers = null, queue = null, boater = null;
    try {
      const t = S.terrace;
      if (t.length) drinkers = nearSet(game, { c: [t[0].x, t[0].z], r: 70, h0: 12, h1: 22.5, people: t.slice(0, 3).map((sp, i) => ({ x: sp.x, z: sp.z + (i % 2 ? 1.1 : -1.1), h: i % 2 ? Math.PI : 0, look: randomLook('d3-wharf-drinker-' + i, { outfit: i % 2 ? 'casual' : 'tweed' }), pose: i === 1 ? 'talk' : 'stand', lines: i === 0 ? DRINK_LINES : null })) });
      const f = S.clubF;
      if (f) queue = nearSet(game, { c: [f.mx, f.mz], r: 60, h0: 22, h1: 2.5, people: [0, 1, 2, 3].map((i) => { const o = -3.4 - i * 0.85, x = f.mx + f.ux * o + f.nx * 0.9, z = f.mz + f.uz * o + f.nz * 0.9; return { x, z, h: Math.atan2(f.ux, f.uz), look: randomLook('d3-club-q-' + i, { outfit: i % 3 ? 'clubbing' : 'casual' }), pose: i === 2 ? 'phone' : 'stand', lines: i % 2 ? QUEUE_LINES : null }; }) });
      if (S.boats.length) { const bt = S.boats[0], cn = S.canal; const p = along(cn.pts, cn.cum, cn.Lw - 150), x = bt.x + p.nx * cn.sd * 3.0, z = bt.z + p.nz * cn.sd * 3.0; if (!col.isWater(x, z)) boater = nearSet(game, { c: [x, z], r: 60, h0: 9, h1: 18.5, people: [{ x, z, h: Math.atan2(-p.nx * cn.sd, -p.nz * cn.sd), look: randomLook('d3-canal-boater', { outfit: 'tweed' }), pose: 'stand', lines: BOATER_LINES, label: 'Boater' }] }); }
    } catch (e) { console.warn('[hythe_bridge] people', e); }

    // ---------------------------------------------------------------- Gerald, the lost bicycle
    const G = { found: 0, mesh: null, day: -1 };
    {
      const cand = [];
      const push = (x, z) => { if (Number.isFinite(x) && !col.isWater(x, z) && offCarriage(map, x, z, 0.8) && offBuildings(map, x, z, 0.8)) cand.push([x, z]); };
      if (S.lock) { const { c, ux, uz, R } = S.lock, nx = -uz, nz = ux; push(c[0] + nx * (R[1] + 1.2) + ux * 6, c[1] + nz * (R[1] + 1.2) + uz * 6); push(c[0] - nx * (R[-1] + 1.2) - ux * 6, c[1] - nz * (R[-1] + 1.2) - uz * 6); }
      if (S.canal) { const { pts, cum, Lw, sd } = S.canal; for (const ds of [20, 75, 140]) { const p = along(pts, cum, Lw - ds); push(p.x + p.nx * sd * 7.5, p.z + p.nz * sd * 7.5); } }
      if (S.swing) push(S.swing.c[0] + 0, S.swing.c[1] - S.swing.W - 4);
      for (const [x, z] of (S.railAt || []).filter((_, i) => i % 9 === 0).slice(0, 3)) push(x + 0.9, z + 0.9);
      if (S.terrace.length) push(S.terrace[S.terrace.length - 1].x + 2.6, S.terrace[S.terrace.length - 1].z);
      S.spots = cand;
    }
    const today = () => (S.spots.length ? S.spots[geraldSpot(game.time.now(), S.spots.length)] : null);
    const flags = () => game.state.flags || (game.state.flags = {});
    if (S.spots.length) {
      S.spots.forEach((sp, i) => game.interact.add({ pos: sp, radius: GERALD.r, label: () => (today() === sp ? (flags().geraldDay === Math.floor(game.time.now() / DAY_MS) ? 'Gerald (already reunited today)' : 'A green bicycle with a basket...') : 'Look for Gerald'), enabled: () => today() === sp, onUse: () => {
        const day = Math.floor(game.time.now() / DAY_MS), fl = flags();
        if (fl.geraldDay === day) { game.ui.toast('Gerald is fine where he is. His owner is on the way.', 3.5); return; }
        fl.geraldDay = day; fl.gerald = (fl.gerald || 0) + 1; G.found++; game.pay(GERALD.reward); try { game.save(); } catch { /* */ }
        game.ui.toast(`It's Gerald! You ring the number on the poster. "GERALD! Where have you BEEN?" £${GERALD.reward} reward, and a strong smell of marmalade. ` + (i % 2 ? 'He will wander again tomorrow.' : 'Bicycles in Oxford do this.'), 6);
      } }));
      // the poster on the canal end board
      if (S.endBoard) { const [ex, ez] = S.endBoard; game.interact.add({ pos: [ex, ez], radius: 2.2, label: 'Read the poster', onUse: () => game.ui.toast('LOST: green bicycle, wicker basket. Answers to "Gerald". Wanders. Last seen between the station and the canal. REWARD.', 6) }); }
    }
    G.tick = () => {
      const sp = today(); if (!sp) return;
      const p = game.player, near = p.place === 'world' && Math.hypot(p.pos.x - sp[0], p.pos.z - sp[1]) < 90;
      if (!near) { if (G.mesh) G.mesh.visible = false; return; }
      if (!G.mesh) G.mesh = ownMesh(game, geraldBatch(), 'd3x:gerald');
      const day = Math.floor(game.time.now() / DAY_MS);
      if (G.day !== day) { G.day = day; G.mesh.position.set(sp[0], 0, sp[1]); G.mesh.rotation.y = h01(day, 914) * Math.PI * 2; G.mesh.updateMatrix(); G.mesh.updateMatrixWorld(); }
      G.mesh.visible = true;
    };

    game.hytheBridge = {
      sights, gerald: { spots: () => S.spots, today, found: () => G.found },
      stats() { return { lock: !!S.lock, beams: S.lock ? S.lock.beams.length : 0, isisBridge: !!S.isisBridge, swing: !!S.swing, boats: S.boats.length, boatList: S.boats, benches: S.benches, railings: S.railings, pub: !!S.pubF, terrace: S.terrace.length, club: !!S.clubF, van: S.van, endBoard: !!S.endBoard, spots: S.spots.length, people: (drinkers ? drinkers.count() : 0) + (queue ? queue.count() : 0) + (boater ? boater.count() : 0) }; },
    };
    return { update() { try { K.tick(me); if (drinkers) drinkers.tick(); if (queue) queue.tick(); if (boater) boater.tick(); G.tick(); } catch (e) { if (!S.err) { S.err = true; console.error('[hythe_bridge]', e); } } } };
  },
};
