// Flora pass (2026-11): how the small plants are drawn (owned by systems/flora.js). ONE draw for every plant near the
// camera: an instanced pair of crossed cards (4 triangles a plant; a flat kind lies on the ground as one card) with
// two instanced vec4s, textured from one 1024 x 512 sheet of 32 plants painted here on a canvas (no assets). The vertex
// shader places, sways, shrinks with distance (so nothing pops: a plant has shrunk to nothing where it leaves the
// buffer) and bends each plant a little away from the player's feet; normals point up, so a plant is lit and shadowed
// like the grass it stands in. The hills (world/terrain.js) lift it like everything else (three's project_vertex).
import * as THREE from 'three';
import { KINDS, KI } from './_flora_plan.js';

const COLS = 8, ROWS = 4, PX = 128;

// ---------------------------------------------------------------- the sheet
function paint(g) {
  let s = 20131;
  const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const rr = (a, b) => a + (b - a) * R();
  const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
  const G1 = [92, 142, 54], G2 = [70, 118, 46], G3 = [118, 158, 70], GD = [48, 86, 40], GG = [112, 138, 104];
  const greens = [G1, G2, G3];
  const pickG = () => greens[(R() * 3) | 0];
  const blade = (x, y, len, lean, w, c, k = 1) => { g.strokeStyle = rgb(c, k); g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.25, y - len * 0.6, x + lean, y - len); g.stroke(); };
  const dot = (x, y, r, c, k = 1) => { g.fillStyle = rgb(c, k); g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };
  const leaf = (x, y, len, ang, wid, c, k = 1) => { g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = rgb(c, k); g.beginPath(); g.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, 6.2832); g.fill(); g.restore(); };
  const petals = (x, y, r, n, c, eye, k = 1) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832 + 0.3; dot(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, c, k); } if (eye) dot(x, y, r * 0.42, eye); };
  const daisy = (x, y, r) => { g.strokeStyle = '#f4f2ea'; g.lineWidth = Math.max(1.6, r * 0.42); g.lineCap = 'round'; for (let i = 0; i < 11; i++) { const a = (i / 11) * 6.2832; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); } dot(x, y, r * 0.38, [232, 186, 40]); };
  /** a dome of leaf blobs: darker inside and below, lighter on top */
  const mound = (cx, base, w, h, c, n = 70, lobes = 0) => {
    for (let i = 0; i < n; i++) {
      const t = R(), a = Math.PI * R(), rad = Math.sqrt(R()), x = cx + Math.cos(a) * w / 2 * rad, y = base - Math.sin(a) * h * rad * (0.85 + 0.15 * t);
      const k = 0.62 + 0.5 * (base - y) / h + rr(-0.08, 0.08);
      if (lobes) leaf(x, y, rr(7, 12), rr(0, 6.28), rr(4, 7), c, k); else dot(x, y, rr(3.5, 6.5), c, k);
    }
  };
  const spire = (x, y0, y1, w, c, c2) => { const n = Math.round((y0 - y1) / 3.2); for (let i = 0; i <= n; i++) { const t = i / n, y = y0 - (y0 - y1) * t, ww = w * (1 - t * 0.72); for (const sd of [-1, 0, 1]) dot(x + sd * ww * 0.5 + rr(-1, 1), y + rr(-1, 1), rr(2.2, 3.4) * (1 - t * 0.4), R() < 0.3 ? c2 : c, rr(0.85, 1.12)); } };
  const cells = {
    tuft() { for (let i = 0; i < 34; i++) { const x = rr(22, 106), h = rr(48, 118) * (1 - Math.abs(x - 64) / 90); blade(x, 127, h, rr(-20, 20), rr(2.2, 3.6), pickG(), rr(0.8, 1.12)); } for (let i = 0; i < 4; i++) { const x = rr(36, 92); blade(x, 127, rr(96, 120), rr(-10, 10), 1.6, [150, 146, 84]); } },
    weed() { for (let i = 0; i < 12; i++) { const a = Math.PI + (i + R()) / 12 * Math.PI; leaf(64, 122, rr(34, 54), a * 1 + 0, rr(11, 16), i % 3 ? G2 : G1, rr(0.8, 1.1)); } for (const [x, h] of [[44, 78], [70, 100], [88, 62]]) { blade(x, 122, h, rr(-6, 6), 2.4, G3); petals(x + rr(-3, 3), 122 - h, 10, 9, [236, 196, 36], [222, 168, 26]); } blade(56, 122, 60, -4, 2, G3); dot(52, 60, 9, [236, 236, 228]); },
    daisy() { for (let i = 0; i < 16; i++) leaf(rr(20, 108), rr(20, 108), rr(8, 14), rr(0, 6.28), rr(4, 6), pickG(), rr(0.75, 1)); for (const [x, y] of [[30, 34], [64, 22], [98, 40], [46, 62], [82, 70], [24, 88], [60, 100], [100, 98], [72, 46]]) daisy(x + rr(-4, 4), y + rr(-4, 4), rr(7, 9.5)); },
    buttercup() { for (let i = 0; i < 16; i++) { const x = rr(30, 98); blade(x, 127, rr(40, 70), rr(-14, 14), 2, pickG()); leaf(x + rr(-6, 6), rr(92, 118), rr(10, 16), rr(-2.6, -0.5), rr(5, 8), G2, rr(0.8, 1.05)); } for (let i = 0; i < 11; i++) { const x = rr(18, 110), y = rr(10, 70); blade(x, 127, 127 - y, (x - 64) * 0.25, 1.7, G3); petals(x + (x - 64) * 0.25, y, 7.5, 5, [244, 208, 28], [226, 170, 20]); } },
    clover() { for (let i = 0; i < 46; i++) { const x = rr(16, 112), y = rr(16, 112), c = pickG(), k = rr(0.78, 1.05); for (let j = 0; j < 3; j++) { const a = j * 2.094 + i; dot(x + Math.cos(a) * 4.2, y + Math.sin(a) * 4.2, 4.2, c, k); } } for (const [x, y] of [[34, 30], [74, 26], [100, 60], [50, 66], [84, 96], [28, 98], [62, 108]]) { dot(x, y, 7, [238, 226, 232]); dot(x + 1, y - 1, 4, [228, 190, 214]); } },
    oxeye() { for (let i = 0; i < 14; i++) blade(rr(34, 94), 127, rr(40, 90), rr(-12, 12), 2, pickG(), rr(0.8, 1.05)); for (const [x, y] of [[26, 24], [52, 12], [76, 18], [100, 26], [38, 44], [64, 38], [88, 48], [112, 56], [16, 58], [50, 66], [78, 72]]) { blade(64 + (x - 64) * 0.35, 127, 127 - y, (x - 64) * 0.65, 1.8, G2); daisy(x, y, 8.6); } },
    cowparsley() { for (let i = 0; i < 9; i++) { const x = rr(34, 94), h = rr(70, 104), lean = (x - 64) * rr(0.3, 0.9); blade(x, 127, h, lean, 2, G2); for (let j = 0; j < 3; j++) blade(x + lean * 0.6, 127 - h * 0.62, rr(16, 28), lean * 0.5 + rr(-18, 18), 1.3, G3); } for (let i = 0; i < 22; i++) leaf(rr(26, 102), rr(84, 124), rr(10, 20), rr(-2.9, -0.2), rr(3, 5), pickG(), rr(0.75, 1)); for (let i = 0; i < 12; i++) { const x = rr(12, 116), y = rr(8, 44); for (let j = 0; j < 22; j++) dot(x + rr(-12, 12), y + rr(-4.5, 4.5), rr(1.5, 2.6), [244, 244, 236], rr(0.9, 1)); } },
    thistle() { for (let i = 0; i < 5; i++) { const x = rr(40, 88), h = rr(74, 104), lean = (x - 64) * 0.5; blade(x, 127, h, lean, 3, GG, 0.9); for (let j = 0; j < 6; j++) { const y = 127 - h * (j + 1) / 7, sd = j % 2 ? 1 : -1; g.fillStyle = rgb(GG, rr(0.75, 1)); g.beginPath(); g.moveTo(x + lean * (j + 1) / 7, y); g.lineTo(x + sd * rr(16, 26), y - 6); g.lineTo(x + sd * 10, y - 1); g.lineTo(x + sd * rr(14, 24), y + 7); g.closePath(); g.fill(); } dot(x + lean, 127 - h + 5, 7.5, [96, 122, 82]); for (let j = 0; j < 9; j++) blade(x + lean + rr(-5, 5), 127 - h + 2, rr(9, 14), rr(-6, 6), 2.2, [168, 92, 176], rr(0.9, 1.1)); } },
    dock() { for (let i = 0; i < 9; i++) leaf(64, 124, rr(36, 62), -Math.PI * (0.12 + 0.76 * (i + R()) / 9), rr(13, 19), G2, rr(0.75, 1.02)); for (const x of [46, 62, 80]) { const h = rr(84, 112); blade(x, 124, h, rr(-6, 6), 2.6, [126, 98, 60]); for (let j = 0; j < 46; j++) { const t = R(); dot(x + rr(-6, 6) * (1.1 - t), 124 - h * (0.42 + 0.58 * t), rr(1.8, 3), R() < 0.5 ? [150, 84, 52] : [128, 66, 44], rr(0.85, 1.1)); } } },
    nettle() { for (let i = 0; i < 6; i++) { const x = rr(30, 98), h = rr(84, 118), lean = rr(-8, 8); blade(x, 127, h, lean, 2.4, GD, 1.1); for (let j = 1; j < 8; j++) { const y = 127 - h * j / 8, xx = x + lean * j / 8, l = 20 - j * 1.2; for (const sd of [-1, 1]) { g.fillStyle = rgb(GD, rr(0.95, 1.35)); g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + sd * l * 0.5, y - 6); g.lineTo(xx + sd * l, y + 3); g.lineTo(xx + sd * l * 0.5, y + 6); g.closePath(); g.fill(); } if (j > 4) blade(xx, y, 9, rr(-9, 9), 1.4, [150, 160, 96]); } } },
    willowherb() { for (let i = 0; i < 6; i++) { const x = rr(28, 100), h = rr(96, 122), lean = rr(-7, 7); blade(x, 127, h, lean, 2.2, [110, 120, 70]); for (let j = 1; j < 9; j++) { const y = 127 - h * 0.58 * j / 9; leaf(x + lean * 0.5 * j / 9, y, rr(13, 19), j % 2 ? -0.5 : Math.PI + 0.5, 4, G2, rr(0.8, 1.05)); } spire(x + lean * 0.8, 127 - h * 0.56, 127 - h, 9, [206, 84, 150], [226, 128, 178]); } },
    reed() { for (let i = 0; i < 20; i++) { const x = rr(22, 106); blade(x, 127, rr(70, 112), rr(-14, 14), rr(2.6, 3.8), R() < 0.3 ? [136, 150, 80] : G2, rr(0.8, 1.1)); } for (let i = 0; i < 7; i++) { const x = rr(28, 100), lean = rr(-10, 10); blade(x, 127, 116, lean, 2, [140, 140, 84]); for (let j = 0; j < 12; j++) blade(x + lean * 0.92, 127 - 104 + rr(-4, 8), rr(8, 16), lean * 0.3 + rr(-8, 8), 2.2, [128, 96, 92], rr(0.85, 1.15)); } },
    iris() { for (let i = 0; i < 13; i++) { const x = rr(36, 92); g.fillStyle = rgb(R() < 0.5 ? [104, 142, 96] : [86, 128, 80], rr(0.85, 1.08)); const h = rr(70, 110), lean = (x - 64) * rr(0.2, 0.7); g.beginPath(); g.moveTo(x - 4, 127); g.quadraticCurveTo(x + lean * 0.3, 127 - h * 0.6, x + lean, 127 - h); g.quadraticCurveTo(x + lean * 0.3 + 5, 127 - h * 0.5, x + 4, 127); g.closePath(); g.fill(); } for (const [x, y] of [[40, 30], [70, 18], [94, 38]]) { blade(64 + (x - 64) * 0.4, 127, 127 - y - 6, (x - 64) * 0.6, 2.4, G2); for (const a of [-2.5, -0.6, 1.57]) leaf(x, y, 13, a, 9, [240, 204, 44]); dot(x, y - 2, 4.5, [250, 226, 90]); } },
    rush() { for (let i = 0; i < 44; i++) { const a = rr(-0.62, 0.62), l = rr(60, 120); blade(64 + rr(-10, 10), 127, l * Math.cos(a), l * Math.sin(a), rr(1.6, 2.4), R() < 0.5 ? [58, 104, 60] : [76, 118, 62], rr(0.8, 1.1)); if (i % 4 === 0) dot(64 + l * Math.sin(a) * 0.86, 127 - l * Math.cos(a) * 0.8, 3.2, [120, 92, 60]); } },
    lily() { for (const [x, y, r] of [[40, 44, 26], [86, 36, 22], [78, 86, 28], [30, 92, 18]]) { g.fillStyle = rgb([62, 112, 60], rr(0.9, 1.1)); const a0 = rr(0, 6.28); g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, a0, a0 + 5.8); g.closePath(); g.fill(); g.strokeStyle = rgb([44, 86, 46]); g.lineWidth = 1.5; g.stroke(); dot(x - r * 0.2, y - r * 0.2, r * 0.45, [84, 136, 70], 1); } for (const [x, y] of [[60, 58], [100, 70]]) { petals(x, y, 10, 9, [246, 244, 238], null); petals(x, y, 6, 7, [250, 236, 226], [240, 200, 60]); } },
    fern() { for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.1 + 0.8 * (i + R() * 0.6) / 9), l = rr(70, 104), c = R() < 0.5 ? [96, 150, 58] : [82, 136, 54]; for (let t = 0.08; t < 1; t += 0.055) { const bend = t * t * 0.5 * (Math.cos(a) > 0 ? 1 : -1), x = 64 + Math.cos(a + bend) * l * t, y = 124 + Math.sin(a + bend) * l * t, pl = 15 * (1 - t) + 3; for (const sd of [-1, 1]) leaf(x, y, pl, a + bend + sd * 1.25, 4, c, rr(0.8, 1.1)); } } },
    ivy() { for (let i = 0; i < 44; i++) { const x = rr(10, 118), y = 127 - rr(4, 60) * (1 - Math.abs(x - 64) / 80); const c = R() < 0.6 ? [44, 84, 44] : [58, 100, 50], k = rr(0.85, 1.15); g.fillStyle = rgb(c, k); g.beginPath(); const r = rr(7, 11); for (let j = 0; j < 5; j++) { const a = -1.57 + (j - 2) * 0.62, rad = j % 2 ? r * 0.72 : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.lineTo(x, y + r * 0.5); g.closePath(); g.fill(); g.strokeStyle = rgb([120, 150, 100]); g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y + r * 0.4); g.lineTo(x, y - r * 0.6); g.stroke(); } },
    moss() { for (let i = 0; i < 60; i++) { const a = rr(0, 6.28), rad = Math.sqrt(R()) * 46; dot(64 + Math.cos(a) * rad * 1.1, 64 + Math.sin(a) * rad * 0.8, rr(5, 10), R() < 0.5 ? [98, 128, 50] : [74, 108, 46], rr(0.8, 1.12)); } for (let i = 0; i < 60; i++) dot(rr(26, 102), rr(34, 94), 1.6, [140, 160, 70]); },
    buddleia() { for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.16 + 0.68 * (i + R() * 0.5) / 9), l = rr(72, 100), ex = 64 + Math.cos(a) * l, ey = 126 + Math.sin(a) * l; g.strokeStyle = rgb([110, 100, 76]); g.lineWidth = 2.4; g.beginPath(); g.moveTo(64 + rr(-6, 6), 127); g.quadraticCurveTo(64 + Math.cos(a) * l * 0.4, 126 + Math.sin(a) * l * 0.7, ex, ey); g.stroke(); for (let j = 2; j < 8; j++) { const t = j / 8, x = 64 + Math.cos(a) * l * t, y = 126 + Math.sin(a) * l * t * (0.7 + 0.3 * t); for (const sd of [-1, 1]) leaf(x, y, rr(14, 20), a + sd * 0.9, 5, [100, 128, 92], rr(0.8, 1.05)); } const droop = Math.cos(a) * 0.5; for (let j = 0; j < 9; j++) { const t = j / 9; dot(ex + droop * t * 20 + rr(-1.5, 1.5), ey - 4 + t * t * 8 - t * 22 + rr(-1, 1), 5.2 * (1 - t * 0.7), R() < 0.3 ? [150, 110, 190] : [118, 78, 164], rr(0.9, 1.1)); } } },
    valerian() { for (let i = 0; i < 7; i++) { const x = rr(34, 94), h = rr(70, 106), lean = (x - 64) * rr(0.3, 0.7); blade(x, 127, h, lean, 2.4, [108, 140, 110]); for (let j = 1; j < 6; j++) for (const sd of [-1, 1]) leaf(x + lean * j / 7 * 0.8, 127 - h * j / 7, 15, sd > 0 ? -0.4 : Math.PI + 0.4, 6.5, [96, 134, 106], rr(0.85, 1.05)); for (let j = 0; j < 26; j++) dot(x + lean + rr(-11, 11), 127 - h + rr(-7, 6), rr(2, 3.2), R() < 0.4 ? [214, 96, 110] : [188, 62, 84], rr(0.9, 1.1)); } },
    delphinium() { mound(64, 127, 70, 30, G2, 34, 1); for (const [x, top] of [[42, 14], [66, 4], [88, 20]]) { blade(x, 124, 124 - top, rr(-3, 3), 2.4, G2); spire(x, 92, top, 13, [72, 92, 190], [112, 132, 222]); } },
    lupin() { mound(64, 127, 72, 32, G1, 34, 1); for (const [x, top, c, c2] of [[40, 30, [198, 96, 160], [226, 150, 196]], [64, 12, [150, 86, 170], [196, 140, 206]], [90, 26, [206, 110, 150], [236, 170, 190]]]) { blade(x, 124, 124 - top, rr(-3, 3), 2.4, G2); spire(x, 86, top, 11, c, c2); } },
    rose() { mound(64, 127, 112, 104, [56, 98, 50], 150, 1); for (let i = 0; i < 12; i++) { const a = Math.PI * R(), rad = Math.sqrt(R()), x = 64 + Math.cos(a) * 50 * rad, y = 122 - Math.sin(a) * 92 * rad, c = i % 3 === 0 ? [226, 150, 164] : [196, 50, 66]; dot(x, y, 8.5, c); dot(x, y, 5.5, c, 0.82); dot(x - 1.5, y - 1.5, 2.6, c, 1.12); } },
    lavender() { mound(64, 127, 96, 52, [122, 138, 116], 80); for (let i = 0; i < 44; i++) { const a = rr(-1.05, 1.05), l = rr(74, 118), x0 = 64 + rr(-26, 26), ex = x0 + Math.sin(a) * l * 0.6, ey = 127 - Math.cos(a) * l; blade(x0, 110, 110 - ey, ex - x0, 1.3, [128, 144, 120]); for (let j = 0; j < 5; j++) dot(ex - Math.sin(a) * j * 3.4, ey + Math.cos(a) * j * 3.4, 2.5, R() < 0.3 ? [150, 126, 200] : [116, 92, 176], rr(0.9, 1.1)); } },
    geranium() { mound(64, 127, 112, 92, G1, 120, 1); for (let i = 0; i < 16; i++) { const a = Math.PI * R(), rad = 0.4 + 0.6 * Math.sqrt(R()); petals(64 + Math.cos(a) * 52 * rad, 124 - Math.sin(a) * 86 * rad, 6.8, 5, R() < 0.25 ? [200, 120, 190] : [108, 100, 204], [236, 232, 244]); } },
    allium() { for (let i = 0; i < 7; i++) leaf(64 + rr(-8, 8), 126, rr(36, 60), -Math.PI * (0.15 + 0.7 * R()), 7, GG, rr(0.8, 1.02)); for (const [x, y, r] of [[34, 40, 15], [62, 20, 18], [92, 34, 16], [76, 58, 12]]) { blade(64 + (x - 64) * 0.3, 127, 127 - y, (x - 64) * 0.7, 2.4, [104, 138, 80]); for (let j = 0; j < 60; j++) { const a = rr(0, 6.28), rad = Math.sqrt(R()) * r; dot(x + Math.cos(a) * rad, y + Math.sin(a) * rad, rr(1.6, 2.8), R() < 0.35 ? [176, 126, 208] : [136, 82, 178], rr(0.88, 1.12)); } } },
    grass() { for (let i = 0; i < 64; i++) { const a = rr(-0.95, 0.95), l = rr(64, 122), c = R() < 0.4 ? [176, 164, 104] : [128, 152, 84]; blade(64 + rr(-9, 9), 127, l * Math.cos(a), l * Math.sin(a) * 0.9, rr(1.3, 2), c, rr(0.82, 1.08)); if (i % 3 === 0) for (let j = 0; j < 4; j++) dot(64 + l * Math.sin(a) * 0.9 * (0.86 + j * 0.04), 127 - l * Math.cos(a) * (0.86 + j * 0.035), 2.2, [204, 190, 140]); } },
    bluebell() { for (let i = 0; i < 12; i++) leaf(64 + rr(-18, 18), 126, rr(40, 66), -Math.PI * (0.14 + 0.72 * R()), 6.5, G1, rr(0.85, 1.1)); for (let i = 0; i < 12; i++) { const x = rr(18, 110), h = rr(66, 112), sd = x > 64 ? 1 : -1; g.strokeStyle = rgb([90, 120, 80]); g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, 127); g.quadraticCurveTo(x, 127 - h, x + sd * 16, 127 - h + 6); g.stroke(); for (let j = 0; j < 6; j++) { const t = j / 6, bx = x + sd * (2 + t * 14), by = 127 - h * (0.62 + 0.38 * t) + t * 6; leaf(bx, by, 11, 1.2 + sd * 0.25, 6.6, R() < 0.35 ? [138, 136, 232] : [104, 104, 214], rr(0.95, 1.1)); } } },
    primrose() { for (let i = 0; i < 12; i++) leaf(64, 124, rr(34, 56), -Math.PI * (0.03 + 0.94 * (i + R() * 0.5) / 12), rr(14, 19), [96, 138, 62], rr(0.78, 1.04)); for (const [x, y] of [[38, 64], [62, 44], [88, 60], [50, 86], [78, 88], [100, 92], [24, 96]]) petals(x, y, 10.5, 5, [244, 234, 150], [232, 196, 60]); },
    bedding() { mound(64, 127, 118, 96, G1, 130, 1); for (let i = 0; i < 34; i++) { const a = Math.PI * R(), rad = 0.35 + 0.65 * Math.sqrt(R()), x = 64 + Math.cos(a) * 54 * rad, y = 122 - Math.sin(a) * 90 * rad, c = i % 7 === 0 ? [226, 120, 110] : [200, 44, 48]; dot(x, y, 5.2, c, rr(0.88, 1.06)); dot(x - 1, y - 1, 2.4, c, 1.16); } },
    fritillary() { for (let i = 0; i < 8; i++) blade(rr(30, 98), 127, rr(50, 86), rr(-14, 14), 1.8, GG, rr(0.85, 1.05)); for (const [x, h, w] of [[30, 84, 0], [52, 104, 0], [76, 92, 1], [98, 78, 0], [64, 70, 0]]) { const sd = x > 60 ? 1 : -1; g.strokeStyle = rgb([104, 128, 96]); g.lineWidth = 2; g.beginPath(); g.moveTo(x, 127); g.quadraticCurveTo(x, 127 - h - 8, x + sd * 9, 127 - h); g.stroke(); const bx = x + sd * 9, by = 127 - h, c = w ? [236, 232, 220] : [134, 62, 112]; g.fillStyle = rgb(c); g.beginPath(); g.moveTo(bx - 7, by); g.lineTo(bx + 7, by); g.lineTo(bx + 9, by + 17); g.lineTo(bx, by + 14); g.lineTo(bx - 9, by + 17); g.closePath(); g.fill(); for (let q = 0; q < 10; q++) dot(bx + rr(-6, 6), by + rr(2, 14), 1.5, w ? [206, 200, 186] : [186, 120, 160]); } },
    box() { g.fillStyle = rgb([44, 82, 42]); g.beginPath(); g.ellipse(64, 127, 60, 112, 0, Math.PI, 0); g.closePath(); g.fill(); for (let i = 0; i < 520; i++) { const a = Math.PI * R(), rad = Math.sqrt(R()), x = 64 + Math.cos(a) * 58 * rad, y = 126 - Math.sin(a) * 108 * rad, k = 0.75 + 0.6 * (126 - y) / 112 + rr(-0.12, 0.12); dot(x, y, rr(1.6, 2.8), [54, 96, 48], k); } },
  };
  KINDS.forEach((k, i) => {
    const fn = cells[k.name]; if (!fn) return;
    g.save(); g.beginPath(); g.rect((i % COLS) * PX + 2, Math.floor(i / COLS) * PX + 2, PX - 4, PX - 4); g.clip(); g.translate((i % COLS) * PX, Math.floor(i / COLS) * PX);
    s = 20131 + i * 977; fn(); g.restore();
  });
}

let TEX = null;
/** the sheet of 32 plants (1024 x 512, sRGB; transparent texels carry a leaf green so the cut-out has no dark fringe) */
export function floraTexture() {
  if (TEX) return TEX;
  const W = COLS * PX, H = ROWS * PX, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  paint(g);
  let data = null;
  try { const im = g.getImageData(0, 0, W, H); if (im && im.data && im.data.length === W * H * 4) data = new Uint8Array(im.data.buffer.slice(0)); } catch (e) { /* no canvas pixels (headless) */ }
  if (!data) data = new Uint8Array(W * H * 4);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) { data[i] = 84; data[i + 1] = 124; data[i + 2] = 56; }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 2; t.needsUpdate = true;
  t.name = 'flora:sheet';
  return (TEX = t);
}

// ---------------------------------------------------------------- geometry + material
/** two crossed unit cards (x or z in -0.5..0.5, y in 0..1) + the instanced attributes for `cap` plants */
export function floraGeometry(cap) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0, 0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), aFx = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  aPos.setUsage(THREE.DynamicDrawUsage); aFx.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aPos', aPos); g.setAttribute('aFx', aFx);
  g.instanceCount = 1;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2900); g.boundingBox = new THREE.Box3(new THREE.Vector3(-2900, -10, -2900), new THREE.Vector3(2900, 50, 2900));
  return g;
}

/**
 * uniforms: uTime (world.uniforms.time), uFWind (sway 0.4 calm .. 2.2 gale), uFPush (x, z of the player's feet, w = on).
 * aPos = x, y, z, yaw; aFx = width, height, kind (+64 = lies flat), range (m; the plant shrinks to nothing over the last 28 %).
 */
export function floraMaterial(timeUniform) {
  const U = { uTime: timeUniform || { value: 0 }, uFWind: { value: 1 }, uFPush: { value: new THREE.Vector4(0, 0, 0, 0) } };
  const m = new THREE.MeshLambertMaterial({ map: floraTexture(), alphaTest: 0.34, side: THREE.DoubleSide, name: 'flora' });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uFWind = U.uFWind; sh.uniforms.uFPush = U.uFPush;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aPos;
attribute vec4 aFx;
uniform float uTime;
uniform float uFWind;
uniform vec4 uFPush;
varying vec3 vFTint;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
	float fKind = mod(aFx.z, 64.0), fFlat = step(63.5, aFx.z);
	vMapUv = vec2((mod(fKind, ${COLS}.0) + 0.03 + uv.x * 0.94) / ${COLS}.0, (floor(fKind / ${COLS}.0) + 1.0 - (0.02 + uv.y * 0.96)) / ${ROWS}.0);`)
      .replace('#include <begin_vertex>', `
	float fDist = distance(aPos.xz, cameraPosition.xz);
	float fFade = 1.0 - smoothstep(aFx.w * 0.72, aFx.w, fDist);
	float fH = position.y * aFx.y;
	vec3 fl = vec3(position.x * aFx.x, fH, position.z * aFx.x);
	// a flat kind: the first card laid on the ground, the second folded away
	if (fFlat > 0.5) fl = vec3(position.x * aFx.x, 0.0, (position.y - 0.5) * aFx.x) * step(abs(position.z), 0.001);
	float fPh = aPos.x * 0.37 + aPos.z * 0.23;
	float fSw = position.y * position.y * (0.03 + aFx.y * 0.05) * uFWind * (1.0 - fFlat);
	fl.x += (sin(uTime * 1.7 + fPh) + 0.4 * sin(uTime * 4.1 + fPh * 2.3)) * fSw;
	fl.z += (cos(uTime * 1.3 + fPh * 1.4) * 0.8 + 0.3 * sin(uTime * 3.6 + fPh)) * fSw;
	float cs = cos(aPos.w), sn = sin(aPos.w);
	vec3 transformed = vec3(fl.x * cs + fl.z * sn, fl.y, fl.z * cs - fl.x * sn) * fFade;
	// underfoot: lean away from the player's feet and duck a little
	vec2 fTo = aPos.xz - uFPush.xy;
	float fK = uFPush.w * max(0.0, 1.0 - dot(fTo, fTo) * 1.3) * (1.0 - fFlat);
	transformed.xz += normalize(fTo + vec2(0.0001)) * fK * fH * 0.6;
	transformed.y *= 1.0 - 0.35 * fK;
	transformed += aPos.xyz;
	float fR = fract(sin(dot(aPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
	vFTint = vec3(0.9 + 0.2 * fR, 0.92 + 0.14 * fract(fR * 7.0), 0.9 + 0.16 * fract(fR * 13.0)) * mix(0.66, 1.0, max(fFlat, smoothstep(0.0, 0.45, uv.y)));`)
      .replace('#include <project_vertex>', `#include <project_vertex>
	mvPosition.xyz *= 1.0 - fFlat * 0.0026;
	gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFTint;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= vFTint;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize(vNormal);');
  };
  m.customProgramCacheKey = () => 'flora1';
  m.userData.uniforms = U;
  return m;
}
export { KI };
