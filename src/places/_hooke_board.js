// The whiteboard in the Robert Hooke Building's banana room (owned by places/hooke_building.js): a set of black x–y axes
// in marker pen (ticks, arrowheads, "x" and "y") with a big bright yellow banana drawn over them.
// Painted pixel by pixel into an RGBA buffer (signed distances, antialiased) — no fonts, no DOM — so the same picture is
// drawn in the browser (put on the board canvas) and in node (tools/smoke_hooke.mjs samples it).
//   paintBoard(W = 1024, H = 512) -> Uint8ClampedArray (RGBA, row 0 at the top)
//   BOARD_PROBES  board-space points the test samples: banana body, its outline, the axes, the empty board

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => a + (b - a) * t;
/** distance from p to segment ab */
function segD(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / l2);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
/** signed distance to a convex polygon given as [[x, y]...] counter- or clockwise (negative inside) */
function polyD(px, py, P) {
  let inside = true, d = 1e9, sgn = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    d = Math.min(d, segD(px, py, a[0], a[1], b[0], b[1]));
    const c = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    if (c !== 0) { const s = Math.sign(c); if (sgn === 0) sgn = s; else if (s !== sgn) inside = false; }
  }
  return inside ? -d : d;
}

// layout in a 1024 × 512 board (scaled for other sizes)
const AX = { ox: 132, oy: 440, xEnd: 985, yEnd: 34, tick: 86, ink: 11 };
const SPECKLES = [[0.22, 0.35, 3.2], [0.3, -0.1, 2.4], [0.47, 0.55, 2.8], [0.56, 0.05, 2.2], [0.64, 0.42, 3.4], [0.71, -0.25, 2.3], [0.38, 0.62, 2.6], [0.8, 0.3, 2.5]];
const BAN = { cx: 590, cy: -70, R: 440, a0: (142 * Math.PI) / 180, a1: (38 * Math.PI) / 180, r: 64 };
export const BOARD_PROBES = {
  banana: [[590, 370], [430, 335], [760, 330]],              // inside the yellow body
  outline: [[0, 0]],                                         // the dark outline under the belly (below)
  tip: [[0, 0]],                                             // filled in below (the brown blossom end)
  axes: [[400, AX.oy], [AX.ox, 250], [AX.ox + AX.tick * 3, AX.oy + 9]],   // x axis, y axis, a tick
  blank: [[900, 120], [300, 480]],
};
{ BOARD_PROBES.outline[0] = [BAN.cx, Math.round(BAN.cy + BAN.R + BAN.r * 0.94 - 2)]; const a = BAN.a0 - 0.01, rr = BAN.R; BOARD_PROBES.tip[0] = [Math.round(BAN.cx + Math.cos(a) * rr), Math.round(BAN.cy + Math.sin(a) * rr)]; }

/** paint the board; returns RGBA bytes, row 0 = top */
export function paintBoard(W = 1024, H = 512) {
  const out = new Uint8ClampedArray(W * H * 4);
  const k = W / 1024;           // all layout numbers are in 1024-wide units
  // the board: white, a faint cool tint towards the edges, ghosts of old marker
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, ex = Math.min(x, W - 1 - x) / W, ey = Math.min(y, H - 1 - y) / H;
    const edge = 1 - clamp01(Math.min(ex, ey) * 9);
    const ghost = 0.5 + 0.5 * Math.sin(x * 0.013 + Math.sin(y * 0.021) * 2.1) * Math.sin(y * 0.017 + 1.3);
    const g = 247 - edge * 10 - ghost * 5;
    out[i] = g - 2; out[i + 1] = g; out[i + 2] = g + 3; out[i + 3] = 255;
  }
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 4;
    out[i] = mix(out[i], r, a); out[i + 1] = mix(out[i + 1], g, a); out[i + 2] = mix(out[i + 2], b, a);
  };
  /** fill everything within the bbox where sdf(x, y) < 0 (1024-units), antialiased */
  const fill = (x0, y0, x1, y1, sdf, col) => {
    const X0 = Math.max(0, Math.floor(x0 * k) - 2), X1 = Math.min(W - 1, Math.ceil(x1 * k) + 2), Y0 = Math.max(0, Math.floor(y0 * k) - 2), Y1 = Math.min(H - 1, Math.ceil(y1 * k) + 2);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const d = sdf((x + 0.5) / k, (y + 0.5) / k) * k;
      if (d < 0.75) put(x, y, col[0], col[1], col[2], clamp01(0.5 - d) * (col[3] ?? 1));
    }
  };
  const INK = [24, 24, 30, 0.96];
  /** a marker stroke (capsule) a -> b */
  const stroke = (ax, ay, bx, by, w = AX.ink, col = INK) => fill(Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w, (x, y) => segD(x, y, ax, ay, bx, by) - w / 2, col);
  const tri = (P, col = INK) => fill(Math.min(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[0])), Math.max(...P.map((p) => p[1])), (x, y) => polyD(x, y, P) - 0.6, col);

  // ---------------------------------------------------------------- axes (hand-drawn: a slight wobble along the line)
  const wob = (t, s) => Math.sin(t * 0.031 + s) * 1.3 + Math.sin(t * 0.087 + s * 2) * 0.6;
  for (let x = AX.ox - 18; x < AX.xEnd - 20; x += 12) stroke(x, AX.oy + wob(x, 1), x + 12, AX.oy + wob(x + 12, 1));
  for (let y = AX.oy + 18; y > AX.yEnd + 20; y -= 12) stroke(AX.ox + wob(y, 4), y, AX.ox + wob(y - 12, 4), y - 12);
  tri([[AX.xEnd + 12, AX.oy], [AX.xEnd - 34, AX.oy - 21], [AX.xEnd - 34, AX.oy + 21]]);
  tri([[AX.ox, AX.yEnd - 12], [AX.ox - 21, AX.yEnd + 34], [AX.ox + 21, AX.yEnd + 34]]);
  for (let i = 1; AX.ox + i * AX.tick < AX.xEnd - 40; i++) { const x = AX.ox + i * AX.tick; stroke(x, AX.oy - 15, x, AX.oy + 15, 8.5); }
  for (let i = 1; AX.oy - i * AX.tick > AX.yEnd + 40; i++) { const y = AX.oy - i * AX.tick; stroke(AX.ox - 15, y, AX.ox + 15, y, 8.5); }
  // "x" under the end of the x axis, "y" left of the top of the y axis (handwritten strokes)
  { const x = AX.xEnd - 40, y = AX.oy + 40; stroke(x - 16, y - 16, x + 16, y + 16, 10); stroke(x + 16, y - 16, x - 16, y + 16, 10); }
  { const x = AX.ox - 58, y = AX.yEnd + 34; stroke(x - 19, y - 22, x, y + 8, 10); stroke(x + 20, y - 22, x - 10, y + 38, 10); stroke(x - 10, y + 38, x - 21, y + 34, 10); }
  // a little "0" at the origin
  fill(AX.ox - 52, AX.oy + 12, AX.ox - 16, AX.oy + 62, (x, y) => Math.abs(Math.hypot((x - (AX.ox - 34)) / 0.72, y - (AX.oy + 36)) - 17) - 4.5, INK);

  // ---------------------------------------------------------------- the banana
  // a curved body: a disc of radius r(t) swept along an arc (centre cx, cy; radius R) from angle a0 (left, the blossom
  // end) to a1 (right, the stalk end), smiling (tips up); shaded across its width, with ridges, a brown tip, a stalk
  const B = BAN, span = B.a0 - B.a1;
  const rOf = (t) => B.r * Math.pow(Math.sin(Math.PI * clamp01(t)), 0.55) * (1 - 0.12 * t);
  const X0 = (B.cx - B.R - 40) * k, X1 = (B.cx + B.R + 40) * k, Y0 = (B.cy + B.R * Math.sin(B.a1) - 80) * k, Y1 = (B.cy + B.R + B.r + 10) * k;
  for (let py = Math.max(0, Math.floor(Y0)); py <= Math.min(H - 1, Math.ceil(Y1)); py++) for (let px = Math.max(0, Math.floor(X0)); px <= Math.min(W - 1, Math.ceil(X1)); px++) {
    const x = (px + 0.5) / k, y = (py + 0.5) / k, dx = x - B.cx, dy = y - B.cy;
    const rho = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    const t = (B.a0 - ang) / span;                    // 0 at the left tip … 1 at the stalk
    const off = rho - B.R;                            // + = outer (lower) side
    // stalk: a short narrower tube continuing the arc past the right end, ending in a dark cut
    const ts = (t - 1) * span * B.R;                  // arc length beyond the end (1024-units)
    if (ts > -14 && ts < 46) {
      const rs = 15 - ts * 0.06, ds = Math.abs(off + 8 + ts * 0.18) - rs;
      if (ds < 0.75) {
        const a = clamp01(0.5 - ds * k), endCut = ts > 38;
        const shade = clamp01(0.5 + (off + 8 + ts * 0.18) / (2 * rs));
        const col = endCut ? [52, 38, 20] : ds > -3.2 ? [48, 40, 18] : [mix(150, 96, shade), mix(140, 92, shade), mix(52, 30, shade)];
        put(px, py, col[0], col[1], col[2], a);
        continue;
      }
    }
    if (t < 0 || t > 1.0) continue;
    const r = rOf(t);
    const e = r - Math.abs(off);                      // distance inside the edge
    if (e < -0.75) continue;
    const a = clamp01(0.5 + e * k);
    let R, G, Bl;
    if (e < 7.5) { R = 40; G = 30; Bl = 12; }          // dark outline
    else {
      const v = off / Math.max(1, r);                  // -1 inner/top … +1 outer/bottom
      // base yellow, darker and warmer to the bottom, a highlight band near the top, a faint greenish tinge at the stalk end
      const dark = clamp01((v + 0.15) / 1.15);
      R = mix(255, 222, dark * dark); G = mix(222, 162, dark); Bl = mix(60, 18, dark);
      const hl = Math.exp(-Math.pow((v + 0.42) / 0.18, 2)) * (0.6 + 0.4 * Math.sin(t * Math.PI));
      R = mix(R, 255, hl * 0.85); G = mix(G, 246, hl * 0.85); Bl = mix(Bl, 170, hl * 0.85);
      // two faint ridges along the body
      const rid = Math.max(Math.exp(-Math.pow((v - 0.18) / 0.05, 2)), 0.7 * Math.exp(-Math.pow((v + 0.62) / 0.05, 2)));
      R -= 22 * rid; G -= 30 * rid; Bl -= 8 * rid;
      const green = clamp01((t - 0.86) / 0.14);
      R = mix(R, 196, green * 0.55); G = mix(G, 196, green * 0.35); Bl = mix(Bl, 52, green * 0.4);
      // the blossom end: brown, then a black tip
      const tip = clamp01((0.075 - t) / 0.05);
      R = mix(R, 112, tip); G = mix(G, 74, tip); Bl = mix(Bl, 26, tip);
      if (t < 0.022) { R = 46; G = 32; Bl = 14; }
      // a few ripe speckles
      for (const [st, sv, sr] of SPECKLES) { const q = Math.hypot((t - st) * span * B.R, (v - sv) * r); if (q < sr) { const f = clamp01(sr - q); R -= 80 * f; G -= 85 * f; Bl -= 25 * f; } }
    }
    put(px, py, R, G, Bl, a);
  }
  return out;
}

/** read a pixel [r, g, b] at board-space (1024 × 512 units) */
export function sample(buf, W, H, bx, by) {
  const x = Math.min(W - 1, Math.max(0, Math.round((bx * W) / 1024))), y = Math.min(H - 1, Math.max(0, Math.round((by * W) / 1024)));
  const i = (y * W + x) * 4;
  return [buf[i], buf[i + 1], buf[i + 2]];
}
export const isYellow = ([r, g, b]) => r > 200 && g > 150 && b < 120 && r - b > 110;
export const isInk = ([r, g, b]) => r < 90 && g < 90 && b < 90;
export const isWhite = ([r, g, b]) => r > 220 && g > 220 && b > 220;
