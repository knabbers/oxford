// Batch-6 cells of the shared batch-5 atlas (_b5_kit.js rows 5 and 6; rows 0-4 are untouched) — see
// docs/research/landmarks_batch6.md. Painted here, called from _b5_kit.js paintAtlas / b5Pack:
//   sash       a Georgian six-over-six sash in a stone architrave with a keystone (Queen's, Warden's Lodgings, the pubs)
//   roundSash  a round-headed sash (the glazing fans out in the head; the arch outline itself is geometry)
//   rustic     banded rustication (deep horizontal channels, honey ashlar) for classical ground storeys
//   balus      a stone balustrade, 1 m a repeat (rail, vase balusters with the dark gaps painted, plinth)
//   relief     a carved stone panel of robed figures (the Examination Schools' porch, abstracted)
//   pubFront   a painted timber pub front: two small-paned windows, a panelled door, the fascia left plain
//   signs6     twelve rows of plain lettering (institution names as on their boards, invented notices)
//   pubSigns   the two pubs' hanging-sign pictures (left half, right half): simple painted devices for their names
// Pure canvas painting; no Math.random (seeded generator).

import { tn, inventedNames } from '../core/features.js';
export const B6_CELLS = ['sash', 'roundSash', 'rustic', 'balus', 'relief', 'pubFront', 'signs6', 'pubSigns'];
export const B6_SIGN_ROWS = ['queens', 'univ', 'allsouls', 'schools', 'stjohns', 'taylor', 'pubA', 'pubB', 'carolina', 'exam', 'memorial', 'porter'];
// the two pubs on St Giles': the Eagle and Child (west) and the Lamb and Flag (east) — or, under ?invented=1
// (core/features.js), two invented names
export const PUB_A = tn('The Eagle and Child', 'The Heron & Cradle'), PUB_B = tn('The Lamb and Flag', 'The Ram & Pennant');
const REAL = !inventedNames();

const GLASS_A = 'rgb(255,0,0)', STONE_A = 'rgb(0,255,0)', OFF_A = 'rgb(0,0,0)';
const TAU = Math.PI * 2;
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;
function grain(g, S, amp, r) { try { const img = g.getImageData(0, 0, S, S), d = img.data; if (!d || !d.length) return; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amp; d[i] += n; d[i + 1] += n * 0.9; d[i + 2] += n * 0.8; } g.putImageData(img, 0, 0); } catch { /* stub canvas */ } }
const ST = (k = 1) => rgb(206 * k, 184 * k, 138 * k);

function glass(g, a, x, y, w, h) {
  const gr = g.createLinearGradient(x, y, x + w * 0.3, y + h);
  gr.addColorStop(0, '#6d7f8e'); gr.addColorStop(0.45, '#3e4c58'); gr.addColorStop(1, '#27313a');
  g.fillStyle = gr; g.fillRect(x, y, w, h); a.fillStyle = GLASS_A; a.fillRect(x, y, w, h);
}
function bars(g, a, rects, col = '#ece8de') { for (const [x, y, w, h] of rects) { g.fillStyle = col; g.fillRect(x, y, w, h); a.fillStyle = OFF_A; a.fillRect(x, y, w, h); } }

/** six-over-six sash in an architrave: border = stone, keystone at the head */
function paintSash(g, a, S) {
  g.fillStyle = ST(); g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const m = S * 0.1, x0 = m, y0 = m * 1.1, w = S - 2 * m, h = S - m * 2.2;
  // architrave mouldings
  g.strokeStyle = 'rgba(70,52,26,0.55)'; g.lineWidth = S * 0.012; g.strokeRect(m * 0.45, m * 0.55, S - m * 0.9, S - m * 1.1);
  g.strokeStyle = 'rgba(255,245,220,0.35)'; g.lineWidth = S * 0.008; g.strokeRect(m * 0.62, m * 0.72, S - m * 1.24, S - m * 1.44);
  // keystone
  g.fillStyle = ST(1.06); g.beginPath(); g.moveTo(S / 2 - m * 0.6, 0); g.lineTo(S / 2 + m * 0.6, 0); g.lineTo(S / 2 + m * 0.42, y0 + 2); g.lineTo(S / 2 - m * 0.42, y0 + 2); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(60,44,20,0.5)'; g.lineWidth = 2; g.stroke();
  glass(g, a, x0, y0, w, h);
  const f = S * 0.035, b = S * 0.016;
  bars(g, a, [[x0, y0, w, f], [x0, y0 + h - f, w, f], [x0, y0, f, h], [x0 + w - f, y0, f, h], [x0, y0 + h / 2 - f * 0.6, w, f * 1.2]]);
  for (const k of [1, 2]) bars(g, a, [[x0 + (w * k) / 3 - b / 2, y0, b, h]]);
  for (const k of [1, 2, 4, 5]) bars(g, a, [[x0, y0 + (h * k) / 6 - b / 2, w, b]]);
  // sill shadow
  g.fillStyle = 'rgba(30,20,8,0.4)'; g.fillRect(x0, y0 + h, w, S * 0.02);
}
/** round-headed sash: the cell is the bounding box of the arch; glazing bars fan out in the head (top 1/3) */
function paintRoundSash(g, a, S) {
  glass(g, a, 0, 0, S, S);
  const f = S * 0.05, b = S * 0.016, ys = S * 0.38, cx = S / 2;
  bars(g, a, [[0, S - f, S, f], [0, 0, f, S], [S - f, 0, f, S], [0, ys - f / 2, S, f], [0, ys + (S - ys) * 0.5 - f * 0.5, S, f * 1.0]]);
  for (const k of [1, 2]) bars(g, a, [[(S * k) / 3 - b / 2, ys, b, S - ys]]);
  for (const k of [0.25, 0.75]) bars(g, a, [[0, ys + (S - ys) * k - b / 2, S, b]]);
  // the fan
  for (const t of [0.2, 0.4, 0.6, 0.8]) { const A = Math.PI * (1 + t); for (const [c, col] of [[g, '#ece8de'], [a, OFF_A]]) { c.strokeStyle = col; c.lineWidth = b * 1.2; c.beginPath(); c.moveTo(cx, ys); c.lineTo(cx + Math.cos(A) * S, ys + Math.sin(A) * S); c.stroke(); } }
  for (const [c, col] of [[g, '#ece8de'], [a, OFF_A]]) { c.strokeStyle = col; c.lineWidth = b * 1.4; c.beginPath(); c.arc(cx, ys, S * 0.16, Math.PI, TAU); c.stroke(); c.beginPath(); c.arc(cx, ys, S * 0.47, Math.PI, TAU); c.stroke(); }
}
/** banded rustication: 3.2 m a repeat, 8 courses, deep horizontal channels, faint vertical joints */
function paintRustic(g, S) {
  const r = rnd(71), n = 8, ch = S / n;
  for (let c = 0; c < n; c++) {
    const y = c * ch, off = (c % 2) * S / 4;
    for (let x = -S / 2 + off; x < S; x += S / 2) { const t = (r() - 0.5) * 18; g.fillStyle = rgb(206 + t, 184 + t, 138 + t * 0.8); g.fillRect(x, y, S / 2, ch); g.fillStyle = 'rgba(60,44,20,0.18)'; g.fillRect(x, y, 2, ch); }
    const gr = g.createLinearGradient(0, y, 0, y + ch * 0.16);
    gr.addColorStop(0, 'rgba(30,20,8,0.75)'); gr.addColorStop(1, 'rgba(30,20,8,0)');
    g.fillStyle = gr; g.fillRect(0, y, S, ch * 0.16);
    g.fillStyle = 'rgba(255,240,210,0.28)'; g.fillRect(0, y + ch - ch * 0.07, S, ch * 0.07);
  }
  grain(g, S, 12, r);
}
/** balustrade: 1 m wide x 1 m high a repeat: coping rail (top 16 %), three vase balusters, plinth (bottom 14 %) */
function paintBalus(g, S) {
  g.fillStyle = '#2a241c'; g.fillRect(0, 0, S, S);
  g.fillStyle = ST(1.02); g.fillRect(0, 0, S, S * 0.16); g.fillRect(0, S * 0.86, S, S * 0.14);
  g.fillStyle = 'rgba(40,28,10,0.5)'; g.fillRect(0, S * 0.16, S, S * 0.025);
  g.fillStyle = 'rgba(255,240,210,0.35)'; g.fillRect(0, S * 0.84, S, S * 0.02);
  for (let k = 0; k < 3; k++) {
    const cx = (k + 0.5) * S / 3, top = S * 0.18, bot = S * 0.85, hh = bot - top;
    g.fillStyle = ST(0.98); g.beginPath();
    const prof = [[0.16, 0], [0.12, 0.08], [0.09, 0.18], [0.16, 0.42], [0.24, 0.62], [0.2, 0.8], [0.12, 0.9], [0.2, 1]];
    g.moveTo(cx - prof[0][0] * S / 3, top);
    for (const [w, t] of prof) g.lineTo(cx - w * S / 3, top + t * hh);
    for (const [w, t] of prof.slice().reverse()) g.lineTo(cx + w * S / 3, top + t * hh);
    g.closePath(); g.fill();
    const gr = g.createLinearGradient(cx - S / 8, 0, cx + S / 8, 0); gr.addColorStop(0, 'rgba(255,240,210,0.25)'); gr.addColorStop(1, 'rgba(40,28,10,0.45)');
    g.fillStyle = gr; g.fill();
  }
}
/** relief: robed figures in a frame (abstract: no faces, no likeness) */
function paintRelief(g, a, S) {
  g.fillStyle = ST(0.98); g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const m = S * 0.06;
  g.fillStyle = ST(0.82); g.fillRect(m, m, S - 2 * m, S - 2 * m);
  g.strokeStyle = 'rgba(60,44,20,0.6)'; g.lineWidth = S * 0.015; g.strokeRect(m, m, S - 2 * m, S - 2 * m);
  const fig = (x, w, h, seat) => {
    const y1 = S - m * 1.4, y0 = y1 - h;
    const gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, ST(1.12)); gr.addColorStop(1, ST(0.7));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w * (seat ? 0.9 : 0.6), y1); g.quadraticCurveTo(x - w * 0.7, y0 + h * 0.35, x - w * 0.35, y0 + h * 0.22); g.lineTo(x + w * 0.35, y0 + h * 0.22); g.quadraticCurveTo(x + w * 0.7, y0 + h * 0.35, x + w * (seat ? 0.9 : 0.6), y1); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(x, y0 + h * 0.12, w * 0.24, h * 0.11, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,44,20,0.35)'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x - w * 0.3 + k * w * 0.15, y0 + h * 0.3); g.lineTo(x - w * 0.5 + k * w * 0.25, y1 - 4); g.stroke(); }
  };
  fig(S * 0.2, S * 0.12, S * 0.62, false); fig(S * 0.42, S * 0.13, S * 0.5, true); fig(S * 0.62, S * 0.12, S * 0.64, false); fig(S * 0.82, S * 0.11, S * 0.58, false);
  g.fillStyle = ST(0.9); g.fillRect(S * 0.32, S * 0.66, S * 0.22, S * 0.06);   // a table
}
/** pub front: fascia band (top 18 %, plain), two small-paned windows either side of a panelled door */
function paintPubFront(g, a, S) {
  const paint = '#23382c';
  g.fillStyle = paint; g.fillRect(0, 0, S, S); a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  g.fillStyle = '#c8b27a'; g.fillRect(0, S * 0.18, S, S * 0.02); g.fillRect(0, 0, S, S * 0.015);
  const win = (x0, w) => {
    const y0 = S * 0.27, h = S * 0.48;
    glass(g, a, x0, y0, w, h);
    const b = S * 0.012;
    for (let k = 1; k < 4; k++) bars(g, a, [[x0 + (w * k) / 4 - b / 2, y0, b, h]], '#e4dcc4');
    for (let k = 1; k < 4; k++) bars(g, a, [[x0, y0 + (h * k) / 4 - b / 2, w, b]], '#e4dcc4');
    g.fillStyle = 'rgba(255,200,120,0.18)'; g.fillRect(x0, y0 + h * 0.55, w, h * 0.45);   // the warm room behind
    g.fillStyle = '#1a2a20'; g.fillRect(x0 - 4, y0 + h, w + 8, S * 0.04);
  };
  win(S * 0.05, S * 0.32); win(S * 0.63, S * 0.32);
  // the door: panelled, a fanlight
  const dx = S * 0.4, dw = S * 0.2, dy = S * 0.24;
  glass(g, a, dx, dy, dw, S * 0.08);
  g.fillStyle = '#152219'; g.fillRect(dx, dy + S * 0.09, dw, S - dy - S * 0.09);
  g.strokeStyle = 'rgba(200,180,120,0.5)'; g.lineWidth = 2; g.strokeRect(dx + dw * 0.14, dy + S * 0.14, dw * 0.72, S * 0.24); g.strokeRect(dx + dw * 0.14, dy + S * 0.44, dw * 0.72, S * 0.24);
  g.fillStyle = '#c8a24a'; g.beginPath(); g.arc(dx + dw * 0.8, dy + S * 0.45, S * 0.01, 0, TAU); g.fill();
  g.fillStyle = '#2b2a26'; g.fillRect(0, S * 0.95, S, S * 0.05);
}
function paintSigns6(g, a, S) {
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, S, S); a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const n = B6_SIGN_ROWS.length, rowH = S / n;
  const fit = (t, w, size, font) => { g.font = `bold ${size}px ${font}`; const mw = g.measureText(t).width; return mw > w ? Math.floor(size * w / mw) : size; };
  const board = (row, bg, fg, lines, font = 'Georgia, "Times New Roman", serif', gold = false, frame = true) => {
    const y = row * rowH; g.fillStyle = bg; g.fillRect(0, y, S, rowH); if (frame) { g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(3, y + 3, S - 6, rowH - 6); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((t, k) => { const sz = fit(t, S - 24, lines.length > 1 ? 15 : 28, font); g.font = `bold ${sz}px ${font}`; g.fillText(t, S / 2, y + rowH * (k + 0.5) / lines.length + 1); });
    if (gold) { g.fillStyle = 'rgba(255,220,140,0.12)'; g.fillRect(0, y, S, rowH * 0.4); }
  };
  board(0, '#14161c', '#e2d8bc', ['THE QUEEN\'S COLLEGE']);
  board(1, '#14161c', '#e2d8bc', ['UNIVERSITY COLLEGE']);
  board(2, '#14161c', '#e2d8bc', ['ALL SOULS COLLEGE']);
  board(3, '#cfc4a6', '#3c2e18', ['EXAMINATION SCHOOLS']);
  board(4, '#14161c', '#e2d8bc', ['ST JOHN\'S COLLEGE']);
  board(5, '#cfc4a6', '#3c2e18', ['TAYLOR INSTITUTION']);
  // the Eagle and Child's name is painted straight on to its cream wall in black letter (photo comparison item 18):
  // the row is the wall's render colour, no frame
  board(6, '#e4dccb', '#16140f', [PUB_A], '"Old English Text MT", "UnifrakturMaguntia", "Blackletter", Georgia, serif', false, false);
  board(7, '#5a1f22', '#e6c877', [PUB_B.toUpperCase()], 'Georgia, serif', true);
  board(8, '#cfc4a6', '#3c2e18', ['CAROLINA REGINA', '12 NOVEMBER 1733'], 'Georgia, serif');
  board(9, '#f1ede2', '#1b2a4a', ['EXAMINATION IN PROGRESS', 'Silence, please. Candidates only.'], 'Arial, sans-serif');
  board(10, '#cfc4a6', '#3c2e18', ['TO THE MEN OF OXFORD', 'WHO GAVE THEIR LIVES 1914-1918'], 'Georgia, serif');
  board(11, '#f1ede2', '#7a1c2c', ['COLLEGE CLOSED TO VISITORS', 'Please ask at the Lodge'], 'Arial, sans-serif');
}
/** two hanging-sign pictures (each 256 x 384 in a 512 cell: x halves, the top three quarters): an eagle by a swaddled
 *  child / a lamb's head under a pennant (real names), a heron by a cradle / a ram under a pennant (invented); plain
 *  generic painting, no copy of either pub's actual sign */
function paintPubSigns(g, a, S) {
  g.fillStyle = '#3a2c1c'; g.fillRect(0, 0, S, S); a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const W = S / 2, H = S * 0.75;
  const frame = (x0, bg) => {
    g.fillStyle = '#1b130b'; g.fillRect(x0, 0, W, H);
    g.fillStyle = '#c9a54a'; g.fillRect(x0 + 6, 6, W - 12, H - 12);
    g.fillStyle = bg; g.fillRect(x0 + 12, 12, W - 24, H - 24);
  };
  const label = (x0, t, fg) => { g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; const words = t.replace(/^The /, '').split(/ & | and /); g.font = 'bold 26px Georgia, serif'; g.fillText('THE', x0 + W / 2, 34); words.forEach((w, k) => { g.font = 'bold 24px Georgia, serif'; g.fillText((k ? (/ and /.test(t) ? 'AND ' : '& ') : '') + w.toUpperCase(), x0 + W / 2, H - 70 + k * 30); }); };
  // A: a grey heron standing beside a wicker cradle, on a pale blue ground with reeds
  frame(0, '#9bb6c4');
  g.fillStyle = '#5d7a4a'; for (let i = 0; i < 9; i++) { g.fillRect(24 + i * 22, 190 + (i % 3) * 8, 4, 90); }
  const bird = REAL ? '#5a3c24' : '#6f7d86';
  g.fillStyle = bird; g.beginPath(); g.ellipse(110, 160, 34, 22, -0.4, 0, TAU); g.fill();                 // body
  if (REAL) { g.beginPath(); g.moveTo(96, 150); g.lineTo(40, 96); g.lineTo(70, 160); g.closePath(); g.fill(); g.beginPath(); g.moveTo(120, 146); g.lineTo(176, 70); g.lineTo(140, 160); g.closePath(); g.fill(); }   // spread wings
  g.strokeStyle = bird; g.lineWidth = 9; g.beginPath(); g.moveTo(132, 146); g.quadraticCurveTo(160, 120, 140, 96); g.stroke(); // neck
  g.fillStyle = '#e8e4da'; g.beginPath(); g.ellipse(144, 92, 12, 9, 0, 0, TAU); g.fill();
  g.fillStyle = '#d4a23a'; g.beginPath(); if (REAL) { g.moveTo(154, 88); g.lineTo(168, 94); g.lineTo(156, 100); } else { g.moveTo(154, 90); g.lineTo(186, 96); g.lineTo(154, 97); } g.fill();      // bill (an eagle's hooked, a heron's long)
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(104, 178); g.lineTo(100, 236); g.moveTo(118, 178); g.lineTo(122, 236); g.stroke();
  if (REAL) { g.fillStyle = '#efe6d2'; g.beginPath(); g.ellipse(186, 226, 30, 13, -0.2, 0, TAU); g.fill(); g.fillStyle = '#e2b894'; g.beginPath(); g.arc(214, 220, 9, 0, TAU); g.fill(); }   // the swaddled child
  else { g.fillStyle = '#b08a4e'; g.beginPath(); g.ellipse(186, 226, 38, 20, 0, 0, Math.PI); g.fill(); }                    // cradle
  if (!REAL) g.strokeStyle = '#7a5a2a'; g.lineWidth = 3; if (!REAL) for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(186 + k * 14, 226); g.lineTo(186 + k * 12, 244); g.stroke(); }
  label(0, PUB_A, '#1b2a3a');
  // B: a ram's head under a swallow-tailed pennant on a dark red ground
  frame(W, '#7a2a2a');
  const cx = W + W / 2;
  g.strokeStyle = '#d8c79a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 60, 60); g.lineTo(cx - 60, 150); g.stroke();
  g.fillStyle = '#e6c877'; g.beginPath(); g.moveTo(cx - 60, 62); g.lineTo(cx + 60, 74); g.lineTo(cx + 36, 86); g.lineTo(cx + 60, 98); g.lineTo(cx - 60, 104); g.closePath(); g.fill();
  g.fillStyle = '#e9e2cf'; g.beginPath(); g.ellipse(cx, 190, 34, 46, 0, 0, TAU); g.fill();                         // head
  g.fillStyle = '#c9b48a'; if (!REAL) for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 42, 168, 24, 0, TAU); g.fill(); g.fillStyle = '#8e7646'; g.beginPath(); g.arc(cx + s * 42, 168, 12, 0, TAU); g.fill(); g.fillStyle = '#c9b48a'; }
  g.fillStyle = '#2a1a10'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 14, 182, 4, 0, TAU); g.fill(); }
  g.fillStyle = '#b8a47e'; g.beginPath(); g.ellipse(cx, 226, 18, 12, 0, 0, TAU); g.fill();
  label(W, PUB_B, '#f0e2b0');
  // the lower quarter: plain boards (the back of a sign, brackets)
  g.fillStyle = '#4a3622'; g.fillRect(0, H, S, S - H);
  g.strokeStyle = 'rgba(0,0,0,0.3)'; for (let y = H + 16; y < S; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
}

/** called by _b5_kit.js paintAtlas with its tile / unit helpers */
export function paintB6(tile, unit) {
  unit('sash', paintSash); unit('roundSash', paintRoundSash); tile('rustic', paintRustic); tile('balus', paintBalus);
  unit('relief', paintRelief); unit('pubFront', paintPubFront); unit('signs6', paintSigns6); unit('pubSigns', paintPubSigns);
}
/** called by _b5_kit.js b5Pack with its add(key, cellName, metres, tint, o) */
export function b6Keys(add) {
  add('sash', 'sash', 1); add('sashW', 'sash', 1, [1.06, 1.06, 1.06]); add('roundSash', 'roundSash', 1); add('rustic', 'rustic', 3.2); add('rusticPale', 'rustic', 3.2, [1.08, 1.08, 1.06]);
  add('balus', 'balus', 1); add('balusPale', 'balus', 1, [1.08, 1.08, 1.06]); add('relief', 'relief', 1); add('pubFront', 'pubFront', 1); add('pubFrontRed', 'pubFront', 1, [1.9, 0.75, 0.8]);
  add('portland', 'ashlar', 3.2, [1.1, 1.1, 1.12]); add('clipsham', 'ashlar', 3.2, [1.06, 1.03, 0.92]); add('honey', 'ashlar', 3.2, [1.03, 0.98, 0.88]);
  add('rubbleWarm', 'rubble', 4, [1.02, 0.96, 0.86]); add('render', 'plain', 1, 0xe4dccb); add('renderPink', 'plain', 1, 0xe8d2c4);
  for (const [k, col] of Object.entries({ pubGreen: 0x23382c, pubRed: 0x5a1f22, deskOak: 0x7a5434, paper: 0xf0ece0, blackGown: 0x1a1a1e, brass: 0xb08d3e })) add(k, 'plain', 1, col);
  B6_SIGN_ROWS.forEach((n, i) => add('sign6_' + n, 'signs6', 0, 0xffffff, { rx: 0.99, ry: 1 / B6_SIGN_ROWS.length - 0.004, ox: 0.005, oy: 1 - (i + 1) / B6_SIGN_ROWS.length + 0.002 }));
  // the hanging signs: left / right halves, top three quarters (v from 0.25 to 1)
  add('pubSignA', 'pubSigns', 0, 0xffffff, { rx: 0.49, ry: 0.745, ox: 0.005, oy: 0.25 });
  add('pubSignB', 'pubSigns', 0, 0xffffff, { rx: 0.49, ry: 0.745, ox: 0.505, oy: 0.25 });
  add('signBack', 'pubSigns', 0, 0xffffff, { rx: 0.98, ry: 0.22, ox: 0.01, oy: 0.01 });
}
