// Surface fidelity (texture pass, 2026-11): output sharpening for the top tier, inside the post chain's composite
// (world/post.js — three one-line insertions there: SURF_SHARP.uniforms, SURF_SHARP_PARS, SURF_SHARP_GLSL).
//
// Why: the drawing buffer is capped at about 1080p (quality.js capRatio) and the browser stretches it to the window
// with a bilinear filter — on a 2880x1800 panel that is a 1.5x magnification of everything, and the 4x MSAA resolve is
// a box filter on top. This is contrast-adaptive sharpening (AMD FidelityFX CAS, the 5-tap form): each pixel is pushed
// away from the mean of its four neighbours by an amount that shrinks where the neighbourhood already has contrast, so
// stone grain, mortar joints and lettering gain definition and hard edges do not ring or halo. It runs on the HDR scene
// colour compressed to 0..1 (x / (1 + x)) — a lamp or the sky cannot blow a halo into its surroundings — before the
// rest of the composite, in the same pass: four more fetches of the resolved scene, no extra target.
// `uSurfSharp` 0 = off (the branch is skipped): every tier but the top one. `?sharp=<0..1>` overrides the strength.
export const SURF_SHARP = { uniforms: { uSurfSharp: { value: 0 } }, strength: 0.6 };
try { const u = new URLSearchParams(location.search).get('sharp'); if (u !== null && isFinite(+u)) SURF_SHARP.strength = Math.max(0, Math.min(1, +u)); } catch (e) { /* no location */ }
/** the tier switch (world/index.js applyQuality) */
export function setSharpen(on) { SURF_SHARP.uniforms.uSurfSharp.value = on ? SURF_SHARP.strength : 0; }

export const SURF_SHARP_PARS = /* glsl */`
uniform float uSurfSharp;
`;
/** expects `vec3 c` = texture2D(tScene, vUv).rgb and replaces it */
export const SURF_SHARP_GLSL = /* glsl */`
        if (uSurfSharp > 0.0) {
          vec2 shT = 1.0 / vec2(textureSize(tScene, 0));
          vec3 shC = c / (1.0 + c);
          vec3 shN = texture2D(tScene, vUv + vec2(0.0, shT.y)).rgb, shS = texture2D(tScene, vUv - vec2(0.0, shT.y)).rgb;
          vec3 shE = texture2D(tScene, vUv + vec2(shT.x, 0.0)).rgb, shW = texture2D(tScene, vUv - vec2(shT.x, 0.0)).rgb;
          shN = max(shN, vec3(0.0)); shS = max(shS, vec3(0.0)); shE = max(shE, vec3(0.0)); shW = max(shW, vec3(0.0));
          shN /= 1.0 + shN; shS /= 1.0 + shS; shE /= 1.0 + shE; shW /= 1.0 + shW;
          vec3 shMn = min(shC, min(min(shN, shS), min(shE, shW))), shMx = max(shC, max(max(shN, shS), max(shE, shW)));
          vec3 shA = sqrt(clamp(min(shMn, 1.0 - shMx) / max(shMx, vec3(1e-4)), 0.0, 1.0));
          vec3 shK = -shA * mix(0.125, 0.2, uSurfSharp);
          vec3 shR = clamp((shC + (shN + shS + shE + shW) * shK) / (1.0 + 4.0 * shK), 0.0, 0.9995);
          c = mix(c, shR / (1.0 - shR), step(0.0, min(c.r, min(c.g, c.b))));
        }
`;
