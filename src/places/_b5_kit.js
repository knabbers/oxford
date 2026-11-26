// Shared kit for the batch-5 landmarks (new_college.js, merton.js, oxford_union.js, keble.js) — see
// docs/research/landmarks_batch5.md.
//
// ONE draw for all four sites, as batch 4 (_b4_kit.js) and Radcliffe Square (_rad_lod.js): every site registers LOD groups
// (near / mid / far chunks) into one shared vertex buffer drawn with one atlas material; a dynamic index lists the chunks
// drawn this frame. The first update of any batch-5 module after every batch-5 module has installed builds the buffer.
//
// The atlas (4 x 5 cells of 512 px): ashlar, coursed rubble, lead, slate, flags and the whole-cell window / door units
// (leaded, Perpendicular, mullion-and-transom, plank door, arched door, belfry louvre, statue niche) are COPIED from the
// Radcliffe Square atlas canvas (_rad_atlas.js; the glass mask of a copied unit is recovered from its colours); Keble's
// polychrome brick, Victorian red brick, Stonesfield-type stone slates, the cobbles of Merton Street, evergreen foliage,
// a big Geometric-tracery window and the painted lettering are painted here. Material: the city's atlas shader with the
// ground-layer bias on (`layered`), so the cobbles (aLayer 6.5) sort between the street's setts and the footpaths.
import * as THREE from 'three';
import { settleLater } from '../world/_geo_free.js';
import { repaintableAll, canvasOf } from '../world/_tex_keep.js';
import { radPack } from './_rad_atlas.js';
import { Batch, frame, rectPts, archPts } from './_worcester_kit.js';
import { RB } from './_rad_kit.js';
import { B6_CELLS, paintB6, b6Keys } from './_b6_cells.js';   // batch 6: rows 5-6 (rows 0-4 unchanged)
import { ROUGH } from '../world/textures.js';

export { Batch, RB, frame, rectPts, archPts };
export const TAU = Math.PI * 2;
export const NX = 4, NY = 7, CS = 512, AS = 256;
const CELLS = ['ashlar', 'rubble', 'poly', 'brick', 'lead', 'slate', 'stoneSlate', 'plain', 'flags', 'cobbles', 'leaded', 'perp', 'mullion', 'door', 'archDoor', 'louvre', 'niche', 'foliage', 'bigWin', 'signs', ...B6_CELLS];
export const CELL = Object.fromEntries(CELLS.map((n, i) => [n, i]));
// where each copied cell sits in the Radcliffe atlas (4 x 5, row-major)
const FROM_RAD = { ashlar: 0, rubble: 2, lead: 4, slate: 5, flags: 6, leaded: 11, perp: 12, mullion: 13, door: 14, archDoor: 15, louvre: 18, niche: 19 };
const UNITS = new Set(['leaded', 'perp', 'mullion', 'door', 'archDoor', 'louvre', 'niche']);
const GLASS_A = 'rgb(255,0,0)', STONE_A = 'rgb(0,255,0)', OFF_A = 'rgb(0,0,0)';

function newCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;
function grain(g, S, amp, r) { try { const img = g.getImageData(0, 0, S, S), d = img.data; if (!d || !d.length) return; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amp; d[i] += n; d[i + 1] += n * 0.9; d[i + 2] += n * 0.8; } g.putImageData(img, 0, 0); } catch { /* stub canvas */ } }

// ---- painters ----------------------------------------------------------------------------------------------------
/** one course of bricks (stretchers / headers) from y to y + ch in colour fn */
function course(g, r, S, y, ch, bl, header, col) {
  const w = header ? bl / 2 : bl, off = header ? bl / 4 : (Math.floor(y / ch) % 2) * bl / 2;
  for (let x = -w + off; x < S + w; x += w) {
    const [cr, cg, cb] = col(r());
    g.fillStyle = rgb(cr, cg, cb); g.fillRect(x + 1, y + 1, w - 2, ch - 2);
    g.fillStyle = 'rgba(255,232,210,0.10)'; g.fillRect(x + 1, y + 1, w - 2, 1.2);
    g.fillStyle = 'rgba(30,10,4,0.20)'; g.fillRect(x + 1, y + ch - 2.2, w - 2, 1.2);
  }
}
const RED = (k) => [146 + k * 40, 62 + k * 22, 46 + k * 16];
const BLUE = (k) => [44 + k * 18, 46 + k * 16, 58 + k * 18];
const BUFF = (k) => [222 + k * 20, 206 + k * 18, 168 + k * 16];
// Victorian red brick (the Oxford Union), Flemish-ish bond, 2.4 m repeat (32 courses)
function paintBrick(g, S) {
  const r = rnd(43), n = 32, ch = S / n, bl = S / 9;
  g.fillStyle = '#b3a593'; g.fillRect(0, 0, S, S);
  for (let c = 0; c < n; c++) course(g, r, S, c * ch, ch, bl, false, (k) => (r() < 0.08 ? [104 + k * 20, 48 + k * 12, 40 + k * 10] : [156 + k * 36, 70 + k * 20, 52 + k * 16]));
  grain(g, S, 14, r);
}
// Butterfield's polychrome brick (Keble), 3.2 m repeat (40 courses): red ground; from the bottom a band of buff stone,
// a chequer of blue headers, a red field with a blue zig-zag (diaper), a thin blue band, a broad buff band, red again
function paintPoly(g, S) {
  const r = rnd(97), n = 40, ch = S / n, bl = S / 10;
  g.fillStyle = '#b8aa96'; g.fillRect(0, 0, S, S);
  for (let c = 0; c < n; c++) {
    const y = S - (c + 1) * ch, band = c;
    if (band < 3 || (band >= 24 && band < 27)) { // buff stone bands (dressed: wide blocks)
      const blk = S / 4;
      for (let x = (band % 2) * blk / 2 - blk; x < S + blk; x += blk) { const k = r(); g.fillStyle = rgb(...BUFF(k)); g.fillRect(x + 1, y + 1, blk - 2, ch - 2); }
      continue;
    }
    if (band === 3 || band === 4) { course(g, r, S, y, ch, bl, true, (k) => ((Math.floor((r() * 1e3)) % 2) ? BLUE(k) : RED(k))); continue; }
    if (band === 15 || band === 23 || band === 27 || band === 28) { course(g, r, S, y, ch, bl, false, BLUE); continue; }
    course(g, r, S, y, ch, bl, false, RED);
  }
  // the diaper: blue lozenges of headers in the red field (courses 6..13)
  g.save(); g.globalAlpha = 0.9;
  const yb = S - 14 * ch, h = 8 * ch, pw = S / 4;
  for (let i = 0; i < 4; i++) {
    const x0 = i * pw;
    g.fillStyle = rgb(...BLUE(0.4));
    g.beginPath(); g.moveTo(x0 + pw / 2, yb); g.lineTo(x0 + pw, yb + h / 2); g.lineTo(x0 + pw / 2, yb + h); g.lineTo(x0, yb + h / 2); g.closePath();
    g.lineWidth = ch * 0.9; g.strokeStyle = rgb(...BLUE(0.3)); g.stroke();
  }
  g.restore();
  // the mortar grid over the diaper strokes
  g.fillStyle = 'rgba(180,170,150,0.55)'; for (let c = 0; c <= n; c++) g.fillRect(0, c * ch - 0.8, S, 1.4);
  grain(g, S, 14, r);
}
// stone slates (Stonesfield / Cotswold type): diminishing courses, buff-grey with lichen
function paintStoneSlate(g, S) {
  const r = rnd(61); let y = 0, rowH = S / 9;
  g.fillStyle = '#5c5548'; g.fillRect(0, 0, S, S);
  const rows = []; for (let k = 0; k < 13 && y < S; k++) { const h = rowH * (1.25 - k * 0.04); rows.push([y, h]); y += h; }
  const sc = S / y; // fit exactly
  for (const [y0, h0] of rows) {
    const yy = y0 * sc, h = h0 * sc; let x = -r() * 40;
    while (x < S) { const w = 26 + r() * 44, t = r() * 34, lich = r() < 0.18; g.fillStyle = lich ? rgb(150 + t, 142 + t, 96 + t) : rgb(128 + t, 118 + t, 98 + t); g.fillRect(x + 1, yy, w - 2, h - 2); g.fillStyle = 'rgba(20,16,10,0.42)'; g.fillRect(x + 1, yy + h - 4, w - 2, 3); x += w; }
  }
  grain(g, S, 10, r);
}
// Merton Street's cobbles: rounded river pebbles set on end, in rows across the street, with a sett border band
function paintCobbles(g, S) {
  const r = rnd(5);
  g.fillStyle = '#4e4a42'; g.fillRect(0, 0, S, S);
  if (ROUGH) {
    // roughness pass: laid by hand — rows that wander, pebbles of every size, earth and moss where the bedding shows,
    // the odd one sunk. (Each row is fitted to the tile's width and drawn round its edge, so the tile still repeats.)
    for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? 'rgba(74,88,46,0.5)' : 'rgba(98,84,60,0.45)'; g.beginPath(); g.arc(r() * S, r() * S, S * (0.006 + r() * 0.016), 0, TAU); g.fill(); }
    const n = 21, d = S / n;
    for (let j = 0; j < n; j++) {
      const ws = []; let sum = 0; while (sum < S - d * 0.5) { const w = d * (0.62 + r() * 0.9); ws.push(w); sum += w; }
      const sc = S / sum, ph = r() * TAU, amp = d * (0.08 + r() * 0.16); let x = r() * d;
      for (const w0 of ws) {
        const w = w0 * sc, cx = x + w / 2, cy = (j + 0.5) * d + Math.sin(ph + cx / S * TAU * 2) * amp + (r() - 0.5) * d * 0.16;
        // (photo comparison item 19: they read as pale ovals on brown, "polka dots"; the real ones are close-packed,
        // dark grey-pink and irregular — bigger stones, less gap, darker and warmer, a softer highlight)
        const rx = w * (0.48 + r() * 0.07), ry = d * (0.42 + r() * 0.12), sunk = r() < 0.05, t = sunk ? -26 : r() * 30 - 8, warm = r() < 0.45 ? 12 : r() < 0.15 ? -6 : 0, rot = (r() - 0.5) * 0.7;
        for (const xx of [cx, cx - S, cx + S]) {
          if (xx < -d || xx > S + d) continue;
          const gr = g.createRadialGradient(xx - rx * 0.3, cy - ry * 0.3, 1, xx, cy, Math.max(rx, ry) * 1.1);
          gr.addColorStop(0, rgb(128 + t + warm, 116 + t, 110 + t - warm * 0.5)); gr.addColorStop(1, rgb(82 + t * 0.5, 74 + t * 0.5, 70 + t * 0.5));
          g.fillStyle = gr; g.beginPath(); g.ellipse(xx, cy, rx, ry, rot, 0, TAU); g.fill();
        }
        x += w;
      }
    }
    grain(g, S, 8, r);
    return;
  }
  const n = 22, d = S / n;
  for (let j = 0; j < n; j++) for (let i = -1; i <= n; i++) {
    const cx = (i + (j % 2) * 0.5 + (r() - 0.5) * 0.25) * d, cy = (j + 0.5 + (r() - 0.5) * 0.2) * d, rx = d * (0.38 + r() * 0.1), ry = d * (0.34 + r() * 0.1), t = r() * 50, warm = r() < 0.4 ? 12 : 0;
    const gr = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.3, 1, cx, cy, rx * 1.1);
    gr.addColorStop(0, rgb(170 + t + warm, 162 + t, 146 + t - warm)); gr.addColorStop(1, rgb(92 + t * 0.5, 86 + t * 0.5, 76 + t * 0.5));
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, r() * 3, 0, TAU); g.fill();
  }
  grain(g, S, 8, r);
}
// evergreen foliage (the holm oak, yews, the Mound's planting): dark glossy leaves in clumps
function paintFoliage(g, S) {
  const r = rnd(17);
  g.fillStyle = '#1f2a18'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = r() * S, y = r() * S, k = r(), L = 5 + r() * 9, a = r() * TAU;
    g.fillStyle = k < 0.15 ? rgb(118, 130, 84) : rgb(38 + k * 46, 56 + k * 52, 28 + k * 30);
    g.beginPath(); g.ellipse(x, y, L, L * 0.45, a, 0, TAU); g.fill();
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(6,10,4,0.35)'; g.beginPath(); g.ellipse(r() * S, r() * S, 14 + r() * 26, 8 + r() * 14, r() * 3, 0, TAU); g.fill(); }
}
// a great pointed window with Geometric tracery (Merton's east window; also Keble's high windows): 7 lights, a big
// cusped circle in the head and two smaller ones, on a stone ground
function paintBigWin(g, a, S) {
  const st = (k = 1) => rgb(209 * k, 186 * k, 140 * k);
  g.fillStyle = st(); g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const m = S * 0.05, ys = S * 0.5, w = S - 2 * m;
  const arch = (c, d = 0) => { c.moveTo(m + d, S - m); c.lineTo(m + d, ys); c.quadraticCurveTo(m + d, m + d + (ys - m) * 0.25, S / 2, m + d); c.quadraticCurveTo(S - m - d, m + d + (ys - m) * 0.25, S - m - d, ys); c.lineTo(S - m - d, S - m); c.closePath(); };
  g.strokeStyle = 'rgba(48,32,12,0.6)'; g.lineWidth = S * 0.02; g.beginPath(); arch(g, -S * 0.02); g.stroke();
  for (const c of [g, a]) { c.save(); c.beginPath(); arch(c); c.clip(); }
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#5b6a78'); gr.addColorStop(0.5, '#3d4955'); gr.addColorStop(1, '#2a323b');
  g.fillStyle = gr; g.fillRect(0, 0, S, S); a.fillStyle = GLASS_A; a.fillRect(0, 0, S, S);
  // stained-glass speckle (abstract colours)
  const r = rnd(29); for (let i = 0; i < 500; i++) { const t = r(); g.fillStyle = t < 0.25 ? 'rgba(150,40,40,0.35)' : t < 0.5 ? 'rgba(40,60,140,0.35)' : t < 0.65 ? 'rgba(190,160,60,0.35)' : 'rgba(220,220,210,0.18)'; g.fillRect(r() * S, r() * S, 4, 6); }
  const stone = (fn) => { for (const [c, col] of [[g, st(1.02)], [a, STONE_A]]) { c.fillStyle = col; c.beginPath(); fn(c); c.fill(); } };
  const lights = 7, lw = w / lights, mw = S * 0.018;
  for (let i = 1; i < lights; i++) stone((c) => c.rect(m + i * lw - mw / 2, ys - S * 0.02, mw, S));
  // cusped heads of the lights
  for (let i = 0; i < lights; i++) { const x0 = m + i * lw + mw / 2, ww = lw - mw; stone((c) => { c.rect(x0, ys - S * 0.02, ww, ww * 0.25); }); }
  // the head: a stone field pierced by three circles (one big, two small) with foils
  const ring = (cx, cy, R) => {
    for (const [c, col] of [[g, st(1.02)], [a, STONE_A]]) { c.strokeStyle = col; c.lineWidth = mw * 1.4; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke(); }
    for (let k = 0; k < 6; k++) { const t = (k / 6) * TAU; stone((c) => c.arc(cx + Math.sin(t) * R * 0.62, cy + Math.cos(t) * R * 0.62, R * 0.12, 0, TAU)); }
  };
  ring(S / 2, S * 0.27, S * 0.15); ring(S * 0.27, S * 0.42, S * 0.075); ring(S * 0.73, S * 0.42, S * 0.075);
  for (const c of [g, a]) c.restore();
  g.fillStyle = 'rgba(30,18,6,0.35)'; g.fillRect(m, S - m - S * 0.012, w, S * 0.012);
}
// painted lettering (real institution names as plain lettering; invented notices; plain-history plaques)
export const SIGN_ROWS = ['newcoll', 'merton', 'union', 'keble', 'mound', 'grass', 'debate', 'time', 'wall', 'plaque'];
function paintSigns(g, a, S) {
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, S, S); a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const n = SIGN_ROWS.length, rowH = S / n;
  const fit = (t, w, size, font) => { g.font = `bold ${size}px ${font}`; const mw = g.measureText(t).width; return mw > w ? Math.floor(size * w / mw) : size; };
  const board = (row, bg, fg, lines, font = 'Georgia, "Times New Roman", serif') => {
    const y = row * rowH; g.fillStyle = bg; g.fillRect(0, y, S, rowH); g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(4, y + 4, S - 8, rowH - 8);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((t, k) => { const sz = fit(t, S - 30, lines.length > 1 ? 18 : 30, font); g.font = `bold ${sz}px ${font}`; g.fillText(t, S / 2, y + rowH * (k + 0.5) / lines.length + 1); });
  };
  board(0, '#14161c', '#e2d8bc', ['NEW COLLEGE']);
  board(1, '#14161c', '#e2d8bc', ['MERTON COLLEGE']);
  board(2, '#1a2a4a', '#f0e6c8', ['OXFORD UNION SOCIETY']);
  board(3, '#14161c', '#e2d8bc', ['KEBLE COLLEGE']);
  board(4, '#f1ede2', '#2a3a22', ['THE MOUND', 'Visitors may climb by the steps'], 'Arial, sans-serif');
  board(5, '#f1ede2', '#7a1c2c', ['PLEASE KEEP OFF THE GRASS', 'By order of the Porters'], 'Arial, sans-serif');
  board(6, '#1a2a4a', '#f0e6c8', ['DEBATE TONIGHT  ·  8.30 PM', 'Members and guests'], 'Arial, sans-serif');
  board(7, '#f1ede2', '#1b2a4a', ['MOB QUAD', 'Please respect the quiet of the college'], 'Arial, sans-serif');
  board(8, '#f1ede2', '#3a2a12', ['THE CITY WALL', 'Built c. 1226-40; kept by the college since 1379'], 'Arial, sans-serif');
  board(9, '#cfc4a6', '#3c2e18', ['FOUNDED 1379 BY WILLIAM OF WYKEHAM', 'BISHOP OF WINCHESTER'], 'Georgia, serif');
}

let ATLAS = null;
function paintAtlas(world) {
  if (ATLAS) return ATLAS;
  const c = newCanvas(NX * CS, NY * CS), g = c.getContext('2d'), ac = newCanvas(NX * AS, NY * AS), a = ac.getContext('2d');
  a.fillStyle = STONE_A; a.fillRect(0, 0, NX * AS, NY * AS);
  const pad = 0.016 * CS, span = CS - 2 * pad;
  const at = (name) => { const i = CELL[name]; return [(i % NX) * CS, Math.floor(i / NX) * CS, (i % NX) * AS, Math.floor(i / NX) * AS]; };
  const tile = (name, paint) => {
    const [x, y] = at(name), t = newCanvas(CS), tg = t.getContext('2d'); paint(tg, CS);
    g.save(); g.beginPath(); g.rect(x, y, CS, CS); g.clip();
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) g.drawImage(t, x + pad + dx * span, y + pad + dy * span, span, span);
    g.restore();
  };
  const unit = (name, paint) => {
    const [x, y, ax, ay] = at(name);
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, CS, CS); g.clip();
    a.save(); a.translate(ax, ay); a.beginPath(); a.rect(0, 0, AS, AS); a.clip(); a.scale(AS / CS, AS / CS);
    paint(g, a, CS); g.restore(); a.restore();
  };
  let src = null; try { const P = radPack(world); src = P.atlas.map && canvasOf(P.atlas.map); } catch { src = null; }
  for (const [name, ri] of Object.entries(FROM_RAD)) {
    const [x, y, ax, ay] = at(name);
    if (src) { try { g.drawImage(src, (ri % 4) * CS, Math.floor(ri / 4) * CS, CS, CS, x, y, CS, CS); } catch { /* stub */ } }
    else { g.fillStyle = '#cbb488'; g.fillRect(x, y, CS, CS); }
    // the glass of a copied unit: bluish-grey pixels (the rad painters' glass is cool, their stone and wood warm)
    if (UNITS.has(name)) {
      try {
        const img = g.getImageData(x, y, CS, CS), d = img.data;
        if (d && d.length && d.some((v) => v)) {
          const out = a.getImageData(ax, ay, AS, AS), o = out.data, k = CS / AS;
          for (let j = 0; j < AS; j++) for (let i = 0; i < AS; i++) {
            const p = ((j * k) * CS + i * k) * 4, R = d[p], G = d[p + 1], B = d[p + 2], q = (j * AS + i) * 4;
            const glass = B > R + 4 && B > 40 && name !== 'door' && name !== 'archDoor' && name !== 'louvre' && name !== 'niche';
            o[q] = glass ? 255 : 0; o[q + 1] = glass ? 0 : 255; o[q + 2] = 0; o[q + 3] = 255;
          }
          a.putImageData(out, ax, ay);
        }
      } catch { /* stub */ }
    }
  }
  tile('poly', paintPoly); tile('brick', paintBrick); tile('stoneSlate', paintStoneSlate); tile('cobbles', paintCobbles); tile('foliage', paintFoliage);
  tile('plain', (t, S) => { t.fillStyle = '#ffffff'; t.fillRect(0, 0, S, S); });
  unit('bigWin', paintBigWin); unit('signs', paintSigns);
  paintB6(tile, unit);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  const aux = new THREE.CanvasTexture(ac);
  aux.colorSpace = THREE.NoColorSpace; aux.wrapS = aux.wrapT = THREE.RepeatWrapping; aux.minFilter = THREE.LinearMipmapLinearFilter; aux.magFilter = THREE.LinearFilter;
  const again = () => { const k = ATLAS; ATLAS = null; try { return paintAtlas(); } finally { ATLAS = k; } };      // (memory pass: painted again by this function, its cache set aside for the call, if the card ever needs the picture again: world/_tex_keep.js)
  return (ATLAS = repaintableAll({ tex, aux, canvas: c }, again, 'batch-5 atlas'));
}

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
let PACK = null;
/** pack for Batch.build: key -> {cell, rx, ry, ox, oy, tint, seed}; tiles take metres, units / sub-rects take 0..1 */
export function b5Pack(world) {
  if (PACK) return PACK;
  const { tex, aux } = paintAtlas(world);
  const K = new Map();
  const add = (key, name, m, tint = 0xffffff, o = {}) => K.set(key, { cell: CELL[name], rx: m ? 1 / m : 0, ry: m ? 1 / m : 0, ox: 0, oy: 0, tint: Array.isArray(tint) ? tint : lin(tint), seed: 0, ...o });
  // masonry: New College's and Merton's old work is a greyer, weathered limestone; dressings paler
  add('stone', 'ashlar', 3.2); add('stoneGrey', 'ashlar', 3.2, [0.93, 0.92, 0.88]); add('stoneDk', 'ashlar', 3.2, [0.72, 0.7, 0.64]);
  add('dress', 'ashlar', 3.2, [1.1, 1.09, 1.05]); add('stoneShade', 'ashlar', 3.2, [0.42, 0.39, 0.33]);
  add('rubble', 'rubble', 4, [0.98, 0.95, 0.9]); add('rubbleGrey', 'rubble', 4, [0.88, 0.86, 0.82]); add('wallOld', 'rubble', 4, [0.82, 0.8, 0.74]);
  add('poly', 'poly', 3.2); add('polyDk', 'poly', 3.2, [0.8, 0.78, 0.76]);
  add('brick', 'brick', 2.4); add('brickDk', 'brick', 2.4, [0.8, 0.76, 0.74]);
  add('lead', 'lead', 2.4, [0.78, 0.8, 0.84]); add('slate', 'slate', 2.4); add('slateBlue', 'slate', 2.4, [0.92, 0.95, 1.05]);
  add('stoneSlate', 'stoneSlate', 3); add('turf', 'foliage', 2.6, [1.15, 1.45, 0.8]); add('flags', 'flags', 3); add('cobbles', 'cobbles', 3.2);
  add('foliage', 'foliage', 3); add('foliageDk', 'foliage', 3, [0.7, 0.72, 0.68]); add('hedge', 'foliage', 2, [0.9, 1.05, 0.85]);
  add('leaded', 'leaded', 1); add('perp', 'perp', 1, [0.97, 0.96, 0.93]); add('mullion', 'mullion', 1, [0.97, 0.96, 0.93]);
  add('door', 'door', 1, 0x6a4a30); add('doorDark', 'door', 1, 0x26302a); add('archDoor', 'archDoor', 1, 0x6a4a30); add('archDoorDk', 'archDoor', 1, 0x2a2f2c);
  add('louvre', 'louvre', 1, [0.95, 0.94, 0.9]); add('niche', 'niche', 1, [0.96, 0.95, 0.92]); add('bigWin', 'bigWin', 1);
  for (const [k, col] of Object.entries({ white: 0xeeebe2, cream: 0xe8dcc0, iron: 0x1d1e21, dark: 0x0d0d0e, shade: [0.06, 0.055, 0.05], green: 0x2c4a36, lawn: [0.2, 0.34, 0.12],
    bark: 0x3b3128, oak: 0x6a4a30, gold: 0xc9a54a, statue: [0.8, 0.74, 0.6], statueDk: [0.58, 0.53, 0.44], terracotta: [0.72, 0.34, 0.22], bench: 0x5a3e26, leather: 0x2a3d2c, gravel: [0.72, 0.64, 0.5], earth: [0.36, 0.3, 0.22], flowerPink: [0.75, 0.3, 0.45], flowerBlue: [0.32, 0.3, 0.7], flowerGold: [0.85, 0.65, 0.15] })) add(k, 'plain', 1, col);
  SIGN_ROWS.forEach((n, i) => add('sign_' + n, 'signs', 0, 0xffffff, { rx: 0.99, ry: 1 / SIGN_ROWS.length - 0.004, ox: 0.005, oy: 1 - (i + 1) / SIGN_ROWS.length + 0.002 }));
  b6Keys(add);
  const atlas = world.atlasMaterial({ map: tex, aux, n: NX, ny: NY, ao: true, weather: true, weatherCells: 4, windows: true, layered: true, roughness: 0.9, name: 'b5-atlas', surf: world.surf && world.surf.kit(CELLS) });
  PACK = { atlas, cells: K, ground: null, groundCells: null, glow: null, glowCells: null, nCells: CELLS.length };
  return PACK;
}

// ------------------------------------------------------------------------------------------------ LOD (as _b4_kit.js)
const ATTRS = [['position', 3], ['normal', 3], ['uv', 2], ['aCell', 4], ['aTint', 3], ['aTop', 1], ['aLayer', 1]];
export function geoOf(B, pack) {
  const tmp = new THREE.Group();
  B.build({}, tmp, { pack, noShadow: true });
  const geos = tmp.children.filter((m) => m.isMesh && m.material === pack.atlas).map((m) => m.geometry);
  for (const m of tmp.children) if (m.material !== pack.atlas) m.geometry.dispose();
  if (!geos.length) return null;
  return geos.length === 1 ? geos[0] : concat(geos);
}
function concat(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const [name, sz] of ATTRS) {
    if (name === 'aLayer') continue;
    const arr = new Float32Array(n * sz); let o = 0;
    for (const g of geos) { const a = g.attributes[name], c = g.attributes.position.count; if (a) arr.set(a.array, o * sz); else if (name === 'aTop') arr.fill(1e4, o, o + c); o += c; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  return out;
}
/** a copy of a non-indexed geometry without its triangles smaller than minArea m² */
export function farCopy(geo, minArea) {
  if (!geo) return null;
  const P = geo.attributes.position.array, nT = P.length / 9, keep = [];
  for (let t = 0; t < nT; t++) {
    const o = t * 9, ax = P[o + 3] - P[o], ay = P[o + 4] - P[o + 1], az = P[o + 5] - P[o + 2], bx = P[o + 6] - P[o], by = P[o + 7] - P[o + 1], bz = P[o + 8] - P[o + 2];
    if (0.5 * Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) >= minArea) keep.push(t);
  }
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) {
    const sz = a.itemSize, src = a.array, dst = new Float32Array(keep.length * 3 * sz);
    keep.forEach((t, i) => dst.set(src.subarray(t * 3 * sz, (t + 1) * 3 * sz), i * 3 * sz));
    out.setAttribute(name, new THREE.BufferAttribute(dst, sz));
  }
  return out;
}
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere();
export class Lod {
  constructor() { this.groups = []; this.chunks = []; this.mesh = null; this.sig = ''; this.stats = { drawn: 0, tris: 0, levels: {} }; }
  group(name, c, r, d, o = {}) {
    const g = { name, c, r, d, level: -1, chunks: [], o };
    g.add = (level, geo, co = {}) => {
      if (!geo || !geo.attributes.position.count) return null;
      geo.computeBoundingSphere();
      const ch = { g, level, geo, s: geo.boundingSphere.clone(), layer: co.layer || 0, need: co.need || null, start: 0, count: geo.attributes.position.count, name: co.name || name };
      g.chunks.push(ch); this.chunks.push(ch); return ch;
    };
    this.groups.push(g);
    return g;
  }
  finish(material, name = 'b5:atlas') {
    let n = 0; for (const c of this.chunks) { c.start = n; n += c.count; }
    const geo = new THREE.BufferGeometry();
    for (const [an, sz] of ATTRS) {
      const arr = new Float32Array(Math.max(1, n) * sz);
      for (const c of this.chunks) {
        if (an === 'aLayer') { arr.fill(c.layer, c.start, c.start + c.count); continue; }
        const a = c.geo.attributes[an]; if (a) arr.set(a.array, c.start * sz); else if (an === 'aTop') arr.fill(1e4, c.start, c.start + c.count);
      }
      geo.setAttribute(an, new THREE.BufferAttribute(arr, sz));
    }
    for (const c of this.chunks) { c.geo.dispose(); c.geo = null; }
    const idx = new THREE.BufferAttribute(new Uint32Array(Math.max(3, n)), 1); idx.setUsage(THREE.DynamicDrawUsage);
    geo.setIndex(idx); geo.setDrawRange(0, 0);
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    settleLater(geo, name);      // (memory pass: the vertex arrays go once they have stood on the card; the index is rewritten and stays — world/_geo_free.js)
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.visible = false;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    this.mesh = mesh; this.total = n / 3;
    return mesh;
  }
  update(camera, k = 1, farK = 1) {
    if (!this.mesh) return;
    camera.updateMatrixWorld();
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, drawn = [];
    for (const g of this.groups) {
      const dist = Math.max(0, Math.hypot(cx - g.c[0], cy - g.c[1], cz - g.c[2]) - g.r);
      const D = [g.d[0] * k, g.d[1] * k, g.d[2] * k * farK];
      let L = 3; for (let i = 0; i < 3; i++) if (dist < D[i]) { L = i; break; }
      if (g.level >= 0 && g.level !== L) {
        const cur = g.level;
        if (L > cur && cur < 3 && dist < D[cur] * 1.08) L = cur;
        // (coming back in: the edge is the furthest of the nearer levels' distances — a site with no far level (far 0.01)
        // used to be held at "beyond" for good once it had been out of range: the theatre's chairs, the canal end, the square)
        else if (L < cur && cur > 0 && dist > Math.max(D[0], cur > 1 ? D[1] : 0, cur > 2 ? D[2] : 0) * 0.92) L = cur;
      }
      g.level = L;
      if (L > 2) continue;
      for (const c of g.chunks) {
        if (c.level !== L) continue;
        if (c.need && !c.need(camera)) continue;
        _sp.copy(c.s); _sp.radius += 6;
        if (!_fr.intersectsSphere(_sp)) continue;
        drawn.push(c);
      }
    }
    let sig = ''; for (const c of drawn) sig += c.start + ',';
    if (sig === this.sig) return;
    this.sig = sig;
    const geo = this.mesh.geometry, idx = geo.index, A = idx.array, lv = { 0: 0, 1: 0, 2: 0 };
    let o = 0;
    for (const c of drawn) { const e = c.start + c.count; for (let i = c.start; i < e; i++) A[o++] = i; lv[c.level] += c.count / 3; }
    idx.clearUpdateRanges(); idx.addUpdateRange(0, Math.max(3, o)); idx.needsUpdate = true;
    geo.setDrawRange(0, o);
    this.mesh.visible = o > 0;
    this.stats = { drawn: drawn.length, tris: o / 3, levels: lv, list: this.debug ? drawn.map((c) => c.name + '@' + c.level) : undefined };
  }
}

/** register a site's near / mid / far builders as one LOD group: build(q) -> Batch; mid/far null = farCopy */
export function addSite(K, name, c, r, d, build, o = {}) {
  const P = K.pack, B = (q) => { const b = build(q); return b ? geoOf(b, P) : null; };
  const g0 = B(0), g1 = o.mid === false ? farCopy(g0, o.midArea ?? 0.35) : farCopy(B(1), o.midArea ?? 0.06), g2 = o.far === false ? farCopy(g1 || g0, o.farArea ?? 1.5) : farCopy(B(2), o.farArea ?? 0.9);
  const grp = K.lod.group(name, c, r, d, o);
  const co = { layer: o.layer || 0, need: o.need || null, name };
  const tris = [0, 0, 0];
  [[0, g0], [1, g1], [2, g2]].forEach(([lv, g]) => { if (g) { tris[lv] = g.attributes.position.count / 3; grp.add(lv, g, co); } });
  K.sites[name] = { tris, c, r, d };
  return grp;
}

/** one per game: {pack, lod, root, sites, boxes, finish(), tick()} — every batch-5 module calls shared(game) */
export function shared(game) {
  if (game._b5) return game._b5;
  const W = game.world;
  const K = { pack: b5Pack(W), lod: new Lod(), root: new THREE.Group(), sites: {}, boxes: [], modules: 0, ready: 0, done: false, mesh: null, owner: null, expect: 4 };
  K.root.name = 'b5:root';
  K.finish = () => {
    if (K.done) return K.mesh;
    K.done = true;
    K.mesh = K.lod.finish(K.pack.atlas);
    K.root.add(K.mesh);
    try { W.addStatic(K.root); } catch { game.worldScene.add(K.root); }
    return K.mesh;
  };
  K.join = (id) => { K.modules++; if (!K.owner) K.owner = id; return id; };
  K.joined = () => { K.ready++; };
  K.tick = (id) => {
    if (id !== K.owner) return;
    if (!K.done) { if (K.ready < K.modules) return; K.finish(); }
    const out = game.player.place === 'world';
    if (!out) { if (K.mesh.visible) { K.mesh.visible = false; K.lod.sig = '§'; } return; }
    const k = Math.max(0.75, (game.quality && game.quality.dist) || 1);
    K.lod.update(game.camera, k, W.aerial ? 2.7 : 1);
    const p = game.player.pos; let near = false;
    for (const [x0, x1, z0, z1] of K.boxes) if (Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(z0 - p.z, 0, p.z - z1)) < 70) { near = true; break; }
    K.mesh.castShadow = near && !W.aerial;
  };
  game._b5 = K;
  return K;
}

// ------------------------------------------------------------------------------------------------ pure helpers
export function h01(a, b = 0) {
  let h = Math.imul((a | 0) ^ 0x6c8e9cf5, 0x85ebca6b) ^ Math.imul((b | 0) + 0x3c6ef372, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
export { DAY_MS } from '../core/time.js';
/** the oriented box of a rectangle given by two long-side corners and a depth: R = {cx, cz, a, L, W} (a = angle of the long axis) */
export function rect(cx, cz, a, L, W) { return { cx, cz, a, L, W }; }
/** rect -> its 4 corners [x, z] (CCW seen from above with z down) */
export function corners(R, grow = 0) {
  const ux = Math.cos(R.a), uz = Math.sin(R.a), vx = -uz, vz = ux, l = R.L / 2 + grow, w = R.W / 2 + grow;
  return [[R.cx - ux * l - vx * w, R.cz - uz * l - vz * w], [R.cx + ux * l - vx * w, R.cz + uz * l - vz * w], [R.cx + ux * l + vx * w, R.cz + uz * l + vz * w], [R.cx - ux * l + vx * w, R.cz - uz * l + vz * w]];
}
/** a rect from a mapped polygon: its minimum-area oriented box (optionally forcing the angle near a0) */
export function obbOf(poly, a0 = null) {
  let best = null;
  const tryA = (a) => {
    const ux = Math.cos(a), uz = Math.sin(a); let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const [x, z] of poly) { const u = x * ux + z * uz, v = -x * uz + z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0);
    if (!best || A < best.A) { const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; best = { A, a, L: u1 - u0, W: v1 - v0, cx: cu * ux - cv * uz, cz: cu * uz + cv * ux }; }
  };
  if (a0 != null) tryA(a0); else for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; tryA(Math.atan2(q[1] - p[1], q[0] - p[0])); }
  let R = rect(best.cx, best.cz, best.a, best.L, best.W);
  if (R.W > R.L) R = rect(R.cx, R.cz, R.a + Math.PI / 2, R.W, R.L);
  return R;
}
/** a world point from rect-local (u along, v across) */
export const at = (R, u, v) => [R.cx + Math.cos(R.a) * u - Math.sin(R.a) * v, R.cz + Math.sin(R.a) * u + Math.cos(R.a) * v];

/** a pointed (two-centred) arch opening, CCW, in a wall frame's XY plane */
export function pointPts(x, w, y0, ys, seg = 4, k = 0.75) {
  const r = w / 2, p = [[x - r, y0], [x + r, y0], [x + r, ys]], R = w * k;
  // right arc: centre (x + r - R, ys), from angle 0 up to the apex; left mirrored
  const apA = Math.acos((R - r) / R), pts = [];
  for (let i = 1; i < seg; i++) { const t = (i / seg) * apA; pts.push([x + r - R + Math.cos(t) * R, ys + Math.sin(t) * R]); }
  const apex = [x, ys + Math.sin(apA) * R];
  p.push(...pts, apex, ...pts.slice().reverse().map(([px, py]) => [2 * x - px, py]), [x - r, ys]);
  return p;
}

/**
 * The walls of a rectangular range in Batch B (one call per range): walls in `wall`, windows painted (q > 0) or set in
 * with reveals (q = 0), string courses, plinth, battlements or a pitched roof with gables (coped or plain), buttresses.
 * spec: {R, h (eave), wall, dress, roof: 'gable'|'flat'|'hip'|null, roofKey, pitch (rad), crenel, parapet, coped (gable
 *   copings), strings [y], plinth, sides: [south(+v), north(-v), east(+u), west(-u)] = per side {rows: [[y0,y1,key,w,shape]], bay, from, to, skip(x)},
 *   buttress: {w, d, every}, gableWin (key), noWalls: side indices to leave out (another part stands there)}
 */
export function range(B, s, q = 0) {
  const R = s.R, hl = R.L / 2, hw = R.W / 2, h = s.h, wall = s.wall || 'stone', dress = s.dress || 'dress';
  const ux = Math.cos(R.a), uz = Math.sin(R.a), vx = -uz, vz = ux;
  // side frames: [mid point, along vector, length]; local +z is outward
  const S = [
    { m: [R.cx + vx * hw, R.cz + vz * hw], a: [ux, uz], L: R.L, n: [vx, vz] },     // +v
    { m: [R.cx - vx * hw, R.cz - vz * hw], a: [-ux, -uz], L: R.L, n: [-vx, -vz] }, // -v
    { m: [R.cx + ux * hl, R.cz + uz * hl], a: [-vx, -vz], L: R.W, n: [ux, uz] },   // +u
    { m: [R.cx - ux * hl, R.cz - uz * hl], a: [vx, vz], L: R.W, n: [-ux, -uz] },   // -u
  ];
  const sides = s.sides || [];
  // a hip over a rect that is wider than it is long (Keble's gatehouse) has its ridge ACROSS the range: the roof rises
  // from the short half-span (it used to rise from the long one, with a negative ridge and crossed slopes)
  const hipAcross = s.roof === 'hip' && hl < hw;
  const roofH = s.roof === 'gable' || s.roof === 'hip' ? Math.tan(s.pitch || 0.9) * (hipAcross ? hl : hw) : 0;
  S.forEach((F, i) => {
    if (s.noWalls && s.noWalls.includes(i)) return;
    const L = F.L, cfg = sides[i] || {};
    B.push(frame(F.m[0], 0, F.m[1], F.a[0], F.a[1]));
    const rows = q === 2 && !s.farWin ? [] : cfg.rows || [], bay = cfg.bay || 3.2, nb = Math.max(0, Math.floor((L - (cfg.margin ?? 0.8)) / bay));
    const xs = []; for (let k = 0; k < nb; k++) { const x = -((nb - 1) * bay) / 2 + k * bay; if (cfg.skip && cfg.skip(x, k)) continue; xs.push(x); }
    const ops = [];
    for (const x of xs) for (const [y0, y1, key, w, shape] of rows) {
      const ww = w || 1.4, pts = shape === 'point' ? pointPts(x, ww, y0, y1 - ww * 0.7) : shape === 'round' ? archPts(x, ww, y0, y1 - ww / 2, 6) : rectPts(x - ww / 2, y0, x + ww / 2, y1);
      ops.push({ x, y0, y1, key, w: ww, pts });
    }
    for (const o of cfg.extra || []) if (q < 2 || s.farWin || (o.w || 0) >= 2.4) ops.push(o);
    const top = h + (s.parapet && !roofH ? s.parapet : 0);
    if (q === 0 && ops.length && !cfg.flatWin) {
      B.face(wall, rectPts(-L / 2, 0, L / 2, top), ops.map((o) => o.pts), 0);
      for (const o of ops) { if (!o.noReveal) B.reveal(o.revKey || dress, o.pts, 0, -(o.rec || 0.22), !!o.open); if (o.key) B.unit(o.key, o.pts, -(o.rec || 0.22), [((o.x * 7 + i * 13) | 0) & 127, o.y0 < 4 ? 0 : 1]); }
    } else {
      B.poly(wall, [[-L / 2, 0, 0], [L / 2, 0, 0], [L / 2, top, 0], [-L / 2, top, 0]], [0, 0, 1], [[-L / 2, 0], [L / 2, 0], [L / 2, top], [-L / 2, top]]);
      for (const o of ops) B.unit(o.key || o.farKey || 'shade', o.pts, 0.03, [((o.x * 7 + i * 13) | 0) & 127, o.y0 < 4 ? 0 : 1]);
    }
    if (q < 2) {
      for (const o of ops) if (o.y0 > 0.5 && !o.noSill) B.box(dress, o.x, o.y0 - 0.085, 0.08, o.w + 0.24, 0.13, 0.16, 0, { bottom: true });
      for (const y of s.strings || []) B.box(dress, 0, y + i * 0.016, 0.055, L + 0.12, 0.2, 0.13, 0, {});
      if (s.plinth) B.box(dress, 0, (s.plinth + i * 0.016) / 2, 0.06, L + 0.16, s.plinth + i * 0.016, 0.16, 0, {});
    }
    // buttresses (stepped), between bays
    if (s.buttress && q < 2 && !(cfg.noButtress)) {
      const { w: bw, d: bd } = s.buttress, bh = s.buttress.h || h * 0.85, step = cfg.bay || bay;
      const nbb = Math.floor(L / step);
      for (let k = 0; k <= nbb; k++) {
        const x = -(nbb * step) / 2 + k * step; if (Math.abs(x) > L / 2 - bw / 2 + 0.01) continue;
        B.box(wall, x, bh * 0.3, bd / 2 - 0.015, bw, bh * 0.6, bd + 0.03, 0, { top: false });
        B.poly(dress, [[x - bw / 2, bh * 0.6, bd], [x + bw / 2, bh * 0.6, bd], [x + bw / 2, bh * 0.6 + 0.4, bd * 0.6], [x - bw / 2, bh * 0.6 + 0.4, bd * 0.6]], [0, 0.6, 1]);
        B.box(wall, x, bh * 0.6 + bh * 0.2, bd * 0.3 - 0.025, bw - 0.03, bh * 0.4, bd * 0.6 + 0.05, 0, { top: false });
        B.poly(dress, [[x - bw / 2, bh, bd * 0.6], [x + bw / 2, bh, bd * 0.6], [x + bw / 2, bh + 0.5, 0], [x - bw / 2, bh + 0.5, 0]], [0, 0.6, 1]);
        if (s.buttress.pinnacle) { B.box(dress, x, h + 0.9, -0.07, 0.56, 1.8, 0.56, 0, { top: false }); B.cyl(dress, x, h + 1.8, -0.07, 0.02, 1.6, 4, false, 0.34); }
      }
    }
    // battlements on a flat roof (all sides) or along the eaves of a pitched roof (long sides)
    if (s.crenel && (i < 2 || !roofH)) {
      const pt = s.parapet || 0.8;
      B.box(dress, 0, h + 0.1, 0.06, L + 0.12, 0.2, 0.12, 0, {});
      if (roofH) B.box(wall, 0, h + pt / 2, -0.12, L, pt, 0.32, 0, { top: true });
      const m = Math.max(1, Math.floor(L / 1.6));
      if (q < 2) for (let k = 0; k < m; k++) B.box(dress, -L / 2 + (k + 0.5) * (L / m), h + pt + 0.25, -0.12, (L / m) * 0.5, 0.5, 0.34, 0, { top: true });
      if (!roofH) B.box(dress, 0, h + pt + 0.03, -0.12, L, 0.06, 0.36, 0, { top: true });
    } else if (s.parapet && !roofH) B.box(dress, 0, h + s.parapet + 0.05, -0.12, L, 0.1, 0.36, 0, { top: true });
    // gable end (on the short sides of a gabled roof)
    if (s.roof === 'gable' && i >= 2) {
      const ov = s.coped ? 0 : 0.0;
      B.poly(wall, [[-L / 2 - ov, h, 0], [L / 2 + ov, h, 0], [0, h + roofH, 0]], [0, 0, 1], [[-L / 2, h], [L / 2, h], [0, h + roofH]]);
      if (s.coped) {
        const t = 0.36, c = 0.12;
        for (const sg of [-1, 1]) B.poly(dress, [[sg * (L / 2 + c), h - 0.05, c], [0, h + roofH + 0.2, c], [0, h + roofH + 0.2, -t], [sg * (L / 2 + c), h - 0.05, -t]], [sg * 0.6, 0.8, 0]);
        B.cyl(dress, 0, h + roofH + 0.15, -0.1, 0.03, 1.1, 4, false, 0.2);
      }
      const gw = cfg.gable;
      if (gw) { const pts = pointPts(0, gw.w, gw.y0, gw.y1 - gw.w * 0.7); if (q === 0) { B.unit(gw.key, pts, 0.02, [i, 2]); } else B.unit(gw.key, pts, 0.03, [i, 2]); }
    }
    B.pop();
  });
  // the roof
  const rk = s.roofKey || 'slate';
  if (s.roof === 'gable' || s.roof === 'hip') {
    const ov = s.coped ? 0 : 0.35, eo = 0.3, y0 = h - (s.coped ? 0 : 0.1);
    const P = (u, v, y) => [R.cx + ux * u + vx * v, y, R.cz + uz * u + vz * v];
    const ridge = s.roof === 'hip' ? hl - hw : hl + ov;
    if (hipAcross) {
      const rv = hw - hl;
      for (const sg of [-1, 1]) {
        B.poly(rk, [P(sg * (hl + eo), -hw - eo, y0 - eo), P(sg * (hl + eo), hw + eo, y0 - eo), P(0, rv, h + roofH), P(0, -rv, h + roofH)], [ux * sg, 1, uz * sg]);
        B.poly(rk, [P(-hl - eo, sg * (hw + eo), y0 - eo), P(hl + eo, sg * (hw + eo), y0 - eo), P(0, sg * rv, h + roofH)], [vx * sg, 1, vz * sg]);
      }
      if (q < 2) B.beam(s.ridgeKey || 'lead', P(0, -rv, h + roofH + 0.04), P(0, rv, h + roofH + 0.04), 0.16, 0.12);
    } else for (const sg of [-1, 1]) {
      B.poly(rk, [P(-hl - ov, sg * (hw + eo), y0 - eo * Math.tan(s.pitch || 0.9)), P(hl + ov, sg * (hw + eo), y0 - eo * Math.tan(s.pitch || 0.9)), P(ridge, 0, h + roofH), P(-ridge, 0, h + roofH)], [vx * sg, 1, vz * sg]);
    }
    if (s.roof === 'hip' && !hipAcross) for (const sg of [-1, 1]) B.poly(rk, [P(sg * (hl + eo), -hw - eo, y0 - eo), P(sg * (hl + eo), hw + eo, y0 - eo), P(sg * ridge, 0, h + roofH)], [ux * sg, 1, uz * sg]);
    if (q < 2 && !hipAcross) B.beam(s.ridgeKey || 'lead', P(-ridge, 0, h + roofH + 0.04), P(ridge, 0, h + roofH + 0.04), 0.16, 0.12);
  } else if (s.roof === 'flat') {
    const c = corners(R, -0.05);
    B.poly(rk, c.map(([x, z]) => [x, h + 0.05, z]), [0, 1, 0]);
  }
  return roofH;
}

/** a square tower: s = {cx, cz, a, w, stages: [[y0, y1, wallKey]], top, crenel, pinnacles: [h, mid?], belfry: {y0, y1, key, n, w}, strings: [y]} */
export function tower(B, s, q = 0) {
  const R = rect(s.cx, s.cz, s.a, s.w, s.w);
  for (const [y0, y1, key] of s.stages) {
    for (let i = 0; i < 4; i++) {
      const t = s.a + (i * Math.PI) / 2, nx = -Math.sin(t), nz = Math.cos(t), m = [s.cx + nx * s.w / 2, s.cz + nz * s.w / 2];
      B.push(frame(m[0], 0, m[1], Math.cos(t), Math.sin(t)));
      B.poly(key || s.wall || 'stone', [[-s.w / 2, y0, 0], [s.w / 2, y0, 0], [s.w / 2, y1, 0], [-s.w / 2, y1, 0]], [0, 0, 1], [[-s.w / 2, y0], [s.w / 2, y0], [s.w / 2, y1], [-s.w / 2, y1]]);
      B.pop();
    }
  }
  for (let i = 0; i < 4; i++) {
    const t = s.a + (i * Math.PI) / 2, nx = -Math.sin(t), nz = Math.cos(t), m = [s.cx + nx * s.w / 2, s.cz + nz * s.w / 2];
    B.push(frame(m[0], 0, m[1], Math.cos(t), Math.sin(t)));
    if (s.belfry) { const b = s.belfry, n = b.n || 2; for (let k = 0; k < n; k++) { const x = -((n - 1) * (b.w + 0.5)) / 2 + k * (b.w + 0.5); B.unit(b.key || 'louvre', pointPts(x, b.w, b.y0, b.y1 - b.w * 0.7), 0.04, [k, 3]); if (q < 2) B.box(s.dress || 'dress', x, b.y0 - 0.08, 0.08, b.w + 0.3, 0.16, 0.16, 0, {}); } }
    for (const o of (s.faces && s.faces[i]) || []) B.unit(o.key, o.pts, o.z ?? 0.04, [i, 4]);
    if (q < 2) for (const y of s.strings || []) B.box(s.dress || 'dress', 0, y, 0.07, s.w + 0.14, 0.22, 0.14, 0, {});
    // clasping corner buttresses (a slim projection at each corner)
    if (s.corner && q < 2) for (const sg of [-1, 1]) B.box(s.wall || 'stone', sg * (s.w / 2 - s.corner / 2), s.top * 0.47, 0.12, s.corner, s.top * 0.94, 0.24, 0, { top: true });
    if (s.crenel) {
      const m2 = s.merlons || 4, pw = s.w / m2;
      B.box(s.dress || 'dress', 0, s.top + 0.1, 0.1, s.w + 0.2, 0.22, 0.2, 0, {});
      B.box(s.wall || 'stone', 0, s.top + 0.45, -0.1, s.w, 0.7, 0.3, 0, { top: true });
      if (q < 2) for (let k = 0; k < m2; k++) B.box(s.dress || 'dress', -s.w / 2 + (k + 0.5) * pw, s.top + 1.05, -0.1, pw * 0.52, 0.5, 0.32, 0, { top: true });
    }
    if (s.pinnacles && s.pinnacles[1] && q < 2) { const ph = s.pinnacles[0] * 0.75; B.box(s.dress || 'dress', 0, s.top + 0.6 + ph * 0.25, -0.21, 0.45, ph * 0.5, 0.45, 0, { top: false }); B.cyl(s.dress || 'dress', 0, s.top + 0.6 + ph * 0.5, -0.21, 0.02, ph * 0.5, 4, false, 0.3); }
    B.pop();
  }
  // roof (flat lead) and the corner pinnacles
  const c = corners(R, -0.05); B.poly('lead', c.map(([x, z]) => [x, s.top + 0.02, z]), [0, 1, 0]);
  if (s.pinnacles) {
    const ph = s.pinnacles[0];
    for (const [x, z] of corners(R, -0.25)) {
      B.box(s.dress || 'dress', x, s.top + ph * 0.25, z, 0.7, ph * 0.5, 0.7, s.a, { top: false });
      B.cyl(s.dress || 'dress', x, s.top + ph * 0.5, z, 0.02, ph * 0.5, q === 2 ? 4 : 8, false, 0.46);
      if (q === 0) for (const f of [0.62, 0.78, 0.9]) B.box(s.dress || 'dress', x, s.top + ph * f, z, 0.46 * (1.2 - f) * 2 + 0.06, 0.08, 0.46 * (1.2 - f) * 2 + 0.06, s.a + Math.PI / 4);
    }
  }
  return R;
}

/** a polyline offset d to the LEFT of travel (z down: left of +x is -z), mitred at the joints (miters capped at 3x) */
export function offsetLine(pts, d) {
  const n = pts.length, out = [];
  const nrm = (i) => { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / L, -(b[0] - a[0]) / L]; };
  for (let i = 0; i < n; i++) {
    const n0 = i > 0 ? nrm(i - 1) : nrm(0), n1 = i < n - 1 ? nrm(i) : nrm(n - 2);
    let mx = n0[0] + n1[0], mz = n0[1] + n1[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const k = Math.min(3, 1 / Math.max(0.33, mx * n1[0] + mz * n1[1]));
    out.push([pts[i][0] + mx * d * k, pts[i][1] + mz * d * k]);
  }
  return out;
}
/** a medieval wall along polylines (the outside to the LEFT of travel), crenellated on the outer edge with a wall-walk,
 *  and D-shaped bastions [x, z, outward nx, nz]: o = {lines, bastions, H, T, key} */
export function cityWall(B, o, q) {
  const { lines, bastions = [], H } = o, T = o.T || 1.6, key = o.key || 'wallOld';
  for (const L0 of lines) {
    // mitred offset lines: the outer face (left of travel) and the inner face, so no two faces overlap at a joint
    const off = (d) => offsetLine(L0, d);
    const O = off(T / 2), I = off(-T / 2), P = off(T / 2 - 0.5);
    for (let i = 0; i < L0.length - 1; i++) {
      const a = O[i], b = O[i + 1], c = I[i], d = I[i + 1], top = H + 1.1;
      const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lc = Math.hypot(d[0] - c[0], d[1] - c[1]);
      const ax = (L0[i + 1][0] - L0[i][0]), az = (L0[i + 1][1] - L0[i][1]), al = Math.hypot(ax, az) || 1, nx = az / al, nz = -ax / al;
      B.poly(key, [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], top, b[1]], [a[0], top, a[1]]], [nx, 0, nz], [[0, 0], [la, 0], [la, top], [0, top]]);
      B.poly(key, [[c[0], 0, c[1]], [d[0], 0, d[1]], [d[0], H, d[1]], [c[0], H, c[1]]], [-nx, 0, -nz], [[0, 0], [lc, 0], [lc, H], [0, H]]);
      // the wall-walk and the parapet behind the merlons
      B.poly(key, [[P[i][0], H, P[i][1]], [P[i + 1][0], H, P[i + 1][1]], [d[0], H, d[1]], [c[0], H, c[1]]], [0, 1, 0]);
      if (q < 2) {
        const pl = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
        B.poly(key, [[P[i][0], H, P[i][1]], [P[i + 1][0], H, P[i + 1][1]], [P[i + 1][0], top, P[i + 1][1]], [P[i][0], top, P[i][1]]], [-nx, 0, -nz], [[0, H], [pl, H], [pl, top], [0, top]]);
        B.poly(key, [[a[0], top, a[1]], [b[0], top, b[1]], [P[i + 1][0], top, P[i + 1][1]], [P[i][0], top, P[i][1]]], [0, 1, 0]);
        const m = Math.max(1, Math.floor(la / 1.9)), ux = (b[0] - a[0]) / la, uz = (b[1] - a[1]) / la;
        for (let k = 0; k < m; k++) { const f = (k + 0.5) / m, x = a[0] + (b[0] - a[0]) * f - nx * 0.25, z = a[1] + (b[1] - a[1]) * f - nz * 0.25; B.box(key, x, top + 0.3, z, (la / m) * 0.55, 0.6, 0.48, Math.atan2(-uz, ux) + 0, { top: true }); }
      } else B.poly(key, [[a[0], top, a[1]], [b[0], top, b[1]], [P[i + 1][0], top, P[i + 1][1]], [P[i][0], top, P[i][1]]], [0, 1, 0]);
    }
  }
  // bastions: D-shaped towers projecting outward, a little higher than the wall, crenellated
  for (const [bx, bz, nx, nz] of bastions) {
    const sh = o.Rb ? 0 : 0.6, cx = bx + nx * sh, cz = bz + nz * sh, Rb = o.Rb || 4.3, Hb = H + 1.3, seg = q === 2 ? 6 : q === 1 ? 9 : 12, a0 = Math.atan2(nx, nz);
    // the half-round front (from -90° to +90° about the outward normal) and its top
    B.lathe(key, cx, cz, [[Rb + 0.3, 0], [Rb, 1.2], [Rb, Hb]], { seg, a0: a0 - Math.PI / 2, a1: a0 + Math.PI / 2 });
    for (let s = 0; s < seg; s++) { const t0 = a0 - Math.PI / 2 + (s / seg) * Math.PI, t1 = a0 - Math.PI / 2 + ((s + 1) / seg) * Math.PI; B.poly(key, [[cx, Hb, cz], [cx + Math.sin(t0) * Rb, Hb, cz + Math.cos(t0) * Rb], [cx + Math.sin(t1) * Rb, Hb, cz + Math.cos(t1) * Rb]], [0, 1, 0]); }
    if (q < 2) for (let s = 0; s < 7; s++) { const t = a0 - Math.PI / 2 + ((s + 0.5) / 7) * Math.PI; B.box(key, cx + Math.sin(t) * (Rb - 0.25), Hb + 0.35, cz + Math.cos(t) * (Rb - 0.25), 0.9, 0.7, 0.5, t); }
    // arrow slits
    if (q < 2) for (const t of (Rb < 3 ? [a0] : [a0 - 0.7, a0, a0 + 0.7])) { B.push(frame(cx + Math.sin(t) * (Rb + 0.02), 0, cz + Math.cos(t) * (Rb + 0.02), Math.cos(t), -Math.sin(t))); B.unit('shade', rectPts(-0.08, 3.4, 0.08, 4.6), 0, [0, 0]); B.pop(); }
  }
  return B;
}

/** a robed figure (~1.8 m) facing angle t, from (x, y, z): lathe body, head, cape (for niches on gate towers) */
export function statue(B, x, y, z, t, q, key = 'statue', s = 1) {
  const seg = q ? 6 : 9;
  B.push(frame(x, y, z, Math.cos(t), -Math.sin(t)));
  B.lathe(key, 0, 0, [[0.3 * s, 0], [0.31 * s, 0.1 * s], [0.27 * s, 0.6 * s], [0.25 * s, 1.0 * s], [0.22 * s, 1.28 * s], [0.18 * s, 1.4 * s], [0.08 * s, 1.47 * s]], { seg });
  B.lathe('statueDk', 0, 0.03, [[0, 1.46 * s], [0.09 * s, 1.5 * s], [0.1 * s, 1.62 * s], [0.07 * s, 1.74 * s], [0, 1.77 * s]], { seg });
  B.pop();
}
/** a lumpy evergreen crown: n overlapping faceted blobs (lathes) of foliage round (x, z) */
export function crown(B, x, z, y0, R, H, n, seed, q, key = 'foliage') {
  const seg = q === 2 ? 5 : q === 1 ? 7 : 9;
  for (let i = 0; i < n; i++) {
    const a = h01(seed, i) * TAU, d = i === 0 ? 0 : R * (0.35 + 0.35 * h01(seed + 1, i)), r = R * (i === 0 ? 0.75 : 0.5 + 0.2 * h01(seed + 2, i)), cy = y0 + H * (i === 0 ? 0.5 : 0.35 + 0.45 * h01(seed + 3, i));
    const cx = x + Math.sin(a) * d, cz = z + Math.cos(a) * d, hh = r * 0.95;
    B.lathe(key, cx, cz, [[0, cy - hh], [r * 0.7, cy - hh * 0.7], [r, cy - hh * 0.1], [r * 0.85, cy + hh * 0.5], [r * 0.45, cy + hh * 0.9], [0, cy + hh]], { seg, a0: a });
  }
}
/** an L-arm shaped trunk */
export function trunk(B, x, z, y1, r) { B.cyl('bark', x, 0, z, r * 0.8, y1, 7, false, r); }

/** a site's own frame: origin O, u along angle a, v across (+v = a + 90°, i.e. "south" for a ≈ 0) */
export function siteFrame(O, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const Q = (u, v) => [O[0] + u * c - v * s, O[1] + u * s + v * c];
  const toQ = (x, z) => { const dx = x - O[0], dz = z - O[1]; return [dx * c + dz * s, -dx * s + dz * c]; };
  const QR = (u0, u1, v0, v1) => { const m = Q((u0 + u1) / 2, (v0 + v1) / 2); return rect(m[0], m[1], a, u1 - u0, v1 - v0); };
  const QRv = (u0, u1, v0, v1) => { const m = Q((u0 + u1) / 2, (v0 + v1) / 2); return rect(m[0], m[1], a + Math.PI / 2, v1 - v0, u1 - u0); };
  /** headings (game convention, forward = (sin h, cos h)) along +u, -u, +v, -v */
  const H = { u: Math.atan2(c, s), nu: Math.atan2(-c, -s), v: Math.atan2(-s, c), nv: Math.atan2(s, -c) };
  /** a wall frame on the face of a building at (u, v) whose outward normal is +u ('u'), -u, +v or -v */
  const face = (u, v, dir) => { const p = Q(u, v); const n = dir === 'u' ? [c, s] : dir === 'nu' ? [-c, -s] : dir === 'v' ? [-s, c] : [s, -c]; return frame(p[0], 0, p[1], n[1], -n[0]); };
  return { O, a, c, s, Q, toQ, QR, QRv, H, face };
}
/** a flat ribbon (a street surface) along pts, width w at height y: mitred, u along the line in metres, v across */
export function ribbon(B, key, pts, w, y) {
  const L = offsetLine(pts, w / 2), R = offsetLine(pts, -w / 2);
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    B.poly(key, [[L[i][0], y, L[i][1]], [R[i][0], y, R[i][1]], [R[i + 1][0], y, R[i + 1][1]], [L[i + 1][0], y, L[i + 1][1]]], [0, 1, 0], [[s, w], [s, 0], [s + d, 0], [s + d, w]]);
    s += d;
  }
}
/** a gabled dormer on a pitched roof: at rect-local (u, side ±1) of range R with eave h and pitch p */
export function dormer(B, R, u, side, h, pitch, o = {}) {
  const ww = o.w || 1.3, dh = o.h || 1.4, back = o.back || 1.6, ux = Math.cos(R.a), uz = Math.sin(R.a), vx = -uz * side, vz = ux * side;
  const v0 = R.W / 2 - (o.in || 0.5), y0 = h + (R.W / 2 - v0) * Math.tan(pitch);
  const P = (du, dv, y) => [R.cx + ux * (u + du) + vx * (v0 - dv), y, R.cz + uz * (u + du) + vz * (v0 - dv)];
  const key = o.wall || 'stoneSlate', rk = o.roof || 'stoneSlate';
  // cheeks and front
  B.poly(key, [P(-ww / 2, 0, y0), P(ww / 2, 0, y0), P(ww / 2, 0, y0 + dh), P(-ww / 2, 0, y0 + dh)], [vx, 0, vz]);
  B.poly(o.cheek || key, [P(ww / 2, 0, y0), P(ww / 2, back, y0 + back * Math.tan(pitch)), P(ww / 2, back, y0 + dh), P(ww / 2, 0, y0 + dh)], [ux, 0, uz]);
  B.poly(o.cheek || key, [P(-ww / 2, 0, y0), P(-ww / 2, 0, y0 + dh), P(-ww / 2, back, y0 + dh), P(-ww / 2, back, y0 + back * Math.tan(pitch))], [-ux, 0, -uz]);
  // its little gable roof
  const ry = y0 + dh, rr = ry + ww * 0.55;
  B.poly(rk, [P(-ww / 2 - 0.1, -0.12, ry - 0.06), P(0, -0.12, rr), P(0, back, rr), P(-ww / 2 - 0.1, back, ry - 0.06)], [-ux, 1, -uz]);
  B.poly(rk, [P(ww / 2 + 0.1, -0.12, ry - 0.06), P(ww / 2 + 0.1, back, ry - 0.06), P(0, back, rr), P(0, -0.12, rr)], [ux, 1, uz]);
  B.poly(key, [P(-ww / 2, 0, ry), P(ww / 2, 0, ry), P(0, 0, rr - 0.1)], [vx, 0, vz]);
  // the window: a leaded unit on the front, 2 cm proud
  const fx = (du, y) => { const p = P(du, -0.02, y); return p; };
  const a = fx(-ww / 2 + 0.18, y0 + 0.2), b = fx(ww / 2 - 0.18, y0 + 0.2), c2 = fx(ww / 2 - 0.18, y0 + dh - 0.15), d = fx(-ww / 2 + 0.18, y0 + dh - 0.15);
  const E = 0.004, bay = o.bay || 0;
  B.poly(o.win || 'leaded', [a, b, c2, d], [vx, 0, vz], [[bay + E, 1 + E], [bay + 1 - E, 1 + E], [bay + 1 - E, 2 - E], [bay + E, 2 - E]]);
}
