// Procedural canvas textures. Everything is painted once at load: three atlases (facade 1024², roof 512², ground 1024²)
// used by the merged city meshes, plus small single-purpose textures and standalone repeatable textures for other modules.
//
// Facade atlas: 4×4 cells, each cell = ONE bay (width) × ONE storey (height) of a wall style. A companion "aux" atlas with the
// same layout holds masks: R = glass (lit at night / sky reflection), G = wall tint mask (vertex tint applies), B = paint
// mask (doors / shop fascias get a per-bay heritage colour in the shader).
import * as THREE from 'three';
import { makeRng } from './util.js';
import { encodeLevel, compressedTexture, compressCanvasTexture } from './_surf_compress.js';
import { storeCompressed } from './_surf_cache.js';

export const FACADE_CELLS = {
  stoneSash: 0, stoneDoor: 1, stoneGothic: 2, stoneBlank: 3,
  stoneTudor: 4, brickSash: 5, brickDoor: 6, brickBlank: 7,
  renderSash: 8, renderDoor: 9, shopfront: 10, brickStrip: 11,   // (11 was shopDoor: repurposed, building facts 2026-11)
  glass: 12, concreteBand: 13, concreteBlank: 14, renderBlank: 15,
  // graphics pass 3 (rows 6-10 of the city atlas)
  stoneSashTall: 24, stoneRustic: 25, stoneSmall: 26, stoneArchDoor: 27,
  brickGeorgian: 28, brickPoly: 29, brickPair: 30, renderGeorgian: 31,
  shopA: 32, shopB: 33, shopDoorA: 34, pubFront: 35,
  cafeFront: 36, timberUp: 37, paintFlat: 38, garageDoor: 39,
  awning: 40, dormerFront: 41, stoneBand: 42, darkMetal: 43,
  // graphics pass 4 (row 11): college ranges
  collegeGround: 44, collegeGothic: 45, collegeWide: 46, plasterGable: 47,   // (47 was collegePlain: repurposed, building facts 2026-11)
  // graphics pass 5: the one spare cell of row 5 — a tower's top stage (louvred bell opening over a clock dial)
  towerBelfry: 23,
  // graphics pass 7 (row 12): hanging-sign boards with painted devices (2x2 per cell), a boarded garden gate
  signBoard: 48, gardenGate: 49,
  // stone pass (2026-11): coursed rubble (boundary walls, the flanks of ashlar-fronted buildings)
  stoneRubble: 50,
  // roofscape / college-front pass (2026-11, row 13): two-light mullion, attic gable, tall round-headed, Venetian pair
  collegeTwo: 51, collegeGable: 52, stoneRoundArch: 53, venetianPair: 54,
  // houses pass (2026-11, photo comparison item 17): the last spare cell of row 13 — a villa's brick gable to the street
  villaGable: 55,
};
export const ROOF_CELLS = { slate: 0, tile: 1, lead: 2, flat: 3, stone: 5 };   // 4 = parapet stone (not a roof)
// the city atlas (facade texture) is 4×6 cells: rows 0-3 the facade cells, row 4 the roof cells (ROOF_OFS + ROOF_CELLS),
// row 5 parapet stone (PARAPET_CELL) + spares
export const FACADE_ROWS = 14, ROOF_OFS = 16, PARAPET_CELL = 20, HEDGE_CELL = 22, NEW_WALL_OFS = 24;
export const ROOF_SCALE = [2.0, 1.6, 2.6, 4.0, 2.0, 2.4]; // metres per cell repeat (index = ROOF_CELLS)
/** City atlas cell size in px (512 on capable GPUs, 256 on the low tier); set before createCityMaterials(). */
export const ATLAS = { cell: 256 };
/**
 * Texture pass (2026-11): the top tier's sizes and filtering, set once by world/index.js before anything is painted
 * (world/_surf_detail.js decides: SURF.wanted). on: false leaves every texture exactly as it was. With it on: 16x
 * anisotropy on every canvas texture made here, the ground atlas 1024 px a cell (was 256: the surface always underfoot),
 * the city's sign page painted 1.5x as large (45 px lettering; 2x would be 128 MB for the one page) and the stand-alone /
 * interior textures twice as large. Pass 2: the city facade atlas 1024 px a cell (HI.cell; 310 MB with its mips) and its
 * mask atlas 512 px a cell — windows, doors and shopfronts are painted with their fine detail only at that size
 * (sashFine, doorFine, shopFine, the leaded lights' extras: all skipped when HI.on is false).
 */
export const HI = { on: false, aniso: 16, ground: 4096, cell: 1024, aux: 2048, k: 2, sign: 1.5, leaves: null, dxt: null };   // dxt: the GPU's block formats (world/_surf_compress.js) — the big textures made here are stored compressed   // leaves: the photo leaf sprite sheet (world/_surf_detail.js), or null
const hiK = () => (HI.on ? HI.k : 1);
/**
 * Start-up (pass 4): finished textures restored from the browser's cache by world/index.js before anything is painted
 * (world/_surf_cache.js). facade: {map, aux}, ground: {map}; tree: a texture; sign: {hash, texture, aspects, w, h}.
 * `v` prefixes the cache entries' names with what the tier decides (sizes, formats). A maker with its slot filled
 * returns it and paints nothing; with it empty it paints as ever and (tree, sign) stores the result for next time.
 */
export const PRE = { v: '', facade: null, ground: null, tree: null, sign: null };
export const GROUND_CELLS = {
  asphalt: 0, paving: 1, setts: 2, gravel: 3, grass: 4, lawn: 5, meadow: 6, woodland: 7,
  flowerbed: 8, parking: 9, sand: 10, boards: 11, kerb: 12, steps: 13, cobbles: 14, dirt: 15,
  // graphics pass 4 (rows 4-5): strips mapped ALONG a road, v across it (v 0 = kerb / left edge)
  pavedKerb: 16, tarmacKerb: 17, carriageway: 18,
  // graphics pass 5: paths through grass, mapped along the path (v across): worn earth and tufts at both edges
  gravelPath: 19, earthPath: 20, tarmacPath: 21,
  // roughness pass (row 5 spares + row 6): second versions of the cells that repeat most visibly. The ground shader
  // picks A or B per repeat ("bay") by a hash (GeoBuf.setCell(a, b, probabilityOfB, seed)), so a street is not one
  // 5 m picture stamped end to end: a utility trench across the flags, a reinstated strip across the carriageway...
  pavedKerbB: 22, carriagewayB: 23, tarmacKerbB: 24, settsB: 25, cobblesB: 26, pavingB: 27,
};
export const GROUND_ROWS = 7;
export const GROUND_SCALE = [5, 3.6, 2.4, 3, 4, 3.6, 5, 4, 3, 5, 3, 3, 1.8, 1.2, 2, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.4, 2, 3.6];   // lawn: 3.6 m repeat of six 0.6 m mower stripes (stone pass; were 1.8 m)
/**
 * Roughness pass (2026-11): worn, patched, hand-laid versions of the street surfaces, worn paint, the grime decals
 * (world/rough.js) and leaning street furniture. `?rough=0` turns the whole pass off (before / after screenshots and
 * frame-time comparisons from identical cameras).
 */
export const ROUGH = !(typeof location !== 'undefined' && location && /[?&]rough=0(&|$)/.test(location.search || ''));

// ---------------------------------------------------------------- canvas plumbing
export function mkCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  return { c, g };
}
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const shade = (c, k) => rgb(c[0] * k, c[1] * k, c[2] * k);
export function canvasTexture(c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = opts.clampS ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.wrapT = opts.clampT ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = HI.on ? HI.aniso : (opts.anisotropy || 4);
  t.generateMipmaps = opts.mips !== false;
  t.minFilter = opts.mips === false ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
/** Add per-pixel luminance noise + optional low-frequency blotches to a region. */
/**
 * Start-up (pass 4): the top tier's grain. Reading a region's pixels back and adding noise to each in script was most
 * of the cost of painting the big atlases (10 s of 17). On the top tier the same two things are laid on by the canvas
 * itself, with no pixel loop: the fine noise as a 256 x 256 tile of random greys patterned over the region, the slow
 * blotches as a small picture of the same random grid stretched smoothly over it, both with the 'overlay' operator
 * (mid-grey leaves a colour alone, lighter lifts it, darker lowers it). The picture is the same in kind and
 * strength, not pixel for pixel — on this tier the scanned layers lie over it, and block compression would not keep
 * single-pixel noise anyway. The lower tiers keep the loop below, call for call: their pictures do not change.
 */
let NOISE_TILE = null;
function grainFast(g, x, y, w, h, amp, rng, blotch, bscale) {
  if (w <= 0 || h <= 0 || typeof document === 'undefined') return;
  if (!NOISE_TILE) {
    NOISE_TILE = document.createElement('canvas'); NOISE_TILE.width = NOISE_TILE.height = 256;
    const t = NOISE_TILE.getContext('2d'), im = t.createImageData(256, 256); let s = 0x2545f491;
    for (let i = 0; i < 65536; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const v = (s >>> 24); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    t.putImageData(im, 0, 0);
  }
  const gw = Math.ceil(w / bscale) + 2, gh = Math.ceil(h / bscale) + 2;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); g.rect(x, y, w, h); g.clip();      // (the cell's own clip stays in force)
  g.globalCompositeOperation = 'overlay';
  if (blotch) {
    const c = document.createElement('canvas'); c.width = gw; c.height = gh; const t = c.getContext('2d'), im = t.createImageData(gw, gh), k = blotch * 2.0;
    for (let i = 0; i < gw * gh; i++) { const v = 128 + (rng() * 2 - 1) * k; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    t.putImageData(im, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, gw - 1, gh - 1, x, y, (gw - 1) * bscale, (gh - 1) * bscale);
  } else for (let i = 0; i < gw * gh; i++) rng();
  g.globalAlpha = Math.min(1, amp / 64);
  const ox = (rng() * 256) | 0, oy = (rng() * 256) | 0;
  g.translate(x - ox, y - oy); g.fillStyle = g.createPattern(NOISE_TILE, 'repeat'); g.fillRect(ox, oy, w, h);
  g.restore();
}
function grain(g, x, y, w, h, amp, rng, blotch = 0, bscale = 24) {
  if (HI.on) return grainFast(g, x, y, w, h, amp, rng, blotch, bscale);
  const img = g.getImageData(x, y, w, h), d = img.data;
  if (!d || !d.length) return;
  const gw = Math.ceil(w / bscale) + 2, gh = Math.ceil(h / bscale) + 2, grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rng() * 2 - 1;
  for (let j = 0; j < h; j++) {
    const fy = j / bscale, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
    for (let i = 0; i < w; i++) {
      let n = (rng() * 2 - 1) * amp;
      if (blotch) {
        const fx = i / bscale, ix = fx | 0, tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
        const a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1], c = grid[(iy + 1) * gw + ix], e = grid[(iy + 1) * gw + ix + 1];
        n += ((a + (b - a) * sx) * (1 - sy) + (c + (e - c) * sx) * sy) * blotch;
      }
      const k = (j * w + i) * 4;
      d[k] = d[k] + n; d[k + 1] = d[k + 1] + n; d[k + 2] = d[k + 2] + n * 0.9;
    }
  }
  g.putImageData(img, x, y);
}
function fill(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); }

// ---------------------------------------------------------------- facade pieces
// stone pass (2026-11, photo comparison item 3): the base ashlar is a neutral buff (was 212,195,156: one saturated
// yellow everywhere). Honey, cream, grey and sooty stone come from the per-building tint (buildings.js TINTS.stone)
// and the atlas shader's weathering (materials.js), so the base itself stays in the middle of the range.
const STONE = [208, 197, 170], BRICK = [168, 116, 92], RENDER = [236, 230, 218], CONCRETE = [182, 180, 174];
/**
 * Texture pass 2 (top tier): the ashlar cells whose courses and joints are drawn by the atlas shader in WORLD space —
 * 30 cm courses that run level round a whole building whatever its bay width or storey height, blocks 0.7-1.4 m long
 * (materials.js, the 'ashlar' flag of the surface table) — so the painter leaves them out of these cells (BARE is set
 * by paintAtlas while it paints one of them). Rusticated, rubble and parapet stone keep their painted joints.
 */
export const ASHLAR_SHADER_CELLS = ['stoneSash', 'stoneDoor', 'stoneGothic', 'stoneBlank', 'stoneTudor', 'stoneSashTall', 'stoneSmall', 'stoneArchDoor', 'stoneBand',
  'collegeGround', 'collegeGothic', 'collegeWide', 'collegeTwo', 'collegeGable', 'stoneRoundArch', 'venetianPair', 'towerBelfry'];
let BARE = false;
function ashlar(g, S, rng, base, courseH, ox, oy, noise) {
  // Headington / Bath / Clipsham ashlar: big smooth blocks with FINE joints. The wall reads as stone through gentle
  // block-to-block tone and warmth, broad weathering and the odd pale refacing stone, not through a grid of lines.
  fill(g, rgb(...base), 0, 0, S, S);
  for (let y = 0; y < S && !BARE; y += courseH) {
    let x = -rng() * 40;
    while (x < S) {
      const bw = courseH * (1.9 + rng() * 1.7), r = rng(), k = r < 0.05 ? 1.07 : r < 0.1 ? 0.91 : 0.965 + rng() * 0.07, w = (rng() - 0.5) * 0.05;
      fill(g, rgb(base[0] * k * (1 + w), base[1] * k, base[2] * k * (1 - w * 1.6)), x, y, bw, courseH);
      fill(g, 'rgba(70,54,30,0.20)', x + bw - 0.5, y, 1, courseH);                    // perpend
      if (rng() < 0.22) { g.fillStyle = 'rgba(96,74,40,0.07)'; g.beginPath(); g.ellipse(x + bw * rng(), y + courseH * rng(), 4 + rng() * 9, 2 + rng() * 4, 0, 0, 7); g.fill(); }
      x += bw;
    }
    fill(g, 'rgba(70,54,30,0.26)', 0, y - 0.5, S, 1);                                 // bed joint
    fill(g, 'rgba(255,250,236,0.10)', 0, y + 0.5, S, 1);
  }
  noise(0, 0, S, S, 7, 9);
  // lichen / soot flecks, broad weathering
  for (let i = 0; i < 44; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(96,104,66,0.06)' : 'rgba(50,44,36,0.06)'; g.beginPath(); g.arc(rng() * S, rng() * S, 3 + rng() * 9, 0, 7); g.fill(); }
  const gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, 'rgba(60,45,20,0)'); gr.addColorStop(1, 'rgba(60,45,20,0.09)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(70,60,40,0.04)'; g.fillRect(rng() * S, 0, 2 + rng() * 6, S); }
}
function brickwork(g, S, rng, base, courseH, brickW, noise) {
  // Flemish bond with THIN lime-mortar joints close to the brick in tone (strong pale joints read as stripes close up)
  fill(g, rgb(base[0] * 0.98 + 14, base[1] * 1.06 + 18, base[2] * 1.1 + 18), 0, 0, S, S); // weathered mortar
  let row = 0;
  for (let y = 0; y < S; y += courseH, row++) {
    let x = row % 2 ? -brickW / 2 : 0;
    let header = row % 2 === 0;
    while (x < S) {
      const w = header ? brickW : brickW * 0.5;
      const k = 0.9 + rng() * 0.2, burnt = !header && rng() < 0.2 ? 0.84 : rng() < 0.04 ? 0.86 : 1, warm = (rng() - 0.5) * 0.08;
      fill(g, rgb(base[0] * k * burnt * (1 + warm), base[1] * k * burnt, base[2] * k * (burnt < 1 ? burnt * 1.06 : 1) * (1 - warm)), x + 0.55, y + 0.55, w - 1.1, courseH - 1.1);
      fill(g, 'rgba(30,15,10,0.10)', x + 0.55, y + courseH - 1.4, w - 1.1, 0.8);
      x += w; header = !header;
    }
  }
  noise(0, 0, S, S, 8, 7);
}
function render(g, S, base, noise) {
  fill(g, rgb(...base), 0, 0, S, S);
  noise(0, 0, S, S, 6, 10);
  const gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, 'rgba(80,70,50,0)'); gr.addColorStop(1, 'rgba(80,70,50,0.12)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
}
function glassFill(g, a, x, y, w, h) {
  // glass by day mirrors the sky: pale at the head, deeper towards the sill, a soft diagonal sheen (the shader adds the
  // live sky reflection and the night glow on top)
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#8797a5'); gr.addColorStop(0.4, '#5a6a79'); gr.addColorStop(1, '#38434e');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.09)'; g.beginPath(); g.moveTo(x + w * 0.05, y); g.lineTo(x + w * 0.4, y); g.lineTo(x + w * 0.1, y + h); g.lineTo(x - w * 0.25, y + h); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x + w * 0.62, y); g.lineTo(x + w * 0.74, y); g.lineTo(x + w * 0.44, y + h); g.lineTo(x + w * 0.32, y + h); g.closePath(); g.fill();
  g.restore();
  a.fillStyle = 'rgb(255,0,0)'; a.fillRect(x, y, w, h);
}
/** What is behind the glass of a house window: drawn curtains, a net, a blind, or the dim room (variant from the geometry). */
function dressing(g, x, y, w, h, v) {
  if (v === 0) {
    for (const [cx, cw] of [[x, w * 0.2], [x + w * 0.8, w * 0.2]]) { fill(g, 'rgba(226,214,190,0.62)', cx, y, cw, h); for (let i = 1; i < 4; i++) fill(g, 'rgba(120,104,80,0.25)', cx + (cw * i) / 4, y, 1, h); }
    fill(g, 'rgba(20,24,30,0.22)', x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.7);
  } else if (v === 1) {
    fill(g, 'rgba(240,240,236,0.42)', x, y + h * 0.5, w, h * 0.5);
    for (let i = 0; i < 9; i++) fill(g, 'rgba(255,255,255,0.14)', x + (w * i) / 9, y + h * 0.5, w / 22, h * 0.5);
  } else if (v === 2) {
    fill(g, 'rgba(232,224,204,0.66)', x, y, w, h * 0.34); fill(g, 'rgba(90,80,60,0.4)', x, y + h * 0.34, w, 1.5);
    fill(g, 'rgba(20,24,30,0.18)', x, y + h * 0.36, w, h * 0.64);
  } else {
    const gr = g.createLinearGradient(0, y + h * 0.35, 0, y + h); gr.addColorStop(0, 'rgba(22,24,28,0)'); gr.addColorStop(1, 'rgba(22,24,28,0.36)'); g.fillStyle = gr; g.fillRect(x, y + h * 0.35, w, h * 0.65);
    fill(g, 'rgba(214,190,150,0.22)', x + w * 0.58, y + h * 0.62, w * 0.2, h * 0.2);   // a lamp / picture in the room
  }
}
/** Sash window with glazing bars. cols×rows per sash (two sashes stacked). The sash sits back in a painted reveal. */
function sash(g, a, x, y, w, h, cols, rows, frame = '#eeeae0') {
  const rv = 3.5;
  // reveal: head and left jamb in shadow, right jamb catching the light (sun from the upper left in the bake)
  g.fillStyle = 'rgba(24,16,8,0.58)'; g.fillRect(x - rv, y - rv, w + 2 * rv, rv); g.fillStyle = 'rgba(24,16,8,0.44)'; g.fillRect(x - rv, y, rv, h);
  g.fillStyle = 'rgba(255,250,236,0.22)'; g.fillRect(x + w, y, rv, h);
  // soft shadow under the sill
  { const sg = g.createLinearGradient(0, y + h + 9, 0, y + h + 26); sg.addColorStop(0, 'rgba(40,30,16,0.30)'); sg.addColorStop(1, 'rgba(40,30,16,0)'); g.fillStyle = sg; g.fillRect(x - 13, y + h + 9, w + 26, 17); }
  glassFill(g, a, x, y, w, h);
  dressing(g, x, y, w, h, Math.abs(Math.round(x * 3 + w * 5 + h * 7 + cols * 11 + rows * 2)) % 4);
  g.fillStyle = frame; a.fillStyle = 'rgb(0,0,0)';
  const f = Math.max(3, w * 0.05);
  const bars = (bx, by, bw, bh) => { g.fillRect(bx, by, bw, bh); a.fillRect(bx, by, bw, bh); };
  bars(x, y, w, f); bars(x, y + h - f, w, f); bars(x, y, f, h); bars(x + w - f, y, f, h);
  bars(x, y + h / 2 - f / 2, w, f); // meeting rail
  const bw = Math.max(1.5, f * 0.45);
  for (let s = 0; s < 2; s++) {
    const sy = y + (s * h) / 2, sh = h / 2;
    for (let i = 1; i < cols; i++) bars(x + (w * i) / cols - bw / 2, sy, bw, sh);
    for (let j = 1; j < rows; j++) bars(x, sy + (sh * j) / rows - bw / 2, w, bw);
  }
  // shadow cast by the head and the left jamb across frame and glass, fading out
  { const hg = g.createLinearGradient(0, y, 0, y + Math.max(8, h * 0.11)); hg.addColorStop(0, 'rgba(0,0,0,0.42)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hg; g.fillRect(x, y, w, Math.max(8, h * 0.11)); }
  { const jg = g.createLinearGradient(x, 0, x + Math.max(5, w * 0.12), 0); jg.addColorStop(0, 'rgba(0,0,0,0.34)'); jg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = jg; g.fillRect(x, y, Math.max(5, w * 0.12), h); }
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, y + h / 2 + f / 2, w, 2.5);   // the upper sash oversails the lower
  if (HI.on) sashFine(g, x, y, w, h, cols, rows, f, bw);
}
/**
 * Texture pass 2 (top tier only, 1024 px cells): what a sash window has that a 512 px cell could not hold — every
 * pane's own tone (hand-made glass is never one sheet), the putty line round each pane (a dark line under and to the
 * right of every bar, a light one above and left: the bars stand proud), the moulded edge of the frame, the horns under
 * the meeting rail, the sash lift, the parting bead.
 */
function sashFine(g, x, y, w, h, cols, rows, f, bw) {
  const hsh = (i, j, k) => { const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + x * 3.1 + y * 1.7) * 43758.5453; return v - Math.floor(v); };
  for (let s = 0; s < 2; s++) {
    const sy = y + (s * h) / 2 + (s ? f / 2 : f), sh = h / 2 - f * 1.5, pw = (w - 2 * f) / cols, ph = sh / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const px = x + f + i * pw, py = sy + j * ph, r = hsh(i, j, s);
      g.fillStyle = r < 0.5 ? `rgba(255,255,255,${(0.07 * r).toFixed(3)})` : `rgba(0,10,20,${(0.09 * (r - 0.5)).toFixed(3)})`; g.fillRect(px, py, pw, ph);
      // putty lines: shadow below / right of the bar above and left of this pane, light on the far sides
      g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(px + bw * 0.5, py + bw * 0.5, pw - bw, 0.7); g.fillRect(px + bw * 0.5, py + bw * 0.5, 0.7, ph - bw);
      g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(px + bw * 0.5, py + ph - bw * 0.5 - 0.6, pw - bw, 0.6); g.fillRect(px + pw - bw * 0.5 - 0.6, py + bw * 0.5, 0.6, ph - bw);
    }
  }
  // the frame's moulded edge and the parting bead
  g.strokeStyle = 'rgba(0,0,0,0.30)'; g.lineWidth = 0.6; g.strokeRect(x + f * 0.42, y + f * 0.42, w - f * 0.84, h - f * 0.84);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.strokeRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8);
  // horns, sash lift
  g.fillStyle = 'rgba(232,228,216,1)'; g.fillRect(x + f * 0.2, y + h / 2 + f / 2, f * 0.7, f * 0.9); g.fillRect(x + w - f * 0.9, y + h / 2 + f / 2, f * 0.7, f * 0.9);
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + f * 0.2, y + h / 2 + f * 1.4, f * 0.7, 0.6); g.fillRect(x + w - f * 0.9, y + h / 2 + f * 1.4, f * 0.7, 0.6);
  g.fillStyle = 'rgba(150,120,50,0.9)'; g.fillRect(x + w * 0.3, y + h - f * 0.72, w * 0.07, f * 0.3); g.fillRect(x + w * 0.63, y + h - f * 0.72, w * 0.07, f * 0.3);
}
/** Leaded lights (small diamond panes). */
function leaded(g, x, y, w, h) {
  g.strokeStyle = 'rgba(20,20,20,0.5)'; g.lineWidth = 1;
  g.beginPath();
  for (let d = -h; d < w + h; d += 7) { g.moveTo(x + d, y); g.lineTo(x + d + h * 0.6, y + h); g.moveTo(x + d, y + h); g.lineTo(x + d + h * 0.6, y); }
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.beginPath();
  for (let d = -h; d < w + h; d += 7) { g.moveTo(x + d, y); g.lineTo(x + d + h * 0.6, y + h); g.moveTo(x + d, y + h); g.lineTo(x + d + h * 0.6, y); }
  g.stroke();
  if (HI.on) {
    // texture pass 2 (top tier): the lead cames have a lit edge, the quarries differ (old crown glass: some greener,
    // some clearer, a few replaced), and saddle bars cross the light every 45 cm
    g.strokeStyle = 'rgba(210,215,220,0.22)'; g.lineWidth = 0.35; g.translate(0.45, -0.3); g.stroke(); g.translate(-0.45, 0.3);
    for (let i = 0; i < (w * h) / 60; i++) {
      const v = Math.sin((x + i) * 12.9898 + (y + i * 3) * 78.233) * 43758.5453, r = v - Math.floor(v), v2 = Math.sin(i * 39.34 + x) * 9631.1, r2 = v2 - Math.floor(v2);
      const cx = x + r * w, cy = y + r2 * h;
      g.fillStyle = r2 < 0.3 ? 'rgba(170,200,170,0.10)' : r2 < 0.6 ? 'rgba(255,255,255,0.08)' : 'rgba(0,8,16,0.12)';
      g.beginPath(); g.moveTo(cx, cy - 5.8); g.lineTo(cx + 3.5, cy); g.lineTo(cx, cy + 5.8); g.lineTo(cx - 3.5, cy); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(18,18,20,0.55)'; for (let by = y + 36; by < y + h - 8; by += 38) g.fillRect(x, by, w, 1.1);
  }
  g.restore();
}
function surround(g, x, y, w, h, t, col) {
  g.fillStyle = col; g.fillRect(x - t, y - t, w + 2 * t, t); g.fillRect(x - t, y, t, h); g.fillRect(x + w, y, t, h);
}
function stringCourse(g, S, base) {
  fill(g, shade(base, 1.07), 0, S - 10, S, 7); fill(g, 'rgba(40,30,15,0.35)', 0, S - 3, S, 3); fill(g, 'rgba(255,250,235,0.25)', 0, S - 10, S, 2);
  // the course of the storey above throws a soft shadow onto the top of this one
  const sg = g.createLinearGradient(0, 0, 0, 13); sg.addColorStop(0, 'rgba(40,30,15,0.26)'); sg.addColorStop(1, 'rgba(40,30,15,0)'); g.fillStyle = sg; g.fillRect(0, 0, S, 13);
}
/**
 * College window: stone mullions (and transom) under a hood mould with dropped label stops, leaded lights, optionally
 * with arched (Perpendicular) heads; chamfered frame, shadowed head, sloping sill with a soft shadow beneath.
 */
function mullioned(g, a, x, y, w, h, lights, transom, arched) {
  fill(g, shade(STONE, 1.1), x - 13, y - 17, w + 26, 8); fill(g, 'rgba(255,250,235,0.32)', x - 13, y - 17, w + 26, 2); fill(g, 'rgba(40,30,15,0.42)', x - 11, y - 9, w + 22, 3.5);
  fill(g, shade(STONE, 1.1), x - 13, y - 17, 8, 32); fill(g, shade(STONE, 1.1), x + w + 5, y - 17, 8, 32);
  fill(g, 'rgba(40,30,15,0.3)', x - 5, y - 9, 2, 24); fill(g, 'rgba(40,30,15,0.3)', x + w + 13, y - 17, 2, 32);
  fill(g, shade(STONE, 1.05), x - 5, y - 5, w + 10, h + 10);
  fill(g, 'rgba(40,30,15,0.28)', x - 5, y + h + 4, w + 10, 1.5); fill(g, 'rgba(255,250,235,0.25)', x + w + 3.5, y - 5, 1.5, h + 10);
  const mw = 7, lw = (w - (lights - 1) * mw) / lights;
  for (let i = 0; i < lights; i++) {
    const lx = x + i * (lw + mw);
    g.save(); a.save();
    if (arched) { archPath(g, lx, y, lw, h, lw * 0.5); g.clip(); archPath(a, lx, y, lw, h, lw * 0.5); a.clip(); }
    else { g.beginPath(); g.rect(lx, y, lw, h); g.clip(); }
    glassFill(g, a, lx, y, lw, h); fill(g, 'rgba(22,26,32,0.28)', lx, y, lw, h); leaded(g, lx, y, lw, h);
    const hg = g.createLinearGradient(0, y, 0, y + 12); hg.addColorStop(0, 'rgba(0,0,0,0.5)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hg; g.fillRect(lx, y, lw, arched ? 22 : 12);
    fill(g, 'rgba(0,0,0,0.3)', lx, y, 3, h);
    g.restore(); a.restore();
    if (i > 0) fill(g, 'rgba(255,250,235,0.2)', lx - mw, y, 1.5, h);
  }
  if (transom) { plain(g, a, shade(STONE, 1.04), x, y + h * 0.4, w, 6); fill(g, 'rgba(0,0,0,0.3)', x, y + h * 0.4 + 6, w, 2.5); }
  fill(g, shade(STONE, 1.13), x - 9, y + h + 5, w + 18, 7); fill(g, 'rgba(255,250,235,0.3)', x - 9, y + h + 5, w + 18, 1.5);
  const sg = g.createLinearGradient(0, y + h + 12, 0, y + h + 28); sg.addColorStop(0, 'rgba(40,30,16,0.36)'); sg.addColorStop(1, 'rgba(40,30,16,0)'); g.fillStyle = sg; g.fillRect(x - 9, y + h + 12, w + 18, 16);
}
function door(g, a, x, y, w, h, fanlight) {
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x - 3, y - 3, w + 6, h + 3);
  let dy = y;
  if (fanlight) {
    const fh = w * 0.45;
    glassFill(g, a, x, y, w, fh);
    g.fillStyle = '#eeeae0'; g.fillRect(x, y + fh - 3, w, 3); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(x, y + fh - 3, w, 3);
    for (let i = 1; i < 5; i++) { g.fillRect(x + (w * i) / 5 - 1, y, 2, fh); a.fillRect(x + (w * i) / 5 - 1, y, 2, fh); }
    dy = y + fh;
  }
  const dh = y + h - dy;
  g.fillStyle = 'rgb(205,205,205)'; g.fillRect(x, dy, w, dh); // paint mask: coloured in shader
  a.fillStyle = 'rgb(0,0,255)'; a.fillRect(x, dy, w, dh);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  const px = x + w * 0.14, pw = w * 0.3;
  for (const ox of [px, x + w * 0.56]) { g.fillRect(ox, dy + dh * 0.08, pw, dh * 0.36); g.fillRect(ox, dy + dh * 0.52, pw, dh * 0.4); }
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (const ox of [px, x + w * 0.56]) { g.fillRect(ox, dy + dh * 0.08, pw, 2); g.fillRect(ox, dy + dh * 0.52, pw, 2); }
  g.fillStyle = '#c9a74a'; g.fillRect(x + w * 0.47, dy + dh * 0.5, 4, 4); // brass knob
  if (HI.on) doorFine(g, a, x, dy, w, dh, px, pw);
}
/**
 * Texture pass 2 (top tier only): a panelled front door seen from the step — raised-and-fielded panels (a bevel lit
 * from the upper left, the field proud of it), the stiles' and rails' joints, a brass letter plate with its slot, a
 * knocker, a round knob on a rose, a keyhole, the weather bar and the worn foot of the door. Brass is kept out of the
 * paint mask (aux black: the shader's door colour does not tint it).
 */
function doorFine(g, a, x, dy, w, dh, px, pw) {
  const panels = [];
  for (const ox of [px, x + w * 0.56]) { panels.push([ox, dy + dh * 0.08, pw, dh * 0.36]); panels.push([ox, dy + dh * 0.52, pw, dh * 0.4]); }
  for (const [ax, ay, aw, ah] of panels) {
    const b = Math.min(aw, ah) * 0.16;
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(ax, ay, aw, 0.9); g.fillRect(ax, ay, 0.9, ah);                       // sunk moulding: shadow top / left
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(ax, ay + ah - 0.8, aw, 0.8); g.fillRect(ax + aw - 0.8, ay, 0.8, ah);
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(ax + b, ay + b, aw - 2 * b, ah - 2 * b);                         // the raised field
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(ax + b, ay + b, aw - 2 * b, 0.7); g.fillRect(ax + b, ay + b, 0.7, ah - 2 * b);
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(ax + b, ay + ah - b - 0.7, aw - 2 * b, 0.7); g.fillRect(ax + aw - b - 0.7, ay + b, 0.7, ah - 2 * b);
  }
  // joints of stiles and rails, the meeting of door and frame
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x + w * 0.5 - 0.3, dy + dh * 0.08, 0.6, dh * 0.36); g.fillRect(x + w * 0.5 - 0.3, dy + dh * 0.52, 0.6, dh * 0.4);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, dy, 0.9, dh); g.fillRect(x + w - 0.9, dy, 0.9, dh); g.fillRect(x, dy, w, 0.9);
  { const kg = g.createLinearGradient(0, dy + dh * 0.9, 0, dy + dh); kg.addColorStop(0, 'rgba(0,0,0,0)'); kg.addColorStop(1, 'rgba(30,24,16,0.34)'); g.fillStyle = kg; g.fillRect(x, dy + dh * 0.9, w, dh * 0.1); }
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, dy + dh - 1.6, w, 1.6);                                                // weather bar's shadow
  // ironmongery (not painted: out of the paint mask)
  const brass = (bx, by, bw2, bh2, col = '#b99a45') => { g.fillStyle = col; g.fillRect(bx, by, bw2, bh2); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(bx, by, bw2, bh2); };
  const my = dy + dh * 0.47;
  brass(x + w * 0.36, my - 1.6, w * 0.28, 3.4); g.fillStyle = 'rgba(20,14,6,0.85)'; g.fillRect(x + w * 0.39, my - 0.35, w * 0.22, 1.0);   // letter plate and slot
  g.fillStyle = 'rgba(255,240,190,0.5)'; g.fillRect(x + w * 0.36, my - 1.6, w * 0.28, 0.5);
  brass(x + w * 0.485, dy + dh * 0.27, w * 0.03, 5.2); brass(x + w * 0.47, dy + dh * 0.27 + 4.4, w * 0.06, 1.5);                              // knocker
  a.fillStyle = 'rgb(0,0,0)'; a.beginPath(); a.arc(x + w * 0.9, my + 5, 2.4, 0, 7); a.fill();
  g.fillStyle = '#8f7630'; g.beginPath(); g.arc(x + w * 0.9, my + 5, 2.4, 0, 7); g.fill(); g.fillStyle = '#d8bc68'; g.beginPath(); g.arc(x + w * 0.9 - 0.5, my + 4.5, 1.5, 0, 7); g.fill();   // knob on its rose
  brass(x + w * 0.888, my + 10, w * 0.024, 3.2, '#a08638'); g.fillStyle = 'rgba(10,8,4,0.9)'; g.fillRect(x + w * 0.896, my + 11, w * 0.008, 1.6);            // keyhole
}

// ---------------------------------------------------------------- facade atlas cells (draw in local S×S coords; top = top of storey)
const FACADE_PAINTERS = [
  // 0 stone sash
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 24, 0, 0, N); stringCourse(g, S, STONE);
    const ww = S * 0.36, wh = S * 0.6, x = (S - ww) / 2, y = S * 0.16;
    surround(g, x, y, ww, wh, 9, shade(STONE, 1.08));
    fill(g, shade(STONE, 1.12), x - 14, y + wh, ww + 28, 8); fill(g, 'rgba(0,0,0,0.3)', x - 14, y + wh + 8, ww + 28, 3); // sill
    fill(g, shade(STONE, 1.1), x + ww / 2 - 8, y - 14, 16, 14); // keystone
    const st = g.createLinearGradient(0, y + wh + 11, 0, S); st.addColorStop(0, 'rgba(60,48,30,0.22)'); st.addColorStop(1, 'rgba(60,48,30,0)');
    g.fillStyle = st; for (let i = 0; i < 4; i++) g.fillRect(x - 10 + rng() * (ww + 10), y + wh + 11, 3 + rng() * 6, S - y - wh - 11); // rain streaks under the sill
    sash(g, a, x, y, ww, wh, 3, 2);
  },
  // 1 stone door (with fanlight + pilasters)
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 24, 0, 0, N);
    const w = S * 0.36, h = S * 0.78, x = (S - w) / 2, y = S - h;
    fill(g, shade(STONE, 1.08), x - 18, y - 22, w + 36, 16); // entablature
    fill(g, shade(STONE, 1.05), x - 16, y - 6, 12, h + 6); fill(g, shade(STONE, 1.05), x + w + 4, y - 6, 12, h + 6);
    door(g, a, x, y, w, h, true);
    fill(g, shade(STONE, 0.85), x - 20, S - 6, w + 40, 6); // step
  },
  // 2 stone gothic (tall pointed window with tracery, buttress shading at the edges)
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 14, 0, 0, N);
    fill(g, 'rgba(60,40,10,0.18)', 0, 0, 16, S); fill(g, 'rgba(60,40,10,0.18)', S - 16, 0, 16, S);
    fill(g, 'rgba(255,245,220,0.15)', 16, 0, 4, S);
    const w = S * 0.44, x = (S - w) / 2, top = S * 0.07, bot = S * 0.9;
    const arch = (inset) => {
      g.beginPath();
      g.moveTo(x + inset, bot); g.lineTo(x + inset, top + w * 0.55);
      g.quadraticCurveTo(x + inset, top + inset * 1.2, S / 2, top + inset);
      g.quadraticCurveTo(x + w - inset, top + inset * 1.2, x + w - inset, top + w * 0.55);
      g.lineTo(x + w - inset, bot); g.closePath();
    };
    g.fillStyle = shade(STONE, 1.08); arch(-8); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.4)'; arch(-2); g.fill();
    const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#6f8090'); gr.addColorStop(0.45, '#4c5b6a'); gr.addColorStop(1, '#333e4a');
    g.fillStyle = gr; arch(0); g.fill();
    a.fillStyle = 'rgb(255,0,0)'; a.beginPath(); a.moveTo(x, bot); a.lineTo(x, top + w * 0.55);
    a.quadraticCurveTo(x, top, S / 2, top); a.quadraticCurveTo(x + w, top, x + w, top + w * 0.55); a.lineTo(x + w, bot); a.closePath(); a.fill();
    leaded(g, x, top, w, bot - top);
    g.fillStyle = shade(STONE, 1.0); a.fillStyle = 'rgb(0,0,0)';
    for (const f of [1 / 3, 2 / 3]) { g.fillRect(x + w * f - 3, top + w * 0.3, 6, bot - top - w * 0.3); a.fillRect(x + w * f - 3, top + w * 0.3, 6, bot - top - w * 0.3); }
    g.fillRect(x, top + (bot - top) * 0.55, w, 5); a.fillRect(x, top + (bot - top) * 0.55, w, 5);
    g.strokeStyle = shade(STONE, 1.0); g.lineWidth = 5;
    g.beginPath(); g.arc(S / 2, top + w * 0.36, w * 0.16, 0, Math.PI * 2); g.stroke();
    fill(g, shade(STONE, 1.1), x - 10, bot, w + 20, 7);
  },
  // 3 stone ashlar blank
  (g, a, S, rng, N) => { ashlar(g, S, rng, STONE, 24, 0, 0, N); },
  // 4 stone tudor (square-headed 3-light mullion window with hood mould)
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 22, 0, 0, N); stringCourse(g, S, STONE);
    mullioned(g, a, S * 0.22, S * 0.2, S * 0.56, S * 0.5, 3, true, false);
  },
  // 5 brick sash (Victorian 2-over-2, stone sill, gauged brick lintel)
  (g, a, S, rng, N) => {
    brickwork(g, S, rng, BRICK, 7, 22, N);
    const ww = S * 0.38, wh = S * 0.56, x = (S - ww) / 2, y = S * 0.2;
    fill(g, 'rgb(156,98,76)', x - 8, y - 18, ww + 16, 18); // lintel
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < ww + 16; i += 6) g.fillRect(x - 8 + i, y - 18, 0.8, 18);
    fill(g, 'rgb(214,206,190)', x - 10, y + wh, ww + 20, 9); fill(g, 'rgba(0,0,0,0.3)', x - 10, y + wh + 9, ww + 20, 3);
    sash(g, a, x, y, ww, wh, 1, 1);
  },
  // 6 brick door (painted panel door, fanlight, step)
  (g, a, S, rng, N) => {
    brickwork(g, S, rng, BRICK, 7, 22, N);
    const w = S * 0.36, h = S * 0.8, x = (S - w) / 2, y = S - h;
    fill(g, 'rgb(150,92,70)', x - 8, y - 16, w + 16, 16);
    door(g, a, x, y, w, h, true);
    fill(g, 'rgb(150,148,140)', x - 12, S - 6, w + 24, 6);
  },
  // 7 brick blank
  (g, a, S, rng, N) => { brickwork(g, S, rng, BRICK, 7, 22, N); },
  // 8 render sash (moulded architrave)
  (g, a, S, rng, N) => {
    render(g, S, RENDER, N);
    fill(g, 'rgba(255,255,255,0.4)', 0, S - 12, S, 6); fill(g, 'rgba(0,0,0,0.12)', 0, S - 6, S, 3);
    const ww = S * 0.38, wh = S * 0.58, x = (S - ww) / 2, y = S * 0.17;
    surround(g, x, y, ww, wh, 8, 'rgba(255,255,255,0.55)');
    fill(g, 'rgba(255,255,255,0.7)', x - 12, y + wh, ww + 24, 8); fill(g, 'rgba(0,0,0,0.2)', x - 12, y + wh + 8, ww + 24, 3);
    sash(g, a, x, y, ww, wh, 3, 2);
  },
  // 9 render door
  (g, a, S, rng, N) => {
    render(g, S, RENDER, N);
    const w = S * 0.34, h = S * 0.78, x = (S - w) / 2, y = S - h;
    surround(g, x, y, w, h, 10, 'rgba(255,255,255,0.6)');
    door(g, a, x, y, w, h, true);
  },
  // 10 shopfront (fascia band + display window + stall riser; fascia/riser/pilasters take a per-shop paint colour)
  (g, a, S, rng, N) => {
    render(g, S, RENDER, N);
    const paint = (x, y, w, h, k = 205) => { g.fillStyle = rgb(k, k, k); g.fillRect(x, y, w, h); a.fillStyle = 'rgb(0,0,255)'; a.fillRect(x, y, w, h); };
    paint(0, 0, S, S * 0.2, 215); // fascia
    fill(g, 'rgba(0,0,0,0.35)', 0, S * 0.2, S, 4); fill(g, 'rgba(255,255,255,0.35)', 0, 2, S, 3);
    paint(0, S * 0.2, 14, S * 0.8, 190); paint(S - 14, S * 0.2, 14, S * 0.8, 190); // pilasters
    paint(14, S * 0.86, S - 28, S * 0.14, 175); // stall riser
    glassFill(g, a, 16, S * 0.24, S - 32, S * 0.6);
    g.fillStyle = 'rgb(60,60,60)'; a.fillStyle = 'rgb(0,0,0)';
    g.fillRect(16, S * 0.36, S - 32, 3); a.fillRect(16, S * 0.36, S - 32, 3); // transom
    g.fillRect(S / 2 - 2, S * 0.24, 4, S * 0.6); a.fillRect(S / 2 - 2, S * 0.24, 4, S * 0.6);
    // goods silhouettes behind glass
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(${150 + rng() * 100},${120 + rng() * 100},${100 + rng() * 100},0.25)`; g.fillRect(20 + rng() * (S - 60), S * 0.55 + rng() * S * 0.25, 10 + rng() * 22, 10 + rng() * 26); }
  },
  // 11 post-war brick block (building facts, 2026-11; was the old shop door, which nothing drew): a strip window from
  // edge to edge of the bay — neighbouring bays join into one ribbon — between a concrete lintel band and a sill band,
  // slim metal mullions and a transom
  (g, a, S, rng, N) => {
    brickwork(g, S, rng, BRICK, 7, 22, N);
    const y = S * 0.3, h = S * 0.36;
    fill(g, 'rgb(196,192,182)', 0, y - 10, S, 10); fill(g, 'rgba(0,0,0,0.25)', 0, y - 1.5, S, 1.5);
    glassFill(g, a, 0, y, S, h); fill(g, 'rgba(22,26,32,0.25)', 0, y, S, h);
    g.fillStyle = '#5c6066'; a.fillStyle = 'rgb(0,0,0)';
    for (const [x, w] of [[0, 2], [S * 0.25 - 2, 4], [S * 0.5 - 2, 4], [S * 0.75 - 2, 4], [S - 2, 2]]) { g.fillRect(x, y, w, h); a.fillRect(x, y, w, h); }
    g.fillRect(0, y + h * 0.3, S, 2.5); a.fillRect(0, y + h * 0.3, S, 2.5);
    fill(g, 'rgb(204,200,190)', 0, y + h, S, 8); fill(g, 'rgba(0,0,0,0.3)', 0, y + h + 8, S, 3);
  },
  // 12 glass curtain wall
  (g, a, S, rng) => {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#5d7286'); gr.addColorStop(0.6, '#34465a'); gr.addColorStop(1, '#2a3646');
    g.fillStyle = gr; g.fillRect(0, 0, S, S); a.fillStyle = 'rgb(255,0,0)'; a.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(S * 0.15, 0, S * 0.2, S);
    g.fillStyle = '#9aa0a6'; a.fillStyle = 'rgb(0,0,0)';
    g.fillRect(0, 0, 6, S); a.fillRect(0, 0, 6, S); g.fillRect(S / 2 - 2, 0, 4, S); a.fillRect(S / 2 - 2, 0, 4, S);
    g.fillRect(0, S - 26, S, 26); a.fillRect(0, S - 26, S, 26); // spandrel
    g.fillStyle = '#7e858c'; g.fillRect(0, S - 26, S, 3);
  },
  // 13 concrete with ribbon window
  (g, a, S, rng, N) => {
    render(g, S, CONCRETE, N);
    for (let i = 0; i < 4; i++) fill(g, 'rgba(0,0,0,0.06)', 0, (i * S) / 4, S, 1);
    const y = S * 0.28, h = S * 0.44;
    glassFill(g, a, 0, y, S, h);
    g.fillStyle = '#50565c'; a.fillStyle = 'rgb(0,0,0)';
    for (const x of [0, S / 3, (2 * S) / 3]) { g.fillRect(x, y, 5, h); a.fillRect(x, y, 5, h); }
    fill(g, 'rgba(0,0,0,0.25)', 0, y + h, S, 4);
  },
  // 14 concrete blank
  (g, a, S, rng, N) => { render(g, S, CONCRETE, N); for (let i = 0; i < 3; i++) fill(g, 'rgba(0,0,0,0.07)', 0, (i * S) / 3, S, 1); fill(g, 'rgba(0,0,0,0.07)', S / 2, 0, 1, S); },
  // 15 render blank
  (g, a, S, rng, N) => { render(g, S, RENDER, N); },
];

let _bare = null;
const BARE_SET = () => _bare || (_bare = new Set(ASHLAR_SHADER_CELLS.map((k) => FACADE_CELLS[k])));
function paintAtlas(N, size, painters, withAux, seed, rows = N, auxSize = size) {
  // painters draw in a logical 256-unit cell; the canvas may be larger (k = device px per logical unit)
  const S = size / N, H = S * rows, k = S / 256, Sa = auxSize / N, ka = Sa / 256;
  const { c: cm, g } = mkCanvas(size, H);
  let ca = null, a = null;
  if (withAux) { ({ c: ca, g: a } = mkCanvas(auxSize, Sa * rows)); a.fillStyle = 'rgb(0,255,0)'; a.fillRect(0, 0, auxSize, Sa * rows); }
  const dummy = mkCanvas(4, 4).g;
  painters.forEach((fn, i) => {
    if (!fn) return;
    const cx = i % N, cy = Math.floor(i / N), ox = cx * S, oy = cy * S, rng = makeRng(seed + i * 97);
    const noise = (x, y, w, h, amp, blotch) => grain(g, Math.round(ox + x * k), Math.round(oy + y * k), Math.round(w * k), Math.round(h * k), amp, rng, blotch, 24 * k);
    g.save(); g.translate(ox, oy); g.scale(k, k); g.beginPath(); g.rect(0, 0, 256, 256); g.clip();
    const aa = a || dummy;
    BARE = HI.on && withAux && BARE_SET().has(i);
    aa.save(); if (a) { aa.translate(cx * Sa, cy * Sa); aa.scale(ka, ka); aa.beginPath(); aa.rect(0, 0, 256, 256); aa.clip(); }
    fn(g, aa, 256, rng, noise);
    BARE = false;
    aa.restore(); g.restore();
  });
  return { map: cm, aux: ca };
}

/** Parapet stone: small ashlar courses with a projecting coping at the top (u: 1 repeat = 2 m, v: parapet height). */
function parapetPainter(g, a, S, rng, N) {
  ashlar(g, S, rng, STONE, 32, 0, 0, N);
  // coping at the head
  fill(g, shade(STONE, 1.14), 0, 0, S, S * 0.15); fill(g, 'rgba(255,250,235,0.3)', 0, 0, S, 4);
  fill(g, 'rgba(40,30,15,0.42)', 0, S * 0.15, S, 5);
  const gr = g.createLinearGradient(0, S * 0.15, 0, S * 0.42); gr.addColorStop(0, 'rgba(40,30,15,0.22)'); gr.addColorStop(1, 'rgba(40,30,15,0)');
  g.fillStyle = gr; g.fillRect(0, S * 0.15, S, S * 0.27);
  // moulded cornice along the foot (the wall head): fillet, cavetto in shadow, lit bead
  fill(g, shade(STONE, 1.12), 0, S * 0.72, S, S * 0.1); fill(g, 'rgba(255,250,235,0.34)', 0, S * 0.72, S, 3);
  const cg = g.createLinearGradient(0, S * 0.82, 0, S); cg.addColorStop(0, 'rgba(36,26,12,0.55)'); cg.addColorStop(0.55, 'rgba(36,26,12,0.25)'); cg.addColorStop(1, 'rgba(36,26,12,0.4)');
  g.fillStyle = cg; g.fillRect(0, S * 0.82, S, S * 0.18);
  fill(g, shade(STONE, 1.08), 0, S * 0.9, S, 5);
}
/** Clipped hedge (yew/privet) for the city atlas: dense leaf clumps, darker towards the base (u, v: 2 m repeats). */
function hedgePainter(g, a, S, rng, N) {
  fill(g, '#2c4620', 0, 0, S, S);
  for (let i = 0; i < 2400; i++) {
    const y = rng() * S, k = (0.55 + rng() * 0.75) * (0.75 + 0.35 * (1 - y / S));
    g.fillStyle = rgb(56 * k, 92 * k, 38 * k, 0.9); g.beginPath(); g.ellipse(rng() * S, y, 2 + rng() * 3, 1.5 + rng() * 2, rng() * 3, 0, 7); g.fill();
  }
  N(0, 0, S, S, 10, 14);
}
// ---------------------------------------------------------------- pass-3 facade cells (cells NEW_WALL_OFS + i)
const paintM = (g, a, x, y, w, h, k = 205) => { g.fillStyle = rgb(k, k, k); g.fillRect(x, y, w, h); a.fillStyle = 'rgb(0,0,255)'; a.fillRect(x, y, w, h); };
const plain = (g, a, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(x, y, w, h); };
/** A shop window you can see into: dim interior with a lit back wall, shelves/goods, ceiling spots, a floor line. */
function shopGlass(g, a, x, y, w, h, rng, kind = 'goods') {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  // pass 6: by day a shop is lit inside — pale back wall, bright ceiling, darker floor (the shader multiplies glass by
  // ~0.4 seen square-on, so the old dark-brown interior came out navy under the blue sky reflection)
  gr.addColorStop(0, '#c9c2b0'); gr.addColorStop(0.2, '#b9b09c'); gr.addColorStop(0.8, '#9c9482'); gr.addColorStop(1, '#5e574c');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let i = 0; i < 4; i++) { const cx = x + w * (0.15 + 0.7 * rng()), r = 10 + rng() * 14; const sp = g.createRadialGradient(cx, y + 6, 0, cx, y + 6, r * 2.4); sp.addColorStop(0, 'rgba(255,236,190,0.55)'); sp.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = sp; g.fillRect(cx - r * 3, y, r * 6, r * 3); }
  if (kind === 'goods') {
    for (let s2 = 0; s2 < 3; s2++) {
      const sy = y + h * (0.3 + s2 * 0.2);
      g.fillStyle = 'rgba(60,48,36,0.8)'; g.fillRect(x + 4, sy + 16, w - 8, 2.5);
      for (let i = x + 6; i < x + w - 10;) { const bw = 5 + rng() * 11, bh = 6 + rng() * 11; g.fillStyle = `rgba(${70 + rng() * 185 | 0},${60 + rng() * 170 | 0},${50 + rng() * 160 | 0},0.92)`; g.fillRect(i, sy + 16 - bh, bw, bh); i += bw + 1.5 + rng() * 5; }
    }
  } else if (kind === 'cafe') {
    for (let i = 0; i < 3; i++) { const tx = x + w * (0.2 + i * 0.3); g.fillStyle = 'rgba(30,22,16,0.85)'; g.fillRect(tx - 9, y + h * 0.72, 18, 2.5); g.fillRect(tx - 1, y + h * 0.72, 2.5, h * 0.2); g.fillRect(tx - 17, y + h * 0.62, 5, h * 0.3); g.fillRect(tx + 12, y + h * 0.62, 5, h * 0.3); }
    g.fillStyle = 'rgba(240,225,190,0.5)'; g.fillRect(x + w * 0.1, y + h * 0.16, w * 0.8, 4); g.fillStyle = 'rgba(70,45,30,0.8)'; g.fillRect(x, y + h * 0.5, w, 2.5);
  } else {
    g.fillStyle = 'rgba(190,150,80,0.35)'; g.fillRect(x, y + h * 0.5, w, h * 0.2);   // pub: the glow of the bar back
    for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(${150 + rng() * 80 | 0},${100 + rng() * 70 | 0},40,0.6)`; g.fillRect(x + 6 + rng() * (w - 16), y + h * 0.42, 3, 9); }
  }
  if (HI.on) shopFine(g, x, y, w, h, rng, kind);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y, w, 5); g.fillRect(x, y, 4, h);                // reveal shadow
  g.fillStyle = 'rgba(190,210,230,0.10)'; g.beginPath(); g.moveTo(x + w * 0.1, y); g.lineTo(x + w * 0.38, y); g.lineTo(x + w * 0.12, y + h); g.lineTo(x - w * 0.16, y + h); g.closePath(); g.fill();   // glass sheen
  g.restore();
  a.fillStyle = 'rgb(255,0,0)'; a.fillRect(x, y, w, h);
}
/**
 * Texture pass 2 (top tier only): depth in a shop window. The room behind recedes (side walls and floor drawn in
 * perspective to a back wall, a doorway and a counter in it), each shelf has a lit front edge and throws a shadow, the
 * goods on it are boxes, bottles and jars with a lit side and a label, a window bed at the front carries the larger
 * things and their price tickets, pendant lamps hang in the window. No lettering, no brands.
 */
function shopFine(g, x, y, w, h, rng, kind) {
  // the room: back wall inset, floor and side walls as trapezia
  const bx = x + w * 0.2, by = y + h * 0.16, bw = w * 0.6, bh = h * 0.52;
  g.fillStyle = 'rgba(40,34,28,0.20)'; g.beginPath(); g.moveTo(x, y); g.lineTo(bx, by); g.lineTo(bx, by + bh); g.lineTo(x, y + h); g.closePath(); g.fill();
  g.fillStyle = 'rgba(40,34,28,0.12)'; g.beginPath(); g.moveTo(x + w, y); g.lineTo(bx + bw, by); g.lineTo(bx + bw, by + bh); g.lineTo(x + w, y + h); g.closePath(); g.fill();
  g.fillStyle = 'rgba(30,24,18,0.30)'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(bx, by + bh); g.lineTo(bx + bw, by + bh); g.lineTo(x + w, y + h); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,248,230,0.16)'; g.beginPath(); g.moveTo(x, y); g.lineTo(bx, by); g.lineTo(bx + bw, by); g.lineTo(x + w, y); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,24,18,0.35)'; g.lineWidth = 0.6; g.strokeRect(bx, by, bw, bh);
  if (kind !== 'cafe') { g.fillStyle = 'rgba(24,18,14,0.5)'; g.fillRect(bx + bw * 0.72, by + bh * 0.3, bw * 0.2, bh * 0.7); g.fillStyle = 'rgba(70,52,36,0.75)'; g.fillRect(bx + bw * 0.05, by + bh * 0.72, bw * 0.55, bh * 0.28); g.fillStyle = 'rgba(255,240,210,0.25)'; g.fillRect(bx + bw * 0.05, by + bh * 0.72, bw * 0.55, 1); }
  if (kind === 'goods') {
    // shelves: a lit lip, a shadow under each, goods with a lit side and a label
    for (let s2 = 0; s2 < 3; s2++) {
      const sy = y + h * (0.3 + s2 * 0.2) + 16;
      g.fillStyle = 'rgba(255,244,220,0.5)'; g.fillRect(x + 4, sy, w - 8, 0.7);
      const sg = g.createLinearGradient(0, sy + 2.5, 0, sy + 9); sg.addColorStop(0, 'rgba(0,0,0,0.32)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(x + 4, sy + 2.5, w - 8, 6.5);
      for (let i = x + 7; i < x + w - 12;) {
        const iw = 4 + rng() * 8, ih = 6 + rng() * 10, t = rng(), R = 60 + rng() * 170 | 0, G = 55 + rng() * 150 | 0, B = 45 + rng() * 140 | 0;
        if (t < 0.35) {                                   // a bottle or jar: shoulders, a cap, a glint
          g.fillStyle = `rgba(${R * 0.6 | 0},${G * 0.7 | 0},${B * 0.6 | 0},0.95)`; g.fillRect(i, sy - ih * 0.72, iw * 0.7, ih * 0.72); g.fillRect(i + iw * 0.22, sy - ih, iw * 0.26, ih * 0.3);
          g.fillStyle = 'rgba(240,235,220,0.9)'; g.fillRect(i + iw * 0.05, sy - ih * 0.5, iw * 0.6, ih * 0.26); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(i + iw * 0.08, sy - ih * 0.7, 0.6, ih * 0.6);
        } else {                                          // a box or tin: lit top and left, a band for the label
          g.fillStyle = `rgba(${R},${G},${B},0.96)`; g.fillRect(i, sy - ih, iw, ih);
          g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(i, sy - ih, iw, 0.7); g.fillRect(i, sy - ih, 0.7, ih);
          g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(i + iw - 0.8, sy - ih, 0.8, ih);
          g.fillStyle = t < 0.7 ? 'rgba(245,240,225,0.75)' : 'rgba(30,26,22,0.55)'; g.fillRect(i + iw * 0.15, sy - ih * 0.62, iw * 0.7, ih * 0.22);
        }
        i += iw + 0.8 + rng() * 3.5;
      }
    }
  }
  // the window bed: a board across the foot of the window with the larger things on it and their tickets
  const wy = y + h * 0.9;
  g.fillStyle = 'rgba(92,74,54,0.95)'; g.fillRect(x, wy, w, h * 0.1); g.fillStyle = 'rgba(255,240,210,0.35)'; g.fillRect(x, wy, w, 0.8);
  for (let i = x + 8; i < x + w - 20;) {
    const iw = 9 + rng() * 14, ih = 8 + rng() * 14, R = 70 + rng() * 150 | 0, G = 60 + rng() * 130 | 0, B = 50 + rng() * 120 | 0;
    if (kind === 'cafe') { g.fillStyle = 'rgba(236,230,214,0.95)'; g.beginPath(); g.ellipse(i + iw / 2, wy - 1.5, iw * 0.45, 1.6, 0, 0, 7); g.fill(); g.fillStyle = `rgba(${150 + rng() * 60 | 0},${100 + rng() * 50 | 0},60,0.95)`; g.beginPath(); g.ellipse(i + iw / 2, wy - 3.6, iw * 0.3, 2.6, 0, 0, 7); g.fill(); }
    else if (kind === 'goods') { g.fillStyle = `rgba(${R},${G},${B},0.97)`; g.fillRect(i, wy - ih, iw, ih); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(i, wy - ih, iw, 0.8); g.fillRect(i, wy - ih, 0.8, ih); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(i + iw - 1, wy - ih, 1, ih); g.fillStyle = 'rgba(250,248,240,0.95)'; g.fillRect(i + iw * 0.3, wy - 3.2, 4.2, 2.6); }
    { const sg = g.createLinearGradient(0, wy, 0, wy + 3); sg.addColorStop(0, 'rgba(0,0,0,0.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(i, wy + 0.8, iw, 3); }
    i += iw + 5 + rng() * 12;
  }
  // pendant lamps in the window
  for (let i = 0; i < 2; i++) { const lx = x + w * (0.3 + i * 0.4), ly = y + h * 0.13; g.fillStyle = 'rgba(20,18,16,0.8)'; g.fillRect(lx - 0.3, y, 0.6, ly - y); g.fillStyle = 'rgba(40,36,30,0.95)'; g.beginPath(); g.moveTo(lx - 4, ly + 3); g.lineTo(lx - 1.5, ly); g.lineTo(lx + 1.5, ly); g.lineTo(lx + 4, ly + 3); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,240,200,0.9)'; g.fillRect(lx - 3.2, ly + 3, 6.4, 0.9); }
}
function archPath(c, x, y, w, h, rise) { c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + rise); c.quadraticCurveTo(x, y, x + w / 2, y); c.quadraticCurveTo(x + w, y, x + w, y + rise); c.lineTo(x + w, y + h); c.closePath(); }
const NEW_PAINTERS = [
  // 24 stone, tall first-floor sash (piano nobile): moulded architrave, cornice hood on consoles, deep sill
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 24, 0, 0, N); stringCourse(g, S, STONE);
    const ww = S * 0.36, wh = S * 0.68, x = (S - ww) / 2, y = S * 0.17;
    surround(g, x, y, ww, wh, 11, shade(STONE, 1.1)); fill(g, 'rgba(50,38,20,0.25)', x - 12, y - 12, 1.5, wh + 12); fill(g, 'rgba(50,38,20,0.25)', x + ww + 10.5, y - 12, 1.5, wh + 12);
    fill(g, shade(STONE, 1.15), x - 20, y - 24, ww + 40, 9); fill(g, 'rgba(255,250,235,0.35)', x - 20, y - 24, ww + 40, 2); fill(g, 'rgba(40,30,15,0.45)', x - 18, y - 15, ww + 36, 4);
    fill(g, shade(STONE, 1.04), x - 15, y - 15, 7, 12); fill(g, shade(STONE, 1.04), x + ww + 8, y - 15, 7, 12);
    fill(g, shade(STONE, 1.14), x - 16, y + wh, ww + 32, 9); fill(g, 'rgba(0,0,0,0.32)', x - 16, y + wh + 9, ww + 32, 3.5);
    sash(g, a, x, y, ww, wh, 3, 3);
  },
  // 25 stone, rusticated ground floor with a round-headed sash
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 32, 0, 0, N);
    for (let y = 0; y < S; y += 32) { fill(g, 'rgba(40,30,14,0.5)', 0, y - 2, S, 4.5); fill(g, 'rgba(255,248,228,0.3)', 0, y + 2.5, S, 2); }
    for (let y = 0, r = 0; y < S; y += 32, r++) for (let x = (r % 2) * 40; x < S; x += 80) fill(g, 'rgba(40,30,14,0.4)', x, y + 2, 3, 28);
    const ww = S * 0.34, wh = S * 0.6, x = (S - ww) / 2, y = S * 0.2;
    g.fillStyle = shade(STONE, 1.06); archPath(g, x - 12, y - 12, ww + 24, wh + 12, ww * 0.55); g.fill();
    g.strokeStyle = 'rgba(50,38,20,0.45)'; g.lineWidth = 1.5;
    for (let i = 0; i <= 8; i++) { const an = Math.PI * (1 + i / 8), cx = x + ww / 2, cy = y + ww * 0.52; g.beginPath(); g.moveTo(cx + Math.cos(an) * ww * 0.5, cy + Math.sin(an) * ww * 0.52); g.lineTo(cx + Math.cos(an) * (ww * 0.5 + 13), cy + Math.sin(an) * (ww * 0.52 + 13)); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.4)'; archPath(g, x - 2, y - 2, ww + 4, wh + 2, ww * 0.52); g.fill();
    g.save(); archPath(g, x, y, ww, wh, ww * 0.5); g.clip(); sash(g, a, x, y, ww, wh, 3, 2); g.restore();
    a.fillStyle = 'rgb(0,255,0)'; a.fillRect(x - 1, y - 1, ww + 2, ww * 0.5); a.fillStyle = 'rgb(255,0,0)'; archPath(a, x + 3, y + 3, ww - 6, wh - 6, ww * 0.5); a.fill();
    fill(g, shade(STONE, 1.12), x - 12, y + wh, ww + 24, 8); fill(g, 'rgba(0,0,0,0.3)', x - 12, y + wh + 8, ww + 24, 3);
  },
  // 26 stone attic storey: small square sash
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 24, 0, 0, N);
    const ww = S * 0.34, wh = S * 0.44, x = (S - ww) / 2, y = S * 0.3;
    surround(g, x, y, ww, wh, 8, shade(STONE, 1.08));
    fill(g, shade(STONE, 1.12), x - 12, y + wh, ww + 24, 7); fill(g, 'rgba(0,0,0,0.3)', x - 12, y + wh + 7, ww + 24, 3);
    sash(g, a, x, y, ww, wh, 3, 1);
  },
  // 27 stone doorway: four-centred arch, studded oak door, hood mould with label stops
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 22, 0, 0, N);
    const w = S * 0.46, h = S * 0.82, x = (S - w) / 2, y = S - h;
    g.fillStyle = shade(STONE, 1.1); archPath(g, x - 14, y - 14, w + 28, h + 14, w * 0.3); g.fill();
    g.fillStyle = 'rgba(40,28,12,0.55)'; archPath(g, x - 4, y - 4, w + 8, h + 4, w * 0.28); g.fill();
    g.save(); archPath(g, x, y, w, h, w * 0.26); g.clip();
    fill(g, 'rgb(86,60,38)', x, y, w, h);
    for (let i = 0; i < 8; i++) { fill(g, 'rgba(0,0,0,0.3)', x + (w * i) / 8, y, 1.5, h); fill(g, `rgba(255,220,170,${0.03 + rng() * 0.06})`, x + (w * i) / 8 + 2, y, w / 8 - 3, h); }
    fill(g, 'rgba(0,0,0,0.5)', x + w / 2 - 1, y, 2.5, h);
    g.fillStyle = 'rgba(20,16,12,0.9)'; for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) g.fillRect(x + (w * (i + 0.5)) / 8 - 1.2, y + h * (0.14 + j * 0.19), 2.6, 2.6);
    fill(g, 'rgba(20,16,12,0.85)', x + 4, y + h * 0.3, w - 8, 4); fill(g, 'rgba(20,16,12,0.85)', x + 4, y + h * 0.72, w - 8, 4);
    g.restore();
    a.fillStyle = 'rgb(0,0,0)'; archPath(a, x, y, w, h, w * 0.26); a.fill();
    fill(g, shade(STONE, 1.13), x - 24, y - 26, w + 48, 7); fill(g, shade(STONE, 1.13), x - 24, y - 26, 7, 24); fill(g, shade(STONE, 1.13), x + w + 17, y - 26, 7, 24);
    fill(g, 'rgba(40,30,15,0.4)', x - 17, y - 19, w + 34, 3);
    fill(g, shade(STONE, 0.86), x - 22, S - 7, w + 44, 7);
  },
  // 28 red brick Georgian: 6-over-6 sash in white reveals, rubbed-brick flat arch, stone sill
  (g, a, S, rng, N) => {
    brickwork(g, S, rng, BRICK, 7, 22, N);
    const ww = S * 0.36, wh = S * 0.6, x = (S - ww) / 2, y = S * 0.18;
    g.fillStyle = 'rgb(196,120,84)'; g.beginPath(); g.moveTo(x - 12, y - 20); g.lineTo(x + ww + 12, y - 20); g.lineTo(x + ww + 4, y); g.lineTo(x - 4, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(240,225,200,0.55)'; g.lineWidth = 1; for (let i = 0; i <= 12; i++) { const t = i / 12; g.beginPath(); g.moveTo(x - 12 + (ww + 24) * t, y - 20); g.lineTo(x - 4 + (ww + 8) * t, y); g.stroke(); }
    plain(g, a, '#f0ece2', x - 4, y - 1, ww + 8, wh + 2);
    fill(g, 'rgb(220,212,196)', x - 12, y + wh, ww + 24, 9); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(x - 12, y + wh, ww + 24, 9); fill(g, 'rgba(0,0,0,0.32)', x - 12, y + wh + 9, ww + 24, 3);
    sash(g, a, x, y, ww, wh, 3, 2);
  },
  // 29 polychrome Victorian brick (north Oxford / Jericho): contrasting bands, segmental arch, 2-over-2 sash
  (g, a, S, rng, N) => {
    brickwork(g, S, rng, BRICK, 7, 22, N);
    for (const by of [28, 35, 196, 203]) fill(g, 'rgba(52,26,30,0.26)', 0, by + 0.6, S, 5.8);   // two-course bands of darker brick
    const ww = S * 0.36, wh = S * 0.58, x = (S - ww) / 2, y = S * 0.2;
    for (let i = 0; i < 11; i++) { const t0 = i / 11, t1 = (i + 1) / 11, ax = x - 10 + (ww + 20) * t0, bx = x - 10 + (ww + 20) * t1, ay = y - 6 - Math.sin(t0 * Math.PI) * 12, by2 = y - 6 - Math.sin(t1 * Math.PI) * 12; g.fillStyle = i % 2 ? 'rgb(218,200,150)' : 'rgb(150,84,66)'; g.beginPath(); g.moveTo(ax, ay - 14); g.lineTo(bx, by2 - 14); g.lineTo(bx, by2 + 2); g.lineTo(ax, ay + 2); g.closePath(); g.fill(); }
    fill(g, 'rgba(0,0,0,0.3)', x - 2, y - 16, ww + 4, 16);
    g.save(); archPath(g, x, y - 14, ww, wh + 14, 14); g.clip(); sash(g, a, x, y - 14, ww, wh + 14, 2, 1); g.restore();
    a.fillStyle = 'rgb(0,255,0)'; a.fillRect(x - 2, y - 16, ww + 4, 8);
    fill(g, 'rgb(214,206,190)', x - 12, y + wh, ww + 24, 10); a.fillStyle = 'rgb(0,0,0)'; a.fillRect(x - 12, y + wh, ww + 24, 10); fill(g, 'rgba(0,0,0,0.32)', x - 12, y + wh + 10, ww + 24, 3);
  },
  // 30 brick, paired sashes under one stone lintel with a stone mullion
  (g, a, S, rng, N) => {
    brickwork(g, S, rng, BRICK, 7, 22, N);
    const ww = S * 0.6, wh = S * 0.56, x = (S - ww) / 2, y = S * 0.2;
    plain(g, a, 'rgb(216,208,192)', x - 8, y - 18, ww + 16, 18); fill(g, 'rgba(0,0,0,0.25)', x - 8, y - 2, ww + 16, 2);
    plain(g, a, 'rgb(216,208,192)', x - 10, y + wh, ww + 20, 10); fill(g, 'rgba(0,0,0,0.32)', x - 10, y + wh + 10, ww + 20, 3);
    sash(g, a, x, y, ww * 0.46, wh, 1, 1); sash(g, a, x + ww * 0.54, y, ww * 0.46, wh, 1, 1);
    plain(g, a, 'rgb(216,208,192)', x + ww * 0.46, y, ww * 0.08, wh);
  },
  // 31 stucco Georgian: 6-over-6 sash, moulded hood
  (g, a, S, rng, N) => {
    render(g, S, RENDER, N);
    fill(g, 'rgba(255,255,255,0.4)', 0, S - 12, S, 6); fill(g, 'rgba(0,0,0,0.14)', 0, S - 6, S, 3);
    const ww = S * 0.36, wh = S * 0.62, x = (S - ww) / 2, y = S * 0.17;
    surround(g, x, y, ww, wh, 9, 'rgba(255,255,255,0.6)');
    fill(g, 'rgba(255,255,255,0.75)', x - 16, y - 20, ww + 32, 8); fill(g, 'rgba(0,0,0,0.22)', x - 14, y - 12, ww + 28, 3);
    fill(g, 'rgba(255,255,255,0.75)', x - 13, y + wh, ww + 26, 8); fill(g, 'rgba(0,0,0,0.22)', x - 13, y + wh + 8, ww + 26, 3);
    sash(g, a, x, y, ww, wh, 3, 2);
  },
  // 32 traditional timber shopfront: fascia + cornice, panelled pilasters, mullioned display window, stall riser
  // (photo comparison item 9: the fascia is the top 15 % of the storey, about 0.55 m, not a fifth; the glass rises to meet it)
  (g, a, S, rng, N) => {
    paintM(g, a, 0, 0, S, S, 200);
    paintM(g, a, 0, 0, S, S * 0.15, 218); fill(g, 'rgba(255,255,255,0.3)', 0, 0, S, 5); fill(g, 'rgba(0,0,0,0.4)', 0, S * 0.15 - 4, S, 5); fill(g, 'rgba(0,0,0,0.18)', 0, 5, S, 2);
    fill(g, 'rgba(0,0,0,0.22)', 3, S * 0.19, 10, S * 0.65); fill(g, 'rgba(255,255,255,0.14)', 3, S * 0.19, 10, 2); fill(g, 'rgba(0,0,0,0.22)', S - 13, S * 0.19, 10, S * 0.65);
    shopGlass(g, a, 18, S * 0.185, S - 36, S * 0.665, rng, 'goods');
    g.fillStyle = 'rgb(214,214,214)'; a.fillStyle = 'rgb(0,0,255)';
    for (const f of [1 / 3, 2 / 3]) { g.fillRect(18 + (S - 36) * f - 2, S * 0.185, 4, S * 0.665); a.fillRect(18 + (S - 36) * f - 2, S * 0.185, 4, S * 0.665); }
    g.fillRect(18, S * 0.3, S - 36, 3.5); a.fillRect(18, S * 0.3, S - 36, 3.5);
    paintM(g, a, 16, S * 0.85, S - 32, S * 0.15, 178); fill(g, 'rgba(0,0,0,0.25)', 24, S * 0.875, S - 48, S * 0.09); fill(g, 'rgba(255,255,255,0.12)', 24, S * 0.875, S - 48, 2);
    fill(g, 'rgba(0,0,0,0.35)', 16, S * 0.85, S - 32, 3);
  },
  // 33 modern shopfront: full-height glazing in a slim metal frame, plain fascia
  (g, a, S, rng, N) => {
    paintM(g, a, 0, 0, S, S * 0.16, 222); fill(g, 'rgba(0,0,0,0.4)', 0, S * 0.16 - 3, S, 4);
    plain(g, a, '#3a3d40', 0, S * 0.16, S, S * 0.84);
    shopGlass(g, a, 6, S * 0.18, S - 12, S * 0.76, rng, 'goods');
    plain(g, a, '#5a5e62', S / 2 - 2, S * 0.18, 4, S * 0.76);
    plain(g, a, '#2c2e30', 0, S * 0.94, S, S * 0.06);
  },
  // 34 recessed shop doorway: dark lobby, glazed door, tiled threshold
  (g, a, S, rng, N) => {
    paintM(g, a, 0, 0, S, S, 200);
    paintM(g, a, 0, 0, S, S * 0.15, 218); fill(g, 'rgba(255,255,255,0.3)', 0, 0, S, 5); fill(g, 'rgba(0,0,0,0.4)', 0, S * 0.15 - 4, S, 5);
    shopGlass(g, a, 14, S * 0.185, S * 0.26, S * 0.665, rng, 'goods'); shopGlass(g, a, S * 0.74 - 14 + 14, S * 0.185, S * 0.26 - 14, S * 0.665, rng, 'goods');
    paintM(g, a, 14, S * 0.85, S * 0.26, S * 0.15, 178); paintM(g, a, S * 0.74, S * 0.85, S * 0.26 - 14, S * 0.15, 178);
    plain(g, a, '#16130f', S * 0.3, S * 0.185, S * 0.4, S * 0.815);
    const lg = g.createLinearGradient(S * 0.3, 0, S * 0.7, 0); lg.addColorStop(0, 'rgba(0,0,0,0.55)'); lg.addColorStop(0.3, 'rgba(0,0,0,0)'); lg.addColorStop(0.7, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.55)');
    paintM(g, a, S * 0.36, S * 0.3, S * 0.28, S * 0.66, 150);
    shopGlass(g, a, S * 0.385, S * 0.33, S * 0.23, S * 0.42, rng, 'pub');
    g.fillStyle = lg; g.fillRect(S * 0.3, S * 0.185, S * 0.4, S * 0.815);
    fill(g, '#c9a74a', S * 0.6, S * 0.64, 3, 16);
    for (let i = 0; i < 8; i++) fill(g, i % 2 ? '#8a8478' : '#3a3632', S * 0.3 + (S * 0.4 * i) / 8, S * 0.965, S * 0.05, S * 0.035);
  },
  // 35 pub front: dark joinery, small-paned windows with etched lower lights, brass rail, tiled stall riser
  (g, a, S, rng, N) => {
    paintM(g, a, 0, 0, S, S, 196);
    paintM(g, a, 0, 0, S, S * 0.16, 214); fill(g, 'rgba(255,255,255,0.3)', 0, 0, S, 4); fill(g, 'rgba(0,0,0,0.42)', 0, S * 0.16 - 4, S, 5);
    for (const [x0, w0] of [[20, S * 0.36], [S - 20 - S * 0.36, S * 0.36]]) {
      shopGlass(g, a, x0, S * 0.27, w0, S * 0.5, rng, 'pub');
      g.fillStyle = 'rgba(225,230,225,0.34)'; g.fillRect(x0, S * 0.52, w0, S * 0.25);
      g.fillStyle = 'rgb(212,212,212)'; a.fillStyle = 'rgb(0,0,255)';
      for (let i = 1; i < 4; i++) { g.fillRect(x0 + (w0 * i) / 4 - 1.5, S * 0.27, 3, S * 0.5); a.fillRect(x0 + (w0 * i) / 4 - 1.5, S * 0.27, 3, S * 0.5); }
      for (const f of [0.3, 0.5]) { g.fillRect(x0, S * 0.27 + S * 0.5 * f, w0, 3); a.fillRect(x0, S * 0.27 + S * 0.5 * f, w0, 3); }
      plain(g, a, '#c9a74a', x0 - 2, S * 0.52, w0 + 4, 2.5);
    }
    plain(g, a, '#1d3a2c', 12, S * 0.82, S - 24, S * 0.18);
    for (let x = 12; x < S - 12; x += 15) fill(g, 'rgba(255,255,255,0.14)', x, S * 0.82, 1.2, S * 0.18);
    fill(g, 'rgba(255,255,255,0.14)', 12, S * 0.9, S - 24, 1.2); fill(g, 'rgba(0,0,0,0.35)', 12, S * 0.82, S - 24, 3);
  },
  // 36 café front: big panes, half curtain rail, menu card, low riser
  (g, a, S, rng, N) => {
    paintM(g, a, 0, 0, S, S, 202);
    paintM(g, a, 0, 0, S, S * 0.15, 220); fill(g, 'rgba(255,255,255,0.3)', 0, 0, S, 4); fill(g, 'rgba(0,0,0,0.4)', 0, S * 0.15 - 4, S, 5);
    shopGlass(g, a, 14, S * 0.185, S - 28, S * 0.695, rng, 'cafe');
    g.fillStyle = 'rgb(214,214,214)'; a.fillStyle = 'rgb(0,0,255)'; g.fillRect(S / 2 - 2, S * 0.185, 4, S * 0.695); a.fillRect(S / 2 - 2, S * 0.185, 4, S * 0.695);
    plain(g, a, '#efe9d8', S * 0.62, S * 0.42, S * 0.16, S * 0.22); for (let i = 0; i < 7; i++) fill(g, 'rgba(40,40,40,0.5)', S * 0.64, S * 0.45 + i * 6.5, S * 0.12 * (0.5 + rng() * 0.5), 1.6);
    paintM(g, a, 14, S * 0.88, S - 28, S * 0.12, 176); fill(g, 'rgba(0,0,0,0.35)', 14, S * 0.88, S - 28, 3);
  },
  // 37 timber-framed jettied upper storey: black studs, cream panels, leaded casement
  (g, a, S, rng, N) => {
    render(g, S, [238, 230, 208], N);
    const tim = (x, y, w, h) => plain(g, a, '#2a2420', x, y, w, h);
    tim(0, 0, S, 14); tim(0, S - 16, S, 16); fill(g, 'rgba(0,0,0,0.4)', 0, S - 3, S, 3);
    for (const x of [0, 40, 84, 160, 204, S - 12]) tim(x, 0, 12, S);
    tim(0, S * 0.56, 84, 10); tim(172, S * 0.56, 84, 10);
    g.strokeStyle = '#2a2420'; g.lineWidth = 9; g.beginPath(); g.moveTo(10, S * 0.58); g.lineTo(44, S - 16); g.moveTo(S - 10, S * 0.58); g.lineTo(S - 44, S - 16); g.stroke();
    a.strokeStyle = 'rgb(0,0,0)'; a.lineWidth = 9; a.beginPath(); a.moveTo(10, S * 0.58); a.lineTo(44, S - 16); a.moveTo(S - 10, S * 0.58); a.lineTo(S - 44, S - 16); a.stroke();
    const x = 96, y = S * 0.2, w = 64, h = S * 0.44;
    glassFill(g, a, x, y, w, h); leaded(g, x, y, w, h);
    tim(x - 6, y - 6, w + 12, 6); tim(x - 6, y + h, w + 12, 8); tim(x + w / 2 - 2, y, 4, h);
  },
  // 38 flat painted joinery (fascias, hoods, boards): paint mask, faint panel mouldings
  (g, a, S, rng, N) => {
    paintM(g, a, 0, 0, S, S, 214);
    fill(g, 'rgba(255,255,255,0.28)', 0, 0, S, 6); fill(g, 'rgba(0,0,0,0.3)', 0, S - 8, S, 8);
    for (let i = 0; i < 6; i++) fill(g, `rgba(0,0,0,${0.02 + rng() * 0.03})`, 0, rng() * S, S, 2 + rng() * 5);
  },
  // 39 garage / store door: vertical boards, paint mask, lintel
  (g, a, S, rng, N) => {
    brickwork(g, S, rng, BRICK, 7, 22, N);
    plain(g, a, 'rgb(170,166,158)', 14, S * 0.14, S - 28, 14);
    paintM(g, a, 20, S * 0.2, S - 40, S * 0.8, 200);
    for (let x = 20; x < S - 20; x += 18) { fill(g, 'rgba(0,0,0,0.25)', x, S * 0.2, 1.5, S * 0.8); fill(g, 'rgba(255,255,255,0.1)', x + 2, S * 0.2, 1.5, S * 0.8); }
    fill(g, 'rgba(0,0,0,0.4)', 20, S * 0.2, S - 40, 4); fill(g, '#6a6a68', S / 2 - 5, S * 0.62, 10, 4);
  },
  // 40 awning canvas: stripes of the shop's paint colour and cream (u across the stripes)
  (g, a, S, rng, N) => {
    plain(g, a, '#ece4cf', 0, 0, S, S);
    for (let i = 0; i < 4; i++) paintM(g, a, i * 64, 0, 32, S, 205);
    N(0, 0, S, S, 5, 5);
    const sh = g.createLinearGradient(0, 0, 0, S); sh.addColorStop(0, 'rgba(0,0,0,0.0)'); sh.addColorStop(1, 'rgba(0,0,0,0.16)'); g.fillStyle = sh; g.fillRect(0, 0, S, S);
  },
  // 41 dormer front: white-painted casement in a lead-cheeked dormer
  (g, a, S, rng, N) => {
    plain(g, a, '#e9e6de', 0, 0, S, S);
    fill(g, 'rgba(0,0,0,0.18)', 0, 0, S, 10); fill(g, 'rgba(0,0,0,0.12)', 0, S - 14, S, 14);
    sash(g, a, 34, 34, S - 68, S - 78, 2, 2);
  },
  // 42 dressed stone band (cornices, plinths, sills, string courses): fine joints only
  (g, a, S, rng, N) => {
    fill(g, shade(STONE, 1.06), 0, 0, S, S); N(0, 0, S, S, 7, 9);
    for (let x = rng() * 60; x < S; x += 70 + rng() * 50) fill(g, 'rgba(60,45,22,0.3)', x, 0, 1.5, S);
    fill(g, 'rgba(255,250,235,0.28)', 0, 0, S, 10); fill(g, 'rgba(40,30,15,0.3)', 0, S - 22, S, 22);
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(70,60,40,0.07)'; g.fillRect(rng() * S, 0, 2 + rng() * 5, S); }
  },
  // 43 dark metal / painted iron (gutters, downpipes, brackets): untinted
  (g, a, S, rng, N) => { plain(g, a, '#24262a', 0, 0, S, S); N(0, 0, S, S, 6, 4); fill(g, 'rgba(255,255,255,0.10)', 0, 0, S * 0.3, S); for (let y = 60; y < S; y += 120) fill(g, 'rgba(0,0,0,0.5)', 0, y, S, 5); },
  // 44 college ground floor: a chamfered plinth, a two-light mullioned window set high
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 22, 0, 0, N);
    const py = S - 58;
    fill(g, 'rgba(70,56,34,0.16)', 0, py, S, 58);
    fill(g, shade(STONE, 1.12), 0, py - 5, S, 6); fill(g, 'rgba(255,250,235,0.35)', 0, py - 5, S, 2); fill(g, 'rgba(36,26,12,0.42)', 0, py + 1, S, 3.5);
    { const sg = g.createLinearGradient(0, py + 4, 0, py + 20); sg.addColorStop(0, 'rgba(36,26,12,0.24)'); sg.addColorStop(1, 'rgba(36,26,12,0)'); g.fillStyle = sg; g.fillRect(0, py + 4, S, 16); }
    { const lg = g.createLinearGradient(0, S - 34, 0, S); lg.addColorStop(0, 'rgba(70,86,48,0)'); lg.addColorStop(1, 'rgba(60,74,44,0.3)'); g.fillStyle = lg; g.fillRect(0, S - 34, S, 34); }
    fill(g, 'rgba(36,26,12,0.3)', 0, S - 4, S, 4);
    mullioned(g, a, S * 0.27, S * 0.17, S * 0.46, S * 0.4, 2, false, false);
  },
  // 45 college upper floor: two arched (Perpendicular) lights under a square hood
  (g, a, S, rng, N) => { ashlar(g, S, rng, STONE, 22, 0, 0, N); stringCourse(g, S, STONE); mullioned(g, a, S * 0.26, S * 0.2, S * 0.48, S * 0.52, 2, false, true); },
  // 46 college upper floor, wide: four lights with a transom (halls, libraries)
  (g, a, S, rng, N) => { ashlar(g, S, rng, STONE, 22, 0, 0, N); stringCourse(g, S, STONE); mullioned(g, a, S * 0.14, S * 0.19, S * 0.72, S * 0.54, 4, true, false); },
  // 47 plaster gable of a town front (building facts, 2026-11; was the college's plain bay, now stoneBlank): mapped
  // once per gable as cell 52 is — u across it, v from the eaves to the apex — plain render with a small-paned casement
  // low in the gable
  (g, a, S, rng, N) => { render(g, S, RENDER, N); sash(g, a, S * 0.37, S * 0.5, S * 0.26, S * 0.28, 2, 3); fill(g, 'rgba(40,30,15,0.22)', 0, S - 4, S, 4); },
  // 48 hanging-sign boards (pass 7): four boards per cell, each the unit's paint colour with a gilt line border and a
  // generic painted device — star, bell, anchor, rose (traditional sign devices; no lettering, nobody's trade mark)
  (g, a, S, rng, N) => {
    const H2 = S / 2, gilt = '#d8b45c', dark = 'rgba(0,0,0,0.3)';
    const both = (fn) => { g.fillStyle = gilt; g.strokeStyle = gilt; fn(g); a.fillStyle = 'rgb(0,0,0)'; a.strokeStyle = 'rgb(0,0,0)'; fn(a); };
    for (let q = 0; q < 4; q++) {
      const ox = (q % 2) * H2, oy = (q >> 1) * H2, cx = ox + H2 / 2, cy = oy + H2 / 2;
      paintM(g, a, ox, oy, H2, H2, 208);
      fill(g, 'rgba(255,255,255,0.22)', ox, oy, H2, 3); fill(g, dark, ox, oy + H2 - 4, H2, 4);
      both((c) => { c.lineWidth = 3; c.strokeRect(ox + 9, oy + 9, H2 - 18, H2 - 18); });
      if (q === 0) both((c) => { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 15 : 36, t = -Math.PI / 2 + (i * Math.PI) / 5; c.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r); } c.closePath(); c.fill(); });
      else if (q === 1) both((c) => {
        c.beginPath(); c.moveTo(cx - 9, cy - 30); c.quadraticCurveTo(cx - 22, cy - 22, cx - 24, cy + 6); c.quadraticCurveTo(cx - 25, cy + 18, cx - 36, cy + 24); c.lineTo(cx + 36, cy + 24); c.quadraticCurveTo(cx + 25, cy + 18, cx + 24, cy + 6); c.quadraticCurveTo(cx + 22, cy - 22, cx + 9, cy - 30); c.closePath(); c.fill();
        c.beginPath(); c.arc(cx, cy + 31, 6, 0, 7); c.fill(); c.fillRect(cx - 4, cy - 38, 8, 9);
      });
      else if (q === 2) both((c) => {
        c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, cy - 26); c.lineTo(cx, cy + 32); c.moveTo(cx - 17, cy - 14); c.lineTo(cx + 17, cy - 14); c.stroke();
        c.beginPath(); c.arc(cx, cy + 4, 28, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke();
        c.lineWidth = 5; c.beginPath(); c.arc(cx, cy - 33, 7, 0, 7); c.stroke(); c.lineCap = 'butt';
      });
      else {
        both((c) => { for (let i = 0; i < 5; i++) { const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5; c.beginPath(); c.arc(cx + Math.cos(t) * 19, cy + Math.sin(t) * 19, 15, 0, 7); c.fill(); } });
        g.fillStyle = 'rgba(120,40,30,0.85)'; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
      }
    }
    N(0, 0, S, S, 5, 4);
  },
  // 49 boarded garden gate (pass 7): the house's paint colour, ledges and a latch, a shaped top rail
  (g, a, S, rng, N) => {
    paintM(g, a, 0, 0, S, S, 204);
    for (let x = 0; x < S; x += 32) { fill(g, 'rgba(0,0,0,0.3)', x, 0, 2, S); fill(g, 'rgba(255,255,255,0.12)', x + 3, 0, 2, S); }
    fill(g, 'rgba(255,255,255,0.25)', 0, 0, S, 7); fill(g, 'rgba(0,0,0,0.22)', 0, 7, S, 4);
    for (const y of [S * 0.2, S * 0.74]) { fill(g, 'rgba(255,255,255,0.1)', 0, y, S, 18); fill(g, 'rgba(0,0,0,0.3)', 0, y + 18, S, 4); }
    plain(g, a, '#26272a', S - 46, S * 0.44, 30, 9); plain(g, a, '#26272a', 8, S * 0.2 + 3, 26, 11); plain(g, a, '#26272a', 8, S * 0.74 + 3, 26, 11);
    fill(g, 'rgba(60,70,40,0.25)', 0, S - 22, S, 22);
    N(0, 0, S, S, 6, 5);
  },
  // 50 coursed rubble (stone pass, photo comparison item 3): Oxford's boundary walls, the flanks and backs of ashlar-
  // fronted buildings and the older ranges are roughly squared rubble brought to courses: stones of every size and a
  // grey-buff-to-honey range in thick lime joints. Wraps in u (each stone drawn at x and x - S) and in v (courses add to S).
  (g, a, S, rng, N) => {
    fill(g, '#857b6a', 0, 0, S, S);
    const hs = []; let yy = 0;
    while (S - yy > 34) { const h = 12 + rng() * 16; hs.push(h); yy += h; }
    hs.push(S - yy);
    let y = 0;
    for (const ch of hs) {
      let x = rng() * 20;
      const x0 = x;
      while (x < S + x0 - 10) {
        const w = Math.min(S + x0 - x, ch * (0.9 + rng() * 2.2)), t = 0.82 + rng() * 0.3, warm = rng(), dark = rng() < 0.1 ? 0.8 : 1;
        const c = [(150 + 40 * warm) * t * dark, (142 + 30 * warm) * t * dark, (126 + 12 * warm) * t * dark];
        for (const o of [0, -S]) {
          g.fillStyle = rgb(...c); g.beginPath();
          const j = () => (rng() - 0.5) * 2.4;
          g.moveTo(x + o + 1.3 + j(), y + 1.3 + j()); g.lineTo(x + o + w - 1.3 + j(), y + 1.3 + j()); g.lineTo(x + o + w - 1.3 + j(), y + ch - 1.3 + j()); g.lineTo(x + o + 1.3 + j(), y + ch - 1.3 + j()); g.closePath(); g.fill();
          fill(g, 'rgba(255,248,228,0.12)', x + o + 2, y + 1.6, w - 4, 1);
          fill(g, 'rgba(36,30,20,0.2)', x + o + 2, y + ch - 2.6, w - 4, 1.2);
        }
        if (rng() < 0.18) { g.fillStyle = `rgba(86,94,62,${0.1 + rng() * 0.14})`; g.beginPath(); g.ellipse(x + rng() * w, y + rng() * ch, 2 + rng() * 6, 1.5 + rng() * 3, 0, 0, 7); g.fill(); }
        x += w;
      }
      y += ch;
    }
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(52,48,40,${rng() * 0.07})`; g.fillRect(rng() * S, 0, 3 + rng() * 10, S); }
    N(0, 0, S, S, 7, 8);
  },
  // roofscape / college-front pass (2026-11, photo comparison items 2 and 4): four cells for the old fronts
  // 51 college two-light: a square-headed two-light stone-mullioned window under a hood mould with label stops
  (g, a, S, rng, N) => { ashlar(g, S, rng, STONE, 22, 0, 0, N); stringCourse(g, S, STONE); mullioned(g, a, S * 0.3, S * 0.24, S * 0.4, S * 0.44, 2, false, false); },
  // 52 college attic gable (mapped once per gable: u across it, v from the eaves to the apex): a two-light window under
  // a hood low in the gable, a small blind quatrefoil above it
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 20, 0, 0, N);
    mullioned(g, a, S * 0.32, S * 0.48, S * 0.36, S * 0.3, 2, false, false);
    g.strokeStyle = 'rgba(60,46,24,0.42)'; g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S * 0.3, 9, 0, 7); g.stroke();
    fill(g, 'rgba(40,30,15,0.3)', 0, S - 5, S, 5);
  },
  // 53 tall round-headed window (Jackson's Radcliffe Science Library, Hawksmoor's Clarendon): archivolt and keystone,
  // impost band, a mullion and a transom at the springing, small panes
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 22, 0, 0, N);
    const x = S * 0.27, w = S * 0.46, top = S * 0.08, bot = S * 0.88, r = w / 2;
    g.fillStyle = shade(STONE, 1.1); archPath(g, x - 10, top - 10, w + 20, bot - top + 10, r + 10); g.fill();
    g.fillStyle = 'rgba(40,30,15,0.45)'; archPath(g, x - 2, top - 2, w + 4, bot - top + 2, r + 2); g.fill();
    g.save(); a.save(); archPath(g, x, top, w, bot - top, r); g.clip(); archPath(a, x, top, w, bot - top, r); a.clip();
    glassFill(g, a, x, top, w, bot - top); fill(g, 'rgba(22,26,32,0.22)', x, top, w, bot - top);
    g.fillStyle = '#d9d2c0'; a.fillStyle = 'rgb(0,0,0)';
    for (let k = 1; k < 4; k++) { g.fillRect(x + (w * k) / 4 - 1, top, 2, bot - top); a.fillRect(x + (w * k) / 4 - 1, top, 2, bot - top); }
    for (let y = top + r + 24; y < bot; y += 24) { g.fillRect(x, y, w, 2); a.fillRect(x, y, w, 2); }
    plain(g, a, shade(STONE, 1.04), S / 2 - 4, top, 8, bot - top); plain(g, a, shade(STONE, 1.04), x, top + r - 3, w, 7);
    const hg = g.createLinearGradient(0, top, 0, top + 30); hg.addColorStop(0, 'rgba(0,0,0,0.45)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hg; g.fillRect(x, top, w, 30);
    g.restore(); a.restore();
    fill(g, shade(STONE, 1.14), S / 2 - 9, top - 14, 18, 20); fill(g, 'rgba(40,30,15,0.3)', S / 2 - 9, top + 6, 18, 2);   // keystone
    fill(g, shade(STONE, 1.08), x - 16, top + r - 6, 16, 8); fill(g, shade(STONE, 1.08), x + w, top + r - 6, 16, 8);      // imposts
    fill(g, shade(STONE, 1.13), x - 12, bot, w + 24, 8); fill(g, 'rgba(0,0,0,0.3)', x - 12, bot + 8, w + 24, 3);
  },
  // 54 Venetian Gothic pair (Christ Church's Meadow Building, Deane & Woodward 1862-66): two pointed lights on a
  // central colonnette under a pointed hood of banded voussoirs, a sill band on corbels
  (g, a, S, rng, N) => {
    ashlar(g, S, rng, STONE, 18, 0, 0, N); stringCourse(g, S, STONE);
    const x = S * 0.26, w = S * 0.48, top = S * 0.16, bot = S * 0.8, lw = w * 0.44;
    const pt = (c, xx, ww, i) => { c.beginPath(); c.moveTo(xx - i, bot); c.lineTo(xx - i, top + ww * 0.75); c.quadraticCurveTo(xx - i, top - i, xx + ww / 2, top - i * 1.4); c.quadraticCurveTo(xx + ww + i, top - i, xx + ww + i, top + ww * 0.75); c.lineTo(xx + ww + i, bot); c.closePath(); };
    for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? 'rgba(150,70,50,0.5)' : shade(STONE, 1.12); g.save(); pt(g, x, w, 14 - k * 0.2); g.clip(); g.beginPath(); g.moveTo(S / 2, top + w * 0.4); g.arc(S / 2, top + w * 0.4, S, Math.PI + (k / 9) * Math.PI, Math.PI + ((k + 1) / 9) * Math.PI); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle = shade(STONE, 1.03); pt(g, x, w, 2); g.fill();
    for (const lx of [x, x + w - lw]) {
      g.fillStyle = 'rgba(40,30,15,0.5)'; pt(g, lx, lw, 1.5); g.fill();
      g.save(); a.save(); pt(g, lx, lw, 0); g.clip(); pt(a, lx, lw, 0); a.clip();
      glassFill(g, a, lx, top, lw, bot - top); fill(g, 'rgba(22,26,32,0.25)', lx, top, lw, bot - top); leaded(g, lx, top, lw, bot - top);
      g.restore(); a.restore();
    }
    fill(g, '#8a8f8a', S / 2 - 3, top + w * 0.5, 6, bot - top - w * 0.5); fill(g, shade(STONE, 1.12), S / 2 - 6, top + w * 0.48, 12, 6);   // colonnette and capital
    fill(g, shade(STONE, 1.13), x - 14, bot, w + 28, 9); fill(g, 'rgba(0,0,0,0.3)', x - 14, bot + 9, w + 28, 3);
    for (const cx of [x - 8, S / 2 - 4, x + w]) fill(g, shade(STONE, 1.05), cx, bot + 9, 8, 10);
  },
  // 55 villa gable (houses pass, 2026-11, photo comparison item 17: woodstock_rd, norham): the brick gable a North Oxford
  // villa turns to the street (mapped once per gable: u across it, v from the eaves to the apex): a pointed two-light
  // window with a stone sill and shafted mullion, a polychrome relieving arch over it, and white-painted bargeboards
  // along both rakes (untinted). The brick takes the building's tint (red or yellow).
  (g, a, S, rng, N) => {
    brickwork(g, S, rng, BRICK, 7, 22, N);
    for (const by of [S * 0.82, S * 0.82 + 7]) fill(g, 'rgba(52,26,30,0.24)', 0, by, S, 5.8);
    const w = S * 0.4, x = (S - w) / 2, top = S * 0.4, bot = S * 0.78, lw = w * 0.45;
    const pt = (c, xx, ww, i) => { c.beginPath(); c.moveTo(xx - i, bot); c.lineTo(xx - i, top + ww * 0.7); c.quadraticCurveTo(xx - i, top - i, xx + ww / 2, top - i * 1.5); c.quadraticCurveTo(xx + ww + i, top - i, xx + ww + i, top + ww * 0.7); c.lineTo(xx + ww + i, bot); c.closePath(); };
    for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? 'rgba(226,206,160,0.9)' : 'rgba(120,52,40,0.9)'; g.save(); pt(g, x, w, 13); g.clip(); g.beginPath(); g.moveTo(S / 2, top + w * 0.45); g.arc(S / 2, top + w * 0.45, S, Math.PI + (k / 9) * Math.PI, Math.PI + ((k + 1) / 9) * Math.PI); g.closePath(); g.fill(); g.restore(); }
    for (const lx of [x, x + w - lw]) {
      g.fillStyle = 'rgba(40,30,15,0.5)'; pt(g, lx, lw, 1.5); g.fill();
      g.save(); a.save(); pt(g, lx, lw, 0); g.clip(); pt(a, lx, lw, 0); a.clip();
      glassFill(g, a, lx, top, lw, bot - top); fill(g, 'rgba(22,26,32,0.22)', lx, top, lw, bot - top);
      g.fillStyle = '#ece8de'; a.fillStyle = 'rgb(0,0,0)'; g.fillRect(lx, top + (bot - top) * 0.55, lw, 3); a.fillRect(lx, top + (bot - top) * 0.55, lw, 3);
      g.restore(); a.restore();
    }
    plain(g, a, 'rgb(214,206,190)', S / 2 - 3, top + w * 0.3, 6, bot - top - w * 0.3);
    plain(g, a, 'rgb(214,206,190)', x - 12, bot, w + 24, 9); fill(g, 'rgba(0,0,0,0.32)', x - 12, bot + 9, w + 24, 3);
    // bargeboards: a white board along each rake (inside the triangle: the corners of the cell outside it are never drawn)
    const bb = 15;
    for (const c of [g, a]) {
      c.fillStyle = c === g ? '#ebe7dc' : 'rgb(0,0,0)';
      c.beginPath(); c.moveTo(0, S); c.lineTo(S / 2, 0); c.lineTo(S / 2, bb * 1.3); c.lineTo(bb * 1.1, S); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(S, S); c.lineTo(S / 2, 0); c.lineTo(S / 2, bb * 1.3); c.lineTo(S - bb * 1.1, S); c.closePath(); c.fill();
    }
    g.strokeStyle = 'rgba(40,30,20,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(bb * 1.1, S); g.lineTo(S / 2, bb * 1.3); g.lineTo(S - bb * 1.1, S); g.stroke();
    // a small finial at the apex
    plain(g, a, '#ebe7dc', S / 2 - 4, 0, 8, bb * 2);
  },
];

/** Every cell of the city atlas, index = cell number (facade cells, roofs, parapet, hedge, pass-3 cells). */
/** Tower top stage: a two-light louvred bell opening under a hood mould, and a clock dial below it (generic: blue face, gilt numerals ring and hands). */
function belfryPainter(g, a, S, rng, N) {
  ashlar(g, S, rng, STONE, 20, 0, 0, N);
  fill(g, shade(STONE, 1.1), 0, S - 14, S, 9); fill(g, 'rgba(40,30,15,0.4)', 0, S - 5, S, 5);          // string course at the foot
  const w = S * 0.4, x = (S - w) / 2, top = S * 0.06, bot = S * 0.56;
  const arch = (i) => { g.beginPath(); g.moveTo(x + i, bot); g.lineTo(x + i, top + w * 0.5); g.quadraticCurveTo(x + i, top + i * 1.2, S / 2, top + i); g.quadraticCurveTo(x + w - i, top + i * 1.2, x + w - i, top + w * 0.5); g.lineTo(x + w - i, bot); g.closePath(); };
  g.fillStyle = shade(STONE, 1.1); arch(-9); g.fill();
  g.fillStyle = 'rgba(30,20,8,0.5)'; arch(-3); g.fill();
  g.fillStyle = '#1b1814'; arch(3); g.fill();
  g.save(); arch(3); g.clip();
  for (let y = top; y < bot; y += 9) { fill(g, '#5b5346', x, y, w, 4.5); fill(g, 'rgba(255,240,210,0.16)', x, y, w, 1.2); }   // louvres
  g.restore();
  fill(g, shade(STONE, 1.06), S / 2 - 4, top + 26, 8, bot - top - 26);                                  // mullion
  fill(g, shade(STONE, 1.12), x - 12, bot, w + 24, 7); fill(g, 'rgba(0,0,0,0.3)', x - 12, bot + 7, w + 24, 3);
  const cx = S / 2, cy = S * 0.77, r = S * 0.135;
  g.fillStyle = 'rgba(30,20,8,0.45)'; g.beginPath(); g.arc(cx + 2, cy + 3, r + 5, 0, 7); g.fill();
  g.fillStyle = shade(STONE, 1.12); g.beginPath(); g.arc(cx, cy, r + 5, 0, 7); g.fill();
  g.fillStyle = '#1c2c4e'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.strokeStyle = '#d2b058'; g.lineWidth = 2.2; g.beginPath(); g.arc(cx, cy, r - 3, 0, 7); g.stroke();
  for (let i = 0; i < 12; i++) { const t = (i / 12) * 6.2832; g.lineWidth = i % 3 ? 1.2 : 2.4; g.beginPath(); g.moveTo(cx + Math.cos(t) * (r - 5), cy + Math.sin(t) * (r - 5)); g.lineTo(cx + Math.cos(t) * (r - 11), cy + Math.sin(t) * (r - 11)); g.stroke(); }
  g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + r * 0.42, cy - r * 0.3); g.stroke();
  g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - r * 0.12, cy - r * 0.74); g.stroke();
}
function cityPainters() {
  const P = [...FACADE_PAINTERS, ...ROOF_PAINTERS, parapetPainter, stoneSlatePainter, hedgePainter, belfryPainter];
  NEW_PAINTERS.forEach((fn, i) => { P[NEW_WALL_OFS + i] = fn; });
  return P;
}
export function makeFacadeAtlas() {
  if (PRE.facade) return PRE.facade;
  const size = ATLAS.cell * 4;
  const { map, aux } = paintAtlas(4, size, cityPainters(), true, 11, FACADE_ROWS, HI.on ? HI.aux : 1024);
  return { map: canvasTexture(map, { anisotropy: 8 }), aux: canvasTexture(aux, { linear: true, anisotropy: 8 }) };
}

// ---------------------------------------------------------------- roofs (2×2, 256 px cells)
const ROOF_PAINTERS = [
  // slate: staggered rows, blue-grey
  (g, a, S, rng, N) => {
    fill(g, '#4b5058', 0, 0, S, S);
    const rows = 10, rh = S / rows, sw = S / 7;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? sw / 2 : 0;
      for (let x = -sw; x < S + sw; x += sw) {
        const k = 0.85 + rng() * 0.3; g.fillStyle = rgb(78 * k, 84 * k, 94 * k); g.fillRect(x + off + 1, r * rh, sw - 2, rh - 1);
      }
      fill(g, 'rgba(0,0,0,0.45)', 0, r * rh + rh - 2, S, 2);
    }
    N(0, 0, S, S, 8, 6);
  },
  // clay plain tiles
  (g, a, S, rng, N) => {
    fill(g, '#7a3f2c', 0, 0, S, S);
    const rows = 16, rh = S / rows, tw = S / 12;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? tw / 2 : 0;
      for (let x = -tw; x < S + tw; x += tw) { const k = 0.8 + rng() * 0.35; g.fillStyle = rgb(150 * k, 78 * k, 54 * k); g.fillRect(x + off + 1, r * rh, tw - 1, rh - 1); }
      fill(g, 'rgba(30,10,0,0.45)', 0, r * rh + rh - 2, S, 2);
    }
    N(0, 0, S, S, 10, 12);
  },
  // lead with rolls
  (g, a, S, rng, N) => {
    fill(g, '#8a8f93', 0, 0, S, S); N(0, 0, S, S, 6, 14);
    for (let x = 0; x < S; x += S / 4) { fill(g, 'rgba(255,255,255,0.25)', x, 0, 3, S); fill(g, 'rgba(0,0,0,0.3)', x + 3, 0, 4, S); }
    for (let y = 0; y < S; y += S / 2) fill(g, 'rgba(0,0,0,0.15)', 0, y, S, 2);
  },
  // flat felt / gravel
  (g, a, S, rng, N) => {
    fill(g, '#6f6e6a', 0, 0, S, S); N(0, 0, S, S, 22, 16);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, rng() * S, S, 1 + rng() * 2); }
  },
];
/** Cotswold stone slates (college roofs): graduated courses, lichen-mottled buff-grey. */
function stoneSlatePainter(g, a, S, rng, N) {
  fill(g, '#6a6252', 0, 0, S, S);
  let y = 0, r = 0;
  while (y < S) {
    const rh = 12 + (y / S) * 14, sw = rh * 1.25, off = r % 2 ? sw / 2 : 0;
    for (let x = -sw; x < S + sw; x += sw) { const k = 0.82 + rng() * 0.34, w = sw * (0.8 + rng() * 0.4); g.fillStyle = rgb(150 * k, 138 * k, 112 * k); g.fillRect(x + off + 1, y, w - 1.5, rh - 1); }
    fill(g, 'rgba(20,14,0,0.5)', 0, y + rh - 2, S, 2); fill(g, 'rgba(255,245,220,0.12)', 0, y, S, 1);
    y += rh; r++;
  }
  for (let i = 0; i < 70; i++) { g.fillStyle = rng() < 0.6 ? 'rgba(120,125,70,0.22)' : 'rgba(60,55,45,0.2)'; g.beginPath(); g.ellipse(rng() * S, rng() * S, 4 + rng() * 10, 3 + rng() * 6, rng() * 3, 0, 7); g.fill(); }
  N(0, 0, S, S, 10, 10);
}
export function makeRoofAtlas() { return { map: canvasTexture(paintAtlas(2, 512, ROOF_PAINTERS, false, 33).map) }; }

// ---------------------------------------------------------------- ground (4×4, 256 px cells)
function speckle(g, S, rng, n, cols, size = 2) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[(rng() * cols.length) | 0]; const s = size * (0.5 + rng()); g.fillRect(rng() * S, rng() * S, s, s); }
}
function grassBase(g, S, rng, N, base, blades) {
  fill(g, rgb(...base), 0, 0, S, S); N(0, 0, S, S, 14, 14);
  for (let i = 0; i < blades; i++) {
    const k = 0.7 + rng() * 0.6; g.fillStyle = rgb(base[0] * k, base[1] * k, base[2] * k, 0.7);
    g.fillRect(rng() * S, rng() * S, 1, 2 + rng() * 4);
  }
}
/** Soft low-contrast patches (clover, moss, dry spots), kept clear of the cell edge so repeats do not show a seam. */
function patches(g, S, rng, n, cols, r0, r1) {
  for (let i = 0; i < n; i++) {
    const r = r0 + rng() * (r1 - r0), x = r + rng() * (S - 2 * r), y = r + rng() * (S - 2 * r);
    const gr = g.createRadialGradient(x, y, 0, x, y, r), c = cols[(rng() * cols.length) | 0];
    gr.addColorStop(0, c.replace('A', '1')); gr.addColorStop(0.6, c.replace('A', '0.5')); gr.addColorStop(1, c.replace('A', '0'));
    g.globalAlpha = 0.5 + rng() * 0.5; g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.globalAlpha = 1;
}
/** Worn margins of a path through grass (cells mapped along the path): trodden earth, then tufts of the verge. */
function wornEdges(g, S, rng, depth) {
  for (const top of [true, false]) {
    const gr = g.createLinearGradient(0, top ? 0 : S, 0, top ? depth : S - depth);
    gr.addColorStop(0, 'rgba(84,78,48,0.95)'); gr.addColorStop(0.35, 'rgba(102,86,58,0.8)'); gr.addColorStop(1, 'rgba(110,92,62,0)');
    g.fillStyle = gr; g.fillRect(0, top ? 0 : S - depth, S, depth);
    for (let i = 0; i < 150; i++) {
      const d = Math.pow(rng(), 1.8) * depth * 1.15, x = rng() * S, y = top ? d : S - d, k = 0.75 + rng() * 0.5;
      g.fillStyle = rng() < 0.75 ? rgb(78 * k, 112 * k, 50 * k, 0.9) : rgb(120 * k, 104 * k, 70 * k, 0.8);
      g.beginPath(); g.ellipse(x, y, 2 + rng() * 5, 1.5 + rng() * 3, 0, 0, 7); g.fill();
    }
  }
}
/** Tarmac: an even mid-grey with fine aggregate and very soft blotches (contrast kept low on purpose). */
function asphaltBase(g, S, rng, N, base) {
  fill(g, rgb(...base), 0, 0, S, S); N(0, 0, S, S, 7, 5);
  speckle(g, S, rng, 1100, ['rgba(176,174,168,0.30)', 'rgba(52,52,54,0.30)', 'rgba(140,132,120,0.25)'], 1.3);
  for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(40,40,44,0.05)'; g.beginPath(); g.ellipse(rng() * S, rng() * S, 14 + rng() * 30, 8 + rng() * 16, rng() * 3, 0, 7); g.fill(); }
}
/** Kerbstones along the bottom 18 units of an along-the-road pavement cell: granite/concrete lengths, joints, lit top arris, dark road edge. */
function kerbBand(g, S, rng, col) {
  const y = S - 14;
  fill(g, 'rgba(34,30,24,0.55)', 0, y - 1.5, S, 2);
  for (let i = 0; i < 5; i++) { const k = 0.94 + rng() * 0.1; fill(g, rgb(col[0] * k, col[1] * k, col[2] * k), i * S / 5, y + 0.5, S / 5, 13.5); fill(g, 'rgba(30,28,24,0.5)', i * S / 5, y + 0.5, 1.1, 13.5); }
  fill(g, 'rgba(255,255,250,0.22)', 0, y + 1, S, 2.5);
  fill(g, 'rgba(30,28,26,0.45)', 0, S - 3, S, 3);
  for (let i = 0; i < 60; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(90,88,84,0.3)' : 'rgba(215,213,206,0.3)'; g.fillRect(rng() * S, y + 2 + rng() * 9, 1.2, 1.2); }
}
const GROUND_PAINTERS = [
  // 0 asphalt: mid-grey in daylight, fine aggregate, faint darker patches (low contrast: the shader's macro noise does the rest)
  (g, a, S, rng, N) => { asphaltBase(g, S, rng, N, [116, 116, 118]); },
  // 1 paving flags (York stone): soft joints, gentle slab-to-slab variation, the odd stained or cracked flag
  (g, a, S, rng, N) => {
    fill(g, '#8f897e', 0, 0, S, S);
    const rows = 4, rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -rh * 0.7 : 0;
      while (x < S) {
        const w = rh * (1.1 + rng() * 0.6), q = rng(), k = q < 0.08 ? 0.9 : 0.955 + rng() * 0.09;
        g.fillStyle = rgb(170 * k, 163 * k, 150 * k); g.fillRect(x + 1, r * rh + 1, w - 2, rh - 2);
        fill(g, 'rgba(255,250,240,0.10)', x + 1, r * rh + 1, w - 2, 1.5); fill(g, 'rgba(40,34,24,0.10)', x + 1, r * rh + rh - 2.5, w - 2, 1.5);
        if (q > 0.9) { g.strokeStyle = 'rgba(60,54,44,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + w * rng(), r * rh + 2); g.lineTo(x + w * rng(), r * rh + rh - 2); g.stroke(); }
        x += w;
      }
    }
    N(0, 0, S, S, 6, 9);
    for (let i = 0; i < 26; i++) { g.fillStyle = rng() < 0.6 ? 'rgba(60,56,48,0.10)' : 'rgba(225,222,212,0.16)'; g.beginPath(); g.arc(rng() * S, rng() * S, 1 + rng() * 3.5, 0, 7); g.fill(); }
  },
  // 2 setts (granite, in courses)
  (g, a, S, rng, N) => {
    fill(g, '#3e3c3a', 0, 0, S, S);
    const rows = 12, rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * rh * 0.8;
      x -= rh * 1.6;
      while (x < S) { const w = rh * (1.4 + rng() * 0.6), k = 0.75 + rng() * 0.4; g.fillStyle = rgb(118 * k, 112 * k, 106 * k); g.fillRect(x + 1.5, r * rh + 1.5, w - 3, rh - 3); fill(g, 'rgba(255,255,255,0.08)', x + 2, r * rh + 2, w - 4, 2); x += w; }
    }
    N(0, 0, S, S, 10, 6);
  },
  // 3 gravel (honey, as in college paths)
  (g, a, S, rng, N) => { fill(g, '#a8916a', 0, 0, S, S); N(0, 0, S, S, 22, 10); speckle(g, S, rng, 2600, ['rgba(220,205,170,0.7)', 'rgba(90,75,55,0.6)', 'rgba(160,140,110,0.8)'], 2.2); },
  // 4 grass
  (g, a, S, rng, N) => {
    grassBase(g, S, rng, N, [98, 130, 58], 2600);
    patches(g, S, rng, 26, ['rgba(70,112,44,A)', 'rgba(132,146,72,A)', 'rgba(84,124,60,A)', 'rgba(118,128,62,A)'], 10, 34);
    speckle(g, S, rng, 40, ['rgba(236,236,226,0.7)', 'rgba(226,206,90,0.6)'], 1.4);
  },
  // 5 lawn stripes (u across stripes). Stone pass (photo comparison item 6): real mowing stripes are under a metre wide
  // and faint, so the cell holds SIX stripes (three light / dark pairs: 0.6 m each at the 3.6 m repeat) at under a
  // third of the old contrast, with soft edges and the mower's wheel lines, so they read as mown grass, not paint
  (g, a, S, rng, N) => {
    grassBase(g, S, rng, N, [96, 140, 60], 1400);
    const gr = g.createLinearGradient(0, 0, S, 0);
    const NP = 3, w = 1 / NP;
    for (let p = 0; p < NP; p++) {
      const o = p * w;
      gr.addColorStop(o, 'rgba(255,255,205,0.06)'); gr.addColorStop(o + w * 0.42, 'rgba(255,255,205,0.06)'); gr.addColorStop(o + w * 0.5, 'rgba(0,30,0,0.0)');
      gr.addColorStop(o + w * 0.58, 'rgba(0,34,0,0.06)'); gr.addColorStop(o + w * 0.92, 'rgba(0,34,0,0.06)'); gr.addColorStop(o + w - 1e-3, 'rgba(255,255,205,0.06)');
    }
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // the mower's wheel lines and a little wander along the stripe
    for (let i = 0; i < NP * 2; i++) { g.fillStyle = i % 2 ? 'rgba(0,30,0,0.04)' : 'rgba(255,255,220,0.04)'; for (let y = 0; y < S; y += 8) g.fillRect(i * S / (NP * 2) + Math.sin(y * 0.05 + i) * 1.5 - 1, y, 2, 8); }
  },
  // 6 meadow (rough, yellower, with flecks of flowers)
  (g, a, S, rng, N) => {
    grassBase(g, S, rng, N, [124, 134, 66], 3500);
    patches(g, S, rng, 34, ['rgba(92,118,52,A)', 'rgba(160,150,84,A)', 'rgba(104,124,58,A)', 'rgba(146,136,76,A)'], 8, 28);
    // tussocks and seed heads: short tan strokes leaning one way
    for (let i = 0; i < 900; i++) { const x = rng() * S, y = rng() * S, k = 0.8 + rng() * 0.4; g.strokeStyle = rng() < 0.6 ? rgb(176 * k, 164 * k, 98 * k, 0.5) : rgb(70 * k, 98 * k, 44 * k, 0.55); g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.5 + rng() * 2, y - 3 - rng() * 5); g.stroke(); }
    speckle(g, S, rng, 160, ['rgba(240,230,120,0.8)', 'rgba(255,255,255,0.8)', 'rgba(200,120,160,0.6)'], 2);
  },
  // 7 woodland floor
  (g, a, S, rng, N) => { fill(g, '#4d4530', 0, 0, S, S); N(0, 0, S, S, 18, 22); speckle(g, S, rng, 1400, ['rgba(110,80,40,0.7)', 'rgba(70,90,40,0.7)', 'rgba(140,110,60,0.6)', 'rgba(30,25,15,0.6)'], 4); },
  // 8 flowerbed (soil + flowers)
  (g, a, S, rng, N) => {
    fill(g, '#4a3424', 0, 0, S, S); N(0, 0, S, S, 16, 10);
    speckle(g, S, rng, 700, ['rgba(60,110,40,0.95)', 'rgba(80,130,50,0.95)'], 7);
    speckle(g, S, rng, 500, ['#d8405a', '#f0c030', '#e8e8f0', '#9b5cc8', '#f08a3c', '#e070a0'], 3.5);
  },
  // 9 parking asphalt (lighter, oil stains)
  (g, a, S, rng, N) => { asphaltBase(g, S, rng, N, [124, 123, 122]); for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.arc(rng() * S, rng() * S, 6 + rng() * 14, 0, 7); g.fill(); } },
  // 10 sand
  (g, a, S, rng, N) => { fill(g, '#c8b48a', 0, 0, S, S); N(0, 0, S, S, 12, 12); },
  // 11 boardwalk planks
  (g, a, S, rng, N) => { for (let i = 0; i < 8; i++) { const k = 0.8 + rng() * 0.3; fill(g, rgb(120 * k, 92 * k, 64 * k), 0, (i * S) / 8, S, S / 8 - 2); fill(g, 'rgba(0,0,0,0.5)', 0, (i * S) / 8 + S / 8 - 2, S, 2); } N(0, 0, S, S, 10, 4); },
  // 12 kerb granite (vertical face; joints every half cell)
  (g, a, S, rng, N) => { fill(g, '#9a9893', 0, 0, S, S); N(0, 0, S, S, 12, 6); fill(g, 'rgba(0,0,0,0.4)', 0, 0, 3, S); fill(g, 'rgba(0,0,0,0.4)', S / 2, 0, 3, S); },
  // 13 steps: flags with dark nosing lines across u
  (g, a, S, rng, N) => { fill(g, '#9a948a', 0, 0, S, S); N(0, 0, S, S, 10, 8); for (let i = 0; i < 4; i++) { fill(g, 'rgba(0,0,0,0.45)', (i * S) / 4, 0, 5, S); fill(g, 'rgba(255,255,255,0.18)', (i * S) / 4 + 5, 0, 3, S); } },
  // 14 cobbles (rounded)
  (g, a, S, rng, N) => {
    fill(g, '#5a544c', 0, 0, S, S);
    for (let i = 0; i < 520; i++) { const x = rng() * S, y = rng() * S, r = 4 + rng() * 5, k = 0.7 + rng() * 0.5; g.fillStyle = rgb(150 * k, 140 * k, 124 * k); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x - 1, y - 1, r * 0.5, 0, 7); g.fill(); }
    N(0, 0, S, S, 8, 6);
  },
  // 15 compacted dirt
  (g, a, S, rng, N) => { fill(g, '#7c6a50', 0, 0, S, S); N(0, 0, S, S, 18, 22); speckle(g, S, rng, 800, ['rgba(160,140,110,0.6)', 'rgba(60,50,35,0.5)'], 2); },
  // 16 pavement of flags with its kerb, mapped along the road: x = 2 pavement-widths along, canvas bottom = kerb edge
  (g, a, S, rng, N) => {
    fill(g, '#8a8479', 0, 0, S, S);
    const rows = 3, top = 3, bot = S - 19, rh = (bot - top) / rows;
    for (let r = 0; r < rows; r++) {
      const n = 5, sw = S / n, off = r % 2 ? sw / 2 : 0;
      for (let i = -1; i < n; i++) {
        const x = i * sw + off, q = rng(), k = q < 0.1 ? 0.9 : 0.95 + rng() * 0.1;
        g.fillStyle = rgb(172 * k, 165 * k, 152 * k); g.fillRect(x + 0.8, top + r * rh + 1, sw - 1.6, rh - 2);
        fill(g, 'rgba(255,250,240,0.10)', x + 0.8, top + r * rh + 1, sw - 1.6, 1.5); fill(g, 'rgba(40,34,24,0.12)', x + 0.8, top + r * rh + rh - 2.5, sw - 1.6, 1.5);
        if (q > 0.92) { g.strokeStyle = 'rgba(60,54,44,0.4)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + sw * 0.2, top + r * rh + rh * rng()); g.lineTo(x + sw * 0.9, top + r * rh + rh * rng()); g.stroke(); }
      }
    }
    fill(g, 'rgba(50,44,34,0.22)', 0, 0, S, 5);                                         // grime against the building line
    kerbBand(g, S, rng, [178, 176, 170]);
    N(0, 0, S, bot, 6, 8);
    for (let i = 0; i < 22; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(60,56,48,0.12)' : 'rgba(228,225,215,0.2)'; g.beginPath(); g.arc(rng() * S, top + rng() * (bot - top), 0.8 + rng() * 2.2, 0, 7); g.fill(); }
  },
  // 17 tarmac footway with a concrete kerb (the suburbs): trench reinstatements, patches, a crack or two
  (g, a, S, rng, N) => {
    asphaltBase(g, S, rng, N, [112, 110, 108]);
    fill(g, 'rgba(48,46,44,0.10)', 40, 100, 96, 26); fill(g, 'rgba(20,20,20,0.16)', 40, 100, 96, 1); fill(g, 'rgba(20,20,20,0.16)', 40, 125, 96, 1);
    fill(g, 'rgba(170,168,160,0.07)', 190, 30, 30, 44); g.strokeStyle = 'rgba(25,25,25,0.18)'; g.lineWidth = 0.8; g.strokeRect(190, 30, 30, 44);
    g.strokeStyle = 'rgba(30,30,30,0.4)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(8, 190); g.lineTo(40, 176); g.lineTo(74, 186); g.lineTo(110, 170); g.stroke();
    fill(g, 'rgba(50,44,34,0.22)', 0, 0, S, 5);
    kerbBand(g, S, rng, [170, 169, 164]);
  },
  // 18 carriageway, mapped along the road (x along, y across the whole width): damp gutters, polished wheel tracks,
  // the darker drip line down each lane, a sealed centre joint, a trench reinstatement and a patch
  (g, a, S, rng, N) => {
    asphaltBase(g, S, rng, N, [116, 116, 118]);
    for (const y of [0.25, 0.75]) { const gr = g.createLinearGradient(0, S * (y - 0.07), 0, S * (y + 0.07)); gr.addColorStop(0, 'rgba(30,30,32,0)'); gr.addColorStop(0.5, 'rgba(30,30,32,0.13)'); gr.addColorStop(1, 'rgba(30,30,32,0)'); g.fillStyle = gr; g.fillRect(0, S * (y - 0.07), S, S * 0.14); }
    for (const y of [0.15, 0.36, 0.64, 0.85]) { const gr = g.createLinearGradient(0, S * (y - 0.05), 0, S * (y + 0.05)); gr.addColorStop(0, 'rgba(190,190,188,0)'); gr.addColorStop(0.5, 'rgba(190,190,188,0.10)'); gr.addColorStop(1, 'rgba(190,190,188,0)'); g.fillStyle = gr; g.fillRect(0, S * (y - 0.05), S, S * 0.1); }
    // (pass 5: the trench, patch and cracks are gone: one-off features repeated every road width)
    g.strokeStyle = 'rgba(22,22,22,0.16)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, 128); g.lineTo(S, 128); g.stroke();
    for (const top of [true, false]) {
      const gr = g.createLinearGradient(0, top ? 0 : S, 0, top ? 20 : S - 20); gr.addColorStop(0, 'rgba(34,32,30,0.2)'); gr.addColorStop(0.3, 'rgba(40,38,36,0.1)'); gr.addColorStop(1, 'rgba(40,38,36,0)');   // faint: the wider road's edge also crosses side-road mouths
      g.fillStyle = gr; g.fillRect(0, top ? 0 : S - 20, S, 20);
      for (let i = 0; i < 40; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(150,140,120,0.14)' : 'rgba(30,28,26,0.14)'; g.fillRect(rng() * S, top ? rng() * 7 : S - rng() * 7, 1 + rng() * 3, 1); }
    }
  },
  // 19 gravel / hoggin path through grass
  (g, a, S, rng, N) => { fill(g, '#a8916a', 0, 0, S, S); N(0, 0, S, S, 22, 10); speckle(g, S, rng, 2600, ['rgba(220,205,170,0.7)', 'rgba(90,75,55,0.6)', 'rgba(160,140,110,0.8)'], 2.2); wornEdges(g, S, rng, 34); },
  // 20 trodden earth path
  (g, a, S, rng, N) => { fill(g, '#7c6a50', 0, 0, S, S); N(0, 0, S, S, 18, 22); speckle(g, S, rng, 800, ['rgba(160,140,110,0.6)', 'rgba(60,50,35,0.5)'], 2); wornEdges(g, S, rng, 46); },
  // 21 tarmac park path: grass creeping over the edges
  (g, a, S, rng, N) => { asphaltBase(g, S, rng, N, [112, 110, 108]); wornEdges(g, S, rng, 22); },
];
// ---------------------------------------------------------------- roughness pass: worn, patched, hand-laid surfaces
/** Kerbstones of uneven length, tone and set (bottom 14 units of an along-the-road pavement cell): open joints with
 *  moss at the back, a chipped arris, tyre scuffs and gutter grime on the face. */
function roughKerb(g, S, rng, col) {
  const y = S - 14;
  fill(g, 'rgba(34,30,24,0.5)', 0, y - 1.5, S, 2);
  const cuts = [0];
  while (cuts[cuts.length - 1] < S) cuts.push(cuts[cuts.length - 1] + 34 + rng() * 26);
  if (S - cuts[cuts.length - 2] < 24) cuts.splice(cuts.length - 2, 1);
  cuts[cuts.length - 1] = S;
  for (let i = 0; i < cuts.length - 1; i++) {
    const x0 = cuts[i], w = cuts[i + 1] - x0, q = rng(), k = 0.9 + rng() * 0.15, dy = rng() < 0.3 ? 0.8 + rng() * 1.2 : 0;
    const c = q < 0.16 ? [col[0] * 1.03, col[1] * 0.96, col[2] * 0.91] : q > 0.88 ? [col[0] * 1.07, col[1] * 1.07, col[2] * 1.08] : col;
    fill(g, rgb(c[0] * k, c[1] * k, c[2] * k), x0, y + 0.5 + dy, w, 13.5 - dy);
    fill(g, rgb(255, 255, 250, 0.1 + rng() * 0.16), x0 + 1, y + 1 + dy, w - 1, 2.2);
    fill(g, rgb(30, 28, 26, 0.3 + rng() * 0.3), x0, S - 3 - rng() * 1.5, w, 4.5);
    fill(g, rgb(30, 28, 24, 0.42 + rng() * 0.25), x0, y + 0.5, rng() < 0.28 ? 2.2 : 1.1, 13.5);
    if (rng() < 0.4) fill(g, 'rgba(18,18,20,0.22)', x0 + rng() * w * 0.6, S - 9, 6 + rng() * 14, 6);                       // tyre scuff
    for (let n = rng() < 0.55 ? 1 + ((rng() * 3) | 0) : 0; n > 0; n--) { const cx = x0 + 3 + rng() * (w - 6), d = 1.5 + rng() * 2.5; g.fillStyle = 'rgba(44,42,38,0.6)'; g.beginPath(); g.moveTo(cx - d, S - 3); g.lineTo(cx, S - 3 - d * 1.2); g.lineTo(cx + d * 1.3, S - 3); g.fill(); }
    if (rng() < 0.45) for (let n = 0; n < 7; n++) { g.fillStyle = rng() < 0.6 ? 'rgba(70,88,40,0.55)' : 'rgba(52,46,32,0.5)'; g.beginPath(); g.arc(x0 + (rng() - 0.3) * 7, y - 1 + rng() * 3, 0.6 + rng() * 1.3, 0, 7); g.fill(); }
  }
  for (let i = 0; i < 70; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(90,88,84,0.3)' : 'rgba(215,213,206,0.3)'; g.fillRect(rng() * S, y + 2 + rng() * 9, 1.2, 1.2); }
}
/** A wandering crack from (x0, y0) to (x1, y1). */
function crack(g, rng, x0, y0, x1, y1, a = 0.38, w = 0.8) {
  const n = 3 + ((rng() * 3) | 0), px = -(y1 - y0), py = x1 - x0, l = Math.hypot(px, py) || 1;
  g.strokeStyle = rgb(34, 30, 26, a); g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0);
  for (let i = 1; i <= n; i++) { const t = i / n, j = i < n ? (rng() - 0.5) * 0.16 * l : 0; g.lineTo(x0 + (x1 - x0) * t + px / l * j, y0 + (y1 - y0) * t + py / l * j); }
  g.stroke();
}
/** A reinstated patch of tarmac with sealed, slightly wandering edges. tone < 0 darker (newer), > 0 paler (older). */
function tarPatch(g, rng, x, y, w, h, tone, seal = 0.2) {
  fill(g, tone < 0 ? rgb(28, 28, 30, -tone) : rgb(176, 174, 168, tone), x, y, w, h);
  for (let i = 0; i < w * h / 26; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(170,168,160,0.22)' : 'rgba(30,30,32,0.22)'; g.fillRect(x + rng() * w, y + rng() * h, 1.2, 1.2); }
  g.strokeStyle = rgb(20, 20, 22, seal); g.lineWidth = 1;
  const side = (ax, ay, bx, by) => { g.beginPath(); g.moveTo(ax, ay); const n = 4; for (let i = 1; i <= n; i++) g.lineTo(ax + (bx - ax) * i / n + (i < n ? (rng() - 0.5) * 1.2 : 0), ay + (by - ay) * i / n + (i < n ? (rng() - 0.5) * 1.2 : 0)); g.stroke(); };
  side(x, y, x + w, y); side(x + w, y, x + w, y + h); side(x + w, y + h, x, y + h); side(x, y + h, x, y);
}
/** Flags with their kerb, along the road (cell 16 / its variant 22): rows of uneven height, flags of uneven length
 *  and colour, a replaced flag, a broken one, moss in the joints away from the kerb, gum. variant 1: a utility trench
 *  in tarmac across the footway. */
function roughFlags(g, S, rng, N, variant) {
  fill(g, '#827c71', 0, 0, S, S);
  const top = 3, bot = S - 19, hh = bot - top, ys = [top, top + hh * (0.31 + rng() * 0.05), top + hh * (0.64 + rng() * 0.05), bot], OFF = [0, 23, 11];
  const joints = [];
  for (let r = 0; r < 3; r++) {
    const y0 = ys[r], rh = ys[r + 1] - y0, ws = []; let sum = 0;
    while (sum < S - 30) { const w = 40 + rng() * 26; ws.push(w); sum += w; }
    const sc = S / sum; let x = OFF[r];
    ws.forEach((w0, i) => {
      const w = w0 * sc, q = i === ws.length - 1 ? 0.5 : rng();   // (the flag that wraps round the cell edge is plain: it joins the other variant's)
      let c = [172, 165, 152], k = q === 0.5 ? 1 : 0.93 + rng() * 0.12;
      if (q < 0.09) k = 0.88; else if (q > 0.955) { c = [184, 183, 178]; k = 1.02; } else if (q > 0.9) c = [175, 164, 149];
      for (const xx of [x, x - S]) {
        g.fillStyle = rgb(c[0] * k, c[1] * k, c[2] * k); g.fillRect(xx + 0.8, y0 + 1, w - 1.6, rh - 2);
        fill(g, 'rgba(255,250,240,0.10)', xx + 0.8, y0 + 1, w - 1.6, 1.5); fill(g, 'rgba(40,34,24,0.12)', xx + 0.8, y0 + rh - 2.5, w - 1.6, 1.5);
      }
      if (q > 0.8 && q < 0.9 && x + w < S) { crack(g, rng, x + w * (0.15 + rng() * 0.3), y0 + 1.5, x + w * (0.55 + rng() * 0.4), y0 + rh - 1.5); if (rng() < 0.5) crack(g, rng, x + w * 0.5, y0 + rh * 0.5, x + w - 1, y0 + rh * rng(), 0.3); }
      joints.push([x % S, y0, 0, rh]); joints.push([x % S, y0, w, 0]);
      x += w;
    });
  }
  if (variant) {
    // a service trench cut across the footway and made good in tarmac, and one flag replaced in tarmac
    const tx = 70 + rng() * 90, tw = 24 + rng() * 8;
    fill(g, rgb(128, 126, 123), tx, top, tw, bot - top); tarPatch(g, rng, tx, top, tw, bot - top, -0.05, 0.4);
    const fx = (tx + 110) % 200 + 10, fy = ys[1] + 1; fill(g, rgb(124, 122, 120), fx, fy, 44, ys[2] - ys[1] - 2); tarPatch(g, rng, fx, fy, 44, ys[2] - ys[1] - 2, -0.04, 0.35);
  }
  N(0, 0, S, bot, 6, 8);
  for (let i = 0; i < 150; i++) {
    const j = joints[(rng() * joints.length) | 0], t = rng(), x = (j[0] + j[2] * t + S) % S, y = j[1] + j[3] * t;
    if (rng() > 0.25 + 0.75 * (1 - y / bot)) continue;                                   // mostly at the back of the footway
    g.fillStyle = rng() < 0.55 ? 'rgba(74,92,44,0.5)' : 'rgba(48,42,30,0.45)'; g.beginPath(); g.arc(x + (rng() - 0.5) * 1.5, y + (rng() - 0.5) * 1.5, 0.6 + rng() * 1.5, 0, 7); g.fill();
  }
  for (let i = 0; i < 5; i++) { const x = 20 + rng() * (S - 40), y = top + 12 + rng() * (hh - 24), r = 9 + rng() * 20, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(46,42,36,0.13)'); gr.addColorStop(1, 'rgba(46,42,36,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (let i = 0; i < 26; i++) { g.fillStyle = rng() < 0.6 ? 'rgba(228,226,216,0.5)' : 'rgba(46,44,40,0.32)'; g.beginPath(); g.arc(rng() * S, top + rng() * hh, 0.6 + rng() * 0.9, 0, 7); g.fill(); }
  for (let x = 0; x < S; x += 6) fill(g, rgb(50, 44, 34, 0.1 + rng() * 0.22), x, 0, 6, 3 + rng() * 4);   // grime against the building line
  roughKerb(g, S, rng, [178, 176, 170]);
}
/** Tarmac footway with a concrete kerb (cell 17 / variant 24): a cable trench along it, patches, cracks, weeds at the back. */
function roughTarmacWay(g, S, rng, N, variant) {
  asphaltBase(g, S, rng, N, [112, 110, 108]);
  // the cable trench of the 1990s, the whole length of the street (so it joins up across the repeat)
  const ty = 96 + (variant ? 0 : 0);
  fill(g, 'rgba(176,172,164,0.07)', 0, ty, S, 22);
  g.strokeStyle = 'rgba(20,20,20,0.17)'; g.lineWidth = 0.9;
  for (const yy of [ty, ty + 22]) { g.beginPath(); g.moveTo(0, yy); for (let x = 32; x < S; x += 32) g.lineTo(x, yy + (rng() - 0.5) * 1.6); g.lineTo(S, yy); g.stroke(); }
  if (variant) { tarPatch(g, rng, 60 + rng() * 60, 22 + rng() * 30, 70 + rng() * 50, 50 + rng() * 40, -0.2, 0.3); crack(g, rng, 10, 200, 60, 150, 0.4); crack(g, rng, 60, 150, 120, 168, 0.36); crack(g, rng, 60, 150, 76, 128, 0.3); }
  else { tarPatch(g, rng, 180 + rng() * 20, 26 + rng() * 20, 30, 44, 0.08, 0.2); crack(g, rng, 8, 190, 110, 172, 0.38); tarPatch(g, rng, 30 + rng() * 60, 150, 44, 30, -0.12, 0.22); }
  for (let i = 0; i < 4; i++) { const x = rng() * S, y = 20 + rng() * 200, r = 10 + rng() * 22, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(30,28,26,0.12)'); gr.addColorStop(1, 'rgba(30,28,26,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (let x = 0; x < S; x += 6) fill(g, rgb(50, 44, 34, 0.1 + rng() * 0.22), x, 0, 6, 3 + rng() * 4);
  for (let i = 0; i < 46; i++) { g.fillStyle = rng() < 0.6 ? 'rgba(72,96,44,0.6)' : 'rgba(56,48,32,0.5)'; g.beginPath(); g.arc(rng() * S, Math.pow(rng(), 2) * 9, 0.7 + rng() * 1.8, 0, 7); g.fill(); }
  roughKerb(g, S, rng, [170, 169, 164]);
}
/** Carriageway along the road (cell 18 / variant 23): blotchy gutters with grit and leaf litter, wheel tracks, drip
 *  lines, a sealed centre joint, hairline cracks. variant 1: a trench reinstated from one kerb to the middle and a patch. */
function roughCarriageway(g, S, rng, N, variant) {
  asphaltBase(g, S, rng, N, [116, 116, 118]);
  for (const y of [0.25, 0.75]) { const gr = g.createLinearGradient(0, S * (y - 0.07), 0, S * (y + 0.07)); gr.addColorStop(0, 'rgba(30,30,32,0)'); gr.addColorStop(0.5, 'rgba(30,30,32,0.13)'); gr.addColorStop(1, 'rgba(30,30,32,0)'); g.fillStyle = gr; g.fillRect(0, S * (y - 0.07), S, S * 0.14); }
  for (const y of [0.15, 0.36, 0.64, 0.85]) { const gr = g.createLinearGradient(0, S * (y - 0.05), 0, S * (y + 0.05)); gr.addColorStop(0, 'rgba(190,190,188,0)'); gr.addColorStop(0.5, 'rgba(190,190,188,0.10)'); gr.addColorStop(1, 'rgba(190,190,188,0)'); g.fillStyle = gr; g.fillRect(0, S * (y - 0.05), S, S * 0.1); }
  g.strokeStyle = 'rgba(22,22,22,0.16)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, 128); g.lineTo(S, 128); g.stroke();
  if (variant) {
    const tx = 60 + rng() * 120, up = rng() < 0.5;
    tarPatch(g, rng, tx, up ? 0 : 128, 9 + rng() * 5, 128, -0.2, 0.3);
    tarPatch(g, rng, (tx + 90) % 200, up ? 150 + rng() * 30 : 30 + rng() * 30, 36 + rng() * 26, 22 + rng() * 14, rng() < 0.5 ? -0.14 : 0.07, 0.22);
  } else {
    crack(g, rng, 30 + rng() * 60, 128, 120 + rng() * 60, 124 + rng() * 8, 0.22, 0.7);
    const y = rng() < 0.5 ? 60 : 196; crack(g, rng, 150, y, 236, y + (rng() - 0.5) * 14, 0.2, 0.7);
  }
  for (const top of [true, false]) {
    const gr = g.createLinearGradient(0, top ? 0 : S, 0, top ? 20 : S - 20); gr.addColorStop(0, 'rgba(34,32,30,0.2)'); gr.addColorStop(0.3, 'rgba(40,38,36,0.1)'); gr.addColorStop(1, 'rgba(40,38,36,0)');
    g.fillStyle = gr; g.fillRect(0, top ? 0 : S - 20, S, 20);
    // damp, silted lengths of gutter (they wrap round the cell edge)
    for (let i = 0; i < 9; i++) { const x = rng() * S, rx = 14 + rng() * 34, ry = 4 + rng() * 9; g.fillStyle = 'rgba(30,28,26,0.09)'; for (const xx of [x, x - S, x + S]) { g.beginPath(); g.ellipse(xx, top ? 0 : S, rx, ry, 0, 0, 7); g.fill(); } }
    for (let i = 0; i < 90; i++) { const d = Math.pow(rng(), 2.2) * 11; g.fillStyle = rng() < 0.45 ? 'rgba(150,138,112,0.2)' : rng() < 0.6 ? 'rgba(30,28,26,0.2)' : 'rgba(126,96,52,0.22)'; g.fillRect(rng() * S, top ? d : S - d - 1, 1 + rng() * 3, 1); }
  }
}
/** Granite setts laid by hand (cell 2 / variant 25): courses that wander, setts of uneven length, the odd sunk or
 *  replaced one, dirt and moss in the joints. variant 1: a scar made good in tarmac. */
function roughSetts(g, S, rng, N, variant) {
  fill(g, '#3a3835', 0, 0, S, S);
  const rows = 12, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const ws = []; let sum = 0; while (sum < S - 14) { const w = rh * (1.15 + rng() * 0.9); ws.push(w); sum += w; }
    const sc = S / sum, ph = rng() * 6.28, amp = 0.5 + rng() * 0.9; let x = (r % 2) * rh * 0.8 + rng() * 8;
    for (const w0 of ws) {
      const w = w0 * sc, q = rng(), k = q < 0.05 ? 0.6 : 0.74 + rng() * 0.4, warm = rng() < 0.18 ? 1.06 : 1;
      const dy = Math.sin(ph + x * 0.05) * amp, inset = 1.2 + rng() * 0.8;
      for (const xx of [x, x - S]) {
        g.fillStyle = rgb(118 * k * warm, 112 * k, 106 * k / warm); g.fillRect(xx + inset, r * rh + inset + dy, w - 2 * inset, rh - 2 * inset);
        fill(g, 'rgba(255,255,255,0.08)', xx + inset + 0.5, r * rh + inset + dy + 0.5, w - 2 * inset - 1, 2);
      }
      x += w;
    }
  }
  if (variant) { const x = 40 + rng() * 120, y = Math.round(2 + rng() * 6) * rh, w = 44 + rng() * 30, h = rh * (rng() < 0.5 ? 1 : 2); fill(g, rgb(84, 82, 81), x, y, w, h); tarPatch(g, rng, x, y, w, h, -0.06, 0.4); }
  for (let i = 0; i < 260; i++) { const r = (rng() * rows) | 0; g.fillStyle = rng() < 0.4 ? 'rgba(66,84,40,0.55)' : 'rgba(84,72,52,0.4)'; g.fillRect(rng() * S, r * rh - 0.8 + rng() * 1.6, 1 + rng() * 4, 1.4); }
  N(0, 0, S, S, 10, 7);
}
/** Rounded cobbles (cell 14 / variant 26) with earth and moss between them, and a hollow where they have sunk. */
function roughCobbles(g, S, rng, N, variant) {
  // photo comparison item 19 (merton_st): the cobbles were scattered pale ovals on brown earth ("polka dots"); real
  // ones are close-packed, irregular, dark grey-pink and brown stones with thin dark joints. Laid in rough courses of
  // ~12 cm stones (the cell repeats every 2 m), each a rounded, slightly irregular blob filling its slot.
  fill(g, '#4c4540', 0, 0, S, S);
  for (let i = 0; i < 90; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(62,74,40,0.4)' : 'rgba(70,60,48,0.4)'; g.beginPath(); g.arc(rng() * S, rng() * S, 2 + rng() * 4, 0, 7); g.fill(); }
  const COL = [[108, 97, 93], [96, 91, 88], [118, 104, 98], [90, 86, 83], [122, 110, 101], [84, 78, 75], [104, 97, 88], [114, 101, 97]];
  const rows = 16, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = rng() * rh;
    const y0 = r * rh;
    while (x < S + rh) {
      const w = rh * (0.8 + rng() * 0.55), cx = x + w / 2, cy = y0 + rh / 2 + (rng() - 0.5) * rh * 0.18;
      const c = COL[(rng() * COL.length) | 0], k = 0.78 + rng() * 0.2, rx = w * (0.54 + rng() * 0.05), ry = rh * (0.55 + rng() * 0.06), a = (rng() - 0.5) * 0.4;
      for (const xx of [cx, cx - S]) {
        if (xx < -rh || xx > S + rh) continue;
        g.fillStyle = rgb(c[0] * k, c[1] * k, c[2] * k); g.beginPath(); g.ellipse(xx, cy, rx, ry, a, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,250,240,0.04)'; g.beginPath(); g.ellipse(xx - rx * 0.2, cy - ry * 0.25, rx * 0.5, ry * 0.45, a, 0, 7); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.1)'; g.beginPath(); g.ellipse(xx + rx * 0.15, cy + ry * 0.35, rx * 0.7, ry * 0.4, a, 0, 7); g.fill();
      }
      x += w;
    }
  }
  for (let i = 0; i < (variant ? 3 : 1); i++) { const x = 40 + rng() * 170, y = 40 + rng() * 170, r = 22 + rng() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(30,28,22,0.2)'); gr.addColorStop(1, 'rgba(30,28,22,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  N(0, 0, S, S, 8, 7);
}
/** York-stone flags on open paved ground (cell 1 / variant 27): random lengths, weathered tones, a broken flag, moss and gum. */
function roughPaving(g, S, rng, N, variant) {
  fill(g, '#878175', 0, 0, S, S);
  const rows = 4, rh = S / rows, joints = [];
  for (let r = 0; r < rows; r++) {
    const ws = []; let sum = 0; while (sum < S - 40) { const w = rh * (0.95 + rng() * 0.75); ws.push(w); sum += w; }
    const sc = S / sum; let x = r % 2 ? rh * 0.45 : 0;
    for (const w0 of ws) {
      const w = w0 * sc, q = rng(); let c = [170, 163, 150], k = 0.925 + rng() * 0.12;
      if (q < 0.1) k = 0.88; else if (q > 0.95) { c = [182, 181, 176]; k = 1.02; } else if (q > 0.88) c = [173, 162, 147];
      for (const xx of [x, x - S]) {
        g.fillStyle = rgb(c[0] * k, c[1] * k, c[2] * k); g.fillRect(xx + 1, r * rh + 1, w - 2, rh - 2);
        fill(g, 'rgba(255,250,240,0.10)', xx + 1, r * rh + 1, w - 2, 1.5); fill(g, 'rgba(40,34,24,0.10)', xx + 1, r * rh + rh - 2.5, w - 2, 1.5);
      }
      if (q > 0.76 - (variant ? 0.06 : 0) && q < 0.88 && x + w < S) crack(g, rng, x + w * (0.1 + rng() * 0.3), r * rh + 2, x + w * (0.6 + rng() * 0.35), r * rh + rh - 2, 0.34);
      joints.push([x % S, r * rh, 0, rh], [x % S, r * rh, w, 0]);
      x += w;
    }
  }
  N(0, 0, S, S, 6, 9);
  for (let i = 0; i < 90; i++) { const j = joints[(rng() * joints.length) | 0], t = rng(); g.fillStyle = rng() < 0.5 ? 'rgba(74,92,44,0.45)' : 'rgba(48,42,30,0.4)'; g.beginPath(); g.arc((j[0] + j[2] * t) % S + (rng() - 0.5) * 1.5, j[1] + j[3] * t + (rng() - 0.5) * 1.5, 0.6 + rng() * 1.4, 0, 7); g.fill(); }
  for (let i = 0; i < 5; i++) { const x = 24 + rng() * (S - 48), y = 24 + rng() * (S - 48), r = 10 + rng() * 22, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(46,42,36,0.12)'); gr.addColorStop(1, 'rgba(46,42,36,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (let i = 0; i < 30; i++) { g.fillStyle = rng() < 0.6 ? 'rgba(228,226,216,0.45)' : 'rgba(46,44,40,0.3)'; g.beginPath(); g.arc(rng() * S, rng() * S, 0.6 + rng() * 1.0, 0, 7); g.fill(); }
}
if (ROUGH) {
  const P = GROUND_PAINTERS, C = GROUND_CELLS;
  P[C.paving] = (g, a, S, rng, N) => roughPaving(g, S, rng, N, 0); P[C.pavingB] = (g, a, S, rng, N) => roughPaving(g, S, rng, N, 1);
  P[C.setts] = (g, a, S, rng, N) => roughSetts(g, S, rng, N, 0); P[C.settsB] = (g, a, S, rng, N) => roughSetts(g, S, rng, N, 1);
  P[C.cobbles] = (g, a, S, rng, N) => roughCobbles(g, S, rng, N, 0); P[C.cobblesB] = (g, a, S, rng, N) => roughCobbles(g, S, rng, N, 1);
  P[C.pavedKerb] = (g, a, S, rng, N) => roughFlags(g, S, rng, N, 0); P[C.pavedKerbB] = (g, a, S, rng, N) => roughFlags(g, S, rng, N, 1);
  P[C.tarmacKerb] = (g, a, S, rng, N) => roughTarmacWay(g, S, rng, N, 0); P[C.tarmacKerbB] = (g, a, S, rng, N) => roughTarmacWay(g, S, rng, N, 1);
  // the kerb's face (only the bottom 8 % of the cell is ever drawn: v = height / 1.8 m): three stones of uneven
  // length and tone to the repeat, open joints, road dirt thickening towards the gutter
  P[C.kerb] = (g, a, S, rng, N) => {
    fill(g, '#9a9893', 0, 0, S, S);
    const cuts = [0, S * (0.3 + rng() * 0.08), S * (0.64 + rng() * 0.08), S];
    for (let i = 0; i < 3; i++) { const k = 0.9 + rng() * 0.18; fill(g, rgb(154 * k, 152 * k, 147 * k), cuts[i], 0, cuts[i + 1] - cuts[i], S); }
    N(0, 0, S, S, 12, 6);
    for (let i = 0; i < 3; i++) fill(g, rgb(0, 0, 0, 0.35 + rng() * 0.25), cuts[i], 0, 2 + rng() * 2, S);
    const gr = g.createLinearGradient(0, S - 20, 0, S); gr.addColorStop(0, 'rgba(40,36,30,0)'); gr.addColorStop(0.6, 'rgba(40,36,30,0.18)'); gr.addColorStop(1, 'rgba(34,30,26,0.5)'); g.fillStyle = gr; g.fillRect(0, S - 20, S, 20);
    for (let i = 0; i < 40; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(30,28,24,0.35)' : 'rgba(70,86,44,0.4)'; g.fillRect(rng() * S, S - 2 - rng() * 12, 2 + rng() * 8, 1.5 + rng() * 2); }
  };
  P[C.carriageway] = (g, a, S, rng, N) => roughCarriageway(g, S, rng, N, 0); P[C.carriagewayB] = (g, a, S, rng, N) => roughCarriageway(g, S, rng, N, 1);
} else {
  // (?rough=0: the variants are copies, so geometry that names them draws what it always did)
  const P = GROUND_PAINTERS, C = GROUND_CELLS;
  P[C.pavingB] = P[C.paving]; P[C.settsB] = P[C.setts]; P[C.cobblesB] = P[C.cobbles]; P[C.pavedKerbB] = P[C.pavedKerb]; P[C.tarmacKerbB] = P[C.tarmacKerb]; P[C.carriagewayB] = P[C.carriageway];
}
/** Roughness pass: buf.setCell for a ground cell, with its second version mixed in per repeat where it has one. */
const GROUND_VARIANT = ROUGH ? { 1: [27, 0.5], 2: [25, 0.5], 14: [26, 0.5], 16: [22, 0.3], 17: [24, 0.35], 18: [23, 0.22] } : {};
export function setGroundCell(buf, cell, seed = 0) { const v = GROUND_VARIANT[cell]; return v ? buf.setCell(cell, v[0], v[1], seed) : buf.setCell(cell); }
export function makeGroundAtlas() { if (PRE.ground) return PRE.ground; return { map: canvasTexture(paintAtlas(4, HI.on ? HI.ground : 1024, GROUND_PAINTERS, false, 55, GROUND_ROWS).map, { anisotropy: 8 }) }; }

// ---------------------------------------------------------------- small textures
/**
 * Road markings and road-surface decals, alpha cut-out, 8 rows (top→bottom): white dashes, double yellow, zebra, solid
 * white, zig-zag, broken yellow (bus-stop cage), ironwork (u 0-0.5 manhole cover, 0.5-1 gully grate), symbols (u 0-0.5
 * cycle, 0.5-1 give-way triangle). u repeats along the marking; v is one row.
 */
export const MARK_ROWS = { dash: 0, yellow: 1, zebra: 2, white: 3, zigzag: 4, yellowDash: 5, iron: 6, symbol: 7 };
const MARK_N = 8;
export function makeMarkings() {
  const W = 512, H = 512, { c, g } = mkCanvas(W, H), rh = H / MARK_N;
  g.clearRect(0, 0, W, H);
  const band = (r, y0, y1) => [r * rh + rh * y0, rh * (y1 - y0)];
  g.fillStyle = '#e8e8e2'; let [y, h] = band(0, 0.2, 0.8); g.fillRect(0, y, W * 0.45, h);
  g.fillStyle = '#e6c22c'; [y, h] = band(1, 0.2, 0.4); g.fillRect(0, y, W, h); [y, h] = band(1, 0.6, 0.8); g.fillRect(0, y, W, h);
  g.fillStyle = '#ecece6'; [y, h] = band(2, 0.2, 0.8); g.fillRect(0, y, W / 2, h);
  [y, h] = band(3, 0.2, 0.8); g.fillRect(0, y, W, h);
  // zig-zag: one period per repeat
  [y, h] = band(4, 0.2, 0.8); g.strokeStyle = '#ecece6'; g.lineWidth = 9; g.lineJoin = 'miter'; g.beginPath(); g.moveTo(-4, y + h - 5); g.lineTo(W / 2, y + 5); g.lineTo(W + 4, y + h - 5); g.stroke();
  // broken yellow line
  g.fillStyle = '#e6c22c'; [y, h] = band(5, 0.25, 0.75); g.fillRect(0, y, W * 0.6, h);
  // ironwork: round manhole cover with a ribbed lid; square gully grate with slots
  [y, h] = band(6, 0.2, 0.8);
  { const cx = W * 0.25, cy = y + h / 2, r = h * 0.48; g.fillStyle = '#2b2a28'; g.beginPath(); g.ellipse(cx, cy, W * 0.2, r, 0, 0, 7); g.fill(); g.fillStyle = '#4a4844'; g.beginPath(); g.ellipse(cx, cy, W * 0.17, r * 0.84, 0, 0, 7); g.fill(); g.fillStyle = '#34322f'; for (let i = -3; i <= 3; i++) g.fillRect(cx - W * 0.13, cy + i * r * 0.2 - 1.5, W * 0.26, 3); }
  { const x0 = W * 0.56, w0 = W * 0.38; g.fillStyle = '#2e2d2b'; g.fillRect(x0, y, w0, h); g.fillStyle = '#0c0c0c'; for (let i = 0; i < 6; i++) g.fillRect(x0 + 10 + i * (w0 - 20) / 6, y + 5, (w0 - 20) / 12, h - 10); }
  // symbols (white): cycle; give-way triangle
  [y, h] = band(7, 0.2, 0.8); g.strokeStyle = '#ecece6'; g.fillStyle = '#ecece6'; g.lineWidth = 3.2;
  { const cx = W * 0.25, by = y + h * 0.62, wr = h * 0.3; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * W * 0.1, by, W * 0.062, wr, 0, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(cx - W * 0.1, by); g.lineTo(cx - W * 0.03, y + h * 0.2); g.lineTo(cx + W * 0.06, y + h * 0.2); g.lineTo(cx + W * 0.1, by); g.moveTo(cx - W * 0.03, y + h * 0.2); g.lineTo(cx + W * 0.01, by); g.lineTo(cx - W * 0.1, by); g.moveTo(cx + W * 0.01, by); g.lineTo(cx + W * 0.06, y + h * 0.2); g.lineTo(cx + W * 0.05, y + 3); g.stroke(); }
  { const cx = W * 0.75; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - W * 0.16, y + 4); g.lineTo(cx + W * 0.16, y + 4); g.lineTo(cx, y + h - 3); g.closePath(); g.stroke(); }
  if (ROUGH) wearMarkings(g, W, rh, band);
  return canvasTexture(c, { clampT: true });
}
/**
 * Roughness pass: paint that has been driven over for years. The double yellows are redrawn as two lines that wander a
 * centimetre or two (they are laid 8 m to a repeat now, see roads.js MARK_LEN), all the paint is dulled and flecked,
 * and worn-through patches are cut out of it (alpha), with ragged ends on the dashes.
 */
export const MARK_LEN = { yellow: ROUGH ? 8 : 1, yellowHalf: ROUGH ? 0.18 : 0.13 };
function wearMarkings(g, W, rh, band) {
  const rng = makeRng(4711);
  const holes = (x0, x1, y0, y1, n, rx, ry) => { g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), rx * (0.4 + rng()), ry * (0.4 + rng()), 0, 0, 7); g.fill(); } g.globalCompositeOperation = 'source-over'; };
  const dirt = (x0, x1, y0, y1, n) => { g.globalCompositeOperation = 'source-atop'; for (let i = 0; i < n; i++) { g.fillStyle = rng() < 0.6 ? 'rgba(70,64,50,0.22)' : 'rgba(40,38,36,0.2)'; g.fillRect(x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), 1 + rng() * 5, 1 + rng() * 2); } g.globalCompositeOperation = 'source-over'; };
  // double yellow: two wandering lines (the wander is periodic over the repeat)
  let [y, h] = band(1, 0.2, 0.8);
  g.clearRect(0, 1 * rh, W, rh);
  const wob = [0, 1].map(() => [rng() * 6.28, rng() * 6.28, 1.2 + rng() * 0.8, 0.5 + rng() * 0.4]);
  const yl = (k) => y + h / 2 + (k ? 1 : -1) * h * 0.263, lw = h * 0.25;
  for (let k = 0; k < 2; k++) {
    const yc = yl(k), wv = wob[k];
    g.strokeStyle = '#dcb82a'; g.lineWidth = lw; g.beginPath();
    for (let x = -8; x <= W + 8; x += 8) { const a = x / W * 6.2832, yy = yc + Math.sin(a + wv[0]) * wv[2] + Math.sin(a * 3 + wv[1]) * wv[3]; if (x === -8) g.moveTo(x, yy); else g.lineTo(x, yy); }
    g.stroke();
  }
  dirt(0, W, y, y + h, 260);
  for (let i = 0; i < 7; i++) { const x = rng() * W, l = 14 + rng() * 44, yc = yl(rng() < 0.5 ? 0 : 1); holes(x, x + l, yc - lw * 0.7, yc + lw * 0.7, 14 + l * 0.9, 1.6, 1.2); }
  { const x = rng() * W * 0.8, yc = yl(rng() < 0.5 ? 0 : 1); g.clearRect(x, yc - lw, 20 + rng() * 14, lw * 2); }      // a length lost to a reinstated trench
  holes(0, W, y, y + h, 90, 0.9, 0.8);
  // centre-line dashes: ragged ends, tyre wear
  [y, h] = band(0, 0.2, 0.8);
  dirt(0, W * 0.45, y, y + h, 120);
  holes(0, 5, y, y + h, 26, 2.5, 4); holes(W * 0.45 - 6, W * 0.45, y, y + h, 30, 2.5, 4);
  holes(0, W * 0.45, y, y + 3, 40, 2.5, 2); holes(0, W * 0.45, y + h - 3, y + h, 40, 2.5, 2);
  for (let i = 0; i < 4; i++) { const x = 8 + rng() * W * 0.4; holes(x, x + 14 + rng() * 22, y, y + h, 34, 1.4, 3.5); }
  // zebra, stop lines, zig-zags, bus cage: flecked, lightly worn
  for (const [row, x1, n] of [[2, W / 2, 110], [3, W, 130], [4, W, 60], [5, W * 0.6, 60]]) { [y, h] = band(row, 0.2, 0.8); dirt(0, x1, y, y + h, n * 1.4); holes(0, x1, y, y + h, n, 1.5, 1.8); }
  // cycle symbols and give-way triangles
  [y, h] = band(7, 0.2, 0.8); dirt(0, W, y, y + h, 120); holes(0, W, y, y + h, 150, 1.6, 1.2);
}
/** v range (0..1, flipY) for a markings row: the painted band only. */
export function markRowV(row) { const top = 1 - (row + 0.2) / MARK_N, bot = 1 - (row + 0.8) / MARK_N; return [bot, top]; }

/** Railings (top half, alpha) and close-board fence (bottom half). u: 1 repeat = 1 m. */
export function makeFenceTex() {
  const W = 512, H = 256, { c, g } = mkCanvasK(W, H);
  g.clearRect(0, 0, W, H);
  // railings: v 0.5..1 (canvas top half)
  g.fillStyle = '#16181a';
  for (let x = 0; x < W; x += 64) {
    g.fillRect(x + 29, 14, 6, 110);
    g.beginPath(); g.moveTo(x + 26, 16); g.lineTo(x + 32, 2); g.lineTo(x + 38, 16); g.closePath(); g.fill(); // spear
  }
  g.fillRect(0, 22, W, 5); g.fillRect(0, 112, W, 6);
  // close-board fence: v 0..0.5
  for (let x = 0; x < W; x += 32) { const k = 0.8 + ((x * 37) % 17) / 60; g.fillStyle = rgb(118 * k, 92 * k, 62 * k); g.fillRect(x, 132, 30, 124); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 30, 132, 2, 124); }
  g.fillStyle = 'rgb(96,74,50)'; g.fillRect(0, 128, W, 8); g.fillRect(0, 200, W, 5);
  return canvasTexture(c, { clampT: true });
}
/** Parapet: top half crenellated (alpha), bottom half plain with coping. u: 1 repeat = 2 m. */
export function makeParapetTex() {
  const S = 256, { c, g } = mkCanvasK(S, S), rng = makeRng(7);
  g.clearRect(0, 0, S, S);
  const stone = (y0, h) => { fill(g, rgb(...STONE), 0, y0, S, h); grainK(g, 0, y0, S, h, 10, rng, 6); for (let y = y0; y < y0 + h; y += 16) fill(g, 'rgba(90,70,40,0.35)', 0, y, S, 1); };
  // crenellated (canvas 0..127): merlons 0..60% width, lower 45% solid
  stone(56, 72); for (let x = 0; x < S; x += S / 2) { fill(g, rgb(...STONE), x, 6, S * 0.28, 52); grainK(g, x, 6, S * 0.28 | 0, 52, 10, rng, 6); fill(g, shade(STONE, 1.12), x - 2, 4, S * 0.28 + 4, 6); }
  fill(g, shade(STONE, 1.12), 0, 54, S, 6);
  // plain (128..255)
  stone(150, 106); fill(g, shade(STONE, 1.12), 0, 144, S, 10); fill(g, 'rgba(0,0,0,0.25)', 0, 154, S, 3);
  return canvasTexture(c, { clampT: true });
}
export function makeHedgeTex() {
  const S = 256, { c, g } = mkCanvasK(S, S), rng = makeRng(9);
  fill(g, '#2e4a22', 0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const k = 0.6 + rng() * 0.8; g.fillStyle = rgb(52 * k, 86 * k, 36 * k, 0.9); g.beginPath(); g.ellipse(rng() * S, rng() * S, 2 + rng() * 3, 1.5 + rng() * 2, rng() * 3, 0, 7); g.fill(); }
  grainK(g, 0, 0, S, S, 10, rng, 14);
  return canvasTexture(c);
}
export function makeLeafTex() {
  const S = 256, { c, g } = mkCanvasK(S, S), rng = makeRng(10);
  fill(g, '#7a7a7a', 0, 0, S, S);
  for (let i = 0; i < 3000; i++) { const k = 0.55 + rng() * 0.9; g.fillStyle = rgb(170 * k, 170 * k, 170 * k, 0.9); g.beginPath(); g.ellipse(rng() * S, rng() * S, 2 + rng() * 4, 1.5 + rng() * 2, rng() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(rng() * S, rng() * S, 2 + rng() * 5, 0, 7); g.fill(); }
  return canvasTexture(c);
}
/**
 * Near-tree atlas, 1024×512 (graphics pass 4). Left half: four 256² alpha cut-out leaf-card cells (0, 1 broadleaf spray,
 * 2 conifer/yew fans, 3 hanging willow strands); x 512-767 an opaque column of dense shaded foliage (the crown's core);
 * x 768-1023 an opaque column of bark. Light, nearly neutral tones (warm highlights, cool shadows): the per-tree instance
 * colour multiplies it. Returned as a DataTexture so the transparent texels can carry leaf colour (no dark fringes in
 * the mips); v repeats (bark / core), u clamps. Cell i: u = (i % 2) / 4 .. +1/4, v = 1 - (row + 1) / 2 .. 1 - row / 2.
 */
export function makeTreeAtlas() {
  if (PRE.tree) return PRE.tree;
  // pass 7: painted at 2x (2048x1024; still 1024x512 when the GPU guess is the low tier) — the sprays on the 4 m cards of a
  // big plane were magnified into blobs. Same painting, same UVs; all coordinates below are in the logical 1024x512 space.
  const K = HI.on ? 4 : ATLAS.cell >= 512 ? 2 : 1, W = 1024, H = 512, S = 256, { g } = mkCanvas(W * K, H * K), rng = makeRng(4242);   // (texture pass 2: 4x on the top tier)
  g.clearRect(0, 0, W * K, H * K); g.setTransform(K, 0, 0, K, 0, 0);
  const TONE = [[70, 92, 80], [122, 146, 108], [184, 202, 136], [234, 240, 170]];
  // (with the photo leaves the tone is one of four steps a layer, so a tinted copy of the sheet is made per tone: 16 in all)
  const tone = (layer, j) => { const t = TONE[layer], k = 0.86 + 0.28 * (HI.on && HI.leaves ? Math.floor(j * 4) / 4 + 0.125 : j); return rgb(Math.min(255, t[0] * k), Math.min(255, t[1] * k), Math.min(255, t[2] * k)); };
  // texture pass 2 (top tier): real leaves. The sprite sheet (tools/surf_leaves.py: scanned leaves, each lying along x,
  // light neutral grey with its veins) is stamped where an ellipse was drawn, tinted with the same tone; the row is the
  // species look of the cell being painted (leafSet: 0 ovate, 1 lobed plane / maple, 2 conifer frond, 3 willow)
  const SHEET = HI.on && HI.leaves && HI.leaves.width ? HI.leaves : null, tinted = new Map();
  let leafSet = 0, leafN = 0;
  const LEAF_ASPECT = [0.6, 0.95, 0.34, 0.24];
  const tintedSheet = (col) => {
    let c = tinted.get(col); if (c) return c;
    c = document.createElement('canvas'); c.width = SHEET.width; c.height = SHEET.height; const t = c.getContext('2d');
    t.drawImage(SHEET, 0, 0); t.globalCompositeOperation = 'multiply'; t.fillStyle = col; t.fillRect(0, 0, c.width, c.height);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(SHEET, 0, 0);
    tinted.set(col, c); return c;
  };
  const leaf = (x, y, len, wid, ang, col) => {
    if (SHEET) {
      const cs = Math.cos(ang), sn = Math.sin(ang); g.setTransform(cs * K, sn * K, -sn * K, cs * K, x * K, y * K);
      const L = len * 1.45, h = Math.max(wid * 1.7, L * LEAF_ASPECT[leafSet]);
      g.drawImage(tintedSheet(col), ((leafN++ * 5) % 6) * 96, leafSet * 64, 96, 64, -L, -h, 2 * L, 2 * h);
      return;
    }
    const cs = Math.cos(ang), sn = Math.sin(ang); g.setTransform(cs * K, sn * K, -sn * K, cs * K, x * K, y * K); g.fillStyle = col;
    g.beginPath(); g.moveTo(-len, 0); g.quadraticCurveTo(0, -wid * 1.7, len, 0); g.quadraticCurveTo(0, wid * 1.7, -len, 0); g.fill();
  };
  const reset = () => g.setTransform(K, 0, 0, K, 0, 0);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng() * 0.999)) * 0.6;
  // a spray: sub-clumps of leaves on twigs, painted back (dark, cool) to front (light, warm, shifted towards the sun)
  const spray = (ox, oy, o) => {
    const cx = ox + S / 2, cy = oy + S / 2, clumps = [];
    for (let i = 0; i < o.clumps; i++) { const a = (i / o.clumps) * 6.283 + rng(), r = (i < 2 ? 0.1 : 0.14 + 0.2 * Math.sqrt(rng())) * S; clumps.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * o.sy, o.spread * (0.75 + 0.5 * rng())]); }
    g.strokeStyle = 'rgba(66,54,42,0.95)'; g.lineWidth = 2.2; g.beginPath();
    for (const q of clumps) { g.moveTo(cx, cy + S * 0.06); g.quadraticCurveTo((cx + q[0]) / 2, q[1] + 10, q[0], q[1]); } g.stroke();
    for (let layer = 0; layer < 4; layer++) {
      const n = o.leaves * [0.36, 0.3, 0.22, 0.12][layer];
      for (let i = 0; i < n; i++) {
        const q = clumps[(rng() * clumps.length) | 0], a = rng() * 6.283, r = q[2] * gauss();
        const x = q[0] + Math.cos(a) * r - layer * 1.5, y = q[1] + Math.sin(a) * r * o.sy - layer * 2.4;
        if (x < ox + 10 || x > ox + S - 10 || y < oy + 10 || y > oy + S - 10) continue;
        leaf(x, y, o.len * (0.7 + 0.6 * rng()), o.wid * (0.7 + 0.6 * rng()), o.ang ? o.ang() : rng() * 6.283, tone(layer, rng()));
      }
    }
    reset();
  };
  leafSet = 0; spray(0, 0, { clumps: 9, spread: 26, sy: 1, leaves: 1250, len: 6.2, wid: 2.5 });
  leafSet = 1; spray(S, 0, { clumps: 7, spread: 30, sy: 0.9, leaves: 1150, len: 7, wid: 2.8 });
  leafSet = 2;
  // conifer: flat fans of short needles, mostly horizontal
  spray(0, S, { clumps: 10, spread: 30, sy: 0.5, leaves: 2100, len: 6.5, wid: 1.0, ang: () => (rng() - 0.5) * 1.1 + (rng() < 0.5 ? 0 : Math.PI) });
  // willow: hanging strands with narrow leaves
  leafSet = 3;
  for (let i = 0; i < 17; i++) {
    const x0 = S + 18 + i * 13.6 + rng() * 6, top = S + 10 + rng() * 26, bot = 2 * S - 12 - rng() * 60, sway = (rng() - 0.5) * 16;
    g.strokeStyle = 'rgba(96,104,60,0.95)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, top); g.quadraticCurveTo(x0 + sway, (top + bot) / 2, x0 + sway * 0.4, bot); g.stroke();
    for (let y = top; y < bot; y += 3.2) {
      const t = (y - top) / (bot - top), x = x0 + sway * (2 * t * (1 - t) + 0.4 * t * t) + (rng() - 0.5) * 7, layer = rng() < 0.3 ? 0 : rng() < 0.5 ? 1 : rng() < 0.75 ? 2 : 3;
      if (x < S + 10 || x > 2 * S - 10) continue;
      leaf(x, y, 6.5 + rng() * 3, 1.5, Math.PI / 2 + (rng() - 0.5) * 0.9, tone(layer, rng()));
    }
    reset();
  }
  // core: dense foliage in shade, a few lit leaves
  leafSet = 0;
  fill(g, rgb(64, 84, 64), 2 * S, 0, S, H);
  for (let i = 0; i < 5200; i++) { const r = rng(), layer = r < 0.55 ? 0 : r < 0.9 ? 1 : 2, x = 2 * S + rng() * S, y = rng() * H; leaf(x, y, 5 + rng() * 4, 2.4, rng() * 6.283, tone(layer, rng() * 0.8)); }
  reset();
  for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(14,22,16,0.5)'; g.beginPath(); g.arc(2 * S + rng() * S, rng() * H, 3 + rng() * 7, 0, 7); g.fill(); }
  fill(g, rgb(52, 70, 56), 2 * S - 0.5, 0, 1, H);
  // bark: furrowed grey-brown with paler plates
  fill(g, rgb(148, 136, 118), 3 * S, 0, S, H);
  for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(${188 + rng() * 30 | 0},${182 + rng() * 26 | 0},${156 + rng() * 24 | 0},0.5)`; g.beginPath(); g.ellipse(3 * S + rng() * S, rng() * H, 5 + rng() * 12, 12 + rng() * 34, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 150; i++) {
    const x = 3 * S + rng() * S, y = rng() * H, l = 30 + rng() * 120, dark = rng() < 0.62;
    g.strokeStyle = dark ? `rgba(70,58,46,${0.45 + rng() * 0.4})` : 'rgba(206,196,172,0.35)'; g.lineWidth = dark ? 1 + rng() * 3 : 1 + rng() * 2;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rng() - 0.5) * 12, y + l / 2, x + (rng() - 0.5) * 8, y + l); g.stroke();
  }
  grain(g, 3 * S * K, 0, S * K, H * K, 12, rng, 9, 22 * K);
  // trees pass (photo comparison item 5): the right half of the bark strip is a London plane's — pale cream, olive and
  // grey-green flaking patches (vegetation.js tube() maps planes there, every other tree to the left half). Its own rng,
  // so nothing painted above changes.
  {
    const r2 = makeRng(5150), x0 = 3 * S + S / 2, w = S / 2;
    fill(g, rgb(168, 164, 136), x0, 0, w, H);
    const PATCH = [[140, 142, 112], [196, 190, 156], [160, 154, 110], [212, 206, 178], [124, 128, 102], [182, 174, 132]];
    g.save(); g.beginPath(); g.rect(x0, 0, w, H); g.clip();
    for (let i = 0; i < 900; i++) {
      const c = PATCH[(r2() * PATCH.length) | 0], x = x0 + r2() * w, y = r2() * H, rx = 2 + r2() * 6, ry = 4 + r2() * 16;
      g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.3 + r2() * 0.35})`; g.beginPath(); g.ellipse(x, y, rx, ry, (r2() - 0.5) * 0.8, 0, 7); g.fill();
    }
    g.restore();
  }
  // un-premultiplied pixels, rows flipped; transparent texels take the mean leaf colour so the mips do not darken
  const PW = W * K, PH = H * K, img = g.getImageData(0, 0, PW, PH), d = img.data, out = new Uint8Array(PW * PH * 4);
  for (let y = 0; y < PH; y++) {
    const so = y * PW * 4, to = (PH - 1 - y) * PW * 4;
    for (let x = 0; x < PW; x++) {
      const i = so + x * 4, j = to + x * 4; let a = d[i + 3];
      if (x < 2 * S * K) { if (a < 56) { out[j] = 128; out[j + 1] = 150; out[j + 2] = 108; } else { out[j] = d[i]; out[j + 1] = d[i + 1]; out[j + 2] = d[i + 2]; } a = Math.min(255, a * 1.3); }
      else { out[j] = d[i]; out[j + 1] = d[i + 1]; out[j + 2] = d[i + 2]; a = 255; }
      out[j + 3] = a;
    }
  }
  const t = new THREE.DataTexture(out, PW, PH, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4;
  if (HI.on) {
    // texture pass 2 (top tier): the mips are made here, each keeping the share of its texels that pass the leaf
    // cards' alpha test (0.4) equal to the full picture's — averaged alpha alone falls under the test and a crown
    // thins to twigs with distance
    t.mipmaps = coverageMips(out, PW, PH, 2 * S * K, 102); t.generateMipmaps = false; t.anisotropy = HI.aniso;
    if (HI.dxt && HI.dxt.dxt && HI.dxt.srgb) {
      // pass 3: stored as DXT5 (a quarter of the memory), each level encoded from the coverage-kept mip above
      const ct = compressedTexture(t.mipmaps.map((m) => ({ data: encodeLevel(m.data, m.width, m.height, 'dxt5'), width: m.width, height: m.height })), 'dxt5', { srgb: true, clampS: true, anisotropy: HI.aniso, name: 'tree-atlas' });
      t.dispose(); storeCompressed(PRE.v + 'tree', ct); return ct;
    }
  }
  t.needsUpdate = true;
  return t;
}
/**
 * Mip chain (RGBA8, box filter) of an alpha-tested picture whose cut-out part is the columns x < cutW: at every level
 * the alpha there is scaled so that the fraction of texels at or over `thr` stays what it is at level 0.
 */
const LIN = new Float32Array(256).map((_, i) => Math.pow(i / 255, 2.2));
function coverageMips(data, W, H, cutW, thr) {
  const mips = [{ data, width: W, height: H }];
  let cov0 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < cutW; x++) if (data[(y * W + x) * 4 + 3] >= thr) cov0++;
  cov0 /= Math.max(1, cutW * H);
  let src = data, w = W, h = H, cw = cutW;
  const hist = new Uint32Array(256);
  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), dst = new Uint8Array(nw * nh * 4), sx = w > 1 ? 2 : 1, sy = h > 1 ? 2 : 1;
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const o = (y * nw + x) * 4;
      for (let c = 0; c < 4; c++) {
        let v = 0;
        if (c < 3) { for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) v += LIN[src[((y * sy + j) * w + x * sx + i) * 4 + c]]; dst[o + c] = Math.round(255 * Math.pow(v / (sx * sy), 1 / 2.2)); }   // (colour averaged in linear light: the mips do not darken)
        else { for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) v += src[((y * sy + j) * w + x * sx + i) * 4 + c]; dst[o + c] = v / (sx * sy); }
      }
    }
    cw = Math.max(1, cw >> 1); hist.fill(0);
    const ncw = Math.min(cw, nw);
    for (let y = 0; y < nh; y++) for (let x = 0; x < ncw; x++) hist[dst[(y * nw + x) * 4 + 3]]++;
    // the alpha value above which cov0 of the texels lie -> scale it up to the test's threshold
    let need = cov0 * ncw * nh, acc = 0, cut = 255; for (; cut > 1; cut--) { acc += hist[cut]; if (acc >= need) break; }
    const k = Math.max(1, Math.min(4, thr / Math.max(1, cut)));
    if (k > 1.001) for (let y = 0; y < nh; y++) for (let x = 0; x < ncw; x++) { const o = (y * nw + x) * 4 + 3; dst[o] = Math.min(255, dst[o] * k); }
    mips.push({ data: dst, width: nw, height: nh });
    src = dst; w = nw; h = nh;
  }
  return mips;
}
/**
 * Far-tree billboard atlas: 5 cells (broad, conifer, willow, column, bush) of 256², transparent background; grey so the
 * instance colour tints it. Cell u 0..1 = card width (tree width), v 0..1 = ground..top.
 */
export function makeTreeBillboardTex() {
  // painted fallback for the baked impostors (no WebGL at build time): cells in vegetation.js SPECIES order
  const S = 256, NC = 6, { c, g } = mkCanvas(S * NC, S), rng = makeRng(77);
  g.clearRect(0, 0, S * NC, S);
  const shapes = [
    { trunk: [0.045, 0.5], blobs: [[0, 0.66, 0.31, 0.3], [0.15, 0.6, 0.22, 0.2], [-0.13, 0.75, 0.2, 0.2], [-0.12, 0.55, 0.18, 0.16]] },
    { trunk: [0.04, 0.25], cone: [0.12, 1.0, 0.31] },
    { trunk: [0.04, 0.6], blobs: [[0, 0.72, 0.26, 0.26], [0.12, 0.62, 0.18, 0.16], [-0.1, 0.84, 0.16, 0.14]] },
    { trunk: [0.06, 0.45], blobs: [[0, 0.62, 0.44, 0.26], [0.12, 0.72, 0.26, 0.18]], skirt: [0.14, 0.62, 0.48] },
    { trunk: [0.03, 0.3], blobs: [[0, 0.52, 0.14, 0.36], [0, 0.8, 0.1, 0.18]] },
    { trunk: null, blobs: [[0, 0.42, 0.48, 0.34], [0.28, 0.38, 0.3, 0.26]] },
  ];
  shapes.forEach((sh, i) => {
    const ox = i * S, X = (u) => ox + (u + 0.5) * S, Yp = (v) => (1 - v) * S;
    if (sh.trunk) { g.fillStyle = 'rgb(70,62,54)'; const w = sh.trunk[0] * S; g.fillRect(X(0) - w / 2, Yp(sh.trunk[1]), w, Yp(0) - Yp(sh.trunk[1])); }
    // sample clump centres inside the silhouette, paint darker ones first (core / underside), lighter on top
    const inside = (u, v) => {
      if (sh.cone) { const [v0, v1, r] = sh.cone, t = (v - v0) / (v1 - v0); if (t < 0 || t > 1) return 0; const w = r * (1 - t) * (0.85 + 0.15 * Math.sin(t * 40)); return Math.abs(u) < w ? 1 - t * 0.5 : 0; }
      let best = 0;
      for (const [bx, by, rx, ry] of sh.blobs) { const d = ((u - bx) / rx) ** 2 + ((v - by) / ry) ** 2; if (d < 1) best = Math.max(best, 1 - d); }
      if (sh.skirt) { const [v0, v1, r] = sh.skirt; if (v > v0 && v < v1 && Math.abs(u) < r * (0.75 + 0.25 * (v - v0) / (v1 - v0))) best = Math.max(best, 0.3); }
      return best;
    };
    const pts = [];
    for (let k = 0; k < 2600 && pts.length < 420; k++) { const u = rng() - 0.5, v = rng(); const w = inside(u, v); if (w > 0) pts.push([u, v, w]); }
    pts.sort((a, b2) => a[1] - b2[1]);
    for (const [u, v, w] of pts) {
      const lift = sh.cone ? 0.55 + 0.45 * ((u + 0.3) / 0.6) : 0.45 + 0.5 * v + 0.15 * u;
      const k = Math.min(1, (0.55 + 0.45 * lift) * (0.82 + rng() * 0.3)) * (0.7 + 0.3 * (1 - w * 0.6));
      g.fillStyle = rgb(190 * k, 196 * k, 182 * k);
      g.beginPath(); g.arc(X(u), Yp(v), (sh.cone ? 7 : 11) + rng() * 8, 0, 7); g.fill();
      g.fillStyle = `rgba(0,0,0,${0.12 + 0.15 * rng()})`; g.beginPath(); g.arc(X(u) + 2, Yp(v) + 3, 3 + rng() * 4, 0, 7); g.fill();
    }
  });
  return canvasTexture(c, { clampS: true, clampT: true });
}
export function makeBarkTex() {
  const W = 128, H = 256, { c, g } = mkCanvasK(W, H), rng = makeRng(12);
  fill(g, '#5a4a3a', 0, 0, W, H);
  for (let i = 0; i < 90; i++) { const k = 0.6 + rng() * 0.7; g.fillStyle = rgb(90 * k, 75 * k, 60 * k, 0.8); g.fillRect(rng() * W, 0, 1 + rng() * 4, H); }
  grainK(g, 0, 0, W, H, 14, rng, 10);
  return canvasTexture(c);
}
/** Radial glow, white centre → transparent (for additive light pools). */
export function makeGlowTex() {
  const S = 128, { c, g } = mkCanvas(S, S);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // pass 5: a lamp pool, not a blob: bright under the lantern, a long soft skirt
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.16, 'rgba(255,255,255,0.72)'); gr.addColorStop(0.42, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return canvasTexture(c, { clampS: true, clampT: true });
}

// ---------------------------------------------------------------- sign atlas
export const SIGN_COLS = 8, SIGN_ROWS = 64, SIGN_W = 256, SIGN_H = 48;   // one 2048-wide page holds every city sign (one draw)
/** signs: [{text, bg, fg, font?}] (≤ 84) -> {texture, uv(i) -> [u0,v0,u1,v1], aspect(i)} */
export function makeSignAtlas(signs) {
  const cols = Math.max(1, Math.min(SIGN_COLS, signs.length));
  // start-up (pass 4): the city's page (hundreds of signs) is restored from the cache when the very same signs were
  // painted at this size before — the hash is of every sign's text, colours and font
  const big = signs.length > 40, K0 = HI.on ? HI.sign : 1; let hash = '';
  if (big) { let h = 0x811c9dc5; const str = K0 + JSON.stringify(signs); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } hash = (h >>> 0).toString(16) + ':' + signs.length; }
  if (big && PRE.sign && PRE.sign.hash === hash && PRE.sign.aspects && PRE.sign.aspects.length === signs.length) {
    const P = PRE.sign, LW0 = cols * SIGN_W, LH0 = Math.max(64, Math.ceil(signs.length / cols) * SIGN_H);
    return {
      texture: P.texture, aspect: (i) => P.aspects[i],
      uv: (i) => { const col = i % cols, row = Math.floor(i / cols), w = Math.min(SIGN_W, P.aspects[i] * SIGN_H), cx = col * SIGN_W + SIGN_W / 2; return [(cx - w / 2) / LW0, 1 - ((row + 1) * SIGN_H - 2) / LH0, (cx + w / 2) / LW0, 1 - (row * SIGN_H + 2) / LH0]; },
    };
  }
  // (texture pass: on the top tier the page is painted 1.5x as large — lettering 45 px high; uv() is in page fractions either way)
  const K = HI.on ? HI.sign : 1, LW = cols * SIGN_W, LH = Math.max(64, Math.ceil(signs.length / cols) * SIGN_H);
  const { c, g } = mkCanvas(LW * K, LH * K);
  if (K !== 1) g.scale(K, K);
  fill(g, '#222', 0, 0, LW, LH);
  const aspects = [];
  signs.forEach((s, i) => {
    const x = (i % cols) * SIGN_W, y = Math.floor(i / cols) * SIGN_H;
    fill(g, s.bg, x, y, SIGN_W, SIGN_H);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, SIGN_W, 3); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + SIGN_H - 4, SIGN_W, 4);
    let size = 30;
    g.font = `${s.bold === false ? '' : 'bold '}${size}px ${s.font || 'Georgia, "Times New Roman", serif'}`;
    let tw = g.measureText(s.text).width || s.text.length * size * 0.55;
    if (tw > SIGN_W - 16) { size = Math.max(12, Math.floor(size * (SIGN_W - 16) / tw)); g.font = `${s.bold === false ? '' : 'bold '}${size}px ${s.font || 'Georgia, "Times New Roman", serif'}`; tw = g.measureText(s.text).width || s.text.length * size * 0.55; }
    g.fillStyle = s.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(s.text, x + SIGN_W / 2, y + SIGN_H / 2 + 1);
    if (s.border) { g.strokeStyle = s.border; g.lineWidth = 3; g.strokeRect(x + SIGN_W / 2 - tw / 2 - 11, y + 4.5, tw + 22, SIGN_H - 9); }
    if (s.underline) { g.fillStyle = s.underline; g.fillRect(x + SIGN_W / 2 - tw / 2, y + SIGN_H - 9, tw, 3); }
    aspects.push(Math.min(SIGN_W, tw + 28) / SIGN_H);
  });
  let t = canvasTexture(c, { clampS: true, clampT: true });
  if (HI.on && HI.dxt && c.width * c.height >= 2048 * 2048) { t = compressCanvasTexture(t, 'dxt1', HI.dxt, 'sign-page'); if (big && t.isCompressedTexture) storeCompressed(PRE.v + 'sign', t, { hash, aspects }); }   // (pass 3: the city's sign page, an eighth of the memory)
  return {
    texture: t,
    aspect: (i) => aspects[i],
    uv: (i) => {
      const col = i % cols, row = Math.floor(i / cols), w = Math.min(SIGN_W, aspects[i] * SIGN_H);
      const cx = col * SIGN_W + SIGN_W / 2;
      const u0 = (cx - w / 2) / LW, u1 = (cx + w / 2) / LW;
      const v1 = 1 - (row * SIGN_H + 2) / LH, v0 = 1 - ((row + 1) * SIGN_H - 2) / LH;
      return [u0, v0, u1, v1];
    },
  };
}

// ---------------------------------------------------------------- standalone repeatable textures (for places / interiors)
/** Paint one facade/ground/roof cell into its own canvas -> repeat texture (+ optional window emissive mask). */
function single(painters, i, size, withAux, seed) {
  // (texture pass: K times larger on the top tier; the painters still draw in `size` logical units)
  const K = hiK(), { c, g } = mkCanvas(size * K, size * K), rng = makeRng(seed);
  let a = mkCanvas(withAux ? size * K : 4, withAux ? size * K : 4).g;
  if (K !== 1) { g.scale(K, K); if (withAux) a.scale(K, K); }
  if (withAux) { a.fillStyle = 'rgb(0,0,0)'; a.fillRect(0, 0, size, size); }
  // aux in standalone mode: only glass matters -> draw glass as red; convert to white emissive mask below
  const noise = (x, y, w, h, amp, blotch) => grain(g, Math.round(x * K), Math.round(y * K), Math.round(w * K), Math.round(h * K), amp, rng, blotch, 24 * K);
  const auxProxy = withAux ? new Proxy(a, { get(t, k) { if (k === 'fillStyle') return t.fillStyle; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; }, set(t, k, v) { if (k === 'fillStyle') t.fillStyle = v === 'rgb(255,0,0)' ? '#ffffff' : '#000000'; else t[k] = v; return true; } }) : a;
  painters[i](g, auxProxy, size, rng, noise);
  return { map: canvasTexture(c), emissive: withAux ? canvasTexture(a.canvas || mkCanvas(4, 4).c) : null };
}
const cache = new Map();
const cached = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
/** Facade cell as its own texture: kind = key of FACADE_CELLS. uv: 1 repeat = one bay × one storey. */
export function facadeTexture(kind = 'stoneSash') {
  const i = FACADE_CELLS[kind] ?? 0;
  return cached('f' + i, () => single(cityPainters(), i, 256, true, 100 + i));
}
export function groundTexture(kind = 'grass') {
  const i = GROUND_CELLS[kind] ?? 4;
  return cached('g' + i, () => { const t = single(GROUND_PAINTERS, i, 256, false, 200 + i).map; t.userData.scale = GROUND_SCALE[i]; return t; });
}
export function roofTexture(kind = 'slate') {
  const i = ROOF_CELLS[kind] ?? 0;
  return cached('r' + i, () => { const t = single(cityPainters(), ROOF_OFS + i, 256, false, 300 + i).map; t.userData.scale = ROOF_SCALE[i]; return t; });
}

/** texture pass: a canvas of w x h LOGICAL units, K times larger in pixels on the top tier (K = 1: exactly mkCanvas) */
function mkCanvasK(w, h) { const K = hiK(), r = mkCanvas(w * K, h * K); if (K !== 1) r.g.scale(K, K); return r; }
function grainK(g, x, y, w, h, amp, rng, blotch = 0, bscale = 24) { const K = hiK(); grain(g, x * K, y * K, w * K, h * K, amp, rng, blotch, bscale * K); }
// interior surfaces (1 repeat = scale metres, see userData.scale)
export function plasterTexture(color = [232, 224, 206]) {
  return cached('plaster' + color, () => { const { c, g } = mkCanvasK(256, 256), rng = makeRng(401); fill(g, rgb(...color), 0, 0, 256, 256); grainK(g, 0, 0, 256, 256, 5, rng, 8, 40); const t = canvasTexture(c); t.userData.scale = 2; return t; });
}
export function woodFloorTexture(tone = [128, 86, 52]) {
  return cached('woodfloor' + tone, () => {
    const { c, g } = mkCanvasK(256, 256), rng = makeRng(402);
    for (let r = 0; r < 8; r++) {
      let x = -rng() * 120;
      while (x < 256) { const w = 60 + rng() * 90, k = 0.78 + rng() * 0.35; fill(g, rgb(tone[0] * k, tone[1] * k, tone[2] * k), x, r * 32, w - 1, 31); for (let i = 0; i < 5; i++) fill(g, 'rgba(0,0,0,0.08)', x, r * 32 + rng() * 30, w, 1); x += w; }
      fill(g, 'rgba(0,0,0,0.45)', 0, r * 32 + 31, 256, 1);
    }
    grainK(g, 0, 0, 256, 256, 6, rng, 4);
    const t = canvasTexture(c); t.userData.scale = 2; return t;
  });
}
export function carpetTexture(base = [120, 30, 36], pattern = [190, 150, 70]) {
  return cached('carpet' + base + pattern, () => {
    const { c, g } = mkCanvasK(256, 256), rng = makeRng(403);
    fill(g, rgb(...base), 0, 0, 256, 256);
    g.strokeStyle = rgb(...pattern, 0.6); g.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 20, y); g.lineTo(x, y + 20); g.lineTo(x - 20, y); g.closePath(); g.stroke(); }
    grainK(g, 0, 0, 256, 256, 14, rng, 0);
    const t = canvasTexture(c); t.userData.scale = 1.5; return t;
  });
}
export function tileTexture(a = '#e8e4da', b = '#2a2a2a') {
  return cached('tiles' + a + b, () => {
    const { c, g } = mkCanvasK(256, 256), rng = makeRng(404);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) fill(g, (i + j) % 2 ? a : b, i * 32, j * 32, 32, 32);
    fill(g, 'rgba(0,0,0,0)', 0, 0, 1, 1); grainK(g, 0, 0, 256, 256, 6, rng, 0);
    for (let i = 0; i <= 8; i++) { fill(g, 'rgba(120,120,120,0.5)', i * 32, 0, 1, 256); fill(g, 'rgba(120,120,120,0.5)', 0, i * 32, 256, 1); }
    const t = canvasTexture(c); t.userData.scale = 2; return t;
  });
}
export function panellingTexture(tone = [100, 64, 36]) {
  return cached('panel' + tone, () => {
    const { c, g } = mkCanvasK(256, 256), rng = makeRng(405);
    fill(g, rgb(...tone), 0, 0, 256, 256); grainK(g, 0, 0, 256, 256, 8, rng, 6);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const x = i * 128 + 14, y = j * 128 + 14; fill(g, 'rgba(0,0,0,0.3)', x, y, 100, 100); fill(g, rgb(tone[0] * 1.08, tone[1] * 1.08, tone[2] * 1.08), x + 4, y + 4, 92, 92); fill(g, 'rgba(255,255,255,0.08)', x + 4, y + 4, 92, 3); }
    const t = canvasTexture(c); t.userData.scale = 1.2; return t;
  });
}
export function bookTexture() {
  return cached('books', () => {
    const { c, g } = mkCanvasK(256, 256), rng = makeRng(406);
    fill(g, '#2a1c10', 0, 0, 256, 256);
    for (let shelf = 0; shelf < 4; shelf++) {
      let x = 2; const y0 = shelf * 64 + 6;
      while (x < 254) { const w = 5 + rng() * 9, h = 44 + rng() * 14, col = [[120, 30, 30], [30, 60, 40], [30, 40, 90], [140, 110, 60], [80, 50, 30], [60, 20, 50]][(rng() * 6) | 0], k = 0.7 + rng() * 0.5; fill(g, rgb(col[0] * k, col[1] * k, col[2] * k), x, y0 + 58 - h, w - 1, h); fill(g, 'rgba(230,200,120,0.5)', x + 1, y0 + 58 - h + 6, w - 3, 2); x += w; }
      fill(g, '#4a3220', 0, shelf * 64 + 58 + 6 - 6, 256, 6);
    }
    const t = canvasTexture(c); t.userData.scale = 2; return t;
  });
}
export function brickTexture() {
  return cached('brick', () => { const t = single(FACADE_PAINTERS, FACADE_CELLS.brickBlank, 256, false, 407).map; t.userData.scale = 2.6; return t; });
}
export function stoneTexture() {
  return cached('stone', () => { const t = single(FACADE_PAINTERS, FACADE_CELLS.stoneBlank, 256, false, 408).map; t.userData.scale = 3.2; return t; });
}
