// Cheap fire effects: shader-animated flame billboards, a city-visible smoke column, embers, hose spray, and WebAudio
// synth (roar + crackle, sirens, alarm bell, splashes). All animation is in the shaders, driven by a few uniforms, so
// update() costs nothing per particle. Shared by places/randolph.js (and the pizza van's oven fire / chimney wisp).
import * as THREE from 'three';
import { coins } from '../systems/_object_audio.js';

const NOISE = /* glsl */`
float hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
const quad = (yBottom) => {
  const g = new THREE.InstancedBufferGeometry();
  const y0 = yBottom ? 0 : -0.5, y1 = yBottom ? 1 : 0.5;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, y0, 0, 0.5, y0, 0, 0.5, y1, 0, -0.5, y1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

// ------------------------------------------------------------------------------------------------ flames
/**
 * Flame billboards (vertical, camera-facing about Y). flames: [{p:[x,y,z], w, h, start}] world coords.
 * start = fire spread progress (0..1) at which the flame ignites. Returns {mesh, u}: set u.uProg / u.uFlame.
 */
export function createFlames(flames, timeUniform, { wind = [0.3, -0.2], seed = 1 } = {}) {
  const n = flames.length, g = quad(true);
  const P = new Float32Array(n * 3), S = new Float32Array(n * 2), D = new Float32Array(n * 3);
  flames.forEach((f, i) => { P.set(f.p, i * 3); S.set([f.w, f.h], i * 2); D.set([((i * 0.6180339 + seed * 0.37) % 1), f.start || 0, f.kind || 0], i * 3); });
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 3));
  g.setAttribute('iSize', new THREE.InstancedBufferAttribute(S, 2));
  g.setAttribute('iData', new THREE.InstancedBufferAttribute(D, 3));
  g.instanceCount = n;
  const u = { uTime: timeUniform, uProg: { value: 0 }, uFlame: { value: 0 }, uWind: { value: new THREE.Vector2(wind[0], wind[1]) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      attribute vec3 iPos; attribute vec2 iSize; attribute vec3 iData;
      uniform float uTime, uProg, uFlame; uniform vec2 uWind;
      varying vec2 vUv; varying float vSeed; varying float vA;
      void main() {
        float on = smoothstep(iData.y, iData.y + 0.07, uProg) * uFlame;
        float fl = 0.82 + 0.12 * sin(uTime * 9.0 + iData.x * 40.0) + 0.08 * sin(uTime * 23.0 + iData.x * 17.0);
        vec2 sz = iSize * on * vec2(1.0, fl);
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]) + vec3(1e-5, 0.0, 0.0));
        vec3 p = iPos + right * position.x * sz.x + vec3(0.0, position.y * sz.y, 0.0);
        p.xz += uWind * position.y * position.y * sz.y * 0.45;
        vUv = vec2(position.x + 0.5, position.y); vSeed = iData.x; vA = step(0.001, on);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec2 vUv; varying float vSeed; varying float vA;
      ${NOISE}
      void main() {
        vec2 uv = vUv;
        float n = vnoise(vec2(uv.x * 3.0 + vSeed * 10.0, uv.y * 3.5 - uTime * 3.2)) * 0.6 + vnoise(vec2(uv.x * 7.0 + vSeed * 3.0, uv.y * 7.0 - uTime * 5.5)) * 0.4;
        float w = pow(1.0 - uv.y, 0.7);
        float dx = abs(uv.x - 0.5) * 2.0;
        float shape = 1.0 - smoothstep(w * 0.85 - 0.2, w * 0.85 + 0.05, dx + (n - 0.5) * 0.55);
        shape *= smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.45, uv.y + (n - 0.5) * 0.5);
        if (shape < 0.01 || vA < 0.5) discard;
        float core = clamp(shape * (1.1 - uv.y) * 1.3, 0.0, 1.0);
        vec3 col = mix(vec3(0.95, 0.22, 0.02), vec3(1.0, 0.86, 0.42), core);
        gl_FragColor = vec4(col * 1.5, shape);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'fx:flames';
  return { mesh, u };
}

// ------------------------------------------------------------------------------------------------ smoke
/**
 * Rising, wind-sheared smoke column from u.uSrc. n billboards. Returns {mesh, u}: set uDensity (0..1), uDark (0..1, grey ->
 * black), uGlow (fire light at the base), uSrc. rise = column height (m), life = seconds a puff takes to rise.
 */
export function createSmoke(n, timeUniform, nightUniform, { rise = 190, life = 28, size = [2.5, 34], wind = [0.2, -0.13], spread = 2.5, radial = 2.5, light = [0.62, 0.62, 0.6] } = {}) {
  const g = quad(false), D = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) D.set([(i * 0.6180339) % 1, i * 2.39996, radial * (0.3 + ((i * 0.7548776) % 1) * 0.7), (i * 0.5698403) % 1], i * 4);
  g.setAttribute('iData', new THREE.InstancedBufferAttribute(D, 4));
  g.instanceCount = n;
  const u = {
    uTime: timeUniform, uNight: nightUniform, uDensity: { value: 0 }, uDark: { value: 0.5 }, uGlow: { value: 0 },
    uSrc: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(wind[0], wind[1]) },
    uRise: { value: rise }, uLife: { value: life }, uSize: { value: new THREE.Vector2(size[0], size[1]) }, uSpread: { value: spread },
    uLight: { value: new THREE.Color(light[0], light[1], light[2]) },
    fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.00025 }, fogNear: { value: 1 }, fogFar: { value: 2000 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, fog: true,
    vertexShader: /* glsl */`
      attribute vec4 iData;
      uniform float uTime, uDensity, uRise, uLife, uSpread; uniform vec3 uSrc; uniform vec2 uWind, uSize;
      varying vec2 vUv; varying float vA; varying float vT; varying float vSeed; varying float vFog;
      void main() {
        float t = fract(uTime / uLife + iData.x);
        float h = t * uRise;
        vec3 c = uSrc;
        c.y += h;
        c.xz += uWind * pow(h, 1.25) + vec2(cos(iData.y), sin(iData.y)) * iData.z * (1.0 + t * uSpread * 6.0);
        c.x += sin(uTime * 0.31 + iData.x * 20.0) * t * 5.0;
        float size = mix(uSize.x, uSize.y, pow(t, 0.75)) * (0.7 + 0.6 * iData.w);
        vec4 mv = viewMatrix * vec4(c, 1.0);
        float r = iData.x * 6.283 + uTime * 0.08 * (iData.w - 0.5);
        vec2 q = mat2(cos(r), -sin(r), sin(r), cos(r)) * position.xy;
        mv.xy += q * size * step(0.001, uDensity);
        gl_Position = projectionMatrix * mv;
        vUv = position.xy + 0.5; vT = t; vSeed = iData.x; vFog = -mv.z;
        vA = uDensity * smoothstep(0.0, 0.05, t) * pow(1.0 - t, 1.2);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uDark, uGlow, uNight; uniform vec3 uLight;
      uniform vec3 fogColor; uniform float fogDensity;
      varying vec2 vUv; varying float vA; varying float vT; varying float vSeed; varying float vFog;
      ${NOISE}
      void main() {
        vec2 p = vUv - 0.5; float d = length(p) * 2.0;
        float n = vnoise(vUv * 3.0 + vSeed * 13.0 + vec2(0.0, -uTime * 0.07));
        float a = smoothstep(1.0, 0.3, d + (n - 0.5) * 0.7) * vA;
        if (a < 0.004) discard;
        vec3 dark = vec3(0.075, 0.07, 0.065);
        vec3 col = mix(uLight, dark, uDark) * (0.72 + 0.55 * n);
        col = mix(col, uLight * 0.95, vT * 0.4 * (1.0 - uDark * 0.6));
        col *= mix(1.0, 0.22, uNight);
        col += vec3(1.0, 0.38, 0.08) * uGlow * pow(1.0 - vT, 5.0) * (0.6 + 0.4 * n);
        float f = 1.0 - exp(-fogDensity * fogDensity * vFog * vFog);
        col = mix(col, fogColor, f * 0.55);
        gl_FragColor = vec4(col, a * 0.9);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'fx:smoke';
  return { mesh, u };
}

// ------------------------------------------------------------------------------------------------ embers
/** n embers rising from a box (centre c, half extents hx,hz) with wind drift. u.uOn 0..1. */
export function createEmbers(n, timeUniform, c, hx, hz, { wind = [0.3, -0.2] } = {}) {
  const g = new THREE.BufferGeometry(), P = new Float32Array(n * 3), S = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { P.set([c[0], c[1], c[2]], i * 3); S.set([(i * 0.6180339) % 1, ((i * 0.7548776) % 1) * 2 - 1, ((i * 0.5698403) % 1) * 2 - 1], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(S, 3));
  const u = { uTime: timeUniform, uOn: { value: 0 }, uExt: { value: new THREE.Vector2(hx, hz) }, uWind: { value: new THREE.Vector2(wind[0], wind[1]) }, uScale: { value: 400 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aSeed; uniform float uTime, uOn, uScale; uniform vec2 uExt, uWind; varying float vA;
      void main() {
        float t = fract(uTime / 4.5 + aSeed.x);
        vec3 p = position + vec3(aSeed.y * uExt.x, 0.0, aSeed.z * uExt.y);
        float h = t * (14.0 + 18.0 * fract(aSeed.x * 7.0));
        p.y += h; p.xz += uWind * h * 1.6 + vec2(sin(uTime * 3.0 + aSeed.x * 50.0), cos(uTime * 2.3 + aSeed.x * 30.0)) * 0.6 * t;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float fl = 0.5 + 0.5 * sin(uTime * 17.0 + aSeed.x * 90.0);
        vA = uOn * (1.0 - t) * (0.5 + 0.5 * fl);
        gl_PointSize = uOn > 0.001 ? (0.14 + 0.08 * fl) * uScale / max(1.0, -mv.z) : 0.0;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5 || vA < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0, 0.55, 0.15) * 1.6, vA * (1.0 - d * 2.0)); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.name = 'fx:embers';
  return { mesh: pts, u };
}

// ------------------------------------------------------------------------------------------------ hose spray
/** water jets: jets [{from:[x,y,z], to:[x,y,z], arc}] world coords, `per` drops each. u.uOn. */
export function createSpray(jets, timeUniform, per = 70) {
  const n = jets.length * per, g = new THREE.BufferGeometry();
  const A = new Float32Array(n * 3), B = new Float32Array(n * 3), S = new Float32Array(n * 3);
  let k = 0;
  for (const j of jets) for (let i = 0; i < per; i++, k++) {
    A.set(j.from, k * 3); B.set(j.to, k * 3);
    S.set([(i * 0.6180339) % 1, j.arc || 4, ((i * 0.7548776) % 1) * 2 - 1], k * 3);
  }
  g.setAttribute('position', new THREE.BufferAttribute(A, 3));
  g.setAttribute('aTo', new THREE.BufferAttribute(B, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(S, 3));
  const u = { uTime: timeUniform, uOn: { value: 0 }, uScale: { value: 400 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec3 aTo; attribute vec3 aSeed; uniform float uTime, uOn, uScale; varying float vA;
      void main() {
        float t = fract(uTime * 0.9 + aSeed.x);
        vec3 p = mix(position, aTo, t);
        p.y += aSeed.y * 4.0 * t * (1.0 - t);
        p += vec3(aSeed.z, fract(aSeed.x * 13.0) - 0.5, fract(aSeed.x * 31.0) - 0.5) * t * t * 1.6;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = uOn * (0.5 + 0.4 * (1.0 - t));
        gl_PointSize = uOn > 0.001 ? (0.3 + 0.8 * t) * uScale / max(1.0, -mv.z) : 0.0;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard;
        gl_FragColor = vec4(0.86, 0.92, 1.0, vA * (1.0 - d * 2.0)); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.name = 'fx:spray';
  return { mesh: pts, u };
}

// ------------------------------------------------------------------------------------------------ audio
/** Roar + crackle loop attenuated by distance, plus one-shots. Everything is lazy: nothing happens until Play. */
export class FireAudio {
  constructor(game) { this.game = game; this.loop = null; this.crackT = 0; this.sirenT = 0; }
  _ensure() {
    const A = this.game.audio, ctx = A.ctx;
    if (!ctx || this.loop) return !!this.loop;
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.97 * b0 + 0.03 * w; b1 = 0.6 * b1 + 0.4 * w; d[i] = b0 * 3.2 + b1 * 0.25; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(A.master); src.start();
    this.loop = { src, lp, g };
    return true;
  }
  /** dist: metres from the fire; level 0..1 */
  update(dt, dist, level) {
    const A = this.game.audio;
    if (!A.ctx) return;
    const near = Math.max(0, 1 - dist / 170) ** 2 * level;
    if (near > 0.001 || this.loop) {
      if (!this._ensure()) return;
      this.loop.g.gain.setTargetAtTime(near * 0.55, A.ctx.currentTime, 0.4);
      this.loop.lp.frequency.setTargetAtTime(300 + 500 * near, A.ctx.currentTime, 0.5);
    }
    if (near > 0.02) {
      this.crackT -= dt;
      if (this.crackT <= 0) {
        this.crackT = 0.04 + Math.random() * 0.25 / (0.3 + near);
        A.noise(0.02 + Math.random() * 0.05, { gain: 0.25 * near * (0.4 + Math.random()), freq: 1500 + Math.random() * 3500, q: 2, type: 'bandpass' });
      }
    }
  }
  /** UK two-tone, a few seconds, attenuated by distance */
  siren(dist) {
    const A = this.game.audio; if (!A.ctx) return;
    const v = Math.max(0, 1 - dist / 400) * 0.12; if (v < 0.005) return;
    for (let i = 0; i < 8; i++) A.tone(i % 2 ? 660 : 880, 0.5, { type: 'sawtooth', gain: v, attack: 0.03, when: i * 0.55 });
  }
  /** fire alarm bell (indoors) */
  alarm(secs = 2.5) {
    const A = this.game.audio; if (!A.ctx) return;
    for (let t = 0; t < secs; t += 0.07) A.tone(950 + (Math.round(t / 0.07) % 2) * 40, 0.06, { type: 'square', gain: 0.07, when: t });
  }
  splash() { const A = this.game.audio; if (!A.ctx) return; A.noise(0.5, { gain: 0.35, freq: 900, q: 0.7, type: 'lowpass' }); A.noise(0.25, { gain: 0.2, freq: 3000, q: 1, when: 0.05 }); }
  coin() { const A = this.game.audio; if (!A.ctx) return; coins(A, { gain: 2.5 }); }      // (money handed over: coins, not a two-note bing — 2026-11-23)
  stop() { if (this.loop && this.game.audio.ctx) this.loop.g.gain.setTargetAtTime(0, this.game.audio.ctx.currentTime, 0.3); }
}
