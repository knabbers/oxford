// Worcester College gardens (places/worcester_gardens.js): the rose garden, the Hanging Garden's long raised walk with
// its steps, the Long Border's planting, the greenhouses and the shepherd's hut. Plan constants first (pure), then
// what is drawn into the college's Batch (_worcester_kit.js). u, v = the college's own frame (u east along the
// Terrace, v south: places/worcester.js), turned 4.36 degrees from the map's grid.
import * as THREE from 'three';
import { frame } from './_worcester_kit.js';
import { PK, LEAFS, hash as ph } from './_wgard_plants.js';

const PHI = 0.0761, CS = Math.cos(PHI), SN = Math.sin(PHI);
export const L2W = (u, v) => [-250 + u * CS + v * SN, 10 - u * SN + v * CS];
export const W2L = (x, z) => [(x + 250) * CS - (z - 10) * SN, (x + 250) * SN + (z - 10) * CS];
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const hash = (a, b = 0) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

// ================================================================================================= the rose garden (G02)
// REBUILT 2026-11-22 (second pass) to the satellite picture the owner's rule asked for (`40 satellite (google maps)/rose
// garden satellite close…png`, summer 2026; scaled by the 15.3 m from the yew row to the quad wall's climbers and the
// 32.2 m from the Lodgings' wall to the laurel hedge). K from it:
//   * the yew columns stand along the WEST side (eleven seen, about 2.55 m apart, from the north-west corner to the
//     laurel hedge) and across the NORTH end (four more): fifteen; the gravel walk runs just outside the west row;
//   * inside a lawn margin lies ONE round-ended planted figure on the garden's axis: a half-round ring of planting at
//     the north end holding a half-round of lawn with a small pedestal in it; the long body, round-ended at the south;
//     a round with a pale base at its middle (the Mercury); a pale stone feature in the south round end;
//   * a small pale thing on the lawn at the south-west foot (the stone head: `31…/rose garden in winter…` 2015);
//   * a clipped hedge along the east side against the quad's wall (no separate long bed is seen).
// K (the gardeners' blog 2017; three winter and autumn photographs): ten beds cut in lawn, rectangular and curved,
// with mown grass paths about a metre wide between them: in summer the roses close over the paths, so the picture
// shows one mass. G: how the figure is cut into its ten beds (here: three lengthwise rows - the December 2023 aerial
// picture has them lying lengthwise - of two beds each either side of a cross path through the Mercury's round, the
// middle row's ends hollowed round it; two quarter-rings at each end); what the north pedestal carries (the Register's
// sundial of 1903 is put there) and what the south stone feature is (a stone seat on a paved apron).
// The gardeners' blog counts twenty columns; fifteen are seen: the other five are NOT built (where they stand is not known).
export const ROSE = (() => {
  const yewU = -66.3, ax = -58.4, cu = ax, cv = 2.7, v0 = -12.0, step = 2.54;
  const yews = []; for (let i = 0; i < 11; i++) yews.push([yewU, v0 + i * step]);
  for (const u of [-64.75, -62.1, -59.45, -56.8]) yews.push([u, v0]);      // (the mapped path from the quad wall's door passes just east of the last)
  const arc = (c, r, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n; return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]; });
  const P = Math.PI, hp = 0.5;      // half a grass path
  // the north half-round: two quarter-rings about cN (a = angle from east, towards the south positive)
  const cN = [ax, -4.4], Ro = 5.2, Ri = 3.7, da = (r) => Math.asin(hp / r);
  const ringN = (s) => (s < 0 ? [...arc(cN, Ro, P + 0.02, 1.5 * P - da(Ro)), ...arc(cN, Ri, 1.5 * P - da(Ri), P + 0.03).slice()] : [...arc(cN, Ro, 1.5 * P + da(Ro), 2 * P - 0.02), ...arc(cN, Ri, 2 * P - 0.03, 1.5 * P + da(Ri))]);
  // the body: three rows 2.8 m wide with two lengthwise paths, a cross path through the Mercury's round (radius 1.9)
  const uW = [-63.6, -60.8], uM = [-59.8, -57.0], uE = [-56.0, -53.2], vN = -3.4, vS = 8.6, rr = 1.9 + 0.35;
  const hollowS = (u0, u1, va) => { const d = Math.acos(Math.min(1, (u1 - ax) / rr)); return [[u0, va], [u1, va], ...arc([cu, cv], rr, -d, -(P - d), 6)]; };      // a bed north of the round, its south end hollowed
  const hollowN = (u0, u1, vb) => { const d = Math.acos(Math.min(1, (u1 - ax) / rr)); return [...arc([cu, cv], rr, P - d, d, 6), [u1, vb], [u0, vb]]; };
  const rect = (u0, v0b, u1, v1) => [[u0, v0b], [u1, v0b], [u1, v1], [u0, v1]];
  // the south half-round: two quarter-rings about cS round the stone seat
  const cS = [ax, vS + 1.0], Si = 2.7, ringS = (s) => (s < 0 ? [...arc(cS, Ro, P - 0.02, 0.5 * P + da(Ro)), ...arc(cS, Si, 0.5 * P + da(Si), P - 0.04)] : [...arc(cS, Ro, 0.5 * P - da(Ro), 0.02), ...arc(cS, Si, 0.04, 0.5 * P - da(Si))]);
  const beds = [ringN(-1), ringN(1), rect(uW[0], vN, uW[1], cv - hp), rect(uE[0], vN, uE[1], cv - hp), hollowS(uM[0], uM[1], vN), rect(uW[0], cv + hp, uW[1], vS), rect(uE[0], cv + hp, uE[1], vS), hollowN(uM[0], uM[1], vS), ringS(-1), ringS(1)];
  // the gravel walk's two mapped vertices, moved to 2.4 m west of the row (its edge half a metre from the columns)
  const walk = [[-319.5, 1.6], [-318.3, 18.9]];
  return { yewU, ax, cu, cv, yews, beds, walk, round: 1.9, dial: [ax, -5.9], seat: [ax, vS + 2.5], cN, cS,
    hedge: { u0: -69.4, u1: -53.4, v0: 15.5, v1: 17.7, h: 4.6 }, east: { u: -52.3, v0: -9.5, v1: 14.6, w: 1.0, h: 1.5 }, head: [-62.5, 14.75], lawn: [[-67.6, -16.3], [-53.4, -16.3], [-53.4, 15.5], [-67.6, 15.5]] };
})();

// ================================================================================================= the Hanging Garden (G06b)
// K (height survey): a level lawn at 60.4 - 60.9 m from world x -293 to -321, z 35.5 to 39, 2.6 - 3.0 m above the path
// to its south and 2.3 - 2.8 m above the rose garden; shrubs to x -325. K (Register of Parks and Gardens; satellite S1 and
// S13): its west end is reached from the south lawn by a flight of stone steps, a pale straight strip about 4 m long
// on the south side at the west end. K (`31…/secret garden above the rose garden…` 2015): a narrow lawn, a low rubble
// parapet on its north side with the laurel hedge beyond, the cottage's door and a table at its east end.
// The part against the Cottages (east of world x -300.6) with the tunnel under it is places/worcester.js's; this is the
// 21 m west of that. G: the steps' count (sixteen), the walls' exact lines, what closes the west end.
export const HG = { xE: -300.62, xW: -321.3, zN: 35.0, zS: 40.6, top: 2.7, stairW: 1.0, stairX0: -325.4, risers: 16 };
/** drawn floor heights on the Hanging Garden and its steps; null = not ours */
export function hgGroundY(x, z) {
  const H = HG;
  if (z < H.zN || z > H.zS || x > H.xE || x < H.stairX0) return null;
  if (x >= H.xW) return H.top;
  if (z < H.zS - H.stairW) return null;
  return H.top * Math.min(H.risers, Math.floor(((x - H.stairX0) / (H.xW - H.stairX0)) * H.risers) + 1) / H.risers;
}

// ================================================================================================= greenhouses, the hut
export const GREENHOUSES = [{ id: 'w69991310', poly: [[-264.1, -88.4], [-249.2, -89.8], [-249.8, -96.4], [-264.7, -95.0]], wall: 2.0, ridge: 3.4 }, { id: 'w69991266', poly: [[-266.4, -106.4], [-265.7, -99.5], [-262.1, -99.9], [-262.7, -106.8]], wall: 1.9, ridge: 2.9 }];
/** the shepherd's hut by the meadow (K that there is one, pale green with a curved roof: 31/provosts garden far end… 2016;
 *  G where: the small roofed thing the satellite picture S13 shows north of the south arm) */
export const HUT = { c: [-362.8, 23.4], dir: [0.99, 0.12], l: 3.7, w: 2.05 };

export function cells(pack) {
  const K = pack.cells; if (!K || !K.get('plaster') || K.get('wgYew')) return;
  const plain = K.get('plaster'), ash = K.get('stone'), boards = K.get('boards');
  K.set('wgYew', { ...plain, tint: lin(0x3a6630) }); K.set('wgYewL', { ...plain, tint: lin(0x4a7c3a) });
  K.set('wgLaurel', { ...plain, tint: lin(0x35662f) }); K.set('wgRoseLeaf', { ...plain, tint: lin(0x4c8040) });
  K.set('wgBronze', { ...plain, tint: lin(0x66757c) }); /* lead grey-blue: K, the 2014 pictures */ K.set('wgOldStone', { ...ash, tint: [0.82, 0.84, 0.74], seed: 0 });
  K.set('wgPink', { ...plain, tint: lin(0xe89ab4) }); K.set('wgCrimson', { ...plain, tint: lin(0xa8243c) }); K.set('wgCream', { ...plain, tint: lin(0xf0e8da) }); K.set('wgMauve', { ...plain, tint: lin(0x9a5aa8) });
  K.set('wgGlass', { ...plain, tint: lin(0xa9c4c0) }); K.set('wgRidge', { ...plain, tint: lin(0x3f7a52) });
  K.set('wgHut', { ...boards, tint: lin(0x9fb3a4) }); K.set('wgHutRoof', { ...plain, tint: lin(0x555d60) });
  K.set('wgStep', { ...K.get('pavingSolid'), tint: [1.05, 1.02, 0.94] });
  K.set('wgStemY', { ...plain, tint: lin(0xd6a02c) }); K.set('wgStemR', { ...plain, tint: lin(0xc2452a) });
}

const pip = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };

/**
 * A deep herbaceous border from ground point a to b, its back along that line (a wall's foot) and its front `depth`
 * out on side n (unit): shrubs head-high and over at the back with a banana or a tall grass among them, climbers on
 * the wall (o.wallH: its height; o.y0: the ground), drifts of perennials through the middle, low mounds spilling at
 * the front. K for the Long Border: `05…/herbaceous border below hanging garden wall…`, Geograph 4148720. Which plant
 * stands where: G (drifts by position hash).
 */
const MID = ['delphinium', 'lupin', 'phlox', 'crambe', 'poker', 'helenium', 'daisy', 'foxglove', 'euphorbia', 'iris', 'lupin', 'phlox'];
const FRONT = ['catmint', 'alchemilla', 'lavender', 'hosta', 'catmint', 'fern', 'alchemilla', 'catmint'];
const BACK = [['shrub', 0.95, 2.2], ['laurel', 1.1, 2.7], ['shrubL', 0.85, 1.9], ['grey', 1.0, 2.4], ['holly', 0.9, 2.6], ['shrub', 1.05, 3.0]];
export function border(PL, a, b, n, depth, o = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, y0 = o.y0 ?? 0.03, seed = o.seed ?? a[0] * 0.7 + a[1] * 1.3;
  const at = (s, d) => [a[0] + ux * s + n[0] * d, a[1] + uz * s + n[1] * d];
  let k = 0;
  // the back: shrubs, a banana, a tall grass, a hydrangea
  if (o.back !== false) for (let s = 0.9; s < L - 0.7; k++) {
    const h1 = ph(seed + k, 1), h2 = ph(seed + k, 2), p = at(s, 0.6 + h1 * 0.25);
    if (h2 < 0.56) { const [t, r, hh] = BACK[Math.floor(ph(seed + k, 3) * BACK.length)], sc = (o.backScale || 1) * (0.85 + h1 * 0.3); PL.dome(p[0], y0, p[1], r * sc, hh * sc, LEAFS[t], { lump: 0.15 }); if (h2 < 0.14) PL.card(PK.rambler, p[0] + n[0] * 0.2, y0 + hh * sc * 0.45, p[1] + n[1] * 0.2, r * sc * 2.3, hh * sc * 0.66, { n: 3, dark: 0.9 }); }
    else if (h2 < 0.66) { if (o.banana !== false) PL.put('banana', p[0], y0, p[1], 0.9 + h1 * 0.25); else PL.put('hydrangea', p[0], y0, p[1], 1.0 + h1 * 0.3); }
    else if (h2 < 0.82) PL.put('miscanthus', p[0], y0, p[1], 0.95 + h1 * 0.3);
    else PL.put('hydrangea', p[0], y0, p[1], 1.1 + h1 * 0.3);
    s += 1.5 + h1 * 1.1;
  }
  // climbers on the wall behind: wisteria, a white rambler, ivy, hanging over its top
  if (o.wallH) for (let s = 0.2, j = 0; s < L - 1.5; j++) { const w = 2.2 + ph(seed, j) * 1.6, kind = [PK.wisteria, PK.climber, PK.rambler, PK.ivy, PK.climber][Math.floor(ph(seed + 7, j) * 5)]; if (ph(seed + 3, j) < 0.7) PL.panel(kind, at(s, 0.07), at(Math.min(L, s + w), 0.07), y0 + o.wallH * (0.25 + 0.3 * ph(j, seed)), y0 + o.wallH + 0.55, { flip: j % 2, lean: [n[0] * 0.25, n[1] * 0.25] }); s += w * (0.75 + ph(seed + 5, j) * 0.6); }
  // the middle: drifts (three or four of a kind together)
  for (const [d0, step, off] of depth > 2.4 ? [[0.42, 0.66, 0], [0.62, 0.7, 0.33]] : [[0.5, 0.7, 0]]) for (let s = 0.35 + off; s < L - 0.3; s += step, k++) {
    const h1 = ph(seed + k, 4), kind = MID[Math.floor(ph(seed + Math.floor((s + off * 7) / 2.1), d0 * 10) * MID.length)], p = at(s + (h1 - 0.5) * 0.25, depth * d0 + (ph(seed + k, 5) - 0.5) * 0.3);
    PL.put(kind, p[0], y0, p[1], 0.9 + h1 * 0.3);
  }
  // the front: low mounds
  for (let s = 0.3; s < L - 0.2; s += 0.6, k++) { const h1 = ph(seed + k, 6), kind = FRONT[Math.floor(ph(seed + Math.floor(s / 1.7), 9) * FRONT.length)], p = at(s, depth - 0.34 - h1 * 0.14); PL.put(kind, p[0], y0, p[1], 0.9 + h1 * 0.3); }
}

const ROSES = ['rosePink', 'roseMagenta', 'roseBlush', 'roseWhite', 'rosePink', 'roseMagenta', 'roseBlush'];
const UNDER = ['catmint', 'alchemilla', 'catmint', 'lavender', 'alchemilla', 'hosta'], SPIRE = ['foxglove', 'crambe', 'lupin', 'foxglove', 'delphinium', 'crambe', 'phlox'];
function roseGarden(B, PL) {
  const R = ROSE;
  // the beds (the soil itself is a mapped flowerbed: places/worcester_gardens.js preMap). K (`31…/rose garden - beds in
  // flower…` 2014, `…general view…` 2015): old shrub roses chest- to head-high, magenta, pink, blush and white, standing
  // close; white crambe, foxgloves and lupins through them; low edging plants at the turf. G: which rose where.
  let k = 0;
  R.beds.forEach((bed, bi) => {
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (const q of bed) { u0 = Math.min(u0, q[0]); u1 = Math.max(u1, q[0]); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
    const inside = (u, v, m) => pip(u, v, bed) && pip(u + m, v, bed) && pip(u - m, v, bed) && pip(u, v + m, bed) && pip(u, v - m, bed);
    const narrow = u1 - u0 < 2;
    for (let u = u0 + (narrow ? 0.72 : 0.75); u < u1 - 0.4; u += 1.28) for (let v = v0 + 0.75; v < v1 - 0.4; v += 1.28, k++) {
      const h1 = ph(k, 1), uu = u + (h1 - 0.5) * 0.3, vv = v + (ph(k, 2) - 0.5) * 0.3; if (!inside(uu, vv, 0.42)) continue;
      const w = L2W(uu, vv), sc = 0.86 + h1 * 0.34, kind = ROSES[(bi * 2 + Math.floor(ph(k, 7) * 2.4)) % ROSES.length];
      PL.dome(w[0], 0.03, w[1], 0.5 * sc, 0.95 * sc, LEAFS.shrub, { n: 7, dark: 0.42, lump: 0.16 });
      PL.put(kind, w[0], 0.03, w[1], sc);
      const q = L2W(uu + 0.64, vv + 0.64); if (inside(uu + 0.64, vv + 0.64, 0.3) && ph(k, 8) < 0.62) PL.put(SPIRE[Math.floor(ph(k, 9) * SPIRE.length)], q[0], 0.03, q[1], 0.9 + ph(k, 4) * 0.25);
    }
    for (let i = 0; i < bed.length; i++) {      // the edging, 0.3 m inside the turf
      const a = bed[i], b = bed[(i + 1) % bed.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.5) continue;
      let nu = -(b[1] - a[1]) / l, nv = (b[0] - a[0]) / l; if (!pip((a[0] + b[0]) / 2 + nu * 0.2, (a[1] + b[1]) / 2 + nv * 0.2, bed)) { nu = -nu; nv = -nv; }
      for (let d = 0.35; d < l - 0.2; d += 0.72, k++) { const u = a[0] + ((b[0] - a[0]) * d) / l + nu * 0.3, v = a[1] + ((b[1] - a[1]) * d) / l + nv * 0.3; if (!pip(u, v, bed) || ph(k, 3) < 0.22) continue; const w = L2W(u, v); PL.put(UNDER[Math.floor(ph(k, 5) * UNDER.length)], w[0], 0.03, w[1], 0.8 + ph(k, 6) * 0.3); }
    }
  });
  // the yew columns: ROUND, tapering, a slightly domed flat top, each in a square cut out of the turf (K: `31…/rose
  // garden in winter…` 2015 and three more; the first pass had them four-sided)
  const off = (x, z, du, dv) => [x + du * CS + dv * SN, z - du * SN + dv * CS];
  for (const [u, v] of R.yews) {
    const [x, z] = L2W(u, v), Q = (r, y) => [[-r, -r], [r, -r], [r, r], [-r, r]].map(([du, dv]) => { const q = off(x, z, du, dv); return [q[0], y, q[1]]; });
    B.poly('soil', Q(0.66, 0.045), [0, 1, 0]);
    PL.column(x, 0.03, z, 0.58, 0.4, 2.3, ph(u, v) < 0.5 ? LEAFS.yew : LEAFS.yewL, { seed: u * 7 + v });
  }
  // the flying Mercury on its pedestal (a plain dark figure: one leg, a raised arm; not a copy of the bronze)
  { const [x, z] = L2W(R.cu, R.cv);
    B.box('wgOldStone', x, 0.6, z, 0.5, 1.2, 0.5, -PHI, {}); B.box('wgOldStone', x, 1.23, z, 0.62, 0.07, 0.62, -PHI, { bottom: true }); B.box('wgOldStone', x, 0.06, z, 0.7, 0.12, 0.7, -PHI, {});
    B.cyl('wgBronze', x, 1.27, z, 0.1, 0.08, 6, true); B.beam('wgBronze', [x, 1.35, z], [x + 0.03, 1.8, z], 0.055); B.beam('wgBronze', [x + 0.03, 1.72, z], [x - 0.22, 1.6, z + 0.1], 0.05);
    B.beam('wgBronze', [x + 0.03, 1.78, z], [x + 0.08, 2.08, z - 0.02], 0.12, 0.09); B.box('wgBronze', x + 0.1, 2.17, z - 0.02, 0.1, 0.12, 0.1, 0, { bottom: true });
    B.beam('wgBronze', [x + 0.1, 2.03, z], [x + 0.3, 2.34, z + 0.02], 0.04); B.beam('wgBronze', [x + 0.06, 2.02, z], [x - 0.14, 1.9, z - 0.08], 0.04); }
  // the weathered stone head on a low plinth on the lawn at the south-west foot
  { const [x, z] = L2W(R.head[0], R.head[1]); B.box('wgOldStone', x, 0.3, z, 0.42, 0.6, 0.42, -PHI, {}); B.cyl('wgOldStone', x, 0.6, z, 0.17, 0.34, 7, true, 0.2); }
  // the pedestal in the north half-round (K that a small pedestal on a round base stands there; G: the sundial of the 1903 design)
  { const [x, z] = L2W(R.dial[0], R.dial[1]); B.cyl('wgOldStone', x, 0.02, z, 0.62, 0.06, 14, true); B.cyl('wgOldStone', x, 0.08, z, 0.2, 0.78, 8, true, 0.13); B.cyl('wgOldStone', x, 0.86, z, 0.27, 0.06, 10, true); B.cyl('wgBronze', x, 0.92, z, 0.21, 0.015, 12, true); B.poly('wgBronze', [[x, 0.935, z - 0.16], [x, 0.935, z + 0.12], [x, 1.1, z + 0.12]], [1, 0, 0]); B.poly('wgBronze', [[x, 0.935, z - 0.16], [x, 0.935, z + 0.12], [x, 1.1, z + 0.12]], [-1, 0, 0]); }
  // the pale stone feature in the south round end (K that it is there, about 3.4 x 1.7 m; G: a stone seat on a paved apron, facing up the garden)
  { const [x, z] = L2W(R.seat[0], R.seat[1]); B.push(frame(x, 0, z, CS, -SN)); B.boxXZ('wgStep', -1.55, 1.55, 0, 0.05, -0.9, 0.62, { top: true }); B.boxXZ('wgOldStone', -1.2, 1.2, 0.36, 0.46, 0.05, 0.55, { bottom: true }); for (const e of [-0.85, 0.85]) B.boxXZ('wgOldStone', e - 0.12, e + 0.12, 0.05, 0.36, 0.1, 0.5, { top: false }); B.boxXZ('wgOldStone', -1.25, 1.25, 0.46, 0.92, 0.5, 0.62, {}); B.pop(); }
  // the Mercury's round: a pale stone base in the turf
  { const [x, z] = L2W(R.cu, R.cv); B.cyl('wgStep', x, 0.02, z, 0.85, 0.035, 16, true); }
  // the clipped hedge along the east side, against the quad's wall
  { const E = R.east; PL.hedge([L2W(E.u, E.v0), L2W(E.u, E.v1)], E.w, E.h, LEAFS.box, { wave: 0.04, seed: 77 }); }
  // the Portuguese laurel hedge across the south end, under the Hanging Garden's wall: a great billowing evergreen mass
  // 5 - 6 m high (K: the 2015 winter picture; height survey)
  { const Hd = R.hedge, vm = (Hd.v0 + Hd.v1) / 2;
    PL.hedge([L2W(Hd.u0 + 0.4, vm), L2W(Hd.u1 - 0.3, vm)], Hd.v1 - Hd.v0, Hd.h, LEAFS.laurel, { wave: 0.07, step: 1.5, seed: 31 });
    for (let i = 0; i < 9; i++) { const u = Hd.u0 + 1.2 + ((Hd.u1 - Hd.u0 - 2.4) * i) / 8, p = L2W(u, vm - 0.25 + (i % 2) * 0.4), r = 1.25 + ph(i, 3) * 0.5; PL.dome(p[0], Hd.h - 1.5 - ph(i, 5) * 0.5, p[1], r, 2.1 + ph(i, 7) * 0.9, i % 3 ? LEAFS.laurel : LEAFS.laurelL, { n: 9, lump: 0.16, dark: 0.8 }); }
    for (let i = 0; i < 6; i++) { const u = Hd.u0 + 1.6 + ((Hd.u1 - Hd.u0 - 3.2) * i) / 5, p = L2W(u, Hd.v0 - 0.15); PL.dome(p[0], 0, p[1], 1.0 + ph(i, 11) * 0.3, 2.2 + ph(i, 13) * 1.4, LEAFS.laurelL, { n: 8, lump: 0.16 }); } }
}

function hangingGarden(B, PL) {
  const H = HG, T = H.top, zs = H.zS - H.stairW;
  // the lawn on top, the two long walls with their parapets, the west end
  B.poly('lawn', [[H.xW, T, H.zN + 0.35], [H.xE, T, H.zN + 0.35], [H.xE, T, H.zS - 0.35], [H.xW, T, H.zS - 0.35]], [0, 1, 0], [[H.xW, H.zN], [H.xE, H.zN], [H.xE, H.zS], [H.xW, H.zS]]);
  B.boxXZ('rubble', H.xW, H.xE, 0, T + 0.95, H.zN, H.zN + 0.35, { top: false }); B.boxXZ('stoneDress', H.xW - 0.03, H.xE, T + 0.95, T + 1.02, H.zN - 0.04, H.zN + 0.39, { bottom: true });      // north: to the rose garden's hedge
  B.boxXZ('rubble', H.xW, H.xE, 0, T + 0.5, H.zS - 0.35, H.zS, { top: false }); B.boxXZ('stoneDress', H.xW, H.xE, T + 0.5, T + 0.57, H.zS - 0.39, H.zS + 0.04, { bottom: true });                // south: over the Long Border
  B.boxXZ('rubble', H.xW - 0.35, H.xW, 0, T + 0.5, H.zN, zs, { top: true });                                                                                                                 // west end, north of the steps' head
  B.boxXZ('rubble', H.xE - 0.02, H.xE + 0.3, 0, T, H.zN, H.zS, { top: true });                                                                                                                // east end, against the older mound (lower there for now)
  // the flight of stone steps up the south side at the west end, between two rubble walls
  const n = H.risers, dx = (H.xW - H.stairX0) / n;
  for (let i = 0; i < n; i++) { const x0 = H.stairX0 + i * dx, y1 = (T * (i + 1)) / n; B.boxXZ('wgStep', x0, x0 + dx + 0.02, 0, y1, zs + 0.02, H.zS - 0.3, { top: true }); }
  for (let i = 0; i < n; i += 2) { const x0 = H.stairX0 + i * dx, x1 = Math.min(H.xW, x0 + 2 * dx), y1 = (T * Math.min(n, i + 2)) / n + 0.75; B.boxXZ('rubble', x0, x1, 0, y1, H.zS - 0.3, H.zS, { top: true }); B.boxXZ('rubble', x0, x1, 0, y1, zs - 0.3, zs + 0.02, { top: true }); }
  // shrubs at the lawn's ends and along its north side, a table at the east end (K: the 2015 picture)
  const sh = [[H.xW + 0.9, H.zN + 1.0, 0.55, 'leafC'], [H.xW + 0.8, H.zN + 2.6, 0.45, 'box'], [H.xE - 1.1, H.zS - 1.0, 0.5, 'leafB'], [-309.5, H.zN + 0.75, 0.4, 'leafC'], [-314.6, H.zN + 0.75, 0.42, 'box'], [-304.8, H.zS - 0.8, 0.38, 'leafA']];
  for (const [x, z, r, key] of sh) PL.dome(x, T, z, r * 1.2, r * 1.9, key === 'box' ? LEAFS.box : key === 'leafB' ? LEAFS.shrubL : LEAFS.shrub);
  // its north side: the hedge and shrubs the height survey has along the parapet, 4 - 6 m above the rose garden
  for (let x = H.xW + 2.2, i = 0; x < H.xE - 6; x += 2.6, i++) PL.dome(x, T, H.zN + 0.85, 0.75 + ph(i, 2) * 0.25, 1.3 + ph(i, 4) * 1.1, i % 2 ? LEAFS.laurel : LEAFS.shrub, { lump: 0.15 });
  B.boxXZ('teak', H.xE - 3.3, H.xE - 1.9, T + 0.7, T + 0.75, H.zN + 1.9, H.zN + 2.8, { bottom: true }); for (const [x, z] of [[H.xE - 3.2, H.zN + 2.0], [H.xE - 2.0, H.zN + 2.0], [H.xE - 3.2, H.zN + 2.7], [H.xE - 2.0, H.zN + 2.7]]) B.boxXZ('teak', x - 0.03, x + 0.03, T, T + 0.7, z - 0.03, z + 0.03, { top: false });
  // west of the steps: the bank of shrubs the height survey shows there, down to the pool's south bank (the map's bed)
  [[-322.4, 36.6, 0.8, 2.0, 'laurel'], [-323.7, 37.6, 1.0, 2.6, 'holly'], [-322.9, 38.8, 0.8, 1.7, 'shrub'], [-324.6, 38.7, 0.7, 1.6, 'box'],
    [-329.4, 38.0, 0.95, 1.9, 'laurelL'], [-331.0, 38.4, 1.1, 2.4, 'holly'], [-332.6, 37.2, 0.9, 1.6, 'shrub'], [-330.4, 39.4, 0.75, 1.5, 'laurel'], [-332.6, 39.2, 0.8, 1.3, 'shrub'], [-325.9, 38.6, 0.6, 1.3, 'box']]      /* (clear of the walk through the gateway: _wgard_more.js HGWALK) */.forEach(([x, z, r, h, t]) => PL.dome(x, 0, z, r, h, LEAFS[t], { lump: 0.15 }));
  for (let x = -333.4, i = 0; x < -325.9; x += 0.8, i++) if (Math.abs(x + 327.6) > 1.1) PL.put(['fern', 'hosta', 'alchemilla', 'fern', 'catmint'][i % 5], x, 0.03, 41.4 - ph(i, 3) * 0.3, 0.9 + ph(i, 5) * 0.3);
  // ---- the Long Border at the wall's foot (the soil is the map's bed)
  border(PL, [H.xW + 0.2, H.zS + 0.02], [H.xE + 0.1, H.zS + 0.02], [0, 1], 3.15, { wallH: T + 0.5, seed: 11 });
}

function greenhouse(B, G) {
  const [a, b, c, d] = G.poly, L = Math.hypot(b[0] - a[0], b[1] - a[1]), W = Math.hypot(d[0] - a[0], d[1] - a[1]);
  B.push(frame(a[0], 0, a[1], b[0] - a[0], b[1] - a[1]));      // x along its length, z across (which way is fixed below)
  const sg = ((d[0] - a[0]) * -(b[1] - a[1]) + (d[1] - a[1]) * (b[0] - a[0])) > 0 ? 1 : -1, zz = (t) => sg * t;
  const q = (key, pts, n) => B.poly(key, pts.map((p) => [p[0], p[1], zz(p[2])]), [n[0], n[1], sg * n[2]]);
  const w = G.wall, r = G.ridge, m = W / 2;
  q('redBrick', [[0, 0, 0], [L, 0, 0], [L, 0.45, 0], [0, 0.45, 0]], [0, 0, -1]); q('redBrick', [[0, 0, W], [L, 0, W], [L, 0.45, W], [0, 0.45, W]], [0, 0, 1]);
  q('wgGlass', [[0, 0.45, 0], [L, 0.45, 0], [L, w, 0], [0, w, 0]], [0, 0, -1]); q('wgGlass', [[0, 0.45, W], [L, 0.45, W], [L, w, W], [0, w, W]], [0, 0, 1]);
  for (const x of [0, L]) { q('redBrick', [[x, 0, 0], [x, 0, W], [x, 0.45, W], [x, 0.45, 0]], [x ? 1 : -1, 0, 0]); q('wgGlass', [[x, 0.45, 0], [x, 0.45, W], [x, w, W], [x, r, m], [x, w, 0]], [x ? 1 : -1, 0, 0]); }
  q('wgGlass', [[0, w, 0], [L, w, 0], [L, r, m], [0, r, m]], [0, 1, -1]); q('wgGlass', [[0, w, W], [L, w, W], [L, r, m], [0, r, m]], [0, 1, 1]);
  // glazing bars (aluminium), the ridge with its raised green cap, the eaves
  const sl = Math.hypot(m, r - w), e = 0.012;
  for (let x = 0; x <= L + 0.01; x += L / Math.round(L / 0.62)) {
    for (const s of [0, 1]) { const z0 = s ? W : 0, nz = s ? 1 : -1, oy = e * (m / sl), oz = e * ((r - w) / sl) * nz;
      q('alu', [[x - 0.02, 0.45, z0 + nz * e], [x + 0.02, 0.45, z0 + nz * e], [x + 0.02, w, z0 + nz * e], [x - 0.02, w, z0 + nz * e]], [0, 0, nz]);
      q('alu', [[x - 0.02, w + oy, z0 + oz], [x + 0.02, w + oy, z0 + oz], [x + 0.02, r + oy, m + oz], [x - 0.02, r + oy, m + oz]], [0, 1, nz]); }
  }
  B.boxXZ('wgRidge', -0.05, L + 0.05, r - 0.02, r + 0.16, zz(m) - 0.12, zz(m) + 0.12, { bottom: true });
  for (const z0 of [0, W]) B.boxXZ('alu', -0.03, L + 0.03, w - 0.03, w + 0.04, zz(z0) - 0.04, zz(z0) + 0.04, { bottom: true });
  B.pop();
}

function hut(B) {
  const U = HUT, l = U.l, w = U.w;
  B.push(frame(U.c[0], 0, U.c[1], U.dir[0], U.dir[1])); B.push(new THREE.Matrix4().makeTranslation(-l / 2, 0, -w / 2));
  B.boxXZ('wgHut', 0, l, 0.55, 2.35, 0, w, { top: false, bottom: true });
  const n = 6; for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI, p = (a) => [w / 2 - Math.cos(a) * (w / 2 + 0.08), 2.33 + Math.sin(a) * 0.42]; const [z0, y0] = p(a0), [z1, y1] = p(a1);
    B.poly('wgHutRoof', [[-0.1, y0, z0], [l + 0.1, y0, z0], [l + 0.1, y1, z1], [-0.1, y1, z1]], [0, Math.sin((a0 + a1) / 2), -Math.cos((a0 + a1) / 2)]);
    for (const x of [0, l]) B.poly('wgHut', [[x, 2.33, w / 2], [x, y0, z0], [x, y1, z1]], [x ? 1 : -1, 0, 0]); }
  B.boxXZ('door', l - 0.01, l + 0.02, 0.6, 2.2, w / 2 - 0.4, w / 2 + 0.4, {}); B.boxXZ('glassDark', 1.2, 2.1, 1.35, 1.95, -0.02, 0.0, {});
  for (const x of [0.6, l - 0.6]) for (const z of [0.02, w - 0.02]) { B.push(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, 0.3, z - 0.06)); B.cyl('iron', 0, 0, 0, 0.3, 0.12, 10, true); B.pop(); }
  for (let i = 0; i < 3; i++) B.boxXZ('wood', l + 0.05 + i * 0.26, l + 0.31 + i * 0.26, 0, 0.42 - i * 0.14, w / 2 - 0.4, w / 2 + 0.4, {});
  B.pop(); B.pop();
}

/** -> { built: { part: triangles } } */
export function buildGardens(B, PL) {
  const built = {};
  const part = (name, fn) => { const n0 = B.tris() + PL.tris(), depth = B.stack.length; try { fn(); } catch (e) { console.error('[worcester_gardens] ' + name, e); while (B.stack.length > depth) B.pop(); } built[name] = Math.round(B.tris() + PL.tris() - n0); };
  part('rose garden', () => roseGarden(B, PL));
  part('Hanging Garden and Long Border', () => hangingGarden(B, PL));
  part('greenhouses', () => { for (const g of GREENHOUSES) greenhouse(B, g); });
  part('shepherd\'s hut', () => hut(B));
  // the coloured-stem willows on the Provost's bank of the south arm, stooled low (K: 35/provosts garden bank… 2014; G: where each stands)
  part('coloured willows', () => { [[-349.6, 25.7], [-353.9, 25.2], [-357.6, 24.9], [-346.4, 26.0]].forEach(([x, z], i) => { B.cyl('wood', x, 0, z, 0.09, 0.55, 6, true); PL.put('dogwood', x, 0.4, z, 1.45 + ph(i, 3) * 0.4, { tint: i % 3 ? [1.25, 1.05, 0.45] : [1.1, 0.75, 0.6] }); }); });
  return { built };
}
