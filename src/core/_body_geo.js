// Shared body geometry for characters.js and the clubbing wardrobe (_wardrobe_geo.js): smooth lofted surfaces (torso,
// hips, skull, hair, hands, shoes) built from small profile tables, so standard and clubbing looks share one body.
// Every builder reads the build context CTX (hi = near-camera detail tier, fig = 'm' | 'f', s = height scale) that
// characters.js sets before it runs a segment builder. Kit K = { THREE, CTX, shade, mix, TAGS } is passed in.
//
// Frames: the same segment frames as characters.js (origin at the segment's joint, +y up, +z forward, +x the
// character's left). Lengths in metres unless a table says "× R" (head radius), "× s" (height / 1.75) or "× b" (build).

export function makeBody(K) {
  const { THREE, CTX, shade, mix, TAGS } = K;
  const PI = Math.PI, TAU = PI * 2;
  const _c = new THREE.Color();
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const spow = (v, e) => (v < 0 ? -Math.pow(-v, e) : Math.pow(v, e));
  const bump = (u, c, w) => { const d = (u - c) / w; return d <= -1 || d >= 1 ? 0 : (1 - d * d) * (1 - d * d); };
  const hash = (a, b = 0, c = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };

  // ---------------------------------------------------------------------------------------------- surfaces
  /** grid normals: N[r][c] from central differences of P[r][c] = [x, y, z] (rows ascending, columns turning from +z to +x) */
  function gridNormals(P, wrap, flip) {
    const nr = P.length, nc = P[0].length, N = [];
    let cx = 0, cy = 0, cz = 0;
    for (const row of P) for (const q of row) { cx += q[0]; cy += q[1]; cz += q[2]; }
    cx /= nr * nc; cy /= nr * nc; cz /= nr * nc;
    for (let r = 0; r < nr; r++) {
      const row = [];
      for (let c = 0; c < nc; c++) {
        const a = P[r][wrap ? (c + nc - 1) % nc : Math.max(c - 1, 0)], b = P[r][wrap ? (c + 1) % nc : Math.min(c + 1, nc - 1)];
        const d = P[Math.max(r - 1, 0)][c], u = P[Math.min(r + 1, nr - 1)][c];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = u[0] - d[0], vy = u[1] - d[1], vz = u[2] - d[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
        if (l < 1e-9) { nx = P[r][c][0] - cx; ny = P[r][c][1] - cy; nz = P[r][c][2] - cz; l = Math.hypot(nx, ny, nz) || 1; if (flip) l = -l; }
        if (flip) l = -l;
        row.push([nx / l, ny / l, nz / l]);
      }
      N.push(row);
    }
    return N;
  }
  /** smooth indexed surface with per-vertex colours. col(r, c) → hex. o: {wrap, flip, double (inner shade factor), gain(r, c)} */
  function surfV(g, P, col, o = {}) {
    const nr = P.length, nc = P[0].length, wrap = !!o.wrap, flip = !!o.flip, N = gridNormals(P, wrap, flip);
    for (let pass = 0; pass < (o.double ? 2 : 1); pass++) {
      const base = g.p.length / 3, k = pass ? -1 : 1, f = pass ? o.double : 1;
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
        _c.setHex(col(r, c)); const gn = (o.gain ? o.gain(r, c) : 1) * f, q = P[r][c], n = N[r][c];
        g.vert(q[0], q[1], q[2], n[0] * k, n[1] * k, n[2] * k, _c.r * gn, _c.g * gn, _c.b * gn);
      }
      const cols = wrap ? nc : nc - 1;
      for (let r = 0; r < nr - 1; r++) for (let c = 0; c < cols; c++) {
        const a = base + r * nc + c, b = base + r * nc + (c + 1) % nc, d = a + nc, e = b + nc;
        if (flip !== !!pass) g.i.push(a, e, b, a, d, e); else g.i.push(a, b, e, a, e, d);
      }
    }
  }
  /** closed tube / blob from rings [y, hw, hd, zc, xc?] (ascending y) with nc columns and superellipse exponent e; ends are closed with points */
  function blob(g, rings, nc, e, col, o = {}) {
    const P = [];
    const first = rings[0], last = rings[rings.length - 1];
    const pole = (q) => { const row = []; for (let c = 0; c < nc; c++) row.push([q[4] || 0, q[0], q[3] || 0]); return row; };
    if (!o.openBot) P.push(pole(first));
    for (const q of rings) {
      const row = [];
      for (let c = 0; c < nc; c++) { const ph = (c / nc) * TAU; row.push([(q[4] || 0) + q[1] * spow(Math.sin(ph), e), q[0], (q[3] || 0) + q[2] * spow(Math.cos(ph), e)]); }
      P.push(row);
    }
    if (!o.openTop) P.push(pole(last));
    surfV(g, P, typeof col === 'function' ? col : () => col, { wrap: true, ...o });
    return P;
  }
  /** blob along another axis: build with `blob` in a temp frame then map (x, y, z) through fn */
  function mapFrom(g, n0, fn) {
    for (let k = n0 * 3; k < g.p.length; k += 3) {
      const q = fn(g.p[k], g.p[k + 1], g.p[k + 2]), m = fn(g.n[k], g.n[k + 1], g.n[k + 2], true);
      g.p[k] = q[0]; g.p[k + 1] = q[1]; g.p[k + 2] = q[2]; g.n[k] = m[0]; g.n[k + 1] = m[1]; g.n[k + 2] = m[2];
    }
  }

  // ---------------------------------------------------------------------------------------------- torso + hips
  // torso profile keys [Y (× s above the waist joint), width, depth (× b), centre z (× b)]
  const TK = {
    m: [[0, 0.3, 0.202, 0], [0.1, 0.296, 0.202, 0.002], [0.22, 0.326, 0.22, 0.004], [0.33, 0.36, 0.236, 0.004], [0.405, 0.374, 0.212, -0.002], [0.45, 0.318, 0.168, -0.006], [0.48, 0.21, 0.136, -0.006]],
    f: [[0, 0.288, 0.19, 0], [0.09, 0.256, 0.174, 0.002], [0.2, 0.286, 0.196, 0.004], [0.315, 0.318, 0.218, 0.006], [0.4, 0.336, 0.192, -0.002], [0.45, 0.286, 0.154, -0.006], [0.48, 0.188, 0.124, -0.006]],
  };
  const TE = 0.74;      // cross-section superellipse exponent (1 = ellipse, smaller = squarer)
  const _pf = [0, 0, 0, 0];
  function keyAt(T, Y, out) {
    if (Y <= T[0][0]) { out[0] = Y; out[1] = T[0][1]; out[2] = T[0][2]; out[3] = T[0][3]; return out; }
    for (let i = 1; i < T.length; i++) if (Y <= T[i][0] + 1e-9) {
      const a = T[i - 1], b = T[i], t = sm(0, 1, (Y - a[0]) / (b[0] - a[0]));
      out[0] = Y; out[1] = lerp(a[1], b[1], t); out[2] = lerp(a[2], b[2], t); out[3] = lerp(a[3], b[3], t); return out;
    }
    const z = T[T.length - 1]; out[0] = Y; out[1] = z[1]; out[2] = z[2]; out[3] = z[3]; return out;
  }
  /** torso profile at height Y (× s): [Y, width, depth, centre z] (× b) */
  function prof(Y, fig = CTX.fig) { return keyAt(TK[fig] || TK.m, Y, _pf); }
  /** extra forward swell of the front (× b): chest / bust */
  function swell(Y, cosph, fig = CTX.fig, b = 1) {
    if (cosph <= 0) return 0;
    const belly = b > 1.06 ? 0.085 * sm(1.06, 1.35, b) * bump(Y, 0.1, 0.24) * cosph : 0;      // heavier builds carry it in front
    return belly + (fig === 'f' ? 0.03 * bump(Y, 0.305, 0.1) * cosph * cosph : 0.01 * bump(Y, 0.33, 0.1) * cosph);
  }
  /** torso surface point at (Y, ph) → out [x, y, z] in metres */
  function torsoPt(p, Y, ph, out) {
    const q = prof(Y), hw = (q[1] / 2) * p.b, hd = (q[2] / 2) * p.b, cp = Math.cos(ph);
    out[0] = hw * spow(Math.sin(ph), TE); out[1] = Y * p.s; out[2] = (q[3] + swell(Y, cp, CTX.fig, p.b)) * p.b + hd * spow(cp, TE);
    return out;
  }
  /** front surface z at height Y (× s) and lateral x (m) */
  function frontZ(p, Y, x = 0) {
    const q = prof(Y), hw = (q[1] / 2) * p.b, hd = (q[2] / 2) * p.b;
    const u = clamp(Math.abs(x) / hw, 0, 0.985), cp = Math.sqrt(Math.max(0, 1 - Math.pow(u, 2 / TE)));
    return (q[3] + swell(Y, cp, CTX.fig, p.b)) * p.b + hd * Math.pow(cp, TE);
  }
  /** back surface z (negative) */
  function backZ(p, Y, x = 0) {
    const q = prof(Y), hw = (q[1] / 2) * p.b, hd = (q[2] / 2) * p.b;
    const u = clamp(Math.abs(x) / hw, 0, 0.985), cp = Math.sqrt(Math.max(0, 1 - Math.pow(u, 2 / TE)));
    return q[3] * p.b - hd * Math.pow(cp, TE);
  }
  /** half width of the torso at Y */
  const halfW = (p, Y) => (prof(Y)[1] / 2) * p.b;
  const TOP_Y = 0.48;
  const YS_HI = []; for (let r = 0; r <= 20; r++) YS_HI.push(r * 0.024);
  const YS_LO = [0, 0.1, 0.22, 0.33, 0.405, 0.45, 0.48];
  /** a band lying on the torso between heights Y0 < Y1 (× s), `grow` metres proud of it; col(c) → hex */
  function torsoRing(g, p, Y0, Y1, grow, col) {
    const n = CTX.hi ? 16 : 8, P = [[], []], q = [0, 0, 0];
    for (let r = 0; r < 2; r++) for (let c = 0; c < n; c++) {
      const ph = ((c - 0.5) / n) * TAU; torsoPt(p, r ? Y1 : Y0, ph, q);
      const l = Math.hypot(q[0], q[2]) || 1; P[r].push([q[0] * (1 + grow / l), q[1], q[2] * (1 + grow / l)]);
    }
    surfV(g, P, (r, c) => col(c), { wrap: true });
  }
  /**
   * The torso as coloured cells. cell(Y, ph, ri, ci) → hex colour of the cell centred there (ph in −π..π, 0 = front);
   * it may set api.G (vertex-colour gain) first. Cells straddling a colour edge are split 3×3 in the rich tier, so
   * necklines / hems / armholes read as lines. Smooth normals throughout. Returns {NR, NC, DY}.
   */
  const api = { G: 1 };
  /** cloth / body shading baked into the torso's vertex colours: flanks and under the arms in shade, the waist tucked, a lit chest */
  function torsoTone(Y, ph) {
    const lat = Math.sin(ph), fr = Math.cos(ph);
    return 1.03 - 0.16 * lat * lat * sm(0.45, 0.22, Y) - 0.07 * sm(0.1, 0, Y) + (fr > 0 ? 0.06 * fr * bump(Y, 0.36, 0.14) : -0.04 * bump(Y, 0.2, 0.2) * fr * fr);
  }
  function torsoCells(g, p, cell, fine = false) {
    const hi = CTX.hi || fine, YS = hi ? YS_HI : YS_LO, NR = YS.length - 1, NC = hi ? 16 : 8, DY = TOP_Y / NR;
    const P = [];
    for (let r = 0; r <= NR; r++) { const row = []; for (let i = 0; i < NC; i++) row.push(torsoPt(p, YS[r], ((i - 0.5) / NC) * TAU, [0, 0, 0])); P.push(row); }
    const N = gridNormals(P, true, false);
    const SN = CTX.hi ? 3 : 2;       // cells the edge-cutter cannot resolve are split 3×3 (rich) or 2×2 (lean)
    const wrapPh = (x) => (x > PI ? x - TAU : x);
    let pa, pb, pc, pd, na, nb, nc, nd, r0 = 0, i0 = 0, kc = 0, kg = 1;
    const q3 = [0, 0, 0], n3 = [0, 0, 0];
    const bil = (a, b, c, d, u, v, o) => { for (let k = 0; k < 3; k++) o[k] = (a[k] * (1 - u) + b[k] * u) * (1 - v) + (d[k] * (1 - u) + c[k] * u) * v; return o; };
    const Yof = (v) => lerp(YS[r0], YS[r0 + 1], v), phOf = (u) => wrapPh(((i0 - 0.5 + u) / NC) * TAU);
    /** sample the garment at (u, v) of the current cell → kc (colour), kg (gain) */
    const smp = (u, v) => { api.G = 1; kc = cell(Yof(clamp(v, 0.02, 0.98)), phOf(clamp(u, 0.02, 0.98)), r0, i0); kg = api.G; };
    /** a convex piece of the current cell: pts = [u, v, u, v, …], one flat colour, shaded per vertex */
    const piece = (pts, col, gain) => {
      _c.setHex(col); const base = g.p.length / 3, n = pts.length / 2;
      for (let k = 0; k < n; k++) {
        const u = pts[k * 2], v = pts[k * 2 + 1]; bil(pa, pb, pc, pd, u, v, q3); bil(na, nb, nc, nd, u, v, n3);
        const l = Math.hypot(n3[0], n3[1], n3[2]) || 1, t = gain * torsoTone(Yof(v), phOf(u));
        g.vert(q3[0], q3[1], q3[2], n3[0] / l, n3[1] / l, n3[2] / l, _c.r * t, _c.g * t, _c.b * t);
      }
      for (let k = 1; k < n - 1; k++) g.i.push(base, base + k, base + k + 1);
    };
    /** where the colour changes along the edge (u0, v0) → (u1, v1), by bisection (0..1 from the first point) */
    const cross = (u0, v0, u1, v1, c0, g0) => {
      let a = 0, b = 1;
      for (let k = 0; k < 7; k++) { const m = (a + b) / 2; smp(lerp(u0, u1, m), lerp(v0, v1, m)); if (kc === c0 && kg === g0) a = m; else b = m; }
      return (a + b) / 2;
    };
    const CU = [0, 1, 1, 0], CV = [0, 0, 1, 1], cc = [0, 0, 0, 0], cg = [1, 1, 1, 1];
    const split = () => {
      for (let k = 0; k < SN * SN; k++) {
        const u0 = (k % SN) / SN, u1 = u0 + 1 / SN, v0 = Math.floor(k / SN) / SN, v1 = v0 + 1 / SN;
        smp((u0 + u1) / 2, (v0 + v1) / 2); piece([u0, v0, u1, v0, u1, v1, u0, v1], kc, kg);
      }
    };
    for (let r = 0; r < NR; r++) for (let i = 0; i < NC; i++) {
      const i1 = (i + 1) % NC; r0 = r; i0 = i;
      pa = P[r][i]; pb = P[r][i1]; pc = P[r + 1][i1]; pd = P[r + 1][i]; na = N[r][i]; nb = N[r][i1]; nc = N[r + 1][i1]; nd = N[r + 1][i];
      if (!hi) { api.G = 1; const col = cell((YS[r] + YS[r + 1]) / 2, wrapPh((i / NC) * TAU), r, i); piece([0, 0, 1, 0, 1, 1, 0, 1], col, api.G); continue; }
      let same = 0; for (let k = 0; k < 4; k++) { smp(CU[k], CV[k]); cc[k] = kc; cg[k] = kg; if (k && kc === cc[0] && kg === cg[0]) same++; }
      smp(0.5, 0.5); const mc = kc, mg = kg, eq = (a, b) => cc[a] === cc[b] && cg[a] === cg[b];
      if (same === 3) { if (mc === cc[0] && mg === cg[0]) piece([0, 0, 1, 0, 1, 1, 0, 1], mc, mg); else split(); continue; }
      // one corner differs from the other three: cut it off along a straight edge
      let odd = -1;
      for (let k = 0; k < 4; k++) { const a = (k + 1) % 4, b = (k + 2) % 4, c = (k + 3) % 4; if (!eq(k, a) && eq(a, b) && eq(b, c)) odd = k; }
      if (odd >= 0) {
        const nx = (odd + 1) % 4, pv = (odd + 3) % 4, op = (odd + 2) % 4;
        const t1 = cross(CU[odd], CV[odd], CU[nx], CV[nx], cc[odd], cg[odd]), t2 = cross(CU[odd], CV[odd], CU[pv], CV[pv], cc[odd], cg[odd]);
        const e1u = lerp(CU[odd], CU[nx], t1), e1v = lerp(CV[odd], CV[nx], t1), e2u = lerp(CU[odd], CU[pv], t2), e2v = lerp(CV[odd], CV[pv], t2);
        piece([CU[odd], CV[odd], e1u, e1v, e2u, e2v], cc[odd], cg[odd]);
        piece([e1u, e1v, CU[nx], CV[nx], CU[op], CV[op], CU[pv], CV[pv], e2u, e2v], cc[nx], cg[nx]);
        continue;
      }
      // two neighbouring corners against the other two: one straight cut across the cell
      let k0 = -1; for (let k = 0; k < 4; k++) { const a = (k + 1) % 4, b = (k + 2) % 4, c = (k + 3) % 4; if (eq(k, a) && eq(b, c) && !eq(a, b)) k0 = k; }
      if (k0 >= 0) {
        const a = (k0 + 1) % 4, b = (k0 + 2) % 4, c = (k0 + 3) % 4;
        const t1 = cross(CU[a], CV[a], CU[b], CV[b], cc[a], cg[a]), t2 = cross(CU[k0], CV[k0], CU[c], CV[c], cc[k0], cg[k0]);
        const e1u = lerp(CU[a], CU[b], t1), e1v = lerp(CV[a], CV[b], t1), e2u = lerp(CU[k0], CU[c], t2), e2v = lerp(CV[k0], CV[c], t2);
        piece([CU[k0], CV[k0], CU[a], CV[a], e1u, e1v, e2u, e2v], cc[k0], cg[k0]);
        piece([e2u, e2v, e1u, e1v, CU[b], CV[b], CU[c], CV[c]], cc[b], cg[b]);
        continue;
      }
      split();
    }
    // shoulder cap: a fan up to the base of the neck
    const top = P[NR], cy = TOP_Y * p.s + 0.006;
    for (let i = 0; i < NC; i++) {
      api.G = 1; const col = cell(TOP_Y + 0.01, wrapPh((i / NC) * TAU), NR, i);
      _c.setHex(col); const a = top[i], b = top[(i + 1) % NC], base = g.p.length / 3, G = api.G;
      g.vert(a[0], a[1], a[2], N[NR][i][0] * 0.5, 0.85, N[NR][i][2] * 0.5, _c.r * G, _c.g * G, _c.b * G);
      g.vert(b[0], b[1], b[2], N[NR][(i + 1) % NC][0] * 0.5, 0.85, N[NR][(i + 1) % NC][2] * 0.5, _c.r * G, _c.g * G, _c.b * G);
      g.vert(0, cy, -0.004, 0, 1, 0, _c.r * G, _c.g * G, _c.b * G);
      g.i.push(base, base + 1, base + 2);
    }
    return { NR, NC, DY };
  }

  // hips: rings [y (× s from the hip joint), half width, half depth, centre z (× b)]
  const PK = {
    m: [[-0.085, 0.06, 0.06, 0], [-0.06, 0.156, 0.108, -0.004], [-0.02, 0.166, 0.115, -0.006], [0.04, 0.159, 0.108, -0.002], [0.095, 0.151, 0.102, 0]],
    f: [[-0.085, 0.06, 0.06, 0], [-0.06, 0.166, 0.11, -0.006], [-0.02, 0.176, 0.118, -0.009], [0.04, 0.162, 0.108, -0.003], [0.095, 0.145, 0.096, 0]],
  };
  const PE = 0.72;
  /** hips surface; col(r, c, y × s) → hex */
  function pelvis(g, p, col, grow = 0) {
    const T = PK[CTX.fig] || PK.m, hi = CTX.hi, nc = hi ? 14 : 8;
    const rings = (hi ? T : [T[1], T[2], T[4]]).map((q) => [q[0] * p.s, (q[1] + (q[1] > 0.07 ? grow : 0)) * p.b, (q[2] + (q[2] > 0.07 ? grow : 0)) * p.b, q[3] * p.b]);
    blob(g, rings, nc, PE, (r, c) => col(r, c), { openTop: !hi });
  }
  /** hip half extents at y (× s): [half width, half depth, zc] in metres */
  function hipAt(p, y) {
    const T = PK[CTX.fig] || PK.m; let a = T[0], b = T[T.length - 1];
    for (let i = 1; i < T.length; i++) if (y <= T[i][0]) { a = T[i - 1]; b = T[i]; break; } else a = b = T[i];
    const t = a === b ? 0 : clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    return [lerp(a[1], b[1], t) * p.b, lerp(a[2], b[2], t) * p.b, lerp(a[3], b[3], t) * p.b];
  }

  // ---------------------------------------------------------------------------------------------- head
  // skull rings [yy, half width, half depth, centre z] × R, yy measured from the head centre (hc above the neck joint)
  const HK = [[-1.03, 0.2, 0.2, 0.45], [-0.92, 0.47, 0.37, 0.365], [-0.66, 0.685, 0.585, 0.235], [-0.38, 0.8, 0.775, 0.075], [-0.08, 0.86, 0.9, -0.04],
    [0.22, 0.89, 0.945, -0.07], [0.52, 0.86, 0.91, -0.085], [0.78, 0.7, 0.75, -0.095], [0.96, 0.42, 0.45, -0.1]];
  const HE = 0.9;
  const _hk = [0, 0, 0, 0];
  /** skull half width / half depth / centre z (× R) at yy, for a face shape F = {jaw, chin, cheek} */
  function skull(yy, F) {
    const q = keyAt(HK, yy, _hk);
    if (yy < -0.2) { const t = sm(-0.2, -0.7, yy); q[1] *= lerp(1, F.jaw, t); }
    else q[1] *= lerp(1, F.cheek, bump(yy, -0.08, 0.5));
    return q;
  }
  function faceShape(p) {
    const f = p.fig === 'f', v = (p.fv | 0) % 5;
    const F = { jaw: (f ? 0.93 : 1.05) * [1, 1.04, 0.96, 1.02, 0.98][v], chin: [1, 1.03, 0.98, 1.05, 0.97][v], cheek: [1, 0.98, 1.02, 1.0, 1.03][v],
      nose: (f ? 0.84 : 1) * [1, 1.14, 0.9, 1.06, 0.95][v], eye: (f ? 1.08 : 1) * [1, 0.95, 1.05, 1, 0.97][v], lip: (f ? 1.2 : 1) * [1, 0.92, 1.08, 1.04, 0.96][v] };
    // look.faceW (optional, default 1): a broader, rounder lower face — wider jaw and fuller cheeks (thick-set features)
    if (p.faceW) { F.jaw *= p.faceW; F.cheek *= 1 + (p.faceW - 1) * 0.6; F.chin *= 1 - (p.faceW - 1) * 0.35; }
    return F;
  }
  /** face surface z (m) at height yy (× R) and lateral x (m): the smooth skull, without the modelled features */
  function faceZ(R, yy, x, F) {
    const q = skull(yy, F), u = clamp(Math.abs(x) / (q[1] * R), 0, 0.985);
    return (q[3] + q[2] * Math.pow(Math.sqrt(Math.max(0, 1 - Math.pow(u, 2 / HE))), HE)) * R;
  }
  const EYES = [0x4a2e18, 0x3a2414, 0x5a3a1e, 0x4a6a8a, 0x5a7a5a, 0x6a5a3a, 0x3a5a7a, 0x2e1c10];
  function eyeColour(p) {
    _c.setHex(p.skin); const lum = _c.r * 0.3 + _c.g * 0.59 + _c.b * 0.11; _c.setHex(p.hair); const hl = _c.r * 0.3 + _c.g * 0.59 + _c.b * 0.11;
    if (lum < 0.3 || hl < 0.012) return EYES[((p.fv | 0) % 3 === 0) ? 7 : 1];
    return EYES[(p.fv | 0) % EYES.length];
  }
  // The head is one sculpted grid: 11 columns across the face (dense round the nose and eyes), 5 coarser ones round the
  // back, rows at the chin, mouth, under the nose, nose tip, cheekbone, eye line and brow. FD pushes the grid's vertices
  // in / out (× R) to model the nose with its bridge and tip, eye sockets, brow ridge, cheekbones, lips and chin; FT
  // tints them (shadow under the nose and in the sockets, a flush on the cheeks). Eyes, lids, brows, lips and ears are
  // small flat pieces laid on that surface. The scalp under a hair shell is left out.
  const FANG = [0, 5.4, 10, 31, 52, 80, 112, 148, 180, -148, -112, -80, -52, -31, -10, -5.4].map((d) => (d * PI) / 180);
  const FROWS = [-0.88, -0.56, -0.42, -0.31, -0.1, 0.11, 0.3];
  const FD = [      // [k = 0 centre … 5 the seam in front of the ear]
    [0.05, 0.045, 0.035, 0.0, -0.02, 0],          // chin
    [0.03, 0.028, 0.02, -0.012, -0.015, 0],       // mouth
    [0.045, 0.028, 0.004, -0.012, -0.012, 0],     // under the nose
    [0.19, 0.105, 0.0, 0.0, 0.008, 0],            // nose tip, nostril wings
    [0.1, 0.05, -0.012, 0.008, 0.03, 0],         // bridge, under-eye, cheekbone
    [0.03, 0.0, -0.036, -0.042, 0.0, 0],          // root of the nose, eye sockets
    [0.02, 0.022, 0.03, 0.022, 0.004, 0],         // brow ridge
  ];
  const FT = [      // vertex tone: shade factor (+ cheek flush in FB)
    [0.95, 0.95, 0.95, 0.95, 0.94, 0.93], [1, 1, 0.985, 0.98, 0.975, 0.97], [0.93, 0.94, 0.975, 0.99, 0.99, 0.98], [1.035, 0.96, 0.98, 1, 1, 0.99],
    [1.03, 0.99, 0.93, 0.95, 1.01, 1], [0.97, 0.93, 0.88, 0.9, 0.97, 1], [1.01, 1.0, 0.97, 0.98, 1.01, 1.01],
  ];
  const FB = [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0.2, 0.3, 0], [0, 0, 0.1, 0.5, 0.7, 0.1], [0.5, 0.3, 0.2, 0.8, 1, 0.2], [0.1, 0, 0.1, 0.5, 0.7, 0.1], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
  // beard coverage of the grid's vertices by row (chin … eye line) and column k; the back columns take BRD_BACK
  const BRD = {
    full: [[1, 1, 1, 1, 1, 0.95], [0.9, 0.9, 1, 1, 1, 1], [0.3, 0.75, 0.8, 0.6, 0.92, 1], [0, 0, 0, 0.05, 0.45, 0.95], [0, 0, 0, 0, 0.08, 0.75], [0, 0, 0, 0, 0, 0.45]],
    goatee: [[1, 1, 1, 0.45, 0, 0], [0.85, 0.95, 1, 0.3, 0, 0], [0.2, 0.6, 0.7, 0.1, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]],
    moustache: [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0.25, 0.6, 0.6, 0.05, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]],
  };
  BRD.long = BRD.full; BRD.stubble = BRD.full;
  const BRD_BACK = [0.55, 0.3];        // k = 6 on the chin and mouth rows (under the ear, fading into the neck)
  /** where the eyelid and jaw bones pivot (head frame), for characters.js */
  function facePivots(R, hc, fig) { const k = R / 0.112; return { lidY: hc + 0.11 * R + 0.0106 * k * (fig === 'f' ? 1.08 : 1) * 1.05 + 0.0012, jawY: hc - 0.56 * R, jawZ: R * 0.3 }; }

  /** neck, sculpted skull + face, ears, eyes with lids on the LID bone, brows, lips (the lower one and the chin on the JAW bone), stubble / beard */
  function head(g, p) {
    const { s } = p, R = p.headR, hc = p.headC, skin = p.skin, hi = CTX.hi, f = p.fig === 'f', F = faceShape(p), k = R / 0.112;
    const b = p.b || 1, nb = 0.5 + 0.5 * b, sd = (p.fv | 0) * 1.7 + 0.3, sml = p.smile ? clamp(+p.smile, 0, 1) : 0;
    // neck (SOFT: its base stays with the torso when the head turns), a touch darker than the face: it sits in the chin's shade
    g.limb((f ? 0.044 : 0.052) * nb, (f ? 0.05 : 0.06) * nb, 0.14 * s, shade(skin, 0.93), 0, 0.095 * s, f ? 0 : 0.003);
    const beard = p.beard, HS = styleOf(p), crop = HS && HS.tint ? mix(p.hair, skin, HS.tint) : null;
    const BM = beard ? BRD[beard] || null : null, stub = beard === 'stubble';
    const bcol = stub ? mix(p.hair, skin, 0.5) : mix(p.hair, skin, 0.1), bth = beard === 'long' ? 0.085 : beard === 'full' ? 0.05 : beard === 'goatee' ? 0.04 : 0;
    // rows: the face rows, then either the hairline row (the scalp above is under the hair shell) or the whole crown
    let maxLine = -1; if (HS && !HS.tint && HS.front < 5) for (let i = 0; i < 16; i++) maxLine = Math.max(maxLine, hairLine(HS, FANG[i]));
    const covered = !!p.cover && maxLine > 0 && maxLine < 0.76, under = p.cover ? 0.93 : 1;
    const rows = FROWS.concat(covered ? [clamp(maxLine + 0.07, 0.5, 0.82)] : [0.62, 0.9]), nr = rows.length;
    const coarse = rows.map((y, r) => r === 0 || r === 1 || r === 3 || (r === 4 && covered) || r === 5 || r >= 7);      // (rows the back of the head has too)
    const kOf = (c) => (c <= 8 ? c : 16 - c);
    const P = [], T = [];
    for (let r = 0; r < nr; r++) {
      const yy = rows[r], q = skull(yy, F), u = yy > 0.4 ? under : 1, hw = q[1] * R * u, hd = q[2] * R * u, zc = q[3] * R, row = [], trow = [];
      for (let c = 0; c < 16; c++) {
        const kk = kOf(c), ph = FANG[c], sn = Math.sin(ph), cs = Math.cos(ph);
        let d = r < 7 && kk <= 5 ? FD[r][kk] : 0;
        if (r === 3 || (r === 4 && kk < 2) || (r === 2 && kk < 2)) d *= F.nose;
        if (f && r === 6) d *= 0.4; if (f && r === 0 && kk < 3) d *= 0.75;
        if (r === 1 && kk < 2) d *= F.lip;
        if (sml && (r === 1 || r === 2) && kk >= 2 && kk <= 4) d += sml * [0.014, 0.034, 0.022][kk - 2] * (r === 2 ? 1 : 0.75);      // look.smile: cheeks lifted and rounded
        const am = BM && r < 6 ? (kk <= 5 ? BM[r][kk] : kk === 6 && r < 2 && BM === BRD.full ? BRD_BACK[r] : 0) : 0;
        d += bth * am * (r === 0 ? 1.2 : 1);
        row.push([hw * spow(sn, HE) + d * R * sn, hc + yy * R * (yy < -0.8 ? F.chin : 1) - (r === 0 ? bth * am * R * 0.5 : 0), zc + hd * spow(cs, HE) + d * R * cs]);
        // tone
        let col = skin;
        if (r < 7 && kk <= 5) { col = shade(skin, FT[r][kk]); const fl = FB[r][kk]; if (fl) col = mix(col, 0xd2604c, fl * (f ? 0.13 : 0.075)); }
        else if (r >= 7) col = shade(skin, 1.015);
        if (crop !== null) { const a = Math.abs(ph); if (yy > hairLine(HS, ph) - 0.11 && (HS.front < 5 || (a >= 0.95 && yy < HS.ring + 0.1))) col = mix(crop, shade(crop, 0.9), hash(c, r, sd)); }
        if (am > 0) col = mix(col, shade(bcol, 0.9 + 0.2 * hash(c, r, sd)), am * (stub ? 0.62 : 1));
        trow.push(col);
      }
      P.push(row); T.push(trow);
    }
    // rows the back of the head skips: their seam (and back) vertices lie on the straight edge between the coarse rows
    for (let r = 1; r < nr - 1; r++) {
      if (coarse[r]) continue;
      let a = r - 1, e = r + 1; while (!coarse[a]) a--; while (!coarse[e]) e++;
      const t = (rows[r] - rows[a]) / (rows[e] - rows[a]);
      for (let c = 5; c <= 11; c++) for (let j = 0; j < 3; j++) P[r][c][j] = lerp(P[a][c][j], P[e][c][j], t);
    }
    const N = gridNormals(P, true, false), idx = [], T0 = g.tag;
    for (let r = 0; r < nr; r++) {
      const ir = [];
      for (let c = 0; c < 16; c++) {
        const kk = kOf(c);
        if (kk > 5 && !coarse[r]) { ir.push(-1); continue; }
        _c.setHex(T[r][c]); const q = P[r][c], n = N[r][c];
        g.tag = r === 0 && kk <= 2 ? TAGS.JAW : T0;
        ir.push(g.vert(q[0], q[1], q[2], n[0], n[1], n[2], _c.r, _c.g, _c.b));
      }
      idx.push(ir);
    }
    g.tag = T0;
    const quad = (ra, rb, c) => { const c1 = (c + 1) % 16, a = idx[ra][c], bb = idx[ra][c1], d = idx[rb][c], e = idx[rb][c1]; if (c < 8) g.i.push(a, bb, e, a, e, d); else g.i.push(a, bb, d, bb, e, d); };
    for (let r = 0; r < nr - 1; r++) for (const c of [11, 12, 13, 14, 15, 0, 1, 2, 3, 4]) quad(r, r + 1, c);
    { let a = 0; for (let r = 1; r < nr; r++) if (coarse[r]) { for (let c = 5; c <= 10; c++) quad(a, r, c); a = r; } }
    {      // under the chin
      const am = BM ? BM[0][0] : 0, col = am ? mix(shade(skin, 0.82), bcol, am * (stub ? 0.6 : 1)) : shade(skin, 0.82);
      _c.setHex(col); const pv = g.vert(0, hc - (1.0 * F.chin + bth * am * 0.9) * R, 0.2 * R, 0, -1, 0.1, _c.r, _c.g, _c.b);
      for (let c = 0; c < 16; c++) g.i.push(pv, idx[0][(c + 1) % 16], idx[0][c]);
    }
    {      // the crown, or a dark lid under the hair shell
      const top = idx[nr - 1], yT = hc + rows[nr - 1] * R;
      if (covered) {
        _c.setHex(shade(p.hair, 0.6)); const b0 = g.p.length / 3;
        for (let c = 0; c < 16; c++) { const q = P[nr - 1][c]; g.vert(q[0], q[1], q[2], 0, 1, 0, _c.r, _c.g, _c.b); }
        const cv = g.vert(0, yT + 0.04 * R, -0.09 * R, 0, 1, 0, _c.r, _c.g, _c.b);
        for (let c = 0; c < 16; c++) g.i.push(b0 + c, b0 + (c + 1) % 16, cv);
      } else {
        _c.setHex(crop !== null && HS.front < 5 ? crop : shade(skin, 1.02)); const pv = g.vert(0, hc + 1.045 * R * under, -0.1 * R, 0, 1, 0, _c.r, _c.g, _c.b);
        for (let c = 0; c < 16; c++) g.i.push(top[c], top[(c + 1) % 16], pv);
      }
    }
    // ---- pieces laid on the face: z of the sculpted surface at (x, y), then a small offset
    const gz = (x, y) => {
      const sx = x < 0 ? -1 : 1; let r = 0; while (r < nr - 2 && y > P[r + 1][0][1]) r++;
      const v = clamp((y - P[r][0][1]) / (P[r + 1][0][1] - P[r][0][1]), 0, 1);
      for (let kk = 0; kk < 5; kk++) {
        const ca = sx > 0 ? kk : (16 - kk) % 16, cb = sx > 0 ? kk + 1 : 15 - kk;
        const xa = lerp(P[r][ca][0], P[r + 1][ca][0], v), xb = lerp(P[r][cb][0], P[r + 1][cb][0], v);
        if (Math.abs(x) <= Math.abs(xb) || kk === 4) { const u = clamp((x - xa) / (xb - xa || 1e-9), 0, 1); return lerp(lerp(P[r][ca][2], P[r + 1][ca][2], v), lerp(P[r][cb][2], P[r + 1][cb][2], v), u); }
      }
      return 0;
    };
    const hw0 = skull(0.1, F)[1] * R;
    const dv = (x, y, off, col, gain = 1) => { _c.setHex(col); const nx = clamp(x / hw0, -0.9, 0.9) * 0.7, nz = Math.sqrt(1 - nx * nx); return g.vert(x, y, gz(x, y) + off, nx, 0, nz, _c.r * gain, _c.g * gain, _c.b * gain); };
    /** convex piece from vertex indices (fan from the first), wound to face +z */
    const fan = (v) => {
      const pa = g.p, A = v[0] * 3, B2 = v[1] * 3, C2 = v[2] * 3;
      const ccw = (pa[B2] - pa[A]) * (pa[C2 + 1] - pa[A + 1]) - (pa[B2 + 1] - pa[A + 1]) * (pa[C2] - pa[A]) > 0;
      for (let i = 1; i < v.length - 1; i++) { if (ccw) g.i.push(v[0], v[i], v[i + 1]); else g.i.push(v[0], v[i + 1], v[i]); }
    };
    // eyes: an almond white (shaded under the lid), an iris darkening to the pupil, a catch-light; the lid is modelled shut
    // and squashed up to a lash line by the LID bone
    const ex = (P[5][2][0] + P[5][3][0]) / 2, ey = hc + 0.11 * R, ea = 0.0182 * k * F.eye, eb = 0.0106 * k * F.eye * (1 - 0.18 * sml), iris = eyeColour(p);
    const lidC = shade(skin, 0.9), lash = f || p.lash ? 0x1a1210 : mix(skin, 0x20140e, 0.6), lidTop = ey + eb * 1.05 + 0.0012;
    const browC = p.hairStyle === 'bald' && p.hair === 0x3b2616 ? 0x5a4632 : mix(p.hair, skin, 0.12);
    for (const sx of [1, -1]) {
      const X = (u) => sx * (ex + u * ea), W = 0xe9e5dc;
      fan([dv(X(-1), ey - 0.0012 * k, 0.0012, shade(W, 0.88)), dv(X(-0.42), ey - eb * 0.82, 0.0012, W), dv(X(0.45), ey - eb * 0.8, 0.0012, W),
        dv(X(1), ey + 0.0016 * k, 0.0012, shade(W, 0.86)), dv(X(0.42), ey + eb, 0.0012, shade(W, 0.82)), dv(X(-0.45), ey + eb * 0.96, 0.0012, shade(W, 0.82))]);
      const ir = 0.0086 * k * F.eye, ix = X(-0.06), iy = ey + 0.0004, ring = [dv(ix, iy, 0.0026, 0x0a0808)];
      for (let j = 0; j <= 6; j++) { const a = (j / 6) * TAU; ring.push(dv(ix + Math.cos(a) * ir * 0.94, iy + Math.sin(a) * ir, 0.0022, shade(iris, 1.15), Math.sin(a) > 0.5 ? 0.6 : 1)); }
      fan(ring);
      fan([dv(ix + sx * -0.0001 + 0.0024 * k, iy + 0.0036 * k, 0.0034, 0xffffff, 1.3), dv(ix + 0.0046 * k, iy + 0.0022 * k, 0.0034, 0xffffff, 1.3), dv(ix + 0.0026 * k, iy + 0.0012 * k, 0.0034, 0xffffff, 1.3)]);
      g.tag = TAGS.LID;
      fan([dv(X(-1.1), ey - eb * 0.95, 0.0042, lash), dv(X(1.12), ey - eb * 0.8, 0.0042, lash), dv(X(1.14), lidTop, 0.0042, lidC), dv(X(-1.08), lidTop, 0.0042, lidC)]);
      g.tag = T0;
      // brow: a tapering arch on the ridge
      const by = ey + eb + (f ? 0.0125 : 0.0098) * k, bt = (f ? 0.0038 : 0.0064) * k * (1 + 0.12 * Math.sin(sd * 3)), tl = p.brow * 0.03 - (sml ? 0.004 * sml : 0);      // (a grin lifts the inner brows)
      const b0 = dv(X(-1.12), by - tl - bt * 0.5, 0.0024, browC), b1 = dv(X(-1.2), by - tl + bt * 0.5, 0.0024, browC);
      const b2 = dv(X(0.25), by + 0.0032 * k + bt * 0.5, 0.0024, browC), b3 = dv(X(0.2), by + 0.003 * k - bt * 0.45, 0.0024, browC);
      const b4 = dv(X(1.42), by - 0.0012 * k + tl * 0.4, 0.0024, shade(browC, 1.08));
      fan([b0, b3, b2, b1]); fan([b3, b4, b2]);
    }
    // mouth: a dark line that opens with the jaw, the upper lip with its bow, the fuller lower lip on the JAW bone
    const my = hc - 0.56 * R, mw = 0.0255 * k * (f ? 0.92 : 1) * (1 + 0.75 * sml), lh = 1.3 * k * F.lip;
    const lip = p.lip !== undefined ? p.lip : mix(skin, f ? 0x9a3038 : 0x7a3430, f ? 0.5 : 0.3);
    if (sml) {
      // look.smile 0..1: a broad open grin — wide mouth, corners turned up, upper teeth showing, the lower lip dropped a little
      const cu = 0.0085 * k * sml, gp = 0.0052 * k * sml;
      const i0 = dv(-mw * 0.88, my + cu * 0.9, 0.0006, 0x35120f), i1 = dv(mw * 0.88, my + cu * 0.9, 0.0006, 0x35120f);
      g.tag = TAGS.JAW; const i2 = dv(mw * 0.55, my - 0.0034 * lh - gp, 0.0006, 0x4a1a16), i3 = dv(-mw * 0.55, my - 0.0034 * lh - gp, 0.0006, 0x4a1a16); g.tag = T0;
      fan([i0, i3, i2, i1]);
      const tc = 0xf2ede4;
      fan([dv(0, my + 0.0002, 0.0014, tc), dv(mw * 0.8, my + cu * 0.82, 0.0014, shade(tc, 0.82)), dv(mw * 0.5, my - gp * 0.55 + cu * 0.3, 0.0014, shade(tc, 0.92)),
        dv(0, my - gp * 0.75, 0.0014, shade(tc, 0.96)), dv(-mw * 0.5, my - gp * 0.55 + cu * 0.3, 0.0014, shade(tc, 0.92)), dv(-mw * 0.8, my + cu * 0.82, 0.0014, shade(tc, 0.82))]);
      fan([dv(0, my + 0.0002, 0.0026, shade(lip, 0.9)), dv(mw, my + 0.0016 + cu, 0.0016, shade(lip, 0.8)), dv(mw * 0.3, my + 0.0056 * lh * 0.8, 0.0026, lip), dv(0, my + 0.0044 * lh * 0.8, 0.0026, lip),
        dv(-mw * 0.3, my + 0.0056 * lh * 0.8, 0.0026, lip), dv(-mw, my + 0.0016 + cu, 0.0016, shade(lip, 0.8))]);
      g.tag = TAGS.JAW;
      fan([dv(0, my - 0.0009 - gp, 0.0024, shade(lip, 1.04)), dv(-mw * 0.92, my - 0.0004 + cu, 0.0014, shade(lip, 0.86)), dv(-mw * 0.42, my - 0.0062 * lh - gp, 0.002, shade(lip, 1.1)),
        dv(mw * 0.42, my - 0.0062 * lh - gp, 0.002, shade(lip, 1.1)), dv(mw * 0.92, my - 0.0004 + cu, 0.0014, shade(lip, 0.86))]);
      g.tag = T0;
      // smile creases from the nose wings to the corners
      for (const sx of [1, -1]) fan([dv(sx * mw * 0.95, my + 0.012 * k, 0.0012, shade(skin, 0.86)), dv(sx * mw * 1.12, my + cu * 1.1, 0.0012, shade(skin, 0.84)),
        dv(sx * mw * 1.18, my + cu * 1.15, 0.0012, shade(skin, 0.92)), dv(sx * mw * 1.02, my + 0.013 * k, 0.0012, shade(skin, 0.93))]);
    } else {
      const i0 = dv(-mw * 0.86, my + 0.0008, 0.0006, 0x35120f), i1 = dv(mw * 0.86, my + 0.0008, 0.0006, 0x35120f);
      g.tag = TAGS.JAW; const i2 = dv(mw * 0.7, my - 0.0034 * lh, 0.0006, 0x4a1a16), i3 = dv(-mw * 0.7, my - 0.0034 * lh, 0.0006, 0x4a1a16); g.tag = T0;
      fan([i0, i3, i2, i1]);
      fan([dv(0, my + 0.0002, 0.0026, shade(lip, 0.9)), dv(mw, my + 0.0016, 0.0016, shade(lip, 0.8)), dv(mw * 0.3, my + 0.0056 * lh, 0.0026, lip), dv(0, my + 0.0044 * lh, 0.0026, lip),
        dv(-mw * 0.3, my + 0.0056 * lh, 0.0026, lip), dv(-mw, my + 0.0016, 0.0016, shade(lip, 0.8))]);
      g.tag = TAGS.JAW;
      fan([dv(0, my - 0.0009, 0.0024, shade(lip, 1.04)), dv(-mw * 0.9, my - 0.0006, 0.0014, shade(lip, 0.86)), dv(-mw * 0.42, my - 0.0072 * lh, 0.002, shade(lip, 1.1)), dv(mw * 0.42, my - 0.0072 * lh, 0.002, shade(lip, 1.1)),
        dv(mw * 0.9, my - 0.0006, 0.0014, shade(lip, 0.86))]);
      g.tag = T0;
    }
    if (beard && !stub) for (const sx of [1, -1]) {      // moustache
      const mc = shade(bcol, 0.95), y0 = my + 0.0105 * k;
      fan([dv(sx * 0.0012, y0 + 0.004 * k, 0.004, mc), dv(sx * 0.001, y0 - 0.0035 * k, 0.004, mc), dv(sx * mw * 1.12, y0 - 0.0085 * k, 0.003, shade(mc, 0.9)), dv(sx * mw * 0.75, y0 + 0.002 * k, 0.004, mc)]);
    }
    // ears (left off under hair that covers them)
    if (!(HS && !HS.tint && HS.side < -0.2) && p.hat !== 'hood') {
      const ec = shade(skin, 0.97), ein = mix(shade(skin, 0.72), 0xa04a40, 0.2), q = P[5][5];
      for (const sx of [1, -1]) {
        const x0 = sx * (q[0] - 0.003), y0 = hc + 0.02 * R, z0 = q[2] - 0.06 * R, V3 = (dx, dy, dz, col) => { _c.setHex(col); return g.vert(x0 + sx * dx * R, y0 + dy * R, z0 + dz * R, sx * 0.75, 0, 0.66, _c.r, _c.g, _c.b); };
        const A = V3(0, 0.2, 0.05, ec), Bv = V3(0, -0.24, 0.03, ec), C = V3(0.13, 0.27, -0.1, ec), D = V3(0.17, 0.02, -0.16, ec), E = V3(0.07, -0.27, -0.05, shade(ec, 1.03)), In = V3(0.035, 0.02, -0.03, ein);
        const tri = (a, b2, c) => { if (sx > 0) g.i.push(a, b2, c); else g.i.push(a, c, b2); };
        tri(In, A, C); tri(In, C, D); tri(In, D, E); tri(In, E, Bv); tri(In, Bv, A);
        _c.setHex(shade(skin, 0.85)); const G0 = g.vert(x0 - sx * 0.004, y0, z0 - 0.2 * R, sx * 0.5, 0, -0.86, _c.r, _c.g, _c.b), C2 = g.vert(g.p[C * 3], g.p[C * 3 + 1], g.p[C * 3 + 2], sx * 0.5, 0, -0.86, _c.r, _c.g, _c.b),
          D2 = g.vert(g.p[D * 3], g.p[D * 3 + 1], g.p[D * 3 + 2], sx * 0.5, 0, -0.86, _c.r, _c.g, _c.b), E2 = g.vert(g.p[E * 3], g.p[E * 3 + 1], g.p[E * 3 + 2], sx * 0.5, 0, -0.86, _c.r, _c.g, _c.b);
        tri(G0, D2, C2); tri(G0, E2, D2);
      }
    }
    if (hi) for (const sx of [1, -1]) g.box(0.006 * k, 0.003 * k, 0.003, shade(skin, 0.5), sx * 0.008 * k, hc - 0.4 * R, gz(sx * 0.008 * k, hc - 0.4 * R) + 0.0005);      // nostrils
    // ---- a long beard hangs onto the chest
    if (beard === 'long') {
      const zc = P[0][0][2] - 0.045, bc = p.hair;
      blob(g, [[hc - 0.33 * s, 0.012, 0.01, zc - 0.012], [hc - 0.27 * s, 0.045, 0.026, zc - 0.006], [hc - 0.17 * s, 0.07, 0.04, zc], [hc - 0.11, 0.074, 0.048, zc + 0.002]], hi ? 9 : 6, 1, (r, c) => shade(bc, 0.9 + 0.16 * hash(c, r, 3)), { openTop: true });
    }
    return { F, ex, ey, ez: gz(ex, ey) + 0.036 * R, my, mz: gz(0, my) };
  }

  // ---------------------------------------------------------------------------------------------- hair
  // A shell over the skull from the crown down to a hairline that depends on the direction ph (0 = front, ±π = back),
  // with a thickness field, tonal streaks per column (darker at the roots and in the parting) and loose locks breaking
  // the hairline (fringe, sideburns, nape); long styles continue as a sheet with ragged ends that hangs behind the
  // shoulders (tagged SOFT, so its lower part stays with the torso when the head turns).
  // style: { front, temple, side, nape (hairline heights × R: yy), th (thickness × R), top (extra on top), fringe, part,
  //          lump (noise), len (sheet end yy, 0 = none), sheetW (half-angle the sheet starts at), flare, wave, tint }
  const STY = {
    short: { front: 0.6, side: 0.02, nape: -0.5, th: 0.075, top: 0.03, fringe: 0.06 },
    fringe: { front: 0.3, side: 0.0, nape: -0.5, th: 0.085, top: 0.02, fringe: 0.1 },
    sidepart: { front: 0.56, side: 0.0, nape: -0.5, th: 0.07, top: 0.05, part: 0.6, fringe: 0.05 },
    quiff: { front: 0.62, side: 0.04, nape: -0.48, th: 0.065, top: 0.04, quiff: 0.3 },
    tousled: { front: 0.5, side: 0.0, nape: -0.52, th: 0.1, top: 0.07, lump: 0.07, fringe: 0.1, part: -0.35 },
    messy: { front: 0.4, side: -0.04, nape: -0.55, th: 0.105, top: 0.06, lump: 0.085, fringe: 0.12 },
    buzz: { front: 0.66, side: 0.06, nape: -0.46, th: 0.018, top: 0, tint: 0.35 },
    receding: { front: 0.74, side: 0.04, nape: -0.48, th: 0.05, top: 0.01, recede: 0.2 },
    bald: { front: 9, side: 0.1, nape: -0.46, th: 0.03, top: 0, ring: 0.36, tint: 0.3 },
    'grey-wild': { front: 9, side: 0.0, nape: -0.62, th: 0.16, top: 0, ring: 0.5, lump: 0.12 },
    curly: { front: 0.52, side: -0.02, nape: -0.55, th: 0.15, top: 0.06, lump: 0.1, fringe: 0.06 },
    afro: { front: 0.56, side: -0.1, nape: -0.6, th: 0.4, top: 0.1, lump: 0.05 },
    bun: { front: 0.6, side: 0.05, nape: -0.46, th: 0.05, top: 0.01, bun: 1 },
    topknot: { front: 0.62, side: 0.06, nape: -0.44, th: 0.045, top: 0.0, knot: 1 },
    ponytail: { front: 0.6, side: 0.04, nape: -0.46, th: 0.055, top: 0.02, tail: 1 },
    pigtails: { front: 0.56, side: -0.02, nape: -0.5, th: 0.07, top: 0.02, part: 0.01, pig: 1 },
    bob: { front: 0.5, side: -0.5, nape: -0.6, th: 0.1, top: 0.04, len: -1.12, sheetW: 0.95, curl: 1, fringe: 0.05, part: 0.01 },
    long: { front: 0.56, side: -0.45, nape: -0.6, th: 0.095, top: 0.04, len: -2.5, sheetW: 1.25, part: 0.01 },
    shoulder: { front: 0.56, side: -0.5, nape: -0.6, th: 0.085, top: 0.03, len: -1.75, sheetW: 1.05, part: 0.01 },
    wavy: { front: 0.56, side: -0.45, nape: -0.6, th: 0.11, top: 0.05, len: -2.55, sheetW: 1.2, wave: 0.07, part: 0.3, flare: 0.1 },
    straight: { front: 0.56, side: -0.5, nape: -0.6, th: 0.08, top: 0.03, len: -2.9, sheetW: 1.2, part: 0.45, locks: 1 },
    big: { front: 0.56, side: -0.4, nape: -0.6, th: 0.2, top: 0.12, len: -2.3, sheetW: 1.15, flare: 0.22, wave: 0.05, lump: 0.04 },
    curls: { front: 0.54, side: -0.4, nape: -0.6, th: 0.14, top: 0.05, len: -2.25, sheetW: 1.15, flare: 0.16, lump: 0.11, part: 0.3 },
  };
  const SHORT_CUTS = ['short', 'fringe', 'sidepart', 'short', 'tousled'];
  /** the style table entry for a head's params (null = no hair drawn: unknown style, or under an animal hood) */
  function styleOf(p) {
    let name = p.hairCut && STY[p.hairCut] ? p.hairCut : p.hairStyle;
    if (name === 'short' && !p.hairCut) name = SHORT_CUTS[(p.fv | 0) % SHORT_CUTS.length];
    return p.hat === 'hood' ? null : STY[name] || null;
  }
  /** hairline height (yy) in direction ph for style S (a bald crown reports S.ring over the forehead) */
  function hairLine(S, ph) {
    const a = Math.abs(ph), ringTop = S.front > 5;
    let fr = S.front;
    if (S.recede) fr += S.recede * bump(a, 0.75, 0.5);
    if (S.part && !ringTop && a < 0.95) fr -= 0.07 * Math.sign(S.part) * (ph / 0.95);          // a parting lifts one side of the fringe
    const side = S.side, nape = S.nape;
    if (a < 0.95) return ringTop ? S.ring : fr - 0.1 * (a / 0.95) ** 2;
    if (a < 1.35) return ringTop ? lerp(S.ring, side, sm(0.95, 1.3, a)) : lerp(fr - 0.1, side, sm(0.95, 1.35, a));
    if (a < 1.9) return side > -0.2 ? lerp(side, Math.max(side, 0.1), bump(a, 1.6, 0.3)) : side;      // lifts over the ear
    return lerp(side, nape, sm(1.9, 2.5, a));
  }
  /** hair for the head: p = { hair, skin, hairStyle, hairCut, hat, headR, headC, s, fig, fv, seed }; F from head() */
  function hair(g, p, F) {
    const R = p.headR, hc = p.headC, s = p.s, hi = CTX.hi, skin = p.skin, hat = p.hat;
    const S = styleOf(p); if (!S || S.tint) return;            // (cropped styles are painted on the scalp by head())
    const hatted = !!hat && hat !== 'headband' && hat !== 'laurel' && hat !== 'tie-band' && hat !== 'cone';
    const hcol = p.hair;
    const sd = (p.fv | 0) * 1.7 + 0.3;
    const NC = hi ? 16 : 12, part = S.part || 0, ringTop = S.front > 5;
    _c.setHex(hcol); const dark = _c.r * 0.3 + _c.g * 0.59 + _c.b * 0.11 < 0.02, amp = dark ? 0.55 : 0.26;      // (near-black hair needs a wider swing to show its streaks)
    const streak = (c, j = 1) => 0.9 + amp * (hash(c, j, sd) - 0.35);
    const thick = (yy, ph) => {
      const a = Math.abs(ph);
      let t = S.th + S.top * sm(0.2, 0.9, yy);
      if (S.quiff) t += S.quiff * bump(a, 0, 1.1) * bump(yy, 0.7, 0.55);
      if (S.fringe && a < 1.0) t += S.fringe * (1 - a) * sm(0.9, 0.5, yy);
      if (part) t += 0.04 * sm(0.2, 0.9, yy) * Math.tanh((ph - part) * 3) * (part > 0 ? -1 : 1);
      if (S.lump) t += S.lump * (hash(Math.round(ph * 3.1), Math.round(yy * 4.3), sd) - 0.4);
      if (hatted && yy > 0.15) t = Math.min(t, 0.035);
      return Math.max(0.03, t);
    };
    // ---- the cap: a pole on the crown, rows at fixed heights down to the hairline (rows below it bunch up there)
    const lowSide = S.side < -0.2;
    const LIST = hi ? [0.92, 0.78, 0.58, 0.36, 0.14, -0.1] : ringTop ? [0.8, 0.4] : lowSide ? [0.8, 0.45, -0.06] : [0.8, 0.4, 0.0], NRW = LIST.length + 1, P = [];
    const topT = thick(1, 0) + (S.quiff ? 0.03 : 0);
    const phOf = (c) => ((c / NC) * TAU + PI) % TAU - PI;        // −π..π, 0 = front
    for (let r = 0; r <= NRW; r++) {
      const row = [];
      for (let c = 0; c < NC; c++) {
        const ph = phOf(c), a = Math.abs(ph);
        const edge = hairLine(S, ph), top = ringTop ? S.ring + 0.02 : 1.0;
        if (r === 0 && !ringTop) { row.push([0, hc + (0.99 + topT * 0.6) * R, -0.1 * R]); continue; }
        const yy = r === NRW ? edge : ringTop ? lerp(top, edge, r / NRW) : Math.max(edge, LIST[r - 1]);
        const q = skull(Math.min(yy, 0.96), F);
        let t = thick(yy, ph);
        if (r === NRW) t = a < 1.0 && S.fringe ? t * 0.55 : t * 0.3;      // tucks in at the hairline (a fringe stands a little proud)
        if (ringTop && (r === 0 || a < 1.0)) t = -0.03;
        const hw = (q[1] + t) * R, hd = (q[2] + t) * R;
        row.push([hw * spow(Math.sin(ph), HE), hc + (yy + t * 0.7 * sm(0.3, 1, yy)) * R, q[3] * R + hd * spow(Math.cos(ph), HE)]);
      }
      P.push(row);
    }
    const tone = (r, c) => {
      let k = streak(c) * (r === 0 ? 1.05 : r === 1 ? 1.1 : r === NRW ? 0.82 : 1);          // sheen near the crown, shade at the roots
      if (part && r <= 2 && Math.abs(phOf(c) - part) < TAU / NC * 0.6) k *= 0.72;            // the parting
      return shade(hcol, k);
    };
    surfV(g, P, tone, { wrap: true, flip: true });
    // ---- loose locks over the hairline: fringe, sideburns, nape
    if (!ringTop && !hatted) {
      const sp = (yy, ph, off) => { const q = skull(Math.min(yy, 0.96), F); return [(q[1] + off) * R * spow(Math.sin(ph), HE), hc + yy * R, q[3] * R + (q[2] + off) * R * spow(Math.cos(ph), HE)]; };
      const lock = (ph0, ph1, pht, drop, k) => {
        const A = sp(hairLine(S, ph0) + 0.1, ph0, 0.05), B2 = sp(hairLine(S, ph1) + 0.1, ph1, 0.05), tipY = Math.min(hairLine(S, ph0), hairLine(S, ph1)) - drop, C = sp(tipY, pht, 0.05);
        const nx = Math.sin(pht), nz = Math.cos(pht), i0 = g.p.length / 3;
        for (const [q, kk] of [[A, 1], [B2, 1], [C, 0.86]]) { _c.setHex(shade(hcol, k * kk)); g.vert(q[0], q[1], q[2], nx, 0.1, nz, _c.r, _c.g, _c.b); }
        g.i.push(i0, i0 + 1, i0 + 2);
      };
      const fr = S.fringe ? S.fringe * 2.2 + 0.06 : S.lump ? 0.1 : 0;
      if (fr) for (let i = 0; i < 5; i++) { const c0 = -0.74 + i * 0.37, h = hash(i, 4, sd); lock(c0 + 0.21, c0 - 0.21, c0 + (h - 0.5) * 0.3 + (part ? -Math.sign(part) * 0.12 : 0), fr * (0.55 + 0.9 * h), streak(i, 6) * (i % 2 ? 0.9 : 1.04)); }
      if (S.side > -0.2) for (const sx of [1, -1]) lock(sx * 1.16, sx * 1.5, sx * 1.3, 0.3 + 0.1 * hash(sx, 2, sd), streak(sx + 3, 5) * 0.95);      // sideburns
      if (!S.len && !S.bun && !S.tail) for (let i = 0; i < 3; i++) { const c0 = PI - 0.62 + i * 0.62; lock(c0 - 0.33, c0 + 0.33, c0 + (hash(i, 8, sd) - 0.5) * 0.2, 0.14 + 0.1 * hash(i, 7, sd), streak(i, 9) * 0.92); }
    }
    // ---- the hanging sheet (bob … long): from behind the temples round the back, ends ragged
    if (S.len) {
      const T0 = g.tag, a0 = S.sheetW, cols = hi ? 12 : 6, rows = hi ? 5 : 2, Ps = [];
      const yTop = S.side + 0.12, len = S.len;
      for (let r = 0; r <= rows; r++) {
        const row = [], v = r / rows;
        for (let c = 0; c <= cols; c++) {
          const ph = lerp(a0, TAU - a0, c / cols), pw = ph > PI ? ph - TAU : ph, a = Math.abs(pw);
          const sideK = sm(2.1, a0, a);                       // 1 at the front edges of the sheet, 0 at the back
          const end = len * (1 - 0.3 * sideK * (len < -1.5 ? 1 : 0.15)) + (S.curl ? 0.05 * (c % 2) : 0.2 * hash(c, 9, sd) + 0.1 * (c % 2));
          const yy = lerp(yTop, end, v), q = skull(clamp(yy, -0.35, 0.3), F);
          let t = S.th * 1.15 + (S.flare || 0) * sm(-0.2, len, yy) + (S.wave ? S.wave * Math.sin(yy * 5.5 + c * 1.3 + sd) * sm(-0.3, -1, yy) : 0);
          if (S.lump) t += S.lump * 0.9 * (hash(c, r, sd) - 0.3);
          if (S.curl) t -= 0.14 * sm(len + 0.45, len, yy);    // a bob turns in at the ends
          let x = (q[1] + t) * R * spow(Math.sin(pw), HE), z = q[3] * R + (q[2] + t) * R * spow(Math.cos(pw), HE);
          // below the jaw the sides fall back behind the shoulders and the whole sheet follows the neck / upper back
          const below = sm(-0.9, -1.7, yy);
          if (len < -1.3) { z = Math.min(z, lerp(z, -0.085 - 0.02 * R - Math.abs(x) * 0.1, below)); x *= 1 + 0.25 * below * (1 - sideK * 0.5); }
          row.push([x, hc + yy * R, z]);
        }
        Ps.push(row);
      }
      g.tag = TAGS.SOFT;
      const stone = (r, c) => shade(hcol, streak(c, 2) * (r === 0 ? 0.92 : r === rows ? 0.84 : 1.04));
      surfV(g, Ps, stone, { flip: true });
      // the inside shows only at the sides (seen from the front, past the neck): a darker inner face for the outer strips
      for (const c0 of hi ? [0, 1, 2, cols - 3, cols - 2, cols - 1] : [0, 1, cols - 2, cols - 1]) surfV(g, Ps.map((row) => [row[c0], row[c0 + 1]]), () => shade(hcol, 0.62));
      g.tag = T0;
      if (S.locks) for (const sx of [1, -1]) {               // straightened hair falling in front of the shoulders
        const q = skull(-0.2, F), x0 = sx * (q[1] + 0.06) * R, n0 = g.p.length / 3;
        g.tag = TAGS.SOFT;
        blob(g, [[hc - 2.75 * R, 0.012, 0.008, 0.075], [hc - 2.2 * R, 0.022, 0.012, 0.07], [hc - 1.3 * R, 0.026, 0.014, 0.045], [hc - 0.5 * R, 0.022, 0.03, 0.035], [hc + 0.1 * R, 0.012, 0.04, 0.02]], hi ? 6 : 4, 1, (r, c) => shade(hcol, streak(c + r, 3)));
        mapFrom(g, n0, (x, y, z, isN) => [x + (isN ? 0 : x0 * (y > hc - R ? 1 : 0.9)), y, z]);
        g.tag = T0;
      }
    }
    // ---- gathered styles
    const back = skull(0.3, F), bz = (back[3] - back[2]) * R;
    if (S.bun) g.sph(0.05, hi ? 9 : 6, hi ? 6 : 4, shade(hcol, 0.94), 0, hc + 0.55 * R, bz * 0.86 - 0.02, 1.05, 0.95, 0.9);
    if (S.knot) {
      const mx = p.messy ? 0.03 * (((p.seed | 0) % 3) - 1) : 0, my = p.messy ? -0.02 : 0;
      g.sph(0.058, hi ? 9 : 6, hi ? 6 : 4, hcol, mx, hc + 1.2 * R + my, -0.02, 1, 0.82, 1);
      g.cyl(0.03, 0.036, 0.022, 8, shade(hcol, 0.7), mx * 0.6, hc + 1.04 * R, -0.015);
    }
    if (S.tail) {
      const T0 = g.tag, n0 = g.p.length / 3, len = 0.27 * s;
      g.sph(0.026, 6, 4, shade(hcol, 0.72), 0, hc + 0.22 * R, bz - 0.012);
      g.tag = TAGS.SOFT;
      blob(g, [[-len, 0.008, 0.008, 0], [-len * 0.75, 0.024, 0.02, 0], [-len * 0.35, 0.034, 0.026, 0], [-0.02, 0.026, 0.024, 0]], hi ? 7 : 5, 1, (r, c) => shade(hcol, streak(c, 4)), { openTop: false });
      const y0 = hc + 0.2 * R, z0 = bz - 0.03;
      mapFrom(g, n0 + 35, (x, y, z, isN) => { const k = -y / len, bend = -0.05 * k * k; return isN ? [x, y, z] : [x, y0 + y * 0.92, z0 + z + bend - 0.03 * Math.sin(k * 2.5)]; });
      g.tag = T0;
    }
    if (S.pig) for (const sx of [1, -1]) {
      const len = 0.22 * s, q = skull(0, F), x0 = sx * (q[1] + 0.12) * R;
      g.sph(0.02, 6, 4, 0xd02060, sx * (q[1] + 0.07) * R, hc + 0.02, -0.035);
      const n0 = g.p.length / 3;
      blob(g, [[-len, 0.008, 0.008, 0], [-len * 0.7, 0.026, 0.022, 0], [-len * 0.3, 0.034, 0.028, 0], [-0.01, 0.022, 0.022, 0]], hi ? 7 : 5, 1, (r, c) => shade(hcol, streak(c, 4)));
      mapFrom(g, n0, (x, y, z, isN) => (isN ? [x, y, z] : [x0 + x + sx * 0.02 * (-y / len), hc + 0.005 + y, -0.04 + z]));
    }
  }

  // ---------------------------------------------------------------------------------------------- hands
  /** triangle a b c wound so it faces the way its vertices' normals point (so a mirrored part needs no second index list) */
  function triOut(g, a, b, c) {
    const P = g.p, N = g.n, ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const d = (uy * vz - uz * vy) * (N[a * 3] + N[b * 3] + N[c * 3]) + (uz * vx - ux * vz) * (N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1]) + (ux * vy - uy * vx) * (N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]);
    if (d >= 0) g.i.push(a, b, c); else g.i.push(a, c, b);
  }
  const quadOut = (g, a, b, c, d) => { triOut(g, a, b, c); triOut(g, a, c, d); };
  // what a hand closes round: the radius (m) of a prop held across the palm (its axis along the forearm frame's z), or
  // minus the half thickness of a flat one held against the palm (the fingers straight along its cover)
  const GRIPS = { pint: 0.04, coffee: 0.037, kebab: 0.038, bottle: 0.03, cue: 0.013, book: -0.02, clutch: -0.0175 };
  /** grip of a held prop: > 0 the radius the fingers wrap, < 0 a flat thing against the palm, 0 = the hand hangs relaxed */
  const gripOf = (prop) => (prop && GRIPS[prop]) || 0;
  /** where a gripped prop's centre sits, towards the palm from the forearm's axis (m): its side lies against the palm */
  const gripX = (r) => 0.02 + Math.abs(r);
  /**
   * Hand hanging from the wrist at y = hy (forearm frame): palm towards the body, thumb forward. A palm that widens from
   * the wrist to the knuckles, four curled fingers (side by side to the middle joints, each with its own tip beyond: middle longest, little
   * finger shortest) and a two-joint thumb set off from the palm's forward edge. 63 triangles, both tiers.
   * grip > 0: closed round a prop of that radius held across the palm (fingers wrapped under it, the thumb over the top);
   * grip < 0: held flat against something (fingers straight, the thumb alongside).
   * Hand frame (a, d, w): a = towards the palm side, d = down the hand from the wrist, w = across (+ = thumb / index edge).
   */
  function hand(g, p, hy, side, grip = 0) {
    const s = (CTX.s || 1) * 1.07, b = Math.sqrt(p.b || 1) * 1.08, f = CTX.fig === 'f' ? 0.92 : 1, k = s * f, kb = b * f, skin = p.skin;
    const pin = -side, Z0 = 0.006;
    _c.setHex(skin); const cr = _c.r, cg = _c.g, cb = _c.b;
    const V = (a, d, w, na, nd, nw, tone = 1) => { const l = Math.hypot(na, nd, nw) || 1; return g.vert(pin * a, hy - d, Z0 + w, (pin * na) / l, -nd / l, nw / l, cr * tone, cg * tone, cb * tone); };
    const wrap = grip > 0, flat = grip < 0, gt = wrap ? sm(0.012, 0.04, grip) : 0;
    // ---- palm: wrist ring (inside the cuff) to the knuckle ring; corners [back / thumb edge, palm / thumb, palm / little, back / little]
    const tW = 0.0165 * kb, wW = 0.0265 * kb, tK = 0.0125 * kb, wK = 0.039 * kb, aK = wrap ? 0.005 : flat ? 0 : 0.003;
    const dK0 = 0.097 * k, dK4 = 0.086 * k;      // the knuckle line slopes: the little finger's knuckle sits higher
    const ring = (ac, ta, hw, d0, d1, tone) => [V(ac - ta, d0, hw, -1.5, 0, 1, tone), V(ac + ta, d0, hw, 1.5, 0, 1, tone * 1.03), V(ac + ta, d1, -hw, 1.5, 0, -1, tone * 1.03), V(ac - ta, d1, -hw, -1.5, 0, -1, tone)];
    const r0 = ring(0, tW, wW, -0.012, -0.012, 1), r1 = ring(aK, tK, wK, dK0, dK4, 1);
    for (let c = 0; c < 4; c++) quadOut(g, r0[c], r0[(c + 1) % 4], r1[(c + 1) % 4], r1[c]);
    // ---- fingers: edges e = 0 (index, outer) … 4 (little, outer); rows K (knuckle), M (middle joint), T (tip).
    // From the knuckles to the middle joints they lie side by side (creased by their normals); beyond, each has its own
    // length and narrows to its tip, with a shaded surface just under the gaps between them.
    const LEN = [0.066, 0.077, 0.078, 0.068, 0.052], FL = [0.071, 0.08, 0.074, 0.057];
    const Ko = [], Mo = [], Ki = [], Mi = [], MC = [], TH = [];
    const tM = 0.0105 * kb, tT = 0.0082 * kb;
    for (let e = 0; e < 5; e++) {
      const th1 = wrap ? lerp(1.45, 1.1, gt) + 0.03 * e : flat ? 0.03 : 0.15 + 0.05 * e, th2 = wrap ? lerp(2.75, 1.75, gt) + 0.05 * e : flat ? 0.1 : th1 + 0.34 + 0.07 * e;
      const l1 = LEN[e] * k * 0.56, dk = lerp(dK0, dK4, e / 4), w = wK * (1 - e / 2);
      const ma = aK + l1 * Math.sin(th1), md = dk + l1 * Math.cos(th1), thm = (th1 + th2) / 2;
      Ko.push([aK - tK, dk, w]); Ki.push([aK + tK, dk, w]); MC.push([ma, md, w * 0.96]);
      Mo.push([ma - tM * Math.cos(thm), md + tM * Math.sin(thm), w * 0.96]); Mi.push([ma + tM * Math.cos(thm), md - tM * Math.sin(thm), w * 0.96]);
      TH.push([th1 * 0.5, thm, th2 + 0.25, th2]);
    }
    /** tip of the finger of length fl at edge e, u across the finger's slot from that edge: [outer point, inner point] */
    const tipAt = (e, fl, wv) => {
      const th2 = TH[e][3], l2 = fl * k * 0.44, ta = MC[e][0] + l2 * Math.sin(th2), td = MC[e][1] + l2 * Math.cos(th2);
      return [[ta - tT * Math.cos(th2), td + tT * Math.sin(th2), wv], [ta + tT * Math.cos(th2), td - tT * Math.sin(th2), wv]];
    };
    const bk = (q, th, nw, tone) => V(q[0], q[1], q[2], -Math.cos(th), Math.sin(th), nw, tone);      // a vertex on the back of a finger
    const tipN = (q, e) => V(q[0], q[1], q[2], Math.sin(TH[e][3]), Math.cos(TH[e][3]), 0, 0.96);
    const inner = [0, 1, 4].map((e, n) => tipAt(e === 1 ? 2 : e, FL[n === 0 ? 0 : n === 1 ? 1 : 3], wK * (1 - (e === 1 ? 2 : e) / 2) * 0.84)[1]);      // palm-side tip points at the index edge, the middle, the little edge
    const iT = inner.map((q, n) => tipN(q, n * 2));
    for (let j = 0; j < 4; j++) {
      const e0 = j, e1 = j + 1, tn = j % 2 ? 0.97 : 1.02, w0 = wK * (1 - e0 / 2) * 0.86, w1 = wK * (1 - e1 / 2) * 0.86, gap = (w0 - w1) * 0.13;
      const T0p = tipAt(e0, FL[j], w0 - (j === 0 ? 0 : gap))[0], T1p = tipAt(e1, FL[j], w1 + (j === 3 ? 0 : gap))[0];
      const a0 = bk(Ko[e0], TH[e0][0], 0.75, tn), a1 = bk(Ko[e1], TH[e1][0], -0.75, tn * 0.84), b0 = bk(Mo[e0], TH[e0][1], 0.75, tn), b1 = bk(Mo[e1], TH[e1][1], -0.75, tn * 0.84);
      const c0 = bk(T0p, TH[e0][2], 0.75, tn), c1 = bk(T1p, TH[e1][2], -0.75, tn * 0.88);
      quadOut(g, a0, a1, b1, b0); quadOut(g, b0, b1, c1, c0);
      triOut(g, tipN(T0p, e0), tipN(T1p, e1), iT[j === 0 ? 0 : j === 3 ? 2 : 1]);      // fingertip
    }
    {      // the shade between the fingers: a surface 3.5 mm under their backs, from the middle joints to the tips
      const dk2 = 0.5, off = 0.0035, row = (pts, th) => pts.map((q, n) => V(q[0] + off * Math.cos(th[n]), q[1] - off * Math.sin(th[n]), q[2], -Math.cos(th[n]), Math.sin(th[n]), 0, dk2));
      const es = [0, 2, 4], m = row(es.map((e) => Mo[e]), es.map((e) => TH[e][1])), t = row(es.map((e, n) => tipAt(e, FL[n === 0 ? 0 : n === 1 ? 1 : 3] * 0.96, wK * (1 - e / 2) * 0.86)[0]), es.map((e) => TH[e][3]));
      quadOut(g, m[0], m[1], t[1], t[0]); quadOut(g, m[1], m[2], t[2], t[1]);
    }
    {      // palm side of the fingers
      const pm = (q, th) => V(q[0], q[1], q[2], Math.cos(th), -Math.sin(th), 0, 1.02);
      const k0 = pm(Ki[0], TH[0][0]), k4 = pm(Ki[4], TH[4][0]), m0 = pm(Mi[0], TH[0][1]), m4 = pm(Mi[4], TH[4][1]), t0 = pm(inner[0], TH[0][3]), t2 = pm(inner[1], TH[2][3]), t4 = pm(inner[2], TH[4][3]);
      quadOut(g, k0, k4, m4, m0); triOut(g, m0, t0, t2); triOut(g, m0, t2, m4); triOut(g, m4, t2, t4);
    }
    for (const [e, nw, fl] of [[0, 1, FL[0]], [4, -1, FL[3]]]) {      // the index finger's and the little finger's outer sides
      const tp = tipAt(e, fl, wK * (1 - e / 2) * 0.86), v = [Ko[e], Mo[e], tp[0], Ki[e], Mi[e], tp[1]].map((q) => V(q[0], q[1], q[2], 0, 0, nw, 0.95));
      quadOut(g, v[0], v[1], v[4], v[3]); quadOut(g, v[1], v[2], v[5], v[4]);
    }
    // ---- thumb: three square rings from inside the palm's forward edge, then the tip
    const TB = wrap ? [[0.01, 0.017 * k, 0.014 * kb], [0.8, 0.1, 0.45, 0.042 * k], [0.8, 0.5, 0.06, 0.03 * k]]
      : flat ? [[-0.002, 0.03 * k, 0.024 * kb], [0, 0.74, 0.6, 0.045 * k], [0.02, 0.9, 0.3, 0.034 * k]]
        : [[0.006, 0.03 * k, 0.023 * kb], [0.3, 0.78, 0.52, 0.045 * k], [0.34, 0.9, 0.26, 0.034 * k]];
    let C = TB[0]; const rings = [], RT = [0.0115 * kb, 0.0098 * kb, 0.0072 * kb]; let dir = null;
    for (let r = 0; r < 3; r++) {
      const q = TB[Math.min(r + 1, 2)], l = Math.hypot(q[0], q[1], q[2]); dir = [q[0] / l, q[1] / l, q[2] / l];
      if (r > 0) { const pq = TB[r], pl = Math.hypot(pq[0], pq[1], pq[2]); C = [C[0] + (pq[0] / pl) * pq[3], C[1] + (pq[1] / pl) * pq[3], C[2] + (pq[2] / pl) * pq[3]]; }
      // two unit vectors across the thumb: p1 in the hand's plane, p2 = dir × p1
      let p1 = [0, -dir[2], dir[1]]; const l1 = Math.hypot(p1[1], p1[2]) || 1; p1 = [0, p1[1] / l1, p1[2] / l1];
      const p2 = [dir[1] * p1[2] - dir[2] * p1[1], dir[2] * p1[0] - dir[0] * p1[2], dir[0] * p1[1] - dir[1] * p1[0]];
      const row = [];
      for (let c = 0; c < 4; c++) {
        const ph = PI / 4 + (c * PI) / 2, u = Math.cos(ph), v = Math.sin(ph), nx = p1[0] * u + p2[0] * v, ny = p1[1] * u + p2[1] * v, nz = p1[2] * u + p2[2] * v, rr = RT[r] * 1.25;
        row.push(V(C[0] + nx * rr, C[1] + ny * rr, C[2] + nz * rr, nx + dir[0] * (r === 2 ? 0.6 : 0), ny + dir[1] * (r === 2 ? 0.6 : 0), nz + dir[2] * (r === 2 ? 0.6 : 0), r === 2 ? 0.97 : 1));
      }
      rings.push(row);
    }
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) quadOut(g, rings[r][c], rings[r][(c + 1) % 4], rings[r + 1][(c + 1) % 4], rings[r + 1][c]);
    { const tp = rings[2].map((v) => V(g.p[v * 3] * pin, hy - g.p[v * 3 + 1], g.p[v * 3 + 2] - Z0, dir[0], dir[1], dir[2], 0.95)); quadOut(g, tp[0], tp[1], tp[2], tp[3]); }
  }
  /** rigid ball in a joint (the shin's knee, the forearm's elbow): keeps the bend full when the blended skin pinches */
  function jointBall(g, r, col) { if (CTX.hi) g.sph(r, 8, 6, col, 0, 0, 0); }

  // ---------------------------------------------------------------------------------------------- shoes
  // A shoe is lofted through seven sections, heel to toe: [z (× s; 0 = under the shin), half width (× w), height of the
  // upper above the ground (× s, for the last's own sole), how far the top is drawn in (share of the half width),
  // 0 flat on the ground / 1 on the heel block / 2 the waist, clear of the ground in front of the heel].
  // Heel back … 28.8 cm … toe at s = 1 (the walk's heel and toe points, characters.js rigHeight: z = −0.082 s and 0.206 s).
  const LAST = {
    trainer: { sole: 0.022, t: [[-0.082, 0.56, 0.086, 0.8, 0], [-0.06, 0.88, 0.094, 0.9, 0], [0.02, 0.97, 0.1, 0.8, 0], [0.085, 1.05, 0.074, 0.6, 0], [0.15, 1.05, 0.058, 0.62, 0], [0.188, 0.82, 0.05, 0.6, 0], [0.205, 0.44, 0.04, 0.55, 0]] },
    shoe: { sole: 0.012, heel: 0.012, t: [[-0.08, 0.52, 0.066, 0.8, 1], [-0.06, 0.84, 0.074, 0.88, 1], [0.008, 0.92, 0.08, 0.76, 2], [0.085, 0.99, 0.058, 0.6, 0], [0.15, 0.98, 0.044, 0.58, 0], [0.19, 0.7, 0.036, 0.55, 0], [0.206, 0.34, 0.028, 0.5, 0]] },
    boot: { sole: 0.02, heel: 0.012, t: [[-0.082, 0.58, 0.112, 0.84, 1], [-0.062, 0.92, 0.118, 0.9, 1], [0.01, 1.0, 0.118, 0.84, 2], [0.085, 1.06, 0.088, 0.62, 0], [0.15, 1.07, 0.068, 0.64, 0], [0.188, 0.86, 0.06, 0.62, 0], [0.205, 0.5, 0.046, 0.6, 0]] },
    flat: { sole: 0.008, t: [[-0.076, 0.5, 0.05, 0.8, 0], [-0.058, 0.8, 0.054, 0.88, 0], [0.015, 0.86, 0.056, 0.76, 0], [0.085, 0.94, 0.042, 0.6, 0], [0.145, 0.95, 0.034, 0.6, 0], [0.182, 0.7, 0.028, 0.55, 0], [0.198, 0.36, 0.02, 0.5, 0]] },
    bare: { sole: 0, t: [[-0.068, 0.44, 0.04, 0.7, 0], [-0.046, 0.8, 0.079, 0.98, 0], [0.03, 0.84, 0.084, 0.8, 0], [0.085, 0.92, 0.046, 0.62, 0], [0.14, 1.0, 0.03, 0.7, 0], [0.172, 0.92, 0.022, 0.75, 0], [0.19, 0.62, 0.015, 0.7, 0]] },
    court: { sole: 0.008, t: [[-0.074, 0.46, 0.058, 0.8, 0], [-0.056, 0.78, 0.066, 0.94, 0], [0.015, 0.82, 0.068, 0.84, 0], [0.075, 0.9, 0.044, 0.62, 0], [0.118, 0.94, 0.036, 0.6, 0], [0.172, 0.66, 0.028, 0.55, 0], [0.202, 0.26, 0.018, 0.5, 0]] },
  };
  const BALL = 0.118;      // where a raised heel's pitch comes down to the ground (× s)
  /**
   * A shoe (or bare foot) on the ground plane y = gy, tagged FOOT (it turns on the ankle bone): a rounded heel, the
   * collar round the ankle, the instep falling to a low toe box and a rounded toe, on a sole of its own colour with a
   * proud edge; leather lasts stand on a heel with the waist clear of the ground. Modelled pointing straight ahead and
   * symmetric: mergeSkin (characters.js) turns each foot out and curves it inward like a last.
   * o: { last, col, w (half width, m), sole (colour), soleH (overrides the last's sole thickness), toe (colour of the toe
   *      cap), top (colour of the opening), foot (colour of the instep left bare by a low-cut shoe),
   *      lift (m: the heel raised that much, pitched down to the ball), wedge (the sole filled in under a raised heel) }
   */
  function shoeForm(g, o, gy) {
    const s = CTX.s || 1, L = LAST[o.last] || LAST.shoe, w = o.w, hi = CTX.hi, T0 = g.tag, T = L.t, n = T.length;
    g.tag = TAGS.FOOT;
    const sh = (o.soleH !== undefined ? o.soleH : L.sole) * s, hl = (L.heel || 0) * s, lift = o.lift || 0, zb = BALL * s, z1 = T[1][0] * s;
    // per section: z, half width, bottom of the sole, top of the sole (= bottom of the upper), top of the upper, half width of the top
    const S = T.map((q) => {
      const z = q[0] * s, lf = lift * clamp((zb - z) / (zb - z1), 0, 1) + (q[4] ? hl : 0), y0 = gy + lf + sh;
      return { z, hw: q[1] * w, yb: o.wedge ? gy : q[4] === 1 ? gy : gy + lf, y0, y1: y0 + (q[2] - L.sole) * s, tw: q[1] * w * q[3] };
    });
    // upper: columns across the foot (outside bottom, [shoulder,] top, top, [shoulder,] bottom), rows heel → toe
    const P = S.map((q) => (hi ? [[-q.hw, q.y0, q.z], [-(q.hw + q.tw) * 0.52, lerp(q.y0, q.y1, 0.62), q.z], [-q.tw * 0.8, q.y1, q.z], [q.tw * 0.8, q.y1, q.z], [(q.hw + q.tw) * 0.52, lerp(q.y0, q.y1, 0.62), q.z], [q.hw, q.y0, q.z]]
      : [[-q.hw, q.y0, q.z], [-q.tw, q.y1, q.z], [q.tw, q.y1, q.z], [q.hw, q.y0, q.z]]));
    const np = P[0].length, t0 = np / 2 - 1, t1 = np / 2, base = g.p.length / 3;
    const colAt = (r, c) => {
      const top = c === t0 || c === t1;
      if (top && r >= 1 && r <= 3 && o.foot !== undefined) return o.foot;
      if (r >= n - 3 && o.toe !== undefined) return o.toe;
      if (top && (r === 1 || r === 2) && o.top !== undefined) return o.top;
      return o.col;
    };
    surfV(g, P, colAt, { flip: true, gain: (r, c) => (c === 0 || c === np - 1 ? 0.9 : 1) });
    for (const r of [0, n - 1]) for (let c = 1; c < np - 1; c++) {      // the heel's back and the toe's front, shaded with the upper
      const a = base + r * np, b2 = a + c, c2 = a + c + 1;
      if (r === 0) g.i.push(a, b2, c2); else g.i.push(a, c2, b2);
    }
    // sole: a wall round the outline, a little proud of the upper, and the underside
    if (sh > 0 || hl > 0 || o.wedge) {
      const edge = 1.05;
      _c.setHex(o.sole !== undefined ? o.sole : o.col);
      const ring = [];
      for (let i = 0; i < n; i++) ring.push([S[i].hw * edge, S[i].z + (i === n - 1 ? 0.003 : i === 0 ? -0.003 : 0), S[i]]);
      for (let i = n - 1; i >= 0; i--) ring.push([-S[i].hw * edge, S[i].z + (i === n - 1 ? 0.003 : i === 0 ? -0.003 : 0), S[i]]);
      const m = ring.length;
      for (let i = 0; i < m; i++) {            // (flat-shaded outward)
        const a = ring[i], b2 = ring[(i + 1) % m], nx = b2[1] - a[1], nz = -(b2[0] - a[0]), l = Math.hypot(nx, nz) || 1, k0 = g.p.length / 3;
        g.vert(a[0], a[2].yb, a[1], nx / l, 0, nz / l, _c.r, _c.g, _c.b); g.vert(b2[0], b2[2].yb, b2[1], nx / l, 0, nz / l, _c.r, _c.g, _c.b);
        g.vert(b2[0], b2[2].y0, b2[1], nx / l, 0, nz / l, _c.r, _c.g, _c.b); g.vert(a[0], a[2].y0, a[1], nx / l, 0, nz / l, _c.r, _c.g, _c.b);
        g.i.push(k0, k0 + 2, k0 + 1, k0, k0 + 3, k0 + 2);
      }
    }
    {      // underside (lean tier: through four of the sections)
      _c.setHex(sh > 0 || hl > 0 || o.wedge ? (o.sole !== undefined ? o.sole : o.col) : o.col);
      const rows = hi ? S : [S[0], S[1], S[4], S[n - 1]], k0 = g.p.length / 3, e = sh > 0 ? 1.05 : 1;
      for (const q of rows) { const y = q.yb; g.vert(-q.hw * e, y, q.z, 0, -1, 0, _c.r * 0.7, _c.g * 0.7, _c.b * 0.7); g.vert(q.hw * e, y, q.z, 0, -1, 0, _c.r * 0.7, _c.g * 0.7, _c.b * 0.7); }
      for (let r = 0; r < rows.length - 1; r++) { const a = k0 + r * 2; g.i.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
    g.tag = T0;
  }

  return { torsoRing, surfV, blob, mapFrom, gridNormals, prof, frontZ, backZ, halfW, torsoPt, torsoCells, api, TOP_Y, pelvis, hipAt, head, hair, faceZ, faceShape, skull, facePivots, hand, gripOf, gripX, jointBall, shoeForm, bump, hash, STY };
}
