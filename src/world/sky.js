// Sky dome, sun/moon, stars, hemisphere fill, fog and exposure, all driven by game.time.hour each frame.
// Sun position: Oxford latitude 51.75°N with a fixed spring/late-summer declination (+12°) so the game's dawn (≈6:00)
// and dusk (≈20:00) line up with game.time.daylight. Solar noon is 13:00 (BST).
import * as THREE from 'three';
import { U, HAZE, installHaze, setLitShares } from './materials.js';
import { clamp, smoothstep } from './util.js';
import { CLOUD_GLSL, CU_SCALE, ST_ALONG, ST_ACROSS, CLOUD_SH, installCloudShadows, createDeck, cuFieldCPU, cuThreshold } from './clouds.js';

const LAT = (51.75 * Math.PI) / 180, DECL = (12 * Math.PI) / 180, MOON_DECL = (6 * Math.PI) / 180;
/** the sun-side haze: the sky dome's own (full) colour, and the display value the materials' share is held to (see update) */
const HAZE_SKY = new Float32Array(3), HAZE_TOP = (() => { try { const v = new URLSearchParams(location.search).get('hazetop'); return v !== null && isFinite(+v) ? +v : 0.86; } catch (e) { return 0.86; } })();
let SHADOW_BOX = 60, SHADOW_MAP = 2048;     // set by the quality tier (sky.setShadow)

// keyed by sun elevation (degrees). colours sRGB hex.
// [el, zenith, horizon, ground(below horizon), sunLight, sunI, hemiSky, hemiGround, hemiI, fogDensity, exposure]
// graphics pass 1: warmer, stronger low sun (stone glows at golden hour, hemi fill a little lower so it has contrast),
// brighter blue-grey night fill + exposure so nights read without going murky, a touch more aerial haze by day
// graphics pass 5: a real key/fill ratio. The sun is much stronger and warmer, the hemisphere fill weaker and bluer, so
// sunlit stone glows and shadowed sides read cool instead of grey; exposure comes down to hold the highlights. Nights
// are lit by a saturated blue fill (dark blue, not black). Haze is exponential (not exp²) so it already tints the far
// end of a street; denser at low sun (morning / evening mist).
const KEYS = [
  [-90, '#050a1c', '#121b34', '#07080b', '#000000', 0, '#4f6cc8', '#1a2034', 0.5, 0.0010, 1.5],
  [-14, '#060c20', '#152038', '#08090c', '#000000', 0, '#506ec8', '#1a2034', 0.5, 0.0010, 1.5],
  [-8, '#0c1530', '#27304e', '#0c0d12', '#000000', 0, '#5c74c0', '#22222e', 0.5, 0.0011, 1.4],
  [-4, '#1c2a5a', '#6a5270', '#17151a', '#ff6030', 0, '#7c86c4', '#30261e', 0.5, 0.0012, 1.2],
  [-1, '#2c4888', '#e08a58', '#2a221e', '#ff7038', 0.0, '#98a0cc', '#3a3028', 0.55, 0.0013, 1.08],
  // pass 7 (shade colour): the fill was a saturated sky blue from above and a dim brown from below, so a wall in shadow
  // (which sees half of each) came out grey-blue and honey stone lost its colour. The ground term is now what a wall
  // really sees below the horizon — sunlit paving, gravel and the stone fronts opposite, i.e. a bright WARM bounce —
  // and the sky term is paler, so shadowed stone keeps its own hue and the sky only tints it (up-facing shade — roads,
  // flags, lawns — stays cool, but no longer navy). Same lights, same shader: only these numbers changed.
  [2, '#3d62a8', '#f2a868', '#3a3430', '#ff8a40', 1.9, '#a0b0dc', '#7a5a36', 0.68, 0.0014, 1.02],
  [7, '#4274bc', '#eec49a', '#48443c', '#ffb068', 3.2, '#a8b6da', '#9c7a4c', 0.8, 0.0013, 1.0],
  [15, '#3f78c4', '#d8d8dc', '#4e4c46', '#ffd098', 3.7, '#b2bed6', '#a88c5e', 0.88, 0.0011, 0.98],
  [30, '#3572c8', '#bcd2ec', '#505050', '#ffe6c4', 3.9, '#b8c1d3', '#ac9666', 0.93, 0.0010, 0.96],
  [90, '#2f6cc8', '#b4ceec', '#505050', '#fff0dc', 4.0, '#bbc2d1', '#ae9a69', 0.96, 0.0009, 0.96],
].map((k) => [k[0], ...k.slice(1, 5).map((c) => new THREE.Color(c)), k[5], new THREE.Color(k[6]), new THREE.Color(k[7]), k[8], k[9], k[10]]);

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FS = /* glsl */`
uniform vec3 uZen;
uniform vec3 uHor;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uMoonDir;
uniform vec3 uHazeBase;
uniform vec3 uHazeSun;
uniform float uNight;
uniform float uTime;
uniform float uGlow;
uniform vec4 uCu;      // cumulus coverage: an hour ago (downwind), now, an hour ahead (upwind); base height (m)
uniform vec4 uSt;      // deck opacity: the same three; base height (m)
uniform vec4 uOff;     // cumulus drift (x, z), deck drift (x, z) — metres since the wind block began
uniform vec4 uWx;      // wind unit vector (x, z), storm darkness, near-fade radius (3-D cumulus of the gliders)
uniform vec3 uCuLit;   // sunlit cloud
uniform vec3 uCuShade; // cloud in its own shade / flat base
uniform vec3 uDeckCol; // the deck from below
uniform vec3 uGlowCol; // the city's sodium glow on cloud undersides at night
uniform vec2 uLow;     // x: low sun (pink undersides), y: haze-band widening (mist / rain)
uniform vec2 uBow;     // x: rainbow strength (a shower just gone over, the sun out behind you), y: rain shafts under the cumulus
uniform float uFlash;
varying vec3 vDir;
float sHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
${CLOUD_GLSL}
float covAt(vec4 c, vec2 P) {
  // upwind the next hour's weather, downwind the last hour's: ~30 km either way
  float al = dot(P - cameraPosition.xz, -uWx.xy) / 30000.0;
  return al > 0.0 ? mix(c.y, c.z, min(al, 1.0)) : mix(c.y, c.x, min(-al, 1.0));
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float hc = clamp(h, 0.0, 1.0);
  // zenith -> horizon: most of the change happens low down, as in a real sky
  vec3 col = mix(uHor, uZen, 1.0 - exp(-hc * 4.2));
  col += uGlowCol * 5.0 * exp(-hc * 8.0);     // the city's glow low in a night sky (uGlowCol is zero by day)
  float cs = max(dot(d, uSunDir), 0.0);
  float cs2 = cs * cs, cs8 = cs2 * cs2; cs8 *= cs8;
  float cs64 = cs8 * cs8; cs64 *= cs64; cs64 *= cs64;
  // broad warm scattering round the sun (stronger and wider when it is low), a tight aureole, and the disc itself
  float disc = smoothstep(0.99955, 0.9998, cs) * smoothstep(-0.03, 0.0, h);
  col += uSunCol * (cs8 * 0.16 * uGlow * (1.0 - hc) + cs64 * 0.5 + cs64 * cs64 * cs64 * cs64 * 2.5 + disc * 30.0);
  float cm = dot(d, uMoonDir);
  float moonDisc = smoothstep(0.99935, 0.9996, cm);
  vec3 mq = d - uMoonDir * cm;
  float crater = 0.85 + 0.15 * sHash(floor(mq * 1800.0));
  col += vec3(0.92, 0.94, 1.0) * moonDisc * 1.6 * crater * uNight * smoothstep(-0.02, 0.02, h);
  col += vec3(0.25, 0.3, 0.45) * pow(max(cm, 0.0), 250.0) * 0.6 * uNight;
  vec3 cp = cameraPosition;
  vec2 sd = normalize(uSunDir.xz + vec2(1e-4));
  float aAll = 0.0;
  // ---- the deck (stratiform layer)
  vec3 dC = vec3(0.0); float dA = 0.0;
  float Hs = uSt.w - cp.y;
  if (uSt.x + uSt.y + uSt.z > 0.004 && Hs * d.y > 0.0) {
    float t = Hs / d.y;
    vec2 P = cp.xz + d.xz * t;
    float cov = covAt(uSt, P);
    vec2 Q = P - uOff.zw, q = vec2(dot(Q, uWx.xy) / ${ST_ALONG.toFixed(1)}, dot(Q, vec2(-uWx.y, uWx.x)) / ${ST_ACROSS.toFixed(1)});
    float fine = 1.0 - smoothstep(6000.0, 26000.0, t);
#if CLOUD_Q < 2
    fine = 0.0;
#endif
    float n = gcSt(q, fine), T = 0.85 - 1.1 * cov;
    dA = smoothstep(T, T + 0.28, n) * smoothstep(0.0, 0.025, abs(d.y));
    float thick = smoothstep(T + 0.15, T + 0.8, n) * cov;
    if (Hs > 0.0) {
      // the base of the deck: darker rolls and lighter gaps (stratocumulus), smoother when thin and high
      float rolls = smoothstep(0.32, 0.78, n) * (0.5 + 0.5 * smoothstep(0.4, 0.9, cov));
      dC = uDeckCol * mix(1.18, 0.66, rolls) * (1.05 - 0.2 * thick);
      // a watery sun through thin cloud, a brighter patch round it through thick
      dC += uSunCol * ((cs64 * 0.9 + cs8 * 0.12) * (1.0 - thick) * (1.0 - 0.75 * cov) + cs8 * 0.05);
      dC += uSunCol * uLow.x * 0.35 * max(dot(normalize(d.xz + vec2(1e-4)), sd), 0.0) * (1.0 - thick);
      dC += uGlowCol * (0.7 + 0.6 * thick);
    } else dC = mix(uCuShade, uCuLit, 0.75 + 0.25 * (n - 0.5)) + uGlowCol * 0.3;
    dC *= 1.0 - 0.45 * uWx.z * thick;
  }
  // ---- the cumulus layer (the gliders' cloud base). 2.5-D: the field is read on the base plane and again on a plane
  // ~0.5–1 km higher (a cloud's top is narrower: a higher threshold there), so towards the horizon clouds stand up as
  // stacks with sunlit sides over flat grey bases instead of lying flat as smears
  vec3 cC = vec3(0.0); float cA = 0.0;
  float Hc = uCu.w - cp.y;
  if (uCu.x + uCu.y + uCu.z > 0.004 && Hc * d.y > 0.0) {
    float t = Hc / d.y;
    vec2 P = cp.xz + d.xz * t;
    float cov = covAt(uCu, P);
    if (uWx.w > 0.0) cov *= 0.4 + 0.6 * smoothstep(uWx.w * 0.6, uWx.w, t);
    vec2 q = (P - uOff.xy) / ${CU_SCALE.toFixed(1)};
    float fine = 1.0 - smoothstep(12000.0, 40000.0, t);
#if CLOUD_Q < 2
    fine *= 0.7;
#endif
    float n = gcCu(q, fine), T = 0.72 - 0.47 * cov;
    float soft = 0.07 + 0.12 * (1.0 - fine);
    float ab = smoothstep(T, T + soft, n), at = 0.0, nt = n;
    float fade = smoothstep(0.0, 0.03, abs(d.y)) * (1.0 - smoothstep(35000.0, 80000.0, t));
#if CLOUD_Q >= 2
    if (Hc > 0.0) {
      float Ht = Hc + 450.0 + 650.0 * cov, tt = Ht / d.y;
      vec2 qt = (cp.xz + d.xz * tt - uOff.xy) / ${CU_SCALE.toFixed(1)};
      nt = gcCu(qt, fine * 0.7);
      at = smoothstep(T + 0.07, T + 0.07 + soft, nt) * (1.0 - smoothstep(35000.0, 90000.0, tt));
    }
#endif
    cA = max(ab, at) * fade;
    if (cA > 0.002) {
      float thick = clamp((n - T) / 0.22, 0.0, 1.0);
      // billows: the detail octaves as relief lit from the sun's side (denser towards the sun = in its own shadow)
#if CLOUD_Q >= 2
      float n2 = gcCu(q + sd * 0.07, fine * 0.5);
      float relief = clamp(0.55 + (n - n2) * 5.0, 0.0, 1.0);
#else
      float relief = 0.55 + 0.25 * (1.0 - thick);
#endif
      float facing = 0.5 - 0.5 * dot(normalize(d.xz + vec2(1e-4)), sd);
      // the base seen from below: grey, darker where the cloud is thick, its rim catching the light
      vec3 baseC = mix(uCuShade * (0.8 + 0.15 * (1.0 - thick)), uCuLit * 0.85, 0.08 + 0.4 * (1.0 - thick) * (1.0 - thick) + relief * 0.14);
      // the side / top seen towards the horizon: lit, with billow relief, brighter when the sun is behind us
      vec3 sideC = mix(uCuShade, uCuLit, clamp(0.35 + 0.65 * relief * (0.55 + 0.45 * facing), 0.0, 1.0));
      float sideK = clamp(at - ab * 0.6, 0.0, 1.0) + (1.0 - abs(d.y)) * 0.35 * ab;
      cC = mix(baseC, sideC, clamp(sideK, 0.0, 1.0));
      if (Hc < 0.0) cC = mix(uCuShade, uCuLit, 0.6 + 0.4 * relief);            // from above: the tops
      cC += uSunCol * cs8 * (1.0 - thick) * 1.6;                                // silver lining
      cC += uSunCol * uLow.x * (0.25 + 0.75 * max(dot(normalize(d.xz + vec2(1e-4)), sd), 0.0)) * (0.3 + 0.7 * thick) * 0.6;   // pink undersides at dusk
      cC *= 1.0 - 0.6 * uWx.z * (0.45 + 0.55 * thick);
      cC += uGlowCol * (0.6 + 0.8 * thick);
    }
  }
  // composite: the higher layer behind the lower one (seen from below; the other way round from above)
  bool cuLow = (uCu.w < uSt.w) == (cp.y < uCu.w);
  if (cuLow) { col = mix(col, dC, dA); col = mix(col, cC, cA); } else { col = mix(col, cC, cA); col = mix(col, dC, dA); }
  aAll = 1.0 - (1.0 - dA) * (1.0 - cA);
#if CLOUD_Q >= 2
  if (uBow.y > 0.0 && h > 0.0 && h < 0.3 && cp.y < uCu.w) {
    // showers in the distance: grey shafts of rain hanging under the thick cores of the cumulus. The view ray is cut
    // at three heights below the cloud base and the field read above each (coarse octaves only)
    float fall = 0.0;
    for (int i = 0; i < 3; i++) {
      float hh = (uCu.w - cp.y) * (0.3 + 0.3 * float(i)), t = hh / max(h, 0.012);
      vec2 P = cp.xz + d.xz * t;
      float cov = covAt(uCu, P), T = 0.72 - 0.47 * cov;
      float n = gcCu((P - uOff.xy) / ${CU_SCALE.toFixed(1)}, 0.0);
      // streaks: thinner and thicker fall, fixed to the cloud
      fall += smoothstep(T + 0.06, T + 0.2, n) * (1.0 - smoothstep(12000.0, 30000.0, t)) * smoothstep(1200.0, 3000.0, t);
    }
    // streaks: the shafts hang in vertical strands (by bearing, so they stand upright on the screen), slanting a little
    float az = atan(d.z, d.x) + h * 0.35;
    float strand = 0.5 + 0.5 * gcN(vec2(az * 70.0, 2.0)) * (0.6 + 0.4 * gcN(vec2(az * 19.0, 7.0)));
    fall = clamp(fall * 0.8 * uBow.y * strand, 0.0, 0.8) * smoothstep(0.0, 0.02, h) * (1.0 - smoothstep(0.13, 0.29, h));
    col = mix(col, mix(uCuShade * 0.62, uHor, 0.18), fall);
  }
#endif
  if (uBow.x > 0.0 && h > 0.0) {
    // the primary bow: 42 degrees round the point opposite the sun, red outside, violet inside; brightest low down
    // against the cloud the rain is falling from
    float ca = dot(d, -uSunDir), ang = acos(clamp(ca, -1.0, 1.0)) * 57.2958;
    float x = (ang - 40.4) / 2.2;
    if (x > -0.3 && x < 1.3) {
      vec3 bow = clamp(vec3(1.5 - abs(x - 0.82) * 3.2, 1.5 - abs(x - 0.5) * 3.2, 1.5 - abs(x - 0.18) * 3.2), 0.0, 1.0);
      float env = smoothstep(-0.3, 0.1, x) * (1.0 - smoothstep(0.9, 1.3, x));
      col += bow * env * uBow.x * 0.5 * (0.35 + 0.65 * aAll) * (1.0 - smoothstep(0.0, 0.55, h)) * smoothstep(0.0, 0.04, h) * (0.5 + 0.5 * dot(uSunCol, vec3(0.33)));
    }
  }
  col += vec3(0.7, 0.76, 1.0) * uFlash * (0.25 + 1.2 * aAll);
  if (uNight > 0.01 && h > 0.0 && aAll < 0.9) {
    vec3 sp = d * 230.0;
    vec3 id = floor(sp);
    vec3 f = fract(sp) - 0.5;
    float r = sHash(id);
    if (r > 0.99) {
      float s = (1.0 - smoothstep(0.0, 0.3, length(f))) * (r - 0.99) / 0.01;
      float tw = 0.65 + 0.35 * sin(uTime * 2.7 + r * 117.0);
      col += vec3(0.9, 0.94, 1.0) * s * tw * uNight * smoothstep(0.02, 0.25, h) * 2.0 * (1.0 - aAll);
    }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // the haze band: exactly the colour the scene fog uses (same uniforms, same space), so the far city melts into it
  float hz = exp(-max(h, 0.0) * 11.0 * (1.0 - 0.8 * uLow.y)) * (1.0 - disc);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeBase + uHazeSun * cs2, hz);
}`;

/** Display value (sRGB-encoded, 0..1) -> the linear scene value that three's ACES curve maps to it (per channel, bisection). */
function acesInv(d) {
  const lin = d <= 0.04045 ? d / 12.92 : Math.pow((d + 0.055) / 1.055, 2.4);
  let lo = 0, hi = 12;
  for (let i = 0; i < 18; i++) { const v = (lo + hi) / 2, y = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081); if (y < lin) lo = v; else hi = v; }
  return (lo + hi) / 2;
}

export function createSky(game) {
  const scene = game.worldScene;
  scene.background = null;
  installHaze();
  scene.fog = new THREE.FogExp2(0xb8d2ec, 0.0008);

  installCloudShadows();
  const skyU = {
    uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uHazeBase: { value: new THREE.Vector3() }, uHazeSun: { value: HAZE_SKY },
    uSunDir: U.sunDir, uMoonDir: U.moonDir, uSunCol: { value: new THREE.Color() }, uNight: U.night, uTime: U.time, uGlow: { value: 1 },
    uCu: { value: new THREE.Vector4(0, 0, 0, 1100) }, uSt: { value: new THREE.Vector4(0, 0, 0, 3000) }, uOff: { value: new THREE.Vector4() }, uWx: { value: new THREE.Vector4(1, 0, 0, 0) },
    uCuLit: { value: new THREE.Color(1, 1, 1) }, uCuShade: { value: new THREE.Color(0.5, 0.55, 0.62) }, uDeckCol: { value: new THREE.Color(0.4, 0.42, 0.45) }, uGlowCol: { value: new THREE.Color(0, 0, 0) },
    uLow: { value: new THREE.Vector2() }, uFlash: { value: 0 }, uBow: { value: new THREE.Vector2() },
  };
  // graphics pass 8 (weather): the dome is drawn AFTER the opaque city, depth-tested at the far plane, so its cloud
  // layers are shaded only where sky shows (a street view pays for a strip of sky, not the whole screen)
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false, defines: { CLOUD_Q: 2 },
  });
  skyMat.name = 'world:sky';
  const dome = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), skyMat);
  dome.name = 'world:sky'; dome.scale.setScalar(1500); dome.renderOrder = 100000; dome.frustumCulled = false;
  scene.add(dome);
  // the cloud-top deck under a glider above a layer (aerial only, added on demand)
  let deck = null;
  /**
   * The weather's say in the sky (systems/weather.js writes it every frame; with no weather system it stays clear):
   * coverage triples [an hour ago, now, an hour ahead], layer heights (m), precipitation, fog, ground mist near water,
   * storm darkness, the lightning flash, cloud drift (m), wind unit vector, the near-fade radius of the gliders' own
   * 3-D cumulus, and whether the ground draws cloud shadows per pixel (else the low tier dims the sun under a cloud).
   */
  const WX = { cu: [0, 0, 0], cuBase: 1100, st: [0, 0, 0], stBase: 3000, rain: 0, dark: 0, fog: 0, mist: 0, flash: 0, snow: 0, off: [0, 0, 0, 0], wind: [1, 0], nearFade: 0, outdoors: true, bow: 0, shafts: 0 };
  const ocZen = new THREE.Color(), ocHor = new THREE.Color(), cTmp = new THREE.Color();
  const OC = { dayZ: new THREE.Color(0.40, 0.42, 0.45), dayH: new THREE.Color(0.50, 0.51, 0.53), duskZ: new THREE.Color(0.085, 0.085, 0.10), duskH: new THREE.Color(0.20, 0.155, 0.14), nightZ: new THREE.Color(0.010, 0.010, 0.012), nightH: new THREE.Color(0.019, 0.016, 0.014) };
  let cpuShade = 0, perPixelShadows = true;
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.name = 'world:sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  const sc = sun.shadow.camera;
  sc.left = -SHADOW_BOX; sc.right = SHADOW_BOX; sc.top = SHADOW_BOX; sc.bottom = -SHADOW_BOX; sc.near = 5; sc.far = 800;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6b6250, 0.9);
  hemi.name = 'world:hemi';
  scene.add(hemi);

  // scratch (no per-frame allocation)
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tgt = new THREE.Vector3();
  const cA = new THREE.Color(), tmp = new THREE.Color(), hzB = new THREE.Color(), hzS = new THREE.Color();
  const out = { zen: new THREE.Color(), hor: new THREE.Color(), gnd: new THREE.Color(), sunC: new THREE.Color(), sunI: 0, hemiS: new THREE.Color(), hemiG: new THREE.Color(), hemiI: 0, fog: 0, exp: 1 };
  const state = { sunEl: 0, moonEl: 0, night: 0, exposure: 1, dark: false };
  // for the post chain (post.js): the colour grade of the hour and the weather, and the sun shafts
  const grade = { warm: new THREE.Color(1.03, 1.0, 0.95), cool: new THREE.Color(-0.002, 0.0, 0.004), sat: 1.06, ao: 0.8 };
  const shafts = { k: 0, dir: sunDir0(), col: new THREE.Color(), gain: 0.6 };
  function sunDir0() { return new THREE.Vector3(0, 1, 0); }

  function celestial(hourAngle, decl, v) {
    const ch = Math.cos(hourAngle), sh = Math.sin(hourAngle), cd = Math.cos(decl), sd = Math.sin(decl);
    const east = -cd * sh, north = Math.cos(LAT) * sd - Math.sin(LAT) * cd * ch, upc = Math.sin(LAT) * sd + Math.cos(LAT) * cd * ch;
    v.set(east, upc, -north).normalize();
    return Math.asin(clamp(upc, -1, 1)) * 180 / Math.PI;
  }
  function palette(el) {
    let i = 0; while (i < KEYS.length - 2 && el > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = clamp((el - a[0]) / (b[0] - a[0]), 0, 1);
    out.zen.copy(a[1]).lerp(b[1], t); out.hor.copy(a[2]).lerp(b[2], t); out.gnd.copy(a[3]).lerp(b[3], t);
    out.sunC.copy(a[4]).lerp(b[4], t); out.sunI = a[5] + (b[5] - a[5]) * t;
    out.hemiS.copy(a[6]).lerp(b[6], t); out.hemiG.copy(a[7]).lerp(b[7], t); out.hemiI = a[8] + (b[8] - a[8]) * t;
    out.fog = a[9] + (b[9] - a[9]) * t; out.exp = a[10] + (b[10] - a[10]) * t;
  }

  function update(dt) {
    const hour = game.time.hour;
    const daylight = game.time.daylight;
    U.time.value += dt;
    const el = celestial(((hour - 13) / 24) * Math.PI * 2, DECL, sunDir);
    const mel = celestial(((hour - 1) / 24) * Math.PI * 2, MOON_DECL, moonDir);
    state.sunEl = el; state.moonEl = mel;
    palette(el);
    const W = WX, ov = clamp(W.st[1], 0, 1), dayF = smoothstep(-6, 8, el), fogW = W.fog, dark = W.dark, outdoors = game.scene === game.worldScene;
    // ---- weather (graphics pass 8): under a deck the sky itself goes grey — and so do the water and the windows that
    // mirror U.skyZen / skyHor — grey-pink at dusk, sodium-grey at night (Oxford's cloud glows orange over the city)
    {
      const kd = smoothstep(-12, -2, el), ky = smoothstep(-2, 12, el);
      ocZen.copy(OC.nightZ).lerp(OC.duskZ, kd).lerp(OC.dayZ, ky).multiplyScalar(1 - 0.45 * dark);
      ocHor.copy(OC.nightH).lerp(OC.duskH, kd).lerp(OC.dayH, ky).multiplyScalar(1 - 0.35 * dark);
      const skyK = Math.max(ov * 0.95, Math.min(1, 1.1 * fogW) * dayF, 0.3 * dark);
      if (skyK > 0) { out.zen.lerp(ocZen, skyK); out.hor.lerp(ocHor, skyK * 0.92); }
    }
    const night = clamp(1 - daylight, 0, 1);
    state.night = night; state.dark = night > 0.5;
    U.night.value = night;
    U.sunDir.value.copy(sunDir); U.moonDir.value.copy(moonDir);
    // (what water, wet roads and windows mirror where nothing on the screen can be: set below, once the clouds' colours are known)
    // lit windows: busy in the evening, fewer after midnight
    const h = hour;
    // (night windows pass: by kind of building — houses, college rooms, shops / offices — materials.js setLitShares)
    setLitShares(h);

    skyU.uZen.value.copy(out.zen); skyU.uHor.value.copy(out.hor);
    skyU.uSunCol.value.copy(out.sunC).multiplyScalar(smoothstep(-9, 0, el));
    skyU.uGlow.value = 1 + 2.5 * (1 - smoothstep(0, 18, el));
    U.sunColor.value.copy(out.sunC);

    // directional light: sun by day, moon by night (crossfade through ~0 at twilight)
    const moonI = 0.6 * smoothstep(-5, -11, el) * smoothstep(0, 8, mel);
    if (el > -3) { lightDir.copy(sunDir); sun.color.copy(out.sunC); sun.intensity = out.sunI; }
    else { lightDir.copy(moonDir); sun.color.setRGB(0.45, 0.6, 1.0); sun.intensity = moonI; }
    if (lightDir.y < 0.05) { lightDir.y = 0.05; lightDir.normalize(); }
    hemi.color.copy(out.hemiS); hemi.groundColor.copy(out.hemiG); hemi.intensity = out.hemiI;
    // ---- weather light: the sun behind the deck (and, on the low tier, behind the cumulus passing over the player),
    // soft or no shadows, a brighter and greyer sky fill, a little more exposure so an overcast day reads grey and
    // flat rather than merely dim; the lightning flash
    const sunUpW = smoothstep(-4, 6, el), cuNow = W.cu[1], tq = cuThreshold(cuNow), sy = Math.max(0.12, sunDir.y);
    {
      let want = 0;
      if (!perPixelShadows && cuNow > 0.02 && sunUpW > 0 && outdoors) {
        const p = game.player ? (game.player.place === 'world' || !game.player.worldPos ? game.player.pos : game.player.worldPos) : (game.eye || game.camera.position);
        const n = cuFieldCPU((p.x + (sunDir.x / sy) * W.cuBase - W.off[0]) / CU_SCALE, (p.z + (sunDir.z / sy) * W.cuBase - W.off[1]) / CU_SCALE);
        want = smoothstep(tq, tq + 0.1, n) * (1 - ov) * sunUpW * smoothstep(0.02, 0.1, cuNow);
      }
      cpuShade += (want - cpuShade) * Math.min(1, dt * 1.3);
    }
    sun.intensity *= (1 - 0.93 * ov) * (1 - 0.6 * fogW) * (1 - 0.4 * dark) * (1 - 0.62 * cpuShade);
    const shI = clamp(1 - 1.15 * ov, 0, 1) * (1 - 0.75 * fogW) * (1 - 0.5 * cpuShade);
    sun.shadow.intensity = shI;
    if (ov > 0 || fogW > 0) {
      hemi.color.lerp(cTmp.setRGB(0.78, 0.8, 0.84), ov * 0.75 * dayF);
      hemi.groundColor.lerp(cTmp.setRGB(0.34, 0.32, 0.3), ov * 0.7 * dayF);
      hemi.intensity *= (1 + (0.55 * ov + 0.25 * fogW) * dayF) * (1 - 0.3 * dark);
      out.exp *= 1 + (0.36 * ov + 0.1 * fogW) * dayF;
    }
    hemi.intensity += W.flash * 2.2;
    state.exposure = out.exp;
    // ---- aerial perspective. Away from the sun the haze is the horizon colour pulled towards the zenith blue; towards
    // the sun it warms to the sun's own colour (strongly when it is low). The colours are designed in display space and
    // handed to the fog and to the sky's horizon band in whatever space this frame mixes fog in: sRGB after tone mapping
    // when rendering straight to the screen, linear before tone mapping under the 'high' tier's post pass.
    const low = 1 - smoothstep(4, 32, el), sunUp = smoothstep(-7, 1, el);
    hzB.copy(out.hor).lerp(out.zen, 0.22 + 0.2 * (1 - low));
    hzS.copy(out.hor).lerp(out.sunC, 0.45).multiplyScalar(1.0 + 0.25 * low).lerp(hzB, 1 - (0.3 + 0.6 * low) * sunUp);
    // mist and fog: a pale grey-white haze (the sun still warms it on its side); inside the deck (a glider climbing
    // into an overcast) a white-out in the deck's own colour
    const camY = (game.eye || game.camera.position).y;
    const inDeck = W.st[1] * smoothstep(W.stBase - 90, W.stBase - 10, camY) * (1 - smoothstep(W.stBase + 25, W.stBase + 110, camY));
    if (fogW > 0) { cTmp.copy(ocHor).multiplyScalar(1.18); hzB.lerp(cTmp, fogW * 0.8); hzS.lerp(cTmp, fogW * 0.5); }
    if (inDeck > 0) { cTmp.copy(ocZen).lerp(ocHor, 0.4); hzB.lerp(cTmp, inDeck); hzS.lerp(cTmp, inDeck); }
    const post = !!game.postRender && game.scene === game.worldScene;
    hzB.getRGB(tmp, THREE.SRGBColorSpace); hzS.getRGB(cA, THREE.SRGBColorSpace);
    // (lighting and buildings, 2026-11-24: what the MATERIALS mix in towards the sun is held to a display value of
    //  HAZE_TOP before it is turned into a scene value. At sunrise and sunset the designed colour reaches 1.0 in red, the
    //  tone curve's inverse there is 12 (it is 1.3 at 0.86), and a wall 30 m away in a shut quad — 4 % haze — was washed
    //  red by it: the "sun" in the air of a place the sun cannot reach. The sky's own band keeps the full colour.)
    let sR = cA.r, sG = cA.g, sB = cA.b;
    if (post) {
      const k = out.exp / 0.6;
      sR = acesInv(Math.min(cA.r, HAZE_TOP)) / k; sG = acesInv(Math.min(cA.g, HAZE_TOP)) / k; sB = acesInv(Math.min(cA.b, HAZE_TOP)) / k;
      tmp.setRGB(acesInv(tmp.r) / k, acesInv(tmp.g) / k, acesInv(tmp.b) / k); cA.setRGB(acesInv(cA.r) / k, acesInv(cA.g) / k, acesInv(cA.b) / k);
      scene.fog.color.setRGB(tmp.r, tmp.g, tmp.b);                         // already linear: used as is in the HDR target
    } else scene.fog.color.copy(hzB);                                       // three converts to sRGB for the screen
    skyU.uHazeBase.value.set(tmp.r, tmp.g, tmp.b);
    const hk = 1 - 0.85 * ov;
    HAZE_SKY[0] = (cA.r - tmp.r) * hk; HAZE_SKY[1] = (cA.g - tmp.g) * hk; HAZE_SKY[2] = (cA.b - tmp.b) * hk;
    HAZE.sunCol[0] = (sR - tmp.r) * hk; HAZE.sunCol[1] = (sG - tmp.g) * hk; HAZE.sunCol[2] = (sB - tmp.b) * hk;
    const hd = el > -6 ? sunDir : moonDir;
    HAZE.sunDir[0] = hd.x; HAZE.sunDir[1] = hd.y; HAZE.sunDir[2] = hd.z;
    // visibility: ~2.5 km on a clear day, ~1 km in heavy rain, ~250 m in thick fog
    let fd = out.fog * fogBoost * (1 + 0.5 * ov + 1.6 * W.rain);
    if (fogW > 0) fd = Math.max(fd, 0.0125 * Math.pow(fogW, 1.4));
    if (inDeck > 0) fd = Math.max(fd, 0.035 * inDeck);
    scene.fog.density = fd;
    // low ground mist by the river and the meadows (height fog in every fogged material: towers stand out of it)
    HAZE.mist[0] = outdoors ? W.mist * 0.05 : 0; HAZE.mist[1] = 7 + 12 * W.mist; HAZE.mist[2] = 0;

    // ---- the cloud layers
    skyU.uCu.value.set(W.cu[0], W.cu[1], W.cu[2], W.cuBase); skyU.uSt.value.set(W.st[0], W.st[1], W.st[2], W.stBase);
    skyU.uOff.value.set(W.off[0], W.off[1], W.off[2], W.off[3]); skyU.uWx.value.set(W.wind[0], W.wind[1], dark, W.nearFade);
    {
      const moonUp = smoothstep(0, 10, mel) * night;
      skyU.uCuLit.value.copy(out.sunC).multiplyScalar(1.3 * sunUpW).add(cTmp.copy(out.hor).multiplyScalar(0.55)).add(cTmp.copy(out.zen).multiplyScalar(0.12)).add(cTmp.setRGB(0.05, 0.055, 0.075).multiplyScalar(moonUp));
      skyU.uCuShade.value.copy(out.hor).multiplyScalar(0.5).add(cTmp.copy(out.zen).multiplyScalar(0.1)).add(cTmp.setRGB(0.07, 0.06, 0.05).multiplyScalar(dayF));
      skyU.uDeckCol.value.copy(ocZen).lerp(ocHor, 0.35);
      // storm cloud: heavy showers and thunder go slate grey underneath, the lit towers dimmer too
      skyU.uCuLit.value.multiplyScalar(1 - 0.5 * dark); skyU.uCuShade.value.multiplyScalar(1 - 0.55 * dark); skyU.uDeckCol.value.multiplyScalar(1 - 0.25 * dark);
      skyU.uGlowCol.value.setRGB(0.02, 0.013, 0.007).multiplyScalar(night * (1 - 0.3 * dark));
      skyU.uLow.value.set(smoothstep(9, 1, el) * smoothstep(-7, -1, el), clamp(fogW + 0.5 * W.rain + 0.5 * inDeck, 0, 1));
      skyU.uFlash.value = W.flash;
      // the rainbow needs the sun out and under 42 degrees; the rain shafts need daylight to be seen
      skyU.uBow.value.set(outdoors ? W.bow * smoothstep(0, 4, el) * smoothstep(41, 30, el) * (1 - ov) : 0, outdoors ? W.shafts * dayF * (1 - fogW) : 0);
    }
    // ---- the grade and the sun shafts (post chain)
    {
      const gold = smoothstep(26, 6, el) * smoothstep(-6, 2, el), nt = night, flat = Math.max(ov * dayF, fogW);
      grade.warm.setRGB(1.03 + 0.045 * gold - 0.02 * flat - 0.01 * nt, 1.0, 0.95 - 0.045 * gold + 0.03 * flat + 0.02 * nt);
      grade.cool.setRGB(-0.002 - 0.0015 * gold, 0.0008 * gold + 0.0004 * nt, 0.004 + 0.004 * gold + 0.002 * nt);
      grade.sat = 1.06 + 0.04 * gold - 0.12 * flat - 0.03 * nt;
      grade.ao = 0.75 + 0.15 * flat - 0.2 * nt;
      const lowS = smoothstep(40, 8, el);
      shafts.k = outdoors ? smoothstep(-1.5, 2.5, el) * (1 - 0.92 * ov) * (1 - 0.5 * dark) * (0.1 + 0.2 * lowS + 0.4 * Math.min(1, fogW * 1.5 + W.mist)) : 0;
      shafts.dir.copy(sunDir); shafts.col.copy(out.sunC).multiplyScalar(0.5); shafts.gain = 0.4;
    }
    // the mirrored sky (materials.js: water, wet ground, glass; post.js: the reflections' fallback): the dome's
    // gradient with the cumulus folded in by its cover, so a broken sky at dusk mirrors pink-grey, not clear blue
    {
      const k = clamp(cuNow, 0, 1);
      cTmp.copy(skyU.uCuShade.value).lerp(skyU.uCuLit.value, 0.45);
      U.skyZen.value.copy(out.zen).lerp(cTmp, 0.55 * k); U.skyHor.value.copy(out.hor).lerp(cTmp, 0.4 * k);
    }
    // cloud shadows on the ground (every lit material: clouds.js), direct light only
    CLOUD_SH.A[0] = W.off[0]; CLOUD_SH.A[1] = W.off[1]; CLOUD_SH.A[2] = tq;
    CLOUD_SH.A[3] = perPixelShadows && outdoors ? 0.72 * sunUpW * (1 - ov) * smoothstep(0.02, 0.1, cuNow) * (1 - fogW) * (1 - dark) : 0;
    CLOUD_SH.B[0] = sunDir.x / sy; CLOUD_SH.B[1] = sunDir.z / sy; CLOUD_SH.B[2] = W.cuBase; CLOUD_SH.B[3] = 1 / CU_SCALE;
    // the cloud-top deck under a glider that has climbed above a layer
    {
      const kind = W.st[1] > 0.08 && camY > W.stBase + 2 ? 1 : cuNow > 0.03 && camY > W.cuBase + 2 ? 0 : -1;
      if (kind >= 0 && outdoors) {
        if (!deck) deck = createDeck(skyU);
        const du = deck.material.uniforms;
        du.uKind.value = kind; du.uCov.value = kind ? W.st[1] : cuNow; du.uFine.value = perPixelShadows ? 1 : 0;
        du.uTop.value.copy(skyU.uCuLit.value).multiplyScalar(0.95); du.uSide.value.copy(skyU.uCuShade.value);
        deck.position.set((game.eye || game.camera.position).x, kind ? W.stBase : W.cuBase, (game.eye || game.camera.position).z); deck.updateMatrixWorld();
        if (!deck.parent) scene.add(deck);
      } else if (deck && deck.parent) deck.removeFromParent();
    }

    // shadow frustum follows the player, snapped to shadow texels in light space so edges don't shimmer
    if (air) airShadow(dt); else {
    // no shadows to see (a full deck, thick fog): the shadow map is not re-rendered at all
    const rr = game.renderer;
    if (rr && rr.shadowMap) { const want = shI > 0.015; if (want !== rr.shadowMap.autoUpdate) { rr.shadowMap.autoUpdate = want; if (want) rr.shadowMap.needsUpdate = true; } }
    const p = game.player && game.player.place === 'world' ? game.player.pos : (game.eye || game.camera.position);      // (indoors: the eye, in world coordinates)
    ax.crossVectors(up, lightDir).normalize(); ay.crossVectors(lightDir, ax);
    const texel = (SHADOW_BOX * 2) / SHADOW_MAP;
    const px = Math.round(p.dot(ax) / texel) * texel, py = Math.round(p.dot(ay) / texel) * texel, pz = p.dot(lightDir);
    tgt.set(0, 0, 0).addScaledVector(ax, px).addScaledVector(ay, py).addScaledVector(lightDir, pz);
    sun.target.position.copy(tgt);
    sun.position.copy(tgt).addScaledVector(lightDir, 350);
    sun.target.updateMatrixWorld();
    }

    // dome follows camera
    dome.position.copy((game.eye || game.camera.position)); dome.updateMatrixWorld();

    // exposure only while outdoors (interiors share the renderer)
    const r = game.renderer;
    if (r) {
      game.outExposure = out.exp;      // (core/interiors.js draws the world through a walk-in room's windows at this exposure)
      const want = game.scene === game.worldScene ? out.exp : 1.0;
      if (Math.abs(r.toneMappingExposure - want) > 1e-4) r.toneMappingExposure = want;
    }
  }
  // ---- aerial mode only (world.setAerial -> setAir): ONE big shadow box over the city under the glider instead of the
  // small box round the player, so roofs throw shadows into the streets and quads from the air. The map is re-rendered
  // only when the box has to move (the glider has flown a quarter of it), the sun has moved or the size changed — not
  // every frame — and the light is moved only then, so the shadows stay put in between. air = {half, x, z} | null.
  let air = null, airDrawn = null, airT = 0;
  const airDir = new THREE.Vector3();
  function setAir(a) {
    const r = game.renderer;
    if (!a) {
      if (!air) return;
      air = null; airDrawn = null;
      sc.left = -SHADOW_BOX; sc.right = SHADOW_BOX; sc.top = SHADOW_BOX; sc.bottom = -SHADOW_BOX; sc.far = 800; sc.updateProjectionMatrix();
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
      if (r && r.shadowMap) { r.shadowMap.autoUpdate = true; r.shadowMap.needsUpdate = true; }
      return;
    }
    if (!air) air = { half: 0, x: 0, z: 0 };
    air.half = a.half; air.x = a.x; air.z = a.z;
  }
  function airShadow(dt) {
    const r = game.renderer, d = airDrawn;
    airT += dt;
    // the light direction shades every surface, so it follows the sun each frame; only the shadow camera waits
    const moved = !d || d.half !== air.half || Math.hypot(d.x - air.x, d.z - air.z) > air.half * 0.25 || airDir.dot(lightDir) < 0.99996 || airT > 4;
    if (!moved) { sun.position.copy(sun.target.position).addScaledVector(airDir, airDrawn.dist); return; }
    airT = 0; airDir.copy(lightDir);
    const H = air.half, dist = 500 + H * 2.2;
    if (!d || d.half !== H) {
      sc.left = -H; sc.right = H; sc.top = H; sc.bottom = -H; sc.far = dist * 2; sc.updateProjectionMatrix();
      sun.shadow.bias = -0.3 / sc.far; sun.shadow.normalBias = Math.max(0.035, (H * 2 / SHADOW_MAP) * 1.6);
    }
    ax.crossVectors(up, lightDir).normalize(); ay.crossVectors(lightDir, ax);
    const texel = (H * 2) / SHADOW_MAP;
    tgt.set(air.x, 0, air.z);
    const px = Math.round(tgt.dot(ax) / texel) * texel, py = Math.round(tgt.dot(ay) / texel) * texel, pz = tgt.dot(lightDir);
    tgt.set(0, 0, 0).addScaledVector(ax, px).addScaledVector(ay, py).addScaledVector(lightDir, pz);
    sun.target.position.copy(tgt);
    sun.position.copy(tgt).addScaledVector(lightDir, dist);
    sun.target.updateMatrixWorld();
    airDrawn = { half: H, x: air.x, z: air.z, dist };
    if (r && r.shadowMap) { r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = true; }
  }
  let fogBoost = 1;
  /** quality tier: shadow box half-size (m) and map size; cloud layer on/off; fog multiplier (low tier hides the cull) */
  function setQuality(t) {
    if (t.shadowBox !== SHADOW_BOX || t.shadowMap !== SHADOW_MAP) {
      SHADOW_BOX = t.shadowBox; SHADOW_MAP = t.shadowMap;
      if (air) airDrawn = null; else { sc.left = -SHADOW_BOX; sc.right = SHADOW_BOX; sc.top = SHADOW_BOX; sc.bottom = -SHADOW_BOX; sc.updateProjectionMatrix(); }
      sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    // cloud layers: the full shader (detail octaves, self-shadowing) where the tier has clouds, a cheaper one otherwise
    // (the low tier, the governor's "clouds off" rung); per-pixel cloud shadows on medium / high only
    const cq = t.clouds ? 2 : 1;
    if (skyMat.defines.CLOUD_Q !== cq) { skyMat.defines.CLOUD_Q = cq; skyMat.needsUpdate = true; }
    perPixelShadows = !!t.clouds && t.name !== 'low';
    fogBoost = t.fogBoost || 1;
  }
  return { update, sun, hemi, dome, sunDir, moonDir, state, palette: out, grade, shafts, setQuality, setAir, weather: WX, uniforms: skyU, get deck() { return deck; }, get perPixelShadows() { return perPixelShadows; }, get shadowMapSize() { return SHADOW_MAP; } };
}
