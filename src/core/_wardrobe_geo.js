// Geometry for the clubbing wardrobe (see _wardrobe_club.js for the data). Builders take a plain params object (its
// JSON is the geometry-cache key in characters.js) and return a BufferGeometry in the same segment frames as the
// standard body: the same neutral low-poly body, with garments modelled as colour-banded cells on a lofted torso,
// banded limb cylinders, thin strap boxes, double-sided shirt-tail / peplum rings and a separate swinging skirt.
// Kit K = { THREE, GB, shade, mix, addProp } is passed in by characters.js (no import cycle).

export function makeClubBuilders(K) {
  const { THREE, GB, shade, mix, addProp, B, CTX, T_FOOT } = K;
  const PI = Math.PI, H = PI / 2, TAU = PI * 2;
  const _c = new THREE.Color();
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const spow = (v, e) => (v < 0 ? -Math.pow(-v, e) : Math.pow(v, e));
  const hcell = (a, b, c) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };

  // ---------------------------------------------------------------------------------------------- raw triangles
  function tri(g, ax, ay, az, bx, by, bz, cx, cy, cz, col, gain, hx, hy, hz) {
    let ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * hx + ny * hy + nz * hz < 0) { let t = bx; bx = cx; cx = t; t = by; by = cy; cy = t; t = bz; bz = cz; cz = t; nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    _c.setHex(col); const r = _c.r * gain, gg = _c.g * gain, bb = _c.b * gain;
    const base = g.p.length / 3;
    g.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let k = 0; k < 3; k++) { g.n.push(nx, ny, nz); g.c.push(r, gg, bb); g.t.push(g.tag); }
    g.i.push(base, base + 1, base + 2);
  }
  function quad(g, a, b, c, d, col, gain, hx, hy, hz) {
    tri(g, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col, gain, hx, hy, hz);
    tri(g, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], col, gain, hx, hy, hz);
  }
  /** box between two points in the y-z plane at x (long axis along the segment) */
  function seg(g, x, y0, z0, y1, z1, w, t, col, rz = 0) {
    const dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dy, dz);
    g.box(w, len, t, col, x, (y0 + y1) / 2, (z0 + z1) / 2, Math.atan2(dz, dy), 0, rz);
  }
  /** convex polygon in the z-y plane (pts [[z, y], ...] counter-clockwise seen from +x) extruded from x0 to x1 */
  function prism(g, x0, x1, pts, col, gain = 1) {
    const n = pts.length; let cz = 0, cy = 0; for (const [z, y] of pts) { cz += z; cy += y; } cz /= n; cy /= n;
    for (let i = 1; i < n - 1; i++) {
      tri(g, x1, pts[0][1], pts[0][0], x1, pts[i][1], pts[i][0], x1, pts[i + 1][1], pts[i + 1][0], col, gain, 1, 0, 0);
      tri(g, x0, pts[0][1], pts[0][0], x0, pts[i][1], pts[i][0], x0, pts[i + 1][1], pts[i + 1][0], col, gain, -1, 0, 0);
    }
    for (let i = 0; i < n; i++) {
      const [z0, y0] = pts[i], [z1, y1] = pts[(i + 1) % n];
      const mz = (z0 + z1) / 2 - cz, my = (y0 + y1) / 2 - cy;
      quad(g, [x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], col, gain, 0, my, mz);
    }
  }
  /** double-sided band between an upper ellipse (y0, rx0, rz0) and a lower one; yb(phi) gives the lower edge height,
   *  off(i) a radial offset for the lower ring (pleats); colFn(i, phi) -> colour. Inner side shaded. */
  function band(g, n, y0, rx0, rz0, yb, rx1, rz1, colFn, opts = {}) {
    const z0 = opts.z0 || 0, inner = opts.inner ?? 0.6, rows = opts.rows || 1, off = opts.off, gainFn = opts.gain, e = opts.e || 1;
    for (let r = 0; r < rows; r++) {
      const t0 = r / rows, t1 = (r + 1) / rows;
      for (let i = 0; i < n; i++) {
        const pa = ((i - 0.5) / n) * TAU, pb = ((i + 0.5) / n) * TAU, pm = (i / n) * TAU;
        const P = (ph, t, k) => {
          const o = off && t > 0 ? off(k, t) : 0;
          const rx = lerp(rx0, rx1, t) + o, rz = lerp(rz0, rz1, t) + o;
          const y = lerp(y0, typeof yb === 'function' ? yb(ph) : yb, t);
          return [rx * spow(Math.sin(ph), e), y, z0 + rz * spow(Math.cos(ph), e)];
        };
        const a = P(pa, t0, i), b = P(pb, t0, i + 1), c = P(pb, t1, i + 1), d = P(pa, t1, i);
        const col = colFn(i, pm, r), gn = gainFn ? gainFn(i, r) : 1;
        const hx = Math.sin(pm), hz = Math.cos(pm);
        quad(g, a, b, c, d, col, gn, hx, 0, hz);
        if (inner) quad(g, a, b, c, d, shade(col, inner), gn, -hx, 0, -hz);
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- torso loft
  // the torso surface itself (profile, rings, smooth normals, edge-splitting) is the shared body's: _body_geo.js
  const E = 0.74;
  /** front surface z at height Y (s units) and lateral x (m) */
  const frontZ = (p, Y, x = 0) => B.frontZ(p, Y, x);
  let G = 1;
  function neckSkin(p, Y, a, lat, front, S, xr) {
    switch (p.neck) {
      case 'crew': return false;
      case 'polo': return front && a < 0.42 && Y > (p.open ? 0.4 : 0.45);
      case 'scoop': return front ? Y > 0.37 + 0.13 * (a / H) ** 2 : Y > 0.465;
      case 'scoop-m': return front ? Y > 0.325 + 0.17 * (a / H) ** 2 : Y > 0.465;
      case 'v': return front && Y > 0.33 + 0.2 * (a / H);
      case 'deepv': return front && Y > 0.25 + 0.3 * (a / H);
      case 'collar': {
        if (p.open >= 4) return front && a < 0.2 + 0.3 * (Y / 0.48);
        const d = [0.455, 0.415, 0.37, 0.3][p.open | 0];
        return front && Y > d + (0.47 - d) * (a / 0.8);
      }
      case 'straight': return Y > (front ? 0.345 : 0.33);
      case 'cami': return Y > (front ? 0.35 + 0.03 * (a / H) : 0.325);
      case 'high': return (lat > 0.55 && Y > 0.37) || (Y > 0.44 && xr > 0.62);
      case 'oneshoulder': return Y > 0.31 + 0.2 * clamp((S + 0.25) / 1.1, 0, 1);
      case 'vest': {
        const strap = xr > 0.3 && xr < 0.74;
        if (Y > 0.432) return !strap;
        if (front ? Y > 0.33 : Y > 0.39) return !strap;
        return lat > 0.8 && Y > 0.27;
      }
      case 'none': return true;
    }
    return false;
  }
  function garmentCol(p, Y, a, ri, ci, lat, front) {
    let c = p.main; G = 1;
    switch (p.pattern) {
      case 'block': if (lat > 0.8315) c = p.alt; break;      // (the panel edge runs along a cell edge of the fine grid)
      case 'sequin': { const h = hcell(ri, ci, p.seed); G = h > 0.82 ? 2.1 : 0.7 + 0.75 * h; break; }
      case 'bandage': if (ri % 2) c = shade(c, 0.84); break;
      case 'check': { const k = (ri % 2) + (ci % 2); c = k === 0 ? p.main : k === 1 ? mix(p.main, p.alt, 0.5) : p.alt; break; }
      case 'floral': c = floral(p.main, p.alt, hcell(ri, ci, p.seed)); break;
      case 'hoops': if (Math.floor(Y / 0.072) % 2) c = p.alt; break;
      case 'stripe': if (ci % 2) c = p.alt; break;
    }
    if (p.animal) {
      const an = p.animal;
      if (an === 'tiger' && (ri + (ci % 4 < 2 ? 0 : 1)) % 4 === 0 && !(front && a < 0.6)) c = 0x141414;
      else if (an === 'cow' && hcell(Math.floor(ri / 4), Math.floor(ci / 3), 3) < 0.38) c = 0x141414;
      else if (an === 'leopard' && hcell(ri, ci, 5) < 0.17) c = 0x3a2414;
      else if (an === 'panda' && Y > 0.384 && lat > 0.5556) c = 0x141414;
      else if (an === 'pikachu' && a > 1.7672 && ((Y > 0.312 && Y < 0.336) || (Y > 0.384 && Y < 0.408))) c = 0x6a3a1a;      // (stripes on whole cells of the fine grid)
      if (front && a < 0.589 && Y < 0.36 && an !== 'panda' && an !== 'pikachu') c = p.alt;   // belly
    }
    if (p.jacket) {    // dinner jacket over the shirt: white V between the lapels, black elsewhere
      const vh = Y > 0.16 ? 0.1 + (Y - 0.16) * 2.3 : -1;
      if (!(front && a < vh)) { c = 0x111114; G = 1; }
    }
    return c;
  }
  function torsoCell(p, Y, ph, ri, ci) {
    const a = Math.abs(ph), S = Math.sin(ph), lat = Math.abs(S), front = a < H, xr = Math.pow(lat, E);
    let cov = p.neck !== 'none';
    if (cov && Y < p.topHem) cov = false;
    if (cov && neckSkin(p, Y, a, lat, front, S, xr)) cov = false;
    if (cov && p.back === 'open' && ((a > 1.95 && Y > 0.06) || (a > 1.7 && Y > 0.22))) cov = false;
    if (cov && p.back === 'low' && a > 2.05 && Y > 0.2) cov = false;
    if (cov && p.cut === 'side' && lat > 0.8 && Y > 0.07 && Y < 0.19) cov = false;
    if (cov && p.cut === 'front' && a < 0.45 && Y > 0.11 && Y < 0.22) cov = false;
    if (cov && p.sleeves === 'none' && p.neck !== 'vest' && p.neck !== 'oneshoulder' && p.neck !== 'straight' && p.neck !== 'cami' && p.neck !== 'high' &&
      ((lat > 0.9 && Y > 0.34) || (Y > 0.432 && xr > 0.72))) cov = false;
    if (Y < p.waist && (p.tucked || !cov)) { G = 1; return p.bottom; }
    if (cov) return garmentCol(p, Y, a, ri, ci, lat, front);
    G = 1;
    return p.skin;
  }

  function torso(p) {
    const { s, b } = p, g = new GB();
    // cells coloured by the garment rules; cells straddling an edge (neckline, hem, armhole, cut-out) are split 3x3 in
    // the rich tier so the edge reads as a line rather than a staircase
    B.torsoCells(g, p, (Y, ph, ri, ci) => { const c = torsoCell(p, Y, ph, ri, ci); B.api.G = G; return c; }, true);      // (always the fine grid: the garments are drawn in its cells)
    const fz = (Y, x = 0) => frontZ(p, Y, x);
    const sc = p.main;
    // ---- shirt details: collar, placket, buttons
    if (p.neck === 'collar' || p.neck === 'polo') {
      const cc = p.collar ?? sc, o = p.open | 0;
      g.box(0.13 * b, 0.035 * s, 0.022, cc, 0, 0.485 * s, -0.05 * b, -0.2);                       // band behind the neck
      for (const sx of [1, -1]) {
        g.box(0.02, 0.035 * s, 0.075 * b, cc, sx * 0.058 * b, 0.482 * s, -0.008, 0, sx * 0.1, 0);  // sides
        const spread = o === 0 ? 0.35 : o >= 4 ? 1.25 : 0.7 + o * 0.12;                              // collar points lie open
        { const x0 = sx * (0.012 + 0.01 * o) * b, y0 = 0.478 * s, len = 0.062, cs = Math.cos(spread), sn = Math.sin(spread), tx = x0 + sx * sn * len, ty = y0 - cs * len * 0.8, z0 = fz(0.47, x0) + 0.006, z1 = fz(0.44, tx) + 0.008;
          const q = [[x0, y0, z0], [tx, ty, z1], [tx + sx * 0.03 * cs, ty + 0.034 * sn + 0.012, z1], [x0 + sx * 0.04, y0 + 0.004, z0 - 0.012]]; g.poly(sx > 0 ? q : q.reverse(), shade(cc, 1.06), 0, 0.35, 0.94); }
      }
      if (o < 4 && p.neck === 'collar') {
        const d = [0.45, 0.41, 0.36, 0.295][o];
        for (let Y = 0.06; Y < d - 0.02; Y += 0.075) g.box(0.012, 0.012, 0.006, shade(sc, 0.75), 0, Y * s, fz(Y) + 0.004);
        if (!p.jacket) seg(g, 0, 0.02 * s, fz(0.02) + 0.002, (d - 0.01) * s, fz(d - 0.01) + 0.002, 0.022, 0.004, shade(sc, 0.9));
      } else if (o >= 4) {             // fully open: the shirt fronts' edges
        for (const sx of [1, -1]) seg(g, sx * 0.045 * b, 0.02 * s, fz(0.02, 0.045 * b) + 0.003, 0.44 * s, fz(0.44, 0.06 * b) + 0.003, 0.016, 0.005, shade(sc, 0.82), -sx * 0.12);
      }
      if (p.neck === 'polo') { g.box(0.03, 0.12 * s, 0.006, shade(sc, 0.88), 0, 0.39 * s, fz(0.39) + 0.003); g.box(0.012, 0.012, 0.006, 0xeeeeea, 0, 0.42 * s, fz(0.42) + 0.006); }
    }
    if (p.knot) {      // shirt knotted under the bust
      g.box(0.07, 0.05, 0.05, sc, 0.02, (p.topHem + 0.015) * s, fz(p.topHem) + 0.02, 0, 0, 0.3);
      for (const sx of [1, -1]) { const x = 0.02 + sx * 0.012, y = (p.topHem + 0.005) * s, z = fz(p.topHem) + 0.03, q = [[x - 0.02, y, z], [x + sx * 0.045 - 0.022, y - 0.085, z - 0.006], [x + sx * 0.045 + 0.022, y - 0.08, z - 0.006], [x + 0.02, y, z]]; g.poly(q, shade(sc, 0.9)); }      // the knot's two tails
    }
    if (p.bow === 'undone') for (const sx of [1, -1]) seg(g, sx * 0.032, 0.465 * s, fz(0.465, 0.03) + 0.014, 0.385 * s, fz(0.385, 0.035) + 0.008, 0.022, 0.006, 0x0c0c0e, sx * 0.1);
    if (p.tie === 'neck') {
      const ky = p.loose ? 0.4 : 0.445, kx = p.loose ? 0.012 : 0;
      g.box(0.034, 0.028, 0.016, p.tieCol, kx, ky * s, fz(ky) + 0.01);
      seg(g, kx, (ky - 0.015) * s, fz(ky) + 0.008, 0.16 * s, fz(0.16) + 0.008, 0.05, 0.008, p.tieCol, kx ? -0.06 : 0);
      g.box(0.05, 0.014, 0.01, shade(p.tieCol, 1.5), kx, 0.3 * s, fz(0.3) + 0.012, 0, 0, 0.4);
    }
    // ---- straps
    if (p.straps) {
      const w = p.straps === 'wide' ? 0.032 : 0.015, x0 = (p.straps === 'wide' ? 0.075 : 0.085) * b, ft = p.neck === 'v' ? 0.38 : 0.345, bk = 0.32;
      for (const sx of [1, -1]) {
        const x = sx * x0, zt = fz(0.47, x);
        seg(g, x, (ft - 0.005) * s, fz(ft, x) + 0.004, 0.475 * s, zt * 0.7 + 0.006, w, 0.006, p.strapCol ?? sc);
        seg(g, x, 0.475 * s, zt * 0.7 + 0.006, 0.475 * s, -zt * 0.7 - 0.006, w, 0.006, p.strapCol ?? sc);
        seg(g, x, 0.475 * s, -zt * 0.7 - 0.006, (bk - 0.005) * s, -fz(bk, x) - 0.004, w, 0.006, p.strapCol ?? sc);
      }
    }
    if (p.neck === 'high' && p.back === 'open') {        // halter: round the back of the neck
      for (const sx of [1, -1]) seg(g, sx * 0.045 * b, 0.4 * s, fz(0.4, 0.045 * b) + 0.003, 0.5 * s, -0.035, 0.02, 0.008, sc, -sx * 0.25);
      g.box(0.08, 0.02, 0.012, sc, 0, 0.505 * s, -0.045);
    }
    // ---- jewellery & bags
    if (p.necklace) {
      for (let i = -2; i <= 2; i++) {
        const Y = 0.435 - 0.016 * (2 - Math.abs(i)) - 0.012, x = i * 0.024;
        g.box(i === 0 ? 0.03 : 0.022, i === 0 ? 0.03 : 0.02, 0.008, i % 2 ? p.trim : 0x3a8ad0, x, Y * s, fz(Y, x) + 0.006, -0.25, 0, -i * 0.15);
      }
    }
    if (p.glow) {
      const n0 = g.c.length;
      g.add(new THREE.TorusGeometry(0.078, 0.0065, 4, 14), p.glowCol, 0, 0.462 * s, 0.006, H + 0.45, 0, 0, 1.02 * b, 0.82 * b, 1);
      boostFrom(g, n0, 2.4);
    }
    if (p.bag === 'chain-bag') {      // chain strap from the right shoulder to the left hip, front and back
      const x0 = -0.11 * b, Y0 = 0.47, x1 = 0.16 * b, Y1 = 0.02;
      const len = Math.hypot(x1 - x0, (Y1 - Y0) * s), rz = Math.atan2(x1 - x0, (Y0 - Y1) * s);
      g.box(0.008, len, 0.006, p.trim, (x0 + x1) / 2, ((Y0 + Y1) / 2) * s, fz((Y0 + Y1) / 2, (x0 + x1) / 2) + 0.012, 0.03, 0, rz);
      g.box(0.008, len, 0.006, p.trim, (x0 + x1) / 2, ((Y0 + Y1) / 2) * s, -fz((Y0 + Y1) / 2, (x0 + x1) / 2) - 0.012, -0.03, 0, rz);
    }
    // ---- fancy dress
    if (p.cape) {
      const len = 0.9 * s, back = K.taperBox(0.58 * b, 0.018, 0.34 * b, 0.018, len, 0); back.translate(0, -len, 0);
      g.add(back, p.capeCol, 0, 0.485 * s, -0.1 * b - 0.025, 0.13);
      g.box(0.36 * b, 0.03, 0.18 * b, p.capeCol, 0, 0.468 * s, -0.01);
      for (const sx of [1, -1]) g.box(0.016, 0.05, 0.012, p.capeCol, sx * 0.05, 0.43 * s, fz(0.43, 0.05) + 0.01, 0, 0, sx * 0.3);
    }
    if (p.logo) {
      const Y = 0.31, z = fz(Y) + 0.004;
      if (p.hero === 'super') { g.box(0.1, 0.1, 0.006, 0xf2d020, 0, Y * s, z, 0, 0, PI / 4); g.box(0.065, 0.065, 0.008, 0xc01818, 0, Y * s, z + 0.002, 0, 0, PI / 4); g.box(0.04, 0.018, 0.01, 0xf2d020, 0, Y * s, z + 0.004); }
      else { g.add(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 12), 0xf2d020, 0, Y * s, z, H, 0, 0, 1, 1, 0.55); g.box(0.09, 0.025, 0.01, 0x141414, 0, Y * s, z + 0.004); }
    }
    if (p.dress === 'toga') {
      g.box(0.3 * b, 0.016, 0.2 * b, p.trim, 0, 0.07 * s, 0.002);                           // gold cord belt
      seg(g, 0.06 * b, 0.46 * s, fz(0.42, 0.08) + 0.006, 0.06 * s, fz(0.06, -0.1) + 0.006, 0.05, 0.006, shade(sc, 0.86), 0.55);   // drape fold
      seg(g, 0.1 * b, 0.46 * s, -fz(0.42, 0.08) - 0.006, 0.08 * s, -fz(0.08, -0.1) - 0.006, 0.05, 0.006, shade(sc, 0.86), -0.55);
    }
    if (p.animal === 'dino') for (let i = 0; i < 5; i++) { const Y = 0.08 + i * 0.09; g.tbox(0.012, 0.05, 0.004, 0.02, 0.05, 0xe8d050, 0, Y * s, -fz(Y) - 0.004, -1.2); }
    if (p.peplum) band(g, 14, 0.05 * s, 0.152 * b, 0.1 * b, -0.06 * s, 0.215 * b, 0.15 * b, () => sc, { off: (k) => (k % 2 ? 0.008 : -0.004), inner: 0.65 });
    return g.build();
  }
  // multiply the colours of everything added since colour index n0 (vertex colours > 1 read as glowing / sparkling)
  function boostFrom(g, n0, k) { for (let i = n0; i < g.c.length; i++) g.c[i] *= k; }

  // ---------------------------------------------------------------------------------------------- pelvis
  const PE = 0.6;
  /** small-print floral: three tones of the ground and print colours (reads as a print at a distance, not as blocks) */
  function floral(main, alt, h) { return h < 0.3 ? mix(main, alt, 0.55) : h < 0.45 ? mix(main, alt, 0.3) : h < 0.52 ? mix(main, 0x3a6a3a, 0.4) : main; }
  function pelvis(p) {
    const { s, b } = p, g = new GB();
    // the shared hips (figure-dependent), so rings and skirts can sit snugly over them
    const jc = (i) => (p.jean ? shade(p.col, 0.94 + 0.12 * hcell(i, 3, 1)) : p.col);
    B.pelvis(g, p, (r, c) => jc(c));
    const hp = B.hipAt(p, 0.075), hq = B.hipAt(p, -0.02);
    if (p.belt !== null && !p.tails) { band(g, CTX.hi ? 16 : 8, 0.092 * s, hp[0] + 0.004, hp[1] + 0.004, 0.06 * s, hp[0] + 0.005, hp[1] + 0.005, () => p.belt, { inner: 0, e: 0.72, z0: hp[2] }); g.box(0.035, 0.026 * s, 0.01, 0xb8b8b0, 0, 0.075 * s, hp[2] + hp[1] + 0.006); }
    if (p.tails) {
      const T = p.tails, curved = T.hem === 'shirt';
      band(g, CTX.hi ? 16 : 10, 0.105 * s, hp[0] + 0.008, hp[1] + 0.008, (ph) => (curved ? -0.03 - 0.035 * Math.abs(Math.cos(ph)) : -0.012) * s, hq[0] + 0.012, hq[1] + 0.012,
        (i, ph, r) => (T.pattern === 'check' ? ((i + r) % 2 ? mix(T.main, T.alt, 0.5) : T.main) : T.pattern === 'hoops' ? T.alt
          : T.pattern === 'floral' ? floral(T.main, T.alt, hcell(i, r, 2)) : T.main),
        { inner: 0.55, e: 0.72, z0: hq[2], gain: T.pattern === 'sequin' ? (i) => 0.8 + hcell(i, 1, 9) : null });
    }
    if (p.bag !== null) {        // small shoulder bag on its chain, at the left hip
      g.box(0.05, 0.13, 0.15, p.bag, hq[0] + 0.035, 0.0, 0.01); g.box(0.054, 0.02, 0.06, p.trim, hq[0] + 0.035, 0.04, 0.04);
    }
    if (p.tail) { g.add(new THREE.CylinderGeometry(0.018, 0.03, 0.4, 6), p.tail, 0, -0.08 * s, -0.12 * b - 0.12, 0.9); }
    return g.build();
  }

  // ---------------------------------------------------------------------------------------------- skirt (own mesh)
  // Hung from the hip-joint line (pelvis origin); characters.js swings it with the thighs and spreads it with the stride.
  const SK = { bodycon: [0.03, 0.16, 0.104, 0.176, 0.124], cami: [0.03, 0.16, 0.104, 0.18, 0.13], skater: [0.085, 0.162, 0.106, 0.2, 0.14], pleated: [0.07, 0.162, 0.106, 0.2, 0.14],
    tutu: [0.06, 0.163, 0.107, 0.21, 0.15], maxi: [0.05, 0.161, 0.105, 0.2, 0.15], toga: [0.05, 0.161, 0.106, 0.19, 0.14], coat: [0.085, 0.172, 0.118, 0.19, 0.135] };
  const SE = 0.65;
  function skirtDims(p) {
    const k = SK[p.kind] || SK.bodycon, f = p.flare;
    const dx = p.fig === 'f' ? 0.02 : 0.01, dz = p.fig === 'f' ? 0.018 : 0.012;      // the shared hips are a little fuller than the old box
    return { yTop: k[0] * p.s, rx0: (k[1] + dx) * p.b, rz0: (k[2] + dz) * p.b, rx1: (k[3] + dx + 0.1 * f) * p.b, rz1: (k[4] + dz + 0.085 * f) * p.b, hem: -p.hem * p.s };
  }
  function skirt(p) {
    const g = new GB(), d = skirtDims(p), n = CTX.hi ? 16 : 10;
    const colFn = (i, ph, r) => {
      let c = p.col;
      if (p.pattern === 'block' && Math.abs(Math.sin(ph)) > 0.8) c = p.alt;
      else if (p.pattern === 'bandage' && r % 2) c = shade(c, 0.84);
      else if (p.pattern === 'floral') c = floral(p.col, p.alt, hcell(i, r, 4));
      else if (p.kind === 'toga' && i % 3 === 0) c = shade(c, 0.88);
      else if (p.kind === 'pleated' && i % 2) c = shade(c, 0.8);
      return c;
    };
    const gain = p.pattern === 'sequin' ? (i, r) => { const h = hcell(i, r, 7); return h > 0.8 ? 2.1 : 0.7 + 0.75 * h; } : null;
    if (p.kind === 'tutu') {          // layered net, spiky hems
      for (let L = 0; L < (CTX.hi ? 3 : 2); L++) {
        const hem = d.hem * (0.7 + L * 0.15), y0 = d.yTop - L * 0.02;
        band(g, n, y0, d.rx0 + L * 0.004, d.rz0 + L * 0.004, (ph) => hem + 0.015 * Math.sin(ph * 8 + L), d.rx1 + 0.03 - L * 0.012, d.rz1 + 0.03 - L * 0.012,
          () => shade(p.col, 1 - L * 0.08), { off: (k) => (k % 2 ? 0.02 : -0.01), inner: 0.75, e: SE });
      }
      return g.build();
    }
    const rows = !CTX.hi ? (p.pattern ? 2 : 1) : p.pattern === 'sequin' || p.pattern === 'bandage' || p.pattern === 'floral' ? 4 : p.kind === 'maxi' ? 3 : 2;
    const hemFn = p.kind === 'toga' ? (ph) => d.hem + 0.07 * Math.sin(ph) * p.s : d.hem;
    const pleat = p.kind === 'skater' ? 0.01 : p.kind === 'pleated' ? 0.014 : p.kind === 'maxi' || p.kind === 'toga' ? 0.008 : 0;
    // a short fitted hip section, then the skirt proper
    if (p.kind === 'bodycon' || p.kind === 'cami') {
      const ym = -0.07 * p.s;
      const hw = B.hipAt(p, 0.095);      // from the waist, so the dress runs on from the torso without a ledge
      band(g, n, 0.1 * p.s, hw[0] + 0.007, hw[1] + 0.007, ym, d.rx0 + 0.01, d.rz0 + 0.008, colFn, { gain, inner: 0, e: SE });
      band(g, n, ym, d.rx0 + 0.01, d.rz0 + 0.008, hemFn, d.rx1, d.rz1, colFn, { gain, rows: Math.max(1, rows - 1), inner: 0.6, e: SE });
    } else {
      const ht = B.hipAt(p, Math.min(0.095, d.yTop / p.s));
      band(g, n, d.yTop, Math.min(d.rx0, ht[0] + 0.012), Math.min(d.rz0, ht[1] + 0.012), hemFn, d.rx1, d.rz1, colFn, { gain, rows, inner: 0.6, e: SE, off: pleat ? (k, t) => (k % 2 ? pleat : -pleat) * t : null });
    }
    return g.build();
  }

  // ---------------------------------------------------------------------------------------------- arms
  function bandsLimb(g, r0, r1, len, y0, col, alt, pattern, jit, bandH = 0.06) {
    if (pattern === 'hoops') {
      const n = Math.max(1, Math.round(len / bandH));
      for (let i = 0; i < n; i++) g.limb(lerp(r0, r1, i / n), lerp(r0, r1, (i + 1) / n), len / n, i % 2 ? alt : col, 0, y0 - (len * i) / n, 0);
    } else g.limb(r0, r1, len, col, 0, y0, 0, 7, jit);
  }
  function upperArm(p) {
    const { b } = p, g = new GB(), L = p.UA, jit = p.pattern === 'check' ? 0.18 : p.pattern === 'sequin' ? 0.3 : p.pattern === 'floral' ? 0.15 : 0;
    const sv = p.sleeves, wide = sv === 'onesie' ? 0.01 : 0;
    if (CTX.hi) g.sph(0.055 * b + wide, 9, 6, p.shoulder, 0, -0.016, 0, 1, 1.0, 1.05);
    else g.limb(0.034 * b, (sv === 'none' ? 0.05 : 0.057) * b + wide, 0.03, p.shoulder, 0, 0.032, 0);      // rounded shoulder (blended into the arm)
    if (sv === 'none') g.limb(0.05 * b, 0.042 * b, L, p.skin, 0, 0, 0);
    else if (sv === 'cap') { g.limb(0.059 * b, 0.055 * b, L * 0.22, p.col, 0, 0.005, 0); g.limb(0.049 * b, 0.042 * b, L * 0.8, p.skin, 0, -L * 0.2, 0); }
    else if (sv === 'short') { bandsLimb(g, 0.058 * b, 0.054 * b, L * 0.5, 0.005, p.col, p.alt, p.pattern, jit); g.limb(0.048 * b, 0.042 * b, L * 0.55, p.skin, 0, -L * 0.45, 0); }
    else bandsLimb(g, 0.055 * b + wide, 0.047 * b + wide, L + 0.01, 0.005, p.col, p.alt, p.pattern, jit);
    if (p.pattern === 'sequin') boostAll(g, 1.15);
    return g.build();
  }
  function boostAll(g, k) { for (let i = 0; i < g.c.length; i++) g.c[i] *= k; }
  function foreArm(p) {
    const { b } = p, g = new GB(), L = p.FA, sv = p.sleeves;
    const jit = p.pattern === 'check' ? 0.18 : p.pattern === 'sequin' ? 0.3 : p.pattern === 'floral' ? 0.15 : 0;
    B.jointBall(g, 0.04 * b, sv === 'long' || sv === 'onesie' ? p.col : p.skin);
    if (sv === 'long' || sv === 'onesie') {
      const wide = sv === 'onesie' ? 0.01 : 0;
      bandsLimb(g, 0.047 * b + wide, 0.042 * b + wide, L, 0.01, p.col, p.alt, p.pattern, jit);
      if (p.cuff !== null) g.limb(0.04 * b, 0.039 * b, 0.025, p.cuff, 0, -L + 0.01, 0);
    } else if (sv === 'rolled') {
      g.limb(0.054 * b, 0.05 * b, 0.055, shade(p.col, 0.86), 0, 0.012, 0, 7, jit);                 // the roll, just below the elbow
      g.limb(0.043 * b, 0.034 * b, L - 0.04, p.skin, 0, -0.04, 0);
    } else g.limb(0.042 * b, 0.034 * b, L, p.skin, 0, 0.01, 0);
    const wy = -L + 0.035;
    if (p.watch) { g.limb(0.04 * b, 0.04 * b, 0.018, 0x1a1a1a, 0, wy + 0.009, 0); g.box(0.026, 0.026, 0.008, 0xc8c8c8, 0.0, wy, 0.04 * b, 0, 0, 0); }
    if (p.wristband) { const n0 = g.c.length; g.limb(0.039 * b, 0.039 * b, 0.014, p.wristband, 0, wy + 0.02, 0); boostFrom(g, n0, 1.6); }
    if (p.glow) { const n0 = g.c.length; for (let i = 0; i < 2; i++) g.add(new THREE.TorusGeometry(0.038 * b, 0.005, 3, 10), p.glow, 0, wy - 0.002 + i * 0.022, 0, H + 0.2 * (i - 0.5), 0, 0); boostFrom(g, n0, 2.4); }
    // hand
    const hy = -L - 0.005;
    B.hand(g, p, hy, p.side, B.gripOf(p.prop) || (p.left ? B.gripOf(p.left[0]) : 0));
    if (p.prop) addProp(g, p.prop, hy - 0.06, p.side, p.seed);
    if (p.left) for (const it of p.left) addProp(g, it, hy - 0.06, p.side, p.seed, p.lc);
    return g.build();
  }

  // ---------------------------------------------------------------------------------------------- legs
  function legBands(g, top, len, r0, r1, bands) {   // bands: [[depth, col, dr, jit]...] from the top
    let y = top;
    for (const [dep, col, dr, jit] of bands) {
      if (dep <= 0.0005) continue;
      const t0 = (top - y) / len, t1 = Math.min(1, (top - y + dep) / len);
      g.limb(lerp(r0, r1, t0) + dr, lerp(r0, r1, t1) + dr, dep, col, 0, y, 0, 7, jit || 0);
      y -= dep;
    }
  }
  function thigh(p) {
    const { b } = p, g = new GB(), L = p.L1, top = 0.03, len = L + 0.045;
    const cd = { full: len, shorts: 0.6 * L + 0.03, play: 0.15, hot: 0.075, none: 0 }[p.cover] ?? 0;
    const dr = p.cover === 'shorts' ? 0.012 : p.cover === 'play' ? 0.014 : p.cover === 'hot' ? 0.003 : p.loose;
    legBands(g, top, len, 0.084 * b, 0.064 * b, [[cd, p.garment, dr, p.jean ? 0.08 : p.sheen ? 0.12 : 0], [len - cd, p.legCol, 0, 0]]);
    if (p.cover === 'hot' || p.cover === 'play') g.limb(0.084 * b + dr + 0.002, 0.083 * b + dr + 0.002, 0.012, shade(p.garment, 0.8), 0, top - cd + 0.012, 0);
    return g.build();
  }
  function shin(p) {
    const { s, b } = p, g = new GB(), L = p.L2, top = 0.03, len = L + 0.03;
    const r0 = 0.063 * b, r1 = 0.044 * b;
    if (p.cover === 'full') legBands(g, top, len, r0, r1, [[len, p.garment, p.loose, p.jean ? 0.08 : p.sheen ? 0.12 : 0]]);
    else if (p.cover === 'rolled') {
      legBands(g, top, len, r0, r1, [[len - 0.11, p.garment, p.loose, 0.04], [0.11, p.skin, 0, 0]]);
      g.limb(r1 + 0.016, r1 + 0.016, 0.032, shade(p.garment, 0.92), 0, top - len + 0.11 + 0.016, 0);
    } else {
      const n0 = g.c.length;
      if (p.socks) legBands(g, top, len, r0, r1, [[0.05, p.legCol, 0, 0], [len - 0.05, 0xf4f4f0, 0.003, 0]]);
      else if (p.legwarmers) { legBands(g, top, len, r0, r1, [[len * 0.42, p.legCol, 0, 0]]); const n1 = g.c.length; legBands(g, top - len * 0.42, len * 0.58, r0 * 0.8 + r1 * 0.2, r1, [[len * 0.58, p.legwarmers, 0.02, 0.25]]); boostFrom(g, n1, 1.5); }
      else legBands(g, top, len, r0, r1, [[len, p.legCol, 0, 0]]);
      void n0;
    }
    if (p.heelH > 0) g.limb(0.04 * b, 0.036 * b, 0.05, p.cover === 'full' ? p.garment : p.legCol, 0, -L + 0.01, 0);
    B.jointBall(g, r0 * 0.98, p.cover === 'full' || p.cover === 'rolled' ? p.garment : p.legCol);
    const T0 = g.tag; g.tag = T_FOOT; shoe(g, p, -L - p.ankle); g.tag = T0;
    return g.build();
  }
  function shoe(g, p, gy) {
    const { s, b } = p, w = 0.1 * b, sc = p.shoeCol, hh = p.heelH, foot = p.legCol;
    switch (p.shoes) {
      case 'trainer': case 'hightop':
        B.shoeForm(g, { last: 'trainer', col: sc, sole: sc === 0xf2f2f2 ? 0xcfcfcf : 0xf2f2f2, w: w / 2, toe: shade(sc, 0.88), top: shade(sc, 0.8) }, gy);
        if (p.shoes === 'hightop') { g.tag = 0; g.limb(0.054 * b, 0.056 * b, 0.11, sc, 0, gy + 0.2, 0); g.tag = T_FOOT; }
        break;
      case 'boat': B.shoeForm(g, { last: 'flat', col: sc, sole: 0xf2f0e6, w: w / 2, top: shade(sc, 0.62) }, gy); break;
      case 'desert':
        B.shoeForm(g, { last: 'boot', col: sc, sole: 0xc89a5a, w: w / 2 }, gy);
        g.tag = 0; g.limb(0.052 * b, 0.054 * b, 0.09, sc, 0, gy + 0.17, 0); g.tag = T_FOOT; break;
      case 'brogue': case 'patent':
        B.shoeForm(g, { last: 'shoe', col: sc, sole: shade(sc, 0.5), w: w / 2, toe: p.shoes === 'patent' ? 0x505058 : shade(sc, 0.78) }, gy); break;
      case 'flats': B.shoeForm(g, { last: 'flat', col: sc, sole: shade(sc, 0.6), w: w * 0.46, foot }, gy); break;      // ballet flats: the instep bare
      case 'sandal':       // a bare foot on a sole, a strap over the toes and one over the instep
        B.shoeForm(g, { last: 'bare', col: foot, sole: sc, soleH: 0.014, w: w * 0.47, toe: shade(foot, 0.95) }, gy);
        g.box(w * 0.98, 0.034 * s, 0.022, sc, 0, gy + (0.014 + 0.017) * s, 0.128 * s);
        g.box(w * 0.9, 0.06 * s, 0.018, sc, 0, gy + (0.014 + 0.03) * s, 0.062 * s); break;
      case 'barefoot': B.shoeForm(g, { last: 'bare', col: p.legCol, w: w / 2, toe: shade(p.legCol, 0.95) }, gy); break;
      case 'platform': case 'stiletto': case 'wedge': case 'ankle-boot': {
        // a court shoe pitched on its heel (the ankle stands heelH higher: makeDims): a thick sole under the ball for a
        // platform, the sole filled in for a wedge, the instep bare except in an ankle boot
        const st = p.shoes === 'stiletto', boot = p.shoes === 'ankle-boot', soleH = p.shoes === 'platform' ? 0.032 : 0.008;
        const lift = Math.max(0.01, hh - (soleH - 0.012) * s), yh = gy + hh + 0.012;
        B.shoeForm(g, { last: 'court', col: sc, sole: shade(sc, p.shoes === 'wedge' ? 0.8 : 0.6), soleH, w: w * (st ? 0.43 : 0.47), foot: boot ? undefined : foot, lift, wedge: p.shoes === 'wedge' }, gy);
        if (p.shoes !== 'wedge') {      // the heel itself
          const hw = st ? 0.014 : p.shoes === 'platform' ? 0.03 : 0.044;
          g.tbox(hw * 0.8, hw * 0.8, hw * 1.1, hw * 1.25, lift + 0.004, shade(sc, 0.85), 0, gy, -0.05 * s);
        }
        if (p.shoes === 'wedge' || p.shoes === 'platform') g.limb(0.039 * b, 0.039 * b, 0.012, sc, 0, yh + 0.085, 0.004);         // ankle strap
        if (boot) g.limb(0.05 * b, 0.048 * b, 0.15, sc, 0, yh + 0.17, 0.0);
        break;
      }
      default: B.shoeForm(g, { last: 'shoe', col: sc, sole: shade(sc, 0.5), w: w / 2 }, gy);
    }
  }

  // ---------------------------------------------------------------------------------------------- head extras
  // new hairstyles (straight, big, curls, topknot, pigtails, sidepart), messy hair, new hats, make-up, face paint, hoops
  function headExtras(g, p, R, hc, ey, ez) {
    const s = p.s, hcol = p.hair, hs = p.hat === 'hood' ? 'none' : p.hairStyle;
    const hs2 = (p.seed | 0) % 97;
    if (p.messy && hs !== 'none' && hs !== 'bald' && hs !== 'buzz') {
      for (let i = 0; i < 5; i++) {
        const a = ((hs2 * 7 + i * 53) % 360) * PI / 180, el = 0.3 + ((hs2 + i * 31) % 50) / 100;
        g.ico(0.03 + (i % 2) * 0.012, shade(hcol, i % 2 ? 1.1 : 0.85), Math.cos(a) * R * Math.cos(el) * 1.02, hc + R * Math.sin(el) * 1.02, Math.sin(a) * R * Math.cos(el) * 0.95);
      }
    }
    // hats
    const top = hc + R * 1.06, hcl = p.hatColor;
    switch (p.hat) {
      case 'cowboy':
        g.cyl(R * 0.92, R * 1.02, 0.12, 10, hcl, 0, hc + R * 0.92 + 0.04, -0.005, -0.08, 0, 0, 0.95, 1.08);
        g.box(0.03, 0.02, R * 1.4, shade(hcl, 0.8), 0, hc + R * 0.92 + 0.1, -0.005, -0.08);
        g.cyl(R * 1.02, R * 1.02, 0.025, 10, shade(hcl, 0.55), 0, hc + R * 0.92, -0.005, -0.08, 0, 0, 0.95, 1.08);
        g.cyl(R * 1.95, R * 1.95, 0.012, 14, hcl, 0, hc + R * 0.86, -0.005, -0.08, 0, 0, 0.9, 1.05);
        for (const sx of [1, -1]) g.box(R * 0.55, 0.012, R * 2.0, hcl, sx * R * 1.55, hc + R * 0.95, -0.005, -0.08, 0, sx * 0.6);
        break;
      case 'cone': {
        const ty = top + 0.03, tz = -0.0, tilt = 0.28;
        g.box(0.26, 0.03, 0.26, 0x202020, 0.02, ty, tz, 0, 0.3, tilt);
        g.add(new THREE.ConeGeometry(0.11, 0.42, 10), hcl, 0.02 - Math.sin(tilt) * 0.21, ty + 0.21 * Math.cos(tilt), tz, 0, 0, tilt);
        for (const f of [0.35, 0.58]) g.add(new THREE.CylinderGeometry(0.11 * (1 - f) + 0.004, 0.11 * (1 - f + 0.08) + 0.004, 0.035, 10, 1, true), 0xf4f4f4, 0.02 - Math.sin(tilt) * 0.42 * f, ty + 0.42 * f * Math.cos(tilt), tz, 0, 0, tilt);
        break;
      }
      case 'laurel': {
        g.add(new THREE.TorusGeometry(R * 0.98, 0.009, 4, 16), hcl, 0, hc + 0.045, -0.004, H - 0.15, 0, 0, 0.92, 1.0, 1);
        for (let i = 0; i < 12; i++) {       // leaves round the sides and back, not over the face
          const aa = (i < 6 ? 1 : -1) * (0.75 + (i % 6) * 0.38);
          g.box(0.012, 0.045, 0.024, i % 2 ? 0x5a8a3a : hcl, Math.sin(aa) * R * 0.94, hc + 0.05 + (i % 2) * 0.01, Math.cos(aa) * R * 0.98 - 0.01, 0, aa, (i < 6 ? 1 : -1) * 0.45);
        }
        break;
      }
      case 'tie-band':
        g.cyl(R * 0.99, R * 0.99, 0.035, 12, hcl, 0, hc + 0.055, -0.004, -0.18, 0, 0, 0.93, 1.0);
        g.box(0.03, 0.035, 0.04, shade(hcl, 0.85), R * 0.9, hc + 0.06, -0.03);
        g.box(0.012, 0.035, 0.042, 0xc8a030, R * 0.93, hc + 0.06, -0.03);
        g.box(0.01, 0.16, 0.045, hcl, R * 0.95, hc - 0.03, -0.06, 0.25, 0, 0.12);
        g.box(0.01, 0.12, 0.035, hcl, R * 0.95, hc - 0.01, -0.1, 0.55, 0, 0.08); break;
      case 'hood': {
        g.sph(R * 1.2, 12, 6, hcl, 0, hc + 0.0, -0.02, 0.95, 1.05, 1.02, H + 0.95, TAU - 1.9, 0, PI * 0.72, 0);     // open at the face
        g.add(new THREE.TorusGeometry(R * 0.88, 0.022, 4, 14), shade(hcl, 0.9), 0, hc + 0.0, R * 0.62, -0.5, 0, 0, 0.92, 1.05, 1);
        const an = p.ears || 'round', ec = an === 'panda' ? 0x141414 : hcl;
        if (an === 'round' || an === 'panda' || an === 'bear') for (const sx of [1, -1]) g.sph(0.045, 7, 5, ec, sx * R * 0.72, top + 0.02, -0.02, 1, 1, 0.5);
        else if (an === 'cat' || an === 'tiger' || an === 'leopard') for (const sx of [1, -1]) g.tbox(0.07, 0.025, 0.008, 0.01, 0.07, hcl, sx * R * 0.6, top - 0.03, -0.01, 0, 0, -sx * 0.25);
        else if (an === 'pikachu') for (const sx of [1, -1]) { g.tbox(0.05, 0.025, 0.02, 0.01, 0.17, hcl, sx * R * 0.55, top - 0.03, -0.01, 0, 0, -sx * 0.5); g.tbox(0.022, 0.014, 0.006, 0.006, 0.05, 0x141414, sx * (R * 0.55 + 0.12 * Math.sin(sx * 0.5)), top + 0.11, -0.01, 0, 0, -sx * 0.5); }
        else if (an === 'cow') for (const sx of [1, -1]) { g.add(new THREE.ConeGeometry(0.018, 0.07, 6), 0xf0e8d0, sx * R * 0.55, top + 0.01, 0, 0, 0, -sx * 0.5); g.box(0.07, 0.03, 0.04, 0xf2f2f0, sx * R * 1.05, hc + 0.05, -0.02, 0, 0, sx * 0.4); }
        else if (an === 'dino') for (let i = 0; i < 4; i++) g.tbox(0.012, 0.05, 0.004, 0.02, 0.05, 0xe8d050, 0, top - 0.01 - i * 0.04, -0.03 - i * 0.05, -0.5 - i * 0.3);
        break;
      }
    }
    // face
    if (p.smudge) for (const sx of [1, -1]) g.box(0.028, 0.012, 0.006, 0x3a2a30, sx * 0.039, ey - 0.017, ez + 0.002);
    if (p.paint !== undefined) {
      const n0 = g.c.length;
      for (const sx of [1, -1]) for (let i = 0; i < 2; i++) g.box(0.04, 0.008, 0.006, p.paint, sx * 0.055, hc - 0.02 - i * 0.018, R * 0.8 - 0.004, 0.0, sx * 0.5, sx * 0.15);
      g.box(0.012, 0.03, 0.006, p.paint2 ?? p.paint, 0, hc + 0.07, R * 0.93, -0.35);
      for (let i = n0; i < g.c.length; i++) g.c[i] *= 2.2;
    }
    if (p.hoops) {
      const n0 = g.c.length;
      for (const sx of [1, -1]) g.add(new THREE.TorusGeometry(0.017, 0.0028, 4, 10), 0xd8b850, sx * R * 0.93, hc - 0.045, -0.002, 0, H, 0);
      for (let i = n0; i < g.c.length; i++) g.c[i] *= 1.3;
    }
  }

  return { torso, pelvis, skirt, skirtDims, upperArm, foreArm, thigh, shin, headExtras, frontZ };
}
