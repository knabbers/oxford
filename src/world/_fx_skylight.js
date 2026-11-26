// Sky light (shader pass 10): ambient light that follows the place, and the sun's first bounce off the ground.
//
// three's hemisphere light is the same everywhere: a wall in a four-metre lane between three-storey fronts gets as much
// sky as one facing an open quad, and the lower storeys of a shaded street get the same warm "ground bounce" whether the
// paving at their feet is in full sun or in shade. That evenness is what makes the streets read as lit by a lamp rig.
// Here the heights of the buildings and the tree crowns round the camera are drawn top-down into a small texture
// (256 x 256 over 320 m, 1.25 m texels) and from it, only when the camera has moved 40 m or the sun 0.6 degrees, ONE
// derived texture is made:
//   r  how much of the sky is seen from street level (12 bearings x 6 distances: the horizon the roofs make)
//   g  the height of what hides it (/64 m): higher up a wall the sky opens out again, above the roofs it is whole
//   b  tree crowns overhead / close by (their share of the sky; they let half of it through)
//   a  how much of the ground within a few metres is in the sun (height-field march towards the sun, crowns half)
// Every lit material reads it once (lights chunk, by world x, z pushed 1.6 m out along the normal so that a wall reads
// the street in front of it): the hemisphere light is scaled by the sky seen, and the share of it that stood for the
// sun bounced off the ground is taken out and given back in the sun's own colour only where the ground near by is lit.
// So: lanes, arches and the feet of tall fronts are dimmer than squares and quads; under trees an overcast day has its
// soft pools of shade; the shaded side of a sunlit street glows warm low down and a street wholly in shade stays cool.
// Direct sun, lamps (the light map) and emissives are untouched.
//   cost      one fetch + ~25 instructions per lit pixel; the maps: 2 small top-down draws + 3 quads of 256², spread
//             over 4 frames, once per 40 m walked (nothing per frame)
//   stable    the map's centre snaps to its texel grid and the new one is swapped in whole, so nothing shimmers or
//             pops as the camera moves; it fades out between 120 and 150 m from the centre and above the roofs
//   rooms     walk-in rooms are scenes of their own in room coordinates: the strength is non-zero only while the
//             WORLD scene is being drawn (post.js brackets its render with on() / off())
// Uniforms ride in ShaderLib like the light map's (lightmap.js); tier field `skyl`, URL switch ?skylight=0.
//
// LIGHT THAT KNOWS THE BUILDINGS (2026-11-24; docs/ARCHITECTURE.md "Lighting and buildings"). The same height field now
// answers the one question every sun trick used to skip — CAN THE SUN GET HERE? — and the map carries the answer:
//   b  the SUN'S SHADOW HEIGHT at this texel (/64 m): the height above which the sun (by night the moon: whatever the
//      scene's directional light is) clears everything towards it — max over a 40-step march of (roof - distance x
//      tan(elevation)), out to 250 m. One number serves any height: a pixel at y is in the light iff y > b.
//   (the tree crowns' share, which was b, is folded into r and g by the pass that makes them)
// and three things read it, all in the fetch every lit pixel already made (no fetch, no draw, no pass added):
//   1. BEYOND THE SHADOW MAP'S BOX (80 m to either side of the player) three's shadow is simply "lit": a street 100 m
//      off had no shadows at all, and at a low sun every far wall glowed. There the direct light is cut by the height
//      field's shadow, faded in over the last tenth of the box (a soft stand-in: 1.25 m texels, good from 80 m).
//      `?farshadow=0` off.
//   2. THE SUN UNDER CLOUD. Under a deck the sun's light is weak and its shadow is weakened (sun.shadow.intensity): the
//      share that ignores the shadow map stands for light the cloud has spread out. It kept the sun's direction and
//      colour, so at sunset under broken cloud an enclosed quad glowed orange on the wall facing a sun that the range
//      opposite hides. That share is now cut, softly (a penumbra of 4.5 m at the horizon, 40 m at midday: spread light
//      comes over a roof), wherever the height field says the sun's part of the sky is hidden. In clear weather the share is zero and nothing changes; in the open nothing changes.
//      `?sungate=0` off.
//   3. WHAT GLASS AND WET GROUND MIRROR (materials.js): the roofline in a window's reflection is put where the sky map
//      says the roofs opposite stand (a lane's windows mirror the fronts opposite, not a bright sunset sky).
// The occluders: every windowed atlas mesh as before, and now every large opaque shadow-casting mesh of a place module
// (the hand-built buildings whose materials are their own: the Randolph, the museums, the Andrew Wiles Building).
import * as THREE from 'three';

export const SKYL = { A: new Float32Array([0, 0, 1 / 320, 0]), B: new Float32Array([0, 0, 0, 0]), C: new Float32Array([0, 0, 0, 0]), tex: { value: null },
  /** the directional light's line in three's lights_fragment_begin that the sun gate replaces (tests look for it) */
  DIR_LINE: 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;',
  gate: false, sunGate: true, farShadow: true };
try { const q = new URLSearchParams(location.search); if (q.get('sungate') === '0') SKYL.sunGate = false; if (q.get('farshadow') === '0') SKYL.farShadow = false; } catch (e) { /* no location */ }
const SIZE = 256, EXTENT = 320, REBUILD = 40, LAYER = 7, TOP = 500;
const ROOMVIEW = /^(punch|impostor|doorProxies)/, FOLIAGE = /tree|lea(f|ves)|crown|hedge|shrub|ivy|canop|bush|foliage|creeper/i;

export function installSkylightChunk() {
  const C = THREE.ShaderChunk;
  if (C.__gtoSkyl) return; C.__gtoSkyl = true;
  C.lights_pars_begin = C.lights_pars_begin + /* glsl */`
uniform sampler2D gtoSkMap;
uniform vec4 gtoSkA;
uniform vec4 gtoSkB;
uniform vec4 gtoSkC;
// the map at this pixel (r sky seen, g height of what hides it / 64, b the sun's shadow height / 64, a sun on the ground
// near by), its weight here (0: off, or beyond the map's edge), and the pixel's own height
vec4 gtoSkS = vec4(1.0, 0.0, 0.0, 0.0);
float gtoSkE = 0.0;
float gtoSkY = 0.0;
void gtoSkFetch(vec3 w, vec3 n) {
	gtoSkY = w.y;
	if (gtoSkA.w + gtoSkC.x > 0.0) {
		vec2 u = vec2(w.x + n.x * 1.6 - gtoSkA.x, gtoSkA.y - w.z - n.z * 1.6) * gtoSkA.z;
		gtoSkE = 1.0 - smoothstep(0.375, 0.47, max(abs(u.x), abs(u.y)));
		if (gtoSkE > 0.0) gtoSkS = texture2D(gtoSkMap, u + 0.5);
	}
}
// how much of the sky is seen from this pixel, 0..1 (1: the open, or no map here)
float gtoSkSeen() {
	float h = clamp((gtoSkY - 1.0) / max(gtoSkS.g * 64.0 - 1.0, 3.0), 0.0, 1.0);
	return mix(1.0, mix(gtoSkS.r, 1.0, h), gtoSkE * step(0.0001, gtoSkA.w + gtoSkC.x));
}
`;
  // the fetch: once per lit pixel, before the lights (a material that needs it sooner — the windows of the atlas
  // materials, in their emissive code — defines GTO_SK_EARLY and calls gtoSkFetch itself with its own world position)
  const GEO = 'vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );';
  if (C.lights_fragment_begin.includes(GEO)) {
    C.lights_fragment_begin = C.lights_fragment_begin.replace(GEO, GEO + /* glsl */`
#ifndef GTO_SK_EARLY
gtoSkFetch(cameraPosition + geometryPosition * mat3(viewMatrix), geometryNormal * mat3(viewMatrix));
#endif
`);
    // the sun gate (see the head of this file): three's own shadow first, then what the height field knows
    if (C.lights_fragment_begin.includes(SKYL.DIR_LINE)) {
      C.lights_fragment_begin = C.lights_fragment_begin.replace(SKYL.DIR_LINE, /* glsl */`{
			float gtoDs = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
			float gtoGk = gtoSkC.x * gtoSkE;
			if ( gtoGk > 0.0 && receiveShadow ) {
				float gtoSi = directionalLightShadow.shadowIntensity;
				vec3 gtoSp = vDirectionalShadowCoord[ i ].xyz / vDirectionalShadowCoord[ i ].w;
				vec2 gtoSq = abs( gtoSp.xy - 0.5 );
				// (0 well inside the shadow map's box, 1 outside it)
				float gtoOut = gtoSp.z > 1.0 ? 1.0 : smoothstep( 0.44, 0.497, max( gtoSq.x, gtoSq.y ) );
				float gtoDy = gtoSkY - gtoSkS.b * 64.0;
				float gtoHard = gtoSi > 0.002 ? clamp( ( gtoDs - 1.0 + gtoSi ) / gtoSi, 0.0, 1.0 ) : 1.0;
				gtoHard *= 1.0 - gtoOut * gtoGk * gtoSkC.y * ( 1.0 - smoothstep( -0.3, 1.5, gtoDy ) );
				gtoDs = gtoHard * gtoSi + ( 1.0 - gtoSi ) * ( 1.0 - gtoGk * gtoSkC.z * ( 1.0 - smoothstep( -gtoSkC.w, 1.5, gtoDy ) ) );
			}
			directLight.color *= gtoDs;
		}`);
      SKYL.gate = true;
    }
  } else {
    // (another three: the old place for the fetch, and no gate)
    C.lights_fragment_end = '#if defined( RE_IndirectDiffuse )\ngtoSkFetch(cameraPosition + geometryPosition * mat3(viewMatrix), geometryNormal * mat3(viewMatrix));\n#endif\n' + C.lights_fragment_end;
  }
  // (prepended last = runs first: the lamps' light, added by the light map's chunk after this, is not dimmed)
  C.lights_fragment_end = /* glsl */`
#if defined( RE_IndirectDiffuse )
if (gtoSkA.w * gtoSkE > 0.0) {
	float gtoSe = gtoSkA.w * gtoSkE;
	vec3 gtoSn = geometryNormal * mat3(viewMatrix);
	float gtoSh = clamp((gtoSkY - 1.0) / max(gtoSkS.g * 64.0 - 1.0, 3.0), 0.0, 1.0);
	float gtoSv = mix(gtoSkS.r, 1.0, gtoSh);
	float gtoSwl = (1.0 - max(gtoSn.y, 0.0)) / (1.0 + 0.1 * max(gtoSkY, 0.0));
	irradiance *= mix(1.0, (0.42 + 0.78 * pow(gtoSv, 0.8)) * (1.0 - gtoSkB.w * gtoSwl), gtoSe);
	irradiance += gtoSkB.rgb * (gtoSkS.a * gtoSwl * gtoSe);
}
#endif
` + C.lights_fragment_end;
  for (const k in THREE.ShaderLib) { const u = THREE.ShaderLib[k].uniforms; if (u && (u.directionalLights || u.ambientLightColor)) { u.gtoSkA = { value: SKYL.A }; u.gtoSkB = { value: SKYL.B }; u.gtoSkC = { value: SKYL.C }; u.gtoSkMap = SKYL.tex; } }
  THREE.UniformsLib.lights.gtoSkA = { value: SKYL.A }; THREE.UniformsLib.lights.gtoSkB = { value: SKYL.B }; THREE.UniformsLib.lights.gtoSkC = { value: SKYL.C }; THREE.UniformsLib.lights.gtoSkMap = { value: null };
  // the sampler uniform is ONE object shared by every material (as lightmap.js does for its own)
  const UU = THREE.UniformsUtils, clone = UU.clone;
  UU.clone = (src) => {
    if (!src || src.gtoSkMap !== SKYL.tex) return clone(src);
    const tmp = { ...src }; delete tmp.gtoSkMap;
    const out = clone(tmp); out.gtoSkMap = SKYL.tex;
    return out;
  };
}

const QUAD_VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// heights: r = the top of what stands at this texel (m; 0 = open ground)
const H_VS = /* glsl */`
#include <common>
#include <batching_pars_vertex>
varying float vH;
void main() {
	#include <batching_vertex>
	#include <begin_vertex>
	vec4 wp = vec4(transformed, 1.0);
#ifdef USE_BATCHING
	wp = batchingMatrix * wp;
#endif
#ifdef USE_INSTANCING
	wp = instanceMatrix * wp;
#endif
	wp = modelMatrix * wp;
	vH = wp.y;
	gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const H_FS = /* glsl */`varying float vH; void main() { gl_FragColor = vec4(max(vH, 0.0), 0.0, 0.0, 1.0); }`;
// pass 1: sun on the ground (r), by a march over the height field towards the sun; g, b = the two heights passed on
const SUN_FS = /* glsl */`
uniform sampler2D tH; uniform sampler2D tT; uniform vec4 uSun;   // xy: towards the sun in uv per metre, z: tan(elevation), w: sun up 0..1
uniform vec4 uLit;   // the scene's directional light (the sun; by night the moon): xy towards it in uv per metre, z: tan(elevation)
varying vec2 vUv;
void main() {
	// the light's shadow height: above this, a point over this texel clears every roof towards the light. From 3 m out
	// (a roof does not shade itself by the height field's own roughness), steps growing from 1.25 m to 16 m, 250 m in all
	float hs = 0.0, d = 3.0;
	for (int i = 0; i < 40; i++) {
		vec2 uv = vUv + uLit.xy * d;
		float inb = step(0.0, min(uv.x, uv.y)) * step(max(uv.x, uv.y), 1.0);
		hs = max(hs, (texture2D(tH, uv).r - d * uLit.z) * inb);
		d = d * 1.07 + 1.25;
	}
	float lit = 1.0, s = 2.0;
	for (int i = 0; i < 9; i++) {
		vec2 uv = vUv + uSun.xy * s;
		float rise = s * uSun.z;
		lit = min(lit, smoothstep(-1.5, 1.0, rise + 0.5 - texture2D(tH, uv).r));
		lit *= 1.0 - 0.55 * step(rise + 2.5, texture2D(tT, uv).r) * step(float(i), 5.5);
		s *= 1.6;
	}
	lit *= 1.0 - 0.5 * step(2.5, texture2D(tT, vUv).r);
	gl_FragColor = vec4(lit * uSun.w, texture2D(tH, vUv).r, texture2D(tT, vUv).r, hs);
}`;
// pass 2: the sky seen from 1 m above the ground at each texel, the height of what hides it, crowns, sun near by
const OPEN_FS = /* glsl */`
uniform sampler2D tS; uniform float uTexel;   // metres -> uv
varying vec2 vUv;
void main() {
	float open = 0.0, hc = 0.0, hw = 0.0, sun = 0.0, sw = 0.0, tree = 0.0;
	vec4 c0 = texture2D(tS, vUv);
	for (int j = 0; j < 12; j++) {
		float a = (float(j) + 0.5) * 0.5235988;
		vec2 dir = vec2(cos(a), sin(a)) * uTexel;
		float tmax = 0.0, hmax = 0.0, d = 1.5;
		for (int i = 0; i < 6; i++) {
			vec4 s = texture2D(tS, vUv + dir * d);
			float t = max(s.g - 1.0, 0.0) / d;
			if (t > tmax) { tmax = t; hmax = s.g; }
			if (i < 3) {
				float w = i == 0 ? 1.0 : i == 1 ? 0.8 : 0.5;
				// (the sun on the ground near by: not what falls on the roofs)
				float g = 1.0 - smoothstep(1.5, 3.0, s.g);
				sun += s.r * w * g; sw += w * (0.35 + 0.65 * g);
				tree += step(2.5, s.b) * w;
			}
			d *= 1.9;
		}
		float v = 1.0 - tmax / sqrt(1.0 + tmax * tmax);
		open += v; hc += hmax * (1.0 - v); hw += 1.0 - v;
	}
	tree = (tree / 27.6) * 0.75 + 0.25 * step(2.5, c0.b);
	// (the crowns overhead take half of their share of the sky, and count as something 9 m high that hides it: what the
	//  lit materials used to work out from a channel of its own, which now carries the sun's shadow height)
	float hide = (hw > 0.001 ? hc / hw : 0.0);
	gl_FragColor = vec4(open / 12.0 * (1.0 - 0.5 * tree), mix(hide, max(hide, 9.0), tree) / 64.0, min(c0.a, 250.0) / 64.0, sun / max(sw, 0.001));
	// (a: -1 marks a texel inside a building for the next pass)
	if (c0.g > 2.5) gl_FragColor.a = -1.0;
}`;
// pass 3: texels inside a building take the mean of the open texels round them (a wall reads the street, not the roof)
const FILL_FS = /* glsl */`
uniform sampler2D tS; uniform float uPx;
varying vec2 vUv;
void main() {
	vec4 c = texture2D(tS, vUv);
	if (c.a < -0.5) {
		vec4 acc = vec4(0.0); float n = 0.0;
		for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
			vec4 s = texture2D(tS, vUv + vec2(float(x), float(y)) * uPx);
			if (s.a > -0.5) { acc += s; n += 1.0; }
		}
		float hs = c.b;      // (a roof keeps its own shadow height: the towers and the ridges round it shade it)
		c = n > 0.0 ? acc / n : vec4(1.0, 0.0, 0.0, 0.0);
		c.b = hs;
	}
	gl_FragColor = c;
}`;

export function createSkylight(game, scene, veg) {
  const R = game.renderer, can = !!(R && R.capabilities && R.capabilities.isWebGL2 && R.setRenderTarget);
  const black = new THREE.DataTexture(new Uint8Array([255, 0, 0, 0]), 1, 1); black.needsUpdate = true;
  SKYL.tex.value = black;
  let on = false, want = 0, k = 0, kg = 0, hT = null, tT = null, sT = null, oT = null, out = [null, null], cur = 0;
  let k0 = 0, stage = 0, nx = 0, nz = 0, bx = 1e9, bz = 1e9, pubX = 0, pubZ = 0, have = false, scanN = -1, scans = 0, trees = null, treeScene = null;
  const sunAt = new THREE.Vector3(0, -1, 0), litAt = new THREE.Vector3(0, -1, 0), litNow = new THREE.Vector3(0, 1, 0), st = { enabled: false, rebuilds: 0, occluders: 0, solids: 0, trees: 0, ms: 0, drawMs: 0 };
  const cam = new THREE.OrthographicCamera(-EXTENT / 2, EXTENT / 2, EXTENT / 2, -EXTENT / 2, 1, TOP + 60);
  cam.up.set(0, 0, -1); cam.matrixAutoUpdate = true;
  const hMat = new THREE.ShaderMaterial({ vertexShader: H_VS, fragmentShader: H_FS, side: THREE.DoubleSide, toneMapped: false, fog: false }); hMat.name = 'fx:skylightHeight';
  const mk = (name, uniforms, fragmentShader) => { const m = new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VS, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false }); m.name = 'fx:' + name; return m; };
  const sunMat = mk('skylightSun', { tH: { value: null }, tT: { value: null }, uSun: { value: new THREE.Vector4() }, uLit: { value: new THREE.Vector4(0, 0, 1, 0) } }, SUN_FS);
  const openMat = mk('skylightOpen', { tS: { value: null }, uTexel: { value: 1 / EXTENT } }, OPEN_FS);
  const fillMat = mk('skylightFill', { tS: { value: null }, uPx: { value: 1 / SIZE } }, FILL_FS);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad); qs.matrixWorldAutoUpdate = false;
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const _col = new THREE.Color();

  function ensure() {
    if (hT) return;
    const o = { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false };
    hT = new THREE.WebGLRenderTarget(SIZE, SIZE, { ...o, depthBuffer: true }); tT = new THREE.WebGLRenderTarget(SIZE, SIZE, { ...o, depthBuffer: true });
    sT = new THREE.WebGLRenderTarget(SIZE, SIZE, { ...o, depthBuffer: false }); oT = new THREE.WebGLRenderTarget(SIZE, SIZE, { ...o, depthBuffer: false });
    out[0] = new THREE.WebGLRenderTarget(SIZE, SIZE, { ...o, depthBuffer: false }); out[1] = new THREE.WebGLRenderTarget(SIZE, SIZE, { ...o, depthBuffer: false });
    out[0].texture.name = out[1].texture.name = 'fx:skylight';
  }
  // the buildings: every mesh drawn with a windowed atlas material (the city's facade tiles near and far, the hand-built
  // colleges' kits) goes on a layer of its own that only the top-down camera sees
  function scan() {
    let n = 0, ns = 0;
    // (the place modules' own buildings: a large opaque mesh that casts a shadow and is not foliage. Their content is
    //  what core/cull.js looks after: game.cull.owners)
    const owners = game.cull && game.cull.owners;
    const solid = (o, m) => o.castShadow && !o.isInstancedMesh && !o.isBatchedMesh && !m.transparent && m.visible !== false && !(m.opacity < 1) && o.geometry && o.geometry.boundingSphere && o.geometry.boundingSphere.radius >= 3 && !FOLIAGE.test(o.name) && !FOLIAGE.test(m.name || '');
    const walk = (o, owned) => {
      // (not the room views' quads and door leaves — core/_roomview.js: their onBeforeRender hooks expect their own
      //  material, and three hands a hook the override material; they are no part of a height map anyway)
      if (o.name === 'character' || o.isSkinnedMesh || o.renderOrder >= 1e5 || ROOMVIEW.test(o.name)) { if (o.layers.isEnabled(LAYER)) o.traverse((c) => c.layers.disable(LAYER)); return; }
      if (o.isMesh) {
        const m = o.material;
        if (m && !Array.isArray(m)) {
          if (m.userData && m.userData.fxOccluder) { o.layers.enable(LAYER); n++; }
          else if (owned && (o.userData.fxSolid || solid(o, m))) { o.userData.fxSolid = true; o.layers.enable(LAYER); n++; ns++; }      // (fxSolid: once a building, always one — core/cull.js takes castShadow away from far meshes for the length of a render)
        }
      }
      const ch = o.children; for (let i = 0; i < ch.length; i++) walk(ch[i], owned);
    };
    for (const top of scene.children) walk(top, !!(owners && top.userData && owners.has(top.userData.owner)));
    scanN = scene.children.length; st.occluders = n; st.solids = ns; scans++;
  }
  // the trees: one static instanced draw of every crown in the city as an octagon at four fifths of its height
  function buildTrees() {
    treeScene = new THREE.Scene(); treeScene.matrixWorldAutoUpdate = false;
    const all = veg && veg.sets && veg.sets.find((s) => s.name === 'trees:far');
    if (!all || !all.n) return;
    const g = new THREE.CircleGeometry(0.46, 8); g.rotateX(-Math.PI / 2); g.translate(0, 0.8, 0);
    trees = new THREE.InstancedMesh(g, hMat, all.n);
    trees.instanceMatrix.array.set(all.mat.subarray(0, all.n * 16)); trees.instanceMatrix.needsUpdate = true;
    trees.frustumCulled = false; trees.matrixAutoUpdate = false; trees.updateMatrixWorld(true);
    treeScene.add(trees); st.trees = all.n;
  }
  function begin() { const s = { prev: R.getRenderTarget(), sm: R.shadowMap.autoUpdate, smN: R.shadowMap.needsUpdate, a: R.getClearAlpha() }; R.getClearColor(_col); R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false; return s; }
  function end(s) { R.setRenderTarget(s.prev); R.setClearColor(_col, s.a); R.shadowMap.autoUpdate = s.sm; R.shadowMap.needsUpdate = s.smN; }
  function pass(mat, target) { quad.material = mat; R.setRenderTarget(target); R.render(qs, qc); }
  function drawHeights(cx, cz) {
    if (scanN < 0 || (st.rebuilds % 4) === 3) scan();      // (place modules add their buildings while loading; a late one is picked up within a few rebuilds)
    if (!treeScene) buildTrees();
    cam.position.set(cx, TOP, cz); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld(true);
    const s = begin(), ov = scene.overrideMaterial, bg = scene.background, au = scene.matrixWorldAutoUpdate;
    cam.layers.set(LAYER);
    R.setClearColor(0x000000, 1);
    try {
      // (matrices are this frame's already; the scene's own render hooks see a render like any other)
      scene.overrideMaterial = hMat; scene.background = null; scene.matrixWorldAutoUpdate = false;
      R.setRenderTarget(hT); R.clear(true, true, false); R.render(scene, cam);
    } catch (e) { if (!st.error) { st.error = String(e && e.message || e); console.warn('[fx skylight] height draw failed', e); }
    } finally { scene.overrideMaterial = ov; scene.background = bg; scene.matrixWorldAutoUpdate = au; }
    cam.layers.set(0);
    R.setRenderTarget(tT); R.clear(true, true, false); R.render(treeScene, cam);
    end(s);
  }
  function sunPass(dir, lit) {
    const s = begin(), u = sunMat.uniforms, y = Math.max(dir.y, 0.02), h = Math.hypot(dir.x, dir.z) || 1e-4;
    // (uv: +x east, +y north = -z)
    u.tH.value = hT.texture; u.tT.value = tT.texture; u.uSun.value.set(dir.x / h / EXTENT, -dir.z / h / EXTENT, y / h, dir.y > 0.02 ? 1 : 0);
    { const ly = Math.max(lit.y, 0.02), lh = Math.hypot(lit.x, lit.z) || 1e-4; u.uLit.value.set(lit.x / lh / EXTENT, -lit.z / lh / EXTENT, ly / lh, 0); }
    pass(sunMat, sT); end(s);
  }
  function openPass() { const s = begin(); openMat.uniforms.tS.value = sT.texture; pass(openMat, oT); end(s); }
  function fillPass() { const s = begin(); fillMat.uniforms.tS.value = oT.texture; pass(fillMat, out[1 - cur]); end(s); }
  function publish() { cur = 1 - cur; SKYL.tex.value = out[cur].texture; pubX = nx; pubZ = nz; SKYL.A[0] = pubX; SKYL.A[1] = pubZ; SKYL.A[2] = 1 / EXTENT; have = true; st.rebuilds++; }

  const api = {
    stats: st, extent: EXTENT, size: SIZE,
    setEnabled(v) { on = !!v && can; st.enabled = on; if (!on) { want = 0; k = 0; SKYL.A[3] = 0; stage = 0; } },
    /** the strength the world scene is drawn with (post.js brackets its render of it; every other scene gets 0) */
    on() { SKYL.A[3] = k0; SKYL.C[0] = kg; }, off() { SKYL.A[3] = 0; SKYL.C[0] = 0; },
    /** once a frame outdoors. sky: world.sky (sun, state); aerial: a glider is up (off: from the air the roofs are all there is) */
    update(dt, sky, aerial) {
      SKYL.A[3] = 0; SKYL.C[0] = 0;
      if (!on) return;
      const c = (game.eye || game.camera.position), tx = EXTENT / SIZE;
      const high = aerial || c.y > 70;
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      if (!high) {
        if (stage === 0) {
          const cx = Math.round(c.x / tx) * tx, cz = Math.round(c.z / tx) * tx;
          // (the scene's directional light — the sun, the moon — as sky.js aims it: its shadow height follows it in
          //  steps of a fifth of a degree, so a far shadow's tip creeps rather than jumps; three small quads each time)
          const L = sky.sun; litNow.copy(L.position).sub(L.target.position).normalize();
          const sunMoved = sky.state.sunEl > -3 && (sunAt.dot(sky.sunDir) < 0.99994 || (L.intensity > 0.01 && litAt.dot(litNow) < 0.999994));
          if (!have || Math.hypot(cx - bx, cz - bz) > REBUILD) { ensure(); nx = cx; nz = cz; bx = cx; bz = cz; const td = performance.now(); drawHeights(nx, nz); st.drawMs = performance.now() - td; stage = 1; }
          else if (sunMoved) { nx = pubX; nz = pubZ; stage = 1; }
        } else if (stage === 1) { const L = sky.sun; sunAt.copy(sky.sunDir); litAt.copy(L.position).sub(L.target.position).normalize(); sunPass(sunAt, litAt); stage = 2; }
        else if (stage === 2) { openPass(); stage = 3; }
        else { fillPass(); publish(); stage = 0; }
      }
      want = have && !high ? 1 : 0;
      k += (want - k) * Math.min(1, dt * 2.5); if (Math.abs(want - k) < 0.004) k = want;
      // the sun's bounce: the light the sun puts on flat ground, a quarter of it sent back up (paving, gravel, tarmac),
      // half of that reaching a wall beside it; and the share of the hemisphere light it replaces
      const sun = sky.sun, el = sky.state.sunEl, I = el > -3 ? sun.intensity * Math.max(sky.sunDir.y, 0) : 0;
      const b = 0.11 * I, night = sky.state.night;
      SKYL.B[0] = sun.color.r * b; SKYL.B[1] = sun.color.g * 0.93 * b; SKYL.B[2] = sun.color.b * 0.8 * b;
      SKYL.B[3] = Math.min(0.3, 0.1 * I);
      k0 = k * (1 - 0.4 * night); st.k = k0; st.stage = stage;
      // the sun gate: the height field's far shadow (y) and its say over the cloud-spread share (z)
      // (the cloud-spread share comes from a wide patch of sky round the sun: its penumbra is 4.5 m at the horizon — a
      //  shut quad gets none of a setting sun's — and 40 m at midday, when it falls from overhead and only the foot of a
      //  tall wall loses a part of it)
      // (by day only: moonlight is a twentieth of the picture, and the gate's dozen instructions measured 0.4 ms of a
      //  42 ms frame on a Radeon Pro 460 by night for nothing that could be seen)
      kg = SKYL.gate && el > -3 ? k : 0; SKYL.C[1] = SKYL.farShadow ? 1 : 0; SKYL.C[2] = SKYL.sunGate ? 1 : 0;
      { const sy = Math.max(0, litNow.y); SKYL.C[3] = 4.5 + 60 * sy * sy; }
      if (stage) st.ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    },
    /** the loading screen: the targets, the top-down draws and the three programs, once */
    warm() {
      if (!can) return false;
      ensure();
      const c = (game.eye || game.camera.position), tx = EXTENT / SIZE;
      nx = Math.round(c.x / tx) * tx; nz = Math.round(c.z / tx) * tx; bx = nx; bz = nz;
      drawHeights(nx, nz); sunAt.set(0.4, 0.8, 0.3).normalize(); sunPass(sunAt, sunAt); openPass(); fillPass(); publish(); stage = 0;
      sunAt.set(0, -1, 0); litAt.set(0, -1, 0);
      return true;
    },
    /** tests / debugging: the published map's centre and texture */
    get texture() { return have ? out[cur].texture : null; }, get centre() { return [pubX, pubZ]; },
  };
  return api;
}
