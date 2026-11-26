// SHOWPIECE: the Pitt Rivers Museum hall — a dim, gabled hall of seven bays on round cast-iron piers,
// two galleries running round it (first and second floor), the stair in the south-west corner, the timber roof with
// its trusses, the Haida house post ("totem pole") rising at the far end of the court, canoes hung under the roof,
// and the low warm light. Facts: docs/research/museums.md §2.
//
// Interface: buildPittHall(ctx) -> { meshes, dims, lights }
//   ctx = { scene }    dims = PITT (below). Interior frame: entrance (from the Natural History Museum) in the middle
//   of the south wall (+z); the long axis is x; galleries at G1 / G2 round the open court (x ±IX, z ±IZ).
import * as THREE from 'three';
import { Geo, museumMats, envTexture } from './_mus_kit.js';
import { lathe, ball, tube, loft, canvas, canvasTexture, srng, mottle } from './_mus_fine.js';

export const PITT = {
  X: 23, Z: 14, IX: 16.4, IZ: 9.5, G1: 4.5, G2: 9, eaves: 13, ridge: 17.5,
  bays: 7,
  laneA: { x0: -22.6, x1: -20.6, z0: -1, z1: 9 },     // floor 0 -> 1, rising north (from z1)
  laneB: { x0: -20.4, x1: -18.4, z0: -1, z1: 9 },     // floor 1 -> 2, rising south (from z0)
  totem: { x: 0, z: -7.4, h: 11.36 },
};
const BRICK = 0x6a5a42, DARKWOOD = 0x2e2016, IRON = 0x2a2e30, CREAM = 0xbfb294;

/**
 * The house post's painting: six stacked crest figures in black, red and blue-green on cedar — INVENTED shapes in the
 * manner of north-west coast formline (ovoids, U-forms, big eyes), not a copy of the real post. One figure per row;
 * the texture wraps once round the pole with the face at u = 0.5.
 */
function totemCanvas() {
  const W = 256, H = 1024, { canvas: c, g } = canvas(W, H), r = srng(61), n = 6, fh = H / n;
  g.fillStyle = '#7a5236'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${r() < 0.5 ? '40,22,10' : '190,140,90'},${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 2; const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 14, H / 3, x + (r() - 0.5) * 14, 2 * H / 3, x + (r() - 0.5) * 10, H); g.stroke(); }
  const BL = '#17120e', RD = '#9a3524', GR = '#3f6f66', cx = W / 2;
  const ovoid = (x, y, w, h, fill, lw = 5) => { g.beginPath(); g.moveTo(x - w, y + h * 0.5); g.bezierCurveTo(x - w * 1.1, y - h, x + w * 1.1, y - h, x + w, y + h * 0.5); g.bezierCurveTo(x + w * 0.6, y + h * 0.9, x - w * 0.6, y + h * 0.9, x - w, y + h * 0.5); if (fill) { g.fillStyle = fill; g.fill(); } g.strokeStyle = BL; g.lineWidth = lw; g.stroke(); };
  for (let i = 0; i < n; i++) {
    const y0 = i * fh, kind = i % 3;
    g.save(); g.translate(0, y0);
    g.fillStyle = BL; g.fillRect(0, fh - 7, W, 7);
    // brows, eyes
    for (const s of [-1, 1]) {
      g.fillStyle = BL; g.beginPath(); g.moveTo(cx + s * 8, 34); g.quadraticCurveTo(cx + s * 34, 12, cx + s * 62, 30); g.lineTo(cx + s * 60, 42); g.quadraticCurveTo(cx + s * 34, 28, cx + s * 10, 44); g.fill();
      ovoid(cx + s * 34, 62, 24, 20, '#e9dcc0'); ovoid(cx + s * 34, 64, 11, 10, kind === 1 ? GR : BL, 3);
      // cheeks and ears: U-forms
      g.strokeStyle = kind === 2 ? GR : RD; g.lineWidth = 7; g.beginPath(); g.moveTo(cx + s * 70, 30); g.quadraticCurveTo(cx + s * 100, 60, cx + s * 70, 96); g.stroke();
      ovoid(cx + s * 100, 26, 14, 16, kind === 0 ? RD : GR, 4);
    }
    // nose / beak and mouth
    if (kind === 0) { g.fillStyle = RD; g.beginPath(); g.moveTo(cx - 16, 70); g.lineTo(cx + 16, 70); g.lineTo(cx, 118); g.fill(); g.strokeStyle = BL; g.lineWidth = 4; g.stroke(); }
    else { ovoid(cx, 86, 13, 10, BL, 3); }
    g.fillStyle = RD; g.strokeStyle = BL; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 44, 108); g.quadraticCurveTo(cx, 96 + (kind === 2 ? 30 : 16), cx + 44, 108); g.quadraticCurveTo(cx, 138, cx - 44, 108); g.fill(); g.stroke();
    if (kind === 2) { g.fillStyle = '#e9dcc0'; for (let t = -3; t <= 3; t++) g.fillRect(cx + t * 10 - 4, 108, 8, 9); }
    // hands / wings folded below, and the back of the pole plain with split-U ornaments
    for (const s of [-1, 1]) { ovoid(cx + s * 42, 146, 20, 12, kind === 1 ? RD : null, 5); for (let k = 0; k < 3; k++) { g.strokeStyle = BL; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + s * (30 + k * 9), 150); g.lineTo(cx + s * (30 + k * 9), 164); g.stroke(); } }
    g.restore();
  }
  return c;
}
function poolCanvas() {
  const P = 128, { canvas: c, g } = canvas(P, P), gr = g.createRadialGradient(P / 2, P / 2, 2, P / 2, P / 2, P / 2);
  g.fillStyle = '#000'; g.fillRect(0, 0, P, P);
  gr.addColorStop(0, 'rgba(255,200,130,0.9)'); gr.addColorStop(0.4, 'rgba(255,170,90,0.35)'); gr.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, P, P);
  return c;
}
let _pm = null;
function pittMats() {
  if (_pm) return _pm;
  const M = museumMats(), env = envTexture('#1a1410', '#3a2a18', '#0c0806');
  const pc = canvasTexture(poolCanvas());
  _pm = {
    env,
    totem: new THREE.MeshStandardMaterial({ map: canvasTexture(totemCanvas(), { repeat: true }), vertexColors: true, roughness: 0.7, name: 'mus-pitt-totem' }),
    floorDark: Object.assign(M.floorDark.clone(), { roughness: 0.38, envMap: envTexture('#2a1c10', '#c08040', '#080604'), envMapIntensity: 0.5, name: 'mus-pitt-floor' }),
    pool: new THREE.MeshBasicMaterial({ map: pc, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, name: 'mus-pitt-pool' }),
  };
  return _pm;
}

export function buildPittHall(ctx) {
  const sc = ctx.scene, P = PITT, M = museumMats(), PM = pittMats(), G = new Geo();
  sc.fog = new THREE.FogExp2(0x0b0806, 0.016);        // the far galleries sink into the gloom
  const { X, Z, IX, IZ } = P;
  // floor (dark boards) and the walls (painted brick, dim)
  G.color(0xffffff); G.poly('floorDark', [[-X, 0, Z], [X, 0, Z], [X, 0, -Z], [-X, 0, -Z]], [0, 1, 0]);
  G.color(BRICK);
  // (walk-in: ctx.arch = { w, h } is the real doorway from the Natural History Museum's court, left open in the south wall)
  const AR = ctx.arch || null;
  for (const [a, b, n] of [[[-X, Z], [X, Z], [0, -1]], [[X, Z], [X, -Z], [-1, 0]], [[X, -Z], [-X, -Z], [0, 1]], [[-X, -Z], [-X, Z], [1, 0]]]) {
    if (AR && n[1] === -1) {
      const hw = AR.w / 2;
      G.poly('stone', [[-X, 0, Z], [-hw, 0, Z], [-hw, AR.h, Z], [-X, AR.h, Z]], [0, 0, -1]); G.poly('stone', [[hw, 0, Z], [X, 0, Z], [X, AR.h, Z], [hw, AR.h, Z]], [0, 0, -1]);
      G.poly('stone', [[-X, AR.h, Z], [X, AR.h, Z], [X, P.eaves, Z], [-X, P.eaves, Z]], [0, 0, -1]);
      // a dark timber architrave round the opening
      G.color(DARKWOOD); for (const s of [-1, 1]) G.box('wood', s * hw, 0, Z - 0.05, s * (hw + 0.16), AR.h, Z); G.box('wood', -hw - 0.16, AR.h, Z - 0.05, hw + 0.16, AR.h + 0.16, Z); G.color(BRICK);
      continue;
    }
    G.poly('stone', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], P.eaves, b[1]], [a[0], P.eaves, a[1]]], [n[0], 0, n[1]]);
  }
  // gable ends up to the ridge
  for (const [x, n] of [[-X, 1], [X, -1]]) G.poly('stone', [[x, P.eaves, -Z], [x, P.eaves, Z], [x, P.ridge, 0]], [n, 0, 0]);
  // the entrance: a lit doorway in the south wall
  if (!AR) { G.color(0x8a7050); G.poly('glow', [[-1.3, 0, Z - 0.03], [1.3, 0, Z - 0.03], [1.3, 3.0, Z - 0.03], [-1.3, 3.0, Z - 0.03]].map((p) => p), [0, 0, -1]); }
  // gallery slabs (floor 1 open over lane A, floor 2 open over lane B), with fascias and balustrades
  const slabs = (y, hole) => {
    const pieces = [[-X, IZ, X, Z], [-X, -Z, X, -IZ], [IX, -IZ, X, IZ], [-X, -IZ, -IX, IZ]];
    for (const [x0, z0, x1, z1] of pieces) {
      // cut the stair hole out of the west piece
      const parts = x0 === -X && z0 === -IZ && hole ? [[x0, z0, x1, hole.z0], [x0, hole.z0, hole.x0, hole.z1], [hole.x1, hole.z0, x1, hole.z1], [x0, hole.z1, x1, z1]] : [[x0, z0, x1, z1]];
      for (const [a, b, c, d] of parts) {
        if (c - a < 0.05 || d - b < 0.05) continue;
        G.color(0xffffff); G.poly('floorDark', [[a, y, d], [c, y, d], [c, y, b], [a, y, b]], [0, 1, 0]);
        G.color(0x2a2018); G.poly('wood', [[a, y - 0.35, b], [c, y - 0.35, b], [c, y - 0.35, d], [a, y - 0.35, d]], [0, -1, 0]);
      }
    }
    // fascia + iron balustrade round the open court
    G.color(DARKWOOD);
    for (const [a, b, n] of [[[-IX, IZ], [IX, IZ], [0, -1]], [[IX, IZ], [IX, -IZ], [-1, 0]], [[IX, -IZ], [-IX, -IZ], [0, 1]], [[-IX, -IZ], [-IX, IZ], [1, 0]]]) {
      G.poly('wood', [[a[0], y - 0.45, a[1]], [b[0], y - 0.45, b[1]], [b[0], y + 0.05, b[1]], [a[0], y + 0.05, a[1]]], [n[0], 0, n[1]]);
      G.color(IRON);
      G.beam('iron', [a[0], y + 1.0, a[1]], [b[0], y + 1.0, b[1]], 0.06);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.round(L / 0.5);
      for (let i = 0; i <= k; i++) { const t = i / k, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; G.beam('iron', [x, y, z], [x, y + 1.0, z], 0.025); }
      G.color(DARKWOOD);
    }
  };
  slabs(P.G1, P.laneA); slabs(P.G2, P.laneB);
  // round cast-iron piers at the corners of the court and along it, carrying the galleries and the roof
  const piers = [];
  const bayW = (2 * X) / P.bays;
  const px = []; for (let k = 1; k < P.bays; k++) px.push(-X + k * bayW);
  for (const x of px) for (const z of [-IZ, IZ]) piers.push([x, z]);
  for (const x of [-IX, IX]) for (const z of [-IZ, 0, IZ]) piers.push([x, z]);
  for (const [x, z] of piers) {
    G.color(0x34383a);
    lathe(G, 'iron', x, 0, z, [[0.32, 0], [0.32, 0.12], [0.26, 0.18], [0.26, 0.4], [0.2, 0.5], [0.185, P.eaves - 0.6]], 10);
    for (const y of [P.G1 - 0.62, P.G2 - 0.62, P.eaves - 1.0]) { G.color(0x3e4244); lathe(G, 'iron', x, y, z, [[0.19, 0], [0.23, 0.05], [0.21, 0.12], [0.3, 0.3], [0.4, 0.36], [0.4, 0.42]], 10); G.color(0x6a5a34); lathe(G, 'iron', x, y + 0.04, z, [[0.235, 0], [0.235, 0.04]], 10); }
  }
  // pendant lamps over the court (the pools of light), and their glow on the boards below
  const lamps = [[-10, 0], [10, 0], [0, -6], [0, 6], [-10, -6], [10, 6], [-10, 6], [10, -6]], pools = [];
  for (const [x, z] of lamps) {
    G.color(0x18140f); G.beam('iron', [x, 6.75, z], [x, P.eaves - 0.4, z], 0.02);
    lathe(G, 'iron', x, 6.5, z, [[0.34, 0], [0.3, 0.1], [0.1, 0.24], [0.04, 0.3]], 10);
    G.color(0xffd9a0); G.poly('glow', [[x - 0.2, 6.5, z - 0.2], [x + 0.2, 6.5, z - 0.2], [x + 0.2, 6.5, z + 0.2], [x - 0.2, 6.5, z + 0.2]], [0, -1, 0]);
    pools.push(x, z);
  }
  // roof: boarded slopes and trusses at every bay
  G.color(0x3a2a1c);
  G.poly('wood', [[-X, P.eaves, -Z], [X, P.eaves, -Z], [X, P.ridge, 0], [-X, P.ridge, 0]], [0, -1, 1]);
  G.poly('wood', [[X, P.eaves, Z], [-X, P.eaves, Z], [-X, P.ridge, 0], [X, P.ridge, 0]], [0, -1, -1]);
  // a band of roof lights along each slope (the hall is dim, but not black)
  G.color(0x8a8270);
  for (const s of [-1, 1]) G.poly('glow', [[-X + 2, P.eaves + 1.4, s * (Z - 3.6) ], [X - 2, P.eaves + 1.4, s * (Z - 3.6)], [X - 2, P.eaves + 2.3, s * (Z - 5.6)], [-X + 2, P.eaves + 2.3, s * (Z - 5.6)]].map((p) => [p[0], p[1] - 0.04, p[2]]), [0, -1, -s]);
  G.color(IRON);
  for (let k = 0; k <= P.bays; k++) {
    const x = -X + k * bayW;
    G.beam('iron', [x, P.eaves - 0.4, -Z], [x, P.ridge - 0.2, 0], 0.12, 0.25); G.beam('iron', [x, P.eaves - 0.4, Z], [x, P.ridge - 0.2, 0], 0.12, 0.25);
    G.beam('iron', [x, P.eaves - 0.4, -Z], [x, P.eaves - 0.4, Z], 0.1, 0.18);
    G.beam('iron', [x, P.eaves - 0.4, -IZ], [x, P.ridge - 2.2, -1.2], 0.06); G.beam('iron', [x, P.eaves - 0.4, IZ], [x, P.ridge - 2.2, 1.2], 0.06);
  }
  // ---------------------------------------------------------------- stairs (lane A: 0 -> G1 north; lane B: G1 -> G2 south)
  const steps = (L, y0, y1, north) => {
    const n = 26, dz = (L.z1 - L.z0) / n;
    for (let i = 0; i < n; i++) {
      const y = y0 + ((i + 1) / n) * (y1 - y0), z = north ? L.z1 - i * dz : L.z0 + i * dz;
      G.color(i % 2 ? 0x4a3828 : 0x40301f);
      G.box('wood', L.x0, Math.max(y0, y - 0.5), north ? z - dz : z, L.x1, y, north ? z : z + dz);
    }
    G.color(DARKWOOD);
    for (const x of [L.x0, L.x1]) G.beam('wood', [x, y0 + 1.0, north ? L.z1 : L.z0], [x, y1 + 1.0, north ? L.z0 : L.z1], 0.07);
  };
  steps(P.laneA, 0, P.G1, true); steps(P.laneB, P.G1, P.G2, false);
  G.color(DARKWOOD); G.box('wood', -20.55, 0, P.laneA.z0, -20.45, P.G2 + 1, P.laneA.z1);
  // ---------------------------------------------------------------- the Haida house post: carved in the round and painted
  {
    const T = P.totem, n = 6, seg = T.h / n;
    G.color(0xffffff);
    // the pole (the painting wraps once round, faces to the court: +z)
    lathe(G, 'totem', T.x, 0, T.z, [[0.66, 0], [0.64, T.h * 0.5], [0.6, T.h]], 16, { u0: 0.25, u1: 1.25, vs: 1 / T.h, capTop: true });
    for (let i = 0; i < n; i++) {
      const y = T.h - (i + 1) * seg, kind = i % 3;       // row i of the texture, top figure first
      // carved relief over the painting: brow ridge, a beak or a snout, ears, folded arms or wings, knees
      G.color(0x5a3c28);
      tube(G, 'carve', [[T.x - 0.42, y + seg * 0.8, T.z + 0.5], [T.x - 0.2, y + seg * 0.86, T.z + 0.66], [T.x + 0.2, y + seg * 0.86, T.z + 0.66], [T.x + 0.42, y + seg * 0.8, T.z + 0.5]], 0.06, 5);
      if (kind === 0) { G.color(0x8a3222); loft(G, 'carve', [[0.2, 0.0], [0.14, 0.22], [0.02, 0.5]].map(([w, d]) => [[T.x - w, y + seg * 0.62, T.z + 0.6 + d], [T.x, y + seg * 0.68 - d * 0.5, T.z + 0.66 + d], [T.x + w, y + seg * 0.62, T.z + 0.6 + d], [T.x, y + seg * 0.5 - d * 0.5, T.z + 0.6 + d * 0.7]]), { caps: true }); }
      else { G.color(0x5a3c28); ball(G, 'carve', T.x, y + seg * 0.58, T.z + 0.64, 0.17, 0.13, 0.14, 8, 4); }
      for (const sd of [-1, 1]) {
        G.color(kind === 0 ? 0x3f6f66 : 0x8a3222); ball(G, 'carve', T.x + sd * 0.5, y + seg * 0.9, T.z + 0.3, 0.1, 0.16, 0.08, 6, 4);        // ears
        G.color(0x6a4830); tube(G, 'carve', [[T.x + sd * 0.62, y + seg * 0.46, T.z + 0.1], [T.x + sd * 0.6, y + seg * 0.26, T.z + 0.42], [T.x + sd * 0.2, y + seg * 0.2, T.z + 0.68]], (u) => 0.085 - u * 0.02, 6);   // arms folded across
        ball(G, 'carve', T.x + sd * 0.34, y + seg * 0.07, T.z + 0.52, 0.14, 0.1, 0.14, 6, 4);                                   // knees
      }
    }
  }
  // ---------------------------------------------------------------- canoes hung from the roof
  const boat = (x, y, z, L, w, rot, col, kind = 0) => {
    G.at(x, y, z, rot);
    // a hull of ribs: sheer rising to both ends, hollow (outer skin + a darker inside)
    const N = 12, sec = (t, k, lift) => { const u = t * 2 - 1, wd = w * Math.max(0.02, 1 - Math.abs(u) ** 2.4) * k, rise = 0.5 * u * u * u * u + 0.12 * u * u, zz = u * L / 2; return [[-wd / 2, 0.36 + rise + lift, zz], [-wd * 0.42, 0.05 + rise * 0.6 + lift, zz], [0, -0.14 + rise * 0.5 + lift, zz], [wd * 0.42, 0.05 + rise * 0.6 + lift, zz], [wd / 2, 0.36 + rise + lift, zz]]; };
    const out = [], inn = []; for (let i = 0; i <= N; i++) { out.push(sec(i / N, 1, 0)); inn.push(sec(i / N, 0.9, 0.035)); }
    G.color(col); loft(G, 'wood', out, { closed: false, hint: [0, -1, 0], orient: false });
    G.color(new THREE.Color(col).multiplyScalar(0.55).getHex()); loft(G, 'wood', inn, { closed: false, hint: [0, 1, 0], orient: false });
    G.color(new THREE.Color(col).multiplyScalar(0.8).getHex());
    for (const u of [-0.3, -0.1, 0.1, 0.3]) G.box('wood', -w * 0.42, 0.3, u * L - 0.06, w * 0.42, 0.34, u * L + 0.06);       // thwarts
    if (kind === 1) {   // an outrigger canoe: two booms out to a float
      for (const u of [-0.18, 0.18]) tube(G, 'wood', [[0, 0.36, u * L], [w * 1.6, 0.42, u * L], [w * 2.3, 0.1, u * L]], 0.035, 5);
      tube(G, 'wood', [[w * 2.3, 0.05, -L * 0.3], [w * 2.3, 0.0, 0], [w * 2.3, 0.05, L * 0.3]], (t) => 0.05 + 0.05 * Math.sin(t * Math.PI), 6);
    }
    if (kind === 2) { G.color(0xb8a070); for (const s of [-1, 1]) tube(G, 'wood', [[s * w * 0.5, 0.4, -L * 0.1], [s * w * 1.5, 0.3, L * 0.1], [s * w * 1.9, 0.26, L * 0.16]], (t) => 0.02 + 0.07 * t * (1 - t) * 4, 4, { f: 0.2 }); }   // paddles laid across
    G.color(0x1a1a1a); for (const zz of [-L * 0.3, L * 0.3]) { G.beam('iron', [-w * 0.3, 0.3, zz], [0, P.ridge - 1 - y, zz], 0.012); G.beam('iron', [w * 0.3, 0.3, zz], [0, P.ridge - 1 - y, zz], 0.012); }
    G.pop();
  };
  boat(-6, 11.6, 3.5, 9, 1.0, Math.PI / 2, 0x6a4a2c, 1);
  boat(7, 12.2, -2.5, 11, 1.2, Math.PI / 2 + 0.08, 0x5a3a24, 0);
  boat(0, 13.3, 1.0, 6, 0.85, Math.PI / 2 - 0.1, 0x8a6a3c, 2);
  boat(-13, 10.4, -4.5, 5, 0.7, Math.PI / 2 + 0.2, 0x3e3024, 0);
  // a few big things hung on the gallery fronts: shields and long oars, as the real hall crowds every surface
  for (let i = 0; i < 10; i++) {
    const x = -13.5 + i * 3, s = i % 2 ? 1 : -1, z = s * (P.IZ - 0.12), y = (i % 3 === 0 ? P.G2 : P.G1) - 0.2;
    G.color([0x7a3a26, 0x3a3226, 0x8a7a52, 0x2e3a36][i % 4]);
    if (i % 3 === 1) tube(G, 'carve', [[x - 1.6, y + 0.1, z - s * 0.05], [x + 1.2, y + 0.16, z - s * 0.05], [x + 1.7, y + 0.16, z - s * 0.05]], (t) => (t > 0.8 ? 0.1 : 0.028), 5, { f: 0.3, up: [0, 0, 1] });
    else lathe(G, 'carve', x, y - 0.42, z - s * 0.06, [[0.02, 0], [0.3, 0.2], [0.34, 0.6], [0.26, 0.95], [0.02, 1.1]], 8, { sz: 0.16 });
  }

  const meshes = G.build({ ...M, totem: PM.totem, floorDark: PM.floorDark }, sc, { name: 'mus-pitt-hall', cast: false, receive: false });
  // the pools of lamplight on the floor (one additive mesh)
  {
    const pos = [], uv = [], R = 4.6;
    for (let i = 0; i < pools.length; i += 2) { const x = pools[i], z = pools[i + 1]; pos.push(x - R, 0.02, z + R, x + R, 0.02, z + R, x + R, 0.02, z - R, x - R, 0.02, z + R, x + R, 0.02, z - R, x - R, 0.02, z - R); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, PM.pool); m.name = 'mus-pitt-pools'; m.matrixAutoUpdate = false; m.renderOrder = 4; sc.add(m);
  }
  // light: low and warm; the visitors' torches do the rest
  const lights = [];
  for (const [x, z] of [[-10, 0], [10, 0], [0, -6], [0, 6]]) { const l = new THREE.PointLight(0xffb870, 22, 17, 1.5); l.position.set(x, 6.2, z); sc.add(l); lights.push(l); }
  for (const [x, z] of [[-18, 0], [18, 0]]) { const l = new THREE.PointLight(0xffb070, 8, 12, 1.6); l.position.set(x, P.G2 + 2.5, z); sc.add(l); lights.push(l); }
  return { meshes, dims: { ...PITT, piers }, lights, pool: PM.pool };
}
