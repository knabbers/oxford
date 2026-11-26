// Canvas textures for the Randolph Hotel (one atlas + matching emissive mask) and the lobby/Morse Bar pictures.
// Facade: Victorian (Venetian) Gothic — yellow/buff brick, stone bands at every floor, pointed two-light windows with an
// engaged column and stone surrounds (Historic England list entry 1369325). Painted in metres via a canvas transform.
import * as THREE from 'three';
import { canvas, canvasTexture, rng } from './_randolph_kit.js';

export const ATLAS = { W: 384, H: 1408, colW: 128, facadeTop: 384, facadeH: 18, bayW: 3.5 };
// storey windows: [sill, apex, width] (metres above the street)
export const STOREYS = [[0.9, 3.85, 1.9], [5.05, 7.8, 1.7], [8.85, 11.2, 1.6], [12.2, 14.45, 1.45], [15.3, 17.45, 1.35]];
export const BANDS = [4.4, 8.2, 11.7, 14.9];

/** uv rect from atlas pixels -> [u0, v0(bottom), u1, v1(top)] */
export const px = (x0, y0, x1, y1) => [x0 / ATLAS.W, 1 - y1 / ATLAS.H, x1 / ATLAS.W, 1 - y0 / ATLAS.H];
/** facade column (0 = bay, 1 = bay with other lighting, 2 = door bay) from height h0..h1 (m) */
export function facadeUV(col, h0, h1) {
  const k = (ATLAS.H - ATLAS.facadeTop) / ATLAS.facadeH;
  return [col * ATLAS.colW / ATLAS.W + 0.002, (h0 * k) / ATLAS.H, ((col + 1) * ATLAS.colW) / ATLAS.W - 0.002, (h1 * k) / ATLAS.H];
}
export const REGION = {
  sign: px(0, 0, 384, 64), dormer: px(0, 64, 128, 224), lancet: px(128, 64, 256, 224), brick: px(256, 64, 384, 224),
  union: px(0, 224, 192, 384), navy: px(192, 224, 384, 384),
};

function archPts(cx, ys, w, rise, seg = 7) {
  const c = (rise * rise - (w * w) / 4) / w, R = c + w / 2, out = [];
  const aTop = Math.atan2(rise, -c);           // left arc centred at (cx + c, ys)
  for (let i = 0; i <= seg; i++) { const a = Math.PI + (aTop - Math.PI) * (i / seg); out.push([cx + c + R * Math.cos(a), ys + R * Math.sin(a)]); }
  const aTop2 = Math.atan2(rise, c);           // right arc centred at (cx - c, ys)
  for (let i = 1; i <= seg; i++) { const a = aTop2 + (0 - aTop2) * (i / seg); out.push([cx - c + R * Math.cos(a), ys + R * Math.sin(a)]); }
  return out;
}
function pathArch(g, cx, y0, ys, w, rise) {
  const p = archPts(cx, ys, w, rise);
  g.beginPath(); g.moveTo(cx - w / 2, y0); for (const q of p) g.lineTo(q[0], q[1]); g.lineTo(cx + w / 2, y0); g.closePath();
}

function bricks(g, x0, y0, w, h, r) {
  g.fillStyle = '#ddd0ac'; g.fillRect(x0, y0, w, h);       // mortar
  const ch = 0.075, bw = 0.225;
  for (let y = y0, row = 0; y < y0 + h; y += ch, row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = x0 - off; x < x0 + w; x += bw) {
      const v = r(), k = 0.9 + v * 0.18;
      const base = v < 0.07 ? [196, 168, 112] : [214, 190, 132];
      g.fillStyle = `rgb(${(base[0] * k) | 0},${(base[1] * k) | 0},${(base[2] * k) | 0})`;
      g.fillRect(x + 0.008, y + 0.008, bw - 0.016, ch - 0.014);
    }
  }
}

/** pointed two-light window. em = emissive context (or null), lit brightness 0..1 */
function windowGothic(g, em, cx, sill, apex, w, lit, ground) {
  const rise = w * 0.55, ys = apex - rise;
  // stone surround + alternating voussoirs
  g.fillStyle = '#e7dcc2'; pathArch(g, cx, sill - 0.05, ys, w + 0.44, rise + 0.26); g.fill();
  const out = archPts(cx, ys, w + 0.44, rise + 0.26, 9), inn = archPts(cx, ys, w + 0.06, rise + 0.03, 9);
  for (let i = 0; i < out.length - 1; i += 2) {
    g.fillStyle = '#cdb68e'; g.beginPath(); g.moveTo(out[i][0], out[i][1]); g.lineTo(out[i + 1][0], out[i + 1][1]); g.lineTo(inn[i + 1][0], inn[i + 1][1]); g.lineTo(inn[i][0], inn[i][1]); g.closePath(); g.fill();
  }
  // reveal shadow
  g.fillStyle = '#4b4238'; pathArch(g, cx, sill, ys, w + 0.06, rise + 0.03); g.fill();
  // tympanum stone
  g.fillStyle = '#ddd1b5'; pathArch(g, cx, ys - 0.35, ys, w - 0.08, rise - 0.06); g.fill();
  // roundel in the tympanum
  const rr = Math.min(0.2, w * 0.12), ry = ys + rise * 0.42;
  g.fillStyle = '#2a333c'; g.beginPath(); g.arc(cx, ry, rr, 0, Math.PI * 2); g.fill();
  if (em) { em.fillStyle = `rgba(255,255,255,${lit * 0.8})`; em.beginPath(); em.arc(cx, ry, rr, 0, Math.PI * 2); em.fill(); }
  // two lights
  const lw = (w - 0.26) / 2, lr = lw * 0.6;
  for (const s of [-1, 1]) {
    const lx = cx + s * (lw / 2 + 0.07), lys = ys - 0.12 - lr * 0.3;
    g.fillStyle = '#f0ede4'; pathArch(g, lx, sill + 0.02, lys, lw + 0.06, lr + 0.03); g.fill();  // frame
    g.fillStyle = '#28323d'; pathArch(g, lx, sill + 0.06, lys, lw - 0.04, lr - 0.03); g.fill();   // glass
    g.fillStyle = 'rgba(160,185,205,0.25)'; g.fillRect(lx - lw / 2 + 0.03, (sill + lys) / 2, lw * 0.35, (lys - sill) * 0.35); // sky reflection
    g.fillStyle = '#efece2';
    g.fillRect(lx - 0.02, sill + 0.06, 0.04, lys + lr - sill - 0.1);                                  // mullion bar
    g.fillRect(lx - lw / 2, sill + (lys - sill) * (ground ? 0.62 : 0.55), lw, 0.045);                 // sash rail
    if (em) { em.fillStyle = `rgb(${(255 * lit) | 0},${(235 * lit) | 0},${(200 * lit) | 0})`; pathArch(em, lx, sill + 0.06, lys, lw - 0.04, lr - 0.03); em.fill(); }
  }
  // engaged column with capital
  g.fillStyle = '#e9e0c8'; g.fillRect(cx - 0.065, sill, 0.13, ys - 0.1 - sill);
  g.fillStyle = '#d6c9aa'; g.fillRect(cx - 0.035, sill + 0.15, 0.07, ys - 0.45 - sill);  // shaft shading
  g.fillStyle = '#efe6cf'; g.fillRect(cx - 0.11, ys - 0.24, 0.22, 0.14);
  // sill
  g.fillStyle = '#e3d8bd'; g.fillRect(cx - w / 2 - 0.25, sill - 0.14, w + 0.5, 0.12);
  g.fillStyle = 'rgba(60,45,30,0.35)'; g.fillRect(cx - w / 2 - 0.25, sill - 0.2, w + 0.5, 0.06);
}

function doorway(g, em, cx) {
  const w = 2.3, rise = 1.3, ys = 3.95 - rise;
  g.fillStyle = '#e7dcc2'; pathArch(g, cx, 0, ys, w + 0.6, rise + 0.32); g.fill();
  g.fillStyle = '#3a2a1c'; pathArch(g, cx, 0.3, ys, w, rise); g.fill();
  // fanlight
  g.fillStyle = '#2a3440'; pathArch(g, cx, ys - 0.05, ys, w - 0.25, rise - 0.15); g.fill();
  if (em) { em.fillStyle = '#ffe2b8'; pathArch(em, cx, ys - 0.05, ys, w - 0.25, rise - 0.15); em.fill(); }
  // double doors with glazed upper panels
  for (const s of [-1, 1]) {
    const dx = cx + s * w / 4;
    g.fillStyle = '#4a3322'; g.fillRect(dx - w / 4 + 0.06, 0.32, w / 2 - 0.12, ys - 0.45);
    g.fillStyle = '#2c3640'; g.fillRect(dx - w / 4 + 0.2, 1.4, w / 2 - 0.4, ys - 1.75);
    if (em) { em.fillStyle = '#d9b888'; em.fillRect(dx - w / 4 + 0.2, 1.4, w / 2 - 0.4, ys - 1.75); }
    g.fillStyle = '#c9a24a'; g.fillRect(dx - s * (w / 4 - 0.18), 1.15, 0.05, 0.25);  // brass handle
  }
  // steps
  g.fillStyle = '#cfc6b4'; g.fillRect(cx - w / 2 - 0.4, 0, w + 0.8, 0.16); g.fillStyle = '#bdb3a0'; g.fillRect(cx - w / 2 - 0.25, 0.16, w + 0.5, 0.14);
}

function stoneBands(g, x0, w) {
  g.fillStyle = '#e3d8bd'; g.fillRect(x0, 0, w, 0.55);                          // plinth
  g.fillStyle = '#cbbf9f'; g.fillRect(x0, 0.5, w, 0.05);
  for (const b of BANDS) {
    g.fillStyle = '#e8ddc3'; g.fillRect(x0, b - 0.1, w, 0.3);
    g.fillStyle = 'rgba(70,55,35,0.35)'; g.fillRect(x0, b - 0.16, w, 0.06);
  }
}

let _atlas = null;
/** {map, emissive} CanvasTextures (cached) */
export function randolphAtlas() {
  if (_atlas) return _atlas;
  const { W, H, colW, facadeTop, facadeH, bayW } = ATLAS;
  const A = canvas(W, H), E = canvas(W, H), g = A.g, e = E.g;
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const r = rng(77);
  const sx = colW / bayW, sy = (H - facadeTop) / facadeH;
  for (let col = 0; col < 3; col++) {
    const T = [sx, 0, 0, -sy, col * colW, H];
    g.setTransform(...T); e.setTransform(...T);
    bricks(g, 0, 0, bayW, facadeH, r);
    stoneBands(g, 0, bayW);
    STOREYS.forEach(([sill, apex, w], i) => {
      if (col === 2 && i === 0) { doorway(g, e, bayW / 2); return; }
      const lit = r() < (col === 1 ? 0.45 : 0.62) ? 0.45 + r() * 0.55 : 0.04;
      windowGothic(g, e, bayW / 2, sill, apex, w, lit, i === 0);
    });
    // eaves stone at the very top (pavilion cornice line)
    g.fillStyle = '#e3d8bd'; g.fillRect(0, 17.75, bayW, 0.25);
  }
  g.setTransform(1, 0, 0, 1, 0, 0); e.setTransform(1, 0, 0, 1, 0, 0);
  // ---- sign: THE RANDOLPH HOTEL, gilt on dark navy (fascia of the entrance canopy; design is a guess)
  g.fillStyle = '#18202c'; g.fillRect(0, 0, 384, 64);
  g.strokeStyle = '#c9a24a'; g.lineWidth = 2; g.strokeRect(4, 4, 376, 56);
  g.fillStyle = '#d8b65a'; g.font = 'bold 30px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('THE RANDOLPH HOTEL', 192, 34, 360);
  e.fillStyle = '#b89448'; e.font = g.font; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillText('THE RANDOLPH HOTEL', 192, 34, 360);
  // ---- dormer face: stone gable with one pointed light (region 128 x 160 px = 1.8 x 2.6 m)
  {
    const T = [128 / 1.8, 0, 0, -160 / 2.6, 0, 224];
    g.setTransform(...T); e.setTransform(...T);
    g.fillStyle = '#e4d9bf'; g.fillRect(0, 0, 1.8, 2.6);
    g.fillStyle = '#d2c3a0'; g.fillRect(0, 0, 1.8, 0.12);
    g.fillStyle = '#f0ede4'; pathArch(g, 0.9, 0.25, 1.35, 0.95, 0.5); g.fill();
    g.fillStyle = '#28323d'; pathArch(g, 0.9, 0.3, 1.35, 0.85, 0.44); g.fill();
    g.fillStyle = '#efece2'; g.fillRect(0.88, 0.3, 0.04, 1.45); g.fillRect(0.47, 0.95, 0.86, 0.04);
    e.fillStyle = '#c8b090'; pathArch(e, 0.9, 0.3, 1.35, 0.85, 0.44); e.fill();
  }
  // ---- tower top stage: paired louvred lancets (128 x 160 px = 3.6 x 2.6 m)
  {
    const T = [128 / 3.6, 0, 0, -160 / 2.6, 128, 224];
    g.setTransform(...T); e.setTransform(...T);
    g.fillStyle = '#e4d9bf'; g.fillRect(0, 0, 3.6, 2.6);
    g.fillStyle = '#cdbf9c'; g.fillRect(0, 2.35, 3.6, 0.25); g.fillRect(0, 0, 3.6, 0.15);
    for (const cx of [1.15, 2.45]) {
      g.fillStyle = '#d2c3a0'; pathArch(g, cx, 0.3, 1.55, 0.85, 0.55); g.fill();
      g.fillStyle = '#2b2620'; pathArch(g, cx, 0.36, 1.55, 0.7, 0.46); g.fill();
      g.fillStyle = '#5a5046'; for (let y = 0.5; y < 1.9; y += 0.18) g.fillRect(cx - 0.33, y, 0.66, 0.05);
      e.fillStyle = '#301a08'; pathArch(e, cx, 0.36, 1.55, 0.7, 0.46); e.fill();
    }
  }
  // ---- plain brick (chimneys)
  { const T = [128 / 1.8, 0, 0, -160 / 2.6, 256, 224]; g.setTransform(...T); bricks(g, 0, 0, 1.8, 2.6, r); }
  g.setTransform(1, 0, 0, 1, 0, 0); e.setTransform(1, 0, 0, 1, 0, 0);
  // ---- Union flag (0..192 x 224..384)
  {
    const x = 0, y = 224, w = 192, h = 160;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = '#012169'; g.fillRect(x, y, w, h);
    const diag = (lw, col) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke(); };
    diag(32, '#ffffff'); diag(11, '#c8102e');
    g.fillStyle = '#ffffff'; g.fillRect(x + w / 2 - 27, y, 54, h); g.fillRect(x, y + h / 2 - 27, w, 54);
    g.fillStyle = '#c8102e'; g.fillRect(x + w / 2 - 16, y, 32, h); g.fillRect(x, y + h / 2 - 16, w, 32);
    g.restore();
  }
  // ---- hotel house flag: navy with a gilt R (guess)
  {
    const x = 192, y = 224, w = 192, h = 160;
    g.fillStyle = '#16213a'; g.fillRect(x, y, w, h);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 5; g.strokeRect(x + 10, y + 10, w - 20, h - 20);
    g.fillStyle = '#d8b65a'; g.font = 'bold 96px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('R', x + w / 2, y + h / 2 + 6);
  }
  const map = canvasTexture(A.canvas), emissive = canvasTexture(E.canvas);
  map.generateMipmaps = emissive.generateMipmaps = true;
  map.minFilter = emissive.minFilter = THREE.LinearMipmapLinearFilter;
  _atlas = { map, emissive };
  return _atlas;
}

// ------------------------------------------------------------------------------------------------ interior pictures
/** framed "Inspector Morse" pictures for the bar: a red Mark 2 Jaguar, a crossword, a title card (no likenesses). */
export function morsePictures() {
  const C = canvas(512, 256), g = C.g;
  // 1: the red Jaguar outside a college gate
  g.fillStyle = '#d7c8a4'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#c4b088'; g.fillRect(0, 0, 256, 150);
  g.fillStyle = '#5a4630'; g.beginPath(); g.moveTo(70, 150); g.lineTo(70, 70); g.quadraticCurveTo(128, 20, 186, 70); g.lineTo(186, 150); g.fill();
  g.fillStyle = '#8a7a60'; g.fillRect(0, 150, 256, 106);
  g.fillStyle = '#8e1414'; g.beginPath(); g.moveTo(40, 200); g.lineTo(52, 172); g.lineTo(95, 160); g.lineTo(165, 160); g.lineTo(200, 175); g.lineTo(222, 182); g.lineTo(222, 205); g.lineTo(40, 205); g.fill();
  g.fillStyle = '#2a3038'; g.fillRect(100, 165, 30, 14); g.fillRect(136, 165, 30, 14);
  g.fillStyle = '#111'; for (const x of [78, 186]) { g.beginPath(); g.arc(x, 206, 15, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ddd'; for (const x of [78, 186]) { g.beginPath(); g.arc(x, 206, 6, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#3a2a1a'; g.font = 'italic 18px Georgia'; g.textAlign = 'center'; g.fillText('Inspector Morse', 128, 240);
  // 2: The Times crossword, half done, with a pint ring
  g.fillStyle = '#f2ecdc'; g.fillRect(256, 0, 256, 256);
  const r = rng(5);
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
    const x = 284 + i * 15, y = 30 + j * 15, black = (i % 2 === 1 && j % 2 === 1) || r() < 0.12;
    g.fillStyle = black ? '#151515' : '#fff'; g.fillRect(x, y, 14, 14);
    if (!black && r() < 0.45) { g.fillStyle = '#1a2a6a'; g.font = '11px sans-serif'; g.fillText(String.fromCharCode(65 + Math.floor(r() * 26)), x + 7, y + 11); }
  }
  g.strokeStyle = 'rgba(120,80,30,0.45)'; g.lineWidth = 5; g.beginPath(); g.arc(452, 200, 30, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#3a2a1a'; g.font = 'italic 16px Georgia'; g.fillText('"Seven down..."', 384, 240);
  const t = canvasTexture(C.canvas);
  return { texture: t, uv: [[0, 0, 0.5, 1], [0.5, 0, 1, 1]] };
}

/** striped Victorian wallpaper (lobby): deep crimson damask stripes with gilt pin lines, 1.2 m repeat */
export function wallpaper() {
  const S = 256, C = canvas(S, S), g = C.g;
  g.fillStyle = '#5e2326'; g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 64) {
    g.fillStyle = '#6c2a2c'; g.fillRect(x, 0, 32, S);                                    // satin stripe
    g.fillStyle = 'rgba(214,172,96,0.55)'; g.fillRect(x - 1, 0, 1.5, S); g.fillRect(x + 31.5, 0, 1.5, S);
    g.fillStyle = 'rgba(30,8,8,0.22)'; g.fillRect(x + 33, 0, 2, S);
    // damask sprigs down the matt stripe, ogee medallions down the satin one
    for (let y = 0; y < S; y += 64) {
      g.fillStyle = 'rgba(150,70,60,0.5)';
      g.beginPath(); g.ellipse(x + 48, y + 16, 5, 11, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + 41, y + 30, 6, 3, -0.6, 0, Math.PI * 2); g.ellipse(x + 55, y + 30, 6, 3, 0.6, 0, Math.PI * 2); g.fill();
      g.fillRect(x + 47.4, y + 24, 1.2, 22);
      g.fillStyle = 'rgba(60,14,16,0.45)';
      g.beginPath(); g.moveTo(x + 16, y + 34); g.quadraticCurveTo(x + 27, y + 48, x + 16, y + 62); g.quadraticCurveTo(x + 5, y + 48, x + 16, y + 34); g.fill();
      g.fillStyle = 'rgba(214,172,96,0.35)'; g.beginPath(); g.arc(x + 16, y + 48, 2.4, 0, Math.PI * 2); g.fill();
    }
  }
  const r = rng(11);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,220,200' : '0,0,0'},${0.02 + r() * 0.03})`; g.fillRect(r() * S, r() * S, 1, 2 + r() * 5); }
  const t = canvasTexture(C.canvas, { repeat: true }); t.repeat.set(1 / 1.2, 1 / 1.2);
  return t;
}

/**
 * One 1024 px atlas for the lobby's painted joinery and fittings: the two Morse pictures, an oak door leaf, the gilt
 * "MORSE BAR" board, a raised-and-fielded desk / counter panel, the key rack, a landscape painting, the back bar
 * (mirror, shelves of bottles), the lobby ceiling (cornice bands, coffers, plaster rose) and the hall rug.
 * Returns {texture, uv: {name: [u0, v0, u1, v1]}}.
 */
export function lobbyAtlas() {
  const W = 1024, C = canvas(W, W), g = C.g, uv = {};
  const cell = (name, x0, y0, x1, y1, draw) => {
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); g.translate(x0, y0); draw(x1 - x0, y1 - y0); g.restore();
    uv[name] = [(x0 + 1) / W, 1 - (y1 - 1) / W, (x1 - 1) / W, 1 - (y0 + 1) / W];
  };
  const r = rng(77);
  const grain = (w, h, n, a = 0.08) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,220,170'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 8 + r() * 40); } };
  /** raised-and-fielded panel */
  const panel = (x, y, w, h, base = '#4a2c16') => {
    g.fillStyle = '#20120a'; g.fillRect(x, y, w, h);
    g.fillStyle = base; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = 'rgba(255,210,150,0.16)'; g.fillRect(x + 3, y + 3, w - 6, 3); g.fillRect(x + 3, y + 3, 3, h - 6);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 3, y + h - 6, w - 6, 3); g.fillRect(x + w - 6, y + 3, 3, h - 6);
    g.fillStyle = 'rgba(255,220,170,0.07)'; g.fillRect(x + 12, y + 12, w - 24, h - 24);
  };
  // the Morse pictures (drawn by morsePictures) share the atlas
  g.drawImage(morsePictures().texture.image, 0, 0);
  uv.pic0 = [1 / W, 1 - 255 / W, 255 / W, 1 - 1 / W]; uv.pic1 = [257 / W, 1 - 255 / W, 511 / W, 1 - 1 / W];
  cell('door', 512, 0, 640, 412, (w, h) => {
    g.fillStyle = '#3a2212'; g.fillRect(0, 0, w, h); grain(w, h, 160);
    // glazed upper light with a brass push plate, two panels below
    g.fillStyle = '#20120a'; g.fillRect(14, 18, w - 28, 150);
    const gl = g.createLinearGradient(0, 22, 0, 164); gl.addColorStop(0, '#93a7b4'); gl.addColorStop(0.55, '#5c6f7c'); gl.addColorStop(1, '#3a4852');
    g.fillStyle = gl; g.fillRect(19, 23, w - 38, 140);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(24, 150); g.lineTo(60, 26); g.lineTo(78, 26); g.lineTo(42, 150); g.fill();
    g.fillStyle = '#20120a'; g.fillRect(w / 2 - 2, 23, 4, 140); g.fillRect(19, 90, w - 38, 4);
    panel(14, 184, w - 28, 96); panel(14, 292, w - 28, 104);
    g.fillStyle = '#c9a24a'; g.fillRect(w - 22, 196, 9, 60); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(w - 21, 198, 2, 56);
    g.fillStyle = '#7a5a22'; g.fillRect(0, h - 22, w, 22); g.fillStyle = 'rgba(255,230,160,0.25)'; g.fillRect(0, h - 22, w, 2);    // kick plate
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, 2, h);
  });
  cell('sign', 640, 0, 1024, 96, (w, h) => {
    g.fillStyle = '#0f1a14'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.strokeRect(7, 7, w - 14, h - 14); g.lineWidth = 1; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#e2c46c'; g.font = 'bold 44px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MORSE  BAR', w / 2, h / 2 + 3, w - 50);
  });
  cell('desk', 640, 96, 1024, 256, (w, h) => {
    g.fillStyle = '#3a2212'; g.fillRect(0, 0, w, h); grain(w, h, 300);
    for (let i = 0; i < 3; i++) panel(8 + i * (w / 3), 14, w / 3 - 16, h - 44, '#4c2e17');
    g.fillStyle = '#20120a'; g.fillRect(0, h - 22, w, 22); g.fillStyle = 'rgba(255,210,150,0.2)'; g.fillRect(0, h - 22, w, 2); g.fillRect(0, 6, w, 2);
  });
  cell('keys', 640, 256, 832, 412, (w, h) => {
    g.fillStyle = '#2c1a0e'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a3a1e'; g.fillRect(6, 6, w - 12, h - 12);
    // pigeon-holes with letters above, rows of brass room keys on red fobs below (pre-keycard: a guess for 2013)
    for (let j = 0; j < 3; j++) for (let i = 0; i < 9; i++) {
      const x = 10 + i * 19.2, y = 10 + j * 24;
      g.fillStyle = '#1c1008'; g.fillRect(x, y, 17, 21);
      if (r() < 0.45) { g.fillStyle = r() < 0.5 ? '#efe8d6' : '#d9e2ea'; g.fillRect(x + 2, y + 9 + r() * 4, 13, 9); }
    }
    for (let j = 0; j < 3; j++) for (let i = 0; i < 12; i++) {
      const x = 16 + i * 14.4, y = 92 + j * 20;
      g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill();
      if (r() < 0.8) { g.fillRect(x - 0.8, y, 1.6, 7); g.fillStyle = '#8a1c20'; g.fillRect(x - 3, y + 7, 6, 8); }
    }
  });
  cell('landscape', 832, 256, 1024, 412, (w, h) => {
    // a dark Victorian oil: evening sky, a river meadow, distant spires
    const sk = g.createLinearGradient(0, 0, 0, h * 0.6); sk.addColorStop(0, '#3d4a55'); sk.addColorStop(0.7, '#b59a6a'); sk.addColorStop(1, '#c9a66a');
    g.fillStyle = sk; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a4a3c'; for (const [x, hh, ww] of [[40, 34, 5], [70, 22, 9], [96, 44, 4], [128, 26, 12], [150, 30, 5]]) { g.fillRect(x, h * 0.58 - hh, ww, hh); g.beginPath(); g.moveTo(x - 1, h * 0.58 - hh); g.lineTo(x + ww / 2, h * 0.58 - hh - ww * 1.6); g.lineTo(x + ww + 1, h * 0.58 - hh); g.fill(); }
    g.fillStyle = '#2f3a24'; g.fillRect(0, h * 0.58, w, h * 0.42);
    g.fillStyle = '#26301c'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(r() * w, h * 0.6 + r() * 8, 14 + r() * 22, 9 + r() * 12, 0, 0, 7); g.fill(); }
    const rv = g.createLinearGradient(0, h * 0.7, 0, h); rv.addColorStop(0, '#9c8a62'); rv.addColorStop(1, '#4c4c40');
    g.fillStyle = rv; g.beginPath(); g.moveTo(w * 0.3, h * 0.68); g.quadraticCurveTo(w * 0.6, h * 0.8, w * 0.2, h); g.lineTo(w * 0.85, h); g.quadraticCurveTo(w * 0.8, h * 0.78, w * 0.42, h * 0.68); g.fill();
    g.fillStyle = 'rgba(40,24,8,0.28)'; g.fillRect(0, 0, w, h);
  });
  cell('backbar', 0, 412, 1024, 668, (w, h) => {
    g.fillStyle = '#26150a'; g.fillRect(0, 0, w, h);
    // three mirrored bays between pilasters
    for (let b = 0; b < 3; b++) {
      const x0 = 14 + b * (w / 3), bw = w / 3 - 28;
      const mg = g.createLinearGradient(x0, 0, x0 + bw, h); mg.addColorStop(0, '#4c5650'); mg.addColorStop(0.5, '#7d8a84'); mg.addColorStop(1, '#3c4440');
      g.fillStyle = mg; g.fillRect(x0, 12, bw, h - 24);
      g.fillStyle = 'rgba(255,240,200,0.10)'; g.beginPath(); g.moveTo(x0 + bw * 0.1, h - 12); g.lineTo(x0 + bw * 0.45, 12); g.lineTo(x0 + bw * 0.6, 12); g.lineTo(x0 + bw * 0.25, h - 12); g.fill();
      g.fillStyle = '#3a2212'; g.fillRect(x0 - 14, 0, 14, h); g.fillRect(x0 + bw, 0, 14, h);
      g.fillStyle = 'rgba(255,210,150,0.18)'; g.fillRect(x0 - 12, 0, 2, h); g.fillRect(x0 + bw + 2, 0, 2, h);
    }
    g.fillStyle = '#3a2212'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
    // shelves of bottles
    const cols = ['#1d4a1d', '#5a2a0a', '#cfd8d0', '#6a1010', '#8a6a1a', '#20304a', '#2a2a2a', '#b88a2a'];
    for (let s = 0; s < 3; s++) {
      const base = 84 + s * 80;
      g.fillStyle = '#2a170b'; g.fillRect(0, base, w, 7); g.fillStyle = 'rgba(255,210,150,0.25)'; g.fillRect(0, base, w, 1.5);
      for (let x = 22; x < w - 20; x += 15 + r() * 7) {
        const bh = 38 + r() * 22, bw = 9 + r() * 4, c = cols[Math.floor(r() * cols.length)];
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2, base - bh * 0.72, bw, bh * 0.72);
        g.fillStyle = c; g.fillRect(x, base - bh * 0.72, bw, bh * 0.72); g.fillRect(x + bw * 0.32, base - bh, bw * 0.36, bh * 0.3);
        g.beginPath(); g.moveTo(x, base - bh * 0.72); g.lineTo(x + bw * 0.32, base - bh * 0.84); g.lineTo(x + bw * 0.68, base - bh * 0.84); g.lineTo(x + bw, base - bh * 0.72); g.fill();
        g.fillStyle = r() < 0.6 ? '#efe6cc' : '#d8b04a'; g.fillRect(x + 1, base - bh * 0.5, bw - 2, bh * 0.24);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 1.5, base - bh * 0.7, 1.5, bh * 0.62);
        g.fillStyle = '#c9a24a'; g.fillRect(x + bw * 0.32, base - bh, bw * 0.36, 3);
      }
    }
  });
  cell('ceiling', 0, 668, 512, 1024, (w, h) => {
    g.fillStyle = '#ece5d2'; g.fillRect(0, 0, w, h);
    // moulded border, three coffers, the centre one with a plaster rose
    const line = (inset, lw, c) => { g.strokeStyle = c; g.lineWidth = lw; g.strokeRect(inset, inset * (h / w) + 0, w - inset * 2, h - inset * 2 * (h / w)); };
    line(8, 5, '#cfc5ad'); line(14, 2, '#fbf6ea'); line(20, 2, '#b9ae96'); line(30, 1.5, '#d9cfb8');
    for (let i = 0; i < 3; i++) {
      const x0 = 40 + i * ((w - 80) / 3) + 6, cw = (w - 80) / 3 - 12, y0 = 40, ch = h - 80;
      g.fillStyle = '#e4dcc6'; g.fillRect(x0, y0, cw, ch);
      g.strokeStyle = '#bdb298'; g.lineWidth = 3; g.strokeRect(x0, y0, cw, ch); g.strokeStyle = '#faf5e8'; g.lineWidth = 1.5; g.strokeRect(x0 + 5, y0 + 5, cw - 10, ch - 10);
      g.strokeStyle = '#c9a24a'; g.lineWidth = 1; g.strokeRect(x0 + 10, y0 + 10, cw - 20, ch - 20);
    }
    const cx = w / 2, cy = h / 2;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; g.fillStyle = k % 2 ? '#d2c8ae' : '#f6f0e0'; g.beginPath(); g.ellipse(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26 * (h / w) * 1.2, 13, 6, a, 0, 7); g.fill(); }
    g.fillStyle = '#c4b99e'; g.beginPath(); g.ellipse(cx, cy, 15, 15 * (h / w) * 1.2, 0, 0, 7); g.fill();
    g.fillStyle = '#8a7a4a'; g.beginPath(); g.ellipse(cx, cy, 5, 5, 0, 0, 7); g.fill();
    const sh = g.createRadialGradient(cx, cy, 20, cx, cy, w * 0.6); sh.addColorStop(0, 'rgba(255,236,190,0.25)'); sh.addColorStop(1, 'rgba(60,40,20,0.22)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
  });
  cell('rug', 512, 668, 1024, 1024, (w, h) => {
    g.fillStyle = '#5c1719'; g.fillRect(0, 0, w, h);
    // fringe, guard borders, a field of repeated guls with a central medallion
    g.fillStyle = '#d8c9a0'; for (let y = 2; y < h; y += 4) { g.fillRect(0, y, 7, 1.5); g.fillRect(w - 7, y, 7, 1.5); }
    const border = (i, c, lw) => { g.strokeStyle = c; g.lineWidth = lw; g.strokeRect(8 + i, i, w - 16 - i * 2, h - i * 2); };
    border(4, '#1c2a44', 8); border(12, '#c9a24a', 2); border(22, '#e2d2a8', 12); border(32, '#1c2a44', 3);
    for (let x = 22; x < w - 20; x += 16) { g.fillStyle = '#8a1c20'; g.fillRect(x, 17, 7, 9); g.fillRect(x, h - 27, 7, 9); }
    for (let y = 30; y < h - 30; y += 16) { g.fillStyle = '#8a1c20'; g.fillRect(25, y, 9, 7); g.fillRect(w - 34, y, 9, 7); }
    for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) {
      const x = 70 + i * 47, y = 62 + j * 58, alt = (i + j) % 2;
      g.fillStyle = alt ? '#1c2a44' : '#c9a24a';
      g.beginPath(); g.moveTo(x, y - 15); g.lineTo(x + 13, y); g.lineTo(x, y + 15); g.lineTo(x - 13, y); g.fill();
      g.fillStyle = alt ? '#e2d2a8' : '#5c1719'; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 6, y); g.lineTo(x, y + 7); g.lineTo(x - 6, y); g.fill();
    }
    g.fillStyle = '#1c2a44'; g.beginPath(); g.ellipse(w / 2, h / 2, 74, 50, 0, 0, 7); g.fill();
    g.fillStyle = '#e2d2a8'; g.beginPath(); g.ellipse(w / 2, h / 2, 60, 38, 0, 0, 7); g.fill();
    g.fillStyle = '#8a1c20'; g.beginPath(); g.ellipse(w / 2, h / 2, 42, 24, 0, 0, 7); g.fill();
    g.fillStyle = '#c9a24a'; g.beginPath(); g.ellipse(w / 2, h / 2, 14, 9, 0, 0, 7); g.fill();
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.07})`; g.fillRect(r() * w, r() * h, 2, 1); }
  });
  const t = canvasTexture(C.canvas);
  return { texture: t, uv };
}
