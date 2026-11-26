// Districts pass 3 cells of the shared batch-4 atlas (_b4_kit.js rows 8-9; rows 0-7 are untouched) — see
// docs/research/districts3.md. Painted here, called from _b4_kit.js paintAtlas / b4Pack:
//   signsD3   twelve rows of lettering: the pub, club (real names; invented under ?invented=1) and van of the station end, plain notices and boards
//   rust      riveted wrought-iron plates gone to rust with flakes of old paint (the Rewley Road swing bridge, 2013)
//   lattice   a cast-iron lattice girder face: top and bottom flanges, diagonal bars, 1 m a repeat
//   pierced   an ashlar parapet with shaped pierced openings (Headington Hill Hall), 1 m a repeat
//   buffBrick pale yellow (buff) brick in Flemish bond, 2.4 m a repeat (Headington Hill Hall)
//   flats     painted scenery flats for the open-air stage: a woodland glade with a painted arch (invented)
//   planks    timber boards, 2 m a repeat (the stage deck)
//   folds     a hanging cloth in deep folds, 1.5 m a repeat (the stage's wings and border)
// Pure canvas painting; no Math.random (seeded generator). Plain lettering, no logos. The late-night van is the game's
// own (no real counterpart): its name is invented in both modes.

import { tn } from '../core/features.js';
export const D3_CELLS = ['signsD3', 'rust', 'lattice', 'pierced', 'buffBrick', 'flats', 'planks', 'folds'];
export const D3_SIGN_ROWS = ['canalEnd', 'isis', 'swing', 'pubD3', 'club', 'van', 'lost', 'well', 'recGround', 'hhPark', 'play', 'hhHall'];
// the pub and the club on Hythe Bridge Street: the Oxford Retreat and the Bridge (the map's names), or invented ones under
// ?invented=1 (core/features.js; tools/audit_brands.mjs and smoke_districts3 then check no real name is used)
export const NAMES_D3 = { pub: tn('The Oxford Retreat', 'The Wharfinger'), club: tn('The Bridge', 'The Coal Wharf'), van: 'Midnight Grill' };
const BOARDS = [
  ['#2a4a2e', '#f4f0e2', 'OXFORD CANAL  ·  END OF NAVIGATION  ·  NO WINDING BEYOND THIS POINT', 'Arial, sans-serif'],
  ['#f4f2ec', '#1a1a1a', 'ISIS LOCK', 'Arial, sans-serif'],
  ['#f2d24a', '#111111', 'REWLEY ROAD SWING BRIDGE  1851  ·  DANGER  ·  KEEP OFF', 'Arial, sans-serif'],
  ['#1d2f3f', '#efd48c', NAMES_D3.pub.toUpperCase(), 'Georgia, serif'],
  ['#120c18', '#e85ab0', NAMES_D3.club.toUpperCase(), 'Arial, sans-serif'],
  ['#c8231e', '#fff4d8', NAMES_D3.van.toUpperCase() + '  ·  KEBABS  ·  BURGERS  ·  CHIPS', 'Arial, sans-serif'],
  ['#f4f0e0', '#1a1a1a', 'LOST: GREEN BICYCLE, WICKER BASKET. ANSWERS TO "GERALD". REWARD', 'Arial, sans-serif'],
  ['#d9d2c0', '#3a3226', 'DRINK AND THINK OF HIM WHO IS THE FOUNTAIN OF LIFE', 'Georgia, "Times New Roman", serif'],
  ['#2a4a2e', '#f4f0e2', 'ARISTOTLE LANE RECREATION GROUND  ·  NO DOGS IN THE PLAY AREA', 'Arial, sans-serif'],
  ['#1e3524', '#f0e6c8', 'HEADINGTON HILL PARK', 'Georgia, serif'],
  ['#5a1c1c', '#f2e2b4', 'OPEN-AIR SHAKESPEARE TONIGHT  ·  7.30  ·  BRING A RUG', 'Georgia, serif'],
  ['#d6cdb6', '#2e2618', 'HEADINGTON HILL HALL', 'Georgia, "Times New Roman", serif'],
];
const OFF_A = 'rgb(0,0,0)';
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function paintSigns(g, a, S) {
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, S, S); a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const n = D3_SIGN_ROWS.length, h = S / n;
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
/** rusted plates: 1 m a repeat; plate seams with rivet rows, rust blooms, flakes of old grey-green paint */
function paintRust(g, S) {
  const r = rnd(61);
  g.fillStyle = '#7a3e1e'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const k = r(); g.fillStyle = k < 0.4 ? `rgba(150,72,30,${0.2 + r() * 0.3})` : k < 0.75 ? `rgba(60,28,14,${0.2 + r() * 0.3})` : `rgba(190,110,50,${0.15 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * S, r() * S, 2 + r() * 14, 1 + r() * 6, r() * 3, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(96,112,100,${0.35 + r() * 0.4})`; const x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) g.lineTo(x + (r() - 0.3) * 30, y + (r() - 0.3) * 20); g.fill(); }
  // plate seams (a cover strip) and rivets
  for (const x of [0, S / 2]) { g.fillStyle = 'rgba(40,18,8,0.55)'; g.fillRect(x, 0, S * 0.025, S); g.fillStyle = 'rgba(200,120,60,0.25)'; g.fillRect(x + S * 0.025, 0, 2, S); for (let y = 6; y < S; y += S / 16) { g.fillStyle = 'rgba(50,22,10,0.8)'; g.beginPath(); g.arc(x + S * 0.04, y, 3.2, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(210,140,80,0.45)'; g.beginPath(); g.arc(x + S * 0.035, y - 1, 1.4, 0, Math.PI * 2); g.fill(); } }
  for (const y of [S * 0.08, S * 0.92]) { g.fillStyle = 'rgba(40,18,8,0.5)'; g.fillRect(0, y - 3, S, 6); }
  // streaks running down
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(70,30,12,0.18)'; g.fillRect(r() * S, r() * S * 0.5, 1 + r() * 2, S * (0.2 + r() * 0.5)); }
}
/** cast-iron lattice girder face (white paint): flanges top and bottom, two diagonal bars a metre, dark water between */
function paintLattice(g, S) {
  const r = rnd(17);
  g.fillStyle = '#2b3236'; g.fillRect(0, 0, S, S);
  const fl = S * 0.13, ink = '#ecebe4', bar = S * 0.045;
  g.fillStyle = ink; g.fillRect(0, 0, S, fl); g.fillRect(0, S - fl, S, fl);
  g.strokeStyle = ink; g.lineWidth = bar; g.lineCap = 'square';
  for (const x0 of [-S, -S / 2, 0, S / 2, S]) { g.beginPath(); g.moveTo(x0, fl); g.lineTo(x0 + S / 2, S - fl); g.stroke(); g.beginPath(); g.moveTo(x0 + S / 2, fl); g.lineTo(x0, S - fl); g.stroke(); }
  // bosses where the bars cross, shading under the top flange
  for (const x of [S / 4, 3 * S / 4]) { g.fillStyle = ink; g.beginPath(); g.arc(x, S / 2, S * 0.045, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, fl, S, S * 0.02);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,80,60,0.12)' : 'rgba(255,255,255,0.08)'; g.fillRect(r() * S, r() * S, 2 + r() * 5, 1 + r() * 2); }
}
/** pierced parapet: ashlar with a coping and plinth band, two shaped openings (a roundel over a waisted slot) a metre */
function paintPierced(g, S) {
  const r = rnd(5), st = (k) => `rgb(${(222 * k) | 0},${(206 * k) | 0},${(168 * k) | 0})`;
  g.fillStyle = st(1); g.fillRect(0, 0, S, S);
  g.fillStyle = st(1.04); g.fillRect(0, 0, S, S * 0.16); g.fillStyle = st(0.92); g.fillRect(0, S * 0.84, S, S * 0.16);
  g.fillStyle = 'rgba(60,44,20,0.35)'; g.fillRect(0, S * 0.16, S, S * 0.015);
  for (const cx of [S / 4, 3 * S / 4]) {
    g.fillStyle = '#1b1d22';
    g.beginPath(); g.arc(cx, S * 0.38, S * 0.1, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(cx - S * 0.09, S * 0.52); g.quadraticCurveTo(cx - S * 0.03, S * 0.64, cx - S * 0.08, S * 0.78); g.lineTo(cx + S * 0.08, S * 0.78); g.quadraticCurveTo(cx + S * 0.03, S * 0.64, cx + S * 0.09, S * 0.52); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,248,226,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, S * 0.38, S * 0.1 + 2, Math.PI, Math.PI * 1.5); g.stroke();
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(60,50,30,0.1)' : 'rgba(255,250,230,0.1)'; g.fillRect(r() * S, r() * S, 2 + r() * 4, 1 + r() * 2); }
}

/** buff brick: pale yellow stocks with a few darker headers, Flemish bond, light lime mortar */
function paintBuffBrick(g, S) {
  const r = rnd(97), courses = 32, ch = S / courses, bl = S / 9;
  g.fillStyle = '#d9d0b8'; g.fillRect(0, 0, S, S);
  for (let c = 0; c < courses; c++) {
    const y = c * ch, off = (c % 2) * bl * 0.375;
    for (let x = -bl + off, k = 0; x < S + bl; k++) {
      const w = k % 2 ? bl * 0.5 : bl, t = r(), hdr = k % 2 && r() < 0.35;
      g.fillStyle = hdr ? rgb(176 + t * 20, 150 + t * 18, 104 + t * 14) : rgb(222 + t * 22, 198 + t * 20, 142 + t * 22);
      g.fillRect(x + 1.2, y + 1.2, w - 2.4, ch - 2.4);
      g.fillStyle = 'rgba(255,250,230,0.12)'; g.fillRect(x + 1.2, y + 1.2, w - 2.4, 1.2);
      g.fillStyle = 'rgba(60,40,10,0.14)'; g.fillRect(x + 1.2, y + ch - 2.6, w - 2.4, 1.2);
      x += w;
    }
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,70,30,0.10)' : 'rgba(255,255,240,0.08)'; g.fillRect(r() * S, r() * S, 2 + r() * 3, 1 + r() * 2); }
}
/** painted flats: a woodland glade under a sky, a painted stone arch in the middle, a stage-floor edge (invented scene) */
function paintFlats(g, a, S) {
  const r = rnd(211);
  a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const sky = g.createLinearGradient(0, 0, 0, S * 0.7); sky.addColorStop(0, '#5f86b8'); sky.addColorStop(1, '#c9d9e2'); g.fillStyle = sky; g.fillRect(0, 0, S, S);
  // far hills, then trees painted as blobs, darker in front
  g.fillStyle = '#7f9a76'; g.beginPath(); g.moveTo(0, S * 0.62); for (let x = 0; x <= S; x += 16) g.lineTo(x, S * (0.56 + Math.sin(x * 0.02) * 0.03)); g.lineTo(S, S); g.lineTo(0, S); g.fill();
  for (const [n, y0, col, rr] of [[18, 0.52, '#4f7a46', 0.07], [14, 0.6, '#3a6236', 0.09], [10, 0.7, '#2b4c29', 0.11]]) for (let i = 0; i < n; i++) { const x = r() * S, y = S * (y0 + r() * 0.08), R = S * rr * (0.7 + r() * 0.6); g.fillStyle = col; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4a3420'; g.fillRect(x - R * 0.08, y, R * 0.16, S); }
  // the painted arch
  g.fillStyle = '#d8ccae'; g.fillRect(S * 0.36, S * 0.3, S * 0.28, S * 0.6); g.fillStyle = '#7d9c88'; g.beginPath(); g.moveTo(S * 0.41, S * 0.9); g.lineTo(S * 0.41, S * 0.48); g.arc(S * 0.5, S * 0.48, S * 0.09, Math.PI, 0); g.lineTo(S * 0.59, S * 0.9); g.fill();
  g.strokeStyle = '#8a7a5a'; g.lineWidth = 3; for (let y = S * 0.34; y < S * 0.9; y += S * 0.05) { g.beginPath(); g.moveTo(S * 0.36, y); g.lineTo(S * 0.41, y); g.moveTo(S * 0.59, y); g.lineTo(S * 0.64, y); g.stroke(); }
  // flowers, a painted ground, the batten line at the top
  for (let i = 0; i < 120; i++) { g.fillStyle = ['#e8d24a', '#f2f0e6', '#d0506a'][i % 3]; g.fillRect(r() * S, S * (0.84 + r() * 0.12), 4, 4); }
  g.fillStyle = '#5b4a2e'; g.fillRect(0, S * 0.96, S, S * 0.04); g.fillStyle = '#2b2218'; g.fillRect(0, 0, S, S * 0.02);
}
/** stage boards: planks along u, each with grain and nail heads */
function paintPlanks(g, S) {
  const r = rnd(43), n = 10, h = S / n;
  for (let i = 0; i < n; i++) { const t = r(); g.fillStyle = rgb(128 + t * 30, 96 + t * 22, 64 + t * 16); g.fillRect(0, i * h, S, h); g.fillStyle = 'rgba(30,20,10,0.6)'; g.fillRect(0, i * h, S, 2); const j = r() * S; g.fillRect(j, i * h, 2, h); for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(60,40,20,0.18)'; g.fillRect(0, i * h + r() * h, S, 1); } g.fillStyle = 'rgba(20,20,20,0.5)'; g.fillRect(j + 6, i * h + h * 0.3, 2, 2); g.fillRect(j + 6, i * h + h * 0.7, 2, 2); }
}
/** a hanging cloth in deep folds (vertical light / shade bands) */
function paintFolds(g, S) {
  const n = 8;
  for (let i = 0; i < S; i++) { const k = 0.55 + 0.45 * Math.sin((i / S) * n * Math.PI * 2); g.fillStyle = rgb(70 + 120 * k, 14 + 22 * k, 20 + 26 * k); g.fillRect(i, 0, 1, S); }
  g.fillStyle = 'rgba(255,220,140,0.6)'; g.fillRect(0, S * 0.02, S, S * 0.03);
}

/** paint every d3 cell; unit(name, (g, a, S) => …) and tile(name, (g, S) => …) come from the kit's atlas painter */
export function paintD3(unit, tile) {
  unit('signsD3', paintSigns);
  tile('rust', paintRust);
  tile('lattice', paintLattice);
  tile('pierced', paintPierced);
  tile('buffBrick', paintBuffBrick);
  unit('flats', paintFlats);
  tile('planks', paintPlanks);
  tile('folds', paintFolds);
}
/** pack keys of the d3 cells; add(key, cellName, metresPerRepeat, tint, o) is the kit's adder */
export function d3Keys(add) {
  const n = D3_SIGN_ROWS.length;
  D3_SIGN_ROWS.forEach((name, i) => add('sign_' + name, 'signsD3', 0, 0xffffff, { rx: 0.99, ry: 1 / n - 0.004, ox: 0.005, oy: 1 - (i + 1) / n + 0.002 }));
  add('rust', 'rust', 2.2, [1, 1, 1]); add('rustDk', 'rust', 2.2, [0.7, 0.66, 0.64]);
  add('lattice', 'lattice', 1, [1, 1, 1]); add('latticeDk', 'lattice', 1, [0.3, 0.34, 0.31]);
  add('pierced', 'pierced', 1, [1, 1, 1]);
  add('buffBrick', 'buffBrick', 2.4, [1, 1, 1]); add('buffBrickDk', 'buffBrick', 2.4, [0.86, 0.84, 0.8]);
  add('flats', 'flats', 1, [1, 1, 1]); add('planks', 'planks', 2, [1, 1, 1]); add('folds', 'folds', 1.5, [1, 1, 1]);
  for (const [k, c] of Object.entries({ hallBrick: [0.9, 0.8, 0.56], portland: [0.92, 0.9, 0.84], portlandDk: [0.7, 0.68, 0.62], whiteIron: [0.9, 0.9, 0.88], mansard: [0.36, 0.3, 0.28], rugRed: [0.62, 0.16, 0.14], rugTartan: [0.18, 0.32, 0.22], rugBlue: [0.2, 0.3, 0.55],
    stageBoard: [0.42, 0.32, 0.22], curtain: [0.45, 0.08, 0.1], kingBlue: [0.1, 0.55, 0.8], kingOrange: [0.9, 0.45, 0.12], vanRed: [0.75, 0.12, 0.1], vanWhite: [0.92, 0.92, 0.9], slide: [0.85, 0.2, 0.15], chairGreen: [0.2, 0.4, 0.28], bridgeGreen: [0.13, 0.2, 0.16], goal: [0.95, 0.95, 0.94], basket: [0.66, 0.5, 0.28] })) add(k, 'plain', 1, c);
}
