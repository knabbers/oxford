// Worcester College interiors — shared geometry/material kit (panelling, mouldings, sash windows, benches, portraits,
// window glass that follows daylight, lamps). Geometry is collected in a Batch per room (one mesh per material).
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts } from './_worcester_kit.js';
import { tex, portraitAtlas, noticeTex, canvas, rng } from './_worcint_tex.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { Batch, frame, rectPts, archPts };

// ------------------------------------------------------------------------------------------------ shared painters
// Neutral (near-white) maps that the material colour tints, so one canvas serves every timber / every painted wall.
const _wood = [null, null];
/** Plain-sawn timber: grain along u, four ~15 cm boards across v per 0.6 m (the world's floorboard map is a dark red
 *  floor; multiplied by an oak tint it turned every table, bench and stall oxblood). `vertical` = grain along v. */
export function woodGrain(vertical = false, scale = 1, veneer = false) {
  const vi = veneer ? 1 : 0;   // veneer: one sheet, no board joints or knots (laminate doors, modern furniture)
  if (!_wood[vi]) {
    const { c, g } = canvas(256, 256), R = rng(91 + vi);
    g.fillStyle = '#ddd6ca'; g.fillRect(0, 0, 256, 256);
    for (let b = 0; b < 4; b++) {
      const y0 = b * 64, k = R();
      if (!veneer) { g.fillStyle = k > 0.5 ? `rgba(255,250,240,${(k - 0.5) * 0.3})` : `rgba(60,40,20,${(0.5 - k) * 0.22})`; g.fillRect(0, y0, 256, 64); }
      for (let i = 0; i < 30; i++) {
        const y = y0 + 2 + R() * 60, a = (0.05 + R() * 0.11) * (veneer ? 0.6 : 1), w = (R() - 0.5) * 6;
        g.strokeStyle = R() < 0.55 ? `rgba(78,52,28,${a})` : `rgba(255,248,232,${a})`; g.lineWidth = 0.6 + R() * 1.7;
        g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(85, y + w, 170, y - w, 256, y); g.stroke();
      }
      if (!veneer && R() < 0.6) { const kx = R() * 256, ky = y0 + 16 + R() * 32; for (let q = 4; q > 0; q--) { g.strokeStyle = `rgba(70,44,22,${0.1 + 0.05 * (4 - q)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(kx, ky, q * 3.2, q * 1.5, 0, 0, Math.PI * 2); g.stroke(); } }
      if (!veneer) { g.fillStyle = 'rgba(38,24,12,0.2)'; g.fillRect(0, y0, 256, 1.2); }
    }
    _wood[vi] = tex(c); _wood[vi].repeat.set(1 / 0.9, 1 / 0.6);
  }
  if (!vertical && scale === 1) return _wood[vi];
  const t = _wood[vi].clone(); if (vertical) t.rotation = Math.PI / 2; t.repeat.set(1 / (0.9 * scale), 1 / (0.6 * scale)); t.needsUpdate = true; return t;
}
/**
 * Painted-wall map for wall faces whose UVs are (metres along, height): soft contact shadow at the floor, a little
 * shade under the ceiling, faint brush mottling, optional painted skirting board. One repeat = `period` metres of
 * height (use the storey height), 3 m along. Neutral, tinted by the material colour.
 */
export function wallShade(period, o = {}) {
  const { c, g } = canvas(128, 512), R = rng(o.seed || 7), H = 512;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, H);
  for (let i = 0; i < 160; i++) { const x = R() * 128, y = R() * H, r = 10 + R() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},0.016)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; for (const ox of [-128, 0, 128]) g.fillRect(x + ox - r, y - r, r * 2, r * 2); }
  const px = (m) => (m / period) * H;
  const top = o.top ?? 0.5, bot = o.bottom ?? 0.9;
  let gr;
  if (top > 0) { gr = g.createLinearGradient(0, 0, 0, px(top)); gr.addColorStop(0, 'rgba(40,34,26,0.22)'); gr.addColorStop(1, 'rgba(40,34,26,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, px(top)); }
  if (bot > 0) { gr = g.createLinearGradient(0, H, 0, H - px(bot)); gr.addColorStop(0, 'rgba(34,28,22,0.3)'); gr.addColorStop(1, 'rgba(34,28,22,0)'); g.fillStyle = gr; g.fillRect(0, H - px(bot), 128, px(bot)); }
  if (o.skirt) { const h = px(o.skirt); g.fillStyle = o.skirtCol || '#8a8780'; g.fillRect(0, H - h, 128, h); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, H - h, 128, 1.5); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, H - h - 1.5, 128, 1.5); }
  const t = tex(c); t.repeat.set(1 / 3, 1 / period); return t;
}
/** speckled sheet flooring / short-pile carpet (neutral, 1 m repeat) */
export function speckle(seed = 3, strength = 0.12, size = 1.6) {
  const { c, g } = canvas(128, 128), R = rng(seed);
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * strength})`; g.fillRect(R() * 128, R() * 128, size * (0.5 + R()), size * (0.5 + R())); }
  const t = tex(c); t.repeat.set(1, 1); return t;
}

let shared = null;
/** materials shared by all Worcester interiors (created once) */
export function sharedMats(game) {
  if (shared) return shared;
  const w = game.world, M = w.mats;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const pa = portraitAtlas();
  shared = {
    std,
    oak: std({ map: woodGrain(), color: 0xb98d58, roughness: 0.55 }),
    darkOak: std({ map: woodGrain(), color: 0x5c3a20, roughness: 0.5 }),
    lightOak: std({ map: woodGrain(false, 1, true), color: 0xe0c594, roughness: 0.55 }),
    beech: std({ map: woodGrain(false, 1, true), color: 0xe6c592, roughness: 0.55 }),
    floorboards: M.wood,
    stoneFloor: std({ map: M.paving.map, color: 0xd8d2c4, roughness: 0.75 }),
    plasterWhite: std({ color: 0xf2efe6, roughness: 0.9 }),
    cream: std({ color: 0xece2c8, roughness: 0.9 }),
    brass: std({ color: 0xc8a050, metalness: 0.7, roughness: 0.35 }),
    bronze: std({ color: 0x3a2c1e, metalness: 0.5, roughness: 0.45 }),
    iron: std({ color: 0x18181a, metalness: 0.4, roughness: 0.5 }),
    marble: std({ color: 0xece8e0, roughness: 0.3 }),
    redCloth: std({ color: 0x8a1a22, roughness: 0.85 }),
    books: std({ color: 0x9a1e24, roughness: 0.7 }),
    paper: std({ color: 0xf4f0e4, roughness: 0.9 }),
    black: std({ color: 0x111111, roughness: 0.6 }),
    giltFrame: std({ color: 0xb08a3a, metalness: 0.6, roughness: 0.4 }),
    portraits: std({ map: pa.texture, roughness: 0.6 }),
    portraitUV: pa.uv,
    notice: std({ map: noticeTex(), roughness: 0.9 }),
    // lamp glass: emissive, intensity driven per room
    lampGlow: std({ color: 0xfff2d0, emissive: 0xffc070, emissiveIntensity: 1.2, roughness: 0.3 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffd27a }),
    carpetGrey: std({ color: 0x6a6e72, roughness: 1 }),
    radiator: std({ color: 0xf0f0ec, roughness: 0.5 }),
  };
  return shared;
}

/** glass material showing a texture lit by daylight (call setDay(daylight) each frame) */
export function windowGlass(map, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 1, color: opts.color ?? 0x666666, roughness: 0.3, side: THREE.DoubleSide });
  m.userData.day = opts.day ?? 1.25; m.userData.night = opts.night ?? 0.05;
  m.userData.setDay = (d) => { m.emissiveIntensity = m.userData.night + (m.userData.day - m.userData.night) * d; };
  return m;
}
/** a plain sky-ish glass (sash windows): colour by daylight */
export function skyGlass() {
  const m = new THREE.MeshBasicMaterial({ color: 0xcfe0ee, side: THREE.DoubleSide });
  const day = new THREE.Color(0xdce8f0), dusk = new THREE.Color(0x1a2236);
  m.userData.setDay = (d) => { m.color.copy(dusk).lerp(day, d * d); };   // squared: the sky outside is already dark at half 'daylight'
  return m;
}

/** portrait in a gilt frame on a wall frame F (Batch must have F pushed): centre (s,y), size w×h, atlas index */
export function portrait(B, s, y, w, h, idx, uvFn, z = 0.02, fw = 0.09) {
  B.box('giltFrame', s, y, z + 0.03, w + fw * 2, h + fw * 2, 0.06);
  B.sign('portraits', s - w / 2, y - h / 2, s + w / 2, y + h / 2, z + 0.065, uvFn(idx));
}
/** sash window (frame + glazing bars) on wall frame (pushed in B): opening x0..x1, y0..y1, glass at depth -d */
/** the OUTWARD face of a real window's glass (walk-in rooms; sash() `outKey`): by day a window seen from outside is dark
 *  and a little reflective, like the painted ones beside it, and the room is only glimpsed; at night it is clear, so a
 *  lit room shows. Call userData.setDay(daylight 0..1) from the room's setLight. Not seen from inside (one-sided). */
export function outGlass() {
  const m = new THREE.MeshBasicMaterial({ name: 'glassOut', color: 0x1e2833, transparent: true, opacity: 0.6, depthWrite: false });
  m.userData.setDay = (d) => { m.opacity = 0.05 + 0.63 * d; };
  return m;
}
export function sash(B, x0, x1, y0, y1, d = 0.35, o = {}) {
  const w = x1 - x0, h = y1 - y0, z = -d + 0.04, bk = o.barKey || 'plasterWhite';
  B.reveal(o.revealKey || 'plasterWhite', rectPts(x0, y0, x1, y1), 0, -d);
  B.face(o.glassKey || 'sky', rectPts(x0, y0, x1, y1), [], -d + 0.01);
  if (o.outKey) B.face(o.outKey, rectPts(x0, y0, x1, y1), [], -d + 0.075, true);      // (behind the glazing bars as seen from outside)
  const cols = o.cols || 3, rows = o.rows || 4;
  for (let k = 1; k < cols; k++) B.box(bk, x0 + (w * k) / cols, (y0 + y1) / 2, z, 0.035, h, 0.03);
  for (let k = 1; k < rows; k++) B.box(bk, (x0 + x1) / 2, y0 + (h * k) / rows, z, w, k === rows / 2 ? 0.07 : 0.035, k === rows / 2 ? 0.05 : 0.03);
  B.box(bk, (x0 + x1) / 2, y0 + 0.04, z, w, 0.08, 0.05); B.box(bk, (x0 + x1) / 2, y1 - 0.04, z, w, 0.08, 0.05);
  B.box(bk, x0 + 0.04, (y0 + y1) / 2, z, 0.08, h, 0.05); B.box(bk, x1 - 0.04, (y0 + y1) / 2, z, 0.08, h, 0.05);
  if (o.sill !== false) B.box(o.sillKey || 'plasterWhite', (x0 + x1) / 2, y0 - 0.03, 0.03, w + 0.12, 0.06, 0.16);
}
/** panelled oak dado along a wall frame (pushed): s0..s1, height h */
export function panelling(B, s0, s1, h, key = 'oak', pw = 0.75) {
  B.box(key, (s0 + s1) / 2, h / 2, 0.015, s1 - s0, h, 0.03);
  const n = Math.max(1, Math.round((s1 - s0) / pw)), step = (s1 - s0) / n;
  for (let i = 0; i < n; i++) {
    const c = s0 + step * (i + 0.5);
    B.box(key, c, h * 0.62, 0.04, step - 0.16, h * 0.5, 0.025);
    B.box(key, c, h * 0.2, 0.04, step - 0.16, h * 0.2, 0.025);
  }
  B.box(key, (s0 + s1) / 2, h + 0.03, 0.05, s1 - s0, 0.06, 0.08);   // capping rail
  B.box(key, (s0 + s1) / 2, 0.06, 0.04, s1 - s0, 0.12, 0.05);        // skirting
}
/** a long refectory table (top + turned legs + stretcher): along x */
export function refectoryTable(B, x0, x1, z, key = 'oak', w = 0.85, h = 0.76) {
  B.boxXZ(key, x0, x1, h - 0.06, h, z - w / 2, z + w / 2);
  for (const s of [-1, 1]) B.boxXZ(key, x0 + 0.12, x1 - 0.12, h - 0.17, h - 0.06, z + s * (w / 2 - 0.1) - 0.015, z + s * (w / 2 - 0.1) + 0.015);   // apron rails
  const n = Math.max(2, Math.round((x1 - x0) / 2.2) + 1);
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.25 + ((x1 - x0 - 0.5) * i) / (n - 1);
    for (const s of [-1, 1]) B.box(key, x, (h - 0.06) / 2, z + s * (w / 2 - 0.12), 0.09, h - 0.06, 0.09);
    B.box(key, x, 0.16, z, 0.07, 0.07, w - 0.3);                                                  // end stretcher of each trestle
  }
  B.boxXZ(key, x0 + 0.25, x1 - 0.25, 0.125, 0.195, z - 0.035, z + 0.035);
}
export function benchAlong(B, x0, x1, z, key = 'oak', d = 0.32, h = 0.45) {
  B.boxXZ(key, x0, x1, h - 0.05, h, z - d / 2, z + d / 2);
  const n = Math.max(2, Math.round((x1 - x0) / 2.2) + 1);
  for (let i = 0; i < n; i++) { const x = x0 + 0.2 + ((x1 - x0 - 0.4) * i) / (n - 1); B.box(key, x, (h - 0.05) / 2, z, 0.06, h - 0.05, d - 0.06); }
  B.boxXZ(key, x0 + 0.2, x1 - 0.2, h - 0.13, h - 0.05, z - 0.02, z + 0.02);                         // rail under the seat
}
/** simple chair facing +z rotated by rot (B frame) */
export function chairAt(B, x, z, rot, seatKey = 'oak', frameKey = 'oak', back = 0.95) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const T = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const bx = (key, lx, y, lz, w, h, d) => { const p = T(lx, lz); B.box(key, p[0], y, p[1], w, h, d, rot); };
  bx(seatKey, 0, 0.45, 0, 0.44, 0.05, 0.42);
  for (const lx of [-0.19, 0.19]) { bx(frameKey, lx, 0.215, 0.18, 0.04, 0.43, 0.04); bx(frameKey, lx, back / 2, -0.19, 0.04, back, 0.04); }   // front legs, back posts
  bx(frameKey, 0, back - 0.05, -0.19, 0.42, 0.1, 0.03);                                             // top rail
  bx(frameKey, 0, (0.6 + back - 0.1) / 2, -0.19, 0.15, back - 0.7, 0.02);                           // splat
  bx(frameKey, 0, 0.58, -0.19, 0.36, 0.04, 0.025);                                                  // lower rail
}
/** candle (stick + flame) at x,y,z (world in the room) */
export function candle(B, x, y, z, h = 0.25) {
  B.cyl('paper', x, y, z, 0.012, h, 6, true);
  B.box('flame', x, y + h + 0.025, z, 0.012, 0.04, 0.012);
}
/** room lights helper: returns {lights[], set(intensities)} */
export function addPoint(scene, x, y, z, color = 0xffc98a, intensity = 4, distance = 12, decay = 1.6) {
  const l = new THREE.PointLight(color, intensity, distance, decay); l.position.set(x, y, z); scene.add(l); return l;
}
/** default interior lights (ambient + hemisphere) */
export function ambientOf(scene) {
  let amb = null, hemi = null;
  scene.traverse((o) => { if (o.isAmbientLight) amb = o; if (o.isHemisphereLight) hemi = o; });
  return { amb, hemi };
}
/** builds all Batch parts with a materials table (strings resolved from shared mats + extra) */
export function buildBatch(B, scene, mats, opts = {}) {
  const meshes = B.build(mats, scene, opts);
  for (const m of meshes) { m.castShadow = false; m.receiveShadow = false; }
  return meshes;
}
/** wall-frame face with texture covering exactly L×H metres: set texture repeat */
export function fitTexture(t, L, H, s0 = 0, y0 = 0) { t.repeat.set(1 / L, 1 / H); t.offset.set(-s0 / L, -y0 / H); t.needsUpdate = true; return t; }
export function canvasMat(c, L, H, opts = {}) { const t = tex(c, { wrap: false }); fitTexture(t, L, H, opts.s0 || 0, opts.y0 || 0); return new THREE.MeshStandardMaterial({ map: t, roughness: opts.roughness ?? 0.85, emissive: opts.emissive ?? 0x000000 }); }

/** merge every static mesh under `root` (not in `skip`) into one mesh per material. Returns mesh count. */
export function mergeStatic(root, skip = new Set()) {
  root.updateMatrixWorld(true);
  const groups = new Map(), victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    for (let p = o; p; p = p.parent) if (skip.has(p)) return;
    const g = o.geometry; if (!g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
    const key = o.material.uuid;
    let e = groups.get(key); if (!e) groups.set(key, (e = { mat: o.material, geos: [] }));
    const c = (g.index ? g.toNonIndexed() : g.clone());
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k);
    c.applyMatrix4(o.matrixWorld); e.geos.push(c); victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  let n = 0;
  for (const { mat, geos } of groups.values()) {
    const g = mergeGeometries(geos, false); for (const q of geos) q.dispose();
    if (!g) continue;
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.updateMatrix(); root.add(m); n++;
  }
  return n;
}
