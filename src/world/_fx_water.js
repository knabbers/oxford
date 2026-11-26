// Water (shader pass 10; tier field `waterFx`, ?waterfx=0): the surface moves with the weather.
//
// The water material of materials.js drew two octaves of slow round swell drifting on fixed bearings whatever the
// wind did. With FX_WATER (a define on the same material; the fragment shader is patched here at four anchors, and
// left exactly as it was if any of them is missing):
//   wind    wavelets run DOWN the weather system's wind and are long-crested across it (three scales: 11 m, 3.5 m and
//           a fine 1.7 m chop that is faded out before it could alias); their height and speed follow the wind
//           speed — a still evening is close to a mirror with a slow heave, a blustery afternoon is ruffled and
//           the sun's path breaks into glitter
//   wakes   whoever the player is in the water with — swimming, in a punt or a boat — leaves rings that spread and
//           die behind them (six ring emitters dropped along the track)
//   shallows the bed shows a little through the first metres from a bank by day: murky olive-brown, not blue
// Rain rings, the bank lip, the mirrored far bank and the screen-space reflections are the material's own, untouched.
// NOT done (no data in the map to drive them): flow direction on the rivers, foam at weirs and locks, wakes of ducks
// and of other people's punts.
import * as THREE from 'three';

const A_H = 'return wNoise(p * 0.42 + vec2(t * 0.07, t * 0.035)) * 0.6 + wNoise(p * 1.3 - vec2(t * 0.11, -t * 0.06)) * 0.4;';
const A_AMP = 'float amp = 0.24 / (1.0 + dist * 0.02) * mix(1.0, 0.5, wSkyContrast(uSkyHor, uSkyZen));';
const A_N = 'vec3 N = normalize(vec3(-(hx - h0) / e * amp, 1.0, -(hz - h0) / e * amp));';
const A_COL = 'col *= 1.0 - 0.35 * under;';
const A_UNI = 'uniform vec4 uWetv;';
const NW = 6;

export function createWaterFx(game, mat) {
  const uW = { value: new THREE.Vector4(1, 0, 0.3, 0) }, uWk = { value: [] };
  for (let i = 0; i < NW; i++) uWk.value.push(new THREE.Vector4(0, 0, -1e3, 0));
  let ok = false, on = false, next = 0, drop = 0, lx = 0, lz = 0;
  const fs = mat.fragmentShader;
  if ([A_H, A_AMP, A_N, A_COL, A_UNI].every((a) => fs.split(a).length === 2)) {
    mat.fragmentShader = fs
      .replace(A_UNI, A_UNI + `\n#ifdef FX_WATER\nuniform vec4 uFxW;\nuniform vec4 uFxWk[${NW}];\n#endif`)
      .replace(A_H, /* glsl */`
#ifdef FX_WATER
  vec2 q = vec2(dot(p, uFxW.xy), dot(p, vec2(-uFxW.y, uFxW.x)));
  float sp = 0.25 + 1.1 * uFxW.z;
  float fine = 1.0 - smoothstep(0.04, 0.16, fwidth(p.x) + fwidth(p.y));
  return wNoise(vec2(q.x * 0.55 - t * 0.45 * sp, q.y * 0.2 + t * 0.03)) * 0.5
    + wNoise(vec2(q.x * 1.8 - t * 1.0 * sp, q.y * 0.75) + 3.1) * 0.32
    + wNoise(vec2(q.x * 3.7 - t * 1.7 * sp, q.y * 2.3 + t * 0.2) + 9.7) * 0.18 * fine;
#else
  ${A_H}
#endif`)
      .replace(A_AMP, A_AMP + `\n#ifdef FX_WATER\n  amp *= 0.4 + 1.5 * uFxW.z;\n#endif`)
      .replace(A_N, A_N + /* glsl */`
#ifdef FX_WATER
  {
    vec2 wk = vec2(0.0);
    for (int i = 0; i < ${NW}; i++) {
      vec4 k = uFxWk[i];
      float age = uTime - k.z;
      if (age < 0.0 || age > 7.0) continue;
      vec2 o = p - k.xy; float r = length(o), rad = 0.25 + age * 0.85, w = (r - rad) * 7.0;
      wk += o / max(r, 1e-3) * sin(w) * exp(-w * w * 0.12) * k.w * exp(-age * 0.55) / (1.0 + rad * 0.6);
    }
    N = normalize(N + vec3(wk.x, 0.0, wk.y) * 0.9);
  }
#endif`)
      .replace(A_COL, A_COL + `\n#ifdef FX_WATER\n  col += vec3(0.05, 0.043, 0.018) * (1.0 - uNight) * (1.0 - smoothstep(0.3, 3.2, bankM)) * (1.0 - fres) * dot(uSkyHor, vec3(0.5));\n#endif`);
    mat.uniforms.uFxW = uW; mat.uniforms.uFxWk = uWk;
    mat.defines = mat.defines || {};
    ok = true;
  } else console.warn('[fx water] water shader anchors not found: left as it is');
  const X = {
    ok, enabled: false,
    set(v) {
      on = !!v && ok; X.enabled = on;
      if (!ok) return;
      if (on !== ('FX_WATER' in mat.defines)) { if (on) mat.defines.FX_WATER = ''; else delete mat.defines.FX_WATER; mat.needsUpdate = true; }
    },
    /** once a frame outdoors: the wind, and the player's wake */
    update(dt, sky, time) {
      if (!on) return;
      const W = sky && sky.weather, wx = game.weather && game.weather.wind, sp = wx && isFinite(wx.speed) ? wx.speed : 3;
      uW.value.set(W ? W.wind[0] : 1, W ? W.wind[1] : 0, Math.min(1, sp / 11), 0);
      const p = game.player; if (!p || p.place !== 'world') return;
      const C = game.worldCollider, x = p.pos.x, z = p.pos.z;
      drop -= dt;
      if (drop <= 0 && C && C.isWater && C.isWater(x, z)) {
        const v = Math.hypot(x - lx, z - lz) / Math.max(0.3 - drop, 1e-3);
        if (v > 0.25 && v < 30) { uWk.value[next].set(x, z, time, Math.min(1, 0.35 + v * 0.3)); next = (next + 1) % NW; }
        drop = 0.3;
      }
      if (drop <= 0 || drop === 0.3) { lx = x; lz = z; if (drop <= 0) drop = 0.3; }
    },
  };
  return X;
}
