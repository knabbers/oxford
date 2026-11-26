// Districts pass 2 cells of the shared batch-4 atlas (_b4_kit.js row 7; rows 0-6 are untouched) — see
// docs/research/districts2.md. Painted here, called from _b4_kit.js paintAtlas / b4Pack:
//   signsD2   twelve rows of lettering: the pubs (real names; invented under ?invented=1) and boards of The Plain, North Parade and Osney, plain notices
//   balus     a stone balustrade, 1 m a repeat (coping strip, three vase balusters with dark gaps, plinth)
//   foam      broken white water (the weir's fall and the tail below it), 2 m a repeat
//   gothWin   a two-light pointed (Gothic Revival) window in stone dressings, glass in aux (North Oxford villas)
// Pure canvas painting; no Math.random (seeded generator). Plain lettering, no logos.

import { tn } from '../core/features.js';
export const D2_CELLS = ['signsD2', 'balusD2', 'foam', 'gothWin'];
export const D2_SIGN_ROWS = ['plainPubA', 'plainPubB', 'punts', 'npPubA', 'npPubB', 'npStreet', 'obs', 'obsMet', 'osneyPub', 'lock', 'tpath', 'lowBridge'];
// the pubs: their real names (St Clement's: the Half Moon, the Old Black Horse; North Parade: the Gardeners Arms, the
// Rose & Crown; Osney: the Punter — docs/research/real_names.md), or invented ones under ?invented=1 (core/features.js;
// tools/audit_brands.mjs then checks no real name is used)
export const PUBS = {
  plainA: tn('The Half Moon', 'The Tollgate'), plainB: tn('The Old Black Horse', 'The Mileway Arms'),
  npA: tn('The Gardeners Arms', 'The Nurseryman'), npB: tn('The Rose & Crown', 'The Crown & Cushion'),
  osney: tn('The Punter', 'The Wherry'),
};
const BOARDS = [
  ['#1e3524', '#e8cf86', PUBS.plainA.toUpperCase(), 'Georgia, serif'],
  ['#5a1c1c', '#f2e2b4', PUBS.plainB.toUpperCase(), 'Georgia, serif'],
  ['#f3efe4', '#173a5e', tn('MAGDALEN BRIDGE BOATHOUSE  ·  PUNTS BY THE HOUR', 'PUNTS  ·  BY THE HOUR  ·  CHAUFFEURED TOURS'), 'Arial, sans-serif'],
  ['#233a2a', '#efd890', PUBS.npA.toUpperCase(), 'Georgia, serif'],
  ['#1b2a4a', '#f2e6c2', PUBS.npB.toUpperCase(), 'Georgia, serif'],
  ['#f4f2ec', '#111111', 'NORTH PARADE AVENUE', 'Arial, sans-serif'],
  ['#d9ceb2', '#3a2c18', 'RADCLIFFE OBSERVATORY  ·  1772 - 1794', 'Georgia, "Times New Roman", serif'],
  ['#f4f2ec', '#1c3a5e', 'WEATHER STATION  ·  READINGS SINCE 1767  ·  PLEASE KEEP OFF', 'Arial, sans-serif'],
  ['#14283c', '#f0d488', PUBS.osney.toUpperCase(), 'Georgia, serif'],
  ['#f4f2ec', '#1a1a1a', 'OSNEY LOCK', 'Arial, sans-serif'],
  ['#2a4a2e', '#f4f0e2', 'THAMES PATH  ·  PORT MEADOW  ·  FOLLY BRIDGE', 'Arial, sans-serif'],
  ['#f2d24a', '#111111', 'OSNEY BRIDGE  ·  LOW HEADROOM  7 FT 6 IN', 'Arial, sans-serif'],
];
const GLASS_A = 'rgb(255,0,0)', STONE_A = 'rgb(0,255,0)', OFF_A = 'rgb(0,0,0)';
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;
const ST = (k = 1) => rgb(214 * k, 198 * k, 160 * k);

function paintSigns(g, a, S) {
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, S, S); a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const n = D2_SIGN_ROWS.length, h = S / n;
  BOARDS.forEach(([bg, fg, t, font], i) => {
    const y = i * h;
    g.fillStyle = bg; g.fillRect(0, y, S, h);
    g.strokeStyle = fg; g.globalAlpha = 0.8; g.lineWidth = 2; g.strokeRect(3, y + 3, S - 6, h - 6); g.globalAlpha = 1;
    let size = 28; g.font = `bold ${size}px ${font}`; const m = g.measureText(t).width; if (m > S - 24) size = Math.floor(size * (S - 24) / m);
    g.font = `bold ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillText(t, S / 2 + 1, y + h / 2 + 2.5);
    g.fillStyle = fg; g.fillText(t, S / 2, y + h / 2 + 1.5);
  });
}
/** balustrade: 1 m wide x 1 m high a repeat: coping (top 14 %), three vase balusters, plinth (bottom 14 %) */
function paintBalus(g, S) {
  const r = rnd(83);
  g.fillStyle = '#211c16'; g.fillRect(0, 0, S, S);
  g.fillStyle = ST(1.02); g.fillRect(0, 0, S, S * 0.14); g.fillRect(0, S * 0.86, S, S * 0.14);
  g.fillStyle = 'rgba(40,28,10,0.5)'; g.fillRect(0, S * 0.14, S, S * 0.02);
  g.fillStyle = 'rgba(255,240,210,0.35)'; g.fillRect(0, S * 0.845, S, S * 0.015);
  for (let k = 0; k < 3; k++) {
    const cx = (k + 0.5) * S / 3, top = S * 0.16, bot = S * 0.86, hh = bot - top;
    const prof = [[0.17, 0], [0.12, 0.07], [0.1, 0.16], [0.17, 0.4], [0.25, 0.62], [0.2, 0.8], [0.12, 0.9], [0.2, 1]];
    g.fillStyle = ST(0.97 + r() * 0.06); g.beginPath();
    g.moveTo(cx - prof[0][0] * S / 3, top);
    for (const [w, t] of prof) g.lineTo(cx - w * S / 3, top + t * hh);
    for (const [w, t] of prof.slice().reverse()) g.lineTo(cx + w * S / 3, top + t * hh);
    g.closePath(); g.fill();
    const gr = g.createLinearGradient(cx - S / 8, 0, cx + S / 8, 0); gr.addColorStop(0, 'rgba(255,240,210,0.25)'); gr.addColorStop(1, 'rgba(40,28,10,0.45)');
    g.fillStyle = gr; g.fill();
  }
  for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? 'rgba(60,50,30,0.12)' : 'rgba(255,250,230,0.1)'; g.fillRect(r() * S, r() * S, 2 + r() * 4, 1 + r() * 2); }
}
/** white water: churned streaks along u (the flow), darker water between */
function paintFoam(g, S) {
  const r = rnd(29);
  g.fillStyle = '#5f7a78'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const x = r() * S, y = r() * S, w = 8 + r() * 46, h = 2 + r() * 7, k = r();
    g.fillStyle = k < 0.65 ? `rgba(246,250,248,${0.35 + r() * 0.5})` : `rgba(170,196,192,${0.3 + r() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, w / 2, h / 2, (r() - 0.5) * 0.3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(r() * S, r() * S, 1.5, 1.5); }
}
/** a two-light pointed window: buff stone dressings with a hood mould, plate tracery roundel, leaded glass (aux) */
function paintGothWin(g, a, S) {
  g.fillStyle = ST(0.98); g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const m = S * 0.08, w = (S - 3 * m) / 2, sp = S * 0.42;
  const light = (x0) => {
    const path = (c) => { c.beginPath(); c.moveTo(x0, S - m); c.lineTo(x0, sp); c.quadraticCurveTo(x0, sp - w * 0.75, x0 + w / 2, sp - w * 1.05); c.quadraticCurveTo(x0 + w, sp - w * 0.75, x0 + w, sp); c.lineTo(x0 + w, S - m); c.closePath(); };
    path(g); const gr = g.createLinearGradient(0, m, 0, S); gr.addColorStop(0, '#6e8090'); gr.addColorStop(0.5, '#3a4652'); gr.addColorStop(1, '#262e36'); g.fillStyle = gr; g.fill();
    path(a); a.fillStyle = GLASS_A; a.fill();
    g.save(); path(g); g.clip(); g.strokeStyle = 'rgba(230,226,214,0.85)'; g.lineWidth = S * 0.012;
    for (const y of [sp, sp + (S - m - sp) / 2]) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); }
    g.beginPath(); g.moveTo(x0 + w / 2, sp - w); g.lineTo(x0 + w / 2, S - m); g.stroke(); g.restore();
    g.strokeStyle = 'rgba(90,70,40,0.6)'; g.lineWidth = S * 0.018; path(g); g.stroke();
  };
  light(m); light(2 * m + w);
  // the roundel over the mullion and the hood mould
  g.fillStyle = '#3a4652'; g.beginPath(); g.arc(S / 2, m * 1.4, m * 0.75, 0, Math.PI * 2); g.fill();
  a.fillStyle = GLASS_A; a.beginPath(); a.arc(S / 2, m * 1.4, m * 0.75, 0, Math.PI * 2); a.fill();
  g.strokeStyle = 'rgba(80,60,30,0.55)'; g.lineWidth = S * 0.02; g.beginPath(); g.moveTo(m * 0.3, sp - w * 0.2); g.quadraticCurveTo(S / 2, -S * 0.12, S - m * 0.3, sp - w * 0.2); g.stroke();
  g.fillStyle = ST(1.08); g.fillRect(m * 0.5, S - m, S - m, m * 0.7);
  a.fillStyle = OFF_A; a.fillRect(S / 2 - m * 0.3, sp - w, m * 0.6, S);
}

/** paint every d2 cell; unit(name, (g, a, S) => …) and tile(name, (g, S) => …) come from the kit's atlas painter */
export function paintD2(unit, tile) {
  unit('signsD2', paintSigns);
  tile('balusD2', paintBalus);
  tile('foam', paintFoam);
  unit('gothWin', paintGothWin);
}
/** pack keys of the d2 cells; add(key, cellName, metresPerRepeat, tint, o) is the kit's adder; lit = LIT bays */
export function d2Keys(add, lit) {
  const n = D2_SIGN_ROWS.length;
  // lettering rows (12 per cell, top row first); the pub boards sit on a bay lit every night (lit from inside after dark? no: painted boards)
  D2_SIGN_ROWS.forEach((name, i) => add('sign_' + name, 'signsD2', 0, 0xffffff, { rx: 0.99, ry: 1 / n - 0.004, ox: 0.005, oy: 1 - (i + 1) / n + 0.002 }));
  add('balus', 'balusD2', 1, [1.0, 0.98, 0.94]); add('balusDk', 'balusD2', 1, [0.84, 0.82, 0.78]);
  add('foam', 'foam', 2, [1.0, 1.0, 1.0]);
  add('blueBrick', 'brick', 2.4, [0.46, 0.46, 0.58]);   // Staffordshire blue engineering brick (railway abutments)
  add('gothWin', 'gothWin', 1, 0xffffff); add('gothWinBuff', 'gothWin', 1, [1.05, 1.0, 0.9]);
  void lit;
  // plain colours of the pass
  for (const [k, c] of Object.entries({ villaRed: [0.62, 0.3, 0.22], villaYellow: [0.86, 0.72, 0.46], stucco: [0.93, 0.9, 0.82], lockBlack: [0.05, 0.05, 0.055], lockWhite: [0.88, 0.88, 0.85], tar: [0.12, 0.1, 0.09], parasol: [0.16, 0.36, 0.3],
    bunt0: [0.75, 0.12, 0.12], bunt1: [0.12, 0.26, 0.62], bunt2: [0.9, 0.75, 0.15], bunt3: [0.1, 0.5, 0.25], bunt4: [0.9, 0.9, 0.88], screen: [0.94, 0.94, 0.92], ironBlue: [0.14, 0.2, 0.3], copper: [0.32, 0.55, 0.46], lead2: [0.5, 0.52, 0.55], gravel2: [0.62, 0.56, 0.44] })) add(k, 'plain', 1, c);
}
