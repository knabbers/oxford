// South Park fireworks night — GPU side. Every moving thing here is animated in a vertex shader from a start time and
// the shared clock; JavaScript only writes a shell's particles once, when it is launched (_sp_show.js emitShell), and
// sets a handful of uniforms per frame.
//   createStars(cap)   ONE THREE.Points for every star, tail and rising shell of the display (ring buffer of `cap`)
//   createPuffs(cap)   ONE instanced-quad draw for burst flashes and the drifting smoke they light (premultiplied
//                      alpha: flashes add, smoke covers)
//   createCrowd(spots) ONE instanced draw of camera-facing people cut-outs, lit by the display and the bonfire
//   createGlow(quads)  ONE additive ground decal mesh: the display's light on the grass, the fire's, the fair's pools
//   createBulbs(list)  ONE Points of fairground bulbs (chasing / twinkling)
//   fairMaterial()     Lambert + vertex colours + a per-vertex "glow" that lights painted panels at night
// No lights are added to the scene.
import * as THREE from 'three';
import { G, KIND } from './_sp_show.js';
import { markRange } from '../world/util.js';
import { TERRAIN_VS } from '../world/terrain.js';

const dyn = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };

// ------------------------------------------------------------------------------------------------ stars
export function createStars(cap) {
  const g = new THREE.BufferGeometry();
  const A = { position: dyn(new Float32Array(cap * 3), 3), aVel: dyn(new Float32Array(cap * 3), 3), aT: dyn(new Float32Array(cap * 4), 4), aCol: dyn(new Float32Array(cap * 3), 3), aMisc: dyn(new Float32Array(cap * 3), 3) };
  for (const k in A) g.setAttribute(k, A[k]);
  // nothing alive yet: start times far in the future
  for (let i = 0; i < cap; i++) A.aT.array[i * 4] = 1e9;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const u = { uTime: { value: 0 }, uScale: { value: 600 }, uRaise: { value: 0 }, uMinPx: { value: 1.5 }, uGain: { value: 1 }, uFar: { value: 2350 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`` + TERRAIN_VS + /* glsl */`
      attribute vec3 aVel; attribute vec4 aT; attribute vec3 aCol; attribute vec3 aMisc;
      uniform float uTime, uScale, uRaise, uMinPx, uGain, uFar;
      varying vec3 vCol; varying float vA;
      float h1(float a, float b) { return fract(sin(a * 127.1 + b * 311.7) * 43758.5453); }
      void main() {
        float tau = uTime - aT.x;
        if (tau < 0.0 || tau > aT.y) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vCol = vec3(0.0); return; }
        float k = aT.z, E = (1.0 - exp(-k * tau)) / k;
        vec3 p = position + aVel * E;
        p.y -= ${G.toFixed(2)} * aT.w * (tau - E) / k;
        p.y += uRaise * smoothstep(8.0, 70.0, p.y);
        // beyond the camera's far plane (the display seen from across the city): draw it on a sphere just inside it
        vec3 rel = p - cameraPosition; float rl = length(rel); if (rl > uFar) p = cameraPosition + rel * (uFar / rl);
        float f = tau / aT.y, a = 1.0 - f, kind = aMisc.y, seed = aMisc.z;
        float hold = min(1.0, a * 3.2) * (0.55 + 0.45 * a);
        float b = hold;
        vec3 col = aCol;
        if (kind > ${(KIND.head - 0.5).toFixed(1)}) { b = 1.0; }
        else if (kind > ${(KIND.tail - 0.5).toFixed(1)}) { b = a * a; }
        else if (kind > ${(KIND.glitter - 0.5).toFixed(1)}) { b = (0.4 + 0.6 * h1(seed * 9.1, floor(uTime * 22.0))) * pow(a, 0.6); col = mix(vec3(1.0, 0.42, 0.08), aCol, a); }
        else if (kind > ${(KIND.strobe - 0.5).toFixed(1)}) { b = step(0.62, h1(seed * 91.7, floor(uTime * 17.0))) * 1.9 * min(1.0, a * 3.0); }
        else if (kind > ${(KIND.twinkle - 0.5).toFixed(1)}) { float late = step(0.55, f); b = mix(hold, step(0.5, h1(seed * 53.3, floor(uTime * 30.0))) * 1.7, late); col = mix(aCol, vec3(1.0, 0.92, 0.7), late); }
        col = mix(col, vec3(1.0, 0.96, 0.88), smoothstep(0.12, 0.0, tau) * 0.6);     // white-hot for the first instant
        vec4 mv = viewMatrix * vec4(p, 1.0); mv.xyz += GTO_DH(p.xz);
        gl_Position = projectionMatrix * mv;
        float px = aMisc.x * (0.7 + 0.5 * b) * uScale / max(1.0, min(rl, uFar));
        vA = b * uGain;
        gl_PointSize = clamp(px, uMinPx, 48.0);
        vCol = col;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0 || vA < 0.004) discard;
        float s = 1.0 - d, core = s * s;
        gl_FragColor = vec4((vCol * (core * 1.3 + s * 0.32) + vec3(core * core * core * core * 0.14)) * vA, 1.0);   // (kept under 1 at the centre: a red star stays red)
      }`,
  });
  mat.blending = THREE.CustomBlending; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneFactor; mat.blendEquation = THREE.AddEquation;
  const pts = new THREE.Points(g, mat); pts.name = 'southpark:stars'; pts.frustumCulled = false; pts.renderOrder = 6;
  let cur = 0, lo = cap, hi = 0, wrapped = false, written = 0;
  const P = A.position.array, V = A.aVel.array, TT = A.aT.array, C = A.aCol.array, M = A.aMisc.array;
  return {
    mesh: pts, u, cap,
    get written() { return written; },
    /** the put() callback for emitShell */
    put(ox, oy, oz, vx, vy, vz, t0, life, k, g, r, gg, b, size, kind, seed) {
      const i = cur; cur = cur + 1 === cap ? 0 : cur + 1; if (cur === 0) wrapped = true;
      P[i * 3] = ox; P[i * 3 + 1] = oy; P[i * 3 + 2] = oz; V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
      TT[i * 4] = t0; TT[i * 4 + 1] = life; TT[i * 4 + 2] = k; TT[i * 4 + 3] = g;
      C[i * 3] = r; C[i * 3 + 1] = gg; C[i * 3 + 2] = b; M[i * 3] = size; M[i * 3 + 1] = kind; M[i * 3 + 2] = seed;
      if (i < lo) lo = i; if (i + 1 > hi) hi = i + 1; written++;
    },
    /** upload what put() wrote since the last flush (one range per attribute) */
    flush() {
      if (hi <= lo) return;
      if (wrapped) { lo = 0; hi = cap; wrapped = false; }
      // (markRange folds this into whatever is still waiting to go up: reset() + re-emit + flush in one frame used to
      // clear reset's whole-buffer range again, so the GPU kept the old stars in every slot not re-written — doubled
      // bursts for seconds whenever the detail switched near / far or time jumped)
      for (const k in A) { const a = A[k]; markRange(a, lo * a.itemSize, (hi - lo) * a.itemSize); }
      lo = cap; hi = 0;
    },
    /** forget every particle (a jump in time) */
    reset() { for (let i = 0; i < cap; i++) TT[i * 4] = 1e9; cur = 0; lo = 0; hi = cap; wrapped = false; this.flush(); },
    /** live particles at display time tau (test hook; O(cap)) */
    alive(tau) { let n = 0; for (let i = 0; i < cap; i++) { const d = tau - TT[i * 4]; if (d >= 0 && d <= TT[i * 4 + 1]) n++; } return n; },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

// ------------------------------------------------------------------------------------------------ flashes + smoke
export function createPuffs(cap) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), iT = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), iCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  for (const a of [iPos, iT, iCol]) a.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < cap; i++) iT.array[i * 4] = 1e9;
  g.setAttribute('iPos', iPos); g.setAttribute('iT', iT); g.setAttribute('iCol', iCol);
  g.instanceCount = cap;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const u = { uTime: { value: 0 }, uRaise: { value: 0 }, uGlow: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(1.6, 0.7) }, uNight: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    vertexShader: /* glsl */`` + TERRAIN_VS + /* glsl */`
      attribute vec3 iPos; attribute vec4 iT; attribute vec4 iCol;
      uniform float uTime, uRaise; uniform vec2 uWind;
      varying vec2 vUv; varying vec4 vCol; varying float vF; varying float vTau;
      void main() {
        float tau = uTime - iT.x;
        if (tau < 0.0 || tau > iT.y) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vF = 1.0; vTau = 0.0; vUv = vec2(0.0); vCol = vec4(0.0); return; }
        float f = tau / iT.y;
        vec3 c = iPos;
        c.y += uRaise * smoothstep(8.0, 70.0, c.y);
        float smoke = 1.0 - iCol.w;
        c.xz += uWind * tau * smoke; c.y += (2.2 * pow(tau, 0.7) - 0.25 * tau) * smoke;
        float size = mix(iT.z, iT.w, smoke > 0.5 ? pow(f, 0.6) : f);
        vec4 mv = viewMatrix * vec4(c, 1.0); mv.xyz += GTO_DH(c.xz);
        mv.xy += position.xy * size;
        gl_Position = projectionMatrix * mv;
        vUv = position.xy * 2.0; vCol = iCol; vF = f; vTau = tau;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uGlow; uniform float uNight;
      varying vec2 vUv; varying vec4 vCol; varying float vF; varying float vTau;
      void main() {
        float d = length(vUv);
        if (d > 1.0) discard;
        float s = 1.0 - d;
        if (vCol.w > 0.5) {                                   // flash: additive
          float a = (1.0 - vF); gl_FragColor = vec4(vCol.rgb * s * s * a * a * 0.85, 0.0);
        } else {                                              // smoke: covers a little, lit by whatever is bursting
          float a = smoothstep(0.0, 0.05, vF) * pow(1.0 - vF, 1.4) * s * (0.6 + 0.4 * s) * 0.17;
          vec3 col = mix(vec3(0.42, 0.43, 0.45), vec3(0.085, 0.09, 0.105), uNight) + uGlow * 0.5 + vCol.rgb * exp(-vTau * 1.6) * 0.7;
          gl_FragColor = vec4(col * a, a);
        }
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'southpark:puffs'; mesh.frustumCulled = false; mesh.renderOrder = 5;
  let cur = 0, dirty = false;
  return {
    mesh, u, cap,
    /** kind 0 smoke, 1 flash */
    add(x, y, z, t0, life, s0, s1, r, gg, b, kind) {
      const i = cur; cur = (cur + 1) % cap;
      iPos.array[i * 3] = x; iPos.array[i * 3 + 1] = y; iPos.array[i * 3 + 2] = z;
      iT.array[i * 4] = t0; iT.array[i * 4 + 1] = life; iT.array[i * 4 + 2] = s0; iT.array[i * 4 + 3] = s1;
      iCol.array[i * 4] = r; iCol.array[i * 4 + 1] = gg; iCol.array[i * 4 + 2] = b; iCol.array[i * 4 + 3] = kind;
      dirty = true;
    },
    flush() { if (!dirty) return; dirty = false; iPos.needsUpdate = iT.needsUpdate = iCol.needsUpdate = true; },
    reset() { for (let i = 0; i < cap; i++) iT.array[i * 4] = 1e9; cur = 0; dirty = true; this.flush(); },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

// ------------------------------------------------------------------------------------------------ the crowd
function crowdAtlas() {
  // 4 x 2 figures, each 96 x 192 px, seen from behind / in silhouette: winter coats, hats, scarves, one with a phone up
  const W = 96, H = 192, c = document.createElement('canvas'); c.width = W * 4; c.height = H * 2;
  const g = c.getContext('2d');
  const coats = ['#3a4a6a', '#6a2a2a', '#2f4a3a', '#55504a', '#1f2430', '#7a5a2a', '#4a3a5a', '#2a5a6a'];
  const hats = ['#b03030', null, '#e8e2d0', '#30406a', null, '#2a2a2a', '#c08a20', null];
  const hair = ['#3a2a1a', '#7a5a30', '#1a1a1a', '#5a3a20', '#c0a060', '#2a2018', '#6a3018', '#888078'];
  for (let i = 0; i < 8; i++) {
    const ox = (i % 4) * W, oy = Math.floor(i / 4) * H;
    g.save(); g.translate(ox, oy);
    const cx = W / 2, wide = 1 + ((i * 5) % 3) * 0.08;
    // legs
    g.fillStyle = ['#1c2030', '#2a2a2a', '#30344a', '#3a3026'][i % 4];
    g.fillRect(cx - 15 * wide, 112, 13 * wide, 70); g.fillRect(cx + 2 * wide, 112, 13 * wide, 70);
    g.fillStyle = '#14120f'; g.fillRect(cx - 17 * wide, 180, 16 * wide, 10); g.fillRect(cx + 1 * wide, 180, 16 * wide, 10);
    // coat (shoulders to thigh) + arms
    g.fillStyle = coats[i];
    g.beginPath(); g.moveTo(cx - 22 * wide, 46); g.quadraticCurveTo(cx, 34, cx + 22 * wide, 46); g.lineTo(cx + 20 * wide, 124); g.lineTo(cx - 20 * wide, 124); g.closePath(); g.fill();
    if (i === 3) { g.fillRect(cx + 16, 14, 11, 50); g.fillRect(cx - 30 * wide, 48, 10, 62); g.fillStyle = '#dfe8ff'; g.fillRect(cx + 15, 4, 13, 20); g.fillStyle = coats[i]; }   // filming it on a phone
    else if (i === 6) { g.fillRect(cx - 33, 20, 10, 46); g.fillRect(cx + 23, 20, 10, 46); }                                                                                    // both arms up
    else { g.fillRect(cx - 30 * wide, 48, 10, 62); g.fillRect(cx + 20 * wide, 48, 10, 62); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - 1, 48, 2, 76);
    // scarf
    if (i % 3 !== 1) { g.fillStyle = ['#c8a030', '#a02828', '#e0dccc', '#2a6a4a'][i % 4]; g.fillRect(cx - 12, 38, 24, 9); }
    // head (mostly hair: they are looking away from us, up at the sky)
    g.fillStyle = '#d8b094'; g.beginPath(); g.arc(cx, 24, 13, 0, 7); g.fill();
    g.fillStyle = hair[i]; g.beginPath(); g.arc(cx, 22, 13.5, Math.PI * 0.95, Math.PI * 2.05); g.fill(); g.fillRect(cx - 13.5, 20, 27, 10);
    if (hats[i]) { g.fillStyle = hats[i]; g.beginPath(); g.arc(cx, 19, 14.5, Math.PI, Math.PI * 2); g.fill(); g.fillRect(cx - 15, 17, 30, 7); if (i % 2 === 0) { g.beginPath(); g.arc(cx, 3.5, 5, 0, 7); g.fill(); } }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; t.generateMipmaps = true;
  return t;
}
/** spots: [[x, z, cell, scale, phase, warm], ...] -> {mesh, u, setCount(n)} */
export function createCrowd(spots) {
  const n = spots.length, g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const P = new Float32Array(n * 2), D = new Float32Array(n * 4);
  let sx = 0, sz = 0;
  spots.forEach((s, i) => { P[i * 2] = s[0]; P[i * 2 + 1] = s[1]; D.set([s[2], s[3], s[4], s[5]], i * 4); sx += s[0]; sz += s[1]; });
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 2)); g.setAttribute('iData', new THREE.InstancedBufferAttribute(D, 4));
  g.instanceCount = 0;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(sx / Math.max(1, n), 1, sz / Math.max(1, n)), 160);
  const u = { uTime: { value: 0 }, uMap: { value: crowdAtlas() }, uAmb: { value: new THREE.Color(0.3, 0.32, 0.4) }, uGlow: { value: new THREE.Vector3() }, uFire: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, fog: false,
    vertexShader: /* glsl */`` + TERRAIN_VS + /* glsl */`
      attribute vec2 iPos; attribute vec4 iData;
      uniform float uTime;
      varying vec2 vUv; varying float vWarm; varying float vH;
      void main() {
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]) + vec3(1e-5, 0.0, 0.0));
        float sway = sin(uTime * 1.1 + iData.z * 40.0) * 0.025 * position.y;
        vec3 p = vec3(iPos.x, 0.02, iPos.y) + right * (position.x * 0.92 * iData.y + sway) + vec3(0.0, position.y * 1.84 * iData.y, 0.0);
        float cell = iData.x, cx = mod(cell, 4.0), cy = floor(cell / 4.0);
        vUv = vec2((cx + uv.x) / 4.0, 1.0 - (cy + 1.0 - uv.y) / 2.0);
        vWarm = iData.w * (0.8 + 0.2 * sin(uTime * 7.0 + iData.z * 30.0)); vH = position.y;
        vec4 gtoMv = viewMatrix * vec4(p, 1.0); gtoMv.xyz += GTO_DH(p.xz); gl_Position = projectionMatrix * gtoMv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uAmb; uniform vec3 uGlow; uniform float uFire;
      varying vec2 vUv; varying float vWarm; varying float vH;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        if (t.a < 0.5) discard;
        vec3 light = uAmb + uGlow * (0.5 + 1.3 * vH) + vec3(1.0, 0.5, 0.16) * (vWarm * uFire * 0.9);
        gl_FragColor = vec4(t.rgb * light, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'southpark:crowd'; mesh.castShadow = false; mesh.receiveShadow = false;
  return { mesh, u, n, setCount(k) { g.instanceCount = Math.max(0, Math.min(n, k | 0)); mesh.visible = g.instanceCount > 0; }, get count() { return g.instanceCount; } };
}

// ------------------------------------------------------------------------------------------------ light on the ground
/** quads: [[x, z, radius, kind]] kind 0 = the display (uShow rgb), 1 = bonfire (uFire), 2 = fairground pool (uFair) */
export function createGlow(quads, y = 0.09) {
  const pos = [], uv = [], kd = [], idx = [];
  quads.forEach(([x, z, r, k], i) => {
    pos.push(x - r, y, z - r, x + r, y, z - r, x + r, y, z + r, x - r, y, z + r); uv.push(-1, -1, 1, -1, 1, 1, -1, 1); kd.push(k, k, k, k);
    idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aK', new THREE.Float32BufferAttribute(kd, 1));
  g.setIndex(idx); g.computeBoundingSphere();
  const u = { uShow: { value: new THREE.Vector3() }, uFire: { value: 0 }, uFair: { value: 0 }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -24,
    vertexShader: /* glsl */`` + TERRAIN_VS + /* glsl */`attribute float aK; varying vec2 vUv; varying float vK;
      void main() { vUv = uv; vK = aK; vec4 gtoMv = viewMatrix * vec4(position, 1.0); gtoMv.xyz += GTO_DH(position.xz); gl_Position = projectionMatrix * gtoMv; }`,
    fragmentShader: /* glsl */`uniform vec3 uShow; uniform float uFire, uFair, uTime; varying vec2 vUv; varying float vK;
      void main() {
        float d = length(vUv); if (d > 1.0) discard;
        float s = 1.0 - d; s = s * s;
        vec3 c = vK < 0.5 ? uShow * 0.6 : vK < 1.5 ? vec3(1.0, 0.42, 0.1) * uFire * (0.55 + 0.08 * sin(uTime * 9.0) + 0.06 * sin(uTime * 23.0)) : vec3(1.0, 0.78, 0.45) * uFair * 0.26;
        gl_FragColor = vec4(c * s, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'southpark:glow'; mesh.renderOrder = 2; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  return { mesh, u };
}

// ------------------------------------------------------------------------------------------------ fairground bulbs
/** list: [[x, y, z, r, g, b, phase, size]] */
export function createBulbs(list) {
  const n = list.length, g = new THREE.BufferGeometry(), P = new Float32Array(n * 3), C = new Float32Array(n * 3), M = new Float32Array(n * 2);
  list.forEach((b, i) => { P.set([b[0], b[1], b[2]], i * 3); C.set([b[3], b[4], b[5]], i * 3); M.set([b[6], b[7] || 0.22], i * 2); });
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(C, 3)); g.setAttribute('aMisc', new THREE.BufferAttribute(M, 2));
  g.computeBoundingSphere();
  const u = { uTime: { value: 0 }, uScale: { value: 600 }, uOn: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`` + TERRAIN_VS + /* glsl */`attribute vec3 aCol; attribute vec2 aMisc; uniform float uTime, uScale, uOn; varying vec3 vCol;
      void main() {
        vec4 mv = viewMatrix * vec4(position, 1.0); mv.xyz += GTO_DH(position.xz); gl_Position = projectionMatrix * mv;
        float chase = 0.45 + 0.55 * step(0.5, fract(uTime * 1.6 + aMisc.x));
        vCol = aCol * chase * uOn;
        gl_PointSize = uOn > 0.01 ? clamp(aMisc.y * uScale / max(1.0, -mv.z), 1.5, 7.0) : 0.0;
      }`,
    fragmentShader: /* glsl */`varying vec3 vCol;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float s = 1.0 - d; gl_FragColor = vec4(vCol * (s * 0.8 + s * s * s * 0.5), 1.0); }`,
  });
  const pts = new THREE.Points(g, mat); pts.name = 'southpark:bulbs';
  return { mesh: pts, u };
}

// ------------------------------------------------------------------------------------------------ fairground paint
/** Lambert, vertex colours, plus attribute aGlow (0..1): that share of the vertex colour is emitted when uOn = 1 */
export function fairMaterial() {
  const u = { uOn: { value: 0 } };
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSpOn = u.uOn;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vSpGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSpOn; varying float vSpGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vSpGlow * uSpOn * 1.25;');
  };
  m.customProgramCacheKey = () => 'sp-fair';
  return { material: m, u };
}
