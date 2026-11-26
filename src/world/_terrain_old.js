// The first hill (2026-11, before the survey): a GUESS from spot heights — the least of a fan of planes run through a
// ramp of eight straight pieces, 38 m over 650 m, Headington Hill / South Park only, everything else dead flat. Kept
// for before / after pictures: `?terrain=old` (node GTO_TERRAIN=old). See world/terrain.js.
const H = 38, W = 650, MINX = 1690;

// planes d_k(x, z) = ax * x + az * z + c (metres "into the hill"); the hill's distance is the least of them
const PLANES = (() => {
  const P = [], R = 120;
  // foot 1: x = 1700 (Marston Road side); foot 2: the back of Cowley Road, 60 m in
  const n1 = [1, 0], n2 = [0.54, -0.84], l2 = Math.hypot(n2[0], n2[1]); n2[0] /= l2; n2[1] /= l2;
  const c1 = -1700, c2 = -(1954 * 0.54 - 1012 * 0.84 + 60) / l2;
  // C: where both are R in — the fan of planes between the two is tangent to circles about it (a rounded spur)
  const det = n1[0] * n2[1] - n1[1] * n2[0], r1 = R - c1, r2 = R - c2;
  const Cx = (r1 * n2[1] - n1[1] * r2) / det, Cz = (n1[0] * r2 - r1 * n2[0]) / det;
  const a1 = Math.atan2(n1[1], n1[0]), a2 = Math.atan2(n2[1], n2[0]), K = 5;
  for (let k = 0; k < K; k++) { const a = a1 + (a2 - a1) * k / (K - 1), nx = Math.cos(a), nz = Math.sin(a); P.push([nx, nz, R - nx * Cx - nz * Cz]); }
  // north: down again between z = -290 and z = -560 (beyond Headington Road, towards the airfield)
  const kn = 650 / 270; P.push([0, kn, 560 * kn]);
  return P;
})();
const SEG = W / 8, SLOPES = [0.3, 0.8, 1.3, 1.6, 1.6, 1.3, 0.8, 0.3].map((s) => s * H / W);

const dist = (x, z) => { let d = 1e9; for (let k = 0; k < PLANES.length; k++) { const p = PLANES[k], v = p[0] * x + p[1] * z + p[2]; if (v < d) d = v; } return d; };
const ramp = (d) => { let h = 0; for (let i = 0; i < 8; i++) { const t = d - i * SEG; if (t <= 0) break; h += SLOPES[i] * (t < SEG ? t : SEG); } return h; };

const f = (n) => { const s = String(+n.toFixed(6)); return /[.e]/.test(s) ? s : s + '.0'; };
// every straight line a crease can lie on, as [ax, az, c] with ax * x + az * z + c = 0: each plane at each break of the
// ramp, and each pair of planes where they are equal
const CREASES = (() => {
  const L = [];
  for (const p of PLANES) for (let j = 0; j <= 8; j++) L.push([p[0], p[1], p[2] - j * SEG]);
  for (let i = 0; i < PLANES.length; i++) for (let k = i + 1; k < PLANES.length; k++) L.push([PLANES[i][0] - PLANES[k][0], PLANES[i][1] - PLANES[k][1], PLANES[i][2] - PLANES[k][2]]);
  return L;
})();

export const FAN = {
  minX: MINX,
  /** height of the drawn ground above the flat world at (x, z), metres: 0 over the whole original city */
  h(x, z) { if (x < MINX) return 0; const d = dist(x, z); return d <= 0 ? 0 : ramp(d); },
  glsl: `
#ifndef GTO_TERRAIN
#define GTO_TERRAIN
float gtoTerrain(vec2 p) {
	float d = ${PLANES.map((p) => `${f(p[0])} * p.x + ${f(p[1])} * p.y + ${f(p[2])}`).reduce((a, b) => `min(${a}, ${b})`)};
	return ${SLOPES.map((s, i) => `${f(s)} * clamp(d - ${f(i * SEG)}, 0.0, ${f(SEG)})`).join(' + ')};
}
#define GTO_DH(p) (projectionMatrix[3][3] == 0.0 ? viewMatrix[1].xyz * (gtoTerrain(p) - gtoTerrain(cameraPosition.xz)) : vec3(0.0))
#define GTO_DHW(p) GTO_DH(p)
#define GTO_DHM(p) GTO_DH(p)
#endif
`,
  /** where to cut the straight edge from (ax, az) to (ax + dx, az + dz) whose ends stand at ta, tc: the crease crossing at which it is furthest off the hill (0 = nowhere) */
  cutAt(ax, az, dx, dz, ta, tc, tol) {
    if (dx * dx + dz * dz < 0.36) return 0;
    let quick = false;
    for (let k = 1; k < 8; k++) { const q = k / 8; if (Math.abs(FAN.h(ax + dx * q, az + dz * q) - (ta + (tc - ta) * q)) > tol * 0.4) { quick = true; break; } }
    if (!quick) return 0;
    let best = 0, bt = 0;
    for (let k = 0; k < CREASES.length; k++) {
      const L = CREASES[k], va = L[0] * ax + L[1] * az + L[2], den = L[0] * dx + L[1] * dz;
      if (den === 0) continue;
      const t = -va / den; if (t <= 0.01 || t >= 0.99) continue;
      const dev = Math.abs(FAN.h(ax + dx * t, az + dz * t) - (ta + (tc - ta) * t));
      if (dev > best) { best = dev; bt = t; }
    }
    return best > tol ? bt : 0;
  },
};
