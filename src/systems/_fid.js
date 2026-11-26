// Shared bits of the "fidelity" pass (2026-11: small ordinary things you can do or notice — sitting.js, crossings.js,
// breath.js, wetfeet.js, leaves.js, streetlife.js, the players' own umbrellas in umbrellas.js). Pure where it can be;
// nothing here touches the network.
//   fidOn(name)         the feature's switch: ?<name>=0 in the page, GTO_<NAME>=0 in node tools (read at call time)
//   h01(a, b, c)        a 0..1 hash of up to three integers (the same on every client)
//   wNoise / puddleAt   the ground shader's own noise field (world/materials.js GLSL_HASH) ported to JS, and how deep in
//                       a DRAWN puddle the point (x, z) is for the standing water `w` (game.weather.puddle): the splash
//                       happens where the puddle is on screen
//   fidPuffs(game)      ONE pooled Points draw (the vehicles' Puffs class and shader: no new program) shared by breath,
//                       exhaust, cigarette smoke and puddle splashes; invisible while empty

import { Puffs } from './_vehfx.js';

const OFF = /^(0|false|off|no)$/i;
export function fidOn(name) {
  try { const v = typeof process !== 'undefined' && process.env ? process.env['GTO_' + name.toUpperCase()] : undefined; if (v !== undefined) return !OFF.test(v); } catch { /* */ }
  try { const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || ''); if (q.has(name)) return !OFF.test(q.get(name) || ''); } catch { /* */ }
  return true;
}

export function h01(a, b = 0, c = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x165667b1, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const strSeed = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h | 0; };

// ---- the ground shader's noise (float32 at every step, as the GPU computes it, so the puddles line up with the drawn ones)
const f = Math.fround, fract = (x) => f(x - Math.floor(x));
function wHash12(px, py) {
  let x = fract(f(px * 0.1031)), y = fract(f(py * 0.1031)), z = x;
  const d = f(f(x * f(y + 33.33)) + f(y * f(z + 33.33)) + f(z * f(x + 33.33)));
  x = f(x + d); y = f(y + d); z = f(z + d);
  return fract(f(f(x + y) * z));
}
export function wNoise(px, py) {
  px = f(px); py = f(py);
  const ix = Math.floor(px), iy = Math.floor(py); let fx = f(px - ix), fy = f(py - iy);
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = wHash12(ix, iy), b = wHash12(ix + 1, iy), c = wHash12(ix, iy + 1), d = wHash12(ix + 1, iy + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}
/** 0 = dry ground, 1 = the middle of a drawn puddle, for standing water w 0..1 (as materials.js: wPud) */
export function puddleAt(x, z, w) {
  if (!(w > 0.02)) return 0;
  const n = wNoise(x * 0.21, z * 0.21) * 0.6 + wNoise(x * 0.83 + 4, z * 0.83 + 4) * 0.4;
  const t0 = 0.9 + (0.5 - 0.9) * Math.min(1, w); let s = (n - t0) / 0.16; s = s < 0 ? 0 : s > 1 ? 1 : s;
  return s * s * (3 - 2 * s) * Math.min(1, w * 5);
}

/** the pass's one particle draw (made on first use; game.fidPuffs afterwards) */
export function fidPuffs(game) {
  if (game.fidPuffs) return game.fidPuffs;
  const P = new Puffs(game.worldScene, 192);
  P.mesh.name = 'fidelity:puffs'; P.mesh.userData.owner = 'fidelity';
  game.fidPuffs = P; P._frame = -1;
  /** stepped once a frame by whichever of the pass's systems runs first (`by` = the caller's id: where the frame
   *  counter does not advance - node tools - the same caller stepping again is the next frame) */
  P.step = (dt, by) => { if (P._frame === game.frame && P._by !== by) return; P._frame = game.frame; P._by = by; P.update(dt); };
  // (in the scene but hidden, like 'vehicle:puffs': world/prewarm.js draws hidden things once on the loading screen)
  return P;
}
