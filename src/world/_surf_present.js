// Surface fidelity, pass 2: output sharpening for ROOMS. The outdoor post chain (world/post.js) sharpens the street
// (world/_surf_sharpen.js); inside a room the frame is drawn straight to the screen and gets none, so walls and notices
// are softer indoors than out on a stretched (capped 1080p) picture. This is the smallest thing that shares it: the
// room's frame is drawn into one off-screen target (4x MSAA, half float, depth + stencil — what the room views need)
// and one full-screen pass puts it on the screen with the same contrast-adaptive sharpening, ACES tone mapping and
// sRGB output the outdoor composite applies. No bloom, grade or vignette: a room looks exactly as it does now, sharper.
// Cost: one resolve and one pass at the drawing buffer's size (about 1 ms at 1080p on the baseline GPU).
//
// Use (core/interiors.js or core/game.js — the hook is described in the pass-2 report, this module does not install
// itself): `const P = game.world.roomPresent; if (P && P.on()) { P.begin(R); <draw the room's frame as now>; P.end(R); }`.
// on() is true only on the top tier (the sharpening uniform is set) with WebGL2.
import * as THREE from 'three';
import { SURF_SHARP, SURF_SHARP_PARS, SURF_SHARP_GLSL } from './_surf_sharpen.js';

export function createRoomPresent(game) {
  let rt = null, quad = null, cam = null, scene = null, mat = null, prevAuto = true;
  const size = new THREE.Vector2();
  function ensure(R) {
    R.getDrawingBufferSize(size);
    const W = Math.max(2, size.x | 0), H = Math.max(2, size.y | 0);
    if (rt && rt.width === W && rt.height === H) return;
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true, stencilBuffer: true, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false });
    rt.texture.name = 'room-present';
    if (!mat) {
      mat = new THREE.ShaderMaterial({
        name: 'roomPresent', depthTest: false, depthWrite: false, toneMapped: true,
        uniforms: { tScene: { value: null }, ...SURF_SHARP.uniforms },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: /* glsl */`${SURF_SHARP_PARS}
          uniform sampler2D tScene; varying vec2 vUv;
          void main() {
            vec3 c = texture2D(tScene, vUv).rgb;
            ${SURF_SHARP_GLSL}
            gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
      scene = new THREE.Scene(); scene.add(quad); cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    mat.uniforms.tScene.value = rt.texture;
  }
  return {
    on() { const R = game.renderer; return SURF_SHARP.uniforms.uSurfSharp.value > 0 && !!(R && R.capabilities && R.capabilities.isWebGL2); },
    target() { return rt; },
    begin(R) { ensure(R); R.setRenderTarget(rt); R.clear(true, true, true); },
    end(R) {
      R.setRenderTarget(null);
      prevAuto = R.autoClear; R.autoClear = false;
      R.render(scene, cam);
      R.autoClear = prevAuto;
    },
    dispose() { if (rt) { rt.dispose(); rt = null; } },
  };
}
