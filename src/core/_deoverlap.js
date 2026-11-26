// De-overlap pass (z-fighting): where two surfaces of a freshly built scene lie in the same plane, face the same way and
// overlap, the depth buffer cannot order them and they flicker. This finds such pairs (the same test as
// tools/audit_zfight.mjs) and sinks the LARGER coplanar patch a hair (1.5 mm per layer) into its own solid, so the
// smaller thing on top (a sign, a slip, a rail, the end of a leg) wins cleanly. Sinking never opens a crack: the faces
// round the sunk patch still cover its edge. Runs once per scene, on static non-instanced meshes only; pairs whose
// materials are deliberately layered (different polygonOffset / depth-bias program) are left alone, and so is one plain
// untextured material lying over itself (nothing to see). No per-frame cost.
//   deoverlap(scene, { eps = 0.0015, tol = 0.0008, maxTris = 300000 }) -> { tris, pairs, patches, moved, ms }
//   deoverlapSteps(scene, opts): the same work as a generator that yields every ~0.3 ms of work (resumable: the world
//     pass runs it a few ms per idle period, never one long task); its return value is deoverlap's result.
import * as THREE from 'three';

const NS = 0.02, DS = 0.01, CS = 2;
const hkey = (a, b, c, d, x, y, z, s) => (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761) ^ (x * 40503) ^ (y * 2246822519) ^ (z * 3266489917) ^ (s * 668265263)) >>> 0);

function clipArea(A, B) {
  let poly = [A[0], A[1], A[2], A[3], A[4], A[5]];
  const sgn = (B[2] - B[0]) * (B[5] - B[1]) - (B[4] - B[0]) * (B[3] - B[1]) > 0 ? 1 : -1;
  for (let e = 0; e < 3 && poly.length >= 6; e++) {
    const x0 = B[e * 2], y0 = B[e * 2 + 1], x1 = B[((e + 1) % 3) * 2], y1 = B[((e + 1) % 3) * 2 + 1], out = [];
    for (let i = 0; i < poly.length; i += 2) {
      const px = poly[i], py = poly[i + 1], j = (i + 2) % poly.length, qx = poly[j], qy = poly[j + 1];
      const sp = sgn * ((x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)), sq = sgn * ((x1 - x0) * (qy - y0) - (y1 - y0) * (qx - x0));
      if (sp >= 0) out.push(px, py);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); out.push(px + (qx - px) * t, py + (qy - py) * t); }
    }
    poly = out;
  }
  let a = 0; for (let i = 0; i < poly.length; i += 2) { const j = (i + 2) % poly.length; a += poly[i] * poly[j + 1] - poly[j] * poly[i + 1]; }
  return Math.abs(a) / 2;
}

/**
 * Outdoors: each place module's own static objects, one top-level object at a time (never vehicles, people, props, or
 * the merged city itself, which is far too big to scan at load and belongs to world/), with a deeper step because depth
 * precision falls with distance (2 cm). budgetMs stops starting new objects once the time is spent.
 */
export function deoverlapWorld(scene, opts = {}) {
  const moving = opts.city ? /vehic|traffic|police|pedestr|friend|crowd|props|^core$|player|net/i : /vehic|traffic|police|pedestr|friend|crowd|props|^core$|player|net|^world$/i, budget = opts.budgetMs ?? 1500;
  const now = () => (typeof performance !== 'undefined' ? performance : Date).now(), t0 = now();
  const out = { objects: 0, tris: 0, pairs: 0, patches: 0, moved: 0, ms: 0, skipped: 0 };
  for (const o of scene.children.slice()) {
    const owner = String((o.userData && o.userData.owner) || o.name || '');
    if (!owner || moving.test(owner)) continue;
    if (now() - t0 > budget) { out.skipped++; continue; }
    const r = deoverlap(o, { eps: 0.02, maxTris: 400000, ...opts });
    if (r.skipped) out.skipped++;
    out.objects++; out.tris += r.tris; out.pairs += r.pairs; out.patches += r.patches; out.moved += r.moved;
  }
  out.ms = now() - t0;
  return out;
}

/**
 * The same, but spread over the first seconds of play instead of the loading screen (all of it is ~4 s of work, too much
 * to add to the load): resumable (deoverlapSteps), run in idle periods (requestIdleCallback) for at most `sliceMs`
 * (3 ms) a time, so no frame ever waits on it; starting after `delay` ms. Returns the running totals object
 * (done: true at the end; worstSlice / slices for the probes).
 */
export function deoverlapWorldLater(scene, opts = {}) {
  const moving = /vehic|traffic|police|pedestr|friend|crowd|props|^core$|player|net|^world$/i;
  const list = scene.children.filter((o) => { const owner = String((o.userData && o.userData.owner) || o.name || ''); return owner && !moving.test(owner); });
  const out = { objects: 0, tris: 0, pairs: 0, patches: 0, moved: 0, ms: 0, left: list.length, done: false, slices: 0, worstSlice: 0, worstAt: '', t0: 0, t1: 0 };
  const now = () => (typeof performance !== 'undefined' ? performance : Date).now();
  // (pool: the big typed arrays are kept from one object to the next: allocating ~50 MB per object made V8 run a full GC
  // for the external memory every few objects, a 40-50 ms pause the slicing cannot split)
  const SLICE = opts.sliceMs ?? 3, o2 = { eps: 0.02, maxTris: 400000, ...opts, pool: {} };
  const idle = typeof requestIdleCallback === 'function';
  let it = null, cur = '', at = '';
  const step = (dl) => {
    const t0 = now();
    // in an idle period: what is left of it (a frame's idle time) up to SLICE; when the idle callback timed out (a busy
    // stretch with no idle time at all) or there is no requestIdleCallback, a short slice anyway so it still finishes
    const lim = dl && !dl.didTimeout && dl.timeRemaining ? Math.max(0.5, Math.min(SLICE, dl.timeRemaining() - 0.5)) : Math.min(SLICE, 1.5);
    while (now() - t0 < lim) {
      if (!it) {
        if (!list.length) break;
        const o = list.shift(); if (!o.parent) continue;
        it = deoverlapSteps(o, o2); cur = String(o.userData.owner || o.name);
      }
      let r;
      try { r = it.next(); } catch (e) { it = null; continue; }   // (skip this one)
      at = r.value;
      if (r.done) { const v = r.value; it = null; out.objects++; out.tris += v.tris; out.pairs += v.pairs; out.patches += v.patches; out.moved += v.moved; }
    }
    const d = now() - t0;
    out.ms += d; out.slices++; if (d > out.worstSlice) { out.worstSlice = d; out.worstAt = cur + ':' + (typeof at === 'string' ? at : 'end'); }
    out.left = list.length + (it ? 1 : 0);
    if (out.left) schedule(); else { out.done = true; out.t1 = now(); o2.pool = null; }
  };
  const schedule = () => (idle ? requestIdleCallback(step, { timeout: 300 }) : setTimeout(step, 16));
  setTimeout(() => { out.t0 = now(); schedule(); }, opts.delay ?? 2500);
  return out;
}

export function deoverlap(scene, opts = {}) {
  const it = deoverlapSteps(scene, opts);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

/** deoverlap as a generator: yields every WORK units of work (~0.2–0.5 ms); returns the result. The scene is only
 *  written in the last step (the sink); the matrices are the ones read at the start, so a sliced run sinks the same. */
const WORK = 6000;
function grab(pool, k, C, n) {
  let a = pool[k];
  if (!a || a.length < n) a = pool[k] = new C(Math.max(n, Math.ceil((a ? a.length : 0) * 1.5)));
  return a.length === n ? a : a.subarray(0, n);
}
export function* deoverlapSteps(scene, opts = {}) {
  const pool = opts.pool || null, A = (k, C, n) => (pool ? grab(pool, k, C, n) : new C(n));   // (pooled arrays come back dirty)
  const eps = opts.eps ?? 0.0015, TOL = opts.tol ?? 0.0008, maxTris = opts.maxTris ?? 300000, MINA = opts.minArea ?? 2e-5;
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const res = { tris: 0, pairs: 0, patches: 0, moved: 0, ms: 0 };
  let work = 0;
  // ---- collect
  const M = [];   // meshes: {o, pos, idx, sig, mat, plain, self, start, inv}
  let total = 0;
  scene.updateMatrixWorld(true);
  const uses = new Map();   // a geometry drawn by several meshes cannot be nudged for one of them
  scene.traverse((o) => { if (o.isMesh && o.geometry) uses.set(o.geometry, (uses.get(o.geometry) || 0) + 1); });
  const skip = opts.skip || null;   // (object) => true: leave this mesh alone (things that move)
  scene.traverse((o) => {
    if (skip && o.isMesh && skip(o)) return;
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isSprite || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    const g = o.geometry, mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || mat.visible === false || mat.depthTest === false || g.userData.deoverlapped || g.morphAttributes.position) return;
    if (g.attributes.position.isInterleavedBufferAttribute || uses.get(g) > 1) return;
    const cnt = g.index ? g.index.count : g.attributes.position.count; if (cnt < 3) return;
    let key = ''; try { key = mat.customProgramCacheKey ? String(mat.customProgramCacheKey()) : ''; } catch (e) { /* */ }
    // What orders two materials in depth on purpose: polygonOffset, world/materials.js addDepthBias (it leaves
    // userData.depthBias) and the facade's / the ground's own bias. NOT the rest of the key: three's default
    // key is the text of onBeforeCompile, so any material with a shader hook — and on the top tier every wall and floor
    // of world.mats has one (world/_surf_detail.js) — used to count as "deliberately layered" against every material
    // without it, and nothing lying on such a wall or floor was ever sunk there: a window's lining in a shop wall's own
    // plane, skirtings, panels (seen 2026-11-22 in every street shop on the top tier, and only there).
    const db = mat.userData && mat.userData.depthBias !== undefined ? 'db' + mat.userData.depthBias : '', D = mat.defines || {};
    M.push({ o, g, mw: o.matrixWorld.clone(), pos: g.attributes.position, idx: g.index, start: total, n: Math.floor(cnt / 3), mat: mat.uuid,
      sig: (mat.polygonOffset ? 'po' + mat.polygonOffsetFactor + '/' + mat.polygonOffsetUnits : '') + '|' + db + (D.USE_WALL_BIAS !== undefined ? '|wb' : '') + (D.USE_LAYER_BIAS !== undefined ? '|lb' : ''),
      plain: !mat.map && !mat.vertexColors && !g.attributes.color, dbl: mat.side === THREE.DoubleSide, self: !!(mat.defines && mat.defines.USE_LAYER_BIAS !== undefined) });
    total += Math.floor(cnt / 3);
  });
  res.tris = total;
  if (!total || total > maxTris) { res.skipped = total > maxTris; return res; }
  yield 'c';
  const P = A('P', Float32Array, total * 9), N = A('N', Float32Array, total * 4), MID = A('MID', Int32Array, total), v = new THREE.Vector3();
  for (let mi = 0; mi < M.length; mi++) {
    const m = M[mi], mw = m.mw;
    for (let t = 0; t < m.n; t++) {
      if ((work += 6) > WORK) { work = 0; yield 'x'; }
      const i = m.start + t, o = i * 9; MID[i] = mi;
      for (let k = 0; k < 3; k++) { const vi = m.idx ? m.idx.getX(t * 3 + k) : t * 3 + k; v.fromBufferAttribute(m.pos, vi).applyMatrix4(mw); P[o + k * 3] = v.x; P[o + k * 3 + 1] = v.y; P[o + k * 3 + 2] = v.z; }
      const ax = P[o], ay = P[o + 1], az = P[o + 2], e1x = P[o + 3] - ax, e1y = P[o + 4] - ay, e1z = P[o + 5] - az, e2x = P[o + 6] - ax, e2y = P[o + 7] - ay, e2z = P[o + 8] - az;
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz);
      if (l < 2e-6) { N[i * 4 + 3] = NaN; continue; }
      nx /= l; ny /= l; nz /= l; N[i * 4] = nx; N[i * 4 + 1] = ny; N[i * 4 + 2] = nz; N[i * 4 + 3] = nx * ax + ny * ay + nz * az;
    }
  }
  // ---- pairs (plane + cell hash)
  // The buckets are typed arrays sized up front (a Map of a million small arrays stalled for tens of ms as it grew and
  // rehashed, and its arrays made the GC copy them; neither can be sliced): an open-addressed table hash -> bucket, and
  // each bucket a list of its first 400 triangles (the only ones ever tested). First the cells each triangle touches.
  const BX = A('BX', Int32Array, total * 8); let E = 0;
  for (let i = 0; i < total; i++) {
    if ((work += 1) > WORK) { work = 0; yield 'b'; }
    const d = N[i * 4 + 3], b8 = i * 8; BX[b8 + 7] = 0; if (d !== d) continue;
    const o = i * 9, nx = N[i * 4], ny = N[i * 4 + 1], nz = N[i * 4 + 2], neg = nx < -1e-6 || (Math.abs(nx) <= 1e-6 && (ny < -1e-6 || (Math.abs(ny) <= 1e-6 && nz < 0))), dk = neg ? -d : d;
    const x0 = Math.floor(Math.min(P[o], P[o + 3], P[o + 6]) / CS), x1 = Math.floor(Math.max(P[o], P[o + 3], P[o + 6]) / CS), y0 = Math.floor(Math.min(P[o + 1], P[o + 4], P[o + 7]) / CS), y1 = Math.floor(Math.max(P[o + 1], P[o + 4], P[o + 7]) / CS),
      z0 = Math.floor(Math.min(P[o + 2], P[o + 5], P[o + 8]) / CS), z1 = Math.floor(Math.max(P[o + 2], P[o + 5], P[o + 8]) / CS);
    const cells = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
    if (cells > 4000) continue;
    const dq0 = Math.floor((dk - TOL) / DS), dq1 = Math.floor((dk + TOL) / DS);
    BX[b8] = x0; BX[b8 + 1] = x1; BX[b8 + 2] = y0; BX[b8 + 3] = y1; BX[b8 + 4] = z0; BX[b8 + 5] = z1; BX[b8 + 6] = dq0; BX[b8 + 7] = dq1 - dq0 + 1;
    E += 2 * (dq1 - dq0 + 1) * cells;
  }
  let bits = 1; while ((1 << bits) < E * 2 && bits < 30) bits++;
  const TM = (1 << bits) - 1, SH = 32 - bits, tK = A('tK', Uint32Array, TM + 1), tB = A('tB', Int32Array, TM + 1);
  if (pool) for (let a = 0; a <= TM; a += 262144) { tB.fill(0, a, Math.min(TM + 1, a + 262144)); yield 'z'; }
  const bHead = A('bH', Int32Array, E + 1), bTail = A('bT', Int32Array, E + 1), bCnt = A('bC', Uint16Array, E + 1), eTri = A('eT', Int32Array, E), eNext = A('eN', Int32Array, E);
  let nB = 0, nE = 0;
  yield 'b0';
  const seen = A('seen', Int32Array, total).fill(-1), pairs = [], hot = A('hot', Uint8Array, total).fill(0);
  const A2 = new Float64Array(6), B2 = new Float64Array(6), pairSet = new Set();
  const test = (i, j) => {
    const mi = M[MID[i]], mj = M[MID[j]];
    if (mi.sig !== mj.sig || (MID[i] === MID[j] && mi.self) || (mi.mat === mj.mat && mi.plain)) return;
    const ni = i * 4, nj = j * 4, nx = N[ni], ny = N[ni + 1], nz = N[ni + 2];
    const dot = nx * N[nj] + ny * N[nj + 1] + nz * N[nj + 2];
    if (dot < 0.99995 && !(dot < -0.99995 && (mi.dbl || mj.dbl))) return;       // back to back only fights when one is double sided
    const d = N[ni + 3], pi = i * 9, pj = j * 9;
    for (let k = 0; k < 3; k++) if (Math.abs(nx * P[pj + k * 3] + ny * P[pj + k * 3 + 1] + nz * P[pj + k * 3 + 2] - d) > TOL) return;
    let ux, uy, uz; if (Math.abs(nx) < 0.8) { ux = 0; uy = -nz; uz = ny; } else { ux = -nz; uy = 0; uz = nx; }
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul; const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
    for (let k = 0; k < 3; k++) {
      const ax = P[pi + k * 3], ay = P[pi + k * 3 + 1], az = P[pi + k * 3 + 2], bx = P[pj + k * 3], by = P[pj + k * 3 + 1], bz = P[pj + k * 3 + 2];
      A2[k * 2] = ax * ux + ay * uy + az * uz; A2[k * 2 + 1] = ax * vx + ay * vy + az * vz; B2[k * 2] = bx * ux + by * uy + bz * uz; B2[k * 2 + 1] = bx * vx + by * vy + bz * vz;
    }
    if (!(clipArea(A2, B2) >= MINA)) return;
    pairs.push(i, j); hot[i] = hot[j] = 1; pairSet.add(i < j ? i * 4194304 + j : j * 4194304 + i);
  };
  for (let i = 0; i < total; i++) {
    if ((work += 2) > WORK) { work = 0; yield 'p'; }
    const b8 = i * 8, nd = BX[b8 + 7]; if (!nd) continue;
    let nx = N[i * 4], ny = N[i * 4 + 1], nz = N[i * 4 + 2];
    if (nx < -1e-6 || (Math.abs(nx) <= 1e-6 && (ny < -1e-6 || (Math.abs(ny) <= 1e-6 && nz < 0)))) { nx = -nx; ny = -ny; nz = -nz; }
    const x0 = BX[b8], x1 = BX[b8 + 1], y0 = BX[b8 + 2], y1 = BX[b8 + 3], z0 = BX[b8 + 4], z1 = BX[b8 + 5], dq0 = BX[b8 + 6], dq1 = dq0 + nd - 1;
    for (let tb = 0; tb < 2; tb++) {
      const off = tb * 0.5, qa = Math.floor(nx / NS + off), qb = Math.floor(ny / NS + off), qc = Math.floor(nz / NS + off);
      for (let dq = dq0; dq <= dq1; dq++) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        if ((work += 2) > WORK) { work = 0; yield 'q'; }
        const k = hkey(qa, qb, qc, dq, x, y, z, tb);
        let h = Math.imul(k, 0x9e3779b1) >>> SH;
        while (tB[h] && tK[h] !== k) h = (h + 1) & TM;
        const b = tB[h];
        if (!b) { tB[h] = ++nB; tK[h] = k; bHead[nB] = bTail[nB] = nE; bCnt[nB] = 1; eTri[nE] = i; eNext[nE++] = -1; continue; }
        const lim = bCnt[b]; work += lim;
        for (let q = 0, e = bHead[b]; q < lim; q++, e = eNext[e]) { const j = eTri[e]; if (seen[j] !== i) { seen[j] = i; test(j, i); } }
        if (lim < 400) { eTri[nE] = i; eNext[nE] = -1; eNext[bTail[b]] = nE; bTail[b] = nE++; bCnt[b] = lim + 1; }
      }
    }
  }
  res.pairs = pairs.length / 2;
  if (!pairs.length) { res.ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0; return res; }
  // ---- patches: triangles of one mesh in one plane joined across shared EDGES, never joining two that overlap each
  // other (two walls on one footing stay two patches); only in planes that have a conflict
  yield 'h0';
  const parent = A('par', Int32Array, total); for (let i = 0; i < total; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const hotPlane = new Set(), pkey = (i) => MID[i] + ':' + Math.round(N[i * 4] * 500) + ':' + Math.round(N[i * 4 + 1] * 500) + ':' + Math.round(N[i * 4 + 2] * 500) + ':' + Math.round(N[i * 4 + 3] * 500);
  for (let i = 0; i < total; i++) { if ((work += 1) > WORK) { work = 0; yield 'h'; } if (hot[i]) hotPlane.add(pkey(i)); }
  const corners = Array.from({ length: 64 }, () => new Map());
  for (let i = 0; i < total; i++) {
    if ((work += 1) > WORK) { work = 0; yield 'k'; }
    if (N[i * 4 + 3] !== N[i * 4 + 3]) continue;
    const pk = pkey(i); work += 6; if (!hotPlane.has(pk)) continue;
    const corner = corners[MID[i] & 63];      // (the mesh is part of the key)
    work += 40;
    const ck = [0, 1, 2].map((k) => { const o = i * 9 + k * 3; return Math.round(P[o] * 2000) + ',' + Math.round(P[o + 1] * 2000) + ',' + Math.round(P[o + 2] * 2000); });
    for (let k = 0; k < 3; k++) {
      const a0 = ck[k], a1 = ck[(k + 1) % 3], ek = pk + '|' + (a0 < a1 ? a0 + '|' + a1 : a1 + '|' + a0);
      const L = corner.get(ek);
      if (!L) { corner.set(ek, [i]); continue; }
      for (const j of L) { if (pairSet.has(j < i ? j * 4194304 + i : i * 4194304 + j)) continue; const a = find(i), b = find(j); if (a !== b) parent[a] = b; }
      if (L.length < 8) L.push(i);
    }
  }
  const area = new Map(), nb = new Map();
  const triArea = (i) => { const o = i * 9, e1x = P[o + 3] - P[o], e1y = P[o + 4] - P[o + 1], e1z = P[o + 5] - P[o + 2], e2x = P[o + 6] - P[o], e2y = P[o + 7] - P[o + 1], e2z = P[o + 8] - P[o + 2]; return Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x) / 2; };
  for (let i = 0; i < total; i++) { if ((work += 7) > WORK) { work = 0; yield 'a'; } if (N[i * 4 + 3] !== N[i * 4 + 3] || !hotPlane.has(pkey(i))) continue; const r = find(i); area.set(r, (area.get(r) || 0) + triArea(i)); }
  for (let q = 0; q < pairs.length; q += 2) {
    if ((work += 2) > WORK) { work = 0; yield 'n'; }
    const a = find(pairs[q]), b = find(pairs[q + 1]); if (a === b) continue;
    (nb.get(a) || nb.set(a, new Set()).get(a)).add(b); (nb.get(b) || nb.set(b, new Set()).get(b)).add(a);
  }
  // smallest patch stays put; every larger patch that overlaps it goes one layer deeper
  const order = [...nb.keys()].sort((a, b) => area.get(a) - area.get(b) || a - b), depth = new Map();
  for (const p of order) { let dmax = -1; for (const q of nb.get(p)) if (depth.has(q)) dmax = Math.max(dmax, depth.get(q)); depth.set(p, Math.min(dmax + 1, 6)); }
  res.patches = order.length;
  yield 's0';
  // ---- sink
  const done = new Map();   // per mesh: Set of vertex indices already moved
  const dir = new THREE.Vector3(), inv = new THREE.Matrix4();
  for (let i = 0; i < total; i++) {
    if ((work += 1) > WORK) { work = 0; yield 's'; }
    if (N[i * 4 + 3] !== N[i * 4 + 3]) continue;
    const r = find(i), dp = depth.get(r); if (!dp) continue;
    work += 20;
    const m = M[MID[i]], t = i - m.start;
    let set = done.get(m); if (!set) { done.set(m, (set = new Set())); m.inv = inv.clone().copy(m.mw).invert(); }
    dir.set(N[i * 4], N[i * 4 + 1], N[i * 4 + 2]).transformDirection(m.inv);
    // world eps -> local units (uniform scale assumed: rooms are built at 1:1)
    const sc = m.mw.getMaxScaleOnAxis() || 1, s = (-dp * eps) / sc;
    for (let k = 0; k < 3; k++) {
      const vi = m.idx ? m.idx.getX(t * 3 + k) : t * 3 + k; if (set.has(vi)) continue; set.add(vi);
      m.pos.setXYZ(vi, m.pos.getX(vi) + dir.x * s, m.pos.getY(vi) + dir.y * s, m.pos.getZ(vi) + dir.z * s);
    }
    res.moved++;
  }
  for (const m of done.keys()) { m.pos.needsUpdate = true; m.g.userData.deoverlapped = true; }
  res.ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
  return res;
}
