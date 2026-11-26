// Roughness pass (2026-11): the dirt of a real street, as decals. Everything here is drawn by the EXISTING contact-shadow
// batch ('aoStrip': multiply-blended, no depth write, depth bias 10, medium tier and up, culled at 160 m) — the batch's
// material samples one 1024 px "grime" texture (white = no change) for vertices whose colour is (2, strength, 0), so no
// draw call is added on any tier and the low tier pays nothing at all.
//   gutters      a silted, leaf-flecked band of uneven width along every kerb
//   wall line    moss and weeds along the back of the footway
//   blots        oil drips, damp silt, cracks, reinstated patches, skid marks on the carriageway; stains, leaves, weeds
//                and cracks on the footway and the pedestrian streets; leaf litter under street trees
//   fringes      ragged grass over both edges of the paths that cross grass
// Visual only: nothing here is collided with, stood on or steered by. Deterministic: every choice is a hash of the
// road id / position (never the system random number generator), so every player sees the same stains. `?rough=0` (textures.js ROUGH) = none.
import { mkCanvas, canvasTexture, ROUGH } from './textures.js';
import { makeRng, hash01, pointAt, polylineLength, miterAt, SpatialGrid, distToSeg, signedArea, cleanRing } from './util.js';
import { Y } from './ground.js';

const W = 1024, CELL = 256, STRIP_Y = 512, STRIP_H = 128;
/** uv rectangles: blot cells (u0, v0, u1, v1) and strips (v at the "edge" side, v at the far side). */
export const GRIME = { oil: 0, silt: 1, crackA: 2, crackB: 3, patch: 4, leaves: 5, weeds: 6, skid: 7 };
const cellUV = (i) => { const cx = i % 4, cy = (i / 4) | 0, p = 3 / W; return [cx / 4 + p, 1 - (cy + 1) / 4 + p, (cx + 1) / 4 - p, 1 - cy / 4 - p]; };
const stripV = (k) => { const y0 = STRIP_Y + k * STRIP_H; return [1 - (y0 + 5) / W, 1 - (y0 + STRIP_H - 5) / W]; };   // [v at the strip's top (the edge it hugs), v at its bottom]
export const STRIP = { gutter: 0, wall: 1, fringe: 2 };

let TEX = null;
/** The grime sheet: multiply colours on white. Top half: 8 blot cells; then three 1024 × 128 strips that repeat along
 *  u; the bottom band is spare (white). Painted in linear values (0.8 = ×0.8). */
export function grimeTexture() {
  if (TEX) return TEX;
  const { c, g } = mkCanvas(W, W), rng = makeRng(90210);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, W);
  const rgba = (r, gg, b, a) => `rgba(${r | 0},${gg | 0},${b | 0},${a})`;
  const soft = (x, y, rx, ry, col, a, rot = 0) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, rgba(col[0], col[1], col[2], a)); gr.addColorStop(0.55, rgba(col[0], col[1], col[2], a * 0.6)); gr.addColorStop(1, rgba(col[0], col[1], col[2], 0));
    g.fillStyle = gr; g.fillRect(-rx, -rx, 2 * rx, 2 * rx); g.restore();
  };
  const inCell = (i, fn) => { const ox = (i % 4) * CELL, oy = ((i / 4) | 0) * CELL; g.save(); g.beginPath(); g.rect(ox + 4, oy + 4, CELL - 8, CELL - 8); g.clip(); g.translate(ox, oy); fn(); g.restore(); };
  const wander = (x0, y0, x1, y1, n, j) => { const pts = [[x0, y0]]; const px = -(y1 - y0), py = x1 - x0; for (let i = 1; i <= n; i++) { const t = i / n, o = i < n ? (rng() - 0.5) * j : 0; pts.push([x0 + (x1 - x0) * t + px * o, y0 + (y1 - y0) * t + py * o]); } return pts; };
  const stroke = (pts, col, a, w) => { g.strokeStyle = rgba(col[0], col[1], col[2], a); g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); };
  // 0 oil: drips along the lane (x), a darker core
  inCell(GRIME.oil, () => {
    for (let i = 0; i < 9; i++) soft(128 + (rng() - 0.5) * 150, 128 + (rng() - 0.5) * 50, 18 + rng() * 34, 10 + rng() * 18, [70, 68, 66], 0.2 + rng() * 0.2, (rng() - 0.5) * 0.4);
    for (let i = 0; i < 26; i++) soft(128 + (rng() - 0.5) * 200, 128 + (rng() - 0.5) * 80, 2 + rng() * 5, 2 + rng() * 4, [40, 38, 38], 0.5);
  });
  // 1 silt: where a puddle dries — a pale brown fan with a darker tide line and grit
  inCell(GRIME.silt, () => {
    for (let i = 0; i < 7; i++) soft(128 + (rng() - 0.5) * 110, 128 + (rng() - 0.5) * 80, 40 + rng() * 40, 26 + rng() * 30, [128, 116, 96], 0.14 + rng() * 0.1, rng() * 3);
    for (let i = 0; i < 4; i++) { g.strokeStyle = rgba(86, 78, 66, 0.2); g.lineWidth = 1.5 + rng() * 1.5; g.beginPath(); g.ellipse(128 + (rng() - 0.5) * 30, 128 + (rng() - 0.5) * 24, 60 + rng() * 30, 40 + rng() * 24, rng() * 3, rng() * 3, 2 + rng() * 3); g.stroke(); }
    for (let i = 0; i < 160; i++) { g.fillStyle = rgba(70, 64, 54, 0.3); g.fillRect(128 + (rng() + rng() - 1) * 100, 128 + (rng() + rng() - 1) * 80, 1 + rng() * 2, 1 + rng() * 2); }
  });
  // 2 crack A: one long crack with branches
  inCell(GRIME.crackA, () => {
    const main = wander(14, 110 + rng() * 40, 242, 100 + rng() * 60, 9, 0.16);
    stroke(main, [160, 158, 156], 0.3, 6); stroke(main, [76, 74, 72], 0.8, 1.7);
    for (let b = 0; b < 4; b++) { const p = main[2 + ((rng() * 6) | 0)], l = 30 + rng() * 60, a = (rng() < 0.5 ? 1 : -1) * (0.7 + rng() * 0.8), br = wander(p[0], p[1], p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l, 4, 0.22); stroke(br, [160, 158, 156], 0.25, 4); stroke(br, [84, 82, 80], 0.75, 1.3); }
  });
  // 3 crack B: crazing where the surface is breaking up
  inCell(GRIME.crackB, () => {
    soft(128, 128, 100, 80, [150, 148, 144], 0.3);
    const P = []; for (let i = 0; i < 26; i++) P.push([128 + (rng() + rng() - 1) * 100, 128 + (rng() + rng() - 1) * 84]);
    for (let i = 0; i < P.length; i++) { const near = P.map((q, j) => [Math.hypot(q[0] - P[i][0], q[1] - P[i][1]), j]).sort((a, b) => a[0] - b[0]); for (const [d, j] of near.slice(1, 3)) if (j > i || d > 0) stroke(wander(P[i][0], P[i][1], P[j][0], P[j][1], 3, 0.2), [80, 78, 76], 0.75, 1.3); }
  });
  // 4 patch: a square of newer, darker tarmac with a sealed edge
  inCell(GRIME.patch, () => {
    g.fillStyle = rgba(196, 196, 200, 1); g.fillRect(26, 44, 204, 168);
    for (let i = 0; i < 700; i++) { g.fillStyle = rng() < 0.5 ? rgba(170, 170, 174, 0.6) : rgba(214, 214, 216, 0.6); g.fillRect(26 + rng() * 202, 44 + rng() * 166, 2, 2); }
    for (const [a, b] of [[[26, 44], [230, 44]], [[230, 44], [230, 212]], [[230, 212], [26, 212]], [[26, 212], [26, 44]]]) stroke(wander(a[0], a[1], b[0], b[1], 6, 0.012), [120, 120, 124], 0.9, 3);
  });
  // 5 leaves: a drift of them, brown and ochre
  inCell(GRIME.leaves, () => {
    soft(128, 128, 100, 70, [150, 136, 110], 0.12);
    for (let i = 0; i < 190; i++) {
      const x = 128 + (rng() + rng() + rng() - 1.5) * 150, y = 128 + (rng() + rng() + rng() - 1.5) * 110, q = rng();
      g.fillStyle = q < 0.4 ? rgba(150, 110, 60, 0.9) : q < 0.7 ? rgba(176, 140, 70, 0.9) : q < 0.9 ? rgba(120, 90, 54, 0.9) : rgba(130, 140, 70, 0.9);
      g.beginPath(); g.ellipse(x, y, 2.5 + rng() * 3, 1.3 + rng() * 1.6, rng() * 3.2, 0, 7); g.fill();
    }
  });
  // 6 weeds: a clump of blades and a mat of moss
  inCell(GRIME.weeds, () => {
    for (let i = 0; i < 9; i++) soft(128 + (rng() - 0.5) * 120, 128 + (rng() - 0.5) * 60, 14 + rng() * 22, 8 + rng() * 12, [96, 120, 62], 0.35 + rng() * 0.25, rng() * 3);
    for (let k = 0; k < 7; k++) { const cx = 128 + (rng() - 0.5) * 150, cy = 128 + (rng() - 0.5) * 70; for (let i = 0; i < 16; i++) { const a = rng() * 6.28, l = 8 + rng() * 22; stroke([[cx, cy], [cx + Math.cos(a) * l * 0.5 + (rng() - 0.5) * 4, cy + Math.sin(a) * l * 0.5], [cx + Math.cos(a) * l, cy + Math.sin(a) * l]], rng() < 0.7 ? [70, 112, 44] : [104, 132, 56], 0.9, 1.8 + rng() * 1.6); } }
  });
  // 7 skid: a pair of tyre marks along x, fading at both ends
  inCell(GRIME.skid, () => {
    for (const y of [92, 166]) for (let k = 0; k < 3; k++) {
      const gr = g.createLinearGradient(16, 0, 240, 0); gr.addColorStop(0, 'rgba(60,60,62,0)'); gr.addColorStop(0.3, 'rgba(60,60,62,0.34)'); gr.addColorStop(0.8, 'rgba(60,60,62,0.5)'); gr.addColorStop(1, 'rgba(60,60,62,0)');
      g.strokeStyle = gr; g.lineWidth = 5 + rng() * 5; g.beginPath(); g.moveTo(16, y + k * 3 - 3); g.quadraticCurveTo(128, y + 10 + k * 2, 240, y + 4 + k * 3); g.stroke();
    }
  });
  // ---- strips (they repeat along x: everything is drawn at x and x ± W)
  const wrap = (x, fn) => { for (const xx of [x, x - W, x + W]) fn(xx); };
  const band = (k, fn) => { const y0 = STRIP_Y + k * STRIP_H; g.save(); g.beginPath(); g.rect(0, y0 + 2, W, STRIP_H - 4); g.clip(); g.translate(0, y0 + 4); fn(STRIP_H - 8); g.restore(); };
  // a smooth periodic 0..1 profile along the strip
  const prof = (f) => { const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28]; return (x) => { const a = x / W * 6.2832; return Math.max(0, Math.min(1, 0.5 + 0.34 * Math.sin(a * f + ph[0]) + 0.26 * Math.sin(a * (f * 2 + 1) + ph[1]) + 0.2 * Math.sin(a * (f * 5 + 2) + ph[2]))); }; };
  // gutter (top edge = the kerb): silt and damp of uneven depth, with clear lengths; grit, leaves, a tide line
  band(STRIP.gutter, (H) => {
    const p = prof(2), q = prof(3);
    for (let x = 0; x < W; x += 4) {
      const d = p(x), a = 0.3 + 0.7 * q(x), depth = 14 + d * H * 0.8;
      const gr = g.createLinearGradient(0, 0, 0, depth); gr.addColorStop(0, rgba(78, 72, 64, 0.88 * a)); gr.addColorStop(0.45, rgba(96, 90, 80, 0.58 * a)); gr.addColorStop(1, rgba(120, 112, 100, 0));
      g.fillStyle = gr; g.fillRect(x, 0, 4.5, depth);
    }
    for (let i = 0; i < 16; i++) { const x = rng() * W; wrap(x, (xx) => soft(xx, 2, 30 + rng() * 60, 10 + rng() * 28, [128, 114, 92], 0.3 + rng() * 0.25)); }
    for (let i = 0; i < 800; i++) { const x = rng() * W, y = Math.pow(rng(), 2.2) * H * 0.8, t = rng(); g.fillStyle = t < 0.45 ? rgba(80, 72, 60, 0.5) : t < 0.8 ? rgba(150, 112, 62, 0.85) : rgba(120, 124, 70, 0.8); g.beginPath(); g.ellipse(x, y, 1.5 + rng() * 2.5, 1 + rng() * 1.4, rng() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 5; i++) { const x = rng() * W; wrap(x, (xx) => { for (let k = 0; k < 40; k++) { g.fillStyle = rng() < 0.6 ? rgba(150, 112, 62, 0.9) : rgba(124, 96, 56, 0.9); g.beginPath(); g.ellipse(xx + (rng() + rng() - 1) * 46, Math.pow(rng(), 1.6) * 30, 2 + rng() * 3, 1.2 + rng() * 1.5, rng() * 3, 0, 7); g.fill(); } }); }
  });
  // wall line (top edge = the wall / fence at the back of the footway): a thread of moss, clumps of weeds
  band(STRIP.wall, (H) => {
    const p = prof(3), q = prof(2);
    for (let x = 0; x < W; x += 3) { const a = Math.max(0, q(x) - 0.3) * 1.2, depth = 3 + p(x) * 20; const gr = g.createLinearGradient(0, 0, 0, depth); gr.addColorStop(0, rgba(84, 104, 58, 0.85 * a)); gr.addColorStop(1, rgba(100, 112, 70, 0)); g.fillStyle = gr; g.fillRect(x, 0, 3.5, depth); }
    for (let i = 0; i < 9; i++) { const x = rng() * W, s = 0.6 + rng() * 0.8; wrap(x, (xx) => { soft(xx, 3, 22 * s, 12 * s, [84, 100, 56], 0.5); for (let k = 0; k < 14; k++) { const a = Math.PI * (0.12 + rng() * 0.76), l = (14 + rng() * 44) * s; stroke([[xx + (rng() - 0.5) * 12, 0], [xx + Math.cos(a) * l * 0.6, Math.sin(a) * l * 0.55], [xx + Math.cos(a) * l * 1.1, Math.sin(a) * l]], rng() < 0.7 ? [66, 108, 42] : [100, 128, 54], 0.9, 2 + rng() * 2); } }); }
    for (let i = 0; i < 200; i++) { g.fillStyle = rng() < 0.5 ? rgba(70, 60, 44, 0.4) : rgba(88, 104, 56, 0.5); g.fillRect(rng() * W, Math.pow(rng(), 3) * 26, 1 + rng() * 3, 1 + rng() * 2); }
  });
  // fringe (the path edge runs along the middle): grass leaning in over the path (downwards), the verge darker behind it
  band(STRIP.fringe, (H) => {
    const m = H / 2, p = prof(3);
    const gr = g.createLinearGradient(0, 0, 0, m); gr.addColorStop(0, 'rgba(150,170,120,0)'); gr.addColorStop(1, 'rgba(120,150,90,0.45)'); g.fillStyle = gr; g.fillRect(0, 0, W, m);
    for (let x = 0; x < W; x += 3) { const d = 3 + p(x) * p(x) * (m - 14) * 0.7; const g2 = g.createLinearGradient(0, m, 0, m + d); g2.addColorStop(0, 'rgba(112,160,84,0.85)'); g2.addColorStop(0.5, 'rgba(118,160,88,0.4)'); g2.addColorStop(1, 'rgba(124,160,94,0)'); g.fillStyle = g2; g.fillRect(x, m - 1, 3.5, d + 1); }
    for (let i = 0; i < 1500; i++) { const x = rng() * W, l = 4 + rng() * rng() * (m - 8) * (0.3 + p(x)), lean = (rng() - 0.5) * 8; stroke([[x, m - 3], [x + lean * 0.5, m + l * 0.6], [x + lean, m + l]], rng() < 0.65 ? [104, 156, 76] : [132, 168, 92], 0.85, 0.9 + rng() * 0.9); }
    for (let i = 0; i < 20; i++) { const x = rng() * W; wrap(x, (xx) => soft(xx, m + 4, 14 + rng() * 22, 6 + rng() * 10, [110, 96, 74], 0.25)); }   // bare, trodden earth showing through
  });
  g.fillStyle = '#fff'; g.fillRect(0, STRIP_Y + 3 * STRIP_H, W, W - STRIP_Y - 3 * STRIP_H);
  TEX = canvasTexture(c, { linear: true, clampT: true, anisotropy: 4 });
  return TEX;
}

// ---------------------------------------------------------------- emitters (into the 'aoStrip' batch)
const key = (r, k) => hash01(r.id + ':' + k);
/** A flat decal: centre, unit direction d (the cell's u axis), half-length along, half-width across. */
function blot(buf, cx, cz, dx, dz, hl, hw, y, cell, flipU, flipV) {
  const nx = -dz, nz = dx, [u0, v0, u1, v1] = cellUV(cell), ua = flipU ? u1 : u0, ub = flipU ? u0 : u1, va = flipV ? v1 : v0, vb = flipV ? v0 : v1;
  const P = (s, q) => [cx + dx * s + nx * q, cz + dz * s + nz * q], a = P(-hl, -hw), b = P(hl, -hw), c = P(hl, hw), d = P(-hl, hw);
  const i0 = buf.v(a[0], y, a[1], 0, 1, 0, ua, va), i1 = buf.v(b[0], y, b[1], 0, 1, 0, ub, va), i2 = buf.v(c[0], y, c[1], 0, 1, 0, ub, vb), i3 = buf.v(d[0], y, d[1], 0, 1, 0, ua, vb);
  buf.quadFacing(i0, i1, i2, i3, 0, 1, 0);
}
/** A strip along a polyline between lateral offsets `edge` (the line it hugs: strip v = top) and `far`. */
function strip(buf, pts, edge, far, y, k, len, u0, ok) {
  const [vt, vb] = stripV(k);
  let acc = u0 * len, n = 0, pa = null, pb = null, pu = 0;
  const good = (a, b, c, d) => ok((a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4) && ok((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) && ok((c[0] + d[0]) / 2, (c[1] + d[1]) / 2) && ok((a[0] + c[0]) / 2, (a[1] + c[1]) / 2) && ok((b[0] + d[0]) / 2, (b[1] + d[1]) / 2);
  const quad = (a, b, c, d, u0q, u1q) => {      // a, c on the edge line; b, d on the far line
    const i0 = buf.v(a[0], y, a[1], 0, 1, 0, u0q, vt), i1 = buf.v(b[0], y, b[1], 0, 1, 0, u0q, vb), i2 = buf.v(d[0], y, d[1], 0, 1, 0, u1q, vb), i3 = buf.v(c[0], y, c[1], 0, 1, 0, u1q, vt);
    buf.quadFacing(i0, i1, i2, i3, 0, 1, 0); n++;
  };
  for (let i = 0; i < pts.length; i++) {
    const sl = i > 0 ? Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) : 0; acc += sl;
    const [nx, nz, m] = miterAt(pts, i), mm = Math.min(m, 1.6);
    const a = [pts[i][0] + nx * edge * mm, pts[i][1] + nz * edge * mm], b = [pts[i][0] + nx * far * mm, pts[i][1] + nz * far * mm], u = acc / len;
    if (pa) {
      if (!ok || good(pa, pb, a, b)) quad(pa, pb, a, b, pu, u);
      else {
        // part of this length would lie on another road's surface, or under another road's pavement (the ends of a
        // street at a junction, mostly): laid in 3 m pieces, without the ones that would
        const np = Math.ceil(sl / 3), L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
        for (let j = 0; j < np && np > 1; j++) { const t0 = j / np, t1 = (j + 1) / np, a0 = L(pa, a, t0), b0 = L(pb, b, t0), a1 = L(pa, a, t1), b1 = L(pb, b, t1); if (good(a0, b0, a1, b1)) quad(a0, b0, a1, b1, pu + (u - pu) * t0, pu + (u - pu) * t1); }
      }
    }
    pa = a; pb = b; pu = u;
  }
  return n;
}
const on = (ctx) => ROUGH && ctx.batch.has('aoStrip');
const YR = Y.marking, YP = Y.pavement + 0.005, YF = Y.path + 0.005;

/**
 * A street's dirt. segs = the open lengths of the road that have a raised pavement (roads.js), pw its width (0 = none).
 * `stats` counts what was laid (tools/smoke_rough.mjs).
 */
export function roughStreet(ctx, r, pts, w, pw, segs, zone, mx, mz) {
  if (!on(ctx)) return;
  // queued: laid by roughFlush once every road is known (a decal must not lie in another road, or under its pavement)
  (ctx.roughQ || (ctx.roughQ = [])).push([0, r, pts, w, pw, segs, zone, mx, mz]);
  if (pw > 0) { const G = ctx.roughPave || (ctx.roughPave = new SpatialGrid(40)), hw = w / 2; for (const seg of segs) for (let j = 0; j < seg.length - 1; j++) G.insertSeg(seg[j][0], seg[j][1], seg[j + 1][0], seg[j + 1][1], { ax: seg[j][0], az: seg[j][1], bx: seg[j + 1][0], bz: seg[j + 1][1], hw, pw, road: r }); }
}
/** (lanes pass) a raised pavement piece drawn outside the street's both-sided intervals (round a junction, across a
 *  split in the way): decals of other roads must not lie under it */
export function roughPaveExtra(ctx, r, seg, w, pw) {
  if (!on(ctx) || !(pw > 0)) return;
  const G = ctx.roughPave || (ctx.roughPave = new SpatialGrid(40)), hw = w / 2;
  for (let j = 0; j < seg.length - 1; j++) G.insertSeg(seg[j][0], seg[j][1], seg[j + 1][0], seg[j + 1][1], { ax: seg[j][0], az: seg[j][1], bx: seg[j + 1][0], bz: seg[j + 1][1], hw, pw, road: r });
}
function tests(ctx) {
  const live = (it) => it.veh && !(it.road.tunnel && it.road.tunnel !== 'building_passage') && !(it.road.layer && +it.road.layer < 0 && !it.road.bridge);
  /** in a drawn carriageway (other than `self`'s), m metres inside its edge (negative: or within -m of it) */
  const inCarriage = (x, z, self, m) => { let hit = false; ctx.roadGrid.queryRadius(x, z, 14, (it) => { if (it.road === self || !live(it)) return; if (distToSeg(x, z, it.ax, it.az, it.bx, it.bz) < it.w / 2 - m) { hit = true; return true; } }); return hit; };
  /** on (under) a drawn raised pavement of a road other than `self` */
  const onPave = (x, z, self, m = 0.16) => {
    let hit = false;
    if (ctx.roughPave) ctx.roughPave.queryRadius(x, z, 8, (it) => {
      if (it.road === self) return;
      const dx = it.bx - it.ax, dz = it.bz - it.az, l2 = dx * dx + dz * dz || 1, t = ((x - it.ax) * dx + (z - it.az) * dz) / l2; if (t < -0.02 || t > 1.02) return;
      const d = Math.abs((x - it.ax) * dz - (z - it.az) * dx) / Math.sqrt(l2);
      if (d > it.hw - m && d < it.hw + it.pw + m) { hit = true; return true; }
    });
    return hit;
  };
  return { inCarriage, onPave };
}
function layStreet(ctx, T, r, pts, w, pw, segs, zone, mx, mz) {
  const okRoad = (x, z) => !T.onPave(x, z, r), okPave = (x, z) => !T.inCarriage(x, z, null, 0.02) && !T.onPave(x, z, r);
  const okBlot = (ok, cx, cz, dx, dz, hl, hwid) => ok(cx, cz) && ok(cx + dx * hl - dz * hwid, cz + dz * hl + dx * hwid) && ok(cx - dx * hl - dz * hwid, cz - dz * hl + dx * hwid) && ok(cx + dx * hl + dz * hwid, cz + dz * hl - dx * hwid) && ok(cx - dx * hl + dz * hwid, cz - dz * hl - dx * hwid);
  const buf = ctx.batch.buf('aoStrip', mx, mz), st = (ctx.stats.rough = ctx.stats.rough || { strips: 0, blots: 0, fringes: 0, trees: 0 });
  buf.setColor(2, 1, 0);
  const L = polylineLength(pts), hw = w / 2, busy = zone === 'centre' ? 0.7 : 1;
  // gutters and the wall line, where there is a kerb
  for (let i = 0; i < segs.length; i++) for (const s of [1, -1]) {
    const seg = segs[i], h = key(r, 'g' + i + s);
    st.strips += strip(buf, seg, s * hw, s * (hw - (0.4 + h * 0.3)), YR, STRIP.gutter, 9 + h * 4, h * 7, okRoad);
    if (pw >= 1.2 && zone !== 'centre' && zone !== 'mid' && key(r, 'w' + s) < 0.6) st.strips += strip(buf, seg, s * (hw + pw), s * (hw + pw - Math.min(0.42, pw * 0.3)), YP, STRIP.wall, 8 + h * 5, h * 5 + 2, okPave);
  }
  // the carriageway: something every 16-30 m
  if (r.kind !== 'pedestrian' && w >= 4.5) {
    for (let d = 4 + key(r, 'c') * 14, k = 0; d < L - 3; d += 16 + key(r, 'cs' + k) * 14, k++) {
      const P = pointAt(pts, d), h = key(r, 'c' + k), h2 = key(r, 'd' + k), h3 = key(r, 'e' + k), side = h2 < 0.5 ? 1 : -1;
      let cell, o, hl, hwid, tilt = (h3 - 0.5) * 0.24;
      if (h < 0.26) { cell = GRIME.oil; o = side * (r.oneway ? 0 : hw * 0.5) + (h3 - 0.5) * 0.5; hl = 1.1 + h2 * 1.4; hwid = 0.5 + h3 * 0.4; }
      else if (h < 0.44) { cell = GRIME.crackA; o = side * hw * (0.15 + h3 * 0.55); hl = 1.6 + h2 * 1.6; hwid = hl * 0.55; tilt = (h3 - 0.5) * 1.2; }
      else if (h < 0.56) { cell = GRIME.crackB; o = side * hw * (0.3 + h3 * 0.4); hl = 0.9 + h2 * 0.8; hwid = hl * 0.8; }
      else if (h < 0.74) { cell = GRIME.patch; o = side * hw * (0.25 + h3 * 0.45); hl = 0.7 + h2 * 1.5; hwid = 0.5 + h3 * 0.7; tilt = 0; }
      else if (h < 0.9) { cell = GRIME.silt; o = side * (hw - 0.9 - h3 * 0.5); hl = 1.2 + h2 * 1.2; hwid = 0.75 + h3 * 0.3; }
      else { cell = GRIME.skid; o = side * (r.oneway ? 0 : hw * 0.5); hl = 2.6 + h2 * 2; hwid = 0.95; tilt = (h3 - 0.5) * 0.1; }
      if (Math.abs(o) + hwid > hw - 0.05) continue;                                    // never over the kerb
      const cs = Math.cos(tilt), sn = Math.sin(tilt), dx = P.dx * cs - P.dz * sn, dz = P.dz * cs + P.dx * sn;
      if (!okBlot(okRoad, P.x - P.dz * o, P.z + P.dx * o, dx, dz, hl, hwid)) continue;
      buf.setColor(2, cell === GRIME.crackA ? 0.55 + h3 * 0.2 : cell === GRIME.crackB || cell === GRIME.patch ? 0.7 + h3 * 0.2 : 0.8 + h3 * 0.2, 0);
      blot(buf, P.x - P.dz * o, P.z + P.dx * o, dx * side, dz * side, hl, hwid, YR, cell, h3 < 0.5, h2 < 0.25); st.blots++;
    }
  } else if (r.kind === 'pedestrian') {
    // paved streets (Cornmarket, Queen Street, Radcliffe Square): stains and leaves, weeds only at the edges
    for (let d = 3 + key(r, 'c') * 8, k = 0; d < L - 2; d += 9 + key(r, 'cs' + k) * 10, k++) {
      const P = pointAt(pts, d), h = key(r, 'c' + k), h2 = key(r, 'd' + k), h3 = key(r, 'e' + k), side = h2 < 0.5 ? 1 : -1;
      const edge = h < 0.3, cell = edge ? GRIME.weeds : h < 0.62 ? GRIME.silt : h < 0.8 ? GRIME.leaves : GRIME.crackA;
      const hl = edge ? 0.5 + h3 * 0.5 : 0.8 + h3 * 0.9, hwid = edge ? 0.22 : hl * 0.7, o = side * (edge ? hw - 0.25 : hw * h3 * 0.75);
      if (!okBlot(okRoad, P.x - P.dz * o, P.z + P.dx * o, P.dx, P.dz, hl, hwid)) continue;
      blot(buf, P.x - P.dz * o, P.z + P.dx * o, P.dx * side, P.dz * side, hl, hwid, YR, cell, h3 < 0.5, edge ? side > 0 : h2 < 0.25); st.blots++;
    }
  }
  buf.setColor(2, 1, 0);
  // the footways: a stain, a drift of leaves, a weed at the kerb joint or a crack every 10-22 m a side
  if (pw >= 1.2) for (let i = 0; i < segs.length; i++) for (const s of [1, -1]) {
    const seg = segs[i], SL = polylineLength(seg);
    for (let d = 2 + key(r, 'p' + i + s) * 10, k = 0; d < SL - 1.5; d += (10 + key(r, 'ps' + i + s + k) * 12) / busy, k++) {
      const P = pointAt(seg, d), h = key(r, 'p' + i + s + k), h2 = key(r, 'q' + i + s + k), h3 = key(r, 'r' + i + s + k);
      const kerb = h >= 0.78, cell = h < 0.34 ? GRIME.silt : h < 0.56 ? GRIME.leaves : h < 0.78 ? GRIME.crackA : GRIME.weeds;
      if (cell === GRIME.leaves && zone === 'centre' && h2 < 0.6) continue;
      const hwid = kerb ? 0.1 : Math.min(pw * 0.42, 0.45 + h3 * 0.4), hl = kerb ? 0.22 + h3 * 0.2 : hwid * (1.2 + h2 * 0.6);
      const o = s * (kerb ? hw + 0.25 : hw + 0.2 + hwid + h2 * Math.max(0, pw - 0.4 - 2 * hwid));
      if (!okBlot(okPave, P.x - P.dz * o, P.z + P.dx * o, P.dx, P.dz, hl, hwid)) continue;
      blot(buf, P.x - P.dz * o, P.z + P.dx * o, P.dx, P.dz, hl, hwid, YP, cell, h3 < 0.5, h2 < 0.5); st.blots++;
    }
  }
}

/** A path across grass: ragged grass over both edges (the strip straddles the edge, blades towards the middle). */
export function roughPath(ctx, r, pts, w, mx, mz) {
  if (on(ctx)) (ctx.roughQ || (ctx.roughQ = [])).push([1, r, pts, w, mx, mz]);
}
function layPath(ctx, T, r, pts, w, mx, mz) {
  const ok = (x, z) => !T.inCarriage(x, z, null, -0.4) && !T.onPave(x, z, null);
  const buf = ctx.batch.buf('aoStrip', mx, mz), st = (ctx.stats.rough = ctx.stats.rough || { strips: 0, blots: 0, fringes: 0, trees: 0 });
  buf.setColor(2, 1, 0);
  const hw = w / 2, d = Math.min(0.34, w * 0.2);
  for (const s of [1, -1]) { const h = key(r, 'f' + s); st.fringes += strip(buf, pts, s * (hw + d * 0.8), s * (hw - d), YF, STRIP.fringe, 7 + h * 4, h * 9, ok); }
}

/**
 * Moss and weeds where a wall meets the ground, round the footprints that get a contact-shadow strip (buildings.js:
 * standing on the ground, over 45 m2, not rebuilt by a place module). About four buildings in ten, their longer
 * faces only.
 */
function layWallBases(ctx, T) {
  const skip = ctx.ov && ctx.ov.skip;
  for (const b of ctx.map.buildings || []) {
    if (b.hasParts || (b.minH || 0) >= 0.5 || (skip && skip.has(b.id)) || !b.poly || b.poly.length < 3 || hash01('wb' + b.id) > 0.38) continue;
    const poly = cleanRing(b.poly); if (poly.length < 3 || Math.abs(signedArea(poly)) < 45) continue;
    wallBase(ctx, T, poly, b.id);
  }
}
function wallBase(ctx, T, poly, id) {
  const n = poly.length;
  const sg = signedArea(poly) > 0 ? 1 : -1, buf = ctx.batch.buf('aoStrip', poly[0][0], poly[0][1]), [vt, vb] = stripV(STRIP.wall), hb = hash01('wc' + id);
  buf.setColor(2, 0.55 + hb * 0.45, 0);
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 2.5 || hash01('we' + id + ':' + i) < 0.3) continue;
    const ux = dx / l, uz = dz / l, ox = uz * sg, oz = -ux * sg, e = 0.12, wd = 0.3, len = 8 + hb * 5;   // (ox, oz): outward, as buildings.js aoStrip
    let u = hash01('wu' + id + ':' + i) * 7;
    // each face (or, where it is part on and part off a raised pavement, each 4 m of it) at the height of the ground
    // it lies on; a piece that would straddle a pavement's edge is left out
    const where = (p0, p1) => {
      let on = 0, off = 0;
      for (const t of [0.04, 0.5, 0.96]) for (const q of [0.03, 0.29]) { const x = p0[0] + (p1[0] - p0[0]) * t + ox * q, z = p0[1] + (p1[1] - p0[1]) * t + oz * q; if (T.onPave(x, z, null, -0.03)) on++; else if (!T.onPave(x, z, null, 0.2)) off++; }
      return on === 6 ? 1 : off === 6 ? -1 : 0;
    };
    const piece = (p0, p1, pl, w) => {
      const cx = (p0[0] + p1[0]) / 2 + ox * 0.15, cz = (p0[1] + p1[1]) / 2 + oz * 0.15;
      if (w < 0 && T.inCarriage(cx, cz, null, -0.2)) return;
      const y = w > 0 ? YP + 0.001 : YF;
      const i0 = buf.v(p0[0], y, p0[1], 0, 1, 0, u, vt), i1 = buf.v(p1[0], y, p1[1], 0, 1, 0, u + pl / len, vt);
      const i2 = buf.v(p1[0] + ox * wd, y, p1[1] + oz * wd, 0, 1, 0, u + pl / len, vb), i3 = buf.v(p0[0] + ox * wd, y, p0[1] + oz * wd, 0, 1, 0, u, vb);
      buf.quadFacing(i0, i1, i2, i3, 0, 1, 0); ctx.stats.rough.walls = (ctx.stats.rough.walls || 0) + 1;
    };
    const A = [a[0] + ux * e, a[1] + uz * e], B = [b[0] - ux * e, b[1] - uz * e], wAll = where(A, B);
    if (wAll) { piece(A, B, l - 2 * e, wAll); continue; }
    const m = Math.ceil((l - 2 * e) / 4), pl = (l - 2 * e) / m;
    for (let k = 0; k < m; k++, u += pl / len) { const p0 = [A[0] + ux * k * pl, A[1] + uz * k * pl], p1 = [p0[0] + ux * pl, p0[1] + uz * pl], w = where(p0, p1); if (w) piece(p0, p1, pl, w); }
  }
}

/**
 * Lawn and verge edges: where mown grass (a park, garden, grass or grass-pitch polygon) meets HARD ground — paving,
 * gravel, a path, a yard — the edge is frayed with the same ragged strip as the paths. Not where grass meets grass,
 * water, a carriageway or a raised pavement (there the kerb is the edge).
 */
function layLawnEdges(ctx, T) {
  const st = ctx.stats.rough, LAWN = new Set(['park', 'garden', 'grass', 'pitch']), GREEN = new Set(['park', 'garden', 'grass', 'meadow', 'wood', 'scrub', 'pitch', 'flowerbed']);
  const grid = new SpatialGrid(60), wet = new SpatialGrid(60);
  const bbOf = (poly) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; } return [x0, z0, x1, z1]; };
  for (const it of ctx.areaList || []) if (GREEN.has(it.a.kind)) { const b = bbOf(it.poly); grid.insertBox(b[0], b[1], b[2], b[3], { it, b }); }
  for (const a of ctx.map.areas || []) if (a.kind === 'water' && a.poly && a.poly.length >= 3) { const b = bbOf(a.poly); wet.insertBox(b[0], b[1], b[2], b[3], { poly: a.poly, b }); }
  for (const w of ctx.map.waterlines || []) if (w.pts && !w.tunnel) for (let i = 0; i < w.pts.length - 1; i++) wet.insertSeg(w.pts[i][0], w.pts[i][1], w.pts[i + 1][0], w.pts[i + 1][1], { ax: w.pts[i][0], az: w.pts[i][1], bx: w.pts[i + 1][0], bz: w.pts[i + 1][1], hw: (w.w || 2) / 2 + 1.2 });
  const inP = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const green = (x, z, self) => { let hit = false; grid.queryRadius(x, z, 0.5, (q) => { if (q.it === self || x < q.b[0] || x > q.b[2] || z < q.b[1] || z > q.b[3]) return; if (inP(x, z, q.it.poly) && !q.it.holes.some((h) => inP(x, z, h))) { hit = true; return true; } }); return hit; };
  const water = (x, z) => { let hit = false; wet.queryRadius(x, z, 8, (q) => { if (q.poly ? x >= q.b[0] && x <= q.b[2] && z >= q.b[1] && z <= q.b[3] && inP(x, z, q.poly) : distToSeg(x, z, q.ax, q.az, q.bx, q.bz) < q.hw) { hit = true; return true; } }); return hit; };
  const onWay = (x, z) => { let hit = false; ctx.pathGrid.queryRadius(x, z, 6, (q) => { if (distToSeg(x, z, q.ax, q.az, q.bx, q.bz) < Math.min(6, Math.max(1.2, q.w)) / 2) { hit = true; return true; } }); return hit; };
  // hard ground just outside the edge: not grass of any kind, not water, not a road or its pavement
  const hard = (x, z, self) => !green(x, z, self) && !water(x, z) && !T.inCarriage(x, z, null, -0.3) && !T.onPave(x, z, null) && (onWay(x, z) || !ctx.baseGreen || !ctx.baseGreen(x, z));
  for (const it of ctx.areaList || []) {
    const a = it.a; if (!LAWN.has(a.kind)) continue;
    if (a.kind === 'pitch' && (a.sport === 'tennis' || (a.surface && a.surface !== 'grass'))) continue;
    for (const ring of [it.poly, ...it.holes]) {
      const n = ring.length; if (n < 3) continue;
      // which side is outside: left of travel (the strip's positive offsets) or right
      let sg = 0;
      for (let i = 0; i < n && !sg; i++) { const p = ring[i], q = ring[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz); if (l < 1) continue; const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, inL = inP(mx - dz / l * 0.2, mz + dx / l * 0.2, it.poly) && !it.holes.some((h) => inP(mx - dz / l * 0.2, mz + dx / l * 0.2, h)); sg = inL ? -1 : 1; }
      if (!sg) continue;
      const okE = new Uint8Array(n); let any = false, all = true;
      for (let i = 0; i < n; i++) {
        const p = ring[i], q = ring[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz);
        if (l > 0.8) { const ox = -dz / l * sg * 0.4, oz = dx / l * sg * 0.4; okE[i] = hard(p[0] + dx * 0.5 + ox, p[1] + dz * 0.5 + oz, it) && hard(p[0] + dx * 0.2 + ox, p[1] + dz * 0.2 + oz, it) && hard(p[0] + dx * 0.8 + ox, p[1] + dz * 0.8 + oz, it) ? 1 : 0; }
        if (okE[i]) any = true; else all = false;
      }
      if (!any) continue;
      const h = hash01(a.id + ':lf'), lay = (run) => { const buf = ctx.batch.buf('aoStrip', run[0][0], run[0][1]); buf.setColor(2, 0.85, 0); st.fringes += strip(buf, run, -sg * 0.22, sg * 0.3, YF, STRIP.fringe, 7 + h * 4, h * 9); };
      if (all) { lay([...ring, ring[0], ring[1]].slice(0, n + 1)); continue; }
      let start = 0; while (okE[start]) start++;                       // begin after an edge that is not frayed
      for (let k = 1; k <= n; k++) {
        const i = (start + k) % n; if (!okE[i]) continue;
        const run = [ring[i]]; let j = i; while (okE[j] && run.length <= n) { j = (j + 1) % n; run.push(ring[j]); k++; }
        k--; if (run.length >= 2) lay(run);
      }
    }
  }
}

/** Lays everything queued, then leaf litter under trees that stand in a footway (the drawn, raised pavements only). */
export function roughFlush(ctx) {
  if (!on(ctx) || !ctx.roughQ) return;
  const T = tests(ctx); ctx.stats.rough = ctx.stats.rough || { strips: 0, blots: 0, fringes: 0, trees: 0 };
  for (const q of ctx.roughQ) if (q[0] === 0) layStreet(ctx, T, q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8]); else layPath(ctx, T, q[1], q[2], q[3], q[4], q[5]);
  ctx.roughQ = null;
  layLawnEdges(ctx, T);
  layWallBases(ctx, T);
  if (!ctx.roughPave) return;
  const st = ctx.stats.rough;
  for (const t of ctx.map.trees || []) {
    const x = t[0], z = t[1], h = hash01('lt' + Math.round(x * 10) + ',' + Math.round(z * 10));
    if (h > 0.7) continue;
    let best = null, room = 0;
    ctx.roughPave.queryRadius(x, z, 8, (it) => {
      const ddx = it.bx - it.ax, ddz = it.bz - it.az, l2 = ddx * ddx + ddz * ddz || 1, tt = ((x - it.ax) * ddx + (z - it.az) * ddz) / l2;
      if (tt < 0.02 || tt > 0.98) return;
      const d = distToSeg(x, z, it.ax, it.az, it.bx, it.bz) - it.hw, m = Math.min(d, it.pw - d);   // room to the kerb / to the back of the footway
      if (m > room) { room = m; best = it; }
    });
    if (!best || room < 0.3) continue;
    const dx = best.bx - best.ax, dz = best.bz - best.az, l = Math.hypot(dx, dz) || 1, hwid = Math.min(0.9, room - 0.04);
    if (T.inCarriage(x, z, null, -hwid)) continue;
    const buf = ctx.batch.buf('aoStrip', x, z); buf.setColor(2, 1, 0);
    blot(buf, x, z, dx / l, dz / l, hwid * (1.3 + h), hwid, YP + 0.002, GRIME.leaves, h < 0.3, (h * 10) % 1 < 0.5); st.trees++;
  }
}
