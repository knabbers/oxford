// Supermarkets: canvas textures. A small shelf-packing atlas, brand wordmarks drawn as plain lettering (Tesco: blue
// capitals over red stripes on white; Sainsbury's: white on orange), product pack faces, and sign/poster artwork.
import * as THREE from 'three';
import { canvasScale, hiAniso } from '../world/_surf_detail.js';   // texture pass 2: larger canvases and 16x anisotropy on the top tier only
import { PRODUCTS, productName } from './_shop_data.js';
import { repaintable, repaint, isReleased } from '../world/_tex_keep.js';

export const BRAND = {
  tesco: { blue: '#00539f', red: '#ee1c2e', bg: '#ffffff', uniform: 0x1f4e9a, basket: 0x1d4f9c, slogan: 'Every little helps', card: 'Clubcard' },
  sainsburys: { orange: '#f06c00', bg: '#f06c00', fg: '#ffffff', uniform: 0xec6a00, basket: 0xf06c00, slogan: 'Live well for less', card: 'Nectar' },
};

/** Packs rectangular tiles into one canvas. add(key, w, h, draw(ctx, w, h)) -> uv rect [u0, v0, u1, v1] (v up). */
export class Atlas {
  constructor(W = 2048, H = 2048) {
    this.W = W; this.H = H; this.c = document.createElement('canvas'); this.c.width = W; this.c.height = H;
    this.g = this.c.getContext('2d'); this.x = 0; this.y = 0; this.row = 0; this.uv = new Map(); this.tex = null;
    this.ops = [];      // every tile as it was drawn: [x, y, w, h, draw] — the painter replays them (memory pass: the canvas goes once the texture is on the card)
  }
  _tile(g, x, y, w, h, draw) { g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(g, w, h); g.restore(); }
  /** the whole sheet painted again on a new canvas (world/_tex_keep.js calls it if the card ever needs the picture again) */
  _repaint() { const c = document.createElement('canvas'); c.width = this.W; c.height = this.H; const g = c.getContext('2d'); for (const o of this.ops) this._tile(g, o[0], o[1], o[2], o[3], o[4]); return c; }
  add(key, w, h, draw) {
    w = Math.ceil(w); h = Math.ceil(h);
    if (this.x + w > this.W) { this.x = 0; this.y += this.row + 2; this.row = 0; }
    if (this.y + h > this.H) { console.warn('[shop] atlas full', key); return this.uv.get('__blank') || [0, 0, 0.001, 0.001]; }
    this.ops.push([this.x, this.y, w, h, draw]);
    if (this.tex && isReleased(this.tex)) repaint(this.tex);      // (a tile added after the canvas went: the sheet is painted again, with it)
    else this._tile(this.g, this.x, this.y, w, h, draw);
    const r = [(this.x + 0.5) / this.W, 1 - (this.y + h - 0.5) / this.H, (this.x + w - 0.5) / this.W, 1 - (this.y + 0.5) / this.H];
    this.uv.set(key, r); this.x += w + 2; this.row = Math.max(this.row, h);
    return r;
  }
  texture() {
    if (!this.tex) { this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = hiAniso(4); this.tex.flipY = true; repaintable(this.tex, () => this._repaint(), 'shop atlas ' + this.W + 'x' + this.H); }
    return this.tex;
  }
}

const SANS = 'Helvetica, Arial, sans-serif';
export function fitText(g, text, maxW, size, weight = 'bold', family = SANS) {
  let s = size; g.font = `${weight} ${s}px ${family}`;
  while (s > 6 && g.measureText(text).width > maxW) { s -= 1; g.font = `${weight} ${s}px ${family}`; }
  return s;
}

/** Shop name in plain blue capitals with an optional red lower-case suffix ("metro", "express"); no logo device. */
export function tescoMark(g, cx, cy, h, suffix = '') {
  const B = BRAND.tesco;
  g.font = `bold ${h}px ${SANS}`; g.textBaseline = 'alphabetic';
  const tw = g.measureText('TESCO').width;
  g.font = `bold ${h * 0.62}px ${SANS}`; const sw = suffix ? g.measureText(suffix).width + h * 0.25 : 0;
  const x0 = cx - (tw + sw) / 2, base = cy + h * 0.28;
  g.fillStyle = B.blue; g.font = `bold ${h}px ${SANS}`; g.textAlign = 'left'; g.fillText('TESCO', x0, base);
  // plain lettering only: the red bars under the word are the real brand device and are deliberately not drawn
  if (suffix) { g.fillStyle = B.red; g.font = `bold ${h * 0.62}px ${SANS}`; g.fillText(suffix, x0 + tw + h * 0.25, base); }
}
/** Sainsbury's wordmark: white lettering for an orange ground, optional lighter suffix ("Local"). */
export function sainsMark(g, cx, cy, h, suffix = '', fg = '#ffffff') {
  const F = '"Trebuchet MS", "Gill Sans", Helvetica, sans-serif';
  g.font = `bold ${h}px ${F}`; const tw = g.measureText("Sainsbury's").width;
  g.font = `${h * 0.8}px ${F}`; const sw = suffix ? g.measureText(suffix).width + h * 0.3 : 0;
  const x0 = cx - (tw + sw) / 2, base = cy + h * 0.33;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = fg;
  g.font = `bold ${h}px ${F}`; g.fillText("Sainsbury's", x0, base);
  if (suffix) { g.font = `${h * 0.8}px ${F}`; g.fillText(suffix, x0 + tw + h * 0.3, base); }
}

/** Fascia board artwork. */
export function drawFascia(g, w, h, brand, fmt) {
  if (brand === 'tesco') {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8dde4'; g.fillRect(0, h - 6, w, 6); g.fillRect(0, 0, w, 3);
    tescoMark(g, w / 2, h / 2, h * 0.52, fmt === 'metro' ? 'metro' : fmt === 'express' ? 'express' : '');
  } else {
    g.fillStyle = BRAND.sainsburys.orange; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, h - 5, w, 5);
    sainsMark(g, w / 2, h / 2, h * 0.5, fmt === 'local' ? 'Local' : '');
  }
}

/** A colourful poster. lines: [[text, size, colour], ...] on bg. */
export function drawPoster(g, w, h, bg, lines, border = null) {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = Math.max(3, w * 0.03); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth); }
  let total = 0; for (const l of lines) total += l[1] * 1.15;
  let y = (h - total) / 2;
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (const [t, s, c, f] of lines) { g.fillStyle = c; fitText(g, t, w * 0.9, s, 'bold', f || SANS); g.fillText(t, w / 2, y); y += s * 1.15; }
}

/** Shop window: what you see through the glass (bright interior, shelf silhouettes, posters). */
export function drawWindow(g, w, h, brand, seed = 1) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e8ecef'); gr.addColorStop(1, '#c9cfd4');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // ceiling lights
  g.fillStyle = '#ffffff'; for (let x = 10; x < w; x += 70) g.fillRect(x, 6, 40, 5);
  // shelving silhouettes with coloured packs
  let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 3; k++) {
    const y0 = h * (0.3 + k * 0.03), sh = h * 0.55 - k * 10, x0 = (k * 37) % 50;
    for (let x = x0; x < w; x += 90 + k * 20) {
      g.fillStyle = '#9aa3aa'; g.fillRect(x, y0, 60 - k * 10, sh);
      for (let s = 0; s < 4; s++) for (let i = 0; i < 6; i++) { g.fillStyle = `hsl(${(rnd() * 360) | 0},${22 + rnd() * 25}%,${48 + rnd() * 22}%)`; g.fillRect(x + 3 + i * 9 - k, y0 + 4 + s * sh / 4, 7 - k, sh / 4 - 8); }
    }
  }
  // posters stuck to the inside of the glass
  const B = BRAND[brand];
  if (brand === 'tesco') {
    if (seed % 2) { g.fillStyle = '#ffffff'; g.fillRect(w * 0.08, h * 0.12, w * 0.3, h * 0.32); g.fillStyle = B.blue; g.fillRect(w * 0.08, h * 0.12, w * 0.3, h * 0.08);
    g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = '#fff'; fitText(g, 'Meal Deal', w * 0.28, h * 0.06); g.fillText('Meal Deal', w * 0.23, h * 0.13);
    g.fillStyle = B.red; fitText(g, '£3', w * 0.28, h * 0.17); g.fillText('£3', w * 0.23, h * 0.22); }
    g.fillStyle = B.blue; fitText(g, B.slogan, w * 0.4, h * 0.05, 'italic bold'); g.fillText(B.slogan, w * 0.7, h * 0.78);
  } else {
    if (seed % 2) { g.fillStyle = B.orange; g.fillRect(w * 0.6, h * 0.12, w * 0.3, h * 0.32);
    g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = '#fff'; fitText(g, 'Meal Deal', w * 0.28, h * 0.06); g.fillText('Meal Deal', w * 0.75, h * 0.15);
    fitText(g, '£3', w * 0.28, h * 0.15); g.fillText('£3', w * 0.75, h * 0.23); }
    g.fillStyle = B.orange; fitText(g, B.slogan, w * 0.4, h * 0.05, 'bold'); g.fillText(B.slogan, w * 0.3, h * 0.78);
  }
  // glass sheen
  const s = g.createLinearGradient(0, 0, w, h); s.addColorStop(0, 'rgba(255,255,255,.18)'); s.addColorStop(0.45, 'rgba(255,255,255,0)'); s.addColorStop(0.55, 'rgba(255,255,255,.1)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
}

/** One product pack face: own-brand band + name + a simple picture. */
export function drawPack(g, w, h, id, brand, reduced = false) {
  const p = PRODUCTS[id], value = /^Value /.test(p.name);
  g.fillStyle = value ? '#ffffff' : p.col; g.fillRect(0, 0, w, h);
  // brand band
  const bh = h * 0.2;
  if (brand === 'tesco') {
    g.fillStyle = value ? '#ffffff' : '#ffffff'; g.fillRect(0, 0, w, bh);
    g.fillStyle = BRAND.tesco.blue; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, 'TESCO', w * 0.8, bh * 0.75); g.fillText('TESCO', w / 2, bh / 2);
    g.fillStyle = BRAND.tesco.red; g.fillRect(w * 0.2, bh - 3, w * 0.6, 2);
    if (value) { g.fillStyle = BRAND.tesco.blue; g.fillRect(0, h - h * 0.1, w, h * 0.1); g.fillStyle = BRAND.tesco.red; g.fillRect(0, h - h * 0.13, w, h * 0.03); }
  } else {
    g.fillStyle = BRAND.sainsburys.orange; g.fillRect(0, 0, w, bh);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, value ? 'basics' : "Sainsbury's", w * 0.85, bh * 0.7); g.fillText(value ? 'basics' : "Sainsbury's", w / 2, bh / 2);
  }
  if (p.real) { // Jaffa Cakes: plain blue box with orange disc (generic lettering)
    g.fillStyle = '#1a3a8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f08a10'; g.beginPath(); g.arc(w * 0.5, h * 0.55, h * 0.22, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; fitText(g, 'Jaffa Cakes', w * 0.9, h * 0.16); g.fillText('Jaffa Cakes', w / 2, h * 0.18);
  } else {
    // picture
    const pc = { mealdeal: '#f6e7c2', drinks: '#ffffff', dairy: '#ffffff', alcohol: '#f2e2a0', frozen: '#cfe8f8' }[p.cat] || '#ffffff';
    g.fillStyle = pc; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(w * 0.5, h * 0.6, w * 0.32, h * 0.2, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    g.fillStyle = p.liquid || '#c0603a'; g.beginPath(); g.ellipse(w * 0.5, h * 0.6, w * 0.18, h * 0.1, 0, 0, 7); g.fill();
    // name
    g.fillStyle = value ? BRAND.tesco.blue : lum(p.col) > 0.6 ? '#222' : '#fff';
    if (brand !== 'tesco' && value) g.fillStyle = BRAND.sainsburys.orange;
    const nm = productName(id, brand).replace(/^(Tesco Everyday Value|Tesco|Sainsbury's basics|Sainsbury's) /, '');
    const words = nm.split(' '); let l1 = '', l2 = '';
    for (const wd of words) { if ((l1 + ' ' + wd).length < 14 && !l2) l1 = (l1 + ' ' + wd).trim(); else l2 = (l2 + ' ' + wd).trim(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, l1, w * 0.92, h * 0.13); g.fillText(l1, w / 2, bh + h * 0.1);
    if (l2) { fitText(g, l2, w * 0.92, h * 0.11); g.fillText(l2, w / 2, bh + h * 0.22); }
  }
  if (reduced) {
    g.fillStyle = '#ffe600'; g.fillRect(w * 0.45, h * 0.62, w * 0.5, h * 0.3); g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(w * 0.45, h * 0.62, w * 0.5, h * 0.3);
    g.fillStyle = '#d00'; g.textAlign = 'center'; fitText(g, 'REDUCED', w * 0.46, h * 0.1); g.fillText('REDUCED', w * 0.7, h * 0.72);
    g.fillStyle = '#111'; fitText(g, 'to clear', w * 0.46, h * 0.08, 'normal'); g.fillText('to clear', w * 0.7, h * 0.84);
  }
}
function lum(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

/** Floor: shiny light vinyl tiles (0.6 m), 4 x 4 tiles per texture repeat. */
export function floorTexture(tint = '#d9dcdf') {
  const k = canvasScale(256, 256), c = document.createElement('canvas'); c.width = c.height = 256 * k; const g = c.getContext('2d'); g.scale(k, k);
  g.fillStyle = tint; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.strokeStyle = 'rgba(80,85,90,.35)'; g.lineWidth = 1.5;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 2.4, 1 / 2.4); t.anisotropy = hiAniso(4);
  return t;
}
/** Suspended ceiling: 0.6 m grid. */
export function ceilingTexture() {
  const k = canvasScale(128, 128), c = document.createElement('canvas'); c.width = c.height = 128 * k; const g = c.getContext('2d'); g.scale(k, k);
  g.fillStyle = '#eceae4'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
  g.strokeStyle = '#b8bcc0'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 0.6, 1 / 0.6); t.anisotropy = hiAniso(1);
  return t;
}
