// Folly Bridge and Folly Island (owned by places/folly_bridge.js) — see docs/research/landmarks_batch4.md.
//
// K (known): Ebenezer Perry's stone bridge of 1825-27, three spans and two piers over the main channel; the island between
// the two parts of the bridge; the castellated house of 1849 for Joshua Caudwell on the island with statues and cast-iron
// balconies; a riverside pub on the island's north-east corner with a terrace on the water; boat hire and river steamers
// moored by the bridge.
// G (guessed): every dimension; Caudwell's house as red brick with stone dressings, two octagonal corner turrets, statues
// in niches and on the parapet; the cutwaters' shape; the lamp standards. The world is flat (the river is drawn at road
// level), so the arches cannot be seen: the bridge reads by its parapets, cornice, pilasters and cutwaters (a flagged
// compromise). Real names: the pub is the Head of the River (in Salter's old warehouse), the hire is Salter's Steamers
// ("The Ferryman" and "Grandpont Boats" under ?invented=1). Invented: the steamer "Grandpont Belle" and its livery.
import { RB, Batch, TAU, frame, rectPts, archPts, flatUp, signCard, prismN, festoon, bulb, glowCard, bike, bench } from './_b4_kit.js';

// the bridge's two outer faces (the mapped deck w569979616's long edges, south end at the island) and the piers
export const BRIDGE = {
  west: [[247.3, 937.0], [250.45, 977.3]], east: [[256.85, 934.0], [259.45, 977.1]],
  bankN: 939.6, island: 966.6, piers: [948.6, 957.7], pierW: 1.7,
  parapet: 1.08, coping: 0.12,
};
// the deck between the faces (for the jump game: "on Folly Bridge")
export const DECK = [[247.3, 937.0], [256.85, 934.0], [259.45, 977.1], [250.45, 977.3]];
export const CASTLE = { poly: [[222.7, 985.5], [248.2, 986.6], [248.3, 991.7], [222.5, 990.8]], h: 10.6, parapet: 1.3, storeys: [0.6, 2.9, 3.9, 6.3, 7.3, 9.6] };
export const PUB = { id: 'w95817197', poly: [[272.9, 975.1], [288.4, 983.5], [285.5, 989.2], [269.5, 981]] };
// the pub's terrace over the water along its north front, the hire pontoon west of it, the gangway from the island
export const TERRACE = [[272.7, 974.4], [288.8, 983.0], [290.9, 979.3], [274.6, 970.5]];
export const TERRACE_GAP = 5.0;   // m along the terrace's river edge from its west end: the steamer's gangway
export const PONTOON = [[260.8, 969.6], [274.8, 970.6], [273.2, 973.9], [260.8, 973.4]];
export const GANGWAY = [[263.2, 973.0], [265.4, 973.0], [265.4, 976.6], [263.2, 976.6]];
export const STEAMER = { x: 283.3, z: 969.1, h: Math.atan2(0.88, 0.48), L: 21, B: 4.4 };
export const BOATS = [[262.6, 967.6, 0.04], [266.4, 967.5, -0.02], [270.0, 967.7, 0.05]];   // rowing boats moored off the pontoon
export const TABLES = [[277.0, 974.0], [281.4, 976.4], [285.8, 978.8], [279.4, 972.0], [283.8, 974.4]];
export const LAMPS = [[247.7, 941.0], [248.5, 953.2], [249.4, 963.8], [257.2, 939.0], [258.0, 953.2], [258.8, 963.8]];

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** the point on a face at map z (faces run roughly north-south) */
function faceAt(F, z) { const t = (z - F[0][1]) / (F[1][1] - F[0][1]); return lerp(F[0], F[1], t); }

// ------------------------------------------------------------------------------------------------ the bridge
export function buildBridge(q) {
  const B = new RB(), D = BRIDGE;
  for (const [F, side] of [[D.west, -1], [D.east, 1]]) {
    const a = faceAt(F, D.bankN - 3), b = faceAt(F, D.island + 1.2), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    // local frame: x along the face (north -> south), +z outwards (west face: -x side)
    const ox = side < 0 ? -uz : uz, oz = side < 0 ? ux : -ux;      // outward normal
    const F0 = frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, side < 0 ? ux : -ux, side < 0 ? uz : -uz);
    void ox; void oz;
    B.push(F0);
    const H = L / 2, top = D.parapet, s = side < 0 ? 1 : -1;     // local x = s * (along the face from the middle)
    // the outer face with the three arches (the river is drawn at road level, so the arches' crowns stand 0.7 m clear
    // of the water and their springing is under it: a bridge in high water — the flagged compromise), voussoirs, a
    // cornice under the parapet and the parapet's outer face
    const lxOf = (z) => { const p = faceAt(F, z); return s * ((p[0] - (a[0] + b[0]) / 2) * ux + (p[1] - (a[1] + b[1]) / 2) * uz); };
    const hw = D.pierW / 2, spans = [[D.bankN, D.piers[0] - hw], [D.piers[0] + hw, D.piers[1] - hw], [D.piers[1] + hw, D.island]].map(([z0, z1]) => { const x0 = lxOf(z0), x1 = lxOf(z1); return [Math.min(x0, x1), Math.max(x0, x1)]; });
    const crown = 0.7, seg = q === 0 ? 10 : q === 1 ? 6 : 4;
    const archOf = ([x0, x1]) => { const pts = [[x0, -0.75], [x1, -0.75]]; for (let i = 0; i <= seg; i++) { const t = i / seg, x = x1 - (x1 - x0) * t, k = 1 - (2 * t - 1) ** 2; pts.push([x, -0.05 + (crown + 0.05) * Math.sqrt(k)]); } return pts.slice(0, -1).concat([[x0, -0.05]]); };
    const holes = spans.map(archOf);
    B.face('bridgeDk', [[-H, -0.8], [H, -0.8], [H, 0.82], [-H, 0.82]], q === 2 ? [] : holes, 0.3);
    if (q < 2) for (const hl of holes) {
      B.reveal('bridgeDk', hl, 0.3, -0.15, true);
      B.poly('shade', hl.map(([x, y]) => [x, y, -0.15]), [0, 0, 1]);
      // the voussoir ring: a band of pale dressed stone round the arch
      const ring = hl.slice(2).map(([x, y]) => [x, y, 0.3]);
      B.sweep('dress', ring, [[0, 0], [0, 0.04], [0.22, 0.04], [0.22, 0]], [0, 0, 1]);
    }
    if (q === 2) for (const [x0, x1] of spans) B.poly('shade', [[x0 + 0.4, 0.04, 0.31], [x1 - 0.4, 0.04, 0.31], [x1 - 1.2, crown - 0.05, 0.31], [x0 + 1.2, crown - 0.05, 0.31]], [0, 0, 1]);
    // cornice (projecting, a dentil course on the near copy) and the parapet over it
    B.box('bridge', 0, 0.86, 0.36, L, 0.12, 0.2, 0, { bottom: true });
    if (q === 0) B.poly('dentil', [[-H, 0.74, 0.42], [H, 0.74, 0.42], [H, 0.8, 0.42], [-H, 0.8, 0.42]], [0, 0, 1], [[0, 0.02], [L, 0.02], [L, 0.98], [0, 0.98]]);
    B.box('bridge', 0, (0.92 + top) / 2, 0.24, L, top - 0.92, 0.24, 0, { top: false });
    B.box('bridge', 0, top / 2, 0.0, L, top, 0.2, 0, { top: false });
    B.box('dress', 0, top + D.coping / 2, 0.15, L + 0.1, D.coping, 0.56, 0, { bottom: true });
    // pilasters and the cutwaters at the two piers (and the abutments): each pier a pointed nose out into the stream
    // rising to a half-hexagonal refuge in the parapet
    for (const pz of [D.bankN - 0.4, ...D.piers, D.island + 0.4]) {
      const p = faceAt(F, pz), lx = s * ((p[0] - (a[0] + b[0]) / 2) * ux + (p[1] - (a[1] + b[1]) / 2) * uz);
      const pier = D.piers.includes(pz), w = pier ? D.pierW : 1.2;
      B.box('bridge', lx, (top + 0.1) / 2 - 0.4, 0.46, w + 0.2, top + 0.9, 0.32, 0, { top: true });
      B.box('dress', lx, top + 0.16, 0.6, w + 0.36, 0.14, 0.45, 0, { bottom: true });
      if (pier) {
        // the cutwater: a triangular prism out to 1.6 m from the face, its top a sloped stone cap
        const n = [[lx - w / 2, 0.75], [lx + w / 2, 0.75], [lx, 2.2]];
        B.poly('bridgeDk', [[n[0][0], -0.8, n[0][1]], [n[2][0], -0.8, n[2][1]], [n[2][0], 0.55, n[2][1]], [n[0][0], 0.55, n[0][1]]], [-1, 0, 1]);
        B.poly('bridgeDk', [[n[2][0], -0.8, n[2][1]], [n[1][0], -0.8, n[1][1]], [n[1][0], 0.55, n[1][1]], [n[2][0], 0.55, n[2][1]]], [1, 0, 1]);
        B.poly('bridge', [[n[0][0], 0.55, n[0][1]], [n[2][0], 0.55, n[2][1]], [lx, 0.95, 0.75]], [-0.6, 1, 0.6]);
        B.poly('bridge', [[n[2][0], 0.55, n[2][1]], [n[1][0], 0.55, n[1][1]], [lx, 0.95, 0.75]], [0.6, 1, 0.6]);
        // the arch rings either side of the pier, drawn as dressed voussoir bands down at the water (G: see the header)
      }
    }
    // inside face of the parapet (towards the road)
    B.poly('bridgeDk', [[-H, 0.0, -0.07], [-H, top, -0.07], [H, top, -0.07], [H, 0.0, -0.07]], [0, 0, -1]);
    B.pop();
  }
  // lamp standards on the parapets (cast iron, a lantern)
  if (q < 2) for (const [x, z] of LAMPS) {
    B.cyl('lamp', x, 0, z, 0.09, 3.4, q ? 5 : 8, false, 0.14);
    B.box('lamp', x, 3.45, z, 0.5, 0.06, 0.5, 0);
    if (q === 0) { B.box('lamp', x, 3.75, z, 0.34, 0.5, 0.34, Math.PI / 4, { top: false }); B.cyl('lamp', x, 4.0, z, 0.02, 0.32, 4, false, 0.28); }
  }
  return B;
}

// ------------------------------------------------------------------------------------------------ Caudwell's Castle
/** a crenellated parapet along a wall in a local frame (x along, +z out), from x0 to x1 at y */
function crenel(B, key, x0, x1, y, h, t, q) {
  B.box(key, (x0 + x1) / 2, y + h * 0.45, -t / 2, x1 - x0, h * 0.9, t, 0, { top: true });
  if (q === 2) return;
  const n = Math.max(2, Math.round((x1 - x0) / 1.05));
  for (let k = 0; k < n; k++) { const w = (x1 - x0) / n; B.box(key, x0 + (k + 0.5) * w, y + h * 0.9 + 0.22, -t / 2, w * 0.55, 0.44, t, 0, { top: true }); }
}
export function buildCastle(q) {
  const B = new RB(), C = CASTLE, P = C.poly, h = C.h;
  // the four walls: brick with stone quoins, string courses, sash windows with stone surrounds, statues in niches
  const lit = (i) => [1000 + i, 1];
  let wi = 0;
  for (let e = 0; e < 4; e++) {
    const p = P[e], r = P[(e + 1) % 4], L = Math.hypot(r[0] - p[0], r[1] - p[1]), ax = (r[0] - p[0]) / L, az = (r[1] - p[1]) / L;
    // outward normal of a CCW-in-z-down ring... decide by the centroid
    const cx = (P[0][0] + P[2][0]) / 2, cz = (P[0][1] + P[2][1]) / 2, mx = (p[0] + r[0]) / 2, mz = (p[1] + r[1]) / 2;
    let nx = az, nz = -ax; if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz; }
    // frame: local x along the wall seen from outside (viewer's right), +z out
    const fx = nz, fz = -nx;   // frame's local +z = (-fz, fx) = the outward normal
    B.push(frame(mx, 0, mz, fx, fz));
    const long = L > 10, wins = long ? 6 : 1;
    const holes = [];
    const xs = []; for (let k = 0; k < wins; k++) xs.push(long ? -L / 2 + L * (k + 0.5) / wins : 0);
    for (const x of xs) for (let s = 0; s < 3; s++) { const y0 = C.storeys[s * 2] + (s === 0 ? 0.2 : 0), y1 = C.storeys[s * 2 + 1] - (s === 2 ? 0.2 : 0); holes.push(archPts(x, 1.05, y0, y1 - 0.4, q ? 4 : 6)); }
    if (q === 2) B.poly('brick', [[-L / 2, 0, 0], [L / 2, 0, 0], [L / 2, h, 0], [-L / 2, h, 0]], [0, 0, 1], [[0, 0], [L, 0], [L, h], [0, h]]);
    else {
      B.face('brick', rectPts(-L / 2, 0, L / 2, h), holes, 0);
      for (const hl of holes) { B.reveal('brickDk', hl, 0, -0.22); B.unit('sash', hl, -0.22, lit(wi++)); }
      // stone surrounds: a sill and a hood over each window, stone quoins at the corners
      for (const hl of holes) { const x0 = hl[0][0], x1 = hl[1][0], y0 = hl[0][1]; let y1 = 0; for (const pt of hl) y1 = Math.max(y1, pt[1]); B.box('dress', (x0 + x1) / 2, y0 - 0.06, 0.07, x1 - x0 + 0.24, 0.12, 0.14, 0, { bottom: true }); if (q === 0) B.box('dress', (x0 + x1) / 2, y1 + 0.1, 0.05, x1 - x0 + 0.36, 0.14, 0.1, 0, { bottom: true }); }
      if (q === 0) for (const sx of [-1, 1]) for (let y = 0.2; y < h; y += 0.6) B.box('dress', sx * (L / 2 - 0.25), y + 0.14, 0.03, (Math.round(y / 0.6) % 2 ? 0.5 : 0.32), 0.27, 0.06, 0);
    }
    // string courses at the floors
    for (const y of [C.storeys[1] + 0.35, C.storeys[3] + 0.35]) B.box('dress', 0, y, 0.06, L + 0.1, 0.22, 0.12, 0, { bottom: true });
    // statues in niches between the windows of the long fronts (first floor), on pedestals
    if (long && q < 2) for (let k = 1; k < wins; k += 2) {
      const x = -L / 2 + L * k / wins, y0 = C.storeys[2] + 0.3;
      B.unit('niche', [[x - 0.5, y0], [x + 0.5, y0], [x + 0.5, y0 + 1.9], [x - 0.5, y0 + 1.9]], 0.02, [0, 0]);
      // a white figure standing in it (K: "white sculptures" in niches, Coade-stone; the figures themselves G)
      B.box('dress', x, y0 + 0.06, 0.23, 0.62, 0.12, 0.4, 0);
      B.lathe('white', x, 0.24, [[0.17, y0 + 0.12], [0.16, y0 + 0.9], [0.13, y0 + 1.25], [0.07, y0 + 1.32], [0.08, y0 + 1.46], [0, y0 + 1.55]], { seg: q ? 5 : 8 });
    }
    // polychrome brickwork (K: "red and grey brick"): grey bands between the windows, a diaper course under the parapet
    if (q < 2) for (const y of [0.45, 3.68, 7.06]) B.box('brickDk', 0, y, 0.045, L - 1.25, 0.22, 0.05, 0, { bottom: true });
    if (q === 0) for (let x = -L / 2 + 0.9; x < L / 2 - 0.7; x += 0.9) B.box('brickDk', x, h - 0.45, 0.045, 0.3, 0.3, 0.05, Math.PI / 4 * 0);
    // cast-iron balconies on the long fronts at the first floor: a slab and a railing (two bands, uprights on the near copy)
    if (long) {
      const bx0 = -L / 2 + 1.0, bx1 = L / 2 - 1.0, y = C.storeys[2] - 0.15, d = 0.9;
      B.box('iron', 0, y, d / 2, bx1 - bx0, 0.1, d, 0, { bottom: true });
      B.box('iron', 0, y + 0.95, d, bx1 - bx0, 0.05, 0.05, 0); B.box('iron', 0, y + 0.3, d, bx1 - bx0, 0.04, 0.04, 0);
      if (q === 0) for (let x = bx0; x <= bx1 + 1e-3; x += 0.32) B.box('iron', x, y + 0.5, d, 0.025, 0.95, 0.025, 0, { top: false });
      if (q === 0) for (let x = bx0; x <= bx1; x += 2.4) B.beam('iron', [x + 0.1, y - 0.05, 0.02], [x + 0.1, y - 0.75, 0.0], 0.05);
    }
    // the crenellated parapet
    crenel(B, 'dress', -L / 2, L / 2, h, C.parapet, 0.4, q);
    B.pop();
  }
  // the roof (lead flat behind the parapet)
  flatUp(B, 'lead', P, h - 0.05);
  // the corner turrets at the two short ends (octagonal, brick, a stone band, crenellated, to ~14 m)
  for (const [i, j] of [[0, 3], [1, 2]]) {
    for (const k of [i, j]) {
      const [x, z] = P[k], cx = (P[0][0] + P[2][0]) / 2, cz = (P[0][1] + P[2][1]) / 2, d = Math.hypot(x - cx, z - cz), tx = x + (x - cx) / d * 0.35, tz = z + (z - cz) / d * 0.35;
      prismN(B, 'brick', tx, tz, 1.15, 8, 0, h + 2.4, Math.PI / 8, false);
      prismN(B, 'dress', tx, tz, 1.3, 8, h + 2.4, h + 2.75, Math.PI / 8, true);
      if (q < 2) for (let m = 0; m < 8; m += 2) { const t = Math.PI / 8 + (m / 8) * TAU + TAU / 16; B.box('dress', tx + Math.sin(t) * 1.15, h + 3.05, tz + Math.cos(t) * 1.15, 0.5, 0.6, 0.3, t); }
      if (q === 0) for (const y of [3.6, 7.0]) prismN(B, 'dress', tx, tz, 1.2, 8, y, y + 0.2, Math.PI / 8, false);
      if (q < 2) for (const y of [4.8, 8.2]) { const t = Math.atan2(tx - cx, tz - cz); B.push(frame(tx + Math.sin(t) * 1.13, 0, tz + Math.cos(t) * 1.13, Math.cos(t), -Math.sin(t))); B.unit('sash', archPts(0, 0.55, y, y + 0.8, 4), 0.01, [1300 + k, 1]); B.pop(); }
    }
  }
  // statues on the parapet (G): four small stone figures on the long south front's merlons
  if (q < 2) {
    const p = P[3], r = P[2], L = Math.hypot(r[0] - p[0], r[1] - p[1]), cx = (P[0][0] + P[2][0]) / 2, cz = (P[0][1] + P[2][1]) / 2;
    for (let k = 1; k <= 4; k++) {
      const t = k / 5, x = p[0] + (r[0] - p[0]) * t, z = p[1] + (r[1] - p[1]) * t, nx = (x - cx), nz = (z - cz), d = Math.hypot(nx, nz), sx = x - nx / d * 0.2, sz = z - nz / d * 0.2;
      B.box('dress', sx, h + C.parapet + 0.08, sz, 0.55, 0.16, 0.55, 0);
      B.lathe('statue', sx, sz, [[0.2, h + C.parapet + 0.16], [0.19, h + C.parapet + 0.9], [0.15, h + C.parapet + 1.2], [0.08, h + C.parapet + 1.26], [0.09, h + C.parapet + 1.4], [0, h + C.parapet + 1.48]], { seg: q ? 5 : 8 });
      void L;
    }
    // Atlas on the roof (K: "topped with ... a statue of Atlas"; pose G): a kneeling figure bearing a globe, centre of the roof
    const ax = (P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4, az = (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4, y0 = h + 0.2;
    B.box('dress', ax, y0 + 0.3, az, 1.1, 0.6, 1.1, 0.05);
    B.lathe('white', ax, az, [[0.36, y0 + 0.6], [0.34, y0 + 1.0], [0.24, y0 + 1.5], [0.12, y0 + 1.62], [0.13, y0 + 1.8], [0, y0 + 1.9]], { seg: q ? 6 : 9 });
    B.beam('white', [ax - 0.3, y0 + 1.45, az], [ax - 0.42, y0 + 2.05, az], 0.1); B.beam('white', [ax + 0.3, y0 + 1.45, az], [ax + 0.42, y0 + 2.05, az], 0.1);
    B.lathe('white', ax, az, [[0, y0 + 1.95], [0.4, y0 + 2.15], [0.56, y0 + 2.5], [0.4, y0 + 2.85], [0, y0 + 3.05]], { seg: q ? 6 : 10 });
    if (q === 0) for (const t of [0.35, 0.65]) B.lathe('dress', ax, az, [[0.57, y0 + 2.5 + (t - 0.5) * 0.9], [0.58, y0 + 2.52 + (t - 0.5) * 0.9]], { seg: 10 });
    // the forecourt cannons (K: Caudwell's cannons pointed across the river; number and place G): two on the north side
    for (const [cx2, cz2] of [[229.5, 984.0], [241.0, 984.4]]) {
      B.box('iron', cx2, 0.32, cz2, 0.7, 0.36, 1.1, 0.04); for (const sx of [-0.38, 0.38]) B.cyl('dark', cx2 + sx, 0.25, cz2, 0.26, 0.04, 8, true);
      B.beam('iron', [cx2, 0.6, cz2 + 0.5], [cx2, 0.78, cz2 - 1.5], 0.24); B.cyl('iron', cx2, 0.55, cz2 + 0.62, 0.15, 0.08, 6, true);
    }
  }
  return B;
}

// ------------------------------------------------------------------------------------------------ the waterfront
function deck(B, key, poly, y, edge = 0.25) {
  flatUp(B, key, poly, y);
  let cx = 0, cz = 0; for (const p of poly) { cx += p[0] / poly.length; cz += p[1] / poly.length; }
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; B.poly('deck', [[a[0], y - edge, a[1]], [b[0], y - edge, b[1]], [b[0], y, b[1]], [a[0], y, a[1]]], [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz]); }
}
function rail(B, a, b, y0, h, q, posts = 1.4) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / posts));
  B.beam('iron', [a[0], y0 + h, a[1]], [b[0], y0 + h, b[1]], 0.05); if (q === 0) B.beam('iron', [a[0], y0 + h * 0.5, a[1]], [b[0], y0 + h * 0.5, b[1]], 0.03);
  for (let k = 0; k <= n; k++) { const t = k / n; B.box('iron', a[0] + (b[0] - a[0]) * t, y0 + h / 2, a[1] + (b[1] - a[1]) * t, 0.05, h, 0.05, 0, { top: false }); }
}
export function buildWaterfront(q) {
  const B = new RB();
  // the terrace: boards on posts, a railing on the river sides, tables with parasols
  deck(B, 'deck', TERRACE, 0.22);
  if (q < 2) {
    rail(B, TERRACE[1], TERRACE[2], 0.22, 1.0, q);
    // the river rail, with an opening where the steamer's gangway comes aboard (systems/_steamer_logic.js GANG.A)
    const T2 = TERRACE[2], T3 = TERRACE[3], L = Math.hypot(T2[0] - T3[0], T2[1] - T3[1]), at = (d) => [T3[0] + (T2[0] - T3[0]) * d / L, T3[1] + (T2[1] - T3[1]) * d / L];
    rail(B, T2, at(TERRACE_GAP + 0.75), 0.22, 1.0, q); rail(B, at(TERRACE_GAP - 0.75), T3, 0.22, 1.0, q);
  }
  if (q < 2) for (const [x, z] of TABLES) {
    B.box('oak', x, 0.95, z, 1.6, 0.06, 0.75, 0.5);
    for (const s of [-1, 1]) B.box('oak', x + s * Math.cos(0.5) * 0.55, 0.62, z - s * Math.sin(0.5) * 0.55, 0.1, 0.8, 0.7, 0.5, { top: false });
    for (const s of [-1, 1]) B.box('oak', x + Math.sin(0.5) * s * 0.7, 0.66, z + Math.cos(0.5) * s * 0.7, 1.6, 0.05, 0.28, 0.5);
    B.cyl('white', x, 0.95, z, 0.025, 1.4, 4, false);
    B.cyl('umbrella', x, 2.2, z, 0.02, 0.55, q ? 6 : 8, false, 1.25);
  }
  // the hire pontoon (floating: just above the water), its gangway from the island, the hire kiosk on the island
  deck(B, 'deck', PONTOON, 0.18, 0.4); deck(B, 'deck', GANGWAY, 0.2, 0.3);
  if (q < 2) rail(B, PONTOON[0], PONTOON[1], 0.18, 0.7, q, 2.2);
  {
    const kx = 266.4, kz = 976.6;
    B.box('weatherCream', kx, 1.3, kz, 2.6, 2.6, 1.8, 0.08);
    B.box('green', kx, 2.7, kz, 3.0, 0.2, 2.2, 0.08);
    if (q < 2) { B.push(frame(kx, 0, kz - 0.92, -1, 0)); B.card('sign_boats', [-1.5, 2.05, 0], [1.5, 2.05, 0], [1.5, 2.5, 0], [-1.5, 2.5, 0], [0.004, 0.004, 0.996, 0.996]); B.card('sign_tickets', [-1.1, 1.3, 0.01], [1.1, 1.3, 0.01], [1.1, 1.62, 0.01], [-1.1, 1.62, 0.01], [0.004, 0.004, 0.996, 0.996]); B.pop(); }
  }
  // rowing boats moored off the pontoon (varnished hulls, white gunwales, two thwarts); the last (east) one is the hire
  // boat you can row, drawn and moved by systems/boathire.js
  for (const [x, z, h] of BOATS.slice(0, 2)) {
    const L = 4.2;
    B.box('varnish', x, 0.2, z, 1.2, 0.32, L - 0.8, h); B.box('white', x, 0.37, z, 1.25, 0.04, L - 0.8, h, { bottom: false });
    B.push(frame(x, 0, z, Math.cos(h), -Math.sin(h)));      // the pointed bow (local +z) and the transom
    B.poly('varnish', [[-0.6, 0.04, (L - 0.8) / 2], [0, 0.04, L / 2 + 0.2], [0, 0.38, L / 2 + 0.3], [-0.6, 0.38, (L - 0.8) / 2]], [-1, 0, 1]);
    B.poly('varnish', [[0, 0.04, L / 2 + 0.2], [0.6, 0.04, (L - 0.8) / 2], [0.6, 0.38, (L - 0.8) / 2], [0, 0.38, L / 2 + 0.3]], [1, 0, 1]);
    B.poly('deck', [[-0.6, 0.36, (L - 0.8) / 2], [0.6, 0.36, (L - 0.8) / 2], [0, 0.36, L / 2 + 0.3]], [0, 1, 0]);
    B.pop();
    if (q === 0) for (const t of [-0.6, 0.5]) B.box('oak', x + Math.sin(h) * t, 0.3, z + Math.cos(h) * t, 1.1, 0.04, 0.25, h);
  }
  // visual pass: punts moored beyond the rowing boats, festoon lights over the terrace, lifebuoys, the hire flags, bikes
  for (const [x, z, h] of PUNTS) punt(B, x, z, h, q);
  if (q < 2) {
    const T0 = TERRACE[3], T1 = TERRACE[2], P0 = PUB.poly[0], P1 = PUB.poly[1], N = 4;
    for (const T of [TERRACE[3], TERRACE[2], TERRACE[1]]) B.cyl('iron', T[0], 0.22, T[1], 0.05, 2.6, 6, true);
    for (let k = 0; k <= N; k++) {
      const t = k / N, a = [P0[0] + (P1[0] - P0[0]) * t, 3.05, P0[1] + (P1[1] - P0[1]) * t], b = [T0[0] + (T1[0] - T0[0]) * t, 2.8, T0[1] + (T1[1] - T0[1]) * t];
      // (the pub wall's face is 0.15 m behind the rail line drawn here: hooks stand off it)
      a[0] += (b[0] - a[0]) * 0.03; a[2] += (b[2] - a[2]) * 0.03;
      if (q === 0 || k % 2 === 0) festoon(B, a, b, q === 0 ? 6 : 3, 0.35, k * 7);
    }
    festoon(B, [T0[0], 2.8, T0[1]], [T1[0], 2.8, T1[1]], q === 0 ? 10 : 5, 0.3, 40);
    festoon(B, [T1[0], 2.8, T1[1]], [TERRACE[1][0], 2.8, TERRACE[1][1]], q === 0 ? 3 : 2, 0.2, 50);
    // lifebuoys on the terrace post and on the kiosk side, a bench and two bikes by the kiosk
    for (const [x, y, z, h] of [[TERRACE[2][0] + 0.08, 1.2, TERRACE[2][1] - 0.06, 0.5], [267.75, 1.5, 976.0, Math.PI / 2 + 0.08]]) ring(B, x, y, z, h, q);
    bench(B, 269.6, 977.6, Math.PI + 0.08, 'oak'); bike(B, 262.9, 978.0, 0.1, 'navy', q); bike(B, 263.6, 978.3, 0.05, 'red', q);
    // pennants on a line from the kiosk roof to a mast at the pontoon's end
    pennants(B, [267.8, 2.85, 976.6], [273.4, 3.6, 971.4], q === 0 ? 10 : 5);
    B.cyl('white', 273.6, 0.18, 971.6, 0.05, 3.6, 6, true);
  }
  // the pub's fascia on its west gable (towards the bridge road) and a hanging lantern
  if (q < 2) { const [a, b] = [PUB.poly[0], PUB.poly[3]]; const ux = b[0] - a[0], uz = b[1] - a[1], L = Math.hypot(ux, uz), nx = -uz / L, nz = ux / L; signCard(B, 'sign_pub', a[0] + ux * 0.08, a[1] + uz * 0.08, b[0] - ux * 0.08, b[1] - uz * 0.08, 3.3, 4.2, nx, nz, 0.06); }
  return B;
}

/** a punt: a flat-bottomed 7.3 m box, a raised till at the stern, two cushions (G: Oxford punts are poled from the till) */
export const PUNTS = [[264.6, 962.6, Math.PI / 2 + 0.02], [264.9, 963.7, Math.PI / 2 - 0.01], [265.1, 964.8, Math.PI / 2 + 0.03]];
function punt(B, x, z, h, q) {
  B.push(frame(x, 0, z, Math.cos(h), -Math.sin(h)));      // local +z along the punt
  B.box('varnish', 0, 0.12, 0, 0.88, 0.3, 7.3, 0, { bottom: false });
  if (q < 2) { B.box('deck', 0, 0.28, -3.2, 0.86, 0.04, 0.9, 0); B.box('oak', 0, 0.24, 0.3, 0.84, 0.03, 5.2, 0); }
  if (q === 0) { for (const zz of [-1.2, 1.6]) B.box(zz < 0 ? 'navy' : 'red', 0, 0.36, zz, 0.7, 0.14, 0.9, 0); B.beam('oak', [0.3, 0.3, -3.4], [0.3, 0.32, 3.4], 0.04); }
  B.pop();
}
/** a lifebuoy ring (red and white quarters) at (x, y, z), its plane facing h */
function ring(B, x, y, z, h, q) {
  const n = q === 0 ? 12 : 6, R = 0.32, ux = Math.cos(h), uz = -Math.sin(h);
  for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU; B.beam(Math.floor(i * 4 / n) % 2 ? 'white' : 'red', [x + ux * Math.cos(a0) * R, y + Math.sin(a0) * R, z + uz * Math.cos(a0) * R], [x + ux * Math.cos(a1) * R, y + Math.sin(a1) * R, z + uz * Math.cos(a1) * R], 0.1); }
}
/** a line of pennants (invented colours) between two points */
export function pennants(B, a, b, n) {
  B.beam('rope', a, b, 0.015);
  const keys = ['red', 'navy', 'gold', 'white', 'green'], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, w = Math.min(0.32, L / (n + 1) * 0.42);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.12, a[2] + (b[2] - a[2]) * t];
    const ox = dx / L * w, oz = dz / L * w, k = keys[i % keys.length];
    B.poly(k, [[p[0] - ox, p[1], p[2] - oz], [p[0] + ox, p[1], p[2] + oz], [p[0], p[1] - 0.42, p[2]]], [-dz, 0, dx]);
    B.poly(k, [[p[0] + ox, p[1], p[2] + oz], [p[0] - ox, p[1], p[2] - oz], [p[0], p[1] - 0.42, p[2]]], [dz, 0, -dx]);
  }
}

// ------------------------------------------------------------------------------------------------ the steamer
/** the steamer at pose S (default: the old berth; systems/steamer.js passes {x: 0, z: 0, h: 0} and its own saloon /
 *  canopy numbers for the moving boat: c0, c1 saloon ends, cw its half width, canopy the awning's height) */
export function buildSteamer(q, S = STEAMER) {
  const B = new RB(), hl = S.L / 2, hb = S.B / 2;
  B.push(frame(S.x, 0, S.z, Math.sin(S.h), Math.cos(S.h)));        // local x = bow -> stern? x along the boat, z across
  // hull: a long box with a pointed bow (local +x) and a rounded counter stern; navy band over cream
  const bow = [[hl - 2.6, -hb], [hl, 0], [hl - 2.6, hb]];
  const outline = [[-hl + 0.6, -hb], ...bow, [-hl + 0.6, hb], [-hl, hb * 0.6], [-hl, -hb * 0.6]];
  // (a band round the hull - not `ring`: that name is the lifebuoy below, which this once shadowed, so the buoys came out
  // as a stray poly keyed 3.3 and "[worcester] no material 3.3")
  const band = (y0, y1, key) => { for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length]; B.poly(key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]); } };
  band(-0.3, 0.45, 'steamerBlue'); band(0.45, 1.0, 'steamerCream'); band(1.0, 1.1, 'oak');
  const shape = outline.map(([x, z]) => [x, z]);
  flatUp(B, 'deck', shape, 0.95);
  // the saloon: a long cabin with windows, a canopied upper deck with white rails, the funnel, the wheelhouse
  const c0 = S.c0 ?? -hl + 2.2, c1 = S.c1 ?? hl - 3.6, cw = S.cw ?? hb - 0.35, cy = S.canopy ?? 4.65;
  B.box('steamerCream', (c0 + c1) / 2, 0.95 + 1.0, 0, c1 - c0, 2.0, cw * 2, 0, { top: false });
  if (q < 2) for (const side of [-1, 1]) {
    B.push(frame((c0 + c1) / 2, 0, side * cw, side > 0 ? 1 : -1, 0));
    const n = q ? 4 : 7, Lc = c1 - c0;
    for (let k = 0; k < n; k++) { const x = -Lc / 2 + Lc * (k + 0.5) / n; B.unit('glazed', [[x - 0.8, 1.3], [x + 0.8, 1.3], [x + 0.8, 2.55], [x - 0.8, 2.55]], 0.02, [2000 + k, 1]); }
    B.pop();
  }
  B.box('white', (c0 + c1) / 2, 3.0, 0, c1 - c0 + 0.3, 0.1, cw * 2 + 0.3, 0, { bottom: true });
  if (q < 2) { for (const side of [-1, 1]) B.box('white', (c0 + c1) / 2, 3.55, side * (cw + 0.1), c1 - c0, 0.05, 0.05, 0); for (let x = c0; x <= c1; x += 1.4) for (const side of [-1, 1]) B.box('white', x, 3.3, side * (cw + 0.1), 0.04, 0.55, 0.04, 0, { top: false }); }
  B.box('canvas', (c0 + c1) / 2 + 1.0, cy, 0, c1 - c0 - 2.0, 0.08, cw * 2 + 0.2, 0, { bottom: true });
  if (q < 2) for (const x of [c0 + 1.5, c1 - 0.5]) for (const side of [-1, 1]) B.cyl('white', x, 3.05, side * cw, 0.04, cy - 3.05, 4, false);
  B.cyl('steamerCream', (c0 + c1) / 2 - 1.5, 3.05, 0, 0.32, 1.9, q ? 6 : 10, true); B.cyl('dark', (c0 + c1) / 2 - 1.5, 4.95, 0, 0.33, 0.4, q ? 6 : 10, true);
  B.box('steamerCream', c1 + 0.9, 1.6, 0, 1.6, 1.3, cw * 1.6, 0);   // wheelhouse forward
  if (q < 2) B.box('glazed', c1 + 1.71, 1.95, 0, 0.02, 0.5, cw * 1.4, 0);
  // the name boards each side, at the bow
  if (q < 2) for (const side of [-1, 1]) { const z = side * (hb + 0.02), x0 = hl - 7.2, x1 = hl - 3.2; B.card('sign_steamer', side > 0 ? [x0, 0.52, z] : [x1, 0.52, z], side > 0 ? [x1, 0.52, z] : [x0, 0.52, z], side > 0 ? [x1, 0.92, z] : [x0, 0.92, z], side > 0 ? [x0, 0.92, z] : [x1, 0.92, z], [0.004, 0.004, 0.996, 0.996]); }
  // visual pass: dressing lines of pennants bow - funnel - stern, life rings on the rail, a lantern at the bow
  if (q < 2) { const fx = (c0 + c1) / 2 - 1.5; pennants(B, [hl - 0.4, 1.3, 0], [fx, 5.3, 0], q === 0 ? 9 : 4); pennants(B, [fx, 5.3, 0], [-hl + 0.5, 1.4, 0], q === 0 ? 9 : 4); }
  if (q < 2) for (const side of [-1, 1]) ring(B, c0 + 4, 3.3, side * (cw + 0.16), 0, q);
  if (q === 0) { B.cyl('white', hl - 0.6, 1.1, 0, 0.03, 1.2, 4, false); bulb(B, hl - 0.6, 2.36, 0, 0.08, 3); }
  // fenders and mooring lines to the terrace posts
  if (q === 0) for (let k = 0; k < 5; k++) B.cyl('rubber', -hl + 3 + k * 3.6, 0.35, -hb - 0.12, 0.14, 0.55, 6, true);
  B.pop();
  return B;
}
