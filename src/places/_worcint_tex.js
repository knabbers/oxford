// Worcester College interiors — canvas painters (Burges chapel decoration, Wyatt plasterwork, glass, portraits, books).
// All painters draw in pixels on a 2D context; helpers take metre->pixel scale where relevant.
import * as THREE from 'three';
import { canvasScale, hiAniso } from '../world/_surf_detail.js';   // texture pass 2: larger canvases and 16x anisotropy on the top tier only
import { repaintable, repaintableFn } from '../world/_tex_keep.js';

export function canvas(w, h) {
  // (texture pass 2: on the top tier a canvas up to 1024 x 1024 is twice as large in pixels; painters still draw in the
  // w x h units they asked for — the context is scaled — and read the logical size as c.lw / c.lh)
  const c = document.createElement('canvas'), lw = Math.max(2, Math.round(w)), lh = Math.max(2, Math.round(h)), k = canvasScale(lw, lh);
  c.width = lw * k; c.height = lh * k; c.lw = lw; c.lh = lh;
  const g = c.getContext('2d'); if (k !== 1) g.scale(k, k);
  return { c, g };
}
/** c: a canvas — or a function that returns a freshly painted one, or a canvas from one of the painters below that
 *  remember how they were called (chapelWall, chapelCeiling, hallCeiling): then the canvas is let go once the texture
 *  is on the card, and it is painted again if the card ever needs the picture again (memory pass: world/_tex_keep.js).
 *  Give a plain canvas for a picture that is drawn on again later (the pigeonholes' name cards). */
export function tex(c, { repeat = null, wrap = true } = {}) {
  const paint = typeof c === 'function' ? c : c && c.__paint ? c.__paint : null; if (typeof c === 'function') c = paint();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = hiAniso(4);
  if (paint) repaintable(t, paint, 'worcint:' + (paint.name || c.width + 'x' + c.height));
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}
// deterministic rng
export function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ------------------------------------------------------------------------------------------------ ornament primitives
export function waveScroll(g, x0, y, w, h, fg, bg) {
  g.fillStyle = bg; g.fillRect(x0, y, w, h);
  g.strokeStyle = fg; g.fillStyle = fg; g.lineWidth = Math.max(1, h * 0.12);
  const p = h * 1.3; const r = h * 0.32;
  for (let x = x0; x < x0 + w; x += p) {
    g.beginPath(); g.moveTo(x, y + h * 0.85);
    g.bezierCurveTo(x + p * 0.35, y + h * 0.85, x + p * 0.55, y + h * 0.15, x + p * 0.5, y + h * 0.5);
    g.arc(x + p * 0.5 + r * 0.4, y + h * 0.5, r * 0.4, Math.PI, Math.PI * 2.6, false);
    g.stroke();
  }
  g.fillRect(x0, y + h - Math.max(1, h * 0.08), w, Math.max(1, h * 0.08));
}
export function greekKey(g, x0, y, w, h, fg, bg) {
  g.fillStyle = bg; g.fillRect(x0, y, w, h);
  g.strokeStyle = fg; g.lineWidth = Math.max(1, h * 0.12);
  const s = h * 0.8, m = h * 0.1;
  g.beginPath();
  for (let x = x0; x < x0 + w; x += s * 1.25) {
    g.moveTo(x, y + h - m); g.lineTo(x, y + m); g.lineTo(x + s, y + m); g.lineTo(x + s, y + h - m - s * 0.6);
    g.lineTo(x + s * 0.35, y + h - m - s * 0.6); g.lineTo(x + s * 0.35, y + m + s * 0.3); g.lineTo(x + s * 0.65, y + m + s * 0.3);
    g.moveTo(x, y + h - m); g.lineTo(x + s * 1.25, y + h - m);
  }
  g.stroke();
}
export function rosette(g, cx, cy, r, petal = '#d8b45a', centre = '#7a2a22', n = 8) {
  g.fillStyle = petal;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.45, r * 0.22, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = centre; g.beginPath(); g.arc(cx, cy, r * 0.3, 0, Math.PI * 2); g.fill();
}
/** hanging garland swag between x0..x1 at y with sag d */
export function swag(g, x0, x1, y, d, col = '#5f7a3a', berry = '#b0383a', w = 6) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y + d * 2, x1, y); g.stroke();
  g.fillStyle = berry;
  for (let k = 1; k < 8; k++) { const t = k / 8, xx = x0 + (x1 - x0) * t, yy = y + d * 4 * t * (1 - t); g.beginPath(); g.arc(xx, yy + w * 0.2, w * 0.35, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = col; g.fillRect(x0 - w * 0.3, y - w * 0.3, w * 0.6, d * 0.9); g.fillRect(x1 - w * 0.3, y - w * 0.3, w * 0.6, d * 0.9);
}
/** half-ornament mirrored about cx: fn(g) draws on the right side (x >= 0) relative to (cx, *) */
function mirrored(g, cx, fn) {
  g.save(); g.translate(cx, 0); fn(g); g.scale(-1, 1); fn(g); g.restore();
}
function scroll(g, x, y, r, dir = 1) {
  g.beginPath(); g.moveTo(0, y + r * 2); g.bezierCurveTo(x * 0.3, y + r * 2, x, y + r * 1.6, x, y + r * 0.6);
  g.arc(x - r * 0.5 * dir, y + r * 0.6, r * 0.5, 0, Math.PI * 1.7 * dir, dir < 0); g.stroke();
}
/** Raphaelesque grotesque candelabra panel (Burges' chapel uprights / Wyatt plaster panels) */
export function grotesque(g, x, y, w, h, pal = {}, seed = 1) {
  const P = { bg: '#e9d39a', line: '#8a5a24', leaf: '#5c7a3c', red: '#9c2f2a', blue: '#3c5c84', gold: '#c99a3c', border: '#7a2a22', ...pal };
  const R = rng(seed);
  g.save();
  g.fillStyle = P.border; g.fillRect(x, y, w, h);
  const m = Math.max(2, w * 0.06);
  g.fillStyle = P.bg; g.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
  g.beginPath(); g.rect(x + m, y + m, w - 2 * m, h - 2 * m); g.clip();
  const cx = x + w / 2, iw = (w - 2 * m) / 2;
  // central stem
  g.strokeStyle = P.line; g.lineWidth = Math.max(1, w * 0.035);
  g.beginPath(); g.moveTo(cx, y + h - m * 2); g.lineTo(cx, y + m * 2); g.stroke();
  let yy = y + h - m * 1.5;
  const step = iw * 1.5;
  let k = 0;
  while (yy > y + m + step * 0.6) {
    const kind = (k + Math.floor(R() * 2)) % 4;
    g.save();
    g.translate(0, yy);
    mirrored(g, cx, (gg) => {
      gg.strokeStyle = P.line; gg.lineWidth = Math.max(1, w * 0.03);
      if (kind === 0) { // acanthus scroll
        gg.fillStyle = P.leaf; gg.beginPath(); gg.ellipse(iw * 0.35, -step * 0.35, iw * 0.35, step * 0.16, -0.5, 0, Math.PI * 2); gg.fill();
        scroll(gg, iw * 0.8, -step * 0.9, step * 0.2, 1);
      } else if (kind === 1) { // vase handles + flame
        gg.fillStyle = P.gold; gg.beginPath(); gg.moveTo(0, 0); gg.quadraticCurveTo(iw * 0.55, -step * 0.2, iw * 0.25, -step * 0.55); gg.lineTo(0, -step * 0.55); gg.fill();
        gg.beginPath(); gg.arc(iw * 0.42, -step * 0.38, step * 0.1, 0, Math.PI * 2); gg.stroke();
      } else if (kind === 2) { // bird/griffin-ish shape
        gg.fillStyle = P.blue; gg.beginPath(); gg.moveTo(iw * 0.1, -step * 0.3); gg.quadraticCurveTo(iw * 0.6, -step * 0.6, iw * 0.9, -step * 0.35); gg.quadraticCurveTo(iw * 0.6, -step * 0.2, iw * 0.1, -step * 0.3); gg.fill();
        gg.fillStyle = P.red; gg.beginPath(); gg.arc(iw * 0.88, -step * 0.4, step * 0.06, 0, Math.PI * 2); gg.fill();
      } else { // swag + medallion arm
        gg.beginPath(); gg.moveTo(0, -step * 0.5); gg.quadraticCurveTo(iw * 0.5, -step * 0.1, iw * 0.9, -step * 0.6); gg.stroke();
        gg.fillStyle = P.red; gg.beginPath(); gg.arc(iw * 0.9, -step * 0.6, step * 0.07, 0, Math.PI * 2); gg.fill();
      }
    });
    // central element
    if (kind === 1) { g.fillStyle = P.red; g.beginPath(); g.ellipse(cx, -step * 0.75, iw * 0.12, step * 0.2, 0, 0, Math.PI * 2); g.fill(); }
    if (kind === 3) { g.fillStyle = P.gold; g.beginPath(); g.arc(cx, -step * 0.55, Math.min(iw * 0.35, step * 0.25), 0, Math.PI * 2); g.fill(); g.fillStyle = P.blue; g.beginPath(); g.arc(cx, -step * 0.55, Math.min(iw * 0.22, step * 0.16), 0, Math.PI * 2); g.fill(); }
    g.restore();
    yy -= step; k++;
  }
  g.restore();
}
/** standing robed figure with a halo (Burges' frieze of saints and worthies). face: +1 right, -1 left */
export function saint(g, cx, base, h, robe, mantle, face = 1, seed = 1, halo = true) {
  const R = rng(seed), w = h * 0.28;
  g.save();
  // robe (long trapezoid with folds)
  g.fillStyle = robe; g.beginPath(); g.moveTo(cx - w * 0.5, base); g.lineTo(cx + w * 0.5, base); g.lineTo(cx + w * 0.28, base - h * 0.78); g.lineTo(cx - w * 0.28, base - h * 0.78); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = Math.max(1, h * 0.012);
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * w * 0.09, base - h * 0.7); g.lineTo(cx + i * w * 0.16, base); g.stroke(); }
  // mantle over one shoulder
  g.fillStyle = mantle; g.beginPath(); g.moveTo(cx - w * 0.3 * face, base - h * 0.78); g.lineTo(cx + w * 0.32 * face, base - h * 0.76); g.lineTo(cx + w * 0.45 * face, base - h * 0.25); g.lineTo(cx - w * 0.1 * face, base - h * 0.42); g.closePath(); g.fill();
  // hands joined in prayer, toward the face direction
  g.fillStyle = '#e8c8a8'; g.beginPath(); g.ellipse(cx + w * 0.3 * face, base - h * 0.62, w * 0.09, h * 0.035, 0.6 * face, 0, Math.PI * 2); g.fill();
  // head
  const hy = base - h * 0.87;
  if (halo) { g.fillStyle = '#e4bc4a'; g.beginPath(); g.arc(cx + w * 0.04 * face, hy, h * 0.085, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#8a6018'; g.lineWidth = Math.max(1, h * 0.008); g.stroke(); }
  g.fillStyle = '#e8c4a0'; g.beginPath(); g.ellipse(cx + w * 0.06 * face, hy, h * 0.045, h * 0.055, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = ['#4a3020', '#8a7a6a', '#2a2018', '#b8a890'][Math.floor(R() * 4)]; g.beginPath(); g.ellipse(cx + w * 0.0 * face, hy - h * 0.02, h * 0.045, h * 0.035, 0, Math.PI, Math.PI * 2); g.fill();
  if (R() < 0.35) { g.fillStyle = '#e0d4b0'; g.fillRect(cx - w * 0.15 * face - h * 0.02, base - h * 0.55, h * 0.05, h * 0.12); } // book/scroll
  g.restore();
}
/** fan shell lunette (pink/red flutes with gold ribs) centred at cx, sitting on baseline y, radius r */
export function fanShell(g, cx, y, r, pal = {}) {
  const P = { a: '#d9897a', b: '#b8554a', rib: '#d8b050', rim: '#e8cc78', ...pal };
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI;
    g.fillStyle = i % 2 ? P.a : P.b; g.beginPath(); g.moveTo(cx, y); g.arc(cx, y, r, a0, a1); g.closePath(); g.fill();
  }
  g.strokeStyle = P.rib; g.lineWidth = Math.max(1, r * 0.03);
  for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI; g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
  g.strokeStyle = P.rim; g.lineWidth = Math.max(2, r * 0.07); g.beginPath(); g.arc(cx, y, r, Math.PI, Math.PI * 2); g.stroke();
  g.fillStyle = P.rim; g.beginPath(); g.arc(cx, y, r * 0.14, Math.PI, Math.PI * 2); g.fill();
}
/** dark oak panelling with inlaid roundels, y0..y1 in px */
export function wainscot(g, x0, x1, y0, y1, ppm, base = '#3a2416') {
  g.fillStyle = base; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const pw = 0.9 * ppm, h = y1 - y0;
  for (let x = x0 + 0.06 * ppm; x < x1 - pw * 0.5; x += pw) {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y0 + h * 0.1, pw - 0.08 * ppm, h * 0.5);
    g.fillStyle = 'rgba(255,220,170,0.08)'; g.fillRect(x + 2, y0 + h * 0.1 + 2, pw - 0.08 * ppm - 4, 2);
    g.strokeStyle = '#a8865a'; g.lineWidth = Math.max(1, ppm * 0.012); g.beginPath(); g.arc(x + (pw - 0.08 * ppm) / 2, y0 + h * 0.35, h * 0.12, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y0 + h * 0.68, pw - 0.08 * ppm, h * 0.25);
  }
  g.fillStyle = '#24160c'; g.fillRect(x0, y0, x1 - x0, Math.max(2, 0.05 * ppm));
}

// ------------------------------------------------------------------------------------------------ CHAPEL
// Elevation of a side wall: s = 0..L metres along the wall (left->right as seen from inside), y = 0..H metres.
// opts: windows [{s, w, y0, y1}], pilasters [s], face (+1 figures face right / -1 left), seed
export const CH = { wain: 2.0, wave: 0.25, frieze: 1.4, band: 0.22, ent: 0.55 };
export function chapelWall(L, H, opts) {
  const ppm = opts.ppm || 90;
  const { c, g } = canvas(L * ppm, H * ppm);
  const Y = (y) => (H - y) * ppm, S = (s) => s * ppm;
  const ZN = opts.zones ? { ...CH, ...opts.zones } : CH;      // (the Chapel passes its own zone heights: _worcint_chapel.js ZONES)
  const z1 = ZN.wain, z2 = z1 + ZN.wave, z3 = z2 + ZN.frieze, z4 = z3 + ZN.band, zT = H - ZN.ent;
  // upper zone ground: warm gold-cream
  g.fillStyle = '#d9bf84'; g.fillRect(0, 0, c.lw, c.lh);
  // wainscot
  wainscot(g, 0, c.lw, Y(z1), Y(0), ppm);
  // wave band
  waveScroll(g, 0, Y(z2), c.lw, (z2 - z1) * ppm, '#e8d6a8', '#5a2a1e');
  // maroon frieze with figure panels (saints facing east)
  g.fillStyle = '#6e2a22'; g.fillRect(0, Y(z3), c.lw, (z3 - z2) * ppm);
  const R = rng(opts.seed || 3);
  const robes = ['#3b5f8a', '#8a2f2a', '#5e7a3a', '#d8cfb8', '#4a3a6a', '#a8742a', '#2a2a2a', '#7a5a8a'];
  const blocks = opts.frieze || [];
  for (const b of blocks) {
    const px0 = S(b.s0), px1 = S(b.s1), py0 = Y(z3) + 0.12 * ppm, py1 = Y(z2) - 0.1 * ppm;
    g.fillStyle = '#c9a64c'; g.fillRect(px0 - 3, py0 - 3, px1 - px0 + 6, py1 - py0 + 6);
    // gold ground with faint diaper
    const gr = g.createLinearGradient(0, py0, 0, py1); gr.addColorStop(0, '#e8cc80'); gr.addColorStop(1, '#c9a44c');
    g.fillStyle = gr; g.fillRect(px0, py0, px1 - px0, py1 - py0);
    g.fillStyle = 'rgba(140,90,30,0.18)'; for (let x = px0; x < px1; x += ppm * 0.12) for (let y = py0; y < py1; y += ppm * 0.12) g.fillRect(x, y, 1.5, 1.5);
    // ground line + figures
    g.fillStyle = '#5a6a3a'; g.fillRect(px0, py1 - ppm * 0.08, px1 - px0, ppm * 0.08);
    const n = Math.max(1, Math.round((b.s1 - b.s0) / 0.55));
    for (let i = 0; i < n; i++) {
      const cx = px0 + (px1 - px0) * (i + 0.5) / n;
      saint(g, cx, py1 - ppm * 0.06, (py1 - py0) * (0.84 + R() * 0.1), robes[Math.floor(R() * robes.length)], robes[Math.floor(R() * robes.length)], opts.face || 1, Math.floor(R() * 1000));
    }
    g.strokeStyle = '#3a1810'; g.lineWidth = 2; g.strokeRect(px0, py0, px1 - px0, py1 - py0);
  }
  // patterned band
  g.fillStyle = '#2a1a14'; g.fillRect(0, Y(z4), c.lw, (z4 - z3) * ppm);
  for (let x = 0; x < c.lw; x += ppm * 0.3) { g.fillStyle = '#c99a3c'; g.beginPath(); g.moveTo(x, Y(z3 + (z4 - z3) / 2)); g.lineTo(x + ppm * 0.08, Y(z4) + 2); g.lineTo(x + ppm * 0.16, Y(z3 + (z4 - z3) / 2)); g.lineTo(x + ppm * 0.08, Y(z3) - 2); g.fill(); }
  // upper zone: grotesque panels between the windows and pilasters
  for (const p of opts.panels || []) grotesque(g, S(p.s0), Y(p.y1), S(p.s1) - S(p.s0), (p.y1 - p.y0) * ppm, p.pal, p.seed);
  // window surrounds (painted architraves)
  for (const w of opts.windows || []) {
    const m = 0.16 * ppm;
    g.fillStyle = '#7a2a22'; g.fillRect(S(w.s - w.w / 2) - m, Y(w.y1) - m, w.w * ppm + 2 * m, (w.y1 - w.y0) * ppm + 2 * m);
    g.fillStyle = '#d8b050'; g.fillRect(S(w.s - w.w / 2) - m * 0.45, Y(w.y1) - m * 0.45, w.w * ppm + m * 0.9, (w.y1 - w.y0) * ppm + m * 0.9);
  }
  // roundels (painted medallions) over the panels
  for (const r of opts.roundels || []) { g.fillStyle = '#7a2a22'; g.beginPath(); g.arc(S(r.s), Y(r.y), r.r * ppm * 1.15, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3c5c84'; g.beginPath(); g.arc(S(r.s), Y(r.y), r.r * ppm, 0, Math.PI * 2); g.fill(); rosette(g, S(r.s), Y(r.y), r.r * ppm * 0.8, '#e8cc78', '#9c2f2a'); }
  // entablature: architrave + garland frieze + cornice bands
  g.fillStyle = '#e4d3a6'; g.fillRect(0, 0, c.lw, Y(zT));
  g.fillStyle = '#7a2a22'; g.fillRect(0, Y(zT), c.lw, 0.07 * ppm);
  g.fillStyle = '#c99a3c'; g.fillRect(0, Y(zT) - 0.05 * ppm, c.lw, 0.04 * ppm);
  for (let s = 0.2; s < L; s += 0.9) swag(g, S(s), S(s + 0.9), Y(H - 0.18), 0.12 * ppm, '#5c7a3c', '#b0383a', Math.max(3, ppm * 0.05));
  g.fillStyle = '#b0383a'; g.fillRect(0, 0, c.lw, 0.06 * ppm);
  return c;
}
/** column / pilaster shaft texture: v 0..1 bottom->top: red scagliola lower part, fluted grey-green upper */
export function shaftTex(redFrac = 0.42, fluteN = 7) {
  const { c, g } = canvas(256, 1024);
  const yr = c.lh * (1 - redFrac);
  // upper: grey-green flutes
  g.fillStyle = '#9fae98'; g.fillRect(0, 0, 256, yr);
  for (let i = 0; i < fluteN; i++) { const x = (i + 0.5) * 256 / fluteN; const gr = g.createLinearGradient(x - 12, 0, x + 12, 0); gr.addColorStop(0, '#9fae98'); gr.addColorStop(0.5, '#6f7e6a'); gr.addColorStop(1, '#b6c4ae'); g.fillStyle = gr; g.fillRect(x - 12, 10, 24, yr - 20); }
  // lower: red marble
  g.fillStyle = '#a8382c'; g.fillRect(0, yr, 256, c.lh - yr);
  const R = rng(9); g.strokeStyle = 'rgba(240,190,170,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { g.beginPath(); let x = R() * 256, y = yr + R() * (c.lh - yr); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 60; y += R() * 50; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 3; i++) { const x = (i + 0.5) * 256 / 3; g.fillStyle = 'rgba(80,10,5,0.25)'; g.fillRect(x - 6, yr + 8, 12, c.lh - yr - 16); }
  g.fillStyle = '#d8b050'; g.fillRect(0, yr - 8, 256, 16);
  return tex(c, { wrap: false });
}
/** flat ceiling panels around the saucer dome (W x D metres). domeR: radius of the round opening. */
export function chapelCeiling(Lm, Wm, domeX, domeR, ppm = 70) {
  const { c, g } = canvas(Lm * ppm, Wm * ppm);
  const P = (m) => m * ppm;
  g.fillStyle = '#d9bd78'; g.fillRect(0, 0, c.lw, c.lh);
  // coffer grid outside the central square
  const sq0 = domeX - Wm / 2, sq1 = domeX + Wm / 2;
  const coffer = (x0, x1) => {
    // border of small squares with rosettes / lozenges
    const b = 0.42;
    for (let x = x0; x < x1 - 0.01; x += b) for (const y of [0, Wm - b]) { g.fillStyle = ((x * 7) | 0) % 2 ? '#7a2a22' : '#3c5c84'; g.fillRect(P(x) + 2, P(y) + 2, P(b) - 4, P(b) - 4); rosette(g, P(x + b / 2), P(y + b / 2), P(b * 0.32), '#e8cc78', '#b0383a', 6); }
    for (const x of [x0, x1 - b]) for (let y = b; y < Wm - b - 0.01; y += b) { g.fillStyle = '#5c7a3c'; g.fillRect(P(x) + 2, P(y) + 2, P(b) - 4, P(b) - 4); g.fillStyle = '#e8cc78'; g.beginPath(); g.moveTo(P(x + b / 2), P(y) + 4); g.lineTo(P(x + b) - 4, P(y + b / 2)); g.lineTo(P(x + b / 2), P(y + b) - 4); g.lineTo(P(x) + 4, P(y + b / 2)); g.fill(); }
    // central painted panel (figures on blue) in a cream frame with swag borders
    const ix0 = x0 + b + 0.25, ix1 = x1 - b - 0.25, iy0 = b + 0.25, iy1 = Wm - b - 0.25;
    g.fillStyle = '#efe0b4'; g.fillRect(P(ix0), P(iy0), P(ix1 - ix0), P(iy1 - iy0));
    for (let x = ix0; x < ix1 - 0.6; x += 0.6) { swag(g, P(x), P(x + 0.6), P(iy0 + 0.12), P(0.05), '#c99a3c', '#c99a3c', 3); swag(g, P(x), P(x + 0.6), P(iy1 - 0.25), P(0.05), '#c99a3c', '#c99a3c', 3); }
    const px0 = (ix0 + ix1) / 2 - 1.2, px1 = (ix0 + ix1) / 2 + 1.2, py0 = Wm / 2 - 0.8, py1 = Wm / 2 + 0.8;
    g.fillStyle = '#7a2a22'; g.fillRect(P(px0) - 6, P(py0) - 6, P(px1 - px0) + 12, P(py1 - py0) + 12);
    const gr = g.createLinearGradient(0, P(py0), 0, P(py1)); gr.addColorStop(0, '#3c5c84'); gr.addColorStop(1, '#22344e'); g.fillStyle = gr; g.fillRect(P(px0), P(py0), P(px1 - px0), P(py1 - py0));
    saint(g, P(px0 + 0.8), P(py1 - 0.1), P(1.3), '#d8cfb8', '#a8382c', 1, Math.round(x0 * 13), true);
    saint(g, P(px1 - 0.8), P(py1 - 0.1), P(1.3), '#a8742a', '#3b5f8a', -1, Math.round(x0 * 17), true);
    for (const yy of [iy0 + 0.55, iy1 - 0.55]) { g.fillStyle = '#c99a3c'; g.beginPath(); g.arc(P((ix0 + ix1) / 2), P(yy), P(0.28), 0, Math.PI * 2); g.fill(); g.fillStyle = '#3c5c84'; g.beginPath(); g.arc(P((ix0 + ix1) / 2), P(yy), P(0.2), 0, Math.PI * 2); g.fill(); }
    // red and blue arabesque fields either side of the picture
    for (const [a, bq] of [[ix0 + 0.1, px0 - 0.15], [px1 + 0.15, ix1 - 0.1]]) if (bq - a > 0.3) grotesque(g, P(a), P(iy0 + 0.35), P(bq - a), P(iy1 - iy0 - 0.7), { bg: '#c86a5a', border: '#e8cc78', line: '#f2dca0', leaf: '#5c7a3c' }, Math.round(a * 31));
  };
  coffer(0, sq0); coffer(sq1, Lm);
  // central square: wreath ring around the dome + hexagonal head medallions in the corners
  g.fillStyle = '#e4cc8c'; g.fillRect(P(sq0), 0, P(Wm), P(Wm));
  g.strokeStyle = '#a8742a'; g.lineWidth = 4; g.strokeRect(P(sq0) + 6, 6, P(Wm) - 12, P(Wm) - 12);
  const cx = P(domeX), cy = P(Wm / 2);
  // laurel wreath with pink ribbons
  const rw = P(domeR + 0.42);
  g.lineWidth = P(0.36); g.strokeStyle = '#4f7a3e'; g.beginPath(); g.arc(cx, cy, rw, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; g.fillStyle = i % 3 ? '#6e9a4e' : '#2f5a2a'; g.beginPath(); g.ellipse(cx + Math.cos(a) * rw, cy + Math.sin(a) * rw, P(0.13), P(0.05), a + 0.8, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; g.fillStyle = '#d8707a'; g.beginPath(); g.ellipse(cx + Math.cos(a) * rw, cy + Math.sin(a) * rw, P(0.2), P(0.06), a - 0.7, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(cx + Math.cos(a) * rw, cy + Math.sin(a) * rw, P(0.2), P(0.06), a + 0.7, 0, Math.PI * 2); g.fill(); }
  g.lineWidth = 5; g.strokeStyle = '#e8d9a8'; g.beginPath(); g.arc(cx, cy, P(domeR + 0.04), 0, Math.PI * 2); g.stroke();
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hx = cx + sx * P(Wm * 0.38), hy = cy + sy * P(Wm * 0.38), hr = P(0.42);
    g.fillStyle = '#c99a3c'; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(hx + Math.cos(a) * hr * 1.15, hy + Math.sin(a) * hr * 1.15); } g.fill();
    g.fillStyle = '#5a8a8a'; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(hx + Math.cos(a) * hr, hy + Math.sin(a) * hr); } g.fill();
    g.fillStyle = '#e8c4a0'; g.beginPath(); g.ellipse(hx, hy, hr * 0.35, hr * 0.45, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b0383a'; g.beginPath(); g.ellipse(hx, hy + hr * 0.45, hr * 0.5, hr * 0.3, 0, Math.PI, Math.PI * 2); g.fill();
  }
  return c;
}
/** saucer dome: polar texture (u = angle 0..1, v = 0 rim .. 1 crown) */
export function domeTex() {
  const { c, g } = canvas(1024, 256);
  const W = 1024, H = 256;
  // 8 gold panels separated by cream ribs, Greek key at the rim
  for (let i = 0; i < 8; i++) {
    const x0 = (i / 8) * W, x1 = ((i + 1) / 8) * W;
    const gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, '#d9b04c'); gr.addColorStop(1, '#f0d27a');
    g.fillStyle = gr; g.fillRect(x0, 0, x1 - x0, H);
    // arabesque: urn + scrolls
    g.strokeStyle = '#8a5a1a'; g.lineWidth = 2; const cx = (x0 + x1) / 2;
    g.beginPath(); g.moveTo(cx, H * 0.85); g.lineTo(cx, H * 0.2); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 22, H * 0.55, 16, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx, H * 0.7); g.quadraticCurveTo(cx + s * 40, H * 0.75, cx + s * 44, H * 0.5); g.stroke(); }
    g.fillStyle = '#8a5a1a'; g.beginPath(); g.ellipse(cx, H * 0.8, 14, 10, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#efe0b4'; g.fillRect(x0, 0, 8, H);
  }
  greekKey(g, 0, H - 26, W, 24, '#8a5a1a', '#efe0b4');
  g.fillStyle = '#2a1a10'; g.fillRect(0, 0, W, 22);
  for (let i = 0; i < 32; i++) { g.fillStyle = '#c99a3c'; g.beginPath(); g.arc((i + 0.5) * W / 32, 11, 7, 0, Math.PI * 2); g.fill(); }
  return tex(c, { wrap: true });
}
/** cove tile: one bay of the coved ceiling, u across the bay, v from wall-top (0) to ceiling edge (1) */
export function coveTex() {
  const { c, g } = canvas(512, 256);
  g.fillStyle = '#e4cc8c'; g.fillRect(0, 0, 512, 256);
  // the canvas top (v=1) meets the flat ceiling; bottom (v=0) sits on the cornice
  fanShell(g, 256, 256, 200);
  for (const x of [20, 492]) { g.fillStyle = '#c99a3c'; g.fillRect(x - 8, 0, 16, 256); grotesque(g, x - 30, 20, 60, 220, { bg: '#e4cc8c', border: '#c99a3c' }, x); }
  g.fillStyle = '#b0383a'; g.fillRect(0, 0, 512, 10); g.fillStyle = '#c99a3c'; g.fillRect(0, 248, 512, 8);
  return tex(c, { wrap: true });
}
/** marble mosaic of the aisle: one tile ~ 2.4 m square */
export function mosaicTex() {
  const { c, g } = canvas(512, 512);
  g.fillStyle = '#a49c8e'; g.fillRect(0, 0, 512, 512);
  const R = rng(5);
  // speckled tesserae
  for (let i = 0; i < 12000; i++) { const v = 130 + R() * 70 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(R() * 512, R() * 512, 3, 3); }
  const hex = (cx, cy, r, fill, stroke) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62); } g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } g.strokeStyle = stroke; g.lineWidth = 6; g.stroke(); };
  hex(256, 256, 236, '#b8b0a0', '#2a2a2e');
  hex(256, 256, 200, null, '#6a5a4a');
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; g.fillStyle = k % 2 ? '#5a6a7a' : '#8a5a4a'; g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + Math.cos(a) * 190, 256 + Math.sin(a) * 118); g.lineTo(256 + Math.cos(a + 1.047) * 190, 256 + Math.sin(a + 1.047) * 118); g.closePath(); g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1; }
  hex(256, 256, 120, '#d4ccbc', '#2a2a2e');
  // lozenges in the corners
  for (const [x, y] of [[0, 0], [512, 0], [0, 512], [512, 512]]) { g.fillStyle = '#5a5a60'; g.beginPath(); g.moveTo(x, y - 90); g.lineTo(x + 90, y); g.lineTo(x, y + 90); g.lineTo(x - 90, y); g.fill(); g.fillStyle = '#c8a878'; g.beginPath(); g.moveTo(x, y - 50); g.lineTo(x + 50, y); g.lineTo(x, y + 50); g.lineTo(x - 50, y); g.fill(); }
  // chequer band of black/white tesserae round the edge
  for (let i = 0; i < 32; i++) { g.fillStyle = i % 2 ? '#2a2a2e' : '#e8e4da'; g.fillRect(i * 16, 0, 16, 10); g.fillRect(i * 16, 502, 16, 10); }
  // central figurative roundel (a bird)
  g.fillStyle = '#e8e4da'; g.beginPath(); g.arc(256, 256, 54, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6a4a3a'; g.beginPath(); g.ellipse(250, 262, 30, 16, -0.2, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(280, 244, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b0383a'; g.beginPath(); g.moveTo(288, 244); g.lineTo(300, 247); g.lineTo(288, 250); g.fill();
  return tex(c, { wrap: true });
}
/** Holiday's stained glass: atlas of cells. cells: [{w,h,theme,arch?}] -> {texture, uv(i)} */
export function glassAtlas(cells, seed = 11) {
  const n = cells.length, CW = 256, CH2 = 512;
  const { c, g } = canvas(CW * n, CH2);
  const R = rng(seed);
  cells.forEach((cell, i) => {
    const x0 = i * CW;
    g.save(); g.beginPath(); g.rect(x0, 0, CW, CH2); g.clip();
    const pal = cell.pal || ['#2a4a9a', '#9a1a2a', '#3a7a3a', '#c8a030', '#6a2a7a', '#e8e0c8'];
    // background quarries
    g.fillStyle = cell.ground || '#e6e2cc'; g.fillRect(x0, 0, CW, CH2);
    for (let y = 0; y < CH2; y += 32) for (let x = 0; x < CW; x += 32) { g.fillStyle = cell.ground2 || `rgba(${200 + R() * 40 | 0},${200 + R() * 40 | 0},${170 + R() * 40 | 0},1)`; g.fillRect(x0 + x + 1, y + 1, 30, 30); }
    if (cell.theme !== 'plain') {
      // Holiday-style: border of jewel squares, gothic canopy, deep blue diapered ground, robed figures, prophet above
      const nf = cell.figures || 2, gx0 = x0 + 18, gx1 = x0 + CW - 18;
      for (let y = 0; y < CH2; y += 18) { g.fillStyle = ['#a8202a', '#2a4aa0', '#d8a830', '#3a7a3a'][(y / 18) % 4]; g.fillRect(x0 + 4, y + 2, 12, 14); g.fillRect(x0 + CW - 16, y + 2, 12, 14); }
      const sky = g.createLinearGradient(0, 100, 0, CH2); sky.addColorStop(0, '#1c3a8a'); sky.addColorStop(1, '#2a4a9a');
      g.fillStyle = sky; g.fillRect(gx0, 120, gx1 - gx0, CH2 - 190);
      g.strokeStyle = 'rgba(160,190,240,0.25)'; g.lineWidth = 2;
      for (let y = 130; y < CH2 - 70; y += 16) for (let x = gx0 + 8; x < gx1; x += 16) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.stroke(); }
      // canopy: gold pinnacles + white tracery
      g.fillStyle = '#d8b040'; g.fillRect(gx0, 96, gx1 - gx0, 26);
      for (let k = 0; k <= nf; k++) { const x = gx0 + (gx1 - gx0) * k / nf; g.beginPath(); g.moveTo(x - 7, 96); g.lineTo(x, 50); g.lineTo(x + 7, 96); g.fill(); }
      for (let k = 0; k < nf; k++) { const xa = gx0 + (gx1 - gx0) * k / nf, xb = gx0 + (gx1 - gx0) * (k + 1) / nf; g.strokeStyle = '#efe6c8'; g.lineWidth = 4; g.beginPath(); g.moveTo(xa + 4, 124); g.quadraticCurveTo((xa + xb) / 2, 84, xb - 4, 124); g.stroke(); }
      // ground: green with flowers
      g.fillStyle = '#2f6a2a'; g.fillRect(gx0, CH2 - 120, gx1 - gx0, 50);
      for (let k = 0; k < 12; k++) { g.fillStyle = k % 2 ? '#e8d050' : '#d04040'; g.beginPath(); g.arc(gx0 + R() * (gx1 - gx0), CH2 - 115 + R() * 40, 3, 0, Math.PI * 2); g.fill(); }
      for (let k = 0; k < nf; k++) {
        const cx = x0 + 18 + (CW - 36) * (k + 0.5) / nf, base = CH2 - 82, hgt = nf === 1 ? 300 : 270, w = nf === 3 ? 26 : 34;
        const robe = pal[[1, 4, 2, 3][(k + i) % 4]], mantle = pal[[5, 1, 3, 4][(k + i) % 4]];
        g.fillStyle = robe; g.beginPath(); g.moveTo(cx - w, base); g.lineTo(cx + w, base); g.lineTo(cx + w * 0.55, base - hgt * 0.8); g.lineTo(cx - w * 0.55, base - hgt * 0.8); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (let f = -2; f <= 2; f++) { g.beginPath(); g.moveTo(cx + f * w * 0.18, base - hgt * 0.7); g.lineTo(cx + f * w * 0.35, base); g.stroke(); }
        g.fillStyle = mantle; g.beginPath(); g.moveTo(cx - w * 0.6, base - hgt * 0.8); g.lineTo(cx + w * 0.7, base - hgt * 0.78); g.lineTo(cx + w * 0.95, base - hgt * 0.3); g.lineTo(cx - w * 0.2, base - hgt * 0.45); g.fill();
        g.fillStyle = '#f0d8b0'; g.beginPath(); g.ellipse(cx + w * 0.4, base - hgt * 0.6, 7, 5, 0.5, 0, Math.PI * 2); g.fill();
        const hy = base - hgt * 0.88;
        g.fillStyle = '#f0c830'; g.beginPath(); g.arc(cx, hy, 21, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f0d8b0'; g.beginPath(); g.ellipse(cx, hy, 11, 14, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = ['#5a3a1a', '#8a6a3a', '#3a2a1a'][k % 3]; g.beginPath(); g.ellipse(cx, hy - 5, 12, 10, 0, Math.PI, Math.PI * 2); g.fill();
      }
      if (cell.theme === 'cross') { g.fillStyle = '#6a4a2a'; g.fillRect(x0 + CW / 2 - 7, 140, 14, CH2 - 230); g.fillRect(x0 + CW / 2 - 60, 180, 120, 12); g.fillStyle = '#efe0c8'; g.fillRect(x0 + CW / 2 - 9, 190, 18, 120); g.fillRect(x0 + CW / 2 - 50, 184, 100, 8); g.fillStyle = '#f0c830'; g.beginPath(); g.arc(x0 + CW / 2, 172, 16, 0, Math.PI * 2); g.fill(); }
      // label band + prophet medallion at the top
      g.fillStyle = '#efe6c8'; g.fillRect(gx0, CH2 - 64, gx1 - gx0, 18); g.fillStyle = '#6a2a1a'; for (let x = gx0 + 6; x < gx1 - 10; x += 9) g.fillRect(x, CH2 - 59, 5, 8);
      g.fillStyle = pal[4]; g.fillRect(gx0, CH2 - 46, gx1 - gx0, 40);
      g.fillStyle = '#a8202a'; g.beginPath(); g.arc(x0 + CW / 2, 40, 28, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f0d8b0'; g.beginPath(); g.arc(x0 + CW / 2, 40, 12, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#f0c830'; g.lineWidth = 4; g.beginPath(); g.arc(x0 + CW / 2, 40, 28, 0, Math.PI * 2); g.stroke();
    } else if (cell.medallion) {
      g.fillStyle = '#c8a030'; g.beginPath(); g.arc(x0 + CW / 2, CH2 / 2, 60, 0, Math.PI * 2); g.fill(); g.fillStyle = '#9a1a2a'; g.beginPath(); g.arc(x0 + CW / 2, CH2 / 2, 44, 0, Math.PI * 2); g.fill();
    }
    // lead cames
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 3;
    for (let y = 0; y < CH2; y += 64) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + CW, y); g.stroke(); }
    g.lineWidth = 1.5; for (let k = 0; k < 40; k++) { const x = x0 + 18 + R() * (CW - 36), y = 120 + R() * (CH2 - 200); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 40, y + (R() - 0.5) * 40); g.stroke(); }
    // (the net of cames that holds the quarries: thin, so the figures still read)
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(16,14,12,0.6)';
    for (let y = 32; y < CH2; y += 32) { g.beginPath(); g.moveTo(x0 + 4, y); g.lineTo(x0 + CW - 4, y); g.stroke(); }
    for (let y = 0, r = 0; y < CH2; y += 32, r++) for (let x = r % 2 ? 44 : 20; x < CW - 16; x += 48) { g.beginPath(); g.moveTo(x0 + x, y); g.lineTo(x0 + x, y + 32); g.stroke(); }
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 10; g.strokeRect(x0 + 2, 2, CW - 4, CH2 - 4);
    g.restore();
  });
  const t = tex(c, { wrap: false });
  return { texture: t, uv: (i) => [i / n + 0.002, 0.002, (i + 1) / n - 0.002, 0.998] };
}

// ------------------------------------------------------------------------------------------------ portraits
/** atlas of dark generic portraits (no likenesses): cells 4 x 2 */
export function portraitAtlas(seed = 21) {
  const CW = 192, CHh = 256, cols = 4, rows = 2;
  const { c, g } = canvas(CW * cols, CHh * rows);
  const R = rng(seed);
  for (let i = 0; i < cols * rows; i++) {
    const x0 = (i % cols) * CW, y0 = Math.floor(i / cols) * CHh;
    const gr = g.createRadialGradient(x0 + CW * 0.5, y0 + CHh * 0.35, 10, x0 + CW * 0.5, y0 + CHh * 0.5, CHh * 0.7);
    gr.addColorStop(0, ['#5a4a38', '#4a4038', '#3a3a40', '#5a3a2a'][i % 4]); gr.addColorStop(1, '#141210');
    g.fillStyle = gr; g.fillRect(x0, y0, CW, CHh);
    // sitter: robe (red academic, black, grey), white bands/collar, face
    const robe = ['#7a1a1a', '#1a1a1e', '#2a2a30', '#6a1a24', '#202020', '#3a3a3a'][Math.floor(R() * 6)];
    const cx = x0 + CW * (0.45 + R() * 0.1);
    g.fillStyle = robe; g.beginPath(); g.moveTo(cx - 70, y0 + CHh); g.quadraticCurveTo(cx - 60, y0 + CHh * 0.5, cx, y0 + CHh * 0.48); g.quadraticCurveTo(cx + 60, y0 + CHh * 0.5, cx + 75, y0 + CHh); g.fill();
    g.fillStyle = '#e8e4d8'; g.beginPath(); g.moveTo(cx - 9, y0 + CHh * 0.5); g.lineTo(cx + 9, y0 + CHh * 0.5); g.lineTo(cx + 5, y0 + CHh * 0.62); g.lineTo(cx - 5, y0 + CHh * 0.62); g.fill();
    g.fillStyle = '#c89a78'; g.beginPath(); g.ellipse(cx, y0 + CHh * 0.38, 22, 28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(40,25,15,0.35)'; g.beginPath(); g.ellipse(cx + 8, y0 + CHh * 0.4, 12, 24, 0, 0, Math.PI * 2); g.fill();
    if (R() < 0.6) { g.fillStyle = R() < 0.5 ? '#ddd8cc' : '#3a2a20'; g.beginPath(); g.ellipse(cx, y0 + CHh * 0.3, 26, 20, 0, Math.PI, Math.PI * 2); g.fill(); } // wig / hair
    if (R() < 0.4) { g.fillStyle = '#b8b0a0'; g.fillRect(cx + 30, y0 + CHh * 0.7, 30, 40); } // book
    g.fillStyle = 'rgba(255,240,200,0.05)'; g.fillRect(x0, y0, CW, CHh);
  }
  return { texture: tex(c, { wrap: false }), uv: (i) => { const k = i % (cols * rows); const x = k % cols, y = Math.floor(k / cols); return [x / cols + 0.004, 1 - (y + 1) / rows + 0.004, (x + 1) / cols - 0.004, 1 - y / rows - 0.004]; } };
}

// ------------------------------------------------------------------------------------------------ plaster (Wyatt hall)
/** tall narrow plaster panel: white grotesque relief on a coloured ground */
export function plasterPanel(ground = '#b9c9b3') {
  const { c, g } = canvas(128, 768);
  grotesque(g, 0, 0, 128, 768, { bg: ground, border: '#f0ece0', line: '#f6f2e8', leaf: '#eae6da', red: '#f0ece0', blue: '#e4e0d4', gold: '#f2eee2' }, 4);
  return tex(c, { wrap: false });
}
/** hall ceiling: flat centre with lozenge/octagon ribs, (L x W metres) */
export function hallCeiling(Lm, Wm, roses, ppm = 48, ground = '#eef0e6') {
  const { c, g } = canvas(Lm * ppm, Wm * ppm);
  const P = (m) => m * ppm;
  g.fillStyle = ground; g.fillRect(0, 0, c.lw, c.lh);
  g.strokeStyle = '#ffffff'; g.lineWidth = P(0.12);
  g.strokeRect(P(0.2), P(0.2), P(Lm - 0.4), P(Wm - 0.4));
  // lozenges around each rose + linking diagonals
  for (const x of roses) {
    g.beginPath(); g.moveTo(P(x), P(0.3)); g.lineTo(P(x + Wm * 0.62), P(Wm / 2)); g.lineTo(P(x), P(Wm - 0.3)); g.lineTo(P(x - Wm * 0.62), P(Wm / 2)); g.closePath(); g.stroke();
    g.fillStyle = 'rgba(200,214,196,0.6)'; g.fill();
    g.strokeStyle = '#ffffff';
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; g.beginPath(); g.moveTo(P(x) + Math.cos(a) * P(0.7), P(Wm / 2) + Math.sin(a) * P(0.7)); g.lineTo(P(x) + Math.cos(a) * P(1.15), P(Wm / 2) + Math.sin(a) * P(1.15)); g.lineWidth = 2; g.stroke(); }
    g.lineWidth = P(0.12);
    g.beginPath(); g.arc(P(x), P(Wm / 2), P(1.2), 0, Math.PI * 2); g.stroke();
  }
  // husk garlands along the long edges
  g.strokeStyle = '#ffffff'; g.lineWidth = 3;
  for (let x = 0.6; x < Lm - 1; x += 1.6) for (const y of [0.35, Wm - 0.35]) { g.beginPath(); g.moveTo(P(x), P(y)); g.quadraticCurveTo(P(x + 0.8), P(y + (y < 1 ? 0.5 : -0.5)), P(x + 1.6), P(y)); g.stroke(); }
  return c;
}
/** hall cove texture: festoons of husks on the cove (white on ground) */
export function hallCoveTex(ground = '#eef0e6') {
  const { c, g } = canvas(512, 128);
  g.fillStyle = ground; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#ffffff'; g.lineWidth = 4;
  for (let x = 0; x < 512; x += 256) { g.beginPath(); g.moveTo(x, 40); g.quadraticCurveTo(x + 128, 130, x + 256, 40); g.stroke(); g.beginPath(); g.moveTo(x + 128, 20); g.lineTo(x + 128, 70); g.stroke(); for (let k = 0; k < 9; k++) { const t = k / 8; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x + 256 * t, 40 + 90 * t * (1 - t) * 1.0, 5, 3, 0, 0, Math.PI * 2); g.fill(); } }
  return tex(c, { wrap: true });
}

// ------------------------------------------------------------------------------------------------ misc
export function noticeTex() {
  const { c, g } = canvas(256, 192);
  g.fillStyle = '#8a6a44'; g.fillRect(0, 0, 256, 192); g.fillStyle = '#c8a878'; g.fillRect(8, 8, 240, 176);
  const R = rng(7), cols = ['#f4f0e0', '#fff6a8', '#f0c8d8', '#cde8f4', '#ffffff'];
  for (let i = 0; i < 9; i++) { const x = 14 + R() * 180, y = 14 + R() * 120, w = 40 + R() * 30, h = 40 + R() * 30; g.fillStyle = cols[i % 5]; g.fillRect(x, y, w, h); g.fillStyle = '#333'; for (let k = 0; k < 5; k++) g.fillRect(x + 4, y + 6 + k * 7, w * (0.4 + R() * 0.5), 2); g.fillStyle = '#c03030'; g.beginPath(); g.arc(x + w / 2, y + 3, 2.5, 0, Math.PI * 2); g.fill(); }
  return tex(c, { wrap: false });
}
/** pigeonholes: grid of cubbies with letters/name labels */
export function pidgeTex(cols = 10, rows = 8) {
  const { c, g } = canvas(512, 384);
  const cw = 512 / cols, ch = 384 / rows, R = rng(31);
  g.fillStyle = '#c4904c'; g.fillRect(0, 0, 512, 384);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    g.fillStyle = '#2a1c10'; g.fillRect(x * cw + 4, y * ch + 4, cw - 8, ch - 14);
    if (R() < 0.55) { g.fillStyle = ['#f4f0e4', '#e8dcc0', '#fff', '#d8e4f0'][Math.floor(R() * 4)]; g.fillRect(x * cw + 8, y * ch + ch - 22 - R() * 8, cw - 16, 10 + R() * 6); }
    g.fillStyle = '#f4ecd8'; g.fillRect(x * cw + 10, y * ch + ch - 10, cw - 20, 6);
  }
  return tex(c, { wrap: false });
}
/** the quad seen from a Terrace window (backdrop): lawn, gravel, the Cottages' roofs, sky */
export function quadView(night = false) {
  const { c, g } = canvas(512, 384);
  const sky = g.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, '#8fb4dc'); sky.addColorStop(1, '#dfe8ef');
  g.fillStyle = sky; g.fillRect(0, 0, 512, 384);
  // trees beyond
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#4a6a3a' : '#5a7a44'; g.beginPath(); g.arc(i * 40 + 10, 175, 36, 0, Math.PI * 2); g.fill(); }
  // Cottages: rubble walls, stone slate roofs
  for (let i = 0; i < 6; i++) { const x = i * 86; g.fillStyle = '#b8a888'; g.fillRect(x, 190, 86, 50); g.fillStyle = '#7a7266'; g.beginPath(); g.moveTo(x - 4, 192); g.lineTo(x + 43, 160); g.lineTo(x + 90, 192); g.fill(); g.fillStyle = '#3a3a36'; g.fillRect(x + 20, 205, 14, 14); g.fillRect(x + 56, 205, 14, 14); g.fillStyle = '#5a4030'; g.fillRect(x + 38, 215, 10, 25); }
  // striped lawn + gravel path
  g.fillStyle = '#d8c8a0'; g.fillRect(0, 240, 512, 20);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#5f9a46' : '#6eac52'; g.fillRect(0, 260 + i * 16, 512, 16); }
  if (night) { g.fillStyle = 'rgba(5,10,30,0.82)'; g.fillRect(0, 0, 512, 384); g.fillStyle = '#ffd890'; for (let i = 0; i < 6; i++) if (i % 2 === 0) { g.fillRect(i * 86 + 20, 205, 14, 14); } }
  return tex(c, { wrap: false });
}
export function bookSpines(seed = 41) {
  const { c, g } = canvas(512, 256);
  const R = rng(seed), rows = 4, rh = 64;
  g.fillStyle = '#2a1c12'; g.fillRect(0, 0, 512, 256);
  for (let r = 0; r < rows; r++) {
    let x = 2;
    while (x < 510) {
      const w = 6 + R() * 10, h = rh * (0.7 + R() * 0.25);
      const v = R(); const col = v < 0.5 ? `rgb(${100 + R() * 50 | 0},${60 + R() * 30 | 0},${30 + R() * 20 | 0})` : v < 0.75 ? `rgb(${120 + R() * 30 | 0},${40 + R() * 20 | 0},${30 + R() * 10 | 0})` : `rgb(${150 + R() * 40 | 0},${120 + R() * 30 | 0},${80 + R() * 20 | 0})`;
      g.fillStyle = col; g.fillRect(x, r * rh + rh - h - 3, w - 1, h);
      g.fillStyle = 'rgba(220,180,90,0.7)'; g.fillRect(x + 1, r * rh + rh - h + 4, w - 3, 2); g.fillRect(x + 1, r * rh + rh - h + 10, w - 3, 1);
      x += w;
    }
    g.fillStyle = '#e8e2d4'; g.fillRect(0, r * rh + rh - 3, 512, 3);
  }
  return tex(c, { wrap: true });
}
/** brass wire grille overlay (alpha) for the library bookcases */
export function grilleTex() {
  const { c, g } = canvas(64, 64);
  g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(200,160,70,0.9)'; g.lineWidth = 1.6;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
  return tex(c, { wrap: true });
}

// Memory pass: every picture above is painted from its arguments alone (seeded), so it can be painted again by calling
// its function again — which lets its canvas go once the texture is on the card (world/_tex_keep.js). The functions
// are replaced by wrapped ones here; a caller gets the same texture as before.
// (chapelWall, chapelCeiling and hallCeiling return canvases: theirs remember the call, and tex() above takes it from there)
const remembering = (make) => function (...args) { const c = make.apply(this, args); if (c && typeof c === 'object') c.__paint = () => make.apply(this, args); return c; };
chapelWall = remembering(chapelWall); chapelCeiling = remembering(chapelCeiling); hallCeiling = remembering(hallCeiling);
shaftTex = repaintableFn(shaftTex); domeTex = repaintableFn(domeTex); coveTex = repaintableFn(coveTex); mosaicTex = repaintableFn(mosaicTex); glassAtlas = repaintableFn(glassAtlas); portraitAtlas = repaintableFn(portraitAtlas); plasterPanel = repaintableFn(plasterPanel); hallCoveTex = repaintableFn(hallCoveTex); noticeTex = repaintableFn(noticeTex); pidgeTex = repaintableFn(pidgeTex); quadView = repaintableFn(quadView); bookSpines = repaintableFn(bookSpines); grilleTex = repaintableFn(grilleTex);
