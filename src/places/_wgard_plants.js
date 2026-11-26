// Worcester College grounds: the plants (places/worcester_gardens.js draws them for every grounds module).
//
// What was wrong (the owner: the game is bland; the first pass's report: "crude low-polygon mounds, darker than the
// pictures"): a rose bush was a five-sided flat-shaded lump with seven pyramids for flowers, a yew column a square
// pyramid of two plain greens, a hedge a box. What this gives instead, in the way the game's own best planting is made
// (systems/_flora_draw.js: crossed alpha cut-out cards from a sheet painted here on a canvas, lit like the ground they
// stand in; world/vegetation.js: leaf texture on the crowns):
//   cards    one sheet of 32 garden plants, 256 px a plant (shrub roses in four colours, foxglove, lupin, delphinium,
//            red-hot poker, catmint, lady's mantle, lavender, iris, crambe, phlox, daisies, helenium, miscanthus, fern,
//            hosta, euphorbia, hydrangea, dogwood, sedge, banana, climbers, a white rambler, wisteria, ivy, tulips,
//            meadow grass, reed, tawny grass); a plant is two or three crossed cards, darker at the foot, swaying a
//            little in the wind (the world's clock: no work per frame here). STATIC: merged into one mesh a chunk,
//            drawn at any distance the gardens are (the flora system's own plants shrink away at 44 - 96 m).
//   leaves   clipped and shrubby green things as real volumes with a leaf texture and rounded, slightly uneven
//            forms, shaded darker towards the foot: round tapering yew columns, billowing laurel, clipped hedges
//            with soft tops, shrub domes. On the top tier the photo-scanned hedge leaves lie over them (world.surf).
// Nothing is copied from a photograph: the sheet is painted from the list of what the pictures show growing here.
// Pure geometry + two materials; no collision (the callers add what is solid).
import * as THREE from 'three';

const COLS = 8, ROWS = 4, PX = 256;
const NAMES = ['rosePink', 'roseWhite', 'roseMagenta', 'roseBlush', 'foxglove', 'lupin', 'delphinium', 'poker',
  'catmint', 'alchemilla', 'lavender', 'iris', 'crambe', 'phlox', 'daisy', 'helenium',
  'miscanthus', 'fern', 'hosta', 'euphorbia', 'hydrangea', 'dogwood', 'sedge', 'banana',
  'climber', 'rambler', 'wisteria', 'ivy', 'tulip', 'meadow', 'reed', 'tawny'];
/** kind name -> cell of the sheet */
export const PK = Object.fromEntries(NAMES.map((k, i) => [k, i]));
export const hash = (a, b = 0) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };

// ------------------------------------------------------------------------------------------------ the sheet
function paint(g) {
  let s = 1;
  const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const rr = (a, b) => a + (b - a) * R();
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const rgb = (c, k = 1) => `rgb(${cl(c[0] * k)},${cl(c[1] * k)},${cl(c[2] * k)})`;
  const dot = (x, y, r, c, k = 1) => { g.fillStyle = rgb(c, k); g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };
  const leaf = (x, y, len, ang, wid, c, k = 1) => { g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = rgb(c, k); g.beginPath(); g.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, 6.2832); g.fill(); g.restore(); };
  const stem = (x0, y0, x1, y1, w, c, k = 1, bend = 0) => { g.strokeStyle = rgb(c, k); g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1); g.stroke(); };
  /** a leafy mass: n leaves inside a dome w wide and h high standing on `base`; dark below and inside, light on top */
  const mass = (cx, base, w, h, c, n, o = {}) => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * R(), rad = Math.pow(R(), o.fill ?? 0.5), x = cx + Math.cos(a) * (w / 2) * rad, t = Math.sin(a) * rad;
      const y = base - t * h * (o.rag ? 0.8 + 0.2 * Math.sin(x * 0.09 + o.rag) : 1), k = (o.k0 ?? 0.5) + (o.k1 ?? 0.62) * t + rr(-0.1, 0.1);
      leaf(x, y, rr(o.l0 ?? 11, o.l1 ?? 19), o.ang ? o.ang() : rr(0, 6.28), rr(o.w0 ?? 5, o.w1 ?? 9), c, k);
    }
  };
  const bloom = (x, y, r, c) => { dot(x, y, r, c, 0.78); dot(x, y, r * 0.8, c, 1); dot(x - r * 0.22, y - r * 0.24, r * 0.44, c, 1.14); dot(x + r * 0.12, y + r * 0.12, r * 0.2, c, 0.66); };
  const daisy = (x, y, r, c, eye) => { g.strokeStyle = rgb(c); g.lineWidth = Math.max(2, r * 0.42); g.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); g.stroke(); } dot(x, y, r * 0.36, eye); };
  /** a flower spire from y0 up to y1: dots thinning to the tip */
  const spire = (x, y0, y1, w, c, c2, lean = 0) => { const n = Math.round((y0 - y1) / 3.4); for (let i = 0; i <= n; i++) { const t = i / n, y = y0 - (y0 - y1) * t, ww = w * (1 - t * 0.75); for (const sd of [-1, -0.3, 0.3, 1]) dot(x + lean * t + sd * ww * 0.5 + rr(-1, 1), y + rr(-1.2, 1.2), rr(2.6, 3.8) * (1 - t * 0.45), R() < 0.3 ? c2 : c, rr(0.84, 1.12)); } };
  const blades = (cx, base, n, len0, len1, spread, c, c2, w = 2.4) => { for (let i = 0; i < n; i++) { const a = rr(-spread, spread), l = rr(len0, len1); stem(cx + rr(-8, 8), base, cx + Math.sin(a) * l, base - Math.cos(a) * l, rr(w * 0.7, w * 1.2), R() < 0.4 ? c2 : c, rr(0.78, 1.1), Math.sin(a) * l * 0.12); } };
  const GD = [50, 90, 46], GM = [70, 116, 52], GL = [104, 150, 66], GG = [112, 138, 110];
  const rose = (c, c2, seed) => {
    mass(128, 254, 232, 214, GD, 620, { rag: seed, l0: 10, l1: 17, w0: 5, w1: 8.5, k0: 0.46, k1: 0.72 });
    for (let i = 0; i < 7; i++) { const x0 = rr(60, 196), x1 = x0 + rr(-44, 44), y1 = rr(8, 46); stem(x0, 96, x1, y1, 2.2, [78, 112, 56], 1, rr(-14, 14)); for (let j = 0; j < 9; j++) { const t = j / 9; leaf(x0 + (x1 - x0) * t + rr(-5, 5), 96 + (y1 - 96) * t + rr(-4, 4), rr(10, 15), rr(0, 6.28), rr(5, 7), GM, rr(0.86, 1.16)); } if (i % 2) bloom(x1, y1 + 4, rr(6.5, 8.5), c); }
    for (let i = 0; i < 22; i++) { const a = Math.PI * R(), rad = Math.pow(R(), 0.4), cx = 128 + Math.cos(a) * 104 * rad, cy = 248 - Math.sin(a) * 196 * rad, n = 1 + ((R() * 3.4) | 0); for (let j = 0; j < n; j++) bloom(cx + rr(-13, 13), cy + rr(-11, 11), rr(6, 9.5), R() < 0.72 ? c : c2); }
  };
  const cells = {
    rosePink() { rose([226, 112, 156], [244, 176, 200], 0.4); },
    roseWhite() { rose([246, 240, 230], [250, 220, 226], 1.9); },
    roseMagenta() { rose([176, 44, 112], [146, 56, 146], 3.1); },
    roseBlush() { rose([246, 198, 208], [252, 236, 234], 4.6); },
    foxglove() { mass(128, 254, 170, 70, GM, 110, { l0: 22, l1: 36, w0: 10, w1: 15 }); for (const [x, top, c] of [[70, 40, [198, 98, 164]], [112, 10, [214, 126, 182]], [156, 30, [244, 236, 232]], [196, 58, [190, 90, 158]]]) { stem(x, 238, x + 3, top, 3, GM); for (let y = 190; y > top + 6; y -= 8.5) { const t = (190 - y) / (190 - top), sd = x > 128 ? 1 : -1; leaf(x + sd * 2, y, 15 * (1 - t * 0.55), sd > 0 ? 0.5 : Math.PI - 0.5, 9 * (1 - t * 0.5), c, rr(0.88, 1.1)); dot(x + sd * (10 - t * 4), y + 4, 2.6 * (1 - t * 0.5), [250, 240, 244]); } } },
    lupin() { mass(128, 254, 200, 96, GL, 170, { l0: 16, l1: 26, w0: 5, w1: 8 }); for (const [x, top] of [[52, 78], [88, 30], [128, 12], [166, 40], [204, 70]]) { stem(x, 240, x, top, 2.8, GM); spire(x, 164, top, 20, [246, 242, 226], [232, 226, 196]); } },
    delphinium() { mass(128, 254, 180, 84, GM, 150, { l0: 16, l1: 26, w0: 7, w1: 12 }); for (const [x, top] of [[64, 44], [112, 8], [156, 26], [198, 56]]) { stem(x, 240, x, top, 2.8, GM); spire(x, 176, top, 24, [70, 88, 196], [118, 136, 228]); } },
    poker() { blades(128, 254, 60, 90, 170, 1.05, [96, 132, 70], [124, 150, 84], 3); for (const [x, top] of [[76, 56], [118, 20], [160, 40], [198, 70]]) { stem(128 + (x - 128) * 0.3, 250, x, top + 30, 3.2, [110, 130, 76]); for (let y = top + 44; y > top; y -= 3) { const t = (top + 44 - y) / 44, w = 9 * Math.sin(Math.PI * (0.15 + 0.8 * t)) + 2; for (const sd of [-1, 0, 1]) dot(x + sd * w * 0.5 + rr(-1, 1), y, rr(2.6, 3.6), t < 0.35 ? [240, 204, 70] : [226, 84, 40], rr(0.9, 1.1)); } } },
    catmint() { mass(128, 254, 240, 120, [122, 142, 114], 300, { l0: 7, l1: 12, w0: 3.5, w1: 6, k0: 0.6, k1: 0.5 }); for (let i = 0; i < 110; i++) { const a = rr(-1.2, 1.2), l = rr(70, 150), x0 = 128 + rr(-70, 70), ex = x0 + Math.sin(a) * l * 0.55, ey = 250 - Math.cos(a) * l; for (let j = 0; j < 7; j++) dot(ex - Math.sin(a) * j * 4, ey + Math.cos(a) * j * 4, rr(2.4, 3.4), R() < 0.3 ? [150, 138, 224] : [112, 104, 204], rr(0.9, 1.12)); } },
    alchemilla() { for (let i = 0; i < 70; i++) { const a = Math.PI * R(), rad = Math.sqrt(R()), x = 128 + Math.cos(a) * 110 * rad, y = 252 - Math.sin(a) * 70 * rad; dot(x, y, rr(9, 15), [104, 146, 70], 0.62 + 0.5 * Math.sin(a) * rad + rr(-0.06, 0.06)); } for (let i = 0; i < 520; i++) { const a = Math.PI * R(), rad = 0.5 + 0.5 * Math.sqrt(R()), x = 128 + Math.cos(a) * 112 * rad, y = 240 - Math.sin(a) * 104 * rad; dot(x, y, rr(1.8, 3.2), R() < 0.5 ? [206, 218, 92] : [184, 204, 78], rr(0.9, 1.1)); } },
    lavender() { mass(128, 254, 200, 110, [124, 140, 118], 240, { l0: 8, l1: 14, w0: 2.5, w1: 4 }); for (let i = 0; i < 90; i++) { const a = rr(-1.05, 1.05), l = rr(140, 232), x0 = 128 + rr(-50, 50), ex = x0 + Math.sin(a) * l * 0.6, ey = 252 - Math.cos(a) * l; stem(x0, 214, ex, ey + 8, 1.6, [128, 144, 120]); for (let j = 0; j < 6; j++) dot(ex - Math.sin(a) * j * 4.2, ey + Math.cos(a) * j * 4.2, 3, R() < 0.3 ? [150, 126, 200] : [112, 92, 178], rr(0.9, 1.1)); } },
    iris() { for (let i = 0; i < 26; i++) { const x = rr(60, 196), h = rr(130, 220), lean = (x - 128) * rr(0.2, 0.7); g.fillStyle = rgb(R() < 0.5 ? [104, 146, 98] : [84, 128, 82], rr(0.82, 1.1)); g.beginPath(); g.moveTo(x - 8, 254); g.quadraticCurveTo(x + lean * 0.3, 254 - h * 0.6, x + lean, 254 - h); g.quadraticCurveTo(x + lean * 0.3 + 10, 254 - h * 0.5, x + 8, 254); g.closePath(); g.fill(); } for (const [x, y] of [[76, 50], [128, 22], [182, 44], [150, 76]]) { stem(128 + (x - 128) * 0.4, 250, x, y + 12, 3, [96, 136, 86]); for (const [dx, dy, r] of [[0, -8, 11], [-12, 6, 10], [12, 6, 10]]) dot(x + dx, y + dy, r, [96, 84, 190], rr(0.9, 1.15)); dot(x, y + 2, 5, [240, 206, 80]); } },
    crambe() { mass(128, 254, 190, 70, [86, 122, 92], 90, { l0: 26, l1: 44, w0: 14, w1: 24 }); for (let i = 0; i < 16; i++) { const x0 = 128 + rr(-30, 30), x1 = 128 + rr(-112, 112), y1 = rr(12, 120); stem(x0, 236, x1, y1, 1.5, [128, 150, 104], 1, rr(-20, 20)); for (let j = 0; j < 5; j++) stem(x0 + (x1 - x0) * (0.5 + j * 0.1), 236 + (y1 - 236) * (0.5 + j * 0.1), x1 + rr(-30, 30), y1 + rr(-14, 24), 1, [136, 156, 110]); } for (let i = 0; i < 1300; i++) { const a = Math.PI * R(), rad = Math.pow(R(), 0.45), x = 128 + Math.cos(a) * 122 * rad, y = 150 - Math.sin(a) * 142 * rad + rr(0, 30); dot(x, y, rr(1.4, 2.6), [250, 248, 240], rr(0.9, 1.04)); } },
    phlox() { for (let i = 0; i < 12; i++) { const x = rr(40, 216), top = rr(24, 86); stem(128 + (x - 128) * 0.55, 252, x, top + 18, 2.6, GM); for (let y = 236; y > top + 26; y -= 13) for (const sd of [-1, 1]) leaf(128 + (x - 128) * (0.55 + 0.45 * (252 - y) / (252 - top)), y, 20, sd > 0 ? -0.5 : Math.PI + 0.5, 6, GM, rr(0.8, 1.1)); const c = i % 3 ? [216, 120, 186] : [236, 190, 220]; for (let j = 0; j < 26; j++) { const a = rr(0, 6.28), rad = Math.sqrt(R()) * 20; dot(x + Math.cos(a) * rad, top + 14 + Math.sin(a) * rad * 0.72, rr(3.4, 5), c, rr(0.86, 1.12)); } } },
    daisy() { for (let i = 0; i < 26; i++) stem(128 + rr(-50, 50), 254, 128 + rr(-100, 100), rr(40, 150), 2.2, GM, rr(0.85, 1.1), rr(-10, 10)); mass(128, 254, 170, 80, GM, 120, { l0: 12, l1: 22, w0: 4, w1: 6 }); for (let i = 0; i < 26; i++) { const a = Math.PI * R(), rad = 0.45 + 0.55 * Math.sqrt(R()); daisy(128 + Math.cos(a) * 110 * rad, 226 - Math.sin(a) * 206 * rad, rr(11, 15), [248, 246, 238], [236, 190, 44]); } },
    helenium() { for (let i = 0; i < 26; i++) stem(128 + rr(-46, 46), 254, 128 + rr(-100, 100), rr(30, 140), 2.2, GM, rr(0.85, 1.1), rr(-10, 10)); mass(128, 254, 180, 110, GM, 190, { l0: 12, l1: 20, w0: 4, w1: 6 }); for (let i = 0; i < 34; i++) { const a = Math.PI * R(), rad = 0.4 + 0.6 * Math.sqrt(R()); daisy(128 + Math.cos(a) * 112 * rad, 230 - Math.sin(a) * 214 * rad, rr(9, 13), R() < 0.5 ? [236, 150, 40] : [244, 204, 50], [120, 70, 36]); } },
    miscanthus() { blades(128, 254, 150, 150, 238, 0.62, [128, 156, 88], [154, 170, 106], 2.2); for (let i = 0; i < 16; i++) { const a = rr(-0.5, 0.5), l = rr(200, 246), ex = 128 + Math.sin(a) * l, ey = 254 - Math.cos(a) * l; stem(128 + rr(-6, 6), 254, ex, ey + 30, 1.6, [170, 166, 110]); for (let j = 0; j < 22; j++) stem(ex, ey + 30, ex + rr(-9, 9) + Math.sin(a) * 14, ey + rr(-2, 26), 1.3, [214, 198, 160], rr(0.9, 1.1)); } },
    fern() { for (let i = 0; i < 13; i++) { const a = -Math.PI * (0.08 + 0.84 * (i + R() * 0.6) / 13), l = rr(140, 216), c = R() < 0.5 ? [96, 150, 58] : [80, 134, 54]; for (let t = 0.06; t < 1; t += 0.035) { const bend = t * t * 0.55 * (Math.cos(a) > 0 ? 1 : -1), x = 128 + Math.cos(a + bend) * l * t, y = 250 + Math.sin(a + bend) * l * t, pl = 30 * (1 - t) + 5; for (const sd of [-1, 1]) leaf(x, y, pl, a + bend + sd * 1.25, 5.5, c, rr(0.8, 1.12)); } } },
    hosta() { for (let i = 0; i < 26; i++) { const a = -Math.PI * (0.04 + 0.92 * R()), l = rr(60, 122), x = 128 + Math.cos(a) * l * 0.4, y = 250 + Math.sin(a) * l * 0.4, k = rr(0.74, 1.12); leaf(x, y, l, a, l * 0.55, [92, 140, 104], k); g.strokeStyle = rgb([70, 112, 84], k); g.lineWidth = 1.4; for (const o of [-0.16, 0, 0.16]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a + o) * l * 0.92, y + Math.sin(a + o) * l * 0.92); g.stroke(); } } },
    euphorbia() { mass(128, 254, 220, 200, [96, 134, 112], 420, { l0: 12, l1: 20, w0: 3, w1: 5 }); for (let i = 0; i < 40; i++) { const a = Math.PI * R(), rad = 0.55 + 0.45 * Math.sqrt(R()), x = 128 + Math.cos(a) * 104 * rad, y = 244 - Math.sin(a) * 196 * rad; for (let j = 0; j < 14; j++) dot(x + rr(-10, 10), y + rr(-9, 9), rr(2.8, 4.4), R() < 0.5 ? [190, 208, 76] : [164, 190, 66], rr(0.9, 1.1)); } },
    hydrangea() { mass(128, 254, 236, 206, [62, 108, 56], 300, { l0: 20, l1: 32, w0: 12, w1: 19, k0: 0.5, k1: 0.6 }); for (let i = 0; i < 15; i++) { const a = Math.PI * R(), rad = 0.3 + 0.7 * Math.sqrt(R()), x = 128 + Math.cos(a) * 96 * rad, y = 236 - Math.sin(a) * 186 * rad, c = [236, 228, 232]; dot(x, y, 20, c, 0.8); for (let j = 0; j < 40; j++) { const b = rr(0, 6.28), q = Math.sqrt(R()) * 19; dot(x + Math.cos(b) * q, y + Math.sin(b) * q * 0.85, rr(3, 4.6), c, 0.86 + 0.24 * (1 - q / 19) + rr(-0.05, 0.05)); } } },
    dogwood() { for (let i = 0; i < 44; i++) { const a = rr(-0.55, 0.55), l = rr(150, 246), ex = 128 + Math.sin(a) * l, ey = 254 - Math.cos(a) * l; stem(128 + rr(-16, 16), 254, ex, ey, rr(1.8, 2.8), R() < 0.3 ? [214, 96, 50] : [176, 44, 36], rr(0.85, 1.15), rr(-8, 8)); if (i % 2) for (let j = 3; j < 9; j++) leaf(128 + (ex - 128) * j / 9, 254 + (ey - 254) * j / 9, rr(12, 18), rr(0, 6.28), 7, [108, 150, 70], rr(0.8, 1.1)); } },
    sedge() { blades(128, 254, 190, 90, 190, 1.15, [142, 150, 78], [116, 138, 66], 2.4); },
    banana() { stem(128, 254, 128, 120, 16, [118, 142, 70]); for (const [a, l] of [[-1.25, 150], [-0.62, 190], [-0.1, 214], [0.5, 196], [1.1, 160], [1.5, 110]]) { const x0 = 128, y0 = 128, ex = x0 + Math.sin(a) * l, ey = y0 - Math.cos(a) * l * 0.92, k = rr(0.9, 1.1); g.save(); g.translate(x0, y0); g.rotate(a - Math.PI / 2); g.fillStyle = rgb([104, 166, 62], k); g.beginPath(); g.ellipse(l * 0.55, 0, l * 0.5, l * 0.15, 0, 0, 6.2832); g.fill(); g.strokeStyle = rgb([150, 196, 96], k); g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(l * 1.03, 0); g.stroke(); g.strokeStyle = rgb([84, 140, 52], k); g.lineWidth = 1; for (let t = 0.12; t < 1; t += 0.07) { g.beginPath(); g.moveTo(l * t, 0); g.lineTo(l * t + 9, -l * 0.14 * Math.sin(Math.PI * t)); g.moveTo(l * t, 0); g.lineTo(l * t + 9, l * 0.14 * Math.sin(Math.PI * t)); g.stroke(); } g.restore(); void ex; void ey; } },
    climber() { for (let i = 0; i < 900; i++) { const x = rr(6, 250), e = Math.min(x - 4, 252 - x) / 40, y = rr(8 + 26 * Math.max(0, 1 - e) + 16 * Math.sin(x * 0.07), 232 - 30 * Math.abs(Math.sin(x * 0.045 + 1))); leaf(x, y, rr(11, 18), rr(0, 6.28), rr(6, 9), R() < 0.3 ? [84, 132, 58] : [62, 106, 50], 0.62 + 0.5 * (1 - y / 256) + rr(-0.1, 0.1)); } for (let i = 0; i < 9; i++) { const x = rr(20, 236), l = rr(18, 40); stem(x, 214, x + rr(-6, 6), 214 + l, 1.6, [70, 104, 50]); for (let j = 0; j < 4; j++) leaf(x + rr(-4, 4), 216 + (l * j) / 4, 12, rr(0, 6.28), 6, [70, 116, 54], rr(0.8, 1.1)); } },
    rambler() { cells.climber(); for (let i = 0; i < 46; i++) { const x = rr(16, 240), y = rr(26, 200); for (let j = 0; j < 5; j++) bloom(x + rr(-12, 12), y + rr(-10, 10), rr(4.4, 6.4), [250, 246, 236]); } },
    wisteria() { cells.climber(); for (let i = 0; i < 26; i++) { const x = rr(14, 242), y = rr(40, 150), l = rr(40, 76); for (let t = 0; t < 1; t += 0.06) for (const sd of [-1, 1]) dot(x + sd * (1 - t) * 7 + rr(-1, 1), y + l * t, rr(2.8, 4.2) * (1 - t * 0.5), R() < 0.4 ? [176, 156, 226] : [140, 118, 204], rr(0.9, 1.1)); } },
    ivy() { for (let i = 0; i < 620; i++) { const x = rr(6, 250), y = rr(10 + 14 * Math.sin(x * 0.08), 236 - 60 * Math.abs(Math.sin(x * 0.05))), c = R() < 0.6 ? [40, 80, 42] : [56, 98, 50], k = rr(0.8, 1.2), r = rr(8, 13); g.fillStyle = rgb(c, k); g.beginPath(); const a0 = rr(0, 6.28); for (let j = 0; j < 5; j++) { const a = a0 + (j - 2) * 0.62, rad = j % 2 ? r * 0.72 : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.lineTo(x, y); g.closePath(); g.fill(); } },
    tulip() { for (let i = 0; i < 22; i++) leaf(128 + rr(-60, 60), 250, rr(70, 120), -Math.PI * (0.2 + 0.6 * R()), 15, GG, rr(0.8, 1.06)); for (let i = 0; i < 13; i++) { const x = rr(30, 226), y = rr(40, 130), c = [[206, 50, 60], [240, 196, 60], [150, 60, 140], [244, 240, 232], [232, 120, 70]][i % 5]; stem(128 + (x - 128) * 0.5, 250, x, y + 14, 2.6, [104, 140, 84]); g.fillStyle = rgb(c); g.beginPath(); g.ellipse(x, y, 11, 16, 0, 0, 6.2832); g.fill(); g.fillStyle = rgb(c, 1.14); g.beginPath(); g.ellipse(x - 3, y - 2, 5, 12, 0, 0, 6.2832); g.fill(); g.fillStyle = rgb(c, 0.78); g.beginPath(); g.ellipse(x + 6, y + 2, 3.4, 11, 0, 0, 6.2832); g.fill(); } },
    meadow() { blades(128, 254, 170, 90, 236, 0.5, [132, 156, 86], [178, 166, 106], 1.9); for (let i = 0; i < 40; i++) { const a = rr(-0.45, 0.45), l = rr(170, 240), ex = 128 + rr(-60, 60) + Math.sin(a) * l, ey = 254 - Math.cos(a) * l; for (let j = 0; j < 6; j++) dot(ex + rr(-2, 2), ey + j * 4, 2.3, [206, 192, 142]); } for (let i = 0; i < 9; i++) { const x = rr(30, 226), y = rr(70, 170); stem(128 + (x - 128) * 0.6, 252, x, y, 1.6, GM); if (i % 3) dot(x, y, 5, [244, 208, 40]); else daisy(x, y, 9, [248, 246, 238], [236, 190, 44]); } },
    reed() { blades(128, 254, 90, 150, 244, 0.34, [104, 142, 72], [140, 156, 86], 3.2); for (let i = 0; i < 12; i++) { const a = rr(-0.3, 0.3), l = rr(210, 250), ex = 128 + rr(-40, 40) + Math.sin(a) * l, ey = 254 - Math.cos(a) * l; stem(128 + rr(-30, 30), 254, ex, ey + 20, 2, [140, 142, 86]); for (let j = 0; j < 30; j++) stem(ex, ey + 22, ex + rr(-8, 8), ey + rr(-4, 24), 1.5, [168, 150, 112], rr(0.85, 1.15)); } },
    tawny() { blades(128, 254, 230, 110, 236, 0.9, [196, 164, 104], [170, 132, 78], 2.1); blades(128, 254, 50, 80, 150, 1.0, [150, 150, 84], [130, 140, 76], 2.1); },
  };
  NAMES.forEach((name, i) => {
    g.save(); g.beginPath(); g.rect((i % COLS) * PX + 1, Math.floor(i / COLS) * PX + 1, PX - 2, PX - 2); g.clip(); g.translate((i % COLS) * PX, Math.floor(i / COLS) * PX);
    s = 7919 + i * 977; cells[name](); g.restore();
  });
}

let SHEET = null, LEAF = null;
/** the sheet of 32 garden plants (2048 x 1024, sRGB; transparent texels carry a leaf green so the cut-out has no dark fringe) */
export function plantSheet() {
  if (SHEET) return SHEET;
  const W = COLS * PX, H = ROWS * PX, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  try { paint(g); } catch (e) { console.error('[worcester plants] sheet', e); }
  let data = null;
  try { const im = g.getImageData(0, 0, W, H); if (im && im.data && im.data.length === W * H * 4) data = new Uint8Array(im.data.buffer.slice(0)); } catch (e) { /* no canvas pixels (headless) */ }
  if (!data) data = new Uint8Array(W * H * 4);
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) { data[i] = 70; data[i + 1] = 110; data[i + 2] = 52; }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true;
  t.name = 'worcester-plants:sheet';
  return (SHEET = t);
}
/** leaves seen close: light leaf blades over dark gaps, grey (the vertex colour is the plant's green); repeats every LEAF_M metres */
const LEAF_M = 1.1;
export function leafTexture() {
  if (LEAF) return LEAF;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  let s = 4409; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  try {
    g.fillStyle = 'rgb(96,96,96)'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 3400; i++) {
      const k = Math.round(120 + R() * 135), x = R() * S, y = R() * S, l = 4 + R() * 6, w = 2 + R() * 2.6, a = R() * 6.2832;
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { if (x + ox < -12 || x + ox > S + 12 || y + oy < -12 || y + oy > S + 12) continue; g.fillStyle = `rgb(${k},${k},${k})`; g.beginPath(); g.ellipse(x + ox, y + oy, l, w, a, 0, 6.2832); g.fill(); }
    }
    for (let i = 0; i < 420; i++) { g.fillStyle = 'rgba(0,0,0,0.42)'; g.beginPath(); g.arc(R() * S, R() * S, 1.5 + R() * 4, 0, 6.2832); g.fill(); }
  } catch (e) { /* headless */ }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.name = 'worcester-plants:leaf';
  return (LEAF = t);
}

// ------------------------------------------------------------------------------------------------ materials
export function plantMaterial(world) {
  const uTime = (world && world.uniforms && world.uniforms.time) || { value: 0 };
  const m = new THREE.MeshLambertMaterial({ map: plantSheet(), alphaTest: 0.4, side: THREE.DoubleSide, vertexColors: true, name: 'worcester-plants' });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aSw;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
	transformed.x += (sin(uTime * 1.7 + aSw.y) + 0.4 * sin(uTime * 4.1 + aSw.y * 2.3)) * aSw.x;
	transformed.z += (cos(uTime * 1.3 + aSw.y * 1.4) * 0.8 + 0.3 * sin(uTime * 3.6 + aSw.y)) * aSw.x;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize(vNormal);');
  };
  m.customProgramCacheKey = () => 'worcPlants1';
  return m;
}
export function leafMaterial(world) {
  const m = new THREE.MeshStandardMaterial({ map: leafTexture(), vertexColors: true, roughness: 1, metalness: 0, name: 'worcester-leaves' });
  try { if (world && world.surf && world.surf.detail) world.surf.detail(m, 'hedge', { full: false, k: 0.8 }); } catch (e) { /* the painted leaves alone */ }
  return m;
}

// ------------------------------------------------------------------------------------------------ geometry
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const GAIN = 2.1;      // (the leaf texture's mean is about 0.45 linear: a tint is the colour wanted, the gain brings it back)
/** greens for the leaf volumes (linear) */
export const LEAFS = { yew: lin(0x2f4f2a), yewL: lin(0x3a5c30), laurel: lin(0x3b6a2f), laurelL: lin(0x4f8238), box: lin(0x4a7438), privet: lin(0x5a8a3a), gold: lin(0x86a83c), holly: lin(0x2c4a2c), shrub: lin(0x4c7c40), shrubL: lin(0x64964a), grey: lin(0x7c9478), beech: lin(0x6a8f3c), ivy: lin(0x2e5230) };

/** usual width and height (metres) and number of crossed cards of each kind */
export const SIZE = { rosePink: [1.5, 1.35, 3], roseWhite: [1.5, 1.35, 3], roseMagenta: [1.5, 1.35, 3], roseBlush: [1.5, 1.35, 3], foxglove: [0.7, 1.5], lupin: [0.8, 1.1], delphinium: [0.75, 1.65], poker: [0.85, 1.25],
  catmint: [0.95, 0.5, 3], alchemilla: [0.8, 0.42, 3], lavender: [0.72, 0.56, 3], iris: [0.65, 0.85], crambe: [1.25, 1.7], phlox: [0.85, 1.05], daisy: [0.8, 0.85], helenium: [0.85, 1.1],
  miscanthus: [1.4, 1.9, 3], fern: [0.95, 0.65, 3], hosta: [0.85, 0.5, 3], euphorbia: [1.05, 0.9, 3], hydrangea: [1.4, 1.3, 3], dogwood: [1.1, 1.6, 3], sedge: [0.9, 0.7, 3], banana: [2.3, 2.7],
  climber: [1.6, 1.3], rambler: [1.8, 1.5], wisteria: [1.8, 1.5], ivy: [1.2, 1.0], tulip: [0.6, 0.5], meadow: [0.85, 0.8], reed: [0.85, 1.7, 3], tawny: [1.25, 1.3, 3] };

const CAPPED = new Set(['rosePink', 'roseWhite', 'roseMagenta', 'roseBlush', 'hydrangea', 'euphorbia', 'catmint', 'alchemilla', 'hosta', 'fern', 'lavender']);

export class Plants {
  constructor() { this.C = new Map(); this.L = new Map(); this.chunk = () => 0; this.nCards = 0; this.nLeaf = 0; }
  _c(x, z) { const k = this.chunk(x, z); let a = this.C.get(k); if (!a) this.C.set(k, (a = { pos: [], uv: [], col: [], sw: [] })); return a; }
  _l(x, z) { const k = this.chunk(x, z); let a = this.L.get(k); if (!a) this.L.set(k, (a = { pos: [], nor: [], uv: [], col: [] })); return a; }
  /**
   * A plant of `kind` (PK.x) standing at (x, y, z): `n` crossed cards w wide and h high. o: { n (2), yaw, tint [r, g, b],
   * dark (how dark the foot is, 0.6), sway (1), flip }.
   */
  card(kind, x, y, z, w, h, o = {}) {
    const A = this._c(x, z), n = o.n || 2, yaw = o.yaw ?? hash(x, z) * Math.PI, t = o.tint || [1, 1, 1], k0 = o.dark ?? 0.6;
    const cu = kind % COLS, cv = Math.floor(kind / COLS), ua = (cu + 0.012) / COLS, ub = (cu + 0.988) / COLS, vb = (cv + 0.992) / ROWS, vt = (cv + 0.012) / ROWS;
    const ph = x * 0.37 + z * 0.23, amp = (o.sway ?? 1) * (0.006 + h * 0.014);
    for (let i = 0; i < n; i++) {
      const a = yaw + (i * Math.PI) / n, dx = (Math.cos(a) * w) / 2, dz = (Math.sin(a) * w) / 2, fl = (o.flip ?? hash(x + i, z) > 0.5) ? 1 : 0, u0 = fl ? ub : ua, u1 = fl ? ua : ub;
      const P = [[x - dx, y, z - dz, u0, vb, 0], [x + dx, y, z + dz, u1, vb, 0], [x + dx, y + h, z + dz, u1, vt, 1], [x - dx, y + h, z - dz, u0, vt, 1]];
      for (const q of [0, 1, 2, 0, 2, 3]) { const p = P[q], k = p[5] ? 1 : k0; A.pos.push(p[0], p[1], p[2]); A.uv.push(p[3], p[4]); A.col.push(t[0] * k, t[1] * k, t[2] * k); A.sw.push(p[5] * amp, ph + i); }
    }
    this.nCards += n;
  }
  /** the plant's picture laid flat at height y (what a bush shows from above): w across, drooping a little at its rim */
  cap(kind, x, y, z, w, o = {}) {
    const A = this._c(x, z), t = o.tint || [1, 1, 1], yaw = hash(z, x) * Math.PI, c = Math.cos(yaw), s = Math.sin(yaw), r = w / 2;
    const cu = kind % COLS, cv = Math.floor(kind / COLS), ua = (cu + 0.06) / COLS, ub = (cu + 0.94) / COLS, vb = (cv + 0.9) / ROWS, vt = (cv + 0.08) / ROWS, um = (ua + ub) / 2, vm = (vb + vt) / 2;
    const ph = x * 0.37 + z * 0.23, P = [[-r, -r, ua, vb], [r, -r, ub, vb], [r, r, ub, vt], [-r, r, ua, vt]].map(([px, pz, u, v]) => [x + px * c + pz * s, y - 0.12 * w, z - px * s + pz * c, u, v]), M = [x, y, z, um, vm];
    for (let i = 0; i < 4; i++) for (const p of [M, P[i], P[(i + 1) % 4]]) { A.pos.push(p[0], p[1], p[2]); A.uv.push(p[3], p[4]); A.col.push(t[0] * 0.95, t[1] * 0.95, t[2] * 0.95); A.sw.push(0.004, ph); }
    this.nCards += 2;
  }
  /** a flat panel of `kind` on an upright face between ground points a and b, from y0 to y1 (a climber on a wall) */
  panel(kind, a, b, y0, y1, o = {}) {
    const A = this._c(a[0], a[1]), t = o.tint || [1, 1, 1], k0 = o.dark ?? 0.8;
    const cu = kind % COLS, cv = Math.floor(kind / COLS), ua = (cu + 0.012) / COLS, ub = (cu + 0.988) / COLS, vb = (cv + 0.992) / ROWS, vt = (cv + 0.012) / ROWS, fl = o.flip ? 1 : 0, u0 = fl ? ub : ua, u1 = fl ? ua : ub;
    const lean = o.lean || [0, 0], P = [[a[0], y0, a[1], u0, vb, 0], [b[0], y0, b[1], u1, vb, 0], [b[0] + lean[0], y1, b[1] + lean[1], u1, vt, 1], [a[0] + lean[0], y1, a[1] + lean[1], u0, vt, 1]];
    for (const q of [0, 1, 2, 0, 2, 3]) { const p = P[q], k = p[5] ? 1 : k0; A.pos.push(p[0], p[1], p[2]); A.uv.push(p[3], p[4]); A.col.push(t[0] * k, t[1] * k, t[2] * k); A.sw.push(p[5] * (o.sway ?? 0.004), a[0] * 0.3); }
    this.nCards++;
  }
  /** one leaf quad / triangle strip helper: points [x, y, z, nx, ny, nz, u, v, shade] */
  _tri(A, a, b, c, tint) { for (const p of [a, b, c]) { A.pos.push(p[0], p[1], p[2]); A.nor.push(p[3], p[4], p[5]); A.uv.push(p[6] / LEAF_M, p[7] / LEAF_M); A.col.push(tint[0] * p[8] * GAIN, tint[1] * p[8] * GAIN, tint[2] * p[8] * GAIN); } this.nLeaf++; }
  /**
   * A body of revolution with a leaf surface: prof = [[height 0..1, radius 0..1]] from the foot up (the last ring is
   * closed with a cap), r wide and h high, standing at (x, y0, z). o: { n sides (10), lump (0.07: how uneven), seed,
   * dark (shade at the foot, 0.55), sx, sz (stretch), yaw }
   */
  solid(prof, x, y0, z, r, h, tint, o = {}) {
    const A = this._l(x, z), n = o.n || 10, lump = o.lump ?? 0.07, seed = o.seed ?? x * 3.7 + z * 1.3, k0 = o.dark ?? 0.55, sx = o.sx || 1, sz = o.sz || 1, yaw = o.yaw || 0, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const rings = prof.map(([t, rad], j) => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2, wob = 1 + lump * (hash(seed + i * 1.7, j * 2.3) - 0.5) * 2 * (j ? 1 : 0.4), lx = Math.sin(a) * r * rad * wob * sx, lz = Math.cos(a) * r * rad * wob * sz;
      // the profile's own slope gives the normal's lift
      const p0 = prof[Math.max(0, j - 1)], p1 = prof[Math.min(prof.length - 1, j + 1)], up = Math.max(-0.3, ((p0[1] - p1[1]) * r) / Math.max(1e-3, (p1[0] - p0[0]) * h)), nl = Math.hypot(1, up), nx = Math.sin(a) / nl, nz = Math.cos(a) / nl;
      return [x + lx * cs + lz * sn, y0 + t * h * (1 + (j === prof.length - 1 ? lump * (hash(seed, i) - 0.5) : 0)), z - lx * sn + lz * cs, nx * cs + nz * sn, up / nl, -nx * sn + nz * cs, (i / n) * Math.PI * 2 * r * Math.max(0.5, rad), t * h, (k0 + (1 - k0) * Math.pow(t, 0.7)) * (0.9 + 0.2 * hash(seed + i, j + 9))];
    }));
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) {
      const a = rings[j][i], b = rings[j][(i + 1) % n], c = rings[j + 1][(i + 1) % n], d = rings[j + 1][i];
      const bw = b.slice(), cw = c.slice(); if (i === n - 1) { bw[6] = a[6] + (Math.PI * 2 * r * Math.max(0.5, prof[j][1])) / n; cw[6] = d[6] + (Math.PI * 2 * r * Math.max(0.5, prof[j + 1][1])) / n; }
      this._tri(A, a, bw, cw, tint); this._tri(A, a, cw, d, tint);
    }
    const top = rings[rings.length - 1], last = prof[prof.length - 1];
    if (last[1] > 0.02) { const cy = y0 + last[0] * h * 1.01, cen = [x, cy, z, 0, 1, 0, 0, 0, 1]; for (let i = 0; i < n; i++) { const a = top[i].slice(), b = top[(i + 1) % n].slice(); a[3] = b[3] = 0; a[4] = b[4] = 1; a[5] = b[5] = 0; a[6] = a[0] - x; a[7] = a[2] - z; b[6] = b[0] - x; b[7] = b[2] - z; this._tri(A, cen, a, b, tint); } }
  }
  /** a shrub: a rounded, uneven dome r wide and h high */
  dome(x, y0, z, r, h, tint, o = {}) { this.solid([[0, 0.7], [0.22, 0.96], [0.5, 1], [0.76, 0.8], [0.93, 0.48], [1, 0.14]], x, y0, z, r, h, tint, { lump: 0.1, ...o }); }
  /** a clipped yew column: round, tapering, a slightly domed flat top (K: the rose garden's twenty) */
  column(x, y0, z, rb, rt, h, tint, o = {}) { const q = rt / rb; this.solid([[0, 1], [0.5, (1 + q) / 2], [0.9, q + 0.02], [0.975, q * 0.86], [1, q * 0.55]], x, y0, z, rb, h, tint, { n: 12, lump: 0.035, dark: 0.62, ...o }); }
  /**
   * A clipped hedge along a line of ground points: w wide, h high, its top edges rounded, its height and width
   * breathing a little along its length (o.wave: metres; o.waveL: the length of a swell). o: { y0, dark, ends (true) }
   */
  hedge(pts, w, h, tint, o = {}) {
    const y0 = o.y0 || 0, k0 = o.dark ?? 0.55, wave = o.wave ?? 0.05, seed = o.seed ?? pts[0][0] + pts[0][1];
    // resample every ~1.2 m
    const P = []; let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(l / (o.step || 1.2))); for (let j = 0; j < k; j++) P.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k, acc + (l * j) / k]); acc += l; }
    P.push([...pts[pts.length - 1], acc]);
    const sec = (i) => {
      const p = P[i], a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
      const hh = (typeof h === 'function' ? h(p[2], acc) : h) * (1 + wave * 2 * (hash(seed, i) - 0.5)), ww = w * (1 + wave * (hash(seed + 5, i) - 0.5)), rb = Math.min(ww * 0.32, hh * 0.3, 0.35);
      // across the hedge: foot, shoulder, top (both sides): [offset, height, normal across, normal up, shade]
      const prof = [[-ww / 2 - 0.02, 0, -1, 0.05, k0], [-ww / 2, hh - rb, -1, 0.15, 0.92], [-ww / 2 + rb * 0.75, hh, -0.5, 0.86, 1], [ww / 2 - rb * 0.75, hh, 0.5, 0.86, 1], [ww / 2, hh - rb, 1, 0.15, 0.92], [ww / 2 + 0.02, 0, 1, 0.05, k0]];
      let v = 0; return prof.map(([off, yy, na, nu, sh], q) => { if (q) v += Math.hypot(off - prof[q - 1][0], yy - prof[q - 1][1]); return [p[0] + nx * off, y0 + yy, p[1] + nz * off, nx * na, nu, nz * na, p[2], v, sh * (0.9 + 0.2 * hash(seed + i * 3, q))]; });
    };
    const A = this._l(P[0][0], P[0][1]); let prev = sec(0);
    const cap = (S, dir) => { const c = [S.reduce((s, q) => s + q[0], 0) / 6, y0 + (S[2][1] - y0) * 0.5, S.reduce((s, q) => s + q[2], 0) / 6]; for (let q = 0; q < 5; q++) { const a = S[q].slice(), b = S[q + 1].slice(), m = [c[0], c[1], c[2], dir[0], 0, dir[1], 0, c[1], 0.8]; for (const e of [a, b]) { e[3] = dir[0]; e[4] = 0; e[5] = dir[1]; e[6] = (e[0] - c[0]) * -dir[1] + (e[2] - c[2]) * dir[0]; e[7] = e[1]; e[8] = Math.max(e[8], 0.8); } this._tri(A, m, a, b, tint); this._tri(A, m, b, a, tint); }      // (both windings: an end is seen from outside whichever way the line was given)
      { const a = S[5].slice(), b = S[0].slice(), m = [c[0], c[1], c[2], dir[0], 0, dir[1], 0, c[1], 0.8]; for (const e of [a, b]) { e[3] = dir[0]; e[4] = 0; e[5] = dir[1]; e[6] = (e[0] - c[0]) * -dir[1] + (e[2] - c[2]) * dir[0]; e[7] = e[1]; e[8] = Math.max(e[8], 0.8); } this._tri(A, m, a, b, tint); this._tri(A, m, b, a, tint); } };
    if (o.ends !== false) { const d = [P[0][0] - P[1][0], P[0][1] - P[1][1]], l = Math.hypot(d[0], d[1]) || 1; cap(prev, [d[0] / l, d[1] / l]); }
    for (let i = 1; i < P.length; i++) { const cur = sec(i); for (let q = 0; q < 5; q++) { this._tri(A, prev[q], cur[q], cur[q + 1], tint); this._tri(A, prev[q], cur[q + 1], prev[q + 1], tint); } prev = cur; }
    if (o.ends !== false) { const n = P.length, d = [P[n - 1][0] - P[n - 2][0], P[n - 1][1] - P[n - 2][1]], l = Math.hypot(d[0], d[1]) || 1; cap(prev, [d[0] / l, d[1] / l]); }
  }
  /** a plant by name at its usual size (SIZE) times `scale`, a little uneven: -> its height */
  put(name, x, y, z, scale = 1, o = {}) {
    const sz = SIZE[name] || [0.8, 0.8, 2], v = 0.86 + 0.28 * hash(x * 1.3, z * 0.7), w = sz[0] * scale * v, h = sz[1] * scale * (0.9 + 0.2 * hash(z, x));
    this.card(PK[name], x, y, z, w, h, { n: sz[2] || 2, ...o });
    if (CAPPED.has(name) || o.cap) this.cap(PK[name], x, y + h * 0.72, z, w * 0.92, o);      // (so that a bush is a bush from above too)
    return h;
  }
  tris() { return this.nCards * 2 + this.nLeaf; }
  /** -> meshes (two a chunk at most: the cards, the leaf volumes), added to `parent` */
  build(world, parent, name = 'worcester-plants', mats = null) {
    const out = [], cm = mats ? mats.cards : plantMaterial(world), lm = mats ? mats.leaves : leafMaterial(world);
    for (const [k, a] of this.C) {
      if (!a.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3)); g.setAttribute('aSw', new THREE.Float32BufferAttribute(a.sw, 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(a.pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, cm); m.name = name + ':cards:' + k; m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m); out.push(m);
    }
    for (const [k, a] of this.L) {
      if (!a.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(a.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, lm); m.name = name + ':leaves:' + k; m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m); out.push(m);
    }
    return out;
  }
}

// ------------------------------------------------------------------------------------------------ one set for the grounds
let MATS = null;
/**
 * The one set of plants every Worcester grounds module adds to (game.worcesterPlants): each module adds its own in its
 * install() and then calls finish(world), which (re)builds the few meshes; so the order the modules load in does not
 * matter and the whole of the grounds' planting is two draws a chunk. -> { PL, group, meshes, finish(world), show(v) }
 */
export function groundsPlants(game) {
  if (game.worcesterPlants) return game.worcesterPlants;
  const PL = new Plants();
  // chunks: 0 the gardens by the quad (rose garden, Hanging Garden, south arm), 1 Orchard / car park / Fellows' Garden,
  // 2 the lake's west and south-west and the Provost's Garden, 3 the playing fields and the wood walk
  PL.chunk = (x, z) => (x > -340 ? (z > -25 ? 0 : 1) : x > -470 && z > -60 ? 2 : 3);
  const grp = new THREE.Group(); grp.name = 'worcester-plants';
  const W = { PL, group: grp, meshes: [], added: false,
    finish(world) {
      for (const m of W.meshes) { grp.remove(m); m.geometry.dispose(); }
      if (!MATS) MATS = { cards: plantMaterial(world), leaves: leafMaterial(world) };
      W.meshes = PL.build(world, grp, 'worcester-plants', MATS);
      if (!W.added) { world.addStatic(grp); W.added = true; }
      return W.meshes;
    },
    show(v) { if (grp.visible !== v) grp.visible = v; } };
  return (game.worcesterPlants = W);
}
