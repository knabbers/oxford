// Worcester College Cellar Bar — room geometry: groin-vaulted undercroft, pool room, bar, darts alcove, furniture.
// Room-local coordinates (metres): the college's local frame (x east, z south) shifted — see _bar_plan.js (FRAME; the
// room sits in place under the Hall). Static geometry is merged per material (≈ 17 draw calls for the whole room).
import * as THREE from 'three';
import { canvasScale, hiAniso } from '../world/_surf_detail.js';   // texture pass 2: larger canvases and 16x anisotropy on the top tier only
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------------------------------------ arcs / vault
function arc(span, rise, ys) {
  const half = span / 2, R = (half * half + rise * rise) / (2 * rise), c = R - rise;
  return {
    half, R, ys, rise,
    h(s) { const a = Math.min(Math.abs(s), half); return ys + Math.sqrt(R * R - a * a) - c; },
    inv(y) { const k = y - ys + c; return k >= R ? 0 : Math.min(half, Math.sqrt(Math.max(0, R * R - k * k))); },
    len(s) { return R * Math.asin(Math.max(-1, Math.min(1, s / R))); },
  };
}

/** A groin-vaulted room: bays along x, the main barrel spans z. Returns {ceil(x,z), geo (vault), arches (geo), A, bayArcs}.
 *  A bay given as [x0, x1, 'barrel'] has no cross vault: the main barrel alone runs over it. */
export function makeVault(room) {
  const { za, zb, bays, ys, crown } = room;
  const W = zb - za, zc = (za + zb) / 2, rise = crown - ys;
  const A = arc(W, rise, ys);
  const bayArcs = bays.map(([x0, x1, kind]) => ({ x0, x1, xc: (x0 + x1) / 2, plain: kind === 'barrel', B: arc(x1 - x0, rise, ys) }));
  const bayAt = (x) => { for (const b of bayArcs) if (x <= b.x1 + 1e-6) return b; return bayArcs[bayArcs.length - 1]; };
  const ceil = (x, z) => { const b = bayAt(x); return b.plain ? A.h(z - zc) : Math.max(A.h(z - zc), b.B.h(x - b.xc)); };
  const pos = [], uv = [], idx = [];
  const grid = (ni, nj, f) => {
    const base = pos.length / 3;
    for (let i = 0; i <= ni; i++) for (let j = 0; j <= nj; j++) { const p = f(i / ni, j / nj); pos.push(p[0], p[1], p[2]); uv.push(p[3], p[4]); }
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
      const a = base + i * (nj + 1) + j, b = a + nj + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  };
  const patches = [];
  for (const bay of bayArcs) {
    const hb = bay.B.half, B = bay.B;
    if (bay.plain) { patches.push(() => grid(28, 2, (fi, fj) => { const s = -W / 2 + W * fi, u = -hb + 2 * hb * fj; return [bay.xc + u, A.h(s), zc + s, bay.xc + u, A.len(s)]; })); continue; }
    for (const side of [-1, 1]) {
      // longitudinal patch (main barrel), towards the bay's east (+1) or west (-1) edge
      patches.push(() => grid(28, 8, (fi, fj) => {
        const s = -W / 2 + W * fi, y = A.h(s), ug = Math.min(hb, B.inv(y)), u = side * (ug + (hb - ug) * fj);
        return [bay.xc + u, y, zc + s, bay.xc + u, A.len(s)];
      }));
      // lunette patch (transverse barrel) against the north (-1) or south (+1) wall
      patches.push(() => grid(24, 10, (fi, fj) => {
        const u = -hb + 2 * hb * fi, y = B.h(u), zg = Math.min(W / 2, A.inv(y)), s = side * (zg + (W / 2 - zg) * fj);
        return [bay.xc + u, y, zc + s, B.len(u) + bay.xc, zc + s];
      }));
    }
  }
  // each patch gets its own normals (creases stay sharp at the groins)
  const geos = [];
  for (const p of patches) {
    pos.length = 0; uv.length = 0; idx.length = 0; p();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx.slice()); g.computeVertexNormals();
    // front faces must look DOWN into the room: the vault materials are double-sided, and three negates the normal of
    // a back-facing triangle, so a patch wound the other way was lit from above (= dark) however its normals pointed
    { const n = g.attributes.normal; let sy = 0; for (let i = 0; i < n.count; i++) sy += n.getY(i);
      if (sy > 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); } }
    geos.push(g.toNonIndexed());
  }
  // broad transverse arches between bays (soffit 0.6 m wide, 0.1 m deep)
  const arches = [];
  for (let k = 1; k < bayArcs.length; k++) {
    const xb = bayArcs[k].x0, hw = room.archW || 0.3, dep = 0.1, N = 28, P = [], U = [];
    const quad = (a, b, c, d, ua, ub, uc, ud) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); U.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); };
    for (let i = 0; i < N; i++) {
      const s0 = -W / 2 + (W * i) / N, s1 = -W / 2 + (W * (i + 1)) / N;
      const y0 = A.h(s0) - dep, y1 = A.h(s1) - dep, z0 = zc + s0, z1 = zc + s1, l0 = A.len(s0), l1 = A.len(s1);
      quad([xb - hw, y0, z0], [xb + hw, y0, z0], [xb + hw, y1, z1], [xb - hw, y1, z1], [0, l0], [2 * hw, l0], [2 * hw, l1], [0, l1]);
      for (const sx of [-1, 1]) {
        const x = xb + sx * hw, t0 = ceil(x, z0) + 0.02, t1 = ceil(x, z1) + 0.02;
        quad([x, y0, z0], [x, t0, z0], [x, t1, z1], [x, y1, z1], [z0, y0], [z0, t0], [z1, t1], [z1, y1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    // same for the arches: soffit faces down, the two cheeks face away from the arch
    orient(g, (cx, cy, cz, nx) => (Math.abs(nx) > 0.5 ? [Math.sign(cx - xb) || 1, 0, 0] : [0, -1, 0]));
    arches.push(g);
  }
  return { ceil, geo: mergeGeometries(geos), arches: arches.length ? mergeGeometries(arches) : null, A, bayArcs, zc };
}

/** The arches ALONG x on the line z = zr (an arcade from pier to pier between two aisles, or a wall arch): for each
 *  cross-vaulted bay of V a band hw each side of the line, its soffit `dep` below the bay's own arc, cheeks up to the
 *  vault (ceil(x, z): the room's whole ceiling). Returns a geometry, or null. */
export function arcadeX(V, zr, ceil, hw = 0.25, dep = 0.1, skip = () => false) {
  const out = [];
  V.bayArcs.forEach((bay, k) => {
    if (bay.plain || skip(bay, k)) return;
    const N = 24, P = [], U = [], B = bay.B;
    const quad = (a, b, c, d, ua, ub, uc, ud) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); U.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); };
    for (let i = 0; i < N; i++) {
      const s0 = -B.half + (2 * B.half * i) / N, s1 = -B.half + (2 * B.half * (i + 1)) / N, x0 = bay.xc + s0, x1 = bay.xc + s1, y0 = B.h(s0) - dep, y1 = B.h(s1) - dep, l0 = B.len(s0), l1 = B.len(s1);
      quad([x0, y0, zr - hw], [x0, y0, zr + hw], [x1, y1, zr + hw], [x1, y1, zr - hw], [l0, 0], [l0, 2 * hw], [l1, 2 * hw], [l1, 0]);
      for (const sz of [-1, 1]) { const z = zr + sz * hw, t0 = Math.max(y0, ceil(x0, z)) + 0.02, t1 = Math.max(y1, ceil(x1, z)) + 0.02; quad([x0, y0, z], [x0, t0, z], [x1, t1, z], [x1, y1, z], [x0, y0], [x0, t0], [x1, t1], [x1, y1]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    orient(g, (cx, cy, cz, nx, ny, nz) => (Math.abs(nz) > 0.5 ? [0, 0, Math.sign(cz - zr) || 1] : [0, -1, 0]));
    out.push(g);
  });
  return out.length ? mergeGeometries(out) : null;
}

/** Non-indexed geometry: wind every triangle so its face normal agrees with want(cx, cy, cz, nx, ny, nz) -> [x, y, z]. */
function orient(g, want) {
  const P = g.attributes.position.array, U = g.attributes.uv ? g.attributes.uv.array : null;
  for (let t = 0; t < P.length; t += 9) {
    const ax = P[t + 3] - P[t], ay = P[t + 4] - P[t + 1], az = P[t + 5] - P[t + 2], bx = P[t + 6] - P[t], by = P[t + 7] - P[t + 1], bz = P[t + 8] - P[t + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const w = want((P[t] + P[t + 3] + P[t + 6]) / 3, (P[t + 1] + P[t + 4] + P[t + 7]) / 3, (P[t + 2] + P[t + 5] + P[t + 8]) / 3, nx, ny, nz);
    if (nx * w[0] + ny * w[1] + nz * w[2] < 0) {
      for (let k = 0; k < 3; k++) { const q = P[t + 3 + k]; P[t + 3 + k] = P[t + 6 + k]; P[t + 6 + k] = q; }
      if (U) { const u = (t / 9) * 6; for (let k = 0; k < 2; k++) { const q = U[u + 2 + k]; U[u + 2 + k] = U[u + 4 + k]; U[u + 4 + k] = q; } }
    }
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------------------------------------ textures
function canvas(w, h) { const c = document.createElement('canvas'), k = canvasScale(w, h); c.width = w * k; c.height = h * k; if (k !== 1) c.getContext('2d').scale(k, k); return c; }   // (texture pass 2: twice the pixels on the top tier; painters draw in w x h units)
function texOf(c, repeat = true) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = hiAniso(4);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function speckle(g, w, h, n, rnd, cols, size = 2) { for (let i = 0; i < n; i++) { g.fillStyle = cols[(rnd() * cols.length) | 0]; g.fillRect(rnd() * w, rnd() * h, size * (0.5 + rnd()), size * (0.5 + rnd())); } }

/** Pale cream limewashed rubble stone for the vault. */
function vaultTexture() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = seeded(7);
  g.fillStyle = '#d9cfb8'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#e2d9c4'; g.fillRect(0, 0, S, S);
  roughcast(g, S, r, 2600, 4, 11, ['rgba(250,244,230,0.35)', 'rgba(236,226,204,0.4)', 'rgba(172,154,124,0.22)', 'rgba(205,190,160,0.3)']);
  for (let i = 0; i < 60; i++) {
    const x = r() * S, y = r() * S, rad = 30 + r() * 90, a = 0.025 + r() * 0.035;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, r() < 0.65 ? `rgba(248,242,228,${a})` : `rgba(140,122,96,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  speckle(g, S, S, 9000, r, ['rgba(90,80,60,0.18)', 'rgba(255,250,235,0.3)', 'rgba(140,120,90,0.15)'], 2);
  const t = texOf(c); t.userData.scale = 1.7; return t;
}
/** Rough-cast / limewashed rubble seen close: many small soft lumps, each lit from above (wraps). */
function roughcast(g, S, r, n, minR, maxR, cols) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rx = minR + r() * (maxR - minR), ry = rx * (0.55 + r() * 0.4), a = r() * Math.PI;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const cx = x + ox, cy = y + oy; if (cx < -maxR || cx > S + maxR || cy < -maxR || cy > S + maxR) continue;
      g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(cx, cy, rx, ry, a, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(90,76,54,0.10)'; g.beginPath(); g.ellipse(cx + 0.6, cy + ry * 0.55, rx * 0.9, ry * 0.45, a, 0, Math.PI * 2); g.fill();
    }
  }
}
/** Irregular rubble stones (wrapping), each a jittered blob, with mortar between. */
function rubble(g, S, r, minR, maxR, fill, joint) {
  const pts = [];
  for (let i = 0; i < 2600 && pts.length < 140; i++) {
    const x = r() * S, y = r() * S, rad = minR + r() * (maxR - minR);
    let ok = true; for (const p of pts) { const dx = Math.min(Math.abs(p[0] - x), S - Math.abs(p[0] - x)), dy = Math.min(Math.abs(p[1] - y), S - Math.abs(p[1] - y)); if (Math.hypot(dx, dy) < (p[2] + rad) * 0.82) { ok = false; break; } }
    if (ok) pts.push([x, y, rad]);
  }
  for (const [x, y, rad] of pts) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    const cx = x + ox, cy = y + oy; if (cx < -maxR || cx > S + maxR || cy < -maxR || cy > S + maxR) continue;
    const k = r(), n = 7 + ((r() * 4) | 0); g.beginPath();
    for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2, rr = rad * (0.75 + r() * 0.3); g[j ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.85); }
    g.closePath(); g.fillStyle = fill(k); g.fill(); g.strokeStyle = joint; g.lineWidth = 2.5; g.stroke();
  }
}
function plasterTexture(base = '#e9e5dc') {
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = seeded(11);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { const x = r() * S, y = r() * S, rad = 8 + r() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${r() < 0.5 ? '255,255,255' : '120,110,95'},0.06)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  speckle(g, S, S, 2500, r, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)'], 1.5);
  return texOf(c);
}
function flagTexture() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = seeded(23);
  g.fillStyle = '#1b1916'; g.fillRect(0, 0, S, S);
  // 2.4 m repeat: courses 0.4-0.6 m, flags 0.5-0.9 m
  let y = 0;
  while (y < S - 4) {
    const h = Math.min(S - y, (0.42 + r() * 0.2) * (S / 2.4)); let x = 0;
    while (x < S - 4) {
      const w = Math.min(S - x, (0.5 + r() * 0.4) * (S / 2.4)), v = 50 + r() * 22;
      g.fillStyle = `rgb(${v + 4 | 0},${v | 0},${v - 6 | 0})`; g.fillRect(x + 2, y + 2, w - 4, h - 4);
      for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,220'},${0.03 + r() * 0.04})`; g.fillRect(x + r() * w, y + r() * h, 10 + r() * 40, 6 + r() * 30); }
      x += w;
    }
    y += h;
  }
  speckle(g, S, S, 6000, r, ['rgba(0,0,0,0.2)', 'rgba(255,255,255,0.05)'], 1.5);
  const t = texOf(c); t.userData.scale = 2.4; return t;
}
/** Deep-buttoned (chesterfield) dark green upholstery, 0.4 m repeat. */
function buttonTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#1d3a2b'; g.fillRect(0, 0, S, S);
  const step = S / 2;
  for (let i = -1; i < 3; i++) for (let j = -1; j < 3; j++) {
    const cx = i * step + ((j & 1) ? step / 2 : 0), cy = j * step / 2;
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, step * 0.55);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.18, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.55, 'rgba(120,190,150,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy - step / 2); g.lineTo(cx + step / 2, cy); g.lineTo(cx, cy + step / 2); g.lineTo(cx - step / 2, cy); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#0c1a12'; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
  }
  return texOf(c);
}
/** White painted vertical tongue-and-groove boards, 0.1 m wide, 1 m repeat. */
function tgTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = seeded(5);
  g.fillStyle = '#ecebe6'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 10; i++) {
    const x = (i * S) / 10;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, 0, 2, S);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 2, 0, 2, S);
    g.fillStyle = `rgba(0,0,0,${0.015 + r() * 0.03})`; g.fillRect(x + 4, 0, S / 10 - 4, S);
  }
  return texOf(c);
}
function whiteStoneTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = seeded(9);
  g.fillStyle = '#d2cec4'; g.fillRect(0, 0, S, S);
  let y = 0;
  while (y < S - 6) {
    const h = Math.min(S - y, 26 + r() * 20); let x = -r() * 40;
    while (x < S) {
      const w = 34 + r() * 56, k = r(), rad = 5 + r() * 5;
      for (const ox of [0, S]) {
        g.fillStyle = `rgb(${228 + k * 18 | 0},${225 + k * 18 | 0},${216 + k * 18 | 0})`;
        g.beginPath(); g.roundRect(x - ox + 2, y + 2, w - 3.5, h - 3.5, rad); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.roundRect(x - ox + 3, y + 3, w - 6, h * 0.35, rad); g.fill();
      }
      x += w;
    }
    g.fillStyle = 'rgba(96,90,78,0.07)'; g.fillRect(0, y + h - 2, S, 2.5);
    y += h;
  }
  roughcast(g, S, r, 500, 2, 6, ['rgba(255,255,255,0.25)', 'rgba(150,144,130,0.12)']);
  speckle(g, S, S, 2500, r, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.3)'], 2);
  return texOf(c);
}

// ------------------------------------------------------------------------------------------------ sign atlas
// One 1024² canvas for every printed/painted flat thing; regions in pixels [x, y, w, h].
export const ATLAS = {
  mirror: [0, 0, 1024, 200], nosmoking: [0, 208, 120, 150], clock: [128, 208, 240, 240], chalk: [376, 208, 400, 260],
  sting: [784, 208, 240, 300], prices: [0, 520, 520, 220], juke: [528, 520, 250, 360], tv: [784, 520, 240, 136],
  poolSign: [784, 664, 240, 80], crest: [0, 748, 200, 240], cabinet: [208, 748, 300, 120], font: [208, 876, 120, 120],
  quiz: [336, 876, 180, 140], gig: [784, 752, 240, 260],
};
function drawAtlas() {
  const c = canvas(1024, 1024), g = c.getContext('2d'), r = seeded(3);
  g.fillStyle = '#777'; g.fillRect(0, 0, 1024, 1024);
  const box = (k) => ATLAS[k];
  // mirror: smoky silver with the lettering
  { const [x, y, w, h] = box('mirror'); const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#8d9296'); gr.addColorStop(0.35, '#c9ced0'); gr.addColorStop(0.5, '#9aa0a3'); gr.addColorStop(0.8, '#d4d8d9'); gr.addColorStop(1, '#868b8f'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 6; i++) { g.save(); g.translate(x + 120 + i * 170, y); g.rotate(0.5); g.fillRect(0, -40, 26, 400); g.restore(); }
    g.fillStyle = '#121212'; g.font = 'bold 92px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WORCESTER - OXFORD', x + w / 2, y + h * 0.42);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, w - 8, h - 8); }
  // no smoking sign
  { const [x, y, w, h] = box('nosmoking'); g.fillStyle = '#f4f4f0'; g.fillRect(x, y, w, h); g.strokeStyle = '#d01818'; g.lineWidth = 9; g.beginPath(); g.arc(x + w / 2, y + 58, 40, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#111'; g.fillRect(x + 32, y + 52, 50, 10); g.fillStyle = '#c86a2a'; g.fillRect(x + 82, y + 52, 8, 10);
    g.strokeStyle = '#d01818'; g.beginPath(); g.moveTo(x + w / 2 - 28, y + 30); g.lineTo(x + w / 2 + 28, y + 86); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(x + 6, y + 112, w - 12, 30); g.fillStyle = '#d01818'; g.fillRect(x + 6, y + 112, w - 12, 30); g.fillStyle = '#fff'; g.font = 'bold 19px Arial'; g.textAlign = 'center'; g.fillText('NO SMOKING', x + w / 2, y + 133); }
  // clock face (hands are separate meshes)
  { const [x, y, w] = box('clock'); const cx = x + w / 2, cy = y + w / 2; g.fillStyle = '#d8d8d8'; g.beginPath(); g.arc(cx, cy, w / 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fbfbf8'; g.beginPath(); g.arc(cx, cy, w / 2 - 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#151515'; g.font = '34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillText(String(i), cx + Math.sin(a) * (w / 2 - 42), cy - Math.cos(a) * (w / 2 - 42)); }
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, r0 = w / 2 - 18, r1 = r0 - (i % 5 ? 5 : 10); g.strokeStyle = '#222'; g.lineWidth = i % 5 ? 1.5 : 3; g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); g.stroke(); } }
  // chalk board for the pool room
  { const [x, y, w, h] = box('chalk'); g.fillStyle = '#e07aa0'; g.fillRect(x, y, w, h); g.fillStyle = '#151515'; g.fillRect(x + 12, y + 12, w - 24, h - 24);
    g.fillStyle = 'rgba(240,240,240,0.88)'; g.font = 'italic 34px "Comic Sans MS", "Chalkboard", cursive'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('POOL  -  winner stays on', x + 30, y + 26); g.font = '26px "Comic Sans MS", "Chalkboard", cursive';
    g.fillText('Names on the board:', x + 30, y + 80);
    g.fillStyle = 'rgba(255,170,210,0.9)'; g.fillText('1. ............', x + 40, y + 118); g.fillText('2. ............', x + 40, y + 152); g.fillText('3. ............', x + 40, y + 186);
    g.strokeStyle = 'rgba(240,240,240,0.25)'; g.lineWidth = 14; g.beginPath(); g.moveTo(x + 250, y + 210); g.lineTo(x + 360, y + 150); g.stroke(); }
  // Sting poster (no recipe — it isn't in the references)
  { const [x, y, w, h] = box('sting'); g.fillStyle = '#fbf8f2'; g.fillRect(x, y, w, h); g.fillStyle = '#c0182a'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText('The Sting', x + w / 2, y + 16); g.font = 'bold 46px Georgia, serif'; g.fillText('£4.50', x + w / 2, y + 62);
    // cup with a straw
    const cx = x + w / 2, cy = y + 140; g.fillStyle = 'rgba(200,210,220,0.5)'; g.beginPath(); g.moveTo(cx - 44, cy); g.lineTo(cx + 44, cy); g.lineTo(cx + 34, cy + 128); g.lineTo(cx - 34, cy + 128); g.closePath(); g.fill();
    g.fillStyle = '#d2401c'; g.beginPath(); g.moveTo(cx - 40, cy + 22); g.lineTo(cx + 40, cy + 22); g.lineTo(cx + 34, cy + 126); g.lineTo(cx - 34, cy + 126); g.closePath(); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx + 6, cy + 110); g.lineTo(cx + 28, cy - 34); g.stroke(); }
  // price board
  { const [x, y, w, h] = box('prices'); g.fillStyle = '#141414'; g.fillRect(x, y, w, h); g.fillStyle = '#e07aa0'; g.fillRect(x, y, w, 10); g.fillRect(x, y + h - 10, w, 10);
    g.fillStyle = '#f2f2f2'; g.font = 'bold 34px Arial'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('Pint ...................... £2.80', x + 24, y + 30); g.fillText('The Sting .............. £4.50', x + 24, y + 86); g.fillText('Soft drinks ........... £1.00', x + 24, y + 142); }
  // jukebox front
  { const [x, y, w, h] = box('juke'); const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#2a0f3a'); gr.addColorStop(0.5, '#4a1f6a'); gr.addColorStop(1, '#1a0a20'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = '#0b1830'; g.fillRect(x + 22, y + 30, w - 44, 150); g.fillStyle = '#4ad0ff'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillText('TOUCH  TUNES', x + w / 2, y + 72);
    g.fillStyle = '#ffd040'; g.font = '18px Arial'; g.fillText('50p  a play', x + w / 2, y + 110); g.fillStyle = '#ff60b0'; g.fillText('QUIZ  /  MUSIC', x + w / 2, y + 150);
    for (let i = 0; i < 8; i++) { g.fillStyle = `hsl(${(i * 45) % 360},80%,60%)`; g.fillRect(x + 20 + i * 27, y + 210, 20, 10); }
    g.fillStyle = '#222'; g.fillRect(x + 40, y + 250, w - 80, 70); g.fillStyle = '#888'; for (let i = 0; i < 5; i++) g.fillRect(x + 50 + i * 32, y + 270, 22, 30); }
  // little TV picture (sport-ish green)
  { const [x, y, w, h] = box('tv'); g.fillStyle = '#1e5a26'; g.fillRect(x, y, w, h); g.fillStyle = '#2f7a34'; for (let i = 0; i < 6; i++) g.fillRect(x + i * 40, y, 20, h); g.fillStyle = '#fff'; g.fillRect(x + 8, y + 8, 70, 16); g.fillStyle = '#c01818'; g.fillRect(x + 8, y + 8, 22, 16); }
  { const [x, y, w, h] = box('poolSign'); g.fillStyle = '#121212'; g.fillRect(x, y, w, h); g.fillStyle = '#e584ab'; g.font = 'bold 40px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POOL', x + w / 2, y + h / 2 + 2); }
  // pink & black college-colours shield (plain chevron device, no arms copied)
  { const [x, y, w, h] = box('crest'); g.fillStyle = '#111'; g.fillRect(x, y, w, h); g.fillStyle = '#e584ab'; g.beginPath(); g.moveTo(x + 20, y + 20); g.lineTo(x + w - 20, y + 20); g.lineTo(x + w - 20, y + 130); g.quadraticCurveTo(x + w / 2, y + h - 10, x + 20, y + 130); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(x + 30, y + 120); g.lineTo(x + w / 2, y + 70); g.lineTo(x + w - 30, y + 120); g.lineTo(x + w - 30, y + 140); g.lineTo(x + w / 2, y + 90); g.lineTo(x + 30, y + 140); g.closePath(); g.fill(); }
  // fridge / cabinet front: glass with cans
  { const [x, y, w, h] = box('cabinet'); g.fillStyle = '#0f1418'; g.fillRect(x, y, w, h); for (let i = 0; i < 14; i++) { g.fillStyle = ['#c01818', '#1a3ad0', '#e8e8e8', '#30a030', '#d0a020'][i % 5]; g.fillRect(x + 8 + i * 20, y + 20, 14, 34); g.fillRect(x + 8 + i * 20, y + 70, 14, 34); } g.fillStyle = 'rgba(200,230,255,0.15)'; g.fillRect(x, y, w, h); }
  // generic lager font badge (green, unbranded)
  { const [x, y, w, h] = box('font'); g.fillStyle = '#e8e8e2'; g.fillRect(x, y, w, h); g.fillStyle = '#1f6a32'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 6, h / 2 - 20, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LAGER', x + w / 2, y + h / 2); }
  { const [x, y, w, h] = box('quiz'); g.fillStyle = '#081020'; g.fillRect(x, y, w, h); g.fillStyle = '#ffd040'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.fillText('QUIZ', x + w / 2, y + 40); g.fillStyle = '#40e0ff'; g.font = '16px Arial'; g.fillText('£1 - win £20', x + w / 2, y + 80); g.fillText('PRESS START', x + w / 2, y + 110); }
  // gig/event poster
  { const [x, y, w, h] = box('gig'); g.fillStyle = '#111'; g.fillRect(x, y, w, h); g.fillStyle = '#e584ab'; g.font = 'bold 40px Georgia, serif'; g.textAlign = 'center'; g.fillText('BOP', x + w / 2, y + 70);
    g.fillStyle = '#fff'; g.font = '22px Arial'; g.fillText('Cellar Bar', x + w / 2, y + 120); g.fillText('10pm till late', x + w / 2, y + 156); g.fillStyle = '#e584ab'; g.fillText('Stings £4.50', x + w / 2, y + 210); }
  return texOf(c, false);
}

// ------------------------------------------------------------------------------------------------ geometry batching
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
class Batch {
  constructor() { this.parts = new Map(); }
  add(key, geo, x = 0, y = 0, z = 0, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ'); _q.setFromEuler(_e);
    _p.set(x, y, z); _s.set(o.sx || 1, o.sy || 1, o.sz || 1);
    _m.compose(_p, _q, _s); g.applyMatrix4(_m);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const col = new THREE.Color(o.color === undefined ? 0xffffff : o.color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return g;
  }
  /** Box with metric UVs; (x, y, z) = centre of the bottom face unless o.center. */
  box(key, w, h, d, x, y, z, o = {}) { return this.add(key, metricBox(w, h, d), x, o.center ? y : y + h / 2 * (o.sy || 1), z, o); }
  cyl(key, rt, rb, h, seg, x, y, z, o = {}) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); return this.add(key, g, x, o.center ? y : y + h / 2, z, o); }
  /** Flat quad w x h facing +z (rotate with ry), uv mapped into an atlas region. */
  quad(key, w, h, x, y, z, o = {}, region = null, tex = 1024) {
    const g = new THREE.PlaneGeometry(w, h);
    if (region) { const [rx, ry, rw, rh] = region, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (rx + uv.getX(i) * rw) / tex, 1 - (ry + (1 - uv.getY(i)) * rh) / tex); }
    else { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h); }
    return this.add(key, g, x, y, z, o);
  }
  build(scene, mats) {
    const out = {};
    for (const [key, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      if (!geo) { console.warn('[bar] merge failed', key); continue; }
      const mesh = new THREE.Mesh(geo, mats[key]); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.name = 'bar-' + key; scene.add(mesh); out[key] = mesh;
    }
    return out;
  }
}
function metricBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return g;
}
/** Wall from a 2D outline (u along the wall, v = height) with holes, mapped by fn(u, v) -> [x, y, z]. */
function shapeWall(outline, holes, map) {
  const sh = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
  const g = new THREE.ShapeGeometry(sh, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const q = map(p.getX(i), p.getY(i)); p.setXYZ(i, q[0], q[1], q[2]); }
  g.computeVertexNormals();
  return g;
}
function archPath(u0, w, sill, springY, n = 10) {
  const r = w / 2, pts = [[u0 - r, sill], [u0 + r, sill], [u0 + r, springY]];
  for (let i = 1; i < n; i++) { const a = (i / n) * Math.PI; pts.push([u0 + Math.cos(a) * r, springY + Math.sin(a) * r]); }
  pts.push([u0 - r, springY]);
  return pts;
}
/** Reveal (deep recess sides) for a hole path pushed `depth` behind the wall plane. */
function revealGeo(path, map, depth) {
  const P = [], U = []; let acc = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const a0 = map(a[0], a[1], 0), b0 = map(b[0], b[1], 0), a1 = map(a[0], a[1], depth), b1 = map(b[0], b[1], depth);
    P.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1); U.push(acc, 0, acc + l, 0, acc + l, depth, acc, 0, acc + l, depth, acc, depth); acc += l;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals(); return g;
}
function scaleUV(g, s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / s, uv.getY(i) / s); return g; }

export function planeXZ(w, d) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d); return g; }
export { orient, arc, Batch, metricBox, shapeWall, archPath, revealGeo, scaleUV, seeded, vaultTexture, plasterTexture, flagTexture, buttonTexture, tgTexture, whiteStoneTexture, drawAtlas };
