// Shared kit for the batch-4 landmarks (martyrs_memorial.js, folly_bridge.js, isis_boathouses.js, iffley_track.js).
// See docs/research/landmarks_batch4.md.
//
// ONE draw for all four sites: every site registers LOD groups (near / mid / far chunks, as places/_rad_lod.js does) into
// one shared vertex buffer drawn with one atlas material; a dynamic index lists the chunks drawn this frame. The first
// update of any batch-4 module after every module has installed builds the buffer (finish()).
//
// The atlas (4 x 4 cells of 512 px): stone, slate, lead, flags, a sash window, Perpendicular tracery, a statue niche,
// carved bands and a door are COPIED from the Radcliffe Square atlas canvas (_rad_atlas.js, same painter, nothing new to
// draw); red brick, weatherboarding, a running-track surface, a modern glazed screen, four flags of invented colours and
// the painted lettering are painted here. The material is the city's atlas shader with the view-ray layer bias on
// (`layered`), so the running track (aLayer 8) sorts over the park ground like a ground layer and never z-fights it.
import * as THREE from 'three';
import { settleLater } from '../world/_geo_free.js';
import { repaintableAll, canvasOf } from '../world/_tex_keep.js';
import { radPack } from './_rad_atlas.js';
import { Batch, RB, frame, rectPts, archPts, flatUp } from './_rad_kit.js';
import { EXTRA_CELLS, SIGN2_ROWS, SIGN3_ROWS, LIT_ROWS, paintExtra } from './_b4_cells.js';
import { D2_CELLS, paintD2, d2Keys } from './_d2_cells.js';   // districts pass 2: row 7 (rows 0-6 unchanged)
import { D3_CELLS, paintD3, d3Keys } from './_d3_cells.js';   // districts pass 3: rows 8-9 (rows 0-7 unchanged)

export { Batch, RB, frame, rectPts, archPts, flatUp };
import { tn } from '../core/features.js';
export const TAU = Math.PI * 2;
export const NX = 4, NY = 10, CS = 512, AS = 256;      // rows 4-6: the extra cells of _b4_cells.js (visual pass + East Oxford + Jericho); row 7: _d2_cells.js; rows 8-9: _d3_cells.js
const CELLS = ['ashlar', 'brick', 'weather', 'lead', 'slate', 'flags', 'plain', 'track', 'sash', 'perp', 'niche', 'carve', 'door', 'glazed', 'flagset', 'signs', ...EXTRA_CELLS, ...D2_CELLS, ...D3_CELLS];
export const CELL = Object.fromEntries(CELLS.map((n, i) => [n, i]));
// where each copied cell sits in the Radcliffe atlas (4 x 5, row-major): ashlar 0, lead 4, slate 5, flags 6, sash 9, perp 12, niche 19, carve 16, door 14
const FROM_RAD = { ashlar: 0, lead: 4, slate: 5, flags: 6, sash: 9, perp: 12, niche: 19, carve: 16, door: 14 };
const GLASS_A = 'rgb(255,0,0)', STONE_A = 'rgb(0,255,0)', OFF_A = 'rgb(0,0,0)';

function newCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;

// ---- painters (tile cells: drawn into a CS canvas that is then tiled 3 x 3 into the padded cell)
function paintBrick(g, S) {
  const r = rnd(41), courses = 32, ch = S / courses, bl = S / 9;
  g.fillStyle = '#b7a894'; g.fillRect(0, 0, S, S);
  for (let c = 0; c < courses; c++) {
    const y = c * ch, header = c % 2, w = header ? bl / 2 : bl, off = header ? bl / 4 : 0;
    for (let x = -w + off; x < S + w; x += w) {
      const k = r(), burnt = r() < 0.1;
      g.fillStyle = burnt ? rgb(96 + k * 24, 46 + k * 12, 38 + k * 10) : rgb(150 + k * 42, 70 + k * 24, 52 + k * 18);
      g.fillRect(x + 1, y + 1, w - 2, ch - 2);
      g.fillStyle = 'rgba(255,230,210,0.10)'; g.fillRect(x + 1, y + 1, w - 2, 1.2);
      g.fillStyle = 'rgba(30,10,4,0.18)'; g.fillRect(x + 1, y + ch - 2.2, w - 2, 1.2);
    }
  }
  try { const img = g.getImageData(0, 0, S, S), d = img.data; if (d && d.length) { for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 16; d[i] += n; d[i + 1] += n * 0.8; d[i + 2] += n * 0.7; } g.putImageData(img, 0, 0); } } catch { /* stub canvas */ }
}
function paintWeather(g, S) {
  const r = rnd(7), n = 14, bh = S / n;
  for (let i = 0; i < n; i++) {
    const y = i * bh, t = r() * 14;
    g.fillStyle = rgb(232 + t * 0.4, 230 + t * 0.4, 222 + t * 0.4); g.fillRect(0, y, S, bh);
    const gr = g.createLinearGradient(0, y, 0, y + bh); gr.addColorStop(0, 'rgba(0,0,0,0.30)'); gr.addColorStop(0.18, 'rgba(0,0,0,0.05)'); gr.addColorStop(0.9, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0.18)');
    g.fillStyle = gr; g.fillRect(0, y, S, bh);
    for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(80,70,60,${0.03 + r() * 0.04})`; g.fillRect(r() * S, y + 2, 20 + r() * 120, 1); }
  }
}
// the running track surface: 1.22 m lanes across (v), 4 m along (u); white lane line at the lane's edge, rubber crumb
function paintTrack(g, S) {
  const r = rnd(3);
  g.fillStyle = '#a8432f'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { const k = r(); g.fillStyle = k < 0.5 ? 'rgba(70,20,12,0.22)' : 'rgba(220,120,90,0.18)'; g.fillRect(r() * S, r() * S, 1.6, 1.6); }
  const lw = Math.max(2, S * 0.05 / 1.22);
  g.fillStyle = 'rgba(246,244,236,0.95)'; g.fillRect(0, 0, S, lw);
}
function paintGlazed(g, a, S) {
  // a modern boathouse front: tall glazed doors in dark frames, a transom row
  g.fillStyle = '#2a2d30'; g.fillRect(0, 0, S, S); a.fillStyle = STONE_A; a.fillRect(0, 0, S, S);
  const m = S * 0.04, cols = 3;
  for (let i = 0; i < cols; i++) for (const [y0, y1] of [[m, S * 0.22], [S * 0.25, S - m]]) {
    const x0 = m + i * ((S - 2 * m) / cols) + m * 0.4, x1 = m + (i + 1) * ((S - 2 * m) / cols) - m * 0.4;
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#8fa2b0'); gr.addColorStop(0.45, '#56697a'); gr.addColorStop(1, '#2f3a44');
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * 0.4, y0); g.lineTo(x0, y0 + (y1 - y0) * 0.5); g.fill();
    a.fillStyle = GLASS_A; a.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
}
// four flags of invented colours (no real college's): each a 256 x 256 quarter, the hoist on the left
const FLAGS = [
  (g, S) => { g.fillStyle = '#1e3f8a'; g.fillRect(0, 0, S, S); g.fillStyle = '#f2efe4'; g.beginPath(); g.moveTo(0, S * 0.38); g.lineTo(S * 0.5, S * 0.62); g.lineTo(S, S * 0.38); g.lineTo(S, S * 0.52); g.lineTo(S * 0.5, S * 0.76); g.lineTo(0, S * 0.52); g.fill(); },
  (g, S) => { g.fillStyle = '#1f5a34'; g.fillRect(0, 0, S, S); g.fillStyle = '#e8c43a'; g.fillRect(0, S / 2, S, S / 2); g.fillStyle = '#f4f2ea'; g.fillRect(S * 0.3, 0, S * 0.1, S); g.fillRect(0, S * 0.45, S, S * 0.1); },
  (g, S) => { g.fillStyle = '#7a1428'; g.fillRect(0, 0, S, S); g.fillStyle = '#f3efe6'; g.fillRect(S / 2, 0, S / 2, S / 2); g.fillRect(0, S / 2, S / 2, S / 2); },
  (g, S) => { g.fillStyle = '#14233f'; g.fillRect(0, 0, S, S); g.strokeStyle = '#8cc4e8'; g.lineWidth = S * 0.12; g.beginPath(); g.moveTo(0, 0); g.lineTo(S, S); g.moveTo(S, 0); g.lineTo(0, S); g.stroke(); },
];
// painted lettering (real names by default, invented under ?invented=1; notices; the plaque's words are plain history)
export const SIGN_ROWS = ['pub', 'boats', 'steamer', 'track', 'tickets', 'mile', 'memorialPanel', 'rowing'];
function paintSigns(g, a, S) {
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, S, S); a.fillStyle = OFF_A; a.fillRect(0, 0, S, S);
  const rowH = S / 16;
  const text = (t, x, y, size, color, font = 'Georgia, "Times New Roman", serif', weight = 'bold') => { g.fillStyle = color; g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y); };
  const fit = (t, w, size, font = 'Georgia, serif') => { g.font = `bold ${size}px ${font}`; const m = g.measureText(t).width; return m > w ? Math.floor(size * w / m) : size; };
  const board = (row, bg, fg, t, font) => { const y = row * rowH * 2; g.fillStyle = bg; g.fillRect(0, y, S, rowH * 2); g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(5, y + 5, S - 10, rowH * 2 - 10); text(t, S / 2, y + rowH + 2, fit(t, S - 40, 34, font), fg, font); };
  board(0, '#15301f', '#e8c870', tn('THE HEAD OF THE RIVER', 'THE FERRYMAN'));
  board(1, '#f3efe4', '#173a5e', tn('SALTER’S STEAMERS  ·  PUNTS & ROWING BOATS', 'GRANDPONT BOATS  ·  PUNTS & ROWING BOATS'), 'Arial, sans-serif');
  board(2, '#1c3d6a', '#f7f4ea', 'GRANDPONT BELLE');
  board(3, '#0f3a2a', '#f4f0e2', 'IFFLEY ROAD TRACK', 'Arial, sans-serif');
  board(4, '#f3efe4', '#3a2412', 'RIVER TRIPS  ·  HOURLY  ·  ASK AT THE KIOSK', 'Arial, sans-serif');
  // the mile board at the track: a black board, the record and "your time" lines are drawn on the HUD, not here
  board(5, '#101010', '#f2d24a', 'THE MILE  ·  4 LAPS  ·  START HERE', 'Arial, sans-serif');
  // the memorial's inscription panel (plain history; the words as cut on the base, abridged)
  { const y = 6 * rowH * 2, h = rowH * 2; g.fillStyle = '#cfc4a6'; g.fillRect(0, y, S, h); g.fillStyle = 'rgba(60,46,24,0.85)'; g.font = 'bold 13px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['TO THE GLORY OF GOD, AND IN GRATEFUL COMMEMORATION OF HIS SERVANTS', 'THOMAS CRANMER, NICHOLAS RIDLEY, HUGH LATIMER,', 'PRELATES OF THE CHURCH OF ENGLAND ... THIS MONUMENT WAS', 'ERECTED BY PUBLIC SUBSCRIPTION IN THE YEAR OF OUR LORD MDCCCXLI'].forEach((l, k) => g.fillText(l, S / 2, y + 12 + k * 13)); }
  board(7, '#0e1d3c', '#f2efe4', 'BOATHOUSE  ·  CREWS ONLY BEYOND THIS POINT', 'Arial, sans-serif');
}
// the blue plaque, drawn into the bottom-right quarter of the flagset cell (so it can be read at a step's distance)
function paintPlaque(g, S) {
  const cx = S / 2, cy = S / 2, R = S * 0.47;
  g.clearRect(0, 0, S, S); g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.fillStyle = '#1f4f9c'; g.beginPath(); g.arc(cx, cy, R * 0.93, 0, TAU); g.fill();
  g.fillStyle = '#f4f4f0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const L = [['HERE AT', 13], ['IFFLEY ROAD', 15], ['THE FIRST MILE', 15], ['UNDER FOUR', 15], ['MINUTES WAS RUN', 14], ['6 MAY 1954', 16], ['ROGER BANNISTER', 14]];
  L.forEach(([t, sz], k) => { g.font = `bold ${sz}px Arial, sans-serif`; g.fillText(t, cx, cy - 66 + k * 22); });
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
  // copied cells
  let src = null; try { const P = radPack(world); src = P.atlas.map && canvasOf(P.atlas.map); } catch { src = null; }
  for (const [name, ri] of Object.entries(FROM_RAD)) {
    const [x, y, ax, ay] = at(name);
    if (src) { try { g.drawImage(src, (ri % 4) * CS, Math.floor(ri / 4) * CS, CS, CS, x, y, CS, CS); } catch { /* stub */ } }
    else { g.fillStyle = '#cbb488'; g.fillRect(x, y, CS, CS); }
    // glass in the copied sash: the area inside the frame (as _rad_atlas.js paintSash lays it out)
    if (name === 'sash') { const F = AS * 0.045; a.fillStyle = GLASS_A; a.fillRect(ax + F, ay + F, AS - 2 * F, AS - 2 * F - AS * 0.012); }
    if (name === 'perp') { a.fillStyle = OFF_A; a.fillRect(ax, ay, AS, AS); a.fillStyle = STONE_A; a.fillRect(ax, ay, AS, AS); }
  }
  tile('brick', paintBrick); tile('weather', paintWeather); tile('track', paintTrack);
  tile('plain', (t, S) => { t.fillStyle = '#ffffff'; t.fillRect(0, 0, S, S); });
  unit('glazed', paintGlazed);
  unit('flagset', (gg, aa, S) => {
    const h = S / 2;
    for (let k = 0; k < 3; k++) { gg.save(); gg.translate((k % 2) * h, Math.floor(k / 2) * h); gg.beginPath(); gg.rect(0, 0, h, h); gg.clip(); FLAGS[k](gg, h); gg.restore(); }
    gg.save(); gg.translate(h, h); gg.beginPath(); gg.rect(0, 0, h, h); gg.clip(); paintPlaque(gg, h); gg.restore();
    aa.fillStyle = OFF_A; aa.fillRect(0, 0, S, S);
  });
  // the fourth flag goes into the signs cell's last free strip? no: it shares the plaque's quarter's neighbour (row 2 of signs)
  unit('signs', paintSigns);
  paintExtra(unit, tile);
  paintD2(unit, tile);
  paintD3(unit, tile);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  const aux = new THREE.CanvasTexture(ac);
  aux.colorSpace = THREE.NoColorSpace; aux.wrapS = aux.wrapT = THREE.RepeatWrapping; aux.minFilter = THREE.LinearMipmapLinearFilter; aux.magFilter = THREE.LinearFilter;
  const again = () => { const k = ATLAS; ATLAS = null; try { return paintAtlas(); } finally { ATLAS = k; } };      // (memory pass: painted again by this function, its cache set aside for the call, if the card ever needs the picture again: world/_tex_keep.js)
  return (ATLAS = repaintableAll({ tex, aux, canvas: c }, again, 'batch-4 atlas'));
}

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
// shopfront paints (Cowley Road / Walton Street: dark greens, ox-blood, navy, cream, teal, mustard, plum, black)
export const SHOP_PAINTS = [0x2e5a3c, 0x7a2626, 0x24365e, 0xe8dcc0, 0x2a7a78, 0xc8962a, 0x6a2e5a, 0x2a2a2a];
const DISTRICT_PLAIN = {
  render0: 0xe8d8b0, render1: 0xd9a878, render2: 0x9cc4c0, render3: 0xe6c05a, render4: 0xd98a8a, render5: 0xa8c890, render6: 0xf0e6d2, render7: 0x88a8c8,
  mosqueRed: 0x9a4a36, mosqueBlue: 0x3e5a7e, mosqueBuff: 0xd8c08a, domeGreen: 0x2f7a52, domeGold: 0xd4aa3a, tileRed: 0x9a4430,
  boatGreen: 0x1e4a2e, boatRed: 0x7a1a1a, boatBlue: 0x1b2f5a, boatBlack: 0x1a1a1a, boatCream: 0xefe6cf, boatOx: 0x5a1e1e,
  bulb: 0xfff2c0, neon: 0xff5ab0, bike: 0x2a2c30, bin: 0x1e3a24, binLid: 0x2a2a2a, foliage: 0x3e6a2e, pot: 0x9a5a3a, smoke: 0x8a8a8a, brass: 0xb8902e,
};
let PACK = null;
/** pack for Batch.build: key -> {cell, rx, ry, ox, oy, tint, seed}; tiles take metres, units / sub-rects take 0..1 */
export function b4Pack(world) {
  if (PACK) return PACK;
  const { tex, aux } = paintAtlas(world);
  const K = new Map();
  const add = (key, name, m, tint = 0xffffff, o = {}) => K.set(key, { cell: CELL[name], rx: m ? 1 / m : 0, ry: m ? 1 / m : 0, ox: 0, oy: 0, tint: Array.isArray(tint) ? tint : lin(tint), seed: 0, ...o });
  // masonry: the memorial's Magnesian limestone is pale cream-grey; Folly Bridge's ashlar a weathered buff
  add('stone', 'ashlar', 3.2); add('mag', 'ashlar', 2.4, [1.04, 1.06, 1.14]); add('magDk', 'ashlar', 2.4, [0.8, 0.81, 0.84]);
  add('magShade', 'ashlar', 2.4, [0.5, 0.47, 0.42]); add('bridge', 'ashlar', 3.2, [0.98, 0.95, 0.86]); add('bridgeDk', 'ashlar', 3.2, [0.72, 0.7, 0.64]);
  add('dress', 'ashlar', 3.2, [1.12, 1.1, 1.04]);
  add('brick', 'brick', 2.4); add('brickDk', 'brick', 2.4, [0.78, 0.74, 0.72]); add('brickBuff', 'brick', 2.4, [1.5, 1.32, 1.02]);
  add('weather', 'weather', 2.4); add('weatherGreen', 'weather', 2.4, [0.42, 0.62, 0.5]); add('weatherBlue', 'weather', 2.4, [0.4, 0.54, 0.82]); add('weatherCream', 'weather', 2.4, [1.0, 0.96, 0.86]);
  add('lead', 'lead', 2.4, [0.78, 0.8, 0.84]); add('slate', 'slate', 2.4); add('flags', 'flags', 3); add('paving', 'flags', 3, [1.08, 1.04, 0.98]);
  add('track', 'track', 4, 0xffffff, { rx: 1 / 4, ry: 1 / 1.22 }); add('trackPlain', 'track', 0, 0xffffff, { ox: 0.5, oy: 0.6 });
  add('trackGreen', 'track', 0, [0.36, 0.62, 0.36], { ox: 0.5, oy: 0.6 });
  add('carve', 'carve', 0.8, [1.14, 1.12, 1.06], { ry: 0.46, oy: 0.52 }); add('dentil', 'carve', 0.8, [1.14, 1.12, 1.06], { ry: 0.21, oy: 0.27 });
  add('perp', 'perp', 1, [1.14, 1.12, 1.06]); add('niche', 'niche', 1, [1.16, 1.14, 1.1]); add('sash', 'sash', 1, 0xf2efe6);
  add('door', 'door', 1, 0x2b3a2c); add('doorOak', 'door', 1, 0x6a4a30); add('glazed', 'glazed', 1);
  // plain colours
  for (const [k, c] of Object.entries({ white: 0xeeebe2, cream: 0xe8dcc0, iron: 0x1d1e21, dark: 0x0d0d0e, shade: [0.06, 0.055, 0.05], green: 0x2c4a36, navy: 0x1c2a48, red: 0x8a2a24,
    hull: 0xf2f0ea, varnish: 0x8a5a2a, oak: 0x6a4a30, deck: 0x7d6a52, rope: 0xbca57e, canvas: 0xe9e2d0, gold: 0xc9a54a, grass: 0x4f6b35, concrete: 0xb8b4aa, chalk: 0xf4f2ea,
    steamerBlue: 0x1d3f6e, ...DISTRICT_PLAIN, steamerRed: 0x8c2420, steamerCream: 0xefe6cf, rubber: 0x2b2b2b, statue: [0.86, 0.8, 0.68], statueDk: [0.62, 0.57, 0.48], umbrella: 0x2e5a3c, lamp: 0x24262a })) add(k, 'plain', 1, c);
  // flags (quarters of the flagset cell) and the plaque
  const q = (k, i) => add(k, 'flagset', 0, 0xffffff, { rx: 0.48, ry: 0.48, ox: (i % 2) * 0.5 + 0.01, oy: (1 - Math.floor(i / 2)) * 0.5 + 0.01 });
  q('flagA', 0); q('flagB', 1); q('flagC', 2); q('plaque', 3);
  // lettering rows (each 1/8 of the signs cell, top row first)
  SIGN_ROWS.forEach((n, i) => add('sign_' + n, 'signs', 0, 0xffffff, { rx: 0.99, ry: 0.122, ox: 0.005, oy: 1 - (i + 1) * 0.125 + 0.0015 }));
  // the marquee boards are backlit glass (_b4_cells.js LIT_ROWS): their u is shifted to a bay that is lit every night
  SIGN2_ROWS.forEach((n, i) => add('sign_' + n, 'signs2', 0, 0xffffff, { rx: 0.99, ry: 0.122, ox: 0.005 + (LIT_ROWS.includes(n) ? LIT[40 + i] : 0), oy: 1 - (i + 1) * 0.125 + 0.0015 }));
  SIGN3_ROWS.forEach((n, i) => add('sign_' + n, 'signs3', 0, 0xffffff, { rx: 0.99, ry: 0.122, ox: 0.005 + (LIT_ROWS.includes(n) ? LIT[50 + i] : 0), oy: 1 - (i + 1) * 0.125 + 0.0015 }));
  // the extra cells: halves of the mural / shutter cells, shopfronts and cabin sides in several paints, round-headed lights
  add('muralA', 'mural', 0, 0xffffff, { rx: 0.99, ry: 0.49, ox: 0.005, oy: 0.505 }); add('muralB', 'mural', 0, 0xffffff, { rx: 0.99, ry: 0.49, ox: 0.005, oy: 0.005 });
  add('shutterA', 'shutter', 0, 0xffffff, { rx: 0.99, ry: 0.49, ox: 0.005, oy: 0.505 }); add('shutterB', 'shutter', 0, 0xffffff, { rx: 0.99, ry: 0.49, ox: 0.005, oy: 0.005 });
  SHOP_PAINTS.forEach((c, i) => add('shop' + i, 'shop', 1, c));
  add('arch', 'arch', 1); add('louvre', 'louvre', 1); add('menu', 'menu', 1);
  for (const [k, c] of Object.entries({ portCream: 0xffffff, portGreen: [0.62, 0.86, 0.7], portBlue: [0.7, 0.8, 1.0], portRed: [1.0, 0.78, 0.74] })) add(k, 'port', 1, c);
  for (const [k, c] of Object.entries({ awnRed: [1.0, 0.32, 0.28], awnGreen: [0.34, 0.66, 0.42], awnBlue: [0.34, 0.5, 0.9], awnYellow: [1.05, 0.86, 0.36], awnPlum: [0.62, 0.3, 0.52] })) add(k, 'awning', 2, c);
  add('crates', 'crates', 1.2); add('rubble', 'rubble', 3, [1.0, 0.97, 0.9]); add('rubbleDk', 'rubble', 3, [0.76, 0.74, 0.7]);
  d2Keys(add, LIT);
  d3Keys(add);
  const atlas = world.atlasMaterial({ map: tex, aux, n: NX, ny: NY, ao: true, weather: true, weatherCells: 4, windows: true, layered: true, roughness: 0.9, name: 'b4-atlas', surf: world.surf && world.surf.kit(CELLS) });
  PACK = { atlas, cells: K, ground: null, groundCells: null, glow: null, glowCells: null, nCells: CELLS.length };
  return PACK;
}

// ------------------------------------------------------------------------------------------------ geometry helpers
const ATTRS = [['position', 3], ['normal', 3], ['uv', 2], ['aCell', 4], ['aTint', 3], ['aTop', 1], ['aLayer', 1]];
/** the atlas part of a Batch as a BufferGeometry (or null) */
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
/** one LOD draw (the _rad_lod.js scheme, with a per-chunk aLayer) */
export class Lod {
  constructor() { this.groups = []; this.chunks = []; this.mesh = null; this.sig = ''; this.stats = { drawn: 0, tris: 0, levels: {} }; }
  /** c [x,y,z], r radius, d [near, mid, far] distances */
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
  finish(material, name = 'b4:atlas') {
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

/** register three Batches (near, mid, far) of one site as one LOD group; mid/far may be null (= farCopy of near) */
export function addSite(K, name, c, r, d, Bs, o = {}) {
  const P = K.pack, g0 = Bs[0] ? geoOf(Bs[0], P) : null;
  const g1 = Bs[1] ? geoOf(Bs[1], P) : farCopy(g0, o.midArea ?? 0.35), g2 = Bs[2] ? geoOf(Bs[2], P) : farCopy(g1 || g0, o.farArea ?? 1.5);
  const grp = K.lod.group(name, c, r, d, o);
  const co = { layer: o.layer || 0, need: o.need || null, name };
  let tris = 0;
  for (const [lv, g] of [[0, g0], [1, g1], [2, g2]]) { if (g) { grp.add(lv, g, co); if (lv === 0) tris = g.attributes.position.count / 3; } }
  K.sites[name] = { tris, c, r };
  return grp;
}

// ------------------------------------------------------------------------------------------------ the shared registry
/** one per game: {pack, lod, root, sites, boxes, finish(), tick()} — every batch-4 module calls shared(game) */
export function shared(game) {
  if (game._b4) return game._b4;
  const W = game.world;
  const K = { pack: b4Pack(W), lod: new Lod(), root: new THREE.Group(), sites: {}, boxes: [], modules: 0, ready: 0, done: false, mesh: null, owner: null };
  K.root.name = 'b4:root';
  K.finish = () => {
    if (K.done) return K.mesh;
    K.done = true;
    K.mesh = K.lod.finish(K.pack.atlas);
    K.root.add(K.mesh);
    try { W.addStatic(K.root); } catch { game.worldScene.add(K.root); }
    return K.mesh;
  };
  /** a module joins (install start) -> its id; call K.joined(id) when its install is over (also on error) */
  K.join = (id) => { K.modules++; if (!K.owner) K.owner = id; return id; };
  K.joined = () => { K.ready++; };
  /** per frame: every module calls it, the first module to join does the work */
  K.tick = (id) => {
    if (id !== K.owner) return;
    if (!K.done) { if (K.ready < K.modules) return; K.finish(); }
    const out = game.player.place === 'world';
    if (!out) { if (K.mesh.visible) { K.mesh.visible = false; K.lod.sig = '§'; } return; }
    const k = Math.max(0.75, (game.quality && game.quality.dist) || 1);
    K.lod.update(game.camera, k, W.aerial ? 2.7 : 1);
    // shadows only while the player is near one of the sites (the sun's shadow box is ±60 m round the player)
    const p = game.player.pos; let near = false;
    for (const [x0, x1, z0, z1] of K.boxes) if (Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(z0 - p.z, 0, p.z - z1)) < 70) { near = true; break; }
    K.mesh.castShadow = near && !W.aerial;
  };
  game._b4 = K;
  return K;
}

// ------------------------------------------------------------------------------------------------ small pure helpers
export function h01(a, b = 0) {
  let h = Math.imul((a | 0) ^ 0x6c8e9cf5, 0x85ebca6b) ^ Math.imul((b | 0) + 0x3c6ef372, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
export { DAY_MS } from '../core/time.js';
/** a sub-rect quad (sign, flag, plaque) facing (nx, nz): bottom edge a -> b (left -> right seen from the front), y0..y1 */
export function signCard(B, key, ax, az, bx, bz, y0, y1, nx, nz, off = 0.02) {
  const ox = nx * off, oz = nz * off;
  B.card(key, [ax + ox, y0, az + oz], [bx + ox, y0, bz + oz], [bx + ox, y1, bz + oz], [ax + ox, y1, az + oz], [0.004, 0.004, 0.996, 0.996]);
}
/** a hexagonal / n-gon prism ring (walls only, optional top) centred (cx, cz) */
export function prismN(B, key, cx, cz, r, n, y0, y1, a0 = 0, top = true, rTop = r) {
  for (let i = 0; i < n; i++) {
    const t0 = a0 + (i / n) * TAU, t1 = a0 + ((i + 1) / n) * TAU, tm = (t0 + t1) / 2;
    const p = (t, rr, y) => [cx + Math.sin(t) * rr, y, cz + Math.cos(t) * rr];
    const L = 2 * r * Math.sin(Math.PI / n);
    B.poly(key, [p(t0, r, y0), p(t1, r, y0), p(t1, rTop, y1), p(t0, rTop, y1)], [Math.sin(tm), 0, Math.cos(tm)], [[0, y0], [L, y0], [L, y1], [0, y1]]);
    if (top) B.poly(key, [[cx, y1, cz], p(t0, rTop, y1), p(t1, rTop, y1)], [0, 1, 0]);
  }
}

// ------------------------------------------------------------------------------------------------ dressing helpers
// (visual pass 2026-11; shared by the batch-4 sites, cowley_road.js and jericho.js)
/** the atlas shader's lit-window hash for a unit at integer UV offset (i, 0), seed 0 (materials.js wHash12) */
export function litHash(i, j = 0) {
  const fr = (x) => x - Math.floor(x), px = i * 1.731, py = j * 0.917 + 3.7;
  let x = fr(px * 0.1031), y = fr(py * 0.1031), z = fr(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33); x += d; y += d; z += d;
  return fr((x + y) * z);
}
/** integer bays whose glass is lit every night (hash under the lowest night lit fraction, 0.12 + 0.22) / never lit */
export const LIT = []; export const DARK = [];
{ const fr = (x) => x - Math.floor(x);
  // lit: under every night's lit fraction, bright (wA), not curtained, plain warm-white (materials.js window glow terms)
  for (let i = 5000; i < 40000 && (LIT.length < 64 || DARK.length < 16); i++) { const h = litHash(i); if (h < 0.06 && fr(h * 61.7) > 0.72 && fr(h * 421.9) >= 0.33 && fr(h * 157.3) >= 0.3 && fr(h * 157.3) <= 0.86 && LIT.length < 64) LIT.push(i); else if (h > 0.9 && DARK.length < 16) DARK.push(i); } }
/** a glowing card (a bulb, a lit marquee panel): the blank cream foot of the menu cell, on a lit bay; quad a, b, c, d */
export function glowCard(B, a, b, c, d, k = 0) { const i = LIT[k % LIT.length]; B.card('menu', a, b, c, d, [i + 0.3, 0.012, i + 0.7, 0.05]); }
/** a small glowing blob facing all ways (two crossed cards), centre (x, y, z), size s */
export function bulb(B, x, y, z, s = 0.09, k = 0) {
  glowCard(B, [x - s, y - s, z], [x + s, y - s, z], [x + s, y + s, z], [x - s, y + s, z], k);
  glowCard(B, [x + s, y - s, z], [x - s, y - s, z], [x - s, y + s, z], [x + s, y + s, z], k);
  glowCard(B, [x, y - s, z + s], [x, y - s, z - s], [x, y + s, z - s], [x, y + s, z + s], k);
  glowCard(B, [x, y - s, z - s], [x, y - s, z + s], [x, y + s, z + s], [x, y + s, z - s], k);
}
/** a festoon of bulbs between two points [x, y, z] sagging by sag m */
export function festoon(B, a, b, n, sag = 0.4, k = 0) {
  let prev = a;
  for (let i = 1; i <= n + 1; i++) {
    const t = i / (n + 1), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
    B.beam('iron', prev, p, 0.012); prev = p;
    if (i <= n) bulb(B, p[0], p[1] - 0.06, p[2], 0.05, k + i);
  }
}
/** a bicycle standing at (x, z) facing h (game heading), frame colour key; ~120 triangles (q 1: wheels and a bar) */
export function bike(B, x, z, h, key = 'bike', q = 0) {
  B.push(frame(x, 0, z, Math.cos(h), -Math.sin(h)));       // local +z = forward
  const R = 0.34, seg = q ? 6 : 10;
  for (const wz of [-0.52, 0.52]) {
    B.push(frame(0, R, wz, 0, 1));                           // wheel plane: local x = bike's z
    for (let i = 0; i < seg; i++) { const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU; B.beam('rubber', [Math.cos(a0) * R, Math.sin(a0) * R, 0], [Math.cos(a1) * R, Math.sin(a1) * R, 0], 0.035); }
    B.pop();
  }
  const P = (zz, y) => [0, y, zz];
  B.beam(key, P(-0.52, R), P(0.0, R + 0.05), 0.035); B.beam(key, P(0.0, R + 0.05), P(0.45, R + 0.52), 0.035);
  B.beam(key, P(-0.52, R), P(-0.12, R + 0.5), 0.03); B.beam(key, P(-0.12, R + 0.5), P(0.0, R + 0.05), 0.035);
  B.beam(key, P(-0.12, R + 0.5), P(0.4, R + 0.5), 0.035); B.beam(key, P(0.52, R), P(0.42, R + 0.6), 0.035);
  if (!q) { B.box('dark', 0, R + 0.62, -0.15, 0.1, 0.05, 0.24, 0); B.beam('dark', [-0.25, R + 0.68, 0.42], [0.25, R + 0.68, 0.42], 0.03); B.box('iron', 0, R + 0.4, -0.38, 0.12, 0.03, 0.3, 0); }
  B.pop();
}
/** a Sheffield stand (inverted U, 0.8 m tall) at (x, z), its plane along heading h */
export function stand(B, x, z, h) {
  const ux = Math.sin(h) * 0.35, uz = Math.cos(h) * 0.35;
  B.beam('iron', [x - ux, 0, z - uz], [x - ux, 0.8, z - uz], 0.05); B.beam('iron', [x + ux, 0, z + uz], [x + ux, 0.8, z + uz], 0.05);
  B.beam('iron', [x - ux, 0.8, z - uz], [x + ux, 0.8, z + uz], 0.05);
}
/** a park bench at (x, z) facing h */
export function bench(B, x, z, h, key = 'green') {
  B.push(frame(x, 0, z, Math.cos(h), -Math.sin(h)));
  B.box(key, 0, 0.45, 0, 1.7, 0.05, 0.42, 0); B.box(key, 0, 0.72, -0.22, 1.7, 0.3, 0.04, 0);
  for (const sx of [-0.75, 0.75]) { B.box('iron', sx, 0.22, 0.12, 0.05, 0.44, 0.05, 0, { top: false }); B.box('iron', sx, 0.4, -0.2, 0.05, 0.8, 0.05, 0, { top: false }); }
  B.pop();
}
/** a wheelie bin at (x, z) facing h (lid key) */
export function wheelie(B, x, z, h, key = 'bin') { B.box(key, x, 0.52, z, 0.58, 1.0, 0.72, h, { top: false }); B.box('binLid', x, 1.04, z, 0.62, 0.06, 0.78, h); }
