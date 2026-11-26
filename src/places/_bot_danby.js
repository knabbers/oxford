// Oxford Botanic Garden — the Danby Gateway (showpiece, fine-detail pass: banded rustication, voussoirs with a carved
// keystone, shell-headed niches with the two kings under little pediments, triglyph frieze, the bust of Danby in the
// pediment, urns; one draw on the shared fine material of _se_fine.js, a far mesh beyond DIMS.lodR).
// Nicholas Stone, 1632-33, Headington freestone: a two-storey, three-bay Mannerist arch — a recessed centre bay with a
// rusticated round-headed arch between Doric columns, an entablature, an attic with a pediment holding the bust of the
// Earl of Danby, and niches in the side bays with the statues of Charles I and Charles II (William Bird, c. 1693).
// The garden face is similar, with incised sundials in the spandrels. A stone barrel vault runs through.
// docs/research/christ_church_botanic_magdalen.md §2.
//
//   build(ctx) -> { meshes, dims, colliders: [[cx, cz, w, d, rot]], passage: [x1, z1, x2, z2, w] }
//   ctx = { mats, parent, alias? }.  Frame: the walled garden's (_bot_map.js): u along the High Street wall, v into
//   the garden; the gateway spans u -W/2..W/2, v -D/2..D/2 (mapped footprint, 9.9 x 6.8 m).
import * as THREE from 'three';
import { Batch, prism, archPts, rectPts, lathe } from './_chch_kit.js';
import { buildFine, robedFigure, hoodMould, triCount, AIR_FAR, airKeep } from './_se_fine.js';
import { F } from './_bot_map.js';

export const DIMS = {
  W: 9.9, D: 6.8, vc: -0.1,               // footprint (mapped), centre offset in v
  order: 6.2, ent: 1.2, attic: 2.4,       // column height, entablature, attic storey (guess: ~12 m to the apex)
  pedRise: 2.1, arch: { w: 3.1, spring: 3.7 }, centre: 3.9, recessD: 0.45,
  niche: { w: 1.2, y0: 1.9, spring: 4.4 },
  lodR: 70,
};

const wm = (x, y, z, ax, az) => new THREE.Matrix4().makeBasis(new THREE.Vector3(ax, 0, az), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-az, 0, ax)).setPosition(x, y, z);

function make(lite) {
  const D = DIMS, B = new Batch(), hw = D.W / 2, hd = D.D / 2, H = D.order + D.ent;
  B.push(F.matrix());
  B.push(new THREE.Matrix4().makeTranslation(0, 0, D.vc));
  const cw = D.centre / 2, A = D.arch, NV = lite ? 8 : 12;
  const arch = archPts(0, A.w, 0, A.spring, NV);
  for (const face of [-1, 1]) {
    // face -1: the High Street side (v = -hd, normal -v); +1: the garden side (v = +hd, normal +v)
    const z = face * hd, ax = face < 0 ? -1 : 1, x0 = face < 0 ? hw : -hw;
    B.push(wm(x0, 0, z, ax, 0));
    const sideL = hw - cw, N = D.niche;
    // ---- side bays: banded rustication, a shell-headed niche with a king under a little pediment
    for (const [xa, king] of [[0, 0], [D.W - sideL, 1]]) {
      const nc = xa + sideL / 2, niche = archPts(nc, N.w, N.y0, N.spring, lite ? 5 : 8);
      B.face('stone', rectPts(xa, 0, xa + sideL, H), [niche]);
      B.reveal('stonePale', niche, 0, -0.45); B.face('shadow', niche, [], -0.45);
      if (lite) { B.box('mouldPale', nc, N.y0 + 1.1, -0.2, 0.5, 2.0, 0.3); continue; }
      for (let y = 0.35; y < D.order - 0.4; y += 0.7) { if (y + 0.35 > N.y0 - 0.5 && y < N.spring + N.w / 2 + 1.0) { for (const sd of [-1, 1]) B.box('stonePale', nc + sd * (sideL / 2 - 0.34), y + 0.17, 0.035, 0.6, 0.34, 0.07, 0, { bottom: true }); } else B.box('stonePale', nc, y + 0.17, 0.035, sideL - 0.08, 0.34, 0.07, 0, { bottom: true }); }
      robedFigure(B, 'mouldPale', nc, N.y0 + 0.28, -0.2, 2.0, { crown: true, staff: king === 1 });
      B.box('mould', nc, N.y0 + 0.14, -0.12, 0.8, 0.28, 0.6); B.box('mould', nc, N.y0 - 0.12, 0.08, N.w + 0.5, 0.2, 0.32, 0, { bottom: true });
      for (let k = 0; k < 5; k++) { const a = ((k + 0.5) / 5) * Math.PI; B.beam('carve', [nc, N.spring + 0.02, -0.42], [nc + Math.cos(a) * N.w * 0.46, N.spring + Math.sin(a) * N.w * 0.46, -0.3], 0.07, 0.05); }   // the shell
      hoodMould(B, niche, { w: 0.13, d: 0.09, key: 'mouldPale', fromY: N.y0 + 0.2 });
      const py = N.spring + N.w / 2 + 0.38; B.box('mould', nc, py, 0.12, N.w + 0.7, 0.14, 0.3, 0, { bottom: true });
      B.poly('mouldPale', [[nc - N.w / 2 - 0.35, py + 0.07, 0.2], [nc + N.w / 2 + 0.35, py + 0.07, 0.2], [nc, py + 0.6, 0.2]], [0, 0, 1]);
      B.poly('mould', [[nc - N.w / 2 - 0.35, py + 0.07, 0.2], [nc, py + 0.6, 0.2], [nc, py + 0.6, 0], [nc - N.w / 2 - 0.35, py + 0.07, 0]], [-1, 1, 0]); B.poly('mould', [[nc + N.w / 2 + 0.35, py + 0.07, 0.2], [nc + N.w / 2 + 0.35, py + 0.07, 0], [nc, py + 0.6, 0], [nc, py + 0.6, 0.2]], [1, 1, 0]);
      for (const sd of [-1, 1]) B.box('carve', nc + sd * (N.w / 2 + 0.2), py - 0.22, 0.08, 0.14, 0.34, 0.16);                                // consoles
    }
    // ---- centre bay, set back: the arch with its voussoirs and keystone, rusticated jambs
    B.face('stone', [[sideL, 0], [hw - A.w / 2, 0], ...arch.slice(2).reverse().map(([x, y]) => [hw + x, y]), [hw + A.w / 2, 0], [D.W - sideL, 0], [D.W - sideL, H], [sideL, H]], [], -D.recessD);
    for (const xs of [sideL, D.W - sideL]) B.poly('stone', [[xs, 0, -D.recessD], [xs, 0, 0], [xs, H, 0], [xs, H, -D.recessD]], [xs < hw ? 1 : -1, 0, 0]);
    const zr = -D.recessD, NVs = lite ? 5 : 11, r0 = A.w / 2, r1 = A.w / 2 + 0.62;
    for (let k = 0; k < NVs; k++) {
      const a0 = (k / NVs) * Math.PI, a1 = ((k + 1) / NVs) * Math.PI, key = !lite && k === (NVs - 1) / 2, rr = key ? r1 + 0.28 : r1, d = key ? 0.26 : k % 2 ? 0.1 : 0.16, g = lite ? 0 : 0.012;
      const P = (a, r, zz) => [hw + Math.cos(a) * r, A.spring + Math.sin(a) * r, zr + zz];
      B.poly(key ? 'mouldPale' : 'stonePale', [P(a0 + g, r0, d), P(a0 + g, rr, d), P(a1 - g, rr, d), P(a1 - g, r0, d)], [0, 0, 1]);
      if (!lite) { B.poly('mould', [P(a0 + g, rr, 0), P(a1 - g, rr, 0), P(a1 - g, rr, d), P(a0 + g, rr, d)], [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]); B.poly('mouldDark', [P(a0 + g, r0, 0), P(a0 + g, rr, 0), P(a0 + g, rr, d), P(a0 + g, r0, d)], [Math.sin(a0), -Math.cos(a0), 0]); B.poly('mould', [P(a1 - g, rr, 0), P(a1 - g, r0, 0), P(a1 - g, r0, d), P(a1 - g, rr, d)], [-Math.sin(a1), Math.cos(a1), 0]); }
      if (key) { lathe(B, 'carve', hw, zr + 0.3, [[0.05, A.spring + r0 + 0.1], [0.2, A.spring + r0 + 0.3], [0.22, A.spring + r0 + 0.55], [0.1, A.spring + r0 + 0.8]], 6, 0); }   // a carved mask
    }
    for (let y = 0.02, k = 0; y < A.spring - 0.3; y += 0.62, k++) for (const sd of [-1, 1]) B.box('stonePale', hw + sd * (A.w / 2 + 0.32), y + 0.29, zr + (k % 2 ? 0.05 : 0.08), 0.64, 0.56, k % 2 ? 0.1 : 0.16, 0, { bottom: true });
    if (face > 0) for (const sd of [-1, 1]) { const cx = hw + sd * (A.w / 2 + 0.78), cy = A.spring + 1.5; for (let k = 0; k < 12; k++) { const a0 = (k / 12) * Math.PI * 2, a1 = ((k + 1) / 12) * Math.PI * 2; B.poly('gilt', [[cx, cy, zr + 0.02], [cx + Math.cos(a0) * 0.4, cy + Math.sin(a0) * 0.4, zr + 0.02], [cx + Math.cos(a1) * 0.4, cy + Math.sin(a1) * 0.4, zr + 0.02]], [0, 0, 1]); } B.beam('iron', [cx, cy, zr + 0.03], [cx + 0.1, cy - 0.3, zr + 0.2], 0.025); }   // sundials
    // ---- banded Doric columns flanking the centre bay: drums with square rusticated blocks, plinths, capitals
    for (const xs of [sideL - 0.3, D.W - sideL + 0.3]) {
      B.box('stone', xs, 0.45, 0.35, 0.95, 0.9, 0.95);
      prism(B, 'stonePale', xs, 0.35, 0.36, 0.9, D.order - 0.3, lite ? 8 : 14, { r1: 0.31, cap: false });
      if (!lite) { for (let y = 1.25; y < D.order - 0.9; y += 0.98) B.box('stone', xs, y + 0.22, 0.35, 0.82, 0.44, 0.82, 0, { bottom: true }); B.box('mould', xs, 0.97, 0.35, 0.86, 0.14, 0.86); lathe(B, 'mouldPale', xs, 0.35, [[0.31, D.order - 0.5], [0.34, D.order - 0.42], [0.31, D.order - 0.36], [0.42, D.order - 0.3]], 14, 0); }
      B.box('mouldPale', xs, D.order - 0.15, 0.35, 0.9, 0.3, 0.9, 0, { bottom: true });
    }
    // ---- entablature: architrave, triglyph frieze, dentilled cornice
    B.box('mouldPale', hw, D.order + 0.2, 0.25, D.W + 0.2, 0.4, 0.55, 0, { bottom: true });
    B.box('stone', hw, D.order + 0.65, 0.2, D.W + 0.1, 0.5, 0.45);
    if (!lite) { for (let k = 0; k < 13; k++) { const tx = 0.35 + k * ((D.W - 0.7) / 12); B.box('mouldPale', tx, D.order + 0.65, 0.44, 0.3, 0.48, 0.05); for (const o of [-0.08, 0.08]) B.box('mouldDark', tx + o, D.order + 0.65, 0.47, 0.035, 0.4, 0.012); } for (let k = 0; k < 34; k++) B.box('mould', 0.1 + k * ((D.W - 0.2) / 33), D.order + 0.97, 0.52, 0.14, 0.12, 0.12, 0, { top: false, bottom: true }); }
    B.box('mouldPale', hw, D.order + 1.1, 0.4, D.W + 0.7, 0.2, 0.9, 0, { bottom: true });
    // ---- the attic over the centre bay: panelled, a pediment with the bust of Danby in a round niche; urns on the side bays
    const ay = H, aw = D.centre + 1.2, pt = ay + D.attic;
    B.box('stone', hw, ay + D.attic / 2, -0.1, aw, D.attic, 0.3);
    B.box('mouldPale', hw, pt + 0.09, 0.2, aw + 0.8, 0.18, 0.6, 0, { bottom: true });
    B.poly('stonePale', [[hw - aw / 2 - 0.3, pt + 0.18, 0.25], [hw + aw / 2 + 0.3, pt + 0.18, 0.25], [hw, pt + D.pedRise, 0.25]], [0, 0, 1]);
    for (const sd of [-1, 1]) { const e = [hw + sd * (aw / 2 + 0.4), pt + 0.18], ap = [hw, pt + D.pedRise + 0.08]; B.beam('mouldPale', [e[0], e[1] + 0.08, 0.3], [ap[0], ap[1] + 0.08, 0.3], 0.5, 0.18); }
    if (!lite) {
      for (const sd of [-1, 1]) { B.box('mould', hw + sd * (aw / 2 - 0.2), ay + D.attic / 2, 0.08, 0.34, D.attic - 0.3, 0.08); B.box('mould', hw + sd * 1.25, ay + D.attic / 2, 0.07, 0.9, D.attic - 0.9, 0.04); }
      const by = pt + 0.5; for (let k = 0; k < 10; k++) { const a0 = (k / 10) * Math.PI * 2, a1 = ((k + 1) / 10) * Math.PI * 2; B.poly('shadow', [[hw, by + 0.42, 0.27], [hw + Math.cos(a0) * 0.5, by + 0.42 + Math.sin(a0) * 0.5, 0.27], [hw + Math.cos(a1) * 0.5, by + 0.42 + Math.sin(a1) * 0.5, 0.27]], [0, 0, 1]); }
      lathe(B, 'mouldPale', hw, 0.34, [[0.3, by + 0.02], [0.28, by + 0.2], [0.1, by + 0.36], [0.08, by + 0.42]], 6, 0); lathe(B, 'mouldPale', hw, 0.36, [[0.07, by + 0.4], [0.13, by + 0.5], [0.13, by + 0.62], [0.08, by + 0.72], [0, by + 0.75]], 6, 0);     // Danby
      lathe(B, 'mould', hw, 0.1, [[0.2, pt + D.pedRise + 0.1], [0.2, pt + D.pedRise + 0.3], [0.08, pt + D.pedRise + 0.36], [0.2, pt + D.pedRise + 0.6], [0.05, pt + D.pedRise + 0.82], [0, pt + D.pedRise + 0.95]], 8, 0);
    }
    for (const xs of [0.62, D.W - 0.62]) { B.box('stone', xs, H + 0.4, 0, 0.8, 0.8, 0.8); lite ? lathe(B, 'mouldPale', xs, 0, [[0.3, H + 0.8], [0.3, H + 1.5], [0, H + 2.1]], 6, 0) : lathe(B, 'mouldPale', xs, 0, [[0.12, H + 0.8], [0.12, H + 0.95], [0.34, H + 1.25], [0.36, H + 1.5], [0.2, H + 1.72], [0.1, H + 1.76], [0.16, H + 1.9], [0.04, H + 2.1], [0, H + 2.3]], 10, 0); }
    B.pop();
  }
  // ---- the two side walls of the block, the roof, the barrel vault through (coffer ribs), the iron gates folded back
  B.push(wm(-hw, 0, -hd, 0, 1)); B.face('stone', rectPts(0, 0, D.D, H)); B.pop();
  B.push(wm(hw, 0, hd, 0, -1)); B.face('stone', rectPts(0, 0, D.D, H)); B.pop();
  B.boxXZ('lead', -hw, hw, H - 0.1, H, -hd, hd);
  B.boxXZ('stone', -cw - 0.6, cw + 0.6, H, H + D.attic - 0.02, -0.3 - 0.15, 0.3 - 0.1);
  for (let k = 0; k < NV; k++) {
    const a0 = (k / NV) * Math.PI, a1 = ((k + 1) / NV) * Math.PI, r = A.w / 2;
    const P = (a, z) => [Math.cos(a) * r, A.spring + Math.sin(a) * r, z];
    B.poly('stonePale', [P(a0, -hd + D.recessD), P(a1, -hd + D.recessD), P(a1, hd - D.recessD), P(a0, hd - D.recessD)], [-Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0]);
    if (!lite) for (const zz of [-2, 0, 2]) B.beam('mould', [Math.cos(a0) * (r - 0.03), A.spring + Math.sin(a0) * (r - 0.03), zz], [Math.cos(a1) * (r - 0.03), A.spring + Math.sin(a1) * (r - 0.03), zz], 0.18, 0.08);
  }
  for (const s of [-1, 1]) { B.boxXZ('stone', s > 0 ? A.w / 2 : -A.w / 2 - 0.3, s > 0 ? A.w / 2 + 0.3 : -A.w / 2, 0, A.spring, -hd + D.recessD, hd - D.recessD); if (!lite) B.box('mould', s * (A.w / 2 - 0.02), A.spring - 0.1, 0, 0.1, 0.2, D.D - 2 * D.recessD); }
  if (!lite) for (const s of [-1, 1]) { for (let k = 0; k < 9; k++) B.box('iron', s * (A.w / 2 - 0.07), 1.3, -hd + D.recessD + 0.2 + k * 0.19, 0.03, 2.6, 0.03, 0, { top: false }); for (const y of [0.15, 1.3, 2.5]) B.box('iron', s * (A.w / 2 - 0.07), y, -hd + D.recessD + 0.96, 0.03, 0.06, 1.6); }
  B.pop(); B.pop();
  return B;
}

export function build(ctx) {
  const D = DIMS, hw = D.W / 2, hd = D.D / 2, A = D.arch;
  const near = buildFine(make(false), ctx.world, ctx.parent, 'bot:danby:near'), far = buildFine(make(true), ctx.world, ctx.parent, 'bot:danby:far');
  near.visible = false;
  airKeep([far]);                                   // (from a glider: past cull.js's ~600 m)
  const meshes = [near, far], c = F.toW(0, D.vc);
  // colliders (world): the two side piers; a passage through the arch
  const colliders = [];
  for (const s of [-1, 1]) { const uc = s * (A.w / 2 + 0.3 + (hw - A.w / 2 - 0.3) / 2), [x, z] = F.toW(uc, D.vc); colliders.push([x, z, hw - A.w / 2 - 0.3, D.D, Math.atan2(-F.uz, F.ux)]); }
  const a = F.toW(0, D.vc - hd - 1.4), b = F.toW(0, D.vc + hd + 1.4);
  return { meshes, lod: { near, far, c, r: D.lodR, rFar: 480, airFar: AIR_FAR, minScale: 0.7 }, dims: D, colliders, passage: [a[0], a[1], b[0], b[1], A.w - 0.3], tris: { near: triCount(near), far: triCount(far) } };
}
