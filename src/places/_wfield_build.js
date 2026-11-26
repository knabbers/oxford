// Worcester College, the playing fields (places/worcester_fields.js): what is drawn. Solid things go into the college's
// Batch (_worcester_kit.js) in the college's atlas; flat things (courts, lines, the mown bands, the table) into the
// city's ground material by layer; chain-link, netting and the tennis nets into one small see-through material of
// their own (netMaterial). World coordinates unless a frame is pushed. Sizes and places: _wfield_plan.js.
import * as THREE from 'three';
import { frame, rectPts } from './_worcester_kit.js';
import { stack } from './_worcester_south_kit.js';
import * as P from './_wfield_plan.js';

const LV = P.LV;
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const hash = (a, b = 0) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };

/** this pass's colours: tinted copies of cells the college's atlas and the city's ground atlas already have */
export function cells(pack) {
  const G = pack.groundCells;
  if (G && G.get('asphalt') && !G.get('wfSurround')) {
    const as = G.get('asphalt'), lawn = G.get('lawn') || G.get('grass'), pv = G.get('paving') || as;
    G.set('wfSurround', { ...as, tint: [1.0, 2.5, 1.75], layer: 7.2 });      // green macadam round the courts
    G.set('wfCourt', { ...as, tint: [1.25, 1.75, 2.0], layer: 7.5 });        // the courts' blue-grey
    G.set('wfCarpet', { ...as, tint: [1.5, 3.3, 0.9], layer: 7.2 });         // the nets' synthetic turf
    G.set('wfHard', { ...pv, tint: [0.82, 0.82, 0.8], layer: 7.2 });         // concrete hardstanding
    G.set('wfLine', { ...pv, rx: 0, ry: 0, ox: 0.5, oy: 0.5, tint: [1.9, 1.9, 1.85], layer: 9 });
    G.set('wfBand', { ...lawn, tint: [1.1, 1.09, 1.0], layer: 3.5 });        // the lighter mown bands
    G.set('wfTable', { ...lawn, tint: [1.36, 1.3, 0.96], layer: 4.2 }); G.set('wfTableB', { ...lawn, tint: [1.26, 1.24, 0.94], layer: 4.2 });
  }
  const K = pack.cells; if (!K || !K.get('boards') || K.get('wfWall')) return;
  const boards = K.get('boards'), plain = K.get('plaster'), slate = K.get('slate');
  K.set('wfWall', { ...boards, tint: lin(0x768a84) });        // the pavilion's dark grey-green boarding
  K.set('wfPlinth', { ...boards, tint: lin(0x466a56) });
  K.set('wfWhite', { ...boards, tint: lin(0xf2f0ea) });       // white painted boarding and joinery
  K.set('wfTile', { ...slate, tint: [2.05, 0.86, 0.46] });     // orange-red plain clay tiles
  K.set('wfTileD', { ...plain, tint: lin(0xa5492e) });        // bonnet hips, ridge tiles
  K.set('wfPale', { ...plain, tint: lin(0xb9c9c7) });         // the gablet's pale panels
  K.set('wfBlack', { ...plain, tint: lin(0x141516) });
  K.set('wfFloor', { ...boards, tint: lin(0x8a8478) });
  K.set('wfGreen', { ...plain, tint: lin(0x1f5a3c) });        // green-coated steel, the nets' boards
  K.set('wfSteel', { ...plain, tint: lin(0x9aa1a6) });
  K.set('wfCedar', { ...boards, tint: lin(0x97805f) });       // the shed's weathering timber
  K.set('wfCedarD', { ...boards, tint: lin(0x7d6a4f) });
  K.set('wfRoof', { ...plain, tint: lin(0x8c9296) });         // its metal roof
  K.set('wfPad', { ...plain, tint: lin(0x1f3a7a) });
  K.set('wfRope', { ...plain, tint: lin(0xe9e6da) });
}

// ------------------------------------------------------------------------------------------------ netting
let NET = null;
/** chain-link / netting: pale wires on an almost clear ground (the vertex colour is the net's own); u, v in mesh cells */
export function netMaterial() {
  if (NET) return NET;
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  let data = null;
  try {
    g.clearRect(0, 0, S, S); g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'square';
    for (const [x0, y0, x1, y1] of [[0, 32, 32, 0], [32, 0, 64, 32], [64, 32, 32, 64], [32, 64, 0, 32]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    const im = g.getImageData(0, 0, S, S); if (im && im.data && im.data.length === S * S * 4) data = new Uint8Array(im.data.buffer.slice(0));
  } catch (e) { /* headless */ }
  if (!data) data = new Uint8Array(S * S * 4);
  for (let i = 0; i < data.length; i += 4) { const a = data[i + 3]; data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.max(34, a); }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true;
  NET = new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors: true, name: 'worcester-fields:net' });
  return NET;
}
/** collects netting quads: quad(p0, p1, p2, p3 [x, y, z], colour, cell size in metres) */
export class Nets {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.nor = []; }
  quad(a, b, c, d, col, cell = 0.06) {
    const w = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / cell, h = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / cell;
    const P4 = [[a, 0, 0], [b, w, 0], [c, w, h], [d, 0, h]];
    for (const k of [0, 1, 2, 0, 2, 3]) { const q = P4[k]; this.pos.push(q[0][0], q[0][1], q[0][2]); this.uv.push(q[1], q[2]); this.col.push(col[0], col[1], col[2]); this.nor.push(0, 1, 0); }
  }
  /** an upright panel between two ground points from y0 to y1 */
  panel(p, q, y0, y1, col, cell) { this.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], col, cell); }
  tris() { return this.pos.length / 9; }
  mesh() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, netMaterial()); m.name = 'worcester-fields:nets'; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); m.renderOrder = 2;
    return m;
  }
}
const NETC = { link: lin(0x2f6b48), black: lin(0x18191a), white: lin(0xe8e8e2), curtain: lin(0x3a6a50) };

/** the scoreboard's lettering (K: white capitals TOTAL / WKTS / OVERS / LAST INNS on black, white numerals on hung plates) */
export function scoreboardTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 368;
  const g = c.getContext('2d');
  try {
    g.fillStyle = '#121314'; g.fillRect(0, 0, 512, 368);
    g.fillStyle = '#f2f0e8'; g.font = 'bold 30px Arial, Helvetica, sans-serif'; g.textBaseline = 'middle';
    g.fillText('TOTAL', 22, 52); g.fillText('WKTS', 398, 44); g.fillText('OVERS', 22, 180); g.font = 'bold 27px Arial, Helvetica, sans-serif'; g.fillText('LAST', 22, 286); g.fillText('INNS', 22, 318);
    const plate = (x, y, w, h, t) => { g.fillStyle = '#1d1f21'; g.fillRect(x, y, w, h); g.strokeStyle = '#3a3d40'; g.lineWidth = 2; g.strokeRect(x, y, w, h); g.fillStyle = '#f4f2ea'; g.font = `bold ${Math.round(h * 0.86)}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.fillText(t, x + w / 2, y + h * 0.54); g.textAlign = 'left'; };
    plate(168, 14, 62, 84, '1'); plate(234, 14, 62, 84, '4'); plate(300, 14, 62, 84, '7'); plate(410, 66, 62, 84, '5');
    plate(168, 140, 62, 84, '3'); plate(234, 140, 62, 84, '6'); plate(234, 262, 62, 84, '9'); plate(300, 262, 62, 84, '8');
  } catch (e) { /* headless */ }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ------------------------------------------------------------------------------------------------ small parts
/** a teak garden bench 1.8 m long in the current frame: x along it, z the way the sitter faces */
function bench(B, x, y, z, len = 1.8) {
  const h = len / 2;
  B.boxXZ('teak', x - h, x + h, y + 0.4, y + 0.45, z - 0.2, z + 0.24, { bottom: true });
  for (const s of [-h + 0.06, h - 0.06]) { B.boxXZ('teak', x + s - 0.035, x + s + 0.035, y, y + 0.62, z + 0.17, z + 0.24, {}); B.boxXZ('teak', x + s - 0.035, x + s + 0.035, y, y + 0.9, z - 0.26, z - 0.19, {}); B.boxXZ('teak', x + s - 0.035, x + s + 0.035, y + 0.58, y + 0.63, z - 0.24, z + 0.24, {}); }
  B.boxXZ('teak', x - h, x + h, y + 0.82, y + 0.9, z - 0.26, z - 0.21, {}); for (let i = 0; i < 9; i++) { const sx = x - h + 0.14 + (i * (len - 0.28)) / 8; B.boxXZ('teak', sx - 0.025, sx + 0.025, y + 0.45, y + 0.82, z - 0.25, z - 0.22, { top: false }); }
}
/** a white rugby H: posts 5.6 m apart, padded feet */
function rugbyPosts(B, q) {
  for (const p of [q.l, q.r]) { B.cyl('white', p[0], 0, p[1], 0.07, LV.post, 8, true, 0.045); B.cyl('wfPad', p[0], 0, p[1], 0.19, 1.8, 10, true); }
  B.beam('white', [q.l[0], LV.bar, q.l[1]], [q.r[0], LV.bar, q.r[1]], 0.09, 0.09);
}

// ------------------------------------------------------------------------------------------------ the pavilion
function pavilion(B, F) {
  const V = P.PAV, L2 = V.L / 2, D2 = V.D / 2, fl = LV.floor, ev = LV.eaves, rg = LV.ridge, ov = V.ov, wallT = 3.08;
  B.push(frame(F.o[0], 0, F.o[1], F.ux, F.uz));      // x = s (west along the front), z = t (out of the front, to the field)
  const rs = V.room[1];      // the closed room's west side = the veranda's east end
  // ---- walls (dark boarding from a darker plinth), drawn as boxes' faces; windows and doors are set on them below
  const wall = (x0, x1, z0, z1, o = {}) => { B.boxXZ('wfPlinth', x0, x1, 0, fl, z0, z1, { top: false, ...o }); B.boxXZ('wfWall', x0, x1, fl, wallT, z0, z1, { top: false, ...o }); };
  wall(-L2, L2, -D2, V.back);                    // the body behind the veranda
  wall(-L2, rs, V.back, V.front);                // the closed room at the east end, forward to the veranda's edge
  // the 1967 extension at the back (G): flat-roofed, boarded, a pair of doors for the groundsman's machines
  { const R = V.rear; B.boxXZ('wfPlinth', R.s0, R.s1, 0, 0.3, -D2 - R.d, -D2, { top: false }); B.boxXZ('wfWall', R.s0, R.s1, 0.3, R.h, -D2 - R.d, -D2, { top: false }); B.boxXZ('lead', R.s0 - 0.15, R.s1 + 0.15, R.h, R.h + 0.12, -D2 - R.d - 0.15, -D2 + 0.02, { bottom: true });
    B.boxXZ('wfPlinth', R.s1 - 3.4, R.s1 - 0.6, 0.02, 2.5, -D2 - R.d - 0.03, -D2 - R.d, {}); B.boxXZ('wfWhite', R.s0 + 0.9, R.s0 + 1.8, 0.3, 2.3, -D2 - R.d - 0.03, -D2 - R.d, {}); }
  // ---- the veranda: floor, white fascia, brick steps, posts with curved braces, eaves beam, balustrade, end screen
  B.boxXZ('wfFloor', rs, L2, fl - 0.05, fl, V.back, V.front, { bottom: false });
  B.boxXZ('wfPlinth', rs, L2, 0, fl - 0.16, V.front - 0.06, V.front, { top: false }); B.boxXZ('wfWhite', rs, L2 + 0.02, fl - 0.16, fl + 0.01, V.front - 0.07, V.front + 0.03, { bottom: true });
  B.boxXZ('wfPlinth', L2 - 0.06, L2, 0, fl - 0.05, V.back, V.front, { top: false });
  { const st = V.steps, n = st.n; for (let k = 0; k < n; k++) B.boxXZ('redBrick', st.c - st.w / 2, st.c + st.w / 2, 0, (fl * (n - k)) / n, V.front + k * st.tread, V.front + (k + 1) * st.tread + 0.01, { top: true }); }
  const pz = V.front - 0.1, postT = wallT - 0.02;
  V.posts.forEach((s, i) => {
    B.boxXZ('white', s - 0.06, s + 0.06, fl, postT, pz - 0.06, pz + 0.06, { top: false });
    for (const e of [-1, 1]) {      // curved braces to the beam either side
      if ((i === 0 && e < 0) || (i === V.posts.length - 1 && e > 0)) continue;
      let prev = [s + e * 0.06, postT - 0.62, pz];
      for (let k = 1; k <= 4; k++) { const a = (k / 4) * (Math.PI / 2), q = [s + e * (0.06 + 0.5 * Math.sin(a)), postT - 0.62 + 0.52 * (1 - Math.cos(a)), pz]; B.beam('white', prev, q, 0.05, 0.06); prev = q; }
    }
  });
  B.boxXZ('white', rs, L2, postT - 0.1, wallT + 0.06, pz - 0.07, pz + 0.07, { bottom: true });
  const rail = (s0, s1) => { B.boxXZ('white', s0, s1, fl + 0.9, fl + 0.97, pz - 0.045, pz + 0.045, { bottom: true }); B.boxXZ('white', s0, s1, fl + 0.08, fl + 0.14, pz - 0.035, pz + 0.035, { bottom: true }); const n = Math.max(2, Math.round((s1 - s0) / 0.135)); for (let k = 1; k < n; k++) { const s = s0 + ((s1 - s0) * k) / n; B.boxXZ('white', s - 0.02, s + 0.02, fl + 0.14, fl + 0.9, pz - 0.02, pz + 0.02, { top: false }); } };
  for (const i of [0, 1, 2, 6, 7]) rail(V.posts[i] + 0.06, V.posts[i + 1] - 0.06);
  B.boxXZ('wfWhite', L2 - 0.07, L2, fl, wallT, V.back, V.front - 0.02, { top: false });      // the white boarded screen closing the west end
  B.boxXZ('wfWhite', rs, rs + 0.03, fl, wallT, V.back, V.front - 0.02, { top: false });        // ... and the room's wall on the veranda is white too
  B.poly('wfWhite', [[rs, wallT - 0.02, V.back], [L2, wallT - 0.02, V.back], [L2, wallT - 0.02, V.front], [rs, wallT - 0.02, V.front]], [0, -1, 0]);      // the veranda's boarded ceiling
  // its back wall: a half-glazed door, two 12-pane casement pairs, the white part-glazed double doors, a white boarded bay
  const zb = V.back + 0.02, pane = (x0, y0, x1, y1, cols, rows) => { B.boxXZ('white', x0 - 0.07, x1 + 0.07, y0 - 0.07, y1 + 0.07, zb - 0.01, zb + 0.03, {}); B.unit('glassDark', rectPts(x0, y0, x1, y1), zb + 0.035, [3, 0]); for (let i = 1; i < cols; i++) { const x = x0 + ((x1 - x0) * i) / cols; B.boxXZ('white', x - 0.014, x + 0.014, y0, y1, zb + 0.035, zb + 0.05, {}); } for (let j = 1; j < rows; j++) { const y = y0 + ((y1 - y0) * j) / rows; B.boxXZ('white', x0, x1, y - 0.014, y + 0.014, zb + 0.035, zb + 0.05, {}); } };
  for (const [s, w, h, kind] of V.doors) {
    if (kind === 'pair') { B.boxXZ('white', s - w / 2 - 0.06, s + w / 2 + 0.06, fl, fl + h + 0.06, zb - 0.01, zb + 0.03, {}); for (const e of [-1, 1]) { const x0 = s + (e < 0 ? -w / 2 + 0.05 : 0.03), x1 = s + (e < 0 ? -0.03 : w / 2 - 0.05); B.unit('glassDark', rectPts(x0 + 0.05, fl + 0.95, x1 - 0.05, fl + h - 0.1), zb + 0.035, [4, 0]); for (let j = 1; j < 3; j++) { const y = fl + 0.95 + ((h - 1.05) * j) / 3; B.boxXZ('white', x0 + 0.05, x1 - 0.05, y - 0.014, y + 0.014, zb + 0.035, zb + 0.05, {}); } B.boxXZ('white', (x0 + x1) / 2 - 0.014, (x0 + x1) / 2 + 0.014, fl + 0.95, fl + h - 0.1, zb + 0.035, zb + 0.05, {}); } B.boxXZ('frame', s - 0.012, s + 0.012, fl, fl + h, zb + 0.03, zb + 0.036, {}); }
    else { B.boxXZ('white', s - w / 2 - 0.06, s + w / 2 + 0.06, fl, fl + h + 0.06, zb - 0.01, zb + 0.03, {}); B.boxXZ('wfPlinth', s - w / 2, s + w / 2, fl + 0.02, fl + h, zb + 0.03, zb + 0.04, {}); pane(s - w / 2 + 0.14, fl + 1.05, s + w / 2 - 0.14, fl + h - 0.16, 2, 2); }
  }
  for (const [s, w] of V.wins) pane(s - w / 2, fl + 0.95, s + w / 2, fl + 2.2, 4, 3);
  B.boxXZ('wfWhite', V.posts[6] + 0.25, V.posts[7] + 0.5, fl, wallT - 0.02, zb - 0.01, zb + 0.025, { top: false });
  B.boxXZ('wfGreen', 4.25, 4.6, fl + 1.2, fl + 1.65, zb, zb + 0.14, {});      // the green cabinet by the doors (K: a defibrillator's)
  bench(B, 2.15, fl, V.back + 0.5, 1.7); bench(B, -2.15, fl, V.back + 0.5, 1.5);
  // the room's small sash to the field; the sash in the east wall
  { const z = V.front + 0.001; B.boxXZ('white', -6.52, -6.02, fl + 0.72, fl + 1.98, z, z + 0.03, {}); B.unit('glassDark', rectPts(-6.47, fl + 0.77, -6.07, fl + 1.93), z + 0.035, [5, 0]); for (let j = 1; j < 4; j++) B.boxXZ('white', -6.47, -6.07, fl + 0.77 + j * 0.29 - 0.012, fl + 0.77 + j * 0.29 + 0.012, z + 0.035, z + 0.05, {}); B.boxXZ('white', -6.282, -6.258, fl + 0.77, fl + 1.93, z + 0.035, z + 0.05, {}); }
  B.push(new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(-L2, 0, 0));      // the east wall's own frame: local x = t (towards the field), local z = -s (out of the east wall)
  { const x0 = -1.3, x1 = -0.3, y0 = fl + 0.65, y1 = fl + 2.0, z = 0.001; B.boxXZ('white', x0 - 0.07, x1 + 0.07, y0 - 0.07, y1 + 0.07, z, z + 0.03, {}); B.unit('glassDark', rectPts(x0, y0, x1, y1), z + 0.035, [6, 0]); for (let i = 1; i < 3; i++) B.boxXZ('white', x0 + (i * (x1 - x0)) / 3 - 0.012, x0 + (i * (x1 - x0)) / 3 + 0.012, y0, y1, z + 0.035, z + 0.05, {}); for (let j = 1; j < 4; j++) B.boxXZ('white', x0, x1, y0 + (j * (y1 - y0)) / 4 - 0.012, y0 + (j * (y1 - y0)) / 4 + 0.012, z + 0.035, z + 0.05, {}); }
  B.pop();
  // ---- the scoreboard's black board at the veranda's west end (its lettering is a plane of its own: worcester_fields.js)
  { const b = V.board; B.boxXZ('wfBlack', b.s0, b.s1, b.y0, b.y1, V.front - 0.03, V.front + 0.04, { bottom: true }); }
  // ---- the roof: four slopes of orange-red tile from the eaves' edge to a short ridge, bonnet hips, a white soffit
  const ex = L2 + ov, ez = D2 + ov, rh = V.ridgeHalf, E = [[-ex, ev, ez], [ex, ev, ez], [ex, ev, -ez], [-ex, ev, -ez]], R0 = [-rh, rg, 0], R1 = [rh, rg, 0];
  B.poly('wfTile', [E[0], E[1], R1, R0], [0, 1, 1]); B.poly('wfTile', [E[2], E[3], R0, R1], [0, 1, -1]); B.poly('wfTile', [E[1], E[2], R1], [1, 1, 0]); B.poly('wfTile', [E[3], E[0], R0], [-1, 1, 0]);
  B.poly('wfWhite', [E[0], E[1], E[2], E[3]].map((p) => [p[0], ev - 0.06, p[2]]), [0, -1, 0]);
  for (let i = 0; i < 4; i++) { const a = E[i], b = E[(i + 1) % 4]; B.beam('white', [a[0], ev - 0.03, a[2]], [b[0], ev - 0.03, b[2]], 0.05, 0.12); }
  for (const [a, b] of [[E[0], R0], [E[3], R0], [E[1], R1], [E[2], R1], [R0, R1]]) B.beam('wfTileD', [a[0], a[1] + 0.04, a[2]], [b[0], b[1] + 0.04, b[2]], 0.2, 0.1);
  { const s = V.stack; stack(B, s.s, 0, s.w, s.d, rg - 0.25, rg + s.h, 4, 'redBrick'); }
  // the clock gablet low on the front slope: white bargeboards, pale panels, a white dial
  { const g = V.gablet, kf = (rg - ev) / ez, zf = g.t, yb = ev + (ez - zf) * kf, ya = g.apex, zr = ez - (ya - ev) / kf, hw = g.w / 2;
    B.poly('wfPale', [[g.c - hw, yb, zf], [g.c + hw, yb, zf], [g.c, ya, zf]], [0, 0, 1]);
    for (const e of [-1, 1]) { B.poly('wfTile', [[g.c + e * (hw + 0.18), yb - 0.12, zf + 0.2], [g.c, ya + 0.02, zf + 0.2], [g.c, ya + 0.02, zr]], [e, 1, 0]); B.beam('white', [g.c + e * (hw + 0.12), yb - 0.08, zf + 0.16], [g.c, ya - 0.03, zf + 0.16], 0.07, 0.2); }
    B.boxXZ('white', g.c - hw, g.c + hw, yb - 0.02, yb + 0.12, zf, zf + 0.1, { bottom: true }); B.boxXZ('white', g.c - hw * 0.5, g.c + hw * 0.5, yb + (ya - yb) * 0.52, yb + (ya - yb) * 0.52 + 0.07, zf, zf + 0.05, {});
    for (const e of [-1, 1]) { B.boxXZ('white', g.c + e * 0.62 - 0.035, g.c + e * 0.62 + 0.035, yb + 0.12, yb + (ya - yb) * 0.62, zf, zf + 0.05, {}); B.boxXZ('wfBlack', g.c + e * 0.95 - 0.16, g.c + e * 0.95 + 0.16, yb + 0.2, yb + 0.62, zf + 0.004, zf + 0.012, {}); }
    const cy = yb + 0.5, r = 0.33;      // the dial
    B.push(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(g.c, cy, zf + 0.03)); B.cyl('white', 0, 0, 0, r, 0.03, 20, true); B.pop();
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; B.box('wfBlack', g.c + Math.sin(a) * r * 0.82, cy + Math.cos(a) * r * 0.82, zf + 0.064, 0.03, k % 3 ? 0.05 : 0.08, 0.006, 0, {}); }
    B.beam('wfBlack', [g.c, cy, zf + 0.068], [g.c + 0.13, cy + 0.1, zf + 0.068], 0.03, 0.006); B.beam('wfBlack', [g.c, cy, zf + 0.07], [g.c - 0.04, cy + 0.25, zf + 0.07], 0.022, 0.006); }
  // a flat-topped dormer on each end hip
  { const d = V.dormer, ks = (rg - ev) / (ex - rh), hw = d.w / 2;
    for (const e of [-1, 1]) { const xf = e * (ex - d.in), yb = ev + d.in * ks, yt = yb + d.h, xb = e * (ex - (yt - ev) / ks);
      B.poly('wfWhite', [[xf, yb, -hw], [xf, yb, hw], [xf, yt, hw], [xf, yt, -hw]], [e, 0, 0]);
      B.poly('glassDark', [[xf + e * 0.012, yb + 0.14, -hw + 0.12], [xf + e * 0.012, yb + 0.14, hw - 0.12], [xf + e * 0.012, yt - 0.1, hw - 0.12], [xf + e * 0.012, yt - 0.1, -hw + 0.12]], [e, 0, 0], [[3.5, 0.83], [3.6, 0.83], [3.6, 0.87], [3.5, 0.87]]);
      for (let i = 1; i < 4; i++) { const z = -hw + 0.12 + ((d.w - 0.24) * i) / 4; B.poly('white', [[xf + e * 0.02, yb + 0.14, z - 0.025], [xf + e * 0.02, yb + 0.14, z + 0.025], [xf + e * 0.02, yt - 0.1, z + 0.025], [xf + e * 0.02, yt - 0.1, z - 0.025]], [e, 0, 0]); }
      for (const z of [-hw, hw]) B.poly('wfWall', [[xf, yb, z], [xf, yt, z], [xb, yt, z]], [0, 0, z]);
      B.poly('lead', [[xf + e * 0.12, yt + 0.02, -hw - 0.1], [xf + e * 0.12, yt + 0.02, hw + 0.1], [xb, yt + 0.02, hw + 0.1], [xb, yt + 0.02, -hw - 0.1]], [0, 1, 0]); B.poly('white', [[xf + e * 0.12, yt - 0.06, -hw - 0.1], [xf + e * 0.12, yt - 0.06, hw + 0.1], [xf + e * 0.12, yt + 0.02, hw + 0.1], [xf + e * 0.12, yt + 0.02, -hw - 0.1]], [e, 0, 0]); } }
  // two planters at the steps (K: timber boxes of tulips in April 2024)
  for (const e of [-1, 1]) B.boxXZ('wood', V.steps.c + e * (V.steps.w / 2 + 0.55) - 0.45, V.steps.c + e * (V.steps.w / 2 + 0.55) + 0.45, 0, 0.42, V.front + 0.15, V.front + 0.6, { top: true });
  B.pop();
}

// ------------------------------------------------------------------------------------------------ tennis: surface, lines, nets, fence
function tennis(B, N, T) {
  const F = T.F, W = (a, b) => F.pt(a, b), y = LV.court, K = P.TENNIS;
  B.flat('wfSurround', T.ring, y);
  const line = (p, q, w = 0.05) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = (-(q[1] - p[1]) / l) * w / 2, nz = ((q[0] - p[0]) / l) * w / 2; B.poly('wfLine', [[p[0] - nx, y + 0.004, p[1] - nz], [q[0] - nx, y + 0.004, q[1] - nz], [q[0] + nx, y + 0.004, q[1] + nz], [p[0] + nx, y + 0.004, p[1] + nz]], [0, 1, 0]); };
  const posts = [];
  for (const [ca, cb] of T.courts) {
    const hl = 23.77 / 2, hw = 10.97 / 2, hs = 8.23 / 2, sv = 6.4, p = (s, t) => W(ca + s, cb + t);
    B.flat('wfCourt', [p(-hl, -hw), p(hl, -hw), p(hl, hw), p(-hl, hw)], y + 0.002);
    for (const t of [-hw, hw, -hs, hs]) line(p(-hl, t), p(hl, t));
    for (const s of [-hl, hl]) line(p(s, -hw), p(s, hw));
    for (const s of [-sv, sv]) line(p(s, -hs), p(s, hs));
    line(p(-sv, 0), p(sv, 0)); for (const s of [-hl, hl]) line(p(s, 0), p(s - Math.sign(s) * 0.12, 0));
    // the net: green posts 0.914 m outside the doubles lines, 1.07 m high, the net dipping to 0.914 m, a white tape
    const a = p(0, -hw - 0.914), b = p(0, hw + 0.914);
    for (const q of [a, b]) { B.cyl('wfGreen', q[0], 0, q[1], 0.04, 1.07 + y, 8, true); posts.push(q); }
    const n = 8;
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, y0 = 1.07 - 0.156 * Math.sin(Math.PI * t0), y1 = 1.07 - 0.156 * Math.sin(Math.PI * t1), q0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], q1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      N.quad([q0[0], y + 0.03, q0[1]], [q1[0], y + 0.03, q1[1]], [q1[0], y + y1 - 0.05, q1[1]], [q0[0], y + y0 - 0.05, q0[1]], NETC.black, 0.045);
      B.beam('white', [q0[0], y + y0 - 0.025, q0[1]], [q1[0], y + y1 - 0.025, q1[1]], 0.02, 0.05); }
  }
  // ---- the fence: green posts every 3 m or so, a top and a bottom rail, chain-link between; three gates, a leaf ajar
  const ring = T.ringAB, gates = [], solid = [];
  const side = (name) => (name === 'ne' ? [[K.A, 0], [K.A, K.ext.b0], [K.ext.a1, K.ext.b0], [K.ext.a1, K.ext.b1]] : [[0, 0], [0, K.ext.b1]]);
  const gateAt = K.gates.map(([name, b]) => ({ a: name === 'ne' ? (b > K.ext.b0 ? K.ext.a1 : K.A) : 0, b0: b - K.gateW / 2, b1: b + K.gateW / 2, out: name === 'ne' ? 1 : -1 }));
  const run = (p, q) => {      // one straight stretch in (a, b), gates cut out where it runs along b
    const pieces = []; const alongB = Math.abs(p[0] - q[0]) < 1e-6;
    if (alongB) { const lo = Math.min(p[1], q[1]), hi = Math.max(p[1], q[1]); let c = lo; for (const g of gateAt.filter((g2) => Math.abs(g2.a - p[0]) < 1e-6 && g2.b0 > lo && g2.b1 < hi).sort((u, v) => u.b0 - v.b0)) { pieces.push([[p[0], c], [p[0], g.b0]]); gates.push(g); c = g.b1; } pieces.push([[p[0], c], [p[0], hi]]); }
    else pieces.push([p, q]);
    for (const [u, v] of pieces) {
      const l = Math.hypot(v[0] - u[0], v[1] - u[1]); if (l < 0.05) continue; const n = Math.max(1, Math.round(l / 3.05));
      for (let k = 0; k <= n; k++) { const w = W(u[0] + ((v[0] - u[0]) * k) / n, u[1] + ((v[1] - u[1]) * k) / n); B.cyl('wfGreen', w[0], 0, w[1], 0.035, LV.fence + 0.06, 6, true); }
      const wu = W(u[0], u[1]), wv = W(v[0], v[1]);
      for (const h of [LV.fence, 0.12]) B.beam('wfGreen', [wu[0], h, wu[1]], [wv[0], h, wv[1]], 0.035, 0.035);
      N.panel(wu, wv, 0.06, LV.fence, NETC.link, 0.065); solid.push([wu, wv]);
    }
  };
  for (let i = 0; i < ring.length; i++) run(ring[i], ring[(i + 1) % ring.length]);
  void side;
  for (const g of gates) {      // gate frames: a leaf standing open outwards on its far post
    const h = W(g.a, g.b1), e = W(g.a + g.out * 0.14, g.b1 + 1.14);      // (folded back along the fence: the nets' walkway is 0.83 m wide)
    for (const yy of [0.1, LV.fence * 0.5, LV.fence - 0.05]) B.beam('wfGreen', [h[0], yy, h[1]], [e[0], yy, e[1]], 0.03, 0.03);
    B.cyl('wfGreen', e[0], 0.08, e[1], 0.025, LV.fence - 0.1, 6, true); N.panel(h, e, 0.1, LV.fence - 0.05, NETC.link, 0.065);
    const p0 = W(g.a, g.b0), p1 = W(g.a, g.b1); B.beam('wfGreen', [p0[0], LV.fence, p0[1]], [p1[0], LV.fence, p1[1]], 0.035, 0.035);
  }
  // the dividing curtain between the two courts and the third (green netting hung from a wire; open at its north-east end)
  { const p = W(0.1, K.ext.b0), q = W(K.A - 1.6, K.ext.b0); N.panel(p, q, 0.25, LV.fence - 0.1, NETC.curtain, 0.05); B.beam('wfGreen', [p[0], LV.fence - 0.08, p[1]], [q[0], LV.fence - 0.08, q[1]], 0.015, 0.015); solid.push([p, q]); }
  return { posts, solid, gates: gates.map((g) => [W(g.a, g.b0), W(g.a, g.b1)]) };
}

// ------------------------------------------------------------------------------------------------ the gardeners' machinery shed
function shed(B, T) {
  const S = P.SHED, a0 = T.shedA0, a1 = a0 + S.len, b1 = -S.gap, b0 = b1 - S.w, F = T.F, fl = LV.shedFloor;
  B.push(frame(F.o[0], 0, F.o[1], F.ux, F.uz));      // x = a (north-east along the fence), z = b (south-east, towards the courts)
  const yAt = (b) => LV.shedHi + ((LV.shedLo - LV.shedHi) * (b - (b0 - 0.3))) / (-0.25 - (b0 - 0.3));      // the roof's underside across the shed
  // slab, the four walls in vertical boarding (the gables follow the roof)
  B.boxXZ('wfSteel', a0 - 0.1, a1 + 0.1, 0, fl, b0 - 0.1, b1 + 0.1, { top: true });
  B.poly('wfCedar', [[a0, fl, b0], [a1, fl, b0], [a1, yAt(b0), b0], [a0, yAt(b0), b0]], [0, 0, -1]);
  B.poly('wfCedar', [[a0, fl, b1], [a1, fl, b1], [a1, yAt(b1), b1], [a0, yAt(b1), b1]], [0, 0, 1]);
  for (const [x, nx] of [[a0, -1], [a1, 1]]) B.poly('wfCedar', [[x, fl, b0], [x, fl, b1], [x, yAt(b1), b1], [x, yAt(b0), b0]], [nx, 0, 0], [[fl, 0], [fl, S.w], [yAt(b1), S.w], [yAt(b0), 0]]);
  // five pairs of timber-clad doors on the north-west face (bays 2 - 6), a single door to the secure store in bay 1
  for (let i = 1; i < 6; i++) { const c = a0 + (i + 0.5) * S.bay; for (const e of [-1, 1]) { const x0 = c + (e < 0 ? -1.5 : 0.015), x1 = c + (e < 0 ? -0.015 : 1.5); B.boxXZ('wfCedarD', x0, x1, fl + 0.02, LV.shedDoor, b0 - 0.045, b0 - 0.005, {}); for (const yy of [fl + 0.5, LV.shedDoor - 0.5]) B.boxXZ('iron', e < 0 ? x0 : x1 - 0.3, e < 0 ? x0 + 0.3 : x1, yy, yy + 0.05, b0 - 0.06, b0 - 0.045, {}); } B.boxXZ('wfSteel', c - 1.56, c + 1.56, LV.shedDoor, LV.shedDoor + 0.06, b0 - 0.05, b0, {}); }
  B.boxXZ('wfCedarD', a0 + 1.2, a0 + 2.2, fl + 0.02, fl + 2.1, b0 - 0.045, b0 - 0.005, {});
  for (let i = 0; i <= 6; i++) B.boxXZ('wfSteel', a0 + i * S.bay - 0.06, a0 + i * S.bay + 0.06, fl, yAt(b0) - 0.02, b0 - 0.03, b0 + 0.02, {});
  // the mono-pitch metal roof, overhanging; its fascia; the gutter along the low side
  const r0 = a0 - 0.3, r1 = a1 + S.cover, zb0 = b0 - 0.3, zb1 = -0.25, t = 0.1;
  B.poly('wfRoof', [[r0, LV.shedHi + t, zb0], [r1, LV.shedHi + t, zb0], [r1, LV.shedLo + t, zb1], [r0, LV.shedLo + t, zb1]], [0, 1, 0.2]);
  B.poly('wfSteel', [[r0, LV.shedHi, zb0], [r1, LV.shedHi, zb0], [r1, LV.shedLo, zb1], [r0, LV.shedLo, zb1]], [0, -1, 0]);
  B.poly('wfSteel', [[r0, LV.shedHi, zb0], [r1, LV.shedHi, zb0], [r1, LV.shedHi + t, zb0], [r0, LV.shedHi + t, zb0]], [0, 0, -1]); B.poly('wfSteel', [[r0, LV.shedLo, zb1], [r1, LV.shedLo, zb1], [r1, LV.shedLo + t, zb1], [r0, LV.shedLo + t, zb1]], [0, 0, 1]);
  for (const [x, nx] of [[r0, -1], [r1, 1]]) B.poly('wfSteel', [[x, LV.shedHi, zb0], [x, LV.shedLo, zb1], [x, LV.shedLo + t, zb1], [x, LV.shedHi + t, zb0]], [nx, 0, 0]);
  B.boxXZ('wfSteel', r0, r1, LV.shedLo - 0.1, LV.shedLo, zb1, zb1 + 0.12, { bottom: true });
  // the north-east end: hardstanding, the first 2.2 m under the roof behind a slatted screen up high, two posts, a skip
  B.flat('wfHard', [[a1, b0 - 0.1], [a1 + S.hard, b0 - 0.1], [a1 + S.hard, b1 + 0.1], [a1, b1 + 0.1]], 0.05);
  for (const b of [b0 + 0.08, b1 - 0.08]) B.boxXZ('wfSteel', a1 + S.cover - 0.14, a1 + S.cover - 0.02, 0, yAt(b) - 0.02, b - 0.06, b + 0.06, {});
  for (let x = a1 + 0.15; x < a1 + S.cover - 0.1; x += 0.16) B.boxXZ('wfCedar', x, x + 0.09, 2.45, yAt(b0) - 0.03, b0 - 0.02, b0 + 0.02, {});
  { const x0 = a1 + 3.3, x1 = a1 + 5.3, z0 = b0 + 1.2, z1 = b0 + 4.6; B.poly('wfPad', [[x0, 0.05, z0 + 0.4], [x1, 0.05, z0 + 0.4], [x1, 0.05, z1 - 0.4], [x0, 0.05, z1 - 0.4]], [0, 1, 0]);
    for (const [u0, u1, v0, v1, n] of [[x0, x1, z0, z0 + 0.4, [0, 0.4, -1]], [x0, x1, z1, z1 - 0.4, [0, 0.4, 1]]]) B.poly('gold', [[u0, 1.25, v0], [u1, 1.25, v0], [u1, 0.05, v1], [u0, 0.05, v1]], n);
    for (const [x, nx] of [[x0, -1], [x1, 1]]) B.poly('gold', [[x, 1.25, z0], [x, 1.25, z1], [x, 0.05, z1 - 0.4], [x, 0.05, z0 + 0.4]], [nx, 0, 0]); }
  B.pop();
  return [F.pt(a0, b0), F.pt(a1, b0), F.pt(a1, b1), F.pt(a0, b1)];
}

// ------------------------------------------------------------------------------------------------ the cricket nets
function cage(B, N, T) {
  const C = P.CAGE, [a0, a1, b0, b1] = P.cageAB(), F = T.F, W = (a, b) => F.pt(a, b), y = LV.court, h = LV.cage, bn = b0 + C.netted, am = (a0 + a1) / 2;
  B.flat('wfCarpet', [W(a0, b0), W(a1, b0), W(a1, b1), W(a0, b1)], y);
  const line = (p, q, w = 0.05) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = (-(q[1] - p[1]) / l) * w / 2, nz = ((q[0] - p[0]) / l) * w / 2; B.poly('wfLine', [[p[0] - nx, y + 0.004, p[1] - nz], [q[0] - nx, y + 0.004, q[1] - nz], [q[0] + nx, y + 0.004, q[1] + nz], [p[0] + nx, y + 0.004, p[1] + nz]], [0, 1, 0]); };
  // the steel frame over the batting end: posts down both sides and the middle, rails at the top, netting on the two
  // sides, the back, the middle and the roof; dark green boards along the foot
  const nb = 5, solid = [];
  for (const a of [a0, am, a1]) {
    for (let k = 0; k <= nb; k++) { const b = b0 + (C.netted * k) / nb, w = W(a, b); B.cyl('wfSteel', w[0], 0, w[1], 0.03, h, 6, true); }
    const p = W(a, b0), q = W(a, bn); B.beam('wfSteel', [p[0], h, p[1]], [q[0], h, q[1]], 0.04, 0.04); N.panel(p, q, 0.05, h, NETC.black, 0.05); solid.push([p, q]);
    const pb = W(a, b0), qb = W(a, a === am ? b0 + 9 : bn); B.push(frame(pb[0], 0, pb[1], qb[0] - pb[0], qb[1] - pb[1])); B.boxXZ('wfGreen', 0, Math.hypot(qb[0] - pb[0], qb[1] - pb[1]), y, 0.62, -0.012, 0.012, { bottom: false }); B.pop();
  }
  for (let k = 0; k <= nb; k++) { const b = b0 + (C.netted * k) / nb, p = W(a0, b), q = W(a1, b); B.beam('wfSteel', [p[0], h, p[1]], [q[0], h, q[1]], 0.04, 0.04); }
  { const p = W(a0, b0), q = W(a1, b0); N.panel(p, q, 0.05, h, NETC.black, 0.05); solid.push([p, q]); B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1])); B.boxXZ('wfGreen', 0, C.w, y, 0.62, -0.012, 0.012, {}); B.pop(); }
  { const c = [W(a0, b0), W(a1, b0), W(a1, bn), W(a0, bn)]; N.quad([c[0][0], h, c[0][1]], [c[1][0], h, c[1][1]], [c[2][0], h, c[2][1]], [c[3][0], h, c[3][1]], NETC.black, 0.05); }
  // creases and spring-back stumps at the batting end of each lane, the bowling crease at the far end
  for (const ac of [(a0 + am) / 2, (am + a1) / 2]) {
    line(W(ac - 1.32, b0 + 1.5), W(ac + 1.32, b0 + 1.5)); line(W(ac - 1.83, b0 + 2.72), W(ac + 1.83, b0 + 2.72)); line(W(ac - 1.32, b0 + 21.62), W(ac + 1.32, b0 + 21.62)); line(W(ac - 1.83, b0 + 20.4), W(ac + 1.83, b0 + 20.4));
    for (const t of [-0.114, 0, 0.114]) { const w = W(ac + t, b0 + 1.5); B.cyl('wood', w[0], y, w[1], 0.018, 0.71, 6, true); }
    const s0 = W(ac - 0.2, b0 + 1.5), s1 = W(ac + 0.2, b0 + 1.5); B.beam('wfBlack', [s0[0], y + 0.02, s0[1]], [s1[0], y + 0.02, s1[1]], 0.12, 0.04);
  }
  return { solid };
}

// ------------------------------------------------------------------------------------------------ the field: bands, table, pitch, screen
function field(B, poly, T, R) {
  // ---- the mowing: every other band a shade lighter, cut to the field, off the croquet lawn (and under the courts)
  const bw = P.BANDS.w, br = (P.BANDS.bearing * Math.PI) / 180, d = [Math.sin(br), -Math.cos(br)], n = [-d[1], d[0]];      // d along the bands, n across
  let lo = 1e9, hi = -1e9; for (const p of poly) { const t = p[0] * n[0] + p[1] * n[1]; lo = Math.min(lo, t); hi = Math.max(hi, t); }
  const cq = P.croquetRing(); let bands = 0;
  for (let t = Math.ceil(lo / bw) * bw, k = 0; t < hi; t += bw, k++) {
    if (k % 2) continue;
    let piece = P.clipHP(P.clipHP(poly, n, t + bw), [-n[0], -n[1]], -t); if (piece.length < 3) continue;
    for (const pc of P.minusConvex(piece, cq)) {
      // (ear-free: the pieces are thin and nearly convex; triangulated by three's own earcut all the same)
      const tr = THREE.ShapeUtils.triangulateShape(pc.map((q) => new THREE.Vector2(q[0], q[1])), []);
      const uv = (q) => [(q[0] * n[0] + q[1] * n[1]) , (q[0] * d[0] + q[1] * d[1])];
      for (const f of tr) { const a = pc[f[0]], b = pc[f[1]], c = pc[f[2]]; B.poly('wfBand', [[a[0], 0.032, a[1]], [b[0], 0.032, b[1]], [c[0], 0.032, c[1]]], [0, 1, 0], [uv(a), uv(b), uv(c)]); }
      bands++;
    }
  }
  // ---- the cricket table: five close-mown strips, roped off for the winter on short stakes
  const tb = P.TABLE, tr2 = (tb.bearing * Math.PI) / 180, TF = P.mkFrame(tb.c, [Math.sin(tr2), -Math.cos(tr2)]), hl = tb.len / 2, w = tb.strips * tb.strip;
  for (let i = 0; i < tb.strips; i++) { const b0 = -w / 2 + i * tb.strip, q = [TF.pt(-hl, b0), TF.pt(hl, b0), TF.pt(hl, b0 + tb.strip), TF.pt(-hl, b0 + tb.strip)]; B.poly(i % 2 ? 'wfTableB' : 'wfTable', q.map((p) => [p[0], 0.034, p[1]]), [0, 1, 0], q.map((p) => { const l = TF.inv(p[0], p[1]); return [l[1], l[0]]; })); }
  const rope = [[-hl - tb.rope, -w / 2 - tb.rope], [hl + tb.rope, -w / 2 - tb.rope], [hl + tb.rope, w / 2 + tb.rope], [-hl - tb.rope, w / 2 + tb.rope]], stakes = [];
  for (let i = 0; i < 4; i++) { const a = rope[i], b = rope[(i + 1) % 4], l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.round(l / 4.4); for (let j = 0; j < k; j++) stakes.push(TF.pt(a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k)); }
  stakes.forEach((p, i) => { const q = stakes[(i + 1) % stakes.length]; B.cyl('white', p[0], 0, p[1], 0.022, 0.86, 5, true); const m = [(p[0] + q[0]) / 2, 0.66, (p[1] + q[1]) / 2]; B.beam('wfRope', [p[0], 0.8, p[1]], m, 0.015, 0.015); B.beam('wfRope', m, [q[0], 0.8, q[1]], 0.015, 0.015); });
  // ---- the rugby pitch: white lines, an H at each end
  for (const [p, q] of R.lines) { const l = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = (-(q[1] - p[1]) / l) * 0.05, nz = ((q[0] - p[0]) / l) * 0.05; B.poly('wfLine', [[p[0] - nx, 0.04, p[1] - nz], [q[0] - nx, 0.04, q[1] - nz], [q[0] + nx, 0.04, q[1] + nz], [p[0] + nx, 0.04, p[1] + nz]], [0, 1, 0]); }
  for (const q of R.posts) rugbyPosts(B, q);
  return { bands, stakes: stakes.length, table: rope.map((q) => TF.pt(q[0], q[1])) };
}
/** the white sight screen on its wheeled timber frame, 4.6 x 3.9 m (K: the 2013 and 2023 pictures): centre c, facing heading h */
function sightScreen(B, c, dir) {
  B.push(frame(c[0], 0, c[1], dir[0], dir[1]));      // x along the screen, z = the way it faces
  for (let i = 0; i < 12; i++) B.boxXZ('white', -2.3, 2.3, 0.55 + i * 0.28, 0.55 + i * 0.28 + 0.24, -0.02, 0.02, { bottom: true });
  for (const x of [-2.3, -0.77, 0.77, 2.3]) B.boxXZ('white', x - 0.04, x + 0.04, 0.3, 3.95, -0.07, -0.02, {});
  for (const x of [-2.1, 2.1]) { B.beam('wood', [x, 0.3, -1.1], [x, 0.3, 0.7], 0.09, 0.09); B.beam('wood', [x, 3.4, -0.05], [x, 0.32, -1.05], 0.07, 0.07); for (const z of [-1.0, 0.6]) { B.push(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(x + 0.06, 0.2, z)); B.cyl('wfBlack', 0, 0, 0, 0.2, 0.12, 10, true); B.pop(); } }
  B.pop();
}

/**
 * Everything of the fields into B (solid, flat) and N (netting). env: { pav: frame, field: outline, T: tennisLayout(), R: rugbyLayout() }
 * -> { built: {part: triangles}, out: what the colliders need }
 */
export function buildFields(B, N, env) {
  const built = {}, out = {};
  const part = (name, fn) => { const n0 = B.tris() + N.tris(), depth = B.stack.length; try { const r = fn(); if (r) out[name] = r; } catch (e) { console.error('[worcester_fields] ' + name, e); while (B.stack.length > depth) B.pop(); } built[name] = Math.round(B.tris() + N.tris() - n0); };
  part('pavilion', () => pavilion(B, env.pav));
  part('tennis courts and fence', () => tennis(B, N, env.T));
  part('machinery shed', () => ({ ring: shed(B, env.T) }));
  part('cricket nets', () => cage(B, N, env.T));
  part('field', () => field(B, env.field, env.T, env.R));
  part('sight screen', () => { const s = env.screen; sightScreen(B, s.c, s.dir); return s; });
  return { built, out };
}
