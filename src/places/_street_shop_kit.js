// Street shops: ONE small walk-in shop interior, fitted from a template, for the ordinary premises of the painted
// shopping streets (Cornmarket, Queen Street, the High) — owned by places/cornmarket_shops.js (the pilot: one shop).
//
// A shop is one room behind its mapped building's own generic shopfront (world/buildings.js: every shop unit is painted
// as a recessed lobby with a door at its back + a shop window): the doorway is put ON the painted door and the window ON
// the painted glass (places/_walkin_city.js planWalkin `snapBay` / `auto`), so nothing of the street front changes but
// that the door opens and the glass is glass. The room is world/interiorkit.js walls + plain coloured boxes, merged
// (mergeRoom) into two or three meshes; nothing is built until the player is near (core/interiors.js builds lazily).
// The trade's name is the fascia's painted text (the map's name for the premises, corrected to c. 2013 by the owner's
// preMap): nothing in here carries a name, a logo or a livery.
//
// TEMPLATES (what `fit` knows how to furnish). Built and tried: 'stationer'. The others are laid out as data so that the
// same builder can take them, but have NOT been walked or looked at yet (see the proposal in the hand-over notes).
import * as THREE from 'three';
import { kitGaps, glazing, cityDoor, mergeRoom, reveal } from './_walkin_city.js';

/** stock colours by what stands on the shelf */
const STOCK = {
  books: [0x7a2a22, 0x23406a, 0xd8c9a0, 0x2f5a3a, 0x8a6a2a, 0x3a2a4a, 0xb8b0a0, 0x1e1e22],
  mags: [0xd23a2a, 0xf2c23a, 0x2a7ac8, 0xe8e0d0, 0xe86a9a, 0x3a9a5a, 0x1a1a1a, 0xf08a2a],
  cards: [0xf4ecd8, 0xf2a0b0, 0xa0c8f0, 0xf6e080, 0xb8e0b0, 0xe8e8e8],
  clothes: [0x23262d, 0x6a7a8a, 0xd8d0c0, 0x7a2a2a, 0x2a4a6a, 0xb0a890],
  boxes: [0xf2f2f2, 0x2a2a2e, 0xd8dce0, 0x3a6aa8],
  chemist: [0xf4f4f4, 0x9ad0e8, 0xe8a0b8, 0xb8e0a0, 0xf0e0a0, 0x7ab0d8],
  food: [0xe8d8b0, 0xc89a5a, 0xf4ecd8, 0xa86a3a],
};
// wall: stock on the two side walls [kind, height]; mid: free-standing rows down the middle [kind, height, style];
// counter: 'front' (by the door: a till you pass on the way out) | 'back';  floor / walls: world.mats names
export const TEMPLATES = {
  stationer: { floor: 'wood', walls: 'plaster', wall: ['books', 2.1], mid: ['mags', 1.25, 'gondola'], counter: 'front', spinner: 'cards', light: 0xf4f6ff },
  bookshop: { floor: 'wood', walls: 'plaster', wall: ['books', 2.3], mid: ['books', 0.95, 'table'], counter: 'front', light: 0xffe8c8 },
  clothes: { floor: 'wood', walls: 'plaster', wall: ['clothes', 1.9], mid: ['clothes', 1.35, 'rail'], counter: 'back', light: 0xfff4e4 },
  phone: { floor: 'stone', walls: 'plaster', wall: ['boxes', 1.5], mid: ['boxes', 0.95, 'table'], counter: 'back', light: 0xf0f6ff },
  chemist: { floor: 'stone', walls: 'plaster', wall: ['chemist', 2.0], mid: ['chemist', 1.35, 'gondola'], counter: 'back', light: 0xf4f8ff },
  cafe: { floor: 'wood', walls: 'plaster', wall: null, mid: ['food', 0.76, 'tables'], counter: 'back', light: 0xffd8a8 },
  bank: { floor: 'stone', walls: 'plaster', wall: null, mid: null, counter: 'back', light: 0xf4f6ff, extra: 'bank' },
  takeaway: { floor: 'stone', walls: 'plaster', wall: null, mid: ['food', 0.76, 'tables'], counter: 'back', light: 0xfff0d8, extra: 'takeaway' },
  gift: { floor: 'wood', walls: 'plaster', wall: ['cards', 1.9], mid: ['boxes', 0.95, 'table'], counter: 'back', light: 0xfff4e4 },
  records: { floor: 'wood', walls: 'plaster', wall: ['mags', 1.7], mid: ['mags', 1.05, 'gondola'], counter: 'front', light: 0xf4f6ff },
  shoes: { floor: 'wood', walls: 'plaster', wall: ['boxes', 2.0], mid: ['clothes', 0.5, 'table'], counter: 'back', light: 0xfff4e4 },
  barber: { floor: 'stone', walls: 'plaster', wall: null, mid: null, counter: 'back', light: 0xfff4e4, extra: 'barber' },
  jeweller: { floor: 'wood', walls: 'plaster', wall: ['boxes', 1.3], mid: ['boxes', 0.95, 'table'], counter: 'back', light: 0xfff0d8 },
};
/** the template for a kind of premises (the map's `kind` of a point of interest) */
export const templateFor = (kind = '') => (/books/.test(kind) ? 'bookshop' : /clothes|fashion|tailor|boutique/.test(kind) ? 'clothes' : /shoes/.test(kind) ? 'shoes' : /mobile|electronics|computer|photo|locksmith|optician/.test(kind) ? 'phone'
  : /chemist|cosmetics|beauty|perfum/.test(kind) ? 'chemist' : /fast_food|ice_cream|bakery/.test(kind) ? 'takeaway' : /cafe|restaurant/.test(kind) ? 'cafe' : /bank|bureau|atm/.test(kind) ? 'bank' : /gift|toys|souvenir|chocolate|confection/.test(kind) ? 'gift' : /jewel/.test(kind) ? 'jeweller' : /music|video|games/.test(kind) ? 'records' : 'stationer');
const _mats = new Map();
const flat = (c) => { let m = _mats.get(c); if (!m) _mats.set(c, (m = new THREE.MeshLambertMaterial({ color: c }))); return m; };
const GEO = new THREE.BoxGeometry(1, 1, 1);
// A shop's FIT (shelving, stock, gondolas, counter, till: some hundreds of boxes) is built ONCE per (template, size,
// which side the door is, one of three stockings) and shared by every shop of that description: one merged geometry
// (geometry.userData.shared: core/interiors.js leaves it on the graphics card when one of its rooms is freed), the
// collider boxes replayed into each room. A street of sixty shops is a dozen such geometries.
const FITS = new Map();
export const fitStats = () => ({ fits: FITS.size, built: fitStats.built | 0, reused: fitStats.reused | 0 });

/** the walk-in plan's own part for a shop of inner size w x d (room coordinates: the street wall at z = +d/2, the door in it) */
export const shopPlanSpec = (w, d, { doorW = 1.1, doorH = 2.25, t = 0.2, snap = 3.2 } = {}) => ({
  portal: { at: [0, d / 2 + t / 2], out: 0, w: doorW, h: doorH, snapBay: snap }, rects: [[-w / 2, -d / 2, w / 2, d / 2]], wall: 0.3,
  auto: { walls: [{ a: [w / 2, d / 2], b: [-w / 2, d / 2], out: 0 }], maxDepth: 1.6, maxY: 3.0 }, mid: [0, d / 2 - Math.min(3.2, d * 0.36)], route: [],
});

/**
 * Build the shop in ctx (a walk-in room: core/interiors.js build(ctx)).  o: { w, d, h, template, seed }
 * -> { spawn, heading, clerk: [x, z, heading], browse: [[x, z, heading]…], till: [x, y, z], lights: [[light, intensity]…] }
 */
function buildFit(T, w, d, h, pxS, seed0) {
  const hw = w / 2, hd = d / 2, px = pxS, boxes = [], col = { addBox: (x, z, bw, bd) => boxes.push([x, z, bw, bd]) };
  let seed = (seed0 | 0) || 7; const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const g = new THREE.Group(); g.name = 'street-shop:fit';
  const box = (x, y, z, bw, bh, bd, c) => { const m = new THREE.Mesh(GEO, flat(c)); m.position.set(x, y + bh / 2, z); m.scale.set(bw, bh, bd); m.castShadow = false; m.receiveShadow = false; g.add(m); return m; };
  // a run of shelving along a side wall (x = the wall's face, sg = which way it faces): a carcass, shelves, and on each
  // shelf the stock as a row of blocks of the trade's colours (books: spines of uneven height)
  const carcass = 0x5a4632, white = 0xe8e6e0, steel = 0x8a9098;
  const shelving = (x, sg, z0, z1, kind, top) => {
    const L = z1 - z0, dep = 0.36, cx = x + sg * dep / 2, n = Math.max(1, Math.round(L / 1.1)), bay = L / n, pal = STOCK[kind] || STOCK.books, rows = Math.max(2, Math.round((top - 0.25) / 0.36));
    box(x + sg * 0.012, 0, (z0 + z1) / 2, 0.024, top, L, kind === 'books' ? carcass : white);
    for (let i = 0; i <= n; i++) box(cx, 0, z0 + i * bay, dep, top, 0.03, kind === 'books' ? carcass : white);
    for (let r = 0; r <= rows; r++) {
      const y = 0.12 + r * ((top - 0.14) / rows);
      box(cx, y - 0.03, (z0 + z1) / 2, dep, 0.03, L, kind === 'books' ? carcass : white);
      if (r === rows) break;
      const rh = (top - 0.14) / rows - 0.06;
      for (let i = 0; i < n; i++) { let z = z0 + i * bay + 0.04; const zEnd = z0 + (i + 1) * bay - 0.04; while (z < zEnd - 0.08) { const bl = Math.min(zEnd - z, kind === 'books' ? 0.045 + rnd() * 0.11 : kind === 'clothes' ? 0.26 + rnd() * 0.1 : 0.06 + rnd() * 0.11);      /* (packets and bottles a hand wide; folded clothes in piles) */   /* books: spines; else packets and boxes */ box(cx - sg * 0.03, y, z + bl / 2, dep - 0.1, rh * (kind === 'clothes' ? 0.3 + rnd() * 0.5 : 0.45 + rnd() * 0.5), bl - 0.012, pal[(rnd() * pal.length) | 0]); z += bl; } }
    }
    col.addBox(cx, (z0 + z1) / 2, dep, L, 0);
  };
  const counter = T.counter === 'front' && w < 4.4 ? 'back' : T.counter;      // (no room for a till by the door in a narrow shop)
  const frontClear = 2.6, backClear = counter === 'back' ? 2.3 : 0.5;
  if (T.wall) for (const sg of [1, -1]) shelving(-sg * hw + sg * 0.01, sg, -hd + backClear, hd - frontClear + (counter === 'front' && sg * px > 0 ? -1.6 : 0.9), T.wall[0], T.wall[1]);
  // the middle of the floor
  // (café tables want less room about them than a gondola: they go nearer the counter and the door)
  const tables = !!T.mid && T.mid[2] === 'tables';
  const browse = [], zA = -hd + backClear + (tables ? 0.7 : 1.2), zB = hd - (tables ? 1.9 : frontClear + 1.0);
  if (T.mid && zB - zA > (tables ? 0.9 : 2)) {
    const [kind, top, style] = T.mid, pal = STOCK[kind] || STOCK.mags, rowsX = w >= 5.2 ? [-0.95, 0.95] : tables && w >= 4.2 ? [-1.05, 1.05] : tables ? [-(w / 2 - 0.75)] : [0], two = zB - zA >= (tables ? 3.2 : 5.2), L = two ? Math.min(3.4, (zB - zA - 1.1) / 2) : Math.min(3.4, zB - zA);      // (a short shop: one run each side of the aisle)
    for (const x of rowsX) for (const zc of two ? [zA + L / 2, zB - L / 2] : [(zA + zB) / 2]) {
      if (style === 'gondola') {
        box(x, 0, zc, 0.62, 0.14, L, 0x2a2d31); box(x, 0.14, zc, 0.05, top - 0.14, L, white);
        for (const sg of [-1, 1]) for (let r = 0; r < 4; r++) { const y = 0.2 + r * ((top - 0.2) / 4), out = 0.27 - r * 0.045; box(x + sg * (0.03 + out / 2), y, zc, out, 0.02, L - 0.04, white); let z = zc - L / 2 + 0.03; while (z < zc + L / 2 - 0.1) { const bl = 0.2 + rnd() * 0.06; box(x + sg * (0.05 + out / 2), y + 0.02, z + bl / 2, 0.02, 0.24, bl - 0.015, pal[(rnd() * pal.length) | 0]).rotation.z = -sg * 0.3; z += bl; } }
        col.addBox(x, zc, 0.62, L, 0);
      } else if (style === 'rail') {
        for (const zz of [zc - L / 2 + 0.05, zc + L / 2 - 0.05]) box(x, 0, zz, 0.04, top, 0.04, steel);
        box(x, top - 0.03, zc, 0.03, 0.03, L, steel);
        let z = zc - L / 2 + 0.12; while (z < zc + L / 2 - 0.14) { box(x, top - 0.95, z, 0.46, 0.9, 0.05, pal[(rnd() * pal.length) | 0]); z += 0.075 + rnd() * 0.03; }
        col.addBox(x, zc, 0.5, L, 0);
      } else {      // a table (books piled on it, phones on stands, a café table)
        const tl = style === 'tables' ? 0.75 : L * 0.8, tw = style === 'tables' ? 0.75 : 0.9;
        box(x, top - 0.05, zc, tw, 0.05, tl, style === 'tables' ? 0x6a4a30 : white); box(x, 0, zc, tw * 0.5, top - 0.05, tl * 0.6, style === 'tables' ? 0x3a2a1e : 0xd0d0d0);
        if (style !== 'tables') for (let k = 0; k < 8; k++) box(x - tw / 2 + 0.16 + (k % 2) * (tw - 0.32), top, zc - tl / 2 + 0.2 + (k >> 1) * ((tl - 0.4) / 3), 0.24, 0.04 + rnd() * 0.1, 0.17, pal[(rnd() * pal.length) | 0]);
        col.addBox(x, zc, tw, style === 'tables' && zB - zA > 0.9 ? tl + 0.94 : tl, 0);      // (a café table with its two chairs: the chairs used to be walked through)
      }
    }
    // where someone browsing stands: in the aisles beside the rows, facing them
    // (two rows of café tables in a shop under 5.2 m wide stand at ±1.05: the side aisles are OUTSIDE them, not hw - 1.0,
    //  which put the people browsing there in the tables)
    const sideX = rowsX.length > 1 ? Math.max(hw - 1.0, Math.abs(rowsX[0]) + (style === 'tables' ? 0.375 : 0.31) + 0.3) : 0;
    const ax = rowsX.length > 1 ? [-sideX, 0, sideX] : [-hw + 1.05, hw - 1.05];
    // (…and never IN a row: a single row of café tables stands off-centre, at -(w/2 - 0.75), where the left-hand browser was)
    { const rowHalf = (style === 'tables' ? 0.375 : style === 'gondola' ? 0.31 : style === 'rail' ? 0.25 : 0.45) + 0.32; for (let i = 0; i < ax.length; i++) for (const rx of rowsX) if (Math.abs(ax[i] - rx) < rowHalf) ax[i] = rx + (ax[i] >= rx ? 1 : -1) * rowHalf; }
    for (const [i, x] of ax.entries()) browse.push([x, zA + 0.6 + ((i * 1.7) % Math.max(1, zB - zA - 1.2)), x < 0 ? (T.wall ? -Math.PI / 2 : Math.PI / 2) : Math.PI / 2]);
  }
  // the counter and its till: by the door (on the side the door is not), or across the back
  let clerk, till;
  if (counter === 'front') {
    const sg = px > 0 ? -1 : 1, cx = sg * (hw - 1.25), cz = hd - 1.55;
    box(cx, 0, cz, 1.9, 0.92, 0.6, 0x3a3f46); box(cx, 0.92, cz, 2.0, 0.04, 0.68, 0xd8d4c8); box(cx - 0.4, 0.96, cz, 0.36, 0.28, 0.34, 0x1e1e22); box(cx + 0.45, 0.96, cz, 0.5, 0.16, 0.3, STOCK.cards[2]);
    col.addBox(cx, cz, 2.0, 0.68, 0); clerk = [cx, cz + 0.75, Math.PI]; till = [cx, 0, cz - 0.75];
    box(sg * (hw - 0.2), 0.9, cz + 0.75, 0.34, 1.3, 1.3, white);      // (the shelves behind the till)
  } else {
    const cz = -hd + 1.25;
    box(0, 0, cz, w - 1.6, 0.95, 0.62, T === TEMPLATES.cafe ? 0x5a3a26 : 0x3a3f46); box(0, 0.95, cz, w - 1.5, 0.04, 0.7, 0xd8d4c8); box(-0.6, 0.99, cz, 0.36, 0.28, 0.34, 0x1e1e22);
    col.addBox(0, cz, w - 1.5, 0.7, 0); clerk = [0, cz - 0.7, 0]; till = [0, 0, cz + 0.8];
    box(0, 0, -hd + 0.2, w - 0.6, 2.0, 0.34, white);
  }
  if (T.spinner) { const sx = 0, sz = -hd + 0.55, pal = STOCK[T.spinner];   /* a card spinner against the back wall */ box(sx, 0, sz, 0.36, 0.06, 0.36, steel); box(sx, 0.06, sz, 0.05, 1.6, 0.05, steel); for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, m = box(sx + Math.sin(a) * 0.17, 0.32 + r * 0.27, sz + Math.cos(a) * 0.17, 0.2, 0.22, 0.012, pal[(r + k) % pal.length]); m.rotation.y = a; } col.addBox(sx, sz, 0.45, 0.45, 0); }
  // what a trade has beside its counter
  if (T.extra === 'bank') {
    const cz = -hd + 1.25;
    box(0, 0.99, cz, w - 1.5, 0.75, 0.03, 0xb8ccd4);                                      // (the screen over the counter)
    for (const k of [-1, 0, 1]) box(k * (w - 1.5) / 3, 0.99, cz, 0.05, 0.75, 0.06, steel);
    for (const sg of [-1, 1]) { const x = sg * (hw - 0.32), z = hd - 3.4; box(x, 0, z, 0.5, 1.02, 1.5, 0x4a5560); box(x, 1.02, z, 0.56, 0.04, 1.56, 0xd8d4c8); box(x - sg * 0.05, 1.06, z, 0.3, 0.02, 0.9, 0xf4f2ea); col.addBox(x, z, 0.56, 1.56, 0); }   // (writing desks, paying-in slips)
    for (let k = 0; k < 4; k++) { const z = -hd + 2.6 + k * 0.9; box(-0.7, 0, z, 0.05, 0.95, 0.05, steel); box(-0.7, 0.95, z, 0.07, 0.03, 0.07, steel); if (k) box(-0.7, 0.88, z - 0.45, 0.025, 0.04, 0.9, 0x23406a); }   // (the queue's posts and tape)
    box(hw - 0.2, 0, hd - 1.2, 0.3, 1.5, 0.6, white); col.addBox(hw - 0.2, hd - 1.2, 0.3, 0.6, 0); for (let r = 0; r < 4; r++) box(hw - 0.37, 0.4 + r * 0.28, hd - 1.2, 0.04, 0.2, 0.5, STOCK.cards[(r * 2) % STOCK.cards.length]);      // (leaflets)
  } else if (T.extra === 'barber') {
    // chairs down one wall, each before its mirror and shelf; a bench to wait on down the other
    const n = Math.max(2, Math.min(4, Math.floor((d - 3.6) / 1.4))), z0 = hd - 2.4;
    for (let k = 0; k < n; k++) { const z = z0 - k * 1.4, x = -hw + 0.95;
      box(-hw + 0.03, 1.0, z, 0.03, 1.1, 0.8, 0xbfd4dc); box(-hw + 0.14, 0.86, z, 0.24, 0.04, 0.9, 0xd8d4c8);      // (mirror, shelf)
      box(x, 0, z, 0.12, 0.32, 0.12, steel); box(x, 0.32, z, 0.56, 0.16, 0.56, 0x23262d); box(x + 0.26, 0.48, z, 0.08, 0.62, 0.52, 0x23262d); box(x, 0.56, z - 0.3, 0.5, 0.05, 0.06, steel); box(x, 0.56, z + 0.3, 0.5, 0.05, 0.06, steel);
      col.addBox(x, z, 0.6, 0.6, 0); }
    box(hw - 0.24, 0.4, z0 - (n - 1) * 0.7, 0.44, 0.06, Math.min(3, n * 1.2), 0x6a4a30); box(hw - 0.05, 0.46, z0 - (n - 1) * 0.7, 0.06, 0.5, Math.min(3, n * 1.2), 0x6a4a30); for (const e of [-1, 1]) box(hw - 0.24, 0, z0 - (n - 1) * 0.7 + e * (Math.min(3, n * 1.2) / 2 - 0.1), 0.4, 0.4, 0.06, 0x4a3626);
    col.addBox(hw - 0.24, z0 - (n - 1) * 0.7, 0.48, Math.min(3, n * 1.2), 0);
  } else if (T.extra === 'takeaway') {
    const cz = -hd + 1.25;
    for (let k = -1; k <= 1; k++) box(k * (w - 1.2) / 3, 2.05, -hd + 0.06, (w - 1.2) / 3 - 0.08, 0.55, 0.05, k ? 0xf4ecd0 : 0xe8d8a0);      // (the boards over the counter)
    box(0.9, 0.99, cz, 0.9, 0.4, 0.45, 0xd8dce0); box(-1.3, 0.99, cz, 0.3, 0.45, 0.3, steel);
    for (const sg of [-1, 1]) { const x = sg * (hw - 0.22); box(x, 0.98, 0.2, 0.36, 0.04, Math.min(3, d - 4.4), 0x6a4a30); for (let k = 0; k < 3; k++) { box(x - sg * 0.4, 0, -0.6 + k * 0.8, 0.3, 0.66, 0.3, 0x2a2d31); } col.addBox(x - sg * 0.185, 0.2, 0.77, Math.max(Math.min(3, d - 4.4), 1.94), 0); }      // (a shelf to eat at and its stools, one box: the stools used to be walked through)
    box(hw - 0.3, 0, hd - 0.9, 0.42, 0.9, 0.42, 0x3a3f46); col.addBox(hw - 0.3, hd - 0.9, 0.42, 0.42, 0);      // (the bin by the door)
  }
  if (T.mid && T.mid[2] === 'tables') {      // chairs at the tables
    const rowsX = w >= 5.2 ? [-0.95, 0.95] : w >= 4.2 ? [-1.05, 1.05] : [-(w / 2 - 0.75)], two = zB - zA >= 3.2, L = two ? Math.min(3.4, (zB - zA - 1.1) / 2) : Math.min(3.4, zB - zA);
    if (zB - zA > 0.9) for (const x of rowsX) for (const zc of two ? [zA + L / 2, zB - L / 2] : [(zA + zB) / 2]) for (const sg of [-1, 1]) { box(x, 0, zc + sg * 0.62, 0.4, 0.45, 0.4, 0x4a3626); box(x, 0.45, zc + sg * 0.8, 0.4, 0.42, 0.04, 0x4a3626); }
    box(0.8, 0.99, -hd + 1.25, 1.1, 0.42, 0.5, 0xd8dce0);                                  // (the glass case on the counter)
  }
  const tmp = new THREE.Scene(); tmp.add(g); mergeRoom(tmp);
  const mesh = tmp.children.find((o) => o.isMesh);
  if (mesh) mesh.geometry.userData.shared = true;
  return { geo: mesh ? mesh.geometry : null, mat: mesh ? mesh.material : null, boxes, clerk, till, browse };
}

/**
 * Build the shop in ctx (a walk-in room: core/interiors.js build(ctx)).  o: { w, d, h, template, seed }
 * -> { spawn, heading, clerk: [x, z, heading], browse: [[x, z, heading]…], till: [x, y, z], lights: [[light, intensity]…] }
 */
export function buildStreetShop(ctx, game, plan, o) {
  const K = game.world.interiorKit, s = ctx.scene, col = ctx.collider, T = TEMPLATES[o.template] || TEMPLATES.stationer;
  const w = o.w, d = o.d, h = o.h || 3.1, hw = w / 2, hd = d / 2, SL = !!(ctx.seamless && plan);
  K.room(s, { w, d, h, floor: T.floor, walls: T.walls, collider: col, doors: SL ? kitGaps(plan) : [{ wall: 's', at: 0, width: 1.1, height: 2.25 }] });
  const px = SL ? plan.seamless.portals[0].at[0] : 0;      // where the door is in the front wall
  const pxS = px > 0 ? 1 : px < 0 ? -1 : 0, key = [o.template, w, d, h, pxS, ((o.seed | 0) % 3 + 3) % 3].join('|');
  let F = FITS.get(key); if (!F) { FITS.set(key, (F = buildFit(T, w, d, h, pxS, 7 + (((o.seed | 0) % 3 + 3) % 3) * 31))); fitStats.built = (fitStats.built | 0) + 1; } else fitStats.reused = (fitStats.reused | 0) + 1;
  for (const b of F.boxes) col.addBox(b[0], b[1], b[2], b[3], 0);
  const { clerk, till, browse } = F;
  const g = new THREE.Group(); g.name = 'street-shop:own';
  const box = (x, y, z, bw, bh, bd, c) => { const m = new THREE.Mesh(GEO, flat(c)); m.position.set(x, y + bh / 2, z); m.scale.set(bw, bh, bd); m.castShadow = false; m.receiveShadow = false; g.add(m); return m; };
  // light: flush panels in the ceiling (lit), two lamps
  const glow = new THREE.MeshBasicMaterial({ color: T.light }); glow.name = 'street-shop:panel';
  // (all the panels one mesh)
  { const P = [], q = GEO.attributes.position;
    for (let z = -hd + 1.6; z < hd - 0.8; z += 2.6) for (const x of w > 4.6 ? [-hw / 2, hw / 2] : [0]) { const ix = GEO.index.array; for (let i = 0; i < ix.length; i++) P.push(x + q.getX(ix[i]) * 1.1, h - 0.012 + q.getY(ix[i]) * 0.02, z + q.getZ(ix[i]) * 0.3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const panels = new THREE.Mesh(pg, glow); panels.name = 'street-shop:panels'; panels.userData.live = true; panels.userData.noSplit = true; panels.matrixAutoUpdate = false; s.add(panels); }
  const lights = [];
  for (const z of [-hd * 0.45, hd * 0.4]) { const l = new THREE.PointLight(T.light, 7, Math.max(9, d * 0.8), 1.6); l.position.set(0, h - 0.4, z); s.add(l); lights.push([l, l.intensity]); }
  for (const l of s.children) if (l.isAmbientLight || l.isHemisphereLight) lights.push([l, l.intensity]);
  s.add(g);
  if (SL) {
    // the window: a low display bed behind the glass with a few things on it, the glass, the doorway's reveal, the door
    for (const q of plan.seamless.openings) {
      if (Math.abs(q.out) > 0.1 || q.w < 1) continue;
      const pal = STOCK[T.wall ? T.wall[0] : T.mid ? T.mid[0] : 'cards'], n = Math.max(2, Math.floor((q.w - 0.3) / 0.45)), y = (q.y0 || 0.5) + 0.004, dz = Math.max(0.22, (q.depth || 0.3) * 0.55);
      for (let k = 0; k < n; k++) box(q.at[0] - (q.w - 0.3) / 2 + (k + 0.5) * ((q.w - 0.3) / n), y, q.at[1] + dz - (k % 2) * 0.1, 0.26, 0.3 + (k % 3) * 0.06, 0.03, pal[(k * 3 + 1) % pal.length]).rotation.x = -0.18;
    }
    s.add(glazing(plan.seamless.openings, { inset: 0.96 })); s.add(reveal(plan.seamless.portals, { floor: true }));
    cityDoor(ctx, plan, { style: 'glass', hinge: -1, open: plan.hours && plan.hours.open });
    mergeRoom(s);
  }
  // (the fit: the template's one geometry, after the room's own things are merged)
  if (F.geo) { const m = new THREE.Mesh(F.geo, F.mat); m.name = 'street-shop:fit'; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.userData.noSplit = true; s.add(m); }
  return { spawn: [px, hd - 1.2], heading: Math.PI, clerk, browse, till, lights, panels: glow };
}
