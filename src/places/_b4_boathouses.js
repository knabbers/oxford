// The college boathouses on the Isis below Christ Church Meadow (owned by places/isis_boathouses.js) — see
// docs/research/landmarks_batch4.md.
//
// K: most college boathouses stand in a row on the north-east bank below the Cherwell's mouth, on the island reached
// from the meadow by Boathouses Walk; the first one from Folly Bridge is the shared Wadham / St Anne's / St Hugh's
// boathouse (mapped w95661025); two-storey buildings, boat bays below, a club room with a balcony over the river above,
// landing stages in front; college flags flown in Eights Week; crews boat from the stages.
// G: the number (eight here), widths, materials and order of the buildings; every name is left off (no college is named
// on a building); the flags are invented colours (_b4_kit.js), not any college's. The map data stops at z = 1216, so the
// row runs into a map box added in preMap (x 560…860, z 1216…1470), as places/port_meadow.js does west of the map.
import { RB, frame, flatUp, h01, TAU, glowCard, bike, bench } from './_b4_kit.js';

// minZ overlaps the main box by 16 m: the collider clamps every box 5 m inside its edges (mapcollision.js), so the two must overlap
export const BOX = { minX: 560, maxX: 860, minZ: 1200, maxZ: 1470 };
export const SKIP = ['w95661025'];
// Boathouses Walk (mapped w37335168) between the boathouses and the river: the row is laid out along its straight reach
export const WALK = { a: [629, 1225], u: [Math.SQRT1_2, Math.SQRT1_2], n: [-Math.SQRT1_2, Math.SQRT1_2] };   // u downstream, n towards the river
export const FRONT = 3.2, DEPTH = 13;     // the front walls stand FRONT m inland of the walk's centre line
// [s0 (m along the walk), width, wall key, roof ('pitch'|'flat'), upper ('glazed'|'sash'), flag]
// photo comparison item 18 ("boathouses", 2010): the real row is mostly flat-roofed white blocks with balconies over
// the river (1930s to 2000s rebuilds), a couple of older brick ones with low pitched roofs between; it was pitched sheds
// in red, green and blue weatherboard. Which house is which is still a GUESS.
export const HOUSES = [
  [-2, 19, 'white', 'flat', 'glazed', 'flagA'],
  [20, 17, 'white', 'flat', 'sash', 'flagB'],
  [40, 21, 'brick', 'pitch', 'glazed', 'flagC'],
  [64, 16, 'white', 'flat', 'glazed', 'flagA'],
  [83, 20, 'cream', 'flat', 'glazed', 'flagC'],
  [106, 18, 'white', 'flat', 'glazed', 'flagB'],
  [127, 22, 'brickBuff', 'pitch', 'sash', 'flagA'],
  [152, 18, 'white', 'flat', 'glazed', 'flagC'],
];
export const RIVER_EDGE = 4.4;    // the bank is ~4.4 m riverwards of the walk's centre
/** map point from walk coordinates: s along, o inland (negative = towards the river) */
export function at(s, o) { const { a, u, n } = WALK; return [a[0] + u[0] * s - n[0] * o, a[1] + u[1] * s - n[1] * o]; }
/** footprint ring of house i */
export function footprint(i) { const [s0, w] = HOUSES[i]; return [at(s0, FRONT), at(s0 + w, FRONT), at(s0 + w, FRONT + DEPTH), at(s0, FRONT + DEPTH)]; }
/** a landing stage in front of house i (out over the water) */
export function stage(i) { const [s0, w] = HOUSES[i]; return [at(s0 + 1, -RIVER_EDGE + 0.6), at(s0 + w - 1, -RIVER_EDGE + 0.6), at(s0 + w - 1, -RIVER_EDGE - 2.6), at(s0 + 1, -RIVER_EDGE - 2.6)]; }
/** the racks on the walk's inland verge: [s, kind] */
export const RACK_Z = -2.1;
export const RACKS = [[16.5, 2], [60.5, 1], [102, 2], [148.5, 1]];
/** the second eight's reach: the river's centre line through the boathouse reach (mapped Thames line, extended) */
export const REACH = [[452, 1150], [505, 1180], [569, 1209], [664, 1298], [730, 1372], [781, 1436]];

// local frame of the walk: x = s (downstream), z = towards the river (so +z faces the river)
const F = () => frame(WALK.a[0], 0, WALK.a[1], WALK.u[0], WALK.u[1]);   // local +z = (-u.z, u.x) = (-0.707, 0.707) = n

function house(B, i, q) {
  const [s0, w, wall, roof, upper, flag] = HOUSES[i], d = DEPTH, z0 = -FRONT, z1 = -FRONT - d, gH = 3.7, uH = 3.3, top = gH + uH;
  const xm = s0 + w / 2;
  // walls (front faces the river: local +z)
  B.box(wall, xm, top / 2, (z0 + z1) / 2, w, top, d, 0, { top: false });
  // a plinth course and the floor band
  B.box('concrete', xm, 0.2, z0 + 0.03, w + 0.06, 0.4, 0.06, 0);
  B.box(wall === 'brick' || wall === 'brickDk' || wall === 'brickBuff' ? 'dress' : 'white', xm, gH + 0.1, z0 + 0.05, w + 0.04, 0.2, 0.1, 0, { bottom: true });
  // boat bays: two or three wide doors, open by day on the near copy (dark bay, a white hull on a rack inside)
  const nb = w > 19 ? 3 : 2, bw = (w - 1.2 * (nb + 1)) / nb;
  for (let k = 0; k < nb; k++) {
    const x0 = s0 + 1.2 + k * (bw + 1.2), x1 = x0 + bw;
    const open = q < 2 && h01(i * 7 + k, 3) < 0.6;
    if (open) {
      B.poly('shade', [[x0, 0, z0 + 0.02], [x1, 0, z0 + 0.02], [x1, 3.0, z0 + 0.02], [x0, 3.0, z0 + 0.02]], [0, 0, 1]);
      if (q === 0) for (const y of [0.9, 1.9]) { B.box('hull', (x0 + x1) / 2, y, z0 - 0.6, bw * 0.55, 0.32, 0.34, 0); B.box('varnish', (x0 + x1) / 2, y + 0.18, z0 - 0.6, bw * 0.5, 0.03, 0.2, 0); }
    } else B.unit(k % 2 ? 'glazed' : 'door', [[x0, 0, 0], [x1, 0, 0], [x1, 3.0, 0], [x0, 3.0, 0]].map((p) => [p[0], p[1]]), z0 + 0.03, [3000 + i * 5 + k, 0]);
    B.box('dress', (x0 + x1) / 2, 3.08, z0 + 0.06, bw + 0.2, 0.16, 0.12, 0);
  }
  // the club room: a glazed screen or a row of sashes
  if (upper === 'glazed') { const n = Math.max(3, Math.round(w / 3.4)); for (let k = 0; k < n; k++) { const x0 = s0 + 0.8 + k * ((w - 1.6) / n) + 0.1, x1 = s0 + 0.8 + (k + 1) * ((w - 1.6) / n) - 0.1; B.unit('glazed', [[x0, gH + 0.4], [x1, gH + 0.4], [x1, top - 0.35], [x0, top - 0.35]], z0 + 0.03, [3100 + i * 9 + k, 1]); } }
  else { const n = Math.max(3, Math.round(w / 2.8)); for (let k = 0; k < n; k++) { const x = s0 + (k + 0.5) * (w / n); B.unit('sash', [[x - 0.6, gH + 0.55], [x + 0.6, gH + 0.55], [x + 0.6, top - 0.4], [x - 0.6, top - 0.4]], z0 + 0.03, [3200 + i * 9 + k, 1]); B.box('white', x, gH + 0.5, z0 + 0.07, 1.4, 0.08, 0.12, 0); } }
  // side windows on the near copy
  if (q === 0) for (const sx of [s0 - 0.02, s0 + w + 0.02]) { for (const t of [0.3, 0.65]) { const z = z0 - d * t; B.push(frame(sx, 0, z, 0, sx < xm ? 1 : -1)); B.unit('sash', [[-0.5, gH + 0.6], [0.5, gH + 0.6], [0.5, top - 0.5], [-0.5, top - 0.5]], 0, [3300 + i * 4, 1]); B.pop(); } }
  // the balcony over the river: a slab on brackets, white railings, the flagpole at one end
  const by = gH + 0.1, bd = 1.8;
  B.box('deck', xm, by, z0 + bd / 2, w - 0.4, 0.14, bd, 0, { bottom: true });
  B.box('white', xm, by + 1.0, z0 + bd, w - 0.4, 0.06, 0.06, 0);
  for (const sx of [s0 + 0.2, s0 + w - 0.2]) B.box('white', sx, by + 0.55, z0 + bd / 2, 0.06, 0.06 + 0.0, bd, 0), B.box('white', sx, by + 1.0, z0 + bd / 2, 0.06, 0.06, bd, 0);
  const posts = q === 0 ? Math.round((w - 0.4) / 0.6) : q === 1 ? Math.round((w - 0.4) / 2.4) : 0;
  for (let k = 0; k <= posts; k++) { const x = s0 + 0.2 + (k / Math.max(1, posts)) * (w - 0.4); B.box('white', x, by + 0.55, z0 + bd, 0.04, 0.9, 0.04, 0, { top: false }); }
  if (q === 0) for (let k = 0; k <= Math.floor(w / 3); k++) B.beam('white', [s0 + 0.5 + k * 3, by - 0.05, z0 + bd - 0.2], [s0 + 0.5 + k * 3, by - 0.9, z0 + 0.02], 0.08);
  // roof: a shallow pitch (slate) with gable ends to the river, or flat with a parapet
  if (roof === 'pitch') {
    const ridge = top + w * 0.22, zr0 = z0 + 0.4, zr1 = z1 - 0.4;
    B.poly('slate', [[s0 - 0.3, top, zr0], [xm, ridge, zr0], [xm, ridge, zr1], [s0 - 0.3, top, zr1]], [-1, 1, 0]);
    B.poly('slate', [[xm, ridge, zr0], [s0 + w + 0.3, top, zr0], [s0 + w + 0.3, top, zr1], [xm, ridge, zr1]], [1, 1, 0]);
    for (const zz of [z0, z1]) B.poly(wall, [[s0, top, zz], [s0 + w, top, zz], [xm, ridge - 0.1, zz]], [0, 0, zz === z0 ? 1 : -1]);
    if (q < 2) B.box('white', xm, top + 0.05, z0 + 0.42, w + 0.6, 0.1, 0.06, 0);
  } else {
    flatUp(B, 'lead', [[s0, z0], [s0 + w, z0], [s0 + w, z1], [s0, z1]].map(([x, z]) => [x, z]), top + 0.4);
    B.box(wall, xm, top + 0.4, z0 - 0.15, w, 0.8, 0.3, 0, { top: true }); B.box(wall, xm, top + 0.4, z1 + 0.15, w, 0.8, 0.3, 0, { top: true });
    B.box(wall, s0 + 0.15, top + 0.4, (z0 + z1) / 2, 0.3, 0.8, d, 0, { top: true }); B.box(wall, s0 + w - 0.15, top + 0.4, (z0 + z1) / 2, 0.3, 0.8, d, 0, { top: true });
  }
  // the flagpole on the balcony's downstream corner, its flag flying downstream (two panels with a fold)
  const fx = s0 + w - 0.6, fz = z0 + bd - 0.15, fy = top + (roof === 'pitch' ? 3.2 : 2.6);
  B.cyl('white', fx, by, fz, 0.035, fy - by + 0.3, q ? 4 : 6, true, 0.05);
  if (q < 2) {
    const fw = 1.8, fh = 1.1, k = h01(i, 11) * 0.3;
    B.card(flag, [fx, fy - fh, fz], [fx + fw * 0.5, fy - fh - 0.05, fz + 0.18 + k], [fx + fw * 0.5, fy - 0.05, fz + 0.18 + k], [fx, fy, fz], [0.004, 0.004, 0.5, 0.996]);
    B.card(flag, [fx + fw * 0.5, fy - fh - 0.05, fz + 0.18 + k], [fx + fw, fy - fh - 0.12, fz - 0.1], [fx + fw, fy - 0.12, fz - 0.1], [fx + fw * 0.5, fy - 0.05, fz + 0.18 + k], [0.5, 0.004, 0.996, 0.996]);
    // and the back of it (cards are one-sided)
    B.card(flag, [fx + fw * 0.5, fy - fh - 0.05, fz + 0.18 + k], [fx, fy - fh, fz], [fx, fy, fz], [fx + fw * 0.5, fy - 0.05, fz + 0.18 + k], [0.5, 0.004, 0.004, 0.996]);
    B.card(flag, [fx + fw, fy - fh - 0.12, fz - 0.1], [fx + fw * 0.5, fy - fh - 0.05, fz + 0.18 + k], [fx + fw * 0.5, fy - 0.05, fz + 0.18 + k], [fx + fw, fy - 0.12, fz - 0.1], [0.996, 0.004, 0.5, 0.996]);
  }
  // the landing stage in front (out over the water, boards and a timber fascia), steps down from the walk
  const ls = s0 + 1, le = s0 + w - 1, zs0 = RIVER_EDGE - 0.6, zs1 = RIVER_EDGE + 2.6, sy = 0.16;
  flatUp(B, 'deck', [[ls, zs0], [le, zs0], [le, zs1], [ls, zs1]], sy);
  B.poly('oak', [[ls, -0.3, zs1], [le, -0.3, zs1], [le, sy, zs1], [ls, sy, zs1]], [0, 0, 1]);
  if (q === 0) for (let x = ls; x <= le; x += 2.5) B.box('oak', x, -0.1, zs1 - 0.1, 0.2, 0.6, 0.2, 0);
  // visual pass: blades (oars) leaning on the front between the bays, spoons in the house's flag colours; a lamp over
  // every bay door (lit after dark); bikes against the side wall
  const blade = { flagA: 'navy', flagB: 'green', flagC: 'red' }[flag] || 'navy';
  if (q < 2) for (let k = 0; k <= nb; k++) {
    const xc = s0 + 0.6 + k * (bw + 1.2), n = q === 0 ? 4 : 2;
    for (let j = 0; j < n; j++) {
      const x = xc - 0.3 + j * 0.2, lean = 0.42;
      B.beam('white', [x, 0.05, z0 + lean], [x + 0.02, 3.4, z0 + 0.06], 0.045);
      B.box(blade, x + 0.0, 0.32, z0 + lean - 0.01, 0.07, 0.56, 0.2, 0);
    }
  }
  if (q < 2) for (let k = 0; k < nb; k++) { const xc = s0 + 1.2 + k * (bw + 1.2) + bw / 2; B.box('lamp', xc, 3.42, z0 + 0.22, 0.26, 0.06, 0.3, 0); glowCard(B, [xc - 0.11, 3.1, z0 + 0.37], [xc + 0.11, 3.1, z0 + 0.37], [xc + 0.11, 3.38, z0 + 0.37], [xc - 0.11, 3.38, z0 + 0.37], i * 3 + k); }
  if (q === 0) for (let k = 0; k < 2 + (i % 2); k++) bike(B, s0 + w + 0.45, z0 - 2 - k * 0.75, Math.PI + 0.1 * k, k % 2 ? 'red' : 'navy', 0);
  // balcony lights: a festoon would be too much; one glowing lantern at each end of the rail
  if (q < 2) for (const sx of [s0 + 0.5, s0 + w - 1.1]) { glowCard(B, [sx - 0.1, by + 1.1, z0 + bd + 0.04], [sx + 0.1, by + 1.1, z0 + bd + 0.04], [sx + 0.1, by + 1.36, z0 + bd + 0.04], [sx - 0.1, by + 1.36, z0 + bd + 0.04], i * 5 + 11); }
  // a "crews only" board by the door
  if (q < 2 && i === 0) B.card('sign_rowing', [s0 + w - 6.2, 3.25, z0 + 0.05], [s0 + w - 1.4, 3.25, z0 + 0.05], [s0 + w - 1.4, 3.6, z0 + 0.05], [s0 + w - 6.2, 3.6, z0 + 0.05], [0.004, 0.004, 0.996, 0.996]);
}
/** a racing eight (white hull, varnished canvas, riggers), upside down on trestles, along local x at (x, z) */
function rack(B, x, z, n, q) {
  const L = 17.2;
  for (const t of [-L * 0.32, 0, L * 0.32]) { B.box('oak', x + t, 0.55, z, 0.12, 1.1, 0.12, 0, { top: false }); B.box('oak', x + t, 1.12, z, 0.14, 0.08, 1.1, 0); }
  for (let k = 0; k < n; k++) {
    const y = 1.26 + k * 0.0, zz = z + (n > 1 ? (k - 0.5) * 0.62 : 0);
    B.box('hull', x, y + 0.09, zz, L - 2, 0.18, 0.5, 0, { bottom: true });
    B.cyl('hull', x + L / 2 - 1, y + 0.09, zz, 0.02, 0.0, 4, false);
    B.push(frame(x, 0, zz, 1, 0));
    for (const sx of [-1, 1]) B.poly('hull', [[sx * (L / 2 - 1), y, -0.25], [sx * (L / 2 - 1), y + 0.18, 0], [sx * (L / 2 + 0.2), y + 0.12, 0]], [sx, 0.4, -1]), B.poly('hull', [[sx * (L / 2 - 1), y + 0.18, 0], [sx * (L / 2 - 1), y, 0.25], [sx * (L / 2 + 0.2), y + 0.12, 0]], [sx, 0.4, 1]);
    B.pop();
    if (q === 0) for (let r = 0; r < 8; r++) { const rx = x - 5.9 + r * 1.42; B.box('iron', rx, y - 0.05, zz + (r % 2 ? 0.45 : -0.45), 0.04, 0.04, 0.66, 0); }
  }
}

/** q 0 near, 1 mid, 2 far -> one Batch for the whole row (a few hundred m; the LOD cuts it into cells) */
export function buildRow(q, houses = HOUSES.map((_, i) => i)) {
  const B = new RB();
  B.push(F());
  for (const i of houses) house(B, i, q);
  if (q < 2) for (const [s, n] of RACKS) rack(B, s, RACK_Z, n, q);
  // benches on the walk's inland verge facing the river (G), where the crowds stand in Eights Week
  if (q < 2) for (const s of BENCHES) if (houses.some((i) => s >= HOUSES[i][0] - 2 && s < HOUSES[i][0] + HOUSES[i][1] + 2)) bench(B, s, -2.45, 0, 'oak');
  // the walk's verge: a gravel strip with a low kerb along the river edge
  B.pop();
  return B;
}
/** a bench and an Eights Week marker post on the towpath side opposite? (none: the towpath is mapped) */
export const SIGHT_AT = at(70, FRONT + 4);
export const BENCHES = [38, 80, 124];
/** the crew's carry (visual pass): along the walk from beside a rack down to house 1's stage */
export const CARRY = [at(64, 0.4), at(30, -1.2)];
void TAU;
