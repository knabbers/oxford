// Supermarkets: builds one store interior from a layout (_shop_layouts.js). Everything static is merged into a few
// meshes: fixtures (vertex colours), products (one atlas per brand), signs (one atlas per store), floor, ceiling,
// light panels (+ one flickering tube), the street seen through the front glass, sliding doors (instanced), the
// reduced-to-clear packs (instanced, count follows the hour) and the escalator steps.
import * as THREE from 'three';
import { Mesher } from './_shop_mesh.js';
import { Atlas, BRAND, drawPack, drawPoster, drawFascia, fitText, tescoMark, sainsMark, floorTexture, ceilingTexture } from './_shop_tex.js';
import { PRODUCTS, CATEGORIES, REDUCED_ITEMS } from './_shop_data.js';
import { BASEMENT_Y, DEEP_Z } from './_shop_layouts.js';

const PI = Math.PI;
const NOBACK = new Set(['bottom', 'back']);
const shared = {};
function sharedMats() {
  if (shared.fix) return shared;
  shared.fix = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  shared.floor = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.22, metalness: 0.0 });
  shared.ceil = new THREE.MeshStandardMaterial({ map: ceilingTexture(), roughness: 0.9 });
  shared.panel = new THREE.MeshBasicMaterial({ color: 0xf6faff });
  shared.door = new THREE.MeshStandardMaterial({ color: 0xbfdce6, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.3, depthWrite: false });
  shared.boxGeo = new THREE.BoxGeometry(1, 1, 1);
  return shared;
}
const prodAtlases = {};
/** Product atlas per brand: one 128² tile per product (+ yellow-sticker variants). */
export function productAtlas(brand) {
  if (prodAtlases[brand]) return prodAtlases[brand];
  const A = new Atlas(2048, 1024);      // (43 tiles of 128: a 1024 square held 37 — the last six yellow-sticker packs came out blank, "[shop] atlas full")
  A.add('__blank', 8, 8, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); });
  for (const id in PRODUCTS) A.add(id, 128, 128, (g, w, h) => drawPack(g, w, h, id, brand));
  for (const id of REDUCED_ITEMS) A.add('r:' + id, 128, 128, (g, w, h) => drawPack(g, w, h, id, brand, true));
  const mat = new THREE.MeshStandardMaterial({ map: A.texture(), roughness: 0.45 });
  return (prodAtlases[brand] = { A, mat });
}

/**
 * build(scene, collider, branch, layout) -> R
 * R = { bays:[{x,y,z,id,cat}], tills:[{x,z,y,h, cust:[x,z], cashier:[x,z,h], closed}], scos:[{x,z,y,h, stand:[x,z]}], lifts,
 *       news:[x,z], atm, reduced:{x,z,y,set(n)}, update(dt, ctx), stats }
 */
// `sl` (walk-in room, core/interiors.js "seamless"): { wins: [[xa, xb]…] } = the stretches of the front wall that are real
// window openings (the glass itself is the caller's: _walkin_city.js glazing). Then: no painted street behind the glass,
// no sliding panels of its own in the street doorway (the caller adds the real door), the rest of the front is wall, and
// the goods are split by depth (R.setDeep: what is far from the shopfront / downstairs is only drawn from near by).
/** the real lift's shaft and landing door (Tesco Magdalen Street; places/_maths_lift.js) */
export const LIFT = { doorW: 1.2, doorH: 2.1, depth: 1.7, width: 1.6 };
// (a generator: core/interiors.js builds a room a piece a frame, left at each `yield`)
export function* buildInterior(scene, collider, branch, L, world, sl = null) {
  const S = sharedMats(), brand = branch.brand, B = BRAND[brand], tesco = brand === 'tesco';
  const fix = new Mesher(), prod = new Mesher(), prodNear = prod, prodDeep = new Mesher(), prodBase = new Mesher(), sign = new Mesher(), floor = new Mesher(), ceil = new Mesher(), panel = new Mesher(), outside = new Mesher(), flick = new Mesher();
  const PA = productAtlas(brand).A;
  const SA = new Atlas(2048, 2048);
  SA.add('__blank', 8, 8, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); });
  const R = { bays: [], tills: [], scos: [], lifts: [], news: null, atm: null, reduced: null, doors: [], stats: {} };
  const accent = tesco ? 0x00539f : 0xf06c00, accent2 = tesco ? 0xee1c2e : 0xffffff;
  const white = 0xf4f5f6, grey = 0xb9bec4, dark = 0x2a2d31, steel = 0x9aa1a8;

  yield;
  // ------------------------------------------------------------------ sign artwork for this store
  const brandTile = SA.add('brand', 512, 96, (g, w, h) => drawFascia(g, w, h, brand, branch.fmt));
  const mdTile = SA.add('mealdeal', 512, 96, (g, w, h) => {
    if (tesco) { g.fillStyle = B.blue; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; fitText(g, 'Meal Deal', w * 0.45, h * 0.5); g.fillText('Meal Deal', 16, h / 2); g.fillStyle = '#fff'; g.beginPath(); g.arc(w - 64, h / 2, h * 0.42, 0, 7); g.fill(); g.fillStyle = B.red; g.textAlign = 'center'; fitText(g, '£3', 70, h * 0.5); g.fillText('£3', w - 64, h / 2); g.fillStyle = '#cfe0f4'; g.textAlign = 'left'; fitText(g, 'main + snack + drink', w * 0.36, h * 0.2, 'normal'); g.fillText('main + snack + drink', w * 0.45, h * 0.5); }
    else { g.fillStyle = B.orange; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; fitText(g, 'Meal deal', w * 0.45, h * 0.5); g.fillText('Meal deal', 16, h / 2); g.textAlign = 'center'; fitText(g, '£3', 90, h * 0.6); g.fillText('£3', w - 64, h / 2); g.textAlign = 'left'; fitText(g, 'main, snack & drink', w * 0.3, h * 0.2, 'normal'); g.fillText('main, snack & drink', w * 0.45, h * 0.5); }
  });
  const redTile = SA.add('reduced', 384, 80, (g, w, h) => drawPoster(g, w, h, '#ffe600', [['Reduced to clear', h * 0.5, '#c00000']], '#222'));
  const think25 = SA.add('think25', 160, 220, (g, w, h) => drawPoster(g, w, h, '#ffffff', [['THINK', 34, '#111'], ['25', 80, tesco ? B.red : B.orange], ['If you look under 25', 13, '#333'], ['we will ask for ID', 13, '#333']], '#111'));
  const noAlc = SA.add('noalc', 220, 160, (g, w, h) => drawPoster(g, w, h, '#ffffff', [['Sorry,', 22, '#333'], ['this store does not', 18, '#333'], ['sell alcohol', 26, B.red || '#c00']], '#00539f'));
  const sloganTile = SA.add('slogan', 512, 128, (g, w, h) => { g.fillStyle = tesco ? '#ffffff' : B.orange; g.fillRect(0, 0, w, h); g.fillStyle = tesco ? B.blue : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, B.slogan, w * 0.9, h * 0.42, 'italic bold'); g.fillText(B.slogan, w / 2, h / 2); });
  const cardTile = SA.add('card', 220, 160, (g, w, h) => tesco ? drawPoster(g, w, h, B.blue, [['Clubcard', 34, '#fff'], ['points on everything', 15, '#cfe0f4']]) : drawPoster(g, w, h, '#5a2a8a', [['Nectar', 38, '#fff'], ['collect points here', 15, '#e8d8f8']]));
  const scoTile = SA.add('scoscreen', 128, 96, (g, w, h) => { g.fillStyle = tesco ? '#1b5fae' : '#f07a10'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, 'Touch screen', w * 0.85, 18); g.fillText('Touch screen', w / 2, h * 0.4); fitText(g, 'to start', w * 0.85, 16, 'normal'); g.fillText('to start', w / 2, h * 0.62); });
  const scoHead = SA.add('scohead', 384, 72, (g, w, h) => drawPoster(g, w, h, tesco ? B.blue : B.orange, [['Self Service Checkouts', h * 0.42, '#fff']]));
  const tillTiles = [1, 2, 3].map((n) => SA.add('till' + n, 96, 96, (g, w, h) => drawPoster(g, w, h, tesco ? B.blue : B.orange, [[String(n), 70, '#fff']])));
  const closedTile = SA.add('tillclosed', 192, 64, (g, w, h) => drawPoster(g, w, h, '#ffffff', [['This till is closed', 20, '#c00']], '#888'));
  const liftTile = SA.add('lift', 160, 64, (g, w, h) => drawPoster(g, w, h, '#1d2a3a', [['Lift', 34, '#fff']]));
  const escTile = SA.add('esc', 512, 96, (g, w, h) => drawPoster(g, w, h, tesco ? B.blue : B.orange, [['Lower floor ↓  Food cupboard · Frozen · Beer, wine & spirits', 26, '#fff']]));
  const escTileUp = SA.add('escup', 384, 80, (g, w, h) => drawPoster(g, w, h, tesco ? B.blue : B.orange, [['↑ Ground floor · Checkouts · Exit', 26, '#fff']]));
  const atmTile = SA.add('atm', 128, 128, (g, w, h) => { g.fillStyle = '#20262c'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a8ad0'; g.fillRect(14, 12, 100, 62); g.fillStyle = '#fff'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText('Cash', 64, 38); g.fillText('machine', 64, 54); g.fillStyle = '#8a9198'; for (let i = 0; i < 12; i++) g.fillRect(30 + (i % 3) * 24, 82 + Math.floor(i / 3) * 10, 18, 7); g.fillStyle = '#e8c020'; g.fillRect(4, 4, 30, 6); });
  const outsideTile = SA.add('outside', 512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#c8d6e2'); gr.addColorStop(0.55, '#b9b6ae'); gr.addColorStop(0.62, '#8f8c86'); gr.addColorStop(1, '#a8a49c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = ['#c8b48a', '#a85a3a', '#d8c8a0'][i % 3]; g.fillRect(i * 90 - 10, 20, 80, h * 0.4); g.fillStyle = 'rgba(40,50,60,.5)'; for (let k = 0; k < 3; k++) g.fillRect(i * 90 + 6 + k * 22, 34, 14, 22); }
    for (let i = 0; i < 9; i++) { const x = 20 + i * 55 + (i % 2) * 14; g.fillStyle = ['#2a2a3a', '#6a3a3a', '#3a5a7a', '#5a5a5a'][i % 4]; g.fillRect(x, h * 0.42, 14, h * 0.32); g.fillStyle = '#e0b090'; g.beginPath(); g.arc(x + 7, h * 0.4, 7, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, h);
  });
  const catTiles = {};
  const catTile = (cat) => catTiles[cat] || (catTiles[cat] = SA.add('cat:' + cat, 384, 72, (g, w, h) => drawPoster(g, w, h, tesco ? '#ffffff' : '#ffffff', [[CATEGORIES[cat].label, h * 0.48, tesco ? B.blue : B.orange]], tesco ? B.blue : B.orange)));
  const aisleTile = (n, a, b) => SA.add('aisle' + n, 320, 150, (g, w, h) => {
    g.fillStyle = tesco ? B.blue : B.orange; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 0, 70, h);
    g.fillStyle = tesco ? B.blue : B.orange; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 54px Arial'; g.fillText(String(n), 35, h / 2);
    g.fillStyle = '#fff'; g.textAlign = 'left'; const l1 = CATEGORIES[a].label, l2 = CATEGORIES[b].label;
    fitText(g, l1, w - 84, 24); g.fillText(l1, 80, h * 0.33); if (l2 !== l1) { fitText(g, l2, w - 84, 24); g.fillText(l2, 80, h * 0.68); }
  });
  const gantryTile = SA.add('gantry', 256, 192, (g, w, h) => {   // small stores: tobacco on open display until April 2015
    g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 6; r++) for (let i = 0; i < 12; i++) { g.fillStyle = ['#d8d8d8', '#c02020', '#203a8a', '#e8c040', '#1a1a1a', '#2a7a3a'][(i * 7 + r * 3) % 6]; g.fillRect(6 + i * 20.5, 6 + r * 31, 17, 26); }
    g.fillStyle = '#f0e040'; g.fillRect(0, h - 22, w, 22); g.fillStyle = '#222'; g.font = 'bold 14px Arial'; g.textAlign = 'center'; g.fillText('LOTTO · Scratchcards', w / 2, h - 7);
  });
  const shutterTile = SA.add('shutter', 256, 192, (g, w, h) => {   // large stores: covered gantry from April 2012
    g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = '#80868c'; g.fillRect(x, 0, 2, h); }
    g.fillStyle = '#222'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText('Tobacco · ask at the counter', w / 2, h / 2);
    g.fillStyle = '#f0e040'; g.fillRect(0, h - 22, w, 22); g.fillStyle = '#222'; g.font = 'bold 14px Arial'; g.fillText('LOTTO · Scratchcards', w / 2, h - 7);
  });

  yield;
  // ------------------------------------------------------------------ helpers
  const frame = (f, face = f.face ?? 1) => {
    const rot = (f.axis === 'z' ? PI / 2 : 0) + (face < 0 ? PI : 0), s = Math.sin(rot), c = Math.cos(rot);
    return { rot, s, c, at: (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c], dir: (lx, lz) => [lx * c + lz * s, -lx * s + lz * c] };
  };
  const yOf = (f) => f.y || 0;
  const signQuad = (x, y, z, rot, w, h, uv, both = false) => {   // centred, facing heading rot
    const s = Math.sin(rot), c = Math.cos(rot), ax = c * w, az = -s * w;
    sign.quad(x - ax / 2, y - h / 2, z - az / 2, ax, 0, az, 0, h, 0, { uv });
    if (both) { const nx = s * 0.004, nz = c * 0.004; sign.quad(x + ax / 2 - nx, y - h / 2, z + az / 2 - nz, -ax, 0, -az, 0, h, 0, { uv }); }
  };
  const tileSide = (t) => [t[0], t[1] + (t[3] - t[1]) * 0.05, t[0] + (t[2] - t[0]) * 0.06, t[1] + (t[3] - t[1]) * 0.12];
  const tileTop = (t) => [t[0] + (t[2] - t[0]) * 0.3, t[1] + (t[3] - t[1]) * 0.45, t[0] + (t[2] - t[0]) * 0.6, t[1] + (t[3] - t[1]) * 0.7];
  /** One product at world (x, y, z) facing heading rot. */
  const putProduct = (id, x, y, z, rot, reduced = false) => {
    const p = PRODUCTS[id], t = PA.uv.get(reduced ? 'r:' + id : id);
    const prod = sl ? (y < -1 ? prodBase : z < DEEP_Z ? prodDeep : prodNear) : prodNear;      // (shadows the near batch)
    const v0 = prod.vc; if (slotLog && slotLog.id === id) slotLog.s.push([prod, v0, 0]);      // (a bay's own packs can be taken off the shelf: R.setTaken)
    if (p.shape === 'bottle' || p.shape === 'tin') {
      const r = p.w / 2;
      if (p.shape === 'bottle') {
        prod.cyl(x, y, z, r, p.h * 0.72, 5, { uv: t, rot, cap: false });
        prod.cyl(x, y + p.h * 0.72, z, r, p.h * 0.28, 5, { uv: tileSide(t), rTop: r * 0.32, rot, cap: false });
      } else prod.cyl(x, y, z, r, p.h, 6, { uv: t, rot });
    } else {
      prod.box(x, y, z, p.w, p.h, p.d, rot, { uvFront: t, uv: tileSide(t), uvTop: tileTop(t), skip: NOBACK });
    }
    if (slotLog && slotLog.id === id) slotLog.s[slotLog.s.length - 1][2] = prod.vc - v0;
  };
  let slotLog = null;      // { id, s: [[mesher, first vertex, vertex count]] } while a bay's shelves are being filled
  /** Fill a shelf run with facings. (x,z) = centre of the run front, rot = facing, len along run. */
  const fillRun = (cx, cz, y, rot, len, ids, maxH, depthBack = 0.32) => {
    const c = Math.cos(rot), s = Math.sin(rot), rx = c, rz = -s;     // run direction (local +x)
    let u = -len / 2 + 0.03, k = 0;
    while (u < len / 2 - 0.05) {
      const id = ids[k % ids.length], p = PRODUCTS[id];
      const w = p.shape === 'bottle' || p.shape === 'tin' ? p.w : p.w;
      if (u + w > len / 2) break;
      const n = Math.max(1, Math.min(6, Math.floor((len / ids.length) / (w + 0.012))));
      for (let i = 0; i < n && u + w <= len / 2; i++) {
        const lu = u + w / 2, back = p.d / 2 + 0.03;
        const x = cx + rx * lu - s * back, z = cz + rz * lu - c * back;
        const stack = p.h < maxH * 0.4 ? 2 : 1;
        for (let st = 0; st < stack; st++) putProduct(id, x, y + st * (p.h + 0.004), z, rot);
        // a second row behind for depth
        u += w + 0.012;
      }
      k++;
    }
  };
  /** A shelving side: bays of ~1.3 m with interaction points. */
  const shelfSide = (f, cat, side, levels, depth, frontOff) => {
    // side: +1 = local +z face of the frame
    const fr = frame(f, f.face ?? 1), rot = fr.rot + (side < 0 ? PI : 0), y0 = yOf(f);
    const items = CATEGORIES[cat].items, nb = Math.max(1, Math.round(f.len / 1.3)), bl = f.len / nb;
    for (let b = 0; b < nb; b++) {
      const lu = -f.len / 2 + bl * (b + 0.5), main = items[(b + (f.x * 3 + f.z * 5 & 7)) % items.length];
      const others = items.filter((i) => i !== main);
      const log = (slotLog = { id: main, s: [] });
      levels.forEach((ly, li) => {
        const [x, z] = fr.at(lu, side * frontOff);
        const ids = li === 1 || li === 2 || !others.length ? [main] : [others[(li + b) % others.length], main];
        fillRun(x, z, y0 + ly, rot, bl - 0.06, ids, (levels[li + 1] ?? ly + 0.45) - ly - 0.06);
      });
      const [ix, iz] = fr.at(lu, side * (depth / 2 + 0.55));
      R.bays.push({ x: ix, y: y0, z: iz, id: main, cat });
      slotLog = null; R.bays[R.bays.length - 1].slots = log.s;
    }
  };
  const shelfBody = (f, depth, h, doubleSided, levels, style) => {
    const fr = frame(f), y0 = yOf(f), body = style === 'wood' ? 0x8a6a44 : style === 'crate' ? 0x7a5a3a : white;
    const [cx, cz] = fr.at(0, 0);
    fix.box(cx, y0, cz, f.len, 0.12, depth, fr.rot, { color: dark });                          // kick plate
    if (doubleSided) fix.box(cx, y0, cz, f.len, h, 0.06, fr.rot, { color: style === 'crate' ? body : 0xdfe3e6 });
    else { const [bx, bz] = fr.at(0, -depth / 2 + 0.03); fix.box(bx, y0, bz, f.len, h, 0.06, fr.rot, { color: style ? body : 0xdfe3e6 }); }
    for (const sx of [-1, 1]) { const [ex, ez] = fr.at(sx * (f.len / 2 - 0.02), 0); fix.box(ex, y0, ez, 0.04, h, depth, fr.rot, { color: style ? body : grey }); }
    for (const ly of levels) for (const side of doubleSided ? [-1, 1] : [1]) {
      const zc = doubleSided ? side * depth / 4 : 0, sd = doubleSided ? depth / 2 - 0.04 : depth - 0.06;
      const [sx2, sz2] = fr.at(0, zc); fix.box(sx2, y0 + ly - 0.025, sz2, f.len - 0.06, 0.025, sd, fr.rot, { color: style ? body : 0xeef0f2 });
      const [px, pz] = fr.at(0, side * (doubleSided ? depth / 2 - 0.02 : depth / 2 - 0.02) + (doubleSided ? 0 : 0));
      fix.box(px, y0 + ly - 0.045, pz, f.len - 0.06, 0.045, 0.012, fr.rot, { color: tesco ? 0xffffff : 0xfdf3e8 });   // ticket strip
    }
    if (doubleSided && !style) for (const sx of [-1, 1]) {   // end cap promo panel
      const [ex, ez] = fr.at(sx * (f.len / 2 + 0.02), 0);
      fix.box(ex, y0 + 0.12, ez, 0.04, h - 0.12, depth, fr.rot, { color: accent });
    }
    collider.addBox(cx, cz, f.len, depth, fr.rot);
  };

  yield;
  // ------------------------------------------------------------------ rooms
  const rooms = L.rooms;
  const wallCol = 0xf2f1ec;
  rooms.forEach((rm, ri) => {
    const { x0, x1, z0, z1, y, h } = rm, W = x1 - x0, D = z1 - z0;
    floor.quad(x0, y, z1, W, 0, 0, 0, 0, -D, { uvm: 1, uo: x0, vo: -z1 });
    ceil.quad(x0, y + h, z0, W, 0, 0, 0, 0, D, { uvm: 1 });
    // light panels in rows
    let k = 0;
    for (let z = z1 - 2.2; z > z0 + 0.8; z -= 2.4) for (let x = x0 + 1.6; x < x1 - 1.0; x += 3.0) {
      const m = (ri === 0 && k++ === 5) ? flick : panel;
      m.quad(x - 0.6, y + h - 0.012, z - 0.15, 1.2, 0, 0, 0, 0, 0.3);
    }
    const seg = (ax, az, bx, bz) => collider.addSegment(ax, az, bx, bz, { tag: 'wall' });
    const wallRun = (ax, az, bx, bz, gaps = []) => {   // gaps: [[a,b]] along the run (metres from a)
      const L2 = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L2, dz = (bz - az) / L2, rot = Math.atan2(-dz, dx);
      let s = 0; const solid = [];
      for (const [ga, gb] of gaps.sort((p, q) => p[0] - q[0])) { solid.push([s, ga]); s = gb; }
      solid.push([s, L2]);
      for (const [a, b] of solid) if (b - a > 0.02) {
        const mx = ax + dx * (a + b) / 2, mz = az + dz * (a + b) / 2;
        fix.box(mx, y, mz, b - a, h, 0.2, rot, { color: wallCol, colors: {} });
        fix.box(mx, y + h - 0.75, mz, b - a + 0.001, 0.35, 0.24, rot, { color: accent });   // brand colour band
        fix.box(mx, y, mz, b - a + 0.002, 0.12, 0.23, rot, { color: 0x7a7e84 });           // skirting
        seg(ax + dx * a, az + dz * a, ax + dx * b, az + dz * b);
      }
      return solid;
    };
    // N wall
    wallRun(x0, z0, x1, z0, rm.openN ? [[rm.openN[0] - x0, rm.openN[1] - x0]] : []);
    // E, W walls (lift gaps)
    const liftGaps = (wx) => (L.lift || []).filter((l) => Math.abs(l.x - wx) < 0.3 && Math.abs(l.y - y) < 1).map((l) => [l.z - z0 - 0.7, l.z - z0 + 0.7]);
    wallRun(x1, z0, x1, z1); wallRun(x0, z0, x0, z1, liftGaps(x0).map(([a, b]) => [a, b]));
    // S wall: the shop front (glass onto the street) or a plain wall with the escalator opening
    if (rm.front) {
      const dw = rm.front.w, dx0 = rm.front.x - dw / 2, dx1 = rm.front.x + dw / 2;
      for (const [a, b] of sl ? [] : [[x0, dx0], [dx1, x1]]) {
        if (b - a < 0.05) continue;
        fix.box((a + b) / 2, y, z1, b - a, 0.45, 0.2, 0, { color: dark });                      // stallriser
        fix.box((a + b) / 2, y + 2.7, z1, b - a, h - 2.7, 0.2, 0, { color: wallCol });          // above the glass
        outside.quad(b, y + 0.45, z1 - 0.06, a - b, 0, 0, 0, 2.25, 0, { uv: outsideTile });
        for (let x = a; x <= b + 0.01; x += Math.max(1.2, (b - a) / Math.max(1, Math.round((b - a) / 2.2)))) fix.box(Math.min(b - 0.04, Math.max(a + 0.04, x)), y, z1 - 0.02, 0.08, 2.7, 0.16, 0, { color: 0x555a60 });
        seg(a, z1, b, z1);
      }
      if (sl) {
        // walk-in: wall either side of the doorway, open where the real windows are (stallriser below, wall above)
        for (const [a, b] of [[x0, dx0], [dx1, x1]]) {
          if (b - a < 0.05) continue;
          const ws = sl.wins.filter(([wa, wb]) => wa >= a - 0.01 && wb <= b + 0.01).sort((p, q) => p[0] - q[0]);
          let c = a;
          for (const [wa, wb] of ws) {
            if (wa - c > 0.02) fix.box((c + wa) / 2, y, z1, wa - c, h, 0.2, 0, { color: wallCol });
            fix.box((wa + wb) / 2, y, z1, wb - wa, 0.45, 0.2, 0, { color: dark }); fix.box((wa + wb) / 2, y + 2.7, z1, wb - wa, h - 2.7, 0.2, 0, { color: wallCol });
            c = wb;
          }
          if (b - c > 0.02) fix.box((c + b) / 2, y, z1, b - c, h, 0.2, 0, { color: wallCol });
          seg(a, z1, b, z1);
        }
      }
      fix.box(rm.front.x, y + 2.4, z1, dw + 0.2, h - 2.4, 0.22, 0, { color: 0x555a60 });
      if (!sl) outside.quad(dx1, y, z1 + 0.25, -dw, 0, 0, 0, 2.4, 0, { uv: outsideTile });               // seen through the doors
      seg(dx0, z1 + 0.1, dx1, z1 + 0.1);
      if (!sl) R.doors.push({ x: rm.front.x, y, z: z1 - 0.05, w: dw, axis: 'x' });
      fix.box(rm.front.x, y - 0.005, z1 - 1.0, dw + 0.4, 0.012, 1.6, 0, { color: 0x2a2c30 });   // dark entrance mat
      for (const sx of [-1, 1]) { fix.box(rm.front.x + sx * (dw / 2 + 0.3), y, z1 - 0.7, 0.14, 1.5, 0.3, 0, { color: 0xd8dde2 }); collider.addBox(rm.front.x + sx * (dw / 2 + 0.3), z1 - 0.7, 0.14, 0.3); }   // security pillars
      // posters on the inside of the glass (backs) + slogan above the door inside
      signQuad(rm.front.x, y + 2.95, z1 - 0.13, PI, Math.min(3.2, dw + 1.4), 0.6, brandTile);
    } else wallRun(x1, z1, x0, z1, rm.openS ? [[x1 - rm.openS[1], x1 - rm.openS[0]]] : []);
    // posters on the walls
    signQuad(x0 + 0.12, y + 1.9, z1 - Math.min(D * 0.45, 6), PI / 2, 1.4, 0.35, sloganTile);
    signQuad(x1 - 0.12, y + 2.1, z0 + Math.min(4, D * 0.3), -PI / 2, 0.55, 0.4, cardTile);
  });
  yield;
  // ---- foyer (two sets of automatic doors)
  if (L.foyer) {
    const F = L.foyer, rm = rooms[0];
    for (const x of [F.x0, F.x1]) { fix.box(x, 0, F.z / 2, 0.12, rm.h - 0.6, -F.z, 0, { color: 0x6a7076 }); collider.addSegment(x, 0, x, F.z); }
    fix.box(0, 2.55, F.z, F.x1 - F.x0, rm.h - 2.55, 0.15, 0, { color: 0x555a60 });
    R.doors.push({ x: (F.x0 + F.x1) / 2, y: 0, z: F.z, w: Math.min(2.0, F.x1 - F.x0 - 0.3), axis: 'x', inner: true });
  }
  yield;
  // ---- escalator (Tesco Magdalen)
  if (L.escalator) {
    const E = L.escalator, yT = 0, yB = BASEMENT_Y, run = E.zTop - E.zBot, rise = yT - yB, hTop = rooms[0].h;
    for (const x of [E.x0, E.x1]) {   // well side walls
      fix.box(x, yB, (E.zTop + E.zBot) / 2, 0.2, hTop - yB, run, 0, { color: wallCol });
      collider.addSegment(x, E.zTop, x, E.zBot, { tag: 'wall' });
    }
    // sloped ceiling over the well
    const ceilB = yB + rooms[1].h;
    ceil.quad(E.x0, hTop, E.zTop, 0, ceilB - hTop, -run, E.x1 - E.x0, 0, 0, { uvm: 1 });
    // two lanes: balustrades, handrails and steps
    const laneW = (E.x1 - E.x0) / 2;
    for (let lane = 0; lane < 2; lane++) {
      const lx0 = E.x0 + lane * laneW + 0.1, lx1 = lx0 + laneW - 0.2;
      const n = 24;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, z = E.zTop - run * t0, yy = yT - rise * t0;
        fix.box((lx0 + lx1) / 2, yy - 0.2, z - run / n / 2, lx1 - lx0, 0.2, run / n, 0, { color: i % 2 ? 0x3a3d42 : 0x4a4e54 });
        fix.box((lx0 + lx1) / 2, yy - 0.02, z - 0.03, lx1 - lx0, 0.03, 0.05, 0, { color: 0xe8c020 });   // yellow step edges
      }
      // balustrade slabs (sloped boxes approximated by quads both sides)
      for (const bx of [lx0 - 0.05, lx1 + 0.05]) {
        for (const sgn of [-1, 1]) fix.quad(bx + sgn * 0.02, yT, E.zTop, 0, -rise, -run, 0, 0.95, 0, { color: 0xc8d0d6, both: true });
        fix.quad(bx - 0.04, yT + 1.0, E.zTop, 0, -rise, -run, 0.08, 0, 0, { color: 0x111111, both: true });   // handrail
      }
    }
    collider.addSegment(E.mid, E.zTop + 0.6, E.mid, E.zBot - 0.6, { tag: 'wall' });   // between the lanes
    fix.box(E.mid, 0, E.zTop + 0.3, 0.16, 1.0, 0.6, 0, { color: 0xc8d0d6 }); fix.box(E.mid, yB, E.zBot - 0.3, 0.16, 1.0, 0.6, 0, { color: 0xc8d0d6 });
    signQuad((E.x0 + E.x1) / 2, 2.95, E.zTop + 0.12, 0, 2.6, 0.48, escTile, true);
    signQuad((E.x0 + E.x1) / 2, yB + 2.8, E.zBot - 0.12, PI, 2.4, 0.5, escTileUp, true);
    R.escalator = E;
  }

  yield;
  // ------------------------------------------------------------------ fixtures
  let aisleN = 0;
  let _fy = 0;
  for (const f of L.fixtures) {
    const y0 = yOf(f), fr = frame(f), rm = rooms.find((r) => Math.abs(r.y - y0) < 0.5) || rooms[0], ceilY = rm.y + rm.h;
    switch (f.t) {
      case 'gondola': {
        const h = f.h || 1.7, depth = 0.9, levels = h < 1.2 ? [0.55, 0.85] : [0.18, 0.56, 0.94, 1.32];
        shelfBody(f, depth, h, true, levels, f.style);
        shelfSide(f, f.cats[0], -1, levels, depth, depth / 2 - 0.02);
        shelfSide(f, f.cats[1], 1, levels, depth, depth / 2 - 0.02);
        if (f.aisle) {
          aisleN = f.aisle;
          const t = aisleTile(f.aisle, f.cats[0], f.cats[1]), [hx, hz] = fr.at(0, 0);
          signQuad(hx, ceilY - 0.75, hz, fr.rot + PI / 2, 1.5, 0.7, t, true);
          for (const sx of [-0.6, 0.6]) { const [wx, wz] = [hx + Math.cos(fr.rot + PI / 2) * sx, hz - Math.sin(fr.rot + PI / 2) * sx]; fix.box(wx, ceilY - 0.42, wz, 0.012, 0.42, 0.012, 0, { color: 0x333333 }); }
        } else if (f.style === 'crate') { const [hx, hz] = fr.at(0, 0); signQuad(hx, y0 + 1.6, hz, fr.rot, 1.3, 0.25, catTile(f.cats[0]), true); fix.box(hx, y0 + 1.0, hz, 0.04, 0.5, 0.04, 0, { color: 0x333333 }); }
        break;
      }
      case 'wallshelf': {
        const h = f.h || 1.9, depth = 0.5, levels = h < 1.6 ? [0.3, 0.7, 1.1] : [0.18, 0.56, 0.94, 1.32, 1.66];
        shelfBody(f, depth, h, false, levels, f.style);
        shelfSide(f, f.cat, 1, levels, depth, depth / 2 - 0.03);
        const [hx, hz] = fr.at(0, -depth / 2 + 0.05); signQuad(hx + Math.sin(fr.rot) * 0.06, y0 + h + 0.28, hz + Math.cos(fr.rot) * 0.06, fr.rot, Math.min(2.2, f.len * 0.8), 0.42, catTile(f.cat));
        break;
      }
      case 'chiller': {
        const depth = 0.85, h = 2.05, freezer = f.style === 'freezer', [cx, cz] = fr.at(0, 0);
        const levels = [0.42, 0.8, 1.15, 1.5];
        fix.box(cx, y0, cz, f.len, 0.36, depth, fr.rot, { colors: { front: 0x1a1c20 }, color: white });   // base + grille
        const [bx, bz] = fr.at(0, -depth / 2 + 0.04); fix.box(bx, y0, bz, f.len, h, 0.08, fr.rot, { color: freezer ? 0xdfe6ec : 0xe9f2f8 });
        const [tx, tz] = fr.at(0, -0.05); fix.box(tx, y0 + h - 0.22, tz, f.len, 0.22, depth - 0.1, fr.rot, { color: freezer ? 0xe6e8ea : accent });   // canopy
        for (const sx of [-1, 1]) { const [ex, ez] = fr.at(sx * (f.len / 2 - 0.03), 0); fix.box(ex, y0, ez, 0.06, h, depth, fr.rot, { color: 0xd8dde2 }); }
        for (const ly of levels.slice(1)) { const [sx2, sz2] = fr.at(0, 0.0); fix.box(sx2, y0 + ly - 0.02, sz2, f.len - 0.1, 0.02, depth - 0.25, fr.rot, { color: 0xc0c8d0 }); }
        if (freezer) for (let u = -f.len / 2; u <= f.len / 2 + 0.01; u += f.len / Math.max(1, Math.round(f.len / 0.75))) { const [mx, mz] = fr.at(u, depth / 2 - 0.02); fix.box(mx, y0 + 0.36, mz, 0.05, h - 0.58, 0.05, fr.rot, { color: 0x3a3e44 }); }
        // light strip under the canopy
        const s = Math.sin(fr.rot), c = Math.cos(fr.rot), [lx, lz] = fr.at(-f.len / 2 + 0.05, depth / 2 - 0.12);
        panel.quad(lx, y0 + h - 0.23, lz, c * (f.len - 0.1), 0, -s * (f.len - 0.1), s * 0.06, 0, c * 0.06);
        shelfSide(f, f.cat, 1, levels, depth, depth / 2 - 0.12);
        const [hx, hz] = fr.at(0, depth / 2 - 0.04);
        if (f.header) signQuad(hx + s * 0.02, y0 + h - 0.11, hz + c * 0.02, fr.rot, Math.min(f.len - 0.2, 3.4), 0.2, mdTile);
        else signQuad(hx + s * 0.02, y0 + h - 0.11, hz + c * 0.02, fr.rot, Math.min(f.len - 0.2, 1.1), 0.2, catTile(f.cat));
        if (f.header) { const [px, pz] = fr.at(0, -depth / 2 + 0.1); signQuad(px + s * 0.01, y0 + h + 0.32, pz + c * 0.01, fr.rot, Math.min(f.len, 3.6), 0.62, mdTile); }
        collider.addBox(cx, cz, f.len, depth, fr.rot);
        break;
      }
      case 'freezer': {
        const w = 0.95, h = 0.85, [cx, cz] = fr.at(0, 0);
        for (const side of [-1, 1]) { const [sx, sz] = fr.at(0, side * (w / 2 - 0.04)); fix.box(sx, y0, sz, f.len, h, 0.08, fr.rot, { color: 0xf2f4f6 }); }
        for (const ex of [-1, 1]) { const [qx, qz] = fr.at(ex * (f.len / 2 - 0.04), 0); fix.box(qx, y0, qz, 0.08, h, w, fr.rot, { color: 0xf2f4f6 }); }
        fix.box(cx, y0, cz, f.len, 0.45, w - 0.1, fr.rot, { color: 0xcfe2ee });
        fix.box(cx, y0 + h, cz, f.len, 0.03, 0.06, fr.rot, { color: steel });
        // packs lying in the well
        const items = CATEGORIES[f.cat].items, nb = Math.max(1, Math.round(f.len / 1.3)), bl = f.len / nb;
        for (let b = 0; b < nb; b++) {
          const id = items[b % items.length], p = PRODUCTS[id], lu0 = -f.len / 2 + bl * b + 0.08;
          for (let u = lu0; u < lu0 + bl - 0.1 - Math.min(p.w, 0.3); u += Math.min(p.w, 0.3) + 0.02) for (const side of [-1, 1]) {
            const [px, pz] = fr.at(u + p.w / 2, side * 0.2);
            putProduct(id, px, y0 + 0.45, pz, fr.rot + (side < 0 ? PI : 0));
          }
          for (const side of [-1, 1]) { const [ix, iz] = fr.at(lu0 + bl / 2, side * (w / 2 + 0.5)); R.bays.push({ x: ix, y: y0, z: iz, id, cat: f.cat }); }
        }
        const [hx, hz] = fr.at(0, 0); signQuad(hx, y0 + 1.75, hz, fr.rot, 1.8, 0.34, catTile(f.cat), true);
        fix.box(hx, y0 + h, hz, 0.03, 0.75, 0.03, 0, { color: 0x333333 });
        collider.addBox(cx, cz, f.len, w, fr.rot);
        break;
      }
      case 'till': {
        const [cx, cz] = fr.at(0, 0), side = f.side || -1, rot = fr.rot;
        // desk: conveyor (black) -> scanner -> bagging area
        fix.box(cx, y0, cz, f.len, 0.86, 0.62, rot, { color: 0xd4d8dc, colors: { top: 0x2a2a2a } });
        const [kx, kz] = fr.at(f.len * 0.2, 0); fix.box(kx, y0 + 0.86, kz, 0.4, 0.015, 0.5, rot, { color: 0x101418 });   // scanner glass
        const [ax, az] = fr.at(f.len / 2 - 0.35, 0); fix.box(ax, y0 + 0.86, az, 0.7, 0.03, 0.6, rot, { color: 0xb0b6bc });   // bagging
        const [mx, mz] = fr.at(f.len * 0.2, side * 0.25); fix.box(mx, y0 + 0.86, mz, 0.04, 0.35, 0.04, rot, { color: 0x333333 }); fix.box(mx, y0 + 1.2, mz, 0.36, 0.26, 0.05, rot + (side < 0 ? PI : 0), { color: 0x1a1a1a });  // till screen
        const [chx, chz] = fr.at(f.len * 0.1, side * 0.75); fix.cyl(chx, y0, chz, 0.2, 0.62, 8, { color: 0x2a2a2a });   // cashier's stool
        const [px, pz] = fr.at(-f.len / 2 + 0.05, 0); fix.box(px, y0 + 0.86, pz, 0.05, 1.5, 0.05, rot, { color: 0x666666 });
        const lane = f.closed ? closedTile : tillTiles[(f.id || 0) % 3];
        signQuad(px, y0 + 2.4, pz, rot + PI / 2, f.closed ? 0.6 : 0.34, f.closed ? 0.2 : 0.34, lane, true);
        collider.addBox(cx, cz, f.len, 0.62, rot); collider.addCircle(chx, chz, 0.2);      // (the stool is solid too)
        // (the cashier stands beside the stool, at the scanner — not in it: both were put on one spot)
        const [cux, cuz] = fr.at(f.len * 0.15, -side * 0.7), [cax, caz] = fr.at(f.len * 0.1 + 0.46, side * 0.75);
        const toCust = Math.atan2(cux - cax, cuz - caz);
        R.tills.push({ id: f.id || 0, x: cx, y: y0, z: cz, cust: [cux, cuz, toCust + PI], cashier: [cax, caz, toCust], closed: !!f.closed });
        break;
      }
      case 'sco': {
        const n = f.n || 4;
        for (let i = 0; i < n; i++) {
          const lu = (i - (n - 1) / 2) * 1.0, [ux, uz] = fr.at(lu, 0);
          fix.box(ux, y0, uz, 0.55, 0.92, 0.5, fr.rot, { color: 0xdfe3e6 });                       // body + scanner
          const [bx, bz] = fr.at(lu + 0.42, 0.02); fix.box(bx, y0, bz, 0.34, 0.8, 0.44, fr.rot, { color: 0xc4cacf });   // bagging platform
          fix.box(bx, y0 + 0.8, bz, 0.3, 0.02, 0.4, fr.rot, { color: 0x9aa1a8 });
          const [hx, hz] = fr.at(lu + 0.42, -0.18); fix.box(hx, y0 + 0.8, hz, 0.02, 0.45, 0.02, fr.rot, { color: 0x444444 });   // bag hanger
          const [sx, sz] = fr.at(lu - 0.05, -0.12); fix.box(sx, y0 + 0.92, sz, 0.04, 0.3, 0.04, fr.rot, { color: 0x333333 });
          const [qx, qz] = fr.at(lu - 0.05, -0.08); const s = Math.sin(fr.rot), c = Math.cos(fr.rot);
          signQuad(qx + s * 0.02, y0 + 1.3, qz + c * 0.02, fr.rot, 0.34, 0.26, scoTile);
          fix.box(qx, y0 + 1.15, qz, 0.38, 0.3, 0.03, fr.rot, { color: 0x1a1a1a });
          const [lx, lz] = fr.at(lu - 0.2, -0.15); fix.cyl(lx, y0 + 0.92, lz, 0.03, 0.75, 6, { color: 0x666666 });
          fix.cyl(lx, y0 + 1.67, lz, 0.06, 0.12, 6, { color: 0x7ad07a });   // status light (green)
          const [stx, stz] = fr.at(lu, 0.72);
          R.scos.push({ x: stx, y: y0, z: stz, h: fr.rot + PI, unit: [ux, uz], light: [lx, y0 + 1.73, lz] });
        }
        const [cx, cz] = fr.at(0, 0); collider.addBox(cx, cz, n * 1.0, 0.55, fr.rot);
        signQuad(cx, ceilY - 0.7, cz, fr.rot, 2.4, 0.45, scoHead, true);
        break;
      }
      case 'kiosk': {
        const [cx, cz] = fr.at(0, 0), big = branch.fmt === 'metro' || branch.fmt === 'super';
        if (!f.gantryOnly) { fix.box(cx, y0, cz, f.len, 1.02, 0.62, fr.rot, { color: 0xd8dce0, colors: { top: 0x8a9096 } }); collider.addBox(cx, cz, f.len, 0.62, fr.rot); }
        const [gx, gz] = fr.at(0, f.gantryOnly ? 0 : -1.0); fix.box(gx, y0, gz, f.len, 2.1, 0.32, fr.rot, { color: 0x2a2c30 });
        const s = Math.sin(fr.rot), c = Math.cos(fr.rot);
        signQuad(gx + s * 0.17, y0 + 1.3, gz + c * 0.17, fr.rot, f.len - 0.2, 1.4, big ? shutterTile : gantryTile);
        if (f.gantryOnly) collider.addBox(gx, gz, f.len, 0.32, fr.rot);
        else collider.addBox(gx, gz, f.len, 0.32, fr.rot);
        signQuad(gx + s * 0.17, y0 + 2.3, gz + c * 0.17, fr.rot, 0.5, 0.7, think25);
        break;
      }
      case 'news': {
        const [cx, cz] = fr.at(0, 0);
        for (let k = 0; k < 3; k++) { const [tx, tz] = fr.at(0, 0.15 - k * 0.15); fix.box(tx, y0, tz, f.len, 0.45 + k * 0.25, 0.18, fr.rot, { color: 0x6a5a48 }); }
        for (let k = 0; k < 3; k++) for (let u = -f.len / 2 + 0.2; u < f.len / 2 - 0.15; u += 0.33) { const [px, pz] = fr.at(u, 0.15 - k * 0.15); putProduct('paper', px, y0 + 0.45 + k * 0.25, pz, fr.rot); }
        collider.addBox(cx, cz, f.len, 0.55, fr.rot);
        const [ix, iz] = fr.at(0, 0.9); R.bays.push({ x: ix, y: y0, z: iz, id: 'paper', cat: 'news' });
        break;
      }
      case 'mags': {
        const [cx, cz] = fr.at(0, -0.1); fix.box(cx, y0, cz, f.len, 1.8, 0.3, fr.rot, { color: 0xdfe3e6 });
        const cols = [0xd02020, 0x2050c0, 0xf0c020, 0x20a060, 0xe060a0, 0x111111, 0xf08020, 0x8040c0];
        for (let r = 0; r < 4; r++) for (let u = -f.len / 2 + 0.15; u < f.len / 2 - 0.1; u += 0.24) { const [mx, mz] = fr.at(u, 0.07); fix.box(mx, y0 + 0.25 + r * 0.38, mz, 0.21, 0.29, 0.015, fr.rot + 0.0, { color: cols[(r * 5 + Math.round(u * 10)) & 7] }); }
        collider.addBox(cx, cz, f.len, 0.3, fr.rot);
        break;
      }
      case 'baskets': {
        const col = B.basket;
        for (let k = 0; k < 9; k++) fix.box(f.x, y0 + 0.08 + k * 0.07, f.z, 0.46, 0.2, 0.34, 0.05 * (k % 2), { color: col, colors: { top: 0x1a1a1a } });
        fix.box(f.x, y0, f.z, 0.5, 0.08, 0.38, 0, { color: 0x333333 });
        collider.addBox(f.x, f.z, 0.5, 0.38, 0);
        break;
      }
      case 'trolleys': {
        for (let k = 0; k < (f.n || 5); k++) {
          const x = f.x + k * 0.28;
          fix.box(x, y0 + 0.3, f.z, 0.8, 0.5, 0.56, PI / 2, { color: 0xa8b0b8 });
          fix.box(x + 0.42, y0 + 0.95, f.z, 0.04, 0.04, 0.56, 0, { color: B.basket });
          for (const sz of [-0.22, 0.22]) fix.cyl(x - 0.3, y0, f.z + sz, 0.05, 0.1, 6, { color: 0x222222 });
        }
        collider.addBox(f.x + (f.n || 5) * 0.14, f.z, (f.n || 5) * 0.28 + 0.8, 0.6, 0);
        break;
      }
      case 'reduced': {
        const depth = 0.7, h = 1.5, [cx, cz] = fr.at(0, 0), s = Math.sin(fr.rot), c = Math.cos(fr.rot);
        fix.box(cx, y0, cz, f.len, 0.3, depth, fr.rot, { color: 0xe8ecef });
        const [bx, bz] = fr.at(0, -depth / 2 + 0.04); fix.box(bx, y0, bz, f.len, h, 0.06, fr.rot, { color: 0xffe600 });
        for (const ly of [0.7, 1.1]) { const [sx, sz] = fr.at(0, 0); fix.box(sx, y0 + ly - 0.02, sz, f.len - 0.06, 0.02, depth - 0.1, fr.rot, { color: 0xc0c8d0 }); }
        const [hx, hz] = fr.at(0, -depth / 2 + 0.1); signQuad(hx + s * 0.01, y0 + h + 0.25, hz + c * 0.01, fr.rot, Math.min(f.len, 1.8), 0.38, redTile);
        collider.addBox(cx, cz, f.len, depth, fr.rot);
        // slot positions for the yellow-sticker packs
        const slots = [];
        for (const ly of [0.3, 0.7, 1.1]) for (let u = -f.len / 2 + 0.12; u < f.len / 2 - 0.1; u += 0.27) { const [px, pz] = fr.at(u, 0.05); slots.push([px, y0 + ly, pz]); }
        const [ix, iz] = fr.at(0, depth / 2 + 0.55);
        R.reduced = { x: ix, y: y0, z: iz, rot: fr.rot, slots };
        break;
      }
      case 'atm': {
        const [cx, cz] = fr.at(0, 0), s = Math.sin(fr.rot), c = Math.cos(fr.rot);
        fix.box(cx, y0, cz, 0.75, 1.75, 0.4, fr.rot, { color: 0x3a3f46 });
        signQuad(cx + s * 0.205, y0 + 1.25, cz + c * 0.205, fr.rot, 0.6, 0.6, atmTile);
        collider.addBox(cx, cz, 0.75, 0.4, fr.rot);
        const [ix, iz] = fr.at(0, 0.8); R.atm = { x: ix, y: y0, z: iz };
        break;
      }
    }
    if (++_fy % 5 === 0) yield;
  }
  yield;
  // lifts (Tesco Magdalen)
  for (const lf of L.lift || []) {
    const rot = lf.face > 0 ? PI / 2 : -PI / 2, s = Math.sin(rot);
    if (sl && sl.lift) {
      // a real lift (places/_maths_lift.js; the car and its doors are the caller's): here the stainless surround of the
      // landing door in the wall's gap, and the shaft behind the wall — its three walls in the collider, the wall across
      // the door left out (the door's own block is that piece of wall)
      const LW = LIFT.doorW, LH = LIFT.doorH, rmH = (rooms.find((q) => Math.abs(q.y - lf.y) < 1) || rooms[0]).h, bx = lf.x - s * LIFT.depth, hw = LIFT.width / 2;
      const ST = 2.42;      // (the surround's top; over it the wall and its colour band carry on)
      for (const k of [-1, 1]) { fix.box(lf.x, lf.y, lf.z + k * (0.7 + LW / 2) / 2, 0.7 - LW / 2, ST, 0.26, rot, { color: 0xb8c0c8 }); collider.addSegment(lf.x, lf.z + k * 0.7, lf.x, lf.z + k * LW / 2, { tag: 'wall' }); }
      fix.box(lf.x, lf.y + LH, lf.z, LW, ST - LH, 0.26, rot, { color: 0xb8c0c8 });
      fix.box(lf.x, lf.y + ST, lf.z, 1.4, rmH - ST, 0.2, rot, { color: wallCol, colors: {} });
      fix.box(lf.x, lf.y + rmH - 0.75, lf.z, 1.401, 0.35, 0.24, rot, { color: accent });
      fix.box(bx - s * 0.05, lf.y, lf.z, LIFT.width, 2.4, 0.04, rot, { color: 0x1c1e21 });      // (the back of the shaft: dark, behind the car)
      collider.addSegment(bx, lf.z - hw, bx, lf.z + hw, { tag: 'wall' }); collider.addSegment(lf.x, lf.z - hw, bx, lf.z - hw, { tag: 'wall' }); collider.addSegment(lf.x, lf.z + hw, bx, lf.z + hw, { tag: 'wall' });
      signQuad(lf.x + s * 0.14, lf.y + 2.6, lf.z, rot, 0.6, 0.24, liftTile);
      R.lifts.push({ x: lf.x + s * 0.8, y: lf.y, z: lf.z, to: lf.to, h: rot, real: true, shaft: { x0: Math.min(bx, lf.x), x1: Math.max(bx, lf.x), z0: lf.z - hw, z1: lf.z + hw } });
      continue;
    }
    fix.box(lf.x + s * 0.02, lf.y, lf.z, 1.4, 2.4, 0.06, rot, { color: 0xb8c0c8 });
    fix.box(lf.x + s * 0.04, lf.y, lf.z, 0.02, 2.2, 0.08, rot, { color: 0x555555 });
    signQuad(lf.x + s * 0.12, lf.y + 2.6, lf.z, rot, 0.6, 0.24, liftTile);
    collider.addSegment(lf.x, lf.z - 0.7, lf.x, lf.z + 0.7, { tag: 'wall' });
    R.lifts.push({ x: lf.x + s * 0.8, y: lf.y, z: lf.z, to: lf.to, h: rot });
  }
  // posters: Think 25 by the alcohol, "no alcohol" at St Aldate's
  for (const f of L.fixtures) if ((f.cat === 'alcohol' || f.cats?.includes('alcohol')) && f.t !== 'gondola') {
    const fr = frame(f), [px, pz] = fr.at(f.len / 2 + 0.25, -0.2); signQuad(px, yOf(f) + 1.6, pz, fr.rot, 0.36, 0.5, think25);
  }
  if (L.noAlcohol) { const rm = rooms[0]; signQuad(rm.x0 + 0.12, 1.8, -4.5, PI / 2, 0.8, 0.58, noAlc); }

  yield;
  // ------------------------------------------------------------------ meshes
  const prodMat = productAtlas(brand).mat;
  const signTex = SA.texture();
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.FrontSide });
  const outsideMat = new THREE.MeshBasicMaterial({ map: signTex, color: 0xffffff });
  const flickMat = S.panel.clone();
  const meshes = [];
  for (const mk of [() => floor.mesh(S.floor), () => ceil.mesh(S.ceil), () => panel.mesh(S.panel), () => fix.mesh(S.fix), () => prod.mesh(prodMat), () => sign.mesh(signMat)]) { meshes.push(mk()); yield; }
  if (!outside.empty) meshes.push(outside.mesh(outsideMat));
  // (walk-in: the goods far from the shopfront and the goods downstairs are meshes of their own — R.setDeep)
  const deepM = prodDeep.empty ? null : prodDeep.mesh(prodMat);
  yield;
  const baseM = prodBase.empty ? null : prodBase.mesh(prodMat);
  yield;
  if (deepM) { deepM.name = 'shop:goods-deep'; meshes.push(deepM); } if (baseM) { baseM.name = 'shop:goods-lower'; meshes.push(baseM); }
  R.setDeep = (deep, lower) => { if (deepM && deepM.visible !== deep) deepM.visible = deep; if (baseM && baseM.visible !== lower) baseM.visible = lower; };
  R.deepTris = { near: prod.tris | 0, deep: prodDeep.tris | 0, lower: prodBase.tris | 0 };
  // packs taken off a bay's shelves (by any player: places/supermarkets.js): the last n of the bay's own packs are folded
  // away to nothing in the merged goods mesh, and unfolded when put back. Returns how many are off the shelf now.
  R.setTaken = (bi, n) => {
    const bay = R.bays[bi], S0 = bay && bay.slots; if (!S0 || !S0.length) return 0;
    n = Math.max(0, Math.min(S0.length, n | 0));
    for (let k = 0; k < S0.length; k++) {
      const q = S0[k], off = k >= S0.length - n; if (off === !!q[3]) continue;
      const at = q[0].geometry().attributes.position, a = at.array, i0 = q[1] * 3, i1 = (q[1] + q[2]) * 3;
      if (off) { q[4] = q[4] || a.slice(i0, i1); for (let i = i0; i < i1; i += 3) { a[i] = a[i0]; a[i + 1] = a[i0 + 1]; a[i + 2] = a[i0 + 2]; } }
      else a.set(q[4], i0);
      q[3] = off; if (at.addUpdateRange) at.addUpdateRange(i0, i1 - i0); at.needsUpdate = true;
    }
    return (bay.taken = n);
  };
  if (!flick.empty) meshes.push(flick.mesh(flickMat));
  meshes[1].material.side = THREE.DoubleSide;
  for (const m of meshes) scene.add(m);
  yield;
  // sliding doors: 2 panels per doorway, one InstancedMesh
  const doors = new THREE.InstancedMesh(S.boxGeo, S.door, Math.max(1, R.doors.length * 2)); doors.frustumCulled = false; doors.count = R.doors.length * 2; if (R.doors.length) scene.add(doors);
  for (const d of R.doors) d.open = 0;
  // reduced packs: instanced boxes with the yellow-sticker sandwich tile
  let redMesh = null;
  if (R.reduced) {
    const g = new THREE.BoxGeometry(0.2, 0.14, 0.08); const t = PA.uv.get('r:sandwich_cb'), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, t[0] + (t[2] - t[0]) * uv.getX(i), t[1] + (t[3] - t[1]) * uv.getY(i));
    redMesh = new THREE.InstancedMesh(g, prodMat, R.reduced.slots.length); redMesh.count = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R.reduced.rot), one = new THREE.Vector3(1, 1, 1);
    R.reduced.slots.forEach((s, i) => { m4.compose(new THREE.Vector3(s[0], s[1] + 0.07, s[2]), q, one); redMesh.setMatrixAt(i, m4); });
    scene.add(redMesh);
    R.reduced.set = (n) => { redMesh.count = Math.max(0, Math.min(R.reduced.slots.length, n)); };
  }
  yield;
  // lights: a cool fluorescent wash (≤ 3 point lights + the scene's ambient/hemisphere)
  const lights = [];
  for (const [x, y, z] of L.lights.slice(0, 3)) { const l = new THREE.PointLight(0xf2f6ff, 14, 22, 1.4); l.position.set(x, y, z); scene.add(l); lights.push(l); }
  R.lights = lights;

  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  let flickT = 0, flickOn = 1;
  R.update = (dt, px, pz, py, isOpen, daylight) => {
    // doors slide open when you're near (and the shop is open)
    let i = 0;
    for (const d of R.doors) {
      const near = Math.abs(px - d.x) < d.w && Math.abs(pz - d.z) < 2.0 && Math.abs(py - d.y) < 2;
      d.open += ((near && (isOpen || d.inner) ? 1 : 0) - d.open) * Math.min(1, dt * 5);
      const pw = d.w / 2;
      for (const sgn of [-1, 1]) {
        pv.set(d.x + sgn * (pw / 2 + d.open * pw * 0.95), d.y + 1.2, d.z + sgn * 0.03); sc.set(pw, 2.4, 0.03);
        m4.compose(pv, q0, sc); doors.setMatrixAt(i++, m4);
      }
    }
    doors.instanceMatrix.needsUpdate = true;
    // a tired fluorescent tube
    flickT -= dt;
    if (flickT <= 0) { flickOn = Math.random() < 0.82 ? 1 : Math.random() < 0.5 ? 0.15 : 0.55; flickT = flickOn < 1 ? 0.04 + Math.random() * 0.12 : 0.3 + Math.random() * 3.5; }
    flickMat.color.setScalar(0.25 + 0.75 * flickOn);
    if (lights[0]) lights[0].intensity = 14 * (0.9 + 0.1 * flickOn);
    outsideMat.color.setScalar(0.18 + 0.82 * daylight);
  };
  let tris = 0; for (const m of meshes) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  R.stats = { meshes: meshes.length + 2 + (redMesh ? 1 : 0), tris: Math.round(tris), products: prod.vc + prodDeep.vc + prodBase.vc, bays: R.bays.length, lights: lights.length };
  return R;
}
