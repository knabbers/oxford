// Fine-detail kit for the south-east showpieces (Tom Tower, Tom Quad, the Hall, Magdalen cloister, the Danby Gateway):
// ONE material for a whole showpiece — a 4x2 atlas of tiling detail cells (ashlar, lead, leaded glass, plain, flagstones,
// oak boards, linenfold panelling, heraldic glass) sampled with a per-vertex cell index, times a per-vertex colour, with a
// per-vertex glow (lit windows at night, lamps, daylit glass). Every cell is near-neutral so mip bleeding between cells
// is harmless; hue comes from the vertex colour. Plus the mouldings / tracery / figure helpers the showpieces share.
// Deterministic (no Math.random). Nothing here touches the DOM at import time.
import * as THREE from 'three';
import { repaintable } from '../world/_tex_keep.js';
import { Batch, hh, lathe, prism, pointedPts } from './_chch_kit.js';

export const CELL = { ashlar: 0, lead: 1, glass: 2, plain: 3, flags: 4, oak: 5, linen: 6, herald: 7 };
// metres per repeat of each cell (u, v)
const CELL_M = [[2.4, 2.4], [2.4, 2.4], [0.8, 0.8], [1, 1], [2.4, 2.4], [1.2, 1.2], [0.56, 1.12], [0.9, 1.8]];
const TILE = 480, PADPX = 16, CPX = TILE + 2 * PADPX;      // 512 px cells with wrapped margins

// ------------------------------------------------------------------------------------------------ keys
// key -> { c: cell, t: [r, g, b] tint, g: glow, m: glow mode (0 night-only warm, 1 always (albedo), 2 daylight only) }
const KEYS = new Map();
export function defKey(name, c, t, g = 0, m = 0) { KEYS.set(name, { c, t, g, m }); return name; }
const A = CELL.ashlar, P = CELL.plain;
// honey Headington / Taynton ashlar and friends
defKey('stone', A, [0.9, 0.76, 0.52]); defKey('stonePale', A, [0.99, 0.87, 0.64]); defKey('stoneWarm', A, [0.93, 0.74, 0.47]); defKey('stoneDark', A, [0.54, 0.44, 0.3]);
defKey('stoneGrey', P, [0.8, 0.76, 0.66]); defKey('stoneIn', A, [1.0, 0.93, 0.8]); defKey('stoneInDark', A, [0.7, 0.62, 0.5]);
defKey('mould', P, [0.9, 0.77, 0.53]); defKey('mouldPale', P, [1.0, 0.9, 0.69]); defKey('mouldDark', P, [0.5, 0.41, 0.28]); defKey('carve', P, [0.74, 0.6, 0.38]);
defKey('lead', CELL.lead, [0.5, 0.53, 0.57]); defKey('leadDark', CELL.lead, [0.36, 0.38, 0.42]); defKey('slate', CELL.lead, [0.3, 0.32, 0.36]);
defKey('win', CELL.glass, [0.2, 0.24, 0.3]); defKey('winLit', CELL.glass, [0.24, 0.26, 0.3], 1.5, 0); defKey('winDim', CELL.glass, [0.22, 0.25, 0.3], 0.5, 0);
defKey('shadow', P, [0.1, 0.085, 0.07]); defKey('void', P, [0.03, 0.03, 0.03]);
defKey('gilt', P, [1.1, 0.8, 0.28]); defKey('giltGlow', P, [1.1, 0.8, 0.28], 0.25, 0); defKey('iron', P, [0.08, 0.08, 0.09]); defKey('bronze', P, [0.2, 0.26, 0.2]);
defKey('whitePaint', P, [0.95, 0.94, 0.9]); defKey('blackPaint', P, [0.04, 0.04, 0.05]); defKey('dial', P, [0.05, 0.07, 0.16], 0.3, 0); defKey('dialGilt', P, [1.15, 0.85, 0.3], 1.5, 0);
defKey('stoneFine', P, [1.0, 0.93, 0.8]);
defKey('stoneLit', A, [0.9, 0.76, 0.52], 0.2, 0); defKey('stonePaleLit', A, [0.99, 0.87, 0.64], 0.2, 0);   // floodlit at night
defKey('paving', CELL.flags, [0.8, 0.76, 0.68]); defKey('flags', CELL.flags, [0.72, 0.68, 0.6]); defKey('flagsWarm', CELL.flags, [0.82, 0.74, 0.6]);
defKey('darkWood', CELL.oak, [0.36, 0.23, 0.13]); defKey('oak', CELL.oak, [0.56, 0.38, 0.2]); defKey('oakDark', CELL.oak, [0.26, 0.16, 0.09]); defKey('oakRoof', CELL.oak, [0.4, 0.25, 0.13]);
defKey('linen', CELL.linen, [0.5, 0.32, 0.17]); defKey('linenDark', CELL.linen, [0.36, 0.22, 0.12]);
defKey('herald', CELL.herald, [1, 1, 1], 0.9, 2); defKey('glassDay', CELL.glass, [0.82, 0.9, 0.95], 0.9, 2);
defKey('lawn', P, [0.3, 0.5, 0.2]); defKey('leaf', P, [0.25, 0.43, 0.17]); defKey('leafDark', P, [0.13, 0.25, 0.1]); defKey('padGreen', P, [0.26, 0.48, 0.2]);
defKey('flowerPink', P, [1.2, 0.6, 0.85]); defKey('flowerPurple', P, [0.62, 0.42, 0.95]); defKey('flowerWhite', P, [1.2, 1.2, 1.15]); defKey('bark', P, [0.3, 0.22, 0.15]);
defKey('water', P, [0.07, 0.13, 0.12]); defKey('lampGlow', P, [1.2, 0.95, 0.6], 2.2, 0); defKey('lampOn', P, [1.25, 0.8, 0.4], 0.95, 1); defKey('red', P, [0.5, 0.08, 0.09]); defKey('brass', P, [0.85, 0.62, 0.22]);
defKey('white', P, [1.1, 1.08, 1.0]); defKey('soil', P, [0.2, 0.15, 0.1]);
defKey('sand', P, [0.85, 0.74, 0.52]); defKey('whiteFrame', P, [1.08, 1.08, 1.03]); defKey('cactus', P, [0.3, 0.46, 0.25]); defKey('leafLight', P, [0.4, 0.6, 0.2]);
defKey('pondWater', P, [0.05, 0.1, 0.08], 0, 3); defKey('rock', P, [0.5, 0.48, 0.44]);   // mode 3 = glossy
/** a key for an arbitrary colour on a cell (made on demand): col('plain', r, g, b, glow, mode) */
export function col(cell, r, g, b, glow = 0, mode = 0) {
  const c = typeof cell === 'string' ? CELL[cell] : cell, name = `#${c}:${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)},${glow},${mode}`;
  if (!KEYS.has(name)) KEYS.set(name, { c, t: [r, g, b], g: glow, m: mode });
  return name;
}

// ------------------------------------------------------------------------------------------------ atlas
/** tileable value noise on a period-n lattice */
function vnoise(x, y, n, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, w = (a) => ((a % n) + n) % n;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hh(w(xi), w(yi), seed), b = hh(w(xi + 1), w(yi), seed), c = hh(w(xi), w(yi + 1), seed), d = hh(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function grain(g, seed, amp, blot = 0.05, sx = 1, sy = 1) {
  let img; try { img = g.getImageData(0, 0, TILE, TILE); } catch { return; }
  const d = img.data; if (!d || d.length < TILE * TILE * 4) return;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const i = (y * TILE + x) * 4, u = x / TILE, v = y / TILE;
    const n = (hh(x, y, seed) - 0.5) * amp + (vnoise(u * 6 * sx, v * 6 * sy, 6, seed + 1) - 0.5) * blot * 2 + (vnoise(u * 24 * sx, v * 24 * sy, 24, seed + 2) - 0.5) * blot;
    const k = 1 + n; d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
  }
  g.putImageData(img, 0, 0);
}
const rgb = (v, wr = 1, wg = 1, wb = 1) => `rgb(${Math.round(Math.min(255, v * 255 * wr))},${Math.round(Math.min(255, v * 255 * wg))},${Math.round(Math.min(255, v * 255 * wb))})`;
/** fill a rect that may hang over the right / bottom edge (wrapped) */
function wrapRect(g, x, y, w, h) { for (const ox of [0, -TILE]) for (const oy of [0, -TILE]) g.fillRect(x + ox, y + oy, w, h); }

const PAINT = [
  // 0 ashlar: 7 courses of 0.34 m, blocks 0.4-0.9 m, tight joints with a lit lower arris, the odd weathered block
  (g) => {
    g.fillStyle = rgb(0.86); g.fillRect(0, 0, TILE, TILE);
    const NC = 7, ch = TILE / NC;
    for (let c = 0; c < NC; c++) {
      let x = Math.floor(hh(c, 11) * 90);
      const x0 = x; let k = 0;
      while (x < x0 + TILE) {
        let w = 84 + Math.floor(hh(c, k, 5) * 96); if (x + w > x0 + TILE - 60) w = x0 + TILE - x;
        const tone = 0.85 + 0.09 * hh(c, k, 7), warm = 0.98 + 0.04 * hh(c, k, 9), worn = hh(c, k, 13) < 0.1 ? 0.92 : 1;
        g.fillStyle = rgb(tone * worn, 1, 0.985 * warm, 0.95 * warm); wrapRect(g, x % TILE, c * ch, w, ch);
        // soft shading inside the block: darker towards the top joint (soot under the bed), lighter low down
        const gr = g.createLinearGradient(0, c * ch, 0, (c + 1) * ch); gr.addColorStop(0, 'rgba(60,45,25,0.16)'); gr.addColorStop(0.25, 'rgba(60,45,25,0)'); gr.addColorStop(0.85, 'rgba(255,250,235,0)'); gr.addColorStop(1, 'rgba(255,250,235,0.14)');
        g.fillStyle = gr; wrapRect(g, x % TILE, c * ch, w, ch);
        g.fillStyle = 'rgba(70,54,36,0.42)'; wrapRect(g, x % TILE, c * ch, 2, ch);          // perpend joint
        g.fillStyle = 'rgba(255,248,230,0.2)'; wrapRect(g, (x + 2) % TILE, c * ch, 1, ch);
        x += w; k++;
      }
      g.fillStyle = 'rgba(66,50,32,0.5)'; g.fillRect(0, c * ch, TILE, 2);                    // bed joint
      g.fillStyle = 'rgba(255,248,230,0.22)'; g.fillRect(0, c * ch + 2, TILE, 1);
    }
    grain(g, 21, 0.09, 0.05);
  },
  // 1 lead: sheets with wood-cored rolls every 0.6 m and a lap every 1.2 m, pale patina streaks
  (g) => {
    g.fillStyle = rgb(0.78); g.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 4; i++) {
      const x = i * 120;
      const gr = g.createLinearGradient(x, 0, x + 14, 0); gr.addColorStop(0, 'rgba(20,22,28,0.55)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(20,22,28,0.4)');
      g.fillStyle = gr; g.fillRect(x, 0, 14, TILE);
      const y = (i % 2) * 120 + 60; g.fillStyle = 'rgba(20,22,28,0.45)'; g.fillRect(x + 14, y, 106, 2); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + 14, y + 2, 106, 2);
      g.fillStyle = 'rgba(20,22,28,0.45)'; g.fillRect(x + 14, y + 240, 106, 2); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + 14, y + 242, 106, 2);
    }
    grain(g, 31, 0.06, 0.1, 3, 0.5);
  },
  // 2 leaded glass: diamond quarries in lead cames, each pane its own grey
  (g) => {
    g.fillStyle = rgb(0.5); g.fillRect(0, 0, TILE, TILE);
    const N = 6, s = TILE / N;
    for (let i = -1; i <= N; i++) for (let j = -1; j <= 2 * N; j++) {
      const cx = (i + (j % 2 ? 0.5 : 0)) * s + s / 2, cy = j * s / 2 + s / 2 - s / 2, t = 0.34 + 0.5 * hh((i + N) % N, (j + 2 * N) % (2 * N), 3);
      g.fillStyle = rgb(t, 1, 1.0, 1.02); g.beginPath(); g.moveTo(cx, cy - s / 2 + 3); g.lineTo(cx + s / 2 - 3, cy); g.lineTo(cx, cy + s / 2 - 3); g.lineTo(cx - s / 2 + 3, cy); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(18,18,20,0.9)'; g.lineWidth = 5;
    for (let k = -N; k <= 2 * N; k++) { g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s + TILE, TILE); g.stroke(); g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s - TILE, TILE); g.stroke(); }
  },
  // 3 plain
  (g) => { g.fillStyle = rgb(0.9); g.fillRect(0, 0, TILE, TILE); grain(g, 41, 0.05, 0.04); },
  // 4 flagstones: four rows of 0.6 m, slabs 0.5-1.1 m, worn
  (g) => {
    g.fillStyle = rgb(0.8); g.fillRect(0, 0, TILE, TILE);
    for (let r = 0; r < 4; r++) {
      let x = Math.floor(hh(r, 71) * 100); const x0 = x; let k = 0;
      while (x < x0 + TILE) {
        let w = 96 + Math.floor(hh(r, k, 73) * 130); if (x + w > x0 + TILE - 70) w = x0 + TILE - x;
        g.fillStyle = rgb(0.74 + 0.18 * hh(r, k, 75), 1, 0.99, 0.96 + 0.05 * hh(r, k, 77)); wrapRect(g, x % TILE, r * 120, w, 120);
        g.fillStyle = 'rgba(40,34,26,0.65)'; wrapRect(g, x % TILE, r * 120, 3, 120); g.fillStyle = 'rgba(255,250,240,0.16)'; wrapRect(g, (x + 3) % TILE, r * 120, 1, 120);
        x += w; k++;
      }
      g.fillStyle = 'rgba(40,34,26,0.65)'; g.fillRect(0, r * 120, TILE, 3); g.fillStyle = 'rgba(255,250,240,0.16)'; g.fillRect(0, r * 120 + 3, TILE, 1);
    }
    grain(g, 51, 0.1, 0.12);
  },
  // 5 oak boards: six boards of 0.2 m running up the cell, long grain
  (g) => {
    g.fillStyle = rgb(0.74); g.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 6; i++) { g.fillStyle = rgb(0.66 + 0.2 * hh(i, 81), 1, 0.98, 0.94); g.fillRect(i * 80, 0, 80, TILE); }
    for (let k = 0; k < 150; k++) { const x = Math.floor(hh(k, 83) * TILE); g.fillStyle = `rgba(30,18,8,${0.05 + 0.12 * hh(k, 85)})`; g.fillRect(x, 0, 1 + Math.floor(hh(k, 87) * 2), TILE); }
    grain(g, 61, 0.07, 0.06, 4, 0.4);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(14,8,4,0.75)'; g.fillRect(i * 80, 0, 3, TILE); g.fillStyle = 'rgba(255,235,200,0.14)'; g.fillRect(i * 80 + 3, 0, 2, TILE); }
  },
  // 6 linenfold: one framed panel (0.56 x 1.12 m): stiles and rails, a sunk field carved in five vertical folds whose ends curl
  (g) => {
    g.fillStyle = rgb(0.7); g.fillRect(0, 0, TILE, TILE);
    for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(30,18,8,${0.05 + 0.1 * hh(k, 91)})`; g.fillRect(Math.floor(hh(k, 93) * TILE), 0, 2, TILE); }
    const fx0 = 62, fx1 = TILE - 62, fy0 = 44, fy1 = TILE - 44;
    g.fillStyle = 'rgba(12,7,3,0.8)'; g.fillRect(fx0 - 8, fy0 - 5, fx1 - fx0 + 16, fy1 - fy0 + 10);          // the sunk field's shadow line
    g.fillStyle = rgb(0.52); g.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    const NF = 5, fw = (fx1 - fx0) / NF;
    for (let i = 0; i < NF; i++) {
      const x = fx0 + i * fw;
      const gr = g.createLinearGradient(x, 0, x + fw, 0);
      gr.addColorStop(0, rgb(0.3)); gr.addColorStop(0.22, rgb(0.72)); gr.addColorStop(0.5, rgb(0.96)); gr.addColorStop(0.78, rgb(0.66)); gr.addColorStop(1, rgb(0.26));
      g.fillStyle = gr; g.fillRect(x, fy0 + 26, fw, fy1 - fy0 - 52);
      // the curled ends: a little scroll top and bottom
      for (const [yy, dir] of [[fy0 + 26, -1], [fy1 - 26, 1]]) {
        g.fillStyle = rgb(0.84); g.beginPath(); g.moveTo(x + 3, yy); g.quadraticCurveTo(x + fw / 2, yy + dir * 30, x + fw - 3, yy); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(14,8,4,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 3, yy); g.quadraticCurveTo(x + fw / 2, yy + dir * 30, x + fw - 3, yy); g.stroke();
        g.beginPath(); g.moveTo(x + fw * 0.3, yy + dir * 3); g.quadraticCurveTo(x + fw / 2, yy + dir * 16, x + fw * 0.7, yy + dir * 3); g.stroke();
      }
    }
    // frame mouldings: light upper-left arris, dark lower-right
    g.fillStyle = 'rgba(255,230,190,0.28)'; g.fillRect(0, 0, TILE, 4); g.fillRect(0, 0, 4, TILE); g.fillStyle = 'rgba(10,6,3,0.7)'; g.fillRect(0, TILE - 5, TILE, 5); g.fillRect(TILE - 5, 0, 5, TILE);
    g.fillStyle = 'rgba(255,230,190,0.2)'; g.fillRect(fx0 - 14, fy1 + 6, fx1 - fx0 + 28, 3); g.fillRect(fx1 + 9, fy0 - 8, 3, fy1 - fy0 + 16);
  },
  // 7 heraldic glass: a light of clear quarries with a coloured border and an invented quartered shield (no real arms)
  (g) => {
    g.fillStyle = rgb(0.9, 0.97, 1, 0.94); g.fillRect(0, 0, TILE, TILE);
    const N = 6, s = TILE / N;
    for (let i = -1; i <= N; i++) for (let j = -1; j <= 2 * N; j++) {
      const cx = (i + (j % 2 ? 0.5 : 0)) * s + s / 2, cy = j * s / 2, t = 0.74 + 0.24 * hh(i + 9, j + 9, 5);
      g.fillStyle = rgb(t, 0.97, 1, 0.92 + 0.08 * hh(i + 9, j + 9, 6)); g.beginPath(); g.moveTo(cx, cy - s / 2 + 2); g.lineTo(cx + s / 2 - 2, cy); g.lineTo(cx, cy + s / 2 - 2); g.lineTo(cx - s / 2 + 2, cy); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(20,20,22,0.85)'; g.lineWidth = 3;
    for (let k = -N; k <= 2 * N; k++) { g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s + TILE, TILE); g.stroke(); g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s - TILE, TILE); g.stroke(); }
    // border of alternate ruby / gold / blue pieces
    const BC = ['#b3202a', '#e0b030', '#2a4fa8', '#e8e2c8'];
    for (let k = 0; k < 16; k++) { g.fillStyle = BC[k % 4]; g.fillRect(0, k * 30, 22, 28); g.fillStyle = BC[(k + 2) % 4]; g.fillRect(TILE - 22, k * 30, 22, 28); }
    g.fillStyle = 'rgba(20,20,22,0.9)'; g.fillRect(22, 0, 4, TILE); g.fillRect(TILE - 26, 0, 4, TILE);
    // the shield (the cell is twice as tall as wide in metres, so shapes here are drawn half-height)
    const sx = TILE / 2, sy = 250, w = 150, h = 92;
    const shield = () => { g.beginPath(); g.moveTo(sx - w, sy - h); g.lineTo(sx + w, sy - h); g.lineTo(sx + w, sy + h * 0.2); g.quadraticCurveTo(sx + w * 0.9, sy + h * 0.85, sx, sy + h * 1.15); g.quadraticCurveTo(sx - w * 0.9, sy + h * 0.85, sx - w, sy + h * 0.2); g.closePath(); };
    g.save(); shield(); g.clip();
    g.fillStyle = '#b3202a'; g.fillRect(sx - w, sy - h, w, h); g.fillStyle = '#e8e2c8'; g.fillRect(sx, sy - h, w, h);
    g.fillStyle = '#2a4fa8'; g.fillRect(sx - w, sy, w, h * 1.2); g.fillStyle = '#e0b030'; g.fillRect(sx, sy, w, h * 1.2);
    g.fillStyle = '#e0b030'; g.beginPath(); g.ellipse(sx - w / 2, sy - h / 2, 40, 20, 0, 0, Math.PI * 2); g.fill();                     // a gold roundel
    g.fillStyle = '#2a4fa8'; for (let k = 0; k < 3; k++) g.fillRect(sx + 12, sy - h + 14 + k * 26, w - 24, 11);                          // three blue bars
    g.fillStyle = '#e8e2c8'; g.beginPath(); g.moveTo(sx - w + 10, sy + h * 0.7); g.lineTo(sx - w / 2, sy + 12); g.lineTo(sx - 10, sy + h * 0.7); g.lineTo(sx - 10, sy + h * 0.9); g.lineTo(sx - w / 2, sy + 34); g.lineTo(sx - w + 10, sy + h * 0.9); g.closePath(); g.fill();   // a chevron
    g.fillStyle = '#b3202a'; g.fillRect(sx + w / 2 - 12, sy + 8, 24, h * 0.8); g.fillRect(sx + 16, sy + h * 0.32, w - 40, 14);            // a red cross
    g.restore();
    g.strokeStyle = 'rgba(20,20,22,0.95)'; g.lineWidth = 6; shield(); g.stroke(); g.beginPath(); g.moveTo(sx, sy - h); g.lineTo(sx, sy + h * 1.15); g.moveTo(sx - w, sy); g.lineTo(sx + w, sy); g.stroke();
    // a ruby lozenge above and below
    for (const yy of [70, 420]) { g.fillStyle = '#2a4fa8'; g.beginPath(); g.moveTo(sx, yy - 22); g.lineTo(sx + 44, yy); g.lineTo(sx, yy + 22); g.lineTo(sx - 44, yy); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#e0b030'; g.beginPath(); g.ellipse(sx, yy, 14, 7, 0, 0, Math.PI * 2); g.fill(); }
  },
];

let _tex = null;
export function fineTexture() {
  if (_tex) return _tex;
  const cv = document.createElement('canvas'); cv.width = CPX * 4; cv.height = CPX * 2;
  const g = cv.getContext('2d');
  for (let c = 0; c < 8; c++) {
    const t = document.createElement('canvas'); t.width = t.height = TILE;
    const tg = t.getContext('2d'); try { PAINT[c](tg); } catch (e) { console.warn('[se_fine] cell', c, e); }
    const ox = (c % 4) * CPX, oy = Math.floor(c / 4) * CPX;
    g.save(); g.beginPath(); g.rect(ox, oy, CPX, CPX); g.clip();
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) g.drawImage(t, ox + PADPX + dx * TILE, oy + PADPX + dy * TILE);
    g.restore();
  }
  _tex = new THREE.CanvasTexture(cv); _tex.colorSpace = THREE.SRGBColorSpace; _tex.anisotropy = 4; _tex.flipY = false;
  _tex.wrapS = _tex.wrapT = THREE.ClampToEdgeWrapping; _tex.name = 'se:fine';
  // (memory pass: painted again by this function, its cache set aside for the call, if the card ever needs it again: world/_tex_keep.js)
  { const mine = _tex; repaintable(mine, () => { _tex = null; try { return fineTexture(); } finally { _tex = mine; } }, 'se:fine'); }
  return _tex;
}

const _mat = new Map();
/** the one showpiece material. opts.interior: no weather staining; opts.side */
export function fineMaterial(world, opts = {}) {
  const id = (opts.interior ? 'i' : 'x') + (opts.side === THREE.DoubleSide ? 'd' : 's');
  if (_mat.has(id)) return _mat.get(id);
  const m = new THREE.MeshStandardMaterial({ map: fineTexture(), vertexColors: true, roughness: 0.86, metalness: 0, name: 'se:fine:' + id, side: opts.side || THREE.FrontSide });
  const U = world.uniforms || {}, night = U.night || { value: 0 };
  const sc = CELL_M.map(([a, b]) => `vec2(${(1 / a).toFixed(5)}, ${(1 / b).toFixed(5)})`);
  const pad = (PADPX / CPX).toFixed(6), inner = (TILE / CPX).toFixed(6);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFineNight = night;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aFx;\nvarying vec3 vFx;\nvarying vec3 vFineW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx = aFx;\nvFineW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uFineNight;
varying vec3 vFx;
varying vec3 vFineW;
float fineH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fineN(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fineH(i), fineH(i + vec3(1,0,0)), f.x), mix(fineH(i + vec3(0,1,0)), fineH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fineH(i + vec3(0,0,1)), fineH(i + vec3(1,0,1)), f.x), mix(fineH(i + vec3(0,1,1)), fineH(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `
	float fCell = floor(vFx.x + 0.5);
	vec2 fSc = fCell < 0.5 ? ${sc[0]} : fCell < 1.5 ? ${sc[1]} : fCell < 2.5 ? ${sc[2]} : fCell < 3.5 ? ${sc[3]} : fCell < 4.5 ? ${sc[4]} : fCell < 5.5 ? ${sc[5]} : fCell < 6.5 ? ${sc[6]} : ${sc[7]};
	vec2 fQ = vMapUv * fSc;
	vec2 fO = vec2(mod(fCell, 4.0), floor(fCell * 0.25));
	vec2 fK = vec2(0.25, 0.5);
	vec2 fF = fract(fQ); fF.y = 1.0 - fF.y;
	vec4 fineTex = textureGrad(map, (fO + ${pad} + fF * ${inner}) * fK, dFdx(fQ) * ${inner} * fK, dFdy(fQ) * ${inner} * fK);
	diffuseColor *= fineTex;
	${opts.interior ? '' : `if (fCell < 0.5 || fCell > 3.5 && fCell < 4.5 || fCell > 2.5 && fCell < 3.5 && vFx.y == 0.0) {
		float fSt = fineN(vFineW * vec3(0.16, 0.09, 0.16)) * 0.6 + fineN(vFineW * vec3(0.55, 0.3, 0.55)) * 0.4;
		diffuseColor.rgb *= 0.87 + 0.2 * fSt;
		diffuseColor.rgb *= mix(vec3(0.84, 0.82, 0.8), vec3(1.0), smoothstep(0.0, 1.6, vFineW.y));
	}`}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\tif (fCell > 1.5 && fCell < 2.5 || fCell > 6.5) roughnessFactor = 0.22; else if (fCell > 0.5 && fCell < 1.5) roughnessFactor = 0.58;\n\tif (vFx.z > 2.5) roughnessFactor = 0.07;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		float fLum = dot(fineTex.rgb, vec3(0.3333));
		if (vFx.z < 0.5) totalEmissiveRadiance += vFx.y * uFineNight * vec3(1.0, 0.64, 0.33) * (0.12 + fLum * 1.5);
		else if (vFx.z < 1.5) totalEmissiveRadiance += vFx.y * diffuseColor.rgb;
		else if (vFx.z < 2.5) totalEmissiveRadiance += vFx.y * diffuseColor.rgb * (1.0 - 0.92 * uFineNight);
	}`);
  };
  m.customProgramCacheKey = () => 'se-fine-' + id;
  _mat.set(id, m);
  return m;
}

/** Batch -> ONE mesh with the fine material. Unknown keys fall back to 'stone'. Returns the mesh. */
export function buildFine(B, world, parent, name, opts = {}) {
  let n = 0; for (const Pp of B.parts.values()) n += Pp.pos.length / 3;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), colr = new Float32Array(n * 3), fx = new Float32Array(n * 3);
  let o = 0;
  for (const [key, Pp] of B.parts) {
    const K = KEYS.get(key) || KEYS.get('stone'), k = Pp.pos.length / 3;
    pos.set(Pp.pos, o * 3); nor.set(Pp.nor, o * 3); uv.set(Pp.uv, o * 2);
    for (let i = 0; i < k; i++) { const j = (o + i) * 3; colr[j] = K.t[0]; colr[j + 1] = K.t[1]; colr[j + 2] = K.t[2]; fx[j] = K.c; fx[j + 1] = K.g; fx[j + 2] = K.m; }
    o += k;
  }
  B.parts.clear();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setAttribute('aFx', new THREE.BufferAttribute(fx, 3));
  g.computeBoundingSphere(); g.computeBoundingBox();
  const m = new THREE.Mesh(g, fineMaterial(world, opts)); m.name = name; m.castShadow = opts.cast !== false; m.receiveShadow = true;
  m.matrixAutoUpdate = false; m.updateMatrix(); if (parent) parent.add(m);
  return m;
}
export const triCount = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;

/** near/far swap for a showpiece: {near, far, c:[x,z], r}: the near mesh inside r (6 m hysteresis), else the far one */
/** LOD distance scale from the quality tier: low never shows the near meshes, medium at 0.6 of the distance */
export function lodScale(game) { const q = game.quality || {}; return (q.level === 'low' ? 0 : q.level === 'medium' ? 0.6 : 1) * (q.dist || 1); }
// Shadow proxy: while a showpiece's near mesh is drawn, its far mesh casts the shadow instead (near.castShadow = false),
// on a layer only the sun's shadow camera renders. Same draw count as near + near-shadow, a fraction of the triangles.
export const SHADOW_LAYER = 29;
export function shadowProxy(world, lod) {
  if (lod) lod.W = world;                          // (lodSwap reads world.aerial)
  if (!lod || !lod.near || !lod.far) return lod;
  lod.farCast = lod.far.castShadow; lod.near.castShadow = false; lod.shadowFar = true;   // a far mesh that never casts (Tom Quad) casts only as the proxy
  try { world.sun.shadow.camera.layers.enable(SHADOW_LAYER); } catch { /* no sun (tests) */ }
  return lod;
}
// Aerial (world.aerial, from a glider): a showpiece with `airFar` keeps its far mesh out to that ground distance as a
// silhouette (and cull.js spares it out there: airKeep), and the near mesh is chosen by the 3D distance, so a quad
// 300 m below is drawn far, not near. Off the ground nothing here changes (the original expressions, untouched).
export const AIR_FAR = 2000;
/** let core/cull.js keep these (small) meshes out to d metres while aerial */
export function airKeep(meshes, d = AIR_FAR) { for (const m of meshes) if (m) m.userData.airFar = d; return meshes; }
export function lodSwap(L, cam, on = true, fwd = null, scale = 1) {
  for (const g of L) {
    if (!g) continue;
    if (g.W && g.W.aerial && g.airFar) { airSwap(g, cam, on, fwd, scale); continue; }
    const dx = g.c[0] - cam.x, dz = g.c[1] - cam.z, d = Math.hypot(dx, dz);
    // 'facing' showpieces drop to the far mesh when they are behind the camera (it still casts the same shadow)
    const seen = !g.facing || !fwd || d < (g.rIn || 14) || (dx * fwd.x + dz * fwd.z) / d > (g.isNear ? -0.1 : 0.05);
    const r = scale > 0 ? g.r * Math.max(scale, g.minScale || 0) : 0;
    const near = on && seen && d < (g.isNear ? r + 6 : r) && (!g.gate || g.gate(cam.x, cam.z)), far = on && !near && d < (g.rFar || Infinity) && !(g.lowOff && scale === 0);   // lowOff: an addition the low tier never draws
    g.isNear = near;
    if (g.near && g.near.visible !== near) g.near.visible = near;
    if (g.shadowFar && g.far) { const fv = far || near; if (g.far.visible !== fv) g.far.visible = fv; const ly = near ? SHADOW_LAYER : 0; if (g.far.layers.mask !== 1 << ly) { g.far.layers.set(ly); g.far.castShadow = near || g.farCast; } }
    else if (g.far && g.far.visible !== far) g.far.visible = far;
  }
}
function airSwap(g, cam, on, fwd, scale) {
  const dx = g.c[0] - cam.x, dz = g.c[1] - cam.z, d = Math.hypot(dx, dz), d3 = Math.hypot(d, cam.y - (g.cy || 0));
  const seen = !g.facing || !fwd || d < (g.rIn || 14) || (dx * fwd.x + dz * fwd.z) / d > (g.isNear ? -0.1 : 0.05);
  const r = scale > 0 ? g.r * Math.max(scale, g.minScale || 0) : 0;
  const near = on && seen && d3 < (g.isNear ? r + 6 : r) && (!g.gate || g.gate(cam.x, cam.z)), far = on && !near && d < Math.max(g.rFar || Infinity, g.airFar) && !(g.lowOff && scale === 0);
  g.isNear = near;
  if (g.near && g.near.visible !== near) g.near.visible = near;
  if (g.shadowFar && g.far) { const fv = far || near; if (g.far.visible !== fv) g.far.visible = fv; const ly = near ? SHADOW_LAYER : 0; if (g.far.layers.mask !== 1 << ly) { g.far.layers.set(ly); g.far.castShadow = near || g.farCast; } }
  else if (g.far && g.far.visible !== far) g.far.visible = far;
}

// ------------------------------------------------------------------------------------------------ mouldings and tracery
// All in the Batch's current frame. Wall-frame helpers take a wall in the XY plane facing +z.

/** a moulded string course / cornice along x0..x1 at y on a wall face (z = 0): stepped projection, underside shadowed */
export function stringCourse(B, x0, x1, y, { h = 0.3, d = 0.22, key = 'mould', ends = true } = {}) {
  const L = x1 - x0, xm = (x0 + x1) / 2;
  B.box(key, xm, y + h * 0.3, d * 0.3, L + (ends ? d * 0.6 : 0), h * 0.4, d * 0.6, 0, { bottom: true });
  B.box(key, xm, y + h * 0.75, d * 0.5, L + (ends ? d : 0), h * 0.5, d, 0, { bottom: true });
}
/** a ring of string course round an n-gon (circumradius r) at y */
export function ringCourse(B, cx, cz, r, y, n = 8, rot = Math.PI / 8, { h = 0.3, d = 0.2, key = 'mould' } = {}) {
  lathe(B, key, cx, cz, [[r, y], [r + d, y + h * 0.55], [r + d, y + h], [r, y + h]], n, rot);
}
/** an ogee (reversed-curve) arch outline: width w centred x, sill y0, springing ys, apex ya */
export function ogeePts(x, w, y0, ys, ya, seg = 6) {
  const p = [[x - w / 2, y0], [x + w / 2, y0]], hw = w / 2, H = ya - ys;
  const side = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    // convex quarter to mid-height, then the concave sweep up to the point
    const dx = t < 0.5 ? hw * (1 - 0.5 * (1 - Math.cos(t * Math.PI))) : hw * 0.5 * (1 - Math.sin((t - 0.5) * Math.PI));
    const dy = t < 0.5 ? H * 0.5 * Math.sin(t * Math.PI) : H * (0.5 + 0.5 * (1 - Math.cos((t - 0.5) * Math.PI)));
    side.push([dx, ys + dy]);
  }
  for (let i = 0; i <= seg; i++) p.push([x + side[i][0], side[i][1]]);
  for (let i = seg - 1; i >= 0; i--) p.push([x - side[i][0], side[i][1]]);
  return p;
}
/** offset a closed outline outward from its centroid-ish axis x = cx by d (cheap, for hood moulds over arches) */
export function growPts(pts, d) {
  let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= pts.length; cy /= pts.length;
  return pts.map(([x, y]) => { const l = Math.hypot(x - cx, y - cy) || 1; return [x + ((x - cx) / l) * d, y + ((y - cy) / l) * d]; });
}
/** a band (hood mould / frame) round the upper part of an outline: strip between pts and pts grown by w, standing d proud */
export function hoodMould(B, pts, { w = 0.16, d = 0.12, key = 'mould', fromY = -Infinity, z = 0 } = {}) {
  const out = growPts(pts, w);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ao = out[i], bo = out[(i + 1) % pts.length];
    if (Math.min(a[1], b[1]) < fromY) continue;
    B.poly(key, [[a[0], a[1], z + d], [b[0], b[1], z + d], [bo[0], bo[1], z + d], [ao[0], ao[1], z + d]], [0, 0, 1]);
    B.poly(key, [[ao[0], ao[1], z], [bo[0], bo[1], z], [bo[0], bo[1], z + d], [ao[0], ao[1], z + d]], [ao[0] - a[0] + bo[0] - b[0], ao[1] - a[1] + bo[1] - b[1], 0]);
  }
}
/**
 * A Perpendicular traceried window in a wall face (z = 0 is the wall plane, the glass sits d back):
 * outline pts (from pointedPts / ogeePts / tudor), `lights` mullioned lights with cusped heads, optional transoms, and
 * supermullions / a quatrefoil eye in the head. opts: { d, glass, bar, lights, transoms: [y…], headY (springing), lite }.
 * Costs ~ (40 + 30 * lights) triangles; lite = true draws only mullions and one transom.
 */
export function tracery(B, pts, o = {}) {
  const d = o.d ?? 0.35, glass = o.glass || 'win', bar = o.bar || 'mould', lights = o.lights || 2, bw = o.bw || 0.09;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const headY = o.headY ?? (y0 + (y1 - y0) * 0.62), zb = o.zb ?? (-d + 0.03), xm = (x0 + x1) / 2, W = x1 - x0;
  if (!o.noReveal) B.reveal(o.reveal || 'stone', pts, 0, -d);
  if (!o.open) B.face(glass, pts, [], -d);
  // the outline's half-width at height y (for clipping bars to the arch)
  const halfAt = (y) => { let m = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const t = (y - a[1]) / (b[1] - a[1]); m = Math.max(m, Math.abs(a[0] + (b[0] - a[0]) * t - xm)); } } return m; };
  const topAt = (x) => { let m = y0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) { const t = (x - a[0]) / (b[0] - a[0]); m = Math.max(m, a[1] + (b[1] - a[1]) * t); } } return m; };
  const lw = W / lights;
  // mullions (run up into the head as supermullions)
  for (let i = 1; i < lights; i++) { const x = x0 + i * lw, top = topAt(x) - 0.02; B.box(bar, x, (y0 + top) / 2, zb + 0.06, bw, top - y0, 0.14); }
  for (const ty of o.transoms || []) { const hwid = halfAt(ty); B.box(bar, xm, ty, zb + 0.06, hwid * 2, bw, 0.13); }
  if (o.lite) return;
  // cusped (two-centred) heads to each light at the springing, and under each transom
  const heads = [headY, ...(o.transoms || [])];
  for (const hy of heads) for (let i = 0; i < lights; i++) {
    const cx = x0 + (i + 0.5) * lw, r = lw / 2, rise = Math.min(r * 1.1, 0.55);
    if (hy + 0.05 > topAt(cx)) continue;
    const N = o.cusp || 4;
    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N;
      for (const s of [-1, 1]) {
        const ax = cx + s * r * (1 - t0), ay = hy - rise + rise * Math.sin(t0 * Math.PI / 2), bx = cx + s * r * (1 - t1), by = hy - rise + rise * Math.sin(t1 * Math.PI / 2);
        B.poly(bar, [[ax, ay, zb + 0.1], [bx, by, zb + 0.1], [bx, hy + 0.04, zb + 0.1], [ax, hy + 0.04, zb + 0.1]], [0, 0, 1]);
      }
    }
  }
  // head: a supertransom bar and small lights, or an eye
  if (lights >= 2 && y1 - headY > 0.5) {
    const hy2 = headY + (y1 - headY) * 0.5, hwid = halfAt(hy2);
    if (hwid > 0.2) B.box(bar, xm, hy2, zb + 0.06, hwid * 2, bw * 0.8, 0.12);
    if (!o.cusp) for (let i = 0; i < lights; i++) { const x = x0 + (i + 0.5) * lw, top = topAt(x) - 0.02; if (top > headY + 0.3) B.box(bar, x, (headY + top) / 2, zb + 0.06, bw * 0.7, top - headY, 0.12); }
  }
}
/** crocketed pinnacle: square shaft with gablets, a tapering spirelet with crockets and a finial. Base centre (x, y, z) */
export function pinnacle(B, x, y, z, { w = 0.5, shaft = 1.2, spire = 2.0, key = 'mould', n = 4, lite = false } = {}) {
  const r = w * 0.7071;
  prism(B, key, x, z, r, y, y + shaft, 4, { rot: Math.PI / 4, cap: false });
  lathe(B, key, x, z, [[r * 1.25, y + shaft], [r * 1.25, y + shaft + 0.08], [r * 0.9, y + shaft + 0.14], [0.04, y + shaft + spire]], n, Math.PI / 4);
  if (lite) return;
  for (let k = 1; k <= 2; k++) { const t = k / 3, rr = r * 0.9 * (1 - t) + 0.04, yy = y + shaft + 0.14 + (spire - 0.14) * t; for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * Math.PI * 2; B.box(key, x + Math.sin(a) * rr * 1.15, yy, z + Math.cos(a) * rr * 1.15, 0.12, 0.12, 0.12, a, { top: false }); } }
  lathe(B, key, x, z, [[0.04, y + shaft + spire - 0.05], [0.13, y + shaft + spire + 0.06], [0.05, y + shaft + spire + 0.16], [0.1, y + shaft + spire + 0.24], [0, y + shaft + spire + 0.36]], 4, Math.PI / 4);
}
/** battlements with a moulded coping along a straight edge (current frame, XZ), each merlon capped */
export function crenelFine(B, x0, z0, x1, z1, y, { mw = 0.8, gap = 0.6, h = 0.7, t = 0.38, base = 0.55, key = 'stone', cope = 'mould', lite = false } = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.4) return;
  const ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(ux, uz) - Math.PI / 2;
  const n = Math.max(1, Math.round((L + gap) / (mw + gap))), g2 = n > 1 ? (L - n * mw) / (n - 1) : 0, m2 = n > 1 ? mw : L;
  B.box(key, (x0 + x1) / 2, y + base / 2, (z0 + z1) / 2, L, base, t, ry, { top: lite });
  if (!lite) B.box(cope, (x0 + x1) / 2, y + base + 0.04, (z0 + z1) / 2, L, 0.08, t + 0.1, ry);
  for (let i = 0; i < n; i++) {
    const s = i * (m2 + g2) + m2 / 2, cx = x0 + ux * s, cz = z0 + uz * s;
    B.box(key, cx, y + base + h / 2, cz, m2, h, t, ry, { top: lite });
    if (!lite) B.box(cope, cx, y + base + h + 0.05, cz, m2 + 0.1, 0.1, t + 0.12, ry);
  }
}
export function crenelRing(B, cx, cz, r, y, n = 8, rot = Math.PI / 8, o = {}) {
  for (let i = 0; i < n; i++) { const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2; crenelFine(B, cx + Math.sin(a0) * r, cz + Math.cos(a0) * r, cx + Math.sin(a1) * r, cz + Math.cos(a1) * r, y, o); }
}
/** blind Perpendicular panelling on a wall face region x0..x1, y0..y1 (z = 0): cusped panels in rows, bars standing proud */
export function blindPanels(B, x0, x1, y0, y1, { cols = 4, rows = 1, key = 'mould', d = 0.07, bw = 0.08, back = null } = {}) {
  const cw = (x1 - x0) / cols, rh = (y1 - y0) / rows;
  if (back) B.poly(back, [[x0, y0, 0.01], [x1, y0, 0.01], [x1, y1, 0.01], [x0, y1, 0.01]], [0, 0, 1]);
  // bars: a proud front face with two splayed sides (6 triangles each)
  const vbar = (x) => { B.poly(key, [[x - bw / 2, y0, d], [x + bw / 2, y0, d], [x + bw / 2, y1, d], [x - bw / 2, y1, d]], [0, 0, 1]); B.poly(key, [[x - bw, y0, 0], [x - bw / 2, y0, d], [x - bw / 2, y1, d], [x - bw, y1, 0]], [-1, 0, 1]); B.poly(key, [[x + bw / 2, y0, d], [x + bw, y0, 0], [x + bw, y1, 0], [x + bw / 2, y1, d]], [1, 0, 1]); };
  const hbar = (y) => { B.poly(key, [[x0, y - bw / 2, d], [x1, y - bw / 2, d], [x1, y + bw / 2, d], [x0, y + bw / 2, d]], [0, 0, 1]); B.poly(key, [[x0, y - bw, 0], [x1, y - bw, 0], [x1, y - bw / 2, d], [x0, y - bw / 2, d]], [0, -1, 1]); B.poly(key, [[x0, y + bw / 2, d], [x1, y + bw / 2, d], [x1, y + bw, 0], [x0, y + bw, 0]], [0, 1, 1]); };
  for (let i = 0; i <= cols; i++) vbar(x0 + i * cw);
  for (let j = 0; j <= rows; j++) hbar(y0 + j * rh);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const cx = x0 + (i + 0.5) * cw, ty = y0 + (j + 1) * rh - bw / 2, r = cw / 2 - bw / 2, rise = Math.min(r, rh * 0.3);
    for (const s of [-1, 1]) B.poly(key, [[cx + s * r, ty - rise, d * 0.8], [cx + s * r * 0.35, ty - rise * 0.25, d * 0.8], [cx, ty, d * 0.8], [cx + s * r, ty, d * 0.8]], [0, 0, 1]);
  }
}
/** a figure for a niche or a parapet: robed standing statue with a head, shoulders and a plinth (current frame, facing +z) */
export function robedFigure(B, key, x, y, z, h = 1.8, { crown = false, staff = false, ry = 0, n = 8 } = {}) {
  const s = h / 1.8, c = Math.cos(ry), sn = Math.sin(ry), Pt = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  lathe(B, key, x, z, [[0.3 * s, y], [0.27 * s, y + 0.5 * s], [0.2 * s, y + 1.0 * s], [0.25 * s, y + 1.32 * s], [0.12 * s, y + 1.46 * s], [0.07 * s, y + 1.5 * s]], n, ry);
  lathe(B, key, x, z, [[0.07 * s, y + 1.48 * s], [0.115 * s, y + 1.56 * s], [0.12 * s, y + 1.68 * s], [0.08 * s, y + 1.77 * s], [0, y + 1.8 * s]], n, ry);
  for (const sd of [-1, 1]) { const a = Pt(sd * 0.27 * s, 0.03 * s); B.box(key, a[0], y + 1.08 * s, a[1], 0.11 * s, 0.5 * s, 0.13 * s, ry + sd * 0.12); const f = Pt(sd * 0.16 * s, 0.2 * s); B.box(key, f[0], y + 0.92 * s, f[1], 0.1 * s, 0.1 * s, 0.3 * s, ry - sd * 0.5); }
  if (crown) lathe(B, key, x, z, [[0.125 * s, y + 1.72 * s], [0.14 * s, y + 1.86 * s], [0.1 * s, y + 1.86 * s]], 8, ry);
  if (staff) { const a = Pt(0.33 * s, 0.14 * s); B.box(key, a[0], y + 0.95 * s, a[1], 0.035 * s, 1.9 * s, 0.035 * s, ry); }
}
/** a cheap rib along a polyline: a two-faced wedge standing w proud of the surface along `out(p)` (4 triangles a segment) */
export function ribStrip(B, key, pts, out, w = 0.1) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], oa = out(a), ob = out(b);
    const sx = (b[1] - a[1]) * oa[2] - (b[2] - a[2]) * oa[1], sy = (b[2] - a[2]) * oa[0] - (b[0] - a[0]) * oa[2], sz = (b[0] - a[0]) * oa[1] - (b[1] - a[1]) * oa[0], sl = Math.hypot(sx, sy, sz) || 1;
    const S = [sx / sl * w, sy / sl * w, sz / sl * w], A = [a[0] + oa[0] * w, a[1] + oa[1] * w, a[2] + oa[2] * w], Bq = [b[0] + ob[0] * w, b[1] + ob[1] * w, b[2] + ob[2] * w];
    B.poly(key, [[a[0] + S[0], a[1] + S[1], a[2] + S[2]], [b[0] + S[0], b[1] + S[1], b[2] + S[2]], Bq, A], [S[0] + oa[0], S[1] + oa[1], S[2] + oa[2]]);
    B.poly(key, [[a[0] - S[0], a[1] - S[1], a[2] - S[2]], [b[0] - S[0], b[1] - S[1], b[2] - S[2]], Bq, A], [-S[0] + oa[0], -S[1] + oa[1], -S[2] + oa[2]]);
  }
}
/** louvre slats in a window: n tilted single quads between y0 and y1 at depth z (wall frame) */
export function slats(B, key, xc, w, y0, y1, n, z = -0.3) { for (let i = 0; i < n; i++) { const y = y0 + ((i + 0.5) / n) * (y1 - y0), h = (y1 - y0) / n * 0.8; B.poly(key, [[xc - w / 2, y - h / 2, z + 0.12], [xc + w / 2, y - h / 2, z + 0.12], [xc + w / 2, y + h / 2, z - 0.12], [xc - w / 2, y + h / 2, z - 0.12]], [0, 0.6, 1]); } }
/** a rib along a polyline of 3D points (square section t) */
export function ribLine(B, key, pts, t = 0.08, h = t) { for (let i = 0; i < pts.length - 1; i++) B.beam(key, pts[i], pts[i + 1], t, h); }

export { Batch, hh, lathe, prism, pointedPts };
