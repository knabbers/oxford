// Grass (shader pass 10; tier field `grassFx`, ?grassfx=0): real blades round the camera and a sward that reads as
// grass beyond them.
//
//   blades  ~66 000 single-triangle blades in clumps of three, ONE draw, no CPU per frame: the clumps are scattered
//           over a 22 m tile that wraps round the camera in the vertex shader (a blade keeps its place in the world),
//           and what grows where comes from a small top-down picture of the ground round the camera (512² over 128 m,
//           redrawn every 20 m walked: the ground tiles' own atlas cell says lawn / park grass / meadow / woodland
//           floor, and anything standing or lying over it — a path, a pavement, water, a building — says none).
//           Lawns: a close 4 cm sward seen only within a few metres; park grass: 10 cm, uneven; meadows: knee-high
//           tussocks with bleached tips. Dark at the root, light at the tip (the depth of the sward), the tips lit
//           through when you look towards a low sun, bending with the weather's wind in gusts that travel across
//           the field. Blades widen with distance so they never go sub-pixel, and sink into the ground over the last
//           third of their range: there is no ring.
//   sward   the ground material's grass cells (patched here, define FX_GRASS): fine blade grain in the colour near by
//           (faded before it could alias), patches of clover and of dry worn turf on park grass and meadows (not on
//           the mown lawns), and the same low-sun light through the sward as the blades, so the two meet.
// Lit as the ground is (MeshLambertMaterial with up normals: sun and its shadows, cloud shadows, sky light, lamps, fog).
import * as THREE from 'three';
import { U, GLSL_HASH } from './materials.js';

const S = 22, CLUMPS = 22000, MSIZE = 512, MEXT = 128, MMOVE = 20, L_GROUND = 8, L_BUILD = 7, L_WATER = 9;

const MASK_VS = /* glsl */`
attribute vec4 aCell;
attribute float aLayer;
uniform float uNone;
varying float vK;
void main() {
	vec4 wp = modelMatrix * vec4(position, 1.0);
	float c = floor(aCell.x + 0.5);
	// r: 0 none, 0.25 park grass, 0.5 lawn, 0.75 meadow, 1 woodland floor. Only ground that lies AT the ground's level
	// grows blades (they are planted at y 0): a tile raised or sunk more than 0.2 m says none
	vK = abs(wp.y) > 0.2 || uNone > 0.5 ? 0.0 : c == 4.0 ? 0.25 : c == 5.0 ? 0.5 : c == 6.0 ? 0.75 : c == 7.0 ? 1.0 : 0.0;
	// (the ground's layers lie in one plane, ordered by aLayer: paths and roads over the grass they cross)
	wp.y += aLayer * 0.02;
	gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const MASK_FS = /* glsl */`varying float vK; void main() { gl_FragColor = vec4(vK, vK > 0.1 ? 1.0 : 0.0, 0.0, 1.0); }`;

// anything else lying low over the ground (a place module's own gravel walk, a terrace, steps, a slab): none there
const OVER_VS = /* glsl */`
#include <common>
#include <batching_pars_vertex>
varying vec2 vO;
void main() {
	#include <batching_vertex>
	vec4 wp = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_BATCHING
	wp = batchingMatrix * wp; n = mat3(batchingMatrix) * n;
#endif
#ifdef USE_INSTANCING
	wp = instanceMatrix * wp; n = mat3(instanceMatrix) * n;
#endif
	wp = modelMatrix * wp;
	vO = vec2(wp.y, normalize(mat3(modelMatrix) * n).y);
	gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const OVER_FS = /* glsl */`varying vec2 vO; void main() { if (vO.x < 0.004 || vO.x > 0.3 || vO.y < 0.7) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`;
const ROOMVIEW = /^(punch|impostor|doorProxies)/;      // core/_roomview.js quads and door leaves: their render hooks expect their own material
const NOHOOK = THREE.Object3D.prototype.onBeforeRender;
const SKIP = new Set(['world:tufts', 'world:blobs', 'world:fxContact', 'world:fxGrass', 'world:sky', 'character']);

/** the ground material's grass cells: grain, patches, light through the sward (define FX_GRASS) */
function patchGround(m) {
  if (m.userData.fxGrassPatched) return true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  const anchor = 'diffuseColor.rgb *= wTex.rgb * wTintC;';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    if (!sh.fragmentShader.includes(anchor)) { console.warn('[fx grass] ground shader anchor not found: sward detail off'); return; }
    sh.uniforms.uFxSun = U.sunDir;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n#ifdef FX_GRASS\nuniform vec3 uFxSun;\n#endif').replace(anchor, anchor + /* glsl */`
#ifdef FX_GRASS
	if (wCellIdx > 3.5 && wCellIdx < 7.5 && normalize(vWNor).y > 0.7) {
		vec3 gV = vWPos - cameraPosition; float gD = length(gV);
		// (the painted grass is a purer green than turf under an English sky: a fifth of the colour out, as the blades)
		diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1))), diffuseColor.rgb, 0.8) * (abs(wCellIdx - 5.0) > 0.5 ? 0.93 : 1.0);
		// blade grain: two stretched noises crossed; faded before a pixel is wider than a blade's shadow
		float gA = (1.0 - smoothstep(0.012, 0.04, fwidth(vWPos.x) + fwidth(vWPos.z))) ;
		if (gA > 0.0) {
			float gB = wNoise(vWPos.xz * vec2(43.0, 27.0)) * wNoise(vWPos.zx * vec2(51.0, 23.0) + 7.0);
			diffuseColor.rgb *= 1.0 + (gB * 2.4 - 0.6) * 0.5 * gA;
		}
		if (abs(wCellIdx - 5.0) > 0.5) {
			float gF = 1.0 - smoothstep(60.0, 160.0, gD);
			float gP = wNoise(vWPos.xz * 0.31 + 11.0) * 0.7 + wNoise(vWPos.xz * 1.7 + 3.0) * 0.3;
			diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.42, 1.22, 0.74), smoothstep(0.6, 0.78, gP) * 0.5 * gF);
			float gC = wNoise(vWPos.xz * 0.83 + 31.0) * 0.75 + wNoise(vWPos.xz * 4.1) * 0.25;
			diffuseColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.93, 0.78), smoothstep(0.66, 0.74, gC) * gF);
		}
		// low sun: looking towards it the light comes through the sward
		float gS = max(dot(normalize(gV.xz), normalize(uFxSun.xz + vec2(1e-4))), 0.0);
		gS = gS * gS * (1.0 - clamp(uFxSun.y * 1.8, 0.0, 1.0)) * step(0.0, uFxSun.y);
		diffuseColor.rgb *= 1.0 + vec3(0.6, 0.62, 0.12) * gS;
	}
#endif`);
  };
  m.customProgramCacheKey = () => prevKey() + 'fxg2';
  m.userData.fxGrassPatched = true;
  return true;
}

/** mean colour (linear) of an atlas cell, read from the canvas the atlas was painted on */
function cellMeans(tex, nx, ny, cells) {
  const out = cells.map(() => new THREE.Color(0.1, 0.2, 0.06));
  try {
    const img = tex.image, c = document.createElement('canvas'); c.width = c.height = 4;
    const g = c.getContext('2d', { willReadFrequently: true }), cw = img.width / nx, ch = img.height / ny;
    cells.forEach((ci, i) => {
      g.drawImage(img, (ci % nx) * cw + cw * 0.1, Math.floor(ci / nx) * ch + ch * 0.1, cw * 0.8, ch * 0.8, 0, 0, 4, 4);
      const d = g.getImageData(0, 0, 4, 4).data; let r = 0, gg = 0, b = 0;
      for (let k = 0; k < 64; k += 4) { r += d[k]; gg += d[k + 1]; b += d[k + 2]; }
      out[i].setRGB(r / 16 / 255, gg / 16 / 255, b / 16 / 255, THREE.SRGBColorSpace);
    });
  } catch (e) { /* a mock canvas (node): the defaults */ }
  return out;
}

/**
 * o: { ground: the ground atlas material, groundTex, nx, ny, macro (the ground's macro-noise scale), meshes: () => the
 *      ground / water tile meshes (drawn top-down for the mask) }
 */
export function createGrassFx(game, scene, o) {
  const R = game.renderer, can = !!(R && R.capabilities && R.capabilities.isWebGL2 && R.setRenderTarget);
  const G = { enabled: false, mesh: null, stats: { masks: 0, clumps: CLUMPS } };
  let rt = null, mesh = null, mat = null, on = false, mx = 1e9, mz = 1e9, tagged = false, again = 0;
  const uMask = { value: null }, uMaskC = { value: new THREE.Vector3(0, 0, 1 / MEXT) }, uWind = { value: new THREE.Vector4(1, 0, 0.3, 0) };
  const uCols = { value: null };
  const cam = new THREE.OrthographicCamera(-MEXT / 2, MEXT / 2, MEXT / 2, -MEXT / 2, 1, 600); cam.up.set(0, 0, -1);
  const uNone = { value: 0 };
  const maskMat = new THREE.ShaderMaterial({ uniforms: { uNone }, vertexShader: MASK_VS, fragmentShader: MASK_FS, side: THREE.DoubleSide, toneMapped: false, fog: false }); maskMat.name = 'fx:grassMask';
  const overMat = new THREE.ShaderMaterial({ vertexShader: OVER_VS, fragmentShader: OVER_FS, side: THREE.DoubleSide, toneMapped: false, fog: false, depthTest: false, depthWrite: false }); overMat.name = 'fx:grassOver';
  const hid = [], shown = [];
  const _col = new THREE.Color();

  function build() {
    const g = new THREE.InstancedBufferGeometry();
    // three blades: (side -1 / +1 / 0, height 0 / 0 / 1, blade index)
    const P = [];
    for (let b = 0; b < 3; b++) P.push(-1, 0, b, 1, 0, b, 0, 1, b);
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(27).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(27).fill(1), 3));
    const A = new Float32Array(CLUMPS * 4);
    let s = 12345; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < CLUMPS; i++) { A[i * 4] = rnd() * S; A[i * 4 + 1] = rnd() * S; A[i * 4 + 2] = rnd(); A[i * 4 + 3] = rnd(); }
    g.setAttribute('aRoot', new THREE.InstancedBufferAttribute(A, 4));
    g.instanceCount = CLUMPS;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    uCols.value = cellMeans(o.groundTex, o.nx, o.ny, [4, 5, 6, 7]);
    mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, name: 'fx:grassBlades' });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMask = uMask; sh.uniforms.uMaskC = uMaskC; sh.uniforms.uWind = uWind; sh.uniforms.uCols = uCols; sh.uniforms.uTimeG = U.time; sh.uniforms.uSunG = U.sunDir;
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize(vNormal);');
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aRoot;\nuniform sampler2D uMask;\nuniform vec3 uMaskC;\nuniform vec4 uWind;\nuniform vec3 uCols[4];\nuniform float uTimeG;\nuniform vec3 uSunG;\nvarying float vBladeY;\n' + GLSL_HASH)
        .replace('#include <color_vertex>', /* glsl */`
	vec2 gRel = mod(aRoot.xy - cameraPosition.xz, ${S.toFixed(1)}) - ${(S / 2).toFixed(1)};
	vec2 gW = cameraPosition.xz + gRel;
	float gD = length(gRel);
	vec4 gM = texture2D(uMask, vec2(gW.x - uMaskC.x, uMaskC.y - gW.y) * uMaskC.z + 0.5);
	float gK = gM.r, gLawn = step(0.4, gK) * step(gK, 0.6), gMead = step(0.65, gK) * step(gK, 0.85);
	float gTus = wNoise(gW * 0.9) * 0.6 + wNoise(gW * 3.1 + 5.0) * 0.4;
	float gH = gLawn > 0.5 ? 0.042 : gMead > 0.5 ? 0.12 + 0.3 * gTus * gTus : gK > 0.9 ? 0.09 : 0.065 + 0.08 * gTus;
	gH *= 0.65 + 0.7 * fract(aRoot.z * 7.31 + position.z * 0.37);
	float gFade = gLawn > 0.5 ? 1.0 - smoothstep(5.0, 13.0, gD) : 1.0 - smoothstep(${(S * 0.3).toFixed(1)}, ${(S * 0.48).toFixed(1)}, gD);
	gH *= gFade * step(0.6, gM.g);
	float gAng = aRoot.w * 6.2832 + position.z * 2.1;
	vec2 gDir = vec2(cos(gAng), sin(gAng));
	float gWid = (0.007 + 0.006 * aRoot.z + (gMead > 0.5 ? 0.004 : 0.0)) * (1.0 + gD * 0.22);
	vec2 gRoot = gW + vec2(cos(gAng * 1.7), sin(gAng * 1.7)) * 0.05 * position.z;
	// wind: gusts travelling downwind, a quicker shiver on top; each blade leans its own way a little
	float gPh = dot(gRoot, uWind.xy) * 0.35 - uTimeG * (0.9 + uWind.z);
	float gSw = (sin(gPh) * 0.6 + sin(gPh * 2.7 + aRoot.w * 6.0) * 0.25 + 0.5) * uWind.z + 0.12;
	vec2 gBend = (uWind.xy * gSw + (gDir.yx * vec2(1.0, -1.0)) * (aRoot.z - 0.5) * 0.5) * gH * position.y * 0.9;
	vec3 gPos = vec3(gRoot.x + gDir.x * position.x * gWid + gBend.x, position.y * gH * (1.0 - 0.25 * gSw * gSw), gRoot.y + gDir.y * position.x * gWid + gBend.y);
	vBladeY = position.y;
	{
		vec3 gC = gLawn > 0.5 ? uCols[1] : gMead > 0.5 ? uCols[2] : gK > 0.9 ? uCols[3] : uCols[0];
		// the ground's own macro tint (materials.js USE_MACRO), so blades and sward agree patch by patch
		float gMc = wNoise(gW * ${o.macro.toFixed(4)}) * 0.55 + wNoise(gW * ${(o.macro * 3.3).toFixed(4)} + 7.0) * 0.3 + wNoise(gW * ${(o.macro * 11).toFixed(4)} + 3.0) * 0.15;
		vec3 gT = mix(vec3(0.7, 0.82, 0.66), vec3(1.26, 1.14, 0.84), smoothstep(0.22, 0.78, gMc));
		gC *= mix(vec3(1.0), gT, gLawn > 0.5 ? 0.55 : 1.0);
		gC *= (0.46 + 0.7 * position.y) * (0.85 + 0.3 * aRoot.z); gC = mix(vec3(dot(gC, vec3(0.3, 0.6, 0.1))), gC, 0.8) * (gLawn > 0.5 ? 1.0 : 0.93);
		if (gMead > 0.5) gC = mix(gC, gC * vec3(1.7, 1.45, 0.8), position.y * smoothstep(0.3, 0.8, gTus) * 0.7);
		float gSn = max(dot(normalize(gRel + vec2(1e-4)), normalize(uSunG.xz + vec2(1e-4))), 0.0);
		gSn = gSn * gSn * (1.0 - clamp(uSunG.y * 1.8, 0.0, 1.0)) * step(0.0, uSunG.y);
		gC *= 1.0 + vec3(0.9, 0.95, 0.2) * gSn * position.y;
		vColor = vec3(gC);
	}`)
        .replace('#include <begin_vertex>', 'vec3 transformed = gPos;')
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    };
    mat.customProgramCacheKey = () => 'fxBlades1';
    mesh = new THREE.Mesh(g, mat);
    mesh.name = 'world:fxGrass'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.visible = false;
    scene.add(mesh); G.mesh = mesh;
  }
  function ensure() {
    if (rt) return;
    rt = new THREE.WebGLRenderTarget(MSIZE, MSIZE, { depthBuffer: true, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false });
    rt.texture.name = 'fx:grassMask'; uMask.value = rt.texture;
  }
  function drawMask(cx, cz) {
    ensure();
    if (!tagged || (G.stats.masks % 6) === 5) { for (const m of o.meshes()) if (m) m.layers.enable(L_GROUND); if (o.water) for (const m of o.water()) if (m) m.layers.enable(L_WATER); tagged = true; }
    cam.position.set(cx, 500, cz); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld(true);
    cam.layers.set(L_GROUND);
    const prev = R.getRenderTarget(), sm = R.shadowMap.autoUpdate, smN = R.shadowMap.needsUpdate, a = R.getClearAlpha(), ov = scene.overrideMaterial, bg = scene.background, au = scene.matrixWorldAutoUpdate, vis = mesh ? mesh.visible : false, ac = R.autoClear;
    R.getClearColor(_col); R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false;
    try {
      scene.overrideMaterial = maskMat; scene.background = null; scene.matrixWorldAutoUpdate = false; if (mesh) mesh.visible = false;
      R.setRenderTarget(rt); R.setClearColor(0x000000, 1); R.clear(true, true, false); uNone.value = 0;
      // (every ground tile under the mask is drawn whether or not the distance cull has shown it yet: straight after a
      //  teleport or a door the tiles round the new place are still hidden for a tick, and paths would be missing)
      shown.length = 0; for (const m of o.meshes()) if (m && !m.visible) { m.visible = true; shown.push(m); }
      R.render(scene, cam);
      for (let i = 0; i < shown.length; i++) shown[i].visible = false; shown.length = 0;
      // buildings and everything else on the sky light's occluder layer: NONE wherever one is seen from above, whatever
      // atlas cell its surface is painted from. (2026-11-22, "pieces of grass hovering above the stairs to the pump quad":
      // they were drawn in the ground's pass, where the shader reads a mesh's atlas CELL NUMBER as a kind of ground — 4
      // park grass, 5 lawn, 6 meadow, 7 woodland floor — for any surface below 0.2 m; a place's own atlas has other things
      // in those cells (Worcester's stone flags were its cell 5), so its steps down into a sunk court, seen through the
      // hole in the ground, were "lawn" and blades stood at y 0 in the air above them.) Depth tested against the ground
      // just drawn: a cellar or a footing UNDER unbroken ground does not clear the grass over it.
      cam.layers.set(L_BUILD); uNone.value = 1; R.autoClear = false; R.render(scene, cam);
      // water lies over the ground it was dug out of: none there, whatever is underneath
      cam.layers.set(L_WATER); uNone.value = 1; maskMat.depthTest = false; R.autoClear = false; R.render(scene, cam);
      // ...and whatever else lies low over it (the ground tiles themselves, the tufts and the soft shadows stand aside)
      hid.length = 0;
      for (const m of o.meshes()) if (m && m.visible) { m.visible = false; hid.push(m); }
      for (const c of scene.children) if (c.visible && (SKIP.has(c.name) || ROOMVIEW.test(c.name) || c.renderOrder >= 1e5 || c.onBeforeRender !== NOHOOK || (c.material && !Array.isArray(c.material) && (c.material.transparent || c.material.alphaTest > 0)))) { c.visible = false; hid.push(c); }      // (decals, light pools, cut-out cards)
      // (a kind of object met for the first time is a new variant of the one override program: left out of this mask
      //  rather than waited for — core/_lazylink.js "soft" — and the mask is taken again in a moment)
      const LL = R.linkWait || null, sk0 = LL ? LL.skipped : 0; if (LL) LL.soft++;
      cam.layers.set(0); scene.overrideMaterial = overMat;
      try { R.render(scene, cam); } finally { if (LL) { LL.soft--; if (LL.skipped > sk0 && !(again > 0)) again = 0.3; } }
    } catch (e) { if (!G.stats.error) { G.stats.error = String(e && e.message || e); console.warn('[fx grass] mask draw failed', e); }
    } finally { for (let i = 0; i < shown.length; i++) shown[i].visible = false; shown.length = 0; for (let i = 0; i < hid.length; i++) hid[i].visible = true; hid.length = 0; maskMat.depthTest = true; R.autoClear = ac; scene.overrideMaterial = ov; scene.background = bg; scene.matrixWorldAutoUpdate = au; if (mesh) mesh.visible = vis; R.setRenderTarget(prev); R.setClearColor(_col, a); R.shadowMap.autoUpdate = sm; R.shadowMap.needsUpdate = smN; }
    uMaskC.value.set(cx, cz, 1 / MEXT); mx = cx; mz = cz; G.stats.masks++;
  }
  G.set = (v) => {
    on = !!v && can; G.enabled = on;
    if (on && patchGround(o.ground)) { if (!('FX_GRASS' in o.ground.defines)) { o.ground.defines.FX_GRASS = ''; o.ground.needsUpdate = true; } }
    else if ('FX_GRASS' in o.ground.defines) { delete o.ground.defines.FX_GRASS; o.ground.needsUpdate = true; }
    if (on && !mesh) build();
    if (mesh && !on) mesh.visible = false;
  };
  /** once a frame outdoors; aerial: no blades from the air */
  G.update = (dt, sky, aerial) => {
    if (!on || !mesh) return;
    const c = (game.eye || game.camera.position);
    if (aerial || c.y > 40 || game.scene !== scene) { mesh.visible = false; return; }
    const tx = MEXT / MSIZE, cx = Math.round(c.x / tx) * tx, cz = Math.round(c.z / tx) * tx;
    // (after a jump — a teleport, a door, the first frame — the ground tiles round the new place are not all shown yet:
    //  the mask is drawn again once they are, or paths would be missing from it until the next 20 m)
    const jump = Math.hypot(cx - mx, cz - mz);
    if (jump > MMOVE) { drawMask(cx, cz); if (jump > 60) again = 0.8; }
    else if (again > 0 && (again -= dt) <= 0) drawMask(cx, cz);
    const W = sky && sky.weather, wx = game.weather && game.weather.wind, sp = wx && isFinite(wx.speed) ? wx.speed : 3;
    uWind.value.set(W ? W.wind[0] : 1, W ? W.wind[1] : 0, Math.min(1.1, 0.12 + sp * 0.07), 0);
    mesh.visible = true;
  };
  /** tests: the mask's kind (0..255) at a world point, read back (stalls: never in play) */
  G.maskAt = (x, z) => { if (!rt) return -1; const b = new Uint8Array(4), u = Math.floor(((x - mx) / MEXT + 0.5) * MSIZE), v = Math.floor(((mz - z) / MEXT + 0.5) * MSIZE); R.readRenderTargetPixels(rt, u, v, 1, 1, b); return [b[0], b[1]]; };
  /** the loading screen: the mask draw and its program (the blades' program is compiled by the world's warm draw) */
  G.warm = () => { if (!can) return false; const c = (game.eye || game.camera.position); if (!mesh) build(); drawMask(c.x, c.z); mx = mz = 1e9; return true; };
  return G;
}
