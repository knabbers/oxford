// The outdoor post chain (tiers with `post`): screen-space reflections on wet ground and water, ambient occlusion, sun
// shafts, bloom on emissive lamps / lit windows / fire / neon, a colour grade that follows the hour and the weather, a
// mild vignette. Used through the render hook in core/game.js (game.postRender(renderer, scene, camera) replaces
// renderer.render for the OUTDOOR scene only; interiors and tiers without `post` render exactly as before, zero cost:
// the hook is null and no render targets exist).
//
// Passes (graphics pass 9; each optional one is skipped outright when it has nothing to do):
//   scene   -> HDR target (4x MSAA, half float) with the depth resolved into a texture. The ALPHA channel is the
//              reflection mask the materials write (materials.js): 1 = nothing (every material's default),
//              1 - s = wet ground mirroring with strength s, 2 + s = water. The two ranges sit either side of 1 so that
//              an MSAA edge or a blended transparent only ever weakens a reflection (an additive glow over a wall lands
//              in 1..2 = nothing).
//   gi      -> half resolution, ONE pass: rgb = reflection delta, a = ambient occlusion
//              reflections: every reflector is a horizontal plane, so the reflected ray is marched in view space
//                (14 steps, quadratic spacing, 4 bisections) against the depth; a ray that leaves over the roofs takes
//                the sky pixel it points at; a miss keeps the material's own analytic sky (the delta is 0 there, so
//                nothing pops at the screen edge: it fades). The hit colour is smeared along the screen vertical (5
//                taps, longer on rough wet tarmac than in a puddle) — the stretched streaks of lamps and headlights —
//                and wobbled sideways by the ripples (water: animated; ground: fixed to the world, so nothing swims).
//              occlusion: 6 taps on a spiral rotated by a 4x4 pattern (fixed in screen space: no temporal noise),
//                averaged by the composite's 4 bilinear taps (= a 4x4 box); fades out by 60 m
//   bright  -> quarter resolution: the bloom source (rgb) and the sun-shaft source (a: bright sky near the sun, 0 on
//              anything solid)
//   rays    -> quarter resolution, only while the sun is in front of the camera and low or in mist: 14 taps towards
//              the sun (crepuscular shafts through gaps and trees)
//   blur H, blur V (quarter), composite to the screen (ACES tone mapping + sRGB output applied there).
// Programs: gi, bright, rays, blur, composite — five, all drawn by the loading screen's warm render (the first
// frames after a change run every pass whatever its gate says).
import * as THREE from 'three';
import { GLSL_HASH, WATER_BANK_GLSL } from './materials.js';
import { createFxPost, FX_COMP_PARS, FX_COMP_GLARE, FX_COMP_EXPOSE } from './_fx_post.js';
import { SURF_SHARP, SURF_SHARP_PARS, SURF_SHARP_GLSL } from './_surf_sharpen.js';
import { sunShadowOn, sunShadowOff } from './_px_shadow.js';

const VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const GI_FRAG = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tDepth;
uniform mat4 uProj; uniform mat4 uProjInv; uniform mat3 uCamRot;
uniform vec3 uUp; uniform vec3 uCamPos; uniform vec3 uSkyZen; uniform vec3 uSkyHor;
uniform vec4 uP;      // x: reflections on, y: occlusion on, z: time, w: rain on the puddles 0..1
uniform vec2 uTexel;  // one texel of this (half-res) target
uniform float uBoost; // night: lamps and lit windows are painted well under their real brightness; their mirror images get some of it back
varying vec2 vUv;
vec3 vpos(vec2 uv, float d) { vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
float vz(float d) { vec4 v = uProjInv * vec4(0.0, 0.0, d * 2.0 - 1.0, 1.0); return v.z / v.w; }
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y); }
${GLSL_HASH}${WATER_BANK_GLSL}
void main() {
  float d = texture2D(tDepth, vUv).r;
  if (d >= 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 P = vpos(vUv, d);
  float ao = 1.0;
  if (uP.y > 0.5 && P.z > -48.0) {
    vec3 n = normalize(cross(dFdx(P), dFdy(P)));
    float rad = 0.55 + 0.012 * -P.z;                               // metres: a little wider far away, where a tap is a pixel
    vec2 sr = rad * vec2(uProj[0][0], uProj[1][1]) * 0.5 / -P.z;   // in uv
    vec2 fc = floor(gl_FragCoord.xy);
    float ang = (mod(fc.x, 4.0) * 4.0 + mod(fc.y + fc.x * 2.0, 4.0)) * 0.3927 + 0.2;
    float occ = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i), a = ang + fi * 2.4, r = (fi + 0.6) / 6.0;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r * sr;
      vec3 v = vpos(uv, texture2D(tDepth, uv).r) - P;
      float dd = dot(v, v);
      occ += max(dot(v, n) - 0.05 - 0.014 * -P.z, 0.0) / (dd + 0.02) * (1.0 - smoothstep(rad * rad, rad * rad * 4.0, dd));
    }
    ao = clamp(1.0 - occ * rad * 0.42, 0.0, 1.0);
    ao = mix(ao, 1.0, smoothstep(22.0, 48.0, -P.z));
  }
  vec3 refl = vec3(0.0);
  float am = texture2D(tScene, vUv).a, sg = clamp(1.0 - am, 0.0, 1.0), sw = clamp(am - 2.0, 0.0, 1.0);
  if (uP.x > 0.5 && sg + sw > 0.015) {
    vec3 V = normalize(P), R = reflect(V, uUp);
    float ry = max(dot(R, uUp), 0.0);
    float L = min(45.0 / max(ry, 0.03), 420.0);
    if (R.z > 0.0) L = min(L, (-P.z - 0.3) / R.z);
    float t0 = 0.0, t1 = 0.0, hit = 0.0, thick = 0.0;
    vec2 uv = vUv;
    for (int i = 1; i <= 14; i++) {
      float f = float(i) / 14.0; t1 = L * f * f;
      vec3 Q = P + R * t1;
      vec4 H = uProj * vec4(Q, 1.0); uv = H.xy / H.w * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { hit = -1.0; break; }
      float df = vz(texture2D(tDepth, uv).r) - Q.z;
      thick = abs(R.z) * (t1 - t0) * 1.6 + 0.5 + 0.03 * -Q.z;
      if (df > 0.0 && df < thick) { hit = 1.0; break; }
      t0 = t1;
    }
    float conf = 0.0;
    if (hit > 0.5) {
      for (int i = 0; i < 4; i++) {
        float tm = 0.5 * (t0 + t1);
        vec3 Q = P + R * tm; vec4 H = uProj * vec4(Q, 1.0); vec2 u2 = H.xy / H.w * 0.5 + 0.5;
        float df = vz(texture2D(tDepth, u2).r) - Q.z;
        if (df > 0.0 && df < thick) { t1 = tm; uv = u2; } else t0 = tm;
      }
      conf = 1.0;
    } else if (hit > -0.5) {
      // over the roofs: the sky the ray points at, if that is sky on the screen
      vec4 H = uProj * vec4(R, 0.0);
      if (H.w > 0.0) { uv = H.xy / H.w * 0.5 + 0.5; if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 && texture2D(tDepth, uv).r >= 1.0) conf = 1.0; }
    }
    if (conf > 0.0) {
      vec3 W = uCamPos + uCamRot * P;
      float dy = max(uv.y - vUv.y, 0.0);
      // ripples: the image is pushed sideways and up and down by the surface's slope, more the further it travelled
      float wob, spread;
      if (sw > sg) {
        float t = uP.z;
        // stone pass (2026-11): against a high-contrast sky (dusk: bright horizon, dark zenith, lit clouds) the ripples
        // threw the mirrored clouds about in hard orange / dark bands. Longer, gentler ripples and a longer vertical
        // smear as the contrast rises (wSkyContrast, shared with the water material), and less wobble far off
        float kc = wSkyContrast(uSkyHor, uSkyZen);
        wob = (vn(W.xz * mix(1.1, 0.55, kc) + vec2(t * 0.5, t * 0.3)) + 0.5 * vn(W.xz * mix(3.1, 1.6, kc) - vec2(t * 0.7, -t * 0.4)) - 0.75) * 0.06 * mix(1.0, 0.4, kc) / (1.0 + 0.01 * -P.z);
        spread = mix(0.035, 0.08, kc);
      } else {
        wob = (vn(W.xz * 2.3) + 0.5 * vn(W.xz * 7.1) - 0.75) * 0.05;
        if (uP.w > 0.0) wob += (vn(W.xz * 5.0 + vec2(0.0, uP.z * 3.0)) - 0.5) * 0.05 * uP.w;
        spread = mix(0.13, 0.03, smoothstep(0.08, 0.3, sg));
      }
      uv.x += wob * dy; uv.y += wob * dy * 0.35;
      float sp = spread * dy + uTexel.y * 0.75;
      vec3 c = texture2D(tScene, uv).rgb * 0.34
        + (texture2D(tScene, uv + vec2(0.0, sp)).rgb + texture2D(tScene, uv - vec2(0.0, sp)).rgb) * 0.22
        + (texture2D(tScene, uv + vec2(0.0, sp * 2.3)).rgb + texture2D(tScene, uv - vec2(0.0, sp * 2.3)).rgb) * 0.11;
      c *= 1.0 + uBoost * smoothstep(0.25, 1.6, max(c.r, max(c.g, c.b)));
      c = min(c, vec3(9.0));
      float e = min(min(uv.x, 1.0 - uv.x) * 14.0, (1.0 - uv.y) * 9.0);
      conf *= clamp(e, 0.0, 1.0);
      vec3 Rw = uCamRot * R;
      vec3 sky = sw > sg ? wWaterSky(Rw, Rw, W.xz, uSkyHor, uSkyZen) : mix(uSkyHor, uSkyZen, clamp(Rw.y * 1.6, 0.0, 1.0));   // (water: the material's own mirrored sky and far bank, materials.js WATER_BANK_GLSL)
      refl = (c - sky) * conf;
    }
  }
  gl_FragColor = vec4(refl, ao);
}`;

// A/B switches for measuring (tools/pixelcost.mjs): `?msaa=0|2|4` (samples of the scene target; 4), `?hdr=8` (an 8-bit
// scene target: WRONG picture — bright things clip — for timing the format only), `?onepass=0`. post.retune({samples,
// type}) rebuilds the targets at run time.
const TUNE = { samples: 4, type: THREE.HalfFloatType, onePass: true, resolve: 'full' };
try {
  const q = new URLSearchParams(location.search);
  if (q.get('msaa') !== null && isFinite(+q.get('msaa'))) TUNE.samples = Math.max(0, Math.min(8, +q.get('msaa') | 0));
  if (q.get('hdr') === '8') TUNE.type = THREE.UnsignedByteType;
  if (q.get('onepass') === '0') TUNE.onePass = false;
} catch (e) { /* no location */ }

export function createPost(game) {
  const R = game.renderer;
  let rt = null, gi = null, a = null, b = null, rays = null, w = 0, h = 0, warm = 4;
  const opt = { refl: true, ao: true, rays: true, glare: false, adapt: false, sun4: false, onePass: false };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad); qs.matrixWorldAutoUpdate = false;
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mk = (name, uniforms, fragmentShader, extra = {}) => { const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false, ...extra }); m.name = 'post:' + name; return m; };

  const fx = createFxPost(R, mk, (m, t) => pass(m, t));      // shader pass 10: glare, eye adaptation (world/_fx_post.js)
  const giMat = mk('gi', {
    tScene: { value: null }, tDepth: { value: null }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() }, uCamRot: { value: new THREE.Matrix3() },
    uUp: { value: new THREE.Vector3(0, 1, 0) }, uCamPos: { value: new THREE.Vector3() }, uSkyZen: { value: new THREE.Color() }, uSkyHor: { value: new THREE.Color() },
    uP: { value: new THREE.Vector4() }, uTexel: { value: new THREE.Vector2() }, uBoost: { value: 0 },
  }, GI_FRAG);
  const bright = mk('bright', { tSrc: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 0.8 }, uSun: { value: new THREE.Vector4() }, uAspect: { value: 1 } }, /* glsl */`
    uniform sampler2D tSrc; uniform sampler2D tDepth; uniform vec2 uTexel; uniform float uThresh; uniform vec4 uSun; uniform float uAspect; varying vec2 vUv;
    void main() {
      vec3 c0 = texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb, c1 = texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb, c2 = texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb, c3 = texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb;
      float l0 = max(c0.r, max(c0.g, c0.b)), l1 = max(c1.r, max(c1.g, c1.b)), l2 = max(c2.r, max(c2.g, c2.b)), l3 = max(c3.r, max(c3.g, c3.b));
      vec3 c = c0 * smoothstep(uThresh, uThresh * 2.2, l0) + c1 * smoothstep(uThresh, uThresh * 2.2, l1) + c2 * smoothstep(uThresh, uThresh * 2.2, l2) + c3 * smoothstep(uThresh, uThresh * 2.2, l3);
      float s = 0.0;
      if (uSun.z > 0.0) {
        // the shaft source: open sky near the sun, by its own brightness (a deck or a cloud over the sun dims it)
        vec2 q = (vUv - uSun.xy) * vec2(uAspect, 1.0);
        float sky = step(1.0, texture2D(tDepth, vUv).r);
        s = sky * clamp((l0 + l1 + l2 + l3) * 0.25 * uSun.w - 0.25, 0.0, 1.0) * (1.0 - smoothstep(0.1, 0.9, length(q)));
      }
      gl_FragColor = vec4(min(c * 0.25, vec3(12.0)), s);
    }`);
  const rayMat = mk('rays', { tSrc: { value: null }, uSun: { value: new THREE.Vector4() } }, /* glsl */`
    uniform sampler2D tSrc; uniform vec4 uSun; varying vec2 vUv;
    void main() {
      vec2 d = (uSun.xy - vUv) * (0.9 / 14.0);
      float s = 0.0, w = 1.0, ws = 0.0; vec2 uv = vUv;
      for (int i = 0; i < 14; i++) { s += texture2D(tSrc, uv).a * w; ws += w; w *= 0.9; uv += d; }
      gl_FragColor = vec4(s / ws);
    }`);
  const blur = mk('blur', { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, /* glsl */`uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
        c += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
        c += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.070;
        gl_FragColor = vec4(c, 1.0);
      }`);
  const comp = mk('composite', {
    tScene: { value: null }, tBloom: { value: null }, tGi: { value: null }, tRays: { value: null }, uBloom: { value: 0.65 }, uVig: { value: 0.22 }, uNight: { value: 0 },
    uGi: { value: new THREE.Vector4() },         // x: reflection strength, y: occlusion strength, zw: one gi texel
    uRayCol: { value: new THREE.Color() },       // sun colour x shaft strength (0 = no shafts)
    uWarm: { value: new THREE.Color(1.03, 1.0, 0.95) }, uCool: { value: new THREE.Color(-0.002, 0.0, 0.004) }, uSat: { value: 1.06 },
    ...fx.uniforms, ...SURF_SHARP.uniforms,
  }, /* glsl */`${FX_COMP_PARS}${SURF_SHARP_PARS}
      uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tGi; uniform sampler2D tRays; uniform float uBloom; uniform float uVig; uniform float uNight;
      uniform vec4 uGi; uniform vec3 uRayCol; uniform vec3 uWarm; uniform vec3 uCool; uniform float uSat; varying vec2 vUv;
      void main() {
        vec4 sc = texture2D(tScene, vUv);
        vec3 c = sc.rgb;
        ${SURF_SHARP_GLSL}
        if (uGi.x + uGi.y > 0.0) {
          vec4 g = texture2D(tGi, vUv + uGi.zw * vec2(-1.0, -1.0)) + texture2D(tGi, vUv + uGi.zw * vec2(1.0, -1.0)) + texture2D(tGi, vUv + uGi.zw * vec2(-1.0, 1.0)) + texture2D(tGi, vUv + uGi.zw * vec2(1.0, 1.0));
          g *= 0.25;
          float s = clamp(1.0 - sc.a, 0.0, 1.0) + clamp(sc.a - 2.0, 0.0, 1.0);
          c = max(c + g.rgb * s * uGi.x, vec3(0.0));
          // occlusion takes the ambient share: bright (sunlit, lamplit, emissive) pixels keep most of their light
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c *= mix(1.0, g.a, uGi.y * (1.0 - 0.6 * smoothstep(0.25, 1.4, lum)));
        }
        c += texture2D(tBloom, vUv).rgb * uBloom * (0.45 + 0.55 * uNight);
        ${FX_COMP_GLARE}
        c += uRayCol * texture2D(tRays, vUv).r;
        ${FX_COMP_EXPOSE}
        // grade (linear, before tone mapping): warmth in the light, a cool lift in the darks — both follow the hour
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, c * uWarm, smoothstep(0.05, 0.8, l));
        c += uCool * (1.0 - smoothstep(0.0, 0.12, l));
        c = mix(vec3(l), c, uSat);
        vec2 q = vUv - 0.5; c *= 1.0 - uVig * smoothstep(0.18, 0.75, dot(q, q) * 1.6);
        gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`, { toneMapped: true });

  const size = new THREE.Vector2(), sunV = new THREE.Vector3();
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  function ensure() {
    R.getDrawingBufferSize(size);
    const W = Math.max(1, size.x | 0), H = Math.max(1, size.y | 0);
    if (rt && W === w && H === h) return;
    w = W; h = H;
    if (!rt) {
      // (the depth is resolved out of the 4x MSAA buffers into a texture for the gi and bright passes: ~0.2 ms at a 720p
      //  buffer on a Radeon Pro 460, more in proportion at the 1080p cap of world/quality.js; nothing here depends on the size)
      // (a STENCIL buffer with it: the openings of walk-in rooms are marked in it — core/_roomview.js — so the room
      //  itself and its people are drawn through its windows on this path as on the screen; the stencil is not resolved)
      const depth = new THREE.DepthTexture(W, H); depth.format = THREE.DepthStencilFormat; depth.type = THREE.UnsignedInt248Type; depth.minFilter = depth.magFilter = THREE.NearestFilter;
      rt = new THREE.WebGLRenderTarget(W, H, { type: TUNE.type, samples: TUNE.samples, depthBuffer: true, stencilBuffer: true, depthTexture: depth, resolveDepthBuffer: true, resolveStencilBuffer: false });
      const o = { type: THREE.HalfFloatType, depthBuffer: false };
      gi = new THREE.WebGLRenderTarget(1, 1, o); a = new THREE.WebGLRenderTarget(1, 1, o); b = new THREE.WebGLRenderTarget(1, 1, o); rays = new THREE.WebGLRenderTarget(1, 1, o);
      warm = 4;
      if (R.linkWait) R.linkWait.target = rt;      // (core/_lazylink.js: this target is the picture itself)
    }
    rt.setSize(W, H);
    const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1), qw = Math.max(1, W >> 2), qh = Math.max(1, H >> 2);
    gi.setSize(hw, hh); a.setSize(qw, qh); b.setSize(qw, qh); rays.setSize(qw, qh);
    bright.uniforms.uTexel.value.set(1 / W, 1 / H); bright.uniforms.uAspect.value = W / H;
    giMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    comp.uniforms.uGi.value.z = 0.5 / hw; comp.uniforms.uGi.value.w = 0.5 / hh;
    fx.setSize(W, H);
  }
  // ONE resolve of the multisampled scene target a frame. three resolves (and then invalidates) a multisampled target at
  // the end of every render into it; the walk-in rooms and their people are further renders into the same target after
  // the world's (core/interiors.js afterWorld), each of which would resolve the whole screen again — and draw over
  // samples the driver had been told it may throw away. While `hold` is set those per-render resolves are skipped; the
  // one real resolve (colour + depth) is done here once everything is in.
  // ...and ONE render pass (pixel-cost pass, 2026-11). Round each of those skipped resolves three still binds the
  // resolve framebuffer for drawing and then the multisampled one again, and to the driver (ANGLE on Metal) a change of
  // draw framebuffer ends the render pass: the next draw starts a new one, which stores and reloads the whole 4x
  // half-float colour and depth — measured 2.3 ms on a Radeon Pro 460 at 1080p for EACH room in sight, whatever its
  // size on screen (five rooms at Worcester's front: 11 ms of a 51 ms frame for nothing). While `hold` is set the
  // binds of three's resolve sequence (READ = the multisampled framebuffer ... DRAW = the multisampled framebuffer
  // again) are dropped with the blit they were for, so the world, its rooms and their people are one pass (the top tier:
  // `opt.onePass`; other tiers bind as before). three's own
  // record of the bindings ends as it would have (READ none, DRAW multisampled) and resolve() below binds through it.
  // `?onepass=0`: as before (A/B).
  const gl = R.getContext ? R.getContext() : null;
  let hold = false, blit = null, msFb = null, seq = false;
  if (gl && gl.blitFramebuffer && gl.invalidateFramebuffer && R.state && R.state.bindFramebuffer && R.properties) {
    blit = gl.blitFramebuffer.bind(gl); const inval = gl.invalidateFramebuffer.bind(gl);
    if (TUNE.onePass && gl.bindFramebuffer && gl.READ_FRAMEBUFFER) {
      const bind = gl.bindFramebuffer.bind(gl), READ = gl.READ_FRAMEBUFFER, DRAW = gl.DRAW_FRAMEBUFFER;
      gl.bindFramebuffer = function (t, f) {
        if (hold && msFb && opt.onePass) {      // (the top tier only: opt.onePass)
          if (!seq && t === READ && f === msFb) { seq = true; return; }
          if (seq) { if (t === READ) return; if (t === DRAW) { if (f === msFb) seq = false; return; } seq = false; }      // (anything else: not three's sequence after all)
        }
        bind(t, f);
      };
    }
    gl.blitFramebuffer = function (a, b, c, d, e, f, g, h, i, j) { if (seq) return; if (hold && msFb && gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) === msFb) return; blit(a, b, c, d, e, f, g, h, i, j); };
    gl.invalidateFramebuffer = function (t, l) { if (hold || seq) return; inval(t, l); };
  }
  function resolve() {
    const p = R.properties.get(rt), ms = p.__webglMultisampledFramebuffer, fb = p.__webglFramebuffer, S = R.state; if (!ms || !fb) return;
    S.bindFramebuffer(gl.READ_FRAMEBUFFER, ms); S.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb);
    if (S.setScissorTest) S.setScissorTest(false); else gl.disable(gl.SCISSOR_TEST);      // (a blit is cut by the scissor)
    if (TUNE.resolve !== 'none') blit(0, 0, w, h, 0, 0, w, h, TUNE.resolve === 'color' ? gl.COLOR_BUFFER_BIT : gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);      // (TUNE.resolve: measuring only)
    S.bindFramebuffer(gl.READ_FRAMEBUFFER, null); S.bindFramebuffer(gl.DRAW_FRAMEBUFFER, ms);
    R.setRenderTarget(null); R.setRenderTarget(rt);      // (three's own scissor / viewport state for the target, as it left it)
  }
  function pass(mat, target) { quad.material = mat; R.setRenderTarget(target); R.render(qs, qc); }

  const st = { passes: 0, refl: false, ao: false, rays: false };
  const P = {
    enabled: false, stats: st,
    render(renderer, scene, camera) {
      ensure();
      const prevTarget = R.getRenderTarget();
      R.setRenderTarget(rt);
      const sun4 = opt.sun4 && scene === game.worldScene && !!(game.world && game.world.sun);      // pixel-cost pass: the sun's shadow by hardware comparison (world/_px_shadow.js), top tier, world scene only
      const skyl = scene === game.worldScene && game.world && game.world.skylight ? game.world.skylight : null;      // (world/_fx_skylight.js: only the world scene reads the sky-light map)
      if (blit) {
        msFb = R.properties.get(rt).__webglMultisampledFramebuffer || null; hold = !!msFb;
        try {
          if (skyl) skyl.on();
          if (sun4) sunShadowOn(R, game.world.sun);
          try { R.render(scene, camera); } finally { if (skyl) skyl.off(); if (sun4) sunShadowOff(); }
          if (!hold) { msFb = R.properties.get(rt).__webglMultisampledFramebuffer || null; hold = !!msFb; }      // (a target whose buffers its first render made)
          if (scene === game.worldScene && game.interiors && game.interiors.afterWorld) game.interiors.afterWorld(R, camera);      // walk-in rooms near by, in place (core/interiors.js)
        } finally { const was = hold; hold = false; seq = false; if (was) resolve(); }
      } else {
        if (skyl) skyl.on();
        if (sun4) sunShadowOn(R, game.world.sun);
        try { R.render(scene, camera); } finally { if (skyl) skyl.off(); if (sun4) sunShadowOff(); }
        if (scene === game.worldScene && game.interiors && game.interiors.afterWorld) game.interiors.afterWorld(R, camera);
      }
      const sm = R.shadowMap.autoUpdate, smN = R.shadowMap.needsUpdate; R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false;     // full-screen passes: no shadow work
      const W = game.world, sky = W && W.sky, U = W && W.uniforms, G = sky && sky.grade, all = warm > 0;
      if (warm > 0) warm--;
      let n = 4;
      // ---- reflections + occlusion (half res)
      const wantR = opt.refl && (all || !sky || sky.reflective !== false), wantA = opt.ao;
      const cu = comp.uniforms;
      if (wantR || wantA || all) {
        const u = giMat.uniforms;
        u.tScene.value = rt.texture; u.tDepth.value = rt.depthTexture;
        u.uProj.value.copy(camera.projectionMatrix); u.uProjInv.value.copy(camera.projectionMatrixInverse);
        u.uCamRot.value.setFromMatrix4(camera.matrixWorld); u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
        u.uUp.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
        if (U) { u.uSkyZen.value.copy(U.skyZen.value); u.uSkyHor.value.copy(U.skyHor.value); }
        u.uBoost.value = 1.6 * (W ? W.night : 0);
        u.uP.value.set(wantR ? 1 : 0, wantA ? 1 : 0, U ? U.time.value % 1000 : 0, U ? U.wetv.value.w : 0);
        pass(giMat, gi); n++;
        cu.tGi.value = gi.texture; cu.uGi.value.x = wantR ? 1 : 0; cu.uGi.value.y = wantA ? (G ? G.ao : 0.8) : 0;
      } else { cu.tGi.value = black; cu.uGi.value.x = 0; cu.uGi.value.y = 0; }
      st.refl = wantR; st.ao = wantA;
      // ---- bloom source (+ the shaft source in alpha), shafts
      let rayK = 0;
      if (opt.rays && sky && sky.shafts) {
        const S = sky.shafts;                    // {k: strength 0..1, dir: unit vector to the sun, col}
        if (S.k > 0.003) {
          sunV.copy(S.dir).transformDirection(camera.matrixWorldInverse);
          if (sunV.z < -0.05) {
            const e = camera.projectionMatrix.elements;                 // (a direction: the point at infinity, w = -z)
            const sx = (e[0] * sunV.x + e[8] * sunV.z) / -sunV.z * 0.5 + 0.5, sy = (e[5] * sunV.y + e[9] * sunV.z) / -sunV.z * 0.5 + 0.5;
            // fades as the sun leaves the screen
            const off = Math.max(Math.abs(sx - 0.5) - 0.5, Math.abs(sy - 0.5) - 0.5, 0);
            rayK = S.k * Math.max(0, 1 - off / 0.45);
            if (rayK > 0.003) { bright.uniforms.uSun.value.set(sx, sy, 1, S.gain); rayMat.uniforms.uSun.value.set(sx, sy, 0, 0); cu.uRayCol.value.copy(S.col).multiplyScalar(rayK); }
          }
        }
      }
      if (all && rayK <= 0.003) { rayK = 0.004; bright.uniforms.uSun.value.set(0.5, 0.5, 1, 1); cu.uRayCol.value.setRGB(0, 0, 0); }
      if (rayK <= 0.003) bright.uniforms.uSun.value.z = 0;
      bright.uniforms.tSrc.value = rt.texture; bright.uniforms.tDepth.value = rt.depthTexture; pass(bright, a);
      if (rayK > 0.003) { rayMat.uniforms.tSrc.value = a.texture; pass(rayMat, rays); cu.tRays.value = rays.texture; n++; }
      else { cu.tRays.value = black; cu.uRayCol.value.setRGB(0, 0, 0); }
      st.rays = rayK > 0.003;
      blur.uniforms.tSrc.value = a.texture; blur.uniforms.uDir.value.set(1 / a.width, 0); pass(blur, b);
      blur.uniforms.tSrc.value = b.texture; blur.uniforms.uDir.value.set(0, 1 / a.height); pass(blur, a);
      cu.tScene.value = rt.texture; cu.tBloom.value = a.texture;
      n += fx.run({ scene: rt.texture, depth: rt.depthTexture, bloom: a, glare: opt.glare, adapt: opt.adapt, all, sky, night: W ? W.night : 0, part: !!(camera.view && camera.view.enabled) || rt.scissorTest });
      cu.uNight.value = W ? W.night : 0;
      if (G) { cu.uWarm.value.copy(G.warm); cu.uCool.value.copy(G.cool); cu.uSat.value = G.sat; }
      pass(comp, prevTarget);
      // (the canvas halves of the rooms' warm-up draws, in this same pass on the canvas: core/interiors.js NO_WARMPASS)
      if (prevTarget === null && scene === game.worldScene && game.interiors && game.interiors.afterComposite) { try { game.interiors.afterComposite(R); } catch (e) { /* taken again next frame */ } }
      st.passes = n;
      R.shadowMap.autoUpdate = sm; R.shadowMap.needsUpdate = smN;
    },
    /** on/off from the quality tier; off frees the targets (zero cost). o: {refl, ao, rays} switch the optional passes (no recompile) */
    set(on, o = null) {
      if (o) { opt.refl = o.refl !== false; opt.ao = o.ao !== false; opt.rays = o.rays !== false; opt.glare = !!o.glare; opt.adapt = !!o.adapt; opt.sun4 = !!o.sun4; opt.onePass = !!o.onePass; }
      P.enabled = !!on;
      game.postRender = on ? P.render : null;
      if (!on && rt) { rt.depthTexture.dispose(); rt.dispose(); gi.dispose(); a.dispose(); b.dispose(); rays.dispose(); rt = gi = a = b = rays = null; w = h = 0; fx.dispose(); if (R.linkWait) R.linkWait.target = null; }
    },
    get options() { return opt; },
    /** measuring only: rebuild the scene target with other samples / type */
    retune(o) { const on = P.enabled; if (on) P.set(false); Object.assign(TUNE, o); if (on) P.set(true); return { ...TUNE }; },
    /** render.stencil: the scene target has a stencil buffer (core/interiors.js: rooms are drawn through it as on the screen) */
    /** the HDR scene target while the pass is on (else null): world.compileAsync compiles new materials for it ahead of use */
    target() { if (!P.enabled) return null; ensure(); return rt; },
    /** is the world, with what is drawn after it, one render pass in the scene target this frame? (the top tier: the resolves between are held) */
    inPass() { return !!(P.enabled && blit && TUNE.onePass && opt.onePass); },
    uniforms: { bloom: comp.uniforms.uBloom, vignette: comp.uniforms.uVig, threshold: bright.uniforms.uThresh },
    fx,
  };
  P.render.stencil = true;
  return P;
}
