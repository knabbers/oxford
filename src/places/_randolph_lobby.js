// Interior 'randolph_lobby': the entrance hall (Wilkinson's cantilevered staircase, reception) and the Morse Bar
// (oak-panelled, leather armchairs, Inspector Morse pictures — the bar was renamed for Morse in 2001).
// Layout, colours and furniture are plausible guesses; venues.md §7 has the few sourced details.
// Fidelity pass: the shell (walls, dado, cornice, ceilings, floors) is built here as merged geometry in seven materials
// instead of one mesh per wall piece; the way through to the bar is a real two-centred Gothic arch (stone archivolt on
// shafts, soffit through the wall) instead of loose blocks; joinery, ceiling plasterwork, rug, back bar and reception
// fittings are painted in one 1024 px atlas (lobbyAtlas in _randolph_tex.js).
import * as THREE from 'three';
import { Geo, paintMaterial } from './_randolph_kit.js';
import { lobbyAtlas, wallpaper } from './_randolph_tex.js';

export const LOBBY = {
  spawn: [0, -3.6], heading: 0, exit: [0, -4.5],
  bar: { order: [0, 10.25], barman: [0, 11.75] },
  reception: [5.3, -0.3],
};
// (walk-in, second pass) the lobby's two street windows: the pointed two-light windows of the bays either side of the
// entrance tower (_randolph_tex.js windowGothic, ground storey: sill 0.9, apex 3.85, 1.9 m wide painted on a 3.5 m bay
// that is drawn 3.82 m wide), as real openings in the north wall. randolph.js declares them and dresses the outside.
export const LOBBY_WIN = { xs: [-3.82, 3.82], w: 2.07, y0: 0.9, y1: 3.85, rise: 1.045 };
const STONE = 0xd8ccae, OAK = 0x3a2616, BRASS = 0xc9a24a, LEATHER = 0x5a2a17, IRON = 0x17171a;

/** club armchair: sloping buttoned back, rolled arms, loose seat cushion, bun feet. Faces +z. ~84 triangles. */
function armchair(G, x, z, ry, tint = LEATHER) {
  const c = new THREE.Color(tint), sh = (k) => c.clone().multiplyScalar(k).getHex();
  G.at(x, 0, z, ry);
  G.color(sh(0.72)); G.box('paint', -0.44, 0.1, -0.4, 0.44, 0.36, 0.42, { top: false });                 // carcass
  G.color(sh(1.12)); G.box('paint', -0.33, 0.36, -0.26, 0.33, 0.5, 0.44);                                 // seat cushion
  // back: a slab leaning back, with a rolled top
  G.color(sh(0.95)); G.poly('paint', [[-0.44, 0.36, -0.24], [0.44, 0.36, -0.24], [0.44, 0.98, -0.36], [-0.44, 0.98, -0.36]], [0, 0.2, 1]);
  G.color(sh(0.62)); G.poly('paint', [[0.44, 0.1, -0.46], [-0.44, 0.1, -0.46], [-0.44, 0.98, -0.52], [0.44, 0.98, -0.52]], [0, 0, -1]);
  G.color(sh(1.2)); G.poly('paint', [[-0.44, 0.98, -0.36], [0.44, 0.98, -0.36], [0.44, 1.04, -0.44], [-0.44, 1.04, -0.44]], [0, 1, 0.5]);
  G.color(sh(0.8)); G.poly('paint', [[-0.44, 1.04, -0.44], [0.44, 1.04, -0.44], [0.44, 0.98, -0.52], [-0.44, 0.98, -0.52]], [0, 1, -0.5]);
  for (const s of [-1, 1]) {
    // back cheeks + rolled arm (three-facet roll)
    G.color(sh(0.7)); G.poly('paint', [[s * 0.44, 0.1, -0.46], [s * 0.44, 0.1, -0.24], [s * 0.44, 0.98, -0.36], [s * 0.44, 1.04, -0.44], [s * 0.44, 0.98, -0.52]], [s, 0, 0]);
    const x0 = s * 0.33, x1 = s * 0.5, xm = s * 0.415;
    G.color(sh(0.78)); G.poly('paint', [[x1, 0.1, -0.3], [x1, 0.1, 0.42], [x1, 0.6, 0.42], [x1, 0.6, -0.3]], [s, 0, 0]);
    G.color(sh(0.92)); G.poly('paint', [[x0, 0.5, -0.26], [x0, 0.5, 0.42], [x0, 0.62, 0.42], [x0, 0.62, -0.26]], [-s, 0, 0]);
    G.color(sh(1.18)); G.poly('paint', [[x0, 0.62, -0.28], [x0, 0.62, 0.42], [xm, 0.69, 0.42], [xm, 0.69, -0.28]], [-s, 1, 0]);
    G.color(sh(1.0)); G.poly('paint', [[xm, 0.69, -0.28], [xm, 0.69, 0.42], [x1, 0.6, 0.42], [x1, 0.6, -0.28]], [s, 1, 0]);
    G.color(sh(0.9)); G.poly('paint', [[x0, 0.1, 0.42], [x1, 0.1, 0.42], [x1, 0.6, 0.42], [xm, 0.69, 0.42], [x0, 0.62, 0.42]], [0, 0, 1]);
  }
  G.color(sh(0.85)); G.poly('paint', [[-0.33, 0.1, 0.42], [0.33, 0.1, 0.42], [0.33, 0.36, 0.42], [-0.33, 0.36, 0.42]], [0, 0, 1]);
  G.color(0x1a120c); for (const [a, b] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.34], [0.36, 0.34]]) G.box('paint', a - 0.04, 0, b - 0.04, a + 0.04, 0.1, b + 0.04, { top: false });
  G.pop();
}

export function buildLobby(ctx, game) {
  const K = game.world.interiorKit, mats = game.world.mats, s = ctx.scene, col = ctx.collider;
  const A = lobbyAtlas();
  const G = new Geo();
  /** quad on a wall: a -> b is the viewer's left -> right along the floor line, y0..y1; metric UVs unless a rect is given */
  const band = (key, a, b, y0, y1, rect = null, u0 = 0) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    G.quadUV(key, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], rect || [u0, y0, u0 + L, y1]);
  };

  // ------------------------------------------------------------------------------------------ shells
  // lobby: x -6..6, z -5..5, 5.2 m high. Bar: x -5..5, z 5.2..12.2, 3.6 m high. The wall between them is 0.2 m thick,
  // pierced at x = 2.5 by the arch.
  const LH = 5.2, BH = 3.6, DADO = 1.15, FRIEZE = 4.55, DX = 2.5, AW = 0.8, YS = 1.95, NSEG = 6;
  const apex = YS + 2 * AW * Math.sin(Math.PI / 3);
  /** arch intrados points from the right springing over the apex to the left one, in wall coordinates (s, y) about sc */
  const archPts = (sc, r = 2 * AW) => {
    const th = Math.acos(AW / r), pts = [];
    for (let i = 0; i <= NSEG; i++) { const t = (i / NSEG) * th; pts.push([sc - AW + r * Math.cos(t), YS + r * Math.sin(t)]); }
    for (let i = NSEG - 1; i >= 0; i--) { const t = (i / NSEG) * th; pts.push([sc + AW - r * Math.cos(t), YS + r * Math.sin(t)]); }
    return pts;
  };
  /** a wall with the arch through it. P(s, y) -> [x, y, z] with s running to the viewer's right; bands [[y0, y1, key]] */
  function archWall(P, L, YA, sc, bands, nrm, aboveKey) {
    const quad = (key, s0, s1, y0, y1) => { if (s1 - s0 < 1e-4 || y1 - y0 < 1e-4) return; G.quadUV(key, P(s0, y0), P(s1, y0), P(s1, y1), P(s0, y1), [s0, y0, s1, y1]); };
    for (const [y0, y1, key] of bands) {
      quad(key, 0, sc - AW, y0, Math.min(y1, YA)); quad(key, sc + AW, L, y0, Math.min(y1, YA));
      if (y1 > YA) quad(key, 0, L, Math.max(y0, YA), y1);
    }
    const pts = archPts(sc);
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];          // s decreases from p to q
      G.poly(aboveKey, [P(q[0], q[1]), P(p[0], p[1]), P(p[0], YA), P(q[0], YA)], nrm, [[q[0], q[1]], [p[0], p[1]], [p[0], YA], [q[0], YA]]);
    }
  }
  const PL = (sv, y) => [6 - sv, y, 5.0], PB = (sv, y) => [-5 + sv, y, 5.2];
  archWall(PL, 12, 3.5, 6 - DX, [[0, DADO, 'panel'], [DADO, FRIEZE, 'paper']], [0, 0, -1], 'paper');
  archWall(PB, 10, BH - 0.22, DX + 5, [[0, BH - 0.22, 'panel']], [0, 0, 1], 'panel');
  // soffit + jambs of the arch through the wall (stone), from the proud archivolt face on the lobby side to the bar face
  {
    const pts = archPts(0), z0 = 4.94, z1 = 5.2;
    G.color(STONE);
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      G.poly('paint', [[DX - p[0], p[1], z0], [DX - q[0], q[1], z0], [DX - q[0], q[1], z1], [DX - p[0], p[1], z1]], [(p[0] + q[0]) / 2, -0.5, 0]);
    }
    for (const sg of [-1, 1]) G.poly('paint', [[DX + sg * AW, 0, z0], [DX + sg * AW, 0, z1], [DX + sg * AW, YS, z1], [DX + sg * AW, YS, z0]], [-sg, 0, 0]);
    // archivolt: a moulded stone band round the arch on the lobby side, two orders (inner proud, outer hood)
    const inner = archPts(0), o1 = archPts(0, 2 * AW + 0.14), o2 = archPts(0, 2 * AW + 0.24);
    for (let i = 0; i < inner.length - 1; i++) {
      const f = (a, b, c, d, z, colr) => { G.color(colr); G.poly('paint', [[DX - a[0], a[1], z], [DX - b[0], b[1], z], [DX - c[0], c[1], z], [DX - d[0], d[1], z]], [0, 0, -1]); };
      f(inner[i], inner[i + 1], o1[i + 1], o1[i], 4.94, 0xe2d7ba);
      f(o1[i], o1[i + 1], o2[i + 1], o2[i], 4.97, 0xc4b796);
      // outer edge of the hood, back to the wall
      G.color(0xb0a384); G.poly('paint', [[DX - o2[i][0], o2[i][1], 4.97], [DX - o2[i + 1][0], o2[i + 1][1], 4.97], [DX - o2[i + 1][0], o2[i + 1][1], 5.0], [DX - o2[i][0], o2[i][1], 5.0]], [-(o2[i][0] + o2[i + 1][0]), 1, 0]);
    }
    // jamb shafts with moulded capitals and bases; label stops under the hood
    for (const sg of [-1, 1]) {
      const x = DX + sg * (AW + 0.09);
      G.color(0xcdbf9e); G.box('paint', x - 0.13, 0, 4.9, x + 0.13, 0.32, 5.0);
      G.color(0x8a3a34); G.cyl('paint', x, 0.32, 4.93, 0.065, YS - 0.5, 7, 0.065, false);                    // polished red shaft (Venetian Gothic)
      G.color(0xe2d7ba); G.box('paint', x - 0.12, YS - 0.18, 4.88, x + 0.12, YS - 0.06, 5.0, { bottom: true });
      G.color(0xd2c6a6); G.box('paint', x - 0.16, YS - 0.06, 4.86, x + 0.16, YS, 5.0, { bottom: true });
    }
    // gilt "MORSE BAR" board over the arch
    G.quadUV('trim', [DX + 0.7, apex + 0.34, 4.985], [DX - 0.7, apex + 0.34, 4.985], [DX - 0.7, apex + 0.69, 4.985], [DX + 0.7, apex + 0.69, 4.985], A.uv.sign);
  }
  // the other lobby walls: oak dado, striped paper, plaster frieze
  const lobbyWalls = [[[-6, -5], [6, -5]], [[6, -5], [6, 5]], [[-6, 5], [-6, -5]]];       // n, e, w as seen from inside
  // (walk-in, randolph.js: the street doorway is a real opening in the north wall — 1.8 × 2.6 m between the stone jambs)
  const SL = !!ctx.seamless, DW = 0.9, DH = 2.6;
  for (const [a, b] of lobbyWalls) {
    if (SL && a[1] === -5 && b[1] === -5) {
      // (the door and the two windows are holes: the wall is laid in pieces between them)
      const Wn = LOBBY_WIN, hw = Wn.w / 2, cuts = [[Wn.xs[0] - hw, Wn.xs[0] + hw, Wn.y0, Wn.y1], [-DW, DW, 0, DH], [Wn.xs[1] - hw, Wn.xs[1] + hw, Wn.y0, Wn.y1]];
      const piece = (x0, x1, y0, y1) => { if (y1 - y0 < 0.01) return; if (y0 < DADO) band('panel', [x0, -5], [x1, -5], y0, Math.min(y1, DADO), null, x0 + 6); if (y1 > DADO) band('paper', [x0, -5], [x1, -5], Math.max(y0, DADO), y1, null, x0 + 6); };
      let x = -6;
      for (const [c0, c1, cy0, cy1] of cuts) { piece(x, c0, 0, FRIEZE); piece(c0, c1, 0, cy0); piece(c0, c1, cy1, FRIEZE); x = c1; }
      piece(x, 6, 0, FRIEZE);
      continue;
    }
    band('panel', a, b, 0, DADO); band('paper', a, b, DADO, FRIEZE);
  }
  const ring = [[-6, -5], [6, -5], [6, 5], [-6, 5]];
  const insetRing = (pts, d) => { const cx = 0, cz = (pts[0][1] + pts[2][1]) / 2; return pts.map(([x, z]) => [x - Math.sign(x - cx) * d, z - Math.sign(z - cz) * d]); };
  /** dado rail, frieze, cove cornice and skirting round a room (ring clockwise seen from above = left->right from inside) */
  function trimRoom(pts, H, friezeY, coveD, opts = {}) {
    const inn = insetRing(pts, coveD), n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], ia = inn[i], ib = inn[(i + 1) % n];
      if (opts.frieze !== false) { G.color(0xe9e1cc); G.quadUV('paint', [a[0], friezeY, a[1]], [b[0], friezeY, b[1]], [b[0], H - coveD, b[1]], [a[0], H - coveD, a[1]], [0, 0, 1, 1]); }
      G.color(0xd5cbb2); G.quadUV('paint', [a[0], H - coveD, a[1]], [b[0], H - coveD, b[1]], [ib[0], H, ib[1]], [ia[0], H, ia[1]], [0, 0, 1, 1]);   // cove
    }
  }
  trimRoom(ring, LH, FRIEZE, 0.42);
  // rails as thin proud strips (dado rail, picture rail, skirting) on every wall run; the south wall stops at the arch
  const rails = (runs, defs) => { for (const [a, b, nx, nz] of runs) for (const [y0, y1, d, c] of defs) { G.color(c); G.box('paint', Math.min(a[0], b[0]) + (nx > 0 ? 0 : nx < 0 ? -d : 0), y0, Math.min(a[1], b[1]) + (nz > 0 ? 0 : nz < 0 ? -d : 0), Math.max(a[0], b[0]) + (nx > 0 ? d : 0), y1, Math.max(a[1], b[1]) + (nz > 0 ? d : 0), { bottom: true }); } };
  if (SL) { const Wn = LOBBY_WIN, hw = Wn.w / 2; rails([[[-6, -5], [Wn.xs[0] - hw, -5], 0, 1], [[Wn.xs[0] + hw, -5], [Wn.xs[1] - hw, -5], 0, 1], [[Wn.xs[1] + hw, -5], [6, -5], 0, 1]], [[DADO - 0.03, DADO + 0.05, 0.045, 0x4a301a]]); }
  const lobbyRuns = [...(SL ? [] : [[[-6, -5], [6, -5], 0, 1]]), [[6, -5], [6, 5], -1, 0], [[-6, -5], [-6, 5], 1, 0], [[-6, 5], [DX - AW - 0.22, 5], 0, -1], [[DX + AW + 0.22, 5], [6, 5], 0, -1]];
  rails(lobbyRuns, [[0, 0.16, 0.035, 0x24160c], [DADO - 0.03, DADO + 0.05, 0.045, 0x4a301a], [FRIEZE - 0.05, FRIEZE, 0.03, 0xb8963a]]);
  if (SL) rails([[[-6, -5], [6, -5], 0, 1]], [[0, 0.16, 0.035, 0x24160c], [FRIEZE - 0.05, FRIEZE, 0.03, 0xb8963a]]);
  // floors + ceilings
  G.quadUV('floor', [-6, 0, 5], [6, 0, 5], [6, 0, -5], [-6, 0, -5], [0, 0, 12, 10]);
  G.quadUV('trim', [-5.58, LH, -4.58], [5.58, LH, -4.58], [5.58, LH, 4.58], [-5.58, LH, 4.58], A.uv.ceiling);
  G.color(STONE); G.poly('paint', [[DX - AW, 0.002, 5.0], [DX + AW, 0.002, 5.0], [DX + AW, 0.002, 5.2], [DX - AW, 0.002, 5.2]], [0, 1, 0]);   // threshold
  // bar room: panelled full height, cream cove, carpet, beamed plaster ceiling
  for (const [a, b] of [[[5, 5.2], [5, 12.2]], [[5, 12.2], [-5, 12.2]], [[-5, 12.2], [-5, 5.2]]]) band('panel', a, b, 0, BH - 0.22);
  trimRoom([[-5, 5.2], [5, 5.2], [5, 12.2], [-5, 12.2]], BH, BH - 0.22, 0.22, { frieze: false });
  G.quadUV('carpet', [-5, 0, 12.2], [5, 0, 12.2], [5, 0, 5.2], [-5, 0, 5.2], [0, 0, 10, 7]);
  G.color(0xe6dec8); G.poly('paint', [[-4.78, BH, 5.42], [4.78, BH, 5.42], [4.78, BH, 11.98], [-4.78, BH, 11.98]], [0, -1, 0]);
  G.color(0x2e1c10); for (const z of [7.5, 9.9]) G.box('paint', -4.8, BH - 0.16, z - 0.09, 4.8, BH, z + 0.09, { bottom: true, top: false });   // ceiling beams
  rails([[[5, 5.2], [5, 12.2], -1, 0], [[-5, 5.2], [-5, 12.2], 1, 0], [[-5, 12.2], [5, 12.2], 0, -1], [[-5, 5.2], [DX - AW - 0.22, 5.2], 0, 1], [[DX + AW + 0.22, 5.2], [5, 5.2], 0, 1]], [[0, 0.14, 0.03, 0x1c110a]]);
  // colliders (the kit's room() used to add these)
  const seg = (x0, z0, x1, z1) => col.addSegment(x0, z0, x1, z1, { tag: 'wall' });
  seg(-6, -5, 6, -5); seg(6, -5, 6, 5); seg(-6, -5, -6, 5); seg(-6, 5, DX - AW, 5); seg(DX + AW, 5, 6, 5);
  seg(DX - AW, 5, DX - AW, 5.2); seg(DX + AW, 5, DX + AW, 5.2);
  seg(-5, 5.2, DX - AW, 5.2); seg(DX + AW, 5.2, 5, 5.2); seg(5, 5.2, 5, 12.2); seg(-5, 5.2, -5, 12.2); seg(-5, 12.2, 5, 12.2);

  // ------------------------------------------------------------------------------------------ entrance (north wall)
  // panelled oak double doors with glazed upper lights under a pointed stone head
  if (!SL) for (const sg of [-1, 1]) G.quadUV('trim', [sg < 0 ? -0.9 : 0, 0, -4.97], [sg < 0 ? 0 : 0.9, 0, -4.97], [sg < 0 ? 0 : 0.9, 2.6, -4.97], [sg < 0 ? -0.9 : 0, 2.6, -4.97], sg < 0 ? A.uv.door : [A.uv.door[2], A.uv.door[1], A.uv.door[0], A.uv.door[3]]);
  G.color(STONE);
  for (const sg of [-1, 1]) G.box('paint', sg * 1.0 - 0.1, 0, -5.0, sg * 1.0 + 0.1, 2.6, -4.93, { top: false });
  G.poly('paint', [[1.1, 2.6, -4.93], [-1.1, 2.6, -4.93], [-1.1, 2.85, -4.93], [0, 3.55, -4.93], [1.1, 2.85, -4.93]], [0, 0, 1]);
  G.color(0x26303c); G.poly('paint', [[0.8, 2.68, -4.92], [-0.8, 2.68, -4.92], [-0.8, 2.84, -4.92], [0, 3.32, -4.92], [0.8, 2.84, -4.92]], [0, 0, 1]);   // fanlight glass
  G.color(STONE); G.box('paint', -0.03, 2.68, -4.925, 0.03, 3.3, -4.91, { top: false });

  // ------------------------------------------------------------------------------------------ reception
  // panelled desk with a mahogany top, brass bell, green-shaded lamp, register; key rack and clock on the wall behind
  G.color(0x2a1a10); G.box('paint', 3.58, 1.08, -2.12, 4.42, 1.14, 1.72, { bottom: true });
  G.color(0x3a2414); G.box('paint', 3.72, 0, -2.0, 4.3, 1.08, 1.6, { top: false });
  G.quadUV('trim', [3.715, 0.02, -2.0], [3.715, 0.02, -0.2], [3.715, 1.08, -0.2], [3.715, 1.08, -2.0], A.uv.desk); G.quadUV('trim', [3.715, 0.02, -0.2], [3.715, 0.02, 1.6], [3.715, 1.08, 1.6], [3.715, 1.08, -0.2], A.uv.desk);
  G.color(BRASS); G.cyl('paint', 3.95, 1.14, -1.05, 0.06, 0.035, 8, 0.02);
  G.color(0x2a1a10); G.cyl('paint', 4.0, 1.14, 0.9, 0.06, 0.02, 6); G.color(BRASS); G.cyl('paint', 4.0, 1.16, 0.9, 0.012, 0.26, 4, 0.012, false);
  G.color(0xfff0c0); G.box('glow', 3.88, 1.38, 0.82, 4.12, 1.4, 0.98, { bottom: true, top: false });
  G.color(0x1f5a36); G.box('paint', 3.86, 1.4, 0.8, 4.14, 1.47, 1.0);
  G.color(0xf2ecdc); G.box('paint', 3.82, 1.14, -0.35, 4.18, 1.16, 0.15);                                 // register
  G.quadUV('trim', [5.985, 1.45, -1.35], [5.985, 1.45, 0.75], [5.985, 2.75, 0.75], [5.985, 2.75, -1.35], A.uv.keys);
  col.addBox(4.0, -0.2, 0.8, 3.8, 0);

  // ------------------------------------------------------------------------------------------ staircase
  // Wilkinson's cantilevered stair along the west wall: stone treads springing from the wall, red runner with brass
  // rods, iron balusters, mahogany handrail wreathed onto a newel
  const steps = 18, rise = 0.18, tread = 0.31, x0 = -5.98, x1 = -4.5, zTop = -1.6;
  for (let i = 0; i < steps; i++) {
    const z = zTop + (steps - i) * tread, y = (i + 1) * rise;
    G.color(0xe4dbc6); G.box('paint', x0, y - 0.09, z - tread, x1, y, z + 0.02, { bottom: true });
    G.color(0x8a1f26); G.poly('paint', [[x0 + 0.3, y + 0.004, z], [x1 - 0.22, y + 0.004, z], [x1 - 0.22, y + 0.004, z - tread], [x0 + 0.3, y + 0.004, z - tread]], [0, 1, 0]);
    G.color(0x6e161c); G.poly('paint', [[x0 + 0.3, y - rise, z + 0.024], [x1 - 0.22, y - rise, z + 0.024], [x1 - 0.22, y, z + 0.024], [x0 + 0.3, y, z + 0.024]], [0, 0, 1]);
    G.color(IRON); G.box('paint', x1 - 0.07, y, z - tread / 2 - 0.012, x1 - 0.045, y + 0.93, z - tread / 2 + 0.012, { top: false });
  }
  const yl = steps * rise;
  G.color(0xe4dbc6); G.box('paint', -5.98, yl - 0.2, -4.98, -3.6, yl, zTop, { bottom: true });          // landing
  G.color(0x8a1f26); G.poly('paint', [[-5.68, yl + 0.004, -4.9], [-5.68, yl + 0.004, zTop], [-4.72, yl + 0.004, zTop], [-4.72, yl + 0.004, -4.9]], [0, 1, 0]);
  G.color(0x3a1a10);
  G.beam('paint', [x1 - 0.057, rise + 0.95, zTop + steps * tread - 0.1], [x1 - 0.057, yl + 0.95, zTop], 0.075, 0.06);
  G.beam('paint', [-3.65, yl + 0.95, zTop], [-3.65, yl + 0.95, -4.9], 0.075, 0.06);
  G.beam('paint', [x1 - 0.057, yl + 0.95, zTop], [-3.65, yl + 0.95, zTop], 0.075, 0.06);
  G.color(IRON); for (let z = zTop; z > -4.9; z -= 0.3) G.box('paint', -3.665, yl, z - 0.012, -3.635, yl + 0.93, z + 0.012, { top: false });
  for (let x = -4.4; x < -3.7; x += 0.3) G.box('paint', x - 0.012, yl, zTop - 0.015, x + 0.012, yl + 0.93, zTop + 0.015, { top: false });
  G.color(0x2e1509); G.box('paint', x1 - 0.12, 0, zTop + steps * tread - 0.02, x1 + 0.0, 1.22, zTop + steps * tread + 0.1);   // newel
  G.color(BRASS); G.cyl('paint', x1 - 0.06, 1.22, zTop + steps * tread + 0.04, 0.055, 0.09, 6, 0.02);
  col.addBox(-5.2, zTop + (steps * tread) / 2, 1.5, steps * tread, 0);    // the flight (you can't go upstairs)
  col.addBox(-4.75, -3.25, 2.3, 3.3, 0);                                     // under the landing

  // ------------------------------------------------------------------------------------------ lobby furniture
  G.quadUV('trim', [-2.2, 0.012, -2.8], [-2.2, 0.012, 2.8], [2.2, 0.012, 2.8], [2.2, 0.012, -2.8], A.uv.rug);
  armchair(G, -2.6, 2.6, Math.PI * 0.8); armchair(G, -1.0, 3.6, Math.PI, 0x4a3a22);
  // (the two armchairs and the wine table between them: they used to be walked through. Boxes, each chair's own footprint —
  //  0.88 wide, 0.96 deep, its middle 4 cm behind its origin — turned as the chair is: addBox is what every collider here has)
  for (const [x, z, ry] of [[-2.6, 2.6, Math.PI * 0.8], [-1.0, 3.6, Math.PI]]) col.addBox(x - 0.04 * Math.sin(ry), z - 0.04 * Math.cos(ry), 0.88, 0.96, ry);
  col.addBox(-1.9, 2.9, 0.52, 0.52, 0);
  G.color(0x2a1a10); G.cyl('paint', -1.9, 0.5, 2.9, 0.3, 0.04, 10); G.cyl('paint', -1.9, 0, 2.9, 0.045, 0.5, 5, 0.03, false); G.cyl('paint', -1.9, 0, 2.9, 0.2, 0.03, 6, 0.06);   // wine table
  // paintings (gilt frames) and a pair of wall lights either side of the arch
  for (const [x, z, ry, w] of [[-1.9, -4.985, 0, 1.5], [5.985, 3.0, -Math.PI / 2, 1.5]]) {
    G.at(x, 0, z, ry);
    G.color(0xa98a34); G.box('paint', -w / 2 - 0.1, 1.8, 0, w / 2 + 0.1, 3.0, 0.045);
    G.quadUV('trim', [-w / 2, 1.9, 0.05], [w / 2, 1.9, 0.05], [w / 2, 2.9, 0.05], [-w / 2, 2.9, 0.05], A.uv.landscape);
    G.pop();
  }
  const sconce = (x, y, z, ry) => { G.at(x, y, z, ry); G.color(BRASS); G.box('paint', -0.05, -0.12, 0, 0.05, 0.1, 0.03); G.beam('paint', [0, -0.05, 0.02], [0, -0.02, 0.14], 0.02); G.color(0xffe2a8); G.box('glow', -0.06, 0.0, 0.08, 0.06, 0.17, 0.2, { bottom: true }); G.pop(); };
  sconce(DX - 1.7, 2.35, 4.99, Math.PI); sconce(DX + 1.7, 2.35, 4.99, Math.PI); sconce(-5.99, 2.9, 2.2, Math.PI / 2); if (SL) sconce(2.3, 2.6, -4.99, 0); else { sconce(3.0, 2.6, -4.99, 0); sconce(-3.15, 2.6, -4.99, 0); }
  // brass chandelier under the ceiling rose
  G.color(BRASS); G.cyl('paint', 0, 4.1, 0, 0.025, 1.1, 5, 0.025, false); G.cyl('paint', 0, 3.95, 0, 0.14, 0.2, 8, 0.05);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, cx = Math.sin(a) * 0.62, cz = Math.cos(a) * 0.62;
    G.color(BRASS); G.beam('paint', [Math.sin(a) * 0.1, 4.0, Math.cos(a) * 0.1], [cx, 3.92, cz], 0.022);
    G.color(0xfff0c8); G.cyl('glow', cx, 3.93, cz, 0.022, 0.13, 4, 0.012);
  }

  // ------------------------------------------------------------------------------------------ Morse Bar
  // counter along the south wall: panelled front, mahogany top, brass foot rail; painted back bar with a front row of
  // real bottles for parallax
  G.color(0x24140a); G.box('paint', -3.1, 1.0, 10.78, 3.1, 1.06, 11.55, { bottom: true });
  G.color(0x34200f); G.box('paint', -3, 0, 10.9, 3, 1.0, 11.5, { top: false });
  for (const [a, b] of [[-3, -0.6], [-0.6, 1.8], [1.8, 3]]) { const r = A.uv.desk, f = (b - a) / 2.4; G.quadUV('trim', [b, 0.02, 10.895], [a, 0.02, 10.895], [a, 1.0, 10.895], [b, 1.0, 10.895], [r[0], r[1], r[0] + (r[2] - r[0]) * f, r[3]]); }
  G.color(BRASS); G.beam('paint', [-3, 0.2, 10.74], [3, 0.2, 10.74], 0.035);
  for (const x of [-2.6, 0, 2.6]) G.beam('paint', [x, 0.2, 10.74], [x, 0.14, 10.9], 0.03);
  G.quadUV('trim', [3.2, 0.9, 12.14], [-3.2, 0.9, 12.14], [-3.2, 2.5, 12.14], [3.2, 2.5, 12.14], A.uv.backbar);
  G.color(0x2a1709); G.box('paint', -3.3, 0, 11.92, 3.3, 0.9, 12.16); G.box('paint', -3.3, 2.5, 12.0, 3.3, 2.62, 12.18, { bottom: true });
  const bc = [0x1d4a1d, 0x5a2a0a, 0xcfd8d0, 0x6a1010, 0x8a6a1a, 0x20304a];
  for (let i = 0; i < 16; i++) { const x = -2.9 + i * 0.385; G.color(bc[(i * 7) % bc.length]); G.cyl('paint', x, 0.9, 12.0, 0.036, 0.2, 5, 0.036, false); G.cyl('paint', x, 1.1, 12.0, 0.036, 0.1, 5, 0.012, false); }
  // hand pumps with ceramic handles and a brass drip tray
  for (const x of [-1.2, -0.8, -0.4]) { G.color(BRASS); G.cyl('paint', x, 1.06, 11.02, 0.03, 0.1, 6); G.color(0x16130f); G.beam('paint', [x, 1.16, 11.02], [x, 1.5, 10.95], 0.035); G.color(0xece4d2); G.boxC('paint', x, 1.36, 10.955, 0.06, 0.1, 0.012); }
  G.color(0x8a6a2a); G.box('paint', -1.45, 1.06, 10.84, -0.15, 1.075, 10.98);
  col.addBox(0, 11.2, 6.2, 0.75, 0);
  // armchairs around low tables
  const tables = [[-3.0, 7.2], [-0.6, 8.6], [-3.2, 9.6], [3.7, 7.2]];
  tables.forEach(([tx, tz], k) => {
    G.color(0x2a1a10); G.cyl('paint', tx, 0.42, tz, 0.4, 0.04, 10); G.cyl('paint', tx, 0, tz, 0.05, 0.42, 5, 0.035, false); G.cyl('paint', tx, 0, tz, 0.24, 0.03, 6, 0.08);
    G.color(0xd8901e); G.cyl('paint', tx + 0.1, 0.46, tz, 0.035, 0.12, 6, 0.04); G.color(0xf4ecd8); G.cyl('paint', tx + 0.1, 0.58, tz, 0.04, 0.02, 6, 0.04);
    armchair(G, tx - 0.95, tz, Math.PI / 2, k % 2 ? 0x1f3a2a : LEATHER); armchair(G, tx + 0.95, tz, -Math.PI / 2, k % 2 ? 0x1f3a2a : LEATHER);
    col.addBox(tx, tz, 2.8, 0.9, 0);
  });
  // framed Morse pictures (east and west walls) + a brass plaque
  const picQuad = (x, z, ry, uv) => {
    G.at(x, 0, z, ry); G.color(0xa98a34); G.box('paint', -0.56, 1.44, 0, 0.56, 2.36, 0.045);
    G.quadUV('trim', [-0.48, 1.52, 0.05], [0.48, 1.52, 0.05], [0.48, 2.28, 0.05], [-0.48, 2.28, 0.05], uv); G.pop();
  };
  picQuad(-4.985, 7.0, Math.PI / 2, A.uv.pic0); picQuad(-4.985, 11.0, Math.PI / 2, A.uv.pic1);
  picQuad(4.985, 8.4, -Math.PI / 2, A.uv.pic1); picQuad(4.985, 10.6, -Math.PI / 2, A.uv.pic0);
  G.at(-1.8, 0, 5.215, 0); G.color(BRASS); G.box('paint', -0.4, 1.7, 0, 0.4, 2.0, 0.03); G.pop();
  sconce(4.99, 2.45, 9.5, -Math.PI / 2); sconce(-1.0, 2.5, 5.21, 0); sconce(0.4, 2.5, 5.21, 0);

  const paper = new THREE.MeshStandardMaterial({ map: wallpaper(), roughness: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ map: A.texture, roughness: 0.7 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const paint = paintMaterial();
  const meshes = G.build({ paint, paper, trim, glow, panel: mats.panelling, floor: mats.floorTiles, carpet: mats.carpet }, s, { name: 'randolph-lobby', cast: false });
  if (meshes.paint) meshes.paint.material = paint;
  K.fireplace(s, { x: -4.75, z: 9.1, rot: Math.PI / 2, collider: col });
  K.warmLight(s, { x: 0, y: 3.9, z: 0, intensity: 22, distance: 18 });
  K.warmLight(s, { x: -1.8, y: 3.0, z: 8.2, intensity: 9, distance: 11 });
  K.warmLight(s, { x: 2.2, y: 3.0, z: 10.4, intensity: 8, distance: 10, color: 0xffb870 });
  return { spawn: LOBBY.spawn, heading: LOBBY.heading, tris: Object.values(meshes).reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0) };
}
