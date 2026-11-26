// The streets round Worcester College and the walk from it to the Magdalen Street supermarkets, as street-front
// buildings (2026-11-22). From street-level and aerial pictures of the present day (local `reference/streetview/`,
// looked at and never copied or used as textures; the owner: match today, not 2013). The buildings stay the generic
// city builder's: this module only tells it what each is made of, how many storeys it has and how its roof sits
// (game.overrides.style: a hand entry, above the building-facts table), and adds the few things the builder cannot
// draw, in the college's atlas: the first-floor oriels of the Walton Street terrace, the first-floor iron balconies
// of Beaumont Street, the lead domes of the turreted block on Worcester Street.
//   KNOWN (seen in a picture): every entry marked K below. GUESS (plausible, flagged): entries marked G, and every
//   dimension of the hand-built pieces. `?wstreets=0` (node: GTO_WSTREETS=0) turns the whole module off for
//   before / after pictures.
import * as THREE from 'three';
import { Batch, frame, rectPts, makePack } from './_worcester_kit.js';

const ON = !((typeof location !== 'undefined' && location && /[?&]wstreets=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_WSTREETS === '0'));

// ---- Walton Street, east side, from No. 171 north (K): a terrace of pale painted stucco houses, four storeys at the
// college end falling to three, a canted oriel on the first floor of each, slate roofs. [id, storeys, tint]
const WHITE = [1.03, 1.03, 1.01], GREY = [0.9, 0.92, 0.93], CREAM = [1.02, 0.99, 0.9];
const WALTON = [
  ['w301621512', 4, GREY], ['w821980782', 4, WHITE], ['w821980781', 4, WHITE], ['w821980800', 4, CREAM], ['w821980799', 4, WHITE], ['w821980798', 4, GREY],
  ['w821980797', 3, WHITE], ['w821980784', 3, CREAM], ['w821980796', 3, WHITE], ['w821980795', 3, WHITE], ['w821980783', 3, CREAM],
];
const WALTON_SH = 2.9;      // storey height of the terrace (eaves = storeys x this)
// ---- Beaumont Street and the south end of St John Street (K): three-storey Bath-stone ashlar terraces, a parapet
// hiding the roof, tall first-floor windows, round-headed doorways with fanlights. EAVES: three storeys of 3.47 m.
const ASHLAR = { wall: 'stone', tint: [1.07, 1.0, 0.85], ivy: false, storeys: 3, eaves: 10.4, shape: 'hidden', parapet: true, crenel: false, dormers: false, roof: 'slate', first: 'stoneSashTall', up: 'stoneSash', ground: 'stoneSash', door: 'stoneArchDoor' };
const BEAUMONT = ['w817703736', 'w817703737', 'w817703738', 'w817703739', 'w817703740', 'w817703741', 'w817703742', 'w817703743', 'w817703744', 'w817703745',
  'w816331355', 'w816331356', 'w816331357', 'w816331358', 'w816331359', 'w816331360', 'w816331361', 'w816331362', 'w816331363', 'w226267615', 'w303843803'];
const ST_JOHN = ['w821976169', 'w821976168', 'w821976167', 'w821976166', 'w821976165', 'w821976164', 'w821976163', 'w821976162', 'w821976161', 'w821976160', 'w821976159',
  'w819558884', 'w819558885', 'w819558886', 'w154818554', 'w154818555', 'w154818543', 'w154818536', 'w154818548', 'w154818552', 'w154818550', 'w154818556', 'w817703746', 'w234794127', 'w304797863'];
// ---- Beaumont Buildings, west side (K): two-storey brick cottages (red and buff chequer: drawn as a warm mixed brick)
const BB = ['w818907344', 'w818907345', 'w818907348', 'w818907349', 'w818907350', 'w818907351', 'w818907352', 'w818907353', 'w818907354', 'w818907355', 'w818907356', 'w818907357', 'w818907358', 'w818907347', 'w818907346'];
const RED = [1.0, 0.74, 0.66];
// ---- one-off buildings: [id, style, K | G, what]
const ONE = [
  // Worcester Street, east side (K): red-brick blocks with stone bands and paired white-framed windows, four storeys
  ['w114597549', { wall: 'brick', tint: RED, ivy: false, storeys: 4, up: 'brickPair', ground: 'brickPair', door: 'brickDoor', roof: 'slate', shape: 'hidden', gables: true, gableCell: 'villaGable', parapet: false }, 'K', '3 Worcester Street'],
  ['w226261988', { wall: 'brick', tint: RED, ivy: false, storeys: 4, up: 'brickPair', ground: 'brickPair', door: 'brickDoor', roof: 'slate', shape: 'hidden', gables: true, gableCell: 'villaGable', parapet: false }, 'K', '4 Worcester Street'],
  ['w226351676', { wall: 'brick', tint: RED, ivy: false, storeys: 4, up: 'brickPair', ground: 'brickPair', door: 'brickDoor', roof: 'slate', shape: 'hidden', gables: true, gableCell: 'villaGable', parapet: false }, 'K', '5 Worcester Street (it was stone)'],
  ['w226352264', { wall: 'brick', tint: RED, ivy: false, storeys: 4, up: 'brickPair', ground: 'brickPair', door: 'brickDoor', roof: 'slate', shape: 'hidden', gables: true, gableCell: 'villaGable', parapet: false }, 'K', '6 Worcester Street (it was stone)'],
  // the Edwardian block with domed corner turrets (K): red brick with stone dressings, four storeys; the domes are install()'s
  ['w226365781', { wall: 'brick', tint: [1.04, 0.76, 0.66], ivy: false, storeys: 4, up: 'brickGeorgian', ground: 'brickGeorgian', door: 'brickDoor', roof: 'slate', shape: 'flat', parapet: true, crenel: false }, 'K', '7 Worcester Street'],
  // the George Street corner (K): red-brick neo-Georgian over a stone-faced ground floor of shop windows, three storeys,
  // a stone cornice. The map has the whole south side of George Street's west end as one outline (r1759049) with
  // Hayes House (r11664595) inside its corner: both are styled (G: the rest of that frontage is taken to match)
  ['r1759049', { wall: 'brick', tint: [0.98, 0.72, 0.64], ivy: false, storeys: 3, up: 'brickGeorgian', door: 'brickDoor', roof: 'slate', parapet: true, crenel: false }, 'K', 'George Street / Worcester Street corner block'],
  ['r11664595', { wall: 'brick', tint: [0.98, 0.72, 0.64], ivy: false, storeys: 3, up: 'brickGeorgian', door: 'brickDoor', roof: 'flat', parapet: true, crenel: false }, 'K', 'Hayes House, 75 George Street'],
  // the low stone building with a hipped slate roof and a stack in the corner garden opposite the college (K)
  ['w304683991', { wall: 'stone', tint: [0.88, 0.85, 0.78], rubble: true, ivy: false, storeys: 2, eaves: 5.2, shape: 'hipped', roof: 'slate', parapet: false, up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor' }, 'K', '1 Worcester Street'],
  // Worcester Cottage, 172 Walton Street (K from the air: a two-storey stone house under dark slate; it was a flat-roofed render box)
  ['w304762001', { wall: 'stone', tint: [0.92, 0.88, 0.8], rubble: true, ivy: false, storeys: 2, eaves: 5.5, shape: 'hipped', roof: 'slate', parapet: false, up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor' }, 'K', 'Worcester Cottage'],
  // the college's stepped ranges on Hythe Bridge Street (K from the air: blue-grey metal roofs; G: buff brick walls)
  ['w28043676', { wall: 'brick', tint: [1.5, 2.45, 2.75], ivy: false, roof: 'lead', up: 'brickPair', ground: 'brickPair', door: 'brickDoor', eaves: 6.9, crenel: false }, 'G', 'Linbury Building'],
  // Worcester Place (K): the pale stone-clad ground storey of the present building on the Ruskin College site; its
  // diamond-shingled upper storeys and curved glass cannot be drawn by the builder (G: pale stone throughout, lead roofs)
  ['w502954125', { wall: 'stone', tint: [1.1, 1.08, 1.03], ivy: false, crenel: false, roof: 'lead', up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor' }, 'G', 'Cohen Quad'],
  ['w502954126', { wall: 'stone', tint: [1.1, 1.08, 1.03], ivy: false, crenel: false, roof: 'lead', up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor' }, 'G', 'Cohen Quad, Learning Commons'],
  ['w502954127', { wall: 'stone', tint: [1.1, 1.08, 1.03], ivy: false, crenel: false, roof: 'lead', up: 'stoneSash', ground: 'stoneSash', door: 'stoneDoor' }, 'G', 'Cohen Quad, FitzHugh Auditorium'],
  // the college's houses on the west side of Walton Street (K from the air: white stucco under dark slate; they were stone under red tile)
  ['w69991307', { wall: 'render', tint: WHITE, ivy: false, roof: 'slate', up: 'renderGeorgian', ground: 'renderSash', door: 'renderDoor', crenel: false }, 'K', '1a Walton Street'],
  ['w1320810214', { wall: 'render', tint: WHITE, ivy: false, roof: 'slate', up: 'renderGeorgian', ground: 'renderSash', door: 'renderDoor', crenel: false }, 'K', '1 Walton Street'],
  ['w1320810215', { wall: 'render', tint: WHITE, ivy: false, roof: 'slate', up: 'renderGeorgian', ground: 'renderSash', door: 'renderDoor', crenel: false }, 'K', '2 Walton Street'],
  ['w69991301', { wall: 'render', tint: CREAM, ivy: false, roof: 'slate', up: 'renderGeorgian', ground: 'renderSash', door: 'renderDoor', crenel: false }, 'G', '2a Walton Street'],
  // ---- the walk to the supermarkets
  // Gloucester Street (K): red-brick blocks, three storeys (the east one over a white ground floor: its ground floor stays the builder's shop fronts)
  ['w1489604338', { wall: 'brick', tint: RED, ivy: false, storeys: 3, up: 'brickGeorgian', door: 'brickDoor', roof: 'slate' }, 'K', 'Gloucester Street, east side'],
  ['w113822732', { wall: 'brick', tint: [0.96, 0.72, 0.64], ivy: false, storeys: 3, eaves: 11.2, up: 'brickPair', door: 'brickDoor', roof: 'slate' }, 'K', 'Threeways House, Gloucester Street'],
  // the New Theatre and the store behind it, George Street to Red Lion Square (K): red brick above the ground floor
  // on George Street and bare red brick to the service lane. Storeys, bays and eaves kept as they were
  ['w113822719', { wall: 'brick', tint: [0.94, 0.68, 0.6], ivy: false, storeys: 5, bayW: 2.9, eaves: 14.9, shape: 'gabled', up: 'brickGeorgian', door: 'brickDoor', roof: 'slate' }, 'K', 'New Theatre block'],
  // Magdalen Street, west side (K): tall pale stone Victorian fronts above the shops (it was dark brick). Storeys, bays
  // and eaves kept as they were, so the supermarkets' own shopfronts fit as before
  ['w113822723', { wall: 'stone', tint: [1.08, 1.05, 0.98], ivy: false, storeys: 6, bayW: 2.7, eaves: 16.5, shape: 'gabled', up: 'stoneSash', first: 'stoneSashTall', roof: 'slate' }, 'K', 'Magdalen Street west side (the supermarkets block)'],
  // ... and the 1960s concrete-framed block with fins north of them (K)
  ['w217581835', { wall: 'concrete', ivy: false, storeys: 5, eaves: 15.5, roof: 'flat' }, 'K', '13-15 Magdalen Street'],
];
// the turret domes of 7 Worcester Street: centres of the round corner bays in the mapped outline (K: two seen from the
// junction; G: the third, and their size)
const DOMES = [[-223.0, 149.8, 1.75], [-228.2, 146.4, 1.75], [-230.2, 140.2, 1.75]];
const DOME_Y = 15.9;       // the block's wall head

export const CHECKED = [...WALTON.map((q) => [q[0], 'K', 'Walton Street terrace']), ...BEAUMONT.map((id) => [id, 'K', 'Beaumont Street terrace']), ...ST_JOHN.map((id) => [id, 'K', 'St John Street terrace']),
  ...BB.map((id) => [id, 'K', 'Beaumont Buildings']), ...ONE.map((q) => [q[0], q[2], q[3]])];

/** the street-facing edges of an outline: those whose middle is within maxD of the road's line and look at it */
function fronts(poly, roads, maxD) {
  let cx = 0, cz = 0; for (const p of poly) { cx += p[0]; cz += p[1]; } cx /= poly.length; cz /= poly.length;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
    if (len < 2.6) continue;
    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
    let nx = dz / len, nz = -dx / len; if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
    let best = maxD, qx = 0, qz = 0;
    for (const r of roads) for (let k = 0; k < r.length - 1; k++) {
      const p = r[k], q = r[k + 1], ex = q[0] - p[0], ez = q[1] - p[1], t = Math.max(0, Math.min(1, ((mx - p[0]) * ex + (mz - p[1]) * ez) / (ex * ex + ez * ez || 1)));
      const x = p[0] + ex * t, z = p[1] + ez * t, d = Math.hypot(x - mx, z - mz); if (d < best) { best = d; qx = x; qz = z; }
    }
    if (best >= maxD || ((qx - mx) * nx + (qz - mz) * nz) / (best || 1) < 0.7) continue;
    out.push({ a, c, len, nx, nz, mx, mz });
  }
  return out;
}

export default {
  id: 'worcester_streets',
  preMap(game) {
    if (!ON) return;
    try {
      const ov = game.overrides;
      for (const [id, n, tint] of WALTON) ov.style.set(id, { wall: 'render', tint, ivy: false, storeys: n, eaves: n * WALTON_SH, first: 'renderBlank', up: 'renderGeorgian', ground: 'renderSash', door: 'renderDoor', roof: 'slate', shape: 'gabled', parapet: false });
      for (const id of BEAUMONT) ov.style.set(id, ASHLAR);
      for (const id of ST_JOHN) ov.style.set(id, { ...ASHLAR, tint: [1.04, 0.98, 0.85] });
      for (const id of BB) ov.style.set(id, { wall: 'brick', tint: [1.06, 0.88, 0.74], ivy: false, storeys: 2, eaves: 5.6, up: 'brickSash', ground: 'brickSash', door: 'brickDoor', roof: 'slate', shape: 'gabled', parapet: false, dormers: false });
      for (const [id, st] of ONE) ov.style.set(id, st);
    } catch (e) { console.error('[worcester_streets] preMap', e); }
  },
  install(game) {
    if (!ON) return null;
    const world = game.world, map = game.map, byId = new Map();
    for (const b of map.buildings) byId.set(b.id, b);
    const roadsOf = (name) => map.roads.filter((r) => r.name === name && r.kind !== 'cycleway' && r.kind !== 'footway').map((r) => r.pts);
    const pack = makePack(world), M = { _pack: pack };
    const B = new Batch();
    const grp = new THREE.Group(); grp.name = 'worcester-streets';
    world.addStatic(grp);
    let bayN = 800, nOriel = 0, nBalc = 0;
    const bay = () => [1 + (bayN++ % 251), 1 + (bayN % 5)];
    // ---- Walton Street: a first-floor oriel on each house (the builder leaves that storey blank: `first: renderBlank`)
    const walton = roadsOf('Walton Street');
    for (const [id] of WALTON) {
      const b = byId.get(id); if (!b) continue;
      const f = fronts(b.poly, walton, 16).sort((p, q) => q.len - p.len)[0]; if (!f || f.len < 3.4) continue;
      const w = Math.min(2.3, f.len * 0.46), y0 = WALTON_SH + 0.5, y1 = 2 * WALTON_SH - 0.25, d = 0.46;
      B.push(frame(f.mx, 0, f.mz, f.nz, -f.nx));      // x along the front, z out to the street
      B.box('white', 0, (y0 + y1) / 2, d / 2 - 0.02, w, y1 - y0, d + 0.04, 0, { top: false });
      B.box('white', 0, y0 - 0.07, d / 2, w + 0.14, 0.14, d + 0.08, 0, { bottom: true });
      B.box('lead', 0, y1 + 0.05, d / 2, w + 0.16, 0.1, d + 0.1);
      const ww = w / 2 - 0.18;
      for (const sx of [-1, 1]) B.unit('sash', rectPts(sx * (w / 4) - ww / 2, y0 + 0.3, sx * (w / 4) + ww / 2, y1 - 0.2), d + 0.025, bay());
      B.pop(); nOriel++;
    }
    // ---- Beaumont Street: iron balconies along the first floor of each front (rails and bars as thin boxes)
    const beaumont = roadsOf('Beaumont Street'), sH = ASHLAR.eaves / 3;
    for (const id of BEAUMONT) {
      const b = byId.get(id); if (!b) continue;
      for (const f of fronts(b.poly, beaumont, 15)) {
        if (f.len < 4) continue;
        const L = f.len - 0.9, y = sH - 0.02, out = 0.5, n = Math.max(2, Math.round(L / 0.4));
        B.push(frame(f.mx, 0, f.mz, f.nz, -f.nx));
        B.box('grey', 0, y - 0.04, out / 2, L, 0.07, out, 0, { bottom: true });                    // the stone slab
        B.box('iron', 0, y + 0.92, out - 0.03, L, 0.045, 0.045, 0, { bottom: true });              // top rail
        B.box('iron', 0, y + 0.12, out - 0.03, L, 0.035, 0.035, 0, { bottom: true });
        for (let k = 0; k <= n; k++) B.box('iron', -L / 2 + (L * k) / n, y + 0.5175, out - 0.03, 0.025, 0.755, 0.025, 0, { top: false });      // (between the rails: no face shared with them)
        for (const sx of [-1, 1]) B.box('iron', sx * (L / 2 + 0.03), y + 0.912, out / 2 - 0.035, 0.035, 0.03, out - 0.07, 0, { bottom: true });
        B.pop(); nBalc++;
      }
    }
    // ---- 7 Worcester Street: lead domes on the corner turrets
    if (byId.has('w226365781')) for (const [x, z, r] of DOMES) {
      B.cyl('redBrick', x, DOME_Y, z, r, 1.1, 10, false);
      B.cyl('stoneDress', x, DOME_Y + 1.1, z, r + 0.14, 0.2, 10, true);
      B.cyl('lead', x, DOME_Y + 1.3, z, r * 0.98, 0.75, 10, false, r * 0.8);
      B.cyl('lead', x, DOME_Y + 2.05, z, r * 0.8, 0.6, 10, false, r * 0.42);
      B.cyl('lead', x, DOME_Y + 2.65, z, r * 0.42, 0.3, 10, true, r * 0.08);
      B.cyl('lead', x, DOME_Y + 2.95, z, 0.07, 0.7, 5, true, 0.03);
    }
    const meshes = B.build(M, grp, { pack, noCast: new Set(['signs']) });
    // (terrain: all of this is fixed to the walls of the city's own houses, which stand level on sloping ground: it takes
    //  each house's level with it, or a balcony runs aslant across a level front - world.terrainStandObject)
    if (world.terrainStandObject) world.terrainStandObject(grp);
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
    game.worcesterStreets = { on: true, oriels: nOriel, balconies: nBalc, tris, checked: CHECKED };
    return null;
  },
};
