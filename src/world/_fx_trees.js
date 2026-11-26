// Tree crowns on the top tier (shader pass 11; tier field `treeFx`, ?treefx=0).
//
// The near trees of vegetation.js are ~64 leaf-spray cards a crown, each card up to 4-5 m across on a big plane: close
// to, the crown read as a few scribbled sheets. vegetation.js already knows how to build a finer tree — the model its
// far-tree pictures are baked from: 3.2x the cards at 0.62 of the size — so here that model is what stands near the
// camera: a second BatchedMesh (one draw, one more in the shadow pass) filled from the same tree store, shown instead
// of the standard one while the field is on. Because the far cards are pictures of this very model, the swap at the
// near distance is closer than it was. On top of the whole-tree sway the leaves move: each card bobs and twists about
// its own centre, more in the gusts that cross the crown, by the weather's wind.
// Needs WEBGL_multi_draw (as the standard batch does); without it nothing changes.
import * as THREE from 'three';
import { U, addWind } from './materials.js';
import { treeModel, treeNearMaterial } from './vegetation.js';

export function createTreeFx(game, scene, veg, M) {
  const X = { enabled: false, mesh: null, stats: { trees: 0, tris: 0 } };
  const uWind = { value: 0.4 };
  let B = null, on = false, failed = false;
  const _m = new THREE.Matrix4(), _c = new THREE.Color();
  function build() {
    const base = veg.nearBatch, R = game.renderer;
    if (!base || !R || !THREE.BatchedMesh) { failed = true; return; }
    const near = veg.sets.filter((s) => s.name !== 'trees:far');
    const geos = near.map((s) => treeModel(s.name.slice(6), true));
    let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
    const mat = addWind(treeNearMaterial(M.treeTex), 0.018, 'wTreeNearFx');
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      sh.uniforms.uFxTreeWind = uWind;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aCtr;\nuniform float uFxTreeWind;')
        .replace('#include <project_vertex>', /* glsl */`
	{
		// the leaves: each spray bobs and twists about its own centre, most in the gusts crossing the crown
		vec3 fC = aCtr.xyz, fO = transformed - fC;
		float fPh = dot(fC, vec3(37.0, 17.0, 29.0)) + wPh * 3.0;
		float fG = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.6 + wPh * 0.5 + fC.x * 2.3 + fC.z * 1.7));
		float fA = length(fO) * (0.10 + 0.22 * uFxTreeWind) * fG * (1.0 - aTrunk) * (0.5 + 0.9 * fract(dot(fO, vec3(91.0, 57.0, 33.0))));
		transformed += vec3(sin(uTime * 2.3 + fPh), cos(uTime * 1.9 + fPh * 1.3) * 0.7, sin(uTime * 2.7 + fPh * 0.7)) * fA;
	}
	#include <project_vertex>`);
    };
    mat.customProgramCacheKey = () => 'wTreeNearFx1';
    mat.name = 'fx:treeNear';
    // the shadow: the standard depth material draws each spray as a lozenge an eighth of its card; these cards are
    // smaller, so they are shrunk less, or a plane avenue would throw only a thin dapple
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); depth.name = 'fx:treeDepth';
    depth.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aCtr;').replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = mix(transformed, aCtr.xyz, aCtr.w * 0.45);'); };
    depth.customProgramCacheKey = () => 'fxTreeDepth1';
    const mesh = new THREE.BatchedMesh(base.cap, nv, ni, mat);
    mesh.name = 'world:fxTrees'; mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.perObjectFrustumCulled = true; mesh.sortObjects = false;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.customDepthMaterial = depth; mesh.visible = false;
    const ids = geos.map((g) => mesh.addGeometry(g));
    for (let i = 0; i < base.cap; i++) { mesh.addInstance(ids[0]); mesh.setVisibleAt(i, false); }
    scene.add(mesh);
    B = { mesh, ids, near, used: 0, lastX: 1e9, lastZ: 1e9, cap: base.cap, tris: geos.map((g) => g.index.count / 3) };
    X.mesh = mesh;
  }
  function refresh(cx, cz, force) {
    const dx0 = cx - B.lastX, dz0 = cz - B.lastZ;
    if (!force && dx0 * dx0 + dz0 * dz0 < 144) return;
    B.lastX = cx; B.lastZ = cz;
    let n = 0, tris = 0;
    for (let k = 0; k < B.near.length; k++) {
      const set = B.near[k], lim = set.bands[0].maxDist * set.bands[0].maxDist, XZ = set.xz;
      for (let i = 0; i < set.n && n < B.cap; i++) {
        const dx = XZ[i * 2] - cx, dz = XZ[i * 2 + 1] - cz;
        if (dx * dx + dz * dz > lim) continue;
        _m.fromArray(set.mat, i * 16);
        B.mesh.setGeometryIdAt(n, B.ids[k]); B.mesh.setMatrixAt(n, _m); B.mesh.setColorAt(n, _c.setRGB(set.col[i * 3], set.col[i * 3 + 1], set.col[i * 3 + 2])); B.mesh.setVisibleAt(n, true);
        n++; tris += B.tris[k];
      }
    }
    for (let i = n; i < B.used; i++) B.mesh.setVisibleAt(i, false);
    B.used = n; B.mesh.visible = n > 0; B.mesh.userData.tris = tris; X.stats.trees = n; X.stats.tris = tris;
  }
  let lastNear = -1;
  X.set = (v) => {
    on = !!v && !failed && !!veg.nearBatch; X.enabled = on;
    if (on && !B) { try { build(); } catch (e) { console.warn('[fx trees] off', e); failed = true; } if (!B) { on = false; X.enabled = false; } }
    veg.nearBatch && (veg.nearBatch.off = on);
    if (veg.nearBatch) { if (on) veg.nearBatch.mesh.visible = false; else veg.nearBatch.lastX = 1e9; }
    if (B) { if (!on) B.mesh.visible = false; else B.lastX = 1e9; }
  };
  /** once a frame outdoors (cheap: refills only when the camera has moved 12 m or the near distance changed) */
  X.update = (dt, sky, aerial) => {
    if (!on || !B) return;
    if (aerial) { if (B.mesh.visible) { B.mesh.visible = false; veg.nearBatch.off = false; veg.nearBatch.lastX = 1e9; B.lastX = 1e9; } return; }
    veg.nearBatch.off = true;
    const c = (game.eye || game.camera.position), nd = B.near[0] ? B.near[0].bands[0].maxDist : 0;
    refresh(c.x, c.z, nd !== lastNear); lastNear = nd;
    const wx = game.weather && game.weather.wind, sp = wx && isFinite(wx.speed) ? wx.speed : 3;
    uWind.value = Math.min(1, sp / 10);
  };
  return X;
}
