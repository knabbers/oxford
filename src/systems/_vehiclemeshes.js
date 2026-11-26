// Procedural vehicle meshes shared by systems/vehicles.js and systems/traffic.js (underscore: not auto-loaded).
// Everything is built once per type from primitives into vertex-coloured merged geometries that all sample ONE small
// canvas atlas (glass, wheel faces, plates, lamps, blinds, door seams ...; texel (0,0) region is white = plain colour):
//   staticParts(type)      -> { tint, rest, all }  merged, rest pose; `all` + MATS.parked colours the tinted part per instance
//   makeLive(type, color)  -> animated rig. Bikes: wheels/handlebars/cranks as separate nodes. Cars: ONE draw; wheel spin,
//                             steering and lamps are driven in the vertex shader from three per-rig floats (rig.drive)
//   makeGhost(type)        -> one cheap static mesh (remote players' vehicles)
// Local frame of every vehicle: origin on the ground (punts: on the waterline) at the middle, facing +z, +x = LEFT side.
// Body styles: a type's collision size, wheelbase and seat never change, but some colours are a different body on the same
// chassis (styleOf): car_hatch -> hatchback | city car, car_saloon -> saloon | estate, taxi -> black cab | private-hire
// saloon, bus -> double | single decker. Colour is what multiplayer sends, so everyone sees the same body.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BEAMS } from '../world/lightmap.js';
import { addSkySheen } from '../world/materials.js';

const TINT = -1;
const C = {
  black: 0x161616, tyre: 0x1b1b1b, steel: 0x9aa0a6, chrome: 0xc9ccd0, dark: 0x2a2a2a, glass: 0x1d2a33,
  brown: 0x4a2e1a, wicker: 0xa8824a, grip: 0x2b1d14, plateW: 0xeeeeea, plateY: 0xf0c400, head: 0xfff1c8, tail: 0xc81212,
  amber: 0xffb43a, cream: 0xe9dfc5, skin: 0xd9a47a, hair: 0x2a1b10, varnish: 0x7a4a24, rail: 0x55321a, floor: 0x9c6b3c,
  pole: 0xb8955e, shoe: 0x55524c, rust: 0x6a3f22, mud: 0x4d3b2a, signOff: 0x34332e, white: 0xffffff, under: 0x101112,
  roofW: 0xe4e4e0, refl: 0xff7a1a, reflR: 0xb01010,
};

// ---------------------------------------------------------------- type table
export const TYPES = {
  bike_roadster: { kind: 'bike', name: 'sit-up-and-beg bicycle', L: 1.8, W: 0.6, R: 0.35, wb: 1.12, radius: 0.4, camDist: 1.0, prompt: 'Ride bike',
    colors: [0x1f4d36, 0x151515, 0xe2d6b8, 0x6b1f2a, 0x8fb3c9, 0x2a3a6a] },
  bike_road: { kind: 'bike', name: 'road bike', L: 1.7, W: 0.45, R: 0.34, wb: 1.0, radius: 0.4, camDist: 1.0, prompt: 'Ride bike',
    colors: [0xb32020, 0xeeeeee, 0x1d4fa0, 0x111111, 0xd8b81c, 0x1f8a7a] },
  bike_mtb: { kind: 'bike', name: 'battered mountain bike', L: 1.8, W: 0.65, R: 0.33, wb: 1.08, radius: 0.4, camDist: 1.0, prompt: 'Ride bike',
    colors: [0xa85a2a, 0x5a5550, 0x5d4a6a, 0x5a6a3a, 0x7a2020] },
  car_hatch: { kind: 'car', name: 'hatchback', L: 3.9, W: 1.72, R: 0.3, wb: 2.45, radius: 0.86, camDist: 1.45, prompt: 'Drive',
    colors: [0xb8bcc2, 0x8a1c1c, 0x1f3f7a, 0x2c2c2c, 0xe8e8e4, 0x3a6a4a, 0xc9a227], seat: { x: -0.36, y: 0.42, z: -0.15 },
    styles: { 0xd8452a: 'city', 0x7fb6d9: 'city', 0xf2efe6: 'city', 0x3d3f45: 'city' } },
  car_saloon: { kind: 'car', name: 'saloon', L: 4.6, W: 1.78, R: 0.31, wb: 2.7, radius: 0.89, camDist: 1.5, prompt: 'Drive',
    colors: [0x1c1c1c, 0x6d7177, 0x1e2a4a, 0xd8d8d2, 0x5a1a22, 0x3a4a3a], seat: { x: -0.37, y: 0.42, z: -0.05 },
    styles: { 0x2f5a3a: 'estate', 0x7d8288: 'estate', 0x23395d: 'estate', 0x8c2f2a: 'estate' } },
  taxi: { kind: 'car', name: 'black cab', L: 4.55, W: 1.8, R: 0.33, wb: 2.88, radius: 0.9, camDist: 1.55, prompt: 'Drive',
    colors: [0x111111, 0x111111, 0x111111, 0x3a1020, 0x1a2a40], seat: { x: -0.38, y: 0.42, z: 0.35 },
    styles: { 0xb9bdc2: 'minicab', 0xe6e6e2: 'minicab', 0x27344f: 'minicab' } },
  van: { kind: 'car', name: 'white van', L: 5.3, W: 2.0, R: 0.34, wb: 3.3, radius: 1.0, camDist: 1.75, prompt: 'Drive',
    colors: [0xeeeeec, 0xeeeeec, 0xeeeeec, 0xb9bdc2, 0x1d3f7a, 0xa01818], seat: { x: -0.45, y: 0.82, z: 0.8 } },
  bus: { kind: 'car', name: 'double-decker bus', L: 10.6, W: 2.52, R: 0.5, wb: 5.6, radius: 1.26, camDist: 2.6, prompt: 'Drive',
    colors: [0x9a1b2a, 0x1e5a8a, 0x2b6b3c], seat: { x: -0.75, y: 0.95, z: 4.35 },
    styles: { 0xc2571a: 'bus1', 0x4a2a7a: 'bus1' } },
  punt: { kind: 'punt', name: 'punt', L: 7.3, W: 0.9, R: 0, wb: 0, radius: 0.45, camDist: 1.6, prompt: 'Punt',
    colors: [0x2a4a7a, 0x7a1f2a, 0x2f5a3a, 0xb89a50, 0x6a2a6a] },
};
// `colors` = the base body (what parked instances use: one geometry per pool); `trafficColors` adds the other body styles
for (const t of Object.keys(TYPES)) { const T = TYPES[t]; T.trafficColors = T.styles ? T.colors.concat(Object.keys(T.styles).map(Number)) : T.colors; }
export const BIKE_TYPES = ['bike_roadster', 'bike_road', 'bike_mtb'];
export const CAR_TYPES = ['car_hatch', 'car_saloon', 'taxi', 'van', 'bus'];
const BASE_STYLE = { car_hatch: 'hatch', car_saloon: 'saloon', taxi: 'cab', van: 'van', bus: 'bus' };
/** Which body a (type, colour) is. Unknown colours (police white, a mod's own colour) are the base body. */
export function styleOf(type, hex) { const T = TYPES[type]; return (T && T.styles && T.styles[hex]) || BASE_STYLE[type] || null; }

// ---------------------------------------------------------------- the shared atlas (one 1024 x 1024 canvas)
const AW = 1024, AH = 1024, GUT = 6;
const TILES = {};
let _ax = 0, _ay = 0, _ah = 0;
function defTile(name, w, h, paint) {
  if (_ax + w + GUT > AW) { _ax = 0; _ay += _ah + GUT; _ah = 0; }
  const x = _ax + GUT / 2, y = _ay + GUT / 2;
  TILES[name] = { x, y, w, h, paint, uv: [(x + 0.75) / AW, 1 - (y + h - 0.75) / AH, (x + w - 0.75) / AW, 1 - (y + 0.75) / AH] };
  _ax += w + GUT; _ah = Math.max(_ah, h);
  if (_ay + _ah > AH) console.warn('[vehicles] atlas overflow at', name);
}
/** Atlas uv of a point (s, t) in a tile: s 0..1 left -> right, t 0..1 BOTTOM -> top of the painted tile. */
function tuv(name, s, t) { const r = TILES[name].uv; return [r[0] + (r[2] - r[0]) * s, r[1] + (r[3] - r[1]) * t]; }
const bg = (ctx, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(-3, -3, w + 6, h + 6); };
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

function pGlass(ctx, w, h, inside, frame = 3) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7f9aab'); g.addColorStop(0.28, '#4d6676'); g.addColorStop(0.6, '#2a3944'); g.addColorStop(1, '#161d23');   // (car-fidelity pass: dark tinted glass, the tone of the real panes over a dark cabin)
  bg(ctx, w, h, g);
  if (inside) { ctx.fillStyle = 'rgba(9,13,17,0.5)'; inside(ctx, w, h); }
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (const [a, b2] of [[0.12, 0.2], [0.26, 0.29], [0.7, 0.8]]) { ctx.beginPath(); ctx.moveTo(w * a + h * 0.5, -3); ctx.lineTo(w * b2 + h * 0.5, -3); ctx.lineTo(w * b2 - h * 0.5, h + 3); ctx.lineTo(w * a - h * 0.5, h + 3); ctx.fill(); }
  if (frame) { ctx.fillStyle = '#0b0c0d'; ctx.fillRect(-3, -3, w + 6, frame + 3); ctx.fillRect(-3, h - frame, w + 6, frame + 3); }
}
const seatShape = (ctx, x, y, sw, sh) => { rr(ctx, x - sw * 0.38, y - sh, sw * 0.76, sh * 0.34, sw * 0.2); ctx.fill(); rr(ctx, x - sw / 2, y - sh * 0.6, sw, sh * 0.7, sw * 0.18); ctx.fill(); };
const person = (ctx, x, y, s) => { ctx.fillStyle = 'rgba(52,40,34,0.92)'; ctx.beginPath(); ctx.arc(x, y - s * 1.25, s * 0.42, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(22,26,34,0.92)'; rr(ctx, x - s * 0.75, y - s * 0.8, s * 1.5, s * 1.3, s * 0.35); ctx.fill(); };
function pSideGlass(ctx, w, h, driver, bars) {
  pGlass(ctx, w, h, (c) => {
    seatShape(c, w * 0.6, h * 1.05, w * 0.07, h * 0.8); seatShape(c, w * 0.27, h * 1.05, w * 0.07, h * 0.74);
    c.beginPath(); c.ellipse(w * 0.75, h * 0.86, w * 0.012, h * 0.2, 0.5, 0, 7); c.fill();       // steering wheel, edge on
    if (driver) person(c, w * 0.64, h * 1.0, h * 0.36);
  });
  ctx.fillStyle = '#0b0c0d';
  for (const u of bars) ctx.fillRect(w * u - 4, 0, 8, h);
}
function pScreen(ctx, w, h, driver, rear) {
  pGlass(ctx, w, h, (c) => {
    for (const u of rear ? [0.25, 0.5, 0.75] : [0.27, 0.73]) seatShape(c, w * u, h * 1.06, w * 0.14, h * (rear ? 0.62 : 0.8));
    if (!rear) { c.fillRect(0, h * 0.84, w, h * 0.2); c.fillRect(w * 0.45, h * 0.1, w * 0.1, h * 0.09); }
    if (driver) person(c, w * 0.27, h * 1.0, h * 0.34);
  }, 4);
  if (rear) { ctx.strokeStyle = 'rgba(150,80,40,0.28)'; ctx.lineWidth = 1; for (let y = h * 0.2; y < h * 0.85; y += h * 0.085) { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(w - 4, y); ctx.stroke(); } }
  else { ctx.strokeStyle = '#0b0c0d'; ctx.lineWidth = 2; for (const u of [0.2, 0.62]) { ctx.beginPath(); ctx.moveTo(w * u, h - 3); ctx.lineTo(w * (u + 0.3), h * 0.8); ctx.stroke(); } }
}
function pWheel(ctx, s, kind) {
  const c = s / 2;
  bg(ctx, s, s, '#17181a');
  ctx.strokeStyle = '#2b2c2f'; ctx.lineWidth = s * 0.02; for (const r of [0.93, 0.8]) { ctx.beginPath(); ctx.arc(c, c, c * r, 0, 7); ctx.stroke(); }
  const rim = c * 0.66;
  if (kind === 'alloy') {
    ctx.fillStyle = '#0d0e10'; ctx.beginPath(); ctx.arc(c, c, rim, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a3d42'; ctx.beginPath(); ctx.arc(c, c, rim * 0.5, 0, 7); ctx.fill();        // brake disc
    ctx.fillStyle = '#a3a8ae';
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.save(); ctx.translate(c, c); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-rim * 0.13, 0); ctx.lineTo(-rim * 0.2, -rim * 0.97); ctx.lineTo(rim * 0.2, -rim * 0.97); ctx.lineTo(rim * 0.13, 0); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = '#b3b8be'; ctx.lineWidth = s * 0.045; ctx.beginPath(); ctx.arc(c, c, rim * 0.97, 0, 7); ctx.stroke();
    ctx.fillStyle = '#8f949a'; ctx.beginPath(); ctx.arc(c, c, rim * 0.24, 0, 7); ctx.fill();
    ctx.fillStyle = '#5b5f65'; ctx.beginPath(); ctx.arc(c, c, rim * 0.09, 0, 7); ctx.fill();
  } else {
    const bus = kind === 'bus';
    ctx.fillStyle = bus ? '#6c7075' : '#979ca2'; ctx.beginPath(); ctx.arc(c, c, rim, 0, 7); ctx.fill();
    ctx.strokeStyle = bus ? '#9a9ea3' : '#b9bdc2'; ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.arc(c, c, rim * 0.96, 0, 7); ctx.stroke();
    ctx.fillStyle = '#26282b';
    const n = bus ? 10 : 8;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; ctx.save(); ctx.translate(c, c); ctx.rotate(a);
      if (bus) { ctx.beginPath(); ctx.arc(0, -rim * 0.42, rim * 0.055, 0, 7); ctx.fill(); } else { rr(ctx, -rim * 0.09, -rim * 0.82, rim * 0.18, rim * 0.34, rim * 0.07); ctx.fill(); }
      ctx.restore(); }
    ctx.fillStyle = bus ? '#45484d' : '#7f848a'; ctx.beginPath(); ctx.arc(c, c, rim * (bus ? 0.3 : 0.27), 0, 7); ctx.fill();
    ctx.fillStyle = bus ? '#a9acb0' : '#6d7177'; ctx.beginPath(); ctx.arc(c, c, rim * 0.13, 0, 7); ctx.fill();
  }
}
function pPlate(ctx, w, h, text, yellow) {
  bg(ctx, w, h, yellow ? '#f1c40b' : '#f3f3ee');
  ctx.fillStyle = '#1b3fa0'; ctx.fillRect(-3, -3, w * 0.085 + 3, h + 6);
  ctx.fillStyle = '#121212'; ctx.font = `bold ${Math.round(h * 0.78)}px "Arial Narrow", Arial, Helvetica, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w * 0.54, h * 0.55, w * 0.84);
}
function pBlind(ctx, w, h, num, dest) {
  bg(ctx, w, h, '#0a0a0a');
  ctx.fillStyle = '#ffa41c'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(h * 0.86)}px Arial, Helvetica, sans-serif`; ctx.fillText(num, w * 0.11, h * 0.54, w * 0.19);
  ctx.font = `bold ${Math.round(h * 0.6)}px Arial, Helvetica, sans-serif`; ctx.fillText(dest, w * 0.61, h * 0.54, w * 0.72);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}

// ---------------------------------------------------------------- body styles (lofted shells)
// K rows = [z, belt y, cant-rail y, top y] from the tail (-z) to the nose: the belt is the top edge of the lower body
// (boot / window sill / bonnet edge), cant = roof side, top = centre-line silhouette. Indices: gi = side glass from..to,
// wi = windscreen top..base, ri = rear screen base..top, lf = headlamp wrap starts, lr = tail-lamp wrap ends.
const SALOON_K = [[-2.3, 0.92, 0.92, 0.94], [-2.08, 0.96, 0.96, 0.99], [-1.62, 0.97, 0.97, 1.0], [-0.95, 0.96, 1.36, 1.43], [-0.2, 0.95, 1.4, 1.46],
  [0.56, 0.94, 1.38, 1.44], [1.28, 0.94, 0.94, 0.97], [1.98, 0.88, 0.88, 0.91], [2.22, 0.8, 0.8, 0.82], [2.3, 0.67, 0.67, 0.68]];
const STY = {
  hatch: { type: 'car_hatch', L: 3.9, fa: 1.25, ra: -1.2, gi: [2, 5], wi: [4, 5], ri: [0, 2], lf: 6, lr: 1, doors: [[-0.35, 0.95]], bars: [0.46], wheel: 'wAlloy',
    K: [[-1.95, 0.9, 0.9, 0.92], [-1.76, 0.93, 1.13, 1.17], [-1.58, 0.95, 1.36, 1.42], [-0.6, 0.94, 1.42, 1.48], [0.3, 0.93, 1.39, 1.45], [1.0, 0.93, 0.93, 0.96],
      [1.62, 0.88, 0.88, 0.91], [1.87, 0.8, 0.8, 0.82], [1.95, 0.66, 0.66, 0.67]] },
  city: { type: 'car_hatch', L: 3.6, fa: 1.25, ra: -1.2, gi: [2, 5], wi: [4, 5], ri: [0, 2], lf: 6, lr: 1, doors: [[-0.3, 0.9]], bars: [0.48], wheel: 'wSteel', tz: 0.5,
    K: [[-1.8, 0.86, 0.86, 0.88], [-1.68, 0.9, 1.12, 1.17], [-1.5, 0.95, 1.42, 1.48], [-0.5, 0.95, 1.5, 1.56], [0.36, 0.93, 1.46, 1.52], [0.95, 0.93, 0.93, 0.97],
      [1.5, 0.88, 0.88, 0.92], [1.73, 0.8, 0.8, 0.83], [1.8, 0.68, 0.68, 0.69]] },
  saloon: { type: 'car_saloon', L: 4.6, fa: 1.45, ra: -1.25, gi: [3, 6], wi: [5, 6], ri: [2, 3], lf: 7, lr: 1, doors: [[-0.75, 0.2], [0.2, 1.22]], bars: [0.5], wheel: 'wAlloy', K: SALOON_K },
  estate: { type: 'car_saloon', L: 4.6, fa: 1.45, ra: -1.25, gi: [2, 5], wi: [4, 5], ri: [0, 2], lf: 6, lr: 1, doors: [[-0.75, 0.2], [0.2, 1.22]], bars: [0.37, 0.67], wheel: 'wSteel',
    K: [[-2.3, 0.9, 0.9, 0.92], [-2.2, 0.94, 1.13, 1.18], [-2.08, 0.97, 1.37, 1.44], [-0.2, 0.95, 1.41, 1.47], [0.56, 0.94, 1.38, 1.44], [1.28, 0.94, 0.94, 0.97],
      [1.98, 0.88, 0.88, 0.91], [2.22, 0.8, 0.8, 0.82], [2.3, 0.67, 0.67, 0.68]] },
  cab: { type: 'taxi', L: 4.55, fa: 1.55, ra: -1.33, gi: [2, 5], wi: [4, 5], ri: [1, 2], lf: 6, lr: 1, doors: [[-0.92, 0.22], [0.22, 1.15]], bars: [0.3, 0.55], wheel: 'wSteel',
    cantF: 0.89, roofF: 0.77, sign: 'taxiSign', sy1: 1.15,
    K: [[-2.275, 0.98, 0.98, 1.0], [-2.1, 1.04, 1.1, 1.16], [-1.8, 1.05, 1.68, 1.78], [-0.6, 1.04, 1.74, 1.84], [0.62, 1.03, 1.7, 1.8], [1.2, 1.02, 1.02, 1.06],
      [1.95, 0.97, 0.97, 1.01], [2.2, 0.9, 0.9, 0.93], [2.275, 0.82, 0.82, 0.84]] },
  minicab: { type: 'taxi', L: 4.55, fa: 1.55, ra: -1.33, gi: [3, 6], wi: [5, 6], ri: [2, 3], lf: 7, lr: 1, doors: [[-0.8, 0.22], [0.22, 1.25]], bars: [0.5], wheel: 'wAlloy', sign: 'cabSign',
    K: SALOON_K.map((k) => [k[0] * (2.275 / 2.3), k[1], k[2], k[3]]) },
  van: { type: 'van', L: 5.3, fa: 1.85, ra: -1.45, gi: [1, 3], wi: [2, 3], ri: null, lf: 4, lr: -1, doors: [[0.72, 1.74]], bars: [0.34], wheel: 'wSteel', van: true,
    cantF: 0.93, roofF: 0.85, bonF: 0.86, sy0: 0.2, sy1: 2.35, gc: 0.24, crease: 0.82,
    K: [[-2.65, 1.25, 2.2, 2.28], [0.5, 1.25, 2.22, 2.31], [0.95, 1.25, 2.14, 2.22], [1.72, 1.22, 1.22, 1.28], [2.4, 1.02, 1.02, 1.06], [2.6, 0.9, 0.9, 0.92], [2.65, 0.8, 0.8, 0.81]] },
};
for (const k of Object.keys(STY)) {
  const S = STY[k], T = TYPES[S.type];
  S.name = k; S.W = T.W; S.R = T.R; S.hl = S.L / 2; S.Ra = S.R + 0.065;
  S.gc = S.gc ?? 0.2; S.cantF = S.cantF ?? 0.85; S.roofF = S.roofF ?? 0.72; S.bonF = S.bonF ?? 0.84; S.tz = S.tz ?? 0.7;
  S.sy0 = S.sy0 ?? 0.15; S.sy1 = S.sy1 ?? 1.05; S.crease = S.crease ?? 0.55;
  // stations: the K rows plus 7 per wheel arch; a K row that lands next to an arch station moves onto it
  S.K = S.K.map((r) => r.slice());
  const zs = [];
  for (const az of [S.ra, S.fa]) for (let i = 0; i <= 6; i++) zs.push(az - S.Ra * Math.cos((Math.PI * i) / 6));
  for (const r of S.K) { let hit = false; for (const z of zs) if (Math.abs(z - r[0]) < 0.07) { r[0] = z; hit = true; break; } if (!hit) zs.push(r[0]); }
  S.zs = zs.sort((a, b) => a - b);
}
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = (t) => Math.max(0, Math.min(1, t));
function kAt(K, z) {
  if (z <= K[0][0]) return K[0];
  for (let i = 0; i < K.length - 1; i++) if (z <= K[i + 1][0]) { const a = K[i], b = K[i + 1], t = (z - a[0]) / (b[0] - a[0]); return [z, lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; }
  return K[K.length - 1];
}
/** Left half of the body cross-section at z: [[x, y] sill, waist, belt, cant rail, roof edge]. */
function carRing(S, z) {
  const hw = S.W / 2, tf = Math.max(0, (z - (S.hl - S.tz)) / S.tz), tr = Math.max(0, (-z - (S.hl - S.tz)) / S.tz), te = Math.max(tf, tr);
  const wz = hw * (1 - (tf > 0 ? 0.2 : 0.15) * te * te);
  let sill = S.gc + 0.09 * te * te;
  for (const az of [S.ra, S.fa]) { const dz = z - az; if (Math.abs(dz) < S.Ra - 1e-3) sill = Math.max(sill, S.R + Math.sqrt(S.Ra * S.Ra - dz * dz)); }
  const k = kAt(S.K, z), belt = k[1], cant = k[2], top = k[3], c = clamp01((cant - belt) / 0.35);
  const waist = Math.min(belt - 0.04, sill + (belt - sill) * 0.5);
  const r = [[wz * 0.955, sill], [wz, waist], [wz * 0.975, belt], [wz * lerp(0.975, S.cantF, c), cant], [wz * lerp(S.bonF, S.roofF, c), top]];
  if (!S.van) r.push([0, top + crownOf(c)]);      // crowned roof / bonnet / screens (a van's roof is flat)
  return r;
}
const crownOf = (c) => 0.014 + 0.022 * c;
/** Height of the centre line at z (roof, bonnet or boot). */
function topY(S, z) { const k = kAt(S.K, z); return k[3] + (S.van ? 0 : crownOf(clamp01((k[2] - k[1]) / 0.35))); }

function pSide(ctx, w, h, S, police) {
  const X = (z) => ((z + S.hl) / S.L) * w, Y = (y) => (1 - (y - S.sy0) / (S.sy1 - S.sy0)) * h, m = w / S.L, my = h / (S.sy1 - S.sy0);
  bg(ctx, w, h, '#ffffff');
  if (police) {
    const rows = S.van ? [0.72, 0.98, 1.24] : [0.46, 0.6, 0.74], bw = S.van ? 0.44 : 0.3;
    for (let r = 0; r < 2; r++) for (let z = -S.hl, i = r; z < S.hl; z += bw, i++) { ctx.fillStyle = i % 2 ? '#d7e21f' : '#1c3f9e'; ctx.fillRect(X(z), Y(rows[r + 1]), bw * m + 1, Y(rows[r]) - Y(rows[r + 1])); }
  }
  const g = ctx.createLinearGradient(0, Y(S.van ? 1.3 : 0.95), 0, Y(S.gc));
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0.24)');
  ctx.fillStyle = g; ctx.fillRect(-3, -3, w + 6, h + 6);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-3, Y(S.gc + 0.07), w + 6, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.42)'; ctx.lineWidth = 3;
  for (const az of [S.ra, S.fa]) { ctx.beginPath(); ctx.ellipse(X(az), Y(S.R), (S.Ra + 0.03) * m, (S.Ra + 0.03) * my, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.6;
  const line = (z0, y0, z1, y1) => { ctx.beginPath(); ctx.moveTo(X(z0), Y(y0)); ctx.lineTo(X(z1), Y(y1)); ctx.stroke(); };
  const top = S.van ? 1.25 : S.sy1, bot = S.gc + 0.1;
  for (const d of S.doors) {
    line(d[0], top, d[0], bot); line(d[1], top, d[1], bot); line(d[0], bot, d[1], bot);
    ctx.fillStyle = 'rgba(12,12,12,0.8)'; rr(ctx, X(d[0] + 0.07), Y(top - 0.2), 0.19 * m, 0.045 * my, 1.5); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.38)';
  line(-S.hl + 0.4, S.sy1, -S.hl + 0.46, S.gc); line(S.hl - 0.52, S.sy1, S.hl - 0.45, S.gc);       // bumper joints
  if (S.van) {
    line(-2.6, 1.25, 2.3, 1.25); line(-2.6, 0.72, 0.6, 0.72);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; line(-0.72, 2.1, -0.72, bot); line(0.58, 2.1, 0.58, bot); line(-0.72, 2.1, 0.58, 2.1); line(-2.0, 2.1, -0.72, 2.1);
    ctx.fillStyle = 'rgba(12,12,12,0.8)'; rr(ctx, X(0.3), Y(1.12), 0.2 * m, 5, 2); ctx.fill();
  } else { ctx.beginPath(); ctx.ellipse(X(S.ra - 0.1), Y(0.82), 0.065 * m, 0.065 * my, 0, 0, 7); ctx.stroke(); }
}
function pEnd(ctx, w, h, kind) {
  bg(ctx, w, h, '#ffffff');
  if (kind === 'front') {
    ctx.fillStyle = '#0c0d0e'; rr(ctx, w * 0.22, h * 0.58, w * 0.56, h * 0.27, 5); ctx.fill();
    ctx.fillStyle = '#2a2c2f'; for (let y = h * 0.64; y < h * 0.84; y += 5) ctx.fillRect(w * 0.25, y, w * 0.5, 1.5);
    ctx.fillStyle = '#0c0d0e'; for (const u of [0.1, 0.9]) { ctx.beginPath(); ctx.arc(w * u, h * 0.72, h * 0.1, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#cfd6dc'; for (const u of [0.1, 0.9]) { ctx.beginPath(); ctx.arc(w * u, h * 0.72, h * 0.055, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, h * 0.44, w, 1.5); ctx.fillRect(-3, h * 0.93, w + 6, h);
  } else if (kind === 'rear') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, h * 0.66, w, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; rr(ctx, w * 0.3, h * 0.24, w * 0.4, h * 0.3, 3); ctx.fill();
    ctx.fillStyle = '#101112'; ctx.fillRect(-3, h * 0.84, w + 6, h); ctx.fillStyle = '#7d1010'; ctx.fillRect(w * 0.08, h * 0.74, w * 0.1, h * 0.06); ctx.fillRect(w * 0.82, h * 0.74, w * 0.1, h * 0.06);
  } else {   // van rear doors
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.6; ctx.strokeRect(w * 0.06, h * 0.05, w * 0.88, h * 0.78);
    ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.05); ctx.lineTo(w * 0.5, h * 0.83); ctx.stroke();
    ctx.fillStyle = 'rgba(12,12,12,0.85)'; ctx.fillRect(w * 0.52, h * 0.5, w * 0.05, h * 0.07); for (const v of [0.14, 0.72]) { ctx.fillRect(w * 0.05, h * v, w * 0.035, h * 0.05); ctx.fillRect(w * 0.915, h * v, w * 0.035, h * 0.05); }
    ctx.fillStyle = '#101112'; ctx.fillRect(-3, h * 0.87, w + 6, h);
  }
}
const REGS = ['OU62 KXP', 'OV13 FTD', 'OE08 HJB', 'OY59 WMR'];
// destination blinds. AI buses each run one of these (systems/jobs.js gives each a route); generic invented route
// numbers (the jobs' routeNumber style), real place names as destinations, no operator names
export const BLINDS = [['3', 'Blackbird Leys'], ['11A', 'Kidlington'], ['7', 'Barton'], ['14X', 'Abingdon'], ['9', 'Headington'], ['4B', 'Cowley'], ['12', 'Summertown'], ['17', 'Botley']];
// and a few repainted at run time for the route the player is actually running (setBlind({ num, dest }))
const DYN_BLINDS = [['', 'Not in service'], ['', 'Not in service'], ['', 'Not in service'], ['', 'Not in service']];
defTile('white', 20, 20, (c, w, h) => bg(c, w, h, '#ffffff'));
for (const k of ['hatch', 'city', 'saloon', 'estate', 'cab']) defTile('side_' + k, 480, 64, (c, w, h) => pSide(c, w, h, STY[k], false));
defTile('side_psaloon', 480, 64, (c, w, h) => pSide(c, w, h, STY.saloon, true));
defTile('side_van', 480, 128, (c, w, h) => pSide(c, w, h, STY.van, false));
defTile('side_pvan', 480, 128, (c, w, h) => pSide(c, w, h, STY.van, true));
STY.minicab.sideTile = 'side_saloon';
for (const k of Object.keys(STY)) { STY[k].sideTile = STY[k].sideTile || 'side_' + k; for (const d of [0, 1]) defTile('gs_' + k + d, 120, 40, (c, w, h) => pSideGlass(c, w, h, !!d, STY[k].bars)); }
for (const d of [0, 1]) defTile('gf' + d, 120, 56, (c, w, h) => pScreen(c, w, h, !!d, false));
defTile('gr', 120, 56, (c, w, h) => pScreen(c, w, h, false, true));
defTile('wAlloy', 124, 124, (c, w) => pWheel(c, w, 'alloy')); defTile('wSteel', 124, 124, (c, w) => pWheel(c, w, 'steel')); defTile('wBus', 124, 124, (c, w) => pWheel(c, w, 'bus'));
REGS.forEach((r, i) => { defTile('plateF' + i, 120, 26, (c, w, h) => pPlate(c, w, h, r, false)); defTile('plateR' + i, 120, 26, (c, w, h) => pPlate(c, w, h, r, true)); });
BLINDS.forEach((r, i) => defTile('blind' + i, 248, 40, (c, w, h) => pBlind(c, w, h, r[0], r[1])));
DYN_BLINDS.forEach((r, i) => defTile('blindX' + i, 248, 40, (c, w, h) => pBlind(c, w, h, DYN_BLINDS[i][0], DYN_BLINDS[i][1])));
defTile('front', 124, 48, (c, w, h) => pEnd(c, w, h, 'front')); defTile('rear', 124, 48, (c, w, h) => pEnd(c, w, h, 'rear')); defTile('rearVan', 96, 124, (c, w, h) => pEnd(c, w, h, 'van'));
defTile('head', 60, 30, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bcc6ce'); g.addColorStop(1, '#6d7880'); bg(c, w, h, g);
  for (const u of [0.3, 0.62]) { c.fillStyle = '#2b3136'; c.beginPath(); c.arc(w * u, h * 0.5, h * 0.36, 0, 7); c.fill(); c.fillStyle = '#e6eef4'; c.beginPath(); c.arc(w * u, h * 0.5, h * 0.25, 0, 7); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(w * u - 1.5, h * 0.42, h * 0.09, 0, 7); c.fill(); }
  c.fillStyle = '#ff9d1c'; c.fillRect(w * 0.84, h * 0.15, w * 0.2, h * 0.7); c.strokeStyle = '#22262a'; c.lineWidth = 2; c.strokeRect(0, 0, w, h);
});
defTile('tail', 60, 30, (c, w, h) => {
  bg(c, w, h, '#b90f0f'); c.fillStyle = '#7e0a0a'; for (let y = 3; y < h; y += 5) c.fillRect(0, y, w, 1.2);
  c.fillStyle = '#ff9d1c'; c.fillRect(w * 0.06, h * 0.55, w * 0.3, h * 0.33); c.fillStyle = '#f1f1ee'; c.fillRect(w * 0.42, h * 0.55, w * 0.2, h * 0.33);
  c.strokeStyle = '#2a0606'; c.lineWidth = 2; c.strokeRect(0, 0, w, h);
});
defTile('grille', 124, 28, (c, w, h) => { bg(c, w, h, '#0b0c0d'); c.fillStyle = '#33363a'; for (let y = 5; y < h - 2; y += 5) c.fillRect(3, y, w - 6, 1.6); c.fillStyle = '#c9cdd2'; c.fillRect(0, 0, w, 3); rr(c, w * 0.43, h * 0.28, w * 0.14, h * 0.44, 4); c.fill(); });
defTile('grilleCab', 60, 44, (c, w, h) => { bg(c, w, h, '#c9cdd2'); c.fillStyle = '#101113'; rr(c, 4, 4, w - 8, h - 8, 5); c.fill(); c.fillStyle = '#b4b9be'; for (let x = 8; x < w - 8; x += 5) c.fillRect(x, 6, 2, h - 12); });
const pSign = (c, w, h, text, fill, ink) => { bg(c, w, h, fill); c.fillStyle = ink; c.font = `bold ${Math.round(h * 0.8)}px Arial, Helvetica, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h * 0.56, w * 0.9); };
defTile('taxiSign', 60, 20, (c, w, h) => pSign(c, w, h, 'TAXI', '#ffb31f', '#141414'));
defTile('cabSign', 60, 20, (c, w, h) => pSign(c, w, h, 'MINICAB', '#f4f4f0', '#1a3a8a'));
defTile('police', 184, 36, (c, w, h) => pSign(c, w, h, 'POLICE', '#f2f2f2', '#1b3d9a'));
defTile('chev', 60, 60, (c, w, h) => { bg(c, w, h, '#d7e21f'); c.fillStyle = '#c4161c'; for (let i = -2; i < 4; i++) { c.beginPath(); c.moveTo(i * 20, h + 3); c.lineTo(i * 20 + 10, h + 3); c.lineTo(i * 20 + 10 + h, -3); c.lineTo(i * 20 + h, -3); c.fill(); } });
defTile('busGlass', 20, 60, (c, w, h) => { pGlass(c, w, h, (k) => { k.fillRect(-3, h * 0.72, w + 6, h); }, 3); c.fillStyle = '#d9b21c'; c.fillRect(-3, h * 0.6, w + 6, 1.5); });
defTile('busDoor', 60, 124, (c, w, h) => { pGlass(c, w, h, null, 0); c.strokeStyle = '#0b0c0d'; c.lineWidth = 5; c.strokeRect(1, 1, w - 2, h - 2); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
  c.fillStyle = '#0b0c0d'; c.fillRect(0, h * 0.86, w, h); c.fillStyle = '#e0b81e'; c.fillRect(w * 0.4, h * 0.3, 2.5, h * 0.4); c.fillRect(w * 0.56, h * 0.3, 2.5, h * 0.4); });
defTile('vent', 60, 28, (c, w, h) => { bg(c, w, h, '#17181a'); c.fillStyle = '#3a3d41'; for (let y = 3; y < h; y += 4) c.fillRect(2, y, w - 4, 1.5); });
defTile('weave', 60, 60, (c, w, h) => { bg(c, w, h, '#f1e9da'); for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 ? -6 : 0; x < w; x += 12) { c.fillStyle = 'rgba(70,40,10,0.42)'; c.fillRect(x, y, 6, 5); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x + 6, y, 5, 1.5); } c.fillStyle = 'rgba(60,30,5,0.3)'; for (let x = 0; x < w; x += 12) c.fillRect(x + 5, 0, 1.2, h); });
defTile('wood', 60, 60, (c, w, h) => { bg(c, w, h, '#f4ece2'); for (let i = 0; i < 46; i++) { const y = (i * 37) % h; c.fillStyle = `rgba(60,28,6,${0.06 + ((i * 13) % 7) * 0.02})`; c.fillRect(-3, y, w + 6, 1 + (i % 3)); } c.fillStyle = 'rgba(30,14,4,0.55)'; for (let y = 14; y < h; y += 15) c.fillRect(-3, y, w + 6, 1.4); });
defTile('saddle', 28, 28, (c, w, h) => { bg(c, w, h, '#ffffff'); });
// the inside of a bus (systems/_bus_interior.js; only ever drawn for the bus the local player is aboard): the next-stop
// display (repainted by setBusNext), the "bus stopping" sign, seat moquette and the floor (appended last: no tile above moves)
let _busNext = 'Welcome aboard';
defTile('busNext', 248, 40, (c, w, h) => {
  bg(c, w, h, '#0a0a0a');
  c.fillStyle = '#ffa41c'; c.textBaseline = 'middle'; c.textAlign = 'center';
  c.font = `bold ${Math.round(h * 0.56)}px Arial, Helvetica, sans-serif`; c.fillText(_busNext, w * 0.5, h * 0.54, w * 0.94);
  c.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 0; x < w; x += 3) c.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
});
defTile('busStopping', 124, 24, (c, w, h) => {
  bg(c, w, h, '#120606');
  c.fillStyle = '#ff5a48'; c.textBaseline = 'middle'; c.textAlign = 'center';
  c.font = `bold ${Math.round(h * 0.62)}px Arial, Helvetica, sans-serif`; c.fillText('BUS STOPPING', w * 0.5, h * 0.55, w * 0.92);
});
defTile('busMoq', 44, 44, (c, w, h) => {
  bg(c, w, h, '#ffffff');
  // moquette: flecks and short dashes on the seat colour (the vertex colour tints it)
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 70; i++) { c.fillStyle = ['rgba(20,24,60,0.55)', 'rgba(250,200,40,0.5)', 'rgba(120,160,230,0.5)', 'rgba(0,0,0,0.35)'][i & 3]; c.fillRect(r() * w, r() * h, 2 + r() * 5, 1.6); }
});
defTile('busFloor', 44, 44, (c, w, h) => {
  bg(c, w, h, '#ffffff');
  let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 160; i++) { c.fillStyle = i & 1 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.5)'; c.fillRect(r() * w, r() * h, 1.3, 1.3); }
});

/** The atlas texture (null without a DOM: the Node smoke tests only need the geometry). */
export const ATLAS = (() => {
  if (typeof document === 'undefined') return null;
  try {
    const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, AW, AH);
    for (const k of Object.keys(TILES)) {
      const t = TILES[k];
      ctx.save(); ctx.translate(t.x, t.y); ctx.beginPath(); ctx.rect(-3, -3, t.w + 6, t.h + 6); ctx.clip();
      try { t.paint(ctx, t.w, t.h); } catch (e) { console.warn('[vehicles] atlas tile', k, e); }
      ctx.restore();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.name = 'vehicle-atlas';
    return tex;
  } catch (e) { console.warn('[vehicles] no atlas', e); return null; }
})();
/**
 * Texture pass 3 (top tier; called by world/index.js when the high-resolution set is on): the same atlas painted k
 * times larger into the same texture — number plates, destination blinds, wheel faces, lamps and door seams are
 * lettering and fine lines, and at 1024 px a plate's characters are 20 px high. Same tiles, same UVs.
 */
export function sharpenVehicleAtlas(k = 2, anisotropy = 16) {
  if (!ATLAS || typeof document === 'undefined' || !(k > 1) || ATLAS.userData.k === k) return false;
  try {
    const cv = document.createElement('canvas'); cv.width = AW * k; cv.height = AH * k;
    const ctx = cv.getContext('2d'); ctx.scale(k, k);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, AW, AH);
    for (const name of Object.keys(TILES)) {
      const t = TILES[name];
      ctx.save(); ctx.translate(t.x, t.y); ctx.beginPath(); ctx.rect(-3, -3, t.w + 6, t.h + 6); ctx.clip();
      try { t.paint(ctx, t.w, t.h); } catch (e) { /* the tile stays white, as in the first painting */ }
      ctx.restore();
    }
    ATLAS.image = cv; ATLAS.anisotropy = anisotropy; ATLAS.userData.k = k; ATLAS.needsUpdate = true;
    return true;
  } catch (e) { console.warn('[vehicles] atlas x' + k, e); return false; }
}
const WHITE_UV = tuv('white', 0.5, 0.5);
export const WHITE = WHITE_UV;

// ---------------------------------------------------------------- materials (shared by everything)
export const MATS = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.12, map: ATLAS }),
  tint: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.15 }),   // (legacy; unused)
  lightsOn: new THREE.MeshBasicMaterial({ vertexColors: true }),
  beam: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
};
MATS.lightsOff = MATS.body;
// parked pools (graphics pass 2): rest parts + tinted parts in ONE instanced draw. Attribute aTintMask (1 = the
// per-instance colour applies, 0 = the baked vertex colour stays) replaces the old separate white 'tint' mesh.
MATS.parked = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.12, map: ATLAS });
// The far edge of a pool (2026-11-26: the parked rows no longer pop in at the edge of their radius): each instance
// carries aPark = (whole within, gone at) m from the player (uParkEye, set once a frame by systems/vehicles.js) and
// thins out between the two by the dither the figures and the traffic fade with; one that is gone is thrown out of the
// picture in the vertex shader, so it costs no pixels. Nothing per instance on the CPU.
export const PARK_EYE = { value: new THREE.Vector2(1e9, 1e9) };
MATS.parked.onBeforeCompile = (sh) => {
  sh.uniforms.uParkEye = PARK_EYE;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aTintMask;\nattribute vec2 aPark;\nuniform vec2 uParkEye;\nvarying float vParkF;')
    .replace('#include <project_vertex>', `#include <project_vertex>
	vParkF = 1.0;
#ifdef USE_INSTANCING
	if ( aPark.y > 0.0 ) {
		vParkF = clamp( ( aPark.y - distance( instanceMatrix[ 3 ].xz, uParkEye ) ) / max( aPark.y - aPark.x, 0.01 ), 0.0, 1.0 );
		if ( vParkF <= 0.0 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
	}
#endif`)
    .replace('#include <color_vertex>', `#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, aTintMask );
#endif`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vParkF;')
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\tif ( vParkF < 0.995 ) { float pkN = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))); if ( pkN >= vParkF ) discard; }');
};
MATS.parked.customProgramCacheKey = () => 'parkedTintFade';
// live cars: ONE draw each. The mesh is an InstancedMesh of 1 whose "instance colour" is not a colour but three floats
// (wheel spin angle, steering angle, lamp flags): wheels turn and steer in the vertex shader (aWheel = pivot + mode) and
// lamps glow in the fragment shader (aGlow = which flag lights this vertex). No per-car material, uniform or texture.
export const GLOW = { lights: 1, brake: 2, sign: 3, beaconA: 4, beaconB: 5, tail: 6, saloon: 7, led: 8, cabin: 9, indL: 10, indR: 11 };   // 7 = a bus's lit interior seen through its windows, 8 = LED blind (always lit, brighter with the lamps on), 9 = the inside of a bus as its passengers see it (systems/_bus_interior.js: the same lamps, far less glare than the glass gets)
export const FLAG = { lights: 1, brake: 2, sign: 4, beaconA: 8, beaconB: 16, indL: 32, indR: 64, wipe: 128 };   // (the fraction of the flags float is how far a bus's doors are open: 0.9 = wide)
/** the wipers' sweep (radians, one uniform for every windscreen; systems/_carfid.js moves it while it rains) */
export const WIPE = { value: 0 };
MATS.car = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.12, map: ATLAS });
MATS.car.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
attribute vec4 aWheel;
attribute float aGlow;
varying float vGlow;
float vehBit( float f, float n ) { return step( 0.5, mod( floor( f / n ), 2.0 ) ); }
varying float vMatte;
uniform float uWipe;
vec3 vehAxis( vec3 p, vec3 n, float a ) { float c = cos( a ), s = sin( a ); return p * c + cross( n, p ) * s + n * dot( n, p ) * ( 1.0 - c ); }
#ifdef USE_INSTANCING_COLOR
// aWheel.w: 1 spins, 2 spins and steers (wheels); 2.6..3.4 a driver's head and neck (yaw with the steering, weighted);
// 3.6..4.4 the steering wheel (about its column, tilt in the fraction); 5 a wiper (about its own normal, uWipe);
// 6 a bus door leaf (slides by aWheel.xyz as the doors open)
vec3 vehTurn( vec3 p, vec2 a ) {
	float w = aWheel.w;
	if ( w < 2.5 ) {
		float c = cos( a.x ), s = sin( a.x );
		p.yz = vec2( c * p.y - s * p.z, s * p.y + c * p.z );
		if ( w > 1.5 ) { c = cos( a.y ); s = sin( a.y ); p.xz = vec2( c * p.x + s * p.z, c * p.z - s * p.x ); }
	} else if ( w < 3.5 ) {
		float t = a.y * 0.6 * clamp( ( w - 2.6 ) / 0.8, 0.0, 1.0 ), c = cos( t ), s = sin( t );
		p.xz = vec2( c * p.x + s * p.z, c * p.z - s * p.x );
	} else if ( w < 4.5 ) {
		float e = ( w - 3.6 ) * 2.0;
		p = vehAxis( p, vec3( 0.0, sin( e ), - cos( e ) ), a.y * 1.4 );
	} else if ( w < 5.5 ) {
		p = vehAxis( p, normalize( normal ), uWipe * vehBit( instanceColor.z, 128.0 ) );
	}
	return p;
}
#endif`)
    .replace('#include <color_vertex>', `vColor = vec3( 1.0 );
#ifdef USE_COLOR
	vColor *= color;
#endif
	vGlow = 0.0;
	vMatte = step( 0.2, aGlow - floor( aGlow + 0.1 ) );
#ifdef USE_INSTANCING_COLOR
	{
		float f = instanceColor.z, L = vehBit( f, 1.0 ), B = vehBit( f, 2.0 );
		if ( aGlow > 10.5 ) vGlow = 1.5 * vehBit( f, 64.0 );
		else if ( aGlow > 9.5 ) vGlow = 1.5 * vehBit( f, 32.0 );
		else if ( aGlow > 8.5 ) vGlow = 0.15 * L;
		else if ( aGlow > 7.5 ) vGlow = 0.55 + 0.45 * L;
		else if ( aGlow > 6.5 ) vGlow = 0.42 * L;
		else if ( aGlow > 5.5 ) vGlow = max( 0.4 * L, B );
		else if ( aGlow > 4.5 ) vGlow = 2.2 * vehBit( f, 16.0 );
		else if ( aGlow > 3.5 ) vGlow = 2.2 * vehBit( f, 8.0 );
		else if ( aGlow > 2.5 ) vGlow = vehBit( f, 4.0 );
		else if ( aGlow > 1.5 ) vGlow = B;
		else if ( aGlow > 0.5 ) vGlow = L;
	}
#endif`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
#ifdef USE_INSTANCING_COLOR
	if ( aWheel.w > 0.5 ) objectNormal = vehTurn( objectNormal, instanceColor.xy );
#endif`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING_COLOR
	if ( aWheel.w > 5.5 ) transformed += aWheel.xyz * ( fract( instanceColor.z ) / 0.9 );
	else if ( aWheel.w > 0.5 ) transformed = vehTurn( transformed - aWheel.xyz, instanceColor.xy ) + aWheel.xyz;
#endif`);
  sh.uniforms.uWipe = WIPE;
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vGlow;\nvarying float vMatte;')
    // (vMatte: trim, seats and people inside a car are cloth and plastic, not paint: rough, no sky in them)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix( roughnessFactor, 0.92, vMatte );')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor *= 1.0 - vMatte;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * vGlow * 1.7;');
};
MATS.car.customProgramCacheKey = () => 'vehCar';
// Reflections: one tiny canvas-painted sky cube (zenith blue, pale horizon, grey street below) shared by the three vehicle
// materials, so paint and glass pick up a sky / horizon sheen. Static (never re-rendered); its strength follows the
// daylight (setEnvLight, called once a frame by vehicles.js) so nothing glows at night. null without a DOM.
export const ENV = (() => {
  if (typeof document === 'undefined') return null;
  try {
    const face = (kind) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d');
      if (kind === 'up') c.fillStyle = '#6f9fd8'; else if (kind === 'down') c.fillStyle = '#5a5852';
      else { const g = c.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, '#79a6dc'); g.addColorStop(0.42, '#cfe0ee'); g.addColorStop(0.5, '#e6e2d6'); g.addColorStop(0.56, '#8d8778'); g.addColorStop(1, '#5a5852'); c.fillStyle = g; }
      c.fillRect(0, 0, 32, 32); return cv;
    };
    const t = new THREE.CubeTexture([face('side'), face('side'), face('up'), face('down'), face('side'), face('side')]);
    t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; t.name = 'vehicle-env';
    return t;
  } catch (e) { return null; }
})();
if (ENV) for (const k of ['body', 'car', 'parked']) { const m = MATS[k]; m.envMap = ENV; m.envMapIntensity = 0.55; m.roughness = 0.36; m.metalness = 0.22; }
/** Reflection strength for the time of day: daylight 0..1 (vehicles.js, once a frame; a uniform, never a recompile). */
export function setEnvLight(daylight) { const k = 0.06 + 0.5 * Math.max(0, Math.min(1, daylight)); if (MATS.car.envMapIntensity !== k) { MATS.body.envMapIntensity = MATS.car.envMapIntensity = MATS.parked.envMapIntensity = k; _vfade.forEach((L) => { for (const m of L) if (m && m.envMapIntensity !== undefined) m.envMapIntensity = k; }); } }

// Fading a vehicle in or out (2026-11-26: no vehicle pops into or out of being; as for the people, core/characters.js
// setFade). The shared materials have no opacity to give one rig, so a rig that is fading is drawn with one of
// VFADE_STEPS - 1 copies of each (the car's one draw, a cycle's parts, lit lamps) that throw away a share of its pixels
// in the same fixed screen pattern the figures use: no blending, so depth, the post chain and the draw count are
// untouched, and one more program per material serves every step. Only a rig that is fading wears a copy.
export const VFADE_STEPS = 8;
const _vfade = new Map();            // the whole material -> its copies, by step
function vfadeMat(base, l) {
  let L = _vfade.get(base); if (!L) _vfade.set(base, (L = []));
  let m = L[l];
  if (!m) {
    m = L[l] = base.clone(); m.name = (base.name || 'vehicle') + ':fade' + l; m.userData.fadeOf = base;
    const u = { value: l / VFADE_STEPS };
    m.onBeforeCompile = (sh, r) => {
      base.onBeforeCompile(sh, r);
      sh.uniforms.uFadeA = u;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uFadeA;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\t{ float fdN = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))); if (fdN >= uFadeA) discard; }');
    };
    m.customProgramCacheKey = () => base.customProgramCacheKey() + ':vfade';
  }
  return m;
}
function vfadeApply(o, l) {
  const ch = o.children;
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i]; if (c.name === 'character') continue;      // (a rider fades by its own setFade)
    if (c.isMesh && c.material) { const b = c.material.userData.fadeOf || c.material; if (b === MATS.car || b === MATS.body || b === MATS.lightsOn) c.material = l >= VFADE_STEPS ? b : vfadeMat(b, l); }
    if (c.children.length) vfadeApply(c, l);
  }
}
/** the copy of one of the vehicles' shared materials for alpha a (the material itself at a >= 1): a mesh that is not a rig's */
export function vehFadeMaterial(base, a) { const l = a >= 1 ? VFADE_STEPS : Math.min(VFADE_STEPS - 1, Math.max(1, Math.round(a * VFADE_STEPS))); return l >= VFADE_STEPS ? base : vfadeMat(base, l); }
/** Draw a rig (makeLive) at alpha a: 1 = as ever (the shared materials), below that dithered, 0 = nothing (the caller
 *  hides the group). Cheap to call every frame: nothing happens unless the step changes. Returns the step (0 ..
 *  VFADE_STEPS); rig.group.userData.fade says what it is drawn at. */
export function vehFade(rig, a) {
  const l = a >= 1 ? VFADE_STEPS : a <= 0.03 ? 0 : Math.min(VFADE_STEPS - 1, Math.max(1, Math.round(a * VFADE_STEPS)));
  if (l === rig.fadeL) return l;
  rig.fadeL = l; rig.group.userData.fade = l / VFADE_STEPS;
  if (l > 0) { vfadeApply(rig.group, l); if (rig.rider && rig.rider.setFade) rig.rider.setFade(l / VFADE_STEPS); }
  return l;
}

// ---------------------------------------------------------------- piece builder
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0), _e = new THREE.Euler();

/** Piece = flat arrays (non-indexed triangles): {pos, nor, uv|null (atlas uv; null = plain), guv (the primitive's own 0..1 uv), color, shade, node, glow, wheel} */
function norm(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = { pos: g.attributes.position.array, nor: g.attributes.normal.array, guv: g.attributes.uv ? g.attributes.uv.array : null, uv: null };
  g.dispose();
  return p;
}

class Builder {
  constructor() { this.pieces = []; }
  add(geo, color, node = 'body') { const p = norm(geo); p.color = color; p.node = node; p.shade = 1; this.pieces.push(p); return this; }
  get last() { return this.pieces[this.pieces.length - 1]; }
  /** Map the last piece's own 0..1 uv into an atlas tile (optionally a sub-rectangle of it). */
  tile(name, s0 = 0, t0 = 0, s1 = 1, t1 = 1) {
    const p = this.last, n = p.pos.length / 3, uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const q = tuv(name, s0 + (s1 - s0) * (p.guv ? p.guv[i * 2] : 0.5), t0 + (t1 - t0) * (p.guv ? p.guv[i * 2 + 1] : 0.5)); uv[i * 2] = q[0]; uv[i * 2 + 1] = q[1]; }
    p.uv = uv; return this;
  }
  set(o) { Object.assign(this.last, o); return this; }
  box(w, h, d, x, y, z, color, node, rx = 0, ry = 0, rz = 0, skip = '') {
    let g = new THREE.BoxGeometry(w, h, d);
    if (skip) {
      // drop faces nobody sees: digits 0..5 = +x -x +y -y +z -z
      g = g.toNonIndexed(); const keep = [];
      for (let f = 0; f < 6; f++) if (!skip.includes(String(f))) keep.push(f);
      for (const k of ['position', 'normal', 'uv']) { const a = g.attributes[k], sz = a.itemSize, out = new Float32Array(keep.length * 6 * sz); keep.forEach((f, i) => out.set(a.array.subarray(f * 6 * sz, (f + 1) * 6 * sz), i * 6 * sz)); g.setAttribute(k, new THREE.BufferAttribute(out, sz)); }
    }
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _v.set(x, y, z); _m.compose(_v, _q, _s); g.applyMatrix4(_m);
    return this.add(g, color, node);
  }
  /** Cylinder (rod) between points a and b. */
  rod(a, b, r, seg, color, node, r2 = r, open = true) {
    _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _v.length();
    const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, open);
    _q.setFromUnitVectors(_up, _v.normalize());
    _v2.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); _m.compose(_v2, _q, _s); g.applyMatrix4(_m);
    return this.add(g, color, node);
  }
  /** Cylinder whose axis is local x (wheels, hubs, crank axles). */
  xcyl(r, len, seg, x, y, z, color, node, open = false, thetaStart = 0, thetaLen = Math.PI * 2) {
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open, thetaStart, thetaLen);
    g.rotateZ(Math.PI / 2); g.translate(x, y, z);
    return this.add(g, color, node);
  }
  tube(pts, r, tubular, radial, color, node) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    return this.add(new THREE.TubeGeometry(curve, tubular, r, radial, false), color, node);
  }
  /** Torus in the y-z plane (axis x): tyres, mudguards. arc from angle a0 (0 = +z, PI/2 = +y). */
  xtorus(R, r, radial, tubular, x, y, z, color, node, arc = Math.PI * 2, a0 = 0) {
    const g = new THREE.TorusGeometry(R, r, radial, tubular, arc);
    // TorusGeometry lies in x-y starting at +x; rotate so it lies in z-y starting at +z, then by a0 about x
    g.rotateY(-Math.PI / 2); g.rotateX(-a0); g.translate(x, y, z);
    return this.add(g, color, node);
  }
  /** Side profile [[along, height]...] extruded across the width (centred), along -> +z. */
  profile(pts, width, color, node, bevel = 0, xOff = 0) {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    const depth = Math.max(0.002, width - 2 * bevel);
    const g = new THREE.ExtrudeGeometry(s, { depth, steps: 1, curveSegments: 1, bevelEnabled: bevel > 0, bevelThickness: bevel,
      bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1 });
    g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2); g.translate(xOff, 0, 0);
    return this.add(g, color, node);
  }
}

/** Triangle soup grouped by look: acc.tri / acc.quad, then flush(builder, node) -> one piece per (colour, shade, glow, wheel). */
class Acc {
  constructor() { this.g = new Map(); }
  grp(d) {
    const k = d.color + '|' + (d.shade ?? 1) + '|' + (d.glow || 0) + '|' + (d.wheel ? d.wheel.join(',') : '') + '|' + (d.tag || '') + '|' + (d.node || '') + '|' + (d.v || 0) + (d.gl || 0) + (d.matte ? 1 : 0);
    let g = this.g.get(k);
    if (!g) this.g.set(k, (g = { d, pos: [], nor: [], uv: [] }));
    return g;
  }
  tri(d, p0, n0, t0, p1, n1, t1, p2, n2, t2) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * cx + cy * cy + cz * cz < 1e-12) return;
    // wind it to agree with the normals it was given
    if (cx * (n0[0] + n1[0] + n2[0]) + cy * (n0[1] + n1[1] + n2[1]) + cz * (n0[2] + n1[2] + n2[2]) < 0) { let q = p1; p1 = p2; p2 = q; q = n1; n1 = n2; n2 = q; q = t1; t1 = t2; t2 = q; }
    const g = this.grp(d);
    g.pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    g.nor.push(n0[0], n0[1], n0[2], n1[0], n1[1], n1[2], n2[0], n2[1], n2[2]);
    const w = WHITE_UV; t0 = t0 || w; t1 = t1 || w; t2 = t2 || w;
    g.uv.push(t0[0], t0[1], t1[0], t1[1], t2[0], t2[1]);
  }
  /** Flat quad p[0..3] with uvs t[0..3] (or null); wound so its normal points along `hint`. */
  quad(d, p, t, hint) {
    const ax = p[2][0] - p[0][0], ay = p[2][1] - p[0][1], az = p[2][2] - p[0][2], bx = p[3][0] - p[1][0], by = p[3][1] - p[1][1], bz = p[3][2] - p[1][2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let o = [0, 1, 2, 3];
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { o = [0, 3, 2, 1]; nx = -nx; ny = -ny; nz = -nz; }
    const n = [nx, ny, nz], T = (i) => (t ? t[o[i]] : null);
    this.tri(d, p[o[0]], n, T(0), p[o[1]], n, T(1), p[o[2]], n, T(2)); this.tri(d, p[o[0]], n, T(0), p[o[2]], n, T(2), p[o[3]], n, T(3));
  }
  /** Quad textured with a whole tile (or a sub-rectangle [s0,t0,s1,t1]): p[0] bottom-left, p[1] bottom-right, p[2] top-right, p[3] top-left. */
  decal(d, p, tile, hint, r = [0, 0, 1, 1]) { this.quad(d, p, tile ? [tuv(tile, r[0], r[1]), tuv(tile, r[2], r[1]), tuv(tile, r[2], r[3]), tuv(tile, r[0], r[3])] : null, hint); }
  flush(b, node = 'body') {
    for (const g of this.g.values()) {
      if (!g.pos.length) continue;
      b.pieces.push({ pos: new Float32Array(g.pos), nor: new Float32Array(g.nor), uv: new Float32Array(g.uv), guv: null, color: g.d.color, shade: g.d.shade ?? 1, node: g.d.node || node,
        glow: g.d.glow || 0, wheel: g.d.wheel || null, sign: !!g.d.sign, tag: g.d.tag || null, v: g.d.v || 0, gl: g.d.gl || 0, matte: !!g.d.matte });
    }
    this.g.clear();
  }
  /** turn every face collected so far inside out (the lining of a shell lofted like its outside) */
  flip() {
    for (const g of this.g.values()) {
      const P = g.pos, N = g.nor, U = g.uv;
      for (let i = 0; i < P.length; i += 9) for (let k = 0; k < 3; k++) { const a = P[i + 3 + k]; P[i + 3 + k] = P[i + 6 + k]; P[i + 6 + k] = a; const c = N[i + 3 + k]; N[i + 3 + k] = N[i + 6 + k]; N[i + 6 + k] = c; }
      for (let i = 0; i < N.length; i++) N[i] = -N[i];
      for (let i = 0; i < U.length; i += 6) for (let k = 0; k < 2; k++) { const a = U[i + 2 + k]; U[i + 2 + k] = U[i + 4 + k]; U[i + 4 + k] = a; }
    }
    return this;
  }
}

/**
 * Loft a shell through cross-sections. zs = stations (ascending), ring(z) = left half [[x, y]...] bottom -> top (mirrored
 * for the right half), paint(i, k, z0, z1, side) -> {color, shade, glow, uv(x, y, z, s, t)} for the quad of span i and
 * strip k (k = ring.length - 1 is the top strip; side +1 left, 0 top, -1 right). Normals are smoothed across faces that
 * meet at less than the crease angle (cos). Zero-area triangles (pinched strips) are dropped.
 */
function loft(acc, zs, ring, paint, crease) {
  const n = zs.length, rings = zs.map(ring), m = rings[0].length, M = 2 * m;
  const P = (i, j) => (j < m ? [rings[i][j][0], rings[i][j][1], zs[i]] : [-rings[i][M - 1 - j][0], rings[i][M - 1 - j][1], zs[i]]);
  const FN = [], FU = [];
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < M - 1; k++) {
    const A = P(i, k), B = P(i + 1, k), Cc = P(i + 1, k + 1), D = P(i, k + 1);
    const ax = Cc[0] - A[0], ay = Cc[1] - A[1], az = Cc[2] - A[2], bx = B[0] - D[0], by = B[1] - D[1], bz = B[2] - D[2];
    const N = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx], l = Math.hypot(N[0], N[1], N[2]);
    FN.push(N); FU.push(l > 1e-9 ? [N[0] / l, N[1] / l, N[2] / l] : null);
  }
  const corner = (i, k, vi, vj) => {
    const u = FU[i * (M - 1) + k], o = [0, 0, 0];
    for (let a = vi - 1; a <= vi; a++) for (let c0 = vj - 1; c0 <= vj; c0++) {
      if (a < 0 || a >= n - 1 || c0 < 0 || c0 >= M - 1) continue;
      // a pinched top strip (ring ends on the centre line): the two halves are neighbours across it
      let c = c0; if (c === m - 1 && !FU[a * (M - 1) + c]) c = vj === m - 1 ? m : m - 2;
      const q = FU[a * (M - 1) + c]; if (!q || q[0] * u[0] + q[1] * u[1] + q[2] * u[2] < crease) continue;
      const N = FN[a * (M - 1) + c]; o[0] += N[0]; o[1] += N[1]; o[2] += N[2];
    }
    const l = Math.hypot(o[0], o[1], o[2]) || 1; return [o[0] / l, o[1] / l, o[2] / l];
  };
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < M - 1; k++) {
    if (!FU[i * (M - 1) + k]) continue;
    const side = k < m - 1 ? 1 : k === m - 1 ? 0 : -1, ks = side < 0 ? M - 2 - k : k;
    const d = paint(i, ks, zs[i], zs[i + 1], side);
    const A = P(i, k), B = P(i + 1, k), Cc = P(i + 1, k + 1), D = P(i, k + 1);
    // t = 0 at the strip's lower ring point (left side / top strip's left end), 1 at the other; right side strips run top -> bottom
    const tA = side < 0 ? 1 : 0, tD = 1 - tA, uv = d.uv;
    const uA = uv ? uv(A[0], A[1], A[2], 0, tA) : null, uB = uv ? uv(B[0], B[1], B[2], 1, tA) : null, uC = uv ? uv(Cc[0], Cc[1], Cc[2], 1, tD) : null, uD = uv ? uv(D[0], D[1], D[2], 0, tD) : null;
    const nA = corner(i, k, i, k), nB = corner(i, k, i + 1, k), nC = corner(i, k, i + 1, k + 1), nD = corner(i, k, i, k + 1);
    acc.tri(d, A, nA, uA, D, nD, uD, Cc, nC, uC); acc.tri(d, A, nA, uA, Cc, nC, uC, B, nB, uB);
  }
  return { rings, P, m, M };
}
/** Flat end cap of a lofted shell (fan over the full ring at station i), textured by projecting (x, y) into `tile`. */
function cap(acc, L, zs, i, dir, d, tile, hw) {
  const pts = []; for (let j = 0; j < L.M; j++) { const p = L.P(i, j), q = pts[pts.length - 1]; if (!q || Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) > 1e-5) pts.push(p); }
  let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const uv = (p) => (tile ? tuv(tile, 0.5 + (dir * p[0]) / (2 * hw), (p[1] - y0) / (y1 - y0)) : null), nn = [0, 0, dir];
  for (let j = 1; j < pts.length - 1; j++) { const a = pts[0], b = dir > 0 ? pts[j] : pts[j + 1], c = dir > 0 ? pts[j + 1] : pts[j]; acc.tri(d, a, nn, uv(a), b, nn, uv(b), c, nn, uv(c)); }
  return [y0, y1];
}
/** x of the shell's left side at height y on a ring. */
function ringX(r, y) {
  if (y <= r[0][1]) return r[0][0];
  for (let j = 0; j < r.length - 1; j++) if (y <= r[j + 1][1] && r[j + 1][1] > r[j][1]) return lerp(r[j][0], r[j + 1][0], (y - r[j][1]) / (r[j + 1][1] - r[j][1]));
  return r[r.length - 1][0];
}
/** A wheel: tread band + a textured outer face (the atlas wheel tile, so the spokes are seen turning). mode 1 = spins, 2 = spins and steers. */
function wheel(acc, sx, xo, R, z, tw, seg, tile, mode, node) {
  const piv = [xo - sx * tw / 2, R, z, mode], dT = { color: C.tyre, wheel: piv, node }, dF = { color: C.white, wheel: piv, node };
  const xi = xo - sx * tw, bev = 0.022, cen = [xo, R, z], nf = [sx, 0, 0], uc = tuv(tile, 0.5, 0.5);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const o0 = [xo - sx * bev, R + s0 * R, z + c0 * R], o1 = [xo - sx * bev, R + s1 * R, z + c1 * R], i0 = [xi, R + s0 * R, z + c0 * R], i1 = [xi, R + s1 * R, z + c1 * R];
    const n0 = [0, s0, c0], n1 = [0, s1, c1], Rf = R - bev * 0.8;
    const f0 = [xo, R + s0 * Rf, z + c0 * Rf], f1 = [xo, R + s1 * Rf, z + c1 * Rf];
    const q = sx > 0 ? [o0, i0, i1, o1] : [o0, o1, i1, i0], qn = sx > 0 ? [n0, n0, n1, n1] : [n0, n1, n1, n0];
    acc.tri(dT, q[0], qn[0], null, q[1], qn[1], null, q[2], qn[2], null); acc.tri(dT, q[0], qn[0], null, q[2], qn[2], null, q[3], qn[3], null);
    // face fan (uv mirrored on the right so both sides read the same way round) and the shoulder bevel in tyre black
    const u0 = tuv(tile, 0.5 + sx * c0 * 0.49, 0.5 + s0 * 0.49), u1 = tuv(tile, 0.5 + sx * c1 * 0.49, 0.5 + s1 * 0.49);
    const nb0 = [sx * 0.7, s0 * 0.7, c0 * 0.7], nb1 = [sx * 0.7, s1 * 0.7, c1 * 0.7];
    if (sx > 0) { acc.tri(dF, cen, nf, uc, f1, nf, u1, f0, nf, u0); acc.tri(dT, f0, nb0, null, f1, nb1, null, o1, nb1, null); acc.tri(dT, f0, nb0, null, o1, nb1, null, o0, nb0, null); }
    else { acc.tri(dF, cen, nf, uc, f0, nf, u0, f1, nf, u1); acc.tri(dT, f0, nb0, null, o1, nb1, null, f1, nb1, null); acc.tri(dT, f0, nb0, null, o0, nb0, null, o1, nb1, null); }
  }
}

/** Shrink a convex polygon by distance d (2D [[a,b]...]). */
function inset(poly, d) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const sgn = area > 0 ? 1 : -1;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    let dx = q[0] - p[0], dy = q[1] - p[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = -dy * sgn, ny = dx * sgn;   // inward normal
    lines.push([p[0] + nx * d, p[1] + ny * d, dx, dy]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i + n - 1) % n], b = lines[i];
    const den = a[2] * b[3] - a[3] * b[2];
    if (Math.abs(den) < 1e-6) { out.push([b[0], b[1]]); continue; }
    const t = ((b[0] - a[0]) * b[3] - (b[1] - a[1]) * b[2]) / den;
    out.push([a[0] + a[2] * t, a[1] + a[3] * t]);
  }
  return out;
}

// ---------------------------------------------------------------- bicycles
const BIKE_GEOM = {
  bike_roadster: { R: 0.35, tyre: 0.022, wb: 1.12, tube: 0.017, BB: [0, 0.27, -0.06], ST: [0, 0.8, -0.3], HT: [0, 0.98, 0.4], HB: [0, 0.78, 0.45], post: 0.14 },
  bike_road: { R: 0.34, tyre: 0.013, wb: 1.0, tube: 0.014, BB: [0, 0.27, -0.04], ST: [0, 0.86, -0.22], HT: [0, 0.86, 0.38], HB: [0, 0.71, 0.41], post: 0.1 },
  bike_mtb: { R: 0.33, tyre: 0.042, wb: 1.08, tube: 0.022, BB: [0, 0.31, -0.05], ST: [0, 0.79, -0.24], HT: [0, 0.9, 0.4], HB: [0, 0.72, 0.44], post: 0.14 },
};
export function bikeGeom(type) { return BIKE_GEOM[type]; }

/** Bicycle wheel about the origin (axle along x): round tyre, rim, laced flat spokes, hub, two amber spoke reflectors. */
function bikeWheel(acc, node, R, tr, hi) {
  const seg = hi ? 24 : 16, rad = hi ? 4 : 3, Rc = R - tr, tyre = { color: C.tyre, node }, steel = { color: C.steel, node };
  const pt = (a, bb) => { const rr2 = Rc + tr * Math.cos(bb); return [tr * Math.sin(bb), rr2 * Math.sin(a), rr2 * Math.cos(a)]; };
  const nn = (a, bb) => [Math.sin(bb), Math.cos(bb) * Math.sin(a), Math.cos(bb) * Math.cos(a)];
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
    const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU, b0 = (j / rad) * TAU, b1 = ((j + 1) / rad) * TAU;
    acc.tri(tyre, pt(a0, b0), nn(a0, b0), null, pt(a1, b0), nn(a1, b0), null, pt(a1, b1), nn(a1, b1), null);
    acc.tri(tyre, pt(a0, b0), nn(a0, b0), null, pt(a1, b1), nn(a1, b1), null, pt(a0, b1), nn(a0, b1), null);
  }
  const Rr = R - tr * 2 - 0.002;
  if (hi) for (const sx of [-1, 1]) for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU, x = sx * 0.008, r0 = Rr - 0.016, r1 = Rr + 0.006;
    acc.quad(steel, [[x, r0 * Math.sin(a0), r0 * Math.cos(a0)], [x, r0 * Math.sin(a1), r0 * Math.cos(a1)], [x, r1 * Math.sin(a1), r1 * Math.cos(a1)], [x, r1 * Math.sin(a0), r1 * Math.cos(a0)]], null, [sx, 0, 0]);
  }
  const ns = hi ? 16 : 6, sw = hi ? 0.0028 : 0.005;
  for (let i = 0; i < ns; i++) {
    const a = (i / ns) * TAU, h = a + (i % 2 ? 1.25 : -1.25), hx = (i % 4 < 2 ? 1 : -1) * 0.026;
    const p0 = [hx, 0.024 * Math.sin(h), 0.024 * Math.cos(h)], p1 = [0, Rr * Math.sin(a), Rr * Math.cos(a)];
    let dy = p1[1] - p0[1], dz = p1[2] - p0[2]; const l = Math.hypot(dy, dz); dy /= l; dz /= l;
    const q = [[p0[0], p0[1] - dz * sw, p0[2] + dy * sw], [p1[0], p1[1] - dz * sw, p1[2] + dy * sw], [p1[0], p1[1] + dz * sw, p1[2] - dy * sw], [p0[0], p0[1] + dz * sw, p0[2] - dy * sw]];
    acc.quad(steel, q, null, [1, 0, 0]); acc.quad(steel, q, null, [-1, 0, 0]);
  }
  if (hi) for (const a of [0.6, 0.6 + Math.PI]) {
    const r0 = Rr * 0.62, r1 = Rr * 0.86, w = 0.022, c = Math.cos(a), sn = Math.sin(a);
    const q = [[0, r0 * sn - c * w, r0 * c + sn * w], [0, r1 * sn - c * w, r1 * c + sn * w], [0, r1 * sn + c * w, r1 * c - sn * w], [0, r0 * sn + c * w, r0 * c - sn * w]];
    acc.quad({ color: C.refl, node }, q, null, [1, 0, 0]); acc.quad({ color: C.refl, node }, q, null, [-1, 0, 0]);
  }
}
/** Mudguard: a shallow strip over the wheel from angle a0 to a1 (0 = +z, PI/2 = +y) about (cy, cz). */
function mudguard(acc, node, cy, cz, Rg, a0, a1, n, w, color, both, x0 = 0) {
  const d = { color, node }, di = { color, node, shade: 0.6 };
  for (let i = 0; i < n; i++) {
    const A = a0 + ((a1 - a0) * i) / n, B = a0 + ((a1 - a0) * (i + 1)) / n;
    const P = (a, x, r) => [x0 + x, cy + r * Math.sin(a), cz + r * Math.cos(a)], N = (a, x) => { const l = Math.hypot(x * 1.2, 1); return [(x * 1.2) / l, Math.sin(a) / l, Math.cos(a) / l]; };
    for (const sx of [-1, 1]) {
      const e0 = P(A, sx * w, Rg - 0.016), e1 = P(B, sx * w, Rg - 0.016), c0 = P(A, 0, Rg), c1 = P(B, 0, Rg);
      acc.tri(d, c0, N(A, 0), null, c1, N(B, 0), null, e1, N(B, sx), null); acc.tri(d, c0, N(A, 0), null, e1, N(B, sx), null, e0, N(A, sx), null);
      if (both) { const m = (v) => [-v[0], -v[1], -v[2]]; acc.tri(di, c0, m(N(A, 0)), null, c1, m(N(B, 0)), null, e1, m(N(B, sx)), null); acc.tri(di, c0, m(N(A, 0)), null, e1, m(N(B, sx)), null, e0, m(N(A, sx)), null); }
    }
  }
}

function buildBike(type, hi) {
  const b = new Builder(), acc = new Acc(), G = BIKE_GEOM[type], R = G.R, t = G.tube;
  const rs = hi ? 6 : 4;                               // radial segments of tubes
  const RA = [0, R, -G.wb / 2], FA = [0, R, G.wb / 2];
  const BB = G.BB, ST = G.ST, HT = G.HT, HB = G.HB;
  const steerZ = HB[2];
  // --- frame (node 'frame', colour = tint)
  b.rod(BB, ST, t, rs, TINT, 'frame');
  if (type === 'bike_roadster') {
    // step-through loop frame: two curved tubes from the head tube down to the bottom bracket
    b.tube([HB, [0, 0.55, 0.28], [0, 0.33, 0.07], BB], t * 1.1, hi ? 10 : 5, rs, TINT, 'frame');
    b.tube([[0, HT[1] - 0.06, HT[2] + 0.01], [0, 0.72, 0.2], [0, 0.5, -0.05], [0, 0.48, -0.17]], t, hi ? 10 : 5, rs, TINT, 'frame');
  } else {
    b.rod(ST, [0, HT[1] - 0.02, HT[2]], t, rs, TINT, 'frame');
    b.rod(BB, HB, t * 1.15, rs, TINT, 'frame');
  }
  b.rod(HB, HT, t * 1.25, rs, TINT, 'frame');
  for (const sx of [-0.065, 0.065]) {
    b.rod([sx * 0.5, BB[1], BB[2]], [sx, RA[1], RA[2]], t * 0.7, rs, TINT, 'frame');
    b.rod([sx * 0.4, ST[1] - 0.04, ST[2] + 0.01], [sx, RA[1] + 0.01, RA[2]], t * 0.6, rs, TINT, 'frame');
  }
  // seatpost + saddle
  const sp = [0, ST[1] + G.post, ST[2] - G.post * 0.3];
  b.rod(ST, sp, 0.012, rs, C.chrome, 'frame');
  if (type === 'bike_roadster') {
    b.box(0.19, 0.06, 0.27, 0, sp[1] + 0.05, sp[2] - 0.03, C.brown, 'frame', 0.06);
    if (hi) for (const sx of [-0.06, 0.06]) b.rod([sx, sp[1] + 0.0, sp[2] - 0.1], [sx, sp[1] + 0.04, sp[2] - 0.1], 0.016, 5, C.black, 'frame');
  } else if (type === 'bike_road') {
    b.box(0.11, 0.035, 0.27, 0, sp[1] + 0.03, sp[2] - 0.02, C.black, 'frame', -0.04);
  } else b.box(0.15, 0.06, 0.26, 0, sp[1] + 0.04, sp[2] - 0.02, C.black, 'frame', -0.02);
  // chain + chainguard / derailleur
  b.box(0.016, 0.02, Math.abs(RA[2] - BB[2]), 0.07, (BB[1] + RA[1]) / 2 + 0.07, (BB[2] + RA[2]) / 2, C.dark, 'frame', Math.atan2(RA[1] - BB[1], BB[2] - RA[2]));
  b.box(0.016, 0.02, Math.abs(RA[2] - BB[2]), 0.07, (BB[1] + RA[1]) / 2 - 0.06, (BB[2] + RA[2]) / 2, C.dark, 'frame', Math.atan2(RA[1] - BB[1], BB[2] - RA[2]) * 0.6);
  if (type === 'bike_roadster') {
    b.box(0.02, 0.13, Math.abs(RA[2] - BB[2]) + 0.12, 0.085, (BB[1] + RA[1]) / 2 + 0.02, (BB[2] + RA[2]) / 2, TINT, 'frame', Math.atan2(RA[1] - BB[1], BB[2] - RA[2]));
    // mudguards and a rear rack
    mudguard(acc, 'frame', RA[1], RA[2], R + 0.035, -0.15, -0.15 + Math.PI * 1.05, hi ? 18 : 9, 0.03, TINT, hi);
    b.box(0.05, 0.035, 0.012, 0, RA[1] + 0.06, RA[2] - R - 0.04, C.reflR, 'frame', 0, 0, 0, '4');
    b.box(0.13, 0.012, 0.36, 0, R * 2 + 0.06, RA[2] - 0.02, C.dark, 'frame');
    b.rod([0.06, R * 2 + 0.06, RA[2] - 0.18], [0.065, RA[1], RA[2]], 0.006, 3, C.dark, 'frame');
    b.rod([-0.06, R * 2 + 0.06, RA[2] - 0.18], [-0.065, RA[1], RA[2]], 0.006, 3, C.dark, 'frame');
  } else if (type === 'bike_mtb') {
    b.box(0.03, 0.06, 0.05, 0.075, RA[1] - 0.04, RA[2] + 0.04, C.dark, 'frame');
    // battered: rust and mud patches, a twisted bit of rear mudguard
    b.box(t * 2.6, t * 2.6, 0.12, 0, (BB[1] + HB[1]) / 2, (BB[2] + HB[2]) / 2, C.rust, 'frame', -0.95);
    b.box(t * 2.4, 0.09, t * 2.4, 0, (BB[1] + ST[1]) / 2 - 0.1, (BB[2] + ST[2]) / 2 + 0.04, C.mud, 'frame', 0.3);
    mudguard(acc, 'frame', RA[1], RA[2], R + 0.05, 1.0, 2.3, hi ? 8 : 4, 0.035, C.dark, true, 0.01);
  } else {
    b.box(0.03, 0.05, 0.05, 0.075, RA[1] - 0.04, RA[2] + 0.04, C.dark, 'frame');
    b.rod([0, BB[1] + 0.12, BB[2] + 0.1], [0, BB[1] + 0.28, BB[2] + 0.2], 0.035, 6, C.chrome, 'frame', 0.035, false); // bottle
  }
  // rear light (lights node)
  b.box(0.04, 0.05, 0.02, 0, type === 'bike_roadster' ? R * 2 + 0.03 : sp[1] - 0.06, (type === 'bike_roadster' ? RA[2] - 0.22 : sp[2] - 0.05), C.tail, 'lights');

  // --- steering assembly (node 'steer', pivot at (0,0,steerZ))
  const s = (p) => [p[0], p[1], p[2] - steerZ];
  for (const sx of [-0.05, 0.05]) {
    if (type === 'bike_mtb') {
      b.rod(s([sx * 1.1, HB[1], HB[2]]), s([sx * 1.1, R + 0.22, (HB[2] + FA[2]) / 2]), 0.016, rs, C.chrome, 'steer');
      b.rod(s([sx * 1.1, R + 0.25, (HB[2] + FA[2]) / 2 + 0.02]), s([sx * 1.1, R, FA[2]]), 0.022, rs, C.black, 'steer');
    } else b.rod(s([sx * 0.6, HB[1], HB[2]]), s([sx, R, FA[2]]), t * 0.75, rs, TINT, 'steer');
  }
  b.rod(s(HT), s([0, HT[1] + 0.08, HT[2] - 0.01]), 0.014, rs, C.chrome, 'steer');
  const barY = HT[1] + 0.08;
  if (type === 'bike_roadster') {
    b.tube([s([-0.27, barY - 0.04, HT[2] - 0.22]), s([-0.24, barY, HT[2] - 0.08]), s([0, barY + 0.01, HT[2] + 0.0]), s([0.24, barY, HT[2] - 0.08]), s([0.27, barY - 0.04, HT[2] - 0.22])], 0.011, hi ? 12 : 6, rs, C.chrome, 'steer');
    for (const sx of [-1, 1]) b.rod(s([sx * 0.27, barY - 0.04, HT[2] - 0.22]), s([sx * 0.28, barY - 0.05, HT[2] - 0.33]), 0.016, rs, C.grip, 'steer', 0.016, false);
    // wicker basket on the front
    const bz = FA[2] + 0.09 - steerZ, by = HT[1] - 0.12;
    { // tapered wicker basket, open at the top (woven texture from the atlas; inside a shade darker)
      const lo2 = [[0.15, by, bz + 0.12], [-0.15, by, bz + 0.12], [-0.15, by, bz - 0.12], [0.15, by, bz - 0.12]], hi2 = [[0.19, by + 0.24, bz + 0.15], [-0.19, by + 0.24, bz + 0.15], [-0.19, by + 0.24, bz - 0.15], [0.19, by + 0.24, bz - 0.15]];
      const wo = { color: C.wicker, node: 'steer', tag: 'wk' }, wi = { color: C.wicker, node: 'steer', shade: 0.55, tag: 'wk' };
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4, q = [lo2[i], lo2[j], hi2[j], hi2[i]], mx = (lo2[i][0] + lo2[j][0]) / 2, mz = (lo2[i][2] + lo2[j][2]) / 2 - bz;
        acc.decal(wo, q, 'weave', [mx, 0, mz]); acc.decal(wi, q, 'weave', [-mx, 0, -mz]);
      }
      acc.decal(wi, lo2, 'weave', [0, 1, 0]); acc.decal(wo, lo2, 'weave', [0, -1, 0]);
    }
    b.rod([0.05, by, bz - 0.05], [0.05, R, FA[2] - steerZ], 0.005, 3, C.dark, 'steer');
    b.rod([-0.05, by, bz - 0.05], [-0.05, R, FA[2] - steerZ], 0.005, 3, C.dark, 'steer');
    mudguard(acc, 'steer', R, FA[2] - steerZ, R + 0.035, 0.55, 0.55 + Math.PI * 0.75, hi ? 12 : 6, 0.03, TINT, hi);
    b.box(0.075, 0.075, 0.06, 0, by - 0.06, bz + 0.135, C.chrome, 'steer', 0, 0, 0, '5');   // lamp shell (the lens lights up in the 'lights' node)
    b.rod(s([0.16, barY + 0.01, HT[2] - 0.06]), s([0.16, barY + 0.045, HT[2] - 0.06]), 0.022, 7, C.chrome, 'steer', 0.022, false); // bell
    b.box(0.07, 0.07, 0.05, 0, by - 0.06, bz + 0.17, C.head, 'lights');   // front lamp
  } else if (type === 'bike_road') {
    const z0 = HT[2] + 0.07;
    b.tube([s([-0.2, barY - 0.13, z0 - 0.02]), s([-0.2, barY - 0.13, z0 + 0.06]), s([-0.205, barY - 0.05, z0 + 0.11]), s([-0.2, barY, z0 + 0.05]), s([-0.19, barY, z0]), s([0, barY, z0]),
      s([0.19, barY, z0]), s([0.2, barY, z0 + 0.05]), s([0.205, barY - 0.05, z0 + 0.11]), s([0.2, barY - 0.13, z0 + 0.06]), s([0.2, barY - 0.13, z0 - 0.02])], 0.012, hi ? 18 : 8, rs, C.black, 'steer');
    b.rod(s([0, barY - 0.01, HT[2] - 0.01]), s([0, barY, z0]), 0.014, rs, C.dark, 'steer');
    b.box(0.03, 0.04, 0.04, 0, barY - 0.03, z0 + 0.03 - 0, C.head, 'lights');
  } else {
    b.rod(s([-0.33, barY + 0.02, HT[2] + 0.02]), s([0.33, barY + 0.02, HT[2] + 0.02]), 0.013, rs, C.black, 'steer');
    for (const sx of [-1, 1]) b.rod(s([sx * 0.25, barY + 0.02, HT[2] + 0.02]), s([sx * 0.34, barY + 0.02, HT[2] + 0.02]), 0.017, rs, C.grip, 'steer', 0.017, false);
    b.box(0.04, 0.04, 0.05, 0, barY - 0.04, HT[2] + 0.08 - steerZ, C.head, 'lights');
  }

  // --- wheels (nodes 'wheelF' / 'wheelR', centred at the axle)
  for (const node of ['wheelR', 'wheelF']) { bikeWheel(acc, node, R, G.tyre, hi); b.xcyl(0.024, 0.1, hi ? 6 : 4, 0, 0, 0, C.steel, node, true); }
  // --- cranks (node 'crank', pivot at the bottom bracket)
  b.xcyl(0.1, 0.012, hi ? 14 : 8, 0.07, 0, 0, C.chrome, 'crank');
  b.box(0.018, 0.17, 0.028, 0.095, -0.085, 0, C.chrome, 'crank');
  b.box(0.018, 0.17, 0.028, -0.095, 0.085, 0, C.chrome, 'crank');
  b.box(0.09, 0.022, 0.065, 0.15, -0.17, 0, C.dark, 'crank');
  b.box(0.09, 0.022, 0.065, -0.15, 0.17, 0, C.dark, 'crank');
  b.xcyl(0.02, 0.2, 6, 0, 0, 0, C.dark, 'crank');
  acc.flush(b);
  return { b, pivots: { frame: [0, 0, 0], steer: [0, 0, steerZ], wheelF: FA, wheelR: RA, crank: BB, lights: [0, 0, 0] } };
}

// ---------------------------------------------------------------- cars, taxis, vans
export const POLICE_COLORS = { yellow: 0xcfdc1c, blue: 0x1b3d9a, white: 0xf2f2f2, beaconOn: 0x5a9cff, beaconOff: 0x10204a, lens: 0x2f62d8 };
const NOGLASS = 0x0c0d0e;

function buildCar(style, livery) {
  if (style === 'bus' || style === 'bus1') return buildBus(style);
  const S = STY[style], T = TYPES[S.type], b = new Builder(), acc = new Acc(), hw = S.W / 2, hl = S.hl, K = S.K, R = S.R, police = livery === 'police';
  const sideTile = police ? (S.van ? 'side_pvan' : 'side_psaloon') : S.sideTile;
  const g0 = K[S.gi[0]][0], g1 = K[S.gi[1]][0], wTop = K[S.wi[0]][0], wBase = K[S.wi[1]][0];
  let gy0 = 9, gy1 = 0; for (let i = S.gi[0]; i <= S.gi[1]; i++) { gy0 = Math.min(gy0, K[i][1]); gy1 = Math.max(gy1, K[i][2]); }
  const r0 = S.ri ? K[S.ri[0]][0] : 0, r1 = S.ri ? K[S.ri[1]][0] : 0, zLf = K[S.lf][0], zLr = S.lr >= 0 ? K[S.lr][0] : -99;
  const gs = 'gs_' + S.name + '0';
  const bodyD = { color: TINT };
  const sideD = { color: TINT, tag: 'side', uv: (x, y, z) => tuv(sideTile, (z + hl) / S.L, (y - S.sy0) / (S.sy1 - S.sy0)) };
  const glassD = { color: C.white, gl: 1, tag: 'drv:gs_' + S.name, uv: (x, y, z) => tuv(gs, (z - g0) / (g1 - g0), clamp01((y - gy0) / (gy1 - gy0))) };
  const wsD = { color: C.white, gl: 1, tag: 'drv:gf', uv: (x, y, z) => tuv('gf0', clamp01(0.5 + x / (1.5 * hw)), (wBase - z) / (wBase - wTop)) };
  const rwD = { color: C.white, gl: 1, tag: 'rw', uv: (x, y, z) => tuv('gr', clamp01(0.5 - x / (1.5 * hw)), (z - r0) / (r1 - r0)) };
  const headD = { color: C.white, glow: GLOW.lights, tag: 'head', uv: (x, y, z, s, t) => tuv('head', (z - zLf) / (hl - zLf), t) };
  const tailD = { color: C.white, glow: GLOW.tail, tag: 'tail', uv: (x, y, z, s, t) => tuv('tail', (zLr - z) / (zLr + hl), t) };
  const paint = (i, k, z0, z1) => {
    const zm = (z0 + z1) / 2;
    if (k === 1) { if (zm > zLf) return headD; if (zm < zLr) return tailD; }
    if (k <= 1) return sideD;
    if (k === 2) return zm > g0 && zm < g1 ? glassD : S.van ? sideD : bodyD;
    if (k === 4) { if (zm > wTop && zm < wBase) return wsD; if (S.ri && zm > r0 && zm < r1) return rwD; }
    return bodyD;
  };
  const ring = (z) => carRing(S, z), zs = S.zs;
  const Lf = loft(acc, zs, ring, paint, S.crease);
  const capF = cap(acc, Lf, zs, zs.length - 1, 1, { color: TINT, tag: 'capF' }, 'front', hw);
  const capR = cap(acc, Lf, zs, 0, -1, { color: TINT, tag: 'capR' }, S.van ? 'rearVan' : 'rear', hw);
  const sideDecal = (sx, z0, z1, y0, y1, d, tile, r) => {
    const X = (z, y) => sx * (ringX(ring(z), y) + 0.014), zl = sx > 0 ? z1 : z0, zr = sx > 0 ? z0 : z1;
    acc.decal(d, [[X(zl, y0), y0, zl], [X(zr, y0), y0, zr], [X(zr, y1), y1, zr], [X(zl, y1), y1, zl]], tile, [sx, 0, 0], r);
  };
  const faceDecal = (dir, x0, x1, y0, y1, d, tile, r, off = 0.014) => {
    const z = dir * (hl + off), xl = dir > 0 ? x0 : x1, xr = dir > 0 ? x1 : x0;
    acc.decal(d, [[xl, y0, z], [xr, y0, z], [xr, y1, z], [xl, y1, z]], tile, [0, 0, dir], r);
  };
  // nose: grille, lamp faces, plate
  const rF = ring(hl), rR = ring(-hl);
  if (style === 'cab') faceDecal(1, -0.3, 0.3, rF[0][1] + 0.16, rF[2][1] - 0.02, { color: C.white, tag: 'grille' }, 'grilleCab');
  else faceDecal(1, -hw * 0.4, hw * 0.4, rF[1][1] + 0.01, rF[2][1] - 0.02, { color: C.white, tag: 'grille' }, 'grille');
  const lf0 = style === 'cab' ? 0.36 : hw * 0.44;
  faceDecal(1, lf0, rF[1][0] - 0.005, rF[1][1], rF[2][1], { color: C.white, glow: GLOW.lights, tag: 'head' }, 'head', [0, 0, 0.5, 1]);
  faceDecal(1, -rF[1][0] + 0.005, -lf0, rF[1][1], rF[2][1], { color: C.white, glow: GLOW.lights, tag: 'head' }, 'head', [0.5, 0, 0, 1]);
  faceDecal(1, -0.26, 0.26, rF[0][1] + 0.035, rF[0][1] + 0.145, { color: C.white, tag: 'plateF' }, 'plateF0', undefined, 0.022);
  // tail: lamp faces, plate, high-level brake light
  const tl0 = S.van ? hw * 0.66 : hw * 0.5, ty0 = S.van ? rR[1][1] + 0.12 : rR[1][1], ty1 = S.van ? rR[2][1] - 0.05 : rR[2][1];
  faceDecal(-1, tl0, rR[1][0] - 0.005, ty0, ty1, { color: C.white, glow: GLOW.tail, tag: 'tail' }, 'tail', [0.5, 0, 0, 1]);
  faceDecal(-1, -rR[1][0] + 0.005, -tl0, ty0, ty1, { color: C.white, glow: GLOW.tail, tag: 'tail' }, 'tail', [0, 0, 0.5, 1]);
  const py = S.van ? 0.62 : capR[1] - 0.39 * (capR[1] - capR[0]);
  faceDecal(-1, -0.26, 0.26, py - 0.055, py + 0.055, { color: C.white, tag: 'plateR' }, 'plateR0', undefined, 0.022);
  { const zb = S.ri ? r1 : -hl, yt = kAt(K, zb)[3] + 0.012, z = zb - 0.012;
    acc.quad({ color: 0x9a1212, glow: GLOW.brake, tag: 'hb' }, [[0.2, yt - 0.05, z], [-0.2, yt - 0.05, z], [-0.2, yt - 0.012, z], [0.2, yt - 0.012, z]], null, [0, 0, -1]); }
  // wheels (front pair steers)
  for (const sx of [1, -1]) { wheel(acc, sx, sx * (hw - 0.015), R, S.fa, 0.2, 16, S.wheel, 2); wheel(acc, sx, sx * (hw - 0.015), R, S.ra, 0.2, 16, S.wheel, 1); }
  // direction indicators at the four corners (flags 32 left / 64 right: _carfid.js flashes them), seen from ahead, behind and the side
  for (const sx of [1, -1]) {
    const d = { color: 0xd98a1c, glow: sx > 0 ? GLOW.indL : GLOW.indR, tag: 'ind' };
    faceDecal(1, sx > 0 ? rF[1][0] - 0.17 : -rF[1][0] + 0.02, sx > 0 ? rF[1][0] - 0.02 : -rF[1][0] + 0.17, rF[1][1] + 0.005, rF[1][1] + 0.06, d, null, undefined, 0.02);
    faceDecal(-1, sx > 0 ? rR[1][0] - 0.16 : -rR[1][0] + 0.02, sx > 0 ? rR[1][0] - 0.02 : -rR[1][0] + 0.16, ty0 + 0.005, ty0 + 0.065, d, null, undefined, 0.02);
    sideDecal(sx, hl - 0.34, hl - 0.2, rF[1][1] + 0.005, rF[1][1] + 0.06, d, null);
    sideDecal(sx, -hl + 0.2, -hl + 0.33, ty0 + 0.005, ty0 + 0.065, d, null);
  }
  // wipers, parked along the foot of the windscreen (they sweep about the screen's own normal: MATS.car mode 5, FLAG.wipe)
  { const z0 = wBase - 0.07, ya = topY(S, z0), yb = topY(S, z0 - 0.2), tl = Math.hypot(0.2, yb - ya), t = [0, (yb - ya) / tl, -0.2 / tl], n = [0, -t[2], t[1]], hs = ring(z0)[4][0];
    for (const px of [-hs * 0.86, -hs * 0.06]) {
      const P0 = [px, ya + n[1] * 0.014, z0 + n[2] * 0.014], len = hs * 0.82, d = { color: C.black, wheel: [P0[0], P0[1], P0[2], 5], tag: 'wiper' };
      const q = (u, w) => [P0[0] + u, P0[1] + t[1] * w, P0[2] + t[2] * w];
      acc.tri(d, q(0, -0.012), n, null, q(len, -0.012), n, null, q(len, 0.014), n, null); acc.tri(d, q(0, -0.012), n, null, q(len, 0.014), n, null, q(0, 0.014), n, null);
    } }
  acc.flush(b);
  // underside / arch liners, mirrors
  b.box(S.W - 0.48, R * 2 + 0.14 - S.gc, S.L - 0.3, 0, (R * 2 + 0.16 + S.gc) / 2, 0, C.under, 'body', 0, 0, 0, '2').set({ v: 1 });
  carCabin(S, T, b, ring, { g0, g1, wTop, wBase, r0, r1 });
  { const z = wBase - 0.04, y = kAt(K, z)[1] + (S.van ? 0.3 : 0.07), x = ringX(ring(z), S.van ? y : kAt(K, z)[1]);      // (at the door line: above it the ring has run in to the middle of the scuttle, where both mirrors used to sit)
    for (const sx of [1, -1]) {
      b.box(0.15, S.van ? 0.22 : 0.1, 0.07, sx * (x + 0.06), y, z, S.van ? C.black : TINT, 'body', 0, 0, 0, sx > 0 ? '1' : '0');
      b.box(0.12, S.van ? 0.18 : 0.07, 0.004, sx * (x + 0.06), y, z - 0.037, 0x15181b, 'body', 0, 0, 0, '01234');          // the mirror glass: a plain dark shape
    } }
  if (S.sign && !police) {
    const zc = wTop - 0.34, y = topY(S, zc) - 0.012, on = S.sign === 'taxiSign';
    b.box(0.5, 0.13, 0.14, 0, y + 0.06, zc, on ? C.amber : 0xf0f0ec, 'body', 0, 0, 0, '3').set({ glow: GLOW.sign, sign: true });
    for (const dir of [1, -1]) { const z = zc + dir * 0.073, xl = dir > 0 ? -0.24 : 0.24;
      acc.decal({ color: C.white, glow: GLOW.sign, tag: 'sign', sign: true }, [[xl, y + 0.005, z], [-xl, y + 0.005, z], [-xl, y + 0.12, z], [xl, y + 0.12, z]], S.sign, [0, 0, dir]); }
  }
  if (police) {
    // generic livery (no force name, crest or logo): Battenburg blocks are painted in the side tile; POLICE on the doors,
    // the roof and nothing else; a roof light bar and grille flashers whose two halves are lit by the beacon flags
    const P = POLICE_COLORS, van = !!S.van, pd = { color: C.white, tag: 'ptext' };
    for (const sx of [1, -1]) { if (van) sideDecal(sx, -1.7, 0.1, 1.42, 1.77, pd, 'police'); else sideDecal(sx, 0.28, 1.12, 0.755, 0.92, pd, 'police'); }
    const zc = van ? 0.2 : wTop - 0.4, yb = topY(S, zc) - 0.012;
    { const w2 = van ? 0.7 : 0.5, d2 = van ? 0.28 : 0.2, za = zc - 0.25 - d2, zb2 = zc - 0.25, ya = topY(S, za) + 0.008, y2 = topY(S, zb2) + 0.008;
      acc.decal(pd, [[w2, ya, za], [-w2, ya, za], [-w2, y2, zb2], [w2, y2, zb2]], 'police', [0, 1, 0]); }
    b.box(1.08, 0.05, 0.27, 0, yb + 0.025, zc, C.dark, 'body', 0, 0, 0, '3');
    b.box(0.14, 0.09, 0.2, 0, yb + 0.095, zc, 0xd8dde2, 'body', 0, 0, 0, '3');
    for (const sd of [-1, 1]) {
      b.box(0.44, 0.1, 0.23, sd * 0.3, yb + 0.1, zc, P.lens, 'body', 0, 0, 0, '3').set({ glow: sd > 0 ? GLOW.beaconA : GLOW.beaconB });
      faceDecal(1, sd * 0.14 - 0.06, sd * 0.14 + 0.06, rF[2][1] - 0.075, rF[2][1] - 0.03, { color: P.lens, glow: sd > 0 ? GLOW.beaconB : GLOW.beaconA, tag: 'gb' + sd }, null, undefined, 0.024);
    }
    if (van) for (let i = -2; i < 2; i++) faceDecal(-1, i * hw * 0.42, (i + 1) * hw * 0.42, 0.86, 1.5, { color: C.white, tag: 'chev' }, 'chev', undefined, 0.018);
    else for (const sx of [1, -1]) faceDecal(-1, sx > 0 ? 0.3 : -hw * 0.72, sx > 0 ? hw * 0.72 : -0.3, py - 0.09, py + 0.1, { color: C.white, tag: 'chev' }, 'chev', [0, 0.2, 1, 0.8], 0.018);
    acc.flush(b);
  }
  acc.flush(b);
  return { b, pivots: { body: [0, 0, 0] }, style };
}

// ---------------------------------------------------------------- the inside of a car (car-fidelity pass, 2026-11)
// Only in the "open" bake (pieces with v: 2; the far, painted bake keeps the box under the body, v: 1): a lining inside
// the shell with the window openings left out, pillars with thickness, floor, dashboard, steering wheel (turns with the
// front wheels: MATS.car mode 3.6+), seats with headrests, rear bench, parcel shelf. All matte, dark. The glass itself is
// NOT in this bake: the faces marked gl: 1 are drawn by systems/_carfid.js in one blended draw for every car near.
const CAB = { card: 0x30333a, trim: 0x3d4047, seat: 0x4a505a, seatB: 0x3c4149, dash: 0x212327, head: 0x8a8a85, wheel: 0x131415, floor: 0x1c1d20, shelf: 0x2d3035, rubber: 0x0e0f10 };
const DROP = { color: 0, v: 9 };
export const WHEEL_AT = { y: 0.955, z: 0.615, tilt: 0.42, r: 0.17 };          // the steering wheel from the driver's feet origin (where the 'drive' pose holds its hands)
/** Where people sit in a body (vehicle frame, the character's feet origin): { d driver, p front passenger, rear: [nearside, offside] } */
function cabSeats(S, T) {
  const sx = T.seat.x, oy = T.seat.y - 0.45, sz = T.seat.z;
  const r0 = S.ri ? S.K[S.ri[0]][0] : -S.hl;
  const rz = S.van ? null : S.name === 'cab' ? -1.15 : Math.max(sz - 0.86, r0 + (S.ri && S.ri[0] === 0 ? 0.62 : 0.84));
  return { d: [sx, oy, sz], p: [-sx, oy, sz], rear: rz === null ? [] : [[-sx, oy + 0.03, rz], [sx, oy + 0.03, rz]], rz };
}
function carCabin(S, T, b, ring, G) {
  const K = S.K, hw = S.W / 2, hl = S.hl, R = S.R, P = cabSeats(S, T), [sx, oy, sz] = P.d;
  const M = { v: 2, matte: true };
  const cb = (w, h, d, x, y, z, col, rx = 0, skip = '') => b.box(w, h, d, x, y, z, col, 'body', rx, 0, 0, skip).set(M);
  const zA = S.ri ? G.r0 : G.g0 - 0.3, zB = G.wBase;
  // ---- the lining: the shell again, 4 cm in, facing inwards, the window openings left out
  const acc = new Acc();
  const card = { color: CAB.card, ...M }, trim = { color: CAB.trim, ...M }, head = { color: CAB.head, ...M }, rub = { color: CAB.rubber, ...M };
  const rin = (z) => { const k = kAt(K, z), c = clamp01((k[2] - k[1]) / 0.2); return ring(z).map((q, j) => [q[0] > 0.06 ? q[0] - 0.04 : q[0], j === 0 ? q[1] + 0.02 : j >= 3 ? q[1] - 0.035 * c : q[1]]); };
  const zl = [zA, ...S.zs.filter((z) => z > zA + 0.02 && z < zB - 0.02), zB];
  loft(acc, zl, rin, (i, k, z0, z1) => {
    const zm = (z0 + z1) / 2;
    if (k === 2 && zm > G.g0 && zm < G.g1) return DROP;
    if (k === 4 && ((zm > G.wTop && zm < G.wBase) || (S.ri && zm > G.r0 && zm < G.r1))) return DROP;
    return k <= 1 ? card : k === 2 ? (S.van ? card : trim) : k === 3 ? trim : head;
  }, S.crease);
  acc.flip();
  // ---- thickness round the openings: the ledges between the shell and the lining (window rubber)
  for (let i = 0; i < zl.length - 1; i++) {
    const za = zl[i], zb = zl[i + 1], zm = (za + zb) / 2, oa = ring(za), ob = ring(zb), ia = rin(za), ib = rin(zb);
    const led = (j, hint) => { for (const s of [1, -1]) acc.quad(rub, [[s * oa[j][0], oa[j][1], za], [s * ob[j][0], ob[j][1], zb], [s * ib[j][0], ib[j][1], zb], [s * ia[j][0], ia[j][1], za]], null, [hint[0] * s, hint[1], hint[2]]); };
    if (zm > G.g0 && zm < G.g1) { led(2, [0, 1, 0]); led(3, [0, -1, 0]); }
    if ((zm > G.wTop && zm < G.wBase) || (S.ri && zm > G.r0 && zm < G.r1)) led(4, [-1, 0, 0]);
  }
  for (const [z, dir] of S.ri ? [[G.wTop, 1], [G.r1, -1]] : [[G.wTop, 1]]) {
    const o = ring(z), q = rin(z), n = o.length;
    for (let j = 4; j < n - 1; j++) for (const s of [1, -1]) acc.quad(rub, [[s * o[j][0], o[j][1], z], [s * o[j + 1][0], o[j + 1][1], z], [s * q[j + 1][0], q[j + 1][1], z], [s * q[j][0], q[j][1], z]], null, [0, -0.2, dir]);
    if (S.van) acc.quad(rub, [[o[4][0], o[4][1], z], [-o[4][0], o[4][1], z], [-q[4][0], q[4][1], z], [q[4][0], q[4][1], z]], null, [0, -0.2, dir]);
  }
  // ---- the pillars the painted glass only draws as bars: an outer face, an inner face and the two sides between
  for (const u of S.bars) {
    const zc = G.g0 + u * (G.g1 - G.g0), hwd = 0.04;
    for (const s of [1, -1]) {
      const pt = (z, j, inn) => { const r = inn ? rin(z) : ring(z); return [s * (r[j][0] + (inn ? 0 : 0.003)), r[j][1], z]; };
      const a = zc - hwd, c = zc + hwd;
      acc.quad({ color: C.black }, [pt(a, 2), pt(c, 2), pt(c, 3), pt(a, 3)], null, [s, 0, 0]);
      acc.quad(trim, [pt(a, 2, 1), pt(c, 2, 1), pt(c, 3, 1), pt(a, 3, 1)], null, [-s, 0, 0]);
      acc.quad(rub, [pt(a, 2), pt(a, 3), pt(a, 3, 1), pt(a, 2, 1)], null, [0, 0, -1]);
      acc.quad(rub, [pt(c, 2), pt(c, 3), pt(c, 3, 1), pt(c, 2, 1)], null, [0, 0, 1]);
    }
  }
  const n0 = b.pieces.length;
  acc.flush(b);
  for (let i = n0; i < b.pieces.length; i++) if (!b.pieces[i].v) b.pieces[i].v = 2;
  // ---- floor, and the boxes that close the engine bay and the boot (the far bake's one box would stand in the cabin)
  const top = R * 2 + 0.14, wz = sz + WHEEL_AT.z, wy = oy + WHEEL_AT.y;
  const dz1 = zB + 0.05, dz0 = Math.min(wz + 0.12, zB - 0.12), dtop = kAt(K, zB)[1] - 0.015;
  const zr1 = S.van ? zA : P.rz - 0.3;
  b.box(S.W - 0.48, top - S.gc, hl - 0.15 - dz1, 0, (top + S.gc) / 2, (hl - 0.15 + dz1) / 2, C.under, 'body', 0, 0, 0, '2').set({ v: 2 });
  if (zr1 > -hl + 0.2) b.box(S.W - 0.48, Math.min(top, oy + 0.52) - S.gc, zr1 + hl - 0.15, 0, (Math.min(top, oy + 0.52) + S.gc) / 2, (zr1 - hl + 0.15) / 2, CAB.floor, 'body', 0, 0, 0, S.van ? '2' : '').set(M);
  cb(S.W - 0.48, S.gc - 0.03, dz1 - zr1, 0, (S.gc + 0.03 + 0.06) / 2, (dz1 + zr1) / 2, CAB.floor);
  // ---- dashboard, instrument cowl, steering wheel and column, the rear-view mirror
  { const w = 2 * (ringX(ring(dz0), dtop - 0.05) - 0.05);
    cb(w, 0.36, dz1 - dz0, 0, dtop - 0.18, (dz0 + dz1) / 2, CAB.dash);
    cb(0.34, 0.07, 0.17, sx, dtop + 0.03, dz0 + 0.1, CAB.dash);
    const e = WHEEL_AT.tilt, wh = { ...M, wheel: [sx, wy, wz, 3.6 + e * 0.5] };
    const put = (g) => { g.rotateX(Math.PI + e); g.translate(sx, wy, wz); b.add(g, CAB.wheel).set(wh); };
    put(new THREE.TorusGeometry(WHEEL_AT.r, 0.016, 5, 14)); put(new THREE.BoxGeometry(0.33, 0.04, 0.016)); put(new THREE.BoxGeometry(0.04, 0.17, 0.016).translate(0, 0.085, 0)); put(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8).rotateX(Math.PI / 2));
    b.rod([sx, wy, wz], [sx, wy - 0.12, dz0 + 0.03], 0.022, 5, CAB.dash).set(M);
    cb(0.16, 0.045, 0.02, 0, topY(S, G.wTop + 0.2) - 0.1, G.wTop + 0.2, CAB.rubber); }
  // ---- seats
  const seat = (x, y, z) => { cb(0.47, 0.13, 0.5, x, y + 0.4, z + 0.12, CAB.seat, 0, '3'); cb(0.45, 0.62, 0.11, x, y + 0.74, z - 0.22, CAB.seat, -0.16, '3'); cb(0.25, 0.17, 0.1, x, y + 1.2, z - 0.3, CAB.seatB); };
  seat(sx, oy, sz); seat(-sx, oy, sz);
  if (P.rz !== null) {
    const y = P.rear[0][1], z = P.rz, w = 2 * (hw - 0.15);
    cb(w, 0.14, 0.5, 0, y + 0.4, z + 0.12, CAB.seat, 0, '3'); cb(w, 0.6, 0.11, 0, y + 0.73, z - 0.23, CAB.seat, -0.2, '3');
    for (const q of P.rear) cb(0.25, 0.16, 0.1, q[0], y + 1.17, z - 0.33, CAB.seatB);
    if (S.name === 'cab') cb(S.W - 0.22, 0.78, 0.04, 0, oy + 0.62, sz - 0.36, CAB.card);                 // the partition behind the cabbie (its glass left out)
    else if (S.ri) {
      const za = G.r0 + 0.07, zb = z - 0.3, ys = kAt(K, G.r0)[1] - 0.05;
      if (zb - za > 0.12) {
        cb(2 * (hw - 0.17), 0.03, zb - za, 0, ys, (za + zb) / 2, CAB.shelf);
        b.box(0.24, 0.085, 0.13, 0.28, ys + 0.058, (za + zb) / 2, 0xd9d2c0, 'body', 0, 0.2, 0).set({ ...M, odd: 1 });      // a box of tissues on the shelf (one car in four)
      }
    }
  } else cb(S.W - 0.14, kAt(K, zA)[2] - S.gc - 0.1, 0.04, 0, (kAt(K, zA)[2] + S.gc - 0.1) / 2, zA + 0.03, CAB.card);     // a van's bulkhead
  b.box(0.3, 0.012, 0.4, -sx, oy + 0.475, sz + 0.12, 0xd8d6cc, 'body', 0, 0.3, 0).set({ ...M, odd: 2 });                   // a newspaper on the passenger seat (another one in four)
}

// ---------------------------------------------------------------- buses: a c. 2013 low-floor double-decker and its single-deck sister
/** A flat end wall with rectangular windows cut out: `r` = the left half ring at that end, holes = [[x0, x1, y0, y1]...]. */
function capHoles(acc, r, z, dir, d, holes) {
  const ys = new Set(r.map((q) => q[1]));
  for (const h of holes) { ys.add(h[2]); ys.add(h[3]); }
  const Y = [...ys].sort((a, c) => a - c), nn = [0, 0, dir];
  const X = (y) => ringX(r, y);
  for (let i = 0; i < Y.length - 1; i++) {
    const ya = Y[i], yb = Y[i + 1]; if (yb - ya < 1e-4) continue;
    const h = holes.find((q) => q[2] <= ya + 1e-6 && q[3] >= yb - 1e-6);
    const strip = (xa0, xa1, xb0, xb1) => acc.quad(d, [[xa0, ya, z], [xa1, ya, z], [xb1, yb, z], [xb0, yb, z]], null, nn);
    if (h) { strip(-X(ya), h[0], -X(yb), h[0]); strip(h[1], X(ya), h[1], X(yb)); } else strip(-X(ya), X(ya), -X(yb), X(yb));
  }
}
function buildBus(style) {
  const dd = style === 'bus', T = TYPES.bus, hw = T.W / 2, hl = T.L / 2, R = T.R, Ra = R + 0.08, fa = 2.65, ra = -2.95;
  const b = new Builder(), acc = new Acc();
  const ys = dd ? [1.02, 1.96, 2.58, 3.52, 4.12, 4.32] : [1.0, 2.2, 2.74, 2.92], xf = dd ? [1, 1, 1, 1, 0.975, 0.82] : [1, 1, 0.98, 0.83];
  const ring = (z) => {
    const tf = Math.max(0, (z - (hl - 0.5)) / 0.5), tr = Math.max(0, (-z - (hl - 0.35)) / 0.35), wz = hw * (1 - 0.1 * tf * tf - 0.05 * tr * tr);
    let sill = 0.3;
    for (const az of [ra, fa]) { const dz = z - az; if (Math.abs(dz) < Ra - 1e-3) sill = Math.max(sill, R + Math.sqrt(Ra * Ra - dz * dz)); }
    const o = [[wz * 0.985, sill]];
    for (let j = 0; j < ys.length; j++) o.push([wz * xf[j], ys[j] - (j >= ys.length - 2 ? 0.12 * tf * tf : 0)]);
    return o;
  };
  const zs = [-hl, -hl + 0.35, -4.45, 3.42, 3.5, 4.66, hl - 0.5, hl];
  for (const az of [ra, fa]) for (let i = 0; i <= 6; i++) zs.push(az - Ra * Math.cos((Math.PI * i) / 6));
  zs.sort((a, c) => a - c);
  const glassD = { color: C.white, gl: 1, tag: 'bg', glow: GLOW.saloon, uv: (x, y, z, s, t) => tuv('busGlass', 0.5, t) };
  const tint = { color: TINT }, band = { color: C.cream }, roof = { color: C.roofW }, low = { color: TINT, shade: 0.92, tag: 'low' };
  const nTop = ys.length;                                   // index of the top strip
  const paint = (i, k, z0, z1, side) => {
    const zm = (z0 + z1) / 2;
    if (k === nTop || k === nTop - 1) return roof;
    if (side > 0 && k <= 1 && zm > 3.5 && zm < 4.66) return DROP;                       // the doorway: a real opening (the leaves below slide across it)
    if (k === 1) return zm > -4.45 && (zm < 3.42 || (side < 0 && zm < hl - 0.5)) ? glassD : tint;
    if (dd && k === 3) return zm > -hl + 0.35 ? glassD : tint;      // (upstairs the side glass runs on round to the front corner, as on an Enviro400 / Gemini: 2026-11-23, systems/busride.js's front seats)
    if (dd && k === 2) return band;
    return k === 0 ? low : tint;
  };
  const Lf = loft(acc, zs, ring, paint, 0.8);
  cap(acc, Lf, zs, zs.length - 1, 1, { color: TINT, tag: 'capF', v: 1 }, null, hw);
  cap(acc, Lf, zs, 0, -1, { color: TINT, tag: 'capR', v: 1 }, null, hw);
  const wsTop = dd ? 2.3 : 2.24;
  // (the open bake: the same end walls with the windows cut out of them, so the cab and the saloon are seen through real glass)
  capHoles(acc, ring(hl), hl, 1, { color: TINT, v: 2 }, dd ? [[-1.0, 1.0, 1.1, wsTop - 0.03], [-0.98, 0.98, 2.96, 3.7]] : [[-1.0, 1.0, 1.1, wsTop - 0.03]]);
  capHoles(acc, ring(-hl), -hl, -1, { color: TINT, v: 2 }, dd ? [[-0.95, 0.95, 2.78, 3.5]] : [[-0.95, 0.95, 1.5, 2.18]]);
  const sideDecal = (sx, z0, z1, y0, y1, d, tile, r) => {
    const X = (z, y) => sx * (ringX(ring(z), y) + 0.014), zl = sx > 0 ? z1 : z0, zr = sx > 0 ? z0 : z1;
    acc.decal(d, [[X(zl, y0), y0, zl], [X(zr, y0), y0, zr], [X(zr, y1), y1, zr], [X(zl, y1), y1, zl]], tile, [sx, 0, 0], r);
  };
  const faceDecal = (dir, x0, x1, y0, y1, d, tile, r, off = 0.014) => {
    const z = dir * (hl + off), xl = dir > 0 ? x0 : x1, xr = dir > 0 ? x1 : x0;
    acc.decal(d, [[xl, y0, z], [xr, y0, z], [xr, y1, z], [xl, y1, z]], tile, [0, 0, dir], r);
  };
  const lit = { color: C.white, glow: GLOW.led, tag: 'blind' };
  // front: windscreen (driver on the right), destination blind, upper-deck window, lamps, bumper, plate
  faceDecal(1, -1.0, 1.0, 1.1, wsTop - 0.03, { color: C.white, gl: 1, tag: 'drv:gf' }, 'gf0');
  faceDecal(1, -0.92, 0.92, wsTop + 0.05, wsTop + 0.47, lit, 'blind0');
  if (dd) faceDecal(1, -0.98, 0.98, 2.96, 3.7, { color: C.white, gl: 1, tag: 'gu', glow: GLOW.saloon }, 'gf0', [0, 0.3, 1, 1]);
  faceDecal(1, 0.62, 1.06, 0.62, 0.84, { color: C.white, glow: GLOW.lights, tag: 'head' }, 'head');
  faceDecal(1, -1.06, -0.62, 0.62, 0.84, { color: C.white, glow: GLOW.lights, tag: 'head' }, 'head', [1, 0, 0, 1]);
  faceDecal(1, -1.13, 1.13, 0.3, 0.52, { color: C.dark, tag: 'bump' }, null);
  faceDecal(1, -0.26, 0.26, 0.355, 0.465, { color: C.white, tag: 'plateF' }, 'plateF0', undefined, 0.024);
  // rear: window(s), engine vent, lamp stacks, route number, bumper, plate
  if (dd) faceDecal(-1, -0.95, 0.95, 2.78, 3.5, { color: C.white, gl: 1, tag: 'rw', glow: GLOW.saloon }, 'gr'); else faceDecal(-1, -0.95, 0.95, 1.5, 2.18, { color: C.white, gl: 1, tag: 'rw', glow: GLOW.saloon }, 'gr');
  faceDecal(-1, -0.75, 0.75, 0.72, 1.3, { color: C.white, tag: 'vent' }, 'vent', [0, 0, 1, 1]);
  for (const sx of [1, -1]) faceDecal(-1, sx > 0 ? 0.9 : -1.14, sx > 0 ? 1.14 : -0.9, 0.82, 1.42, { color: C.white, glow: GLOW.tail, tag: 'tail' }, 'tail', sx > 0 ? [0.5, 0, 0, 1] : [0, 0, 0.5, 1]);
  faceDecal(-1, -0.3, 0.3, dd ? 2.02 : 2.3, dd ? 2.4 : 2.62, lit, 'blind0', [0, 0, 0.215, 1]);
  // nearside: the route number over the entrance door (the same blind, cropped to its number)
  sideDecal(1, 3.8, 4.36, dd ? 2.36 : 2.25, dd ? 2.76 : 2.63, lit, 'blind0', [0, 0, 0.215, 1]);
  faceDecal(-1, -1.17, 1.17, 0.3, 0.52, { color: C.dark, tag: 'bump' }, null);
  faceDecal(-1, -0.26, 0.26, 0.56, 0.67, { color: C.white, tag: 'plateR' }, 'plateR0', undefined, 0.024);
  // nearside (left) entrance door; window pillars on both sides (same pitch as the passengers in busPassengers)
  // (car-fidelity pass: two real leaves over a real opening. Each is the painted glazed leaf (glass: drawn by _carfid.js up
  // close) and slides clear of the doorway as the doors open - MATS.car mode 6, the fraction of the flags float; the same
  // leaves, the same travel as the interior's (systems/_bus_interior.js DOOR_SLIDE). Behind them in the far bake: a dark
  // vestibule, so an open door at a distance does not show the street through the bus.)
  { const dTop = ys[1] - 0.02, x = hw + 0.016, SL = 0.5;
    for (const [za, zb, dir, s0] of [[3.5, 4.08, -1, 0.5], [4.08, 4.66, 1, 0]]) {
      const wv = [0, 0, dir * SL, 6];
      acc.decal({ color: C.white, gl: 1, glow: GLOW.saloon, tag: 'leaf', wheel: wv }, [[x, 0.36, zb], [x, 0.36, za], [x, dTop, za], [x, dTop, zb]], 'busDoor', [1, 0, 0], [s0, 0, s0 + 0.5, 1]);
      const fr = { color: 0x0e0f10, v: 2, tag: 'leaf', wheel: wv };
      const bar = (y0, y1, z0, z1) => acc.quad(fr, [[x + 0.004, y0, z1], [x + 0.004, y0, z0], [x + 0.004, y1, z0], [x + 0.004, y1, z1]], null, [1, 0, 0]);
      bar(0.36, 0.72, za, zb); bar(dTop - 0.06, dTop, za, zb); bar(0.72, dTop - 0.06, za, za + 0.05); bar(0.72, dTop - 0.06, zb - 0.05, zb);
      acc.quad({ ...fr, color: 0x1a1c20 }, [[x - 0.004, 0.36, za], [x - 0.004, 0.36, zb], [x - 0.004, 0.72, zb], [x - 0.004, 0.72, za]], null, [-1, 0, 0]);
    }
    const vd = { color: 0x23262b, v: 1, glow: GLOW.cabin, tag: 'vest' }, xi = 0.25, xo = hw - 0.01;
    acc.quad(vd, [[xi, 0.3, 3.5], [xi, 0.3, 4.66], [xi, dTop + 0.02, 4.66], [xi, dTop + 0.02, 3.5]], null, [1, 0, 0]);
    acc.quad({ ...vd, color: 0x4a4d53 }, [[xi, 0.3, 3.5], [xo, 0.3, 3.5], [xo, 0.3, 4.66], [xi, 0.3, 4.66]], null, [0, 1, 0]);
    acc.quad(vd, [[xi, dTop + 0.02, 3.5], [xo, dTop + 0.02, 3.5], [xo, dTop + 0.02, 4.66], [xi, dTop + 0.02, 4.66]], null, [0, -1, 0]);
    acc.quad(vd, [[xi, 0.3, 3.5], [xo, 0.3, 3.5], [xo, dTop + 0.02, 3.5], [xi, dTop + 0.02, 3.5]], null, [0, 0, 1]);
    acc.quad(vd, [[xi, 0.3, 4.66], [xo, 0.3, 4.66], [xo, dTop + 0.02, 4.66], [xi, dTop + 0.02, 4.66]], null, [0, 0, -1]);
    acc.quad({ color: 0xe0b81e, v: 1, tag: 'vest' }, [[xo, 0.3, 3.5], [xo + 0.02, 0.3, 3.5], [xo + 0.02, 0.3, 4.66], [xo, 0.3, 4.66]], null, [0, 1, 0]); }
  for (const sx of [1, -1]) {
    const d = { color: 0xd98a1c, glow: sx > 0 ? GLOW.indL : GLOW.indR, tag: 'ind' };
    faceDecal(1, sx > 0 ? 0.94 : -1.1, sx > 0 ? 1.1 : -0.94, 0.86, 0.94, d, null, undefined, 0.02);
    faceDecal(-1, sx > 0 ? 0.92 : -1.14, sx > 0 ? 1.14 : -0.92, 1.44, 1.54, d, null, undefined, 0.02);
    sideDecal(sx, hl - 0.75, hl - 0.6, 0.86, 0.94, d, null); sideDecal(sx, -hl + 0.4, -hl + 0.55, 1.44, 1.54, d, null);
  }
  const pil = { color: NOGLASS, tag: 'pil' };
  for (let i = 0; i < 8; i++) {
    const z = -hl + 0.6 + i * 1.32;
    for (const sx of [1, -1]) {
      if (z > -4.3 && z < 3.3) sideDecal(sx, z - 0.035, z + 0.035, ys[0], ys[1], pil, null);
      if (dd && z > -4.8) sideDecal(sx, z - 0.035, z + 0.035, ys[2], ys[3], pil, null);
    }
  }
  for (const sx of [1, -1]) { wheel(acc, sx, sx * (hw - 0.02), R, fa, 0.3, 14, 'wBus', 2); wheel(acc, sx, sx * (hw - 0.02), R, ra, 0.3, 14, 'wBus', 1); }
  acc.flush(b);
  b.box(T.W - 0.7, 1.0, T.L - 0.5, 0, 0.75, 0, C.under, 'body', 0, 0, 0, '2'); b.last.tag = 'under'; b.last.v = 1;      // (left out of the inside-view body: carGeo(..., inside), it would stand in the saloon)
  for (const sx of [1, -1]) b.box(0.1, 0.34, 0.08, sx * (hw * 0.9 + 0.13), 2.05, hl - 0.2, C.black, 'body', 0, 0, 0, sx > 0 ? '1' : '0');
  return { b, pivots: { body: [0, 0, 0] }, style };
}

const GLYPH = {
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
};
/** Axis-aligned pixel text. o = top-left corner; r/u = axis index (0 x, 1 y, 2 z) of the reading direction / glyph up, with signs. */
function pixelText(b, text, ps, o, r, rs, u, us, n, thick, color, node = 'body') {
  let cx = 0;
  for (const ch of text) {
    const G = GLYPH[ch];
    if (G) for (let row = 0; row < 7; row++) {
      const line = G[row];
      for (let c0 = 0; c0 < 5;) {
        if (line[c0] !== '1') { c0++; continue; }
        let c1 = c0; while (c1 < 5 && line[c1] === '1') c1++;
        const size = [0, 0, 0], pos = [o[0], o[1], o[2]];
        size[r] = (c1 - c0) * ps; size[u] = ps; size[n] = thick;
        pos[r] += rs * (cx + (c0 + c1) / 2 * ps); pos[u] -= us * (row + 0.5) * ps;
        b.box(size[0], size[1], size[2], pos[0], pos[1], pos[2], color, node);
        c0 = c1;
      }
    }
    cx += 5 * ps + ps * 1.6;
  }
  return cx - ps * 1.6;
}

// ---------------------------------------------------------------- punts
// An Oxford punt: ~7.3 m x 0.9 m flat-bottomed, square-ended, both ends raked; decked "till" at one end, open "well" at the
// other. In Oxford you stand in the well (on the floorboards) and the boat travels till-first; Cambridge punters stand on
// the till. Local +z = direction of travel, so the till is at +z and the punter stands near -z.
export const PUNT = { L: 7.3, W: 0.9, standZ: -2.75, floorY: -0.05, hands: [0.3, 1.2, -2.6], poleLen: 4.9 };

function buildPunt() {
  const b = new Builder(), L = PUNT.L, W = PUNT.W, hl = L / 2, hw = W / 2;
  const side = [[-hl, 0.14], [-hl + 0.95, -0.1], [hl - 0.95, -0.1], [hl, 0.14], [hl, 0.34], [-hl, 0.34]];
  { // planked sides: outer and inner faces, wood grain from the atlas running along the boat
    const acc = new Acc(), uv = (p) => tuv('wood', 0.5, clamp01((p[1] + 0.1) / 0.44));
    for (const sx of [1, -1]) for (const io of [1, -1]) {
      const x = sx * (hw - 0.018 + io * 0.0175), n = [sx * io, 0, 0], d = { color: C.varnish, node: 'hull', shade: io > 0 ? 1 : 0.8 };
      for (let i = 1; i < side.length - 1; i++) { const a = [x, side[0][1], side[0][0]], c = [x, side[i][1], side[i][0]], e = [x, side[i + 1][1], side[i + 1][0]]; acc.tri(d, a, n, uv(a), c, n, uv(c), e, n, uv(e)); }
    }
    acc.flush(b, 'hull');
  }
  b.box(W - 0.02, 0.035, L - 1.9, 0, -0.085, 0, C.varnish, 'hull', 0, 0, 0, '01').tile('wood');                    // flat bottom
  const rake = Math.atan2(0.24, 0.95), rl = Math.hypot(0.24, 0.95);
  b.box(W - 0.02, 0.035, rl, 0, 0.02, hl - 0.475, C.varnish, 'hull', -rake, 0, 0, '01').tile('wood');            // raked ends
  b.box(W - 0.02, 0.035, rl, 0, 0.02, -hl + 0.475, C.varnish, 'hull', rake, 0, 0, '01').tile('wood');
  b.box(W, 0.22, 0.04, 0, 0.24, hl - 0.02, C.varnish, 'hull').tile('wood');                          // square end boards
  b.box(W, 0.22, 0.04, 0, 0.24, -hl + 0.02, C.varnish, 'hull').tile('wood');
  b.box(0.07, 0.045, L + 0.02, hw - 0.01, 0.355, 0, C.rail, 'hull');                    // gunwales
  b.box(0.07, 0.045, L + 0.02, -hw + 0.01, 0.355, 0, C.rail, 'hull');
  // the till: a decked end, sloping gently up towards the bow
  b.box(W - 0.02, 0.035, 1.3, 0, 0.31, hl - 0.68, C.floor, 'hull', -0.06, 0, 0, '01').tile('wood');
  b.box(0.1, 0.03, 0.1, 0, 0.345, hl - 0.2, C.shoe, 'hull', 0, 0, 0, '3');   // mooring ring block on the till
  b.box(W - 0.06, 0.28, 0.035, 0, 0.17, hl - 1.33, C.varnish, 'hull');
  // floorboards and the punter's duckboards in the well
  b.box(W - 0.08, 0.018, 4.2, 0, -0.06, 0.15, C.floor, 'hull', 0, 0, 0, '013').tile('wood');
  for (let i = 0; i < 7; i++) b.box(W - 0.08, 0.025, 0.07, 0, -0.045, -hl + 0.95 + i * 0.13, C.floor, 'hull');
  for (const z of [-1.6, -0.4, 0.8, 2.0]) b.box(W - 0.04, 0.05, 0.05, 0, -0.04, z, C.rail, 'hull');   // stretchers
  // cushions + backrests (tint) - passengers recline facing the punter
  b.box(W - 0.12, 0.1, 1.15, 0, 0.0, 1.0, TINT, 'hull');
  b.box(W - 0.1, 0.06, 0.55, 0, 0.22, 1.72, C.varnish, 'hull', 0.95);
  b.box(W - 0.16, 0.1, 0.5, 0, 0.285, 1.66, TINT, 'hull', 0.95);
  b.box(W - 0.12, 0.1, 1.0, 0, 0.0, -0.75, TINT, 'hull');
  b.box(W - 0.1, 0.06, 0.55, 0, 0.22, -1.33, C.varnish, 'hull', -0.95);
  b.box(W - 0.16, 0.1, 0.5, 0, 0.285, -1.27, TINT, 'hull', -0.95);
  // paddle stowed on the floor
  b.box(0.04, 0.03, 1.1, 0.25, 0.0, 0.25, C.pole, 'hull');
  b.box(0.16, 0.02, 0.4, 0.25, 0.0, 0.95, C.pole, 'hull');
  // the pole: origin at its bottom end, along +y (node 'pole')
  b.rod([0, 0, 0], [0, PUNT.poleLen, 0], 0.022, 6, C.pole, 'pole');
  b.rod([0, -0.02, 0], [0, 0.12, 0], 0.026, 6, C.shoe, 'pole', 0.026, false);
  return { b, pivots: { hull: [0, 0, 0], pole: [0, 0, 0] } };
}
// rest pose of the pole when moored: lying along the boat on the till side
const POLE_REST = (() => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(-0.28, 0.4, -2.2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.02, 1).normalize()), new THREE.Vector3(1, 1, 1)); return m; })();

// ---------------------------------------------------------------- Sheffield bike stand
function buildStand() {
  const b = new Builder();
  b.tube([[0, 0, -0.38], [0, 0.62, -0.38], [0, 0.78, -0.3], [0, 0.82, 0], [0, 0.78, 0.3], [0, 0.62, 0.38], [0, 0, 0.38]], 0.024, 14, 5, C.steel, 'body');
  return { b, pivots: { body: [0, 0, 0] } };
}

// ---------------------------------------------------------------- baking
const _col = new THREE.Color(), _bv = new THREE.Vector3();
const tileDelta = (from, to) => { const a = TILES[from], c = TILES[to]; return a && c ? [c.uv[0] - a.uv[0], c.uv[1] - a.uv[1]] : null; };
/**
 * Merge pieces into one geometry (position, normal, color, uv). tintHex = the body colour baked into TINT pieces; null with
 * opt.mask = leave them white and write aTintMask (parked pools colour them per instance). opt.extra adds aWheel / aGlow
 * (MATS.car). opt.plate / opt.blind pick which registration / destination the tagged decals show; opt.driver swaps the
 * glass tiles for the ones with somebody at the wheel.
 */
function bake(pieces, tintHex, filter, pivots, toBody, opt = {}) {
  let n = 0; const use = [];
  for (const p of pieces) if (filter(p)) { use.push(p); n += p.pos.length / 3; }
  if (!n) return null;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const mask = opt.mask ? new Float32Array(n) : null, wh = opt.extra ? new Float32Array(n * 4) : null, gl = opt.extra ? new Float32Array(n) : null;
  let o = 0, castN = -1;
  for (const p of use) {
    const c = p.pos.length / 3;
    if (castN < 0 && p.matte) castN = o;             // (everything from the first cabin piece on is inside the shell: no need to draw it into the shadow map)
    pos.set(p.pos, o * 3); nor.set(p.nor, o * 3);
    if (toBody) {
      const pv = pivots[p.node];
      if (pv && (pv[0] || pv[1] || pv[2])) for (let i = o; i < o + c; i++) { pos[i * 3] += pv[0]; pos[i * 3 + 1] += pv[1]; pos[i * 3 + 2] += pv[2]; }
      if (p.node === 'pole') for (let i = o; i < o + c; i++) {
        _bv.fromArray(pos, i * 3).applyMatrix4(POLE_REST).toArray(pos, i * 3); _bv.fromArray(nor, i * 3).transformDirection(POLE_REST).toArray(nor, i * 3);
      }
    }
    const tinted = p.color === TINT, sh = p.shade ?? 1;
    _col.setHex(tinted ? (tintHex ?? 0xffffff) : p.sign && opt.signOff ? C.signOff : p.color);   // r152+: setHex converts sRGB -> linear
    const r = _col.r * sh, g = _col.g * sh, bl = _col.b * sh;
    let d = null;
    if (p.tag) {
      if (opt.plate && (p.tag === 'plateF' || p.tag === 'plateR')) d = tileDelta(p.tag + '0', p.tag + opt.plate);
      else if (opt.blind && p.tag === 'blind') d = tileDelta('blind0', typeof opt.blind === 'string' ? 'blindX' + opt.blind.slice(1) : 'blind' + opt.blind);
      else if (opt.driver && p.tag.startsWith('drv:')) d = tileDelta(p.tag.slice(4) + '0', p.tag.slice(4) + '1');
    }
    for (let i = 0; i < c; i++) {
      const k = o + i;
      col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = bl;
      if (p.uv) { uv[k * 2] = p.uv[i * 2] + (d ? d[0] : 0); uv[k * 2 + 1] = p.uv[i * 2 + 1] + (d ? d[1] : 0); } else { uv[k * 2] = WHITE_UV[0]; uv[k * 2 + 1] = WHITE_UV[1]; }
      if (mask) mask[k] = tinted ? 1 : 0;
      if (wh && p.wheel) { wh[k * 4] = p.wheel[0]; wh[k * 4 + 1] = p.wheel[1]; wh[k * 4 + 2] = p.wheel[2]; wh[k * 4 + 3] = p.wheel[3]; }
      if (gl) gl[k] = (p.glow || 0) + (p.matte ? 0.25 : 0);
    }
    o += c;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (mask) m.setAttribute('aTintMask', new THREE.BufferAttribute(mask, 1));
  if (wh) { m.setAttribute('aWheel', new THREE.BufferAttribute(wh, 4)); m.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); }
  m.userData.castN = castN < 0 ? n : castN;
  m.computeBoundingSphere();
  return m;
}

const _rigs = new Map();
function rig(type, hi, livery = null) {
  const k = type + (hi ? ':hi' : ':lo');
  let r = _rigs.get(k);
  if (!r) {
    const kind = type === 'stand' ? 'stand' : TYPES[type].kind;
    r = kind === 'bike' ? buildBike(type, hi) : kind === 'car' ? carRig(type, TYPES[type].colors[0], livery) : kind === 'punt' ? buildPunt() : buildStand();
    _rigs.set(k, r);
  }
  return r;
}
/** The pieces of a car / taxi / van / bus body for a colour (the colour picks the body style) and livery. */
function carRig(type, hex, livery = null) {
  if (livery && (type === 'bus' || TYPES[type].kind !== 'car')) livery = null;
  const style = livery === 'police' ? BASE_STYLE[type] : styleOf(type, hex), k = 'car:' + style + (livery ? ':' + livery : '');
  let r = _rigs.get(k);
  if (!r) { r = buildCar(style, livery); _rigs.set(k, r); }
  return r;
}
const _carGeo = new Map();
const pick = (hex, n) => ((hex >> 5) ^ (hex >> 13) ^ hex) % n;
/** One-draw car geometry (colour, plate, blind and driver baked; wheels and lamps are driven by MATS.car). blind: null =
 *  the colour's own, an index into BLINDS, or 'x<i>' = run-time blind i (dynBlind) */
const FAR = (p) => p.v !== 2 && p.v !== 9;                 // the painted bake: everything but the open bake's cabin
function carGeo(type, hex, livery = null, driver = false, blind = null, inside = false, open = false, plate = null, baseBody = false) {
  if (open) { driver = false; inside = false; }
  const k = type + ':' + hex + ':' + (livery || '') + (driver ? ':d' : '') + (blind !== null ? ':b' + blind : '') + (inside ? ':in' : '') + (open ? ':o' : '') + (plate !== null ? ':p' + plate : '') + (baseBody ? ':bb' : '');
  let g = _carGeo.get(k);
  if (!g) {
    const r = carRig(type, baseBody ? TYPES[type].colors[0] : hex, livery), odd = 1 + pick(hex >> 2, 4);
    // open (car-fidelity pass): no painted glass (systems/_carfid.js draws the panes), the cabin instead of the box under the body
    const f = open ? (p) => p.v !== 1 && p.v !== 9 && !p.gl && (!p.odd || p.odd === odd) : inside ? (p) => FAR(p) && p.tag !== 'under' && p.tag !== 'leaf' && p.tag !== 'vest' : FAR;
    g = bake(r.b.pieces, hex, f, r.pivots, false, { extra: true, plate: plate !== null ? plate : pick(hex, REGS.length), blind: blind !== null ? blind : pick(hex, BLINDS.length), driver });
    g.userData.style = r.style;
    _carGeo.set(k, g);
  }
  return g;
}

/** The open bake of a body (see carCabin): what systems/_carfid.js draws for a vehicle near the camera. */
export function openGeometry(type, hex, livery = null, blind = null, plate = null, baseBody = false) { return carGeo(type, hex, livery, false, blind, false, true, plate, baseBody); }
/** The registration a parked instance of a type shows (staticParts) */
export function parkedPlate(type) { return Math.max(0, CAR_TYPES.indexOf(type)) % REGS.length; }
const _glassT = new Map();
/** The panes of a body as plain arrays (vehicle frame): { n, pos, nor, uv (the painted glass tiles, with the driver's
 *  silhouette or without), lit (the saloon glow of a bus's panes), slide (z travel of a door leaf's pane) }. */
export function glassTemplate(type, hex, livery = null, driver = false) {
  const r = carRig(type, hex, livery), k = r.style + ':' + (driver ? 'd' : '');
  let t = _glassT.get(k);
  if (!t) {
    const g = bake(r.b.pieces, hex, (p) => p.gl && p.v !== 9, r.pivots, false, { extra: true, driver });
    const n = g ? g.attributes.position.count : 0, lit = new Float32Array(n), slide = new Float32Array(n);
    for (let i = 0; i < n; i++) { const gw = g.attributes.aGlow.array[i]; lit[i] = gw > 6.5 && gw < 7.5 ? 0.42 : 0; if (g.attributes.aWheel.array[i * 4 + 3] > 5.5) slide[i] = g.attributes.aWheel.array[i * 4 + 2]; }
    t = { n, pos: g ? g.attributes.position.array : new Float32Array(0), nor: g ? g.attributes.normal.array : new Float32Array(0), uv: g ? g.attributes.uv.array : new Float32Array(0), lit, slide, style: r.style };
    _glassT.set(k, t);
  }
  return t;
}
/** Where people sit in the body a (type, colour) is - vehicle frame, the feet origin of a seated character:
 *  { d: driver, p: front passenger | null, rear: [[x, y, z]...], wheel: [x, y, z] of the steering wheel } */
export function seatsOf(type, hex) {
  const T = TYPES[type], st = styleOf(type, hex);
  if (type === 'bus') return { d: [T.seat.x, T.seat.y - 0.45, T.seat.z], p: null, rear: [], wheel: [-0.75, 1.37, 4.79], style: st };
  const P = cabSeats(STY[st], T);
  return { d: P.d, p: P.p, rear: P.rear, wheel: [P.d[0], P.d[1] + WHEEL_AT.y, P.d[2] + WHEEL_AT.z], style: st };
}

// run-time blinds: the few DYN_BLINDS tiles, repainted in the atlas canvas when a route needs one (most recently used kept)
const _dyn = [];   // [{ text, slot }], newest last
/** the run-time blind showing route `num` to `dest` -> 'x<i>' (repaints a tile of the atlas when it is new) */
export function dynBlind(num, dest) {
  const text = num + '|' + dest;
  let e = _dyn.find((q) => q.text === text);
  if (e) { _dyn.splice(_dyn.indexOf(e), 1); _dyn.push(e); return 'x' + e.slot; }
  const slot = _dyn.length < DYN_BLINDS.length ? _dyn.length : _dyn.shift().slot;
  DYN_BLINDS[slot] = [String(num), String(dest)];
  _dyn.push({ text, slot });
  const t = TILES['blindX' + slot], cv = ATLAS && ATLAS.image;
  if (t && cv && cv.getContext) {
    try {
      const ctx = cv.getContext('2d');
      ctx.save(); ctx.translate(t.x, t.y); ctx.beginPath(); ctx.rect(-3, -3, t.w + 6, t.h + 6); ctx.clip(); t.paint(ctx, t.w, t.h); ctx.restore();
      ATLAS.needsUpdate = true;
    } catch (err) { console.warn('[vehicles] blind', err); }
  }
  return 'x' + slot;
}
/** the text a blind key shows: [num, dest] (tests) */
export function blindText(key, hex = null) {
  if (typeof key === 'string' && key[0] === 'x') return DYN_BLINDS[+key.slice(1)] || null;
  if (key === null || key === undefined) return BLINDS[pick(hex | 0, BLINDS.length)];
  return BLINDS[key] || null;
}

const _static = new Map();
/** Merged rest-pose geometry for InstancedMesh: { tint: geo|null (white, colour via instanceColor), rest: geo, all: both + aTintMask }. */
export function staticParts(type) {
  let s = _static.get(type);
  if (s) return s;
  const r = rig(type, false);
  s = {
    tint: bake(r.b.pieces, 0xffffff, (p) => p.color === TINT && FAR(p), r.pivots, true),
    rest: bake(r.b.pieces, 0, (p) => p.color !== TINT && FAR(p), r.pivots, true),
    all: bake(r.b.pieces, null, FAR, r.pivots, true, { mask: true, plate: Math.max(0, CAR_TYPES.indexOf(type)) % REGS.length }),   // one geometry for MATS.parked (a different registration per type)
  };
  _static.set(type, s);
  return s;
}

const _live = new Map();
function liveGeo(type, hex, node) {
  const k = type + ':' + hex + ':' + node;
  let g = _live.get(k);
  if (g === undefined) {
    if (node === 'far') {
      // whole bike at rest pose in ONE mesh from the low-detail rig (the parked-bike model): distance LOD, wheels and
      // cranks turning are invisible at 30 m+
      const lo = rig(type, false);
      g = bake(lo.b.pieces, hex, (p) => p.node !== 'lights', lo.pivots, true);
    } else {
      const r = rig(type, TYPES[type].kind === 'bike');
      g = bake(r.b.pieces, hex, (p) => p.node === node, r.pivots, false);
    }
    _live.set(k, g);
  }
  return g;
}

/** A complete static mesh in one draw call (used for other players' vehicles). */
export function makeGhost(type, hex, livery = null) {
  if (!TYPES[type]) type = 'bike_roadster';
  hex = hex ?? TYPES[type].colors[0];
  let g;
  if (TYPES[type].kind === 'car') g = carGeo(type, hex, livery, false);
  else {
    const k = type + ':' + hex + ':ghost';
    g = _live.get(k);
    if (!g) { const r = rig(type, false); g = bake(r.b.pieces, hex, () => true, r.pivots, true); _live.set(k, g); }
  }
  const m = new THREE.Mesh(g, MATS.body);
  m.castShadow = TYPES[type].kind === 'car';
  m.name = 'vehicle-ghost:' + type;
  return m;
}

// headlight beam: a fan of vertex-coloured triangles, additive (no texture, no light)
let _beamGeo = null;
function beamGeo() {
  if (_beamGeo) return _beamGeo;
  const rows = [[0, 0.7, 0.55], [3, 2.2, 0.35], [8, 4.2, 0.16], [15, 6.5, 0.0]];  // [z, half width, brightness]
  const pos = [], col = [], idx = [];
  for (const [z, w, c] of rows) { pos.push(-w, 0, z, 0, 0, z, w, 0, z); col.push(0, 0, 0, c, c * 0.95, c * 0.8, 0, 0, 0); }
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < 2; i++) {
    const a = r * 3 + i, b2 = a + 1, c = a + 3, d = a + 4;
    idx.push(a, c, b2, b2, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return (_beamGeo = g);
}

// bodywork and glass mirror the sky at a glancing angle (world/materials.js addSkySheen)
for (const k of ['body', 'parked', 'car']) addSkySheen(MATS[k], 0.42);
{ // ... except in the matte parts of a car's own draw (its cabin and the people in it)
  const prev = MATS.car.onBeforeCompile;
  MATS.car.onBeforeCompile = (sh, r) => { prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace(/totalEmissiveRadiance \+= shC \* shF \* ([0-9.]+);/, 'totalEmissiveRadiance += shC * shF * $1 * ( 1.0 - vMatte );'); };
}

// single-deckers: the passenger silhouettes jobs.js hangs on a bus are laid out for two decks; keep the lower one
const _lowerPax = new WeakMap();
function lowerDeckOnly(geo) {
  if (!geo || !geo.attributes || !geo.attributes.position) return geo;
  let g = _lowerPax.get(geo);
  if (!g) {
    const P = geo.attributes.position, keep = [];
    for (let i = 0; i < P.count; i += 3) if (P.getY(i) < 2.3) keep.push(i, i + 1, i + 2);
    g = new THREE.BufferGeometry();
    for (const k of Object.keys(geo.attributes)) { const a = geo.attributes[k], sz = a.itemSize, out = new Float32Array(keep.length * sz); keep.forEach((v, j) => { for (let q = 0; q < sz; q++) out[j * sz + q] = a.array[v * sz + q]; }); g.setAttribute(k, new THREE.BufferAttribute(out, sz)); }
    g.computeBoundingSphere();
    _lowerPax.set(geo, g);
  }
  return g;
}

/**
 * Animated rig. Returns { type, kind, group (root: position + rotation.y heading, rotation order YXZ for lean/pitch),
 *   setColor(hex), setLights(on), color, beam Mesh, ...}
 * bikes: frame Mesh, steer Group, wheelF, wheelR, crank, lights Mesh, setFar(far)
 * cars:  body (ONE InstancedMesh of 1, MATS.car), drive(speed, steer, dt, held) -> wheel spin / steering / brake lamps,
 *        setSign(on) (taxi roof sign), setBeacon(phase) + beacon (police), style
 * punts: body, pole
 */
export function makeLive(type, hex, opts = {}) {
  const T = TYPES[type];
  hex = hex ?? T.colors[0];
  const root = new THREE.Group(); root.rotation.order = 'YXZ'; root.name = 'vehicle:' + type;
  const livery = T.kind === 'car' && type !== 'bus' ? opts.livery || null : null;
  const r = T.kind === 'car' ? null : rig(type, T.kind === 'bike');
  const o = { type, kind: T.kind, group: root, color: hex, lightsOn: false, signOff: false, livery, fadeL: VFADE_STEPS };
  const mk = (node, parent, pv) => {
    const g = liveGeo(type, hex, node);
    if (!g) return null;
    const m = new THREE.Mesh(g, node === 'lights' ? MATS.lightsOff : MATS.body);
    if (pv) m.position.set(pv[0], pv[1], pv[2]);
    m.castShadow = node === 'frame' || node === 'hull';
    parent.add(m);
    return m;
  };
  let flags = 0, D = null;
  if (T.kind === 'bike') {
    o.frame = mk('frame', root);
    o.steer = new THREE.Group(); o.steer.position.set(0, 0, r.pivots.steer[2]); root.add(o.steer);
    mk('steer', o.steer);
    const fa = r.pivots.wheelF;
    o.wheelF = mk('wheelF', o.steer, [0, fa[1], fa[2] - r.pivots.steer[2]]);
    o.wheelR = mk('wheelR', root, r.pivots.wheelR);
    o.crank = mk('crank', root, r.pivots.crank);
    o.lights = mk('lights', root); o.lights.visible = false;     // tiny lamps: only drawn at night
    o.beam = new THREE.Mesh(beamGeo(), MATS.beam); o.beam.scale.set(0.45, 1, 0.6); o.beam.position.set(0, 0.04, 0.7);
  } else if (T.kind === 'car') {
    // one draw: body, glass, wheels, lamps, (AI) driver silhouette. The 3 "instance colour" floats are spin, steer, flags
    o.driverIn = !!opts.driver;
    o.blind = null;   // bus destination blind: null = the colour's own, a BLINDS index, or a run-time key (setBlind)
    o.inside = false; // bus: the camera is inside it (systems/busride.js): the body without the box under the floor
    const geo = carGeo(type, hex, livery, o.driverIn);
    const m = o.body = new THREE.InstancedMesh(geo, MATS.car, 1);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = true; m.name = 'vehicle-body:' + type; root.add(m);
    D = m.instanceColor.array;
    o.style = geo.userData.style; o.lights = null; o.driver = null;
    o.beam = new THREE.Mesh(beamGeo(), MATS.beam); o.beam.position.set(0, 0.05, T.L / 2);
    if (type === 'bus') o.beam.scale.set(1.15, 1, 1);
    flags = FLAG.sign;
    D[2] = flags;
    let spin = 0, ps = 0, bt = 0, door = 0;
    const put = (f) => { flags = f; D[2] = f + door; m.instanceColor.needsUpdate = true; };
    o.flags = () => flags;
    /** Bus: how far the entrance doors are open, 0..1 (the leaves slide in the body's own draw: the fraction of the flags float) */
    o.setDoor = (k) => { const d = Math.round(Math.max(0, Math.min(1, k)) * 90) / 100; if (d !== door) { door = d; put(flags); } };
    o.doorOpen = () => door / 0.9;
    /** (Re)pick the body's geometry: the painted bake for its colour / blind, or whatever o.geoHook(o, painted) returns
     *  (systems/_carfid.js: the open bake with the cabin and the people in it, while the vehicle is near the camera). */
    o.geoHook = null;
    o.regeo = () => {
      const base = carGeo(type, o.color, livery, o.driverIn, o.blind, o.inside); o.style = base.userData.style;
      const g = (o.geoHook && o.geoHook(o, base)) || base;
      if (m.geometry !== g) { m.geometry = g; m.boundingSphere = null; }
    };
    o.setFlag = (bit, on) => { const f = on ? flags | bit : flags & ~bit; if (f !== flags) put(f); };
    /** Per frame for a moving or occupied car: wheels roll with the speed and steer, brake lamps light when it slows (or waits with someone at the wheel). */
    o.drive = (speed, steer, dt, held) => {
      if (dt > 0) {
        const a = (Math.abs(speed) - Math.abs(ps)) / dt; ps = speed;
        if (a < -1.4) bt = 0.35; else if (bt > 0) bt -= dt;
        spin = (spin + (speed / T.R) * dt) % TAU;
      }
      const brake = bt > 0 || (!!held && Math.abs(speed) < 0.12);
      const f = brake ? flags | FLAG.brake : flags & ~FLAG.brake;
      if (f !== flags || spin !== D[0] || steer !== D[1]) { D[0] = spin; D[1] = steer; put(f); }
    };
    if (type === 'bus') {
      let pm = null;
      Object.defineProperty(o, 'paxMesh', { configurable: true, enumerable: true, get: () => pm, set: (mesh) => {
        pm = mesh; if (!mesh) return;
        let raw = mesh.geometry;
        Object.defineProperty(mesh, 'geometry', { configurable: true, enumerable: true, get: () => (o.style === 'bus1' ? lowerDeckOnly(raw) : raw), set: (g) => { raw = g; } });
      } });
    }
  } else {
    o.body = mk('hull', root);
    o.pole = mk('pole', root);
    o.pole.applyMatrix4(POLE_REST);
  }
  if (o.beam) { o.beam.visible = false; o.beam.castShadow = false; o.beam.renderOrder = 2; root.add(o.beam); BEAMS.push(o.beam); }   // (BEAMS: the light map draws a pool of light ahead of every lit headlamp)
  if (livery === 'police') {
    // flashing light bar: the two halves glow on alternate phases (flags), in the body's own draw
    o.beacon = o.body; o.beaconPhase = -1;
    o.setBeacon = (ph) => { ph = ph ? 1 : 0; if (ph === o.beaconPhase) return; o.beaconPhase = ph; o.setFlag(FLAG.beaconA, ph === 0); o.setFlag(FLAG.beaconB, ph === 1); };
  }
  const recolor = (mesh, node) => { if (mesh) mesh.geometry = liveGeo(type, o.color, node); };
  o.setColor = (c) => {
    if (c === o.color) return;
    o.color = c;
    if (T.kind === 'bike') { recolor(o.frame, 'frame'); recolor(o.steer.children[0], 'steer'); if (o.far) recolor(o.far, 'far'); }
    else if (T.kind === 'car') o.regeo();
    else recolor(o.body, 'hull');
  };
  /** Bus destination blind (front, nearside, rear): null = the colour's own, an index into BLINDS (an AI bus's route),
   *  or { num, dest } = the route being run (a run-time tile). */
  o.setBlind = (b) => {
    if (type !== 'bus' || !o.body) return;
    const key = b && typeof b === 'object' ? dynBlind(b.num, b.dest) : b ?? null;
    if (key === o.blind) return;
    o.blind = key;
    o.regeo();
  };
  /** Bus: the local camera is inside this one (true) or not. Inside, the body is drawn without the box that closes the
   *  underside (it would stand a metre high in the saloon); the hull itself is single-sided, so from inside it is not
   *  drawn at all and the interior (systems/_bus_interior.js) is what is seen. A geometry swap, like setBlind. */
  o.setInside = (on) => {
    on = !!on;
    if (type !== 'bus' || !o.body || on === o.inside) return;
    o.inside = on;
    o.regeo();
  };
  /** Taxi "for hire" roof sign on/off (off once the player has taken the cab). */
  o.setSign = (on) => {
    if (T.kind !== 'car' || o.signOff === !on) return;
    o.signOff = !on; o.setFlag(FLAG.sign, !!on);
  };
  o.setLights = (on) => {
    if (on === o.lightsOn) return;
    o.lightsOn = on;
    if (T.kind === 'car') o.setFlag(FLAG.lights, on);
    else if (o.lights) { const b = on ? MATS.lightsOn : MATS.lightsOff; o.lights.material = o.fadeL > 0 && o.fadeL < VFADE_STEPS ? vfadeMat(b, o.fadeL) : b; o.lights.visible = on; }
    if (o.beam) o.beam.visible = on;
  };
  if (T.kind === 'bike') {
    // distance LOD for bikes: one merged mesh instead of frame + bars + 2 wheels + cranks (5 draws -> 1)
    o.isFar = false; o.far = null;
    const parts = [o.frame, o.steer, o.wheelR, o.crank];
    o.setFar = (far) => {
      if (far === o.isFar) return;
      o.isFar = far;
      if (far && !o.far) { o.far = new THREE.Mesh(liveGeo(type, o.color, 'far'), o.fadeL > 0 && o.fadeL < VFADE_STEPS ? vfadeMat(MATS.body, o.fadeL) : MATS.body); o.far.castShadow = true; o.far.name = 'bike-far'; root.add(o.far); }
      for (const p of parts) if (p) p.visible = !far;
      if (o.far) o.far.visible = far;
    };
  }
  return o;
}

// ---------------------------------------------------------------- driver's door (the take-a-vehicle sequence)
// A swinging door panel for the right-hand (driver's) side, only shown for the ~0.8 s of the enter sequence: one draw,
// vertex-coloured MATS.body (no new shader). Origin at the front hinge; the panel runs back along -z; +rotation.y opens it.
const DOOR = { car_hatch: [1.05, 0.3, 1.42], car_saloon: [1.0, 0.3, 1.4], taxi: [1.0, 0.32, 1.8], van: [0.95, 0.34, 2.1], bus: [0.85, 0.45, 2.25] };
export function doorInfo(type) {
  const T = TYPES[type], d = DOOR[type] || DOOR.car_saloon;
  return { len: d[0], y0: d[1], y1: d[2], x: -(T.W / 2) - 0.02, z: T.seat.z + 0.55 };
}
export function makeDoor(type, hex) {
  const k = type + ':' + hex + ':door';
  let g = _live.get(k);
  if (!g) {
    const b = new Builder(), d = doorInfo(type), h = d.y1 - d.y0, glass = h * 0.38;
    b.box(0.05, h - glass, d.len, -0.025, d.y0 + (h - glass) / 2, -d.len / 2, TINT, 'door');
    b.box(0.04, glass - 0.06, d.len - 0.12, -0.025, d.y1 - glass / 2, -d.len / 2 - 0.02, 0x6f93ad, 'door');
    b.box(0.07, 0.04, 0.14, -0.06, d.y0 + (h - glass) * 0.75, -d.len + 0.15, C.dark, 'door');
    g = bake(b.pieces, hex, () => true, {}, false);
    _live.set(k, g);
  }
  const m = new THREE.Mesh(g, MATS.body);
  m.name = 'vehicle-door:' + type;
  return m;
}

/** Bike front-wheel axle / BB etc. for animation code. */
export function bikePivots(type) { return rig(type, true).pivots; }

// ---------------------------------------------------------------- police helicopter (level 5)
// ONE mesh: fuselage, tail, skids and the main rotor baked together; the rotor "turns" by swapping between 6 pre-baked
// blade angles (heliGeo(k)). Generic dark-blue-and-yellow scheme, POLICE on both sides and the belly.
const _heli = [];
export function heliGeo(k) {
  k = ((k % 6) + 6) % 6;
  if (_heli[k]) return _heli[k];
  const b = new Builder(), P = POLICE_COLORS, navy = 0x1b2236, yel = 0xd9d322;
  b.box(1.5, 1.35, 3.0, 0, 0, 0.2, navy, 'h');
  b.box(1.4, 0.9, 1.0, 0, -0.08, 1.95, C.glass, 'h');                    // nose glazing
  b.box(1.52, 0.28, 3.02, 0, -0.35, 0.2, yel, 'h');                      // yellow band
  b.box(0.36, 0.36, 4.2, 0, 0.25, -3.3, navy, 'h');                      // tail boom
  b.box(0.08, 1.1, 0.7, 0, 0.75, -5.2, navy, 'h');                       // fin
  b.box(0.06, 0.9, 0.12, 0.22, 0.55, -5.25, C.dark, 'h');                // tail rotor
  b.box(0.9, 0.35, 1.2, 0, 0.82, -0.1, C.dark, 'h');                     // engine fairing
  for (const sx of [-0.75, 0.75]) {
    b.box(0.08, 0.08, 3.0, sx, -1.15, 0.3, C.dark, 'h');                 // skids
    b.box(0.06, 0.5, 0.06, sx * 0.9, -0.88, 1.1, C.dark, 'h'); b.box(0.06, 0.5, 0.06, sx * 0.9, -0.88, -0.6, C.dark, 'h');
  }
  pixelText(b, 'POLICE', 0.07, [0.762, 0.3, 1.25], 2, -1, 1, 1, 0, 0.01, P.white);
  pixelText(b, 'POLICE', 0.07, [-0.762, 0.3, -1.05], 2, 1, 1, 1, 0, 0.01, P.white);
  pixelText(b, 'POLICE', 0.09, [1.27, -0.69, 1.6], 0, -1, 2, 1, 1, 0.01, P.white);
  const a = (k / 6) * (Math.PI / 2);
  for (const q of [0, Math.PI / 2]) b.box(0.26, 0.04, 9.4, 0, 1.08, 0, C.dark, 'h', 0, a + q, 0);
  b.box(0.3, 0.2, 0.3, 0, 1.0, 0, C.dark, 'h');
  const g = bake(b.pieces, 0, () => true, {}, false);
  _heli[k] = g;
  return g;
}

// ---------------------------------------------------------------- bus passengers seen through the windows
// Head-and-shoulders silhouettes pressed just outside the bus's glass bands, colours mixed with the glass tint so they
// read as people behind tinted windows. n figures (0..14) from a seeded layout; cached per (n, seed % 4). One draw per bus.
const SEATS = (() => {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const z = -5.3 + 0.6 + 0.66 + i * 1.32;
    if (z < 3.2) for (const sx of [1, -1]) out.push([sx, z, 0]);              // lower deck (window band z < 3.3)
    if (z < 4.9) for (const sx of [1, -1]) out.push([sx, z + 0.05, 1]);       // upper deck
  }
  return out;
})();
const _pax = new Map();
const PAX_TOPS = [0x8a2a2a, 0x2a4a8a, 0x3a3a3a, 0xc8b070, 0x4a6a3a, 0x7a5a8a, 0xd0d0d0, 0x2a2a2a, 0xa05a2a];
const PAX_SKINS = [0xe0b090, 0xc08a68, 0x8a5a3a, 0xf0c8a8, 0x5a3a28];
const PAX_HAIRS = [0x2a1b10, 0x6a4a2a, 0x111111, 0xb0a080, 0x8a8a86];
/** Who sits where on an AI bus with n passengers (the seeded layout busPassengers draws on the glass; the interior seats
 *  the same people at the same windows): [{ sx (+1 nearside), z, deck (0 lower / 1 upper), top, skin, hair }]. Pure. */
export function busPaxLayout(n, seed = 0) {
  n = Math.max(0, Math.min(14, n | 0));
  let s = (seed & 3) * 7919 + 13;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const order = SEATS.map((q, i) => [rnd(), i]).sort((a, b) => a[0] - b[0]).map((q) => SEATS[q[1]]);
  const out = [];
  for (let i = 0; i < n && i < order.length; i++) {
    const [sx, z, deck] = order[i], dz = (rnd() - 0.5) * 0.25;
    out.push({ sx, z: z + dz, deck, top: PAX_TOPS[(rnd() * PAX_TOPS.length) | 0], skin: PAX_SKINS[(rnd() * PAX_SKINS.length) | 0], hair: PAX_HAIRS[(rnd() * PAX_HAIRS.length) | 0] });
  }
  return out;
}
const _paxTmp = new THREE.Color(), _paxGlass = new THREE.Color(C.glass);
function paxFigure(b, q) {
  const mix = (hex) => { _paxTmp.setHex(hex).lerp(_paxGlass, 0.5); return _paxTmp.getHex(); };
  const x = q.sx * (2.52 / 2 + 0.012), y0 = q.deck ? 2.73 : 1.27;
  b.box(0.006, 0.3, 0.44, x, y0 + 0.15, q.z, mix(q.top), 'p');
  b.box(0.006, 0.24, 0.19, x, y0 + 0.43, q.z, mix(q.skin), 'p');
  b.box(0.006, 0.07, 0.2, x, y0 + 0.56, q.z, mix(q.hair), 'p');
}
export function busPassengers(n, seed = 0) {
  n = Math.max(0, Math.min(14, n | 0));
  const k = n + ':' + (seed & 3);
  if (_pax.has(k)) return _pax.get(k);
  if (!n) { _pax.set(k, null); return null; }
  const b = new Builder();
  for (const q of busPaxLayout(n, seed)) paxFigure(b, q);
  const g = bake(b.pieces, 0, () => true, {}, false);
  _pax.set(k, g);
  return g;
}
/** One more figure on the glass, for a PLAYER riding as a passenger (systems/busride.js): q as in busPaxLayout. The
 *  caller owns the geometry (MATS.body, a child of the bus rig). */
export function busRiderFigure(q) {
  const b = new Builder();
  paxFigure(b, q);
  return bake(b.pieces, 0, () => true, {}, false);
}
/** The text on the in-bus next-stop display (the 'busNext' atlas tile, repainted like a run-time blind). */
export function setBusNext(text) {
  text = String(text || '').slice(0, 44);
  if (text === _busNext) return false;
  _busNext = text;
  const t = TILES.busNext, cv = ATLAS && ATLAS.image;
  if (t && cv && cv.getContext) {
    try {
      const ctx = cv.getContext('2d');
      ctx.save(); ctx.translate(t.x, t.y); ctx.beginPath(); ctx.rect(-3, -3, t.w + 6, t.h + 6); ctx.clip(); t.paint(ctx, t.w, t.h); ctx.restore();
      ATLAS.needsUpdate = true;
    } catch (err) { console.warn('[vehicles] bus display', err); }
  }
  return true;
}
export function busNextText() { return _busNext; }
/** Give a plain position / normal / colour geometry (a baked character) what MATS.car reads: the atlas's white texel,
 *  no wheel, one glow channel. Used for the people inside a bus at night, lit by the same saloon lamps as the seats. */
export function carAttrs(geo, glow = GLOW.cabin) {
  const n = geo.attributes.position.count, uv = new Float32Array(n * 2), gl = new Float32Array(n);
  for (let i = 0; i < n; i++) { uv[i * 2] = WHITE_UV[0]; uv[i * 2 + 1] = WHITE_UV[1]; gl[i] = glow; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aWheel', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  geo.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
  return geo;
}
/** Build a one-draw geometry for MATS.car (aWheel / aGlow written) or MATS.body from the vehicle kit: fn(b, kit) fills
 *  Builder b; kit = { acc (flushed for you), C, GLOW, tuv }. Used by systems/_bus_interior.js so the inside of a bus is
 *  made of the same pieces, atlas and material as the outside (no new shader, one draw). */
export function bakeBuild(fn, opts = {}) {
  const b = new Builder(), acc = new Acc();
  fn(b, { acc, C, GLOW, tuv });
  acc.flush(b);
  return bake(b.pieces, opts.tint ?? 0xffffff, () => true, {}, false, { extra: opts.extra !== false });
}
