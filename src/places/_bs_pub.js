// The Turf Tavern ("The Bastion" under ?invented=1) — the old tavern hidden behind the city wall at the end of St Helen's Passage / Bath
// Place (the mapped pub building, restyled by places/radcliffe_square.js). Owned by places/broad_street.js.
//   GARDEN / buildGarden(world)  the walled beer garden in the strip between the pub's south wall and the city wall:
//                                flagstones, trestle tables, three braziers (glow after dark, flicker), lanterns on the
//                                wall -> {meshes, fires: [{x, z}], lamps: [[x, y, z]], colliders: [[x, z, r]], tables}
//   buildBar(ctx, world)         the low-beamed bar (interior-local metres): bar counter, settles, inglenook, a board
//                                for the yard-of-ale record -> {spawn, heading, exit, bar, yard, settle}
import * as THREE from 'three';
import { Acc } from './_pm_dress.js';
import { quad } from './_bs_shop.js';
import { cwGoods } from './_cw_goods.js';
import { tn } from '../core/features.js';
import { kitGaps, glazing, cityDoor, mergeRoom } from './_walkin_city.js';

export const PUB = {
  name: tn('The Turf Tavern', 'The Bastion'),
  door: { pos: [488.6, 30.0], facing: Math.PI },          // on the north face, from the yard at the end of the passage
  wall: [[473.8, 42.3], [516.8, 49.9]],                    // the mapped city wall (w126369476)
  // the garden: the pub's south wall (north side), the city wall (south side), open to the passage at the west end
  garden: [[476.5, 37.2], [482.9, 39.0], [499.7, 41.5], [512.1, 42.1], [515.8, 43.4], [515.8, 49.1], [474.6, 42.0]],
};
const wallZ = (x) => PUB.wall[0][1] + (x - PUB.wall[0][0]) * ((PUB.wall[1][1] - PUB.wall[0][1]) / (PUB.wall[1][0] - PUB.wall[0][0]));
export const FIRES = [[489.5, wallZ(489.5) - 1.3], [500.5, wallZ(500.5) - 1.4], [510.0, wallZ(510.0) - 1.5]];
export const TABLES = [[485.5, 41.7, 0.17], [494.5, 43.4, 0.17], [505.5, 45.0, 0.17]];

export function buildGarden(world) {
  const K = world.interiorKit, A = new Acc(), out = { meshes: [], fires: FIRES.map(([x, z]) => ({ x, z })), lamps: [], colliders: [], tables: TABLES };
  A.push('flags', world.flat(PUB.garden, 0.055));
  for (const [x, z, h] of TABLES) {
    const g = (key, lx, y, lz, w, hh, d) => { const c = Math.cos(h), s = Math.sin(h); A.box(key, K, x + c * lx + s * lz, y, z - s * lx + c * lz, w, hh, d, h); };
    g('oak', 0, 0.74, 0, 1.9, 0.06, 0.78); for (const sz of [-1, 1]) { g('oak', 0, 0.44, sz * 0.66, 1.9, 0.05, 0.3); for (const sx of [-1, 1]) g('oak', sx * 0.78, 0.37, sz * 0.3, 0.07, 0.74, 0.07); }
    out.colliders.push([x, z, 1.0]);
  }
  for (const [x, z] of FIRES) {
    // a fire basket on three legs: iron bowl, a heap of logs glowing inside
    for (let k = 0; k < 3; k++) { const a = k * 2.094; A.beam('iron', K, [x + Math.cos(a) * 0.32, 0.0, z + Math.sin(a) * 0.32], [x + Math.cos(a) * 0.2, 0.62, z + Math.sin(a) * 0.2], 0.04, 0.04); }
    const bowl = new THREE.CylinderGeometry(0.42, 0.24, 0.32, 10, 1, true); bowl.translate(x, 0.78, z); A.push('iron', bowl);
    const rim = new THREE.TorusGeometry(0.42, 0.025, 4, 12); rim.rotateX(Math.PI / 2); rim.translate(x, 0.94, z); A.push('iron', rim);
    out.colliders.push([x, z, 0.55]);
    out.lamps.push([x, 1.1, z]);
  }
  // lanterns on the city wall, every ~7 m
  for (let x = 480; x < 515; x += 7) { const z = wallZ(x) - 0.35; A.box('iron', K, x, 2.74, z, 0.24, 0.06, 0.24); A.box('glow', K, x, 2.55, z, 0.18, 0.3, 0.18); A.beam('iron', K, [x, 2.77, z], [x, 2.77, z + 0.35], 0.04, 0.04); out.lamps.push([x, 2.55, z - 0.1]); }
  // festoon lights: strings of bulbs swagged from the pub's back wall to the city wall, zig-zagging down the garden;
  // a candle lantern on every table
  const north = (x) => { const G = PUB.garden; let best = 37; for (let i = 0; i < 5; i++) { const a = G[i], b = G[i + 1]; if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * ((x - a[0]) / (b[0] - a[0] || 1)); } return best; };
  const ends = []; for (let x = 478; x <= 514; x += 4.5) ends.push(x);
  for (let i = 0; i < ends.length - 1; i++) {
    const xa = ends[i], xb = ends[i + 1], up = i % 2 === 0, A0 = [xa, 3.0, up ? north(xa) + 0.2 : wallZ(xa) - 0.25], B0 = [xb, 3.0, up ? wallZ(xb) - 0.25 : north(xb) + 0.2];
    const n = 9, P = (t) => [A0[0] + (B0[0] - A0[0]) * t, A0[1] + (B0[1] - A0[1]) * t - 0.55 * 4 * t * (1 - t), A0[2] + (B0[2] - A0[2]) * t];
    for (let k = 0; k < n; k++) { A.beam('iron', K, P(k / n), P((k + 1) / n), 0.012, 0.012); const q = P((k + 0.5) / n); A.box('glow', K, q[0], q[1] - 0.07, q[2], 0.07, 0.1, 0.07); }
    (out.festoons = out.festoons || []).push(P(0.5));
  }
  for (const [x, z] of TABLES) { A.box('glow', K, x, 0.83, z, 0.09, 0.12, 0.09); A.box('iron', K, x, 0.9, z, 0.11, 0.02, 0.11); }
  const glow = new THREE.MeshStandardMaterial({ color: 0x3a3020, emissive: 0xffb055, emissiveIntensity: 0.2, name: 'bs:lantern' });
  if (world.registerNight) world.registerNight(glow, 2.6, 0.2);
  const mats = { flags: world.mats.paving, oak: world.mats.darkWood, iron: world.mats.iron, glow };
  for (const k of ['flags', 'oak', 'iron', 'glow']) { const g = A.merged(k); if (!g) continue; const m = new THREE.Mesh(g, mats[k]); m.name = 'bs:garden-' + k; m.castShadow = k === 'oak' || k === 'iron'; m.receiveShadow = true; out.meshes.push(m); }
  // the fires: one mesh of flickering flame cones (emissive; the module animates the material's intensity)
  const fl = []; for (const [x, z] of FIRES) for (let k = 0; k < 3; k++) { const c = new THREE.ConeGeometry(0.16 - k * 0.03, 0.5 + k * 0.12, 6, 1, true); c.translate(x + (k - 1) * 0.1, 1.08 + k * 0.03, z + ((k * 7) % 3 - 1) * 0.08); fl.push(c.toNonIndexed()); }
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, name: 'bs:fire' });
  const fm = new THREE.Mesh(mergeNon(fl), fireMat); fm.name = 'bs:fire'; out.meshes.push(fm); out.fire = fm;
  return out;
}
function mergeNon(list) { const P = []; for (const g of list) P.push(...g.attributes.position.array); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); return g; }

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

/** the bar: 13 × 7.5 m, ceiling 2.25 m, black oak beams at 1.95 m; you come in at the north-east corner */
// The bar as a walk-in room (core/interiors.js "seamless"; plan and fit: _walkin_city.js). The mapped pub is a long
// low building EAST of its yard door, 7.9 m deep: the room (13 × 6.8 m) is turned so the yard door is in its 's' wall
// at x = 3.8 (where the third settle stood) and the counter is at the far end, inside the footprint.
export const BAR = { W: 13, D: 6.8, H: 2.25, doorX: 3.8, doorW: 1.0, doorH: 1.85, t: 0.2 };
export const barPlanSpec = () => ({ portal: { at: [BAR.doorX, BAR.D / 2 + BAR.t / 2], out: 0, w: BAR.doorW, h: BAR.doorH }, rects: [[-BAR.W / 2, -BAR.D / 2, BAR.W / 2, BAR.D / 2]], wall: 0.3,
  auto: { walls: [{ a: [-BAR.W / 2, -BAR.D / 2], b: [BAR.W / 2, -BAR.D / 2], out: Math.PI }, { a: [BAR.W / 2, BAR.D / 2], b: [2.2, BAR.D / 2], out: 0 }], maxDepth: 1.0, maxY: BAR.H - 0.2 } });      // (the garden wall; the yard wall clear of the settles)
export function buildBar(ctx, world, record = null, plan = null) {
  const K = world.interiorKit, s = ctx.scene, col = ctx.collider, A = new Acc();
  const SL = !!(ctx.seamless && plan);
  const W = 13, D = SL ? BAR.D : 7.5, H = 2.25;
  K.room(s, { w: W, d: D, h: H, floor: 'floorTiles', walls: 'plaster', ceiling: 'plaster', wainscot: 'panelling', collider: col, doors: SL ? kitGaps(plan) : [{ wall: 'n', at: 4.5, width: 1.0, height: 1.85 }] });
  // (the garden windows: the sashes — frame, glazing bars, meeting rail — are drawn on the outside face in the world scene,
  //  broad_street.js dressOpenings; here only the pane, just inside them, and the deep plastered reveal of the old wall)
  if (SL) { s.add(glazing(plan.seamless.openings, { bars: 0, frame: 0.001, inset: 0.93 })); const D = cityDoor(ctx, plan, { style: 'oak', heavy: false, hinge: 1, open: plan.hours && plan.hours.open }); ctx.pubDoor = D;
    // (a solid door shut is drawn from outside as its leaf alone — core's proxy of the leaf — so its "Closed" card must be part of that: opaque
    //  here, and broad_street.js shrinks it away while the pub is open)
    if (D && D.sign) {
      D.sign.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = false; } });
      // (…and on the leaf's outside face, not in the middle of its thickness: the hinge is on the +tangent jamb, so the leaf's own +x is n = (cos dir, -sin dir))
      const pt = ctx.seamless.portals[0], dir = Math.atan2(-Math.cos(pt.out), Math.sin(pt.out)), side = Math.cos(dir) * Math.sin(pt.out) - Math.sin(dir) * Math.cos(pt.out) >= 0 ? 1 : -1;
      D.sign.position.x = side * 0.047;
    } }
  // beams: a heavy bressumer down the middle, joists across; posts where the old partition was
  A.box('beam', K, 0, H - 0.16, 0, W, 0.3, 0.32);
  for (let x = -W / 2 + 0.6; x < W / 2; x += 1.05) A.box('beam', K, x, H - 0.1, 0, 0.16, 0.18, D);
  for (const x of [-2.2, 1.6]) { A.box('beam', K, x, H / 2, 0, 0.26, H, 0.26); col.addBox(x, 0, 0.3, 0.3, 0); }
  // the counter along the west end, the back bar with bottles
  A.box('counter', K, -4.6, 0.52, -0.4, 0.7, 1.04, 4.2); A.box('counter', K, -4.55, 1.06, -0.4, 0.82, 0.05, 4.3);
  for (let k = 0; k < 6; k++) A.box('beam', K, -4.24, 0.52, -2.2 + k * 0.72, 0.03, 0.8, 0.5);                 // the counter's panels
  col.addBox(-4.6, -0.4, 0.7, 4.2, 0);
  A.box('oak', K, -6.2, 0.9, -0.4, 0.4, 1.8, 4.6);
  for (let k = 0; k < 4; k++) { A.box('pump', K, -4.4, 1.3, -1.6 + k * 0.5, 0.06, 0.45, 0.06); A.box('pump', K, -4.4, 1.62, -1.6 + k * 0.5, 0.07, 0.22, 0.07); }
  A.box('pump', K, -4.2, 0.12, -0.4, 0.05, 0.05, 4.2);                                       // the brass foot rail
  A.box('top', K, -4.22, 1.02, -0.4, 0.06, 0.06, 4.3);                                        // a brass edge to the top
  // the back bar: shelves of bottles lit from below, a mirror strip behind them (painted goods strip, glowing a little)
  for (const y of [1.25, 1.75]) A.box('top', K, -5.95, y - 0.02, -0.4, 0.3, 0.03, 4.4);
  { const G = cwGoods(world), gm = G.material.clone(); gm.emissive = new THREE.Color(0xffd8a0); gm.emissiveIntensity = 0.55; gm.name = 'bs:bottles';
    const uv = G.uv('bottles'), P = [], U = [];
    for (let k = 0; k < 4; k++) { const z0 = -2.5 + k * 1.05, z1 = z0 + 1.0, x = -5.99, y0 = 1.24, y1 = 2.18; for (const [pz, py, u, v] of [[z1, y0, uv[0], uv[1]], [z0, y0, uv[2], uv[1]], [z0, y1, uv[2], uv[3]], [z1, y0, uv[0], uv[1]], [z0, y1, uv[2], uv[3]], [z1, y1, uv[0], uv[3]]]) { P.push(x, py, pz); U.push(u, v); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
    const bm2 = new THREE.Mesh(g, gm); bm2.name = 'bs:back-bar'; s.add(bm2); }
  // pendant lamps over the counter: green shades, bright bulbs
  { const shade = new THREE.MeshStandardMaterial({ color: 0x1f3a24, roughness: 0.5, side: THREE.DoubleSide }), bulb = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
    const bl = [];
    for (const z of [-1.9, -0.4, 1.1]) { A.push('beam', new THREE.ConeGeometry(0.2, 0.18, 10, 1, true).translate(-4.3, H - 0.55, z)); A.push('beam', new THREE.CylinderGeometry(0.008, 0.008, 0.38, 4, 1, true).translate(-4.3, H - 0.27, z)); bl.push(new THREE.SphereGeometry(0.05, 8, 6).translate(-4.3, H - 0.66, z).toNonIndexed()); }
    const P = []; for (const g of bl) P.push(...g.attributes.position.array); const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g2.computeBoundingSphere();
    s.add(new THREE.Mesh(g2, bulb)); void shade; }
  // settles (high-backed benches) and tables along the south wall, an inglenook in the east wall
  for (const x of SL ? [-1.6, 1.0] : [-1.6, 1.0, 3.6]) {
    A.box('oak', K, x, 0.23, D / 2 - 0.4, 1.8, 0.46, 0.45); A.box('oak', K, x, 0.75, D / 2 - 0.1, 1.8, 1.5, 0.08);
    A.box('oak', K, x, 0.74, D / 2 - 1.2, 1.2, 0.05, 0.7); A.box('oak', K, x, 0.37, D / 2 - 1.2, 0.12, 0.72, 0.12);
    col.addBox(x, D / 2 - 0.7, 1.8, 1.4, 0);
  }
  for (const z of [-2.2, 0.2]) { A.box('oak', K, 1.0, 0.74, z, 0.9, 0.05, 0.9); A.box('oak', K, 1.0, 0.37, z, 0.12, 0.72, 0.12); col.addCircle(1.0, z, 0.5); }
  K.fireplace(s, { x: W / 2 - 0.25, z: 1.0, rot: -Math.PI / 2, w: 1.8, collider: col });
  // the yard-of-ale board by the bar
  const board = canvasTex(512, 384, (x, w, h) => {
    x.fillStyle = '#1b1b18'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b08a3c'; x.lineWidth = 8; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = '#f3e7c4'; x.textAlign = 'center'; x.font = 'bold 44px serif'; x.fillText(PUB.name.toUpperCase(), w / 2, 70);
    x.font = '28px serif'; x.fillText('Yard of Ale — the house record', w / 2, 125);
    x.font = 'bold 54px serif'; x.fillText(record ? record : '11 seconds', w / 2, 205);
    x.font = '22px serif'; x.fillText('(nobody can prove it either way)', w / 2, 250); x.fillText('Ask at the bar. £6. Mop provided.', w / 2, 300);
  });
  const bm = new THREE.Mesh(quad(SL ? -3.6 : -2.9, 1.5, -D / 2 + 0.06, SL ? 1.2 : 1.3, SL ? 0.9 : 0.98, 0, 1), new THREE.MeshStandardMaterial({ map: board, roughness: 0.9 })); s.add(bm);
  const mats = { beam: new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.9, name: 'bs:beam' }), oak: world.mats.darkWood, counter: new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.55, map: world.mats.wood && world.mats.wood.map || null, name: 'bs:counter' }), top: world.mats.brass, pump: world.mats.brass };
  for (const [k, m] of Object.entries(mats)) { const g = A.merged(k); if (!g) continue; const me = new THREE.Mesh(g, m); me.receiveShadow = true; s.add(me); }
  // dim, warm, low lamps
  for (const [x, z, i] of [[-3.6, -0.4, 5.5], [0.2, -1.2, 3.2], [3.4, 1.8, 3.2], [-5.3, -0.4, 2.5]]) K.warmLight(s, { x, y: H - 0.35, z, intensity: i, distance: 7, color: 0xffb870 });
  if (SL) mergeRoom(s);
  if (SL) return { spawn: [BAR.doorX, D / 2 - 1.2], heading: Math.PI, exit: [BAR.doorX, D / 2 - 0.5], bar: [-3.9, -0.4], yard: [-2.9, -D / 2 + 0.9], W, D, door: ctx.pubDoor || null };
  return { spawn: [4.5, -D / 2 + 1.2], heading: 0, exit: [4.5, -D / 2 + 0.5], bar: [-3.9, -0.4], yard: [-2.9, -D / 2 + 0.9], W, D };
}
