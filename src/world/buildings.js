// Buildings: footprints (with holes, minH, parts) extruded into the facade atlas. Each wall is planned as house / shop /
// townhouse units with storey bands (ground floor, piano nobile, attic), then roofed: gabled / hipped from the oriented
// bounding box, a hipped "crown" roof (footprint inset) for irregular plans, domes and cones. Parapets, battlements,
// chimney stacks with pots, dormers, landmark heights, shop fascia signs and street-name plaques.
// Graphics pass 6: party walls are not drawn; street fronts carry a generator for their depth (recessed windows, doors
// and shop windows, cornices, sills, hoods, gutters), built near the camera by TileBatcher.refreshDyn from the pieces in
// facadedetail.js; bay windows, eaves gables, awnings, hanging signs and buttresses are static extras paid for by the
// triangles saved in the same tile (see docs/WORLD_API.md "Facade depth").
import * as THREE from 'three';
import { FACADE_CELLS as F, ROOF_CELLS as RC, ROOF_SCALE as RS, ROOF_OFS, PARAPET_CELL, HEDGE_CELL, makeSignAtlas, SIGN_COLS, SIGN_ROWS } from './textures.js';
import { GeoBuf, cleanRing, signedArea, polyCentroid, polyBounds, obb, pointInPoly, distToSeg, hash01, hashStr, wallQuad, flatPoly, orientedBox, SpatialGrid } from './util.js';
import { LANDMARKS, LANDMARK_SKIP, ROOFSCAPE } from './landmarks.js';
import { registerNight, NIGHT_WINDOWS, LIT_CLASS } from './materials.js';
import { inventedNames } from '../core/features.js';
import { WIN, recessBay, slab, bayWindow, bayTop, bayUnder, awning, hangingSign, gabletFront, gabletRoof, buttress } from './facadedetail.js';
import { WALKIN_BAYS } from './walkin_bays.js';
import { factStyle, factOf, BFACTS_ON } from './_bfacts.js';
import { terrainStandY } from './terrain.js';

// wall styles: cells for upper floors / ground floor, alternate cell + probability, bay width & storey height (m)
export const WALL_STYLES = {
  stone: { up: F.stoneSash, upAlt: F.stoneBlank, upP: 0.07, gr: F.stoneSash, grAlt: F.stoneDoor, grP: 0.12, blank: F.stoneBlank, bay: 3.2, storey: 3.6 },
  college: { up: F.stoneTudor, upAlt: F.stoneBlank, upP: 0.12, gr: F.collegeGround, grAlt: F.stoneArchDoor, grP: 0.08, blank: F.stoneBlank, bay: 3.3, storey: 3.4 },
  gothic: { up: F.stoneGothic, upAlt: F.stoneBlank, upP: 0.12, gr: F.stoneGothic, grAlt: F.stoneGothic, grP: 0, blank: F.stoneBlank, bay: 4.0, storey: 10, single: true },
  brick: { up: F.brickSash, upAlt: F.brickBlank, upP: 0.05, gr: F.brickSash, grAlt: F.brickDoor, grP: 0.32, blank: F.brickBlank, bay: 2.7, storey: 2.9 },
  render: { up: F.renderSash, upAlt: F.renderBlank, upP: 0.05, gr: F.renderSash, grAlt: F.renderDoor, grP: 0.25, blank: F.renderBlank, bay: 2.9, storey: 3.2 },
  timber: { up: F.timberUp, upAlt: F.renderSash, upP: 0.15, gr: F.renderSash, grAlt: F.renderDoor, grP: 0.25, blank: F.renderBlank, bay: 2.6, storey: 2.9 },
  glass: { up: F.glass, upAlt: F.glass, upP: 0, gr: F.glass, grAlt: F.glass, grP: 0, blank: F.concreteBlank, bay: 2.0, storey: 3.6 },
  concrete: { up: F.concreteBand, upAlt: F.concreteBlank, upP: 0.06, gr: F.glass, grAlt: F.concreteBand, grP: 0.3, blank: F.concreteBlank, bay: 3.0, storey: 3.4 },
};
const TINTS = {
  // stone pass (2026-11, photo comparison item 3): the real range, over the neutral buff base (textures.js STONE):
  // pale cream (Clipsham, Bath, Portland; cleaned), honey (Headington freestone), warm ochre, grey-buff and grey
  // (weathered), soot-darkened (anything facing a busy road since the 19th century), a greenish lichen grey.
  // Roughly a third honey / ochre, a third cream / pale, a third grey to sooty.
  stone: [[1.08, 1.06, 1.0], [1.04, 0.97, 0.84], [0.93, 0.92, 0.89], [1.0, 0.91, 0.76], [0.82, 0.81, 0.79], [1.12, 1.1, 1.05], [0.68, 0.66, 0.63],
    [1.06, 1.0, 0.89], [0.97, 0.88, 0.74], [0.88, 0.89, 0.86], [1.02, 1.0, 0.95], [0.76, 0.74, 0.7]],
  brickRed: [[1.0, 0.78, 0.72], [0.86, 0.62, 0.56], [1.05, 0.82, 0.7], [0.92, 0.72, 0.66], [1.08, 0.72, 0.6], [0.8, 0.6, 0.56]],
  brickYellow: [[1.12, 1.22, 1.08], [1.05, 1.1, 1.0], [0.98, 0.98, 0.92], [1.16, 1.2, 0.98]],
  render: [[1.0, 0.97, 0.88], [1.02, 1.02, 1.0], [0.84, 0.92, 1.0], [1.0, 0.86, 0.84], [1.02, 0.94, 0.72], [0.86, 0.94, 0.82], [0.92, 0.92, 0.9], [1.0, 0.82, 0.7], [0.96, 0.9, 0.8], [1.03, 1.0, 0.94]],
  concrete: [[1, 1, 1], [0.96, 0.94, 0.9], [0.9, 0.9, 0.92]],
  glass: [[1, 1, 1]],
};
const HOUSE = new Set(['house', 'terrace', 'semidetached_house', 'detached', 'residential', 'bungalow', 'garage', 'garages', 'shed', 'hut', 'barn', 'cabin', 'boathouse', 'pavilion', 'stable', 'farm_auxiliary', 'cottage', 'kiosk', 'toilets', 'service']);
const DWELLING = new Set(['house', 'terrace', 'semidetached_house', 'detached', 'residential', 'bungalow', 'cottage']);
const CHURCH = new Set(['church', 'chapel', 'cathedral']);
const STONE_TYPES = new Set(['university', 'college', 'church', 'chapel', 'cathedral', 'castle', 'library', 'museum', 'public', 'civic', 'government', 'gate', 'tower', 'university accommodation', 'dormitory', 'school', 'hotel']);
const SHOPPING = new Set(['Cornmarket Street', 'Queen Street', 'High Street', 'George Street', 'Magdalen Street', "St Aldate's", 'Broad Street', 'Turl Street', 'Market Street', 'Little Clarendon Street', 'Walton Street', 'Cowley Road', 'St Clements Street', "St Clement's Street", 'Park End Street', 'New Inn Hall Street', 'Ship Street', 'Gloucester Green', 'Westgate', 'Golden Cross', 'Covered Market']);
// Georgian ashlar terraces (known): Beaumont Street and St John Street (1820s-30s Bath-stone fronts), much of St Giles'
const GEORGIAN_STREETS = new Set(['Beaumont Street', 'St John Street', "St Giles'", 'Holywell Street', 'Merton Street', 'Longwall Street', 'New College Lane', 'Pembroke Street', 'Brewer Street', 'Ship Street', 'Wellington Square']);
const SIGN_AMENITY = new Set(['pub', 'bar', 'restaurant', 'cafe', 'fast_food', 'bank', 'pharmacy', 'cinema', 'theatre', 'nightclub', 'ice_cream', 'post_office', 'bureau_de_change', 'biergarten', 'hotel', 'casino', 'dentist', 'clinic', 'doctors', 'veterinary', 'library']);
const SHOP_AMENITY = new Set(['pub', 'bar', 'restaurant', 'cafe', 'fast_food', 'bank', 'pharmacy', 'ice_cream', 'post_office', 'bureau_de_change', 'nightclub']);

// graphics pass 5: a college is ONE design, not a lottery per footprint: every range inside a college's site takes the
// same wall style, window type, battlements and stone, so a street front such as Balliol's on Broad Street is
// consistently Gothic. KNOWN exceptions to "collegiate Gothic / Tudor": classical ashlar (Queen's, Worcester, Hertford,
// St Peter's, Somerville) and red brick (Lady Margaret Hall, St Hugh's, Wycliffe; Keble is handled by inKeble).
// The post-war colleges keep the per-building mix (concrete / glass / brick).
const COLLEGE_WALL = [[/Queen's|Worcester|Hertford|St Peter|Somerville|Regent/, 'stone'], [/Lady Margaret|St Hugh|Wycliffe|St Stephen/, 'brick'], [/St Catherine|St Anne|Wolfson|St Antony|Linacre|Kellogg|Green Templeton|St Cross|Cohen/, null]];
// Georgian terraces that are three full storeys over a basement (KNOWN: Beaumont Street and St John Street, 1820s-30s;
// Wellington Square, 1870s). The map's heights for them are per-block defaults that plan out as one storey under a big roof.
const TALL_TERRACES = new Set(['Beaumont Street', 'St John Street', 'Wellington Square']);
/**
 * Graphics pass 7: style data for named buildings the heuristics get wrong, keyed by map id — the same shape as
 * `game.overrides.style` (which wins when a place module sets one), plus world-only fields: tint [r,g,b] (linear
 * multiplier), up / first / top / ground / door (FACADE cell names), storeys, shape (roof shape).
 * Worcester College's modern and garden-side buildings (the place modules hand-build the old college only):
 */
export const BUILDING_STYLE = {
  // Sainsbury Building (1983, by the lake): pale buff brick, paired casements, lead-covered pitched roofs (known in
  // outline; the cells are the nearest the atlas has)
  w69991357: { wall: 'brick', tint: [1.5, 2.45, 2.75], ivy: false, roof: 'lead', up: 'brickPair', ground: 'brickPair', door: 'brickDoor', shape: 'crown' },
  // Provost's Lodgings (18th-century classical house on the garden side): rusticated ground floor, tall first floor,
  // attic storey, hipped slate roof behind a parapet (storey count is a guess)
  w169617900: { wall: 'stone', tint: [1.07, 1.03, 0.94], ivy: false, roof: 'slate', ground: 'stoneRustic', first: 'stoneSashTall', top: 'stoneSmall', door: 'stoneDoor', storeys: 3 },
  // Nash Building and Besse Building (20th-century neo-Georgian stone ranges; details are guesses): plain sashes, slate roofs
  w69991299: { wall: 'stone', tint: [1.0, 0.97, 0.9], roof: 'slate', up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor' },
  w93711480: { wall: 'stone', tint: [1.03, 1.0, 0.92], roof: 'slate', up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor' },
};
/**
 * Roofscape / college-front pass (2026-11, photo comparison items 2, 4 and 13): `?roofs=0` (or GTO_ROOFS=0 in node)
 * turns the whole pass off — the old roof shapes, stacks, dormers, roof colours and the generic college fronts — for
 * before / after screenshots and frame-time comparisons from identical cameras.
 */
export { ROOFSCAPE };   // defined in landmarks.js (which this module imports) so the landmark table can use it too
const ROOF_STYLE = {
  // ---- roofscape / college-front pass (2026-11, photo comparison items 2 and 13). Extra keys (world-only): gables
  // (attic gables with a two-light window over every other bay of the fronts), crenel (true / false: battlements),
  // parapet (false: open eaves), gate (a gateway in the middle of the street front with an oriel over it), stacks
  // ('tall': college chimneys). Photographs: /private/tmp/audit/refpics (not in the repository).
  // All Souls: the Codrington Library's walls are tall traceried Perpendicular windows between buttresses under
  // battlements (radcam); the cloister screen on Radcliffe Square is a blank battlemented wall (stmary)
  w62118518: { wall: 'gothic', roof: 'lead', crenel: true },
  w301650408: { up: 'stoneBlank', ground: 'stoneBlank', door: 'stoneBlank', first: 'stoneBlank', crenel: true, ivy: false },
  // Brasenose on Radcliffe Square (brasenose): the chapel's gable end to the square with its great window, a steep
  // slate roof; the library range north of it (two storeys: the blocked cloister below, tall round-headed lights above,
  // a hipped slate roof). Which mapped footprint is the library is a GUESS from the plan (w293724016, "Staircase 7/VII").
  w60929921: { wall: 'gothic', roof: 'slate', shape: 'gabled' },
  w293724016: { wall: 'college', storeys: 2, ground: 'collegeTwo', door: 'stoneArchDoor', up: 'stoneRoundArch', roof: 'slate', shape: 'hipped', crenel: false, parapet: false, ivy: false },
  // Exeter's Turl Street gate (blackwells): battlemented, an oriel over the gateway
  w227761181: { wall: 'college', ground: 'collegeGround', up: 'collegeGothic', roof: 'slate', crenel: true, gate: true },
  // the Radcliffe Science Library's Jackson wing (rsl, 1901): giant round-arched windows between piers, slate roof
  r12557656: { wall: 'stone', storeys: 2, ground: 'stoneRoundArch', up: 'stoneRoundArch', door: 'stoneArchDoor', roof: 'slate', crenel: false, ivy: false },
};
// Christ Church's Meadow Building (Deane & Woodward, 1862-66; meadow_bldg): Venetian Gothic paired pointed lights,
// gabled dormers, slate roofs (the mapped building:parts; the gate tower keeps its own outline)
for (const id of ['w931938835', 'w931938836', 'w931938837', 'w931938838', 'w931938839', 'w931938842', 'w931938843', 'w931938844', 'w931938845', 'w931938846', 'w931938847', 'w931938848'])
  ROOF_STYLE[id] = { wall: 'college', up: 'venetianPair', ground: 'collegeGround', top: 'collegeTwo', roof: 'slate', gables: true, crenel: false, parapet: false, stacks: 'tall' };
// The named colleges' street fronts as ONE design each (every building inside the college's site; per-building
// entries above and game.overrides.style still win). KNOWN from the photographs: Brasenose's Old Quad has a row of
// gabled attics (the 1605 cocklofts) and tall stacks; St John's St Giles' ranges are gabled with oriels and tall
// chimneys; Balliol's Broad Street front (Waterhouse, 1867-68) is Gothic with gables; Exeter's Turl Street front is
// battlemented Gothic with an oriel over the gate. GUESSED: the window type per storey, Hertford's balustraded
// Jacobean-style fronts (Jackson), which ranges away from the streets share the design.
const COLLEGE_FRONT = [
  [/Brasenose/, { wall: 'college', ground: 'collegeGround', first: 'collegeTwo', up: 'collegeTwo', roof: 'stone', gables: true, crenel: false, parapet: false, stacks: 'tall' }],
  [/St John's/, { wall: 'college', ground: 'collegeGround', first: 'collegeWide', up: 'collegeTwo', roof: 'stone', gables: true, crenel: false, parapet: false, stacks: 'tall' }],
  [/Balliol/, { wall: 'college', ground: 'collegeGround', up: 'collegeGothic', top: 'collegeTwo', roof: 'slate', gables: true, crenel: false, parapet: false, stacks: 'tall' }],
  [/Exeter/, { wall: 'college', ground: 'collegeGround', up: 'collegeGothic', roof: 'slate', crenel: true, gate: true }],
  [/Hertford/, { wall: 'college', ground: 'collegeGround', first: 'collegeWide', up: 'collegeTwo', roof: 'slate', crenel: false }],
  [/University College/, { wall: 'college', ground: 'collegeGround', up: 'collegeTwo', roof: 'stone', gables: true, crenel: false, parapet: false, stacks: 'tall' }],
];
/** pass "roofscape": does a building look older than about 1900 (pitched roofs, chimneys)? Modern walls and the big
 *  commercial / flat blocks away from the centre do not. */
const MODERN_BT = new Set(['office', 'commercial', 'retail', 'industrial', 'hospital', 'warehouse', 'supermarket', 'apartments', 'hotel', 'school', 'parking', 'service', 'transportation']);
function oldLooking(sty, area) {
  if (!ROOFSCAPE) return false;
  if (sty.wall === 'glass' || sty.wall === 'concrete') return false;
  if (MODERN_BT.has(sty.bt) && sty.zone !== 'centre' && (area > 450 || sty.bt !== 'apartments')) return false;
  if (sty.college && sty.colName && COLLEGE_WALL.some((q) => q[1] === null && q[0].test(sty.colName))) return false;
  return true;
}
/**
 * Houses pass (2026-11, photo comparison item 17): `?houses=0` (GTO_HOUSES=0 in node) turns it off. Jericho, East
 * Oxford, Osney and Grandpont terraces are two low storeys (eaves 5.5-6 m) of brick or painted render, a door and a window
 * per bay, some painted house by house, some with a ground-floor bay; North Oxford's villas (style key `villa`, set by
 * places/_d2_north.js) are tall, steep-roofed, with a gable to the street over a two-storey bay window and a porch.
 */
export const HOUSES = !((typeof location !== 'undefined' && location && /[?&]houses=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_HOUSES === '0'));
const TERRACE_ZONES = new Set(['jericho', 'east', 'west', 'south']);
const RESI_ROAD = new Set(['residential', 'living_street', 'unclassified', 'service']);
/** a brick cell's painted (render) equivalent: a house painted over its brick in a brick terrace */
const PAINTED = { [F.brickDoor]: F.renderDoor, [F.brickBlank]: F.renderBlank };
const painted = (c) => PAINTED[c] ?? (c === F.brickSash || c === F.brickGeorgian || c === F.brickPoly || c === F.brickPair ? F.renderSash : c);
const pick = (arr, h) => arr[Math.floor(h * arr.length) % arr.length];
const parseColour = (s) => { if (!s) return null; try { const c = new THREE.Color(s); return [c.r * 1.25, c.g * 1.25, c.b * 1.25]; } catch (e) { return null; } };

/** Decide wall/roof style for a map building. */
export function chooseStyle(ctx, b, info) {
  const t = b.tags || {}, bt = t.building || 'yes', hv = hash01(b.id), hv2 = hash01(b.id + 'x');
  const lm = LANDMARKS[b.id] || {};
  const zone = ctx.zoneAt(b.c[0], b.c[1]);
  const name = t.osmName || t.name || '';   // style keys off the map's own name (world/tradenames.js keeps it as osmName)
  const street = t['addr:street'] || info.street || '';
  const shopping = SHOPPING.has(street) || info.shop;
  const college = ctx.inCollege(b.c[0], b.c[1]);
  const colName = college && ctx.collegeAt ? ctx.collegeAt(b.c[0], b.c[1]) : '';
  let ch = hv, colTint = null;      // ch: the style hash — shared by the whole college when the building is in one
  // roofscape / college-front pass: a named college's front design under the building's own style entry (not for
  // chapels, towers and the landmark table's buildings)
  let st = ctx.ov.style.get(b.id) || BUILDING_STYLE[b.id] || null;
  if (ROOFSCAPE && ROOF_STYLE[b.id]) st = { ...ROOF_STYLE[b.id], ...(st || {}) };   // a place module's own entry still wins key by key
  const front = ROOFSCAPE && colName && !LANDMARKS[b.id] && !(CHURCH.has(bt) || t.amenity === 'place_of_worship' || /\b(Chapel|Church|Cathedral|Tower|Gate|Lodge)\b/.test(name)) ? COLLEGE_FRONT.find((q) => q[0].test(colName)) : null;
  if (front) { st = { ...front[1], ...(st || {}) }; ch = hash01('c7:' + colName); colTint = hash01('stone:' + colName); }
  // building facts (world/_bfacts.js, docs/BUILDING_FACTS.md): listing / map / LIDAR facts for a building nothing styles by hand
  if (!st && info.city && !LANDMARKS[b.id] && !b.part) { st = factStyle(b.id, { college }); if (st && st.eaves && ctx.ov.heights.has(b.id)) st = { ...st, eaves: undefined }; }
  st = st || {};
  let wall = st.wall || lm.wall;
  if (!wall) {
    const mat = t['building:material'];
    if (mat === 'stone' || mat === 'limestone' || mat === 'sandstone') wall = 'stone';
    else if (mat === 'brick') wall = 'brick';
    else if (mat === 'plaster' || mat === 'render') wall = 'render';
    else if (mat === 'concrete' || mat === 'prefabricated') wall = 'concrete';
    else if (mat === 'glass') wall = 'glass';
    else if (mat === 'timber_framing' || mat === 'wood') wall = 'timber';
  }
  const churchy = CHURCH.has(bt) || t.amenity === 'place_of_worship' || /\b(Chapel|Church|Cathedral)\b/.test(name);
  if (!wall) {
    const collegeName = /College|Quad|Staircase|Hall|Library|Lodge|Tower|Gate|Bodleian|Divinity|Schools|Cloister/.test(name);
    const area = info.area;
    if (churchy) wall = 'gothic';
    else if (ctx.inKeble(b.c[0], b.c[1])) wall = 'brick';
    else if (bt === 'university' || bt === 'college' || collegeName || (t.osmOperator || t.operator) === 'University of Oxford' || college) {
      if (college && colName) {
        const rule = COLLEGE_WALL.find((q) => q[0].test(colName));
        if (rule && rule[1] === null) wall = area > 900 ? (hv < 0.45 ? 'concrete' : hv < 0.7 ? 'glass' : 'brick') : hv < 0.5 ? 'stone' : 'brick';
        else { wall = rule ? rule[1] : 'college'; ch = hash01('c7:' + colName); /* salt chosen so no measured view gains a battlement tile */ colTint = hash01('stone:' + colName); }
      } else if (college) wall = hv < 0.8 ? 'college' : 'stone';
      else if (zone === 'centre') wall = area > 2500 && hv < 0.2 ? 'stone' : hv < 0.55 ? 'college' : 'stone';
      else wall = area > 900 ? (hv < 0.45 ? 'concrete' : hv < 0.7 ? 'glass' : 'brick') : hv < 0.5 ? 'stone' : 'brick';
    } else if (GEORGIAN_STREETS.has(street) && zone !== 'north' && !(info.shop && hv < 0.3)) wall = street === 'Wellington Square' ? (hv < 0.5 ? 'brick' : 'render') : hv < 0.78 ? 'stone' : 'render';
    else if (HOUSE.has(bt)) {
      if (zone === 'centre') wall = hv < 0.4 ? 'render' : hv < 0.7 ? 'stone' : 'brick';
      // (houses pass: Jericho's and East Oxford's terraces are painted render nearly as often as bare brick)
      else wall = hv < (HOUSES && zone === 'jericho' ? 0.6 : HOUSES && zone === 'east' ? 0.68 : 0.78) ? 'brick' : 'render';
    } else if (shopping && zone === 'centre') {
      wall = street === 'High Street' ? (hv < 0.5 ? 'stone' : hv < 0.92 ? 'render' : 'timber') : street === 'Broad Street' ? (hv < 0.35 ? 'stone' : 'render')
        : street === 'Cornmarket Street' ? (hv < 0.4 ? 'render' : hv < 0.65 ? 'stone' : hv < 0.9 ? 'brick' : 'timber') : hv < 0.5 ? 'render' : hv < 0.8 ? 'stone' : 'brick';
    } else if (bt === 'apartments' || bt === 'office' || bt === 'commercial' || bt === 'retail' || bt === 'industrial' || bt === 'hospital') {
      if (bt === 'apartments') wall = zone === 'centre' ? (hv < 0.5 ? 'stone' : 'render') : hv < 0.7 ? 'brick' : hv < 0.88 ? 'render' : 'concrete';   // flats outside the centre are overwhelmingly brick
      else wall = area > 600 && zone !== 'centre' ? (hv < 0.6 ? 'concrete' : 'glass') : zone === 'centre' ? (hv < 0.5 ? 'stone' : 'render') : hv < 0.7 ? 'brick' : 'concrete';
    } else if (STONE_TYPES.has(bt)) wall = zone === 'centre' ? 'stone' : hv < 0.5 ? 'stone' : 'brick';
    else if (zone === 'centre') wall = hv < 0.45 ? 'stone' : hv < 0.8 ? 'render' : 'brick';
    else wall = hv < 0.75 ? 'brick' : 'render';
  }
  if (!WALL_STYLES[wall]) wall = 'stone';
  // tint: palette choice + a little continuous jitter so no two neighbours match exactly
  let tint = (st.tint ? st.tint.slice() : null) || parseColour(st.color) || (t['building:colour'] && !/cc9933/i.test(t['building:colour']) ? parseColour(t['building:colour']) : null);
  if (!tint) {
    if (wall === 'stone' || wall === 'college' || wall === 'gothic') tint = pick(TINTS.stone, colTint ?? hv2);
    else if (wall === 'brick') tint = (zone === 'north' && hv2 < 0.55) || hv2 < 0.18 ? pick(TINTS.brickYellow, hv2 * 7) : pick(TINTS.brickRed, hv2 * 5);
    else if (wall === 'render' || wall === 'timber') tint = wall === 'timber' ? [1.02, 1.0, 0.94] : pick(TINTS.render, hv2);
    else tint = pick(TINTS[wall] || TINTS.concrete, hv2);
    const j = 0.96 + 0.08 * hash01(b.id + 'j');
    tint = [tint[0] * j, tint[1] * j, tint[2] * (j - 0.01)];
  }
  // roof material
  let roof = st.roof || lm.roofMat;
  const rm = t['roof:material'], rcol = t['roof:colour'];
  if (!roof) {
    if (rm === 'copper' || (rcol && /6EBE9F|green/i.test(rcol))) roof = 'copper';
    else if (rm === 'metal' || rm === 'lead') roof = 'lead';
    else if (rm === 'roof_tiles' || rm === 'tile') roof = 'tile';
    else if (rm === 'slate') roof = 'slate';
    else if (wall === 'glass' || wall === 'concrete') roof = 'flat';
    else if (wall === 'college' || (wall === 'gothic' && hv2 < 0.5)) roof = hv2 < 0.62 ? 'stone' : hv2 < 0.85 ? 'slate' : 'lead';   // Cotswold stone slates on the old ranges
    else if (wall === 'stone') roof = hv2 < 0.22 ? 'stone' : hv2 < 0.86 ? 'slate' : 'tile';
    else if (wall === 'brick') roof = zone === 'north' ? (hv2 < 0.45 ? 'slate' : 'tile') : hv2 < 0.78 ? 'slate' : 'tile';
    else if (wall === 'render' || wall === 'timber') roof = hv2 < 0.5 ? 'tile' : hv2 < 0.9 ? 'slate' : 'stone';
    else roof = 'slate';
  }
  const dwelling = DWELLING.has(bt);
  return { wall, tint, roof, churchy, shopping, zone, street, college, colName, house: HOUSE.has(bt), dwelling, bt, st, lm, hv, hv2, ch };
}

function roofCellTint(roof, flatRoof, hv = 0.5) {
  const j = 0.9 + 0.2 * hv;
  switch (roof) {
    case 'tile': return [RC.tile, [j, j * 0.98, j * 0.96]];
    case 'lead': return [RC.lead, [1, 1, 1]];
    case 'copper': return [RC.lead, [0.5, 0.95, 0.78]];
    case 'flat': return [RC.flat, [1, 1, 1]];
    // roofscape pass (photo comparison item 4): slate and stone slate a shade darker, as the photographs from St Mary's tower
    case 'stone': return flatRoof ? [RC.lead, [0.95, 0.96, 1]] : [RC.stone, ROOFSCAPE ? [j * 0.76, j * 0.74, j * 0.7] : [j, j, j * 0.97]];
    default: return flatRoof ? [RC.lead, [0.95, 0.96, 1]] : [RC.slate, ROOFSCAPE ? [j * 0.8, j * 0.81, j * 0.85] : [j, j, j * 1.02]];
  }
}

/** Choose roof shape. 'crown' = hipped slopes all round a footprint of any shape, flat lead top (the usual city-block roof). */
function chooseShape(b, sty, o, area, verts, pass = true) {
  const t = b.tags || {};
  let shape = sty.st.shape || sty.lm.roof || t['roof:shape'];
  if (sty.st.roof === 'flat') return 'flat';
  const map = { gabled: 'gabled', hipped: 'hipped', 'half-hipped': 'hipped', gambrel: 'gabled', mansard: 'hipped', pyramidal: 'pyramidal', dome: 'dome', cone: 'cone', onion: 'onion', round: 'dome', flat: 'flat', skillion: 'flat', many: 'flat', none: 'flat', flat_cone: 'cone', hidden: 'crown' /* facts: a roof behind a parapet / a mansard */ };
  if (shape) return map[shape] || 'flat';
  if (sty.bt === 'roof') return 'canopy';
  if (sty.wall === 'glass' || sty.wall === 'concrete') return 'flat';
  if (t.man_made === 'tower' || /Tower/.test(t.osmName || t.name || '') || (b.part && (b.minH || 0) > 0)) return 'flat';
  if (sty.bt === 'greenhouse' || sty.bt === 'grandstand' || sty.bt === 'train_station') return 'flat';
  const simple = sty.house ? verts <= 8 && o.rect > 0.8 : verts <= 6 && o.rect > 0.88;
  // roofscape pass (2026-11, photo comparison item 4): from St Mary's tower the real roofs are pitched slate and stone
  // slate. An old-looking range up to 17 m deep on a near-rectangular plan is gabled (hipped on some classical blocks
  // and on squarish plans) whatever its length; battlemented college ranges and deep or irregular blocks keep the
  // crown (now steeper, see planBuilding), which reads as a pitched roof with a small lead flat.
  const old = oldLooking(sty, area), battled = sty.st.crenel === true || (sty.wall === 'college' && sty.ch < 0.5 && sty.st.crenel !== false);
  if (pass && old && !battled && !sty.churchy && sty.bt !== 'garage' && sty.bt !== 'garages' && verts <= 8 && o.rect > 0.82 && o.hw * 2 <= 17 && o.hw * 2 >= 3.2 && area > 40) {
    if (o.hl < o.hw * 1.2) return sty.hv < 0.75 ? 'hipped' : 'gabled';
    if (sty.wall === 'stone' && !sty.house && sty.st.gables !== true) return sty.hv < 0.45 ? 'hipped' : 'gabled';
    return sty.house && sty.zone === 'north' && o.hl < o.hw * 1.6 && sty.hv < 0.45 ? 'hipped' : 'gabled';
  }
  if (!simple || o.hw * 2 > 17 || area >= 900) return area > 40 ? 'crown' : 'flat';
  if (sty.churchy) return 'gabled';
  if (sty.house) return sty.zone === 'north' && o.hl < o.hw * 1.6 && sty.hv < 0.45 ? 'hipped' : 'gabled';
  if (sty.wall === 'college' || sty.wall === 'stone') return o.hw * 2 <= 13 && sty.hv < 0.5 ? 'gabled' : 'crown';
  if (area < 260) return sty.hv < 0.7 ? 'gabled' : 'crown';
  return sty.hv < 0.4 ? 'gabled' : 'crown';
}

/**
 * Ring moved sideways by d (positive = towards the inside of the ring), mitred. Returns null when the result folds
 * over itself (an edge reverses) or collapses, so callers can fall back to a smaller distance / a flat roof.
 */
export function insetRing(poly, d) {
  const n = poly.length, sg = signedArea(poly) > 0 ? 1 : -1, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n], p = poly[i], c = poly[(i + 1) % n];
    let d1x = p[0] - a[0], d1z = p[1] - a[1], d2x = c[0] - p[0], d2z = c[1] - p[1];
    const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1; d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
    // inward normal of an edge (dx,dz) on a ring with winding sign sg: (-dz, dx) * sg
    let mx = (-d1z - d2z) * sg, mz = (d1x + d2x) * sg; const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) { mx = -d1z * sg; mz = d1x * sg; } else { mx /= ml; mz /= ml; }
    const cos = Math.max(0.42, mx * (-d1z * sg) + mz * (d1x * sg));
    out[i] = [p[0] + (mx * d) / cos, p[1] + (mz * d) / cos];
  }
  for (let i = 0; i < n; i++) {
    const a = poly[i], c = poly[(i + 1) % n], q = out[i], r = out[(i + 1) % n];
    if ((c[0] - a[0]) * (r[0] - q[0]) + (c[1] - a[1]) * (r[1] - q[1]) <= 0) return null;
  }
  const A0 = signedArea(poly), A1 = signedArea(out);
  if (A0 * A1 <= 0 || (d > 0 && Math.abs(A1) < Math.abs(A0) * 0.12)) return null;
  return out;
}

/** True if no two non-adjacent edges of the ring cross (a mitred inset of a concave plan can fold over itself). */
function ringSimple(r) {
  const n = r.length; if (n > 90) return false;
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < n; i++) {
    const a = r[i], b = r[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = r[j], d = r[(j + 1) % n];
      if (cr(a, b, c) * cr(a, b, d) < 0 && cr(c, d, a) * cr(c, d, b) < 0) return false;
    }
  }
  return true;
}

// upper-floor cells by storey role
function upperCells(sty, W, n, unitised) {
  const { wall, hv, hv2, zone } = sty;
  let mid = W.up, first = W.up, top = W.up;
  if (wall === 'stone') {
    if (n >= 3) { first = F.stoneSashTall; if (n >= 4 || hv2 < 0.45) top = F.stoneSmall; }
    else if (n === 2 && hv2 < 0.3) first = F.stoneSashTall;
  } else if (wall === 'brick') {
    mid = zone === 'centre' ? (hv2 < 0.6 ? F.brickGeorgian : F.brickSash) : hv2 < 0.38 ? F.brickPoly : hv2 < 0.62 ? F.brickPair : hv2 < 0.8 ? F.brickGeorgian : F.brickSash;
    first = top = mid;
  } else if (wall === 'render') {
    mid = hv2 < 0.55 ? F.renderGeorgian : F.renderSash; first = top = mid;
  } else if (wall === 'college') {
    // one window type per range: square mullions, arched Perpendicular lights, or wide transomed windows
    const hc = sty.ch; mid = hc < 0.34 ? F.stoneTudor : hc < 0.68 ? F.collegeGothic : F.collegeWide; first = top = mid;
  }
  // per-building style data (BUILDING_STYLE / overrides): cell names
  const so = sty.st;
  if (so.up && F[so.up] !== undefined) mid = first = top = F[so.up];
  if (so.first && F[so.first] !== undefined) first = F[so.first];
  if (so.top && F[so.top] !== undefined && n >= 3) top = F[so.top];
  return { first, mid, top, unitised };
}

/**
 * Plan one wall: how many bays, and (for a street front) the units — houses, shops, townhouses — with their ground-floor
 * cells. -> {kind, bays, units, k, ground:[cell per bay]|null, shop:[type per unit]|null}
 */
function planEdge(sty, W, len, n, hasGround, street, info, eseed, up, open = 0) {
  const blank = len < W.bay * 0.6;
  if (blank) return { kind: 'blank', bays: len / W.bay, units: 0, k: 0, ground: null };
  let bays = Math.max(1, Math.round(len / W.bay));
  const plain = { kind: 'plain', bays, units: 0, k: 0, ground: null };
  if (W.single || !(street || open) || !hasGround || sty.wall === 'glass' || sty.wall === 'concrete') return plain;
  const h1 = hash01(eseed), wall = sty.wall, so = sty.st;
  const winG = so.ground && F[so.ground] !== undefined ? F[so.ground] : wall === 'stone' ? (sty.hv2 > 0.7 ? F.stoneRustic : F.stoneSash) : wall === 'college' ? F.collegeGround : wall === 'brick' ? up.mid : wall === 'timber' ? F.renderSash : up.mid;
  const doorG = so.door && F[so.door] !== undefined ? F[so.door] : wall === 'stone' ? F.stoneDoor : wall === 'college' ? F.stoneArchDoor : wall === 'brick' ? F.brickDoor : F.renderDoor;
  if (open && !street) {
    // pass 7: a wall that looks onto a quad, garden or lawn inside a college: an unbroken rhythm of windows with a
    // staircase door every four or five bays (open === 2), or just the windows when the tile cannot pay for the doors
    const ground = new Array(bays).fill(winG), D = wall === 'college' ? 4 : 5, nd = open === 2 && bays >= 3 ? Math.max(1, Math.round(bays / D)) : 0;
    for (let k = 0; k < nd; k++) ground[Math.min(bays - 1, Math.floor(((k + 0.5) * bays) / nd))] = doorG;
    return { kind: 'range', bays, units: 0, k: 0, ground, open, win: winG, doors: nd };
  }
  if (info.shop && len >= 3) {
    const units = Math.max(1, Math.round(len / 5.8)), uw = len / units, k = so.bayW ? Math.max(1, Math.min(4, Math.round(uw / so.bayW))) : uw >= 7.6 ? 3 : uw >= 3.9 ? 2 : 1;
    bays = units * k;
    const ground = new Array(bays), shop = new Array(units);
    for (let u = 0; u < units; u++) {
      const hu = hash01(eseed + 's' + u);
      // shop type: pubs and cafés where the building is one; otherwise traditional joinery on the old streets, plate glass elsewhere
      let front = info.shopKind === 'pub' ? F.pubFront : info.shopKind === 'cafe' ? (hu < 0.7 ? F.cafeFront : F.shopA) : (sty.street === 'Cornmarket Street' || sty.street === 'Queen Street' || sty.zone !== 'centre' ? hu < 0.55 : hu < 0.22) ? F.shopB : hu < 0.9 ? F.shopA : F.cafeFront;
      shop[u] = front;
      if (k === 1) ground[u] = hu < 0.5 || units === 1 ? F.shopDoorA : front;
      else if (k === 2) { const dl = hu < 0.5; ground[u * 2] = dl ? F.shopDoorA : front; ground[u * 2 + 1] = dl ? front : F.shopDoorA; }
      else for (let i = 0; i < k; i++) ground[u * k + i] = i === 1 ? F.shopDoorA : front;
    }
    return { kind: 'shop', bays, units, k, ground, shop };
  }
  if (sty.dwelling || sty.terrace || (sty.house && sty.bt === 'residential')) {
    if (len < 3.2) return plain;
    const target = sty.zone === 'jericho' || sty.zone === 'east' || sty.zone === 'south' || sty.zone === 'west' ? 4.9 : sty.zone === 'north' ? 7.4 : 5.6;
    const single = sty.bt !== 'terrace' && len < target * 1.7;
    const units = single ? 1 : Math.max(1, Math.round(len / target)), uw = len / units, k = uw >= 6.4 ? 3 : uw >= 3.3 ? 2 : 1;
    bays = units * k;
    const ground = new Array(bays);
    for (let u = 0; u < units; u++) {
      if (k === 1) ground[u] = (u + (h1 < 0.5 ? 0 : 1)) % 2 ? winG : doorG;
      else if (k === 2) { const dl = (u + (h1 < 0.5 ? 0 : 1)) % 2 === 0; ground[u * 2] = dl ? doorG : winG; ground[u * 2 + 1] = dl ? winG : doorG; }   // doors paired across party walls
      else { const c = h1 < 0.4; ground[u * 3] = c ? winG : doorG; ground[u * 3 + 1] = c ? doorG : winG; ground[u * 3 + 2] = winG; }
    }
    return { kind: 'house', bays, units, k, ground };
  }
  if ((wall === 'stone' || wall === 'render' || wall === 'brick' || wall === 'timber') && !sty.college && info.area < 700 && len >= 4.2 && n <= 5) {
    // townhouse fronts: three bays each with the door to one side
    const units = Math.max(1, Math.round(len / (W.bay * 3))), uw = len / units, k = so.bayW ? Math.max(1, Math.min(5, Math.round(uw / so.bayW))) : uw >= 7.2 ? 3 : 2;
    bays = units * k;
    const ground = new Array(bays), dl = h1 < 0.5;
    for (let u = 0; u < units; u++) for (let i = 0; i < k; i++) ground[u * k + i] = (dl ? i === 0 : i === k - 1) ? doorG : winG;
    return { kind: 'town', bays, units, k, ground };
  }
  // colleges and institutions: an unbroken range of windows, one doorway in the middle of a long front
  const ground = new Array(bays).fill(winG);
  if ((so.gate && street && len >= 4) || (len >= (sty.college || wall === 'college' ? 26 : 11) && h1 < (wall === 'college' ? 0.55 : 0.8))) ground[bays >> 1] = doorG;
  return { kind: 'range', bays, units: 0, k: 0, ground };
}

/**
 * Plan one building (spec = {id, poly, holes, h, minH, tags, c, roofH?}, map-building shaped): style, roof shape and heights, storeys. Pure (no geometry); emitBuilding() draws the plan.
 */
export function planBuilding(ctx, b, info = {}) {
  let poly = cleanRing(b.poly);
  if (poly.length < 3) return null;
  { // landmark footprints may ask for near-collinear vertices to be merged (one bay per tower face)
    const tol = (LANDMARKS[b.id] || {}).simplify;
    if (tol) for (let pass = 0; pass < 3 && poly.length > 4; pass++) poly = poly.filter((p, i) => { const a = poly[(i - 1 + poly.length) % poly.length], c = poly[(i + 1) % poly.length]; return distToSeg(p[0], p[1], a[0], a[1], c[0], c[1]) > tol; });
  }
  const holes = (b.holes || []).map((h) => cleanRing(h)).filter((h) => h.length >= 3);
  const area = Math.abs(signedArea(poly));
  if (area < 1) return null;
  info.area = area;
  const sty = chooseStyle(ctx, b, info);
  let W = WALL_STYLES[sty.wall];
  // stone pass (2026-11): ashlar fronts, rubble flanks. About half the plain stone buildings (and a third of the college
  // ranges) have their windowless faces — gable ends, party walls, backs — in coursed rubble, as most of Oxford does.
  // Chosen per building by hash; hand-styled ids (BUILDING_STYLE / overrides) and churches keep ashlar.
  if ((sty.wall === 'stone' || sty.wall === 'college') && ((!sty.st.wall && !sty.lm.wall && hash01(b.id + 'rub') < (sty.wall === 'stone' ? 0.5 : 0.33)) || sty.st.rubble)) W = { ...W, flank: F.stoneRubble };
  if (sty.st.bayW) W = { ...W, bay: sty.st.bayW };   // (facts: the windows the list description counts across the front)
  const lm = sty.lm;
  let h = ctx.ov.heights.get(b.id) ?? lm.h ?? b.h;
  const minH = b.minH || 0;
  // pass 6: neighbours in a row do not share one eaves line (mapped heights are mostly per-block defaults)
  if (info.city && !ctx.ov.heights.has(b.id) && lm.h === undefined && !b.part && minH < 0.5 && !sty.college && !sty.churchy && (sty.house || sty.shopping || info.shop) && h > 5 && h < 22) h *= 0.93 + 0.15 * hash01(b.id + 'eh');
  // pass 7: a sensible minimum number of storeys by street type. Houses whose mapped height is a per-block default
  // came out as one storey under a huge roof (the roof took half the height): a house keeps two storeys of wall under
  // a lower roof, and the known three-storey Georgian terraces are raised to three
  let minWall = 0;
  if (info.city && sty.dwelling && !b.part && minH < 0.5 && lm.h === undefined && !ctx.ov.heights.has(b.id) && h >= 6.3) {
    const tall = TALL_TERRACES.has(sty.street) && sty.zone !== 'north';
    minWall = tall ? W.storey * 2.56 : GEORGIAN_STREETS.has(sty.street) || sty.zone === 'centre' ? Math.max(5.8, W.storey * 1.62) : Math.max(4.6, W.storey * 1.56);
    if (h < minWall + (tall ? 1.4 : 1.0)) h = minWall + (tall ? 1.4 : 1.0) + (tall ? 0.5 * hash01(b.id + 'eh') : 0);
  }
  if (h - minH < 1) h = minH + 2.5;
  // houses pass: the eaves height a terraced house or a villa really has (the map's heights are per-type defaults or
  // levels x 3.3 m: three storeys where there are two). eavesT = metres from the ground to the eaves (0: not one of them)
  let eavesT = 0;
  const villa = HOUSES && !!sty.st.villa && !b.part && minH < 0.5;
  if (HOUSES && info.city && !b.part && minH < 0.5 && lm.h === undefined && !ctx.ov.heights.has(b.id) && !sty.st.storeys && !sty.st.wall
    && !sty.st.eaves && TERRACE_ZONES.has(sty.zone) && !info.shop && !sty.college && area < 420
    && b.h >= 5.5 && !b.hasParts && (sty.dwelling || (sty.bt === 'yes' && area < 200 && !(b.tags || {}).name && RESI_ROAD.has(info.streetKind)))) {
    sty.terrace = true;
    eavesT = sty.bt === 'semidetached_house' || sty.bt === 'detached' ? 5.8 + 0.6 * hash01(b.id + 'eaves') : 5.45 + 0.55 * hash01(b.id + 'eaves');
  } else if (villa) eavesT = (sty.st.storeys >= 3 ? 8.2 : 6.6) + 0.5 * hash01(b.id + 'eaves');
  else if (HOUSES && sty.st.eaves && !b.part && minH < 0.5) eavesT = sty.st.eaves;      // (a place module's own figure: North Parade; a measured / listed figure: world/_bfacts.js)
  const o = obb(poly);
  let shape = chooseShape(b, sty, o, area, poly.length);
  if ((shape === 'gabled' || shape === 'hipped') && (o.rect < 0.7 || holes.length)) shape = 'crown';
  // (facts: a measured / listed 'gabled' or 'hipped' is built on the outline's bounding rectangle, so it is taken only on
  //  the plans the generator itself would pitch — up to 8 corners, nearly rectangular, up to 17 m deep. On an L-shaped
  //  or stepped plan the rectangle's roof hung over the neighbours: No 9 High Street's over the Covered Market.)
  if (sty.st.fact && (shape === 'gabled' || shape === 'hipped') && (poly.length > 8 || o.rect <= 0.82 || o.hw * 2 > 17)) shape = 'crown';
  // houses / terraces: ridge runs parallel to the street frontage, not along the (often longer) plot depth
  // (roofscape: a building the pass newly pitched keeps its ridge on the long axis: turning it to the street on a deep,
  // narrow plot made a roof as deep as the plot, 7-8 m high, with pyramids where hips met)
  const newPitch = (shape === 'gabled' || shape === 'hipped') && !sty.house && ROOFSCAPE && !(b.tags || {})['roof:shape'] && !sty.st.shape && (() => { const w = chooseShape(b, sty, o, area, poly.length, false); return w !== 'gabled' && w !== 'hipped'; })();
  if ((shape === 'gabled' || shape === 'hipped') && (sty.house || area < 260) && !(b.tags || {})['roof:shape'] && !newPitch) {
    let bestL = 0, fx = 0, fz = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c = poly[(i + 1) % poly.length], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz);
      if (l < 2.5 || l <= bestL) continue;
      const A = signedArea(poly) > 0 ? 1 : -1, nx = (dz / l) * A, nz = (-dx / l) * A;
      if (ctx.streetFacing(a, c, nx, nz)) { bestL = l; fx = dx / l; fz = dz / l; }
    }
    if (bestL > 0 && Math.abs(fx * o.vx + fz * o.vz) > Math.abs(fx * o.ux + fz * o.uz)) {
      [o.ux, o.uz, o.vx, o.vz] = [o.vx, o.vz, -o.ux, -o.uz];
      [o.hl, o.hw] = [o.hw, o.hl];
    }
  }
  const seed = hashStr(b.id) % 997;
  const [cx, cz] = [o.cx, o.cz];

  // roof height
  const span = h - minH;
  let roofH = 0, pitch = 0, crown = null;
  if (shape === 'crown') {
    // inset the footprint: slopes all round, flat top. d from the plan's "half width" (area / perimeter)
    let per = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], c = poly[(i + 1) % poly.length]; per += Math.hypot(c[0] - a[0], c[1] - a[1]); }
    for (const hh of holes) for (let i = 0; i < hh.length; i++) { const a = hh[i], c = hh[(i + 1) % hh.length]; per += Math.hypot(c[0] - a[0], c[1] - a[1]); }
    const holeArea = holes.reduce((s, hh) => s + Math.abs(signedArea(hh)), 0);
    const half = (area - holeArea) / Math.max(1, per);
    // roofscape pass: on old-looking buildings the slopes run further in (up to 5.4 m) at the same eaves height, so
    // the lead flat on top is a strip, not the whole roof (same triangles; the storey count is unchanged)
    const oldR = oldLooking(sty, area), dMax = oldR ? 5.4 : 3.4, rhMax = oldR ? 4.0 : 3.6, spanK = 0.3;
    if (span > 4.2 && half > 1.3) {
      const tanP = sty.roof === 'tile' ? 1.05 : sty.churchy ? 1.1 : oldR ? 0.98 : 0.84;
      // with courtyards the slopes from the outline and from each court must not meet: cap d by the narrowest range
      let gapMax = Infinity;
      if (holes.length) {
        const segD = (p, r) => { let m = Infinity; for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length], dd = distToSeg(p[0], p[1], a[0], a[1], c[0], c[1]); if (dd < m) m = dd; } return m; };
        holes.forEach((hh, hi) => {
          for (const p of hh) { gapMax = Math.min(gapMax, segD(p, poly)); holes.forEach((h2, j) => { if (j !== hi) gapMax = Math.min(gapMax, segD(p, h2)); }); }
          for (const p of poly) gapMax = Math.min(gapMax, segD(p, hh));
        });
        gapMax /= 2.3;
      }
      for (const f of oldR ? [0.94, 0.86, 0.6, 0.38] : [0.86, 0.6, 0.38]) {
        // (roofscape: never higher than the old crown at its first try, so the eaves, storeys and shopfronts stay put)
        const rhOld = oldR ? Math.min(Math.min(3.4, half * 0.86, gapMax) * (sty.roof === 'tile' ? 1.05 : sty.churchy ? 1.1 : 0.84), span * 0.3, 3.6) : 99;
        const d = Math.min(dMax, half * f, gapMax), rh = Math.min(d * tanP, span * spanK, rhMax, rhOld, minWall ? Math.max(0.9, span - minWall) : 99);
        if (rh < 0.7) break;
        const ring = insetRing(poly, d);
        if (!ring) continue;
        if (!ringSimple(ring)) continue;
        const hr = holes.map((hh) => insetRing(hh, -d));
        // the grown courtyards must stay simple, inside the shrunk outline and clear of each other
        if (hr.some((r) => !r || !ringSimple(r) || r.some((p) => !pointInPoly(p[0], p[1], ring)))) continue;
        if (hr.some((r) => ring.some((p) => pointInPoly(p[0], p[1], r)))) continue;
        if (hr.some((r, i) => hr.some((q, j) => j > i && r.some((p) => pointInPoly(p[0], p[1], q))))) continue;
        // last check: the flat top must triangulate to exactly its own area (earcut papers over folds and slivers)
        try {
          const tri = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p[0], p[1])), hr.map((r) => r.map((p) => new THREE.Vector2(p[0], p[1]))));
          const all = ring.concat(...hr); let ta = 0;
          for (const t of tri) { const A = all[t[0]], B = all[t[1]], C = all[t[2]]; ta += Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])) / 2; }
          const want = Math.abs(signedArea(ring)) - hr.reduce((q, r) => q + Math.abs(signedArea(r)), 0);
          if (!(want > 1) || Math.abs(ta - want) > want * 0.02) continue;
        } catch (e) { continue; }
        crown = { d, ring, holes: hr }; roofH = rh; break;
      }
    }
    if (!crown) shape = 'flat';
  }
  if (shape === 'gabled' || shape === 'hipped') {
    const was = (b.tags || {})['roof:shape'] || sty.st.shape ? shape : chooseShape(b, sty, o, area, poly.length, false);
    pitch = sty.churchy ? 0.95 : sty.roof === 'tile' ? 0.8 : sty.st.gables && was !== 'gabled' && was !== 'hipped' ? 0.86 : 0.68;
    let capR = 99;
    // roofscape pass: an old-looking range that used to be roofed as a crown keeps its eaves where the crown had them
    // and its ridge rises above the mapped height (mapped heights here are mostly storeys x 3 m, i.e. the walls)
    // (only where the shape is new: a building the old rules already gave a pitched roof keeps its walls and storeys)
    if (was !== 'gabled' && was !== 'hipped' && !sty.house && !b.roofH && !lm.roofH && !lm.h && !ctx.ov.heights.has(b.id) && !(b.tags || {})['roof:shape'] && !sty.st.shape && minH < 0.5 && span > 5 && oldLooking(sty, area)) {
      // keep = the roof height the old rules gave it (crown: slopes from the area / perimeter; flat: the parapet)
      let per = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], c = poly[(i + 1) % poly.length]; per += Math.hypot(c[0] - a[0], c[1] - a[1]); }
      const half = area / Math.max(1, per), want = Math.min(o.hw * Math.tan(pitch), 4.8);
      const keep = Math.min(want, was === 'crown' && span > 4.2 && half > 1.3 ? Math.min(Math.min(3.4, half * 0.86) * (sty.roof === 'tile' ? 1.05 : 0.84), span * 0.3, 3.6) : span > 4 ? 0.8 : 0);
      h += want - keep; capR = want;
    }
    const span2 = h - minH;
    roofH = b.roofH || lm.roofH || Math.min(o.hw * Math.tan(pitch), span2 * 0.5);
    roofH = Math.min(roofH, span2 - 2, capR);
    if (minWall) roofH = Math.min(roofH, Math.max(0.9, span2 - minWall));
    // houses pass: a terrace's slate roof at about 35-40 degrees, a villa's steep Gothic one at about 50; the walls are
    // then raised or lowered to the eaves height (below)
    if (eavesT && !b.roofH && !lm.roofH) roofH = Math.min(o.hw * Math.tan(villa ? 0.88 : sty.roof === 'tile' ? 0.72 : 0.66), villa ? 6.4 : 3.8);
    if (roofH < 0.6) { shape = 'flat'; roofH = 0; }
  } else if (shape === 'pyramidal' || shape === 'dome' || shape === 'cone' || shape === 'onion') {
    const rad = Math.sqrt(area / Math.PI);
    roofH = b.roofH || lm.roofH || (shape === 'dome' || shape === 'onion' ? Math.min(rad, span * 0.5) : Math.min(span * 0.4, rad * (shape === 'cone' ? 2.5 : 0.9)));
    roofH = Math.min(roofH, span);
  }
  if (eavesT && shape !== 'canopy') h = minH + eavesT + (shape === 'flat' ? 0 : roofH);
  if (shape === 'gabled' || shape === 'hipped') pitch = Math.atan2(roofH, o.hw);
  const flatRoof = shape === 'flat';
  const stoneLike = sty.wall === 'college' || sty.wall === 'gothic' || sty.wall === 'stone';
  // crown roofs: parapet in front on stone fronts and Georgian brick/stucco, open eaves on the rest
  const crownParapet = shape === 'crown' && sty.st.parapet !== false && (stoneLike || sty.st.parapet === true || ((sty.wall === 'render' || sty.wall === 'brick') && sty.zone === 'centre' && sty.hv < 0.6));
  const parapet = (flatRoof && span > 4 && sty.wall !== 'glass' && sty.bt !== 'roof') || crownParapet;
  const crenel = parapet && sty.st.crenel !== false && (lm.crenel || sty.st.crenel === true || (b.tags || {}).man_made === 'tower' || (stoneLike && (sty.bt === 'castle' || sty.bt === 'tower' || /Tower|Gate|Lodge/.test(b.tags.osmName || b.tags.name || '') || (sty.wall === 'college' && sty.ch < 0.5) || (sty.churchy && sty.hv < 0.7))));
  const pH = parapet ? (crenel ? 1.1 : 0.8) : 0;
  const wallTop = flatRoof ? h - pH : shape === 'canopy' ? h : h - roofH;
  const wallH = wallTop - minH;

  // storeys
  const n = sty.st.storeys || Math.max(1, Math.round(wallH / W.storey));
  const sH = wallH / n;
  const hasGround = !W.single && minH < 0.5 && n >= 2 && wallH > 5;
  const cottage = !W.single && minH < 0.5 && n === 1 && wallH >= 2.3 && wallH < 4.6 && sty.dwelling;   // single-storey houses still get a door
  // sheds, garages, kiosks: near tiles only (invisible behind the street fronts from far away)
  const small = area < 45 && h < 5.5 && !LANDMARKS[b.id];
  const up = upperCells(sty, W, n);
  // creeper: some college and garden walls (flag rides on the seed, see the atlas shader)
  const ivy = sty.st.ivy === false ? false : sty.st.ivy === true /* north pass: a style may ask for creeper (Lincoln's front quad) */ || (sty.college && sty.hv2 > 0.74) || (sty.zone === 'north' && sty.dwelling && sty.hv2 > 0.86) || (stoneLike && !sty.shopping && sty.hv2 > 0.93);
  // night windows pass (photo comparison item 10): the building's window-light class rides in the seed's eighths (the
  // facade shader takes it out again before any hash: materials.js LIT_SEED), so a terrace, a college staircase and
  // the floors over a shop each light up and go dark at their own hours
  const litCls = !NIGHT_WINDOWS ? 0 : sty.churchy || W.single ? LIT_CLASS.church
    : sty.college || sty.wall === 'college' || sty.bt === 'dormitory' || sty.bt === 'university accommodation' ? LIT_CLASS.college
    : sty.dwelling || sty.bt === 'apartments' || (sty.house && sty.bt === 'residential') || (sty.bt === 'yes' && !info.shop && sty.zone !== 'centre' && sty.zone !== 'mid' && area < 400) ? LIT_CLASS.house
    : info.shop || sty.shopping || MODERN_BT.has(sty.bt) || sty.bt === 'university' ? LIT_CLASS.shop : LIT_CLASS.generic;
  const bseed = seed + (ivy ? 4000 : 0) + litCls * 0.125;
  const garage = sty.bt === 'garage' || sty.bt === 'garages';

  // far tiles and shadow proxies see a crown roof as a plain lid part-way up its slope (the old box, same triangles)
  const farTop = shape === 'crown' ? wallTop + roofH * 0.55 : wallTop;
  return { poly, holes, area, sty, W, lm, h, minH, o, shape, seed, cx, cz, span, roofH, pitch, crown, flatRoof, stoneLike, crownParapet, parapet, crenel, pH, wallTop, wallH, n, sH, hasGround, cottage, small, up, ivy, bseed, garage, farTop, villa: villa && sty.st.villa === true };
}

const SCRATCH = new GeoBuf({ cell: true, tint: true, top: true, detail: true });
/** pass 7: does a wall look onto open ground (a quad, a garden, a lawn)? Points along it, 3 m and 7 m out, must be clear of every footprint. */
function facesOpen(ctx, lx, lz, rx, rz, len, nx, nz) {
  const G = ctx.buildingGrid; if (!G) return false;
  for (const f of [0.2, 0.5, 0.8]) for (const o of [3, 7]) {
    const x = lx + rx * len * f + nx * o, z = lz + rz * len * f + nz * o; let hit = false;
    G.queryRadius(x, z, 0.5, (r) => {
      if ((r.pl && r.pl.small) || x < r.bb.minX || x > r.bb.maxX || z < r.bb.minZ || z > r.bb.maxZ || !pointInPoly(x, z, r.b.poly)) return;
      for (const hh of r.b.holes || []) if (pointInPoly(x, z, hh)) return;
      hit = true; return true;
    });
    if (hit) return false;
  }
  return true;
}
const runsOf = (arr, i0, i1) => { let q = 0; for (let i = i0; i < i1;) { let j = i + 1; while (j < i1 && arr[j] === arr[i]) j++; q++; i = j; } return q; };
/**
 * Emit one building into GeoBufs. spec = {id, poly, holes, h, minH, tags, c, roofH?} (map-building shaped).
 * out = {facade, roof, parapet} GeoBufs; returns info used for signs and for the static facade extras.
 * City build only (pass 6): pl = planBuilding() result, hidden[i] = height up to which outer edge i is covered by a
 * neighbouring building (party walls are not drawn), dyn = street fronts get dynamic depth buckets.
 */
export function emitBuilding(ctx, b, out, info = {}, pl = null, hidden = null, dyn = false) {
  pl = pl || planBuilding(ctx, b, info);
  if (!pl) return null;
  const { poly, holes, area, sty, W, lm, h, minH, o, shape, seed, cx, cz, roofH, crown, flatRoof, stoneLike, crownParapet, parapet, crenel, pH, wallTop, wallH, n, sH, hasGround, cottage, small, up, bseed, garage, farTop, villa } = pl;
  const real = out.facade, rb = out.roof;
  let fb = real;
  const edges = [];
  const stone = sty.wall === 'stone' || sty.wall === 'college';
  const unitsOut = [];   // street-front units for the static extras: {E, sA, sB, kind, cell, useed, tint, bays:[...]}
  const canOpen = dyn && !small && sty.college && !W.single && hasGround && sty.wall !== 'glass' && sty.wall !== 'concrete' && !lm.stages;
  const mkUp = (front) => { const q = []; for (let s = hasGround || cottage ? 1 : 0; s < n; s++) q.push(!front ? up.mid : s === 1 && hasGround ? up.first : s === n - 1 && n >= 3 ? up.top : up.mid); return q; };   // storey bands on fronts only
  const upFront = mkUp(true);
  if (shape !== 'canopy' && wallH > 0.05) {
    const rings = [poly, ...holes];
    let u = 0;
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri], A = signedArea(ring), sgn = (ri === 0 ? 1 : -1) * (A > 0 ? 1 : -1);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length];
        const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        const nx = (dz / len) * sgn, nz = (-dx / len) * sgn;
        const street = ri === 0 && len > 2.5 && ctx.streetFacing(a, c, nx, nz);
        // u must increase left->right as seen from outside (viewer's right = (nz, -nx))
        const flip = dx * nz - dz * nx < 0;
        // viewer-left end of the wall and the unit vector towards the viewer's right
        const lx = flip ? c[0] : a[0], lz = flip ? c[1] : a[1], rx = flip ? -dx / len : dx / len, rz = flip ? -dz / len : dz / len;
        // pass 6: a wall standing against a neighbouring building is not drawn up to that neighbour's wall head
        const hTop = ri === 0 && hidden ? hidden[i] : -1e9, covered = hTop > minH + 1.5;
        // pass 7: walls of a college building that face a quad, garden or lawn are planned like fronts (window rhythm,
        // staircase doors) and take depth near the camera. The doors and the split into units cost flat triangles:
        // only while this tile has pass-7 savings left (GeoBuf.saved7), else windows only in one unit (costs nothing)
        let P = null;
        if (canOpen && !street && !covered && len >= W.bay * 2.4 && facesOpen(ctx, lx, lz, rx, rz, len, nx, nz)) {
          P = planEdge(sty, W, len, n, true, false, info, b.id + ':' + ri + ':' + i, up, 2);
          // flat variant: per unit of up to ~12 bays one quad of ground-floor windows, one quad per storey band, and one
          // small quad per staircase door laid 6 cm proud of the wall (half the triangles of splitting the wall at each door)
          const ch = Math.max(1, Math.round(P.bays / 12)), ur = runsOf(upFront, 0, upFront.length);
          const cost = (ch * (1 + ur) + P.doors - 2) * 2;
          if (real.saved7 - real.spent7 >= cost) { real.spent7 += cost; P.chunks = ch; ctx.stats.openFaces = (ctx.stats.openFaces || 0) + 1; }
          else { P = planEdge(sty, W, len, n, true, false, info, b.id + ':' + ri + ':' + i, up, 1); P.chunks = 1; ctx.stats.openFacesLite = (ctx.stats.openFacesLite || 0) + 1; }
        }
        if (!P) P = planEdge(sty, W, len, n, hasGround || cottage, street, info, b.id + ':' + ri + ':' + i, up);
        // walk-in rooms (world/walkin_bays.js): the bays a room opens with its own real window / door are painted as asked
        { const ov = ri === 0 && !covered && P.kind !== 'blank' && !W.single && (hasGround || cottage) ? WALKIN_BAYS[b.id] : null;
          if (ov) for (const q of ov) {
            const sq = (q[0] - lx) * rx + (q[1] - lz) * rz, off = Math.abs((q[0] - lx) * nx + (q[1] - lz) * nz); if (off > 0.9 || sq < 0 || sq > len) continue;
            const nb = Math.max(1, Math.round(P.bays)), bi = Math.min(nb - 1, Math.floor((sq / len) * nb)), cell = q[2] === 'blank' ? W.blank : F[q[2]]; if (cell === undefined) continue;
            if (!P.ground) { P.ground = new Array(nb).fill(W.gr); if (P.kind === 'plain') P.kind = 'range'; }
            P.ground[bi] = cell; P.walkin = true;
          } }
        const blank = P.kind === 'blank', bays = P.bays;
        const ua = flip ? u + bays : u, uc = flip ? u : u + bays;
        const E = { ax: a[0], az: a[1], bx: c[0], bz: c[1], nx, nz, len, street: street && !covered, lx, lz, rx, rz, u0: u, plan: P, ring: ri, covered };
        if (ri === 0) edges.push(E);
        if (covered) { fb = SCRATCH; fb.pos.length = fb.nor.length = fb.uv.length = fb.idx.length = fb.cell.length = fb.tint.length = fb.top.length = fb.det.length = 0; fb.n = 0; }
        else fb = real;
        fb.setTop(wallTop).setDetail(small ? 1 : 0);
        const live = dyn && !covered && !small;
        const run = (s0, s1, y0, y1, v0, v1, o = 0) => wallQuad(fb, lx + rx * len * s0 + nx * o, lz + rz * len * s0 + nz * o, lx + rx * len * s1 + nx * o, lz + rz * len * s1 + nz * o, y0, y1, nx, nz, u + bays * s0, u + bays * s1, v0, v1);
        if (lm.stages) {
          // landmark towers and fronts (pass 5): stacked stages [top (m above ground), cell, rows, bay (m), alt cell, p],
          // one quad per stage per wall; facets too narrow for a bay stay plain ashlar
          let y0 = minH;
          for (const [top, cell, rows, bay = lm.bay || 4, alt = cell, pAlt = 0] of lm.stages) {
            const y1 = Math.min(wallTop, top); if (y1 - y0 < 0.05) continue;
            if (len < bay * 0.55) { fb.setCell(W.blank, W.blank, 0, bseed).setTint(sty.tint); wallQuad(fb, a[0], a[1], c[0], c[1], y0, y1, nx, nz, flip ? len / 3.2 : 0, flip ? 0 : len / 3.2, y0 / 3.6, y1 / 3.6); }
            else { const nb = Math.max(1, Math.round(len / bay)); fb.setCell(cell, alt, pAlt, bseed).setTint(sty.tint); wallQuad(fb, a[0], a[1], c[0], c[1], y0, y1, nx, nz, flip ? u + nb : u, flip ? u : u + nb, 0, rows || (y1 - y0) / 3.6); }
            y0 = y1;
          }
        } else if (blank) {
          fb.setCell(W.flank ?? W.blank, W.flank ?? W.blank, 0, bseed).setTint(sty.tint);
          wallQuad(fb, a[0], a[1], c[0], c[1], minH, wallTop, nx, nz, ua, uc, 0, n);
        } else if (W.single || (!hasGround && !cottage)) {
          if (!hasGround && n === 1 && wallH < 4.5 && !W.single) fb.setCell(street ? (garage ? F.garageDoor : W.grAlt) : W.blank, garage && street ? F.garageDoor : W.gr, garage ? 0.7 : 0.5, bseed); // sheds/garages
          else if (sty.st && sty.st.noWindows) fb.setCell(W.blank, W.blank, 0, bseed);      // (style override `noWindows`: a low range whose windows a walk-in room draws itself — places/music_faculty.js)
          else fb.setCell(W.up, W.upAlt, W.upP, bseed);
          fb.setTint(sty.tint);
          if (W.single && wallH > 6 && minH < 0.5) {
            // church walls: a plain plinth zone, the traceried windows as one band of sane proportions, plain stone above
            const yb = Math.min(2.4, wallH * 0.22), yt = Math.min(wallTop, minH + yb + Math.max(5, Math.min(9, 2.3 * len / Math.max(1, Math.round(bays)))));
            fb.setDetail(2); wallQuad(fb, a[0], a[1], c[0], c[1], minH, wallTop, nx, nz, ua, uc, 0, 1);
            fb.setDetail(1); wallQuad(fb, a[0], a[1], c[0], c[1], minH + yb, yt, nx, nz, ua, uc, 0, 1);
            fb.setCell(W.blank, W.blank, 0, bseed);
            wallQuad(fb, a[0], a[1], c[0], c[1], minH, minH + yb, nx, nz, ua, uc, 0, yb / 3.6);
            if (wallTop - yt > 0.05) wallQuad(fb, a[0], a[1], c[0], c[1], yt, wallTop, nx, nz, ua, uc, 0, (wallTop - yt) / 3.6);
            // buttresses between the windows (static extras, if the tile can pay for them)
            if (live && len > 6) E.buttress = { nb: Math.max(1, Math.round(bays)), y1: Math.min(yt - 0.6, minH + wallH * 0.62) };
          } else
          wallQuad(fb, a[0], a[1], c[0], c[1], minH, wallTop, nx, nz, ua, uc, 0, n);
        } else if (!street && sty.house && farTop === wallTop && !covered && dyn && !P.open) {
          // pass 6: the back and side walls of houses are ONE quad shared by the near and far tiles (was three)
          fb.setDetail(small ? 1 : 0).setCell(up.mid, W.blank, 0.12, bseed).setTint(sty.tint);
          wallQuad(fb, a[0], a[1], c[0], c[1], minH, wallTop, nx, nz, ua, uc, 0, n);
          real.saved += 2;
        } else {
          // far LOD: one full-height quad of the upper-floor cell instead of the planned bands/units
          fb.setDetail(2).setCell(up.mid, W.upAlt, P.units || P.open ? 0 : W.upP, bseed).setTint(sty.tint);
          wallQuad(fb, a[0], a[1], c[0], c[1], minH, farTop, nx, nz, ua, uc, 0, n);
          fb.setDetail(1);
          const perUnit = P.units > 0 && (P.kind === 'house' || P.kind === 'shop' || P.kind === 'town');
          // street fronts get depth near the camera (dynamic buckets, see facadedetail.js): one bucket per house / shop
          // unit, or per ~4 bays of an institutional / apartment range (whose bays are then all explicit: no random blank bays)
          const dynOn = live && ((street && ri === 0) || P.open) && (perUnit || (P.kind === 'range' && P.ground));
          const chunks = perUnit ? P.units : P.open ? P.chunks : dynOn ? Math.max(1, Math.round(bays / 4)) : 1;
          const upCells = P.open === 1 ? mkUp(false) : street || P.open ? upFront : mkUp(false);
          // timber-framed fronts: the upper storeys are jettied out over the ground floor (near tiles)
          const jet = dynOn && (sty.wall === 'timber' || sty.st.jetty) && hasGround && upCells.length && (shape !== 'flat' || sty.st.jetty) ? 0.3 : 0;
          const Ej = jet ? { ...E, lx: lx + nx * jet, lz: lz + nz * jet } : E;
          E.jet = jet; E.jetY = minH + sH - 0.14;   // (street-name plates above the jetty stand on it)
          if (jet) {
            fb.setCell(W.blank, W.blank, 0, bseed).setTint(sty.tint);
            for (const [sj, sd] of [[0, -1], [len, 1]]) { const qx = lx + rx * sj, qz = lz + rz * sj; wallQuad(fb, qx, qz, qx + nx * jet, qz + nz * jet, minH + sH - 0.14, wallTop, rx * sd, rz * sd, 0, 0.1, 1, n); }
            real.spent += 4;
          }
          let offTris = 0;
          for (let un = 0; un < chunks; un++) {
            const b0 = perUnit ? un * P.k : dynOn ? Math.round((un * bays) / chunks) : 0, b1 = perUnit ? b0 + P.k : dynOn ? Math.round(((un + 1) * bays) / chunks) : bays;
            const s0 = perUnit || dynOn ? b0 / bays : 0, s1 = perUnit || dynOn ? b1 / bays : 1;
            // each house / shop is its own shade of the building's material, with its own door and joinery colour
            const hu = perUnit ? hash01(b.id + 'u' + i + '_' + un) : 0.5, k = perUnit ? 0.93 + 0.14 * hu : 1;
            const useed = perUnit ? bseed + 1 + ((un * 37 + i * 11) % 900) : bseed;
            // houses pass: in a brick terrace about one house in four has its brick painted over (cream, white, pastel)
            const paint = HOUSES && perUnit && P.kind === 'house' && sty.terrace && sty.wall === 'brick' && hash01(b.id + 'pt' + i + '_' + un) < 0.27;
            const gC = paint ? (bi) => painted(P.ground[bi]) : (bi) => P.ground[bi], uC = paint ? (st) => painted(upCells[st]) : (st) => upCells[st];
            const tint = paint ? pick(TINTS.render, hash01(b.id + 'pc' + i + '_' + un)) : perUnit && sty.wall === 'render' && P.kind !== 'town' && !sty.st.tintFixed && hash01(b.id + 'c' + i + '_' + un) < 0.55 ? pick(TINTS.render, hu) : [sty.tint[0] * k, sty.tint[1] * k, sty.tint[2] * k];
            fb.setTint(tint);
            const bucket = dynOn ? { x: lx + rx * len * (s0 + s1) / 2, z: lz + rz * len * (s0 + s1) / 2, v0: [], gen: null } : null;
            if (bucket && P.open) { bucket.site = sty.colName || ''; bucket.hl = (len * (s1 - s0)) / 2; bucket.ux = rx; bucket.uz = rz; }
            if (bucket) fb.sink = bucket.v0;
            // ground floor
            let y0 = minH, v0 = 0;
            const gz = perUnit ? -1 : 0;
            if (hasGround || cottage) {
              if (P.open) {
                fb.setCell(P.win, P.win, 0, useed);
                run(s0, s1, minH, minH + sH, 0, 1);
                for (let bi = b0; bi < b1; bi++) if (P.ground[bi] !== P.win) { fb.setCell(P.ground[bi], P.ground[bi], 0, useed); run(bi / bays, (bi + 1) / bays, minH, minH + sH, 0, 1, 0.06); }
              } else if (P.ground) {
                for (let bi = b0; bi < b1;) {
                  let bj = bi + 1; while (bj < b1 && P.ground[bj] === P.ground[bi]) bj++;
                  fb.setCell(gC(bi), gC(bi), gz, useed);
                  run(bi / bays, bj / bays, minH, minH + sH, 0, 1);
                  bi = bj;
                }
              } else {
                fb.setCell(W.gr, street ? W.grAlt : W.blank, street ? W.grP : 0.2, useed);
                run(s0, s1, minH, minH + sH, 0, 1);
              }
              y0 = minH + sH; v0 = 1;
            }
            // upper floors in bands: first floor (piano nobile), middle, attic
            const pz = perUnit ? -1 : dynOn ? 0 : W.upP;
            for (let s = 0; s < upCells.length;) {
              let e = s + 1; while (e < upCells.length && upCells[e] === upCells[s]) e++;
              fb.setCell(uC(s), perUnit || dynOn ? uC(s) : W.upAlt, pz, useed);
              run(s0, s1, y0 + s * sH, y0 + e * sH, v0 + s, v0 + e, jet);
              s = e;
            }
            if (!bucket) continue;
            fb.sink = null;
            offTris += bucket.v0.length / 3;
            // ---- level 1: the flat front plus the bands that stand out of it
            const sA = len * s0, sB = len * s1, bw = len / bays, ue = u, nSt = (hasGround || cottage ? 1 : 0) + upCells.length;
            const U = { E, sA, sB, kind: P.kind, useed, tint, un, bw, b0, b1, shop: P.shop ? P.shop[un] : 0, yF: minH + sH, hu, bay: null, oriel: null, open: !!P.open, force: !!sty.st.gate,
              // (for the street-name plates, plateBlocks: the cells of this unit's storeys and its downpipe)
              gC, ups: upCells.map((q, st) => uC(st)), hasG: !!(hasGround || cottage), pipe: perUnit && un < chunks - 1 && un % 2 === 0 && !jet && wallTop - minH > 4 };
            unitsOut.push(U);
            // hosts of the static extras: a bay window stands in front of the first plain ground-floor window of some
            // houses (and the one above it in north Oxford); an oriel over the gateway of a college range
            if (P.kind === 'house' && !stone && bw >= 2.3 && hash01(b.id + 'bw' + i + '_' + un) < (villa ? 0.92 : sty.zone === 'north' ? 0.5 : sty.zone === 'jericho' ? 0.2 : 0.28)) {
              // (houses pass: a villa's bay rises through two storeys under its gable, in the ground floor's window cell)
              for (let bi = b0; bi < b1 && !U.bay; bi++) { const sp = WIN[gC(bi)]; if (sp && sp.sill) U.bay = { bi, cell: gC(bi), s: sA + (bi - b0) * bw, rows: (villa && upCells.length) || (sty.zone === 'north' && upCells.length && upCells[0] === P.ground[bi]) ? 2 : 1, built: false }; }
            }
            if (P.kind === 'range' && street && sty.wall === 'college' && n >= 2 && WIN[upCells[0]] && WIN[upCells[0]].sill) for (let bi = b0; bi < b1; bi++) if (P.ground[bi] === F.stoneArchDoor) U.oriel = { bi, cell: upCells[0], s: sA + (bi - b0) * bw, built: false };
            // facts: a canted bay / oriel on the first floor of a town or shop front (the list description names it)
            if (sty.st.ubay && street && (P.kind === 'shop' || P.kind === 'town') && n >= 2 && bw >= 1.9 && WIN[upCells[0]] && WIN[upCells[0]].sill) { const bi = b0 + ((b1 - b0 - 1) >> 1); U.oriel = { bi, cell: upCells[0], s: sA + (bi - b0) * bw, built: false, rows: sty.st.ubay === 'f' && upCells.length >= 2 && upCells[1] === upCells[0] ? 2 : 1 }; U.force = true; ctx.stats.factBays = (ctx.stats.factBays || 0) + 1; }
            if (jet) {
              // the bressumer under the jetty (static: it must not blink with the dynamic levels)
              fb.setCell(F.darkMetal, F.darkMetal, 0, bseed).setTint(1.25, 1.1, 0.95);
              slab(fb, E, sA, sB, minH + sH - 0.14, minH + sH, jet, 'FB'); real.spent += 4;
            }
            // The depth of this front is generated when the camera comes near (TileBatcher.refreshDyn): level 1 = the
            // bands that stand out of the flat front, level 2 = those plus every bay × storey with its opening set back.
            bucket.gen = (fb, level) => {
            fb.setTop(wallTop);
            if (P.kind === 'shop') {
              // cornice over the fascia, in the shop's own paint
              fb.setCell(F.paintFlat, F.paintFlat, -1, useed).setTint(1, 1, 1);
              slab(fb, E, sA + 0.03, sB - 0.03, minH + sH - 0.07, minH + sH + 0.1, 0.2, 'FTB');
            } else {
              if (stone || (sty.wall === 'render' && hu < 0.5)) {
                // string course at the first floor
                if (n >= 2) { fb.setCell(stone ? F.stoneBand : F.renderBlank, undefined, 0, bseed).setTint(stone ? [tint[0] * 1.06, tint[1] * 1.06, tint[2] * 1.06] : [1.08, 1.08, 1.08]); slab(fb, E, sA, sB, minH + sH - 0.05, minH + sH + 0.1, 0.07, 'FTB'); }
              }
              for (let bi = b0; bi < b1 && P.ground; bi++) {
                const sp = WIN[gC(bi)]; if (!sp || !sp.door) continue;
                const d0 = sA + (bi - b0 + sp.x[0][0]) * bw, d1 = sA + (bi - b0 + sp.x[0][1]) * bw, hd = hash01(b.id + 'dh' + i + '_' + bi);
                fb.setCell(stone ? F.stoneBand : F.renderBlank, undefined, 0, bseed).setTint(stone ? [tint[0] * 1.08, tint[1] * 1.08, tint[2] * 1.08] : [1.1, 1.1, 1.1]);
                if (villa && P.kind === 'house') {
                  // houses pass: a villa's porch: a gabled canopy on brackets over the door (near the camera only)
                  const yP = minH + sH * (1 - sp.t) + 0.12, pw2 = (d1 - d0) / 2 + 0.42, sC = (d0 + d1) / 2;
                  slab(fb, E, sC - pw2, sC + pw2, yP, yP + 0.14, 1.05, 'FTBLR');
                  fb.setCell(W.blank, W.blank, 0, bseed).setTint(tint);
                  gabletFront(fb, { ...E, lx: E.lx + E.nx * 1.05, lz: E.lz + E.nz * 1.05 }, sC, yP + 0.14, pw2 * 2, pw2 * 0.9, W.bay, sH);
                  fb.setCell(ROOF_OFS + rcell, ROOF_OFS + rcell, 0, bseed).setTint(rtint);
                  gabletRoof(fb, { ...E, lx: E.lx + E.nx * 1.05, lz: E.lz + E.nz * 1.05 }, sC, yP + 0.14, pw2 * 2, pw2 * 0.9, 1.05, RS[rcell]);
                  fb.setCell(F.darkMetal, F.darkMetal, 0, bseed).setTint(0.9, 0.9, 0.9);
                  for (const sd of [-1, 1]) slab(fb, E, sC + sd * (pw2 - 0.12) - 0.05, sC + sd * (pw2 - 0.12) + 0.05, yP - 0.5, yP, 0.6, 'FLR');
                  fb.setCell(F.stoneBand, undefined, 0, bseed);
                }
                // a flat hood over the door on about half the houses, a doorstep on all
                else if (P.kind !== 'range' && hd < (stone ? 0.7 : 0.5)) slab(fb, E, d0 - 0.16, d1 + 0.16, minH + sH * (1 - sp.t) + 0.05, minH + sH * (1 - sp.t) + 0.17, 0.42, 'FTBLR');
                fb.setCell(F.stoneBand, undefined, 0, bseed).setTint(0.66, 0.66, 0.65);
                slab(fb, E, d0 - 0.08, d1 + 0.08, minH, minH + 0.26, 0.26, 'FT');
              }
              if (P.kind === 'range' && sty.wall === 'college') {
                // chamfered plinth along a college range (the collegeGround cell paints it 0.225 of a storey high), broken at doorways
                fb.setCell(F.stoneBand, undefined, 0, bseed).setTint(tint[0] * 0.97, tint[1] * 0.97, tint[2] * 0.97);
                for (let bi = b0; bi < b1;) { if (P.ground[bi] !== F.collegeGround) { bi++; continue; } let bj = bi + 1; while (bj < b1 && P.ground[bj] === F.collegeGround) bj++; slab(fb, E, sA + (bi - b0) * bw, sA + (bj - b0) * bw, minH, minH + sH * 0.225, 0.08, 'FT'); bi = bj; }
              }
            }
            // the wall head: cornice (and coping) of a parapet, or an iron gutter under open eaves
            const gableEnd = shape === 'gabled' && Math.abs(rx * o.ux + rz * o.uz) < 0.5;
            if (parapet) {
              fb.setCell(F.stoneBand, undefined, 0, bseed).setTint(stone ? [tint[0] * 1.06, tint[1] * 1.06, tint[2] * 1.06] : [1.0, 0.98, 0.93]);
              slab(fb, Ej, sA, sB, wallTop - 0.17, wallTop + 0.05, 0.17, wallTop > 5.4 ? 'FB' : 'FTB');   // pass 7: its top face is above every eye
              if (!crenel) slab(fb, Ej, sA, sB, wallTop + pH - 0.11, wallTop + pH + 0.03, 0.07, 'FB');
            } else if (shape !== 'flat' && !gableEnd) {
              fb.setCell(F.darkMetal, F.darkMetal, 0, bseed).setTint(1, 1, 1);
              slab(fb, Ej, sA, sB, wallTop - 0.14, wallTop - 0.02, 0.12, 'FB');
            }
            // a cast-iron downpipe on every other party line
            if (perUnit && un < chunks - 1 && un % 2 === 0 && !jet && wallTop - minH > 4) {
              fb.setCell(F.darkMetal, F.darkMetal, 0, bseed).setTint(1, 1, 1);
              slab(fb, E, sB - 0.055, sB + 0.055, minH + (P.kind === 'shop' ? sH + 0.12 : 0.15), wallTop - 0.14, 0.12, 'FLR');
            }
            // window boxes on the first floor of pubs and cafés
            if (P.kind === 'shop' && (U.shop === F.pubFront || U.shop === F.cafeFront) && upCells.length && hu < 0.7) {
              const sp = WIN[upCells[0]];
              if (sp && sp.sill) {
                fb.setCell(HEDGE_CELL).setTint(1.25, 1.3, 0.95);
                const ys = minH + sH + sH * (1 - sp.b);
                for (let bi = b0; bi < b1; bi++) slab(fb, Ej, sA + (bi - b0 + sp.x[0][0]) * bw, sA + (bi - b0 + sp.x[sp.x.length - 1][1]) * bw, ys - 0.04, ys + 0.2, 0.26, 'FT');
              }
            }
            if (level < 2) return;
            // ---- level 2: every bay × storey with its opening set back
            fb.setTint(tint);
            for (let st = 0; st < nSt; st++) {
              const ground = (hasGround || cottage) && st === 0, yA = minH + st * sH, yB = yA + sH;
              const Eb = ground ? E : Ej, lx = Eb.lx, lz = Eb.lz;
              for (let bi = b0; bi < b1; bi++) {
                const cell = ground ? gC(bi) : uC(st - (hasGround || cottage ? 1 : 0));
                const sp = WIN[cell], x0 = len * (bi / bays), x1 = len * ((bi + 1) / bays);
                fb.setCell(cell, cell, ground ? gz : pz, useed);
                // plain bays, and the windows hidden behind a bay window or an oriel, stay flat
                const host = (U.bay && U.bay.built && bi === U.bay.bi && st < U.bay.rows) || (U.oriel && U.oriel.built && bi === U.oriel.bi && st >= 1 && st <= (U.oriel.rows || 1));
                if (!sp || host) { wallQuad(fb, lx + rx * x0, lz + rz * x0, lx + rx * x1, lz + rz * x1, yA, yB, nx, nz, ue + bi, ue + bi + 1, st, st + 1); continue; }
                recessBay(fb, Eb, x0, x1, yA, yB, ue + bi, st, sp, yA + sH * (1 - sp.b) > 5.4);
                if (sp.sill && st < 3) {
                  // the sill stands proud of the wall (seen from above on the ground floor, from below higher up)
                  fb.setCell(F.stoneBand, undefined, 0, bseed).setTint(stone ? [tint[0] * 1.1, tint[1] * 1.1, tint[2] * 1.1] : sty.wall === 'brick' ? [0.98, 0.97, 0.93] : [1.12, 1.12, 1.1]);
                  const ys = yA + sH * (1 - sp.b);
                  slab(fb, Eb, x0 + (sp.x[0][0] - 0.05) * bw, x0 + (sp.x[sp.x.length - 1][1] + 0.05) * bw, ys - sH * 0.033, ys, 0.075, ground ? 'FT' : 'FB');
                  fb.setTint(tint);
                }
              }
            }
            };
            (real.dyn || (real.dyn = [])).push(bucket);
          }
          if (dynOn && !perUnit && !P.open) {
            // what the pass-5 emitter drew for this wall: one quad per run of equal ground cells + one per storey band
            let oldQ = 0; for (let bi = 0; bi < bays;) { let bj = bi + 1; while (bj < bays && P.ground[bj] === P.ground[bi]) bj++; oldQ++; bi = bj; }
            for (let s = 0; s < upCells.length;) { let e = s + 1; while (e < upCells.length && upCells[e] === upCells[s]) e++; oldQ++; s = e; }
            real.spent += offTris - oldQ * 2;
          }
        }
        if (farTop > wallTop && (blank || W.single || (!hasGround && !cottage))) { fb.setDetail(2).setCell(blank && W.flank ? W.flank : W.blank, blank && W.flank ? W.flank : W.blank, 0, bseed).setTint(sty.tint); wallQuad(fb, a[0], a[1], c[0], c[1], wallTop, farTop, nx, nz, ua, uc, 0, 0.3); }
        if (covered) {
          // count what was not drawn (near tiles: detail 0 / 1) and close the wall above the neighbour's wall head
          let nearT = 0; const D = SCRATCH.det, I = SCRATCH.idx;
          for (let t = 0; t < I.length; t += 3) if (D[I[t]] !== 2) nearT++;
          fb = real; fb.setTop(wallTop);
          if (hTop < wallTop - 0.3) {
            fb.setDetail(farTop > wallTop ? 1 : small ? 1 : 0).setCell(W.blank, W.blank, 0, bseed).setTint(sty.tint);
            wallQuad(fb, a[0], a[1], c[0], c[1], hTop, wallTop, nx, nz, ua, uc, hTop / (W.single ? 3.6 : sH), wallTop / (W.single ? 3.6 : sH)); nearT -= 2;
            if (farTop > wallTop) { fb.setDetail(2); wallQuad(fb, a[0], a[1], c[0], c[1], hTop, farTop, nx, nz, ua, uc, hTop / 3.6, farTop / 3.6); }
          }
          real.saved += nearT;
          ctx.stats.partyWalls = (ctx.stats.partyWalls || 0) + 1;
        }
        fb.setDetail(small ? 1 : 0);
        u += Math.ceil(bays);
      }
    }
    fb = real;
    fb.setTop();
  }
  rb.setDetail(small ? 1 : 0);

  // ---- roofs
  const [rcell, rtint] = roofCellTint(sty.roof, flatRoof, sty.hv);
  const rs = RS[rcell];
  const parapetTint = sty.wall === 'brick' ? [0.85, 0.62, 0.55] : sty.wall === 'render' ? [1.05, 1.03, 1.0] : sty.wall === 'concrete' ? [0.85, 0.85, 0.85] : [sty.tint[0], sty.tint[1], sty.tint[2]];
  const emitParapet = () => {
    // parapet in the city atlas (both faces), crenellated ones get real merlons (detail: not in far tiles / shadows)
    const pb = out.parapet;
    pb.setDetail(true);   // parapets: near tiles only (far tiles and shadow proxies stop at the roof line)
    // (the building's seed on its parapet: the facade shader tells walls in one plane apart by a hair picked from the
    //  seed, and every parapet in the city had seed 0 — two parapets in one plane, of two buildings whose walls only
    //  partly overlap, always took the same hair)
    pb.setCell(PARAPET_CELL, PARAPET_CELL, 0, seed).setTint(parapetTint);      // (seed, not bseed: no ivy, no window-light class)
    const solid = crenel ? 0.66 : pH;
    for (const ring of [poly, ...holes]) {
      let acc = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 0.05) continue;
        const nx = (c[1] - a[1]) / len, nz = -(c[0] - a[0]) / len;
        // (a wall covered to above this parapet's top — a taller neighbour standing against it, or the taller twin of
        //  this wall in the same plane — has no parapet to show: it lay inside, or in the face of, the other wall)
        //  — and where this wall is the lower twin, the twin's own parapet stands in the same plane: one parapet there)
        if (ring === poly && hidden && (hidden[i] >= wallTop + pH - 0.05 || (hidden.twinTop && hidden.twinTop[i] >= wallTop + pH - 0.35))) { acc += len; continue; }
        // outer face only: the inner face of a parapet is never seen from the street
        wallQuad(pb, a[0], a[1], c[0], c[1], wallTop, wallTop + solid, nx, nz, acc / 2, (acc + len) / 2, 0, 1);
        if (crenel && out.crenel) {
          // merlons: alpha-tested band in its own small layer (keeps discard out of the main city shader)
          const cb = out.crenel; cb.setColor(pb.t);
          wallQuad(cb, a[0], a[1], c[0], c[1], wallTop + solid - 0.02, wallTop + pH, nx, nz, acc / 2, (acc + len) / 2, 0.775, 0.985);
        }
        acc += len;
      }
    }
    pb.setDetail(small ? 1 : 0);
  };
  const stacks = [];   // chimney positions [x, z, ux, uz, yBase, yTop]
  const tallStacks = ROOFSCAPE && (sty.st.stacks === 'tall' || (sty.wall === 'college' && sty.college));
  if (shape === 'flat') {
    rb.setCell(ROOF_OFS + rcell).setTint(rtint);
    flatPoly(rb, poly, holes, wallTop, rs);
    if (parapet) emitParapet();
  } else if (shape === 'crown') {
    rb.setDetail(1);
    crownRoof(rb, poly, holes, crown, wallTop, roofH, crownParapet, rcell, rtint);
    rb.setDetail(2).setCell(ROOF_OFS + rcell).setTint(rtint);
    flatPoly(rb, poly, holes, farTop, rs);
    rb.setDetail(small ? 1 : 0);
    if (crownParapet) emitParapet();
    // stacks on the flat crown near its corners
    if (sty.wall !== 'gothic' && !sty.churchy && area < 2600) {
      // roofscape pass: old-looking blocks carry one to three stacks (was none on a quarter, at most two)
      const q = crown.ring, nSt = oldLooking(sty, area) ? (sty.hv2 < 0.08 ? 0 : area < 250 ? 1 : area < 700 ? 2 : 3) : sty.hv2 < 0.25 ? 0 : area < 420 ? 1 : 2;
      const i0 = Math.floor(hash01(b.id + 'st0') * q.length);
      for (let k = 0; k < nSt; k++) {
        const i = ROOFSCAPE ? (i0 + Math.round((k * q.length) / Math.max(1, nSt))) % q.length : Math.floor(hash01(b.id + 'st' + k) * q.length) % q.length, p = q[i], pc = polyCentroid(q);
        const dxc = pc[0] - p[0], dzc = pc[1] - p[1], l = Math.hypot(dxc, dzc) || 1, a = poly[i], c = poly[(i + 1) % poly.length], el = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        stacks.push([p[0] + (dxc / l) * 0.5, p[1] + (dzc / l) * 0.5, (c[0] - a[0]) / el, (c[1] - a[1]) / el, wallTop + roofH - 0.1, wallTop + roofH + (tallStacks ? 2.0 + hash01(b.id + 'sh' + k) * 0.9 : 1.3 + hash01(b.id + 'sh' + k) * 0.6)]);
      }
    }
  } else if (shape === 'canopy') {
    rb.setCell(ROOF_OFS + rcell).setTint(rtint);
    flatPoly(rb, poly, holes, h, rs);
    flatPoly(rb, poly, holes, h - 0.25, rs, true);
    if (poly.length <= 8 && area < 600) { fb.setDetail(true).setCell(F.concreteBlank).setTint(0.6, 0.6, 0.6); for (const p of poly) orientedBox(fb, p[0], p[1], 1, 0, 0.12, 0.12, 0, h - 0.25, { top: false }); fb.setDetail(false); }
  } else if (shape === 'gabled' || shape === 'hipped' || (shape === 'pyramidal' && o.rect > 0.85)) {
    pitchedRoof(fb, rb, o, wallTop, roofH, shape, W, sty, rcell, rtint, bseed, minH, sH);
    // roofscape pass: college ranges and every old-looking range carry stacks too (colleges' are tall, about every 9 m)
    if ((sty.house || sty.wall === 'brick' || sty.wall === 'render' || sty.wall === 'stone' || (ROOFSCAPE && (sty.wall === 'college' || sty.wall === 'timber'))) && shape !== 'pyramidal' && area < (oldLooking(sty, area) ? 3000 : 900) && sty.hv2 > 0.1 && !garage && sty.bt !== 'shed' && !(ROOFSCAPE && sty.churchy)) {
      // stacks on the ridge: one per party wall along a terrace, at one or both ends of a single house
      const eh = tallStacks ? 2.0 : villa ? 1.8 : 1.25, nUnits = Math.max(1, Math.round((o.hl * 2) / (ROOFSCAPE && sty.wall === 'college' ? 9 : sty.zone === 'north' ? 7.4 : 5.2)));
      if (nUnits >= 3) for (let k = 0; k <= nUnits; k++) { if (k % 2 && nUnits > 4) continue; const d = Math.max(-o.hl + 0.45, Math.min(o.hl - 0.45, -o.hl + (k / nUnits) * o.hl * 2)); stacks.push([o.cx + o.ux * d, o.cz + o.uz * d, o.ux, o.uz, wallTop + roofH * 0.55, wallTop + roofH + eh + 0.5 * hash01(b.id + 'ch' + k)]); }
      else for (const e of sty.hv < 0.5 ? [-1, 1] : [sty.hv < 0.75 ? -1 : 1]) { const d = Math.max(0, o.hl - 0.45) * e; stacks.push([o.cx + o.ux * d, o.cz + o.uz * d, o.ux, o.uz, wallTop + roofH * 0.4, wallTop + roofH + eh + 0.5 * hash01(b.id + 'ch' + e)]); }
    }
  } else {
    shrinkRoof(rb, poly, wallTop, roofH, shape, rcell, rtint);
  }
  // chimney stacks: shaft, oversailing cap course, clay pots (near tiles only)
  if (stacks.length) {
    const brickStack = sty.wall !== 'stone' && sty.wall !== 'college';
    fb.setDetail(true);
    for (const [x, z, ux, uz, y0, y1] of stacks) {
      fb.setCell(brickStack ? F.brickBlank : F.stoneBlank, undefined, 0, seed).setTint(brickStack ? (sty.wall === 'brick' ? sty.tint : [0.95, 0.72, 0.64]) : sty.tint);
      orientedBox(fb, x, z, ux, uz, 0.34, 0.6, y0, y1, { uvScale: 2.6, top: false });
      orientedBox(fb, x, z, ux, uz, 0.41, 0.67, y1, y1 + 0.14, { uvScale: 2.6 });
      // the row of clay pots as one low block
      fb.setCell(F.concreteBlank).setTint(0.62, 0.4, 0.3);
      const vx = -uz, vz = ux;
      orientedBox(fb, x, z, vx, vz, 0.4, 0.1, y1 + 0.14, y1 + 0.5, { uvScale: 1, top: false });
    }
    fb.setDetail(false);
  }
  // dormers on the street-side slopes of some houses and town roofs (near tiles only)
  // roofscape pass: more of the old centre's roofs carry dormers (0.3 -> 0.5), hipped roofs too; fronts with attic gables have those instead
  if ((shape === 'crown' || shape === 'gabled' || (ROOFSCAPE && shape === 'hipped')) && roofH > 1.5 && !sty.churchy && sty.wall !== 'gothic' && !garage && !sty.st.gables && !(villa && shape === 'gabled')
    && sty.st.dormers !== false && (sty.st.dormers === true || hash01(b.id + 'dm') < (sty.zone === 'centre' ? (oldLooking(sty, area) && sty.wall !== 'brick' ? 0.5 : 0.3) : sty.zone === 'north' ? 0.5 : 0.22))) {
    const lead = [0.9, 0.92, 0.96];
    pl.dormers = true;
    fb.setDetail(true);
    for (const E of edges) {
      if (!E.street || E.len < 4 || E.plan.kind === 'blank') continue;
      if (shape !== 'crown') { const along = Math.abs(E.rx * o.ux + E.rz * o.uz); if (along < 0.9) continue; }   // only the eave sides
      // a hipped roof's eave side: keep the dormers clear of the hips
      const sE0 = shape === 'hipped' ? Math.min(E.len / 2, o.hw + 0.9) : 0, use = E.len - 2 * sE0;
      const run = shape === 'crown' ? crown.d : o.hw, slope = roofH / run, nb = Math.max(1, Math.round(use / 5.4));
      const dw = 0.62, dh = 1.15, sb = shape === 'crown' && crownParapet ? 0.75 : 0.45;
      if (slope * sb + dh > roofH * 0.96 || use < nb * 2.2) continue;
      for (let k = 0; k < nb; k++) {
        const s = sE0 + ((k + 0.5) / nb) * use, bx = E.lx + E.rx * s - E.nx * sb, bz = E.lz + E.rz * s - E.nz * sb;
        const y0 = wallTop + slope * sb, y1 = y0 + dh, depth = dh / slope + 0.05;
        // front (window), two cheeks, flat lead top running back into the slope
        fb.setCell(F.dormerFront, F.dormerFront, -1, seed).setTint(1, 1, 1);
        wallQuad(fb, bx - E.rx * dw, bz - E.rz * dw, bx + E.rx * dw, bz + E.rz * dw, y0, y1, E.nx, E.nz, 0, 1, 0, 1);
        fb.setCell(ROOF_OFS + RC.lead).setTint(lead);
        for (const sd of [-1, 1]) {
          const px = bx + E.rx * dw * sd, pz = bz + E.rz * dw * sd;
          const A = fb.v(px, y0, pz, E.rx * sd, 0, E.rz * sd, 0, 0), B = fb.v(px, y1, pz, E.rx * sd, 0, E.rz * sd, 0, 0.5), C = fb.v(px - E.nx * depth, y1, pz - E.nz * depth, E.rx * sd, 0, E.rz * sd, 0.6, 0.5);
          fb.triFacing(A, B, C, E.rx * sd, 0, E.rz * sd);
        }
        const t0 = fb.v(bx - E.rx * (dw + 0.08) + E.nx * 0.1, y1, bz - E.rz * (dw + 0.08) + E.nz * 0.1, 0, 1, 0, 0, 0), t1 = fb.v(bx + E.rx * (dw + 0.08) + E.nx * 0.1, y1, bz + E.rz * (dw + 0.08) + E.nz * 0.1, 0, 1, 0, 0.5, 0);
        const t2 = fb.v(bx + E.rx * (dw + 0.08) - E.nx * depth, y1, bz + E.rz * (dw + 0.08) - E.nz * depth, 0, 1, 0, 0.5, 0.6), t3 = fb.v(bx - E.rx * (dw + 0.08) - E.nx * depth, y1, bz - E.rz * (dw + 0.08) - E.nz * depth, 0, 1, 0, 0, 0.6);
        fb.quadFacing(t0, t1, t2, t3, 0, 1, 0);
      }
    }
    fb.setDetail(false);
  }
  // roofscape / college-front pass: attic gables (Cotswold-style wall dormers) over every other bay of a college's
  // street and quad fronts: the wall rises 0.6 m through the eaves into a steep gable with a two-light window
  // (atlas cell collegeGable, mapped once per gable), cheeks and a little pitched roof running back into the main
  // slope. 9 triangles each, near tiles only.
  // houses pass: a North Oxford villa turns a steep gable to the street over the bay window of each house (the same
  // construction, flush with the eaves: atlas cell villaGable, with its bargeboards painted in)
  const villaG = villa && !sty.st.gables && !small && shape === 'gabled' && roofH >= 2;
  if ((sty.st.gables || villaG) && !small && roofH >= 1.6 && (shape === 'gabled' || shape === 'hipped' || (shape === 'crown' && !crownParapet))) {
    const run = shape === 'crown' ? crown.d : o.hw, slope = roofH / run, ga = villaG ? 0 : 0.6;
    fb.setDetail(true);
    let made = 0;
    for (const E of edges) {
      if (E.covered || E.len < 3.2 || E.plan.kind === 'blank' || !(E.street || E.plan.open) || (villaG && !E.street)) continue;
      if (shape !== 'crown' && Math.abs(E.rx * o.ux + E.rz * o.uz) < 0.9) continue;   // eave sides only
      const s0 = shape === 'hipped' ? Math.min(E.len / 2, o.hw + 0.4) : shape === 'crown' ? Math.min(E.len / 2, crown.d * 0.6) : 0;
      const bays = Math.max(1, Math.round(E.plan.bays)), bw = E.len / bays, gw = villaG ? Math.min(Math.max(3, bw * 1.4), 5.2, E.len * 0.6) : Math.min(bw * 0.84, 3.4);
      const gt = villaG ? Math.min(gw * 0.75, roofH * 0.9) : Math.min(gw * 0.62, roofH * 0.92 - ga);
      if (gt < 0.7) continue;
      const odd = bays % 2, step = bays >= 3 ? 2 : 1, at = [];
      if (villaG) {
        // one per house on the front, over its first window bay (where the bay window stands), kept inside the wall
        const P = E.plan, uk = P.units > 0 ? P.k : bays, nu = P.units > 0 ? P.units : 1;
        for (let un = 0; un < nu; un++) {
          let bi = un * uk; while (bi < (un + 1) * uk - 1 && !(P.ground && WIN[P.ground[bi]] && WIN[P.ground[bi]].sill)) bi++;
          at.push(Math.min(Math.max((bi + 0.5) * bw, gw / 2 + 0.2), E.len - gw / 2 - 0.2));
        }
      } else for (let k = odd ? 0 : 1; k < bays; k += step) at.push((k + 0.5) * bw);
      for (const sC of at) {
        if (sC - gw / 2 < s0 + 0.15 || sC + gw / 2 > E.len - s0 - 0.15) continue;
        const y0 = wallTop, yE = wallTop + ga, yA = yE + gt, dE = ga / slope, dA = (ga + gt) / slope, ov = 0.18;
        const W2 = (s, o) => [E.lx + E.rx * s + E.nx * o, E.lz + E.rz * s + E.nz * o];
        const sl = sC - gw / 2, sr = sC + gw / 2;
        // the gable wall: the attic strip and the triangle, one cell across it (u 0..1, v 0 at the eaves .. 1 at the apex)
        const gcell = villaG ? F.villaGable : F[sty.st.gableCell] ?? F.collegeGable;   // (facts: a plastered or brick town front's gable is plain wall)
        fb.setTop(yA + 1).setCell(gcell, gcell, 0, bseed).setTint(sty.tint);
        const H = yA - y0, P0 = W2(sl, 0.02), P1 = W2(sr, 0.02), PA = W2(sC, 0.02);
        const a0 = fb.v(P0[0], y0, P0[1], E.nx, 0, E.nz, 0, 0), a1 = fb.v(P1[0], y0, P1[1], E.nx, 0, E.nz, 1, 0);
        const a2 = fb.v(P1[0], yE, P1[1], E.nx, 0, E.nz, 1, ga / H), a3 = fb.v(P0[0], yE, P0[1], E.nx, 0, E.nz, 0, ga / H);
        const a4 = fb.v(PA[0], yA, PA[1], E.nx, 0, E.nz, 0.5, 1);
        if (ga > 0.01) fb.quadFacing(a0, a1, a2, a3, E.nx, 0, E.nz);
        fb.triFacing(a3, a2, a4, E.nx, 0, E.nz);
        // cheeks: the attic strip's sides, back to where the main slope reaches the gable's eaves
        fb.setCell(W.flank ?? W.blank, W.flank ?? W.blank, 0, bseed);
        if (ga > 0.01) for (const [sx, sd] of [[sl, -1], [sr, 1]]) {
          const Q0 = W2(sx, 0.02), Q1 = W2(sx, -dE), nx = E.rx * sd, nz = E.rz * sd;
          fb.triFacing(fb.v(Q0[0], y0, Q0[1], nx, 0, nz, 0, 0), fb.v(Q0[0], yE, Q0[1], nx, 0, nz, 0, ga / 3.4), fb.v(Q1[0], yE, Q1[1], nx, 0, nz, dE / 3.3, ga / 3.4), nx, 0, nz);
        }
        // its roof: two slopes from a small overhang back into the main roof
        fb.setTop().setCell(ROOF_OFS + rcell).setTint(rtint);
        const half = gw / 2 + 0.08, rl = Math.hypot(half, gt);
        for (const sd of [-1, 1]) {
          const se = sC + sd * half, nxx = E.rx * sd * gt, nyy = half, nl = Math.hypot(gt, half);
          const Ea = W2(se, ov), Eb = W2(se, -dE), Ra = W2(sC, ov), Rb = W2(sC, -dA);
          const nX = (E.rx * sd * gt) / nl, nY = half / nl, nZ = (E.rz * sd * gt) / nl;
          const yEe = yE - 0.08 * (gt / (gw / 2));
          fb.quadFacing(fb.v(Ea[0], yEe, Ea[1], nX, nY, nZ, 0, 0), fb.v(Ra[0], yA + 0.06, Ra[1], nX, nY, nZ, 0, rl / rs), fb.v(Rb[0], yA + 0.06, Rb[1], nX, nY, nZ, (dA + ov) / rs, rl / rs), fb.v(Eb[0], yEe, Eb[1], nX, nY, nZ, (dE + ov) / rs, 0), nX, nY, nZ);
          void nxx; void nyy;
        }
        made++;
      }
    }
    if (made) { pl.dormers = true; ctx.stats.atticGables = (ctx.stats.atticGables || 0) + made; }
    fb.setDetail(false).setTop();
  }
  fb.setDetail(0); rb.setDetail(0);
  return {
    id: b.id, poly, holes, edges, minH, n, sH: hasGround || cottage ? sH : Math.min(sH, 3.6), storeyH: sH, hasGround: hasGround || cottage, wallTop, sty, shape, crenel, parapet, pH, roofH,
    up, seed: bseed, c: [cx, cz], o, area, small, single: !!W.single,
    units: unitsOut, W, crown, crownParapet, roofCell: ROOF_OFS + rcell, rtint, rs, dormers: !!pl.dormers,
  };
}

/** Hipped slopes all round an arbitrary footprint (and its courtyards) up to a flat lead crown. */
function crownRoof(rb, poly, holes, crown, y0, rh, behindParapet, rcell, rtint) {
  const rs = RS[rcell], d = crown.d, slopeLen = Math.hypot(d, rh);
  rb.setCell(ROOF_OFS + rcell).setTint(rtint);
  const ov = behindParapet ? 0 : 0.32, drop = ov * (rh / d);
  const ringSlopes = (base, top, outwardSign) => {
    // eaves: push the base ring outwards over the wall head when there is no parapet
    const eave = ov ? insetRing(base, -ov * outwardSign) || base : base, n = base.length, ye = y0 - (ov && eave !== base ? drop : 0);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = eave[i], c = eave[j], ta = top[i], tc = top[j];
      const ex = c[0] - a[0], ez = c[1] - a[1], el = Math.hypot(ex, ez); if (el < 0.05) continue;
      // outward horizontal normal of this edge = from the top edge towards the eave
      let ox = (a[0] + c[0]) / 2 - (ta[0] + tc[0]) / 2, oz = (a[1] + c[1]) / 2 - (ta[1] + tc[1]) / 2; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
      const nx = ox * rh, ny = d, nz = oz * rh, nl = Math.hypot(nx, ny, nz);
      // u along the eave so courses run level; top vertices keep their own projection
      const ua = acc / rs, uc = (acc + el) / rs, uta = (acc + ((ta[0] - a[0]) * ex + (ta[1] - a[1]) * ez) / el) / rs, utc = (acc + ((tc[0] - a[0]) * ex + (tc[1] - a[1]) * ez) / el) / rs;
      const A = rb.v(a[0], ye, a[1], nx / nl, ny / nl, nz / nl, ua, 0), B = rb.v(c[0], ye, c[1], nx / nl, ny / nl, nz / nl, uc, 0);
      const C = rb.v(tc[0], y0 + rh, tc[1], nx / nl, ny / nl, nz / nl, utc, slopeLen / rs), D = rb.v(ta[0], y0 + rh, ta[1], nx / nl, ny / nl, nz / nl, uta, slopeLen / rs);
      rb.quadFacing(A, B, C, D, nx, ny, nz);
      acc += el;
    }
  };
  ringSlopes(poly, crown.ring, 1);
  holes.forEach((hh, k) => ringSlopes(hh, crown.holes[k], 1));
  // gutter strip behind a parapet / crown: flat lead (roofscape pass: weathered, a shade darker)
  if (ROOFSCAPE) rb.setCell(ROOF_OFS + RC.lead).setTint(0.78, 0.8, 0.84); else rb.setCell(ROOF_OFS + RC.lead).setTint(0.9, 0.92, 0.96);
  flatPoly(rb, crown.ring, crown.holes, y0 + rh, RS[RC.lead]);
}

function pitchedRoof(fb, rb, o, y0, rh, shape, W, sty, rcell, rtint, seed, minH, sH) {
  const ov = 0.35, og = 0.22, drop = ov * (rh / Math.max(0.5, o.hw));
  const { cx, cz, ux, uz, vx, vz } = o, hl = o.hl, hw = o.hw;
  const P = (a, b) => [cx + ux * a + vx * b, cz + uz * a + vz * b];
  const rs = RS[rcell], ye = y0 - drop, yr = y0 + rh;
  rb.setCell(ROOF_OFS + rcell).setTint(rtint);
  const slopeLen = Math.hypot(hw + ov, rh + drop);
  if (shape === 'pyramidal' || (shape === 'hipped' && hl - hw < 0.3)) {
    const apex = [cx, cz], cs = [P(-hl - ov, -hw - ov), P(hl + ov, -hw - ov), P(hl + ov, hw + ov), P(-hl - ov, hw + ov)];
    for (let i = 0; i < 4; i++) {
      const a = cs[i], b = cs[(i + 1) % 4];
      const mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz, ml = Math.hypot(mx, mz) || 1;
      const nx = (mx / ml) * rh, ny = ml, nz = (mz / ml) * rh, nl = Math.hypot(nx, ny, nz);
      const el = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const A = rb.v(a[0], ye, a[1], nx / nl, ny / nl, nz / nl, 0, 0), B = rb.v(b[0], ye, b[1], nx / nl, ny / nl, nz / nl, el / rs, 0);
      const C = rb.v(apex[0], yr, apex[1], nx / nl, ny / nl, nz / nl, el / 2 / rs, slopeLen / rs);
      rb.triFacing(A, B, C, nx, ny, nz);
    }
    return;
  }
  const rl = shape === 'hipped' ? Math.max(0.2, hl - hw) : hl + og; // ridge half-length
  const el = hl + (shape === 'hipped' ? ov : og);                   // eave half-length
  for (const s of [1, -1]) {
    const nx = vx * s * rh, ny = hw, nz = vz * s * rh, nl = Math.hypot(nx, ny, nz);
    const e0 = P(-el, s * (hw + ov)), e1 = P(el, s * (hw + ov)), r0 = P(-rl, 0), r1 = P(rl, 0);
    const A = rb.v(e0[0], ye, e0[1], nx / nl, ny / nl, nz / nl, -el / rs, 0), B = rb.v(e1[0], ye, e1[1], nx / nl, ny / nl, nz / nl, el / rs, 0);
    const C = rb.v(r1[0], yr, r1[1], nx / nl, ny / nl, nz / nl, rl / rs, slopeLen / rs), D = rb.v(r0[0], yr, r0[1], nx / nl, ny / nl, nz / nl, -rl / rs, slopeLen / rs);
    rb.quadFacing(A, B, C, D, nx, ny, nz);
  }
  // ridge tiles (near tiles only)
  if (rl > 0.6) {
    rb.setDetail(true).setTint(rtint[0] * 0.72, rtint[1] * 0.7, rtint[2] * 0.68);
    // pass 6: a tent of two quads (4 triangles) instead of a closed box (10)
    const L = rl + (shape === 'hipped' ? 0 : 0.05);
    for (const sd of [1, -1]) {
      const nl = Math.hypot(0.14, 0.15), nxx = (vx * sd * 0.14) / nl, nyy = 0.15 / nl, nzz = (vz * sd * 0.14) / nl;
      const e0 = P(-L, sd * 0.15), e1 = P(L, sd * 0.15), t0 = P(-L, 0), t1 = P(L, 0);
      const A = rb.v(e0[0], yr - 0.07, e0[1], nxx, nyy, nzz, 0, 0), B = rb.v(e1[0], yr - 0.07, e1[1], nxx, nyy, nzz, (2 * L) / rs, 0), C = rb.v(t1[0], yr + 0.07, t1[1], nxx, nyy, nzz, (2 * L) / rs, 0.1), D = rb.v(t0[0], yr + 0.07, t0[1], nxx, nyy, nzz, 0, 0.1);
      rb.quadFacing(A, B, C, D, nxx, nyy, nzz);
    }
    rb.saved += 6;
    rb.setDetail(false).setTint(rtint);
  }
  if (shape === 'hipped') {
    for (const s of [1, -1]) {
      const nx = ux * s * rh, ny = hw, nz = uz * s * rh, nl = Math.hypot(nx, ny, nz);
      const a = P(s * el, -(hw + ov)), b = P(s * el, hw + ov), r = P(s * rl, 0);
      const A = rb.v(a[0], ye, a[1], nx / nl, ny / nl, nz / nl, -(hw + ov) / rs, 0), B = rb.v(b[0], ye, b[1], nx / nl, ny / nl, nz / nl, (hw + ov) / rs, 0);
      const C = rb.v(r[0], yr, r[1], nx / nl, ny / nl, nz / nl, 0, slopeLen / rs);
      rb.triFacing(A, B, C, nx, ny, nz);
    }
  } else {
    // gable end walls (blank cell of the wall style; rubble on a building with rubble flanks)
    fb.setCell(W.flank ?? W.blank, W.flank ?? W.blank, 0, seed).setTint(sty.tint);
    for (const s of [1, -1]) {
      const a = P(s * hl, -hw), b = P(s * hl, hw), r = P(s * hl, 0);
      const nx = ux * s, nz = uz * s;
      const A = fb.v(a[0], y0, a[1], nx, 0, nz, -hw / W.bay, (y0 - minH) / sH), B = fb.v(b[0], y0, b[1], nx, 0, nz, hw / W.bay, (y0 - minH) / sH);
      const C = fb.v(r[0], yr, r[1], nx, 0, nz, 0, (yr - minH) / sH);
      fb.triFacing(A, B, C, nx, 0, nz);
    }
  }
}

/** Dome / cone / onion / pyramid over any footprint by shrinking rings towards the centroid. */
function shrinkRoof(rb, poly, y0, rh, shape, rcell, rtint) {
  const [cx, cz] = polyCentroid(poly), rs = RS[rcell];
  rb.setCell(ROOF_OFS + rcell).setTint(rtint);
  const K = shape === 'cone' || shape === 'pyramidal' ? 1 : 5;
  const prof = (t) => {
    if (K === 1) return [1 - t, t];
    const a = (t * Math.PI) / 2;
    if (shape === 'onion') return [Math.cos(a) * (1 + 0.35 * Math.sin(t * Math.PI)), 1 - Math.cos(a)];
    return [Math.cos(a), Math.sin(a)];
  };
  let prev = null;
  const n = poly.length;
  for (let k = 0; k <= K; k++) {
    const [s, yy] = prof(k / K), row = [];
    const [s2, y2] = prof(Math.min(1, k / K + 0.05)), [s0, y0p] = prof(Math.max(0, k / K - 0.05));
    for (let i = 0; i < n; i++) {
      const p = poly[i], dx = p[0] - cx, dz = p[1] - cz, r = Math.hypot(dx, dz) || 1;
      const dr = (s2 - s0) * r, dy = (y2 - y0p) * rh;
      let hn = dy, vn = -dr; const l = Math.hypot(hn, vn) || 1; hn /= l; vn /= l;
      row.push(rb.v(cx + dx * s, y0 + yy * rh, cz + dz * s, (dx / r) * hn, vn, (dz / r) * hn, (i * 2) / rs, (yy * rh) / rs));
    }
    if (prev) for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, p = poly[i], q = poly[j];
      const mx = (p[0] + q[0]) / 2 - cx, mz = (p[1] + q[1]) / 2 - cz;
      rb.quadFacing(prev[i], prev[j], row[j], row[i], mx, Math.max(0.2, rh / 4), mz);
    }
    prev = row;
  }
}

// ---------------------------------------------------------------- city build
/** Plan every building (style, storeys, roof, party walls). Pass 7: split from the emit so the barrier planner (barriers.js) can run in between. */
export function planBuildings(ctx) {
  const { map, ov } = ctx;
  const bGrid = (ctx.buildingGrid = new SpatialGrid(50));
  const list = [];
  for (const b of map.buildings) {
    if (ov.skip.has(b.id) || b.hasParts || LANDMARK_SKIP.has(b.id) || !b.poly || b.poly.length < 3) continue;
    const bb = polyBounds(b.poly);
    const rec = { b, bb, info: { shop: false, street: '', shopKind: '' }, signs: [] };
    bGrid.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, rec);
    list.push(rec);
  }
  // shops: building tags + POIs inside footprints
  const signCands = [];
  const kindOf = (k) => (k === 'pub' || k === 'bar' || k === 'nightclub' ? 'pub' : k === 'cafe' || k === 'restaurant' || k === 'fast_food' || k === 'ice_cream' ? 'cafe' : 'shop');
  for (const rec of list) {
    const t = rec.b.tags || {};
    if ((t.shop && t.shop !== 'vacant') || SHOP_AMENITY.has(t.amenity) || t.building === 'retail' || t.building === 'pub') { rec.info.shop = true; rec.info.shopKind = t.building === 'pub' ? 'pub' : kindOf(t.amenity || ''); }
    if (t.name && ((t.shop && t.shop !== 'vacant' && t.shop !== 'mall') || SIGN_AMENITY.has(t.amenity) || t.building === 'pub')) signCands.push({ name: t.name, brand: t.brand, kind: t.shop ? 'shop:' + t.shop : t.amenity || 'pub', rec, p: rec.b.c });
  }
  for (const p of map.pois) {
    if (ov.skip.has(p.id)) continue;
    const isShop = p.kind.startsWith('shop:') && p.kind !== 'shop:vacant';
    const isAm = SIGN_AMENITY.has(p.kind);
    if (!isShop && !isAm) continue;
    let rec = null;
    bGrid.queryRadius(p.p[0], p.p[1], 2, (r) => { if (r.b.part || r.b.minH > 2) return; if (pointInPoly(p.p[0], p.p[1], r.b.poly)) { rec = r; return true; } });
    if (!rec) { // nearest footprint edge within 10 m
      let best = 10;
      bGrid.queryRadius(p.p[0], p.p[1], 10, (r) => { if (r.b.part) return; const q = r.b.poly; for (let i = 0; i < q.length; i++) { const a = q[i], c = q[(i + 1) % q.length], d = distToSeg(p.p[0], p.p[1], a[0], a[1], c[0], c[1]); if (d < best) { best = d; rec = r; } } });
    }
    if (!rec) continue;
    if (isShop || SHOP_AMENITY.has(p.kind)) { if (!rec.info.shop || !rec.info.shopKind || rec.info.shopKind === 'shop') rec.info.shopKind = rec.info.shop && rec.info.shopKind === 'shop' ? 'shop' : kindOf(p.kind); rec.info.shop = true; }
    if (p.name && !(rec.b.tags && rec.b.tags.name === p.name)) signCands.push({ name: p.name, brand: p.brand, kind: p.kind, rec, p: p.p });
  }
  // street names for style heuristics
  for (const rec of list) {
    const c = rec.b.c; let best = 28, name = '', kind = '';
    ctx.roadGrid.queryRadius(c[0], c[1], 28, (it) => { if (!it.name) return; const d = distToSeg(c[0], c[1], it.ax, it.az, it.bx, it.bz) - it.w / 2; if (d < best) { best = d; name = it.name; kind = it.kind; } });
    rec.info.street = name; rec.info.streetKind = kind;
  }
  // facts: a ground floor the list description calls a shop front or a public house (not where a place module styles the building)
  for (const rec of list) { const f = factOf(rec.b.id); if (f && !f.i && f.sf === 'no' && rec.info.shop && !ov.style.has(rec.b.id) && !LANDMARKS[rec.b.id]) rec.info.shop = false; if (f && !f.i && (f.sf === 'shop' || f.sf === 'pub') && !rec.info.shop && !ov.style.has(rec.b.id) && !LANDMARKS[rec.b.id] && !ctx.inCollege(rec.b.c[0], rec.b.c[1])) { rec.info.shop = true; rec.info.shopKind = f.sf === 'pub' ? 'pub' : 'shop'; } }
  // pass 6: plan every building first, so each wall knows what stands against it
  for (const rec of list) { rec.info.city = true; rec.pl = planBuilding(ctx, rec.b, rec.info); }
  const covering = (x, z, self, minH) => {
    let top = -1e9;
    bGrid.queryRadius(x, z, 0.6, (r) => {
      const q = r.pl;
      if (r === self || !q || q.small || q.shape === 'canopy' || q.minH > minH + 0.3 || q.wallH < 0.05 || q.wallTop <= top) return;
      if (x < r.bb.minX || x > r.bb.maxX || z < r.bb.minZ || z > r.bb.maxZ || !pointInPoly(x, z, q.poly)) return;
      for (const hh of q.holes) if (pointInPoly(x, z, hh)) return;
      top = q.wallTop;
    });
    return top;
  };
  for (const rec of list) {
    const q = rec.pl; if (!q) continue;
    const ring = q.poly, sgn = signedArea(ring) > 0 ? 1 : -1, hid = (rec.hidden = new Array(ring.length).fill(-1e9));
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const nx = (dz / len) * sgn, nz = (-dx / len) * sgn;
      // every 0.6 m along the wall, 15 cm outside it: all samples must lie inside solid neighbours
      const ns = Math.max(2, Math.ceil(len / 0.6)); let top = 1e9;
      for (let k = 0; k <= ns && top > -1e8; k++) {
        const t = Math.min(len - 0.1, Math.max(0.1, (k / ns) * len)) / len;
        top = Math.min(top, covering(a[0] + dx * t + nx * 0.15, a[1] + dz * t + nz * 0.15, rec, q.minH));
      }
      hid[i] = top;
    }
  }
  // Twin walls (z-fighting pass, 2026-11): the map draws many blocks twice — an outline and the parts inside it, two
  // records of one range — and where two footprints share an edge FACING THE SAME WAY both buildings drew their wall in
  // one plane (605 such edges, 30,000 m2 of wall). The facade shader tells two such walls apart by one of 16 hairs of
  // depth picked from their seeds, so one pair in sixteen picked the same hair and flickered, a whole wall at a time
  // (the Science Area, Christ Church's ranges, the High). Now one of the two is the wall and the other is not drawn
  // behind it: the one with a shop front or a walk-in room's openings on it, else the taller, else the first — the
  // other counts as covered up to that wall head (as a party wall is), and still closes its own wall above it.
  {
    const twins = new Map(); let nTwin = 0;
    for (let li = 0; li < list.length; li++) {
      const rec = list[li], q = rec.pl; if (!q || q.shape === 'canopy' || q.wallH < 0.05) continue;
      const ring = q.poly, sgn = signedArea(ring) > 0 ? 1 : -1;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 0.3) continue;
        const nx = (dz / len) * sgn, nz = (-dx / len) * sgn;
        const p = Math.round(a[0] * 20) + ',' + Math.round(a[1] * 20), e = Math.round(c[0] * 20) + ',' + Math.round(c[1] * 20);
        const k = (p < e ? p + ';' + e : e + ';' + p) + ';' + Math.round(nx * 3) + ',' + Math.round(nz * 3);
        let t = twins.get(k); if (!t) twins.set(k, (t = []));
        t.push({ rec, i, li });
      }
    }
    const rank = (t) => ((t.rec.pl.small ? 0 : 4) + (t.rec.info.shop || WALKIN_BAYS[t.rec.b.id] ? 2 : 0)) * 1e6 + t.rec.pl.wallTop * 100 - t.li * 1e-4;
    for (const t of twins.values()) {
      if (t.length < 2) continue;
      let win = t[0]; for (const q of t) if (rank(q) > rank(win)) win = q;
      const W = win.rec.pl;
      for (const q of t) {
        if (q === win || q.rec === win.rec || W.minH > q.rec.pl.minH + 0.3) continue;
        if (W.wallTop > q.rec.hidden[q.i]) { q.rec.hidden[q.i] = W.wallTop; nTwin++; }
        // (the top of the winner's parapet: the loser's own parapet on this edge is left out when that one covers it)
        if (W.pH > 0) (q.rec.hidden.twinTop || (q.rec.hidden.twinTop = []))[q.i] = W.wallTop + W.pH;
      }
    }
    ctx.stats.twinWalls = nTwin;
  }
  ctx.buildingPlan = { list, signCands };
}
export function buildBuildings(ctx) {
  if (!ctx.buildingPlan) planBuildings(ctx);
  const { batch } = ctx, { list, signCands } = ctx.buildingPlan;
  // emit
  const lmUsed = [];
  for (const rec of list) {
    const b = rec.b, x = rec.b.c[0], z = rec.b.c[1];
    const out = { facade: batch.buf('facade', x, z), roof: batch.buf('roof', x, z), parapet: batch.buf('parapet', x, z), crenel: batch.buf('crenel', x, z) };
    const res = rec.pl ? emitBuilding(ctx, b, out, rec.info, rec.pl, rec.hidden, true) : null;
    rec.res = res;
    if (res) res.stand = batch.anchors ? batch.anchors.get(x + ',' + z) : undefined;      // (terrain: the level a sloping building stands at; what is fixed to its walls in another mesh takes it too - terrainStandY)
    if (res && LANDMARKS[b.id]) lmUsed.push(b.id);
    if (res && (b.minH || 0) < 0.5 && ctx.batch.has('aoStrip') && (rec.info.area || 0) > 45) aoStrip(batch.buf('aoStrip', x, z), res.poly);
  }
  staticExtras(ctx, list);
  ctx.stats.landmarks = lmUsed;
  const walls = {}, shapes = {};
  let shops = 0, cren = 0;
  for (const r of list) if (r.res) { walls[r.res.sty.wall] = (walls[r.res.sty.wall] || 0) + 1; shapes[r.res.shape] = (shapes[r.res.shape] || 0) + 1; if (r.info.shop) shops++; if (r.res.crenel) cren++; }
  ctx.stats.walls = walls; ctx.stats.roofShapes = shapes; ctx.stats.shopBuildings = shops; ctx.stats.battlemented = cren;
  ctx.buildingRecs = list;
  buildSigns(ctx, signCands);
}

/**
 * Pass 6: the larger projections, static in the near tiles (they would pop if switched by distance): bay windows,
 * gables on the eaves line, awnings, hanging signs, buttresses. Each is only built while its tile still holds
 * triangles saved elsewhere (party walls, back walls, ridges) beyond the share kept for the dynamic depth.
 */
function staticExtras(ctx, list) {
  const st = { bays: 0, gablets: 0, awnings: 0, hanging: 0, buttresses: 0, oriels: 0 };
  const can = (fb, cost) => fb.saved - fb.spent - cost >= 0;
  for (const pass of ['bay', 'gablet', 'awning', 'sign', 'buttress']) for (const rec of list) {
    const res = rec.res; if (!res) continue;
    const fb = ctx.batch.buf('facade', rec.b.c[0], rec.b.c[1]), sty = res.sty, W = res.W, minH = res.minH, sH = res.storeyH;
    fb.setDetail(1).setTop();
    if (pass === 'buttress') {
      for (const E of res.edges) {
        if (!E.buttress) continue;
        const nb = E.buttress.nb; if (!can(fb, (nb + 1) * 8)) continue;
        fb.setCell(W.blank, W.blank, 0, res.seed).setTint(sty.tint);
        for (let k = 0; k <= nb; k++) buttress(fb, E, Math.min(E.len - 0.35, Math.max(0.35, (k / nb) * E.len)), minH, E.buttress.y1, 0.64, 0.5);
        fb.spent += (nb + 1) * 8; st.buttresses += nb + 1;
      }
      continue;
    }
    for (const U of res.units) {
      if (U.open) continue;   // quad-facing walls: no static extras (their ledger is pass 7's, see emitBuilding)
      const E = U.E, wd = U.sB - U.sA, h2 = hash01(res.id + pass + E.u0 + '_' + U.un);
      if (pass === 'bay' && U.oriel && (can(fb, 10) || U.force)) {
        const B = U.oriel, R = B.rows || 1, c = B.s + U.bw / 2, wf = 0.5 * U.bw, sp = Math.min(0.5, (0.96 * U.bw - wf) / 2), half = wf / 2 + sp, yA = minH + sH + 0.12, yB = minH + sH * (1 + R);
        fb.setCell(B.cell, B.cell, 0, U.useed).setTint(U.tint);
        bayWindow(fb, E, c - half, c + half, yA, yB, E.u0 + B.bi, 1 + 0.12 / sH, R - 0.12 / sH, sp, sp);
        fb.setCell(F.stoneBand, undefined, 0, res.seed).setTint(U.tint[0] * 0.9, U.tint[1] * 0.9, U.tint[2] * 0.9);
        bayUnder(fb, E, c - half, c + half, yA, sp, sp);
        fb.setCell(ROOF_OFS + RC.lead).setTint(0.9, 0.92, 0.96);
        bayTop(fb, E, c - half, c + half, yB, sp, sp);
        fb.spent += 10; st.oriels++; B.built = true;
      } else if (pass === 'bay' && U.bay && can(fb, 8)) {
        const B = U.bay, c = B.s + U.bw / 2, wf = 0.48 * U.bw, sp = Math.min(0.6, (0.96 * U.bw - wf) / 2), half = wf / 2 + sp, yB = minH + sH * B.rows;
        fb.setCell(B.cell, B.cell, -1, U.useed).setTint(U.tint);
        bayWindow(fb, E, c - half, c + half, minH, yB, E.u0 + B.bi, 0, B.rows, sp, sp);
        fb.setCell(ROOF_OFS + RC.lead).setTint(0.9, 0.92, 0.96);
        bayTop(fb, E, c - half, c + half, yB, sp, sp);
        fb.spent += 8; st.bays++; B.built = true;
      } else if (pass === 'gablet' && !res.dormers && res.roofH >= 1.3 && wd >= 3 && can(fb, 5)) {
        const eave = res.shape === 'crown' ? !res.crownParapet : res.shape === 'gabled' && Math.abs(E.rx * res.o.ux + E.rz * res.o.uz) > 0.9;
        const pr = U.kind === 'shop' ? 0.34 : U.kind === 'town' ? 0.26 : sty.zone === 'north' ? 0.42 : sty.zone === 'jericho' ? 0.1 : 0.18;
        if (!eave || h2 > pr) continue;
        const run = res.shape === 'crown' ? res.crown.d : res.o.hw, gw = Math.max(1.9, Math.min(wd * 0.62, 3.7)), gh = Math.min(gw * 0.56, res.roofH * 0.9), depth = (gh / res.roofH) * run;
        fb.setCell(W.blank, W.blank, 0, U.useed).setTint(U.tint).setTop(res.wallTop + gh);
        gabletFront(fb, E, (U.sA + U.sB) / 2, res.wallTop, gw, gh, W.bay, sH);
        fb.setTop().setCell(res.roofCell).setTint(res.rtint);
        gabletRoof(fb, E, (U.sA + U.sB) / 2, res.wallTop, gw, gh, depth, res.rs);
        fb.spent += 5; st.gablets++;
      } else if (pass === 'awning' && U.kind === 'shop' && wd >= 2.6 && can(fb, 6)) {
        if (h2 > (U.shop === F.cafeFront ? 0.5 : U.shop === F.shopA ? 0.26 : U.shop === F.shopB ? 0.12 : 0)) continue;
        fb.setCell(F.awning, F.awning, -1, U.useed).setTint(1, 1, 1);
        awning(fb, E, U.sA + 0.22, U.sB - 0.22, minH + sH * 0.8, 1.15, 0.36);
        fb.spent += 6; st.awnings++; U.awning = true;
      } else if (pass === 'sign' && U.kind === 'shop' && res.n >= 2 && !U.awning && can(fb, 4)) {
        if (h2 > (U.shop === F.pubFront ? 0.9 : 0.24)) continue;
        // pass 7: the board carries a painted device (signBoard cell: star, bell, anchor, rose) in the unit's own colour
        fb.setCell(F.signBoard, F.signBoard, -1, U.useed).setTint(1, 1, 1);
        hangingSign(fb, E, U.sA + 0.3, U.yF + 0.5, U.yF + 1.12, 0.1, 0.82, Math.floor(hash01(res.id + 'dev' + E.u0 + '_' + U.un) * 4) % 4);
        fb.spent += 4; st.hanging++; U.hang = true;
      }
    }
  }
  // what the tiles saved and spent (triangles in the near tiles)
  let saved = 0, spent = 0, dynUnits = 0;
  for (const L of [ctx.batch.layers.get('facade')]) for (const fb of L.bufs.values()) { saved += fb.saved; spent += fb.spent; dynUnits += fb.dyn ? fb.dyn.length : 0; }
  ctx.stats.pass6 = { ...st, savedNearTris: saved, staticSpentTris: spent, dynUnits };
  ctx.pass6Bufs = [...ctx.batch.layers.get('facade').bufs.values()];
}

/** Contact shadow on the ground round a footprint: a 1.5 m strip, dark at the wall fading out (multiply-blended). */
function aoStrip(buf, poly) {
  const n = poly.length, sg = signedArea(poly) > 0 ? 1 : -1, W = 1.5, Yy = 0.135;
  let first = -1, prevIn = -1, prevOut = -1;
  for (let k = 0; k <= n; k++) {
    const i = k % n, a = poly[(i - 1 + n) % n], p = poly[i], c = poly[(i + 1) % n];
    let d1x = p[0] - a[0], d1z = p[1] - a[1], d2x = c[0] - p[0], d2z = c[1] - p[1];
    const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1; d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
    // outward normals (right of travel for a CCW ring in x/z with this winding sign)
    let mx = (d1z + d2z) * sg, mz = -(d1x + d2x) * sg; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const cos = Math.max(0.35, mx * d1z * sg - mz * d1x * sg), m = Math.min(2.2, 1 / cos);
    let iIn, iOut;
    if (k === n) { iIn = first; iOut = first + 1; }
    else {
      buf.setColor(0.42, 0.42, 0.44); iIn = buf.v(p[0], Yy, p[1], 0, 1, 0, 0, 0);
      buf.setColor(1, 1, 1); iOut = buf.v(p[0] + mx * W * m, Yy, p[1] + mz * W * m, 0, 1, 0, 0, 1);
      if (first < 0) first = iIn;
    }
    if (prevIn >= 0) buf.quadFacing(prevIn, iIn, iOut, prevOut, 0, 1, 0);
    prevIn = iIn; prevOut = iOut;
  }
}

// ---------------------------------------------------------------- shop signs + street-name plaques
// street-name plates whose first spot is not clear (tools/smoke_plaques.mjs --fix: something drawn in front of the wall
// there): "name@x,z" of that first spot -> [metres along the wall, metres up], or null to leave that plate out
const PLAQUE_MOVE = {
  "South Street@-880,518": [1.25, 0.4], "Venneit Close@-861,-268": [0.25, 0], "Leckford Place@-454,-850": [0.25, 0],
  "Nelson Street@-452,-213": [-0.25, 0], "Walton Crescent@-443,-212": [0.25, 0], "Hythe Bridge Street@-259,143": null,
  "Little Clarendon Street@-233,-318": [-0.25, 0], "Paradise Square@-202,566": [0.25, -0.8], "Wellington Square@-170,-252": [2, 0.4],
  "Beaumont Buildings@-162,-125": [0.25, -0.8], "Beaumont Place@-157,-131": [1.75, 0.4], "Woodstock Road@-157,-663": [0.25, 0],
  "Paradise Street@-129,454": [-0.5, -0.8], "St John Street@-91,-9": [1.5, 0], "Church Lane@-89,472": [-0.25, -0.8],
  "Gloucester Street@-82,12": [2, 0], "Woodstock Road@-75,-508": [0.25, 0], "South Arcade@-62,523": [-0.25, -0.8],
  "Castle Street@-55,388": [0.25, 0], "Banbury Road@-53,-1172": [-0.25, -0.4], "Faulkner Street@-15,631": [0.25, 0],
  "Banbury Road@-12,-471": [-0.5, 0], "Littlegate Street@36,625": [1.75, 0], "Albion Place@39,628": [-1.5, 0.4],
  "Magdalen Street@63,75": [1.5, 1.2], "Cambridge Terrace@82,656": [-0.5, 0], "Cornmarket Street@85,107": [0.25, -0.8],
  "Broad Street@102,95": [0.25, -0.8], "High Street@162,321": [0.25, -0.8], "St Aldate's@227,693": [1, 1.2],
  "Ship Street@236,119": [-0.25, -0.8], "Turl Street@281,297": [-0.25, 0.8], "Broad Street@314,42": [1.25, 1.2],
  "Broad Street@368,9": [-0.25, -0.8], "Holywell Street@388,-2": [-0.25, -0.8], "Catte Street@392,12": [1.75, 0.4],
  "New College Lane@414,51": [-0.25, 0], "Catte Street@433,122": [0.25, -0.8], "Radcliffe Square@450,209": [0.75, 0],
  "Holywell Street@452,-3": [0.25, 0], "New College Lane@470,63": [-1.75, 0], "Magpie Lane@482,409": [1, 0],
  "Mansfield Road@576,-8": [0.25, 0.4], "Mansfield Road@579,-131": null, "Holywell Street@582,-2": [-1.25, 0.4],
  "St Cross Road@654,-491": [1.5, 0], "Queen's Lane@666,199": [0.25, 0], "Holywell Street@744,34": [-0.25, -0.8],
  "Rose Lane@822,323": [-0.25, -0.8], "St Clements Street@1284,507": [0.25, 0.8],
};
// roofscape pass: plates whose first spot is now over a recessed window (smoke_plaques --fix)
if (ROOFSCAPE) Object.assign(PLAQUE_MOVE, { "Catte Street@433,122": [0.5, 0], "St Clements Street@1284,507": [0.5, 0] });   // (Hertford's and a St Clement's front now have a different window rhythm: the first spot is over a window)
// houses pass: a plate whose first spot is now over a window of a re-planned terrace (smoke_plaques --fix)
if (HOUSES) Object.assign(PLAQUE_MOVE, { "Stockmore Street@1387,719": [0.25, 0] });
/**
 * Street-name plates on clear wall: what is cut into or stands out of the street wall `e` of a built front between
 * heights y0 and y1 — window and door openings with their sills and hoods, bay windows and oriels, the floor band,
 * shop fascias and awnings, downpipes, hanging signs — as spans [s0, s1] in metres along the edge from its (ax, az) end.
 * From the same figures the emitter draws them with (emitBuilding's units, facadedetail.js WIN); a wall with no
 * modelled front (a flat far wall, a hand-built front) has none.
 */
function plateBlocks(res, e, y0, y1) {
  const out = [], minH = res.minH || 0, sH = res.storeyH, dx = (e.bx - e.ax) / e.len, dz = (e.bz - e.az) / e.len;
  const fl = dx * e.rx + dz * e.rz < 0, tOf = (s) => (fl ? e.len - s : s);   // (the units count from the wall's left end as one faces it)
  const put = (sa, sb, ya, yb) => { if (ya < y1 && yb > y0) { const a = tOf(sa), b = tOf(sb); out.push(a < b ? [a, b] : [b, a]); } };
  for (const U of res.units) {
    if (U.E !== e) continue;
    const yF = minH + sH, shop = U.kind === 'shop';
    // the floor band: the cornice over a shop's fascia, a stone or stucco front's string course, a jetty's bressumer
    if (shop || e.jet) put(U.sA, U.sB, yF - 0.16, yF + 0.12);
    else if ((res.sty.wall === 'stone' || res.sty.wall === 'college' || res.sty.wall === 'render') && res.n >= 2) put(U.sA, U.sB, yF - 0.07, yF + 0.12);
    if (shop && U.hasG) put(U.sA, U.sB, minH, yF);                           // the shop front and its board
    if (U.awning) put(U.sA, U.sB, minH + sH * 0.8 - 0.6, minH + sH * 0.8 + 0.06);
    if (U.hang) put(U.sA + 0.2, U.sA + 0.4, U.yF + 0.4, U.yF + 1.2);
    if (U.pipe) put(U.sB - 0.1, U.sB + 0.1, minH + (shop ? sH + 0.12 : 0.15), res.wallTop);
    if (U.oriel) put(U.oriel.s - 0.05, U.oriel.s + U.bw + 0.05, yF - 0.3, yF + sH * (U.oriel.rows || 1) + 0.6);
    if (U.bay) put(U.bay.s - 0.05, U.bay.s + U.bw + 0.05, minH, minH + sH * U.bay.rows + 0.5);
    const nSt = (U.hasG ? 1 : 0) + U.ups.length;
    for (let st = 0; st < nSt; st++) {
      const yA = minH + st * sH; if (yA >= y1 || yA + sH <= y0) continue;
      for (let bi = U.b0; bi < U.b1; bi++) {
        const sp = WIN[U.hasG && st === 0 ? U.gC(bi) : U.ups[st - (U.hasG ? 1 : 0)]]; if (!sp) continue;
        const x0 = U.sA + (bi - U.b0) * U.bw, pad = sp.door ? (res.sty.st.villa ? 0.6 : 0.2) : 0.05 * U.bw + 0.02;
        put(x0 + sp.x[0][0] * U.bw - pad, x0 + sp.x[sp.x.length - 1][1] * U.bw + pad, yA + sH * (1 - sp.b) - (sp.sill ? sH * 0.033 + 0.01 : 0), yA + sH * (1 - sp.t) + (sp.door ? (res.sty.st.villa ? 1.6 : 0.2) : 0.02));
      }
    }
  }
  return out;
}
// ... and with the building facts on (world/_bfacts.js): plates on fronts the facts restyled whose clear spot the rule
// below cannot know — something a place module builds stands in front of that wall (smoke_plaques --fix)
const PLAQUE_FACT = BFACTS_ON ? { "South Street@-880,518": [2.5, 0.8], "Tyndale Road@1277,573": [-1, -0.4] } : {};
// Fascia colours by trade name: plain lettering in a generic face on a painted board (no logos or trade dress).
const PALETTE = [['#0f2a1d', '#d9b45a'], ['#1a2240', '#e8dcc0'], ['#4a1218', '#e8c870'], ['#111111', '#f0e6c8'], ['#efe8d8', '#1d2a3a'], ['#2c4a52', '#f2ead8'], ['#5a4632', '#f3e3c0'], ['#ffffff', '#222222'], ['#3a2a4a', '#efe0c0']];
// invented, generic trade names for unnamed shop units (no real business is meant)
const GENERIC = ['Newsagent', 'Barber', 'Dry Cleaners', 'Bakery', 'The Sandwich Shop', 'Shoe Repairs & Keys', 'Florist', 'Greengrocer', 'Ironmonger', 'Second-hand Books', 'Stationers', 'Gifts & Cards', 'Gentlemen’s Outfitter', 'Tea Rooms', 'Fish & Chips', 'Off Licence', 'Hair & Beauty', 'Launderette', 'Picture Framing', 'Antiques', 'Art Supplies', 'Cycle Shop', 'Travel Agent', 'Opticians', 'Chemist', 'Jeweller', 'Watch Repairs', 'Souvenirs', 'Record Shop', 'Delicatessen', 'Butcher', 'Tailoring & Alterations', 'Estate Agents', 'Coffee House', 'Print & Copy', 'Charity Shop', 'Hardware', 'Toys & Games', 'Sweet Shop', 'Maps & Prints'];
/** the texts of the last world build's shop signs and street plaques (read by tools/audit_brands.mjs) */
export const signLog = { names: [], plaques: [], plaqueAt: [] };      // (plaqueAt: where each street plaque went, {name, x, y, z, nx, nz, w}: tools/smoke_plaques.mjs)
// The real names (the default): a chain's fascia gets its board / lettering colours (plain painted text in a generic
// face, no logo or artwork). Under ?invented=1 (world/tradenames.js renames every business) no brand colours are used.
const BRANDS = [
  [/tesco/i, '#ffffff', '#00539f', '#ee1c2e'], [/sainsbury/i, '#f06c00', '#ffffff'], [/boots/i, '#003c8f', '#ffffff'], [/pret/i, '#862633', '#ffffff'],
  [/costa/i, '#6d1f37', '#ffffff'], [/starbucks/i, '#00704a', '#ffffff'], [/caff[eè] nero|nero/i, '#1a2b4a', '#ffffff'], [/mcdonald/i, '#da291c', '#ffc72c'],
  [/burger king/i, '#d62300', '#f5ebdc'], [/greggs/i, '#00579e', '#ffb81c'], [/waterstones/i, '#1a1a1a', '#ffffff'], [/blackwell/i, '#13294b', '#d4b26a'],
  [/hsbc/i, '#ffffff', '#db0011'], [/barclays/i, '#00aeef', '#ffffff'], [/lloyds/i, '#006a4d', '#ffffff'], [/natwest/i, '#5a287d', '#ffffff'],
  [/santander/i, '#ec0000', '#ffffff'], [/co-?op/i, '#00b1e7', '#ffffff'], [/marks|m&s/i, '#1d1d1b', '#c8e6a0'], [/whsmith|wh smith/i, '#1b2a5c', '#ffffff'],
  [/superdrug/i, '#e5007e', '#ffffff'], [/subway/i, '#00843d', '#ffc20e'], [/kfc/i, '#a3080c', '#ffffff'], [/domino/i, '#006491', '#ffffff'],
  [/pizza express/i, '#111111', '#ffffff'], [/wagamama/i, '#111111', '#ffffff'], [/nando/i, '#111111', '#e8202a'], [/five guys/i, '#d21033', '#ffffff'],
  [/primark/i, '#0dafe5', '#ffffff'], [/h ?& ?m/i, '#ffffff', '#e50010'], [/zara/i, '#111111', '#ffffff'], [/^next$/i, '#111111', '#ffffff'],
  [/gap/i, '#002a5c', '#ffffff'], [/lush/i, '#111111', '#ffffff'], [/^o2\b/i, '#032b5a', '#ffffff'], [/vodafone/i, '#e60000', '#ffffff'],
  [/^ee$/i, '#00a1a1', '#ffffff'], [/paperchase/i, '#ffffff', '#111111'], [/oxfam/i, '#61a534', '#ffffff'], [/cancer research/i, '#2e008b', '#ffffff'],
  [/post office/i, '#e2001a', '#ffd200'], [/itsu/i, '#e2006a', '#ffffff'], [/leon/i, '#111111', '#e8c547'], [/ryman/i, '#e30613', '#ffffff'],
];
function signStyle(name, brand, kind, h) {
  if (!inventedNames()) {
    const s = (brand || '') + ' ' + name;
    for (const [re, bg, fg, ul] of BRANDS) if (re.test(s)) return { bg, fg, underline: ul, font: 'Helvetica, Arial, sans-serif' };
  }
  if (kind === 'pub' || kind === 'bar') return { bg: pick([['#0f2a1d'], ['#3a0c10'], ['#111111'], ['#1a2240']], h)[0], fg: '#d9b45a' };
  const [bg, fg] = pick(PALETTE, h);
  return { bg, fg, font: h < 0.4 ? 'Georgia, serif' : h < 0.7 ? 'Helvetica, Arial, sans-serif' : '"Palatino Linotype", Palatino, serif' };
}

function buildSigns(ctx, cands) {
  const CARFAX = [130, 335];
  cands.sort((a, b) => Math.hypot(a.p[0] - CARFAX[0], a.p[1] - CARFAX[1]) - Math.hypot(b.p[0] - CARFAX[0], b.p[1] - CARFAX[1]));
  const PLAQUE_MAX = 200, per = SIGN_COLS * SIGN_ROWS - PLAQUE_MAX;   // one atlas page (one draw) for shop names and street plaques
  // ---- quads: {slot key, e, t (m along a->b), w max, y, h, off}
  const slots = new Map(), slotList = [], quads = [];
  const slotFor = (key, def) => { let s = slots.get(key); if (!s) { s = { ...def, i: slotList.length }; slots.set(key, s); slotList.push(s); } return s; };
  const used = new Map(); // edge -> [[t0,t1]]
  const claim = (e, t, w) => {
    let iv = used.get(e); if (!iv) used.set(e, (iv = []));
    t = Math.max(w / 2 + 0.15, Math.min(e.len - w / 2 - 0.15, t));
    for (let k = 0; k < 4 && iv.some(([a, b]) => t + w / 2 > a && t - w / 2 < b); k++) t = Math.min(e.len - w / 2 - 0.15, iv.reduce((m, [a, b]) => Math.max(m, b), 0) + w / 2 + 0.3);
    if (iv.some(([a, b]) => t + w / 2 > a && t - w / 2 < b) || t - w / 2 < 0) return null;
    iv.push([t - w / 2, t + w / 2]);
    return t;
  };
  const NAMED_MAX = per - GENERIC.length;
  let named = 0;
  const unitTaken = new Set();
  for (const c of cands) {
    if (named >= NAMED_MAX) break;
    const res = c.rec.res; if (!res || !res.edges.length) continue;
    // choose the edge: near the POI, preferring street-facing
    let best = null, bs = Infinity;
    for (const e of res.edges) {
      if (e.len < 2.2 || e.covered) continue;
      const d = distToSeg(c.p[0], c.p[1], e.ax, e.az, e.bx, e.bz) + (e.street ? 0 : 8);
      if (d < bs) { bs = d; best = e; }
    }
    if (!best) continue;
    const e = best, dx = (e.bx - e.ax) / e.len, dz = (e.bz - e.az) / e.len;
    let t = (c.p[0] - e.ax) * dx + (c.p[1] - e.az) * dz, wmax = 7.5;
    // snap to the shop unit the POI sits in, so the name is centred on that unit's fascia
    const P = e.plan;
    if (P && P.kind === 'shop' && P.units > 0) {
      const uw = e.len / P.units; let un = Math.max(0, Math.min(P.units - 1, Math.floor(t / uw)));
      for (let k = 0; k < P.units && unitTaken.has(e.u0 + ':' + res.id + ':' + res.edges.indexOf(e) + ':' + un); k++) un = (un + 1) % P.units;
      unitTaken.add(e.u0 + ':' + res.id + ':' + res.edges.indexOf(e) + ':' + un);
      t = (un + 0.5) * uw; wmax = Math.max(1.2, uw - 0.5);
    }
    const style = signStyle(c.name, c.brand, c.kind, hash01(c.name));
    const text = c.name.length > 34 ? c.name.slice(0, 33) + '…' : c.name;
    const slot = slotFor('n' + text + style.bg, { text, bg: style.bg, fg: style.fg, underline: style.underline, font: style.font });
    quads.push({ slot, e, t, wmax, res, fascia: true });
    named++;
  }
  // generic names on the other units of shop fronts (two thirds of them; the rest keep a plain painted fascia)
  for (const rec of ctx.buildingRecs) {
    const res = rec.res; if (!res || !rec.info.shop) continue;
    res.edges.forEach((e, ei) => {
      const P = e.plan; if (!P || P.kind !== 'shop') return;
      const uw = e.len / P.units; if (uw < 2.6) return;
      for (let un = 0; un < P.units; un++) {
        if (unitTaken.has(e.u0 + ':' + res.id + ':' + ei + ':' + un)) continue;
        const h = hash01(res.id + 'g' + ei + '_' + un); if (h > 0.66) continue;
        const name = P.shop[un] === F.pubFront ? null : P.shop[un] === F.cafeFront ? pick(['Tea Rooms', 'Coffee House', 'The Sandwich Shop', 'Bakery', 'Fish & Chips', 'Delicatessen'], h * 1.5) : pick(GENERIC, h * 1.5);
        if (!name) continue;
        const [bg, fg] = pick(PALETTE, hash01(name + (un % 3)));
        const slot = slotFor('g' + name + bg, { text: name, bg, fg, font: h < 0.3 ? 'Georgia, serif' : 'Helvetica, Arial, sans-serif' });
        if (slot.i >= per) continue;
        // a→b parameter of the unit centre (units are counted from the viewer's left)
        const sL = (un + 0.5) * uw, flip = e.lx !== e.ax || e.lz !== e.az;
        quads.push({ slot, e, t: flip ? e.len - sL : sL, wmax: Math.max(1.2, uw - 0.6), res, fascia: true });
      }
    });
  }
  // ---- street-name plaques: white plates, black capitals, on a wall near each end of every named street
  const plaques = [];
  const seenRoad = new Map();
  for (const r of ctx.map.roads) {
    if (!r.name || !r._pts || r._pts.length < 2 || ctx.ov.skip.has(r.id)) continue;
    if (!['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'pedestrian'].includes(r.kind)) continue;
    const pts = r._pts;
    for (const end of [0, 1]) {
      const p = end ? pts[pts.length - 1] : pts[0], q = end ? pts[pts.length - 2] : pts[1];
      const dl = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, px = p[0] + ((q[0] - p[0]) / dl) * Math.min(9, dl * 0.5), pz = p[1] + ((q[1] - p[1]) / dl) * Math.min(9, dl * 0.5);
      // one plaque per ~60 m of a name
      const key = r.name; let arr = seenRoad.get(key); if (!arr) seenRoad.set(key, (arr = []));
      if (arr.some(([x, z]) => Math.hypot(x - px, z - pz) < 60)) continue;
      let best = null, bd = 16;
      ctx.buildingGrid.queryRadius(px, pz, 16, (rec) => {
        const res = rec.res; if (!res || res.minH > 0.5 || res.wallTop < 4) return;
        for (const e of res.edges) {
          if (!e.street || e.len < 3) continue;
          const d = distToSeg(px, pz, e.ax, e.az, e.bx, e.bz);
          // the wall must face this street: the point lies on its outer side
          if (d < bd && (px - e.ax) * e.nx + (pz - e.az) * e.nz > 0.5) { bd = d; best = { e, res }; }
        }
      });
      if (!best) continue;
      arr.push([px, pz]);
      const e = best.e, dx = (e.bx - e.ax) / e.len, dz = (e.bz - e.az) / e.len;
      plaques.push({ name: r.name, e, t: (px - e.ax) * dx + (pz - e.az) * dz, res: best.res });
    }
  }
  const plaqueSlots = new Map(), plaqueList = [];
  plaques.sort((a, b) => Math.hypot(a.e.ax - CARFAX[0], a.e.az - CARFAX[1]) - Math.hypot(b.e.ax - CARFAX[0], b.e.az - CARFAX[1]));
  for (const p of plaques) {
    if (!plaqueSlots.has(p.name)) { if (plaqueList.length >= PLAQUE_MAX) continue; plaqueSlots.set(p.name, plaqueList.length); plaqueList.push({ text: p.name.toUpperCase(), bg: '#f3f2ec', fg: '#141414', font: '"Gill Sans", "Gill Sans MT", Helvetica, Arial, sans-serif', border: '#141414' }); }
  }

  ctx.signMeshes = [];
  // (A: the building's level, res.stand: the board keeps its place on a wall that stands level on sloping ground)
  const quad = (buf, atlas, i, e, t, w, y, SH, off, A) => {
    const dx = (e.bx - e.ax) / e.len, dz = (e.bz - e.az) / e.len;
    const cx = e.ax + dx * t + e.nx * off, cz = e.az + dz * t + e.nz * off;
    const rx = e.nz, rz = -e.nx; // viewer's right when facing the wall
    const [u0, v0, u1, v1] = atlas.uv(i);
    const sl = terrainStandY(A, cx - rx * w / 2, cz - rz * w / 2), sr = terrainStandY(A, cx + rx * w / 2, cz + rz * w / 2);
    const a = buf.v(cx - rx * w / 2, y - SH / 2 + sl, cz - rz * w / 2, e.nx, 0, e.nz, u0, v0);
    const b = buf.v(cx + rx * w / 2, y - SH / 2 + sr, cz + rz * w / 2, e.nx, 0, e.nz, u1, v0);
    const cc = buf.v(cx + rx * w / 2, y + SH / 2 + sr, cz + rz * w / 2, e.nx, 0, e.nz, u1, v1);
    const d = buf.v(cx - rx * w / 2, y + SH / 2 + sl, cz - rz * w / 2, e.nx, 0, e.nz, u0, v1);
    buf.quadFacing(a, b, cc, d, e.nx, 0, e.nz);
  };
  const shopSlots = slotList.slice(0, per), all = shopSlots.concat(plaqueList);
  if (all.length) {
    const atlas = makeSignAtlas(all);
    const buf = new GeoBuf();
    for (const q of quads) {
      if (q.slot.i >= per) continue;
      const res = q.res, shopFront = q.e.plan && q.e.plan.kind === 'shop';
      // on a planned shopfront the board sits on the fascia (top fifth of the ground storey)
      const sHc = res.sH, SH0 = shopFront ? Math.min(0.5, sHc * 0.15) : 0.55;
      const y = (res.minH || 0) + (shopFront ? sHc * 0.9 : Math.max(2.6, Math.min(4.2, sHc)) - 0.38);
      const aspect = atlas.aspect(q.slot.i), w = Math.min(q.e.len - 0.3, q.wmax, Math.max(1.2, aspect * SH0));
      const t = claim(q.e, q.t, w); if (t === null) continue;
      quad(buf, atlas, q.slot.i, q.e, t, w, y, Math.min(SH0, Math.max(0.28, w / aspect)), 0.07, res.stand);
    }
    const usedP = new Map(), plaqueAt = (signLog.plaqueAt = []);
    for (const p of plaques) {
      const pi = plaqueSlots.get(p.name); if (pi === undefined) continue;
      const i = shopSlots.length + pi, SH = 0.3, w = Math.min(p.e.len - 0.4, atlas.aspect(i) * SH);
      if (w < 0.8) continue;
      let iv = usedP.get(p.e); if (!iv) usedP.set(p.e, (iv = []));
      let t = Math.max(w / 2 + 0.3, Math.min(p.e.len - w / 2 - 0.3, p.t));
      // (moved along its wall / up or down off something drawn in front of it - a pier, a string course, a shopfront, a
      // rebuilt landmark front - or left out where its wall has no clear spot: PLAQUE_MOVE, from tools/smoke_plaques.mjs)
      const key = `${p.name}@${Math.round(p.e.ax + (p.e.bx - p.e.ax) / p.e.len * t)},${Math.round(p.e.az + (p.e.bz - p.e.az) / p.e.len * t)}`, mv = key in PLAQUE_FACT ? PLAQUE_FACT[key] : PLAQUE_MOVE[key];
      if (mv === null) continue;
      const tFirst = t;
      if (mv) t = Math.max(w / 2 + 0.3, Math.min(p.e.len - w / 2 - 0.3, t + mv[0]));
      // The general rule (2026-11, building facts): the plate goes on clear wall. Its spot is checked against the front
      // as it is drawn (plateBlocks) and, where an opening, a sill, a bay or a band is in the way, moved along the wall
      // to the nearest clear spot — at its own height first, then just under the floor band, then higher between the
      // first-floor windows — or left out where the wall has none. A PLAQUE_MOVE entry stands as tested, except on a
      // front the facts table restyled after that entry was made.
      let yBase = (p.res.minH || 0) + Math.min(p.res.hasGround ? p.res.sH + 0.32 : 2.7, p.res.wallTop - 0.4);
      // (terrain: a building that stands level on a steep site is cut into the hill on its high side - there the wall
      //  stands that much lower over the pavement, and a plate at its usual height on the wall would be at knee height or
      //  under the ground. It goes 2.6 m over the pavement instead, or is left out where the wall is not that tall)
      { const so = terrainStandY(p.res.stand, p.e.ax + (p.e.bx - p.e.ax) / p.e.len * t, p.e.az + (p.e.bz - p.e.az) / p.e.len * t);
        if (yBase + so < 2.3) { yBase = 2.6 - so; if (yBase > p.res.wallTop - 0.4) continue; } }
      let dyR = 0;
      if (p.res.units && p.res.units.length && !(key in PLAQUE_FACT) && (!mv || p.res.sty.st.fact)) {
        const t0 = t, lo = w / 2 + 0.3, hi = p.e.len - w / 2 - 0.3, y0m = yBase + (mv ? mv[1] : 0);
        let found = false;
        for (const dy of [0, -0.62, 0.45, -1.0]) {
          const yc = y0m + dy; if (yc + SH / 2 > p.res.wallTop - 0.2 || yc - SH / 2 < (p.res.minH || 0) + 2.1) continue;
          const bl = plateBlocks(p.res, p.e, yc - SH / 2 - 0.02, yc + SH / 2 + 0.02);
          const clear = (tt) => tt >= lo && tt <= hi && !bl.some(([a, b]) => tt + w / 2 + 0.06 > a && tt - w / 2 - 0.06 < b) && !iv.some(([a, b]) => tt + w / 2 > a && tt - w / 2 < b);
          for (let k = 0; k <= 40 && !found; k++) for (const sgn of k ? [1, -1] : [1]) { const tt = t0 + sgn * k * 0.25; if (clear(tt)) { t = tt; dyR = dy; found = true; break; } }
          if (found) break;
        }
        if (!found) continue;
      }
      if (iv.some(([a, b]) => t + w / 2 > a && t - w / 2 < b)) continue;
      iv.push([t - w / 2, t + w / 2]);
      // above the ground-floor openings, just over the first-floor string course (or under the eaves of a low wall)
      const y = yBase + (mv ? mv[1] : 0) + dyR;
      const off = 0.05 + (p.e.jet && y - SH / 2 > p.e.jetY ? p.e.jet : 0);   // on a jettied timber front, on the jetty
      quad(buf, atlas, i, p.e, t, w, y, SH, off, p.res.stand);
      // (y: where the plate is DRAWN - on a building that stands level, its wall's offset at the plate; yWall: its height on the wall)
      const pxw = p.e.ax + (p.e.bx - p.e.ax) / p.e.len * t, pzw = p.e.az + (p.e.bz - p.e.az) / p.e.len * t;
      plaqueAt.push({ name: p.name, x: pxw, y: y + terrainStandY(p.res.stand, pxw, pzw), yWall: y, z: pzw, nx: p.e.nx, nz: p.e.nz, w, off, t, len: p.e.len, key, mv: [t - tFirst, y - yBase], dx: (p.e.bx - p.e.ax) / p.e.len, dz: (p.e.bz - p.e.az) / p.e.len });
    }
    if (!buf.empty) {
      const mat = registerNight(new THREE.MeshStandardMaterial({ map: atlas.texture, emissiveMap: atlas.texture, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), 0.55, 0.0);
      const mesh = new THREE.Mesh(buf.toGeometry(), mat);
      mesh.name = 'world:signs'; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.receiveShadow = true;
      ctx.scene.add(mesh); ctx.signMeshes.push(mesh);
    }
  }
  ctx.stats.signs = quads.length; ctx.stats.plaques = plaques.length; ctx.stats.signSlots = slotList.length;
  signLog.names = shopSlots.map((sl) => sl.text); signLog.plaques = plaqueList.map((sl) => sl.text);
}
