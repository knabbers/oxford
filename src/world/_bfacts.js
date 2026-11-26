// Building facts -> the city generator's style keys (see docs/BUILDING_FACTS.md).
// world/_bfacts_data.js is GENERATED (tools/bfacts_build.mjs) from Historic England list descriptions, OpenStreetMap
// tags, LIDAR heights and a small hand table; this file turns one record into the same shape as `game.overrides.style`
// / BUILDING_STYLE, which buildings.js reads. A building that a place module or the tables in buildings.js already
// style by hand never reaches here (chooseStyle asks only when it has no hand style and no landmark entry).
// `?bfacts=0` (GTO_BFACTS=0 in node) turns the table off: the generator's own guesses, for before / after pictures.
import { BFACTS } from './_bfacts_data.js';

export const BFACTS_ON = !((typeof location !== 'undefined' && location && /[?&]bfacts=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_BFACTS === '0'));
export const factOf = (id) => (BFACTS_ON ? BFACTS[id] || null : null);

const WALL = { ash: 'stone', rub: 'stone', st: 'stone', br: 'brick', rn: 'render', tr: 'render', tf: 'timber', cn: 'concrete', gl: 'glass' };
const ROOF = { sl: 'slate', ss: 'stone', ti: 'tile', le: 'lead', cu: 'copper' };
// brick and paint colours the lists name (linear multipliers over the atlas's neutral brick / render)
// (the atlas brick is a red one: a yellow / buff / brown brick needs its green and blue lifted a long way)
const TINT = { br: { red: [0.98, 0.74, 0.66], yel: [1.14, 1.42, 1.28], buf: [1.16, 1.48, 1.4], brn: [0.86, 0.98, 0.98], gry: [0.9, 0.9, 0.9], wht: [1.2, 1.3, 1.3] },
  // paint on stucco, as seen in the named photographs (hand table): white, cream, pink, pale blue, pale green, dark red, grey, yellow, lilac
  rn: { wht: [1.03, 1.02, 1.0], crm: [1.0, 0.97, 0.86], pnk: [1.0, 0.8, 0.78], blu: [0.8, 0.88, 0.98], grn: [0.87, 0.96, 0.88], red: [0.72, 0.42, 0.4], gry: [0.86, 0.88, 0.86], yel: [1.02, 0.94, 0.68], lil: [0.9, 0.86, 0.93] } };
// ashlar as it stands today: cleaned cream to honey (rule A — the generator's own range also has sooty and lichen-grey
// fronts, which the centre's stone fronts no longer are; a named colour or a hand style still wins)
const CLEAN_STONE = [[1.08, 1.06, 1.0], [1.04, 0.97, 0.84], [1.0, 0.91, 0.76], [1.12, 1.1, 1.05], [1.06, 1.0, 0.89], [0.97, 0.88, 0.74], [1.02, 1.0, 0.95], [0.95, 0.93, 0.88]];
const hsh = (id) => { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const cache = new Map();

/**
 * Style keys for map building `id`, or null. o = { college: the building stands inside a college site, shop }.
 * Keys beyond docs/WORLD_API.md "Overrides": bayW (metres per window bay on the street fronts), eaves (wall height),
 * dormers / parapet (true | false: a fact, not the dice), jetty (a plastered timber frame: the upper floors oversail),
 * gables (attic gables to the street) with gableCell, ubay ('u' | 'f' | 'o': a canted bay on the upper floors),
 * rubble (rubble flanks), fact (the record itself).
 */
export function factStyle(id, o = {}) {
  const f = factOf(id);
  if (!f) return null;
  const key = id + (o.college ? 'c' : '');
  if (cache.has(key)) return cache.get(key);
  const st = { fact: f };
  // a college's or a church's own list entry (i): words about a range that only a person can place on the plan — the
  // roof covering and battlements are taken, the rest stays with the generator's design for that college
  const inst = !!f.i;
  if (f.r && ROOF[f.r]) st.roof = ROOF[f.r];
  if (f.cr) st.crenel = true;
  if (!inst) {
    const wall = WALL[f.m], y = f.y || 0;
    if (wall) {
      st.wall = wall;
      if (f.m === 'rub') st.rubble = true;
      if (f.m === 'tr' && (f.jt || (y && y < 1700))) st.jetty = true;
      const tt = TINT[f.m === 'br' ? 'br' : 'rn'];
      if (wall === 'stone' && !o.college) st.tint = CLEAN_STONE[Math.floor(hsh(id + 'cs') * CLEAN_STONE.length)];
      if (wall === 'render' && f.c && tt[f.c]) st.tintFixed = true;   // (a painted colour that was seen: every shop unit of the front keeps it)
      if ((f.m === 'br' || f.m === 'rn' || f.m === 'tr') && f.c && tt[f.c]) { const j = 0.97 + 0.06 * (((id.charCodeAt(id.length - 1) * 7 + id.charCodeAt(id.length - 2)) % 10) / 10); st.tint = tt[f.c].map((v) => v * j); }
      // windows per storey from the window type, the material and the date
      const wt = f.wt, n = f.n || 0;
      if (wall === 'stone') {
        if (wt === 'mul') { st.up = 'stoneTudor'; st.ground = 'stoneTudor'; st.door = 'stoneArchDoor'; }
        else if (wt === 'goth') { st.up = 'collegeGothic'; st.ground = 'collegeGround'; st.door = 'stoneArchDoor'; }
        else if (wt === 'round') { st.up = 'stoneRoundArch'; st.door = 'stoneArchDoor'; }
        else if (wt === 'gsash' || wt === 'sash') {
          st.up = 'stoneSash'; st.ground = f.ru ? 'stoneRustic' : 'stoneSash'; st.door = 'stoneDoor';
          if (n >= 3 && (!y || y < 1880)) { st.first = 'stoneSashTall'; st.top = 'stoneSmall'; }
        } else if (f.ru) st.ground = 'stoneRustic';
      } else if (wall === 'brick') {
        if (f.c === 'poly') st.up = 'brickPoly';
        else if (wt === 'gsash' || (wt === 'sash' && y && y < 1840)) st.up = 'brickGeorgian';
        else if (wt === 'sash') st.up = 'brickSash';
        else if (wt === 'case' || wt === 'mul') st.up = 'brickPair';
        else if (wt === 'blank') st.up = 'brickBlank';
        else if (wt === 'mod') st.up = 'brickStrip';     // (a post-war brick block: strip windows)   // (a modern store's upper wall with next to no windows)
      } else if (wall === 'render') {
        if (wt === 'gsash' || (wt === 'sash' && y && y < 1840)) st.up = 'renderGeorgian';
        else if (wt === 'sash') st.up = 'renderSash';
        else if (wt === 'case' || wt === 'mul') st.up = 'renderSash';   // (a plastered front's casements: the plain stucco window, not the exposed-frame cell)
      }
    }
    if (f.n) st.storeys = f.n;
    if (f.h) st.eaves = f.h;
    if (f.bw) st.bayW = f.bw;
    if (f.rs === 'gab') st.shape = 'gabled'; else if (f.rs === 'hip') st.shape = 'hipped'; else if (f.rs === 'man') { st.shape = 'hidden'; st.dormers = true; st.parapet = false; } else if (f.rs === 'flat') st.shape = 'flat';
    if (f.pp === 1 && f.rs !== 'man') { st.parapet = true; if (!f.rs) st.shape = 'hidden'; if (!f.dm && !f.at) st.dormers = false; }
    else if (f.pp === 0) st.parapet = false;
    if (f.dm || f.at) st.dormers = true;
    if (f.gb) { st.gables = true; st.gableCell = wall === 'stone' ? 'collegeGable' : wall === 'brick' ? 'villaGable' : 'plasterGable'; st.dormers = undefined; if (!f.rs && f.pp !== 1) st.parapet = false; }
    if (f.bay === 'u' || f.bay === 'f' || f.bay === 'o') st.ubay = f.bay;
    if (f.sf) st.sf = f.sf;   // ('no': a front on a shopping street that has no shop — a hotel, a bank's upper door; buildings.js planBuildings)
  }
  for (const k in st) if (st[k] === undefined) delete st[k];
  cache.set(key, st);
  return st;
}
