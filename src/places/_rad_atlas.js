// The Radcliffe Square atlas (visual pass): ONE 2048 x 2560 canvas of 4 x 5 cells (512 px) + a half-size aux mask
// (R = glass, G = tint / weather mask), drawn through the city's atlas shader (world.atlasMaterial) so every exterior of
// the area is one material: warm Headington / Taynton ashlar, banded rustication, coursed rubble, Jacobean panelling,
// lead with rolls, slates, flags, boards, and whole-cell units (sash, round-headed, leaded, Perpendicular tracery,
// mullion-and-transom, belfry louvres, a statue niche, doors) and three bands of carved ornament (acanthus, dentils,
// egg-and-dart) and a balustrade for the middle distance. Everything is painted here; nothing is downloaded.
import * as THREE from 'three';
import { repaintableAll } from '../world/_tex_keep.js';

export const NX = 4, NY = 5, PAD = 0.016;
const CELLS = ['ashlar', 'rustic', 'rubble', 'panel', 'lead', 'slate', 'flags', 'plain', 'boards', 'sash', 'archSash', 'leaded', 'perp', 'mullion', 'door', 'archDoor', 'carve', 'balus', 'louvre', 'niche'];
export const CELL = Object.fromEntries(CELLS.map((n, i) => [n, i]));
const STONE = [208, 190, 150];   // stone pass (2026-11): was 209,184,136 — the same honey, less saturated
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;
const st = (k = 1, w = 0) => rgb(STONE[0] * k * (1 + w), STONE[1] * k, STONE[2] * k * (1 - w * 1.5));
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function newCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function grain(g, S, amp, r, blotch = 0, bs = 64) {
  let img; try { img = g.getImageData(0, 0, S, S); } catch (e) { return; }
  const d = img.data; if (!d || !d.length) return;
  const gw = Math.max(1, Math.round(S / bs)), grid = new Float32Array(gw * gw);
  for (let i = 0; i < grid.length; i++) grid[i] = r() * 2 - 1;
  for (let j = 0; j < S; j++) {
    const fy = (j / S) * gw, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty), iy1 = (iy + 1) % gw;
    for (let i = 0; i < S; i++) {
      const fx = (i / S) * gw, ix = fx | 0, tx = fx - ix, sx = tx * tx * (3 - 2 * tx), ix1 = (ix + 1) % gw;
      const A = grid[iy * gw + ix], B = grid[iy * gw + ix1], C = grid[iy1 * gw + ix], E = grid[iy1 * gw + ix1];
      const n = (r() * 2 - 1) * amp + ((A + (B - A) * sx) * (1 - sy) + (C + (E - C) * sx) * sy) * blotch;
      const k = (j * S + i) * 4;
      d[k] += n; d[k + 1] += n; d[k + 2] += n * 0.85;
    }
  }
  g.putImageData(img, 0, 0);
}
function blocks(S, r, minW, maxW) { const bs = []; let x = r() * minW; while (x < S - minW * 0.6) { bs.push(x); x += minW + r() * (maxW - minW); } return bs.map((x0, i) => [x0, i + 1 < bs.length ? bs[i + 1] : bs[0] + S]); }

// ---- tiles ------------------------------------------------------------------------------------------------------
// fine-jointed golden ashlar, 3.2 m repeat, 11 courses of 29 cm: blocks vary from cream (Clipsham patches) to orange-buff
function paintAshlar(g, S) {
  const r = rnd(71), n = 11, ch = S / n;
  g.fillStyle = st(); g.fillRect(0, 0, S, S);
  for (let c = 0; c < n; c++) {
    const y = c * ch;
    for (const [x0, x1] of blocks(S, r, ch * 1.7, ch * 3.4)) {
      const q = r(), k = q < 0.06 ? 1.07 : q < 0.14 ? 0.9 : 0.955 + r() * 0.08, w = q < 0.06 ? -0.03 : (r() - 0.45) * 0.07;
      for (const o of [0, -S]) {
        g.fillStyle = st(k, w); g.fillRect(x0 + o, y, x1 - x0, ch);
        const gr = g.createLinearGradient(0, y, 0, y + ch); gr.addColorStop(0, 'rgba(255,246,224,0.10)'); gr.addColorStop(0.5, 'rgba(255,246,224,0)'); gr.addColorStop(1, 'rgba(60,40,16,0.10)'); g.fillStyle = gr; g.fillRect(x0 + o, y, x1 - x0, ch);
        g.fillStyle = 'rgba(64,46,22,0.34)'; g.fillRect(x1 + o - 0.8, y, 1.5, ch);
        g.fillStyle = 'rgba(255,248,230,0.14)'; g.fillRect(x0 + o + 0.8, y, 1, ch);
      }
      if (r() < 0.35) { g.fillStyle = `rgba(${r() < 0.5 ? '110,84,44' : '238,226,196'},0.07)`; g.beginPath(); g.ellipse(x0 + (x1 - x0) * r(), y + ch * (0.2 + 0.6 * r()), 6 + r() * 16, 3 + r() * 6, 0, 0, 7); g.fill(); }
    }
    g.fillStyle = 'rgba(64,46,22,0.38)'; g.fillRect(0, y - 0.8, S, 1.6); if (c === 0) g.fillRect(0, S - 0.8, S, 0.8);
    g.fillStyle = 'rgba(255,248,230,0.16)'; g.fillRect(0, y + 0.8, S, 1.1);
  }
  grain(g, S, 6, r, 8, 64);
}
// banded rustication, 2.7 m repeat: 6 courses of 45 cm, deep horizontal channels and V joints, darker and rougher
function paintRustic(g, S) {
  const r = rnd(113), n = 6, ch = S / n, cw = ch * 0.17;
  g.fillStyle = st(0.86); g.fillRect(0, 0, S, S);
  for (let c = 0; c < n; c++) {
    const y = c * ch, nb = 2, bw = S / nb, off = (c % 2) * bw / 2 + r() * 8;
    for (let b = -1; b <= nb; b++) {
      const x0 = b * bw + off, k = 0.82 + r() * 0.12, w = (r() - 0.4) * 0.06;
      g.fillStyle = st(k, w); g.fillRect(x0, y + cw / 2, bw, ch - cw);
      // tooled face: light upper arris, shaded lower arris
      let gr = g.createLinearGradient(0, y + cw / 2, 0, y + ch - cw / 2);
      gr.addColorStop(0, 'rgba(255,244,214,0.30)'); gr.addColorStop(0.12, 'rgba(255,244,214,0.05)'); gr.addColorStop(0.85, 'rgba(40,26,8,0.04)'); gr.addColorStop(1, 'rgba(40,26,8,0.26)');
      g.fillStyle = gr; g.fillRect(x0, y + cw / 2, bw, ch - cw);
      for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '70,50,24' : '240,226,190'},${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(x0 + r() * bw, y + cw + r() * (ch - 2 * cw), 4 + r() * 18, 2 + r() * 5, r() * 0.6, 0, 7); g.fill(); }
      // V joint
      gr = g.createLinearGradient(x0 - cw * 0.4, 0, x0 + cw * 0.4, 0); gr.addColorStop(0, 'rgba(30,20,8,0)'); gr.addColorStop(0.4, 'rgba(30,20,8,0.62)'); gr.addColorStop(0.62, 'rgba(30,20,8,0.5)'); gr.addColorStop(1, 'rgba(255,240,205,0.14)');
      g.fillStyle = gr; g.fillRect(x0 - cw * 0.4, y + cw / 2, cw * 0.8, ch - cw);
    }
    // the channel: black under the upper block, the lower chamfer catching the light
    for (const yy of [y, y + S]) {
      const gr = g.createLinearGradient(0, yy - cw / 2, 0, yy + cw / 2); gr.addColorStop(0, 'rgba(26,17,7,0.82)'); gr.addColorStop(0.55, 'rgba(34,22,9,0.7)'); gr.addColorStop(0.75, 'rgba(120,92,52,0.5)'); gr.addColorStop(1, 'rgba(244,226,186,0.34)');
      g.fillStyle = st(0.8); g.fillRect(0, yy - cw / 2, S, cw); g.fillStyle = gr; g.fillRect(0, yy - cw / 2, S, cw);
    }
  }
  grain(g, S, 8, r, 10, 64);
}
// squared rubble brought to courses (medieval walls, St Mary's tower, the city wall), 4 m repeat
function paintRubble(g, S) {
  const r = rnd(11);
  g.fillStyle = '#8f7d5c'; g.fillRect(0, 0, S, S);
  let y = 0; const hs = []; while (S - y > 62) { const h = 18 + r() * 22; hs.push(h); y += h; } hs.push((S - y) / 2, (S - y) / 2); y = 0;
  for (const ch of hs) {
    for (const [x0, x1] of blocks(S, r, 24, 78)) {
      const k = 0.78 + r() * 0.26, w = (r() - 0.5) * 0.1, d = r() < 0.07 ? 0.82 : 1;
      for (const o of [0, -S]) {
        g.fillStyle = st(k * d, w); g.beginPath(); const j = () => (r() - 0.5) * 3;
        g.moveTo(x0 + o + 1.6 + j(), y + 1.6 + j()); g.lineTo(x1 + o - 1.6 + j(), y + 1.6 + j()); g.lineTo(x1 + o - 1.6 + j(), y + ch - 1.6 + j()); g.lineTo(x0 + o + 1.6 + j(), y + ch - 1.6 + j()); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,246,222,0.12)'; g.fillRect(x0 + o + 2, y + 2, x1 - x0 - 4, 1.3);
        g.fillStyle = 'rgba(40,28,12,0.2)'; g.fillRect(x0 + o + 2, y + ch - 3, x1 - x0 - 4, 1.5);
      }
    }
    y += ch;
  }
  grain(g, S, 8, r, 9, 64);
}
// Jacobean blind panelling (tower stages, parapets): 1.6 m repeat, 4 x 2 round-headed sunk panels with trefoil cusps
function paintPanel(g, S) {
  const r = rnd(29), nx = 4, ny = 2, pw = S / nx, ph = S / ny;
  g.fillStyle = st(1.0); g.fillRect(0, 0, S, S);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = i * pw + pw * 0.16, y = j * ph + ph * 0.1, w = pw * 0.68, h = ph * 0.8, rr = w / 2;
    const path = (c, d = 0) => { c.beginPath(); c.moveTo(x + d, y + h - d); c.lineTo(x + d, y + rr); c.arc(x + rr, y + rr, rr - d, Math.PI, 0); c.lineTo(x + w - d, y + h - d); c.closePath(); };
    path(g); g.fillStyle = st(0.74, 0.02); g.fill();
    g.save(); path(g); g.clip();
    let gr = g.createLinearGradient(0, y, 0, y + h * 0.5); gr.addColorStop(0, 'rgba(30,20,8,0.55)'); gr.addColorStop(1, 'rgba(30,20,8,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    gr = g.createLinearGradient(x, 0, x + w * 0.4, 0); gr.addColorStop(0, 'rgba(30,20,8,0.4)'); gr.addColorStop(1, 'rgba(30,20,8,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,244,214,0.3)'; g.fillRect(x, y + h - 4, w, 4); g.fillRect(x + w - 3, y + rr, 3, h);
    // cusps
    g.fillStyle = st(0.98); for (const s of [-1, 1]) { g.beginPath(); g.arc(x + rr + s * rr * 0.98, y + rr * 0.55, rr * 0.42, 0, 7); g.fill(); }
    g.restore();
  }
  for (let j = 0; j <= ny; j++) { g.fillStyle = 'rgba(64,46,22,0.3)'; g.fillRect(0, j * ph - 1, S, 2); g.fillStyle = 'rgba(255,248,230,0.2)'; g.fillRect(0, j * ph + 1, S, 1.5); }
  grain(g, S, 6, r, 6, 64);
}
// milled lead in bays: 2.4 m repeat, a wood-cored roll every 60 cm, drips across, white patina streaks
function paintLead(g, S) {
  const r = rnd(53), nb = 4, bw = S / nb;
  g.fillStyle = '#8f969c'; g.fillRect(0, 0, S, S);
  for (let b = 0; b < nb; b++) {
    const x = b * bw, t = (r() - 0.5) * 14;
    g.fillStyle = rgb(143 + t, 150 + t, 156 + t); g.fillRect(x, 0, bw, S);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${r() < 0.6 ? '226,232,236' : '70,76,84'},${0.04 + r() * 0.09})`; g.fillRect(x + r() * bw, r() * S, 1.5 + r() * 5, 20 + r() * 150); }
    const ly = ((b * 0.37 + 0.2) % 1) * S;
    for (const yy of [ly, (ly + S / 2) % S]) { g.fillStyle = 'rgba(30,34,40,0.5)'; g.fillRect(x, yy, bw, 2.2); g.fillStyle = 'rgba(236,240,244,0.3)'; g.fillRect(x, yy + 2.2, bw, 1.6); }
  }
  for (let b = 0; b <= nb; b++) {
    const x = b * bw, w = 13;
    const gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, 'rgba(24,28,34,0)'); gr.addColorStop(0.18, 'rgba(24,28,34,0.36)'); gr.addColorStop(0.36, 'rgba(240,244,248,0.6)'); gr.addColorStop(0.55, 'rgba(160,168,176,0.3)'); gr.addColorStop(0.8, 'rgba(24,28,34,0.5)'); gr.addColorStop(1, 'rgba(24,28,34,0)');
    g.fillStyle = gr; g.fillRect(x - w, 0, 2 * w, S);
  }
  grain(g, S, 5, r, 7, 64);
}
function paintSlate(g, S) {
  const r = rnd(31), rows = 14, rh = S / rows, n = 9, sw = S / n;
  g.fillStyle = '#3c4048'; g.fillRect(0, 0, S, S);
  for (let j = 0; j < rows; j++) for (let i = -1; i <= n; i++) {
    const t = r() * 28, pur = r() < 0.2 ? 9 : 0, x = i * sw + (j % 2) * sw / 2;
    g.fillStyle = rgb(86 + t + pur, 90 + t, 98 + t + pur * 0.5); g.fillRect(x + 0.7, j * rh, sw - 1.4, rh - 1.2);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 0.7, j * rh, sw - 1.4, 1.6);
    g.fillStyle = 'rgba(10,10,14,0.4)'; g.fillRect(x + 0.7, j * rh + rh - 3.2, sw - 1.4, 2);
  }
  grain(g, S, 5, r, 6, 64);
}
function paintFlags(g, S) {
  const r = rnd(23), n = 6, ch = S / n, base = [190, 176, 150];
  g.fillStyle = '#6f6656'; g.fillRect(0, 0, S, S);
  for (let c = 0; c < n; c++) for (const [x0, x1] of blocks(S, r, ch * 0.9, ch * 1.9)) {
    const k = 0.9 + r() * 0.18, w = (r() - 0.5) * 0.06;
    for (const o of [0, -S]) { g.fillStyle = rgb(base[0] * k * (1 + w), base[1] * k, base[2] * k * (1 - w)); g.fillRect(x0 + o + 1, c * ch + 1, x1 - x0 - 2, ch - 2); g.fillStyle = 'rgba(255,255,245,0.10)'; g.fillRect(x0 + o + 1, c * ch + 1, x1 - x0 - 2, 1.5); }
    if (r() < 0.3) { g.fillStyle = 'rgba(70,70,56,0.08)'; g.beginPath(); g.ellipse(x0 + r() * (x1 - x0), c * ch + r() * ch, 8 + r() * 20, 5 + r() * 10, r() * 3, 0, 7); g.fill(); }
  }
  grain(g, S, 6, r, 7, 64);
}
function paintBoards(g, S) {
  const r = rnd(5), n = 8, bw = S / n;
  for (let i = 0; i < n; i++) {
    const t = r() * 22;
    g.fillStyle = rgb(206 + t, 204 + t, 200 + t); g.fillRect(i * bw, 0, bw, S);
    for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(90,70,50,${0.04 + r() * 0.06})`; g.fillRect(i * bw + 3 + r() * (bw - 6), 0, 1 + r() * 1.5, S); }
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(i * bw + 2, 0, 2.5, S);
    g.fillStyle = 'rgba(30,24,18,0.62)'; g.fillRect(i * bw - 1, 0, 2.4, S);
  }
  grain(g, S, 4, r, 4, 64);
}
// carved ornament, 0.8 m repeat sideways, three bands: acanthus leaves (top half), dentils, egg-and-dart
function paintCarve(g, S) {
  const r = rnd(91), H = S / 2;
  g.fillStyle = st(0.98); g.fillRect(0, 0, S, S);
  // acanthus: two tiers of five leaves, the upper tier curling over (light tips, deep shadow between)
  g.fillStyle = st(0.5); g.fillRect(0, 0, S, H);
  const leaf = (cx, y0, w, h, k) => {
    g.fillStyle = st(k); g.beginPath(); g.moveTo(cx - w / 2, y0 + h); g.bezierCurveTo(cx - w * 0.62, y0 + h * 0.45, cx - w * 0.5, y0 + h * 0.12, cx, y0); g.bezierCurveTo(cx + w * 0.5, y0 + h * 0.12, cx + w * 0.62, y0 + h * 0.45, cx + w / 2, y0 + h); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,26,8,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, y0 + h); g.lineTo(cx, y0 + h * 0.22); for (const s of [-1, 1]) for (const t of [0.35, 0.55, 0.75]) { g.moveTo(cx, y0 + h * (t + 0.12)); g.lineTo(cx + s * w * 0.36, y0 + h * t); } g.stroke();
    const gr = g.createLinearGradient(0, y0, 0, y0 + h * 0.3); gr.addColorStop(0, 'rgba(255,248,224,0.75)'); gr.addColorStop(1, 'rgba(255,248,224,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, y0 + h * 0.13, w * 0.36, h * 0.14, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(30,18,6,0.4)'; g.beginPath(); g.ellipse(cx, y0 + h * 0.31, w * 0.3, h * 0.05, 0, 0, 7); g.fill();
  };
  const nl = 5, lw = S / nl;
  for (let i = -1; i <= nl; i++) leaf((i + 0.5) * lw + lw / 2, 6, lw * 1.02, H * 0.6, 0.9 + r() * 0.06);
  for (let i = -1; i <= nl; i++) leaf((i + 0.5) * lw, H * 0.4, lw * 1.06, H * 0.6, 1.0 + r() * 0.06);
  // dentils
  const y1 = H, h1 = S / 4;
  g.fillStyle = st(0.42); g.fillRect(0, y1, S, h1);
  g.fillStyle = st(1.02); g.fillRect(0, y1, S, h1 * 0.2); g.fillRect(0, y1 + h1 * 0.84, S, h1 * 0.16);
  const nd = 8, dw = S / nd;
  for (let i = 0; i < nd; i++) { g.fillStyle = st(1.04); g.fillRect(i * dw + dw * 0.14, y1 + h1 * 0.2, dw * 0.62, h1 * 0.56); g.fillStyle = 'rgba(255,248,224,0.4)'; g.fillRect(i * dw + dw * 0.14, y1 + h1 * 0.2, dw * 0.1, h1 * 0.56); g.fillStyle = 'rgba(30,18,6,0.4)'; g.fillRect(i * dw + dw * 0.14, y1 + h1 * 0.7, dw * 0.62, h1 * 0.06); }
  g.fillStyle = 'rgba(30,18,6,0.5)'; g.fillRect(0, y1 + h1 * 0.2, S, 3);
  // egg and dart
  const y2 = S * 0.75, h2 = S / 4, ne = 6, ew = S / ne;
  g.fillStyle = st(0.5); g.fillRect(0, y2, S, h2);
  g.fillStyle = st(1.03); g.fillRect(0, y2, S, h2 * 0.14); g.fillRect(0, y2 + h2 * 0.88, S, h2 * 0.12);
  for (let i = 0; i < ne; i++) {
    const cx = (i + 0.5) * ew, cy = y2 + h2 * 0.48;
    g.fillStyle = st(1.05); g.beginPath(); g.ellipse(cx, cy, ew * 0.3, h2 * 0.33, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,250,230,0.5)'; g.beginPath(); g.ellipse(cx - ew * 0.08, cy - h2 * 0.1, ew * 0.12, h2 * 0.14, 0, 0, 7); g.fill();
    g.fillStyle = st(0.95); g.beginPath(); g.moveTo(i * ew - 4, y2 + h2 * 0.16); g.lineTo(i * ew + 4, y2 + h2 * 0.16); g.lineTo(i * ew, y2 + h2 * 0.84); g.fill();
  }
  grain(g, S, 5, r, 4, 64);
}
// a balustrade seen against the dark behind it: four vase balusters per 1.2 m repeat (middle-distance stand-in)
function paintBalus(g, S) {
  const r = rnd(17), n = 4, bw = S / n;
  g.fillStyle = '#2b2620'; g.fillRect(0, 0, S, S);
  const P = [[0.0, 0.3], [0.05, 0.3], [0.07, 0.17], [0.16, 0.14], [0.3, 0.22], [0.5, 0.33], [0.62, 0.34], [0.74, 0.26], [0.86, 0.14], [0.93, 0.2], [0.95, 0.3], [1.0, 0.3]];
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * bw;
    g.beginPath(); P.forEach(([t, w], k) => { const x = cx - w * bw, y = t * S; if (k) g.lineTo(x, y); else g.moveTo(x, y); }); for (let k = P.length - 1; k >= 0; k--) g.lineTo(cx + P[k][1] * bw, P[k][0] * S); g.closePath();
    const gr = g.createLinearGradient(cx - bw * 0.34, 0, cx + bw * 0.34, 0); gr.addColorStop(0, st(0.92)); gr.addColorStop(0.3, st(1.12)); gr.addColorStop(0.7, st(0.86)); gr.addColorStop(1, st(0.6));
    g.fillStyle = gr; g.fill();
  }
  grain(g, S, 5, r, 4, 64);
}

// ---- units ------------------------------------------------------------------------------------------------------
const GLASS_A = 'rgb(255,0,0)', OFF_A = 'rgb(0,0,0)', STONE_A = 'rgb(0,255,0)', CAME_A = 'rgb(90,0,0)';
function glassFill(g, a, x, y, w, h) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#8797a5'); gr.addColorStop(0.4, '#5a6a79'); gr.addColorStop(1, '#38434e');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(x + w * 0.05, y); g.lineTo(x + w * 0.4, y); g.lineTo(x + w * 0.1, y + h); g.lineTo(x - w * 0.25, y + h); g.closePath(); g.fill();
  g.restore();
  a.fillStyle = GLASS_A; a.fillRect(x, y, w, h);
}
/** diamond leading over a clipped region (call inside a clip) */
function cames(g, a, S, d) {
  for (const c of [g, a]) {
    c.strokeStyle = c === g ? 'rgba(24,24,26,0.85)' : CAME_A; c.lineWidth = Math.max(1.2, S * 0.007); c.beginPath();
    for (let k = -16; k < 32; k++) { c.moveTo(k * d, 0); c.lineTo(k * d + S / 1.5, S); c.moveTo(k * d, 0); c.lineTo(k * d - S / 1.5, S); }
    c.stroke();
  }
}
const topShade = (g, S, f = 0.2, k = 0.5) => { const gr = g.createLinearGradient(0, 0, 0, S * f); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S * f); };
/** fill a path on both canvases */
const both = (g, a, path, fg, fa) => { for (const c of [g, a]) { c.beginPath(); path(c); c.fillStyle = c === g ? fg : fa; c.fill(); } };
/** joinery painted a light neutral with aux G = 1: the vertex tint colours it (white sashes, black iron, oak) */
function paintSash(g, a, S, cols, rows) {
  const F = S * 0.045, f = S * 0.03, bw = S * 0.014, J = '#e9e6dc';
  g.fillStyle = J; g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const x = F, y = F, w = S - 2 * F, h = S - 2 * F - S * 0.012;
  glassFill(g, a, x, y, w, h);
  g.fillStyle = 'rgba(232,224,204,0.5)'; g.fillRect(x, y, w, h * 0.16); g.fillStyle = 'rgba(20,24,30,0.22)'; g.fillRect(x, y + h * 0.3, w, h * 0.7);
  const bar = (bx, by, bW, bH) => { g.fillStyle = J; g.fillRect(bx, by, bW, bH); a.fillStyle = STONE_A; a.fillRect(bx, by, bW, bH); g.fillStyle = 'rgba(0,0,0,0.16)'; if (bW > bH) g.fillRect(bx, by + bH - 1.2, bW, 1.2); else g.fillRect(bx + bW - 1.2, by, 1.2, bH); };
  for (let s = 0; s < 2; s++) {
    const sy = y + (s * h) / 2, sh = h / 2;
    bar(x, sy, f, sh); bar(x + w - f, sy, f, sh); bar(x, sy, w, s ? f * 1.25 : f); bar(x, sy + sh - (s ? f * 1.5 : f), w, s ? f * 1.5 : f);
    for (let i = 1; i < cols; i++) bar(x + f + ((w - 2 * f) * i) / cols - bw / 2, sy + f, bw, sh - 2 * f);
    for (let j = 1; j < rows; j++) bar(x + f, sy + f + ((sh - 2.2 * f) * j) / rows - bw / 2, w - 2 * f, bw);
  }
  topShade(g, S, 0.13, 0.46);
  const gr = g.createLinearGradient(0, 0, S * 0.14, 0); gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
}
/** round-headed window of small panes (the head is the top quarter of the cell): a fan of bars in the head */
function paintArchSash(g, a, S) {
  const F = S * 0.04, f = S * 0.026, bw = S * 0.013, ys = S * 0.25, cx = S / 2, J = '#e9e6dc';
  g.fillStyle = J; g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const head = (c, inset) => { c.beginPath(); c.moveTo(inset, S - F); c.lineTo(inset, ys); c.ellipse(cx, ys, cx - inset, ys - inset * 0.5, 0, Math.PI, 0); c.lineTo(S - inset, S - F); c.closePath(); };
  g.save(); a.save(); head(g, F); g.clip(); head(a, F); a.clip();
  glassFill(g, a, 0, 0, S, S); g.fillStyle = 'rgba(20,24,30,0.2)'; g.fillRect(0, S * 0.4, S, S * 0.6);
  g.restore(); a.restore();
  const bar = (bx, by, bW, bH) => { g.fillStyle = J; g.fillRect(bx, by, bW, bH); a.fillStyle = STONE_A; a.fillRect(bx, by, bW, bH); };
  for (let i = 1; i < 4; i++) bar(F + ((S - 2 * F) * i) / 4 - bw / 2, ys * 0.5, bw, S - F - ys * 0.5);
  for (let j = 0; j <= 5; j++) bar(F, ys + ((S - F - ys) * j) / 6 - bw / 2, S - 2 * F, j === 3 ? f : bw);
  bar(F, S - F - f, S - 2 * F, f); bar(F, ys, f, S - F - ys); bar(S - F - f, ys, f, S - F - ys);
  for (const c of [g, a]) {
    c.strokeStyle = c === g ? J : STONE_A; c.lineWidth = bw;
    c.beginPath(); c.ellipse(cx, ys, (cx - F) * 0.42, (ys - F * 0.5) * 0.42, 0, Math.PI, 0); c.stroke();
    for (const ang of [-1.05, -0.52, 0.52, 1.05]) { c.beginPath(); c.moveTo(cx + Math.sin(ang) * (cx - F) * 0.42, ys - Math.cos(ang) * (ys - F * 0.5) * 0.42); c.lineTo(cx + Math.sin(ang) * (cx - F), ys - Math.cos(ang) * (ys - F * 0.5)); c.stroke(); }
    c.lineWidth = f * 1.5; c.beginPath(); c.ellipse(cx, ys, cx - F - f * 0.4, ys - F * 0.5 - f * 0.4, 0, Math.PI, 0); c.stroke();
  }
  topShade(g, S, 0.3, 0.42);
}
function paintLeaded(g, a, S) {
  glassFill(g, a, 0, 0, S, S);
  g.fillStyle = 'rgba(20,24,30,0.2)'; g.fillRect(0, S * 0.3, S, S * 0.7);
  cames(g, a, S, S / 9);
  topShade(g, S, 0.2, 0.5);
}
/** Perpendicular window: a four-centred head, four cinquefoiled lights in two tiers, panel tracery; stone = tint mask */
function paintPerp(g, a, S, lights = 4) {
  const r = rnd(7), m = S * 0.05, ys = S * 0.3, ya = S * 0.035, w = S - 2 * m, lw = w / lights, mw = S * 0.026;
  g.fillStyle = st(1.0); g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const arch = (c, d = 0) => { c.moveTo(m + d, S - m * 0.6); c.lineTo(m + d, ys); c.bezierCurveTo(m + d, ys - (ys - ya) * 0.62, m + w * 0.2, ya + d + (ys - ya) * 0.14, S / 2, ya + d); c.bezierCurveTo(S - m - w * 0.2, ya + d + (ys - ya) * 0.14, S - m - d, ys - (ys - ya) * 0.62, S - m - d, ys); c.lineTo(S - m - d, S - m * 0.6); c.closePath(); };
  // hood mould and the chamfered reveal
  g.strokeStyle = 'rgba(48,32,12,0.55)'; g.lineWidth = S * 0.02; g.beginPath(); arch(g, -S * 0.022); g.stroke();
  g.strokeStyle = 'rgba(255,246,222,0.45)'; g.lineWidth = S * 0.008; g.beginPath(); arch(g, -S * 0.034); g.stroke();
  g.save(); a.save(); for (const c of [g, a]) { c.beginPath(); arch(c); c.clip(); }
  glassFill(g, a, 0, 0, S, S); g.fillStyle = 'rgba(16,20,26,0.25)'; g.fillRect(0, S * 0.25, S, S * 0.75);
  cames(g, a, S, S / 14);
  const stone = (path) => both(g, a, path, st(1.02), STONE_A);
  const tiers = [[ys, S * 0.63], [S * 0.63 + mw, S - m * 0.6]];
  // tracery: the head filled with stone, pierced by narrow panel lights with pointed heads
  stone((c) => c.rect(0, 0, S, ys));
  for (let i = 0; i < lights * 2; i++) {
    const x0 = m + (i + 0.16) * (lw / 2), pw = lw / 2 * 0.68, top = ya + (ys - ya) * (0.24 + 0.52 * Math.abs((i + 0.5) / lights - 1) ** 1.6), bot = ys - mw * 0.9;
    if (bot - top < S * 0.03) continue;
    both(g, a, (c) => { c.moveTo(x0, bot); c.lineTo(x0, top + pw * 0.5); c.quadraticCurveTo(x0 + pw * 0.1, top + pw * 0.1, x0 + pw / 2, top); c.quadraticCurveTo(x0 + pw * 0.9, top + pw * 0.1, x0 + pw, top + pw * 0.5); c.lineTo(x0 + pw, bot); c.closePath(); }, '#55616d', GLASS_A);
  }
  // mullions, transom, cusped heads of the lights
  for (let i = 1; i < lights; i++) stone((c) => c.rect(m + i * lw - mw / 2, ya, mw, S));
  stone((c) => c.rect(0, tiers[0][1], S, mw)); stone((c) => c.rect(0, ys - mw, S, mw));
  for (const [t0] of tiers) for (let i = 0; i < lights; i++) {
    const x0 = m + i * lw + mw / 2, ww = lw - mw, hh = ww * 0.62, y0 = t0 + (t0 === ys ? 0 : 0);
    stone((c) => c.rect(x0, y0, ww, hh));
    both(g, a, (c) => { c.moveTo(x0, y0 + hh); c.quadraticCurveTo(x0 + ww * 0.04, y0 + hh * 0.34, x0 + ww / 2, y0 + hh * 0.06); c.quadraticCurveTo(x0 + ww * 0.96, y0 + hh * 0.34, x0 + ww, y0 + hh); c.closePath(); }, '#5d6975', GLASS_A);
    for (const s of [-1, 1]) for (const [fx, fy, fr] of [[0.33, 0.6, 0.11], [0.2, 0.86, 0.09]]) stone((c) => c.arc(x0 + ww / 2 + s * ww * fx, y0 + hh * fy, ww * fr, 0, 7));
  }
  // light and shade on the stonework: every bar lit on the left, shadowed on the right; a deep shadow under the head
  g.fillStyle = 'rgba(30,18,6,0.4)'; for (let i = 1; i < lights; i++) g.fillRect(m + i * lw + mw / 2 - 2, ya, 3, S);
  g.fillStyle = 'rgba(255,248,226,0.35)'; for (let i = 1; i < lights; i++) g.fillRect(m + i * lw - mw / 2, ya, 2, S);
  g.fillStyle = 'rgba(30,18,6,0.4)'; g.fillRect(0, tiers[0][1] + mw - 2, S, 4);
  const gr = g.createLinearGradient(m, 0, m + S * 0.09, 0); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(m, 0, S * 0.09, S);
  topShade(g, S, 0.16, 0.35);
  g.restore(); a.restore();
  // sill
  g.fillStyle = st(1.08); g.fillRect(m * 0.4, S - m * 0.6, S - m * 0.8, m * 0.6); g.fillStyle = 'rgba(30,18,6,0.4)'; g.fillRect(m * 0.4, S - 2, S - m * 0.8, 2);
  void r;
}
/** Jacobean mullion-and-transom window under a label mould: four round-headed lights over four square ones */
function paintMullion(g, a, S) {
  const m = S * 0.07, top = S * 0.1, lights = 4, w = S - 2 * m, lw = w / lights, mw = S * 0.034, ty = S * 0.44;
  g.fillStyle = st(1.0); g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  // label (hood) mould with dropped ends
  g.fillStyle = st(1.1); g.fillRect(m * 0.3, top * 0.3, S - m * 0.6, top * 0.42); g.fillRect(m * 0.3, top * 0.3, m * 0.5, top * 1.5); g.fillRect(S - m * 0.8, top * 0.3, m * 0.5, top * 1.5);
  g.fillStyle = 'rgba(30,18,6,0.5)'; g.fillRect(m * 0.3, top * 0.72, S - m * 0.6, top * 0.16);
  g.save(); a.save(); for (const c of [g, a]) { c.beginPath(); c.rect(m, top, w, S - top - m * 0.7); c.clip(); }
  glassFill(g, a, 0, 0, S, S); g.fillStyle = 'rgba(16,20,26,0.25)'; g.fillRect(0, S * 0.3, S, S * 0.7);
  cames(g, a, S, S / 13);
  const stone = (path) => both(g, a, path, st(1.03), STONE_A);
  for (let i = 1; i < lights; i++) stone((c) => c.rect(m + i * lw - mw / 2, 0, mw, S));
  stone((c) => c.rect(0, ty, S, mw));
  for (let i = 0; i < lights; i++) { const x0 = m + i * lw + (i ? mw / 2 : 0), ww = lw - (i && i < lights - 1 ? mw : mw / 2), hh = ww * 0.36; stone((c) => c.rect(x0, top, ww, hh)); both(g, a, (c) => { c.ellipse(x0 + ww / 2, top + hh, ww / 2, hh * 0.9, 0, Math.PI, 0); c.closePath(); }, '#66727e', GLASS_A); }
  g.fillStyle = 'rgba(30,18,6,0.4)'; for (let i = 1; i < lights; i++) g.fillRect(m + i * lw + mw / 2 - 2, 0, 3, S);
  g.fillStyle = 'rgba(255,248,226,0.35)'; for (let i = 1; i < lights; i++) g.fillRect(m + i * lw - mw / 2, 0, 2, S);
  g.fillStyle = 'rgba(30,18,6,0.4)'; g.fillRect(0, ty + mw - 2, S, 4);
  let gr = g.createLinearGradient(m, 0, m + S * 0.08, 0); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(m, 0, S * 0.08, S);
  gr = g.createLinearGradient(0, top, 0, top + S * 0.12); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, top, S, S * 0.12);
  g.restore(); a.restore();
  g.strokeStyle = 'rgba(48,32,12,0.5)'; g.lineWidth = 3; g.strokeRect(m - 1.5, top - 1.5, w + 3, S - top - m * 0.7 + 3);
  g.fillStyle = st(1.1); g.fillRect(m * 0.5, S - m * 0.7, S - m, m * 0.5);
}
/** belfry opening: two pointed lights under a quatrefoil, louvred */
function paintLouvre(g, a, S) {
  const m = S * 0.06, ys = S * 0.34, ya = S * 0.03, w = S - 2 * m;
  g.fillStyle = st(1.0); g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const arch = (c, x0, x1, s, t, d = 0) => { const cx = (x0 + x1) / 2; c.moveTo(x0 + d, S - m); c.lineTo(x0 + d, s); c.quadraticCurveTo(x0 + d, t + (s - t) * 0.3, cx, t + d); c.quadraticCurveTo(x1 - d, t + (s - t) * 0.3, x1 - d, s); c.lineTo(x1 - d, S - m); c.closePath(); };
  g.strokeStyle = 'rgba(48,32,12,0.55)'; g.lineWidth = S * 0.022; g.beginPath(); arch(g, m, S - m, ys, ya, -S * 0.02); g.stroke();
  both(g, a, (c) => arch(c, m, S - m, ys, ya), st(0.84), STONE_A);
  const mw = S * 0.05, lx = [[m + mw * 0.6, S / 2 - mw / 2], [S / 2 + mw / 2, S - m - mw * 0.6]];
  for (const [x0, x1] of lx) {
    g.save(); a.save(); for (const c of [g, a]) { c.beginPath(); arch(c, x0, x1, ys + S * 0.06, ys - S * 0.1); c.clip(); }
    g.fillStyle = '#17140f'; g.fillRect(0, 0, S, S); a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
    for (let y = ys - S * 0.08; y < S; y += S * 0.052) { const gr = g.createLinearGradient(0, y, 0, y + S * 0.03); gr.addColorStop(0, 'rgba(150,140,118,0.75)'); gr.addColorStop(1, 'rgba(60,54,44,0.5)'); g.fillStyle = gr; g.fillRect(0, y, S, S * 0.028); }
    const gr = g.createLinearGradient(x0, 0, x0 + S * 0.1, 0); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x0, 0, S * 0.1, S);
    g.restore(); a.restore();
  }
  // quatrefoil in the head
  both(g, a, (c) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.moveTo(S / 2 + dx * S * 0.045 + S * 0.05, ys * 0.5 + dy * S * 0.045); c.arc(S / 2 + dx * S * 0.045, ys * 0.5 + dy * S * 0.045, S * 0.05, 0, 7); } }, '#17140f', OFF_A);
  g.fillStyle = st(1.08); g.fillRect(m * 0.4, S - m, S - m * 0.8, m * 0.5);
}
/** a shell-headed niche with a draped figure (pinnacle statues, the porch) */
function paintNiche(g, a, S) {
  const m = S * 0.1, ys = S * 0.3, cx = S / 2, rr = cx - m;
  g.fillStyle = st(1.0); g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const path = (c) => { c.moveTo(m, S * 0.94); c.lineTo(m, ys); c.arc(cx, ys, rr, Math.PI, 0); c.lineTo(S - m, S * 0.94); c.closePath(); };
  g.save(); g.beginPath(); path(g); g.clip();
  let gr = g.createLinearGradient(m, 0, S - m, 0); gr.addColorStop(0, '#2a2118'); gr.addColorStop(0.5, '#6f5c40'); gr.addColorStop(1, '#3a2e20'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(20,12,4,0.5)'; g.lineWidth = 3; for (let k = 0; k <= 8; k++) { const t = Math.PI * (1 + k / 8); g.beginPath(); g.moveTo(cx, ys); g.lineTo(cx + Math.cos(t) * rr, ys + Math.sin(t) * rr); g.stroke(); }
  gr = g.createLinearGradient(0, 0, 0, ys); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0.1)'); g.fillStyle = gr; g.fillRect(0, 0, S, ys);
  // the figure
  const fg = (k) => st(k, -0.01);
  g.fillStyle = fg(0.9); g.beginPath(); g.moveTo(cx - S * 0.2, S * 0.9); g.bezierCurveTo(cx - S * 0.22, S * 0.6, cx - S * 0.2, S * 0.42, cx - S * 0.13, S * 0.36); g.lineTo(cx + S * 0.13, S * 0.36); g.bezierCurveTo(cx + S * 0.2, S * 0.42, cx + S * 0.22, S * 0.6, cx + S * 0.2, S * 0.9); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(40,26,8,0.4)'; g.lineWidth = 4; for (const fx of [-0.11, -0.04, 0.04, 0.12]) { g.beginPath(); g.moveTo(cx + S * fx * 0.6, S * 0.46); g.quadraticCurveTo(cx + S * fx * 1.3, S * 0.7, cx + S * fx, S * 0.9); g.stroke(); }
  g.fillStyle = fg(1.0); g.beginPath(); g.ellipse(cx, S * 0.29, S * 0.07, S * 0.085, 0, 0, 7); g.fill();
  g.fillStyle = fg(0.8); g.beginPath(); g.ellipse(cx + S * 0.03, S * 0.52, S * 0.1, S * 0.05, -0.5, 0, 7); g.fill();
  gr = g.createLinearGradient(cx - S * 0.2, 0, cx + S * 0.2, 0); gr.addColorStop(0, 'rgba(255,248,226,0.25)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; g.fillRect(cx - S * 0.22, S * 0.2, S * 0.44, S * 0.72);
  g.fillStyle = st(1.05); g.fillRect(m, S * 0.9, S - 2 * m, S * 0.04);
  g.restore();
  g.strokeStyle = 'rgba(48,32,12,0.5)'; g.lineWidth = S * 0.016; g.beginPath(); path(g); g.stroke();
}
function doorLeaves(g, a, x, y, w, h, leaves) {
  g.fillStyle = '#cfcfcf'; g.fillRect(x, y, w, h); a.fillStyle = STONE_A; a.fillRect(x, y, w, h);
  const lw = w / leaves;
  for (let l = 0; l < leaves; l++) {
    const lx = x + l * lw;
    for (const [py, ph] of [[0.05, 0.2], [0.29, 0.3], [0.63, 0.31]]) for (const [px, pw] of [[0.11, 0.34], [0.55, 0.34]]) {
      const X = lx + lw * px, Y = y + h * py, Wd = lw * pw, Hh = h * ph;
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(X, Y, Wd, Hh); g.fillStyle = '#c4c4c4'; g.fillRect(X + 4, Y + 5, Wd - 8, Hh - 9);
      g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(X + 4, Y + Hh - 5, Wd - 8, 2.5); g.fillRect(X + Wd - 5, Y + 5, 2, Hh - 9);
    }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(lx - 1, y, 2, h);
  }
  const gr = g.createLinearGradient(0, y + h * 0.8, 0, y + h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)'); g.fillStyle = gr; g.fillRect(x, y + h * 0.8, w, h * 0.2);
}
function paintDoor(g, a, S) { doorLeaves(g, a, 0, 0, S, S, 2); topShade(g, S, 0.12, 0.5); }
function paintArchDoor(g, a, S) {
  const ys = S * 0.25, cx = S / 2, F = S * 0.04;
  g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  g.save(); a.save();
  for (const c of [g, a]) { c.beginPath(); c.ellipse(cx, ys - F * 0.6, cx - F, ys - F * 1.2, 0, Math.PI, 0); c.closePath(); c.clip(); }
  glassFill(g, a, 0, 0, S, ys); g.fillStyle = 'rgba(20,24,30,0.3)'; g.fillRect(0, 0, S, ys);
  g.restore(); a.restore();
  for (const c of [g, a]) {
    c.strokeStyle = c === g ? '#cfcfcf' : STONE_A; c.lineWidth = S * 0.016;
    for (const ang of [-1.05, -0.52, 0, 0.52, 1.05]) { c.beginPath(); c.moveTo(cx, ys - F * 0.6); c.lineTo(cx + Math.sin(ang) * (cx - F), ys - F * 0.6 - Math.cos(ang) * (ys - F * 1.2)); c.stroke(); }
  }
  doorLeaves(g, a, F, ys + F * 0.3, S - 2 * F, S - ys - F * 0.3, 2);
  topShade(g, S, 0.3, 0.45);
}

let ATLAS = null;
function paintAtlas() {
  if (ATLAS) return ATLAS;
  const CS = 512, AS = 256;
  const c = newCanvas(NX * CS, NY * CS), g = c.getContext('2d'), ac = newCanvas(NX * AS, NY * AS), a = ac.getContext('2d');
  a.fillStyle = STONE_A; a.fillRect(0, 0, NX * AS, NY * AS);
  const pad = PAD * CS, span = CS - 2 * pad;
  const tile = (name, paint) => {
    const i = CELL[name], x = (i % NX) * CS, y = Math.floor(i / NX) * CS, t = newCanvas(CS), tg = t.getContext('2d');
    paint(tg, CS);
    g.save(); g.beginPath(); g.rect(x, y, CS, CS); g.clip();
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) g.drawImage(t, x + pad + dx * span, y + pad + dy * span, span, span);
    g.restore();
  };
  const unit = (name, paint) => {
    const i = CELL[name], x = (i % NX) * CS, y = Math.floor(i / NX) * CS;
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, CS, CS); g.clip();
    a.save(); a.translate((i % NX) * AS, Math.floor(i / NX) * AS); a.beginPath(); a.rect(0, 0, AS, AS); a.clip(); a.scale(AS / CS, AS / CS);
    paint(g, a, CS);
    g.restore(); a.restore();
  };
  tile('ashlar', paintAshlar); tile('rustic', paintRustic); tile('rubble', paintRubble); tile('panel', paintPanel);
  tile('lead', paintLead); tile('slate', paintSlate); tile('flags', paintFlags); tile('boards', paintBoards);
  tile('plain', (t, S) => { t.fillStyle = '#ffffff'; t.fillRect(0, 0, S, S); });
  tile('carve', paintCarve); tile('balus', paintBalus);
  // the balustrade's gaps are not stone: no tint there
  { const i = CELL.balus; a.fillStyle = STONE_A; a.fillRect((i % NX) * AS, Math.floor(i / NX) * AS, AS, AS); }
  unit('sash', (gg, aa, S) => paintSash(gg, aa, S, 3, 2)); unit('archSash', paintArchSash); unit('leaded', paintLeaded);
  unit('perp', paintPerp); unit('mullion', paintMullion); unit('louvre', paintLouvre); unit('niche', paintNiche);
  unit('door', paintDoor); unit('archDoor', paintArchDoor);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  const aux = new THREE.CanvasTexture(ac);
  aux.colorSpace = THREE.NoColorSpace; aux.wrapS = aux.wrapT = THREE.RepeatWrapping; aux.minFilter = THREE.LinearMipmapLinearFilter; aux.magFilter = THREE.LinearFilter;
  const again = () => { const k = ATLAS; ATLAS = null; try { return paintAtlas(); } finally { ATLAS = k; } };      // (memory pass: painted again by this function, its cache set aside for the call, if the card ever needs the picture again: world/_tex_keep.js)
  return (ATLAS = repaintableAll({ tex, aux }, again, 'radcliffe atlas'));
}

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
let PACK = null;
/**
 * The pack for Batch.build: cells = Map(key -> {cell, rx, ry, ox, oy, tint, seed}). Tiles take UVs in metres; units take
 * 0..1 across the opening (+ an integer bay = which window it is for the night lighting); the ornament bands ('leaf',
 * 'dentil', 'egg') and 'balus' take u in metres and v 0..1 across the band.
 */
export function radPack(world) {
  if (PACK) return PACK;
  const { tex, aux } = paintAtlas();
  const K = new Map();
  const add = (key, name, m, tint = 0xffffff, o = {}) => K.set(key, { cell: CELL[name], rx: m ? 1 / m : 0, ry: m ? 1 / m : 0, ox: 0, oy: 0, tint: Array.isArray(tint) ? tint : lin(tint), seed: 0, ...o });
  // masonry
  add('stone', 'ashlar', 3.2); add('radHoney', 'ashlar', 3.2, [1.05, 1.02, 0.95]);
  add('radPale', 'ashlar', 3.2, [1.13, 1.12, 1.08]); add('stoneDress', 'ashlar', 3.2, [1.1, 1.09, 1.06]);
  add('radWarm', 'ashlar', 3.2, [0.97, 0.9, 0.78]);                // weathered, sootier stone (drum, old work)
  add('stoneLit', 'ashlar', 3.2, [1.42, 1.36, 1.26]);              // under cover: bounce light
  add('stoneIn', 'ashlar', 3.2, [1.16, 1.08, 0.94]);                // interiors (the Divinity School): warm, lit by lamps
  add('radGroove', 'ashlar', 3.2, [0.42, 0.37, 0.3]);              // shadowed recesses, the backs of niches
  add('radShade', 'plain', 1, [0.085, 0.07, 0.052]);               // deep shadow (open arches, slots)
  add('rustic', 'rustic', 2.7, [1.08, 1.04, 0.96]); add('rusticDk', 'rustic', 2.7, [0.95, 0.92, 0.85]);
  add('rubble', 'rubble', 4, 0xffffff, { seed: 1.5 }); add('rubblePale', 'rubble', 4, [1.12, 1.1, 1.04], { seed: 1.5 });
  add('panel', 'panel', 1.6); add('panelPale', 'panel', 1.6, [1.1, 1.09, 1.05]);
  // ornament bands
  add('leaf', 'carve', 0.8, [1.1, 1.09, 1.05], { ry: 0.46, oy: 0.52 }); add('dentil', 'carve', 0.8, [1.1, 1.09, 1.05], { ry: 0.21, oy: 0.27 }); add('egg', 'carve', 0.8, [1.1, 1.09, 1.05], { ry: 0.21, oy: 0.02 });
  add('balus', 'balus', 1.2, [1.1, 1.09, 1.05], { ry: 0.96, oy: 0.02 });
  // roofs, floors
  add('radLead', 'lead', 2.4, [0.74, 0.76, 0.8]); add('radLeadLt', 'lead', 2.4, [1.12, 1.14, 1.17]); add('lead', 'lead', 2.4);
  add('leadFlat', 'plain', 1, 0x7d8388);
  add('slate', 'slate', 2.4); add('pavingSolid', 'flags', 3); add('flags', 'flags', 3); add('pavingLit', 'flags', 3, [1.5, 1.34, 1.08]);
  // plain colours
  add('plaster', 'plain', 1, 0xe2d6be); add('plasterLit', 'plain', 1, [0.92, 0.86, 0.74]); add('white', 'plain', 1, 0xeeeae0);
  add('iron', 'plain', 1, 0x1c1d20); add('dark', 'plain', 1, 0x0c0c0d); add('gold', 'plain', 1, 0xc9a54a); add('grey', 'plain', 1, 0x8e9396);
  add('radBronze', 'plain', 1, [0.13, 0.085, 0.045]); add('radNavy', 'plain', 1, [0.018, 0.03, 0.11]); add('bronzeLt', 'plain', 1, [0.2, 0.15, 0.08]);
  add('statue', 'plain', 1, [0.72, 0.64, 0.5]); add('statueLead', 'plain', 1, [0.3, 0.32, 0.35]); add('statueDk', 'plain', 1, [0.5, 0.44, 0.34]);
  add('boards', 'boards', 1, 0xa9aeb3); add('wood', 'boards', 1, 0xa98a62); add('oak', 'boards', 1, 0x5a4230);
  // glazing + doors (whole-cell units)
  add('sash', 'sash', 1, 0xf2efe6); add('sashDark', 'sash', 1, 0x2a2c2e);
  add('archSash', 'archSash', 1, 0xf2efe6); add('archIron', 'archSash', 1, 0x26282a);
  add('leaded', 'leaded', 1); add('perp', 'perp', 1, [1.0, 0.985, 0.95]); add('mullion', 'mullion', 1, [1.0, 0.985, 0.95]);
  add('louvre', 'louvre', 1, [1.0, 0.985, 0.95]); add('niche', 'niche', 1, [1.06, 1.04, 1.0]);
  add('doorOak', 'door', 1, 0x6a4a30); add('doorDark', 'door', 1, 0x1e2622); add('doorNavy', 'door', 1, [0.03, 0.05, 0.16]);
  add('archDoor', 'archDoor', 1, 0x1e2622); add('archDoorOak', 'archDoor', 1, 0x6a4a30);
  add('glassDark', 'leaded', 0, 0xffffff, { ox: 0.5, oy: 0.6 });
  const atlas = world.atlasMaterial({ map: tex, aux, n: NX, ny: NY, ao: true, weather: true, weatherCells: 4, windows: true, roughness: 0.9, name: 'radcliffe-atlas', surf: world.surf && world.surf.kit(CELLS) });
  PACK = { atlas, cells: K, ground: null, groundCells: null, glow: null, glowCells: null, nCells: CELLS.length };
  return PACK;
}
