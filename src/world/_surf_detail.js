// Surface fidelity (texture pass, 2026-11): the top tier's high-resolution surfaces.
//
// What was wrong: every surface in the game is a small painted canvas (a facade bay 512 px over ~3 m, a ground cell
// 256 px over 2.4-5 m, an interior wall 256 px over 2 m) magnified 3-8x at walking distance, with nothing finer than a
// texel in it. What this adds, on the top tier only (TIERS.ultra.surfaces = 'hi'; `?surf=0` off; `?surf=1` loads the set whatever the tier, the per-pixel work still follows the tier):
//   - a WebGL2 texture ARRAY of photo-scanned materials (CC0, docs/TEXTURE_CREDITS.md; public/textures/surf/, built by
//     tools/surf_build.py): 1024 px layers with full mip chains and 16x anisotropy, mapped in WORLD space at real size
//     (walls: along the wall and up; ground: x, z; roofs: across and up the slope), so nothing stretches with a bay's
//     width and nothing bleeds between cells. Each layer is an albedo MULTIPLIER (mean exactly 1: the painted world keeps
//     its own colours, and a mip-mapped layer fades to "no change" by itself, so near and far always agree), a normal map
//     and a roughness offset. Two kinds: 'detail' layers (stone face, fired clay, render, tarmac ...) are grain laid over
//     the painted surface, whose courses, joints and windows stay where they are; 'full' layers (coursed rubble, granite
//     setts, gravel) replace the painted picture near the camera (it fades back in by 70 m) with the scan, tinted to
//     the painted cell's mean colour; the 'field' layer (red stock brick at its real 215 x 65 mm) does the same for the
//     brickwork of a facade bay only, leaving its painted windows, doors and stone dressings.
//   - the atlas shader's side of it (materials.js includes SURF_* below): one table lookup per pixel (cell -> layer,
//     scale, strengths), two array fetches near the camera, one beyond 60 m.
//   - addSurfDetail(material, layer): the same for a plain MeshStandardMaterial (the public world.mats.*, interiors),
//     mapped in the object's own space scaled to metres, so a door that swings or a lift that rises carries its grain.
//   - crispCanvasTexture(canvas): for signs, notices and painted text made by other modules — sRGB, full mip chain,
//     trilinear, the GPU's maximum anisotropy; hiScale() says how much larger to paint the canvas on this tier.
// The layers are fetched and uploaded during world build (the loading screen), never later. Memory (uncompressed fallback): 20 layers x 1024² x
// (RGBA8 + RG8) with mips = 160 MB of GPU memory; 22 MB of downloads.
import * as THREE from 'three';
import { compressSupport, chain, compressedArray, FMT, finishCompressed } from './_surf_compress.js';
import { loadCompressed, storeCompressed } from './_surf_cache.js';

export const SURF = {
  wanted: false,        // decided once at boot (surfWanted): the high-resolution set is loaded and the atlases painted larger
  on: false,            // the layers are loaded (materials built after this carry the USE_SURF code)
  maxAniso: 4,          // the GPU's maximum anisotropy (16 on anything recent), for crispCanvasTexture
  index: {},            // layer name -> index
  layers: [],           // manifest rows
  texD: null, texN: null,
  leaves: null,         // the photo leaf sprite sheet (a canvas: 6 rows x 6 leaves of 96 x 64 px; tools/surf_leaves.py) or null
  /** 0 / 1: the tier switch (world/index.js applyQuality) — one uniform shared by every material that carries the code */
  uK: { value: 0 },
  uD: { value: null }, uN: { value: null },
};
const BASE = new URL('../../textures/surf/', import.meta.url);

/** how much larger than its usual size to paint a canvas texture on this tier (1 or 2) */
export const hiScale = () => (SURF.wanted ? 2 : 1);

function param(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } }

/**
 * Is the high-resolution set wanted for this session? Decided ONCE, before the world is built, because atlas sizes and
 * the loaded layers cannot change mid-game: yes when the graphics ceiling is the top tier — `?q=ultra`, a saved manual
 * 'ultra', or 'auto' on a GPU that starts on 'high' (auto may climb to ultra; below it the per-pixel work is switched
 * off by SURF.uK). `?surf=0` / `?surf=1` override. Needs WebGL2 and 16k textures.
 */
export function surfWanted(game, guess) {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function' || typeof fetch !== 'function') return false;
  const R = game && game.renderer, caps = R && R.capabilities;
  if (!caps || !caps.isWebGL2 || !R.getContext || (caps.maxTextureSize || 0) < 16384) return false;
  const s = param('surf');
  if (s === '0') return false;
  if (s === '1') return true;
  const q = param('q');
  if (q) return q === 'ultra';
  let saved = null; try { saved = localStorage.getItem('gto-quality'); } catch (e) { /* */ }
  if (saved && saved !== 'auto') return saved === 'ultra';
  return guess === 'high';      // 'auto' on a capable GPU: it may climb to ultra, and must find the set there
}

async function grab(file, w, h) {
  const r = await fetch(new URL(file, BASE)); if (!r.ok) throw new Error(file + ' ' + r.status);
  const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  return g.getImageData(0, 0, w, h).data;
}

/**
 * Load the layers (world build, i.e. the loading screen). Resolves true when the array textures exist and are uploaded.
 * Any failure (a missing file, no WebGL2) leaves SURF.on false and the game exactly as it is without the pass.
 */
export async function initSurfaces(game, guess) {
  const R = game && game.renderer;
  try { SURF.maxAniso = Math.max(1, Math.min(16, R.capabilities.getMaxAnisotropy())); } catch (e) { SURF.maxAniso = 4; }
  SURF.wanted = surfWanted(game, guess);
  if (!SURF.wanted) return false;
  try {
    const t0 = performance.now();
    const man = await (await fetch(new URL('manifest.json', BASE))).json();
    const S = man.size, n = man.layers.length, px = S * S;
    // pass 3 (memory): where the GPU takes block formats the layers are compressed here, one at a time — the colour
    // multiplier with the roughness in its alpha as DXT5, the normal's x, y as RGTC2 (BC5): 2 bytes a pixel in all
    // where RGBA8 + RG8 took 6 — and no full-size pixel array outlives its layer
    const cs = compressSupport(R), packD = cs.dxt, packN = cs.rgtc;
    // start-up (pass 4): both arrays as they were compressed on an earlier visit (world/_surf_cache.js) — then no layer
    // file is fetched, decoded or encoded at all
    // ...and first of all (pass 4): the arrays as tools/surf_pack.mjs wrote them, already block-compressed with every
    // mip — two files, no decoding or encoding on any visit (the .webp layers are then never fetched)
    let packed = false;
    if (packD && packN && man.packed && man.packed.layers === n) {
      try {
        const load = async (P) => {
          const r = await fetch(new URL(P.file, BASE)); if (!r.ok) throw new Error(P.file + ' ' + r.status);
          const buf = new Uint8Array(await r.arrayBuffer()); let o = 0;
          const mips = P.levels.map(([width, height, one]) => { const data = buf.subarray(o, o + one * n); o += one * n; return { data, width, height }; });
          if (o !== buf.length) throw new Error(P.file + ' size');
          return finishCompressed(new THREE.CompressedArrayTexture(mips, S, S, n, FMT[P.kind]), { anisotropy: SURF.maxAniso });
        };
        const [tD, tN] = await Promise.all([load(man.packed.d), load(man.packed.n)]);
        SURF.texD = tD; SURF.texN = tN; packed = true;
      } catch (e) { console.warn('[surf] packed layers not used:', e && e.message); packed = false; }
    }
    const got0 = !packed && packD && packN ? await Promise.all([loadCompressed('layersD'), loadCompressed('layersN')]) : [null, null];
    const cached = packed || !!(got0[0] && got0[1] && got0[0].texture.image.depth === n && got0[1].texture.image.depth === n);
    if (packed) { /* done */ }
    else if (cached) { SURF.texD = got0[0].texture; SURF.texN = got0[1].texture; }
    else {
    const A = packD ? null : new Uint8Array(px * 4 * n), B = packN ? null : new Uint8Array(px * 2 * n), chD = [], chN = [];
    for (let i0 = 0; i0 < n; i0 += 4) {
      const got = await Promise.all(man.layers.slice(i0, i0 + 4).map((L) => Promise.all([grab(L.name + '_d.webp', S, S), grab(L.name + '_n.webp', S * 3, S)])));
      got.forEach(([d, m], k) => {
        const i = i0 + k, a = packD ? new Uint8Array(px * 4) : A.subarray(i * px * 4, (i + 1) * px * 4), b = packN ? null : B.subarray(i * px * 2, (i + 1) * px * 2), nn = packN ? new Uint8Array(px * 4) : null;
        a.set(d);
        for (let y = 0; y < S; y++) {
          const row = y * S * 3 * 4;
          for (let x = 0; x < S; x++) {
            const p = y * S + x, nx = m[row + x * 4], ny = m[row + (x + S) * 4];
            if (nn) { nn[p * 4] = nx; nn[p * 4 + 1] = ny; } else { b[p * 2] = nx; b[p * 2 + 1] = ny; }
            a[p * 4 + 3] = m[row + (x + 2 * S) * 4];                         // roughness offset
          }
        }
        if (packD) chD.push(chain(a, S, S, 'dxt5', false));
        if (packN) chN.push(chain(nn, S, S, 'rgtc2', false));
      });
    }
    const mk = (data, format) => {
      const t = new THREE.DataArrayTexture(data, S, S, n);
      t.format = format; t.type = THREE.UnsignedByteType; t.colorSpace = THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
      t.anisotropy = SURF.maxAniso; t.unpackAlignment = 1; t.needsUpdate = true;
      t.userData.gpuBytes = Math.round(data.length * 4 / 3);
      t.onUpdate = () => { if (t.image) t.image.data = null; t.onUpdate = null; };      // (the pixels are needed once)
      return t;
    };
    SURF.texD = packD ? compressedArray(chD, 'dxt5', { anisotropy: SURF.maxAniso }) : mk(A, THREE.RGBAFormat);
    SURF.texN = packN ? compressedArray(chN, 'rgtc2', { anisotropy: SURF.maxAniso }) : mk(B, THREE.RGFormat);
    if (packD && packN) { storeCompressed('layersD', SURF.texD); storeCompressed('layersN', SURF.texN); }
    }
    SURF.cached = cached; SURF.packed = packed;
    SURF.texD.name = 'surf-detail'; SURF.texN.name = 'surf-normal';
    if (R.initTexture) { R.initTexture(SURF.texD); R.initTexture(SURF.texN); }      // upload now, not at the first frame that shows it
    SURF.uD.value = SURF.texD; SURF.uN.value = SURF.texN;
    SURF.layers = man.layers; SURF.index = {};
    try {      // photo leaves for the tree atlas painter (world/textures.js); without them it paints its own
      const r = await fetch(new URL('leaves.webp', BASE));
      if (r.ok) { const bmp = await createImageBitmap(await r.blob(), { premultiplyAlpha: 'none' }); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); SURF.leaves = c; }
    } catch (e) { SURF.leaves = null; }
    man.layers.forEach((L, i) => { SURF.index[L.name] = i; });
    SURF.on = true;
    SURF.bytes = (SURF.texD.userData.gpuBytes || 0) + (SURF.texN.userData.gpuBytes || 0);
    console.log(`[surf] ${n} layers, ${S} px, ${(SURF.bytes / 1048576).toFixed(0)} MB on the GPU, loaded in ${Math.round(performance.now() - t0)} ms`);
  } catch (e) {
    console.warn('[surf] high-resolution surfaces not loaded:', e && e.message);
    SURF.on = false; SURF.wanted = false;
  }
  return SURF.on;
}

/** the tier switch (0 off .. 1 on): no recompile, the code is skipped by a uniform */
export function setSurfaces(on) { SURF.uK.value = on && SURF.on ? 1 : 0; }

/**
 * Per-cell table for an atlas material: Float32Array of vec4 per cell — x layer (-1: none), y repeats per metre,
 * z albedo strength (NEGATIVE: a 'full' layer, the scan replaces the painted picture near the camera), w normal strength.
 * y NEGATIVE as well: a 'field' layer — the scan replaces only the brick-coloured texels of the painted bay (its windows,
 * doors, sills and arches stay painted), tinted by the painted brickwork's own local colour.
 * w NEGATIVE (spec ['stone', 1, 'ashlar']): the shader also draws ashlar courses and joints in world space on the cell's stone.
 * spec: { cellIndex: 'layer' | ['layer', strength] } and/or a default for every other cell ('*').
 */
export function surfTable(spec, cells = 64) {
  const t = new Float32Array(64 * 4);
  for (let i = 0; i < 64; i++) t[i * 4] = -1;
  if (!SURF.on || !spec) return t;
  const put = (i, v) => {
    if (!v) return;
    const [name, k = 1, flag] = Array.isArray(v) ? v : [v], li = SURF.index[name]; if (li === undefined) return;
    const L = SURF.layers[li];
    t[i * 4] = li; t[i * 4 + 1] = (L.mode === 'field' ? -1 : 1) / L.metres; t[i * 4 + 2] = L.albedo * k * (L.mode === 'detail' ? 1 : -1); t[i * 4 + 3] = L.normal * k * (flag === 'ashlar' ? -1 : 1);
  };
  for (let i = 0; i < Math.min(64, cells); i++) put(i, spec[i] !== undefined ? spec[i] : spec['*']);
  return t;
}

// ---------------------------------------------------------------- GLSL shared by the atlas shader and addSurfDetail
export const SURF_PARS = /* glsl */`
#ifdef USE_SURF
uniform sampler2DArray surfD;
uniform sampler2DArray surfN;
uniform float uSurfK;
#endif
`;
/** the tangent frame of the detail coordinates from screen derivatives (three's getTangentFrame with the gradients given) */
export const SURF_NORMAL = /* glsl */`
#ifdef USE_SURF
	if (sKn > 0.0) {
		vec3 sQ0 = dFdx(-vViewPosition), sQ1 = dFdy(-vViewPosition);
		vec3 sQ1p = cross(sQ1, normal), sQ0p = cross(normal, sQ0);
		vec3 sTt = sQ1p * sGx.x + sQ0p * sGy.x, sBt = sQ1p * sGx.y + sQ0p * sGy.y;
		float sDet = max(dot(sTt, sTt), dot(sBt, sBt));
		if (sDet > 0.0) {
			float sSc = inversesqrt(sDet);
			normal = normalize(normal + (sTt * sNxy.x + sBt * sNxy.y) * sSc * sKn);
		}
	}
#endif
`;

/**
 * Photo-scanned grain on a plain MeshStandardMaterial (the public world.mats.*, interior walls and floors). Mapped in
 * the object's own space scaled to metres (the model matrix's scale), by the face's dominant axis — a swinging door
 * or a rising lift carries its grain with it. opts.scale multiplies the layer's real size; opts.k its strength.
 * A no-op (the material is returned untouched) unless the high-resolution set is loaded.
 */
export function addSurfDetail(m, layer, opts = {}) {
  const li = SURF.index[layer];
  if (!SURF.on || li === undefined || !m || !m.isMeshStandardMaterial || m.userData.surf) return m;
  const L = SURF.layers[li], k = opts.k ?? 1, full = L.mode !== 'detail' && !!m.map && opts.full !== false;
  const uL = { value: new THREE.Vector4(li, 1 / (L.metres * (opts.scale || 1)), L.albedo * k * (full ? -1 : 1), L.normal * k) };
  m.userData.surf = layer;
  m.defines = m.defines || {}; m.defines.USE_SURF = '';
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.surfD = SURF.uD; sh.uniforms.surfN = SURF.uN; sh.uniforms.uSurfK = SURF.uK; sh.uniforms.uSurfL = uL;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurfP;\nvarying vec3 vSurfN;')
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
	{
		vec3 sSc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
	#ifdef USE_INSTANCING
		sSc *= vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
	#endif
		vSurfP = position * sSc;
	#ifdef FLAT_SHADED
		vSurfN = vec3(0.0, 1.0, 0.0);
	#else
		vSurfN = normal;
	#endif
	}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SURF_PARS + 'uniform vec4 uSurfL;\nvarying vec3 vSurfP;\nvarying vec3 vSurfN;')
      .replace('#include <map_fragment>', /* glsl */`
	float sKn = 0.0, sRo = 0.0; vec2 sNxy = vec2(0.0), sGx = vec2(0.0), sGy = vec2(0.0);
	vec4 sD = vec4(0.5);
	if (uSurfK > 0.0) {
		vec3 sA = cross(dFdx(vSurfP), dFdy(vSurfP));    // the face's own normal (object space, metres): vertex normals can lie
		sA = dot(sA, sA) > 1e-20 ? abs(sA) : abs(vSurfN);
		vec2 sUv = sA.y >= sA.x && sA.y >= sA.z ? vSurfP.xz : sA.x >= sA.z ? vSurfP.zy : vSurfP.xy;
		sUv *= uSurfL.y; sGx = dFdx(sUv); sGy = dFdy(sUv);
		sD = textureGrad(surfD, vec3(sUv, uSurfL.x), sGx, sGy);
		sRo = (sD.a - 0.5) * abs(uSurfL.z);
		sKn = uSurfL.w * (1.0 - smoothstep(25.0, 60.0, length(vViewPosition)));
		if (sKn > 0.0) sNxy = textureGrad(surfN, vec3(sUv, uSurfL.x), sGx, sGy).rg * 2.0 - 1.0;
	}
#ifdef USE_MAP
	{
		vec4 sampledDiffuseColor = texture2D(map, vMapUv);
		// a 'full' layer: the painted picture gives only its mean colour near the camera (the scan has the joints)
		if (uSurfL.z < 0.0 && uSurfK > 0.0) sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, texture2D(map, vMapUv, 16.0).rgb, 1.0 - smoothstep(30.0, 70.0, length(vViewPosition)));
		diffuseColor *= sampledDiffuseColor;
	}
#endif
	diffuseColor.rgb *= mix(vec3(1.0), sD.rgb * 2.0, abs(uSurfL.z) * uSurfK);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = clamp(roughnessFactor + sRo * 0.6, 0.04, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + SURF_NORMAL);
  };
  m.customProgramCacheKey = () => prevKey() + 'surfD' + (full ? 'f' : '');
  m.needsUpdate = true;
  return m;
}

/**
 * A canvas as a texture that stays sharp: sRGB (so the mips are averaged in linear light and do not darken), a full
 * mip chain, trilinear filtering, the GPU's maximum anisotropy (16x), clamped unless opts.repeat. For signs, fascias,
 * notices, menus, posters — anything with lettering. Paint the canvas hiScale() times larger on the top tier
 * (e.g. `const k = hiScale(); canvas.width = 512 * k; g.scale(k, k);`): at 1 the picture is as before.
 */
export function crispCanvasTexture(canvas, opts = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = opts.anisotropy ?? SURF.maxAniso;
  t.needsUpdate = true;
  return t;
}

/**
 * Give every texture already on the materials under `root` proper filtering (a scene or a room built by a module that
 * made bare CanvasTextures: anisotropy 1, the default): the GPU's maximum anisotropy, and trilinear mips where the
 * texture has mips but was left on a non-mipmapped minification filter by default. NEAREST textures are left alone
 * (pixel art on purpose), as are render targets, data and video textures. Returns how many were changed. Cheap enough
 * to call once per scene, best before its first frame (a texture already on the GPU is uploaded again).
 */
const MAP_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'bumpMap'];
export function sharpenTextures(root, aniso = SURF.maxAniso) {
  let n = 0; const seen = new Set();
  if (!root || !root.traverse) return 0;
  root.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) {
      if (!m || seen.has(m)) continue; seen.add(m);
      for (const k of MAP_KEYS) {
        const t = m[k];
        if (!t || !t.isTexture || seen.has(t) || t.isRenderTargetTexture || t.isVideoTexture || t.isDataTexture || t.isCompressedTexture) continue;
        seen.add(t);
        if (t.magFilter === THREE.NearestFilter || t.minFilter === THREE.NearestFilter) continue;
        if (t.anisotropy < aniso) { t.anisotropy = aniso; t.needsUpdate = true; n++; }
      }
    }
  });
  return n;
}

/**
 * Rooms (texture pass): scanned grain on the big plain surfaces of an interior scene built by a place module — its
 * walls, ceilings and floors are mostly flat-coloured MeshStandardMaterials, which is what reads as low fidelity
 * indoors. Run once per room right after its module's build (world/index.js wraps Interiors._buildA), before its first
 * frame. Only a mesh at least 1.8 m in two directions qualifies, and only an opaque, non-emissive, non-metallic
 * standard material with no shader patch of its own and no picture on it (a clamped map is a picture: a notice, a
 * painting, a screen; a repeating map is a surface). Floors (flat, wide) take the flagstone grain, or floor boards when
 * the material is brown; walls and ceilings smooth plaster; brown or dark things that are not floors (furniture,
 * joinery) are left alone. A material shared with small props carries the grain there too.
 * Opt out: material.userData.surf = false, or mesh.userData.noSurf = true. Returns the number of materials changed.
 */
const _box = new THREE.Box3(), _sz = new THREE.Vector3(), _sc = new THREE.Vector3();
export function autoDetail(root) {
  if (!SURF.on || !root || !root.traverse) return 0;
  let n = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.noSurf || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position || !o.geometry.attributes.normal) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (!ms.some((m) => m && m.isMeshStandardMaterial && m.userData.surf === undefined)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _box.copy(o.geometry.boundingBox).getSize(_sz); _sc.setFromMatrixScale(o.matrixWorld); _sz.multiply(_sc);
    const big = (_sz.x >= 1.8) + (_sz.y >= 1.8) + (_sz.z >= 1.8);
    if (big < 2 && !o.isInstancedMesh) return;
    if (o.isInstancedMesh && big < 2) return;
    const floor = _sz.y < 0.6 && _sz.x >= 1.8 && _sz.z >= 1.8;
    for (const m of ms) {
      if (!m || !m.isMeshStandardMaterial || m.userData.surf !== undefined) continue;
      const pic = m.map && (m.map.wrapS !== THREE.RepeatWrapping || m.map.wrapT !== THREE.RepeatWrapping);
      const glow = m.emissiveMap || (m.emissive && m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.02);
      if (m.transparent || m.opacity < 1 || m.alphaTest > 0 || pic || glow || m.metalness > 0.5 || m.normalMap || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || m.vertexColors || m.isMeshPhysicalMaterial) { m.userData.surf = m.userData.surf ?? null; continue; }
      // (brown and dark things that are not floors are furniture, joinery, cardboard: left alone — the same material is
      // on a big panel and on a parcel, and oak grain on a parcel is worse than none)
      const c = m.color, brown = c.r > c.b * 1.6 && c.r > c.g * 1.15 && (c.r + c.g + c.b) < 1.5, dark = (c.r + c.g + c.b) < 0.25;
      if (!floor && (brown || dark)) { m.userData.surf = null; continue; }
      addSurfDetail(m, floor ? (brown ? 'boards' : 'flag') : 'plaster', { k: floor ? (brown ? 0.6 : 0.8) : 1 });
      if (m.userData.surf) n++;
    }
  });
  return n;
}

/**
 * For a module's own canvas helper (pass 2): how much larger to make a w x h canvas on this tier — hiScale() while the
 * enlarged canvas stays within 2048 x 2048 pixels in area (a big wall painting is already dense, and four times its
 * memory is not worth it), else 1. Use: `const k = canvasScale(w, h); c.width = w * k; c.height = h * k; g.scale(k, k);`
 */
export function canvasScale(w, h) { const k = hiScale(); return k > 1 && w * h * k * k <= 2048 * 2048 ? k : 1; }
/** anisotropy for a module's own texture helper: the GPU's maximum on the top tier, else what the module used before */
export function hiAniso(base = 4) { return SURF.wanted ? SURF.maxAniso : base; }

/**
 * The cell -> layer table spec for a hand-built kit's atlas, from its list of cell NAMES (pass 2): slate, lead,
 * flags, cobbles, boards and brick cells get their own material instead of the dressed-stone default; 'plain' (a flat
 * cell tinted to anything: lead, bark, oak, gold), foliage, signs and glazing get none. Unknown names keep the default
 * (stone, except on greenery). Pass the result as `surf` to world.atlasMaterial.
 */
const KIT_LAYERS = { rubble: 'rubble', brick: 'brick', redBrick: 'brick', poly: 'brick', lead: 'metal', slate: 'slate', stoneSlate: ['stone', 0.7],
  flags: 'flag', flagset: 'flag', cobbles: 'setts', boards: 'wood', plain: null, foliage: null, signs: null, glazed: null, track: null };
export function kitSurf(names) {
  const spec = { '*': 'stone', auto: true };
  (names || []).forEach((n, i) => { if (n in KIT_LAYERS) spec[i] = KIT_LAYERS[n]; });
  return spec;
}
