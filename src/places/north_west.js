// North and west photo-comparison pass (2026-11): materials for named buildings the style lottery got wrong, and a few
// small landmarks. Research and the ranked differences: docs/research/photo_comparison_north.md.
//   preMap   STYLE: wall / roof / window cells by map id for buildings whose real material is known (Rhodes House and
//            the Science Area were dark glass boxes or concrete at random; the Saïd Business School; the old Radcliffe
//            Infirmary; the Jam Factory…). Holywell Street's houses painted in their pastels. STYLE entries are laid
//            key by key over any earlier entry for the same id; the by-rule ones (Holywell, Oriel) only where none is.
//   install  Rhodes House's rotunda (copper dome) and Ionic portico on South Parks Road; the Saïd Business School's
//            ziggurat tower; the weir and punt rollers at Parson's Pleasure. Everything static goes into the shared
//            batch-4 atlas draw (_b4_kit.js): no draw call, material or program of its own.
// GUESSED (flagged in the research file): every colour here is from photographs, not measured; the rotunda's and the
// portico's sizes come from the mapped outline, their heights from photographs; where the ziggurat stands on the
// Saïd's plan; the form of the weir sill and the rollers.
// `?north=0` (GTO_NORTH=0) leaves the whole pass out (before / after shots).   Test hook: game.northWest.stats()
import { NORTH } from './_north_kit.js';
import { shared, addSite, RB, h01 } from './_b4_kit.js';

const BUFF = [1.16, 1.2, 0.98], RED = [1.05, 0.82, 0.7], REDDK = [0.9, 0.68, 0.6], HONEY = [1.0, 0.91, 0.76], CREAM = [1.08, 1.06, 1.0], GREYST = [0.82, 0.81, 0.79];
/** id -> style (same shape as game.overrides.style). K = known from photographs / the building's history, G = a guess */
export const STYLE = {
  // ---- Science Area and Parks Road
  w63101261: { wall: 'stone', roof: 'stone', tint: [0.97, 0.88, 0.74], up: 'stoneTudor', ground: 'stoneTudor', door: 'stoneArchDoor', ivy: false },          // K Rhodes House (1928): Cotswold rubble, stone slates
  w227122058: { wall: 'brick', roof: 'slate', tint: RED, up: 'brickGeorgian', ground: 'brickGeorgian', ivy: false },                                   // K Dyson Perrins (1916): red brick, stone dressings
  w52173939: { wall: 'brick', roof: 'tile', tint: RED, up: 'brickGeorgian', ground: 'brickGeorgian', shape: 'hipped', ivy: false },                    // K Dunn School of Pathology (1927): neo-Georgian red brick
  w226406677: { wall: 'brick', roof: 'slate', tint: REDDK, ivy: false },                                                                               // K Clarendon Laboratory, Townsend Building (1910): red brick
  w226406675: { wall: 'brick', roof: 'flat', tint: [0.96, 0.78, 0.66], ivy: false },                                                                   // K Lindemann Building (1939): brown brick
  r3083289: { wall: 'stone', roof: 'flat', tint: CREAM, up: 'stoneSashTall', ground: 'stoneSash', ivy: false },                                        // K Inorganic Chemistry (1957): stone-faced
  w297351068: { wall: 'stone', roof: 'flat', tint: HONEY, up: 'stoneSash', ground: 'stoneSash', ivy: false },                                          // K Plant Sciences (1950): Bladon stone
  r2646732: { wall: 'concrete', roof: 'flat', tint: [0.96, 0.94, 0.9] },                                                                               // K Denys Wilkinson Building (1967): board-marked concrete
  w66710279: { wall: 'concrete', roof: 'flat', tint: [1, 1, 1] },                                                                                      // K Thom Building (1963): concrete tower
  w1259077504: { wall: 'concrete', roof: 'flat', tint: [0.9, 0.9, 0.92] },                                                                             // K in 2013 the Tinbergen Building stood here (1970, concrete)
  w24405850: { wall: 'brick', roof: 'flat', tint: BUFF, ivy: false },                                                                                  // K St Cross Building (1964): buff brick
  // ---- Radcliffe Observatory Quarter, Wellington Square, Little Clarendon Street
  w187361875: { wall: 'stone', roof: 'slate', shape: 'hipped', tint: [1.04, 0.97, 0.84], up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor', ivy: false },   // K the old Radcliffe Infirmary (1770): ashlar
  w187361876: { wall: 'stone', roof: 'slate', tint: [1.04, 0.97, 0.84], up: 'stoneSash', ground: 'stoneSash', ivy: false },                            // K the Infirmary's outpatients' building: stone
  w174651448: { wall: 'brick', roof: 'flat', tint: [0.74, 0.6, 0.54], up: 'brickPair', ground: 'brickPair', ivy: false },                              // K New Radcliffe House (2012): dark brown brick
  w50593343: { wall: 'concrete', roof: 'flat', tint: [1.1, 1.04, 0.9] },                                                                               // K University Offices, Wellington Square (1970s): stone-faced bands over shops
  w131444936: { wall: 'concrete', roof: 'flat', tint: [1.1, 1.04, 0.9] },                                                                              // K 25 Wellington Square (1970s university block on Little Clarendon Street): stone-faced bands
  w87344193: { wall: 'stone', roof: 'lead', tint: HONEY, up: 'stoneSash', ground: 'stoneBlank', ivy: false },                                          // G the octagon by the Observatory: stone, as its neighbours
  r3066243: { wall: 'college', roof: 'slate', tint: [0.93, 0.92, 0.89], ivy: false },                                                                  // K St Antony's old convent building (1868): grey stone Gothic
  w45146951: { wall: 'stone', roof: 'stone', tint: HONEY, up: 'stoneSash', ground: 'stoneSash', ivy: false },                                          // K Hartland House, St Anne's (1937): stone
  w66710277: { wall: 'stone', roof: 'stone', tint: [0.97, 0.88, 0.74], up: 'stoneTudor', ground: 'stoneTudor', shape: 'gabled' },                      // K the Old Parsonage (17th century): rubble and gables
  w34185867: { wall: 'brick', roof: 'tile', tint: RED, shape: 'gabled', storeys: 2, up: 'brickSash', ground: 'brickSash', ivy: false },                // K the Parks' South Lodge: a tile-hung red brick cottage
  w1293650885: { wall: 'brick', roof: 'slate', tint: BUFF, gables: true, up: 'brickPoly', ground: 'brickPoly', ivy: false },                          // K Keble Road's north terrace: tall yellow brick Gothic houses
  w45146954: { wall: 'concrete', roof: 'flat', tint: [1.08, 1.03, 0.92] }, w45146955: { wall: 'concrete', roof: 'flat', tint: [1.08, 1.03, 0.92] },     // K St Anne's Wolfson and Rayne Buildings (1960s concrete)
  w45146953: { wall: 'render', roof: 'flat', tint: [1.03, 1.0, 0.94], ivy: false },                                                                    // K the Ruth Deech Building (2005): pale
  w848922567: { wall: 'stone', roof: 'lead', tint: [1.04, 0.97, 0.84], up: 'stoneSmall', ground: 'stoneSmall', crenel: false, ivy: false },            // G Nuffield's tower (taken to be this footprint)
  // ---- the station end and the castle
  r21358: { wall: 'stone', roof: 'flat', tint: [1.1, 1.06, 0.94], up: 'stoneSash', ground: 'stoneSash', crenel: false, ivy: false },                                               // K Saïd Business School (2001): buff brick and stone
  r11975872: { wall: 'stone', roof: 'flat', tint: [1.1, 1.06, 0.94], up: 'stoneSash', ground: 'stoneSash', crenel: false, ivy: false },                                            // K its west wing (2012)
  w226395302: { wall: 'brick', roof: 'slate', tint: RED, up: 'brickPoly', ground: 'brickPoly', ivy: false },                                           // K the marmalade factory (1903): red brick, stone bands
  w226395303: { wall: 'brick', roof: 'slate', tint: RED, up: 'brickPoly', ground: 'brickPoly', ivy: false },                                           // K Victoria Buildings, Park End Street
  w895199611: { wall: 'stone', roof: 'slate', tint: CREAM, up: 'stoneSash', ground: 'stoneSash', ivy: false },                                         // K the Royal Oxford Hotel (1935): stone-faced
  w114597537: { wall: 'brick', roof: 'slate', tint: RED, up: 'brickPoly', ground: 'brickPoly', ivy: false },                                           // K the Old Fire Station (1896): red brick and stone
  w130668549: { wall: 'college', roof: 'stone', tint: [1.0, 0.91, 0.76], gables: true, crenel: false, parapet: false, ivy: false },                   // K the old Boys' High School (Jackson, 1881): gabled stone
  w263943861: { wall: 'college', roof: 'lead', tint: GREYST, crenel: true, ivy: false },                                                               // K County Hall (1841): castellated grey stone
  w928211085: { wall: 'stone', roof: 'slate', tint: [0.72, 0.71, 0.68], up: 'stoneSmall', ground: 'stoneSash', ivy: false },                           // G the castle yard's 2005 ranges: grey stone, as the prison
  w928211087: { wall: 'stone', roof: 'slate', tint: [0.72, 0.71, 0.68], up: 'stoneSmall', ground: 'stoneSash', ivy: false },
  w928211090: { wall: 'stone', roof: 'slate', tint: [0.72, 0.71, 0.68], up: 'stoneSmall', ground: 'stoneSash', ivy: false },
};
/** Lincoln's front quad (K: creeper over three sides; the hall side is bare): style key `ivy: true` asks the world for it */
export const CREEPER = ['w301653289', 'w301661567', 'w301661562', 'w301661566'];
export const HEIGHTS = { w63101261: 9.8, w34185867: 6.2, w1293650885: 13.2, w848922567: 30 };   // Rhodes House: two storeys and an attic (OSM carries no height)
/** Holywell Street's painted fronts (K: cream, yellow, pink, pale blue and white stucco houses; which house is which colour is a GUESS) */
const PASTEL = [[1.03, 0.98, 0.8], [1.04, 0.92, 0.66], [1.0, 0.84, 0.8], [0.84, 0.92, 1.0], [1.03, 1.02, 0.98], [0.9, 0.96, 0.84], [1.02, 0.9, 0.76]];

// Rhodes House: the rotunda's centre and radius and the portico's axis, from the mapped outline (w63101261)
export const RHODES = { c: [338.95, -302.95], r: 6.1, d: [-0.376, -0.927], s0: 2.8, s1: 10.2, hw: 3.5, eaves: 7.7, drum: 11.4 };
// the Saïd's tower: on the west (station) side of r21358, seen from Frideswide Square behind the main block (where exactly: a GUESS)
export const SAID = { c: [-615.0, 158.0], half: 3.6, roof: 11.6, shaft: 21.0 };
// Nuffield College's tower (K: about 46 m to the top of its copper fleche; the footprint w848922567 is a GUESS)
export const NUFFIELD = { id: 'w848922567', wall: 30, top: 46 };
// Parson's Pleasure: where the sill crosses the mouth of the west channel and which way the water runs from it (from the
// drawn water; a GUESS at the real weir's exact line), and the punt rollers' POI
export const PARSONS = { rollers: 'n8669840815', sill: [969.0, -571.8], flow: [-0.4, 0.917] };

export default {
  id: 'north_west',
  preMap(game) {
    if (!NORTH) return;
    try {
      const ov = game.overrides, m = game.map;
      for (const [id, st] of Object.entries(STYLE)) ov.style.set(id, { ...(ov.style.get(id) || {}), ...st });   // key by key over an earlier generic entry (north_oxford's villa rule)
      for (const [id, h] of Object.entries(HEIGHTS)) if (!ov.heights.has(id)) ov.heights.set(id, h);
      for (const id of CREEPER) ov.style.set(id, { ...(ov.style.get(id) || {}), ivy: true });
      for (const b of m.buildings) {
        const t = b.tags || {};
        if (b.part || t['addr:street'] !== 'Holywell Street' || !t['addr:housenumber'] || t.amenity || t.shop || ov.style.has(b.id) || b.h > 14.6) continue;
        const k = h01(b.c[0] | 0, b.c[1] | 0);
        if (k < 0.16) continue;                                   // a few stay stone
        ov.style.set(b.id, { wall: 'render', tint: PASTEL[Math.floor(h01(b.c[1] | 0, b.c[0] | 0) * PASTEL.length) % PASTEL.length], roof: k < 0.6 ? 'slate' : 'stone', up: 'renderGeorgian', ground: 'renderSash', ivy: false });
      }
      // Oriel's front on Oriel Square (K: a row of shaped Jacobean gables over a three-storey range; drawn with the
      // generic attic gables): the small mapped staircases of the west range
      for (const b of m.buildings) {
        const t = b.tags || {};
        if (b.part || t.operator !== 'Oriel College' || t.name || b.c[0] < 398 || b.c[0] > 414 || b.c[1] < 305 || b.c[1] > 356 || ov.style.has(b.id)) continue;
        ov.style.set(b.id, { wall: 'college', roof: 'stone', gables: true, crenel: false, parapet: false, stacks: 'tall', ivy: false });
      }
    } catch (e) { console.error('[north_west] preMap', e); }
  },

  install(game) {
    if (!NORTH) return null;
    const K = shared(game), me = K.join('north_west'), map = game.map, col = game.worldCollider, W = game.world;
    const S = { err: false, rhodes: false, said: false, weir: null, rollers: null };
    const key = (k, base, o) => { if (!K.pack.cells.has(k)) K.pack.cells.set(k, { ...K.pack.cells.get(base), ...o }); return k; };
    try {
      key('nwCopper', 'weather', { tint: [0.36, 0.62, 0.5] }); key('nwRubble', 'rubble', { tint: [0.97, 0.88, 0.74] }); key('nwHoney', 'stone', { tint: [1.06, 0.98, 0.84] });
      key('nwBronze', 'white', { tint: [0.1, 0.09, 0.07] });
      key('nwFoam', 'foam', { tint: [1.7, 1.7, 1.66] }); key('nwWet', 'stone', { tint: [0.3, 0.31, 0.29] });
      // ---------------------------------------------------------------- Rhodes House: the rotunda and the portico
      if (map.buildings.some((b) => b.id === 'w63101261')) {
        const R = RHODES, [cx, cz] = R.c, [dx, dz] = R.d, ax = dz, az = -dx;      // a: across the portico (to the right, seen from the road)
        const P = (s, t, y) => [cx + dx * s + ax * t, y, cz + dz * s + az * t], rot = Math.atan2(dx, dz);
        const E = R.eaves, D = R.drum, Bq = [new RB(), new RB(), new RB()];
        for (let q = 0; q < 3; q++) {
          const B = Bq[q], seg = q === 0 ? 24 : q === 1 ? 14 : 8;
          // the drum (rubble), a cornice, the copper dome and its bronze finial (the bird; a plain shape here)
          B.lathe('nwRubble', cx, cz, [[R.r, 0], [R.r, D], [R.r + 0.25, D + 0.05, 'dress'], [R.r + 0.25, D + 0.5, 'nwCopper'], [R.r - 0.4, D + 1.9, 'nwCopper'], [R.r - 1.6, D + 3.1, 'nwCopper'], [R.r - 3.4, D + 3.9, 'nwCopper'], [0.5, D + 4.25, 'nwCopper'], [0.01, D + 4.27]], { seg, crease: 0.9 });
          if (q < 2) { B.cyl('nwBronze', cx, D + 4.25, cz, 0.16, 0.9, 6, true, 0.3); B.box('nwBronze', cx, D + 5.45, cz, 0.22, 0.7, 0.5, rot); }
          // the portico over the mapped block: an entablature and balustrade round three sides, giant Ionic columns
          // standing proud of its walls, the wall between them in shadow, the door
          const sm = (R.s0 + R.s1) / 2 + 0.3, len = R.s1 - R.s0 + 0.6, wid = R.hw * 2 + 1.5;
          { const p = P(sm, 0, 0); B.box('dress', p[0], E + 0.45, p[2], wid, 0.9, len + 0.9, rot); B.box('dress', p[0], E + 0.98, p[2], wid + 0.3, 0.16, len + 1.2, rot, { bottom: true }); }
          if (q < 2) for (const [s0, t0, s1, t1] of [[R.s1 + 0.7, -R.hw - 0.7, R.s1 + 0.7, R.hw + 0.7], [R.s0 + 1, -R.hw - 0.7, R.s1 + 0.7, -R.hw - 0.7], [R.s0 + 1, R.hw + 0.7, R.s1 + 0.7, R.hw + 0.7]]) {
            const a = P(s0, t0, E + 1.06), b = P(s1, t1, E + 1.06), L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = [(a[0] + b[0]) / 2 - P(sm, 0, 0)[0], 0, (a[2] + b[2]) / 2 - P(sm, 0, 0)[2]];
            for (const o of [1, -1]) B.poly('balus', [a, b, [b[0], E + 1.96, b[2]], [a[0], E + 1.96, a[2]]], [n[0] * o, 0, n[2] * o], [[0, 0], [Math.round(L), 0], [Math.round(L), 1], [0, 1]]);
            B.beam('dress', [a[0], E + 2.0, a[2]], [b[0], E + 2.0, b[2]], 0.16, 0.1);
          }
          const cols = [[R.s1 + 0.5, -R.hw + 0.35], [R.s1 + 0.5, -1.15], [R.s1 + 0.5, 1.15], [R.s1 + 0.5, R.hw - 0.35], [R.s1 - 2.6, -R.hw - 0.5], [R.s1 - 2.6, R.hw + 0.5], [R.s0 + 1.6, -R.hw - 0.5], [R.s0 + 1.6, R.hw + 0.5]];
          for (const [s, t] of cols) {
            const p = P(s, t, 0);
            if (q < 2) { B.box('dress', p[0], 0.2, p[2], 0.95, 0.4, 0.95, rot); B.box('dress', p[0], E - 0.16, p[2], 1.0, 0.32, 0.8, rot); }
            B.cyl('nwHoney', p[0], q < 2 ? 0.4 : 0, p[2], 0.34, E - (q < 2 ? 0.72 : 0), q === 0 ? 12 : 6, false, 0.41);
          }
          if (q < 2) {
            const f = R.s1 + 0.07;
            B.poly('shade', [P(f, -R.hw + 0.9, 0.5), P(f, R.hw - 0.9, 0.5), P(f, R.hw - 0.9, E - 0.5), P(f, -R.hw + 0.9, E - 0.5)], [dx, 0, dz]);
            B.poly('doorOak', [P(f + 0.03, -0.9, 0.5), P(f + 0.03, 0.9, 0.5), P(f + 0.03, 0.9, 3.4), P(f + 0.03, -0.9, 3.4)], [dx, 0, dz], [[0, 0], [1, 0], [1, 1], [0, 1]]);
            for (const [k, w] of [[0, 3.2], [1, 2.6], [2, 2.0]]) { const p = P(R.s1 + 0.9 + k * 0.3, 0, 0); B.box('dress', p[0], 0.5 - (k + 1) * 0.14 + 0.07, p[2], R.hw * 2 + w, 0.14, 0.34, rot, { bottom: false }); }
          }
        }
        addSite(K, 'nw:rhodes', [cx + dx * 4, 6, cz + dz * 4], 14, [130, 300, 700], Bq);
        for (const [s, t] of [[RHODES.s1 + 0.5, -RHODES.hw + 0.35], [RHODES.s1 + 0.5, RHODES.hw - 0.35]]) { const p = P(s, t, 0); col.addCircle(p[0], p[2], 0.5); }
        col.addCircle(cx, cz, R.r + 0.1);
        try { const q = (s, t) => { const p = P(s, t, 0); return [p[0], p[2]]; }; W.clearArea([q(R.s1 - 4, -R.hw - 12), q(R.s1 + 7, -R.hw - 12), q(R.s1 + 7, R.hw + 12), q(R.s1 - 4, R.hw + 12)], { trees: true, lamps: false, furniture: false }); W.clearArea([q(R.s1 - 1, -R.hw - 3), q(R.s1 + 5, -R.hw - 3), q(R.s1 + 5, R.hw + 3), q(R.s1 - 1, R.hw + 3)], { trees: true, lamps: true, furniture: true }); } catch { /* */ }
        S.rhodes = true;
      }
      // ---------------------------------------------------------------- the Saïd Business School's ziggurat
      if (map.buildings.some((b) => b.id === 'r21358')) {
        const Z = SAID, [x, z] = Z.c, Bq = [new RB(), new RB(), new RB()];
        key('nwBuff', 'stone', { tint: [1.1, 1.06, 0.94] });
        for (let q = 0; q < 3; q++) {
          const B = Bq[q];
          B.box('nwBuff', x, (Z.roof - 0.4 + Z.shaft) / 2, z, Z.half * 2, Z.shaft - Z.roof + 0.4, Z.half * 2, 0.17, { bottom: false, top: false });
          if (q < 2) for (let k = 0; k < 4; k++) { const a = 0.17 + k * Math.PI / 2, ox = Math.sin(a) * (Z.half + 0.03), oz = Math.cos(a) * (Z.half + 0.03); B.box('shade', x + ox, Z.shaft - 3.2, z + oz, 2.2, 3.6, 0.06, a); }
          B.box('dress', x, Z.shaft + 0.15, z, Z.half * 2 + 0.5, 0.3, Z.half * 2 + 0.5, 0.17);
          // the stepped copper pyramid and its needle
          let y = Z.shaft + 0.3;
          for (let k = 0; k < 5; k++) { const w = (Z.half * 2 - 0.4) * (1 - k * 0.19); B.box('nwCopper', x, y + 0.6, z, w, 1.2, w, 0.17, { bottom: false }); y += 1.2; }
          B.cyl('nwCopper', x, y, z, 0.03, 5.2, q === 0 ? 8 : 4, true, 0.28);
          if (q === 0) B.lathe('gold', x, z, [[0.01, y + 5.1], [0.2, y + 5.3], [0.2, y + 5.5], [0.01, y + 5.7]], { seg: 6 });
        }
        addSite(K, 'nw:said', [x, 22, z], 14, [200, 500, 1100], Bq);
        S.said = true;
      }
      // ---------------------------------------------------------------- Nuffield College: the tower's copper fleche
      {
        const b = map.buildings.find((q) => q.id === NUFFIELD.id);
        if (b) {
          const [x, z] = b.c, Bq = [new RB(), new RB(), new RB()], y0 = NUFFIELD.wall;
          for (let q = 0; q < 3; q++) {
            const B = Bq[q];
            B.lathe('lead', x, z, [[3.4, y0 - 0.2], [2.5, y0 + 1.2], [2.2, y0 + 1.3, 'nwCopper'], [1.7, y0 + 3.2, 'nwCopper'], [1.45, y0 + 3.4, 'nwCopper'], [0.06, NUFFIELD.top - 0.6, 'nwCopper'], [0.01, NUFFIELD.top - 0.5]], { seg: 8, facet: true, crease: 0.2 });
            if (q === 0) B.lathe('gold', x, z, [[0.01, NUFFIELD.top - 0.7], [0.22, NUFFIELD.top - 0.45], [0.01, NUFFIELD.top - 0.2]], { seg: 6 });
          }
          addSite(K, 'nw:nuffield', [x, (y0 + NUFFIELD.top) / 2, z], 9, [260, 600, 1300], Bq);
          S.nuffield = true;
        }
      }
      // ---------------------------------------------------------------- Parson's Pleasure: the weir and the punt rollers
      {
        {
          // the sill crosses the mouth of the west channel, where the pool above divides round the island; the white
          // water runs down that channel towards the cycle path's footbridge
          const m = PARSONS.sill, [ux, uz] = PARSONS.flow, nx = -uz, nz = ux;       // u: downstream, n: across
          const wetAt = (s, t) => col.isWater(m[0] + ux * s + nx * t, m[1] + uz * s + nz * t);
          const reach = (sd) => { let t = 0.5; while (t < 9 && wetAt(0, sd * (t + 0.5))) t += 0.5; return t + 0.5; };
          if (wetAt(0, 0)) {
            const r0 = reach(-1), r1 = reach(1), P = (s, t, y) => [m[0] + ux * s + nx * t, y, m[1] + uz * s + nz * t];
            const B0 = new RB(), B1 = new RB();
            for (const [B, q] of [[B0, 0], [B1, 1]]) {
              B.poly('nwWet', [P(-0.7, -r0, 0.2), P(-0.7, r1, 0.2), P(0.1, r1, 0.2), P(0.1, -r0, 0.2)], [0, 1, 0]);
              B.poly('nwWet', [P(-0.7, -r0, -0.3), P(-0.7, r1, -0.3), P(-0.7, r1, 0.2), P(-0.7, -r0, 0.2)], [-ux, 0, -uz]);
              // white water: the fall off the sill, then broken water in cells, only where the channel really is
              const C = q === 0 ? 1.25 : 2.5;
              for (let t = -r0; t < r1 - 0.01; t += C) {
                const t1 = Math.min(r1, t + C);
                B.poly('nwFoam', [P(0.1, t, 0.2), P(0.1, t1, 0.2), P(2.2, t1, 0.075), P(2.2, t, 0.075)], [ux * 0.2, 1, uz * 0.2], [[t / 2, 0], [t1 / 2, 0], [t1 / 2, 1.1], [t / 2, 1.1]]);
                for (let s = 2.2; s < 10.5; s += C) {
                  if (!wetAt(s + C / 2, (t + t1) / 2) || !wetAt(s + C, t) || !wetAt(s + C, t1) || (s > 7 && ((Math.floor(s * 3.1) + Math.floor((t + 20) * 2.7)) % 3 === 0))) continue;
                  B.poly(s < 5.5 ? 'nwFoam' : 'foam', [P(s, t, 0.075), P(s, t1, 0.075), P(s + C, t1, 0.06), P(s + C, t, 0.06)], [0, 1, 0], [[t / 2, s / 2], [t1 / 2, s / 2], [t1 / 2, (s + C) / 2], [t / 2, (s + C) / 2]]);
                }
              }
            }
            addSite(K, 'nw:weir', [m[0] + ux * 4, 0.4, m[1] + uz * 4], Math.max(r0, r1) + 9, [110, 260, 0.01], [B0, B1, null], { farArea: 99 });
            S.weir = { m, ux, uz, r0, r1 };
          }
        }
        const rp = map.pois.find((p) => p.id === PARSONS.rollers);
        if (rp) {
          // the punt rollers: a concrete ramp between the two levels with iron rollers across it and a timber rail
          const [ux, uz] = PARSONS.flow, nx = -uz, nz = ux;
          let [x, z] = rp.p; for (let k = 0; k < 20 && (col.isWater(x, z) || col.isWater(x + nx * 1.6, z + nz * 1.6) || col.isWater(x - nx * 1.6, z - nz * 1.6)); k++) { x += nx * 0.5; z += nz * 0.5; }
          if (!col.isWater(x, z)) {
            const P = (s, t, y) => [x + ux * s + nx * t, y, z + uz * s + nz * t], B0 = new RB(), B1 = new RB(), LEN = 9, HW = 1.3;
            for (const [B, q] of [[B0, 0], [B1, 1]]) {
              B.poly('concrete', [P(-LEN / 2, -HW, 0.1), P(LEN / 2, -HW, 0.1), P(LEN / 2, HW, 0.1), P(-LEN / 2, HW, 0.1)], [0, 1, 0]);
              for (const sd of [-1, 1]) B.poly('concrete', [P(-LEN / 2, sd * HW, 0), P(LEN / 2, sd * HW, 0), P(LEN / 2, sd * HW, 0.1), P(-LEN / 2, sd * HW, 0.1)], [nx * sd, 0, nz * sd]);
              if (q === 0) for (let s = -LEN / 2 + 0.6; s < LEN / 2; s += 1.1) B.beam('iron', P(s, -HW + 0.15, 0.2), P(s, HW - 0.15, 0.2), 0.14);
              if (q === 0) { for (const s of [-LEN / 2, 0, LEN / 2]) B.beam('oak', P(s, HW + 0.2, 0), P(s, HW + 0.2, 1.0), 0.09); B.beam('oak', P(-LEN / 2, HW + 0.2, 0.95), P(LEN / 2, HW + 0.2, 0.95), 0.08); B.beam('oak', P(-LEN / 2, HW + 0.2, 0.5), P(LEN / 2, HW + 0.2, 0.5), 0.06); }
            }
            addSite(K, 'nw:rollers', [x, 0.4, z], 7, [80, 180, 0.01], [B0, B1, null], { farArea: 99 });
            for (const s of [-LEN / 2, 0, LEN / 2]) { const p = P(s, HW + 0.2, 0); col.addCircle(p[0], p[2], 0.12); }
            S.rollers = [x, z];
          }
        }
      }
    } catch (e) { console.error('[north_west] build', e); } finally { K.joined(me); }
    game.northWest = { stats: () => ({ rhodes: S.rhodes, said: S.said, nuffield: !!S.nuffield, weir: !!S.weir, rollers: !!S.rollers, styles: Object.keys(STYLE).length }) };
    return { update() { try { K.tick(me); } catch (e) { if (!S.err) { S.err = true; console.error('[north_west]', e); } } } };
  },
};
