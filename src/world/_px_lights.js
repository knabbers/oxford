// Pixel-cost pass (2026-11): point and spot lights that are all switched off cost a pixel nothing.
//
// three evaluates the whole direct-light model (for a MeshStandardMaterial: the GGX specular and diffuse terms) for
// every point and spot light counted in the scene, at every lit pixel, whatever the light's strength. The world scene
// keeps five point lights alive all day at intensity 0 (the four pooled street-lamp lights of world/furniture.js and
// the Randolph's fire light: switching one off would change the light count, and with it every program). Measured on
// a Radeon Pro 460 at 1080p on the top tier, by day: 4.3 ms of a 37 ms frame at Worcester's front, 6.9 ms of 44 in the
// Parks — for adding zero. Here each of the two loops is put inside one test of the lights' own uniforms: the sum of
// their colours (three sends colour x intensity), so with every one of them dark the loop is not run. The picture is
// the same to the bit (what is skipped added 0); after dark, with a lamp lit, the loop runs as before.
// (A test per light — three's own `directLight.visible` — was tried first and saved nothing: this driver runs both
//  sides of a small per-pixel branch. One branch on uniforms round the whole loop it does take.)
// The sessions that can reach the top tier only (decided at boot with the surfaces: lower tiers' shaders are
// untouched). `?lightskip=0`: three's own loops (A/B).
import * as THREE from 'three';

export const PX_LIGHTS = { on: true, installed: false, orig: null };      // orig: three's own chunk (A/B pictures in one session: tools/pixelcost.mjs)
try { if (new URLSearchParams(location.search).get('lightskip') === '0') PX_LIGHTS.on = false; } catch (e) { /* no location */ }

export function installLightSkip(want = true) {
  const C = THREE.ShaderChunk;
  if (C.__gtoLightSkip || !PX_LIGHTS.on || !want) return false;
  let src = C.lights_fragment_begin, n = 0;
  for (const [loop, arr] of [['i < NUM_POINT_LIGHTS; i ++ ) {', 'pointLights'], ['i < NUM_SPOT_LIGHTS; i ++ ) {', 'spotLights']]) {
    const i = src.indexOf(loop), a = i >= 0 ? src.lastIndexOf('#pragma unroll_loop_start', i) : -1, e0 = i >= 0 ? src.indexOf('#pragma unroll_loop_end', i) : -1;
    if (i < 0 || a < 0 || e0 < 0 || i - a > 60) continue;      // (another three: leave that loop as it is)
    const e = e0 + '#pragma unroll_loop_end'.length, any = 'gtoAny_' + arr;
    src = src.slice(0, a) + `float ${any} = 0.0;\n\t#pragma unroll_loop_start\n\tfor ( int i = 0; ${loop}\n\t\t${any} += dot( ${arr}[ i ].color, vec3( 1.0 ) );\n\t}\n\t#pragma unroll_loop_end\n\tif ( ${any} > 0.0 ) {\n\t` + src.slice(a, e) + '\n\t}\n' + src.slice(e);
    n++;
  }
  if (!n) return false;
  PX_LIGHTS.orig = C.lights_fragment_begin; C.lights_fragment_begin = src; C.__gtoLightSkip = true; PX_LIGHTS.installed = true;
  return true;
}
