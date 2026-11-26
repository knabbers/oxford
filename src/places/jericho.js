// Jericho, c. 2013 — Walton Street north of Worcester, the canal and St Barnabas (see
// docs/research/east_oxford_jericho.md: sources, known vs guessed).
//
//   preMap   every business in Jericho and on Walton Street is listed (for the shop dressing) under its real name, or
//            under ?invented=1 gets an invented name of its kind (_eo_names.js); St Barnabas
//            (w304699783) is skipped and rebuilt here
//   install  (all in the shared batch-4 atlas draw, _b4_kit.js — no new draw call)
//            · St Barnabas: the Italianate basilica (render, brick bands, clerestory, round-headed lights) and its 40 m
//              campanile by the canal, the district's skyline marker, drawn out to 1.6 km
//            · the Phoenix Picturehouse front ("The Walton Cinema" under ?invented=1): pale blue render, name between bulbs, the
//              canopy and its lit "today" board
//            · the University Press: a classical stone front on the mapped building's Walton Street faces — rusticated
//              ground floor, pilasters, entablature, balustrade, and the monumental arch with paired columns and gates
//            · narrowboats moored along the canal by St Barnabas (invented names and paint), the white iron rails of
//              the footbridge over the canal, the parade's shutters, stalls and boards (as on the Cowley Road)
//   sights   for the passport (game.jericho.sights)
//
// Test hooks: game.jericho = { sights, renamed, boats, stats() }       tools/smoke_east.mjs
import { shared, addSite, RB } from './_b4_kit.js';
import { renameBusinesses } from './_eo_names.js';
import { mergeFaces, buildingById, buildingAt, streetFaces, roadDist } from './_eo_kit.js';
import { shopDress, bikeRow } from './_eo_build.js';
import { barnabas, BARNABAS, cinema2, pressFront, narrowboat, bridgeRails, freudFront } from './_jer_build.js';
import { nearSet, BOATER_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';
import { tn, inventedNames } from '../core/features.js';

export const IDS = { cinema: 'w111835113', press: 'r1361142', bridge: 'w38241247', canal: 'w3220559', freud: 'w111835087', tavern: 'w111835063' };
export const FIXED = { 'Phoenix Picturehouse': 'The Walton Cinema', 'Jericho Tavern': 'The Printers Arms', 'Jude the Obscure': 'The Old Type Foundry' };
export const district = (map) => { const d = roadDist(map, ['Walton Street']); return (x, z) => (d(x, z) < 40 && z < -270) || (x < -420 && x > -770 && z < -200 && z > -780); };
/** where the boats lie: along the canal by St Barnabas, 2.5 m off the centre line towards the Jericho (east) bank */
export const MOORING = { z0: -268, z1: -440, off: 2.5, lens: [18.5, 20, 16.8, 19.2, 17.6, 21] };

export const sights = [
  { id: 'jer-barnabas', name: 'St Barnabas, Jericho', x: -672, z: -338, blurb: 'Blomfield\'s Italianate church of 1869 for the printers of Jericho, its campanile by the canal one of Oxford\'s landmarks (cut down to 132 ft in 1893).' },
  { id: 'jer-cinema', name: tn('The Phoenix Picturehouse', 'The Walton Cinema'), x: -470, z: -566, blurb: tn('Jericho\'s picture house on Walton Street, open since 1913 (the North Oxford Kinema, later the Scala).', 'Jericho\'s picture house on Walton Street, open since before the First World War. (An invented name for the real cinema here.)') },
  { id: 'jer-press', name: 'The University Press', x: -288, z: -392, blurb: 'The printing house of 1826-30 on Walton Street: two wings and a screen with a triumphal Corinthian gateway. Jericho grew up round its presses.' },
  { id: 'jer-boats', name: 'Narrowboats on the Oxford Canal', x: -716, z: -330, blurb: 'Boats moored nose to tail below St Barnabas: chimneys smoking, plants and bikes on the roofs, names painted on the cabin sides.' },
  { id: 'jer-footbridge', name: 'The canal footbridge', x: -744, z: -457, blurb: 'A white iron footbridge over the Oxford Canal, from Jericho to the towpath and the boatyard side.' },
];

export default {
  id: 'jericho',
  preMap(game) {
    try {
      const m = game.map;
      if (m && !m._jerRenamed) Object.defineProperty(m, '_jerRenamed', { value: renameBusinesses(m, 'jericho', district(m), FIXED, { keep: !inventedNames() }), enumerable: false });
      game.overrides.skip.add(BARNABAS.id);
      // photo comparison item 18 ("walton_st"): the Jericho Tavern is a three-storey cream-painted pub with sashes
      // above the pub front, not red brick with shopfronts (the arched ground-floor windows are the pub front's cell)
      if (!game.overrides.style.has(IDS.tavern)) game.overrides.style.set(IDS.tavern, { wall: 'render', roof: 'slate', tint: [1.1, 1.02, 0.8], up: 'renderSash', ground: 'pubFront', storeys: 3, ivy: false });
    } catch (e) { console.error('[jericho] preMap', e); }
  },

  install(game) {
    const K = shared(game), me = K.join('jericho'), map = game.map, col = game.worldCollider;
    const S = { err: false, boats: [], shops: 0, fronts: {} };
    const night = () => { const h = game.time.hour; return h >= 21.5 || h < 7; };
    try {
      const dW = roadDist(map, ['Walton Street']);
      const best = (b, d, reach = 12) => { if (!b) return null; const fs = mergeFaces(streetFaces(b.poly, d, reach)); fs.sort((a, c) => c.L - a.L); return fs[0] || null; };
      // St Barnabas
      const sb = map.buildings.find((b) => b.id === BARNABAS.id);
      if (sb) { let tw = null; addSite(K, 'jer:barnabas', [-674, 16, -330], 30, [130, 420, 1250], [0, 1, 2].map((q) => { const B = new RB(); const r = barnabas(B, sb.poly, q); tw = r.tower; return B; })); col.addPolygon(sb.poly); S.tower = tw; }
      // the cinema
      const cb = buildingById(map, IDS.cinema), fc = best(cb, dW);
      if (fc) { S.fronts.cinema = fc; addSite(K, 'jer:cinema', [fc.mx, 5, fc.mz], 12, [90, 240, 500], [0, 1, 2].map((q) => { const B = new RB(); cinema2(B, fc, cb.h, q); if (q < 2) bikeRow(B, fc, fc.L / 2 + 1.8, 3, map, q, 5); return B; })); }
      // the University Press front
      const pb = buildingById(map, IDS.press);
      if (pb) {
        const fs = streetFaces(pb.poly, dW, 16, 4);
        if (fs.length) {
          let mx = 0, mz = 0; for (const f of fs) { mx += f.mx / fs.length; mz += f.mz / fs.length; }
          const gate = fs.filter((f) => f.L >= 7).sort((a, b) => Math.hypot(a.mx - mx, a.mz - mz) - Math.hypot(b.mx - mx, b.mz - mz))[0] || fs[0];
          S.fronts.press = fs; S.fronts.gate = gate;
          addSite(K, 'jer:press', [mx, 7, mz], 45, [110, 220, 330], [0, 1, 2].map((q) => { const B = new RB(); pressFront(B, fs, gate, pb.h, q); return B; }));
          for (const f of fs) col.addBox(f.mx + f.nx * 0.17, f.mz + f.nz * 0.17, 0.36, f.L, Math.atan2(f.ux, f.uz));      // the skin is solid (width across, length along the face)
        }
      }
      // Freud: the Ionic portico of the former St Paul's on Walton Street (it was a plain stone block)
      const fb = buildingById(map, IDS.freud), ff = best(fb, dW, 16);
      if (ff) {
        const D = Math.max(1.4, Math.min(3.0, dW(ff.mx, ff.mz) - 3.2));      // stands out into the forecourt, short of the pavement
        let sol = null;
        addSite(K, 'jer:freud', [ff.mx + ff.nx * D / 2, 6, ff.mz + ff.nz * D / 2], 12, [110, 260, 600], [0, 1, 2].map((q) => { const B = new RB(); sol = freudFront(B, ff, D, q); return B; }));
        if (sol) {
          for (const [x, z, w, d, r] of sol.boxes) col.addBox(x, z, w, d, r);
          for (const [x, z, r] of sol.circles) col.addCircle(x, z, r);
          { const [x, z, w, d, r, top] = sol.podium; col.addBox(x, z, w, d, r, { top }); }      // the podium is a step up
        }
        S.fronts.freud = { f: ff, D };
      }
      // narrowboats along the canal
      const cl = map.waterlines.find((w) => w.id === IDS.canal);
      if (cl) {
        const pts = cl.pts, cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const at = (s) => { let i = 1; while (i < pts.length - 1 && cum[i] < s) i++; const a = pts[i - 1], b = pts[i], t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; let nx = -dz / l, nz = dx / l; if (nx < 0) { nx = -nx; nz = -nz; } return { x: a[0] + dx * t + nx * MOORING.off, z: a[1] + dz * t + nz * MOORING.off, h: Math.atan2(dx, dz) }; };
        let s = 0; while (s < cum[cum.length - 1] && at(s).z > MOORING.z0) s += 2;
        const B0 = new RB(), B1 = new RB(), B2 = new RB();
        for (let k = 0; S.boats.length < MOORING.lens.length && s < cum[cum.length - 1]; k++) {
          const L = MOORING.lens[k % MOORING.lens.length], p = at(s + L / 2);
          if (p.z < MOORING.z1) break;
          const ok = [-L / 2 + 1, 0, L / 2 - 1].every((o) => { const q = at(s + L / 2 + o); return col.isWater(q.x, q.z); });
          if (ok) { const h = p.h + (k % 2 ? Math.PI : 0); narrowboat(B0, p.x, p.z, h, L, k, 0); narrowboat(B1, p.x, p.z, h, L, k, 1); narrowboat(B2, p.x, p.z, h, L, k, 2); S.boats.push({ x: p.x, z: p.z, h, L }); col.addBox(p.x, p.z, 2.1, L, h); }
          s += L + 2.5 + (k % 3);
        }
        if (S.boats.length) { const c = S.boats[Math.floor(S.boats.length / 2)]; addSite(K, 'jer:boats', [c.x, 1, c.z], 70, [80, 220, 500], [B0, B1, B2]); }
      }
      // the footbridge's iron rails
      const br = map.roads.find((r) => r.id === IDS.bridge);
      if (br) addSite(K, 'jer:footbridge', [(br.pts[0][0] + br.pts[br.pts.length - 1][0]) / 2, 1, (br.pts[0][1] + br.pts[br.pts.length - 1][1]) / 2], 10, [70, 160, 260], [0, 1].map((q) => { const B = new RB(); bridgeRails(B, br.pts[0], br.pts[br.pts.length - 1], (br.w || 2.2) + 0.2, q); return B; }).concat([null]));
      // the parade
      const cells = new Map(), done = new Set();
      for (const r of map._jerRenamed || []) {
        let b = r.id.startsWith('n') ? null : buildingById(map, r.id);
        if (!b) { const p = map.pois.find((q) => q.id === r.id); if (p) b = buildingAt(map, p.p[0], p.p[1]); }
        if (!b || done.has(b.id) || b.id === IDS.cinema) continue; done.add(b.id);
        const f = best(b, dW); if (!f) continue;
        const key = Math.floor(f.mx / 160) + ',' + Math.floor(f.mz / 160);
        let c = cells.get(key); if (!c) cells.set(key, (c = { n: [new RB(), new RB(), new RB()], d: [new RB(), new RB()], x: 0, z: 0, k: 0 }));
        const sd = (parseInt(b.id.replace(/\D/g, ''), 10) % 991) / 991;
        for (let q = 0; q < 3; q++) shopDress(c.n[q], q < 2 ? c.d[q] : new RB(), f, r.kind, sd, q, map);
        c.x += f.mx; c.z += f.mz; c.k++; S.shops++;
      }
      for (const [key, c] of cells) {
        const cx = c.x / c.k, cz = c.z / c.k;
        addSite(K, 'jer:night:' + key, [cx, 2, cz], 110, [70, 150, 260], c.n, { need: night });
        addSite(K, 'jer:day:' + key, [cx, 1, cz], 110, [60, 130, 0.01], [c.d[0], c.d[1], null], { need: () => !night(), farArea: 99 });
      }
      K.boxes.push([-780, -260, -770, -260]);
    } catch (e) { console.error('[jericho] build', e); } finally { K.joined(me); }

    // boaters on the stern decks by day (08:00-20:00; spawned only near)
    let boaters = null;
    try {
      const people = S.boats.filter((_, i) => i % 2 === 0).map((b, i) => { const back = -b.L / 2 + 0.6; return { x: b.x + Math.sin(b.h) * back, z: b.z + Math.cos(b.h) * back, h: b.h + Math.PI, look: randomLook('jer-boater-' + i, { outfit: i % 2 ? 'tweed' : 'casual' }), pose: i % 2 ? 'stand' : 'phone', lines: i === 0 ? BOATER_LINES : null }; });
      if (people.length) boaters = nearSet(game, { c: [S.boats[0].x, S.boats[0].z], r: 90, h0: 8, h1: 20, people });
    } catch (e) { console.warn('[jericho] boaters', e); }
    game.jericho = {
      sights, renamed: map._jerRenamed || [], boats: S.boats, fronts: S.fronts,
      stats() { return { shops: S.shops, boats: S.boats.length, tower: S.tower, levels: K.lod.groups.filter((g) => /^jer:/.test(g.name)).map((g) => g.name + ':' + g.level), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^jer:/.test(k)).map(([k, v]) => [k, v.tris])) }; },
    };
    return { update() { try { K.tick(me); if (boaters) boaters.tick(); } catch (e) { if (!S.err) { S.err = true; console.error('[jericho]', e); } } } };
  },
};
