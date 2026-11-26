// Museums: shared kit — materials and canvas textures (one set per game, shared by all three museums), a text-label
// atlas, a painted case-contents atlas, generic pieces (display cases, statues on plinths, plaques), and a local frame
// helper for buildings that do not sit on the world axes. Geometry goes through the Geo collector of _randolph_kit.js
// (one mesh per material key).
import * as THREE from 'three';
import { repaintable, repaint, isReleased } from '../world/_tex_keep.js';
import { Geo, canvas, canvasTexture } from './_randolph_kit.js';
import { srng } from './_mus_logic.js';
import { lathe, ball, tube, mottle } from './_mus_fine.js';

export { Geo };

/** a local frame: origin (ox, oz) on the ground, rotation th (a heading: local +z points along heading th) */
export function frame(ox, oz, th) {
  const c = Math.cos(th), s = Math.sin(th);
  return {
    ox, oz, th,
    /** local (x, z) -> world [x, z] */
    w: (x, z) => [ox + x * c + z * s, oz - x * s + z * c],
    /** world -> local [x, z] */
    l: (X, Z) => { const dx = X - ox, dz = Z - oz; return [dx * c - dz * s, dx * s + dz * c]; },
    /** a local heading -> world heading */
    h: (hl) => hl + th,
    matrix: () => new THREE.Matrix4().makeRotationY(th).setPosition(ox, 0, oz),
  };
}

// ------------------------------------------------------------------------------------------------ textures
function ashlarCanvas(base = [214, 196, 160], courses = 0.36, block = 0.75, size = 2, jitter = 14, seed = 7) {
  const P = 256, { canvas: c, g } = canvas(P, P), k = P / size, r = srng(seed);
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, P, P);
  for (let y = 0, row = 0; y < size - 1e-6; y += courses, row++) {
    const off = (row % 2) * block * 0.5;
    for (let x = -off; x < size; x += block) {
      const d = (r() - 0.5) * jitter;
      g.fillStyle = `rgb(${base.map((v) => Math.max(0, Math.min(255, v + d))).join(',')})`;
      g.fillRect(x * k + 1, y * k + 1, block * k - 2, courses * k - 2);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 900; i++) g.fillRect(r() * P, r() * P, 1.5, 1.5);
  mottle(g, 0, 0, P, P, r, 260, 0.045, 16);
  // weathering under each bed joint and a light arris above it
  for (let y = 0; y < size - 1e-6; y += courses) { g.fillStyle = 'rgba(60,40,20,0.10)'; g.fillRect(0, y * k, P, 2.5); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, y * k + 2.5, P, 1.5); }
  return c;
}
/** buff Oxford brickwork, 1.2 m square tile: stretcher courses, a little colour variation, lime joints */
function brickCanvas() {
  const P = 256, { canvas: c, g } = canvas(P, P), r = srng(19), rows = 16, bh = P / rows, bw = P / 5;
  g.fillStyle = '#b9a88a'; g.fillRect(0, 0, P, P);
  for (let j = 0; j < rows; j++) for (let i = -1; i < 6; i++) {
    const d = (r() - 0.5) * 26, w = r();
    g.fillStyle = w < 0.08 ? `rgb(${196 + d},${150 + d},${118 + d})` : `rgb(${222 + d},${200 + d},${156 + d})`;
    g.fillRect(i * bw + (j % 2) * bw * 0.5 + 1, j * bh + 1, bw - 2, bh - 2);
  }
  mottle(g, 0, 0, P, P, r, 200, 0.05, 10);
  return c;
}
/** polished decorative stones, 4 columns (granite, veined marble, serpentine, shelly limestone), tiles vertically */
function marbleCanvas() {
  const W = 256, H = 512, { canvas: c, g } = canvas(W * 4, H), r = srng(23);
  const wrap = (fn) => { for (const dy of [-H, 0, H]) { g.save(); g.translate(0, dy); fn(); g.restore(); } };
  for (let k = 0; k < 4; k++) {
    g.save(); g.beginPath(); g.rect(k * W, 0, W, H); g.clip(); g.translate(k * W, 0);
    g.fillStyle = ['#d8d4d0', '#e4e0da', '#cfd2cc', '#dcd6ca'][k]; g.fillRect(0, 0, W, H);
    if (k === 0) { for (let i = 0; i < 5200; i++) { const v = r(); g.fillStyle = v < 0.45 ? `rgba(40,36,34,${0.25 + r() * 0.5})` : v < 0.8 ? `rgba(255,250,244,${0.3 + r() * 0.5})` : `rgba(190,150,130,${0.3 + r() * 0.4})`; const x = r() * W, y = r() * H, q = 1 + r() * 3.4; g.fillRect(x, y, q, q * (0.6 + r() * 0.8)); } }
    else if (k === 1) { mottle(g, 0, 0, W, H, r, 160, 0.09, 30); for (let i = 0; i < 26; i++) { const x0 = r() * W, y0 = r() * H, dark = r() < 0.4; g.strokeStyle = dark ? `rgba(60,56,60,${0.2 + r() * 0.3})` : `rgba(255,255,255,${0.4 + r() * 0.5})`; g.lineWidth = 0.6 + r() * 2.6; const pts = []; let x = x0, y = y0; for (let j = 0; j < 9; j++) { pts.push([x, y]); x += (r() - 0.5) * 60; y += 20 + r() * 50; } wrap(() => { g.beginPath(); pts.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }); } }
    else if (k === 2) { for (let i = 0; i < 240; i++) { const x = r() * W, y = r() * H, q = 8 + r() * 26, a = r() * 3, e = 0.4 + r() * 0.6; g.fillStyle = r() < 0.55 ? `rgba(30,40,34,${0.12 + r() * 0.3})` : `rgba(240,236,220,${0.1 + r() * 0.25})`; wrap(() => { g.beginPath(); g.ellipse(x, y, q, q * e, a, 0, 6.3); g.fill(); }); } for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(250,246,236,${0.3 + r() * 0.4})`; g.lineWidth = 0.5 + r() * 1.4; const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 90, y + (r() - 0.5) * 90); g.stroke(); } }
    else { mottle(g, 0, 0, W, H, r, 120, 0.07, 26); for (let i = 0; i < 300; i++) { const x = r() * W, y = r() * H, q = 2 + r() * 7; g.strokeStyle = `rgba(${r() < 0.5 ? '255,252,244' : '90,80,66'},${0.25 + r() * 0.4})`; g.lineWidth = 1 + r(); g.beginPath(); g.arc(x, y, q, r() * 6, r() * 6 + 1.5 + r() * 2.5); g.stroke(); } }
    g.restore();
  }
  return c;
}
/** a little equirect "room" for reflections on polished stone, glass and iron: sky-lit roof over warm walls */
function envCanvas(top, mid, low) {
  const W = 128, H = 64, { canvas: c, g } = canvas(W, H), gr = g.createLinearGradient(0, 0, 0, H), r = srng(5);
  gr.addColorStop(0, top); gr.addColorStop(0.3, top); gr.addColorStop(0.42, mid); gr.addColorStop(0.62, mid); gr.addColorStop(0.75, low); gr.addColorStop(1, low);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(4 + i * 9 + r() * 2, 27, 2.2, 7); }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(20,24,28,0.5)'; g.fillRect(i * 22 + 6, 0, 1.6, 26); }
  return c;
}
export function envTexture(top = '#eef6ff', mid = '#c9b48e', low = '#5a4c3a') {
  const t = canvasTexture(envCanvas(top, mid, low)); t.mapping = THREE.EquirectangularReflectionMapping; return t;
}
function tileCanvas(a, b, n = 8) {
  const P = 256, { canvas: c, g } = canvas(P, P), s = P / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, P); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(P, i * s); g.stroke(); }
  return c;
}
function grainCanvas() {
  const P = 128, { canvas: c, g } = canvas(P, P), r = srng(3);
  g.fillStyle = '#fff'; g.fillRect(0, 0, P, P);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(0,0,0,${0.03 + r() * 0.07})`; g.lineWidth = 1 + r() * 2; const y = r() * P; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(P / 3, y + (r() - 0.5) * 8, (2 * P) / 3, y + (r() - 0.5) * 8, P, y); g.stroke(); }
  return c;
}

// ------------------------------------------------------------------------------------------------ case contents atlas
// 4 x 4 cells of 256 px. Each cell is the back board of a display case, seen through the glass.
export const CELL = { minerals: 0, insects: 1, birds: 2, fossils: 3, prA: 4, prB: 5, prC: 6, drawers: 7, pots: 8, egypt: 9, jewel: 10, shells: 11, tools: 12, masks: 13, heads: 14, plain: 15 };
function contentsCanvas() {
  const N = 4, P = 256, SC = 2, { canvas: c, g } = canvas(N * P * SC, N * P * SC);     // drawn in 256-px cell units at 2x
  g.scale(SC, SC);
  // a museum label in a small brown hand: a cream card (some tied on with string), two lines of illegible script
  const label = (r, x, y, w = 11, h = 6) => {
    g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.5);
    g.fillStyle = r() < 0.3 ? '#e4d6b0' : '#f1e8cf'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(52,34,20,0.85)'; g.lineWidth = 0.45;
    for (const ly of [h * 0.36, h * 0.72]) { g.beginPath(); let px = 1; g.moveTo(px, ly); while (px < w - 1.5 - r() * 3) { px += 0.7 + r() * 0.9; g.lineTo(px, ly + (r() - 0.5) * 1.6); } g.stroke(); }
    if (r() < 0.4) { g.strokeStyle = 'rgba(200,180,140,0.7)'; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(-4 - r() * 4, h / 2 - 3 + r() * 6); g.stroke(); }
    g.restore();
  };
  const cell = (i, bg, fn) => { const x0 = (i % N) * P, y0 = Math.floor(i / N) * P; g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, P, P); g.clip(); g.fillStyle = bg; g.fillRect(0, 0, P, P); fn(srng(i * 13 + 5)); g.restore(); };
  const dot = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const card = (x, y) => { g.fillStyle = '#f2ead6'; g.fillRect(x, y, 14, 5); };
  // minerals: crystals and lumps on little card plinths
  cell(CELL.minerals, '#2c3a44', (r) => { for (let i = 0; i < 46; i++) { const x = 12 + (i % 8) * 31 + r() * 6, y = 20 + Math.floor(i / 8) * 40; const hue = [0, 30, 50, 120, 200, 260, 300][Math.floor(r() * 7)]; g.fillStyle = `hsl(${hue},${30 + r() * 60}%,${30 + r() * 45}%)`; g.beginPath(); g.moveTo(x, y + 18); g.lineTo(x + 5 + r() * 6, y + r() * 6); g.lineTo(x + 14 + r() * 6, y + 4 + r() * 8); g.lineTo(x + 20, y + 18); g.fill(); card(x + 2, y + 22); } });
  // insects: pinned in rows on pale board
  cell(CELL.insects, '#e9e2cc', (r) => { for (let y = 14; y < P; y += 26) for (let x = 10; x < P - 10; x += 20) { const col = `hsl(${r() * 360},${40 + r() * 40}%,${18 + r() * 35}%)`; g.fillStyle = col; g.beginPath(); g.ellipse(x + 6, y + 6, 3 + r() * 4, 2 + r() * 3, 0, 0, Math.PI * 2); g.fill(); if (r() < 0.5) { g.globalAlpha = 0.7; g.beginPath(); g.ellipse(x + 1, y + 4, 4, 2.5, -0.5, 0, Math.PI * 2); g.ellipse(x + 11, y + 4, 4, 2.5, 0.5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; } g.fillStyle = '#fff'; g.fillRect(x + 2, y + 16, 9, 3); } });
  // stuffed birds on perches
  cell(CELL.birds, '#b8c4b4', (r) => { for (let i = 0; i < 9; i++) { const x = 30 + (i % 3) * 80 + r() * 10, y = 50 + Math.floor(i / 3) * 80; g.fillStyle = '#5a4630'; g.fillRect(x - 18, y + 22, 36, 4); g.fillStyle = `hsl(${r() * 60},${20 + r() * 40}%,${25 + r() * 40}%)`; g.beginPath(); g.ellipse(x, y + 6, 11, 15, 0.3, 0, Math.PI * 2); g.fill(); dot(x + 7, y - 10, 6, g.fillStyle); g.fillStyle = '#d8a030'; g.beginPath(); g.moveTo(x + 12, y - 11); g.lineTo(x + 19, y - 9); g.lineTo(x + 12, y - 7); g.fill(); } });
  // fossils: ammonites, bones on sand
  cell(CELL.fossils, '#cdbb98', (r) => { for (let i = 0; i < 16; i++) { const x = 30 + (i % 4) * 62 + r() * 8, y = 34 + Math.floor(i / 4) * 62; g.strokeStyle = '#6a5a40'; g.lineWidth = 3; if (r() < 0.6) { g.beginPath(); for (let a = 0; a < 18; a += 0.3) { const rr = 2 + a * 1.2; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.stroke(); } else { g.fillStyle = '#8a7656'; g.fillRect(x - 20, y - 4, 40, 8); dot(x - 20, y, 7, '#8a7656'); dot(x + 20, y, 7, '#8a7656'); } card(x - 6, y + 22); } });
  // Pitt Rivers: crammed objects — A (mixed artefacts), B (tools and weapons-free implements: spoons, combs, pipes), C (small figures)
  const crammed = (r, n, shapes) => { for (let i = 0; i < n; i++) { const x = r() * P, y = r() * P, s = 4 + r() * 12; g.fillStyle = `hsl(${20 + r() * 40},${20 + r() * 50}%,${15 + r() * 45}%)`; shapes(x, y, s, r); } for (let i = 0; i < 54; i++) label(r, r() * (P - 12), r() * (P - 8)); for (let y = 62; y < P; y += 64) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, P, 2.5); g.fillStyle = 'rgba(120,90,60,0.5)'; g.fillRect(0, y - 1.5, P, 1.5); } };
  cell(CELL.prA, '#3a2e22', (r) => crammed(r, 240, (x, y, s, rr) => { if (rr() < 0.5) { g.beginPath(); g.ellipse(x, y, s * 0.6, s, 0, 0, Math.PI * 2); g.fill(); } else g.fillRect(x, y, s * 0.4, s * 2); }));
  cell(CELL.prB, '#2e2a24', (r) => crammed(r, 200, (x, y, s, rr) => { g.save(); g.translate(x, y); g.rotate(rr() * 3); g.fillRect(-s, -1.5, s * 2, 3); g.beginPath(); g.ellipse(s, 0, 3, 2, 0, 0, 7); g.fill(); g.restore(); }));
  cell(CELL.prC, '#352a20', (r) => crammed(r, 160, (x, y, s) => { g.beginPath(); g.ellipse(x, y - s * 0.9, s * 0.35, s * 0.35, 0, 0, 7); g.fill(); g.fillRect(x - s * 0.3, y - s * 0.6, s * 0.6, s * 1.4); }));
  // drawer fronts: rows of small wooden drawers with brass pulls and labels
  cell(CELL.drawers, '#3a2618', (r) => { for (let y = 0; y < P; y += 32) for (let x = 0; x < P; x += 64) { g.fillStyle = `rgb(${70 + r() * 15},${44 + r() * 10},${26 + r() * 8})`; g.fillRect(x + 2, y + 2, 60, 28); g.fillStyle = '#e8dcc0'; g.fillRect(x + 22, y + 7, 20, 6); dot(x + 32, y + 21, 3, '#c8a050'); } });
  // Greek pots on shelves (silhouettes: black-figure / red-figure)
  cell(CELL.pots, '#e4ddd0', (r) => { for (let s = 0; s < 3; s++) { const y = 80 + s * 82; g.fillStyle = '#9a8e7a'; g.fillRect(0, y, P, 4); for (let x = 18; x < P - 10; x += 34 + r() * 10) { const h = 30 + r() * 34, w = 12 + r() * 10, red = r() < 0.5; g.fillStyle = red ? '#b4542a' : '#1a1410'; g.beginPath(); g.moveTo(x - w * 0.3, y); g.quadraticCurveTo(x - w, y - h * 0.5, x - w * 0.35, y - h); g.lineTo(x + w * 0.35, y - h); g.quadraticCurveTo(x + w, y - h * 0.5, x + w * 0.3, y); g.fill(); g.fillStyle = red ? '#1a1410' : '#b4542a'; g.fillRect(x - w * 0.5, y - h * 0.55, w, 3); } } });
  // Egyptian small finds: scarabs, shabtis, amulets on sand-coloured board
  cell(CELL.egypt, '#d6c49a', (r) => { for (let i = 0; i < 40; i++) { const x = 16 + (i % 8) * 30, y = 24 + Math.floor(i / 8) * 48; g.fillStyle = r() < 0.5 ? '#3a8a8a' : '#6a5a3a'; if (r() < 0.5) { g.beginPath(); g.ellipse(x, y, 7, 9, 0, 0, 7); g.fill(); } else { g.fillRect(x - 4, y - 14, 8, 26); dot(x, y - 16, 5, g.fillStyle); } card(x - 7, y + 16); } });
  // dark velvet backdrop with a small gold glint (the jewel case)
  cell(CELL.jewel, '#141428', (r) => { const gr = g.createRadialGradient(128, 128, 4, 128, 128, 120); gr.addColorStop(0, '#2a2a50'); gr.addColorStop(1, '#0c0c18'); g.fillStyle = gr; g.fillRect(0, 0, P, P); g.fillStyle = '#f0e8d0'; g.fillRect(96, 214, 64, 10); });
  // shells
  cell(CELL.shells, '#d8d2c0', (r) => { for (let i = 0; i < 30; i++) { const x = 20 + (i % 6) * 40 + r() * 6, y = 26 + Math.floor(i / 6) * 48; g.fillStyle = `hsl(${10 + r() * 40},${30 + r() * 40}%,${50 + r() * 30}%)`; g.beginPath(); g.moveTo(x, y + 12); for (let a = 0; a <= 1; a += 0.1) g.lineTo(x + Math.cos(Math.PI * (1 + a)) * 14, y + 12 + Math.sin(Math.PI * (1 + a)) * 16); g.fill(); } });
  // tools (Pitt Rivers typological rows: keys, locks, spoons, lamps)
  cell(CELL.tools, '#2a241c', (r) => { for (let y = 20; y < P; y += 36) for (let x = 10; x < P - 10; x += 22) { g.fillStyle = `hsl(${30 + r() * 20},${10 + r() * 30}%,${30 + r() * 40}%)`; g.fillRect(x, y, 4, 22); g.beginPath(); g.ellipse(x + 2, y, 6, 5, 0, 0, 7); g.fill(); if (r() < 0.6) label(r, x - 3, y + 24, 10, 5); } });
  // masks
  cell(CELL.masks, '#30261c', (r) => { for (let i = 0; i < 9; i++) { const x = 44 + (i % 3) * 84, y = 46 + Math.floor(i / 3) * 84; g.fillStyle = `hsl(${r() * 40},${30 + r() * 40}%,${25 + r() * 35}%)`; g.beginPath(); g.ellipse(x, y, 24, 32, 0, 0, 7); g.fill(); g.fillStyle = '#120c08'; g.beginPath(); g.ellipse(x - 9, y - 6, 5, 3, 0, 0, 7); g.ellipse(x + 9, y - 6, 5, 3, 0, 0, 7); g.ellipse(x, y + 14, 8, 3, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(230,210,170,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y - 2, 19, 3.6, 5.8); g.stroke(); label(r, x - 7, y + 33, 14, 6); } });
  // the "Treatment of Dead Enemies" case: nothing gruesome — the backs of the crowd hide it; small dark shapes + label cards
  cell(CELL.heads, '#2a2018', (r) => { for (let i = 0; i < 24; i++) { g.fillStyle = '#f0e6cc'; g.fillRect(14 + (i % 6) * 40, 40 + Math.floor(i / 6) * 56, 22, 6); } g.fillStyle = '#3a2c20'; for (let i = 0; i < 10; i++) g.fillRect(20 + (i % 5) * 48, 70 + Math.floor(i / 5) * 90, 20, 20); });
  cell(CELL.plain, '#efe9dc', () => {});
  return c;
}
/** uv rect of a contents cell [u0, v0, u1, v1] (v up) */
export function cellUV(i, inset = 0.004) { const N = 4, x = i % N, y = Math.floor(i / N); return [x / N + inset, 1 - (y + 1) / N + inset, (x + 1) / N - inset, 1 - y / N - inset]; }

// ------------------------------------------------------------------------------------------------ label atlas
/** text labels and plaques painted into one canvas; add() returns a uv rect; texture() bakes it */
export class Labels {
  constructor(rows = 32, W = 1024, H = 1024) { this.rows = rows; this.W = W; this.H = H; this.n = 0; const { canvas: c, g } = canvas(W, H); this.c = c; this.g = g; this.tex = null; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); this.ops = []; this.dirty = false; }
  /** the whole sheet painted again on a new canvas, from the rows as they were added (memory pass: world/_tex_keep.js) */
  _repaint() { const { canvas: c, g } = canvas(this.W, this.H); g.fillStyle = '#000'; g.fillRect(0, 0, this.W, this.H); for (const o of this.ops) this._row(g, o[0], o[1], o[2]); return c; }
  /** one row of the atlas (width W, height H/rows): text centred; opts {bg, fg, font, border, sub} -> uv rect [u0,v0,u1,v1] */
  add(text, o = {}) {
    const i = this.n++ % this.rows, rh = this.H / this.rows, y0 = i * rh;
    this.ops.push([i, text, o]); this.dirty = true;
    if (!(this.tex && isReleased(this.tex))) this._row(this.g, i, text, o);
    return [0, 1 - (y0 + rh) / this.H + 0.001, 1, 1 - y0 / this.H - 0.001];
  }
  _row(g, i, text, o) {
    const rh = this.H / this.rows, y0 = i * rh, W = this.W;
    g.fillStyle = o.bg || '#f1ead8'; g.fillRect(0, y0, W, rh);
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = 4; g.strokeRect(3, y0 + 3, W - 6, rh - 6); }
    g.fillStyle = o.fg || '#222'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = o.size || rh * (o.sub ? 0.42 : 0.62);
    g.font = `${o.bold === false ? '' : 'bold '}${fs}px ${o.font || 'Georgia, serif'}`;
    g.fillText(text, W / 2, y0 + rh * (o.sub ? 0.36 : 0.53), W - 20);
    if (o.sub) { g.font = `${rh * 0.26}px ${o.font || 'Georgia, serif'}`; g.fillText(o.sub, W / 2, y0 + rh * 0.74, W - 20); }
  }
  texture() {
    if (!this.tex) { this.tex = canvasTexture(this.c); repaintable(this.tex, () => this._repaint(), 'museum labels'); }
    else if (this.dirty) { if (isReleased(this.tex)) repaint(this.tex); else this.tex.needsUpdate = true; }
    this.dirty = false; return this.tex;
  }
}

// ------------------------------------------------------------------------------------------------ materials
let _mats = null;
/** shared museum materials (lazily created once; interiors and exteriors use the same objects) */
export function museumMats() {
  if (_mats) return _mats;
  const T = (c, rep = 1) => { const t = canvasTexture(c, { repeat: true }); t.repeat.set(rep, rep); return t; };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
  const M = {};
  M.stone = std({ map: T(ashlarCanvas(), 0.5), vertexColors: true, roughness: 0.88, name: 'mus-stone' });     // uv in metres; texture = 2 m
  M.env = envTexture();
  M.brick = std({ map: T(brickCanvas(), 1), vertexColors: true, roughness: 0.9, name: 'mus-brick' });          // uv in tiles of 1.2 m
  M.marble = std({ map: T(marbleCanvas(), 1), vertexColors: true, roughness: 0.16, envMap: M.env, envMapIntensity: 0.9, name: 'mus-marble' });
  M.carve = std({ vertexColors: true, roughness: 0.82, name: 'mus-carve' });                                    // carved/plaster work: smooth-shaded, untextured
  M.paint = std({ vertexColors: true, roughness: 0.65, name: 'mus-paint' });
  M.iron = std({ vertexColors: true, roughness: 0.45, metalness: 0.55, name: 'mus-iron' });
  M.wood = std({ map: T(grainCanvas(), 0.8), vertexColors: true, roughness: 0.5, name: 'mus-wood' });
  M.floorNhm = std({ map: T(tileCanvas('#c9b48c', '#9a7a5a', 8), 0.25), roughness: 0.75, name: 'mus-floor-nhm' });
  M.floorPale = std({ map: T(ashlarCanvas([226, 220, 206], 0.6, 0.6, 2, 8, 11), 0.5), roughness: 0.6, name: 'mus-floor-pale' });
  M.floorDark = std({ map: T(grainCanvas(), 0.5), color: 0x4a3626, roughness: 0.7, name: 'mus-floor-dark' });
  M.glass = new THREE.MeshStandardMaterial({ color: 0xcfe2e6, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide, name: 'mus-glass' });
  M.glassRoof = std({ color: 0xa8c4cc, roughness: 0.15, metalness: 0.4, emissive: 0x9ab8c8, emissiveIntensity: 0.35, side: THREE.DoubleSide, name: 'mus-glass-roof' });
  M.glass.envMap = M.env; M.glass.envMapIntensity = 2.4; M.glass.opacity = 0.18;
  M.floorPale.envMap = M.env; M.floorPale.envMapIntensity = 0.28; M.floorPale.roughness = 0.4;
  M.contents = std({ map: canvasTexture(contentsCanvas), roughness: 0.85, name: 'mus-contents' });
  M.glow = new THREE.MeshBasicMaterial({ vertexColors: true, name: 'mus-glow', toneMapped: false });
  return (_mats = M);
}

/** build a Geo into meshes under `parent`, with the museum materials (+ extra), no shadows indoors unless asked */
export function buildGeo(G, parent, extra = {}, opts = {}) {
  const mats = { ...museumMats(), ...extra };
  return G.build(mats, parent, { cast: false, receive: false, ...opts });
}

// ------------------------------------------------------------------------------------------------ pieces
/**
 * A glass display case standing on the floor, local frame (cx, cz, rot): w wide (x), d deep (z), body (wooden base)
 * to `base` m, glass to `h`; `cell` = contents painted on the back board and the floor of the case; `kind` 'table'
 * (glass top, flat contents board) or 'wall' (tall, back board). Returns the footprint [cx, cz, w, d, rot] for colliders.
 */
export function displayCase(G, cx, cz, rot, { w = 2, d = 0.8, h = 2, base = 0.8, cell = CELL.minerals, kind = 'wall', wood = 0x4a3020, y = 0, frameCol = null } = {}) {
  G.at(cx, y, cz, rot);
  G.color(wood); G.box('wood', -w / 2, 0, -d / 2, w / 2, base, d / 2);
  const uv = cellUV(cell);
  if (kind === 'table') {
    G.quadUV('contents', [-w / 2 + 0.05, base + 0.01, d / 2 - 0.05], [w / 2 - 0.05, base + 0.01, d / 2 - 0.05], [w / 2 - 0.05, base + 0.01, -d / 2 + 0.05], [-w / 2 + 0.05, base + 0.01, -d / 2 + 0.05], uv);
    G.box('glass', -w / 2, base, -d / 2, w / 2, h, d / 2, { bottom: false });
  } else {
    G.quadUV('contents', [-w / 2 + 0.04, base, -d / 2 + 0.05], [w / 2 - 0.04, base, -d / 2 + 0.05], [w / 2 - 0.04, h - 0.1, -d / 2 + 0.05], [-w / 2 + 0.04, h - 0.1, -d / 2 + 0.05], uv);
    G.color(wood); G.box('wood', -w / 2, base, -d / 2, w / 2, h, -d / 2 + 0.04);
    G.box('glass', -w / 2, base, -d / 2 + 0.04, w / 2, h, d / 2, { bottom: false });
    // frame posts + cornice
    G.color(frameCol || wood);
    for (const sx of [-1, 1]) G.box('wood', sx * w / 2 - 0.03, base, d / 2 - 0.05, sx * w / 2 + 0.03, h, d / 2 + 0.01);
    G.box('wood', -w / 2 - 0.03, h, -d / 2 - 0.02, w / 2 + 0.03, h + 0.12, d / 2 + 0.03);
  }
  G.pop();
  return [cx, cz, w, d, rot];
}

/**
 * A stone figure on a plinth, facing local +z of (x, z, rot); about 1.8 m tall on its plinth. Robed (a gown in folds,
 * a mantle over one shoulder, a book, scroll or globe in hand), seated, or — robe: false — an undraped classical
 * figure standing with the weight on one leg. `seed` varies pose and build. Smooth-shaded ('carve' key).
 */
export function statue(G, x, z, rot, { col = 0xe8e2d6, plinthCol = 0x8a8a84, h = 1.8, plinth = 1.0, seated = false, y = 0, robe = true, seed = null, key = 'carve' } = {}) {
  const sd = seed === null ? Math.abs(Math.round(x * 7.3 + z * 13.7)) : seed, r = srng(sd * 3 + 11), p = plinth, s = h / 1.8;
  G.at(x, y, z, rot);
  G.color(plinthCol);
  G.box('stone', -0.5, 0, -0.5, 0.5, 0.12, 0.5); G.box('stone', -0.44, 0.12, -0.44, 0.44, p - 0.1, 0.44); G.box('stone', -0.49, p - 0.1, -0.49, 0.49, p, 0.49);
  G.color(col);
  const lean = (r() - 0.5) * 0.08, folds = 5 + Math.floor(r() * 4), ph = r() * 6, turn = (r() - 0.5) * 0.5;
  const sh = (a, i) => 0.86 + 0.14 * Math.sin(a * folds + ph) * (i < 5 ? 1 : 0.3);            // darker in the folds
  const head = (hx, hy, hz, beard) => {
    ball(G, key, hx, hy, hz, 0.105 * s, 0.13 * s, 0.115 * s, 8, 5);
    ball(G, key, hx, hy + 0.035 * s, hz - 0.03 * s, 0.115 * s, 0.12 * s, 0.115 * s, 8, 4);     // hair
    G.box(key, hx - 0.012 * s, hy - 0.03 * s, hz + 0.1 * s, hx + 0.012 * s, hy + 0.03 * s, hz + 0.135 * s);   // nose
    if (beard) ball(G, key, hx, hy - 0.11 * s, hz + 0.055 * s, 0.075 * s, 0.1 * s, 0.06 * s, 6, 4);
    lathe(G, key, hx, hy - 0.2 * s, hz - 0.01 * s, [[0.06 * s, 0], [0.05 * s, 0.1 * s]], 6);
  };
  if (seated) {
    G.color(plinthCol); G.box('stone', -0.36, p, -0.36, 0.36, p + 0.48, 0.12); G.box('stone', -0.36, p + 0.48, -0.36, 0.36, p + 1.15, -0.26);
    G.color(col);
    // lap and legs under drapery, torso, arms on the knees
    lathe(G, key, 0, p, 0.22, [[0.34, 0], [0.3, 0.3], [0.27, 0.5], [0.2, 0.56]], 10, { sz: 0.75, mod: (a) => 1 + 0.07 * Math.sin(a * folds + ph), shade: sh });
    for (const sx of [-1, 1]) tube(G, key, [[sx * 0.13, p + 0.56, -0.12], [sx * 0.15, p + 0.58, 0.2], [sx * 0.16, p + 0.5, 0.42]], 0.105, 6);
    lathe(G, key, 0, p + 0.5, -0.1, [[0.22, 0], [0.2, 0.2], [0.24, 0.48], [0.22, 0.62], [0.1, 0.72]], 10, { sz: 0.7, shade: sh });
    for (const sx of [-1, 1]) tube(G, key, [[sx * 0.24, p + 1.12, -0.1], [sx * 0.29, p + 0.82, -0.02], [sx * 0.2, p + 0.68, 0.26]], (t) => 0.06 - t * 0.015, 5);
    G.box(key, -0.16, p + 0.62, 0.2, 0.16, p + 0.67, 0.42);                                       // a book open on the knees
    head(0, p + 1.42, -0.07, r() < 0.6);
  } else if (robe) {
    const yy = (v) => p + v * s;
    lathe(G, key, lean, p, 0, [[0.3 * s, 0], [0.29 * s, 0.05 * s], [0.24 * s, 0.5 * s], [0.2 * s, 0.95 * s], [0.215 * s, 1.1 * s], [0.235 * s, 1.3 * s], [0.2 * s, 1.43 * s], [0.08 * s, 1.5 * s]], 12,
      { sz: 0.72, mod: (a, i) => 1 + (i < 4 ? 0.09 : 0.03) * Math.sin(a * folds + ph), shade: sh });
    // a mantle hanging from the left shoulder across the back
    lathe(G, key, lean, yy(0.55), -0.02 * s, [[0.27 * s, 0], [0.26 * s, 0.4 * s], [0.25 * s, 0.82 * s], [0.12 * s, 0.93 * s]], 8, { sz: 0.78, a0: 1.9 + turn, a1: 5.6 + turn, mod: (a) => 1 + 0.05 * Math.sin(a * 9 + ph), shade: (a) => 0.9 + 0.1 * Math.sin(a * 9 + ph) });
    const pose = Math.floor(r() * 3);
    const arm = (sx, pts) => tube(G, key, pts.map((q) => [lean + sx * q[0] * s, yy(q[1]), q[2] * s]), (t) => (0.062 - t * 0.02) * s, 6);
    if (pose === 0) {   // a book held to the chest, the other hand gathering the robe
      arm(1, [[0.23, 1.4, 0], [0.28, 1.12, 0.03], [0.1, 1.16, 0.2]]); arm(-1, [[0.23, 1.4, 0], [0.29, 1.1, 0.0], [0.24, 0.84, 0.12]]);
      G.box(key, lean + 0.0, yy(1.06), 0.17 * s, lean + 0.17 * s, yy(1.3), 0.23 * s);
    } else if (pose === 1) {   // one arm out, pointing or expounding; a scroll in the other hand
      arm(1, [[0.23, 1.4, 0], [0.32, 1.2, 0.14], [0.36, 1.3, 0.4]]); arm(-1, [[0.23, 1.4, 0], [0.28, 1.08, 0.02], [0.2, 0.92, 0.18]]);
      tube(G, key, [[lean - 0.2 * s, yy(0.8), 0.2 * s], [lean - 0.2 * s, yy(1.04), 0.2 * s]], 0.03 * s, 6);
    } else {   // both hands before the body round a globe or an instrument
      arm(1, [[0.23, 1.4, 0], [0.27, 1.12, 0.06], [0.08, 1.05, 0.24]]); arm(-1, [[0.23, 1.4, 0], [0.27, 1.12, 0.06], [0.08, 1.05, 0.24]]);
      ball(G, key, lean, yy(1.05), 0.27 * s, 0.085 * s, 0.085 * s, 0.085 * s, 8, 5);
    }
    head(lean * 1.5, yy(1.65), 0.01, r() < 0.65);
  } else {
    const yy = (v) => p + v * s, hip = 0.04 * (r() < 0.5 ? 1 : -1);
    // weight on one leg, the other relaxed; torso leaning back the other way
    tube(G, key, [[(0.09 + hip) * s, yy(0.9), 0], [(0.09 + hip * 0.5) * s, yy(0.48), 0.02 * s], [0.08 * s, yy(0.06), 0]], (t) => (0.085 - t * 0.04) * s, 7);
    tube(G, key, [[(-0.09 + hip) * s, yy(0.9), 0], [-0.13 * s, yy(0.5), 0.09 * s], [-0.15 * s, yy(0.06), -0.04 * s]], (t) => (0.085 - t * 0.04) * s, 7);
    for (const sx of [-1, 1]) G.box(key, (sx * 0.1 - 0.05) * s, p, -0.1 * s, (sx * 0.1 + 0.05) * s, yy(0.07), 0.14 * s);
    lathe(G, key, hip * s, yy(0.82), 0, [[0.15 * s, 0], [0.17 * s, 0.1 * s], [0.14 * s, 0.3 * s], [0.18 * s, 0.52 * s], [0.19 * s, 0.6 * s], [0.07 * s, 0.68 * s]], 10, { sz: 0.62 });
    const arm = (sx, pts) => tube(G, key, pts.map((q) => [(hip + sx * q[0]) * s, yy(q[1]), q[2] * s]), (t) => (0.05 - t * 0.015) * s, 6);
    if (r() < 0.5) { arm(1, [[0.2, 1.42, 0], [0.25, 1.14, 0.0], [0.22, 0.88, 0.06]]); arm(-1, [[0.2, 1.42, 0], [0.3, 1.2, 0.1], [0.2, 1.3, 0.3]]); }
    else { arm(1, [[0.2, 1.42, 0], [0.34, 1.5, 0.05], [0.3, 1.78, 0.06]]); arm(-1, [[0.2, 1.42, 0], [0.26, 1.14, 0.0], [0.24, 0.9, 0.05]]); }
    // a fold of drapery over the support (the tree-stump of every marble copy)
    lathe(G, key, -0.3 * s, p, -0.06 * s, [[0.11 * s, 0], [0.09 * s, 0.6 * s], [0.1 * s, 0.82 * s], [0.03 * s, 0.9 * s]], 7, { mod: (a) => 1 + 0.12 * Math.sin(a * 5) });
    head(hip * 0.5 * s, yy(1.66), 0.01, false);
  }
  G.pop();
}

/** a flat label quad (key 'labels') facing local +z at (x, y, z, rot), w x h, uv rect from a Labels atlas */
export function plaque(G, x, y, z, rot, w, h, uv, key = 'labels') {
  G.at(x, y, z, rot);
  G.quadUV(key, [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0], uv);
  G.pop();
}

/** a label material from a Labels atlas (unlit-ish, readable in dim rooms) */
export function labelMaterial(L, emissive = 0.35) {
  const t = L.texture();
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: emissive, roughness: 0.9, name: 'mus-labels' });
}

/** count draw calls / triangles of the visible meshes under obj */
export function costOf(obj) {
  let calls = 0, tris = 0;
  obj.traverse((m) => {
    if (!(m.isMesh || m.isPoints)) return;
    for (let p = m; p; p = p.parent) if (!p.visible) return;
    calls++; const g = m.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += m.isInstancedMesh ? n * m.count : n;
  });
  return { calls, tris: Math.round(tris) };
}
