// Hertford Bridge, "the Bridge of Sighs" (T. G. Jackson, 1913-14), over New College Lane: a covered stone bridge on a
// shallow segmental arch with a row of windows each side, cornice and a low lead roof, built plain on the mapped
// footprint (G: dimensions; see the research doc). Plus St Helen's Passage towards the Turf Tavern: a sign at the lane,
// wall lanterns, and at the far end the Turf's yard: benches and braziers that glow after dark.
//   build(ctx) -> { meshes, dims, lamps, yard }
import { Batch, RB, frame, rectPts, archPts, buildBatch, packKeys, radSigns, signQuad, signsMesh, bayLit, pack } from './_rad_kit.js';
import { geoOf } from './_rad_lod.js';

export const ID = 'w62333303', TURF = 'w97822057';
export const BRIDGE = { x0: 426.6, x1: 431.0, zN: 52.6, zS: 61.0, spring: 3.7, crown: 4.7, cornice: 7.7, roof: 8.7, windows: 5 };
const LIT = []; for (let i = 6100; i < 8000 && LIT.length < 12; i++) if (bayLit(i, 0) < 0.12) LIT.push(i);

export function build(ctx) {
  const { world, parent, isFree } = ctx, D = BRIDGE;
  packKeys(world);
  const B = new Batch(), Bs = new Batch(), S = radSigns(world), out = { meshes: [], lamps: [], yard: [] };
  const span = D.zS - D.zN, mz = (D.zN + D.zS) / 2, hx = (D.x1 - D.x0) / 2, mx = (D.x0 + D.x1) / 2;
  // arch profile across the lane (z): y of the soffit
  const soffit = (z) => { const t = (z - mz) / (span / 2); return D.spring + (D.crown - D.spring) * (1 - t * t); };
  // visual pass: pale Clipsham-like stone, a smooth segmental soffit, an archivolt with a keystone and a blank shield,
  // five round-headed leaded windows between pilasters, set back in real reveals, a dentilled cornice, a lead roof
  function bridge(B, q) {
    const N = q === 0 ? 14 : 6, key = 'radPale';
    for (const side of [-1, 1]) {
      const x = mx + side * hx;
      B.push(frame(x, 0, mz, 0, side < 0 ? 1 : -1));                  // local +z points out of this face
      const sgn = side < 0 ? 1 : -1;                                   // local x = sgn * (z - mz)
      const pts = [];
      for (let i = 0; i <= N; i++) { const lz = -span / 2 + (span * i) / N; pts.push([lz, soffit(mz + sgn * lz)]); }
      const ww = 1.0, gap = (span - D.windows * ww) / (D.windows + 1), y0w = D.crown + 1.0, ysw = D.cornice - 1.25;
      // photographs (docs/research/photo_comparison.md): the bridge is not flat-topped. Its middle bay is taller, with a
      // bigger window under a segmental pediment that stands above the cornice and carries a shell finial
      const mid = (D.windows - 1) / 2;
      const wins = []; for (let k = 0; k < D.windows; k++) { const x0 = -span / 2 + gap + k * (ww + gap), cw = k === mid ? 1.24 : ww; wins.push(archPts(x0 + ww / 2, cw, y0w, ysw + (k === mid ? 0.3 : 0), q === 0 ? 8 : 4)); }
      {
        const pw = ww + gap + 0.5, py = D.cornice + 0.42, ph = 1.15, M = q === 0 ? 8 : 4, arc = [];
        for (let i = 0; i <= M; i++) { const t = -1 + (2 * i) / M; arc.push([(t * pw) / 2, py + ph * (1 - t * t)]); }
        B.face(key, [[-pw / 2, py - 0.14], [pw / 2, py - 0.14], ...arc.slice().reverse()], [], 0.06, false);
        for (let i = 0; i < M; i++) { const a = arc[i], b = arc[i + 1]; B.poly('radLead', [[a[0], a[1] + 0.03, 0.16], [b[0], b[1] + 0.03, 0.16], [b[0], b[1] + 0.03, -hx], [a[0], a[1] + 0.03, -hx]], [(a[1] - b[1]), (b[0] - a[0]), 0]); }
        if (q === 0) { B.box(key, 0, py + ph + 0.24, 0.06, 0.34, 0.5, 0.16, 0, { bottom: true }); B.box(key, 0, py + ph + 0.55, 0.06, 0.6, 0.16, 0.16, 0, { bottom: true }); }
      }
      const outline = [...pts, [span / 2, D.cornice], [-span / 2, D.cornice]];
      if (q === 0) {
        B.face(key, outline, wins, 0, false);
        wins.forEach((w, k) => { B.reveal('stoneLit', w, 0, -0.32); B.unit('leaded', w, -0.32, [LIT[k % LIT.length], 0]); });
        // pilasters between the windows, an impost band at the springing of their heads
        for (let k = 0; k <= D.windows; k++) { const px = -span / 2 + gap / 2 + k * (ww + gap) - (k === 0 ? -0.0 : 0); B.box(key, px, (D.crown + 0.85 + D.cornice - 0.45) / 2, 0.06, 0.28, D.cornice - 0.45 - D.crown - 0.85, 0.12, 0, { top: false }); }
        B.box(key, 0, ysw, 0.04, span, 0.1, 0.08, 0, { bottom: true });
        // archivolt following the arch, keystone, the blank shield over the crown
        B.sweep(key, pts.map(([u, v]) => [u, v, 0]), [[0.0, 0], [0.0, 0.08], [0.5, 0.08], [0.5, 0]], [0, 0, 1]);
        B.box(key, 0, D.crown + 0.35, 0.1, 0.55, 0.8, 0.2, 0, { bottom: true });
        B.box(key, 0, D.crown + 0.86, 0.08, span + 0.2, 0.16, 0.24, 0, { bottom: true, top: true });            // sill course
        // cornice with a dentil band and its soffit, a low blocking course
        B.poly('dentil', [[-span / 2 - 0.15, D.cornice - 0.42, 0.13], [span / 2 + 0.15, D.cornice - 0.42, 0.13], [span / 2 + 0.15, D.cornice - 0.25, 0.13], [-span / 2 - 0.15, D.cornice - 0.25, 0.13]], [0, 0, 1], [[0, 0], [span, 0], [span, 1], [0, 1]]);
        B.box(key, 0, D.cornice - 0.12, 0.2, span + 0.4, 0.24, 0.4, 0, { bottom: true, top: true });
        B.box(key, 0, D.cornice - 0.45, 0.06, span + 0.1, 0.06, 0.14, 0, { bottom: true });
        B.box(key, 0, D.cornice + 0.28, 0.0, span + 0.2, 0.3, 0.2, 0, { top: true });
      } else {
        B.face(key, outline, [], 0, false);
        wins.forEach((w, k) => B.unit('leaded', w, 0.03, [LIT[k % LIT.length], 0]));
        B.box(key, 0, D.cornice - 0.12, 0.15, span + 0.4, 0.24, 0.3, 0, { top: true });
      }
      B.pop();
    }
    // the soffit you walk under: a smooth curve, normals down
    for (let i = 0; i < N; i++) {
      const z0 = D.zN + (span * i) / N, z1 = D.zN + (span * (i + 1)) / N, n = (z) => { const d = (soffit(z + 0.01) - soffit(z - 0.01)) / 0.02, l = Math.hypot(d, 1); return [0, -1 / l, d / l]; };
      B.quadN('stoneLit', [D.x0, soffit(z0), z0], [D.x1, soffit(z0), z0], [D.x1, soffit(z1), z1], [D.x0, soffit(z1), z1], n(z0), n(z0), n(z1), n(z1), [D.x0, z0], [D.x1, z0], [D.x1, z1], [D.x0, z1]);
    }
    for (const s2 of [-1, 1]) B.poly('radLead', [[mx + s2 * (hx + 0.2), D.cornice + 0.3, D.zN - 0.1], [mx + s2 * (hx + 0.2), D.cornice + 0.3, D.zS + 0.1], [mx, D.roof, D.zS + 0.1], [mx, D.roof, D.zN - 0.1]], [s2, 1.2, 0]);
    for (const z of [D.zN - 0.1, D.zS + 0.1]) B.poly('radHoney', [[mx - hx - 0.2, D.cornice + 0.3, z], [mx + hx + 0.2, D.cornice + 0.3, z], [mx, D.roof, z]], [0, 0, z > mz ? 1 : -1]);
  }
  const PK = pack(world), gB = ctx.lod.group('bridge', [mx, 5, mz], 8, [60, 150, 600]);
  for (let q = 0; q < 3; q++) { const Bb = new RB(); bridge(Bb, Math.min(q, 1)); gB.add(q, geoOf(Bb, PK), { name: 'bridge' + q }); }


  // ---- St Helen's Passage: the sign at the lane, lanterns down the passage, the Turf's yard
  {
    // "Turf Tavern →" on the wall at the passage mouth (New College Lane, x ≈ 437.6, z ≈ 57)
    const x = 436.4, z = 56.6; signQuad(Bs, S.uv('turfArrow'), x - 0.7, z, x + 0.7, z, 2.3, 2.65, 0, 1, 0.03);
    // over the Turf's door, at the end of the passage
    signQuad(Bs, S.uv('turf'), 483.4, 23.6, 483.4, 20.4, 2.9, 3.7, -1, 0, 0.05);
    out.lamps.push([437.9, 3.0, 50.0], [438.5, 3.0, 41.0], [452.0, 3.0, 35.4], [468.0, 3.0, 28.6], [481.0, 3.0, 22.6]);
  }
  out.meshes.push(...signsMesh(Bs, world, parent, 'bridge'));
  // the yard: benches and braziers on free ground near the Turf's door (positions tested against the collider)
  const Y = new Batch();
  // (2026-11 sanity check: four of the five tables and a brazier stood INSIDE the Bath Place Hotel - the collider is
  // empty in the middle of a building, so isFree passed - and the reader's card lay on a table nobody could reach.
  // Spots inside a drawn building are left out; three more are offered in the open yard east of it.)
  const inBld = (x, z) => { let hit = false; if (world.buildingGrid) world.buildingGrid.queryRadius(x, z, 1, (q) => { if (q.b && !q.b.part && world.util.pointInPoly(x, z, q.b.poly)) { hit = true; return true; } }); return hit; };
  const cand = [[478.5, 24.6, 0], [478.0, 28.2, 0], [481.0, 31.5, 1.57], [485.6, 18.4, 1.57], [489.6, 18.9, 1.57], [486.2, 24.6, 0], [490.6, 27.6, 1.57], [486.4, 29.6, 0]];
  for (const [x, z, h] of cand) {
    if ((isFree && !isFree(x, z, 1.0)) || inBld(x, z) || out.yard.length >= 5) continue;
    Y.push(frame(x, 0, z, Math.cos(h), -Math.sin(h)));
    Y.box('wood', 0, 0.74, 0, 1.8, 0.06, 0.75); for (const s of [-1, 1]) { Y.box('wood', 0, 0.44, s * 0.62, 1.8, 0.05, 0.3); Y.box('oak', s * 0.75, 0.37, 0, 0.08, 0.74, 1.5); }
    Y.pop();
    out.yard.push({ x, z, kind: 'table' });
  }
  for (const [x, z] of [[480.2, 21.2], [486.6, 21.6], [491.6, 23.4]]) {
    if ((isFree && !isFree(x, z, 0.6)) || inBld(x, z) || out.yard.some((y) => Math.hypot(y.x - x, y.z - z) < 1.6)) continue;
    Y.cyl('iron', x, 0, z, 0.32, 0.9, 8, false, 0.12); Y.cyl('iron', x, 0.9, z, 0.36, 0.08, 8, true, 0.32);
    out.yard.push({ x, z, kind: 'brazier' });
  }
  out.meshes.push(...buildBatch(Y, world, parent, 'turf', {}));
  out.dims = { ...D };
  return out;
}
