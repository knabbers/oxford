// Purple Turtle — canvas textures: one 1024² sign/poster atlas shared by the exterior and the club, a sticky cellar
// floor, a soft glow sprite. All club-night names, posters and the turtle logo are invented (no source shows them).
import * as THREE from 'three';
import { repaintableAll } from '../world/_tex_keep.js';
import { canvasScale, hiAniso } from '../world/_surf_detail.js';   // texture pass 2: larger canvases and 16x anisotropy on the top tier only
import { SHOTS } from './_pt_logic.js';

const W = 1024, H = 1024;
/** atlas regions in canvas pixels [x, y, w, h] */
export const REG = {
  fascia: [0, 0, 512, 96], vanSign: [512, 0, 512, 80],
  turtle: [0, 96, 256, 256], neon: [256, 96, 256, 256], menu: [512, 96, 512, 384],
  poster0: [0, 352, 128, 224], poster1: [128, 352, 128, 224], poster2: [256, 352, 128, 224], poster3: [384, 352, 128, 224],
  stairs: [0, 576, 192, 352], closed: [192, 576, 256, 128], smoking: [192, 704, 256, 64], cloak: [192, 768, 256, 64],
  exit: [192, 832, 128, 48], ladies: [320, 832, 128, 64], gents: [448, 832, 128, 64], hatch: [448, 576, 256, 128],
  dj: [512, 480, 256, 96], jukebox: [768, 480, 128, 192], foos: [896, 480, 128, 96], crests: [512, 704, 512, 160],
  head: [192, 896, 256, 48], price: [704, 576, 192, 128], mural: [0, 928, 512, 96], cashdesk: [512, 864, 256, 80],
};
/** uv rect [u0, v0(top), u1, v1(bottom)] for GB.wall/flat */
export function uvRect(name, inset = 0) {
  const [x, y, w, h] = REG[name];
  return [(x + inset) / W, 1 - (y + inset) / H, (x + w - inset) / W, 1 - (y + h - inset) / H];
}

let atlas = null, floorTex = null, glowTex = null, beamTex = null;

function turtle(c, cx, cy, r, shell = '#3a7a3a', body = '#7ac070', line = '#103010') {
  c.save(); c.lineWidth = r * 0.06; c.strokeStyle = line;
  c.fillStyle = body;
  for (const [a, s] of [[-0.75, 1], [0.75, 1], [-2.4, 0.9], [2.4, 0.9]]) { c.beginPath(); c.ellipse(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.5, r * 0.2 * s, r * 0.13 * s, a, 0, 6.283); c.fill(); c.stroke(); }
  c.beginPath(); c.ellipse(cx + r * 0.78, cy - r * 0.05, r * 0.24, r * 0.19, 0, 0, 6.283); c.fill(); c.stroke();
  c.fillStyle = '#111'; c.beginPath(); c.arc(cx + r * 0.86, cy - r * 0.11, r * 0.04, 0, 6.283); c.fill();
  c.strokeStyle = '#111'; c.beginPath(); c.arc(cx + r * 0.84, cy - r * 0.02, r * 0.07, 0.2, 1.4); c.stroke();
  c.strokeStyle = line; c.fillStyle = shell; c.beginPath(); c.ellipse(cx, cy, r * 0.62, r * 0.45, 0, Math.PI, 0); c.lineTo(cx + r * 0.62, cy + r * 0.05); c.lineTo(cx - r * 0.62, cy + r * 0.05); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.45)';
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(cx + i * r * 0.22, cy + r * 0.04); c.lineTo(cx + i * r * 0.18, cy - r * 0.38 + Math.abs(i) * r * 0.08); c.stroke(); }
  c.beginPath(); c.ellipse(cx, cy - r * 0.08, r * 0.5, r * 0.18, 0, Math.PI, 0); c.stroke();
  c.restore();
}
function text(c, s, x, y, font, fill, align = 'center', glow = null) {
  c.font = font; c.textAlign = align; c.textBaseline = 'middle';
  if (glow) { c.shadowColor = glow; c.shadowBlur = 14; }
  c.fillStyle = fill; c.fillText(s, x, y); c.shadowBlur = 0;
}
function paintAtlas() {
  const cv = document.createElement('canvas'), K = canvasScale(W, H); cv.width = W * K; cv.height = H * K;   // (texture pass 2: twice the pixels on the top tier)
  const c = cv.getContext('2d'); if (K !== 1) c.scale(K, K);
  c.fillStyle = '#222'; c.fillRect(0, 0, W, H);
  const R = (k) => REG[k];
  // fascia
  { const [x, y, w, h] = R('fascia'); const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#4b1a6e'); g.addColorStop(1, '#2a0a40'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.strokeStyle = '#d8b8f0'; c.lineWidth = 4; c.strokeRect(x + 4, y + 4, w - 8, h - 8);
    turtle(c, x + 60, y + 52, 46); turtle(c, x + w - 60, y + 52, 46);
    text(c, 'PURPLE TURTLE', x + w / 2, y + h / 2 + 2, 'bold 54px Georgia, serif', '#f4e6ff', 'center', '#c070ff'); }
  // van sign
  { const [x, y, w, h] = R('vanSign'); c.fillStyle = '#f2f2ee'; c.fillRect(x, y, w, h); c.fillStyle = '#c81818'; c.fillRect(x, y + h - 14, w, 14);
    text(c, 'KEBABS · BURGERS · CHEESY CHIPS', x + w / 2, y + 34, 'bold 34px Arial, sans-serif', '#c81818'); }
  // round turtle sign
  { const [x, y, w] = R('turtle'); c.fillStyle = '#2a0a40'; c.fillRect(x, y, w, w); c.fillStyle = '#6a2a9a'; c.beginPath(); c.arc(x + w / 2, y + w / 2, w * 0.47, 0, 6.283); c.fill();
    c.strokeStyle = '#e8d0ff'; c.lineWidth = 6; c.stroke(); turtle(c, x + w / 2 - 10, y + w / 2 + 10, 92, '#4a2a8a', '#a080e0', '#1a0830');
    text(c, 'PURPLE', x + w / 2, y + 44, 'bold 30px Georgia', '#fff'); text(c, 'TURTLE', x + w / 2, y + w - 36, 'bold 30px Georgia', '#fff'); }
  // neon turtle (dance floor wall)
  { const [x, y, w] = R('neon'); c.fillStyle = '#000'; c.fillRect(x, y, w, w); c.shadowColor = '#d040ff'; c.shadowBlur = 18;
    c.strokeStyle = '#f080ff'; c.lineWidth = 7; c.beginPath(); c.ellipse(x + 118, y + 140, 78, 56, 0, Math.PI, 0); c.lineTo(x + 40, y + 140); c.stroke();
    c.beginPath(); c.arc(x + 214, y + 128, 22, 0, 6.283); c.stroke();
    for (const lx of [70, 160]) { c.beginPath(); c.moveTo(x + lx, y + 142); c.lineTo(x + lx - 8, y + 176); c.stroke(); }
    c.strokeStyle = '#60f0ff'; c.lineWidth = 5; c.beginPath(); c.moveTo(x + 30, y + 214); c.lineTo(x + 226, y + 214); c.stroke(); c.shadowBlur = 0;
    text(c, 'turtle', x + w / 2, y + 236, 'italic bold 30px Georgia', '#7ff6ff', 'center', '#20e0ff'); }
  // shots menu
  { const [x, y, w, h] = R('menu'); c.fillStyle = '#101010'; c.fillRect(x, y, w, h); c.strokeStyle = '#b07ad8'; c.lineWidth = 4; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
    text(c, 'COLLEGE SHOTS  £1.50', x + w / 2, y + 26, 'bold 28px Arial', '#ffd84a', 'center', '#ff9a20');
    c.font = '13px Arial'; c.textAlign = 'left';
    const col = 2, rows = Math.ceil(SHOTS.length / col);
    SHOTS.forEach((s, i) => { const cx = x + 14 + Math.floor(i / rows) * (w / 2), cy = y + 56 + (i % rows) * 15.6;
      c.fillStyle = '#' + s.color.toString(16).padStart(6, '0'); c.fillRect(cx, cy - 5, 9, 9);
      c.fillStyle = '#e8e0f0'; c.fillText(`${s.college}: ${s.name}`, cx + 14, cy); });
    text(c, 'PINT £2.50 · VODKA-MIXER £2 · JÄGERBOMB £2.50 · COCKTAIL PINTS £5', x + w / 2, y + h - 14, 'bold 13px Arial', '#9ef0ff'); }
  // posters (invented club nights)
  const posters = [['MONDAY', 'CHEESE', '& CHIPS', '#f0d020', '#d02060'], ['WEDNESDAY', 'INDIE', 'DISCO', '#20c0e0', '#1a1a1a'], ['FRIDAY', 'TURTLE', 'TAKEOVER', '#ff60c0', '#3a0a5a'], ['SATURDAY', '£1.50', 'SHOTS', '#80ff60', '#0a3a1a']];
  posters.forEach(([d, a, b, fg, bg], i) => { const [x, y, w, h] = R('poster' + i); c.fillStyle = bg; c.fillRect(x + 2, y + 2, w - 4, h - 4);
    c.fillStyle = 'rgba(255,255,255,0.1)'; for (let k = 0; k < 6; k++) c.fillRect(x + 2, y + 2 + k * 36, w - 4, 12);
    text(c, d, x + w / 2, y + 26, 'bold 18px Arial', '#fff'); text(c, a, x + w / 2, y + 84, 'bold 30px Impact, Arial', fg); text(c, b, x + w / 2, y + 120, 'bold 22px Impact, Arial', fg);
    turtle(c, x + w / 2, y + 172, 30, '#4a2a8a', '#a080e0', '#000'); text(c, 'PURPLE TURTLE', x + w / 2, y + 206, 'bold 12px Arial', '#fff'); });
  // steps going down, seen through the open door
  { const [x, y, w, h] = R('stairs'); const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#1a0626'); g.addColorStop(0.6, '#5a1a8a'); g.addColorStop(1, '#2a0a3a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    for (let i = 0; i < 9; i++) { const t = i / 9, yy = y + h * (0.45 + t * 0.55), ww = w * (0.35 + t * 0.65); c.fillStyle = `rgba(${40 + i * 12},${20 + i * 5},${60 + i * 12},1)`; c.fillRect(x + (w - ww) / 2, yy, ww, h * 0.06); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x + (w - ww) / 2, yy + h * 0.045, ww, h * 0.015); }
    c.fillStyle = 'rgba(255,120,255,0.35)'; c.beginPath(); c.ellipse(x + w / 2, y + h * 0.38, w * 0.25, h * 0.08, 0, 0, 6.283); c.fill();
    c.strokeStyle = '#c8c8c8'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 14, y + h * 0.42); c.lineTo(x + 4, y + h); c.moveTo(x + w - 14, y + h * 0.42); c.lineTo(x + w - 4, y + h); c.stroke(); }
  // closed sign
  { const [x, y, w, h] = R('closed'); c.fillStyle = '#f0ece0'; c.fillRect(x, y, w, h); c.strokeStyle = '#4b1a6e'; c.lineWidth = 6; c.strokeRect(x + 5, y + 5, w - 10, h - 10);
    text(c, 'CLOSED', x + w / 2, y + 40, 'bold 40px Georgia', '#4b1a6e'); text(c, 'Open 9.30pm – 3am', x + w / 2, y + 84, '22px Georgia', '#222'); text(c, 'Union members free', x + w / 2, y + 108, 'italic 16px Georgia', '#555'); }
  for (const [k, s, bg, fg] of [['smoking', 'SMOKING AREA', '#1a3a1a', '#e0f0e0'], ['cloak', 'CLOAKROOM  £1', '#2a0a40', '#f0e0ff'], ['exit', 'EXIT', '#0a8a2a', '#ffffff'], ['ladies', 'LADIES', '#5a1a5a', '#ffd0f0'], ['gents', 'GENTS', '#1a2a5a', '#d0e0ff'], ['head', 'MIND YOUR HEAD', '#e8c020', '#111']]) {
    const [x, y, w, h] = R(k); c.fillStyle = bg; c.fillRect(x, y, w, h); text(c, s, x + w / 2, y + h / 2 + 1, `bold ${Math.round(h * 0.5)}px Arial`, fg);
  }
  // van hatch interior (lit kitchen)
  { const [x, y, w, h] = R('hatch'); const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#fff8e0'); g.addColorStop(1, '#d8c8a0'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#b0b0b0'; c.fillRect(x + 10, y + h - 40, w - 20, 26); c.fillStyle = '#8a4a1a'; c.fillRect(x + 30, y + 20, 26, 70); c.fillStyle = '#c86a2a'; c.fillRect(x + 34, y + 26, 18, 58);
    text(c, 'Chips £2  Cheesy chips £2.50  Doner £4', x + w / 2 + 20, y + 24, 'bold 13px Arial', '#c81818'); }
  // DJ booth front
  { const [x, y, w, h] = R('dj'); c.fillStyle = '#0a0a0a'; c.fillRect(x, y, w, h); text(c, 'TURTLE  SOUND', x + w / 2, y + h / 2, 'bold 34px Impact, Arial', '#c060ff', 'center', '#a020ff'); }
  // jukebox front
  { const [x, y, w, h] = R('jukebox'); const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#ff60a0'); g.addColorStop(0.5, '#ffd040'); g.addColorStop(1, '#40d0ff'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#1a1020'; c.beginPath(); c.arc(x + w / 2, y + 60, 46, Math.PI, 0); c.lineTo(x + w / 2 + 46, y + 120); c.lineTo(x + w / 2 - 46, y + 120); c.fill();
    c.fillStyle = '#f0e8d0'; for (let i = 0; i < 5; i++) c.fillRect(x + 22, y + 66 + i * 10, w - 44, 6); text(c, 'JUKEBOX', x + w / 2, y + 150, 'bold 20px Arial', '#1a1020'); text(c, '£1 a song', x + w / 2, y + 172, '14px Arial', '#1a1020'); }
  // table football pitch
  { const [x, y, w, h] = R('foos'); c.fillStyle = '#2a8a3a'; c.fillRect(x, y, w, h); c.strokeStyle = '#eee'; c.lineWidth = 2; c.strokeRect(x + 4, y + 4, w - 8, h - 8); c.beginPath(); c.moveTo(x + w / 2, y + 4); c.lineTo(x + w / 2, y + h - 4); c.stroke(); c.beginPath(); c.arc(x + w / 2, y + h / 2, 14, 0, 6.283); c.stroke(); }
  // college crest strip (stylised shields, not real heraldry)
  { const [x, y, w, h] = R('crests'); c.fillStyle = '#1a1020'; c.fillRect(x, y, w, h); const n = 12;
    for (let i = 0; i < n; i++) { const s = SHOTS[(i * 3) % SHOTS.length], cx = x + (i + 0.5) * (w / n), cy = y + 62; c.fillStyle = '#' + s.color.toString(16).padStart(6, '0');
      c.beginPath(); c.moveTo(cx - 17, cy - 30); c.lineTo(cx + 17, cy - 30); c.lineTo(cx + 17, cy + 4); c.quadraticCurveTo(cx, cy + 30, cx - 17, cy + 4); c.closePath(); c.fill(); c.strokeStyle = '#e8d8a0'; c.lineWidth = 2; c.stroke();
      c.save(); c.translate(cx, cy + 50); c.rotate(-0.5); text(c, s.college.split(' ')[0], 0, 0, 'bold 11px Arial', '#e8d8ff'); c.restore(); }
    text(c, 'WHAT COLLEGE ARE YOU AT?', x + w / 2, y + h - 14, 'bold 18px Impact, Arial', '#ffd84a'); }
  // price board at the door
  { const [x, y, w, h] = R('price'); c.fillStyle = '#111'; c.fillRect(x, y, w, h); c.strokeStyle = '#b07ad8'; c.lineWidth = 3; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
    text(c, 'ENTRY £3', x + w / 2, y + 30, 'bold 26px Arial', '#ffd84a'); text(c, 'FREE before 10.30', x + w / 2, y + 62, '17px Arial', '#e8e0f0'); text(c, 'Union members free', x + w / 2, y + 86, '15px Arial', '#c0a0e0'); text(c, 'Last entry 2.30am', x + w / 2, y + 108, '14px Arial', '#9ef0ff'); }
  // mural: turtles doing the conga
  { const [x, y, w, h] = R('mural'); const g = c.createLinearGradient(x, y, x + w, y); g.addColorStop(0, '#3a0a5a'); g.addColorStop(1, '#0a3a5a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    for (let i = 0; i < 6; i++) turtle(c, x + 50 + i * 80, y + 56 + Math.sin(i) * 6, 30, ['#4a2a8a', '#2a6a3a', '#8a2a5a'][i % 3], '#c0a0f0', '#000');
    text(c, 'Turtle power since 1998', x + w - 120, y + 16, 'italic 14px Georgia', '#f0e0ff'); }
  // cash desk front
  { const [x, y, w, h] = R('cashdesk'); c.fillStyle = '#2a0a40'; c.fillRect(x, y, w, h); text(c, 'PAY HERE · HAND STAMP', x + w / 2, y + h / 2, 'bold 20px Arial', '#f0e0ff'); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = hiAniso(4);
  return t;
}
export function ptAtlas() { if (!atlas) atlas = repaintableAll(paintAtlas(), paintAtlas, 'purple turtle atlas'); return atlas; }      // (memory pass: world/_tex_keep.js)

/** sticky dark cellar floor (stone flags with spills), 2 m per repeat */
export function ptFloor() {
  if (floorTex) return floorTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
  c.fillStyle = '#3a332e'; c.fillRect(0, 0, 256, 256);
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 54 + Math.floor(r() * 16); c.fillStyle = `rgb(${v + 4},${v},${v - 4})`; c.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); }
  for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(${60 + r() * 40},${30 + r() * 20},${10},${0.15 + r() * 0.2})`; c.beginPath(); c.ellipse(r() * 256, r() * 256, 6 + r() * 22, 4 + r() * 14, r() * 3, 0, 6.283); c.fill(); }
  for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(0,0,0,${r() * 0.25})`; c.fillRect(r() * 256, r() * 256, 2, 2); }
  floorTex = new THREE.CanvasTexture(cv); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(0.5, 0.5); floorTex.colorSpace = THREE.SRGBColorSpace;
  return floorTex;
}
/** radial white -> transparent (haze, light pools, glows) */
export function ptGlow() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(cv); return glowTex;
}
/** vertical beam fade (bright at the top, gone at the bottom, soft edges) */
export function ptBeam() {
  if (beamTex) return beamTex;
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d');
  for (let y = 0; y < 128; y++) { const a = Math.pow(1 - y / 128, 1.5) * 0.9; const g = c.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, y, 64, 1); }
  beamTex = new THREE.CanvasTexture(cv); return beamTex;
}
