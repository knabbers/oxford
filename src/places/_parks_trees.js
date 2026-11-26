// University Parks: trees for the Parks woods the city's seeded scatter leaves bare. world/vegetation.js stops
// scattering when its 6,500-tree budget runs out, and by the time it reaches the Parks relation's woods (Lazenbee's
// Ground, Cox's Corner, Bean Tree Avenue, the riverside belts…) there is nothing left, so they draw as bare woodland
// floor. This plants them much the same way (9 m grid — a little sparser than the world's 7.5 m, for the triangle budget — 85 %, 9–20 m, broadleaf/conifer mix; Indian bean trees in Bean
// Tree Avenue) with the world's own tree geometry and materials (wind sway, LOD billboards), in two InstanceSets that
// follow the quality tier's near/far distances. Any world trees already in those woods are cleared first, so the
// result does not change if the world's budget ever reaches them.
// Draw calls: ≤ 2 near (+ shadow) + 1 billboard.
import * as THREE from 'three';
import { InstanceSet } from '../world/instancing.js';
import { parkPaths } from './_parks_paths.js';

export const BARE_WOODS = ['r19529677', 'r19529678', 'r19529679', 'r19529680', 'r19529681', 'r19529683', 'r19529676', 'w29431369'];
const HUE = { broad: [0.22, 0.29, 0.38, 0.6, 0.2, 0.32], conifer: [0.3, 0.38, 0.3, 0.45, 0.12, 0.2] };
const WIDTH = { broad: [0.8, 1.3], conifer: [0.8, 1.1] };

export function buildParkTrees(game) {
  const PP = parkPaths(game);
  const W = game.world, scene = game.worldScene, col = game.worldCollider, inP = W.util.pointInPoly;
  const find = (n) => scene.children.find((o) => o.name === n && o.isInstancedMesh);
  const near = { broad: find('world:trees:broad'), conifer: find('world:trees:conifer') }, far = find('world:trees:far');
  if (!near.broad || !far) return null;
  const tier = () => (game.quality && game.quality.tier) || { treeNear: 90, treeFar: 1100 };
  const mkSet = (sp) => near[sp] ? new InstanceSet(scene, 'parks-trees:' + sp, [{ meshes: [{ geometry: near[sp].geometry, material: near[sp].material, castShadow: true, receiveShadow: false }], maxDist: tier().treeNear }], 700) : null;
  const sets = { broad: mkSet('broad'), conifer: mkSet('conifer') };
  const bb = new InstanceSet(scene, 'parks-trees:far', [{ meshes: [], maxDist: tier().treeNear }, { meshes: [{ geometry: far.geometry, material: far.material, castShadow: false, receiveShadow: false }], maxDist: tier().treeFar }], 1400);
  for (const m of bb.meshes) m.frustumCulled = true;
  const color = new THREE.Color();
  const blocked = (x, z) => {
    const hit = PP.near(x, z, 2.0);
    return hit || !col.isFree(x, z, 1.0) || col.isWater(x, z) || col.isWater(x + 2, z) || col.isWater(x - 2, z) || col.isWater(x, z + 2) || col.isWater(x, z - 2);
  };
  let n = 0, removed = 0;
  for (const id of BARE_WOODS) {
    const a = game.map.areas.find((x) => x.id === id); if (!a) continue;
    removed += W.clearArea(a.poly, { trees: true, furniture: false, lamps: false });
    const bean = id === 'r19529680';
    const spacing = bean ? 10 : 9, prob = bean ? 0.8 : 0.85, sizes = bean ? [9, 13] : [9, 20];
    const rr = W.rng('parks-trees-' + id);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity; for (const [x, z] of a.poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    for (let x = minX + spacing / 2; x < maxX; x += spacing) for (let z = minZ + spacing / 2; z < maxZ; z += spacing) {
      if (rr() > prob) continue;
      const px = x + (rr() - 0.5) * spacing * 0.9, pz = z + (rr() - 0.5) * spacing * 0.9;
      if (!inP(px, pz, a.poly) || blocked(px, pz)) continue;
      const h = sizes[0] + (sizes[1] - sizes[0]) * rr(), r = rr();
      const sp = bean || r < 0.82 || !sets.conifer ? 'broad' : 'conifer', si = sp === 'broad' ? 0 : 1;
      const hu = HUE[sp], wd = WIDTH[sp], r2 = (r * 7.31) % 1, r3 = (r * 13.7) % 1;
      color.setHSL(hu[0] + (hu[1] - hu[0]) * r2, hu[2] + (hu[3] - hu[2]) * r3, hu[4] + (hu[5] - hu[4]) * ((r * 3.3) % 1));
      const w = h * (bean ? 1.35 : wd[0] + (wd[1] - wd[0]) * r3);
      sets[sp].add(px, 0, pz, r * 6.283, [w, h, w], color);
      bb.add(px, 0, pz, si - 2, [w, h, w], color);
      col.addCircle(px, pz, 0.3, { tag: 'tree' });
      n++;
    }
  }
  const all = [sets.broad, sets.conifer, bb].filter(Boolean);
  let lastNear = -1;
  return {
    count: n, removed,
    update() {
      const t = tier(), c = game.camera.position;
      let force = false;
      if (t.treeNear !== lastNear) { lastNear = t.treeNear; for (const s of all) s.bands[0].maxDist = Math.min(t.treeNear, 75);   // 3D trees to 75 m, billboards beyond (triangle budget)
 bb.bands[1].maxDist = t.treeFar; force = true; }
      for (const s of all) s.refresh(c.x, c.z, force, 15);
    },
  };
}
