// Port Meadow — the grass's own detail and the backdrop over the east fence (owned by places/port_meadow.js).
//   ground   one painted-goods mesh per 300 m band (_cw_goods.js cells, the lettering material's shader: nothing new to
//            compile): rough darker patches and buttercups lying flat on the grass, tussocks, thistles and buttercup clumps
//            standing up, the cow-trodden mud inside the gate, worn margins along the pebble path; every normal points up
//            so the cards are lit like the grass they stand in
//   wet      a ring of sodden, darker ground round each flood (shown with the flood), so the water has no hard edge
//   puddles  a few standing puddles inside the gate and on the path (merged into the river mesh by _pm_dress.js)
//   backdrop the railway on its low bank beyond the fence and the backs of a terrace beyond it (the Radcliffe atlas, as the
//            city-centre-west sites use: one draw near the meadow's east side)
// Deterministic (h01 hashes), no Math.random.
import * as THREE from 'three';
import { MEADOW, PATH, GATE, FLOODS, RIVER, BOX, pointInPoly, distToLine, inRiver, h01, riverX } from './_pm_site.js';
import { cwGoods } from './_cw_goods.js';
import { cwPack, RB, geoOf, frame, rectPts } from './_cw_kit.js';
import { Batch } from './_rad_kit.js';

/** a smooth value noise in [0, 1] */
function vn(x, z, s, seed) {
  const fx = x / s, fz = z / s, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const h = (a, b) => h01(a * 7 + seed, b * 13 - seed);
  const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}
const flat = (B, uv, x, z, r, rot, y = 0.05) => {
  const c = Math.cos(rot), s = Math.sin(rot), P = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([a, b]) => [x + a * c - b * s, y, z + a * s + b * c]);
  B.poly('g', P, [0, 1, 0], [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]]);
};
const cross = (B, uv, x, z, w, h, rot) => {
  for (const a of [rot, rot + Math.PI / 2]) {
    const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
    B.card('g', [x - dx, 0, z - dz], [x + dx, 0, z + dz], [x + dx, h, z + dz], [x - dx, h, z - dz], uv);
  }
};
const towpathAt = (z) => riverX(z) + RIVER.w / 2 + 6 + 1.5 * Math.sin(z / 37);

export function buildGround(game) {
  const W = game.world, G = cwGoods(W);
  const mat = G.material.clone(); mat.name = 'pm-ground'; mat.emissiveIntensity = 0; mat.polygonOffset = true; mat.polygonOffsetFactor = -4; mat.polygonOffsetUnits = -8;
  const bands = [[-660, -950], [-950, -1240], [-1240, -1530], [-1530, -1840]].map((r) => ({ r, B: new Batch() }));
  const bandOf = (z) => bands.find((b) => z <= b.r[0] && z > b.r[1]) || bands[bands.length - 1];
  const ok = (x, z, pad = 2) => pointInPoly(x, z, MEADOW) && !inRiver(x, z) && distToLine(x, z, PATH) > pad && Math.abs(x - towpathAt(z)) > pad;
  let n = 0;
  // flat: rough patches on a jittered 14 m grid (denser where the noise says the ground is rougher), buttercups, daisies
  for (let x = BOX.minX; x < BOX.maxX; x += 14) for (let z = BOX.minZ; z < BOX.maxZ; z += 14) {
    const i = Math.round(x), j = Math.round(z), px = x + 14 * h01(i, j), pz = z + 14 * h01(j, i + 3), rough = vn(px, pz, 60, 4);
    if (!ok(px, pz, 1.5)) continue;
    if (h01(i + 5, j) < 0.05 + 0.4 * rough * rough) { flat(bandOf(pz).B, G.uv('rough'), px, pz, 3 + 6 * h01(i, j + 9), 6.28 * h01(i + 1, j), 0.045); n++; }
    const bc = vn(px, pz, 45, 11);
    if (bc > 0.55 && h01(i + 7, j + 2) < 0.8) { flat(bandOf(pz).B, G.uv(h01(i, j + 4) < 0.75 ? 'buttercups' : 'daisies'), px + 3, pz - 4, 1.4 + 1.6 * h01(i, j + 2), 6.28 * h01(i + 2, j), 0.05); n++; }
  }
  // upright: tussocks everywhere (thicker on the rough ground), thistles in clusters, buttercup clumps in the yellow patches
  for (let k = 0; k < 2600; k++) {
    const x = BOX.minX + (BOX.maxX - BOX.minX) * h01(k, 31), z = BOX.minZ + (BOX.maxZ - BOX.minZ) * h01(k, 37);
    if (!ok(x, z, 1.2)) continue;
    const rough = vn(x, z, 60, 4), bc = vn(x, z, 45, 11), th = vn(x, z, 30, 19);
    const B = bandOf(z).B, rot = 6.28 * h01(k, 41), s = 0.7 + 0.6 * h01(k, 43);
    if (th > 0.72 && h01(k, 47) < 0.6) { cross(B, G.uv('thistle'), x, z, 0.6 * s, 0.75 * s, rot); n++; }
    else if (bc > 0.58 && h01(k, 49) < 0.7) { cross(B, G.uv('clump'), x, z, 0.5 * s, 0.38 * s, rot); n++; }
    else if (h01(k, 53) < 0.35 + 0.5 * rough) { cross(B, G.uv('tussock'), x, z, 0.75 * s, 0.5 * s, rot); n++; }
  }
  // the cow-trodden ground inside the gate: mud, hoof prints, a few rough tussocks round it
  for (let k = 0; k < 26; k++) {
    const a = Math.PI * (1 + h01(k, 61)), d = 1.5 + 13 * Math.sqrt(h01(k, 63)), x = GATE.x + Math.cos(a) * d * 1.3, z = GATE.z - 1.5 + Math.sin(a) * d;
    if (z > GATE.z - 0.5) continue;
    flat(bandOf(z).B, G.uv('mud'), x, z, 0.8 + 1.4 * (1 - d / 15), 6.28 * h01(k, 67), 0.055 + k * 0.0004); n++;
  }
  // worn margins either side of the pebble path, and bare patches along the Thames Path
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (let s = 2; s < L; s += 3.5) for (const side of [-1, 1]) { const off = side * (1.7 + 0.6 * h01(i * 50 + s, side + 3)), x = a[0] + ux * s - uz * off, z = a[1] + uz * s + ux * off; flat(bandOf(z).B, G.uv('mud'), x, z, 0.7 + 0.5 * h01(s * 3, i), 6.28 * h01(s, i + 9), 0.048); n++; }
  }
  for (let z = -800; z > -1820; z -= 9) { if (h01(Math.round(z), 71) < 0.5) continue; const x = towpathAt(z) + (h01(Math.round(z), 73) - 0.5) * 2.6; flat(bandOf(z).B, G.uv('mud'), x, z, 0.8 + 0.8 * h01(Math.round(z), 75), 6.28 * h01(Math.round(z), 77), 0.048); n++; }
  const meshes = [];
  for (const b of bands) {
    const tmp = new THREE.Group(), out = b.B.build({ g: mat }, tmp, { noShadow: true });
    for (const m of out) {
      const N = m.geometry.attributes.normal.array; for (let i = 0; i < N.length; i += 3) { N[i] = 0; N[i + 1] = 1; N[i + 2] = 0; }
      m.name = 'pm:ground'; m.castShadow = false; m.receiveShadow = true; meshes.push(m);
    }
  }
  // the wet margin round every flood (its own mesh, shown with the flood)
  const Bw = new Batch();
  FLOODS.forEach((F, f) => {
    let cx = 0, cz = 0; for (const p of F) { cx += p[0] / F.length; cz += p[1] / F.length; }
    for (let i = 0; i < F.length; i++) {
      const a = F[i], b = F[(i + 1) % F.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s < L; s += 4) {
        const t = s / L, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, dx = x - cx, dz = z - cz, dl = Math.hypot(dx, dz) || 1, o = (h01(f * 999 + i * 37 + s, 81) - 0.3) * 9;
        flat(Bw, G.uv('wet'), x + (dx / dl) * o, z + (dz / dl) * o, 3 + 3 * h01(i * 13 + s, f + 83), 6.28 * h01(s, i + f), 0.052);
      }
    }
  });
  const tw = new THREE.Group(), wet = Bw.build({ g: mat }, tw, { noShadow: true })[0];
  if (wet) { const N = wet.geometry.attributes.normal.array; for (let i = 0; i < N.length; i += 3) { N[i] = 0; N[i + 1] = 1; N[i + 2] = 0; } wet.name = 'pm:wet'; wet.visible = false; wet.castShadow = false; }
  return { meshes, wet, count: n };
}

/** standing puddles (flat blobs with aEdge 1 at the rim, the river's attribute layout) -> [BufferGeometry] */
export function puddles(y) {
  const out = [], spots = [[GATE.x - 3, GATE.z - 5, 2.2], [GATE.x + 2, GATE.z - 9, 1.6], [GATE.x - 8, GATE.z - 3, 1.3], [-962, -878, 1.4], [-1012, -864, 1.8], [-1066, -840, 1.2], [-1090, -826, 2.0]];
  spots.forEach(([cx, cz, r], k) => {
    const n = 12, P = [cx, y, cz], E = [0.6], UV = [cx, cz], I = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = r * (0.7 + 0.5 * h01(k * 31 + i, 91)), sx = 1.4; P.push(cx + Math.cos(a) * rr * sx, y, cz + Math.sin(a) * rr); E.push(1); UV.push(cx + Math.cos(a) * rr * sx, cz + Math.sin(a) * rr); }
    for (let i = 0; i < n; i++) I.push(0, 1 + ((i + 1) % n), 1 + i);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(E, 1)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setIndex(I); g.computeVertexNormals();
    // make sure the faces point up
    const N = g.attributes.normal.array; if (N[1] < 0) { for (let t = 0; t < I.length; t += 3) { const q = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = q; } g.setIndex(I); g.computeVertexNormals(); }
    out.push(g);
  });
  return out;
}

/** the railway on its bank beyond the east fence and the backs of a terrace beyond it -> Mesh (the shared atlas) */
export function buildBackdrop(game) {
  const W = game.world, P = cwPack(W), B = new RB(), map = game.map;
  const z0 = -872, z1 = -1822;
  // the bank: ballast top 0.45 m up with sloped sides, two tracks of sleepers and rails, a lineside cable trough
  const xa = -905.2, xb = -896.4, top = 0.45;
  B.poly('cwGrassLt', [[xa, 0.02, z0], [xa + 1.4, top, z0], [xa + 1.4, top, z1], [xa, 0.02, z1]], [-1, 1.5, 0]);
  B.poly('cwGrassLt', [[xb - 1.4, top, z0], [xb, 0.02, z0], [xb, 0.02, z1], [xb - 1.4, top, z1]], [1, 1.5, 0]);
  B.poly('cwBallast', [[xa + 1.4, top, z0], [xb - 1.4, top, z0], [xb - 1.4, top, z1], [xa + 1.4, top, z1]], [0, 1, 0]);
  for (const tc of [-902.6, -899.0]) {
    for (let z = z0 - 0.3; z > z1; z -= 0.8) B.poly('cwSleeper', [[tc - 1.25, top + 0.05, z + 0.12], [tc + 1.25, top + 0.05, z + 0.12], [tc + 1.25, top + 0.05, z - 0.12], [tc - 1.25, top + 0.05, z - 0.12]], [0, 1, 0]);
    for (const rx of [-0.72, 0.72]) for (let z = z0; z > z1; z -= 60) { const e = Math.max(z1, z - 60); B.poly('cwRailTop', [[tc + rx - 0.035, top + 0.2, z], [tc + rx + 0.035, top + 0.2, z], [tc + rx + 0.035, top + 0.2, e], [tc + rx - 0.035, top + 0.2, e]], [0, 1, 0]); B.poly('cwRail', [[tc + rx - 0.035, top + 0.05, z], [tc + rx - 0.035, top + 0.05, e], [tc + rx - 0.035, top + 0.2, e], [tc + rx - 0.035, top + 0.2, z]], [-1, 0, 0]); }
  }
  B.box('cwConcrete', xb - 1.7, top + 0.12, (z0 + z1) / 2, 0.4, 0.24, z0 - z1, 0, { bottom: false });
  for (let z = z0 - 40; z > z1; z -= 400) { B.box('iron', xa + 1.0, top + 1.6, z, 0.12, 3.2, 0.12); B.box('cwBlack', xa + 1.0, top + 3.3, z, 0.4, 0.8, 0.3); B.box('cwRed', xa + 0.84, top + 3.45, z, 0.02, 0.14, 0.14); }   // a signal or two
  // the terrace backs (where nothing is mapped): brick or render, slate, sashes, back doors, outriggers, chimneys, a fence
  const blocked = (x, z) => {
    for (const b of map.buildings) { if (!b.poly) continue; const c = b.c || b.poly[0]; if (Math.abs(c[0] - x) > 40 || Math.abs(c[1] - z) > 40) continue; if (b.poly.some((p) => Math.abs(p[0] - x) < 9 && Math.abs(p[1] - z) < 6)) return true; }
    for (const r of map.roads) { if (!r.pts) continue; for (const p of r.pts) if (Math.abs(p[0] - x) < 10 && Math.abs(p[1] - z) < 7) return true; }
    return false;
  };
  const hx0 = -893.0, D = 8.0, hw = 5.0, eave = 6.0, ridge = 8.6;
  let houses = 0;
  for (let z = -880; z > -1815; z -= hw) {
    const row = Math.floor((-880 - z) / 66), inRow = ((-880 - z) % 66) / 66;
    if (inRow > 0.88 || blocked(hx0 + D / 2, z - hw / 2)) continue;
    const k = Math.round(z), brick = h01(row, 5) < 0.65, wall = brick ? (h01(k, 7) < 0.5 ? 'cwBrick' : 'cwBrickDk') : 'cwStucco', zc = z - hw / 2;
    // the back wall (facing the meadow, -x) and the two ends where the run stops
    B.poly(wall, [[hx0, 0, z - hw], [hx0, 0, z], [hx0, eave, z], [hx0, eave, z - hw]], [-1, 0, 0]);
    B.poly('slate', [[hx0 - 0.3, eave - 0.1, z - hw], [hx0 - 0.3, eave - 0.1, z], [hx0 + D / 2, ridge, z], [hx0 + D / 2, ridge, z - hw]], [-1, 1.2, 0]);
    B.push(frame(hx0 - 0.01, 0, zc, 0, 1));
    B.unit('sash', rectPts(-1.6, 3.4, -0.6, 5.0), 0.02, [k % 97, 1]); B.unit('sash', rectPts(0.6, 3.4, 1.6, 5.0), 0.02, [(k + 3) % 97, 1]);
    B.unit(h01(k, 9) < 0.5 ? 'doorDark' : 'doorNavy', rectPts(1.0, 0, 1.9, 2.1), 0.02, [k % 31, 0]); B.unit('sash', rectPts(-1.6, 0.9, -0.4, 2.3), 0.02, [(k + 7) % 97, 0]);
    B.pop();
    if (h01(k, 11) < 0.55) { const ox = hx0 - 3.2; B.box(wall, ox + 1.6, 1.4, zc + 0.8, 3.2, 2.8, 2.6, 0, { bottom: false, top: false }); B.poly('slate', [[ox - 0.1, 2.6, zc - 0.6], [ox - 0.1, 2.6, zc + 2.2], [hx0, 3.4, zc + 2.2], [hx0, 3.4, zc - 0.6]], [-1, 2, 0]); }
    if (houses % 2 === 0) B.box('cwBrickDk', hx0 + D / 2, ridge + 0.6, z, 0.6, 1.4, 1.0);
    // the garden fence at the back of the yard
    B.poly('cwTimberDk', [[hx0 - 6.5, 0, z - hw], [hx0 - 6.5, 0, z], [hx0 - 6.5, 1.8, z], [hx0 - 6.5, 1.8, z - hw]], [-1, 0, 0]);
    houses++;
  }
  const geo = geoOf(B, P); if (!geo) return null;
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mesh = new THREE.Mesh(geo, P.atlas); mesh.name = 'pm:backdrop'; mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.userData.houses = houses;
  return mesh;
}
