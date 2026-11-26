// North Oxford, c. 2013 — Banbury Road and Woodstock Road north of St Giles', North Parade, Park Town and the Radcliffe
// Observatory (districts pass 2; places/north_oxford.js is the module, this file holds it). See
// docs/research/districts2.md (sources, known vs guessed).
//
//   preMap   the Victorian villas along both roads restyled through overrides.style (red or yellow brick, gabled
//            clay-tile or slate roofs, polychrome bands on some, two to three storeys — no geometry of our own); Park
//            Town's crescents as cream stucco under slate; the two North Parade pubs keep their real names (invented under ?invented=1); the
//            Observatory's footprint (w87344211) is skipped and rebuilt here (the world's version was a plain prism)
//   install  (all in the shared batch-4 atlas draw — no new draw call)
//            · the Radcliffe Observatory: the long Palladian range with its north bow, and the Tower of the Winds on
//              top — octagon, frieze, Atlas and Hercules holding up the globe — a marker up and down both roads (drawn within ~430 m: beyond, the St Giles budget view would gain a draw)
//            · a handful of hero villas on the Banbury Road: a projecting Gothic gable with bargeboards, pointed
//              windows, a canted bay and a porch on the mapped houses' street fronts
//            · North Parade: the two pub fronts, shop units dressed (shutters / boards), bunting zig-zagging over the
//              street, bikes against the walls
//            · bike-lined pavements: rows of bikes at stands outside the villas' gates on both roads
//   do       the Observatory weather station: take the morning reading at the Stevenson screen in the garden (08:30-
//            10:30 game time, once a game day, £2 — the station's record runs from 1767)
//   sights   for the passport (game.northOxford.sights)
// Test hooks: game.northOxford = { sights, stats(), villas, read() }       tools/smoke_districts2.mjs
import { shared, addSite, RB, frame, bike, stand, TAU, LIT, DARK, prismN, h01, DAY_MS } from './_b4_kit.js';
import { mergeFaces, buildingById, buildingAt, streetFaces, roadDist, offCarriage, offBuildings, faces, faceFrame, pip } from './_eo_kit.js';
import { shopDress } from './_eo_build.js';
import { pubFront, bunting, boardPost, signAt, rect } from './_d2_kit.js';
import { PUBS } from './_d2_cells.js';
import { nearSet, DRINK_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';
import { inventedNames } from '../core/features.js';

const PARKS_LODGE = 'w173096602';
export const OBS = { id: 'w87344211', tower: [-266.0, -647.6], wings: [-292.6, -276.8, -254.7, -239.4], z0: -647.5, z1: -641.2, bowZ: -655.4, wingH: 8.6, centreH: 12.6, towerR: 4.5, towerTop: 24.2, screen: [-285, -686] };
export const POIS = { pubA: 'n268664190', pubB: 'n268664188' };   // Gardeners Arms -> PUBS.npA, Rose and Crown -> PUBS.npB
export const ROADS = ['Banbury Road', 'Woodstock Road'];
// the side streets of villas whose front walls may be hedges (trees pass, item 17)
const LEAFY = ['Norham Gardens', 'Norham Road', 'Bardwell Road', 'Linton Road', 'Northmoor Road', 'Charlbury Road', 'Crick Road', 'Fyfield Road', 'Bradmore Road', 'Canterbury Road', 'St Margaret\'s Road', 'Rawlinson Road', 'Polstead Road', 'Chalfont Road', 'Staverton Road', 'Belbroughton Road', 'Winchester Road', 'Kingston Road', 'Park Town', 'Church Walk', 'Bevington Road', 'Keble Road', 'Museum Road'];
/** ?nod2 in the URL: this pass is not installed (before / after screenshots on the live server) */
export const D2OFF = () => { try { return /[?&]nod2\b/.test((globalThis.location && globalThis.location.search) || '') || !!(globalThis.process && globalThis.process.env && globalThis.process.env.GTO_NOD2); } catch { return false; } };
export const sights = [
  { id: 'd2-observatory', name: 'The Radcliffe Observatory', x: -266, z: -648, blurb: 'Built 1772-94 for the Radcliffe Trustees (Keene, then Wyatt): its tower is modelled on the Tower of the Winds in Athens, with Bacon\'s reliefs of the eight winds and Atlas and Hercules holding up the globe.' },
  { id: 'd2-metstation', name: 'The weather station', x: OBS.screen[0], z: OBS.screen[1], blurb: 'Daily weather readings have been taken in the Observatory\'s garden since the 1760s, one of the longest unbroken records in the world.' },
  { id: 'd2-banbury', name: 'The Banbury Road villas', x: -50, z: -900, blurb: 'Big Victorian Gothic houses on St John\'s College land, built from the 1860s for professors and families after dons were allowed to marry: gables, pointed windows, yellow and red brick.' },
  { id: 'd2-northparade', name: 'North Parade', x: -120, z: -1066, blurb: 'A little street of shops and two pubs between the Banbury and Woodstock Roads, laid out on St John\'s land from the 1830s-50s. It is north of South Parade, which is in Summertown, further north.' },
  { id: 'd2-parktown', name: 'Park Town', x: 90, z: -1280, blurb: 'Cream stucco crescents round a private garden, laid out in the 1850s by S. L. Seckham: Italianate terraces in the middle of brick-and-Gothic North Oxford.' },
];
const night = (game) => () => { const h = game.time.hour; return h >= 21.5 || h < 7; };
const best = (b, d, reach = 12) => { if (!b) return null; const fs = mergeFaces(streetFaces(b.poly, d, reach)); fs.sort((a, c) => c.L - a.L); return fs[0] || null; };
const areaOf = (poly) => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };

/** pure: the hero villas (dressed with a projecting Gothic front in install): at most 7, 60 m apart, on the Banbury Road stretch */
export function pickHeroes(map, villaIds, dR) {
  const list = villaIds.map((id) => buildingById(map, id)).filter((b) => b && b.c[1] < -640 && b.c[1] > -1200 && dR(b.c[0], b.c[1]) < 32);
  const picked = []; for (const b of list.sort((a, c) => a.c[1] - c.c[1])) { if (picked.length >= 7) break; if (picked.some((p) => Math.hypot(p.b.c[0] - b.c[0], p.b.c[1] - b.c[1]) < 60)) continue; const f = best(b, dR, 18); if (f && f.L > 7) picked.push({ b, f }); }
  return picked;
}
/** pure: is a mapped building one of the villas to restyle (houses and converted houses along the two roads) */
export function isVilla(b, dRoad) {
  if (b.part || b.c[1] > -480 || b.c[1] < -1500) return false;
  const t = b.tags || {}, bt = t.building || 'yes', a = areaOf(b.poly);
  if (t.amenity === 'place_of_worship' || /church|chapel/.test(bt) || t.shop || (t.amenity && t.amenity !== 'university')) return false;
  if (!/^(house|detached|semidetached_house|residential|yes|university|college|terrace|apartments)$/.test(bt)) return false;
  if (a < 70 || a > (bt === 'house' || bt === 'detached' ? 900 : 520) || b.h > 16) return false;
  return dRoad(b.c[0], b.c[1]) < 38;
}
/** pure: the style of villa `id` (red or yellow brick, polychrome bands on some, tile or slate) */
export function villaStyle(id) {
  const h = h01(parseInt(String(id).replace(/\D/g, ''), 10) | 0, 911), k = h01(parseInt(String(id).replace(/\D/g, ''), 10) | 0, 912);
  const yellow = h < 0.55;
  // villa: world/buildings.js (houses pass, ?houses=0 off): eaves at the real height, a steep roof, a gable to the
  // street over a two-storey bay window, a gabled porch, taller stacks
  return { wall: 'brick', tint: yellow ? [1.42, 1.22, 0.86] : [1.0, 0.78, 0.7], roof: k < 0.6 ? 'tile' : 'slate', shape: 'gabled', up: h > 0.3 && h < 0.75 ? 'brickPoly' : 'brickSash', ground: 'brickSash', door: 'brickDoor', storeys: k < 0.45 ? 3 : 2, ivy: k > 0.85 ? undefined : false, villa: true };
}
/** pure: a house on one of the leafy side roads of the Victorian suburb (Norham Gardens, Bardwell Road, Crick Road...):
 *  a villa too (houses pass, photo comparison item 17 "norham") */
export function isLeafyVilla(b, dLeafy) {
  if (b.part || b.c[1] > -700 || b.c[1] < -1500 || b.c[0] < -420 || b.c[0] > 340) return false;
  const t = b.tags || {}, bt = t.building || 'yes', a = areaOf(b.poly);
  if (t.amenity || t.shop || !/^(house|detached|semidetached_house|residential|yes)$/.test(bt) || a < 90 || a > 600 || b.h > 14) return false;
  return dLeafy(b.c[0], b.c[1]) < 30;
}

export default {
  id: 'north_oxford',
  preMap(game) {
    if (D2OFF()) return;
    try {
      const m = game.map; if (!m || m._d2North) return;
      const dR = roadDist(m, ROADS), dPT = roadDist(m, ['Park Town']);
      const villas = [], park = [];
      for (const b of m.buildings) {
        if (b.id === OBS.id || b.id === PARKS_LODGE) continue;      // (the Parks' North Lodge is university_parks.js's: a stone cottage)
        if (isVilla(b, dR)) { game.overrides.style.set(b.id, villaStyle(b.id)); if (b.h < 10.5) game.overrides.heights.set(b.id, 10.5 + h01(b.c[0] | 0, b.c[1] | 0) * 2); villas.push(b.id); }
        else if (!b.part && b.c[1] < -1150 && b.c[1] > -1400 && b.c[0] > -90 && b.c[0] < 230 && dPT(b.c[0], b.c[1]) < 26 && areaOf(b.poly) > 60) { game.overrides.style.set(b.id, { wall: 'render', tint: [1.06, 1.02, 0.9], roof: 'slate', shape: 'hipped', up: 'renderGeorgian', ground: 'renderGeorgian', door: 'renderDoor', storeys: 3, ivy: false }); park.push(b.id); }
      }
      if (inventedNames()) for (const [id, name] of [[POIS.pubA, PUBS.npA], [POIS.pubB, PUBS.npB]]) { const p = m.pois.find((q) => q.id === id); if (p) { p.name = name; delete p.brand; delete p.operator; } }
      // (the hero villas carry their own Gothic front: the world draws them as villas without its own gable, bay and porch)
      for (const { b } of pickHeroes(m, villas, dR)) { const st = game.overrides.style.get(b.id); if (st) st.villa = 'hero'; }
      // houses pass (photo comparison item 17): the villas of the leafy side roads (not the Parks lodge, not Park Town)
      const leafy = [];
      { const dL = roadDist(m, LEAFY.filter((n) => n !== 'Park Town' && n !== 'Keble Road' && n !== 'Museum Road')), vs = new Set(villas), ps = new Set(park);
        for (const b of m.buildings) {
          if (b.id === OBS.id || b.id === PARKS_LODGE || vs.has(b.id) || ps.has(b.id) || game.overrides.style.has(b.id) || !isLeafyVilla(b, dL)) continue;
          game.overrides.style.set(b.id, villaStyle(b.id)); if (b.h < 10.5) game.overrides.heights.set(b.id, 10.5 + h01(b.c[0] | 0, b.c[1] | 0) * 2); leafy.push(b.id);
        } }
      // houses pass (photo comparison item 17, "north_parade"): North Parade is a street of two-storey shops, pubs and
      // cottages, most of them painted (the map's heights made them three storeys of red brick). GUESS: four in five
      // fronts, the colours from the photograph (white, cream, pale blue, sage, pink) and the eaves height.
      const np = [];
      { const dNP = roadDist(m, ['North Parade Avenue']), PAINT = ['#f1ede4', '#ece0c2', '#c9d6dc', '#cfd6bf', '#e8cfc6', '#f3e6b8'];
        for (const b of m.buildings) {
          if (b.part || game.overrides.style.has(b.id) || areaOf(b.poly) > 400 || dNP(b.c[0], b.c[1]) > 14) continue;
          if (!b.poly.some((p) => dNP(p[0], p[1]) < 5.5)) continue;                       // (fronting the street)
          const hq = h01(b.c[0] | 0, (b.c[1] | 0) + 515);
          if (hq > 0.8) continue;
          game.overrides.style.set(b.id, hq < 0.6 ? { wall: 'render', color: PAINT[Math.floor((hq / 0.6) * PAINT.length) % PAINT.length], roof: 'slate', eaves: 5.6 + 0.6 * h01(b.c[0] | 0, 516), ivy: false } : { wall: 'brick', roof: 'slate', eaves: 5.8 + 0.5 * h01(b.c[0] | 0, 517) });
          np.push(b.id);
        } }
      game.overrides.skip.add(OBS.id);
      // photo comparison item 17 ("woodstock_rd", "norham"): the villas' front gardens are behind clipped hedges (often
      // over a low wall); the map gives a default 2.6 m wall along nearly every front. Along the leafy roads, about half
      // of those front walls (by hash) become hedges at the map's default hedge height, which the world draws low in
      // front gardens (barriers.js). Collision is unchanged (a hedge is as solid as a wall).
      const dV = roadDist(m, [...ROADS, ...LEAFY]);
      let hedges = 0;
      for (const w of m.barriers) {
        if (w.kind !== 'wall' || Math.abs((w.h || 0) - 2.6) > 0.01 || !w.pts || w.pts.length < 2 || w.material) continue;
        const [x, z] = w.pts[(w.pts.length / 2) | 0];
        if (z > -760 || x < -420 || x > 340 || dV(x, z) > 9 || h01(x | 0, (z | 0) + 77) > 0.5) continue;
        w.kind = 'hedge'; w.h = 1.8; hedges++;
      }
      Object.defineProperty(m, '_d2North', { value: { villas, park, hedges, leafy, np }, enumerable: false });
    } catch (e) { console.error('[north_oxford] preMap', e); }
  },

  install(game) {
    if (D2OFF()) return null;
    const K = shared(game), me = K.join('north_oxford'), map = game.map, col = game.worldCollider, W = game.world;
    const S = { err: false, bikeAt: [], heroes: [], shops: 0, bikes: 0, pubs: 0, bunting: 0, read: null, reads: 0 };
    const nightF = night(game);
    try {
      // ---------------------------------------------------------------- the Radcliffe Observatory
      const ob = map.buildings.find((b) => b.id === OBS.id);
      if (ob) {
        addSite(K, 'd2:obs', [OBS.tower[0], 14, OBS.tower[1]], 30, [140, 300, 400], [0, 1, 2].map((q) => { const B = new RB(); observatory(B, ob.poly, q); return B; }));
        col.addPolygon(ob.poly);
        const Bs = [new RB(), new RB()];
        for (const [B, q] of [[Bs[0], 0], [Bs[1], 1]]) stevenson(B, OBS.screen[0], OBS.screen[1], q);
        addSite(K, 'd2:metscreen', [OBS.screen[0], 1, OBS.screen[1]], 4, [70, 140, 0.01], [Bs[0], Bs[1], null], { farArea: 99 });
        col.addBox(OBS.screen[0], OBS.screen[1], 1.1, 1.1, 0);
      }
      // ---------------------------------------------------------------- hero villas on the Banbury Road
      const dR = roadDist(map, ROADS);
      const picked = pickHeroes(map, (map._d2North || {}).villas || [], dR);
      for (const { b, f } of picked) {
        const st = villaStyle(b.id);
        addSite(K, 'd2:villa:' + b.id, [f.mx, 6, f.mz], 10, [110, 260, 520], [0, 1, 2].map((q) => { const B = new RB(); villaFront(B, f, b.h, st, q, b.id); return B; }));
        S.heroes.push({ id: b.id, x: f.mx, z: f.mz });
      }
      // ---------------------------------------------------------------- bike-lined pavements on both roads
      {
        const rows = new Map();
        for (const id of ((map._d2North || {}).villas || [])) {
          const b = buildingById(map, id); if (!b || h01(b.c[0] | 0, 7) > 0.32) continue;
          const f = best(b, dR, 18); if (!f) continue;
          // out at the pavement's back edge in front of the house (the front gardens are 4-8 m deep): walk out until the pavement
          let out = 3; while (out < 14 && offCarriage(map, f.mx + f.nx * (out + 1.6), f.mz + f.nz * (out + 1.6), 0.3)) out += 0.5;
          const key = Math.floor(f.mx / 200) + ',' + Math.floor(f.mz / 200); let r = rows.get(key); if (!r) rows.set(key, (r = { B: [new RB(), new RB()], x: 0, z: 0, k: 0 }));
          for (let k = 0; k < 3; k++) {
            const o = -1 + k * 1.0, x = f.mx + f.ux * o + f.nx * out, z = f.mz + f.uz * o + f.nz * out;
            if (!offCarriage(map, x, z, 0.9) || !offBuildings(map, x, z, 0.8) || S.bikeAt.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.2)) continue;
            S.bikeAt.push([x, z]); const h = Math.atan2(f.nx, f.nz);
            for (let q = 0; q < 2; q++) { stand(r.B[q], x, z, h); if ((k + b.c[0]) % 3 !== 2) bike(r.B[q], x + f.ux * 0.3, z + f.uz * 0.3, h + (k % 2 ? Math.PI : 0), ['navy', 'red', 'boatGreen', 'bike', 'render7'][k + 1], q); }
            S.bikes++; r.x += x; r.z += z; r.k++;
          }
        }
        for (const [key, r] of rows) if (r.k) addSite(K, 'd2:nbikes:' + key, [r.x / r.k, 0.5, r.z / r.k], 140, [55, 120, 0.01], [r.B[0], r.B[1], null], { farArea: 99 });
      }
      // ---------------------------------------------------------------- North Parade
      {
        const np = map.roads.find((r) => r.name === 'North Parade Avenue'), dN = roadDist(map, ['North Parade Avenue']);
        const B = [new RB(), new RB(), new RB()], Dn = [new RB(), new RB(), new RB()], Dd = [new RB(), new RB()];
        const done = new Set();
        for (const [id, key, paint] of [[POIS.pubA, 'sign_npPubA', 'green'], [POIS.pubB, 'sign_npPubB', 'navy']]) {
          const p = map.pois.find((q) => q.id === id), b = p && buildingAt(map, p.p[0], p.p[1]), f = best(b, dN, 10);
          if (!f || done.has(b.id)) continue; done.add(b.id);
          for (let q = 0; q < 3; q++) pubFront(B[q], f, q, key, paint, { maxL: 9 });
          S.pubs++; (S.npPubs || (S.npPubs = [])).push(f);
        }
        for (const p of map.pois) {
          if (!p.name || dN(p.p[0], p.p[1]) > 16 || !/^(shop:|cafe|restaurant|fast_food)/.test(p.kind) || /vacant/.test(p.kind)) continue;
          const b = buildingAt(map, p.p[0], p.p[1]); if (!b || done.has(b.id)) continue; done.add(b.id);
          const f = best(b, dN, 10); if (!f) continue;
          const sd = (parseInt(b.id.replace(/\D/g, ''), 10) % 977) / 977;
          for (let q = 0; q < 3; q++) shopDress(Dn[q], q < 2 ? Dd[q] : new RB(), f, p.kind, sd, q, map);
          S.shops++;
        }
        // bunting: zig-zag across the street between the fronts, 5 m up
        if (np) {
          const pts = np.pts, half = (np.w || 7) / 2 + 2.6;
          let acc = 0, side = 1, prev = null;
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], c = pts[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
            for (let s = (acc > 0 ? (7 - (acc % 7)) % 7 : 4); s < L; s += 7) {
              const x = a[0] + ux * s, z = a[1] + uz * s, P = [x - uz * half * side, 5.2, z + ux * half * side];
              if (Math.hypot(x - pts[0][0], z - pts[0][1]) > 12 && Math.hypot(x - pts[pts.length - 1][0], z - pts[pts.length - 1][1]) > 12) {
                if (prev) { for (let q = 0; q < 2; q++) bunting(B[q], prev, P, q ? 6 : 12, 0.45, S.bunting); S.bunting++; }
                prev = P; side = -side;
              } else prev = null;
            }
            acc += L;
          }
          // bikes against the fronts
          for (let s = 10; s < 120; s += 13) {
            const t = Math.min(1, s / 140), i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))), a = pts[i], c = pts[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
            const sd = s % 2 ? 1 : -1, x = (a[0] + c[0]) / 2 - uz * sd * (half - 1.4), z = (a[1] + c[1]) / 2 + ux * sd * (half - 1.4);
            if (!offBuildings(map, x, z, 0.5)) continue;
            for (let q = 0; q < 2; q++) bike(B[q], x + ux * (s % 5), z + uz * (s % 5), Math.atan2(ux, uz), ['red', 'navy', 'boatGreen', 'bike'][s % 4], q);
            S.bikes++;
          }
          const m = pts[Math.floor(pts.length / 2)];
          addSite(K, 'd2:np', [m[0], 3, m[1]], 75, [110, 240, 420], B);
          addSite(K, 'd2:npn', [m[0], 2, m[1]], 75, [70, 150, 260], Dn, { need: nightF });
          addSite(K, 'd2:npd', [m[0], 1, m[1]], 75, [60, 130, 0.01], [Dd[0], Dd[1], null], { need: () => !nightF(), farArea: 99 });
          // the street's name plate on the corner by the Banbury Road
          const B2 = [new RB(), new RB()];
          const a0 = pts[0], a1 = pts[1], L0 = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), ux = (a1[0] - a0[0]) / L0, uz = (a1[1] - a0[1]) / L0;
          const px = a0[0] + ux * 9 - uz * (half + 0.3), pz = a0[1] + uz * 9 + ux * (half + 0.3);
          if (offCarriage(map, px, pz, 0.4) && offBuildings(map, px, pz, 0.3)) { for (let q = 0; q < 2; q++) boardPost(B2[q], px, pz, uz, -ux, 'sign_npStreet', 1.6, 0.9, q); addSite(K, 'd2:npsign', [px, 1, pz], 2, [50, 100, 0.01], [B2[0], B2[1], null], { farArea: 99 }); col.addCircle(px, pz, 0.3); }
        }
      }
      K.boxes.push([-320, 240, -1400, -480]);
    } catch (e) { console.error('[north_oxford] build', e); } finally { K.joined(me); }

    // ---------------------------------------------------------------- drinkers outside the North Parade pubs (near only)
    let drinkers = null;
    try {
      const f = (S.npPubs || [])[0];
      if (f) drinkers = nearSet(game, { c: [f.mx, f.mz], r: 60, h0: 17.5, h1: 23, people: [0, 1].map((i) => ({ x: f.mx + f.ux * (i * 1.1 - 0.6) + f.nx * 1.4, z: f.mz + f.uz * (i * 1.1 - 0.6) + f.nz * 1.4, h: Math.atan2(f.ux, f.uz) + (i ? Math.PI : 0), look: randomLook('d2-np-drinker-' + i, { outfit: i ? 'tweed' : 'casual' }), pose: i ? 'talk' : 'stand', lines: i ? DRINK_LINES : null })) });
    } catch (e) { console.warn('[north_oxford] people', e); }

    // ---------------------------------------------------------------- the morning reading at the Stevenson screen
    const dayOf = () => Math.floor(game.time.now() / DAY_MS);
    const reading = () => {
      const w = game.weather || {}, t = Number.isFinite(w.tempC) ? w.tempC : 9 + 6 * h01(dayOf(), 3), r = Number.isFinite(w.rain) ? w.rain : 0;
      return { dry: +t.toFixed(1), wet: +(t - 1.2 - 2 * (1 - Math.min(1, r * 3))).toFixed(1), max: +(t + 3.4 + h01(dayOf(), 4) * 2).toFixed(1), min: +(t - 4 - h01(dayOf(), 5) * 2).toFixed(1), rain: +(r * 8).toFixed(1) };
    };
    try {
      game.interact.add({ pos: [OBS.screen[0], OBS.screen[1] + 1.1], radius: 2.2, label: () => { const h = game.time.hour; return S.read === dayOf() ? 'The reading is done for today' : h >= 8.5 && h < 10.5 ? 'Take the morning weather reading (£2)' : 'Stevenson screen (readings 08:30-10:30)'; }, onUse: () => {
        const h = game.time.hour;
        if (S.read === dayOf()) { game.ui.toast('Today\'s figures are already in the ledger, in your handwriting.', 3.5); return; }
        if (h < 8.5 || h >= 10.5) { game.ui.toast('The readings are taken in the morning, between half past eight and half past ten. The series has not missed one since the 1760s and will not start with you.', 5); return; }
        const R = reading(); S.read = dayOf(); S.reads++; game.pay(2);
        try { const fl = game.state.flags || (game.state.flags = {}); fl.metReadings = (fl.metReadings || 0) + 1; game.save(); } catch { /* */ }
        game.ui.toast(`Dry bulb ${R.dry} °C, wet bulb ${R.wet} °C, max ${R.max}, min ${R.min}, rain ${R.rain} mm. You write it in the ledger under two centuries of other people's mornings. (£2)`, 7);
      } });
    } catch (e) { console.warn('[north_oxford] met', e); }
    game.northOxford = {
      sights, villas: (map._d2North || {}).villas || [], park: (map._d2North || {}).park || [], heroes: S.heroes, reading, read: () => S.reads,
      stats() { return { villas: ((map._d2North || {}).villas || []).length, park: ((map._d2North || {}).park || []).length, heroes: S.heroes.length, shops: S.shops, pubs: S.pubs, bikes: S.bikes, bunting: S.bunting, people: drinkers ? drinkers.count() : 0, tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^d2:(obs|met|villa|nbikes|np)/.test(k)).map(([k, v]) => [k, v.tris])) }; },
    };
    return { update() { try { K.tick(me); if (drinkers) drinkers.tick(); } catch (e) { if (!S.err) { S.err = true; console.error('[north_oxford]', e); } } } };
  },
};

// ================================================================================================== builders
/**
 * The Radcliffe Observatory (K: 1772-94, Henry Keene then James Wyatt; the tower after the Tower of the Winds in Athens,
 * reliefs of the eight winds by John Bacon, Atlas and Hercules holding a globe on top — Green Templeton College, Historic
 * England; G: every height, the window rhythm, the bow's form, the figure group's size). Footprint from the map.
 */
export function observatory(B, poly, q) {
  const [w0, w1, w2, w3] = OBS.wings, z0 = OBS.z0, z1 = OBS.z1, H1 = OBS.wingH, H2 = OBS.centreH;
  const block = (xa, xb, za, zb, h, key = 'stone') => {
    B.box(key, (xa + xb) / 2, h / 2, (za + zb) / 2, xb - xa, h, zb - za, 0, { top: false });
    B.flat('lead', [[xa, za], [xb, za], [xb, zb], [xa, zb]], h + 0.02);
    // cornice and a balustraded parapet
    B.box('dress', (xa + xb) / 2, h - 0.25, (za + zb) / 2, xb - xa + 0.3, 0.4, zb - za + 0.3, 0, { bottom: true });
    if (q < 2) for (const zz of [za - 0.02, zb + 0.02]) { const nz = zz === za - 0.02 ? -1 : 1; B.poly(q ? 'balusDk' : 'balus', [[xa, h, zz], [xb, h, zz], [xb, h + 0.9, zz], [xa, h + 0.9, zz]], [0, 0, nz], [[0, 0], [xb - xa, 0], [xb - xa, 1], [0, 1]]); }
    B.box('dress', (xa + xb) / 2, h + 0.95, (za + zb) / 2, xb - xa + 0.1, 0.12, zb - za + 0.1, 0, { bottom: true });
  };
  block(w0, w1, z0, z1, H1); block(w2, w3, z0, z1, H1); block(w1, w2, z0, z1 + 0.4, H2);
  // the bow on the garden (north) side: half an octagon to the mapped bulge
  const [tx] = OBS.tower, R = (z0 - OBS.bowZ) + 0.1, bw = 9.0;
  const BP = (k) => { const t = Math.PI + k * Math.PI / 4; return [tx + Math.cos(t) * bw, z0 + 0.01 + Math.sin(t) * R]; };
  for (let i = 0; i < 4; i++) {
    const [ax, az] = BP(i), [cx, cz] = BP(i + 1), tm = Math.PI + (i + 0.5) * Math.PI / 4, nx = Math.cos(tm), nz = Math.sin(tm), mx = (ax + cx) / 2, mz = (az + cz) / 2;
    B.poly('stone', [[ax, 0, az], [cx, 0, cz], [cx, H2, cz], [ax, H2, az]], [nx, 0, nz]);
    B.box('dress', mx, H2 - 0.25, mz, Math.hypot(cx - ax, cz - az) + 0.3, 0.4, 0.3, Math.atan2(nx, nz), { bottom: true });
    if (q < 2) { B.push(frame(mx + nx * 0.02, 0, mz + nz * 0.02, nz, -nx)); B.archUnit('arch', 0, 1.3, 4.6, 7.6, 0, [LIT[(i + 3) % LIT.length], 1], q ? 5 : 8); B.unit('sash', rect(-0.6, 1.0, 0.6, 3.0), 0, [i, 0]); if (q === 0) B.unit('niche', rect(-0.75, 9.0, 0.75, 10.8), 0, [0, 0]); B.pop(); }
  }
  B.flat('lead', [0, 1, 2, 3, 4].map(BP), H2 + 0.02);
  // windows on the long fronts: sashes over a rusticated ground floor (paint), round-headed windows in the centre block
  if (q < 2) for (const [zz, nz] of [[z0 - 0.02, -1], [z1 + 0.42, 1]]) {
    B.push(frame(0, 0, zz, nz > 0 ? 1 : -1, 0));
    for (let x = w0 + 1.8; x < w3 - 1.0; x += 3.1) {
      const lx = nz > 0 ? x : -x, inC = x > w1 && x < w2;
      if (nz < 0 && Math.abs(x - tx) < bw + 0.6) continue;
      if (inC) { B.archUnit('arch', lx, 1.3, 5.2, 8.6, 0, [LIT[(Math.round(x) & 31)], 1], q ? 5 : 8); B.unit('sash', rect(lx - 0.6, 1.0, lx + 0.6, 3.0), 0, [Math.round(x) & 7, 0]); if (q === 0) B.unit('niche', rect(lx - 0.7, 9.6, lx + 0.7, 11.4), 0, [0, 0]); }
      else { B.unit('sash', rect(lx - 0.58, 4.9, lx + 0.58, 7.2), 0, [Math.round(x) & 15, 1]); B.unit('sash', rect(lx - 0.58, 1.0, lx + 0.58, 3.0), 0, [Math.round(x) & 15, 0]); }
    }
    if (nz > 0) { B.unit('door', rect(tx - 0.8, 0, tx + 0.8, 3.0), 0.03, [0, 0]); B.box('dress', tx, 3.3, 0.2, 2.6, 0.25, 0.5, 0); }
    B.pop();
  }
  if (q < 2) for (const [xa, xb] of [[w0, w1], [w2, w3]]) for (const zz of [z0 - 0.04, z1 + 0.04]) B.box('dress', (xa + xb) / 2, 4.2, zz, xb - xa, 0.25, 0.1, 0, { bottom: true });
  // ---- the Tower of the Winds: octagon on the centre block, a frieze of the winds, cornice, low roof, Atlas and Hercules with the globe
  const [cx, cz] = OBS.tower, r = OBS.towerR, T0 = H2, T1 = OBS.towerTop, a0 = Math.PI / 8;
  prismN(B, 'stone', cx, cz, r, 8, T0, T1 - 1.6, a0, false);
  prismN(B, 'dress', cx, cz, r + 0.12, 8, T1 - 1.6, T1, a0, false);
  prismN(B, 'dress', cx, cz, r + 0.45, 8, T1, T1 + 0.45, a0, true);
  if (q < 2) for (let i = 0; i < 8; i++) {
    const t = a0 + (i + 0.5) * TAU / 8, ap = r * Math.cos(Math.PI / 8) + 0.015;
    B.push(frame(cx + Math.sin(t) * ap, 0, cz + Math.cos(t) * ap, Math.cos(t), -Math.sin(t)));
    // tall round-headed windows on alternate faces, blind niches on the others; the wind's relief in the frieze
    if (i % 2 === 0) B.archUnit('arch', 0, 1.3, T0 + 2.2, T0 + 7.6, 0, [DARK[i % 16], 1], q ? 5 : 8);
    else if (q === 0) B.unit('niche', rect(-0.7, T0 + 3.0, 0.7, T0 + 8.0), 0, [0, 0]);
    if (q === 0) B.card('carve', [-1.4, T1 - 1.45, 0.13], [1.4, T1 - 1.45, 0.13], [1.4, T1 - 0.2, 0.13], [-1.4, T1 - 0.2, 0.13], [0.02, 0.05, 2.0, 0.95]);
    B.pop();
  }
  B.lathe('lead', cx, cz, [[r + 0.3, T1 + 0.45], [r * 0.55, T1 + 1.4], [1.3, T1 + 1.7]], { seg: 8, a0 });
  B.cyl('dress', cx, T1 + 1.7, cz, 1.35, 0.5, 8, true);
  // two crouching figures back to back (abstract: lathe bodies, arms up), the copper globe on their shoulders
  const gy = T1 + 2.2, G = 1.25;
  for (const s of [-1, 1]) {
    const fx = cx + s * 0.55;
    B.lathe('statue', fx, cz, [[0.42, gy], [0.5, gy + 0.6], [0.38, gy + 1.3], [0.3, gy + 1.7], [0.02, gy + 1.9]], { seg: q ? 5 : 8 });
    if (q < 2) { B.beam('statue', [fx, gy + 1.5, cz - 0.3], [fx - s * 0.1, gy + 2.15, cz - 0.55], 0.14); B.beam('statue', [fx, gy + 1.5, cz + 0.3], [fx - s * 0.1, gy + 2.15, cz + 0.55], 0.14); }
  }
  const prof = []; const n = q === 2 ? 4 : q ? 6 : 9; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI; prof.push([Math.max(0.01, Math.cos(a) * G), gy + 1.9 + G + Math.sin(a) * G]); }
  B.lathe('copper', cx, cz, prof, { seg: q === 2 ? 8 : q ? 10 : 14 });
  if (q === 0) for (const yy of [0, 0.5]) B.lathe('gold', cx, cz, [[G * Math.cos(yy) + 0.03, gy + 1.9 + G + Math.sin(yy) * G - 0.04], [G * Math.cos(yy) + 0.03, gy + 1.9 + G + Math.sin(yy) * G + 0.04]], { seg: 14 });
}

/** a Stevenson screen on its stand (white louvred box) at (x, z) */
export function stevenson(B, x, z, q) {
  for (const sx of [-0.3, 0.3]) for (const sz of [-0.3, 0.3]) B.box('white', x + sx, 0.55, z + sz, 0.06, 1.1, 0.06, 0, { top: false });
  B.box('white', x, 1.42, z, 0.85, 0.64, 0.6, 0);
  B.box('white', x, 1.79, z, 0.95, 0.06, 0.7, 0);
  if (q === 0) for (let k = 0; k < 6; k++) B.box('dark', x, 1.16 + k * 0.1, z + 0.305, 0.75, 0.012, 0.01, 0);
  // a rain gauge and a sunshine recorder on a post beside it
  B.cyl('lead2', x + 1.4, 0, z, 0.07, 0.35, 8, true);
  B.cyl('white', x - 1.3, 0, z + 0.2, 0.05, 1.2, 5, false); B.lathe('dark', x - 1.3, z + 0.2, [[0.01, 1.2], [0.12, 1.3], [0.01, 1.42]], { seg: 6 });
}

/**
 * A North Oxford Gothic villa's street front (G: a type, not any one house — a projecting gable with bargeboards and a
 * finial, a two-storey canted bay, a gabled porch with a pointed door, pointed windows in buff dressings; the mapped
 * house keeps its walls and roof behind). f: the street face, h: the mapped height, st: villaStyle.
 */
export function villaFront(B, f, h, st, q, id) {
  const yellow = st.tint[0] > 1.2, brick = yellow ? 'brickBuff' : 'brick', band = yellow ? 'brick' : 'brickBuff';
  const L = f.L, side = h01(parseInt(String(id).replace(/\D/g, ''), 10) | 0, 913) < 0.5 ? -1 : 1;
  const gw = Math.min(5.0, L * 0.42), gx = side * (L / 2 - gw / 2 - 0.6), eave = Math.max(6.2, h * 0.68), peak = Math.max(eave + gw * 0.62, h + 0.8), D = 0.9;
  B.push(faceFrame(f));
  // the projecting gable: front, returns, a roof of two steep slopes, bargeboards and a finial
  const out = [[gx - gw / 2, 0], [gx + gw / 2, 0], [gx + gw / 2, eave], [gx, peak], [gx - gw / 2, eave]];
  B.face(brick, out, [], D);
  for (const s of [-1, 1]) B.poly(brick, [[gx + s * gw / 2, 0, 0.02], [gx + s * gw / 2, 0, D], [gx + s * gw / 2, eave, D], [gx + s * gw / 2, eave, 0.02]], [s, 0, 0]);
  const roofK = st.roof === 'tile' ? 'tileRed' : 'slate';
  for (const s of [-1, 1]) B.poly(roofK, [[gx + s * (gw / 2 + 0.3), eave - 0.25, D + 0.35], [gx, peak + 0.1, D + 0.35], [gx, peak + 0.1, -0.6], [gx + s * (gw / 2 + 0.3), eave - 0.25, -0.6]], [s * 0.7, 0.7, 0]);
  if (q < 2) {
    for (const s of [-1, 1]) B.beam('white', [gx + s * (gw / 2 + 0.28), eave - 0.3, D + 0.4], [gx, peak + 0.05, D + 0.4], 0.1, 0.24);
    B.box('white', gx, peak - 0.3, D + 0.42, 0.1, 1.6, 0.1, 0);
    for (const y of [0.4, 3.0, eave - 0.2]) B.box(band, gx, y, D + 0.02, gw + 0.04, 0.22, 0.06, 0, { bottom: true });
    // windows in the gable: a pointed two-light on each floor, a small lancet in the apex
    B.unit('gothWinBuff', rect(gx - 0.85, 0.9, gx + 0.85, 2.9), D + 0.022, [LIT[(gx * 7 | 0) & 31], 0]);
    B.unit('gothWinBuff', rect(gx - 0.8, 3.6, gx + 0.8, 5.5), D + 0.022, [LIT[((gx * 7 | 0) + 5) & 31], 1]);
    if (peak - eave > 2.2) B.unit('gothWin', rect(gx - 0.35, eave + 0.2, gx + 0.35, eave + 1.5), D + 0.016, [DARK[3], 2]);
  }
  // the canted bay on the other side: two storeys, a lead roof
  const bx = -side * (L / 2 - 2.0), bw = 2.6, bd = 0.7, bh = Math.min(5.8, eave - 0.3);
  if (Math.abs(bx - gx) > gw / 2 + bw / 2 + 0.3) {
    const P = [[bx - bw / 2, 0], [bx - bw / 2 + bd * 0.7, bd], [bx + bw / 2 - bd * 0.7, bd], [bx + bw / 2, 0]];
    for (let i = 0; i < 3; i++) {
      const [ax, az] = P[i], [cx2, cz2] = P[i + 1], nx = cz2 - az, nz = -(cx2 - ax), l = Math.hypot(nx, nz) || 1;
      B.poly(brick, [[ax, 0, az + 0.02], [cx2, 0, cz2 + 0.02], [cx2, bh, cz2 + 0.02], [ax, bh, az + 0.02]], [-nx / l, 0, -nz / l]);
      if (q < 2 && i === 1) { const mx = (ax + cx2) / 2, mz = (az + cz2) / 2 + 0.03, wl = Math.hypot(cx2 - ax, cz2 - az) * 0.34; B.push(frame(mx, 0, mz, (cx2 - ax) / (l || 1), (cz2 - az) / (l || 1))); B.unit('gothWinBuff', rect(-wl, 0.9, wl, 2.6), 0.016, [LIT[(i + (bx | 0)) & 31], 0]); B.unit('gothWinBuff', rect(-wl, 3.4, wl, 5.0), 0.016, [LIT[(i + 9 + (bx | 0)) & 31], 1]); B.pop(); }
    }
    B.flat('lead', P, bh); B.lathe('lead', bx, bd * 0.4, [[bw * 0.55, bh], [0.1, bh + 0.5]], { seg: 4, a0: Math.PI / 4 });
  }
  // the porch: a gabled timber-and-brick porch with a pointed door between gable and bay
  const px = (gx + bx) / 2, pw = 1.9, ph = 2.8;
  if (Math.abs(px - gx) > gw / 2 + pw / 2 - 0.1 && Math.abs(px - bx) > bw / 2 + pw / 2) {
    for (const s of [-1, 1]) B.box(brick, px + s * (pw / 2 - 0.15), ph / 2, 0.8, 0.3, ph, 1.5, 0, { top: true });
    for (const s of [-1, 1]) B.poly(roofK, [[px + s * (pw / 2 + 0.2), ph, 1.7], [px, ph + 0.9, 1.7], [px, ph + 0.9, 0.0], [px + s * (pw / 2 + 0.2), ph, 0.0]], [s * 0.7, 0.7, 0]);
    B.face('white', [[px - pw / 2, ph], [px + pw / 2, ph], [px, ph + 0.88]], [], 1.55);
    B.unit('door', rect(px - 0.5, 0, px + 0.5, 2.3), 0.04, [0, 0]);
    if (q === 0) B.box('dress', px, 0.08, 1.2, pw + 0.3, 0.16, 1.0, 0);
  }
  B.pop();
}
export { pip, faces };
