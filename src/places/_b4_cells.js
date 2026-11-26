// Extra cells of the shared batch-4 atlas (_b4_kit.js), added for the batch-4 visual pass and the two district passes
// (places/cowley_road.js + _eo_*.js, places/jericho.js + _jer_*.js), so all of them stay in ONE draw.
// Everything is painted procedurally (no logo or real artwork); businesses carry their real names as plain lettering,
// or invented ones under ?invented=1 (core/features.js).
//
//   shop     a shopfront unit: stall riser, plate glass with a mullion and transom, a half-glazed door (glass in aux)
//   signs2   eight lettering boards for East Oxford      signs3   eight for Jericho and the canal
//   mural    two invented murals (top / bottom half)      shutter  two painted roller shutters (top / bottom half)
//   arch     a round-headed leaded window (for archUnit) louvre   a round-headed belfry opening with louvres
//   port     a narrowboat cabin side: cream panel, coachlines, three portholes (glass)
//   awning   canvas stripes (tint picks the colour)       crates   record racks / shelves of spines (interior)
//   menu     a lit takeaway menu board                    rubble   rock-faced coursed limestone
import { tn } from '../core/features.js';
const GLASS_A = 'rgb(255,0,0)', STONE_A = 'rgb(0,255,0)', OFF_A = 'rgb(0,0,0)';
export const EXTRA_CELLS = ['shop', 'signs2', 'signs3', 'mural', 'shutter', 'arch', 'louvre', 'port', 'awning', 'crates', 'menu', 'rubble'];
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;

/** lettering rows of signs2 / signs3 (8 boards of 8:1 each, top row first) */
export const SIGN2_ROWS = ['cinema', 'cinemaNow', 'venue', 'venueGig', 'arts', 'records', 'takeaway', 'cycles'];
/** rows painted as backlit glass (lit after dark) */
export const LIT_ROWS = ['cinema', 'cinemaNow', 'venue', 'venueGig', 'takeaway', 'jcinema', 'jcinemaNow'];
export const SIGN3_ROWS = ['jcinema', 'jcinemaNow', 'press', 'boatA', 'boatB', 'boatC', 'boatD', 'towpath'];
const BOARDS2 = [
  ['#7a1420', '#f6e7b8', tn('ULTIMATE PICTURE PALACE', 'THE EMPRESS'), 'Georgia, serif'],
  ['#111111', '#f4f1e6', 'NOW SHOWING  ·  6.15  ·  8.40', 'Arial, sans-serif'],
  ['#121014', '#e84fa0', tn('O2 ACADEMY OXFORD', 'THE EAST BALLROOM'), 'Arial Black, Arial, sans-serif'],
  ['#121014', '#f2d24a', 'TONIGHT  ·  THE LOW TIDES  +  GUESTS', 'Arial, sans-serif'],
  ['#f2ead2', '#2a4a7a', 'EAST OXFORD COMMUNITY ARTS', 'Arial, sans-serif'],
  ['#1d2a24', '#f0c040', tn('TRUCK STORE', 'SLOW SPIN RECORDS'), 'Georgia, serif'],
  ['#c8201c', '#fff4d8', tn('KEBABS  ·  PIZZA  ·  CHIPS', 'NIGHT OWL  ·  KEBABS  ·  PIZZA  ·  CHIPS'), 'Arial, sans-serif'],
  ['#1f4a2c', '#f4f0e2', tn('CYCLES  ·  REPAIRS', 'COWLEY CYCLE WORKS'), 'Arial, sans-serif'],
];
const BOARDS3 = [
  ['#0f2436', '#f2e6c2', tn('PHOENIX PICTUREHOUSE', 'THE WALTON CINEMA'), 'Georgia, serif'],
  ['#101010', '#f4f1e6', 'TODAY  ·  2.15  ·  6.00  ·  8.45', 'Arial, sans-serif'],
  ['#d9ceb2', '#4a3a22', 'UNIVERSITY PRESS', 'Georgia, "Times New Roman", serif'],
  ['#1e4a2e', '#f1d27a', 'KINGFISHER', 'Georgia, serif'],
  ['#7a1a1a', '#f6e8c0', 'MORNING STAR', 'Georgia, serif'],
  ['#1b2f5a', '#f2e6c8', 'JERICHO LASS', 'Georgia, serif'],
  ['#2a2a2a', '#e8c25a', 'THE OTTER', 'Georgia, serif'],
  ['#f3efe4', '#1c3a5e', 'OXFORD CANAL  ·  TOWPATH  ·  PLEASE GIVE WAY TO WALKERS', 'Arial, sans-serif'],
];
function boards(g, a, S, list, rows) {
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, S, S); a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const h = S / 8;
  list.forEach(([bg, fg, t, font], i) => {
    const y = i * h;
    if (rows && LIT_ROWS.includes(rows[i])) { a.fillStyle = GLASS_A; a.fillRect(0, y, S, h); }
    g.fillStyle = bg; g.fillRect(0, y, S, h);
    g.strokeStyle = fg; g.globalAlpha = 0.8; g.lineWidth = 2.5; g.strokeRect(5, y + 5, S - 10, h - 10); g.globalAlpha = 1;
    let size = 34; g.font = `bold ${size}px ${font}`; const m = g.measureText(t).width; if (m > S - 40) size = Math.floor(size * (S - 40) / m);
    g.font = `bold ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(t, S / 2 + 1.5, y + h / 2 + 3.5);
    g.fillStyle = fg; g.fillText(t, S / 2, y + h / 2 + 2);
  });
}
function paintShop(g, a, S) {
  // frame painted light grey so the tint gives the shop its colour; glass dark with a hint of goods behind
  g.fillStyle = '#d8d6d0'; g.fillRect(0, 0, S, S); a.fillStyle = 'rgb(0,255,255)'; a.fillRect(0, 0, S, S);
  const r = rnd(91), F = S * 0.035, riser = S * 0.2, tr = S * 0.16, door = S * 0.27;
  // stall riser panels
  g.fillStyle = '#b8b4aa'; g.fillRect(F, S - riser, S - door - 2 * F, riser - F);
  g.strokeStyle = 'rgba(40,30,20,0.35)'; g.lineWidth = 3; g.strokeRect(F * 2, S - riser + F, (S - door - 4 * F) / 2 - F, riser - 3 * F); g.strokeRect(F * 2 + (S - door - 4 * F) / 2 + F, S - riser + F, (S - door - 4 * F) / 2 - F, riser - 3 * F);
  const glass = (x0, y0, x1, y1, goods) => {
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#5f7080'); gr.addColorStop(0.5, '#33404c'); gr.addColorStop(1, '#222a32');
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (goods) for (let k = 0; k < 3; k++) { const yy = y1 - (k + 1) * (y1 - y0) / 3.6; g.fillStyle = 'rgba(30,24,18,0.7)'; g.fillRect(x0, yy, x1 - x0, 3); for (let x = x0 + 4; x < x1 - 8; x += 6 + r() * 14) { g.fillStyle = `hsla(${r() * 360},55%,${40 + r() * 25}%,0.75)`; const w = 4 + r() * 10, hh = 6 + r() * 18; g.fillRect(x, yy - hh, w, hh); } }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * 0.35, y0); g.lineTo(x0, y0 + (y1 - y0) * 0.6); g.fill();
    a.fillStyle = GLASS_A; a.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  const wx1 = S - door - F, mid = (F + wx1) / 2;
  glass(F, tr + F, mid - F * 0.4, S - riser, true); glass(mid + F * 0.4, tr + F, wx1, S - riser, true);
  // transom lights
  for (let k = 0; k < 3; k++) glass(F + k * (wx1 - F) / 3 + F * 0.3, F, F + (k + 1) * (wx1 - F) / 3 - F * 0.3, tr, false);
  // the door: glazed upper, panelled lower
  g.fillStyle = '#9a968c'; g.fillRect(S - door, F, door - F, S - F);
  glass(S - door + F, F, S - 2 * F, tr, false);
  glass(S - door + F, tr + F, S - 2 * F, S * 0.6, false);
  g.strokeStyle = 'rgba(40,30,20,0.4)'; g.strokeRect(S - door + F * 1.4, S * 0.64, door - F * 3.6, S * 0.3);
  g.fillStyle = '#c9a54a'; g.fillRect(S - door + F * 1.3, S * 0.6, F * 0.8, F * 1.6);
  g.fillStyle = '#6a665e'; g.fillRect(0, S - F, S, F);
}
function paintMural(g, a, S) {
  a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const r = rnd(2013), H = S / 2;
  // 1 (top): sunrise over terraced roofs, bicycles and a crowd of round heads, bright and flat
  g.save(); g.beginPath(); g.rect(0, 0, S, H); g.clip();
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#2a3f8c'); sky.addColorStop(0.55, '#e0607a'); sky.addColorStop(1, '#f6b44a');
  g.fillStyle = sky; g.fillRect(0, 0, S, H);
  g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(S * 0.62, H * 0.62, H * 0.3, 0, Math.PI * 2); g.fill();
  for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(255,230,120,0.6)'; g.lineWidth = 5; const t = Math.PI + (k / 13) * Math.PI; g.beginPath(); g.moveTo(S * 0.62 + Math.cos(t) * H * 0.36, H * 0.62 + Math.sin(t) * H * 0.36); g.lineTo(S * 0.62 + Math.cos(t) * H * 0.6, H * 0.62 + Math.sin(t) * H * 0.6); g.stroke(); }
  const hues = ['#1f7a5a', '#7a2a6a', '#2a5aa8', '#c2412a', '#e08a1a', '#3a8a2a'];
  for (let x = -10, k = 0; x < S; k++) { const w = 40 + r() * 34, hh = H * (0.28 + r() * 0.12); g.fillStyle = hues[k % hues.length]; g.fillRect(x, H - hh, w, hh); g.beginPath(); g.moveTo(x - 4, H - hh); g.lineTo(x + w / 2, H - hh - 22); g.lineTo(x + w + 4, H - hh); g.fill(); g.fillStyle = '#ffe9a8'; for (let j = 0; j < 2; j++) g.fillRect(x + 8 + j * (w / 2 - 4), H - hh + 12, 10, 14); x += w; }
  for (let k = 0; k < 3; k++) { const cx = 70 + k * 160, cy = H - 34; g.strokeStyle = '#111'; g.lineWidth = 5; for (const dx of [-26, 26]) { g.beginPath(); g.arc(cx + dx, cy, 18, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.moveTo(cx - 26, cy); g.lineTo(cx - 4, cy - 26); g.lineTo(cx + 26, cy); g.moveTo(cx - 4, cy - 26); g.lineTo(cx + 14, cy - 26); g.stroke(); }
  g.restore();
  // 2 (bottom): a river of fish and leaves in bold pattern
  g.save(); g.translate(0, H); g.beginPath(); g.rect(0, 0, S, H); g.clip();
  g.fillStyle = '#16707a'; g.fillRect(0, 0, S, H);
  for (let k = 0; k < 6; k++) { g.strokeStyle = k % 2 ? '#2fb0b0' : '#0e4a5a'; g.lineWidth = 14; g.beginPath(); for (let x = 0; x <= S; x += 16) { const y = 20 + k * 40 + Math.sin(x / 40 + k) * 10; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
  const fc = ['#f2a01a', '#f4e04a', '#e8503a', '#f6f0e0'];
  for (let k = 0; k < 11; k++) { const x = 30 + r() * (S - 60), y = 30 + r() * (H - 60), s = 18 + r() * 20; g.fillStyle = fc[k % 4]; g.beginPath(); g.ellipse(x, y, s * 1.4, s * 0.7, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(x - s * 1.2, y); g.lineTo(x - s * 2.2, y - s * 0.8); g.lineTo(x - s * 2.2, y + s * 0.8); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(x + s * 0.8, y - s * 0.15, 3.5, 0, Math.PI * 2); g.fill(); }
  for (let k = 0; k < 9; k++) { const x = r() * S, y = r() * H; g.fillStyle = '#5ac25a'; g.beginPath(); g.ellipse(x, y, 22, 8, r() * 3, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
function paintShutter(g, a, S) {
  a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const r = rnd(77), H = S / 2;
  for (let half = 0; half < 2; half++) {
    const y0 = half * H;
    g.fillStyle = '#8c8e90'; g.fillRect(0, y0, S, H);
    // painted: bold abstract shapes (no letters, no tags of anyone's)
    const pal = half ? ['#e8463a', '#f6c22a', '#2a8ad0', '#1a1a1a', '#f2f0e8'] : ['#6a3aa8', '#2ac28a', '#f28a2a', '#f2f0e8', '#1a1a1a'];
    for (let k = 0; k < 9; k++) { g.fillStyle = pal[k % pal.length]; g.globalAlpha = 0.9; g.beginPath(); const cx = r() * S, cy = y0 + r() * H, rr = 30 + r() * 70; if (k % 3 === 0) g.arc(cx, cy, rr, 0, Math.PI * 2); else if (k % 3 === 1) { g.moveTo(cx - rr, cy + rr * 0.6); g.lineTo(cx, cy - rr); g.lineTo(cx + rr, cy + rr * 0.6); } else g.ellipse(cx, cy, rr * 1.6, rr * 0.5, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); for (let x = 0; x <= S; x += 8) { const y = y0 + H * 0.5 + Math.sin(x / 30 + half * 2) * H * 0.22; if (!x) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    // the slats over everything
    for (let y = y0; y < y0 + H; y += 9) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, S, 1.6); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, y + 2, S, 1.2); }
    g.fillStyle = '#4a4c4e'; g.fillRect(0, y0 + H - 10, S, 10);
  }
}
function archGlass(g, a, S, leaded) {
  g.fillStyle = '#b39a74'; g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const F = S * 0.06, R = S / 2 - F, cy = S * 0.25 + F * 0.2;
  const path = (c) => { c.beginPath(); c.moveTo(F, S - F); c.lineTo(F, cy); c.arc(S / 2, cy, R, Math.PI, 0); c.lineTo(S - F, S - F); c.closePath(); };
  path(g);
  if (leaded) { const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#6e8090'); gr.addColorStop(1, '#2c3640'); g.fillStyle = gr; g.fill(); }
  else { g.fillStyle = '#121416'; g.fill(); }
  g.save(); path(g); g.clip();
  if (leaded) { g.strokeStyle = 'rgba(20,20,20,0.75)'; g.lineWidth = 2; for (let x = F; x < S; x += S / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); } for (let y = 0; y < S; y += S / 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); } g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(F, 0, S * 0.3, S); }
  else for (let y = cy - R * 0.4; y < S - F; y += S / 11) { g.fillStyle = '#5a5248'; g.fillRect(0, y, S, S / 22); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, y, S, 2); }
  g.restore();
  if (leaded) { path(a); a.fillStyle = GLASS_A; a.fill(); }
  g.strokeStyle = '#e8dcc0'; g.lineWidth = F * 0.8; path(g); g.stroke();
}
function paintPort(g, a, S) {
  g.fillStyle = '#f0ece2'; g.fillRect(0, 0, S, S); a.fillStyle = 'rgb(0,255,255)'; a.fillRect(0, 0, S, S);
  g.strokeStyle = '#c9a54a'; g.lineWidth = 6; g.strokeRect(14, 14, S - 28, S - 28);
  g.strokeStyle = '#a02a2a'; g.lineWidth = 3; g.strokeRect(26, 26, S - 52, S - 52);
  for (let k = 0; k < 3; k++) {
    const cx = S * (0.2 + k * 0.3), cy = S * 0.42, R = S * 0.1;
    g.fillStyle = '#b8902e'; g.beginPath(); g.arc(cx, cy, R + 9, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 2, cx, cy, R); gr.addColorStop(0, '#8aa0b0'); gr.addColorStop(1, '#2a3440');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    a.fillStyle = GLASS_A; a.beginPath(); a.arc(cx, cy, R, 0, Math.PI * 2); a.fill();
  }
  // roses and castles were the canal tradition; here a plain painted diamond band (generic)
  for (let x = 40; x < S - 40; x += 40) { g.fillStyle = x % 80 ? '#2a6a3a' : '#c23a2a'; g.beginPath(); g.moveTo(x, S * 0.78); g.lineTo(x + 20, S * 0.72); g.lineTo(x + 40, S * 0.78); g.lineTo(x + 20, S * 0.84); g.fill(); }
}
function paintAwning(g, S) {
  for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f4f0e6' : '#c8c2b4'; g.fillRect(k * S / 8, 0, S / 8, S); }
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < S; y += 4) g.fillRect(0, y, S, 1);
}
function paintCrates(g, S) {
  const r = rnd(45);
  g.fillStyle = '#3a2a1e'; g.fillRect(0, 0, S, S);
  for (let row = 0; row < 4; row++) {
    const y0 = row * S / 4 + 6, y1 = (row + 1) * S / 4 - 10;
    for (let x = 4; x < S - 4;) { const w = 3 + r() * 5; g.fillStyle = `hsl(${r() * 360},${30 + r() * 50}%,${18 + r() * 50}%)`; g.fillRect(x, y0 + r() * 8, w, y1 - y0); x += w + 0.6; }
    g.fillStyle = '#6a4a30'; g.fillRect(0, y1, S, 10);
  }
}
function paintMenu(g, a, S) {
  g.fillStyle = '#f6efd8'; g.fillRect(0, 0, S, S); a.fillStyle = GLASS_A; a.fillRect(0, 0, S, S);
  g.fillStyle = '#c8201c'; g.fillRect(0, 0, S, S * 0.16);
  g.fillStyle = '#fff4d8'; g.font = 'bold 40px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MENU', S / 2, S * 0.08);
  const items = [['Doner kebab', '4.50'], ['Chicken shish', '5.50'], ['Falafel wrap', '4.00'], ['Chips', '2.00'], ['Cheesy chips', '2.80'], ['Margherita 12"', '6.50'], ['Garlic bread', '2.50'], ['Cans', '1.00']];
  g.font = 'bold 26px Arial, sans-serif';
  items.forEach(([n, p], i) => { const y = S * 0.22 + i * S * 0.095; g.textAlign = 'left'; g.fillStyle = '#2a1a10'; g.fillText(n, 24, y); g.textAlign = 'right'; g.fillStyle = '#c8201c'; g.fillText('£' + p, S - 24, y); });
}
function paintRubble(g, S) {
  const r = rnd(5);
  g.fillStyle = '#8a8270'; g.fillRect(0, 0, S, S);
  let y = 0;
  while (y < S) {
    const ch = 26 + r() * 18;
    for (let x = -r() * 60; x < S;) { const w = 40 + r() * 70, k = r(); g.fillStyle = rgb(176 + k * 40, 164 + k * 36, 130 + k * 30); g.fillRect(x + 2, y + 2, w - 4, ch - 4);
      for (let i = 0; i < 6; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,250,230,0.18)' : 'rgba(40,30,20,0.18)'; g.fillRect(x + 4 + r() * (w - 14), y + 4 + r() * (ch - 12), 6 + r() * 12, 3 + r() * 6); }
      x += w; }
    y += ch;
  }
}

/** paint every extra cell; unit(name, (g, a, S) => …) and tile(name, (g, S) => …) come from the kit's atlas painter */
export function paintExtra(unit, tile) {
  unit('shop', paintShop);
  unit('signs2', (g, a, S) => boards(g, a, S, BOARDS2, SIGN2_ROWS));
  unit('signs3', (g, a, S) => boards(g, a, S, BOARDS3, SIGN3_ROWS));
  unit('mural', paintMural);
  unit('shutter', paintShutter);
  unit('arch', (g, a, S) => archGlass(g, a, S, true));
  unit('louvre', (g, a, S) => archGlass(g, a, S, false));
  unit('port', paintPort);
  tile('awning', paintAwning);
  tile('crates', paintCrates);
  unit('menu', paintMenu);
  tile('rubble', paintRubble);
}
