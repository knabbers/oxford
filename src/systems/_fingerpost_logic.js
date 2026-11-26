// Fingerposts (pure part, node-tested by tools/smoke_fingerposts.mjs): where the posts stand, where their fingers point
// and the geometry of one merged mesh. No THREE, no DOM.
//
// The game has no map and no waypoint arrows on purpose (core/features.js): you find your way by looking. These are the
// black cast-iron pedestrian fingerposts Oxford really has at its main corners: each finger points down the street you
// would actually walk (the first leg of the shortest way over the walkers' graph, not the crow's bearing through a
// college wall) and gives the walking time.

/** places a finger can name: [key, text on the finger, x, z, major (1 = worth pointing at from far away, 2 = an outing: every post names its nearest one)] */
export const DESTS = [
  ['centre', 'City Centre', 150, 336, 1],
  ['station', 'Railway Station', -648, 176, 2],
  ['worcester', 'Worcester College', -206, 10, 0],
  ['ashmolean', 'Ashmolean Museum', -5, -18, 0],
  ['broad', 'Broad Street', 330, 60, 0],
  ['radcam', 'Radcliffe Camera', 414, 200, 1],
  ['market', 'Covered Market', 236, 310, 0],
  ['castle', 'Oxford Castle', -205, 352, 0],
  ['chch', 'Christ Church', 232, 531, 0],
  ['river', 'Folly Bridge · River', 250, 930, 2],
  ['botanic', 'Botanic Garden · Punts', 872, 396, 2],
  ['museums', 'Museums · Parks', 262, -380, 1],
  ['meadow', 'Port Meadow', -760, -800, 2],
  ['plain', 'Cowley Road', 1100, 556, 0],
  ['jericho', 'Jericho · Canal', -470, -585, 0],
  ['track', 'Running Track', 1170, 950, 0],
  ['southpark', 'South Park', 1560, 470, 0],
  ['gliding', 'Gliding Club', 1676, -300, 2],
  ['newcoll', 'New College', 524, 93, 0], ['merton', 'Merton College', 546, 401, 0], ['union', 'Oxford Union', 40, 180, 0], ['keble', 'Keble College', 202, -433, 0],   // batch 5
  ['magbridge', 'Magdalen Bridge', 988, 454, 0], ['nparade', 'North Parade', -120, -1066, 0], ['osney', 'Osney Lock · Thames Path', -822, 640, 2],   // districts 2
  ['isislock', 'Isis Lock · Canal', -638, -110, 0], ['wwell', 'Walton Well', -685, -799, 0], ['hhill', 'Headington Hill Park', 1800, 63, 0],   // districts 3
];

/** where posts are wanted (a street corner each; the system slides each to the nearest clear spot of pavement) */
export const POSTS = [
  ['worcester', -203, 7], ['martyrs', 62, 2], ['broadw', 106, 88], ['carfax', 160, 334], ['catte', 382, 8],
  ['stmarys', 465, 263], ['longwall', 778, 294], ['plain', 1103, 561], ['station', -617, 249], ['hythe', -246, 148],
  ['stgiles', 3, -465], ['parks', 259, -293], ['speedwell', 238, 716], ['folly', 230, 876], ['waltonwell', -565, -752],
  ['littleclar', -243, -317], ['airfield', 1676, -294], ['stclements', 1400, 440],
];

export const WALK_M_PER_MIN = 80;
export const minutes = (m) => Math.max(1, Math.round(m / WALK_M_PER_MIN));

/**
 * Single-source shortest paths over the walkers' graph (CSR: count, X, Z, start, nbr). Returns { dist, prev }.
 * A typed binary heap; ~10 ms for the whole city.
 */
export function dijkstra(G, src) {
  const N = G.count, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  let cap = 1024, hk = new Float64Array(cap), hv = new Int32Array(cap), n = 0;
  const push = (k, v) => {
    if (n === cap) { cap *= 2; const a = new Float64Array(cap), b = new Int32Array(cap); a.set(hk); b.set(hv); hk = a; hv = b; }
    let i = n++;
    while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; }
    hk[i] = k; hv[i] = v;
  };
  const pop = () => {
    const top = hv[0]; n--;
    if (n > 0) {
      const k = hk[n], v = hv[n]; let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && hk[c + 1] < hk[c]) c++; if (hk[c] >= k) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; }
      hk[i] = k; hv[i] = v;
    }
    return top;
  };
  dist[src] = 0; push(0, src);
  while (n) {
    const u = pop(); if (done[u]) continue; done[u] = 1;
    for (let e = G.start[u]; e < G.start[u + 1]; e++) {
      const v = G.nbr[e]; if (done[v]) continue;
      const d = dist[u] + Math.hypot(G.X[v] - G.X[u], G.Z[v] - G.Z[u]);
      if (d < dist[v]) { dist[v] = d; prev[v] = u; push(d, v); }
    }
  }
  return { dist, prev };
}

/** the point `lead` metres from the source along the shortest path to node b (walking prev back from b) */
export function firstLeg(G, sp, b, lead = 45) {
  let v = b;
  while (sp.prev[v] >= 0 && sp.dist[sp.prev[v]] > lead) v = sp.prev[v];
  return [G.X[v], G.Z[v]];
}

/**
 * Which fingers a post carries: the three nearest places worth a sign (further than `minD`), then the nearest outing
 * (major 2) and the nearest other major place not already on it. cands: [{ key, name, d, bx, bz (unit bearing), major }].
 */
export function chooseFingers(cands, minD = 110, max = 5) {
  const ok = cands.filter((c) => Number.isFinite(c.d) && c.d >= minD).sort((a, b) => a.d - b.d);
  const out = ok.slice(0, 3);
  const add = (test) => { const c = ok.find((q) => test(q) && !out.includes(q)); if (c && out.length < max) out.push(c); };
  add((q) => q.major === 2); add((q) => q.major); add((q) => q.major);
  return out.sort((a, b) => a.d - b.d);
}

export const POST_H = 3.45, FINGER_L = 1.62, FINGER_H = 0.25, FINGER_GAP = 0.3, FINGER_TOP = 3.13;

/**
 * Geometry for every post as flat arrays (one mesh). posts: [{ x, z, y, fingers: [{ bx, bz, row }] }], `row` = the
 * finger's row in the text atlas; uvRow(row) -> [u0, v0, u1, v1] of its text; uvBlack / uvGold = a texel of each paint.
 */
export function buildGeometry(posts, uvRow, uvBlack, uvGold) {
  const pos = [], nor = [], uv = [], idx = [];
  const vert = (x, y, z, nx, ny, nz, u, v) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(u, v); return pos.length / 3 - 1; };
  const tube = (cx, cz, y0, y1, r0, r1, t) => {
    const S = 6;
    for (let i = 0; i < S; i++) {
      const a0 = (i / S) * Math.PI * 2, a1 = ((i + 1) / S) * Math.PI * 2, am = (a0 + a1) / 2, nx = Math.cos(am), nz = Math.sin(am);
      const a = vert(cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0, nx, 0.1, nz, t[0], t[1]);
      const b = vert(cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0, nx, 0.1, nz, t[0], t[1]);
      const c = vert(cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1, nx, 0.1, nz, t[0], t[1]);
      const d = vert(cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1, nx, 0.1, nz, t[0], t[1]);
      idx.push(a, c, b, a, d, c);
    }
  };
  for (const p of posts) {
    const y = p.y || 0;
    tube(p.x, p.z, y, y + 0.34, 0.1, 0.085, uvBlack);            // plinth
    tube(p.x, p.z, y + 0.34, y + 0.4, 0.105, 0.105, uvGold);     // gold band
    tube(p.x, p.z, y + 0.4, y + POST_H - 0.12, 0.055, 0.05, uvBlack);
    tube(p.x, p.z, y + POST_H - 0.12, y + POST_H - 0.06, 0.075, 0.075, uvGold);
    tube(p.x, p.z, y + POST_H - 0.06, y + POST_H + 0.16, 0.07, 0.0, uvBlack);   // finial
    p.fingers.forEach((f, k) => {
      const yc = y + FINGER_TOP - k * FINGER_GAP, y0 = yc - FINGER_H / 2, y1 = yc + FINGER_H / 2;
      // local frame: +a along the finger (bx, bz), +n its front face normal (to the left of the pointing direction)
      const ax = f.bx, az = f.bz, nx = az, nz = -ax, T = 0.016;
      const [u0, v0, u1, v1] = uvRow(f.row);
      const a0 = 0.05, a1 = a0 + FINGER_L, tip = a1 + 0.13;
      for (const s of [1, -1]) {
        const ox = nx * T * s, oz = nz * T * s;
        // text face: seen from the front (+n) the finger points to the viewer's left, from the back to the right;
        // either way the text reads from the viewer's left
        const ua = s > 0 ? u1 : u0, ub = s > 0 ? u0 : u1;
        const A = vert(p.x + ax * a0 + ox, y0, p.z + az * a0 + oz, nx * s, 0, nz * s, ua, v0);
        const B = vert(p.x + ax * a1 + ox, y0, p.z + az * a1 + oz, nx * s, 0, nz * s, ub, v0);
        const C = vert(p.x + ax * a1 + ox, y1, p.z + az * a1 + oz, nx * s, 0, nz * s, ub, v1);
        const D = vert(p.x + ax * a0 + ox, y1, p.z + az * a0 + oz, nx * s, 0, nz * s, ua, v1);
        if (s > 0) idx.push(A, C, B, A, D, C); else idx.push(A, B, C, A, C, D);
        // the point
        const E = vert(p.x + ax * a1 + ox, y0, p.z + az * a1 + oz, nx * s, 0, nz * s, uvBlack[0], uvBlack[1]);
        const F = vert(p.x + ax * tip + ox, yc, p.z + az * tip + oz, nx * s, 0, nz * s, uvBlack[0], uvBlack[1]);
        const H = vert(p.x + ax * a1 + ox, y1, p.z + az * a1 + oz, nx * s, 0, nz * s, uvBlack[0], uvBlack[1]);
        if (s > 0) idx.push(E, H, F); else idx.push(E, F, H);
      }
      // top and bottom edges (thin, black)
      for (const [yy, ny] of [[y1, 1], [y0, -1]]) {
        const A = vert(p.x + ax * a0 + nx * T, yy, p.z + az * a0 + nz * T, 0, ny, 0, uvBlack[0], uvBlack[1]);
        const B = vert(p.x + ax * a1 + nx * T, yy, p.z + az * a1 + nz * T, 0, ny, 0, uvBlack[0], uvBlack[1]);
        const C = vert(p.x + ax * a1 - nx * T, yy, p.z + az * a1 - nz * T, 0, ny, 0, uvBlack[0], uvBlack[1]);
        const D = vert(p.x + ax * a0 - nx * T, yy, p.z + az * a0 - nz * T, 0, ny, 0, uvBlack[0], uvBlack[1]);
        if (ny > 0) idx.push(A, C, B, A, D, C); else idx.push(A, B, C, A, C, D);
      }
    });
  }
  return { pos, nor, uv, idx };
}
