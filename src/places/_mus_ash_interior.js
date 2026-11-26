// The Ashmolean as a walk-in building (plan, what is researched and what is guessed: _mus_ash_plan.js; coordinates =
// the portico frame, +z = SOUTH to Beaumont Street, y = 0 the top of the portico's podium), built in place inside its
// mapped outline:
//   ground: Cockerell's front range as one long hall two storeys high — the Greek and Roman sculpture gallery west of
//           the great door, the information desk east of it, one high window a bay on to the forecourt — Egypt (the
//           mummy case, the Shrine of Taharqa) beyond its west end; behind, the 2009 atrium and its stair
//           (_mus_ash_atrium.js) with Ancient Greece and the casts to the west and the east gallery;
//   first (Mather's building only): Islamic Middle East, India; a balcony looks down into the hall;
//   second: England 400–1600 with the Alfred Jewel and Music and Tapestry with the violin west of the atrium, Western
//           art over the hall and to the east;   the roof: the restaurant, glass to the east and south.
// Walls are drawn per floor and collide only on their floor (Floors), in two colliders: the ground floor's (the front
// doorway is a way through it) and the upper floors'.
import * as THREE from 'three';
import { Geo, museumMats, buildGeo, displayCase, statue, plaque, Labels, labelMaterial, CELL, cellUV } from './_mus_kit.js';
import { canvas, canvasTexture } from './_randolph_kit.js';
import { buildAtrium, ATRIUM } from './_mus_ash_atrium.js';
import { Floors, srng } from './_mus_logic.js';
import { lathe, ball, tube, loft, mottle } from './_mus_fine.js';
import { ASH_PLAN as PL, ASH_WINDOWS, ASH_ROOF_GLASS } from './_mus_ash_plan.js';
import { glazing, reveal, cityDoorMats } from './_walkin_city.js';

export const ASH_IN = {
  spawn: [0, PL.ZF - 4.6], exit: [0, PL.ZF - 0.9], desk: [9, -10.6], donate: [-3.4, PL.ZF - 1.0],
  jewel: [-19, -21], violin: [-19, -40], mummy: [-24, -11], shrine: [-33.4, -8.6], teacher: [-29.2, -7.2], casts: [-19.5, -37.7],
  jewelFloor: 2, violinFloor: 2,
  coffee: [8.8, -37.5], tables: [[14.2, -45.6], [14.2, -42.2], [14.2, -38.8], [14.2, -35.4], [14.2, -32], [11.4, -30.4]],
};
const PLASTER = 0xf2efe6, GOLD = 0xc8a248, HALL = 0xe2d6bd;

/**
 * Sixteen INVENTED paintings (no copies of real works), 512 px each: landscapes with weather, half-length portraits
 * of nobody (a turned head, a collar, a hand; no likeness), still lifes on a table edge, sea pieces, and a few
 * twentieth-century abstractions. Old varnish darkens the corners.
 */
function paintingsCanvas() {
  const N = 4, P = 256, SC = 2, { canvas: c, g } = canvas(N * P * SC, N * P * SC), r = srng(77);
  g.scale(SC, SC);
  const hsl = (h, s, l, a = 1) => 'hsla(' + ((h % 360) + 360) % 360 + ',' + s + '%,' + l + '%,' + a + ')';
  const blob = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill(); };
  const kinds = [0, 1, 2, 0, 1, 3, 4, 1, 0, 2, 1, 4, 3, 1, 0, 5];
  for (let i = 0; i < N * N; i++) {
    const x0 = (i % N) * P, y0 = Math.floor(i / N) * P, kind = kinds[i], hue = r() * 360;
    g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, P, P); g.clip();
    if (kind === 0) {            // landscape: sky and cloud, far hills, a stand of trees, water or a road, a little figure
      const dusk = r() < 0.4, hz = P * (0.42 + r() * 0.2), sk = g.createLinearGradient(0, 0, 0, hz);
      sk.addColorStop(0, dusk ? hsl(215, 30, 42) : hsl(208, 42, 62)); sk.addColorStop(1, dusk ? hsl(32, 70, 72) : hsl(45, 45, 86)); g.fillStyle = sk; g.fillRect(0, 0, P, hz);
      for (let k = 0; k < 9; k++) blob(r() * P, r() * hz * 0.8, 20 + r() * 40, 6 + r() * 12, dusk ? 'rgba(255,200,160,0.35)' : 'rgba(255,255,255,0.5)');
      for (let k = 0; k < 3; k++) { g.fillStyle = hsl(205 - k * 40, 22, 62 - k * 12); g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= P; x += 12) g.lineTo(x, hz - 8 - (3 - k) * 5 * (1 + Math.sin(x * 0.025 + k * 2 + hue))); g.lineTo(P, hz + 20); g.lineTo(0, hz + 20); g.fill(); }
      const gd = g.createLinearGradient(0, hz, 0, P); gd.addColorStop(0, hsl(85, 28, 44)); gd.addColorStop(1, hsl(60, 32, 24)); g.fillStyle = gd; g.fillRect(0, hz + 6, P, P);
      g.fillStyle = dusk ? hsl(35, 55, 66, 0.8) : hsl(205, 35, 72, 0.85); g.beginPath(); g.moveTo(P * 0.5, hz + 8); g.bezierCurveTo(P * 0.3, hz + 40, P * 0.9, hz + 60, P * 0.4, P); g.lineTo(P * 0.75, P); g.bezierCurveTo(P * 1.0, hz + 60, P * 0.42, hz + 40, P * 0.56, hz + 8); g.fill();
      const side = r() < 0.5 ? 0 : 1;
      for (let k = 0; k < 7; k++) { const tx = side ? P - 20 - r() * 70 : 20 + r() * 70, ty = hz + 26 + r() * 30, th = 60 + r() * 50; g.fillStyle = '#2a1e12'; g.fillRect(tx - 2, ty - th * 0.5, 4, th * 0.5); for (let q = 0; q < 7; q++) blob(tx + (r() - 0.5) * 34, ty - th * 0.5 - r() * th * 0.55, 12 + r() * 12, 9 + r() * 9, hsl(95 + r() * 30, 30, 16 + r() * 16)); }
      g.fillStyle = '#7a2a1e'; g.fillRect(P * 0.6, P * 0.8, 3, 8); blob(P * 0.6 + 1.5, P * 0.79, 2, 2, '#d8b090');
    } else if (kind === 1) {     // portrait of nobody: dark ground, the sitter turned three-quarters, a collar, a hand
      const bg = g.createRadialGradient(P * 0.4, P * 0.35, 10, P / 2, P / 2, P * 0.8); bg.addColorStop(0, hsl(30 + r() * 20, 25, 30)); bg.addColorStop(1, hsl(25, 30, 8)); g.fillStyle = bg; g.fillRect(0, 0, P, P);
      const cx = P * (0.46 + r() * 0.1), dress = hsl(hue, 30 + r() * 30, 14 + r() * 22), skin = hsl(24 + r() * 10, 38, 62 + r() * 10), lady = r() < 0.5;
      g.fillStyle = dress; g.beginPath(); g.moveTo(cx - 92, P); g.quadraticCurveTo(cx - 80, P * 0.56, cx - 22, P * 0.5); g.lineTo(cx + 26, P * 0.5); g.quadraticCurveTo(cx + 86, P * 0.56, cx + 96, P); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(cx - 60, P); g.quadraticCurveTo(cx - 50, P * 0.62, cx - 16, P * 0.54); g.lineTo(cx - 6, P); g.fill();
      if (lady) { g.fillStyle = skin; g.beginPath(); g.moveTo(cx - 30, P * 0.56); g.quadraticCurveTo(cx, P * 0.7, cx + 32, P * 0.56); g.lineTo(cx + 12, P * 0.48); g.lineTo(cx - 12, P * 0.48); g.fill(); g.strokeStyle = '#e8e2d0'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 32, P * 0.57); g.quadraticCurveTo(cx, P * 0.72, cx + 34, P * 0.57); g.stroke(); }
      else { g.fillStyle = '#ece6d8'; g.beginPath(); g.moveTo(cx - 22, P * 0.5); g.lineTo(cx + 2, P * 0.62); g.lineTo(cx + 26, P * 0.5); g.lineTo(cx + 12, P * 0.46); g.lineTo(cx - 10, P * 0.46); g.fill(); }
      g.fillStyle = skin; g.fillRect(cx - 8, P * 0.4, 18, P * 0.09);
      blob(cx + 2, P * 0.31, 25, 32, skin, 0.08); blob(cx + 12, P * 0.33, 14, 26, 'rgba(60,30,15,0.28)', 0.1);       // the shadowed side of the face: no features
      const hair = hsl(20 + r() * 25, 30, r() < 0.3 ? 70 : 10 + r() * 20);
      g.fillStyle = hair; g.beginPath(); g.ellipse(cx + 3, P * 0.25, 29, 24, 0, Math.PI * 0.95, Math.PI * 2.05); g.fill(); blob(cx - 22, P * 0.31, 9, 22 + (lady ? 14 : 0), hair); blob(cx + 27, P * 0.31, 8, 20 + (lady ? 16 : 0), hair);
      blob(cx - 44, P * 0.86, 13, 9, skin, 0.5);
    } else if (kind === 2) {     // still life: a table edge, a cloth, fruit, a jug and a glass, the light from the left
      g.fillStyle = hsl(hue, 16, 10); g.fillRect(0, 0, P, P); const ty = P * 0.68;
      g.fillStyle = hsl(28, 35, 20); g.fillRect(0, ty, P, P - ty); g.fillStyle = hsl(28, 40, 30); g.fillRect(0, ty, P, 5);
      g.fillStyle = hsl(45, 20, 78); g.beginPath(); g.moveTo(P * 0.5, ty); g.lineTo(P, ty - 4); g.lineTo(P, P); g.lineTo(P * 0.64, P); g.quadraticCurveTo(P * 0.62, ty + 30, P * 0.5, ty); g.fill();
      const jx = 60 + r() * 30; g.fillStyle = hsl(205, 20, 34); g.beginPath(); g.moveTo(jx - 16, ty); g.quadraticCurveTo(jx - 34, ty - 50, jx - 10, ty - 84); g.lineTo(jx + 12, ty - 84); g.quadraticCurveTo(jx + 34, ty - 50, jx + 16, ty); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(jx - 14, ty - 70, 4, 44);
      for (let k = 0; k < 7; k++) { const fx = 110 + r() * 110, fr = 9 + r() * 9, fc = hsl([8, 28, 46, 80, 350][Math.floor(r() * 5)], 60, 40 + r() * 14); blob(fx, ty - fr + 2, fr, fr * 0.92, fc); blob(fx - fr * 0.35, ty - fr * 1.3 + 2, fr * 0.28, fr * 0.2, 'rgba(255,255,230,0.5)'); }
      g.strokeStyle = 'rgba(220,235,235,0.5)'; g.lineWidth = 1.5; g.strokeRect(P * 0.8, ty - 46, 16, 46); g.fillStyle = 'rgba(120,30,30,0.6)'; g.fillRect(P * 0.8 + 1, ty - 24, 14, 23);
    } else if (kind === 3) {     // sea piece: a low horizon, a big sky, a ship under sail, a swell
      const hz = P * 0.62, sk = g.createLinearGradient(0, 0, 0, hz); sk.addColorStop(0, hsl(212, 30, 50)); sk.addColorStop(1, hsl(40, 40, 84)); g.fillStyle = sk; g.fillRect(0, 0, P, hz);
      for (let k = 0; k < 12; k++) blob(r() * P, r() * hz * 0.85, 24 + r() * 40, 8 + r() * 14, 'rgba(255,255,255,' + (0.2 + r() * 0.35) + ')');
      const se = g.createLinearGradient(0, hz, 0, P); se.addColorStop(0, hsl(200, 30, 46)); se.addColorStop(1, hsl(205, 40, 18)); g.fillStyle = se; g.fillRect(0, hz, P, P);
      g.strokeStyle = 'rgba(235,245,245,0.4)'; g.lineWidth = 1.4; for (let k = 0; k < 26; k++) { const wx = r() * P, wy = hz + 6 + r() * (P - hz); g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 8, wy - 3, wx + 18, wy); g.stroke(); }
      const sx = P * (0.3 + r() * 0.4), sy = hz + 10; g.fillStyle = '#2a1c12'; g.beginPath(); g.moveTo(sx - 30, sy - 6); g.lineTo(sx + 34, sy - 6); g.lineTo(sx + 24, sy + 4); g.lineTo(sx - 24, sy + 4); g.fill();
      for (const [mx, mh] of [[-14, 50], [4, 62], [20, 44]]) { g.fillStyle = '#2a1c12'; g.fillRect(sx + mx, sy - 6 - mh, 2, mh); g.fillStyle = hsl(42, 30, 84); g.beginPath(); g.moveTo(sx + mx + 2, sy - 8 - mh); g.quadraticCurveTo(sx + mx + 22, sy - 8 - mh * 0.5, sx + mx + 2, sy - 12); g.fill(); }
    } else if (kind === 4) {     // an abstraction: blocks, bars and a wandering line
      g.fillStyle = hsl(hue, 30, 88); g.fillRect(0, 0, P, P);
      for (let k = 0; k < 7; k++) { g.fillStyle = hsl(hue + [0, 150, 200, 40][k % 4] + r() * 20, 55 + r() * 30, 30 + r() * 40, 0.9); const w = 30 + r() * 110, h = 20 + r() * 100; g.save(); g.translate(20 + r() * 200, 20 + r() * 200); g.rotate((r() - 0.5) * 0.5); g.fillRect(-w / 2, -h / 2, w, h); g.restore(); }
      g.strokeStyle = '#161616'; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 40 + r() * 100); for (let k = 0; k < 5; k++) g.quadraticCurveTo(r() * P, r() * P, 30 + r() * 200, 30 + r() * 200); g.stroke();
      blob(60 + r() * 140, 60 + r() * 140, 16, 16, hsl(hue + 180, 80, 50));
    } else {                     // a crowded interior: a room, a window, standing figures as strokes of colour
      g.fillStyle = hsl(30, 28, 20); g.fillRect(0, 0, P, P); g.fillStyle = hsl(34, 30, 30); g.fillRect(0, P * 0.7, P, P * 0.3);
      g.fillStyle = hsl(48, 50, 80); g.fillRect(P * 0.62, P * 0.14, 50, 70); g.fillStyle = hsl(30, 28, 20); g.fillRect(P * 0.62 + 23, P * 0.14, 3, 70); g.fillRect(P * 0.62, P * 0.14 + 33, 50, 3);
      g.fillStyle = 'rgba(255,230,170,0.16)'; g.beginPath(); g.moveTo(P * 0.62, P * 0.42); g.lineTo(P * 0.2, P); g.lineTo(P * 0.7, P); g.lineTo(P * 0.82, P * 0.42); g.fill();
      for (let k = 0; k < 8; k++) { const fx = 24 + k * 28 + r() * 10, fy = P * (0.66 + r() * 0.12), fh = 54 + r() * 18; g.fillStyle = hsl(r() * 360, 30 + r() * 30, 22 + r() * 30); g.beginPath(); g.moveTo(fx - 10, fy); g.quadraticCurveTo(fx - 8, fy - fh * 0.8, fx, fy - fh * 0.82); g.quadraticCurveTo(fx + 8, fy - fh * 0.8, fx + 10, fy); g.fill(); blob(fx, fy - fh * 0.9, 5, 6, hsl(25, 35, 62)); }
    }
    // varnish, a darkening at the corners, a little crackle
    const vg = g.createRadialGradient(P / 2, P / 2, P * 0.3, P / 2, P / 2, P * 0.75); vg.addColorStop(0, 'rgba(60,40,10,0.04)'); vg.addColorStop(1, 'rgba(30,18,4,0.42)'); g.fillStyle = vg; g.fillRect(0, 0, P, P);
    if (kind !== 4) { g.strokeStyle = 'rgba(20,12,4,0.10)'; g.lineWidth = 0.4; for (let k = 0; k < 60; k++) { const qx = r() * P, qy = r() * P; g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + (r() - 0.5) * 26, qy + (r() - 0.5) * 26); g.stroke(); } }
    g.restore();
  }
  return c;
}

/**
 * The second atlas (1024 px): the shrine's sandstone with registers of INVENTED sign-like marks and big incised
 * figures; the mummy case's painted front; two tapestries; a red-figure and a black-figure pot (unrolled friezes of
 * invented figures between tongue, palmette and meander bands).
 */
const ART = { shrine: [0, 0, 512, 512], mummy: [512, 0, 256, 512], tapA: [768, 0, 256, 256], tapB: [768, 256, 256, 256], potRed: [0, 512, 512, 256], potBlack: [512, 512, 512, 256], sand: [0, 780, 500, 230] };
const artUV = (k, inset = 2) => { const [x, y, w, h] = ART[k]; return [(x + inset) / 1024, 1 - (y + h - inset) / 1024, (x + w - inset) / 1024, 1 - (y + inset) / 1024]; };
function artCanvas() {
  const { canvas: c, g } = canvas(1024, 1024), r = srng(91);
  const blob = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill(); };
  /** one invented sign: a few strokes that look like writing and mean nothing */
  const sign = (x, y, s, col) => {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, s * 0.14); const k = Math.floor(r() * 9);
    g.beginPath();
    if (k === 0) { g.arc(x, y, s * 0.36, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, s * 0.1, 0, 7); g.fill(); }
    else if (k === 1) { g.moveTo(x - s * 0.4, y); for (let i = 0; i < 4; i++) g.lineTo(x - s * 0.4 + (i + 0.5) * s * 0.2, y + (i % 2 ? s * 0.2 : -s * 0.2)); g.lineTo(x + s * 0.4, y); g.stroke(); }
    else if (k === 2) { g.moveTo(x, y + s * 0.45); g.lineTo(x, y - s * 0.3); g.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s * 0.2, y - s * 0.1); g.stroke(); }
    else if (k === 3) { g.ellipse(x, y, s * 0.42, s * 0.2, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, s * 0.09, 0, 7); g.fill(); }
    else if (k === 4) { g.fillRect(x - s * 0.36, y - s * 0.3, s * 0.72, s * 0.14); g.fillRect(x - s * 0.36, y + s * 0.16, s * 0.72, s * 0.14); }
    else if (k === 5) { g.moveTo(x - s * 0.3, y + s * 0.4); g.lineTo(x, y - s * 0.4); g.lineTo(x + s * 0.3, y + s * 0.4); g.stroke(); }
    else if (k === 6) { g.moveTo(x - s * 0.4, y + s * 0.1); g.quadraticCurveTo(x - s * 0.1, y - s * 0.6, x + s * 0.1, y); g.quadraticCurveTo(x + s * 0.3, y + s * 0.4, x + s * 0.42, y - s * 0.2); g.stroke(); g.fillRect(x - s * 0.1, y + s * 0.1, s * 0.08, s * 0.34); }
    else if (k === 7) { g.arc(x, y - s * 0.1, s * 0.3, Math.PI, 0); g.stroke(); g.fillRect(x - s * 0.04, y - s * 0.1, s * 0.08, s * 0.5); }
    else { g.fillRect(x - s * 0.3, y - s * 0.4, s * 0.12, s * 0.8); g.fillRect(x + s * 0.18, y - s * 0.4, s * 0.12, s * 0.8); g.fillRect(x - s * 0.3, y - s * 0.06, s * 0.6, s * 0.1); }
  };
  /** a standing figure in profile, in the stiff manner of temple relief (a generic outline) */
  const figure = (x, y, h, col, face = 1, crown = 0) => {
    g.fillStyle = col; const u = h / 10;
    blob(x, y - h + u * 0.9, u * 0.62, u * 0.8, col); g.fillRect(x - u * 0.9, y - h + u * 0.3, u * 1.2, u * 1.6);
    if (crown) { g.beginPath(); g.moveTo(x - u * 0.6, y - h + u * 0.3); g.lineTo(x - u * 0.3, y - h - u * 1.2); g.lineTo(x + u * 0.7, y - h - u * 0.9); g.lineTo(x + u * 0.6, y - h + u * 0.3); g.fill(); }
    g.beginPath(); g.moveTo(x - u * 1.5, y - h + u * 2); g.lineTo(x + u * 1.5, y - h + u * 2); g.lineTo(x + u * 0.7, y - h + u * 4.6); g.lineTo(x - u * 0.7, y - h + u * 4.6); g.fill();
    g.beginPath(); g.moveTo(x - u * 0.8, y - h + u * 4.5); g.lineTo(x + u * 0.8, y - h + u * 4.5); g.lineTo(x + u * 1.2, y - h + u * 6.6); g.lineTo(x - u * 1.1, y - h + u * 6.6); g.fill();
    g.fillRect(x - u * 0.9, y - h + u * 6.5, u * 0.6, u * 3.5); g.fillRect(x + u * 0.3 * face, y - h + u * 6.5, u * 0.6, u * 3.5); g.fillRect(x - u * 0.9, y - u * 0.3, u * 1.5 * 1, u * 0.3);
    g.lineWidth = u * 0.5; g.strokeStyle = col; g.beginPath(); g.moveTo(x + face * u * 1.3, y - h + u * 2.3); g.lineTo(x + face * u * 2.6, y - h + u * 3.6); g.lineTo(x + face * u * 3.6, y - h + u * 2.8); g.stroke();
    g.beginPath(); g.moveTo(x - face * u * 1.3, y - h + u * 2.3); g.lineTo(x - face * u * 1.6, y - h + u * 5.2); g.stroke();
  };
  // ---- shrine wall: sandstone blocks, a winged disc cornice band, registers of signs, two pairs of big figures
  { const [x0, y0, W, H] = ART.shrine; g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    g.fillStyle = '#c9a877'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 64) for (let x = -(y / 64 % 2) * 60; x < W; x += 120) { const d = (r() - 0.5) * 18; g.fillStyle = 'rgb(' + (201 + d) + ',' + (168 + d) + ',' + (119 + d) + ')'; g.fillRect(x + 1, y + 1, 118, 62); }
    mottle(g, 0, 0, W, H, r, 300, 0.06, 22);
    const INC = 'rgba(92,60,30,0.75)', LIT = 'rgba(255,236,196,0.5)';
    for (const y of [10, 46, 420, 468]) { for (let x = 12; x < W; x += 30) { sign(x + 1, y + 13, 22, LIT); sign(x, y + 12, 22, INC); } g.fillStyle = INC; g.fillRect(0, y - 4, W, 2); }
    for (const [fx, face, cr] of [[90, 1, 1], [200, -1, 0], [312, 1, 0], [424, -1, 1]]) { figure(fx + 2, 410, 310, LIT, face, cr); figure(fx, 408, 310, INC, face, cr); for (let k = 0; k < 6; k++) sign(fx - 44 + (k % 2) * 16, 110 + Math.floor(k / 2) * 30, 18, INC); }
    g.fillStyle = 'rgba(150,60,40,0.25)'; g.fillRect(0, 82, W, 8); g.fillStyle = 'rgba(40,90,110,0.22)'; g.fillRect(0, 410, W, 8);
    g.restore(); }
  // ---- mummy case front: wig and gilded face (featureless calm), broad collar, winged figure, columns of signs, feet
  { const [x0, y0, W, H] = ART.mummy; g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    g.fillStyle = '#d8b25a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1f3f6e'; g.fillRect(0, 0, W, 120); for (let x = 6; x < W; x += 14) { g.fillStyle = '#d8b25a'; g.fillRect(x, 0, 3, 120); }
    blob(W / 2, 66, 44, 52, '#e2bd62'); blob(W / 2 + 12, 70, 26, 44, 'rgba(120,80,20,0.22)');
    g.fillStyle = '#1b1b22'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(W / 2 + s * 17, 56, 10, 3.6, 0, 0, 7); g.fill(); g.fillRect(W / 2 + s * 17 - 12, 46, 24, 2.6); } g.fillRect(W / 2 - 8, 92, 16, 2.5);
    g.fillStyle = '#1f3f6e'; g.fillRect(W / 2 - 5, 112, 10, 28);
    for (let k = 0; k < 7; k++) { g.strokeStyle = ['#1f3f6e', '#a8372a', '#2f7a6a', '#e8d9a0'][k % 4]; g.lineWidth = 7; g.beginPath(); g.arc(W / 2, 96, 52 + k * 8, 0.12 * Math.PI, 0.88 * Math.PI); g.stroke(); }
    g.fillStyle = '#2f7a6a'; g.beginPath(); g.moveTo(W / 2, 208); g.quadraticCurveTo(40, 190, 8, 236); g.lineTo(W / 2, 226); g.lineTo(W - 8, 236); g.quadraticCurveTo(W - 40, 190, W / 2, 208); g.fill();
    g.strokeStyle = '#1b1b22'; g.lineWidth = 1.5; for (let k = 0; k < 12; k++) { g.beginPath(); g.moveTo(W / 2, 216); g.lineTo(14 + k * 20, 232); g.stroke(); }
    blob(W / 2, 204, 10, 10, '#a8372a');
    for (let b2 = 0; b2 < 5; b2++) { const y = 250 + b2 * 46; g.fillStyle = b2 % 2 ? '#e8d9a0' : '#f0e6c0'; g.fillRect(16, y, W - 32, 38); g.fillStyle = ['#a8372a', '#1f3f6e', '#2f7a6a'][b2 % 3]; g.fillRect(16, y + 38, W - 32, 6); for (let x = 30; x < W - 24; x += 20) sign(x, y + 19, 17, '#2a2218'); }
    g.fillStyle = '#1f3f6e'; g.fillRect(0, 484, W, 28); for (let x = 8; x < W; x += 18) { g.fillStyle = '#d8b25a'; g.fillRect(x, 488, 8, 20); }
    g.restore(); }
  // ---- tapestries: a dark flowery ground, a border, shapes of trees, beasts and standing figures (woven, coarse)
  for (const [key, ground, bord] of [['tapA', '#22384a', '#7a3a2a'], ['tapB', '#2e4630', '#8a6a3a']]) {
    const [x0, y0, W, H] = ART[key]; g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    g.fillStyle = ground; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 260; k++) { const fx = r() * W, fy = r() * H; blob(fx, fy, 2.2, 2.2, ['#d8c890', '#c86a5a', '#e8e0c0', '#7a9a6a'][Math.floor(r() * 4)]); g.fillStyle = '#4a6a44'; g.fillRect(fx - 0.5, fy + 2, 1, 4); }
    for (let k = 0; k < 4; k++) { const tx = 40 + k * 58, ty = 150 + (k % 2) * 30; g.fillStyle = '#3a2a1a'; g.fillRect(tx - 2, ty - 40, 4, 60); for (let q = 0; q < 6; q++) blob(tx + (r() - 0.5) * 30, ty - 50 - r() * 40, 13, 10, '#3f6a3c'); }
    for (let k = 0; k < 4; k++) { const fx = 54 + k * 48, fy = 222; g.fillStyle = ['#b8443a', '#d8c070', '#4a6a9a', '#c8b8a0'][k]; g.beginPath(); g.moveTo(fx - 12, fy); g.quadraticCurveTo(fx, fy - 76, fx + 12, fy); g.fill(); blob(fx, fy - 62, 6, 7, '#e0c0a0'); }
    blob(40, 200, 22, 10, '#d8d0c0'); blob(60, 192, 6, 6, '#d8d0c0');
    g.strokeStyle = bord; g.lineWidth = 22; g.strokeRect(11, 11, W - 22, H - 22); g.strokeStyle = '#d8c890'; g.lineWidth = 2; g.strokeRect(22, 22, W - 44, H - 44); g.strokeRect(3, 3, W - 6, H - 6);
    for (let x = 16; x < W; x += 16) { blob(x, 11, 4, 4, '#d8c890'); blob(x, H - 11, 4, 4, '#d8c890'); blob(11, x, 4, 4, '#d8c890'); blob(W - 11, x, 4, 4, '#d8c890'); }
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (let y = 0; y < H; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.restore();
  }
  // ---- pots, unrolled: neck tongues, shoulder palmettes, the figure frieze, a meander, rays at the foot
  for (const [key, body, fig] of [['potRed', '#15110e', '#c4622f'], ['potBlack', '#c4622f', '#15110e']]) {
    const [x0, y0, W, H] = ART[key]; g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    g.fillStyle = '#15110e'; g.fillRect(0, 0, W, H); g.fillStyle = body; g.fillRect(0, 62, W, 124);
    g.fillStyle = '#c4622f'; g.fillRect(0, 22, W, 34); for (let x = 0; x < W; x += 12) { g.fillStyle = '#15110e'; g.fillRect(x + 2, 24, 7, 30); }
    for (let k = 0; k < 8; k++) {
      const fx = 32 + k * 64, fy = 180, lean = (k % 2 ? 1 : -1) * 4; g.fillStyle = fig; g.strokeStyle = fig; g.lineWidth = 5; g.lineCap = 'round';
      blob(fx + lean, fy - 96, 8, 9, fig);
      g.beginPath(); g.moveTo(fx - 12 + lean, fy - 84); g.lineTo(fx + 12 + lean, fy - 84); g.lineTo(fx + 8, fy - 46); g.lineTo(fx - 8, fy - 46); g.fill();
      if (k % 3 === 0) { g.beginPath(); g.moveTo(fx - 9, fy - 48); g.lineTo(fx + 9, fy - 48); g.lineTo(fx + 15, fy - 4); g.lineTo(fx - 15, fy - 4); g.fill(); }      // a long robe
      else { g.beginPath(); g.moveTo(fx - 4, fy - 46); g.lineTo(fx - 14 - lean, fy - 2); g.moveTo(fx + 4, fy - 46); g.lineTo(fx + 12 - lean * 2, fy - 2); g.stroke(); }                 // striding legs
      g.beginPath(); g.moveTo(fx - 11 + lean, fy - 80); g.lineTo(fx - 26, fy - 62 - (k % 4) * 6); g.moveTo(fx + 11 + lean, fy - 80); g.lineTo(fx + 27, fy - 92 + (k % 3) * 12); g.stroke();
      if (k % 4 === 1) { g.lineWidth = 2.5; g.beginPath(); g.arc(fx + 30, fy - 96, 9, 0, 7); g.stroke(); g.beginPath(); g.moveTo(fx + 30, fy - 87); g.lineTo(fx + 30, fy - 70); g.stroke(); }      // a lyre-ish thing held up
      if (k % 4 === 3) { g.beginPath(); g.ellipse(fx - 28, fy - 56, 7, 10, 0, 0, 7); g.fill(); }                                                                                     // a jar carried
    }
    g.fillStyle = '#c4622f'; g.fillRect(0, 190, W, 20); g.strokeStyle = '#15110e'; g.lineWidth = 2.5; for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, 206); g.lineTo(x, 194); g.lineTo(x + 11, 194); g.lineTo(x + 11, 202); g.lineTo(x + 5, 202); g.stroke(); }
    for (let x = 0; x < W; x += 16) { g.fillStyle = '#c4622f'; g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 8, 216); g.lineTo(x + 16, 256); g.fill(); }
    g.restore();
  }
  { const [x0, y0, W, H] = ART.sand; g.fillStyle = '#c9a877'; g.fillRect(x0, y0 - 6, W + 12, H + 12); mottle(g, x0, y0, W, H, r, 120, 0.06, 20); }
  return c;
}

/** a wall from a to b on the floors ks, with door gaps [[s0, s1], ...] (metres along a->b) per floor: gapsFor(k) */
function wallRuns(a, b, gaps) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), runs = []; let s = 0;
  for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) { if (g0 > s) runs.push([s, g0]); s = Math.max(s, g1); }
  if (s < L) runs.push([s, L]);
  return { L, runs };
}

/** wall colour of the room at (x, z) on floor k (GUESSED schemes: pale stone for sculpture, ochre for Egypt, slate blue for
 *  the jewels, damask red for the pictures) */
function roomColour(k, x, z) {
  if (z > PL.ZH) return x < PL.FW ? 0xcdb27c : k === 2 ? 0xb84a40 : HALL;                    // Egypt; the galleries over the hall; the hall
  if (Math.abs(x) < PL.HW) return PLASTER;                                                    // the atrium is white on every floor
  if (x < 0) return k === 0 ? (z > PL.ZM ? 0x9fb0bc : 0xe2e4e4) : k === 1 ? 0x4e6e68 : z > PL.ZM ? 0x5e6e7e : 0x8a5a52;
  return k === 0 ? 0xc4bca4 : k === 1 ? 0x9a6a4a : k === 2 ? 0xb84a40 : PLASTER;
}

/**
 * ctx = the interiors build context. With ctx.seamless (the walk-in building) the front doorway and the windows are
 * left open in the walls (core/interiors.js shows the live world there); without it (the old door-prompt path) they
 * are closed with a painted leaf and a pale sky.
 */
// (a generator: core/interiors.js builds a room a piece a frame, left at each `yield`)
export function* buildAshInterior(ctx, game) {
  const sc = ctx.scene, I = ASH_IN, SL = ctx.seamless || null;
  const { ZF, ZH, ZM, ZN, WX, EX, FW, FE, EGW, RZ, CEIL } = PL, D = PL.DOOR;
  const at = buildAtrium({ scene: sc });
  yield;
  const A = ATRIUM, lv = A.levels, HW = A.HW;
  const floors = new Floors(lv.slice());
  for (const f of A.flights) floors.ramp({ b: f.b, x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, axis: 'z', lo: f.lo });
  ctx.setGround((x, z) => floors.ground(x, z));
  // Two colliders (docs/ARCHITECTURE.md "Storeys"): the ground floor's, which the front doorway is a way through, and
  // the upper floors' (so nobody upstairs walks out through the wall over the door). Within each, walls belong to
  // their floors (Floors.walls).
  const colG = ctx.collider, colU = ctx.newCollider ? ctx.newCollider() : colG, two = colU !== colG;
  if (two) { ctx.setCollider(() => (floors.cur === 0 ? colG : colU)); if (ctx.portalColliders) ctx.portalColliders(0, [colG]); }
  /** shapes on the floors ks: fn(collider) adds one and returns it */
  const Wl = (ks, fn) => {
    if (!two) { floors.walls(ks, fn(colG)); return; }
    if (ks.includes(0)) floors.walls([0], fn(colG));
    const up = ks.filter((k) => k > 0); if (up.length) floors.walls(up, fn(colU));
  };
  const seg = (ks, x0, z0, x1, z1) => Wl(ks, (c) => c.addSegment(x0, z0, x1, z1));
  const boxC = (ks, x, z, w, d, rot = 0) => Wl(ks, (c) => c.addBox(x, z, w, d, rot));
  const circ = (ks, x, z, r) => Wl(ks, (c) => c.addCircle(x, z, r));
  const G = new Geo(), Lb = new Labels(48);
  const touch = [];
  const MM = museumMats();
  const pmat = new THREE.MeshStandardMaterial({ map: canvasTexture(paintingsCanvas), roughness: 0.55, envMap: MM.env, envMapIntensity: 0.12, name: 'mus-ash-paintings' });
  const amat = new THREE.MeshStandardMaterial({ map: canvasTexture(artCanvas), roughness: 0.6, envMap: MM.env, envMapIntensity: 0.1, name: 'mus-ash-art' });
  const gilt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.85, envMap: MM.env, envMapIntensity: 1.1, name: 'mus-ash-gilt' });
  // the Ashmolean's own glows (the museums' shared one never changes): lit ceiling panels, and laylights under the sky
  const glowLit = new THREE.MeshBasicMaterial({ vertexColors: true, name: 'mus-ash-glow', toneMapped: false });
  const glowDay = new THREE.MeshBasicMaterial({ vertexColors: true, name: 'mus-ash-daylight', toneMapped: false });
  pmat.map.anisotropy = 8; amat.map.anisotropy = 8;
  const Hk = (k) => (k === 3 ? PL.ROOF - lv[3] : lv[k + 1] - lv[k]);      // (a wall stops at the floor above: nothing of the second floor stands up into the restaurant)

  yield;
  // ---------------------------------------------------------------- walls (drawn + collided per floor)
  // [a, b, {floor: gaps}] ; floors absent from the map have no wall
  const hg = A.hallGap, sE = (x) => x - EGW, sW = (x) => x - WX;
  const walls = [
    // Mather's building: north, east and west walls
    [[WX, ZN], [EX, ZN], { 0: [], 1: [], 2: [] }],
    [[EX, ZN], [EX, ZH], { 0: [], 1: [], 2: [] }],
    [[WX, ZH], [WX, ZN], { 0: [], 1: [], 2: [] }],
    // the back wall of Cockerell's range: (ground) Egypt … the hall, with the doors to the west and east galleries and
    // the wide opening to the atrium; (1) a balcony over the hall where that opening is; (2) the galleries over the hall
    [[EGW, ZH], [FE, ZH], { 0: [[sE(-16), sE(-12)], [sE(hg[0]), sE(hg[1])], [sE(10), sE(14)]] }],
    [[WX, ZH], [FE, ZH], { 1: [[sW(hg[0]), sW(hg[1])]], 2: [[sW(-16), sW(-12)], [sW(hg[0]), sW(hg[1])], [sW(10), sW(14)]] }],
    // Egypt
    [[EGW, ZF], [EGW, ZH], { 0: [] }], [[FW, ZF], [EGW, ZF], { 0: [] }],
    // the ends of the hall (the door to Egypt at its west end) and of the galleries over it; the front wall upstairs
    [[FW, ZH], [FW, ZF], { 0: [[2.2, 6.2]], 1: [], 2: [] }],
    [[FE, ZF], [FE, ZH], { 0: [], 1: [], 2: [] }],
    [[FE, ZF], [FW, ZF], { 2: [] }],
    // the well's side walls
    [[-HW, ZN], [-HW, ZH], { 0: A.doors[0], 1: A.doors[1], 2: A.doors[2], 3: [] }],
    [[HW, ZN], [HW, ZH], { 0: A.doors[0], 1: A.doors[1], 2: A.doors[2], 3: A.doors3E }],
    // between the two west ground-floor galleries
    [[WX, ZM], [-HW, ZM], { 0: [[9, 13]] }],
    // the roof: the lantern's ends, the restaurant's north wall
    [[-HW, ZN], [EX, ZN], { 3: [] }], [[-HW, ZH], [HW, ZH], { 3: [] }],
  ];
  for (const [a, b, per] of walls) {
    const nx = -(b[1] - a[1]), nz = b[0] - a[0], nl = Math.hypot(nx, nz), ux = (b[0] - a[0]), uz = (b[1] - a[1]);
    for (const k of Object.keys(per).map(Number)) {
      const y0 = lv[k], y1 = y0 + Hk(k), { L, runs } = wallRuns(a, b, per[k]);
      const P = (s, y) => [a[0] + (ux * s) / L, y, a[1] + (uz * s) / L];
      for (const [s0, s1] of runs) {
        for (const sg of [1, -1]) { const m = P((s0 + s1) / 2, 0); G.color(roomColour(k, m[0] + (sg * nx / nl) * 0.6, m[2] + (sg * nz / nl) * 0.6)); G.poly('paint', [P(s0, y0), P(s1, y0), P(s1, y1), P(s0, y1)], [(sg * nx) / nl, 0, (sg * nz) / nl]); }
        G.color(0x8a8070); for (const sg of [1, -1]) G.poly('paint', [P(s0, y0), P(s1, y0), P(s1, y0 + 0.15), P(s0, y0 + 0.15)].map((p) => [p[0] + (sg * nx / nl) * 0.01, p[1], p[2] + (sg * nz / nl) * 0.01]), [(sg * nx) / nl, 0, (sg * nz) / nl]);
        if (k < 3) for (const sg of [1, -1]) {
          const off = (p, o) => [p[0] + (sg * nx / nl) * o, p[1], p[2] + (sg * nz / nl) * o], nn = [(sg * nx) / nl, 0, (sg * nz) / nl], yc = y1;
          G.color(0xfaf8f2); G.poly('paint', [P(s0, yc - 0.36), P(s1, yc - 0.36), P(s1, yc - 0.06), P(s0, yc - 0.06)].map((p) => off(p, 0.05)), nn);
          G.poly('paint', [off(P(s0, yc - 0.36), 0.05), off(P(s1, yc - 0.36), 0.05), off(P(s1, yc - 0.42), 0.012), off(P(s0, yc - 0.42), 0.012)], [nn[0], -1, nn[2]]);
          G.color(0x6e6858); G.poly('paint', [P(s0, yc - 0.5), P(s1, yc - 0.5), P(s1, yc - 0.42), P(s0, yc - 0.42)].map((p) => off(p, 0.012)), nn);
        }
        const p0 = P(s0, 0), p1 = P(s1, 0); seg([k], p0[0], p0[2], p1[0], p1[2]);
      }
      for (const [g0, g1] of per[k]) for (const sg of [1, -1]) { const m = P((g0 + g1) / 2, 0); G.color(roomColour(k, m[0] + (sg * nx / nl) * 0.6, m[2] + (sg * nz / nl) * 0.6)); G.poly('paint', [P(g0, y0 + D), P(g1, y0 + D), P(g1, y1), P(g0, y1)], [(sg * nx) / nl, 0, (sg * nz) / nl]); }
    }
  }
  // the balcony on the first floor that looks down into the hall: a glass balustrade across the opening
  seg([1], hg[0], ZH, hg[1], ZH);
  G.color(0xffffff); G.poly('glass', [[hg[0], lv[1], ZH], [hg[1], lv[1], ZH], [hg[1], lv[1] + 1.05, ZH], [hg[0], lv[1] + 1.05, ZH]], [0, 0, 1]);
  G.color(0x9aa0a4); G.beam('iron', [hg[0], lv[1] + 1.08, ZH], [hg[1], lv[1] + 1.08, ZH], 0.06);

  yield;
  // ---------------------------------------------------------------- Cockerell's front wall: the doorway and one high window a bay
  const dr = PL.door, yHall = lv[2] - 0.35;
  {
    const holes = [{ x0: -dr.w / 2, x1: dr.w / 2, y0: 0, y1: dr.h }, ...ASH_WINDOWS.map((w) => ({ x0: w.x - PL.winW / 2, x1: w.x + PL.winW / 2, y0: PL.winY0, y1: PL.winY1 }))].sort((p, q) => p.x0 - q.x0);
    const wq = (x0, x1, y0, y1, o = 0) => { if (x1 - x0 > 1e-3 && y1 - y0 > 1e-3) G.poly('paint', [[x0, y0, ZF - o], [x1, y0, ZF - o], [x1, y1, ZF - o], [x0, y1, ZF - o]], [0, 0, -1]); };
    let x = FW;
    G.color(HALL);
    for (const h of holes) { wq(x, h.x0, 0, yHall); wq(h.x0, h.x1, 0, h.y0); wq(h.x0, h.x1, h.y1, yHall); x = h.x1; }
    wq(x, FE, 0, yHall);
    G.color(0x8a8070); x = FW; for (const h of holes) { if (h.y0 > 0) continue; wq(x, h.x0, 0, 0.15, 0.01); x = h.x1; } wq(x, FE, 0, 0.15, 0.01);
    // a stone band under the windows (their sills run into it) and the cornice under the ceiling
    G.color(0xd8d0bc); G.box('paint', FW, PL.winY0 - 0.22, ZF - 0.07, -dr.w / 2 - 0.3, PL.winY0 - 0.04, ZF, { bottom: true }); G.box('paint', dr.w / 2 + 0.3, PL.winY0 - 0.22, ZF - 0.07, FE, PL.winY0 - 0.04, ZF, { bottom: true });
    seg([0], FW, ZF, FE, ZF);                                   // (the doorway's passage opens it: core/interiors.js)
    if (!SL) {
      // the old path: a shut leaf in the doorway and pale sky in the windows
      G.color(0x2a2018); wq(-dr.w / 2, dr.w / 2, 0, dr.h, -0.03);
      for (const h of holes) if (h.y0 > 0) { G.color(0xbfe0f0); G.poly('glow', [[h.x0, h.y0, ZF + 0.05], [h.x1, h.y0, ZF + 0.05], [h.x1, h.y1, ZF + 0.05], [h.x0, h.y1, ZF + 0.05]], [0, 0, -1]); }
    }
  }
  // the hall: cornice round the top, ceiling beams on the bay lines, a door-case to the atrium
  {
    G.color(0xfaf8f2);
    for (const [x0, z0, x1, z1] of [[FW, ZF - 0.12, FE, ZF], [FW, ZH, FE, ZH + 0.12], [FW, ZH, FW + 0.12, ZF], [FE - 0.12, ZH, FE, ZF]]) G.box('paint', x0, yHall - 0.34, z0, x1, yHall, z1, { bottom: true, top: false });
    G.color(0xf0ece2);
    for (const s of [-1, 1]) for (const x of [3.6, 6.81, 6.81 + PL.bay, 6.81 + 2 * PL.bay, 6.81 + 3 * PL.bay]) G.box('paint', s * x - 0.22, yHall - 0.3, ZH, s * x + 0.22, yHall, ZF, { bottom: true, top: false });
    // the opening to the atrium: stone piers and a lintel
    G.color(0xe6dfce);
    for (const s of [-1, 1]) G.box('paint', s * hg[1] - (s > 0 ? 0 : 0.5), 0, ZH, s * hg[1] + (s > 0 ? 0.5 : 0), D + 0.25, ZH + 0.16);
    G.box('paint', hg[0] - 0.5, D, ZH, hg[1] + 0.5, D + 0.45, ZH + 0.2, { bottom: true });
  }
  // the glazed draught lobby inside the great door (the automatic doors are in its inner face: cityDoor in ashmolean.js)
  const LOB = { x: 2.5, z: ZF - 2.4, h: 2.9, doorW: 2.4, doorH: dr.leaf };
  {
    const { x: lx, z: lz, h: lh } = LOB, dw = LOB.doorW / 2;
    G.color(0xffffff);
    for (const s of [-1, 1]) { G.poly('glass', [[s * lx, 0, ZF], [s * lx, 0, lz], [s * lx, lh, lz], [s * lx, lh, ZF]], [s, 0, 0]); G.poly('glass', [[s * dw, 0, lz], [s * lx, 0, lz], [s * lx, lh, lz], [s * dw, lh, lz]], [0, 0, -1]); }
    G.poly('glass', [[-lx, lh, lz], [lx, lh, lz], [lx, lh, ZF], [-lx, lh, ZF]], [0, 1, 0]);
    G.poly('glass', [[-dw, dr.leaf, lz], [dw, dr.leaf, lz], [dw, lh, lz], [-dw, lh, lz]], [0, 0, -1]);
    G.color(0x5a5e62);
    for (const s of [-1, 1]) { G.box('iron', s * lx - 0.035, 0, lz - 0.035, s * lx + 0.035, lh, lz + 0.035); G.box('iron', s * dw - 0.03, 0, lz - 0.03, s * dw + 0.03, lh, lz + 0.03); G.box('iron', s * lx - 0.03, lh - 0.05, lz, s * lx + 0.03, lh + 0.02, ZF, { bottom: true }); }
    G.box('iron', -lx, lh - 0.05, lz - 0.035, lx, lh + 0.02, lz + 0.035, { bottom: true }); G.box('iron', -dw, dr.leaf, lz - 0.03, dw, dr.leaf + 0.07, lz + 0.03, { bottom: true });
    G.color(0x3a3c3a); G.poly('paint', [[-1.6, 0.012, ZF - 0.2], [1.6, 0.012, ZF - 0.2], [1.6, 0.012, lz + 0.3], [-1.6, 0.012, lz + 0.3]], [0, 1, 0]);      // the mat
    for (const s of [-1, 1]) { seg([0], s * lx, ZF, s * lx, lz); seg([0], s * dw, lz, s * lx, lz); }
  }

  // floors (slabs) and ceilings
  yield;
  const slab = (x0, x1, z0, z1, y, mat = 'floorPale', under = true) => {
    G.color(0xffffff); G.poly(mat, [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0]);
    if (under) { G.color(PLASTER); G.poly('paint', [[x0, y - 0.35, z0], [x1, y - 0.35, z0], [x1, y - 0.35, z1], [x0, y - 0.35, z1]], [0, -1, 0]); }
  };
  const ceil = (x0, x1, z0, z1, y) => { G.color(PLASTER); G.poly('paint', [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, -1, 0]); };
  slab(EGW, FE, ZH, ZF, 0, 'floorPale', false); slab(WX, EX, ZN, ZH, 0, 'floorPale', false);
  ceil(EGW, FW, ZH, ZF, CEIL);
  for (const k of [1, 2]) { slab(WX, -HW, ZN, ZH, lv[k], 'floorDark'); slab(HW, EX, ZN, ZH, lv[k], 'floorDark'); }
  slab(FW, FE, ZH, ZF, lv[2], 'floorDark');
  // (over the second floor the roof: ceilings only — nothing of the room is seen from the restaurant's windows)
  ceil(WX, -HW, ZN, ZH, lv[3] - 0.35); ceil(HW, EX, RZ, ZH, lv[3] - 0.35); ceil(FW, FE, ZH, ZF, lv[3] - 0.35);
  slab(HW, EX, ZN, RZ, lv[3], 'floorDark'); ceil(HW, EX, ZN, RZ, lv[3] + 3.3);
  // top light: glazed laylights in the gallery ceilings (daylight on the top floor, lit panels below), in white frames
  const lay = (xm, zc, hw2, hd, y, day = false, nx = 4) => {
    G.color(day ? 0xf6fbff : 0xfff3dc); G.poly(day ? 'glowDay' : 'glowLit', [[xm - hw2, y, zc - hd], [xm + hw2, y, zc - hd], [xm + hw2, y, zc + hd], [xm - hw2, y, zc + hd]], [0, -1, 0]);
    G.color(0xe6e2d8);
    for (let i = 0; i <= nx; i++) { const x = xm - hw2 + (i / nx) * hw2 * 2; G.box('paint', x - 0.05, y - 0.12, zc - hd, x + 0.05, y + 0.01, zc + hd, { bottom: true, top: false }); }
    for (const z of [zc - hd, zc, zc + hd]) G.box('paint', xm - hw2, y - 0.12, z - 0.05, xm + hw2, y + 0.01, z + 0.05, { bottom: true, top: false });
  };
  for (const k of [0, 1, 2]) {
    const y = lv[k + 1] - 0.37, top = k === 2;
    for (const zc of k === 0 ? [-45.5, -37.5, -25.6, -17.4] : [-45, -36, -27, -18]) lay(-19, zc, 4.2, k === 0 ? 2.1 : 2.8, y, top);
    for (const zc of [-45, -37, -29, -21]) lay(12, zc, 2.5, 2.4, y, top && zc > RZ, 2);
  }
  lay((EGW + FW) / 2, (ZH + ZF) / 2, 5, 2.2, CEIL - 0.02);
  for (const x of [-17.6, -8.8, 0, 8.8, 17.6]) { lay(x, (ZH + ZF) / 2, 2.6, 2.2, yHall - 0.02, false, 2); lay(x, (ZH + ZF) / 2, 2.6, 2.2, lv[3] - 0.37, true, 2); }
  // the restaurant: glass to the east and the south (real openings when walk-in), a solid band over them
  {
    const y0 = lv[3], yg = y0 + 2.9, yc = y0 + 3.3, [ge, gs] = ASH_ROOF_GLASS, e0 = ge.at[1] - ge.w / 2, e1 = ge.at[1] + ge.w / 2, s0 = gs.at[0] - gs.w / 2, s1 = gs.at[0] + gs.w / 2;
    G.color(PLASTER);
    const wx = (z0, z1, ya, yb) => G.poly('paint', [[EX, ya, z0], [EX, ya, z1], [EX, yb, z1], [EX, yb, z0]], [-1, 0, 0]);
    const wz = (x0, x1, ya, yb) => G.poly('paint', [[x0, ya, RZ], [x1, ya, RZ], [x1, yb, RZ], [x0, yb, RZ]], [0, 0, -1]);
    wx(ZN, e0, y0, yc); wx(e1, RZ, y0, yc); wx(e0, e1, yg, yc); wz(HW, s0, y0, yc); wz(s1, EX, y0, yc); wz(s0, s1, yg, yc);
    seg([3], EX, ZN, EX, RZ); seg([3], HW, RZ, EX, RZ);
    if (!SL) { G.color(0xbfe0f0); G.poly('glow', [[EX + 0.05, y0, e0], [EX + 0.05, y0, e1], [EX + 0.05, yg, e1], [EX + 0.05, yg, e0]], [-1, 0, 0]); G.poly('glow', [[s0, y0, RZ + 0.05], [s1, y0, RZ + 0.05], [s1, yg, RZ + 0.05], [s0, yg, RZ + 0.05]], [0, 0, -1]); }
  }

  yield;
  // ---------------------------------------------------------------- atrium colliders (landings' edges, flights)
  const F = A.flights, fz0 = F[0].z0, fz1 = F[0].z1;
  for (const x of [F[0].x0, F[0].x1]) seg([0, 1, 2, 3], x, fz0, x, fz1);
  for (const x of [F[1].x0, F[1].x1]) seg([1, 2], x, fz0, x, fz1);
  seg([0], F[0].x0, fz0, F[0].x1, fz0);
  const line = (z, xs, ks) => { for (let i = 0; i < xs.length; i += 2) seg(ks, xs[i], z, xs[i + 1], z); };
  line(fz0, [-HW, -6, -2.5, 2.5, 6, HW], [1]);
  line(fz1, [-HW, HW], [1]);
  line(fz1, [-HW, -6, -2.5, 2.5, 6, HW], [2]);
  line(fz0, [-HW, HW], [2]);
  line(fz0, [-HW, -6, -2.5, HW], [3]);

  yield;
  // ---------------------------------------------------------------- the galleries
  const caseAt = (x, z, rot, o, k = 0, name = 'case') => {
    const f = displayCase(G, x, z, rot, { wood: 0xd8d4cc, frameCol: 0x9a9a98, ...o, y: lv[k] });
    boxC([k], x, z, f[2] + 0.1, f[3] + 0.1, rot);
    touch.push({ x, z, w: f[2], d: f[3], rot, floor: k, name });
  };
  const statueAt = (x, z, rot, o = {}, k = 0, name = 'statue') => {
    statue(G, x, z, rot, { col: o.col || 0xf2efe6, plinthCol: o.plinth || 0xd8d2c4, h: o.h || 1.8, plinth: o.p || 0.9, seated: o.seated, y: lv[k], robe: o.robe !== false });
    boxC([k], x, z, 0.95, 0.95, rot); touch.push({ x, z, w: 0.9, d: 0.9, rot, floor: k, name });
  };
  yield;
  // ground floor — the Greek and Roman sculpture gallery (the west half of the hall: marbles down both sides), the cast gallery
  let n = 0;
  for (const x of [-19.6, -16.1, -12.4, -8.7]) statueAt(x, ZF - 1.5, Math.PI + (n++ % 2 ? 0.3 : -0.3), { h: 1.75, seated: n % 4 === 0 }, 0, 'a marble');
  for (const x of [-19.4, -10.2, -6.2]) statueAt(x, ZH + 1.3, (n++ % 2 ? 0.35 : -0.35), { h: 1.75, seated: n % 3 === 0 }, 0, 'a marble');
  for (const x of [-26, -19.5, -13]) for (const z of [-46, -40.5, -35]) statueAt(x, z, ((n++ * 1.7) % 6.28), { col: 0xfbfaf6, plinth: 0xe8e4dc, h: 2.3, p: 1.1, robe: n % 3 !== 0 }, 0, 'a plaster cast');
  // two tall casts on dark plinths on the floor of the atrium, between the flights (as a 2009 photograph shows it)
  statueAt(0, -29.2, 0, { col: 0xfbfaf6, plinth: 0x2c3036, h: 2.5, p: 1.7, robe: false }, 0, 'a plaster cast');
  statueAt(0.6, -35.2, 0.5, { col: 0xfbfaf6, plinth: 0x2c3036, h: 2.2, p: 1.3, robe: false }, 0, 'a plaster cast');
  yield;
  // Egypt: the mummy case standing in a tall glass case, the Shrine of Taharqa, small finds
  {
    const [mx, mz] = I.mummy;
    caseAt(mx, mz, 0, { w: 1.4, d: 1.1, h: 2.6, base: 0.3, cell: CELL.egypt, kind: 'table', wood: 0x3a3430 }, 0, 'the mummy case');
    // the mummy case: an anthropoid coffin, painted and gilded (wig, calm gold face, broad collar, bands of signs)
    { const uv = artUV('mummy'), Hm = 2.08;
      G.color(0xffffff);
      lathe(G, 'art', mx, 0.32, mz, [[0.2, 0], [0.25, 0.1], [0.24, 0.55], [0.29, 1.0], [0.37, 1.4], [0.35, 1.56], [0.24, 1.68], [0.27, 1.82], [0.25, 1.96], [0.12, Hm]], 14, { sz: 0.6, u0: uv[0], u1: uv[2], mirrorU: true, vmap: [uv[1], (uv[3] - uv[1]) / Hm], capTop: true, uv: [uv[0], uv[3]] });
      lathe(G, 'art', mx, 0.32, mz + 0.14, [[0.16, 0], [0.19, 0.12], [0.02, 0.2]], 8, { sz: 0.7, uv: [uv[0] + 0.02, uv[1] + 0.01] });     // the feet
    }
    const [sx, sz] = I.shrine, sw = 3.6, sd = 2.6, sh = 3.1, SAND = 0xc8a878;
    G.at(sx, 0, sz, Math.PI / 2);                                 // its doorway faces east, to the way in from the sculpture gallery
    G.color(SAND);
    G.box('stone', -sw / 2, 0, -sd / 2, -0.7, sh, sd / 2); G.box('stone', 0.7, 0, -sd / 2, sw / 2, sh, sd / 2);
    G.box('stone', -0.7, 0, -sd / 2, 0.7, sh, -sd / 2 + 0.3); G.box('stone', -0.7, 2.3, -sd / 2, 0.7, sh, sd / 2);
    // every outer face cut with registers of signs and tall figures (the art atlas), a torus roll and a cavetto cornice
    { const uv = artUV('shrine'), du = uv[2] - uv[0], o = 0.012;
      G.color(0xffffff);
      const fr = (x0, x1) => G.quadUV('art', [x0, 0, sd / 2 + o], [x1, 0, sd / 2 + o], [x1, sh, sd / 2 + o], [x0, sh, sd / 2 + o], [uv[0] + du * (x0 + sw / 2) / sw, uv[1], uv[0] + du * (x1 + sw / 2) / sw, uv[3]]);
      fr(-sw / 2, -0.7); fr(0.7, sw / 2);
      G.quadUV('art', [sw / 2, 0, -sd / 2 - o], [-sw / 2, 0, -sd / 2 - o], [-sw / 2, sh, -sd / 2 - o], [sw / 2, sh, -sd / 2 - o], uv);
      G.quadUV('art', [sw / 2 + o, 0, sd / 2], [sw / 2 + o, 0, -sd / 2], [sw / 2 + o, sh, -sd / 2], [sw / 2 + o, sh, sd / 2], [uv[0], uv[1], uv[0] + du * 0.72, uv[3]]);
      G.quadUV('art', [-sw / 2 - o, 0, -sd / 2], [-sw / 2 - o, 0, sd / 2], [-sw / 2 - o, sh, sd / 2], [-sw / 2 - o, sh, -sd / 2], [uv[2] - du * 0.72, uv[1], uv[2], uv[3]]);
    }
    G.color(0xb89868); G.box('stone', -sw / 2 - 0.06, sh, -sd / 2 - 0.06, sw / 2 + 0.06, sh + 0.1, sd / 2 + 0.06);
    [[0.04, 0.1], [0.12, 0.22], [0.24, 0.34], [0.34, 0.44]].forEach(([out, y], i, a2) => { G.color(i % 2 ? 0xc4a472 : 0xb89868); G.box('stone', -sw / 2 - out, sh + y, -sd / 2 - out, sw / 2 + out, sh + (a2[i + 1] ? a2[i + 1][1] : 0.52), sd / 2 + out); });
    G.color(0x8a6a40); for (const s2 of [-1, 1]) G.box('stone', s2 * 0.7 - 0.12, 0, sd / 2, s2 * 0.7 + 0.12, 2.42, sd / 2 + 0.08); G.box('stone', -0.82, 2.3, sd / 2, 0.82, 2.5, sd / 2 + 0.1);
    G.color(0x2a2016); G.poly('paint', [[-0.7, 0, sd / 2 + 0.01], [0.7, 0, sd / 2 + 0.01], [0.7, 2.3, sd / 2 + 0.01], [-0.7, 2.3, sd / 2 + 0.01]], [0, 0, 1]);
    G.pop();
    boxC([0], sx, sz, sd + 0.1, sw + 0.1, 0); touch.push({ x: sx, z: sz, w: sd, d: sw, floor: 0, name: 'the Shrine of Taharqa' });
    for (const x of [-35.3, -31.5, -27.7]) caseAt(x, ZH + 0.5, 0, { w: 3.2, d: 0.7, h: 2.3, cell: CELL.egypt }, 0);
    for (const x of [-35.3, -31.5]) caseAt(x, ZF - 0.5, Math.PI, { w: 3.2, d: 0.7, h: 2.3, cell: CELL.egypt }, 0);
  }
  // Greek pots: wall cases of pots and big pots on plinths under glass
  for (const z of [-27.2, -22.4, -17.6]) caseAt(WX + 0.5, z, Math.PI / 2, { w: 4.2, d: 0.7, h: 2.5, cell: CELL.pots }, 0);
  const potAt = (x, z, k, red) => {
    const y = lv[k] + 0.9;
    G.color(0x8a8478); G.box('stone', x - 0.35, lv[k], z - 0.35, x + 0.35, y, z + 0.35);
    // an amphora turned on the wheel, its frieze of invented figures running right round (red-figure or black-figure)
    const uv = artUV(red ? 'potRed' : 'potBlack', 1), Hp = 1.0, pin = [uv[0] + 0.01, uv[3] - 0.004];
    G.color(0xffffff);
    lathe(G, 'art', x, y, z, [[0.13, 0], [0.11, 0.035], [0.2, 0.16], [0.29, 0.38], [0.31, 0.52], [0.27, 0.66], [0.14, 0.78], [0.1, 0.85], [0.115, 0.93], [0.17, Hp]], 16, { u0: uv[0], u1: uv[2], vmap: [uv[1], (uv[3] - uv[1]) / Hp] });
    lathe(G, 'art', x, y + Hp - 0.02, z, [[0.16, 0], [0.02, -0.06]], 10, { uv: pin });
    for (const sd of [-1, 1]) tube(G, 'art', [[x + sd * 0.12, y + 0.9, z], [x + sd * 0.27, y + 0.86, z], [x + sd * 0.3, y + 0.7, z], [x + sd * 0.24, y + 0.62, z]], 0.022, 5, { uv: pin });
    G.color(0xffffff); G.box('glass', x - 0.36, y, z - 0.36, x + 0.36, y + 1.15, z + 0.36, { bottom: false });
    boxC([k], x, z, 0.8, 0.8, 0); touch.push({ x, z, w: 0.72, d: 0.72, floor: k, name: 'a Greek pot' });
  };
  { let i = 0; for (const x of [-24.5, -19.5, -14.5]) for (const z of [-25.5, -20.5]) potAt(x, z, 0, i++ % 2 === 0); }
  yield;
  // the east ground gallery (really China to AD 800: GUESSED contents — wall cases of vessels)
  for (const z of [-45, -40, -35, -30, -25, -20]) caseAt(EX - 0.5, z, -Math.PI / 2, { w: 3.4, d: 0.7, h: 2.3, cell: CELL.pots }, 0);
  // first floor (Mather's building only): Islamic Middle East (carpets, cases) west, India east
  {
    const y = lv[1];
    for (const z of [-45, -36, -27, -18]) { G.color(0xffffff); G.quadUV('art', [WX + 0.06, y + 0.6, z + 3.0], [WX + 0.06, y + 0.6, z - 3.0], [WX + 0.06, y + 3.5, z - 3.0], [WX + 0.06, y + 3.5, z + 3.0], artUV(z % 2 ? 'tapB' : 'tapA')); G.color(0xc8a868); G.box('paint', WX + 0.05, y + 3.5, z - 3.1, WX + 0.15, y + 3.6, z + 3.1); }
    caseAt(-19, -41, 0, { w: 2.2, d: 1.0, h: 1.6, cell: CELL.minerals, kind: 'table' }, 1);
    caseAt(-19, -31, 0, { w: 2.2, d: 1.0, h: 1.6, cell: CELL.jewel, kind: 'table' }, 1);
    caseAt(-19, -21, 0, { w: 2.2, d: 1.0, h: 1.6, cell: CELL.minerals, kind: 'table' }, 1);
    for (const z of [-45, -39, -33, -27, -21]) caseAt(EX - 0.5, z, -Math.PI / 2, { w: 3.6, d: 0.7, h: 2.3, cell: z % 2 ? CELL.jewel : CELL.minerals }, 1);
  }
  yield;
  // second floor — England 400–1600 with the Alfred Jewel, Music and Tapestry with the violin (west of the atrium);
  // paintings over the hall and in the east gallery
  {
    const [jx, jz] = I.jewel, y = lv[2];
    // the pressure pad (a slightly different square of floor round the case — a clue)
    G.color(0x5a4a3a); G.poly('paint', [[jx - 1.3, y + 0.005, jz + 1.3], [jx + 1.3, y + 0.005, jz + 1.3], [jx + 1.3, y + 0.005, jz - 1.3], [jx - 1.3, y + 0.005, jz - 1.3]], [0, 1, 0]);
    G.color(0x111118); G.box('paint', jx - 0.4, y, jz - 0.4, jx + 0.4, y + 1.05, jz + 0.4);
    G.color(0xffffff); G.box('glass', jx - 0.35, y + 1.05, jz - 0.35, jx + 0.35, y + 1.55, jz + 0.35, { bottom: false });
    // the jewel: a gold teardrop frame round a blue enamel face, on a little stand (shown larger than life so you can see it)
    G.color(GOLD); G.cyl('iron', jx, y + 1.08, jz, 0.04, 0.12, 6, 0.02);
    G.at(jx, y + 1.32, jz, 0); G.push(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    G.color(GOLD); G.cyl('iron', 0, -0.012, 0, 0.075, 0.024, 12, 0.075, 'both');
    G.color(0x2a5ac8); G.cyl('paint', 0, 0.013, 0, 0.055, 0.004, 12, 0.055, true);
    G.pop(); G.color(GOLD); G.cyl('iron', 0, -0.17, 0, 0.012, 0.12, 6, 0.03); G.pop();
    boxC([2], jx, jz, 0.9, 0.9, 0); touch.push({ x: jx, z: jz, w: 0.8, d: 0.8, floor: 2, name: 'the Alfred Jewel case' });
    plaque(G, jx, y + 0.85, jz + 0.41, 0, 0.7, 0.12, Lb.add('THE ALFRED JEWEL', { bg: '#141428', fg: '#e8d8a0' }));
    for (const z of [-26.5, -21, -15.5]) caseAt(WX + 0.5, z, Math.PI / 2, { w: 3.6, d: 0.7, h: 2.3, cell: z === -21 ? CELL.minerals : CELL.jewel }, 2);
    caseAt(-12.5, -26, 0, { w: 2.2, d: 1.0, h: 1.6, cell: CELL.jewel, kind: 'table' }, 2);
    // tapestries on the west wall, instruments
    for (const z of [-45, -36]) { G.color(0xffffff); G.quadUV('art', [WX + 0.06, y + 0.6, z + 3.0], [WX + 0.06, y + 0.6, z - 3.0], [WX + 0.06, y + 3.5, z - 3.0], [WX + 0.06, y + 3.5, z + 3.0], artUV(z === -45 ? 'tapB' : 'tapA')); G.color(0xc8a868); G.box('paint', WX + 0.05, y + 3.5, z - 3.1, WX + 0.15, y + 3.6, z + 3.1); }
    const [vx, vz] = I.violin;
    caseAt(vx, vz, 0, { w: 1.4, d: 0.9, h: 1.5, cell: CELL.plain, kind: 'table' }, 2, 'the violin case');
    G.at(vx, y + 0.92, vz, 0.3); G.color(0x8a3a14); G.box('paint', -0.11, 0, -0.17, 0.11, 0.05, 0.05); G.box('paint', -0.09, 0, 0.05, 0.09, 0.05, 0.2); G.color(0x1a1410); G.box('paint', -0.02, 0.03, 0.2, 0.02, 0.06, 0.46); G.pop();
    plaque(G, vx, y + 0.7, vz + 0.46, 0, 0.9, 0.12, Lb.add('THE "MESSIAH" VIOLIN, 1716', { bg: '#efe6cc' }));
    caseAt(-13, -45, 0, { w: 2.2, d: 1.0, h: 1.6, cell: CELL.plain, kind: 'table' }, 2);
  }
  // paintings in gilt frames, invented
  const paintingsOn = (a, b, k, h0 = 1.3) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux;
    const r = srng(Math.abs(a[0] * 31 + a[1] * 17 + k * 7) / 997);
    for (let s = 1.8; s < L - 1.6; s += 3.2 + r() * 0.8) {
      const w = 1.2 + r() * 1.3, h = 0.9 + r() * 1.1, cx = a[0] + ux * s + nx * 0.06, cz = a[1] + uz * s + nz * 0.06, y = lv[k] + h0 + (2.0 - h) / 2;
      const Pp = (dx, dy, o = 0) => [cx + ux * dx + nx * o, y + dy, cz + uz * dx + nz * o];
      // a moulded frame: outer edge, a raised ridge, a slope down to the sight edge; gilt, or now and then ebonised
      const fw = 0.1 + r() * 0.1, fc = r() < 0.18 ? 0x2a2018 : [0xd9b45c, 0xc49a44, 0xe0c070][Math.floor(r() * 3)];
      const ringAt = (e, o) => [Pp(-w / 2 - e, -e, o), Pp(w / 2 + e, -e, o), Pp(w / 2 + e, h + e, o), Pp(-w / 2 - e, h + e, o)];
      const R = [ringAt(fw, 0.0), ringAt(fw, 0.05), ringAt(fw * 0.55, 0.1), ringAt(0, 0.04)];
      for (let q = 0; q < 3; q++) for (let e = 0; e < 4; e++) { const e2 = (e + 1) % 4; G.color(new THREE.Color(fc).multiplyScalar(q === 1 ? 1.08 : q === 2 ? 0.9 : 0.75).getHex()); G.poly('gilt', [R[q][e], R[q][e2], R[q + 1][e2], R[q + 1][e]], q === 0 ? [e === 0 ? 0 : e === 2 ? 0 : (e === 1 ? ux : -ux), e === 0 ? -1 : e === 2 ? 1 : 0, e === 0 || e === 2 ? 0 : (e === 1 ? uz : -uz)] : [nx, 0, nz]); }
      const uv = cellUV(Math.floor(r() * 16), 0.004);
      G.color(0xffffff); G.quadUV('pics', Pp(-w / 2, 0, 0.04), Pp(w / 2, 0, 0.04), Pp(w / 2, h, 0.04), Pp(-w / 2, h, 0.04), uv);
      G.color(0xf4f0e4); G.poly('paint', [Pp(w / 2 + fw + 0.14, 0.02, 0.012), Pp(w / 2 + fw + 0.3, 0.02, 0.012), Pp(w / 2 + fw + 0.3, 0.13, 0.012), Pp(w / 2 + fw + 0.14, 0.13, 0.012)], [nx, 0, nz]);
    }
  };
  {
    const k = 2;
    paintingsOn([FE, ZF], [0.5, ZF], k); paintingsOn([-0.5, ZF], [FW, ZF], k);
    paintingsOn([FW, ZF], [FW, ZH], k); paintingsOn([FE, ZH], [FE, ZF], k);
    paintingsOn([FW, ZH], [-16.4, ZH], k); paintingsOn([-11.6, ZH], [hg[0] - 0.4, ZH], k); paintingsOn([hg[1] + 0.4, ZH], [9.6, ZH], k); paintingsOn([14.4, ZH], [FE, ZH], k);
    paintingsOn([EX, ZN], [EX, ZH], k); paintingsOn([HW, A.N + 26.5], [HW, A.N + 8], k);
    // benches down the middle of the galleries over the hall
    for (const x of [-15, -7, 7, 15]) { G.color(0x5a3a22); G.box('wood', x - 1.2, lv[k], -8.9, x + 1.2, lv[k] + 0.45, -8.3); boxC([k], x, -8.6, 2.5, 0.7, 0); }
  }
  yield;
  // the roof: the restaurant (tables along the glass, the counter by the door)
  {
    const y = lv[3];
    for (const [x, z] of I.tables) {
      G.color(0xf4f4f0); G.cyl('paint', x, y + 0.72, z, 0.55, 0.04, 12, 0.55); G.color(0x3a3a3a); G.cyl('iron', x, y, z, 0.05, 0.72, 6);
      for (const a of [0, Math.PI]) { G.color(0x6a4a2a); G.box('wood', x + Math.sin(a) * 0.8 - 0.2, y, z + Math.cos(a) * 0.8 - 0.2, x + Math.sin(a) * 0.8 + 0.2, y + 0.45, z + Math.cos(a) * 0.8 + 0.2); }
      circ([3], x, z, 0.65);
    }
    const [cx, cz] = I.coffee;
    G.color(0xe8e4dc); G.box('paint', cx - 0.5, y, cz - 2.5, cx + 0.5, y + 1.05, cz + 2.5); G.color(0x3a3a3a); G.box('paint', cx - 0.55, y + 1.05, cz - 2.55, cx + 0.55, y + 1.1, cz + 2.55);
    boxC([3], cx, cz, 1.1, 5.1, 0);
  }
  // signs: over the doorways, on the side you come from
  const sign = (x, y, z, rot, text, w = 2.6) => plaque(G, x, y, z, rot, w, 0.32, Lb.add(text, { bg: '#1a1a1a', fg: '#f0ece0', bold: false }));
  const zA = A.N + 5, zB = A.N + 30, ys = D + 0.3;
  sign(FW + 0.06, ys, ZH + 4.2, Math.PI / 2, 'ANCIENT EGYPT AND NUBIA', 3); sign(-14, ys, ZH + 0.06, 0, 'ANCIENT GREECE', 2.4); sign(12, ys, ZH + 0.06, 0, 'CHINA TO AD 800', 2.4);
  sign(-18.9, 2.9, ZH + 0.06, 0, 'GREEK AND ROMAN SCULPTURE', 3.2);
  sign(0, D + 0.95, ZH + 0.22, 0, 'ASHMOLEAN MUSEUM · BRITAIN\'S FIRST PUBLIC MUSEUM, 1683', 5.5);
  sign(-HW + 0.06, ys, zA, Math.PI / 2, 'CAST GALLERY', 2); sign(-HW + 0.06, ys, zB, Math.PI / 2, 'ANCIENT GREECE', 2.4);
  sign(HW - 0.06, ys, zA, -Math.PI / 2, 'CHINA TO AD 800', 2.4); sign(HW - 0.06, ys, zB, -Math.PI / 2, 'CHINA TO AD 800', 2.4);
  for (const z of [zA, zB]) { sign(-HW + 0.06, lv[1] + ys, z, Math.PI / 2, 'ISLAMIC MIDDLE EAST', 2.6); sign(HW - 0.06, lv[1] + ys, z, -Math.PI / 2, 'INDIA FROM AD 600', 2.6); }
  sign(-HW + 0.06, lv[2] + ys, zB, Math.PI / 2, 'ENGLAND 400–1600 · MUSIC AND TAPESTRY', 3.6); sign(HW - 0.06, lv[2] + ys, zB, -Math.PI / 2, 'WESTERN ART', 2.2);
  sign(0, lv[2] + ys, ZH - 0.06, Math.PI, 'WESTERN ART', 2.2);
  plaque(G, HW - 0.06, lv[3] + 3.05, zA, -Math.PI / 2, 2.6, 0.36, Lb.add('ASHMOLEAN DINING ROOM', { bg: '#1a2a2a', fg: '#e8e8e0' }));
  yield;
  // the information desk (east of the entrance) + the donation box (just inside the lobby)
  G.color(0xe8e4dc); G.box('paint', I.desk[0] - 2.2, 0, I.desk[1] - 0.45, I.desk[0] + 2.2, 1.05, I.desk[1] + 0.45);
  G.color(0x2a2a2a); G.box('paint', I.desk[0] - 2.25, 1.05, I.desk[1] - 0.5, I.desk[0] + 2.25, 1.1, I.desk[1] + 0.5);
  boxC([0], I.desk[0], I.desk[1], 4.5, 1.0, 0);
  plaque(G, I.desk[0], 0.62, I.desk[1] + 0.46, 0, 2.6, 0.26, Lb.add('INFORMATION · MUSEUM TRAIL', { bg: '#7a1424', fg: '#f6efe0' }));
  // leaflets on the desk, a rack of guides beside it, a dark panel on the wall behind (the day's exhibitions)
  for (let i = 0; i < 3; i++) { G.color([0xf4f0e4, 0x7a1424, 0x1a2a4a][i]); G.box('paint', I.desk[0] - 1.6 + i * 0.5, 1.1, I.desk[1] + 0.05, I.desk[0] - 1.3 + i * 0.5, 1.13, I.desk[1] + 0.3); }
  G.color(0x3a3c3e); G.box('paint', I.desk[0] - 3.3, 0, I.desk[1] - 0.4, I.desk[0] - 2.7, 1.5, I.desk[1] - 0.1); boxC([0], I.desk[0] - 3.0, I.desk[1] - 0.25, 0.7, 0.4, 0);
  G.color(0x24282c); G.box('paint', I.desk[0] - 2.0, 1.5, ZH + 0.02, I.desk[0] + 1.0, 3.0, ZH + 0.07);
  G.color(0x7a1424); G.box('paint', I.donate[0] - 0.22, 0, I.donate[1] - 0.22, I.donate[0] + 0.22, 1.1, I.donate[1] + 0.22); G.color(0xffffff); G.box('glass', I.donate[0] - 0.2, 0.75, I.donate[1] - 0.2, I.donate[0] + 0.2, 1.1, I.donate[1] + 0.2);
  circ([0], I.donate[0], I.donate[1], 0.3);
  yield;
  // benches under the east windows, a plan of the museum on the wall by the desk
  for (const x of [11.4, 17.2]) { G.color(0x5a3a22); G.box('wood', x - 1.2, 0, ZF - 0.75, x + 1.2, 0.45, ZF - 0.15); boxC([0], x, ZF - 0.45, 2.5, 0.7, 0); }
  plaque(G, 14.3, 1.7, ZH + 0.06, 0, 1.6, 0.3, Lb.add('FLOOR PLAN · G  1  2  ROOF', { bg: '#efe6cc' }));

  yield;
  const meshes = buildGeo(G, sc, { labels: labelMaterial(Lb, 0.2), pics: pmat, art: amat, gilt, glowLit, glowDay });
  yield;
  // the real openings (walk-in): the doorway's deep reveal and its threshold; frames, reveals and panes in the windows
  if (SL) {
    const p0 = SL.portals[0], front = SL.openings.filter((o) => !o.roof), roofG = SL.openings.filter((o) => o.roof);
    const stone = new THREE.MeshLambertMaterial({ color: 0xd9d0ba, side: THREE.DoubleSide, name: 'mus-ash-reveal' });
    const rv = reveal([p0], { floor: true, mat: stone }); sc.add(rv);
    // (the shared door materials' own frame / reveal belong to whichever room made them first: these are the museum's)
    const white = new THREE.MeshLambertMaterial({ color: 0xe8e4da, side: THREE.DoubleSide, name: 'mus-ash-winframe' }), alu = new THREE.MeshLambertMaterial({ color: 0x4a4e52, side: THREE.DoubleSide, name: 'mus-ash-alu' });
    sc.add(glazing(front, { bars: 2, frame: 0.07, mats: { ...cityDoorMats(), reveal: stone, frame: white } }));
    if (roofG.length) sc.add(glazing(roofG.map((o) => ({ ...o, bars: Math.round(o.w / 2.25) - 1 })), { frame: 0.07, inset: 0.2, mats: { ...cityDoorMats(), reveal: alu, frame: alu } }));
  }
  const sun = new THREE.DirectionalLight(0xfffaf0, 0.8); sun.position.set(4, 30, 8); sc.add(sun); sc.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd6cfc2, 0.55); sc.add(hemi);     // pale floors bounce light up on to the white soffits
  // light by the hour: `lit` = the museum's own lighting (1 open … a watchman's glimmer when shut), `day` = daylight
  // through the roof lights and the atrium's glass
  let lights = null;
  const setLight = (lit, day) => {
    if (!lights) { lights = []; sc.traverse((o) => { if (o.isLight) lights.push([o, o.intensity]); }); }
    const f = Math.max(0.1, Math.min(1, Math.max(lit, day * 0.7)));
    for (const [l, b] of lights) l.intensity = b * f;
    glowLit.color.setScalar(Math.max(0.06, lit)); glowDay.color.setScalar(Math.max(0.05, day));
    if (at.sky) at.sky.color.setScalar(Math.max(0.04, day)); if (at.wash) at.wash.opacity = 0.26 * day;
  };

  const exhibits = [
    { x: I.jewel[0], z: I.jewel[1] + 1.5, floor: 2, title: 'the Alfred Jewel', trail: 'jewel', lines: ['Gold, rock crystal and enamel, about six centimetres long, found in Somerset in 1693.', 'Round the edge: "AELFRED MEC HEHT GEWYRCAN" — Alfred ordered me to be made.', 'Probably the handle of a pointer for following the text while reading. Probably.'] },
    { x: I.shrine[0] + 2.4, z: I.shrine[1], floor: 0, title: 'the Shrine of Taharqa', trail: 'shrine', lines: ['A whole sandstone temple shrine, built for the pharaoh Taharqa around 680 BC at Kawa in Nubia.', 'Brought to Oxford block by block in 1936. You could fit a small seminar in it.'] },
    { x: I.mummy[0], z: I.mummy[1] + 1.4, floor: 0, title: 'the mummy case', lines: ['A painted and gilded coffin, made to the shape of the person inside.', 'The face is very calm about the whole thing.'] },
    { x: I.violin[0], z: I.violin[1] + 1.4, floor: 2, title: 'the "Messiah" violin', lines: ['Made by Antonio Stradivari in 1716, and hardly ever played: it is said to be as good as new.', 'Please do not ask the attendant if you can have a go.'] },
    { x: I.casts[0], z: I.casts[1], floor: 0, title: 'the cast gallery', r: 2.6, lines: ['Plaster casts of Greek and Roman sculpture, made so students could draw them without a trip to Athens.', 'Very white. Very still. Several are missing noses, out of solidarity with the originals.'] },
  ];
  const staff = [
    { x: I.desk[0], z: I.desk[1] - 1.0, h: 0, floor: 0, label: 'Information desk', lines: ['Welcome to the Ashmolean!', 'Admission is free. The restaurant is on the roof: up the stairs, all of them.'] },
    { x: -5.6, z: ZF - 1.3, h: Math.PI + 0.5, floor: 0, label: 'Attendant', lines: ['No photographs with flash, please.', 'They are Roman. Please do not hug them.'] },
    { x: -22.6, z: ZH + 1.2, h: -Math.PI / 2 + 0.5, floor: 0, label: 'Attendant', lines: ['The shrine was carried here stone by stone.', 'No, you can\'t go in the shrine.'] },
    { x: -24.5, z: -17, h: 2.4, floor: 2, label: 'Gallery attendant', lines: ['Lovely, isn\'t it? Please don\'t stand on the dark bit of floor.', 'I have been watching that jewel for eleven years.'] },
    { x: -19.8, z: ZH + 1.2, h: 0.5, floor: 2, label: 'Gallery attendant', lines: ['The benches are for sitting, not lying.'] },
    { x: I.coffee[0] + 1.4, z: I.coffee[1] + 1, h: Math.PI / 2, floor: 3, label: 'Waiter', lines: ['Table for one? Lovely view of the Randolph from here. Sometimes it\'s on fire.'] },
  ];
  const visitors = [
    { x: -14, z: -8.6, h: 2.6, wander: 3 }, { x: 5.5, z: -8.2, h: 0.4, wander: 2.5 }, { x: 0, z: -19, h: Math.PI, wander: 3 }, { x: -19, z: -23, h: -1.2, wander: 3 }, { x: -17, z: -43, h: 2.1, wander: 3 }, { x: 11.5, z: -31, h: 1.2, wander: 2 },
    { x: -22, z: -30, h: -0.4, floor: 1 }, { x: 12.6, z: -26, h: Math.PI / 2, floor: 1 },
    { x: I.jewel[0] + 1.7, z: I.jewel[1] + 1.2, h: -2.2, floor: 2 }, { x: I.violin[0] - 1.6, z: I.violin[1] + 1.2, h: 2.2, floor: 2 }, { x: -10, z: ZF - 1.4, h: 0, floor: 2 }, { x: 9, z: ZH + 1.4, h: Math.PI, floor: 2 },
    ...I.tables.slice(0, 2).map(([x, z]) => ({ x, z: z + 0.8, h: Math.PI, floor: 3, pose: 'sit' })),
  ];
  return { floors, touch, exhibits, staff, visitors, dims: { ...I, atrium: A }, setLight, lobby: LOB, colliders: [colG, colU], meshes };
}
