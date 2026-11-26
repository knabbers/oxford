// Shared materials and shader patches for the world. All city meshes use a handful of materials so draw calls stay low.
import * as THREE from 'three';
import * as T from './textures.js';
import { TERRAIN_VS, TERRAIN_STACK, TERRAIN_STACK_SOFT, TERRAIN } from './terrain.js';
const TERRAIN_STACK_ON = TERRAIN.mode === 'real';
import { grimeTexture } from './rough.js';
import { SURF, SURF_PARS, SURF_NORMAL, surfTable, addSurfDetail } from './_surf_detail.js';
import { SUN_SH, sunShadowChunk } from './_px_shadow.js';

/** Shared uniforms (updated by sky.js each frame). */
export const U = {
  time: { value: 0 },
  night: { value: 0 },                 // 0 day .. 1 night
  litFrac: { value: 0.35 },            // fraction of windows lit at night (the generic class; see litShares)
  // night windows pass (2026-11, photo comparison item 10): the share of upstairs windows lit by kind of building —
  // x houses and flats, y college rooms, z shops / offices (the floors over a shop), w churches — and the extra share
  // on the ground floor (litG); set every frame from the hour by sky.js (litShares)
  litK: { value: new THREE.Vector4(0.35, 0.35, 0.35, 0.35) },
  litG: { value: 0.22 },
  litGain: { value: 1 },               // glow of a lit room (1 = as before the pass)
  litColor: { value: new THREE.Color(1.0, 0.72, 0.42) },
  skyZen: { value: new THREE.Color(0.2, 0.4, 0.8) },
  skyHor: { value: new THREE.Color(0.7, 0.8, 0.9) },
  sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
  sunColor: { value: new THREE.Color(1, 1, 1) },
  moonDir: { value: new THREE.Vector3(0, 1, 0) },
  air: { value: new THREE.Vector3(0, 0, 0) },   // aerial material variants only (AIR_VIEW): cloud-shadow drift x, z and strength
  wetv: { value: new THREE.Vector4(0, 0, 0, 0) },  // weather (systems/weather.js): wet streets 0..1, lying snow 0..1, ground frost 0..1, rain on water 0..1
  wet2: { value: new THREE.Vector4(0, 0, 0, 0) },  // weather: x = standing water in the puddles 0..1 (fills in rain, dries hours after the surface has), yzw spare
};

/**
 * Aerial perspective for EVERY fogged material in the game (graphics pass 5). three's fog chunks are replaced once:
 * the factor is exponential in distance (one multiply fewer than exp²) and the colour is the scene fog colour plus a
 * warm term towards the sun, whose weight is computed per VERTEX (a varying replaces nothing per pixel but one MAD).
 * The two extra uniforms ride in ShaderLib as shared Float32Arrays (UniformsUtils.clone keeps typed arrays by
 * reference), so built-in materials of every module pick them up with no code of their own; a ShaderMaterial that does
 * not declare them gets zeros = plain fog colour. sky.js fills HAZE every frame.
 */
export const HAZE = { sunDir: new Float32Array([0, 1, 0]), sunCol: new Float32Array(3), fog: new Float32Array(2), mist: new Float32Array([0, 10, 0]) };   // mist: [density at the ground, scale height, ground y] — low height fog (weather: river and meadow mist)   // fog: [k, 0] — aerial mode only (else 0): haze grows with distance², clear near, opaque at the far plane
export function installHaze() {
  const C = THREE.ShaderChunk;
  if (C.__gtoHaze) return; C.__gtoHaze = true;
  // weather (graphics pass 8): + a low height fog, gtoMist = [density at the ground, scale height, ground y]; the
  // vertex gives the mean of exp(-height / H) along the ray from the camera (towers rise out of a river mist)
  C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n#ifdef FOG_EXP2\n\tuniform vec3 gtoHazeDir;\n\tuniform vec3 gtoMist;\n\tvarying float vHazeSun;\n\tvarying float vMistK;\n#endif\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n#ifdef FOG_EXP2\n\t{ float gtoHz = max( dot( normalize( mvPosition.xyz ), ( viewMatrix * vec4( gtoHazeDir, 0.0 ) ).xyz ), 0.0 ); vHazeSun = gtoHz * gtoHz; }\n\tvMistK = 0.0;\n\tif ( gtoMist.x > 0.0 ) { vec3 gtoW = ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix ); float gtoH = max( gtoMist.y, 1.0 ); float gtoA = exp( - max( cameraPosition.y - gtoMist.z, 0.0 ) / gtoH ), gtoB = exp( - max( gtoW.y - gtoMist.z, 0.0 ) / gtoH ), gtoDy = gtoW.y - cameraPosition.y; vMistK = abs( gtoDy ) > 0.05 ? gtoH * ( gtoA - gtoB ) / gtoDy : gtoA; }\n#endif\n#endif';
  C.fog_pars_fragment = '#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float vFogDepth;\n\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t\tuniform vec3 gtoHazeCol;\n\t\tuniform vec2 gtoFog;\n\t\tuniform vec3 gtoMist;\n\t\tvarying float vHazeSun;\n\t\tvarying float vMistK;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n#endif';
  C.fog_fragment = '#ifdef USE_FOG\n\t#ifdef FOG_EXP2\n\t\tfloat fogFactor = 1.0 - exp( - ( fogDensity + gtoMist.x * vMistK ) * vFogDepth * ( 1.0 + gtoFog.x * vFogDepth ) );\n\t\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor + gtoHazeCol * vHazeSun, fogFactor );\n\t#else\n\t\tfloat fogFactor = smoothstep( fogNear, fogFar, vFogDepth );\n\t\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n\t#endif\n#endif';
  for (const k in THREE.ShaderLib) { const u = THREE.ShaderLib[k].uniforms; if (u && u.fogColor) { u.gtoHazeDir = { value: HAZE.sunDir }; u.gtoHazeCol = { value: HAZE.sunCol }; u.gtoFog = { value: HAZE.fog }; u.gtoMist = { value: HAZE.mist }; } }
  THREE.UniformsLib.fog.gtoFog = { value: HAZE.fog }; THREE.UniformsLib.fog.gtoMist = { value: HAZE.mist };   // custom shaders that merge the fog uniforms
}

export const GLSL_HASH = /* glsl */`
float wHash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = wHash12(i), b = wHash12(i + vec2(1.0, 0.0)), c = wHash12(i + vec2(0.0, 1.0)), d = wHash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

// Heritage paint colours for doors and shop fascias (linear-ish RGB, chosen per bay by hash). Photo comparison item 9
// (2026-11): shopfronts read as "tall flat bands of bright colour" — the real ones are dark painted timber — so the
// palette is deeper and less saturated (mustard was a bright orange-yellow once multiplied, off-white a glare) and the
// multiplier at the call site is 1.6 (was 2.2).
const PAINT_GLSL = /* glsl */`
vec3 wPaint(float h) {
  if (h < 0.14) return vec3(0.05, 0.11, 0.07);   // racing green
  if (h < 0.28) return vec3(0.03, 0.05, 0.12);   // navy
  if (h < 0.40) return vec3(0.19, 0.035, 0.04);  // oxblood
  if (h < 0.50) return vec3(0.025, 0.025, 0.025); // black
  if (h < 0.60) return vec3(0.3, 0.29, 0.26);    // stone grey
  if (h < 0.70) return vec3(0.06, 0.15, 0.16);   // teal
  if (h < 0.80) return vec3(0.27, 0.19, 0.07);   // dull ochre
  if (h < 0.90) return vec3(0.2, 0.09, 0.16);    // aubergine
  return vec3(0.5, 0.48, 0.43);                  // cream
}
`;

/**
 * Patch a MeshStandardMaterial to sample an NX×NY atlas with per-vertex cell selection.
 * Vertex attributes: uv (in cell repeats: for walls u = bays, v = storeys), aCell (cellA, cellB, probB, seed), aTint (rgb),
 * optional aTop (eave height, for the under-eave darkening; only with `ao`).
 * opts.noiseFrom: macro-variation noise only for cells >= this index (the merged city atlas: roofs).
 * opts.ao: contact darkening where walls meet the ground (y = 0) and under eaves; opts.base: the geometry may carry
 * `aBase` (float per vertex: the height of the ground that wall stands on) and the contact darkening, plinth soot, lichen
 * and creeper are then measured from it instead of from world y = 0 (a sunk court, a raised terrace; a vertex or a whole
 * geometry without the attribute reads 0); opts.weather: stone weathering
 * (streaks, soot, lichen) on wall cells; opts.macro: a second low-frequency tint layer (ground: breaks up tiling).
 */
/**
 * Night windows pass (2026-11, photo comparison item 10). `?nightwin=0` (GTO_NIGHTWIN=0 in node) turns it off: every
 * building class then lights the old share (litFrac) at the old strength, exactly as before.
 */
export const NIGHT_WINDOWS = !((typeof location !== 'undefined' && location && /[?&]nightwin=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_NIGHTWIN === '0'));
/** window-light classes: what kind of building a city facade belongs to (buildings.js puts it in its seed's eighths) */
export const LIT_CLASS = { generic: 0, house: 1, college: 2, shop: 3, church: 4 };
// share of the upstairs windows lit, by class and hour (a GUESS from evening photographs and how such buildings are
// used): houses fill up from dusk, are busiest 19-22 and nearly dark after 01:00; college rooms stay lit later (an
// essay crisis, a staircase party) and thin out only after 02:00; the floors over shops and offices: the offices go
// dark after closing, the flats over the shops (much of the centre's upper floors) stay lit into the evening; churches are dark. Rows: hour 0..24 at the knots below.
const LIT_KNOTS = [0, 1, 2, 3, 4, 6, 7, 8.5, 16, 17, 18, 19, 20, 21, 22, 23, 24];
const LIT_TABLE = {
  house: [0.3, 0.15, 0.08, 0.05, 0.04, 0.08, 0.2, 0.12, 0.12, 0.24, 0.38, 0.48, 0.55, 0.56, 0.52, 0.42, 0.3],
  college: [0.44, 0.36, 0.25, 0.15, 0.08, 0.06, 0.12, 0.16, 0.16, 0.26, 0.4, 0.46, 0.52, 0.56, 0.58, 0.54, 0.44],
  shop: [0.14, 0.09, 0.06, 0.05, 0.04, 0.05, 0.1, 0.3, 0.3, 0.36, 0.34, 0.3, 0.28, 0.27, 0.25, 0.2, 0.14],
  ground: [0.18, 0.12, 0.08, 0.06, 0.06, 0.08, 0.14, 0.22, 0.22, 0.24, 0.26, 0.26, 0.26, 0.24, 0.22, 0.2, 0.18],
};
const lerpKnots = (row, h) => { h = ((h % 24) + 24) % 24; let i = 0; while (i < LIT_KNOTS.length - 2 && h > LIT_KNOTS[i + 1]) i++; const t = (h - LIT_KNOTS[i]) / (LIT_KNOTS[i + 1] - LIT_KNOTS[i]); return row[i] + (row[i + 1] - row[i]) * t; };
/** the old single share (generic class): busy in the evening, fewer after midnight */
export const litFracAt = (h) => (h >= 17 || h < 1 ? 0.42 : h < 4 ? 0.42 - (h - 1) * 0.1 : h < 8 ? 0.12 + (h - 4) * 0.04 : 0.3);
/** set U.litFrac / litK / litG / litGain for game hour h (sky.js, every frame). Pure apart from writing U. */
export function setLitShares(h) {
  const f = litFracAt(h);
  U.litFrac.value = f;
  if (!NIGHT_WINDOWS) { U.litK.value.set(f, f, f, f); U.litG.value = 0.22; U.litGain.value = 1; return; }
  U.litK.value.set(lerpKnots(LIT_TABLE.house, h), lerpKnots(LIT_TABLE.college, h), lerpKnots(LIT_TABLE.shop, h), 0.03);
  U.litG.value = lerpKnots(LIT_TABLE.ground, h);
  U.litGain.value = 1.3;
}
/** pure: the share lit for a class name at hour h (tests) */
export function litShare(cls, h) { if (!NIGHT_WINDOWS) return litFracAt(h); if (cls === 'church') return 0.03; if (cls === 'generic') return litFracAt(h); return lerpKnots(LIT_TABLE[cls], h); }
// the hand-built kits' atlases are colleges (b5: Keble, Merton, New College, the Union; Worcester; Radcliffe Square)
const LIT_BY_NAME = { 'b5-atlas': LIT_CLASS.college, 'worcester-atlas': LIT_CLASS.college, 'radcliffe-atlas': LIT_CLASS.college };

export function atlasMaterial({ map, aux = null, n = 4, ny = n, wallBias = false, windows = false, litSeed = false, noise = 0, noiseFrom = -1, ao = false, base = false, weather = false, macro = 0, macroGrey = false, layered = false, weatherCells = 16, weatherFrom2 = -1, noiseTo = -1, bump = 0, ivy = false, wet = false, roughness = 0.9, metalness = 0, polygonOffset = 0, side = THREE.FrontSide, name = 'atlas', surf = undefined }) {
  const m = new THREE.MeshStandardMaterial({ map, roughness, metalness, side });
  m.name = name;
  if (windows) m.userData.fxOccluder = true;      // (a building: world/_fx_skylight.js draws these top-down for the heights round the camera)
  m.defines = { STANDARD: '', ATLAS_NX: n.toFixed(1), ATLAS_NY: ny.toFixed(1), ATLAS_PAD: '0.016' };
  if (aux) m.defines.USE_AUX = '';
  if (windows) m.defines.USE_WINDOWS = '';
  // night windows: the class rides in the seed's eighths on the city facade (LIT_SEED), else one class per material
  if (windows && litSeed) m.defines.LIT_SEED = '';
  else if (windows) m.defines.LIT_FIXED = (LIT_BY_NAME[name] ?? LIT_CLASS.generic).toFixed(1);
  if (noise) m.defines.VAR_NOISE = noise.toFixed(4);
  if (noiseFrom >= 0) m.defines.NOISE_FROM = noiseFrom.toFixed(1);
  if (noiseTo >= 0) m.defines.NOISE_TO = noiseTo.toFixed(1);
  if (weatherFrom2 >= 0) m.defines.WEATHER_FROM2 = weatherFrom2.toFixed(1);
  if (bump) m.defines.USE_LBUMP = bump.toFixed(3);
  if (ivy) m.defines.USE_IVY = '';
  if (ivy && litSeed) m.defines.IVY_NO_SHOP = '';      // (the city facade: creeper keeps off shopfront cells, so a fascia can be read)
  if (wet) m.defines.USE_WET = '';
  if (ao) m.defines.USE_WAO = '';
  if (base) m.defines.USE_WBASE = '';
  if (weather) { m.defines.USE_WEATHER = ''; m.defines.WEATHER_CELLS = weatherCells.toFixed(1); }
  if (macro) m.defines.USE_MACRO = macro.toFixed(4);
  if (macroGrey) m.defines.MACRO_GREY = '';
  if (layered) m.defines.USE_LAYER_BIAS = '';
  // texture pass: photo-scanned grain from the surface-detail array (world/_surf_detail.js), top tier only. `surf` is the
  // cell -> layer table spec ({cell: 'layer', '*': default}); an atlas that names none (the hand-built college kits) gets
  // the dressed-stone face on everything that is not glass, paint or greenery. surf: null opts out.
  const surfT = SURF.on && surf !== null ? surfTable(surf || { '*': 'stone' }, n * ny) : null;
  if (surfT) { m.defines.USE_SURF = ''; if (!surf || surf.auto) m.defines.SURF_AUTO = ''; }
  // z-fighting between walls that share a plane (adjoining buildings, a part over its outline): each wall is drawn one of
  // 16 hairs nearer by its seed, scaled about the eye (screen position unchanged), so one of them always wins cleanly
  if (wallBias) m.defines.USE_WALL_BIAS = '';
  if (polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -polygonOffset; m.polygonOffsetUnits = -polygonOffset * 2; }
  const sun4 = SURF.wanted && SUN_SH.wanted && !!sunShadowChunk();      // (decided with the surfaces, once at boot: the top tier's session)
  m.onBeforeCompile = (sh) => {
    // the sky-light map (world/_fx_skylight.js) is read at the top of this material's own code — its windows and wet
    // ground need it before the lights do — and the lights chunk is told not to fetch again; where that module's chunks
    // are not installed (a page without the world) the two calls are stubs: the open sky, everywhere
    const SK_PARS = THREE.ShaderChunk.__gtoSkyl ? '#define GTO_SK_EARLY\n' : 'float gtoSkSeen() { return 1.0; }\nvoid gtoSkFetch(vec3 w, vec3 n) {}\n';
    sh.uniforms.auxMap = { value: aux };
    if (surfT) { sh.uniforms.surfD = SURF.uD; sh.uniforms.surfN = SURF.uN; sh.uniforms.uSurfK = SURF.uK; sh.uniforms.uSurfT = { value: surfT }; sh.uniforms.uSurfIvy = { value: new THREE.Vector2(SURF.index.ivy ?? -1, SURF.index.ivy !== undefined ? 1 / SURF.layers[SURF.index.ivy].metres : 1) }; }
    sh.uniforms.uNight = U.night; sh.uniforms.uLitFrac = U.litFrac; sh.uniforms.uLitColor = U.litColor; sh.uniforms.uLitK = U.litK; sh.uniforms.uLitG = U.litG; sh.uniforms.uLitGain = U.litGain;
    sh.uniforms.uSkyZen = U.skyZen; sh.uniforms.uSkyHor = U.skyHor; sh.uniforms.uAir = U.air; sh.uniforms.uWetv = U.wetv; sh.uniforms.uWet2 = U.wet2;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aCell;\nattribute vec3 aTint;\nvarying vec4 vCell;\nvarying vec3 vTint;\nvarying vec3 vWPos;\nvarying vec3 vWNor;\n#ifdef USE_WAO\nattribute float aTop;\nvarying float vTop;\n#endif\n#ifdef USE_WBASE\nattribute float aBase;\nvarying float vBase;\n#endif')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvCell = aCell;\n\tvTint = aTint;\n#ifdef USE_WAO\n\tvTop = aTop;\n#endif\n#ifdef USE_WBASE\n\tvBase = aBase;\n#endif')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n\tvWNor = normalize(mat3(modelMatrix) * objectNormal);\n#ifdef USE_LAYER_BIAS\n\tmvPosition.xyz *= 1.0 - aLayer * ' + LAYER_BIAS + ';\n\tgl_Position = projectionMatrix * mvPosition;\n#endif\n#ifdef USE_WALL_BIAS\n\tmvPosition.xyz *= 1.0 - floor(fract(floor(aCell.w + 0.0625) * 0.618034 + aCell.x * 0.37) * 16.0) * 0.00005;\n\tgl_Position = projectionMatrix * mvPosition;\n#endif');
    if (layered) sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLayer;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SK_PARS + 'uniform sampler2D auxMap;\nuniform float uNight;\nuniform float uLitFrac;\nuniform vec4 uLitK;\nuniform float uLitG;\nuniform float uLitGain;\nuniform vec3 uLitColor;\nuniform vec3 uSkyZen;\nuniform vec3 uSkyHor;\nuniform vec4 uWetv;\nuniform vec4 uWet2;\n#ifdef AIR_VIEW\nuniform vec3 uAir;\n#endif\nvarying vec4 vCell;\nvarying vec3 vTint;\nvarying vec3 vWPos;\nvarying vec3 vWNor;\n#ifdef USE_WAO\nvarying float vTop;\n#endif\n#ifdef USE_WBASE\nvarying float vBase;\n#define W_Y (vWPos.y - vBase)\n#else\n#define W_Y vWPos.y\n#endif\n' + SURF_PARS + '#ifdef USE_SURF\nuniform vec4 uSurfT[64];\nuniform vec2 uSurfIvy;\n#endif\n' + GLSL_HASH + PAINT_GLSL)
      .replace('#include <map_fragment>', /* glsl */`
	gtoSkFetch(vWPos, normalize(vWNor) * (gl_FrontFacing ? 1.0 : -1.0));
	vec2 wUv = vMapUv;
	float wWetR = 0.0;   // weather: how much of the sky a wet surface mirrors (set below, used with the emissive)
	float wReflK = 0.0;  // the reflection mask written to alpha for the post chain's screen-space reflections (post.js)
	float wSeed = floor(vCell.w * 8.0 + 0.5) * 0.125;   // snap: interpolation jitter must not reach the hashes
#ifdef LIT_SEED
	// night windows pass: the city facade carries the building's window-light class in the seed's eighths
	float wCls = floor(fract(wSeed) * 8.0 + 0.5); wSeed = floor(wSeed);
#elif defined(LIT_FIXED)
	float wCls = LIT_FIXED;
#endif
	vec2 wBay = floor(wUv);
	float wPick = wHash12(wBay + vec2(wSeed * 0.37, wSeed * 0.11));
	float wCellIdx = floor((wPick < vCell.z ? vCell.y : vCell.x) + 0.5);
	vec2 wN2 = vec2(ATLAS_NX, ATLAS_NY);
	vec2 wCellXY = vec2(mod(wCellIdx, ATLAS_NX), ATLAS_NY - 1.0 - floor(wCellIdx / ATLAS_NX));
	float wSpan = 1.0 - 2.0 * ATLAS_PAD;
	vec2 wCuv = (wCellXY + ATLAS_PAD + fract(wUv) * wSpan) / wN2;
	vec2 wGx = dFdx(wUv) * (wSpan / wN2);
	vec2 wGy = dFdy(wUv) * (wSpan / wN2);
#ifdef AIR_VIEW
	wGx *= 1.6; wGy *= 1.6;   // aerial: a coarser mip — mown stripes and courses shimmer into moire at grazing angles from height
#endif
	vec4 wTex = textureGrad(map, wCuv, wGx, wGy);
#ifdef AIR_VIEW
	{
		// aerial: from height a pixel covers many texels, and past the mip where an atlas cell's padding is under a texel
		// (4 px of a 256 px ground cell: mip 2) the neighbouring cells bleed in at every tile edge. That is a pattern with
		// the tile's period (2-5 m) which no further mip can average (fract() restarts it), and it showed as rings of
		// moire all over the fields from a glider. So fade to the cell's exact mean colour (the mip at which a cell is
		// one texel, read at its centre) before the bleed starts; close to the ground nothing changes.
		float aTexW = float(textureSize(map, 0).x);
		float aCellL = log2(aTexW / ATLAS_NX);
		float aLod = 0.5 * log2(max(dot(wGx, wGx), dot(wGy, wGy)) + 1e-12) + log2(aTexW);
		wTex = mix(wTex, textureLod(map, (wCellXY + 0.5) / wN2, aCellL), smoothstep(aCellL - 6.5, aCellL - 4.5, aLod));
	}
#endif
#ifdef USE_AUX
	vec4 wAux = textureGrad(auxMap, wCuv, wGx, wGy);
#else
	vec4 wAux = vec4(0.0, 1.0, 0.0, 1.0);
#endif
	vec3 wTexP = wTex.rgb;   // the painted colour alone (the relief from the albedo reads it: not the scanned grain's)
#ifdef USE_SURF
	// texture pass (top tier): photo-scanned grain in world space at real size — see world/_surf_detail.js
	float sKn = 0.0, sRo = 0.0; vec2 sNxy = vec2(0.0), sGx = vec2(0.0), sGy = vec2(0.0);
	if (uSurfK > 0.0) {
		vec4 sT = uSurfT[int(clamp(wCellIdx, 0.0, 63.0))];
		if (sT.x >= 0.0) {
			// The vertex normal picks the projection (it is exact). Some hand-built walls carry normals that are not the
			// surface's (pointing up, for their lighting): by those a wall would be mapped as ground, one texel smeared up
			// it. There the geometric normal (screen derivatives) decides — wall or ground only, the wall's direction
			// snapped to 3 degree steps: derivatives of positions hundreds of metres from the origin are too noisy to
			// project by (the grain would crawl), a snapped direction is steady.
			vec3 sPx = dFdx(vWPos), sPy = dFdy(vWPos);
			vec3 sNw = normalize(vWNor);
			vec3 sNg = cross(sPx, sPy); float sNl = length(sNg);
			if (sNl > 1e-12 && abs(dot(sNg, sNw)) < 0.8 * sNl) {
				sNg /= sNl;
				float sAng = floor(atan(sNg.z, sNg.x) * 19.0986 + 0.5) / 19.0986;
				sNw = length(sNg.xz) > 0.5 ? vec3(cos(sAng), 0.0, sin(sAng)) : vec3(0.0, 1.0, 0.0);
			}
			float sH = length(sNw.xz);
			vec2 sUv;
			if (sH < 0.2) { sUv = vWPos.xz; sGx = sPx.xz; sGy = sPy.xz; }
			else { vec2 sTn = vec2(-sNw.z, sNw.x) / sH; sUv = vec2(dot(vWPos.xz, sTn), vWPos.y / sH); sGx = vec2(dot(sPx.xz, sTn), sPx.y / sH); sGy = vec2(dot(sPy.xz, sTn), sPy.y / sH); }
			float sRep = abs(sT.y);
			sUv *= sRep; sGx *= sRep; sGy *= sRep;
			float sDist = length(vWPos - cameraPosition);
			float sMask = (1.0 - wAux.r) * (1.0 - 0.6 * wAux.b);
#ifdef SURF_AUTO
			sMask *= 1.0 - step(wTex.r * 1.04, wTex.g) * step(wTex.b * 1.1, wTex.g);   // not on greenery (a kit's lawn or creeper cell)
#endif
			vec4 sD = textureGrad(surfD, vec3(sUv, sT.x), sGx, sGy);
			float sKa = abs(sT.z) * sMask;
			float sKnW = abs(sT.w);
			if (sT.w < 0.0) {
				// ashlar in world space (pass 2): 30 cm courses level round the whole building, blocks 0.72 m or (two run
				// together) 1.44 m long, each its own tone, fine lime joints — on the stone of the cell only (warm buff
				// texels: not glass, paint or brick). The painter leaves the joints out of these cells on this tier.
				vec3 aQ = max(wTex.rgb, vec3(0.004));
				float aSt = sMask * wAux.g * smoothstep(1.1, 1.3, aQ.g / aQ.b) * (1.0 - smoothstep(1.35, 1.65, aQ.r / aQ.g));
				vec2 aP = sUv / sRep;
				float aFw = max(length(sGx), length(sGy)) / sRep;     // a pixel, in metres
				float aRow = floor(aP.y / 0.3), aV = fract(aP.y / 0.3);
				float aX = aP.x / 0.72 + wHash12(vec2(aRow, wSeed * 0.13)) * 7.0, aI = floor(aX), aFx = aX - aI;
				bool aNoL = mod(aI + aRow, 2.0) > 0.5 && wHash12(vec2(aI, aRow) + wSeed * 0.07) < 0.55;
				bool aNoR = mod(aI + 1.0 + aRow, 2.0) > 0.5 && wHash12(vec2(aI + 1.0, aRow) + wSeed * 0.07) < 0.55;
				float aTone = wHash12(vec2(aNoL ? aI - 1.0 : aI, aRow) * 1.37 + wSeed * 0.031 + 5.0);
				float aTone2 = fract(aTone * 37.1);
				float aD = min(min(aNoL ? 1.0 : aFx, aNoR ? 1.0 : 1.0 - aFx) * 0.72, min(aV, 1.0 - aV) * 0.3);
				float aJ = (1.0 - smoothstep(0.002, 0.002 + aFw * 1.2, aD)) * min(1.0, 0.007 / max(aFw, 1e-5));
				float aVis = aSt * (1.0 - smoothstep(0.06, 0.22, aFw));                      // (block tones fade once a course is a few pixels)
				vec3 aCol = vec3(0.925 + 0.15 * aTone) * mix(vec3(1.0), vec3(1.035, 1.0, 0.945), aTone2 * 2.0 - 1.0 > 0.0 ? aTone2 - 0.5 : 0.0);
				aCol *= aTone2 < 0.06 ? 1.07 : 1.0;                                             // the odd pale refacing stone
				wTex.rgb *= mix(vec3(1.0), aCol, aVis);
				wTex.rgb *= 1.0 - 0.34 * aJ * aSt;
			}
			if (sT.y < 0.0) {
				// a 'field' layer (real-size brick): only the brick-coloured texels of the bay (red well above green and blue —
				// not its glass, frames, doors, sills or stone arches); the scan is tinted by the painted brickwork's own
				// colour just there (the mean over 1/64 of a cell: bricks and joints averaged), so each house keeps its brick
				vec3 sQ = max(wTex.rgb, vec3(0.004));
				float sNear = 1.0 - smoothstep(30.0, 70.0, sDist);
				sMask *= smoothstep(1.12, 1.28, sQ.r / sQ.g) * smoothstep(1.25, 1.5, sQ.r / sQ.b);
				wTex.rgb = mix(wTex.rgb, textureLod(map, wCuv, log2(float(textureSize(map, 0).x) / ATLAS_NX) - 6.0).rgb, sNear * sMask);
				sKa = abs(sT.z) * sMask * sNear;
			} else if (sT.z < 0.0) {
				// a 'full' layer: near the camera the painted picture gives only its mean colour (the mip at which a cell is
				// one texel) and the scan gives the stones and joints; by 70 m the painted picture is back
				float sNear = 1.0 - smoothstep(30.0, 70.0, sDist);
				wTex.rgb = mix(wTex.rgb, textureLod(map, (wCellXY + 0.5) / wN2, log2(float(textureSize(map, 0).x) / ATLAS_NX)).rgb, sNear * sMask);
				sKa *= sNear;
			}
			wTexP = wTex.rgb;
			wTex.rgb *= mix(vec3(1.0), sD.rgb * 2.0, sKa);
			sRo = (sD.a - 0.5) * sKa;
			sKn = sKnW * sMask * (1.0 - smoothstep(25.0, 60.0, sDist));
			if (sKn > 0.0) sNxy = textureGrad(surfN, vec3(sUv, sT.x), sGx, sGy).rg * 2.0 - 1.0;
		}
	}
#endif
	vec3 wTintC = mix(vec3(1.0), vTint, wAux.g);
	// paint colour: per pair of bays, or (vCell.z < 0: one shop/house unit per quad) from the seed alone
	wTintC = mix(wTintC, wPaint(wHash12(vec2(vCell.z < 0.0 ? 7.0 : floor(wBay.x * 0.5), wSeed * 0.731 + 0.5))) * 1.6, wAux.b);
#ifdef VAR_NOISE
#ifdef NOISE_FROM
#ifdef NOISE_TO
	if (wCellIdx >= NOISE_FROM && wCellIdx < NOISE_TO) {
#else
	if (wCellIdx >= NOISE_FROM) {
#endif
#endif
	float wN = wNoise(vWPos.xz * VAR_NOISE) * 0.6 + wNoise(vWPos.xz * VAR_NOISE * 4.7 + 13.0) * 0.4;
	wTintC *= 0.8 + 0.4 * wN;
#ifdef NOISE_FROM
	}
#endif
#endif
#ifdef USE_MACRO
	float wM = wNoise(vWPos.xz * USE_MACRO) * 0.55 + wNoise(vWPos.xz * USE_MACRO * 3.3 + 7.0) * 0.3 + wNoise(vWPos.xz * USE_MACRO * 11.0 + 3.0) * 0.15;
#ifdef MACRO_GREY
	wTintC *= mix(0.88, 1.08, wM);
#else
	// vegetation cells (grass, lawn, meadow, woodland) shift green/yellow; hard surfaces only in brightness
	// pass 5: wider swing on grass (lush dark green patches -> drier, yellower ones); the rough cells (meadow, plain
	// grass) swing further than mown lawn
	float wVeg = step(3.5, wCellIdx) * step(wCellIdx, 7.5);
	float wRough = abs(wCellIdx - 5.0) < 0.5 ? 0.55 : 1.0;
	vec3 wVegT = mix(vec3(0.7, 0.82, 0.66), vec3(1.26, 1.14, 0.84), smoothstep(0.22, 0.78, wM));
	wTintC *= mix(vec3(mix(0.88, 1.08, wM)), mix(vec3(1.0), wVegT, wRough), wVeg);
#endif
#endif
	float wVert = 1.0 - abs(normalize(vWNor).y);
#ifdef USE_WEATHER
#ifdef WEATHER_FROM2
	bool wWall = wCellIdx < WEATHER_CELLS || wCellIdx >= WEATHER_FROM2;
#else
	bool wWall = wCellIdx < WEATHER_CELLS;
#endif
	if (wWall && wVert > 0.5) {
		// rain streaks below sills/parapets, soot towards the top, lichen-green near the ground; per-building strength
		float wBld = fract(wSeed * 0.6180339);
		float wAlong = dot(vWPos.xz, vec2(0.7071, 0.7071)) + vWPos.x * 0.29;
		float wStreak = smoothstep(0.55, 0.95, wNoise(vec2(wAlong * 2.6, vWPos.y * 0.09 + wSeed)));
		float wBlot = wNoise(vWPos.xz * 0.21 + vWPos.y * 0.33 + wSeed);
		vec3 wDirt = mix(vec3(1.0), vec3(0.78, 0.76, 0.72), wStreak * (0.35 + 0.5 * wBld) * (1.0 - wAux.r));
		wDirt *= mix(vec3(1.0), vec3(0.86, 0.9, 0.78), (1.0 - smoothstep(0.2, 2.6, W_Y)) * wBlot * 0.8);
		wDirt *= 1.0 - 0.12 * smoothstep(0.35, 0.8, wBlot) * wBld;
		// stone pass (2026-11, photo comparison item 3): Oxford stone is not one clean yellow. On stone texels only (warm
		// buff: green well above blue, red not far above green — not brick, render, paint or glass): a little less
		// colour, broad grey weathered patches, and soot where the rain never washes it off — under cornices, string
		// courses and sills — and in a grimy plinth. How weathered: per building (its seed) and, so that long hand-built
		// fronts are not uniform either, a slow city-scale field.
		vec3 wTx = max(wTex.rgb, vec3(0.004));
		float wStone = smoothstep(1.18, 1.38, wTx.g / wTx.b) * (1.0 - smoothstep(1.35, 1.65, wTx.r / wTx.g)) * (1.0 - wAux.b) * (1.0 - wAux.r);
		if (wStone > 0.01) {
			float wAge = clamp(0.22 + 0.5 * wBld + 0.6 * (wNoise(vWPos.xz * 0.035 + 17.0) - 0.5), 0.0, 1.0);
			wDirt *= mix(vec3(1.0), vec3(dot(wTx, vec3(0.299, 0.587, 0.114))) / wTx, 0.18 * wStone);
			float wPatch = smoothstep(0.5, 0.8, wNoise(vec2(wAlong * 0.42, vWPos.y * 0.55) + wSeed * 3.1) * 0.7 + wBlot * 0.3);
			wDirt *= mix(vec3(1.0), vec3(0.83, 0.83, 0.82), wPatch * wAge * wStone);
			float wSoot = (1.0 - smoothstep(0.15, 1.3, W_Y)) * 0.75;
#ifdef USE_WAO
			wSoot = max(wSoot, (1.0 - smoothstep(0.0, 1.9, vTop - vWPos.y)) * (0.5 + 0.5 * (1.0 - wStreak)));
#endif
			wSoot *= wAge * (0.55 + 0.45 * wNoise(vec2(wAlong * 1.7, vWPos.y * 0.8) + wSeed));
			wDirt *= mix(vec3(1.0), vec3(0.52, 0.51, 0.49), wSoot * wStone);
		}
		wTintC *= mix(vec3(1.0), wDirt, wAux.g);
	}
#endif
	diffuseColor.rgb *= wTex.rgb * wTintC;
#ifdef USE_IVY
	// creeper on some walls (seed >= 4000): a noise mask that climbs from the ground and thins out upwards; glass stays clear
	if (wSeed > 3999.5 && wVert > 0.5) {
		float iA = dot(vWPos.xz, vec2(0.7071, 0.7071)) + vWPos.x * 0.29;
		float iReach = 3.5 + 7.0 * fract(wSeed * 0.137);
		float iN = wNoise(vec2(iA * 0.33, vWPos.y * 0.27) + wSeed) * 0.62 + wNoise(vec2(iA * 1.3, vWPos.y * 1.1)) * 0.26 + wNoise(vec2(iA * 6.0, vWPos.y * 6.0)) * 0.12;
		float iM = smoothstep(0.47, 0.53, iN - 0.3 * W_Y / iReach + 0.1) * (1.0 - smoothstep(iReach * 0.7, iReach, W_Y)) * (1.0 - wAux.r);
		iM *= 1.0 - wAux.b;      // never over painted joinery: a door, a fascia
#ifdef IVY_NO_SHOP
		// shopfront, shop door, shop A / B, shop door A, pub, cafe and awning cells: no creeper across a shop's front
		if ((wCellIdx > 9.5 && wCellIdx < 11.5) || (wCellIdx > 31.5 && wCellIdx < 36.5) || abs(wCellIdx - 40.0) < 0.5) iM = 0.0;
#endif
		float iL = wNoise(vec2(iA, vWPos.y) * 17.0) * 0.6 + wNoise(vec2(iA, vWPos.y) * 43.0) * 0.4;
		vec3 iCol = mix(vec3(0.035, 0.085, 0.022), vec3(0.13, 0.24, 0.06), iL);
		iCol = mix(iCol, vec3(0.3, 0.08, 0.03), step(0.86, fract(wSeed * 0.317)) * iL);   // a few Virginia creepers turning red
#ifdef USE_SURF
		// texture pass 2 (top tier): photo ivy leaves over the creeper's colour, and its edge follows the leaves' own shapes
		if (uSurfK > 0.0 && uSurfIvy.x >= 0.0 && iM > 0.0) {
			vec2 iUv = vec2(iA, vWPos.y) * uSurfIvy.y;
			vec3 iD = texture(surfD, vec3(iUv, uSurfIvy.x)).rgb * 2.0;
			float iNear = 1.0 - smoothstep(30.0, 70.0, length(vWPos - cameraPosition));
			iCol = mix(iCol, mix(vec3(0.045, 0.095, 0.03), vec3(0.11, 0.2, 0.055), 0.5) * iD * 1.5, iNear);
			iM *= mix(1.0, smoothstep(0.25, 0.6, dot(iD, vec3(0.333)) + iM * 0.7 - 0.2), iNear);
		}
#endif
		diffuseColor.rgb = mix(diffuseColor.rgb, iCol, iM);
	}
#endif
#ifdef AIR_VIEW
	{
		// aerial variants only (world.setAerial): cloud shadows drifting over the city with the wind
		vec2 aP = vWPos.xz * 0.0013 + uAir.xy;
		float aC = wNoise(aP) * 0.62 + wNoise(aP * 2.9 + 5.3) * 0.38;
		diffuseColor.rgb *= 1.0 - uAir.z * smoothstep(0.5, 0.68, aC);
		// a little more colour than on the ground: through a few hundred metres of air honey stone, red brick, slate and
		// grass must still part company (the haze then takes some of it back)
		float aL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
		diffuseColor.rgb = max(mix(vec3(aL), diffuseColor.rgb, 1.25), vec3(0.0));
	}
#endif
#ifdef USE_WAO
	// ambient occlusion without post-processing: dark where walls meet the ground (y = 0) and under the eaves
	float wAO = mix(0.62, 1.0, smoothstep(0.0, 1.8, W_Y)) * (1.0 - 0.3 * (1.0 - smoothstep(0.0, 1.1, vTop - vWPos.y)));
	diffuseColor.rgb *= mix(1.0, wAO, wVert);
#endif
`)
      .replace('#include <roughnessmap_fragment>', /* glsl */`float roughnessFactor = roughness * mix(1.0, 0.22, wAux.r);
#ifdef USE_SURF
	roughnessFactor = clamp(roughnessFactor + sRo * 0.6, 0.04, 1.0);
#endif
#ifdef USE_WET
	// tarmac / setts at night: a patchy damp sheen so lamps and headlights streak along the road
	if (wCellIdx < 0.5 || abs(wCellIdx - 2.0) < 0.5 || abs(wCellIdx - 9.0) < 0.5 || abs(wCellIdx - 14.0) < 0.5 || abs(wCellIdx - 18.0) < 0.5) {
		float wPud = smoothstep(0.35, 0.75, wNoise(vWPos.xz * 0.23) * 0.6 + wNoise(vWPos.xz * 0.9 + 4.0) * 0.4);
		roughnessFactor = mix(roughnessFactor, 0.32, uNight * (0.35 + 0.5 * wPud));
		diffuseColor.rgb *= 1.0 - 0.22 * uNight * wPud;
	}
#endif
	// weather (graphics pass 8, every tier; one uniform test when dry): rain darkens the ground and the stone, tarmac /
	// setts / paving turn glossy with puddles that mirror the sky; lying snow on lawns and roofs, frost on the grass
	if (uWetv.x + uWetv.y + uWetv.z + uWet2.x > 0.001) {
		float wUp = normalize(vWNor).y;
		float wGreen = step(3.5, wCellIdx) * step(wCellIdx, 7.5);
		if (wUp > 0.55) {
			float wN = wNoise(vWPos.xz * 0.21) * 0.6 + wNoise(vWPos.xz * 0.83 + 4.0) * 0.4;
			float wK = uWetv.x * (wGreen > 0.5 ? 0.5 : 1.0);
			// puddles: standing water in the hollows of the noise field. They fill as the rain goes on and shrink back
			// towards their middles for hours after the surface has dried (uWet2.x: the water standing in them)
			float wPT = mix(0.9, 0.5, uWet2.x);
			float wPud = smoothstep(wPT, wPT + 0.16, wN) * min(1.0, uWet2.x * 5.0);
			float wDamp = max(wK, wPud * (wGreen > 0.5 ? 0.0 : 1.0));
			diffuseColor.rgb *= 1.0 - (0.3 + 0.15 * wPud) * wDamp;
			if (wGreen < 0.5) { roughnessFactor = mix(roughnessFactor, mix(0.42, 0.06, wPud), wDamp); wWetR = max(wK * 0.24, wPud); }
			// snow lies on grass and roofs first, thinly on the hard ground; frost silvers the grass
			float wRoof = 0.0;
#ifdef USE_WINDOWS
			wRoof = step(15.5, wCellIdx);   // the city atlas: roofs and parapet tops
#endif
			float wS = uWetv.y * (wGreen > 0.5 || wRoof > 0.5 ? 1.0 : 0.25 * smoothstep(0.55, 0.8, wN)) * smoothstep(0.25, 0.6, wN + uWetv.y * 0.5);
			diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.92), wS);
			diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.68, 0.7), uWetv.z * wGreen * (0.45 + 0.35 * wN));
			roughnessFactor = mix(roughnessFactor, 0.85, max(wS, uWetv.z * wGreen));
		} else if (wUp > -0.3) {
			// walls: wet stone and brick go darker, most near the ground where the splashes reach
			diffuseColor.rgb *= 1.0 - uWetv.x * (0.12 + 0.12 * (1.0 - smoothstep(0.0, 2.5, vWPos.y))) * (1.0 - wAux.r);
		}
	}`)
      .replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
#ifdef USE_SURF
	sKn *= 1.0 - min(wWetR, 1.0);   // standing water lies flat over the grain
#endif
` + SURF_NORMAL + /* glsl */`
#ifdef USE_LBUMP
	{
		// relief from the albedo: joints, glazing bars and reveals are darker than the faces around them, so treating
		// luminance as height lets the sun rake across courses (screen-space derivative; fades out with distance)
		float wFade = 1.0 - smoothstep(18.0, 55.0, length(vViewPosition));
		vec2 wEd = min(fract(wUv), 1.0 - fract(wUv)), wFw = fwidth(wUv) * 1.5;
		wFade *= step(wFw.x, wEd.x) * step(wFw.y, wEd.y);   // not across cell seams
		if (wFade > 0.0) {
			float wHt = dot(wTexP, vec3(0.3333)) * USE_LBUMP * wFade;
			vec2 wDh = vec2(dFdx(wHt), dFdy(wHt));
			vec3 wSx = dFdx(-vViewPosition), wSy = dFdy(-vViewPosition);
			vec3 wR1 = cross(wSy, normal), wR2 = cross(normal, wSx);
			float wDet = dot(wSx, wR1) * faceDirection;
			vec3 wG = sign(wDet) * (wDh.x * wR1 + wDh.y * wR2);
			normal = normalize(abs(wDet) * normal - wG);
		}
	}
#endif`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
#ifdef USE_WINDOWS
#ifdef USE_SURF
	// texture pass 2 (top tier): the wall's frame for the glass — bays per metre along it and storeys per metre up it
	// (from screen derivatives, taken here, outside the glass branch)
	vec3 gPx = dFdx(vWPos), gPy = dFdy(vWPos);
	vec2 gUx = dFdx(wUv), gUy = dFdy(wUv);
#endif
	if (wAux.r > 0.004) {   // glass only: walls and roofs skip the whole block
	// ONE hash per window (was five); its digits give the other choices
	float wLitH = wHash12(wBay * vec2(1.731, 0.917) + vec2(wSeed * 0.013, 3.7));
	// (night windows pass: the share by kind of building and hour, uLitK / uLitG from setLitShares)
	float wShare = wCls < 0.5 ? uLitFrac : wCls < 1.5 ? uLitK.x : wCls < 2.5 ? uLitK.y : wCls < 3.5 ? uLitK.z : uLitK.w;
	float wLit = step(wLitH, wShare + (wBay.y < 1.0 ? uLitG : 0.0));
	float wA = fract(wLitH * 61.7), wWarm = fract(wLitH * 157.3), wCurt = fract(wLitH * 421.9);
	// rooms at very different strengths (kept well under white so the colour survives the tone mapping): mostly warm
	// tungsten, some deep amber lamp light, a few cool TV / strip-light rooms
	vec3 wGlow = uLitColor * (0.16 + 0.42 * wA * wA) * uLitGain;
	wGlow *= wWarm > 0.86 ? vec3(0.55, 0.78, 1.1) : wWarm < 0.3 ? vec3(1.12, 0.7, 0.4) : vec3(1.0);
	vec2 wF = fract(wUv);
	// what is painted behind the glass shapes the glow: curtains, nets and blinds light up, the bare room stays dim and
	// is brightest near the ceiling; a third of the lit rooms have the curtains drawn (flat, dimmer, redder)
	// pass 5: the glow is the painted interior itself (shop displays keep their colours and shapes), capped below white
	vec3 wShade = min(wTex.rgb * 2.6 + 0.1, vec3(1.0)) * (0.75 + 0.5 * wF.y);
	if (wCurt < 0.33) { wGlow *= vec3(0.95, 0.74, 0.54); wShade = min(wTex.rgb * 1.2 + 0.3, vec3(0.85)); }
	totalEmissiveRadiance += wGlow * wAux.r * wLit * uNight * wShade;
	vec3 wN3 = normalize(vWNor);
	vec3 wV = normalize(vWPos - cameraPosition);
#ifdef USE_SURF
	float gRoom = 1.0, gRoomK = 0.0;
	if (uSurfK > 0.0) {
		float gFade = 1.0 - smoothstep(35.0, 60.0, length(vWPos - cameraPosition));
		float gHl = length(wN3.xz);
		if (gFade > 0.0 && gHl > 0.5) {
			vec3 gT = vec3(-wN3.z, 0.0, wN3.x) / gHl;
			float gA = dot(gPx, gT), gB = dot(gPy, gT), gKu = (gUx.x * gA + gUy.x * gB) / max(gA * gA + gB * gB, 1e-9);
			float gKv = (gUx.y * gPx.y + gUy.y * gPy.y) / max(gPx.y * gPx.y + gPy.y * gPy.y, 1e-9);
			// old glass: no two panes lie in one plane, and each has a slow ripple — the mirror image breaks from pane to
			// pane as you walk past (the tilt is a noise field about a pane across, in metres along and up the wall)
			vec2 gM = vec2(dot(vWPos.xz, gT.xz), vWPos.y);
			vec2 gTilt = vec2(wNoise(gM * 3.1 + wSeed), wNoise(gM * 3.1 + wSeed + 31.7)) - 0.5;
			gTilt += (vec2(wNoise(gM * 17.0), wNoise(gM * 17.0 + 9.1)) - 0.5) * 0.3;
			wN3 = normalize(wN3 + (gT * gTilt.x + vec3(0.0, 1.0, 0.0) * gTilt.y) * 0.07 * gFade);
			// the room behind (interior mapping, no geometry): a box one bay wide, one storey high and 3.2 m deep. The
			// view ray is followed from the glass to the wall, ceiling or floor it meets; each is shaded differently and
			// all darken with depth, so the room moves against its window frame as you pass
			vec3 gD = vec3(dot(wV, gT) * gKu, wV.y * gKv, max(dot(wV, -wN3), 0.02));
			vec2 gF = fract(wUv);
			float gTu = (gD.x > 0.0 ? 1.0 - gF.x : gF.x) / max(abs(gD.x), 1e-4);
			float gTv = (gD.y > 0.0 ? 1.0 - gF.y : gF.y) / max(abs(gD.y), 1e-4);
			float gTz = 3.2 / gD.z, gTm = min(gTz, min(gTu, gTv));
			float gWall = gTm == gTz ? 0.62 : gTm == gTu ? 0.46 : wV.y > 0.0 ? 0.85 : 0.3;      // back wall, side wall, ceiling, floor
			vec2 gH = gF + gD.xy * gTm;                                                          // where on that surface
			gWall *= 0.82 + 0.18 * smoothstep(0.0, 0.12, min(min(gH.x, 1.0 - gH.x), min(gH.y, 1.0 - gH.y)) + (gTm == gTz ? 0.0 : 0.12));   // corners gather shadow
			if (gTm == gTz) gWall *= 0.9 + 0.2 * step(0.5, fract(wLitH * 7.3 + floor(gH.x * 3.0) * 0.37)) * step(0.35, gH.y) * step(gH.y, 0.8);   // a door, a wardrobe, a picture on the back wall
			gRoom = gWall * mix(1.0, 0.62, clamp(gTm * gD.z / 3.2, 0.0, 1.0));
			gRoomK = gFade;
		}
	}
#endif
	vec3 wR = reflect(wV, wN3);
	float wFres = 0.08 + 0.92 * pow(1.0 - clamp(dot(-wV, wN3), 0.0, 1.0), 4.0);
	vec3 wSky = mix(uSkyHor, uSkyZen, clamp(wR.y * 1.6, 0.0, 1.0));
	if (wFres > 0.14) {
		// what the glass mirrors (graphics pass 9): the clouds drifting over (the same field as their shadows) and,
		// low down, the dark fronts and roofline of the street opposite
		if (gtoCloudA.w > 0.0 && wR.y > 0.04) {
			vec2 wCq = (vWPos.xz + wR.xz / wR.y * (gtoCloudB.z - vWPos.y) - gtoCloudA.xy) * gtoCloudB.w;
			float wCn = gtoCN(wCq) * 0.52 + gtoCN(mat2(1.6, 1.2, -1.2, 1.6) * wCq + vec2(3.1, 7.7)) * 0.27;
			wSky = mix(wSky, uSkyHor * 0.55 + vec3(0.62, 0.6, 0.57), smoothstep(gtoCloudA.z, gtoCloudA.z + 0.1, wCn / 0.79) * 0.85 * smoothstep(0.04, 0.2, wR.y));
		}
		float wSl = 0.07 + 0.3 * wNoise(wR.xz * 4.0 + wSeed * 0.37) * wNoise(wR.zx * 9.0 + 3.0);
		// lighting and buildings (2026-11-24): where the sky-light map knows the place, the roofline stands where the
		// roofs opposite really do (the mean sine of the horizon they make is 1 - the sky seen), and fronts that shut
		// the place in are in its shade: they take the zenith's cool light, not the horizon's glow. A window in a lane
		// or a quad no longer mirrors a bright sunset the range opposite hides. In the open (and with no map): as before.
		float wSeen = gtoSkSeen();
		wSl = max(wSl, (1.0 - wSeen) * 1.05 - 0.04 + (wSl - 0.07) * 0.5);
		vec3 wFront = mix(uSkyZen * 0.5 + uSkyHor * 0.1, uSkyHor, smoothstep(0.35, 0.8, wSeen)) * vec3(0.34, 0.3, 0.26);
		wSky = mix(wFront, wSky, smoothstep(wSl - 0.015, wSl + 0.02, wR.y));
	}
	// pass 5 (replaces the per-pane sparkle term): seen square-on, glass shows the dark room behind it; only at a
	// glancing angle does it mirror the sky. Gives the openings depth without geometry.
#ifdef USE_SURF
	if (gRoomK > 0.0) {
		// by day the dark glass shows the dim room (what is painted pale on the glass — curtains, nets, blinds, a shop's
		// lit display — is at the window and stays); at night a lit room is brighter at its ceiling and back wall
		float gLum = dot(wTex.rgb, vec3(0.299, 0.587, 0.114));
		float gK = wAux.r * gRoomK * (1.0 - smoothstep(0.22, 0.46, gLum));
		diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.3, 0.26) * gRoom * 1.35, gK * 0.85);
		totalEmissiveRadiance *= mix(1.0, 0.45 + 1.0 * gRoom, wAux.r * gRoomK * wLit * uNight);
	}
#endif
	diffuseColor.rgb *= 1.0 - wAux.r * (0.62 - 0.62 * wFres);
	totalEmissiveRadiance += wSky * wFres * wAux.r * 0.5 * (1.0 - wLit * uNight);
	}
#endif
	if (wWetR > 0.0) {
		// a wet road mirrors the sky: bright at a glancing angle (under an overcast, the brightest thing in the street)
		vec3 wV2 = normalize(vWPos - cameraPosition);
		float wF2 = 0.05 + 0.95 * pow(1.0 - clamp(-wV2.y, 0.0, 1.0), 4.0);
		vec3 wSk2 = mix(uSkyHor, uSkyZen, clamp(-wV2.y * 1.6, 0.0, 1.0));
		wReflK = wF2 * wWetR * 0.6;
		totalEmissiveRadiance += wSk2 * wReflK * mix(0.45, 1.0, smoothstep(0.2, 0.75, gtoSkSeen()));      // (shut in by fronts: less sky to mirror)
		wReflK *= smoothstep(0.92, 0.985, normalize(vWNor).y) * (1.0 - uWetv.y);   // (only flat ground mirrors the scene; not under snow)
	}
`)
      .replace('#include <dithering_fragment>', /* glsl */`#include <dithering_fragment>
#ifdef USE_FOG
	gl_FragColor.a = 1.0 - wReflK * (1.0 - fogFactor);
#else
	gl_FragColor.a = 1.0 - wReflK;
#endif
`);
    // aerial variants only: from height the whole screen is city receiving the big shadow box; a 4-tap bilinear PCF
    // (the soft filter takes 16) — at ~0.5 m shadow texels seen from hundreds of metres the difference is invisible
    if (sh.defines && sh.defines.AIR_VIEW !== undefined) sh.fragmentShader = sh.fragmentShader.replace('#include <shadowmap_pars_fragment>', airShadowChunk());
    // pixel-cost pass (top tier): the sun's soft shadow in 4 hardware comparison fetches, the same kernel (world/_px_shadow.js)
    else if (sun4) { sh.uniforms.gtoSunSh = SUN_SH.uMap; sh.uniforms.gtoSunShOn = SUN_SH.uOn; sh.fragmentShader = sh.fragmentShader.replace('#include <shadowmap_pars_fragment>', sunShadowChunk()); }
  };
  m.customProgramCacheKey = () => 'wAtlas' + n + 'x' + ny + (aux ? 'a' : '') + (windows ? 'w' : '') + noise + '_' + noiseFrom + (ao ? 'o' : '') + (weather ? 'e' + weatherCells : '') + macro + (macroGrey ? 'g' : '') + (layered ? 'L' : '') + 'b' + bump + (ivy ? 'i' : '') + (wet ? 'w' : '') + weatherFrom2 + '_' + noiseTo + (surfT ? (surf && !surf.auto ? 's' : 'sa') : '') + (ivy && litSeed ? 'n' : '') + (sun4 ? 'h4' : '') + (THREE.ShaderChunk.__gtoSkyl ? 'k' : '');
  return m;
}

/** Switch an optional shader feature of an atlas material on/off at run time (quality tiers): 'USE_LBUMP' (value = relief in metres), 'USE_WET'. */
let AIR_SHADOW = null;
function airShadowChunk() {
  if (AIR_SHADOW) return AIR_SHADOW;
  const src = THREE.ShaderChunk.shadowmap_pars_fragment;
  const i = src.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )'), j = src.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', i);
  if (i < 0 || j < 0) return (AIR_SHADOW = src);
  AIR_SHADOW = src.slice(0, i) + `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = mix( mix( texture2DCompare( shadowMap, uv, shadowCoord.z ), texture2DCompare( shadowMap, uv + vec2( texelSize.x, 0.0 ), shadowCoord.z ), f.x ),
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, texelSize.y ), shadowCoord.z ), texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ), f.x ), f.y );
		` + src.slice(j);
  return AIR_SHADOW;
}

export function setAtlasFeature(m, name, value) {
  const has = name in m.defines, want = value !== false && value !== 0 && value != null;
  const v = want ? (typeof value === 'number' ? value.toFixed(3) : '') : null;
  if (want === has && (!want || m.defines[name] === v)) return;
  if (want) m.defines[name] = v; else delete m.defines[name];
  m.needsUpdate = true;
}

/**
 * Ground-layer depth ordering without polygonOffset: vertices are pulled towards the camera along their view ray by
 * layer × LAYER_BIAS of their distance (screen position unchanged), so coplanar-ish layers stack at any distance in ONE
 * draw (per-vertex aLayer on the merged ground) or per material (addDepthBias).
 */
export const LAYER_BIAS = '0.0005';
export function addDepthBias(m, layer, key = 'db') {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.polygonOffset = false;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tmvPosition.xyz *= 1.0 - ' + layer.toFixed(1) + ' * ' + LAYER_BIAS + ';\n\tgl_Position = projectionMatrix * mvPosition;');
  };
  m.customProgramCacheKey = () => prevKey() + key + layer;
  if (TERRAIN_STACK_ON) m.defines = { ...(m.defines || {}), GTO_STACK: m.depthWrite === false ? TERRAIN_STACK : TERRAIN_STACK_SOFT };      // (terrain: what lies on the ground is ordered by drawing, with a pull towards the eye; world/terrain.js)
  m.userData.depthBias = layer;      // (read by core/_deoverlap.js and tools/audit_zfight.mjs: two materials with different biases are layered on purpose)
  return m;
}

/**
 * A sky sheen for glossy things (graphics pass 9: car and bus bodywork and glass): what a curved, polished surface
 * mirrors at a glancing angle — the sky's own gradient above the horizon (the same colours water and windows mirror,
 * clouds and overcast folded in), the dark street below it. Analytic: no cube map, no extra pass, ~12 instructions.
 */
export function addSkySheen(m, strength = 0.4, key = 'sheen') {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uSkyZen = U.skyZen; sh.uniforms.uSkyHor = U.skyHor;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSkyZen;\nuniform vec3 uSkyHor;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		vec3 shV = normalize(vViewPosition);
		float shF = 1.0 - clamp(dot(normal, shV), 0.0, 1.0); shF *= shF; shF = 0.03 + 0.97 * shF * shF;
		float shY = (reflect(-shV, normal) * mat3(viewMatrix)).y;
		vec3 shC = mix(uSkyHor * 0.22, mix(uSkyHor, uSkyZen, clamp(shY * 1.6, 0.0, 1.0)), smoothstep(-0.08, 0.08, shY));
		totalEmissiveRadiance += shC * shF * ${strength.toFixed(3)};
	}`);
  };
  m.customProgramCacheKey = () => prevKey() + key + strength;
  return m;
}

/** Add gentle wind sway to an (instanced) material. Model space: tree height = 1 (y 0..1). */
export function addWind(m, amp = 0.012, key = 'wind') {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
	float wSw = max(position.y - 0.25, 0.0);
#ifdef USE_INSTANCING
	float wPh = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
#elif defined( USE_BATCHING )
	float wPh = batchingMatrix[3].x * 0.13 + batchingMatrix[3].z * 0.07;
#else
	float wPh = 0.0;
#endif
	transformed.x += (sin(uTime * 1.3 + wPh) * 1.0 + sin(uTime * 3.7 + wPh * 2.0 + position.y * 6.0) * 0.35) * ${amp.toFixed(4)} * wSw;
	transformed.z += (cos(uTime * 1.1 + wPh * 1.3) * 0.8 + sin(uTime * 4.1 + position.x * 9.0) * 0.3) * ${amp.toFixed(4)} * wSw;`);
  };
  m.customProgramCacheKey = () => key + amp;
  return m;
}

/**
 * Stone pass (2026-11, photo comparison item 7 and the dusk stripes): what water mirrors when nothing nearer is in the
 * way. The sky dome's gradient above a dark band of the far bank — trees and buildings, a ragged line a few degrees up —
 * so that most of a river or lake seen from the bank is dark green-brown with sky only in the near water and the gaps,
 * as in photographs; and how contrasty the sky is (0 at noon .. 1 at dusk). post.js includes the same GLSL so its
 * screen-space reflections replace exactly this (same noise, same inputs: the reflected ray and the water's x, z).
 */
export const WATER_BANK_GLSL = /* glsl */`
float wSkyContrast(vec3 hor, vec3 zen) {
  float lh = dot(hor, vec3(0.2126, 0.7152, 0.0722)), lz = dot(zen, vec3(0.2126, 0.7152, 0.0722));
  return smoothstep(0.42, 0.78, abs(lh - lz) / (lh + lz + 0.02));
}
// R: the reflected ray (with the ripples); R0: the same off a flat surface — the bank line follows it, so the ripples
// break the edge of the trees' reflection up without speckling the whole band with sky
vec3 wWaterSky(vec3 R, vec3 R0, vec2 xz, vec3 hor, vec3 zen) {
  float ry = clamp(R.y, 0.0, 1.0);
  vec3 sky = mix(hor, zen, 1.0 - exp(-ry * 4.2));
  vec2 dir = R0.xz / max(length(R0.xz), 1e-4);
  float line = 0.09 + 0.12 * wNoise(dir * 4.0 + xz * 0.012) + 0.04 * wNoise(dir * 19.0 + xz * 0.05);
  float tk = (1.0 - smoothstep(line - 0.05, line + 0.03, mix(R0.y, R.y, 0.35))) * 0.85;
  return mix(sky, vec3(0.095, 0.105, 0.045) * min(dot(hor, vec3(0.2126, 0.7152, 0.0722)) * 1.6, 1.4), tk);   // (green-brown, as bright as the sky's horizon allows)
}
`;

/** Animated water: fresnel sky reflection, sun glint, scrolling ripples. aEdge (0 centre..1 bank) darkens near banks. */
export function waterMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: /* glsl */`
attribute float aEdge;
varying vec3 vW;
varying float vEdge;
` + TERRAIN_VS + /* glsl */`
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vEdge = aEdge;
  vec4 mvPosition = viewMatrix * w;
  vec3 gtoDv = GTO_DHW(w.xz);                         // terrain (world/terrain.js): the water rides on its own level field
  mvPosition.xyz += gtoDv;
  vW.y += dot(gtoDv, viewMatrix[1].xyz);              // (and the fragment's view ray is taken from where the water really is: metres below the bank, not at y = 0, or the reflected ray runs too flat and the far bank's dark band spreads over the water)
  mvPosition.xyz *= 1.0 - 4.0 * ${LAYER_BIAS};
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */`
uniform float uTime;
uniform float uNight;
uniform vec3 uSkyZen;
uniform vec3 uSkyHor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform vec4 uWetv;
varying vec3 vW;
varying float vEdge;
#include <fog_pars_fragment>
${GLSL_HASH}
float wH(vec2 p) {
  float t = uTime;
  // pass 5: two octaves instead of three (the finest one aliased into white squares at distance)
  return wNoise(p * 0.42 + vec2(t * 0.07, t * 0.035)) * 0.6 + wNoise(p * 1.3 - vec2(t * 0.11, -t * 0.06)) * 0.4;
}
${WATER_BANK_GLSL}
void main() {
  vec2 p = vW.xz;
  float e = 0.2;
  float h0 = wH(p), hx = wH(p + vec2(e, 0.0)), hz = wH(p + vec2(0.0, e));
  // ripples flatten with distance so far water is a calm mirror of the sky gradient, not noise; and (stone pass,
  // 2026-11) they calm down against a high-contrast sky: at dusk a bright horizon over a dark zenith turned every
  // ripple into a hard orange / dark band
  float dist = length(cameraPosition - vW);
  float amp = 0.24 / (1.0 + dist * 0.02) * mix(1.0, 0.5, wSkyContrast(uSkyHor, uSkyZen));
  vec3 N = normalize(vec3(-(hx - h0) / e * amp, 1.0, -(hz - h0) / e * amp));
  if (uWetv.w > 0.0 && dist < 60.0) {
    // rain on the water: expanding rings, one per cell per cycle (two offset grids), fading with distance
    vec2 rg = vec2(0.0);
    for (int k = 0; k < 2; k++) {
      vec2 gp = p * 1.7 + float(k) * vec2(0.37, 0.61), c = floor(gp), f = fract(gp) - 0.5;
      float hh = wHash12(c + float(k) * 17.0);
      if (hh > uWetv.w) continue;
      float ph = fract(uTime * (0.9 + 0.4 * hh) + hh * 7.0);
      vec2 o = f - (vec2(wHash12(c + 3.1), wHash12(c + 5.7)) - 0.5) * 0.5;
      float r = length(o), w = (r - ph * 0.42) * 30.0;
      rg += o / max(r, 1e-3) * sin(w) * exp(-w * w * 0.08) * (1.0 - ph);
    }
    N = normalize(N + vec3(rg.x, 0.0, rg.y) * 0.35 * (1.0 - dist / 60.0));
  }
  vec3 V = (cameraPosition - vW) / dist;
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  float ry = clamp(R.y, 0.0, 1.0);
  // the sky dome's own gradient, with the far bank's trees and buildings low down (water.js / post.js share wWaterSky)
  vec3 sky = wWaterSky(R, reflect(-V, vec3(0.0, 1.0, 0.0)), vW.xz, uSkyHor, uSkyZen);
  vec3 deep = mix(vec3(0.03, 0.04, 0.02), vec3(0.004, 0.007, 0.014), uNight);
  vec3 bank = mix(vec3(0.035, 0.042, 0.022), vec3(0.006, 0.007, 0.006), uNight);
  float edge = smoothstep(0.45, 1.0, vEdge);
  vec3 col = mix(deep, bank, edge);
  // the bank (stone pass, item 7): metres to the bank from the edge ramp's world-space gradient (rivers, the canal and
  // the lakes' shore bands; open water has no ramp). A dark wet lip where the water meets the bank, and the shadow of
  // the bank on the water a metre or two out, so the water reads as lying below the ground, not as a sheet on it
  float bankM = 1e3;
  {
    vec2 dPx = dFdx(vW.xz), dPy = dFdy(vW.xz), dE = vec2(dFdx(vEdge), dFdy(vEdge));
    float det = dPx.x * dPy.y - dPx.y * dPy.x;
    if (abs(det) > 1e-10 && vEdge > 0.3) {
      vec2 g = vec2(dE.x * dPy.y - dE.y * dPx.y, dE.y * dPx.x - dE.x * dPy.x) / det;
      bankM = (1.0 - vEdge) / max(length(g), 1e-4);
    }
  }
  float under = 1.0 - smoothstep(0.3, 2.2, bankM);
  // overhanging banks and trees darken the reflection towards the edges; the water itself is murky green-brown, so what
  // it mirrors is a little darker and greener than the sky (stone pass: it read as a pale sheet)
  float reflK = fres * 0.82 * (1.0 - 0.6 * edge) * (1.0 - 0.55 * under);     // (also the reflection mask written to alpha: post.js swaps the sky for the scene)
  col = mix(col, sky * vec3(0.86, 0.92, 0.86) * (1.0 - 0.6 * edge), reflK);
  col *= 1.0 - 0.35 * under;
  float lip = 1.0 - smoothstep(0.24, 0.42, bankM);
  col = mix(col, mix(vec3(0.07, 0.064, 0.05), vec3(0.008, 0.008, 0.007), uNight), lip);
  reflK *= 1.0 - lip;
  float sunUp = smoothstep(-0.02, 0.08, uSunDir.y);
  float rs = max(dot(R, uSunDir), 0.0), rs2 = rs * rs, rs8 = rs2 * rs2; rs8 *= rs8;
  float rs64 = rs8 * rs8; rs64 *= rs64; rs64 *= rs64;
  // sun glint: a tight core plus a soft streak broken up by the ripple height (no per-cell hash: that drew squares)
  float sp = (rs64 * rs64 * 5.0 + rs8 * rs8 * smoothstep(0.52, 0.7, h0) * 0.9) * sunUp;
  float mp = pow(max(dot(R, uMoonDir), 0.0), 300.0) * 1.2 * uNight * smoothstep(0.0, 0.1, uMoonDir.y);
  col += uSunColor * sp + vec3(0.7, 0.8, 1.0) * mp;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
#ifdef USE_FOG
  gl_FragColor.a = 2.0 + reflK * (1.0 - fogFactor);
#else
  gl_FragColor.a = 2.0 + reflK;
#endif
}`,
    fog: true,
  });
  m.uniforms.uTime = U.time; m.uniforms.uNight = U.night; m.uniforms.uSkyZen = U.skyZen; m.uniforms.uSkyHor = U.skyHor;
  m.uniforms.uSunDir = U.sunDir; m.uniforms.uSunColor = U.sunColor; m.uniforms.uMoonDir = U.moonDir;
  m.uniforms.gtoHazeDir = { value: HAZE.sunDir }; m.uniforms.gtoHazeCol = { value: HAZE.sunCol }; m.uniforms.gtoFog = { value: HAZE.fog }; m.uniforms.gtoMist = { value: HAZE.mist };
  m.uniforms.uWetv = U.wetv;
  m.name = 'water';
  return m;
}

// ---------------------------------------------------------------- night-following materials
const nightList = [];
/** Make material.emissiveIntensity = base + night * scale every frame. */
export function registerNight(material, scale = 1, base = 0) { nightList.push({ material, scale, base }); return material; }
export function updateNight(night) {
  for (let i = 0; i < nightList.length; i++) { const e = nightList[i]; e.material.emissiveIntensity = e.base + night * e.scale; }
}

// ---------------------------------------------------------------- city materials (built once)
export function createCityMaterials() {
  const facade = T.makeFacadeAtlas(), roof = T.makeRoofAtlas(), ground = T.makeGroundAtlas();
  const M = {};
  // texture pass: which scanned layer lies over which painted cell (world/_surf_detail.js; top tier only)
  const F = T.FACADE_CELLS, G = T.GROUND_CELLS, RO = T.ROOF_OFS, RC = T.ROOF_CELLS;
  const surfF = { '*': null }, surfG = { '*': null };
  const setS = (tab, layer, cells) => { for (const c of cells) tab[c] = layer; };
  setS(surfF, 'stone', [F.stoneRustic, T.PARAPET_CELL, RO + RC.stone]);
  setS(surfF, ['stone', 1, 'ashlar'], T.ASHLAR_SHADER_CELLS.map((k) => F[k]));   // (pass 2: their courses and joints come from the shader, in world space)
  setS(surfF, 'rubble', [F.stoneRubble]);
  setS(surfF, 'brick', [F.brickSash, F.brickDoor, F.brickBlank, F.brickGeorgian, F.brickPoly, F.brickPair, F.villaGable, F.brickStrip]);
  setS(surfF, 'clay', [RO + RC.tile]);
  setS(surfF, 'render', [F.renderSash, F.renderDoor, F.renderBlank, F.renderGeorgian, F.paintFlat, F.timberUp, F.plasterGable]);
  setS(surfF, ['render', 0.5], [F.shopfront, F.shopA, F.shopB, F.shopDoorA, F.pubFront, F.cafeFront, F.awning]);
  setS(surfF, 'concrete', [F.concreteBand, F.concreteBlank]);
  setS(surfF, 'wood', [F.garageDoor, F.signBoard, F.gardenGate]);
  setS(surfF, 'slate', [RO + RC.slate, F.dormerFront]);
  setS(surfF, 'metal', [RO + RC.lead, F.darkMetal]);
  setS(surfF, 'asphalt', [RO + RC.flat]);
  setS(surfF, 'hedge', [T.HEDGE_CELL]);                                          // (pass 2: photo leaves on a clipped hedge)
  setS(surfG, 'asphalt', [G.asphalt, G.parking, G.tarmacKerb, G.carriageway, G.tarmacPath, G.carriagewayB, G.tarmacKerbB]);
  setS(surfG, 'flag', [G.paving, G.pavedKerb, G.pavedKerbB, G.pavingB, G.steps]);
  setS(surfG, 'setts', [G.setts, G.settsB, G.cobbles, G.cobblesB]);
  setS(surfG, 'gravel', [G.gravel]);
  setS(surfG, ['gravel', 0.8], [G.gravelPath]);
  setS(surfG, 'earth', [G.flowerbed, G.sand, G.dirt, G.earthPath]);
  setS(surfG, 'wood', [G.boards]);
  setS(surfG, 'concrete', [G.kerb]);
  // the city material: walls (cells 0-15), roofs (16-19) and parapets (20-21) share ONE 4×6 atlas, so a tile is one draw
  M.facade = atlasMaterial({ map: facade.map, aux: facade.aux, n: 4, ny: T.FACADE_ROWS, wallBias: true, windows: true, litSeed: true, noise: 0.08, noiseFrom: T.ROOF_OFS, noiseTo: T.NEW_WALL_OFS, ao: true, weather: true, weatherFrom2: T.NEW_WALL_OFS, ivy: true, roughness: 0.86, name: 'facade', surf: surfF });
  M.roof = atlasMaterial({ map: roof.map, n: 2, noise: 0.08, roughness: 0.8, name: 'roof', surf: null });   // stand-alone roof atlas (API; the city uses M.facade)
  // ALL ground layers (base, landuse, roads, paths, pavements) are one material: per-vertex aLayer depth bias instead of
  // one polygonOffset material per layer, so a ground tile is one draw
  M.ground = atlasMaterial({ map: ground.map, n: 4, ny: T.GROUND_ROWS, noise: 0, macro: 0.011, layered: true, roughness: 0.95, name: 'ground', surf: surfG });
  for (const k of ['area0', 'area1', 'area2', 'road', 'road2', 'path', 'raised', 'base']) M[k] = M.ground;
  M.markings = addDepthBias(new THREE.MeshStandardMaterial({ map: T.makeMarkings(), alphaTest: 0.5, roughness: 0.7, name: 'markings' }), 9);
  if (TERRAIN_STACK_ON) { M.markings.depthWrite = false; M.markings.defines.GTO_STACK = TERRAIN_STACK; }     // (terrain: a layer of the ground, ordered by drawing)
  const parapet = T.makeParapetTex();
  M.parapet = new THREE.MeshStandardMaterial({ map: parapet, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.9, name: 'parapet' });
  M.fence = new THREE.MeshStandardMaterial({ map: T.makeFenceTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, metalness: 0.1, name: 'fence' });
  const hedge = T.makeHedgeTex();
  M.hedge = new THREE.MeshStandardMaterial({ map: hedge, roughness: 1, name: 'hedge' });
  M.water = waterMaterial();
  M.leaves = addWind(new THREE.MeshStandardMaterial({ map: T.makeLeafTex(), roughness: 0.95, name: 'leaves' }), 0.018, 'wLeaves');
  M.leavesFar = new THREE.MeshStandardMaterial({ map: M.leaves.map, roughness: 1, name: 'leavesFar' });
  M.bark = new THREE.MeshStandardMaterial({ map: T.makeBarkTex(), roughness: 1, name: 'bark' });
  M.furniture = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25, name: 'furniture' });
  M.lampGlass = registerNight(new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc77a, emissiveIntensity: 0, roughness: 0.3, name: 'lampGlass' }), 4.0, 0);
  // contact-shadow strips on the ground round building footprints (multiply: white = no change)
  // (roughness pass: the same batch also draws the street grime decals of world/rough.js from one multiply texture.
  // A decal is told from a contact-shadow strip by its vertex colour — red = 2, green = its strength — so no existing
  // strip geometry (the city's, Worcester's) changes; decals fade out before the batch's 160 m cull instead of popping.)
  const aoBase = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, toneMapped: false, fog: false, name: 'aoStrip' });
  if (T.ROUGH) {
    const grime = { value: grimeTexture() };
    aoBase.onBeforeCompile = (sh) => {
      sh.uniforms.grimeMap = grime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGrime;').replace('#include <project_vertex>', '#include <project_vertex>\n\tvGrime = vec3(uv, -mvPosition.z);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D grimeMap;\nvarying vec3 vGrime;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n\t{ vec3 gT = texture2D(grimeMap, vGrime.xy).rgb; float gK = step(1.5, vColor.r); diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(1.0), gT, vColor.g * (1.0 - smoothstep(95.0, 150.0, vGrime.z))), gK); }');
    };
    aoBase.customProgramCacheKey = () => 'grime';
  }
  M.aoStrip = addDepthBias(aoBase, 10);
  M.glowTex = T.makeGlowTex();
  M.pool = addDepthBias(new THREE.MeshBasicMaterial({ map: M.glowTex, color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, name: 'lampPool' }), 11);
  M.halo = new THREE.MeshBasicMaterial({ map: M.glowTex, color: 0xffc078, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, name: 'lampHalo' });
  M.textures = { facade, roof, ground, parapet, hedge };
  return M;
}

// ---------------------------------------------------------------- public simple materials (lazy), UVs in metres
/**
 * world.mats.* — MeshStandardMaterials whose textures repeat at a sensible real-world scale when the geometry has
 * UVs in metres (all world helpers and interiorKit produce metric UVs).
 */
export function createPublicMaterials(city) {
  const mats = {};
  const lazy = (name, f) => Object.defineProperty(mats, name, { get() { const v = f(); Object.defineProperty(mats, name, { value: v, enumerable: true }); return v; }, enumerable: true, configurable: true });
  const metric = (tex, scale) => { const t = tex.clone(); t.repeat.set(1 / scale, 1 / scale); t.needsUpdate = true; return t; };
  // (texture pass: `surf` names the scanned layer laid over the painted map on the top tier — a no-op otherwise)
  const std = (tex, scale, { surf, ...extra } = {}) => { const m = new THREE.MeshStandardMaterial({ map: metric(tex, scale ?? tex.userData.scale ?? 1), roughness: 0.9, ...extra }); return surf ? addSurfDetail(m, surf) : m; };
  lazy('stone', () => std(T.stoneTexture(), 3.2, { surf: 'stone' }));
  lazy('brick', () => std(T.brickTexture(), 2.6, { surf: 'brick' }));
  lazy('render', () => std(T.plasterTexture([236, 230, 218]), 2.5, { surf: 'render' }));
  lazy('plaster', () => std(T.plasterTexture(), 2, { surf: 'plaster' }));
  lazy('slate', () => std(T.roofTexture('slate'), 2, { roughness: 0.75, surf: 'slate' }));
  lazy('tile', () => std(T.roofTexture('tile'), 1.6, { surf: 'clay' }));
  lazy('lead', () => std(T.roofTexture('lead'), 2.6, { roughness: 0.6, metalness: 0.2, surf: 'metal' }));
  lazy('grass', () => std(T.groundTexture('grass'), 4, { roughness: 1 }));
  lazy('lawnStriped', () => std(T.groundTexture('lawn'), 3.2, { roughness: 1 }));   // 0.53 m mower stripes (six to a repeat)
  lazy('meadow', () => std(T.groundTexture('meadow'), 5, { roughness: 1 }));
  lazy('gravel', () => std(T.groundTexture('gravel'), 3, { roughness: 1, surf: 'gravel' }));
  lazy('paving', () => std(T.groundTexture('paving'), 3.6, { surf: 'flag' }));
  lazy('setts', () => std(T.groundTexture('setts'), 2.4, { surf: 'setts' }));
  lazy('cobbles', () => std(T.groundTexture('cobbles'), 2, { surf: 'setts' }));
  lazy('asphalt', () => std(T.groundTexture('asphalt'), 5, { surf: 'asphalt' }));
  lazy('flowerbed', () => std(T.groundTexture('flowerbed'), 3, { surf: 'earth' }));
  lazy('soil', () => std(T.groundTexture('dirt'), 4, { surf: 'earth' }));
  lazy('wood', () => std(T.woodFloorTexture(), 2, { roughness: 0.7, surf: 'boards' }));
  lazy('darkWood', () => std(T.woodFloorTexture([70, 44, 26]), 2, { roughness: 0.6, surf: 'boards' }));
  lazy('panelling', () => std(T.panellingTexture(), 1.2, { roughness: 0.6, surf: 'wood' }));
  lazy('carpet', () => std(T.carpetTexture(), 1.5, { roughness: 1, surf: 'carpet' }));
  lazy('floorTiles', () => std(T.tileTexture(), 2, { roughness: 0.4 }));
  lazy('books', () => std(T.bookTexture(), 2));
  lazy('glass', () => new THREE.MeshStandardMaterial({ color: 0x2a3848, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.55 }));
  lazy('iron', () => new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.45, metalness: 0.6 }));
  lazy('brass', () => new THREE.MeshStandardMaterial({ color: 0xb89040, roughness: 0.35, metalness: 0.9 }));
  lazy('redPaint', () => new THREE.MeshStandardMaterial({ color: 0xb01010, roughness: 0.4 }));
  lazy('whitePaint', () => new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.5 }));
  lazy('blackPaint', () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
  lazy('hedge', () => new THREE.MeshStandardMaterial({ map: city.textures.hedge, roughness: 1 }));
  lazy('water', () => city.water);
  lazy('leaves', () => city.leaves);
  lazy('bark', () => city.bark);
  lazy('lampGlass', () => city.lampGlass);
  // atlas materials used by the city itself (use world.makeBuilding / world.buf for the right attributes)
  lazy('facade', () => city.facade);
  lazy('roofAtlas', () => city.roof);
  return mats;
}
