// Weather effects that need three.js (systems/weather.js owns them):
//   Precip  rain streaks, drizzle, snowflakes and ground splashes in ONE instanced draw: a box of drops round the
//           camera, positioned entirely in the vertex shader from a per-drop seed and the time (no CPU work per drop,
//           nothing uploaded per frame — a handful of uniforms and the instance count). Streaks are stretched along
//           their velocity relative to the air (wind-slanted), at least a pixel wide; flakes flutter; splashes flash
//           where drops hit the ground near the player. A dry circle round the player under an arch / a roof.
//           In the scene only while something falls: 0 draws when dry.
//   icon()  the HUD weather glyph (a small inline SVG per state, day / night)
import * as THREE from 'three';

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const VS = /* glsl */`
attribute vec4 aSeed;
uniform float uT;
uniform vec3 uCam;
uniform vec3 uBox;
uniform float uFall;
uniform vec2 uWind;
uniform float uLen;
uniform float uWidth;
uniform float uSnow;
uniform vec4 uDry;      // player x, z, dry radius, on (0/1)
uniform float uGround;
uniform float uSplash;  // 0..1 share of splash instances in use
varying vec2 vQ;
varying float vA;
varying float vKind;
void main() {
  float sp = 0.8 + 0.4 * fract(aSeed.w * 7.31);
  bool splash = aSeed.w > 0.86 && uSnow < 0.5;
  vec3 vel = vec3(uWind.x, -uFall * sp, uWind.y);
  vec3 lo = uCam - uBox * vec3(0.5, 0.42, 0.5);
  vec3 p;
  float a = 1.0, ph = 0.0;
  vQ = position.xy;
  if (!splash) {
    p = aSeed.xyz * uBox + vel * uT;
    p.x += uSnow * (sin(uT * 0.9 + aSeed.w * 40.0) * 0.5 + sin(uT * 2.3 + aSeed.y * 21.0) * 0.15);
    p.z += uSnow * (cos(uT * 0.7 + aSeed.x * 30.0) * 0.5 + sin(uT * 1.9 + aSeed.z * 17.0) * 0.15);
    p = mod(p - lo, uBox) + lo;
    vKind = uSnow > 0.5 ? 1.0 : 0.0;
  } else {
    // a splash: a fresh spot on the ground every cycle, near the player
    float cyc = uT * (2.2 + aSeed.y) + aSeed.z * 13.0, ci = floor(cyc);
    ph = fract(cyc);
    vec2 r = fract(sin(vec2(ci * 12.9898 + aSeed.x * 78.233, ci * 39.346 + aSeed.y * 11.135)) * 43758.5453);
    p = vec3(uCam.x + (r.x - 0.5) * uBox.x * 0.55, uGround + 0.015, uCam.z + (r.y - 0.5) * uBox.z * 0.55);
    a = (1.0 - ph) * step(ph, 0.5) * step(fract(aSeed.w * 13.7), uSplash);
    vKind = 2.0;
  }
  vec3 rel = p - uCam;
  a *= 1.0 - smoothstep(0.34, 0.5, max(abs(rel.x) / uBox.x, abs(rel.z) / uBox.z));
  a *= 1.0 - smoothstep(0.42, 0.58, rel.y / uBox.y);
  a *= smoothstep(0.5, 1.4, length(rel));
  if (uDry.w > 0.5) a *= smoothstep(uDry.z, uDry.z + 1.5, length(p.xz - uDry.xy));
  vA = a;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vec3 pos;
  if (vKind < 0.5) {
    vec3 dv = normalize((viewMatrix * vec4(vel, 0.0)).xyz);
    vec3 side = normalize(cross(dv, normalize(mv.xyz)));
    float w = max(uWidth, -mv.z * 0.0019);
    pos = mv.xyz + side * position.x * w + dv * (position.y - 0.5) * uLen * sp;
  } else if (vKind < 1.5) {
    float s = uWidth * (0.7 + 0.6 * fract(aSeed.w * 3.7));
    s = max(s, -mv.z * 0.0016);
    pos = mv.xyz + vec3(position.x, position.y - 0.5, 0.0) * s;
  } else {
    float s = 0.05 + 0.16 * ph;
    pos = mv.xyz + vec3(position.x * s, position.y * s * 0.55, 0.0);
  }
  if (a < 0.003) pos = vec3(0.0, 0.0, 1e5);   // behind the camera: clipped
  gl_Position = projectionMatrix * vec4(pos, 1.0);
}`;
const FS = /* glsl */`
uniform vec3 uCol;
uniform float uAlpha;
varying vec2 vQ;
varying float vA;
varying float vKind;
void main() {
  float a;
  if (vKind < 0.5) a = (1.0 - abs(vQ.x) * 2.0) * smoothstep(0.0, 0.3, vQ.y) * smoothstep(1.0, 0.55, vQ.y);
  else if (vKind < 1.5) { float r = length(vec2(vQ.x, vQ.y - 0.5)) * 2.0; a = 1.0 - smoothstep(0.35, 1.0, r); a *= 2.2; }
  else { float r = length(vec2(vQ.x * 2.0, vQ.y * 2.0)); a = smoothstep(1.0, 0.75, r) * smoothstep(0.25, 0.6, r) * 1.6; }
  a *= vA * uAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uCol, min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Precip {
  constructor(max = 5000) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const seeds = new Float32Array(max * 4), R = rng(0x5eed);
    for (let i = 0; i < max * 4; i++) seeds[i] = R();
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.u = {
      uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(24, 16, 24) }, uFall: { value: 8 }, uWind: { value: new THREE.Vector2() },
      uLen: { value: 0.5 }, uWidth: { value: 0.012 }, uSnow: { value: 0 }, uDry: { value: new THREE.Vector4() }, uGround: { value: 0 }, uSplash: { value: 0 },
      uCol: { value: new THREE.Color(0.7, 0.72, 0.75) }, uAlpha: { value: 0.3 },
    };
    this.mat = new THREE.ShaderMaterial({ name: 'weather:precip', uniforms: this.u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });   // (a streak's winding depends on the view)
    this.geo = g;
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.name = 'weather:precip'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
    this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    this.t = 0;
  }
  /** count: drops this frame (0 hides); o: {snow, drizzle, wind:[x,z], cam, ground, col, dry:[x,z,r,on], dt} */
  update(scene, count, o) {
    const n = Math.min(this.max, Math.round(count));
    if (n <= 0) { if (this.mesh.parent) this.mesh.removeFromParent(); this.geo.instanceCount = 0; return 0; }
    if (!this.mesh.parent) scene.add(this.mesh);
    const u = this.u, sn = o.snow, dz = o.drizzle * (1 - sn);
    this.t = (this.t + o.dt) % 1000;
    u.uT.value = this.t;
    u.uCam.value.copy(o.cam);
    u.uSnow.value = sn > 0.5 ? 1 : 0;
    // rain ~8 m/s (drizzle ~3), snow ~1 m/s; streak length = the distance fallen in ~1/30 s, a little more in heavy rain
    u.uFall.value = sn > 0.5 ? 1.1 : 8.5 - 5.5 * dz;
    u.uWind.value.set(o.wind[0] * (sn > 0.5 ? 0.6 : 0.35), o.wind[1] * (sn > 0.5 ? 0.6 : 0.35));
    u.uLen.value = sn > 0.5 ? 0 : 0.3 + 0.55 * (1 - dz) * Math.min(1, o.rain * 1.6);
    u.uWidth.value = sn > 0.5 ? 0.035 : 0.007 + 0.006 * (1 - dz);
    u.uAlpha.value = sn > 0.5 ? 0.9 : (0.45 + 0.35 * (1 - dz)) * (0.75 + 0.25 * Math.min(1, o.rain * 2));
    u.uGround.value = o.ground;
    u.uSplash.value = sn > 0.5 ? 0 : Math.min(1, o.rain * 1.4) * (1 - dz);
    u.uCol.value.copy(o.col).multiplyScalar(sn > 0.5 ? 1 : 1.5);
    u.uDry.value.set(o.dry[0], o.dry[1], o.dry[2], o.dry[3]);
    this.geo.instanceCount = n;
    return n;
  }
  remove() { if (this.mesh.parent) this.mesh.removeFromParent(); }
}

// ------------------------------------------------------------------------------------------------ HUD glyph
const SUN = (c = '#ffd34a') => `<circle cx="12" cy="12" r="4.2" fill="${c}"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = (a * Math.PI) / 180; return `<line x1="${12 + Math.cos(r) * 6.6}" y1="${12 + Math.sin(r) * 6.6}" x2="${12 + Math.cos(r) * 9}" y2="${12 + Math.sin(r) * 9}" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/>`; }).join('');
const MOON = '<path d="M15.5 4.5a8 8 0 1 0 4 11.5a6.2 6.2 0 0 1-4-11.5z" fill="#dfe6f5"/>';
const CLOUD = (y = 0, c = '#e8ecf0', s = 1) => `<path transform="translate(${12 - 12 * s} ${y + 12 - 12 * s}) scale(${s})" d="M7 18h10.5a3.8 3.8 0 0 0 .4-7.6A5.4 5.4 0 0 0 7.6 9.3 4.4 4.4 0 0 0 7 18z" fill="${c}" stroke="#2a2e34" stroke-width="0.6"/>`;
const DROPS = (n, c = '#8cc4ff') => Array.from({ length: n }, (_, i) => { const x = 8 + i * (8 / Math.max(1, n - 1)); return `<line x1="${x}" y1="18.6" x2="${x - 1.4}" y2="22.4" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`; }).join('');
const glyphs = {
  clear: (n) => (n ? MOON : SUN()),
  cumulus: (n) => `<g transform="translate(3 -3) scale(0.8)">${n ? MOON : SUN()}</g>` + CLOUD(2, '#f2f4f6', 0.8),
  broken: (n) => `<g transform="translate(4 -4) scale(0.7)">${n ? MOON : SUN()}</g>` + CLOUD(0, '#dfe3e8'),
  overcast: () => CLOUD(-3, '#b8bec6', 0.85) + CLOUD(1, '#d4d8de'),
  drizzle: () => CLOUD(-2, '#c8cdd4') + DROPS(2),
  rain: () => CLOUD(-2, '#aeb4bd') + DROPS(3),
  shower: () => CLOUD(-2, '#8e959f') + DROPS(4, '#6fb0ff'),
  thunder: () => CLOUD(-3, '#7f8690') + '<path d="M12.5 15l-3 5h2.6l-1.6 4 4.6-6h-2.6l1.6-3z" fill="#ffd34a"/>',
  snow: () => CLOUD(-2, '#d8dde3') + [8, 12, 16].map((x, i) => `<circle cx="${x}" cy="${20 + (i % 2) * 2}" r="1.2" fill="#fff"/>`).join(''),
  mist: (n) => `<g transform="translate(4 -5) scale(0.6)" opacity="0.8">${n ? MOON : SUN('#ffe39a')}</g>` + [12, 15.5, 19].map((y, i) => `<line x1="${4 + i}" y1="${y}" x2="${20 - i}" y2="${y}" stroke="#d6dbe0" stroke-width="1.8" stroke-linecap="round"/>`).join(''),
  fog: () => [8, 11.5, 15, 18.5].map((y, i) => `<line x1="${3 + (i % 2) * 2}" y1="${y}" x2="${21 - (i % 2) * 2}" y2="${y}" stroke="#cfd4da" stroke-width="2" stroke-linecap="round"/>`).join(''),
  blustery: () => '<path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" fill="none" stroke="#e8ecf0" stroke-width="1.8" stroke-linecap="round"/>',
  frost: () => '<g stroke="#bfe6ff" stroke-width="1.6" stroke-linecap="round">' + [0, 60, 120].map((a) => { const r = (a * Math.PI) / 180, dx = Math.cos(r) * 8, dy = Math.sin(r) * 8; return `<line x1="${12 - dx}" y1="${12 - dy}" x2="${12 + dx}" y2="${12 + dy}"/>`; }).join('') + '</g>',
};
/** inline SVG (24 × 24) for a state name; night swaps the sun for the moon */
export function icon(state, night = false, px = 24) {
  const f = glyphs[state] || glyphs.clear;
  return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" style="vertical-align:middle;filter:drop-shadow(0 1px 2px #000)">${f(night)}</svg>`;
}
