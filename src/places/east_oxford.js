// East Oxford: The Plain, St Clement's and the Cowley Road (see docs/research/east_oxford.md — what is mapped, what is
// guessed, and which names would have been different c. 2013). The world already builds the terraces, shopfronts, signs
// (map names as plain lettering — no logos), bike stands and bus stops from the map; this module adds character:
//   The Plain      the Victoria Fountain (1899) rebuilt by hand on its mapped spot: an open octagonal stone canopy with
//                  a clock turret (the map's footprint was being drawn as an 11 m stone column)
//   the parade     pubs get pub fronts, a share of the shop units painted render in Cowley Road colours (preMap styles)
//   street art     five invented murals on gable ends along the Cowley Road side streets (generic: sunrise, bicycle,
//                  fish, pattern, hot-air balloons — no real artwork is copied)
//   after dark     short queues outside the takeaways nearest the player (scripted, shared clock) and a kebab van by
//                  Manzil Way Gardens you can buy from (19:00-03:30; the pizza van's pattern and its eating rules)
// Evening footfall on the two streets comes from systems/pedestrians.js (they are shopping + night streets there), buses
// stop at the mapped stops (systems/traffic.js) and a taxi rank waits on the Cowley Road (traffic.js RANKS, a guess).
// Test hooks: game.eastOxford = { van, fountain, murals(), queues(), buy(), eat(), force(open|null), stats() }.
import * as THREE from 'three';
import { createCharacter, randomLook } from '../core/characters.js';
import { EASTPASS } from '../world/terrain.js';
import { VB } from './_sp_build.js';
import { eatEffects } from './_pizza_logic.js';
import { dayOf } from '../core/time.js';

const FOUNTAIN_ID = 'w1419987150', FOUNTAIN = [1072.8, 523.0];
const VAN = { x: 1864.0, z: 934.0, h: 0.983, open: 19, close: 3.5, price: 4.5 };
const EAST_X = 1100;
const hash = (a, b = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const PAINT = ['#e8d8b0', '#d9a878', '#9cc4c0', '#e6c05a', '#d98a8a', '#a8c890', '#c8b8e0', '#f0e6d2', '#88a8c8', '#e0a060'];
const CLEM = ['#f1ece0', '#e6b8c0', '#f4f0e6', '#5f86c8', '#e8dcc0', '#ded8c8', '#c9d6e4'];
const PUB = ['#3a5a40', '#6a2a2a', '#2a3a5a', '#e6dcc0', '#4a3a2a'];
const vanOpen = (h, force = null) => (force === true || force === false ? force : h >= VAN.open || h < VAN.close);
const QUEUE_LINES = ['Chips and cheese. Don\'t judge me.', 'Is it card or cash?', 'Large doner, all the salad.', 'Best bit of the night, this.', 'Garlic mayo AND chilli.', 'How long\'s the wait?'];
const VAN_LINES = ['Salad? Chilli sauce?', 'Two minutes, boss.', 'Chips with that?', 'Open till half three.'];

/** Pure: which venue buildings get which style -> Map(id -> style). Used by preMap and the smoke test. */
export function venueStyles(map) {
  const out = new Map(), venues = map.pois.filter((p) => p.p[0] > EAST_X && /^(pub|bar|restaurant|cafe|fast_food|nightclub|shop:)/.test(p.kind));
  const cand = map.buildings.filter((b) => !b.part && b.c[0] > EAST_X - 20);
  // (photo comparison east, 2026-11: the west half of St Clement's is a run of narrow painted fronts, white, pink and blue)
  let paintMore = false;
  const styleFor = (kind, key) => {
    const h = strHash(key);
    if (kind === 'pub' || kind === 'bar' || kind === 'nightclub') return { wall: h < 0.5 ? 'render' : 'brick', color: h < 0.5 ? PUB[Math.floor(h * 2 * PUB.length) % PUB.length] : undefined, ground: 'pubFront' };
    if (h > (paintMore ? 0.82 : 0.45)) return null;               // most units stay as the world planned them (brick terraces)
    return { wall: 'render', color: (paintMore && h > 0.45 ? CLEM : PAINT)[Math.floor((h / 0.45) * PAINT.length) % PAINT.length], ground: kind === 'cafe' ? 'cafeFront' : undefined };
  };
  for (const b of cand) {
    const t = b.tags || {}, kind = t.amenity || (t.shop ? 'shop:' + t.shop : null);
    if (kind && /^(pub|bar|restaurant|cafe|fast_food|nightclub|shop:)/.test(kind) && t.name) { paintMore = EASTPASS && b.c[0] < 1420 && b.c[1] < 548; const s = styleFor(kind, b.id); if (s) out.set(b.id, s); }
  }
  for (const p of venues) {
    for (const b of cand) {
      if (Math.abs(b.c[0] - p.p[0]) > 40 || Math.abs(b.c[1] - p.p[1]) > 40 || out.has(b.id) || !pip(p.p[0], p.p[1], b.poly)) continue;
      paintMore = EASTPASS && b.c[0] < 1420 && b.c[1] < 548; const s = styleFor(p.kind, b.id); if (s) out.set(b.id, s);
      break;
    }
  }
  return out;
}

function muralAtlas() {
  // four invented murals, 512 x 256 each on one 1024 x 512 canvas (2 x 2)
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  let s = 4711; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const cell = (i, fn) => { g.save(); g.translate((i % 2) * 512, Math.floor(i / 2) * 256); g.beginPath(); g.rect(0, 0, 512, 256); g.clip(); fn(); g.restore(); };
  cell(0, () => {       // sunrise over rooftops, birds
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a3a7a'); gr.addColorStop(0.6, '#e8784a'); gr.addColorStop(1, '#f6d070'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? 'rgba(255,220,120,0.35)' : 'rgba(255,160,80,0.25)'; g.beginPath(); g.moveTo(256, 230); const a = Math.PI + (i / 14) * Math.PI; g.lineTo(256 + Math.cos(a) * 600, 230 + Math.sin(a) * 600); g.lineTo(256 + Math.cos(a + 0.11) * 600, 230 + Math.sin(a + 0.11) * 600); g.fill(); }
    g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(256, 230, 70, Math.PI, 0); g.fill();
    g.fillStyle = '#1c1c30'; for (let x = 0; x < 512; x += 34) { const h = 30 + R() * 46; g.fillRect(x, 256 - h, 34, h); g.beginPath(); g.moveTo(x, 256 - h); g.lineTo(x + 17, 256 - h - 16); g.lineTo(x + 34, 256 - h); g.fill(); g.fillRect(x + 22, 256 - h - 22, 6, 16); }
    g.strokeStyle = '#1c1c30'; g.lineWidth = 3; for (let i = 0; i < 7; i++) { const x = 60 + R() * 400, y = 30 + R() * 80; g.beginPath(); g.arc(x - 8, y, 8, Math.PI * 1.1, Math.PI * 1.9); g.arc(x + 8, y, 8, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  });
  cell(1, () => {       // a giant bicycle among flowers
    g.fillStyle = '#7ec8c0'; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 40; i++) { const x = R() * 512, y = 150 + R() * 106, r = 8 + R() * 12; g.fillStyle = ['#f06a8a', '#f6d040', '#ffffff', '#f09030', '#b070d0'][i % 5]; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.047) * r, y + Math.sin(k * 1.047) * r, r * 0.6, 0, 7); g.fill(); } g.fillStyle = '#5a3a10'; g.beginPath(); g.arc(x, y, r * 0.45, 0, 7); g.fill(); }
    g.strokeStyle = '#1a2a3a'; g.lineWidth = 9; g.lineCap = 'round';
    for (const x of [150, 362]) { g.beginPath(); g.arc(x, 150, 66, 0, 7); g.stroke(); g.lineWidth = 2; for (let k = 0; k < 12; k++) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x + Math.cos(k * 0.5236) * 66, 150 + Math.sin(k * 0.5236) * 66); g.stroke(); } g.lineWidth = 9; }
    g.strokeStyle = '#d83030'; g.beginPath(); g.moveTo(150, 150); g.lineTo(230, 62); g.lineTo(330, 62); g.lineTo(256, 150); g.lineTo(150, 150); g.moveTo(256, 150); g.lineTo(230, 62); g.moveTo(330, 62); g.lineTo(362, 150); g.moveTo(322, 40); g.lineTo(350, 40); g.moveTo(214, 50); g.lineTo(246, 50); g.stroke();
  });
  cell(2, () => {       // fish in bold waves
    g.fillStyle = '#16407a'; g.fillRect(0, 0, 512, 256);
    for (let j = 0; j < 7; j++) { g.strokeStyle = ['#2f6fb8', '#4aa0d0', '#7ed0e0', '#f6f0d8'][j % 4]; g.lineWidth = 14; g.beginPath(); for (let x = -20; x <= 532; x += 8) g.lineTo(x, 30 + j * 36 + Math.sin(x * 0.03 + j * 1.3) * 16); g.stroke(); }
    for (let i = 0; i < 6; i++) { const x = 60 + i * 80 + R() * 20, y = 50 + R() * 160, w = 44 + R() * 30, col = ['#f09030', '#f6d040', '#e04848', '#ffffff'][i % 4]; g.fillStyle = col; g.beginPath(); g.ellipse(x, y, w, w * 0.42, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - w * 0.8, y); g.lineTo(x - w * 1.5, y - w * 0.45); g.lineTo(x - w * 1.5, y + w * 0.45); g.fill(); g.fillStyle = '#10203a'; g.beginPath(); g.arc(x + w * 0.55, y - w * 0.08, 5, 0, 7); g.fill(); }
  });
  cell(3, () => {       // patchwork of patterned diamonds, three balloons
    const cols = ['#e04848', '#f6d040', '#30a050', '#2f6fb8', '#f09030', '#b070d0', '#f6f0d8', '#1a2a3a'];
    for (let y = -1; y < 9; y++) for (let x = -1; x < 17; x++) { g.fillStyle = cols[Math.floor(R() * cols.length)]; g.beginPath(); const cx = x * 32 + (y % 2) * 16, cy = y * 32; g.moveTo(cx, cy - 32); g.lineTo(cx + 16, cy); g.lineTo(cx, cy + 32); g.lineTo(cx - 16, cy); g.fill(); }
    for (const [x, y, r, col] of [[130, 90, 46, '#f6f0d8'], [270, 120, 58, '#e04848'], [400, 80, 40, '#f6d040']]) { g.fillStyle = '#1a2a3a'; g.beginPath(); g.arc(x, y, r + 5, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#1a2a3a'; g.fillRect(x - 9, y + r + 16, 18, 14); g.strokeStyle = '#1a2a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - r * 0.7, y + r * 0.7); g.lineTo(x - 9, y + r + 16); g.moveTo(x + r * 0.7, y + r * 0.7); g.lineTo(x + 9, y + r + 16); g.stroke(); }
  });
  // weathering: paint on brick is never clean
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '60,40,30' : '255,255,255'},${R() * 0.05})`; g.fillRect(R() * 1024, R() * 512, 2 + R() * 26, 1 + R() * 3); }
  for (let y = 0; y < 512; y += 8) { g.fillStyle = 'rgba(40,24,16,0.07)'; g.fillRect(0, y, 1024, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export default {
  id: 'east_oxford',
  preMap(game) {
    try {
      game.overrides.skip.add(FOUNTAIN_ID);
      for (const [id, st] of venueStyles(game.map)) if (!game.overrides.style.has(id)) game.overrides.style.set(id, st);
    } catch (e) { console.error('[east_oxford] preMap', e); }
  },

  install(game) {
    const W = game.world, scene = game.worldScene, col = game.worldCollider, map = game.map;
    const E = (game.eastOxford = { id: 'east_oxford', van: VAN, fountain: FOUNTAIN, forced: null });
    const lamb = new THREE.MeshLambertMaterial({ vertexColors: true });
    const finish = (vb, name, cast = true) => { const g = vb.geometry(); g.deleteAttribute('aGlow'); const m = new THREE.Mesh(g, lamb); m.name = name; m.castShadow = cast; m.receiveShadow = true; W.addStatic(m); return m; };
    let tris = 0;

    // ------------------------------------------------------------------------------------- the Victoria Fountain
    try {
      const [fx, fz] = FOUNTAIN, vb = new VB(), EP = EASTPASS, ST = EP ? 0xd6c8a4 : 0xdcc594, ST2 = EP ? 0xc2b48e : 0xcdb684, TILE = EP ? 0x57524a : 0x9a4a30, WHITE = EP ? 0xf1eee6 : ST, LEAD = EP ? 0x8b9296 : ST, UP = EP ? 0.78 : 0;   // (photo comparison east: a steep grey stone-slate roof, a white clock turret under a lead cap)
      vb.at(fx, fz, Math.PI / 8);
      vb.cyl(3.3, 3.5, 0.18, 8, 0, 0, 0, ST2); vb.cyl(2.9, 3.0, 0.18, 8, 0, 0.18, 0, ST);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 2.35, z = Math.sin(a) * 2.35; vb.cyl(0.26, 0.26, 0.4, 8, x, 0.36, z, ST2); vb.cyl(0.16, 0.19, 2.5, 8, x, 0.76, z, ST); vb.cyl(0.27, 0.18, 0.22, 8, x, 3.26, z, ST2); col.addCircle(fx + Math.cos(a - Math.PI / 8) * 2.35, fz + Math.sin(a - Math.PI / 8) * 2.35, 0.3, { tag: 'fountain' }); }
      vb.cyl(2.75, 2.75, 0.55, 8, 0, 3.48, 0, ST, 0, true); vb.add(new THREE.CircleGeometry(2.75, 8), ST2, 0, 0, 3.5, 0, 0, Math.PI / 2);   // (soffit, seen from underneath) vb.cyl(2.95, 2.8, 0.14, 8, 0, 4.03, 0, ST2);
      if (EP) { vb.cyl(2.25, 3.35, 0.75, 8, 0, 4.0, 0, TILE, 0, true); vb.cyl(1.05, 2.25, 1.9, 8, 0, 4.75, 0, 0x5e594f, 0, true); } else vb.cyl(1.15, 3.05, 1.7, 8, 0, 4.17, 0, TILE, 0, true);   // the stone-slate roof: a broad skirt, then steeper to the turret
      vb.cyl(0.95, 1.1, 0.5, 8, 0, 5.87 + UP, 0, LEAD); vb.box(1.25, 1.2, 1.25, 0, 6.37 + UP, 0, WHITE);     // clock stage
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; vb.add(new THREE.CircleGeometry(0.46, 16), 0xf4f0e2, 0, Math.sin(a) * 0.635, 6.97 + UP, Math.cos(a) * 0.635, a); vb.add(new THREE.PlaneGeometry(0.05, 0.36), 0x1a1a1a, 0, Math.sin(a) * 0.645, 7.1 + UP, Math.cos(a) * 0.645, a); vb.add(new THREE.PlaneGeometry(0.26, 0.05), 0x1a1a1a, 0, Math.sin(a) * 0.645 + Math.cos(a) * 0.1, 6.97 + UP, Math.cos(a) * 0.645 - Math.sin(a) * 0.1, a); }
      vb.cyl(0.9, 0.95, 0.12, 8, 0, 7.57 + UP, 0, WHITE); if (EP) { vb.cyl(0.5, 0.88, 0.5, 8, 0, 7.69 + UP, 0, LEAD, 0, true); vb.cyl(0.08, 0.5, 0.55, 8, 0, 8.19 + UP, 0, LEAD, 0, true); } else vb.cyl(0, 0.85, 1.3, 8, 0, 7.69, 0, 0x5f8f80, 0, true); vb.cyl(0.03, 0.03, 1.1, 5, 0, 8.7 + UP, 0, 0x2a2a2a); vb.box(0.5, 0.05, 0.04, 0, 9.55 + UP, 0, 0xc8a030); vb.box(0.04, 0.05, 0.5, 0, 9.35 + UP, 0, 0x2a2a2a);
      vb.cyl(0.95, 1.05, 0.75, 12, 0, 0.36, 0, ST); vb.cyl(0.8, 0.8, 0.04, 12, 0, 1.08, 0, 0x4a7088); vb.cyl(0.14, 0.2, 0.7, 8, 0, 1.11, 0, ST2);   // the basin and its spout
      col.addCircle(fx, fz, 1.1, { tag: 'fountain' });
      E.fountainMesh = finish(vb, 'east:fountain'); tris += vb.tris;
    } catch (e) { console.error('[east_oxford] fountain', e); }

    // ------------------------------------------------------------------------------------- murals on gable ends
    const murals = [];
    try {
      const mat = new THREE.MeshLambertMaterial({ map: muralAtlas(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      const U = W.util, sideStreet = (x, z) => { let r = null; W.roadGrid.queryRadius(x, z, 13, (it) => { if (it.kind === 'residential' || it.kind === 'unclassified' || it.kind === 'living_street') { r = it; return true; } }); return r; };
      const built = (x, z) => { let hit = false; W.buildingGrid.queryRadius(x, z, 1, (r) => { if (U.pointInPoly(x, z, r.b.poly)) { hit = true; return true; } }); return hit; };
      const nearCowley = (x, z) => { let d = 1e9; W.roadGrid.queryRadius(x, z, 34, (it) => { if (it.name === 'Cowley Road' && it.w >= 8) { const dx = it.bx - it.ax, dz = it.bz - it.az, l2 = dx * dx + dz * dz || 1; let t = ((x - it.ax) * dx + (z - it.az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; d = Math.min(d, Math.hypot(x - it.ax - dx * t, z - it.az - dz * t)); } }); return d; };
      const cands = [];
      for (const b of map.buildings) {
        if (b.part || b.c[0] < 1420 || b.c[0] > 2120 || b.h < 6.5 || game.overrides.skip.has(b.id)) continue;
        const dC = nearCowley(b.c[0], b.c[1]); if (dC > 30) continue;
        const P = b.poly, sgn = U.signedArea(P) > 0 ? 1 : -1;
        for (let i = 0; i < P.length; i++) {
          const a = P[i], c = P[(i + 1) % P.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 7.5 || len > 16) continue;
          const nx = ((c[1] - a[1]) / len) * sgn, nz = (-(c[0] - a[0]) / len) * sgn, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
          if (built(mx + nx * 2.5, mz + nz * 2.5) || built(mx + nx * 5.5, mz + nz * 5.5) || built(mx - nx * 1.5, mz - nz * 1.5) === false) continue;
          if (nearCowley(mx + nx * 6, mz + nz * 6) < 9 || !sideStreet(mx + nx * 6, mz + nz * 6)) continue;      // not the shopfront; a wall on a side street
          cands.push({ id: b.id, a, c, len, nx, nz, mx, mz, h: b.h, key: strHash(b.id + ':' + i) });
        }
      }
      cands.sort((p, q) => p.key - q.key);
      for (const m of cands) {
        if (murals.length >= 5) break;
        if (murals.some((q) => Math.hypot(q.mx - m.mx, q.mz - m.mz) < 110)) continue;
        const w = Math.min(m.len - 1.2, 8.5), hgt = Math.min(w / 2, m.h - 2.6, 4.2), y0 = 1.9, k = murals.length % 4, u0 = (k % 2) * 0.5, v0 = 0.5 - Math.floor(k / 2) * 0.5;
        const g = new THREE.PlaneGeometry(w, hgt); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
        const mesh = new THREE.Mesh(g, mat); mesh.position.set(m.mx + m.nx * 0.13, y0 + hgt / 2, m.mz + m.nz * 0.13); mesh.rotation.y = Math.atan2(m.nx, m.nz); mesh.name = 'east:mural' + murals.length; mesh.castShadow = false;
        W.addStatic(mesh); murals.push({ ...m, w, hgt, mesh }); tris += 2;
      }
    } catch (e) { console.error('[east_oxford] murals', e); }
    E.murals = () => murals.map((m) => ({ building: m.id, x: +m.mx.toFixed(1), z: +m.mz.toFixed(1), w: +m.w.toFixed(1), h: +m.hgt.toFixed(1), facing: [+m.nx.toFixed(2), +m.nz.toFixed(2)] }));

    // ------------------------------------------------------------------------------------- the kebab van
    const CH = Math.cos(VAN.h), SH = Math.sin(VAN.h), V2W = (x, z) => [VAN.x + x * CH + z * SH, VAN.z - x * SH + z * CH];
    const van = new THREE.Group(); van.name = 'east:kebab-van';
    let vanCol = [], chef = null, hatchGlow = null, queue = [], qSig = '', prevProp = null;
    const order = { stage: 'idle', t: 0 };
    try {
      const vb = new VB(); vb.at(VAN.x, VAN.z, VAN.h);
      vb.box(2.25, 2.25, 5.4, 0, 0.55, 0, 0xf4f1e6); vb.box(2.3, 0.1, 5.5, 0, 2.8, 0, 0xd8d8d2); vb.box(2.25, 1.5, 1.5, 0, 0.55, 3.4, 0xe8e4d6); vb.box(2.0, 0.7, 0.06, 0, 1.55, 4.16, 0x26323c);
      for (const z of [-1.7, 2.6]) for (const x of [-1.05, 1.05]) vb.add(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10), 0x151515, 0, x, 0.36, z, 0, 0, Math.PI / 2);
      vb.box(1.25, 0.05, 3.0, -1.7, 2.5, -0.4, 0xc82020, 0, 0, 0, 0.3); vb.box(0.5, 0.05, 2.8, -1.38, 1.5, -0.4, 0x909090);                // awning + counter
      vb.box(0.3, 0.9, 0.3, 0.3, 2.85, -1.9, 0x777777);
      const bg = vb.geometry(); bg.deleteAttribute('aGlow');
      const body = new THREE.Mesh(bg, lamb); body.name = 'east:kebab-van-body'; body.castShadow = true; body.matrixAutoUpdate = false; van.add(body); tris += vb.tris;
      hatchGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
      const hp = V2W(-1.135, -0.4); hatchGlow.position.set(hp[0], 2.05, hp[1]); hatchGlow.rotation.y = VAN.h - Math.PI / 2; van.add(hatchGlow);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.5), new THREE.MeshBasicMaterial({ map: W.tex.sign('KEBABS · BURGERS · CHIPS · OPEN LATE', { bg: '#b01818', fg: '#fff2c0' }) }));
      const sp = V2W(-1.14, 0); sign.position.set(sp[0], 2.58 + 0.34, sp[1]); sign.rotation.y = VAN.h - Math.PI / 2; van.add(sign);
      van.visible = false; scene.add(van); van.updateMatrixWorld(true);   // (core/cull.js reads matrixWorld when it first sees a mesh)
      vanCol = col.addPolygon([[-1.15, -2.75], [1.15, -2.75], [1.15, 4.2], [-1.15, 4.2]].map(([x, z]) => V2W(x, z)), { tag: 'vehicle' }); for (const s of vanCol) s.on = false;
      try { W.clearArea([[-2.6, -3.4], [1.8, -3.4], [1.8, 4.8], [-2.6, 4.8]].map(([x, z]) => V2W(x, z)), { trees: true, lamps: false }); } catch { /* */ }
    } catch (e) { console.error('[east_oxford] van', e); }
    const open = () => vanOpen(game.time.hour, E.forced);
    const hatch = V2W(-2.0, -0.4);
    E.buy = () => {
      if (!open()) return 'closed';
      if (order.stage !== 'idle') return 'busy';
      if (!((game.state.money || 0) >= VAN.price)) { game.ui.toast(`"Four fifty, boss." You have £${(game.state.money || 0).toFixed(2)}.`, 3); return 'skint'; }
      game.pay(-VAN.price); order.stage = 'cooking'; order.t = 6;
      if (chef) chef.say('Doner and chips. Salad? Chilli sauce?', 3);
      game.ui.objective('Kebab and chips on the way… 6s');
      return 'ordered';
    };
    E.eat = () => {
      if (order.stage !== 'carrying') return 'nothing';
      order.stage = 'idle';
      const p = game.player; p.drunk = eatEffects(game.state.flags, p.drunk, game.time.now()); game.save();
      try { p.setLook({ ...p.look, prop: prevProp }); } catch { /* */ }
      game.ui.objective(null); game.ui.toast('Kebab and chips on the Cowley Road at night. Energy restored' + (p.drunk < 0.05 ? '.' : ', and the pavement has stopped moving.'), 4.5);
      return 'eaten';
    };
    E.force = (v) => { E.forced = v === undefined ? null : v; qSig = ''; return open(); };
    game.interact.add({ pos: hatch, radius: 1.9, enabled: () => van.visible && order.stage !== 'carrying',
      label: () => (order.stage === 'cooking' ? `Waiting… ${Math.ceil(order.t)}s` : `Kebab and chips — £${VAN.price.toFixed(2)}`), onUse: () => { if (order.stage === 'idle') E.buy(); } });
    const ppos = new THREE.Vector3();
    game.interact.add({ pos: () => ppos.copy(game.player.pos), radius: 3, label: 'Eat your kebab', enabled: () => order.stage === 'carrying', onUse: () => E.eat() });

    // ------------------------------------------------------------------------------------- queues after dark
    // outside the takeaways nearest the player and at the van: scripted NPCs, the same for every player (the count
    // comes from the game day and hour, the looks from stable seeds)
    const takeaways = map.pois.filter((p) => p.kind === 'fast_food' && p.p[0] > EAST_X).map((p) => {
      let best = null, bd = 30;
      try { W.roadGrid.queryRadius(p.p[0], p.p[1], 30, (it) => { if (it.w < 6 || it.kind === 'service') return; const dx = it.bx - it.ax, dz = it.bz - it.az, l2 = dx * dx + dz * dz || 1; let t = ((p.p[0] - it.ax) * dx + (p.p[1] - it.az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const qx = it.ax + dx * t, qz = it.az + dz * t, d = Math.hypot(p.p[0] - qx, p.p[1] - qz); if (d < bd) { bd = d; best = { qx, qz, dx: dx / Math.sqrt(l2), dz: dz / Math.sqrt(l2), w: it.w }; } }); } catch { /* */ }
      if (!best || bd < 1) return null;
      const nx = (p.p[0] - best.qx) / bd, nz = (p.p[1] - best.qz) / bd, off = Math.min(bd - 0.8, best.w / 2 + 2.0);
      return { id: p.id, name: p.name || '', x: best.qx + nx * off, z: best.qz + nz * off, dx: best.dx, dz: best.dz, nx, nz };
    }).filter(Boolean);
    const qCount = (id, h, day) => { const night = h >= 20 || h < 3; if (!night) return 0; const j = Math.floor(strHash(id + ':' + day + ':' + Math.floor(h)) * 3); return (h >= 23 || h < 2 ? 2 : 1) + j; };
    function syncQueues(px, pz, near) {
      const h = game.time.hour, day = dayOf(game.time.now()), want = [];
      if (near && game.pedestrians) {
        const list = takeaways.map((t) => ({ t, d: Math.hypot(t.x - px, t.z - pz) })).filter((q) => q.d < 110).sort((a, b) => a.d - b.d).slice(0, 3);      // (the same queues on every graphics tier)
        for (const { t } of list) want.push([t, qCount(t.id, h, day)]);
        if (van.visible && Math.hypot(VAN.x - px, VAN.z - pz) < 120) want.push([{ id: 'van', x: hatch[0] - CH * 0.2, z: hatch[1] + SH * 0.2, dx: SH, dz: CH, nx: 0, nz: 0, van: true }, Math.max(1, qCount('van', h, day))]);
      }
      const sig = want.map(([t, n]) => t.id + ':' + n).join('|') + '|' + day;
      if (sig === qSig) return;
      qSig = sig;
      while (queue.length) { try { game.pedestrians.remove(queue.pop()); } catch { /* */ } }
      for (const [t, n] of want) for (let i = 0; i < n; i++) {
        const x = t.x + t.dx * (0.9 + i * 0.85) * (t.van ? -1 : 1), z = t.z + t.dz * (0.9 + i * 0.85) * (t.van ? -1 : 1);
        if (!col.isFree(x, z, 0.3)) continue;
        const late = h >= 22 || h < 4, look = randomLook(`east-q-${t.id}-${day}-${i}`, { outfit: late && i % 2 === 0 ? 'clubbing' : 'casual', prop: i % 3 === 1 ? 'phone' : null });
        try { queue.push(game.pedestrians.spawnAt(x, z, look, { heading: Math.atan2(-t.dx * (t.van ? -1 : 1), -t.dz * (t.van ? -1 : 1)), pose: late && i % 3 === 2 ? 'drunk' : 'stand', lines: QUEUE_LINES, role: 'east-queue' })); } catch (e) { console.error('[east_oxford] queue', e); break; }
      }
    }
    E.queues = () => ({ takeaways: takeaways.length, standing: queue.length, sig: qSig });
    E.stats = () => ({ tris: Math.round(tris), murals: murals.length, van: van.visible, open: open(), queue: queue.length, order: order.stage, styled: venueStyles(map).size });

    let tick = 0, lastOpen = null;
    return {
      update(dt) {
        if (order.stage === 'cooking') {
          order.t -= dt;
          if (order.t <= 0) { order.stage = 'carrying'; const p = game.player; prevProp = p.look.prop || null; try { p.setLook({ ...p.look, prop: 'kebab-box' }); } catch { /* */ } game.ui.objective('Carrying a kebab. [E] to eat it.'); if (chef) chef.say('There you go, boss.', 3); }
          else game.ui.objective(`Kebab and chips on the way… ${Math.ceil(order.t)}s`);
        }
        if ((tick = (tick + 1) % 15) !== 0) { if (chef && chef.group.visible) chef.update(dt, 0); return; }
        const pl = game.player, p = pl.place === 'world' ? pl.pos : pl.worldPos || pl.pos, o = open();
        const dVan = Math.hypot(p.x - VAN.x, p.z - VAN.z);
        if (o !== lastOpen) { lastOpen = o; van.visible = o; for (const s of vanCol) s.on = o; qSig = ''; }
        if (o && dVan < 90 && !chef) {
          try { chef = createCharacter(randomLook('east-kebab-van', { outfit: 'chef' })); const cw = V2W(-0.35, -0.4); chef.group.position.set(cw[0], 0.6, cw[1]); chef.group.rotation.y = VAN.h - Math.PI / 2; chef.lines = VAN_LINES; scene.add(chef.group); } catch (e) { console.error('[east_oxford] chef', e); }
        }
        if (chef) chef.group.visible = o && dVan < 90;
        if (hatchGlow) hatchGlow.material.color.setHex(W.night > 0.3 ? 0xffe2a8 : 0x8a8478);
        syncQueues(p.x, p.z, pl.place === 'world' && p.x > EAST_X - 100);
      },
    };
  },
};
