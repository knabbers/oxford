// Pixel-cost pass (2026-11): the sun's soft shadow in 4 fetches instead of 16, the same picture.
//
// three's PCFSoftShadowMap filter reads the shadow map 16 times for every lit pixel of every material (a 4 x 4 block of
// texels, each unpacked from RGBA and compared, weighted [1-f, 1, 1, f] along each axis) — on the top tier, where the
// frame is bound by fragment work, 3 to 5 ms of a 1080p frame on a Radeon Pro 460. That kernel is exactly the sum of
// nine bilinear comparisons, and a pair of its neighbouring texels is one hardware comparison fetch placed between
// them by their weights (a depth texture with a compare function: the GPU compares each texel, then interpolates the
// results). So: the sun's shadow target is given a depth TEXTURE beside the packed colour three writes (same pass, no
// extra draw), and the atlas materials — ground, facades, the hand-built kits: nearly every pixel of the picture —
// read that through a sampler2DShadow in four fetches. The weights are the same to within the sampler's 1/256
// sub-texel steps; every other material keeps three's 16 taps and matches it.
//   SUN_SH.uOn   1 only while world/post.js draws the WORLD scene on the top tier (sunShadowOn / sunShadowOff round
//                that render: a room has other lights, another tier has not asked for this)
//   `?shadow4=0` off (A/B): the materials are then compiled without the code at all.
import * as THREE from 'three';

// (the sampler is never left unbound or on a dead texture: while the sun's own depth texture is not in use — another tier, a room,
//  after a tier change threw the shadow target away — it reads a 1 x 1 depth texture WITH a compare function. A sampler2DShadow on
//  anything else is GL_INVALID_OPERATION at the draw, and the browser then skips every draw of that material: no ground, no walls.)
const IDLE = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
IDLE.compareFunction = THREE.LessEqualCompare; IDLE.minFilter = IDLE.magFilter = THREE.LinearFilter; IDLE.name = 'sun.shadowDepthIdle';
IDLE.needsUpdate = true;      // (a texture three has never uploaded is bound as its plain empty one: the very mismatch this is here to prevent)
export const SUN_SH = { wanted: true, uMap: { value: IDLE }, uOn: { value: 0 }, depth: null, idle: IDLE, stats: { rebuilt: 0 } };
try { if (new URLSearchParams(location.search).get('shadow4') === '0') SUN_SH.wanted = false; } catch (e) { /* no location */ }

let CHUNK = null;
/** three's shadowmap_pars_fragment with the soft filter's 16 taps behind `gtoSunShOn` (null: three's chunk is not as expected — leave it) */
export function sunShadowChunk() {
  if (CHUNK !== null) return CHUNK || null;
  const src = THREE.ShaderChunk.shadowmap_pars_fragment;
  const i = src.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )'), j = src.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', i), cut = 'uv -= f * texelSize;';
  const k = i >= 0 ? src.indexOf(cut, i) : -1;
  if (i < 0 || j < 0 || k < 0 || k > j) { CHUNK = ''; return null; }
  const k1 = k + cut.length;
  CHUNK = 'uniform highp sampler2DShadow gtoSunSh;\nuniform float gtoSunShOn;\n' + src.slice(0, k1) + /* glsl */`
			if ( gtoSunShOn > 0.5 ) {
				// the same kernel: texels k-2, k-1 (weights 1 - f, 1) and k, k+1 (weights 1, f) as one comparison fetch each way
				vec2 gWa = 2.0 - f, gWb = 1.0 + f;
				vec2 gA = uv + ( 1.0 / gWa - 1.0 ) * texelSize, gB = uv + ( 1.0 + f / gWb ) * texelSize;
				shadow = ( gWa.x * gWa.y * texture( gtoSunSh, vec3( gA, shadowCoord.z ) ) + gWb.x * gWa.y * texture( gtoSunSh, vec3( gB.x, gA.y, shadowCoord.z ) )
					+ gWa.x * gWb.y * texture( gtoSunSh, vec3( gA.x, gB.y, shadowCoord.z ) ) + gWb.x * gWb.y * texture( gtoSunSh, vec3( gB, shadowCoord.z ) ) ) * ( 1.0 / 9.0 );
			} else {
` + src.slice(k1, j) + '\t\t\t}\n\t\t' + src.slice(j);
  return CHUNK;
}

/** before the world's render on the top tier: the sun's shadow target has our depth texture (made again whenever
 *  three or the quality code made a new target), and the materials are told to use it */
export function sunShadowOn(R, sun) {
  const sh = sun && sun.castShadow ? sun.shadow : null;
  if (!SUN_SH.wanted || !sh || !R || !R.capabilities || !R.capabilities.isWebGL2 || R.shadowMap.type !== THREE.PCFSoftShadowMap) { SUN_SH.uMap.value = IDLE; SUN_SH.uOn.value = 0; return false; }
  const W = sh.mapSize.x | 0, H = sh.mapSize.y | 0;
  if (!sh.map || !sh.map.depthTexture || sh.map.depthTexture !== SUN_SH.depth || sh.map.width !== W || sh.map.height !== H) {
    if (W < 1 || H < 1 || W > R.capabilities.maxTextureSize || H > R.capabilities.maxTextureSize) { SUN_SH.uOn.value = 0; return false; }
    if (sh.map) sh.map.dispose();
    if (SUN_SH.depth) SUN_SH.depth.dispose();
    const d = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
    d.compareFunction = THREE.LessEqualCompare; d.minFilter = d.magFilter = THREE.LinearFilter; d.name = 'sun.shadowDepth';
    // (the colour side exactly as three makes it: WebGLShadowMap, any type but VSM)
    sh.map = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: d });
    sh.map.texture.name = (sun.name || 'sun') + '.shadowMap';
    sh.camera.updateProjectionMatrix();
    SUN_SH.depth = d; SUN_SH.stats.rebuilt++;
    R.shadowMap.needsUpdate = true;
  }
  SUN_SH.uMap.value = SUN_SH.depth; SUN_SH.uOn.value = 1;
  return true;
}
/** after the world's render: back to the idle texture, so nothing else (a room, a later tier that never calls sunShadowOn, a
 *  shadow target three has since thrown away) ever draws with the sun's own */
export function sunShadowOff() { SUN_SH.uMap.value = IDLE; SUN_SH.uOn.value = 0; }
