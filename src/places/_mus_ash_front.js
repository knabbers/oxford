// SHOWPIECE: the Ashmolean's portico on Beaumont Street (Cockerell, 1841-45, after the Temple of
// Apollo at Bassae): four Ionic columns of Portland stone on a stepped podium, the entablature and pediment, Apollo
// on the apex, the great doorway in the shade behind; plus the forecourt banners (plain colour, lettering only).
// Facts: docs/research/museums.md §3.
//
// Interface: buildPortico(ctx) -> { group, meshes, dims }
//   ctx = { game, frame }   frame (from _mus_kit.frame): origin = the middle of the portico's front line (the mapped
//   projection of the main range), local +z = out of the building (south, to the forecourt), +x = east.
import * as THREE from 'three';
import { Geo, museumMats } from './_mus_kit.js';
import { canvas, canvasTexture } from './_randolph_kit.js';
import { lathe, ball, tube } from './_mus_fine.js';
import { ASH_PLAN as PL, ASH_WINDOWS, ASH_ROOF_GLASS } from './_mus_ash_plan.js';

export const PORTICO = {
  width: 13.6, cols: [-5.1, -1.7, 1.7, 5.1], colZ: -0.75, r: 0.62, podium: 1.2, colH: 9.6, ent: 2.0, ped: 2.6,
  wallZ: -3.14, antaX: 6.35, door: { w: 2.8, h: 5.4 }, steps: 6,      // (the doorway itself is 2.8 x 5.5: _mus_ash_plan.js door)
  banners: [[-9.5, 9.5], [7.5, 10.5]],        // local (x, z) of the two banner poles in the forecourt
};
const PORTLAND = 0xf2eee2, BATH = 0xe8dcbc;

// One atlas (1024 px) for the banners AND the Portland stone dressings, so the portico stays two draws:
//   x 0-512      the two banners (256 each, full height)
//   x 512-1024   y 0-64 fluting (24 flutes once round a shaft) · y 64-320 a volute (left) and the bronze door (right)
//                y 320-384 dentils + egg-and-dart · y 384-640 one ceiling coffer (left), a wreath (right)
//                y 640-704 anthemion frieze · y 960-1024 plain stone (every unpatterned face is pinned here)
const PIN = [0.75, 0.03];
function atlasCanvas() {
  const W = 256, H = 1024, { canvas: c, g } = canvas(1024, H);
  const draw = (x0, bg, fg, words) => {
    g.fillStyle = bg; g.fillRect(x0, 0, W, H);
    g.save(); g.translate(x0 + W / 2, H / 2); g.rotate(-Math.PI / 2); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 120px Georgia, serif'; g.fillText(words[0], 0, -28, H - 60);
    g.font = '44px Georgia, serif'; g.fillText(words[1], 0, 64, H - 60);
    g.restore();
  };
  draw(0, '#7a1424', '#f6efe0', ['ASHMOLEAN', 'MUSEUM OF ART & ARCHAEOLOGY']);
  draw(W, '#1a2a4a', '#f6efe0', ['ASHMOLEAN', 'FREE ADMISSION · OPEN 10–5']);
  const ST = '#f1ecdf', SH = 'rgba(70,62,48,', X0 = 512;
  g.fillStyle = ST; g.fillRect(X0, 0, 512, H);
  // fluting: each flute a hollow (dark to one side, light to the other) between narrow fillets
  for (let i = 0; i < 24; i++) { const x = X0 + i * 512 / 24, w = 512 / 24, gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#f7f3e8'); gr.addColorStop(0.12, '#f7f3e8'); gr.addColorStop(0.2, '#a9a18e'); gr.addColorStop(0.5, '#d6cfbe'); gr.addColorStop(0.86, '#f3eee2'); gr.addColorStop(1, '#f7f3e8'); g.fillStyle = gr; g.fillRect(x, 0, w + 0.5, 64); }
  // volute: a spiral scroll with an eye, on a 256 cell
  { const cx = X0 + 128, cy = 64 + 128; g.fillStyle = '#ece6d6'; g.beginPath(); g.arc(cx, cy, 124, 0, 7); g.fill();
    g.strokeStyle = SH + '0.75)'; g.lineWidth = 9; g.beginPath(); for (let t = 0; t <= 1; t += 0.004) { const a = t * Math.PI * 5.5, rr = 118 * (1 - t) ** 1.15 + 9; const x = cx + Math.cos(a - 1.2) * rr, y = cy + Math.sin(a - 1.2) * rr; t === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.stroke(); g.fillStyle = SH + '0.6)'; g.beginPath(); g.arc(cx, cy, 12, 0, 7); g.fill(); g.strokeStyle = SH + '0.5)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 121, 0, 7); g.stroke(); }
  // the great door: bronze-green leaves with panels and studs
  { const x = X0 + 256, y = 64; g.fillStyle = '#2f3b33'; g.fillRect(x, y, 256, 256);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { const px = x + 12 + i * 126, py = y + 10 + j * 82; g.fillStyle = '#3d4c41'; g.fillRect(px, py, 106, 70); g.strokeStyle = '#1c241f'; g.lineWidth = 4; g.strokeRect(px + 8, py + 8, 90, 54); g.strokeStyle = 'rgba(160,180,150,0.35)'; g.lineWidth = 1.5; g.strokeRect(px + 12, py + 12, 82, 46); g.fillStyle = '#9a8a50'; g.beginPath(); g.arc(px + 53, py + 35, 5, 0, 7); g.fill(); }
    g.fillStyle = '#141a16'; g.fillRect(x + 125, y, 6, 256); }
  // dentil course under a strip of egg-and-dart
  { const y = 320; g.fillStyle = '#e9e3d4'; g.fillRect(X0, y, 512, 64);
    for (let i = 0; i < 32; i++) { const x = X0 + i * 16; g.fillStyle = SH + '0.8)'; g.fillRect(x + 9, y + 30, 7, 30); g.fillStyle = '#f8f5ec'; g.fillRect(x, y + 30, 9, 28); g.fillStyle = SH + '0.45)'; g.fillRect(x, y + 58, 16, 6); }
    for (let i = 0; i < 32; i++) { const x = X0 + i * 16 + 8; g.fillStyle = SH + '0.55)'; g.beginPath(); g.ellipse(x, y + 13, 6.5, 10, 0, 0, 7); g.fill(); g.fillStyle = '#f8f5ec'; g.beginPath(); g.ellipse(x - 0.8, y + 12, 4.6, 8, 0, 0, 7); g.fill(); }
    g.fillStyle = SH + '0.5)'; g.fillRect(X0, y + 25, 512, 3); }
  // a ceiling coffer: stepped recess with a rosette
  { const x = X0, y = 384; g.fillStyle = '#d9d2c0'; g.fillRect(x, y, 256, 256); [['#bdb5a0', 18], ['#a29a86', 40], ['#8e8672', 60]].forEach(([col, d]) => { g.fillStyle = col; g.fillRect(x + d, y + d, 256 - 2 * d, 256 - 2 * d); g.fillStyle = 'rgba(40,34,24,0.35)'; g.fillRect(x + d, y + d, 256 - 2 * d, 6); g.fillRect(x + d, y + d, 6, 256 - 2 * d); });
    g.fillStyle = '#e6dfcd'; for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4; g.beginPath(); g.ellipse(x + 128 + Math.cos(an) * 26, y + 128 + Math.sin(an) * 26, 22, 11, an, 0, 7); g.fill(); } g.fillStyle = '#b5ad98'; g.beginPath(); g.arc(x + 128, y + 128, 11, 0, 7); g.fill(); }
  // a laurel wreath (for the frieze's centre and the tympanum's eye)
  { const cx = X0 + 384, cy = 384 + 128; for (let k = 0; k < 28; k++) { const an = (k / 28) * Math.PI * 2; g.fillStyle = SH + '0.45)'; g.beginPath(); g.ellipse(cx + Math.cos(an) * 84 + 2, cy + Math.sin(an) * 84 + 3, 22, 9, an + 1.9, 0, 7); g.fill(); g.fillStyle = '#faf7ef'; g.beginPath(); g.ellipse(cx + Math.cos(an) * 84, cy + Math.sin(an) * 84, 21, 8, an + 1.9, 0, 7); g.fill(); } }
  // anthemion frieze: palmettes alternating with lotus buds
  { const y = 640; for (let i = 0; i < 16; i++) { const cx = X0 + i * 32 + 16, by = y + 58; g.strokeStyle = SH + '0.6)'; g.lineWidth = 2.6; for (let k = -3; k <= 3; k++) { const an = -Math.PI / 2 + k * (i % 2 ? 0.2 : 0.36); g.beginPath(); g.moveTo(cx, by); g.quadraticCurveTo(cx + Math.cos(an) * 20, by + Math.sin(an) * 30, cx + Math.cos(an + k * 0.12) * (i % 2 ? 30 : 24), by + Math.sin(an + k * 0.12) * (i % 2 ? 50 : 44)); g.stroke(); } g.beginPath(); g.arc(cx - 16, by - 2, 9, -0.2, Math.PI * 0.9); g.stroke(); } g.fillStyle = SH + '0.4)'; g.fillRect(X0, y, 512, 3); g.fillRect(X0, y + 61, 512, 3); }
  g.fillStyle = ST; g.fillRect(X0, 960, 512, 64);
  return c;
}

export function buildPortico(ctx) {
  const { frame } = ctx, P = PORTICO, M = museumMats(), G = new Geo();
  const top0 = P.podium, capY = top0 + P.colH, entY = capY + P.ent, apex = entY + P.ped;
  const hw = P.width / 2 + 0.3;
  const A = 'banner';       // the atlas material's key (kept: the module and the test know the mesh by it)
  /** a box / polygon of plain Portland stone (pinned to the atlas's plain patch; tone by shade 0..1 via the v row) */
  const tools = (G) => ({
    pbox: (x0, y0, z0, x1, y1, z1, o = {}) => {
      const q = (pts, n) => G.poly(A, pts, n, pts.map(() => PIN));
      q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
      if (o.back !== false) q([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
      q([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]); q([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
      if (o.top !== false) q([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]);
      if (o.bottom) q([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
    },
    cellQ: (a, b2, c, d, x, y, w, h, flip = false) => { const r = [(x + (flip ? w : 0)) / 1024, 1 - (y + h) / 1024, (x + (flip ? 0 : w)) / 1024, 1 - y / 1024]; G.quadUV(A, a, b2, c, d, r); },
  });
  const { pbox, cellQ } = tools(G);
  G.color(0xffffff);
  // podium and steps (the steps run out into the forecourt): Bath stone, each tread with a lighter nosing
  for (let i = 0; i < P.steps; i++) {
    const h = ((i + 1) / P.steps) * P.podium, z1 = 0.6 + (P.steps - i) * 0.36;
    G.color(i % 2 ? 0xe2dccc : 0xdcd4c2); G.box('stone', -hw - 0.6, 0, P.wallZ, hw + 0.6, h, z1);
  }
  G.color(0xd4ccba); G.box('stone', -hw, 0, P.wallZ, hw, top0, 0.6);
  // the wall behind (the shaded face of the porch) in Bath stone, with the great doorway and two niches
  // (the great doorway is a real opening — the room is seen through it, core/interiors.js punches exactly this
  //  rectangle 3 cm in front of the wall: the wall is drawn round it, and a dark pane stands just behind the wall's
  //  face for the view from further off than rooms are shown)
  const dw = P.door.w / 2, dh = P.door.h, wz = P.wallZ;
  G.color(BATH);
  for (const [xa, xb, ya, yb] of [[-hw, -dw, top0, entY], [dw, hw, top0, entY], [-dw, dw, top0 + dh + 0.1, entY]]) G.poly('stone', [[xa, ya, wz + 0.02], [xb, ya, wz + 0.02], [xb, yb, wz + 0.02], [xa, yb, wz + 0.02]], [0, 0, 1]);
  G.color(0xffffff);
  pbox(-dw - 0.5, top0, wz, -dw, top0 + dh + 0.1, wz + 0.2, { back: false }); pbox(dw, top0, wz, dw + 0.5, top0 + dh + 0.1, wz + 0.2, { back: false });
  pbox(-dw - 0.62, top0 + dh + 0.1, wz, dw + 0.62, top0 + dh + 0.5, wz + 0.26, { back: false, bottom: true }); pbox(-dw - 0.8, top0 + dh + 0.5, wz, dw + 0.8, top0 + dh + 0.68, wz + 0.42, { back: false, bottom: true });
  for (const s of [-1, 1]) pbox(s * (dw + 0.55) - 0.14, top0 + dh - 0.5, wz, s * (dw + 0.55) + 0.14, top0 + dh + 0.5, wz + 0.36, { back: false, bottom: true });     // console brackets
  G.color(0x161b18); G.poly('stone', [[-dw, top0, wz + 0.004], [dw, top0, wz + 0.004], [dw, top0 + dh + 0.1, wz + 0.004], [-dw, top0 + dh + 0.1, wz + 0.004]], [0, 0, 1]); G.color(0xffffff);      // (single-sided: not seen from inside, looking out)
  for (const s of [-1, 1]) {
    G.color(0x7a715c); G.poly('stone', [[s * 3.4 - 0.7, top0 + 2.6, wz + 0.04], [s * 3.4 + 0.7, top0 + 2.6, wz + 0.04], [s * 3.4 + 0.7, top0 + 6.2, wz + 0.04], [s * 3.4, top0 + 6.8, wz + 0.04], [s * 3.4 - 0.7, top0 + 6.2, wz + 0.04]], [0, 0, 1]);
    G.color(0xffffff); pbox(s * 3.4 - 0.85, top0 + 2.44, wz, s * 3.4 + 0.85, top0 + 2.6, wz + 0.2, { back: false });
  }
  // side walls of the porch (antae) in Bath stone, their caps in Portland
  for (const s of [-1, 1]) {
    G.color(BATH); G.box('stone', s * P.antaX - 0.45, top0, P.wallZ, s * P.antaX + 0.45, capY - 0.5, P.colZ + 0.2);
    G.color(0xffffff); pbox(s * P.antaX - 0.55, capY - 0.5, P.colZ - 0.35, s * P.antaX + 0.55, capY, P.colZ + 0.3); pbox(s * P.antaX - 0.5, top0, P.colZ - 0.3, s * P.antaX + 0.5, top0 + 0.3, P.colZ + 0.25);
  }
  // the columns: Attic base (two tori and a scotia on a plinth), fluted shaft with entasis, Ionic capital with volutes
  for (const x of P.cols) {
    const z = P.colZ, r = P.r, y = top0;
    pbox(x - r - 0.2, y, z - r - 0.2, x + r + 0.2, y + 0.16, z + r + 0.2);
    lathe(G, A, x, y + 0.16, z, [[r + 0.17, 0], [r + 0.2, 0.06], [r + 0.17, 0.13], [r + 0.08, 0.15], [r + 0.06, 0.21], [r + 0.11, 0.24], [r + 0.13, 0.29], [r + 0.09, 0.35], [r, 0.38]], 16, { uv: PIN });
    const sh = P.colH - 0.54 - 0.62;
    lathe(G, A, x, y + 0.54, z, [[r, 0], [r * 0.99, sh * 0.33], [r * 0.93, sh * 0.7], [r * 0.85, sh]], 24, { u0: 0.5, u1: 1, uv: [0, 1 - 32 / 1024] });
    // neck with egg-and-dart echinus, the cushion and its scrolls front and back, bolsters at the sides, abacus
    lathe(G, A, x, capY - 0.62, z, [[r * 0.85, 0], [r * 0.9, 0.06], [r * 0.86, 0.1], [r * 1.02, 0.26]], 16, { uv: PIN });
    const vr = 0.36, vy = capY - 0.44, vx = r * 0.86 + 0.14;
    pbox(x - vx, vy + 0.02, z - r * 0.92, x + vx, capY - 0.12, z + r * 0.92, { bottom: true });
    for (const zz of [z + r * 0.94, z - r * 0.94]) for (const s of [-1, 1]) {
      const f = zz > z ? 1 : -1, x0 = x + s * vx - vr, x1 = x + s * vx + vr;
      const a = [f > 0 ? x0 : x1, vy - vr, zz], b2 = [f > 0 ? x1 : x0, vy - vr, zz], c2 = [f > 0 ? x1 : x0, vy + vr, zz], d = [f > 0 ? x0 : x1, vy + vr, zz];
      cellQ(a, b2, c2, d, 512, 64, 256, 256, (s > 0) !== (f > 0));
    }
    for (const s of [-1, 1]) { G.push(new THREE.Matrix4().makeTranslation(x + s * vx, vy, z).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))); lathe(G, A, 0, -r * 0.94, 0, [[vr * 0.97, 0], [vr * 0.7, r * 0.5], [vr * 0.62, r * 0.94], [vr * 0.7, r * 1.38], [vr * 0.97, r * 1.88]], 10, { uv: PIN }); G.pop(); }
    pbox(x - r - 0.16, capY - 0.12, z - r - 0.16, x + r + 0.16, capY, z + r + 0.16, { bottom: true });
  }
  // entablature: architrave of three fasciae, anthemion frieze with a wreath, dentils, cornice; returned to the wall
  const zf0 = P.colZ + P.r + 0.2;
  const ent = (y0, y1, out, o) => pbox(-hw - out, y0, P.wallZ, hw + out, y1, zf0 + out, { back: false, bottom: true, ...o });
  ent(capY, capY + 0.24, 0); ent(capY + 0.24, capY + 0.5, 0.045); ent(capY + 0.5, capY + 0.74, 0.09); ent(capY + 0.74, capY + 0.82, 0.14);
  ent(capY + 0.82, capY + 1.42, 0.02);
  { const y0 = capY + 0.86, y1 = capY + 1.38, z = zf0 + 0.03, n = 4; for (let i = 0; i < n; i++) { const xa = -hw + (2 * hw * i) / n, xb = -hw + (2 * hw * (i + 1)) / n; cellQ([xa, y0, z], [xb, y0, z], [xb, y1, z], [xa, y1, z], 512, 640, 512, 64); } }
  ent(capY + 1.42, capY + 1.5, 0.08);
  { const y0 = capY + 1.5, y1 = capY + 1.74, o = 0.14, n = 4;
    for (let i = 0; i < n; i++) { const xa = -hw - o + (2 * (hw + o) * i) / n, xb = -hw - o + (2 * (hw + o) * (i + 1)) / n; cellQ([xa, y0, zf0 + o], [xb, y0, zf0 + o], [xb, y1, zf0 + o], [xa, y1, zf0 + o], 512, 320, 512, 64); }
    for (const s of [-1, 1]) { const xx = s * (hw + o), a = [xx, y0, s > 0 ? zf0 + o : P.wallZ], b2 = [xx, y0, s > 0 ? P.wallZ : zf0 + o]; cellQ(a, b2, [b2[0], y1, b2[2]], [a[0], y1, a[2]], 512, 320, 160, 64); }
    pbox(-hw - o + 0.02, y0, P.wallZ, hw + o - 0.02, y1, zf0 + o - 0.02, { back: false, bottom: true, top: false }); }
  ent(capY + 1.74, capY + 1.86, 0.42); ent(capY + 1.86, entY, 0.5);
  // the porch ceiling: coffers
  { const y = capY - 0.005, z1 = zf0, z0 = P.wallZ, nx = 8, nz = 2; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const xa = -hw + (2 * hw * i) / nx, xb = -hw + (2 * hw * (i + 1)) / nx, za = z0 + ((z1 - z0) * j) / nz, zb = z0 + ((z1 - z0) * (j + 1)) / nz; cellQ([xa, y, zb], [xb, y, zb], [xb, y, za], [xa, y, za], 512, 384, 256, 256); } }
  // pediment: tympanum with a wreath in its eye, raking cornices over a dentil rake, roof slopes back to the wall
  const zf = zf0 + 0.5, zt = zf - 0.42, pw = hw + 0.5;
  G.poly(A, [[-hw, entY, zt], [hw, entY, zt], [0, apex - 0.2, zt]], [0, 0, 1], [PIN, PIN, PIN]);
  cellQ([-0.8, entY + 0.35, zt + 0.02], [0.8, entY + 0.35, zt + 0.02], [0.8, entY + 1.95, zt + 0.02], [-0.8, entY + 1.95, zt + 0.02], 768, 384, 256, 256);
  const slope = Math.atan2(apex - entY, pw);
  for (const s of [-1, 1]) {
    G.push(new THREE.Matrix4().makeTranslation(0, apex + 0.12, 0).multiply(new THREE.Matrix4().makeRotationZ(-s * slope)));
    const L = Math.hypot(pw, apex - entY);
    pbox(s > 0 ? 0 : -L, 0.0, P.wallZ - 1.2, s > 0 ? L : 0, 0.2, zf, { bottom: true, back: false }); pbox(s > 0 ? 0 : -L, -0.32, zt + 0.02, s > 0 ? L : 0, 0.0, zf - 0.14, { bottom: true, back: false, top: false });
    { const n = 3; for (let i = 0; i < n; i++) { const xa = (s > 0 ? 0 : -L) + (L * i) / n, xb = (s > 0 ? 0 : -L) + (L * (i + 1)) / n; cellQ([xa, -0.54, zt + 0.12], [xb, -0.54, zt + 0.12], [xb, -0.32, zt + 0.12], [xa, -0.32, zt + 0.12], 512, 350, 400, 34); } }
    G.pop();
  }
  // lead roof behind the pediment
  G.color(0x8e938e);
  G.poly('stone', [[-pw, entY + 0.3, zf - 0.3], [0, apex + 0.3, zf - 0.3], [0, apex + 0.3, P.wallZ - 1.2], [-pw, entY + 0.3, P.wallZ - 1.2]], [-1, 2, 0]);
  G.poly('stone', [[0, apex + 0.3, zf - 0.3], [pw, entY + 0.3, zf - 0.3], [pw, entY + 0.3, P.wallZ - 1.2], [0, apex + 0.3, P.wallZ - 1.2]], [1, 2, 0]);
  G.color(0xffffff);
  // acroteria at the corners; Apollo seated on the apex with his lyre (GUESS of pose)
  for (const s of [-1, 1]) { pbox(s * pw - 0.3, entY + 0.2, zf - 0.7, s * pw + 0.3, entY + 0.75, zf - 0.1); lathe(G, A, s * pw, entY + 0.75, zf - 0.4, [[0.26, 0], [0.34, 0.25], [0.2, 0.5], [0.3, 0.72], [0.02, 1.0]], 8, { sz: 0.45, uv: PIN }); }
  {
    const y = apex + 0.32, z = zf - 0.6, o = { uv: PIN };
    pbox(-0.62, y, z - 0.5, 0.62, y + 0.42, z + 0.5);
    pbox(-0.42, y + 0.42, z - 0.42, 0.42, y + 0.95, z + 0.1);                                               // the seat (a rock)
    lathe(G, A, 0, y + 0.42, z + 0.28, [[0.4, 0], [0.36, 0.3], [0.3, 0.52], [0.22, 0.6]], 10, { sz: 0.8, mod: (a) => 1 + 0.07 * Math.sin(a * 7), ...o });   // drapery over the knees
    for (const s of [-1, 1]) tube(G, A, [[s * 0.16, y + 1.0, z - 0.05], [s * 0.2, y + 1.02, z + 0.42], [s * 0.2, y + 0.5, z + 0.6]], 0.12, 6, o);
    lathe(G, A, 0, y + 0.95, z - 0.08, [[0.24, 0], [0.22, 0.2], [0.28, 0.55], [0.25, 0.72], [0.1, 0.82]], 10, { sz: 0.68, ...o });
    ball(G, A, 0, y + 2.0, z - 0.05, 0.15, 0.18, 0.16, 8, 5, o); ball(G, A, 0, y + 2.06, z - 0.09, 0.165, 0.15, 0.165, 8, 4, o);
    lathe(G, A, 0, y + 1.74, z - 0.07, [[0.08, 0], [0.07, 0.14]], 6, o);
    tube(G, A, [[0.3, y + 1.68, z - 0.05], [0.44, y + 1.3, z + 0.15], [0.56, y + 1.45, z + 0.4]], 0.07, 5, o);       // the arm to the lyre
    tube(G, A, [[-0.3, y + 1.68, z - 0.05], [-0.4, y + 1.25, z + 0.05], [-0.3, y + 1.0, z + 0.3]], 0.07, 5, o);
    for (const s of [-1, 1]) tube(G, A, [[0.62 + s * 0.02, y + 1.0, z + 0.4], [0.62 + s * 0.2, y + 1.35, z + 0.4], [0.62 + s * 0.14, y + 1.8, z + 0.4]], 0.035, 4, o);   // the lyre's horns
    pbox(0.44, y + 1.72, z + 0.37, 0.8, y + 1.78, z + 0.43); ball(G, A, 0.62, y + 1.0, z + 0.4, 0.14, 0.12, 0.08, 6, 4, o);
  }
  // forecourt banners on poles
  const banner = new THREE.MeshStandardMaterial({ map: canvasTexture(atlasCanvas), roughness: 0.82, side: THREE.DoubleSide, name: 'mus-ash-banner' });
  banner.map.anisotropy = 8;
  P.banners.forEach(([x, z], i) => {
    G.color(0x26282a); G.cyl('stone', x, 0, z, 0.07, 7.6, 8, 0.06); G.beam('stone', [x, 7.3, z], [x + 0.95, 7.3, z], 0.05);
    G.color(0xffffff); G.quadUV('banner', [x + 0.1, 2.9, z], [x + 0.95, 2.9, z], [x + 0.95, 7.25, z], [x + 0.1, 7.25, z], [i * 0.25, 0, i * 0.25 + 0.25, 1]);
  });
  const group = new THREE.Group(); group.name = 'mus:ash-portico';
  group.position.set(frame.ox, 0, frame.oz); group.rotation.y = frame.th; group.updateMatrix();   // (world.addStatic recomposes the matrix from these)
  const meshes = G.build({ stone: M.stone, banner }, group, { name: 'mus-ash-portico', cast: true });

  // ------------------------------------------------------------------------------------------------------------
  // Cockerell's range either side of the portico, as the photographs show it (a 2014 view of the forecourt): Bath stone
  // between plain Portland pilasters, in each bay ONE wide high window in a Portland architrave (the sculpture gallery's
  // light: a real opening, _mus_ash_plan.js ASH_WINDOWS), a plain sunk panel under it and a wreath in a square frame
  // over it (the upper galleries are top-lit: no upper windows), the portico's entablature carried along, a plain
  // blocking course above. It stands 6-18 cm in front of the mapped wall (whose generic painted windows it hides), and
  // on the roof behind is the top of Mather's building: the atrium's lantern and the restaurant (GUESS of its shape).
  const R = new Geo(), T = tools(R), yTop = 15.06, wy0 = top0 + PL.winY0, wy1 = top0 + PL.winY1, ww = PL.winW / 2;
  for (const s of [-1, 1]) {
    const zf = s < 0 ? PL.faceZ.w : PL.faceZ.e, xa = s < 0 ? -21.66 : PL.faceX, xb = s < 0 ? -PL.faceX : 23.64;
    const wins = ASH_WINDOWS.filter((w) => Math.sign(w.x) === s).map((w) => w.x).sort((p, q) => p - q);
    const wq = (x0, x1, y0, y1, col = BATH, o = 0) => { if (x1 - x0 > 1e-3 && y1 - y0 > 1e-3) { R.color(col); R.poly('stone', [[x0, y0, zf + o], [x1, y0, zf + o], [x1, y1, zf + o], [x0, y1, zf + o]], [0, 0, 1]); } };
    let x = xa;
    for (const c of wins) { wq(x, c - ww, 0, yTop); wq(c - ww, c + ww, 0, wy0); wq(c - ww, c + ww, wy1, yTop); x = c + ww; }
    wq(x, xb, 0, yTop);
    R.color(0xd4ccba); R.box('stone', xa, 0, zf, xb, top0, zf + 0.1);                                    // the plinth
    R.color(0xffffff);
    // pilasters on the bay lines (the one at the portico is behind its anta)
    for (let i = 0; i <= 4; i++) {
      const c = s * (6.81 + i * PL.bay), x0 = Math.max(xa, c - 0.37), x1 = Math.min(xb, c + 0.37); if (x1 - x0 < 0.2) continue;
      T.pbox(x0, top0, zf, x1, capY - 0.42, zf + 0.14, { back: false }); T.pbox(x0 - 0.04, top0, zf, x1 + 0.04, top0 + 0.34, zf + 0.2, { back: false });
      T.pbox(x0 - 0.05, capY - 0.42, zf, x1 + 0.05, capY, zf + 0.21, { back: false, bottom: true });
    }
    for (const c of wins) {
      // the architrave round the window, its sill; the dark pane for the far view (the room is punched in front of it)
      T.pbox(c - ww - 0.24, wy0, zf, c - ww, wy1, zf + 0.1, { back: false }); T.pbox(c + ww, wy0, zf, c + ww + 0.24, wy1, zf + 0.1, { back: false });
      T.pbox(c - ww - 0.3, wy1, zf, c + ww + 0.3, wy1 + 0.26, zf + 0.12, { back: false, bottom: true }); T.pbox(c - ww - 0.36, wy1 + 0.26, zf, c + ww + 0.36, wy1 + 0.36, zf + 0.2, { back: false, bottom: true });
      T.pbox(c - ww - 0.34, wy0 - 0.2, zf, c + ww + 0.34, wy0, zf + 0.18, { back: false, bottom: true });
      wq(c - ww, c + ww, wy0, wy1, 0x1b2229, -0.03);
      // the sunk panel under it
      wq(c - ww - 0.1, c + ww + 0.1, top0 + 0.75, wy0 - 0.55, 0xdccfa8, 0.012);
      for (const [p0, p1, q0, q1] of [[c - ww - 0.18, c + ww + 0.18, top0 + 0.67, top0 + 0.75], [c - ww - 0.18, c + ww + 0.18, wy0 - 0.55, wy0 - 0.47], [c - ww - 0.18, c - ww - 0.1, top0 + 0.75, wy0 - 0.55], [c + ww + 0.1, c + ww + 0.18, top0 + 0.75, wy0 - 0.55]]) T.pbox(p0, q0, zf, p1, q1, zf + 0.04, { back: false, bottom: true });
      // the wreath in its square frame
      const wy = top0 + 7.25, hs = 0.86;
      wq(c - hs, c + hs, wy - hs, wy + hs, 0xdccfa8, 0.012);
      T.cellQ([c - 0.7, wy - 0.7, zf + 0.03], [c + 0.7, wy - 0.7, zf + 0.03], [c + 0.7, wy + 0.7, zf + 0.03], [c - 0.7, wy + 0.7, zf + 0.03], 768, 384, 256, 256);
      for (const [p0, p1, q0, q1] of [[c - hs - 0.1, c + hs + 0.1, wy - hs - 0.1, wy - hs], [c - hs - 0.1, c + hs + 0.1, wy + hs, wy + hs + 0.1], [c - hs - 0.1, c - hs, wy - hs, wy + hs], [c + hs, c + hs + 0.1, wy - hs, wy + hs]]) T.pbox(p0, q0, zf, p1, q1, zf + 0.07, { back: false, bottom: true });
    }
    // the band at the windows' heads, between the pilasters
    T.pbox(xa, wy1 + 0.36, zf, xb, wy1 + 0.5, zf + 0.05, { back: false, bottom: true });
    // the entablature carried along from the portico: architrave, anthemion frieze, dentils, cornice
    const ent = (y0, y1, out) => T.pbox(xa, y0, zf, xb, y1, zf + 0.26 + out, { back: false, bottom: true });
    ent(capY, capY + 0.24, 0); ent(capY + 0.24, capY + 0.5, 0.045); ent(capY + 0.5, capY + 0.74, 0.09); ent(capY + 0.74, capY + 0.82, 0.14); ent(capY + 0.82, capY + 1.42, 0.02);
    { const n = Math.round((xb - xa) / 3.4), z = zf + 0.29; for (let i = 0; i < n; i++) { const p0 = xa + ((xb - xa) * i) / n, p1 = xa + ((xb - xa) * (i + 1)) / n; T.cellQ([p0, capY + 0.86, z], [p1, capY + 0.86, z], [p1, capY + 1.38, z], [p0, capY + 1.38, z], 512, 640, 512, 64); T.cellQ([p0, capY + 1.5, z + 0.12], [p1, capY + 1.5, z + 0.12], [p1, capY + 1.74, z + 0.12], [p0, capY + 1.74, z + 0.12], 512, 320, 512, 64); } }
    ent(capY + 1.42, capY + 1.5, 0.08); ent(capY + 1.5, capY + 1.74, 0.1); ent(capY + 1.74, capY + 1.86, 0.42); ent(capY + 1.86, entY, 0.5);
    T.pbox(xa, yTop - 0.16, zf - 0.8, xb, yTop, zf + 0.1);                                              // the coping of the blocking course (back over the mapped wall's own parapet)
  }
  // the top of Mather's building on the roof (world heights: the roof deck is at 14.2): pale walls, the restaurant's
  // glass left open (real openings: the dark panes are the far view), a flat roof with the lantern's glass
  {
    const y0 = 14.2, y1 = top0 + PL.ROOF + 0.2, o = 0.25, HWo = PL.HW + o, N = PL.ZN - o, S = PL.ZH + o, E = PL.EX + o, RS = PL.RZ + o, WALL = 0xe9e5da;
    const [ge, gs] = ASH_ROOF_GLASS, e0 = ge.at[1] - ge.w / 2, e1 = ge.at[1] + ge.w / 2, s0 = gs.at[0] - gs.w / 2, s1 = gs.at[0] + gs.w / 2, g0 = top0 + ge.y0, g1 = top0 + ge.y1;
    const wall = (a, b, n, ya = y0, yb = y1, col = WALL, k = 0) => { R.color(col); R.poly('stone', [[a[0] + n[0] * k, ya, a[1] + n[2] * k], [b[0] + n[0] * k, ya, b[1] + n[2] * k], [b[0] + n[0] * k, yb, b[1] + n[2] * k], [a[0] + n[0] * k, yb, a[1] + n[2] * k]], n); };
    wall([-HWo, S], [HWo, S], [0, 0, 1]); wall([-HWo, N], [-HWo, S], [-1, 0, 0]); wall([-HWo, N], [E, N], [0, 0, -1]); wall([HWo, RS], [HWo, S], [1, 0, 0]);
    // east: the restaurant's glass
    wall([E, N], [E, e0], [1, 0, 0]); wall([E, e1], [E, RS], [1, 0, 0]); wall([E, e0], [E, e1], [1, 0, 0], y0, g0); wall([E, e0], [E, e1], [1, 0, 0], g1, y1); wall([E, e0], [E, e1], [1, 0, 0], g0, g1, 0x1b2229, -0.03);
    wall([HWo, RS], [s0, RS], [0, 0, 1]); wall([s1, RS], [E, RS], [0, 0, 1]); wall([s0, RS], [s1, RS], [0, 0, 1], y0, g0); wall([s0, RS], [s1, RS], [0, 0, 1], g1, y1); wall([s0, RS], [s1, RS], [0, 0, 1], g0, g1, 0x1b2229, -0.03);
    R.color(0xaebfc4); R.poly('stone', [[-HWo, y1, S], [HWo, y1, S], [HWo, y1, N], [-HWo, y1, N]], [0, 1, 0]);
    R.color(0xc9c6bc); R.poly('stone', [[HWo, y1, RS], [E, y1, RS], [E, y1, N], [HWo, y1, N]], [0, 1, 0]);
    R.color(0xffffff); for (const [a, b] of [[[-HWo, S], [HWo, S]], [[E, N], [E, RS]]]) T.pbox(Math.min(a[0], b[0]) - 0.04, y1 - 0.14, Math.min(a[1], b[1]) - 0.04, Math.max(a[0], b[0]) + 0.04, y1 + 0.04, Math.max(a[1], b[1]) + 0.04, { bottom: true });
  }
  const range = new THREE.Group(); range.name = 'mus:ash-range';
  range.position.set(frame.ox, 0, frame.oz); range.rotation.y = frame.th; range.updateMatrix();
  const rangeMeshes = R.build({ stone: M.stone, banner }, range, { name: 'mus-ash-range', cast: true });
  return { group, meshes, range, rangeMeshes, dims: { ...PORTICO, apex: apex + 2.5 } };
}
