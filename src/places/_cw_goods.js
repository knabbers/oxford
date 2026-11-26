// Painted goods for the city-centre-west interiors and close-up dressing (owned by places/covered_market.js; also used
// by oxford_station.js for its boards and broad_street.js for the bookshop windows): ONE 1024² canvas of 8 x 8 cells
// (128 px) drawn here — heaps of produce seen from above, shelf strips of stock (jars, tins, loaves, cheeses, shoes),
// bunches of flowers with a transparent ground, white wall tiles, worn-floor smudges, book spines. Its material is a
// CLONE of the lettering material (cwSigns): same shader program (map + emissive map + alpha test), so nothing new is
// compiled; a geometry in it is one draw. Deterministic: a seeded generator, no Math.random.
import * as THREE from 'three';
import { repaintable } from '../world/_tex_keep.js';
import { cwSigns } from './_cw_kit.js';

const C = 128, N = 8, SZ = C * N, SZH = C * 16;      // 8 columns x 16 rows
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const shade = (hex, k) => { const c = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(c >> 16)},${f((c >> 8) & 255)},${f(c & 255)})`; };

// name -> [col, row, w, h] (cells)
export const GOODS_CELLS = {
  apple: [0, 0, 1, 1], orange: [1, 0, 1, 1], lemon: [2, 0, 1, 1], green: [3, 0, 1, 1], potato: [4, 0, 1, 1], carrot: [5, 0, 1, 1], tomato: [6, 0, 1, 1], aubergine: [7, 0, 1, 1],
  cabbage: [0, 1, 1, 1], banana: [1, 1, 1, 1], strawberry: [2, 1, 1, 1], grape: [3, 1, 1, 1], mushroom: [4, 1, 1, 1], onion: [5, 1, 1, 1], pepper: [6, 1, 1, 1], plum: [7, 1, 1, 1],
  jars: [0, 2, 2, 1], tins: [2, 2, 2, 1], boxes: [4, 2, 2, 1], bottles: [6, 2, 2, 1],
  loaves: [0, 3, 2, 1], pies: [2, 3, 2, 1], cheeses: [4, 3, 2, 1], cakes: [6, 3, 2, 1],
  shoes: [0, 4, 2, 1], bags: [2, 4, 2, 1], cards: [4, 4, 2, 1], jewels: [6, 4, 2, 1],
  flowersR: [0, 5, 1, 1], flowersY: [1, 5, 1, 1], flowersW: [2, 5, 1, 1], flowersP: [3, 5, 1, 1], meat: [4, 5, 1, 1], fish: [5, 5, 1, 1], sausage: [6, 5, 1, 1], tags: [7, 5, 1, 1],
  teas: [0, 6, 2, 1], mugs: [2, 6, 2, 1], books: [4, 6, 2, 1], hatboxes: [6, 6, 2, 1],
  tiles: [0, 7, 1, 1], wear: [1, 7, 1, 1], pool: [2, 7, 1, 1], booksB: [3, 7, 2, 1], booksC: [5, 7, 2, 1], window: [7, 7, 1, 1],
  // Port Meadow (places/port_meadow.js): ground dressing with transparent grounds
  tussock: [0, 8, 1, 1], thistle: [1, 8, 1, 1], clump: [2, 8, 1, 1], rough: [3, 8, 1, 1], buttercups: [4, 8, 1, 1], mud: [5, 8, 1, 1], wet: [6, 8, 1, 1], daisies: [7, 8, 1, 1],
  // Broad Street (places/broad_street.js): books face-out on stands, a stack, a window card
  covers: [0, 9, 2, 1], coversB: [2, 9, 2, 1], stack: [4, 9, 1, 1], spinesL: [5, 9, 2, 1], poster: [7, 9, 1, 1],
};

function heap(g, w, h, r, cols, rad, o = {}) {
  g.fillStyle = o.bg || '#2a1a0e'; g.fillRect(0, 0, w, h);
  const n = Math.round((w * h) / (rad * rad) * 1.25);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, c = cols[Math.floor(r() * cols.length)], rr = rad * (0.8 + r() * 0.4);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + rr * 0.15, y + rr * 0.2, rr, rr * (o.ar || 1), o.rot ? r() * 3 : 0, 0, 7); g.fill();
    const gr = g.createRadialGradient(x - rr * 0.35, y - rr * 0.35, rr * 0.1, x, y, rr);
    gr.addColorStop(0, shade(c, 1.45)); gr.addColorStop(0.55, c); gr.addColorStop(1, shade(c, 0.55));
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr, rr * (o.ar || 1), o.rot ? r() * 3 : 0, 0, 7); g.fill();
    if (o.stalk) { g.fillStyle = '#3a2a10'; g.fillRect(x - 1, y - rr * 0.5, 2, 4); }
  }
}
function strip(g, w, h, r, draw) { g.fillStyle = '#2b2118'; g.fillRect(0, 0, w, h); draw(); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.2, 'rgba(0,0,0,0)'); gr.addColorStop(0.9, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
function rowOf(g, w, h, r, item) { let x = 2; while (x < w - 6) { const iw = item(x, r); x += iw + 1 + r() * 3; } }
function bunch(g, w, h, r, cols) {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#2f5a1e'; g.lineWidth = 3;
  for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(w / 2 + (r() - 0.5) * 20, h); g.lineTo(w * (0.15 + r() * 0.7), h * (0.2 + r() * 0.35)); g.stroke(); }
  for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.5 ? '#3d7a28' : '#2a5a1a'; g.beginPath(); g.ellipse(w * (0.1 + r() * 0.8), h * (0.3 + r() * 0.5), 6, 14, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 22; i++) {
    const x = w * (0.12 + r() * 0.76), y = h * (0.08 + r() * 0.42), c = cols[Math.floor(r() * cols.length)], rr = 8 + r() * 6;
    g.fillStyle = shade(c, 0.6); g.beginPath(); g.arc(x + 1, y + 2, rr, 0, 7); g.fill();
    g.fillStyle = c; for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.283 + r(); g.beginPath(); g.ellipse(x + Math.cos(a) * rr * 0.45, y + Math.sin(a) * rr * 0.45, rr * 0.55, rr * 0.38, a, 0, 7); g.fill(); }
    g.fillStyle = shade(c, 1.4); g.beginPath(); g.arc(x - 1, y - 1, rr * 0.3, 0, 7); g.fill();
  }
}
function spines(g, w, h, r, pal) {
  g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, w, h);
  for (const [y0, y1] of [[2, h / 2 - 3], [h / 2 + 1, h - 4]]) {
    let x = 1;
    while (x < w - 2) {
      const bw = 3 + Math.floor(r() * 7), bh = (y1 - y0) * (0.72 + r() * 0.28), c = pal[Math.floor(r() * pal.length)];
      g.fillStyle = shade(c, 0.85 + r() * 0.3); g.fillRect(x, y1 - bh, bw, bh);
      g.fillStyle = 'rgba(255,240,200,0.5)'; if (r() < 0.6) g.fillRect(x + 1, y1 - bh * 0.75, bw - 2, 1.5); if (r() < 0.4) g.fillRect(x + 1, y1 - bh * 0.3, bw - 2, 1);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + bw - 1, y1 - bh, 1, bh);
      x += bw + (r() < 0.08 ? 4 : 0.5);
    }
    g.fillStyle = '#5a4028'; g.fillRect(0, y1, w, 3);
  }
}

let GOODS = null;
/** {material, uv(name) -> [u0, v0, u1, v1], texture} */
export function cwGoods(world) {
  if (GOODS) return GOODS;
  const c = document.createElement('canvas'); c.width = SZ; c.height = SZH;
  const g = c.getContext('2d'), cells = {};
  for (const [name, [col, row, w, h]] of Object.entries(GOODS_CELLS)) {
    const W = w * C, Hh = h * C, r = rnd(17 + col * 31 + row * 977);
    g.save(); g.translate(col * C, row * C); g.beginPath(); g.rect(0, 0, W, Hh); g.clip();
    paint(name, g, W, Hh, r);
    g.restore();
    const p = 1.5; cells[name] = [(col * C + p) / SZ, 1 - ((row + h) * C - p) / SZH, ((col + w) * C - p) / SZ, 1 - (row * C + p) / SZH];
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const material = cwSigns(world).material.clone();
  material.map = texture; material.emissiveMap = texture; material.name = 'cw-goods';
  material.emissiveIntensity = 0.12;
  // (memory pass: painted again by this function, its cache set aside for the call, if the card ever needs it again: world/_tex_keep.js)
  repaintable(texture, () => { const k = GOODS; GOODS = null; try { return cwGoods(world).texture; } finally { GOODS = k; } }, 'covered market goods');
  GOODS = { texture, material, uv: (n) => cells[n], cells };
  return GOODS;
}

function paint(name, g, w, h, r) {
  const H = { apple: [['#a01c14', '#c83020', '#7a1410', '#b8501c'], 13, { stalk: true }], orange: [['#e07810', '#f08a18', '#d06808'], 13], lemon: [['#e8c820', '#f0d838', '#d0b018'], 11, { ar: 0.75, rot: 1 }],
    green: [['#7aa830', '#8cbc3a', '#6a9628'], 13, { stalk: true }], potato: [['#b08850', '#c09a60', '#9a7440'], 12, { ar: 0.8, rot: 1 }], carrot: [['#e06a18', '#f07a20', '#c85a10'], 6, { ar: 3, rot: 1 }],
    tomato: [['#d02818', '#e03a20', '#b81c10'], 12], aubergine: [['#3a1640', '#4a2050', '#2a1030'], 9, { ar: 2, rot: 1 }], cabbage: [['#4a8a2a', '#6aa83a', '#3a7020', '#8ab84a'], 22],
    grape: [['#5a2a5a', '#6a3a6a', '#7aa838'], 6], mushroom: [['#e8dcc8', '#d8c8b0', '#c8b498'], 10], onion: [['#c08a40', '#d8a050', '#a87030'], 12], pepper: [['#d02818', '#e8b818', '#3a8a2a', '#e86818'], 13, { ar: 1.1 }], plum: [['#6a1a3a', '#7a2448', '#501030'], 10] };
  if (H[name]) { heap(g, w, h, r, H[name][0], H[name][1], H[name][2] || {}); return; }
  switch (name) {
    case 'banana': g.clearRect(0, 0, w, h); for (let i = 0; i < 7; i++) { const x = w * (0.3 + r() * 0.4), y = h * (0.05 + r() * 0.35), a = r() * 3; g.save(); g.translate(x, y); g.rotate(a); for (let k = 0; k < 5; k++) { g.strokeStyle = k % 2 ? '#e8cc30' : '#d8b820'; g.lineWidth = 9; g.beginPath(); g.arc(0, 30 + k * 7, 34, -2.4, -0.7); g.stroke(); } g.restore(); } return;
    case 'strawberry': g.fillStyle = '#e8e4dc'; g.fillRect(0, 0, w, h); for (const [x0, y0] of [[0, 0], [64, 0], [0, 64], [64, 64]]) { g.fillStyle = '#3a6a9a'; g.fillRect(x0 + 3, y0 + 3, 58, 58); heap(g, 0, 0, r, [], 1); g.save(); g.beginPath(); g.rect(x0 + 6, y0 + 6, 52, 52); g.clip(); g.translate(x0 + 6, y0 + 6); heap(g, 52, 52, r, ['#c81c1c', '#e02a20', '#b01010'], 7, { ar: 1.2, rot: 1 }); g.restore(); } return;
    case 'jars': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const jw = 14 + r() * 6, jh = 26 + r() * 14, c = ['#b02010', '#e0a020', '#6a3010', '#d06020', '#4a1a3a'][Math.floor(r() * 5)]; g.fillStyle = c; g.fillRect(x, y1 - jh, jw, jh); g.fillStyle = '#e8e0c8'; g.fillRect(x + 2, y1 - jh * 0.65, jw - 4, jh * 0.35); g.fillStyle = '#c8c0a8'; g.fillRect(x, y1 - jh - 5, jw, 5); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 2, y1 - jh, 2, jh); return jw; }); }); return;
    case 'tins': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const jw = 16 + r() * 4, jh = 22 + r() * 8, c = ['#1a3a6a', '#a01818', '#1a5a2a', '#d8a020', '#e8e0d0'][Math.floor(r() * 5)]; g.fillStyle = '#b0b4b8'; g.fillRect(x, y1 - jh, jw, jh); g.fillStyle = c; g.fillRect(x, y1 - jh * 0.8, jw, jh * 0.6); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x + 2, y1 - jh, 2, jh); return jw; }); }); return;
    case 'boxes': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const jw = 20 + r() * 18, jh = 24 + r() * 16, c = ['#c84a20', '#2a5a8a', '#e8c040', '#5a8a3a', '#8a2a5a', '#f0e8d8'][Math.floor(r() * 6)]; g.fillStyle = c; g.fillRect(x, y1 - jh, jw, jh); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 3, y1 - jh * 0.6, jw - 6, 4); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + jw - 2, y1 - jh, 2, jh); return jw; }); }); return;
    case 'bottles': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const c = ['#2a4a1a', '#5a1a10', '#1a2a3a', '#c8a040'][Math.floor(r() * 4)], bh = 36 + r() * 12; g.fillStyle = c; g.fillRect(x, y1 - bh * 0.7, 12, bh * 0.7); g.fillRect(x + 4, y1 - bh, 4, bh * 0.35); g.fillStyle = '#e8e0c0'; g.fillRect(x + 1, y1 - bh * 0.45, 10, 9); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x + 2, y1 - bh * 0.68, 2, bh * 0.6); return 12; }); }); return;
    case 'loaves': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const lw = 26 + r() * 14, lh = 18 + r() * 8; const gr = g.createLinearGradient(0, y1 - lh, 0, y1); gr.addColorStop(0, '#c88a40'); gr.addColorStop(1, '#7a4a1a'); g.fillStyle = gr; g.beginPath(); g.ellipse(x + lw / 2, y1 - lh / 2, lw / 2, lh / 2, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,230,180,0.6)'; g.lineWidth = 1.5; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + (lw * k) / 4 - 3, y1 - lh * 0.8); g.lineTo(x + (lw * k) / 4 + 3, y1 - lh * 0.3); g.stroke(); } return lw; }); }); return;
    case 'pies': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const pw = 28; g.fillStyle = '#a8a8a8'; g.fillRect(x, y1 - 6, pw, 6); g.fillStyle = '#d8a050'; g.beginPath(); g.ellipse(x + pw / 2, y1 - 9, pw / 2, 7, 0, 0, 7); g.fill(); g.fillStyle = '#b07828'; g.fillRect(x + pw / 2 - 1, y1 - 14, 2, 6); return pw; }); }); return;
    case 'cheeses': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const cw = 30 + r() * 16, ch = 16 + r() * 10, c = ['#e8c850', '#f0dca0', '#d89a30', '#e8e0c8', '#c84a20'][Math.floor(r() * 5)]; g.fillStyle = shade(c, 0.75); g.fillRect(x, y1 - ch, cw, ch); g.fillStyle = c; g.fillRect(x, y1 - ch, cw, ch * 0.3); if (r() < 0.4) { g.fillStyle = shade(c, 1.15); g.beginPath(); g.moveTo(x + cw * 0.6, y1 - ch); g.lineTo(x + cw, y1 - ch); g.lineTo(x + cw, y1); g.closePath(); g.fill(); } return cw; }); }); return;
    case 'cakes': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const cw = 22 + r() * 10, ch = 14 + r() * 8, c = ['#f2c6d6', '#f4ead0', '#5a3018', '#f0f0f0', '#e8d040'][Math.floor(r() * 5)]; g.fillStyle = '#e0e0e0'; g.fillRect(x - 2, y1 - 3, cw + 4, 3); g.fillStyle = c; g.fillRect(x, y1 - 3 - ch, cw, ch); g.fillStyle = '#c81c3c'; g.beginPath(); g.arc(x + cw / 2, y1 - 5 - ch, 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x, y1 - 3 - ch, cw, 2); return cw; }); }); return;
    case 'shoes': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const c = ['#1a1410', '#5a3018', '#7a1a1a', '#2a2a3a'][Math.floor(r() * 4)]; g.fillStyle = c; g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y1 - 14); g.quadraticCurveTo(x + 6, y1 - 22, x + 12, y1 - 12); g.lineTo(x + 30, y1 - 8); g.quadraticCurveTo(x + 36, y1 - 4, x + 34, y1); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 14, y1 - 10, 12, 2); return 34; }); }); return;
    case 'bags': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const bw = 28 + r() * 10, bh = 22 + r() * 10, c = ['#6a3a18', '#2a1a10', '#8a5a2a', '#3a2a4a'][Math.floor(r() * 4)]; g.strokeStyle = shade(c, 0.8); g.lineWidth = 3; g.beginPath(); g.arc(x + bw / 2, y1 - bh, bw * 0.3, 3.14, 0); g.stroke(); g.fillStyle = c; g.fillRect(x, y1 - bh, bw, bh); g.fillStyle = '#c8a040'; g.fillRect(x + bw / 2 - 3, y1 - bh + 6, 6, 4); return bw; }); }); return;
    case 'cards': g.fillStyle = '#8a6a48'; g.fillRect(0, 0, w, h); for (let j = 0; j < 3; j++) for (let i = 0; i < 9; i++) { const x = 4 + i * 28, y = 4 + j * 41; g.fillStyle = '#f4f0e8'; g.fillRect(x, y, 24, 36); g.fillStyle = ['#3a6a9a', '#c84a3a', '#5a8a3a', '#e8b030', '#7a3a7a'][Math.floor(r() * 5)]; g.fillRect(x + 3, y + 3, 18, 22); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x + 12, y + 14, 5, 0, 7); g.fill(); } return;
    case 'jewels': g.fillStyle = '#141a2a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const x = 8 + r() * (w - 16), y = 8 + r() * (h - 16); g.strokeStyle = r() < 0.6 ? '#e8c860' : '#d8d8e0'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4 + r() * 6, 0, 7); g.stroke(); if (r() < 0.4) { g.fillStyle = ['#e02040', '#2060e0', '#20c060'][Math.floor(r() * 3)]; g.beginPath(); g.arc(x, y - 6, 2.5, 0, 7); g.fill(); } } return;
    case 'flowersR': bunch(g, w, h, r, ['#d02030', '#e83048', '#b01020']); return;
    case 'flowersY': bunch(g, w, h, r, ['#f0d020', '#f8e040', '#e8a020']); return;
    case 'flowersW': bunch(g, w, h, r, ['#f4f0ec', '#f8c8d8', '#e890b0']); return;
    case 'flowersP': bunch(g, w, h, r, ['#9040a0', '#6a40c0', '#c050b0']); return;
    case 'meat': g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { const x = 10 + (i % 3) * 40, y = 12 + Math.floor(i / 3) * 58; g.fillStyle = '#b84a40'; g.beginPath(); g.ellipse(x + 16, y + 22, 17, 22, 0.2, 0, 7); g.fill(); g.fillStyle = '#f0e0d0'; g.beginPath(); g.ellipse(x + 16, y + 22, 17, 22, 0.2, -0.4, 0.9); g.lineTo(x + 16, y + 22); g.fill(); g.fillStyle = '#4a8a2a'; g.fillRect(x + 2, y + 44, 6, 3); } return;
    case 'fish': g.fillStyle = '#e8eef2'; g.fillRect(0, 0, w, h); for (let i = 0; i < 10; i++) { const y = 8 + i * 12, x = (i % 2) * 14 + 6; g.fillStyle = i % 3 ? '#8a9aa8' : '#c8a080'; g.beginPath(); g.ellipse(x + 50, y, 46, 6, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x - 8, y - 6); g.lineTo(x - 8, y + 6); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 20, y - 3, 50, 1.5); g.fillStyle = '#111'; g.fillRect(x + 88, y - 2, 2, 2); } return;
    case 'sausage': g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h); for (let j = 0; j < 9; j++) for (let i = 0; i < 4; i++) { const x = 6 + i * 30, y = 8 + j * 13; g.fillStyle = '#b86a50'; g.beginPath(); g.ellipse(x + 13, y, 13, 5, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,220,200,0.4)'; g.fillRect(x + 6, y - 3, 12, 1.5); } return;
    case 'tags': g.fillStyle = '#f8f6ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#c81c1c'; g.font = 'bold 40px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('£1', w / 2, h * 0.32); g.fillStyle = '#1a1a1a'; g.font = 'bold 22px Arial, sans-serif'; g.fillText('per lb', w / 2, h * 0.72); return;
    case 'teas': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const c = ['#1a3a2a', '#6a1a1a', '#1a2a5a', '#c8a040', '#3a1a3a'][Math.floor(r() * 5)]; g.fillStyle = c; g.fillRect(x, y1 - 30, 20, 30); g.fillStyle = '#d8b860'; g.fillRect(x, y1 - 30, 20, 3); g.fillRect(x + 4, y1 - 20, 12, 8); return 20; }); }); return;
    case 'mugs': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const c = ['#f4f0e8', '#1a2a5a', '#7a1a2a', '#e8e0c0'][Math.floor(r() * 4)]; g.fillStyle = c; g.fillRect(x, y1 - 22, 18, 22); g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.arc(x + 20, y1 - 11, 5, -1.5, 1.5); g.stroke(); g.fillStyle = '#1a2a5a'; if (c !== '#1a2a5a') g.fillRect(x + 4, y1 - 15, 10, 6); return 24; }); }); return;
    case 'books': spines(g, w, h, r, ['#1a2a4a', '#6a1a1a', '#1a4a2a', '#d8c8a0', '#2a2a2a', '#8a5a1a', '#4a1a4a', '#c8a040', '#e8e4dc']); return;
    case 'booksB': spines(g, w, h, r, ['#e8e4dc', '#1a3a6a', '#c84a20', '#f0d040', '#2a6a5a', '#1a1a1a', '#8a8a8a']); return;
    case 'booksC': spines(g, w, h, r, ['#3a1a10', '#5a3a1a', '#1a1a2a', '#6a1a1a', '#2a3a1a', '#c8b080']); return;
    case 'hatboxes': strip(g, w, h, r, () => { for (const y1 of [h / 2 - 4, h - 6]) rowOf(g, w, h, r, (x) => { const c = ['#f2c6d6', '#1a1a1a', '#f4ead0', '#3a1a4a', '#c8e0e8'][Math.floor(r() * 5)], bw = 30 + r() * 6; g.fillStyle = c; g.fillRect(x, y1 - 26, bw, 26); g.fillStyle = shade(c, 0.7); g.fillRect(x, y1 - 26, bw, 5); g.fillStyle = '#c81c3c'; g.fillRect(x + bw / 2 - 2, y1 - 26, 4, 26); return bw; }); }); return;
    case 'tiles': g.fillStyle = '#b8b8b0'; g.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const t = 236 + r() * 14; g.fillStyle = `rgb(${t},${t},${t - 4})`; g.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(i * 16 + 2, j * 16 + 2, 6, 2); } return;
    case 'wear': { g.clearRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(40,30,20,${0.04 + r() * 0.08})`; g.beginPath(); g.ellipse(w * (0.25 + r() * 0.5), r() * h, 6 + r() * 26, 4 + r() * 14, r() * 3, 0, 7); g.fill(); } const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(30,22,14,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); return; }
    case 'pool': { g.clearRect(0, 0, w, h); const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.45, 'rgba(255,190,120,0.45)'); gr.addColorStop(1, 'rgba(255,170,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); return; }
    case 'window': { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#8fa3b4'); gr.addColorStop(0.45, '#4a5a68'); gr.addColorStop(0.5, '#a8bccb'); gr.addColorStop(0.58, '#55687a'); gr.addColorStop(1, '#2a3440'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(w * 0.1, 0); g.lineTo(w * 0.35, 0); g.lineTo(w * 0.05, h); g.lineTo(-w * 0.2, h); g.fill(); return; }
    case 'tussock': { g.clearRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const x0 = w * (0.2 + 0.6 * r()), bend = (r() - 0.5) * 50, top = h * (0.05 + 0.5 * r()), c = r() < 0.25 ? '#8a8a4a' : r() < 0.5 ? '#3f6a22' : '#56802c'; g.strokeStyle = c; g.lineWidth = 2 + r() * 2; g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + bend * 0.3, h * 0.6, x0 + bend, top); g.stroke(); } return; }
    case 'thistle': { g.clearRect(0, 0, w, h); g.strokeStyle = '#4a6a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, h * 0.25); g.stroke(); for (let i = 0; i < 9; i++) { const y = h * (0.45 + 0.5 * r()), s2 = r() < 0.5 ? -1 : 1; g.fillStyle = '#56782e'; g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + s2 * (20 + 25 * r()), y - 10 - 10 * r()); g.lineTo(w / 2 + s2 * 8, y + 8); g.fill(); } for (const [dx, dy] of [[0, 0.2], [-14, 0.3], [15, 0.33]]) { g.fillStyle = '#5a7a3a'; g.beginPath(); g.arc(w / 2 + dx, h * dy + 8, 7, 0, 7); g.fill(); g.fillStyle = '#9a4ab0'; g.beginPath(); g.arc(w / 2 + dx, h * dy, 7, 3.3, 6.1); g.fill(); } return; }
    case 'clump': { g.clearRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const x0 = w * (0.15 + 0.7 * r()); g.strokeStyle = r() < 0.5 ? '#4a7a26' : '#5e8c30'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, h); g.lineTo(x0 + (r() - 0.5) * 30, h * (0.3 + 0.5 * r())); g.stroke(); } for (let i = 0; i < 14; i++) { const x = w * (0.15 + 0.7 * r()), y = h * (0.2 + 0.45 * r()); g.fillStyle = '#f2d020'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.fillStyle = '#fff070'; g.beginPath(); g.arc(x - 1, y - 1, 2, 0, 7); g.fill(); } return; }
    case 'rough': case 'mud': case 'wet': {
      g.clearRect(0, 0, w, h);
      const col = { rough: ['#5c8a2c', '#548226', '#649232'], mud: ['#5a4a30', '#64523a', '#4e4028'], wet: ['#4a6428', '#526a2c', '#445c24'] }[name];
      for (let i = 0; i < 26; i++) { const a = r() * 6.283, d = r() * w * 0.3, x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d; g.fillStyle = col[i % 3]; g.beginPath(); g.ellipse(x, y, 10 + r() * 22, 8 + r() * 16, r() * 3, 0, 7); g.fill(); }
      if (name === 'mud') for (let i = 0; i < 22; i++) { const x = w * (0.3 + 0.4 * r()), y = h * (0.3 + 0.4 * r()); g.fillStyle = 'rgba(52,40,26,0.9)'; g.beginPath(); g.ellipse(x, y, 2.2, 2.8, r(), 0, 7); g.fill(); }
      if (name === 'rough') for (let i = 0; i < 30; i++) { g.strokeStyle = r() < 0.5 ? '#6a8a3a' : '#2a4414'; g.lineWidth = 2; const x = w * (0.2 + 0.6 * r()), y = h * (0.2 + 0.6 * r()); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 10, y - 6); g.stroke(); }
      return;
    }
    case 'buttercups': case 'daisies': { g.clearRect(0, 0, w, h); for (let i = 0; i < 220; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * w * 0.46, x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d; if (name === 'buttercups') { g.fillStyle = '#f0cc10'; g.beginPath(); g.arc(x, y, 1.1 + r() * 0.9, 0, 7); g.fill(); } else { g.fillStyle = '#f8f8f4'; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); } } return; }
    case 'covers': case 'coversB': {
      g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, w, h);
      const pal = name === 'covers' ? ['#1a3a6a', '#c84a20', '#f0d040', '#2a6a5a', '#e8e4dc', '#6a1a3a', '#1a1a1a'] : ['#f4f0e8', '#1a2a4a', '#8a2a1a', '#3a6a3a', '#d8a030', '#4a2a5a'];
      let x = 4; while (x < w - 20) { const bw = 26 + r() * 14, bh = 40 + r() * 16, c = pal[Math.floor(r() * pal.length)], y = h - 6 - bh; g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2, y + 2, bw, bh); g.fillStyle = c; g.fillRect(x, y, bw, bh); g.fillStyle = r() < 0.5 ? '#ffffff' : '#111111'; g.globalAlpha = 0.8; g.fillRect(x + 4, y + 6, bw - 8, 4); g.fillRect(x + 4, y + 13, (bw - 8) * 0.7, 3); g.globalAlpha = 1; if (r() < 0.6) { g.fillStyle = ['#d0c0a0', '#406080', '#a04040', '#e0e0e0'][Math.floor(r() * 4)]; g.fillRect(x + 5, y + bh * 0.45, bw - 10, bh * 0.38); } x += bw + 6 + r() * 5; }
      for (let x2 = 2; x2 < w; x2 += 50 + r() * 40) { g.fillStyle = '#ffffff'; g.fillRect(x2, 6, 22, 14); g.fillStyle = '#c81c1c'; g.fillRect(x2 + 3, 9, 16, 3); }
      return;
    }
    case 'stack': { g.clearRect(0, 0, w, h); let y = h; let i = 0; while (y > 20) { const bh = 8 + r() * 10, bw = 70 + r() * 40, x = (w - bw) / 2 + (r() - 0.5) * 10; g.fillStyle = ['#1a3a6a', '#c84a20', '#e8e4dc', '#2a6a5a', '#6a1a3a', '#d8b040'][i++ % 6]; g.fillRect(x, y - bh, bw, bh); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y - bh, bw, 1.5); y -= bh; } return; }
    case 'spinesL': spines(g, w, h, r, ['#1a2a4a', '#e8e4dc', '#6a1a1a', '#c8a040', '#1a4a2a', '#f0d040', '#2a2a2a']); return;
    case 'poster': { g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a2a4a'; g.fillRect(6, 6, w - 12, h * 0.45); g.fillStyle = '#e8c860'; g.beginPath(); g.arc(w / 2, h * 0.28, 18, 0, 7); g.fill(); g.fillStyle = '#1a1a1a'; for (let k = 0; k < 4; k++) g.fillRect(14, h * 0.6 + k * 11, w - 28 - (k % 2) * 30, 5); return; }
    default: g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  }
}

/** a low mound of goods (3 x 3 vertices, 8 triangles) in a Batch's current frame: centre (x, y, z), size w x d, rise h,
 *  tilted towards +z by tilt (rad) — the painted heap on top of a crate */
export function mound(Bg, uv, x, y, z, w, d, h, tilt = 0) {
  const P = [], T = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const u = i / 2, v = j / 2, lx = (u - 0.5) * w, lz = (v - 0.5) * d, bump = (i === 1 ? 1 : 0.35) * (j === 1 ? 1 : 0.4) * h;
    P.push([x + lx, y + bump - lz * Math.sin(tilt), z + lz * Math.cos(tilt)]);
    T.push([uv[0] + (uv[2] - uv[0]) * u, uv[1] + (uv[3] - uv[1]) * (1 - v)]);
  }
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const a = j * 3 + i, b = a + 1, c = a + 4, d2 = a + 3;
    Bg.tri('goods', P[a], P[d2], P[c], T[a], T[d2], T[c]); Bg.tri('goods', P[a], P[c], P[b], T[a], T[c], T[b]);
  }
}
/** an upright painted card in the current frame: centre bottom (x, y, z), width w, height h, facing +z (u along +x) */
export function card(Bg, uv, x, y, z, w, h, zTilt = 0) { Bg.card('goods', [x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y + h, z + zTilt], [x - w / 2, y + h, z + zTilt], uv); }
