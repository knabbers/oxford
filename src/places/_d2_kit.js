// Small builders shared by the districts-2 pass (places/the_plain.js, north_oxford.js, osney.js; see
// docs/research/districts2.md). All of them write into a Batch of the shared batch-4 atlas draw (_b4_kit.js), so
// nothing here makes a mesh of its own. q = LOD level (0 near, 1 mid, 2 far). Pure apart from the Batch.
import { frame, TAU, glowCard, bulb, LIT } from './_b4_kit.js';
import { faceFrame } from './_eo_kit.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const UV = [0.004, 0.004, 0.996, 0.996];
export const signAt = (B, key, x0, x1, y0, y1, z) => B.card(key, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], UV);

/** point / tangent / normal at distance s along a polyline [[x, z]] (cum = cumulative lengths) */
export function along(pts, cum, s) {
  let i = 1; while (i < pts.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1], b = pts[i], L = (cum[i] - cum[i - 1]) || 1, t = Math.max(0, Math.min(1, (s - cum[i - 1]) / L));
  const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, ux, uz, nx: -uz, nz: ux };
}
export const cumOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };

/**
 * A cast-iron lamp standard (base, fluted column, a collar, a lantern with a glowing pane) standing at (x, y0, z).
 * h: height to the lantern's foot. k: which lit bay the glass uses.
 */
export function lampStandard(B, x, y0, z, h, q, k = 0) {
  B.cyl('iron', x, y0, z, 0.2, 0.5, q ? 6 : 8, true, 0.16);
  B.cyl('iron', x, y0 + 0.5, z, 0.075, h - 0.6, q ? 5 : 8, false, 0.055);
  if (q < 2) { B.cyl('iron', x, y0 + 1.25, z, 0.1, 0.12, 6, true); B.cyl('iron', x, y0 + h - 0.2, z, 0.1, 0.12, 6, true); }
  // the lantern: a tapering glazed box with a cap and finial
  const y = y0 + h, s = 0.2;
  B.box('iron', x, y + 0.02, z, 0.34, 0.04, 0.34, 0);
  if (q < 2) for (const [ax, az] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const cx = x + ax * s, cz = z + az * s, rx = -az, rz = ax;
    glowCard(B, [cx - rx * s * 0.82, y + 0.05, cz - rz * s * 0.82], [cx + rx * s * 0.82, y + 0.05, cz + rz * s * 0.82], [cx + rx * s, y + 0.5, cz + rz * s], [cx - rx * s, y + 0.5, cz - rz * s], k + ax * 3 + az);
  } else bulb(B, x, y + 0.28, z, 0.2, k);
  B.lathe('iron', x, z, [[0.27, y + 0.5], [0.22, y + 0.6], [0.06, y + 0.74], [0.02, y + 0.92]], { seg: q ? 4 : 8, a0: Math.PI / 4 });
}

/**
 * A stone balustrade skin over an existing solid parapet of thickness t along a polyline, at offset `off` (centre of
 * the wall) from it: balusters painted on both faces 1.5 cm proud, a coping box over the wall head and pedestals every
 * `ped` m. y0..y1 = the wall (the coping overlaps y1). Returns the pedestal points [{x, z, nx, nz}].
 */
export function balustrade(B, pts, off, t, y1, q, o = {}) {
  const cum = cumOf(pts), L = cum[cum.length - 1], ped = o.ped || 7.5, s0 = o.s0 || 0, s1 = o.s1 ?? L, out = [];
  const n = Math.max(1, Math.round((s1 - s0) / ped)), step = (s1 - s0) / n;
  for (let k = 0; k <= n; k++) { const p = along(pts, cum, s0 + k * step); out.push({ x: p.x + p.nx * off, z: p.z + p.nz * off, ux: p.ux, uz: p.uz, nx: p.nx, nz: p.nz, s: s0 + k * step }); }
  for (let k = 0; k < n; k++) {
    const a = out[k], b = out[k + 1], hp = 0.32;
    const sa = a.s + hp, sb = b.s - hp; if (sb <= sa) continue;
    const pa = along(pts, cum, sa), pb = along(pts, cum, sb), len = sb - sa;
    for (const side of [1, -1]) {
      const d = off + side * (t / 2 + 0.015);
      const A = [pa.x + pa.nx * d, pa.z + pa.nz * d], C = [pb.x + pb.nx * d, pb.z + pb.nz * d];
      // a quad facing out of this face: u along (metres -> repeats), v 0..1 over 0.08..y1-0.06
      const ya = 0.08, yb = y1 - 0.06, nx = pa.nx * side, nz = pa.nz * side;
      const left = side > 0 ? C : A, right = side > 0 ? A : C;     // seen from outside the face, left -> right
      void nx; void nz;
      B.poly(q ? 'balusDk' : 'balus', [[left[0], ya, left[1]], [right[0], ya, right[1]], [right[0], yb, right[1]], [left[0], yb, left[1]]], [pa.nx * side, 0, pa.nz * side], [[0, 0], [len, 0], [len, 1], [0, 1]]);
    }
  }
  // the coping: a continuous box per segment over the wall head; pedestals proud of it
  for (let k = 0; k < n; k++) {
    const a = out[k], b = out[k + 1], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, len = Math.hypot(b.x - a.x, b.z - a.z);
    B.box('dress', mx, y1 + 0.04, mz, t + 0.12, 0.16, len + 0.02, Math.atan2(a.ux, a.uz), { bottom: true });
  }
  for (const p of out) B.box('dress', p.x, (y1 + 0.32) / 2 - 0.1, p.z, t + 0.2, y1 + 0.32 + 0.2, 0.62, Math.atan2(p.ux, p.uz), { bottom: false });
  return out;
}

/**
 * A painted pub front on face f of a mapped building: fascia board with the name (signKey), small-paned windows either
 * side of a door, a hanging sign on a bracket, two lanterns. paint: plain key of the woodwork.
 */
export function pubFront(B, f, q, signKey, paint = 'green', o = {}) {
  const L = Math.min(f.L, o.maxL || 12), z = 0.05;
  B.push(faceFrame(f));
  B.box(paint, 0, 1.6, z, L, 3.2, 0.1, 0, { top: true });
  const fw = Math.min(L - 0.6, 7.2), fh = Math.min(0.75, fw / 8);
  B.box('dark', 0, 3.45, z + 0.06, fw + 0.24, fh + 0.2, 0.1, 0, { bottom: true });
  signAt(B, signKey, -fw / 2, fw / 2, 3.45 - fh / 2, 3.45 + fh / 2, z + 0.115);
  if (q < 2) {
    const dw = 1.1, nW = Math.max(1, Math.floor((L / 2 - dw / 2 - 0.3) / 1.4));
    B.unit('door', rect(-dw / 2, 0.02, dw / 2, 2.35), z + 0.07, [0, 0]);
    for (const s of [-1, 1]) for (let k = 0; k < nW; k++) { const x = s * (dw / 2 + 0.35 + 0.65 + k * 1.4); B.unit('sash', rect(x - 0.6, 0.85, x + 0.6, 2.6), z + 0.07, [LIT[(k * 3 + (s > 0 ? 7 : 1)) % LIT.length], 0]); B.box('dark', x, 0.8, z + 0.1, 1.34, 0.08, 0.14, 0); }
    // lanterns either side of the door (glowing)
    for (const s of [-1, 1]) { B.beam('iron', [s * 1.0, 2.75, z], [s * 1.0, 2.75, z + 0.3], 0.03); bulb(B, s * 1.0, 2.62, z + 0.34, 0.09, s > 0 ? 4 : 9); }
  }
  // the hanging sign: a bracket off the corner, a board with the name on both faces
  const hx = L / 2 - 0.4;
  B.beam('iron', [hx, 3.95, z], [hx, 3.95, z + 1.25], 0.05); B.beam('iron', [hx, 3.5, z], [hx, 3.95, z + 0.8], 0.03);
  B.box('dark', hx, 3.35, z + 0.85, 0.05, 0.95, 0.92, 0);
  if (q < 2) { B.push(frame(hx + 0.03, 0, z + 0.85, 0, -1)); signAt(B, signKey, -0.42, 0.42, 3.3, 3.42, 0); B.pop(); B.push(frame(hx - 0.03, 0, z + 0.85, 0, 1)); signAt(B, signKey, -0.42, 0.42, 3.3, 3.42, 0); B.pop(); }
  B.pop();
}

/** a string of triangular bunting from a to b ([x, y, z]), n flags, sagging `sag` m; colours cycle bunt0-4 */
export function bunting(B, a, b, n, sag = 0.5, k0 = 0) {
  let prev = a;
  const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, fw = Math.min(0.28, L / n / 2.4);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), p = [a[0] + dx * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + dz * t];
    B.beam('rope', prev, p, 0.008); prev = p;
    const key = 'bunt' + ((i + k0) % 5), l = [p[0] - ux * fw, p[1], p[2] - uz * fw], r = [p[0] + ux * fw, p[1], p[2] + uz * fw], tip = [p[0], p[1] - fw * 1.6, p[2]];
    B.tri(key, l, r, tip, [0, 0], [1, 0], [0.5, 1]); B.tri(key, r, l, tip, [0, 0], [1, 0], [0.5, 1]);
  }
  B.beam('rope', prev, b, 0.008);
}

/** a post with a painted board on top (signKey) facing (nx, nz) at (x, z); w m wide */
export function boardPost(B, x, z, nx, nz, signKey, w = 1.8, y = 1.5, q = 0) {
  const ux = nz, uz = -nx, h = Math.max(0.16, w / 8);
  for (const s of [-1, 1]) B.box('oak', x + ux * s * (w / 2 - 0.05), (y + h) / 2, z + uz * s * (w / 2 - 0.05), 0.08, y + h + 0.05, 0.08, Math.atan2(ux, uz));
  B.box('dark', x, y + h / 2, z, w + 0.06, h + 0.06, 0.05, Math.atan2(nx, nz));
  B.push(frame(x + nx * 0.055, 0, z + nz * 0.055, ux, uz)); signAt(B, signKey, -w / 2, w / 2, y, y + h, 0); B.pop();
  if (q < 2) { B.push(frame(x - nx * 0.055, 0, z - nz * 0.055, -ux, -uz)); signAt(B, signKey, -w / 2, w / 2, y, y + h, 0); B.pop(); }
}

/** a timber field gate standing open against its post: hinge at (x, z), closed along (ux, uz), opened by `open` rad */
export function fieldGate(B, x, z, ux, uz, w = 3.0, open = 1.4, key = 'oak') {
  const a = Math.atan2(ux, uz) + open, gx = Math.sin(a), gz = Math.cos(a);
  B.box(key, x, 0.75, z, 0.18, 1.5, 0.18, Math.atan2(ux, uz));
  B.box(key, x + ux * (w + 0.1), 0.75, z + uz * (w + 0.1), 0.18, 1.5, 0.18, Math.atan2(ux, uz));
  for (const y of [0.35, 0.65, 0.95, 1.2]) B.beam(key, [x + gx * 0.1, y, z + gz * 0.1], [x + gx * w, y, z + gz * w], 0.05);
  B.beam(key, [x + gx * 0.1, 0.3, z + gz * 0.1], [x + gx * w * 0.9, 1.2, z + gz * w * 0.9], 0.05);
  B.beam(key, [x + gx * w, 0.3, z + gz * w], [x + gx * w, 1.22, z + gz * w], 0.06);
}

/** a riverside bench (timber slats on iron ends) at (x, z) facing (nx, nz) */
export function riverBench(B, x, z, nx, nz) {
  B.push(frame(x, 0, z, nz, -nx));
  B.box('oak', 0, 0.45, 0, 1.8, 0.05, 0.44, 0); B.box('oak', 0, 0.74, -0.24, 1.8, 0.32, 0.04, 0);
  for (const sx of [-0.8, 0.8]) { B.box('iron', sx, 0.22, 0.12, 0.05, 0.44, 0.05, 0, { top: false }); B.box('iron', sx, 0.42, -0.22, 0.05, 0.84, 0.05, 0, { top: false }); }
  B.pop();
}
/** a picnic table (bench seats either side) at (x, z) along (ux, uz) */
export function picnicTable(B, x, z, ux, uz) {
  const r = Math.atan2(ux, uz);
  B.box('oak', x, 0.74, z, 0.75, 0.05, 1.8, r);
  for (const s of [-1, 1]) B.box('oak', x + uz * s * 0.68, 0.44, z - ux * s * 0.68, 0.28, 0.05, 1.8, r);
  for (const s of [-1, 1]) B.box('oak', x + ux * s * 0.7, 0.37, z + uz * s * 0.7, 1.6, 0.06, 0.08, r);
}
/** a garden parasol (octagonal canopy on a pole) at (x, z) */
export function parasol(B, x, z, key = 'parasol', q = 0) {
  B.cyl('white', x, 0, z, 0.025, 2.3, 4, false);
  B.lathe(key, x, z, [[1.25, 2.0], [0.04, 2.45]], { seg: q ? 6 : 8 });
  B.lathe(key, x, z, [[0.04, 2.0], [1.25, 2.0]], { seg: q ? 6 : 8 });
}
export { TAU, rect };
