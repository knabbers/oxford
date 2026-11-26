// Worcester College, the north side (2026-11-22; package E of docs/research/worcester_survey.md).
//
//   Sainsbury Building   (MacCormac Jamieson Prichard, 1982-83; map w69991357) the building itself is drawn by
//                        places/worcester.js through _worcester_ranges.js `buildSainsbury` -> _worcester_sainsbury.js
//                        (in the core's own atlas mesh). THIS module gives it its ground: the stone-flagged lower
//                        terrace at the water with its planted beds in place of the map's "garden", the mapped ways
//                        led round what now stands on them, two trees, and it keeps the building's records
//                        (CHECKED, ATTR, TEMPORARY, the levels for the terrain).
//
// SOURCES (looked at, never copied or used as textures; local `reference/worcester/`): `14 sainsbury building`,
// `35 lake bridges and island`, the owner's Nash Quad photograph, satellite picture S3, the 2022 height survey.
// `?wsb=0` (node: GTO_WSB=0) turns the Sainsbury pass off for before / after pictures.
import { SAINSBURY, SB_REBUILT, SB_ATTR, SB_TEMPORARY, SB_LEVELS, SB_LV, sbPt } from './_worcester_sainsbury.js';
import { NASHQ_ON } from './_worcester_ranges.js';

const SB_ON = SB_REBUILT && NASHQ_ON;
/** one row a building, the form of worcester_streets.js: [id, K | G, what] (K: its main fronts are from named pictures) */
export const CHECKED = [
  [SAINSBURY.id, 'K', 'Sainsbury Building: tiers, roofs, terraces, common room, flights and lake front from photographs, satellite picture S3 and the 2022 height survey; the east front from the owner\'s Nash Quad photograph; window places, the north side and the stair link\'s place a guess'],
];
export const ATTR = { [SAINSBURY.id]: SB_ATTR };
export const TEMPORARY = [...SB_TEMPORARY];
export { SB_LEVELS };

const W = (a, b) => { const p = sbPt(a, b); return [+p[0].toFixed(2), +p[1].toFixed(2)]; };
// ---- ground: ordinary map areas (the city's ground draws them; no rough grass grows through). The flags run from
// the mapped lake edge to the building, under the common room and the flights as well.
const AREAS = (() => {
  const A = [], add = (kind, ring, o = {}) => A.push({ id: 'worc:sainsbury:' + A.length, kind, poly: ring.map(([a, b]) => W(a, b)), ...o });
  add('paved', [[0.6, 15.9], [1.2, 30.9], [1.2, 32.6], [4.3, 32.5], [17.1, 32.1], [20.5, 31.86], [20.5, 24.0], [17.5, 24.0], [17.5, 15.1], [10.1, 15.1], [10.1, 11.1], [0.0, 11.1]], { surface: 'paving_stones' });
  add('flowerbed', [[0.9, 12.0], [5.6, 12.0], [5.6, 15.4], [4.2, 23.6], [1.4, 23.8]]);                 // the bank by the west flight (K: planted; G: its outline)
  add('flowerbed', [[1.6, 25.6], [3.0, 25.6], [3.0, 32.1], [1.6, 32.2]]);                               // the south-west corner
  add('flowerbed', [[5.8, 29.6], [10.4, 29.4], [10.4, 31.9], [5.8, 32.0]]);                             // by the water, east of the island bridge's foot
  add('flowerbed', [[17.95, 24.3], [20.3, 24.3], [20.3, 31.3], [17.95, 31.5]]);                         // between the south flight and the wing
  return A;
})();
// mapped ground and footways the above replaces (the ways stay in the walk graph), and the ways led round the low
// block east of the terrace and down the south flight
const SKIP = ['w1480325738', 'w169617915', 'w169617903', 'w1480325740', 'w1480325739'];
const REROUTE = [
  ['w1480325740', () => [W(18.4, 18.5), W(16.7, 20.2), W(16.7, 24.0)]],
  ['w1480325739', (p) => [W(16.7, 24.0), W(16.7, 28.2), W(16.4, 30.9), W(4.3, 30.9), p[p.length - 1]]],
];
// K: a big tree at the terrace's south edge and a small one by the south wing (height survey, S3); G: their kinds
const TREES = [[...W(6.6, 31.0), 15, 'broad'], [...W(19.2, 30.2), 7, 'broad']];

export default {
  id: 'worcester_north',
  site: { x: -378, z: -106, r: 40 },      // (for the crop switch, core/_crop.js: the Sainsbury Building and its terraces)
  preMap(game) {
    if (!SB_ON) return;
    try {
      const ov = game.overrides, map = game.map;
      for (const id of SKIP) ov.skip.add(id);
      if (map && map.areas) for (const a of AREAS) map.areas.push({ ...a, poly: a.poly.map((p) => p.slice()) });
      if (map && map.trees) for (const t of TREES) map.trees.push(t.slice());
      for (const [id, fn] of REROUTE) { const r = map && map.roads && map.roads.find((x) => x.id === id); if (r && r.pts) r.pts = fn(r.pts.map((q) => q.slice())); }
    } catch (e) { console.error('[worcester_north] preMap', e); }
  },
  install(game) {
    if (!SB_ON) return null;
    const world = game.world;
    // generated trees and furniture that would stand on the terraces go (the two trees above are kept)
    if (world.clearArea) {
      const R = (ring) => { try { world.clearArea(ring.map(([a, b]) => W(a, b))); } catch (e) { /* */ } };
      R([[8.0, 11.2], [20.4, 11.2], [20.4, 28.6], [8.0, 28.6]]); R([[0.8, 11.3], [8.0, 11.3], [8.0, 29.8], [0.8, 29.8]]); R([[8.0, 28.6], [18.0, 28.6], [18.0, 31.8], [8.0, 31.8]]);
    }
    game.worcesterNorth = { on: true, checked: CHECKED, attr: ATTR, temporary: TEMPORARY, levels: SB_LEVELS, lv: SB_LV };
    console.log('[gto] worcester_north: the Sainsbury Building\'s terraces and ground');
    return null;
  },
};
