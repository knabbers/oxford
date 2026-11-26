// Shader pass 10, the post chain's two additions (world/post.js runs them; both are tier fields with URL switches):
//
//   glare  (?glare=0)  light scattered on its way to the eye. The bloom of post.js is a tight glow (a few pixels at
//          1080p) — right for clear air. In rain, drizzle, mist and fog every lamp, lit window and headlamp stands in
//          a broad soft halo, and at night even clear air (and the eye itself) spreads a faint veil round a bright
//          lamp. Three more levels are taken down from the blurred bloom (1/8, 1/16, 1/32 of the screen: 13-tap
//          downsamples) and summed back up (tent upsample), and the composite adds the result by the weather: nothing
//          to speak of on a clear day, a little on a clear night, most in mist and rain after dark. Five passes over
//          very small targets.
//   adapt  (?adapt=0)  the eye's (or a camera's) exposure following what is in front of it. The frame's log-average
//          luminance (centre-weighted, the sky counted less) is measured in a 32 x 18 target, compared with what the
//          hour and the weather are expected to give (the `key`, from the sun and the sky fill themselves), and the
//          picture is exposed up to +0.5 EV in a dark lane, under trees or looking into shade, and down to -0.35 EV
//          facing a bright sky or sunlit stone; quick to stop down (0.6 s), slower to open up (2 s), as the eye is.
//          The night stays dark: the key follows the hour, so only the difference from the expected scene is corrected.
//          Held still while the frame is only part of the screen (the world seen through a room's windows).
// Programs: fx:down, fx:up, fx:lum, fx:adapt — four, all drawn in the post chain's warm frames.
import * as THREE from 'three';

/** composite: declarations, the glare added after the bloom, the exposure before the grade */
export const FX_COMP_PARS = /* glsl */`uniform sampler2D tGlare; uniform sampler2D tAdapt; uniform vec4 uFx;`;
export const FX_COMP_GLARE = /* glsl */`c += texture2D(tGlare, vUv).rgb * uFx.x;`;
export const FX_COMP_EXPOSE = /* glsl */`c *= mix(1.0, texture2D(tAdapt, vec2(0.5)).r, uFx.y);`;

const DOWN_FS = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
vec3 d(float x, float y) { return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
void main() {
  vec3 c = d(0.0, 0.0) * 0.125 + (d(-1.0, -1.0) + d(1.0, -1.0) + d(-1.0, 1.0) + d(1.0, 1.0)) * 0.125
    + (d(-2.0, 0.0) + d(2.0, 0.0) + d(0.0, -2.0) + d(0.0, 2.0)) * 0.0625 + (d(-2.0, -2.0) + d(2.0, -2.0) + d(-2.0, 2.0) + d(2.0, 2.0)) * 0.03125;
  gl_FragColor = vec4(c, 1.0);
}`;
const UP_FS = /* glsl */`
uniform sampler2D tA; uniform sampler2D tB; uniform vec2 uTexel; uniform vec2 uW; varying vec2 vUv;
vec3 b(float x, float y) { return texture2D(tB, vUv + vec2(x, y) * uTexel).rgb; }
void main() {
  vec3 u = b(0.0, 0.0) * 0.25 + (b(-1.0, 0.0) + b(1.0, 0.0) + b(0.0, -1.0) + b(0.0, 1.0)) * 0.125 + (b(-1.0, -1.0) + b(1.0, -1.0) + b(-1.0, 1.0) + b(1.0, 1.0)) * 0.0625;
  gl_FragColor = vec4(texture2D(tA, vUv).rgb * uW.x + u * uW.y, 1.0);
}`;
const LUM_FS = /* glsl */`
uniform sampler2D tSrc; uniform sampler2D tDepth; uniform vec2 uStep; varying vec2 vUv;
void main() {
  // r: the mean log luminance of this cell (16 bilinear taps over it), g: its weight (sky counts a third)
  float s = 0.0, w = 0.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
    vec2 uv = vUv + (vec2(float(x), float(y)) - 1.5) * uStep;
    float k = texture2D(tDepth, uv).r >= 1.0 ? 0.3 : 1.0;
    s += log(dot(min(texture2D(tSrc, uv).rgb, vec3(8.0)), vec3(0.2126, 0.7152, 0.0722)) + 0.003) * k; w += k;
  }
  gl_FragColor = vec4(s / w, w / 16.0, 0.0, 1.0);
}`;
const ADAPT_FS = /* glsl */`
uniform sampler2D tLum; uniform sampler2D tPrev; uniform vec4 uA;   // x: key (linear luminance expected), y: 1 - exp(-dt / tau down), z: the same, up, w: 1 = hold
uniform vec2 uLim;
void main() {
  float s = 0.0, w = 0.0;
  for (int y = 0; y < 9; y++) for (int x = 0; x < 16; x++) {
    vec2 uv = (vec2(float(x), float(y)) * 2.0 + 1.0) / vec2(32.0, 18.0);
    vec4 l = texture2D(tLum, uv);
    vec2 q = uv - vec2(0.5, 0.45);
    float k = l.g * (1.0 - 0.75 * smoothstep(0.0, 0.3, dot(q, q)));
    s += l.r * k; w += k;
  }
  float L = exp(s / max(w, 1e-4));
  float want = clamp(pow(uA.x / max(L, 1e-4), 0.5), uLim.x, uLim.y);
  float prev = texture2D(tPrev, vec2(0.5)).r;
  if (uA.w > 1.5) prev = 1.0;
  float next = uA.w > 0.5 && uA.w < 1.5 ? prev : prev + (want - prev) * (want < prev ? uA.y : uA.z);
  gl_FragColor = vec4(next, L, want, 1.0);
}`;

/**
 * mk(name, uniforms, fragmentShader) and pass(material, target) are post.js's own (one quad, one scene).
 * -> { uniforms (to spread into the composite's), setSize(W, H), dispose(), run(o), stats }
 */
export function createFxPost(R, mk, pass) {
  const one = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); one.needsUpdate = true;
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  const U = { tGlare: { value: black }, tAdapt: { value: one }, uFx: { value: new THREE.Vector4(0, 0, 0, 0) } };
  const down = mk('fxDown', { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, DOWN_FS); down.name = 'fx:down';
  const up = mk('fxUp', { tA: { value: null }, tB: { value: null }, uTexel: { value: new THREE.Vector2() }, uW: { value: new THREE.Vector2(1, 1) } }, UP_FS); up.name = 'fx:up';
  const lum = mk('fxLum', { tSrc: { value: null }, tDepth: { value: null }, uStep: { value: new THREE.Vector2() } }, LUM_FS); lum.name = 'fx:lum';
  const adapt = mk('fxAdapt', { tLum: { value: null }, tPrev: { value: null }, uA: { value: new THREE.Vector4() }, uLim: { value: new THREE.Vector2(0.78, 1.42) } }, ADAPT_FS); adapt.name = 'fx:adapt';
  let g1 = null, g2 = null, g3 = null, u2 = null, u1 = null, lumT = null, ad = [null, null], cur = 0, init = true, lastT = 0, glareK = 0;
  const st = { glare: false, adapt: false, passes: 0, key: 0 }, buf = new Float32Array(4);
  function make() {
    const o = { type: THREE.HalfFloatType, depthBuffer: false };
    g1 = new THREE.WebGLRenderTarget(1, 1, o); g2 = new THREE.WebGLRenderTarget(1, 1, o); g3 = new THREE.WebGLRenderTarget(1, 1, o);
    u2 = new THREE.WebGLRenderTarget(1, 1, o); u1 = new THREE.WebGLRenderTarget(1, 1, o);
    lumT = new THREE.WebGLRenderTarget(32, 18, o);
    const p = { type: THREE.FloatType, depthBuffer: false, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter };
    ad[0] = new THREE.WebGLRenderTarget(1, 1, R.extensions && R.extensions.has && R.extensions.has('EXT_color_buffer_float') ? p : { ...p, type: THREE.HalfFloatType }); ad[1] = ad[0].clone();
    init = true;
  }
  const fx = {
    uniforms: U, stats: st,
    setSize(W, H) {
      if (!g1) make();
      const s = (t, k) => t.setSize(Math.max(1, W >> k), Math.max(1, H >> k));
      s(g1, 3); s(u1, 3); s(g2, 4); s(u2, 4); s(g3, 5);
      lum.uniforms.uStep.value.set(1 / (32 * 4), 1 / (18 * 4));
    },
    dispose() { if (!g1) return; for (const t of [g1, g2, g3, u2, u1, lumT, ad[0], ad[1]]) t.dispose(); g1 = g2 = g3 = u2 = u1 = lumT = null; ad = [null, null]; U.tGlare.value = black; U.tAdapt.value = one; U.uFx.value.set(0, 0, 0, 0); },
    /**
     * o: { scene: the HDR scene texture, depth, bloom: the blurred quarter-res bloom target, glare, adapt: the tier's
     *      switches, all: a warm frame (every pass runs), sky: world.sky (or null), night 0..1, part: the frame is only
     *      part of the screen }
     */
    run(o) {
      let n = 0;
      const sky = o.sky, W = sky && sky.weather, night = o.night || 0;
      // ---- glare: how much the air (and the eye) scatters
      let k = 0;
      if (o.glare) {
        const fog = W ? Math.min(1, W.fog * 1.2 + W.mist * 0.5) : 0, rain = W ? Math.min(1, W.rain * 1.4) : 0;
        const air = Math.min(1, fog + rain);
        k = (0.05 + 0.16 * night) + air * (0.1 + 0.62 * night);
      }
      glareK += (k - glareK) * 0.1;
      if ((o.glare && glareK > 0.004) || o.all) {
        const b = o.bloom;
        down.uniforms.tSrc.value = b.texture; down.uniforms.uTexel.value.set(1 / b.width, 1 / b.height); pass(down, g1);
        down.uniforms.tSrc.value = g1.texture; down.uniforms.uTexel.value.set(1 / g1.width, 1 / g1.height); pass(down, g2);
        down.uniforms.tSrc.value = g2.texture; down.uniforms.uTexel.value.set(1 / g2.width, 1 / g2.height); pass(down, g3);
        up.uniforms.tA.value = g2.texture; up.uniforms.tB.value = g3.texture; up.uniforms.uTexel.value.set(1 / g3.width, 1 / g3.height); up.uniforms.uW.value.set(0.55, 0.45); pass(up, u2);
        up.uniforms.tA.value = g1.texture; up.uniforms.tB.value = u2.texture; up.uniforms.uTexel.value.set(1 / u2.width, 1 / u2.height); up.uniforms.uW.value.set(0.4, 0.6); pass(up, u1);
        U.tGlare.value = u1.texture; U.uFx.value.x = o.glare ? glareK : 0; n += 5;
      } else { U.tGlare.value = black; U.uFx.value.x = 0; }
      st.glare = U.uFx.value.x > 0;
      // ---- adaptation
      if (o.adapt || o.all) {
        const now = typeof performance !== 'undefined' ? performance.now() : 0, dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
        // the key: what a street lit by this sun and this sky comes out at (linear, before exposure), with a floor for
        // the lamplit night. Measured over the centre's streets and quads at every hour and weather (tools/fx_shots.mjs).
        let key = 0.2;
        if (sky && sky.sun && sky.hemi) {
          const sun = sky.sun, hemi = sky.hemi, el = sky.state.sunEl;
          const sl = el > -3 ? sun.intensity * (0.2126 * sun.color.r + 0.7152 * sun.color.g + 0.0722 * sun.color.b) * Math.max(0.15, sky.sunDir.y) : 0;
          const hl = hemi.intensity * (0.2126 * hemi.color.r + 0.7152 * hemi.color.g + 0.0722 * hemi.color.b);
          key = 0.03 * sl + 0.085 * hl + 0.016 * night;
        }
        st.key = key;
        lum.uniforms.tSrc.value = o.scene; lum.uniforms.tDepth.value = o.depth; pass(lum, lumT);
        const a = adapt.uniforms;
        a.uLim.value.set(0.78 + 0.14 * night, 1.42 - 0.17 * night);      // (lamplit streets are not stopped down, nor the dark opened far: the night was graded by hand)
        a.tLum.value = lumT.texture; a.tPrev.value = ad[cur].texture;
        a.uA.value.set(key, 1 - Math.exp(-dt / 0.6), 1 - Math.exp(-dt / 2.0), init ? 2 : o.part || o.all ? 1 : 0);
        pass(adapt, ad[1 - cur]); cur = 1 - cur; init = false; n += 2;
        U.tAdapt.value = ad[cur].texture; U.uFx.value.y = o.adapt ? 1 : 0;
      } else { U.tAdapt.value = one; U.uFx.value.y = 0; init = true; }
      st.adapt = U.uFx.value.y > 0; st.passes = n;
      return n;
    },
    /** tests / calibration only (a read-back stalls the pipeline): [exposure multiplier, measured log-average luminance, wanted multiplier, 1] */
    read() { if (!ad[cur]) return null; R.readRenderTargetPixels(ad[cur], 0, 0, 1, 1, buf); return [buf[0], buf[1], buf[2], st.key]; },
  };
  return fx;
}
