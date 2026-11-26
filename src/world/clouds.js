// Clouds seen from the ground (and from a glider): the field shared by the sky dome (sky.js), the ground's cloud
// shadows (every lit material, via the lights chunk) and the cloud-top deck drawn under a glider that has climbed
// above a layer. ONE field so that a shadow falls under its cloud and the deck seen from above is the deck seen from
// below. The weather (systems/weather.js) fills `CLOUD` every frame; nothing here allocates per frame.
//
//   cumulus  a 2-D field on a plane at the cumulus base (cuBase, the gliders' cloud base): two value-noise octaves
//            (~1.8 km and ~0.9 km features, rotated so no grid shows) + two billowy ones for the cauliflower edges,
//            thresholded by the coverage; lit by sampling the field again towards the sun (a cloud denser on its sun
//            side is in its own shadow), flat grey bases overhead, sunlit sides towards the horizon, a silver lining
//            round the sun, pink undersides when the sun is below them, the city's sodium glow underneath at night
//   deck     the stratiform layer (altostratus high up ahead of a front, a grey stratocumulus / nimbostratus sheet low
//            down when overcast or raining): low-frequency noise stretched along the wind (rolls), its opacity from
//            the weather; thickness shows as darker patches, a watery sun shows through it when thin
//   coverage the sky upwind shows what is coming: the weather an hour ahead lies ~30 km upwind (the weather runs at
//            game speed, the clouds drift at the real wind speed), the last hour downwind
//   shadows  the cumulus field's two big octaves, projected down the sun direction (lights_fragment_end patch below):
//            direct light only, so shade stays lit by the sky
import * as THREE from 'three';

export const CU_SCALE = 1800, ST_ALONG = 3200, ST_ACROSS = 2300;

/** Shared GLSL: hash, value noise, the cumulus field. gcCu(q, fine): q in CU_SCALE units, fine 0..1 (the detail octaves). */
export const CLOUD_GLSL = /* glsl */`
float gcH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gcN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gcH(i), gcH(i + vec2(1.0, 0.0)), f.x), mix(gcH(i + vec2(0.0, 1.0)), gcH(i + vec2(1.0, 1.0)), f.x), f.y); }
float gcCu(vec2 q, float fine) {
  const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
  float n = gcN(q) * 0.52;
  q = M * q + vec2(3.1, 7.7); n += gcN(q) * 0.27;
  if (fine > 0.0) {
    // detail: rounded bumps (|noise| billows, squared so the lumps are round and the gaps sharp), not ridges
    q = M * q + vec2(1.7, 9.2); float b1 = gcN(q); n += (b1 * b1 - 0.33) * 0.26 * fine;
    q = M * q + vec2(8.3, 2.8); float b2 = gcN(q); n += (b2 * b2 - 0.33) * 0.14 * fine;
    q = M * q + vec2(4.4, 6.6); n += (gcN(q) - 0.5) * 0.07 * fine;
  }
  return n / 0.79;
}
float gcSt(vec2 q, float fine) {
  const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
  float n = gcN(q) * 0.6;
  q = M * q + vec2(5.3, 1.9); n += gcN(q) * 0.3;
  if (fine > 0.0) { q = M * q * 1.4 + vec2(2.2, 6.1); n += (gcN(q) - 0.5) * 0.22 * fine; }
  return n / 0.9;
}
`;

/** CPU port of gcCu with fine = 0 (the low tier dims the sun when the player is under a cloud instead of drawing shadows) */
const fract = (x) => x - Math.floor(x);
function gcH(x, y) {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d; b += d; c += d;
  return fract((a + b) * c);
}
function gcN(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = gcH(ix, iy), b = gcH(ix + 1, iy), c = gcH(ix, iy + 1), d = gcH(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export function cuFieldCPU(qx, qz) {
  let n = gcN(qx, qz) * 0.52;
  // GLSL mat2(1.6, 1.2, -1.2, 1.6) is column-major: M * q = (1.6 qx - 1.2 qz, 1.2 qx + 1.6 qz)
  const x2 = 1.6 * qx - 1.2 * qz + 3.1, z2 = 1.2 * qx + 1.6 * qz + 7.7;
  n += gcN(x2, z2) * 0.27;
  return n / 0.79;
}
/** coverage 0..1 -> the field threshold (P(field > T) ≈ coverage) */
export const cuThreshold = (cov) => 0.72 - 0.47 * cov;

/**
 * Shared uniforms for the cloud shadows on every lit material (typed arrays riding in ShaderLib, as materials.js HAZE):
 *   A = (drift x, drift z, threshold, strength)   B = (sun x / sun y, sun z / sun y, base height, 1 / CU_SCALE)
 */
export const CLOUD_SH = { A: new Float32Array([0, 0, 1, 0]), B: new Float32Array([0, 0, 1100, 1 / CU_SCALE]) };

/** Patch three's light chunks once: direct light × (1 − strength × cloud overhead along the sun). Zero cost when strength is 0. */
export function installCloudShadows() {
  const C = THREE.ShaderChunk;
  if (C.__gtoClouds) return; C.__gtoClouds = true;
  C.lights_pars_begin = C.lights_pars_begin + /* glsl */`
uniform vec4 gtoCloudA;
uniform vec4 gtoCloudB;
float gtoCH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gtoCN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gtoCH(i), gtoCH(i + vec2(1.0, 0.0)), f.x), mix(gtoCH(i + vec2(0.0, 1.0)), gtoCH(i + vec2(1.0, 1.0)), f.x), f.y); }
float gtoCloudShadow(vec3 w) {
  vec2 q = (w.xz + gtoCloudB.xy * (gtoCloudB.z - w.y) - gtoCloudA.xy) * gtoCloudB.w;
  float n = gtoCN(q) * 0.52 + gtoCN(mat2(1.6, 1.2, -1.2, 1.6) * q + vec2(3.1, 7.7)) * 0.27;
  return smoothstep(gtoCloudA.z, gtoCloudA.z + 0.1, n / 0.79);
}
`;
  C.lights_fragment_end = /* glsl */`
if (gtoCloudA.w > 0.0) {
	vec3 gtoW = cameraPosition + geometryPosition * mat3(viewMatrix);
	float gtoS = 1.0 - gtoCloudA.w * gtoCloudShadow(gtoW);
	reflectedLight.directDiffuse *= gtoS; reflectedLight.directSpecular *= gtoS;
}
` + C.lights_fragment_end;
  for (const k in THREE.ShaderLib) { const u = THREE.ShaderLib[k].uniforms; if (u && (u.directionalLights || u.ambientLightColor)) { u.gtoCloudA = { value: CLOUD_SH.A }; u.gtoCloudB = { value: CLOUD_SH.B }; } }
  THREE.UniformsLib.lights.gtoCloudA = { value: CLOUD_SH.A }; THREE.UniformsLib.lights.gtoCloudB = { value: CLOUD_SH.B };
}

/**
 * The cloud-top deck: one camera-following plane at the height of the layer the camera has climbed above (aerial mode
 * only — a glider over an overcast). Same field, lit from above, hazed with distance. Beyond the camera's far plane
 * the sky dome draws the same layer from above. 1 draw while shown, nothing otherwise.
 */
export function createDeck(skyU) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uKind: { value: 0 }, uCov: { value: 0 }, uFine: { value: 1 },
    uTop: { value: new THREE.Color(1, 1, 1) }, uSide: { value: new THREE.Color(0.6, 0.65, 0.72) },
  }]);
  u.uOff = skyU.uOff; u.uWx = skyU.uWx; u.uSunDir = skyU.uSunDir; u.uNight = skyU.uNight; u.uFlash = skyU.uFlash; u.uGlow = skyU.uGlowCol;
  const m = new THREE.ShaderMaterial({
    name: 'world:cloudDeck', uniforms: u, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
varying vec3 vW;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */`
uniform float uKind; uniform float uCov; uniform float uFine; uniform vec3 uTop; uniform vec3 uSide;
uniform vec4 uOff; uniform vec4 uWx; uniform vec3 uSunDir; uniform float uNight; uniform float uFlash; uniform vec3 uGlow;
varying vec3 vW;
#include <common>
#include <fog_pars_fragment>
${CLOUD_GLSL}
void main() {
  float dist = length(vW.xz - cameraPosition.xz);
  float fine = uFine * (1.0 - smoothstep(4000.0, 14000.0, dist));
  float n, T, a, lit;
  vec2 sd = normalize(uSunDir.xz + vec2(1e-4));
  if (uKind < 0.5) {
    vec2 q = (vW.xz - uOff.xy) / ${CU_SCALE.toFixed(1)};
    n = gcCu(q, fine); T = 0.72 - 0.47 * uCov;
    a = smoothstep(T, T + 0.09, n);
    float n2 = gcCu(q + sd * 0.16, 0.0);
    lit = clamp(0.75 + (n - n2) * 3.0, 0.35, 1.15);
  } else {
    vec2 Q = vW.xz - uOff.zw, q = vec2(dot(Q, uWx.xy) / ${ST_ALONG.toFixed(1)}, dot(Q, vec2(-uWx.y, uWx.x)) / ${ST_ACROSS.toFixed(1)});
    n = gcSt(q, fine); T = 0.85 - 1.1 * uCov;
    a = smoothstep(T, T + 0.28, n);
    lit = 0.85 + 0.3 * (n - 0.5);
  }
  vec3 c = mix(uSide, uTop, clamp(lit, 0.0, 1.0)) * (0.9 + 0.2 * lit);
  c += uGlow * 0.4 + vec3(0.75, 0.8, 1.0) * uFlash * 0.6;
  gl_FragColor = vec4(c, a * (1.0 - smoothstep(26000.0, 38000.0, dist)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(80000, 80000).rotateX(-Math.PI / 2), m);
  mesh.name = 'world:cloudDeck'; mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}
