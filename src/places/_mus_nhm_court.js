// SHOWPIECE: the Natural History Museum court as an interior — the glass-and-iron roof of five aisles on slender
// clustered iron columns (leaf capitals, pointed arcades with wrought-iron foliage in the spandrels, pointed ribs under
// every glazed ridge), the two-storey polychrome arcade round all four sides (each ground-floor shaft a different
// polished British stone, every capital a different plant), the gallery with its balustrade, the outer walls with
// their pointed windows, the entrance hall under the tower and the doorway to the Pitt Rivers; daylight through the
// roof that follows the hour (sun direction, soft shafts, bright patches on the floor).
// Facts: docs/research/museums.md §1.
//
// Interface: buildCourt(ctx) -> { meshes, dims, light }
//   ctx = { scene, game }      meshes are added to ctx.scene (static, one per material)
//   dims = COURT (below): the interior frame — court x/z −C..C, the arcade ring out to ±R, the entrance hall south of
//   +R (z R..R+L, x ±LW), the gallery floor at G1, the stair lane in the west ring, pier positions, iron columns.
//   light.update(hour): moves the sun, the shafts and the floor patches (call when the hour changes; cheap).
// Interior frame: +z = towards the front door (world west), −z = the back of the court (the Pitt Rivers door).
import * as THREE from 'three';
import { Geo, museumMats } from './_mus_kit.js';
import { lathe, tube, pointedArch, canvas, canvasTexture, srng, mottle } from './_mus_fine.js';

export const COURT = {
  C: 17, R: 21.5, G1: 5.6, top: 11.2, L: 4.6, LW: 4,
  bay: 4.25,                          // ground-floor arcade bay (8 per side, 9 piers)
  aisles: [-17, -11.5, -6, 6, 11.5, 17],
  sideEaves: 11.2, sideRidge: 14.2, midEaves: 13.2, midRidge: 18.6,
  colZ: [-12.75, -4.25, 4.25, 12.75],
  stair: { x0: -21.3, x1: -19.3, z0: 4, z1: 15 },   // rises north from z1 (floor 0) to z0 (gallery)
};
// The doorway to the Pitt Rivers, in the middle of the court's north (back) wall: a real opening (walk-in: the Pitt Rivers
// is a room of its own entered through it — core/interiors.js room-to-room portal). 2.6 m wide, 3.0 m to the transom
// under the fixed head of the arch, through a wall 1.4 m deep (GUESS: the passage between the two buildings is longer),
// its two oak leaves folded back against the jambs.
export const PITT_ARCH = { w: 2.6, h: 3.0, depth: 1.4 };
// the stones of the ground-floor shafts (colours after the museum's list: granites, serpentines, limestones, porphyry)
export const SHAFTS = [0x9a9a98, 0xb0544a, 0x8e8e90, 0xc08878, 0x9a8a80, 0xb8604c, 0x6e6a5e, 0x8a7c6a, 0x7a7466, 0x3e6a50, 0x4a7458, 0x5a5650,
  0x786a58, 0x8a8072, 0x4a4a48, 0x9a6a5a, 0x5e5a52, 0x8a4a3e, 0xa0503e, 0x6a6458, 0x2a2a2a, 0xe0d8c8, 0x7e7062, 0x6e6658, 0x7a6e60, 0x8e5e4a, 0x3a6448, 0x887a6a, 0x7a7262, 0x6a6052];

const BUFF = 0xf2e4c2, RED = 0xb4654c, PALE = 0xf4ecd8, CARVE = 0xeadfc6, IRON = 0x4a443c, IRON2 = 0x5c5446, LEAF = 0x5d6a44, GILT = 0xb89a52, GLOW = 0xe6eef2;
const mul = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

// ------------------------------------------------------------------------------------------------ textures
function flagsCanvas() {
  const P = 512, { canvas: c, g } = canvas(P, P), r = srng(31), n = 4, s = P / n;      // 2.4 m tile of 0.6 m flags
  g.fillStyle = '#b7a98f'; g.fillRect(0, 0, P, P);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const d = (r() - 0.5) * 22, warm = r() * 8;
    g.fillStyle = `rgb(${205 + d + warm},${192 + d},${166 + d - warm})`; g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
  }
  mottle(g, 0, 0, P, P, r, 500, 0.05, 22);
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) g.strokeRect(i * s + 3, j * s + 3, s - 6, s - 6);
  return c;
}
/** the glazing seen from below: bright panes between dark bars; tile = 2 m, bars every 0.5 m down the slope */
function skyCanvas() {
  const P = 256, { canvas: c, g } = canvas(P, P), r = srng(37);
  g.fillStyle = '#f4f9ff'; g.fillRect(0, 0, P, P);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { const d = r(); g.fillStyle = `rgba(${d < 0.15 ? '150,170,180' : '215,232,246'},${0.15 + r() * 0.3})`; g.fillRect(i * 64, j * 32, 64, 32); }
  g.fillStyle = '#39413f'; for (let i = 0; i < 4; i++) g.fillRect(i * 64 - 2.5, 0, 5, P);
  g.fillStyle = 'rgba(70,84,88,0.75)'; for (let j = 0; j < 8; j++) g.fillRect(0, j * 32 - 1, P, 2);
  return c;
}
/** wrought iron on a clear ground: a running vine frieze (top half, tiles in u) and two spandrels of branches */
function traceryCanvas() {
  const P = 512, { canvas: c, g } = canvas(P, P), r = srng(43);
  g.clearRect(0, 0, P, P);
  const leaf = (x, y, a, l, w, kind) => {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = '#56633f'; g.strokeStyle = '#c9aa58'; g.lineWidth = 1.6;
    g.beginPath();
    if (kind === 0) { g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, -w, l, 0); g.quadraticCurveTo(l * 0.5, w, 0, 0); }                 // lanceolate
    else if (kind === 1) { g.moveTo(0, 0); for (let i = 1; i <= 4; i++) { const t = i / 4; g.quadraticCurveTo(l * (t - 0.18), -w * (1.3 - t * 0.6), l * t, -w * 0.25 * (1 - t)); } for (let i = 4; i >= 1; i--) { const t = (i - 1) / 4; g.quadraticCurveTo(l * (t + 0.07), w * (1.3 - t * 0.6), l * t, w * 0.25 * (1 - t)); } }   // lobed (oak)
    else { for (let k = -2; k <= 2; k++) { g.moveTo(0, 0); const b = k * 0.42; g.quadraticCurveTo(Math.cos(b) * l * 0.5 - Math.sin(b) * w * 0.3, Math.sin(b) * l * 0.5 + Math.cos(b) * w * 0.3, Math.cos(b) * l, Math.sin(b) * l); g.quadraticCurveTo(Math.cos(b) * l * 0.5 + Math.sin(b) * w * 0.3, Math.sin(b) * l * 0.5 - Math.cos(b) * w * 0.3, 0, 0); } }   // palmate (chestnut)
    g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(l * 0.85, 0); g.stroke();
    g.restore();
  };
  const stem = (pts, w) => { g.strokeStyle = '#3a342c'; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); g.stroke(); g.strokeStyle = 'rgba(200,170,90,0.55)'; g.lineWidth = Math.max(1, w * 0.22); g.stroke(); };
  // ---- frieze: y 0..256 of the canvas (v 0.5..1), a wave of vine with a leaf in every bend, bars top and bottom
  g.fillStyle = '#3a342c'; g.fillRect(0, 6, P, 12); g.fillRect(0, 238, P, 12);
  g.fillStyle = '#c9aa58'; g.fillRect(0, 10, P, 2.5); g.fillRect(0, 243, P, 2.5);
  { const pts = []; for (let i = -1; i <= 9; i++) pts.push([i * 64, 128 + (i % 2 ? 62 : -62)]); stem(pts, 9);
    for (let i = 0; i < 8; i++) { const x = i * 64 + 32, up = i % 2 === 0; leaf(x, 128, up ? 0.9 : -0.9, 74, 22, i % 3); leaf(x, 128, up ? 2.5 : -2.5, 56, 17, (i + 1) % 3); g.fillStyle = '#c9aa58'; g.beginPath(); g.arc(x + 20, 128 + (up ? -72 : 72), 7, 0, 7); g.fill(); g.fillStyle = '#3a342c'; g.fillRect(x - 3, up ? 128 : 18, 6, up ? 110 : 110); } }
  // ---- spandrels: cells at canvas (0..256, 256..512) and (256..512, 256..512); cell-local (0,0) = the springing by
  // the column (bottom left), the trunk climbs the post and the boughs run out under the girder
  for (let k = 0; k < 2; k++) {
    g.save(); g.translate(k * 256, 512); g.scale(1, -1);
    g.fillStyle = '#3a342c'; g.fillRect(0, 0, 9, 256); g.fillRect(0, 244, 256, 12);
    stem([[6, 0], [22, 90], [50, 170], [120, 214], [250, 232]], 11);
    stem([[30, 120], [86, 150], [128, 138], [150, 176]], 7);
    stem([[16, 40], [60, 70], [84, 60], [96, 96]], 6);
    stem([[90, 196], [150, 196], [196, 176], [220, 208]], 6);
    const L = [[40, 150, 0.5, 60], [96, 96, 0.2, 54], [84, 60, -0.4, 50], [150, 176, 0.9, 52], [128, 138, -0.5, 58], [60, 70, 1.3, 46], [120, 214, 1.2, 40], [170, 222, -0.5, 52], [220, 208, 0.3, 40], [196, 176, -0.9, 46], [30, 200, 1.0, 44], [60, 228, 0.1, 40], [22, 90, 0.2, 40], [236, 236, -0.2, 20], [150, 196, -1.3, 34], [12, 20, 0.6, 36]];
    for (const [x, y, a, l] of L) leaf(x, y, a + (r() - 0.5) * 0.3, l, l * 0.3, (k + Math.floor(r() * 2)) % 3);
    g.fillStyle = '#c9aa58'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(30 + r() * 190, 110 + r() * 120, 4.5, 0, 7); g.fill(); }
    g.restore();
  }
  return c;
}
function shaftCanvas() {
  const W = 256, H = 128, { canvas: c, g } = canvas(W, H), r = srng(47);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) { const x = r() * W, w = 3 + r() * 16, a = 0.1 + r() * 0.4, gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - w, 0, w * 2, H); }
  // fade: strong under the roof, gone before the floor; soft at both ends
  const gv = g.createLinearGradient(0, 0, 0, H); gv.addColorStop(0, 'rgba(0,0,0,0.15)'); gv.addColorStop(0.75, 'rgba(0,0,0,0.75)'); gv.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gv; g.fillRect(0, 0, W, H);
  const gh = g.createLinearGradient(0, 0, W, 0); gh.addColorStop(0, 'rgba(0,0,0,1)'); gh.addColorStop(0.12, 'rgba(0,0,0,0)'); gh.addColorStop(0.88, 'rgba(0,0,0,0)'); gh.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gh; g.fillRect(0, 0, W, H);
  return c;
}
function patchCanvas() {
  const P = 128, { canvas: c, g } = canvas(P, P);
  g.fillStyle = '#000'; g.fillRect(0, 0, P, P);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { const gr = g.createRadialGradient(i * 32 + 16, j * 16 + 8, 1, i * 32 + 16, j * 16 + 8, 17); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(i * 32, j * 16, 32, 16); }
  const e = g.createRadialGradient(P / 2, P / 2, P * 0.2, P / 2, P / 2, P * 0.52); e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = e; g.fillRect(0, 0, P, P);
  return c;
}

let _cm = null;
function courtMats() {
  if (_cm) return _cm;
  const M = museumMats(), rep = (c, rx, ry = rx) => { const t = canvasTexture(c, { repeat: true }); t.repeat.set(rx, ry); return t; };
  const tr = canvasTexture(traceryCanvas()); tr.wrapS = THREE.RepeatWrapping;
  M.iron.envMap = M.env; M.iron.envMapIntensity = 0.45;
  _cm = {
    floor: new THREE.MeshStandardMaterial({ map: rep(flagsCanvas(), 1 / 2.4), vertexColors: true, roughness: 0.42, envMap: M.env, envMapIntensity: 0.3, name: 'mus-nhm-flags' }),
    sky: new THREE.MeshBasicMaterial({ map: rep(skyCanvas(), 0.5), side: THREE.DoubleSide, toneMapped: false, name: 'mus-nhm-sky' }),
    tracery: new THREE.MeshStandardMaterial({ map: tr, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.35, envMap: M.env, envMapIntensity: 0.4, name: 'mus-nhm-tracery' }),
    shafts: new THREE.MeshBasicMaterial({ map: canvasTexture(shaftCanvas()), color: 0xfff2d8, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, name: 'mus-nhm-shafts' }),
    patch: new THREE.MeshBasicMaterial({ map: rep(patchCanvas(), 1), color: 0xfff0d0, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, name: 'mus-nhm-patch' }),
  };
  return _cm;
}

// ------------------------------------------------------------------------------------------------ pieces
/** a face polygon in the side frame (x along, y up) at depth z, brick/stone uv locked to the wall */
function face(G, key, pts, z, nz) { G.poly(key, pts.map((p) => [p[0], p[1], z]), [0, 0, nz], pts.map((p) => [p[0] / 1.2, p[1] / 1.2])); }

/**
 * A wall pierced by a run of pointed arches, in the side frame (local x along the run, local z = out of the face into
 * the court, y up): piers at xs[], arches spring at ys, apex at ya, solid wall up to yt; thickness t (back face at -t).
 * Voussoirs alternate red and pale; the spandrels are buff brick. `dim` darkens the back (ring) face.
 */
function arcadeWall(G, xs, ys, ya, yt, t, g, vw, dim = 0.7, n = 7) {
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i] + g, x1 = xs[i + 1] - g, xm = (x0 + x1) / 2;
    const pts = pointedArch(x0, x1, ys, ya, n);
    const out = pts.map((p, k) => {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      if (nx * (p[0] - xm) + ny * (p[1] - ys + 0.5) < 0) { nx = -nx; ny = -ny; }
      return [Math.max(xs[i], Math.min(xs[i + 1], p[0] + nx * vw)), Math.min(yt, p[1] + ny * vw)];
    });
    for (const [z, nz, k0] of [[0, 1, 1], [-t, -1, dim]]) {
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1], c = out[k + 1], d = out[k];
        G.color(mul(k % 2 === 0 ? RED : PALE, k0));
        G.poly('stone', [[a[0], a[1], z + nz * 0.025], [b[0], b[1], z + nz * 0.025], [c[0], c[1], z + nz * 0.025], [d[0], d[1], z + nz * 0.025]], [0, 0, nz]);
        G.color(mul(BUFF, k0));
        face(G, 'brick', [d, c, [c[0], yt], [d[0], yt]], z, nz);
      }
    }
    // soffit (pale, a darker chamfer line down the middle of it)
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], hint = [xm - (a[0] + b[0]) / 2, ys - 1 - (a[1] + b[1]) / 2, 0];
      G.color(k % 2 === 0 ? mul(RED, 0.8) : mul(PALE, 0.86));
      G.poly('stone', [[a[0], a[1], 0.025], [a[0], a[1], -t - 0.025], [b[0], b[1], -t - 0.025], [b[0], b[1], 0.025]], hint);
    }
  }
}

/** a carved capital: a bell with leaves, a different plant by `seed`; base of the bell at y, radius r, height h */
function capital(G, x, y, z, r, h, seed, key = 'carve', col = CARVE, detail = 1) {
  const q = srng(seed * 7 + 3), n = (detail ? 6 : 5) + Math.floor(q() * 4), tiers = detail && q() < 0.5 ? 2 : 1, curl = 0.5 + q() * 0.9, wide = 0.5 + q() * 0.5, R = r + h * 0.42;
  G.color(col);
  lathe(G, key, x, y, z, [[r + 0.02, 0], [r + 0.035, 0.03], [r, 0.06], [r + (R - r) * 0.25, h * 0.45], [R, h * 0.86], [R, h * 0.86], [R + 0.03, h * 0.9], [R + 0.03, h]], detail ? 10 : 6, { shade: (a, i) => (i < 4 ? 0.8 : 1) });
  for (let t = 0; t < tiers; t++) {
    const y0 = y + 0.07 + t * h * 0.34, hh = h * (tiers === 2 ? 0.5 : 0.78), ph = t * Math.PI / n + q() * 3;
    for (let k = 0; k < n; k++) {
      const a = ph + (k / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), rb = r + (R - r) * (t * 0.34), ro = rb + (R - rb) * 0.9 + 0.06;
      const P = (rr, yy) => [x + ca * rr, yy, z + sa * rr];
      // the leaf climbs the bell and curls out and over at its tip
      tube(G, key, [P(rb + 0.015, y0), P(rb + (ro - rb) * 0.35, y0 + hh * 0.5), P(ro, y0 + hh * 0.92), P(ro + 0.05 * curl, y0 + hh * (0.92 - 0.2 * curl))], (u) => 0.012 + r * wide * 0.75 * Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7, 4, { f: 0.28, up: [ca, 0, sa], caps: false, shade: (u) => 0.82 + 0.25 * u });
    }
  }
  if (detail && q() < 0.6) for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * Math.PI * 2; lathe(G, key, x + Math.cos(a) * (R - 0.02), y + h * 0.62, z + Math.sin(a) * (R - 0.02), [[0.001, 0], [0.035, 0.03], [0.001, 0.07]], 5); }   // buds or berries between the leaves
}

/** a polished shaft with moulded base, name block and carved capital at (x, z) from y0 to y1; abacus w wide */
function shaft(G, x, z, y0, y1, r, col, seed, { plinth = 0.42, cap = 0.5, w = 0.62, dim = 1, detail = 1 } = {}) {
  G.color(mul(0xc9bda2, dim)); G.box('stone', x - r - 0.13, y0, z - r - 0.13, x + r + 0.13, y0 + plinth, z + r + 0.13);
  if (detail) { G.color(0x3a3530); G.box('carve', x - 0.12, y0 + plinth * 0.4, z + r + 0.13, x + 0.12, y0 + plinth * 0.75, z + r + 0.14); }   // the stone's name, cut in the block
  G.color(mul(CARVE, 0.92 * dim));
  lathe(G, 'carve', x, y0 + plinth, z, [[r + 0.11, 0], [r + 0.12, 0.04], [r + 0.07, 0.08], [r + 0.05, 0.1], [r + 0.08, 0.14], [r + 0.03, 0.19], [r, 0.2]], detail ? 12 : 8);
  const c = new THREE.Color(col), l = Math.max(c.r, c.g, c.b), k = Math.min(1.9, 0.92 / Math.max(0.2, l));        // the texture carries the figure; lift the tint
  const type = seed % 4;
  G.col = [Math.min(1, c.r * k * 0.5 + c.r * 0.5), Math.min(1, c.g * k * 0.5 + c.g * 0.5), Math.min(1, c.b * k * 0.5 + c.b * 0.5)];
  lathe(G, 'marble', x, y0 + plinth + 0.2, z, [[r, 0], [r, y1 - y0 - plinth - 0.2 - cap]], detail ? 14 : 8, { u0: type / 4 + 0.01, u1: (type + 1) / 4 - 0.01, mirrorU: true, vs: 0.55 });
  capital(G, x, y1 - cap, z, r, cap - 0.1, seed, 'carve', mul(CARVE, dim), detail);
  G.color(mul(PALE, dim)); G.box('stone', x - w / 2, y1 - 0.1, z - w / 2, x + w / 2, y1, z + w / 2);
}

/** a clustered iron column at (x, z): base, four colonnettes round a core, rings, a capital of iron leaves at yc, then a post on to yt */
function ironColumn(G, x, z, yc, yt, seed) {
  G.color(IRON);
  lathe(G, 'iron', x, 0, z, [[0.36, 0], [0.36, 0.1], [0.3, 0.14], [0.3, 0.42], [0.24, 0.5], [0.24, 0.5], [0.2, 0.62], [0.13, 0.7]], 8, { capBot: false });
  lathe(G, 'iron', x, 0.6, z, [[0.105, 0], [0.095, yc - 0.6]], 8);
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) lathe(G, 'iron', x + dx * 0.1, 0.62, z + dz * 0.1, [[0.05, 0], [0.045, yc - 0.7]], 6);
  G.color(IRON2);
  for (const y of [yc * 0.36, yc * 0.68]) lathe(G, 'iron', x, y, z, [[0.16, 0], [0.2, 0.04], [0.2, 0.1], [0.16, 0.14]], 8);
  // capital: a bell with two rings of wrought leaves (palm, oak, chestnut... by seed), gilt at the tips
  capital(G, x, yc - 0.1, z, 0.17, 0.62, seed + 100, 'iron', LEAF, 1);
  G.color(GILT); lathe(G, 'iron', x, yc + 0.5, z, [[0.44, 0], [0.47, 0.03], [0.47, 0.09], [0.3, 0.14]], 8, { capTop: true });
  G.color(IRON); lathe(G, 'iron', x, yc + 0.6, z, [[0.085, 0], [0.085, yt - yc - 0.6]], 6);
}

// (a generator: core/interiors.js builds a room a piece a frame, left at each `yield`)
export function* buildCourt(ctx) {
  const { scene } = ctx, K = COURT, C = K.C, R = K.R, M = museumMats(), CM = courtMats();
  const G = new Geo();
  const UNDER = 0.62;     // light under the gallery, relative to the open court
  yield;
  // ---------------------------------------------------------------- floors and ceilings
  const fl = (x0, z0, x1, z1, k) => { G.color(mul(0xffffff, k)); G.poly('floor', [[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], [0, 1, 0], [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]]); };
  fl(-C, -C, C, C, 1);
  // the ring under the gallery: darker, with a soft edge of light along the arcade
  for (const [x0, z0, x1, z1] of [[-R, C + 1.5, R, R], [-R, -R, R, -C - 1.5], [C + 1.5, -C - 1.5, R, C + 1.5], [-R, -C - 1.5, -C - 1.5, C + 1.5]]) fl(x0, z0, x1, z1, UNDER);
  for (const [x0, z0, x1, z1] of [[-C - 1.5, C, C + 1.5, C + 1.5], [-C - 1.5, -C - 1.5, C + 1.5, -C], [C, -C, C + 1.5, C], [-C - 1.5, -C, -C, C]]) fl(x0, z0, x1, z1, 0.82);
  fl(-K.LW, R, K.LW, R + K.L, 0.55);
  // a border of darker flags round the court floor, and the iron floor grilles of the heating ducts down each aisle
  G.color(0x5a5348);
  for (const x of [-14.25, -8.75, 8.75, 14.25]) G.poly('carve', [[x - 0.3, 0.012, C - 1.2], [x + 0.3, 0.012, C - 1.2], [x + 0.3, 0.012, -C + 1.2], [x - 0.3, 0.012, -C + 1.2]], [0, 1, 0]);
  yield;
  // gallery slab (the ring between C and R) at G1, open over the stair lane; underside = the ground arcade's ceiling
  const S = K.stair;
  const ring = [
    [-R, C, R, R], [-R, -R, R, -C],                 // south and north strips (x0, z0, x1, z1)
    [C, -C, R, C],                                  // east
    [-R, -C, -C, S.z0], [-C - 0.0 - 2.2, S.z0, -C, S.z1], [-R, S.z1, -C, C],   // west, minus the stair lane (x -21.3..-19.3)
  ];
  const slab = (x0, z0, x1, z1) => {
    G.color(0xffffff); G.poly('floorPale', [[x0, K.G1, z1], [x1, K.G1, z1], [x1, K.G1, z0], [x0, K.G1, z0]], [0, 1, 0]);
    G.color(mul(0xd8ccb2, 0.6)); G.poly('stone', [[x0, K.G1 - 0.3, z0], [x1, K.G1 - 0.3, z0], [x1, K.G1 - 0.3, z1], [x0, K.G1 - 0.3, z1]], [0, -1, 0]);
  };
  for (const r of ring) slab(...r);
  // the joists of the gallery floor seen from below, one over every pier
  G.color(mul(0x8a7458, 0.55));
  for (let i = 0; i <= 8; i++) { const v = -C + i * K.bay; for (const s of [-1, 1]) { G.box('carve', v - 0.12, K.G1 - 0.55, s > 0 ? C : -R, v + 0.12, K.G1 - 0.3, s > 0 ? R : -C); if (!(s < 0 && v > S.z0 - 0.3 && v < S.z1 + 0.3)) G.box('carve', s > 0 ? C : -R, K.G1 - 0.55, v - 0.12, s > 0 ? R : -C, K.G1 - 0.3, v + 0.12); } }
  // stair: stone steps in the west ring rising north, its side wall
  {
    const n = 30, dz = (S.z1 - S.z0) / n;
    for (let i = 0; i < n; i++) { const y = ((i + 1) / n) * K.G1, z1 = S.z1 - i * dz; G.color(i % 2 ? 0xd8ccb0 : 0xcfc2a4); G.box('stone', S.x0, Math.max(0, y - 0.6), z1 - dz, S.x1, y, z1); }
    G.color(mul(BUFF, 0.8)); G.box('brick', S.x1, 0, S.z0, S.x1 + 0.2, K.G1 + 1.0, S.z1);
    G.color(0x5a3c22); tube(G, 'carve', [[S.x1 - 0.06, 1.0, S.z1], [S.x1 - 0.06, K.G1 + 1.0, S.z0]], 0.045, 6);
    G.color(IRON); for (let i = 0; i <= 6; i++) { const t = i / 6; G.beam('iron', [S.x1 - 0.06, t * K.G1, S.z1 + (S.z0 - S.z1) * t], [S.x1 - 0.06, t * K.G1 + 1.0, S.z1 + (S.z0 - S.z1) * t], 0.03); }
  }
  // upper ceiling of the ring: boarded, on beams
  G.color(0xcdbf9f);
  for (const [x0, z0, x1, z1] of [[-R, C, R, R], [-R, -R, R, -C], [C, -C, R, C], [-R, -C, -C, C]]) G.poly('stone', [[x0, K.top, z0], [x1, K.top, z0], [x1, K.top, z1], [x0, K.top, z1]], [0, -1, 0]);
  G.color(0x7a6448);
  for (let i = 0; i <= 16; i++) { const v = -C + i * K.bay / 2; for (const s of [-1, 1]) { G.box('carve', v - 0.07, K.top - 0.22, s > 0 ? C : -R, v + 0.07, K.top, s > 0 ? R : -C); G.box('carve', s > 0 ? C : -R, K.top - 0.22, v - 0.07, s > 0 ? R : -C, K.top, v + 0.07); } }
  yield;
  // ---------------------------------------------------------------- outer walls with pointed windows (lit glass)
  // (gap = { s0, s1, h }: a real doorway left open in the run, from s0 to s1 along it, floor to h)
  const wallRun = (ax, az, bx, bz, nx, nz, skip = null, gap = null) => {
    const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, n = Math.round(L / K.bay);
    const P = (s, y, o = 0) => [ax + ux * s + nx * o, y, az + uz * s + nz * o];
    const piece = (key, sa, sb, ya, yb, o) => { if (sb - sa > 1e-4 && yb - ya > 1e-4) G.poly(key, [P(sa, ya, o), P(sb, ya, o), P(sb, yb, o), P(sa, yb, o)], [nx, 0, nz], [[sa / 1.2, ya / 1.2], [sb / 1.2, ya / 1.2], [sb / 1.2, yb / 1.2], [sa / 1.2, yb / 1.2]]); };
    const strip = (y0, y1, key, col, o = 0) => {
      G.color(col);
      if (gap && y0 < gap.h) { const yt = Math.min(y1, gap.h); piece(key, 0, gap.s0, y0, yt, o); piece(key, gap.s1, L, y0, yt, o); piece(key, 0, L, yt, y1, o); } else piece(key, 0, L, y0, y1, o);
    };
    strip(0, 0.9, 'stone', mul(0xc9bda2, UNDER + 0.1));
    strip(0.9, K.G1 - 0.3, 'brick', mul(BUFF, UNDER + 0.1)); strip(K.G1 - 0.3, K.top, 'brick', mul(BUFF, 0.9));
    for (const [y, h, lit] of [[0.9, 0.14, 0], [2.3, 0.1, 0], [4.55, 0.1, 0], [K.G1 - 0.3, 0.36, 1], [7.3, 0.12, 1], [10.2, 0.12, 1], [K.top - 0.3, 0.3, 1]]) strip(y, y + h, 'stone', mul(RED, lit ? 0.92 : UNDER + 0.12), 0.012);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * (L / n), c = P(t, 0); if (skip && skip(c[0], c[2])) continue;
      for (const [y0, y1, w, lit] of [[1.5, 3.5, 1.3, 0], [7.0, 9.3, 1.1, 1]]) {
        const a = pointedArch(-w / 2, w / 2, y1, y1 + w * 0.95, 4), pts = [[-w / 2, y0], [w / 2, y0], ...a.slice().reverse()];
        // glass: brighter toward the head, the leading and a quatrefoil plate in the head in stone
        G.color(mul(GLOW, lit ? 1 : 0.95)); G.poly('glow', pts.map((p) => P(t + p[0], p[1], 0.035)), [nx, 0, nz]);
        G.color(mul(CARVE, lit ? 0.75 : 0.5));
        G.poly('carve', [P(t - 0.05, y0, 0.05), P(t + 0.05, y0, 0.05), P(t + 0.05, y1 + 0.1, 0.05), P(t - 0.05, y1 + 0.1, 0.05)], [nx, 0, nz]);
        for (let k = 0; k < 6; k++) { const an = (k / 6) * Math.PI * 2, bn = ((k + 1) / 6) * Math.PI * 2, cy = y1 + w * 0.36, r0 = w * 0.17, r1 = w * 0.25; G.poly('carve', [P(t + Math.cos(an) * r0, cy + Math.sin(an) * r0, 0.05), P(t + Math.cos(bn) * r0, cy + Math.sin(bn) * r0, 0.05), P(t + Math.cos(bn) * r1, cy + Math.sin(bn) * r1, 0.05), P(t + Math.cos(an) * r1, cy + Math.sin(an) * r1, 0.05)], [nx, 0, nz]); }
        // the surround: banded voussoirs round the head, plain jambs, a sloping sill
        const o2 = a.map((p) => { const dx = p[0], dy = p[1] - y1 + 0.3, l = Math.hypot(dx, dy) || 1; return [p[0] + (dx / l) * 0.2, p[1] + (dy / l) * 0.2]; });
        for (let k = 0; k < a.length - 1; k++) { G.color(mul(k % 2 ? PALE : RED, lit ? 0.95 : UNDER + 0.12)); G.poly('stone', [P(t + a[k][0], a[k][1], 0.03), P(t + a[k + 1][0], a[k + 1][1], 0.03), P(t + o2[k + 1][0], o2[k + 1][1], 0.03), P(t + o2[k][0], o2[k][1], 0.03)], [nx, 0, nz]); }
        G.color(mul(PALE, lit ? 0.95 : UNDER + 0.12));
        for (const s of [-1, 1]) G.poly('stone', [P(t + s * w / 2, y0, 0.03), P(t + s * (w / 2 + 0.2), y0, 0.03), P(t + s * (w / 2 + 0.2), y1, 0.03), P(t + s * w / 2, y1, 0.03)], [nx, 0, nz]);
        G.poly('stone', [P(t - w / 2 - 0.3, y0 - 0.16, 0.06), P(t + w / 2 + 0.3, y0 - 0.16, 0.06), P(t + w / 2 + 0.3, y0, 0.03), P(t - w / 2 - 0.3, y0, 0.03)], [nx, 0.4, nz]);
      }
    }
  };
  const PW = ctx.pitt ? { x0: -PITT_ARCH.w / 2, x1: PITT_ARCH.w / 2, h: PITT_ARCH.h, depth: PITT_ARCH.depth } : null;
  wallRun(-R, -R, R, -R, 0, 1, (x) => Math.abs(x) < 2.2, PW && { s0: R + PW.x0, s1: R + PW.x1, h: PW.h });         // north (Pitt Rivers door in the middle)
  wallRun(R, -R, R, R, -1, 0);                                     // east
  wallRun(-R, R, -R, -R, 1, 0);                                    // west
  wallRun(R, R, K.LW, R, 0, -1); wallRun(-K.LW, R, -R, R, 0, -1);  // south either side of the entrance hall
  yield;
  // entrance hall under the tower
  G.color(mul(BUFF, 0.62));
  G.poly('brick', [[-K.LW, 0, R], [-K.LW, 0, R + K.L], [-K.LW, K.G1, R + K.L], [-K.LW, K.G1, R]], [1, 0, 0]);
  G.poly('brick', [[K.LW, 0, R + K.L], [K.LW, 0, R], [K.LW, K.G1, R], [K.LW, K.G1, R + K.L]], [-1, 0, 0]);
  // (walk-in: ctx.walkin = { x0, x1, h, depth } is the real doorway in this wall — the active leaf's opening, left open
  //  here and lined through the wall's thickness out to the front; the other leaf of the pair is drawn shut)
  const WK = ctx.walkin || null, ZD = R + K.L;
  if (WK) {
    G.poly('brick', [[WK.x0, 0, ZD], [-K.LW, 0, ZD], [-K.LW, K.G1, ZD], [WK.x0, K.G1, ZD]], [0, 0, -1]);
    G.poly('brick', [[K.LW, 0, ZD], [WK.x1, 0, ZD], [WK.x1, K.G1, ZD], [K.LW, K.G1, ZD]], [0, 0, -1]);
    G.poly('brick', [[WK.x1, WK.h, ZD], [WK.x0, WK.h, ZD], [WK.x0, K.G1, ZD], [WK.x1, K.G1, ZD]], [0, 0, -1]);
    const Z1 = ZD + WK.depth + 0.02;
    G.color(mul(PALE, 0.7));
    G.poly('stone', [[WK.x0, 0, ZD], [WK.x0, 0, Z1], [WK.x0, WK.h, Z1], [WK.x0, WK.h, ZD]], [1, 0, 0]);
    G.poly('stone', [[WK.x1, 0, Z1], [WK.x1, 0, ZD], [WK.x1, WK.h, ZD], [WK.x1, WK.h, Z1]], [-1, 0, 0]);
    G.poly('stone', [[WK.x0, WK.h, Z1], [WK.x1, WK.h, Z1], [WK.x1, WK.h, ZD], [WK.x0, WK.h, ZD]], [0, -1, 0]);
    G.color(mul(0xffffff, 0.5)); G.poly('stone', [[WK.x0, 0.002, Z1], [WK.x1, 0.002, Z1], [WK.x1, 0.002, ZD], [WK.x0, 0.002, ZD]], [0, 1, 0]);
    G.color(mul(BUFF, 0.62));
  } else
  G.poly('brick', [[K.LW, 0, R + K.L], [-K.LW, 0, R + K.L], [-K.LW, K.G1, R + K.L], [K.LW, K.G1, R + K.L]], [0, 0, -1]);
  G.color(mul(0xd8ccb0, 0.6)); G.poly('stone', [[-K.LW, K.G1, R], [K.LW, K.G1, R], [K.LW, K.G1, R + K.L], [-K.LW, K.G1, R + K.L]], [0, -1, 0]);
  yield;
  // the doors: pointed, moulded surrounds in banded stone, oak leaves with iron straps
  const door = (z, nz, w, hs, ha, col, dim, open = null) => {
    const a = pointedArch(-w, w, hs, ha, 6), o2 = a.map((p) => { const dx = p[0], dy = p[1] - hs + 0.6, l = Math.hypot(dx, dy) || 1; return [p[0] + (dx / l) * 0.42, p[1] + (dy / l) * 0.42]; });
    const zz = z + nz * 0.04;
    if (open) {
      // the head of the arch (fixed), a transom at the springing, and the leaf that is not the doorway, shut
      G.color(col); G.poly('carve', [[-w, hs, zz], [w, hs, zz], ...a.slice().reverse().map((p) => [p[0], p[1], zz])], [0, 0, nz]);
      for (const [xa, xb] of [[-w, open.x0], [open.x1, w]]) if (xb - xa > 0.02) G.poly('carve', nz < 0 ? [[xb, 0, zz], [xa, 0, zz], [xa, hs, zz], [xb, hs, zz]] : [[xa, 0, zz], [xb, 0, zz], [xb, hs, zz], [xa, hs, zz]], [0, 0, nz]);
      G.color(0x1a1410); G.box('carve', -w, hs - 0.06, zz, w, hs + 0.06, zz + nz * 0.03);
    } else {
    G.color(col); G.poly('carve', [[-w, 0, zz], [w, 0, zz], ...a.slice().reverse().map((p) => [p[0], p[1], zz])], [0, 0, nz]);
    }
    for (let k = 0; k < a.length - 1; k++) { G.color(mul(k % 2 ? PALE : RED, dim)); G.poly('stone', [[a[k][0], a[k][1], zz + nz * 0.03], [a[k + 1][0], a[k + 1][1], zz + nz * 0.03], [o2[k + 1][0], o2[k + 1][1], zz + nz * 0.03], [o2[k][0], o2[k][1], zz + nz * 0.03]], [0, 0, nz]); }
    G.color(mul(PALE, dim)); for (const s of [-1, 1]) G.box('stone', s * w, 0, zz, s * (w + 0.42), hs, zz + nz * 0.06);
    G.color(0x1a1410); if (!open) G.box('carve', -0.03, 0, zz, 0.03, ha - 0.1, zz + nz * 0.03); else G.box('carve', -0.03, hs, zz, 0.03, ha - 0.1, zz + nz * 0.03);
    G.color(0x2a2c2e); for (const y of [0.7, 1.9, 3.1]) for (const s of [-1, 1]) { if (open && s * 0.5 * w > open.x0 && s * 0.5 * w < open.x1) continue; G.box('iron', s * 0.15, y, zz, s * (w - 0.15), y + 0.07, zz + nz * 0.035); }
  };
  door(R + K.L, -1, 1.45, 3.4, 5.1, 0x3a2818, 0.7, WK);
  // the wall above the hall's opening into the ring (up to the gallery)
  G.color(mul(BUFF, 0.9)); G.poly('brick', [[-K.LW, 4.4, R], [K.LW, 4.4, R], [K.LW, K.top, R], [-K.LW, K.top, R]], [0, 0, -1]);
  door(-R, 1, 1.5, 3.0, 4.6, 0x241810, 0.72, PW);                // the Pitt Rivers doorway (north wall, centre)
  if (PW) {
    // the way through the wall: stone jambs and soffit, flags underfoot, and the two leaves folded back against the jambs
    const Z0 = -R - PW.depth - 0.02, Z1 = -R;
    G.color(mul(PALE, 0.5));
    G.poly('stone', [[PW.x0, 0, Z0], [PW.x0, 0, Z1], [PW.x0, PW.h, Z1], [PW.x0, PW.h, Z0]], [1, 0, 0]);
    G.poly('stone', [[PW.x1, 0, Z0], [PW.x1, 0, Z1], [PW.x1, PW.h, Z1], [PW.x1, PW.h, Z0]], [-1, 0, 0]);
    G.color(mul(PALE, 0.4)); G.poly('stone', [[PW.x0, PW.h, Z0], [PW.x1, PW.h, Z0], [PW.x1, PW.h, Z1], [PW.x0, PW.h, Z1]], [0, -1, 0]);
    G.color(mul(0xffffff, 0.45)); G.poly('floor', [[PW.x0, 0.002, Z1], [PW.x1, 0.002, Z1], [PW.x1, 0.002, Z0], [PW.x0, 0.002, Z0]], [0, 1, 0]);
    for (const s of [-1, 1]) {
      const x = s * (PW.w ?? (PW.x1 - PW.x0)) / 2;
      G.color(0x241810); G.box('carve', Math.min(x, x - s * 0.06), 0, Z1 - 1.34, Math.max(x, x - s * 0.06), PW.h - 0.04, Z1 - 0.04);
      G.color(0x2a2c2e); for (const y of [0.7, 1.9]) G.box('iron', Math.min(x - s * 0.06, x - s * 0.075), y, Z1 - 1.24, Math.max(x - s * 0.06, x - s * 0.075), y + 0.07, Z1 - 0.14);
    }
  }
  yield;
  // ---------------------------------------------------------------- the two-storey arcade round the court
  const xs = []; for (let i = 0; i <= 8; i++) xs.push(-C + i * K.bay);
  const xs2 = []; for (let i = 0; i <= 16; i++) xs2.push(-C + i * K.bay / 2);
  const piers = [];
  const sides = [[0, C, Math.PI], [0, -C, 0], [C, 0, -Math.PI / 2], [-C, 0, Math.PI / 2]];   // centre, heading of the face into the court
  const YS = 3.3, UP = K.G1 + 1.0;
  let si = 0;
  for (const [cx, cz, h] of sides) {
    G.at(cx, 0, cz, h);                              // local +z = into the court, local x along the side
    arcadeWall(G, xs, YS, 5.02, K.G1 - 0.3, 0.5, 0.25, 0.3, 0.6);
    yield;
    // the string at the gallery floor: a red band, a carved pale band of leaves (bosses), the slab edge
    G.color(RED); G.box('stone', -C, K.G1 - 0.3, -0.5, C, K.G1 - 0.16, 0.04, { top: false });
    G.color(PALE); G.box('stone', -C, K.G1 - 0.16, -0.5, C, K.G1, 0.07, { top: false });
    G.color(mul(CARVE, 0.8)); for (let x = -C + 0.35; x < C; x += 0.71) G.box('carve', x - 0.11, K.G1 - 0.14, 0.07, x + 0.11, K.G1 - 0.03, 0.1);
    yield;
    G.push(new THREE.Matrix4().makeTranslation(0, UP, 0));
    arcadeWall(G, xs2, 2.8, 4.0, K.top - UP, 0.4, 0.15, 0.2, 0.8, 5);
    G.pop();
    // cornice under the roof: corbel table
    G.color(PALE); G.box('stone', -C, K.top - 0.12, -0.4, C, K.top + 0.3, 0.1);
    G.color(mul(CARVE, 0.85)); for (let x = -C + 0.3; x < C; x += 0.6) G.box('carve', x - 0.1, K.top - 0.34, 0, x + 0.1, K.top - 0.12, 0.09);
    yield;
    // gallery balustrade: pedestals under the upper shafts, colonnettes between, a moulded rail
    G.color(PALE); G.box('stone', -C, K.G1, -0.36, C, K.G1 + 0.16, 0.02);
    G.box('stone', -C, K.G1 + 0.86, -0.36, C, UP, 0.02);
    G.color(RED); G.box('stone', -C, K.G1 + 0.8, -0.38, C, K.G1 + 0.86, 0.04, { top: false });
    for (let i = 0; i <= 16; i++) { G.color(mul(PALE, 0.97)); G.box('stone', xs2[i] - 0.2, K.G1 + 0.16, -0.34, xs2[i] + 0.2, K.G1 + 0.8, 0.0, { top: false }); }
    G.color(mul(CARVE, 0.96));
    for (let i = 0; i < 16; i++) for (let k = 1; k <= 3; k++) lathe(G, 'carve', xs2[i] + (k / 4) * (K.bay / 2), K.G1 + 0.16, -0.17, [[0.085, 0], [0.05, 0.12], [0.065, 0.36], [0.085, 0.64]], 5);
    yield;
    // ground-floor shafts: a different stone each, a different plant on each capital
    for (let i = 0; i <= 8; i++) shaft(G, xs[i], -0.25, 0, YS, 0.2, SHAFTS[(si * 8 + i) % SHAFTS.length], si * 9 + i, { w: 0.66 });
    yield;
    // upper shafts: stouter over the piers, slender between
    for (let i = 0; i <= 16; i++) shaft(G, xs2[i], -0.2, UP, UP + 2.8, i % 2 ? 0.085 : 0.115, i % 2 ? 0x8a4a3e : 0x6e7468, 40 + si * 17 + i, { plinth: 0.14, cap: 0.34, w: 0.4, detail: 0 });
    G.pop();
    yield;
    for (let i = 0; i <= 8; i++) {
      const lx = xs[i], c = Math.cos(h), s = Math.sin(h);
      piers.push({ x: cx + lx * c - 0.25 * s, z: cz - lx * s - 0.25 * c, side: si, i, h });
    }
    si++;
  }
  yield;
  // ---------------------------------------------------------------- the iron and glass roof
  const A = K.aisles, zs = [-C, ...K.colZ, C];
  const skyQ = (pts, hint, uv) => { G.color(0xffffff); G.poly('sky', pts, hint, uv); };
  for (let a = 0; a < 5; a++) {
    const x0 = A[a], x1 = A[a + 1], xm = (x0 + x1) / 2, mid = a === 2, hw = (x1 - x0) / 2;
    const e = mid ? K.midEaves : K.sideEaves, r = mid ? K.midRidge : K.sideRidge, sl = Math.hypot(hw, r - e);
    skyQ([[x0, e, -C], [xm, r, -C], [xm, r, C], [x0, e, C]], [1, -1, 0], [[0, 0], [0, sl / 2], [C, sl / 2], [C, 0]]);
    skyQ([[x1, e, C], [xm, r, C], [xm, r, -C], [x1, e, -C]], [-1, -1, 0], [[C, 0], [C, sl / 2], [0, sl / 2], [0, 0]]);
    for (const z of [-C, C]) skyQ([[x0, e, z], [x1, e, z], [xm, r, z]], [0, 0, -z], [[x0 / 2, e / 2], [x1 / 2, e / 2], [xm / 2, r / 2]]);
    // a pointed iron rib at every column row, springing from the posts; the rafters above it; a vine frieze between
    const ys = mid ? 12.0 : 10.0, ya = r - 0.55, raf = (x) => e - 0.12 + (r - e) * (1 - Math.abs(x - xm) / hw);
    for (let k = 0; k < zs.length; k++) {
      const z = zs[k] + (k === 0 ? 0.12 : k === zs.length - 1 ? -0.12 : 0), arc = pointedArch(x0 + 0.12, x1 - 0.12, ys, ya, 8);
      G.color(IRON); tube(G, 'iron', arc.map((p) => [p[0], p[1], z]), 0.1, 4, { up: [0, 0, 1], f: 0.5, phase: Math.PI / 4, caps: false });
      G.color(IRON2); G.beam('iron', [x0, e - 0.12, z], [xm, r - 0.12, z], 0.08, 0.14); G.beam('iron', [x1, e - 0.12, z], [xm, r - 0.12, z], 0.08, 0.14);
      let len = 0; G.color(0xffffff);
      for (let j = 0; j < arc.length - 1; j++) {
        const p = arc[j], q = arc[j + 1], l2 = len + Math.hypot(q[0] - p[0], q[1] - p[1]);
        G.tri('tracery', [p[0], p[1], z], [q[0], q[1], z], [q[0], raf(q[0]), z], [len / 3, 0.52], [l2 / 3, 0.52], [l2 / 3, 0.98]);
        G.tri('tracery', [p[0], p[1], z], [q[0], raf(q[0]), z], [p[0], raf(p[0]), z], [len / 3, 0.52], [l2 / 3, 0.98], [len / 3, 0.98]);
        len = l2;
      }
      // a tie rod and king rod in the big central roof
      if (mid) { G.color(IRON); G.beam('iron', [x0 + 0.15, ys + 0.1, z], [x1 - 0.15, ys + 0.1, z], 0.035); G.beam('iron', [xm, ys + 0.1, z], [xm, ya, z], 0.035); }
    }
    // ridge and purlins (stencilled girders: gilt dashes along the dark iron)
    G.color(IRON); G.beam('iron', [xm, r - 0.14, -C], [xm, r - 0.14, C], 0.14, 0.2);
    for (const f of [0.33, 0.66]) for (const s of [-1, 1]) { const px = xm + s * hw * (1 - f), py = e + (r - e) * f - 0.1; G.color(IRON2); G.beam('iron', [px, py, -C], [px, py, C], 0.07, 0.1); }
  }
  yield;
  // the clerestory under the central roof: glazed between iron mullions over a stencilled girder
  for (const x of [-6, 6]) {
    const nx = x < 0 ? 1 : -1;
    skyQ([[x, K.sideEaves + 0.25, -C], [x, K.sideEaves + 0.25, C], [x, K.midEaves, C], [x, K.midEaves, -C]], [nx, 0, 0], [[0, 0], [C, 0], [C, 1], [0, 1]]);
    G.color(IRON); G.box('iron', x - 0.09, K.sideEaves - 0.12, -C, x + 0.09, K.sideEaves + 0.26, C); G.box('iron', x - 0.07, K.midEaves - 0.1, -C, x + 0.07, K.midEaves + 0.08, C);
    G.color(GILT); for (let z = -C + 0.5; z < C; z += 1.0) G.box('iron', x - 0.1, K.sideEaves + 0.02, z - 0.16, x + 0.1, K.sideEaves + 0.12, z + 0.16);
  }
  for (const x of [-11.5, 11.5]) { G.color(IRON); G.box('iron', x - 0.08, K.sideEaves - 0.3, -C, x + 0.08, K.sideEaves - 0.04, C); G.color(GILT); for (let z = -C + 0.5; z < C; z += 1.0) G.box('iron', x - 0.09, K.sideEaves - 0.22, z - 0.16, x + 0.09, K.sideEaves - 0.12, z + 0.16); }
  yield;
  // the columns, and the pointed arcades between them along the aisles with foliage in every spandrel
  const cols = [];
  for (const x of [-11.5, -6, 6, 11.5]) {
    const in6 = Math.abs(x) === 6, yc = in6 ? 6.9 : 6.5, yg = in6 ? K.sideEaves - 0.12 : K.sideEaves - 0.3, ya = yg - 0.35;
    for (const z of K.colZ) {
      ironColumn(G, x, z, yc, in6 ? 12.05 : yg, cols.length);
      if (in6) { G.color(GILT); lathe(G, 'iron', x, 11.9, z, [[0.09, 0], [0.2, 0.12], [0.2, 0.18]], 6, { capTop: true }); }
      cols.push([x, z]);
    }
    for (let k = 0; k < zs.length - 1; k++) {
      const z0 = zs[k], z1 = zs[k + 1], hw = (z1 - z0) / 2, zm = (z0 + z1) / 2;
      const arc = pointedArch(z0 + 0.1, z1 - 0.1, yc + 0.55, ya, 8);
      G.color(IRON); tube(G, 'iron', arc.map((p) => [x, p[1], p[0]]), 0.085, 4, { up: [1, 0, 0], f: 0.55, phase: Math.PI / 4, caps: false });
      if (k === 0 || k === zs.length - 2) { const zw = k === 0 ? z0 + 0.1 : z1 - 0.1; G.beam('iron', [x, yc + 0.55, zw], [x, yg, zw], 0.1); G.color(GILT); G.box('iron', x - 0.14, yc + 0.35, zw - 0.14, x + 0.14, yc + 0.55, zw + 0.14); G.color(IRON); G.box('iron', x - 0.1, yc - 0.2, zw - 0.1, x + 0.1, yc + 0.35, zw + 0.1); }
      G.color(0xffffff);
      const cell = (cols.length + k) % 2 * 0.5, H = yg - (yc + 0.55);
      for (let j = 0; j < arc.length - 1; j++) {
        const p = arc[j], q = arc[j + 1];
        const uv = (zz, y) => [cell + 0.004 + 0.492 * Math.min(1, (hw - Math.abs(zz - zm)) / hw), 0.004 + 0.492 * Math.min(1, (y - (yc + 0.55)) / H)];
        G.tri('tracery', [x, p[1], p[0]], [x, q[1], q[0]], [x, yg, q[0]], uv(p[0], p[1]), uv(q[0], q[1]), uv(q[0], yg));
        G.tri('tracery', [x, p[1], p[0]], [x, yg, q[0]], [x, yg, p[0]], uv(p[0], p[1]), uv(q[0], yg), uv(p[0], yg));
      }
    }
    yield;
  }
  yield;
  const meshes = G.build({ ...M, ...CM }, scene, { name: 'mus-nhm-court', cast: false, receive: false });
  for (const m of Object.values(meshes)) { m.matrixAutoUpdate = false; m.updateMatrix(); }

  yield;
  // ---------------------------------------------------------------- daylight: sun, sky fill, shafts and floor patches
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.5); scene.add(sun); scene.add(sun.target);
  const fill = new THREE.HemisphereLight(0xdfeaff, 0x9a8462, 0.6); scene.add(fill);
  const H = 13.2;
  const sheets = new THREE.Mesh(new THREE.BufferGeometry(), CM.shafts), patches = new THREE.Mesh(new THREE.BufferGeometry(), CM.patch);
  {
    const pos = [], uv = [];
    const sheet = (ax, az, bx, bz) => { pos.push(ax, 0, az, bx, 0, bz, bx, H, bz, ax, 0, az, bx, H, bz, ax, H, az); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
    for (const x of [-14.25, -8.75, -2.5, 2.5, 8.75, 14.25]) sheet(x, -15, x, 15);
    for (const z of [-9, 0, 9]) sheet(-15.5, z, 15.5, z);
    sheets.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sheets.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const pp = [], pu = [];
    for (let a = 0; a < 5; a++) { const x0 = A[a] + 0.6, x1 = A[a + 1] - 0.6, w = x1 - x0; pp.push(x0, 0, 15, x1, 0, 15, x1, 0, -15, x0, 0, 15, x1, 0, -15, x0, 0, -15); const ur = w / 4.2, vr = 3; pu.push(0, 0, ur, 0, ur, vr, 0, 0, ur, vr, 0, vr); }
    patches.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); patches.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2));
  }
  for (const m of [sheets, patches]) { m.frustumCulled = false; m.matrixAutoUpdate = false; m.renderOrder = 5; scene.add(m); }
  sheets.name = 'mus-nhm-shafts'; patches.name = 'mus-nhm-patches';
  const cA = new THREE.Color(0xfff4e2), cB = new THREE.Color(0xffc890), cT = new THREE.Color(), skyA = new THREE.Color(0xffffff), skyB = new THREE.Color(0xffe6c8);
  const light = {
    sun, fill, hour: -1, k: 1,
    /** the sun runs from the back of the court in the morning (east) over the south side to the front in the afternoon */
    update(hour, k = 1) {      // (k: the house lights, 1 = up … lower as the museum closes)
      if (Math.abs(hour - light.hour) < 0.02 && k === light.k) return; light.hour = hour; light.k = k;
      const az = Math.max(-1.25, Math.min(1.25, ((hour - 12.5) / 6) * 1.6)), el = 0.5 + 0.42 * Math.cos(az);
      const dx = Math.cos(el) * Math.cos(az), dy = Math.sin(el), dz = Math.cos(el) * Math.sin(az);     // towards the sun (+x taken as south: GUESS)
      const low = Math.min(1, Math.abs(az) / 1.25) ** 2;
      sun.position.set(dx * 40, dy * 40, dz * 40); sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
      cT.copy(cA).lerp(cB, low * 0.8); sun.color.copy(cT); sun.intensity = (1.55 - 0.35 * low) * k; fill.intensity = (0.62 - 0.1 * low) * k;
      CM.shafts.color.copy(cT); CM.shafts.opacity = (0.17 + 0.08 * low) * k; CM.patch.color.copy(cT); CM.patch.opacity = (0.34 - 0.08 * low) * k;
      CM.sky.color.copy(skyA).lerp(skyB, low * 0.7);
      const kx = (-dx / dy) * 0.5, kz = (-dz / dy) * 0.5;      // the rays' slope, eased so the light stays in the court
      sheets.matrix.set(1, -kx, 0, kx * H, 0, 1, 0, 0, 0, -kz, 1, kz * H, 0, 0, 0, 1);
      patches.matrix.makeTranslation(kx * H * 0.55, 0.03, kz * H * 0.55);
      sheets.matrixWorldNeedsUpdate = true; patches.matrixWorldNeedsUpdate = true;
    },
  };
  light.update(13);
  return { meshes, dims: { ...COURT, piers, cols }, light };
}
