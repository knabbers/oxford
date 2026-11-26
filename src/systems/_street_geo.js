// Streetscape geometry: low-poly prototypes of every street item (vertex-coloured, metric, origin on the ground, the
// side that faces the street is +z) and the one small canvas atlas they share with the grass (sign faces, A-board
// lettering, estate-agent boards, bicycle wheels, grass blades, basket flowers). DOM is only touched in paintAtlas(),
// so the prototypes build in node for the smoke test.
//
// A prototype is {pos, nor, col, uv, fx, idx, nv, ni} (typed arrays). fx is a vec3 per vertex:
//   x = glow gate: >= 0 night threshold (lamp glass: lit while world.night is past it; the item's own stagger is
//       added when it is written), -1 none, -2 flashing (Belisha), -3 always on (signal lenses)
//   y = glow strength (emissive multiplier of the vertex colour)
//   z = wind sway weight (grass: 0 at the root, 1 at the tip)
import * as THREE from 'three';

// ---- atlas layout (1024 x 512): rects are [x, y, w, h] in canvas pixels (y down)
export const ATLAS_W = 1024, ATLAS_H = 512;
// systems/crossings.js on? (read here, not imported: this file stays free of three.js for the node tools)
const CROSSINGS_ON = (() => { const off = /^(0|false|off|no)$/i;
  try { const v = typeof process !== 'undefined' && process.env ? process.env.GTO_CROSSINGS : undefined; if (v !== undefined) return !off.test(v); } catch { /* */ }
  try { const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || ''); if (q.has('crossings')) return !off.test(q.get('crossings') || ''); } catch { /* */ }
  return true; })();

export const RECT = {
  white: [2, 2, 12, 12],
  noEntry: [16, 0, 128, 128], oneWay: [144, 0, 128, 128], limit20: [272, 0, 128, 128], cycle: [400, 0, 128, 128],
  pay: [528, 0, 128, 128], permit: [656, 0, 128, 128], pedRed: [784, 0, 64, 64], pedGreen: [784, 64, 64, 64],
  wheel: [848, 0, 128, 128],
  ab0: [0, 128, 128, 160], ab1: [128, 128, 128, 160], ab2: [256, 128, 128, 160], ab3: [384, 128, 128, 160], ab4: [512, 128, 128, 160], ab5: [640, 128, 128, 160],
  ea0: [768, 128, 128, 96], ea1: [896, 128, 128, 96], ea2: [768, 224, 128, 96], ea3: [896, 224, 128, 96],
  gShort: [0, 288, 256, 96], gLong: [256, 288, 256, 128], gFlower: [512, 288, 256, 128], gClover: [768, 320, 256, 96],
  basket: [0, 416, 128, 96],
};
export const uvRect = (r) => [(r[0] + 0.5) / ATLAS_W, 1 - (r[1] + r[3] - 0.5) / ATLAS_H, (r[0] + r[2] - 0.5) / ATLAS_W, 1 - (r[1] + 0.5) / ATLAS_H];
const WHITE_UV = (() => { const r = uvRect(RECT.white); return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; })();

export const ABOARD_TEXT = [
  ['FRESH', 'COFFEE', '& homemade', 'cakes', 'come in!'], ['SOUP', 'OF THE DAY', 'leek &', 'potato', '£3.50'],
  ['LIVE', 'MUSIC', 'Friday', 'from 9pm', ''], ['SUNDAY', 'ROAST', 'served', '12 - 4', 'book now'],
  ['REAL', 'ALES', 'quiz night', 'tuesdays', ''], ['STUDENT', 'DEAL', 'any wrap', '+ drink', '£4.95'],
];
// invented agents (no real firm's name or mark)
export const AGENTS = [['FOR SALE', 'Mallory & Daunt', '#1d3b6e'], ['TO LET', 'Cherwell Keys', '#7a1d2a'], ['SOLD', 'Fenwick Thrupp', '#20573a'], ['TO LET', 'Plowman Hale', '#4a2a6a']];

/** The shared atlas (browser only) -> CanvasTexture */
export function paintAtlas() {
  const c = document.createElement('canvas'); c.width = ATLAS_W; c.height = ATLAS_H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, ATLAS_W, ATLAS_H);
  const R = RECT;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 16, 16);
  const disc = (r, fill, ring) => { const [x, y, w] = r, cx = x + w / 2, cy = y + w / 2; g.fillStyle = ring || fill; g.beginPath(); g.arc(cx, cy, w * 0.47, 0, 7); g.fill(); if (ring) { g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, w * 0.36, 0, 7); g.fill(); } return [cx, cy]; };
  const font = (px, bold = true) => { g.font = `${bold ? 'bold ' : ''}${px}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; };
  { const [cx, cy] = disc(R.noEntry, '#c8102e'); g.fillStyle = '#fff'; g.fillRect(cx - 40, cy - 11, 80, 22); }
  { const [x, y, w, h] = R.oneWay; g.fillStyle = '#1d4fa0'; g.fillRect(x + 4, y + 34, w - 8, h - 68); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 18, y + 58); g.lineTo(x + 88, y + 58); g.lineTo(x + 88, y + 46); g.lineTo(x + 112, y + 64); g.lineTo(x + 88, y + 82); g.lineTo(x + 88, y + 70); g.lineTo(x + 18, y + 70); g.fill(); }
  { const [cx, cy] = disc(R.limit20, '#ffffff', '#c8102e'); font(54); g.fillStyle = '#111'; g.fillText('20', cx, cy + 3); }
  { const [cx, cy] = disc(R.cycle, '#1d4fa0'); g.strokeStyle = '#fff'; g.lineWidth = 6; for (const dx of [-22, 22]) { g.beginPath(); g.arc(cx + dx, cy + 14, 15, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(cx - 22, cy + 14); g.lineTo(cx - 6, cy - 12); g.lineTo(cx + 14, cy - 12); g.lineTo(cx + 22, cy + 14); g.moveTo(cx - 6, cy - 12); g.lineTo(cx + 2, cy + 14); g.lineTo(cx + 14, cy - 12); g.stroke(); }
  { const [x, y, w, h] = R.pay; g.fillStyle = '#fff'; g.fillRect(x + 6, y + 6, w - 12, h - 12); g.fillStyle = '#1d4fa0'; g.fillRect(x + 12, y + 12, w - 24, 56); font(50); g.fillStyle = '#fff'; g.fillText('P', x + w / 2, y + 42); font(15); g.fillStyle = '#111'; g.fillText('Pay & display', x + w / 2, y + 84); g.fillText('8am - 6.30pm', x + w / 2, y + 104); }
  { const [x, y, w, h] = R.permit; g.fillStyle = '#fff'; g.fillRect(x + 6, y + 6, w - 12, h - 12); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(x + 10, y + 10, w - 20, h - 20); font(18); g.fillStyle = '#111'; g.fillText('Permit', x + w / 2, y + 36); g.fillText('holders', x + w / 2, y + 58); g.fillText('only', x + w / 2, y + 80); font(14, false); g.fillText('Zone N', x + w / 2, y + 104); }
  for (const [r, col, walk] of [[R.pedRed, '#ff3b2a', false], [R.pedGreen, '#4dff7a', true]]) {
    const [x, y, w, h] = r; g.fillStyle = '#080808'; g.fillRect(x, y, w, h); g.fillStyle = col; const cx = x + w / 2;
    g.beginPath(); g.arc(cx, y + 13, 6, 0, 7); g.fill(); g.fillRect(cx - 5, y + 20, 10, 20);
    if (walk) { g.save(); g.translate(cx, y + 40); g.rotate(0.35); g.fillRect(-3, 0, 6, 18); g.rotate(-0.7); g.fillRect(-3, 0, 6, 18); g.restore(); }
    else { g.fillRect(cx - 5, y + 40, 4, 18); g.fillRect(cx + 1, y + 40, 4, 18); }
  }
  { const [x, y, w] = R.wheel, cx = x + w / 2, cy = y + w / 2; g.strokeStyle = '#151515'; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, 56, 0, 7); g.stroke(); g.strokeStyle = '#9a9a9a'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 50, 0, 7); g.stroke();
    g.lineWidth = 1.2; for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50); g.stroke(); } g.fillStyle = '#888'; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill(); }
  ABOARD_TEXT.forEach((lines, i) => {
    const [x, y, w, h] = R['ab' + i]; g.fillStyle = '#6b4a2b'; g.fillRect(x, y, w, h); g.fillStyle = i % 3 === 2 ? '#1a1f2b' : '#1f2420'; g.fillRect(x + 8, y + 8, w - 16, h - 16);
    const ink = ['#f4f1e6', '#f2d36b', '#9fd8f0', '#f4b3c2'];
    lines.forEach((t, k) => { if (!t) return; font(k < 2 ? 22 : 16, k < 2); g.fillStyle = ink[(i + k) % ink.length]; g.fillText(t, x + w / 2, y + 30 + k * 26); });
  });
  AGENTS.forEach(([head, name, bg], i) => {
    const [x, y, w, h] = R['ea' + i]; g.fillStyle = bg; g.fillRect(x, y, w, h); g.fillStyle = '#fff'; g.fillRect(x + 6, y + 6, w - 12, 34);
    font(22); g.fillStyle = bg; g.fillText(head, x + w / 2, y + 24); font(14); g.fillStyle = '#fff'; g.fillText(name, x + w / 2, y + 60); font(10, false); g.fillText('01865 ' + (240000 + i * 13711), x + w / 2, y + 80);
  });
  let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const blades = (r, n, hmin, hmax, colA, colB, lean, flowers, clover) => {
    const [x, y, w, h] = r;
    for (let i = 0; i < n; i++) {
      const bx = x + 2 + rnd() * (w - 4), bh = h * (hmin + rnd() * (hmax - hmin)), ln = (rnd() - 0.5) * lean, t = rnd(), k = 0.75 + rnd() * 0.4;
      g.strokeStyle = `rgb(${Math.round((colA[0] + (colB[0] - colA[0]) * t) * k)},${Math.round((colA[1] + (colB[1] - colA[1]) * t) * k)},${Math.round((colA[2] + (colB[2] - colA[2]) * t) * k)})`;
      g.lineWidth = 1.4 + rnd() * 1.8; g.beginPath(); g.moveTo(bx, y + h); g.quadraticCurveTo(bx + ln * 0.3, y + h - bh * 0.6, bx + ln, y + h - bh); g.stroke();
    }
    if (clover) for (let i = 0; i < 26; i++) { const cx = x + 6 + rnd() * (w - 12), cy = y + h * (0.45 + rnd() * 0.5); g.fillStyle = `rgb(${60 + rnd() * 30 | 0},${110 + rnd() * 40 | 0},${45 + rnd() * 20 | 0})`; for (let k = 0; k < 3; k++) { const a = k * 2.1 + rnd(); g.beginPath(); g.arc(cx + Math.cos(a) * 3.2, cy + Math.sin(a) * 2.2, 3, 0, 7); g.fill(); } }
    for (let i = 0; i < flowers; i++) {
      const fx = x + 8 + rnd() * (w - 16), fy = y + h * (0.12 + rnd() * 0.45), kind = rnd();
      g.strokeStyle = '#4f7a36'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + (rnd() - 0.5) * 4, y + h); g.stroke();
      if (kind < 0.45) { g.fillStyle = '#f7f5ee'; for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283; g.beginPath(); g.arc(fx + Math.cos(a) * 3, fy + Math.sin(a) * 2.2, 1.8, 0, 7); g.fill(); } g.fillStyle = '#e8b81c'; g.beginPath(); g.arc(fx, fy, 1.7, 0, 7); g.fill(); }
      else if (kind < 0.8) { g.fillStyle = '#f2c41a'; g.beginPath(); g.arc(fx, fy, 3.6, 0, 7); g.fill(); g.fillStyle = '#d99a0c'; g.beginPath(); g.arc(fx, fy, 1.5, 0, 7); g.fill(); }
      else { g.fillStyle = '#d8c6e6'; g.beginPath(); g.arc(fx, fy, 3, 0, 7); g.fill(); }
    }
  };
  blades(R.gShort, 140, 0.35, 0.95, [88, 140, 52], [120, 160, 70], 10, 0, false);
  blades(R.gLong, 110, 0.4, 0.98, [96, 140, 58], [170, 162, 98], 26, 0, false);
  blades(R.gFlower, 90, 0.3, 0.9, [92, 142, 56], [140, 158, 80], 20, 12, false);
  blades(R.gClover, 60, 0.2, 0.7, [84, 136, 50], [110, 150, 62], 10, 7, true);
  { const [x, y, w, h] = R.basket; for (let i = 0; i < 160; i++) { const px = x + 6 + rnd() * (w - 12), py = y + 4 + rnd() * (h - 8) * (0.4 + 0.6 * Math.abs(px - x - w / 2) / (w / 2)); const k = rnd(); g.fillStyle = k < 0.45 ? `rgb(${50 + rnd() * 30 | 0},${100 + rnd() * 40 | 0},40)` : ['#e83a6c', '#f4f0f4', '#a54ad6', '#ff7a2a', '#e8204a'][(rnd() * 5) | 0]; g.beginPath(); g.arc(px, py, 2.5 + rnd() * 2.5, 0, 7); g.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---- prototype builder
const _c = new THREE.Color();
export class PB {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.f = []; this.i = []; this.col = [1, 1, 1]; this.fx = [-1, 0]; }
  color(hex, k = 1) { _c.set(hex); this.col = [_c.r * k, _c.g * k, _c.b * k]; return this; }
  glow(gate, k) { this.fx = [gate, k]; return this; }
  noGlow() { this.fx = [-1, 0]; return this; }
  v(x, y, z, nx, ny, nz, u = WHITE_UV[0], vv = WHITE_UV[1], wind = 0) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(this.col[0], this.col[1], this.col[2]); this.u.push(u, vv); this.f.push(this.fx[0], this.fx[1], wind);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); return this; }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); return this; }
  /** box centred on (cx, cz) from y0 up h; ry turns it about its own centre; no bottom face; tapers shrink the top */
  box(cx, y0, cz, w, h, d, { ry = 0, top = true, taperX = 1, taperZ = 1 } = {}) {
    const cs = Math.cos(ry), sn = Math.sin(ry), hw = w / 2, hd = d / 2, tw = hw * taperX, td = hd * taperZ;
    const P = (x, z) => [cx + x * cs + z * sn, cz - x * sn + z * cs];
    const N = (x, y, z) => [x * cs + z * sn, y, -x * sn + z * cs];
    const faces = [
      [[-hw, 0, hd], [hw, 0, hd], [tw, h, td], [-tw, h, td], [0, 0, 1]], [[hw, 0, -hd], [-hw, 0, -hd], [-tw, h, -td], [tw, h, -td], [0, 0, -1]],
      [[hw, 0, hd], [hw, 0, -hd], [tw, h, -td], [tw, h, td], [1, 0, 0]], [[-hw, 0, -hd], [-hw, 0, hd], [-tw, h, td], [-tw, h, -td], [-1, 0, 0]],
    ];
    if (top) faces.push([[-tw, h, td], [tw, h, td], [tw, h, -td], [-tw, h, -td], [0, 1, 0]]);
    for (const f of faces) { const nn = N(...f[4]); const ids = f.slice(0, 4).map((q) => { const p = P(q[0], q[2]); return this.v(p[0], y0 + q[1], p[1], nn[0], nn[1], nn[2]); }); this.quad(ids[0], ids[1], ids[2], ids[3]); }
    return this;
  }
  /** cylinder / cone frustum along y with seg sides and an optional top cap */
  cyl(cx, y0, cz, r0, r1, h, seg, { top = true, rot = 0 } = {}) {
    const ring = [], sl = (r0 - r1) / h, nl = Math.hypot(1, sl);
    for (let k = 0; k <= seg; k++) {
      const a = rot + (k / seg) * Math.PI * 2, x = Math.sin(a), z = Math.cos(a);
      ring.push([this.v(cx + x * r0, y0, cz + z * r0, x / nl, sl / nl, z / nl), this.v(cx + x * r1, y0 + h, cz + z * r1, x / nl, sl / nl, z / nl)]);
    }
    for (let k = 0; k < seg; k++) this.quad(ring[k][0], ring[k + 1][0], ring[k + 1][1], ring[k][1]);
    if (top && r1 > 0.001) { const c = this.v(cx, y0 + h, cz, 0, 1, 0), rr = []; for (let k = 0; k < seg; k++) { const a = rot + (k / seg) * Math.PI * 2; rr.push(this.v(cx + Math.sin(a) * r1, y0 + h, cz + Math.cos(a) * r1, 0, 1, 0)); } for (let k = 0; k < seg; k++) this.tri(c, rr[k], rr[(k + 1) % seg]); }
    return this;
  }
  /** thin 4-sided rod between two points */
  rod(a, b, r) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
    const d = [dx / L, dy / L, dz / L], up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let s = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const sl = Math.hypot(s[0], s[1], s[2]); s = s.map((x) => x / sl);
    const t = [s[1] * d[2] - s[2] * d[1], s[2] * d[0] - s[0] * d[2], s[0] * d[1] - s[1] * d[0]];
    const off = [s, t, s.map((x) => -x), t.map((x) => -x)], ids = [];
    for (const o of off) ids.push([this.v(a[0] + o[0] * r, a[1] + o[1] * r, a[2] + o[2] * r, o[0], o[1], o[2]), this.v(b[0] + o[0] * r, b[1] + o[1] * r, b[2] + o[2] * r, o[0], o[1], o[2])]);
    for (let k = 0; k < 4; k++) { const A = ids[k], B = ids[(k + 1) % 4]; this.quad(A[0], B[0], B[1], A[1]); }
    return this;
  }
  /** textured vertical card centred on (cx, cz), facing +z turned by ry about its own centre. back: null | 'same' (both
   *  windings, one face) | 'white' | a rect (a separate back face, optionally coloured backCol). normalUp: lit like the ground */
  card(cx, y0, cz, w, h, rect, { back = null, backCol = null, ry = 0, wind = false, normalUp = false } = {}) {
    const cs = Math.cos(ry), sn = Math.sin(ry), P = (x) => [cx + x * cs, cz - x * sn];
    const fn = normalUp ? [0, 1, 0] : [sn, 0, cs];
    const [u0, v0, u1, v1] = uvRect(rect), hw = w / 2;
    const q = [[-hw, y0, u0, v0, 0], [hw, y0, u1, v0, 0], [hw, y0 + h, u1, v1, 1], [-hw, y0 + h, u0, v1, 1]];
    const ids = q.map(([x, y, u, v, wd]) => { const p = P(x); return this.v(p[0], y, p[1], fn[0], fn[1], fn[2], u, v, wind ? wd : 0); });
    this.quad(ids[0], ids[1], ids[2], ids[3]);
    if (back === 'same') this.i.push(ids[0], ids[2], ids[1], ids[0], ids[3], ids[2]);
    else if (back) {
      const keep = this.col; if (backCol !== null) this.color(backCol);
      const bn = normalUp ? [0, 1, 0] : [-fn[0], 0, -fn[2]], [b0, w0, b1, w1] = back === 'white' ? [WHITE_UV[0], WHITE_UV[1], WHITE_UV[0], WHITE_UV[1]] : uvRect(back);
      const bq = [[hw, y0, b0, w0], [-hw, y0, b1, w0], [-hw, y0 + h, b1, w1], [hw, y0 + h, b0, w1]];
      const bi = bq.map(([x, y, u, v]) => { const p = P(x); return this.v(p[0], y, p[1], bn[0], bn[1], bn[2], u, v); });
      this.quad(bi[0], bi[1], bi[2], bi[3]); this.col = keep;
    }
    return this;
  }
  /** a flat board of width w (along x) from its bottom edge (y0, z0) to its top edge (y1, z1); faces away from z = 0
   *  (inward = true: towards it); the lettering reads the right way round from the side it faces */
  slab(w, y0, z0, y1, z1, rect, inward = false) {
    const dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dy, dz) || 1, hw = w / 2;
    let ny = -dz / L, nz = dy / L;                      // the normal of the winding a, b, c, d below
    const out = nz * z0 > 0, flip = out === inward;
    if (flip) { ny = -ny; nz = -nz; }
    let [u0, v0, u1, v1] = uvRect(rect); if (nz < 0) [u0, u1] = [u1, u0];
    const a = this.v(-hw, y0, z0, 0, ny, nz, u0, v0), b = this.v(hw, y0, z0, 0, ny, nz, u1, v0), c = this.v(hw, y1, z1, 0, ny, nz, u1, v1), d = this.v(-hw, y1, z1, 0, ny, nz, u0, v1);
    if (flip) this.quad(a, d, c, b); else this.quad(a, b, c, d);
    return this;
  }
  done() {
    return { pos: new Float32Array(this.p), nor: new Float32Array(this.n), col: new Float32Array(this.c), uv: new Float32Array(this.u), fx: new Float32Array(this.f), idx: new Uint16Array(this.i), nv: this.p.length / 3, ni: this.i.length };
  }
}

// the lantern bowl was emitted as a vertical card (the last 4 vertices): lay it flat at height y, facing down
function fixBowl(d, y, h) {
  for (let i = d.nv - 4; i < d.nv; i++) {
    const yy = d.pos[i * 3 + 1];
    d.pos[i * 3 + 2] += (yy - y) - h / 2; d.pos[i * 3 + 1] = y - 0.005;
    d.nor[i * 3] = 0; d.nor[i * 3 + 1] = -1; d.nor[i * 3 + 2] = 0;
  }
  return d;
}

const IRON = 0x15171a, GOLD = 0xb8923a, GALV = 0x8d949a, RED = 0xb3140f;
/** Light colour by lamp type (sRGB): H heritage lantern (warm white), S arterial column (high-pressure sodium), R residential (low-pressure sodium) */
export const LAMP_COL = { H: 0xffd49a, S: 0xffa448, R: 0xff8f2a };
/** head (light source) position relative to the column base, in the column's frame (+z = towards the carriageway) */
export const LAMP_HEAD = { H: [0, 4.15, 0], S: [0, 7.8, 1.4], R: [0, 5.55, 0.75] };

/** All prototypes keyed by item kind (arrays = wording / board variants). */
export function buildProtos() {
  const P = {}, pb = () => new PB();
  // heritage lantern column (the centre's Victorian pattern): fluted base, slim shaft, ladder bar, four-sided lantern
  P.lampH = (() => { const b = pb().color(IRON);
    b.cyl(0, 0, 0, 0.17, 0.13, 0.75, 6, { top: false }).cyl(0, 0.75, 0, 0.075, 0.055, 3.05, 6, { top: false }).cyl(0, 3.8, 0, 0.06, 0.1, 0.13, 6, { top: false });
    b.box(0, 3.6, 0, 0.62, 0.04, 0.04);
    b.color(0xfff0d0).glow(0, 3.0).cyl(0, 3.93, 0, 0.13, 0.21, 0.42, 4, { top: false, rot: Math.PI / 4 });
    b.noGlow().color(IRON).cyl(0, 4.35, 0, 0.24, 0.04, 0.2, 4, { top: false, rot: Math.PI / 4 }).cyl(0, 4.55, 0, 0.025, 0.012, 0.18, 4);
    return b.done(); })();
  // arterial column (8 m, galvanised, bracket arm over the carriageway, flat lantern with a glowing bowl underneath)
  P.lampS = (() => { const b = pb().color(GALV);
    b.cyl(0, 0, 0, 0.1, 0.065, 7.9, 6, { top: true });
    b.rod([0, 7.6, 0], [0, 7.95, 0.9], 0.035).rod([0, 7.95, 0.9], [0, 7.98, 1.15], 0.035);
    b.color(0x5a5f63).box(0, 7.85, 1.4, 0.32, 0.14, 0.7, { taperX: 0.8, taperZ: 0.85 });
    b.color(0xffd9a0).glow(0, 3.4).card(0, 7.845, 1.4, 0.26, 0.6, RECT.white);
    return fixBowl(b.done(), 7.845, 0.6); })();
  // residential column (5.5 m, short arm, small lantern)
  P.lampR = (() => { const b = pb().color(0x9a9f9c);
    b.cyl(0, 0, 0, 0.08, 0.055, 5.5, 6, { top: true });
    b.rod([0, 5.35, 0], [0, 5.62, 0.55], 0.03);
    b.color(0x50565a).box(0, 5.58, 0.75, 0.24, 0.12, 0.5, { taperX: 0.75, taperZ: 0.8 });
    b.color(0xffc078).glow(0, 3.4).card(0, 5.575, 0.75, 0.2, 0.42, RECT.white);
    return fixBowl(b.done(), 5.575, 0.42); })();
  // far LODs of the three columns (beyond ~60 m): boxes instead of cylinders, same glowing lantern
  P.lampHF = pb().color(IRON).box(0, 0, 0, 0.2, 3.95, 0.2, { taperX: 0.45, taperZ: 0.45, top: false }).color(0xfff0d0).glow(0, 3.0).box(0, 3.93, 0, 0.36, 0.42, 0.36, { taperX: 1.3, taperZ: 1.3, top: false }).noGlow().color(IRON).box(0, 4.35, 0, 0.5, 0.22, 0.5, { taperX: 0.15, taperZ: 0.15 }).done();
  P.lampSF = pb().color(GALV).box(0, 0, 0, 0.17, 7.95, 0.17, { taperX: 0.6, taperZ: 0.6, top: false }).box(0, 7.82, 0.55, 0.05, 0.06, 1.1).color(0x5a5f63).box(0, 7.85, 1.4, 0.3, 0.14, 0.7).color(0xffd9a0).glow(0, 3.4).card(0, 7.845, 1.4, 0.26, 0.6, RECT.white).done();
  P.lampRF = pb().color(0x9a9f9c).box(0, 0, 0, 0.14, 5.55, 0.14, { taperX: 0.6, taperZ: 0.6, top: false }).box(0, 5.5, 0.3, 0.04, 0.05, 0.6).color(0x50565a).box(0, 5.58, 0.75, 0.22, 0.12, 0.5).color(0xffc078).glow(0, 3.4).card(0, 5.575, 0.75, 0.2, 0.42, RECT.white).done();
  fixBowl(P.lampSF, 7.845, 0.6); fixBowl(P.lampRF, 5.575, 0.42);
  // litter bins: centre heritage (black, gold band, domed lid) and plain (dark green, tapered, flat lid). Photo comparison
  // item 9: the heritage bin read as a half-metre-thick bollard; now 0.46 m across and 0.95 m high with its dark
  // posting aperture under the lid, as the real cast-iron ones
  P.binC = pb().color(IRON).cyl(0, 0, 0, 0.18, 0.2, 0.66, 8, { top: false }).color(GOLD).cyl(0, 0.46, 0, 0.203, 0.203, 0.05, 8, { top: false })
    .color(0x020202).cyl(0, 0.66, 0, 0.16, 0.16, 0.14, 8, { top: false }).color(IRON).cyl(0, 0.8, 0, 0.21, 0.21, 0.04, 8, { top: false }).color(GOLD).cyl(0, 0.84, 0, 0.212, 0.212, 0.02, 8, { top: false })
    .color(IRON).cyl(0, 0.86, 0, 0.21, 0.07, 0.08, 8).done();
  P.binP = pb().color(0x22382a).cyl(0, 0, 0, 0.22, 0.26, 0.86, 8, { top: false }).color(0x1b2c22).cyl(0, 0.86, 0, 0.28, 0.27, 0.06, 8).color(0x0d0d0d).box(0, 0.62, 0.25, 0.22, 0.12, 0.04).done();
  // pillar box (plain, no cypher)
  // (photo comparison item 9: a little slimmer and lower, 1.45 m to the top of the cap and 0.46 m across the body)
  P.postBox = pb().color(IRON).cyl(0, 0, 0, 0.25, 0.24, 0.08, 8, { top: false }).color(RED).cyl(0, 0.08, 0, 0.23, 0.23, 1.14, 8, { top: false }).cyl(0, 1.22, 0, 0.27, 0.27, 0.08, 8, { top: false }).cyl(0, 1.3, 0, 0.26, 0.05, 0.15, 8)
    .color(0x111111).box(0, 1.04, 0.215, 0.22, 0.03, 0.04).color(0xf2f2ee).box(0, 0.75, 0.22, 0.15, 0.11, 0.02).done();
  // cast-iron bollard
  // (photo comparison item 9: 0.95 m high, 0.17 m across at the foot)
  P.bollard = pb().color(IRON).cyl(0, 0, 0, 0.085, 0.07, 0.86, 6, { top: false }).color(GOLD).cyl(0, 0.7, 0, 0.078, 0.078, 0.04, 6, { top: false }).color(IRON).cyl(0, 0.86, 0, 0.08, 0.025, 0.09, 6).done();
  // pedestrian crossing signal: pole, traffic head looking along the road (+x, green lit), push-button box, red man
  // looking across the road (+z) and green man the other way
  P.pedSig = (() => { const b = pb().color(0x2a2c2e);
    b.cyl(0, 0, 0, 0.065, 0.065, 3.0, 6, { top: true });
    b.color(0x101010).box(0.14, 1.95, 0, 0.22, 0.92, 0.3);
    b.color(0x3a0808).card(0.252, 2.52, 0, 0.17, 0.17, RECT.white, { ry: Math.PI / 2 }).color(0x4a3206).card(0.252, 2.25, 0, 0.17, 0.17, RECT.white, { ry: Math.PI / 2 });
    b.color(0x1ec850).glow(-3, 2.4).card(0.252, 1.98, 0, 0.17, 0.17, RECT.white, { ry: Math.PI / 2 });
    b.noGlow().color(0xd8c41a).box(0, 1.0, 0.09, 0.15, 0.24, 0.1);
    b.color(0x101010).box(0, 2.95, 0, 0.3, 0.32, 0.26);
    b.color(0xffffff).glow(-3, 1.3).card(0, 2.99, 0.135, 0.22, 0.22, RECT.pedRed);
    // (the back of the head carried a green man that was always lit. With working crossings — systems/crossings.js,
    // ?crossings=0 / GTO_CROSSINGS=0 off — the man you watch is the one across the road, red until the traffic is held,
    // and the back of the housing is blank)
    if (!CROSSINGS_ON) b.card(0, 2.99, -0.135, 0.22, 0.22, RECT.pedGreen, { ry: Math.PI });
    return b.done(); })();
  // road signs on a grey post, face looking along +z
  const sign = (rect, w, h, y) => pb().color(0x7c8186).box(0, 0, 0, 0.065, y + h, 0.065).color(0xffffff).card(0, y, 0.04, w, h, rect, { back: 'white', backCol: 0x9aa0a4 }).done();
  P.noEntry = sign(RECT.noEntry, 0.6, 0.6, 2.0); P.oneWay = sign(RECT.oneWay, 0.75, 0.75, 2.1); P.limit20 = sign(RECT.limit20, 0.45, 0.45, 2.1);
  P.cycle = sign(RECT.cycle, 0.45, 0.45, 2.1); P.pay = sign(RECT.pay, 0.42, 0.42, 1.9); P.permit = sign(RECT.permit, 0.38, 0.38, 1.9);
  // street cabinet (plain green, no operator marks), grit bin, pay-and-display machine
  P.cabinet = pb().color(0x2d4a35).box(0, 0, 0, 1.15, 1.18, 0.42).color(0x24392b).box(0, 1.18, 0, 1.2, 0.05, 0.46).done();
  P.grit = pb().color(0xd9a713).box(0, 0, 0, 0.8, 0.62, 0.55, { taperZ: 0.92 }).color(0xc29510).box(0, 0.62, 0, 0.84, 0.1, 0.6, { taperZ: 0.7 }).done();
  P.payMachine = pb().color(0x2b2f36).box(0, 0, 0, 0.12, 0.9, 0.12).color(0x1f3d78).box(0, 0.9, 0, 0.42, 0.85, 0.3).color(0xe0c020).box(0, 1.32, 0.15, 0.3, 0.12, 0.02).color(0x111111).box(0, 1.5, 0.15, 0.2, 0.14, 0.02).done();
  // A-board (six wordings): two chalkboards leaning together under a timber top
  P.aboard = ABOARD_TEXT.map((_, i) => { const r = RECT['ab' + i], b = pb().color(0xffffff);
    b.slab(0.6, 0, 0.21, 0.9, 0.03, r).slab(0.6, 0, -0.21, 0.9, -0.03, r);
    b.color(0x5a3c22).slab(0.6, 0, 0.205, 0.9, 0.025, RECT.white, true).slab(0.6, 0, -0.205, 0.9, -0.025, RECT.white, true);
    return b.color(0x6b4a2b).box(0, 0.9, 0, 0.62, 0.04, 0.09).done(); });
  // hanging basket on a wall bracket (origin on the wall at the bracket's height, +z out of the wall)
  P.basket = (() => { const b = pb().color(IRON).rod([0, 0.15, 0], [0, 0.15, 0.55], 0.02).rod([0, -0.25, 0], [0, 0.15, 0.45], 0.015).rod([0, 0.15, 0.5], [0, -0.3, 0.5], 0.008);
    b.color(0x3a2a1a).cyl(0, -0.55, 0.5, 0.1, 0.24, 0.24, 6, { top: false });
    b.color(0xffffff).card(0, -0.78, 0.5, 0.64, 0.5, RECT.basket, { back: 'same' }).card(0, -0.78, 0.5, 0.64, 0.5, RECT.basket, { back: 'same', ry: Math.PI / 2 });
    return b.done(); })();
  // wheelie bins (green general waste, blue recycling; plain), food caddy, black recycling box
  const wheelie = (col) => pb().color(col).box(0, 0.06, 0, 0.58, 0.96, 0.7, { taperX: 1.05, taperZ: 1.08 }).color(col, 0.8).box(0, 1.02, -0.02, 0.62, 0.05, 0.78).color(0x111111).box(-0.25, 0, -0.3, 0.06, 0.2, 0.2).box(0.25, 0, -0.3, 0.06, 0.2, 0.2).color(col, 0.7).box(0, 0.92, -0.37, 0.5, 0.06, 0.06).done();
  P.wheelieG = wheelie(0x2c5a34); P.wheelieB = wheelie(0x245a9a);
  P.caddy = pb().color(0x6a6f72).box(0, 0, 0, 0.3, 0.32, 0.28).color(0x5a5f62).box(0, 0.32, 0, 0.32, 0.04, 0.3).done();
  P.recBox = pb().color(0x18191a).box(0, 0, 0, 0.6, 0.36, 0.42).color(0x8a8f6a).box(0, 0.3, 0, 0.52, 0.04, 0.36).done();
  // traffic cone
  P.cone = pb().color(0x1a1a1a).box(0, 0, 0, 0.38, 0.03, 0.38).color(0xf05a14).cyl(0, 0.03, 0, 0.14, 0.025, 0.68, 6).color(0xf2f2f2).cyl(0, 0.36, 0, 0.092, 0.077, 0.12, 6, { top: false }).done();
  // estate agent's board on a post; the board stands out over the front wall towards the street (+z), read along it
  P.agent = [0, 1, 2, 3].map((i) => pb().color(0xe8e4dc).box(0, 0, 0, 0.07, 2.7, 0.07).box(0, 2.45, 0.28, 0.05, 0.05, 0.56).color(0xffffff).card(0, 1.86, 0.5, 0.7, 0.52, RECT['ea' + i], { back: RECT['ea' + i], ry: Math.PI / 2 }).done());
  // bicycle: two spoked wheels (alpha cards) and a frame of rods along local +x; frame colour = the item tint
  P.bike = (() => { const b = pb().color(0xffffff);
    for (const x of [-0.52, 0.52]) b.card(x, 0, 0, 0.68, 0.68, RECT.wheel, { back: 'same' });
    const R = (a, c) => b.rod(a, c, 0.018);
    R([-0.52, 0.34, 0], [-0.05, 0.36, 0]); R([-0.05, 0.36, 0], [-0.15, 0.78, 0]); R([-0.15, 0.78, 0], [0.4, 0.78, 0]); R([-0.05, 0.36, 0], [0.4, 0.78, 0]); R([0.4, 0.78, 0], [0.52, 0.34, 0]); R([-0.52, 0.34, 0], [-0.15, 0.78, 0]);
    b.color(0x161616); R([-0.15, 0.78, 0], [-0.17, 0.9, 0]); b.box(-0.17, 0.9, 0, 0.22, 0.04, 0.08); R([0.4, 0.78, 0], [0.38, 1.0, 0]); R([0.38, 1.0, -0.26], [0.38, 1.0, 0.26]);
    return b.done(); })();
  // steel-and-timber bench for the shopping streets (sitter faces +z)
  P.bench = pb().color(0x6e5136).box(0, 0.42, 0, 1.7, 0.05, 0.42).box(0, 0.6, -0.22, 1.7, 0.3, 0.04).color(0x2a2c2e).box(-0.72, 0, 0, 0.06, 0.44, 0.44).box(0.72, 0, 0, 0.06, 0.44, 0.44).box(-0.72, 0.44, -0.22, 0.06, 0.5, 0.05).box(0.72, 0.44, -0.22, 0.06, 0.5, 0.05).done();
  // grass: two crossed cards wound both ways with up normals (lit like the ground), sway weight at the tips
  const tuft = (rect, w, h) => { const b = pb().color(0xffffff); for (const a of [0.3, 0.3 + Math.PI / 2]) b.card(0, 0, 0, w, h, rect, { back: 'same', ry: a, wind: true, normalUp: true }); return b.done(); };
  P.gShort = tuft(RECT.gShort, 0.55, 0.15); P.gLong = tuft(RECT.gLong, 0.62, 0.32); P.gFlower = tuft(RECT.gFlower, 0.55, 0.24); P.gClover = tuft(RECT.gClover, 0.55, 0.13);
  return P;
}
