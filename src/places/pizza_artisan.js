// Pizza Artisan — the big shiny silver wood-fired pizza van outside Christ Church on St Aldate's (c. 2011–2019; cash only,
// no seating). venues.md §5 + USER DECISION. Which side of the street it used is unverified: it is parked here on the
// Christ Church (east) pavement just south of Tom Gate, between the pavement walking line and the college wall (a guess).
// Open 17:00–23:30 game time (guess), shuttered otherwise; a short queue in the evening, longer after 22:00.
// [E] Order -> menu -> 20 s in the oven -> [E] Collect -> carry the box (look.prop 'pizza-box') -> [E] Eat.
// Test hooks: game.pizza.{force(true|false|null), order(i), collect(), eat(), state, view(...), stats()}.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCharacter, randomLook } from '../core/characters.js';
import { Geo, paintMaterial, canvas, canvasTexture } from './_randolph_kit.js';
import { createFlames, createSmoke } from './_randolph_fx.js';
import { MENU, HOURS, COOK_S, isOpen, queueSize, pizzaStep, eatEffects } from './_pizza_logic.js';
import { dayOf } from '../core/time.js';

const ID = 'pizza_artisan';
// van centre on the east pavement of St Aldate's, aligned with the road (faces south; serving hatch to the west)
export const VAN = { x: 229.6, z: 552.0, h: Math.atan2(2.8, 50.4) };
const CH = Math.cos(VAN.h), SH = Math.sin(VAN.h);
const V2W = (x, z) => [VAN.x + x * CH + z * SH, VAN.z - x * SH + z * CH];
const FAR = 300, NPC_R = 120;
const HATCH = { z0: -1.6, z1: 1.4, y0: 1.25, y1: 2.45 };
const CHEF_LINES = ['Margherita? Classic.', 'Cash only, I\'m afraid.', 'Free rocket on anything.', 'Garlic oil? Go on.', 'Oven\'s at about four hundred degrees.', 'Mind the box, it\'s hot.'];
const QUEUE_LINES = ['Best pizza in Oxford.', 'Worth the wait.', 'Have you got any cash?', 'I always get the Margherita.', 'Is there a cash machine near here?'];

// ------------------------------------------------------------------------------------------------ textures
function aluminiumTexture() {
  // The whole van body unwrapped once per side: u = (z + 3.5) / 7 along the van, v = y / 3 up it, hatch side in the
  // top half of the canvas (upside down), kerb side in the bottom half, so the two meet along the roof. Polished aluminium = sky above a dark horizon line, the
  // street below it; riveted panel seams, rubbing strakes, wheel arches, windows and the service door are painted in.
  const W = 1024, H = 512, C = canvas(W, H * 2), g = C.g, PX = W / 7, PY = H / 3;
  let seed = 9173; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const hatch of [true, false]) {
    g.save(); g.translate(0, H); if (hatch) g.scale(1, -1);   // hatch half is stored upside down so both halves meet at the roof line (v = 0.5)
    g.beginPath(); g.rect(0, 0, W, H); g.clip();
    const X = (z) => (z + 3.5) * PX, Y = (y) => H - y * PY;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0.0, '#f6f9fb'); gr.addColorStop(0.2, '#dde5ec'); gr.addColorStop(0.42, '#b9c4ce'); gr.addColorStop(0.495, '#6f7880');
    gr.addColorStop(0.53, '#9fa6aa'); gr.addColorStop(0.72, '#c6c8c4'); gr.addColorStop(0.86, '#a7a8a2'); gr.addColorStop(1, '#6e706c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // soft reflections: pale stone buildings above the horizon, a brighter band where the pavement is
    for (let i = 0; i < 14; i++) { const x = rnd() * W, w = 30 + rnd() * 90, h = 12 + rnd() * 34; g.fillStyle = `rgba(214,198,160,${0.10 + rnd() * 0.12})`; g.fillRect(x, H * 0.495 - h, w, h); }
    g.fillStyle = 'rgba(232,226,208,0.18)'; g.fillRect(0, H * 0.56, W, H * 0.07);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.06})`; g.fillRect(0, rnd() * H, W, 1 + rnd() * 1.5); }
    // every panel a slightly different polish
    for (let p = 0; p < 14; p++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '40,50,60'},${rnd() * 0.07})`; g.fillRect(p * (W / 14), 0, W / 14, H); }
    // seams + rivets
    const seamV = (x) => { g.fillStyle = 'rgba(52,58,64,0.6)'; g.fillRect(x - 1, 0, 2, H); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 1, 0, 1, H); g.fillStyle = 'rgba(48,54,60,0.7)'; for (let y = 5; y < H; y += 11) { g.beginPath(); g.arc(x - 4, y, 1.3, 0, 7); g.fill(); } };
    const seamH = (y, strake = false) => {
      if (strake) { g.fillStyle = 'rgba(40,46,52,0.55)'; g.fillRect(0, y + 2, W, 2); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(0, y - 3, W, 3); g.fillStyle = 'rgba(150,158,166,0.9)'; g.fillRect(0, y, W, 2); }
      else { g.fillStyle = 'rgba(52,58,64,0.55)'; g.fillRect(0, y, W, 1.5); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, y + 1.5, W, 1); }
      g.fillStyle = 'rgba(48,54,60,0.65)'; for (let x = 4; x < W; x += 11) { g.beginPath(); g.arc(x, y + (strake ? 7 : 5), 1.2, 0, 7); g.fill(); }
    };
    for (let p = 1; p < 14; p++) seamV(p * (W / 14));
    seamH(Y(2.78)); seamH(Y(2.5), true); seamH(Y(1.2), true); seamH(Y(0.82));
    // windows: dark glass in bright rounded frames
    const win = (z0, z1, y0, y1) => {
      const x = X(z0), y = Y(y1), w = X(z1) - x, h = Y(y0) - y, r = 12;
      g.fillStyle = '#e9eef2'; g.beginPath(); g.roundRect(x - 5, y - 5, w + 10, h + 10, r + 4); g.fill();
      g.fillStyle = '#5c666e'; g.beginPath(); g.roundRect(x - 2, y - 2, w + 4, h + 4, r + 1); g.fill();
      const gl = g.createLinearGradient(0, y, 0, y + h); gl.addColorStop(0, '#8fa6b8'); gl.addColorStop(0.5, '#33414c'); gl.addColorStop(1, '#161c22');
      g.fillStyle = gl; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.moveTo(x + w * 0.12, y + h); g.lineTo(x + w * 0.38, y); g.lineTo(x + w * 0.52, y); g.lineTo(x + w * 0.26, y + h); g.fill();
    };
    if (hatch) win(1.75, 2.7, 1.72, 2.36);
    else { win(-2.75, -1.75, 1.72, 2.36); win(-1.35, -0.1, 1.72, 2.36); win(0.3, 1.55, 1.72, 2.36); win(1.95, 2.75, 1.72, 2.36); }
    // serving-hatch shutter (only seen when the hatch is shut): fine horizontal slats
    if (hatch) { for (let y = Y(2.45); y < Y(1.25); y += 6) { g.fillStyle = 'rgba(60,66,72,0.45)'; g.fillRect(X(-1.6), y, X(1.4) - X(-1.6), 1.5); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(X(-1.6), y + 2, X(1.4) - X(-1.6), 1); } }
    // service door at the back on the kerb side, with a handle
    if (!hatch) {
      g.strokeStyle = 'rgba(40,46,52,0.8)'; g.lineWidth = 2.5; g.strokeRect(X(-3.05), Y(1.66), X(-2.9) - X(-3.05), 2);
    } else {
      g.strokeStyle = 'rgba(40,46,52,0.8)'; g.lineWidth = 2.5; g.beginPath(); g.roundRect(X(-2.85), Y(2.42), X(-2.05) - X(-2.85), Y(0.62) - Y(2.42), 10); g.stroke();
      g.fillStyle = '#2a2e32'; g.fillRect(X(-2.2), Y(1.42), 9, 16); g.fillStyle = '#dfe5ea'; g.fillRect(X(-2.2) + 2, Y(1.42) + 2, 5, 3);
    }
    // wheel arches: dark opening with a bright rolled lip
    for (const z of [-2.2, 2.3]) {
      g.fillStyle = '#eef2f5'; g.beginPath(); g.arc(X(z), Y(0.44), 0.57 * PX, Math.PI, 0); g.fill();
      g.fillStyle = '#0c0d0e'; g.beginPath(); g.arc(X(z), Y(0.44), 0.5 * PX, Math.PI, 0); g.fill();
    }
    // road grime towards the skirt, streaks under the strakes
    const dirt = g.createLinearGradient(0, Y(1.0), 0, H); dirt.addColorStop(0, 'rgba(70,62,48,0)'); dirt.addColorStop(1, 'rgba(70,62,48,0.38)');
    g.fillStyle = dirt; g.fillRect(0, Y(1.0), W, H - Y(1.0));
    for (let i = 0; i < 40; i++) { const x = rnd() * W; g.fillStyle = `rgba(60,60,56,${0.04 + rnd() * 0.07})`; g.fillRect(x, Y(1.2) + 3, 1.5 + rnd() * 2, 20 + rnd() * 60); }
    g.restore();
  }
  const t = canvasTexture(C.canvas, { repeat: false });
  return t;
}
/** van body UV: (z along the van, y up, hatch side or kerb side) -> atlas uv */
const ALU = (z, y, hatch) => { const v = (Math.min(3, Math.max(0, y)) / 3) * 0.5; return [(z + 3.5) / 7, hatch ? 1 - v : v]; };
function signAtlas() {
  const C = canvas(512, 512), g = C.g;
  // logo roundel band (0..160)
  g.fillStyle = '#7a1414'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#f0d9a0'; g.lineWidth = 4; g.strokeRect(8, 8, 496, 144);
  g.fillStyle = '#f6ead0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'italic bold 64px Georgia, "Times New Roman", serif'; g.fillText('Pizza Artisan', 256, 66, 470);
  g.font = '26px Georgia, serif'; g.fillStyle = '#f0d9a0'; g.fillText('WOOD-FIRED PIZZA', 256, 122, 470);
  // CASH ONLY strip (160..224)
  g.fillStyle = '#f4f1e6'; g.fillRect(0, 160, 512, 64);
  g.fillStyle = '#b01818'; g.font = 'bold 44px Arial, sans-serif'; g.fillText('CASH ONLY', 256, 194, 480);
  // chalkboard (224..512)
  g.fillStyle = '#2a2d2a'; g.fillRect(0, 224, 512, 288);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * 512, 224 + Math.random() * 288, 3 + Math.random() * 20, 1); }
  g.fillStyle = '#f2efe6'; g.font = 'bold 34px "Comic Sans MS", "Chalkboard SE", cursive'; g.fillText('Pizza Artisan', 256, 252);
  g.textAlign = 'left'; g.font = '25px "Comic Sans MS", "Chalkboard SE", cursive';
  MENU.forEach((m, i) => {
    const y = 296 + i * 34;
    g.fillStyle = ['#f2efe6', '#f6d36a', '#f2efe6', '#9fe0a0', '#f2efe6'][i]; g.fillText(m.name, 26, y);
    g.textAlign = 'right'; g.fillText('£' + m.price.toFixed(2), 488, y); g.textAlign = 'left';
  });
  g.fillStyle = '#c8e8f8'; g.font = '20px "Comic Sans MS", cursive'; g.fillText('Free rocket, peppers & olive oil', 26, 474);
  g.fillStyle = '#ff9a9a'; g.textAlign = 'right'; g.fillText('CASH ONLY', 488, 498);
  const t = canvasTexture(C.canvas);
  const R = (x0, y0, x1, y1) => [x0 / 512, 1 - y1 / 512, x1 / 512, 1 - y0 / 512];
  return { texture: t, logo: R(0, 0, 512, 160), cash: R(0, 160, 512, 224), board: R(0, 224, 512, 512) };
}

// ------------------------------------------------------------------------------------------------ van geometry (local)
const PROF = (() => {
  const p = [[-1.08, 0.45], [-1.2, 0.57], [-1.2, HATCH.y0], [-1.2, HATCH.y1]];
  for (let i = 1; i <= 4; i++) { const a = Math.PI - (i / 4) * (Math.PI / 2); p.push([-0.62 + Math.cos(a) * 0.58, HATCH.y1 + Math.sin(a) * 0.58]); }
  for (let i = 1; i <= 4; i++) { const a = Math.PI / 2 - (i / 4) * (Math.PI / 2); p.push([0.62 + Math.cos(a) * 0.58, HATCH.y1 + Math.sin(a) * 0.58]); }
  p.push([1.2, 0.57], [1.08, 0.45]);
  return p;
})();
const HATCH_EDGE = 2;     // PROF[2] -> PROF[3] is the hatch on the left side
const STATIONS = [[-3.5, 0.05], [-3.42, 0.55], [-3.22, 0.84], [-2.9, 1], [HATCH.z0, 1], [HATCH.z1, 1], [2.9, 1], [3.22, 0.84], [3.42, 0.55], [3.5, 0.05]];
const YC = 1.6;

function buildBody(G) {
  const ring = (z, s) => PROF.map(([x, y]) => [x * s, YC + (y - YC) * s, z]);
  for (let k = 0; k < STATIONS.length - 1; k++) {
    const [za, sa] = STATIONS[k], [zb, sb] = STATIONS[k + 1], A = ring(za, sa), B = ring(zb, sb);
    for (let i = 0; i < PROF.length; i++) {
      const j = (i + 1) % PROF.length;
      if (i === HATCH_EDGE && za >= HATCH.z0 - 1e-6 && zb <= HATCH.z1 + 1e-6) continue;   // the serving hatch
      const pts = [A[i], A[j], B[j], B[i]];
      const mx = (A[i][0] + B[j][0]) / 2, my = (A[i][1] + B[j][1]) / 2 - YC, mz = (za + zb) / 2;
      const hint = [mx, my, Math.abs(mz) > 2.8 ? mz * 1.5 : 0];
      const hs = A[i][0] + A[j][0] < -0.01;   // which side of the van this strip is on (roof strip: kerb-side half, plain)
      G.poly('alum', pts, hint, pts.map((p) => ALU(p[2], p[1], hs)));
    }
  }
  // end caps
  for (const [z, s, sg] of [[-3.5, 0.05, -1], [3.5, 0.05, 1]]) { const R0 = ring(z, s); G.poly('alum', R0, [0, 0, sg], R0.map((p) => ALU(sg * 3.45, p[1], false))); }
}

function buildVan(G, sign) {
  buildBody(G);
  // underside / skirt, wheels, bumpers
  G.color(0x1b1c1e); G.box('paint', -1.05, 0.3, -3.2, 1.05, 0.48, 3.2);
  G.color(0x0d0d0e); for (const z of [-2.2, 2.3]) for (const s of [-1, 1]) G.wheel('paint', s * 0.98 - 0.13, 0.42, z, 0.42, 0.26, 12);
  G.color(0xc8ccd0); for (const z of [-3.48, 3.48]) G.box('paint', -1.0, 0.45, z - 0.06, 1.0, 0.62, z + 0.06);
  // front: split windscreen, round headlamps, grille
  G.color(0x1a2128);
  G.poly('paint', [[-0.82, 1.75, 3.36], [-0.06, 1.75, 3.39], [-0.06, 2.5, 3.3], [-0.78, 2.5, 3.27]], [0, 0.2, 1]);
  G.poly('paint', [[0.06, 1.75, 3.39], [0.82, 1.75, 3.36], [0.78, 2.5, 3.27], [0.06, 2.5, 3.3]], [0, 0.2, 1]);
  G.color(0xf6f2e0); for (const s of [-1, 1]) G.cyl('paint', s * 0.72, 0.95, 3.38, 0.13, 0.08, 10, 0.13);
  G.color(0x6f7478); for (let i = 0; i < 6; i++) G.box('paint', -0.35, 0.75 + i * 0.09, 3.42, 0.35, 0.79 + i * 0.09, 3.47);
  // rear: little windows
  G.color(0x1a2128); G.poly('paint', [[-0.6, 1.9, -3.32], [0.6, 1.9, -3.32], [0.55, 2.45, -3.24], [-0.55, 2.45, -3.24]], [0, 0.2, -1]);
  // interior (only seen through the hatch): stainless walls lit from inside ('inner' = unlit material, colour set per frame)
  G.color(0xffffff);
  G.poly('inner', [[1.05, 0.6, HATCH.z0 - 0.1], [1.05, 0.6, HATCH.z1 + 0.1], [1.05, 2.95, HATCH.z1 + 0.1], [1.05, 2.95, HATCH.z0 - 0.1]], [-1, 0, 0]);
  G.color(0xd8d8d8);
  G.poly('inner', [[-1.15, 2.95, HATCH.z0 - 0.1], [1.05, 2.95, HATCH.z0 - 0.1], [1.05, 2.95, HATCH.z1 + 0.1], [-1.15, 2.95, HATCH.z1 + 0.1]], [0, -1, 0]);
  G.color(0xbcbcbc);
  G.poly('inner', [[-1.15, 0.6, HATCH.z0 - 0.1], [1.05, 0.6, HATCH.z0 - 0.1], [1.05, 2.95, HATCH.z0 - 0.1], [-1.15, 2.95, HATCH.z0 - 0.1]], [0, 0, 1]);
  G.poly('inner', [[-1.15, 0.6, HATCH.z1 + 0.1], [1.05, 0.6, HATCH.z1 + 0.1], [1.05, 2.95, HATCH.z1 + 0.1], [-1.15, 2.95, HATCH.z1 + 0.1]], [0, 0, -1]);
  G.color(0x2a2a2c); G.poly('paint', [[-1.15, 0.6, HATCH.z0], [1.05, 0.6, HATCH.z0], [1.05, 0.6, HATCH.z1], [-1.15, 0.6, HATCH.z1]], [0, 1, 0]);
  // counter (wooden top, projecting a little out of the hatch) + stainless prep bench
  G.color(0x9a6a3a); G.box('paint', -1.42, HATCH.y0 - 0.05, HATCH.z0 + 0.05, -0.75, HATCH.y0, HATCH.z1 - 0.05, { bottom: true });
  G.color(0xb8bec2); G.box('paint', 0.35, 0.6, 0.0, 1.0, 1.05, 1.35);
  // stack of pizza boxes, oil bottle, rocket bowl, napkins on the counter
  G.color(0xc8a066); for (let i = 0; i < 6; i++) G.box('paint', -1.25, HATCH.y0 + i * 0.05, 0.75 + (i % 2) * 0.01, -0.9, HATCH.y0 + 0.045 + i * 0.05, 1.12);
  G.color(0xb02020); G.box('paint', -1.22, HATCH.y0 + 0.3, 0.86, -0.93, HATCH.y0 + 0.302, 1.0);
  G.color(0x7a8a20); G.cyl('paint', -1.15, HATCH.y0, 0.45, 0.035, 0.24, 7, 0.02);
  G.color(0x3a8a2a); G.cyl('paint', -1.1, HATCH.y0, 0.15, 0.12, 0.08, 9, 0.14);
  G.color(0xf4f4f4); G.box('paint', -1.2, HATCH.y0, -0.25, -1.05, HATCH.y0 + 0.14, -0.12);
  // wood-fired oven at the back of the van: stainless base, tiled dome, glowing mouth facing the hatch
  const OX = 0.35, OZ = -0.95;
  G.color(0x9aa0a4); G.box('paint', OX - 0.7, 0.6, OZ - 0.62, OX + 0.7, 1.2, OZ + 0.62);
  G.color(0x8a3a24);
  for (let i = 0; i < 4; i++) { const a0 = (i / 4) * Math.PI / 2, a1 = ((i + 1) / 4) * Math.PI / 2; G.cyl('paint', OX, 1.2 + Math.sin(a0) * 0.62, OZ, Math.cos(a0) * 0.62, (Math.sin(a1) - Math.sin(a0)) * 0.62, 12, Math.max(0.02, Math.cos(a1) * 0.62)); }
  G.color(0x2a1a12); G.box('paint', OX - 0.66, 1.2, OZ - 0.28, OX - 0.5, 1.58, OZ + 0.28);
  // flue up through the roof + cap
  G.color(0x2a2a2c); G.cyl('paint', OX, 1.75, OZ, 0.11, 2.2, 10); G.cyl('paint', OX, 3.95, OZ, 0.2, 0.08, 10, 0.2); G.cyl('paint', OX, 3.88, OZ, 0.13, 0.07, 10, 0.13);
  // oven mouth glow + bulbs under the awning line
  G.color(0xffffff); G.poly('glow', [[OX - 0.67, 1.22, OZ + 0.24], [OX - 0.67, 1.22, OZ - 0.24], [OX - 0.67, 1.52, OZ - 0.2], [OX - 0.67, 1.52, OZ + 0.2]], [-1, 0, 0]);
  G.color(0xffd9a0); for (let i = 0; i < 6; i++) G.boxC('bulb', -1.3, 2.62, HATCH.z0 + 0.2 + i * 0.52, 0.06, 0.08, 0.06);
  // signwriting on both sides (logo forward of the hatch, CASH ONLY under the counter)
  for (const sd of [-1, 1]) {
    const x = sd * 1.215, z0 = sd < 0 ? 1.55 : -2.85, z1 = sd < 0 ? 2.85 : -1.55;
    // viewer's right on the -x side is +z; on the +x side it is -z
    if (sd < 0) G.quadUV('sign', [x, 1.2, z0], [x, 1.2, z1], [x, 1.62, z1], [x, 1.62, z0], sign.logo);
    else G.quadUV('sign', [x, 1.2, z1], [x, 1.2, z0], [x, 1.62, z0], [x, 1.62, z1], sign.logo);
  }
  G.quadUV('sign', [-1.215, 0.82, -0.9], [-1.215, 0.82, 0.7], [-1.215, 1.05, 0.7], [-1.215, 1.05, -0.9], sign.cash);
}
function buildAwning(G) {
  // flap hinged at the top of the hatch, propped up and out
  const y = HATCH.y1 + 0.02, out = 1.05, rise = 0.42;
  const A = [-1.22, y, HATCH.z0 - 0.05], B = [-1.22, y, HATCH.z1 + 0.05], C = [-1.22 - out, y + rise, HATCH.z1 + 0.05], D = [-1.22 - out, y + rise, HATCH.z0 - 0.05];
  G.poly('alum', [A, B, C, D], [-0.3, 1, 0], [A, B, C, D].map((p) => ALU(p[2], 2.9 + (p[0] + 1.22) * 0.05, true)));
  G.poly('alum', [A, D, C, B], [0.3, -1, 0], [A, D, C, B].map((p) => ALU(p[2], 1.0 + (p[0] + 1.22) * 0.1, false)));
  G.color(0x2a2a2c); for (const z of [HATCH.z0 + 0.1, HATCH.z1 - 0.1]) G.beam('paint', [-1.22, HATCH.y0 + 0.2, z], [-1.22 - out * 0.95, y + rise - 0.03, z], 0.025);
}
function buildShutter(G) {
  const x = -1.205;
  G.quadUV('alum', [x, HATCH.y0, HATCH.z0], [x, HATCH.y0, HATCH.z1], [x, HATCH.y1, HATCH.z1], [x, HATCH.y1, HATCH.z0], [...ALU(HATCH.z0, HATCH.y0, true), ...ALU(HATCH.z1, HATCH.y1, true)]);
  G.color(0x55595c); G.box('paint', x - 0.03, HATCH.y0 + 0.5, -0.15, x, HATCH.y0 + 0.56, 0.15);
}
function buildBoard(G, sign) {
  // A-board on the pavement, chalkboard menu on both faces
  G.at(-2.15, 0, 2.35, -0.5);
  const h = 1.05, w = 0.62, lean = 0.22;
  for (const s of [-1, 1]) {
    const a = [-w / 2, 0.0, s * lean], b = [w / 2, 0.0, s * lean], c = [w / 2, h, s * 0.02], d = [-w / 2, h, s * 0.02];
    G.color(0x6a4a2a); G.poly('paint', [[a[0] - 0.04, 0, a[2]], [b[0] + 0.04, 0, b[2]], [c[0] + 0.04, h + 0.04, c[2]], [d[0] - 0.04, h + 0.04, d[2]]], [0, 0.2, s]);
    const off = (p) => [p[0], p[1] + (p[1] > 0.5 ? -0.05 : 0.05), p[2] + s * 0.012];
    if (s > 0) G.quadUV('sign', off([a[0] + 0.05, 0.05, a[2]]), off([b[0] - 0.05, 0.05, b[2]]), off([c[0] - 0.05, h - 0.05, c[2]]), off([d[0] + 0.05, h - 0.05, d[2]]), sign.board);
    else G.quadUV('sign', off([b[0] - 0.05, 0.05, b[2]]), off([a[0] + 0.05, 0.05, a[2]]), off([d[0] + 0.05, h - 0.05, d[2]]), off([c[0] - 0.05, h - 0.05, c[2]]), sign.board);
  }
  G.pop();
}

export default {
  id: ID,
  install(game) {
    const world = game.world, scene = game.worldScene, U = world.uniforms;
    const t0 = performance.now();
    const P = (game.pizza = { id: ID, forced: null, state: { stage: 'idle', item: null, t: 0 }, VAN });
    const q = new URLSearchParams(location.search).get('pizza');
    if (q === 'open') P.forced = true; else if (q === 'closed') P.forced = false;
    const sign = signAtlas();
    const alumTex = aluminiumTexture();
    // polished aluminium without an environment map: low metalness + the chrome 'sky/horizon/ground' bands as a faint emissive
    const alum = new THREE.MeshStandardMaterial({ map: alumTex, emissiveMap: alumTex, emissive: 0x5a6068, emissiveIntensity: 1, metalness: 0.2, roughness: 0.28, color: 0xffffff });
    const signMat = new THREE.MeshStandardMaterial({ map: sign.texture, emissiveMap: sign.texture, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7 });
    world.registerNight(signMat, 0.35);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a26 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe0a8 });
    const innerMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x8a8a86 });
    const mats = { alum, paint: paintMaterial(), sign: signMat, glow: glowMat, bulb: bulbMat, inner: innerMat };
    const frame = new THREE.Matrix4().makeRotationY(VAN.h).setPosition(VAN.x, 0, VAN.z);

    const root = new THREE.Group(); root.name = 'pizza_artisan';
    const G = new Geo(); G.push(frame); buildVan(G, sign);
    const van = G.build(mats, root, { name: 'pizza-van', cast: new Set(['alum', 'paint']) });
    if (van.alum) {      // smooth the polished body
      const g2 = mergeVertices(van.alum.geometry.deleteAttribute('normal'), 1e-4); g2.computeVertexNormals(); van.alum.geometry = g2;
    }
    const openG = new THREE.Group(), closedG = new THREE.Group();
    const GA = new Geo(); GA.push(frame); buildAwning(GA); buildBoard(GA, sign); GA.build(mats, openG, { name: 'pizza-open' });
    const GS = new Geo(); GS.push(frame); buildShutter(GS); GS.build(mats, closedG, { name: 'pizza-closed' });
    root.add(openG, closedG);
    world.addStatic(root);
    // oven fire + chimney wisp
    const W3 = (x, y, z) => { const w = V2W(x, z); return [w[0], y, w[1]]; };
    const fire = createFlames([{ p: W3(0.0, 1.22, -0.95), w: 0.35, h: 0.3, start: 0 }, { p: W3(0.05, 1.22, -0.8), w: 0.3, h: 0.26, start: 0 }, { p: W3(0.05, 1.22, -1.1), w: 0.28, h: 0.22, start: 0 }], U.time, { wind: [0, 0], seed: 5 });
    fire.u.uProg.value = 1;
    const wisp = createSmoke(10, U.time, U.night, { rise: 14, life: 7, size: [0.35, 3.2], wind: [0.12, -0.08], spread: 0.6, radial: 0.15, light: [0.82, 0.82, 0.82] });
    wisp.u.uSrc.value.set(...W3(0.35, 4.0, -0.95)); wisp.u.uDark.value = 0.05;
    scene.add(fire.mesh, wisp.mesh);
    // collision + clear map furniture/trees under the van and the board
    const vp = [[-1.3, -3.6], [1.3, -3.6], [1.3, 3.6], [-1.3, 3.6]].map(([x, z]) => V2W(x, z));
    try { world.clearArea([[-2.6, -3.8], [1.6, -3.8], [1.6, 3.8], [-2.6, 3.8]].map(([x, z]) => V2W(x, z)), { trees: false }); } catch (e) { console.warn('[pizza] clearArea', e); }
    game.worldCollider.addPolygon(vp, { tag: 'vehicle' });
    const bw = V2W(-2.15, 2.35); const boardCol = game.worldCollider.addCircle(bw[0], bw[1], 0.35, { tag: 'board' });

    // ---- the pizzaiolo (own character so he can stand on the van floor)
    const chef = createCharacter(randomLook('pizza-artisan-chef', { outfit: 'chef' }));
    const cw = V2W(-0.45, -0.1);
    chef.group.position.set(cw[0], 0.6, cw[1]); chef.group.rotation.y = VAN.h - Math.PI / 2;
    chef.setPose('talk');
    const dough = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 14), new THREE.MeshStandardMaterial({ color: 0xf0dcae, roughness: 0.9 }));
    dough.position.set(0, -0.05, 0.08); chef.anchors.handL.add(dough);
    scene.add(chef.group);

    // ---- queue (scripted pedestrians)
    const queue = [];
    let queueSig = '';
    function syncQueue(near) {
      const h = game.time.hour, day = dayOf(game.time.now()), n = near ? queueSize(h, day, P.forced) : 0;
      const sig = n + '|' + day;
      if (sig === queueSig) return;
      queueSig = sig;
      while (queue.length) { try { game.pedestrians.remove(queue.pop()); } catch { /* */ } }
      if (!game.pedestrians) return;
      for (let i = 0; i < n; i++) {
        const lx = i === 0 ? -2.0 : -2.35 + ((i * 37) % 5) * 0.06, lz = i === 0 ? -0.15 : -0.95 - 0.8 * i;
        const w = V2W(lx, lz), hd = i === 0 ? VAN.h + Math.PI / 2 : VAN.h;
        const late = h >= 22 || h < 4;
        const look = randomLook(`pizza-q-${day}-${i}`, { outfit: late && i % 2 ? 'clubbing' : i % 3 === 2 ? 'gown' : 'casual', prop: i % 3 === 1 ? 'phone' : null });
        try {
          queue.push(game.pedestrians.spawnAt(w[0], w[1], look, { heading: hd, pose: late && i % 3 === 0 ? 'drunk' : 'stand', lines: QUEUE_LINES, role: 'pizza-queue' }));
        } catch (e) { console.error('[pizza] queue', e); break; }
      }
    }

    // ---- ordering
    const st = P.state;
    let prevProp = null, readyToldT = 0;
    const open = () => isOpen(game.time.hour, P.forced);
    const hatchPos = V2W(-1.95, -0.15);
    function menu() {
      game.beginActivity({ name: 'pizza-menu', pointer: 'free' });
      const o = game.ui.openOverlay(), box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#232623;border:3px solid #6a4a2a;border-radius:6px;padding:18px 22px;color:#f2efe6;font-family:"Comic Sans MS","Chalkboard SE",cursive;min-width:340px';
      box.innerHTML = `<div style="font-size:24px;font-weight:bold;color:#f6ead0">Pizza Artisan</div><div style="opacity:.75;margin-bottom:8px">Wood-fired · cash only · you have £${game.state.money.toFixed(2)}</div>`;
      MENU.forEach((m, i) => {
        const b = document.createElement('button');
        b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;background:#2e322e;color:#f2efe6;border:1px solid #5a5a50;border-radius:4px;cursor:pointer;font:inherit';
        b.innerHTML = `<b>${m.name}</b> — £${m.price.toFixed(2)}<br><span style="opacity:.7;font-size:13px">${m.desc}</span>`;
        b.onclick = () => { game.endActivity(); P.order(i); };
        box.appendChild(b);
      });
      const nb = document.createElement('button'); nb.textContent = 'Just looking'; nb.style.cssText = 'margin-top:6px;padding:6px 10px;background:none;color:#c8c4b0;border:1px solid #5a5a50;border-radius:4px;cursor:pointer;font:inherit';
      nb.onclick = () => game.endActivity(); box.appendChild(nb);
      o.appendChild(box);
    }
    P.order = (i) => {
      const r = pizzaStep(st, { type: 'order', item: i, money: game.state.money, open: open() });
      if (r === 'cash-only') { chef.say('Cash only, mate.', 3); game.ui.toast(`Cash only, mate. (£${MENU[i].price.toFixed(2)} — you have £${game.state.money.toFixed(2)})`, 3.5); }
      else if (r === 'closed') game.ui.toast('The shutters are down.', 2.5);
      else if (r === 'busy') game.ui.toast("You've already got one on the go.", 2.5);
      else if (r === 'ordered') {
        game.pay(-st.item.price);
        chef.say(`One ${st.item.name}, coming up.`, 3);
        game.ui.objective(`${st.item.name} in the wood-fired oven… ${COOK_S}s`);
        if (queue.length) game.ui.toast('Someone in the queue mutters: "There\'s a queue, you know."', 3);
      }
      return r;
    };
    P.collect = () => {
      const r = pizzaStep(st, { type: 'collect' });
      if (r !== 'collected') return r;
      const p = game.player;
      prevProp = p.look.prop || null;
      try { p.setLook({ ...p.look, prop: 'pizza-box' }); } catch (e) { console.error('[pizza] setLook', e); }
      game.ui.objective(`Carrying a ${st.item.name}. [E] to eat it.`);
      chef.say('Enjoy! Mind, it\'s hot.', 3);
      return r;
    };
    P.eat = () => {
      const item = st.item, r = pizzaStep(st, { type: 'eat' });
      if (r !== 'eaten') return r;
      const p = game.player;
      p.drunk = eatEffects(game.state.flags, p.drunk, game.time.now());
      game.save();
      try { p.setLook({ ...p.look, prop: prevProp }); } catch (e) { console.error('[pizza] setLook', e); }
      game.ui.objective(null);
      game.ui.toast(`You eat the ${item ? item.name : 'pizza'} on the kerb by Christ Church. Energy restored${p.drunk < 0.05 ? '' : ', and you feel a bit more sober'}.`, 4.5);
      return r;
    };
    game.interact.add({
      pos: hatchPos, radius: 1.8,
      label: () => !open() ? `Pizza Artisan — closed (opens ${String(Math.floor(HOURS.open)).padStart(2, '0')}:00)` : st.stage === 'cooking' ? `Waiting… ${Math.ceil(st.t)}s` : st.stage === 'ready' ? `Collect your ${st.item.name}` : 'Order a pizza',
      enabled: () => st.stage !== 'carrying',
      onUse: () => { if (!open() && st.stage === 'idle') { game.ui.toast('Shuttered. A note on the hatch says "Back at 5".', 3); return; } if (st.stage === 'ready') P.collect(); else if (st.stage === 'idle') menu(); else chef.say('Nearly there!', 2); },
    });
    const playerPos = new THREE.Vector3();
    game.interact.add({ pos: () => playerPos.copy(game.player.pos), radius: 3, label: () => `Eat your ${st.item ? st.item.name : 'pizza'}`, enabled: () => st.stage === 'carrying', onUse: () => P.eat() });
    game.interact.add({ pos: V2W(-2.15, 1.6), radius: 1.3, label: 'Read the menu', onUse: () => game.ui.dialog('Chalkboard', [...MENU.map((m) => `${m.name} — £${m.price.toFixed(2)} (${m.desc})`), 'Free rocket, peppers & olive oil. CASH ONLY.']) });

    P.force = (v) => { P.forced = v === undefined ? null : v; queueSig = ''; lastOpen = null; const p = game.player.pos; syncQueue(game.player.place === 'world' && Math.hypot(p.x - VAN.x, p.z - VAN.z) < NPC_R); return open(); };
    P.view = (x, y, z, tx, ty, tz, fov = 60) => game.beginActivity({ name: 'view', pointer: 'free', camera(dt, cam) { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); }, onEnd() { game.camera.fov = 60; game.camera.updateProjectionMatrix(); } });
    P.local = (x, y, z) => W3(x, y, z);
    P.stats = () => {
      let calls = 0, tris = 0;
      root.traverse((m) => { if (m.isMesh && m.visible && m.parent.visible) { calls++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
      for (const o of [fire.mesh, wisp.mesh]) if (o.visible) { calls++; tris += 2 * o.geometry.instanceCount; }
      return { open: open(), calls, tris: Math.round(tris), queue: queue.length, chef: chef.group.visible, stage: st.stage };
    };
    let lastOpen = null, near = false, tick = 0, ft = 0;
    console.log(`[pizza_artisan] van at (${VAN.x}, ${VAN.z}) built in ${(performance.now() - t0).toFixed(0)} ms`);
    return {
      update(dt) {
        // the cooking timer runs wherever you are
        if (st.stage === 'cooking') {
          if (pizzaStep(st, { type: 'tick', dt }) === 'ready') {
            game.ui.objective(`Your ${st.item.name} is ready — collect it from the hatch`);
            chef.say(`${st.item.name}!`, 3); readyToldT = 0;
          } else game.ui.objective(`${st.item.name} in the wood-fired oven… ${Math.ceil(st.t)}s`);
        }
        void readyToldT;
        const p = game.player.place === 'world' ? game.player.pos : game.player.worldPos;
        const d = Math.hypot(p.x - VAN.x, p.z - VAN.z);
        const wasNear = near; near = d < FAR;
        const o = open();
        if (o !== lastOpen) {
          lastOpen = o;
          openG.visible = o; closedG.visible = !o; chef.group.visible = o; bulbMat.color.setHex(o ? 0xffe0a8 : 0x3a3530);
          boardCol.on = o; queueSig = '';
        }
        alum.emissiveIntensity = 0.3 + 0.7 * (1 - world.night);
        if (!near) { if (wasNear) { fire.mesh.visible = false; wisp.mesh.visible = false; syncQueue(false); } return; }
        ft += dt;
        const cooking = st.stage === 'cooking';
        const f = 0.8 + 0.12 * Math.sin(ft * 11) + 0.08 * Math.sin(ft * 27.3);
        fire.mesh.visible = o; fire.u.uFlame.value = o ? (cooking ? 1.35 : 1) : 0;
        glowMat.color.setRGB(o ? f * (cooking ? 1.3 : 1) : 0.08, o ? f * 0.48 : 0.04, o ? f * 0.15 : 0.02);
        if (o) innerMat.color.setRGB(0.55 + 0.2 * world.night, 0.52 + 0.12 * world.night, 0.48); else innerMat.color.setRGB(0.12, 0.12, 0.12);
        wisp.mesh.visible = o; wisp.u.uDensity.value = o ? 0.55 : 0;
        if (o && d < 60) chef.update(dt, 0);
        if ((tick = (tick + 1) % 20) === 0) syncQueue(game.player.place === 'world' && d < NPC_R);
      },
    };
  },
};
