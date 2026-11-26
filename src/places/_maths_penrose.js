// Penrose P3 (rhombus) tiling for the Andrew Wiles Building forecourt (owned by places/maths.js). Pure logic, no DOM
// except drawPenrose(), which paints onto a canvas you pass in.
//
// Generation: Robinson-triangle deflation (the standard "sun" start). Each half-tile is
//   kind 0 = golden triangle (apex A = 36°, legs AB = AC, short base BC)  -> two of them across BC make a THIN rhomb (36°/144°)
//   kind 1 = golden gnomon   (apex A = 108°, legs AB = AC, long base BC)  -> two of them across BC make a THICK rhomb (72°/108°)
// The rhomb edges are the triangle legs; all rhombs have edge length = leg length. The tiling is edge-to-edge.
//
// Arc decoration (Penrose's matching arcs; the forecourt has one family of polished stainless bands): an arc at each
// rhomb corner where the half-tiles meet in the "B" role, i.e. around one obtuse (144°) corner of each thin rhomb
// (radius e/φ²) and one acute (72°) corner of each thick rhomb (radius e/φ). Because the deflation labels every
// vertex consistently (B and C roles never share a vertex) and the radii at the two ends of any edge they cross sum
// to e, the arcs meet across every tile edge, forming closed circles (around 5-thick-rhomb "stars") and longer
// curves. tools/smoke_maths.mjs checks the continuity on a patch.

export const PHI = (1 + Math.sqrt(5)) / 2;

/** Half-tiles after `gens` deflations of a sun of radius r centred at (0,0). Returns [{k, A:[x,z], B, C}]. */
export function penroseTriangles(r, gens) {
  let tris = [];
  for (let i = 0; i < 10; i++) {
    let B = [r * Math.cos(((2 * i - 1) * Math.PI) / 10), r * Math.sin(((2 * i - 1) * Math.PI) / 10)];
    let C = [r * Math.cos(((2 * i + 1) * Math.PI) / 10), r * Math.sin(((2 * i + 1) * Math.PI) / 10)];
    if (i % 2 === 0) { const t = B; B = C; C = t; }
    tris.push({ k: 0, A: [0, 0], B, C });
  }
  const along = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];
  for (let g = 0; g < gens; g++) {
    const out = [];
    for (const t of tris) {
      if (t.k === 0) {
        const P = along(t.A, t.B, 1 / PHI);
        out.push({ k: 0, A: t.C, B: P, C: t.B }, { k: 1, A: P, B: t.C, C: t.A });
      } else {
        const Q = along(t.B, t.A, 1 / PHI), R = along(t.B, t.C, 1 / PHI);
        out.push({ k: 1, A: R, B: t.C, C: t.A }, { k: 1, A: Q, B: R, C: t.B }, { k: 0, A: R, B: Q, C: t.A });
      }
    }
    tris = out;
  }
  return tris;
}

const key = (p, q) => {
  const a = `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`, b = `${Math.round(q[0] * 1e5)},${Math.round(q[1] * 1e5)}`;
  return a < b ? a + '|' + b : b + '|' + a;
};
export const pointKey = (p) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;

/**
 * Pair half-tiles across their bases into rhombs.
 * Returns { rhombs: [{thick, pts:[A, B, A2, C], tris:[t1,t2]}], loose: [half-tiles with no partner (patch boundary)] }.
 */
export function pairRhombs(tris) {
  const byBase = new Map();
  for (const t of tris) { const k = key(t.B, t.C); const l = byBase.get(k); if (l) l.push(t); else byBase.set(k, [t]); }
  const rhombs = [], loose = [];
  for (const l of byBase.values()) {
    if (l.length === 2 && l[0].k === l[1].k) rhombs.push({ thick: l[0].k === 1, pts: [l[0].A, l[0].B, l[1].A, l[0].C], tris: l });
    else loose.push(...l);
  }
  return { rhombs, loose };
}

/** Penrose tiling of a patch: all rhombs within `radius` of the centre, edge length `edge`. */
export function penrosePatch(edge, radius) {
  // the sun's legs shrink by PHI per generation: choose gens so the legs come out at `edge`
  let r = edge, gens = 0;
  while (r < radius * 1.25) { r *= PHI; gens++; }
  return { ...pairRhombs(penroseTriangles(r, gens)), sunRadius: r, gens };
}

/** Arc radii as fractions of the edge: thin rhomb B-corner, thick rhomb B-corner. */
export const ARC = { thin: 1 / (PHI * PHI), thick: 1 / PHI };

/** The arc on one half-tile (around its B corner, from leg BA to the base BC): {cx, cz, r, a0, a1}. */
export function triArc(t, edge) {
  const V = t.B, r = (t.k === 1 ? ARC.thick : ARC.thin) * edge;
  return { cx: V[0], cz: V[1], r, a0: Math.atan2(t.A[1] - V[1], t.A[0] - V[0]), a1: Math.atan2(t.C[1] - V[1], t.C[0] - V[0]) };
}

/** Polygon area (shoelace, absolute). */
export function area(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s) / 2; }

/**
 * Paint a tiling onto a 2D canvas context. `toPx(x, z)` maps tiling coords to pixels (translate + uniform scale only, no rotation/reflection); colours for thick/thin/joint/steel.
 * Half-tiles are filled individually (so cut tiles at the boundary still paint), joints drawn on the legs only.
 */
export function drawPenrose(ctx, tris, edge, toPx, scale, opts = {}) {
  const col = { thick: '#4d5054', thin: '#b9b8b2', joint: 'rgba(30,30,30,0.55)', steel: '#e8ecef', ...opts };
  const rnd = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  for (const t of tris) {
    const a = toPx(t.A[0], t.A[1]), b = toPx(t.B[0], t.B[1]), c = toPx(t.C[0], t.C[1]);
    ctx.fillStyle = t.k === 1 ? col.thick : col.thin;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.stroke();      // hide the internal base seam
  }
  // granite speckle
  if (opts.speckle !== false) {
    const W = ctx.canvas.width, H = ctx.canvas.height, n = Math.floor(W * H * 0.02);
    for (let i = 0; i < n; i++) { const v = rnd(); ctx.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.14)'; ctx.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
  }
  // joints along the legs
  ctx.strokeStyle = col.joint; ctx.lineWidth = Math.max(1, scale * 0.012);
  ctx.beginPath();
  for (const t of tris) { const a = toPx(t.A[0], t.A[1]), b = toPx(t.B[0], t.B[1]), c = toPx(t.C[0], t.C[1]); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); }
  ctx.stroke();
  // stainless arcs (30 mm bands)
  ctx.strokeStyle = col.steel; ctx.lineWidth = Math.max(1.5, scale * 0.04); ctx.lineCap = 'butt';
  for (const t of tris) {
    const a = triArc(t, edge), c = toPx(a.cx, a.cz);
    let d = a.a1 - a.a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    ctx.beginPath(); ctx.arc(c[0], c[1], a.r * scale, a.a0, a.a0 + d, d < 0); ctx.stroke();
  }
}
