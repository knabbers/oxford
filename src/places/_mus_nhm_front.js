// SHOWPIECE (plain version): the Oxford University Museum of Natural History seen from outside — the two-storey front
// of six bays either side of the central tower, the tower with its steep hipped roof, the long steep slate roof with
// triangular dormers, the stair turrets with conical roofs behind the rear corners, the side ranges, and the five
// glazed ridges of the court roof showing over them. Facts and dimensions: docs/research/museums.md §1.
//
// Interface: buildFront(ctx) -> { meshes: {key: Mesh}, group, dims }
//   ctx = { game, frame (from _mus_kit.frame: local x along the front, +x to the south; local z out of the front, to the
//           west; origin = the main door on the front wall line), annexes: [poly in local coords] }
// Everything is in ONE group placed by the frame's matrix; one mesh per material (front facade texture, stone, slate,
// glass roof, iron, paint).
import * as THREE from 'three';
import { Geo, museumMats } from './_mus_kit.js';
import { canvas, canvasTexture } from './_randolph_kit.js';
import { srng } from './_mus_logic.js';
import { mottle } from './_mus_fine.js';

export const NHM = {
  x0: -29.2, x1: 29.9,            // front wall ends (local x)
  depth: 53,                      // main block depth (local z 0 .. -53)
  front: 11,                      // front range depth
  eaves: 13, ridge: 20.6,         // front range
  floor1: 6.2,                    // first floor level (string course)
  tower: { x: 4, z0: 0.7, z1: -7.3, eaves: 24, top: 34.5 },
  bayN: 6,                        // bays either side of the tower
  court: { x: 17, z0: -11, z1: -46 },
  aisles: [[-17, -11.5, 13, 15.6], [-11.5, -6, 13, 15.6], [-6, 6, 14.2, 20.2], [6, 11.5, 13, 15.6], [11.5, 17, 13, 15.6]],   // x0, x1, eaves, ridge
  side: { eaves: 12, ridge: 16.8 },
  turret: { x: 27.6, z: -12.6, r: 2.3, h: 17.5, cone: 6.5 },
};

// ------------------------------------------------------------------------------------------------ the front textures
// One atlas, 4 cells of 512 x 1536 px: [0] a bay with carved window surrounds, [1] a bay left as plain blocks (the
// carvers were dismissed before they finished), both 4.25 m x 13 m; [2] the tower's front face and [3] its side
// faces, 8 m x 24 m: the portal with its banded orders and oak doors, the great window over it, the paired lights,
// the louvred belfry. Depth is painted: reveals in shadow, a line of shade under every band, cornice and sill.
/** the real leaf of the walk-in doorway (= natural_history_museum.js NHM_DOOR w / h; kept here so this module needs nothing from the interior) */
export const NHM_LEAF = { w: 1.45, h: 3.4 };
const STONE_RGB = [216, 199, 160], BAND = '#a9644a', BAND2 = '#b9785a', SHAFT_R = '#8a4638', SHAFT_G = '#69766a', MOULD = '#e4d6b2';
function wallPaint(g, r, x0, W, H, wm, hm) {
  const kx = W / wm, ky = H / hm;
  g.fillStyle = 'rgb(' + STONE_RGB.join(',') + ')'; g.fillRect(x0, 0, W, H);
  for (let y = 0, row = 0; y < hm; y += 0.37, row++) {
    let x = -(row % 2) * 0.4 - r() * 0.2;
    while (x < wm) { const w = 0.62 + r() * 0.5, d = (r() - 0.5) * 20, warm = (r() - 0.5) * 8; g.fillStyle = 'rgb(' + (STONE_RGB[0] + d + warm) + ',' + (STONE_RGB[1] + d) + ',' + (STONE_RGB[2] + d - warm) + ')'; g.fillRect(x0 + x * kx + 0.7, H - (y + 0.37) * ky + 0.7, w * kx - 1.4, 0.37 * ky - 1.4); x += w; }
  }
  mottle(g, x0, 0, W, H, r, 240, 0.05, 26);
  return { X: (m) => x0 + m * kx, Y: (m) => H - m * ky, kx, ky };
}
function bandPaint(g, r, C, x0, W, y, h, carved = false) {
  const top = C.Y(y + h), hh = h * C.ky;
  g.fillStyle = BAND; g.fillRect(x0, top, W, hh);
  for (let x = 0; x < W; x += 46 + r() * 30) { g.fillStyle = r() < 0.5 ? 'rgba(255,220,190,0.10)' : 'rgba(60,20,10,0.10)'; g.fillRect(x0 + x, top, 40, hh); }
  g.fillStyle = 'rgba(255,240,215,0.35)'; g.fillRect(x0, top, W, 1.5);
  const sh = g.createLinearGradient(0, top + hh, 0, top + hh + 14); sh.addColorStop(0, 'rgba(50,30,15,0.42)'); sh.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = sh; g.fillRect(x0, top + hh, W, 14);
  if (carved) for (let x = 10; x < W; x += 22) { g.fillStyle = 'rgba(240,226,190,0.9)'; g.beginPath(); g.ellipse(x0 + x, top + hh / 2, 8, hh * 0.32, (x % 44 ? 0.5 : -0.5), 0, 7); g.fill(); g.fillStyle = 'rgba(70,40,25,0.5)'; g.fillRect(x0 + x - 1, top + hh * 0.3, 2, hh * 0.4); }
}
/** a pointed window: cx, sill y0, springing ys, width w (m); lights; carved or left in block */
function windowPaint(g, r, C, cx, y0, ys, w, { lights = 2, carved = true, roundel = true, shafts = true, louvre = false, ring = 0.26 } = {}) {
  const X = C.X, Y = C.Y, k = C.kx, hw = w / 2;
  const path = (h2, top = true) => { g.beginPath(); g.moveTo(X(cx - h2), Y(y0)); g.lineTo(X(cx - h2), Y(ys)); g.quadraticCurveTo(X(cx - h2), Y(ys + h2 * 1.05), X(cx), Y(ys + h2 * 1.62)); g.quadraticCurveTo(X(cx + h2), Y(ys + h2 * 1.05), X(cx + h2), Y(ys)); g.lineTo(X(cx + h2), Y(y0)); if (top) g.closePath(); };
  // the surround: quoins and voussoirs alternately buff and red, a hood mould over it
  g.save(); g.lineJoin = 'round';
  path(hw + ring * 0.5, false); g.strokeStyle = 'rgba(50,30,15,0.5)'; g.lineWidth = ring * k + 5; g.stroke();
  g.strokeStyle = MOULD; g.lineWidth = ring * k; g.stroke();
  g.setLineDash([0.27 * k, 0.27 * k]); g.strokeStyle = carved ? BAND : BAND2; g.stroke(); g.setLineDash([]);
  if (carved) { path(hw + ring * 0.5, false); g.setLineDash([3, 13]); g.strokeStyle = 'rgba(70,50,30,0.55)'; g.lineWidth = ring * k * 0.5; g.stroke(); g.setLineDash([]); }
  path(hw + ring + 0.03, false); g.strokeStyle = 'rgba(255,244,220,0.6)'; g.lineWidth = 2; g.stroke();
  // glass, leading, the reveal in shadow
  path(hw); g.save(); g.clip();
  const gg = g.createLinearGradient(0, Y(ys + hw * 1.6), 0, Y(y0)); gg.addColorStop(0, '#141b22'); gg.addColorStop(1, '#33424d'); g.fillStyle = gg; g.fillRect(X(cx - hw), Y(ys + hw * 1.7), w * k, (ys + hw * 1.7 - y0) * C.ky);
  if (louvre) { for (let y = y0 + 0.1; y < ys + hw * 1.6; y += 0.26) { g.fillStyle = '#6d6a5c'; g.fillRect(X(cx - hw), Y(y + 0.12), w * k, 0.12 * C.ky); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(X(cx - hw), Y(y), w * k, 3); } }
  else {
    g.fillStyle = 'rgba(190,215,235,0.10)'; g.beginPath(); g.moveTo(X(cx - hw), Y(y0 + (ys - y0) * 0.2)); g.lineTo(X(cx + hw), Y(y0 + (ys - y0) * 0.75)); g.lineTo(X(cx + hw), Y(ys + hw)); g.lineTo(X(cx - hw), Y(y0 + (ys - y0) * 0.6)); g.fill();
    g.strokeStyle = 'rgba(150,165,170,0.32)'; g.lineWidth = 1.2;
    for (let y = y0 + 0.2; y < ys + hw * 1.5; y += 0.24) { g.beginPath(); g.moveTo(X(cx - hw), Y(y)); g.lineTo(X(cx + hw), Y(y)); g.stroke(); }
    for (let i = 1; i < lights * 3; i++) { const x = cx - hw + (w * i) / (lights * 3); g.beginPath(); g.moveTo(X(x), Y(y0)); g.lineTo(X(x), Y(ys + hw * 1.6)); g.stroke(); }
  }
  // plate tracery: the head filled with stone, pierced by the pointed lights and a roundel
  if (lights > 1) {
    const lw = w / lights, lh = lw / 2 - 0.05, ysl = ys - lh * 0.5;
    g.beginPath(); g.rect(X(cx - hw), Y(ys + hw * 1.7), w * k, (ys + hw * 1.7 - ysl) * C.ky);
    for (let i = 0; i < lights; i++) { const lx = cx - hw + lw * (i + 0.5); g.moveTo(X(lx - lh), Y(ysl)); g.quadraticCurveTo(X(lx - lh), Y(ysl + lh * 1.05), X(lx), Y(ysl + lh * 1.6)); g.quadraticCurveTo(X(lx + lh), Y(ysl + lh * 1.05), X(lx + lh), Y(ysl)); g.closePath(); }
    const cy = ys + hw * 0.78, cr = hw * (lights > 2 ? 0.3 : 0.36);
    if (roundel) { g.moveTo(X(cx) + cr * k, Y(cy)); g.arc(X(cx), Y(cy), cr * k, 0, Math.PI * 2); }
    g.fillStyle = '#d3c39c'; g.fill('evenodd'); g.strokeStyle = 'rgba(50,30,15,0.45)'; g.lineWidth = 1.5; g.stroke();
    if (roundel) { g.fillStyle = '#d3c39c'; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; g.beginPath(); g.arc(X(cx) + Math.cos(a) * cr * k, Y(cy) + Math.sin(a) * cr * k, cr * k * 0.22, 0, 7); g.fill(); } }
    g.fillStyle = '#d3c39c'; for (let i = 1; i < lights; i++) g.fillRect(X(cx - hw + lw * i) - 0.05 * k, Y(ysl + 0.02), 0.1 * k, (ysl - y0) * C.ky + 2);
  }
  path(hw); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.2 * k; g.stroke();
  g.restore();
  // jamb shafts of polished stone with capitals (carved leaves, or the uncut block) and bases
  if (shafts) for (const s of [-1, 1]) {
    const sx = X(cx + s * (hw + ring * 0.5)), sw = 0.11 * k;
    g.fillStyle = s * (carved ? 1 : -1) > 0 ? SHAFT_R : SHAFT_G; g.fillRect(sx - sw / 2, Y(ys - 0.2), sw, (ys - 0.2 - y0 - 0.15) * C.ky);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(sx - sw * 0.25, Y(ys - 0.2), sw * 0.22, (ys - 0.2 - y0 - 0.15) * C.ky);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(sx + sw * 0.3, Y(ys - 0.2), sw * 0.2, (ys - 0.2 - y0 - 0.15) * C.ky);
    g.fillStyle = MOULD; g.fillRect(sx - sw, Y(y0 + 0.15), sw * 2, 0.15 * C.ky);
    if (carved) { g.fillStyle = '#eadcb6'; g.beginPath(); g.moveTo(sx - sw * 0.6, Y(ys - 0.2)); g.lineTo(sx - sw * 1.5, Y(ys + 0.08)); g.lineTo(sx + sw * 1.5, Y(ys + 0.08)); g.lineTo(sx + sw * 0.6, Y(ys - 0.2)); g.fill(); g.fillStyle = 'rgba(80,60,35,0.6)'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(sx + i * sw * 0.7, Y(ys - 0.04), sw * 0.3, 0.09 * C.ky, i * 0.5, 0, 7); g.fill(); } }
    else { g.fillStyle = '#d9caa2'; g.fillRect(sx - sw * 1.3, Y(ys + 0.1), sw * 2.6, 0.3 * C.ky); g.strokeStyle = 'rgba(60,40,20,0.4)'; g.lineWidth = 1.5; g.strokeRect(sx - sw * 1.3, Y(ys + 0.1), sw * 2.6, 0.3 * C.ky); }
  }
  // sill
  g.fillStyle = MOULD; g.fillRect(X(cx - hw - ring - 0.08), Y(y0), (w + ring * 2 + 0.16) * k, 0.14 * C.ky);
  const sh = g.createLinearGradient(0, Y(y0 - 0.14), 0, Y(y0 - 0.45)); sh.addColorStop(0, 'rgba(50,30,15,0.4)'); sh.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = sh; g.fillRect(X(cx - hw - ring - 0.08), Y(y0 - 0.14), (w + ring * 2 + 0.16) * k, 0.31 * C.ky);
  g.restore();
}
function eavesPaint(g, C, x0, W, y) {
  g.fillStyle = MOULD; g.fillRect(x0, C.Y(y + 0.35), W, 0.35 * C.ky);
  g.fillStyle = 'rgba(50,30,15,0.45)'; g.fillRect(x0, C.Y(y), W, 0.32 * C.ky);
  g.fillStyle = '#d8c9a2'; for (let x = 0.12; x < W / C.kx; x += 0.42) g.fillRect(x0 + x * C.kx, C.Y(y), 0.2 * C.kx, 0.26 * C.ky);
}
function bayCanvas() {
  const W = 512, H = 1536, { canvas: c, g } = canvas(W * 4, H), r = srng(41);
  for (let v = 0; v < 2; v++) {
    const x0 = v * W, carved = v === 0, C = wallPaint(g, r, x0, W, H, 4.25, 13);
    g.fillStyle = '#b9a988'; g.fillRect(x0, C.Y(0.9), W, 0.9 * C.ky); g.fillStyle = 'rgba(40,25,10,0.25)'; g.fillRect(x0, C.Y(0.9), W, 4);
    for (const [y, h, cv] of [[0.9, 0.2, 0], [1.55, 0.12, 0], [3.5, 0.1, 0], [5.95, 0.36, 1], [7.0, 0.12, 0], [9.6, 0.1, 0], [12.0, 0.22, 0]]) bandPaint(g, r, C, x0, W, y, h, cv && carved);
    g.save(); g.beginPath(); g.rect(x0, 0, W, H); g.clip();
    windowPaint(g, r, C, 2.125, 1.75, 4.05, 1.7, { carved });                 // ground floor: one two-light window
    windowPaint(g, r, C, 1.12, 7.25, 10.0, 1.25, { carved });                 // first floor: a pair
    windowPaint(g, r, C, 3.13, 7.25, 10.0, 1.25, { carved });
    if (carved) { g.fillStyle = MOULD; g.beginPath(); g.arc(C.X(2.125), C.Y(11.0), 0.2 * C.kx, 0, 7); g.fill(); g.fillStyle = BAND; g.beginPath(); g.arc(C.X(2.125), C.Y(11.0), 0.11 * C.kx, 0, 7); g.fill(); }   // an inlaid disc of coloured stone between the pair
    eavesPaint(g, C, x0, W, 12.6);
    g.restore();
  }
  for (let v = 2; v < 4; v++) {
    const x0 = v * W, front = v === 2, C = wallPaint(g, r, x0, W, H, 8, 24);
    g.save(); g.beginPath(); g.rect(x0, 0, W, H); g.clip();
    g.fillStyle = '#b9a988'; g.fillRect(x0, C.Y(0.9), W, 0.9 * C.ky);
    for (const [y, h] of [[0.9, 0.2], [3.5, 0.1], [6.1, 0.3], [9.6, 0.1], [12.4, 0.3], [15.2, 0.12], [18.3, 0.3], [21.0, 0.12], [23.2, 0.3]]) bandPaint(g, r, C, x0, W, y, h, y === 6.1 || y === 18.3);
    // clasping buttress strips at the corners
    for (const bx of [0, 7.3]) { g.fillStyle = 'rgba(255,245,220,0.16)'; g.fillRect(C.X(bx), 0, 0.7 * C.kx, H); g.fillStyle = 'rgba(50,30,15,0.28)'; g.fillRect(C.X(bx === 0 ? 0.7 : 7.3) - 2, 0, 4, H); }
    if (front) {
      // the portal: three banded orders round a pointed arch, carved jambs, oak doors with iron straps
      const X = C.X, Y = C.Y, k = C.kx;
      const arch = (hw, ys) => { g.beginPath(); g.moveTo(X(4 - hw), Y(0)); g.lineTo(X(4 - hw), Y(ys)); g.quadraticCurveTo(X(4 - hw), Y(ys + hw * 0.95), X(4), Y(ys + hw * 1.3)); g.quadraticCurveTo(X(4 + hw), Y(ys + hw * 0.95), X(4 + hw), Y(ys)); g.lineTo(X(4 + hw), Y(0)); };
      [[2.75, MOULD, BAND], [2.35, '#d8c89e', BAND2], [1.95, MOULD, BAND]].forEach(([hw, a, b], i) => {
        arch(hw, 3.3); g.strokeStyle = 'rgba(40,25,10,0.55)'; g.lineWidth = 0.42 * k + 4; g.stroke(); g.strokeStyle = a; g.lineWidth = 0.4 * k; g.stroke();
        g.setLineDash([0.3 * k, 0.3 * k]); g.lineDashOffset = i * 0.3 * k; g.strokeStyle = b; g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
        if (i === 1) { g.setLineDash([4, 12]); g.strokeStyle = 'rgba(60,45,25,0.6)'; g.lineWidth = 0.2 * k; g.stroke(); g.setLineDash([]); }
      });
      arch(1.72, 3.3); g.closePath(); g.fillStyle = '#2b1d12'; g.fill();
      g.save(); g.clip();
      // One doorway (walk-in, second pass): the museum's court is a walk-in room whose street door is the NORTH leaf of
      // this pair — a real oak leaf 1.45 m wide and 3.4 m high (natural_history_museum.js NHM_DOOR; core punches that
      // rectangle). So the painted doorway is drawn as exactly that pair: two six-panelled oak leaves of that size and
      // colour (the door's own oak, #4a3220) meeting at the middle, dark oak posts at the jambs, a transom at the
      // springing and a boarded tympanum in the arch. The south leaf (painted) stays shut.
      { const R = (xa, ya, xb, yb, col) => { g.fillStyle = col; g.fillRect(X(xa), Y(yb), (xb - xa) * k, (yb - ya) * C.ky); };
        const LW = NHM_LEAF.w, LH = NHM_LEAF.h;
        for (let x = 2.3; x < 5.8; x += 0.24) R(x, LH, x + 0.03, 5.8, 'rgba(0,0,0,0.3)');                    // the tympanum's boards
        R(4 - LW, 0, 4 + LW, LH, '#6a4930');   // (painted a little lighter than the leaf's #4a3220: this wall's texture is lit less than the leaf is — matched on screen)                                                               // the two leaves
        for (const s of [-1, 1]) { const xa = s < 0 ? 4 - LW : 4, st = 0.14, pw = (LW - 3 * st) / 2;
          for (let c = 0; c < 2; c++) for (const [ya, yb] of [[0.3, 1.25], [1.42, 2.3], [2.47, LH - 0.16]]) { const px = xa + st + c * (pw + st); R(px, ya, px + pw, yb, 'rgba(0,0,0,0.42)'); R(px + 0.035, ya + 0.035, px + pw - 0.035, yb - 0.035, 'rgba(112,80,54,0.9)'); }
          R(4 + s * 0.1 - 0.03, 1.02, 4 + s * 0.1 + 0.03, 1.08, '#b09a5a'); }                               // knobs
        R(4 - 0.012, 0, 4 + 0.012, LH, '#140d08');                                                         // the meeting stiles
        R(4 - 1.75, 0, 4 - LW, LH, '#2a1c12'); R(4 + LW, 0, 4 + 1.75, LH, '#2a1c12');                         // posts
        R(4 - 1.75, LH, 4 + 1.75, LH + 0.16, '#21160e'); R(4 - 1.75, LH + 0.16, 4 + 1.75, LH + 0.2, 'rgba(0,0,0,0.45)'); }   // transom
      arch(1.72, 3.3); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 0.3 * k; g.stroke();
      g.restore();
      for (const s of [-1, 1]) for (const dx of [2.05, 2.5]) { g.fillStyle = dx > 2.2 ? SHAFT_R : SHAFT_G; g.fillRect(X(4 + s * dx) - 0.07 * k, Y(3.1), 0.14 * k, 2.8 * C.ky); g.fillStyle = '#eadcb6'; g.fillRect(X(4 + s * dx) - 0.14 * k, Y(3.4), 0.28 * k, 0.3 * C.ky); g.fillRect(X(4 + s * dx) - 0.12 * k, Y(0.3), 0.24 * k, 0.3 * C.ky); }
      windowPaint(g, r, C, 4, 7.6, 10.1, 2.6, { lights: 3, ring: 0.34 });
    } else {
      windowPaint(g, r, C, 4, 1.9, 4.0, 1.5, { carved: false });
      windowPaint(g, r, C, 4, 7.6, 10.2, 1.8, { ring: 0.3 });
    }
    windowPaint(g, r, C, 2.9, 13.3, 15.9, 1.1, { lights: 1, ring: 0.24 }); windowPaint(g, r, C, 5.1, 13.3, 15.9, 1.1, { lights: 1, ring: 0.24 });
    for (const cx of [1.8, 4, 6.2]) windowPaint(g, r, C, cx, 19.1, 21.6, 1.25, { lights: 1, louvre: true, ring: 0.24 });
    eavesPaint(g, C, x0, W, 23.5);
    g.restore();
  }
  return c;
}

let _bayMat = null;
function bayMaterial() {
  if (_bayMat) return _bayMat;
  const t = canvasTexture(bayCanvas); t.anisotropy = 8;
  return (_bayMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, name: 'mus-nhm-bays' }));
}

const SLATE = 0x6c7470, STONE = 0xffffff, BUFF = 0xf0e4c8, RED = 0xb87a5e, IRON = 0x3a4448, DARK = 0x1c2024;

/** windows as dark recessed panels along a wall a->b (local), every `step` m, from y0 to y1 (on the outside, normal n) */
function windowsAlong(G, a, b, y0, y1, step, out, w = 1.3, pointed = true) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = out[0], nz = out[1];
  const n = Math.max(1, Math.floor(L / step));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * (L / n), cx = a[0] + ux * t + nx * 0.03, cz = a[1] + uz * t + nz * 0.03;
    const p = (s, y) => [cx + ux * s, y, cz + uz * s];
    G.color(DARK);
    G.poly('paint', [p(-w / 2, y0), p(w / 2, y0), p(w / 2, y1), p(-w / 2, y1)], [nx, 0, nz]);
    if (pointed) G.poly('paint', [p(-w / 2, y1), p(w / 2, y1), p(0, y1 + w * 0.6)], [nx, 0, nz]);
    G.color(RED); G.poly('paint', [p(-w / 2 - 0.12, y0 - 0.15), p(w / 2 + 0.12, y0 - 0.15), p(w / 2 + 0.12, y0), p(-w / 2 - 0.12, y0)], [nx, 0, nz]);
  }
}
/** a closed prism of walls (local poly) from y0 to y1 with key/colour, and windows on every edge longer than 3 m */
function block(G, poly, y0, y1, key = 'stone', col = BUFF, win = null) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz;
    let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
    G.color(col); G.poly(key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [nx, 0, nz]);
    if (win && l > 3) for (const [w0, w1] of win) windowsAlong(G, a, b, w0, w1, 3.6, [nx, nz]);
  }
}

export function buildFront(ctx) {
  const { game, frame } = ctx, D = NHM, M = museumMats(), W = game.world;
  const G = new Geo();
  const bay = (x0, x1, carved) => {
    const u = carved ? [0.001, 0, 0.249, 1] : [0.251, 0, 0.499, 1];
    G.quadUV('bays', [x0, 0, 0], [x1, 0, 0], [x1, D.eaves, 0], [x0, D.eaves, 0], u);
  };
  // ---- the front wall: six bays each side of the tower (about a third carved — the rest left as plain blocks)
  const T = D.tower;
  const carvedSet = new Set([0, 3, 5, 8, 10]);   // GUESS which ones
  for (let s = 0; s < 2; s++) {
    const xa = s ? T.x : D.x0, xb = s ? D.x1 : -T.x, bw = (xb - xa) / D.bayN;
    for (let i = 0; i < D.bayN; i++) bay(xa + i * bw, xa + (i + 1) * bw, carvedSet.has(s * D.bayN + i));
  }
  // ends and back of the front range + parapet line
  G.color(BUFF);
  G.poly('stone', [[D.x0, 0, 0], [D.x0, 0, -D.front], [D.x0, D.eaves, -D.front], [D.x0, D.eaves, 0]], [-1, 0, 0]);
  G.poly('stone', [[D.x1, 0, -D.front], [D.x1, 0, 0], [D.x1, D.eaves, 0], [D.x1, D.eaves, -D.front]], [1, 0, 0]);
  // gable ends of the steep roof (stone, with a small rose window)
  for (const [x, nx] of [[D.x0, -1], [D.x1, 1]]) {
    G.color(BUFF); G.poly('stone', [[x, D.eaves, 0], [x, D.eaves, -D.front], [x, D.ridge, -D.front / 2]], [nx, 0, 0]);
    G.color(DARK); G.cyl('paint', x + nx * 0.05, D.eaves + 2.2, -D.front / 2, 0.9, 0.02, 10);
  }
  // ---- steep slate roof with triangular dormers and ventilators
  G.color(SLATE);
  G.poly('slate', [[D.x0 - 0.3, D.eaves - 0.3, 0.6], [D.x1 + 0.3, D.eaves - 0.3, 0.6], [D.x1 + 0.3, D.ridge, -D.front / 2], [D.x0 - 0.3, D.ridge, -D.front / 2]], [0, 1, 1]);
  G.poly('slate', [[D.x1 + 0.3, D.eaves - 0.3, -D.front - 0.6], [D.x0 - 0.3, D.eaves - 0.3, -D.front - 0.6], [D.x0 - 0.3, D.ridge, -D.front / 2], [D.x1 + 0.3, D.ridge, -D.front / 2]], [0, 1, -1]);
  G.color(0x8a8070); G.beam('paint', [D.x0 - 0.3, D.ridge + 0.08, -D.front / 2], [D.x1 + 0.3, D.ridge + 0.08, -D.front / 2], 0.22, 0.18);
  {
    const slope = (D.ridge - D.eaves) / (D.front / 2);
    for (let s = 0; s < 2; s++) {
      const xa = s ? T.x : D.x0, xb = s ? D.x1 : -T.x, bw = (xb - xa) / D.bayN;
      for (let i = 0; i < D.bayN; i++) {
        const cx = xa + (i + 0.5) * bw, z0 = 0.2, y0 = D.eaves + 0.4, zf = -1.6, yb = y0 + slope * (z0 - zf) * 0 + 0.0, h = 2.0, w = 0.9;
        // a small triangular dormer face standing on the slope, its cheeks back to the roof
        const yRoof = (z) => D.eaves + slope * (0 - z) - 0.3 + slope * 0.6 * 0;
        const zb = zf - h / slope;
        G.color(BUFF); G.poly('stone', [[cx - w, y0 + 0.6, zf], [cx + w, y0 + 0.6, zf], [cx, y0 + 0.6 + h, zf]], [0, 0, 1]);
        G.color(DARK); G.poly('paint', [[cx - w * 0.45, y0 + 0.75, zf + 0.02], [cx + w * 0.45, y0 + 0.75, zf + 0.02], [cx, y0 + 0.75 + h * 0.6, zf + 0.02]], [0, 0, 1]);
        G.color(SLATE);
        G.poly('slate', [[cx - w - 0.1, y0 + 0.55, zf + 0.1], [cx, y0 + 0.75 + h, zf + 0.1], [cx, yRoof(zb) + 0.3, zb]], [-1, 1, 0]);
        G.poly('slate', [[cx + w + 0.1, y0 + 0.55, zf + 0.1], [cx, yRoof(zb) + 0.3, zb], [cx, y0 + 0.75 + h, zf + 0.1]], [1, 1, 0]);
        void yb;
      }
    }
    // ventilators on the ridge (little louvred lanterns with spirelets)
    for (const x of [-16, 16]) { G.color(0x4a5450); G.box('paint', x - 0.7, D.ridge - 0.2, -D.front / 2 - 0.7, x + 0.7, D.ridge + 1.2, -D.front / 2 + 0.7); G.color(SLATE); G.hipRoof('slate', x - 0.85, -D.front / 2 - 0.85, x + 0.85, -D.front / 2 + 0.85, D.ridge + 1.2, D.ridge + 3.2, 0.85, 0.85); }
  }
  // ---- the tower: three storeys over the door, steep hipped roof (faces from the atlas: portal, great window, belfry)
  {
    const x0 = -T.x, x1 = T.x, z0 = T.z0, z1 = T.z1;
    G.quadUV('bays', [x0, 0, z0], [x1, 0, z0], [x1, T.eaves, z0], [x0, T.eaves, z0], [0.501, 0, 0.749, 1]);
    G.quadUV('bays', [x1, 0, z0], [x1, 0, z1], [x1, T.eaves, z1], [x1, T.eaves, z0], [0.751, 0, 0.999, 1]);
    G.quadUV('bays', [x0, 0, z1], [x0, 0, z0], [x0, T.eaves, z0], [x0, T.eaves, z1], [0.751, 0, 0.999, 1]);
    G.color(BUFF); G.poly('stone', [[x1, 0, z1], [x0, 0, z1], [x0, T.eaves, z1], [x1, T.eaves, z1]], [0, 0, -1]);
    // projecting bands (they throw a real shadow line) and the corbelled eaves
    G.color(RED); for (const y of [6.1, 12.4, 18.3]) G.box('stone', x0 - 0.07, y, z1 - 0.07, x1 + 0.07, y + 0.3, z0 + 0.07);
    G.color(0xd8c8a0); G.box('stone', x0 - 0.2, T.eaves - 0.5, z1 - 0.2, x1 + 0.2, T.eaves - 0.25, z0 + 0.2); G.box('stone', x0 - 0.4, T.eaves - 0.25, z1 - 0.4, x1 + 0.4, T.eaves, z0 + 0.4);
    // steep wedge roof with a flat crest, banded slates, a lucarne on each face
    const zm = (z0 + z1) / 2;
    G.color(SLATE); G.hipRoof('slate', x0 - 0.4, z1 - 0.4, x1 + 0.4, z0 + 0.4, T.eaves, T.top, (x1 - x0) / 2 - 0.9, (z0 - z1) / 2 + 0.25);
    const f1 = 0.3, f2 = 0.62, hx = (x1 - x0) / 2 + 0.4, hz = (z0 - z1) / 2 + 0.4, ix = hx - 1.3, iz = hz - 0.15, hh = T.top - T.eaves;
    for (const [fa, fb, col] of [[f1, f1 + 0.07, 0x8a7a86], [f2, f2 + 0.07, 0x7f8f84]]) {
      const ring = (f, o) => [[-hx + ix * f - o, zm + hz - iz * f + o], [hx - ix * f + o, zm + hz - iz * f + o], [hx - ix * f + o, zm - hz + iz * f - o], [-hx + ix * f - o, zm - hz + iz * f - o]];
      const A = ring(fa, 0.03), B2 = ring(fb, 0.03); G.color(col);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; G.poly('paint', [[A[i][0], T.eaves + hh * fa, A[i][1]], [A[j][0], T.eaves + hh * fa, A[j][1]], [B2[j][0], T.eaves + hh * fb, B2[j][1]], [B2[i][0], T.eaves + hh * fb, B2[i][1]]], [(A[i][0] + A[j][0]) / 2, 2, (A[i][1] + A[j][1]) / 2 - zm]); }
    }
  }
  // ---- relief along the front: plinth, the string course at the first floor, the eaves cornice
  for (const [xa, xb] of [[D.x0, -T.x], [T.x, D.x1]]) {
    G.color(0xcbbd9c); G.box('stone', xa, 0, 0, xb, 0.9, 0.1);
    G.color(RED); G.box('stone', xa, 5.95, 0, xb, 6.3, 0.09);
    G.color(0xe0d2ae); G.box('stone', xa, D.eaves - 0.36, 0, xb, D.eaves - 0.05, 0.3);
  }
  // bands of coloured slate along the big roof (purple and green courses), an iron ridge
  {
    const sl = (D.ridge - D.eaves + 0.3) / (D.front / 2 + 0.6);
    for (const [f, col] of [[0.3, 0x8a7a86], [0.36, 0x7f8f84], [0.66, 0x8a7a86], [0.72, 0x7f8f84]]) for (const sg of [1, -1]) {
      const zc = -D.front / 2, za = zc + sg * (D.front / 2 + 0.6) * (1 - f), zb = zc + sg * (D.front / 2 + 0.6) * (1 - f - 0.035), ya = D.eaves - 0.3 + sl * (D.front / 2 + 0.6) * f + 0.03, yb = ya + sl * (D.front / 2 + 0.6) * 0.035;
      G.color(col); G.poly('paint', [[D.x0 - 0.3, ya, za], [D.x1 + 0.3, ya, za], [D.x1 + 0.3, yb, zb], [D.x0 - 0.3, yb, zb]], [0, 1, sg]);
    }
  }
  // ---- stair turrets behind the rear corners of the front range (angular, tall conical roofs)
  for (const sx of [-1, 1]) {
    const t = D.turret, x = sx * t.x;
    G.color(BUFF); G.cyl('stone', x, 0, t.z, t.r, t.h, 8, t.r, false);
    G.color(RED); G.cyl('stone', x, t.h - 0.6, t.z, t.r + 0.08, 0.6, 8, t.r + 0.08, false);
    G.color(SLATE); G.cyl('slate', x, t.h, t.z, t.r + 0.3, t.cone, 8, 0.0, false);
    G.color(DARK); for (let k = 0; k < 3; k++) { const y = 4 + k * 4.5, a = sx > 0 ? -Math.PI / 2 : Math.PI / 2, px = x + Math.sin(a) * (t.r + 0.02), pz = t.z + Math.cos(a) * (t.r + 0.02); G.poly('paint', [[px, y, pz - 0.3], [px, y, pz + 0.3], [px, y + 1.4, pz + 0.3], [px, y + 1.4, pz - 0.3]], [Math.sin(a), 0, Math.cos(a)]); }
  }
  // ---- side ranges and the back
  const C = D.court;
  for (const sx of [-1, 1]) {
    const xi = sx * C.x, xo = sx > 0 ? D.x1 : (D.x0 + 0.0);
    const poly = [[Math.min(xi, xo), C.z0], [Math.max(xi, xo), C.z0], [Math.max(xi, xo), -D.depth], [Math.min(xi, xo), -D.depth]];
    block(G, poly, 0, D.side.eaves, 'stone', BUFF, [[2.0, 4.6], [7.2, 10.2]]);
    const xm = (xi + xo) / 2, hw = Math.abs(xo - xi) / 2;
    G.color(SLATE);
    G.poly('slate', [[xm - hw - 0.3, D.side.eaves, C.z0], [xm, D.side.ridge, C.z0], [xm, D.side.ridge, -D.depth - 0.3], [xm - hw - 0.3, D.side.eaves, -D.depth - 0.3]], [-1, 1, 0]);
    G.poly('slate', [[xm + hw + 0.3, D.side.eaves, -D.depth - 0.3], [xm, D.side.ridge, -D.depth - 0.3], [xm, D.side.ridge, C.z0], [xm + hw + 0.3, D.side.eaves, C.z0]], [1, 1, 0]);
    G.color(BUFF); G.poly('stone', [[xm - hw, D.side.eaves, -D.depth], [xm + hw, D.side.eaves, -D.depth], [xm, D.side.ridge, -D.depth]], [0, 0, -1]);
  }
  // rear range behind the court (the Pitt Rivers is built against it)
  block(G, [[-C.x, C.z1], [C.x, C.z1], [C.x, -D.depth], [-C.x, -D.depth]], 0, 12, 'stone', BUFF);
  G.color(0x8a8a84); G.poly('stone', [[-C.x, 12, C.z1], [C.x, 12, C.z1], [C.x, 12, -D.depth], [-C.x, 12, -D.depth]], [0, 1, 0]);
  // ---- the court roof: five glazed ridges along the court (central one taller), iron ridges and gable frames
  for (const [x0, x1, e, r] of D.aisles) {
    const xm = (x0 + x1) / 2;
    G.color(0xffffff);
    G.poly('glassRoof', [[x0, e, C.z0], [xm, r, C.z0], [xm, r, C.z1], [x0, e, C.z1]], [-1, 1, 0]);
    G.poly('glassRoof', [[x1, e, C.z1], [xm, r, C.z1], [xm, r, C.z0], [x1, e, C.z0]], [1, 1, 0]);
    G.poly('glassRoof', [[x0, e, C.z1], [x1, e, C.z1], [xm, r, C.z1]], [0, 0, -1]);
    G.color(IRON);
    G.beam('paint', [xm, r + 0.05, C.z0], [xm, r + 0.05, C.z1], 0.14);
    for (let z = C.z0; z >= C.z1 - 0.01; z -= (C.z0 - C.z1) / 7) { G.beam('paint', [x0, e + 0.03, z], [xm, r + 0.03, z], 0.08); G.beam('paint', [xm, r + 0.03, z], [x1, e + 0.03, z], 0.08); }
    G.color(BUFF);
  }
  // the clerestory under the central ridge (its eaves are higher than the side aisles')
  G.color(BUFF);
  for (const x of [-6, 6]) G.poly('stone', [[x, 13, C.z0], [x, 13, C.z1], [x, 14.2, C.z1], [x, 14.2, C.z0]], [x < 0 ? -1 : 1, 0, 0]);
  // court perimeter wall above the side-range roofs where the aisles' eaves meet them
  for (const sx of [-1, 1]) G.poly('stone', [[sx * C.x, D.side.eaves, C.z0], [sx * C.x, D.side.eaves, C.z1], [sx * C.x, 13.1, C.z1], [sx * C.x, 13.1, C.z0]], [-sx, 0, 0]);
  // ---- annexes (mapped extensions on the north and south): plain stone blocks with windows and a lead flat roof
  for (const poly of ctx.annexes || []) {
    block(G, poly, 0, 12, 'stone', 0xe4d6b4, [[1.8, 4.2], [5.6, 8.0], [8.6, 10.8]]);
    G.color(0x7a7e7c); G.poly('stone', poly.map((p) => [p[0], 12, p[1]]), [0, 1, 0]);   // above the world's inset block (11.6 m)
  }

  const group = new THREE.Group(); group.name = 'mus:nhm-front';
  group.position.set(frame.ox, 0, frame.oz); group.rotation.y = frame.th; group.updateMatrix();   // (world.addStatic recomposes the matrix from these)
  const meshes = G.build({ bays: bayMaterial(), stone: M.stone, slate: W.mats.slate, glassRoof: M.glassRoof, paint: M.paint }, group, { name: 'mus-nhm-front', cast: true });
  /**
   * Near-only relief (within ~140 m), pushed in the front's local frame into the caller's Geo under ONE key ('paint',
   * plain vertex colour) so it merges into a mesh the caller already draws: corbels under the eaves, the polished
   * shafts and sills of every window, the portal's orders and steps, ridge crestings and finials.
   */
  const details = (Gd, key = 'paint') => {
    const cyl = (x, y, z, r, h, col, seg = 6) => { Gd.color(col); Gd.cyl(key, x, y, z, r, h, seg, r, false); };
    for (let s = 0; s < 2; s++) {
      const xa = s ? T.x : D.x0, xb = s ? D.x1 : -T.x, bw = (xb - xa) / D.bayN;
      for (let x = xa + 0.3; x < xb - 0.1; x += 0.9) { Gd.color(0xcdbe98); Gd.box(key, x - 0.1, D.eaves - 0.62, 0, x + 0.1, D.eaves - 0.36, 0.22); }
      for (let i = 0; i < D.bayN; i++) {
        const b0 = xa + i * bw, carved = carvedSet.has(s * D.bayN + i);
        for (const [cx, y0, ys, w] of [[2.125, 1.75, 4.05, 1.7], [1.12, 7.25, 10.0, 1.25], [3.13, 7.25, 10.0, 1.25]]) {
          const X = b0 + (cx / 4.25) * bw;
          Gd.color(0xe6d8b4); Gd.box(key, X - w / 2 - 0.34, y0 - 0.02, 0, X + w / 2 + 0.34, y0 + 0.12, 0.16);
          for (const sd of [-1, 1]) {
            const sx = X + sd * (w / 2 + 0.13);
            cyl(sx, y0 + 0.12, 0.07, 0.065, ys - y0 - 0.32, sd * (carved ? 1 : -1) > 0 ? 0x8a4638 : 0x69766a);     // stands on the sill (no separate base: cost)
            if (carved) { Gd.color(0xeadfbf); Gd.cyl(key, sx, ys - 0.2, 0.07, 0.07, 0.28, 6, 0.15, true); } else { Gd.color(0xd9caa2); Gd.box(key, sx - 0.15, ys - 0.2, 0, sx + 0.15, ys + 0.1, 0.2); }
          }
        }
      }
    }
    // the portal: jamb shafts, a moulded hood standing off the wall, two steps, lanterns
    const zf = T.z0;
    for (const sd of [-1, 1]) for (const [dx, col] of [[2.05, 0x69766a], [2.5, 0x8a4638]]) { cyl(sd * dx, 0.6, zf + 0.09, 0.075, 2.5, col, 8); Gd.color(0xeadfbf); Gd.cyl(key, sd * dx, 3.1, zf + 0.09, 0.08, 0.3, 6, 0.17, true); Gd.box(key, sd * dx - 0.13, 0.3, zf, sd * dx + 0.13, 0.6, zf + 0.2); }
    { const n = 7, hw = 3.0, ys = 3.3; let prev = null;
      for (let k = 0; k <= 2 * n; k++) { const u = k / (2 * n), t = u < 0.5 ? u * 2 : (1 - u) * 2, x = (u < 0.5 ? -1 : 1) * hw * (1 - t * t * 0.0 - t) , y = ys + hw * 1.3 * Math.sin(t * Math.PI / 2); const p = [x, y, zf + 0.08]; if (prev) { Gd.color(k % 2 ? 0xe4d6b2 : 0xa9644a); Gd.beam(key, prev, p, 0.2, 0.3); } prev = p; }
      for (const sd of [-1, 1]) { Gd.color(0xe4d6b2); Gd.box(key, sd * hw - 0.15, 0, zf, sd * hw + 0.15, ys, zf + 0.16); }
    }
    Gd.color(0xb8ad96); Gd.box(key, -2.6, 0, zf, 2.6, 0.16, zf + 1.3); Gd.box(key, -2.2, 0.16, zf, 2.2, 0.3, zf + 0.9);
    // cresting along the big ridge and the tower's crest; finials on the tower, the turrets and the ventilators
    Gd.color(0x3a4448);
    for (let x = D.x0; x < D.x1; x += 0.7) { if (Math.abs(x) < T.x + 0.6) continue; Gd.poly(key, [[x, D.ridge + 0.15, -D.front / 2], [x + 0.5, D.ridge + 0.15, -D.front / 2], [x + 0.25, D.ridge + 0.62, -D.front / 2]], [0, 0, 1]); Gd.poly(key, [[x + 0.5, D.ridge + 0.15, -D.front / 2], [x, D.ridge + 0.15, -D.front / 2], [x + 0.25, D.ridge + 0.62, -D.front / 2]], [0, 0, -1]); }
    const zm = (T.z0 + T.z1) / 2;
    for (let x = -0.8; x < 0.75; x += 0.4) { Gd.poly(key, [[x, T.top, zm], [x + 0.34, T.top, zm], [x + 0.17, T.top + 0.5, zm]], [0, 0, 1]); Gd.poly(key, [[x + 0.34, T.top, zm], [x, T.top, zm], [x + 0.17, T.top + 0.5, zm]], [0, 0, -1]); }
    for (const sx of [-0.9, 0.9]) { Gd.beam(key, [sx, T.top - 0.2, zm], [sx, T.top + 2.2, zm], 0.08); Gd.beam(key, [sx - 0.35, T.top + 1.5, zm], [sx + 0.35, T.top + 1.5, zm], 0.05); Gd.cyl(key, sx, T.top + 2.2, zm, 0.12, 0.24, 6, 0.0, false); }
    for (const sx of [-1, 1]) { const t = D.turret; Gd.beam(key, [sx * t.x, t.h + t.cone - 0.2, t.z], [sx * t.x, t.h + t.cone + 1.2, t.z], 0.07); }
    // lucarnes on the tower roof (front and sides)
    const hh = T.top - T.eaves, y0 = T.eaves + hh * 0.12;
    Gd.color(0xd8c8a0); Gd.poly(key, [[-0.7, y0, T.z0 + 0.25], [0.7, y0, T.z0 + 0.25], [0, y0 + 2.2, T.z0 + 0.25]], [0, 0, 1]);
    Gd.color(0x1c2024); Gd.poly(key, [[-0.32, y0 + 0.2, T.z0 + 0.27], [0.32, y0 + 0.2, T.z0 + 0.27], [0, y0 + 1.4, T.z0 + 0.27]], [0, 0, 1]);
    Gd.color(0x6c7470); Gd.poly(key, [[-0.8, y0, T.z0 + 0.3], [0, y0 + 2.3, T.z0 + 0.3], [0, y0 + 2.3, T.z0 - 1.2]], [-1, 1, 0]); Gd.poly(key, [[0.8, y0, T.z0 + 0.3], [0, y0 + 2.3, T.z0 - 1.2], [0, y0 + 2.3, T.z0 + 0.3]], [1, 1, 0]);
  };
  return { meshes, group, dims: NHM, details };
}
