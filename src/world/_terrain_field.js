// The surveyed height field (world/terrain.js; data world/_terrain_data.js, made by tools/terrain_build.py).
//
// Form. Nodes every `g` metres (2 m) from (x0, z0); each cell is two flat triangles, split by the diagonal that runs
// from its +x corner to its +z corner. The height anywhere is the plain linear blend over the triangle it is in: three
// texel fetches in the vertex shader, the same three array reads here.
//
// The data is stored as a hierarchy: a 256 m lattice refined seven times by halving, a node kept where the ground
// there leaves the straight line between its two parents by more than a centimetre or two, or where leaving it out
// would put the field more than 4.5 cm from the smoothed survey. Level or evenly sloping ground costs nothing to store.
//
// Three fields share the nodes. R: the ground with the bridge decks on it (roads, pavements, and with W everything
// that stands or moves). W: the water's own level (the reach's level on the water and for 6 m around it, R elsewhere):
// the river stays down under its bridge and level at its banks. B: the bare ground under it all (R, except under a
// deck over water, where it stays on the river bed: the base ground does not come up with the bridge).
//
// Data, little-endian, sections each preceded by a uint32 length (base64 in TERRAIN_DATA.b64):
//   [0]      the `top`-spaced (64 m) nodes, uint16: height = base + n * q
//   [1..10]  for each halving, two sections: run lengths (varints; runs of "not stored" and "stored" alternately,
//            starting with not stored) over the new nodes in the order (half way along x; half way along z; half way
//            along the diagonal), each group row by row; then one int8 per stored node (or -128 and an int16): the
//            node's lattice index minus that of the mean of its two parents
//   [11]     the water field: (run length, level number) varint pairs over all nodes row by row; 0 = no water level
//   [12]     the levels, uint16 lattice indices
//   [13]     where B is not R: (skip, take) varint pairs over all nodes row by row
//   [14]     B at the taken nodes, uint16 lattice indices
const bytesOf = (b64) => {
  if (typeof Buffer !== 'undefined') { const b = Buffer.from(b64, 'base64'); return new Uint8Array(b.buffer, b.byteOffset, b.length); }
  const s = atob(b64), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
};

/** Rebuild the field from its stored form. Returns { x0, z0, g, nx, nz, R, W (Float32Array, row by row), datum, ms }. */
export function decodeField(D) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const U = bytesOf(D.b64), dv = new DataView(U.buffer, U.byteOffset, U.byteLength);
  const secs = []; for (let o = 0; o < U.length;) { const n = dv.getUint32(o, true); secs.push([o + 4, n]); o += 4 + n; }
  const { nx, nz, top, q, base } = D;
  const H = new Float64Array(nx * nz);
  { let o = secs[0][0]; for (let j = 0; j < nz; j += top) for (let i = 0; i < nx; i += top, o += 2) H[j * nx + i] = base + dv.getUint16(o, true) * q; }
  let si = 1;
  const I8 = new Int8Array(U.buffer, U.byteOffset, U.byteLength);
  for (let s = top >> 1; s >= 1; s >>= 1) {
    const S = s * 2, sn = s * nx;
    let ro = secs[si][0]; const rEnd = ro + secs[si][1]; let dp = secs[si + 1][0]; si += 2;
    // (three plain loops, one per kind of new node: this runs over three million nodes at start-up)
    let bit = 0, left = 0;
    { let v = 0, sh = 1; for (;;) { const b = U[ro++]; v += (b & 127) * sh; if (b < 128) break; sh *= 128; } left = v; }
    for (let g = 0; g < 3; g++) {
      const j0 = g === 0 ? 0 : s, i0 = g === 1 ? 0 : s, o1 = g === 0 ? -s : g === 1 ? -sn : -sn + s, o2 = -o1;
      for (let j = j0; j < nz; j += S) for (let i = i0, k = j * nx + i0; i < nx; i += S, k += S) {
        while (left === 0 && ro < rEnd) { bit ^= 1; let v = 0, sh = 1; for (;;) { const b = U[ro++]; v += (b & 127) * sh; if (b < 128) break; sh *= 128; } left = v; }
        left--;
        const pred = (H[k + o1] + H[k + o2]) / 2;
        if (!bit) { H[k] = pred; continue; }
        let d = I8[dp++]; if (d === -128) { d = dv.getInt16(dp, true); dp += 2; }
        H[k] = base + (Math.floor((pred - base) / q + 0.5) + d) * q;     // (a division, as the tool does it: the same lattice index to the last bit)
      }
    }
  }
  const R = new Float32Array(H), W = R.slice();
  {
    const lv = []; { const [o, n] = secs[si + 1]; for (let k = 0; k < n; k += 2) lv.push(Math.fround(base + dv.getUint16(o + k, true) * q)); }
    let ro = secs[si][0]; const rEnd = ro + secs[si][1];
    const rv = () => { let v = 0, sh = 0; for (;;) { const b = U[ro++]; v += (b & 127) * 2 ** sh; if (b < 128) return v; sh += 7; } };
    for (let k = 0; ro < rEnd;) { const n = rv(), c = rv(); if (c) W.fill(lv[c - 1], k, k + n); k += n; }
  }
  const B = R.slice();
  if (secs[si + 3]) {
    let ro = secs[si + 2][0]; const rEnd = ro + secs[si + 2][1]; let vp = secs[si + 3][0];
    const rv = () => { let v = 0, sh = 0; for (;;) { const b = U[ro++]; v += (b & 127) * 2 ** sh; if (b < 128) return v; sh += 7; } };
    for (let k = 0; ro < rEnd;) { k += rv(); const n = rv(); for (let e = k + n; k < e; k++, vp += 2) B[k] = Math.fround(base + dv.getUint16(vp, true) * q); }
  }
  return { x0: D.x0, z0: D.z0, g: D.g, nx, nz, R, W, B, datum: D.datum, ms: typeof performance !== 'undefined' ? performance.now() - t0 : 0 };
}

/**
 * The field's working form: sample(A, x, z); minMax(x, z, r) (bounds of R over a square, for culling); edgeDev /
 * faceDev (how far a flat edge / triangle runs off the surface: the subdivision).
 */
export function makeField(F) {
  const { x0, z0, g, nx, nz, R, W, B } = F, inv = 1 / g, um = nx - 1.001, vm = nz - 1.001;
  const sample = (A, x, z) => {
    let u = (x - x0) * inv, v = (z - z0) * inv;
    if (u < 0) u = 0; else if (u > um) u = um;
    if (v < 0) v = 0; else if (v > vm) v = vm;
    const i = u | 0, j = v | 0, fx = u - i, fz = v - j, k = j * nx + i, a = A[k + 1], b = A[k + nx];
    if (fx + fz <= 1) { const c = A[k]; return c + fx * (a - c) + fz * (b - c); }
    const c = A[k + nx + 1]; return c + (1 - fx) * (b - c) + (1 - fz) * (a - c);
  };

  // ---- bounds of R over squares of 64 m, 128 m ... (culling: the top and bottom of a sphere's ground)
  const pyr = [];
  {
    const B = 32; let w = Math.ceil((nx - 1) / B), h = Math.ceil((nz - 1) / B);
    let lo = new Float32Array(w * h).fill(1e9), hi = new Float32Array(w * h).fill(-1e9);
    for (let j = 0; j < nz; j++) {
      const bj0 = Math.min(h - 1, Math.floor(j / B)), bj1 = j % B === 0 && j > 0 ? bj0 - 1 : bj0;
      for (let i = 0; i < nx; i++) {
        const v = R[j * nx + i], bi0 = Math.min(w - 1, Math.floor(i / B)), bi1 = i % B === 0 && i > 0 ? bi0 - 1 : bi0;
        for (let bj = bj1; bj <= bj0; bj++) for (let bi = bi1; bi <= bi0; bi++) { const k = bj * w + bi; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
      }
    }
    pyr.push({ size: B * g, w, h, lo, hi });
    while (w > 1 || h > 1) {
      const w2 = Math.ceil(w / 2), h2 = Math.ceil(h / 2), lo2 = new Float32Array(w2 * h2).fill(1e9), hi2 = new Float32Array(w2 * h2).fill(-1e9);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j >> 1) * w2 + (i >> 1), s = j * w + i; if (lo[s] < lo2[k]) lo2[k] = lo[s]; if (hi[s] > hi2[k]) hi2[k] = hi[s]; }
      w = w2; h = h2; lo = lo2; hi = hi2; pyr.push({ size: pyr[pyr.length - 1].size * 2, w, h, lo, hi });
    }
  }
  const mm = [0, 0];
  /** [lowest, highest] of R within r of (x, z) (never too tight; reuses one array) */
  const minMax = (x, z, r) => {
    let L = 0; while (L < pyr.length - 1 && pyr[L].size * 3 < r) L++;      // (squares of a third of the radius or more: at most 7 x 7 of them)
    const P = pyr[L], s = 1 / P.size;
    let i0 = Math.floor((x - r - x0) * s), i1 = Math.floor((x + r - x0) * s), j0 = Math.floor((z - r - z0) * s), j1 = Math.floor((z + r - z0) * s);
    i0 = i0 < 0 ? 0 : i0 >= P.w ? P.w - 1 : i0; i1 = i1 < 0 ? 0 : i1 >= P.w ? P.w - 1 : i1; j0 = j0 < 0 ? 0 : j0 >= P.h ? P.h - 1 : j0; j1 = j1 < 0 ? 0 : j1 >= P.h ? P.h - 1 : j1;
    let lo = 1e9, hi = -1e9;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * P.w + i; if (P.lo[k] < lo) lo = P.lo[k]; if (P.hi[k] > hi) hi = P.hi[k]; }
    mm[0] = lo; mm[1] = hi; return mm;
  };

  /**
   * How far the straight edge from (ax, az) to (ax + dx, az + dz), whose ends stand at ha and hc on field A, runs off
   * the surface: the largest difference at the crossings of the node lines (x, z and diagonal). Between two crossings
   * the surface is straight along the edge, so nothing is missed.
   */
  const edgeDev = (A, ax, az, dx, dz, ha, hc) => {
    const ua = (ax - x0) * inv, va = (az - z0) * inv, du = dx * inv, dv = dz * inv;
    let best = 0;
    for (let fam = 0; fam < 3; fam++) {
      const p = fam === 0 ? ua : fam === 1 ? va : ua + va, d = fam === 0 ? du : fam === 1 ? dv : du + dv;
      if (d === 0) continue;
      const lim = fam === 0 ? nx - 1 : fam === 1 ? nz - 1 : nx + nz - 2;
      let k0 = Math.ceil(Math.min(p, p + d) + 1e-7), k1 = Math.floor(Math.max(p, p + d) - 1e-7);
      if (k0 < 0) k0 = 0; if (k1 > lim) k1 = lim;
      for (let k = k0; k <= k1; k++) {
        const t = (k - p) / d;
        const dev = Math.abs(sample(A, ax + dx * t, az + dz * t) - (ha + (hc - ha) * t));
        if (dev > best) best = dev;
      }
    }
    return best;
  };
  /** the same inside a triangle (corners [x, z] standing at h): the largest difference at a spread of points, and at the nodes inside when it is large */
  const W7 = [1 / 3, 1 / 3, 0.6, 0.2, 0.2, 0.6, 0.2, 0.2, 0.45, 0.45, 0.1, 0.45, 0.45, 0.1];
  const faceDev = (A, x1, z1, x2, z2, x3, z3, h1, h2, h3) => {
    let best = 0;
    for (let q = 0; q < 14; q += 2) { const a = W7[q], b = W7[q + 1], c = 1 - a - b, d = Math.abs(sample(A, x1 * a + x2 * b + x3 * c, z1 * a + z2 * b + z3 * c) - (h1 * a + h2 * b + h3 * c)); if (d > best) best = d; }
    const den = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
    if (Math.abs(den) < 800) return best;            // (under 400 m2: the seven points are enough)
    // a large triangle: every node of a coarser lattice that lies inside it
    const st = Math.abs(den) > 8000 ? 4 : 2;
    let i0 = Math.ceil((Math.min(x1, x2, x3) - x0) * inv / st) * st, i1 = Math.floor((Math.max(x1, x2, x3) - x0) * inv), j0 = Math.ceil((Math.min(z1, z2, z3) - z0) * inv / st) * st, j1 = Math.floor((Math.max(z1, z2, z3) - z0) * inv);
    if (i0 < 0) i0 = 0; if (j0 < 0) j0 = 0; if (i1 > nx - 1) i1 = nx - 1; if (j1 > nz - 1) j1 = nz - 1;
    for (let j = j0; j <= j1; j += st) { const z = z0 + j * g; for (let i = i0; i <= i1; i += st) {
      const x = x0 + i * g, w1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / den, w2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / den, w3 = 1 - w1 - w2;
      if (w1 < 0 || w2 < 0 || w3 < 0) continue;
      const d = Math.abs(A[j * nx + i] - (w1 * h1 + w2 * h2 + w3 * h3)); if (d > best) best = d;
    } }
    return best;
  };

  return { ...F, sample, minMax, edgeDev, faceDev, h: (x, z) => { const a = sample(R, x, z), b = sample(W, x, z); return a > b ? a : b; }, w: (x, z) => sample(W, x, z), b: (x, z) => sample(B, x, z) };
}
