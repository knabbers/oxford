// Geometry for 5, 6 & 7 Beaumont Street (places/worcester_beaumont.js). Everything is modelled in the front frame of
// _wbmt_plan.js (x = s west along the front, y up, z out towards the street) from the measurements in
// docs/research/worcester.md "Beaumont Street accommodation".
//   buildExterior(B, D)   the three fronts, roofs, chimneys (Worcester atlas keys + 'bmtDecal'); the courtyard, the
//                         orange block's shell and the masses round it are _wbmt_site.js buildSite(), called from here
//   buildPassage(B)       No. 7's passage from the street door to the back door: keys "zone|rrggbb|cell"
//   roomKit(B)            the helpers the rooms are built with (walls with holes, floors, furniture): also _wbmt_block.js
//   glassGeometry(D)      the pane of No. 7's fanlight (drawn with the passage, in its room's scene)
// The front frame IS the walk-in rooms' frame (_wbmt_plan.js ROOM_ID / BLOCK_ID): interiors are added to their scenes as they are.
//   paintDecals() / paintRooms()   the two small canvases (ironwork, numerals, plaque, glass / boards, doors, fronts)
import * as THREE from 'three';
import { repaintableAll } from '../world/_tex_keep.js';
import { Batch, frame, rectPts, archPts } from './_worcester_kit.js';
import { tex, canvas, rng } from './_worcint_tex.js';
import { HOUSES, LEVELS, CHIMNEYS, FRONT, DEPTH, PAVE, IN, SHELL7 } from './_wbmt_plan.js';
import { buildSite } from './_wbmt_site.js';

const Y = (h) => h + PAVE;
const M4 = () => new THREE.Matrix4();

// ================================================================================================ canvases
let _dec = null;
/** alpha decals (same kind of material as the college's signs): -> {texture, uv(name)} */
export function paintDecals() {
  if (_dec) return _dec;
  const W = 512, { c, g } = canvas(W, W), cells = {};
  g.clearRect(0, 0, W, W);
  const put = (name, x, y, w, h, draw) => { g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(w, h); g.restore(); cells[name] = [(x + 1) / W, 1 - (y + h - 1) / W, (x + w - 1) / W, 1 - (y + 1) / W]; };
  const IRON = '#17181a';
  // balconette front, 1.75 x 0.95 m: top and bottom rails, close-set bars with a band of circles and scrolls (cast iron)
  put('balc', 0, 0, 384, 208, (w, h) => {
    g.fillStyle = IRON; g.fillRect(0, 0, w, 10); g.fillRect(0, 34, w, 6); g.fillRect(0, h - 44, w, 6); g.fillRect(0, h - 12, w, 12);
    g.fillRect(0, 0, 9, h); g.fillRect(w - 9, 0, 9, h);
    const n = 16, sp = (w - 18) / n;
    g.strokeStyle = IRON; g.lineWidth = 3.2;
    for (let i = 0; i < n; i++) {
      const x = 9 + (i + 0.5) * sp;
      g.fillRect(x - 2, 40, 4, h - 84);
      g.beginPath(); g.arc(x, 22, 8.5, 0, 7); g.stroke();
      g.beginPath(); g.arc(x, h - 28, 9.5, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(x - sp / 2, 70); g.quadraticCurveTo(x, 96, x + sp / 2, 70); g.stroke();
      g.beginPath(); g.moveTo(x - sp / 2, h - 74); g.quadraticCurveTo(x, h - 100, x + sp / 2, h - 74); g.stroke();
      g.beginPath(); g.ellipse(x, h / 2, 5.5, 13, 0, 0, 7); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, w, 2);
  });
  put('balcSide', 392, 0, 104, 208, (w, h) => {
    g.fillStyle = IRON; g.fillRect(0, 0, w, 10); g.fillRect(0, 34, w, 6); g.fillRect(0, h - 44, w, 6); g.fillRect(0, h - 12, w, 12); g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    g.strokeStyle = IRON; g.lineWidth = 3.2;
    for (let i = 0; i < 4; i++) { const x = 8 + (i + 0.5) * ((w - 16) / 4); g.fillRect(x - 2, 40, 4, h - 84); g.beginPath(); g.arc(x, 22, 8.5, 0, 7); g.stroke(); g.beginPath(); g.arc(x, h - 28, 9.5, 0, 7); g.stroke(); }
  });
  // glass in the real windows: a faint cool veil with two pale streaks of reflection
  put('glass', 0, 216, 96, 96, (w, h) => {
    g.fillStyle = 'rgba(120,140,156,0.16)'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(235,242,248,0.09)'; g.beginPath(); g.moveTo(w * 0.1, 0); g.lineTo(w * 0.42, 0); g.lineTo(w * 0.12, h); g.lineTo(-w * 0.2, h); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(w * 0.66, 0); g.lineTo(w * 0.78, 0); g.lineTo(w * 0.48, h); g.lineTo(w * 0.36, h); g.closePath(); g.fill();
  });
  // house numbers: small black plates, white numerals
  for (const [i, n] of ['5', '6', '7'].entries()) put('num' + n, 104 + i * 68, 216, 64, 64, (w, h) => {
    g.fillStyle = '#101010'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8d4c8'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#f0ece0'; g.font = 'bold 44px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, w / 2, h / 2 + 3);
  });
  // the blue plaque on No. 5 (Oxfordshire Blue Plaques Board: wording as on the plaque)
  put('plaque', 0, 320, 192, 192, (w, h) => {
    g.fillStyle = '#f2f2ee'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 1, 0, 7); g.fill();
    g.fillStyle = '#2b62c0'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 5, 0, 7); g.fill();
    g.fillStyle = '#f4f4f0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const line = (t, y, px, wt = 'bold') => { g.font = `${wt} ${px}px Georgia, "Times New Roman", serif`; g.fillText(t, w / 2, y); };
    line('WILLIAM', 46, 17); line('WILKINSON', 65, 17); line('1819–1901', 83, 11, 'normal'); line('Architect', 101, 12);
    line('of the Randolph Hotel and', 118, 8, 'normal'); line('designer of North Oxford', 128, 8, 'normal'); line('Victorian suburb', 138, 8, 'normal');
    line('lived and practised here', 153, 8, 'normal'); line('1860–1886', 164, 9, 'normal');
  });
  // small entry panel by a door (a blank grey plate with a row of buttons)
  put('entry', 312, 216, 48, 80, (w, h) => { g.fillStyle = '#9a9c9c'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2c2e'; g.fillRect(8, 8, w - 16, 22); g.fillStyle = '#4a4c4e'; for (let i = 0; i < 6; i++) g.fillRect(10 + (i % 3) * 10, 40 + Math.floor(i / 3) * 12, 7, 7); });
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  // (memory pass: painted again by this function, its cache set aside for the call, if the card ever needs it again: world/_tex_keep.js)
  return (_dec = repaintableAll({ texture, uv: (n) => cells[n] }, () => { const k = _dec; _dec = null; try { return paintDecals(); } finally { _dec = k; } }, 'beaumont decals'));
}

let _rooms = null;
/** the rooms' own small atlas (unlit, tinted per vertex): -> {texture, uv(name) -> [u0, v0, u1, v1]} */
export function paintRooms() {
  if (_rooms) return _rooms;
  const W = 1024, { c, g } = canvas(W, W), cells = {}, R = rng(713);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, W);
  const put = (name, x, y, w, h, draw) => { g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(w, h); g.restore(); cells[name] = [(x + 1.5) / W, 1 - (y + h - 1.5) / W, (x + w - 1.5) / W, 1 - (y + 1.5) / W]; };
  cells.white = [4 / W, 1 - 12 / W, 12 / W, 1 - 4 / W];
  // six-panel door, white gloss, lever handle
  put('door', 32, 0, 128, 272, (w, h) => {
    g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, w, h);
    for (const [py, ph] of [[0.04, 0.2], [0.28, 0.3], [0.62, 0.33]]) for (const px of [0.1, 0.55]) {
      const X = w * px, Yy = h * py, Wd = w * 0.35, Hh = h * ph;
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(X, Yy, Wd, Hh); g.fillStyle = '#ebe8de'; g.fillRect(X + 3, Yy + 4, Wd - 6, Hh - 7); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(X + 3, Yy + Hh - 4, Wd - 6, 2);
    }
    g.fillStyle = '#9a9c9e'; g.fillRect(w * 0.84, h * 0.5, w * 0.11, 5); g.fillRect(w * 0.9, h * 0.49, 6, 12);
  });
  // cork board over the desk: maps, a calendar, a strip of photographs (2.1 x 0.84 m)
  put('cork', 192, 0, 640, 256, (w, h) => {
    g.fillStyle = '#b98a58'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '70,40,10' : '255,225,170'},${0.05 + R() * 0.1})`; g.fillRect(R() * w, R() * h, 2, 2); }
    // an old two-hemisphere world map
    g.fillStyle = '#d9c79a'; g.fillRect(14, 30, 196, 150); g.strokeStyle = '#6a4a2a'; g.lineWidth = 3; g.strokeRect(14, 30, 196, 150);
    for (const cx of [66, 158]) { g.fillStyle = '#e8dcb6'; g.beginPath(); g.arc(cx, 105, 44, 0, 7); g.fill(); g.strokeStyle = '#7a5a34'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#9aa66a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx - 20 + R() * 40, 80 + R() * 50, 6 + R() * 12, 5 + R() * 9, R() * 3, 0, 7); g.fill(); } }
    g.fillStyle = '#7a3a2a'; g.fillRect(20, 36, 184, 8);
    // a print and a calendar
    g.fillStyle = '#f3efe2'; g.fillRect(236, 22, 96, 84); g.fillStyle = '#3a6a8a'; g.fillRect(242, 28, 84, 72); g.fillStyle = '#e8c860'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(254 + k * 13, 50 + (k % 2) * 22, 9, 0, 7); g.fill(); }
    g.fillStyle = '#fbfaf4'; g.fillRect(236, 112, 96, 92); g.fillStyle = '#b0b0aa'; for (let r = 0; r < 5; r++) for (let q = 0; q < 7; q++) g.fillRect(242 + q * 12.6, 132 + r * 13, 9, 9); g.fillStyle = '#444'; g.fillRect(262, 118, 44, 6);
    // a map of the Aegean
    g.fillStyle = '#f1ead6'; g.fillRect(350, 34, 170, 140); g.strokeStyle = '#555'; g.lineWidth = 1.5; g.strokeRect(350, 34, 170, 140); g.fillStyle = '#d8b878';
    for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(372 + R() * 126, 54 + R() * 100, 8 + R() * 18, 6 + R() * 12, R() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#333'; g.fillRect(392, 158, 86, 6);
    // photographs along the top and bottom
    const cols = ['#5a7aa8', '#8a6a4a', '#4a7a5a', '#a85a6a', '#c8b070', '#6a5a8a', '#3a4a5a', '#b87a4a'];
    for (let k = 0; k < 12; k++) { const x = 534 + (k % 3) * 34, y = 16 + Math.floor(k / 3) * 30; g.fillStyle = '#f6f4ee'; g.fillRect(x, y, 30, 26); g.fillStyle = cols[(k * 3) % 8]; g.fillRect(x + 2, y + 2, 26, 22); }
    for (let k = 0; k < 9; k++) { const x = 226 + k * 42, y = 214; g.fillStyle = '#f6f4ee'; g.fillRect(x, y, 34, 26); g.fillStyle = cols[(k * 5 + 1) % 8]; g.fillRect(x + 2, y + 2, 30, 22); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 2, y + 2, 30, 8); }
  });
  // kitchen noticeboard: rota, fire notice, takeaway leaflets
  put('notice', 0, 288, 256, 192, (w, h) => {
    g.fillStyle = '#7d8f6c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8a878'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    const sheet = (x, y, sw, sh, col, head) => { g.fillStyle = col; g.fillRect(x, y, sw, sh); g.fillStyle = head; g.fillRect(x + 6, y + 7, sw - 12, 8); g.fillStyle = 'rgba(40,40,40,0.5)'; for (let k = 0; k < Math.floor((sh - 28) / 7); k++) g.fillRect(x + 6, y + 22 + k * 7, (sw - 12) * (0.55 + R() * 0.45), 2); };
    sheet(18, 18, 70, 96, '#fbfaf4', '#333'); sheet(96, 16, 62, 80, '#ffe9a8', '#a03020'); sheet(166, 20, 72, 100, '#fbfaf4', '#207040'); sheet(24, 122, 84, 54, '#e6f0fb', '#234a8a'); sheet(118, 104, 40, 70, '#f8d8d8', '#802020'); sheet(170, 128, 66, 48, '#fbfaf4', '#333');
  });
  // base-unit door: pale laminate with a bar handle
  put('cab', 272, 288, 128, 128, (w, h) => { g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = '#8a8c8e'; g.fillRect(w * 0.3, 12, w * 0.4, 5); });
  // four-ring hob
  put('hob', 416, 288, 128, 128, (w, h) => { g.fillStyle = '#1a1b1d'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5a5c60'; g.lineWidth = 3; for (const [x, y, r] of [[36, 36, 20], [92, 36, 15], [36, 92, 15], [92, 92, 20]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.stroke(); } });
  // column radiator: ribs
  put('rad', 560, 288, 128, 128, (w, h) => { g.fillStyle = '#f4f3ee'; g.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { const x = (i + 0.5) * (w / 12); g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(x + 3, 0, 3, h); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x - 3, 0, 3, h); } g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5); });
  // a shelf of books
  put('books', 704, 288, 256, 64, (w, h) => { g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, w, h); let x = 2; const cs = ['#7a2a2a', '#2a4a6a', '#c8b890', '#3a5a3a', '#8a6a2a', '#5a3a5a', '#d8d0c0', '#a84a2a', '#2a2a3a']; while (x < w - 6) { const bw = 6 + R() * 11, bh = h * (0.7 + R() * 0.28); g.fillStyle = cs[Math.floor(R() * cs.length)]; g.fillRect(x, h - bh, bw, bh); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 1, h - bh + 6, bw - 2, 3); x += bw + 1; } });
  // beech veneer
  put('wood', 0, 496, 256, 128, (w, h) => { g.fillStyle = '#f1ead9'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const y = R() * h, a = 0.05 + R() * 0.1, k = (R() - 0.5) * 8; g.strokeStyle = R() < 0.6 ? `rgba(120,80,40,${a})` : `rgba(255,250,235,${a})`; g.lineWidth = 0.6 + R() * 1.6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + k, (2 * w) / 3, y - k, w, y); g.stroke(); } });
  // microwave front
  put('micro', 272, 432, 128, 72, (w, h) => { g.fillStyle = '#e8e8e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1e22'; g.fillRect(8, 8, w * 0.66, h - 16); g.fillStyle = '#2a2c30'; g.fillRect(w * 0.76, 10, w * 0.18, 14); g.fillStyle = '#9a9c9e'; for (let k = 0; k < 6; k++) g.fillRect(w * 0.76 + (k % 2) * 12, 30 + Math.floor(k / 2) * 11, 9, 7); });
  // small door plates
  for (const [i, t] of ['1', '2', '3', '4', 'Kitchen', 'Laundry', 'Fire door keep shut', 'Stairs', 'Shower'].entries()) put('lbl' + i, 416 + (i % 2) * 136, 432 + Math.floor(i / 2) * 40, 128, 34, (w, h) => {
    const fire = /Fire/.test(t);
    g.fillStyle = fire ? '#1f5fae' : '#f4f2ea'; g.fillRect(0, 0, w, h); g.fillStyle = fire ? '#ffffff' : '#222'; g.font = `bold ${fire ? 11 : 20}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2 + 1);
  });
  // ---- the courtyard house (_wbmt_block.js)
  // the stage piano's keys: 52 white keys (seven and a bit octaves from A), the black keys in their twos and threes
  put('keys', 0, 656, 624, 64, (w, h) => {
    g.fillStyle = '#f6f5ef'; g.fillRect(0, 0, w, h); const kw = w / 52;
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 1; i < 52; i++) g.fillRect(i * kw - 0.5, 0, 1, h);
    g.fillStyle = '#131314'; for (let i = 0; i < 51; i++) { const n = (i + 5) % 7; if (n === 2 || n === 6) continue; g.fillRect((i + 1) * kw - kw * 0.3, 0, kw * 0.6, h * 0.62); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h - 3, w, 3);
  });
  // white wall tiles (8 x 11 to a wall panel) and grey floor tiles
  put('tiles', 0, 736, 160, 224, (w, h) => { g.fillStyle = '#f7f8f6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,130,135,0.55)'; g.lineWidth = 1; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, h); g.stroke(); } for (let j = 0; j <= 11; j++) { g.beginPath(); g.moveTo(0, (j * h) / 11); g.lineTo(w, (j * h) / 11); g.stroke(); } for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(Math.floor(R() * 8) * (w / 8) + 3, Math.floor(R() * 11) * (h / 11) + 3, w / 8 - 10, 3); } });
  put('ftile', 176, 736, 128, 128, (w, h) => { g.fillStyle = '#c9cdcd'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '90,100,104'},${0.04 + R() * 0.08})`; g.fillRect((i * w) / 5 + 1, (j * h) / 5 + 1, w / 5 - 2, h / 5 - 2); } g.strokeStyle = 'rgba(70,76,80,0.6)'; g.lineWidth = 1.5; for (let i = 0; i <= 5; i++) { g.beginPath(); g.moveTo((i * w) / 5, 0); g.lineTo((i * w) / 5, h); g.moveTo(0, (i * h) / 5); g.lineTo(w, (i * h) / 5); g.stroke(); } });
  // the mirror over the basin: a pale reflection of white tiles and the light
  put('mirror', 320, 736, 96, 128, (w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#dfe9ee'); gr.addColorStop(0.5, '#f4f8fa'); gr.addColorStop(1, '#c9d6dc'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(w * 0.15, 0); g.lineTo(w * 0.4, 0); g.lineTo(w * 0.1, h); g.lineTo(-w * 0.15, h); g.fill(); g.strokeStyle = '#aab4ba'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3); });
  // posters (no real artwork, band or maker): a concert bill, a mountain, a film-club sheet
  put('poster1', 432, 736, 128, 176, (w, h) => { g.fillStyle = '#16243a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(w / 2, h * 0.36, 34, 0, 7); g.fill(); g.fillStyle = '#16243a'; for (let i = 0; i < 5; i++) g.fillRect(w / 2 - 30, h * 0.36 - 16 + i * 8, 60, 2); g.fillStyle = '#f2efe6'; g.fillRect(16, h * 0.66, w - 32, 9); g.fillRect(28, h * 0.74, w - 56, 5); g.fillRect(36, h * 0.8, w - 72, 5); g.fillStyle = '#c94a3a'; g.fillRect(16, h * 0.9, w - 32, 6); });
  put('poster2', 576, 736, 128, 176, (w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7fb4dc'); gr.addColorStop(0.6, '#f0d7b4'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#5a6a7a'; g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w * 0.3, h * 0.35); g.lineTo(w * 0.5, h * 0.6); g.lineTo(w * 0.72, h * 0.28); g.lineTo(w, h * 0.7); g.lineTo(w, h); g.lineTo(0, h); g.fill(); g.fillStyle = '#f6f6f2'; g.beginPath(); g.moveTo(w * 0.72, h * 0.28); g.lineTo(w * 0.64, h * 0.42); g.lineTo(w * 0.8, h * 0.42); g.fill(); g.fillStyle = '#2a3a2a'; g.fillRect(0, h * 0.86, w, h * 0.14); });
  put('poster3', 720, 736, 128, 176, (w, h) => { g.fillStyle = '#f3efe2'; g.fillRect(0, 0, w, h); g.fillStyle = '#b03a2a'; g.fillRect(0, 0, w, 30); g.fillStyle = '#222'; for (let i = 0; i < 9; i++) { g.fillRect(12, 44 + i * 14, 26, 8); g.fillRect(46, 44 + i * 14, (w - 60) * (0.5 + R() * 0.5), 3); g.fillRect(46, 50 + i * 14, (w - 60) * (0.3 + R() * 0.4), 2); } });
  // a striped rug, a page of music
  put('rug', 864, 736, 144, 96, (w, h) => { const cs = ['#7a2f2a', '#d8c9a0', '#2f4a5a', '#b8863a', '#7a2f2a', '#d8c9a0', '#2f4a5a']; for (let i = 0; i < 7; i++) { g.fillStyle = cs[i]; g.fillRect(0, (i * h) / 7, w, h / 7 + 1); } g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 40; i++) g.fillRect(R() * w, R() * h, 6, 1); });
  put('sheet', 864, 848, 96, 128, (w, h) => { g.fillStyle = '#fbfaf3'; g.fillRect(0, 0, w, h); g.strokeStyle = '#333'; g.lineWidth = 0.6; for (let s = 0; s < 6; s++) for (let l = 0; l < 5; l++) { const y = 12 + s * 19 + l * 2.6; g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke(); } g.fillStyle = '#222'; for (let i = 0; i < 70; i++) { const s = Math.floor(R() * 6); g.beginPath(); g.ellipse(12 + R() * (w - 24), 12 + s * 19 + R() * 11, 2, 1.5, -0.4, 0, 7); g.fill(); } });
  // ---- small things for the lived-in rooms (second pass)
  // fire action notice (the standard blue and white sheet, no maker), a wall clock, an oven front, a cereal box,
  // a term timetable, a strip of sticky notes, a row of envelopes, a gig ticket / photographs strip
  put('fire', 712, 368, 96, 128, (w, h) => { g.fillStyle = '#fdfdfb'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f5fae'; g.fillRect(0, 0, w, 26); g.fillStyle = '#fff'; g.font = 'bold 13px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FIRE ACTION', w / 2, 14); g.fillStyle = '#1f5fae'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(14, 42 + i * 22, 7, 0, 7); g.fill(); } g.fillStyle = '#333'; for (let i = 0; i < 4; i++) { g.fillRect(28, 37 + i * 22, 56, 3); g.fillRect(28, 43 + i * 22, 44, 2); } g.fillStyle = '#2a8a3a'; g.fillRect(8, h - 16, w - 16, 9); });
  put('oven', 816, 368, 128, 128, (w, h) => { g.fillStyle = '#d9dadb'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2c30'; g.fillRect(0, 0, w, 22); g.fillStyle = '#c8cacc'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(18 + i * 30, 11, 6, 0, 7); g.fill(); } g.fillStyle = '#17181b'; g.fillRect(10, 34, w - 20, h - 48); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(14, 38, w - 28, 18); g.fillStyle = '#9a9c9e'; g.fillRect(12, 26, w - 24, 5); });
  put('clock', 952, 368, 64, 64, (w, h) => { g.fillStyle = '#2a2c30'; g.beginPath(); g.arc(w / 2, h / 2, 31, 0, 7); g.fill(); g.fillStyle = '#fbfaf4'; g.beginPath(); g.arc(w / 2, h / 2, 27, 0, 7); g.fill(); g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; g.fillRect(w / 2 + Math.sin(a) * 22 - 1, h / 2 - Math.cos(a) * 22 - 1, 2.5, 2.5); } g.strokeStyle = '#222'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 9, h / 2 - 9); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 4, h / 2 - 18); g.stroke(); });
  put('cereal', 952, 440, 64, 96, (w, h) => { g.fillStyle = '#e0a020'; g.fillRect(0, 0, w, h); g.fillStyle = '#c0301c'; g.fillRect(0, 0, w, 24); g.fillStyle = '#f6e6b0'; g.beginPath(); g.ellipse(w / 2, h * 0.62, 22, 14, 0, 0, 7); g.fill(); g.fillStyle = '#b8782a'; for (let i = 0; i < 16; i++) g.fillRect(w / 2 - 16 + R() * 30, h * 0.62 - 8 + R() * 14, 5, 3); g.fillStyle = '#fff'; g.fillRect(8, 8, w - 16, 7); });
  put('timetable', 712, 504, 128, 96, (w, h) => { g.fillStyle = '#fbfaf4'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a3a5a'; g.fillRect(0, 0, w, 14); const cs = ['#c8dcf0', '#f0d8c8', '#d8f0c8', '#f0ecc0', '#e6d0ee']; for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) { g.fillStyle = R() < 0.42 ? cs[Math.floor(R() * 5)] : '#f1efe8'; g.fillRect(4 + q * 20.5, 18 + r * 15, 18.5, 13); } g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, w - 1, h - 1); });
  put('envelopes', 848, 504, 160, 64, (w, h) => { g.fillStyle = '#6a4a2c'; g.fillRect(0, 0, w, h); for (let r = 0; r < 2; r++) for (let q = 0; q < 5; q++) { const x = 3 + q * 31.5, y = 3 + r * 30; g.fillStyle = '#3a2816'; g.fillRect(x, y, 29, 27); const n = Math.floor(R() * 4); for (let k = 0; k < n; k++) { g.fillStyle = ['#f6f2e6', '#e8dcc0', '#d8e6f0', '#f6f2e6'][k]; g.fillRect(x + 2, y + 22 - k * 4, 25 - R() * 6, 3); } } });
  put('postits', 624, 656, 384, 64, (w, h) => { g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, w, h); const cs = ['#f6e36a', '#f4a6c0', '#a8e0a0', '#a6d4f4', '#f6e36a', '#f8c070']; for (let i = 0; i < 6; i++) { g.save(); g.translate(8 + i * 63, 6); g.rotate((R() - 0.5) * 0.12); g.fillStyle = cs[i]; g.fillRect(0, 0, 52, 50); g.fillStyle = 'rgba(40,40,60,0.7)'; for (let k = 0; k < 4; k++) g.fillRect(6, 10 + k * 9, 20 + R() * 20, 2); g.restore(); } });
  const t = tex(c, { wrap: false });
  return (_rooms = repaintableAll({ texture: t, uv: (n) => cells[n] }, () => { const k = _rooms; _rooms = null; try { return paintRooms(); } finally { _rooms = k; } }, 'beaumont rooms'));      // (memory pass, as the decals)
}

let _grain = null;
/** ONE small repeating grain texture that the plain surfaces are multiplied by, so a wall is paint on plaster and a
 *  floor is carpet from near to. Key cells '~plaster' and '~carpet' both use it, at TILE metres a repeat (the carpet's
 *  much finer), and all of a zone's grained faces are ONE mesh ('zone~grain'): a repeating texture cannot live in the
 *  rooms' atlas, so this is the one extra draw a room costs. -> { grain } */
export const TILE = { '~plaster': 0.55, '~carpet': 0.22 };
export function paintGrain() {
  if (_grain) return _grain;
  const S = 256, { c, g } = canvas(S, S), R = rng(31);
  // (kept faint: at arm's length it is the tooth of emulsion or the pile of a carpet; across a room it is a plain colour)
  g.fillStyle = '#f4f4f3'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { g.fillStyle = R() < 0.5 ? `rgba(255,255,255,${0.1 + R() * 0.2})` : `rgba(96,96,96,${0.02 + R() * 0.045})`; g.fillRect(R() * S, R() * S, 1 + R() * 1.2, 1 + R() * 1.2); }
  // faint soft blotches, wrapped at the edges (a roller on plaster; wear on a carpet)
  for (let i = 0; i < 30; i++) { const x = R() * S, y = R() * S, r = 10 + R() * 26; g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '100,100,100'},${0.008 + R() * 0.012})`; for (const dx of [0, -S, S]) for (const dy of [0, -S, S]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); } }
  return (_grain = { grain: tex(c, { wrap: true }) });
}

// ================================================================================================ exterior
// (bmt* keys: this module's own tints of the Worcester atlas cells, added to the pack in worcester_beaumont.js —
// weathered golden Bath stone and a paler stucco than the college's)
const WALL = { stucco: ['bmtStucco', 'bmtStucco'], ashlar: ['bmtStone', 'bmtDress'] };

/** a painted sash unit filling x0..x1, y0..y1 at depth z. kind 's66' | 's33' | 's88' | 'french' (painted). bay: lit hash */
function paintedWindow(B, kind, x0, x1, y0, y1, z, bay) {
  if (kind === 's66') { B.unit('sash', rectPts(x0, y0, x1, y1), z, bay); return; }
  if (kind === 's33') { B.unit('sashAttic', rectPts(x0, y0, x1, y1), z, bay); return; }
  // four panes wide from a three-pane cell: two halves, each the frame and two panes, meeting on a glazing bar
  const xm = (x0 + x1) / 2, E = 0.004, S = 1 - 2 * E, u = (f) => bay[0] + E + f * S, v0 = bay[1] + E, v1 = bay[1] + E + S;
  B.poly('sash', [[x0, y0, z], [xm, y0, z], [xm, y1, z], [x0, y1, z]], [0, 0, 1], [[u(0), v0], [u(0.641), v0], [u(0.641), v1], [u(0), v1]]);
  B.poly('sash', [[xm, y0, z], [x1, y0, z], [x1, y1, z], [xm, y1, z]], [0, 0, 1], [[u(0.359), v0], [u(1), v0], [u(1), v1], [u(0.359), v1]]);
  if (kind === 'french') {
    const h = y1 - y0;
    B.box('white', xm, (y0 + y1) / 2, z + 0.02, 0.09, h, 0.04); B.box('white', xm, y0 + h * 0.8, z + 0.02, x1 - x0, 0.08, 0.04); B.box('white', xm, y0 + 0.09, z + 0.02, x1 - x0, 0.18, 0.04);
  }
}
/** real joinery in an opening: frame, glazing bars (the pane itself is drawn with the room behind it: glassGeometry) */
function realWindow(B, kind, x0, x1, y0, y1, z) {
  const w = x1 - x0, h = y1 - y0, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2, k = 'white', d = 0.05;
  B.box(k, x0 + 0.035, ym, z, 0.07, h, d); B.box(k, x1 - 0.035, ym, z, 0.07, h, d); B.box(k, xm, y1 - 0.035, z, w, 0.07, d); B.box(k, xm, y0 + 0.04, z, w, 0.08, d);
  if (kind === 's88') {
    for (let i = 1; i < 4; i++) B.box(k, x0 + (w * i) / 4, ym, z, 0.028, h - 0.1, 0.03);
    for (let j = 1; j < 4; j++) B.box(k, xm, y0 + (h * j) / 4, z, w - 0.1, j === 2 ? 0.06 : 0.028, j === 2 ? 0.045 : 0.03);
  } else {
    const yt = y0 + h * 0.8;
    B.box(k, xm, ym, z, 0.1, h - 0.1, d); B.box(k, xm, yt, z, w - 0.1, 0.08, d); B.box(k, xm, y0 + 0.12, z, w - 0.1, 0.16, d);
    for (const sx of [-1, 1]) { B.box(k, xm + sx * w * 0.25, (y0 + yt) / 2, z, 0.028, yt - y0 - 0.1, 0.03); for (let j = 1; j < 4; j++) B.box(k, xm + sx * w * 0.25, y0 + 0.2 + ((yt - y0 - 0.2) * j) / 4, z, w / 2 - 0.1, 0.028, 0.03); }
  }
}
const FAN = { z: -0.2, r: (w) => w / 2 - 0.02 };
/** The panes of No. 7's real openings, in the front frame = the room's frame: one small geometry (position, uv into the
 *  decal sheet's 'glass' cell) for a transparent, depthWrite:false material in the ROOM's scene — so the glass lies over
 *  the live street seen from inside and over the lit room seen from the pavement. */
export function glassGeometry(D) {
  const g = D.uv('glass'), gm = [(g[0] + g[2]) / 2, (g[1] + g[3]) / 2], pos = [], uv = [];
  const tri = (a, b, c, ta, tb, tc) => { pos.push(...a, ...b, ...c); uv.push(...ta, ...tb, ...tc); };
  const dr = HOUSES.find((h) => h.enter).door, r = FAN.r(dr.w), c = [dr.s, Y(dr.spring) + 0.06, FAN.z];
  for (let i = 0; i < 8; i++) { const a0 = (i / 8) * Math.PI, a1 = ((i + 1) / 8) * Math.PI; tri(c, [c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * (r - 0.04), c[2]], [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * (r - 0.04), c[2]], gm, [g[0], g[1]], [g[2], g[3]]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}
function balconette(B, D, xc, yFloor) {
  const w = 1.75, h = 0.95, d = 0.46, x0 = xc - w / 2, x1 = xc + w / 2, y0 = yFloor - 0.04, y1 = y0 + h;
  B.box('iron', xc, y0 - 0.02, d / 2 + 0.01, w, 0.04, d, 0, { bottom: true });
  for (const x of [x0 + 0.18, x1 - 0.18]) B.beam('iron', [x, y0 - 0.04, 0.02], [x, y0 - 0.3, 0.02], 0.04);
  for (const x of [x0 + 0.18, x1 - 0.18]) B.beam('iron', [x, y0 - 0.3, 0.02], [x, y0 - 0.05, d * 0.8], 0.035);
  B.card('bmtDecal', [x0, y0, d], [x1, y0, d], [x1, y1, d], [x0, y1, d], D.uv('balc'));
  B.card('bmtDecal', [x0, y0, 0.02], [x0, y0, d], [x0, y1, d], [x0, y1, 0.02], D.uv('balcSide'));
  B.card('bmtDecal', [x1, y0, d], [x1, y0, 0.02], [x1, y1, 0.02], [x1, y1, d], D.uv('balcSide'));
}
function porch(B, key, xc, door) {
  const P = LEVELS.porch, r = P.colR, z = P.proj;
  for (const sx of [-1, 1]) {
    const x = xc + sx * (P.half - r - 0.02);
    B.box(key, x, Y(LEVELS.step + 0.11), z - r, r * 2.5, 0.22, r * 2.5);                       // plinth block
    B.cyl(key, x, Y(LEVELS.step + 0.22), z - r, r * 0.86, P.colTop - LEVELS.step - 0.34, 10, false, r);
    B.box(key, x, Y(P.colTop - 0.06), z - r, r * 2.5, 0.12, r * 2.5);                            // abacus
    B.box(key, xc + sx * (P.half - 0.07), Y((LEVELS.step + P.colTop) / 2), 0.03, 0.14, P.colTop - LEVELS.step, 0.06);   // the pilaster strip behind
  }
  B.box(key, xc, Y((P.colTop + P.entTop - 0.1) / 2), z / 2 + 0.02, P.half * 2 + 0.06, P.entTop - 0.1 - P.colTop, z + 0.04, 0, { bottom: true });
  B.box(key, xc, Y(P.entTop - 0.05), z / 2 + 0.06, P.half * 2 + 0.26, 0.1, z + 0.22, 0, { bottom: true });
  B.box(key, xc, Y(LEVELS.step / 2), 0.26, door.w + 0.9, LEVELS.step, 0.52);                      // the stone step
}

/**
 * The three fronts and everything behind them. B: Batch (front frame). D: paintDecals().
 * -> {counts: [{no, windows, doors, balconies}], holes: real openings cut in the front wall}
 */
export function buildExterior(B, D) {
  const counts = [];
  for (const H of HOUSES) {
    const [wk, dk] = WALL[H.wall], top = Y(H.top), cnt = { no: H.no, windows: 0, doors: 0, balconies: 0 };
    const holes = [];
    const dr = H.door, dx0 = dr.s - dr.w / 2, dx1 = dr.s + dr.w / 2, dy0 = Y(LEVELS.step), dys = Y(dr.spring);
    holes.push(archPts(dr.s, dr.w, dy0, dys, 10));
    for (const w of H.wins) holes.push(rectPts(w[1] - w[2] / 2, Y(w[3]), w[1] + w[2] / 2, Y(w[4])));
    B.face(wk, rectPts(H.s0, 0, H.s1, top), holes, 0);
    // door: stone reveal, then (painted houses) a black six-panel leaf under a plain fanlight
    const RV = 0.2;
    B.reveal(dk, archPts(dr.s, dr.w, dy0, dys, 10), 0, -RV, true);
    if (!H.enter) {
      B.unit('doorDark', rectPts(dx0, dy0, dx1, dys), -RV, [H.no, 9]);
      const fan = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; fan.push([dr.s + Math.cos(a) * dr.w / 2, dys + Math.sin(a) * dr.w / 2, -RV]); }
      for (let i = 0; i < 10; i++) B.tri('glassDark', [dr.s, dys, -RV], fan[i], fan[i + 1], [0, 0], [0, 0], [0, 0]);
      B.box('white', dr.s, dys, -RV + 0.02, dr.w, 0.07, 0.04);
    } else {
      // the real doorway: frame, transom, a fanlight with radial bars (the leaf is hung by worcester_beaumont.js)
      const z = -0.2;
      B.box('white', dx0 + 0.025, (dy0 + dys) / 2, z, 0.05, dys - dy0, 0.1); B.box('white', dx1 - 0.025, (dy0 + dys) / 2, z, 0.05, dys - dy0, 0.1);
      B.box('white', dr.s, dys + 0.03, z, dr.w, 0.06, 0.1);
      const r = dr.w / 2 - 0.02, c = [dr.s, dys + 0.06, z];
      for (const a of [0.52, 1.05, 1.57, 2.09, 2.62]) B.beam('white', c, [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * (r - 0.04), z], 0.025);
      for (let i = 0; i < 8; i++) { const a0 = (i / 8) * Math.PI, a1 = ((i + 1) / 8) * Math.PI; B.beam('white', [c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * (r - 0.04), z], [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * (r - 0.04), z], 0.035); B.beam('white', [c[0] + Math.cos(a0) * r * 0.32, c[1] + Math.sin(a0) * r * 0.32, z], [c[0] + Math.cos(a1) * r * 0.32, c[1] + Math.sin(a1) * r * 0.32, z], 0.022); }
      // (the fanlight's glass: glassGeometry)
      // Behind the real openings, when the rooms are not drawn (far off; before they are built): the dark of an unlit
      // house instead of a view straight through it. Five faces looking INWARDS just outside the rooms' walls (so the
      // rooms, drawn in place by core/interiors.js, are always in front of them, and from indoors they are never seen).
      const a = IN.S0 - 0.08, b = IN.S1 + 0.08, tb = SHELL7.t1 - 0.03, y0 = 0.02, y1 = Y(IN.GC) + 0.12, zf = -0.2;
      B.push(frame(a, 0, -tb, 1, 0)); B.face('dark', rectPts(0, y0, b - a, y1), [rectPts(20.85 - a, y0, 21.75 - a, Y(IN.G + 2.06))], 0); B.pop();      // the back (holed at the back doorway)
      B.poly('dark', [[a, y0, -tb], [a, y1, -tb], [a, y1, zf], [a, y0, zf]], [1, 0, 0]);              // towards No. 6
      B.poly('dark', [[b, y0, zf], [b, y1, zf], [b, y1, -tb], [b, y0, -tb]], [-1, 0, 0]);             // the Playhouse side
      B.poly('dark', [[a, y1, zf], [a, y1, -tb], [b, y1, -tb], [b, y1, zf]], [0, -1, 0]);             // overhead
      B.poly('dark', [[a, y0, -tb], [a, y0, zf], [b, y0, zf], [b, y0, -tb]], [0, 1, 0]);              // underfoot
    }
    cnt.doors++;
    porch(B, dk, dr.s, dr);
    B.sign('bmtDecal', dr.s + 1.02, Y(1.52), dr.s + 1.18, Y(1.68), 0.012, D.uv('num' + H.no));
    if (H.no !== 5) B.sign('bmtDecal', dr.s + 1.02, Y(1.2), dr.s + 1.14, Y(1.4), 0.012, D.uv('entry'));
    // windows
    let wi = 0;
    for (const w of H.wins) {
      const [kind, sc, ww, ys, yh, real] = w, x0 = sc - ww / 2, x1 = sc + ww / 2, y0 = Y(ys), y1 = Y(yh), ZR = 0.13;
      B.reveal(dk, rectPts(x0, y0, x1, y1), 0, -ZR);
      if (real) realWindow(B, kind, x0, x1, y0, y1, -ZR - 0.02);
      else paintedWindow(B, kind, x0, x1, y0, y1, -ZR, [H.no * 16 + wi, Math.round(ys)]);
      if (kind === 'french') { balconette(B, D, sc, y0); cnt.balconies++; }
      else B.box(dk, sc, y0 - 0.04, 0.04, ww + 0.22, 0.08, 0.1, 0, { bottom: true });
      cnt.windows++; wi++;
    }
    // strings, cornice, blocking course / parapet
    const L = H.s1 - H.s0, xc = (H.s0 + H.s1) / 2;
    const band = (y0, y1, proj, key = dk) => B.box(key, xc, Y((y0 + y1) / 2), proj / 2, L, y1 - y0, proj, 0, { bottom: true });
    // (the first-floor band stops either side of the porch's entablature, which stands in front of it)
    for (const [a, b] of [[H.s0, dr.s - LEVELS.porch.half - 0.03], [dr.s + LEVELS.porch.half + 0.03, H.s1]]) if (b - a > 0.05) B.box(dk, (a + b) / 2, Y((LEVELS.band[0] + LEVELS.band[1]) / 2), 0.025, b - a, LEVELS.band[1] - LEVELS.band[0], 0.05, 0, { bottom: true });
    if (H.wall === 'ashlar') {
      band(LEVELS.sillBand[0] - 0.02, LEVELS.sillBand[0] + 0.06, 0.045);
      for (const [a, b] of [[H.s0, dx0 - 0.5], [dx1 + 0.5, H.s1]]) B.box(dk, (a + b) / 2, Y(LEVELS.plinth / 2), 0.02, b - a, LEVELS.plinth, 0.04);
    }
    band(LEVELS.cornice[0], LEVELS.cornice[0] + 0.14, 0.09); band(LEVELS.cornice[0] + 0.14, LEVELS.cornice[1] - 0.07, 0.2); band(LEVELS.cornice[1] - 0.07, LEVELS.cornice[1], 0.27);
    if (H.wall === 'stucco') { band(H.top - 0.28, H.top - 0.12, 0.08); band(H.top - 0.12, H.top, 0.16); }
    counts.push(cnt);
  }
  // ---- ashlar pair: blocking course top, slate roof, the quoins at the Playhouse end, the rainwater pipes
  const A0 = HOUSES[1].s0, A1 = FRONT, yb = Y(LEVELS.blocking), ridge = Y(10.35), RT = 4.2;
  B.poly('bmtDress', [[A0, yb, 0], [A1, yb, 0], [A1, yb, -0.34], [A0, yb, -0.34]], [0, 1, 0]);
  B.poly('bmtDress', [[A1, yb - 0.3, -0.34], [A0, yb - 0.3, -0.34], [A0, yb, -0.34], [A1, yb, -0.34]], [0, 0, -1]);
  B.poly('slate', [[A0, yb - 0.3, -0.34], [A1, yb - 0.3, -0.34], [A1, ridge, -RT], [A0, ridge, -RT]], [0, 1, 0.3]);
  B.poly('slate', [[A0, ridge, -RT], [A1, ridge, -RT], [A1, Y(8.9), -DEPTH], [A0, Y(8.9), -DEPTH]], [0, 1, -0.3]);
  B.box('lead', (A0 + A1) / 2, ridge + 0.03, -RT, A1 - A0, 0.07, 0.24);
  B.poly('bmtStone', [[A1, Y(8.9), -DEPTH], [A1, Y(8.9) + (yb - Y(8.9)) * (DEPTH - 0.34) / DEPTH, -0.34], [A1, ridge, -RT]], [1, 0, 0]);                       // west gable
  B.poly('bmtStone', [[A1, 0, 0], [A1, 0, -DEPTH], [A1, Y(8.9), -DEPTH], [A1, yb, 0]], [1, 0, 0]);
  for (let i = 0, y = LEVELS.plinth; y < LEVELS.cornice[0] - 0.31; i++, y += 0.31) { const l = i % 2 ? 0.34 : 0.52; B.box('bmtDress', A1 - l / 2, Y(y + 0.15), 0.014, l, 0.285, 0.028); }
  B.box('white', HOUSES[2].s0 + 0.02, Y(4.4), 0.07, 0.085, 8.3, 0.085); B.box('white', HOUSES[2].s0 + 0.02, Y(8.55), 0.09, 0.2, 0.2, 0.16);
  B.box('bmtStucco', A0 - 0.05, Y(4.4), 0.07, 0.085, 8.3, 0.085);
  // ---- No. 5: its upper storey stands a floor above the pair; flat roof behind the parapet
  const H5 = HOUSES[0], t5 = Y(H5.top);
  B.poly('bmtStucco', [[A0, yb - 0.3, 0], [A0, yb - 0.3, -DEPTH], [A0, t5, -DEPTH], [A0, t5, 0]], [1, 0, 0]);
  B.poly('bmtStucco', [[0, 0, 0], [0, 0, -DEPTH], [0, t5, -DEPTH], [0, t5, 0]], [-1, 0, 0]);
  B.poly('bmtStucco', [[0, t5, 0], [A0, t5, 0], [A0, t5, -0.3], [0, t5, -0.3]], [0, 1, 0]);
  B.poly('lead', [[0, t5 - 0.25, -0.3], [A0, t5 - 0.25, -0.3], [A0, t5 - 0.25, -DEPTH], [0, t5 - 0.25, -DEPTH]], [0, 1, 0]);
  B.poly('bmtStucco', [[A0, t5 - 0.25, -0.3], [0, t5 - 0.25, -0.3], [0, t5, -0.3], [A0, t5, -0.3]], [0, 0, -1]);
  B.poly('bmtStucco', [[A0, Y(8.9), -DEPTH], [0, Y(8.9), -DEPTH], [0, t5, -DEPTH], [A0, t5, -DEPTH]], [0, 0, -1]);
  B.sign('bmtDecal', 0.27, Y(1.85), 0.77, Y(2.35), 0.02, D.uv('plaque'));
  // ---- chimney stacks: red brick, a stone cap, two pots
  for (const [s, t, top] of CHIMNEYS) {
    const y0 = Y(8.9), y1 = Y(top);
    B.box('redBrick', s, (y0 + y1) / 2, -t, 1.0, y1 - y0, 0.62, 0, { top: false }); B.box('bmtDress', s, y1 + 0.04, -t, 1.1, 0.08, 0.72, 0, { bottom: true });
    for (const dx of [-0.3, 0, 0.3]) B.cyl('terracotta', s + dx, y1 + 0.08, -t, 0.1, 0.4, 7, true, 0.12);
  }
  // ---- everything behind: the courtyard side of the front range, the courtyard, the orange block, the masses round it
  const site = buildSite(B, D);
  return { counts, site };
}

// ================================================================================================ interiors
export const C = { wall: 'f0e8d4', ceil: 'f6f4ec', white: 'f3f1e9', hallFloor: '566270', stairCarpet: '4d5864', kitchFloor: '9aa2a6', carpet: '5c1f2b', beech: 'd9b47a', dark: '2a2c30',
  steel: 'b4b8bc', worktop: '54585c', duvet: '4f6d92', pillow: 'f1efe8', mattress: 'e4dfd2', chair: '34383d', curtain: 'd9d0b8', oak: '7a5a3c', screen: '14161a', mug: 'c44a3a', bin: '3a3e42',
  frame: '7f93a6', tile: 'f4f5f3', sanitary: 'fbfbf9', chrome: 'c9ced2' };
export const KEY = (zone, col, cell = '') => `${zone}|${col}|${cell}`;
const CARPETS = new Set([C.carpet, C.hallFloor, C.stairCarpet]);
export const U1 = [0, 0, 1, 1];

/**
 * The helpers the rooms are built with, on Batch B in the front frame (x = s, z = -t). Everything takes [s, t] points.
 * Walls: wall(zone, col, a, b, y0, y1, holes, rv) is ONE face, seen from the side (dt, -ds) of a -> b (walk a -> b with
 * the room on your right... i.e. going west it is seen from the north, going south from the west); holes are in
 * (u along a -> b, y) and get white reveals rv deep. Furniture: origin at the middle of its back on the floor, `rot`
 * turns its front (local +z): 0 faces north (-t), PI south, PI / 2 west (+s), -PI / 2 east.
 */
export function roomKit(B) {
  const wall = (zone, col, a, b, y0, y1, holes = [], rv = 0.05) => {
    B.push(frame(a[0], 0, -a[1], b[0] - a[0], -(b[1] - a[1])));
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    B.face(KEY(zone, col, '~plaster'), rectPts(0, y0, L, y1), holes, 0);
    for (const h of holes) B.reveal(KEY(zone, C.white), h, 0, -rv, Math.min(...h.map((p) => p[1])) <= y0 + 1e-3);
    B.pop();
  };
  const onWall = (a, b, fn) => { B.push(frame(a[0], 0, -a[1], b[0] - a[0], -(b[1] - a[1]))); fn(Math.hypot(b[0] - a[0], b[1] - a[1])); B.pop(); };
  const floor = (zone, col, s0, s1, t0, t1, y, down = false) => B.poly(KEY(zone, col, down ? '~plaster' : CARPETS.has(col) ? '~carpet' : ''), [[s0, y, -t0], [s1, y, -t0], [s1, y, -t1], [s0, y, -t1]], [0, down ? -1 : 1, 0]);
  const box = (zone, col, s0, s1, y0, y1, t0, t1, o) => B.boxXZ(KEY(zone, col), s0, s1, y0, y1, -t1, -t0, o);
  const skirt = (zone, a, b, y, gaps = []) => onWall(a, b, (L) => { let u = 0; for (const [g0, g1] of [...gaps, [L, L]]) { if (g0 - u > 0.02) B.box(KEY(zone, C.white), (u + g0) / 2, y + 0.06, 0.012, g0 - u, 0.12, 0.024); u = g1; } });
  /** a painted (shut) door on a wall: architrave, the door cell, a small plate */
  const decalDoor = (zone, a, b, u0, y, label) => onWall(a, b, () => {
    B.box(KEY(zone, C.white), u0 + 0.45, y + 1.03, 0.012, 1.02, 2.06, 0.024);
    B.sign(KEY(zone, 'ffffff', 'door'), u0, y, u0 + 0.9, y + 2.0, 0.026, U1);
    if (label) B.sign(KEY(zone, 'ffffff', label), u0 + 0.3, y + 1.52, u0 + 0.6, y + 1.6, 0.03, U1);
  });
  /** the white lining of a real doorway in a partition 0.1 m thick (the leaf is hung by worcester_beaumont.js) */
  const architrave = (zone, a, b, u0, u1, y, h = 2.02) => onWall(a, b, () => {
    for (const u of [u0 - 0.04, u1 + 0.04]) B.box(KEY(zone, C.white), u, y + h / 2 + 0.02, 0.012, 0.08, h + 0.04, 0.024);
    B.box(KEY(zone, C.white), (u0 + u1) / 2, y + h + 0.04, 0.012, u1 - u0 + 0.16, 0.08, 0.024);
  });
  const radiator = (zone, a, b, u0, u1, y) => onWall(a, b, () => { B.box(KEY(zone, C.white), (u0 + u1) / 2, y + 0.42, 0.07, u1 - u0, 0.6, 0.1); B.sign(KEY(zone, 'ffffff', 'rad'), u0, y + 0.12, u1, y + 0.72, 0.122, U1); });
  const board = (zone, a, b, u0, u1, y0, y1, cell = 'cork', rim = C.oak) => onWall(a, b, () => { B.box(KEY(zone, rim), (u0 + u1) / 2, (y0 + y1) / 2, 0.012, u1 - u0 + 0.04, y1 - y0 + 0.04, 0.024); B.sign(KEY(zone, 'ffffff', cell), u0, y0, u1, y1, 0.026, U1); });
  const light = (zone, s, t, yC, r = 0.18) => B.cyl(KEY(zone, 'fff6da'), s, yC - 0.09, -t, r, 0.09, 10, false, r * 0.8);
  /** curtains drawn back either side of a window on a wall (u0..u1 the window), with a pole */
  const curtains = (zone, a, b, u0, u1, y0, y1, col = C.curtain) => onWall(a, b, () => {
    for (const u of [u0 - 0.12, u1 + 0.12]) B.box(KEY(zone, col), u, (y0 + y1) / 2, 0.06, 0.3, y1 - y0, 0.07);
    B.box(KEY(zone, C.oak), (u0 + u1) / 2, y1 + 0.02, 0.06, u1 - u0 + 0.7, 0.035, 0.035);
  });
  const at = (s, t, y, rot, fn) => { B.push(M4().makeRotationY(rot).setPosition(s, y, -t)); fn(); B.pop(); };
  const chair = (zone, s, t, rot, y, col = C.chair) => at(s, t, y, rot, () => {
    B.box(KEY(zone, col), 0, 0.46, 0, 0.46, 0.07, 0.44, 0, { bottom: true }); B.box(KEY(zone, col), 0, 0.82, -0.2, 0.42, 0.42, 0.06);
    B.box(KEY(zone, C.dark), 0, 0.23, 0, 0.05, 0.4, 0.05); for (const a of [0, 1.26, 2.51, 3.77, 5.03]) B.beam(KEY(zone, C.dark), [0, 0.04, 0], [Math.sin(a) * 0.28, 0.04, Math.cos(a) * 0.28], 0.04);
  });
  const kChair = (zone, s, t, rot, y) => at(s, t, y, rot, () => {
    B.box(KEY(zone, C.beech), 0, 0.45, 0, 0.4, 0.04, 0.4, 0, { bottom: true }); B.box(KEY(zone, C.beech), 0, 0.78, -0.19, 0.38, 0.3, 0.03);
    for (const [x, z] of [[-0.17, 0.17], [0.17, 0.17]]) B.box(KEY(zone, C.steel), x, 0.215, z, 0.03, 0.43, 0.03); for (const x of [-0.17, 0.17]) B.box(KEY(zone, C.steel), x, 0.47, -0.19, 0.03, 0.94, 0.03);
  });
  /** a single bed, long side against the wall; o.head: -1 (default) the head at local -x, +1 at +x; o.duvet colour; o.messy */
  const bed = (zone, s, t, y, rot, o = {}) => at(s, t, y, rot, () => {
    const L = o.len || 1.95, W = 0.92, hd = o.head || -1, k = (c) => KEY(zone, c);
    B.box(k(C.beech), 0, 0.15, W / 2, L, 0.3, W);
    B.box(k(C.mattress), 0, 0.39, W / 2, L - 0.04, 0.18, W - 0.04);
    B.box(k(o.duvet || C.duvet), -hd * (o.messy ? 0.4 : 0.25), 0.525, W / 2 + 0.012, L - (o.messy ? 0.8 : 0.5), 0.09, W + 0.024, o.messy ? 0.06 : 0);
    B.box(k(o.pillow || C.pillow), hd * (L / 2 - 0.3), 0.54, W / 2, 0.42, 0.12, 0.66, o.messy ? -0.15 : 0);
    B.box(k(C.beech), hd * (L / 2 + 0.02), 0.45, W / 2, 0.04, 0.9, W);
  });
  /** a beech desk with a drawer pedestal at its local +x end; o: w, monitor / laptop / mug / lamp (x positions), books [[x, [cols], n]] */
  const desk = (zone, s, t, y, rot, o = {}) => at(s, t, y, rot, () => {
    const w = o.w || 1.2, d = 0.6, k = (c) => KEY(zone, c);
    B.box(k(C.beech), 0, 0.72, d / 2, w, 0.04, d, 0, { bottom: true });
    B.box(k(C.beech), w / 2 - 0.21, 0.35, d / 2, 0.42, 0.7, d - 0.04); B.box(k(C.beech), -w / 2 + 0.015, 0.35, d / 2, 0.03, 0.7, d - 0.04);
    for (let i = 0; i < 3; i++) { B.box(k('e6c389'), w / 2 - 0.21, 0.13 + i * 0.22, d - 0.014, 0.38, 0.2, 0.012); B.box(k('f2dcae'), w / 2 - 0.21, 0.13 + i * 0.22, d, 0.035, 0.035, 0.024); }
    if (o.monitor !== undefined) { B.box(k(C.screen), o.monitor, 1.03, 0.16, 0.56, 0.34, 0.025); B.box(k(C.dark), o.monitor, 0.8, 0.14, 0.05, 0.12, 0.04); B.box(k(C.dark), o.monitor, 0.746, 0.16, 0.22, 0.012, 0.16); }
    if (o.laptop !== undefined) { B.box(k(C.steel), o.laptop, 0.748, 0.38, 0.32, 0.014, 0.22); B.box(k(C.steel), o.laptop, 0.86, 0.268, 0.32, 0.21, 0.012); B.box(k('9fb4d8'), o.laptop, 0.86, 0.276, 0.29, 0.18, 0.004); }
    for (const [x, cols, n] of o.books || []) for (let i = 0; i < n; i++) B.box(k(cols[i % cols.length]), x, 0.756 + i * 0.032, 0.36, 0.2 - i * 0.012, 0.03, 0.27, 0.1 * i);
    if (o.mug !== undefined) B.cyl(k(o.mugCol || C.mug), o.mug, 0.74, 0.44, 0.04, 0.095, 7, true);
    if (o.lamp !== undefined) { B.cyl(k(C.dark), o.lamp, 0.74, 0.12, 0.07, 0.015, 8, true); B.beam(k(C.dark), [o.lamp, 0.75, 0.12], [o.lamp, 1.1, 0.16], 0.018); B.cyl(k('e8e0c0'), o.lamp, 1.08, 0.2, 0.05, 0.1, 8, true, 0.09); }
  });
  const bookcase = (zone, s, t, y, rot, o = {}) => at(s, t, y, rot, () => {
    const w = o.w || 0.62, h = o.h || 1.85, d = o.d || 0.28, n = o.n || 4, k = (c, ce) => KEY(zone, c, ce), gap = (h - 0.08) / n;
    B.box(k(C.beech), 0, h / 2, 0.02, w, h, 0.04); for (const sx of [-1, 1]) B.box(k(C.beech), sx * (w / 2 - 0.012), h / 2, d / 2, 0.024, h, d);
    for (let i = 0; i <= n; i++) { const yy = 0.06 + i * gap; B.box(k(C.beech), 0, yy, d / 2, w - 0.04, 0.024, d, 0, { bottom: true }); if (i < n && !(o.empty || []).includes(i)) B.sign(k('ffffff', 'books'), -w / 2 + 0.03, yy + 0.014, w / 2 - 0.03, yy + Math.min(0.3, gap - 0.06), d - 0.05, U1); }
  });
  const wardrobe = (zone, s, t, y, rot, o = {}) => at(s, t, y, rot, () => {
    const w = o.w || 1.0, h = o.h || 1.95, d = o.d || 0.58, k = (c) => KEY(zone, c);
    B.box(k(C.beech), 0, h / 2, d / 2, w, h, d);
    B.box(k('8a6a40'), 0, h / 2, d + 0.002, 0.008, h - 0.08, 0.004); for (const sx of [-1, 1]) B.box(k(C.steel), sx * 0.06, 1.0, d + 0.012, 0.015, 0.14, 0.02);
  });
  // ---- the small things of a lived-in room (no colliders: keep them against walls, on furniture, under desks)
  const prop = {
    shoes: (zone, s, t, y, rot = 0, col = '3a3a3e') => at(s, t, y, rot, () => { for (const dx of [-0.07, 0.075]) { B.box(KEY(zone, 'e8e8e4'), dx, 0.012, 0, 0.105, 0.024, 0.28, dx * 1.6); B.box(KEY(zone, col), dx, 0.055, -0.02, 0.1, 0.07, 0.24, dx * 1.6); } }),
    heap: (zone, s, t, y, cols) => cols.forEach((c, i) => B.box(KEY(zone, c), s + Math.sin(i * 2.4) * 0.12, y + 0.04 + i * 0.05, -t + Math.cos(i * 1.7) * 0.1, 0.36 - i * 0.04, 0.08, 0.28 - i * 0.02, i * 0.9)),
    /** a commoner's gown on a hook: black, sleeveless, with its two streamers */
    gown: (zone, a, b, u, y) => onWall(a, b, () => { B.box(KEY(zone, C.steel), u, y + 1.8, 0.03, 0.03, 0.03, 0.06); B.box(KEY(zone, '131315'), u, y + 1.3, 0.05, 0.4, 0.98, 0.07); B.box(KEY(zone, '0c0c0e'), u, y + 1.74, 0.055, 0.2, 0.1, 0.08); for (const sx of [-1, 1]) B.box(KEY(zone, '17171a'), u + sx * 0.24, y + 1.36, 0.045, 0.07, 0.7, 0.04, 0); }),
    coat: (zone, a, b, u, y, col) => onWall(a, b, () => { B.box(KEY(zone, C.steel), u, y + 1.72, 0.03, 0.03, 0.03, 0.06); B.box(KEY(zone, col), u, y + 1.3, 0.06, 0.38, 0.82, 0.1); B.box(KEY(zone, col), u, y + 1.72, 0.06, 0.2, 0.08, 0.11); }),
    bin: (zone, s, t, y, col = C.bin) => { B.cyl(KEY(zone, col), s, y, -t, 0.13, 0.3, 9, false, 0.1); B.cyl(KEY(zone, 'e8e4d8'), s, y + 0.2, -t, 0.11, 0.02, 7, true); },
    bottle: (zone, s, t, y, col = '5a9ad8') => { B.cyl(KEY(zone, col), s, y, -t, 0.034, 0.19, 7, true); B.cyl(KEY(zone, 'f0f0f0'), s, y + 0.19, -t, 0.014, 0.035, 6, true); },
    mug: (zone, s, t, y, col = C.mug) => B.cyl(KEY(zone, col), s, y, -t, 0.04, 0.095, 7, true),
    glass: (zone, s, t, y) => B.cyl(KEY(zone, 'd8e4e8'), s, y, -t, 0.04, 0.14, 8, true, 0.032),
    plant: (zone, s, t, y) => { B.cyl(KEY(zone, 'b8683a'), s, y, -t, 0.085, 0.13, 8, false, 0.065); B.cyl(KEY(zone, '4a7a3a'), s, y + 0.13, -t, 0.15, 0.1, 7, false, 0.07); B.cyl(KEY(zone, '5c8c44'), s, y + 0.23, -t, 0.07, 0.09, 7, true, 0.15); for (const [dx, dz] of [[0.1, 0.03], [-0.07, 0.08], [-0.03, -0.1]]) B.cyl(KEY(zone, '3f6f34'), s + dx, y + 0.16, -t + dz, 0.05, 0.1, 5, true, 0.02); },
    helmet: (zone, s, t, y, col = 'd83a3a') => { B.cyl(KEY(zone, col), s, y, -t, 0.08, 0.1, 8, true, 0.125); B.cyl(KEY(zone, '1a1a1c'), s, y, -t, 0.127, 0.012, 8, false); },
    bag: (zone, s, t, y, col = '2a2c30', rot = 0.3) => { B.box(KEY(zone, col), s, y + 0.2, -t, 0.32, 0.4, 0.2, rot); B.box(KEY(zone, col), s, y + 0.42, -t, 0.2, 0.06, 0.12, rot); },
    books: (zone, s, t, y, n, rot = 0) => { const cs = ['7a2a2a', '2a4a6a', 'c8b890', '3a5a3a', '8a6a2a', 'd8d0c0']; for (let i = 0; i < n; i++) B.box(KEY(zone, cs[(i * 5 + n) % 6]), s, y + 0.016 + i * 0.032, -t, 0.2 - (i % 3) * 0.015, 0.03, 0.27, rot + i * 0.13); },
    /** a sheet of the atlas on a wall (u = its middle), w wide, from ya to yb */
    sheet: (zone, a, b, u, ya, yb, w, cell) => onWall(a, b, () => B.sign(KEY(zone, 'ffffff', cell), u - w / 2, ya, u + w / 2, yb, 0.009, U1)),
    bedside: (zone, s, t, y, rot) => at(s, t, y, rot, () => { B.box(KEY(zone, C.beech), 0, 0.25, 0.2, 0.4, 0.5, 0.4); B.box(KEY(zone, 'e6c389'), 0, 0.36, 0.402, 0.34, 0.16, 0.01); B.cyl(KEY(zone, 'f4e8c0'), 0.08, 0.5, 0.2, 0.06, 0.2, 8, true, 0.1); B.box(KEY(zone, '22242a'), -0.1, 0.506, 0.25, 0.07, 0.012, 0.13, 0.3); }),
    box: (zone, s, t, y, w, h, d, col, rot = 0) => B.box(KEY(zone, col), s, y + h / 2, -t, w, h, d, rot),
    detector: (zone, s, t, yC) => B.cyl(KEY(zone, 'f4f4f0'), s, yC - 0.04, -t, 0.055, 0.04, 8, false, 0.05),
  };
  return { wall, onWall, floor, box, skirt, decalDoor, architrave, radiator, board, light, curtains, at, chair, kChair, bed, desk, bookcase, wardrobe, prop };
}

/** No. 7's passage, at its true place in the shell: from the street door straight through to the back door. Zone 'pass'. */
export function buildPassage(B) {
  const { wall, floor, box, skirt, decalDoor, radiator, board, light, onWall } = roomKit(B);
  const { WT, S0, S1, T1 } = IN, yG = Y(IN.G), yC = Y(IN.GC), Z = 'pass';
  floor(Z, C.hallFloor, S0, S1, WT, T1, yG); floor(Z, C.ceil, S0, S1, WT, T1, yC, true);
  floor(Z, C.hallFloor, 20.82, 21.78, 0.02, WT, yG);                                                // the thresholds in the walls' thickness
  floor(Z, C.hallFloor, 20.85, 21.75, T1, DEPTH - 0.02, yG);
  // front wall, inside face, with the doorway (the fanlight above it is glazed); back wall with the back doorway
  { const u0 = S1 - 21.78, u1 = S1 - 20.82; wall(Z, C.wall, [S1, WT], [S0, WT], yG, yC, [archPts((u0 + u1) / 2, u1 - u0, yG, Y(2.13), 10)], 0.15); }
  wall(Z, C.wall, [S0, T1], [S1, T1], yG, yC, [rectPts(20.85 - S0, yG, 21.75 - S0, yG + 2.04)], 0.2);
  const eA = [S0, WT], eB = [S0, T1], wA = [S1, T1], wB = [S1, WT];
  wall(Z, C.wall, eA, eB, yG, yC); wall(Z, C.wall, wA, wB, yG, yC);
  // the houses' other doors (shut): the stair and a room on the east side, the laundry and a room on the west
  decalDoor(Z, eA, eB, 1.3, yG, 'lbl7'); decalDoor(Z, eA, eB, 6.3, yG, 'lbl1');
  decalDoor(Z, wA, wB, T1 - 7.3, yG, 'lbl5'); decalDoor(Z, wA, wB, T1 - 2.4, yG, 'lbl0');
  skirt(Z, eA, eB, yG, [[1.25, 2.25], [6.25, 7.25]]); skirt(Z, wA, wB, yG, [[T1 - 7.35, T1 - 6.35], [T1 - 2.45, T1 - 1.45]]);
  // radiator and the post shelf over it; the noticeboard opposite; door mat; ceiling lights
  radiator(Z, eA, eB, 3.9, 5.0, yG);
  box(Z, C.beech, S0, S0 + 0.2, yG + 0.95, yG + 0.99, 4.2, 5.4); box(Z, 'f4f0e4', S0 + 0.03, S0 + 0.17, yG + 0.99, yG + 1.02, 4.5, 4.85); box(Z, 'd8c8a0', S0 + 0.02, S0 + 0.16, yG + 0.99, yG + 1.0, 4.95, 5.2);
  board(Z, wA, wB, T1 - 4.95, T1 - 3.95, yG + 1.2, yG + 1.9, 'notice');
  onWall(wA, wB, () => B.sign(KEY(Z, 'ffffff', 'lbl6'), T1 - 0.75, yG + 1.5, T1 - 0.45, yG + 1.58, 0.012, U1));
  box(Z, C.dark, 20.9, 21.7, yG, yG + 0.012, 0.42, 0.95);
  for (const t of [2.0, 6.2]) light(Z, 21.3, t, yC, 0.16);
  // the houses' post in its pigeonholes over the shelf; fire notice by the street door; running-man sign over the back door
  const { prop } = roomKit(B);
  onWall(eA, eB, () => { B.box(KEY(Z, C.oak), 4.45, yG + 1.42, 0.05, 1.3, 0.56, 0.1); B.sign(KEY(Z, 'ffffff', 'envelopes'), 3.82, yG + 1.16, 5.08, yG + 1.68, 0.101, U1); });
  prop.sheet(Z, wA, wB, T1 - 1.0, yG + 1.25, yG + 1.65, 0.3, 'fire'); prop.sheet(Z, eA, eB, 7.55, yG + 1.25, yG + 1.65, 0.3, 'fire');
  onWall([S0, T1], [S1, T1], (L) => { B.box(KEY(Z, '1f8a3a'), L / 2, yG + 2.22, 0.03, 0.42, 0.16, 0.05); B.box(KEY(Z, 'f4f4ee'), L / 2 - 0.08, yG + 2.22, 0.058, 0.1, 0.09, 0.004); });
  B.cyl(KEY(Z, '3a3e42'), S1 - 0.18, yG, -0.62, 0.11, 0.5, 8, false); B.beam(KEY(Z, '1a2a5a'), [S1 - 0.2, yG + 0.05, -0.62], [S1 - 0.12, yG + 0.92, -0.58], 0.035); B.beam(KEY(Z, '2a2a2a'), [S1 - 0.15, yG + 0.05, -0.66], [S1 - 0.24, yG + 0.86, -0.7], 0.03);
  prop.detector(Z, 21.3, 4.1, yC);
  return { tris: B.tris() };
}
/**
 * Turn a Batch built with "zone|rrggbb|cell" keys into one unlit, vertex-tinted geometry per zone.
 * The tint is the key's colour times a baked shade from the face normal (floors lightest, ceilings a little under).
 * Keys whose cell is a TILE name ('~plaster', '~carpet') go to ONE more geometry per zone, named zone + '~grain'.
 * -> Map(zone | zone~grain -> BufferGeometry)
 */
export function interiorGeometries(B, RA) {
  const zones = new Map();
  const col = new THREE.Color();
  for (const [key, P] of B.parts) {
    const [zone0, hex, cell] = key.split('|');
    if (!P.pos.length) continue;
    const per = TILE[cell] || 0, zone = per ? zone0 + '~grain' : zone0;      // ('hall~grain': drawn with the repeating grain, UV in metres / TILE)
    let z = zones.get(zone); if (!z) zones.set(zone, (z = { pos: [], col: [], uv: [] }));
    col.set('#' + hex);
    const r = per ? null : RA.uv(cell || 'white'), white = !cell;
    for (let i = 0; i < P.pos.length / 3; i++) {
      z.pos.push(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]);
      const nx = P.nor[i * 3], ny = P.nor[i * 3 + 1], nz = P.nor[i * 3 + 2];
      const sh = ny > 0.5 ? 1 : ny < -0.5 ? 0.97 : 0.86 + 0.07 * Math.abs(nx) + 0.03 * nz;
      z.col.push(col.r * sh, col.g * sh, col.b * sh);
      if (per) z.uv.push(P.uv[i * 2] / per, P.uv[i * 2 + 1] / per);
      else if (white) z.uv.push((r[0] + r[2]) / 2, (r[1] + r[3]) / 2);
      else z.uv.push(r[0] + (r[2] - r[0]) * Math.min(1, Math.max(0, P.uv[i * 2])), r[1] + (r[3] - r[1]) * Math.min(1, Math.max(0, P.uv[i * 2 + 1])));
    }
  }
  B.parts.clear();
  const out = new Map();
  for (const [zone, z] of zones) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(z.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(z.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(z.uv, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    out.set(zone, g);
  }
  return out;
}
