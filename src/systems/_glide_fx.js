// Gliding effects (visual pass). Everything is created lazily and is in the scene only while in use: nothing costs
// anything on the ground in town. Few shader programs, all compiled ahead of use (gliding.js warms `objects()`):
//   Sprites    ONE instanced, camera-facing quad shader for every soft particle (fire, smoke, sparks, tumbling shards,
//              glows, the city's street lamps from the air): premultiplied blending, so additive fire and alpha smoke
//              share a draw.
//   Boom       action-game explosion: flash, a fireball whose fire rolls over into black smoke, sparks, tumbling debris
//              with smoke trails, a lingering smoke column that leans with the wind, a ground glow, a little fire that
//              burns out, a scorch mark that fades. No lights are added (that would recompile the city). 2 draws.
//              boom.start(x, y, z, size, groundY, seed, trim) / update(dt, cam) / active;  boom.smoulder(x, y, z) wisps
//   Chute      a round emergency parachute: 16 scalloped gores in two colours, apex vent, rigging lines to two risers,
//              breathing, sway and flare. chute.group, chute.set(open 0..1, x, y, z, heading, swingX, swingZ, flare, t)
//   Cable      the winch cable: a sagging line from the winch to the glider's hook, a drogue parachute on the end
//              after release. cable.set(ax, ay, az, bx, by, bz, slack 0..1, drogue) / hide()
//   Clouds     cumulus over the active thermals near the camera: flat bases at the common cloud base, billowing tops,
//              lit by the sun, soft (instanced impostor puffs, one draw). clouds.update(list, on, cam, sunDir, tint)
//   Birds      red kites circling in the strong thermals near the camera (one small dynamic mesh). birds.update(...)
//   Country    the Oxfordshire farmland beyond the map: a patchwork of fields, hedgerows, woods, farms and lanes to the
//              horizon (a ring with a hole where the city ground is; a camera-following plain far out). 1 draw.
//   CityLights the city's street lamps as points of light from the air at night (1 draw, night + aerial only)
//   GroundShadow a soft contact shadow under a glider on the ground
import * as THREE from 'three';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

// deterministic per-effect randomness (cosmetic only, but keep it reproducible for tests)
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function canvas(w, h) { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext && c.getContext('2d'); return g && g.createRadialGradient && g.fillRect ? [c, g] : null; }

/** the gliding materials that the model file does not own (shared, so one program each) */
const SHARED = {};
export function setBodyMaterial(m) { SHARED.body = m; }           // _glide_model's vertex-colour material (alpha = gloss)
function bodyMat() { return SHARED.body || (SHARED.body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); }
function decalMat(tex, opts = {}) { return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -24, ...opts }); }
function lineMat() { return SHARED.line || (SHARED.line = new THREE.LineBasicMaterial({ color: 0x24262a, transparent: true, opacity: 0.9 })); }

// ================================================================ sprites
const GLSL_NOISE = /* glsl */`
float sH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float sN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sH(i), sH(i + vec2(1.0, 0.0)), f.x), mix(sH(i + vec2(0.0, 1.0)), sH(i + vec2(1.0, 1.0)), f.x), f.y); }`;
let SPRITE_MAT = null;
function spriteMat() {
  if (SPRITE_MAT) return SPRITE_MAT;
  SPRITE_MAT = new THREE.ShaderMaterial({
    name: 'glide:sprites', transparent: true, depthWrite: false, fog: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMinPx: { value: 0 } }]),
    vertexShader: /* glsl */`
attribute vec4 iPos;   // centre xyz, size (m)
attribute vec4 iCol;   // premultiplied rgb, alpha
attribute vec4 iMisc;  // rotation, kind (0 soft billow, 1 shard, 2 glow point), seed, x stretch
uniform float uMinPx;
varying vec2 vQ; varying vec4 vCol; varying vec3 vMisc;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = viewMatrix * vec4(iPos.xyz, 1.0);
  float size = iPos.w;
  if (iMisc.y > 1.5) size = max(size, -mvPosition.z * uMinPx);      // points of light never shrink below a pixel or two
  float c = cos(iMisc.x), s = sin(iMisc.x);
  vec2 o = position.xy * vec2(iMisc.w, 1.0);
  mvPosition.xy += vec2(o.x * c - o.y * s, o.x * s + o.y * c) * size;
  vQ = position.xy * 2.0; vCol = iCol; vMisc = iMisc.yzw;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */`
varying vec2 vQ; varying vec4 vCol; varying vec3 vMisc;
#include <common>
#include <fog_pars_fragment>
${GLSL_NOISE}
void main() {
  float d = length(vQ), a;
  vec3 rgb = vCol.rgb;
  if (vMisc.x < 0.5) {
    // a billow: a disc whose edge is eaten by noise, a little lighter on top
    float n = sN(vQ * 1.7 + vMisc.y * 17.0) * 0.6 + sN(vQ * 4.3 + vMisc.y * 5.0) * 0.4;
    a = smoothstep(1.0, 0.3, d + (n - 0.5) * 0.75);
    rgb *= 0.8 + 0.35 * vQ.y * (1.0 - a * 0.5) + 0.25 * (n - 0.5);
  } else if (vMisc.x < 1.5) {
    a = step(abs(vQ.x), 0.96) * step(abs(vQ.y), 0.96);
    rgb *= 0.75 + 0.25 * vQ.y;
  } else {
    a = pow(max(1.0 - d, 0.0), 2.4);
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(rgb * a, vCol.a * a);
#ifdef USE_FOG
  { float ff = 1.0 - exp(-fogDensity * vFogDepth * (1.0 + gtoFog.x * vFogDepth)); gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - ff) + fogColor * gl_FragColor.a * ff; }
#endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  return SPRITE_MAT;
}
class Sprites {
  constructor(max, name) {
    const q = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = q.index; g.setAttribute('position', q.attributes.position);
    this.max = max; this.n = 0;
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.col = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.misc = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    for (const a of [this.pos, this.col, this.misc]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.pos); g.setAttribute('iCol', this.col); g.setAttribute('iMisc', this.misc);
    g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, spriteMat()); this.mesh.frustumCulled = false; this.mesh.name = name; this.mesh.renderOrder = 4;
  }
  begin() { this.n = 0; }
  /** premultiplied colour: (r, g, b) is what is ADDED, a is how much of the background is hidden */
  put(x, y, z, size, r, g, b, a, rot = 0, kind = 0, seed = 0, stretch = 1) {
    if (this.n >= this.max) return;
    const i = this.n++ * 4;
    this.pos.array[i] = x; this.pos.array[i + 1] = y; this.pos.array[i + 2] = z; this.pos.array[i + 3] = size;
    this.col.array[i] = r; this.col.array[i + 1] = g; this.col.array[i + 2] = b; this.col.array[i + 3] = a;
    this.misc.array[i] = rot; this.misc.array[i + 1] = kind; this.misc.array[i + 2] = seed; this.misc.array[i + 3] = stretch;
  }
  end() { this.geo.instanceCount = this.n; this.pos.needsUpdate = this.col.needsUpdate = this.misc.needsUpdate = true; }
}

// ================================================================ explosion
function blotTex(kind) {
  const cg = canvas(128, 128); if (!cg) return null;
  const [c, g] = cg, R = rng(kind === 'scorch' ? 77 : 78);
  if (kind === 'scorch') {
    // a burnt patch: soot thickest in the middle, ragged streaks thrown outwards
    const gr = g.createRadialGradient(64, 64, 3, 64, 64, 62); gr.addColorStop(0, 'rgba(8,7,6,0.95)'); gr.addColorStop(0.45, 'rgba(14,12,10,0.8)'); gr.addColorStop(0.75, 'rgba(20,17,14,0.35)'); gr.addColorStop(1, 'rgba(20,17,14,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(10,9,8,0.5)';
    for (let i = 0; i < 46; i++) { const a = R() * 6.283, r0 = 14 + R() * 20, r1 = r0 + 12 + R() * 30; g.lineWidth = 1 + R() * 4; g.beginPath(); g.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0); g.lineTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1); g.stroke(); }
  } else {
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.3, 'rgba(255,140,50,0.6)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class Boom {
  constructor(scene) {
    this.scene = scene; this.active = false; this.t = 0;
    this.group = new THREE.Group(); this.group.name = 'glide:boom';
    this.sp = new Sprites(640, 'glide:boom:sprites');
    const sc = new THREE.PlaneGeometry(2, 2); sc.rotateX(-Math.PI / 2);
    this.scorchMat = decalMat(blotTex('scorch'), { color: 0xffffff, opacity: 0.9 });
    this.scorch = new THREE.Mesh(sc, this.scorchMat); this.scorch.name = 'glide:boom:scorch'; this.scorch.renderOrder = 2;
    this.glowMat = decalMat(blotTex('glow'), { blending: THREE.AdditiveBlending, opacity: 0, polygonOffsetFactor: -14 });
    this.glow = new THREE.Mesh(sc, this.glowMat); this.glow.name = 'glide:boom:glow'; this.glow.renderOrder = 3;
    this.group.add(this.scorch, this.glow, this.sp.mesh);
    this.P = [];                   // particles
    this.wind = [0, 0];            // m/s (set by the system): the smoke leans with it
    this.wisps = null;             // {x, y, z, until}: a smouldering thing (the thrown-clear pilot)
  }
  objects() { return [this.sp.mesh, this.scorch, this.glow]; }
  start(x, y, z, size = 1, gy = 0, seed = 1, trim = 0xc8202a) {
    const R = rng(seed * 2654435761);
    this.R = R; this.active = true; this.t = 0; this.x = x; this.y = y; this.z = z; this.gy = gy; this.size = size;
    const P = this.P; P.length = 0;
    const low = y - gy < 8;
    // k: 0 fire→smoke billow, 1 smoke column, 2 debris shard, 3 spark, 4 trail puff, 5 flash, 6 ground flame
    P.push({ k: 5, x, y: y + 1, z, vx: 0, vy: 0, vz: 0, s: 46 * size, life: 0.22, t: 0, seed: R() });
    for (let i = 0; i < 22; i++) {
      const a = R() * 6.283, el = low ? R() * 1.2 : (R() - 0.5) * 2.4, sp = (5 + R() * 13) * size, ce = Math.cos(el);
      P.push({ k: 0, x: x + Math.cos(a) * R() * 1.5, y: y + 0.6 + R() * 1.5, z: z + Math.sin(a) * R() * 1.5, vx: Math.cos(a) * ce * sp, vy: Math.abs(Math.sin(el)) * sp * 0.9 + 3, vz: Math.sin(a) * ce * sp, s: (3.4 + R() * 3.2) * size, life: 2.8 + R() * 2.4, t: -R() * 0.12, rot: R() * 6.283, spin: (R() - 0.5) * 1.6, seed: R() });
    }
    for (let i = 0; i < 44; i++) P.push({ k: 1, x: x + (R() - 0.5) * 2.5, y: Math.max(gy + 0.5, y - 0.5) + R() * 1.5, z: z + (R() - 0.5) * 2.5, vx: (R() - 0.5) * 1.4, vy: 3.2 + R() * 2.6, vz: (R() - 0.5) * 1.4, s: (2.2 + R() * 2.2) * size, life: 9 + R() * 9, t: -0.3 - i * 0.36 - R() * 0.2, rot: R() * 6.283, spin: (R() - 0.5) * 0.5, seed: R(), fade: 1 - i / 60 });
    const cT = new THREE.Color(trim);
    for (let i = 0; i < 26; i++) {
      const a = R() * 6.283, up = R(), sp = 6 + R() * 17;
      const c = i % 5 === 0 ? [cT.r, cT.g, cT.b] : i % 7 === 0 ? [0.03, 0.03, 0.035] : [0.82, 0.83, 0.84];
      P.push({ k: 2, x, y: y + 0.6, z, vx: Math.cos(a) * sp, vy: 5 + up * 15, vz: Math.sin(a) * sp, s: 0.35 + R() * 1.1, life: 26 + R() * 6, t: 0, rot: R() * 6.283, spin: (R() - 0.5) * 16, tum: 3 + R() * 9, c, rest: false, trail: i < 11 ? 0.001 : 1e9, seed: R() });
    }
    for (let i = 0; i < 46; i++) {
      const a = R() * 6.283, el = R() * 1.45, sp = 14 + R() * 30;
      P.push({ k: 3, x, y: y + 0.8, z, vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp, vz: Math.sin(a) * Math.cos(el) * sp, s: 0.16 + R() * 0.2, life: 0.9 + R() * 1.6, t: 0, seed: R() });
    }
    if (low) for (let i = 0; i < 7; i++) P.push({ k: 6, x: x + (R() - 0.5) * 3.4, y: gy + 0.3, z: z + (R() - 0.5) * 3.4, s: 0.9 + R() * 1.3, life: 13 + R() * 9, t: -0.4 - R() * 0.5, seed: R(), ph: R() * 6.283 });
    this.scorch.position.set(x, gy + 0.05, z); this.scorch.rotation.y = R() * 6.283; this.scorch.scale.setScalar(5.5 + 3.5 * size); this.scorchMat.opacity = 0;
    this.scorch.visible = low;
    this.glow.position.set(x, gy + 0.07, z); this.glow.scale.setScalar(26 * size); this.glow.visible = y - gy < 30;
    if (!this.group.parent) this.scene.add(this.group);
  }
  /** wisps of smoke from something singed (the pilot who was thrown clear), for `secs` */
  smoulder(secs) { this.wisps = secs > 0 ? { t: secs, acc: 0, x: 0, y: 0, z: 0 } : null; if (this.wisps && !this.active) { this.active = true; this.t = 1000; this.P.length = 0; this.scorch.visible = false; this.glow.visible = false; if (!this.group.parent) this.scene.add(this.group); } }
  wispAt(x, y, z) { if (this.wisps) { this.wisps.x = x; this.wisps.y = y; this.wisps.z = z; } }
  update(dt, cam) {
    if (!this.active) return;
    this.t += dt;
    const P = this.P, S = this.sp, wx = this.wind[0], wz = this.wind[1], R = this.R || (this.R = rng(7));
    // singed pilot: a wisp now and then
    const W = this.wisps;
    if (W) {
      W.t -= dt; W.acc += dt;
      if (W.acc > 0.16 && W.y !== 0) { W.acc = 0; P.push({ k: 4, x: W.x + (R() - 0.5) * 0.25, y: W.y, z: W.z + (R() - 0.5) * 0.25, vx: (R() - 0.5) * 0.3, vy: 0.7 + R() * 0.5, vz: (R() - 0.5) * 0.3, s: 0.16 + R() * 0.12, life: 1.3 + R() * 0.8, t: 0, rot: R() * 6.283, seed: R(), dark: 0.55 * clamp(W.t / 20, 0.25, 1) }); }
      if (W.t <= 0) this.wisps = null;
    }
    // integrate
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; p.t += dt; if (p.t < 0 || p.t > p.life) continue;
      if (p.k === 0) {
        const dr = 1 - Math.min(1, dt * (p.t < 0.5 ? 3.2 : 1.1)); p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr + 2.6 * dt;
        p.x += (p.vx + wx * Math.min(1, p.t * 0.3)) * dt; p.y += p.vy * dt; p.z += (p.vz + wz * Math.min(1, p.t * 0.3)) * dt; p.rot += p.spin * dt;
      } else if (p.k === 1 || p.k === 4) {
        const lean = Math.min(1, p.t * 0.25);
        p.x += (p.vx + wx * lean) * dt; p.y += p.vy * dt; p.z += (p.vz + wz * lean) * dt; p.rot += (p.spin || 0) * dt;
        if (p.k === 1) p.vy = Math.max(1.2, p.vy - 0.12 * dt);
      } else if (p.k === 2) {
        if (!p.rest) {
          p.vy -= 9.81 * dt; p.vx *= 1 - 0.35 * dt; p.vz *= 1 - 0.35 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt;
          if (p.y < this.gy + 0.08 && p.vy < 0) { if (p.vy < -5 && !p.b) { p.b = 1; p.vy *= -0.28; p.vx *= 0.5; p.vz *= 0.5; p.y = this.gy + 0.08; } else { p.y = this.gy + 0.06; p.rest = true; } }
          if (p.t > p.trail && p.t < 2.4 && P.length < 560) { p.trail = p.t + 0.07; P.push({ k: 4, x: p.x, y: p.y, z: p.z, vx: 0, vy: 0.6, vz: 0, s: 0.5 + p.s * 0.4, life: 1.5, t: 0, rot: p.t * 9, seed: p.seed + p.t, dark: 0.3 }); }
        }
      } else if (p.k === 3) {
        p.vy -= 7 * dt; const dr = 1 - 0.9 * dt; p.vx *= dr; p.vy *= dr; p.vz *= dr;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < this.gy + 0.05) { p.y = this.gy + 0.05; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      }
    }
    // draw: smoke first, then fire, trails, debris, sparks, the flash (premultiplied: additive things carry alpha 0)
    S.begin();
    for (const pass of [1, 4, 0, 6, 2, 3, 5]) for (let i = 0; i < P.length; i++) {
      const p = P[i]; if (p.k !== pass || p.t < 0 || p.t > p.life) continue;
      const u = p.t / p.life;
      if (pass === 1) {
        const a = sstep(0, 0.06, u) * (1 - sstep(0.45, 1, u)) * 0.78 * p.fade, g = 0.035 + 0.16 * u, sc = p.s * (0.8 + 4.6 * Math.sqrt(u));
        // lit from inside by the fire for the first seconds
        const hot = Math.max(0, 1 - p.t * 0.45) * Math.max(0, 1 - this.t / 9) * 0.5;
        S.put(p.x, p.y, p.z, sc, g + hot * 0.9, g + hot * 0.28, g * 1.05 + hot * 0.04, a, p.rot, 0, p.seed);
      } else if (pass === 4) {
        const a = (1 - u) * (p.dark || 0.3), g = 0.1 + 0.25 * u;
        S.put(p.x, p.y, p.z, p.s * (1 + 2.2 * u), g, g, g, a, p.rot, 0, p.seed);
      } else if (pass === 0) {
        // fire rolling over into smoke: white-hot → orange (additive) → dull red glowing through soot → black smoke
        // each billow its own temperature (some yellow-hot, some dull red): the ball reads as rolling fire, not one disc
        const hot = 0.55 + 0.9 * p.seed, f = Math.max(0, 1 - p.t / (0.9 + 0.8 * p.seed)), ff = f * f, soot = sstep(0.2, 1.2, p.t), a = Math.min(0.92, soot * (1 - sstep(0.55, 1, u)) * 0.9 + 0.55 * f);
        const sc = p.s * (0.7 + 2.3 * Math.sqrt(Math.min(1, p.t * 0.9)) + 1.4 * u);
        const g = 0.03 * soot;
        // (the billows overlap and add up: kept orange rather than white; the flash supplies the white-hot instant)
        S.put(p.x, p.y, p.z, sc, g + (1.5 * ff + 0.55 * f) * hot, g + (0.75 * ff * f * hot + 0.12 * f) * hot, g + 0.16 * ff * ff * hot, a, p.rot, 0, p.seed);
      } else if (pass === 6) {
        const k = (1 - sstep(0.6, 1, u)) * (0.65 + 0.35 * Math.sin(this.t * 13 + p.ph) * Math.sin(this.t * 7.3 + p.ph * 2));
        S.put(p.x, p.y + p.s * 0.45, p.z, p.s * (1.5 + 0.3 * Math.sin(this.t * 9 + p.ph)), 2.6 * k, 0.9 * k, 0.12 * k, 0.05, Math.sin(this.t * 5 + p.ph) * 0.15, 0, p.seed + Math.floor(this.t * 8) * 0.13, 0.62);
      } else if (pass === 2) {
        const tum = p.rest ? 0.9 : Math.abs(Math.cos(p.t * p.tum)) * 0.9 + 0.1, a = p.rest ? 1 - sstep(0.75, 1, u) : 1, k = p.rest ? 0.55 : 1;
        S.put(p.x, p.y, p.z, p.s * (p.rest ? 0.7 : 1), p.c[0] * a * k, p.c[1] * a * k, p.c[2] * a * k, a, p.rot, 1, p.seed, tum * 0.55);
      } else if (pass === 3) {
        const k = (1 - u) * (1 - u);
        S.put(p.x, p.y, p.z, p.s, 6 * k, 2.6 * k, 0.5 * k, 0, 0, 2, p.seed);
      } else {
        const k = 1 - u;
        S.put(p.x, p.y, p.z, p.s * (0.5 + 0.8 * u), 9 * k, 6.5 * k, 3.2 * k, 0, 0, 2, 0);
      }
    }
    S.end();
    void cam;
    // heat on the ground: a hot flash that settles to the flicker of the little fire, gone when it burns out
    const fl = Math.exp(-this.t * 2.2) * 1.0 + 0.2 * Math.max(0, 1 - this.t / 16) * (0.8 + 0.2 * Math.sin(this.t * 11));
    this.glowMat.opacity = this.t < 900 ? fl : 0;
    this.scorchMat.opacity = 0.9 * sstep(0.05, 0.6, this.t) * clamp(1 - (this.t - 42) / 28, 0, 1);
    if (this.t > 70 && !this.wisps) this.stop();
    if (this.t > 70 && this.t < 900) { this.t = 1000; P.length = 0; this.scorch.visible = false; this.glow.visible = false; }
  }
  stop() { this.active = false; this.wisps = null; if (this.group.parent) this.group.removeFromParent(); }
}

// ================================================================ parachute (round emergency canopy)
function chuteGeo(gores, R, H, colA, colB, inner) {
  // a slightly flattened dome whose hem scallops between the lines, a vent at the apex; outer and inner skins
  const pos = [], nor = [], col = [], rings = 7, sub = 3;
  const P = (t, a) => {
    const ang = 0.1 + t * (Math.PI / 2 - 0.1 + 0.16), bulge = 1 + 0.07 * t * t * Math.abs(Math.sin(a * gores / 2));
    return [Math.cos(a) * Math.sin(ang) * R * bulge, Math.cos(ang) * H - (1 - Math.abs(Math.sin(a * gores / 2))) * 0.16 * t * t * t, Math.sin(a) * Math.sin(ang) * R * bulge];
  };
  const N = (t, a) => { const e = 0.01, p = P(t, a), pt = P(t + e, a), pa = P(t, a + e); const ux = pt[0] - p[0], uy = pt[1] - p[1], uz = pt[2] - p[2], vx = pa[0] - p[0], vy = pa[1] - p[1], vz = pa[2] - p[2]; const n = [uz * vy - uy * vz, ux * vz - uz * vx, uy * vx - ux * vy], l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, n[2] / l]; };
  for (let i = 0; i < gores; i++) for (let s2 = 0; s2 < sub; s2++) {
    const a0 = ((i + s2 / sub) / gores) * Math.PI * 2, a1 = ((i + (s2 + 1) / sub) / gores) * Math.PI * 2, cc = i % 2 ? colB : colA;
    for (let r = 0; r < rings; r++) {
      const t0 = r / rings, t1 = (r + 1) / rings;
      const q = [[t0, a0], [t1, a0], [t1, a1], [t0, a0], [t1, a1], [t0, a1]];
      for (const [t, a] of q) { const p = P(t, a), n = N(t, a); pos.push(...p); nor.push(...n); col.push(cc[0], cc[1], cc[2], 0); }
      for (const [t, a] of [q[0], q[2], q[1], q[3], q[5], q[4]]) { const p = P(t, a), n = N(t, a); pos.push(p[0] * 0.992, p[1] - 0.01, p[2] * 0.992); nor.push(-n[0], -n[1], -n[2]); col.push(cc[0] * inner, cc[1] * inner, cc[2] * inner, 0); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.userData.hem = (a) => P(1, a);
  return g;
}
let CHUTE_GEO = null;
export class Chute {
  constructor() {
    const g = new THREE.Group(); g.name = 'glide:chute';
    const gores = 16, R = 3.5, H = 2.3;
    const cg = CHUTE_GEO || (CHUTE_GEO = chuteGeo(gores, R, H, [0.86, 0.2, 0.05], [0.86, 0.84, 0.78], 0.62));
    this.canopy = new THREE.Mesh(cg, bodyMat()); this.canopy.castShadow = true; this.canopy.frustumCulled = false; this.canopy.name = 'glide:chute:canopy';
    // lines: every gore seam to the nearer of two risers; the risers down to the shoulders
    const lp = [], drop = 5.6;
    for (let i = 0; i < gores; i++) { const a = (i / gores) * Math.PI * 2, h = cg.userData.hem(a), s = h[0] >= 0 ? 1 : -1; lp.push(h[0], h[1], h[2], s * 0.24, -drop + 0.75, 0); }
    for (const s of [1, -1]) lp.push(s * 0.24, -drop + 0.75, 0, s * 0.19, -drop, 0.02);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.lines = new THREE.LineSegments(lg, lineMat()); this.lines.frustumCulled = false; this.lines.name = 'glide:chute:lines';
    this.rig = new THREE.Group(); this.rig.add(this.canopy, this.lines);
    g.add(this.rig);
    this.group = g; this.open = 0; this.drop = drop; this.H = H;
  }
  objects() { return [this.canopy, this.lines]; }
  /** open 0 (packed) … 1 (fully inflated); (x, y, z) = the harness (the jumper's shoulders); flare 0..1; t seconds (breathing) */
  set(open, x, y, z, heading, swingX = 0, swingZ = 0, flare = 0, t = 0) {
    this.open = open;
    this.group.visible = open > 0.01;
    this.group.position.set(x, y, z); this.group.rotation.set(swingX - flare * 0.16, heading, swingZ, 'YXZ');
    // streaming (a long thin sausage) → inflating (overshoots a little) → breathing gently
    const o = clamp(open, 0, 1), over = o > 0.75 ? Math.sin((o - 0.75) * 4 * Math.PI) * 0.07 * (1 - o) * 4 : 0;
    const br = o >= 1 ? Math.sin(t * 2.1) * 0.012 + Math.sin(t * 3.7) * 0.006 : 0;
    const w = 0.1 + 0.9 * Math.pow(o, 1.7) + over + br + flare * 0.03, h = (0.55 + 0.45 * o) * (1.5 - 0.5 * o) - br * 1.5 - flare * 0.06, up = this.drop * (0.45 + 0.55 * o);
    this.rig.position.y = up; this.rig.scale.set(w, 1, w);
    this.canopy.scale.set(1, h, 1); this.lines.scale.set(1, (0.45 + 0.55 * o), 1);
  }
}

// ================================================================ winch cable
export class Cable {
  constructor(scene) {
    this.scene = scene; this.N = 28;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.N + 8) * 3), 3));
    this.line = new THREE.Line(g, lineMat()); this.line.frustumCulled = false; this.line.name = 'glide:cable';
    // the drogue: a small orange canopy on four short strops ahead of the rings
    this.drogue = new THREE.Mesh(CHUTE_GEO || (CHUTE_GEO = chuteGeo(16, 3.5, 2.3, [0.86, 0.2, 0.05], [0.86, 0.84, 0.78], 0.62)), bodyMat());
    this.drogue.scale.setScalar(0.24); this.drogue.frustumCulled = false; this.drogue.name = 'glide:cable:drogue';
    this.group = new THREE.Group(); this.group.add(this.line, this.drogue); this.group.name = 'glide:cable';
    this.sw = 0;
  }
  objects() { return [this.line, this.drogue]; }
  /** a → winch, b → hook; slack 0 taut … 1 loose (sag ∝ length); drogue: the parachute on the end (after release) */
  set(ax, ay, az, bx, by, bz, slack = 0, drogue = false) {
    if (!this.group.parent) this.scene.add(this.group);
    const P = this.line.geometry.attributes.position, N = this.N, L = Math.hypot(bx - ax, by - ay, bz - az);
    const sag = L * (0.012 + 0.08 * slack);
    this.sw += 0.016;
    // falling under the drogue the last stretch hangs nearly straight down from the canopy
    const hang = drogue ? Math.min(30, by - 1) : 0, hy = by - hang * 0.5;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), e = drogue ? Math.pow(t, 0.75) : t;
      P.setXYZ(i, ax + (bx - ax) * e, drogue ? ay + (hy - ay) * t * t - sag * 2 * t * (1 - t) : ay + (by - ay) * t - sag * 4 * t * (1 - t), az + (bz - az) * e);
    }
    const sx = drogue ? Math.sin(this.sw * 2.3) * 0.6 : 0, sz = drogue ? Math.cos(this.sw * 1.7) * 0.6 : 0;
    // strops up to the drogue's hem (four of them, drawn as a zig-zag of the same line)
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, r = drogue ? 0.82 : 0; P.setXYZ(N + k * 2, bx + sx + Math.cos(a) * r, (drogue ? by + 0.2 : by), bz + sz + Math.sin(a) * r); P.setXYZ(N + k * 2 + 1, bx, drogue ? hy : by, bz); }
    P.needsUpdate = true;
    this.drogue.visible = drogue;
    if (drogue) { this.drogue.position.set(bx + sx, by + 0.2, bz + sz); this.drogue.rotation.set(sz * 0.2, this.sw * 0.5, -sx * 0.2); }
  }
  hide() { if (this.group.parent) this.group.removeFromParent(); }
}

// ================================================================ cumulus over thermals
let CLOUD_MAT = null;
function cloudMat() {
  if (CLOUD_MAT) return CLOUD_MAT;
  CLOUD_MAT = new THREE.ShaderMaterial({
    name: 'glide:cumulus', transparent: true, depthWrite: false, fog: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSun: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.5, 0.56, 0.66) }, uFade: { value: 1 } }]),
    vertexShader: /* glsl */`
attribute vec4 iPos;   // centre xyz, radius (m)
attribute vec4 iMisc;  // puff offset from the cloud's middle (x, y, z: -1..1), seed
attribute vec2 iBase;  // cloud base height, opacity
varying vec2 vQ; varying vec4 vMisc; varying vec3 vInfo; varying vec3 vSunV;
uniform vec3 uSun;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = viewMatrix * vec4(iPos.xyz, 1.0);
  mvPosition.xy += position.xy * 2.0 * iPos.w;
  // height of this fragment's centre line above the base, in radii (camera up is close enough to world up for the clip)
  vInfo = vec3(iPos.y + position.y * 2.0 * iPos.w * viewMatrix[1][1] - iBase.x, iPos.w, iBase.y);
  vQ = position.xy * 2.0; vMisc = iMisc;
  vSunV = (viewMatrix * vec4(uSun, 0.0)).xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */`
varying vec2 vQ; varying vec4 vMisc; varying vec3 vInfo; varying vec3 vSunV;
uniform vec3 uLit; uniform vec3 uShade; uniform float uFade;
#include <common>
#include <fog_pars_fragment>
${GLSL_NOISE}
void main() {
  float d = length(vQ);
  float n = sN(vQ * 1.6 + vMisc.w * 23.0) * 0.55 + sN(vQ * 3.9 + vMisc.w * 7.0) * 0.3 + sN(vQ * 9.0 + vMisc.w * 3.0) * 0.15;
  float a = smoothstep(1.0, 0.42, d + (n - 0.5) * 0.7);
  // flat base: everything below the common cloud base is cut off, softly
  a *= smoothstep(-0.04, 0.1, vInfo.x / vInfo.y) * vInfo.z * uFade;
  if (a < 0.006) discard;
  // a sphere's normal for the puff, bent towards the puff's place in the whole cloud: sunlit tops and flanks, blue-grey base
  vec3 nP = vec3(vQ, sqrt(max(0.0, 1.0 - d * d)));
  vec3 nC = normalize((viewMatrix * vec4(vMisc.xyz + vec3(0.0, 0.35, 0.0), 0.0)).xyz);
  float lit = clamp(dot(normalize(nP * 0.6 + nC), normalize(vSunV)) * 0.62 + 0.5 + (n - 0.5) * 0.3, 0.0, 1.0);
  float under = smoothstep(0.0, 0.7, vInfo.x / vInfo.y);
  vec3 col = mix(uShade * (0.72 + 0.28 * under), uLit, lit * (0.35 + 0.65 * under));
  gl_FragColor = vec4(col * a, a);
#ifdef USE_FOG
  { float ff = 1.0 - exp(-fogDensity * vFogDepth * 0.18); /* a cumulus stands out of the haze for many km */ gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - ff) + fogColor * gl_FragColor.a * ff; }
#endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  return CLOUD_MAT;
}
export class Clouds {
  constructor(scene) {
    this.scene = scene; this.PUFFS = 14; this.MAX = 44;
    const q = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry(); g.index = q.index; g.setAttribute('position', q.attributes.position);
    const n = this.MAX * this.PUFFS;
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); this.misc = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); this.base = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
    g.setAttribute('iPos', this.pos); g.setAttribute('iMisc', this.misc); g.setAttribute('iBase', this.base); g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.geo = g; this.mat = cloudMat();
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.name = 'glide:cumulus'; this.mesh.renderOrder = 1;
    this.count = 0; this._order = [];
  }
  objects() { return [this.mesh]; }
  /**
   * list: [{cx, cz, top, W, age, id}] (thermals near the camera); on: daylight. cam: camera position (puffs are drawn
   * far-to-near per cloud); env: {sun: Vector3, lit: Color, shade: Color, fade} from the world's sky.
   */
  update(list, on, cam = null, env = null) {
    if (!on || !list.length) { if (this.mesh.parent) this.mesh.removeFromParent(); this.count = 0; return; }
    if (!this.mesh.parent) this.scene.add(this.mesh);
    if (env) { const u = this.mat.uniforms; if (env.sun) u.uSun.value.copy(env.sun); if (env.lit) u.uLit.value.copy(env.lit); if (env.shade) u.uShade.value.copy(env.shade); u.uFade.value = env.fade ?? 1; }
    const ord = this._order; ord.length = 0;
    for (let i = 0; i < list.length; i++) { const T = list[i]; ord.push(T); T._d = cam ? Math.hypot(T.cx - cam.x, T.cz - cam.z) : 0; }
    ord.sort((a, b) => b._d - a._d);
    let n = 0;
    const P = this.pos.array, M = this.misc.array, B = this.base.array;
    for (let i = Math.max(0, ord.length - this.MAX); i < ord.length; i++) {
      const T = ord[i], R = rng(T.id % 2147483647);
      // a cumulus grows while its thermal matures and dissolves as it dies
      const life = clamp(Math.min((T.age - 0.08) / 0.22, (1 - T.age) / 0.2), 0, 1), size = (150 + 230 * Math.min(1, T.W / 3)) * (0.45 + 0.55 * life);
      if (size < 12) continue;
      const tall = 0.75 + 0.5 * Math.min(1, T.W / 3), op = sstep(0, 0.35, life);
      for (let k = 0; k < this.PUFFS; k++) {
        // three tiers: a wide flat-bottomed raft, a middle, a few turrets on top (leaning a little downwind is the thermal's lean)
        const tier = k < 7 ? 0 : k < 11 ? 1 : 2, a = R() * 6.283, d = Math.sqrt(R()) * [0.95, 0.55, 0.28][tier];
        const ox = Math.cos(a) * d, oz = Math.sin(a) * d * 0.8, oy = [0.16, 0.5, 0.86][tier] * tall + (R() - 0.5) * 0.12;
        const r = size * ([0.5, 0.46, 0.36][tier] + R() * 0.14) * (tier === 0 ? 1 : 0.6 + 0.4 * life);
        P[n * 4] = T.cx + ox * size; P[n * 4 + 1] = T.top + oy * size * 0.8; P[n * 4 + 2] = T.cz + oz * size; P[n * 4 + 3] = r;
        M[n * 4] = ox; M[n * 4 + 1] = oy - 0.3; M[n * 4 + 2] = oz; M[n * 4 + 3] = R();
        B[n * 2] = T.top; B[n * 2 + 1] = op;
        n++;
      }
    }
    this.count = n; this.geo.instanceCount = n; this.pos.needsUpdate = this.misc.needsUpdate = this.base.needsUpdate = true;
  }
  hide() { if (this.mesh.parent) this.mesh.removeFromParent(); }
}

// ================================================================ red kites circling in thermals
// one bird = body + two cranked wings + a forked tail (7 triangles), written into one dynamic mesh
const KITE = (() => {
  const B = [0.06, 0.05, 0.045, 0], Wd = [0.2, 0.09, 0.04, 0], Wp = [0.75, 0.72, 0.66, 0], Wt = [0.03, 0.03, 0.03, 0], Tl = [0.3, 0.12, 0.05, 0];
  const t = [];
  const tri = (a, b, c, col) => t.push([a, b, c, col]);
  tri([0, 0, 0.42], [-0.07, 0, -0.1], [0.07, 0, -0.1], B);
  for (const s of [1, -1]) {
    tri([s * 0.05, 0, 0.2], [s * 0.05, 0, -0.08], [s * 0.55, 0.05, 0.14], Wd);          // arm
    tri([s * 0.05, 0, -0.08], [s * 0.55, 0.05, -0.1], [s * 0.55, 0.05, 0.14], Wp);       // pale window
    tri([s * 0.55, 0.05, 0.14], [s * 0.55, 0.05, -0.1], [s * 1.02, 0.02, -0.12], Wt);    // hand (dark fingers), swept back
  }
  tri([0, 0, -0.08], [-0.2, 0, -0.5], [0, 0, -0.36], Tl); tri([0, 0, -0.08], [0, 0, -0.36], [0.2, 0, -0.5], Tl);
  return t;
})();
export class Birds {
  constructor(scene) {
    this.scene = scene; this.MAX = 24;
    const n = this.MAX * KITE.length * 3, g = new THREE.BufferGeometry();
    this.P = new THREE.BufferAttribute(new Float32Array(n * 3), 3); this.P.setUsage(THREE.DynamicDrawUsage);
    const N = new Float32Array(n * 3), C = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { N[i * 3 + 1] = 1; const c = KITE[Math.floor(i / 3) % KITE.length][3]; C.set(c, i * 4); }
    g.setAttribute('position', this.P); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9); g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, bodyMat()); this.mesh.frustumCulled = false; this.mesh.name = 'glide:birds'; this.count = 0;
  }
  objects() { return [this.mesh]; }
  update(list, tS, cam, on) {
    if (!on) { if (this.mesh.parent) this.mesh.removeFromParent(); this.count = 0; return; }
    let n = 0; const A = this.P.array;
    for (const T of list) {
      if (T.W < 1.4) continue;
      const d = Math.hypot(T.x - cam.x, T.z - cam.z); if (d > 900) continue;
      const R = rng((T.id * 31) % 2147483647), k = 3 + Math.floor(R() * 3);
      for (let i = 0; i < k && n < this.MAX; i++) {
        const h = 90 + R() * 320, r = 22 + R() * 26, w = (0.35 + R() * 0.15) * (R() < 0.5 ? 1 : -1), ph = R() * 6.28;
        const a = ph + tS * w, lean = Math.min(400, h / 2.5) / Math.min(400, T.top / 2.5);
        const x = T.x + (T.cx - T.x) * lean + Math.cos(a) * r, z = T.z + (T.cz - T.z) * lean + Math.sin(a) * r, y = h + Math.sin(tS * 0.3 + ph) * 6 + (tS % 240) * 0.08 * (1 - (h / 420));
        const sc = 1.5 + R() * 0.5, lazy = R() < 0.3, flap = lazy ? Math.sin(tS * 6 + ph) * 0.35 * Math.max(0, Math.sin(tS * 0.7 + ph)) : Math.sin(tS * 1.3 + ph) * 0.06;
        // heading along the circle (tangent), banked into it; kites twist their tails to steer
        _e.set(0, -a + (w > 0 ? Math.PI : 0), (w > 0 ? 0.5 : -0.5), 'YXZ'); _q.setFromEuler(_e);
        let o = n * KITE.length * 9;
        for (const [p0, p1, p2] of KITE) for (const p of [p0, p1, p2]) {
          const out = Math.abs(p[0]);
          _p.set(p[0], p[1] + out * (0.16 + flap) + (p[2] < -0.3 ? Math.sin(tS * 0.9 + ph) * 0.04 * Math.sign(p[0]) : 0), p[2]).multiplyScalar(sc).applyQuaternion(_q);
          A[o++] = x + _p.x; A[o++] = y + _p.y; A[o++] = z + _p.z;
        }
        n++;
      }
    }
    this.count = n; this.mesh.geometry.setDrawRange(0, n * KITE.length * 3); this.P.needsUpdate = true;
    if (n && !this.mesh.parent) this.scene.add(this.mesh); else if (!n && this.mesh.parent) this.mesh.removeFromParent();
  }
}

// ================================================================ the countryside beyond the map
function fieldsTexture(S = 2048) {
  const cg = canvas(S, S); if (!cg) return null;
  const [c, g] = cg, R = rng(4242);
  // Oxfordshire in high summer: pasture and ley greens, ripening wheat and barley, the odd stubble, plough and rape
  const PAST = ['#5e7c3a', '#688643', '#587536', '#6f8c48', '#627f3d', '#73914c', '#5b7a3c'], CROP = ['#9aa05a', '#a9a562', '#b8ad68', '#8f9c56', '#c2b56f', '#a39a58'], ODD = ['#7a6248', '#8a7050', '#cbbf58', '#c9bd84', '#6d8a54'];
  const pick = () => { const r = R(); const a = r < 0.56 ? PAST : r < 0.9 ? CROP : ODD; return a[Math.floor(R() * a.length)]; };
  const woods = [], farms = [];
  g.fillStyle = '#62803e'; g.fillRect(0, 0, S, S);
  // a patchwork: recursive splits at slightly-off right angles per block, so hedgerows wander like real ones
  const field = (pts, d) => {
    g.fillStyle = pick(); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    g.save(); g.clip();
    const bx = Math.min(...pts.map((p) => p[0])), by = Math.min(...pts.map((p) => p[1])), bw = Math.max(...pts.map((p) => p[0])) - bx, bh = Math.max(...pts.map((p) => p[1])) - by;
    const r = R();
    if (r < 0.5) { // tramlines / mowing stripes along one side
      const a = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) + (R() < 0.5 ? 0 : Math.PI / 2);
      g.strokeStyle = R() < 0.5 ? 'rgba(255,255,220,0.07)' : 'rgba(20,40,10,0.08)'; g.lineWidth = 1.4;
      const L = bw + bh, sp = 5 + R() * 5, cx = bx + bw / 2, cy = by + bh / 2;
      for (let k = -L; k < L; k += sp) { g.beginPath(); g.moveTo(cx + Math.cos(a) * -L - Math.sin(a) * k, cy + Math.sin(a) * -L + Math.cos(a) * k); g.lineTo(cx + Math.cos(a) * L - Math.sin(a) * k, cy + Math.sin(a) * L + Math.cos(a) * k); g.stroke(); }
    } else if (r < 0.8) { // mottled pasture
      for (let k = 0; k < 10; k++) { g.fillStyle = R() < 0.5 ? 'rgba(30,60,20,0.07)' : 'rgba(220,220,150,0.06)'; g.beginPath(); g.ellipse(bx + R() * bw, by + R() * bh, 8 + R() * bw * 0.3, 6 + R() * bh * 0.25, R() * 3, 0, 7); g.fill(); }
    }
    g.restore();
    if (d > 2 && R() < 0.06 && bw > 50) woods.push([bx + bw / 2, by + bh / 2, Math.min(bw, bh) * (0.3 + R() * 0.25)]);
    else if (d > 2 && R() < 0.045) farms.push([bx + bw * (0.3 + R() * 0.4), by + bh * (0.3 + R() * 0.4)]);
    // the hedge round it, with hedgerow trees
    g.strokeStyle = '#34482a'; g.lineWidth = 2.6; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s2 = R() * 30; s2 < L; s2 += 14 + R() * 60) { const x = a[0] + (b[0] - a[0]) * s2 / L, y = a[1] + (b[1] - a[1]) * s2 / L, rr = 2.4 + R() * 2.6; g.fillStyle = 'rgba(20,30,14,0.35)'; g.beginPath(); g.arc(x + 1.6, y + 1.6, rr, 0, 7); g.fill(); g.fillStyle = R() < 0.5 ? '#2f4a26' : '#3a5a2c'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); g.fillStyle = 'rgba(120,160,70,0.35)'; g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.5, 0, 7); g.fill(); } }
  };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const split = (q, d) => {
    const w = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), h = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
    if (d > 6 || (w < 120 && h < 120) || (d > 3 && R() < 0.22)) { field(q, d); return; }
    const t0 = 0.34 + R() * 0.32, t1 = t0 + (R() - 0.5) * 0.12;
    if (w > h) { const a = lerp(q[0], q[1], t0), b = lerp(q[3], q[2], t1); split([q[0], a, b, q[3]], d + 1); split([a, q[1], q[2], b], d + 1); }
    else { const a = lerp(q[0], q[3], t0), b = lerp(q[1], q[2], t1); split([q[0], q[1], b, a], d + 1); split([a, b, q[2], q[3]], d + 1); }
  };
  split([[0, 0], [S, 0], [S, S], [0, S]], 0);
  // woods: dark, lumpy, with a lit edge
  for (const [x, y, r] of woods) {
    // irregular: a few overlapping lobes, each a dark mass (no field showing through) under overlapping crowns
    const lobes = 3 + Math.floor(R() * 4);
    for (let L = 0; L < lobes; L++) {
      const a0 = R() * 6.283, d0 = L ? r * (0.3 + R() * 0.45) : 0, lx = x + Math.cos(a0) * d0, ly = y + Math.sin(a0) * d0 * 0.8, lr = r * (0.32 + R() * 0.3);
      g.fillStyle = '#2a4223'; g.beginPath(); g.ellipse(lx, ly, lr, lr * (0.55 + R() * 0.4), R() * 3, 0, 7); g.fill();
      const nb = Math.min(260, 20 + Math.round(lr * lr * 0.16));
      for (let k = 0; k < nb; k++) { const a = R() * 6.283, d = Math.sqrt(R()) * lr * 1.05, rr = 4 + R() * 6; g.fillStyle = ['#2e4826', '#35522b', '#283f22', '#3d5c30', '#44602f'][Math.floor(R() * 5)]; g.beginPath(); g.arc(lx + Math.cos(a) * d, ly + Math.sin(a) * d * 0.75, rr, 0, 7); g.fill(); }
    }
    for (let k = 0; k < 40; k++) { const a = R() * 6.283, d = Math.sqrt(R()) * r; g.fillStyle = 'rgba(110,150,70,0.22)'; g.beginPath(); g.arc(x + Math.cos(a) * d - 1.5, y + Math.sin(a) * d * 0.8 - 1.5, 2.5, 0, 7); g.fill(); }
  }
  // a stream with willows, two lanes (the tile wraps: they leave and enter at the same heights)
  const wander = (y0, amp, col, lw, dash) => { g.strokeStyle = col; g.lineWidth = lw; g.setLineDash && g.setLineDash(dash || []); g.beginPath(); for (let x = 0; x <= S; x += 16) { const y = y0 + Math.sin(x / S * 6.283 * 2) * amp + Math.sin(x / S * 6.283 * 5 + 1) * amp * 0.35; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.setLineDash && g.setLineDash([]); };
  const wanderV = (x0, amp, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let y = 0; y <= S; y += 16) { const x = x0 + Math.sin(y / S * 6.283 * 3) * amp + Math.sin(y / S * 6.283 * 7 + 2) * amp * 0.3; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
  wander(S * 0.71, 46, '#39522c', 9); wander(S * 0.71, 46, '#4f6f8a', 3.2);
  wander(S * 0.36, 30, '#3a4e2c', 7); wander(S * 0.36, 30, '#9a9686', 3.4);
  wanderV(S * 0.63, 36, '#3a4e2c', 6.5); wanderV(S * 0.63, 36, '#a09a88', 3);
  wanderV(S * 0.17, 22, '#8c8672', 1.8);
  // farms: a yard, a few roofs (tile red, slate grey, a big pale barn), a track to the nearest lane
  for (const [x, y] of farms) {
    g.strokeStyle = '#a39c86'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 60, y + (R() < 0.5 ? -1 : 1) * (40 + R() * 60)); g.stroke();
    g.fillStyle = '#8f8a78'; g.fillRect(x - 9, y - 7, 18, 14);
    for (let k = 0; k < 4; k++) { const w = 4 + R() * 7, h = 3 + R() * 4, bx = x - 10 + R() * 16, by = y - 9 + R() * 14; g.fillStyle = 'rgba(20,24,16,0.4)'; g.fillRect(bx + 1.5, by + 1.5, w, h); g.fillStyle = ['#8a4a36', '#5e6268', '#b9b7ae', '#7c4634'][Math.floor(R() * 4)]; g.fillRect(bx, by, w, h); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(bx, by, w, h / 2); }
    for (let k = 0; k < 5; k++) { g.fillStyle = '#2f4a26'; g.beginPath(); g.arc(x - 16 + R() * 32, y - 14 + R() * 28, 2.5 + R() * 2, 0, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
export class Country {
  /** hole = {minX,maxX,minZ,maxZ} (where the city's own ground is drawn), period m per texture repeat; air = the world's cloud-shadow uniform */
  constructor(scene, hole, period = 3400, air = null) {
    this.scene = scene; this.hole = hole; this.period = period;
    const tex = fieldsTexture();
    this.mat = new THREE.MeshLambertMaterial({ map: tex, color: tex ? 0xffffff : 0x6b8442, fog: true });
    this.mat.polygonOffset = true; this.mat.polygonOffsetFactor = 2; this.mat.polygonOffsetUnits = 4;
    const uAir = air || { value: new THREE.Vector3() };
    this.mat.onBeforeCompile = (sh) => {
      // large-scale colour drift so the repeat does not read from height, and the same cloud shadows as the city
      sh.uniforms.uAir = uAir;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCW;').replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvCW = (modelMatrix * vec4(position, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCW;\nuniform vec3 uAir;\n' + GLSL_NOISE)
        .replace('#include <map_fragment>', /* glsl */`#include <map_fragment>
	{
		float cM = sN(vCW * 0.00041 + 3.0) * 0.6 + sN(vCW * 0.0013 + 11.0) * 0.4;
		diffuseColor.rgb *= mix(vec3(0.8, 0.9, 0.8), vec3(1.16, 1.1, 0.92), cM);
		vec2 aP = vCW * 0.0013 + uAir.xy;
		float aC = sN(aP) * 0.62 + sN(aP * 2.9 + 5.3) * 0.38;
		diffuseColor.rgb *= 1.0 - uAir.z * smoothstep(0.5, 0.68, aC);
	}`);
    };
    this.mat.customProgramCacheKey = () => 'glideCountry2';
    const E = 16000, h = hole, y = -0.05;
    // ring = 4 grids round the hole (world-space UVs in texture repeats). Cells are small by the hole and grow outwards:
    // the haze's sun glow is worked out per vertex, so one huge triangle would smear the glow across the whole sky
    const OUT = [0, 150, 350, 650, 1100, 1800, 2900, 4600, 7300, 11500, E];
    const span = (a0, a1, step) => { const n = Math.max(1, Math.ceil((a1 - a0) / step)), r = []; for (let i = 0; i <= n; i++) r.push(a0 + (a1 - a0) * i / n); return r; };
    const xsIn = span(h.minX, h.maxX, 700), zsIn = span(h.minZ, h.maxZ, 700);
    const xsAll = [...OUT.slice(1).reverse().map((d) => h.minX - d), ...xsIn, ...OUT.slice(1).map((d) => h.maxX + d)];
    const pos = [], uv = [];
    const grid = (xs, zs) => {
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
        const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
        for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) { pos.push(x, y, z); uv.push(x / period, -z / period); }
      }
    };
    grid(xsAll, OUT.slice().reverse().map((d) => h.minZ - d));           // north
    grid(xsAll, OUT.map((d) => h.maxZ + d));                             // south
    grid(OUT.slice().reverse().map((d) => h.minX - d), zsIn);            // west
    grid(OUT.map((d) => h.maxX + d), zsIn);                              // east
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    this.ring = new THREE.Mesh(g, this.mat); this.ring.name = 'glide:country'; this.ring.receiveShadow = false; this.ring.frustumCulled = false; this.ring.matrixAutoUpdate = false;
    // far out: a plain that follows the camera (snapped to the texture period, so the pattern does not swim)
    const pg = new THREE.PlaneGeometry(24000, 24000, 16, 16); pg.rotateX(-Math.PI / 2);
    const u = pg.attributes.uv, pp = pg.attributes.position; for (let i = 0; i < u.count; i++) u.setXY(i, pp.getX(i) / period, -pp.getZ(i) / period);
    this.plain = new THREE.Mesh(pg, this.mat); this.plain.name = 'glide:country'; this.plain.frustumCulled = false; this.plain.position.y = y;
    this.on = false;
  }
  objects() { return [this.ring]; }
  /** distance (m) from (x, z) to the hole rectangle */
  outside(x, z) { const h = this.hole; return Math.hypot(Math.max(h.minX - x, 0, x - h.maxX), Math.max(h.minZ - z, 0, z - h.maxZ)); }
  update(cam, on) {
    const d = on ? this.outside(cam.x, cam.z) : 0;
    const useRing = on && d < 9000, usePlain = on && d >= 9000;
    if (useRing !== !!this.ring.parent) { if (useRing) this.scene.add(this.ring); else this.ring.removeFromParent(); }
    if (usePlain !== !!this.plain.parent) { if (usePlain) this.scene.add(this.plain); else this.plain.removeFromParent(); }
    if (usePlain) { const P = this.period; this.plain.position.x = Math.round(cam.x / P) * P; this.plain.position.z = Math.round(cam.z / P) * P; }
    this.on = on;
  }
}

// ================================================================ the city's lamps from the air at night
export class CityLights {
  /** lamps: flat [x, y, z, …] (world.lampPositions) */
  constructor(scene, lamps) {
    this.scene = scene;
    const n = Math.floor((lamps ? lamps.length : 0) / 3);
    this.sp = new Sprites(Math.max(1, n), 'glide:citylights'); this.sp.mesh.renderOrder = 5;
    this.lamps = lamps; this.n = n; this.k = -1;
  }
  objects() { return [this.sp.mesh]; }
  /** night 0..1 */
  update(night, on) {
    const show = on && night > 0.2 && this.n > 0;
    if (!show) { if (this.sp.mesh.parent) this.sp.mesh.removeFromParent(); return; }
    const k = Math.round(sstep(0.2, 0.7, night) * 20) / 20;
    if (k !== this.k) {
      // sodium orange with the odd whiter lamp; rebuilt only when the level steps
      this.k = k; const S = this.sp, L = this.lamps; S.begin();
      for (let i = 0; i < this.n; i++) {
        const x = L[i * 3], y = L[i * 3 + 1], z = L[i * 3 + 2]; if (x > 1e8) continue;
        const h = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1, w = Math.abs(h) < 0.15;
        S.put(x, (y || 5) + 0.4, z, 2.6, (w ? 2.6 : 3.4) * k, (w ? 2.4 : 1.9) * k, (w ? 1.9 : 0.55) * k, 0, 0, 2, 0);
      }
      S.end();
    }
    this.sp.mesh.material.uniforms.uMinPx.value = 0.0042;
    if (!this.sp.mesh.parent) this.scene.add(this.sp.mesh);
  }
}

// ================================================================ contact shadow under a glider on the ground
let SHADOW_TEX = null;
function shadowTex() {
  if (SHADOW_TEX) return SHADOW_TEX;
  const cg = canvas(256, 256); if (!cg) return null;
  const [c, g] = cg;
  // plan view: nose up (+v), 18 m across the texture
  g.clearRect(0, 0, 256, 256); g.filter = 'blur(7px)'; g.fillStyle = 'rgba(0,0,0,0.85)';
  const m = 256 / 18, X = (x) => 128 + x * m, Y = (z) => 128 - (z + 0.9) * m;
  g.beginPath(); g.ellipse(X(0), Y(1.3), 0.42 * m, 2.1 * m, 0, 0, 7); g.fill();                                            // pod
  g.beginPath(); g.moveTo(X(-0.2), Y(-0.5)); g.lineTo(X(0.2), Y(-0.5)); g.lineTo(X(0.08), Y(-5)); g.lineTo(X(-0.08), Y(-5)); g.fill();   // boom
  g.beginPath(); g.moveTo(X(0), Y(0.66)); g.lineTo(X(8.5), Y(0.36)); g.lineTo(X(8.5), Y(-0.12)); g.lineTo(X(0), Y(-0.84)); g.lineTo(X(-8.5), Y(-0.12)); g.lineTo(X(-8.5), Y(0.36)); g.fill();   // wings
  g.beginPath(); g.moveTo(X(-1.55), Y(-4.7)); g.lineTo(X(1.55), Y(-4.7)); g.lineTo(X(1.55), Y(-5.1)); g.lineTo(X(-1.55), Y(-5.1)); g.fill();       // tailplane
  const t = new THREE.CanvasTexture(c); SHADOW_TEX = t; return t;
}
export class GroundShadow {
  constructor(scene) {
    this.scene = scene;
    const g = new THREE.PlaneGeometry(18, 18); g.rotateX(-Math.PI / 2); g.translate(0, 0, 0.9);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    this.mat = decalMat(shadowTex(), { color: 0x000000, opacity: 0.4, polygonOffsetFactor: -8, polygonOffsetUnits: -16 });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.name = 'glide:shadow'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
  }
  objects() { return [this.mesh]; }
  /** agl: wheel height above the ground (the shadow thins out and is gone by ~7 m); strength 0..1 (daylight) */
  set(x, gy, z, heading, agl, strength = 1) {
    const k = clamp(1 - agl / 7, 0, 1) * strength;
    if (k <= 0.01) { this.hide(); return; }
    if (!this.mesh.parent) this.scene.add(this.mesh);
    this.mesh.position.set(x, gy + 0.045, z); this.mesh.rotation.y = heading; this.mesh.scale.setScalar(1 + agl * 0.05);
    this.mat.opacity = 0.42 * k;
  }
  hide() { if (this.mesh.parent) this.mesh.removeFromParent(); }
}
